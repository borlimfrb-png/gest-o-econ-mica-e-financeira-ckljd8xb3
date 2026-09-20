import React, { useState, useEffect, useMemo } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useFilter } from '@/contexts/FilterContext'
import { useMinhaEmpresa } from '@/contexts/MinhaEmpresaContext'
import { ModalPerfil } from '@/components/ModalPerfil'
import {
  Scale,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Calendar,
  Building,
  Users,
  Shield,
  Settings,
  Bell,
  Search,
  Sparkles,
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SelectEmpresaOuGrupoItems } from '@/components/SelectEmpresaOuGrupoItems'
import { ModernMegaMenu } from '@/components/ModernMegaMenu'
import { CommandPalette } from '@/components/CommandPalette'
import {
  MENU_GRUPOS,
  filtrarMenuPorPerfil,
  extrairTodosItensNavegaveis,
  type NavGroupConfig,
} from '@/lib/menuNavigationConfig'
import { MoreHorizontal, ChevronRight } from 'lucide-react'

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
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)

  // Drawer mobile: controle de acordeões de grupos abertos
  const [openDrawerGroups, setOpenDrawerGroups] = useState<Record<string, boolean>>({})

  // Medição da largura da tela para colapso responsivo dos grupos no botão "Mais"
  // Grupos prioritários diretos (primeiros 6 ou 7 em telas médias, todos em telas ultra-wide)
  // Largura < 1200px: 5 grupos visíveis + "Mais"
  // Largura 1200px - 1439px: 7 grupos visíveis + "Mais"
  // Largura >= 1440px: todos os grupos visíveis (ou 8+ se couber)
  const [windowWidth, setWindowWidth] = useState<number>(
    typeof window !== 'undefined' ? window.innerWidth : 1440,
  )

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

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

  // Atalho Balanço e DRE destino
  const balancoDreUrl = selectedEmpresaId
    ? `/empresas/${selectedEmpresaId}?aba=comparativo-mensal&novo=balanco-dre`
    : '/empresas'

  // Menu filtrado por permissão do perfil ativo
  const menuGruposFiltrados = useMemo(() => {
    return filtrarMenuPorPerfil(MENU_GRUPOS, user?.role, isAdmin, balancoDreUrl)
  }, [user?.role, isAdmin, balancoDreUrl])

  // Lista plana de itens navegáveis para o CommandPalette (Ctrl+K)
  const itensNavegaveis = useMemo(() => {
    return extrairTodosItensNavegaveis(menuGruposFiltrados)
  }, [menuGruposFiltrados])

  // Determinar limite de grupos visíveis diretamente na linha 2 de navegação
  // Com a topbar dividida em duas linhas, a linha 2 possui a largura inteira disponível
  // para os grupos de navegação (sem disputar espaço com logo, busca, seletores ou avatar).
  // Assim, em 1366px e acima todos os 10 grupos cabem com folga; em larguras menores colapsam suavemente no "Mais".
  const maxVisibleDirectGroups = useMemo(() => {
    if (windowWidth >= 1360) return 12 // >= 1360px (inclui 1366px e 1920px): exibe todos os 10 grupos com folga total
    if (windowWidth >= 1200) return 8 // 1200px - 1359px: 8 grupos visíveis + "Mais"
    if (windowWidth >= 1024) return 6 // 1024px - 1199px: 6 grupos visíveis + "Mais"
    return 4 // 768px - 1023px (md): 4 grupos visíveis + "Mais"
  }, [windowWidth])

  const { gruposVisiveis, gruposExcedentes } = useMemo(() => {
    if (menuGruposFiltrados.length <= maxVisibleDirectGroups) {
      return {
        gruposVisiveis: menuGruposFiltrados,
        gruposExcedentes: [] as NavGroupConfig[],
      }
    }
    return {
      gruposVisiveis: menuGruposFiltrados.slice(0, maxVisibleDirectGroups),
      gruposExcedentes: menuGruposFiltrados.slice(maxVisibleDirectGroups),
    }
  }, [menuGruposFiltrados, maxVisibleDirectGroups])

  // Atalho global de teclado Ctrl+K ou Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setCommandPaletteOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Verifica se um grupo específico está ativo baseado na rota atual
  const isGroupActive = (grupo: NavGroupConfig): boolean => {
    if (grupo.tipo === 'link' && grupo.path) {
      return location.pathname === grupo.path
    }

    if (grupo.id === 'dashboard') {
      return (
        location.pathname === '/dashboard' ||
        location.pathname === '/dashboard-bi' ||
        location.pathname === '/bi'
      )
    }

    if (grupo.id === 'cadastros') {
      return (
        (location.pathname.startsWith('/empresas') &&
          !location.search.includes('novo=balanco-dre')) ||
        location.pathname.startsWith('/cadastro/grupos-empresariais') ||
        location.pathname.startsWith('/grupos-empresariais') ||
        location.pathname.startsWith('/centros') ||
        location.pathname.startsWith('/tipos-despesas') ||
        location.pathname.startsWith('/contas') ||
        location.pathname.startsWith('/plano-contas') ||
        location.pathname === '/minha-empresa' ||
        location.pathname.startsWith('/admin/usuarios') ||
        location.pathname.startsWith('/admin/auditoria')
      )
    }

    if (grupo.id === 'lancamentos') {
      return (
        location.pathname === '/lancamentos' ||
        (location.pathname.startsWith('/empresas') && location.search.includes('novo=balanco-dre'))
      )
    }

    if (grupo.id === 'financeiro') {
      return (
        location.pathname === '/financeiro' ||
        location.pathname === '/baixa-recebiveis' ||
        location.pathname === '/contratos' ||
        location.pathname === '/notas-fiscais'
      )
    }

    if (grupo.id === 'formacao-preco') {
      return location.pathname.startsWith('/formacao-preco')
    }

    if (grupo.id === 'indicadores') {
      return location.pathname.startsWith('/indicadores')
    }

    if (grupo.id === 'planejamento') {
      return location.pathname.startsWith('/planejamento')
    }

    if (grupo.id === 'relatorios') {
      return location.pathname === '/relatorios' || location.pathname === '/relatorio-anual'
    }

    return false
  }

  // Verifica se algum grupo excedente (dentro do "Mais") está ativo
  const isAnyExcedenteActive = useMemo(() => {
    return gruposExcedentes.some((g) => isGroupActive(g))
  }, [gruposExcedentes, location.pathname, location.search])

  // Atualiza acordeões do drawer mobile quando rota mudar
  useEffect(() => {
    menuGruposFiltrados.forEach((g) => {
      if (isGroupActive(g)) {
        setOpenDrawerGroups((prev) => ({ ...prev, [g.id]: true }))
      }
    })
  }, [location.pathname, location.search, menuGruposFiltrados])

  // Redirect to login if not authenticated
  useEffect(() => {
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
    location.pathname === '/indicadores/apresentacao' ||
    location.pathname.startsWith('/empresas/') ||
    location.pathname.startsWith('/formacao-preco')

  const toggleDrawerGroup = (id: string) => {
    setOpenDrawerGroups((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <div className="min-h-screen bg-[#F5F7FA] flex flex-col antialiased text-slate-800">
      {/* ========================================================
          BARRA SUPERIOR HORIZONTAL (TOPBAR) DIVIDIDA EM DUAS LINHAS
          - Linha 1 (Superior): Logo/Nome da Empresa + Seletores Globais (Empresa/Ano) + Busca (Ctrl+K) + Avatar
          - Linha 2 (Inferior): Barra de Navegação Horizontal com Mega-Menus e botão "Mais ▾"
          - Evita qualquer sobreposição entre navegação e logo/busca em 1366px e em qualquer resolução
      ======================================================== */}
      <header
        className="sticky top-0 z-40 text-white shadow-md transition-colors"
        style={{ backgroundColor: corPrimaria }}
      >
        {/* ---------------- LINHA 1: CABEÇALHO SUPERIOR (UTILITÁRIOS & MARCA) ---------------- */}
        <div className="w-full px-3 lg:px-5 border-b border-white/10 bg-black/15">
          <div className="flex items-center justify-between h-13 md:h-14 gap-2 md:gap-4">
            {/* LADO ESQUERDO: Hambúrguer Mobile + Logotipo Borlim / Consultoria */}
            <div className="flex items-center gap-2 md:gap-3 shrink-0">
              {/* Hambúrguer apenas em mobile */}
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(true)}
                className="md:hidden p-2 -ml-1 rounded-lg text-slate-200 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                aria-label="Abrir menu de navegação"
              >
                <Menu className="w-5 h-5" />
              </button>

              {/* Logotipo clicável */}
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="flex items-center gap-2.5 text-left group focus:outline-hidden cursor-pointer"
              >
                {logoUrl ? (
                  <div className="w-8 h-8 md:w-9 md:h-9 rounded-xl bg-white/10 flex items-center justify-center p-1 shrink-0 shadow-xs overflow-hidden border border-white/15 group-hover:border-white/30 transition-all">
                    <img
                      src={logoUrl}
                      alt={minhaEmpresa?.nome_fantasia || 'Logo'}
                      className="w-full h-full object-contain"
                    />
                  </div>
                ) : (
                  <div
                    className="w-8 h-8 md:w-9 md:h-9 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs border border-white/15"
                    style={{ backgroundColor: corSecundaria }}
                  >
                    <Scale className="w-4 h-4 md:w-4.5 md:h-4.5" />
                  </div>
                )}
                <div className="truncate max-w-[150px] sm:max-w-[220px] md:max-w-[280px]">
                  <span className="font-bold text-xs md:text-sm text-white tracking-tight leading-tight block truncate group-hover:text-blue-200 transition-colors">
                    {minhaEmpresa?.nome_fantasia ||
                      minhaEmpresa?.razao_social ||
                      'Borlim · Gestão Financeira'}
                  </span>
                  <span className="text-[9px] md:text-[10px] text-blue-200/90 uppercase tracking-wider font-semibold block truncate">
                    {minhaEmpresa?.razao_social
                      ? 'Gestão Financeira & Econômica'
                      : 'Gestão Financeira'}
                  </span>
                </div>
              </button>
            </div>

            {/* LADO DIREITO: SELETORES GLOBAIS (EMPRESA/ANO) + BUSCA (Ctrl+K) + AVATAR */}
            <div className="flex items-center gap-2 md:gap-3 shrink-0">
              {/* Seletores Globais de Empresa e Ano integrados na Linha 1 */}
              <div className="hidden sm:flex items-center gap-1.5 md:gap-2">
                {/* Seletor Empresa */}
                <div className="flex items-center gap-1.5 bg-white/10 hover:bg-white/15 border border-white/20 rounded-xl px-2.5 py-1 text-xs transition-colors">
                  <Building className="w-3.5 h-3.5 text-blue-200 shrink-0" />
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
                      <SelectTrigger className="h-6 border-none shadow-none bg-transparent text-xs font-semibold text-white p-0 focus:ring-0 w-[130px] md:w-[170px] lg:w-[200px] cursor-pointer">
                        <SelectValue placeholder="Selecione a empresa" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#0B1F3A] border-slate-700 text-white">
                        <SelectEmpresaOuGrupoItems
                          todasEntidades={todasEntidades}
                          empresas={empresas}
                        />
                      </SelectContent>
                    </Select>
                  ) : (
                    <div
                      className="flex items-center gap-1.5 py-0.5 text-xs font-semibold text-white max-w-[150px] md:max-w-[190px] truncate"
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
                      <span className="text-[9px] bg-white/20 text-blue-100 px-1 py-0.2 rounded font-normal shrink-0">
                        Fixa
                      </span>
                    </div>
                  )}
                </div>

                {/* Seletor Ano */}
                <div className="flex items-center gap-1 bg-white/10 hover:bg-white/15 border border-white/20 rounded-xl px-2 py-1 text-xs transition-colors">
                  <Calendar className="w-3.5 h-3.5 text-blue-200 shrink-0" />
                  <Select
                    value={String(selectedAno)}
                    onValueChange={(val) => setSelectedAno(Number(val))}
                  >
                    <SelectTrigger className="h-6 border-none shadow-none bg-transparent text-xs font-semibold text-white p-0 focus:ring-0 w-[58px] cursor-pointer">
                      <SelectValue placeholder="Ano" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#0B1F3A] border-slate-700 text-white">
                      {anosDisponiveis.map((ano) => (
                        <SelectItem key={ano} value={String(ano)} className="text-xs">
                          {ano}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Botão de Busca Rápida (Command Palette Ctrl+K) */}
              <button
                type="button"
                onClick={() => setCommandPaletteOpen(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/12 hover:bg-blue-600/35 hover:border-blue-400/50 hover:text-white text-slate-100 text-xs border border-white/20 transition-all duration-150 shadow-xs cursor-pointer group"
                title="Pressione Ctrl+K para buscar módulos e relatórios"
              >
                <Search className="w-3.5 h-3.5 text-blue-200 group-hover:text-white transition-colors" />
                <span className="inline text-xs font-medium text-slate-100 group-hover:text-white">
                  Buscar...
                </span>
                <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1 py-0.5 text-[9px] font-mono bg-black/40 border border-white/20 rounded text-slate-200 group-hover:text-white font-semibold">
                  <span className="text-[8px]">⌘</span>K
                </kbd>
              </button>

              {/* Menu de Avatar do Usuário */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-1.5 pl-1.5 pr-2 py-1 rounded-xl hover:bg-white/10 transition-all cursor-pointer outline-hidden border border-white/10 focus:ring-2 focus:ring-blue-400/50"
                  >
                    <Avatar
                      className="w-7 h-7 md:w-8 md:h-8 border border-white/20 text-white text-xs font-semibold shrink-0"
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
                    <div className="hidden xl:flex flex-col items-start text-left max-w-[130px] truncate">
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

        {/* ---------------- LINHA 2: BARRA DE NAVEGAÇÃO HORIZONTAL (MEGA-MENUS & MAIS) ---------------- */}
        <div className="w-full px-3 lg:px-5 border-b border-white/10 hidden md:block">
          <div className="flex items-center justify-between h-10 lg:h-11 overflow-visible">
            <nav className="flex items-center gap-1 xl:gap-1.5 flex-1 justify-start min-w-0 overflow-visible py-1">
              {gruposVisiveis.map((grupo, idx) => {
                const active = isGroupActive(grupo)
                // Se estiver no último terço dos itens, alinhar painel à direita para não cortar na borda direita
                const align = idx >= gruposVisiveis.length - 2 ? 'right' : 'auto'
                return (
                  <ModernMegaMenu
                    key={grupo.id}
                    grupo={grupo}
                    isActive={active}
                    balancoDreUrl={balancoDreUrl}
                    align={align}
                  />
                )
              })}

              {/* DROPDOWN "MAIS" PARA GRUPOS EXCEDENTES */}
              {gruposExcedentes.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className={`flex items-center gap-1 xl:gap-1.5 px-2 xl:px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all duration-150 cursor-pointer select-none outline-none focus-visible:ring-2 focus-visible:ring-blue-300 shrink-0 ${
                        isAnyExcedenteActive
                          ? 'bg-white/20 text-white shadow-xs ring-1 ring-white/30'
                          : 'text-slate-100 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      <MoreHorizontal className="w-3.5 h-3.5 text-blue-200" />
                      <span>Mais</span>
                      {isAnyExcedenteActive && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                      )}
                      <ChevronDown className="w-3 h-3 text-slate-200 opacity-80" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    sideOffset={8}
                    className="w-72 bg-[#0B1F3A] border-slate-700/80 text-white shadow-2xl rounded-2xl p-2 z-50 backdrop-blur-md"
                  >
                    <div className="px-2.5 py-1.5 text-[10px] font-bold text-blue-200 uppercase tracking-wider border-b border-white/10 mb-1">
                      Módulos Adicionais
                    </div>
                    {gruposExcedentes.map((grupo) => {
                      const GroupIcon = grupo.icon
                      const active = isGroupActive(grupo)

                      // Se o grupo excedente for link direto
                      if (grupo.tipo === 'link' && grupo.path) {
                        return (
                          <DropdownMenuItem
                            key={grupo.id}
                            onClick={() => navigate(grupo.path!)}
                            className={`flex items-center justify-between gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium cursor-pointer transition-colors ${
                              active
                                ? 'bg-blue-600/40 text-white font-bold border border-blue-400/50'
                                : 'text-slate-200 hover:bg-white/10 hover:text-white focus:bg-white/10 focus:text-white'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 truncate">
                              <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center shrink-0 text-blue-200">
                                <GroupIcon className="w-3.5 h-3.5" />
                              </div>
                              <div className="flex flex-col truncate">
                                <span className="font-bold truncate">{grupo.label}</span>
                                {grupo.subtitulo && (
                                  <span className="text-[10px] text-slate-300 truncate">
                                    {grupo.subtitulo}
                                  </span>
                                )}
                              </div>
                            </div>
                            {grupo.badge && (
                              <span className="text-[9px] bg-blue-500/30 text-blue-100 border border-blue-400/40 px-1.5 py-0.5 rounded font-bold uppercase shrink-0">
                                {grupo.badge}
                              </span>
                            )}
                          </DropdownMenuItem>
                        )
                      }

                      // Se o grupo excedente tiver itens/submódulos
                      const subitens = grupo.colunas
                        ? grupo.colunas.flatMap((c) => c.itens)
                        : grupo.itens || []

                      return (
                        <div key={grupo.id} className="mb-1 last:mb-0">
                          <div className="px-2.5 py-1 text-[11px] font-bold text-blue-200 flex items-center gap-2">
                            <GroupIcon className="w-3.5 h-3.5 text-blue-300" />
                            <span>{grupo.label}</span>
                          </div>
                          <div className="space-y-0.5 pl-2">
                            {subitens.map((sub) => {
                              const SubIcon = sub.icon
                              const isSubActive =
                                location.pathname === sub.path ||
                                (sub.path.includes('novo=balanco-dre') &&
                                  location.pathname.startsWith('/empresas') &&
                                  location.search.includes('novo=balanco-dre'))
                              return (
                                <DropdownMenuItem
                                  key={sub.id}
                                  onClick={() => navigate(sub.path)}
                                  className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                                    isSubActive
                                      ? 'bg-blue-600 text-white font-bold'
                                      : 'text-slate-200 hover:bg-white/10 hover:text-white focus:bg-white/10 focus:text-white'
                                  }`}
                                >
                                  <div className="flex items-center gap-2 truncate">
                                    <SubIcon className="w-3 h-3 text-blue-200 shrink-0" />
                                    <span className="truncate">{sub.name}</span>
                                  </div>
                                  {sub.badge && (
                                    <span className="text-[8px] px-1 py-0.2 rounded font-bold uppercase bg-white/20 text-blue-100 shrink-0">
                                      {sub.badge}
                                    </span>
                                  )}
                                </DropdownMenuItem>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </nav>
          </div>
        </div>
      </header>
      {/* ========================================================
          DRAWER MOBILE (< 768px)
          Modernizado com busca e suporte aos mesmos dados ricos
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
            className="relative w-80 max-w-[85vw] text-white flex flex-col justify-between h-full p-4 sm:p-5 shadow-2xl z-10 transition-colors"
            style={{ backgroundColor: corPrimaria }}
          >
            <div>
              {/* Cabeçalho do Drawer */}
              <div className="flex items-center justify-between pb-4 border-b border-white/10">
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
                  className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 cursor-pointer"
                  aria-label="Fechar menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Botão de Busca no Mobile */}
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => {
                    setMobileDrawerOpen(false)
                    setCommandPaletteOpen(true)
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-white/12 hover:bg-blue-600/35 hover:border-blue-400/50 hover:text-white text-slate-100 text-xs border border-white/20 transition-all duration-150 cursor-pointer shadow-xs group"
                >
                  <div className="flex items-center gap-2">
                    <Search className="w-4 h-4 text-blue-300 group-hover:text-white transition-colors" />
                    <span className="font-medium">Buscar módulo ou comando...</span>
                  </div>
                  <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-black/40 rounded border border-white/20 text-slate-200 group-hover:text-white font-semibold">
                    Ctrl+K
                  </kbd>
                </button>
              </div>

              {/* Lista de navegação mobile */}
              <nav className="mt-4 space-y-1 overflow-y-auto max-h-[calc(100vh-250px)] pr-1">
                {menuGruposFiltrados.map((grupo) => {
                  const GroupIcon = grupo.icon
                  const active = isGroupActive(grupo)

                  // Link direto no mobile
                  if (grupo.tipo === 'link' && grupo.path) {
                    const isLinkActive = location.pathname === grupo.path
                    return (
                      <NavLink
                        key={grupo.id}
                        to={grupo.path}
                        onClick={() => setMobileDrawerOpen(false)}
                        className={`flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                          isLinkActive
                            ? 'bg-white/20 text-white font-semibold shadow-xs'
                            : 'text-slate-300 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <div className="flex items-center gap-3 truncate">
                          <GroupIcon
                            className={`w-4 h-4 ${isLinkActive ? 'text-white' : 'text-blue-300'}`}
                          />
                          <span className="truncate">{grupo.label}</span>
                        </div>
                        {grupo.badge && (
                          <span className="text-[9px] bg-blue-400/25 text-blue-200 border border-blue-400/30 px-1.5 py-0.5 rounded font-bold uppercase">
                            {grupo.badge}
                          </span>
                        )}
                      </NavLink>
                    )
                  }

                  // Grupo expansível (mega ou dropdown)
                  const isOpen = !!openDrawerGroups[grupo.id]

                  // Achatar itens do grupo para exibição no mobile
                  const subitens = grupo.colunas
                    ? grupo.colunas.flatMap((c) => c.itens)
                    : grupo.itens || []

                  return (
                    <div key={grupo.id} className="space-y-1">
                      <button
                        type="button"
                        onClick={() => toggleDrawerGroup(grupo.id)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                          active
                            ? 'text-white font-semibold bg-white/15 border border-white/20'
                            : 'text-slate-300 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <div className="flex items-center gap-3 truncate">
                          <GroupIcon
                            className={`w-4 h-4 ${active ? 'text-blue-200' : 'text-blue-300'}`}
                          />
                          <span className="truncate">{grupo.label}</span>
                        </div>
                        <ChevronDown
                          className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                            isOpen ? 'rotate-180 text-white' : ''
                          }`}
                        />
                      </button>

                      {isOpen && (
                        <div className="ml-3 pl-3 border-l border-blue-400/40 space-y-1 py-1 animate-in fade-in duration-150">
                          {subitens.map((item) => {
                            const SubIcon = item.icon
                            const isSubActive = item.path.includes('novo=balanco-dre')
                              ? location.pathname.startsWith('/empresas') &&
                                location.search.includes('novo=balanco-dre')
                              : item.path === '/empresas'
                                ? location.pathname.startsWith('/empresas') &&
                                  !location.search.includes('novo=balanco-dre')
                                : location.pathname === item.path

                            return (
                              <NavLink
                                key={item.id}
                                to={item.path}
                                onClick={() => setMobileDrawerOpen(false)}
                                className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                  isSubActive
                                    ? 'bg-blue-600 text-white shadow-xs'
                                    : 'text-slate-200 hover:text-white hover:bg-white/10'
                                }`}
                              >
                                <div className="flex items-center gap-2.5 truncate">
                                  <SubIcon
                                    className={`w-3.5 h-3.5 shrink-0 ${
                                      isSubActive ? 'text-white' : 'text-blue-200'
                                    }`}
                                  />
                                  <div className="flex flex-col truncate">
                                    <span className="truncate text-slate-100 hover:text-white">
                                      {item.name}
                                    </span>
                                  </div>
                                </div>
                                {item.badge && (
                                  <span className="text-[9px] bg-amber-400/30 text-amber-200 border border-amber-400/40 px-1 py-0.2 rounded font-bold uppercase shrink-0">
                                    {item.badge}
                                  </span>
                                )}
                              </NavLink>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
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
                className="w-full flex items-center justify-between p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-left cursor-pointer"
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
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-slate-200 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 transition-colors cursor-pointer"
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
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-red-300 bg-red-950/40 hover:bg-red-900/50 rounded-lg border border-red-800/40 transition-colors cursor-pointer"
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
          <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 sticky top-13 md:top-[100px] z-20 shadow-xs">
            <div>
              <h1 className="text-xl font-bold text-[#0B1F3A] tracking-tight">
                {location.pathname === '/indicadores/apresentacao' &&
                  'Apresentação Geral de Indicadores'}
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
                {location.pathname === '/indicadores/apresentacao' &&
                  'Catálogo educativo com todos os indicadores do sistema, fórmulas passo a passo, faixas e apuração em tempo real'}
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

      {/* Busca Rápida de Comandos / Telas (Ctrl+K) */}
      <CommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        itens={itensNavegaveis}
        currentPath={location.pathname}
      />
    </div>
  )
}
