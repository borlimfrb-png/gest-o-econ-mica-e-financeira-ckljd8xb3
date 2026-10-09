import * as XLSX from 'xlsx'
import type { ResultadoSimuladorCrescimento } from './indicadorCrescimentoCalculo'
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
 * Exporta a análise e simulação de crescimento para planilha Excel (.xlsx)
 */
export function exportarIndicadorCrescimentoExcel(
  resultado: ResultadoSimuladorCrescimento,
  empresa?: EmpresaRecord | null,
  periodoDescricao?: string,
) {
  const nomeEmpresa = empresa?.nome || 'Empresa'
  const safeEmpresa = sanitizeNomeArquivo(nomeEmpresa)
  const dataHoje = new Date().toISOString().slice(0, 10)
  const fileName = `indicador-crescimento-${safeEmpresa}-${dataHoje}.xlsx`

  const rows: Array<Record<string, any>> = []

  // Bloco 1: Cabeçalho com Parâmetros de Simulação
  rows.push({
    Item: 'INDICADOR DE CRESCIMENTO — SIMULAÇÃO DRE',
    'Cenário Base (R$)': '',
    'Simulado (R$)': '',
    'Delta R$': '',
    'Delta %': '',
  })
  rows.push({
    Item: `Empresa: ${nomeEmpresa} | Período: ${periodoDescricao || 'Período Selecionado'}`,
    'Cenário Base (R$)': '',
    'Simulado (R$)': '',
    'Delta R$': '',
    'Delta %': '',
  })
  rows.push({
    Item: `Parâmetros: Faturamento (${resultado.parametros.percentualCrescimentoFaturamento >= 0 ? '+' : ''}${resultado.parametros.percentualCrescimentoFaturamento}%) | Variáveis: ${
      resultado.parametros.modoDespesasVariaveis === 'proporcional'
        ? 'Proporcionais'
        : `${resultado.parametros.percentualCrescimentoVariaveis || 0}%`
    } | Fixas: ${
      resultado.parametros.modoDespesasFixas === 'manter'
        ? 'Mantidas'
        : `${resultado.parametros.percentualCrescimentoFixas || 0}%`
    }`,
    'Cenário Base (R$)': '',
    'Simulado (R$)': '',
    'Delta R$': '',
    'Delta %': '',
  })
  rows.push({ Item: '' })

  // Bloco 2: Linhas Principais de Demonstração
  const itens = [
    resultado.comparativo.faturamento,
    resultado.comparativo.despesasVariaveis,
    resultado.comparativo.despesasFixas,
    resultado.comparativo.despesasFinanceiras,
    resultado.comparativo.totalDespesas,
    resultado.comparativo.lucroPrejuizo,
  ]

  for (const it of itens) {
    const deltaStr =
      it.deltaPercentual !== null
        ? `${it.deltaPercentual >= 0 ? '+' : ''}${it.deltaPercentual.toFixed(2)}%`
        : '—'

    rows.push({
      Item: it.label,
      'Cenário Base (R$)': it.base,
      'Simulado (R$)': it.simulado,
      'Delta R$': it.deltaAbsoluto,
      'Delta %': deltaStr,
    })
  }

  rows.push({ Item: '' })

  // Bloco 3: Indicadores Derivados e Ponto de Equilíbrio
  rows.push({
    Item: 'Margem Líquida (%)',
    'Cenário Base (R$)': formatarPercentualExport(resultado.comparativo.margemLiquidaPct.base),
    'Simulado (R$)': formatarPercentualExport(resultado.comparativo.margemLiquidaPct.simulado),
    'Delta R$': '—',
    'Delta %':
      resultado.comparativo.margemLiquidaPct.deltaPontosPercentuais !== null
        ? `${resultado.comparativo.margemLiquidaPct.deltaPontosPercentuais >= 0 ? '+' : ''}${resultado.comparativo.margemLiquidaPct.deltaPontosPercentuais.toFixed(2)} p.p.`
        : '—',
  })

  rows.push({
    Item: 'Margem de Contribuição (%)',
    'Cenário Base (R$)': formatarPercentualExport(resultado.cenarioBase.margemContribuicaoPct),
    'Simulado (R$)': formatarPercentualExport(resultado.cenarioSimulado.margemContribuicaoPct),
    'Delta R$': '—',
    'Delta %': '—',
  })

  rows.push({
    Item: 'Ponto de Equilíbrio (R$)',
    'Cenário Base (R$)': '—',
    'Simulado (R$)': resultado.cenarioSimulado.pontoEquilibrioReais ?? '—',
    'Delta R$': '—',
    'Delta %': '—',
  })

  rows.push({
    Item: 'Margem de Segurança / Queda Suportada (%)',
    'Cenário Base (R$)': '—',
    'Simulado (R$)': formatarPercentualExport(resultado.cenarioSimulado.margemSegurancaPct),
    'Delta R$': '—',
    'Delta %': '—',
  })

  rows.push({ Item: '' })
  rows.push({
    Item: `Resumo Executivo: ${resultado.resumoExecutivo}`,
    'Cenário Base (R$)': '',
    'Simulado (R$)': '',
    'Delta R$': '',
    'Delta %': '',
  })

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows)

  ws['!cols'] = [
    { wch: 45 }, // Item
    { wch: 20 }, // Base
    { wch: 20 }, // Simulado
    { wch: 18 }, // Delta R$
    { wch: 15 }, // Delta %
  ]

  XLSX.utils.book_append_sheet(wb, ws, 'Indicador Crescimento')
  XLSX.writeFile(wb, fileName)
}

/**
 * Exporta a análise e simulação de crescimento em formato CSV com UTF-8 BOM e ';'
 */
export function exportarIndicadorCrescimentoCsv(
  resultado: ResultadoSimuladorCrescimento,
  empresa?: EmpresaRecord | null,
  periodoDescricao?: string,
) {
  const nomeEmpresa = empresa?.nome || 'Empresa'
  const safeEmpresa = sanitizeNomeArquivo(nomeEmpresa)
  const dataHoje = new Date().toISOString().slice(0, 10)
  const fileName = `indicador-crescimento-${safeEmpresa}-${dataHoje}.csv`

  const escapeCsv = (val: any): string => {
    if (val === null || val === undefined) return ''
    const s = String(val)
    if (/[;"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }

  const linhas: string[] = []

  linhas.push(['INDICADOR DE CRESCIMENTO — SIMULAÇÃO DRE', '', '', '', ''].map(escapeCsv).join(';'))
  linhas.push(
    [`Empresa: ${nomeEmpresa} | Período: ${periodoDescricao || 'Período Selecionado'}`]
      .map(escapeCsv)
      .join(';'),
  )
  linhas.push('')

  const cabecalhos = [
    'Demonstração',
    'Cenário Base (R$)',
    'Simulado (R$)',
    'Delta (R$)',
    'Delta (%)',
  ]
  linhas.push(cabecalhos.map(escapeCsv).join(';'))

  const itens = [
    resultado.comparativo.faturamento,
    resultado.comparativo.despesasVariaveis,
    resultado.comparativo.despesasFixas,
    resultado.comparativo.despesasFinanceiras,
    resultado.comparativo.totalDespesas,
    resultado.comparativo.lucroPrejuizo,
  ]

  for (const it of itens) {
    const deltaStr =
      it.deltaPercentual !== null
        ? `${it.deltaPercentual >= 0 ? '+' : ''}${it.deltaPercentual.toFixed(2)}%`
        : '—'

    linhas.push(
      [
        it.label,
        formatMoedaCsv(it.base),
        formatMoedaCsv(it.simulado),
        formatMoedaCsv(it.deltaAbsoluto),
        deltaStr,
      ]
        .map(escapeCsv)
        .join(';'),
    )
  }

  linhas.push('')
  linhas.push(['Indicadores Estratégicos', '', '', '', ''].map(escapeCsv).join(';'))

  linhas.push(
    [
      'Margem Líquida (%)',
      formatarPercentualExport(resultado.comparativo.margemLiquidaPct.base),
      formatarPercentualExport(resultado.comparativo.margemLiquidaPct.simulado),
      '—',
      resultado.comparativo.margemLiquidaPct.deltaPontosPercentuais !== null
        ? `${resultado.comparativo.margemLiquidaPct.deltaPontosPercentuais >= 0 ? '+' : ''}${resultado.comparativo.margemLiquidaPct.deltaPontosPercentuais.toFixed(2)} p.p.`
        : '—',
    ]
      .map(escapeCsv)
      .join(';'),
  )

  linhas.push(
    [
      'Margem de Contribuição (%)',
      formatarPercentualExport(resultado.cenarioBase.margemContribuicaoPct),
      formatarPercentualExport(resultado.cenarioSimulado.margemContribuicaoPct),
      '—',
      '—',
    ]
      .map(escapeCsv)
      .join(';'),
  )

  linhas.push(
    [
      'Ponto de Equilíbrio (R$)',
      '—',
      resultado.cenarioSimulado.pontoEquilibrioReais !== null
        ? formatMoedaCsv(resultado.cenarioSimulado.pontoEquilibrioReais)
        : '—',
      '—',
      '—',
    ]
      .map(escapeCsv)
      .join(';'),
  )

  linhas.push(
    [
      'Margem de Segurança / Queda Suportada (%)',
      '—',
      formatarPercentualExport(resultado.cenarioSimulado.margemSegurancaPct),
      '—',
      '—',
    ]
      .map(escapeCsv)
      .join(';'),
  )

  linhas.push('')
  linhas.push([`Resumo Executivo: ${resultado.resumoExecutivo}`].map(escapeCsv).join(';'))

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
