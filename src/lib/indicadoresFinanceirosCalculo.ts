/**
 * Motor de Cálculo dos Indicadores Financeiros Clássicos
 *
 * Consolida dados de Balanço Patrimonial (coleção balancos) e DRE / Lançamentos rápidos (dreGerencialCalculo)
 * para apurar indicadores chave da análise financeira:
 *
 * 1. Liquidez:
 *    - Liquidez Corrente (LC) = AC / PC
 *    - Liquidez Seca (LS) = (AC - Estoques) / PC
 *    - Liquidez Geral (LG) = (AC + RLP) / (PC + PNC)
 *
 * 2. Endividamento / Estrutura de Capital:
 *    - Endividamento / Alavancagem (Dívida / PL) = (PC + PNC) / PL
 *    - Grau de Endividamento Geral = (PC + PNC) / AT * 100
 *
 * 3. Rentabilidade / Margens:
 *    - ROE = (Lucro Líquido / PL) * 100
 *    - ROI / ROA = (Lucro Líquido / AT) * 100
 *    - Margem Bruta = ((Receita - Custos/Despesas Variáveis) / Receita) * 100
 *    - Margem Operacional = (Lucro Operacional / Receita) * 100
 *    - Margem Líquida = (Lucro Líquido / Receita) * 100
 *
 * 4. Prazos Médios (Eficiência):
 *    - Prazo Médio de Recebimento (PMR) = (Contas a Receber / Receita Bruta/Líquida) * 360
 *    - Prazo Médio de Pagamento (PMP) = (Fornecedores / Compras ou Despesas) * 360
 */

import type {
  BalancoRecord,
  ContaRecord,
  LancamentoRecord,
  PlanoContaRecord,
} from '@/types/finance'
import { calcularBalanco } from './financeCalculations'
import { calcularDreGerencialMatriz } from './dreGerencialCalculo'
import type { MesItem } from './dreGerencialTypes'

export type StatusIndicador = 'Excelente' | 'Adequada' | 'Atenção' | 'Crítica' | 'Indefinido'

export interface ItemIndicadorFinanceiro {
  id: string
  nome: string
  sigla: string
  categoria: 'Liquidez' | 'Endividamento' | 'Rentabilidade' | 'Eficiência'
  formula: string
  valor: number | null
  unidade: 'multiplo' | 'percentual' | 'dias'
  status: StatusIndicador
  badgeVariant: 'emerald' | 'blue' | 'amber' | 'rose' | 'slate'
  explicacao: string
  temDadosBalanco: boolean
  detalhesCalculo: {
    numerador: { label: string; valor: number }
    denominador: { label: string; valor: number }
  }
}

export interface PainelIndicadoresResultado {
  temBalancoNoPeriodo: boolean
  ano: number
  indicadores: ItemIndicadorFinanceiro[]
  resumoCategorias: {
    categoria: string
    quantidade: number
    excelentes: number
    adequadas: number
    atencao: number
    criticas: number
  }[]
  totaisDRE: {
    receitaTotal: number
    despesasVariaveisTotal: number
    despesasFixasTotal: number
    despesasFinanceirasTotal: number
    lucroLiquidoTotal: number
  }
  totaisBalanco: {
    ativoCirculante: number
    realizavelLongoPrazo: number
    ativoTotal: number
    passivoCirculante: number
    passivoNaoCirculante: number
    patrimonioLiquido: number
    estoques: number
    contasReceber: number
    fornecedores: number
  }
}

/**
 * Classifica o indicador conforme faixas padrão consagradas de análise econômico-financeira
 */
export function classificarStatusIndicador(
  id: string,
  valor: number | null,
): { status: StatusIndicador; badgeVariant: 'emerald' | 'blue' | 'amber' | 'rose' | 'slate' } {
  if (valor === null || !Number.isFinite(valor)) {
    return { status: 'Indefinido', badgeVariant: 'slate' }
  }

  switch (id) {
    case 'liquidez_corrente':
    case 'liquidez_seca':
    case 'liquidez_geral':
      if (valor >= 1.5) return { status: 'Excelente', badgeVariant: 'emerald' }
      if (valor >= 1.0) return { status: 'Adequada', badgeVariant: 'blue' }
      if (valor >= 0.8) return { status: 'Atenção', badgeVariant: 'amber' }
      return { status: 'Crítica', badgeVariant: 'rose' }

    case 'alavancagem_divida_pl':
      // Dívida / PL: quanto menor, mais capital próprio e menor alavancagem de risco
      if (valor <= 0.8) return { status: 'Excelente', badgeVariant: 'emerald' }
      if (valor <= 1.5) return { status: 'Adequada', badgeVariant: 'blue' }
      if (valor <= 2.5) return { status: 'Atenção', badgeVariant: 'amber' }
      return { status: 'Crítica', badgeVariant: 'rose' }

    case 'endividamento_geral':
      // Passivo Total / Ativo Total em %
      if (valor <= 40) return { status: 'Excelente', badgeVariant: 'emerald' }
      if (valor <= 60) return { status: 'Adequada', badgeVariant: 'blue' }
      if (valor <= 75) return { status: 'Atenção', badgeVariant: 'amber' }
      return { status: 'Crítica', badgeVariant: 'rose' }

    case 'roe':
      // ROE anualizado ou do período em %
      if (valor >= 20) return { status: 'Excelente', badgeVariant: 'emerald' }
      if (valor >= 10) return { status: 'Adequada', badgeVariant: 'blue' }
      if (valor >= 0) return { status: 'Atenção', badgeVariant: 'amber' }
      return { status: 'Crítica', badgeVariant: 'rose' }

    case 'roi_roa':
      // Retorno sobre o Ativo em %
      if (valor >= 12) return { status: 'Excelente', badgeVariant: 'emerald' }
      if (valor >= 6) return { status: 'Adequada', badgeVariant: 'blue' }
      if (valor >= 0) return { status: 'Atenção', badgeVariant: 'amber' }
      return { status: 'Crítica', badgeVariant: 'rose' }

    case 'margem_bruta':
      if (valor >= 50) return { status: 'Excelente', badgeVariant: 'emerald' }
      if (valor >= 30) return { status: 'Adequada', badgeVariant: 'blue' }
      if (valor >= 15) return { status: 'Atenção', badgeVariant: 'amber' }
      return { status: 'Crítica', badgeVariant: 'rose' }

    case 'margem_operacional':
      if (valor >= 18) return { status: 'Excelente', badgeVariant: 'emerald' }
      if (valor >= 10) return { status: 'Adequada', badgeVariant: 'blue' }
      if (valor >= 3) return { status: 'Atenção', badgeVariant: 'amber' }
      return { status: 'Crítica', badgeVariant: 'rose' }

    case 'margem_liquida':
      if (valor >= 15) return { status: 'Excelente', badgeVariant: 'emerald' }
      if (valor >= 7) return { status: 'Adequada', badgeVariant: 'blue' }
      if (valor >= 0) return { status: 'Atenção', badgeVariant: 'amber' }
      return { status: 'Crítica', badgeVariant: 'rose' }

    case 'pmr':
      // Prazo Médio de Recebimento (dias): menor prazo = liquidez mais rápida
      if (valor <= 30) return { status: 'Excelente', badgeVariant: 'emerald' }
      if (valor <= 60) return { status: 'Adequada', badgeVariant: 'blue' }
      if (valor <= 90) return { status: 'Atenção', badgeVariant: 'amber' }
      return { status: 'Crítica', badgeVariant: 'rose' }

    case 'pmp':
      // Prazo Médio de Pagamento (dias): prazo maior que PMR financia o giro
      if (valor >= 60) return { status: 'Excelente', badgeVariant: 'emerald' }
      if (valor >= 30) return { status: 'Adequada', badgeVariant: 'blue' }
      if (valor >= 15) return { status: 'Atenção', badgeVariant: 'amber' }
      return { status: 'Crítica', badgeVariant: 'rose' }

    default:
      return { status: 'Adequada', badgeVariant: 'blue' }
  }
}

/**
 * Motor central de cálculo dos indicadores financeiros com integração de Balanço e DRE
 */
export function calcularPainelIndicadoresFinanceiros(params: {
  balanco?: BalancoRecord | null
  lancamentos: LancamentoRecord[]
  contas: ContaRecord[]
  meses: MesItem[]
  planoContas?: PlanoContaRecord[]
  ano: number
}): PainelIndicadoresResultado {
  const { balanco, lancamentos, contas, meses, planoContas, ano } = params

  // 1. DRE Gerencial Matriz do período
  const matrizDre = calcularDreGerencialMatriz(lancamentos, contas, meses, planoContas)

  let receitaTotal = 0
  let despesasVariaveisTotal = 0
  let despesasFixasTotal = 0
  let despesasFinanceirasTotal = 0
  let receitasFinanceirasTotal = 0

  for (const grupo of matrizDre.grupos) {
    if (grupo.classificacao === 'Receita') {
      receitaTotal = grupo.totalPeriodo
    } else if (grupo.classificacao === 'Despesa Variável') {
      despesasVariaveisTotal = grupo.totalPeriodo
    } else if (grupo.classificacao === 'Despesa Fixa') {
      despesasFixasTotal = grupo.totalPeriodo
    } else if (grupo.classificacao === 'Despesa Financeira') {
      despesasFinanceirasTotal = grupo.totalPeriodo
    } else if (grupo.classificacao === 'Receita Financeira') {
      receitasFinanceirasTotal = grupo.totalPeriodo
    }
  }

  const lucroBruto = receitaTotal - despesasVariaveisTotal
  const lucroOperacional = lucroBruto - despesasFixasTotal
  const lucroLiquidoTotal = matrizDre.lucroPrejuizo.totalPeriodo

  // 2. Balanço Patrimonial (se houver)
  const temBalancoNoPeriodo = Boolean(
    balanco &&
    (balanco.ativo_total ||
      balanco.patrimonio_liquido ||
      balanco.passivo_circulante ||
      balanco.ativo_circulante),
  )

  const bCalc = calcularBalanco(balanco || undefined)

  const ac = bCalc.ativoCirculante
  const rlp = balanco?.realizavel_longo_prazo || 0
  const at = bCalc.ativoTotal
  const pc = bCalc.passivoCirculante
  const pnc = bCalc.passivoNaoCirculante
  const pl = bCalc.patrimonioLiquido
  const passivoExigivelTotal = pc + pnc
  const estoques = balanco?.estoques || 0
  const contasReceber =
    (balanco as any)?.clientes ||
    (balanco as any)?.contas_receber ||
    (balanco as any)?.duplicatas_receber ||
    0
  const fornecedores = (balanco as any)?.fornecedores || 0

  // 3. Apuração dos Indicadores
  const indicadores: ItemIndicadorFinanceiro[] = []

  // --- LIQUIDEZ CORRENTE ---
  const lcValor = temBalancoNoPeriodo && pc > 0 ? ac / pc : null
  const lcClas = classificarStatusIndicador('liquidez_corrente', lcValor)
  indicadores.push({
    id: 'liquidez_corrente',
    nome: 'Liquidez Corrente',
    sigla: 'LC',
    categoria: 'Liquidez',
    formula: 'Ativo Circulante ÷ Passivo Circulante',
    valor: lcValor,
    unidade: 'multiplo',
    status: lcClas.status,
    badgeVariant: lcClas.badgeVariant,
    explicacao:
      'Capacidade da empresa de quitar suas obrigações de curto prazo com os recursos realizáveis no mesmo exercício.',
    temDadosBalanco: temBalancoNoPeriodo && pc > 0,
    detalhesCalculo: {
      numerador: { label: 'Ativo Circulante', valor: ac },
      denominador: { label: 'Passivo Circulante', valor: pc },
    },
  })

  // --- LIQUIDEZ SECA ---
  const lsValor = temBalancoNoPeriodo && pc > 0 ? (ac - estoques) / pc : null
  const lsClas = classificarStatusIndicador('liquidez_seca', lsValor)
  indicadores.push({
    id: 'liquidez_seca',
    nome: 'Liquidez Seca',
    sigla: 'LS',
    categoria: 'Liquidez',
    formula: '(Ativo Circulante − Estoques) ÷ Passivo Circulante',
    valor: lsValor,
    unidade: 'multiplo',
    status: lsClas.status,
    badgeVariant: lsClas.badgeVariant,
    explicacao:
      'Mede a solvência imediata desconsiderando a necessidade de vender mercadorias ou insumos em estoque.',
    temDadosBalanco: temBalancoNoPeriodo && pc > 0,
    detalhesCalculo: {
      numerador: { label: 'AC − Estoques', valor: ac - estoques },
      denominador: { label: 'Passivo Circulante', valor: pc },
    },
  })

  // --- LIQUIDEZ GERAL ---
  const lgValor =
    temBalancoNoPeriodo && passivoExigivelTotal > 0 ? (ac + rlp) / passivoExigivelTotal : null
  const lgClas = classificarStatusIndicador('liquidez_geral', lgValor)
  indicadores.push({
    id: 'liquidez_geral',
    nome: 'Liquidez Geral',
    sigla: 'LG',
    categoria: 'Liquidez',
    formula: '(Ativo Circulante + Realizável LP) ÷ (Passivo Circulante + Não Circulante)',
    valor: lgValor,
    unidade: 'multiplo',
    status: lgClas.status,
    badgeVariant: lgClas.badgeVariant,
    explicacao:
      'Indica a solidez financeira e solvência global no longo prazo contra todas as dívidas com terceiros.',
    temDadosBalanco: temBalancoNoPeriodo && passivoExigivelTotal > 0,
    detalhesCalculo: {
      numerador: { label: 'AC + Realizável LP', valor: ac + rlp },
      denominador: { label: 'Exigível Total (PC + PNC)', valor: passivoExigivelTotal },
    },
  })

  // --- ALAVANCAGEM / ENDIVIDAMENTO (DÍVIDA / PL) ---
  const alavValor = temBalancoNoPeriodo && pl > 0 ? passivoExigivelTotal / pl : null
  const alavClas = classificarStatusIndicador('alavancagem_divida_pl', alavValor)
  indicadores.push({
    id: 'alavancagem_divida_pl',
    nome: 'Alavancagem (Dívida / PL)',
    sigla: 'D/PL',
    categoria: 'Endividamento',
    formula: 'Exigível Total (PC + PNC) ÷ Patrimônio Líquido',
    valor: alavValor,
    unidade: 'multiplo',
    status: alavClas.status,
    badgeVariant: alavClas.badgeVariant,
    explicacao:
      'Relação entre os recursos captados de terceiros e o patrimônio próprio investido pelos sócios.',
    temDadosBalanco: temBalancoNoPeriodo && pl > 0,
    detalhesCalculo: {
      numerador: { label: 'Exigível Total', valor: passivoExigivelTotal },
      denominador: { label: 'Patrimônio Líquido', valor: pl },
    },
  })

  // --- ENDIVIDAMENTO GERAL ---
  const endGeralValor = temBalancoNoPeriodo && at > 0 ? (passivoExigivelTotal / at) * 100 : null
  const endGeralClas = classificarStatusIndicador('endividamento_geral', endGeralValor)
  indicadores.push({
    id: 'endividamento_geral',
    nome: 'Endividamento Geral',
    sigla: 'EG',
    categoria: 'Endividamento',
    formula: '(Exigível Total ÷ Ativo Total) × 100',
    valor: endGeralValor,
    unidade: 'percentual',
    status: endGeralClas.status,
    badgeVariant: endGeralClas.badgeVariant,
    explicacao:
      'Percentual do ativo total financiado por recursos de terceiros (curto e longo prazos).',
    temDadosBalanco: temBalancoNoPeriodo && at > 0,
    detalhesCalculo: {
      numerador: { label: 'Exigível Total', valor: passivoExigivelTotal },
      denominador: { label: 'Ativo Total', valor: at },
    },
  })

  // --- ROE (RETORNO SOBRE O PATRIMÔNIO LÍQUIDO) ---
  const roeValor = temBalancoNoPeriodo && pl > 0 ? (lucroLiquidoTotal / pl) * 100 : null
  const roeClas = classificarStatusIndicador('roe', roeValor)
  indicadores.push({
    id: 'roe',
    nome: 'Retorno sobre o PL (ROE)',
    sigla: 'ROE',
    categoria: 'Rentabilidade',
    formula: '(Lucro Líquido do Período ÷ Patrimônio Líquido) × 100',
    valor: roeValor,
    unidade: 'percentual',
    status: roeClas.status,
    badgeVariant: roeClas.badgeVariant,
    explicacao:
      'Mede a taxa de retorno gerada pelo negócio sobre o capital próprio acumulado pelos acionistas.',
    temDadosBalanco: temBalancoNoPeriodo && pl > 0,
    detalhesCalculo: {
      numerador: { label: 'Lucro Líquido DRE', valor: lucroLiquidoTotal },
      denominador: { label: 'Patrimônio Líquido', valor: pl },
    },
  })

  // --- ROI / ROA (RETORNO SOBRE O ATIVO) ---
  const roiValor = temBalancoNoPeriodo && at > 0 ? (lucroLiquidoTotal / at) * 100 : null
  const roiClas = classificarStatusIndicador('roi_roa', roiValor)
  indicadores.push({
    id: 'roi_roa',
    nome: 'Retorno sobre o Ativo (ROA/ROI)',
    sigla: 'ROA',
    categoria: 'Rentabilidade',
    formula: '(Lucro Líquido do Período ÷ Ativo Total) × 100',
    valor: roiValor,
    unidade: 'percentual',
    status: roiClas.status,
    badgeVariant: roiClas.badgeVariant,
    explicacao: 'Eficiência global dos ativos da empresa em produzir resultado econômico positivo.',
    temDadosBalanco: temBalancoNoPeriodo && at > 0,
    detalhesCalculo: {
      numerador: { label: 'Lucro Líquido DRE', valor: lucroLiquidoTotal },
      denominador: { label: 'Ativo Total', valor: at },
    },
  })

  // --- MARGEM BRUTA ---
  const mbValor = receitaTotal > 0 ? (lucroBruto / receitaTotal) * 100 : null
  const mbClas = classificarStatusIndicador('margem_bruta', mbValor)
  indicadores.push({
    id: 'margem_bruta',
    nome: 'Margem Bruta',
    sigla: 'MB',
    categoria: 'Rentabilidade',
    formula: '((Receita − Despesas Variáveis) ÷ Receita) × 100',
    valor: mbValor,
    unidade: 'percentual',
    status: mbClas.status,
    badgeVariant: mbClas.badgeVariant,
    explicacao:
      'Percentual de sobra após dedução dos custos e despesas comerciais diretas da operação.',
    temDadosBalanco: true, // calculado a partir do DRE
    detalhesCalculo: {
      numerador: { label: 'Lucro Bruto', valor: lucroBruto },
      denominador: { label: 'Receita DRE', valor: receitaTotal },
    },
  })

  // --- MARGEM OPERACIONAL ---
  const moValor = receitaTotal > 0 ? (lucroOperacional / receitaTotal) * 100 : null
  const moClas = classificarStatusIndicador('margem_operacional', moValor)
  indicadores.push({
    id: 'margem_operacional',
    nome: 'Margem Operacional',
    sigla: 'MO',
    categoria: 'Rentabilidade',
    formula: '(Lucro Operacional ÷ Receita) × 100',
    valor: moValor,
    unidade: 'percentual',
    status: moClas.status,
    badgeVariant: moClas.badgeVariant,
    explicacao:
      'Lucratividade da atividade principal após suportar todas as despesas fixas e operacionais.',
    temDadosBalanco: true, // calculado a partir do DRE
    detalhesCalculo: {
      numerador: { label: 'Lucro Operacional', valor: lucroOperacional },
      denominador: { label: 'Receita DRE', valor: receitaTotal },
    },
  })

  // --- MARGEM LÍQUIDA ---
  const mlValor = receitaTotal > 0 ? (lucroLiquidoTotal / receitaTotal) * 100 : null
  const mlClas = classificarStatusIndicador('margem_liquida', mlValor)
  indicadores.push({
    id: 'margem_liquida',
    nome: 'Margem Líquida',
    sigla: 'ML',
    categoria: 'Rentabilidade',
    formula: '(Lucro Líquido Final ÷ Receita) × 100',
    valor: mlValor,
    unidade: 'percentual',
    status: mlClas.status,
    badgeVariant: mlClas.badgeVariant,
    explicacao:
      'Parcela de cada R$ 100 vendidos que se converte efetivamente em lucro líquido final da empresa.',
    temDadosBalanco: true, // calculado a partir do DRE
    detalhesCalculo: {
      numerador: { label: 'Lucro Líquido', valor: lucroLiquidoTotal },
      denominador: { label: 'Receita DRE', valor: receitaTotal },
    },
  })

  // --- PRAZO MÉDIO DE RECEBIMENTO (PMR) ---
  const temReceber = temBalancoNoPeriodo && contasReceber > 0 && receitaTotal > 0
  const pmrValor = temReceber ? (contasReceber / receitaTotal) * 360 : null
  const pmrClas = classificarStatusIndicador('pmr', pmrValor)
  indicadores.push({
    id: 'pmr',
    nome: 'Prazo Médio de Recebimento',
    sigla: 'PMR',
    categoria: 'Eficiência',
    formula: '(Contas a Receber ÷ Receita Total) × 360',
    valor: pmrValor,
    unidade: 'dias',
    status: pmrClas.status,
    badgeVariant: pmrClas.badgeVariant,
    explicacao:
      'Tempo médio em dias que a empresa leva entre a venda e o recebimento efetivo dos clientes.',
    temDadosBalanco: temReceber,
    detalhesCalculo: {
      numerador: { label: 'Contas a Receber', valor: contasReceber },
      denominador: { label: 'Receita Total', valor: receitaTotal },
    },
  })

  // --- PRAZO MÉDIO DE PAGAMENTO (PMP) ---
  const baseCompras = despesasVariaveisTotal + despesasFixasTotal
  const temFornecedores = temBalancoNoPeriodo && fornecedores > 0 && baseCompras > 0
  const pmpValor = temFornecedores ? (fornecedores / baseCompras) * 360 : null
  const pmpClas = classificarStatusIndicador('pmp', pmpValor)
  indicadores.push({
    id: 'pmp',
    nome: 'Prazo Médio de Pagamento',
    sigla: 'PMP',
    categoria: 'Eficiência',
    formula: '(Fornecedores ÷ Despesas Operacionais) × 360',
    valor: pmpValor,
    unidade: 'dias',
    status: pmpClas.status,
    badgeVariant: pmpClas.badgeVariant,
    explicacao:
      'Tempo médio em dias concedido pelos fornecedores e parceiros para liquidação das faturas.',
    temDadosBalanco: temFornecedores,
    detalhesCalculo: {
      numerador: { label: 'Fornecedores a Pagar', valor: fornecedores },
      denominador: { label: 'Despesas Operacionais', valor: baseCompras },
    },
  })

  // Categorias resumo
  const categoriasMap = new Map<
    string,
    { total: number; ex: number; ad: number; at: number; cr: number }
  >()
  for (const ind of indicadores) {
    let cat = categoriasMap.get(ind.categoria)
    if (!cat) {
      cat = { total: 0, ex: 0, ad: 0, at: 0, cr: 0 }
      categoriasMap.set(ind.categoria, cat)
    }
    cat.total++
    if (ind.status === 'Excelente') cat.ex++
    else if (ind.status === 'Adequada') cat.ad++
    else if (ind.status === 'Atenção') cat.at++
    else if (ind.status === 'Crítica') cat.cr++
  }

  const resumoCategorias = Array.from(categoriasMap.entries()).map(([categoria, dados]) => ({
    categoria,
    quantidade: dados.total,
    excelentes: dados.ex,
    adequadas: dados.ad,
    atencao: dados.at,
    criticas: dados.cr,
  }))

  return {
    temBalancoNoPeriodo,
    ano,
    indicadores,
    resumoCategorias,
    totaisDRE: {
      receitaTotal,
      despesasVariaveisTotal,
      despesasFixasTotal,
      despesasFinanceirasTotal,
      lucroLiquidoTotal,
    },
    totaisBalanco: {
      ativoCirculante: ac,
      realizavelLongoPrazo: rlp,
      ativoTotal: at,
      passivoCirculante: pc,
      passivoNaoCirculante: pnc,
      patrimonioLiquido: pl,
      estoques,
      contasReceber,
      fornecedores,
    },
  }
}
