import type { ContaRecord, LancamentoRecord, PlanoContaRecord } from '@/types/finance'
import { calcularDreGerencialMatriz } from './dreGerencialCalculo'
import type { MesItem } from './dreGerencialTypes'

export interface CenarioBaseDre {
  faturamento: number // Receita Bruta / Receitas DRE
  despesasVariaveis: number // Custos / Despesas Variáveis
  despesasFixas: number // Custos / Despesas Operacionais Fixas
  despesasFinanceiras: number // Despesas Financeiras
  receitasFinanceiras: number // Receitas Financeiras
  resultadoFinanceiroLiquido: number // receitasFinanceiras - despesasFinanceiras
  totalDespesas: number // despesasVariaveis + despesasFixas + despesasFinanceiras
  lucroPrejuizo: number // faturamento - despesasVariaveis - despesasFixas - despesasFinanceiras + receitasFinanceiras
  margemContribuicaoReais: number // faturamento - despesasVariaveis
  margemContribuicaoPct: number | null // margemContribuicaoReais / faturamento * 100
  margemLiquidaPct: number | null // lucroPrejuizo / faturamento * 100
  percentualVariaveisSobreFat: number | null // despesasVariaveis / faturamento * 100
  percentualFixasSobreFat: number | null // despesasFixas / faturamento * 100
  temDados: boolean
}

export interface ParametrosSimulacaoCrescimento {
  percentualCrescimentoFaturamento: number // ex: +10% (-50 a +100)
  modoDespesasVariaveis: 'proporcional' | 'personalizado'
  percentualCrescimentoVariaveis?: number // usado se modo === 'personalizado'
  modoDespesasFixas: 'manter' | 'personalizado'
  percentualCrescimentoFixas?: number // ex: +5% (usado se modo === 'personalizado')
  percentualCrescimentoFinanceiras?: number // opcional, default 0%
}

export interface CenarioSimuladoResultado {
  faturamento: number
  despesasVariaveis: number
  despesasFixas: number
  despesasFinanceiras: number
  receitasFinanceiras: number
  totalDespesas: number
  lucroPrejuizo: number
  margemContribuicaoReais: number
  margemContribuicaoPct: number | null
  margemLiquidaPct: number | null
  pontoEquilibrioReais: number | null // Ponto de equilíbrio contábil (PE = Fixas / Margem de Contribuição %)
  margemSegurancaReais: number | null // Faturamento simulado - Ponto de equilíbrio
  margemSegurancaPct: number | null // Queda percentual tolerada antes do lucro zerar ((Fat - PE) / Fat * 100)
  quedaFaturamentoAteLucroZeroPct: number | null // Sinônimo da margem de segurança
}

export interface ComparativoItemCrescimento {
  chave: string
  label: string
  base: number
  simulado: number
  deltaAbsoluto: number // simulado - base
  deltaPercentual: number | null // ((simulado - base) / |base|) * 100
  favoravel: boolean // true se a variação for positiva para receita/lucro ou negativa para despesas
  tipo: 'receita' | 'despesa' | 'lucro' | 'indicador'
}

export interface ResultadoSimuladorCrescimento {
  cenarioBase: CenarioBaseDre
  parametros: ParametrosSimulacaoCrescimento
  cenarioSimulado: CenarioSimuladoResultado
  comparativo: {
    faturamento: ComparativoItemCrescimento
    despesasVariaveis: ComparativoItemCrescimento
    despesasFixas: ComparativoItemCrescimento
    despesasFinanceiras: ComparativoItemCrescimento
    totalDespesas: ComparativoItemCrescimento
    lucroPrejuizo: ComparativoItemCrescimento
    margemLiquidaPct: {
      base: number | null
      simulado: number | null
      deltaPontosPercentuais: number | null
    }
  }
  resumoExecutivo: string
}

/**
 * Extrai os valores reais da DRE Gerencial do sistema para os meses fornecidos.
 * Aplica todas as regras oficiais de estorno, exclusões "não DRE" e plano de contas.
 */
export function extrairCenarioBaseDre(
  lancamentos: LancamentoRecord[],
  contas: ContaRecord[],
  meses: MesItem[],
  planoContas?: PlanoContaRecord[],
): CenarioBaseDre {
  const matrizDre = calcularDreGerencialMatriz(lancamentos, contas, meses, planoContas, {
    tipoRelatorio: 'dre',
  })

  const grupoReceita = matrizDre.grupos.find((g) => g.classificacao === 'Receita')
  const grupoDespVar = matrizDre.grupos.find((g) => g.classificacao === 'Despesa Variável')
  const grupoDespFix = matrizDre.grupos.find((g) => g.classificacao === 'Despesa Fixa')
  const grupoDespFin = matrizDre.grupos.find((g) => g.classificacao === 'Despesa Financeira')
  const grupoRecFin = matrizDre.grupos.find((g) => g.classificacao === 'Receita Financeira')

  const faturamento = grupoReceita?.totalPeriodo || 0
  const despesasVariaveis = grupoDespVar?.totalPeriodo || 0
  const despesasFixas = grupoDespFix?.totalPeriodo || 0
  const despesasFinanceiras = grupoDespFin?.totalPeriodo || 0
  const receitasFinanceiras = grupoRecFin?.totalPeriodo || 0

  const totalDespesas = despesasVariaveis + despesasFixas + despesasFinanceiras
  const resultadoFinanceiroLiquido = receitasFinanceiras - despesasFinanceiras
  const lucroPrejuizo = matrizDre.lucroPrejuizo.totalPeriodo

  const margemContribuicaoReais = faturamento - despesasVariaveis
  const margemContribuicaoPct =
    faturamento > 0 ? (margemContribuicaoReais / faturamento) * 100 : null

  const margemLiquidaPct = faturamento > 0 ? (lucroPrejuizo / faturamento) * 100 : null

  const percentualVariaveisSobreFat =
    faturamento > 0 ? (despesasVariaveis / faturamento) * 100 : null

  const percentualFixasSobreFat = faturamento > 0 ? (despesasFixas / faturamento) * 100 : null

  const temDados =
    faturamento > 0 ||
    despesasVariaveis > 0 ||
    despesasFixas > 0 ||
    despesasFinanceiras > 0 ||
    receitasFinanceiras > 0 ||
    matrizDre.naoClassificados.totalPeriodo > 0

  return {
    faturamento,
    despesasVariaveis,
    despesasFixas,
    despesasFinanceiras,
    receitasFinanceiras,
    resultadoFinanceiroLiquido,
    totalDespesas,
    lucroPrejuizo,
    margemContribuicaoReais,
    margemContribuicaoPct,
    margemLiquidaPct,
    percentualVariaveisSobreFat,
    percentualFixasSobreFat,
    temDados,
  }
}

/**
 * Calcula a variação percentual segura entre dois números.
 */
export function calcularDeltaPercentual(base: number, simulado: number): number | null {
  if (base === 0) {
    if (simulado === 0) return 0
    return null
  }
  return ((simulado - base) / Math.abs(base)) * 100
}

/**
 * Calcula o ponto de equilíbrio contábil e a margem de segurança do cenário simulado.
 */
export function calcularPontoEquilibrioSimulado(
  faturamentoSimulado: number,
  despesasFixasSimuladas: number,
  despesasFinanceirasLiquidasSimuladas: number,
  margemContribuicaoPctSimulada: number | null,
): {
  pontoEquilibrioReais: number | null
  margemSegurancaReais: number | null
  margemSegurancaPct: number | null
} {
  if (
    margemContribuicaoPctSimulada === null ||
    margemContribuicaoPctSimulada <= 0 ||
    faturamentoSimulado <= 0
  ) {
    return {
      pontoEquilibrioReais: null,
      margemSegurancaReais: null,
      margemSegurancaPct: null,
    }
  }

  // Custos estruturais que a margem de contribuição precisa cobrir para o lucro zerar
  // Inclui despesas fixas + resultado financeiro líquido se for custo líquido
  const custosEstruturais = Math.max(
    0,
    despesasFixasSimuladas + Math.max(0, despesasFinanceirasLiquidasSimuladas),
  )

  const mcDecimal = margemContribuicaoPctSimulada / 100
  const peReais = custosEstruturais / mcDecimal

  const msReais = faturamentoSimulado - peReais
  const msPct = (msReais / faturamentoSimulado) * 100

  return {
    pontoEquilibrioReais: peReais,
    margemSegurancaReais: msReais,
    margemSegurancaPct: msPct,
  }
}

/**
 * Gera o texto do resumo executivo automatizado da simulação.
 */
export function gerarResumoExecutivoCrescimento(
  cenarioBase: CenarioBaseDre,
  simulado: CenarioSimuladoResultado,
  params: ParametrosSimulacaoCrescimento,
): string {
  if (!cenarioBase.temDados) {
    return 'Não há base de dados de DRE cadastrada no período selecionado para projetar o crescimento.'
  }

  const formatBrlLocal = (val: number) =>
    val.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })

  const fatCresce = params.percentualCrescimentoFaturamento
  const fatSinal = fatCresce >= 0 ? `+${fatCresce.toFixed(1)}%` : `${fatCresce.toFixed(1)}%`

  let fixasText = 'mantendo as despesas fixas estáveis'
  if (params.modoDespesasFixas === 'personalizado') {
    const fixPct = params.percentualCrescimentoFixas || 0
    if (fixPct === 0) {
      fixasText = 'mantendo as despesas fixas estáveis'
    } else {
      const fixSinal = fixPct > 0 ? `+${fixPct.toFixed(1)}%` : `${fixPct.toFixed(1)}%`
      fixasText = `com variação de ${fixSinal} nas despesas fixas`
    }
  }

  let varText = 'despesas variáveis proporcionais ao faturamento'
  if (params.modoDespesasVariaveis === 'personalizado') {
    const varPct = params.percentualCrescimentoVariaveis || 0
    const varSinal = varPct >= 0 ? `+${varPct.toFixed(1)}%` : `${varPct.toFixed(1)}%`
    varText = `despesas variáveis com variação de ${varSinal}`
  }

  const lucroBase = cenarioBase.lucroPrejuizo
  const lucroSim = simulado.lucroPrejuizo
  const deltaLucroPct = calcularDeltaPercentual(lucroBase, lucroSim)

  const margemBaseStr =
    cenarioBase.margemLiquidaPct !== null ? `${cenarioBase.margemLiquidaPct.toFixed(1)}%` : '—'
  const margemSimStr =
    simulado.margemLiquidaPct !== null ? `${simulado.margemLiquidaPct.toFixed(1)}%` : '—'

  let deltaLucroStr = ''
  if (deltaLucroPct !== null) {
    const sinalDelta =
      deltaLucroPct >= 0 ? `+${deltaLucroPct.toFixed(1)}%` : `${deltaLucroPct.toFixed(1)}%`
    deltaLucroStr = ` (${sinalDelta})`
  }

  const verboLucro = lucroSim > lucroBase ? 'sobe' : lucroSim < lucroBase ? 'recua' : 'permanece em'

  let frase1 = `Com ${fatSinal} de faturamento, ${varText} e ${fixasText}, o resultado operacional ${verboLucro} de ${formatBrlLocal(
    lucroBase,
  )} para ${formatBrlLocal(lucroSim)}${deltaLucroStr}.`

  let frase2 = ` A margem líquida passa de ${margemBaseStr} para ${margemSimStr}.`

  let frase3 = ''
  if (simulado.margemSegurancaPct !== null && simulado.margemSegurancaPct > 0) {
    frase3 = ` No cenário simulado, o faturamento suporta uma retração de até ${simulado.margemSegurancaPct.toFixed(
      1,
    )}% antes do ponto de equilíbrio zerar o lucro.`
  } else if (simulado.margemSegurancaPct !== null && simulado.margemSegurancaPct <= 0) {
    frase3 =
      ' O cenário simulado opera abaixo do ponto de equilíbrio, gerando prejuízo operacional no período.'
  }

  return `${frase1}${frase2}${frase3}`
}

/**
 * Função pura que calcula todo o modelo de simulação de crescimento.
 */
export function calcularSimuladorCrescimento(
  cenarioBase: CenarioBaseDre,
  parametros: ParametrosSimulacaoCrescimento,
): ResultadoSimuladorCrescimento {
  const fatPct = parametros.percentualCrescimentoFaturamento || 0
  const faturamentoSimulado = cenarioBase.faturamento * (1 + fatPct / 100)

  // Despesas Variáveis
  let despesasVariaveisSimuladas = 0
  if (parametros.modoDespesasVariaveis === 'proporcional') {
    // Acompanha proporcionalmente o faturamento
    if (cenarioBase.faturamento > 0 && cenarioBase.percentualVariaveisSobreFat !== null) {
      despesasVariaveisSimuladas =
        faturamentoSimulado * (cenarioBase.percentualVariaveisSobreFat / 100)
    } else {
      despesasVariaveisSimuladas = cenarioBase.despesasVariaveis * (1 + fatPct / 100)
    }
  } else {
    // Percentual próprio informado pelo usuário
    const varPct = parametros.percentualCrescimentoVariaveis || 0
    despesasVariaveisSimuladas = cenarioBase.despesasVariaveis * (1 + varPct / 100)
  }

  // Despesas Fixas
  let despesasFixasSimuladas = cenarioBase.despesasFixas
  if (parametros.modoDespesasFixas === 'personalizado') {
    const fixPct = parametros.percentualCrescimentoFixas || 0
    despesasFixasSimuladas = cenarioBase.despesasFixas * (1 + fixPct / 100)
  }

  // Despesas Financeiras
  const finPct = parametros.percentualCrescimentoFinanceiras || 0
  const despesasFinanceirasSimuladas = cenarioBase.despesasFinanceiras * (1 + finPct / 100)
  const receitasFinanceirasSimuladas = cenarioBase.receitasFinanceiras

  // Totais
  const totalDespesasSimuladas =
    despesasVariaveisSimuladas + despesasFixasSimuladas + despesasFinanceirasSimuladas

  const lucroSimulado =
    faturamentoSimulado -
    despesasVariaveisSimuladas -
    despesasFixasSimuladas -
    despesasFinanceirasSimuladas +
    receitasFinanceirasSimuladas

  const margemContribuicaoReais = faturamentoSimulado - despesasVariaveisSimuladas
  const margemContribuicaoPct =
    faturamentoSimulado > 0 ? (margemContribuicaoReais / faturamentoSimulado) * 100 : null

  const margemLiquidaPct =
    faturamentoSimulado > 0 ? (lucroSimulado / faturamentoSimulado) * 100 : null

  // Ponto de Equilíbrio
  const finLiquidasSimuladas = despesasFinanceirasSimuladas - receitasFinanceirasSimuladas
  const peInfo = calcularPontoEquilibrioSimulado(
    faturamentoSimulado,
    despesasFixasSimuladas,
    finLiquidasSimuladas,
    margemContribuicaoPct,
  )

  const cenarioSimulado: CenarioSimuladoResultado = {
    faturamento: faturamentoSimulado,
    despesasVariaveis: despesasVariaveisSimuladas,
    despesasFixas: despesasFixasSimuladas,
    despesasFinanceiras: despesasFinanceirasSimuladas,
    receitasFinanceiras: receitasFinanceirasSimuladas,
    totalDespesas: totalDespesasSimuladas,
    lucroPrejuizo: lucroSimulado,
    margemContribuicaoReais,
    margemContribuicaoPct,
    margemLiquidaPct,
    pontoEquilibrioReais: peInfo.pontoEquilibrioReais,
    margemSegurancaReais: peInfo.margemSegurancaReais,
    margemSegurancaPct: peInfo.margemSegurancaPct,
    quedaFaturamentoAteLucroZeroPct: peInfo.margemSegurancaPct,
  }

  // Comparativos Base vs Simulado
  const criarItemComp = (
    chave: string,
    label: string,
    base: number,
    simulado: number,
    tipo: 'receita' | 'despesa' | 'lucro' | 'indicador',
  ): ComparativoItemCrescimento => {
    const deltaAbs = simulado - base
    const deltaPct = calcularDeltaPercentual(base, simulado)
    let favoravel = false
    if (tipo === 'receita' || tipo === 'lucro') {
      favoravel = deltaAbs >= 0
    } else if (tipo === 'despesa') {
      favoravel = deltaAbs <= 0
    } else {
      favoravel = deltaAbs >= 0
    }
    return {
      chave,
      label,
      base,
      simulado,
      deltaAbsoluto: deltaAbs,
      deltaPercentual: deltaPct,
      favoravel,
      tipo,
    }
  }

  const compFat = criarItemComp(
    'faturamento',
    'Faturamento (Receita Bruta)',
    cenarioBase.faturamento,
    faturamentoSimulado,
    'receita',
  )

  const compVar = criarItemComp(
    'despesasVariaveis',
    'Despesas Variáveis (Custos Variáveis)',
    cenarioBase.despesasVariaveis,
    despesasVariaveisSimuladas,
    'despesa',
  )

  const compFix = criarItemComp(
    'despesasFixas',
    'Despesas Fixas (Operacionais)',
    cenarioBase.despesasFixas,
    despesasFixasSimuladas,
    'despesa',
  )

  const compFin = criarItemComp(
    'despesasFinanceiras',
    'Despesas Financeiras',
    cenarioBase.despesasFinanceiras,
    despesasFinanceirasSimuladas,
    'despesa',
  )

  const compTot = criarItemComp(
    'totalDespesas',
    'Total de Despesas',
    cenarioBase.totalDespesas,
    totalDespesasSimuladas,
    'despesa',
  )

  const compLuc = criarItemComp(
    'lucroPrejuizo',
    'Lucro / Prejuízo do Período',
    cenarioBase.lucroPrejuizo,
    lucroSimulado,
    'lucro',
  )

  let deltaMargemPp: number | null = null
  if (cenarioBase.margemLiquidaPct !== null && margemLiquidaPct !== null) {
    deltaMargemPp = margemLiquidaPct - cenarioBase.margemLiquidaPct
  }

  const resumoExecutivo = gerarResumoExecutivoCrescimento(cenarioBase, cenarioSimulado, parametros)

  return {
    cenarioBase,
    parametros,
    cenarioSimulado,
    comparativo: {
      faturamento: compFat,
      despesasVariaveis: compVar,
      despesasFixas: compFix,
      despesasFinanceiras: compFin,
      totalDespesas: compTot,
      lucroPrejuizo: compLuc,
      margemLiquidaPct: {
        base: cenarioBase.margemLiquidaPct,
        simulado: margemLiquidaPct,
        deltaPontosPercentuais: deltaMargemPp,
      },
    },
    resumoExecutivo,
  }
}
