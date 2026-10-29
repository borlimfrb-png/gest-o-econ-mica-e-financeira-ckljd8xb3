import React, { createContext, useContext, useEffect, useState } from 'react'
import type { AuthModel } from 'pocketbase'
import pb from '@/lib/pocketbase/client'
import type { UserRole } from '@/types/finance'

export interface AppUser extends AuthModel {
  role?: UserRole
  empresa?: string
  empresas?: string[]
  grupos_empresariais?: string[]
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
    grupos_empresariais?: Array<{
      id: string
      nome: string
      descricao?: string
      empresas?: string[]
      expand?: {
        empresas?: Array<{
          id: string
          nome: string
          nome_fantasia?: string
          cnpj: string
        }>
      }
    }>
  }
}

export function extractUserEmpresasIds(user: AppUser | null | undefined): string[] {
  if (!user) return []
  const ids: string[] = []

  // 1. Array 'empresas' direto no record (IDs brutos do PocketBase relation múltiplo)
  if (Array.isArray(user.empresas)) {
    for (const item of user.empresas) {
      if (!item) continue
      if (typeof item === 'string') {
        ids.push(item.trim())
      } else if (typeof item === 'object' && 'id' in item && (item as any).id) {
        ids.push(String((item as any).id).trim())
      }
    }
  } else if (typeof (user as any).empresas === 'string' && (user as any).empresas.trim()) {
    // Caso venha serializado como string JSON ou ID único
    const val = (user as any).empresas.trim()
    try {
      const parsed = JSON.parse(val)
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (typeof item === 'string') ids.push(item.trim())
          else if (item && typeof item === 'object' && item.id) ids.push(String(item.id).trim())
        }
      } else if (typeof parsed === 'string') {
        ids.push(parsed.trim())
      }
    } catch {
      ids.push(val)
    }
  }

  // 2. Expand de 'empresas' (objetos expandidos pelo PocketBase)
  if (user.expand?.empresas && Array.isArray(user.expand.empresas)) {
    for (const item of user.expand.empresas) {
      if (!item) continue
      const id = typeof item === 'object' && 'id' in item ? String(item.id).trim() : ''
      if (id && !ids.includes(id)) {
        ids.push(id)
      }
    }
  }

  // 3. Campo legado 'empresa' (único)
  const legadoId =
    typeof user.empresa === 'string'
      ? user.empresa.trim()
      : (user.empresa as any)?.id
        ? String((user.empresa as any).id).trim()
        : ''
  if (legadoId && !ids.includes(legadoId)) {
    ids.push(legadoId)
  }

  // 4. Expand do campo legado 'empresa'
  if (user.expand?.empresa?.id) {
    const expandEmpresaId = String(user.expand.empresa.id).trim()
    if (expandEmpresaId && !ids.includes(expandEmpresaId)) {
      ids.push(expandEmpresaId)
    }
  }

  // 4. Expand do campo legado 'empresa'
  if (user.expand?.empresa?.id) {
    const expandEmpresaId = String(user.expand.empresa.id).trim()
    if (expandEmpresaId && !ids.includes(expandEmpresaId)) {
      ids.push(expandEmpresaId)
    }
  }

  const clean = Array.from(new Set(ids.filter(Boolean)))
  return clean
}

/**
 * Extrai todas as empresas acessíveis pelo usuário, combinando:
 * - Vínculos individuais (campo empresas, campo legado empresa)
 * - Empresas-membro dos grupos_empresariais vinculados (a partir de user.expand.grupos_empresariais)
 */
export function extractUserEmpresasAndGruposIds(user: AppUser | null | undefined): string[] {
  if (!user) return []
  const ids = extractUserEmpresasIds(user)

  if (user.expand?.grupos_empresariais && Array.isArray(user.expand.grupos_empresariais)) {
    for (const g of user.expand.grupos_empresariais) {
      if (!g) continue
      if (Array.isArray(g.empresas)) {
        for (const empId of g.empresas) {
          if (empId) {
            const sid =
              typeof empId === 'string'
                ? empId.trim()
                : (empId as any)?.id
                  ? String((empId as any).id).trim()
                  : ''
            if (sid && !ids.includes(sid)) ids.push(sid)
          }
        }
      }
      if (g.expand?.empresas && Array.isArray(g.expand.empresas)) {
        for (const e of g.expand.empresas) {
          if (e?.id) {
            const sid = String(e.id).trim()
            if (sid && !ids.includes(sid)) ids.push(sid)
          }
        }
      }
    }
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
  userGruposIds: string[]
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

  // Carrega e hidrata dados completos do usuário, garantindo a resolução imediata dos grupos
  // e suas empresas-membro sem depender de refresh/F5.
  const hydrateFullUser = async (baseUser: AppUser): Promise<AppUser> => {
    if (!baseUser?.id) return baseUser

    let hydrated = baseUser
    try {
      hydrated = await pb.collection('users').getOne<AppUser>(baseUser.id, {
        expand: 'empresa,empresas,grupos_empresariais,grupos_empresariais.empresas',
      })
    } catch (err) {
      console.warn('[AuthContext] Falha no getOne expandido do usuário:', err)
      hydrated = baseUser
    }

    // Se o usuário possui grupos_empresariais cadastrados, mas eles não vieram expandidos
    // ou vieram sem as empresas-membro (ex.: limitação de nested expand no PocketBase),
    // buscamos diretamente os registros de grupos_empresariais com expand de empresas
    // e injetamos em hydrated.expand.grupos_empresariais para disponibilidade síncrona.
    const rawGrupos: any = (hydrated as any).grupos_empresariais
    const idsGrupos: string[] = []
    if (Array.isArray(rawGrupos)) {
      for (const item of rawGrupos) {
        if (!item) continue
        if (typeof item === 'string') idsGrupos.push(item.trim())
        else if (typeof item === 'object' && item.id) idsGrupos.push(String(item.id).trim())
      }
    }
    if (
      hydrated.expand?.grupos_empresariais &&
      Array.isArray(hydrated.expand.grupos_empresariais)
    ) {
      for (const g of hydrated.expand.grupos_empresariais) {
        if (g?.id) idsGrupos.push(String(g.id).trim())
      }
    }

    const uniqueGruposIds = Array.from(new Set(idsGrupos.filter(Boolean)))

    // Se temos grupos vinculados, conferimos se todas as empresas dos grupos estão resolvidas
    const gruposJaExpandidos = hydrated.expand?.grupos_empresariais || []
    const precisaBuscarGrupos =
      uniqueGruposIds.length > 0 &&
      (gruposJaExpandidos.length < uniqueGruposIds.length ||
        gruposJaExpandidos.some((g) => !g.empresas || g.empresas.length === 0))

    if (precisaBuscarGrupos) {
      try {
        const fetchedGrupos = await Promise.all(
          uniqueGruposIds.map(async (gid) => {
            try {
              return await pb.collection('grupos_empresariais').getOne<any>(gid, {
                expand: 'empresas',
              })
            } catch (err) {
              console.warn(`[AuthContext] Falha ao hidratar grupo id=${gid}:`, err)
              return null
            }
          }),
        )
        const validGrupos = fetchedGrupos.filter(Boolean)
        if (validGrupos.length > 0) {
          hydrated = {
            ...hydrated,
            expand: {
              ...hydrated.expand,
              grupos_empresariais: validGrupos,
            },
          }
        }
      } catch (err) {
        console.warn('[AuthContext] Falha ao hidratar grupos do usuário:', err)
      }
    }

    return hydrated
  }

  const refreshUserData = async () => {
    if (pb.authStore.isValid && pb.authStore.record?.id) {
      try {
        const hydrated = await hydrateFullUser(pb.authStore.record as AppUser)
        setUser(hydrated)
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
        .authRefresh({
          expand: 'empresa,empresas,grupos_empresariais,grupos_empresariais.empresas',
        })
        .then(async (res) => {
          if (res.record?.id) {
            const hydrated = await hydrateFullUser(res.record as AppUser)
            setUser(hydrated)
            setToken(pb.authStore.token)
            return
          }
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
      expand: 'empresa,empresas,grupos_empresariais,grupos_empresariais.empresas',
    })

    // Checagem se o usuário está ativo
    if (authData.record.ativo === false) {
      pb.authStore.clear()
      setUser(null)
      setToken(null)
      throw new Error('Este usuário está desativado. Entre em contato com o administrador.')
    }

    // Busca record completo e hidrata grupos_empresariais e suas empresas-membro imediatamente
    const fullUser = await hydrateFullUser(authData.record as AppUser)

    setUser(fullUser)
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
      expand: 'empresa,empresas,grupos_empresariais,grupos_empresariais.empresas',
    })
    const hydrated = await hydrateFullUser(updated as AppUser)
    setUser(hydrated)
    return hydrated
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
  const userEmpresasIndividuaisIds = extractUserEmpresasIds(user)
  const userEmpresasIds = extractUserEmpresasAndGruposIds(user)
  // Grupos vinculados ao usuário
  const userGruposIds = React.useMemo(() => {
    if (!user) return []
    const ids: string[] = []
    const raw = (user as any).grupos_empresariais
    if (Array.isArray(raw)) {
      for (const item of raw) {
        if (!item) continue
        if (typeof item === 'string') ids.push(item.trim())
        else if (typeof item === 'object' && item.id) ids.push(String(item.id).trim())
      }
    }
    if (user.expand?.grupos_empresariais && Array.isArray(user.expand.grupos_empresariais)) {
      for (const g of user.expand.grupos_empresariais) {
        if (g?.id) ids.push(String(g.id).trim())
      }
    }
    return Array.from(new Set(ids.filter(Boolean)))
  }, [user])

  // empresaVinculadaId é estritamente definida quando o usuário possui EXATAMENTE 1 empresa vinculada e nenhum grupo
  const empresaVinculadaId =
    !isAdmin && userEmpresasIds.length === 1 && userGruposIds.length === 0
      ? userEmpresasIds[0]
      : null

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
        userGruposIds,
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
