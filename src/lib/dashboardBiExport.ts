/**
 * Exportador de Dashboard BI Gerencial para Excel (.xlsx) e CSV
 */

import * as XLSX from 'xlsx'
import type { EmpresaRecord } from '@/types/finance'
import { sanitizeNomeArquivo } from './exportacaoPlanoContas'

export interface DadosExportacaoDashboardBi {
  periodoRotulo: string
  kpis: {
    faturamento: number
    lucroApurado: number
    margemLiquida: number | null
    despesasFixas: number
    despesasVariaveis: number
    despesasFinanceiras: number
    liquidezCorrente: number | null
  }
  evolucaoMensal: Array<{
    mes: string
    faturamento: number
    despesasTotais: number
    lucroApurado: number
    margemLiquida: number | null
  }>
  centrosCusto: Array<{
    centro: string
    valor: number
    participacao: number
  }>
}

export function exportarDashboardBiExcel(
  dados: DadosExportacaoDashboardBi,
  empresa?: EmpresaRecord | null,
  exercicioAno?: number,
) {
  const nomeEmpresa = empresa?.nome || 'Empresa'
  const safeEmpresa = sanitizeNomeArquivo(nomeEmpresa)
  const dataHoje = new Date().toISOString().slice(0, 10)
  const fileName = `dashboard-bi-executivo-${safeEmpresa}-${exercicioAno || dataHoje}.xlsx`

  const wb = XLSX.utils.book_new()

  // Aba 1: KPIs Consolidados
  const linhasKpis = [
    { Indicador: 'Período Selecionado', Valor: dados.periodoRotulo },
    { Indicador: 'Faturamento Total (Receitas)', Valor: dados.kpis.faturamento },
    { Indicador: 'Lucro Apurado (Resultado)', Valor: dados.kpis.lucroApurado },
    {
      Indicador: 'Margem Líquida (%)',
      Valor: dados.kpis.margemLiquida !== null ? `${dados.kpis.margemLiquida.toFixed(2)}%` : '—',
    },
    { Indicador: 'Despesas Fixas', Valor: dados.kpis.despesasFixas },
    { Indicador: 'Despesas Variáveis', Valor: dados.kpis.despesasVariaveis },
    { Indicador: 'Despesas Financeiras', Valor: dados.kpis.despesasFinanceiras },
    {
      Indicador: 'Liquidez Corrente (Balanço)',
      Valor:
        dados.kpis.liquidezCorrente !== null
          ? `${dados.kpis.liquidezCorrente.toFixed(2)}x`
          : 'Sem balanço',
    },
  ]
  const wsKpis = XLSX.utils.json_to_sheet(linhasKpis)
  wsKpis['!cols'] = [{ wch: 35 }, { wch: 25 }]
  XLSX.utils.book_append_sheet(wb, wsKpis, 'KPIs Executivos')

  // Aba 2: Evolução Mensal
  const linhasEvolucao = dados.evolucaoMensal.map((item) => ({
    Mês: item.mes,
    'Faturamento (R$)': item.faturamento,
    'Despesas Totais (R$)': item.despesasTotais,
    'Lucro Apurado (R$)': item.lucroApurado,
    'Margem Líquida (%)': item.margemLiquida !== null ? `${item.margemLiquida.toFixed(2)}%` : '—',
  }))
  const wsEvolucao = XLSX.utils.json_to_sheet(linhasEvolucao)
  wsEvolucao['!cols'] = [{ wch: 18 }, { wch: 22 }, { wch: 22 }, { wch: 22 }, { wch: 20 }]
  XLSX.utils.book_append_sheet(wb, wsEvolucao, 'Evolução Mensal')

  // Aba 3: Centros de Custo
  if (dados.centrosCusto.length > 0) {
    const linhasCentros = dados.centrosCusto.map((c) => ({
      'Centro de Custo': c.centro,
      'Total de Despesas (R$)': c.valor,
      'Participação (%)': `${c.participacao.toFixed(2)}%`,
    }))
    const wsCentros = XLSX.utils.json_to_sheet(linhasCentros)
    wsCentros['!cols'] = [{ wch: 30 }, { wch: 24 }, { wch: 18 }]
    XLSX.utils.book_append_sheet(wb, wsCentros, 'Centros de Custo')
  }

  XLSX.writeFile(wb, fileName)
}

export function exportarDashboardBiCsv(
  dados: DadosExportacaoDashboardBi,
  empresa?: EmpresaRecord | null,
  exercicioAno?: number,
) {
  const nomeEmpresa = empresa?.nome || 'Empresa'
  const safeEmpresa = sanitizeNomeArquivo(nomeEmpresa)
  const dataHoje = new Date().toISOString().slice(0, 10)
  const fileName = `dashboard-bi-executivo-${safeEmpresa}-${exercicioAno || dataHoje}.csv`

  const escapeCsv = (val: any): string => {
    if (val === null || val === undefined) return ''
    const s = String(val)
    if (/[;"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }

  const linhasCsv: string[] = []
  linhasCsv.push(
    ['Mês', 'Faturamento (R$)', 'Despesas Totais (R$)', 'Lucro Apurado (R$)', 'Margem Líquida (%)']
      .map(escapeCsv)
      .join(';'),
  )

  for (const item of dados.evolucaoMensal) {
    linhasCsv.push(
      [
        item.mes,
        item.faturamento.toFixed(2).replace('.', ','),
        item.despesasTotais.toFixed(2).replace('.', ','),
        item.lucroApurado.toFixed(2).replace('.', ','),
        item.margemLiquida !== null ? `${item.margemLiquida.toFixed(2)}%` : '—',
      ]
        .map(escapeCsv)
        .join(';'),
    )
  }

  const csvContent = '\uFEFF' + linhasCsv.join('\r\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', fileName)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
