import React, { useState } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useFilter } from '@/contexts/FilterContext'
import {
  Scale,
  LayoutDashboard,
  Building2,
  PieChart,
  Tags,
  FileText,
  Upload,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Calendar,
  Building,
} from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
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

  const navigate = useNavigate()
  const location = useLocation()
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)

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

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Empresas', path: '/empresas', icon: Building2 },
    { name: 'Centros de Custo', path: '/centros', icon: PieChart },
    { name: 'Tipos de Despesas', path: '/tipos-despesas', icon: Tags },
    { name: 'Relatórios', path: '/relatorios', icon: FileText },
  ]

  const userInitial = user?.name ? user.name.charAt(0).toUpperCase() : 'U'
  const userName = user?.name || 'Consultor Financeiro'
  const userEmail = user?.email || 'usuario@sistema.com'

  const showHeaderFilters =
    location.pathname === '/dashboard' ||
    location.pathname === '/relatorios' ||
    location.pathname.startsWith('/empresas/')

  return (
    <div className="min-h-screen bg-[#F5F7FA] flex flex-col antialiased text-slate-800">
      {/* Mobile Topbar (< 768px) */}
      <header className="md:hidden sticky top-0 z-40 h-16 bg-[#0B1F3A] text-white px-4 flex items-center justify-between border-b border-blue-950 shadow-md">
        <button
          onClick={() => setMobileDrawerOpen(true)}
          className="p-2 -ml-2 rounded-lg text-slate-200 hover:text-white hover:bg-white/10 transition-colors"
          aria-label="Abrir menu"
        >
          <Menu className="w-6 h-6" />
        </button>

        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white">
            <Scale className="w-4 h-4" />
          </div>
          <span className="font-bold text-base tracking-tight text-white">Analise de Balanço</span>
        </div>

        <Avatar className="w-8 h-8 border border-white/20 bg-blue-700 text-white text-xs font-semibold">
          <AvatarFallback className="bg-blue-600 text-white">{userInitial}</AvatarFallback>
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
          <div className="relative w-72 max-w-[80vw] bg-[#0B1F3A] text-white flex flex-col justify-between h-full p-5 shadow-2xl z-10">
            <div>
              <div className="flex items-center justify-between pb-6 border-b border-white/10">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md">
                    <Scale className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="font-bold text-sm block leading-tight text-white">
                      Analise de Balanço
                    </span>
                    <span className="text-[10px] text-blue-300 uppercase tracking-wider font-semibold">
                      Consultoria
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

              <nav className="mt-6 space-y-1.5">
                {navItems.map((item) => {
                  const Icon = item.icon
                  const isActive =
                    item.path === '/empresas'
                      ? location.pathname.startsWith('/empresas')
                      : location.pathname === item.path
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={() => setMobileDrawerOpen(false)}
                      className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                        isActive
                          ? 'bg-white/15 text-white font-semibold shadow-inner'
                          : 'text-slate-300 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <Icon className="w-4 h-4 text-blue-400" />
                      {item.name}
                    </NavLink>
                  )
                })}
              </nav>
            </div>

            {/* Footer Drawer */}
            <div className="pt-4 border-t border-white/10">
              <div className="flex items-center gap-3 mb-4 px-2">
                <Avatar className="w-9 h-9 border border-white/20">
                  <AvatarFallback className="bg-blue-600 text-white font-semibold text-xs">
                    {userInitial}
                  </AvatarFallback>
                </Avatar>
                <div className="overflow-hidden">
                  <p className="text-sm font-semibold text-white truncate">{userName}</p>
                  <p className="text-xs text-slate-400 truncate">{userEmail}</p>
                </div>
              </div>
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
        <aside className="hidden md:flex flex-col justify-between bg-[#0B1F3A] text-white shrink-0 md:w-[60px] lg:w-[264px] transition-all duration-200 z-30 select-none border-r border-blue-950">
          <div>
            {/* Logo */}
            <div className="h-16 flex items-center px-3.5 lg:px-5 border-b border-white/10">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shrink-0 shadow-md">
                  <Scale className="w-5 h-5" />
                </div>
                <div className="hidden lg:block truncate">
                  <span className="font-bold text-base text-white tracking-tight leading-tight block">
                    Analise de Balanço
                  </span>
                  <span className="text-[10px] text-blue-300 uppercase tracking-widest font-semibold block">
                    Consultoria Financeira
                  </span>
                </div>
              </div>
            </div>

            {/* Nav */}
            <nav className="p-2 lg:p-3 space-y-1.5 mt-2">
              {navItems.map((item) => {
                const Icon = item.icon
                const isActive =
                  item.path === '/empresas'
                    ? location.pathname.startsWith('/empresas')
                    : location.pathname === item.path

                const content = (
                  <NavLink
                    to={item.path}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-white/15 text-white font-semibold shadow-sm'
                        : 'text-slate-300 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Icon
                      className={`w-5 h-5 shrink-0 ${isActive ? 'text-blue-300' : 'text-slate-400'}`}
                    />
                    <span className="hidden lg:inline truncate">{item.name}</span>
                  </NavLink>
                )

                return (
                  <div key={item.path}>
                    <div className="lg:hidden">
                      <Tooltip>
                        <TooltipTrigger asChild>{content}</TooltipTrigger>
                        <TooltipContent
                          side="right"
                          className="bg-[#0B1F3A] text-white border-blue-900"
                        >
                          {item.name}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <div className="hidden lg:block">{content}</div>
                  </div>
                )
              })}
            </nav>
          </div>

          {/* User Profile & Logout Bottom */}
          <div className="p-2 lg:p-3 border-t border-white/10">
            {/* Desktop User Card */}
            <div className="hidden lg:flex items-center justify-between p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
              <div className="flex items-center gap-2.5 overflow-hidden">
                <Avatar className="w-8 h-8 border border-white/20 bg-blue-600 shrink-0">
                  <AvatarFallback className="bg-blue-600 text-white font-semibold text-xs">
                    {userInitial}
                  </AvatarFallback>
                </Avatar>
                <div className="overflow-hidden">
                  <p className="text-xs font-semibold text-white truncate leading-tight">
                    {userName}
                  </p>
                  <p className="text-[11px] text-blue-200/70 truncate">{userEmail}</p>
                </div>
              </div>
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

            {/* Tablet Minimal Logout */}
            <div className="lg:hidden flex flex-col items-center gap-2 py-1">
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
                  {location.pathname.startsWith('/empresas/') && 'Análise da Empresa'}
                </h1>
                <p className="text-xs text-[#5B6B7F]">
                  {location.pathname === '/dashboard' &&
                    'Visão consolidada de indicadores e evolução patrimonial'}
                  {location.pathname === '/relatorios' &&
                    'Gere relatórios executivos para impressão ou exportação'}
                  {location.pathname.startsWith('/empresas/') &&
                    'Diagnóstico detalhado de Balanço, DRE e Indicadores'}
                </p>
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
    </div>
  )
}
