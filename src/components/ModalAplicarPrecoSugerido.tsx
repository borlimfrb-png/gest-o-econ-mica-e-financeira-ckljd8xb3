import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, ArrowRight, DollarSign, Package, AlertTriangle, Layers } from 'lucide-react'
import type { ItemSimulado } from '@/pages/SimuladorPrecos'

export interface ItemAplicacaoPreco {
  produtoId: string
  codigo: string
  nome: string
  precoAntigo?: number
  precoNovo: number
  custo: number
  margemNova?: number
}

export interface ModalAplicarPrecoSugeridoProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  itensParaAplicar: ItemAplicacaoPreco[]
  isLote: boolean
  onConfirmar: (itens: ItemAplicacaoPreco[]) => Promise<void>
}

function formatBrl(val?: number | null): string {
  if (val === undefined || val === null || isNaN(val)) return 'R$ 0,00'
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function ModalAplicarPrecoSugerido({
  open,
  onOpenChange,
  itensParaAplicar,
  isLote,
  onConfirmar,
}: ModalAplicarPrecoSugeridoProps) {
  const [salvando, setSalvando] = useState(false)

  const handleConfirm = async () => {
    setSalvando(true)
    try {
      await onConfirmar(itensParaAplicar)
      onOpenChange(false)
    } finally {
      setSalvando(false)
    }
  }

  const totalItens = itensParaAplicar.length
  const itemUnico = totalItens === 1 ? itensParaAplicar[0] : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl bg-white max-h-[85vh] flex flex-col">
        <DialogHeader className="border-b pb-3">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="w-5 h-5" />
            </span>
            <div>
              <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                {isLote ? 'Aplicar Preços Sugeridos em Lote' : 'Aplicar Preço Sugerido ao Produto'}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                {isLote
                  ? `Atualizar o cadastro de ${totalItens} produto(s) com os preços sugeridos calculados pelo simulador.`
                  : 'Atualizar o preço de venda atual do produto selecionado no cadastro oficial.'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-3 space-y-4 text-xs">
          {/* Se for 1 item apenas */}
          {itemUnico ? (
            <div className="space-y-3">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-slate-900 text-sm">
                    <Package className="w-4 h-4 text-blue-600" />
                    <span>{itemUnico.nome}</span>
                  </div>
                  {itemUnico.codigo && (
                    <Badge variant="outline" className="font-mono text-xs">
                      {itemUnico.codigo}
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200">
                  <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                    <span className="text-[10px] text-slate-400 font-semibold block uppercase">
                      Preço Atual Cadastrado
                    </span>
                    <span className="text-sm font-bold text-slate-700">
                      {formatBrl(itemUnico.precoAntigo)}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200">
                    <span className="text-[10px] text-emerald-700 font-semibold block uppercase">
                      Novo Preço Sugerido
                    </span>
                    <span className="text-sm font-bold text-emerald-800">
                      {formatBrl(itemUnico.precoNovo)}
                    </span>
                  </div>
                </div>

                {itemUnico.precoAntigo && itemUnico.precoAntigo > 0 && (
                  <div className="flex items-center justify-between text-[11px] pt-1 text-slate-500">
                    <span>Variação absoluta:</span>
                    <span
                      className={`font-semibold ${
                        itemUnico.precoNovo >= itemUnico.precoAntigo
                          ? 'text-emerald-600'
                          : 'text-amber-600'
                      }`}
                    >
                      {itemUnico.precoNovo >= itemUnico.precoAntigo ? '+' : ''}
                      {formatBrl(itemUnico.precoNovo - itemUnico.precoAntigo)} (
                      {(
                        ((itemUnico.precoNovo - itemUnico.precoAntigo) / itemUnico.precoAntigo) *
                        100
                      ).toFixed(1)}
                      %)
                    </span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Lista em lote */
            <div className="space-y-2">
              <div className="flex items-center justify-between text-slate-600 font-semibold px-1">
                <span>Produtos selecionados ({totalItens}):</span>
                <span className="text-[11px] text-slate-400">Preço Atual → Novo Sugerido</span>
              </div>

              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white max-h-[300px] overflow-y-auto">
                {itensParaAplicar.map((item) => {
                  const dif =
                    item.precoAntigo && item.precoAntigo > 0
                      ? item.precoNovo - item.precoAntigo
                      : null

                  return (
                    <div
                      key={item.produtoId}
                      className="p-2.5 flex items-center justify-between gap-2 hover:bg-slate-50 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-slate-900 truncate">{item.nome}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {item.codigo ? `[${item.codigo}] · ` : ''}
                          Custo: {formatBrl(item.custo)}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 text-right">
                        <span className="text-slate-500 line-through text-[11px]">
                          {formatBrl(item.precoAntigo)}
                        </span>
                        <ArrowRight className="w-3 h-3 text-slate-400" />
                        <span className="font-bold text-emerald-700 text-xs font-mono">
                          {formatBrl(item.precoNovo)}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Aviso sobre histórico de preços e tempo real */}
          <div className="p-3 bg-blue-50/80 rounded-xl border border-blue-200 text-blue-900 text-xs space-y-1">
            <p className="font-semibold flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-blue-700" />
              Impacto imediato no sistema
            </p>
            <p className="text-[11px] text-blue-800 leading-relaxed">
              O novo valor será gravado no campo oficial de <strong>Preço de Venda</strong> do
              produto, registrado no <strong>Histórico de Alterações de Preço</strong> (com a origem
              "Preço Sugerido Simulador") e auditado no sistema.
            </p>
          </div>
        </div>

        <DialogFooter className="border-t pt-3 gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={salvando}
            className="text-xs"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleConfirm}
            disabled={salvando || totalItens === 0}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs gap-1.5 shadow-xs"
          >
            {salvando ? (
              'Aplicando...'
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                {isLote
                  ? `Confirmar e Aplicar a Todos (${totalItens})`
                  : 'Confirmar e Aplicar Preço'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
