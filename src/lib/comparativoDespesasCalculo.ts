import type { ContaRecord, LancamentoRecord, PlanoContaRecord } from '@/types/finance'
import { calcularDreGerencialMatriz } from '@/lib/dreGerencialCalculo'
import type { MesItem, ContaMatrizItem } from '@/lib/dreGerencialTypes'

export interface ContaComparativoLinha {
  id: string
  nome: string
  codigo?: string
  tipoCusto: 'fixa' | 'variavel'
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

export interface MesComparativoItem {
  chave: string
  rotuloCurto: string
  faturamento: number
  totalFixas: number
  totalVariaveis: number
  totalDespesas: number
  pctFixas: number | null
  pctVariaveis: number | null
  pctTotal: number | null
}

export type DiagnosticoEquilibrio =
  | 'equilibrado'
  | 'predominancia_fixas'
  | 'predominancia_variaveis'
  | 'alerta_sobrecarga'
  | 'sem_dados'

export interface ComparativoDespesasResultado {
  meses: MesItem[]
  itensMes: MesComparativoItem[]
  contasFixas: ContaComparativoLinha[]
  contasVariaveis: ContaComparativoLinha[]
  faturamentoPorMes: Record<string, number>
  faturamentoTotalPeriodo: number
  totalFixasPorMes: Record<string, number>
  totalFixasPeriodo: number
  totalVariaveisPorMes: Record<string, number>
  totalVariaveisPeriodo: number
  totalDespesasPorMes: Record<string, number>
  totalDespesasPeriodo: number
  pctFixasPorMes: Record<string, number | null>
  pctFixasPeriodo: number | null
  pctVariaveisPorMes: Record<string, number | null>
  pctVariaveisPeriodo: number | null
  pctTotalPorMes: Record<string, number | null>
  pctTotalPeriodo: number | null
  pesoFixasSobreTotalDespesas: number | null
  pesoVariaveisSobreTotalDespesas: number | null
  temDados: boolean
  diagnostico: {
    tipo: DiagnosticoEquilibrio
    titulo: string
    descricao: string
    recomendacao: string
  }
}

/**
 * Calcula percentual de um valor sobre o faturamento.
 * Retorna null se faturamento <= 0 ou inválido.
 */
export function calcularPercentualFaturamento(valor: number, faturamento: number): number | null {
  if (faturamento <= 0 || !Number.isFinite(faturamento)) {
    return null
  }
  return (valor / faturamento) * 100
}

/**
 * Classifica semáforo do percentual sobre faturamento:
 * Verde: < 25% (saudável)
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
 * Classes visuais CSS do semáforo
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

function mapearContaLinha(
  c: ContaMatrizItem,
  tipoCusto: 'fixa' | 'variavel',
  meses: MesItem[],
  faturamentoPorMes: Record<string, number>,
  faturamentoTotalPeriodo: number,
): ContaComparativoLinha {
  const percentuaisPorMes: Record<string, number | null> = {}

  for (const m of meses) {
    const valMes = c.valoresPorMes[m.chave] || 0
    const fatMes = faturamentoPorMes[m.chave] || 0
    percentuaisPorMes[m.chave] = calcularPercentualFaturamento(valMes, fatMes)
  }

  const percentualPeriodo = calcularPercentualFaturamento(c.totalPeriodo, faturamentoTotalPeriodo)

  return {
    id: c.id,
    nome: c.nome,
    codigo: c.codigo,
    tipoCusto,
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
}

/**
 * Gera diagnóstico executivo automático sobre a composição de custos
 */
function gerarDiagnostico(
  totFixas: number,
  totVariaveis: number,
  totFat: number,
  pctFixas: number | null,
  pctVariaveis: number | null,
  pctTotal: number | null,
): ComparativoDespesasResultado['diagnostico'] {
  const totDespesas = totFixas + totVariaveis

  if (totDespesas === 0 && totFat === 0) {
    return {
      tipo: 'sem_dados',
      titulo: 'Sem dados suficientes no período',
      descricao:
        'Não foram encontrados lançamentos de receitas nem despesas para o período selecionado.',
      recomendacao: 'Cadastre lançamentos contábeis ou ajuste o horizonte de meses.',
    }
  }

  const dif = totFixas - totVariaveis
  const ratioFixas = totDespesas > 0 ? (totFixas / totDespesas) * 100 : 50

  if (pctTotal !== null && pctTotal > 70) {
    return {
      tipo: 'alerta_sobrecarga',
      titulo: 'Sobrecarga Crítica de Despesas Operacionais',
      descricao: `As despesas operacionais totais consomem ${pctTotal.toFixed(1)}% do faturamento da empresa no período (${totFixas > totVariaveis ? 'predominância de Despesas Fixas' : 'predominância de Despesas Variáveis'}), deixando margem de contribuição comprimida.`,
      recomendacao:
        'Revisar contratos de fornecedores, auditar despesas administrativas e reavaliar tabelas de comissões e fretes para restaurar a margem operacional.',
    }
  }

  if (ratioFixas > 60) {
    return {
      tipo: 'predominancia_fixas',
      titulo: 'Estrutura com Predominância de Despesas Fixas (Risco Operacional Elevado)',
      descricao: `As despesas fixas representam ${ratioFixas.toFixed(1)}% do total de gastos operacionais e pesam ${pctFixas !== null ? `${pctFixas.toFixed(1)}%` : '—'} sobre o faturamento. Uma estrutura com alto custo fixo eleva o ponto de equilíbrio, tornando o resultado mais vulnerável a oscilações no volume de vendas.`,
      recomendacao:
        'Priorizar a flexibilização de custos fixos (terceirizações, renegociação de aluguéis e softwares) e focar em estratégias de aumento sustentável de faturamento.',
    }
  }

  if (ratioFixas < 40) {
    return {
      tipo: 'predominancia_variaveis',
      titulo: 'Estrutura Flexível com Predominância de Despesas Variáveis',
      descricao: `As despesas variáveis correspondem a ${(100 - ratioFixas).toFixed(1)}% dos gastos e pesam ${pctVariaveis !== null ? `${pctVariaveis.toFixed(1)}%` : '—'} sobre a receita. Esse arranjo confere alta resiliência financeira em momentos de retração de receita, pois os custos recuam proporcionalmente.`,
      recomendacao:
        'Controlar de perto custos que escalam com o volume (comissões, fretes de entrega e taxas de cartão) para garantir que o crescimento mantenha margem percentual saudável.',
    }
  }

  return {
    tipo: 'equilibrado',
    titulo: 'Estrutura de Gastos Equilibrada entre Fixas e Variáveis',
    descricao: `Boa distribuição entre despesas fixas (${ratioFixas.toFixed(1)}%) e variáveis (${(100 - ratioFixas).toFixed(1)}%). O peso total sobre o faturamento situa-se em ${pctTotal !== null ? `${pctTotal.toFixed(1)}%` : '—'}, mantendo o ponto de equilíbrio em patamar controlado.`,
    recomendacao:
      'Manter a disciplina orçamentária mensal com monitoramento contínuo dos centros de custo.',
  }
}

/**
 * Calcula o comparativo mensal completo Fixas × Variáveis:
 * 1. Executa o motor oficial da DRE Gerencial.
 * 2. Extrai Faturamento (Receita), Despesas Fixas e Despesas Variáveis.
 * 3. Apura valores e percentuais de cada mês + total consolidado.
 * 4. Calcula pesos relativos (% Fixas/Fat, % Variáveis/Fat, % Total/Fat, e % Fixas/Total Despesas).
 * 5. Gera diagnóstico executivo automático.
 */
export function calcularComparativoDespesas(
  lancamentos: LancamentoRecord[],
  contas: ContaRecord[],
  meses: MesItem[],
  planoContas?: PlanoContaRecord[],
): ComparativoDespesasResultado {
  const matrizDre = calcularDreGerencialMatriz(lancamentos, contas, meses, planoContas, {
    tipoRelatorio: 'dre',
  })

  // 1. Faturamento mês a mês
  const grupoReceitas = matrizDre.grupos.find((g) => g.classificacao === 'Receita')
  const faturamentoPorMes: Record<string, number> = {}
  for (const m of meses) {
    faturamentoPorMes[m.chave] = grupoReceitas?.valoresPorMes[m.chave] || 0
  }
  const faturamentoTotalPeriodo = grupoReceitas?.totalPeriodo || 0

  // 2. Grupos de Despesa Fixa e Despesa Variável
  const grupoFixas = matrizDre.grupos.find((g) => g.classificacao === 'Despesa Fixa')
  const grupoVariaveis = matrizDre.grupos.find((g) => g.classificacao === 'Despesa Variável')

  const contasFixasDre: ContaMatrizItem[] = grupoFixas ? grupoFixas.contas : []
  const contasVariaveisDre: ContaMatrizItem[] = grupoVariaveis ? grupoVariaveis.contas : []

  // 3. Mapear contas detalhadas
  const contasFixas = contasFixasDre.map((c) =>
    mapearContaLinha(c, 'fixa', meses, faturamentoPorMes, faturamentoTotalPeriodo),
  )
  const contasVariaveis = contasVariaveisDre.map((c) =>
    mapearContaLinha(c, 'variavel', meses, faturamentoPorMes, faturamentoTotalPeriodo),
  )

  // 4. Totais e Percentuais mês a mês
  const totalFixasPorMes: Record<string, number> = {}
  const totalVariaveisPorMes: Record<string, number> = {}
  const totalDespesasPorMes: Record<string, number> = {}
  const pctFixasPorMes: Record<string, number | null> = {}
  const pctVariaveisPorMes: Record<string, number | null> = {}
  const pctTotalPorMes: Record<string, number | null> = {}
  const itensMes: MesComparativoItem[] = []

  for (const m of meses) {
    const fat = faturamentoPorMes[m.chave] || 0
    const fix = grupoFixas?.valoresPorMes[m.chave] || 0
    const varMes = grupoVariaveis?.valoresPorMes[m.chave] || 0
    const despTot = fix + varMes

    totalFixasPorMes[m.chave] = fix
    totalVariaveisPorMes[m.chave] = varMes
    totalDespesasPorMes[m.chave] = despTot

    const pFix = calcularPercentualFaturamento(fix, fat)
    const pVar = calcularPercentualFaturamento(varMes, fat)
    const pTot = calcularPercentualFaturamento(despTot, fat)

    pctFixasPorMes[m.chave] = pFix
    pctVariaveisPorMes[m.chave] = pVar
    pctTotalPorMes[m.chave] = pTot

    itensMes.push({
      chave: m.chave,
      rotuloCurto: m.rotuloCurto,
      faturamento: fat,
      totalFixas: fix,
      totalVariaveis: varMes,
      totalDespesas: despTot,
      pctFixas: pFix,
      pctVariaveis: pVar,
      pctTotal: pTot,
    })
  }

  // 5. Totais Consolidados do Período
  const totalFixasPeriodo = grupoFixas?.totalPeriodo || 0
  const totalVariaveisPeriodo = grupoVariaveis?.totalPeriodo || 0
  const totalDespesasPeriodo = totalFixasPeriodo + totalVariaveisPeriodo

  const pctFixasPeriodo = calcularPercentualFaturamento(totalFixasPeriodo, faturamentoTotalPeriodo)
  const pctVariaveisPeriodo = calcularPercentualFaturamento(
    totalVariaveisPeriodo,
    faturamentoTotalPeriodo,
  )
  const pctTotalPeriodo = calcularPercentualFaturamento(
    totalDespesasPeriodo,
    faturamentoTotalPeriodo,
  )

  const pesoFixasSobreTotalDespesas =
    totalDespesasPeriodo > 0 ? (totalFixasPeriodo / totalDespesasPeriodo) * 100 : null
  const pesoVariaveisSobreTotalDespesas =
    totalDespesasPeriodo > 0 ? (totalVariaveisPeriodo / totalDespesasPeriodo) * 100 : null

  const temDados =
    contasFixas.length > 0 ||
    contasVariaveis.length > 0 ||
    totalFixasPeriodo > 0 ||
    totalVariaveisPeriodo > 0 ||
    faturamentoTotalPeriodo > 0

  const diagnostico = gerarDiagnostico(
    totalFixasPeriodo,
    totalVariaveisPeriodo,
    faturamentoTotalPeriodo,
    pctFixasPeriodo,
    pctVariaveisPeriodo,
    pctTotalPeriodo,
  )

  return {
    meses,
    itensMes,
    contasFixas,
    contasVariaveis,
    faturamentoPorMes,
    faturamentoTotalPeriodo,
    totalFixasPorMes,
    totalFixasPeriodo,
    totalVariaveisPorMes,
    totalVariaveisPeriodo,
    totalDespesasPorMes,
    totalDespesasPeriodo,
    pctFixasPorMes,
    pctFixasPeriodo,
    pctVariaveisPorMes,
    pctVariaveisPeriodo,
    pctTotalPorMes,
    pctTotalPeriodo,
    pesoFixasSobreTotalDespesas,
    pesoVariaveisSobreTotalDespesas,
    temDados,
    diagnostico,
  }
}
