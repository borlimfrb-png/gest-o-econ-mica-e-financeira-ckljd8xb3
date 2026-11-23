/**
 * Utilitários de exportação (Excel/CSV) do Simulador de Regimes Tributários — pt-BR.
 * Mesmo padrão da exportação da Reforma Tributária (xlsx + CSV com BOM).
 * Formatação de número SEMPRE no FRONTEND (Intl permitido aqui, nunca em pocketbase/hooks).
 */

import * as XLSX from 'xlsx'
import type { EmpresaRecord } from '@/types/finance'
import type { ComparativoRegimesResultado, RegimeComCredito } from './simuladorRegimesCalculo'

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
  resultado: ComparativoRegimesResultado,
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
  linha(`Período da Apuração: ${resultado.descricaoPeriodo}`)
  linha(
    `Centro de Custo de Entradas (Créditos): ${resultado.centroCustoCodigo}${resultado.centroCustoNome ? ` - ${resultado.centroCustoNome}` : ''}`,
  )
  linha(`Compras de Matéria-Prima no Período: R$ ${fmtBrl(resultado.entradasTotal)}`)
  linha(
    `Data de Emissão: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}`,
  )
  linha('')

  linha('RESUMO COMPARATIVO DOS REGIMES')
  linha(
    'Regime',
    'Carga Tributária (R$)',
    '% da Receita',
    'PIS/COFINS Bruto',
    'Crédito CC-098',
    'PIS/COFINS Líquido',
    'Recomendado',
  )
  for (const reg of resultado.regimes) {
    linha(
      reg.nome,
      fmtBrl(reg.impostoTotal),
      `${fmtPct(reg.aliquotaEfetiva)}%`,
      reg.creditoCompras.aplicado
        ? fmtBrl(reg.creditoCompras.debitoBruto)
        : 'Não cumulativo — sem crédito',
      reg.creditoCompras.aplicado ? fmtBrl(reg.creditoCompras.credito) : '—',
      reg.creditoCompras.aplicado
        ? fmtBrl(reg.creditoCompras.liquido)
        : fmtBrl(reg.creditoCompras.debitoBruto),
      reg.isRecomendado ? 'MENOR CARGA' : '',
    )
  }
  linha('')
  linha(
    `Regime com MENOR carga: ${resultado.regimeRecomendado.nome} (${fmtBrl(resultado.regimeRecomendado.impostoTotal)})`,
  )
  linha(
    `Economia do recomendado vs. pior regime (${resultado.maiorCustoRegime.nome}): R$ ${fmtBrl(resultado.economiaMaximaAnual)}`,
  )
  linha('')

  linha('DETALHAMENTO POR TRIBUTO')
  linha('Regime', 'Tributo', 'Base de Cálculo', 'Alíquota', 'Valor (R$)', 'Observação', '')
  for (const reg of resultado.regimes) {
    for (const item of reg.breakdown) {
      linha(
        reg.nome,
        item.sigla,
        fmtBrl(item.baseCalculo),
        `${fmtPct(item.aliquotaNominal)}%`,
        fmtBrl(item.valor),
        item.descricao || '',
      )
    }
  }
  linha('')

  linha('CENÁRIO PÓS-REFORMA TRIBUTÁRIA (EC 132/2023 - CBS/IBS - LC 214/2025)')
  linha(`Ano da Transição: ${resultado.reforma.anoTransicao}`)
  linha(
    `Fase da Transição: ${resultado.reforma.faseTransicao} — ${resultado.reforma.percentualTransicaoPercent}% da alíquota de referência aplicada por CBS/IBS; ${resultado.reforma.percentualTributosAntigosPercent}% permanece nos tributos atuais`,
  )
  linha('')
  linha(
    'Regime',
    'Tributos Atuais (R$)',
    'CBS/IBS - Nova (R$)',
    'Tributos Antigos Remanescentes (R$)',
    'Carga Total Transição (R$)',
    '% da Receita',
    '',
  )
  for (const reg of resultado.reforma.regimesPosReforma) {
    linha(
      reg.nome,
      fmtBrl(reg.tributosAtuais),
      fmtBrl(reg.cbsIbsNovo),
      fmtBrl(reg.tributosAntigosRemanescentes),
      fmtBrl(reg.cargaTotal),
      `${fmtPct(reg.aliquotaEfetivaPos)}%`,
    )
  }
  linha('')
  linha(`Receita Bruta (base): R$ ${fmtBrl(resultado.receitaBruta)}`)
  linha(
    `Compras CC-098 Matéria Prima (crédito pleno CBS/IBS): R$ ${fmtBrl(resultado.reforma.entradas)}`,
  )
  linha(
    `Crédito CBS: R$ ${fmtBrl(resultado.reforma.creditoCbs)} | Crédito IBS: R$ ${fmtBrl(resultado.reforma.creditoIbs)}`,
  )
  linha(
    `Carga CBS+IBS (débito - crédito): R$ ${fmtBrl(resultado.reforma.cargaCbsIbs)} (${fmtPct(resultado.reforma.cargaPercent)} da receita)`,
  )
  linha('')
  linha('COMPARAÇÃO ATUAL x PÓS-REFORMA')
  linha('Regime', 'Carga Atual (R$)', 'Carga na Transição (R$)', 'Diferença (R$)', '', '', '')
  for (const c of resultado.reforma.comparacao) {
    linha(
      c.nome,
      fmtBrl(c.cargaAtual),
      fmtBrl(c.cargaPosReforma),
      fmtBrl(c.diferenca),
      c.diferenca > 0.005 ? 'ECONOMIA' : c.diferenca < -0.005 ? 'AUMENTO' : 'NEUTRO',
    )
  }
  linha('')
  if (resultado.reforma.melhorPosReforma) {
    linha(
      `Menor carga na transição: ${resultado.reforma.melhorPosReforma.nome} (${fmtBrl(resultado.reforma.melhorPosReforma.cargaTotal)})`,
    )
    if (resultado.reforma.economiaPosReforma) {
      linha(
        `Economia pós-reforma vs. carga atual do mesmo regime: R$ ${fmtBrl(resultado.reforma.economiaPosReforma)}`,
      )
    }
  }
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

export function exportarSimuladorRegimesCsv(resultado: ComparativoRegimesResultado): void {
  const sep = ';'
  const dec = (v: number) => fmtBrl(v)
  const lines: string[] = []

  lines.push('SIMULADOR DE REGIMES TRIBUTARIOS - COMPARATIVO DE CARGA TRIBUTARIA')
  lines.push(`Período;${resultado.descricaoPeriodo}`)
  lines.push(
    `Centro de Custo de Entradas (Créditos);${resultado.centroCustoCodigo}${resultado.centroCustoNome ? ` - ${resultado.centroCustoNome}` : ''}`,
  )
  lines.push(`Compras de Matéria-Prima no Período;R$ ${dec(resultado.entradasTotal)}`)
  lines.push('')

  lines.push('RESUMO COMPARATIVO DOS REGIMES')
  lines.push(
    'Regime;Carga Tributária (R$);% da Receita;PIS/COFINS Bruto;Crédito CC-098;PIS/COFINS Líquido;Recomendado',
  )
  for (const reg of resultado.regimes) {
    lines.push(
      [
        reg.nome,
        dec(reg.impostoTotal),
        `${fmtPct(reg.aliquotaEfetiva)}%`,
        reg.creditoCompras.aplicado
          ? dec(reg.creditoCompras.debitoBruto)
          : 'Nao cumulativo - sem credito',
        reg.creditoCompras.aplicado ? dec(reg.creditoCompras.credito) : '-',
        reg.creditoCompras.aplicado
          ? dec(reg.creditoCompras.liquido)
          : dec(reg.creditoCompras.debitoBruto),
        reg.isRecomendado ? 'MENOR CARGA' : '',
      ].join(sep),
    )
  }
  lines.push('')
  lines.push(
    `Regime com MENOR carga;${resultado.regimeRecomendado.nome};R$ ${dec(resultado.regimeRecomendado.impostoTotal)}`,
  )
  lines.push(
    `Economia vs. pior regime (${resultado.maiorCustoRegime.nome});R$ ${dec(resultado.economiaMaximaAnual)}`,
  )
  lines.push('')

  lines.push('DETALHAMENTO POR TRIBUTO')
  lines.push('Regime;Tributo;Base de Cálculo;Alíquota;Valor (R$);Observação')
  for (const reg of resultado.regimes) {
    for (const item of reg.breakdown) {
      lines.push(
        [
          reg.nome,
          item.sigla,
          dec(item.baseCalculo),
          `${fmtPct(item.aliquotaNominal)}%`,
          dec(item.valor),
          (item.descricao || '').replace(/;/g, ','),
        ].join(sep),
      )
    }
  }
  lines.push('')

  lines.push('CENÁRIO PÓS-REFORMA TRIBUTÁRIA (CBS/IBS)')
  lines.push(`Ano da Transição;${resultado.reforma.anoTransicao}`)
  lines.push(
    `Fase;${resultado.reforma.faseTransicao};${resultado.reforma.percentualTransicaoPercent}% CBS/IBS;${resultado.reforma.percentualTributosAntigosPercent}% tributos atuais`,
  )
  lines.push(
    'Regime;Tributos Atuais (R$);CBS/IBS - Nova (R$);Tributos Antigos Remanescentes (R$);Carga Total Transição (R$);% da Receita',
  )
  for (const reg of resultado.reforma.regimesPosReforma) {
    lines.push(
      [
        reg.nome,
        dec(reg.tributosAtuais),
        dec(reg.cbsIbsNovo),
        dec(reg.tributosAntigosRemanescentes),
        dec(reg.cargaTotal),
        `${fmtPct(reg.aliquotaEfetivaPos)}%`,
      ].join(sep),
    )
  }
  lines.push('')
  lines.push(`Receita Bruta (base);R$ ${dec(resultado.receitaBruta)}`)
  lines.push(`Compras CC-098 Matéria Prima;R$ ${dec(resultado.reforma.entradas)}`)
  lines.push(`Crédito CBS;R$ ${dec(resultado.reforma.creditoCbs)}`)
  lines.push(`Crédito IBS;R$ ${dec(resultado.reforma.creditoIbs)}`)
  lines.push(
    `Carga CBS+IBS (débito - crédito);R$ ${dec(resultado.reforma.cargaCbsIbs)};${fmtPct(resultado.reforma.cargaPercent)}% da receita`,
  )
  lines.push('')
  lines.push('COMPARAÇÃO ATUAL x PÓS-REFORMA')
  lines.push('Regime;Carga Atual (R$);Carga na Transição (R$);Diferença (R$);Situação')
  for (const c of resultado.reforma.comparacao) {
    lines.push(
      [
        c.nome,
        dec(c.cargaAtual),
        dec(c.cargaPosReforma),
        dec(c.diferenca),
        c.diferenca > 0.005 ? 'ECONOMIA' : c.diferenca < -0.005 ? 'AUMENTO' : 'NEUTRO',
      ].join(sep),
    )
  }
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
