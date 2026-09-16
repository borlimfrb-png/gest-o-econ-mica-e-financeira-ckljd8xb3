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
  const [recentes, setRecentes] = useState<string[]>([])

  // Carrega recentes ao abrir
  useEffect(() => {
    if (open) {
      try {
        const salvos = localStorage.getItem(RECENTES_KEY)
        if (salvos) {
          setRecentes(JSON.parse(salvos))
        }
      } catch {
        setRecentes([])
      }
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
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <div className="bg-[#0B1F3A] text-white border-slate-700">
        <CommandInput
          placeholder="Buscar módulo, relatório, indicador, atalho... (Ex: DRE, BSC, NFS-e, Valuation)"
          value={busca}
          onValueChange={setBusca}
          className="text-white placeholder:text-slate-400 border-slate-700/60"
        />
        <CommandList className="max-h-[360px] overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-slate-700">
          <CommandEmpty className="py-8 text-center text-sm text-slate-400">
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
                    className="flex items-center justify-between px-3 py-2.5 rounded-lg text-slate-200 hover:text-white hover:bg-white/10 cursor-pointer aria-selected:bg-blue-600/40 aria-selected:text-white my-0.5 group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-300 flex items-center justify-center shrink-0 border border-blue-500/30">
                        <IconComponent className="w-4 h-4" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-xs text-white truncate">
                            {item.name}
                          </span>
                          {isActive && (
                            <span className="text-[9px] bg-blue-400/20 text-blue-300 border border-blue-400/30 px-1 rounded">
                              Atual
                            </span>
                          )}
                        </div>
                        {item.descricao && (
                          <span className="text-[10px] text-slate-400 truncate group-hover:text-slate-300">
                            {item.descricao}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1 shrink-0 ml-2">
                      <span className="hidden sm:inline text-slate-400">{item.grupoLabel}</span>
                      <ArrowRight className="w-3 h-3 text-slate-400 group-hover:text-blue-300 group-hover:translate-x-0.5 transition-transform" />
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
                    className="flex items-center justify-between px-3 py-2 rounded-lg text-slate-200 hover:text-white hover:bg-white/10 cursor-pointer aria-selected:bg-blue-600/40 aria-selected:text-white my-0.5 group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-white/5 text-blue-300 flex items-center justify-center shrink-0 border border-white/10 group-hover:bg-blue-500/20 group-hover:border-blue-500/30 transition-colors">
                        <IconComponent className="w-4 h-4" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-xs text-white truncate">
                            {item.name}
                          </span>
                          {item.badge && (
                            <span className="text-[9px] bg-amber-400/20 text-amber-300 border border-amber-400/30 px-1 rounded font-semibold uppercase">
                              {item.badge}
                            </span>
                          )}
                          {isActive && (
                            <span className="text-[9px] bg-blue-400/20 text-blue-300 border border-blue-400/30 px-1 rounded">
                              Atual
                            </span>
                          )}
                        </div>
                        {item.descricao && (
                          <span className="text-[10px] text-slate-400 truncate group-hover:text-slate-300">
                            {item.descricao}
                          </span>
                        )}
                      </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-300 group-hover:translate-x-0.5 transition-transform shrink-0 ml-2" />
                  </CommandItem>
                )
              })}
            </CommandGroup>
          ))}
        </CommandList>

        {/* Rodapé informativo */}
        <div className="flex items-center justify-between px-3 py-2 border-t border-white/10 text-[11px] text-slate-400 bg-white/5">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-black/40 rounded border border-white/10 text-[10px] font-mono text-slate-300">
                ↑
              </kbd>
              <kbd className="px-1.5 py-0.5 bg-black/40 rounded border border-white/10 text-[10px] font-mono text-slate-300">
                ↓
              </kbd>
              <span className="ml-1">navegar</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-black/40 rounded border border-white/10 text-[10px] font-mono text-slate-300">
                Enter
              </kbd>
              <span className="ml-1">abrir</span>
            </span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-slate-400">
            <span>Gestão Econômica</span>
          </div>
        </div>
      </div>
    </CommandDialog>
  )
}
