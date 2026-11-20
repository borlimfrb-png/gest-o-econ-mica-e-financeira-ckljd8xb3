import * as XLSX from 'xlsx'
import type {
  PontoEquilibrioAnoComMeta,
  PontoEquilibrioMesComMeta,
} from './pontoEquilibrioMetaComparativo'
import type { EmpresaRecord } from '@/types/finance'
import { sanitizeNomeArquivo } from './exportacaoPlanoContas'
import { formatarPercentualExport } from './despesasFixasExport'

/** Contrato mínimo usado pela exportação: o ano ativo já com metas mescladas. */
export type PontoEquilibrioResultadoComMeta = {
  anoAtivo: PontoEquilibrioAnoComMeta | null
}

type Mes = PontoEquilibrioMesComMeta

function formatMoedaCsv(v: number | undefined | null): string {
  if (v === undefined || v === null || !Number.isFinite(v)) return '—'
  return v.toFixed(2).replace('.', ',')
}

function novoCabecalho(ano: PontoEquilibrioAnoComMeta): string[] {
  return ['Indicador', ...ano.meses.map((m) => m.rotuloCurto), 'Total Ano']
}

/**
 * Monta as linhas da matriz (uma por indicador, colunas jan–dez + Total Ano).
 * Reaproveitada pelo Excel e pelo CSV para nunca divergirem. Inclui as linhas
 * de Meta de Receita, % da Meta Atingido e Diferença Realizado − Meta.
 */
function gerarLinhasMatriz(ao: PontoEquilibrioAnoComMeta): LinhaPontoEquilibrio[] {
  return [
    {
      Indicador: 'Receita Bruta (R$)',
      ...valores(ao, (m) => m.receita, ao.totalReceita, formatMoedaCsv),
    },
    {
      Indicador: 'Meta de Receita (R$)',
      ...valores(ao, (m) => m.meta, ao.totalMeta, formatMoedaCsv),
    },
    {
      Indicador: '% da Meta Atingido (%)',
      ...valores(ao, (m) => m.percentualMeta, ao.totalPercentualMeta, formatarPercentualExport),
    },
    {
      Indicador: 'Diferença Realizado − Meta (R$)',
      ...valores(ao, (m) => m.diferencaMeta, ao.totalDiferencaMeta, formatMoedaCsv),
    },
    {
      Indicador: 'Despesas Variáveis (R$)',
      ...valores(ao, (m) => m.despesasVariaveis, ao.totalDespesasVariaveis, formatMoedaCsv),
    },
    {
      Indicador: 'Margem de Contribuição (R$)',
      ...valores(ao, (m) => m.margemValor, ao.margemTotal, formatMoedaCsv),
    },
    {
      Indicador: 'Margem de Contribuição (%)',
      ...valores(ao, (m) => m.margemPercentual, ao.margemAnualPercentual, formatarPercentualExport),
    },
    {
      Indicador: 'Despesas Fixas (R$)',
      ...valores(ao, (m) => m.despesasFixas, ao.totalDespesasFixas, formatMoedaCsv),
    },
    {
      Indicador: 'Ponto de Equilíbrio (R$)',
      ...valores(ao, (m) => m.pontoEquilibrio, ao.pontoEquilibrioAnual, formatMoedaCsv),
    },
    {
      Indicador: 'Margem de Segurança (%)',
      ...valores(
        ao,
        (m) => m.margemSegurancaPercentual,
        ao.margemSegurancaAnualPercentual,
        formatarPercentualExport,
      ),
    },
    {
      Indicador: 'Resultado do Mês (R$)',
      ...valores(ao, (m) => m.resultado, ao.resultadoAnual, formatMoedaCsv),
    },
    {
      Indicador: 'GAO (Alavancagem Operacional)',
      ...valores(ao, (m) => m.grauAlavancagemOperacional, ao.grauAlavancagemAnual, formatMoedaCsv),
    },
  ]
}

export interface LinhaPontoEquilibrio extends Record<string, string> {}

function valores(
  ano: PontoEquilibrioAnoComMeta,
  pegar: (m: Mes) => number | null,
  total: number | null,
  formatar: (v: number | null) => string,
): Record<string, string> {
  const row: Record<string, string> = {}
  for (const m of ano.meses) row[m.rotuloCurto] = formatar(pegar(m))
  row['Total Ano'] = formatar(total)
  return row
}

/**
 * Exporta o Ponto de Equilíbrio para planilha Excel (.xlsx): matriz mês a mês
 * (metas, receita, variáveis, MC em R$ e %, fixas, PE, margem de segurança,
 * resultado e GAO) com a coluna "Total Ano" consolidada.
 */
export function exportarPontoEquilibrioExcel(
  resultado: PontoEquilibrioResultadoComMeta,
  empresa?: EmpresaRecord | null,
  exercicioAno?: number,
) {
  const nomeEmpresa = empresa?.nome || 'Empresa'
  const safeEmpresa = sanitizeNomeArquivo(nomeEmpresa)
  const dataHoje = new Date().toISOString().slice(0, 10)
  const fileName = `ponto-equilibrio-${safeEmpresa}-${exercicioAno || dataHoje}.xlsx`

  const ao = resultado.anoAtivo
  if (!ao) return

  const rows: Record<string, string>[] = [
    { Indicador: `EXERCÍCIO ${ao.ano} — PONTO DE EQUILÍBRIO CONTÁBIL` },
    ...gerarLinhasMatriz(ao),
    { Indicador: 'Valores "—" indicam mês sem movimento, PE indefinido ou meta não cadastrada' },
    { Indicador: `Empresa: ${nomeEmpresa}` },
    { Indicador: `Exercício: ${exercicioAno || ao.ano}` },
  ]

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows, { header: novoCabecalho(ao) })
  XLSX.utils.book_append_sheet(wb, ws, 'Ponto de Equilíbrio')
  XLSX.writeFile(wb, fileName)
}

/**
 * Exporta em CSV pt-BR: separador ";", vírgula decimal, BOM no início
 * (Excel abre sem corromper acentuação) — padrão das telas irmãs.
 */
export function exportarPontoEquilibrioCsv(
  resultado: PontoEquilibrioResultadoComMeta,
  empresa?: EmpresaRecord | null,
  exercicioAno?: number,
) {
  const nomeEmpresa = empresa?.nome || 'Empresa'
  const safeEmpresa = sanitizeNomeArquivo(nomeEmpresa)
  const dataHoje = new Date().toISOString().slice(0, 10)
  const fileName = `ponto-equilibrio-${safeEmpresa}-${exercicioAno || dataHoje}.csv`

  const ao = resultado.anoAtivo
  if (!ao) return

  const cabecalho = novoCabecalho(ao)
  const linhas: string[] = [cabecalho.map(escapar).join(';')]
  for (const row of gerarLinhasMatriz(ao)) {
    linhas.push(cabecalho.map((c) => escapar(row[c] ?? '')).join(';'))
  }
  linhas.push('')
  linhas.push(
    escapar('Valores "—" indicam mês sem movimento, PE indefinido ou meta não cadastrada'),
  )
  linhas.push(`Empresa;${escapar(nomeEmpresa)}`)
  linhas.push(`Exercício;${escapar(String(exercicioAno || ao.ano))}`)

  const csv = '\ufeff' + linhas.join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function escapar(v: unknown): string {
  const s = String(v ?? '')
  return s.includes(';') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
}
