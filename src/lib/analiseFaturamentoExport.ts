import * as XLSX from 'xlsx'
import type { AnaliseFaturamentoResultado } from './analiseFaturamentoCalculo'
import { MESES_ROTULOS } from './analiseFaturamentoCalculo'
import type { EmpresaRecord } from '@/types/finance'
import { sanitizeNomeArquivo } from './exportacaoPlanoContas'

/**
 * Formata percentual para exibição textual em planilhas e relatórios
 */
export function formatarPercentualExport(
  val: number | null | undefined,
  opcoes?: { incluirSinal?: boolean },
): string {
  if (val === null || val === undefined || !Number.isFinite(val)) {
    return '—'
  }
  const prefixo = opcoes?.incluirSinal && val > 0 ? '+' : ''
  return `${prefixo}${val.toFixed(2)}%`
}

/**
 * Formata moeda BRL para exibição em CSV
 */
function formatMoedaCsv(v: number | undefined | null): string {
  if (v === undefined || v === null || !Number.isFinite(v)) return '0,00'
  return v.toFixed(2).replace('.', ',')
}

/**
 * Exporta a Análise de Faturamento para planilha Excel (.xlsx)
 * com colunas: Ano, Jan a Dez, Total do Ano, % Participação no Acumulado, Variação YoY (%)
 * e linha final de Total Geral com 100% de participação.
 */
export function exportarAnaliseFaturamentoExcel(
  resultado: AnaliseFaturamentoResultado,
  empresa?: EmpresaRecord | null,
) {
  const nomeEmpresa = empresa?.nome || 'Empresa'
  const safeEmpresa = sanitizeNomeArquivo(nomeEmpresa)
  const dataHoje = new Date().toISOString().slice(0, 10)
  const fileName = `analise-faturamento-anual-${safeEmpresa}-${dataHoje}.xlsx`

  const rows: Array<Record<string, any>> = []

  // Linhas por ano
  for (const l of resultado.linhasPorAno) {
    const row: Record<string, any> = {
      Ano: l.ano,
    }

    for (const m of MESES_ROTULOS) {
      const val = l.valoresPorMes[m.mes] || 0
      row[`${m.sigla} (R$)`] = val > 0 || l.mesesComDados[m.mes] ? val : '—'
    }

    row['Total Ano (R$)'] = l.totalAno
    row['% Participação Acumulada'] = formatarPercentualExport(l.participacaoAcumulado)
    row['Variação YoY (%)'] = formatarPercentualExport(l.variacaoYoY, { incluirSinal: true })

    rows.push(row)
  }

  // Linha separadora
  rows.push({ Ano: '' })

  // Linha de TOTAL GERAL
  const rowTotal: Record<string, any> = {
    Ano: 'TOTAL GERAL (TODOS OS ANOS)',
  }
  for (const m of MESES_ROTULOS) {
    rowTotal[`${m.sigla} (R$)`] = resultado.totalGeralPorMes[m.mes] || 0
  }
  rowTotal['Total Ano (R$)'] = resultado.totalGeralTodosAnos
  rowTotal['% Participação Acumulada'] = resultado.totalGeralTodosAnos > 0 ? '100,00%' : '—'
  rowTotal['Variação YoY (%)'] = '—'
  rows.push(rowTotal)

  // Linha de MÉDIA ANUAL
  const rowMedia: Record<string, any> = {
    Ano: 'MÉDIA ANUAL HISTÓRICA',
  }
  for (const m of MESES_ROTULOS) {
    const qtdAnos = resultado.linhasPorAno.length || 1
    rowMedia[`${m.sigla} (R$)`] = (resultado.totalGeralPorMes[m.mes] || 0) / qtdAnos
  }
  rowMedia['Total Ano (R$)'] = resultado.mediaAnualFaturamento
  rowMedia['% Participação Acumulada'] = '—'
  rowMedia['Variação YoY (%)'] = '—'
  rows.push(rowMedia)

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows)

  // Configuração das larguras de colunas
  const cols = [{ wch: 28 }] // Ano / Descrição
  for (let i = 0; i < 12; i++) {
    cols.push({ wch: 14 }) // R$ por mês
  }
  cols.push({ wch: 18 }) // Total Ano
  cols.push({ wch: 22 }) // % Participação
  cols.push({ wch: 16 }) // Variação YoY
  ws['!cols'] = cols

  XLSX.utils.book_append_sheet(wb, ws, 'Análise de Faturamento')
  XLSX.writeFile(wb, fileName)
}

/**
 * Exporta a Análise de Faturamento em formato CSV com UTF-8 BOM e delimitador ponto e vírgula (;)
 */
export function exportarAnaliseFaturamentoCsv(
  resultado: AnaliseFaturamentoResultado,
  empresa?: EmpresaRecord | null,
) {
  const nomeEmpresa = empresa?.nome || 'Empresa'
  const safeEmpresa = sanitizeNomeArquivo(nomeEmpresa)
  const dataHoje = new Date().toISOString().slice(0, 10)
  const fileName = `analise-faturamento-anual-${safeEmpresa}-${dataHoje}.csv`

  const escapeCsv = (val: any): string => {
    if (val === null || val === undefined) return ''
    const s = String(val)
    if (/[;"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }

  // Cabeçalhos
  const cabecalhos: string[] = ['Ano']
  for (const m of MESES_ROTULOS) {
    cabecalhos.push(`${m.sigla} (R$)`)
  }
  cabecalhos.push('Total Ano (R$)')
  cabecalhos.push('% Participação Acumulada')
  cabecalhos.push('Variação YoY (%)')

  const linhas: string[] = [cabecalhos.map(escapeCsv).join(';')]

  // 1. Linhas por ano
  for (const l of resultado.linhasPorAno) {
    const linha: string[] = [String(l.ano)]

    for (const m of MESES_ROTULOS) {
      const v = l.valoresPorMes[m.mes] || 0
      if (v > 0 || l.mesesComDados[m.mes]) {
        linha.push(formatMoedaCsv(v))
      } else {
        linha.push('—')
      }
    }

    linha.push(formatMoedaCsv(l.totalAno))
    linha.push(formatarPercentualExport(l.participacaoAcumulado))
    linha.push(formatarPercentualExport(l.variacaoYoY, { incluirSinal: true }))

    linhas.push(linha.map(escapeCsv).join(';'))
  }

  // Linha em branco
  linhas.push('')

  // 2. Linha TOTAL GERAL
  const linhaTotal: string[] = ['TOTAL GERAL (TODOS OS ANOS)']
  for (const m of MESES_ROTULOS) {
    linhaTotal.push(formatMoedaCsv(resultado.totalGeralPorMes[m.mes] || 0))
  }
  linhaTotal.push(formatMoedaCsv(resultado.totalGeralTodosAnos))
  linhaTotal.push(resultado.totalGeralTodosAnos > 0 ? '100,00%' : '—')
  linhaTotal.push('—')
  linhas.push(linhaTotal.map(escapeCsv).join(';'))

  // 3. Linha MÉDIA ANUAL
  const qtdAnos = resultado.linhasPorAno.length || 1
  const linhaMedia: string[] = ['MÉDIA ANUAL HISTÓRICA']
  for (const m of MESES_ROTULOS) {
    linhaMedia.push(formatMoedaCsv((resultado.totalGeralPorMes[m.mes] || 0) / qtdAnos))
  }
  linhaMedia.push(formatMoedaCsv(resultado.mediaAnualFaturamento))
  linhaMedia.push('—')
  linhaMedia.push('—')
  linhas.push(linhaMedia.map(escapeCsv).join(';'))

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
