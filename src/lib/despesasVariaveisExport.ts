import * as XLSX from 'xlsx'
import type { DespesasVariaveisAnaliseResultado } from './despesasVariaveisCalculo'
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
 * Exporta a análise de Despesas Variáveis para planilha Excel (.xlsx)
 * com colunas de Valor e % do Faturamento para cada mês e para o total do período.
 */
export function exportarDespesasVariaveisExcel(
  resultado: DespesasVariaveisAnaliseResultado,
  empresa?: EmpresaRecord | null,
  exercicioAno?: number,
) {
  const nomeEmpresa = empresa?.nome || 'Empresa'
  const safeEmpresa = sanitizeNomeArquivo(nomeEmpresa)
  const dataHoje = new Date().toISOString().slice(0, 10)
  const fileName = `despesas-variaveis-${safeEmpresa}-${exercicioAno || dataHoje}.xlsx`

  const rows: Array<Record<string, any>> = []

  // 1. Linhas de contas de despesas variáveis agrupadas por Centro de Custo
  let ultimoCentroIdOuNome: string | null = null

  for (const c of resultado.contas) {
    const centroAtual =
      c.centroNome?.trim() || (c.centroId ? `Centro ${c.centroId}` : 'Sem Centro de Custo')
    const centroKey = c.centroId || c.centroNome || '__SEM_CENTRO__'

    // Quando o Centro de Custo muda, adiciona UMA linha de cabeçalho de grupo
    if (centroKey !== ultimoCentroIdOuNome) {
      ultimoCentroIdOuNome = centroKey
      const rowGrupo: Record<string, any> = {
        Conta: `▶ CENTRO DE CUSTO: ${centroAtual.toUpperCase()}`,
        'Centro de Custo': centroAtual,
        'Tipo de Despesa': '',
      }
      for (const m of resultado.meses) {
        rowGrupo[`${m.rotuloCurto} (R$)`] = ''
        rowGrupo[`${m.rotuloCurto} (%)`] = ''
      }
      rowGrupo['Total Período (R$)'] = ''
      rowGrupo['Total Período (%)'] = ''
      rows.push(rowGrupo)
    }

    const codStr = c.codigo ? `${c.codigo} — ` : ''
    const row: Record<string, any> = {
      Conta: `    ${codStr}${c.nome}`,
      'Centro de Custo': c.centroNome || '—',
      'Tipo de Despesa': c.tipoDespesaNome || '—',
    }

    for (const m of resultado.meses) {
      const v = c.valoresPorMes[m.chave] || 0
      const pct = c.percentuaisPorMes[m.chave]
      row[`${m.rotuloCurto} (R$)`] = v
      row[`${m.rotuloCurto} (%)`] = formatarPercentualExport(pct)
    }

    row['Total Período (R$)'] = c.totalPeriodo
    row['Total Período (%)'] = formatarPercentualExport(c.percentualPeriodo)

    rows.push(row)
  }

  // Linha em branco separadora
  rows.push({ Conta: '' })

  // 2. Linha TOTAL DE DESPESAS VARIÁVEIS
  const rowTotalDespesas: Record<string, any> = {
    Conta: 'TOTAL DE DESPESAS VARIÁVEIS',
    'Centro de Custo': '',
    'Tipo de Despesa': '',
  }
  for (const m of resultado.meses) {
    const v = resultado.totalDespesasVariaveisPorMes[m.chave] || 0
    const pct = resultado.percentualTotalPorMes[m.chave]
    rowTotalDespesas[`${m.rotuloCurto} (R$)`] = v
    rowTotalDespesas[`${m.rotuloCurto} (%)`] = formatarPercentualExport(pct)
  }
  rowTotalDespesas['Total Período (R$)'] = resultado.totalDespesasVariaveisPeriodo
  rowTotalDespesas['Total Período (%)'] = formatarPercentualExport(resultado.percentualTotalPeriodo)
  rows.push(rowTotalDespesas)

  // 3. Linha FATURAMENTO DO MÊS (RECEITAS DRE)
  const rowFaturamento: Record<string, any> = {
    Conta: 'FATURAMENTO DO MÊS (RECEITAS)',
    'Centro de Custo': '',
    'Tipo de Despesa': '',
  }
  for (const m of resultado.meses) {
    const f = resultado.faturamentoPorMes[m.chave] || 0
    rowFaturamento[`${m.rotuloCurto} (R$)`] = f
    rowFaturamento[`${m.rotuloCurto} (%)`] = '100,00%'
  }
  rowFaturamento['Total Período (R$)'] = resultado.faturamentoTotalPeriodo
  rowFaturamento['Total Período (%)'] = '100,00%'
  rows.push(rowFaturamento)

  // 4. Linha % DESPESAS VARIÁVEIS / FATURAMENTO (INDICADOR CONSOLIDADO)
  const rowIndice: Record<string, any> = {
    Conta: '% DESPESAS VARIÁVEIS / FATURAMENTO',
    'Centro de Custo': '',
    'Tipo de Despesa': '',
  }
  for (const m of resultado.meses) {
    const pct = resultado.percentualTotalPorMes[m.chave]
    rowIndice[`${m.rotuloCurto} (R$)`] = '—'
    rowIndice[`${m.rotuloCurto} (%)`] = formatarPercentualExport(pct)
  }
  rowIndice['Total Período (R$)'] = '—'
  rowIndice['Total Período (%)'] = formatarPercentualExport(resultado.percentualTotalPeriodo)
  rows.push(rowIndice)

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows)

  // Configuração das larguras de colunas
  const cols = [
    { wch: 38 }, // Conta
    { wch: 20 }, // Centro
    { wch: 20 }, // Tipo
  ]
  for (let i = 0; i < resultado.meses.length; i++) {
    cols.push({ wch: 15 }) // R$
    cols.push({ wch: 12 }) // %
  }
  cols.push({ wch: 20 }) // Total R$
  cols.push({ wch: 15 }) // Total %
  ws['!cols'] = cols

  XLSX.utils.book_append_sheet(wb, ws, 'Despesas Variáveis')
  XLSX.writeFile(wb, fileName)
}

/**
 * Exporta a análise de Despesas Variáveis em formato CSV com UTF-8 BOM e delimitador ponto e vírgula
 */
export function exportarDespesasVariaveisCsv(
  resultado: DespesasVariaveisAnaliseResultado,
  empresa?: EmpresaRecord | null,
  exercicioAno?: number,
) {
  const nomeEmpresa = empresa?.nome || 'Empresa'
  const safeEmpresa = sanitizeNomeArquivo(nomeEmpresa)
  const dataHoje = new Date().toISOString().slice(0, 10)
  const fileName = `despesas-variaveis-${safeEmpresa}-${exercicioAno || dataHoje}.csv`

  const escapeCsv = (val: any): string => {
    if (val === null || val === undefined) return ''
    const s = String(val)
    if (/[;"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }

  // Cabeçalho das colunas
  const cabecalhos: string[] = ['Conta', 'Centro de Custo', 'Tipo de Despesa']
  for (const m of resultado.meses) {
    cabecalhos.push(`${m.rotuloCurto} (R$)`)
    cabecalhos.push(`${m.rotuloCurto} (%)`)
  }
  cabecalhos.push('Total Período (R$)')
  cabecalhos.push('Total Período (%)')

  const linhas: string[] = [cabecalhos.map(escapeCsv).join(';')]

  // 1. Linhas de contas agrupadas por Centro de Custo
  let ultimoCentroCsv: string | null = null

  for (const c of resultado.contas) {
    const centroAtual =
      c.centroNome?.trim() || (c.centroId ? `Centro ${c.centroId}` : 'Sem Centro de Custo')
    const centroKey = c.centroId || c.centroNome || '__SEM_CENTRO__'

    // Quando o Centro de Custo muda, adiciona UMA linha de cabeçalho de grupo
    if (centroKey !== ultimoCentroCsv) {
      ultimoCentroCsv = centroKey
      const linhaGrupo: string[] = [
        `▶ CENTRO DE CUSTO: ${centroAtual.toUpperCase()}`,
        centroAtual,
        '',
      ]
      for (let i = 0; i < resultado.meses.length; i++) {
        linhaGrupo.push('')
        linhaGrupo.push('')
      }
      linhaGrupo.push('')
      linhaGrupo.push('')
      linhas.push(linhaGrupo.map(escapeCsv).join(';'))
    }

    const codStr = c.codigo ? `${c.codigo} — ` : ''

    const linha: string[] = [`    ${codStr}${c.nome}`, c.centroNome || '', c.tipoDespesaNome || '']

    for (const m of resultado.meses) {
      linha.push(formatMoedaCsv(c.valoresPorMes[m.chave] || 0))
      linha.push(formatarPercentualExport(c.percentuaisPorMes[m.chave]))
    }

    linha.push(formatMoedaCsv(c.totalPeriodo))
    linha.push(formatarPercentualExport(c.percentualPeriodo))

    linhas.push(linha.map(escapeCsv).join(';'))
  }

  // Linha em branco
  linhas.push('')

  // 2. Linha TOTAL DE DESPESAS VARIÁVEIS
  const linhaTotDesp: string[] = ['TOTAL DE DESPESAS VARIÁVEIS', '', '']
  for (const m of resultado.meses) {
    linhaTotDesp.push(formatMoedaCsv(resultado.totalDespesasVariaveisPorMes[m.chave] || 0))
    linhaTotDesp.push(formatarPercentualExport(resultado.percentualTotalPorMes[m.chave]))
  }
  linhaTotDesp.push(formatMoedaCsv(resultado.totalDespesasVariaveisPeriodo))
  linhaTotDesp.push(formatarPercentualExport(resultado.percentualTotalPeriodo))
  linhas.push(linhaTotDesp.map(escapeCsv).join(';'))

  // 3. Linha FATURAMENTO DO MÊS (RECEITAS)
  const linhaFat: string[] = ['FATURAMENTO DO MÊS (RECEITAS)', '', '']
  for (const m of resultado.meses) {
    linhaFat.push(formatMoedaCsv(resultado.faturamentoPorMes[m.chave] || 0))
    linhaFat.push('100,00%')
  }
  linhaFat.push(formatMoedaCsv(resultado.faturamentoTotalPeriodo))
  linhaFat.push('100,00%')
  linhas.push(linhaFat.map(escapeCsv).join(';'))

  // 4. Linha % DESPESAS VARIÁVEIS / FATURAMENTO
  const linhaPct: string[] = ['% DESPESAS VARIÁVEIS / FATURAMENTO', '', '']
  for (const m of resultado.meses) {
    linhaPct.push('—')
    linhaPct.push(formatarPercentualExport(resultado.percentualTotalPorMes[m.chave]))
  }
  linhaPct.push('—')
  linhaPct.push(formatarPercentualExport(resultado.percentualTotalPeriodo))
  linhas.push(linhaPct.map(escapeCsv).join(';'))

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
