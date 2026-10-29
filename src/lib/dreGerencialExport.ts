import * as XLSX from 'xlsx'
import type { DreMatrizResultado, DreComparativoResultado } from './dreGerencialTypes'
import type { EmpresaRecord } from '@/types/finance'
import { sanitizeNomeArquivo } from './exportacaoPlanoContas'

/**
 * Exporta a matriz comparativa da DRE Gerencial para arquivo Excel (.xlsx)
 */
export function exportarDreComparativoExcel(
  comparativo: DreComparativoResultado,
  empresaOuOpcoes?: EmpresaRecord | null | OpcoesExportacaoDre,
) {
  let opcoes: OpcoesExportacaoDre = {}
  if (empresaOuOpcoes && 'id' in empresaOuOpcoes) {
    opcoes = { empresa: empresaOuOpcoes }
  } else if (empresaOuOpcoes) {
    opcoes = empresaOuOpcoes as OpcoesExportacaoDre
  }

  const identificadorEntidade =
    opcoes.isGrupo && opcoes.nomeGrupo
      ? `Grupo_${opcoes.nomeGrupo}`
      : opcoes.empresa?.nome || (opcoes.isGrupo ? 'Grupo_Economico' : 'Consolidado')
  const safeEntidade = sanitizeNomeArquivo(identificadorEntidade)
  const exercicio =
    opcoes.exercicioAno ||
    (comparativo.matriz1.meses.length > 0
      ? comparativo.matriz1.meses[0].ano
      : new Date().getFullYear())
  const fileName = `DRE_Comparativo_${safeEntidade}_${exercicio}.xlsx`

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
      const centroStr = conta.centroNome ? `[${conta.centroNome}] ` : ''
      const tipoStr = conta.tipoDespesaNome ? `[${conta.tipoDespesaNome}] ` : ''
      const codStr = conta.codigo ? `${conta.codigo} — ` : ''
      rows.push({
        Estrutura: `    ${centroStr}${tipoStr}${codStr}${conta.nome}`,
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
      const centroStr = conta.centroNome ? `[${conta.centroNome}] ` : ''
      const tipoStr = conta.tipoDespesaNome ? `[${conta.tipoDespesaNome}] ` : ''
      const codStr = conta.codigo ? `${conta.codigo} — ` : ''
      rows.push({
        Estrutura: `    ${centroStr}${tipoStr}${codStr}${conta.nome}`,
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
  empresaOuOpcoes?: EmpresaRecord | null | OpcoesExportacaoDre,
) {
  let opcoes: OpcoesExportacaoDre = {}
  if (empresaOuOpcoes && 'id' in empresaOuOpcoes) {
    opcoes = { empresa: empresaOuOpcoes }
  } else if (empresaOuOpcoes) {
    opcoes = empresaOuOpcoes as OpcoesExportacaoDre
  }

  const identificadorEntidade =
    opcoes.isGrupo && opcoes.nomeGrupo
      ? `Grupo_${opcoes.nomeGrupo}`
      : opcoes.empresa?.nome || (opcoes.isGrupo ? 'Grupo_Economico' : 'Consolidado')
  const safeEntidade = sanitizeNomeArquivo(identificadorEntidade)
  const exercicio =
    opcoes.exercicioAno ||
    (comparativo.matriz1.meses.length > 0
      ? comparativo.matriz1.meses[0].ano
      : new Date().getFullYear())
  const fileName = `DRE_Comparativo_${safeEntidade}_${exercicio}.csv`

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
      const centroStr = conta.centroNome ? `[${conta.centroNome}] ` : ''
      const tipoStr = conta.tipoDespesaNome ? `[${conta.tipoDespesaNome}] ` : ''
      const codStr = conta.codigo ? `${conta.codigo} — ` : ''
      linhas.push(
        [
          `  ${centroStr}${tipoStr}${codStr}${conta.nome}`,
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
export interface OpcoesExportacaoDre {
  empresa?: EmpresaRecord | null
  exercicioAno?: number | string
  periodoDescricao?: string
  isGrupo?: boolean
  nomeGrupo?: string
}

/**
 * Exporta a matriz da DRE Gerencial para arquivo Excel (.xlsx) com layout de linhas,
 * seções hierárquicas, colunas mensais e totalizadores consolidados.
 */
export function exportarDreGerencialExcel(
  matriz: DreMatrizResultado,
  empresaOuOpcoes?: EmpresaRecord | null | OpcoesExportacaoDre,
  periodoDescricaoLegado?: string,
) {
  // Suporte flexível para compatibilidade com assinaturas anteriores
  let opcoes: OpcoesExportacaoDre = {}
  if (empresaOuOpcoes && 'id' in empresaOuOpcoes) {
    opcoes = {
      empresa: empresaOuOpcoes,
      periodoDescricao: periodoDescricaoLegado,
    }
  } else if (empresaOuOpcoes) {
    opcoes = empresaOuOpcoes as OpcoesExportacaoDre
  }

  const identificadorEntidade =
    opcoes.isGrupo && opcoes.nomeGrupo
      ? `Grupo_${opcoes.nomeGrupo}`
      : opcoes.empresa?.nome || (opcoes.isGrupo ? 'Grupo_Economico' : 'Consolidado')
  const safeEntidade = sanitizeNomeArquivo(identificadorEntidade)

  // Identificação do exercício/período
  const exercicio =
    opcoes.exercicioAno ||
    (matriz.meses.length > 0 ? matriz.meses[0].ano : new Date().getFullYear())
  const fileName = `DRE_Gerencial_${safeEntidade}_${exercicio}.xlsx`

  const rows: Array<Record<string, any>> = []

  // 1. Linhas de cabeçalho informativo de contexto
  const descPeriodo =
    opcoes.periodoDescricao ||
    (matriz.meses.length > 0
      ? `${matriz.meses[0].rotuloCurto} a ${matriz.meses[matriz.meses.length - 1].rotuloCurto}`
      : String(exercicio))

  // Cabeçalho de metadados
  const rowMeta1: Record<string, any> = {
    Código: 'DEMONSTRAÇÃO DO RESULTADO DO EXERCÍCIO (DRE GERENCIAL)',
    Descrição: '',
    'Centro de Custo': '',
    'Tipo de Despesa': '',
    Nível: 'CABEÇALHO',
  }
  for (const m of matriz.meses) rowMeta1[m.rotuloCurto] = ''
  rowMeta1['Total do Período'] = ''
  rows.push(rowMeta1)

  const rowMeta2: Record<string, any> = {
    Código: `Entidade: ${opcoes.isGrupo && opcoes.nomeGrupo ? `Grupo Econômico ${opcoes.nomeGrupo}` : opcoes.empresa?.nome || 'Todas as Empresas (Consolidado)'}`,
    Descrição: `Exercício/Período: ${descPeriodo}`,
    'Centro de Custo': '',
    'Tipo de Despesa': '',
    Nível: '',
  }
  for (const m of matriz.meses) rowMeta2[m.rotuloCurto] = ''
  rowMeta2['Total do Período'] = ''
  rows.push(rowMeta2)

  // Linha em branco separadora
  rows.push({ Código: '', Descrição: '', 'Centro de Custo': '', 'Tipo de Despesa': '', Nível: '' })

  // 2. Seções e contas da DRE
  for (const grupo of matriz.grupos) {
    // Linha de Cabeçalho/Subtotal da Seção
    const linhaGrupo: Record<string, any> = {
      Código: '',
      Descrição: grupo.titulo.toUpperCase(),
      'Centro de Custo': '',
      'Tipo de Despesa': '',
      Nível: 'Seção',
    }
    for (const m of matriz.meses) {
      linhaGrupo[m.rotuloCurto] = grupo.valoresPorMes[m.chave] || 0
    }
    linhaGrupo['Total do Período'] = grupo.totalPeriodo
    rows.push(linhaGrupo)

    // Agrupamento e detalhamento de contas por Centro de Custo e Tipo de Despesa
    let ultimoCentroKey: string | null = null
    let ultimoTipoKey: string | null = null

    for (const conta of grupo.contas) {
      const centroAtual =
        conta.centroNome?.trim() || (conta.centroId ? `Centro ${conta.centroId}` : '')
      const centroKey = conta.centroId || conta.centroNome || '__SEM_CENTRO__'

      const tipoAtual =
        conta.tipoDespesaNome?.trim() || (conta.tipoDespesaId ? `Tipo ${conta.tipoDespesaId}` : '')
      const tipoKey = `${centroKey}__${conta.tipoDespesaId || conta.tipoDespesaNome || '__SEM_TIPO__'}`

      // Cabeçalho de Centro se houver Centro especificado
      if (centroAtual && centroKey !== ultimoCentroKey) {
        ultimoCentroKey = centroKey
        ultimoTipoKey = null
        const rowCentro: Record<string, any> = {
          Código: '',
          Descrição: `  ▶ CENTRO DE CUSTO: ${centroAtual.toUpperCase()}`,
          'Centro de Custo': centroAtual,
          'Tipo de Despesa': '',
          Nível: 'Centro de Custo',
        }
        for (const m of matriz.meses) rowCentro[m.rotuloCurto] = ''
        rowCentro['Total do Período'] = ''
        rows.push(rowCentro)
      }

      // Cabeçalho de Tipo se houver Tipo especificado
      if (tipoAtual && tipoKey !== ultimoTipoKey) {
        ultimoTipoKey = tipoKey
        const rowTipo: Record<string, any> = {
          Código: '',
          Descrição: `    ▶ TIPO DE DESPESA: ${tipoAtual.toUpperCase()}`,
          'Centro de Custo': centroAtual,
          'Tipo de Despesa': tipoAtual,
          Nível: 'Tipo de Despesa',
        }
        for (const m of matriz.meses) rowTipo[m.rotuloCurto] = ''
        rowTipo['Total do Período'] = ''
        rows.push(rowTipo)
      }

      const linhaConta: Record<string, any> = {
        Código: conta.codigo || '—',
        Descrição: `      ${conta.nome}`,
        'Centro de Custo': conta.centroNome || '',
        'Tipo de Despesa': conta.tipoDespesaNome || '',
        Nível: 'Conta',
      }
      for (const m of matriz.meses) {
        linhaConta[m.rotuloCurto] = conta.valoresPorMes[m.chave] || 0
      }
      linhaConta['Total do Período'] = conta.totalPeriodo
      rows.push(linhaConta)
    }

    // Linha de Subtotal da Seção após o detalhamento (caso o grupo contenha contas)
    if (grupo.contas.length > 0) {
      const linhaSubtotal: Record<string, any> = {
        Código: '',
        Descrição: `  SUBTOTAL ${grupo.titulo.toUpperCase()}`,
        'Centro de Custo': '',
        'Tipo de Despesa': '',
        Nível: 'Subtotal Seção',
      }
      for (const m of matriz.meses) {
        linhaSubtotal[m.rotuloCurto] = grupo.valoresPorMes[m.chave] || 0
      }
      linhaSubtotal['Total do Período'] = grupo.totalPeriodo
      rows.push(linhaSubtotal)
    }

    // Linha separadora
    rows.push({
      Código: '',
      Descrição: '',
      'Centro de Custo': '',
      'Tipo de Despesa': '',
      Nível: '',
    })
  }

  // 3. Linha Totalizadora: LUCRO OU PREJUÍZO (RESULTADO LÍQUIDO)
  const linhaResultado: Record<string, any> = {
    Código: '',
    Descrição: matriz.lucroPrejuizo.titulo.toUpperCase(),
    'Centro de Custo': '',
    'Tipo de Despesa': '',
    Nível: 'Resultado Consolidado',
  }
  for (const m of matriz.meses) {
    linhaResultado[m.rotuloCurto] = matriz.lucroPrejuizo.valoresPorMes[m.chave] || 0
  }
  linhaResultado['Total do Período'] = matriz.lucroPrejuizo.totalPeriodo
  rows.push(linhaResultado)

  // 4. Margem Líquida %
  const linhaMargem: Record<string, any> = {
    Código: '',
    Descrição: 'MARGEM LÍQUIDA (% S/ RECEITAS)',
    'Centro de Custo': '',
    'Tipo de Despesa': '',
    Nível: 'Indicador',
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

  // 5. Contas Não Classificadas (se houver pendências)
  if (matriz.naoClassificados.contas.length > 0) {
    rows.push({
      Código: '',
      Descrição: '',
      'Centro de Custo': '',
      'Tipo de Despesa': '',
      Nível: '',
    })
    const linhaNc: Record<string, any> = {
      Código: '',
      Descrição: matriz.naoClassificados.titulo.toUpperCase(),
      'Centro de Custo': '',
      'Tipo de Despesa': '',
      Nível: 'Não Classificado',
    }
    for (const m of matriz.meses) {
      linhaNc[m.rotuloCurto] = matriz.naoClassificados.valoresPorMes[m.chave] || 0
    }
    linhaNc['Total do Período'] = matriz.naoClassificados.totalPeriodo
    rows.push(linhaNc)

    for (const conta of matriz.naoClassificados.contas) {
      const linhaConta: Record<string, any> = {
        Código: conta.codigo || '—',
        Descrição: `      ${conta.nome}`,
        'Centro de Custo': conta.centroNome || '',
        'Tipo de Despesa': conta.tipoDespesaNome || '',
        Nível: 'Conta Pendente',
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

  // Formatação das larguras de colunas
  const cols = [
    { wch: 14 }, // Código
    { wch: 48 }, // Descrição
    { wch: 22 }, // Centro de Custo
    { wch: 20 }, // Tipo de Despesa
    { wch: 18 }, // Nível
  ]
  for (let i = 0; i < matriz.meses.length; i++) {
    cols.push({ wch: 16 })
  }
  cols.push({ wch: 22 }) // Total do Período
  ws['!cols'] = cols

  XLSX.utils.book_append_sheet(wb, ws, 'DRE Gerencial')
  XLSX.writeFile(wb, fileName)
}

/**
 * Exporta a DRE Gerencial em formato CSV delimitado por ponto e vírgula com UTF-8 BOM
 */
export function exportarDreGerencialCsv(
  matriz: DreMatrizResultado,
  empresaOuOpcoes?: EmpresaRecord | null | OpcoesExportacaoDre,
  periodoDescricaoLegado?: string,
) {
  let opcoes: OpcoesExportacaoDre = {}
  if (empresaOuOpcoes && 'id' in empresaOuOpcoes) {
    opcoes = {
      empresa: empresaOuOpcoes,
      periodoDescricao: periodoDescricaoLegado,
    }
  } else if (empresaOuOpcoes) {
    opcoes = empresaOuOpcoes as OpcoesExportacaoDre
  }

  const identificadorEntidade =
    opcoes.isGrupo && opcoes.nomeGrupo
      ? `Grupo_${opcoes.nomeGrupo}`
      : opcoes.empresa?.nome || (opcoes.isGrupo ? 'Grupo_Economico' : 'Consolidado')
  const safeEntidade = sanitizeNomeArquivo(identificadorEntidade)
  const exercicio =
    opcoes.exercicioAno ||
    (matriz.meses.length > 0 ? matriz.meses[0].ano : new Date().getFullYear())
  const fileName = `DRE_Gerencial_${safeEntidade}_${exercicio}.csv`

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
      const centroStr = conta.centroNome ? `[${conta.centroNome}] ` : ''
      const tipoStr = conta.tipoDespesaNome ? `[${conta.tipoDespesaNome}] ` : ''
      const codStr = conta.codigo ? `${conta.codigo} — ` : ''
      linhas.push(
        [
          `  ${centroStr}${tipoStr}${codStr}${conta.nome}`,
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
