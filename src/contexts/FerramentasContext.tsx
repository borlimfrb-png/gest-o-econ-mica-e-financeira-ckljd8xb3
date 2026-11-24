import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useAuth } from './AuthContext'
import { ferramentasService } from '@/services/ferramentasUsuariosService'
import { expandirDesabilitadasCliente } from '@/lib/ferramentasCatalogo'

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

  // HISTERESE: isCarregando só volta a true quando o USUÁRIO da sessão muda
  // (login/logout) — refetches de fundo do MESMO usuário (ex.: admin alterou
  // as ferramentas habilitadas dele) não setam isCarregando, para o ModuloRoute
  // nunca desmontar os filhos (spinner) num estado intermediário.
  const usuarioCarregadoRef = useRef<string | null>(null)

  const carregar = useCallback(async () => {
    if (!isAuthenticated || !user?.id) {
      setDesabilitadas(new Set())
      usuarioCarregadoRef.current = null
      setIsCarregando(false)
      return
    }
    if (isAdmin) {
      // Admin não é afetado pela própria habilitação (acesso irrestrito de gestão)
      setDesabilitadas(new Set())
      usuarioCarregadoRef.current = user.id
      setIsCarregando(false)
      return
    }
    // Novo usuário na sessão (ou primeiro load): spinner é legítimo aqui.
    if (usuarioCarregadoRef.current !== user.id) {
      setIsCarregando(true)
    }
    try {
      const lista = await ferramentasService.getByUser(user.id)
      // Falha aberta: só bloqueia o que consta explicitamente na lista de desabilitadas.
      // Cliente: ids do catálogo (gerencial_* etc.) são expandidos para os módulos
      // cliente_* equivalentes que o menu e as rotas dele usam.
      const base = new Set(lista)
      usuarioCarregadoRef.current = user.id
      setDesabilitadas(user.role === 'cliente' ? expandirDesabilitadasCliente(base) : base)
    } catch {
      // Sem registro = tudo habilitado (comportamento padrão de compatibilidade)
      usuarioCarregadoRef.current = user.id
      setDesabilitadas(new Set())
    } finally {
      setIsCarregando(false)
    }
  }, [isAuthenticated, isAdmin, user?.id, user?.role])

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
