import type {
  ContaRecord,
  LancamentoRecord,
  PlanoContaRecord,
  ClassificacaoDre,
} from '@/types/finance'
import { type MesItem, type ContaMatrizItem, type DreMatrizResultado } from './dreGerencialTypes'
import { calcularDreGerencialMatriz } from './dreGerencialCalculo'

export type GrupoFluxoDreChave =
  | 'entradasOperacionais'
  | 'saidasOperacionais'
  | 'geracaoOperacional'
  | 'entradasFinanceiras'
  | 'saidasFinanceiras'
  | 'geracaoFinanceira'
  | 'totalPeriodo'

export interface LinhaFluxoDreItem {
  chave: GrupoFluxoDreChave
  titulo: string
  subtitulo?: string
  tipo: 'entrada' | 'saida' | 'subtotal' | 'total'
  sinal: number // +1 para entrada, -1 para saida, 1 para subtotal/total
  valoresPorMes: Record<string, number>
  totalPeriodo: number
  contas?: ContaMatrizItem[]
}

export interface FluxoCaixaDreResultado {
  meses: MesItem[]
  // Matriz DRE base reutilizada
  dreBase: DreMatrizResultado
  // Linhas na ordem oficial
  entradasOperacionais: LinhaFluxoDreItem // Receitas
  saidasOperacionais: LinhaFluxoDreItem // Despesas Variáveis + Fixas
  geracaoOperacional: LinhaFluxoDreItem // Entradas Op - Saídas Op
  entradasFinanceiras: LinhaFluxoDreItem // Receitas Financeiras
  saidasFinanceiras: LinhaFluxoDreItem // Despesas Financeiras
  geracaoFinanceira: LinhaFluxoDreItem // Entradas Fin - Saídas Fin
  fluxoCaixaTotal: LinhaFluxoDreItem // Total do Mês (Ger. Op + Ger. Fin)
  // Linha especial de acumulado (saldo mês a mês acumulado)
  saldoAcumulado: {
    titulo: string
    valoresPorMes: Record<string, number>
    saldoFinal: number
  }
  // Detalhamento de contas operacionais separadas (para drill-down)
  contasEntradasOperacionais: ContaMatrizItem[]
  contasSaidasOperacionais: ContaMatrizItem[]
  contasEntradasFinanceiras: ContaMatrizItem[]
  contasSaidasFinanceiras: ContaMatrizItem[]
}

/**
 * Calcula o Fluxo de Caixa por grupo DRE reutilizando exatamente o cálculo matricial
 * e a resolução de lançamentos/contas de calcularDreGerencialMatriz.
 *
 * Estrutura ordenada do relatório:
 * 1. Entradas Operacionais (Receitas)
 * 2. Saídas Operacionais (–Despesas Variáveis, –Despesas Fixas)
 * 3. = Geração Operacional de Caixa
 * 4. Entradas Financeiras (+Receitas Financeiras)
 * 5. Saídas Financeiras (–Despesas Financeiras)
 * 6. = Geração Financeira de Caixa
 * 7. = Fluxo de Caixa Total do mês
 * + Saldo Acumulado (progressão mês a mês)
 */
export function calcularFluxoCaixaDre(
  lancamentos: LancamentoRecord[],
  contas: ContaRecord[],
  meses: MesItem[],
  planoContas?: PlanoContaRecord[],
): FluxoCaixaDreResultado {
  // Reutiliza o motor de cálculo da DRE parametrizado para o Fluxo de Caixa (filtra nao_exibir_fluxo_caixa e nao_exibir_em_nada)
  const matrizDre = calcularDreGerencialMatriz(lancamentos, contas, meses, planoContas, {
    tipoRelatorio: 'fluxo_caixa',
  })

  // Mapas dos grupos da DRE
  const gruposMap = new Map<ClassificacaoDre, (typeof matrizDre.grupos)[number]>()
  for (const g of matrizDre.grupos) {
    gruposMap.set(g.classificacao, g)
  }

  const grupoReceitas = gruposMap.get('Receita')
  const grupoDespVar = gruposMap.get('Despesa Variável')
  const grupoDespFix = gruposMap.get('Despesa Fixa')
  const grupoDespFin = gruposMap.get('Despesa Financeira')
  const grupoRecFin = gruposMap.get('Receita Financeira')

  // 1. Entradas Operacionais (Receitas)
  const valEntradasOp: Record<string, number> = {}
  let totalEntradasOp = 0
  for (const m of meses) {
    const v = grupoReceitas?.valoresPorMes[m.chave] || 0
    valEntradasOp[m.chave] = v
    totalEntradasOp += v
  }

  const entradasOperacionais: LinhaFluxoDreItem = {
    chave: 'entradasOperacionais',
    titulo: 'Entradas Operacionais (Receitas)',
    subtitulo: 'Receitas de vendas e prestação de serviços',
    tipo: 'entrada',
    sinal: 1,
    valoresPorMes: valEntradasOp,
    totalPeriodo: totalEntradasOp,
    contas: grupoReceitas?.contas || [],
  }

  // 2. Saídas Operacionais (Despesas Variáveis + Despesas Fixas)
  const valSaidasOp: Record<string, number> = {}
  let totalSaidasOp = 0
  for (const m of meses) {
    const vVar = grupoDespVar?.valoresPorMes[m.chave] || 0
    const vFix = grupoDespFix?.valoresPorMes[m.chave] || 0
    const vTotal = vVar + vFix
    valSaidasOp[m.chave] = vTotal
    totalSaidasOp += vTotal
  }

  // Combina as contas operacionais (Despesas Variáveis + Despesas Fixas)
  const contasSaidasOp: ContaMatrizItem[] = [
    ...(grupoDespVar?.contas || []),
    ...(grupoDespFix?.contas || []),
  ].sort((a, b) => a.nome.localeCompare(b.nome))

  const saidasOperacionais: LinhaFluxoDreItem = {
    chave: 'saidasOperacionais',
    titulo: '(–) Saídas Operacionais (Desp. Variáveis e Fixas)',
    subtitulo: 'Custos variáveis diretos e custos operacionais fixos',
    tipo: 'saida',
    sinal: -1,
    valoresPorMes: valSaidasOp,
    totalPeriodo: totalSaidasOp,
    contas: contasSaidasOp,
  }

  // 3. Geração Operacional de Caixa = Entradas Operacionais - Saídas Operacionais
  const valGeracaoOp: Record<string, number> = {}
  let totalGeracaoOp = 0
  for (const m of meses) {
    const gen = (valEntradasOp[m.chave] || 0) - (valSaidasOp[m.chave] || 0)
    valGeracaoOp[m.chave] = gen
    totalGeracaoOp += gen
  }

  const geracaoOperacional: LinhaFluxoDreItem = {
    chave: 'geracaoOperacional',
    titulo: '= Geração Operacional de Caixa',
    subtitulo: 'Resultado da atividade fim da empresa antes de efeitos financeiros',
    tipo: 'subtotal',
    sinal: 1,
    valoresPorMes: valGeracaoOp,
    totalPeriodo: totalGeracaoOp,
  }

  // 4. Entradas Financeiras (+Receitas Financeiras)
  const valEntradasFin: Record<string, number> = {}
  let totalEntradasFin = 0
  for (const m of meses) {
    const v = grupoRecFin?.valoresPorMes[m.chave] || 0
    valEntradasFin[m.chave] = v
    totalEntradasFin += v
  }

  const entradasFinanceiras: LinhaFluxoDreItem = {
    chave: 'entradasFinanceiras',
    titulo: '(+) Entradas Financeiras (Receitas Financeiras)',
    subtitulo: 'Rendimentos de aplicações, descontos obtidos e juros ativos',
    tipo: 'entrada',
    sinal: 1,
    valoresPorMes: valEntradasFin,
    totalPeriodo: totalEntradasFin,
    contas: grupoRecFin?.contas || [],
  }

  // 5. Saídas Financeiras (–Despesas Financeiras)
  const valSaidasFin: Record<string, number> = {}
  let totalSaidasFin = 0
  for (const m of meses) {
    const v = grupoDespFin?.valoresPorMes[m.chave] || 0
    valSaidasFin[m.chave] = v
    totalSaidasFin += v
  }

  const saidasFinanceiras: LinhaFluxoDreItem = {
    chave: 'saidasFinanceiras',
    titulo: '(–) Saídas Financeiras (Despesas Financeiras)',
    subtitulo: 'Juros passivos, taxas bancárias e despesas financeiras',
    tipo: 'saida',
    sinal: -1,
    valoresPorMes: valSaidasFin,
    totalPeriodo: totalSaidasFin,
    contas: grupoDespFin?.contas || [],
  }

  // 6. Geração Financeira de Caixa = Entradas Financeiras - Saídas Financeiras
  const valGeracaoFin: Record<string, number> = {}
  let totalGeracaoFin = 0
  for (const m of meses) {
    const gen = (valEntradasFin[m.chave] || 0) - (valSaidasFin[m.chave] || 0)
    valGeracaoFin[m.chave] = gen
    totalGeracaoFin += gen
  }

  const geracaoFinanceira: LinhaFluxoDreItem = {
    chave: 'geracaoFinanceira',
    titulo: '= Geração Financeira de Caixa',
    subtitulo: 'Saldo líquido da atividade financeira no período',
    tipo: 'subtotal',
    sinal: 1,
    valoresPorMes: valGeracaoFin,
    totalPeriodo: totalGeracaoFin,
  }

  // 7. Fluxo de Caixa Total do mês = Geração Operacional + Geração Financeira
  const valTotalMes: Record<string, number> = {}
  let totalPeriodoGeral = 0
  for (const m of meses) {
    const totalMes = (valGeracaoOp[m.chave] || 0) + (valGeracaoFin[m.chave] || 0)
    valTotalMes[m.chave] = totalMes
    totalPeriodoGeral += totalMes
  }

  const fluxoCaixaTotal: LinhaFluxoDreItem = {
    chave: 'totalPeriodo',
    titulo: '= Fluxo de Caixa Total do Mês',
    subtitulo: 'Geração Operacional + Geração Financeira',
    tipo: 'total',
    sinal: 1,
    valoresPorMes: valTotalMes,
    totalPeriodo: totalPeriodoGeral,
  }

  // Saldo Acumulado mês a mês
  const valAcumulado: Record<string, number> = {}
  let acumulador = 0
  for (const m of meses) {
    acumulador += valTotalMes[m.chave] || 0
    valAcumulado[m.chave] = acumulador
  }

  const saldoAcumulado = {
    titulo: 'Saldo Acumulado de Caixa (Evolução)',
    valoresPorMes: valAcumulado,
    saldoFinal: acumulador,
  }

  return {
    meses,
    dreBase: matrizDre,
    entradasOperacionais,
    saidasOperacionais,
    geracaoOperacional,
    entradasFinanceiras,
    saidasFinanceiras,
    geracaoFinanceira,
    fluxoCaixaTotal,
    saldoAcumulado,
    contasEntradasOperacionais: grupoReceitas?.contas || [],
    contasSaidasOperacionais: contasSaidasOp,
    contasEntradasFinanceiras: grupoRecFin?.contas || [],
    contasSaidasFinanceiras: grupoDespFin?.contas || [],
  }
}
