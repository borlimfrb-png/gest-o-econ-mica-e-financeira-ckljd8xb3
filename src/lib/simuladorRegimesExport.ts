/**
 * Utilitários de exportação (Excel/CSV) do Simulador de Regimes Tributários — pt-BR.
 * Mesmo padrão da exportação da Reforma Tributária (xlsx + CSV com BOM, separador ";").
 * Formatação de número SEMPRE no FRONTEND (Intl permitido aqui — nunca em pocketbase/hooks).
 */

import * as XLSX from 'xlsx'
import type { EmpresaRecord } from '@/types/finance'
import type { SimuladorRegimesResultado } from './simuladorRegimesCalculo'

function fmtBrl(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtPct(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export interface OpcoesExportSimulador {
  empresa?: EmpresaRecord | null
  isGrupo?: boolean
  nomeGrupo?: string
}

export function exportarSimuladorRegimesExcel(
  resultado: SimuladorRegimesResultado,
  opcoes?: OpcoesExportSimulador,
): void {
  const nomeEmpresa = opcoes?.isGrupo
    ? `Grupo Consolidado - ${opcoes.nomeGrupo || 'Grupo Econômico'}`
    : opcoes?.empresa?.nome || 'Empresa'

  const rows: Array<Record<string, any>> = []

  const linha = (a: any, b = '', c = '', d = '', e = '', f = '', g = '') =>
    rows.push({ Col1: a, Col2: b, Col3: c, Col4: d, Col5: e, Col6: f, Col7: g })

  linha('BORLIM CONSULTORIA EMPRESARIAL')
  linha('SIMULADOR DE REGIMES TRIBUTÁRIOS - COMPARATIVO DE CARGA TRIBUTÁRIA')
  linha(`Empresa / Grupo: ${nomeEmpresa}`)
  if (opcoes?.empresa?.forma_tributacao) {
    linha(`Regime Tributário Atual: ${opcoes.empresa.forma_tributacao}`)
  }
  linha(`Exercício da Apuração: ${resultado.ano}`)
  linha(
    `Centro de Custo de Entradas (Créditos): ${resultado.centroCustoCodigo}${resultado.centroCustoNome ? ` - ${resultado.centroCustoNome}` : ''}`,
  )
  linha(`Compras (Entradas) no Período: R$ ${fmtBrl(resultado.comprasEntradas)}`)
  linha(`Receita Bruta (DRE): R$ ${fmtBrl(resultado.receitaBruta)}`)
  linha(`Lucro Líquido (DRE): R$ ${fmtBrl(resultado.lucroLiquido)}`)
  linha(
    `Data de Emissão: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}`,
  )
  linha('')

  linha('RESUMO COMPARATIVO DOS REGIMES')
  linha(
    'Regime',
    'Base de Cálculo Principal (R$)',
    'Imposto Bruto (R$)',
    'Crédito s/ Compras CC-098 (R$)',
    'Carga Tributária Final (R$)',
    '% da Receita',
    'Situação',
  )
  for (const reg of [
    resultado.regimes.simples,
    resultado.regimes.presumido,
    resultado.regimes.real,
  ]) {
    linha(
      reg.nome,
      fmtBrl(reg.baseCalculoPrincipal),
      fmtBrl(reg.impostoBruto),
      reg.creditoCompras > 0 ? fmtBrl(reg.creditoCompras) : 'Sem crédito neste regime',
      fmtBrl(reg.impostoTotal),
      `${fmtPct(reg.aliquotaEfetiva)}%`,
      reg.isMenorCarga ? 'MENOR CARGA' : `+${fmtPct(reg.diferencaPercentual)}% vs menor`,
    )
  }
  linha('')
  linha(
    `Regime com MENOR carga: ${resultado.regimes[resultado.menorRegimeId].nome} (R$ ${fmtBrl(resultado.regimes[resultado.menorRegimeId].impostoTotal)})`,
  )
  linha(
    `Economia do menor vs. pior regime: R$ ${fmtBrl(resultado.economiaMaxima)} (${fmtPct(resultado.reforma.fase.percentualCbs)}% CBS / ${fmtPct(resultado.reforma.fase.percentualIbs)}% IBS na fase ${resultado.reforma.fase.ano})`,
  )
  linha('')

  linha('DETALHAMENTO POR TRIBUTO')
  linha('Regime', 'Tributo', 'Base de Cálculo', 'Alíquota (%)', 'Valor (R$)', 'Observação', '')
  for (const reg of [
    resultado.regimes.simples,
    resultado.regimes.presumido,
    resultado.regimes.real,
  ]) {
    for (const item of reg.breakdown) {
      linha(
        reg.nome,
        item.sigla,
        fmtBrl(item.baseCalculo),
        `${fmtPct(item.aliquotaNominal)}`,
        fmtBrl(item.valor),
        item.descricao || '',
      )
    }
  }
  linha('')

  linha('CENÁRIO PÓS-REFORMA TRIBUTÁRIA (EC 132/2023 - CBS/IBS - LC 214/2025)')
  linha(`Ano da Transição: ${resultado.reforma.anoTransicao}`)
  linha(
    `Fase: ${resultado.reforma.fase.descricao} — CBS ${fmtPct(resultado.reforma.fase.percentualCbs)}% / IBS ${fmtPct(resultado.reforma.fase.percentualIbs)}% em vigor (alíquotas ref.: CBS ${fmtPct(resultado.reforma.aliquotaCbs)}% + IBS ${fmtPct(resultado.reforma.aliquotaIbs)}%)`,
  )
  linha('')
  linha(
    'Tributo',
    'Débito s/ Receita (R$)',
    'Crédito s/ Compras CC-098 (R$)',
    'Saldo a Recolher (R$)',
    '',
    '',
    '',
  )
  linha(
    'CBS',
    fmtBrl(resultado.reforma.cbs.debito),
    fmtBrl(resultado.reforma.cbs.credito),
    fmtBrl(resultado.reforma.cbs.saldo),
  )
  linha(
    'IBS',
    fmtBrl(resultado.reforma.ibs.debito),
    fmtBrl(resultado.reforma.ibs.credito),
    fmtBrl(resultado.reforma.ibs.saldo),
  )
  linha(
    `PIS/COFINS antigos remanescentes na fase: R$ ${fmtBrl(resultado.reforma.pisCofinsRemanescente)}`,
  )
  linha(`ISS antigo remanescente na fase: R$ ${fmtBrl(resultado.reforma.issRemanescente)}`)
  linha('')
  linha(
    `Carga do regime atual (${resultado.regimes[resultado.reforma.regimeAtualId].nome}): R$ ${fmtBrl(resultado.reforma.cargaRegimeAtual)}`,
  )
  linha(
    `Carga pós-reforma (na fase ${resultado.reforma.anoTransicao}): R$ ${fmtBrl(resultado.reforma.cargaPosReforma)}`,
  )
  linha(
    resultado.reforma.economia >= 0
      ? `ECONOMIA na transição: R$ ${fmtBrl(resultado.reforma.economia)} (${fmtPct(resultado.reforma.economiaPercentual)}%)`
      : `AUMENTO de carga na transição: R$ ${fmtBrl(Math.abs(resultado.reforma.economia))} (${fmtPct(Math.abs(resultado.reforma.economiaPercentual))}%)`,
  )

  if (resultado.observacoes.length > 0) {
    linha('')
    linha('OBSERVAÇÕES')
    for (const o of resultado.observacoes) linha(`- ${o}`)
  }

  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Comparativo Regimes')
  XLSX.writeFile(wb, `simulador-regimes-${resultado.ano}.xlsx`)
}

export function exportarSimuladorRegimesCsv(resultado: SimuladorRegimesResultado): void {
  const sep = ';'
  const dec = (v: number) => fmtBrl(v)
  const lines: string[] = []

  lines.push('SIMULADOR DE REGIMES TRIBUTARIOS - COMPARATIVO DE CARGA TRIBUTARIA')
  lines.push(`Exercício;${resultado.ano}`)
  lines.push(
    `Centro de Custo de Entradas (Créditos);${resultado.centroCustoCodigo}${resultado.centroCustoNome ? ` - ${resultado.centroCustoNome}` : ''}`,
  )
  lines.push(`Compras (Entradas) no Período;R$ ${dec(resultado.comprasEntradas)}`)
  lines.push(`Receita Bruta (DRE);R$ ${dec(resultado.receitaBruta)}`)
  lines.push(`Lucro Líquido (DRE);R$ ${dec(resultado.lucroLiquido)}`)
  lines.push('')

  lines.push('RESUMO COMPARATIVO DOS REGIMES')
  lines.push(
    'Regime;Base de Cálculo Principal (R$);Imposto Bruto (R$);Crédito s/ Compras CC-098 (R$);Carga Tributária Final (R$);% da Receita;Situação',
  )
  for (const reg of [
    resultado.regimes.simples,
    resultado.regimes.presumido,
    resultado.regimes.real,
  ]) {
    lines.push(
      [
        reg.nome,
        dec(reg.baseCalculoPrincipal),
        dec(reg.impostoBruto),
        reg.creditoCompras > 0 ? dec(reg.creditoCompras) : 'Sem credito neste regime',
        dec(reg.impostoTotal),
        `${fmtPct(reg.aliquotaEfetiva)}%`,
        reg.isMenorCarga ? 'MENOR CARGA' : `+${fmtPct(reg.diferencaPercentual)}% vs menor`,
      ].join(sep),
    )
  }
  lines.push('')
  lines.push(
    `Regime com MENOR carga;${resultado.regimes[resultado.menorRegimeId].nome};R$ ${dec(resultado.regimes[resultado.menorRegimeId].impostoTotal)}`,
  )
  lines.push(`Economia do menor vs. pior regime;R$ ${dec(resultado.economiaMaxima)}`)
  lines.push('')

  lines.push('DETALHAMENTO POR TRIBUTO')
  lines.push('Regime;Tributo;Base de Cálculo;Alíquota (%);Valor (R$);Observação')
  for (const reg of [
    resultado.regimes.simples,
    resultado.regimes.presumido,
    resultado.regimes.real,
  ]) {
    for (const item of reg.breakdown) {
      lines.push(
        [
          reg.nome,
          item.sigla,
          dec(item.baseCalculo),
          fmtPct(item.aliquotaNominal),
          dec(item.valor),
          (item.descricao || '').replace(/;/g, ','),
        ].join(sep),
      )
    }
  }
  lines.push('')

  lines.push('CENÁRIO PÓS-REFORMA TRIBUTÁRIA (CBS/IBS - TRANSIÇÃO)')
  lines.push(`Ano da Transição;${resultado.reforma.anoTransicao}`)
  lines.push(
    `Fase;${resultado.reforma.fase.descricao};CBS ${fmtPct(resultado.reforma.fase.percentualCbs)}%;IBS ${fmtPct(resultado.reforma.fase.percentualIbs)}%`,
  )
  lines.push('Tributo;Débito s/ Receita (R$);Crédito s/ Compras CC-098 (R$);Saldo a Recolher (R$)')
  lines.push(
    `CBS;${dec(resultado.reforma.cbs.debito)};${dec(resultado.reforma.cbs.credito)};${dec(resultado.reforma.cbs.saldo)}`,
  )
  lines.push(
    `IBS;${dec(resultado.reforma.ibs.debito)};${dec(resultado.reforma.ibs.credito)};${dec(resultado.reforma.ibs.saldo)}`,
  )
  lines.push(`PIS/COFINS antigos remanescentes;R$ ${dec(resultado.reforma.pisCofinsRemanescente)}`)
  lines.push(`ISS antigo remanescente;R$ ${dec(resultado.reforma.issRemanescente)}`)
  lines.push('')
  lines.push(
    `Carga do regime atual;R$ ${dec(resultado.reforma.cargaRegimeAtual)};(${resultado.regimes[resultado.reforma.regimeAtualId].nome})`,
  )
  lines.push(
    `Carga pós-reforma na fase ${resultado.reforma.anoTransicao};R$ ${dec(resultado.reforma.cargaPosReforma)}`,
  )
  lines.push(
    resultado.reforma.economia >= 0
      ? `Situação na transição;ECONOMIA de R$ ${dec(resultado.reforma.economia)} (${fmtPct(resultado.reforma.economiaPercentual)}%)`
      : `Situação na transição;AUMENTO de R$ ${dec(Math.abs(resultado.reforma.economia))} (${fmtPct(Math.abs(resultado.reforma.economiaPercentual))}%)`,
  )

  if (resultado.observacoes.length > 0) {
    lines.push('')
    for (const o of resultado.observacoes) lines.push(`- ${o.replace(/;/g, ',')}`)
  }

  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `simulador-regimes-${resultado.ano}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
