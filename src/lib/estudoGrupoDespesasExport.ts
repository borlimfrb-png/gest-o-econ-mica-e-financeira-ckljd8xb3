import * as XLSX from 'xlsx'
import type { EstudoGrupoDespesasResultado } from './estudoGrupoDespesasCalculo'
import type { EmpresaRecord } from '@/types/finance'
import { sanitizeNomeArquivo } from './exportacaoPlanoContas'
import { formatarPercentualExport } from './despesasFixasExport'

function formatMoedaCsv(v: number | undefined | null): string {
  if (v === undefined || v === null || !Number.isFinite(v)) return '0,00'
  return v.toFixed(2).replace('.', ',')
}

/**
 * Exporta o Estudo por Grupo de Despesas para planilha Excel (.xlsx):
 * uma linha por grupo de despesa com Valor e % do Faturamento para cada mês
 * e para o total do período, mais linhas de faturamento e consolidado.
 */
export function exportarEstudoGrupoDespesasExcel(
  resultado: EstudoGrupoDespesasResultado,
  empresa?: EmpresaRecord | null,
  exercicioAno?: number,
) {
  const nomeEmpresa = empresa?.nome || 'Empresa'
  const safeEmpresa = sanitizeNomeArquivo(nomeEmpresa)
  const dataHoje = new Date().toISOString().slice(0, 10)
  const fileName = `estudo-grupo-despesas-${safeEmpresa}-${exercicioAno || dataHoje}.xlsx`

  const rows: Array<Record<string, any>> = []

  for (const g of resultado.grupos) {
    const row: Record<string, any> = { Grupo: g.grupo }
    for (const m of resultado.meses) {
      row[`${m.rotuloCurto} (R$)`] = g.valoresPorMes[m.chave] || 0
      row[`${m.rotuloCurto} (%)`] = formatarPercentualExport(g.percentuaisPorMes[m.chave])
    }
    row['Total Período (R$)'] = g.totalPeriodo
    row['Total Período (%)'] = formatarPercentualExport(g.percentualPeriodo)
    rows.push(row)
  }

  rows.push({ Grupo: '' })

  const rowTotalVar: Record<string, any> = { Grupo: 'TOTAL DE DESPESAS VARIÁVEIS' }
  for (const m of resultado.meses) {
    rowTotalVar[`${m.rotuloCurto} (R$)`] = resultado.totalDespesasVariaveisPorMes[m.chave] || 0
    rowTotalVar[`${m.rotuloCurto} (%)`] = formatarPercentualExport(
      resultado.percentualTotalVariaveisPorMes[m.chave],
    )
  }
  rowTotalVar['Total Período (R$)'] = resultado.totalDespesasVariaveisPeriodo
  rowTotalVar['Total Período (%)'] = formatarPercentualExport(
    resultado.percentualTotalVariaveisPeriodo,
  )
  rows.push(rowTotalVar)

  const rowTotal: Record<string, any> = { Grupo: 'TOTAL DE DESPESAS FIXAS' }
  for (const m of resultado.meses) {
    rowTotal[`${m.rotuloCurto} (R$)`] = resultado.totalDespesasFixasPorMes[m.chave] || 0
    rowTotal[`${m.rotuloCurto} (%)`] = formatarPercentualExport(
      resultado.percentualTotalPorMes[m.chave],
    )
  }
  rowTotal['Total Período (R$)'] = resultado.totalDespesasFixasPeriodo
  rowTotal['Total Período (%)'] = formatarPercentualExport(resultado.percentualTotalPeriodo)
  rows.push(rowTotal)

  const rowFat: Record<string, any> = { Grupo: 'FATURAMENTO DO MÊS (RECEITAS)' }
  for (const m of resultado.meses) {
    rowFat[`${m.rotuloCurto} (R$)`] = resultado.faturamentoPorMes[m.chave] || 0
    rowFat[`${m.rotuloCurto} (%)`] = '100,00%'
  }
  rowFat['Total Período (R$)'] = resultado.faturamentoTotalPeriodo
  rowFat['Total Período (%)'] = '100,00%'
  rows.push(rowFat)

  const rowPct: Record<string, any> = { Grupo: '% DESPESAS FIXAS / FATURAMENTO' }
  for (const m of resultado.meses) {
    rowPct[`${m.rotuloCurto} (R$)`] = '—'
    rowPct[`${m.rotuloCurto} (%)`] = formatarPercentualExport(
      resultado.percentualTotalPorMes[m.chave],
    )
  }
  rowPct['Total Período (R$)'] = '—'
  rowPct['Total Período (%)'] = formatarPercentualExport(resultado.percentualTotalPeriodo)
  rows.push(rowPct)

  const rowPctVar: Record<string, any> = { Grupo: '% DESPESAS VARIÁVEIS / FATURAMENTO' }
  for (const m of resultado.meses) {
    rowPctVar[`${m.rotuloCurto} (R$)`] = '—'
    rowPctVar[`${m.rotuloCurto} (%)`] = formatarPercentualExport(
      resultado.percentualTotalVariaveisPorMes[m.chave],
    )
  }
  rowPctVar['Total Período (R$)'] = '—'
  rowPctVar['Total Período (%)'] = formatarPercentualExport(
    resultado.percentualTotalVariaveisPeriodo,
  )
  rows.push(rowPctVar)

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows)
  const cols = [{ wch: 32 }]
  for (let i = 0; i < resultado.meses.length; i++) {
    cols.push({ wch: 15 })
    cols.push({ wch: 12 })
  }
  cols.push({ wch: 20 })
  cols.push({ wch: 15 })
  ws['!cols'] = cols
  XLSX.utils.book_append_sheet(wb, ws, 'Estudo por Grupo')
  XLSX.writeFile(wb, fileName)
}

/**
 * Exporta o Estudo por Grupo de Despesas em CSV (UTF-8 BOM, delimitador ";").
 */
export function exportarEstudoGrupoDespesasCsv(
  resultado: EstudoGrupoDespesasResultado,
  empresa?: EmpresaRecord | null,
  exercicioAno?: number,
) {
  const nomeEmpresa = empresa?.nome || 'Empresa'
  const safeEmpresa = sanitizeNomeArquivo(nomeEmpresa)
  const dataHoje = new Date().toISOString().slice(0, 10)
  const fileName = `estudo-grupo-despesas-${safeEmpresa}-${exercicioAno || dataHoje}.csv`

  const escapeCsv = (val: any): string => {
    if (val === null || val === undefined) return ''
    const s = String(val)
    if (/[;"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }

  const cabecalhos: string[] = ['Grupo']
  for (const m of resultado.meses) {
    cabecalhos.push(`${m.rotuloCurto} (R$)`)
    cabecalhos.push(`${m.rotuloCurto} (%)`)
  }
  cabecalhos.push('Total Período (R$)')
  cabecalhos.push('Total Período (%)')

  const linhas: string[] = [cabecalhos.map(escapeCsv).join(';')]

  for (const g of resultado.grupos) {
    const linha: string[] = [g.grupo]
    for (const m of resultado.meses) {
      linha.push(formatMoedaCsv(g.valoresPorMes[m.chave] || 0))
      linha.push(formatarPercentualExport(g.percentuaisPorMes[m.chave]))
    }
    linha.push(formatMoedaCsv(g.totalPeriodo))
    linha.push(formatarPercentualExport(g.percentualPeriodo))
    linhas.push(linha.map(escapeCsv).join(';'))
  }

  linhas.push('')

  const linhaTotVar: string[] = ['TOTAL DE DESPESAS VARIÁVEIS']
  for (const m of resultado.meses) {
    linhaTotVar.push(formatMoedaCsv(resultado.totalDespesasVariaveisPorMes[m.chave] || 0))
    linhaTotVar.push(formatarPercentualExport(resultado.percentualTotalVariaveisPorMes[m.chave]))
  }
  linhaTotVar.push(formatMoedaCsv(resultado.totalDespesasVariaveisPeriodo))
  linhaTotVar.push(formatarPercentualExport(resultado.percentualTotalVariaveisPeriodo))
  linhas.push(linhaTotVar.map(escapeCsv).join(';'))

  const linhaTot: string[] = ['TOTAL DE DESPESAS FIXAS']
  for (const m of resultado.meses) {
    linhaTot.push(formatMoedaCsv(resultado.totalDespesasFixasPorMes[m.chave] || 0))
    linhaTot.push(formatarPercentualExport(resultado.percentualTotalPorMes[m.chave]))
  }
  linhaTot.push(formatMoedaCsv(resultado.totalDespesasFixasPeriodo))
  linhaTot.push(formatarPercentualExport(resultado.percentualTotalPeriodo))
  linhas.push(linhaTot.map(escapeCsv).join(';'))

  const linhaFat: string[] = ['FATURAMENTO DO MÊS (RECEITAS)']
  for (const m of resultado.meses) {
    linhaFat.push(formatMoedaCsv(resultado.faturamentoPorMes[m.chave] || 0))
    linhaFat.push('100,00%')
  }
  linhaFat.push(formatMoedaCsv(resultado.faturamentoTotalPeriodo))
  linhaFat.push('100,00%')
  linhas.push(linhaFat.map(escapeCsv).join(';'))

  const linhaPct: string[] = ['% DESPESAS FIXAS / FATURAMENTO']
  for (const m of resultado.meses) {
    linhaPct.push('—')
    linhaPct.push(formatarPercentualExport(resultado.percentualTotalPorMes[m.chave]))
  }
  linhaPct.push('—')
  linhaPct.push(formatarPercentualExport(resultado.percentualTotalPeriodo))
  linhas.push(linhaPct.map(escapeCsv).join(';'))

  const linhaPctVar: string[] = ['% DESPESAS VARIÁVEIS / FATURAMENTO']
  for (const m of resultado.meses) {
    linhaPctVar.push('—')
    linhaPctVar.push(formatarPercentualExport(resultado.percentualTotalVariaveisPorMes[m.chave]))
  }
  linhaPctVar.push('—')
  linhaPctVar.push(formatarPercentualExport(resultado.percentualTotalVariaveisPeriodo))
  linhas.push(linhaPctVar.map(escapeCsv).join(';'))

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
