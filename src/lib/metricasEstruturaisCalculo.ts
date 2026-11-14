/**
 * Métricas Estruturais — liquidezes (seca, imediata, geral), ROA, Giro do Ativo,
 * prazos médios (PMR/PMP) e Capital de Giro (CGL, NCG, Saldo de Tesouraria).
 * Reaproveita os motores oficiais de Balanço/DRE (financeCalculations) — mesmos
 * tipos reais usados pela seção de Métricas Avançadas da tela total de Indicadores.
 * Toda função devolve null quando falta dado (nunca zero enganoso).
 */

import type { BalancoRecord, DreRecord } from '@/types/finance'
import { calcularBalanco, calcularDre } from './financeCalculations'

export interface MetricasEstruturaisResultado {
  temDados: boolean
  ativoTotal: number
  ativoCirculante: number
  passivoCirculante: number
  passivoNaoCirculante: number
  realizavelLongoPrazo: number
  disponivel: number
  estoques: number
  receitaLiquida: number
  lucroLiquido: number
  /** ROA = Lucro Líquido / Ativo Total (%) */
  roa: number | null
  /** Giro do Ativo = Receita Líquida / Ativo Total (x) */
  giroAtivo: number | null
  /** Liquidez Seca = (AC − Estoques) / PC */
  liquidezSeca: number | null
  /** Liquidez Imediata = Disponível / PC */
  liquidezImediata: number | null
  /** Liquidez Geral = (AC + Realizável LP) / (PC + Exigível LP) */
  liquidezGeral: number | null
  /** Contas a Receber do balanço (R$) */
  contasReceber: number
  /** Fornecedores do balanço (R$) */
  fornecedores: number
  /** CMV da DRE (R$) */
  cmv: number
  /** Prazo Médio de Recebimento (dias) */
  pmr: number | null
  /** Prazo Médio de Pagamento (dias) */
  pmp: number | null
  /** Capital de Giro Líquido = AC − PC (R$) */
  cgl: number | null
  /** Necessidade de Capital de Giro = ACO − PCO (R$) */
  ncg: number | null
  /** Saldo de Tesouraria = CGL − NCG (R$) */
  saldoTesouraria: number | null
}

const seguro = (num: number, den: number): number | null => (den > 0 ? num / den : null)

export function calcularMetricasEstruturais(
  balanco: Partial<BalancoRecord> | null,
  dre: Partial<DreRecord> | null,
): MetricasEstruturaisResultado {
  const calcB = calcularBalanco(balanco)
  const calcD = calcularDre(dre)

  const ativoTotal = calcB.ativoTotal
  const ativoCirculante = calcB.ativoCirculante
  const passivoCirculante = calcB.passivoCirculante
  const passivoNaoCirculante = calcB.passivoNaoCirculante
  const realizavelLongoPrazo = balanco?.realizavel_longo_prazo || 0
  const disponivel = (balanco?.caixa_equivalentes || 0) + (balanco?.aplicacoes_financeiras || 0)
  const estoques = balanco?.estoques || 0
  const receitaLiquida = calcD.receitaLiquida
  const lucroLiquido = calcD.lucroLiquido

  const temDados = ativoTotal > 0 || ativoCirculante > 0 || passivoCirculante > 0

  // ROA e Giro do Ativo
  const roa = ativoTotal > 0 ? (lucroLiquido / ativoTotal) * 100 : null
  const giroAtivo = seguro(receitaLiquida, ativoTotal)

  // Liquidezes (mesmas fórmulas de calcularIndicadores)
  const liquidezSeca = seguro(ativoCirculante - estoques, passivoCirculante)
  const liquidezImediata = seguro(disponivel, passivoCirculante)
  const liquidezGeral = seguro(
    ativoCirculante + realizavelLongoPrazo,
    passivoCirculante + passivoNaoCirculante,
  )

  // Prazos médios (mesmas fórmulas de calcularCapitalGiro/calcularIndicadoresAvancados)
  const contasReceber = balanco?.contas_receber || 0
  const fornecedores = balanco?.fornecedores || 0
  const pmrDias = seguro(contasReceber, receitaLiquida)
  const pmpDias = seguro(fornecedores, dre?.custo_mercadorias || 0)

  // Capital de Giro (modelo Fleuriet — mesmo cálculo de calcularCapitalGiro)
  const aco =
    contasReceber +
    estoques +
    (balanco?.impostos_recuperar || 0) +
    (balanco?.outros_ativo_circulante || 0)
  const pco =
    fornecedores +
    (balanco?.obrigacoes_trabalhistas || 0) +
    (balanco?.obrigacoes_tributarias || 0) +
    (balanco?.outros_passivo_circulante || 0)

  const cgl = temDados ? ativoCirculante - passivoCirculante : null
  const ncg = temDados ? aco - pco : null
  const saldoTesouraria = cgl !== null && ncg !== null ? cgl - ncg : null

  return {
    temDados,
    ativoTotal,
    ativoCirculante,
    passivoCirculante,
    passivoNaoCirculante,
    realizavelLongoPrazo,
    disponivel,
    estoques,
    receitaLiquida,
    lucroLiquido,
    roa,
    giroAtivo,
    liquidezSeca,
    liquidezImediata,
    liquidezGeral,
    contasReceber,
    fornecedores,
    cmv: dre?.custo_mercadorias || 0,
    pmr: pmrDias !== null ? pmrDias * 360 : null,
    pmp: pmpDias !== null ? pmpDias * 360 : null,
    cgl,
    ncg,
    saldoTesouraria,
  }
}

export default calcularMetricasEstruturais
