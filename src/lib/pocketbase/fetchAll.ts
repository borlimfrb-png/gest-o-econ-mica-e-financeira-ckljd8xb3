import pb from '@/lib/pocketbase/client'

/**
 * Busca TODOS os registros de uma coleção PocketBase realizando paginação
 * automática (perPage 500 enquanto page <= totalPages) para evitar cortes
 * pelo limite padrão de 30 registros por página do backend.
 *
 * Cada página é reattemptada com backoff exponencial quando o backend responde
 * 429 (Too Many Requests) — sem isso um rajada de consultas (ex.: realtime +
 * múltiplas telas) derrubava páginas inteiras e o frontend tratava o erro como
 * "sem dados", deixando os dashboards vazios.
 */

const TENTATIVAS_MAXIMAS = 4
const ATRASO_INICIAL_MS = 400

function isErroRateLimit(err: unknown): boolean {
  const e = err as any
  if (!e) return false
  if (e.status === 429) return true
  if (e?.response?.status === 429) return true
  if (typeof e?.message === 'string' && e.message.toLowerCase().includes('too many requests')) {
    return true
  }
  return false
}

async function esperar(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

export async function fetchAllRecords<T = any>(
  collectionName: string,
  options?: Record<string, unknown>,
  perPage = 500,
): Promise<T[]> {
  const all: T[] = []
  let page = 1
  let totalPages = 1

  do {
    let res: { items: T[]; totalPages?: number } | undefined
    let ultimoErro: unknown = undefined

    for (let tentativa = 0; tentativa < TENTATIVAS_MAXIMAS; tentativa++) {
      try {
        res = await pb.collection(collectionName).getList<T>(page, perPage, options as any)
        ultimoErro = undefined
        break
      } catch (err) {
        ultimoErro = err
        if (isErroRateLimit(err) && tentativa < TENTATIVAS_MAXIMAS - 1) {
          await esperar(ATRASO_INICIAL_MS * Math.pow(2, tentativa))
          continue
        }
        throw err
      }
    }

    if (ultimoErro || !res) {
      throw ultimoErro || new Error(`Falha ao consultar ${collectionName} (página ${page}).`)
    }

    if (!res || !Array.isArray(res.items) || res.items.length === 0) {
      break
    }
    all.push(...res.items)
    totalPages = res.totalPages || 1
    page += 1
  } while (page <= totalPages)

  return all
}
