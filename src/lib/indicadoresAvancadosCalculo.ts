/**
 * Indicadores Econômicos Avançados — EVA, DuPont, Ciclo de Conversão de Caixa e Cobertura de Juros.
 * Reutiliza os motores oficiais de Balanço e DRE (financeCalculations) e a paridade EBITDA do sistema.
 */

import type { BalancoRecord, DreRecord } from '@/types/finance'
import { calcularBalanco, calcularDre } from './financeCalculations'

export interface EvaResultado {
  temDados: boolean
  nopat: number
  custoCapital: number
  capitalInvestido: number
  eva: number
  margemEva: number | null // EVA / Receita Líquida * 100
}

export interface DuPontResultado {
  temDados: boolean
  margemLiquida: number | null // %
  giroAtivo: number | null // x
  alavancagemFinanceira: number | null // x (Ativo/PL)
  roe: number | null // %
  roa: number | null // %
}

export interface CicloCaixaResultado {
  temDados: boolean
  pme: number | null // Prazo Médio de Estocagem (dias)
  pmr: number | null // Prazo Médio de Recebimento (dias)
  pmp: number | null // Prazo Médio de Pagamento (dias)
  cicloOperacional: number | null
  cicloConversaoCaixa: number | null
}

export interface CoberturaJurosResultado {
  temDados: boolean
  ebit: number
  despesasFinanceiras: number
  cobertura: number | null // x
  classificacao: 'confortavel' | 'adequada' | 'apertada' | 'critica' | 'sem_dados'
}

export interface IndicadoresAvancadosResumo {
  temDados: boolean
  ativoTotal: number
  passivoTotal: number
  patrimonioLiquido: number
  receitaLiquida: number
  lucroLiquido: number
  ebitAproximado: number
}

export interface IndicadoresAvancadosResultado {
  eva: EvaResultado
  dupont: DuPontResultado
  ciclo: CicloCaixaResultado
  cobertura: CoberturaJurosResultado
  resumo: IndicadoresAvancadosResumo
}

export const ROTULO_CLASSIFICACAO_COBERTURA: Record<
  CoberturaJurosResultado['classificacao'],
  string
> = {
  confortavel: 'Confortável',
  adequada: 'Adequada',
  apertada: 'Apertada',
  critica: 'Crítica',
  sem_dados: 'Sem dados',
}

export function classificarCobertura(c: number | null): CoberturaJurosResultado['classificacao'] {
  if (c === null) return 'sem_dados'
  if (c >= 5) return 'confortavel'
  if (c >= 3) return 'adequada'
  if (c >= 1.5) return 'apertada'
  return 'critica'
}

export function calcularIndicadoresAvancados(
  balanco: Partial<BalancoRecord> | null,
  dre: Partial<DreRecord> | null,
  custoCapitalPct: number, // custo de capital (WACC/KE) em % ao ano
): IndicadoresAvancadosResultado {
  const calcB = calcularBalanco(balanco)
  const calcD = calcularDre(dre)

  const ativoTotal = calcB.ativoTotal
  const patrimonioLiquido = calcB.patrimonioLiquido
  const passivoTotal = calcB.passivoTotal
  const receitaLiquida = calcD.receitaLiquida
  const lucroLiquido = calcD.lucroLiquido
  // Paridade EBITDA oficial: EBITDA = Lucro Líquido + IR + Despesas Financeiras (mesma fórmula do Dashboard BI/DRE)
  const ebitAproximado = calcD.ebitda
  const despesasFinanceiras = dre?.despesas_financeiras || 0

  const seguro = (num: number, den: number): number | null => (den > 0 ? num / den : null)

  // ===================== EVA =====================
  const nopat = ebitAproximado * (1 - 0.34)
  const capitalInvestido = patrimonioLiquido + calcB.emprestimosLongoPrazo
  const custoCapital = capitalInvestido * (custoCapitalPct / 100)
  const eva = nopat - custoCapital
  const evaResultado: EvaResultado = {
    temDados: ativoTotal > 0 || receitaLiquida > 0,
    nopat,
    custoCapital,
    capitalInvestido,
    eva,
    margemEva: receitaLiquida > 0 ? (eva / receitaLiquida) * 100 : null,
  }

  // ===================== DuPont =====================
  const margemLiquida = seguro(lucroLiquido, receitaLiquida)
  const giroAtivo = seguro(receitaLiquida, ativoTotal)
  const alavancagemFinanceira = seguro(ativoTotal, patrimonioLiquido)
  const roe = seguro(lucroLiquido, patrimonioLiquido)
  const roa = seguro(lucroLiquido, ativoTotal)

  const dupont: DuPontResultado = {
    temDados: ativoTotal > 0 && receitaLiquida > 0,
    margemLiquida: margemLiquida !== null ? margemLiquida * 100 : null,
    giroAtivo,
    alavancagemFinanceira,
    roe: roe !== null ? roe * 100 : null,
    roa: roa !== null ? roa * 100 : null,
  }

  // ===================== Ciclo de Conversão de Caixa =====================
  const contasReceber = balanco?.contas_receber || 0
  const estoques = balanco?.estoques || 0
  const fornecedores = balanco?.fornecedores || 0

  const receitaBruta = dre?.receita_bruta || 0
  const baseVendas = receitaBruta > 0 ? receitaBruta : receitaLiquida
  const cmv = dre?.custo_mercadorias || 0

  const pme = cmv > 0 ? (estoques / cmv) * 360 : null
  const pmr = baseVendas > 0 ? (contasReceber / baseVendas) * 360 : null
  const pmp = cmv > 0 ? (fornecedores / cmv) * 360 : null
  const cicloOperacional = pme !== null && pmr !== null ? pme + pmr : null
  const cicloConversaoCaixa =
    cicloOperacional !== null && pmp !== null ? cicloOperacional - pmp : null

  const ciclo: CicloCaixaResultado = {
    temDados: contasReceber > 0 || estoques > 0 || fornecedores > 0,
    pme,
    pmr,
    pmp,
    cicloOperacional,
    cicloConversaoCaixa,
  }

  // ===================== Cobertura de Juros =====================
  const cobertura = despesasFinanceiras > 0 ? ebitAproximado / despesasFinanceiras : null

  const coberturaResultado: CoberturaJurosResultado = {
    temDados: ebitAproximado !== 0 || despesasFinanceiras > 0,
    ebit: ebitAproximado,
    despesasFinanceiras,
    cobertura,
    classificacao: classificarCobertura(cobertura),
  }

  return {
    eva: evaResultado,
    dupont,
    ciclo,
    cobertura: coberturaResultado,
    resumo: {
      temDados: ativoTotal > 0 || receitaLiquida > 0,
      ativoTotal,
      passivoTotal,
      patrimonioLiquido,
      receitaLiquida,
      lucroLiquido,
      ebitAproximado,
    },
  }
}
