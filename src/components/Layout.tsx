import React, { useState } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useFilter } from '@/contexts/FilterContext'
import { useMinhaEmpresa } from '@/contexts/MinhaEmpresaContext'
import { ModalPerfil } from '@/components/ModalPerfil'
import {
  Scale,
  LayoutDashboard,
  BarChart3,
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
  Users,
  Shield,
  Settings,
  DollarSign,
  CheckCircle2,
  Calculator,
  Gauge,
  Activity,
  TrendingDown,
  TrendingUp,
  FileCheck2,
  Coins,
  Clock,
  Flame,
  Package,
  Layers,
  ClipboardList,
  Percent,
  Network,
  Target,
  Compass,
  User,
  Bell,
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import pb from '@/lib/pocketbase/client'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SelectEmpresaOuGrupoItems } from '@/components/SelectEmpresaOuGrupoItems'

export default function Layout() {
  const { user, logout, isAuthenticated, isLoading, isAdmin } = useAuth()
  const {
    empresas,
    todasEntidades,
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

  const userInitial = user?.name ? user.name.charAt(0).toUpperCase() : 'U'
  const userName = user?.name || 'Consultor Financeiro'
  const userEmail = user?.email || 'usuario@sistema.com'
  const userRole =
    user?.role === 'admin'
      ? 'Administrador'
      : user?.role === 'financeiro'
        ? 'Financeiro'
        : user?.role === 'comercial'
          ? 'Comercial'
          : 'Empresa'
  const isUserAdmin = user?.role === 'admin'
  const isUserFinanceiro = user?.role === 'financeiro'
  const isUserComercial = user?.role === 'comercial'

  // Itens do submenu Cadastros
  const rawCadastroSubItems = [
    {
      name: 'Empresas',
      path: '/empresas',
      icon: Building2,
      adminOnly: false,
      hideFinanceiro: true,
    },
    {
      name: 'Grupo Empresarial',
      path: '/cadastro/grupos-empresariais',
      icon: Network,
      adminOnly: false,
      hideFinanceiro: true,
    },
    {
      name: 'Centros de Custo',
      path: '/centros',
      icon: PieChart,
      adminOnly: false,
      hideFinanceiro: false,
    },
    {
      name: 'Tipos de Despesas',
      path: '/tipos-despesas',
      icon: Tags,
      adminOnly: false,
      hideFinanceiro: false,
    },
    {
      name: 'Cadastro de Contas',
      path: '/contas',
      icon: BookOpen,
      adminOnly: false,
      hideFinanceiro: false,
    },
    {
      name: 'Plano de Contas',
      path: '/plano-contas',
      icon: FolderTree,
      adminOnly: false,
      hideFinanceiro: false,
    },
    {
      name: 'Minha Empresa',
      path: '/minha-empresa',
      icon: Building,
      adminOnly: false,
      hideFinanceiro: false,
    },
    {
      name: 'Usuários & Permissões',
      path: '/admin/usuarios',
      icon: Users,
      adminOnly: true,
      hideFinanceiro: true,
    },
    {
      name: 'Auditoria de Segurança',
      path: '/admin/auditoria',
      icon: Shield,
      adminOnly: true,
      hideFinanceiro: true,
    },
  ]
  const cadastroSubItems = rawCadastroSubItems.filter((item) => {
    if (item.adminOnly && !isAdmin) return false
    if (isUserFinanceiro && item.hideFinanceiro) return false
    if (isUserComercial && item.path !== '/minha-empresa') return false
    return true
  })

  // Itens do submenu Formação de Preço - Custo
  const formacaoPrecoSubItems = [
    { name: 'Cadastro de Produtos', path: '/formacao-preco/produtos', icon: Package },
    { name: 'Cadastro de Matéria Prima', path: '/formacao-preco/materia-prima', icon: Layers },
    {
      name: 'Cadastro da Ficha Técnica',
      path: '/formacao-preco/fichas-tecnicas',
      icon: ClipboardList,
    },
    {
      name: 'Impostos',
      path: '/formacao-preco/impostos',
      icon: Percent,
    },
    {
      name: 'Simulador de Preços',
      path: '/formacao-preco/simulador',
      icon: Calculator,
    },
  ]

  const isFormacaoPrecoActive = location.pathname.startsWith('/formacao-preco')

  const isCadastroActive =
    (location.pathname.startsWith('/empresas') && !location.search.includes('novo=balanco-dre')) ||
    location.pathname.startsWith('/cadastro/grupos-empresariais') ||
    location.pathname.startsWith('/centros') ||
    location.pathname.startsWith('/tipos-despesas') ||
    location.pathname.startsWith('/contas') ||
    location.pathname.startsWith('/plano-contas') ||
    location.pathname === '/minha-empresa' ||
    location.pathname.startsWith('/admin/usuarios') ||
    location.pathname.startsWith('/admin/auditoria')

  // Atalho Balanço e DRE destino
  const balancoDreUrl = selectedEmpresaId
    ? `/empresas/${selectedEmpresaId}?aba=comparativo-mensal&novo=balanco-dre`
    : '/empresas'

  const isLancamentosActive =
    location.pathname === '/lancamentos' ||
    (location.pathname.startsWith('/empresas') && location.search.includes('novo=balanco-dre'))

  // Itens do submenu Financeiro (Comercial não vê tela geral /financeiro)
  const rawFinanceiroSubItems = [
    { name: 'Financeiro', path: '/financeiro', icon: Calendar, hideComercial: true },
    { name: 'Baixa dos Recebíveis', path: '/baixa-recebiveis', icon: CheckCircle2 },
    { name: 'Contratos', path: '/contratos', icon: FileText },
    { name: 'Emissor NFS-e Nacional', path: '/notas-fiscais', icon: FileCheck2 },
  ]
  const financeiroSubItems = rawFinanceiroSubItems.filter((item) => {
    if (isUserComercial && item.hideComercial) return false
    return true
  })

  const isDashboardActive =
    location.pathname === '/dashboard' ||
    location.pathname === '/dashboard-bi' ||
    location.pathname === '/bi'

  // Subitens de Dashboard (Dashboard Geral e Dashboard BI interativo para apresentação)
  const rawDashboardSubItems = [
    {
      name: 'Dashboard Geral',
      path: '/dashboard',
      icon: LayoutDashboard,
      descricao: 'Visão executiva geral e evolução patrimonial',
    },
    {
      name: 'Dashboard BI (Apresentação)',
      path: '/dashboard-bi',
      icon: BarChart3,
      descricao: 'BI interativo de indicadores, gráficos e drill-down',
      destaque: true,
    },
  ]
  const dashboardSubItems = rawDashboardSubItems.filter(() => {
    // Apenas Admin e Empresa têm acesso ao BI (Financeiro e Comercial bloqueados)
    if (isUserFinanceiro || isUserComercial) {
      return false
    }
    return true
  })

  const isFinanceiroActive =
    location.pathname === '/financeiro' ||
    location.pathname === '/baixa-recebiveis' ||
    location.pathname === '/contratos' ||
    location.pathname === '/notas-fiscais'

  // Itens do submenu Indicadores (Financeiro não vê Valuation)
  const rawIndicadoresSubItems = [
    { name: 'Painel & Benchmarks', path: '/indicadores/painel', icon: Gauge, hideFinanceiro: true },
    {
      name: 'Indicadores de Liquidez',
      path: '/indicadores/liquidez',
      icon: Activity,
      hideFinanceiro: true,
    },
    {
      name: 'Análise do Capital de Giro',
      path: '/indicadores/capital-giro',
      icon: Coins,
      hideFinanceiro: true,
    },
    {
      name: 'Indicadores de Endividamento',
      path: '/indicadores/endividamento',
      icon: TrendingDown,
      hideFinanceiro: true,
    },
    {
      name: 'Indicadores de Rentabilidade',
      path: '/indicadores/rentabilidade',
      icon: TrendingUp,
      hideFinanceiro: true,
    },
    {
      name: 'Indicadores de Estrutura de Capital',
      path: '/indicadores/estrutura-capital',
      icon: Building2,
      hideFinanceiro: true,
    },
    {
      name: 'EBITDA',
      path: '/indicadores/ebitda',
      icon: TrendingUp,
      hideFinanceiro: true,
    },
    {
      name: 'Eficiência Operacional',
      path: '/indicadores/eficiencia-operacional',
      icon: Clock,
      hideFinanceiro: true,
    },
    {
      name: 'Econômicos (análise mais avançada)',
      path: '/indicadores/economicos',
      icon: TrendingUp,
      hideFinanceiro: true,
    },
    {
      name: 'Valuation',
      path: '/indicadores/valuation',
      icon: TrendingUp,
      hideFinanceiro: true,
    },
    {
      name: 'Ponto de Equilíbrio',
      path: '/indicadores/ponto-equilibrio',
      icon: Scale,
      hideFinanceiro: true,
    },
    {
      name: 'Kanitz (Insolvência)',
      path: '/indicadores/kanitz',
      icon: Flame,
      hideFinanceiro: true,
    },
  ]
  const indicadoresSubItems = rawIndicadoresSubItems.filter(
    (item) => !isUserFinanceiro || !item.hideFinanceiro,
  )

  const isIndicadoresActive = location.pathname.startsWith('/indicadores')

  // Itens do submenu Planejamento (Balanced Scorecard)
  const planejamentoSubItems = [
    {
      name: 'Balanced Scorecard',
      path: '/planejamento/bsc',
      icon: Target,
    },
  ]
  const isPlanejamentoActive = location.pathname.startsWith('/planejamento')

  // Grupos móveis (drawer) expansível/colapsável
  const [dashboardOpen, setDashboardOpen] = useState(isDashboardActive)
  const [cadastrosOpen, setCadastrosOpen] = useState(isCadastroActive)
  const [lancamentosOpen, setLancamentosOpen] = useState<boolean>(isLancamentosActive || true)
  const [financeiroOpen, setFinanceiroOpen] = useState(isFinanceiroActive)
  const [formacaoPrecoOpen, setFormacaoPrecoOpen] = useState<boolean>(isFormacaoPrecoActive || true)
  const [indicadoresOpen, setIndicadoresOpen] = useState<boolean>(isIndicadoresActive || true)
  const [planejamentoOpen, setPlanejamentoOpen] = useState<boolean>(isPlanejamentoActive || true)

  React.useEffect(() => {
    if (isDashboardActive) setDashboardOpen(true)
  }, [isDashboardActive])

  React.useEffect(() => {
    if (isCadastroActive) setCadastrosOpen(true)
  }, [isCadastroActive])

  React.useEffect(() => {
    if (isLancamentosActive) setLancamentosOpen(true)
  }, [isLancamentosActive])

  React.useEffect(() => {
    if (isFinanceiroActive) setFinanceiroOpen(true)
  }, [isFinanceiroActive])

  React.useEffect(() => {
    if (isFormacaoPrecoActive) setFormacaoPrecoOpen(true)
  }, [isFormacaoPrecoActive])

  React.useEffect(() => {
    if (isIndicadoresActive) setIndicadoresOpen(true)
  }, [isIndicadoresActive])

  React.useEffect(() => {
    if (isPlanejamentoActive) setPlanejamentoOpen(true)
  }, [isPlanejamentoActive])

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

  const showHeaderFilters =
    location.pathname === '/dashboard' ||
    location.pathname === '/dashboard-bi' ||
    location.pathname === '/bi' ||
    location.pathname === '/relatorios' ||
    location.pathname === '/relatorio-anual' ||
    location.pathname === '/agente-ia' ||
    location.pathname === '/analise-tributaria' ||
    location.pathname === '/planejamento/bsc' ||
    location.pathname === '/notas-fiscais' ||
    location.pathname.startsWith('/empresas/') ||
    location.pathname.startsWith('/formacao-preco')

  return (
    <div className="min-h-screen bg-[#F5F7FA] flex flex-col antialiased text-slate-800">
      {/* ========================================================
          BARRA SUPERIOR HORIZONTAL (TOPBAR)
          Em mobile (< 768px): modo compacto com hambúrguer
          Em tablet e desktop (>= 768px): barra horizontal completa com menus dropdown
      ======================================================== */}
      <header
        className="sticky top-0 z-40 text-white border-b border-white/10 shadow-md transition-colors"
        style={{ backgroundColor: corPrimaria }}
      >
        <div className="w-full px-3 lg:px-5">
          <div className="flex items-center justify-between h-14 md:h-16 gap-2 md:gap-4">
            {/* LADO ESQUERDO: Botão Mobile Hambúrguer + Logotipo e Nome */}
            <div className="flex items-center gap-2 md:gap-3 shrink-0">
              {/* Hambúrguer apenas em mobile */}
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(true)}
                className="md:hidden p-2 -ml-1 rounded-lg text-slate-200 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Abrir menu de navegação"
              >
                <Menu className="w-5 h-5" />
              </button>

              {/* Logotipo clicável (leva ao dashboard ou home) */}
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="flex items-center gap-2.5 text-left group focus:outline-hidden"
              >
                {logoUrl ? (
                  <div className="w-8 h-8 md:w-9 md:h-9 rounded-xl bg-white/10 flex items-center justify-center p-1 shrink-0 shadow-xs overflow-hidden">
                    <img
                      src={logoUrl}
                      alt={minhaEmpresa?.nome_fantasia || 'Logo'}
                      className="w-full h-full object-contain"
                    />
                  </div>
                ) : (
                  <div
                    className="w-8 h-8 md:w-9 md:h-9 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs"
                    style={{ backgroundColor: corSecundaria }}
                  >
                    <Scale className="w-4 h-4 md:w-5 md:h-5" />
                  </div>
                )}
                <div className="truncate max-w-[150px] sm:max-w-[190px] xl:max-w-[220px]">
                  <span className="font-bold text-sm md:text-base text-white tracking-tight leading-tight block truncate group-hover:text-blue-200 transition-colors">
                    {minhaEmpresa?.nome_fantasia ||
                      minhaEmpresa?.razao_social ||
                      'Análise de Balanço'}
                  </span>
                  <span className="text-[10px] text-blue-200/80 uppercase tracking-wider font-semibold block truncate">
                    {minhaEmpresa?.razao_social ? 'Consultoria Oficial' : 'Consultoria'}
                  </span>
                </div>
              </button>
            </div>

            {/* CENTRO: NAVEGAÇÃO HORIZONTAL PRINCIPAL (>= 768px) COM DROPDOWNS */}
            <nav className="hidden md:flex items-center gap-1 xl:gap-1.5 flex-1 justify-start overflow-x-auto no-scrollbar py-1">
              {/* 1. Dashboard (Dropdown com Dashboard Geral e Dashboard BI interativo) */}
              {!isUserComercial && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs lg:text-sm font-medium whitespace-nowrap transition-all cursor-pointer select-none outline-hidden ${
                        isDashboardActive
                          ? 'bg-white/20 text-white font-semibold shadow-xs ring-1 ring-white/30'
                          : 'text-slate-200 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      <LayoutDashboard
                        className={`w-3.5 h-3.5 ${isDashboardActive ? 'text-blue-200' : 'text-blue-300'}`}
                      />
                      <span>Dashboard</span>
                      <ChevronDown className="w-3.5 h-3.5 opacity-70" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="start"
                    sideOffset={8}
                    className="w-64 bg-[#0B1F3A] border-slate-700/80 text-white shadow-xl rounded-xl p-1.5 z-50 backdrop-blur-md"
                  >
                    <DropdownMenuLabel className="text-[10px] uppercase font-bold tracking-wider text-blue-300/80 px-2.5 py-1">
                      Painéis & BI
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-white/10 my-1" />
                    <DropdownMenuItem
                      asChild
                      className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                        location.pathname === '/dashboard'
                          ? 'bg-blue-600 text-white font-semibold'
                          : 'text-slate-200 hover:bg-white/10 hover:text-white focus:bg-white/10 focus:text-white'
                      }`}
                    >
                      <NavLink to="/dashboard">
                        <LayoutDashboard className="w-4 h-4 shrink-0 text-blue-300" />
                        <div className="flex flex-col min-w-0">
                          <span className="truncate font-semibold">Dashboard Geral</span>
                          <span className="text-[10px] text-blue-200/70 truncate">
                            Visão executiva patrimonial
                          </span>
                        </div>
                      </NavLink>
                    </DropdownMenuItem>
                    {!isUserFinanceiro && !isUserComercial && (
                      <DropdownMenuItem
                        asChild
                        className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                          location.pathname === '/dashboard-bi' || location.pathname === '/bi'
                            ? 'bg-blue-600 text-white font-semibold'
                            : 'text-slate-200 hover:bg-white/10 hover:text-white focus:bg-white/10 focus:text-white'
                        }`}
                      >
                        <NavLink
                          to="/dashboard-bi"
                          className="flex items-center justify-between w-full"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <BarChart3 className="w-4 h-4 shrink-0 text-amber-400" />
                            <div className="flex flex-col min-w-0">
                              <span className="truncate font-semibold">Dashboard BI</span>
                              <span className="text-[10px] text-amber-200/70 truncate">
                                Apresentação às Empresas
                              </span>
                            </div>
                          </div>
                          <span className="text-[9px] bg-amber-400/20 text-amber-300 px-1.5 py-0.5 rounded font-bold border border-amber-400/30">
                            BI
                          </span>
                        </NavLink>
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {/* 2. Cadastros (Dropdown) */}
              {cadastroSubItems.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs lg:text-sm font-medium whitespace-nowrap transition-all cursor-pointer select-none outline-hidden ${
                        isCadastroActive
                          ? 'bg-white/20 text-white font-semibold shadow-xs ring-1 ring-white/30'
                          : 'text-slate-200 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      <Folder
                        className={`w-3.5 h-3.5 ${isCadastroActive ? 'text-blue-200' : 'text-blue-300'}`}
                      />
                      <span>Cadastros</span>
                      <ChevronDown className="w-3.5 h-3.5 opacity-70" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="start"
                    sideOffset={8}
                    className="w-56 bg-[#0B1F3A] border-slate-700/80 text-white shadow-xl rounded-xl p-1.5 z-50 backdrop-blur-md"
                  >
                    <DropdownMenuLabel className="text-[10px] uppercase font-bold tracking-wider text-blue-300/80 px-2.5 py-1">
                      Cadastros Gerais
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-white/10 my-1" />
                    {cadastroSubItems.map((sub) => {
                      const SubIcon = sub.icon
                      const isSubActive =
                        sub.path === '/empresas'
                          ? location.pathname.startsWith('/empresas') &&
                            !location.search.includes('novo=balanco-dre')
                          : location.pathname === sub.path

                      return (
                        <DropdownMenuItem
                          key={sub.path}
                          asChild
                          className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                            isSubActive
                              ? 'bg-blue-600 text-white font-semibold'
                              : 'text-slate-200 hover:bg-white/10 hover:text-white focus:bg-white/10 focus:text-white'
                          }`}
                        >
                          <NavLink to={sub.path}>
                            <SubIcon
                              className={`w-4 h-4 shrink-0 ${
                                isSubActive ? 'text-white' : 'text-blue-300'
                              }`}
                            />
                            <span className="truncate">{sub.name}</span>
                          </NavLink>
                        </DropdownMenuItem>
                      )
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {/* 3. Lançamentos (Dropdown com Lançamentos Rápidos e Balanço e DRE) */}
              {!isUserComercial && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs lg:text-sm font-medium whitespace-nowrap transition-all cursor-pointer select-none outline-hidden ${
                        isLancamentosActive
                          ? 'bg-white/20 text-white font-semibold shadow-xs ring-1 ring-white/30'
                          : 'text-slate-200 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      <FileText
                        className={`w-3.5 h-3.5 ${isLancamentosActive ? 'text-blue-200' : 'text-blue-300'}`}
                      />
                      <span>Lançamentos</span>
                      <ChevronDown className="w-3.5 h-3.5 opacity-70" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="start"
                    sideOffset={8}
                    className="w-56 bg-[#0B1F3A] border-slate-700/80 text-white shadow-xl rounded-xl p-1.5 z-50 backdrop-blur-md"
                  >
                    <DropdownMenuLabel className="text-[10px] uppercase font-bold tracking-wider text-blue-300/80 px-2.5 py-1">
                      Registros Contábeis
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-white/10 my-1" />
                    <DropdownMenuItem
                      asChild
                      className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                        location.pathname === '/lancamentos'
                          ? 'bg-blue-600 text-white font-semibold'
                          : 'text-slate-200 hover:bg-white/10 hover:text-white focus:bg-white/10 focus:text-white'
                      }`}
                    >
                      <NavLink to="/lancamentos">
                        <FileText className="w-4 h-4 shrink-0 text-blue-300" />
                        <span className="truncate">Lançamentos Rápidos</span>
                      </NavLink>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      asChild
                      className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                        location.search.includes('novo=balanco-dre')
                          ? 'bg-blue-600 text-white font-semibold'
                          : 'text-slate-200 hover:bg-white/10 hover:text-white focus:bg-white/10 focus:text-white'
                      }`}
                    >
                      <NavLink to={balancoDreUrl}>
                        <Scale className="w-4 h-4 shrink-0 text-emerald-400" />
                        <span className="truncate">Balanço e DRE (Mensal)</span>
                      </NavLink>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {/* 4. Financeiro (Dropdown) */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs lg:text-sm font-medium whitespace-nowrap transition-all cursor-pointer select-none outline-hidden ${
                      isFinanceiroActive
                        ? 'bg-white/20 text-white font-semibold shadow-xs ring-1 ring-white/30'
                        : 'text-slate-200 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <DollarSign
                      className={`w-3.5 h-3.5 ${isFinanceiroActive ? 'text-emerald-200' : 'text-emerald-400'}`}
                    />
                    <span>Financeiro</span>
                    <ChevronDown className="w-3.5 h-3.5 opacity-70" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  sideOffset={8}
                  className="w-56 bg-[#0B1F3A] border-slate-700/80 text-white shadow-xl rounded-xl p-1.5 z-50 backdrop-blur-md"
                >
                  <DropdownMenuLabel className="text-[10px] uppercase font-bold tracking-wider text-emerald-300/80 px-2.5 py-1">
                    Gestão Financeira
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-white/10 my-1" />
                  {financeiroSubItems.map((sub) => {
                    const SubIcon = sub.icon
                    const isSubActive = location.pathname === sub.path

                    return (
                      <DropdownMenuItem
                        key={sub.path}
                        asChild
                        className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                          isSubActive
                            ? 'bg-blue-600 text-white font-semibold'
                            : 'text-slate-200 hover:bg-white/10 hover:text-white focus:bg-white/10 focus:text-white'
                        }`}
                      >
                        <NavLink to={sub.path}>
                          <SubIcon
                            className={`w-4 h-4 shrink-0 ${
                              isSubActive ? 'text-white' : 'text-emerald-400'
                            }`}
                          />
                          <span className="truncate">{sub.name}</span>
                        </NavLink>
                      </DropdownMenuItem>
                    )
                  })}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* 5. Formação de Preço (Dropdown) */}
              {!isUserFinanceiro && !isUserComercial && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs lg:text-sm font-medium whitespace-nowrap transition-all cursor-pointer select-none outline-hidden ${
                        isFormacaoPrecoActive
                          ? 'bg-white/20 text-white font-semibold shadow-xs ring-1 ring-white/30'
                          : 'text-slate-200 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      <Calculator
                        className={`w-3.5 h-3.5 ${isFormacaoPrecoActive ? 'text-amber-200' : 'text-amber-400'}`}
                      />
                      <span>Formação de Preço</span>
                      <ChevronDown className="w-3.5 h-3.5 opacity-70" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="start"
                    sideOffset={8}
                    className="w-60 bg-[#0B1F3A] border-slate-700/80 text-white shadow-xl rounded-xl p-1.5 z-50 backdrop-blur-md"
                  >
                    <DropdownMenuLabel className="text-[10px] uppercase font-bold tracking-wider text-amber-300/80 px-2.5 py-1">
                      Custos & Precificação
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-white/10 my-1" />
                    {formacaoPrecoSubItems.map((sub) => {
                      const SubIcon = sub.icon
                      const isSubActive = location.pathname === sub.path

                      return (
                        <DropdownMenuItem
                          key={sub.path}
                          asChild
                          className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                            isSubActive
                              ? 'bg-blue-600 text-white font-semibold'
                              : 'text-slate-200 hover:bg-white/10 hover:text-white focus:bg-white/10 focus:text-white'
                          }`}
                        >
                          <NavLink to={sub.path}>
                            <SubIcon
                              className={`w-4 h-4 shrink-0 ${
                                isSubActive ? 'text-white' : 'text-amber-400'
                              }`}
                            />
                            <span className="truncate">{sub.name}</span>
                          </NavLink>
                        </DropdownMenuItem>
                      )
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {/* 6. Indicadores (Dropdown) */}
              {!isUserFinanceiro && !isUserComercial && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs lg:text-sm font-medium whitespace-nowrap transition-all cursor-pointer select-none outline-hidden ${
                        isIndicadoresActive
                          ? 'bg-white/20 text-white font-semibold shadow-xs ring-1 ring-white/30'
                          : 'text-slate-200 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      <Gauge
                        className={`w-3.5 h-3.5 ${isIndicadoresActive ? 'text-blue-200' : 'text-blue-300'}`}
                      />
                      <span>Indicadores</span>
                      <ChevronDown className="w-3.5 h-3.5 opacity-70" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="start"
                    sideOffset={8}
                    className="w-64 max-h-[70vh] overflow-y-auto bg-[#0B1F3A] border-slate-700/80 text-white shadow-xl rounded-xl p-1.5 z-50 backdrop-blur-md"
                  >
                    <DropdownMenuLabel className="text-[10px] uppercase font-bold tracking-wider text-blue-300/80 px-2.5 py-1">
                      Painel & Análise de Indicadores
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-white/10 my-1" />
                    {indicadoresSubItems.map((sub) => {
                      const SubIcon = sub.icon
                      const isSubActive = location.pathname === sub.path

                      return (
                        <DropdownMenuItem
                          key={sub.path}
                          asChild
                          className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                            isSubActive
                              ? 'bg-blue-600 text-white font-semibold'
                              : 'text-slate-200 hover:bg-white/10 hover:text-white focus:bg-white/10 focus:text-white'
                          }`}
                        >
                          <NavLink to={sub.path}>
                            <SubIcon
                              className={`w-3.5 h-3.5 shrink-0 ${
                                isSubActive ? 'text-white' : 'text-blue-300'
                              }`}
                            />
                            <span className="truncate">{sub.name}</span>
                          </NavLink>
                        </DropdownMenuItem>
                      )
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {/* 7. Planejamento (Dropdown com Balanced Scorecard) */}
              {!isUserFinanceiro && !isUserComercial && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs lg:text-sm font-medium whitespace-nowrap transition-all cursor-pointer select-none outline-hidden ${
                        isPlanejamentoActive
                          ? 'bg-white/20 text-white font-semibold shadow-xs ring-1 ring-white/30'
                          : 'text-slate-200 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      <Compass
                        className={`w-3.5 h-3.5 ${isPlanejamentoActive ? 'text-blue-200' : 'text-blue-300'}`}
                      />
                      <span>Planejamento</span>
                      <ChevronDown className="w-3.5 h-3.5 opacity-70" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="start"
                    sideOffset={8}
                    className="w-56 bg-[#0B1F3A] border-slate-700/80 text-white shadow-xl rounded-xl p-1.5 z-50 backdrop-blur-md"
                  >
                    <DropdownMenuLabel className="text-[10px] uppercase font-bold tracking-wider text-blue-300/80 px-2.5 py-1">
                      Estratégia Empresarial
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-white/10 my-1" />
                    {planejamentoSubItems.map((sub) => {
                      const SubIcon = sub.icon
                      const isSubActive = location.pathname === sub.path

                      return (
                        <DropdownMenuItem
                          key={sub.path}
                          asChild
                          className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                            isSubActive
                              ? 'bg-blue-600 text-white font-semibold'
                              : 'text-slate-200 hover:bg-white/10 hover:text-white focus:bg-white/10 focus:text-white'
                          }`}
                        >
                          <NavLink to={sub.path}>
                            <SubIcon
                              className={`w-4 h-4 shrink-0 ${
                                isSubActive ? 'text-white' : 'text-blue-300'
                              }`}
                            />
                            <span className="truncate">{sub.name}</span>
                          </NavLink>
                        </DropdownMenuItem>
                      )
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {/* 8. Análise Tributária (Link direto) */}
              {!isUserFinanceiro && !isUserComercial && (
                <NavLink
                  to="/analise-tributaria"
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs lg:text-sm font-medium whitespace-nowrap transition-all ${
                    location.pathname === '/analise-tributaria'
                      ? 'bg-white/20 text-white font-semibold shadow-xs'
                      : 'text-slate-200 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Calculator className="w-3.5 h-3.5 text-emerald-300" />
                  <span>Análise Tributária</span>
                </NavLink>
              )}

              {/* 9. Importação (Link direto) */}
              {!isUserFinanceiro && !isUserComercial && (
                <NavLink
                  to="/importacao"
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs lg:text-sm font-medium whitespace-nowrap transition-all ${
                    location.pathname === '/importacao'
                      ? 'bg-white/20 text-white font-semibold shadow-xs'
                      : 'text-slate-200 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Upload className="w-3.5 h-3.5 text-blue-300" />
                  <span>Importação</span>
                </NavLink>
              )}

              {/* 10. Relatórios (Dropdown com Relatório Geral e Anual) */}
              {!isUserFinanceiro && !isUserComercial && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs lg:text-sm font-medium whitespace-nowrap transition-all cursor-pointer select-none outline-hidden ${
                        location.pathname === '/relatorios' ||
                        location.pathname === '/relatorio-anual'
                          ? 'bg-white/20 text-white font-semibold shadow-xs ring-1 ring-white/30'
                          : 'text-slate-200 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5 text-blue-300" />
                      <span>Relatórios</span>
                      <ChevronDown className="w-3.5 h-3.5 opacity-70" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="start"
                    sideOffset={8}
                    className="w-56 bg-[#0B1F3A] border-slate-700/80 text-white shadow-xl rounded-xl p-1.5 z-50 backdrop-blur-md"
                  >
                    <DropdownMenuLabel className="text-[10px] uppercase font-bold tracking-wider text-blue-300/80 px-2.5 py-1">
                      Demonstrações & Pareceres
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-white/10 my-1" />
                    <DropdownMenuItem
                      asChild
                      className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                        location.pathname === '/relatorios'
                          ? 'bg-blue-600 text-white font-semibold'
                          : 'text-slate-200 hover:bg-white/10 hover:text-white focus:bg-white/10 focus:text-white'
                      }`}
                    >
                      <NavLink to="/relatorios">
                        <FileText className="w-4 h-4 shrink-0 text-blue-300" />
                        <span className="truncate">Relatórios Executivos</span>
                      </NavLink>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      asChild
                      className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                        location.pathname === '/relatorio-anual'
                          ? 'bg-blue-600 text-white font-semibold'
                          : 'text-slate-200 hover:bg-white/10 hover:text-white focus:bg-white/10 focus:text-white'
                      }`}
                    >
                      <NavLink to="/relatorio-anual">
                        <FileText className="w-4 h-4 shrink-0 text-blue-300" />
                        <span className="truncate">Relatório Consolidado Anual</span>
                      </NavLink>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </nav>

            {/* LADO DIREITO: MENU DE AVATAR DO USUÁRIO (Substitui o antigo cartão do rodapé) */}
            <div className="flex items-center gap-2 shrink-0">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-2 pl-2 pr-2.5 py-1.5 rounded-xl hover:bg-white/10 transition-all cursor-pointer outline-hidden border border-white/10 focus:ring-2 focus:ring-blue-400/50"
                  >
                    <Avatar
                      className="w-8 h-8 border border-white/20 text-white text-xs font-semibold shrink-0"
                      style={{ backgroundColor: corSecundaria }}
                    >
                      {user?.avatar && (
                        <AvatarImage src={pb.files.getURL(user, user.avatar)} alt={userName} />
                      )}
                      <AvatarFallback
                        style={{ backgroundColor: corSecundaria }}
                        className="text-white font-semibold text-xs"
                      >
                        {userInitial}
                      </AvatarFallback>
                    </Avatar>
                    <div className="hidden xl:flex flex-col items-start text-left max-w-[140px] truncate">
                      <span className="text-xs font-semibold text-white truncate leading-tight block">
                        {userName}
                      </span>
                      <span className="text-[10px] text-blue-200/80 truncate block">
                        {userRole}
                      </span>
                    </div>
                    <ChevronDown className="w-3.5 h-3.5 text-blue-200/80 hidden xl:block" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  sideOffset={8}
                  className="w-64 bg-[#0B1F3A] border-slate-700/80 text-white shadow-2xl rounded-2xl p-2 z-50 backdrop-blur-md"
                >
                  {/* Cabeçalho do usuário */}
                  <div className="flex items-center gap-3 p-2.5 rounded-xl bg-white/5 border border-white/10 mb-1">
                    <Avatar
                      className="w-10 h-10 border border-white/20 shrink-0"
                      style={{ backgroundColor: corSecundaria }}
                    >
                      {user?.avatar && (
                        <AvatarImage src={pb.files.getURL(user, user.avatar)} alt={userName} />
                      )}
                      <AvatarFallback
                        style={{ backgroundColor: corSecundaria }}
                        className="text-white font-bold text-sm"
                      >
                        {userInitial}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-bold text-white truncate">{userName}</p>
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded font-semibold uppercase ${
                            isUserAdmin
                              ? 'bg-purple-400/20 text-purple-200 border border-purple-400/30'
                              : isUserFinanceiro
                                ? 'bg-blue-400/20 text-blue-200 border border-blue-400/30'
                                : isUserComercial
                                  ? 'bg-amber-400/20 text-amber-200 border border-amber-400/30'
                                  : 'bg-emerald-400/20 text-emerald-200 border border-emerald-400/30'
                          }`}
                        >
                          {userRole}
                        </span>
                      </div>
                      <p className="text-[11px] text-blue-200/70 truncate mt-0.5">{userEmail}</p>
                    </div>
                  </div>

                  <DropdownMenuSeparator className="bg-white/10 my-1" />

                  {/* Configurações da Conta */}
                  <DropdownMenuItem
                    onClick={() => navigate('/configuracoes')}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-200 hover:bg-white/10 hover:text-white cursor-pointer focus:bg-white/10 focus:text-white"
                  >
                    <Settings className="w-4 h-4 text-slate-300" />
                    <span>Configurações do Sistema</span>
                  </DropdownMenuItem>

                  {/* Perfil & Alertas */}
                  <DropdownMenuItem
                    onClick={() => setModalPerfilOpen(true)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-200 hover:bg-white/10 hover:text-white cursor-pointer focus:bg-white/10 focus:text-white"
                  >
                    <Bell className="w-4 h-4 text-blue-300" />
                    <span>Alertas & Preferências</span>
                  </DropdownMenuItem>

                  {/* Minha Empresa */}
                  <DropdownMenuItem
                    onClick={() => navigate('/minha-empresa')}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-200 hover:bg-white/10 hover:text-white cursor-pointer focus:bg-white/10 focus:text-white"
                  >
                    <Building className="w-4 h-4 text-emerald-400" />
                    <span>Dados da Minha Consultoria</span>
                  </DropdownMenuItem>

                  <DropdownMenuSeparator className="bg-white/10 my-1" />

                  {/* Logout */}
                  <DropdownMenuItem
                    onClick={() => {
                      logout()
                      navigate('/')
                    }}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-red-300 bg-red-950/30 hover:bg-red-900/50 hover:text-red-100 cursor-pointer focus:bg-red-900/50 focus:text-red-100 border border-red-800/30"
                  >
                    <LogOut className="w-4 h-4 text-red-400" />
                    <span>Sair do sistema</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      {/* ========================================================
          DRAWER MOBILE (< 768px)
          Mantido completo para navegação móvel com hambúrguer
      ======================================================== */}
      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Overlay escuro */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileDrawerOpen(false)}
          />

          {/* Drawer Lateral */}
          <div
            className="relative w-72 max-w-[85vw] text-white flex flex-col justify-between h-full p-5 shadow-2xl z-10 transition-colors"
            style={{ backgroundColor: corPrimaria }}
          >
            <div>
              {/* Cabeçalho do Drawer */}
              <div className="flex items-center justify-between pb-5 border-b border-white/10">
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
                        'Análise de Balanço'}
                    </span>
                    <span className="text-[10px] text-blue-200/80 uppercase tracking-wider font-semibold block truncate">
                      {minhaEmpresa?.razao_social ? 'Consultoria Oficial' : 'Consultoria'}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileDrawerOpen(false)}
                  className="p-1 rounded-lg text-slate-300 hover:text-white hover:bg-white/10"
                  aria-label="Fechar menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Lista de navegação mobile */}
              <nav className="mt-5 space-y-1 overflow-y-auto max-h-[calc(100vh-210px)] pr-1">
                {/* 1. Dashboard (Expansível no Mobile) */}
                {!isUserComercial && (
                  <div className="space-y-1">
                    <button
                      type="button"
                      onClick={() => setDashboardOpen((prev) => !prev)}
                      style={
                        isDashboardActive
                          ? {
                              backgroundColor: `${corSecundaria}33`,
                              borderColor: `${corSecundaria}66`,
                            }
                          : undefined
                      }
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                        isDashboardActive
                          ? 'text-white font-semibold border'
                          : 'text-slate-300 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <LayoutDashboard
                          className={`w-4 h-4 ${isDashboardActive ? 'text-blue-300' : 'text-blue-400'}`}
                        />
                        <span>Dashboard</span>
                      </div>
                      <ChevronDown
                        className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                          dashboardOpen ? 'rotate-0' : '-rotate-90'
                        }`}
                      />
                    </button>

                    <div
                      className={`grid transition-[grid-template-rows,opacity] duration-200 ease-in-out ${
                        dashboardOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                      }`}
                    >
                      <div className="overflow-hidden">
                        <div className="ml-3 pl-3 border-l border-blue-500/30 space-y-1 py-1">
                          <NavLink
                            to="/dashboard"
                            onClick={() => setMobileDrawerOpen(false)}
                            className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                              location.pathname === '/dashboard'
                                ? 'bg-white/15 text-white font-semibold shadow-xs'
                                : 'text-slate-300 hover:text-white hover:bg-white/5'
                            }`}
                          >
                            <LayoutDashboard className="w-3.5 h-3.5 text-blue-300" />
                            <span className="truncate">Dashboard Geral</span>
                          </NavLink>

                          {!isUserFinanceiro && !isUserComercial && (
                            <NavLink
                              to="/dashboard-bi"
                              onClick={() => setMobileDrawerOpen(false)}
                              className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                location.pathname === '/dashboard-bi' || location.pathname === '/bi'
                                  ? 'bg-white/15 text-white font-semibold shadow-xs'
                                  : 'text-slate-300 hover:text-white hover:bg-white/5'
                              }`}
                            >
                              <BarChart3 className="w-3.5 h-3.5 text-amber-400" />
                              <span className="truncate">Dashboard BI (Apresentação)</span>
                            </NavLink>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. Cadastros (Expansível) */}
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
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer ${
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
                              ? location.pathname.startsWith('/empresas') &&
                                !location.search.includes('novo=balanco-dre')
                              : location.pathname === sub.path

                          return (
                            <NavLink
                              key={sub.path}
                              to={sub.path}
                              onClick={() => setMobileDrawerOpen(false)}
                              className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
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

                {/* 3. Lançamentos (Expansível) */}
                {!isUserComercial && (
                  <div className="space-y-1">
                    <button
                      type="button"
                      onClick={() => setLancamentosOpen((prev) => !prev)}
                      style={
                        isLancamentosActive
                          ? {
                              backgroundColor: `${corSecundaria}33`,
                              borderColor: `${corSecundaria}66`,
                            }
                          : undefined
                      }
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                        isLancamentosActive
                          ? 'text-white font-semibold border'
                          : 'text-slate-300 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <FileText
                          className={`w-4 h-4 ${isLancamentosActive ? 'text-blue-300' : 'text-blue-400'}`}
                        />
                        <span>Lançamentos</span>
                      </div>
                      <ChevronDown
                        className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                          lancamentosOpen ? 'rotate-0' : '-rotate-90'
                        }`}
                      />
                    </button>

                    <div
                      className={`grid transition-[grid-template-rows,opacity] duration-200 ease-in-out ${
                        lancamentosOpen
                          ? 'grid-rows-[1fr] opacity-100'
                          : 'grid-rows-[0fr] opacity-0'
                      }`}
                    >
                      <div className="overflow-hidden">
                        <div className="ml-3 pl-3 border-l border-blue-500/30 space-y-1 py-1">
                          <NavLink
                            to="/lancamentos"
                            onClick={() => setMobileDrawerOpen(false)}
                            className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                              location.pathname === '/lancamentos'
                                ? 'bg-white/15 text-white font-semibold shadow-xs'
                                : 'text-slate-300 hover:text-white hover:bg-white/5'
                            }`}
                          >
                            <FileText
                              className={`w-3.5 h-3.5 ${
                                location.pathname === '/lancamentos'
                                  ? 'text-blue-300'
                                  : 'text-slate-400'
                              }`}
                            />
                            <span className="truncate">Lançamentos Rápidos</span>
                          </NavLink>

                          <NavLink
                            to={balancoDreUrl}
                            onClick={() => setMobileDrawerOpen(false)}
                            className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                              location.search.includes('novo=balanco-dre')
                                ? 'bg-white/15 text-white font-semibold shadow-xs'
                                : 'text-slate-300 hover:text-white hover:bg-white/5'
                            }`}
                          >
                            <Scale
                              className={`w-3.5 h-3.5 ${
                                location.search.includes('novo=balanco-dre')
                                  ? 'text-blue-300'
                                  : 'text-emerald-400'
                              }`}
                            />
                            <span className="truncate">Balanço e DRE (Mensal)</span>
                          </NavLink>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 4. Financeiro (Expansível) */}
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
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer ${
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
                              className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
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

                {/* 5. Formação de Preço - Custo (Expansível) */}
                {!isUserFinanceiro && !isUserComercial && (
                  <div className="space-y-1">
                    <button
                      type="button"
                      onClick={() => setFormacaoPrecoOpen((prev) => !prev)}
                      style={
                        isFormacaoPrecoActive
                          ? {
                              backgroundColor: `${corSecundaria}33`,
                              borderColor: `${corSecundaria}66`,
                            }
                          : undefined
                      }
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                        isFormacaoPrecoActive
                          ? 'text-white font-semibold border'
                          : 'text-slate-300 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Calculator
                          className={`w-4 h-4 ${isFormacaoPrecoActive ? 'text-amber-300' : 'text-amber-400'}`}
                        />
                        <span className="truncate">Formação de Preço - Custo</span>
                      </div>
                      <ChevronDown
                        className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                          formacaoPrecoOpen ? 'rotate-0' : '-rotate-90'
                        }`}
                      />
                    </button>

                    <div
                      className={`grid transition-[grid-template-rows,opacity] duration-200 ease-in-out ${
                        formacaoPrecoOpen
                          ? 'grid-rows-[1fr] opacity-100'
                          : 'grid-rows-[0fr] opacity-0'
                      }`}
                    >
                      <div className="overflow-hidden">
                        <div className="ml-3 pl-3 border-l border-amber-500/30 space-y-1 py-1">
                          {formacaoPrecoSubItems.map((sub) => {
                            const SubIcon = sub.icon
                            const isSubActive = location.pathname === sub.path

                            return (
                              <NavLink
                                key={sub.path}
                                to={sub.path}
                                onClick={() => setMobileDrawerOpen(false)}
                                className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                  isSubActive
                                    ? 'bg-white/15 text-white font-semibold shadow-xs'
                                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                                }`}
                              >
                                <SubIcon
                                  className={`w-3.5 h-3.5 ${
                                    isSubActive ? 'text-amber-300' : 'text-slate-400'
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
                )}

                {/* 6. Indicadores (Expansível) */}
                {!isUserFinanceiro && !isUserComercial && (
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
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer ${
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

                    <div
                      className={`grid transition-[grid-template-rows,opacity] duration-200 ease-in-out ${
                        indicadoresOpen
                          ? 'grid-rows-[1fr] opacity-100'
                          : 'grid-rows-[0fr] opacity-0'
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
                                className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
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
                )}

                {/* 7. Planejamento (Expansível) */}
                {!isUserFinanceiro && !isUserComercial && (
                  <div className="space-y-1">
                    <button
                      type="button"
                      onClick={() => setPlanejamentoOpen((prev) => !prev)}
                      style={
                        isPlanejamentoActive
                          ? {
                              backgroundColor: `${corSecundaria}33`,
                              borderColor: `${corSecundaria}66`,
                            }
                          : undefined
                      }
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                        isPlanejamentoActive
                          ? 'text-white font-semibold border'
                          : 'text-slate-300 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Compass
                          className={`w-4 h-4 ${isPlanejamentoActive ? 'text-blue-300' : 'text-blue-400'}`}
                        />
                        <span>Planejamento</span>
                      </div>
                      <ChevronDown
                        className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                          planejamentoOpen ? 'rotate-0' : '-rotate-90'
                        }`}
                      />
                    </button>

                    <div
                      className={`grid transition-[grid-template-rows,opacity] duration-200 ease-in-out ${
                        planejamentoOpen
                          ? 'grid-rows-[1fr] opacity-100'
                          : 'grid-rows-[0fr] opacity-0'
                      }`}
                    >
                      <div className="overflow-hidden">
                        <div className="ml-3 pl-3 border-l border-blue-500/30 space-y-1 py-1">
                          {planejamentoSubItems.map((sub) => {
                            const SubIcon = sub.icon
                            const isSubActive = location.pathname === sub.path

                            return (
                              <NavLink
                                key={sub.path}
                                to={sub.path}
                                onClick={() => setMobileDrawerOpen(false)}
                                className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
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
                )}

                {/* 8. Análise Tributária */}
                {!isUserFinanceiro && !isUserComercial && (
                  <NavLink
                    to="/analise-tributaria"
                    onClick={() => setMobileDrawerOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                      location.pathname === '/analise-tributaria'
                        ? 'bg-white/15 text-white font-semibold shadow-inner'
                        : 'text-slate-300 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Calculator className="w-4 h-4 text-emerald-400" />
                    <span>Análise Tributária</span>
                  </NavLink>
                )}

                {/* 9. Importação */}
                {!isUserFinanceiro && !isUserComercial && (
                  <NavLink
                    to="/importacao"
                    onClick={() => setMobileDrawerOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                      location.pathname === '/importacao'
                        ? 'bg-white/15 text-white font-semibold shadow-inner'
                        : 'text-slate-300 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Upload className="w-4 h-4 text-blue-400" />
                    <span>Importação</span>
                  </NavLink>
                )}

                {/* 10. Relatório Anual */}
                {!isUserFinanceiro && !isUserComercial && (
                  <NavLink
                    to="/relatorio-anual"
                    onClick={() => setMobileDrawerOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                      location.pathname === '/relatorio-anual'
                        ? 'bg-white/15 text-white font-semibold shadow-inner'
                        : 'text-slate-300 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <FileText className="w-4 h-4 text-blue-400" />
                    <span>Relatório Anual</span>
                  </NavLink>
                )}

                {/* 11. Relatórios */}
                {!isUserFinanceiro && !isUserComercial && (
                  <NavLink
                    to="/relatorios"
                    onClick={() => setMobileDrawerOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                      location.pathname === '/relatorios'
                        ? 'bg-white/15 text-white font-semibold shadow-inner'
                        : 'text-slate-300 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <FileText className="w-4 h-4 text-blue-400" />
                    <span>Relatórios</span>
                  </NavLink>
                )}
              </nav>
            </div>

            {/* Rodapé do Drawer com Usuário e Logout */}
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
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-semibold text-white truncate">{userName}</p>
                      <span
                        className={`text-[9px] px-1 py-0.2 rounded font-semibold uppercase ${
                          isUserAdmin
                            ? 'bg-purple-400/20 text-purple-200 border border-purple-400/30'
                            : isUserFinanceiro
                              ? 'bg-blue-400/20 text-blue-200 border border-blue-400/30'
                              : isUserComercial
                                ? 'bg-amber-400/20 text-amber-200 border border-amber-400/30'
                                : 'bg-emerald-400/20 text-emerald-200 border border-emerald-400/30'
                        }`}
                      >
                        {userRole}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 truncate">{userEmail}</p>
                  </div>
                </div>
                <Settings className="w-4 h-4 text-slate-400 shrink-0" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setMobileDrawerOpen(false)
                  setModalPerfilOpen(true)
                }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-slate-200 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 transition-colors"
              >
                <Bell className="w-4 h-4 text-blue-300" />
                Alertas e Notificações
              </button>
              <button
                type="button"
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

      {/* ========================================================
          ÁREA DE CONTEÚDO PRINCIPAL (LARGURA TOTAL 100%)
      ======================================================== */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Cabeçalho de Página com Título e Seletores Globais */}
        {showHeaderFilters && (
          <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 sticky top-14 md:top-16 z-20 shadow-xs">
            <div>
              <h1 className="text-xl font-bold text-[#0B1F3A] tracking-tight">
                {location.pathname === '/dashboard' && 'Dashboard Financeiro'}
                {(location.pathname === '/dashboard-bi' || location.pathname === '/bi') &&
                  'Dashboard de BI Interativo · Apresentação Executiva'}
                {location.pathname === '/agente-ia' && 'Agente de Diagnóstico & Estratégia de IA'}
                {location.pathname === '/relatorios' && 'Relatórios e Pareceres'}
                {location.pathname === '/relatorio-anual' && 'Relatório Consolidado Anual'}
                {location.pathname === '/planejamento/bsc' && 'Balanced Scorecard (BSC)'}
                {location.pathname === '/analise-tributaria' && 'Análise Tributária e Planejamento'}
                {location.pathname === '/notas-fiscais' && 'Emissão de Nota Fiscal (NFS-e)'}
                {location.pathname === '/formacao-preco/produtos' && 'Cadastro de Produtos'}
                {location.pathname === '/formacao-preco/materia-prima' &&
                  'Cadastro de Matéria Prima'}
                {location.pathname === '/formacao-preco/fichas-tecnicas' &&
                  'Cadastro da Ficha Técnica'}
                {location.pathname === '/formacao-preco/impostos' &&
                  'Configuração e Análise de Impostos'}
                {location.pathname === '/formacao-preco/simulador' &&
                  'Simulador de Preços & Mark-Up'}
                {location.pathname.startsWith('/empresas/') && 'Análise da Empresa'}
              </h1>
              <p className="text-xs text-[#5B6B7F]">
                {location.pathname === '/dashboard' &&
                  'Visão consolidada de indicadores e evolução patrimonial'}
                {(location.pathname === '/dashboard-bi' || location.pathname === '/bi') &&
                  'Painel analítico completo com cross-filter, indicadores financeiros, operacionais, comerciais e BSC para apresentação'}
                {location.pathname === '/relatorios' &&
                  'Gere relatórios executivos para impressão ou exportação'}
                {location.pathname === '/relatorio-anual' &&
                  'Visão consolidada de 12 meses por tipo de conta com exportação CSV'}
                {location.pathname === '/planejamento/bsc' &&
                  'Gestão estratégica em 4 perspectivas com metas, peso e apuração automática'}
                {location.pathname === '/analise-tributaria' &&
                  'Comparativo entre Simples Nacional, Lucro Presumido e Lucro Real'}
                {location.pathname === '/notas-fiscais' &&
                  'Emita NFS-e, gere DANFSE em PDF/XML e envie para clientes por e-mail'}
                {location.pathname === '/formacao-preco/produtos' &&
                  'Gerencie os produtos comercializados, custos, preços de venda e margens de lucro'}
                {location.pathname === '/formacao-preco/materia-prima' &&
                  'Cadastre insumos, matérias-primas, custos unitários e controle de estoque'}
                {location.pathname === '/formacao-preco/fichas-tecnicas' &&
                  'Composição da ficha técnica, custo de matéria-prima, outros custos e cálculo do preço sugerido com margem'}
                {location.pathname === '/formacao-preco/impostos' &&
                  'Carga tributária, regimes e impacto nos custos'}
                {location.pathname === '/formacao-preco/simulador' &&
                  'Cálculo de mark-up divisor por parâmetros percentuais e simulação por produto com custo da ficha técnica'}
                {location.pathname.startsWith('/empresas/') &&
                  'Diagnóstico detalhado de Balanço, DRE e Indicadores'}
              </p>
            </div>

            {/* Seletores Globais Empresa e Ano */}
            <div className="flex items-center gap-2.5 flex-wrap">
              {/* Seletor Empresa */}
              <div className="flex items-center gap-1.5 bg-[#F5F7FA] border border-slate-200 rounded-lg px-2.5 py-1 text-xs">
                <Building className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                {isUserAdmin ? (
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
                      <SelectEmpresaOuGrupoItems
                        todasEntidades={todasEntidades}
                        empresas={empresas}
                      />
                    </SelectContent>
                  </Select>
                ) : (
                  <div
                    className="flex items-center gap-1.5 py-1 text-xs font-semibold text-slate-800 max-w-[200px] truncate"
                    title={
                      empresas.find((e) => e.id === selectedEmpresaId)?.nome_fantasia ||
                      'Sua Empresa'
                    }
                  >
                    <span className="truncate">
                      {empresas.find((e) => e.id === selectedEmpresaId)?.nome_fantasia ||
                        empresas.find((e) => e.id === selectedEmpresaId)?.nome ||
                        'Empresa Vinculada'}
                    </span>
                    <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.2 rounded font-normal">
                      Fixa
                    </span>
                  </div>
                )}
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
          <span>Análise de Balanço · Consultoria Financeira</span>
          <span>&copy; {new Date().getFullYear()} Todos os direitos reservados.</span>
        </footer>
      </div>

      {/* Modal de Perfil e Preferências de Alertas */}
      <ModalPerfil open={modalPerfilOpen} onOpenChange={setModalPerfilOpen} />
    </div>
  )
}
