import pb from '@/lib/pocketbase/client'
import type { UserRecord, UserRole } from '@/types/finance'
import { auditoriaCadastrosService } from './auditoriaCadastrosService'

export interface CreateUserInput {
  name: string
  email: string
  password: string
  passwordConfirm: string
  role: UserRole
  empresa?: string
  ativo?: boolean
}

export interface UpdateUserInput {
  name?: string
  email?: string
  role?: UserRole
  empresa?: string | null
  ativo?: boolean
  password?: string
  passwordConfirm?: string
}

export const usuariosService = {
  async getAll(): Promise<UserRecord[]> {
    return await pb.collection('users').getFullList<UserRecord>({
      sort: '-created',
      expand: 'empresa',
    })
  },

  async getById(id: string): Promise<UserRecord> {
    return await pb.collection('users').getOne<UserRecord>(id, {
      expand: 'empresa',
    })
  },

  async create(data: CreateUserInput): Promise<UserRecord> {
    const payload: Record<string, any> = {
      name: data.name.trim(),
      email: data.email.trim(),
      password: data.password,
      passwordConfirm: data.passwordConfirm,
      role: data.role || 'empresa',
      empresa:
        data.role === 'empresa' || data.role === 'financeiro' || data.role === 'comercial'
          ? data.empresa || undefined
          : undefined,
      ativo: data.ativo ?? true,
      emailVisibility: true,
    }

    const record = await pb.collection('users').create<UserRecord>(payload, {
      expand: 'empresa',
    })

    auditoriaCadastrosService
      .registrar({
        empresa: record.empresa || undefined,
        entidade: 'users',
        registro_id: record.id,
        registro_descricao: `${record.name || 'Usuário'} (${record.email}) - Perfil: ${record.role}`,
        acao: 'criacao',
        detalhes: {
          dados_novos: {
            name: record.name,
            email: record.email,
            role: record.role,
            empresa: record.empresa,
            ativo: record.ativo,
          },
        },
      })
      .catch(() => {})

    return record
  },

  async update(id: string, data: UpdateUserInput): Promise<UserRecord> {
    let anterior: UserRecord | null = null
    try {
      anterior = await pb.collection('users').getOne<UserRecord>(id)
    } catch {
      /* intentionally ignored */
    }

    const payload: Record<string, any> = {}
    if (data.name !== undefined) payload.name = data.name.trim()
    if (data.email !== undefined) payload.email = data.email.trim()
    if (data.role !== undefined) {
      payload.role = data.role
      if (data.role === 'admin') {
        payload.empresa = null
      }
    }
    if (data.empresa !== undefined) {
      payload.empresa = data.empresa || null
    }
    if (data.ativo !== undefined) payload.ativo = data.ativo
    if (data.password && data.password.trim().length > 0) {
      payload.password = data.password
      payload.passwordConfirm = data.passwordConfirm || data.password
    }

    const record = await pb.collection('users').update<UserRecord>(id, payload, {
      expand: 'empresa',
    })

    const camposAlterados: Record<string, { antes: any; depois: any }> = {}
    if (anterior) {
      if (data.name !== undefined && data.name !== anterior.name) {
        camposAlterados.name = { antes: anterior.name, depois: record.name }
      }
      if (data.email !== undefined && data.email !== anterior.email) {
        camposAlterados.email = { antes: anterior.email, depois: record.email }
      }
      if (data.role !== undefined && data.role !== anterior.role) {
        camposAlterados.role = { antes: anterior.role, depois: record.role }
      }
      if (data.empresa !== undefined && data.empresa !== anterior.empresa) {
        camposAlterados.empresa = { antes: anterior.empresa, depois: record.empresa }
      }
      if (data.ativo !== undefined && data.ativo !== anterior.ativo) {
        camposAlterados.ativo = { antes: anterior.ativo, depois: record.ativo }
      }
      if (data.password) {
        camposAlterados.password = { antes: '******', depois: '****** (alterada)' }
      }
    }

    auditoriaCadastrosService
      .registrar({
        empresa: record.empresa || anterior?.empresa || undefined,
        entidade: 'users',
        registro_id: record.id,
        registro_descricao: `${record.name || 'Usuário'} (${record.email}) - Perfil: ${record.role}`,
        acao: 'edicao',
        detalhes: {
          campos_alterados: Object.keys(camposAlterados).length > 0 ? camposAlterados : undefined,
          dados_anteriores: anterior
            ? {
                name: anterior.name,
                email: anterior.email,
                role: anterior.role,
                empresa: anterior.empresa,
                ativo: anterior.ativo,
              }
            : undefined,
          dados_novos: {
            name: record.name,
            email: record.email,
            role: record.role,
            empresa: record.empresa,
            ativo: record.ativo,
          },
        },
      })
      .catch(() => {})

    return record
  },

  async toggleAtivo(id: string, ativo: boolean): Promise<UserRecord> {
    let anterior: UserRecord | null = null
    try {
      anterior = await pb.collection('users').getOne<UserRecord>(id)
    } catch {
      /* intentionally ignored */
    }

    const record = await pb
      .collection('users')
      .update<UserRecord>(id, { ativo }, { expand: 'empresa' })

    auditoriaCadastrosService
      .registrar({
        empresa: record.empresa || anterior?.empresa || undefined,
        entidade: 'users',
        registro_id: record.id,
        registro_descricao: `${record.name || 'Usuário'} (${record.email}) - ${ativo ? 'Ativado' : 'Desativado'}`,
        acao: 'edicao',
        detalhes: {
          campos_alterados: {
            ativo: { antes: anterior?.ativo, depois: ativo },
          },
        },
      })
      .catch(() => {})

    return record
  },

  async resetPassword(id: string, newPassword: string): Promise<UserRecord> {
    let anterior: UserRecord | null = null
    try {
      anterior = await pb.collection('users').getOne<UserRecord>(id)
    } catch {
      /* intentionally ignored */
    }

    const record = await pb.collection('users').update<UserRecord>(
      id,
      {
        password: newPassword,
        passwordConfirm: newPassword,
      },
      { expand: 'empresa' },
    )

    auditoriaCadastrosService
      .registrar({
        empresa: record.empresa || anterior?.empresa || undefined,
        entidade: 'users',
        registro_id: record.id,
        registro_descricao: `${record.name || 'Usuário'} (${record.email}) - Senha resetada manualmente`,
        acao: 'edicao',
        detalhes: {
          motivo: 'Redefinição direta de senha pelo administrador',
        },
      })
      .catch(() => {})

    return record
  },

  async delete(id: string): Promise<boolean> {
    let anterior: UserRecord | null = null
    try {
      anterior = await pb.collection('users').getOne<UserRecord>(id)
    } catch {
      /* intentionally ignored */
    }

    const res = await pb.collection('users').delete(id)

    if (res) {
      auditoriaCadastrosService
        .registrar({
          empresa: anterior?.empresa || undefined,
          entidade: 'users',
          registro_id: id,
          registro_descricao: anterior
            ? `${anterior.name || 'Usuário'} (${anterior.email})`
            : `Usuário #${id}`,
          acao: 'exclusao',
          detalhes: {
            dados_anteriores: anterior
              ? {
                  name: anterior.name,
                  email: anterior.email,
                  role: anterior.role,
                  empresa: anterior.empresa,
                  ativo: anterior.ativo,
                }
              : undefined,
          },
        })
        .catch(() => {})
    }

    return res
  },
}
