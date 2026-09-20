import React, { useEffect, useState, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useMinhaEmpresa } from '@/contexts/MinhaEmpresaContext'
import { minhaEmpresaService } from '@/services/minhaEmpresaService'
import type { MinhaEmpresaRecord } from '@/types/finance'
import pb from '@/lib/pocketbase/client'
import { Scale, ArrowRight, ShieldCheck, Sparkles, Building2, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'

const SPLASH_SEEN_SESSION_KEY = 'ge_splash_visto_sessao'

export function markSplashSeenThisSession() {
  try {
    sessionStorage.setItem(SPLASH_SEEN_SESSION_KEY, 'true')
  } catch (_) {
    // sessionStorage indisponível ou em modo privado restrito
  }
}

export function hasSeenSplashThisSession(): boolean {
  try {
    return sessionStorage.getItem(SPLASH_SEEN_SESSION_KEY) === 'true'
  } catch (_) {
    return false
  }
}

export function clearSplashSession() {
  try {
    sessionStorage.removeItem(SPLASH_SEEN_SESSION_KEY)
  } catch (_) {
    // ignore
  }
}

export default function WelcomeSplash() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, isAuthenticated, isLoading: authLoading } = useAuth()
  const { minhaEmpresa: minhaEmpresaContexto, logoUrl: logoUrlContexto } = useMinhaEmpresa()

  const [empresaPublica, setEmpresaPublica] = useState<MinhaEmpresaRecord | null>(null)
  const [carregandoEmpresa, setCarregandoEmpresa] = useState(false)
  const [progresso, setProgresso] = useState(15)

  // Recupera o destino pretendido caso tenha sido passado via location state
  const destinoFinal = useMemo(() => {
    const fromState = (location.state as { from?: string })?.from
    if (fromState && fromState !== '/' && fromState !== '/splash') {
      return fromState
    }
    return user?.role === 'comercial' ? '/baixa-recebiveis' : '/dashboard'
  }, [location.state, user?.role])

  // Busca dados públicos da consultoria/empresa como fallback rápido
  useEffect(() => {
    let isMounted = true
    const carregar = async () => {
      // Se o contexto já tiver a empresa e logo carregados, não precisa refazer
      if (minhaEmpresaContexto) return

      try {
        setCarregandoEmpresa(true)
        const rec = await minhaEmpresaService.getPublico()
        if (isMounted && rec) {
          setEmpresaPublica(rec)
        }
      } catch (err) {
        console.error('[WelcomeSplash] Erro ao carregar dados da empresa:', err)
      } finally {
        if (isMounted) setCarregandoEmpresa(false)
      }
    }
    carregar()
    return () => {
      isMounted = false
    }
  }, [minhaEmpresaContexto])

  // Identifica o registro definitivo de empresa (contexto do usuário ou público da consultoria)
  const empresaAtiva: MinhaEmpresaRecord | null = minhaEmpresaContexto || empresaPublica

  // Logo URL resolvida
  const logoUrlFinal: string | null = useMemo(() => {
    if (logoUrlContexto) return logoUrlContexto
    if (empresaAtiva?.logo) {
      try {
        return pb.files.getURL(empresaAtiva, empresaAtiva.logo)
      } catch (_) {
        return null
      }
    }
    return null
  }, [logoUrlContexto, empresaAtiva])

  const nomeExibicaoEmpresa: string = useMemo(() => {
    return (empresaAtiva?.nome_fantasia || empresaAtiva?.razao_social || '').trim()
  }, [empresaAtiva])

  // Função para prosseguir ao dashboard
  const prosseguir = () => {
    markSplashSeenThisSession()
    navigate(destinoFinal, { replace: true })
  }

  // Animação sutil de progresso e redirecionamento automático suave
  useEffect(() => {
    // Incrementa a barra de progresso suavemente
    const timerInterval = setInterval(() => {
      setProgresso((ant) => {
        if (ant >= 100) {
          clearInterval(timerInterval)
          return 100
        }
        return ant + 18
      })
    }, 280)

    // Redirecionamento automático após 2.4s (tempo ideal para visualização da marca sem cansar)
    const timerAuto = setTimeout(() => {
      prosseguir()
    }, 2400)

    return () => {
      clearInterval(timerInterval)
      clearTimeout(timerAuto)
    }
  }, [destinoFinal])

  // Se o usuário clicar em qualquer tecla de navegação (Espaço, Enter, Esc), pula imediatamente
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
        e.preventDefault()
        prosseguir()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [destinoFinal])

  const anoAtual = new Date().getFullYear()

  return (
    <div
      onClick={prosseguir}
      role="button"
      tabIndex={0}
      title="Clique em qualquer lugar para entrar imediatamente"
      className="relative min-h-screen w-full flex flex-col justify-between items-center p-6 sm:p-10 bg-gradient-to-br from-[#0B1F3A] via-[#0E274D] to-[#123363] text-white selection:bg-blue-600 selection:text-white cursor-pointer select-none overflow-hidden"
    >
      {/* Elementos visuais de fundo (luzes/glows corporativos) */}
      <div className="absolute -top-36 -left-36 w-96 h-96 bg-blue-500/15 rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute -bottom-36 -right-36 w-96 h-96 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/5 rounded-full blur-3xl pointer-events-none" />

      {/* Topo / Barra superior discreta */}
      <header className="relative z-10 w-full max-w-4xl flex items-center justify-between text-xs text-blue-200/70 py-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span className="font-semibold tracking-wide text-blue-100 uppercase text-[11px]">
            Sistema Online · Conexão Segura
          </span>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <span>Ambiente Corporativo</span>
          <span className="text-white/30">•</span>
          <span className="text-blue-300 font-medium">v{anoAtual}</span>
        </div>
      </header>

      {/* Centro: Cartão de Apresentação e Logomarca */}
      <main className="relative z-10 my-auto w-full max-w-lg flex flex-col items-center text-center">
        {/* Cartão com efeito glassmorphism corporativo */}
        <div
          onClick={(e) => {
            // Garante propagação ou clique limpo
          }}
          className="w-full bg-white/[0.04] backdrop-blur-xl border border-white/10 shadow-2xl shadow-black/40 rounded-3xl p-8 sm:p-10 flex flex-col items-center transition-transform hover:scale-[1.005] duration-300"
        >
          {/* ÁREA DA LOGOMARCA */}
          <div className="mb-6 flex flex-col items-center justify-center min-h-[110px] w-full">
            {logoUrlFinal ? (
              <div className="flex flex-col items-center gap-3 animate-in fade-in zoom-in-95 duration-500">
                <div className="max-w-[280px] sm:max-w-[320px] max-h-[110px] flex items-center justify-center p-3.5 rounded-2xl bg-white/95 shadow-xl shadow-blue-950/40 border border-white">
                  <img
                    src={logoUrlFinal}
                    alt={nomeExibicaoEmpresa || 'Logo da Consultoria'}
                    className="max-h-[82px] w-auto max-w-full object-contain"
                  />
                </div>
                {nomeExibicaoEmpresa && (
                  <span className="text-xs font-semibold uppercase tracking-widest text-blue-200/90 mt-1">
                    {nomeExibicaoEmpresa}
                  </span>
                )}
              </div>
            ) : nomeExibicaoEmpresa ? (
              /* Fallback 1: Sem logo cadastrada, mas com nome da empresa */
              <div className="flex flex-col items-center gap-3 animate-in fade-in duration-500">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-xl shadow-blue-600/30 border border-blue-400/30">
                  <Building2 className="w-8 h-8 text-white" />
                </div>
                <div className="text-center">
                  <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                    {nomeExibicaoEmpresa}
                  </h2>
                  <span className="text-xs uppercase tracking-wider text-blue-300 font-semibold block mt-0.5">
                    Consultoria Empresarial & Financeira
                  </span>
                </div>
              </div>
            ) : (
              /* Fallback 2: Sem nenhum cadastro -> Marca institucional */
              <div className="flex flex-col items-center gap-3 animate-in fade-in duration-500">
                <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-xl shadow-blue-600/30 border border-blue-400/30">
                  <Scale className="w-8 h-8 text-white" />
                </div>
                <div className="text-center">
                  <span className="text-sm uppercase tracking-wider text-blue-300 font-semibold block">
                    Consultoria Financeira
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Divisor elegante */}
          <div className="w-16 h-0.5 bg-gradient-to-r from-transparent via-blue-400/50 to-transparent my-2" />

          {/* Nome da Plataforma */}
          <div className="space-y-1.5 mt-2">
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight uppercase leading-snug">
              GESTÃO FINANCEIRA E ECONÔMICA
            </h1>
            <p className="text-xs sm:text-sm text-blue-100/75 max-w-sm mx-auto font-normal">
              Análise patrimonial, diagnósticos contábeis, indicadores executivos e decisões
              estratégicas.
            </p>
          </div>

          {/* Saudação ao usuário autenticado */}
          {user?.name && (
            <div className="mt-5 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/15 text-xs text-blue-100 font-medium shadow-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>
                Olá, <strong className="font-semibold text-white">{user.name}</strong>
              </span>
            </div>
          )}

          {/* Indicador de carregamento / Progresso */}
          <div className="w-full max-w-xs mt-6 space-y-2">
            <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden p-0.5">
              <div
                className="h-full bg-gradient-to-r from-blue-400 via-blue-500 to-indigo-400 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${Math.min(progresso, 100)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-blue-200/70 font-medium px-1">
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                Carregando painel...
              </span>
              <span>{Math.min(progresso, 100)}%</span>
            </div>
          </div>

          {/* Botão discreto para entrar imediatamente */}
          <div className="mt-6 w-full max-w-xs">
            <Button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                prosseguir()
              }}
              className="w-full h-10 text-xs sm:text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-lg shadow-blue-600/30 hover:shadow-blue-500/40 active:scale-[0.98] transition-all cursor-pointer group"
            >
              <span>Acessar Painel Agora</span>
              <ArrowRight className="w-4 h-4 ml-1.5 transition-transform group-hover:translate-x-1" />
            </Button>
            <p className="text-[10px] text-blue-200/50 text-center mt-2">
              Clique em qualquer lugar da tela ou pressione Enter para continuar
            </p>
          </div>
        </div>
      </main>

      {/* Rodapé institucional */}
      <footer className="relative z-10 w-full max-w-4xl flex flex-col sm:flex-row items-center justify-between text-xs text-blue-300/60 pt-4 border-t border-white/10 gap-2">
        <div className="flex items-center gap-1.5 text-center sm:text-left">
          <span>
            © {anoAtual}{' '}
            {nomeExibicaoEmpresa ? nomeExibicaoEmpresa : 'GESTÃO FINANCEIRA E ECONÔMICA'}
          </span>
          <span className="hidden sm:inline">•</span>
          <span className="hidden sm:inline">Todos os direitos reservados</span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px]">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Ambiente Corporativo Seguro</span>
        </div>
      </footer>
    </div>
  )
}
