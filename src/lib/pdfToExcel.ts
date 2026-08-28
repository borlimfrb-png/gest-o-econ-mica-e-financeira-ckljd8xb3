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
  descricao: string
  tipo: string
  natureza: 'Débito' | 'Crédito' | 'Saldo' | 'Geral'
  valor: number
  valoresAdicionais?: number[]
  linhaOriginal: string
  linhaConta?: string
  editedFields?: Partial<
    Record<'codigo' | 'conta' | 'descricao' | 'tipo' | 'natureza' | 'valor', boolean>
  >
}

export type ColumnFieldKey =
  | 'item'
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
    id: 'codigo',
    label: 'Código Contábil',
    excelHeader: 'Código Contábil',
    included: true,
    width: 18,
  },
  {
    id: 'conta',
    label: 'Conta Contábil (Cabeçalho)',
    excelHeader: 'Conta Contábil',
    included: true,
    width: 35,
  },
  {
    id: 'descricao',
    label: 'Despesa / Descrição',
    excelHeader: 'Descrição da Despesa',
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
    label: 'Valor Pago (R$)',
    excelHeader: 'Valor (R$)',
    included: true,
    width: 18,
  },
  { id: 'pageNumber', label: 'Página no PDF', excelHeader: 'Pág. PDF', included: true, width: 10 },
  {
    id: 'linhaOriginal',
    label: 'Linha Original do PDF',
    excelHeader: 'Linha Original do PDF',
    included: true,
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

// Expressão regular para identificar códigos contábeis estruturais (ex: 1.01.01.001 ou 1.1.1.01 ou 3.01.001 ou 2.1.01)
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
  'conta:',
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

/**
 * Detecta se uma linha pura de texto (sem valor ou com valor de saldo/cabeçalho) é um cabeçalho de CONTA
 */
export function isAccountHeaderLine(line: string): {
  isHeader: boolean
  codigo: string
  nomeConta: string
} {
  const raw = line.trim()
  if (!raw || raw.length < 3) return { isHeader: false, codigo: '', nomeConta: '' }

  const norm = normalizeText(raw)

  // Ignora ruídos genéricos de cabeçalho de página
  if (NOISE_STARTS.some((n) => norm.startsWith(n))) {
    return { isHeader: false, codigo: '', nomeConta: '' }
  }

  // Ignora cabeçalhos de colunas comuns (ex: "Data Histórico Valor", "Código Descrição Debito Credito Saldo")
  if (
    norm.includes('data') &&
    (norm.includes('historico') || norm.includes('descricao') || norm.includes('documento')) &&
    (norm.includes('valor') ||
      norm.includes('debito') ||
      norm.includes('credito') ||
      norm.includes('saldo'))
  ) {
    return { isHeader: false, codigo: '', nomeConta: '' }
  }

  // 1. Prefixo explícito como "Conta:", "Conta Contábil:", "Cta.:"
  for (const prefix of ACCOUNT_HEADER_PREFIXES) {
    if (norm.startsWith(prefix)) {
      const rest = raw.substring(prefix.length).trim()
      let codigo = ''
      const codeMatch = rest.match(REGEX_ACCOUNT_CODE)
      if (codeMatch && codeMatch.index !== undefined && codeMatch.index < 10) {
        codigo = codeMatch[1]
      }
      const nomeConta =
        rest
          .replace(REGEX_ACCOUNT_CODE, '')
          .replace(/^[.\-–—:;\s]+/, '')
          .replace(/[.\-–—:;\s]+$/, '')
          .replace(/\s+/g, ' ')
          .trim() || rest

      return { isHeader: true, codigo, nomeConta }
    }
  }

  // 2. Linha que inicia com código contábil estrutural (ex: "3.1.01.001 Despesas Administrativas" ou "4.1.02 - Fornecedores")
  const codeMatch = raw.match(REGEX_ACCOUNT_CODE)
  if (codeMatch && codeMatch.index !== undefined && codeMatch.index <= 2) {
    const code = codeMatch[1]
    const rest = raw
      .replace(REGEX_ACCOUNT_CODE, '')
      .replace(/^[.\-–—:;\s]+/, '')
      .replace(/[.\-–—:;\s]+$/, '')
      .replace(/\s+/g, ' ')
      .trim()

    // Se tiver nome textual relevante
    if (rest.length >= 3) {
      return { isHeader: true, codigo: code, nomeConta: rest }
    }
  }

  // 3. Linha sem valor monetário que parece ser um título de conta/grupo contábil
  const matchesMonetary = Array.from(raw.matchAll(REGEX_MONETARY))
  if (matchesMonetary.length === 0) {
    // Linha em maiúsculas ou destacada sem pontuação de frase
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

      return { isHeader: true, codigo: '', nomeConta }
    }
  }

  return { isHeader: false, codigo: '', nomeConta: '' }
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
export function convertPdfPagesToExcelRows(pages: ExtractedPageText[]): PdfExcelRow[] {
  const rows: PdfExcelRow[] = []

  // Mantém a última conta contábil identificada como contexto ativo para as despesas abaixo dela
  let currentContaHeader = ''
  let currentCodigoHeader = ''
  let currentContaRawLine = ''

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

      // 1. Linha SEM valores monetários: verificar se é cabeçalho de conta
      if (!matches || matches.length === 0) {
        const headerCheck = isAccountHeaderLine(rawLine)
        if (headerCheck.isHeader) {
          currentContaHeader = headerCheck.nomeConta
          currentCodigoHeader = headerCheck.codigo
          currentContaRawLine = rawLine
        }
        return
      }

      // 2. Linha COM valores monetários:
      // Pode ser tanto:
      // a) Uma linha de despesa paga que pertence à conta de cima (currentContaHeader)
      // b) Uma linha de conta que já tem o valor embutido nela mesma
      // c) Um cabeçalho de conta com saldo ou total

      const numericValues = matches.map((m) => parseBrlNumber(m[0]))
      const primaryValue = numericValues[numericValues.length - 1]
      const primaryMatch = matches[matches.length - 1]

      const textBefore = rawLine.substring(0, matches[0].index).trim()

      // Tenta achar código contábil na própria linha
      let inlineCodigo = ''
      const codeMatch = textBefore.match(REGEX_ACCOUNT_CODE) || rawLine.match(REGEX_ACCOUNT_CODE)
      if (codeMatch && codeMatch.index !== undefined && codeMatch.index < 20) {
        inlineCodigo = codeMatch[1]
      }

      // Descrição limpa da linha de despesa
      let inlineDescricao = textBefore
        .replace(REGEX_ACCOUNT_CODE, '')
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

      // Se a linha começar com prefixo de conta explícito (ex: "Conta: 3.1.01 - Aluguel R$ 1.500"), atualiza conta ativa
      const headerCheck = isAccountHeaderLine(rawLine)
      if (headerCheck.isHeader && headerCheck.nomeConta) {
        currentContaHeader = headerCheck.nomeConta
        if (headerCheck.codigo) currentCodigoHeader = headerCheck.codigo
        currentContaRawLine = rawLine
      }

      // Determina a CONTA associada e a DESCRIÇÃO DA DESPESA
      let contaFinal = currentContaHeader
      let codigoFinal = inlineCodigo || currentCodigoHeader || '-'
      let descricaoFinal = inlineDescricao

      // Se não havia conta no cabeçalho acima, mas a linha possui descrição própria, usa a descrição
      if (!contaFinal) {
        if (inlineDescricao) {
          contaFinal = inlineDescricao
        } else if (inlineCodigo) {
          contaFinal = `Conta ${inlineCodigo}`
        } else {
          contaFinal = 'Despesa Geral'
        }
      }

      // Se a descrição da despesa ficou vazia, preenche com o texto ou com o nome da conta
      if (!descricaoFinal) {
        descricaoFinal = rawLine.replace(REGEX_MONETARY, '').trim() || contaFinal
      }

      // Se a linha for idêntica ao nome da conta, mantém coerente
      if (
        descricaoFinal === contaFinal &&
        currentContaHeader &&
        currentContaHeader !== inlineDescricao
      ) {
        descricaoFinal = inlineDescricao || currentContaHeader
      }

      const tipo = inferTipoClassificacao(codigoFinal, `${contaFinal} ${descricaoFinal}`)
      const natureza = inferNatureza(rawLine, primaryMatch[0])

      rows.push({
        id: `p${page.pageNumber}_l${lineIdx}_${Math.random().toString(36).substring(2, 7)}`,
        pageNumber: page.pageNumber,
        codigo: codigoFinal,
        conta: contaFinal,
        descricao: descricaoFinal,
        tipo,
        natureza,
        valor: primaryValue,
        valoresAdicionais: numericValues.length > 1 ? numericValues.slice(0, -1) : undefined,
        linhaOriginal: rawLine,
        linhaConta: currentContaRawLine || undefined,
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
