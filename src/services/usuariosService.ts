import pb from '@/lib/pocketbase/client'
import type { UserRecord, UserRole } from '@/types/finance'

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
      empresa: data.role === 'empresa' ? data.empresa || undefined : undefined,
      ativo: data.ativo ?? true,
      emailVisibility: true,
    }

    return await pb.collection('users').create<UserRecord>(payload, {
      expand: 'empresa',
    })
  },

  async update(id: string, data: UpdateUserInput): Promise<UserRecord> {
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

    return await pb.collection('users').update<UserRecord>(id, payload, {
      expand: 'empresa',
    })
  },

  async toggleAtivo(id: string, ativo: boolean): Promise<UserRecord> {
    return await pb.collection('users').update<UserRecord>(id, { ativo }, { expand: 'empresa' })
  },

  async resetPassword(id: string, newPassword: string): Promise<UserRecord> {
    return await pb.collection('users').update<UserRecord>(
      id,
      {
        password: newPassword,
        passwordConfirm: newPassword,
      },
      { expand: 'empresa' },
    )
  },

  async delete(id: string): Promise<boolean> {
    return await pb.collection('users').delete(id)
  },
}
