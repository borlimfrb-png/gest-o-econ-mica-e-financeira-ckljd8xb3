import type { ContaRecord, LancamentoRecord } from '@/types/finance'
import { obterClassificacaoDreConta } from './dreClassificacaoHeuristica'
import {
  GRUPOS_DRE_ORDEM,
  TITULOS_GRUPOS_DRE,
  SINAL_MULTIPLICADOR_GRUPO,
  type DreMatrizResultado,
  type GrupoMatrizItem,
  type ContaMatrizItem,
  type MesItem,
  type ClassificacaoDre,
} from './dreGerencialTypes'

/**
 * Calcula a matriz completa da DRE Gerencial a partir dos lançamentos rápidos e contas cadastradas.
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
): DreMatrizResultado {
  const chavesMesesValidos = new Set(meses.map((m) => m.chave))

  // Mapa de contas por ID
  const contaMap = new Map<string, ContaRecord>()
  for (const c of contas) {
    contaMap.set(c.id, c)
  }

  // Agrupamento de lançamentos por conta e por mês (chave YYYY-MM)
  // map: contaId -> mesChave -> soma dos valores
  const somaPorContaMes = new Map<string, Map<string, number>>()

  for (const lanc of lancamentos) {
    if (!lanc.data) continue
    // Extrai ano-mês da data 'YYYY-MM-DD'
    const mesChave = lanc.data.slice(0, 7)
    if (!chavesMesesValidos.has(mesChave)) continue

    const contaId = lanc.conta || '__sem_conta__'
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

    const contaMatrizItem: ContaMatrizItem = {
      id: contaId,
      nome: conta ? conta.nome : 'Lançamentos sem conta vinculada',
      codigo: conta?.codigo,
      tipo: conta?.tipo,
      grupo: conta?.grupo,
      classificacao: classificacao || 'NaoClassificado',
      valoresPorMes: valoresPorMesConta,
      totalPeriodo: totalConta,
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

  // Ordenar contas alfabeticamente dentro de cada grupo
  for (const grupo of gruposMap.values()) {
    grupo.contas.sort((a, b) => a.nome.localeCompare(b.nome))
  }
  naoClassificados.contas.sort((a, b) => a.nome.localeCompare(b.nome))

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
