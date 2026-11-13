/**
 * Exportação Excel/CSV das Métricas Avançadas da tela /indicadores/apresentacao.
 * Consolida: Termômetro de Insolvência (Z-Score Altman), EVA, DuPont,
 * Ciclo de Conversão de Caixa, Cobertura de Juros + comparativo de mercado.
 */
import * as XLSX from 'xlsx'
import type { EmpresaRecord } from '@/types/finance'
import { sanitizeNomeArquivo } from './exportacaoPlanoContas'
import type { ZScoreResultado } from './termometroInsolvenciaCalculo'
import { ROTULO_ZONA } from './termometroInsolvenciaCalculo'
import type { IndicadoresAvancadosResultado } from './indicadoresAvancadosCalculo'
import { ROTULO_CLASSIFICACAO_COBERTURA } from './indicadoresAvancadosCalculo'
import type { ReferenciaMercado } from '@/components/indicadores/benchmarkHub'

export interface MetricasAvancadasCompletas {
  z: ZScoreResultado
  avancados: IndicadoresAvancadosResultado
  referencia: ReferenciaMercado | null
}

const fmtNum = (v: number | null | undefined, dec = 2): string =>
  v === null || v === undefined || !Number.isFinite(v)
    ? '—'
    : v.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec })

const fmtBrl = (v: number | null | undefined): string =>
  v === null || v === undefined || !Number.isFinite(v) ? '—' : `R$ ${fmtNum(v, 2)}`

const fmtPct = (v: number | null | undefined): string =>
  v === null || v === undefined || !Number.isFinite(v) ? '—' : `${fmtNum(v, 2)}%`

function linhasMetricas(
  m: MetricasAvancadasCompletas,
): { Indicador: string; Valor: string; Referência: string }[] {
  const ref = m.referencia
  const r = (v: number | null | undefined): string =>
    v === null || v === undefined ? '—' : fmtNum(v)
  const eva = m.avancados.eva
  const dup = m.avancados.dupont
  const ciclo = m.avancados.ciclo
  const cob = m.avancados.cobertura

  return [
    {
      Indicador: "Termômetro de Insolvência — Z-Score (Z'')",
      Valor: fmtNum(m.z.zPrivada, 3),
      Referência: '—',
    },
    {
      Indicador: "Zona de Insolvência (Z'')",
      Valor: m.z.zonaPrivada ? ROTULO_ZONA[m.z.zonaPrivada] : 'Sem dados',
      Referência: '—',
    },
    {
      Indicador: 'Z-Score (Modelo Clássico 1968)',
      Valor: fmtNum(m.z.zClassica, 3),
      Referência: '—',
    },
    {
      Indicador: 'Zona de Insolvência (Clássico)',
      Valor: m.z.zonaClassica ? ROTULO_ZONA[m.z.zonaClassica] : 'Sem dados',
      Referência: '—',
    },
    { Indicador: 'EVA (Valor Econômico Agregado, R$)', Valor: fmtBrl(eva.eva), Referência: '—' },
    { Indicador: 'NOPAT (R$)', Valor: fmtBrl(eva.nopat), Referência: '—' },
    {
      Indicador: 'Custo do Capital Investido (R$)',
      Valor: fmtBrl(eva.custoCapital),
      Referência: '—',
    },
    { Indicador: 'Capital Investido (R$)', Valor: fmtBrl(eva.capitalInvestido), Referência: '—' },
    { Indicador: 'Margem EVA (%)', Valor: fmtPct(eva.margemEva), Referência: '—' },
    {
      Indicador: 'DuPont — Margem Líquida (%)',
      Valor: fmtPct(dup.margemLiquida),
      Referência: r(ref?.margemLiquida ?? null),
    },
    {
      Indicador: 'DuPont — Giro do Ativo (x)',
      Valor: r(dup.giroAtivo),
      Referência: r(ref?.giroAtivo ?? null),
    },
    {
      Indicador: 'DuPont — Alavancagem Financeira (x)',
      Valor: r(dup.alavancagemFinanceira),
      Referência: '—',
    },
    { Indicador: 'DuPont — ROE (%)', Valor: fmtPct(dup.roe), Referência: r(ref?.roe ?? null) },
    { Indicador: 'DuPont — ROA (%)', Valor: fmtPct(dup.roa), Referência: '—' },
    { Indicador: 'Ciclo — PME (dias)', Valor: r(ciclo.pme), Referência: r(ref?.pme ?? null) },
    { Indicador: 'Ciclo — PMR (dias)', Valor: r(ciclo.pmr), Referência: r(ref?.pmr ?? null) },
    { Indicador: 'Ciclo — PMP (dias)', Valor: r(ciclo.pmp), Referência: r(ref?.pmp ?? null) },
    {
      Indicador: 'Ciclo — Ciclo Operacional (dias)',
      Valor: r(ciclo.cicloOperacional),
      Referência: '—',
    },
    {
      Indicador: 'Ciclo — Ciclo de Conversão de Caixa (dias)',
      Valor: r(ciclo.cicloConversaoCaixa),
      Referência: r(ref?.cicloFinanceiro ?? null),
    },
    {
      Indicador: 'Cobertura de Juros (x)',
      Valor: r(cob.cobertura),
      Referência: r(ref?.coberturaJuros ?? null),
    },
    {
      Indicador: 'Cobertura de Juros — Classificação',
      Valor: ROTULO_CLASSIFICACAO_COBERTURA[cob.classificacao],
      Referência: '—',
    },
    {
      Indicador: 'Segmento de referência de mercado',
      Valor: ref?.rotuloSetor ?? '—',
      Referência: ref?.usarFallback ? 'Padrão do setor (fallback)' : 'Benchmark cadastrado',
    },
  ]
}

function nomeArquivo(
  empresa: EmpresaRecord | null | undefined,
  exercicioAno?: number,
  ext?: 'xlsx' | 'csv',
) {
  const safe = sanitizeNomeArquivo(empresa?.nome || 'Empresa')
  return `metricas-avancadas-indicadores-${safe}-${exercicioAno || new Date().getFullYear()}.${ext}`
}

export function exportarMetricasAvancadasExcel(
  m: MetricasAvancadasCompletas,
  empresa?: EmpresaRecord | null,
  exercicioAno?: number,
) {
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(linhasMetricas(m))
  ws['!cols'] = [{ wch: 46 }, { wch: 26 }, { wch: 28 }]
  XLSX.utils.book_append_sheet(wb, ws, 'Métricas Avançadas')
  XLSX.writeFile(wb, nomeArquivo(empresa, exercicioAno, 'xlsx'))
}

export function exportarMetricasAvancadasCsv(
  m: MetricasAvancadasCompletas,
  empresa?: EmpresaRecord | null,
  exercicioAno?: number,
) {
  const escapeCsv = (val: unknown): string => {
    if (val === null || val === undefined) return ''
    const s = String(val)
    if (/[;"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }

  const linhas: string[] = []
  linhas.push(['Empresa', 'Exercício'].map(escapeCsv).join(';'))
  linhas.push([empresa?.nome || 'Empresa', exercicioAno || ''].map(escapeCsv).join(';'))
  linhas.push('')
  linhas.push(['Indicador', 'Valor', 'Referência de mercado'].map(escapeCsv).join(';'))
  for (const l of linhasMetricas(m)) {
    linhas.push([l.Indicador, l.Valor, l.Referência].map(escapeCsv).join(';'))
  }

  const csvContent = '\uFEFF' + linhas.join('\r\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', nomeArquivo(empresa, exercicioAno, 'csv'))
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
