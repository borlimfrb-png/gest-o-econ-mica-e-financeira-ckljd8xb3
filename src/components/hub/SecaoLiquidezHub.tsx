import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Droplets } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  calcularIndicadores,
  consolidarBalancoAnual,
  formatNumber,
} from '@/lib/financeCalculations'
import {
  resolverReferenciaMercado,
  type ReferenciaMercado,
} from '@/components/indicadores/benchmarkHub'
import type { BalancoRecord } from '@/types/finance'

interface SecaoLiquidezHubProps {
  balancosAno: BalancoRecord[]
  anoAtivo: number
  empresaId: string | null
  segmento?: string | null
  isCliente: boolean
}

type Faixa = 'verde' | 'ambar' | 'vermelho' | 'indefinido'

/**
 * Faixas copiadas da tela oficial de Indicadores de Liquidez (/indicadores/liquidez):
 * verde >= 1,0 · âmbar 0,8–1,0 · vermelho < 0,8 · "—" (indefinido) quando PC = 0/sem dados.
 */
function getStatus(val: number | null): Faixa {
  if (val === null || !Number.isFinite(val)) return 'indefinido'
  if (val >= 1.0) return 'verde'
  if (val >= 0.8) return 'ambar'
  return 'vermelho'
}

const CORES_FAIXA: Record<Faixa, { strip: string; valor: string; badge: string }> = {
  verde: {
    strip: 'bg-emerald-500',
    valor: 'text-emerald-700 dark:text-emerald-400',
    badge:
      'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  },
  ambar: {
    strip: 'bg-amber-500',
    valor: 'text-amber-700 dark:text-amber-400',
    badge:
      'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  },
  vermelho: {
    strip: 'bg-red-500',
    valor: 'text-red-600 dark:text-red-400',
    badge:
      'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300 border-red-200 dark:border-red-800',
  },
  indefinido: {
    strip: 'bg-slate-300 dark:bg-slate-700',
    valor: 'text-slate-400 dark:text-slate-500',
    badge:
      'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700',
  },
}

const ROTULO_FAIXA: Record<Faixa, string> = {
  verde: 'Adequado (≥ 1,0)',
  ambar: 'Atenção (0,8 – 1,0)',
  vermelho: 'Alerta (< 0,8)',
  indefinido: 'Sem dados',
}

export function SecaoLiquidezHub({
  balancosAno,
  anoAtivo,
  empresaId,
  segmento,
  isCliente,
}: SecaoLiquidezHubProps) {
  const navigate = useNavigate()
  const [referencia, setReferencia] = useState<ReferenciaMercado | null>(null)
  const [carregandoRef, setCarregandoRef] = useState(true)

  // Resolvedor padrão do HUB (nunca benchmarksService direto nos componentes)
  useEffect(() => {
    let cancelado = false
    setCarregandoRef(true)
    resolverReferenciaMercado(segmento, empresaId)
      .then((ref) => {
        if (!cancelado) setReferencia(ref)
      })
      .catch(() => {
        if (!cancelado) setReferencia(null)
      })
      .finally(() => {
        if (!cancelado) setCarregandoRef(false)
      })
    return () => {
      cancelado = true
    }
  }, [segmento, empresaId])

  const cards = useMemo(() => {
    const bAtivo = consolidarBalancoAnual(balancosAno, anoAtivo)
    const ind = calcularIndicadores(bAtivo)

    return [
      {
        id: 'lc',
        nome: 'Liquidez Corrente',
        sigla: 'LC',
        formula: 'AC / PC',
        valor: ind.liquidezCorrente,
        refValor: referencia?.liquidezCorrente,
      },
      {
        id: 'ls',
        nome: 'Liquidez Seca',
        sigla: 'LS',
        formula: '(AC − Estoque) / PC',
        valor: ind.liquidezSeca,
        refValor: referencia?.liquidezSeca,
      },
      {
        id: 'li',
        nome: 'Liquidez Imediata',
        sigla: 'LI',
        formula: 'Disponível / PC',
        valor: ind.liquidezImediata,
        refValor: referencia?.liquidezImediata,
      },
      {
        id: 'lg',
        nome: 'Liquidez Geral',
        sigla: 'LG',
        formula: '(AC + RNC) / (PC + PNC)',
        valor: ind.liquidezGeral,
        refValor: referencia?.liquidezGeral,
      },
    ]
  }, [balancosAno, anoAtivo, referencia])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-500 animate-pulse" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
            Indicadores de Liquidez do Exercício {anoAtivo}
          </h2>
        </div>
        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1.5">
          <Droplets className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
          {referencia
            ? `Referência: ${referencia.rotuloSetor}${referencia.usarFallback ? ' (padrão)' : ''}`
            : 'Fonte: Balanço Patrimonial ativo'}
        </span>
      </div>

      {carregandoRef ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map((card) => {
            const faixa = getStatus(card.valor)
            const cores = CORES_FAIXA[faixa]
            return (
              <div
                key={card.id}
                onClick={() =>
                  navigate(isCliente ? '/cliente/indicadores' : '/indicadores/liquidez')
                }
                className="group cursor-pointer rounded-2xl p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-cyan-400 dark:hover:border-cyan-500 transition-all duration-200 relative overflow-hidden"
              >
                <div className={`absolute top-0 left-0 right-0 h-1 ${cores.strip} opacity-80`} />
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {card.nome} ({card.sigla})
                  </span>
                  <Badge
                    variant="outline"
                    className={`${cores.badge} text-[10px] font-semibold whitespace-nowrap`}
                  >
                    {ROTULO_FAIXA[faixa]}
                  </Badge>
                </div>
                <div className={`text-2xl font-black tabular-nums tracking-tight ${cores.valor}`}>
                  {card.valor === null ? '—' : formatNumber(card.valor, 2)}
                </div>
                <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                  <span className="font-mono">{card.formula}</span>
                  {card.refValor !== undefined && card.valor !== null ? (
                    <span className="text-cyan-600 dark:text-cyan-400 font-semibold">
                      Mercado: {formatNumber(card.refValor, 2)}
                    </span>
                  ) : (
                    <span className="font-semibold group-hover:translate-x-0.5 transition-transform">
                      {isCliente ? 'Indicadores →' : 'Liquidez →'}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default SecaoLiquidezHub
