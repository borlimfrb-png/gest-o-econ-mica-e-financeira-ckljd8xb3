import { pb } from '@/lib/pocketbase/client'
import {
  AuditoriaCadastroRecord,
  EntidadeAuditoriaCadastro,
  AcaoAuditoriaCadastro,
} from '@/types/finance'

export interface RegistrarAuditoriaCadastroInput {
  empresa?: string
  entidade: EntidadeAuditoriaCadastro
  registro_id: string
  registro_descricao?: string
  acao: AcaoAuditoriaCadastro
  detalhes?: {
    campos_alterados?: Record<string, { antes: any; depois: any }>
    dados_anteriores?: Record<string, any>
    dados_novos?: Record<string, any>
    motivo?: string
  }
}

export const auditoriaCadastrosService = {
  /**
   * Registra um evento de auditoria para empresas, plano_contas ou users.
   * Não lança erro fatal caso a auditoria falhe para não quebrar o fluxo principal.
   */
  async registrar(input: RegistrarAuditoriaCadastroInput): Promise<AuditoriaCadastroRecord | null> {
    try {
      const currentUser = pb.authStore.model
      const usuarioId = currentUser?.id || undefined
      const usuarioNome = currentUser?.name || currentUser?.nome || currentUser?.email || 'Sistema'
      const usuarioEmail = currentUser?.email || ''

      const payload = {
        empresa: input.empresa || currentUser?.empresa || undefined,
        entidade: input.entidade,
        registro_id: input.registro_id,
        registro_descricao: input.registro_descricao || '',
        acao: input.acao,
        usuario: usuarioId,
        usuario_nome: usuarioNome,
        usuario_email: usuarioEmail,
        detalhes: input.detalhes || {},
      }

      const record = await pb
        .collection('auditoria_cadastros')
        .create<AuditoriaCadastroRecord>(payload)
      return record
    } catch (err) {
      console.warn('[auditoriaCadastrosService] Falha não-fatal ao registrar auditoria:', err)
      return null
    }
  },

  /**
   * Lista logs de auditoria de cadastros com filtros opcionais
   */
  async listar(options?: {
    empresaId?: string
    entidade?: EntidadeAuditoriaCadastro | 'todas'
    acao?: AcaoAuditoriaCadastro | 'todas'
    termoBusca?: string
    page?: number
    perPage?: number
  }): Promise<{ items: AuditoriaCadastroRecord[]; totalItems: number; totalPages: number }> {
    const filters: string[] = []

    if (options?.entidade && options.entidade !== 'todas') {
      filters.push(`entidade = '${options.entidade}'`)
    }

    if (options?.acao && options.acao !== 'todas') {
      filters.push(`acao = '${options.acao}'`)
    }

    if (options?.empresaId) {
      filters.push(`empresa = '${options.empresaId}'`)
    }

    if (options?.termoBusca && options.termoBusca.trim() !== '') {
      const busca = options.termoBusca.replace(/'/g, "\\'")
      filters.push(
        `(registro_descricao ~ '${busca}' || usuario_nome ~ '${busca}' || usuario_email ~ '${busca}' || registro_id ~ '${busca}')`,
      )
    }

    const filterString = filters.length > 0 ? filters.join(' && ') : ''

    const result = await pb
      .collection('auditoria_cadastros')
      .getList<AuditoriaCadastroRecord>(options?.page || 1, options?.perPage || 50, {
        filter: filterString || undefined,
        sort: '-created',
        expand: 'empresa,usuario',
        requestKey: null,
      })

    return {
      items: result.items,
      totalItems: result.totalItems,
      totalPages: result.totalPages,
    }
  },
}
