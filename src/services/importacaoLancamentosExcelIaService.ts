import pb from '@/lib/pocketbase/client'
import * as XLSX from 'xlsx'
import { parseBrlNumber } from '@/lib/pdfParser'
import { findBestPlanoContaMatch } from '@/lib/pdfMatching'
import type { EmpresaRecord, PlanoContaRecord, MemoriaFornecedorRecord } from '@/types/finance'

export type FormatoPlanilhaExcel = 'padrao_colunas' | 'matriz_mensal'

export interface ColumnMappingState {
  formato?: FormatoPlanilhaExcel
  data: string
  historico: string
  valor: string
  tipo: string // 'Receita' | 'Despesa' ou coluna
  codigoConta: string
  nomeConta: string
  centroCusto: string
  documento: string
  formaPagamento: string
  // No formato matriz mensal:
  // Coluna A = conta de despesa
  colunaContaMatriz?: string
  // Mapeamento dos 12 meses: mês 1..12 -> nome da coluna
  colunasMesesMatriz?: { [mes: number]: string }
}

/**
 * Retorna o último dia de um mês específico para determinado ano (considerando anos bissextos)
 */
export function getUltimoDiaDoMes(ano: number, mes: number): number {
  return new Date(ano, mes, 0).getDate()
}

/**
 * Retorna a data no formato DD/MM/AAAA para o último dia do mês e ano informados
 */
export function formatarUltimoDiaDoMes(ano: number, mes: number): string {
  const ultimoDia = getUltimoDiaDoMes(ano, mes)
  const diaPad = String(ultimoDia).padStart(2, '0')
  const mesPad = String(mes).padStart(2, '0')
  return `${diaPad}/${mesPad}/${ano}`
}

/**
 * Retorna os rótulos canônicos das 12 colunas mensais com o último dia do mês + ano escolhido
 * Ex para 2027: { 1: "31/01/2027", 2: "28/02/2027", 3: "31/03/2027", ..., 12: "31/12/2027" }
 * Para 2028: mês 2 é 29/02/2028
 */
export function getRotulosColunasMatrizMensal(ano: number): { [mes: number]: string } {
  const rotulos: { [mes: number]: string } = {}
  for (let mes = 1; mes <= 12; mes++) {
    rotulos[mes] = formatarUltimoDiaDoMes(ano, mes)
  }
  return rotulos
}

/**
 * Identifica se uma coluna corresponde a determinado mês (1 a 12),
 * reconhecendo DD/MM, DD/MM/AAAA, DD-MM, nome do mês ("jan", "janeiro") etc.
 */
export function identificarMesDaColuna(colHeader: string, anoEsperado?: number): number | null {
  if (!colHeader) return null
  const s = String(colHeader).trim()
  if (!s || /^_{1,2}EMPTY(_\d+)?$/i.test(s)) return null

  const clean = s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()

  // 1. Tenta padrão de data DD/MM ou DD/MM/AAAA ou DD-MM-AAAA
  const dataMatch = clean.match(/^(\d{1,2})[/\-.](\d{1,2})(?:[/\-.](\d{2,4}))?/)
  if (dataMatch) {
    const dia = parseInt(dataMatch[1], 10)
    const mes = parseInt(dataMatch[2], 10)
    const anoStr = dataMatch[3]
    if (mes >= 1 && mes <= 12 && dia >= 1 && dia <= 31) {
      if (anoStr && anoEsperado) {
        let anoNum = parseInt(anoStr, 10)
        if (anoNum < 100) anoNum += 2000
        // Se ano informado bater ou se for compatível
        if (anoNum === anoEsperado) return mes
      }
      return mes
    }
  }

  // 2. Tenta padrão YYYY-MM ou YYYY-MM-DD
  const isoMatch = clean.match(/^(\d{4})[/\-.](\d{1,2})(?:[/\-.](\d{1,2}))?/)
  if (isoMatch) {
    const anoNum = parseInt(isoMatch[1], 10)
    const mes = parseInt(isoMatch[2], 10)
    if (mes >= 1 && mes <= 12) {
      if (!anoEsperado || anoNum === anoEsperado) return mes
    }
  }

  // 3. Tenta nomes de meses ("jan", "janeiro", "mês 1", "01/jan", etc)
  const mesesAbrev = [
    'jan',
    'fev',
    'mar',
    'abr',
    'mai',
    'jun',
    'jul',
    'ago',
    'set',
    'out',
    'nov',
    'dez',
  ]
  for (let m = 0; m < 12; m++) {
    const abrev = mesesAbrev[m]
    const extenso = NOMES_MESES_EXTENSO[m].toLowerCase()
    if (
      clean === abrev ||
      clean === extenso ||
      clean.startsWith(`${abrev}/`) ||
      clean.startsWith(`${abrev} `) ||
      clean.includes(abrev)
    ) {
      return m + 1
    }
  }

  return null
}

/**
 * Detecta se os cabeçalhos da planilha configuram o formato Matriz Mensal:
 * Coluna A = conta de despesas (código ou nome de conta)
 * Colunas subsequentes = meses (31/01, 28/02... ou nomes dos meses)
 */
export function detectarFormatoMatrizMensal(
  headers: string[],
  anoSelecionado?: number,
): { isMatriz: boolean; colunaConta: string; colunasMeses: { [mes: number]: string } } {
  if (!headers || headers.length < 3) {
    return { isMatriz: false, colunaConta: '', colunasMeses: {} }
  }

  const colunasMeses: { [mes: number]: string } = {}
  let mesesEncontrados = 0

  // Verifica as colunas a partir do índice 1 (Coluna B em diante)
  headers.forEach((h, idx) => {
    if (idx === 0) return // Coluna A é reservada para a Conta
    const mes = identificarMesDaColuna(h, anoSelecionado)
    if (mes !== null && !colunasMeses[mes]) {
      colunasMeses[mes] = h
      mesesEncontrados++
    }
  })

  // Se encontrou pelo menos 3 meses identificáveis entre as colunas, qualifica como matriz mensal
  // (geralmente serão 12, mas suportamos planilhas com trimestres/semestres ou 12 meses)
  const isMatriz = mesesEncontrados >= 3
  const colunaConta = headers[0] || ''

  return { isMatriz, colunaConta, colunasMeses }
}

/**
 * Converte índice numérico de coluna base 0 para letra no formato Excel (0 -> A, 1 -> B, 25 -> Z, 26 -> AA, etc.)
 */
export function colIndexToExcelLetter(colIdx: number): string {
  if (isNaN(colIdx) || colIdx < 0) return 'A'
  let letter = ''
  let n = colIdx
  while (n >= 0) {
    letter = String.fromCharCode((n % 26) + 65) + letter
    n = Math.floor(n / 26) - 1
  }
  return letter
}

/**
 * Normaliza rótulo de cabeçalho detectado pelo parser XLSX.
 * Células vazias na primeira linha viram __EMPTY, __EMPTY_1, etc.
 * Converte essas ocorrências para um rótulo legível estilo Excel.
 */
export function formatarNomeColunaExcel(header: string, index?: number): string {
  if (!header) {
    const letra = typeof index === 'number' && index >= 0 ? colIndexToExcelLetter(index) : '?'
    return `Coluna ${letra} (Sem cabeçalho)`
  }

  const trimmed = String(header).trim()
  // Verifica se é placeholder de coluna vazia do sheet_to_json (__EMPTY, __EMPTY_1, _EMPTY_, etc)
  if (/^_{1,2}EMPTY(_\d+)?$/i.test(trimmed)) {
    const matchNum = trimmed.match(/\d+$/)
    const colIdx = matchNum ? parseInt(matchNum[0], 10) : typeof index === 'number' ? index : 0
    const letra = colIndexToExcelLetter(colIdx)
    return `Coluna ${letra} (Sem cabeçalho)`
  }

  return trimmed
}

/**
 * Limpa valores de amostra ou de células prevenindo a exibição crua de __EMPTY__ ou strings vazias
 */
export function sanitizarValorCelula(val: unknown): string {
  if (val === null || val === undefined) return ''
  const s = String(val).trim()
  if (/^_{1,2}EMPTY(_\d+)?$/i.test(s)) return ''
  return s
}

export interface LancamentoExcelLinha {
  id: string
  linhaPlanilha: number
  dataStr: string
  dataIso: string
  ano: number
  mes: number // 1 a 12
  historico: string
  valor: number
  tipo: 'Receita' | 'Despesa'
  codigoContaPlanilha?: string
  nomeContaPlanilha?: string
  centroCustoPlanilha?: string
  documentoPlanilha?: string
  formaPagamentoPlanilha?: string
  // Vínculo inteligente com Plano de Contas
  planoContaId?: string
  planoContaCodigo?: string
  planoContaNome?: string
  planoContaTipo?: string
  planoContaObj?: PlanoContaRecord
  matchConfidence: 'memoria' | 'codigo_empresa' | 'exato' | 'similar' | 'manual' | 'nao_encontrado'
  status: 'valido' | 'alerta' | 'fora_periodo' | 'duplicado' | 'erro'
  errosOuAlertas: string[]
  selecionado: boolean
  isDuplicadoExistente?: boolean
}

export interface ResumoImportacaoExcelLancamentos {
  totalLidos: number
  totalNoPeriodo: number
  totalForaPeriodo: number
  totalValidos: number
  totalComProblema: number
  totalDuplicados: number
  totalReceitas: number
  totalDespesas: number
  valorTotalReceitas: number
  valorTotalDespesas: number
  mesesDetectados: { [mes: number]: { count: number; valor: number } }
}

export const NOMES_MESES_EXTENSO = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

/**
 * Normaliza datas do Excel (número serial, Date, string ISO, DD/MM/AAAA, etc)
 */
export function normalizarDataExcel(
  val: unknown,
): { iso: string; ano: number; mes: number; display: string } | null {
  if (val === null || val === undefined || val === '') return null

  let d: Date | null = null

  if (val instanceof Date && !isNaN(val.getTime())) {
    d = val
  } else if (typeof val === 'number') {
    // Serial do Excel: dias desde 1899-12-30
    const parsed = XLSX.SSF.parse_date_code(val)
    if (parsed) {
      d = new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d))
    }
  } else if (typeof val === 'string') {
    const s = val.trim()
    // Tenta formato DD/MM/YYYY ou DD-MM-YYYY
    const brMatch = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/)
    if (brMatch) {
      const dia = parseInt(brMatch[1], 10)
      const mes = parseInt(brMatch[2], 10)
      let ano = parseInt(brMatch[3], 10)
      if (ano < 100) ano += 2000
      d = new Date(ano, mes - 1, dia)
    } else {
      // Tenta formato YYYY-MM-DD
      const isoMatch = s.match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})/)
      if (isoMatch) {
        const ano = parseInt(isoMatch[1], 10)
        const mes = parseInt(isoMatch[2], 10)
        const dia = parseInt(isoMatch[3], 10)
        d = new Date(ano, mes - 1, dia)
      } else {
        const timestamp = Date.parse(s)
        if (!isNaN(timestamp)) {
          d = new Date(timestamp)
        }
      }
    }
  }

  if (!d || isNaN(d.getTime())) return null

  const ano = d.getFullYear()
  const mes = d.getMonth() + 1
  const dia = d.getDate()
  const pad = (n: number) => String(n).padStart(2, '0')
  const iso = `${ano}-${pad(mes)}-${pad(dia)}`
  const display = `${pad(dia)}/${pad(mes)}/${ano}`

  return { iso, ano, mes, display }
}

/**
 * Lê arquivo Excel ou CSV usando a biblioteca xlsx
 */
export async function extrairLinhasExcel(file: File): Promise<{
  headers: string[]
  rawRows: Array<Record<string, unknown>>
}> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, {
    type: 'array',
    cellDates: true,
    raw: false,
    dateNF: 'yyyy-mm-dd',
  })

  const firstSheetName = workbook.SheetNames[0]
  if (!firstSheetName) {
    throw new Error('A planilha está vazia ou não possui abas.')
  }

  const sheet = workbook.Sheets[firstSheetName]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
    raw: false,
  })

  if (rows.length === 0) {
    throw new Error('Nenhuma linha de dados encontrada na planilha.')
  }

  // Descobre cabeçalhos reais a partir da linha de cabeçalho da planilha
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1')
  const headersFromSheet: string[] = []
  for (let C = range.s.c; C <= range.e.c; ++C) {
    const cellAddress = XLSX.utils.encode_cell({ r: range.s.r, c: C })
    const cell = sheet[cellAddress]
    const headerVal = cell ? String(cell.v ?? cell.w ?? '').trim() : ''
    headersFromSheet.push(headerVal)
  }

  // Coleta chaves presentes nos objetos de linha (respeitando a ordem do sheet)
  const rawHeaders = Object.keys(rows[0] || {})
  const headers = rawHeaders.length > 0 ? rawHeaders : headersFromSheet

  return { headers, rawRows: rows }
}

/**
 * Heurística preliminar rápida de detecção de colunas
 */
export function sugerirMapeamentoHeuristico(
  headers: string[],
  anoSelecionado?: number,
): ColumnMappingState {
  const clean = (s: string) =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '')

  // 1. Checa se é o formato PADRÃO "Matriz Mensal":
  // Coluna A = Conta de despesa, Colunas B..M = Meses (31/01, 28/02, 31/03, ..., 31/12)
  const matrizCheck = detectarFormatoMatrizMensal(headers, anoSelecionado)
  if (matrizCheck.isMatriz) {
    const colunasMeses = matrizCheck.colunasMeses

    // Se algumas colunas não foram identificadas mas estão na ordem sequencial das colunas B..M
    // completa o mapeamento posicional das 12 colunas se houver ao menos 13 colunas
    if (headers.length >= 13) {
      for (let m = 1; m <= 12; m++) {
        if (!colunasMeses[m] && headers[m]) {
          colunasMeses[m] = headers[m]
        }
      }
    }

    return {
      formato: 'matriz_mensal',
      data: '',
      historico: '',
      valor: '',
      tipo: 'Despesa',
      codigoConta: matrizCheck.colunaConta,
      nomeConta: matrizCheck.colunaConta,
      centroCusto: '',
      documento: '',
      formaPagamento: '',
      colunaContaMatriz: matrizCheck.colunaConta,
      colunasMesesMatriz: colunasMeses,
    }
  }

  const mapping: ColumnMappingState = {
    formato: 'padrao_colunas',
    data: '',
    historico: '',
    valor: '',
    tipo: '',
    codigoConta: '',
    nomeConta: '',
    centroCusto: '',
    documento: '',
    formaPagamento: '',
  }

  // Passada 1: Prioridade MÁXIMA para os cabeçalhos oficiais do modelo exportado
  for (const h of headers) {
    const c = clean(h)
    // "Data do Lançamento"
    if (!mapping.data && (c === 'datadolancamento' || c === 'datalancamento' || c === 'datalanc')) {
      mapping.data = h
    }
    // "Código da Conta"
    if (
      !mapping.codigoConta &&
      (c === 'codigodaconta' || c === 'codigoconta' || c === 'coddaconta')
    ) {
      mapping.codigoConta = h
    }
    // "Nome da Conta"
    if (
      !mapping.nomeConta &&
      (c === 'nomedaconta' || c === 'nomeconta' || c === 'nomeda' || c === 'contanome')
    ) {
      mapping.nomeConta = h
    }
    // "Valor"
    if (!mapping.valor && c === 'valor') {
      mapping.valor = h
    }
  }

  // Passada 2: Mapeamento heurístico padrão para outras colunas ou variações
  for (const h of headers) {
    if (
      h === mapping.data ||
      h === mapping.codigoConta ||
      h === mapping.nomeConta ||
      h === mapping.valor
    ) {
      continue
    }
    const c = clean(h)

    if (
      !mapping.data &&
      (c.includes('data') ||
        c.includes('dt') ||
        c.includes('competencia') ||
        c.includes('vencimento') ||
        c.includes('pagamento'))
    ) {
      mapping.data = h
    } else if (
      !mapping.codigoConta &&
      (c.includes('codconta') ||
        c.includes('codigoconta') ||
        c.includes('codempresa') ||
        c.includes('codigoempresa') ||
        c.includes('classificacao') ||
        c.includes('reduzido') ||
        c.includes('contared'))
    ) {
      mapping.codigoConta = h
    } else if (
      !mapping.nomeConta &&
      (c.includes('nomeconta') ||
        c.includes('nomedaconta') ||
        c.includes('tituloconta') ||
        c.includes('contacontabil') ||
        (c.includes('conta') && !c.includes('banc') && !c.includes('corrente')) ||
        c.includes('categoria'))
    ) {
      mapping.nomeConta = h
    } else if (
      !mapping.valor &&
      (c.includes('valor') ||
        c.includes('total') ||
        c.includes('quantia') ||
        c.includes('debito') ||
        c.includes('credito') ||
        c.includes('montante'))
    ) {
      mapping.valor = h
    } else if (
      !mapping.historico &&
      (c.includes('historico') ||
        c.includes('descricao') ||
        c.includes('fornecedor') ||
        c.includes('cliente') ||
        c.includes('detalhe') ||
        c.includes('complemento'))
    ) {
      mapping.historico = h
    } else if (
      !mapping.tipo &&
      (c === 'tipo' ||
        c.includes('natureza') ||
        c.includes('operacao') ||
        c.includes('entradasaida') ||
        c.includes('d_c') ||
        c.includes('dc'))
    ) {
      mapping.tipo = h
    } else if (
      !mapping.centroCusto &&
      (c.includes('centro') ||
        c.includes('cc') ||
        c.includes('departamento') ||
        c.includes('unidade'))
    ) {
      mapping.centroCusto = h
    } else if (
      !mapping.documento &&
      (c.includes('documento') ||
        c.includes('doc') ||
        c.includes('nf') ||
        c.includes('numero') ||
        c.includes('nota'))
    ) {
      mapping.documento = h
    } else if (
      !mapping.formaPagamento &&
      (c.includes('forma') || c.includes('pagamento') || c.includes('meio') || c.includes('banco'))
    ) {
      mapping.formaPagamento = h
    }
  }

  // Fallbacks seguros se ainda não encontrou
  if (!mapping.data) {
    const firstDateCol = headers.find((h) => clean(h).includes('dt') || clean(h).includes('dia'))
    if (firstDateCol) mapping.data = firstDateCol
  }

  if (!mapping.historico) {
    const firstTextCol = headers.find(
      (h) =>
        h !== mapping.data &&
        h !== mapping.valor &&
        h !== mapping.codigoConta &&
        h !== mapping.nomeConta &&
        !clean(h).includes('cod') &&
        !clean(h).includes('id'),
    )
    if (firstTextCol) mapping.historico = firstTextCol
  }

  return mapping
}

/**
 * Envia cabeçalho e amostra para o assistente de IA analisar mapeamento
 */
export async function analisarColunasComIA(
  headers: string[],
  sampleRows: Array<Record<string, unknown>>,
  anoSelecionado?: number,
): Promise<{ mapping: Partial<ColumnMappingState>; confianca: number; observacoes?: string }> {
  // 1. Verificação preliminar local imediata: se casar com a matriz mensal, adota imediatamente
  const matrizCheck = detectarFormatoMatrizMensal(headers, anoSelecionado)
  if (matrizCheck.isMatriz) {
    const heur = sugerirMapeamentoHeuristico(headers, anoSelecionado)
    return {
      mapping: heur,
      confianca: 0.98,
      observacoes: `Planilha no formato matriz mensal detectada automaticamente (Coluna A = Contas de Despesas, Colunas B..M = Meses com último dia).`,
    }
  }

  try {
    const backendUrl = import.meta.env.VITE_POCKETBASE_URL || ''
    const token = pb.authStore.token
    if (!token) {
      throw new Error('Não autenticado')
    }

    const res = await fetch(`${backendUrl}/backend/v1/agent-lancamentos/analisar-colunas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token,
      },
      body: JSON.stringify({
        headers,
        sampleRows: sampleRows.slice(0, 10),
        anoSelecionado,
      }),
    })

    if (!res.ok) {
      throw new Error(`Falha no assistente IA (${res.status})`)
    }

    const data = await res.json()
    return data
  } catch (err) {
    console.warn('[analisarColunasComIA] Fallback heurístico aplicado:', err)
    const heur = sugerirMapeamentoHeuristico(headers, anoSelecionado)
    return {
      mapping: heur,
      confianca: 0.7,
      observacoes: 'Mapeamento inteligente por regras contábeis locais.',
    }
  }
}

/**
 * Processa as linhas cruas da planilha de acordo com o mapeamento e regras de negócio
 */
export function processarLinhasPlanilha(options: {
  rawRows: Array<Record<string, unknown>>
  mapping: ColumnMappingState
  anoSelecionado: number
  mesInicial: number // 1 a 12
  mesFinal: number // 1 a 12
  mesesHabilitados?: Set<number>
  planoContas: PlanoContaRecord[]
  memoriasFornecedores?: MemoriaFornecedorRecord[]
  mapeamentosAprendidos?: Array<{ codigo_empresa: string; plano_conta: string }>
  lancamentosExistentes?: Array<{
    data: string
    valor: number
    historico?: string
    plano_conta?: string
  }>
}): {
  linhas: LancamentoExcelLinha[]
  resumo: ResumoImportacaoExcelLancamentos
} {
  const {
    rawRows,
    mapping,
    anoSelecionado,
    mesInicial,
    mesFinal,
    mesesHabilitados,
    planoContas,
    memoriasFornecedores,
    mapeamentosAprendidos,
    lancamentosExistentes = [],
  } = options

  const minMes = Math.min(mesInicial, mesFinal)
  const maxMes = Math.max(mesInicial, mesFinal)

  // Cache de duplicatas existentes no banco para checagem rápida
  const existingSet = new Set<string>()
  for (const l of lancamentosExistentes) {
    const dStr = (l.data || '').slice(0, 10)
    const vStr = Math.abs(Number(l.valor) || 0).toFixed(2)
    const hStr = (l.historico || '').toLowerCase().trim()
    const pStr = l.plano_conta || ''
    // Chave única: data + valor + historico
    existingSet.add(`${dStr}|${vStr}|${hStr}`)
    if (pStr) {
      existingSet.add(`${dStr}|${vStr}|${hStr}|${pStr}`)
    }
  }

  const linhas: LancamentoExcelLinha[] = []

  let totalLidos = 0
  let totalNoPeriodo = 0
  let totalForaPeriodo = 0
  let totalValidos = 0
  let totalComProblema = 0
  let totalDuplicados = 0
  let totalReceitas = 0
  let totalDespesas = 0
  let valorTotalReceitas = 0
  let valorTotalDespesas = 0
  const mesesDetectados: { [mes: number]: { count: number; valor: number } } = {}

  // Função auxiliar de resolução de conta a partir de string (código ou nome de conta)
  const resolverContaContabil = (
    contaStr: string,
    historicoFallback?: string,
  ): {
    planoContaObj?: PlanoContaRecord
    matchConfidence: LancamentoExcelLinha['matchConfidence']
    codigoDetectado?: string
    nomeDetectado?: string
  } => {
    if (!contaStr && !historicoFallback) {
      return { matchConfidence: 'nao_encontrado' }
    }

    const normalizarCode = (s: string) => s.trim().replace(/\s+/g, '').toLowerCase()
    let planoContaObj: PlanoContaRecord | undefined
    let matchConfidence: LancamentoExcelLinha['matchConfidence'] = 'nao_encontrado'
    let codigoDetectado: string | undefined
    let nomeDetectado: string | undefined

    const trimmed = (contaStr || '').trim()

    // Se o valor de conta tem separador de código e nome (ex: "4.1.01 - Aluguel" ou "4.1.01 Aluguel")
    const matchCodENome = trimmed.match(/^([0-9A-Za-z.\-_/]+)\s*[-–—:]\s*(.+)$/)
    if (matchCodENome) {
      codigoDetectado = matchCodENome[1].trim()
      nomeDetectado = matchCodENome[2].trim()
    } else if (/^[0-9]+(?:\.[0-9]+)+$/.test(trimmed) || /^[A-Z0-9_-]{2,10}$/i.test(trimmed)) {
      codigoDetectado = trimmed
    } else {
      nomeDetectado = trimmed
    }

    // a) Vincular primeiro pelo CÓDIGO
    if (codigoDetectado) {
      const codeClean = normalizarCode(codigoDetectado)
      // Tenta 1: codigo_empresa exato
      planoContaObj = planoContas.find(
        (pc) => pc.codigo_empresa && normalizarCode(pc.codigo_empresa) === codeClean,
      )
      if (planoContaObj) {
        matchConfidence = 'codigo_empresa'
      } else {
        // Tenta 2: codigo estrutural da conta
        planoContaObj = planoContas.find(
          (pc) => pc.codigo && normalizarCode(pc.codigo) === codeClean,
        )
        if (planoContaObj) {
          matchConfidence = 'exato'
        }
      }
    }

    // b) Se o código não existir no plano, tentar pelo NOME da conta
    if (!planoContaObj && (nomeDetectado || trimmed)) {
      const nomeParaBusca = (nomeDetectado || trimmed).toLowerCase()
      // Match exato
      planoContaObj = planoContas.find((pc) => {
        const nConta = (pc.expand?.conta?.nome || '').trim().toLowerCase()
        const nDesc = (pc.descricao || '').trim().toLowerCase()
        return (nConta && nConta === nomeParaBusca) || (nDesc && nDesc === nomeParaBusca)
      })
      if (planoContaObj) {
        matchConfidence = 'exato'
      } else {
        // Match parcial/similar
        planoContaObj = planoContas.find((pc) => {
          const nConta = (pc.expand?.conta?.nome || '').trim().toLowerCase()
          const nDesc = (pc.descricao || '').trim().toLowerCase()
          return (
            (nConta && (nConta.includes(nomeParaBusca) || nomeParaBusca.includes(nConta))) ||
            (nDesc && (nDesc.includes(nomeParaBusca) || nomeParaBusca.includes(nDesc)))
          )
        })
        if (planoContaObj) {
          matchConfidence = 'similar'
        }
      }
    }

    // c) Vínculo inteligente existente (motor heurístico com aprendizado)
    if (!planoContaObj) {
      const termoBusca = nomeDetectado || trimmed || historicoFallback || ''
      const matchRes = findBestPlanoContaMatch(
        termoBusca,
        planoContas,
        codigoDetectado || trimmed,
        mapeamentosAprendidos,
      )

      if (matchRes.match) {
        planoContaObj = matchRes.match
        if (matchRes.type === 'aprendido') {
          matchConfidence = 'memoria'
        } else if (matchRes.type === 'codigo_empresa') {
          matchConfidence = 'codigo_empresa'
        } else if (matchRes.type === 'exact') {
          matchConfidence = 'exato'
        } else if (matchRes.type === 'contains' || matchRes.type === 'code') {
          matchConfidence = 'similar'
        }
      }
    }

    // d) Memória de fornecedores
    if (!planoContaObj && memoriasFornecedores && memoriasFornecedores.length > 0) {
      const textoParaMem = (trimmed || historicoFallback || '').toLowerCase()
      const mem = memoriasFornecedores.find((m) => {
        const termo = (m.termo_busca || m.fornecedor_padrao || '').toLowerCase().trim()
        return termo && (textoParaMem.includes(termo) || termo.includes(textoParaMem))
      })

      if (mem && mem.plano_conta) {
        const pc = planoContas.find((p) => p.id === mem.plano_conta)
        if (pc) {
          planoContaObj = pc
          matchConfidence = 'memoria'
        }
      }
    }

    return {
      planoContaObj,
      matchConfidence,
      codigoDetectado,
      nomeDetectado: nomeDetectado || trimmed,
    }
  }

  // Identifica se estamos processando no formato MATRIZ MENSAL
  const isFormatoMatriz =
    mapping.formato === 'matriz_mensal' ||
    (mapping.colunasMesesMatriz && Object.keys(mapping.colunasMesesMatriz).length > 0)

  if (isFormatoMatriz) {
    // =========================================================================
    // FLUXO MATRIZ MENSAL:
    // Cada linha da planilha = Uma conta de despesa
    // Colunas B a M = Meses do ano com último dia (31/01, 28/02... + ano escolhido)
    // Desdobra cada linha em até 12 lançamentos (apenas meses com valor preenchido)
    // =========================================================================
    const colunasMeses = mapping.colunasMesesMatriz || {}
    const colConta = mapping.colunaContaMatriz || mapping.codigoConta || mapping.nomeConta || ''

    rawRows.forEach((row, idx) => {
      totalLidos++
      const linhaPlanilha = idx + 2 // Linha 1 = Cabeçalho

      const contaBruta = colConta ? sanitizarValorCelula(row[colConta]) : ''
      // Se a linha inteira estiver vazia na coluna de conta, ignora linha em branco
      if (!contaBruta) return

      const { planoContaObj, matchConfidence, codigoDetectado, nomeDetectado } =
        resolverContaContabil(contaBruta)

      // Percorre os 12 meses
      for (let mes = 1; mes <= 12; mes++) {
        const nomeColunaMes = colunasMeses[mes]
        if (!nomeColunaMes) continue

        const rawValor = row[nomeColunaMes]
        if (rawValor === undefined || rawValor === null || rawValor === '') continue

        let valorNum = 0
        if (typeof rawValor === 'number') {
          valorNum = Math.abs(rawValor)
        } else if (typeof rawValor === 'string') {
          const s = rawValor.trim()
          // Células com "—", "-", "0", vazias etc. são ignoradas
          if (
            !s ||
            s === '—' ||
            s === '-' ||
            s === '–' ||
            s === '0,00' ||
            s === '0.00' ||
            s === '0'
          ) {
            continue
          }
          valorNum = Math.abs(parseBrlNumber(s))
        }

        if (valorNum <= 0) continue

        // Data do lançamento: Último dia do mês do ano selecionado (ex: 31/01/2027)
        const ultimoDia = getUltimoDiaDoMes(anoSelecionado, mes)
        const diaPad = String(ultimoDia).padStart(2, '0')
        const mesPad = String(mes).padStart(2, '0')
        const dataIso = `${anoSelecionado}-${mesPad}-${diaPad}`
        const dataStr = `${diaPad}/${mesPad}/${anoSelecionado}`

        // Histórico descritivo
        const nomeFinalConta =
          planoContaObj?.expand?.conta?.nome ||
          planoContaObj?.descricao ||
          nomeDetectado ||
          contaBruta
        const historicoLanc = `${nomeFinalConta} - ${NOMES_MESES_EXTENSO[mes - 1]}/${anoSelecionado}`

        // Validação e Status
        const errosOuAlertas: string[] = []
        let status: LancamentoExcelLinha['status'] = 'valido'

        const estaNoPeriodo = mesesHabilitados
          ? mesesHabilitados.has(mes)
          : mes >= minMes && mes <= maxMes

        if (!estaNoPeriodo) {
          errosOuAlertas.push(
            `Mês de ${NOMES_MESES_EXTENSO[mes - 1]} (${mes}) fora do período (${minMes} a ${maxMes})`,
          )
          status = 'fora_periodo'
        }

        if (!planoContaObj) {
          errosOuAlertas.push('Conta contábil não localizada no Plano de Contas')
          if (status === 'valido') status = 'alerta'
        }

        // Checagem de duplicidade
        let isDuplicadoExistente = false
        if (status !== 'fora_periodo') {
          const chaveSimples = `${dataIso}|${valorNum.toFixed(2)}|${historicoLanc.toLowerCase().trim()}`
          if (existingSet.has(chaveSimples)) {
            isDuplicadoExistente = true
            errosOuAlertas.push('Lançamento com mesma data, valor e histórico já existe no sistema')
            status = 'duplicado'
          }
        }

        // Atualiza contadores
        if (status === 'fora_periodo') {
          totalForaPeriodo++
        } else {
          totalNoPeriodo++

          if (!mesesDetectados[mes]) {
            mesesDetectados[mes] = { count: 0, valor: 0 }
          }
          mesesDetectados[mes].count++
          mesesDetectados[mes].valor += valorNum

          // Matriz de despesas é padrão Despesa
          totalDespesas++
          valorTotalDespesas += valorNum

          if (status === 'valido') {
            totalValidos++
          } else if (status === 'alerta') {
            totalComProblema++
          } else if (status === 'duplicado') {
            totalDuplicados++
          }
        }

        const selecionadoPadrao = status === 'valido' || status === 'alerta'

        linhas.push({
          id: `linha_${idx}_m${mes}_${Math.random().toString(36).substring(2, 7)}`,
          linhaPlanilha,
          dataStr,
          dataIso,
          ano: anoSelecionado,
          mes,
          historico: historicoLanc,
          valor: valorNum,
          tipo: 'Despesa',
          codigoContaPlanilha: codigoDetectado,
          nomeContaPlanilha: nomeDetectado || contaBruta,
          planoContaId: planoContaObj?.id,
          planoContaCodigo: planoContaObj?.codigo,
          planoContaNome: planoContaObj?.expand?.conta?.nome || planoContaObj?.descricao,
          planoContaTipo: planoContaObj?.expand?.conta?.tipo || 'Despesa',
          planoContaObj,
          matchConfidence,
          status,
          errosOuAlertas,
          selecionado: selecionadoPadrao,
          isDuplicadoExistente,
        })
      }
    })
  } else {
    // =========================================================================
    // FLUXO ANTERIOR (COLUNAR / UMA LINHA POR LANÇAMENTO)
    // =========================================================================
    rawRows.forEach((row, idx) => {
      totalLidos++
      const linhaPlanilha = idx + 2 // Linha 1 é cabeçalho

      // 1. Data
      const rawData = mapping.data ? row[mapping.data] : ''
      const dataParsed = normalizarDataExcel(rawData)

      // 2. Valor
      const rawValor = mapping.valor ? row[mapping.valor] : ''
      let valorNum = 0
      let valorNegativoDetectado = false

      if (typeof rawValor === 'number') {
        valorNegativoDetectado = rawValor < 0
        valorNum = Math.abs(rawValor)
      } else if (typeof rawValor === 'string' && rawValor.trim()) {
        valorNegativoDetectado = rawValor.includes('-') || /^\(.*\)$/.test(rawValor.trim())
        valorNum = Math.abs(parseBrlNumber(rawValor))
      }

      // 3. Histórico / Descrição
      const rawHist = mapping.historico ? sanitizarValorCelula(row[mapping.historico]) : ''

      // 4. Tipo (Receita / Despesa)
      let tipoFinal: 'Receita' | 'Despesa' = 'Despesa'
      const rawTipo = mapping.tipo ? sanitizarValorCelula(row[mapping.tipo]).toLowerCase() : ''

      if (rawTipo) {
        if (
          rawTipo.includes('rec') ||
          rawTipo.includes('ent') ||
          rawTipo.includes('cred') ||
          rawTipo === 'c' ||
          rawTipo === 'r'
        ) {
          tipoFinal = 'Receita'
        } else if (
          rawTipo.includes('desp') ||
          rawTipo.includes('sai') ||
          rawTipo.includes('deb') ||
          rawTipo === 'd'
        ) {
          tipoFinal = 'Despesa'
        }
      } else if (valorNegativoDetectado) {
        // Se valor na planilha era negativo, geralmente indica saída / despesa
        tipoFinal = 'Despesa'
      } else {
        // Tenta inferir pelo histórico
        const histLower = rawHist.toLowerCase()
        if (
          histLower.includes('venda') ||
          histLower.includes('faturamento') ||
          histLower.includes('receita') ||
          histLower.includes('recebimento') ||
          histLower.includes('servico prestado')
        ) {
          tipoFinal = 'Receita'
        }
      }

      // Campos adicionais
      const rawCodConta = mapping.codigoConta ? sanitizarValorCelula(row[mapping.codigoConta]) : ''
      const codigoContaPlanilha = rawCodConta || undefined

      const rawNomeConta = mapping.nomeConta ? sanitizarValorCelula(row[mapping.nomeConta]) : ''
      const nomeContaPlanilha = rawNomeConta || undefined

      const rawCentro = mapping.centroCusto ? sanitizarValorCelula(row[mapping.centroCusto]) : ''
      const centroCustoPlanilha = rawCentro || undefined

      const rawDoc = mapping.documento ? sanitizarValorCelula(row[mapping.documento]) : ''
      const documentoPlanilha = rawDoc || undefined

      const rawForma = mapping.formaPagamento
        ? sanitizarValorCelula(row[mapping.formaPagamento])
        : ''
      const formaPagamentoPlanilha = rawForma || undefined

      // 5. Match inteligente com Plano de Contas usando a função unificada
      const contaParaResolver = codigoContaPlanilha || nomeContaPlanilha || ''
      const { planoContaObj, matchConfidence } = resolverContaContabil(contaParaResolver, rawHist)

      // Se o plano encontrado tem tipo e ainda não determinamos claramente o tipo
      if (planoContaObj?.expand?.conta?.tipo) {
        const tipoConta = planoContaObj.expand.conta.tipo
        if (tipoConta === 'Receita') tipoFinal = 'Receita'
        if (tipoConta === 'Despesa') tipoFinal = 'Despesa'
      }

      // 6. Validação e Status
      const errosOuAlertas: string[] = []
      let status: LancamentoExcelLinha['status'] = 'valido'

      if (!dataParsed) {
        errosOuAlertas.push('Data inválida ou não informada')
        status = 'erro'
      } else if (dataParsed.ano !== anoSelecionado) {
        errosOuAlertas.push(`Ano ${dataParsed.ano} difere do ano selecionado (${anoSelecionado})`)
        status = 'fora_periodo'
      } else {
        const estaNoPeriodo = mesesHabilitados
          ? mesesHabilitados.has(dataParsed.mes)
          : dataParsed.mes >= minMes && dataParsed.mes <= maxMes

        if (!estaNoPeriodo) {
          errosOuAlertas.push(
            `Mês de ${NOMES_MESES_EXTENSO[dataParsed.mes - 1]} (${dataParsed.mes}) fora do período (${minMes} a ${maxMes})`,
          )
          status = 'fora_periodo'
        }
      }

      if (valorNum <= 0) {
        errosOuAlertas.push('Valor zerado ou não identificado')
        if (status !== 'fora_periodo') status = 'erro'
      }

      if (!planoContaObj) {
        errosOuAlertas.push('Conta contábil não localizada no Plano de Contas')
        if (status === 'valido') status = 'alerta'
      }

      // Checagem de duplicidade
      let isDuplicadoExistente = false
      if (dataParsed && valorNum > 0 && status !== 'erro' && status !== 'fora_periodo') {
        const chaveSimples = `${dataParsed.iso}|${valorNum.toFixed(2)}|${rawHist.toLowerCase().trim()}`
        if (existingSet.has(chaveSimples)) {
          isDuplicadoExistente = true
          errosOuAlertas.push('Lançamento com mesma data, valor e histórico já existe no sistema')
          status = 'duplicado'
        }
      }

      // Atualiza contadores
      if (status === 'fora_periodo') {
        totalForaPeriodo++
      } else {
        totalNoPeriodo++

        if (dataParsed) {
          if (!mesesDetectados[dataParsed.mes]) {
            mesesDetectados[dataParsed.mes] = { count: 0, valor: 0 }
          }
          mesesDetectados[dataParsed.mes].count++
          mesesDetectados[dataParsed.mes].valor += valorNum
        }

        if (tipoFinal === 'Receita') {
          totalReceitas++
          valorTotalReceitas += valorNum
        } else {
          totalDespesas++
          valorTotalDespesas += valorNum
        }

        if (status === 'valido') {
          totalValidos++
        } else if (status === 'alerta' || status === 'erro') {
          totalComProblema++
        } else if (status === 'duplicado') {
          totalDuplicados++
        }
      }

      // Linhas válidas ou com alerta são marcadas para importação por padrão; erros e duplicados começam desmarcados
      const selecionadoPadrao = status === 'valido' || status === 'alerta'

      linhas.push({
        id: `linha_${idx}_${Math.random().toString(36).substring(2, 7)}`,
        linhaPlanilha,
        dataStr: dataParsed?.display || String(rawData || 'Data inválida'),
        dataIso: dataParsed?.iso || '',
        ano: dataParsed?.ano || 0,
        mes: dataParsed?.mes || 0,
        historico: rawHist || `Lançamento linha ${linhaPlanilha}`,
        valor: valorNum,
        tipo: tipoFinal,
        codigoContaPlanilha,
        nomeContaPlanilha,
        centroCustoPlanilha,
        documentoPlanilha,
        formaPagamentoPlanilha,
        planoContaId: planoContaObj?.id,
        planoContaCodigo: planoContaObj?.codigo,
        planoContaNome: planoContaObj?.expand?.conta?.nome || planoContaObj?.descricao,
        planoContaTipo: planoContaObj?.expand?.conta?.tipo,
        planoContaObj,
        matchConfidence,
        status,
        errosOuAlertas,
        selecionado: selecionadoPadrao,
        isDuplicadoExistente,
      })
    })
  }

  return {
    linhas,
    resumo: {
      totalLidos,
      totalNoPeriodo,
      totalForaPeriodo,
      totalValidos,
      totalComProblema,
      totalDuplicados,
      totalReceitas,
      totalDespesas,
      valorTotalReceitas,
      valorTotalDespesas,
      mesesDetectados,
    },
  }
}

export interface OpcoesModeloExcelLancamentos {
  planoContas?: PlanoContaRecord[]
  nomeEmpresa?: string
  ano?: number
  tipoModelo?: 'matriz_mensal' | 'colunas'
}

/**
 * Cria modelo Excel no formato MATRIZ MENSAL PADRÃO:
 * Coluna A = Conta das despesas
 * Coluna B = 31/01/ANO
 * Coluna C = 28/02/ANO (ou 29/02 se bissexto)
 * Coluna D = 31/03/ANO
 * Coluna E = 30/04/ANO
 * Coluna F = 31/05/ANO
 * Coluna G = 30/06/ANO
 * Coluna H = 31/07/ANO
 * Coluna I = 31/08/ANO
 * Coluna J = 30/09/ANO
 * Coluna K = 31/10/ANO
 * Coluna L = 30/11/ANO
 * Coluna M = 31/12/ANO
 */
export function gerarPlanilhaModeloMatrizMensalExcel(opcoes?: OpcoesModeloExcelLancamentos): void {
  const anoBase = opcoes?.ano || new Date().getFullYear()
  const plano = opcoes?.planoContas || []

  // Filtra contas de despesas da empresa ativa
  const contasDespesas = plano.filter((pc) => {
    const isDespesa =
      pc.expand?.conta?.tipo === 'Despesa' ||
      pc.natureza === 'Despesa' ||
      (pc.codigo && pc.codigo.startsWith('4')) ||
      (pc.descricao || '').toLowerCase().includes('despes')
    const isTotalizadora =
      pc.totalizadora === true || pc.tipo_conta === 'sintetica' || pc.natureza === 'totalizadora'
    return isDespesa && !isTotalizadora
  })

  // Lista de contas para exemplificar a matriz
  const listaContas =
    contasDespesas.length > 0
      ? contasDespesas.slice(0, 8).map((c) => {
          const cod = c.codigo_empresa || c.codigo || ''
          const nome = c.expand?.conta?.nome || c.descricao || 'Despesa Operacional'
          return cod ? `${cod} - ${nome}` : nome
        })
      : [
          '4.1.01 - Salários e Ordenados',
          '4.1.02 - Aluguéis e Condomínio',
          '4.1.03 - Energia Elétrica e Água',
          '4.1.04 - Internet, Telefonia e Software',
          '4.1.05 - Material de Escritório e Limpeza',
          '4.1.06 - Honorários Contábeis e Advocatícios',
          '4.1.07 - Manutenção e Conservação',
          '4.1.08 - Tarifas Bancárias e Meios de Pagamento',
        ]

  // Monta os nomes exatos das 12 colunas de meses para o ano escolhido
  const rotulosMeses = getRotulosColunasMatrizMensal(anoBase)

  const rows = listaContas.map((conta, idx) => {
    const rowObj: Record<string, unknown> = {
      'Conta das despesas': conta,
    }
    // Valores de exemplo variados para os meses
    const baseVal = 1200 + idx * 450
    for (let mes = 1; mes <= 12; mes++) {
      const colHeader = rotulosMeses[mes]
      // Simula alguns meses vazios para demonstrar
      if (idx === 2 && mes > 6) {
        rowObj[colHeader] = ''
      } else {
        const valMes = baseVal + ((mes * 37) % 250)
        rowObj[colHeader] = Number(valMes.toFixed(2))
      }
    }
    return rowObj
  })

  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = [
    { wch: 44 }, // Coluna A: Conta das despesas
    { wch: 14 }, // Coluna B: 31/01
    { wch: 14 }, // Coluna C: 28/02
    { wch: 14 }, // Coluna D: 31/03
    { wch: 14 }, // Coluna E: 30/04
    { wch: 14 }, // Coluna F: 31/05
    { wch: 14 }, // Coluna G: 30/06
    { wch: 14 }, // Coluna H: 31/07
    { wch: 14 }, // Coluna I: 31/08
    { wch: 14 }, // Coluna J: 30/09
    { wch: 14 }, // Coluna K: 31/10
    { wch: 14 }, // Coluna L: 30/11
    { wch: 14 }, // Coluna M: 31/12
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, `Matriz_Despesas_${anoBase}`)

  // Aba 2: Instruções da Matriz
  const instrucoes = [
    {
      INSTRUÇÃO: `1. Coluna A ("Conta das despesas"): preencha com o código e/ou nome da conta contábil cadastrada na empresa.`,
    },
    {
      INSTRUÇÃO: `2. Colunas B a M (de ${rotulosMeses[1]} a ${rotulosMeses[12]}): preencha com o valor monetário de cada mês para aquela conta.`,
    },
    {
      INSTRUÇÃO: `3. Células sem lançamento no mês podem ficar em branco (vazias) ou com "—". Elas serão ignoradas no processamento.`,
    },
    {
      INSTRUÇÃO: `4. Cada célula preenchida gera um lançamento contábil de Despesa com data no último dia do mês do ano ${anoBase}.`,
    },
    {
      INSTRUÇÃO: `5. O sistema faz a correspondência automática da conta pelo código primeiro e depois pelo nome.`,
    },
  ]
  const wsInstrucoes = XLSX.utils.json_to_sheet(instrucoes)
  wsInstrucoes['!cols'] = [{ wch: 120 }]
  XLSX.utils.book_append_sheet(wb, wsInstrucoes, 'Instruções')

  // Aba 3: Contas da empresa disponíveis
  if (contasDespesas.length > 0) {
    const contasRef = contasDespesas.map((c) => ({
      'Código da Conta': c.codigo_empresa || c.codigo || '',
      'Nome da Conta': c.expand?.conta?.nome || c.descricao || '',
      'Código Estrutural': c.codigo || '',
    }))
    const wsRef = XLSX.utils.json_to_sheet(contasRef)
    wsRef['!cols'] = [{ wch: 20 }, { wch: 46 }, { wch: 20 }]
    XLSX.utils.book_append_sheet(wb, wsRef, 'Contas_Despesas_Ativas')
  }

  const nomeArquivo = opcoes?.nomeEmpresa
    ? `modelo_matriz_despesas_${opcoes.nomeEmpresa.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${anoBase}.xlsx`
    : `modelo_matriz_despesas_${anoBase}.xlsx`

  XLSX.writeFile(wb, nomeArquivo)
}

/**
 * Cria modelo Excel com as 4 colunas essenciais pedidas (formato colunar tradicional):
 * 1. "Data do Lançamento" (DD/MM/AAAA)
 * 2. "Código da Conta" (código conforme Plano de Contas da empresa ativa)
 * 3. "Nome da Conta" (nome cadastrado no Plano de Contas)
 * 4. "Valor" (numérico monetário)
 * Seguidas das colunas auxiliares (Histórico, Tipo, Centro de Custo, Documento, Forma de Pagamento)
 * e uma aba dedicada de Instruções e Referência de Contas da empresa.
 */
export function gerarPlanilhaModeloExcel(opcoes?: OpcoesModeloExcelLancamentos): void {
  // Se o tipo pedido for explicitamente matriz mensal, redireciona
  if (opcoes?.tipoModelo === 'matriz_mensal') {
    return gerarPlanilhaModeloMatrizMensalExcel(opcoes)
  }
  const anoBase = opcoes?.ano || new Date().getFullYear()
  const plano = opcoes?.planoContas || []

  // Filtra contas de lançamento (analíticas / não totalizadoras) da empresa ativa
  const contasLancamento = plano.filter((pc) => {
    const cod = pc.codigo_empresa || pc.codigo || ''
    const isTotalizadora =
      pc.totalizadora === true ||
      pc.tipo_conta === 'sintetica' ||
      pc.natureza === 'totalizadora' ||
      Boolean(pc.expand?.conta?.sintetica) ||
      (cod.length <= 3 && !cod.includes('.'))
    return !isTotalizadora
  })

  // Seleciona até 4 contas de exemplo reais (ou fallback caso plano vazio)
  interface ContaExemplo {
    codigo: string
    nome: string
    tipo: 'Receita' | 'Despesa'
    historicoPadrao: string
    valorPadrao: number
    centroPadrao: string
  }

  const exemplos: ContaExemplo[] = []

  if (contasLancamento.length > 0) {
    for (const c of contasLancamento) {
      if (exemplos.length >= 4) break
      const nomeConta = c.expand?.conta?.nome || c.descricao || 'Conta Contábil'
      const codigoConta = c.codigo_empresa || c.codigo || '1.01'
      const tipoConta = (c.expand?.conta?.tipo as 'Receita' | 'Despesa') || 'Despesa'
      exemplos.push({
        codigo: codigoConta,
        nome: nomeConta,
        tipo: tipoConta,
        historicoPadrao:
          tipoConta === 'Receita' ? `Recebimento ref. ${nomeConta}` : `Pagamento ref. ${nomeConta}`,
        valorPadrao: tipoConta === 'Receita' ? 12500.0 : 3450.0,
        centroPadrao: tipoConta === 'Receita' ? 'Comercial' : 'Administrativo',
      })
    }
  }

  // Fallbacks caso não haja contas suficientes cadastradas
  if (exemplos.length === 0) {
    exemplos.push(
      {
        codigo: '3.1.01',
        nome: 'Receita de Prestação de Serviços',
        tipo: 'Receita',
        historicoPadrao: 'Recebimento de Prestação de Serviços de Consultoria',
        valorPadrao: 12500.0,
        centroPadrao: 'Consultoria',
      },
      {
        codigo: '4.1.02',
        nome: 'Aluguéis e Condomínio',
        tipo: 'Despesa',
        historicoPadrao: 'Pagamento de Aluguel Escritório Central',
        valorPadrao: 3200.0,
        centroPadrao: 'Administrativo',
      },
      {
        codigo: '4.1.01',
        nome: 'Salários e Ordenados',
        tipo: 'Despesa',
        historicoPadrao: 'Folha de Pagamento Salários Mensais',
        valorPadrao: 18450.0,
        centroPadrao: 'Geral',
      },
      {
        codigo: '3.1.02',
        nome: 'Receita Bruta de Vendas',
        tipo: 'Receita',
        historicoPadrao: 'Venda de Produtos Linha Premium',
        valorPadrao: 28900.0,
        centroPadrao: 'Comercial',
      },
    )
  }

  const datasExemplo = [
    `15/01/${anoBase}`,
    `20/01/${anoBase}`,
    `05/02/${anoBase}`,
    `10/02/${anoBase}`,
  ]

  // Monta linhas do modelo mantendo a ordem estrita pedida:
  // 1: Data do Lançamento | 2: Código da Conta | 3: Nome da Conta | 4: Valor
  // seguidos das colunas auxiliares
  const data = exemplos.map((ex, idx) => ({
    'Data do Lançamento': datasExemplo[idx % datasExemplo.length],
    'Código da Conta': ex.codigo,
    'Nome da Conta': ex.nome,
    Valor: ex.valorPadrao,
    Histórico: ex.historicoPadrao,
    Tipo: ex.tipo,
    'Centro de Custo': ex.centroPadrao,
    Documento: `DOC-00${idx + 1}`,
    'Forma de Pagamento': idx % 2 === 0 ? 'PIX' : 'Boleto Bancário',
  }))

  const ws = XLSX.utils.json_to_sheet(data)
  // Largura amigável das colunas
  ws['!cols'] = [
    { wch: 18 }, // Data do Lançamento
    { wch: 18 }, // Código da Conta
    { wch: 38 }, // Nome da Conta
    { wch: 14 }, // Valor
    { wch: 46 }, // Histórico
    { wch: 12 }, // Tipo
    { wch: 20 }, // Centro de Custo
    { wch: 15 }, // Documento
    { wch: 22 }, // Forma de Pagamento
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Modelo_Lancamentos')

  // Aba 2: Instruções e referência do Plano de Contas
  const instrucoes = [
    {
      INSTRUÇÃO:
        '1. As 4 primeiras colunas são ESSENCIAIS: Data do Lançamento, Código da Conta, Nome da Conta e Valor.',
    },
    {
      INSTRUÇÃO:
        '2. O "Código da Conta" deve ser exatamente o mesmo cadastrado no Plano de Contas da empresa ativa no sistema.',
    },
    {
      INSTRUÇÃO:
        '3. Ao importar, o sistema busca primeiro pelo Código da Conta; se não encontrar, tenta pelo Nome da Conta.',
    },
    {
      INSTRUÇÃO:
        '4. A Data do Lançamento deve estar no formato DD/MM/AAAA e pertencer ao Ano e Período selecionados na tela de importação.',
    },
    { INSTRUÇÃO: '5. O Valor deve ser numérico (ex: 1500,00 ou 1500.00).' },
    {
      INSTRUÇÃO:
        '6. As colunas Histórico, Tipo, Centro de Custo, Documento e Forma de Pagamento são opcionais.',
    },
  ]
  const wsInstrucoes = XLSX.utils.json_to_sheet(instrucoes)
  wsInstrucoes['!cols'] = [{ wch: 110 }]
  XLSX.utils.book_append_sheet(wb, wsInstrucoes, 'Instruções')

  // Se houver plano de contas da empresa, adiciona aba de referência rápida com as contas ativas
  if (contasLancamento.length > 0) {
    const contasRef = contasLancamento.map((c) => ({
      'Código da Conta': c.codigo_empresa || c.codigo || '',
      'Nome da Conta': c.expand?.conta?.nome || c.descricao || '',
      Tipo: c.expand?.conta?.tipo || c.natureza || '',
      'Código Estrutural': c.codigo || '',
    }))
    const wsRef = XLSX.utils.json_to_sheet(contasRef)
    wsRef['!cols'] = [{ wch: 18 }, { wch: 40 }, { wch: 14 }, { wch: 18 }]
    XLSX.utils.book_append_sheet(wb, wsRef, 'Contas_Disponiveis')
  }

  const nomeArquivo = opcoes?.nomeEmpresa
    ? `modelo_lancamentos_${opcoes.nomeEmpresa.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${anoBase}.xlsx`
    : `modelo_lancamentos_excel_${anoBase}.xlsx`

  XLSX.writeFile(wb, nomeArquivo)
}
