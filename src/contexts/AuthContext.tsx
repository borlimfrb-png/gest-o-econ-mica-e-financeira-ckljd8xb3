import React, { createContext, useContext, useEffect, useState } from 'react'
import type { AuthModel } from 'pocketbase'
import pb from '@/lib/pocketbase/client'
import type { UserRole } from '@/types/finance'

export interface AppUser extends AuthModel {
  role?: UserRole
  empresa?: string
  empresas?: string[]
  ativo?: boolean
  expand?: {
    empresa?: {
      id: string
      nome: string
      nome_fantasia?: string
      cnpj: string
    }
    empresas?: Array<{
      id: string
      nome: string
      nome_fantasia?: string
      cnpj: string
    }>
  }
}

export function extractUserEmpresasIds(user: AppUser | null | undefined): string[] {
  if (!user) return []
  const ids: string[] = []
  if (Array.isArray(user.empresas)) {
    for (const item of user.empresas) {
      if (!item) continue
      if (typeof item === 'string') {
        ids.push(item)
      } else if (typeof item === 'object' && 'id' in item && (item as any).id) {
        ids.push((item as any).id)
      }
    }
  }
  if (user.expand?.empresas && Array.isArray(user.expand.empresas)) {
    for (const item of user.expand.empresas) {
      if (!item) continue
      if (item.id && !ids.includes(item.id)) {
        ids.push(item.id)
      }
    }
  }
  const legadoId = typeof user.empresa === 'string' ? user.empresa : (user.empresa as any)?.id
  if (legadoId && !ids.includes(legadoId)) {
    ids.push(legadoId)
  }
  if (user.expand?.empresa?.id && !ids.includes(user.expand.empresa.id)) {
    ids.push(user.expand.empresa.id)
  }
  return Array.from(new Set(ids.filter(Boolean)))
}

interface AuthContextType {
  user: AppUser | null
  token: string | null
  isLoading: boolean
  isAuthenticated: boolean
  isAdmin: boolean
  empresaVinculadaId: string | null
  userEmpresasIds: string[]
  login: (email: string, pass: string) => Promise<void>
  signup: (email: string, pass: string, name: string) => Promise<void>
  updateUser: (data: Partial<Record<string, any>>) => Promise<AuthModel>
  logout: () => void
  requestPasswordReset: (email: string) => Promise<boolean>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(pb.authStore.record as AppUser | null)
  const [token, setToken] = useState<string | null>(pb.authStore.token)
  const [isLoading, setIsLoading] = useState(true)

  const refreshUserData = async () => {
    if (pb.authStore.isValid && pb.authStore.record?.id) {
      try {
        const fullUser = await pb.collection('users').getOne<AppUser>(pb.authStore.record.id, {
          expand: 'empresa,empresas',
        })
        setUser(fullUser)
        setToken(pb.authStore.token)
      } catch (_) {
        setUser(pb.authStore.record as AppUser | null)
        setToken(pb.authStore.token)
      }
    }
  }

  useEffect(() => {
    // Escutar mudanças no authStore
    const unsubscribe = pb.authStore.onChange((newToken, newModel) => {
      setToken(newToken)
      setUser(newModel as AppUser | null)
    })

    // Valida token atual
    if (pb.authStore.isValid) {
      pb.collection('users')
        .authRefresh({ expand: 'empresa,empresas' })
        .then((res) => {
          setUser(res.record as AppUser)
          setToken(pb.authStore.token)
        })
        .catch(async () => {
          // Se falhou authRefresh com expand, tenta sem expand ou logout
          try {
            await pb.collection('users').authRefresh()
            await refreshUserData()
          } catch {
            pb.authStore.clear()
            setUser(null)
            setToken(null)
          }
        })
        .finally(() => {
          setIsLoading(false)
        })
    } else {
      setIsLoading(false)
    }

    return () => {
      unsubscribe()
    }
  }, [])

  const login = async (email: string, pass: string) => {
    const authData = await pb.collection('users').authWithPassword(email.trim(), pass, {
      expand: 'empresa,empresas',
    })

    // Checagem se o usuário está ativo
    if (authData.record.ativo === false) {
      pb.authStore.clear()
      setUser(null)
      setToken(null)
      throw new Error('Este usuário está desativado. Entre em contato com o administrador.')
    }

    let record = authData.record as AppUser
    try {
      record = await pb.collection('users').getOne<AppUser>(authData.record.id, {
        expand: 'empresa,empresas',
      })
    } catch {
      // mantém o record do auth como fallback
    }

    setUser(record)
    setToken(authData.token)
  }

  const signup = async (email: string, pass: string, name: string) => {
    await pb.collection('users').create({
      email: email.trim(),
      password: pass,
      passwordConfirm: pass,
      name: name.trim(),
    })
    // Login automático após criar conta
    await login(email, pass)
  }

  const updateUser = async (data: Partial<Record<string, any>>) => {
    if (!pb.authStore.record?.id) throw new Error('Usuário não autenticado')
    const updated = await pb.collection('users').update(pb.authStore.record.id, data, {
      expand: 'empresa,empresas',
    })
    setUser(updated as AppUser)
    return updated
  }

  const logout = () => {
    try {
      sessionStorage.removeItem('ge_splash_visto_sessao')
    } catch (_) {
      // ignore
    }
    pb.authStore.clear()
    setUser(null)
    setToken(null)
  }

  const requestPasswordReset = async (email: string): Promise<boolean> => {
    try {
      await pb.collection('users').requestPasswordReset(email.trim().toLowerCase())
      return true
    } catch (err) {
      console.error('Erro ao solicitar redefinição de senha:', err)
      throw err
    }
  }

  const isAdmin = user?.role === 'admin'
  const userEmpresasIds = extractUserEmpresasIds(user)
  // empresaVinculadaId é estritamente definida quando o usuário possui EXATAMENTE 1 empresa vinculada
  const empresaVinculadaId = !isAdmin && userEmpresasIds.length === 1 ? userEmpresasIds[0] : null

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!token && pb.authStore.isValid,
        isAdmin,
        empresaVinculadaId,
        userEmpresasIds,
        login,
        signup,
        updateUser,
        logout,
        requestPasswordReset,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
