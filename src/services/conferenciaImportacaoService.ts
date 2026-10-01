import type { LancamentoExcelLinha } from './importacaoLancamentosExcelIaService'
import type { LancamentoRecord, PlanoContaRecord } from '@/types/finance'

export type StatusItemConferencia = 'importado' | 'parcial' | 'nao_importado'

export type MotivoNaoImportacao =
  | 'sem_conta_vinculada'
  | 'fora_periodo'
  | 'duplicidade_pulada'
  | 'valor_invalido'
  | 'descartada_manualmente'
  | 'desmarcada_usuario'
  | 'erro_gravacao'
  | 'outro'

export interface ItemMesConferencia {
  mes: number // 1..12
  rotuloMes: string
  valorPlanilha: number
  gravado: boolean
  valorGravado: number
  lancamentoId?: string
  status: 'importado' | 'nao_importado'
  motivo?: MotivoNaoImportacao
  detalheMotivo?: string
}

export interface ItemContaConferencia {
  id: string // chave única: conta/código/linha
  chaveAgrupamento: string
  codigoPlanilha?: string
  nomeContaPlanilha: string
  planoContaId?: string
  planoContaCodigo?: string
  planoContaNome?: string
  classificacaoDre?: string
  tipo: 'Receita' | 'Despesa'
  isMatriz: boolean

  // Totalizadores
  totalLinhasEsperadas: number
  totalLinhasGravadas: number
  somaValorPlanilha: number
  somaValorGravado: number
  diferencaValor: number

  // Status geral do item
  statusGeral: StatusItemConferencia
  motivosNaoImportacao: MotivoNaoImportacao[]
  detalhesMotivos: string[]

  // Detalhamento mês a mês ou por ocorrência
  meses: ItemMesConferencia[]

  // Referência às linhas do Excel para permitir reimportação
  linhasExcel: LancamentoExcelLinha[]
}

export interface ResumoConferenciaImportacao {
  totalContas: number
  totalItensEsperados: number // total de linhas×meses com valor
  totalItensGravados: number
  totalItensPendentes: number
  valorTotalEsperado: number
  valorTotalGravado: number
  valorTotalPendente: number
  contasImportadas: number // 100% OK
  contasParciais: number
  contasNaoImportadas: number
  contasSemClassificacaoDre: number
  idsContasSemDre: string[]
}

/**
 * Normaliza string para chave de busca/comparação (remove espaços, minúsculas, sem acentos)
 */
export function normalizarChave(text: string): string {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

/**
 * Normaliza número para 2 casas decimais
 */
function toCentavos(valor: number): number {
  return Math.round(Number(valor || 0) * 100)
}

/**
 * Compara o que a planilha continha (LancamentoExcelLinha[]) com o que foi
 * efetivamente gravado no banco de dados (LancamentoRecord[] da sessão/ano/empresa).
 */
export function conciliarImportacaoExcel({
  linhasPlanilha,
  lancamentosGravados,
  planoContas,
  isMatriz,
}: {
  linhasPlanilha: LancamentoExcelLinha[]
  lancamentosGravados: LancamentoRecord[]
  planoContas: PlanoContaRecord[]
  isMatriz: boolean
}): {
  itens: ItemContaConferencia[]
  resumo: ResumoConferenciaImportacao
} {
  // Mapa de plano_contas por id para consulta rápida de classificação DRE
  const planoMap = new Map<string, PlanoContaRecord>()
  for (const pc of planoContas) {
    planoMap.set(pc.id, pc)
  }

  // Mapa de lançamentos gravados indexados por chaves:
  // 1) empresa|plano_conta|data(YYYY-MM-DD)|centavos
  // 2) empresa|data(YYYY-MM-DD)|centavos|historicoNormalizado
  const gravadosPorPlanoDataValor = new Map<string, LancamentoRecord[]>()
  const gravadosPorDataValorHist = new Map<string, LancamentoRecord[]>()
  const gravadosUtilizados = new Set<string>()

  for (const lanc of lancamentosGravados) {
    const dataIso = (lanc.data || '').slice(0, 10)
    const cent = toCentavos(lanc.valor)
    const pcId = lanc.plano_conta || ''
    const histNorm = normalizarChave(lanc.historico || '')

    const k1 = `${pcId}|${dataIso}|${cent}`
    const arr1 = gravadosPorPlanoDataValor.get(k1) || []
    arr1.push(lanc)
    gravadosPorPlanoDataValor.set(k1, arr1)

    const k2 = `${dataIso}|${cent}|${histNorm}`
    const arr2 = gravadosPorDataValorHist.get(k2) || []
    arr2.push(lanc)
    gravadosPorDataValorHist.set(k2, arr2)
  }

  // Agrupa as linhas da planilha por Conta / Chave de Agrupamento
  const gruposMap = new Map<string, LancamentoExcelLinha[]>()

  for (const linha of linhasPlanilha) {
    let chave = ''
    if (isMatriz) {
      chave =
        linha.planoContaId ||
        linha.codigoContaPlanilha ||
        linha.nomeContaPlanilha ||
        `linha_${linha.linhaPlanilha}`
    } else {
      chave =
        linha.planoContaId ||
        linha.codigoContaPlanilha ||
        linha.nomeContaPlanilha ||
        `linha_${linha.linhaPlanilha}`
    }
    const arr = gruposMap.get(chave) || []
    arr.push(linha)
    gruposMap.set(chave, arr)
  }

  const NOMES_MESES = [
    'Jan',
    'Fev',
    'Mar',
    'Abr',
    'Mai',
    'Jun',
    'Jul',
    'Ago',
    'Set',
    'Out',
    'Nov',
    'Dez',
  ]

  const itens: ItemContaConferencia[] = []
  let totalItensEsperados = 0
  let totalItensGravados = 0
  let valorTotalEsperado = 0
  let valorTotalGravado = 0
  const contasSemDreIdsSet = new Set<string>()

  for (const [chaveAgrupamento, linhasDoGrupo] of gruposMap.entries()) {
    const primeiraLinha = linhasDoGrupo[0]
    const planoId = linhasDoGrupo.find((l) => l.planoContaId)?.planoContaId
    const pcObj = planoId ? planoMap.get(planoId) : primeiraLinha.planoContaObj
    const contaObj = pcObj?.expand?.conta

    const nomeContaPlanilha =
      primeiraLinha.nomeContaPlanilha ||
      primeiraLinha.codigoContaPlanilha ||
      pcObj?.descricao ||
      contaObj?.nome ||
      'Conta não identificada'

    const planoContaNome = contaObj?.nome || pcObj?.descricao || primeiraLinha.planoContaNome
    const planoContaCodigo = pcObj?.codigo || primeiraLinha.planoContaCodigo
    const classificacaoDre = contaObj?.classificacao_dre || (pcObj as any)?.classificacao_dre

    if (planoId && (!classificacaoDre || classificacaoDre === 'Não classificados')) {
      if (contaObj?.id) {
        contasSemDreIdsSet.add(contaObj.id)
      }
    }

    const mesesConferencia: ItemMesConferencia[] = []
    const motivosSet = new Set<MotivoNaoImportacao>()
    const detalhesSet = new Set<string>()

    let somaPlanilhaGrupo = 0
    let somaGravadoGrupo = 0
    let linhasEsperadasGrupo = 0
    let linhasGravadasGrupo = 0

    for (const linha of linhasDoGrupo) {
      const dataIso = linha.dataIso || ''
      const cent = toCentavos(linha.valor)
      somaPlanilhaGrupo += linha.valor
      linhasEsperadasGrupo++

      // Tenta localizar lançamento gravado correspondente
      let matchLanc: LancamentoRecord | undefined

      if (linha.planoContaId) {
        const k1 = `${linha.planoContaId}|${dataIso}|${cent}`
        const candidatos1 = gravadosPorPlanoDataValor.get(k1) || []
        matchLanc = candidatos1.find((c) => !gravadosUtilizados.has(c.id))
      }

      if (!matchLanc) {
        const histNorm = normalizarChave(linha.historico || '')
        const k2 = `${dataIso}|${cent}|${histNorm}`
        const candidatos2 = gravadosPorDataValorHist.get(k2) || []
        matchLanc = candidatos2.find((c) => !gravadosUtilizados.has(c.id))
      }

      // Se ainda não achou, flexibiliza buscando por dataIso + centavos no mesmo mês
      if (!matchLanc && linha.planoContaId) {
        matchLanc = lancamentosGravados.find((c) => {
          if (gravadosUtilizados.has(c.id)) return false
          const cData = (c.data || '').slice(0, 10)
          return (
            c.plano_conta === linha.planoContaId &&
            cData === dataIso &&
            toCentavos(c.valor) === cent
          )
        })
      }

      const gravado = !!matchLanc
      if (matchLanc) {
        gravadosUtilizados.add(matchLanc.id)
        somaGravadoGrupo += matchLanc.valor
        linhasGravadasGrupo++
      }

      // Determina motivo caso não tenha sido gravado
      let motivo: MotivoNaoImportacao | undefined
      let detalheMotivo: string | undefined

      if (!gravado) {
        if (!linha.planoContaId) {
          motivo = 'sem_conta_vinculada'
          detalheMotivo = 'Conta contábil não vinculada ao Plano de Contas'
        } else if (linha.status === 'fora_periodo') {
          motivo = 'fora_periodo'
          detalheMotivo = linha.errosOuAlertas.join('; ') || 'Data/Mês fora do período selecionado'
        } else if (linha.status === 'duplicado' || linha.isDuplicadoExistente) {
          motivo = 'duplicidade_pulada'
          detalheMotivo = 'Lançamento idêntico já existia previamente no sistema'
        } else if (linha.valor <= 0 || linha.status === 'erro') {
          motivo = 'valor_invalido'
          detalheMotivo = linha.errosOuAlertas.join('; ') || 'Valor inválido ou data incorreta'
        } else if (!linha.selecionado) {
          motivo = 'desmarcada_usuario'
          detalheMotivo = 'Desmarcada pelo usuário antes de salvar'
        } else {
          motivo = 'erro_gravacao'
          detalheMotivo = 'Não foi gravado no banco ou erro na requisição'
        }

        if (motivo) {
          motivosSet.add(motivo)
          if (detalheMotivo) detalhesSet.add(detalheMotivo)
        }
      }

      mesesConferencia.push({
        mes: linha.mes,
        rotuloMes: NOMES_MESES[(linha.mes || 1) - 1] || `Mês ${linha.mes}`,
        valorPlanilha: linha.valor,
        gravado,
        valorGravado: matchLanc?.valor || 0,
        lancamentoId: matchLanc?.id,
        status: gravado ? 'importado' : 'nao_importado',
        motivo,
        detalheMotivo,
      })
    }

    // Status geral do item da conta
    let statusGeral: StatusItemConferencia = 'nao_importado'
    if (linhasGravadasGrupo === linhasEsperadasGrupo && linhasEsperadasGrupo > 0) {
      statusGeral = 'importado'
    } else if (linhasGravadasGrupo > 0) {
      statusGeral = 'parcial'
    }

    totalItensEsperados += linhasEsperadasGrupo
    totalItensGravados += linhasGravadasGrupo
    valorTotalEsperado += somaPlanilhaGrupo
    valorTotalGravado += somaGravadoGrupo

    itens.push({
      id: `conf_${chaveAgrupamento}_${itens.length}`,
      chaveAgrupamento,
      codigoPlanilha: primeiraLinha.codigoContaPlanilha,
      nomeContaPlanilha,
      planoContaId: planoId,
      planoContaCodigo,
      planoContaNome,
      classificacaoDre,
      tipo: primeiraLinha.tipo || 'Despesa',
      isMatriz,
      totalLinhasEsperadas: linhasEsperadasGrupo,
      totalLinhasGravadas: linhasGravadasGrupo,
      somaValorPlanilha: somaPlanilhaGrupo,
      somaValorGravado: somaGravadoGrupo,
      diferencaValor: somaPlanilhaGrupo - somaGravadoGrupo,
      statusGeral,
      motivosNaoImportacao: Array.from(motivosSet),
      detalhesMotivos: Array.from(detalhesSet),
      meses: mesesConferencia,
      linhasExcel: linhasDoGrupo,
    })
  }

  // Ordena itens: Primeiro ❌ Não importados, depois ⚠️ Parciais, por fim ✅ Importados
  itens.sort((a, b) => {
    const prioridade = { nao_importado: 1, parcial: 2, importado: 3 }
    const pA = prioridade[a.statusGeral]
    const pB = prioridade[b.statusGeral]
    if (pA !== pB) return pA - pB
    return a.nomeContaPlanilha.localeCompare(b.nomeContaPlanilha)
  })

  const contasImportadas = itens.filter((i) => i.statusGeral === 'importado').length
  const contasParciais = itens.filter((i) => i.statusGeral === 'parcial').length
  const contasNaoImportadas = itens.filter((i) => i.statusGeral === 'nao_importado').length

  const resumo: ResumoConferenciaImportacao = {
    totalContas: itens.length,
    totalItensEsperados,
    totalItensGravados,
    totalItensPendentes: totalItensEsperados - totalItensGravados,
    valorTotalEsperado,
    valorTotalGravado,
    valorTotalPendente: Math.max(0, valorTotalEsperado - valorTotalGravado),
    contasImportadas,
    contasParciais,
    contasNaoImportadas,
    contasSemClassificacaoDre: contasSemDreIdsSet.size,
    idsContasSemDre: Array.from(contasSemDreIdsSet),
  }

  return { itens, resumo }
}

/**
 * Filtra e prepara as linhas que estão pendentes para REIMPORTAÇÃO.
 * Garante que somente itens pendentes (❌ e ⚠️) sejam incluídos,
 * e verifica anti-duplicidade contra os lançamentos já gravados.
 */
export function extrairLinhasPendentesParaReimportacao({
  itensConferencia,
  lancamentosJaGravados,
}: {
  itensConferencia: ItemContaConferencia[]
  lancamentosJaGravados: LancamentoRecord[]
}): {
  linhasProntasParaGravar: LancamentoExcelLinha[]
  linhasAindaBloqueadas: Array<{
    linha: LancamentoExcelLinha
    motivoBloqueio: string
  }>
} {
  const existingSet = new Set<string>()
  for (const l of lancamentosJaGravados) {
    const dStr = (l.data || '').slice(0, 10)
    const vCent = toCentavos(l.valor)
    const pStr = l.plano_conta || ''
    const hStr = normalizarChave(l.historico || '')
    existingSet.add(`${dStr}|${vCent}|${hStr}`)
    if (pStr) {
      existingSet.add(`${dStr}|${vCent}|${pStr}`)
    }
  }

  const linhasProntas: LancamentoExcelLinha[] = []
  const linhasBloqueadas: Array<{ linha: LancamentoExcelLinha; motivoBloqueio: string }> = []

  for (const item of itensConferencia) {
    // Se o item já está 100% importado, pula
    if (item.statusGeral === 'importado') continue

    // Percorre cada mês ou linha do item
    for (let i = 0; i < item.meses.length; i++) {
      const mesConf = item.meses[i]
      if (mesConf.gravado) continue // Já gravado, pula anti-duplicidade

      const linhaExcel = item.linhasExcel[i] || item.linhasExcel[0]
      if (!linhaExcel) continue

      // Clona e atualiza com o planoConta atual do item caso tenha sido vinculado na conferência
      const linhaAjustada: LancamentoExcelLinha = {
        ...linhaExcel,
        planoContaId: item.planoContaId || linhaExcel.planoContaId,
        planoContaNome: item.planoContaNome || linhaExcel.planoContaNome,
        planoContaCodigo: item.planoContaCodigo || linhaExcel.planoContaCodigo,
        selecionado: true,
      }

      // Validação de bloqueio
      if (!linhaAjustada.planoContaId) {
        linhasBloqueadas.push({
          linha: linhaAjustada,
          motivoBloqueio: 'Conta contábil ainda não vinculada',
        })
        continue
      }

      if (linhaAjustada.valor <= 0) {
        linhasBloqueadas.push({
          linha: linhaAjustada,
          motivoBloqueio: 'Valor zerado ou inválido',
        })
        continue
      }

      if (!linhaAjustada.dataIso) {
        linhasBloqueadas.push({
          linha: linhaAjustada,
          motivoBloqueio: 'Data do lançamento inválida',
        })
        continue
      }

      // Anti-duplicidade
      const dStr = (linhaAjustada.dataIso || '').slice(0, 10)
      const vCent = toCentavos(linhaAjustada.valor)
      const pStr = linhaAjustada.planoContaId
      const hStr = normalizarChave(linhaAjustada.historico || '')

      const chave1 = `${dStr}|${vCent}|${hStr}`
      const chave2 = `${dStr}|${vCent}|${pStr}`

      if (existingSet.has(chave1) || existingSet.has(chave2)) {
        linhasBloqueadas.push({
          linha: linhaAjustada,
          motivoBloqueio: 'Lançamento duplicado (já gravado no sistema)',
        })
        continue
      }

      // Registra temporariamente para não duplicar dentro do próprio lote pendente
      existingSet.add(chave1)
      existingSet.add(chave2)

      linhasProntas.push(linhaAjustada)
    }
  }

  return {
    linhasProntasParaGravar: linhasProntas,
    linhasAindaBloqueadas: linhasBloqueadas,
  }
}
