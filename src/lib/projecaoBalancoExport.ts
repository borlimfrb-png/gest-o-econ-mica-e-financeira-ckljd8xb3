import * as XLSX from 'xlsx'
import type { BalancoProjetadoResultado } from './projecaoBalancoCalculo'
import { sanitizeNomeArquivo } from './exportacaoPlanoContas'

export interface OpcoesExportacaoBalançoProjetado {
  empresaNome?: string
  isGrupo?: boolean
  nomeGrupo?: string
  exercicioAno?: number
}

interface ContextoExport {
  identificador: string
  exercicio: number
  fileNameBase: string
}

function resolverContexto(
  res: BalancoProjetadoResultado,
  opcoes?: OpcoesExportacaoBalançoProjetado,
): ContextoExport {
  const identificador =
    opcoes?.isGrupo && opcoes?.nomeGrupo
      ? `Grupo_${opcoes.nomeGrupo}`
      : opcoes?.empresaNome || 'Consolidado'
  const safeEntidade = sanitizeNomeArquivo(identificador)
  const exercicio = opcoes?.exercicioAno || new Date().getFullYear()
  return {
    identificador,
    exercicio,
    fileNameBase: `Balanco_Projetado_${safeEntidade}_${exercicio}`,
  }
}

interface LinhaExportBalanço {
  Lado: string
  Conta: string
  Método: string
  'Balanço Realizado': number | string
  'Balanço Projetado': number | string
  Variação: number | string
  'Nota Metodológica': string
}

function montarLinhas(res: BalancoProjetadoResultado): LinhaExportBalanço[] {
  const rows: LinhaExportBalanço[] = []

  rows.push({
    Lado: 'Seção',
    Conta: `Balanco Projetado — balanço realizado de referência: ${res.rotuloBalancoRealizado}`,
    Método: '',
    'Balanço Realizado': '',
    'Balanço Projetado': '',
    Variação: '',
    'Nota Metodológica':
      'Caixa = linha de fechamento (caixa realizado + geração DRE projetada, ajustado para fechar Ativo = Passivo + PL). PL = PL realizado + resultado da DRE (realizado + projetado).',
  })

  const fmt = (v: number) => v
  const ladoRotulo = (l: string) => (l === 'ativo' ? 'Ativo' : l === 'passivo' ? 'Passivo' : 'PL')

  for (const linha of res.linhas) {
    if (linha.chave.startsWith('secao_')) {
      rows.push({
        Lado: ladoRotulo(linha.lado),
        Conta: linha.rotulo.toUpperCase(),
        Método: '',
        'Balanço Realizado': '',
        'Balanço Projetado': '',
        Variação: '',
        'Nota Metodológica': '',
      })
      continue
    }
    rows.push({
      Lado: ladoRotulo(linha.lado),
      Conta: linha.rotulo,
      Método: linha.notaMetodo,
      'Balanço Realizado': fmt(linha.realizado),
      'Balanço Projetado': fmt(linha.projetado),
      Variação: fmt(linha.variacao),
      'Nota Metodológica': linha.notaMetodo,
    })
  }

  rows.push({
    Lado: '',
    Conta: '',
    Método: '',
    'Balanço Realizado': '',
    'Balanço Projetado': '',
    Variação: '',
    'Nota Metodológica': '',
  })

  rows.push({
    Lado: 'Total',
    Conta: 'Ativo Total',
    Método: '',
    'Balanço Realizado': fmt(res.ativoTotalRealizado),
    'Balanço Projetado': fmt(res.ativoTotalProjetado),
    Variação: fmt(res.ativoTotalProjetado - res.ativoTotalRealizado),
    'Nota Metodológica': '',
  })
  rows.push({
    Lado: 'Total',
    Conta: 'Passivo + PL Total',
    Método: '',
    'Balanço Realizado': fmt(res.passivoPlTotalRealizado),
    'Balanço Projetado': fmt(res.passivoPlTotalProjetado),
    Variação: fmt(res.passivoPlTotalProjetado - res.passivoPlTotalRealizado),
    'Nota Metodológica': '',
  })
  rows.push({
    Lado: 'Total',
    Conta: 'Diferença de fechamento (Ativo − (Passivo + PL))',
    Método: '',
    'Balanço Realizado': '',
    'Balanço Projetado': fmt(res.diferencaFechamento),
    Variação: '',
    'Nota Metodológica': 'Deve ser zero — o caixa equilibra o balanço.',
  })
  if (res.caixaNegativo) {
    rows.push({
      Lado: 'Aviso',
      Conta: 'Caixa projetado NEGATIVO',
      Método: '',
      'Balanço Realizado': '',
      'Balanço Projetado': '',
      Variação: '',
      'Nota Metodológica':
        'O caixa de fechamento ficou negativo: a geração de caixa da DRE projetada não cobre as necessidades do período.',
    })
  }

  return rows
}

export function exportarBalancoProjetadoExcel(
  res: BalancoProjetadoResultado,
  opcoes?: OpcoesExportacaoBalançoProjetado,
) {
  const ctx = resolverContexto(res, opcoes)
  const rows = montarLinhas(res)

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = [
    { wch: 10 }, // Lado
    { wch: 44 }, // Conta
    { wch: 10 }, // Método
    { wch: 18 }, // Balanço Realizado
    { wch: 18 }, // Balanço Projetado
    { wch: 16 }, // Variação
    { wch: 60 }, // Nota Metodológica
  ]
  XLSX.utils.book_append_sheet(wb, ws, 'Balanço Projetado')
  XLSX.writeFile(wb, `${ctx.fileNameBase}.xlsx`)
}

export function exportarBalancoProjetadoCsv(
  res: BalancoProjetadoResultado,
  opcoes?: OpcoesExportacaoBalançoProjetado,
) {
  const ctx = resolverContexto(res, opcoes)
  const rows = montarLinhas(res)
  if (rows.length === 0) return

  const escapeCsv = (val: unknown): string => {
    if (val === null || val === undefined) return ''
    const s = String(val)
    if (/[;"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }
  const formatMoedaCsv = (v: unknown) => {
    if (typeof v !== 'number') return v === undefined || v === null ? '' : String(v)
    return v.toFixed(2).replace('.', ',')
  }

  const colunas = Object.keys(rows[0])
  const linhas: string[] = [colunas.map(escapeCsv).join(';')]
  for (const row of rows) {
    linhas.push(
      colunas
        .map((c) => {
          const v = row[c]
          if (c === 'Lado' || c === 'Conta' || c === 'Método' || c === 'Nota Metodológica')
            return escapeCsv(String(v ?? ''))
          return escapeCsv(formatMoedaCsv(v))
        })
        .join(';'),
    )
  }

  const csvContent = '\uFEFF' + linhas.join('\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.setAttribute('download', `${ctx.fileNameBase}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(link.href)
}
