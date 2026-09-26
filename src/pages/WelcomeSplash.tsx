import React, { useEffect, useState, useMemo } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useFilter } from '@/contexts/FilterContext'
import { useMinhaEmpresa } from '@/contexts/MinhaEmpresaContext'
import { minhaEmpresaService } from '@/services/minhaEmpresaService'
import type { MinhaEmpresaRecord } from '@/types/finance'
import pb from '@/lib/pocketbase/client'
import {
  Scale,
  ArrowRight,
  ShieldCheck,
  Building2,
  Search,
  CheckCircle2,
  PlusCircle,
  Building,
  Layers,
  MapPin,
  AlertCircle,
  Lock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'

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
  const { user, isAdmin, empresaVinculadaId } = useAuth()
  const { minhaEmpresa: minhaEmpresaContexto, logoUrl: logoUrlContexto } = useMinhaEmpresa()
  const { empresas, grupos, selectedEmpresaId, setSelectedEmpresaId, isLoadingEmpresas } =
    useFilter()

  const [empresaPublica, setEmpresaPublica] = useState<MinhaEmpresaRecord | null>(null)
  const [activeTab, setActiveTab] = useState<'empresas' | 'grupos'>('empresas')
  const [busca, setBusca] = useState('')
  const [selecionadoLocal, setSelecionadoLocal] = useState<string>('')

  // Define o destino pretendido caso tenha sido passado via location state
  const destinoFinal = useMemo(() => {
    const fromState = (location.state as { from?: string })?.from
    if (fromState && fromState !== '/' && fromState !== '/splash') {
      return fromState
    }
    return user?.role === 'comercial' ? '/baixa-recebiveis' : '/dashboard'
  }, [location.state, user?.role])

  // Busca dados públicos da consultoria como fallback rápido se necessário
  useEffect(() => {
    let isMounted = true
    const carregar = async () => {
      if (minhaEmpresaContexto) return
      try {
        const rec = await minhaEmpresaService.getPublico()
        if (isMounted && rec) {
          setEmpresaPublica(rec)
        }
      } catch (err) {
        console.error('[WelcomeSplash] Erro ao carregar dados da empresa:', err)
      }
    }
    carregar()
    return () => {
      isMounted = false
    }
  }, [minhaEmpresaContexto])

  const empresaAtiva: MinhaEmpresaRecord | null = minhaEmpresaContexto || empresaPublica

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

  // Sincroniza o selecionado local inicial com o FilterContext
  useEffect(() => {
    if (selecionadoLocal) return

    if (!isAdmin && empresaVinculadaId) {
      setSelecionadoLocal(empresaVinculadaId)
      return
    }

    if (selectedEmpresaId) {
      setSelecionadoLocal(selectedEmpresaId)
      if (selectedEmpresaId.startsWith('grupo-')) {
        setActiveTab('grupos')
      }
      return
    }

    if (empresas.length > 0) {
      setSelecionadoLocal(empresas[0].id)
    } else if (grupos.length > 0) {
      setSelecionadoLocal(`grupo-${grupos[0].id}`)
      setActiveTab('grupos')
    }
  }, [selectedEmpresaId, empresas, grupos, isAdmin, empresaVinculadaId, selecionadoLocal])

  // Filtra as listas com base no termo de busca
  const empresasFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    if (!termo) return empresas
    return empresas.filter(
      (e) =>
        e.nome?.toLowerCase().includes(termo) ||
        e.nome_fantasia?.toLowerCase().includes(termo) ||
        e.cnpj?.includes(termo) ||
        e.segmento?.toLowerCase().includes(termo) ||
        e.cidade?.toLowerCase().includes(termo),
    )
  }, [empresas, busca])

  const gruposFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    if (!termo) return grupos
    return grupos.filter(
      (g) => g.nome?.toLowerCase().includes(termo) || g.descricao?.toLowerCase().includes(termo),
    )
  }, [grupos, busca])

  // Obter detalhes da entidade atualmente selecionada para feedback visual
  const entidadeSelecionadaDetalhe = useMemo(() => {
    if (!selecionadoLocal) return null
    if (selecionadoLocal.startsWith('grupo-')) {
      const grupoId = selecionadoLocal.replace('grupo-', '')
      const g = grupos.find((item) => item.id === grupoId)
      if (!g) return null
      return {
        tipo: 'grupo' as const,
        id: selecionadoLocal,
        nome: g.nome,
        subtitulo: `Grupo Econômico (${g.empresas?.length || 0} ${(g.empresas?.length || 0) === 1 ? 'empresa' : 'empresas'})`,
      }
    }
    const emp = empresas.find((item) => item.id === selecionadoLocal)
    if (!emp) return null
    return {
      tipo: 'empresa' as const,
      id: emp.id,
      nome: emp.nome_fantasia || emp.nome,
      subtitulo: `${emp.segmento || 'Geral'} · CNPJ: ${emp.cnpj || '—'}`,
    }
  }, [selecionadoLocal, empresas, grupos])

  // Confirma a seleção e avança para o sistema
  const confirmarEAcessar = (idParaDefinir?: string) => {
    const idFinal = idParaDefinir || selecionadoLocal || selectedEmpresaId
    if (idFinal) {
      setSelectedEmpresaId(idFinal)
    }
    markSplashSeenThisSession()
    navigate(destinoFinal, { replace: true })
  }

  // Atalho por tecla: Enter confirma o selecionado
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      // Ignora se estiver digitando em campo de input
      if ((e.target as HTMLElement)?.tagName === 'INPUT') {
        if (e.key === 'Enter') {
          e.preventDefault()
          confirmarEAcessar()
        }
        return
      }
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        confirmarEAcessar()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [selecionadoLocal, selectedEmpresaId, destinoFinal])

  const anoAtual = new Date().getFullYear()

  // Regra especial: se usuário não-admin tem apenas uma empresa vinculada e nenhum grupo
  const temApenasUmaEmpresaFixa =
    !isAdmin && empresaVinculadaId && empresas.length <= 1 && grupos.length === 0

  return (
    <div className="relative min-h-screen w-full flex flex-col justify-between items-center p-4 sm:p-6 lg:p-8 bg-gradient-to-br from-[#0B1F3A] via-[#0E274D] to-[#123363] text-white selection:bg-blue-600 selection:text-white overflow-y-auto">
      {/* Luzes de fundo corporativas */}
      <div className="fixed -top-36 -left-36 w-96 h-96 bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed -bottom-36 -right-36 w-96 h-96 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-blue-600/5 rounded-full blur-3xl pointer-events-none" />

      {/* Barra superior de status */}
      <header className="relative z-10 w-full max-w-4xl flex items-center justify-between text-xs text-blue-200/70 py-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-semibold tracking-wide text-blue-100 uppercase text-[11px]">
            Acesso Corporativo Seguro
          </span>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <span>Ano {anoAtual}</span>
          <span className="text-white/30">•</span>
          <span className="text-blue-300 font-medium">
            {user?.name ? user.name.split(' ')[0] : 'Usuário'}
          </span>
        </div>
      </header>

      {/* Centro: Painel de Apresentação e Seleção de Contexto */}
      <main className="relative z-10 my-4 sm:my-6 w-full max-w-2xl flex flex-col items-center">
        <div className="w-full bg-white/[0.04] backdrop-blur-xl border border-white/10 shadow-2xl shadow-black/50 rounded-3xl p-6 sm:p-8 flex flex-col items-center animate-in fade-in zoom-in-98 duration-400">
          {/* TOPO: LOGOMARCA E IDENTIDADE */}
          <div className="flex flex-col items-center justify-center min-h-[90px] w-full mb-3">
            {logoUrlFinal ? (
              <div className="flex flex-col items-center gap-2">
                <div className="max-w-[260px] sm:max-w-[300px] max-h-[85px] flex items-center justify-center p-2.5 rounded-2xl bg-white/95 shadow-xl shadow-blue-950/40 border border-white">
                  <img
                    src={logoUrlFinal}
                    alt={nomeExibicaoEmpresa || 'Logo da Consultoria'}
                    className="max-h-[65px] w-auto max-w-full object-contain"
                  />
                </div>
                {nomeExibicaoEmpresa && (
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-blue-200/90 mt-0.5">
                    {nomeExibicaoEmpresa}
                  </span>
                )}
              </div>
            ) : nomeExibicaoEmpresa ? (
              <div className="flex flex-col items-center gap-2">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-xl shadow-blue-600/30 border border-blue-400/30">
                  <Building2 className="w-7 h-7 text-white" />
                </div>
                <div className="text-center">
                  <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
                    {nomeExibicaoEmpresa}
                  </h2>
                  <span className="text-[11px] uppercase tracking-wider text-blue-300 font-semibold block">
                    Consultoria Empresarial & Financeira
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-xl shadow-blue-600/30 border border-blue-400/30">
                  <Scale className="w-7 h-7 text-white" />
                </div>
                <div className="text-center">
                  <span className="text-xs uppercase tracking-wider text-blue-300 font-semibold block">
                    Consultoria Financeira
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Nome da Plataforma & Chamada de Seleção */}
          <div className="space-y-1 text-center">
            <h1 className="text-lg sm:text-xl font-black text-white tracking-tight uppercase">
              GESTÃO FINANCEIRA E ECONÔMICA
            </h1>
            <p className="text-xs text-blue-100/75 max-w-md mx-auto">
              Selecione a empresa ou o grupo econômico que deseja gerenciar nesta sessão.
            </p>
          </div>

          {/* Divisor */}
          <div className="w-20 h-0.5 bg-gradient-to-r from-transparent via-blue-400/50 to-transparent my-4" />

          {/* SELEÇÃO: ABAS DE EMPRESAS OU GRUPOS */}
          <div className="w-full">
            {isLoadingEmpresas ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2 text-blue-200">
                <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs">Carregando empresas e grupos cadastrados...</span>
              </div>
            ) : empresas.length === 0 && grupos.length === 0 ? (
              /* Fallback quando não há nenhuma empresa cadastrada */
              <div className="w-full p-6 rounded-2xl bg-blue-950/40 border border-blue-400/20 text-center flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-300 border border-blue-400/30">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-white">Nenhuma empresa encontrada</h3>
                  <p className="text-xs text-blue-200/80 max-w-sm">
                    Para iniciar as análises financeiras e os diagnósticos, faça o primeiro cadastro
                    de empresa no sistema.
                  </p>
                </div>
                <div className="pt-2 flex flex-col sm:flex-row items-center gap-2">
                  <Button
                    type="button"
                    onClick={() => {
                      markSplashSeenThisSession()
                      navigate('/empresas')
                    }}
                    className="h-9 px-4 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-md cursor-pointer gap-1.5"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>Cadastrar Primeira Empresa</span>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      markSplashSeenThisSession()
                      navigate(destinoFinal)
                    }}
                    className="h-9 px-4 text-xs text-blue-200 hover:text-white hover:bg-white/10 cursor-pointer"
                  >
                    <span>Ir para o Dashboard</span>
                  </Button>
                </div>
              </div>
            ) : temApenasUmaEmpresaFixa ? (
              /* Caso especial para usuário vinculado com apenas 1 empresa */
              <div className="w-full p-5 rounded-2xl bg-blue-950/40 border border-blue-400/20 flex flex-col items-center text-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-500/20 text-blue-300 flex items-center justify-center border border-blue-400/30">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-blue-300 tracking-wider">
                    Acesso Exclusivo à Empresa Vinculada
                  </span>
                  <h3 className="text-base font-bold text-white mt-0.5">
                    {empresas[0]?.nome_fantasia || empresas[0]?.nome}
                  </h3>
                  <p className="text-xs text-blue-200/70 mt-0.5">
                    CNPJ: {empresas[0]?.cnpj || '—'} · {empresas[0]?.segmento || 'Geral'}
                  </p>
                </div>
                <Button
                  type="button"
                  onClick={() => confirmarEAcessar(empresas[0]?.id)}
                  className="w-full sm:w-auto min-w-[200px] h-10 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-lg cursor-pointer gap-2 mt-1"
                >
                  <span>Entrar no Sistema</span>
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              /* Estrutura padrão com abas Empresas / Grupos */
              <Tabs
                value={activeTab}
                onValueChange={(val) => setActiveTab(val as 'empresas' | 'grupos')}
                className="w-full flex flex-col"
              >
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 mb-3">
                  {/* Seletor de Abas */}
                  <TabsList className="bg-white/10 border border-white/15 p-1 rounded-xl h-10 w-full sm:w-auto grid grid-cols-2">
                    <TabsTrigger
                      value="empresas"
                      className="rounded-lg text-xs font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white text-blue-100 transition-all cursor-pointer gap-1.5"
                    >
                      <Building className="w-3.5 h-3.5" />
                      <span>Empresas</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/20 ml-1">
                        {empresas.length}
                      </span>
                    </TabsTrigger>

                    <TabsTrigger
                      value="grupos"
                      className="rounded-lg text-xs font-bold data-[state=active]:bg-indigo-600 data-[state=active]:text-white text-blue-100 transition-all cursor-pointer gap-1.5"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>Grupos</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/20 ml-1">
                        {grupos.length}
                      </span>
                    </TabsTrigger>
                  </TabsList>

                  {/* Campo de Busca Rápida */}
                  <div className="relative flex-1 sm:max-w-xs">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-blue-200/60 pointer-events-none" />
                    <Input
                      type="text"
                      placeholder={
                        activeTab === 'empresas'
                          ? 'Buscar empresa ou CNPJ...'
                          : 'Buscar grupo econômico...'
                      }
                      value={busca}
                      onChange={(e) => setBusca(e.target.value)}
                      className="h-10 pl-8 pr-3 text-xs bg-white/5 border-white/15 text-white placeholder:text-blue-200/50 rounded-xl focus-visible:ring-blue-400 focus-visible:border-blue-400"
                    />
                  </div>
                </div>

                {/* CONTEÚDO DA ABA: EMPRESAS */}
                <TabsContent value="empresas" className="mt-0 focus-visible:outline-hidden">
                  <div className="max-h-60 sm:max-h-64 overflow-y-auto pr-1 space-y-2">
                    {empresasFiltradas.length === 0 ? (
                      <div className="py-8 text-center text-xs text-blue-200/70 border border-white/10 rounded-2xl bg-white/[0.02]">
                        Nenhuma empresa encontrada para a busca "{busca}".
                      </div>
                    ) : (
                      empresasFiltradas.map((emp) => {
                        const isSelected = selecionadoLocal === emp.id
                        return (
                          <div
                            key={emp.id}
                            onClick={() => setSelecionadoLocal(emp.id)}
                            onDoubleClick={() => confirmarEAcessar(emp.id)}
                            className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 text-left ${
                              isSelected
                                ? 'bg-blue-600/35 border-blue-400 text-white shadow-lg shadow-blue-900/40 ring-1 ring-blue-400/50'
                                : 'bg-white/[0.03] hover:bg-white/[0.08] border-white/10 text-slate-200'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div
                                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                                  isSelected
                                    ? 'bg-blue-500 text-white border-blue-300'
                                    : 'bg-white/10 text-blue-200 border-white/10'
                                }`}
                              >
                                <Building2 className="w-4 h-4" />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-xs sm:text-sm text-white truncate">
                                    {emp.nome_fantasia || emp.nome}
                                  </span>
                                  {emp.segmento && (
                                    <Badge
                                      variant="outline"
                                      className={`text-[9px] px-1.5 py-0 font-medium shrink-0 border ${
                                        isSelected
                                          ? 'border-blue-300/40 text-blue-100 bg-blue-500/20'
                                          : 'border-white/20 text-slate-300 bg-white/5'
                                      }`}
                                    >
                                      {emp.segmento}
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-[11px] text-blue-200/70 truncate flex items-center gap-2 mt-0.5">
                                  <span>CNPJ: {emp.cnpj || '—'}</span>
                                  {emp.cidade && (
                                    <>
                                      <span>•</span>
                                      <span className="flex items-center gap-0.5">
                                        <MapPin className="w-2.5 h-2.5" />
                                        {emp.cidade}
                                        {emp.estado ? `/${emp.estado}` : ''}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="shrink-0 flex items-center gap-1.5">
                              {isSelected ? (
                                <CheckCircle2 className="w-5 h-5 text-blue-300" />
                              ) : (
                                <div className="w-5 h-5 rounded-full border border-white/20" />
                              )}
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </TabsContent>

                {/* CONTEÚDO DA ABA: GRUPOS */}
                <TabsContent value="grupos" className="mt-0 focus-visible:outline-hidden">
                  <div className="max-h-60 sm:max-h-64 overflow-y-auto pr-1 space-y-2">
                    {grupos.length === 0 ? (
                      <div className="py-8 text-center text-xs text-blue-200/70 border border-white/10 rounded-2xl bg-white/[0.02] flex flex-col items-center gap-2">
                        <Layers className="w-6 h-6 text-indigo-300/60" />
                        <span>Nenhum grupo empresarial cadastrado ainda.</span>
                        {isAdmin && (
                          <Link
                            to="/cadastro/grupos-empresariais"
                            onClick={markSplashSeenThisSession}
                            className="text-[11px] text-indigo-300 hover:text-white underline mt-1"
                          >
                            Cadastrar Grupo Empresarial
                          </Link>
                        )}
                      </div>
                    ) : gruposFiltrados.length === 0 ? (
                      <div className="py-8 text-center text-xs text-blue-200/70 border border-white/10 rounded-2xl bg-white/[0.02]">
                        Nenhum grupo encontrado para a busca "{busca}".
                      </div>
                    ) : (
                      gruposFiltrados.map((grupo) => {
                        const grupoValId = `grupo-${grupo.id}`
                        const isSelected = selecionadoLocal === grupoValId
                        const qtd = (grupo.empresas || []).length

                        return (
                          <div
                            key={grupo.id}
                            onClick={() => setSelecionadoLocal(grupoValId)}
                            onDoubleClick={() => confirmarEAcessar(grupoValId)}
                            className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 text-left ${
                              isSelected
                                ? 'bg-indigo-600/35 border-indigo-400 text-white shadow-lg shadow-indigo-900/40 ring-1 ring-indigo-400/50'
                                : 'bg-white/[0.03] hover:bg-white/[0.08] border-white/10 text-slate-200'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div
                                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                                  isSelected
                                    ? 'bg-indigo-500 text-white border-indigo-300'
                                    : 'bg-white/10 text-indigo-200 border-white/10'
                                }`}
                              >
                                <Layers className="w-4 h-4" />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-xs sm:text-sm text-white truncate">
                                    {grupo.nome}
                                  </span>
                                  <Badge
                                    variant="outline"
                                    className={`text-[9px] px-1.5 py-0 font-semibold uppercase tracking-wider shrink-0 border ${
                                      isSelected
                                        ? 'border-indigo-300/40 text-indigo-100 bg-indigo-500/20'
                                        : 'border-indigo-400/30 text-indigo-300 bg-indigo-950/40'
                                    }`}
                                  >
                                    Consolidado
                                  </Badge>
                                </div>
                                <div className="text-[11px] text-blue-200/70 truncate flex items-center gap-2 mt-0.5">
                                  <span>
                                    {qtd}{' '}
                                    {qtd === 1 ? 'empresa integrante' : 'empresas integrantes'}
                                  </span>
                                  {grupo.descricao && (
                                    <>
                                      <span>•</span>
                                      <span className="truncate max-w-[200px]">
                                        {grupo.descricao}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="shrink-0 flex items-center gap-1.5">
                              {isSelected ? (
                                <CheckCircle2 className="w-5 h-5 text-indigo-300" />
                              ) : (
                                <div className="w-5 h-5 rounded-full border border-white/20" />
                              )}
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            )}
          </div>

          {/* RODAPÉ DO CARD: ITEM SELECIONADO E BOTÃO DE ENTRADA */}
          <div className="w-full mt-5 pt-4 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-left w-full sm:w-auto min-w-0">
              <span className="text-[10px] uppercase font-bold text-blue-200/60 block tracking-wider">
                Contexto Escolhido:
              </span>
              <div className="flex items-center gap-1.5 mt-0.5 truncate">
                {entidadeSelecionadaDetalhe ? (
                  <>
                    <span className="text-xs font-bold text-white truncate">
                      {entidadeSelecionadaDetalhe.nome}
                    </span>
                    <span className="text-[10px] text-blue-300/80 shrink-0">
                      ({entidadeSelecionadaDetalhe.tipo === 'grupo' ? 'Grupo' : 'Empresa'})
                    </span>
                  </>
                ) : (
                  <span className="text-xs text-blue-200/50 italic">Nenhum item selecionado</span>
                )}
              </div>
            </div>

            <Button
              type="button"
              disabled={!selecionadoLocal && empresas.length > 0}
              onClick={() => confirmarEAcessar()}
              className="w-full sm:w-auto h-10 px-6 text-xs sm:text-sm font-semibold bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-xl shadow-lg shadow-blue-600/30 hover:shadow-blue-500/40 cursor-pointer group transition-all shrink-0"
            >
              <span>Acessar Painel</span>
              <ArrowRight className="w-4 h-4 ml-1.5 transition-transform group-hover:translate-x-1" />
            </Button>
          </div>

          <p className="text-[10px] text-blue-200/50 text-center mt-3">
            Dica: Dê um duplo-clique no item ou pressione Enter para acessar diretamente.
          </p>
        </div>
      </main>

      {/* Rodapé institucional com copyright e segurança */}
      <footer className="relative z-10 w-full max-w-4xl flex flex-col sm:flex-row items-center justify-between text-xs text-blue-300/60 pt-2 border-t border-white/10 gap-2">
        <div className="flex items-center gap-1.5 text-center sm:text-left">
          <span>
            © {anoAtual} {nomeExibicaoEmpresa || 'GESTÃO FINANCEIRA E ECONÔMICA'}
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
