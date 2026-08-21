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
  matchedBy?: 'exact' | 'contains' | 'code' | 'manual'
  isMatched: boolean
}

/**
 * Retorna o rótulo descritivo formatado do Plano de Contas:
 * Ex: PC-001 | CO-003 Caixa Geral → CC-002 Operações [→ TD-001 Fixa]
 */
export function formatPlanoContaDisplay(plano: PlanoContaRecord): string {
  const codPC = plano.codigo || 'PC-???'
  const conta = plano.expand?.conta
  const centro = plano.expand?.centro
  const tipo = plano.expand?.tipo_despesa

  const codConta = conta?.codigo || 'CO-???'
  const nomeConta = conta?.nome || 'Conta'
  const codCentro = centro?.codigo || 'CC-???'
  const nomeCentro = centro?.nome || 'Centro'

  let text = `${codPC} | ${codConta} ${nomeConta} → ${codCentro} ${nomeCentro}`
  if (tipo && tipo.nome) {
    const codTipo = tipo.codigo || 'TD-???'
    text += ` → ${codTipo} ${tipo.nome}`
  }
  return text
}

/**
 * Busca por similaridade nos planos de contas existentes.
 * 1. Match exato de nome da conta ou centro
 * 2. Match por inclusão (contains case-insensitive & sem acentos)
 * 3. Match por código da conta se houver
 */
export function findBestPlanoContaMatch(
  rawName: string,
  planoList: PlanoContaRecord[],
): { match?: PlanoContaRecord; type?: 'exact' | 'contains' | 'code' } {
  const normRaw = normalizeText(rawName)
  if (!normRaw || normRaw.length < 2) return {}

  // 1. Exact match no nome da conta ou do centro
  for (const pc of planoList) {
    const nomeConta = normalizeText(pc.expand?.conta?.nome || '')
    const nomeCentro = normalizeText(pc.expand?.centro?.nome || '')
    if (nomeConta === normRaw || nomeCentro === normRaw) {
      return { match: pc, type: 'exact' }
    }
  }

  // 2. Contains match (raw contains conta.nome or conta.nome contains raw)
  let bestMatch: PlanoContaRecord | undefined
  let longestMatchLen = 0

  for (const pc of planoList) {
    const nomeConta = normalizeText(pc.expand?.conta?.nome || '')
    const nomeCentro = normalizeText(pc.expand?.centro?.nome || '')
    const codConta = normalizeText(pc.expand?.conta?.codigo || '')
    const codPC = normalizeText(pc.codigo || '')

    // Checa código (ex: CO-001)
    if (codConta && normRaw.includes(codConta)) {
      return { match: pc, type: 'code' }
    }
    if (codPC && normRaw.includes(codPC)) {
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
): MatchedItem[] {
  return candidates.map((cand) => {
    const { match, type } = findBestPlanoContaMatch(cand.rawAccountName, planoList)

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
