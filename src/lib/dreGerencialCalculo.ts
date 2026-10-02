import type { ContaRecord, LancamentoRecord, PlanoContaRecord } from '@/types/finance'
import { obterClassificacaoDreConta } from './dreClassificacaoHeuristica'
import {
  GRUPOS_DRE_ORDEM,
  TITULOS_GRUPOS_DRE,
  SINAL_MULTIPLICADOR_GRUPO,
  compararContasDre,
  compararCentroTipoConta,
  type DreMatrizResultado,
  type DreComparativoResultado,
  type GrupoComparativoItem,
  type ContaComparativoItem,
  type GrupoMatrizItem,
  type ContaMatrizItem,
  type MesItem,
  type ClassificacaoDre,
} from './dreGerencialTypes'

/**
 * Calcula a matriz completa da DRE Gerencial a partir dos lançamentos rápidos,
 * contas cadastradas e opcionalmente lista de plano_contas (caso o expand do lançamento
 * não venha populado).
 *
 * Estrutura:
 * 1. Receitas (+)
 * 2. (–) Despesas Variáveis
 * 3. (–) Despesas Fixas
 * 4. (–) Despesas Financeiras
 * 5. (+) Receitas Financeiras
 * 6. = Lucro ou Prejuízo (resultado do período)
 *
 * Fórmula do Lucro ou Prejuízo:
 * Receitas – Despesas Variáveis – Despesas Fixas – Despesas Financeiras + Receitas Financeiras
 */
export function calcularDreGerencialMatriz(
  lancamentos: LancamentoRecord[],
  contas: ContaRecord[],
  meses: MesItem[],
  planoContas?: PlanoContaRecord[],
  options?: {
    tipoRelatorio?: 'dre' | 'fluxo_caixa'
  },
): DreMatrizResultado {
  const tipoRelatorio = options?.tipoRelatorio || 'dre'
  const chavesMesesValidos = new Set(meses.map((m) => m.chave))

  // Mapa de contas por ID
  const contaMap = new Map<string, ContaRecord>()
  for (const c of contas) {
    contaMap.set(c.id, c)
  }

  // Mapa de plano_contas por ID para fallback caso o expand não venha preenchido
  const planoContasMap = new Map<string, PlanoContaRecord>()
  if (planoContas) {
    for (const p of planoContas) {
      planoContasMap.set(p.id, p)
    }
  }

  // Metadados de centro e tipo de despesa por conta
  const contaMetadados = new Map<
    string,
    {
      centroId?: string
      centroNome?: string
      centroCodigo?: string
      tipoDespesaId?: string
      tipoDespesaNome?: string
      tipoDespesaCodigo?: string
    }
  >()

  // Popula metadados antecipadamente caso planoContas tenha sido fornecido
  if (planoContas) {
    for (const p of planoContas) {
      const cId = p.conta
      if (cId && !contaMetadados.has(cId)) {
        contaMetadados.set(cId, {
          centroId: p.expand?.centro?.id || p.centro || undefined,
          centroNome: p.expand?.centro?.nome || undefined,
          centroCodigo: (p.expand?.centro as any)?.codigo || undefined,
          tipoDespesaId: p.expand?.tipo_despesa?.id || p.tipo_despesa || undefined,
          tipoDespesaNome: p.expand?.tipo_despesa?.nome || undefined,
          tipoDespesaCodigo: p.expand?.tipo_despesa?.codigo || undefined,
        })
      }
    }
  }

  // Agrupamento de lançamentos por conta e por mês (chave YYYY-MM)
  // map: contaId -> mesChave -> soma dos valores
  const somaPorContaMes = new Map<string, Map<string, number>>()

  for (const lanc of lancamentos) {
    // Ignora lançamentos estornados se houver flag
    if (lanc.estornado) continue
    if (!lanc.data) continue

    // Extrai ano-mês da data 'YYYY-MM-DD'
    const mesChave = lanc.data.slice(0, 7)
    if (!chavesMesesValidos.has(mesChave)) continue

    // Resolve o ID da Conta Contábil:
    // 1. Diretamente de expand.plano_conta.expand.conta.id
    // 2. De expand.plano_conta.conta (string id da conta)
    // 3. Do mapa planoContasMap usando lanc.plano_conta
    // 4. Se o lançamento tiver um campo legada .conta
    // 5. Fallback para __sem_conta__
    const expandPlanoConta = lanc.expand?.plano_conta
    const planoDoMapa = lanc.plano_conta ? planoContasMap.get(lanc.plano_conta) : undefined

    let contaId: string | null = null
    let contaExpandida: ContaRecord | undefined =
      expandPlanoConta?.expand?.conta || planoDoMapa?.expand?.conta

    if (contaExpandida?.id) {
      contaId = contaExpandida.id
      if (!contaMap.has(contaId)) {
        contaMap.set(contaId, contaExpandida)
      }
    } else if (expandPlanoConta?.conta) {
      contaId = expandPlanoConta.conta
    } else if (planoDoMapa?.conta) {
      contaId = planoDoMapa.conta
    } else if ((lanc as any).conta) {
      contaId = (lanc as any).conta
    }

    if (!contaId) {
      contaId = '__sem_conta__'
    }

    // Informações de Centro de Custo e Tipo de Despesa
    const centroExpandido = expandPlanoConta?.expand?.centro || planoDoMapa?.expand?.centro
    const centroId =
      centroExpandido?.id || expandPlanoConta?.centro || planoDoMapa?.centro || undefined
    const centroNome = centroExpandido?.nome || undefined
    const centroCodigo = (centroExpandido as any)?.codigo || undefined

    const tipoDespesaExpandido =
      expandPlanoConta?.expand?.tipo_despesa || planoDoMapa?.expand?.tipo_despesa
    const tipoDespesaId =
      tipoDespesaExpandido?.id ||
      expandPlanoConta?.tipo_despesa ||
      planoDoMapa?.tipo_despesa ||
      undefined
    const tipoDespesaNome = tipoDespesaExpandido?.nome || undefined
    const tipoDespesaCodigo = tipoDespesaExpandido?.codigo || undefined

    // Se a conta já tiver centro/tipo guardados e não tiver sobrescrito, complementa
    if (!contaMetadados.has(contaId)) {
      contaMetadados.set(contaId, {
        centroId,
        centroNome,
        centroCodigo,
        tipoDespesaId,
        tipoDespesaNome,
        tipoDespesaCodigo,
      })
    } else {
      const atualMeta = contaMetadados.get(contaId)!
      if (!atualMeta.centroNome && centroNome) {
        atualMeta.centroId = centroId
        atualMeta.centroNome = centroNome
        atualMeta.centroCodigo = centroCodigo
      }
      if (!atualMeta.tipoDespesaNome && tipoDespesaNome) {
        atualMeta.tipoDespesaId = tipoDespesaId
        atualMeta.tipoDespesaNome = tipoDespesaNome
        atualMeta.tipoDespesaCodigo = tipoDespesaCodigo
      }
    }

    const valor = Number(lanc.valor) || 0

    let mapaMeses = somaPorContaMes.get(contaId)
    if (!mapaMeses) {
      mapaMeses = new Map<string, number>()
      somaPorContaMes.set(contaId, mapaMeses)
    }

    const atual = mapaMeses.get(mesChave) || 0
    mapaMeses.set(mesChave, atual + valor)
  }

  // Estrutura para os 5 grupos oficiais
  const gruposMap = new Map<ClassificacaoDre, GrupoMatrizItem>()
  for (const clf of GRUPOS_DRE_ORDEM) {
    const valoresPorMes: Record<string, number> = {}
    for (const m of meses) {
      valoresPorMes[m.chave] = 0
    }
    gruposMap.set(clf, {
      classificacao: clf,
      titulo: TITULOS_GRUPOS_DRE[clf],
      sinal: SINAL_MULTIPLICADOR_GRUPO[clf],
      valoresPorMes,
      totalPeriodo: 0,
      contas: [],
    })
  }

  // Bloco de não classificados
  const valoresNaoClassificados: Record<string, number> = {}
  for (const m of meses) {
    valoresNaoClassificados[m.chave] = 0
  }
  const naoClassificados = {
    titulo: 'Não Classificados (Requer classificação no Plano de Contas)',
    valoresPorMes: valoresNaoClassificados,
    totalPeriodo: 0,
    contas: [] as ContaMatrizItem[],
  }

  // Processa todas as contas que possuem lançamento (e também contas cadastradas se houver lançamento)
  // Percorre as entradas de somaPorContaMes
  for (const [contaId, mapaMeses] of somaPorContaMes.entries()) {
    const conta = contaId !== '__sem_conta__' ? contaMap.get(contaId) : null

    // Regras de exclusão de relatórios gerenciais:
    // 1. "Não exibir em nada": oculta a conta tanto da DRE quanto do Fluxo de Caixa (e de Não Classificados)
    // 2. "Não exibir na DRE Gerencial": se tipoRelatorio === 'dre', oculta da DRE
    // 3. "Não exibir no Fluxo de Caixa": se tipoRelatorio === 'fluxo_caixa', oculta do Fluxo de Caixa
    if (conta) {
      if (conta.nao_exibir_em_nada) {
        continue
      }
      if (tipoRelatorio === 'dre' && conta.nao_exibir_dre) {
        continue
      }
      if (tipoRelatorio === 'fluxo_caixa' && conta.nao_exibir_fluxo_caixa) {
        continue
      }
    }

    const classificacao = obterClassificacaoDreConta(conta)

    const valoresPorMesConta: Record<string, number> = {}
    let totalConta = 0

    for (const m of meses) {
      const v = mapaMeses.get(m.chave) || 0
      valoresPorMesConta[m.chave] = v
      totalConta += v
    }

    // Se a conta não tiver nenhum valor no período, ignora
    if (totalConta === 0 && Object.values(valoresPorMesConta).every((v) => v === 0)) {
      continue
    }

    const meta = contaMetadados.get(contaId)

    const contaMatrizItem: ContaMatrizItem = {
      id: contaId,
      nome: conta ? conta.nome : 'Lançamentos sem conta vinculada',
      codigo: conta?.codigo,
      tipo: conta?.tipo,
      grupo: conta?.grupo,
      classificacao: classificacao || 'NaoClassificado',
      valoresPorMes: valoresPorMesConta,
      totalPeriodo: totalConta,
      centroId: meta?.centroId,
      centroNome: meta?.centroNome,
      centroCodigo: meta?.centroCodigo,
      tipoDespesaId: meta?.tipoDespesaId,
      tipoDespesaNome: meta?.tipoDespesaNome,
      tipoDespesaCodigo: meta?.tipoDespesaCodigo,
    }

    if (classificacao && gruposMap.has(classificacao)) {
      const grupo = gruposMap.get(classificacao)!
      grupo.contas.push(contaMatrizItem)
      for (const m of meses) {
        grupo.valoresPorMes[m.chave] += valoresPorMesConta[m.chave] || 0
      }
      grupo.totalPeriodo += totalConta
    } else {
      naoClassificados.contas.push(contaMatrizItem)
      for (const m of meses) {
        naoClassificados.valoresPorMes[m.chave] += valoresPorMesConta[m.chave] || 0
      }
      naoClassificados.totalPeriodo += totalConta
    }
  }

  // Ordenar contas por 1º Centro de Custo -> 2º Tipo de Despesa -> 3º Conta Contábil (código hierárquico + nome)
  for (const grupo of gruposMap.values()) {
    grupo.contas.sort(compararCentroTipoConta)
  }
  naoClassificados.contas.sort(compararCentroTipoConta)

  const grupos = GRUPOS_DRE_ORDEM.map((clf) => gruposMap.get(clf)!)

  // Cálculo de Lucro ou Prejuízo por mês e total:
  // Lucro/Prejuízo = Receitas – Despesas Variáveis – Despesas Fixas – Despesas Financeiras + Receitas Financeiras
  const valoresLucroPorMes: Record<string, number> = {}
  let totalLucroPeriodo = 0

  const margemLiquidaPorMes: Record<string, number | null> = {}

  for (const m of meses) {
    const rec = gruposMap.get('Receita')?.valoresPorMes[m.chave] || 0
    const despVar = gruposMap.get('Despesa Variável')?.valoresPorMes[m.chave] || 0
    const despFix = gruposMap.get('Despesa Fixa')?.valoresPorMes[m.chave] || 0
    const despFin = gruposMap.get('Despesa Financeira')?.valoresPorMes[m.chave] || 0
    const recFin = gruposMap.get('Receita Financeira')?.valoresPorMes[m.chave] || 0

    const resultadoMes = rec - despVar - despFix - despFin + recFin
    valoresLucroPorMes[m.chave] = resultadoMes
    totalLucroPeriodo += resultadoMes

    if (rec > 0) {
      margemLiquidaPorMes[m.chave] = (resultadoMes / rec) * 100
    } else {
      margemLiquidaPorMes[m.chave] = null
    }
  }

  const totalReceitasPeriodo = gruposMap.get('Receita')?.totalPeriodo || 0
  const margemLiquidaTotal =
    totalReceitasPeriodo > 0 ? (totalLucroPeriodo / totalReceitasPeriodo) * 100 : null

  return {
    meses,
    grupos,
    naoClassificados,
    lucroPrejuizo: {
      titulo: '= Lucro ou Prejuízo (Resultado)',
      valoresPorMes: valoresLucroPorMes,
      totalPeriodo: totalLucroPeriodo,
    },
    margemLiquidaPorMes,
    margemLiquidaTotal,
    totalReceitasPeriodo,
  }
}

/**
 * Calcula a variação percentual segura entre dois valores.
 * Retorna null se base for 0 e destino também for 0, ou se base for 0.
 */
export function calcularVariacaoPercentual(v1: number, v2: number): number | null {
  if (v1 === 0) {
    if (v2 === 0) return 0
    return null // base zero, não há percentual finito significativo
  }
  return ((v2 - v1) / Math.abs(v1)) * 100
}

/**
 * Determina se a variação é favorável economicamente.
 * Para Receitas e Lucro: Aumento (v2 >= v1) é favorável.
 * Para Despesas: Aumento (v2 > v1) é desfavorável (gasto maior). Queda (v2 <= v1) é favorável.
 */
export function isVariacaoFavoravel(
  classificacaoOuTipo: ClassificacaoDre | 'Lucro' | 'NaoClassificado',
  v1: number,
  v2: number,
): boolean {
  const diferenca = v2 - v1
  if (
    classificacaoOuTipo === 'Receita' ||
    classificacaoOuTipo === 'Receita Financeira' ||
    classificacaoOuTipo === 'Lucro'
  ) {
    return diferenca >= 0
  }
  // Para despesas e não-classificados (custos pendentes)
  return diferenca <= 0
}

/**
 * Compara duas matrizes DRE de períodos distintos e produz a análise comparativa
 * com variações em R$ e % e flags de favorabilidade.
 */
export function calcularComparativoDre(
  matriz1: DreMatrizResultado,
  matriz2: DreMatrizResultado,
  periodo1Descricao: string,
  periodo2Descricao: string,
): DreComparativoResultado {
  // Mapa de grupos por classificação da matriz 1 e matriz 2
  const grupos1Map = new Map<ClassificacaoDre, GrupoMatrizItem>()
  for (const g of matriz1.grupos) grupos1Map.set(g.classificacao, g)

  const grupos2Map = new Map<ClassificacaoDre, GrupoMatrizItem>()
  for (const g of matriz2.grupos) grupos2Map.set(g.classificacao, g)

  const gruposComparativo: GrupoComparativoItem[] = []

  for (const clf of GRUPOS_DRE_ORDEM) {
    const g1 = grupos1Map.get(clf)
    const g2 = grupos2Map.get(clf)

    const val1 = g1 ? g1.totalPeriodo : 0
    const val2 = g2 ? g2.totalPeriodo : 0
    const diferenca = val2 - val1
    const percentual = calcularVariacaoPercentual(val1, val2)
    const favoravel = isVariacaoFavoravel(clf, val1, val2)

    // Agrupa contas individuais presentes em qualquer um dos períodos
    const contasIds = new Set<string>()
    const contas1Map = new Map<string, ContaMatrizItem>()
    const contas2Map = new Map<string, ContaMatrizItem>()

    if (g1) {
      for (const c of g1.contas) {
        contasIds.add(c.id)
        contas1Map.set(c.id, c)
      }
    }
    if (g2) {
      for (const c of g2.contas) {
        contasIds.add(c.id)
        contas2Map.set(c.id, c)
      }
    }

    const contasComparativo: ContaComparativoItem[] = []
    for (const id of contasIds) {
      const c1 = contas1Map.get(id)
      const c2 = contas2Map.get(id)
      const ref = c2 || c1!
      const cv1 = c1 ? c1.totalPeriodo : 0
      const cv2 = c2 ? c2.totalPeriodo : 0
      const cDiff = cv2 - cv1
      const cPct = calcularVariacaoPercentual(cv1, cv2)
      const cFav = isVariacaoFavoravel(clf, cv1, cv2)

      contasComparativo.push({
        id,
        nome: ref.nome,
        codigo: ref.codigo,
        tipo: ref.tipo,
        grupo: ref.grupo,
        classificacao: clf,
        valorPeriodo1: cv1,
        valorPeriodo2: cv2,
        diferenca: cDiff,
        percentual: cPct,
        favoravel: cFav,
        centroId: ref.centroId,
        centroNome: ref.centroNome,
        centroCodigo: ref.centroCodigo,
        tipoDespesaId: ref.tipoDespesaId,
        tipoDespesaNome: ref.tipoDespesaNome,
        tipoDespesaCodigo: ref.tipoDespesaCodigo,
      })
    }

    contasComparativo.sort(compararCentroTipoConta)

    gruposComparativo.push({
      classificacao: clf,
      titulo: TITULOS_GRUPOS_DRE[clf],
      sinal: SINAL_MULTIPLICADOR_GRUPO[clf],
      valorPeriodo1: val1,
      valorPeriodo2: val2,
      diferenca,
      percentual,
      favoravel,
      contas: contasComparativo,
    })
  }

  // Lucro ou Prejuízo
  const lp1 = matriz1.lucroPrejuizo.totalPeriodo
  const lp2 = matriz2.lucroPrejuizo.totalPeriodo
  const lpDiff = lp2 - lp1
  const lpPct = calcularVariacaoPercentual(lp1, lp2)
  const lpFav = isVariacaoFavoravel('Lucro', lp1, lp2)

  // Margem Líquida
  const mg1 = matriz1.margemLiquidaTotal
  const mg2 = matriz2.margemLiquidaTotal
  const mgDiff = mg1 !== null && mg2 !== null ? mg2 - mg1 : null
  const mgFav = mgDiff !== null ? mgDiff >= 0 : true

  // Não Classificados
  const nc1 = matriz1.naoClassificados.totalPeriodo
  const nc2 = matriz2.naoClassificados.totalPeriodo
  const ncDiff = nc2 - nc1
  const ncPct = calcularVariacaoPercentual(nc1, nc2)
  const ncFav = isVariacaoFavoravel('NaoClassificado', nc1, nc2)

  const ncContasIds = new Set<string>()
  const nc1Map = new Map<string, ContaMatrizItem>()
  const nc2Map = new Map<string, ContaMatrizItem>()
  for (const c of matriz1.naoClassificados.contas) {
    ncContasIds.add(c.id)
    nc1Map.set(c.id, c)
  }
  for (const c of matriz2.naoClassificados.contas) {
    ncContasIds.add(c.id)
    nc2Map.set(c.id, c)
  }

  const ncContas: ContaComparativoItem[] = []
  for (const id of ncContasIds) {
    const c1 = nc1Map.get(id)
    const c2 = nc2Map.get(id)
    const ref = c2 || c1!
    const cv1 = c1 ? c1.totalPeriodo : 0
    const cv2 = c2 ? c2.totalPeriodo : 0
    ncContas.push({
      id,
      nome: ref.nome,
      codigo: ref.codigo,
      tipo: ref.tipo,
      grupo: ref.grupo,
      classificacao: 'NaoClassificado',
      valorPeriodo1: cv1,
      valorPeriodo2: cv2,
      diferenca: cv2 - cv1,
      percentual: calcularVariacaoPercentual(cv1, cv2),
      favoravel: isVariacaoFavoravel('NaoClassificado', cv1, cv2),
      centroId: ref.centroId,
      centroNome: ref.centroNome,
      centroCodigo: ref.centroCodigo,
      tipoDespesaId: ref.tipoDespesaId,
      tipoDespesaNome: ref.tipoDespesaNome,
      tipoDespesaCodigo: ref.tipoDespesaCodigo,
    })
  }
  ncContas.sort(compararCentroTipoConta)

  return {
    periodo1Descricao,
    periodo2Descricao,
    matriz1,
    matriz2,
    grupos: gruposComparativo,
    lucroPrejuizo: {
      titulo: '= Lucro ou Prejuízo (Resultado)',
      valorPeriodo1: lp1,
      valorPeriodo2: lp2,
      diferenca: lpDiff,
      percentual: lpPct,
      favoravel: lpFav,
    },
    margemLiquida: {
      margemPeriodo1: mg1,
      margemPeriodo2: mg2,
      diferencaPontos: mgDiff,
      favoravel: mgFav,
    },
    naoClassificados: {
      titulo: 'Não Classificados (Requer classificação no Plano de Contas)',
      valorPeriodo1: nc1,
      valorPeriodo2: nc2,
      diferenca: ncDiff,
      percentual: ncPct,
      favoravel: ncFav,
      contas: ncContas,
    },
  }
}
