import * as XLSX from 'xlsx'
import type {
  AnaliseRentabilidadeResultado,
  AnoRentabilidadeComparado,
} from './analiseRentabilidadeCalculo'
import type { EmpresaRecord } from '@/types/finance'
import { sanitizeNomeArquivo } from './exportacaoPlanoContas'
import { formatarPercentualExport } from './analiseRentabilidadeExport'

function formatMoedaCsv(v: number | undefined | null): string {
  if (v === undefined || v === null || !Number.isFinite(v)) return '0,00'
  return v.toFixed(2).replace('.', ',')
}

interface LinhaDreResumida {
  Conta: string
  Valor: number | string
  'Margem (%)': string
}

const LARGURAS_DRE = [{ wch: 40 }, { wch: 20 }, { wch: 14 }]

/**
 * Monta a DRE resumida de um ano (receita bruta → deduções → líquida → CMV →
 * lucro bruto → despesas operacionais → lucro operacional → lucro líquido),
 * derivada 100% da DRE Gerencial já apurada pela tela (sem consulta nova).
 */
export function montarLinhasDreResumida(
  resultado: AnaliseRentabilidadeResultado,
  rotuloAno?: string,
): LinhaDreResumida[] {
  const prefixo = rotuloAno ? `[${rotuloAno}] ` : ''

  // Receita bruta = receita DRE + deduções (devoluções/impostos s/ venda classificados)
  // aqui adotamos a receita DRE como receita bruta consolidada do exercício.
  const receitaBruta = resultado.faturamentoTotal
  const receitaLiquida = receitaBruta - resultado.despesasVariaveisTotal
  const lucroBruto = receitaLiquida
  const despesasOperacionais =
    resultado.despesasFixasTotal +
    resultado.despesasFinanceirasTotal -
    resultado.receitasFinanceirasTotal
  const lucroOperacional = lucroBruto - despesasOperacionais
  const lucroLiquido = resultado.lucroTotal

  const margem = (v: number) => (receitaBruta > 0 ? (v / receitaBruta) * 100 : null)

  return [
    { Conta: `${prefixo}Receita Bruta`, Valor: receitaBruta, 'Margem (%)': '—' },
    {
      Conta: `${prefixo}(−) Deduções e Custos Variáveis (CMV)`,
      Valor: resultado.despesasVariaveisTotal,
      'Margem (%)': formatarPercentualExport(margem(resultado.despesasVariaveisTotal)),
    },
    { Conta: `${prefixo}= Receita Líquida`, Valor: receitaLiquida, 'Margem (%)': '—' },
    {
      Conta: `${prefixo}(−) Despesas Operacionais (Fixas + Financeiras − Rec. Fin.)`,
      Valor: despesasOperacionais,
      'Margem (%)': formatarPercentualExport(margem(despesasOperacionais)),
    },
    { Conta: `${prefixo}= Lucro Operacional`, Valor: lucroOperacional, 'Margem (%)': '—' },
    {
      Conta: `${prefixo}= Lucro Líquido do Exercício`,
      Valor: lucroLiquido,
      'Margem (%)': formatarPercentualExport(margem(lucroLiquido)),
    },
  ]
}

function exportarArquivo(
  linhas: string[],
  nomeBase: string,
  empresa?: EmpresaRecord | null,
  exercicioAno?: number,
  extensao: 'csv' | 'xlsx' = 'csv',
) {
  const nomeEmpresa = empresa?.nome || 'Empresa'
  const safeEmpresa = sanitizeNomeArquivo(nomeEmpresa)
  const dataHoje = new Date().toISOString().slice(0, 10)
  const sufixo = exercicioAno || dataHoje
  const fileName = `${nomeBase}-${safeEmpresa}-${sufixo}.${extensao}`
  if (extensao === 'csv') {
    const csvContent = '\uFEFF' + linhas.join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.setAttribute('download', fileName)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(link.href)
    return
  }
  // xlsx
  const wb = XLSX.utils.book_new()
  const rows: Array<Record<string, any>> = []
  for (const linha of linhas) {
    const [conta, valor, margem] = linha.split(';')
    rows.push({ Conta: conta, Valor: valor, 'Margem (%)': margem })
  }
  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = LARGURAS_DRE
  XLSX.utils.book_append_sheet(wb, ws, 'Relatório Detalhado')
  XLSX.writeFile(wb, fileName)
}

const escapeCsv = (val: any): string => {
  if (val === null || val === undefined) return ''
  const s = String(val)
  if (/[;"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

/**
 * Relatório Detalhado de Rentabilidade: DRE resumida + margens + comparativo
 * multi-ano — derivado dos resultados JÁ calculados pela tela.
 */
export function exportarRelatorioRentabilidadeDetalhado(
  resultado: AnaliseRentabilidadeResultado,
  empresa?: EmpresaRecord | null,
  exercicioAno?: number,
  comparativo?: AnoRentabilidadeComparado[],
) {
  const linhaSep = Array<string>(3).fill('')
  const linhas: string[] = []

  linhas.push(['Relatório Detalhado de Rentabilidade', '', ''].map(escapeCsv).join(';'))
  linhas.push(['Empresa', empresa?.nome || 'Empresa', ''].map(escapeCsv).join(';'))
  linhas.push(['Exercício', String(exercicioAno || ''), ''].map(escapeCsv).join(';'))
  linhas.push(...linhaSep)

  // DRE Resumida do exercício
  linhas.push(['DRE RESUMIDA', 'Valor (R$)', 'Margem (%)'].map(escapeCsv).join(';'))
  for (const l of montarLinhasDreResumida(resultado, `Exercício ${exercicioAno || ''}`)) {
    linhas.push(
      [l.Conta, formatMoedaCsv(Number(l.Valor) || 0), l['Margem (%)']].map(escapeCsv).join(';'),
    )
  }

  // Margens estruturais
  linhas.push(...linhaSep)
  linhas.push(['MARGENS', 'Valor', ''].map(escapeCsv).join(';'))
  linhas.push(
    ['Margem Bruta', formatarPercentualExport(resultado.margemBrutaTotal), '']
      .map(escapeCsv)
      .join(';'),
  )
  linhas.push(
    ['Margem Operacional', formatarPercentualExport(resultado.margemOperacionalTotal), '']
      .map(escapeCsv)
      .join(';'),
  )
  linhas.push(
    [
      'Margem Líquida s/ Faturamento',
      formatarPercentualExport(resultado.margemSobreFaturamentoTotal),
      '',
    ]
      .map(escapeCsv)
      .join(';'),
  )

  // Comparativo multi-ano (DRE resumida lado a lado)
  if (comparativo && comparativo.length > 1) {
    linhas.push(...linhaSep)
    const cab = ['DRE RESUMIDA COMPARATIVA']
    const anos = comparativo.map((c) => c.ano)
    const primeiraLinha = linhas.length
    void primeiraLinha
    cab.push(...anos.map((a) => `${a} (R$)`), ...anos.map((a) => `${a} Margem (%)`))
    linhas.push(cab.map(escapeCsv).join(';'))

    const itens = [
      'Receita Bruta',
      '(−) CMV / Deduções',
      '= Receita Líquida',
      '(−) Despesas Operacionais',
      '= Lucro Operacional',
      '= Lucro Líquido',
      'Margem Bruta (%)',
      'Margem Operacional (%)',
      'Margem Líquida (%)',
    ]
    const valoresAno = (r: AnaliseRentabilidadeResultado) => {
      const receitaBruta = r.faturamentoTotal
      const receitaLiquida = receitaBruta - r.despesasVariaveisTotal
      const despesasOperacionais =
        r.despesasFixasTotal + r.despesasFinanceirasTotal - r.receitasFinanceirasTotal
      return [
        receitaBruta,
        r.despesasVariaveisTotal,
        receitaLiquida,
        despesasOperacionais,
        receitaLiquida - despesasOperacionais,
        r.lucroTotal,
        r.margemBrutaTotal,
        r.margemOperacionalTotal,
        r.margemSobreFaturamentoTotal,
      ]
    }
    const isMargem = (idx: number) => idx >= 6
    itens.forEach((rotulo, idx) => {
      const linha = [rotulo]
      for (const c of comparativo) {
        const v = valoresAno(c.resultado)[idx]
        if (isMargem(idx)) {
          linha.push(formatarPercentualExport(v as number | null))
        } else {
          linha.push(formatMoedaCsv(v as number))
        }
      }
      linhas.push(linha.map(escapeCsv).join(';'))
    })
  }

  exportarArquivo(linhas, 'relatorio-rentabilidade-detalhado', empresa, exercicioAno, 'csv')
}

export function exportarRelatorioRentabilidadeDetalhadoExcel(
  resultado: AnaliseRentabilidadeResultado,
  empresa?: EmpresaRecord | null,
  exercicioAno?: number,
  comparativo?: AnoRentabilidadeComparado[],
) {
  const wb = XLSX.utils.book_new()
  const nomeEmpresa = empresa?.nome || 'Empresa'
  const safeEmpresa = sanitizeNomeArquivo(nomeEmpresa)
  const dataHoje = new Date().toISOString().slice(0, 10)
  const fileName = `relatorio-rentabilidade-detalhado-${safeEmpresa}-${exercicioAno || dataHoje}.xlsx`

  // ---------- Aba 1: DRE resumida + margens ----------
  const rowsDre: Array<Record<string, any>> = []
  rowsDre.push({
    Conta: `Relatório Detalhado de Rentabilidade — ${nomeEmpresa}`,
    Valor: '',
    'Margem (%)': '',
  })
  rowsDre.push({ Conta: `Exercício: ${exercicioAno || '—'}`, Valor: '', 'Margem (%)': '' })
  rowsDre.push({ Conta: '', Valor: '', 'Margem (%)': '' })
  rowsDre.push({ Conta: 'DRE RESUMIDA', Valor: 'Valor (R$)', 'Margem (%)': 'Margem (%)' })
  for (const l of montarLinhasDreResumida(resultado, `Exercício ${exercicioAno || ''}`)) {
    rowsDre.push({ Conta: l.Conta, Valor: l.Valor, 'Margem (%)': l['Margem (%)'] })
  }
  rowsDre.push({ Conta: '', Valor: '', 'Margem (%)': '' })
  rowsDre.push({ Conta: 'MARGENS', Valor: 'Valor', 'Margem (%)': '' })
  rowsDre.push({
    Conta: 'Margem Bruta',
    Valor: formatarPercentualExport(resultado.margemBrutaTotal),
    'Margem (%)': '',
  })
  rowsDre.push({
    Conta: 'Margem Operacional',
    Valor: formatarPercentualExport(resultado.margemOperacionalTotal),
    'Margem (%)': '',
  })
  rowsDre.push({
    Conta: 'Margem Líquida s/ Faturamento',
    Valor: formatarPercentualExport(resultado.margemSobreFaturamentoTotal),
    'Margem (%)': '',
  })

  const wsDre = XLSX.utils.json_to_sheet(rowsDre)
  wsDre['!cols'] = LARGURAS_DRE
  XLSX.utils.book_append_sheet(wb, wsDre, 'Relatório Detalhado')

  // ---------- Aba 2: DRE comparativa entre anos (quando ativo) ----------
  if (comparativo && comparativo.length > 1) {
    const rowsComp: Array<Record<string, any>> = []
    const anos = comparativo.map((c) => c.ano)
    const cabComp: Record<string, any> = { Conta: 'DRE RESUMIDA COMPARATIVA' }
    for (const a of anos) {
      cabComp[`${a} (R$)`] = ''
      cabComp[`${a} Margem (%)`] = ''
    }
    rowsComp.push(cabComp)

    const valoresAno = (r: AnaliseRentabilidadeResultado) => {
      const receitaBruta = r.faturamentoTotal
      const receitaLiquida = receitaBruta - r.despesasVariaveisTotal
      const despesasOperacionais =
        r.despesasFixasTotal + r.despesasFinanceirasTotal - r.receitasFinanceirasTotal
      return {
        receitaBruta,
        cmv: r.despesasVariaveisTotal,
        receitaLiquida,
        despesasOperacionais,
        lucroOperacional: receitaLiquida - despesasOperacionais,
        lucroLiquido: r.lucroTotal,
        margemBruta: r.margemBrutaTotal,
        margemOperacional: r.margemOperacionalTotal,
        margemLiquida: r.margemSobreFaturamentoTotal,
      }
    }

    const linhasDre: Array<[string, (v: ReturnType<typeof valoresAno>) => number | string]> = [
      ['Receita Bruta', (v) => v.receitaBruta],
      ['(−) CMV / Deduções', (v) => v.cmv],
      ['= Receita Líquida', (v) => v.receitaLiquida],
      ['(−) Despesas Operacionais', (v) => v.despesasOperacionais],
      ['= Lucro Operacional', (v) => v.lucroOperacional],
      ['= Lucro Líquido', (v) => v.lucroLiquido],
      ['Margem Bruta (%)', (v) => formatarPercentualExport(v.margemBruta)],
      ['Margem Operacional (%)', (v) => formatarPercentualExport(v.margemOperacional)],
      ['Margem Líquida (%)', (v) => formatarPercentualExport(v.margemLiquida)],
    ]

    for (const [rotulo, pegar] of linhasDre) {
      const linha: Record<string, any> = { Conta: rotulo }
      for (const c of comparativo) {
        const v = valoresAno(c.resultado)
        const isMargem = rotulo.includes('Margem')
        linha[`${c.ano} (R$)`] = isMargem ? '' : pegar(v)
        linha[`${c.ano} Margem (%)`] = isMargem ? pegar(v) : ''
      }
      rowsComp.push(linha)
    }

    const largurasComp: Array<{ wch: number }> = [{ wch: 36 }]
    for (let i = 0; i < anos.length; i++) largurasComp.push({ wch: 20 }, { wch: 16 })
    const wsComp = XLSX.utils.json_to_sheet(rowsComp)
    wsComp['!cols'] = largurasComp
    XLSX.utils.book_append_sheet(wb, wsComp, 'DRE Comparativa')
  }

  XLSX.writeFile(wb, fileName)
}
