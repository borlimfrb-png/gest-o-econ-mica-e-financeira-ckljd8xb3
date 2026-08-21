import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

// Configure worker src from Vite asset URL
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker

export interface ExtractedPageText {
  pageNumber: number
  rawText: string
  lines: string[]
}

export interface ExtractedAccountValueCandidate {
  id: string
  rawAccountName: string
  extractedValue: number
  pageNumber: number
  originalLine: string
}

export interface PdfExtractionResult {
  fileName: string
  totalPages: number
  pages: ExtractedPageText[]
  candidates: ExtractedAccountValueCandidate[]
  isScannedOrEmpty: boolean
}

/**
 * Normaliza string para comparação e limpeza (remove acentos, pontuações excessivas, lowercase)
 */
export function normalizeText(str: string): string {
  return (str || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

/**
 * Converte string com formato numérico (ex: 1.234,56 ou R$ 500,00 ou (150,00)) para número float
 */
export function parseBrlNumber(valStr: string): number {
  if (!valStr) return 0
  let s = valStr.trim()
  // Remove R$, espaços, tabs
  s = s.replace(/[R$\s]/g, '')
  // Trata formato brasileiro (1.234,56) e internacional (1,234.56)
  if (s.indexOf(',') !== -1 && s.indexOf('.') !== -1) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      // 1.234,56 -> 1234.56
      s = s.replace(/\./g, '').replace(',', '.')
    } else {
      // 1,234.56 -> 1234.56
      s = s.replace(/,/g, '')
    }
  } else if (s.indexOf(',') !== -1) {
    s = s.replace(',', '.')
  }

  const negative = /^\(.*\)$/.test(s) || /^-/.test(s)
  s = s.replace(/[()\-+]/g, '').trim()
  const n = Number(s)
  if (isNaN(n)) return 0
  return negative ? -Math.abs(n) : Math.abs(n)
}

// Padrão para identificar valores monetários ou numéricos na linha
// Ex: R$ 1.500,00 | 1.500,00 | 350,00 | (200,00) | 12.345,67 | R$ 120,50
const VALUE_REGEX =
  /(?:R\$\s*)?(?:(?:\d{1,3}(?:\.\d{3})+|\d+),\d{2}|\b\d+\.\d{2}\b|\(\s*(?:R\$\s*)?(?:\d{1,3}(?:\.\d{3})+|\d+),\d{2}\s*\))/gi

// Palavras-chave ou ruídos a serem desconsiderados como nomes de conta
const NOISE_WORDS = new Set([
  'pagina',
  'folha',
  'data',
  'periodo',
  'cnpj',
  'cpf',
  'relatorio',
  'demonstrativo',
  'balancete',
  'balanco',
  'exercicio',
  'de',
  'ate',
  'emissao',
  'hora',
  'usuario',
  'total',
  'subtotal',
  'saldo anterior',
  'saldo atual',
  'debito',
  'credito',
  'movimento',
  'razao',
  'codigo',
  'descricao',
])

/**
 * Avalia se uma linha de texto contém nome de conta e valor monetário associado
 */
export function extractCandidatesFromLines(
  lines: string[],
  pageNumber: number,
): ExtractedAccountValueCandidate[] {
  const candidates: ExtractedAccountValueCandidate[] = []

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i].trim()
    if (!rawLine || rawLine.length < 3) continue

    // Ignora linhas de cabeçalho padrão de relatório
    const norm = normalizeText(rawLine)
    if (norm.startsWith('pagina ') || norm.startsWith('folha ') || norm.startsWith('relatorio ')) {
      continue
    }

    // Procura todos os números com padrão monetário
    const matches = Array.from(rawLine.matchAll(VALUE_REGEX))
    if (!matches || matches.length === 0) {
      continue
    }

    // Pega o último ou mais relevante valor monetário da linha
    const lastMatch = matches[matches.length - 1]
    const matchedValueStr = lastMatch[0]
    const parsedVal = parseBrlNumber(matchedValueStr)

    // Remove o trecho do valor da linha para isolar o nome da conta
    // Ex: "1.01.01 Caixa Geral ................. 1.500,00" -> "1.01.01 Caixa Geral ................."
    const textBefore = rawLine.substring(0, lastMatch.index).trim()

    // Limpa pontuações como pontos repetidos (...), hífens, barras, códigos contábeis estruturais (ex: 1.1.01.001)
    let cleanName = textBefore
      .replace(/[.\-–—_]{2,}/g, ' ') // Remove sequência de pontos/traços
      .replace(/^[\d.\-/]+\s*[-–—:]*\s*/, '') // Remove código contábil inicial como "1.01.001 - "
      .replace(/[|;:]/g, ' ')
      .trim()

    // Se o nome resultante for muito curto ou apenas ruído, ignora
    if (cleanName.length < 3 || cleanName.length > 120) {
      continue
    }

    const normName = normalizeText(cleanName)
    if (NOISE_WORDS.has(normName)) {
      continue
    }

    // Evita falsos positivos como linhas puramente de cabeçalho
    if (/^(ativo|passivo|patrimonio liquido|receitas|despesas)$/i.test(normName)) {
      // Grandes títulos de grupo contábil sem valor operacional podem ser incluídos ou tratados
    }

    candidates.push({
      id: `p${pageNumber}_l${i}_${Math.random().toString(36).substring(2, 7)}`,
      rawAccountName: cleanName,
      extractedValue: parsedVal,
      pageNumber,
      originalLine: rawLine,
    })
  }

  return candidates
}

/**
 * Extrai texto e candidatos de todas as páginas de um arquivo PDF no cliente (navegador).
 * Atualiza o progresso através do callback onProgress (0 a 100).
 */
export async function extractTextFromPdf(
  file: File,
  onProgress?: (progress: number, currentPage: number, totalPages: number) => void,
): Promise<PdfExtractionResult> {
  const arrayBuffer = await file.arrayBuffer()
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/cmaps/',
    cMapPacked: true,
  })

  const pdfDoc = await loadingTask.promise
  const totalPages = Math.min(pdfDoc.numPages, 300) // Suporta até 300 páginas
  const pages: ExtractedPageText[] = []
  const allCandidates: ExtractedAccountValueCandidate[] = []
  let totalExtractedLength = 0

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum)
    const textContent = await page.getTextContent()

    // Reconstrói as linhas baseando-se na posição Y dos itens ou quebras naturais
    const items = textContent.items as Array<{
      str: string
      transform?: number[]
      hasEOL?: boolean
    }>

    const lineMap = new Map<number, string[]>()

    // Agrupa texto por linha (mesmo translateY aproximado)
    for (const item of items) {
      if (!('str' in item)) continue
      const str = item.str
      if (!str && !item.hasEOL) continue

      // Usa a coordenada Y do transform para agrupar na mesma linha
      const y = item.transform ? Math.round(item.transform[5]) : 0
      const existing = lineMap.get(y) || []
      existing.push(str)
      lineMap.set(y, existing)
    }

    // Ordena do topo para a base (Y decrescente em PDF)
    const sortedY = Array.from(lineMap.keys()).sort((a, b) => b - a)
    const lines: string[] = []

    for (const y of sortedY) {
      const lineStr = (lineMap.get(y) || []).join(' ').replace(/\s+/g, ' ').trim()
      if (lineStr) {
        lines.push(lineStr)
      }
    }

    const rawText = lines.join('\n')
    totalExtractedLength += rawText.trim().length

    const pageData: ExtractedPageText = {
      pageNumber: pageNum,
      rawText,
      lines,
    }
    pages.push(pageData)

    // Extrai candidatos da página
    const pageCandidates = extractCandidatesFromLines(lines, pageNum)
    allCandidates.push(...pageCandidates)

    if (onProgress) {
      const progressPercent = Math.round((pageNum / totalPages) * 100)
      onProgress(progressPercent, pageNum, totalPages)
    }
  }

  // Se houver quase nenhum caractere extraído em todas as páginas, é um PDF escaneado (imagem)
  const isScannedOrEmpty = totalExtractedLength < 50 || allCandidates.length === 0

  return {
    fileName: file.name,
    totalPages,
    pages,
    candidates: allCandidates,
    isScannedOrEmpty,
  }
}
