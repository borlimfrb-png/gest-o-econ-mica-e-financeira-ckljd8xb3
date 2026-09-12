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

  /**
   * Obtém os dados públicos/institucionais da empresa/consultoria (para login e telas de entrada),
   * buscando o registro da consultoria (ex: Flavio/Admin ou primeiro registro cadastrado).
   */
  async getPublico(): Promise<MinhaEmpresaRecord | null> {
    try {
      // 1. Tenta buscar primeiro da consultoria flavio@borlim.com.br
      try {
        const adminUser = await pb
          .collection('users')
          .getFirstListItem(`email = "flavio@borlim.com.br"`, { requestKey: null })
        if (adminUser?.id) {
          const recAdmin = await pb
            .collection('minha_empresa')
            .getFirstListItem<MinhaEmpresaRecord>(`user = "${adminUser.id}"`, { requestKey: null })
          if (recAdmin) return recAdmin
        }
      } catch (_) {
        // Ignora e tenta fallback geral
      }

      // 2. Fallback: pega o primeiro registro existente na coleção minha_empresa
      const rec = await pb
        .collection('minha_empresa')
        .getFirstListItem<MinhaEmpresaRecord>('', { sort: '-created', requestKey: null })
      return rec
    } catch (err: any) {
      if (err?.status === 404) {
        return null
      }
      return null
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
