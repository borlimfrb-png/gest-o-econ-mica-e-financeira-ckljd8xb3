/**
 * Exportador de Indicadores Financeiros para Excel (.xlsx) e CSV
 */

import * as XLSX from 'xlsx'
import type { PainelIndicadoresResultado } from './indicadoresFinanceirosCalculo'
import type { EmpresaRecord } from '@/types/finance'
import { sanitizeNomeArquivo } from './exportacaoPlanoContas'

export function exportarIndicadoresFinanceirosExcel(
  resultado: PainelIndicadoresResultado,
  empresa?: EmpresaRecord | null,
  exercicioAno?: number,
) {
  const nomeEmpresa = empresa?.nome || 'Empresa'
  const safeEmpresa = sanitizeNomeArquivo(nomeEmpresa)
  const dataHoje = new Date().toISOString().slice(0, 10)
  const fileName = `indicadores-financeiros-${safeEmpresa}-${exercicioAno || dataHoje}.xlsx`

  const wb = XLSX.utils.book_new()

  const linhas = resultado.indicadores.map((ind) => {
    let valorFormatado = 'Sem dados de balanço'
    if (ind.valor !== null && Number.isFinite(ind.valor)) {
      if (ind.unidade === 'percentual') {
        valorFormatado = `${ind.valor.toFixed(2)}%`
      } else if (ind.unidade === 'dias') {
        valorFormatado = `${ind.valor.toFixed(0)} dias`
      } else {
        valorFormatado = `${ind.valor.toFixed(2)}x`
      }
    }

    return {
      Categoria: ind.categoria,
      Indicador: ind.nome,
      Sigla: ind.sigla,
      'Valor Apurado': valorFormatado,
      Status: ind.status,
      Fórmula: ind.formula,
      'Numerador (R$)': ind.detalhesCalculo.numerador.valor,
      'Denominador (R$)': ind.detalhesCalculo.denominador.valor,
      'Significado / Explicação': ind.explicacao,
    }
  })

  const ws = XLSX.utils.json_to_sheet(linhas)
  ws['!cols'] = [
    { wch: 18 }, // Categoria
    { wch: 32 }, // Indicador
    { wch: 10 }, // Sigla
    { wch: 22 }, // Valor
    { wch: 14 }, // Status
    { wch: 45 }, // Formula
    { wch: 18 }, // Numerador
    { wch: 18 }, // Denominador
    { wch: 60 }, // Explicação
  ]

  XLSX.utils.book_append_sheet(wb, ws, 'Indicadores')
  XLSX.writeFile(wb, fileName)
}

export function exportarIndicadoresFinanceirosCsv(
  resultado: PainelIndicadoresResultado,
  empresa?: EmpresaRecord | null,
  exercicioAno?: number,
) {
  const nomeEmpresa = empresa?.nome || 'Empresa'
  const safeEmpresa = sanitizeNomeArquivo(nomeEmpresa)
  const dataHoje = new Date().toISOString().slice(0, 10)
  const fileName = `indicadores-financeiros-${safeEmpresa}-${exercicioAno || dataHoje}.csv`

  const escapeCsv = (val: any): string => {
    if (val === null || val === undefined) return ''
    const s = String(val)
    if (/[;"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }

  const cabecalhos = [
    'Categoria',
    'Indicador',
    'Sigla',
    'Valor Apurado',
    'Status',
    'Fórmula',
    'Numerador (R$)',
    'Denominador (R$)',
    'Explicação',
  ]

  const linhasCsv: string[] = [cabecalhos.map(escapeCsv).join(';')]

  for (const ind of resultado.indicadores) {
    let valorFormatado = 'Sem dados de balanço'
    if (ind.valor !== null && Number.isFinite(ind.valor)) {
      if (ind.unidade === 'percentual') {
        valorFormatado = `${ind.valor.toFixed(2)}%`
      } else if (ind.unidade === 'dias') {
        valorFormatado = `${ind.valor.toFixed(0)} dias`
      } else {
        valorFormatado = `${ind.valor.toFixed(2)}x`
      }
    }

    const linha = [
      ind.categoria,
      ind.nome,
      ind.sigla,
      valorFormatado,
      ind.status,
      ind.formula,
      ind.detalhesCalculo.numerador.valor.toFixed(2).replace('.', ','),
      ind.detalhesCalculo.denominador.valor.toFixed(2).replace('.', ','),
      ind.explicacao,
    ]
    linhasCsv.push(linha.map(escapeCsv).join(';'))
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
