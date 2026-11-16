import {
  useEffect,
  useMemo,
  useState,
  createContext,
  useContext,
  useCallback,
  type ReactNode,
} from 'react'
import type { ModuloSistema } from '@/lib/permissoesPerfis'
import type { UserRole } from '@/types/finance'
import { PERFIS_ACESSO } from '@/lib/permissoesPerfis'
import {
  permissoesPerfisService,
  type PermissaoPerfilRecord,
} from '@/services/permissoesPerfisService'
import { useAuth } from '@/contexts/AuthContext'

/**
 * Contexto das permissões personalizadas por perfil (coleção `permissoes_perfis`).
 *
 * É carregado UMA VEZ no topo do app (App.tsx, depois do AuthProvider) e mantém a
 * função síncrona `perfilTemAcessoDinamico` usada pelo menu (filtrarMenuPorPerfil)
 * e pelo ModuloRoute. Sem registro na coleção = padrão de permissoesPerfis.ts.
 * O perfil admin é imune (sempre usa a lista padrão completa).
 */

interface PermissoesDinamicasContexto {
  overrides: Record<string, ModuloSistema[]>
  isCarregando: boolean
  /** Versão síncrona do perfilTemAcesso, consultando o override quando existir. */
  perfilTemAcessoDinamico: (role: UserRole | undefined, modulo: ModuloSistema) => boolean
  /** Recarrega os overrides (chamado após salvar/restaurar no painel admin). */
  recarregar: () => Promise<void>
}

const Contexto = createContext<PermissoesDinamicasContexto | null>(null)

function overridesParaMapa(registros: PermissaoPerfilRecord[]): Record<string, ModuloSistema[]> {
  const mapa: Record<string, ModuloSistema[]> = {}
  for (const r of registros || []) {
    if (!r?.perfil) continue
    // admin é imune — ignora qualquer registro
    if (r.perfil === 'admin') continue
    const lista = Array.isArray(r.modulos) ? r.modulos : []
    mapa[r.perfil] = lista
  }
  return mapa
}

export function PermissoesDinamicasProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading: isLoadingAuth } = useAuth()
  const [registros, setRegistros] = useState<PermissaoPerfilRecord[]>([])
  const [isCarregando, setIsCarregando] = useState(true)

  const carregar = useCallback(async () => {
    setIsCarregando(true)
    const lista = await permissoesPerfisService.listarTodos()
    setRegistros(lista)
    setIsCarregando(false)
  }, [])

  useEffect(() => {
    // Espera a sessão resolver antes de ler a coleção (evita leitura desautenticada).
    if (isLoadingAuth) return
    if (isAuthenticated) {
      carregar()
    } else {
      setRegistros([])
      setIsCarregando(false)
    }
  }, [isAuthenticated, isLoadingAuth, carregar])

  const overrides = useMemo(() => overridesParaMapa(registros), [registros])

  const perfilTemAcessoDinamico = useCallback(
    (role: UserRole | undefined, modulo: ModuloSistema): boolean => {
      const userRole: UserRole = role || 'empresa'
      // admin é imune ao override — sempre lista padrão completa
      if (userRole === 'admin') {
        return PERFIS_ACESSO.admin.modulosPermitidos.includes(modulo)
      }
      const listaOverride = overrides[userRole]
      if (listaOverride) {
        return listaOverride.includes(modulo)
      }
      const config = PERFIS_ACESSO[userRole] || PERFIS_ACESSO.empresa
      return config.modulosPermitidos.includes(modulo)
    },
    [overrides],
  )

  const recarregar = useCallback(async () => {
    await carregar()
  }, [carregar])

  return (
    <Contexto.Provider value={{ overrides, isCarregando, perfilTemAcessoDinamico, recarregar }}>
      {children}
    </Contexto.Provider>
  )
}

export function usePermissoesDinamicas(): PermissoesDinamicasContexto {
  const ctx = useContext(Contexto)
  // Fallback seguro (fora do provider, ex. testes): usa o padrão estático.
  if (!ctx) {
    return {
      overrides: {},
      isCarregando: false,
      perfilTemAcessoDinamico: (role, modulo) => {
        const userRole: UserRole = role || 'empresa'
        if (userRole === 'admin') return PERFIS_ACESSO.admin.modulosPermitidos.includes(modulo)
        const config = PERFIS_ACESSO[userRole] || PERFIS_ACESSO.empresa
        return config.modulosPermitidos.includes(modulo)
      },
      recarregar: async () => {},
    }
  }
  return ctx
}
