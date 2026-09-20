import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search,
  ArrowRight,
  Clock,
  ExternalLink,
  Command as CommandIcon,
  X,
  Layers,
  Compass,
} from 'lucide-react'
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
} from '@/components/ui/command'
import type { NavItemConfig } from '@/lib/menuNavigationConfig'

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  itens: (NavItemConfig & { grupoLabel: string; grupoId: string })[]
  currentPath: string
}

const RECENTES_KEY = 'consultoria_menu_recentes_v1'

export function CommandPalette({ open, onOpenChange, itens, currentPath }: CommandPaletteProps) {
  const navigate = useNavigate()
  const [busca, setBusca] = useState('')
  const [value, setValue] = useState<string | undefined>(undefined)
  const [recentes, setRecentes] = useState<string[]>([])

  // Carrega recentes ao abrir e reseta seleção/busca
  useEffect(() => {
    if (open) {
      setValue(undefined)
      try {
        const salvos = localStorage.getItem(RECENTES_KEY)
        if (salvos) {
          setRecentes(JSON.parse(salvos))
        }
      } catch {
        setRecentes([])
      }
    } else {
      setBusca('')
      setValue(undefined)
    }
  }, [open])

  const salvarRecente = (path: string) => {
    try {
      const novos = [path, ...recentes.filter((p) => p !== path)].slice(0, 5)
      setRecentes(novos)
      localStorage.setItem(RECENTES_KEY, JSON.stringify(novos))
    } catch {
      // Ignora erro de localstorage
    }
  }

  const handleSelect = (path: string) => {
    salvarRecente(path)
    onOpenChange(false)
    navigate(path)
  }

  // Agrupa itens por grupo
  const gruposMap = useMemo(() => {
    const map = new Map<string, (NavItemConfig & { grupoLabel: string; grupoId: string })[]>()
    for (const item of itens) {
      const grupo = item.grupoLabel
      if (!map.has(grupo)) {
        map.set(grupo, [])
      }
      map.get(grupo)!.push(item)
    }
    return map
  }, [itens])

  // Itens recentes resolvidos
  const itensRecentes = useMemo(() => {
    if (!recentes.length) return []
    return recentes
      .map((path) => itens.find((i) => i.path === path))
      .filter((i): i is NavItemConfig & { grupoLabel: string; grupoId: string } => Boolean(i))
  }, [recentes, itens])

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} value={value} onValueChange={setValue}>
      <div className="bg-[#0B1F3A] text-white border-slate-700">
        <CommandInput
          placeholder="Buscar módulo, relatório, indicador, atalho... (Ex: DRE, BSC, NFS-e, Valuation)"
          value={busca}
          onValueChange={(val) => {
            setBusca(val)
            setValue(undefined)
          }}
          className="text-white placeholder:text-slate-300 border-slate-700/60 text-sm font-medium"
        />
        <CommandList className="max-h-[360px] overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-slate-700">
          <CommandEmpty className="py-8 text-center text-sm text-slate-300 font-medium">
            Nenhum módulo ou tela encontrada para &quot;{busca}&quot;.
          </CommandEmpty>

          {/* Seção de Acessos Recentes quando não houver busca digitada */}
          {!busca && itensRecentes.length > 0 && (
            <CommandGroup
              heading={
                <div className="flex items-center gap-1.5 text-blue-300 text-[11px] font-semibold uppercase tracking-wider">
                  <Clock className="w-3 h-3" />
                  <span>Acessados Recentemente</span>
                </div>
              }
            >
              {itensRecentes.map((item) => {
                const IconComponent = item.icon
                const isActive = currentPath === item.path
                return (
                  <CommandItem
                    key={`recente-${item.id}`}
                    value={`recente ${item.name} ${item.descricao || ''}`}
                    onSelect={() => handleSelect(item.path)}
                    onMouseEnter={() => {
                      setValue(`recente ${item.name} ${item.descricao || ''}`)
                    }}
                    className="flex items-center justify-between px-3 py-2.5 rounded-xl text-slate-200 transition-all duration-150 cursor-pointer my-1 group border border-transparent hover:bg-blue-600/40 hover:text-white hover:border-blue-400/60 hover:shadow-sm aria-selected:bg-blue-600/40 aria-selected:text-white aria-selected:border-blue-400/60 aria-selected:shadow-sm data-[selected=true]:bg-blue-600/40 data-[selected=true]:text-white data-[selected=true]:border-blue-400/60 data-[selected=true]:shadow-sm"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-300 flex items-center justify-center shrink-0 border border-blue-500/30 group-hover:bg-blue-500/40 group-hover:text-white group-hover:border-blue-300/60 group-aria-selected:bg-blue-500/40 group-aria-selected:text-white group-data-[selected=true]:bg-blue-500/40 group-data-[selected=true]:text-white transition-colors duration-150">
                        <IconComponent className="w-4 h-4" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-white truncate">
                            {item.name}
                          </span>
                          {isActive && (
                            <span className="text-[9px] bg-blue-400/25 text-blue-200 border border-blue-400/40 px-1 rounded font-medium">
                              Atual
                            </span>
                          )}
                        </div>
                        {item.descricao && (
                          <span className="text-[10px] text-slate-300/90 truncate group-hover:text-slate-100 group-aria-selected:text-slate-100 group-data-[selected=true]:text-slate-100 transition-colors">
                            {item.descricao}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-300 font-mono flex items-center gap-1 shrink-0 ml-2">
                      <span className="hidden sm:inline text-slate-300/80 group-hover:text-blue-200 group-aria-selected:text-blue-200 group-data-[selected=true]:text-blue-200">
                        {item.grupoLabel}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-blue-300 group-hover:text-white group-hover:translate-x-0.5 group-aria-selected:text-white group-aria-selected:translate-x-0.5 group-data-[selected=true]:text-white group-data-[selected=true]:translate-x-0.5 transition-all duration-150" />
                    </span>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          )}

          {/* Grupos organizados */}
          {Array.from(gruposMap.entries()).map(([grupoLabel, grupoItens]) => (
            <CommandGroup
              key={grupoLabel}
              heading={
                <div className="flex items-center gap-1.5 text-blue-300/90 text-[11px] font-semibold uppercase tracking-wider mt-1">
                  <Layers className="w-3 h-3" />
                  <span>{grupoLabel}</span>
                </div>
              }
            >
              {grupoItens.map((item) => {
                const IconComponent = item.icon
                const isActive = currentPath === item.path
                const keywords = (item.palavrasChave || []).join(' ')
                const searchValue = `${item.name} ${item.descricao || ''} ${keywords} ${item.grupoLabel}`

                return (
                  <CommandItem
                    key={item.id}
                    value={searchValue}
                    onSelect={() => handleSelect(item.path)}
                    onMouseEnter={() => {
                      setValue(searchValue)
                    }}
                    className="flex items-center justify-between px-3 py-2 rounded-xl text-slate-200 transition-all duration-150 cursor-pointer my-1 group border border-transparent hover:bg-blue-600/40 hover:text-white hover:border-blue-400/60 hover:shadow-sm aria-selected:bg-blue-600/40 aria-selected:text-white aria-selected:border-blue-400/60 aria-selected:shadow-sm data-[selected=true]:bg-blue-600/40 data-[selected=true]:text-white data-[selected=true]:border-blue-400/60 data-[selected=true]:shadow-sm"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-white/10 text-blue-300 flex items-center justify-center shrink-0 border border-white/15 group-hover:bg-blue-500/40 group-hover:text-white group-hover:border-blue-300/60 group-aria-selected:bg-blue-500/40 group-aria-selected:text-white group-data-[selected=true]:bg-blue-500/40 group-data-[selected=true]:text-white transition-colors duration-150">
                        <IconComponent className="w-4 h-4" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-white truncate">
                            {item.name}
                          </span>
                          {item.badge && (
                            <span className="text-[9px] bg-amber-400/25 text-amber-200 border border-amber-400/40 px-1 rounded font-bold uppercase tracking-wide">
                              {item.badge}
                            </span>
                          )}
                          {isActive && (
                            <span className="text-[9px] bg-blue-400/25 text-blue-200 border border-blue-400/40 px-1 rounded font-medium">
                              Atual
                            </span>
                          )}
                        </div>
                        {item.descricao && (
                          <span className="text-[10px] text-slate-300/90 truncate group-hover:text-slate-100 group-aria-selected:text-slate-100 group-data-[selected=true]:text-slate-100 transition-colors">
                            {item.descricao}
                          </span>
                        )}
                      </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-blue-300 group-hover:text-white group-hover:translate-x-0.5 group-aria-selected:text-white group-aria-selected:translate-x-0.5 group-data-[selected=true]:text-white group-data-[selected=true]:translate-x-0.5 transition-all duration-150 shrink-0 ml-2" />
                  </CommandItem>
                )
              })}
            </CommandGroup>
          ))}
        </CommandList>

        {/* Rodapé informativo */}
        <div className="flex items-center justify-between px-3 py-2 border-t border-white/10 text-[11px] text-slate-300 font-medium bg-white/5">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-black/40 rounded border border-white/10 text-[10px] font-mono text-slate-200">
                ↑
              </kbd>
              <kbd className="px-1.5 py-0.5 bg-black/40 rounded border border-white/10 text-[10px] font-mono text-slate-200">
                ↓
              </kbd>
              <span className="ml-1">navegar</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-black/40 rounded border border-white/10 text-[10px] font-mono text-slate-200">
                Enter
              </kbd>
              <span className="ml-1">abrir</span>
            </span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-slate-300">
            <span>Gestão Econômica</span>
          </div>
        </div>
      </div>
    </CommandDialog>
  )
}
