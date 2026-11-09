/**
 * Exportador dos Indicadores Econômicos Avançados (EVA, DuPont, Ciclo de Caixa, Cobertura de Juros)
 * para Excel (.xlsx) e CSV. Padrão Borlim: separador ";" + BOM no CSV.
 */

import * as XLSX from 'xlsx'
import type { EmpresaRecord } from '@/types/finance'
import { sanitizeNomeArquivo } from './exportacaoPlanoContas'
import type { IndicadoresAvancadosResultado } from './indicadoresAvancadosCalculo'
import { ROTULO_CLASSIFICACAO_COBERTURA } from './indicadoresAvancadosCalculo'

const fmtNum = (v: number | null, dec = 2): string =>
  v === null || v === undefined || Number.isNaN(v) ? '—' : v.toFixed(dec).replace('.', ',')

const fmtBrl = (v: number | null): string =>
  v === null || v === undefined || Number.isNaN(v)
    ? '—'
    : new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
        v,
      )

const fmtDias = (v: number | null): string =>
  v === null || v === undefined || Number.isNaN(v) ? '—' : `${v.toFixed(1).replace('.', ',')} dias`

export function exportarIndicadoresAvancadosExcel(
  r: IndicadoresAvancadosResultado,
  empresa?: EmpresaRecord | null,
  exercicioAno?: number,
) {
  const nomeEmpresa = empresa?.nome || 'Empresa'
  const safeEmpresa = sanitizeNomeArquivo(nomeEmpresa)
  const fileName = `indicadores-economicos-avancados-${safeEmpresa}-${exercicioAno || new Date().getFullYear()}.xlsx`

  const wb = XLSX.utils.book_new()

  // Aba 1: EVA
  const wsEva = XLSX.utils.json_to_sheet([
    { Indicador: 'Empresa', Valor: nomeEmpresa },
    { Indicador: 'Exercício', Valor: exercicioAno || '—' },
    { Indicador: 'NOPAT (EBIT ≈ EBITDA × (1 − 34%))', Valor: fmtBrl(r.eva.nopat) },
    { Indicador: 'Capital Investido (PL + Empréstimos LP)', Valor: fmtBrl(r.eva.capitalInvestido) },
    { Indicador: 'Custo de Capital (valor R$)', Valor: fmtBrl(r.eva.custoCapital) },
    { Indicador: 'EVA (Valor Econômico Agregado)', Valor: fmtBrl(r.eva.eva) },
    { Indicador: 'Margem EVA (% Receita Líquida)', Valor: fmtNum(r.eva.margemEva) },
  ])
  wsEva['!cols'] = [{ wch: 48 }, { wch: 22 }]
  XLSX.utils.book_append_sheet(wb, wsEva, 'EVA')

  // Aba 2: DuPont
  const wsDupont = XLSX.utils.json_to_sheet([
    { Indicador: 'Margem Líquida (LL ÷ RL)', Valor: fmtNum(r.dupont.margemLiquida) + ' %' },
    { Indicador: 'Giro do Ativo (RL ÷ AT)', Valor: fmtNum(r.dupont.giroAtivo, 4) + ' x' },
    {
      Indicador: 'Alavancagem Financeira (AT ÷ PL)',
      Valor: fmtNum(r.dupont.alavancagemFinanceira, 4) + ' x',
    },
    { Indicador: 'ROE (Margem × Giro × Alavancagem)', Valor: fmtNum(r.dupont.roe) + ' %' },
    { Indicador: 'ROA (LL ÷ AT)', Valor: fmtNum(r.dupont.roa) + ' %' },
  ])
  wsDupont['!cols'] = [{ wch: 44 }, { wch: 20 }]
  XLSX.utils.book_append_sheet(wb, wsDupont, 'DuPont')

  // Aba 3: Ciclo de Conversão de Caixa
  const wsCiclo = XLSX.utils.json_to_sheet([
    { Indicador: 'PME — Prazo Médio de Estocagem', Valor: fmtDias(r.ciclo.pme) },
    { Indicador: 'PMR — Prazo Médio de Recebimento', Valor: fmtDias(r.ciclo.pmr) },
    { Indicador: 'PMP — Prazo Médio de Pagamento', Valor: fmtDias(r.ciclo.pmp) },
    { Indicador: 'Ciclo Operacional (PME + PMR)', Valor: fmtDias(r.ciclo.cicloOperacional) },
    {
      Indicador: 'Ciclo de Conversão de Caixa (CO − PMP)',
      Valor: fmtDias(r.ciclo.cicloConversaoCaixa),
    },
  ])
  wsCiclo['!cols'] = [{ wch: 44 }, { wch: 20 }]
  XLSX.utils.book_append_sheet(wb, wsCiclo, 'Ciclo de Caixa')

  // Aba 4: Cobertura de Juros
  const wsCob = XLSX.utils.json_to_sheet([
    { Indicador: 'EBIT ≈ EBITDA oficial do sistema', Valor: fmtBrl(r.cobertura.ebit) },
    { Indicador: 'Despesas Financeiras', Valor: fmtBrl(r.cobertura.despesasFinanceiras) },
    {
      Indicador: 'Cobertura de Juros (EBIT ÷ Desp. Fin.)',
      Valor: fmtNum(r.cobertura.cobertura) + ' x',
    },
    {
      Indicador: 'Classificação',
      Valor: ROTULO_CLASSIFICACAO_COBERTURA[r.cobertura.classificacao],
    },
  ])
  wsCob['!cols'] = [{ wch: 44 }, { wch: 22 }]
  XLSX.utils.book_append_sheet(wb, wsCob, 'Cobertura de Juros')

  XLSX.writeFile(wb, fileName)
}

export function exportarIndicadoresAvancadosCsv(
  r: IndicadoresAvancadosResultado,
  empresa?: EmpresaRecord | null,
  exercicioAno?: number,
) {
  const nomeEmpresa = empresa?.nome || 'Empresa'
  const safeEmpresa = sanitizeNomeArquivo(nomeEmpresa)
  const fileName = `indicadores-economicos-avancados-${safeEmpresa}-${exercicioAno || new Date().getFullYear()}.csv`

  const escapeCsv = (val: unknown): string => {
    if (val === null || val === undefined) return ''
    const s = String(val)
    if (/[;"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }

  const linhas: string[] = []
  linhas.push(['Empresa', 'Exercício'].map(escapeCsv).join(';'))
  linhas.push([nomeEmpresa, exercicioAno || ''].map(escapeCsv).join(';'))
  linhas.push('')
  linhas.push(['Grupo', 'Indicador', 'Valor'].map(escapeCsv).join(';'))

  const add = (grupo: string, indicador: string, valor: string) => {
    linhas.push([grupo, indicador, valor].map(escapeCsv).join(';'))
  }

  add('EVA', 'NOPAT', fmtBrl(r.eva.nopat))
  add('EVA', 'Capital Investido', fmtBrl(r.eva.capitalInvestido))
  add('EVA', 'Custo de Capital (R$)', fmtBrl(r.eva.custoCapital))
  add('EVA', 'EVA', fmtBrl(r.eva.eva))
  add('EVA', 'Margem EVA (%)', fmtNum(r.eva.margemEva))
  add('DuPont', 'Margem Líquida (%)', fmtNum(r.dupont.margemLiquida))
  add('DuPont', 'Giro do Ativo (x)', fmtNum(r.dupont.giroAtivo, 4))
  add('DuPont', 'Alavancagem Financeira (x)', fmtNum(r.dupont.alavancagemFinanceira, 4))
  add('DuPont', 'ROE (%)', fmtNum(r.dupont.roe))
  add('DuPont', 'ROA (%)', fmtNum(r.dupont.roa))
  add('Ciclo de Caixa', 'PME (dias)', fmtDias(r.ciclo.pme))
  add('Ciclo de Caixa', 'PMR (dias)', fmtDias(r.ciclo.pmr))
  add('Ciclo de Caixa', 'PMP (dias)', fmtDias(r.ciclo.pmp))
  add('Ciclo de Caixa', 'Ciclo Operacional (dias)', fmtDias(r.ciclo.cicloOperacional))
  add('Ciclo de Caixa', 'Ciclo de Conversão de Caixa (dias)', fmtDias(r.ciclo.cicloConversaoCaixa))
  add('Cobertura de Juros', 'EBIT ≈ EBITDA (R$)', fmtBrl(r.cobertura.ebit))
  add('Cobertura de Juros', 'Despesas Financeiras (R$)', fmtBrl(r.cobertura.despesasFinanceiras))
  add('Cobertura de Juros', 'Cobertura (x)', fmtNum(r.cobertura.cobertura))
  add(
    'Cobertura de Juros',
    'Classificação',
    ROTULO_CLASSIFICACAO_COBERTURA[r.cobertura.classificacao],
  )

  const csvContent = '\uFEFF' + linhas.join('\r\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', fileName)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
