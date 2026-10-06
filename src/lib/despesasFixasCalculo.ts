import type { ContaRecord, LancamentoRecord, PlanoContaRecord } from '@/types/finance'
import { calcularDreGerencialMatriz } from '@/lib/dreGerencialCalculo'
import type { MesItem, ContaMatrizItem } from '@/lib/dreGerencialTypes'

export interface ContaDespesaFixaLinha {
  id: string
  nome: string
  codigo?: string
  centroId?: string
  centroNome?: string
  centroCodigo?: string
  tipoDespesaId?: string
  tipoDespesaNome?: string
  tipoDespesaCodigo?: string
  valoresPorMes: Record<string, number>
  percentuaisPorMes: Record<string, number | null>
  totalPeriodo: number
  percentualPeriodo: number | null
}

export interface DespesasFixasAnaliseResultado {
  meses: MesItem[]
  contas: ContaDespesaFixaLinha[]
  faturamentoPorMes: Record<string, number>
  faturamentoTotalPeriodo: number
  totalDespesasFixasPorMes: Record<string, number>
  totalDespesasFixasPeriodo: number
  percentualTotalPorMes: Record<string, number | null>
  percentualTotalPeriodo: number | null
  temDespesasFixas: boolean
}

/**
 * Calcula a variação/relação percentual de um valor em relação ao faturamento (Receita total do mês).
 * Se o faturamento for zero ou negativo (ou inexistente), retorna null para exibir traço ("—").
 */
export function calcularPercentualFaturamento(valor: number, faturamento: number): number | null {
  if (faturamento <= 0 || !Number.isFinite(faturamento)) {
    return null
  }
  return (valor / faturamento) * 100
}

/**
 * Classifica a gravidade do % de despesa fixa sobre faturamento:
 * Verde: < 25% (baixo / saudável)
 * Âmbar: 25% a 40% (médio / atenção)
 * Vermelho: > 40% (alto / crítico)
 */
export function classificarSemaforoPercentual(
  percentual: number | null | undefined,
): 'verde' | 'ambar' | 'vermelho' | 'neutro' {
  if (percentual === null || percentual === undefined || !Number.isFinite(percentual)) {
    return 'neutro'
  }
  if (percentual < 25) {
    return 'verde'
  }
  if (percentual <= 40) {
    return 'ambar'
  }
  return 'vermelho'
}

/**
 * Retorna classes CSS de cores para o semáforo de percentual:
 */
export function getClassesSemaforoPercentual(
  percentual: number | null | undefined,
  opcoes?: { badge?: boolean },
): string {
  const status = classificarSemaforoPercentual(percentual)
  if (opcoes?.badge) {
    switch (status) {
      case 'verde':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200'
      case 'ambar':
        return 'bg-amber-50 text-amber-800 border-amber-200'
      case 'vermelho':
        return 'bg-rose-50 text-rose-800 border-rose-200 font-bold'
      default:
        return 'bg-slate-50 text-slate-500 border-slate-200'
    }
  }

  switch (status) {
    case 'verde':
      return 'text-emerald-700 font-medium'
    case 'ambar':
      return 'text-amber-700 font-semibold'
    case 'vermelho':
      return 'text-rose-700 font-bold'
    default:
      return 'text-slate-400'
  }
}

/**
 * Processa a análise de Despesas Fixas reutilizando o cálculo da DRE Gerencial:
 * 1. Calcula a matriz completa da DRE (garantindo regras de estorno, planos, contas excluídas 'nao_exibir_dre' e 'nao_exibir_em_nada').
 * 2. Extrai o faturamento de cada mês (grupo 'Receita').
 * 3. Extrai as contas classificadas como 'Despesa Fixa' e calcula o % de cada uma em relação ao faturamento daquele mesmo mês.
 * 4. Calcula os totais de despesas fixas de cada mês e o % do faturamento mensal.
 * 5. Calcula o consolidado geral do período (soma geral de despesas fixas e soma geral do faturamento).
 */
export function calcularAnaliseDespesasFixas(
  lancamentos: LancamentoRecord[],
  contas: ContaRecord[],
  meses: MesItem[],
  planoContas?: PlanoContaRecord[],
): DespesasFixasAnaliseResultado {
  // Reutiliza a matriz oficial da DRE Gerencial
  const matrizDre = calcularDreGerencialMatriz(lancamentos, contas, meses, planoContas, {
    tipoRelatorio: 'dre',
  })

  // 1. Mapeia faturamento por mês (Grupo "Receita")
  const grupoReceitas = matrizDre.grupos.find((g) => g.classificacao === 'Receita')
  const faturamentoPorMes: Record<string, number> = {}
  let faturamentoTotalPeriodo = 0

  for (const m of meses) {
    const recMes = grupoReceitas?.valoresPorMes[m.chave] || 0
    faturamentoPorMes[m.chave] = recMes
  }
  faturamentoTotalPeriodo = grupoReceitas?.totalPeriodo || 0

  // 2. Extrai grupo "Despesa Fixa"
  const grupoDespFixa = matrizDre.grupos.find((g) => g.classificacao === 'Despesa Fixa')
  const contasDreFixas: ContaMatrizItem[] = grupoDespFixa ? grupoDespFixa.contas : []

  // Constrói linhas de contas com valores e percentuais
  const contasResultado: ContaDespesaFixaLinha[] = contasDreFixas.map((c) => {
    const percentuaisPorMes: Record<string, number | null> = {}

    for (const m of meses) {
      const valorMes = c.valoresPorMes[m.chave] || 0
      const fatMes = faturamentoPorMes[m.chave] || 0
      percentuaisPorMes[m.chave] = calcularPercentualFaturamento(valorMes, fatMes)
    }

    const percentualPeriodo = calcularPercentualFaturamento(c.totalPeriodo, faturamentoTotalPeriodo)

    return {
      id: c.id,
      nome: c.nome,
      codigo: c.codigo,
      centroId: c.centroId,
      centroNome: c.centroNome,
      centroCodigo: c.centroCodigo,
      tipoDespesaId: c.tipoDespesaId,
      tipoDespesaNome: c.tipoDespesaNome,
      tipoDespesaCodigo: c.tipoDespesaCodigo,
      valoresPorMes: c.valoresPorMes,
      percentuaisPorMes,
      totalPeriodo: c.totalPeriodo,
      percentualPeriodo,
    }
  })

  // 3. Totais de despesas fixas por mês e percentual sobre o faturamento do mês
  const totalDespesasFixasPorMes: Record<string, number> = {}
  const percentualTotalPorMes: Record<string, number | null> = {}

  for (const m of meses) {
    const totalFixaMes = grupoDespFixa?.valoresPorMes[m.chave] || 0
    totalDespesasFixasPorMes[m.chave] = totalFixaMes
    const fatMes = faturamentoPorMes[m.chave] || 0
    percentualTotalPorMes[m.chave] = calcularPercentualFaturamento(totalFixaMes, fatMes)
  }

  const totalDespesasFixasPeriodo = grupoDespFixa?.totalPeriodo || 0
  const percentualTotalPeriodo = calcularPercentualFaturamento(
    totalDespesasFixasPeriodo,
    faturamentoTotalPeriodo,
  )

  const temDespesasFixas =
    contasResultado.length > 0 ||
    totalDespesasFixasPeriodo > 0 ||
    Object.values(totalDespesasFixasPorMes).some((v) => v > 0)

  return {
    meses,
    contas: contasResultado,
    faturamentoPorMes,
    faturamentoTotalPeriodo,
    totalDespesasFixasPorMes,
    totalDespesasFixasPeriodo,
    percentualTotalPorMes,
    percentualTotalPeriodo,
    temDespesasFixas,
  }
}
