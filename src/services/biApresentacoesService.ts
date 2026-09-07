import pb from '@/lib/pocketbase/client'
import type { BiApresentacaoRecord } from '@/types/finance'

export interface SalvarBiApresentacaoInput {
  id?: string
  empresa?: string
  grupo?: string
  nome: string
  ano_base: number
  ano_comparativo: number
  modo_consolidado: boolean
  widgets_ocultos: string[]
  modo_apresentacao: boolean
}

export const biApresentacoesService = {
  /**
   * Lista todas as apresentações disponíveis para o usuário / empresa / grupo
   */
  async listar(): Promise<BiApresentacaoRecord[]> {
    try {
      return await pb.collection('bi_apresentacoes').getFullList<BiApresentacaoRecord>({
        sort: '-created',
        expand: 'user,empresa,grupo',
        requestKey: null,
      })
    } catch (err) {
      console.error('Erro ao listar apresentações de BI:', err)
      return []
    }
  },

  /**
   * Lista apresentações filtradas por empresa ou grupo
   */
  async listarPorEscopo(empresaId?: string, grupoId?: string): Promise<BiApresentacaoRecord[]> {
    try {
      let filter = ''
      if (empresaId && grupoId) {
        filter = `empresa = "${empresaId}" || grupo = "${grupoId}"`
      } else if (empresaId) {
        filter = `empresa = "${empresaId}"`
      } else if (grupoId) {
        filter = `grupo = "${grupoId}"`
      }

      return await pb.collection('bi_apresentacoes').getFullList<BiApresentacaoRecord>({
        filter: filter || undefined,
        sort: '-created',
        expand: 'user,empresa,grupo',
        requestKey: null,
      })
    } catch (err) {
      console.error('Erro ao listar apresentações por escopo:', err)
      return []
    }
  },

  /**
   * Cria uma nova apresentação salva
   */
  async criar(data: SalvarBiApresentacaoInput): Promise<BiApresentacaoRecord> {
    const currentUser = pb.authStore.record
    if (!currentUser?.id) {
      throw new Error('Usuário não autenticado.')
    }

    const payload = {
      user: currentUser.id,
      empresa: data.empresa || undefined,
      grupo: data.grupo || undefined,
      nome: data.nome.trim(),
      ano_base: Number(data.ano_base),
      ano_comparativo: Number(data.ano_comparativo),
      modo_consolidado: Boolean(data.modo_consolidado),
      widgets_ocultos: Array.isArray(data.widgets_ocultos) ? data.widgets_ocultos : [],
      modo_apresentacao: Boolean(data.modo_apresentacao),
    }

    return await pb.collection('bi_apresentacoes').create<BiApresentacaoRecord>(payload, {
      expand: 'user,empresa,grupo',
    })
  },

  /**
   * Atualiza uma apresentação existente
   */
  async atualizar(
    id: string,
    data: Partial<SalvarBiApresentacaoInput>,
  ): Promise<BiApresentacaoRecord> {
    const payload: Record<string, any> = {}
    if (data.nome !== undefined) payload.nome = data.nome.trim()
    if (data.empresa !== undefined) payload.empresa = data.empresa || null
    if (data.grupo !== undefined) payload.grupo = data.grupo || null
    if (data.ano_base !== undefined) payload.ano_base = Number(data.ano_base)
    if (data.ano_comparativo !== undefined) payload.ano_comparativo = Number(data.ano_comparativo)
    if (data.modo_consolidado !== undefined)
      payload.modo_consolidado = Boolean(data.modo_consolidado)
    if (data.widgets_ocultos !== undefined) payload.widgets_ocultos = data.widgets_ocultos
    if (data.modo_apresentacao !== undefined)
      payload.modo_apresentacao = Boolean(data.modo_apresentacao)

    return await pb.collection('bi_apresentacoes').update<BiApresentacaoRecord>(id, payload, {
      expand: 'user,empresa,grupo',
    })
  },

  /**
   * Exclui uma apresentação salva
   */
  async excluir(id: string): Promise<boolean> {
    return await pb.collection('bi_apresentacoes').delete(id)
  },
}
