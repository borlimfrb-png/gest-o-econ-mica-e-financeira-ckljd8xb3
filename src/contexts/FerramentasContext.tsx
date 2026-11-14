import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { useAuth } from './AuthContext'
import { ferramentasService } from '@/services/ferramentasUsuariosService'

interface FerramentasContextType {
  /** IDs de ferramentas (módulos) desabilitadas para o usuário autenticado. */
  desabilitadas: Set<string>
  isCarregando: boolean
  /** Recarrega a habilitação de um usuário específico (admin, na tela de gestão). */
  recarregarDe: (userId: string) => Promise<void>
}

const FerramentasContext = createContext<FerramentasContextType | undefined>(undefined)

export const FerramentasProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated, isAdmin } = useAuth()
  const [desabilitadas, setDesabilitadas] = useState<Set<string>>(new Set())
  const [isCarregando, setIsCarregando] = useState(true)

  const carregar = useCallback(async () => {
    if (!isAuthenticated || !user?.id) {
      setDesabilitadas(new Set())
      setIsCarregando(false)
      return
    }
    if (isAdmin) {
      // Admin não é afetado pela própria habilitação (acesso irrestrito de gestão)
      setDesabilitadas(new Set())
      setIsCarregando(false)
      return
    }
    try {
      const lista = await ferramentasService.getByUser(user.id)
      // Falha aberta: só bloqueia o que consta explicitamente na lista de desabilitadas
      setDesabilitadas(new Set(lista))
    } catch {
      // Sem registro = tudo habilitado (comportamento padrão de compatibilidade)
      setDesabilitadas(new Set())
    } finally {
      setIsCarregando(false)
    }
  }, [isAuthenticated, isAdmin, user?.id])

  useEffect(() => {
    carregar()
  }, [carregar])

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
