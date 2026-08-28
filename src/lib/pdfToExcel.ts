import * as XLSX from 'xlsx'
import * as pdfjsLib from 'pdfjs-dist'
import {
  extractTextFromPdf,
  parseBrlNumber,
  normalizeText,
  type PdfExtractionResult,
  type ExtractedPageText,
} from './pdfParser'

export type OcrProvider = 'openai' | 'google-vision'

export interface OcrConfig {
  provider: OcrProvider
  apiKey: string
  model?: string
}

export const OCR_CONFIG_STORAGE_KEY = 'skip_pdf_ocr_config_v1'

export function getSavedOcrConfig(): OcrConfig {
  if (typeof window === 'undefined') {
    return { provider: 'openai', apiKey: '', model: 'gpt-4o' }
  }
  try {
    const raw = localStorage.getItem(OCR_CONFIG_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<OcrConfig>
      return {
        provider: parsed.provider === 'google-vision' ? 'google-vision' : 'openai',
        apiKey: parsed.apiKey || '',
        model: parsed.model || 'gpt-4o',
      }
    }
  } catch (err) {
    console.warn('[OCR Service] Erro ao ler config do localStorage:', err)
  }
  return { provider: 'openai', apiKey: '', model: 'gpt-4o' }
}

export function saveOcrConfig(config: OcrConfig): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(OCR_CONFIG_STORAGE_KEY, JSON.stringify(config))
  } catch (err) {
    console.warn('[OCR Service] Erro ao salvar config no localStorage:', err)
  }
}

export interface PdfExcelRow {
  id: string
  pageNumber: number
  codigo: string
  conta: string
  // Hierarquia Conta Pai (5 dígitos) e Conta Filha (4 dígitos)
  codigoPai?: string
  contaPai?: string
  codigoFilha?: string
  contaFilha?: string
  descricao: string
  tipo: string
  natureza: 'Débito' | 'Crédito' | 'Saldo' | 'Geral'
  valor: number
  valoresAdicionais?: number[]
  linhaOriginal: string
  linhaConta?: string
  editedFields?: Partial<
    Record<
      | 'codigo'
      | 'conta'
      | 'codigoPai'
      | 'contaPai'
      | 'codigoFilha'
      | 'contaFilha'
      | 'descricao'
      | 'tipo'
      | 'natureza'
      | 'valor',
      boolean
    >
  >
}

export type ColumnFieldKey =
  | 'item'
  | 'codigoPai'
  | 'contaPai'
  | 'codigoFilha'
  | 'contaFilha'
  | 'codigo'
  | 'conta'
  | 'descricao'
  | 'tipo'
  | 'natureza'
  | 'valor'
  | 'pageNumber'
  | 'linhaOriginal'

export interface ColumnMappingConfig {
  id: ColumnFieldKey
  label: string
  excelHeader: string
  included: boolean
  width: number
}

/**
 * Converte uma página do PDF em imagem Base64 (data:image/jpeg;base64,...)
 * renderizando via <canvas> com PDF.js
 */
export async function renderPdfPageToJpegBase64(
  page: pdfjsLib.PDFPageProxy,
  scale = 2.0,
): Promise<string> {
  const viewport = page.getViewport({ scale })
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Não foi possível obter o contexto 2D do Canvas para renderizar a página.')
  }

  canvas.width = Math.floor(viewport.width)
  canvas.height = Math.floor(viewport.height)

  const renderContext = {
    canvasContext: context,
    viewport,
  }

  const renderTask = page.render(renderContext)
  await renderTask.promise

  return canvas.toDataURL('image/jpeg', 0.9)
}

/**
 * Realiza OCR de uma imagem via OpenAI Chat Completions (GPT-4o Vision)
 */
async function performOpenAiOcr(
  imageBase64: string,
  apiKey: string,
  model = 'gpt-4o',
): Promise<string> {
  const trimmedKey = apiKey.trim()
  if (!trimmedKey) {
    throw new Error(
      'Chave de API da OpenAI não informada. Por favor, configure sua chave no modal de OCR.',
    )
  }

  const prompt = `Você é um assistente especialista em transcrição e OCR contábil de alta precisão.
Extraia TODO o texto contido nesta imagem de documento/relatório contábil linha a linha.
REGRAS OBRIGATÓRIAS:
1. Mantenha a ordem natural de leitura das linhas, preservando códigos contábeis (ex: 1.1.01.001), nomes das contas e valores numéricos em R$ (ex: 1.250,00 ou -500,00 ou (200,00)).
2. Não invente dados e não resuma o documento.
3. Se houver tabelas, mantenha em cada linha: código, descrição e valor(es).
4. Retorne APENAS o texto puro extraído linha a linha, sem blocos de código markdown (\`\`\`) e sem comentários introdutórios.`

  const requestBody = {
    model: model || 'gpt-4o',
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          {
            type: 'image_url',
            image_url: {
              url: imageBase64,
              detail: 'high',
            },
          },
        ],
      },
    ],
    max_tokens: 4000,
    temperature: 0.1,
  }

  let response: Response
  try {
    response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${trimmedKey}`,
      },
      body: JSON.stringify(requestBody),
    })
  } catch (err: unknown) {
    const error = err as Error
    throw new Error(
      `Falha na conexão de rede com a API da OpenAI (${error.message || 'Erro de conexão'}). Verifique sua internet ou bloqueadores de requisição.`,
    )
  }

  if (!response.ok) {
    let errorDetail = ''
    try {
      const errJson = await response.json()
      errorDetail = errJson?.error?.message || response.statusText
    } catch {
      errorDetail = response.statusText
    }

    if (response.status === 401) {
      throw new Error(
        'Chave de API da OpenAI inválida ou não autorizada (Erro 401). Verifique a chave inserida.',
      )
    }
    if (response.status === 429) {
      throw new Error(
        'Limite de requisições ou cota da OpenAI excedida (Erro 429). Verifique seus créditos na plataforma OpenAI.',
      )
    }
    throw new Error(`Erro na API da OpenAI (${response.status}): ${errorDetail}`)
  }

  const data = await response.json()
  const content = data?.choices?.[0]?.message?.content || ''
  return content.trim()
}

/**
 * Realiza OCR de uma imagem via Google Cloud Vision API
 */
async function performGoogleVisionOcr(imageBase64: string, apiKey: string): Promise<string> {
  const trimmedKey = apiKey.trim()
  if (!trimmedKey) {
    throw new Error(
      'Chave de API do Google Cloud Vision não informada. Por favor, configure sua chave no modal de OCR.',
    )
  }

  const pureBase64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '')

  const requestBody = {
    requests: [
      {
        image: {
          content: pureBase64,
        },
        features: [
          {
            type: 'DOCUMENT_TEXT_DETECTION',
          },
        ],
      },
    ],
  }

  let response: Response
  try {
    response = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(trimmedKey)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      },
    )
  } catch (err: unknown) {
    const error = err as Error
    throw new Error(
      `Falha de rede ao conectar com Google Cloud Vision API: ${error.message || 'Erro de conexão'}`,
    )
  }

  if (!response.ok) {
    let errorDetail = ''
    try {
      const errJson = await response.json()
      errorDetail = errJson?.error?.message || response.statusText
    } catch {
      errorDetail = response.statusText
    }

    if (response.status === 400 || response.status === 403) {
      throw new Error(
        `Chave ou permissão do Google Vision inválida (${response.status}): ${errorDetail}`,
      )
    }
    throw new Error(`Erro na API Google Cloud Vision (${response.status}): ${errorDetail}`)
  }

  const data = await response.json()
  const textAnnotation = data?.responses?.[0]?.fullTextAnnotation?.text || ''
  return textAnnotation.trim()
}

/**
 * Processa um arquivo PDF inteiro através de OCR externo
 */
export async function processPdfWithOcr(
  file: File,
  config: OcrConfig,
  onProgress?: (progress: number, currentPage: number, totalPages: number) => void,
): Promise<ExtractedPageText[]> {
  const { ensurePdfWorkerConfigured, CMAP_URL } = await import('./pdfParser')
  await ensurePdfWorkerConfigured()

  const pdfjsLibModule = await import('pdfjs-dist')

  const arrayBuffer = await file.arrayBuffer()
  const pdfData = new Uint8Array(arrayBuffer)

  const loadingTask = pdfjsLibModule.getDocument({
    data: pdfData,
    cMapUrl: CMAP_URL,
    cMapPacked: true,
    useSystemFonts: true,
  })

  const pdfDoc = await loadingTask.promise
  const totalPages = Math.min(pdfDoc.numPages || 1, 50)

  const extractedPages: ExtractedPageText[] = []

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum)
    const imageBase64 = await renderPdfPageToJpegBase64(page)

    let pageText = ''
    if (config.provider === 'google-vision') {
      pageText = await performGoogleVisionOcr(imageBase64, config.apiKey)
    } else {
      pageText = await performOpenAiOcr(imageBase64, config.apiKey, config.model || 'gpt-4o')
    }

    const lines = pageText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0)

    extractedPages.push({
      pageNumber: pageNum,
      rawText: pageText,
      lines,
    })

    if (onProgress) {
      const pct = Math.round((pageNum / totalPages) * 100)
      onProgress(pct, pageNum, totalPages)
    }
  }

  return extractedPages
}

export const DEFAULT_COLUMN_MAPPINGS: ColumnMappingConfig[] = [
  { id: 'item', label: 'Item / Número Linha', excelHeader: 'Item', included: true, width: 6 },
  {
    id: 'codigoPai',
    label: 'Cód. Conta Pai (5 díg.)',
    excelHeader: 'Cód. Pai (5 díg.)',
    included: true,
    width: 18,
  },
  {
    id: 'contaPai',
    label: 'Conta Pai (5 dígitos)',
    excelHeader: 'Conta Pai (5 díg.)',
    included: true,
    width: 32,
  },
  {
    id: 'codigoFilha',
    label: 'Cód. Conta Filha (4 díg.)',
    excelHeader: 'Cód. Filha (4 díg.)',
    included: true,
    width: 18,
  },
  {
    id: 'contaFilha',
    label: 'Conta Filha (4 dígitos)',
    excelHeader: 'Conta Filha (4 díg.)',
    included: true,
    width: 32,
  },
  {
    id: 'descricao',
    label: 'Lançamento / Descrição',
    excelHeader: 'Descrição do Lançamento',
    included: true,
    width: 40,
  },
  {
    id: 'tipo',
    label: 'Classificação / Tipo',
    excelHeader: 'Tipo / Classificação',
    included: true,
    width: 22,
  },
  {
    id: 'natureza',
    label: 'Natureza (D/C/Saldo)',
    excelHeader: 'Natureza',
    included: true,
    width: 12,
  },
  {
    id: 'valor',
    label: 'Valor (R$)',
    excelHeader: 'Valor (R$)',
    included: true,
    width: 18,
  },
  { id: 'pageNumber', label: 'Página no PDF', excelHeader: 'Pág. PDF', included: true, width: 10 },
  {
    id: 'linhaOriginal',
    label: 'Linha Original do PDF',
    excelHeader: 'Linha Original do PDF',
    included: false,
    width: 60,
  },
]

export const COLUMN_MAPPINGS_STORAGE_KEY = 'skip_pdf_to_excel_column_mappings_v1'

export function getSavedColumnMappings(): ColumnMappingConfig[] {
  if (typeof window === 'undefined') {
    return DEFAULT_COLUMN_MAPPINGS
  }
  try {
    const raw = localStorage.getItem(COLUMN_MAPPINGS_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as ColumnMappingConfig[]
      if (Array.isArray(parsed) && parsed.length > 0) {
        const existingKeys = new Set(parsed.map((p) => p.id))
        const missing = DEFAULT_COLUMN_MAPPINGS.filter((def) => !existingKeys.has(def.id))
        return [...parsed, ...missing]
      }
    }
  } catch (err) {
    console.warn('[pdfToExcel] Erro ao recuperar mapeamento de colunas do localStorage:', err)
  }
  return DEFAULT_COLUMN_MAPPINGS
}

export function saveColumnMappings(mappings: ColumnMappingConfig[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(COLUMN_MAPPINGS_STORAGE_KEY, JSON.stringify(mappings))
  } catch (err) {
    console.warn('[pdfToExcel] Erro ao salvar mapeamento de colunas no localStorage:', err)
  }
}

export interface PdfConversionOptions {
  includeRawTextSheet?: boolean
  includeSummarySheet?: boolean
  filterNoise?: boolean
  customFileName?: string
  columnMappings?: ColumnMappingConfig[]
}

// Expressão regular aprimorada para valores monetários em formato PT-BR e internacional
const REGEX_MONETARY =
  /(?:R\$\s*)?(?:(?:\d{1,3}(?:\.\d{3})+|\d+),\d{2}|\b\d+\.\d{2}\b|\(\s*(?:R\$\s*)?(?:\d{1,3}(?:\.\d{3})+|\d+),\d{2}\s*\))/gi

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
  'periodo de',
  'usuario:',
  'hora:',
  'data:',
  'data/hora',
  'sistema:',
  'software',
  'versao',
]

// Palavras-chave explícitas que indicam que a linha é um cabeçalho de CONTA
const ACCOUNT_HEADER_PREFIXES = [
  'conta:',
  'conta contábil:',
  'conta contabil:',
  'conta corrente:',
  'plano:',
  'plano de contas:',
  'cta:',
  'cta.:',
  'grupo:',
  'subgrupo:',
  'categoria:',
  'centro de custo:',
  'centro custo:',
]

export type AccountLevel = 'pai' | 'filha' | 'generico' | null

export interface AccountHeaderDetection {
  isHeader: boolean
  level: AccountLevel
  codigo: string
  nomeConta: string
}

/**
 * Detecta se uma linha é um cabeçalho de conta conforme a heurística solicitada:
 * - CONTA PAI: Código com 05 dígitos numéricos (ex: "12345 NOME DA CONTA" ou "12345 - NOME")
 * - CONTA FILHA: Código com 04 dígitos numéricos (ex: "1234 NOME DA SUBCONTA" ou "1234 - NOME")
 * - Padrões contábeis estruturais com pontos ou prefixos
 */
export function detectAccountHeader(line: string): AccountHeaderDetection {
  const raw = line.trim()
  if (!raw || raw.length < 3) {
    return { isHeader: false, level: null, codigo: '', nomeConta: '' }
  }

  const norm = normalizeText(raw)

  // Ignora ruídos genéricos de cabeçalho de página
  if (NOISE_STARTS.some((n) => norm.startsWith(n))) {
    return { isHeader: false, level: null, codigo: '', nomeConta: '' }
  }

  // Ignora cabeçalhos de colunas comuns
  if (
    norm.includes('data') &&
    (norm.includes('historico') || norm.includes('descricao') || norm.includes('documento')) &&
    (norm.includes('valor') ||
      norm.includes('debito') ||
      norm.includes('credito') ||
      norm.includes('saldo'))
  ) {
    return { isHeader: false, level: null, codigo: '', nomeConta: '' }
  }

  // Se a linha tiver valor monetário, ela geralmente é um lançamento, exceto se for prefixo explícito de cabeçalho
  const matchesMonetary = Array.from(raw.matchAll(REGEX_MONETARY))

  // 1. Detecção por Padrão Exato de Dígitos: 5 DÍGITOS (Conta Pai) ou 4 DÍGITOS (Conta Filha) no início
  // Ex: "01020 DESPESAS GERAIS", "10201 - PESSOAL", "1234 ALUGUEL", "0450 ENERGIA ELETRICA"
  const digitsMatch = raw.match(/^(\d{4,5})(?:[.\-–—:\s]+(.*)|$)/)
  if (digitsMatch) {
    const code = digitsMatch[1]
    const restText = (digitsMatch[2] || '').trim()

    // Se tem valor monetário no final e o restText for pequeno ou parecer saldo/lançamento, verificar
    const cleanRest = restText
      .replace(REGEX_MONETARY, '')
      .replace(/^[.\-–—:;\s]+/, '')
      .replace(/[.\-–—:;\s]+$/, '')
      .trim()

    // Se houver nome textual de conta ou for linha sem valor monetário
    if (cleanRest.length >= 2 || matchesMonetary.length === 0) {
      const level: AccountLevel =
        code.length === 5 ? 'pai' : code.length === 4 ? 'filha' : 'generico'
      return {
        isHeader: true,
        level,
        codigo: code,
        nomeConta: cleanRest || `Conta ${code}`,
      }
    }
  }

  // 2. Prefixo explícito como "Conta:", "Conta Contábil:", "Cta.:"
  for (const prefix of ACCOUNT_HEADER_PREFIXES) {
    if (norm.startsWith(prefix)) {
      const rest = raw.substring(prefix.length).trim()
      const codeMatch =
        rest.match(/\b(\d{4,5})\b/) || rest.match(/\b([1-9]\.(?:\d{1,4}\.)*\d{1,4}|\d{3,6})\b/)
      let codigo = ''
      let level: AccountLevel = 'generico'

      if (codeMatch && codeMatch.index !== undefined && codeMatch.index < 12) {
        codigo = codeMatch[1]
        if (codigo.length === 5 && /^\d+$/.test(codigo)) level = 'pai'
        else if (codigo.length === 4 && /^\d+$/.test(codigo)) level = 'filha'
      }

      const nomeConta =
        rest
          .replace(/\b(\d{4,5})\b/, '')
          .replace(/\b([1-9]\.(?:\d{1,4}\.)*\d{1,4}|\d{3,6})\b/, '')
          .replace(REGEX_MONETARY, '')
          .replace(/^[.\-–—:;\s]+/, '')
          .replace(/[.\-–—:;\s]+$/, '')
          .replace(/\s+/g, ' ')
          .trim() || rest

      return { isHeader: true, level, codigo, nomeConta }
    }
  }

  // 3. Código contábil estruturado com pontos (ex: 3.1.01.001 ou 1.01.02)
  const structMatch = raw.match(/^([1-9]\.(?:\d{1,4}\.)*\d{1,4})(?:[.\-–—:\s]+(.*)|$)/)
  if (structMatch) {
    const code = structMatch[1]
    const rest = (structMatch[2] || '')
      .replace(REGEX_MONETARY, '')
      .replace(/^[.\-–—:;\s]+/, '')
      .replace(/[.\-–—:;\s]+$/, '')
      .trim()

    if (rest.length >= 2 || matchesMonetary.length === 0) {
      return {
        isHeader: true,
        level: 'generico',
        codigo: code,
        nomeConta: rest || `Conta ${code}`,
      }
    }
  }

  // 4. Linha sem valor monetário que parece ser um título de conta em maiúsculas
  if (matchesMonetary.length === 0) {
    const isUpper = raw === raw.toUpperCase() && /[A-Z]/.test(raw)
    const hasAccountKeywords =
      norm.includes('despesa') ||
      norm.includes('custo') ||
      norm.includes('receita') ||
      norm.includes('ativo') ||
      norm.includes('passivo') ||
      norm.includes('fornecedor') ||
      norm.includes('imposto') ||
      norm.includes('banco') ||
      norm.includes('caixa') ||
      norm.includes('pessoal') ||
      norm.includes('folha') ||
      norm.includes('tribut') ||
      norm.includes('servico') ||
      norm.includes('operacion')

    if ((isUpper && raw.length >= 4 && raw.length <= 80) || hasAccountKeywords) {
      const nomeConta = raw
        .replace(/[.\-–—_]{2,}/g, ' ')
        .replace(/^[.\-–—:;\s]+/, '')
        .replace(/[.\-–—:;\s]+$/, '')
        .replace(/\s+/g, ' ')
        .trim()

      return { isHeader: true, level: 'generico', codigo: '', nomeConta }
    }
  }

  return { isHeader: false, level: null, codigo: '', nomeConta: '' }
}

/**
 * Compatibilidade legada
 */
export function isAccountHeaderLine(line: string): {
  isHeader: boolean
  codigo: string
  nomeConta: string
} {
  const res = detectAccountHeader(line)
  return {
    isHeader: res.isHeader,
    codigo: res.codigo,
    nomeConta: res.nomeConta,
  }
}

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
  if (
    /\b(d|debito|deb|pago|pagamento)\b/i.test(line) &&
    !/\b(c|credito|cred|recebido)\b/i.test(line)
  ) {
    return 'Débito'
  }
  if (/\b(c|credito|cred|recebido)\b/i.test(line) && !/\b(d|debito|deb|pago)\b/i.test(line)) {
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
 * Processa as páginas extraídas do PDF e transforma em linhas tabulares estruturadas para o Excel.
 * Heurística aprimorada de DUAS LINHAS (Hierarquia):
 * Linha Superior = CONTA Contábil (cabeçalho)
 * Linha Inferior = DESPESAS / LANÇAMENTOS PAGOS com seus respectivos VALORES (R$).
 */
/**
 * Processa as páginas extraídas do PDF e transforma em linhas tabulares estruturadas para o Excel.
 * Heurística Estrutural Exata (Hierarquia Contábil):
 * 1. Linha de CONTA PAI: Código de 05 dígitos + Nome da conta pai (cabeçalho de nível superior).
 * 2. Linha de CONTA FILHA: Código de 04 dígitos + Nome da conta filha (subconta logo abaixo da conta pai).
 * 3. LANÇAMENTOS (despesas/itens): Linhas com valores em R$ que vierem abaixo.
 *
 * Cada lançamento é vinculado à CONTA FILHA (04 dígitos) e à CONTA PAI (05 dígitos) ativas.
 * Quando um novo cabeçalho de 05 dígitos aparece: vira nova conta pai e reseta a conta filha.
 * Quando um cabeçalho de 04 dígitos aparece: vira nova conta filha mantendo a conta pai atual.
 */
export function convertPdfPagesToExcelRows(pages: ExtractedPageText[]): PdfExcelRow[] {
  const rows: PdfExcelRow[] = []

  // Contexto ativo da hierarquia
  let currentContaPaiNome = ''
  let currentContaPaiCodigo = ''
  let currentContaPaiRawLine = ''

  let currentContaFilhaNome = ''
  let currentContaFilhaCodigo = ''
  let currentContaFilhaRawLine = ''

  pages.forEach((page) => {
    page.lines.forEach((line, lineIdx) => {
      const rawLine = line.trim()
      if (!rawLine || rawLine.length < 2) return

      const normLine = normalizeText(rawLine)
      if (NOISE_STARTS.some((n) => normLine.startsWith(n))) {
        return
      }

      // Procura todas as ocorrências de valores monetários na linha
      const matches = Array.from(rawLine.matchAll(REGEX_MONETARY))

      // 1. Linha SEM valores monetários: verificar se é cabeçalho de CONTA PAI (5 dígitos) ou CONTA FILHA (4 dígitos)
      if (!matches || matches.length === 0) {
        const detection = detectAccountHeader(rawLine)
        if (detection.isHeader) {
          if (detection.level === 'pai' || detection.codigo.length === 5) {
            // Nova Conta Pai encontrada: atualiza Pai e limpa Filha
            currentContaPaiCodigo = detection.codigo
            currentContaPaiNome = detection.nomeConta
            currentContaPaiRawLine = rawLine

            currentContaFilhaCodigo = ''
            currentContaFilhaNome = ''
            currentContaFilhaRawLine = ''
          } else if (detection.level === 'filha' || detection.codigo.length === 4) {
            // Nova Conta Filha encontrada: atualiza Filha mantendo o Pai
            currentContaFilhaCodigo = detection.codigo
            currentContaFilhaNome = detection.nomeConta
            currentContaFilhaRawLine = rawLine
          } else {
            // Outro nível / genérico
            if (!currentContaPaiNome) {
              currentContaPaiCodigo = detection.codigo
              currentContaPaiNome = detection.nomeConta
              currentContaPaiRawLine = rawLine
            } else {
              currentContaFilhaCodigo = detection.codigo
              currentContaFilhaNome = detection.nomeConta
              currentContaFilhaRawLine = rawLine
            }
          }
        }
        return
      }

      // 2. Linha COM valores monetários:
      // Pode ser um lançamento / despesa pago associado ao contexto ativo ou um cabeçalho que veio com valor de saldo
      const numericValues = matches.map((m) => parseBrlNumber(m[0]))
      const primaryValue = numericValues[numericValues.length - 1]
      const primaryMatch = matches[matches.length - 1]

      const textBefore = rawLine.substring(0, matches[0].index).trim()

      // Verifica se a própria linha inicia com um cabeçalho de 5 ou 4 dígitos
      const detection = detectAccountHeader(rawLine)
      if (detection.isHeader && detection.nomeConta) {
        if (detection.level === 'pai' || detection.codigo.length === 5) {
          currentContaPaiCodigo = detection.codigo
          currentContaPaiNome = detection.nomeConta
          currentContaPaiRawLine = rawLine
          currentContaFilhaCodigo = ''
          currentContaFilhaNome = ''
          currentContaFilhaRawLine = ''
        } else if (detection.level === 'filha' || detection.codigo.length === 4) {
          currentContaFilhaCodigo = detection.codigo
          currentContaFilhaNome = detection.nomeConta
          currentContaFilhaRawLine = rawLine
        }
      }

      // Descrição limpa do lançamento
      let inlineDescricao = textBefore
        .replace(/^(\d{4,5}|\d{1,3}\.\d+)[.\-–—:\s]*/, '')
        .replace(/[.\-–—_]{2,}/g, ' ')
        .replace(/^[.\-–—:;\s]+/, '')
        .replace(/[.\-–—:;\s]+$/, '')
        .replace(/\s+/g, ' ')
        .trim()

      if (!inlineDescricao && matches.length > 1) {
        inlineDescricao = rawLine
          .substring(0, primaryMatch.index || 0)
          .replace(/[.\-–—_]{2,}/g, ' ')
          .trim()
      }

      if (!inlineDescricao) {
        inlineDescricao = rawLine.replace(REGEX_MONETARY, '').trim()
      }

      // Se ainda assim ficou vazio, usa o nome da conta filha ou conta pai
      if (!inlineDescricao) {
        inlineDescricao = currentContaFilhaNome || currentContaPaiNome || 'Lançamento'
      }

      // Monta as informações de Conta Pai e Conta Filha vinculadas
      const codigoPaiFinal = currentContaPaiCodigo || '-'
      const contaPaiFinal =
        currentContaPaiNome || (currentContaPaiCodigo ? `Conta ${currentContaPaiCodigo}` : '-')

      const codigoFilhaFinal = currentContaFilhaCodigo || '-'
      const contaFilhaFinal =
        currentContaFilhaNome ||
        (currentContaFilhaCodigo ? `Subconta ${currentContaFilhaCodigo}` : contaPaiFinal)

      // Código e conta consolidados (prioriza conta filha ou pai para compatibilidade)
      const codigoConsolidado = currentContaFilhaCodigo || currentContaPaiCodigo || '-'
      const contaConsolidada = currentContaFilhaNome || currentContaPaiNome || 'Geral'

      const tipo = inferTipoClassificacao(
        codigoConsolidado,
        `${contaPaiFinal} ${contaFilhaFinal} ${inlineDescricao}`,
      )
      const natureza = inferNatureza(rawLine, primaryMatch[0])

      rows.push({
        id: `p${page.pageNumber}_l${lineIdx}_${Math.random().toString(36).substring(2, 7)}`,
        pageNumber: page.pageNumber,
        codigo: codigoConsolidado,
        conta: contaConsolidada,
        codigoPai: codigoPaiFinal,
        contaPai: contaPaiFinal,
        codigoFilha: codigoFilhaFinal,
        contaFilha: contaFilhaFinal,
        descricao: inlineDescricao,
        tipo,
        natureza,
        valor: primaryValue,
        valoresAdicionais: numericValues.length > 1 ? numericValues.slice(0, -1) : undefined,
        linhaOriginal: rawLine,
        linhaConta: currentContaFilhaRawLine || currentContaPaiRawLine || undefined,
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

  const activeMappings = (options.columnMappings || DEFAULT_COLUMN_MAPPINGS).filter(
    (m) => m.included,
  )

  // 1. Planilha Principal: Dados Estruturados com Colunas Selecionadas e Ordenadas
  const dataForSheet = rows.map((r, index) => {
    const rowObj: Record<string, string | number> = {}

    for (const mapping of activeMappings) {
      const header = mapping.excelHeader || mapping.label
      switch (mapping.id) {
        case 'item':
          rowObj[header] = index + 1
          break
        case 'codigoPai':
          rowObj[header] = r.codigoPai && r.codigoPai !== '-' ? r.codigoPai : ''
          break
        case 'contaPai':
          rowObj[header] = r.contaPai && r.contaPai !== '-' ? r.contaPai : ''
          break
        case 'codigoFilha':
          rowObj[header] = r.codigoFilha && r.codigoFilha !== '-' ? r.codigoFilha : ''
          break
        case 'contaFilha':
          rowObj[header] = r.contaFilha && r.contaFilha !== '-' ? r.contaFilha : ''
          break
        case 'codigo':
          rowObj[header] = r.codigo !== '-' ? r.codigo : ''
          break
        case 'conta':
          rowObj[header] = r.conta || ''
          break
        case 'descricao':
          rowObj[header] = r.descricao
          break
        case 'tipo':
          rowObj[header] = r.tipo
          break
        case 'natureza':
          rowObj[header] = r.natureza
          break
        case 'valor':
          rowObj[header] = Number(r.valor)
          break
        case 'pageNumber':
          rowObj[header] = r.pageNumber
          break
        case 'linhaOriginal':
          rowObj[header] = r.linhaOriginal
          break
      }
    }

    return rowObj
  })

  const wsMain = XLSX.utils.json_to_sheet(dataForSheet)

  // Ajusta larguras de colunas conforme o mapeamento ativo
  wsMain['!cols'] = activeMappings.map((m) => ({ wch: m.width || 15 }))

  // Identifica a coluna do Valor (R$) no mapeamento ativo para aplicar formato contábil
  const valorColIndex = activeMappings.findIndex((m) => m.id === 'valor')
  if (valorColIndex !== -1 && rows.length > 0) {
    const range = XLSX.utils.decode_range(wsMain['!ref'] || 'A1:A1')
    for (let rowNum = range.s.r + 1; rowNum <= range.e.r; rowNum++) {
      const cellAddress = XLSX.utils.encode_cell({ r: rowNum, c: valorColIndex })
      if (wsMain[cellAddress] && typeof wsMain[cellAddress].v === 'number') {
        wsMain[cellAddress].z = '"R$" #,##0.00;[Red]("R$" #,##0.00);"-"'
      }
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
