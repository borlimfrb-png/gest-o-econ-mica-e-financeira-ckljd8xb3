import * as XLSX from 'xlsx'
import type { EmpresaRecord } from '@/types/finance'
import {
  type ComparativoDreBalancoResultado,
  NOMES_MESES_ABREV,
} from '@/lib/comparativoDreBalancoCalculo'

export interface OpcoesExportacaoComparativo {
  empresa?: EmpresaRecord | null
  exercicioAno?: number | string
  isGrupo?: boolean
  nomeGrupo?: string
}

function sanitizeNomeArquivo(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
}

function formatMoedaExcel(val: number | null | undefined): number {
  if (val === null || val === undefined || isNaN(val)) return 0
  return Number(val.toFixed(2))
}

function formatIndicadorExcel(val: number | null | undefined, sulfixo = ''): string {
  if (val === null || val === undefined || isNaN(val)) return '—'
  return `${val.toFixed(2)}${sulfixo}`
}

export function exportarComparativoDreBalancoExcel(
  resultado: ComparativoDreBalancoResultado,
  opcoes?: OpcoesExportacaoComparativo,
) {
  const identificador =
    opcoes?.isGrupo && opcoes.nomeGrupo
      ? `Grupo_${opcoes.nomeGrupo}`
      : opcoes?.empresa?.nome || (opcoes?.isGrupo ? 'Grupo_Economico' : resultado.empresaNome)

  const safeEntidade = sanitizeNomeArquivo(identificador)
  const exercicio = opcoes?.exercicioAno || resultado.ano
  const fileName = `Comparativo_DRE_Balanco_${safeEntidade}_${exercicio}.xlsx`

  const rows: Array<Record<string, any>> = []

  // Metadados
  rows.push({
    Categoria: 'COMPARATIVO MENSAL DRE × BALANÇO PATRIMONIAL',
    Métrica: '',
    ...Object.fromEntries(NOMES_MESES_ABREV.map((m) => [m, ''])),
    'Total / Posição': '',
  })
  rows.push({
    Categoria: `Entidade: ${opcoes?.isGrupo && opcoes.nomeGrupo ? `Grupo Econômico ${opcoes.nomeGrupo}` : resultado.empresaNome}`,
    Métrica: `Exercício: ${exercicio}`,
    ...Object.fromEntries(NOMES_MESES_ABREV.map((m) => [m, ''])),
    'Total / Posição': '',
  })
  rows.push({
    Categoria: '',
    Métrica: '',
    ...Object.fromEntries(NOMES_MESES_ABREV.map((m) => [m, ''])),
    'Total / Posição': '',
  })

  // Função auxiliar para adicionar linha numérica
  const addLinha = (
    cat: string,
    metrica: string,
    getter: (m: (typeof resultado.meses)[0]) => number,
    total: number,
  ) => {
    const row: Record<string, any> = {
      Categoria: cat,
      Métrica: metrica,
    }
    resultado.meses.forEach((m) => {
      row[m.mesAbrev] = formatMoedaExcel(getter(m))
    })
    row['Total / Posição'] = formatMoedaExcel(total)
    rows.push(row)
  }

  // Função auxiliar para indicadores (% ou x)
  const addLinhaIndicador = (
    cat: string,
    metrica: string,
    getter: (m: (typeof resultado.meses)[0]) => number | null,
    total: number | null,
    sulfixo = '',
  ) => {
    const row: Record<string, any> = {
      Categoria: cat,
      Métrica: metrica,
    }
    resultado.meses.forEach((m) => {
      row[m.mesAbrev] = formatIndicadorExcel(getter(m), sulfixo)
    })
    row['Total / Posição'] = formatIndicadorExcel(total, sulfixo)
    rows.push(row)
  }

  // 1. DRE MENSAL (FLUXO)
  addLinha(
    '1. DRE (Fluxo)',
    '(+) Receita Bruta / Faturamento',
    (m) => m.receitaBruta,
    resultado.totalExercicio.receitaBruta,
  )
  addLinha(
    '1. DRE (Fluxo)',
    '(=) Receita Líquida',
    (m) => m.receitaLiquida,
    resultado.totalExercicio.receitaLiquida,
  )
  addLinha(
    '1. DRE (Fluxo)',
    '(-) Custos / Despesas Variáveis',
    (m) => m.custosVariaveis,
    resultado.totalExercicio.custosVariaveis,
  )
  addLinha(
    '1. DRE (Fluxo)',
    '(-) Despesas Fixas Operacionais',
    (m) => m.despesasFixas,
    resultado.totalExercicio.despesasFixas,
  )
  addLinha(
    '1. DRE (Fluxo)',
    '(-) Despesas Financeiras',
    (m) => m.despesasFinanceiras,
    resultado.totalExercicio.despesasFinanceiras,
  )
  addLinha(
    '1. DRE (Fluxo)',
    '(+) Receitas Financeiras',
    (m) => m.receitasFinanceiras,
    resultado.totalExercicio.receitasFinanceiras,
  )
  addLinha(
    '1. DRE (Fluxo)',
    '(=) EBITDA Estimado',
    (m) => m.ebitda,
    resultado.totalExercicio.ebitda,
  )
  addLinha(
    '1. DRE (Fluxo)',
    '(=) Resultado Líquido (Lucro/Prejuízo)',
    (m) => m.resultadoLiquido,
    resultado.totalExercicio.resultadoLiquido,
  )
  addLinhaIndicador(
    '1. DRE (Fluxo)',
    'Margem Líquida (%)',
    (m) => m.margemLiquida,
    resultado.totalExercicio.margemLiquida,
    '%',
  )

  // Separador
  rows.push({
    Categoria: '',
    Métrica: '',
    ...Object.fromEntries(NOMES_MESES_ABREV.map((m) => [m, ''])),
    'Total / Posição': '',
  })

  // 2. BALANÇO PATRIMONIAL (ESTOQUE)
  addLinha(
    '2. Balanço (Estoque)',
    'Ativo Total',
    (m) => m.ativoTotal,
    resultado.totalExercicio.ativoTotal,
  )
  addLinha(
    '2. Balanço (Estoque)',
    '  Ativo Circulante',
    (m) => m.ativoCirculante,
    resultado.totalExercicio.ativoCirculante,
  )
  addLinha(
    '2. Balanço (Estoque)',
    '    Caixa e Equivalentes',
    (m) => m.caixaEquivalentes,
    resultado.totalExercicio.caixaEquivalentes,
  )
  addLinha(
    '2. Balanço (Estoque)',
    '    Contas a Receber (Clientes)',
    (m) => m.contasReceber,
    resultado.totalExercicio.contasReceber,
  )
  addLinha(
    '2. Balanço (Estoque)',
    '    Estoques',
    (m) => m.estoques,
    resultado.totalExercicio.estoques,
  )
  addLinha(
    '2. Balanço (Estoque)',
    '  Ativo Não Circulante',
    (m) => m.ativoNaoCirculante,
    resultado.totalExercicio.ativoNaoCirculante,
  )
  addLinha(
    '2. Balanço (Estoque)',
    '    Realizável a Longo Prazo',
    (m) => m.realizavelLongoPrazo,
    resultado.totalExercicio.realizavelLongoPrazo,
  )
  addLinha(
    '2. Balanço (Estoque)',
    'Passivo Total (Exigível)',
    (m) => m.passivoTotal,
    resultado.totalExercicio.passivoTotal,
  )
  addLinha(
    '2. Balanço (Estoque)',
    '  Passivo Circulante',
    (m) => m.passivoCirculante,
    resultado.totalExercicio.passivoCirculante,
  )
  addLinha(
    '2. Balanço (Estoque)',
    '    Fornecedores',
    (m) => m.fornecedores,
    resultado.totalExercicio.fornecedores,
  )
  addLinha(
    '2. Balanço (Estoque)',
    '  Passivo Não Circulante',
    (m) => m.passivoNaoCirculante,
    resultado.totalExercicio.passivoNaoCirculante,
  )
  addLinha(
    '2. Balanço (Estoque)',
    'Patrimônio Líquido',
    (m) => m.patrimonioLiquido,
    resultado.totalExercicio.patrimonioLiquido,
  )

  // Separador
  rows.push({
    Categoria: '',
    Métrica: '',
    ...Object.fromEntries(NOMES_MESES_ABREV.map((m) => [m, ''])),
    'Total / Posição': '',
  })

  // 3. INDICADORES DERIVADOS
  addLinhaIndicador(
    '3. Indicadores Derivados',
    'Liquidez Corrente (AC / PC)',
    (m) => m.liquidezCorrente,
    resultado.totalExercicio.liquidezCorrente,
    'x',
  )
  addLinhaIndicador(
    '3. Indicadores Derivados',
    'Liquidez Geral [(AC+RLP) / (PC+PNC)]',
    (m) => m.liquidezGeral,
    resultado.totalExercicio.liquidezGeral,
    'x',
  )
  addLinhaIndicador(
    '3. Indicadores Derivados',
    'Endividamento Total / PL (Passivo Total / PL)',
    (m) => m.endividamentoTotalPl,
    resultado.totalExercicio.endividamentoTotalPl,
    'x',
  )
  addLinhaIndicador(
    '3. Indicadores Derivados',
    'Endividamento CP / PL (PC / PL)',
    (m) => m.endividamentoPcPl,
    resultado.totalExercicio.endividamentoPcPl,
    'x',
  )
  addLinhaIndicador(
    '3. Indicadores Derivados',
    'Endividamento Geral s/ Ativo (%)',
    (m) => m.endividamentoGeralAt,
    resultado.totalExercicio.endividamentoGeralAt,
    '%',
  )
  addLinhaIndicador(
    '3. Indicadores Derivados',
    'ROE do Período (Resultado Líquido / PL %)',
    (m) => m.roeMensal,
    resultado.totalExercicio.roeAcumulado,
    '%',
  )

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows)

  // Ajuste das larguras das colunas
  const cols = [
    { wch: 26 }, // Categoria
    { wch: 40 }, // Métrica
    ...NOMES_MESES_ABREV.map(() => ({ wch: 15 })),
    { wch: 20 }, // Total / Posição
  ]
  ws['!cols'] = cols

  XLSX.utils.book_append_sheet(wb, ws, 'Comparativo DRE x Balanço')
  XLSX.writeFile(wb, fileName)
}

export function exportarComparativoDreBalancoCsv(
  resultado: ComparativoDreBalancoResultado,
  opcoes?: OpcoesExportacaoComparativo,
) {
  const identificador =
    opcoes?.isGrupo && opcoes.nomeGrupo
      ? `Grupo_${opcoes.nomeGrupo}`
      : opcoes?.empresa?.nome || (opcoes?.isGrupo ? 'Grupo_Economico' : resultado.empresaNome)

  const safeEntidade = sanitizeNomeArquivo(identificador)
  const exercicio = opcoes?.exercicioAno || resultado.ano
  const fileName = `Comparativo_DRE_Balanco_${safeEntidade}_${exercicio}.csv`

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

  const formatIndCsv = (v: number | undefined | null, suf = '') => {
    if (v === undefined || v === null) return '—'
    return `${v.toFixed(2).replace('.', ',')}${suf}`
  }

  const colunas = ['Categoria', 'Métrica', ...NOMES_MESES_ABREV, 'Total / Posição']
  const linhas: string[] = [colunas.map(escapeCsv).join(';')]

  const addLinha = (
    cat: string,
    metrica: string,
    getter: (m: (typeof resultado.meses)[0]) => number,
    total: number,
  ) => {
    const vals = [
      cat,
      metrica,
      ...resultado.meses.map((m) => formatMoedaCsv(getter(m))),
      formatMoedaCsv(total),
    ]
    linhas.push(vals.map(escapeCsv).join(';'))
  }

  const addLinhaInd = (
    cat: string,
    metrica: string,
    getter: (m: (typeof resultado.meses)[0]) => number | null,
    total: number | null,
    suf = '',
  ) => {
    const vals = [
      cat,
      metrica,
      ...resultado.meses.map((m) => formatIndCsv(getter(m), suf)),
      formatIndCsv(total, suf),
    ]
    linhas.push(vals.map(escapeCsv).join(';'))
  }

  // DRE
  addLinha('DRE', 'Receita Bruta', (m) => m.receitaBruta, resultado.totalExercicio.receitaBruta)
  addLinha(
    'DRE',
    'Receita Líquida',
    (m) => m.receitaLiquida,
    resultado.totalExercicio.receitaLiquida,
  )
  addLinha(
    'DRE',
    'Custos/Despesas Variáveis',
    (m) => m.custosVariaveis,
    resultado.totalExercicio.custosVariaveis,
  )
  addLinha('DRE', 'Despesas Fixas', (m) => m.despesasFixas, resultado.totalExercicio.despesasFixas)
  addLinha(
    'DRE',
    'Despesas Financeiras',
    (m) => m.despesasFinanceiras,
    resultado.totalExercicio.despesasFinanceiras,
  )
  addLinha(
    'DRE',
    'Receitas Financeiras',
    (m) => m.receitasFinanceiras,
    resultado.totalExercicio.receitasFinanceiras,
  )
  addLinha('DRE', 'EBITDA Estimado', (m) => m.ebitda, resultado.totalExercicio.ebitda)
  addLinha(
    'DRE',
    'Resultado Líquido',
    (m) => m.resultadoLiquido,
    resultado.totalExercicio.resultadoLiquido,
  )
  addLinhaInd(
    'DRE',
    'Margem Líquida (%)',
    (m) => m.margemLiquida,
    resultado.totalExercicio.margemLiquida,
    '%',
  )

  // Balanço
  addLinha('Balanço', 'Ativo Total', (m) => m.ativoTotal, resultado.totalExercicio.ativoTotal)
  addLinha(
    'Balanço',
    'Ativo Circulante',
    (m) => m.ativoCirculante,
    resultado.totalExercicio.ativoCirculante,
  )
  addLinha(
    'Balanço',
    'Caixa e Equivalentes',
    (m) => m.caixaEquivalentes,
    resultado.totalExercicio.caixaEquivalentes,
  )
  addLinha(
    'Balanço',
    'Contas a Receber',
    (m) => m.contasReceber,
    resultado.totalExercicio.contasReceber,
  )
  addLinha('Balanço', 'Estoques', (m) => m.estoques, resultado.totalExercicio.estoques)
  addLinha(
    'Balanço',
    'Ativo Não Circulante',
    (m) => m.ativoNaoCirculante,
    resultado.totalExercicio.ativoNaoCirculante,
  )
  addLinha(
    'Balanço',
    'Realizável a Longo Prazo',
    (m) => m.realizavelLongoPrazo,
    resultado.totalExercicio.realizavelLongoPrazo,
  )
  addLinha('Balanço', 'Passivo Total', (m) => m.passivoTotal, resultado.totalExercicio.passivoTotal)
  addLinha(
    'Balanço',
    'Passivo Circulante',
    (m) => m.passivoCirculante,
    resultado.totalExercicio.passivoCirculante,
  )
  addLinha('Balanço', 'Fornecedores', (m) => m.fornecedores, resultado.totalExercicio.fornecedores)
  addLinha(
    'Balanço',
    'Passivo Não Circulante',
    (m) => m.passivoNaoCirculante,
    resultado.totalExercicio.passivoNaoCirculante,
  )
  addLinha(
    'Balanço',
    'Patrimônio Líquido',
    (m) => m.patrimonioLiquido,
    resultado.totalExercicio.patrimonioLiquido,
  )

  // Indicadores
  addLinhaInd(
    'Indicadores',
    'Liquidez Corrente',
    (m) => m.liquidezCorrente,
    resultado.totalExercicio.liquidezCorrente,
    'x',
  )
  addLinhaInd(
    'Indicadores',
    'Liquidez Geral',
    (m) => m.liquidezGeral,
    resultado.totalExercicio.liquidezGeral,
    'x',
  )
  addLinhaInd(
    'Indicadores',
    'Endividamento Total / PL',
    (m) => m.endividamentoTotalPl,
    resultado.totalExercicio.endividamentoTotalPl,
    'x',
  )
  addLinhaInd(
    'Indicadores',
    'Endividamento PC / PL',
    (m) => m.endividamentoPcPl,
    resultado.totalExercicio.endividamentoPcPl,
    'x',
  )
  addLinhaInd(
    'Indicadores',
    'Endividamento s/ Ativo (%)',
    (m) => m.endividamentoGeralAt,
    resultado.totalExercicio.endividamentoGeralAt,
    '%',
  )
  addLinhaInd(
    'Indicadores',
    'ROE (%)',
    (m) => m.roeMensal,
    resultado.totalExercicio.roeAcumulado,
    '%',
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
