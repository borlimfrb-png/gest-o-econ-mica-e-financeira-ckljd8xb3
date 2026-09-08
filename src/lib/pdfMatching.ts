import type {
  PlanoContaRecord,
  ContaRecord,
  CentroRecord,
  TipoDespesaRecord,
} from '@/types/finance'
import { normalizeText, type ExtractedAccountValueCandidate } from './pdfParser'

export interface MatchedItem {
  id: string // ID do candidato ou gerado
  rawAccountName: string
  pageNumber: number
  originalLine: string
  valor: number // Editável pelo usuário (inicia com extractedValue)
  planoConta?: PlanoContaRecord
  planoContaId?: string
  conta?: ContaRecord
  centro?: CentroRecord
  tipoDespesa?: TipoDespesaRecord
  matchedBy?: 'aprendido' | 'codigo_empresa' | 'code' | 'exact' | 'contains' | 'manual'
  isMatched: boolean
  matchedCodigoEmpresa?: string // Código da empresa que originou o match (para aprendizagem)
}

/**
 * Retorna o rótulo descritivo formatado do Plano de Contas:
 * Ex: PC-001 [Emp: 1.1.2.001] | CO-003 Caixa Geral → CC-002 Operações [→ TD-001 Fixa]
 */
export function formatPlanoContaDisplay(plano: PlanoContaRecord): string {
  const codPC = plano.codigo || 'PC-???'
  const codEmpresa = plano.codigo_empresa ? ` [Emp: ${plano.codigo_empresa}]` : ''
  const conta = plano.expand?.conta
  const centro = plano.expand?.centro
  const tipo = plano.expand?.tipo_despesa

  const codConta = conta?.codigo || 'CO-???'
  const nomeConta = conta?.nome || 'Conta'
  const codCentro = centro?.codigo || 'CC-???'
  const nomeCentro = centro?.nome || 'Centro'

  let text = `${codPC}${codEmpresa} | ${codConta} ${nomeConta} → ${codCentro} ${nomeCentro}`
  if (tipo && tipo.nome) {
    const codTipo = tipo.codigo || 'TD-???'
    text += ` → ${codTipo} ${tipo.nome}`
  }
  return text
}

/**
 * Normaliza códigos contábeis para comparação permissiva
 * (remove pontos, traços, barras, espaços e zeros à esquerda de blocos ou geral)
 */
function normalizeCode(code: string): string {
  if (!code) return ''
  return code.toLowerCase().replace(/[^a-z0-9]/g, '')
}

/**
 * Busca por similaridade nos planos de contas existentes.
 * 0. PRIORIDADE MÁXIMA: Match por "Código da Conta da Empresa" (codigo_empresa)
 * 1. Match por código da conta do sistema (ex: CO-001 ou PC-001)
 * 2. Match exato de nome da conta ou centro
 * 3. Match por inclusão (contains case-insensitive & sem acentos)
 */
export interface LearnedMappingRef {
  codigo_empresa: string
  plano_conta: string
}

/**
 * Busca por similaridade nos planos de contas existentes.
 * -1. PRIORIDADE MÁXIMA ABSOLUTA: Mapeamento aprendido (vínculo confirmado previamente gravado)
 * 0. PRIORIDADE: Código da Conta da Empresa (codigo_empresa)
 * 1. Match exato de nome da conta ou centro
 * 2. Match por código interno (CO-xxx, PC-xxx) ou por inclusão/similaridade
 */
export function findBestPlanoContaMatch(
  rawName: string,
  planoList: PlanoContaRecord[],
  originalLine?: string,
  aprendidos?: LearnedMappingRef[],
): {
  match?: PlanoContaRecord
  type?: 'aprendido' | 'codigo_empresa' | 'code' | 'exact' | 'contains'
  matchedCodigoEmpresa?: string
} {
  const normRaw = normalizeText(rawName)
  const normLine = normalizeText(originalLine || '')
  const combinedText = `${normRaw} ${normLine}`.trim()
  const cleanCombined = normalizeCode(combinedText)

  if (!normRaw || normRaw.length < 2) return {}

  // -1. PRIORIDADE MÁXIMA: Mapeamentos Aprendidos previamente confirmados pelo usuário
  if (aprendidos && aprendidos.length > 0) {
    for (const apr of aprendidos) {
      const codApr = apr.codigo_empresa?.trim()
      if (!codApr || codApr.length < 2) continue

      const normCodApr = normalizeText(codApr)
      const cleanCodApr = normalizeCode(codApr)
      const escaped = normCodApr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const regexBoundary = new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i')

      if (
        regexBoundary.test(normRaw) ||
        (originalLine && regexBoundary.test(normLine)) ||
        (cleanCodApr.length >= 3 && cleanCombined.includes(cleanCodApr))
      ) {
        // Encontrar no planoList (garante que conta não foi excluída/inativa)
        const pcTarget = planoList.find((p) => p.id === apr.plano_conta)
        if (pcTarget) {
          return {
            match: pcTarget,
            type: 'aprendido',
            matchedCodigoEmpresa: codApr,
          }
        }
      }
    }
  }

  // 0. PRIORIDADE: Código da Conta da Empresa (codigo_empresa)
  for (const pc of planoList) {
    const codEmp = pc.codigo_empresa?.trim()
    if (!codEmp || codEmp.length < 2) continue

    const normCodEmp = normalizeText(codEmp)
    const cleanCodEmp = normalizeCode(codEmp)

    const escaped = normCodEmp.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regexBoundary = new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i')

    if (
      regexBoundary.test(normRaw) ||
      (originalLine && regexBoundary.test(normLine)) ||
      (cleanCodEmp.length >= 3 && cleanCombined.includes(cleanCodEmp))
    ) {
      return { match: pc, type: 'codigo_empresa', matchedCodigoEmpresa: codEmp }
    }
  }

  // 1. Exact match no nome da conta ou do centro
  for (const pc of planoList) {
    const nomeConta = normalizeText(pc.expand?.conta?.nome || '')
    const nomeCentro = normalizeText(pc.expand?.centro?.nome || '')
    if (nomeConta === normRaw || nomeCentro === normRaw) {
      return { match: pc, type: 'exact' }
    }
  }

  // 2. Match por código interno (CO-xxx, PC-xxx) ou contains
  let bestMatch: PlanoContaRecord | undefined
  let longestMatchLen = 0

  for (const pc of planoList) {
    const nomeConta = normalizeText(pc.expand?.conta?.nome || '')
    const nomeCentro = normalizeText(pc.expand?.centro?.nome || '')
    const codConta = normalizeText(pc.expand?.conta?.codigo || '')
    const codPC = normalizeText(pc.codigo || '')

    // Checa código interno da conta (ex: CO-001) ou do plano (ex: PC-001)
    if (codConta && (normRaw.includes(codConta) || (normLine && normLine.includes(codConta)))) {
      return { match: pc, type: 'code' }
    }
    if (codPC && (normRaw.includes(codPC) || (normLine && normLine.includes(codPC)))) {
      return { match: pc, type: 'code' }
    }

    // Match por palavras relevantes da conta
    if (nomeConta.length >= 3) {
      if (normRaw.includes(nomeConta) || nomeConta.includes(normRaw)) {
        if (nomeConta.length > longestMatchLen) {
          bestMatch = pc
          longestMatchLen = nomeConta.length
        }
      }
    }

    // Match por centro
    if (nomeCentro.length >= 3) {
      if (normRaw.includes(nomeCentro) || nomeCentro.includes(normRaw)) {
        if (nomeCentro.length > longestMatchLen) {
          bestMatch = pc
          longestMatchLen = nomeCentro.length
        }
      }
    }
  }

  if (bestMatch) {
    return { match: bestMatch, type: 'contains' }
  }

  return {}
}

/**
 * Processa a lista de candidatos extraídos do PDF e faz o matching com o Plano de Contas fornecido.
 */
export function matchPdfCandidatesWithPlanoContas(
  candidates: ExtractedAccountValueCandidate[],
  planoList: PlanoContaRecord[],
  aprendidos?: LearnedMappingRef[],
): MatchedItem[] {
  return candidates.map((cand) => {
    const { match, type, matchedCodigoEmpresa } = findBestPlanoContaMatch(
      cand.rawAccountName,
      planoList,
      cand.originalLine,
      aprendidos,
    )

    if (match) {
      return {
        id: cand.id,
        rawAccountName: cand.rawAccountName,
        pageNumber: cand.pageNumber,
        originalLine: cand.originalLine,
        valor: cand.extractedValue,
        planoConta: match,
        planoContaId: match.id,
        conta: match.expand?.conta,
        centro: match.expand?.centro,
        tipoDespesa: match.expand?.tipo_despesa,
        matchedBy: type,
        matchedCodigoEmpresa,
        isMatched: true,
      }
    }

    return {
      id: cand.id,
      rawAccountName: cand.rawAccountName,
      pageNumber: cand.pageNumber,
      originalLine: cand.originalLine,
      valor: cand.extractedValue,
      isMatched: false,
    }
  })
}
