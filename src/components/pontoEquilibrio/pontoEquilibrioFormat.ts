/**
 * Formatação pt-BR compartilhada pelo painel de Ponto de Equilíbrio.
 * (Intl/toLocaleString no navegador — nunca no backend, regra do projeto.)
 */
export function formatBrlPontoEquilibrio(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

export function formatPercentualPontoEquilibrio(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—'
  return `${v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
}

export function formatMultiploPontoEquilibrio(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—'
  return `${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}x`
}
