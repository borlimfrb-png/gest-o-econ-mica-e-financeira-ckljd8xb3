/**
 * Comparativo REALIZADO vs. META do Ponto de Equilíbrio.
 *
 * Funções PURAS — mesclam as metas salvas (coleção `metas_receita_mensal`) aos
 * meses calculados por calcularPontoEquilibrio, sem alterar em nada o PE, a
 * margem de segurança ou o GAO (cálculo oficial intacto).
 *
 * Convenção de "—" (nunca zero enganoso, padrão das telas irmãs):
 *   - sem meta cadastrada (ou meta 0)  → meta = null e "% atingido" = null
 *   - com meta mas mês sem movimento   → realizado = null e "% atingido" = null
 *   - % atingido só sai quando há meta > 0 E realizado > 0
 */
import type { PontoEquilibrioAno, PontoEquilibrioMes } from './pontoEquilibrioCalculo'
import type { MetaReceitaMensalRecord } from '@/types/finance'

/** Ano com as metas mescladas (mesmos meses, campos de meta adicionais). */
export interface PontoEquilibrioAnoComMeta extends PontoEquilibrioAno {
  meses: PontoEquilibrioMesComMeta[]
  /** Total de metas lançadas no ano (R$) — null quando nenhuma */
  totalMeta: number | null
  totalMetaDefinida: boolean
  /** % do ano: realizado ÷ meta anual (null quando sem meta ou sem receita) */
  totalPercentualMeta: number | null
  /** Realizado − meta anual (null quando sem meta) */
  totalDiferencaMeta: number | null
}

export interface PontoEquilibrioMesComMeta extends PontoEquilibrioMes {
  /** Meta de receita do mês em R$ — null = sem meta cadastrada (exibe "—") */
  meta: number | null
  /** Realizado ÷ Meta em % — null quando não há meta ou não há movimento */
  percentualMeta: number | null
  /** Realizado − Meta — null quando não há meta */
  diferencaMeta: number | null
  /** Classificação visual: verde ≥ 100, âmbar 80–99,99, vermelho < 80 */
  statusMeta: 'verde' | 'ambar' | 'vermelho' | 'neutro'
}

export type StatusMeta = PontoEquilibrioMesComMeta['statusMeta']

/**
 * Cor do % atingido — MESMA PALETA da margem de segurança
 * (getClassesMargemSeguranca): verde ≥ 100%, âmbar 80–99,99%, vermelho < 80%.
 */
export function classificarPercentualMeta(p: number | null | undefined): StatusMeta {
  if (p === null || p === undefined || !Number.isFinite(p)) return 'neutro'
  if (p < 80) return 'vermelho'
  if (p < 100) return 'ambar'
  return 'verde'
}

/** Classes CSS (mesmas da margem de segurança) para badge/texto do % da meta. */
export function getClassesPercentualMeta(p: number | null | undefined): {
  badge: string
  texto: string
} {
  switch (classificarPercentualMeta(p)) {
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

/** Metas de um ano indexadas por mês (1–12) — ignora registros de outros anos. */
export function mapearMetasPorMes(
  metas: MetaReceitaMensalRecord[],
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

/** Mescla as metas de um ano nos meses calculados (retorna NOVOS objetos). */
export function mesclarMetasNoAno(
  ano: PontoEquilibrioAno,
  metasAno: Map<number, number>,
): PontoEquilibrioAnoComMeta {
  let somaMetas = 0
  let totalMetaDefinida = false

  const meses: PontoEquilibrioMesComMeta[] = ano.meses.map((m) => {
    const meta = metasAno.get(m.mes) ?? null
    const temMeta = meta !== null && meta > 0
    if (temMeta) {
      somaMetas += meta as number
      totalMetaDefinida = true
    }
    // % atingido exige meta > 0 E realizado > 0 (sem movimento → "—")
    const percentualMeta =
      temMeta && m.temMovimento && m.receita > 0 ? (m.receita / (meta as number)) * 100 : null
    const diferencaMeta = temMeta ? m.receita - (meta as number) : null
    return {
      ...m,
      meta: temMeta ? meta : null,
      percentualMeta,
      diferencaMeta,
      statusMeta: classificarPercentualMeta(percentualMeta),
    }
  })

  // Total do ano: % só quando há meta anual E receita anual (nunca zero)
  const totalPercentualMeta =
    somaMetas > 0 && ano.totalReceita > 0 ? (ano.totalReceita / somaMetas) * 100 : null

  return {
    ...ano,
    meses,
    totalMeta: totalMetaDefinida ? somaMetas : null,
    totalMetaDefinida,
    totalPercentualMeta,
    totalDiferencaMeta: totalMetaDefinida ? ano.totalReceita - somaMetas : null,
  }
}
