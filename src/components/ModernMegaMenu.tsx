import React, { useState, useRef, useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { ChevronDown, ArrowRight, Sparkles, Check, ExternalLink } from 'lucide-react'
import type { NavGroupConfig, NavItemConfig } from '@/lib/menuNavigationConfig'
import { cn } from '@/lib/utils'

interface ModernMegaMenuProps {
  grupo: NavGroupConfig
  isActive: boolean
  balancoDreUrl: string
}

export function ModernMegaMenu({ grupo, isActive, balancoDreUrl }: ModernMegaMenuProps) {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const clearTimer = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }

  const handleMouseEnter = () => {
    clearTimer()
    setOpen(true)
  }

  const handleMouseLeave = () => {
    clearTimer()
    timeoutRef.current = setTimeout(() => {
      setOpen(false)
    }, 200)
  }

  const handleTriggerClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    clearTimer()
    setOpen((prev) => !prev)
  }

  // Fecha menu ao navegar, ao clicar fora ou ao pressionar Escape
  useEffect(() => {
    setOpen(false)
  }, [location.pathname, location.search])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
      clearTimer()
    }
  }, [])

  const GroupIcon = grupo.icon

  // Verifica se o item específico está ativo
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
          'text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider border shrink-0',
          colorClass,
        )}
      >
        {badge}
      </span>
    )
  }

  const renderItemCard = (item: NavItemConfig) => {
    const ItemIcon = item.icon
    const active = isItemActive(item.path)

    return (
      <NavLink
        key={item.id}
        to={item.path}
        className={cn(
          'group flex items-start gap-3 p-2.5 rounded-xl transition-all duration-150 outline-none select-none text-left relative',
          active
            ? 'bg-blue-600/40 border border-blue-400/60 text-white shadow-sm ring-1 ring-blue-400/30'
            : item.destaque
              ? 'bg-white/8 hover:bg-white/16 border border-amber-400/40 text-white hover:border-amber-300/60'
              : 'hover:bg-white/12 text-slate-100 hover:text-white border border-transparent hover:border-white/15',
        )}
      >
        <div
          className={cn(
            'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 transition-colors duration-150',
            active
              ? 'bg-blue-500 text-white shadow-xs'
              : item.destaque
                ? 'bg-amber-500/25 text-amber-200 group-hover:bg-amber-500 group-hover:text-white'
                : 'bg-white/15 text-blue-200 group-hover:bg-blue-600 group-hover:text-white',
          )}
        >
          <ItemIcon className="w-4 h-4" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1.5">
            <span
              className={cn(
                'text-xs font-bold tracking-tight truncate transition-colors',
                active ? 'text-white' : 'text-slate-50 group-hover:text-white',
              )}
            >
              {item.name}
            </span>
            <div className="flex items-center gap-1 shrink-0">
              {renderBadge(item.badge, item.badgeVariant)}
              {active && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-xs shadow-emerald-400/60" />
              )}
            </div>
          </div>

          {item.descricao && (
            <p
              className={cn(
                'text-[11px] leading-snug mt-0.5 line-clamp-2 transition-colors font-medium',
                active ? 'text-blue-100' : 'text-slate-300 group-hover:text-slate-100',
              )}
            >
              {item.descricao}
            </p>
          )}
        </div>
      </NavLink>
    )
  }

  // LINK DIRETO (sem dropdown)
  if (grupo.tipo === 'link' && grupo.path) {
    const isDirectActive = location.pathname === grupo.path
    return (
      <NavLink
        to={grupo.path}
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs lg:text-sm font-semibold whitespace-nowrap transition-all duration-150 cursor-pointer select-none',
          isDirectActive
            ? 'bg-white/20 text-white shadow-xs ring-1 ring-white/30'
            : 'text-slate-100 hover:text-white hover:bg-white/10',
        )}
      >
        <GroupIcon
          className={cn(
            'w-3.5 h-3.5 transition-colors',
            isDirectActive ? 'text-white' : 'text-blue-200',
          )}
        />
        <span>{grupo.label}</span>
        {grupo.badge && (
          <span className="text-[9px] bg-blue-500/30 text-blue-100 border border-blue-400/40 px-1 py-0.2 rounded font-bold uppercase">
            {grupo.badge}
          </span>
        )}
      </NavLink>
    )
  }

  const isMega = grupo.tipo === 'mega' && grupo.colunas && grupo.colunas.length > 0
  const columnCount = isMega ? grupo.colunas!.length : 1

  return (
    <div
      ref={containerRef}
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Botão Gatilho do Grupo */}
      <button
        type="button"
        onClick={handleTriggerClick}
        aria-expanded={open}
        aria-haspopup="true"
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs lg:text-sm font-semibold whitespace-nowrap transition-all duration-150 cursor-pointer select-none outline-none focus-visible:ring-2 focus-visible:ring-blue-300',
          isActive
            ? 'bg-white/20 text-white shadow-xs ring-1 ring-white/30'
            : open
              ? 'bg-white/20 text-white'
              : 'text-slate-100 hover:text-white hover:bg-white/10',
        )}
      >
        <GroupIcon
          className={cn('w-3.5 h-3.5 transition-colors', isActive ? 'text-white' : 'text-blue-200')}
        />
        <span>{grupo.label}</span>
        <ChevronDown
          className={cn(
            'w-3.5 h-3.5 transition-transform duration-200',
            open ? 'rotate-180 text-white opacity-100' : 'text-slate-200 opacity-80',
          )}
        />
      </button>

      {/* Painel Suspenso (Dropdown Tradicional ou Mega Menu Expandido) */}
      {open && (
        <div
          className={cn(
            'absolute top-full left-0 pt-2 z-50 animate-in fade-in slide-in-from-top-1 duration-150',
            // Alinhamentos inteligentes dependendo do tipo e largura
            isMega
              ? columnCount >= 3
                ? 'w-[780px] -left-12 lg:-left-20 xl:-left-24 max-w-[92vw]'
                : 'w-[580px] -left-8 lg:-left-12 max-w-[90vw]'
              : 'w-[290px] left-0',
          )}
        >
          <div className="bg-[#0B1F3A] border border-slate-600/90 rounded-2xl shadow-2xl overflow-hidden p-3.5 text-white ring-1 ring-white/10">
            {/* Cabeçalho do Menu com Subtítulo */}
            <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-white/15 px-1">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 rounded-md bg-blue-500/25 text-blue-200 flex items-center justify-center shrink-0 border border-blue-400/40">
                  <GroupIcon className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-white tracking-tight leading-tight truncate">
                    {grupo.label}
                  </h4>
                  {grupo.subtitulo && (
                    <p className="text-[10px] text-blue-100 font-medium truncate">
                      {grupo.subtitulo}
                    </p>
                  )}
                </div>
              </div>
              <span className="text-[9px] font-mono uppercase text-slate-200 bg-white/10 px-2 py-0.5 rounded border border-white/15 font-semibold">
                {isMega ? 'Painel Expandido' : 'Módulos'}
              </span>
            </div>

            {/* Conteúdo: Mega Menu por Colunas */}
            {isMega && grupo.colunas && (
              <div
                className={cn(
                  'grid gap-3',
                  columnCount === 2 && 'grid-cols-2',
                  columnCount >= 3 && 'grid-cols-3',
                )}
              >
                {grupo.colunas.map((col, idx) => (
                  <div
                    key={col.titulo || idx}
                    className="flex flex-col gap-1.5 p-2 rounded-xl bg-white/[0.06] border border-white/10"
                  >
                    {col.titulo && (
                      <div className="px-1 py-0.5 mb-0.5">
                        <span className="text-[11px] uppercase font-bold tracking-wider text-blue-200 block">
                          {col.titulo}
                        </span>
                        {col.descricao && (
                          <span className="text-[10px] text-slate-300 font-medium block truncate">
                            {col.descricao}
                          </span>
                        )}
                      </div>
                    )}
                    <div className="flex flex-col gap-1">{col.itens.map(renderItemCard)}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Conteúdo: Dropdown Simples com visual de cards ricos */}
            {!isMega && grupo.itens && (
              <div className="flex flex-col gap-1">{grupo.itens.map(renderItemCard)}</div>
            )}

            {/* Rodapé sutil com atalho de teclado rápido */}
            <div className="mt-3 pt-2 border-t border-white/15 flex items-center justify-between text-[10px] text-slate-300 font-medium px-1">
              <span>Navegação rápida por teclado</span>
              <kbd className="px-1.5 py-0.5 bg-white/15 rounded text-[9px] font-mono text-white font-semibold border border-white/20">
                Ctrl + K
              </kbd>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
