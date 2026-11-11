/**
 * Exportador de Formação de Preço de Serviços para Excel (.xlsx) e CSV,
 * no padrão Borlim usado nas demais telas gerenciais (xlsx + CSV pt-BR
 * com separador ';' e BOM UTF-8).
 */
import * as XLSX from 'xlsx'
import { sanitizeNomeArquivo } from './exportacaoPlanoContas'
import type { ComposicaoPrecoServico, ServicoFormacao } from './formacaoPrecoServicosCalculo'

export interface LinhaResumoServico {
  servico: ServicoFormacao
  composicao: ComposicaoPrecoServico
}

const fmtMoeda = (v: number | undefined | null): string =>
  v === null || v === undefined || !Number.isFinite(v) ? '0,00' : v.toFixed(2).replace('.', ',')

const fmtPct = (v: number | undefined | null): string =>
  v === null || v === undefined || !Number.isFinite(v) ? '—' : `${v.toFixed(2).replace('.', ',')}%`

const fmtNum = (v: number | undefined | null, casas = 2): string =>
  v === null || v === undefined || !Number.isFinite(v) ? '—' : v.toFixed(casas).replace('.', ',')

export interface DadosExportFormacaoServicos {
  nomeEmpresa: string
  exercicioAno?: number
  custoHoraTecnica: number
  custosFixosMensais: number
  horasProdutivasMes: number
  impostosPct: number
  comissaoPct: number
  margemPct: number
  linhas: LinhaResumoServico[]
}

function montarLinhasResumo(dados: DadosExportFormacaoServicos): Array<Record<string, any>> {
  const rows: Array<Record<string, any>> = []

  rows.push({
    Campo: 'Empresa',
    Valor: dados.nomeEmpresa,
    Observação: dados.exercicioAno ? `Exercício ${dados.exercicioAno}` : '',
  })
  rows.push({ Campo: 'Custos Fixos Mensais (R$)', Valor: fmtMoeda(dados.custosFixosMensais) })
  rows.push({ Campo: 'Horas Produtivas/Mês', Valor: fmtNum(dados.horasProdutivasMes, 1) })
  rows.push({ Campo: 'Custo/Hora Técnica (R$/h)', Valor: fmtMoeda(dados.custoHoraTecnica) })
  rows.push({ Campo: 'Impostos (%)', Valor: fmtPct(dados.impostosPct) })
  rows.push({ Campo: 'Comissão (%)', Valor: fmtPct(dados.comissaoPct) })
  rows.push({ Campo: 'Margem Alvo (%)', Valor: fmtPct(dados.margemPct) })
  rows.push({ Campo: '' })

  rows.push({
    Serviço: '',
    'Horas Estimadas': '',
    'Custo Mão de Obra (R$)': '',
    'Custos Diretos (R$)': '',
    'Custo Total (R$)': '',
    'Preço de Venda Sugerido (R$)': '',
    'Preço por Hora (R$/h)': '',
    'Mark-up Divisor': '',
    'Margem Efetiva (%)': '',
    'Ponto de Equilíbrio (R$/mês)': '',
    'Ponto de Equilíbrio (horas/mês)': '',
  })

  for (const { servico, composicao: c } of dados.linhas) {
    rows.push({
      Serviço: servico.nome,
      'Horas Estimadas': fmtNum(servico.horas_estimadas, 1),
      'Custo Mão de Obra (R$)': fmtMoeda(c.custoMaoDeObra),
      'Custos Diretos (R$)': fmtMoeda(c.custosDiretos),
      'Custo Total (R$)': fmtMoeda(c.custoTotalServico),
      'Preço de Venda Sugerido (R$)': fmtMoeda(c.precoVendaSugerido),
      'Preço por Hora (R$/h)': fmtMoeda(c.precoVendaHora),
      'Mark-up Divisor': fmtNum(c.markupDivisor, 3),
      'Margem Efetiva (%)': fmtPct(c.margemEfetivaPct),
      'Ponto de Equilíbrio (R$/mês)': fmtMoeda(c.pontoEquilibrioValor),
      'Ponto de Equilíbrio (horas/mês)': fmtNum(c.pontoEquilibrioHoras, 1),
    })
  }

  return rows
}

/** Exporta o Resumo da Formação de Preço de Serviços para Excel (.xlsx). */
export function exportarFormacaoServicosExcel(dados: DadosExportFormacaoServicos) {
  const safeEmpresa = sanitizeNomeArquivo(dados.nomeEmpresa || 'Empresa')
  const dataHoje = new Date().toISOString().slice(0, 10)
  const fileName = `formacao-preco-servicos-${safeEmpresa}-${dados.exercicioAno || dataHoje}.xlsx`

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(montarLinhasResumo(dados))
  ws['!cols'] = [
    { wch: 34 },
    { wch: 18 },
    { wch: 22 },
    { wch: 20 },
    { wch: 20 },
    { wch: 24 },
    { wch: 20 },
    { wch: 16 },
    { wch: 18 },
    { wch: 24 },
    { wch: 26 },
  ]
  XLSX.utils.book_append_sheet(wb, ws, 'Formação de Preço Serviços')
  XLSX.writeFile(wb, fileName)
}

/** Exporta o Resumo da Formação de Preço de Serviços para CSV (pt-BR; separador ';'). */
export function exportarFormacaoServicosCsv(dados: DadosExportFormacaoServicos) {
  const safeEmpresa = sanitizeNomeArquivo(dados.nomeEmpresa || 'Empresa')
  const dataHoje = new Date().toISOString().slice(0, 10)
  const fileName = `formacao-preco-servicos-${safeEmpresa}-${dados.exercicioAno || dataHoje}.csv`

  const escapeCsv = (val: string | number | undefined | null): string => {
    if (val === null || val === undefined) return ''
    const s = String(val)
    if (/[;"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }

  const rows = montarLinhasResumo(dados)
  const colunas = rows.length > 0 ? Object.keys(rows[0]) : []
  // O cabeçalho real de serviços está na 2ª linha de dados (após o bloco de parâmetros)
  const cabecalhoServicos = rows.find((r) => 'Serviço' in r)
  const chavesServicos = cabecalhoServicos ? Object.keys(cabecalhoServicos) : []

  const linhas: string[] = []
  // Cabeçalho de parâmetros (3 primeiras colunas) para o bloco de parâmetros,
  // e o cabeçalho de serviços (11 colunas) para as linhas de resumo.
  if (chavesServicos.length > 0) linhas.push(chavesServicos.map(escapeCsv).join(';'))
  const chavesParametros = ['Campo', 'Valor', 'Observação']
  for (const r of rows) {
    if ('Serviço' in r) {
      linhas.push(chavesServicos.map((k) => escapeCsv(r[k])).join(';'))
    } else {
      linhas.push(chavesParametros.map((k) => escapeCsv((r as Record<string, any>)[k])).join(';'))
    }
  }

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
