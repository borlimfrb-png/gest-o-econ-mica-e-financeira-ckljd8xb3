import React, { useState, useMemo, useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import type { PlanoContaRecord } from '@/types/finance'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Search,
  Check,
  ChevronsUpDown,
  X,
  Filter,
  Layers,
  ArrowRight,
  BookOpen,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SeletorPlanoContaComboboxRef {
  focus: () => void
}

export interface SeletorPlanoContaComboboxProps {
  id?: string
  value?: string
  onValueChange: (value: string) => void
  planoContas: PlanoContaRecord[]
  disabled?: boolean
  error?: string
  placeholder?: string
  className?: string
  empresaAtivaId?: string
}

/**
 * Normaliza string removendo acentuação e passando para minúsculas
 */
export function normalizeText(text: string): string {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

/**
 * Destaca trechos do texto correspondentes ao termo de busca
 */
export const HighlightMatch: React.FC<{
  text: string
  query: string
  className?: string
}> = ({ text, query, className }) => {
  if (!query || !query.trim() || !text) {
    return <span className={className}>{text}</span>
  }

  const normQuery = normalizeText(query)
  if (!normQuery) {
    return <span className={className}>{text}</span>
  }

  // Encontra intervalos de correspondência ignorando acentos
  const normText = (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  const idx = normText.indexOf(normQuery)
  if (idx === -1) {
    return <span className={className}>{text}</span>
  }

  // Mapeamento aproximado de comprimento se não houver caracteres multi-byte complexos
  const length = query.trim().length
  const before = text.slice(0, idx)
  const match = text.slice(idx, idx + length)
  const after = text.slice(idx + length)

  return (
    <span className={className}>
      {before}
      <span className="bg-amber-200/90 text-amber-950 font-semibold px-0.5 rounded-[2px] underline decoration-amber-500/50">
        {match}
      </span>
      {after}
    </span>
  )
}

interface RankedPlanoItem {
  item: PlanoContaRecord
  score: number
  isTotalizador: boolean
  codPC: string
  codEmp: string
  codConta: string
  nomeConta: string
  codCentro: string
  nomeCentro: string
  nomeTipo?: string
  tipoConta?: string
  grupoConta?: string
}

export const SeletorPlanoContaCombobox = forwardRef<
  SeletorPlanoContaComboboxRef,
  SeletorPlanoContaComboboxProps
>(
  (
    {
      id = 'seletor-plano-conta',
      value = '',
      onValueChange,
      planoContas,
      disabled = false,
      error,
      placeholder = 'Selecione ou busque por código ou nome...',
      className,
      empresaAtivaId,
    },
    ref,
  ) => {
    const [open, setOpen] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')
    const [filtroTipo, setFiltroTipo] = useState<
      'todos' | 'Receita' | 'Despesa' | 'Ativo' | 'Passivo'
    >('todos')
    const [incluirTotalizadores, setIncluirTotalizadores] = useState(true)
    const [focusedIndex, setFocusedIndex] = useState<number>(0)

    const triggerButtonRef = useRef<HTMLButtonElement>(null)
    const searchInputRef = useRef<HTMLInputElement>(null)
    const listContainerRef = useRef<HTMLDivElement>(null)

    useImperativeHandle(ref, () => ({
      focus: () => {
        triggerButtonRef.current?.focus()
      },
    }))

    // Item atualmente selecionado
    const selectedItem = useMemo(() => {
      if (!value) return null
      return planoContas.find((p) => p.id === value) || null
    }, [value, planoContas])

    // Filtra para manter consistência com a empresa ativa, caso haja itens específicos
    const listaEmpresa = useMemo(() => {
      if (!empresaAtivaId) return planoContas
      const daEmpresa = planoContas.filter((p) => p.empresa === empresaAtivaId)
      if (daEmpresa.length > 0) return daEmpresa
      return planoContas
    }, [planoContas, empresaAtivaId])

    // Extrai dados enriquecidos de cada item
    const itensProcessados: RankedPlanoItem[] = useMemo(() => {
      return listaEmpresa.map((item) => {
        const expandConta = item.expand?.conta
        const expandCentro = item.expand?.centro
        const expandTipo = item.expand?.tipo_despesa

        const codPC = (item.codigo || '').trim()
        const codEmp = (item.codigo_empresa || '').trim()
        const codConta = (expandConta?.codigo || '').trim()
        const nomeConta = (expandConta?.nome || item.descricao || 'Conta').trim()
        const codCentro = (expandCentro?.codigo || '').trim()
        const nomeCentro = (expandCentro?.nome || 'Centro').trim()
        const nomeTipo = expandTipo?.nome?.trim()
        const tipoConta = expandConta?.tipo
        const grupoConta = expandConta?.grupo

        // Detecta se parece uma conta sintética/totalizadora ou se é conta folha analítica
        // Ex: código estrutural terminado em .0, ou sem centro preenchido, ou nome em caixa alta pura como "RECEITAS"
        const isTotalizador =
          (codEmp && codEmp.endsWith('.0')) ||
          (nomeConta.toUpperCase() === nomeConta &&
            nomeConta.length < 15 &&
            !nomeConta.includes(' '))

        return {
          item,
          score: 0,
          isTotalizador: Boolean(isTotalizador),
          codPC,
          codEmp,
          codConta,
          nomeConta,
          codCentro,
          nomeCentro,
          nomeTipo,
          tipoConta,
          grupoConta,
        }
      })
    }, [listaEmpresa])

    // Filtro e Ranking dos resultados com busca flexível e instantânea
    const resultadosFiltrados = useMemo(() => {
      const q = normalizeText(searchTerm)
      const qParts = q.split(/\s+/).filter(Boolean)

      // Se não há busca
      let filtrados = itensProcessados

      // Filtro por tipo de conta se selecionado
      if (filtroTipo !== 'todos') {
        filtrados = filtrados.filter((item) => item.tipoConta === filtroTipo)
      }

      // Filtro de totalizadores se desmarcado
      if (!incluirTotalizadores) {
        filtrados = filtrados.filter((item) => !item.isTotalizador)
      }

      if (qParts.length === 0) {
        // Ordena por código PC padrão
        return [...filtrados].sort((a, b) => a.codPC.localeCompare(b.codPC))
      }

      // Pontuação de ranking para cada item
      const ranked: RankedPlanoItem[] = []

      for (const entry of filtrados) {
        const normCodPC = normalizeText(entry.codPC)
        const normCodEmp = normalizeText(entry.codEmp)
        const normCodConta = normalizeText(entry.codConta)
        const normNomeConta = normalizeText(entry.nomeConta)
        const normCentro = normalizeText(entry.nomeCentro)
        const normCodCentro = normalizeText(entry.codCentro)
        const normTipo = normalizeText(entry.nomeTipo || '')
        const normGrupo = normalizeText(entry.grupoConta || '')

        // Verifica se todas as palavras da busca casam com algum dos campos
        const matchAllParts = qParts.every(
          (part) =>
            normCodPC.includes(part) ||
            normCodEmp.includes(part) ||
            normCodConta.includes(part) ||
            normNomeConta.includes(part) ||
            normCentro.includes(part) ||
            normCodCentro.includes(part) ||
            normTipo.includes(part) ||
            normGrupo.includes(part),
        )

        if (!matchAllParts) {
          continue
        }

        // Calcula score de relevância
        let score = 0

        // 1. Matches exatos de código
        if (normCodEmp === q || normCodPC === q || normCodConta === q) {
          score += 1000
        }
        // 2. Prefixos exatos de código estrutural (ex: "1.1" casando com "1.1.01" ou "PC-001" casando com "PC-00")
        else if (
          normCodEmp.startsWith(q) ||
          normCodPC.startsWith(q) ||
          normCodConta.startsWith(q)
        ) {
          score += 500
        }
        // 3. Match no início do código sem pontuação (ex: digitou "001" ou "11")
        else if (
          normCodEmp.replace(/\./g, '').startsWith(q.replace(/\./g, '')) ||
          normCodPC.replace(/-/g, '').startsWith(q.replace(/-/g, '')) ||
          normCodConta.replace(/-/g, '').startsWith(q.replace(/-/g, ''))
        ) {
          score += 350
        }
        // 4. Nome da conta inicia com a busca exata
        else if (normNomeConta.startsWith(q)) {
          score += 300
        }
        // 5. Nome da conta contém a busca exata
        else if (normNomeConta.includes(q)) {
          score += 200
        }
        // 6. Nome do centro ou grupo contém a busca
        else if (normCentro.includes(q) || normGrupo.includes(q)) {
          score += 100
        }
        // 7. Qualquer outra correspondência
        else {
          score += 50
        }

        // Bônus para contas analíticas / folha
        if (!entry.isTotalizador) {
          score += 10
        }

        ranked.push({ ...entry, score })
      }

      // Ordena decrescente por score e depois por código
      return ranked.sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score
        }
        return a.codPC.localeCompare(b.codPC)
      })
    }, [itensProcessados, searchTerm, filtroTipo, incluirTotalizadores])

    // Ajusta o índice focado quando os resultados mudam
    useEffect(() => {
      setFocusedIndex(0)
    }, [resultadosFiltrados.length, searchTerm])

    // Quando abrir o popover, foca o input de busca automaticamente
    useEffect(() => {
      if (open) {
        setTimeout(() => {
          searchInputRef.current?.focus()
          searchInputRef.current?.select()
        }, 30)
      } else {
        setSearchTerm('')
      }
    }, [open])

    // Rola o item focado para visualização quando navega pelo teclado
    useEffect(() => {
      if (open && listContainerRef.current) {
        const focusedElement = listContainerRef.current.querySelector(
          `[data-index="${focusedIndex}"]`,
        ) as HTMLElement | null
        if (focusedElement) {
          focusedElement.scrollIntoView({ block: 'nearest' })
        }
      }
    }, [focusedIndex, open])

    // Seleção de um item
    const handleSelect = (planoId: string) => {
      onValueChange(planoId)
      setOpen(false)
      // Mantém foco no botão trigger para continuidade ágil do fluxo
      setTimeout(() => {
        triggerButtonRef.current?.focus()
      }, 50)
    }

    // Tratamento de atalhos de teclado (↑, ↓, Enter, Esc)
    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (!open) {
        if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          setOpen(true)
        }
        return
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setFocusedIndex((prev) => (prev < resultadosFiltrados.length - 1 ? prev + 1 : prev))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setFocusedIndex((prev) => (prev > 0 ? prev - 1 : 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const selected = resultadosFiltrados[focusedIndex]
        if (selected) {
          handleSelect(selected.item.id)
        }
      } else if (e.key === 'Escape') {
        e.preventDefault()
        setOpen(false)
        triggerButtonRef.current?.focus()
      }
    }

    const formatSelectedDisplay = () => {
      if (!selectedItem) {
        return null
      }
      const expConta = selectedItem.expand?.conta
      const expCentro = selectedItem.expand?.centro
      const expTipo = selectedItem.expand?.tipo_despesa

      return {
        codPC: selectedItem.codigo || 'PC-???',
        codEmp: selectedItem.codigo_empresa,
        conta: expConta
          ? `${expConta.codigo ? `${expConta.codigo} - ` : ''}${expConta.nome}`
          : selectedItem.descricao || 'Conta',
        centro: expCentro
          ? `${expCentro.codigo ? `${expCentro.codigo} - ` : ''}${expCentro.nome}`
          : '',
        tipo: expTipo ? expTipo.nome : '',
        tipoConta: expConta?.tipo,
      }
    }

    const selDisplay = formatSelectedDisplay()

    return (
      <div className="w-full space-y-1">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              id={id}
              ref={triggerButtonRef}
              type="button"
              role="combobox"
              aria-expanded={open}
              disabled={disabled || planoContas.length === 0}
              onKeyDown={handleKeyDown}
              className={cn(
                'w-full justify-between font-normal h-auto min-h-[42px] py-1.5 px-3 bg-white text-left hover:bg-slate-50 border transition-colors shadow-xs',
                error
                  ? 'border-red-500 ring-1 ring-red-500/30'
                  : 'border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500',
                disabled && 'opacity-60 cursor-not-allowed bg-slate-100',
                className,
              )}
            >
              {selDisplay ? (
                <div className="flex items-center gap-2 overflow-hidden flex-1 text-xs">
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="font-mono font-bold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded text-[11px]">
                      {selDisplay.codPC}
                    </span>
                    {selDisplay.codEmp && (
                      <span
                        className="font-mono text-slate-500 bg-slate-100 border border-slate-200 px-1 py-0.5 rounded text-[10px]"
                        title="Código estrutural da empresa"
                      >
                        {selDisplay.codEmp}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col min-w-0 flex-1 leading-tight">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-slate-800 truncate text-xs">
                        {selDisplay.conta}
                      </span>
                      {selDisplay.tipoConta && (
                        <span className="text-[10px] text-slate-500 shrink-0 font-medium hidden sm:inline">
                          ({selDisplay.tipoConta})
                        </span>
                      )}
                    </div>
                    {selDisplay.centro && (
                      <span className="text-[11px] text-slate-500 truncate flex items-center gap-1">
                        <span>→ {selDisplay.centro}</span>
                        {selDisplay.tipo && (
                          <span className="text-slate-400">· {selDisplay.tipo}</span>
                        )}
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <span className="text-xs text-slate-400 truncate flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                  {planoContas.length === 0 ? 'Nenhum plano de contas cadastrado' : placeholder}
                </span>
              )}
              <ChevronsUpDown className="w-4 h-4 ml-2 shrink-0 text-slate-400" />
            </Button>
          </PopoverTrigger>

          <PopoverContent
            align="start"
            className="w-[calc(100vw-2rem)] sm:w-[540px] p-0 bg-white border border-slate-200 shadow-xl rounded-xl z-50 overflow-hidden"
            onKeyDown={handleKeyDown}
          >
            {/* Cabeçalho do Popover: Campo de busca rápida com atalhos */}
            <div className="p-3 border-b border-slate-100 bg-slate-50/70 space-y-2">
              <div className="relative">
                <Search className="w-4 h-4 text-blue-600 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Pesquisar por código (ex: 1.1, PC-001, CO-003) ou nome..."
                  className="w-full pl-9 pr-8 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-800 font-medium placeholder:text-slate-400"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchTerm('')
                      searchInputRef.current?.focus()
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full"
                    title="Limpar busca"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Barra de Filtros rápidos e Contador */}
              <div className="flex flex-wrap items-center justify-between gap-1.5 text-[11px] pt-0.5">
                <div className="flex items-center gap-1">
                  <span className="text-slate-400 text-[10px] uppercase font-semibold mr-0.5">
                    Filtrar:
                  </span>
                  {(['todos', 'Receita', 'Despesa'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setFiltroTipo(t)}
                      className={cn(
                        'px-2 py-0.5 rounded text-[11px] font-medium transition-colors',
                        filtroTipo === t
                          ? 'bg-blue-600 text-white shadow-2xs'
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100',
                      )}
                    >
                      {t === 'todos' ? 'Todos' : t}
                    </button>
                  ))}

                  <button
                    type="button"
                    onClick={() => setIncluirTotalizadores((prev) => !prev)}
                    className={cn(
                      'ml-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors flex items-center gap-1 border',
                      incluirTotalizadores
                        ? 'bg-slate-100 text-slate-700 border-slate-300'
                        : 'bg-white text-slate-400 border-slate-200 line-through',
                    )}
                    title={
                      incluirTotalizadores
                        ? 'Exibindo todas as contas (inclusive grupos/sintéticas)'
                        : 'Exibindo somente contas de lançamento analíticas'
                    }
                  >
                    <Layers className="w-3 h-3" />
                    Grupos
                  </button>
                </div>

                <div className="text-slate-500 font-medium">
                  <span className="font-bold text-slate-800">
                    {resultadosFiltrados.length}
                  </span> de{' '}
                  {planoContas.length} contas
                </div>
              </div>
            </div>

            {/* Lista com scroll e navegação por teclado */}
            <div
              ref={listContainerRef}
              className="max-h-[310px] overflow-y-auto divide-y divide-slate-100 p-1"
            >
              {resultadosFiltrados.length === 0 ? (
                <div className="py-8 px-4 text-center">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-2 text-slate-400">
                    <Search className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-semibold text-slate-700">Nenhuma conta encontrada</p>
                  {searchTerm && (
                    <p className="text-[11px] text-slate-500 mt-1 max-w-xs mx-auto">
                      Não encontramos correspondência para{' '}
                      <span className="font-bold text-slate-700">&quot;{searchTerm}&quot;</span>.
                      Tente digitar apenas parte do código ou nome.
                    </p>
                  )}
                  {searchTerm && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSearchTerm('')
                        setFiltroTipo('todos')
                        searchInputRef.current?.focus()
                      }}
                      className="mt-3 h-7 text-xs border-slate-200 hover:border-blue-300 hover:text-blue-600"
                    >
                      Limpar pesquisa
                    </Button>
                  )}
                </div>
              ) : (
                resultadosFiltrados.map((entry, index) => {
                  const isSelected = value === entry.item.id
                  const isFocused = focusedIndex === index

                  return (
                    <div
                      key={entry.item.id}
                      data-index={index}
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => handleSelect(entry.item.id)}
                      onMouseEnter={() => setFocusedIndex(index)}
                      className={cn(
                        'p-2.5 rounded-lg cursor-pointer transition-colors flex items-start gap-2.5 text-xs',
                        isFocused && 'bg-blue-50/90 text-blue-950',
                        isSelected && !isFocused && 'bg-blue-50/40',
                        !isFocused && !isSelected && 'hover:bg-slate-50',
                      )}
                    >
                      {/* Checkbox/Ícone de seleção */}
                      <div className="pt-0.5 shrink-0">
                        <div
                          className={cn(
                            'w-4 h-4 rounded-full flex items-center justify-center border transition-all',
                            isSelected
                              ? 'bg-blue-600 border-blue-600 text-white'
                              : 'border-slate-300 bg-white text-transparent',
                          )}
                        >
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </div>
                      </div>

                      {/* Conteúdo principal */}
                      <div className="flex-1 min-w-0 space-y-0.5">
                        {/* Linha superior: Tags de códigos */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-mono font-bold text-[11px] text-blue-700 bg-blue-100/70 border border-blue-200 px-1.5 py-0.2 rounded">
                            <HighlightMatch text={entry.codPC || 'PC-???'} query={searchTerm} />
                          </span>

                          {entry.codEmp && (
                            <span
                              className="font-mono text-[10px] text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded font-semibold"
                              title="Código estrutural da empresa"
                            >
                              <HighlightMatch text={entry.codEmp} query={searchTerm} />
                            </span>
                          )}

                          {entry.codConta && (
                            <span
                              className="font-mono text-[10px] text-slate-500 bg-slate-100 border border-slate-200 px-1 py-0.2 rounded"
                              title="Código da conta"
                            >
                              <HighlightMatch text={entry.codConta} query={searchTerm} />
                            </span>
                          )}

                          {entry.tipoConta && (
                            <span
                              className={cn(
                                'text-[10px] px-1.5 py-0.2 rounded font-semibold',
                                entry.tipoConta === 'Receita'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : entry.tipoConta === 'Despesa'
                                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                    : 'bg-slate-100 text-slate-700 border border-slate-200',
                              )}
                            >
                              {entry.tipoConta}
                            </span>
                          )}

                          {entry.isTotalizador && (
                            <Badge
                              variant="outline"
                              className="text-[9px] px-1 py-0 border-amber-300 bg-amber-50 text-amber-800 font-semibold"
                            >
                              Grupo
                            </Badge>
                          )}
                        </div>

                        {/* Nome da Conta em destaque */}
                        <div className="text-xs font-bold text-slate-900 pt-0.5 leading-snug">
                          <HighlightMatch text={entry.nomeConta} query={searchTerm} />
                        </div>

                        {/* Linha inferior: Centro de Custo e Tipo de Despesa */}
                        <div className="flex flex-wrap items-center gap-1 text-[11px] text-slate-500">
                          <span className="text-slate-400">→</span>
                          <span className="font-medium text-slate-700">
                            <HighlightMatch
                              text={`${entry.codCentro ? `${entry.codCentro} - ` : ''}${entry.nomeCentro}`}
                              query={searchTerm}
                            />
                          </span>
                          {entry.nomeTipo && (
                            <>
                              <span className="text-slate-300">|</span>
                              <span className="text-slate-500">
                                <HighlightMatch text={entry.nomeTipo} query={searchTerm} />
                              </span>
                            </>
                          )}
                          {entry.grupoConta && (
                            <>
                              <span className="text-slate-300">·</span>
                              <span className="text-[10px] text-slate-400 italic">
                                {entry.grupoConta}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Rodapé: Dicas de atalho de teclado */}
            <div className="py-2 px-3 border-t border-slate-100 bg-slate-50/90 text-[10px] text-slate-500 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span>
                  <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded shadow-2xs font-mono font-bold text-slate-700">
                    ↑
                  </kbd>{' '}
                  <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded shadow-2xs font-mono font-bold text-slate-700">
                    ↓
                  </kbd>{' '}
                  navegar
                </span>
                <span>
                  <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded shadow-2xs font-mono font-bold text-slate-700">
                    ↵
                  </kbd>{' '}
                  selecionar
                </span>
                <span>
                  <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded shadow-2xs font-mono font-bold text-slate-700">
                    esc
                  </kbd>{' '}
                  fechar
                </span>
              </div>
              <span className="text-blue-700 font-medium hidden sm:inline">Busca instantânea</span>
            </div>
          </PopoverContent>
        </Popover>

        {error && <p className="text-[11px] text-red-600 font-medium">{error}</p>}
      </div>
    )
  },
)

SeletorPlanoContaCombobox.displayName = 'SeletorPlanoContaCombobox'
