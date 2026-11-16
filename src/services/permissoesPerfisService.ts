import type { ModuloSistema } from '@/lib/permissoesPerfis'
import type { UserRole } from '@/types/finance'
import { PERFIS_ACESSO } from '@/lib/permissoesPerfis'
import pb from '@/lib/pocketbase/client'

/**
 * Permissões personalizadas por perfil — coleção `permissoes_perfis` (0114).
 *
 * SEM registro para um perfil = comportamento padrão de permissoesPerfis.ts.
 * Com registro, `modulos` (JSON) substitui a lista padrão. O perfil `admin`
 * é imune: mesmo com registro, o código sempre usa a lista padrão completa.
 */

export interface PermissaoPerfilRecord {
  id: string
  perfil: UserRole
  modulos: ModuloSistema[]
  created: string
  updated: string
}

export interface SalvarPermissaoPerfilInput {
  perfil: UserRole
  modulos: ModuloSistema[]
}

function sanitizar(perfil: string, modulos: unknown): ModuloSistema[] {
  const permitidos = PERFIS_ACESSO[perfil as UserRole]?.modulosPermitidos || []
  if (!Array.isArray(modulos)) return []
  return (modulos as string[]).filter(
    (m): m is ModuloSistema => typeof m === 'string' && permitidos.includes(m as ModuloSistema),
  )
}

export const permissoesPerfisService = {
  /** Carrega TODOS os overrides existentes (qualquer usuário autenticado pode ler). */
  async listarTodos(): Promise<PermissaoPerfilRecord[]> {
    try {
      return await pb
        .collection('permissoes_perfis')
        .getFullList<PermissaoPerfilRecord>({ sort: '-updated', requestKey: null })
    } catch (err) {
      console.warn('[permissoesPerfisService] Falha ao carregar overrides:', err)
      return []
    }
  },

  /** Salva (upsert) o override completo de um perfil. Só admin. */
  async salvar(input: SalvarPermissaoPerfilInput): Promise<PermissaoPerfilRecord> {
    if (input.perfil === 'admin') {
      throw new Error('O perfil Administrador é imune: não pode ser personalizado.')
    }
    const modulos = sanitizar(input.perfil, input.modulos)
    const existentes = await this.listarTodos()
    const existente = existentes.find((p) => p.perfil === input.perfil)
    if (existente) {
      return await pb.collection('permissoes_perfis').update<PermissaoPerfilRecord>(existente.id, {
        modulos,
      })
    }
    return await pb
      .collection('permissoes_perfis')
      .create<PermissaoPerfilRecord>({ perfil: input.perfil, modulos })
  },

  /** Remove o override do perfil — volta ao padrão de permissoesPerfis.ts. Só admin. */
  async restaurarPadrao(perfil: UserRole): Promise<void> {
    if (perfil === 'admin') {
      throw new Error('O perfil Administrador é imune: não pode ser personalizado.')
    }
    const existentes = await this.listarTodos()
    const existente = existentes.find((p) => p.perfil === perfil)
    if (existente) {
      await pb.collection('permissoes_perfis').delete(existente.id)
    }
  },
}
