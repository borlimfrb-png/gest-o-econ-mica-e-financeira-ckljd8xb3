import * as XLSX from 'xlsx'
import type {
  AnaliseRentabilidadeResultado,
  AnoRentabilidadeComparado,
} from './analiseRentabilidadeCalculo'
import type { EmpresaRecord } from '@/types/finance'
import { sanitizeNomeArquivo } from './exportacaoPlanoContas'
import type { SubtotalCentroExport } from './lancamentosVariaveisHelper'

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

function formatVariacaoCsv(deltaPct: number | null | undefined): string {
  if (deltaPct === null || deltaPct === undefined || !Number.isFinite(deltaPct)) return '—'
  return `${deltaPct >= 0 ? '+' : ''}${deltaPct.toFixed(2)}%`
}

const CABECALHO_PADRAO = {
  Mês: '',
  'Faturamento (Receita DRE)': '',
  'Despesas Variáveis': '',
  'Despesas Fixas': '',
  'Despesas Financeiras': '',
  'Resultado Financeiro': '',
  'Lucro Apurado (Resultado)': '',
  'Margem Bruta (%)': '',
  'Margem Operacional (%)': '',
  'Margem Líquida s/ Faturamento (%)': '',
}

const LARGURAS_PADRAO = [
  { wch: 22 }, // Mês
  { wch: 26 }, // Faturamento
  { wch: 20 }, // Desp Var
  { wch: 18 }, // Desp Fix
  { wch: 20 }, // Desp Fin
  { wch: 20 }, // Res Fin
  { wch: 26 }, // Lucro Apurado
  { wch: 18 }, // Margem Bruta
  { wch: 22 }, // Margem Operacional
  { wch: 32 }, // Margem s/ Faturamento
]

interface LinhaRentabilidade {
  Mês: string
  'Faturamento (Receita DRE)': number | string
  'Despesas Variáveis': number | string
  'Despesas Fixas': number | string
  'Despesas Financeiras': number | string
  'Resultado Financeiro': number | string
  'Lucro Apurado (Resultado)': number | string
  'Margem Bruta (%)': string
  'Margem Operacional (%)': string
  'Margem Líquida s/ Faturamento (%)': string
}

function montarLinhasResultado(
  resultado: AnaliseRentabilidadeResultado,
  rotuloAno?: string,
): LinhaRentabilidade[] {
  const prefixo = rotuloAno ? `${rotuloAno} · ` : ''
  const linhas: LinhaRentabilidade[] = []

  for (const item of resultado.itensPorMes) {
    linhas.push({
      Mês: `${prefixo}${item.rotuloCompleto}`,
      'Faturamento (Receita DRE)': item.faturamento,
      'Despesas Variáveis': item.despesasVariaveis,
      'Despesas Fixas': item.despesasFixas,
      'Despesas Financeiras': item.despesasFinanceiras,
      'Resultado Financeiro': item.resultadoFinanceiro,
      'Lucro Apurado (Resultado)': item.lucroApurado,
      'Margem Bruta (%)': formatarPercentualExport(item.margemBruta),
      'Margem Operacional (%)': formatarPercentualExport(item.margemOperacional),
      'Margem Líquida s/ Faturamento (%)': formatarPercentualExport(item.margemSobreFaturamento),
    })
  }

  linhas.push({ ...CABECALHO_PADRAO } as LinhaRentabilidade)

  linhas.push({
    Mês: `${prefixo}TOTAL DO PERÍODO`,
    'Faturamento (Receita DRE)': resultado.faturamentoTotal,
    'Despesas Variáveis': resultado.despesasVariaveisTotal,
    'Despesas Fixas': resultado.despesasFixasTotal,
    'Despesas Financeiras': resultado.despesasFinanceirasTotal,
    'Resultado Financeiro': resultado.resultadoFinanceiroTotal,
    'Lucro Apurado (Resultado)': resultado.lucroTotal,
    'Margem Bruta (%)': formatarPercentualExport(resultado.margemBrutaTotal),
    'Margem Operacional (%)': formatarPercentualExport(resultado.margemOperacionalTotal),
    'Margem Líquida s/ Faturamento (%)': formatarPercentualExport(
      resultado.margemSobreFaturamentoTotal,
    ),
  })

  return linhas
}

/**
 * Exporta a Análise de Rentabilidade para planilha Excel (.xlsx).
 * Quando o comparativo multi-ano estiver ativo, exporta uma linha por mês de cada
 * ano selecionado + bloco de variações ano contra ano.
 */
export function exportarAnaliseRentabilidadeExcel(
  resultado: AnaliseRentabilidadeResultado,
  empresa?: EmpresaRecord | null,
  exercicioAno?: number,
  comparativo?: AnoRentabilidadeComparado[],
  subtotaisCentros?: SubtotalCentroExport[],
) {
  const nomeEmpresa = empresa?.nome || 'Empresa'
  const safeEmpresa = sanitizeNomeArquivo(nomeEmpresa)
  const dataHoje = new Date().toISOString().slice(0, 10)
  const sufixo = comparativo && comparativo.length > 1 ? 'comparativo' : exercicioAno || dataHoje
  const fileName = `analise-rentabilidade-${safeEmpresa}-${sufixo}.xlsx`

  const wb = XLSX.utils.book_new()

  // ---------- Aba 1: base do exercício (ou sequência de anos quando comparativo) ----------
  const rows: Array<Record<string, any>> = []

  if (comparativo && comparativo.length > 1) {
    for (const item of comparativo) {
      rows.push(...montarLinhasResultado(item.resultado, `Exercício ${item.ano}`))
      rows.push({ ...CABECALHO_PADRAO } as LinhaRentabilidade)
    }

    // Bloco de variações ano contra ano
    for (let i = 1; i < comparativo.length; i++) {
      const v = comparativo[i].variacoes
      const anoAtual = comparativo[i].ano
      const anoAnterior = comparativo[i - 1].ano
      if (!v) continue
      rows.push({
        Mês: `VARIAÇÃO ${anoAnterior} → ${anoAtual}`,
        'Faturamento (Receita DRE)': formatVariacaoCsv(v.faturamento.deltaPercentual),
        'Despesas Variáveis': formatVariacaoCsv(v.despesasVariaveis.deltaPercentual),
        'Despesas Fixas': formatVariacaoCsv(v.despesasFixas.deltaPercentual),
        'Despesas Financeiras': formatVariacaoCsv(v.despesasFinanceiras.deltaPercentual),
        'Resultado Financeiro': formatVariacaoCsv(v.resultadoFinanceiro.deltaPercentual),
        'Lucro Apurado (Resultado)': formatVariacaoCsv(v.lucroApurado.deltaPercentual),
        'Margem Bruta (%)': formatVariacaoCsv(v.margemBruta.deltaPontos),
        'Margem Operacional (%)': formatVariacaoCsv(v.margemOperacional.deltaPontos),
        'Margem Líquida s/ Faturamento (%)': formatVariacaoCsv(
          v.margemSobreFaturamento.deltaPontos,
        ),
      })
    }
  } else {
    rows.push(...montarLinhasResultado(resultado))
  }

  // Bloco adicional: Despesas Variáveis por Centro de Custo (se informado)
  if (subtotaisCentros && subtotaisCentros.length > 0) {
    rows.push({ ...CABECALHO_PADRAO } as LinhaRentabilidade)
    rows.push({
      Mês: 'DESPESAS VARIÁVEIS POR CENTRO DE CUSTO (SUBTOTAIS)',
      'Faturamento (Receita DRE)': 'Lançamentos',
      'Despesas Variáveis': 'Subtotal (R$)',
      'Despesas Fixas': '% do Total',
      'Despesas Financeiras': '',
      'Resultado Financeiro': '',
      'Lucro Apurado (Resultado)': '',
      'Margem Bruta (%)': '',
      'Margem Operacional (%)': '',
      'Margem Líquida s/ Faturamento (%)': '',
    })

    const totalCentros = subtotaisCentros.reduce((acc, c) => acc + c.subtotal, 0)
    for (const sc of subtotaisCentros) {
      const pctCentro = totalCentros > 0 ? (sc.subtotal / totalCentros) * 100 : 0
      rows.push({
        Mês: sc.centroNome,
        'Faturamento (Receita DRE)': sc.quantidade,
        'Despesas Variáveis': sc.subtotal,
        'Despesas Fixas': `${pctCentro.toFixed(1)}%`,
        'Despesas Financeiras': '',
        'Resultado Financeiro': '',
        'Lucro Apurado (Resultado)': '',
        'Margem Bruta (%)': '',
        'Margem Operacional (%)': '',
        'Margem Líquida s/ Faturamento (%)': '',
      })
    }

    rows.push({
      Mês: 'TOTAL CONSOLIDADO DAS DESPESAS VARIÁVEIS',
      'Faturamento (Receita DRE)': subtotaisCentros.reduce((acc, c) => acc + c.quantidade, 0),
      'Despesas Variáveis': totalCentros,
      'Despesas Fixas': '100.0%',
      'Despesas Financeiras': '',
      'Resultado Financeiro': '',
      'Lucro Apurado (Resultado)': '',
      'Margem Bruta (%)': '',
      'Margem Operacional (%)': '',
      'Margem Líquida s/ Faturamento (%)': '',
    })
  }

  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = LARGURAS_PADRAO
  XLSX.utils.book_append_sheet(wb, ws, 'Rentabilidade DRE')

  // ---------- Aba 2: tabela mensal lado a lado (apenas comparativo) ----------
  if (comparativo && comparativo.length > 1) {
    const linhaMeses = comparativo[0].resultado.itensPorMes
    const rowsComp: Array<Record<string, any>> = []

    const cabComp: Record<string, any> = { Mês: '' }
    for (const item of comparativo) {
      cabComp[`Fat. ${item.ano} (R$)`] = ''
      cabComp[`Lucro ${item.ano} (R$)`] = ''
      cabComp[`Margem ${item.ano} (%)`] = ''
    }
    for (let i = 1; i < comparativo.length; i++) {
      cabComp[`Δ Fat. ${comparativo[i - 1].ano}→${comparativo[i].ano} (%)`] = ''
      cabComp[`Δ Lucro ${comparativo[i - 1].ano}→${comparativo[i].ano} (%)`] = ''
    }
    rowsComp.push(cabComp)

    linhaMeses.forEach((mes, idx) => {
      const linha: Record<string, any> = { Mês: mes.rotuloCurto }
      for (const item of comparativo) {
        const dado = item.resultado.itensPorMes[idx]
        if (!dado) return
        linha[`Fat. ${item.ano} (R$)`] = dado.faturamento
        linha[`Lucro ${item.ano} (R$)`] = dado.lucroApurado
        linha[`Margem ${item.ano} (%)`] = formatarPercentualExport(dado.margemSobreFaturamento)
      }
      for (let i = 1; i < comparativo.length; i++) {
        const variacoes = comparativo[i].variacoes
        if (!variacoes) continue
        const fatAnt = comparativo[i - 1].resultado.itensPorMes[idx]?.faturamento || 0
        const fatAtual = comparativo[i].resultado.itensPorMes[idx]?.faturamento || 0
        const lucAnt = comparativo[i - 1].resultado.itensPorMes[idx]?.lucroApurado || 0
        const lucAtual = comparativo[i].resultado.itensPorMes[idx]?.lucroApurado || 0
        const pctFat =
          fatAnt === 0
            ? fatAtual === 0
              ? 0
              : null
            : ((fatAtual - fatAnt) / Math.abs(fatAnt)) * 100
        const pctLuc =
          lucAnt === 0
            ? lucAtual === 0
              ? 0
              : null
            : ((lucAtual - lucAnt) / Math.abs(lucAnt)) * 100
        linha[`Δ Fat. ${comparativo[i - 1].ano}→${comparativo[i].ano} (%)`] =
          formatVariacaoCsv(pctFat)
        linha[`Δ Lucro ${comparativo[i - 1].ano}→${comparativo[i].ano} (%)`] =
          formatVariacaoCsv(pctLuc)
      }
      rowsComp.push(linha)
    })

    // Total do período lado a lado
    const linhaTotal: Record<string, any> = { Mês: 'TOTAL DO PERÍODO' }
    for (const item of comparativo) {
      linhaTotal[`Fat. ${item.ano} (R$)`] = item.resultado.faturamentoTotal
      linhaTotal[`Lucro ${item.ano} (R$)`] = item.resultado.lucroTotal
      linhaTotal[`Margem ${item.ano} (%)`] = formatarPercentualExport(
        item.resultado.margemSobreFaturamentoTotal,
      )
    }
    for (let i = 1; i < comparativo.length; i++) {
      const variacoes = comparativo[i].variacoes
      if (!variacoes) continue
      linhaTotal[`Δ Fat. ${comparativo[i - 1].ano}→${comparativo[i].ano} (%)`] = formatVariacaoCsv(
        variacoes.faturamento.deltaPercentual,
      )
      linhaTotal[`Δ Lucro ${comparativo[i - 1].ano}→${comparativo[i].ano} (%)`] = formatVariacaoCsv(
        variacoes.lucroApurado.deltaPercentual,
      )
    }
    rowsComp.push(linhaTotal)

    const wsComp = XLSX.utils.json_to_sheet(rowsComp)
    const larguras: Array<{ wch: number }> = [{ wch: 22 }]
    for (const item of comparativo) {
      larguras.push({ wch: 20 }, { wch: 20 }, { wch: 16 })
    }
    for (let i = 1; i < comparativo.length; i++) {
      larguras.push({ wch: 18 }, { wch: 18 })
    }
    wsComp['!cols'] = larguras
    XLSX.utils.book_append_sheet(wb, wsComp, 'Comparativo Anos')
  }

  XLSX.writeFile(wb, fileName)
}

/**
 * Exporta a Análise de Rentabilidade em formato CSV delimitado por ponto e vírgula com UTF-8 BOM
 */
export function exportarAnaliseRentabilidadeCsv(
  resultado: AnaliseRentabilidadeResultado,
  empresa?: EmpresaRecord | null,
  exercicioAno?: number,
  comparativo?: AnoRentabilidadeComparado[],
  subtotaisCentros?: SubtotalCentroExport[],
) {
  const nomeEmpresa = empresa?.nome || 'Empresa'
  const safeEmpresa = sanitizeNomeArquivo(nomeEmpresa)
  const dataHoje = new Date().toISOString().slice(0, 10)
  const sufixo = comparativo && comparativo.length > 1 ? 'comparativo' : exercicioAno || dataHoje
  const fileName = `analise-rentabilidade-${safeEmpresa}-${sufixo}.csv`

  const escapeCsv = (val: any): string => {
    if (val === null || val === undefined) return ''
    const s = String(val)
    if (/[;"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }

  const linhas: string[] = []

  if (comparativo && comparativo.length > 1) {
    // CSV comparativo: uma linha por mês com colunas dos anos lado a lado
    const cabecalhoComp: string[] = ['Mês']
    for (const item of comparativo) {
      cabecalhoComp.push(
        `Faturamento ${item.ano} (R$)`,
        `Lucro ${item.ano} (R$)`,
        `Margem ${item.ano} (%)`,
      )
    }
    for (let i = 1; i < comparativo.length; i++) {
      cabecalhoComp.push(
        `Δ Faturamento ${comparativo[i - 1].ano}→${comparativo[i].ano} (%)`,
        `Δ Lucro ${comparativo[i - 1].ano}→${comparativo[i].ano} (%)`,
      )
    }
    linhas.push(cabecalhoComp.map(escapeCsv).join(';'))

    const qtdMeses = comparativo[0].resultado.itensPorMes.length
    for (let idx = 0; idx < qtdMeses; idx++) {
      const linha: string[] = [comparativo[0].resultado.itensPorMes[idx]?.rotuloCurto || '']
      for (const item of comparativo) {
        const dado = item.resultado.itensPorMes[idx]
        if (!dado) return
        linha.push(
          formatMoedaCsv(dado.faturamento),
          formatMoedaCsv(dado.lucroApurado),
          formatarPercentualExport(dado.margemSobreFaturamento),
        )
      }
      for (let i = 1; i < comparativo.length; i++) {
        const fatAnt = comparativo[i - 1].resultado.itensPorMes[idx]?.faturamento || 0
        const fatAtual = comparativo[i].resultado.itensPorMes[idx]?.faturamento || 0
        const lucAnt = comparativo[i - 1].resultado.itensPorMes[idx]?.lucroApurado || 0
        const lucAtual = comparativo[i].resultado.itensPorMes[idx]?.lucroApurado || 0
        const pctFat =
          fatAnt === 0
            ? fatAtual === 0
              ? 0
              : null
            : ((fatAtual - fatAnt) / Math.abs(fatAnt)) * 100
        const pctLuc =
          lucAnt === 0
            ? lucAtual === 0
              ? 0
              : null
            : ((lucAtual - lucAnt) / Math.abs(lucAnt)) * 100
        linha.push(formatVariacaoCsv(pctFat), formatVariacaoCsv(pctLuc))
      }
      linhas.push(linha.map(escapeCsv).join(';'))
    }

    linhas.push('')

    const linhaTotal: string[] = ['TOTAL DO PERÍODO']
    for (const item of comparativo) {
      linhaTotal.push(
        formatMoedaCsv(item.resultado.faturamentoTotal),
        formatMoedaCsv(item.resultado.lucroTotal),
        formatarPercentualExport(item.resultado.margemSobreFaturamentoTotal),
      )
    }
    for (let i = 1; i < comparativo.length; i++) {
      const variacoes = comparativo[i].variacoes
      linhaTotal.push(
        formatVariacaoCsv(variacoes?.faturamento.deltaPercentual),
        formatVariacaoCsv(variacoes?.lucroApurado.deltaPercentual),
      )
    }
    linhas.push(linhaTotal.map(escapeCsv).join(';'))
  } else {
    const cabecalhos = [
      'Mês',
      'Faturamento (R$)',
      'Despesas Variáveis (R$)',
      'Despesas Fixas (R$)',
      'Despesas Financeiras (R$)',
      'Resultado Financeiro (R$)',
      'Lucro Apurado (R$)',
      'Margem Bruta (%)',
      'Margem Operacional (%)',
      'Margem s/ Faturamento (%)',
    ]

    linhas.push(cabecalhos.map(escapeCsv).join(';'))

    for (const item of resultado.itensPorMes) {
      linhas.push(
        [
          item.rotuloCompleto,
          formatMoedaCsv(item.faturamento),
          formatMoedaCsv(item.despesasVariaveis),
          formatMoedaCsv(item.despesasFixas),
          formatMoedaCsv(item.despesasFinanceiras),
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
        formatMoedaCsv(resultado.despesasFinanceirasTotal),
        formatMoedaCsv(resultado.resultadoFinanceiroTotal),
        formatMoedaCsv(resultado.lucroTotal),
        formatarPercentualExport(resultado.margemBrutaTotal),
        formatarPercentualExport(resultado.margemOperacionalTotal),
        formatarPercentualExport(resultado.margemSobreFaturamentoTotal),
      ]
        .map(escapeCsv)
        .join(';'),
    )
  }

  // Bloco adicional: Despesas Variáveis por Centro de Custo (se informado)
  if (subtotaisCentros && subtotaisCentros.length > 0) {
    linhas.push('')
    linhas.push(
      ['Despesas Variáveis por Centro de Custo', 'Lançamentos', 'Subtotal (R$)', '% do Total']
        .map(escapeCsv)
        .join(';'),
    )

    const totalCentros = subtotaisCentros.reduce((acc, c) => acc + c.subtotal, 0)
    for (const sc of subtotaisCentros) {
      const pctCentro = totalCentros > 0 ? (sc.subtotal / totalCentros) * 100 : 0
      linhas.push(
        [
          sc.centroNome,
          String(sc.quantidade),
          formatMoedaCsv(sc.subtotal),
          `${pctCentro.toFixed(1)}%`,
        ]
          .map(escapeCsv)
          .join(';'),
      )
    }

    linhas.push(
      [
        'Total Consolidado das Despesas Variáveis',
        String(subtotaisCentros.reduce((acc, c) => acc + c.quantidade, 0)),
        formatMoedaCsv(totalCentros),
        '100.0%',
      ]
        .map(escapeCsv)
        .join(';'),
    )
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
