import * as XLSX from 'xlsx'
import type { FluxoCaixaDreResultado } from './fluxoCaixaDreCalculo'
import type { EmpresaRecord } from '@/types/finance'
import { sanitizeNomeArquivo } from './exportacaoPlanoContas'

/**
 * Exporta o Fluxo de Caixa por grupo DRE para arquivo Excel (.xlsx)
 */
export function exportarFluxoCaixaDreExcel(
  fluxo: FluxoCaixaDreResultado,
  empresa?: EmpresaRecord | null,
) {
  const nomeEmpresa = empresa?.nome || 'Empresa'
  const safeEmpresa = sanitizeNomeArquivo(nomeEmpresa)
  const dataHoje = new Date().toISOString().slice(0, 10)
  const fileName = `fluxo-caixa-dre-${safeEmpresa}-${dataHoje}.xlsx`

  const rows: Array<Record<string, any>> = []

  const adicionarLinha = (
    titulo: string,
    tipo: string,
    valoresPorMes: Record<string, number>,
    total: number,
  ) => {
    const linha: Record<string, any> = {
      Estrutura: titulo,
      Tipo: tipo,
    }
    for (const m of fluxo.meses) {
      linha[m.rotuloCurto] = valoresPorMes[m.chave] || 0
    }
    linha['Total do Período'] = total
    rows.push(linha)
  }

  // 1. Entradas Operacionais
  adicionarLinha(
    fluxo.entradasOperacionais.titulo,
    'Grupo (Entrada)',
    fluxo.entradasOperacionais.valoresPorMes,
    fluxo.entradasOperacionais.totalPeriodo,
  )
  for (const c of fluxo.contasEntradasOperacionais) {
    const centro = c.centroNome ? `[${c.centroNome}] ` : ''
    const tipo = c.tipoDespesaNome ? `[${c.tipoDespesaNome}] ` : ''
    const cod = c.codigo ? `${c.codigo} — ` : ''
    adicionarLinha(
      `    ${centro}${tipo}${cod}${c.nome}`,
      'Conta Operacional',
      c.valoresPorMes,
      c.totalPeriodo,
    )
  }

  // 2. Saídas Operacionais (com cabeçalhos de Centro de Custo e Tipo de Despesa)
  adicionarLinha(
    fluxo.saidasOperacionais.titulo,
    'Grupo (Saída)',
    fluxo.saidasOperacionais.valoresPorMes,
    fluxo.saidasOperacionais.totalPeriodo,
  )
  let ultimoCentroXlsxOp: string | null = null
  let ultimoTipoXlsxOp: string | null = null

  for (const c of fluxo.contasSaidasOperacionais) {
    const centroAtual =
      c.centroNome?.trim() || (c.centroId ? `Centro ${c.centroId}` : 'Sem Centro de Custo')
    const centroKey = c.centroId || c.centroNome || '__SEM_CENTRO__'

    const tipoAtual =
      c.tipoDespesaNome?.trim() ||
      (c.tipoDespesaId ? `Tipo ${c.tipoDespesaId}` : 'Sem Tipo de Despesa')
    const tipoKey = `${centroKey}__${c.tipoDespesaId || c.tipoDespesaNome || '__SEM_TIPO__'}`

    if (centroKey !== ultimoCentroXlsxOp) {
      ultimoCentroXlsxOp = centroKey
      ultimoTipoXlsxOp = null
      const rowCentro: Record<string, any> = {
        Estrutura: `▶ CENTRO DE CUSTO: ${centroAtual.toUpperCase()}`,
        Tipo: 'Grupo Centro',
      }
      for (const m of fluxo.meses) {
        rowCentro[m.rotuloCurto] = ''
      }
      rowCentro['Total do Período'] = ''
      rows.push(rowCentro)
    }

    if (tipoKey !== ultimoTipoXlsxOp) {
      ultimoTipoXlsxOp = tipoKey
      const rowTipo: Record<string, any> = {
        Estrutura: `    ▶ TIPO DE DESPESA: ${tipoAtual.toUpperCase()}`,
        Tipo: 'Grupo Tipo',
      }
      for (const m of fluxo.meses) {
        rowTipo[m.rotuloCurto] = ''
      }
      rowTipo['Total do Período'] = ''
      rows.push(rowTipo)
    }

    const cod = c.codigo ? `${c.codigo} — ` : ''
    adicionarLinha(`        ${cod}${c.nome}`, 'Conta Operacional', c.valoresPorMes, c.totalPeriodo)
  }

  // 3. = Geração Operacional
  adicionarLinha(
    fluxo.geracaoOperacional.titulo,
    'Subtotal',
    fluxo.geracaoOperacional.valoresPorMes,
    fluxo.geracaoOperacional.totalPeriodo,
  )

  rows.push({ Estrutura: '', Tipo: '' })

  // 4. Entradas Financeiras
  adicionarLinha(
    fluxo.entradasFinanceiras.titulo,
    'Grupo (Entrada)',
    fluxo.entradasFinanceiras.valoresPorMes,
    fluxo.entradasFinanceiras.totalPeriodo,
  )
  for (const c of fluxo.contasEntradasFinanceiras) {
    const centro = c.centroNome ? `[${c.centroNome}] ` : ''
    const tipo = c.tipoDespesaNome ? `[${c.tipoDespesaNome}] ` : ''
    const cod = c.codigo ? `${c.codigo} — ` : ''
    adicionarLinha(
      `    ${centro}${tipo}${cod}${c.nome}`,
      'Conta Financeira',
      c.valoresPorMes,
      c.totalPeriodo,
    )
  }

  // 5. Saídas Financeiras (com cabeçalhos de Centro de Custo e Tipo de Despesa)
  adicionarLinha(
    fluxo.saidasFinanceiras.titulo,
    'Grupo (Saída)',
    fluxo.saidasFinanceiras.valoresPorMes,
    fluxo.saidasFinanceiras.totalPeriodo,
  )
  let ultimoCentroXlsxFin: string | null = null
  let ultimoTipoXlsxFin: string | null = null

  for (const c of fluxo.contasSaidasFinanceiras) {
    const centroAtual =
      c.centroNome?.trim() || (c.centroId ? `Centro ${c.centroId}` : 'Sem Centro de Custo')
    const centroKey = c.centroId || c.centroNome || '__SEM_CENTRO__'

    const tipoAtual =
      c.tipoDespesaNome?.trim() ||
      (c.tipoDespesaId ? `Tipo ${c.tipoDespesaId}` : 'Sem Tipo de Despesa')
    const tipoKey = `${centroKey}__${c.tipoDespesaId || c.tipoDespesaNome || '__SEM_TIPO__'}`

    if (centroKey !== ultimoCentroXlsxFin) {
      ultimoCentroXlsxFin = centroKey
      ultimoTipoXlsxFin = null
      const rowCentro: Record<string, any> = {
        Estrutura: `▶ CENTRO DE CUSTO: ${centroAtual.toUpperCase()}`,
        Tipo: 'Grupo Centro',
      }
      for (const m of fluxo.meses) {
        rowCentro[m.rotuloCurto] = ''
      }
      rowCentro['Total do Período'] = ''
      rows.push(rowCentro)
    }

    if (tipoKey !== ultimoTipoXlsxFin) {
      ultimoTipoXlsxFin = tipoKey
      const rowTipo: Record<string, any> = {
        Estrutura: `    ▶ TIPO DE DESPESA: ${tipoAtual.toUpperCase()}`,
        Tipo: 'Grupo Tipo',
      }
      for (const m of fluxo.meses) {
        rowTipo[m.rotuloCurto] = ''
      }
      rowTipo['Total do Período'] = ''
      rows.push(rowTipo)
    }

    const cod = c.codigo ? `${c.codigo} — ` : ''
    adicionarLinha(`        ${cod}${c.nome}`, 'Conta Financeira', c.valoresPorMes, c.totalPeriodo)
  }

  // 6. = Geração Financeira
  adicionarLinha(
    fluxo.geracaoFinanceira.titulo,
    'Subtotal',
    fluxo.geracaoFinanceira.valoresPorMes,
    fluxo.geracaoFinanceira.totalPeriodo,
  )

  rows.push({ Estrutura: '', Tipo: '' })

  // 7. = Fluxo de Caixa Total
  adicionarLinha(
    fluxo.fluxoCaixaTotal.titulo,
    'Resultado Total',
    fluxo.fluxoCaixaTotal.valoresPorMes,
    fluxo.fluxoCaixaTotal.totalPeriodo,
  )

  // 8. Saldo Acumulado
  adicionarLinha(
    fluxo.saldoAcumulado.titulo,
    'Saldo Acumulado',
    fluxo.saldoAcumulado.valoresPorMes,
    fluxo.saldoAcumulado.saldoFinal,
  )

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows)

  const cols = [
    { wch: 48 }, // Estrutura
    { wch: 18 }, // Tipo
  ]
  for (let i = 0; i < fluxo.meses.length; i++) {
    cols.push({ wch: 16 })
  }
  cols.push({ wch: 20 })
  ws['!cols'] = cols

  XLSX.utils.book_append_sheet(wb, ws, 'Fluxo de Caixa DRE')
  XLSX.writeFile(wb, fileName)
}

/**
 * Exporta o Fluxo de Caixa por grupo DRE para arquivo CSV delimitado por ponto e vírgula
 */
export function exportarFluxoCaixaDreCsv(
  fluxo: FluxoCaixaDreResultado,
  empresa?: EmpresaRecord | null,
) {
  const nomeEmpresa = empresa?.nome || 'Empresa'
  const safeEmpresa = sanitizeNomeArquivo(nomeEmpresa)
  const dataHoje = new Date().toISOString().slice(0, 10)
  const fileName = `fluxo-caixa-dre-${safeEmpresa}-${dataHoje}.csv`

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
    ...fluxo.meses.map((m) => m.rotuloCurto),
    'Total do Período',
  ]
  const linhas: string[] = [colunas.map(escapeCsv).join(';')]

  const pushLinha = (
    titulo: string,
    tipo: string,
    valoresPorMes: Record<string, number>,
    total: number,
  ) => {
    linhas.push(
      [
        titulo,
        tipo,
        ...fluxo.meses.map((m) => formatMoedaCsv(valoresPorMes[m.chave])),
        formatMoedaCsv(total),
      ]
        .map(escapeCsv)
        .join(';'),
    )
  }

  // 1. Entradas Operacionais
  pushLinha(
    fluxo.entradasOperacionais.titulo,
    'Entrada',
    fluxo.entradasOperacionais.valoresPorMes,
    fluxo.entradasOperacionais.totalPeriodo,
  )
  for (const c of fluxo.contasEntradasOperacionais) {
    const centro = c.centroNome ? `[${c.centroNome}] ` : ''
    const tipo = c.tipoDespesaNome ? `[${c.tipoDespesaNome}] ` : ''
    const cod = c.codigo ? `${c.codigo} — ` : ''
    pushLinha(`  ${centro}${tipo}${cod}${c.nome}`, 'Conta', c.valoresPorMes, c.totalPeriodo)
  }

  // 2. Saídas Operacionais (com cabeçalhos de Centro de Custo e Tipo de Despesa)
  pushLinha(
    fluxo.saidasOperacionais.titulo,
    'Saída',
    fluxo.saidasOperacionais.valoresPorMes,
    fluxo.saidasOperacionais.totalPeriodo,
  )
  let ultimoCentroCsvOp: string | null = null
  let ultimoTipoCsvOp: string | null = null

  for (const c of fluxo.contasSaidasOperacionais) {
    const centroAtual =
      c.centroNome?.trim() || (c.centroId ? `Centro ${c.centroId}` : 'Sem Centro de Custo')
    const centroKey = c.centroId || c.centroNome || '__SEM_CENTRO__'

    const tipoAtual =
      c.tipoDespesaNome?.trim() ||
      (c.tipoDespesaId ? `Tipo ${c.tipoDespesaId}` : 'Sem Tipo de Despesa')
    const tipoKey = `${centroKey}__${c.tipoDespesaId || c.tipoDespesaNome || '__SEM_TIPO__'}`

    if (centroKey !== ultimoCentroCsvOp) {
      ultimoCentroCsvOp = centroKey
      ultimoTipoCsvOp = null
      const linhaCentro = [`▶ CENTRO DE CUSTO: ${centroAtual.toUpperCase()}`, 'Grupo Centro']
      for (let i = 0; i < fluxo.meses.length; i++) {
        linhaCentro.push('')
      }
      linhaCentro.push('')
      linhas.push(linhaCentro.map(escapeCsv).join(';'))
    }

    if (tipoKey !== ultimoTipoCsvOp) {
      ultimoTipoCsvOp = tipoKey
      const linhaTipo = [`    ▶ TIPO DE DESPESA: ${tipoAtual.toUpperCase()}`, 'Grupo Tipo']
      for (let i = 0; i < fluxo.meses.length; i++) {
        linhaTipo.push('')
      }
      linhaTipo.push('')
      linhas.push(linhaTipo.map(escapeCsv).join(';'))
    }

    const cod = c.codigo ? `${c.codigo} — ` : ''
    pushLinha(`        ${cod}${c.nome}`, 'Conta', c.valoresPorMes, c.totalPeriodo)
  }

  // 3. = Geração Operacional
  pushLinha(
    fluxo.geracaoOperacional.titulo,
    'Subtotal',
    fluxo.geracaoOperacional.valoresPorMes,
    fluxo.geracaoOperacional.totalPeriodo,
  )

  // 4. Entradas Financeiras
  pushLinha(
    fluxo.entradasFinanceiras.titulo,
    'Entrada',
    fluxo.entradasFinanceiras.valoresPorMes,
    fluxo.entradasFinanceiras.totalPeriodo,
  )
  for (const c of fluxo.contasEntradasFinanceiras) {
    const centro = c.centroNome ? `[${c.centroNome}] ` : ''
    const tipo = c.tipoDespesaNome ? `[${c.tipoDespesaNome}] ` : ''
    const cod = c.codigo ? `${c.codigo} — ` : ''
    pushLinha(`  ${centro}${tipo}${cod}${c.nome}`, 'Conta', c.valoresPorMes, c.totalPeriodo)
  }

  // 5. Saídas Financeiras (com cabeçalhos de Centro de Custo e Tipo de Despesa)
  pushLinha(
    fluxo.saidasFinanceiras.titulo,
    'Saída',
    fluxo.saidasFinanceiras.valoresPorMes,
    fluxo.saidasFinanceiras.totalPeriodo,
  )
  let ultimoCentroCsvFin: string | null = null
  let ultimoTipoCsvFin: string | null = null

  for (const c of fluxo.contasSaidasFinanceiras) {
    const centroAtual =
      c.centroNome?.trim() || (c.centroId ? `Centro ${c.centroId}` : 'Sem Centro de Custo')
    const centroKey = c.centroId || c.centroNome || '__SEM_CENTRO__'

    const tipoAtual =
      c.tipoDespesaNome?.trim() ||
      (c.tipoDespesaId ? `Tipo ${c.tipoDespesaId}` : 'Sem Tipo de Despesa')
    const tipoKey = `${centroKey}__${c.tipoDespesaId || c.tipoDespesaNome || '__SEM_TIPO__'}`

    if (centroKey !== ultimoCentroCsvFin) {
      ultimoCentroCsvFin = centroKey
      ultimoTipoCsvFin = null
      const linhaCentro = [`▶ CENTRO DE CUSTO: ${centroAtual.toUpperCase()}`, 'Grupo Centro']
      for (let i = 0; i < fluxo.meses.length; i++) {
        linhaCentro.push('')
      }
      linhaCentro.push('')
      linhas.push(linhaCentro.map(escapeCsv).join(';'))
    }

    if (tipoKey !== ultimoTipoCsvFin) {
      ultimoTipoCsvFin = tipoKey
      const linhaTipo = [`    ▶ TIPO DE DESPESA: ${tipoAtual.toUpperCase()}`, 'Grupo Tipo']
      for (let i = 0; i < fluxo.meses.length; i++) {
        linhaTipo.push('')
      }
      linhaTipo.push('')
      linhas.push(linhaTipo.map(escapeCsv).join(';'))
    }

    const cod = c.codigo ? `${c.codigo} — ` : ''
    pushLinha(`        ${cod}${c.nome}`, 'Conta', c.valoresPorMes, c.totalPeriodo)
  }

  // 6. = Geração Financeira
  pushLinha(
    fluxo.geracaoFinanceira.titulo,
    'Subtotal',
    fluxo.geracaoFinanceira.valoresPorMes,
    fluxo.geracaoFinanceira.totalPeriodo,
  )

  // 7. = Fluxo de Caixa Total
  pushLinha(
    fluxo.fluxoCaixaTotal.titulo,
    'Resultado Total',
    fluxo.fluxoCaixaTotal.valoresPorMes,
    fluxo.fluxoCaixaTotal.totalPeriodo,
  )

  // 8. Saldo Acumulado
  pushLinha(
    fluxo.saldoAcumulado.titulo,
    'Saldo Acumulado',
    fluxo.saldoAcumulado.valoresPorMes,
    fluxo.saldoAcumulado.saldoFinal,
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
