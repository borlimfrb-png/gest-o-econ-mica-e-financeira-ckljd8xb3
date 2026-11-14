import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import pb from '@/lib/pocketbase/client'
import { useAuth } from './AuthContext'

export interface FerramentaUsuarioRecord {
  id: string
  user: string
  ferramentas_habilitadas: string[] | null
}

interface FerramentasContextType {
  desabilitadas: Set<string>
  isCarregando: boolean
  /** Recarrega a habilitação de um usuário específico (admin, na tela de gestão). */
  recarregarDe: (userId: string) => Promise<void>
}

const FerramentasContext = createContext<FerramentasContextType | undefined>(undefined)

const FALLBACK_TODAS: string[] = []

export const FerramentasProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated, isAdmin } = useAuth()
  const [desabilitadas, setDesabilitadas] = useState<Set<string>>(new Set(FALLBACK_TODAS))
  const [isCarregando, setIsCarregando] = useState(true)

  const carregar = useCallback(async () => {
    if (!isAuthenticated || !user?.id) {
      setDesabilitadas(new Set())
      setIsCarregando(false)
      return
    }
    try {
      const rec = await pb
        .collection('ferramentas_usuarios')
        .getFirstListItem<FerramentaUsuarioRecord>(`user="${user.id}"`)
      const lista = Array.isArray(rec?.ferramentas_habilitadas) ? rec.ferramentas_habilitadas : []
      // Falha aberta: só bloqueia o que consta explicitamente na lista de desabilitadas
      setDesabilitadas(new Set(lista))
    } catch {
      // Sem registro = tudo habilitado (comportamento padrão)
      setDesabilitadas(new Set())
    } finally {
      setIsCarregando(false)
    }
  }, [isAuthenticated, user?.id])

  useEffect(() => {
    carregar()
  }, [carregar])

  // Admin não é afetado pela própria habilitação (acesso irrestrito de gestão)
  useEffect(() => {
    if (isAdmin) {
      setDesabilitadas(new Set())
      setIsCarregando(false)
    }
  }, [isAdmin])

  const recarregarDe = useCallback(
    async (userId: string) => {
      if (userId === user?.id) {
        await carregar()
      }
    },
    [carregar, user?.id],
  )

  return (
    <FerramentasContext.Provider value={{ desabilitadas, isCarregando, recarregarDe }}>
      {children}
    </FerramentasContext.Provider>
  )
}

export function useFerramentas(): FerramentasContextType {
  const ctx = useContext(FerramentasContext)
  if (!ctx) {
    throw new Error('useFerramentas must be used within a FerramentasProvider')
  }
  return ctx
}
