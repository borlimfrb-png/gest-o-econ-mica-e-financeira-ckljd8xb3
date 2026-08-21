import pb from '@/lib/pocketbase/client'
import type { MinhaEmpresaRecord } from '@/types/finance'

export const minhaEmpresaService = {
  async get(): Promise<MinhaEmpresaRecord | null> {
    const userId = pb.authStore.record?.id
    if (!userId) return null

    try {
      const record = await pb
        .collection('minha_empresa')
        .getFirstListItem<MinhaEmpresaRecord>(`user = "${userId}"`, { requestKey: null })
      return record
    } catch (err: any) {
      if (err?.status === 404) {
        return null
      }
      throw err
    }
  },

  async save(
    data: FormData | Partial<MinhaEmpresaRecord>,
    id?: string,
  ): Promise<MinhaEmpresaRecord> {
    const userId = pb.authStore.record?.id
    if (!userId) throw new Error('Usuário não autenticado')

    if (id) {
      return await pb.collection('minha_empresa').update<MinhaEmpresaRecord>(id, data)
    }

    // Se for FormData, garante que user está setado
    if (data instanceof FormData) {
      if (!data.has('user')) {
        data.append('user', userId)
      }
      return await pb.collection('minha_empresa').create<MinhaEmpresaRecord>(data)
    }

    return await pb.collection('minha_empresa').create<MinhaEmpresaRecord>({
      ...data,
      user: userId,
    })
  },

  async delete(id: string): Promise<boolean> {
    return await pb.collection('minha_empresa').delete(id)
  },
}
