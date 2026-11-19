import * as XLSX from 'xlsx'
import type { MargemContribuicaoResultado } from './margemContribuicaoCalculo'
import type { EmpresaRecord } from '@/types/finance'
import { sanitizeNomeArquivo } from './exportacaoPlanoContas'
import { formatarPercentualExport } from './despesasFixasExport'

function formatMoedaCsv(v: number | undefined | null): string {
  if (v === undefined || v === null || !Number.isFinite(v)) return '0,00'
  return v.toFixed(2).replace('.', ',')
}

function nomeArquivo(
  resultado: MargemContribuicaoResultado,
  empresa: EmpresaRecord | null | undefined,
  ext: string,
): string {
  const safeEmpresa = sanitizeNomeArquivo(empresa?.nome || 'Empresa')
  const dataHoje = new Date().toISOString().slice(0, 10)
  const sufixoAno =
    resultado.anos.length === 1 ? String(resultado.anoAtual) : `${resultado.anoAtual}`
  return `margem-contribuicao-${safeEmpresa}-${sufixoAno || dataHoje}.${ext}`
}

/**
 * Exporta a Margem de Contribuição para planilha Excel (.xlsx):
 * uma linha por ano (mais recente primeiro) com Receita, Despesas Variáveis,
 * Margem de Contribuição em R$ e % para cada mês e o total do ano,
 * seguido do bloco de variação entre anos (pontos percentuais).
 */
export function exportarMargemContribuicaoExcel(
  resultado: MargemContribuicaoResultado,
  empresa?: EmpresaRecord | null,
) {
  const fileName = nomeArquivo(resultado, empresa, 'xlsx')

  const rows: Array<Record<string, any>> = []

  for (const ano of resultado.anos) {
    const rowReceita: Record<string, any> = { Linha: `RECEITA ${ano.ano}` }
    const rowVar: Record<string, any> = { Linha: `DESPESAS VARIÁVEIS ${ano.ano}` }
    const rowMc: Record<string, any> = { Linha: `MARGEM DE CONTRIBUIÇÃO ${ano.ano} (R$)` }
    const rowMcPct: Record<string, any> = { Linha: `MARGEM DE CONTRIBUIÇÃO ${ano.ano} (%)` }
    for (const m of ano.meses) {
      rowReceita[`${m.rotuloCurto} (R$)`] = m.receita
      rowVar[`${m.rotuloCurto} (R$)`] = m.despesasVariaveis
      rowMc[`${m.rotuloCurto} (R$)`] = m.margemValor
      rowMcPct[`${m.rotuloCurto} (R$)`] = '—'
      rowMcPct[`${m.rotuloCurto} (%)`] = formatarPercentualExport(m.margemPercentual)
    }
    rowReceita['Total Ano (R$)'] = ano.totalReceita
    rowReceita['Total Ano (%)'] = '100,00%'
    rowVar['Total Ano (R$)'] = ano.totalDespesasVariaveis
    rowVar['Total Ano (%)'] = formatarPercentualExport(
      ano.totalReceita > 0 ? (ano.totalDespesasVariaveis / ano.totalReceita) * 100 : null,
    )
    rowMc['Total Ano (R$)'] = ano.margemTotal
    rowMc['Total Ano (%)'] = formatarPercentualExport(ano.margemAnualPercentual)
    rowMcPct['Total Ano (R$)'] = '—'
    rowMcPct['Total Ano (%)'] = formatarPercentualExport(ano.margemAnualPercentual)
    rows.push(rowReceita, rowVar, rowMc, rowMcPct)
  }

  rows.push({ Linha: '' })

  const rowVariacao: Record<string, any> = {
    Linha: 'VARIAÇÃO DA MARGEM ANUAL (p.p. vs ano anterior)',
  }
  for (const ano of resultado.anos) {
    rowVariacao[`MC ${ano.ano} (%)`] = formatarPercentualExport(ano.margemAnualPercentual)
    rowVariacao[`Δ p.p. ${ano.ano}`] =
      ano.variacaoPpAnoAnterior === null
        ? '—'
        : `${ano.variacaoPpAnoAnterior > 0 ? '+' : ''}${ano.variacaoPpAnoAnterior
            .toFixed(2)
            .replace('.', ',')} p.p.`
  }
  rows.push(rowVariacao)

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows)
  const cols = [{ wch: 38 }]
  for (let i = 0; i < 12; i++) {
    cols.push({ wch: 15 })
    cols.push({ wch: 12 })
  }
  cols.push({ wch: 18 })
  cols.push({ wch: 15 })
  ws['!cols'] = cols
  XLSX.utils.book_append_sheet(wb, ws, 'Margem Contribuição')
  XLSX.writeFile(wb, fileName)
}

/**
 * Exporta a Margem de Contribuição em CSV (UTF-8 BOM, delimitador ";").
 */
export function exportarMargemContribuicaoCsv(
  resultado: MargemContribuicaoResultado,
  empresa?: EmpresaRecord | null,
) {
  const fileName = nomeArquivo(resultado, empresa, 'csv')

  const escapeCsv = (val: any): string => {
    if (val === null || val === undefined) return ''
    const s = String(val)
    if (/[;"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }

  const cabecalhos: string[] = ['Linha']
  for (let i = 0; i < 12; i++) {
    cabecalhos.push(`Mês ${i + 1} (R$)`)
    cabecalhos.push(`Mês ${i + 1} (%)`)
  }
  cabecalhos.push('Total Ano (R$)')
  cabecalhos.push('Total Ano (%)')

  const linhas: string[] = [cabecalhos.map(escapeCsv).join(';')]

  for (const ano of resultado.anos) {
    const pushAno = (
      titulo: string,
      getValor: (m: (typeof ano.meses)[number]) => number | null,
      getPct: (m: (typeof ano.meses)[number]) => number | null | string,
      totalValor: number,
      totalPct: number | null | string,
    ) => {
      const linha: string[] = [titulo]
      for (const m of ano.meses) {
        const v = getValor(m)
        linha.push(v === null ? '—' : formatMoedaCsv(v))
        const p = getPct(m)
        linha.push(typeof p === 'string' ? p : formatarPercentualExport(p))
      }
      linha.push(formatMoedaCsv(totalValor))
      linha.push(typeof totalPct === 'string' ? totalPct : formatarPercentualExport(totalPct))
      linhas.push(linha.map(escapeCsv).join(';'))
    }

    pushAno(
      `RECEITA ${ano.ano}`,
      (m) => m.receita,
      () => '100,00%',
      ano.totalReceita,
      '100,00%',
    )
    pushAno(
      `DESPESAS VARIÁVEIS ${ano.ano}`,
      (m) => m.despesasVariaveis,
      (m) => (m.receita > 0 ? (m.despesasVariaveis / m.receita) * 100 : null),
      ano.totalDespesasVariaveis,
      ano.totalReceita > 0 ? (ano.totalDespesasVariaveis / ano.totalReceita) * 100 : null,
    )
    pushAno(
      `MARGEM DE CONTRIBUIÇÃO ${ano.ano} (R$)`,
      (m) => m.margemValor,
      () => '—',
      ano.margemTotal,
      '—',
    )
    pushAno(
      `MARGEM DE CONTRIBUIÇÃO ${ano.ano} (%)`,
      () => null,
      (m) => m.margemPercentual,
      null,
      ano.margemAnualPercentual,
    )
  }

  linhas.push('')

  const linhaVariacao: string[] = ['VARIAÇÃO DA MARGEM ANUAL (p.p. vs ano anterior)']
  for (const ano of resultado.anos) {
    linhaVariacao.push(`MC ${ano.ano}: ${formatarPercentualExport(ano.margemAnualPercentual)}`)
    linhaVariacao.push(
      ano.variacaoPpAnoAnterior === null
        ? 'Δ —'
        : `Δ ${ano.variacaoPpAnoAnterior > 0 ? '+' : ''}${ano.variacaoPpAnoAnterior
            .toFixed(2)
            .replace('.', ',')} p.p.`,
    )
  }
  linhas.push(linhaVariacao.map(escapeCsv).join(';'))

  const csvContent = '\uFEFF' + linhas.join('\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.setAttribute('download', fileName)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(link.href)
}
