import React, { useState } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  Scale,
  LogOut,
  ChevronDown,
  ChevronRight,
  Building,
  Calendar,
  Search,
  Settings,
  Bell,
  PanelLeftClose,
  PanelLeft,
  Columns,
  Rows,
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { SelectEmpresaOuGrupoItems } from '@/components/SelectEmpresaOuGrupoItems'
import type { NavGroupConfig, NavItemConfig } from '@/lib/menuNavigationConfig'
import { cn } from '@/lib/utils'

interface VerticalSidebarProps {
  menuGruposFiltrados: NavGroupConfig[]
  isGroupActive: (grupo: NavGroupConfig) => boolean
  balancoDreUrl: string
  corPrimaria?: string
  corSecundaria?: string
  minhaEmpresa?: any
  logoUrl?: string | null
  user: any
  userName: string
  userEmail: string
  userRole: string
  userInitial: string
  isUserAdmin: boolean
  isUserFinanceiro: boolean
  isUserComercial: boolean
  logout: () => void
  onOpenPerfil: () => void
  onOpenSearch: () => void
  // Alternância de orientação
  menuOrientation: 'vertical' | 'horizontal'
  onToggleOrientation: () => void
  // Colapso da sidebar
  isCollapsed: boolean
  onToggleCollapse: () => void
  // Seletores globais integrados na sidebar
  selectedEmpresaId: string
  setSelectedEmpresaId: (id: string) => void
  selectedAno: number
  setSelectedAno: (ano: number) => void
  todasEntidades: any[]
  empresas: any[]
  anosDisponiveis: number[]
}

export function VerticalSidebar({
  menuGruposFiltrados,
  isGroupActive,
  corPrimaria = '#0B1F3A',
  corSecundaria = '#2563EB',
  minhaEmpresa,
  logoUrl,
  user,
  userName,
  userEmail,
  userRole,
  userInitial,
  isUserAdmin,
  isUserFinanceiro,
  isUserComercial,
  logout,
  onOpenPerfil,
  onOpenSearch,
  menuOrientation,
  onToggleOrientation,
  isCollapsed,
  onToggleCollapse,
  selectedEmpresaId,
  setSelectedEmpresaId,
  selectedAno,
  setSelectedAno,
  todasEntidades,
  empresas,
  anosDisponiveis,
}: VerticalSidebarProps) {
  const navigate = useNavigate()
  const location = useLocation()

  // Estado dos acordeões abertos na sidebar (por id do grupo)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    // Inicia com grupos ativos abertos
    const initial: Record<string, boolean> = {}
    menuGruposFiltrados.forEach((g) => {
      if (isGroupActive(g)) {
        initial[g.id] = true
      }
    })
    return initial
  })

  const toggleGroup = (groupId: string) => {
    setOpenGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }))
  }

  const isItemActive = (path: string) => {
    if (path.includes('novo=balanco-dre')) {
      return (
        location.pathname.startsWith('/empresas') && location.search.includes('novo=balanco-dre')
      )
    }
    if (path === '/empresas') {
      return (
        location.pathname.startsWith('/empresas') && !location.search.includes('novo=balanco-dre')
      )
    }
    if (path === '/dashboard-bi') {
      return location.pathname === '/dashboard-bi' || location.pathname === '/bi'
    }
    return location.pathname === path
  }

  const renderBadge = (badge?: string, variant?: string) => {
    if (!badge) return null
    let colorClass = 'bg-blue-500/30 text-blue-100 border-blue-400/40'
    if (variant === 'amber') colorClass = 'bg-amber-500/30 text-amber-200 border-amber-400/50'
    if (variant === 'emerald')
      colorClass = 'bg-emerald-500/30 text-emerald-200 border-emerald-400/50'
    if (variant === 'purple') colorClass = 'bg-purple-500/30 text-purple-200 border-purple-400/50'

    return (
      <span
        className={cn(
          'text-[9px] px-1.5 py-0.2 rounded font-bold uppercase tracking-wider border shrink-0',
          colorClass,
        )}
      >
        {badge}
      </span>
    )
  }

  return (
    <TooltipProvider delayDuration={150}>
      <aside
        className={cn(
          'shrink-0 h-full text-white flex flex-col justify-between border-r border-slate-800/50 shadow-xl transition-all duration-300 z-30 select-none relative',
          isCollapsed ? 'w-[72px]' : 'w-[264px]',
        )}
        style={{ backgroundColor: corPrimaria }}
      >
        {/* ========================================================
            TOPO DA SIDEBAR: LOGO + MARCA + CONTROLES DE LAYOUT
        ======================================================== */}
        <div className="shrink-0 border-b border-white/10 p-3">
          <div className="flex items-center justify-between gap-2">
            {/* Logotipo / Nome do Sistema */}
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className={cn(
                'flex items-center gap-2.5 text-left group focus:outline-hidden cursor-pointer transition-transform duration-150 active:scale-[0.98] min-w-0',
                isCollapsed && 'justify-center w-full',
              )}
              title={
                minhaEmpresa?.nome_fantasia ||
                minhaEmpresa?.razao_social ||
                'Gestão Econômica e Financeira'
              }
            >
              {logoUrl ? (
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center p-1 shrink-0 shadow-sm overflow-hidden border border-white/20 group-hover:border-white/40 transition-all">
                  <img
                    src={logoUrl}
                    alt={minhaEmpresa?.nome_fantasia || 'Logo'}
                    className="w-full h-full object-contain"
                  />
                </div>
              ) : (
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm border border-white/20"
                  style={{ backgroundColor: corSecundaria }}
                >
                  <Scale className="w-5 h-5" />
                </div>
              )}

              {!isCollapsed && (
                <div className="truncate">
                  <span className="font-bold text-xs text-white tracking-tight leading-tight block truncate group-hover:text-blue-200 transition-colors">
                    {minhaEmpresa?.nome_fantasia ||
                      minhaEmpresa?.razao_social ||
                      'Gestão Financeira'}
                  </span>
                  <span className="text-[9.5px] text-blue-200/90 uppercase tracking-wider font-medium block truncate">
                    {minhaEmpresa?.razao_social ? 'Econômica & Financeira' : 'Análise de Balanço'}
                  </span>
                </div>
              )}
            </button>

            {/* Ações do cabeçalho quando expandido: recolher sidebar */}
            {!isCollapsed && (
              <div className="flex items-center gap-1 shrink-0">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={onToggleCollapse}
                      className="p-1.5 rounded-lg text-blue-200/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                      aria-label="Recolher menu lateral"
                    >
                      <PanelLeftClose className="w-4 h-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent
                    side="right"
                    className="bg-[#0B1F3A] text-white border-slate-700 text-xs"
                  >
                    Recolher barra lateral
                  </TooltipContent>
                </Tooltip>
              </div>
            )}
          </div>

          {/* Botão de expandir quando colapsado */}
          {isCollapsed && (
            <div className="mt-2 flex justify-center">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={onToggleCollapse}
                    className="p-1.5 rounded-lg text-blue-200/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                    aria-label="Expandir menu lateral"
                  >
                    <PanelLeft className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="right"
                  className="bg-[#0B1F3A] text-white border-slate-700 text-xs"
                >
                  Expandir barra lateral
                </TooltipContent>
              </Tooltip>
            </div>
          )}

          {/* Busca rápida e alternador quando expandido */}
          {!isCollapsed && (
            <div className="mt-2.5 flex items-center gap-1.5">
              <button
                type="button"
                onClick={onOpenSearch}
                className="flex-1 flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs text-slate-200 hover:text-white transition-all cursor-pointer group shadow-xs"
                title="Pressione Ctrl+K para buscar"
              >
                <div className="flex items-center gap-2 truncate">
                  <Search className="w-3.5 h-3.5 text-blue-200 group-hover:text-white shrink-0" />
                  <span className="truncate text-[11px] font-medium">Buscar módulo...</span>
                </div>
                <kbd className="px-1 py-0.2 text-[9px] font-mono bg-black/30 border border-white/20 rounded text-slate-200 group-hover:text-white shrink-0">
                  ⌘K
                </kbd>
              </button>

              {/* Botão alternar para Horizontal */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={onToggleOrientation}
                    className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-blue-200 hover:text-white transition-all cursor-pointer shrink-0"
                    aria-label="Alternar para menu horizontal no topo"
                  >
                    <Rows className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="bottom"
                  className="bg-[#0B1F3A] text-white border-slate-700 text-xs"
                >
                  Mudar para Menu Horizontal (Topo)
                </TooltipContent>
              </Tooltip>
            </div>
          )}

          {/* Seletores rápidos integrados na sidebar (quando expandida) */}
          {!isCollapsed && (
            <div className="mt-2 space-y-1.5 pt-2 border-t border-white/10">
              {/* Seletor Empresa */}
              <div className="flex items-center gap-1.5 bg-white/10 border border-white/15 rounded-xl px-2 py-1 text-xs">
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
                    <SelectTrigger className="h-6 border-none shadow-none bg-transparent text-xs font-semibold text-white p-0 focus:ring-0 w-full cursor-pointer">
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
                    className="flex items-center justify-between w-full py-0.5 text-xs font-semibold text-white truncate"
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
              <div className="flex items-center justify-between bg-white/10 border border-white/15 rounded-xl px-2 py-1 text-xs">
                <div className="flex items-center gap-1.5 text-slate-200">
                  <Calendar className="w-3.5 h-3.5 text-blue-200 shrink-0" />
                  <span className="text-[11px] font-medium text-blue-100">Exercício:</span>
                </div>
                <Select
                  value={String(selectedAno)}
                  onValueChange={(val) => setSelectedAno(Number(val))}
                >
                  <SelectTrigger className="h-5 border-none shadow-none bg-transparent text-xs font-semibold text-white p-0 focus:ring-0 w-[60px] cursor-pointer text-right">
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
          )}

          {/* Ícones de atalhos rápidos quando colapsado */}
          {isCollapsed && (
            <div className="mt-2 flex flex-col items-center gap-1.5 pt-2 border-t border-white/10">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={onOpenSearch}
                    className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-blue-200 hover:text-white transition-colors cursor-pointer"
                    aria-label="Buscar"
                  >
                    <Search className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="right"
                  className="bg-[#0B1F3A] text-white border-slate-700 text-xs"
                >
                  Buscar (Ctrl+K)
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={onToggleOrientation}
                    className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-blue-200 hover:text-white transition-colors cursor-pointer"
                    aria-label="Mudar para Menu Horizontal"
                  >
                    <Rows className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="right"
                  className="bg-[#0B1F3A] text-white border-slate-700 text-xs"
                >
                  Mudar para Menu Horizontal (Topo)
                </TooltipContent>
              </Tooltip>
            </div>
          )}
        </div>

        {/* ========================================================
            CORPO DA SIDEBAR: LISTA DE NAVEGAÇÃO DOS GRUPOS
        ======================================================== */}
        <div className="flex-1 overflow-y-auto px-2 py-3 space-y-1 scrollbar-thin scrollbar-thumb-white/20">
          {menuGruposFiltrados.map((grupo) => {
            const GroupIcon = grupo.icon
            const active = isGroupActive(grupo)

            // Caso 1: Link direto (sem submenu)
            if (grupo.tipo === 'link' && grupo.path) {
              const isDirectActive = location.pathname === grupo.path

              if (isCollapsed) {
                return (
                  <Tooltip key={grupo.id}>
                    <TooltipTrigger asChild>
                      <NavLink
                        to={grupo.path}
                        className={cn(
                          'w-full flex items-center justify-center p-2.5 rounded-xl transition-all cursor-pointer my-0.5',
                          isDirectActive
                            ? 'bg-blue-600 text-white shadow-md ring-1 ring-blue-400/50'
                            : 'text-slate-200 hover:text-white hover:bg-white/10',
                        )}
                      >
                        <GroupIcon className="w-5 h-5 shrink-0" />
                      </NavLink>
                    </TooltipTrigger>
                    <TooltipContent
                      side="right"
                      className="bg-[#0B1F3A] text-white border-slate-700 text-xs"
                    >
                      <div className="font-semibold">{grupo.label}</div>
                      {grupo.subtitulo && (
                        <div className="text-[10px] text-blue-200">{grupo.subtitulo}</div>
                      )}
                    </TooltipContent>
                  </Tooltip>
                )
              }

              return (
                <NavLink
                  key={grupo.id}
                  to={grupo.path}
                  className={cn(
                    'flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer',
                    isDirectActive
                      ? 'bg-blue-600 text-white shadow-md ring-1 ring-blue-400/50'
                      : 'text-slate-200 hover:text-white hover:bg-white/10',
                  )}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <GroupIcon
                      className={cn(
                        'w-4 h-4 shrink-0',
                        isDirectActive ? 'text-white' : 'text-blue-200',
                      )}
                    />
                    <span className="truncate">{grupo.label}</span>
                  </div>
                  {grupo.badge && renderBadge(grupo.badge)}
                </NavLink>
              )
            }

            // Subitens do grupo (seja mega com colunas ou dropdown)
            const subitens: NavItemConfig[] = grupo.colunas
              ? grupo.colunas.flatMap((c) => c.itens)
              : grupo.itens || []

            // Caso 2: Sidebar COLAPSADA com Popover Dropdown
            if (isCollapsed) {
              return (
                <DropdownMenu key={grupo.id}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className={cn(
                            'w-full flex items-center justify-center p-2.5 rounded-xl transition-all cursor-pointer my-0.5 outline-none',
                            active
                              ? 'bg-white/20 text-white shadow-xs ring-1 ring-white/30'
                              : 'text-slate-200 hover:text-white hover:bg-white/10',
                          )}
                          aria-label={grupo.label}
                        >
                          <GroupIcon className="w-5 h-5 shrink-0" />
                        </button>
                      </DropdownMenuTrigger>
                    </TooltipTrigger>
                    <TooltipContent
                      side="right"
                      className="bg-[#0B1F3A] text-white border-slate-700 text-xs"
                    >
                      {grupo.label}
                    </TooltipContent>
                  </Tooltip>

                  <DropdownMenuContent
                    side="right"
                    align="start"
                    sideOffset={12}
                    className="w-72 bg-[#0B1F3A] border-slate-700/80 text-white shadow-2xl rounded-2xl p-2.5 z-50 backdrop-blur-md"
                  >
                    <div className="px-2.5 py-1.5 border-b border-white/10 mb-1.5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <GroupIcon className="w-4 h-4 text-blue-300" />
                        <span className="text-xs font-bold text-white">{grupo.label}</span>
                      </div>
                      {grupo.badge && renderBadge(grupo.badge)}
                    </div>
                    {grupo.subtitulo && (
                      <p className="px-2.5 text-[10.5px] text-blue-200/80 mb-2 font-medium">
                        {grupo.subtitulo}
                      </p>
                    )}

                    <div className="space-y-0.5 max-h-[360px] overflow-y-auto pr-1">
                      {subitens.map((item) => {
                        const ItemIcon = item.icon
                        const isSubActive = isItemActive(item.path)

                        return (
                          <DropdownMenuItem
                            key={item.id}
                            onClick={() => navigate(item.path)}
                            className={cn(
                              'flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl text-xs cursor-pointer transition-colors',
                              isSubActive
                                ? 'bg-blue-600 text-white font-bold'
                                : 'text-slate-200 hover:bg-white/10 hover:text-white focus:bg-white/10 focus:text-white',
                            )}
                          >
                            <div className="flex items-center gap-2.5 truncate">
                              <ItemIcon
                                className={cn(
                                  'w-3.5 h-3.5 shrink-0',
                                  isSubActive ? 'text-white' : 'text-blue-200',
                                )}
                              />
                              <div className="flex flex-col truncate">
                                <span className="truncate">{item.name}</span>
                                {item.descricao && (
                                  <span className="text-[10px] text-blue-200/70 truncate">
                                    {item.descricao}
                                  </span>
                                )}
                              </div>
                            </div>
                            {item.badge && renderBadge(item.badge, item.badgeVariant)}
                          </DropdownMenuItem>
                        )
                      })}
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
              )
            }

            // Caso 3: Sidebar EXPANDIDA com Acordeão
            const isOpen = !!openGroups[grupo.id]

            return (
              <div key={grupo.id} className="space-y-0.5">
                <button
                  type="button"
                  onClick={() => toggleGroup(grupo.id)}
                  className={cn(
                    'w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer select-none',
                    active
                      ? 'bg-white/15 text-white ring-1 ring-white/20'
                      : 'text-slate-200 hover:text-white hover:bg-white/10',
                  )}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <GroupIcon
                      className={cn('w-4 h-4 shrink-0', active ? 'text-white' : 'text-blue-200')}
                    />
                    <span className="truncate">{grupo.label}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {grupo.badge && renderBadge(grupo.badge)}
                    <ChevronDown
                      className={cn(
                        'w-3.5 h-3.5 text-blue-200 transition-transform duration-200',
                        isOpen && 'rotate-180 text-white',
                      )}
                    />
                  </div>
                </button>

                {/* Subitens expandidos */}
                {isOpen && (
                  <div className="ml-3 pl-2.5 border-l border-white/15 space-y-0.5 py-1 animate-in fade-in duration-150">
                    {subitens.map((item) => {
                      const ItemIcon = item.icon
                      const isSubActive = isItemActive(item.path)

                      return (
                        <NavLink
                          key={item.id}
                          to={item.path}
                          className={cn(
                            'flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11.5px] transition-all cursor-pointer font-medium',
                            isSubActive
                              ? 'bg-blue-600 text-white font-bold shadow-xs'
                              : 'text-slate-300 hover:text-white hover:bg-white/10',
                          )}
                          title={item.descricao}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <ItemIcon
                              className={cn(
                                'w-3 h-3 shrink-0',
                                isSubActive ? 'text-white' : 'text-blue-200/90',
                              )}
                            />
                            <span className="truncate">{item.name}</span>
                          </div>
                          {item.badge && renderBadge(item.badge, item.badgeVariant)}
                        </NavLink>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* ========================================================
            RODAPÉ DA SIDEBAR: CARTÃO DO USUÁRIO + BOTÃO SAIR
        ======================================================== */}
        <div className="shrink-0 border-t border-white/10 p-2.5 bg-black/15">
          {isCollapsed ? (
            <div className="flex flex-col items-center gap-2">
              <DropdownMenu>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="cursor-pointer outline-none hover:ring-2 hover:ring-blue-400/50 rounded-full"
                      >
                        <Avatar
                          className="w-8 h-8 border border-white/20 text-white text-xs font-semibold"
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
                      </button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent
                    side="right"
                    className="bg-[#0B1F3A] text-white border-slate-700 text-xs"
                  >
                    {userName} ({userRole})
                  </TooltipContent>
                </Tooltip>

                <DropdownMenuContent
                  side="right"
                  align="end"
                  sideOffset={12}
                  className="w-64 bg-[#0B1F3A] border-slate-700/80 text-white shadow-2xl rounded-2xl p-2 z-50 backdrop-blur-md"
                >
                  <div className="flex items-center gap-3 p-2.5 rounded-xl bg-white/5 border border-white/10 mb-1">
                    <Avatar
                      className="w-9 h-9 border border-white/20 shrink-0"
                      style={{ backgroundColor: corSecundaria }}
                    >
                      {user?.avatar && (
                        <AvatarImage src={pb.files.getURL(user, user.avatar)} alt={userName} />
                      )}
                      <AvatarFallback className="text-white font-bold text-xs">
                        {userInitial}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-white truncate">{userName}</p>
                      <p className="text-[10px] text-blue-200/80 truncate">{userEmail}</p>
                    </div>
                  </div>

                  <DropdownMenuSeparator className="bg-white/10 my-1" />

                  <DropdownMenuItem
                    onClick={() => navigate('/configuracoes')}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-200 hover:bg-white/10 hover:text-white cursor-pointer focus:bg-white/10 focus:text-white"
                  >
                    <Settings className="w-4 h-4 text-slate-300" />
                    <span>Configurações</span>
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onClick={onOpenPerfil}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-200 hover:bg-white/10 hover:text-white cursor-pointer focus:bg-white/10 focus:text-white"
                  >
                    <Bell className="w-4 h-4 text-blue-300" />
                    <span>Alertas & Preferências</span>
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onClick={() => navigate('/minha-empresa')}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-200 hover:bg-white/10 hover:text-white cursor-pointer focus:bg-white/10 focus:text-white"
                  >
                    <Building className="w-4 h-4 text-emerald-400" />
                    <span>Minha Consultoria</span>
                  </DropdownMenuItem>

                  <DropdownMenuSeparator className="bg-white/10 my-1" />

                  <DropdownMenuItem
                    onClick={logout}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-red-300 bg-red-950/30 hover:bg-red-900/50 hover:text-red-100 cursor-pointer focus:bg-red-900/50 focus:text-red-100 border border-red-800/30"
                  >
                    <LogOut className="w-4 h-4 text-red-400" />
                    <span>Sair do sistema</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Botão Sair direto quando colapsado */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={logout}
                    className="p-2 rounded-xl text-red-300 hover:text-red-100 hover:bg-red-950/50 transition-colors cursor-pointer"
                    aria-label="Sair"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="right"
                  className="bg-[#0B1F3A] text-white border-slate-700 text-xs"
                >
                  Sair do sistema
                </TooltipContent>
              </Tooltip>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Card do Usuário */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-white/10 transition-colors text-left cursor-pointer outline-hidden group border border-transparent hover:border-white/15"
                  >
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      <Avatar
                        className="w-8 h-8 border border-white/20 shrink-0"
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
                      <div className="overflow-hidden">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-bold text-white truncate group-hover:text-blue-200 transition-colors">
                            {userName}
                          </p>
                        </div>
                        <p className="text-[10px] text-blue-200/80 truncate">{userEmail}</p>
                      </div>
                    </div>
                    <ChevronDown className="w-3.5 h-3.5 text-blue-200/70 shrink-0 group-hover:text-white" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  side="top"
                  align="start"
                  sideOffset={8}
                  className="w-64 bg-[#0B1F3A] border-slate-700/80 text-white shadow-2xl rounded-2xl p-2 z-50 backdrop-blur-md"
                >
                  <div className="flex items-center gap-3 p-2 rounded-xl bg-white/5 border border-white/10 mb-1">
                    <Avatar
                      className="w-9 h-9 border border-white/20 shrink-0"
                      style={{ backgroundColor: corSecundaria }}
                    >
                      {user?.avatar && (
                        <AvatarImage src={pb.files.getURL(user, user.avatar)} alt={userName} />
                      )}
                      <AvatarFallback className="text-white font-bold text-xs">
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
                      <p className="text-[10.5px] text-blue-200/70 truncate mt-0.5">{userEmail}</p>
                    </div>
                  </div>

                  <DropdownMenuSeparator className="bg-white/10 my-1" />

                  <DropdownMenuItem
                    onClick={() => navigate('/configuracoes')}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-200 hover:bg-white/10 hover:text-white cursor-pointer focus:bg-white/10 focus:text-white"
                  >
                    <Settings className="w-4 h-4 text-slate-300" />
                    <span>Configurações do Sistema</span>
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onClick={onOpenPerfil}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-200 hover:bg-white/10 hover:text-white cursor-pointer focus:bg-white/10 focus:text-white"
                  >
                    <Bell className="w-4 h-4 text-blue-300" />
                    <span>Alertas & Preferências</span>
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onClick={() => navigate('/minha-empresa')}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-200 hover:bg-white/10 hover:text-white cursor-pointer focus:bg-white/10 focus:text-white"
                  >
                    <Building className="w-4 h-4 text-emerald-400" />
                    <span>Dados da Minha Consultoria</span>
                  </DropdownMenuItem>

                  <DropdownMenuSeparator className="bg-white/10 my-1" />

                  <DropdownMenuItem
                    onClick={logout}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-red-300 bg-red-950/30 hover:bg-red-900/50 hover:text-red-100 cursor-pointer focus:bg-red-900/50 focus:text-red-100 border border-red-800/30"
                  >
                    <LogOut className="w-4 h-4 text-red-400" />
                    <span>Sair do sistema</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Botão de alternar orientação visível no rodapé */}
              <button
                type="button"
                onClick={onToggleOrientation}
                className="w-full flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-medium text-blue-100 hover:text-white bg-white/10 hover:bg-white/15 rounded-xl border border-white/15 transition-all cursor-pointer shadow-xs"
                title="Mudar visualização para barra superior horizontal"
              >
                <Rows className="w-3.5 h-3.5 text-blue-200" />
                <span>Mudar para Menu Horizontal</span>
              </button>

              {/* Botão Sair */}
              <button
                type="button"
                onClick={logout}
                className="w-full flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-semibold text-red-300 bg-red-950/40 hover:bg-red-900/50 hover:text-red-100 rounded-xl border border-red-800/40 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sair do sistema</span>
              </button>
            </div>
          )}
        </div>
      </aside>
    </TooltipProvider>
  )
}
