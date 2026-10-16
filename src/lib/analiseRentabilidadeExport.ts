import * as XLSX from 'xlsx'
import type { AnaliseRentabilidadeResultado } from './analiseRentabilidadeCalculo'
import type { EmpresaRecord } from '@/types/finance'
import { sanitizeNomeArquivo } from './exportacaoPlanoContas'

export function formatarPercentualExport(val: number | null | undefined): string {
  if (val === null || val === undefined || !Number.isFinite(val)) {
    return '—'
  }
  return `${val.toFixed(2)}%`
}

function formatMoedaCsv(v: number | undefined | null): string {
  if (v === undefined || v === null || !Number.isFinite(v)) return '0,00'
  return v.toFixed(2).replace('.', ',')
}

/**
 * Exporta a Análise de Rentabilidade para planilha Excel (.xlsx)
 */
export function exportarAnaliseRentabilidadeExcel(
  resultado: AnaliseRentabilidadeResultado,
  empresa?: EmpresaRecord | null,
  exercicioAno?: number,
) {
  const nomeEmpresa = empresa?.nome || 'Empresa'
  const safeEmpresa = sanitizeNomeArquivo(nomeEmpresa)
  const dataHoje = new Date().toISOString().slice(0, 10)
  const fileName = `analise-rentabilidade-${safeEmpresa}-${exercicioAno || dataHoje}.xlsx`

  const rows: Array<Record<string, any>> = []

  // 1. Linhas por mês
  for (const item of resultado.itensPorMes) {
    rows.push({
      Mês: item.rotuloCompleto,
      'Faturamento (Receita DRE)': item.faturamento,
      'Despesas Variáveis': item.despesasVariaveis,
      'Despesas Fixas': item.despesasFixas,
      'Resultado Financeiro': item.resultadoFinanceiro,
      'Lucro Apurado (Resultado)': item.lucroApurado,
      'Margem Bruta (%)': formatarPercentualExport(item.margemBruta),
      'Margem Operacional (%)': formatarPercentualExport(item.margemOperacional),
      'Margem Líquida s/ Faturamento (%)': formatarPercentualExport(item.margemSobreFaturamento),
    })
  }

  // Linha em branco
  rows.push({
    Mês: '',
    'Faturamento (Receita DRE)': '',
    'Despesas Variáveis': '',
    'Despesas Fixas': '',
    'Resultado Financeiro': '',
    'Lucro Apurado (Resultado)': '',
    'Margem Bruta (%)': '',
    'Margem Operacional (%)': '',
    'Margem Líquida s/ Faturamento (%)': '',
  })

  // Linha de Totais Consolidados
  rows.push({
    Mês: 'TOTAL DO PERÍODO',
    'Faturamento (Receita DRE)': resultado.faturamentoTotal,
    'Despesas Variáveis': resultado.despesasVariaveisTotal,
    'Despesas Fixas': resultado.despesasFixasTotal,
    'Resultado Financeiro': resultado.resultadoFinanceiroTotal,
    'Lucro Apurado (Resultado)': resultado.lucroTotal,
    'Margem Bruta (%)': formatarPercentualExport(resultado.margemBrutaTotal),
    'Margem Operacional (%)': formatarPercentualExport(resultado.margemOperacionalTotal),
    'Margem Líquida s/ Faturamento (%)': formatarPercentualExport(
      resultado.margemSobreFaturamentoTotal,
    ),
  })

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows)

  ws['!cols'] = [
    { wch: 22 }, // Mês
    { wch: 26 }, // Faturamento
    { wch: 20 }, // Desp Var
    { wch: 18 }, // Desp Fix
    { wch: 20 }, // Res Fin
    { wch: 26 }, // Lucro Apurado
    { wch: 18 }, // Margem Bruta
    { wch: 22 }, // Margem Operacional
    { wch: 32 }, // Margem s/ Faturamento
  ]

  XLSX.utils.book_append_sheet(wb, ws, 'Rentabilidade DRE')
  XLSX.writeFile(wb, fileName)
}

/**
 * Exporta a Análise de Rentabilidade em formato CSV delimitado por ponto e vírgula com UTF-8 BOM
 */
export function exportarAnaliseRentabilidadeCsv(
  resultado: AnaliseRentabilidadeResultado,
  empresa?: EmpresaRecord | null,
  exercicioAno?: number,
) {
  const nomeEmpresa = empresa?.nome || 'Empresa'
  const safeEmpresa = sanitizeNomeArquivo(nomeEmpresa)
  const dataHoje = new Date().toISOString().slice(0, 10)
  const fileName = `analise-rentabilidade-${safeEmpresa}-${exercicioAno || dataHoje}.csv`

  const escapeCsv = (val: any): string => {
    if (val === null || val === undefined) return ''
    const s = String(val)
    if (/[;"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }

  const cabecalhos = [
    'Mês',
    'Faturamento (R$)',
    'Despesas Variáveis (R$)',
    'Despesas Fixas (R$)',
    'Resultado Financeiro (R$)',
    'Lucro Apurado (R$)',
    'Margem Bruta (%)',
    'Margem Operacional (%)',
    'Margem s/ Faturamento (%)',
  ]

  const linhas: string[] = [cabecalhos.map(escapeCsv).join(';')]

  for (const item of resultado.itensPorMes) {
    linhas.push(
      [
        item.rotuloCompleto,
        formatMoedaCsv(item.faturamento),
        formatMoedaCsv(item.despesasVariaveis),
        formatMoedaCsv(item.despesasFixas),
        formatMoedaCsv(item.resultadoFinanceiro),
        formatMoedaCsv(item.lucroApurado),
        formatarPercentualExport(item.margemBruta),
        formatarPercentualExport(item.margemOperacional),
        formatarPercentualExport(item.margemSobreFaturamento),
      ]
        .map(escapeCsv)
        .join(';'),
    )
  }

  linhas.push('')

  linhas.push(
    [
      'TOTAL DO PERÍODO',
      formatMoedaCsv(resultado.faturamentoTotal),
      formatMoedaCsv(resultado.despesasVariaveisTotal),
      formatMoedaCsv(resultado.despesasFixasTotal),
      formatMoedaCsv(resultado.resultadoFinanceiroTotal),
      formatMoedaCsv(resultado.lucroTotal),
      formatarPercentualExport(resultado.margemBrutaTotal),
      formatarPercentualExport(resultado.margemOperacionalTotal),
      formatarPercentualExport(resultado.margemSobreFaturamentoTotal),
    ]
      .map(escapeCsv)
      .join(';'),
  )

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
