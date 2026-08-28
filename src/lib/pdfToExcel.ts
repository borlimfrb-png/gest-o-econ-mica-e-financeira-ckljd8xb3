import * as XLSX from 'xlsx'
import {
  extractTextFromPdf,
  parseBrlNumber,
  normalizeText,
  type PdfExtractionResult,
  type ExtractedPageText,
} from './pdfParser'

export interface PdfExcelRow {
  id: string
  pageNumber: number
  codigo: string
  descricao: string
  tipo: string
  natureza: 'Débito' | 'Crédito' | 'Saldo' | 'Geral'
  valor: number
  valoresAdicionais?: number[]
  linhaOriginal: string
}

export interface PdfConversionOptions {
  includeRawTextSheet?: boolean
  includeSummarySheet?: boolean
  filterNoise?: boolean
  customFileName?: string
}

// Expressão regular aprimorada para valores monetários em formato PT-BR e internacional
const REGEX_MONETARY =
  /(?:R\$\s*)?(?:(?:\d{1,3}(?:\.\d{3})+|\d+),\d{2}|\b\d+\.\d{2}\b|\(\s*(?:R\$\s*)?(?:\d{1,3}(?:\.\d{3})+|\d+),\d{2}\s*\))/gi

// Expressão regular para identificar códigos contábeis estruturais (ex: 1.01.01.001 ou 1.1.1.01 ou 3.01.001)
const REGEX_ACCOUNT_CODE = /\b([1-9]\.(?:\d{1,4}\.)*\d{1,4}|\d{3,6})\b/

// Palavras-chave de cabeçalhos e ruídos descartáveis em relatórios contábeis
const NOISE_STARTS = [
  'pagina',
  'folha',
  'relatorio',
  'demonstrativo',
  'cnpj',
  'cpf',
  'emissao',
  'periodo:',
  'usuario:',
  'hora:',
  'data:',
  'sistema:',
  'software',
  'versao',
]

/**
 * Classifica a natureza contábil com base no código ou descrição
 */
export function inferTipoClassificacao(codigo: string, descricao: string): string {
  const normDesc = normalizeText(descricao)
  const codeTrim = codigo.trim()

  if (codeTrim.startsWith('1')) return 'Ativo'
  if (codeTrim.startsWith('2')) return 'Passivo / PL'
  if (codeTrim.startsWith('3')) return 'Receita / Faturamento'
  if (codeTrim.startsWith('4')) return 'Custos / Despesas'
  if (codeTrim.startsWith('5')) return 'Despesas Operacionais'
  if (codeTrim.startsWith('6')) return 'Resultado Financeiro'

  if (
    normDesc.includes('ativo') ||
    normDesc.includes('caixa') ||
    normDesc.includes('banco') ||
    normDesc.includes('estoque') ||
    normDesc.includes('aplicacao') ||
    normDesc.includes('clientes a receber')
  ) {
    return 'Ativo'
  }

  if (
    normDesc.includes('passivo') ||
    normDesc.includes('fornecedor') ||
    normDesc.includes('emprestimo') ||
    normDesc.includes('patrimonio liquido') ||
    normDesc.includes('capital social') ||
    normDesc.includes('a pagar')
  ) {
    return 'Passivo / PL'
  }

  if (
    normDesc.includes('receita') ||
    normDesc.includes('venda') ||
    normDesc.includes('faturamento') ||
    normDesc.includes('servico prestado')
  ) {
    return 'Receita'
  }

  if (
    normDesc.includes('despesa') ||
    normDesc.includes('custo') ||
    normDesc.includes('salario') ||
    normDesc.includes('aluguel') ||
    normDesc.includes('imposto') ||
    normDesc.includes('tributo') ||
    normDesc.includes('honorario') ||
    normDesc.includes('manutencao')
  ) {
    return 'Despesa / Custo'
  }

  return 'Contábil / Geral'
}

/**
 * Identifica se a linha é débito, crédito ou saldo
 */
export function inferNatureza(
  line: string,
  valorStr: string,
): 'Débito' | 'Crédito' | 'Saldo' | 'Geral' {
  const norm = normalizeText(line)
  if (/\b(d|debito|deb)\b/i.test(line) && !/\b(c|credito|cred)\b/i.test(line)) {
    return 'Débito'
  }
  if (/\b(c|credito|cred)\b/i.test(line) && !/\b(d|debito|deb)\b/i.test(line)) {
    return 'Crédito'
  }
  if (norm.includes('saldo') || norm.includes('total') || norm.includes('subtotal')) {
    return 'Saldo'
  }
  if (valorStr.includes('(') || valorStr.includes('-')) {
    return 'Débito'
  }
  return 'Geral'
}

/**
 * Processa as páginas extraídas do PDF e transforma em linhas tabulares estruturadas para o Excel
 */
export function convertPdfPagesToExcelRows(pages: ExtractedPageText[]): PdfExcelRow[] {
  const rows: PdfExcelRow[] = []

  pages.forEach((page) => {
    page.lines.forEach((line, lineIdx) => {
      const rawLine = line.trim()
      if (!rawLine || rawLine.length < 3) return

      const normLine = normalizeText(rawLine)
      if (NOISE_STARTS.some((n) => normLine.startsWith(n))) {
        return
      }

      // Procura todas as ocorrências de valores monetários na linha
      const matches = Array.from(rawLine.matchAll(REGEX_MONETARY))
      if (!matches || matches.length === 0) {
        // Se a linha não tem números, ainda pode ser um cabeçalho ou seção relevante se não for ruído
        return
      }

      // Extrai todos os valores numéricos encontrados na linha
      const numericValues = matches.map((m) => parseBrlNumber(m[0]))
      // O valor principal costuma ser o último (ex: saldo ou valor da linha)
      const primaryValue = numericValues[numericValues.length - 1]
      const primaryMatch = matches[matches.length - 1]

      // Trecho antes dos valores para extrair código e descrição
      const textBefore = rawLine.substring(0, matches[0].index).trim()

      // Tenta achar código contábil
      let codigo = ''
      const codeMatch = textBefore.match(REGEX_ACCOUNT_CODE) || rawLine.match(REGEX_ACCOUNT_CODE)
      if (codeMatch && codeMatch.index !== undefined && codeMatch.index < 20) {
        codigo = codeMatch[1]
      }

      // Limpa a descrição removendo código inicial, pontuações repetidas (... ---), etc.
      let descricao = textBefore
        .replace(REGEX_ACCOUNT_CODE, '')
        .replace(/[.\-–—_]{2,}/g, ' ')
        .replace(/^[.\-–—:;\s]+/, '')
        .replace(/[.\-–—:;\s]+$/, '')
        .replace(/\s+/g, ' ')
        .trim()

      // Se a descrição ficou vazia mas temos texto antes do último match
      if (!descricao && matches.length > 1) {
        descricao = rawLine
          .substring(0, primaryMatch.index || 0)
          .replace(/[.\-–—_]{2,}/g, ' ')
          .trim()
      }

      if (!descricao && codigo) {
        descricao = `Conta Cód. ${codigo}`
      } else if (!descricao) {
        descricao = rawLine.replace(REGEX_MONETARY, '').trim()
      }

      if (descricao.length < 2) return

      const tipo = inferTipoClassificacao(codigo, descricao)
      const natureza = inferNatureza(rawLine, primaryMatch[0])

      rows.push({
        id: `p${page.pageNumber}_l${lineIdx}_${Math.random().toString(36).substring(2, 7)}`,
        pageNumber: page.pageNumber,
        codigo: codigo || '-',
        descricao,
        tipo,
        natureza,
        valor: primaryValue,
        valoresAdicionais: numericValues.length > 1 ? numericValues.slice(0, -1) : undefined,
        linhaOriginal: rawLine,
      })
    })
  })

  return rows
}

/**
 * Gera um Workbook XLSX completo com dados estruturados, formatações e metadados
 */
export function generateExcelWorkbookFromPdf(
  rows: PdfExcelRow[],
  pdfResult: PdfExtractionResult,
  options: PdfConversionOptions = {},
): XLSX.WorkBook {
  const wb = XLSX.utils.book_new()

  // 1. Planilha Principal: Dados Estruturados
  const dataForSheet = rows.map((r, index) => ({
    Item: index + 1,
    'Código Contábil': r.codigo !== '-' ? r.codigo : '',
    'Conta / Descrição': r.descricao,
    'Tipo / Classificação': r.tipo,
    Natureza: r.natureza,
    'Valor (R$)': Number(r.valor),
    'Pág. PDF': r.pageNumber,
    'Linha Original do PDF': r.linhaOriginal,
  }))

  const wsMain = XLSX.utils.json_to_sheet(dataForSheet)

  // Ajusta larguras de colunas automaticamente
  wsMain['!cols'] = [
    { wch: 6 }, // Item
    { wch: 18 }, // Código Contábil
    { wch: 45 }, // Conta / Descrição
    { wch: 22 }, // Tipo / Classificação
    { wch: 12 }, // Natureza
    { wch: 18 }, // Valor (R$)
    { wch: 10 }, // Pág. PDF
    { wch: 60 }, // Linha Original
  ]

  // Formatação de número monetário para a coluna de Valor (coluna F, índice 5)
  const range = XLSX.utils.decode_range(wsMain['!ref'] || 'A1:H1')
  for (let rowNum = range.s.r + 1; rowNum <= range.e.r; rowNum++) {
    const cellAddress = XLSX.utils.encode_cell({ r: rowNum, c: 5 })
    if (wsMain[cellAddress] && typeof wsMain[cellAddress].v === 'number') {
      wsMain[cellAddress].z = '"R$" #,##0.00;[Red]("R$" #,##0.00);"-"'
    }
  }

  XLSX.utils.book_append_sheet(wb, wsMain, 'Dados Extraídos')

  // 2. Planilha de Resumo por Categoria / Tipo
  if (options.includeSummarySheet !== false) {
    const summaryMap = new Map<string, { count: number; total: number }>()

    rows.forEach((r) => {
      const current = summaryMap.get(r.tipo) || { count: 0, total: 0 }
      current.count += 1
      current.total += r.valor
      summaryMap.set(r.tipo, current)
    })

    const summaryData = Array.from(summaryMap.entries()).map(([tipo, stats]) => ({
      'Classificação / Tipo': tipo,
      'Qtd. Linhas': stats.count,
      'Total Acumulado (R$)': stats.total,
    }))

    const totalGeral = rows.reduce((acc, r) => acc + r.valor, 0)
    summaryData.push({
      'Classificação / Tipo': 'TOTAL GERAL',
      'Qtd. Linhas': rows.length,
      'Total Acumulado (R$)': totalGeral,
    })

    const wsSummary = XLSX.utils.json_to_sheet(summaryData)
    wsSummary['!cols'] = [{ wch: 30 }, { wch: 15 }, { wch: 22 }]

    // Formata coluna de total no resumo
    const sumRange = XLSX.utils.decode_range(wsSummary['!ref'] || 'A1:C1')
    for (let rNum = sumRange.s.r + 1; rNum <= sumRange.e.r; rNum++) {
      const cell = wsSummary[XLSX.utils.encode_cell({ r: rNum, c: 2 })]
      if (cell && typeof cell.v === 'number') {
        cell.z = '"R$" #,##0.00;[Red]("R$" #,##0.00);"-"'
      }
    }

    XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumo por Categoria')
  }

  // 3. Planilha Opcional de Texto Bruto
  if (options.includeRawTextSheet !== false && pdfResult.pages.length > 0) {
    const rawData: Array<{ Página: number; Linha: number; 'Texto Bruto': string }> = []
    pdfResult.pages.forEach((p) => {
      p.lines.forEach((l, idx) => {
        if (l.trim()) {
          rawData.push({
            Página: p.pageNumber,
            Linha: idx + 1,
            'Texto Bruto': l,
          })
        }
      })
    })

    const wsRaw = XLSX.utils.json_to_sheet(rawData)
    wsRaw['!cols'] = [{ wch: 10 }, { wch: 10 }, { wch: 90 }]
    XLSX.utils.book_append_sheet(wb, wsRaw, 'Texto Completo PDF')
  }

  return wb
}

/**
 * Faz o download direto do arquivo Excel no navegador
 */
export function downloadExcelFile(
  wb: XLSX.WorkBook,
  suggestedFileName: string = 'conversao-pdf.xlsx',
): void {
  let fileName = suggestedFileName.trim()
  if (!fileName.toLowerCase().endsWith('.xlsx')) {
    fileName += '.xlsx'
  }
  XLSX.writeFile(wb, fileName)
}

/**
 * Função utilitária completa para processar um File PDF e retornar os dados estruturados
 */
export async function processPdfForExcel(
  file: File,
  onProgress?: (progress: number, current: number, total: number) => void,
): Promise<{
  pdfResult: PdfExtractionResult
  excelRows: PdfExcelRow[]
}> {
  const pdfResult = await extractTextFromPdf(file, onProgress)
  const excelRows = convertPdfPagesToExcelRows(pdfResult.pages)
  return {
    pdfResult,
    excelRows,
  }
}
