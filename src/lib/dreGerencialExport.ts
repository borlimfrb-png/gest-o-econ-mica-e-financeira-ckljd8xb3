import * as XLSX from 'xlsx'
import type { DreMatrizResultado, DreComparativoResultado } from './dreGerencialTypes'
import type { EmpresaRecord } from '@/types/finance'
import { sanitizeNomeArquivo } from './exportacaoPlanoContas'

/**
 * Exporta a matriz comparativa da DRE Gerencial para arquivo Excel (.xlsx)
 */
export function exportarDreComparativoExcel(
  comparativo: DreComparativoResultado,
  empresa?: EmpresaRecord | null,
) {
  const nomeEmpresa = empresa?.nome || 'Empresa'
  const safeEmpresa = sanitizeNomeArquivo(nomeEmpresa)
  const dataHoje = new Date().toISOString().slice(0, 10)
  const fileName = `dre-comparativo-${safeEmpresa}-${dataHoje}.xlsx`

  const colP1 = `Período 1 (${comparativo.periodo1Descricao})`
  const colP2 = `Período 2 (${comparativo.periodo2Descricao})`

  const rows: Array<Record<string, any>> = []

  const formatPct = (val: number | null) => {
    if (val === null || val === undefined) return '—'
    return `${val >= 0 ? '+' : ''}${val.toFixed(2)}%`
  }

  for (const grupo of comparativo.grupos) {
    rows.push({
      Estrutura: grupo.titulo,
      Tipo: 'Grupo',
      [colP1]: grupo.valorPeriodo1,
      [colP2]: grupo.valorPeriodo2,
      'Variação (R$)': grupo.diferenca,
      'Variação (%)': formatPct(grupo.percentual),
      Impacto: grupo.favoravel ? 'Favorável' : 'Desfavorável',
    })

    for (const conta of grupo.contas) {
      const codStr = conta.codigo ? `[${conta.codigo}] ` : ''
      rows.push({
        Estrutura: `    ${codStr}${conta.nome}`,
        Tipo: 'Conta',
        [colP1]: conta.valorPeriodo1,
        [colP2]: conta.valorPeriodo2,
        'Variação (R$)': conta.diferenca,
        'Variação (%)': formatPct(conta.percentual),
        Impacto: conta.favoravel ? 'Favorável' : 'Desfavorável',
      })
    }
  }

  rows.push({ Estrutura: '', Tipo: '' })

  // Lucro/Prejuízo
  const lp = comparativo.lucroPrejuizo
  rows.push({
    Estrutura: lp.titulo,
    Tipo: 'Resultado',
    [colP1]: lp.valorPeriodo1,
    [colP2]: lp.valorPeriodo2,
    'Variação (R$)': lp.diferenca,
    'Variação (%)': formatPct(lp.percentual),
    Impacto: lp.favoravel ? 'Favorável' : 'Desfavorável',
  })

  // Margem Líquida
  const mg = comparativo.margemLiquida
  rows.push({
    Estrutura: 'Margem Líquida (%)',
    Tipo: 'Indicador',
    [colP1]: mg.margemPeriodo1 !== null ? `${mg.margemPeriodo1.toFixed(2)}%` : '—',
    [colP2]: mg.margemPeriodo2 !== null ? `${mg.margemPeriodo2.toFixed(2)}%` : '—',
    'Variação (R$)': mg.diferencaPontos !== null ? `${mg.diferencaPontos.toFixed(2)} p.p.` : '—',
    'Variação (%)': '—',
    Impacto: mg.favoravel ? 'Favorável' : 'Desfavorável',
  })

  if (comparativo.naoClassificados.contas.length > 0) {
    const nc = comparativo.naoClassificados
    rows.push({ Estrutura: '', Tipo: '' })
    rows.push({
      Estrutura: nc.titulo,
      Tipo: 'Não Classificado',
      [colP1]: nc.valorPeriodo1,
      [colP2]: nc.valorPeriodo2,
      'Variação (R$)': nc.diferenca,
      'Variação (%)': formatPct(nc.percentual),
      Impacto: nc.favoravel ? 'Favorável' : 'Desfavorável',
    })
    for (const conta of nc.contas) {
      const codStr = conta.codigo ? `[${conta.codigo}] ` : ''
      rows.push({
        Estrutura: `    ${codStr}${conta.nome}`,
        Tipo: 'Conta Não Classificada',
        [colP1]: conta.valorPeriodo1,
        [colP2]: conta.valorPeriodo2,
        'Variação (R$)': conta.diferenca,
        'Variação (%)': formatPct(conta.percentual),
        Impacto: conta.favoravel ? 'Favorável' : 'Desfavorável',
      })
    }
  }

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = [
    { wch: 44 }, // Estrutura
    { wch: 14 }, // Tipo
    { wch: 22 }, // P1
    { wch: 22 }, // P2
    { wch: 18 }, // Var R$
    { wch: 16 }, // Var %
    { wch: 16 }, // Impacto
  ]
  XLSX.utils.book_append_sheet(wb, ws, 'DRE Comparativa')
  XLSX.writeFile(wb, fileName)
}

/**
 * Exporta o comparativo da DRE em formato CSV delimitado por ponto e vírgula com UTF-8 BOM
 */
export function exportarDreComparativoCsv(
  comparativo: DreComparativoResultado,
  empresa?: EmpresaRecord | null,
) {
  const nomeEmpresa = empresa?.nome || 'Empresa'
  const safeEmpresa = sanitizeNomeArquivo(nomeEmpresa)
  const dataHoje = new Date().toISOString().slice(0, 10)
  const fileName = `dre-comparativo-${safeEmpresa}-${dataHoje}.csv`

  const escapeCsv = (val: any): string => {
    if (val === null || val === undefined) return ''
    const s = String(val)
    if (/[;"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }

  const formatMoedaCsv = (v: number | undefined | null) => {
    if (v === undefined || v === null) return '0,00'
    return v.toFixed(2).replace('.', ',')
  }

  const formatPctCsv = (val: number | null) => {
    if (val === null || val === undefined) return '—'
    return `${val >= 0 ? '+' : ''}${val.toFixed(2).replace('.', ',')}%`
  }

  const colP1 = `Período 1 (${comparativo.periodo1Descricao})`
  const colP2 = `Período 2 (${comparativo.periodo2Descricao})`

  const colunas = ['Estrutura', 'Tipo', colP1, colP2, 'Variação (R$)', 'Variação (%)', 'Impacto']
  const linhas: string[] = [colunas.map(escapeCsv).join(';')]

  for (const grupo of comparativo.grupos) {
    linhas.push(
      [
        grupo.titulo,
        'Grupo',
        formatMoedaCsv(grupo.valorPeriodo1),
        formatMoedaCsv(grupo.valorPeriodo2),
        formatMoedaCsv(grupo.diferenca),
        formatPctCsv(grupo.percentual),
        grupo.favoravel ? 'Favorável' : 'Desfavorável',
      ]
        .map(escapeCsv)
        .join(';'),
    )

    for (const conta of grupo.contas) {
      const codStr = conta.codigo ? `[${conta.codigo}] ` : ''
      linhas.push(
        [
          `  ${codStr}${conta.nome}`,
          'Conta',
          formatMoedaCsv(conta.valorPeriodo1),
          formatMoedaCsv(conta.valorPeriodo2),
          formatMoedaCsv(conta.diferenca),
          formatPctCsv(conta.percentual),
          conta.favoravel ? 'Favorável' : 'Desfavorável',
        ]
          .map(escapeCsv)
          .join(';'),
      )
    }
  }

  const lp = comparativo.lucroPrejuizo
  linhas.push(
    [
      lp.titulo,
      'Resultado',
      formatMoedaCsv(lp.valorPeriodo1),
      formatMoedaCsv(lp.valorPeriodo2),
      formatMoedaCsv(lp.diferenca),
      formatPctCsv(lp.percentual),
      lp.favoravel ? 'Favorável' : 'Desfavorável',
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

/**
 * Exporta a matriz da DRE Gerencial para arquivo Excel (.xlsx) com layout de linhas e colunas mensais
 */
export function exportarDreGerencialExcel(
  matriz: DreMatrizResultado,
  empresa?: EmpresaRecord | null,
  periodoDescricao?: string,
) {
  const nomeEmpresa = empresa?.nome || 'Empresa'
  const safeEmpresa = sanitizeNomeArquivo(nomeEmpresa)
  const dataHoje = new Date().toISOString().slice(0, 10)
  const fileName = `dre-gerencial-${safeEmpresa}-${dataHoje}.xlsx`

  const rows: Array<Record<string, any>> = []

  // Linhas dos grupos
  for (const grupo of matriz.grupos) {
    const linhaGrupo: Record<string, any> = {
      Estrutura: grupo.titulo,
      Tipo: 'Grupo',
    }
    for (const m of matriz.meses) {
      linhaGrupo[m.rotuloCurto] = grupo.valoresPorMes[m.chave] || 0
    }
    linhaGrupo['Total do Período'] = grupo.totalPeriodo
    rows.push(linhaGrupo)

    // Contas individuais (detalhamento)
    for (const conta of grupo.contas) {
      const codStr = conta.codigo ? `[${conta.codigo}] ` : ''
      const linhaConta: Record<string, any> = {
        Estrutura: `    ${codStr}${conta.nome}`,
        Tipo: 'Conta',
      }
      for (const m of matriz.meses) {
        linhaConta[m.rotuloCurto] = conta.valoresPorMes[m.chave] || 0
      }
      linhaConta['Total do Período'] = conta.totalPeriodo
      rows.push(linhaConta)
    }
  }

  // Linha em branco
  rows.push({ Estrutura: '', Tipo: '' })

  // Lucro ou Prejuízo
  const linhaResultado: Record<string, any> = {
    Estrutura: matriz.lucroPrejuizo.titulo,
    Tipo: 'Resultado',
  }
  for (const m of matriz.meses) {
    linhaResultado[m.rotuloCurto] = matriz.lucroPrejuizo.valoresPorMes[m.chave] || 0
  }
  linhaResultado['Total do Período'] = matriz.lucroPrejuizo.totalPeriodo
  rows.push(linhaResultado)

  // Margem Líquida %
  const linhaMargem: Record<string, any> = {
    Estrutura: 'Margem Líquida (%)',
    Tipo: 'Indicador',
  }
  for (const m of matriz.meses) {
    const mg = matriz.margemLiquidaPorMes[m.chave]
    linhaMargem[m.rotuloCurto] = mg !== null && mg !== undefined ? `${mg.toFixed(2)}%` : '—'
  }
  linhaMargem['Total do Período'] =
    matriz.margemLiquidaTotal !== null && matriz.margemLiquidaTotal !== undefined
      ? `${matriz.margemLiquidaTotal.toFixed(2)}%`
      : '—'
  rows.push(linhaMargem)

  // Não classificados se existirem
  if (matriz.naoClassificados.contas.length > 0) {
    rows.push({ Estrutura: '', Tipo: '' })
    const linhaNc: Record<string, any> = {
      Estrutura: matriz.naoClassificados.titulo,
      Tipo: 'Não Classificado',
    }
    for (const m of matriz.meses) {
      linhaNc[m.rotuloCurto] = matriz.naoClassificados.valoresPorMes[m.chave] || 0
    }
    linhaNc['Total do Período'] = matriz.naoClassificados.totalPeriodo
    rows.push(linhaNc)

    for (const conta of matriz.naoClassificados.contas) {
      const codStr = conta.codigo ? `[${conta.codigo}] ` : ''
      const linhaConta: Record<string, any> = {
        Estrutura: `    ${codStr}${conta.nome}`,
        Tipo: 'Conta Não Classificada',
      }
      for (const m of matriz.meses) {
        linhaConta[m.rotuloCurto] = conta.valoresPorMes[m.chave] || 0
      }
      linhaConta['Total do Período'] = conta.totalPeriodo
      rows.push(linhaConta)
    }
  }

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows)

  // Larguras das colunas
  const cols = [
    { wch: 44 }, // Estrutura
    { wch: 14 }, // Tipo
  ]
  for (let i = 0; i < matriz.meses.length; i++) {
    cols.push({ wch: 16 })
  }
  cols.push({ wch: 20 }) // Total do Período
  ws['!cols'] = cols

  XLSX.utils.book_append_sheet(wb, ws, 'DRE Gerencial')
  XLSX.writeFile(wb, fileName)
}

/**
 * Exporta a DRE Gerencial em formato CSV delimitado por ponto e vírgula com UTF-8 BOM
 */
export function exportarDreGerencialCsv(
  matriz: DreMatrizResultado,
  empresa?: EmpresaRecord | null,
) {
  const nomeEmpresa = empresa?.nome || 'Empresa'
  const safeEmpresa = sanitizeNomeArquivo(nomeEmpresa)
  const dataHoje = new Date().toISOString().slice(0, 10)
  const fileName = `dre-gerencial-${safeEmpresa}-${dataHoje}.csv`

  const escapeCsv = (val: any): string => {
    if (val === null || val === undefined) return ''
    const s = String(val)
    if (/[;"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }

  const formatMoedaCsv = (v: number | undefined | null) => {
    if (v === undefined || v === null) return '0,00'
    return v.toFixed(2).replace('.', ',')
  }

  const colunas = [
    'Estrutura',
    'Tipo',
    ...matriz.meses.map((m) => m.rotuloCurto),
    'Total do Período',
  ]
  const linhas: string[] = [colunas.map(escapeCsv).join(';')]

  for (const grupo of matriz.grupos) {
    linhas.push(
      [
        grupo.titulo,
        'Grupo',
        ...matriz.meses.map((m) => formatMoedaCsv(grupo.valoresPorMes[m.chave])),
        formatMoedaCsv(grupo.totalPeriodo),
      ]
        .map(escapeCsv)
        .join(';'),
    )

    for (const conta of grupo.contas) {
      const codStr = conta.codigo ? `[${conta.codigo}] ` : ''
      linhas.push(
        [
          `  ${codStr}${conta.nome}`,
          'Conta',
          ...matriz.meses.map((m) => formatMoedaCsv(conta.valoresPorMes[m.chave])),
          formatMoedaCsv(conta.totalPeriodo),
        ]
          .map(escapeCsv)
          .join(';'),
      )
    }
  }

  linhas.push(
    [
      matriz.lucroPrejuizo.titulo,
      'Resultado',
      ...matriz.meses.map((m) => formatMoedaCsv(matriz.lucroPrejuizo.valoresPorMes[m.chave])),
      formatMoedaCsv(matriz.lucroPrejuizo.totalPeriodo),
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
