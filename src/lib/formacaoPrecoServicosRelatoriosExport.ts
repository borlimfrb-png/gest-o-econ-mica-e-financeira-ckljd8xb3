/**
 * Exportadores Borlim (xlsx + CSV ";"/BOM) para os relatórios da
 * Formação de Preço de Serviços: Estrutura de Preço, Sensibilidade de
 * Preço, Comparativo de Serviços, Painel de Mark-up e comparativo de
 * Cenários. Complementa src/lib/formacaoPrecoServicosExport.ts (Resumo).
 */
import * as XLSX from 'xlsx'
import { sanitizeNomeArquivo } from './exportacaoPlanoContas'
import type {
  EstruturaPrecoServico,
  SensibilidadeServico,
  LinhaComparativoServico,
  DecomposicaoMarkup,
} from './formacaoPrecoServicosRelatorios'
import type { ResumoComparacaoCenario } from './formacaoPrecoServicosCenarios'

const fmtMoeda = (v: number | undefined | null): string =>
  v === null || v === undefined || !Number.isFinite(v) ? '' : v.toFixed(2).replace('.', ',')

const fmtPct = (v: number | undefined | null): string =>
  v === null || v === undefined || !Number.isFinite(v) ? '—' : `${v.toFixed(2).replace('.', ',')}%`

const fmtNum = (v: number | undefined | null, casas = 2): string =>
  v === null || v === undefined || !Number.isFinite(v) ? '—' : v.toFixed(casas).replace('.', ',')

function nomeArquivo(prefixo: string, empresa: string, ano?: number): string {
  const safe = sanitizeNomeArquivo(empresa || 'Empresa')
  return `${prefixo}-${safe}-${ano || new Date().toISOString().slice(0, 10)}.xlsx`
}

function baixarCsv(nome: string, linhas: string[]) {
  const csvContent = '\uFEFF' + linhas.join('\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.setAttribute('download', nome)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(link.href)
}

function nota(empresa: string, texto: string): Record<string, string> {
  return { Observação: `Empresa: ${empresa} — ${texto}` }
}

// ---------------------------------------------------------------------------
// Relatório 1 — Estrutura de Preço
// ---------------------------------------------------------------------------

function linhasEstrutura(
  empresa: string,
  dados: EstruturaPrecoServico[],
): Array<Record<string, any>> {
  const rows: Array<Record<string, any>> = [
    nota(empresa, 'composição percentual do preço sugerido — soma 100% por serviço.'),
    { Serviço: '' },
  ]
  for (const e of dados) {
    rows.push({
      Serviço: e.nomeServico,
      'Preço Sugerido (R$)': fmtMoeda(e.precoVendaSugerido),
      'Mão de Obra (%)': fmtPct(e.percentuais.maoDeObra),
      'Custos Diretos (%)': fmtPct(e.percentuais.custosDiretos),
      'Fixos Rateados (%)': fmtPct(e.percentuais.rateioFixos),
      'Impostos (%)': fmtPct(e.percentuais.impostos),
      'Comissão (%)': fmtPct(e.percentuais.comissao),
      'Margem (%)': fmtPct(e.percentuais.lucro),
    })
  }
  return rows
}

export function exportarEstruturaPrecoExcel(
  empresa: string,
  dados: EstruturaPrecoServico[],
  ano?: number,
) {
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(linhasEstrutura(empresa, dados))
  ws['!cols'] = [{ wch: 34 }, ...Array.from({ length: 7 }, () => ({ wch: 20 }))]
  XLSX.utils.book_append_sheet(wb, ws, 'Estrutura de Preço')
  XLSX.writeFile(wb, nomeArquivo('estrutura-preco-servicos', empresa, ano))
}

export function exportarEstruturaPrecoCsv(
  empresa: string,
  dados: EstruturaPrecoServico[],
  ano?: number,
) {
  const rows = linhasEstrutura(empresa, dados)
  const chaves = [
    'Serviço',
    'Preço Sugerido (R$)',
    'Mão de Obra (%)',
    'Custos Diretos (%)',
    'Fixos Rateados (%)',
    'Impostos (%)',
    'Comissão (%)',
    'Margem (%)',
  ]
  baixarCsv(
    nomeArquivo('estrutura-preco-servicos', empresa, ano).replace('.xlsx', '.csv'),
    montarCsv(rows, chaves),
  )
}

// ---------------------------------------------------------------------------
// Relatório 2 — Sensibilidade de Preço
// ---------------------------------------------------------------------------

function linhasSensibilidade(
  empresa: string,
  dados: SensibilidadeServico[],
): Array<Record<string, any>> {
  const rows: Array<Record<string, any>> = [
    nota(
      empresa,
      'impacto no preço sugerido e na margem efetiva ao variar impostos (±2pp), comissão (±1pp) e custo/hora (±10%).',
    ),
    { Serviço: '' },
  ]
  for (const s of dados) {
    rows.push({
      Serviço: s.nomeServico,
      Cenário: 'Base (parâmetros vigentes)',
      'Preço Sugerido (R$)': fmtMoeda(s.precoBase),
      'Margem Efetiva (%)': fmtPct(s.margemBasePct),
      'Δ Preço (R$)': '',
      'Δ Margem (pp)': '',
    })
    for (const c of s.cenarios) {
      rows.push({
        Serviço: s.nomeServico,
        Cenário: c.cenario,
        'Preço Sugerido (R$)': fmtMoeda(c.precoSugerido),
        'Margem Efetiva (%)': fmtPct(c.margemEfetivaPct),
        'Δ Preço (R$)': fmtMoeda(c.deltaPreco),
        'Δ Margem (pp)': fmtNum(c.deltaMargemPp),
      })
    }
  }
  return rows
}

export function exportarSensibilidadeExcel(
  empresa: string,
  dados: SensibilidadeServico[],
  ano?: number,
) {
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(linhasSensibilidade(empresa, dados))
  ws['!cols'] = [{ wch: 34 }, { wch: 30 }, { wch: 20 }, { wch: 20 }, { wch: 16 }, { wch: 16 }]
  XLSX.utils.book_append_sheet(wb, ws, 'Sensibilidade de Preço')
  XLSX.writeFile(wb, nomeArquivo('sensibilidade-preco-servicos', empresa, ano))
}

export function exportarSensibilidadeCsv(
  empresa: string,
  dados: SensibilidadeServico[],
  ano?: number,
) {
  const rows = linhasSensibilidade(empresa, dados)
  const chaves = [
    'Serviço',
    'Cenário',
    'Preço Sugerido (R$)',
    'Margem Efetiva (%)',
    'Δ Preço (R$)',
    'Δ Margem (pp)',
  ]
  baixarCsv(
    nomeArquivo('sensibilidade-preco-servicos', empresa, ano).replace('.xlsx', '.csv'),
    montarCsv(rows, chaves),
  )
}

// ---------------------------------------------------------------------------
// Relatório 3 — Comparativo de Serviços
// ---------------------------------------------------------------------------

function linhasComparativo(
  empresa: string,
  dados: LinhaComparativoServico[],
  margemAlvoPct: number,
): Array<Record<string, any>> {
  const rows: Array<Record<string, any>> = [
    nota(
      empresa,
      `ranking por margem efetiva; abaixo da margem alvo (${fmtPct(margemAlvoPct)}) destacado. Folga = preço/hora − ponto de equilíbrio por hora.`,
    ),
    { Serviço: '' },
  ]
  for (const r of dados) {
    rows.push({
      Ranking: r.ranking,
      Serviço: r.nomeServico,
      'Custo Total (R$)': fmtMoeda(r.custoTotal),
      'Preço Sugerido (R$)': fmtMoeda(r.precoSugerido),
      'Preço/Hora (R$)': fmtMoeda(r.precoHora),
      'Ponto de Equilíbrio (h)': fmtNum(r.pontoEquilibrioHora, 1),
      'Margem Efetiva (%)': fmtPct(r.margemEfetivaPct),
      'Mark-up Divisor': fmtNum(r.markupDivisor, 3),
      'Folga s/ Equilíbrio (R$)': fmtMoeda(r.folgaSobreEquilibrio),
      'Abaixo da Margem Alvo': r.abaixoDaMargemAlvo ? 'SIM' : 'NÃO',
    })
  }
  return rows
}

export function exportarComparativoExcel(
  empresa: string,
  dados: LinhaComparativoServico[],
  margemAlvoPct: number,
  ano?: number,
) {
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(linhasComparativo(empresa, dados, margemAlvoPct))
  ws['!cols'] = [
    { wch: 9 },
    { wch: 34 },
    { wch: 18 },
    { wch: 18 },
    { wch: 16 },
    { wch: 22 },
    { wch: 18 },
    { wch: 16 },
    { wch: 22 },
    { wch: 20 },
  ]
  XLSX.utils.book_append_sheet(wb, ws, 'Comparativo de Serviços')
  XLSX.writeFile(wb, nomeArquivo('comparativo-servicos', empresa, ano))
}

export function exportarComparativoCsv(
  empresa: string,
  dados: LinhaComparativoServico[],
  margemAlvoPct: number,
  ano?: number,
) {
  const rows = linhasComparativo(empresa, dados, margemAlvoPct)
  const chaves = [
    'Ranking',
    'Serviço',
    'Custo Total (R$)',
    'Preço Sugerido (R$)',
    'Preço/Hora (R$)',
    'Ponto de Equilíbrio (h)',
    'Margem Efetiva (%)',
    'Mark-up Divisor',
    'Folga s/ Equilíbrio (R$)',
    'Abaixo da Margem Alvo',
  ]
  baixarCsv(
    nomeArquivo('comparativo-servicos', empresa, ano).replace('.xlsx', '.csv'),
    montarCsv(rows, chaves),
  )
}

// ---------------------------------------------------------------------------
// Painel de Mark-up
// ---------------------------------------------------------------------------

export function exportarPainelMarkup(
  empresa: string,
  dec: DecomposicaoMarkup | null,
  ano?: number,
) {
  if (!dec) return
  const rows: Array<Record<string, any>> = [
    nota(empresa, 'decomposição do mark-up multiplicador e divergência divisor × multiplicador.'),
    { Parcela: '' },
    { Parcela: 'Base (1,0)', Valor: fmtNum(dec.parcelas.base, 4) },
    {
      Parcela: 'Despesas fixas rateadas',
      Valor: fmtNum(dec.parcelas.despesasFixasPct, 4),
    },
    { Parcela: 'Impostos', Valor: fmtNum(dec.parcelas.impostosPct, 4) },
    { Parcela: 'Comissão', Valor: fmtNum(dec.parcelas.comissaoPct, 4) },
    { Parcela: 'Margem', Valor: fmtNum(dec.parcelas.margemPct, 4) },
    { Parcela: 'Mark-up multiplicador', Valor: fmtNum(dec.markupMultiplicador, 4) },
    { Parcela: 'Mark-up divisor', Valor: fmtNum(dec.markupDivisor, 4) },
    {
      Parcela: 'Divergência (%)',
      Valor: dec.divergenciaPct === null ? '—' : fmtNum(dec.divergenciaPct),
    },
  ]
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = [{ wch: 34 }, { wch: 18 }]
  XLSX.utils.book_append_sheet(wb, ws, 'Painel Mark-up')
  XLSX.writeFile(wb, nomeArquivo('painel-markup-servicos', empresa, ano))

  const chaves = ['Parcela', 'Valor']
  baixarCsv(
    nomeArquivo('painel-markup-servicos', empresa, ano).replace('.xlsx', '.csv'),
    montarCsv(rows, chaves),
  )
}

// ---------------------------------------------------------------------------
// Cenários — comparativo base × cenário
// ---------------------------------------------------------------------------

function linhasCenario(
  empresa: string,
  nomeCenario: string,
  resumo: ResumoComparacaoCenario,
): Array<Record<string, any>> {
  const rows: Array<Record<string, any>> = [
    nota(empresa, `comparativo base (vigente) × cenário “${nomeCenario}”.`),
    { Serviço: '' },
  ]
  for (const l of resumo.linhas) {
    rows.push({
      Serviço: l.nomeServico,
      'Preço Base (R$)': fmtMoeda(l.precoBase),
      'Preço Cenário (R$)': fmtMoeda(l.precoCenario),
      'Δ Preço (R$)': fmtMoeda(l.deltaPreco),
      'Mark-up Base (×)': fmtNum(l.markupBase, 3),
      'Mark-up Cenário (×)': fmtNum(l.markupCenario, 3),
      'Margem Base (%)': fmtPct(l.margemBasePct),
      'Margem Cenário (%)': fmtPct(l.margemCenarioPct),
      'Δ Margem (pp)': fmtNum(l.deltaMargemPp),
    })
  }
  rows.push({
    Serviço: 'TOTAL',
    'Preço Base (R$)': fmtMoeda(resumo.totais.precoBase),
    'Preço Cenário (R$)': fmtMoeda(resumo.totais.precoCenario),
    'Δ Preço (R$)': fmtMoeda(resumo.totais.deltaPreco),
    'Mark-up Base (×)': fmtNum(resumo.totais.markupBase, 3),
    'Mark-up Cenário (×)': fmtNum(resumo.totais.markupCenario, 3),
    'Margem Base (%)': fmtPct(resumo.totais.margemBasePct),
    'Margem Cenário (%)': fmtPct(resumo.totais.margemCenarioPct),
    'Δ Margem (pp)': fmtNum(resumo.totais.deltaMargemPp),
  })
  return rows
}

export function exportarComparativoCenarioExcel(
  empresa: string,
  nomeCenario: string,
  resumo: ResumoComparacaoCenario,
  ano?: number,
) {
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(linhasCenario(empresa, nomeCenario, resumo))
  ws['!cols'] = [{ wch: 34 }, ...Array.from({ length: 8 }, () => ({ wch: 20 }))]
  XLSX.utils.book_append_sheet(wb, ws, `Cenário ${nomeCenario}`.slice(0, 31))
  XLSX.writeFile(
    wb,
    nomeArquivo(`cenario-${sanitizeNomeArquivo(nomeCenario) || 'comparativo'}`, empresa, ano),
  )
}

export function exportarComparativoCenarioCsv(
  empresa: string,
  nomeCenario: string,
  resumo: ResumoComparacaoCenario,
  ano?: number,
) {
  const rows = linhasCenario(empresa, nomeCenario, resumo)
  const chaves = [
    'Serviço',
    'Preço Base (R$)',
    'Preço Cenário (R$)',
    'Δ Preço (R$)',
    'Mark-up Base (×)',
    'Mark-up Cenário (×)',
    'Margem Base (%)',
    'Margem Cenário (%)',
    'Δ Margem (pp)',
  ]
  baixarCsv(
    nomeArquivo(
      `cenario-${sanitizeNomeArquivo(nomeCenario) || 'comparativo'}`,
      empresa,
      ano,
    ).replace('.xlsx', '.csv'),
    montarCsv(rows, chaves),
  )
}

/** Converte linhas de objetos em texto CSV (";" + BOM) já com cabeçalho. */
function montarCsv(rows: Array<Record<string, any>>, chaves: string[]): string[] {
  const escapeCsv = (val: unknown): string => {
    if (val === null || val === undefined) return ''
    const s = String(val)
    if (/[;"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }
  const out = [chaves.map(escapeCsv).join(';')]
  for (const r of rows) {
    out.push(chaves.map((k) => escapeCsv(r[k])).join(';'))
  }
  return out
}
