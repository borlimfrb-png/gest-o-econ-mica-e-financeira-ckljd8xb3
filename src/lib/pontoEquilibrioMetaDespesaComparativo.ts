/**
 * Comparativo DESPESA REALIZADA vs. META DE DESPESA do Ponto de Equilíbrio.
 *
 * Funções PURAS — mesclam as metas salvas (coleção `metas_despesa_mensal`) aos
 * meses calculados por calcularPontoEquilibrio, sem alterar em nada o PE, a
 * margem de segurança ou o GAO (cálculo oficial intacto).
 *
 * ATENÇÃO: lógica INVERTIDA em relação à meta de receita — em despesa,
 * ficar DENTRO (ou abaixo) da meta é o resultado bom:
 *   - realizado <= meta                     → verde
 *   - realizado até 10% ACIMA da meta       → âmbar
 *   - realizado mais de 10% acima da meta   → vermelho
 *
 * Convenção de "—" (nunca zero enganoso, padrão das telas irmãs):
 *   - sem meta cadastrada (ou meta 0)         → meta = null e "% da meta" = null
 *   - com meta mas mês sem movimento          → realizado = null e "% da meta" = null
 *   - % da meta só sai quando há meta > 0 E despesa fixa do mês != 0
 */
import type { MetaDespesaMensalRecord } from '@/types/finance'
import type {
  PontoEquilibrioAnoComMeta,
  PontoEquilibrioMesComMeta,
} from './pontoEquilibrioMetaComparativo'

/**
 * Mês com as metas de despesa mescladas — estende o mês que JÁ tem os campos
 * da meta de receita (o fluxo da tela é sempre receita → despesa).
 */
export interface PontoEquilibrioMesComMetaDespesa extends PontoEquilibrioMesComMeta {
  /** Meta de despesa do mês em R$ — null = sem meta cadastrada (exibe "—") */
  metaDespesa: number | null
  /** Realizado ÷ Meta em % — null quando não há meta ou não há despesa no mês */
  percentualMetaDespesa: number | null
  /** Realizado − Meta — null quando não há meta */
  diferencaMetaDespesa: number | null
  /** Classificação visual invertida: dentro da meta = verde */
  statusMetaDespesa: 'verde' | 'ambar' | 'vermelho' | 'neutro'
}

/** Ano com as metas de despesa mescladas — estende o ano com meta de receita. */
export interface PontoEquilibrioAnoComMetaDespesa extends PontoEquilibrioAnoComMeta {
  meses: PontoEquilibrioMesComMetaDespesa[]
  /** Total de metas de despesa lançadas no ano (R$) — null quando nenhuma */
  totalMetaDespesa: number | null
  totalMetaDespesaDefinida: boolean
  /** % do ano: despesa realizada ÷ meta anual (null quando sem meta ou sem despesa) */
  totalPercentualMetaDespesa: number | null
  /** Despesa realizada − meta anual (null quando sem meta) */
  totalDiferencaMetaDespesa: number | null
}

export type StatusMetaDespesa = PontoEquilibrioMesComMetaDespesa['statusMetaDespesa']

/**
 * Cor do % da meta de despesa — LÓGICA INVERTIDA da meta de receita:
 * verde quando o realizado ficou DENTRO da meta (≤ 100%), âmbar até 10% acima
 * (100–110%), vermelho acima disso (> 110%).
 */
export function classificarPercentualMetaDespesa(p: number | null | undefined): StatusMetaDespesa {
  if (p === null || p === undefined || !Number.isFinite(p)) return 'neutro'
  if (p <= 100) return 'verde'
  if (p <= 110) return 'ambar'
  return 'vermelho'
}

/** Classes CSS (mesma paleta da margem de segurança) para badge/texto do % da meta de despesa. */
export function getClassesPercentualMetaDespesa(p: number | null | undefined): {
  badge: string
  texto: string
} {
  switch (classificarPercentualMetaDespesa(p)) {
    case 'verde':
      return {
        badge: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        texto: 'text-emerald-700',
      }
    case 'ambar':
      return {
        badge: 'bg-amber-50 text-amber-800 border-amber-200',
        texto: 'text-amber-700',
      }
    case 'vermelho':
      return { badge: 'bg-rose-50 text-rose-800 border-rose-200', texto: 'text-rose-700' }
    default:
      return { badge: 'bg-slate-50 text-slate-500 border-slate-200', texto: 'text-slate-400' }
  }
}

/** Metas de despesa de um ano indexadas por mês (1–12) — ignora outros anos e valores zerados. */
export function mapearMetasDespesaPorMes(
  metas: MetaDespesaMensalRecord[],
  ano: number,
): Map<number, number> {
  const mapa = new Map<number, number>()
  for (const m of metas) {
    const mes = Number(m.mes)
    const valor = Number(m.valor) || 0
    if (Number(m.ano) === ano && mes >= 1 && mes <= 12 && valor > 0) {
      mapa.set(mes, valor)
    }
  }
  return mapa
}

/**
 * Mescla as metas de despesa de um ano nos meses calculados (retorna NOVOS
 * objetos). Entrada: o ano JÁ mesclado com as metas de receita.
 */
export function mesclarMetasDespesaNoAno(
  ano: PontoEquilibrioAnoComMeta,
  metasAno: Map<number, number>,
): PontoEquilibrioAnoComMetaDespesa {
  let somaMetas = 0
  let totalMetaDespesaDefinida = false

  const meses: PontoEquilibrioMesComMetaDespesa[] = ano.meses.map((m) => {
    const meta = metasAno.get(m.mes) ?? null
    const temMeta = meta !== null && meta > 0
    if (temMeta) {
      somaMetas += meta as number
      totalMetaDespesaDefinida = true
    }
    const despesa = m.despesasFixas
    // % da meta exige meta > 0 E mês com movimento (mês sem movimento → "—")
    const percentualMetaDespesa =
      temMeta && m.temMovimento && despesa !== 0 ? (despesa / (meta as number)) * 100 : null
    const diferencaMetaDespesa = temMeta && m.temMovimento ? despesa - (meta as number) : null
    return {
      ...m,
      metaDespesa: temMeta ? meta : null,
      percentualMetaDespesa,
      diferencaMetaDespesa,
      statusMetaDespesa: classificarPercentualMetaDespesa(percentualMetaDespesa),
    }
  })

  // Total do ano: % só quando há meta anual E despesa anual (nunca zero)
  const totalPercentualMetaDespesa =
    somaMetas > 0 && ano.totalDespesasFixas !== 0
      ? (ano.totalDespesasFixas / somaMetas) * 100
      : null

  return {
    ...ano,
    meses,
    totalMetaDespesa: totalMetaDespesaDefinida ? somaMetas : null,
    totalMetaDespesaDefinida,
    totalPercentualMetaDespesa,
    totalDiferencaMetaDespesa: totalMetaDespesaDefinida ? ano.totalDespesasFixas - somaMetas : null,
  }
}
