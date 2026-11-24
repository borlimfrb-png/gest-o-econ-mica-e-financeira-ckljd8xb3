/**
 * Card dos AJUSTES FISCAIS IFRS do Simulador de Regimes (/analise-tributaria):
 * conciliação do lucro contábil (base IFRS, DRE Gerencial) para o lucro fiscal
 * no Lucro Real, com aditivos/exclusões editáveis (descrição + valor em R$).
 * Persistência via ajustesFiscaisService por empresa + ano (coleção
 * `ajustes_fiscais_ifrs`, migração 0119).
 */

import { useState } from 'react'
import { ListPlus, Plus, Save, Trash2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ItemAjusteFiscal, TipoAjusteFiscal } from '@/types/finance'
import { ajustesFiscaisService } from '@/services/ajustesFiscaisService'
import { useToast } from '@/hooks/use-toast'
import { parseValorMoeda } from '@/lib/moedaInput'
import { formatBrl } from './comparativoRegimesBlocos'

interface Props {
  empresaId: string
  ano: number
  ajustes: ItemAjusteFiscal[]
  onChangeAjustes: (lista: ItemAjusteFiscal[]) => void
  lucroContabil: number
  lucroFiscal: number
  totalAditivos: number
  totalExclusoes: number
  disabled?: boolean
  /** Chamado após salvar com sucesso (a seção recarrega os ajustes persistidos). */
  onSalvo?: (lista: ItemAjusteFiscal[]) => void
}

/** Linha editável de um ajuste: descrição + tipo + valor + impacto assinado. */
function LinhaAjuste({
  ajuste,
  index,
  onChange,
  onRemover,
}: {
  ajuste: ItemAjusteFiscal
  index: number
  onChange: (novo: ItemAjusteFiscal) => void
  onRemover: () => void
}) {
  const impacto = ajuste.tipo === 'Exclusivo' ? -Math.abs(ajuste.valor) : Math.abs(ajuste.valor)
  return (
    <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
      <Input
        className="h-8 text-xs font-medium bg-slate-50/70 border-slate-200 flex-1 min-w-[180px]"
        placeholder="Descrição do ajuste (ex.: Provisão de férias)"
        value={ajuste.descricao}
        onChange={(e) => onChange({ ...ajuste, descricao: e.target.value })}
      />
      <Select
        value={ajuste.tipo}
        onValueChange={(v) => onChange({ ...ajuste, tipo: v as TipoAjusteFiscal })}
      >
        <SelectTrigger className="w-[130px] h-8 text-xs font-semibold bg-slate-50/70 border-slate-200">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="Aditivo" className="text-xs">
            Aditivo (+)
          </SelectItem>
          <SelectItem value="Exclusivo" className="text-xs">
            Exclusão (−)
          </SelectItem>
        </SelectContent>
      </Select>
      <div className="relative w-32">
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-semibold">
          R$
        </span>
        <Input
          className="pl-8 pr-2 h-8 text-xs font-semibold bg-slate-50/70 border-slate-200 text-right"
          inputMode="decimal"
          placeholder="0,00"
          value={ajuste.valor ? ajuste.valor.toFixed(2).replace('.', ',') : ''}
          onChange={(e) => onChange({ ...ajuste, valor: parseValorMoeda(e.target.value) })}
        />
      </div>
      <span
        className={`w-28 text-right text-xs font-bold ${
          impacto > 0 ? 'text-emerald-700' : impacto < 0 ? 'text-rose-700' : 'text-slate-400'
        }`}
      >
        {impacto > 0 ? '+' : impacto < 0 ? '−' : ''}
        {formatBrl(Math.abs(impacto))}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-slate-400 hover:text-rose-600 hover:bg-rose-50 shrink-0"
        onClick={onRemover}
        aria-label={`Remover ajuste ${index + 1}`}
        title="Remover ajuste"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </Button>
    </div>
  )
}

export function AjustesFiscaisCard({
  empresaId,
  ano,
  ajustes,
  onChangeAjustes,
  lucroContabil,
  lucroFiscal,
  totalAditivos,
  totalExclusoes,
  disabled,
  onSalvo,
}: Props) {
  const { toast } = useToast()
  const [salvando, setSalvando] = useState(false)

  const adicionar = () => {
    onChangeAjustes([...ajustes, { descricao: '', tipo: 'Aditivo', valor: 0 }])
  }

  const alterar = (index: number, novo: ItemAjusteFiscal) => {
    onChangeAjustes(ajustes.map((a, i) => (i === index ? novo : a)))
  }

  const remover = (index: number) => {
    onChangeAjustes(ajustes.filter((_, i) => i !== index))
  }

  const salvar = async () => {
    setSalvando(true)
    try {
      const lista = await ajustesFiscaisService.salvar(empresaId, ano, ajustes)
      onSalvo?.(Array.isArray(lista) ? lista : [])
      toast({
        title: 'Ajustes fiscais salvos',
        description: `Conciliação fiscal do exercício ${ano} persistida para a empresa ativa.`,
      })
    } catch (err: any) {
      console.error('Erro ao salvar ajustes fiscais:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar',
        description: err?.message || 'Falha ao salvar os ajustes fiscais.',
      })
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Card className="rounded-xl border-slate-200 bg-white shadow-xs">
      <CardHeader className="bg-slate-50/70 border-b border-slate-100 py-3.5 px-4">
        <CardTitle className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
          <ListPlus className="w-4 h-4 text-violet-600" />
          Ajustes Fiscais (IFRS) — Conciliação para o Lucro Fiscal
        </CardTitle>
        <CardDescription className="text-xs text-slate-500 mt-0.5">
          No Lucro Real, o IRPJ/CSLL incidem sobre o lucro <strong>fiscal</strong> (lucro contábil
          da DRE + aditivos − exclusões), não sobre o lucro contábil. Ajustes salvos por empresa e
          exercício {ano}.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        {/* Lista editável de ajustes */}
        <div className="space-y-2">
          {ajustes.length === 0 && (
            <p className="text-xs text-slate-400 italic py-1">
              Nenhum ajuste lançado — a base do IRPJ/CSLL é o próprio lucro contábil da DRE.
            </p>
          )}
          {ajustes.map((a, i) => (
            <LinhaAjuste
              key={i}
              index={i}
              ajuste={a}
              onChange={(novo) => alterar(i, novo)}
              onRemover={() => remover(i)}
            />
          ))}
        </div>

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs font-semibold border-slate-200 hover:bg-slate-50 text-slate-700 gap-1.5"
            onClick={adicionar}
            disabled={disabled}
          >
            <Plus className="w-3.5 h-3.5 text-violet-600" />
            Adicionar ajuste
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-8 text-xs font-semibold bg-violet-600 hover:bg-violet-700 text-white gap-1.5"
            onClick={salvar}
            disabled={disabled || salvando || !empresaId}
          >
            <Save className="w-3.5 h-3.5" />
            {salvando ? 'Salvando…' : 'Salvar ajustes'}
          </Button>
        </div>

        {/* Totalizador da conciliação */}
        <div className="rounded-xl bg-slate-50/90 border border-slate-200/80 p-3.5 space-y-1.5">
          <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
            Conciliação do exercício {ano}
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-600">Lucro contábil (DRE Gerencial):</span>
            <span className="font-semibold text-slate-800">{formatBrl(lucroContabil)}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-600">(+ ) Aditivos:</span>
            <span
              className={`font-semibold ${totalAditivos > 0 ? 'text-emerald-700' : 'text-slate-400'}`}
            >
              {totalAditivos > 0 ? '+ ' : ''}
              {formatBrl(totalAditivos)}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-600">(− ) Exclusões:</span>
            <span
              className={`font-semibold ${totalExclusoes > 0 ? 'text-rose-700' : 'text-slate-400'}`}
            >
              {totalExclusoes > 0 ? '− ' : ''}
              {formatBrl(totalExclusoes)}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs pt-1.5 border-t border-slate-200">
            <span className="font-bold text-slate-700">Lucro fiscal (base IRPJ/CSLL):</span>
            <span
              className={`font-extrabold ${
                lucroFiscal > 0
                  ? 'text-emerald-700'
                  : lucroFiscal < 0
                    ? 'text-rose-700'
                    : 'text-slate-500'
              }`}
            >
              {formatBrl(lucroFiscal)}
            </span>
          </div>
          {lucroFiscal <= 0 && (
            <div className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5">
              Lucro fiscal negativo ou zero — IRPJ/CSLL mostram <strong>—</strong> (sem imposto a
              recolher no Lucro Real).
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default AjustesFiscaisCard
