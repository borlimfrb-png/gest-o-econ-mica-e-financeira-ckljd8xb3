/**
 * Linhas CSV/Excel das Métricas Estruturais (ROA, Giro, Liquidezes, PMR/PMP,
 * CGL, NCG e Saldo de Tesouraria) — apêndice do exportador de Métricas Avançadas.
 * Formatação 100% no frontend (pt-BR); sem dado = "—" (nunca zero enganoso).
 */
import type { MetricasEstruturaisResultado } from './metricasEstruturaisCalculo'
import type { ReferenciaMercado } from '@/components/indicadores/benchmarkHub'

const fmtNum = (v: number | null | undefined, dec = 2): string =>
  v === null || v === undefined || !Number.isFinite(v)
    ? '—'
    : v.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec })

const fmtBrl = (v: number | null | undefined): string =>
  v === null || v === undefined || !Number.isFinite(v) ? '—' : `R$ ${fmtNum(v, 2)}`

const fmtPct = (v: number | null | undefined): string =>
  v === null || v === undefined || !Number.isFinite(v) ? '—' : `${fmtNum(v, 2)}%`

export function linhasEstruturais(
  est: MetricasEstruturaisResultado,
  ref: ReferenciaMercado | null,
): { Indicador: string; Valor: string; Referência: string }[] {
  const r = (v: number | null | undefined): string =>
    v === null || v === undefined || !Number.isFinite(v) ? '—' : fmtNum(v)

  return [
    {
      Indicador: 'ROA — Retorno sobre Ativos (%)',
      Valor: fmtPct(est.roa),
      Referência: r(ref?.roa),
    },
    {
      Indicador: 'Giro do Ativo (x)',
      Valor: r(est.giroAtivo),
      Referência: r(ref?.giroAtivo),
    },
    {
      Indicador: 'Liquidez Seca (x)',
      Valor: r(est.liquidezSeca),
      Referência: r(ref?.liquidezSeca),
    },
    {
      Indicador: 'Liquidez Imediata (x)',
      Valor: r(est.liquidezImediata),
      Referência: r(ref?.liquidezImediata),
    },
    {
      Indicador: 'Liquidez Geral (x)',
      Valor: r(est.liquidezGeral),
      Referência: r(ref?.liquidezGeral),
    },
    {
      Indicador: 'PMR — Prazo Médio de Recebimento (dias)',
      Valor: r(est.pmr),
      Referência: r(ref?.pmr),
    },
    {
      Indicador: 'PMP — Prazo Médio de Pagamento (dias)',
      Valor: r(est.pmp),
      Referência: r(ref?.pmp),
    },
    {
      Indicador: 'Capital de Giro Líquido (R$)',
      Valor: fmtBrl(est.cgl),
      Referência: ref?.cglReferencia !== undefined ? fmtBrl(ref.cglReferencia) : '—',
    },
    {
      Indicador: 'Necessidade de Capital de Giro — NCG (R$)',
      Valor: fmtBrl(est.ncg),
      Referência: ref?.ncgReferencia !== undefined ? fmtBrl(ref.ncgReferencia) : '—',
    },
    {
      Indicador: 'Saldo de Tesouraria (R$)',
      Valor: fmtBrl(est.saldoTesouraria),
      Referência:
        ref?.saldoTesourariaReferencia !== undefined ? fmtBrl(ref.saldoTesourariaReferencia) : '—',
    },
  ]
}

export default linhasEstruturais
