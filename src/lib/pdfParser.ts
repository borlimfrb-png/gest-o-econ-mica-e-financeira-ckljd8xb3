import * as pdfjsLib from 'pdfjs-dist'

export const PDFJS_VERSION = '4.10.38'
export const JSDELIVR_WORKER_URL = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.mjs`
export const UNPKG_WORKER_URL = `https://unpkg.com/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.mjs`
export const CMAP_URL = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/cmaps/`

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
    const cleanName = textBefore
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
 * Testa a disponibilidade de uma URL via HEAD request (com timeout curto)
 */
async function testUrlAccessibility(url: string, timeoutMs = 4000): Promise<boolean> {
  if (typeof window === 'undefined' || typeof fetch === 'undefined') {
    return true
  }
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
    // Usamos mode: 'cors' ou 'no-cors'. Para CDN jsdelivr/unpkg, GET ou HEAD retornam ok.
    const res = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    return res.ok || res.status === 304 || res.status === 200 || res.type === 'opaque'
  } catch (err) {
    console.warn(`[PDF Worker] Teste de acessibilidade HEAD falhou para ${url}:`, err)
    return false
  }
}

/**
 * Configura o worker do PDF.js com estratégias em cascata:
 * 1. CDN jsdelivr (mais confiável em builds Vite)
 * 2. CDN unpkg (fallback secundário)
 * 3. Local via new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url)
 */
export async function ensurePdfWorkerConfigured(): Promise<string> {
  // Se já houver um workerSrc válido configurado e acessível, podemos reaproveitar
  if (pdfjsLib.GlobalWorkerOptions.workerSrc) {
    return pdfjsLib.GlobalWorkerOptions.workerSrc
  }

  // 1. Tentar CDN do jsdelivr
  try {
    const jsdelivrOk = await testUrlAccessibility(JSDELIVR_WORKER_URL)
    if (jsdelivrOk) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = JSDELIVR_WORKER_URL
      return JSDELIVR_WORKER_URL
    } else {
      console.error(
        '[PDF Worker] jsdelivr CDN não respondeu adequadamente no teste de acessibilidade.',
      )
    }
  } catch (err) {
    console.error('[PDF Worker] Erro ao testar CDN jsdelivr:', err)
  }

  // 2. Tentar CDN unpkg como fallback adicional
  try {
    const unpkgOk = await testUrlAccessibility(UNPKG_WORKER_URL)
    if (unpkgOk) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = UNPKG_WORKER_URL
      return UNPKG_WORKER_URL
    } else {
      console.error('[PDF Worker] unpkg CDN não respondeu adequadamente no teste.')
    }
  } catch (err) {
    console.error('[PDF Worker] Erro ao testar CDN unpkg:', err)
  }

  // 3. Tentar carregar localmente via Vite (new URL)
  try {
    if (typeof window !== 'undefined') {
      const localUrl = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
      pdfjsLib.GlobalWorkerOptions.workerSrc = localUrl
      return localUrl
    }
  } catch (err) {
    console.error(
      '[PDF Worker] Erro ao resolver worker local via new URL(..., import.meta.url):',
      err,
    )
  }

  // Se o teste HEAD falhou (por exemplo devido a restrições CORS em HEAD),
  // define jsdelivr como fallback default final antes de falhar completamente
  pdfjsLib.GlobalWorkerOptions.workerSrc = JSDELIVR_WORKER_URL
  return JSDELIVR_WORKER_URL
}

/**
 * Extrai texto e candidatos de todas as páginas de um arquivo PDF no cliente (navegador).
 * Atualiza o progresso através do callback onProgress (0 a 100).
 */
export async function extractTextFromPdf(
  file: File,
  onProgress?: (progress: number, currentPage: number, totalPages: number) => void,
): Promise<PdfExtractionResult> {
  // Configura o worker antes de qualquer operação
  try {
    await ensurePdfWorkerConfigured()
  } catch (workerErr) {
    console.error('[PDF Worker] Falha ao configurar worker:', workerErr)
    throw new Error(
      'Não foi possível carregar o motor de leitura de PDF. Verifique sua conexão com a internet.',
    )
  }

  let arrayBuffer: ArrayBuffer
  try {
    arrayBuffer = await file.arrayBuffer()
  } catch (err: unknown) {
    const error = err as Error
    console.error('[PDF Extract] Erro ao ler ArrayBuffer do arquivo:', error)
    throw new Error(
      `Erro ao ler o arquivo selecionado no navegador: ${error.message || 'Falha de I/O'}`,
    )
  }

  if (!arrayBuffer || arrayBuffer.byteLength === 0) {
    throw new Error('O arquivo PDF selecionado está vazio (0 bytes).')
  }

  const pdfData = new Uint8Array(arrayBuffer)

  // Função auxiliar para carregar o documento com ou sem CMap
  const loadDocument = async (useCMap = true) => {
    const docParams: Parameters<typeof pdfjsLib.getDocument>[0] = {
      data: pdfData,
      useSystemFonts: true,
      isEvalSupported: false,
    }

    if (useCMap) {
      docParams.cMapUrl = CMAP_URL
      docParams.cMapPacked = true
    }

    const loadingTask = pdfjsLib.getDocument(docParams)
    return await loadingTask.promise
  }

  // Tentativa de carregar o documento com fallbacks
  let pdfDoc: pdfjsLib.PDFDocumentProxy
  try {
    pdfDoc = await loadDocument(true)
  } catch (firstErr: unknown) {
    console.error(
      '[PDF Extract] Tentativa 1 (com CMaps e worker atual) falhou. Tentando sem CMaps...',
      firstErr,
    )
    try {
      pdfDoc = await loadDocument(false)
    } catch (secondErr: unknown) {
      console.error(
        '[PDF Extract] Tentativa 2 falhou. Alternando worker para jsdelivr direto e tentando novamente...',
        secondErr,
      )
      try {
        pdfjsLib.GlobalWorkerOptions.workerSrc = JSDELIVR_WORKER_URL
        pdfDoc = await loadDocument(false)
      } catch (thirdErr: unknown) {
        console.error('[PDF Extract] Tentativa 3 falhou definitivamente.', thirdErr)
        const errObj = (thirdErr || secondErr || firstErr) as Error
        const errMsg = errObj?.message || ''

        if (
          errMsg.includes('Password') ||
          errMsg.includes('password') ||
          errMsg.includes('encrypted')
        ) {
          throw new Error(
            'O arquivo PDF está protegido por senha. Remova a senha antes de importar.',
          )
        }
        if (
          errMsg.includes('Invalid PDF') ||
          errMsg.includes('corrupted') ||
          errMsg.includes('FormatError')
        ) {
          throw new Error(
            'Erro ao carregar o documento PDF: o arquivo parece estar corrompido ou em formato inválido.',
          )
        }
        if (
          errMsg.includes('Worker') ||
          errMsg.includes('worker') ||
          errMsg.includes('WorkerMessageHandler') ||
          errMsg.includes('Setting up fake worker failed')
        ) {
          throw new Error(
            'Não foi possível carregar o motor de leitura de PDF. Verifique sua conexão com a internet.',
          )
        }

        throw new Error(
          `Erro ao carregar o documento PDF. Verifique se o arquivo não está corrompido ou protegido por senha (${errMsg || 'Falha desconhecida'}).`,
        )
      }
    }
  }

  const totalPages = Math.min(pdfDoc.numPages || 1, 300) // Suporta até 300 páginas
  const pages: ExtractedPageText[] = []
  const allCandidates: ExtractedAccountValueCandidate[] = []
  let totalExtractedLength = 0

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    let page: pdfjsLib.PDFPageProxy
    try {
      page = await pdfDoc.getPage(pageNum)
    } catch (pageErr: unknown) {
      const pError = pageErr as Error
      console.error(`[PDF Extract] Erro ao carregar página ${pageNum}:`, pError)
      throw new Error(
        `Erro ao carregar a página ${pageNum} do PDF: ${pError.message || 'Falha na renderização da página'}`,
      )
    }

    let textContent: Awaited<ReturnType<typeof page.getTextContent>>
    try {
      textContent = await page.getTextContent()
    } catch (textErr: unknown) {
      const tError = textErr as Error
      console.error(`[PDF Extract] Erro ao extrair conteúdo de texto da página ${pageNum}:`, tError)
      throw new Error(
        `Erro ao extrair o texto da página ${pageNum}: ${tError.message || 'Falha na extração de texto'}`,
      )
    }

    // Reconstrói as linhas baseando-se na posição Y dos itens ou quebras naturais
    const items = textContent.items as Array<{
      str: string
      transform?: number[]
      hasEOL?: boolean
    }>

    const lineMap = new Map<number, string[]>()

    // Agrupa texto por linha (mesmo translateY aproximado)
    for (const item of items) {
      if (!item || !('str' in item)) continue
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
