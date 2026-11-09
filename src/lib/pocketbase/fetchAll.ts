import pb from '@/lib/pocketbase/client'

/**
 * Busca TODOS os registros de uma coleção PocketBase realizando paginação
 * automática (perPage 500 enquanto page <= totalPages) para evitar cortes
 * pelo limite padrão de 30 registros por página do backend.
 */
export async function fetchAllRecords<T = any>(
  collectionName: string,
  options?: Record<string, unknown>,
  perPage = 500,
): Promise<T[]> {
  const all: T[] = []
  let page = 1
  let totalPages = 1

  do {
    const res = await pb.collection(collectionName).getList<T>(page, perPage, options as any)
    if (!res || !Array.isArray(res.items) || res.items.length === 0) {
      break
    }
    all.push(...res.items)
    totalPages = res.totalPages || 1
    page += 1
  } while (page <= totalPages)

  return all
}
