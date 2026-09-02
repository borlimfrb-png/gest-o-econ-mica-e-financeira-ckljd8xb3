import * as XLSX from 'xlsx'
import {
  extractTextFromPdf,
  parseBrlNumber,
  normalizeText,
  type PdfExtractionResult,
} from '@/lib/pdfParser'
import type { PlanoContaRecord } from '@/types/finance'

export interface DespesaExtraidaItem {
  id: string
  sourceFile: string
  sourceType: 'pdf' | 'excel'
  data: string // YYYY-MM-DD
  descricao: string
  categoriaSugerida: string
  valor: number
  pageOrRowInfo?: string

  // Comparação com Plano de Contas
  isCadastrada: boolean
  planoContaId?: string
  planoContaCodigo?: string
  planoContaNome?: string
  matchConfidence: 'alta' | 'media' | 'baixa' | 'nenhuma' | 'manual'
  matchScore: number // 0 a 100

  // Sugestões para novo cadastro se não cadastrada
  sugestaoContaNome?: string
  sugestaoCentroId?: string
  sugestaoTipoDespesaId?: string

  // Status de seleção pelo usuário na revisão
  selecionada: boolean
  edited?: boolean
}

export interface DespesaGrupoResumo {
  categoria: string
  quantidade: number
  totalValor: number
  itens: DespesaExtraidaItem[]
  cadastradasCount: number
  naoCadastradasCount: number
}

// Categorias padrão inteligentes para despesas
const CATEGORIAS_REGRAS: Array<{
  categoria: string
  keywords: string[]
}> = [
  {
    categoria: 'Pessoal e Encargos',
    keywords: [
      'salario',
      'salarios',
      'folha',
      'fgts',
      'inss',
      'pro labore',
      'pro-labore',
      'vale transporte',
      'vale refeicao',
      'vr',
      'vt',
      'recisao',
      'rescisao',
      'ferias',
      '13o',
      'decimo terceiro',
      'beneficios',
      'plano de saude',
      'unimed',
      'bradesco saude',
      'sulamerica',
      'odontologico',
      'adiantamento salarial',
      'estagiario',
      'estagio',
      'gratificacao',
      'comissao',
      'honorarios',
    ],
  },
  {
    categoria: 'Despesas Administrativas & TI',
    keywords: [
      'software',
      'saas',
      'cloud',
      'aws',
      'google',
      'microsoft',
      'adobe',
      'slack',
      'zoom',
      'openai',
      'chatgpt',
      'notion',
      'github',
      'hospedagem',
      'dominio',
      'licenca',
      'antivirus',
      'computador',
      'notebook',
      'hardware',
      'servidor',
      'internet',
      'fibra',
      'vivo',
      'claro',
      'tim',
      'oi',
      'telefonia',
      'celular',
      'material de escritorio',
      'papelaria',
      'toner',
      'impressora',
      'contabilidade',
      'juridico',
      'advogado',
      'consultoria',
      'auditoria',
      'aluguel',
      'condominio',
      'iptu',
      'seguro predial',
      'limpeza',
      'seguranca',
      'cafe',
      'copa',
      'conservacao',
    ],
  },
  {
    categoria: 'Marketing e Vendas',
    keywords: [
      'marketing',
      'publicidade',
      'propaganda',
      'anuncio',
      'facebook ads',
      'google ads',
      'meta ads',
      'linkedin ads',
      'instagram',
      'agencia',
      'design',
      'social media',
      'leads',
      'evento',
      'feira',
      'brindes',
      'comissao de vendas',
      'afiliados',
      'hubspot',
      'rd station',
      'activecampaign',
    ],
  },
  {
    categoria: 'Serviços de Terceiros e Operacionais',
    keywords: [
      'servico',
      'servicos',
      'prestador',
      'terceirizado',
      'manutencao',
      'reparo',
      'instalacao',
      'suporte',
      'tecnico',
      'motoboy',
      'entrega',
      'frete',
      'transportadora',
      'correios',
      'uber',
      '99app',
      'combustivel',
      'gasolina',
      'alcool',
      'diesel',
      'estacionamento',
      'pedagio',
      'viagem',
      'passagem',
      'hotel',
      'hospedagem viagem',
      'locacao de veiculos',
    ],
  },
  {
    categoria: 'Despesas Financeiras & Bancárias',
    keywords: [
      'tarifa',
      'taxa bancaria',
      'cesta de servicos',
      'iof',
      'juros',
      'juros passivos',
      'multa',
      'ted',
      'pix taxa',
      'cobranca',
      'manutencao de conta',
      'desconto duplicata',
      'antecipacao',
      'maquininha',
      'taxa cartao',
      'stone',
      'cielo',
      'rede',
      'pagseguro',
      'mercado pago',
      'anuidade',
    ],
  },
  {
    categoria: 'Tributos e Impostos',
    keywords: [
      'darf',
      'simples nacional',
      'das',
      'icms',
      'iss',
      'pis',
      'cofins',
      'irpj',
      'csll',
      'gps',
      'taxa municipal',
      'taxa de fiscalizacao',
      'alvara',
      'ipva',
      'tributo',
      'imposto',
      'contribuicao',
    ],
  },
  {
    categoria: 'Custos Operacionais & Insumos',
    keywords: [
      'fornecedor',
      'materia prima',
      'materiais',
      'embalagem',
      'insumos',
      'estoque',
      'compra mercadoria',
      'pecas',
      'componentes',
      'ferramentas',
      'energia eletrica',
      'luz',
      'enel',
      'cemig',
      'cpfl',
      'agua',
      'sabesp',
      'sanepar',
      'copasa',
      'gas',
    ],
  },
]

/**
 * Normaliza textos removendo pontuação e acentos para buscas flexíveis
 */
function cleanForComparison(text: string): string {
  return normalizeText(text)
    .replace(/[^\w\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Identifica a categoria da despesa com base no texto descritivo
 */
export function identificarCategoriaDespesa(descricao: string): string {
  const norm = cleanForComparison(descricao)
  if (!norm) return 'Despesas Gerais'

  for (const reg of CATEGORIAS_REGRAS) {
    for (const kw of reg.keywords) {
      if (norm.includes(cleanForComparison(kw))) {
        return reg.categoria
      }
    }
  }

  return 'Despesas Operacionais Gerais'
}

/**
 * Algoritmo de Similaridade e Matching com o Plano de Contas
 */
export function matchDespesaComPlanoContas(
  descricao: string,
  categoriaSugerida: string,
  planoContas: PlanoContaRecord[],
): {
  isCadastrada: boolean
  planoConta?: PlanoContaRecord
  confidence: 'alta' | 'media' | 'baixa' | 'nenhuma'
  score: number
} {
  if (!planoContas || planoContas.length === 0) {
    return { isCadastrada: false, confidence: 'nenhuma', score: 0 }
  }

  const descNorm = cleanForComparison(descricao)
  const catNorm = cleanForComparison(categoriaSugerida)
  const descWords = descNorm.split(' ').filter((w) => w.length > 2)

  let bestMatch: PlanoContaRecord | null = null
  let bestScore = 0

  for (const pc of planoContas) {
    const contaNome = pc.expand?.conta?.nome || ''
    const centroNome = pc.expand?.centro?.nome || ''
    const tipoNome = pc.expand?.tipo_despesa?.nome || ''
    const codigoPC = pc.codigo || ''
    const descPC = pc.descricao || ''

    const contaNorm = cleanForComparison(contaNome)
    const centroNorm = cleanForComparison(centroNome)
    const tipoNorm = cleanForComparison(tipoNome)
    const pcDescNorm = cleanForComparison(descPC)

    let score = 0

    // 1. Match exato de código ou nome da conta
    if (contaNorm && descNorm === contaNorm) {
      score += 95
    } else if (contaNorm && (descNorm.includes(contaNorm) || contaNorm.includes(descNorm))) {
      score += 75
    }

    // 2. Match de código do Plano de Contas presente na descrição
    if (codigoPC && descNorm.includes(cleanForComparison(codigoPC))) {
      score += 90
    }

    // 3. Match por palavras-chave relevantes
    if (contaNorm) {
      const contaWords = contaNorm.split(' ').filter((w) => w.length > 2)
      let wordMatches = 0
      for (const w of descWords) {
        if (contaWords.includes(w)) wordMatches++
      }
      if (contaWords.length > 0) {
        const wordScore = (wordMatches / contaWords.length) * 50
        score += wordScore
      }
    }

    // 4. Bônus por proximidade de centro de custo ou categoria
    if (centroNorm && descNorm.includes(centroNorm)) {
      score += 20
    }
    if (tipoNorm && (descNorm.includes(tipoNorm) || catNorm.includes(tipoNorm))) {
      score += 15
    }
    if (pcDescNorm && descWords.some((w) => pcDescNorm.includes(w))) {
      score += 10
    }

    // Penalidade se for conta de receita quando a despesa claramente é de custo
    const tipoConta = pc.expand?.conta?.tipo
    if (tipoConta === 'Receita') {
      score -= 40
    } else if (tipoConta === 'Despesa') {
      score += 15
    }

    if (score > bestScore) {
      bestScore = score
      bestMatch = pc
    }
  }

  // Define níveis de confiança
  const clampedScore = Math.min(Math.max(Math.round(bestScore), 0), 100)

  if (clampedScore >= 70 && bestMatch) {
    return {
      isCadastrada: true,
      planoConta: bestMatch,
      confidence: 'alta',
      score: clampedScore,
    }
  } else if (clampedScore >= 45 && bestMatch) {
    return {
      isCadastrada: true,
      planoConta: bestMatch,
      confidence: 'media',
      score: clampedScore,
    }
  } else if (clampedScore >= 25 && bestMatch) {
    return {
      isCadastrada: false,
      planoConta: bestMatch,
      confidence: 'baixa',
      score: clampedScore,
    }
  }

  return {
    isCadastrada: false,
    confidence: 'nenhuma',
    score: clampedScore,
  }
}

/**
 * Converte data para o formato padrão YYYY-MM-DD
 */
function normalizeDateStr(rawDate: unknown): string {
  const hoje = new Date().toISOString().slice(0, 10)
  if (!rawDate) return hoje

  if (rawDate instanceof Date && !isNaN(rawDate.getTime())) {
    return rawDate.toISOString().slice(0, 10)
  }

  if (typeof rawDate === 'number') {
    // Número serial de data do Excel
    try {
      const parsed = XLSX.SSF.parse_date_code(rawDate)
      if (parsed) {
        const y = String(parsed.y).padStart(4, '0')
        const m = String(parsed.m).padStart(2, '0')
        const d = String(parsed.d).padStart(2, '0')
        return `${y}-${m}-${d}`
      }
    } catch {
      /* intentionally ignored */
    }
  }

  if (typeof rawDate === 'string') {
    const s = rawDate.trim()
    // DD/MM/YYYY
    const brMatch = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/)
    if (brMatch) {
      const d = brMatch[1].padStart(2, '0')
      const m = brMatch[2].padStart(2, '0')
      const y = brMatch[3]
      return `${y}-${m}-${d}`
    }
    // YYYY-MM-DD
    const isoMatch = s.match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})/)
    if (isoMatch) {
      const y = isoMatch[1]
      const m = isoMatch[2].padStart(2, '0')
      const d = isoMatch[3].padStart(2, '0')
      return `${y}-${m}-${d}`
    }
  }

  return hoje
}

/**
 * Processador de arquivos Excel (.xlsx, .xls, .csv) para extrair despesas
 */
export async function parseExcelDespesas(
  file: File,
  planoContas: PlanoContaRecord[],
): Promise<DespesaExtraidaItem[]> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]

  if (!sheet) return []

  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
  const result: DespesaExtraidaItem[] = []

  rawRows.forEach((row, idx) => {
    // Busca flexível de campos
    const keys = Object.keys(row)
    let descVal = ''
    let dateVal = ''
    let valorVal = 0
    let catVal = ''

    for (const k of keys) {
      const kNorm = cleanForComparison(k)
      const val = row[k]

      if (
        !descVal &&
        (kNorm.includes('descricao') ||
          kNorm.includes('historico') ||
          kNorm.includes('fornecedor') ||
          kNorm.includes('despesa') ||
          kNorm.includes('conta') ||
          kNorm.includes('item') ||
          kNorm.includes('titulo'))
      ) {
        descVal = String(val).trim()
      } else if (
        !dateVal &&
        (kNorm.includes('data') ||
          kNorm.includes('vencimento') ||
          kNorm.includes('pagamento') ||
          kNorm.includes('competencia') ||
          kNorm.includes('emissao') ||
          kNorm.includes('dt'))
      ) {
        dateVal = normalizeDateStr(val)
      } else if (
        valorVal === 0 &&
        (kNorm.includes('valor') ||
          kNorm.includes('total') ||
          kNorm.includes('debito') ||
          kNorm.includes('preco') ||
          kNorm.includes('quantia') ||
          kNorm.includes('liquido') ||
          kNorm.includes('pago'))
      ) {
        if (typeof val === 'number') {
          valorVal = Math.abs(val)
        } else if (typeof val === 'string') {
          valorVal = Math.abs(parseBrlNumber(val))
        }
      } else if (
        !catVal &&
        (kNorm.includes('categoria') ||
          kNorm.includes('tipo') ||
          kNorm.includes('grupo') ||
          kNorm.includes('classificacao') ||
          kNorm.includes('centro'))
      ) {
        catVal = String(val).trim()
      }
    }

    // Se a descrição ainda não foi encontrada, pega a primeira coluna de texto
    if (!descVal) {
      for (const k of keys) {
        const val = row[k]
        if (typeof val === 'string' && val.trim().length > 3 && isNaN(Number(val))) {
          descVal = val.trim()
          break
        }
      }
    }

    // Se o valor não foi encontrado por nome de coluna, procura o primeiro número válido
    if (valorVal === 0) {
      for (const k of keys) {
        const val = row[k]
        const parsed = typeof val === 'number' ? Math.abs(val) : parseBrlNumber(String(val))
        if (parsed > 0) {
          valorVal = parsed
          break
        }
      }
    }

    if (descVal && valorVal > 0) {
      const catSugerida = catVal || identificarCategoriaDespesa(descVal)
      const match = matchDespesaComPlanoContas(descVal, catSugerida, planoContas)

      result.push({
        id: `excel_${idx}_${Math.random().toString(36).slice(2, 7)}`,
        sourceFile: file.name,
        sourceType: 'excel',
        data: dateVal || new Date().toISOString().slice(0, 10),
        descricao: descVal,
        categoriaSugerida: catSugerida,
        valor: valorVal,
        pageOrRowInfo: `Linha ${idx + 2}`,
        isCadastrada: match.isCadastrada,
        planoContaId: match.planoConta?.id,
        planoContaCodigo: match.planoConta?.codigo,
        planoContaNome: match.planoConta?.expand?.conta?.nome,
        matchConfidence: match.confidence,
        matchScore: match.score,
        sugestaoContaNome: descVal,
        selecionada: true,
      })
    }
  })

  return result
}

/**
 * Regex para capturar data em linhas de PDF (ex: 15/01/2025 ou 2025-01-15)
 */
const DATE_IN_LINE_REGEX = /\b(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{4}|\d{4}[/\-.]\d{1,2}[/\-.]\d{1,2})\b/

/**
 * Processador de arquivos PDF para extrair despesas individuais
 */
export async function parsePdfDespesas(
  file: File,
  planoContas: PlanoContaRecord[],
  onProgress?: (pct: number, current: number, total: number) => void,
): Promise<{ itens: DespesaExtraidaItem[]; rawResult: PdfExtractionResult }> {
  const pdfResult = await extractTextFromPdf(file, onProgress)
  const result: DespesaExtraidaItem[] = []

  let itemIdx = 0

  for (const page of pdfResult.pages) {
    for (const line of page.lines) {
      const lineTrim = line.trim()
      if (!lineTrim || lineTrim.length < 5) continue

      // Procura data na linha
      const dateMatch = lineTrim.match(DATE_IN_LINE_REGEX)
      const extractedDate = dateMatch
        ? normalizeDateStr(dateMatch[0])
        : new Date().toISOString().slice(0, 10)

      // Procura valores monetários
      const valMatches = Array.from(
        lineTrim.matchAll(
          /(?:R\$\s*)?(?:(?:\d{1,3}(?:\.\d{3})+|\d+),\d{2}|\b\d+\.\d{2}\b|\(\s*(?:R\$\s*)?(?:\d{1,3}(?:\.\d{3})+|\d+),\d{2}\s*\))/gi,
        ),
      )

      if (valMatches.length === 0) continue

      const lastMatch = valMatches[valMatches.length - 1]
      const valor = Math.abs(parseBrlNumber(lastMatch[0]))
      if (valor <= 0) continue

      // Extrai a descrição removendo data, valores e pontuação estrutural
      let descPart = lineTrim.slice(0, lastMatch.index).trim()
      if (dateMatch && dateMatch.index !== undefined) {
        // Remove a data da descrição
        descPart = descPart.replace(dateMatch[0], ' ')
      }

      // Limpeza da descrição
      const cleanDesc = descPart
        .replace(/[.\-–—_]{2,}/g, ' ')
        .replace(/^[\d.\-/]+\s*[-–—:]*\s*/, '')
        .replace(/[|;:]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()

      if (cleanDesc.length < 3 || cleanDesc.length > 150) continue

      const normDesc = cleanForComparison(cleanDesc)
      const noise = [
        'saldo',
        'total',
        'subtotal',
        'pagina',
        'folha',
        'balancete',
        'demonstrativo',
        'exercicio',
        'usuario',
        'periodo',
        'cnpj',
        'cpf',
      ]
      if (noise.some((n) => normDesc === n || normDesc.startsWith(n + ' '))) {
        continue
      }

      const catSugerida = identificarCategoriaDespesa(cleanDesc)
      const match = matchDespesaComPlanoContas(cleanDesc, catSugerida, planoContas)

      result.push({
        id: `pdf_p${page.pageNumber}_${itemIdx++}_${Math.random().toString(36).slice(2, 7)}`,
        sourceFile: file.name,
        sourceType: 'pdf',
        data: extractedDate,
        descricao: cleanDesc,
        categoriaSugerida: catSugerida,
        valor: valor,
        pageOrRowInfo: `Pág. ${page.pageNumber}`,
        isCadastrada: match.isCadastrada,
        planoContaId: match.planoConta?.id,
        planoContaCodigo: match.planoConta?.codigo,
        planoContaNome: match.planoConta?.expand?.conta?.nome,
        matchConfidence: match.confidence,
        matchScore: match.score,
        sugestaoContaNome: cleanDesc,
        selecionada: true,
      })
    }
  }

  return {
    itens: result,
    rawResult: pdfResult,
  }
}

/**
 * Agrupa despesas por Categoria para visualização e análise de totais
 */
export function agruparDespesasPorCategoria(itens: DespesaExtraidaItem[]): DespesaGrupoResumo[] {
  const map = new Map<string, DespesaExtraidaItem[]>()

  for (const item of itens) {
    const cat = item.categoriaSugerida || 'Outras Despesas'
    const list = map.get(cat) || []
    list.push(item)
    map.set(cat, list)
  }

  const grupos: DespesaGrupoResumo[] = []

  for (const [categoria, list] of map.entries()) {
    const total = list.reduce((acc, curr) => acc + (curr.valor || 0), 0)
    const cadastradas = list.filter((i) => i.isCadastrada).length
    const naoCadastradas = list.length - cadastradas

    grupos.push({
      categoria,
      quantidade: list.length,
      totalValor: total,
      itens: list,
      cadastradasCount: cadastradas,
      naoCadastradasCount: naoCadastradas,
    })
  }

  // Ordena por maior valor total de despesa
  return grupos.sort((a, b) => b.totalValor - a.totalValor)
}
