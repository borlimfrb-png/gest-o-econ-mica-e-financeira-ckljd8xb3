/**
 * Utilitários de exportação para Excel (.xlsx) e CSV da Reforma Tributária (CBS/IBS)
 */

import * as XLSX from 'xlsx'
import type { EmpresaRecord } from '@/types/finance'
import type { ReformaTributariaResultado } from './reformaTributariaCalculo'

export interface OpcoesExportacaoReforma {
  empresa?: EmpresaRecord | null
  isGrupo?: boolean
  nomeGrupo?: string
}

function formatBrlValor(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/**
 * Exporta a apuração da Reforma Tributária para arquivo Excel (.xlsx)
 */
export function exportarReformaTributariaExcel(
  resultado: ReformaTributariaResultado,
  opcoes?: OpcoesExportacaoReforma,
): void {
  const nomeEmpresa = opcoes?.isGrupo
    ? `Grupo Consolidado - ${opcoes.nomeGrupo || 'Grupo Econômico'}`
    : opcoes?.empresa?.nome || 'Empresa'

  const rows: Array<Record<string, any>> = []

  // 1. Cabeçalho Executivo
  rows.push({
    Col1: 'BORLIM CONSULTORIA EMPRESARIAL',
    Col2: '',
    Col3: '',
    Col4: '',
    Col5: '',
    Col6: '',
    Col7: '',
  })
  rows.push({
    Col1: 'SIMULADOR DA REFORMA TRIBUTÁRIA - CBS & IBS (LC 214/2025)',
    Col2: '',
    Col3: '',
    Col4: '',
    Col5: '',
    Col6: '',
    Col7: '',
  })
  rows.push({
    Col1: `Empresa / Grupo: ${nomeEmpresa}`,
    Col2: '',
    Col3: '',
    Col4: '',
    Col5: '',
    Col6: '',
    Col7: '',
  })
  if (opcoes?.empresa?.forma_tributacao) {
    rows.push({
      Col1: `Regime Tributário Atual: ${opcoes.empresa.forma_tributacao}`,
      Col2: '',
      Col3: '',
      Col4: '',
      Col5: '',
      Col6: '',
      Col7: '',
    })
  }
  rows.push({
    Col1: `Período da Apuração: ${resultado.descricaoPeriodo}`,
    Col2: '',
    Col3: '',
    Col4: '',
    Col5: '',
    Col6: '',
    Col7: '',
  })
  rows.push({
    Col1: `Centro de Custo de Entradas (Créditos): ${resultado.centroCustoCodigo}${resultado.centroCustoNome ? ` - ${resultado.centroCustoNome}` : ''}`,
    Col2: '',
    Col3: '',
    Col4: '',
    Col5: '',
    Col6: '',
    Col7: '',
  })
  rows.push({
    Col1: `Data de Emissão: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}`,
    Col2: '',
    Col3: '',
    Col4: '',
    Col5: '',
    Col6: '',
    Col7: '',
  })
  rows.push({ Col1: '', Col2: '', Col3: '', Col4: '', Col5: '', Col6: '', Col7: '' })

  // 2. Quadro Resumo dos Tributos
  rows.push({
    Col1: 'Tributo',
    Col2: 'Alíquota Ref.',
    Col3: 'Base Saídas (Receita DRE)',
    Col4: 'Débito Apurado',
    Col5: 'Base Entradas (CC-018)',
    Col6: 'Crédito Apurado',
    Col7: 'Saldo Líquido',
  })

  rows.push({
    Col1: resultado.cbs.tributo,
    Col2: resultado.cbs.aliquotaFormatada,
    Col3: resultado.cbs.baseSaidas,
    Col4: resultado.cbs.debito,
    Col5: resultado.cbs.baseEntradas,
    Col6: resultado.cbs.credito,
    Col7: resultado.cbs.saldoLiquido,
  })

  rows.push({
    Col1: resultado.ibs.tributo,
    Col2: resultado.ibs.aliquotaFormatada,
    Col3: resultado.ibs.baseSaidas,
    Col4: resultado.ibs.debito,
    Col5: resultado.ibs.baseEntradas,
    Col6: resultado.ibs.credito,
    Col7: resultado.ibs.saldoLiquido,
  })

  rows.push({
    Col1: 'TOTAL CONSOLIDADO (CBS + IBS)',
    Col2: '26,48%',
    Col3: resultado.receitaBrutaSaidas,
    Col4: resultado.totalDebitos,
    Col5: resultado.entradasCC018,
    Col6: resultado.totalCreditos,
    Col7: resultado.saldoLiquido,
  })

  rows.push({ Col1: '', Col2: '', Col3: '', Col4: '', Col5: '', Col6: '', Col7: '' })

  // 3. Indicadores de Carga Efetiva
  rows.push({
    Col1: 'INDICADORES CHAVE (KPIs)',
    Col2: '',
    Col3: '',
    Col4: '',
    Col5: '',
    Col6: '',
    Col7: '',
  })
  rows.push({
    Col1: 'Carga Efetiva sobre a Receita',
    Col2: `${resultado.cargaEfetivaPercent.toFixed(2).replace('.', ',')}%`,
    Col3: '',
    Col4: '',
    Col5: '',
    Col6: '',
    Col7: '',
  })
  rows.push({
    Col1: 'Situação do Período',
    Col2:
      resultado.tipoSaldo === 'a_recolher'
        ? 'Imposto Líquido a Recolher'
        : 'Saldo Credor a Compensar',
    Col3: '',
    Col4: '',
    Col5: '',
    Col6: '',
    Col7: '',
  })
  rows.push({
    Col1: 'Qtd. Lançamentos CC-018 Computados',
    Col2: resultado.totalLancamentosCC018,
    Col3: '',
    Col4: '',
    Col5: '',
    Col6: '',
    Col7: '',
  })
  rows.push({ Col1: '', Col2: '', Col3: '', Col4: '', Col5: '', Col6: '', Col7: '' })

  // 4. Detalhamento Mensal (se disponível)
  if (resultado.meses && resultado.meses.length > 0) {
    rows.push({
      Col1: 'DETALHAMENTO MENSAL DA APURAÇÃO',
      Col2: '',
      Col3: '',
      Col4: '',
      Col5: '',
      Col6: '',
      Col7: '',
    })
    rows.push({
      Col1: 'Mês/Ano',
      Col2: 'Receita Saídas (R$)',
      Col3: 'Entradas CC-018 (R$)',
      Col4: 'Débito Total (R$)',
      Col5: 'Crédito Total (R$)',
      Col6: 'Saldo Líquido (R$)',
      Col7: 'Carga Efetiva (%)',
    })

    for (const m of resultado.meses) {
      rows.push({
        Col1: m.rotuloCurto,
        Col2: m.receitaSaidas,
        Col3: m.entradasCC018,
        Col4: m.totalDebitos,
        Col5: m.totalCreditos,
        Col6: m.saldoLiquido,
        Col7: Number(m.cargaEfetivaPercent.toFixed(2)),
      })
    }
  }

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows, { skipHeader: true })

  // Ajuste de largura das colunas
  ws['!cols'] = [
    { wch: 32 },
    { wch: 22 },
    { wch: 24 },
    { wch: 18 },
    { wch: 24 },
    { wch: 18 },
    { wch: 20 },
  ]

  XLSX.utils.book_append_sheet(wb, ws, 'Reforma Tributária')

  const safeNome = (
    opcoes?.isGrupo ? opcoes?.nomeGrupo || 'Grupo' : opcoes?.empresa?.nome || 'Empresa'
  ).replace(/[^a-zA-Z0-9_-]/g, '_')
  const fileName = `Reforma_Tributaria_${safeNome}_${resultado.ano}${resultado.mes ? `_${String(resultado.mes).padStart(2, '0')}` : ''}.xlsx`

  XLSX.writeFile(wb, fileName)
}

/**
 * Exporta a apuração da Reforma Tributária para arquivo CSV (separador ';' padrão brasileiro)
 */
export function exportarReformaTributariaCsv(
  resultado: ReformaTributariaResultado,
  opcoes?: OpcoesExportacaoReforma,
): void {
  const nomeEmpresa = opcoes?.isGrupo
    ? `Grupo Consolidado - ${opcoes.nomeGrupo || 'Grupo Econômico'}`
    : opcoes?.empresa?.nome || 'Empresa'

  let csv = '\uFEFF' // BOM UTF-8
  csv += `RELATÓRIO DA REFORMA TRIBUTÁRIA - CBS & IBS (LC 214/2025)\n`
  csv += `Empresa/Grupo;${nomeEmpresa}\n`
  if (opcoes?.empresa?.forma_tributacao) {
    csv += `Regime Tributário Atual;${opcoes.empresa.forma_tributacao}\n`
  }
  csv += `Período;${resultado.descricaoPeriodo}\n`
  csv += `Centro de Custo de Entradas;${resultado.centroCustoCodigo}${resultado.centroCustoNome ? ` - ${resultado.centroCustoNome}` : ''}\n`
  csv += `Data de Emissão;${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}\n\n`

  csv += `QUADRO RESUMO DOS TRIBUTOS\n`
  csv += `Tributo;Alíquota;Base Saídas (Receita DRE);Débito Apurado;Base Entradas (CC-018);Crédito Apurado;Saldo Líquido;Situação\n`

  const formatItem = (item: any) =>
    `${item.tributo};${item.aliquotaFormatada};${formatBrlValor(item.baseSaidas)};${formatBrlValor(item.debito)};${formatBrlValor(item.baseEntradas)};${formatBrlValor(item.credito)};${formatBrlValor(item.saldoLiquido)};${item.tipoSaldo === 'a_recolher' ? 'A Recolher' : 'Saldo Credor'}\n`

  csv += formatItem(resultado.cbs)
  csv += formatItem(resultado.ibs)
  csv += `TOTAL COMBINADO;26,48%;${formatBrlValor(resultado.receitaBrutaSaidas)};${formatBrlValor(resultado.totalDebitos)};${formatBrlValor(resultado.entradasCC018)};${formatBrlValor(resultado.totalCreditos)};${formatBrlValor(resultado.saldoLiquido)};${resultado.tipoSaldo === 'a_recolher' ? 'A Recolher' : 'Saldo Credor'}\n\n`

  csv += `INDICADORES CONSOLIDADOS\n`
  csv += `Carga Efetiva;${resultado.cargaEfetivaPercent.toFixed(2).replace('.', ',')}%\n`
  csv += `Situação Geral;${resultado.tipoSaldo === 'a_recolher' ? 'Imposto Líquido a Recolher' : 'Saldo Credor a Compensar'}\n`
  csv += `Lançamentos CC-018 Computados;${resultado.totalLancamentosCC018}\n\n`

  if (resultado.meses && resultado.meses.length > 0) {
    csv += `DETALHAMENTO MENSAL\n`
    csv += `Mês/Ano;Receita Saídas;Entradas CC-018;Débito CBS;Crédito CBS;Débito IBS;Crédito IBS;Débito Total;Crédito Total;Saldo Líquido;Carga Efetiva;Situação\n`
    for (const m of resultado.meses) {
      csv += `${m.rotuloCurto};${formatBrlValor(m.receitaSaidas)};${formatBrlValor(m.entradasCC018)};${formatBrlValor(m.cbs.debito)};${formatBrlValor(m.cbs.credito)};${formatBrlValor(m.ibs.debito)};${formatBrlValor(m.ibs.credito)};${formatBrlValor(m.totalDebitos)};${formatBrlValor(m.totalCreditos)};${formatBrlValor(m.saldoLiquido)};${m.cargaEfetivaPercent.toFixed(2).replace('.', ',')}%;${m.tipoSaldo === 'a_recolher' ? 'A Recolher' : 'Saldo Credor'}\n`
    }
  }

  const safeNome = (
    opcoes?.isGrupo ? opcoes?.nomeGrupo || 'Grupo' : opcoes?.empresa?.nome || 'Empresa'
  ).replace(/[^a-zA-Z0-9_-]/g, '_')
  const fileName = `Reforma_Tributaria_${safeNome}_${resultado.ano}${resultado.mes ? `_${String(resultado.mes).padStart(2, '0')}` : ''}.csv`

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.setAttribute('download', fileName)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
