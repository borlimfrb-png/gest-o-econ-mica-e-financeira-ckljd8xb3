import pb from '@/lib/pocketbase/client'

/**
 * Log de Auditoria de Usuários — coleção `auditoria_usuarios` (migração 0114).
 *
 * Gravação: a coleção tem createRule null (ninguém cria direto pela API), então
 * o frontend grava pela rota admin POST /backend/v1/admin/auditoria-usuarios
 * (hook auditoria_usuarios.js, superuser). Falhas são best-effort (não quebram
 * o fluxo principal).
 *
 * Leitura: apenas admin, pela mesma rota (modo listar), com filtros por usuário
 * e por ação, ordenado por mais recente e paginado no backend.
 */

export type AcaoAuditoriaUsuario =
  | 'login'
  | 'logout'
  | 'cadastro_usuario'
  | 'edicao_usuario'
  | 'exclusao_usuario'
  | 'ativar_desativar_usuario'
  | 'redefinicao_senha'
  | 'permissao_perfil'
  | 'ferramentas_habilitadas'
  | 'importacao'
  | 'outro'

export interface AuditoriaUsuarioItem {
  id: string
  autor: string
  autor_email: string
  autor_nome: string
  acao: AcaoAuditoriaUsuario
  detalhes: string
  ip: string
  created: string
}

export interface ListarAuditoriaResult {
  itens: AuditoriaUsuarioItem[]
  total: number
  page: number
  perPage: number
  totalPages: number
}

export interface RegistrarAuditoriaInput {
  acao: AcaoAuditoriaUsuario
  detalhes: string
  autor_id?: string
  autor_email?: string
  autor_nome?: string
}

export interface FiltroUsuarioOption {
  id: string
  nome: string
}

function autorPadrao() {
  const atual = pb.authStore.record
  return {
    autor_id: atual?.id,
    autor_email: atual?.email || '',
    autor_nome: atual?.name || atual?.email || '',
  }
}

export const auditoriaUsuariosService = {
  /** Registra uma ação no log (best-effort — nunca lança). */
  async registrar(input: RegistrarAuditoriaInput): Promise<void> {
    try {
      const autor = autorPadrao()
      await pb.send('/backend/v1/admin/auditoria-usuarios', {
        method: 'POST',
        body: {
          modo: 'registrar',
          acao: input.acao,
          detalhes: input.detalhes || '',
          autor_id: input.autor_id || autor.autor_id,
          autor_email: input.autor_email || autor.autor_email,
          autor_nome: input.autor_nome || autor.autor_nome,
        },
      })
    } catch (err) {
      console.warn('[auditoriaUsuariosService] Falha não-fatal ao registrar log:', err)
    }
  },

  /** Lista o log (só admin) com filtros por usuário/ação e paginação. */
  async listar(options?: {
    usuarioId?: string
    acao?: AcaoAuditoriaUsuario | 'todas'
    page?: number
    perPage?: number
  }): Promise<ListarAuditoriaResult> {
    const res = await pb.send<ListarAuditoriaResult & { sucesso: boolean; erro?: string }>(
      '/backend/v1/admin/auditoria-usuarios',
      {
        method: 'POST',
        body: {
          modo: 'listar',
          usuario: options?.usuarioId || 'todos',
          acao: options?.acao || 'todas',
          page: options?.page || 1,
          perPage: options?.perPage || 50,
        },
      },
    )
    if (!res || !res.sucesso) {
      throw new Error(res?.erro || 'Não foi possível carregar o log de auditoria.')
    }
    return {
      itens: res.itens || [],
      total: res.total || 0,
      page: res.page || 1,
      perPage: res.perPage || 50,
      totalPages: res.totalPages || 1,
    }
  },

  /** Lista distinta de usuários que aparecem no log (para o filtro). */
  async listarUsuariosFiltro(): Promise<FiltroUsuarioOption[]> {
    const res = await pb.send<{
      sucesso: boolean
      usuarios?: FiltroUsuarioOption[]
      erro?: string
    }>('/backend/v1/admin/auditoria-usuarios', {
      method: 'POST',
      body: { modo: 'usuarios_filtro' },
    })
    if (!res || !res.sucesso) return []
    return res.usuarios || []
  },
}
