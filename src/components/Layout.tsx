import React, { useState } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useFilter } from '@/contexts/FilterContext'
import { useMinhaEmpresa } from '@/contexts/MinhaEmpresaContext'
import { ModalPerfil } from '@/components/ModalPerfil'
import {
  Scale,
  LayoutDashboard,
  Building2,
  PieChart,
  Tags,
  BookOpen,
  FileText,
  Upload,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Calendar,
  Building,
  FolderTree,
  Folder,
  Settings,
  DollarSign,
  CheckCircle2,
  Calculator,
  Gauge,
  Activity,
  TrendingDown,
  TrendingUp,
  Clock,
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import pb from '@/lib/pocketbase/client'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export default function Layout() {
  const { user, logout, isAuthenticated, isLoading } = useAuth()
  const {
    empresas,
    selectedEmpresaId,
    setSelectedEmpresaId,
    selectedAno,
    setSelectedAno,
    anosDisponiveis,
  } = useFilter()
  const { minhaEmpresa, logoUrl, corPrimaria, corSecundaria } = useMinhaEmpresa()

  const navigate = useNavigate()
  const location = useLocation()
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)
  const [modalPerfilOpen, setModalPerfilOpen] = useState(false)

  // Itens do submenu Cadastros
  const cadastroSubItems = [
    { name: 'Empresas', path: '/empresas', icon: Building2 },
    { name: 'Centros de Custo', path: '/centros', icon: PieChart },
    { name: 'Tipos de Despesas', path: '/tipos-despesas', icon: Tags },
    { name: 'Cadastro de Contas', path: '/contas', icon: BookOpen },
    { name: 'Plano de Contas', path: '/plano-contas', icon: FolderTree },
    { name: 'Minha Empresa', path: '/minha-empresa', icon: Building },
  ]

  const isCadastroActive =
    location.pathname.startsWith('/empresas') ||
    location.pathname.startsWith('/centros') ||
    location.pathname.startsWith('/tipos-despesas') ||
    location.pathname.startsWith('/contas') ||
    location.pathname.startsWith('/plano-contas') ||
    location.pathname === '/minha-empresa'

  // Itens do submenu Financeiro
  const financeiroSubItems = [
    { name: 'Financeiro', path: '/financeiro', icon: Calendar },
    { name: 'Baixa dos Recebíveis', path: '/baixa-recebiveis', icon: CheckCircle2 },
    { name: 'Contratos', path: '/contratos', icon: FileText },
  ]

  const isFinanceiroActive =
    location.pathname === '/financeiro' ||
    location.pathname === '/baixa-recebiveis' ||
    location.pathname === '/contratos'

  // Itens do submenu Indicadores
  const indicadoresSubItems = [
    { name: 'Painel & Benchmarks', path: '/indicadores/painel', icon: Gauge },
    { name: 'Indicadores de Liquidez', path: '/indicadores/liquidez', icon: Activity },
    {
      name: 'Indicadores de Endividamento',
      path: '/indicadores/endividamento',
      icon: TrendingDown,
    },
    { name: 'Indicadores de Rentabilidade', path: '/indicadores/rentabilidade', icon: TrendingUp },
    {
      name: 'Indicadores de Estrutura de Capital',
      path: '/indicadores/estrutura-capital',
      icon: Building2,
    },
    {
      name: 'EBITDA',
      path: '/indicadores/ebitda',
      icon: TrendingUp,
    },
    {
      name: 'Eficiência Operacional',
      path: '/indicadores/eficiencia-operacional',
      icon: Clock,
    },
    {
      name: 'Econômicos (análise mais avançada)',
      path: '/indicadores/economicos',
      icon: TrendingUp,
    },
    {
      name: 'Valuation',
      path: '/indicadores/valuation',
      icon: TrendingUp,
    },
    {
      name: 'Ponto de Equilíbrio',
      path: '/indicadores/ponto-equilibrio',
      icon: Scale,
    },
  ]

  const isIndicadoresActive = location.pathname.startsWith('/indicadores')

  // Grupo "Cadastros" expansível/colapsável
  // Quando o usuário está em qualquer página dentro de "Cadastros", o grupo fica expandido automaticamente
  const [cadastrosOpen, setCadastrosOpen] = useState(isCadastroActive)

  // Grupo "Financeiro" expansível/colapsável
  const [financeiroOpen, setFinanceiroOpen] = useState(isFinanceiroActive)

  // Grupo "Indicadores" expansível/colapsável
  const [indicadoresOpen, setIndicadoresOpen] = useState<boolean>(isIndicadoresActive || true)

  React.useEffect(() => {
    if (isCadastroActive) {
      setCadastrosOpen(true)
    }
  }, [isCadastroActive])

  React.useEffect(() => {
    if (isFinanceiroActive) {
      setFinanceiroOpen(true)
    }
  }, [isFinanceiroActive])

  React.useEffect(() => {
    if (isIndicadoresActive) {
      setIndicadoresOpen(true)
    }
  }, [isIndicadoresActive])

  // Redirect to login if not authenticated
  React.useEffect(() => {
    if (!isLoading && !isAuthenticated && location.pathname !== '/') {
      navigate('/', { replace: true })
    }
  }, [isAuthenticated, isLoading, navigate, location.pathname])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-slate-600 font-medium">Carregando sistema...</span>
        </div>
      </div>
    )
  }

  if (!isAuthenticated && location.pathname === '/') {
    return <Outlet />
  }

  const userInitial = user?.name ? user.name.charAt(0).toUpperCase() : 'U'
  const userName = user?.name || 'Consultor Financeiro'
  const userEmail = user?.email || 'usuario@sistema.com'

  const showHeaderFilters =
    location.pathname === '/dashboard' ||
    location.pathname === '/relatorios' ||
    location.pathname === '/relatorio-anual' ||
    location.pathname === '/analise-tributaria' ||
    location.pathname.startsWith('/empresas/')

  return (
    <div className="min-h-screen bg-[#F5F7FA] flex flex-col antialiased text-slate-800">
      {/* Mobile Topbar (< 768px) */}
      <header
        className="md:hidden sticky top-0 z-40 h-16 text-white px-4 flex items-center justify-between border-b border-white/10 shadow-md transition-colors"
        style={{ backgroundColor: corPrimaria }}
      >
        <button
          onClick={() => setMobileDrawerOpen(true)}
          className="p-2 -ml-2 rounded-lg text-slate-200 hover:text-white hover:bg-white/10 transition-colors"
          aria-label="Abrir menu"
        >
          <Menu className="w-6 h-6" />
        </button>

        <div className="flex items-center gap-2">
          {logoUrl ? (
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center p-1 overflow-hidden">
              <img
                src={logoUrl}
                alt={minhaEmpresa?.nome_fantasia || 'Logo'}
                className="w-full h-full object-contain"
              />
            </div>
          ) : (
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white"
              style={{ backgroundColor: corSecundaria }}
            >
              <Scale className="w-4 h-4" />
            </div>
          )}
          <span className="font-bold text-base tracking-tight text-white truncate max-w-[180px]">
            {minhaEmpresa?.nome_fantasia || minhaEmpresa?.razao_social || 'Analise de Balanço'}
          </span>
        </div>

        <Avatar
          onClick={() => navigate('/configuracoes')}
          className="w-8 h-8 border border-white/20 text-white text-xs font-semibold cursor-pointer hover:opacity-90"
          style={{ backgroundColor: corSecundaria }}
          title="Configurações"
        >
          {user?.avatar && <AvatarImage src={pb.files.getURL(user, user.avatar)} alt={userName} />}
          <AvatarFallback style={{ backgroundColor: corSecundaria }} className="text-white">
            {userInitial}
          </AvatarFallback>
        </Avatar>
      </header>

      {/* Mobile Drawer */}
      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileDrawerOpen(false)}
          />

          {/* Drawer Content */}
          <div
            className="relative w-72 max-w-[80vw] text-white flex flex-col justify-between h-full p-5 shadow-2xl z-10 transition-colors"
            style={{ backgroundColor: corPrimaria }}
          >
            <div>
              <div className="flex items-center justify-between pb-6 border-b border-white/10">
                <div className="flex items-center gap-2.5 overflow-hidden">
                  {logoUrl ? (
                    <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center p-1 shrink-0 shadow-md">
                      <img
                        src={logoUrl}
                        alt={minhaEmpresa?.nome_fantasia || 'Logo'}
                        className="w-full h-full object-contain"
                      />
                    </div>
                  ) : (
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0 shadow-md"
                      style={{ backgroundColor: corSecundaria }}
                    >
                      <Scale className="w-5 h-5" />
                    </div>
                  )}
                  <div className="truncate">
                    <span className="font-bold text-sm block leading-tight text-white truncate">
                      {minhaEmpresa?.nome_fantasia ||
                        minhaEmpresa?.razao_social ||
                        'Analise de Balanço'}
                    </span>
                    <span className="text-[10px] text-blue-200/80 uppercase tracking-wider font-semibold block truncate">
                      {minhaEmpresa?.razao_social ? 'Consultoria Oficial' : 'Consultoria'}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setMobileDrawerOpen(false)}
                  className="p-1 rounded-lg text-slate-300 hover:text-white hover:bg-white/10"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <nav className="mt-6 space-y-1.5 overflow-y-auto max-h-[calc(100vh-210px)] pr-1">
                {/* 1. Dashboard */}
                <NavLink
                  to="/dashboard"
                  onClick={() => setMobileDrawerOpen(false)}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    location.pathname === '/dashboard'
                      ? 'bg-white/15 text-white font-semibold shadow-inner'
                      : 'text-slate-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <LayoutDashboard className="w-4 h-4 text-blue-400" />
                  Dashboard
                </NavLink>

                {/* 2. Cadastros (Expansível / Colapsável) */}
                <div className="space-y-1">
                  <button
                    type="button"
                    onClick={() => setCadastrosOpen((prev) => !prev)}
                    style={
                      isCadastroActive
                        ? {
                            backgroundColor: `${corSecundaria}33`,
                            borderColor: `${corSecundaria}66`,
                          }
                        : undefined
                    }
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                      isCadastroActive
                        ? 'text-white font-semibold border'
                        : 'text-slate-300 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Folder
                        className={`w-4 h-4 ${isCadastroActive ? 'text-blue-300' : 'text-blue-400'}`}
                      />
                      <span>Cadastros</span>
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                        cadastrosOpen ? 'rotate-0' : '-rotate-90'
                      }`}
                    />
                  </button>

                  {/* Submenu Cadastros com transição suave */}
                  <div
                    className={`grid transition-[grid-template-rows,opacity] duration-200 ease-in-out ${
                      cadastrosOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                    }`}
                  >
                    <div className="overflow-hidden">
                      <div className="ml-3 pl-3 border-l border-blue-500/20 space-y-1 py-1">
                        {cadastroSubItems.map((sub) => {
                          const SubIcon = sub.icon
                          const isSubActive =
                            sub.path === '/empresas'
                              ? location.pathname.startsWith('/empresas')
                              : location.pathname === sub.path

                          return (
                            <NavLink
                              key={sub.path}
                              to={sub.path}
                              onClick={() => setMobileDrawerOpen(false)}
                              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                                isSubActive
                                  ? 'bg-white/15 text-white font-semibold shadow-xs'
                                  : 'text-slate-300 hover:text-white hover:bg-white/5'
                              }`}
                            >
                              <SubIcon
                                className={`w-3.5 h-3.5 ${
                                  isSubActive ? 'text-blue-300' : 'text-slate-400'
                                }`}
                              />
                              <span className="truncate">{sub.name}</span>
                            </NavLink>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Lançamentos */}
                <NavLink
                  to="/lancamentos"
                  onClick={() => setMobileDrawerOpen(false)}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    location.pathname === '/lancamentos'
                      ? 'bg-white/15 text-white font-semibold shadow-inner'
                      : 'text-slate-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <FileText className="w-4 h-4 text-blue-400" />
                  Lançamentos
                </NavLink>

                {/* 4. Financeiro (Expansível / Colapsável) */}
                <div className="space-y-1">
                  <button
                    type="button"
                    onClick={() => setFinanceiroOpen((prev) => !prev)}
                    style={
                      isFinanceiroActive
                        ? {
                            backgroundColor: `${corSecundaria}33`,
                            borderColor: `${corSecundaria}66`,
                          }
                        : undefined
                    }
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                      isFinanceiroActive
                        ? 'text-white font-semibold border'
                        : 'text-slate-300 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <DollarSign
                        className={`w-4 h-4 ${isFinanceiroActive ? 'text-emerald-300' : 'text-emerald-400'}`}
                      />
                      <span>Financeiro</span>
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                        financeiroOpen ? 'rotate-0' : '-rotate-90'
                      }`}
                    />
                  </button>

                  {/* Submenu Financeiro com transição suave */}
                  <div
                    className={`grid transition-[grid-template-rows,opacity] duration-200 ease-in-out ${
                      financeiroOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                    }`}
                  >
                    <div className="overflow-hidden">
                      <div className="ml-3 pl-3 border-l border-emerald-500/30 space-y-1 py-1">
                        {financeiroSubItems.map((sub) => {
                          const SubIcon = sub.icon
                          const isSubActive = location.pathname === sub.path

                          return (
                            <NavLink
                              key={sub.path}
                              to={sub.path}
                              onClick={() => setMobileDrawerOpen(false)}
                              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                                isSubActive
                                  ? 'bg-white/15 text-white font-semibold shadow-xs'
                                  : 'text-slate-300 hover:text-white hover:bg-white/5'
                              }`}
                            >
                              <SubIcon
                                className={`w-3.5 h-3.5 ${
                                  isSubActive ? 'text-emerald-300' : 'text-slate-400'
                                }`}
                              />
                              <span className="truncate">{sub.name}</span>
                            </NavLink>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Novo Grupo: Indicadores (Abaixo de Financeiro) */}
                <div className="space-y-1">
                  <button
                    type="button"
                    onClick={() => setIndicadoresOpen((prev) => !prev)}
                    style={
                      isIndicadoresActive
                        ? {
                            backgroundColor: `${corSecundaria}33`,
                            borderColor: `${corSecundaria}66`,
                          }
                        : undefined
                    }
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                      isIndicadoresActive
                        ? 'text-white font-semibold border'
                        : 'text-slate-300 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Gauge
                        className={`w-4 h-4 ${isIndicadoresActive ? 'text-blue-300' : 'text-blue-400'}`}
                      />
                      <span>Indicadores</span>
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                        indicadoresOpen ? 'rotate-0' : '-rotate-90'
                      }`}
                    />
                  </button>

                  {/* Submenu Indicadores com transição suave */}
                  <div
                    className={`grid transition-[grid-template-rows,opacity] duration-200 ease-in-out ${
                      indicadoresOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                    }`}
                  >
                    <div className="overflow-hidden">
                      <div className="ml-3 pl-3 border-l border-blue-500/30 space-y-1 py-1">
                        {indicadoresSubItems.map((sub) => {
                          const SubIcon = sub.icon
                          const isSubActive = location.pathname === sub.path

                          return (
                            <NavLink
                              key={sub.path}
                              to={sub.path}
                              onClick={() => setMobileDrawerOpen(false)}
                              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                                isSubActive
                                  ? 'bg-white/15 text-white font-semibold shadow-xs'
                                  : 'text-slate-300 hover:text-white hover:bg-white/5'
                              }`}
                            >
                              <SubIcon
                                className={`w-3.5 h-3.5 ${
                                  isSubActive ? 'text-blue-300' : 'text-slate-400'
                                }`}
                              />
                              <span className="truncate">{sub.name}</span>
                            </NavLink>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 5. Análise Tributária */}
                <NavLink
                  to="/analise-tributaria"
                  onClick={() => setMobileDrawerOpen(false)}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    location.pathname === '/analise-tributaria'
                      ? 'bg-white/15 text-white font-semibold shadow-inner'
                      : 'text-slate-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Calculator className="w-4 h-4 text-emerald-400" />
                  Análise Tributária
                </NavLink>

                {/* 6. Importação */}
                <NavLink
                  to="/importacao"
                  onClick={() => setMobileDrawerOpen(false)}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    location.pathname === '/importacao'
                      ? 'bg-white/15 text-white font-semibold shadow-inner'
                      : 'text-slate-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Upload className="w-4 h-4 text-blue-400" />
                  Importação
                </NavLink>
                {/* 5. Relatório Anual */}
                <NavLink
                  to="/relatorio-anual"
                  onClick={() => setMobileDrawerOpen(false)}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    location.pathname === '/relatorio-anual'
                      ? 'bg-white/15 text-white font-semibold shadow-inner'
                      : 'text-slate-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <FileText className="w-4 h-4 text-blue-400" />
                  Relatório Anual
                </NavLink>

                {/* 6. Relatórios */}
                <NavLink
                  to="/relatorios"
                  onClick={() => setMobileDrawerOpen(false)}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    location.pathname === '/relatorios'
                      ? 'bg-white/15 text-white font-semibold shadow-inner'
                      : 'text-slate-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <FileText className="w-4 h-4 text-blue-400" />
                  Relatórios
                </NavLink>
              </nav>
            </div>

            {/* Footer Drawer */}
            <div className="pt-4 border-t border-white/10 space-y-2">
              <button
                type="button"
                onClick={() => {
                  setMobileDrawerOpen(false)
                  navigate('/configuracoes')
                }}
                className="w-full flex items-center justify-between p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-left"
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <Avatar className="w-9 h-9 border border-white/20 shrink-0">
                    {user?.avatar && (
                      <AvatarImage src={pb.files.getURL(user, user.avatar)} alt={userName} />
                    )}
                    <AvatarFallback className="bg-blue-600 text-white font-semibold text-xs">
                      {userInitial}
                    </AvatarFallback>
                  </Avatar>
                  <div className="overflow-hidden">
                    <p className="text-sm font-semibold text-white truncate">{userName}</p>
                    <p className="text-xs text-slate-400 truncate">{userEmail}</p>
                  </div>
                </div>
                <Settings className="w-4 h-4 text-slate-400 shrink-0" />
              </button>
              <button
                onClick={() => {
                  logout()
                  navigate('/')
                }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-red-300 bg-red-950/40 hover:bg-red-900/50 rounded-lg border border-red-800/40 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sair do sistema
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Container with Sidebar */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar Tablet (60px) & Desktop (264px) */}
        <aside
          className="hidden md:flex flex-col justify-between text-white shrink-0 md:w-[60px] lg:w-[264px] transition-colors duration-200 z-30 select-none border-r border-white/10"
          style={{ backgroundColor: corPrimaria }}
        >
          <div>
            {/* Logo */}
            <div className="h-16 flex items-center px-3.5 lg:px-5 border-b border-white/10">
              <div className="flex items-center gap-3 overflow-hidden">
                {logoUrl ? (
                  <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center p-1 shrink-0 shadow-md overflow-hidden">
                    <img
                      src={logoUrl}
                      alt={minhaEmpresa?.nome_fantasia || 'Logo'}
                      className="w-full h-full object-contain"
                    />
                  </div>
                ) : (
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0 shadow-md"
                    style={{ backgroundColor: corSecundaria }}
                  >
                    <Scale className="w-5 h-5" />
                  </div>
                )}
                <div className="hidden lg:block truncate">
                  <span className="font-bold text-base text-white tracking-tight leading-tight block truncate">
                    {minhaEmpresa?.nome_fantasia ||
                      minhaEmpresa?.razao_social ||
                      'Analise de Balanço'}
                  </span>
                  <span className="text-[10px] text-blue-200/80 uppercase tracking-widest font-semibold block truncate">
                    {minhaEmpresa?.razao_social ? 'Consultoria Oficial' : 'Consultoria Financeira'}
                  </span>
                </div>
              </div>
            </div>

            {/* Nav Desktop / Tablet */}
            <nav className="p-2 lg:p-3 space-y-1.5 mt-2 overflow-y-auto max-h-[calc(100vh-170px)]">
              {/* 1. Dashboard */}
              <div>
                <div className="lg:hidden">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <NavLink
                        to="/dashboard"
                        className={`flex items-center justify-center p-2.5 rounded-xl text-sm font-medium transition-all ${
                          location.pathname === '/dashboard'
                            ? 'bg-white/15 text-white font-semibold shadow-sm'
                            : 'text-slate-300 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <LayoutDashboard
                          className={`w-5 h-5 ${
                            location.pathname === '/dashboard' ? 'text-blue-300' : 'text-slate-400'
                          }`}
                        />
                      </NavLink>
                    </TooltipTrigger>
                    <TooltipContent
                      side="right"
                      className="bg-[#0B1F3A] text-white border-blue-900"
                    >
                      Dashboard
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="hidden lg:block">
                  <NavLink
                    to="/dashboard"
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      location.pathname === '/dashboard'
                        ? 'bg-white/15 text-white font-semibold shadow-sm'
                        : 'text-slate-300 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <LayoutDashboard
                      className={`w-5 h-5 shrink-0 ${
                        location.pathname === '/dashboard' ? 'text-blue-300' : 'text-slate-400'
                      }`}
                    />
                    <span className="truncate">Dashboard</span>
                  </NavLink>
                </div>
              </div>

              {/* 2. Cadastros - Grupo com Subitens */}
              <div className="space-y-1">
                {/* Visualização Tablet */}
                <div className="lg:hidden">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <NavLink
                        to="/empresas"
                        className={`w-full flex items-center justify-center p-2.5 rounded-xl text-sm font-medium transition-all ${
                          isCadastroActive
                            ? 'bg-blue-600/30 text-white font-semibold shadow-sm border border-blue-500/40'
                            : 'text-slate-300 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <Folder
                          className={`w-5 h-5 ${isCadastroActive ? 'text-blue-300' : 'text-slate-400'}`}
                        />
                      </NavLink>
                    </TooltipTrigger>
                    <TooltipContent
                      side="right"
                      className="bg-[#0B1F3A] text-white border-blue-900"
                    >
                      Cadastros (Empresas, Centros, etc.)
                    </TooltipContent>
                  </Tooltip>
                </div>

                {/* Visualização Desktop (Expansível / Colapsável com subitens) */}
                <div className="hidden lg:block">
                  <button
                    type="button"
                    onClick={() => setCadastrosOpen((prev) => !prev)}
                    style={
                      isCadastroActive
                        ? {
                            backgroundColor: `${corSecundaria}33`,
                            borderColor: `${corSecundaria}66`,
                          }
                        : undefined
                    }
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                      isCadastroActive
                        ? 'text-white font-semibold border'
                        : 'text-slate-300 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Folder
                        className={`w-5 h-5 shrink-0 ${
                          isCadastroActive ? 'text-blue-300' : 'text-slate-400'
                        }`}
                      />
                      <span className="truncate font-medium">Cadastros</span>
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 shrink-0 text-slate-400 transition-transform duration-200 ${
                        cadastrosOpen ? 'rotate-0' : '-rotate-90'
                      }`}
                    />
                  </button>

                  {/* Submenu com animação suave via grid template rows */}
                  <div
                    className={`grid transition-[grid-template-rows,opacity] duration-200 ease-in-out ${
                      cadastrosOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                    }`}
                  >
                    <div className="overflow-hidden">
                      <div className="ml-4 pl-3 border-l border-blue-500/20 space-y-1 py-1 mt-1">
                        {cadastroSubItems.map((sub) => {
                          const SubIcon = sub.icon
                          const isSubActive =
                            sub.path === '/empresas'
                              ? location.pathname.startsWith('/empresas')
                              : location.pathname === sub.path

                          return (
                            <NavLink
                              key={sub.path}
                              to={sub.path}
                              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                                isSubActive
                                  ? 'bg-white/15 text-white font-semibold shadow-xs'
                                  : 'text-slate-300 hover:text-white hover:bg-white/5'
                              }`}
                            >
                              <SubIcon
                                className={`w-4 h-4 shrink-0 ${
                                  isSubActive ? 'text-blue-300' : 'text-slate-400'
                                }`}
                              />
                              <span className="truncate">{sub.name}</span>
                            </NavLink>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. Lançamentos */}
              <div>
                <div className="lg:hidden">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <NavLink
                        to="/lancamentos"
                        className={`flex items-center justify-center p-2.5 rounded-xl text-sm font-medium transition-all ${
                          location.pathname === '/lancamentos'
                            ? 'bg-white/15 text-white font-semibold shadow-sm'
                            : 'text-slate-300 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <FileText
                          className={`w-5 h-5 ${
                            location.pathname === '/lancamentos'
                              ? 'text-blue-300'
                              : 'text-slate-400'
                          }`}
                        />
                      </NavLink>
                    </TooltipTrigger>
                    <TooltipContent
                      side="right"
                      className="bg-[#0B1F3A] text-white border-blue-900"
                    >
                      Lançamentos
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="hidden lg:block">
                  <NavLink
                    to="/lancamentos"
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      location.pathname === '/lancamentos'
                        ? 'bg-white/15 text-white font-semibold shadow-sm'
                        : 'text-slate-300 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <FileText
                      className={`w-5 h-5 shrink-0 ${
                        location.pathname === '/lancamentos' ? 'text-blue-300' : 'text-slate-400'
                      }`}
                    />
                    <span className="truncate">Lançamentos</span>
                  </NavLink>
                </div>
              </div>

              {/* 4. Financeiro - Grupo com Subitens (entre Lançamentos e Importação) */}
              <div className="space-y-1">
                {/* Visualização Tablet */}
                <div className="lg:hidden">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <NavLink
                        to="/financeiro"
                        className={`w-full flex items-center justify-center p-2.5 rounded-xl text-sm font-medium transition-all ${
                          isFinanceiroActive
                            ? 'bg-emerald-600/30 text-white font-semibold shadow-sm border border-emerald-500/40'
                            : 'text-slate-300 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <DollarSign
                          className={`w-5 h-5 ${isFinanceiroActive ? 'text-emerald-300' : 'text-slate-400'}`}
                        />
                      </NavLink>
                    </TooltipTrigger>
                    <TooltipContent
                      side="right"
                      className="bg-[#0B1F3A] text-white border-blue-900"
                    >
                      Financeiro (Gerador, Baixa de Recebíveis)
                    </TooltipContent>
                  </Tooltip>
                </div>

                {/* Visualização Desktop (Expansível / Colapsável com subitens) */}
                <div className="hidden lg:block">
                  <button
                    type="button"
                    onClick={() => setFinanceiroOpen((prev) => !prev)}
                    style={
                      isFinanceiroActive
                        ? {
                            backgroundColor: `${corSecundaria}33`,
                            borderColor: `${corSecundaria}66`,
                          }
                        : undefined
                    }
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                      isFinanceiroActive
                        ? 'text-white font-semibold border'
                        : 'text-slate-300 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <DollarSign
                        className={`w-5 h-5 shrink-0 ${
                          isFinanceiroActive ? 'text-emerald-300' : 'text-emerald-400'
                        }`}
                      />
                      <span className="truncate font-medium">Financeiro</span>
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 shrink-0 text-slate-400 transition-transform duration-200 ${
                        financeiroOpen ? 'rotate-0' : '-rotate-90'
                      }`}
                    />
                  </button>

                  {/* Submenu com animação suave via grid template rows */}
                  <div
                    className={`grid transition-[grid-template-rows,opacity] duration-200 ease-in-out ${
                      financeiroOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                    }`}
                  >
                    <div className="overflow-hidden">
                      <div className="ml-4 pl-3 border-l border-emerald-500/30 space-y-1 py-1 mt-1">
                        {financeiroSubItems.map((sub) => {
                          const SubIcon = sub.icon
                          const isSubActive = location.pathname === sub.path

                          return (
                            <NavLink
                              key={sub.path}
                              to={sub.path}
                              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                                isSubActive
                                  ? 'bg-white/15 text-white font-semibold shadow-xs'
                                  : 'text-slate-300 hover:text-white hover:bg-white/5'
                              }`}
                            >
                              <SubIcon
                                className={`w-4 h-4 shrink-0 ${
                                  isSubActive ? 'text-emerald-300' : 'text-slate-400'
                                }`}
                              />
                              <span className="truncate">{sub.name}</span>
                            </NavLink>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Novo Grupo: Indicadores - Abaixo de Financeiro */}
              <div className="space-y-1">
                {/* Visualização Tablet */}
                <div className="lg:hidden">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <NavLink
                        to="/indicadores/painel"
                        className={`w-full flex items-center justify-center p-2.5 rounded-xl text-sm font-medium transition-all ${
                          isIndicadoresActive
                            ? 'bg-blue-600/30 text-white font-semibold shadow-sm border border-blue-500/40'
                            : 'text-slate-300 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <Gauge
                          className={`w-5 h-5 ${isIndicadoresActive ? 'text-blue-300' : 'text-slate-400'}`}
                        />
                      </NavLink>
                    </TooltipTrigger>
                    <TooltipContent
                      side="right"
                      className="bg-[#0B1F3A] text-white border-blue-900"
                    >
                      Painel de Indicadores & Benchmarks
                    </TooltipContent>
                  </Tooltip>
                </div>

                {/* Visualização Desktop (Expansível / Colapsável com subitens) */}
                <div className="hidden lg:block">
                  <button
                    type="button"
                    onClick={() => setIndicadoresOpen((prev) => !prev)}
                    style={
                      isIndicadoresActive
                        ? {
                            backgroundColor: `${corSecundaria}33`,
                            borderColor: `${corSecundaria}66`,
                          }
                        : undefined
                    }
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                      isIndicadoresActive
                        ? 'text-white font-semibold border'
                        : 'text-slate-300 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Gauge
                        className={`w-5 h-5 shrink-0 ${
                          isIndicadoresActive ? 'text-blue-300' : 'text-blue-400'
                        }`}
                      />
                      <span className="truncate font-medium">Indicadores</span>
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 shrink-0 text-slate-400 transition-transform duration-200 ${
                        indicadoresOpen ? 'rotate-0' : '-rotate-90'
                      }`}
                    />
                  </button>

                  {/* Submenu com animação suave via grid template rows */}
                  <div
                    className={`grid transition-[grid-template-rows,opacity] duration-200 ease-in-out ${
                      indicadoresOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                    }`}
                  >
                    <div className="overflow-hidden">
                      <div className="ml-4 pl-3 border-l border-blue-500/30 space-y-1 py-1 mt-1">
                        {indicadoresSubItems.map((sub) => {
                          const SubIcon = sub.icon
                          const isSubActive = location.pathname === sub.path

                          return (
                            <NavLink
                              key={sub.path}
                              to={sub.path}
                              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                                isSubActive
                                  ? 'bg-white/15 text-white font-semibold shadow-xs'
                                  : 'text-slate-300 hover:text-white hover:bg-white/5'
                              }`}
                            >
                              <SubIcon
                                className={`w-4 h-4 shrink-0 ${
                                  isSubActive ? 'text-blue-300' : 'text-slate-400'
                                }`}
                              />
                              <span className="truncate">{sub.name}</span>
                            </NavLink>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 5. Análise Tributária (Nível Superior entre Financeiro e Importação) */}
              <div>
                <div className="lg:hidden">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <NavLink
                        to="/analise-tributaria"
                        className={`flex items-center justify-center p-2.5 rounded-xl text-sm font-medium transition-all ${
                          location.pathname === '/analise-tributaria'
                            ? 'bg-white/15 text-white font-semibold shadow-sm'
                            : 'text-slate-300 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <Calculator
                          className={`w-5 h-5 ${
                            location.pathname === '/analise-tributaria'
                              ? 'text-emerald-300'
                              : 'text-slate-400'
                          }`}
                        />
                      </NavLink>
                    </TooltipTrigger>
                    <TooltipContent
                      side="right"
                      className="bg-[#0B1F3A] text-white border-blue-900"
                    >
                      Análise Tributária
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="hidden lg:block">
                  <NavLink
                    to="/analise-tributaria"
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      location.pathname === '/analise-tributaria'
                        ? 'bg-white/15 text-white font-semibold shadow-sm'
                        : 'text-slate-300 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Calculator
                      className={`w-5 h-5 shrink-0 ${
                        location.pathname === '/analise-tributaria'
                          ? 'text-emerald-300'
                          : 'text-slate-400'
                      }`}
                    />
                    <span className="truncate">Análise Tributária</span>
                  </NavLink>
                </div>
              </div>

              {/* 6. Importação */}
              <div>
                <div className="lg:hidden">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <NavLink
                        to="/importacao"
                        className={`flex items-center justify-center p-2.5 rounded-xl text-sm font-medium transition-all ${
                          location.pathname === '/importacao'
                            ? 'bg-white/15 text-white font-semibold shadow-sm'
                            : 'text-slate-300 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <Upload
                          className={`w-5 h-5 ${
                            location.pathname === '/importacao' ? 'text-blue-300' : 'text-slate-400'
                          }`}
                        />
                      </NavLink>
                    </TooltipTrigger>
                    <TooltipContent
                      side="right"
                      className="bg-[#0B1F3A] text-white border-blue-900"
                    >
                      Importação
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="hidden lg:block">
                  <NavLink
                    to="/importacao"
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      location.pathname === '/importacao'
                        ? 'bg-white/15 text-white font-semibold shadow-sm'
                        : 'text-slate-300 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Upload
                      className={`w-5 h-5 shrink-0 ${
                        location.pathname === '/importacao' ? 'text-blue-300' : 'text-slate-400'
                      }`}
                    />
                    <span className="truncate">Importação</span>
                  </NavLink>
                </div>
              </div>
              {/* 5. Relatório Anual */}
              <div>
                <div className="lg:hidden">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <NavLink
                        to="/relatorio-anual"
                        className={`flex items-center justify-center p-2.5 rounded-xl text-sm font-medium transition-all ${
                          location.pathname === '/relatorio-anual'
                            ? 'bg-white/15 text-white font-semibold shadow-sm'
                            : 'text-slate-300 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <FileText
                          className={`w-5 h-5 ${
                            location.pathname === '/relatorio-anual'
                              ? 'text-blue-300'
                              : 'text-slate-400'
                          }`}
                        />
                      </NavLink>
                    </TooltipTrigger>
                    <TooltipContent
                      side="right"
                      className="bg-[#0B1F3A] text-white border-blue-900"
                    >
                      Relatório Anual
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="hidden lg:block">
                  <NavLink
                    to="/relatorio-anual"
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      location.pathname === '/relatorio-anual'
                        ? 'bg-white/15 text-white font-semibold shadow-sm'
                        : 'text-slate-300 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <FileText
                      className={`w-5 h-5 shrink-0 ${
                        location.pathname === '/relatorio-anual'
                          ? 'text-blue-300'
                          : 'text-slate-400'
                      }`}
                    />
                    <span className="truncate">Relatório Anual</span>
                  </NavLink>
                </div>
              </div>

              {/* 6. Relatórios */}
              <div>
                <div className="lg:hidden">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <NavLink
                        to="/relatorios"
                        className={`flex items-center justify-center p-2.5 rounded-xl text-sm font-medium transition-all ${
                          location.pathname === '/relatorios'
                            ? 'bg-white/15 text-white font-semibold shadow-sm'
                            : 'text-slate-300 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <FileText
                          className={`w-5 h-5 ${
                            location.pathname === '/relatorios' ? 'text-blue-300' : 'text-slate-400'
                          }`}
                        />
                      </NavLink>
                    </TooltipTrigger>
                    <TooltipContent
                      side="right"
                      className="bg-[#0B1F3A] text-white border-blue-900"
                    >
                      Relatórios
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="hidden lg:block">
                  <NavLink
                    to="/relatorios"
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      location.pathname === '/relatorios'
                        ? 'bg-white/15 text-white font-semibold shadow-sm'
                        : 'text-slate-300 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <FileText
                      className={`w-5 h-5 shrink-0 ${
                        location.pathname === '/relatorios' ? 'text-blue-300' : 'text-slate-400'
                      }`}
                    />
                    <span className="truncate">Relatórios</span>
                  </NavLink>
                </div>
              </div>
            </nav>
          </div>

          {/* User Profile & Logout Bottom */}
          <div className="p-2 lg:p-3 border-t border-white/10">
            {/* Desktop User Card */}
            <div className="hidden lg:flex items-center justify-between p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
              <button
                type="button"
                onClick={() => navigate('/configuracoes')}
                className="flex items-center gap-2.5 overflow-hidden text-left flex-1 hover:opacity-90"
                title="Configurações da Conta"
              >
                <Avatar
                  className="w-8 h-8 border border-white/20 shrink-0"
                  style={{ backgroundColor: corSecundaria }}
                >
                  {user?.avatar && (
                    <AvatarImage src={pb.files.getURL(user, user.avatar)} alt={userName} />
                  )}
                  <AvatarFallback
                    className="text-white font-semibold text-xs"
                    style={{ backgroundColor: corSecundaria }}
                  >
                    {userInitial}
                  </AvatarFallback>
                </Avatar>
                <div className="overflow-hidden">
                  <p className="text-xs font-semibold text-white truncate leading-tight">
                    {userName}
                  </p>
                  <p className="text-[11px] text-blue-200/70 truncate">{userEmail}</p>
                </div>
              </button>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => navigate('/configuracoes')}
                  className={`p-1.5 rounded-lg transition-colors ${
                    location.pathname === '/configuracoes'
                      ? 'bg-white/20 text-blue-300'
                      : 'text-slate-400 hover:text-blue-300 hover:bg-white/10'
                  }`}
                  title="Configurações da Conta"
                >
                  <Settings className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    logout()
                    navigate('/')
                  }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-300 hover:bg-red-950/50 transition-colors"
                  title="Sair do sistema"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Tablet Minimal Profile / Logout */}
            <div className="lg:hidden flex flex-col items-center gap-2 py-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => navigate('/configuracoes')}
                    className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                      location.pathname === '/configuracoes'
                        ? 'bg-white/20 text-blue-300'
                        : 'text-slate-300 hover:text-blue-300 hover:bg-white/10'
                    }`}
                  >
                    <Settings className="w-5 h-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-[#0B1F3A] text-white border-blue-900">
                  Configurações
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => {
                      logout()
                      navigate('/')
                    }}
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-300 hover:text-red-300 hover:bg-white/10 transition-colors"
                  >
                    <LogOut className="w-5 h-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-[#0B1F3A] text-white border-blue-900">
                  Sair ({userName})
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          {/* Header de Página com Título e Seletores Globais */}
          {showHeaderFilters && (
            <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 sticky top-0 z-20 shadow-xs">
              <div>
                <h1 className="text-xl font-bold text-[#0B1F3A] tracking-tight">
                  {location.pathname === '/dashboard' && 'Dashboard Financeiro'}
                  {location.pathname === '/relatorios' && 'Relatórios e Pareceres'}
                  {location.pathname === '/relatorio-anual' && 'Relatório Consolidado Anual'}
                  {location.pathname === '/analise-tributaria' &&
                    'Análise Tributária e Planejamento'}
                  {location.pathname.startsWith('/empresas/') && 'Análise da Empresa'}
                </h1>
                <p className="text-xs text-[#5B6B7F]">
                  {location.pathname === '/dashboard' &&
                    'Visão consolidada de indicadores e evolução patrimonial'}
                  {location.pathname === '/relatorios' &&
                    'Gere relatórios executivos para impressão ou exportação'}
                  {location.pathname === '/relatorio-anual' &&
                    'Visão consolidada de 12 meses por tipo de conta com exportação CSV'}
                  {location.pathname === '/analise-tributaria' &&
                    'Comparativo entre Simples Nacional, Lucro Presumido e Lucro Real'}
                  {location.pathname.startsWith('/empresas/') &&
                    'Diagnóstico detalhado de Balanço, DRE e Indicadores'}
                </p>{' '}
              </div>

              {/* Seletores Globais Empresa e Ano */}
              <div className="flex items-center gap-2.5 flex-wrap">
                {/* Seletor Empresa */}
                <div className="flex items-center gap-1.5 bg-[#F5F7FA] border border-slate-200 rounded-lg px-2.5 py-1 text-xs">
                  <Building className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <Select
                    value={selectedEmpresaId}
                    onValueChange={(id) => {
                      setSelectedEmpresaId(id)
                      if (
                        location.pathname.startsWith('/empresas/') &&
                        location.pathname !== `/empresas/${id}`
                      ) {
                        navigate(`/empresas/${id}`)
                      }
                    }}
                  >
                    <SelectTrigger className="h-7 border-none shadow-none bg-transparent text-xs font-semibold text-slate-800 p-0 focus:ring-0 w-[180px] sm:w-[220px]">
                      <SelectValue placeholder="Selecione a empresa" />
                    </SelectTrigger>
                    <SelectContent>
                      {empresas.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id} className="text-xs">
                          {emp.nome} ({emp.segmento})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Seletor Ano */}
                <div className="flex items-center gap-1.5 bg-[#F5F7FA] border border-slate-200 rounded-lg px-2.5 py-1 text-xs">
                  <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <Select
                    value={String(selectedAno)}
                    onValueChange={(val) => setSelectedAno(Number(val))}
                  >
                    <SelectTrigger className="h-7 border-none shadow-none bg-transparent text-xs font-semibold text-slate-800 p-0 focus:ring-0 w-[75px]">
                      <SelectValue placeholder="Ano" />
                    </SelectTrigger>
                    <SelectContent>
                      {anosDisponiveis.map((ano) => (
                        <SelectItem key={ano} value={String(ano)} className="text-xs">
                          {ano}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {/* Page Body */}
          <main className="flex-1 p-4 sm:p-6 min-h-0 bg-[#F5F7FA]">
            <Outlet />
          </main>

          {/* Footer */}
          <footer className="bg-white border-t border-slate-200 py-3.5 px-6 text-center text-xs text-[#5B6B7F] flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>Analise de Balanço · Consultoria Financeira</span>
            <span>&copy; {new Date().getFullYear()} Todos os direitos reservados.</span>
          </footer>
        </div>
      </div>

      {/* Modal de Perfil e Preferências de Alertas */}
      <ModalPerfil open={modalPerfilOpen} onOpenChange={setModalPerfilOpen} />
    </div>
  )
}
