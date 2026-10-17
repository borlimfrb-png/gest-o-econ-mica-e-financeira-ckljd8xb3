import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Building2,
  Search,
  ChevronDown,
  ChevronRight,
  Sliders,
  Calendar,
  Layers,
  Sparkles,
} from 'lucide-react'
import type {
  GrupoCentroCustoVariavel,
  LancamentoVariavelItem,
} from '@/lib/lancamentosVariaveisHelper'

interface PainelDespesasVariaveisCentrosProps {
  grupos: GrupoCentroCustoVariavel[]
  totalGeral: number
  quantidadeTotal: number
  filtroTexto: string
  onFiltroTextoChange: (texto: string) => void
  onAjustarItem?: (item: LancamentoVariavelItem) => void
  isCliente?: boolean
}

function formatBrl(val: number | undefined | null): string {
  if (val === undefined || val === null || !Number.isFinite(val)) return 'R$ 0,00'
  return val.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function PainelDespesasVariaveisCentros({
  grupos,
  totalGeral,
  quantidadeTotal,
  filtroTexto,
  onFiltroTextoChange,
  onAjustarItem,
  isCliente = false,
}: PainelDespesasVariaveisCentrosProps) {
  // Controle de accordion/expansão de cada centro de custo (por padrão abertos)
  const [centrosAbertos, setCentrosAbertos] = useState<Record<string, boolean>>({})

  const toggleCentro = (key: string) => {
    setCentrosAbertos((prev) => ({
      ...prev,
      // Se não definido, assume que estava aberto (default true) e fecha
      [key]: prev[key] === undefined ? false : !prev[key],
    }))
  }

  const expandirTodos = () => {
    const next: Record<string, boolean> = {}
    for (const g of grupos) {
      next[g.centroId] = true
    }
    setCentrosAbertos(next)
  }

  const recolherTodos = () => {
    const next: Record<string, boolean> = {}
    for (const g of grupos) {
      next[g.centroId] = false
    }
    setCentrosAbertos(next)
  }

  return (
    <Card className="bg-white border-slate-200/90 shadow-xs flex flex-col h-full">
      <CardHeader className="py-3 px-4 border-b border-slate-100 bg-slate-50/50">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-amber-100/80 text-amber-800 shadow-xs">
              <Building2 className="w-4 h-4 text-amber-700" />
            </span>
            <div>
              <div className="flex items-center gap-1.5">
                <CardTitle className="text-sm font-bold text-[#0B1F3A]">
                  Despesas Variáveis por Centro de Custo
                </CardTitle>
                <Badge
                  variant="outline"
                  className="text-[10px] bg-amber-50 text-amber-900 border-amber-200 font-mono"
                >
                  {grupos.length} {grupos.length === 1 ? 'centro' : 'centros'}
                </Badge>
              </div>
              <CardDescription className="text-[11px] text-slate-500">
                Agrupamento detalhado dos lançamentos variáveis com subtotais e ajuste individual
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-1 text-[11px]">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={expandirTodos}
              className="h-6 px-1.5 text-[10.5px] text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              Expandir
            </Button>
            <span className="text-slate-300">•</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={recolherTodos}
              className="h-6 px-1.5 text-[10.5px] text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              Recolher
            </Button>
          </div>
        </div>

        {/* Barra de busca e totalizador superior */}
        <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <Input
              type="text"
              placeholder="Buscar por descrição, conta, centro ou competência..."
              value={filtroTexto}
              onChange={(e) => onFiltroTextoChange(e.target.value)}
              className="h-8 text-xs pl-8 bg-white border-slate-200"
            />
          </div>

          <div className="flex items-center gap-2 bg-amber-50/70 border border-amber-200/80 px-2.5 py-1 rounded-lg shrink-0">
            <span className="text-[10.5px] font-medium text-amber-900">Total Período:</span>
            <span className="text-xs font-black font-mono text-amber-950">
              {formatBrl(totalGeral)}
            </span>
            <span className="text-[10px] text-amber-700/80 font-mono">
              ({quantidadeTotal} {quantidadeTotal === 1 ? 'item' : 'itens'})
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0 flex-1 overflow-hidden flex flex-col">
        {grupos.length === 0 ? (
          <div className="p-8 text-center space-y-2 my-auto">
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
              <Layers className="w-5 h-5" />
            </div>
            <p className="text-xs font-semibold text-slate-700">
              Nenhuma despesa variável encontrada
            </p>
            <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
              Não foram localizados lançamentos de despesas variáveis para a empresa e período
              selecionados.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 overflow-y-auto max-h-[580px] p-2 space-y-2.5">
            {grupos.map((grupo) => {
              const isOpen = centrosAbertos[grupo.centroId] ?? true
              const pctDoTotal = totalGeral > 0 ? (grupo.subtotal / totalGeral) * 100 : 0

              return (
                <div
                  key={grupo.centroId}
                  className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs transition-all"
                >
                  {/* Cabeçalho do Centro de Custo */}
                  <button
                    type="button"
                    onClick={() => toggleCentro(grupo.centroId)}
                    className="w-full text-left p-3 bg-slate-50/80 hover:bg-slate-100/70 flex items-center justify-between gap-2.5 transition-colors cursor-pointer border-b border-slate-100"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-slate-500 shrink-0">
                        {isOpen ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </span>
                      <div className="w-6 h-6 rounded-md bg-amber-100 text-amber-800 flex items-center justify-center text-xs font-bold shrink-0">
                        <Building2 className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-[#0B1F3A] truncate">
                            {grupo.centroNome}
                          </span>
                          {grupo.centroCodigo && (
                            <span className="text-[10px] text-slate-400 font-mono">
                              ({grupo.centroCodigo})
                            </span>
                          )}
                          <Badge
                            variant="secondary"
                            className="text-[9.5px] px-1.5 py-0 bg-slate-200/70 text-slate-700"
                          >
                            {grupo.quantidade}{' '}
                            {grupo.quantidade === 1 ? 'lançamento' : 'lançamentos'}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <span className="text-xs font-black font-mono text-[#0B1F3A] block">
                          {formatBrl(grupo.subtotal)}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono block">
                          {pctDoTotal.toFixed(1)}% do total
                        </span>
                      </div>
                    </div>
                  </button>

                  {/* Lançamentos Detalhados dentro do Centro */}
                  {isOpen && (
                    <div className="divide-y divide-slate-100 text-xs">
                      {grupo.itens.map((item) => (
                        <div
                          key={item.id}
                          className="p-3 hover:bg-amber-50/30 transition-colors flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-mono text-[10.5px] text-slate-500 font-semibold flex items-center gap-1">
                                <Calendar className="w-3 h-3 text-slate-400" />
                                {item.data}
                              </span>
                              <Badge
                                variant="outline"
                                className="text-[9.5px] px-1.5 py-0 bg-white text-slate-800 border-slate-200 font-medium"
                                title={`Conta: ${item.contaCodigo || ''} ${item.contaNome}`}
                              >
                                {item.contaCodigo ? `${item.contaCodigo} · ` : ''}
                                {item.contaNome}
                              </Badge>
                              {item.tipoDespesaNome && (
                                <span className="text-[10px] text-slate-400">
                                  • {item.tipoDespesaNome}
                                </span>
                              )}
                            </div>
                            <p
                              className="text-xs font-medium text-slate-800 truncate mt-1"
                              title={item.historico || item.contaNome}
                            >
                              {item.historico || '(sem descrição)'}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-mono font-bold text-slate-900 text-xs">
                              {formatBrl(item.valor)}
                            </span>
                            {!isCliente && onAjustarItem && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => onAjustarItem(item)}
                                className="h-6 px-2 text-[10.5px] font-semibold text-amber-800 border-amber-300 hover:bg-amber-100 cursor-pointer gap-1"
                                title="Editar valor, competência ou conta deste lançamento real no banco"
                              >
                                <Sliders className="w-3 h-3 text-amber-700" />
                                Ajustar
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}

                      {/* Subtotal do Centro de Custo no rodapé do grupo */}
                      <div className="p-2.5 bg-slate-50/60 flex items-center justify-between text-xs font-semibold text-slate-700 border-t border-slate-100">
                        <span className="text-[11px] text-slate-500 flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-amber-600" />
                          Subtotal {grupo.centroNome}:
                        </span>
                        <span className="font-mono font-bold text-slate-900">
                          {formatBrl(grupo.subtotal)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
