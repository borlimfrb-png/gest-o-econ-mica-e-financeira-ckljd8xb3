import * as XLSX from 'xlsx'
import type { ComparativoDespesasResultado } from './comparativoDespesasCalculo'
import type { EmpresaRecord } from '@/types/finance'
import { sanitizeNomeArquivo } from './exportacaoPlanoContas'

/**
 * Formata percentual para exibição textual em planilhas e relatórios
 */
export function formatarPercentualExport(val: number | null | undefined): string {
  if (val === null || val === undefined || !Number.isFinite(val)) {
    return '—'
  }
  return `${val.toFixed(2)}%`
}

/**
 * Formata moeda BRL para exibição em CSV
 */
function formatMoedaCsv(v: number | undefined | null): string {
  if (v === undefined || v === null || !Number.isFinite(v)) return '0,00'
  return v.toFixed(2).replace('.', ',')
}

/**
 * Exporta o comparativo Fixas × Variáveis para planilha Excel (.xlsx)
 * com linhas de Fixas, Variáveis, Faturamento, Totais e contas detalhadas.
 */
export function exportarComparativoDespesasExcel(
  resultado: ComparativoDespesasResultado,
  empresa?: EmpresaRecord | null,
  exercicioAno?: number,
) {
  const nomeEmpresa = empresa?.nome || 'Empresa'
  const safeEmpresa = sanitizeNomeArquivo(nomeEmpresa)
  const dataHoje = new Date().toISOString().slice(0, 10)
  const fileName = `comparativo-fixas-vs-variaveis-${safeEmpresa}-${exercicioAno || dataHoje}.xlsx`

  const rows: Array<Record<string, any>> = []

  // 1. Resumo Executivo
  const rowFixas: Record<string, any> = {
    Grupo: 'TOTAL DESPESAS FIXAS',
    Conta: 'Soma das Despesas Fixas',
    'Centro de Custo': '',
    'Tipo de Despesa': '',
  }
  for (const m of resultado.meses) {
    rowFixas[`${m.rotuloCurto} (R$)`] = resultado.totalFixasPorMes[m.chave] || 0
    rowFixas[`${m.rotuloCurto} (% Fat)`] = formatarPercentualExport(
      resultado.pctFixasPorMes[m.chave],
    )
  }
  rowFixas['Total Período (R$)'] = resultado.totalFixasPeriodo
  rowFixas['Total Período (% Fat)'] = formatarPercentualExport(resultado.pctFixasPeriodo)
  rows.push(rowFixas)

  const rowVar: Record<string, any> = {
    Grupo: 'TOTAL DESPESAS VARIÁVEIS',
    Conta: 'Soma das Despesas Variáveis',
    'Centro de Custo': '',
    'Tipo de Despesa': '',
  }
  for (const m of resultado.meses) {
    rowVar[`${m.rotuloCurto} (R$)`] = resultado.totalVariaveisPorMes[m.chave] || 0
    rowVar[`${m.rotuloCurto} (% Fat)`] = formatarPercentualExport(
      resultado.pctVariaveisPorMes[m.chave],
    )
  }
  rowVar['Total Período (R$)'] = resultado.totalVariaveisPeriodo
  rowVar['Total Período (% Fat)'] = formatarPercentualExport(resultado.pctVariaveisPeriodo)
  rows.push(rowVar)

  const rowTotDesp: Record<string, any> = {
    Grupo: 'TOTAL GERAL DESPESAS (FIXAS + VARIÁVEIS)',
    Conta: 'Soma de Todas as Despesas',
    'Centro de Custo': '',
    'Tipo de Despesa': '',
  }
  for (const m of resultado.meses) {
    rowTotDesp[`${m.rotuloCurto} (R$)`] = resultado.totalDespesasPorMes[m.chave] || 0
    rowTotDesp[`${m.rotuloCurto} (% Fat)`] = formatarPercentualExport(
      resultado.pctTotalPorMes[m.chave],
    )
  }
  rowTotDesp['Total Período (R$)'] = resultado.totalDespesasPeriodo
  rowTotDesp['Total Período (% Fat)'] = formatarPercentualExport(resultado.pctTotalPeriodo)
  rows.push(rowTotDesp)

  const rowFat: Record<string, any> = {
    Grupo: 'FATURAMENTO DO MÊS (RECEITAS DRE)',
    Conta: 'Base de Cálculo 100%',
    'Centro de Custo': '',
    'Tipo de Despesa': '',
  }
  for (const m of resultado.meses) {
    rowFat[`${m.rotuloCurto} (R$)`] = resultado.faturamentoPorMes[m.chave] || 0
    rowFat[`${m.rotuloCurto} (% Fat)`] = '100,00%'
  }
  rowFat['Total Período (R$)'] = resultado.faturamentoTotalPeriodo
  rowFat['Total Período (% Fat)'] = '100,00%'
  rows.push(rowFat)

  // Separador
  rows.push({ Grupo: '' })

  // 2. Detalhamento das Contas Fixas
  if (resultado.contasFixas.length > 0) {
    rows.push({ Grupo: '--- CONTAS DE DESPESAS FIXAS ---' })
    for (const c of resultado.contasFixas) {
      const centroStr = c.centroNome ? `[${c.centroNome}] ` : ''
      const tipoStr = c.tipoDespesaNome ? `[${c.tipoDespesaNome}] ` : ''
      const codStr = c.codigo ? `${c.codigo} — ` : ''
      const row: Record<string, any> = {
        Grupo: 'Despesa Fixa',
        Conta: `${centroStr}${tipoStr}${codStr}${c.nome}`,
        'Centro de Custo': c.centroNome || '—',
        'Tipo de Despesa': c.tipoDespesaNome || '—',
      }
      for (const m of resultado.meses) {
        row[`${m.rotuloCurto} (R$)`] = c.valoresPorMes[m.chave] || 0
        row[`${m.rotuloCurto} (% Fat)`] = formatarPercentualExport(c.percentuaisPorMes[m.chave])
      }
      row['Total Período (R$)'] = c.totalPeriodo
      row['Total Período (% Fat)'] = formatarPercentualExport(c.percentualPeriodo)
      rows.push(row)
    }
  }

  // Separador
  rows.push({ Grupo: '' })

  // 3. Detalhamento das Contas Variáveis
  if (resultado.contasVariaveis.length > 0) {
    rows.push({ Grupo: '--- CONTAS DE DESPESAS VARIÁVEIS ---' })
    for (const c of resultado.contasVariaveis) {
      const centroStr = c.centroNome ? `[${c.centroNome}] ` : ''
      const tipoStr = c.tipoDespesaNome ? `[${c.tipoDespesaNome}] ` : ''
      const codStr = c.codigo ? `${c.codigo} — ` : ''
      const row: Record<string, any> = {
        Grupo: 'Despesa Variável',
        Conta: `${centroStr}${tipoStr}${codStr}${c.nome}`,
        'Centro de Custo': c.centroNome || '—',
        'Tipo de Despesa': c.tipoDespesaNome || '—',
      }
      for (const m of resultado.meses) {
        row[`${m.rotuloCurto} (R$)`] = c.valoresPorMes[m.chave] || 0
        row[`${m.rotuloCurto} (% Fat)`] = formatarPercentualExport(c.percentuaisPorMes[m.chave])
      }
      row['Total Período (R$)'] = c.totalPeriodo
      row['Total Período (% Fat)'] = formatarPercentualExport(c.percentualPeriodo)
      rows.push(row)
    }
  }

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows)

  const cols = [
    { wch: 32 }, // Grupo
    { wch: 38 }, // Conta
    { wch: 18 }, // Centro
    { wch: 18 }, // Tipo
  ]
  for (let i = 0; i < resultado.meses.length; i++) {
    cols.push({ wch: 14 }) // R$
    cols.push({ wch: 12 }) // %
  }
  cols.push({ wch: 18 }) // Total R$
  cols.push({ wch: 15 }) // Total %
  ws['!cols'] = cols

  XLSX.utils.book_append_sheet(wb, ws, 'Comparativo Fixas x Variáveis')
  XLSX.writeFile(wb, fileName)
}

/**
 * Exporta o comparativo Fixas × Variáveis em formato CSV (; delimitador, UTF-8 BOM)
 */
export function exportarComparativoDespesasCsv(
  resultado: ComparativoDespesasResultado,
  empresa?: EmpresaRecord | null,
  exercicioAno?: number,
) {
  const nomeEmpresa = empresa?.nome || 'Empresa'
  const safeEmpresa = sanitizeNomeArquivo(nomeEmpresa)
  const dataHoje = new Date().toISOString().slice(0, 10)
  const fileName = `comparativo-fixas-vs-variaveis-${safeEmpresa}-${exercicioAno || dataHoje}.csv`

  const escapeCsv = (val: any): string => {
    if (val === null || val === undefined) return ''
    const s = String(val)
    if (/[;"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }

  const cabecalhos: string[] = ['Grupo', 'Conta', 'Centro de Custo', 'Tipo de Despesa']
  for (const m of resultado.meses) {
    cabecalhos.push(`${m.rotuloCurto} (R$)`)
    cabecalhos.push(`${m.rotuloCurto} (% Fat)`)
  }
  cabecalhos.push('Total Período (R$)')
  cabecalhos.push('Total Período (% Fat)')

  const linhas: string[] = [cabecalhos.map(escapeCsv).join(';')]

  // 1. Linhas de Totais Gerais
  // Despesas Fixas
  const lFixas: string[] = ['TOTAL DESPESAS FIXAS', 'Soma das Despesas Fixas', '', '']
  for (const m of resultado.meses) {
    lFixas.push(formatMoedaCsv(resultado.totalFixasPorMes[m.chave] || 0))
    lFixas.push(formatarPercentualExport(resultado.pctFixasPorMes[m.chave]))
  }
  lFixas.push(formatMoedaCsv(resultado.totalFixasPeriodo))
  lFixas.push(formatarPercentualExport(resultado.pctFixasPeriodo))
  linhas.push(lFixas.map(escapeCsv).join(';'))

  // Despesas Variáveis
  const lVar: string[] = ['TOTAL DESPESAS VARIÁVEIS', 'Soma das Despesas Variáveis', '', '']
  for (const m of resultado.meses) {
    lVar.push(formatMoedaCsv(resultado.totalVariaveisPorMes[m.chave] || 0))
    lVar.push(formatarPercentualExport(resultado.pctVariaveisPorMes[m.chave]))
  }
  lVar.push(formatMoedaCsv(resultado.totalVariaveisPeriodo))
  lVar.push(formatarPercentualExport(resultado.pctVariaveisPeriodo))
  linhas.push(lVar.map(escapeCsv).join(';'))

  // Total Geral Despesas
  const lTot: string[] = ['TOTAL GERAL DESPESAS', 'Soma Geral (Fixas + Variáveis)', '', '']
  for (const m of resultado.meses) {
    lTot.push(formatMoedaCsv(resultado.totalDespesasPorMes[m.chave] || 0))
    lTot.push(formatarPercentualExport(resultado.pctTotalPorMes[m.chave]))
  }
  lTot.push(formatMoedaCsv(resultado.totalDespesasPeriodo))
  lTot.push(formatarPercentualExport(resultado.pctTotalPeriodo))
  linhas.push(lTot.map(escapeCsv).join(';'))

  // Faturamento
  const lFat: string[] = ['FATURAMENTO DO MÊS (RECEITAS)', 'Base 100%', '', '']
  for (const m of resultado.meses) {
    lFat.push(formatMoedaCsv(resultado.faturamentoPorMes[m.chave] || 0))
    lFat.push('100,00%')
  }
  lFat.push(formatMoedaCsv(resultado.faturamentoTotalPeriodo))
  lFat.push('100,00%')
  linhas.push(lFat.map(escapeCsv).join(';'))

  linhas.push('')

  // 2. Contas Fixas
  for (const c of resultado.contasFixas) {
    const lConta: string[] = ['Despesa Fixa', c.nome, c.centroNome || '', c.tipoDespesaNome || '']
    for (const m of resultado.meses) {
      lConta.push(formatMoedaCsv(c.valoresPorMes[m.chave] || 0))
      lConta.push(formatarPercentualExport(c.percentuaisPorMes[m.chave]))
    }
    lConta.push(formatMoedaCsv(c.totalPeriodo))
    lConta.push(formatarPercentualExport(c.percentualPeriodo))
    linhas.push(lConta.map(escapeCsv).join(';'))
  }

  // 3. Contas Variáveis
  for (const c of resultado.contasVariaveis) {
    const lConta: string[] = [
      'Despesa Variável',
      c.nome,
      c.centroNome || '',
      c.tipoDespesaNome || '',
    ]
    for (const m of resultado.meses) {
      lConta.push(formatMoedaCsv(c.valoresPorMes[m.chave] || 0))
      lConta.push(formatarPercentualExport(c.percentuaisPorMes[m.chave]))
    }
    lConta.push(formatMoedaCsv(c.totalPeriodo))
    lConta.push(formatarPercentualExport(c.percentualPeriodo))
    linhas.push(lConta.map(escapeCsv).join(';'))
  }

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
