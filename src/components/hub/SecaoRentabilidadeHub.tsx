import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Percent } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  calcularBalanco,
  calcularDre,
  calcularIndicadores,
  consolidarBalancoAnual,
  formatNumber,
} from '@/lib/financeCalculations'
import {
  resolverReferenciaMercado,
  type ReferenciaMercado,
} from '@/components/indicadores/benchmarkHub'
import type { BalancoRecord, DreRecord } from '@/types/finance'

interface SecaoRentabilidadeHubProps {
  balancosAno: BalancoRecord[]
  /** DRE consolidada do ano (já com fallback sintético por lançamentos, igual aos demais cards do HUB). */
  dreAno: DreRecord | null
  anoAtivo: number
  empresaId: string | null
  segmento?: string | null
  isCliente: boolean
}

type Faixa = 'verde' | 'ambar' | 'vermelho' | 'indefinido'

interface LimiarFaixa {
  verde: number
  ambar: number
  rotuloVerde: string
  rotuloAmbar: string
  rotuloVermelho: string
}

/**
 * Faixas copiadas da tela oficial de Indicadores de Rentabilidade (/indicadores/rentabilidade)
 * e do Painel de Indicadores do HUB (Margem Bruta / Margem EBITDA):
 * ROE 🟢 ≥15% 🟠 5–15% 🔴 <5% · ROA 🟢 ≥8% 🟠 3–8% 🔴 <3% ·
 * Margem Bruta 🟢 ≥40% 🟠 20–40% 🔴 <20% · Margem Líquida 🟢 ≥10% 🟠 5–10% 🔴 <5% ·
 * Giro do Ativo 🟢 ≥1,0x 🟠 0,5–1,0x 🔴 <0,5x · Margem EBITDA 🟢 ≥10% 🟠 0–10% 🔴 <0%.
 */
// Chaves em kebab-case, alinhadas aos ids dos cards renderizados abaixo
// ('margem-bruta', 'margem-liquida', 'giro-ativo', 'margem-ebitda').
const LIMIARES: Record<string, LimiarFaixa> = {
  roe: {
    verde: 15,
    ambar: 5,
    rotuloVerde: 'Excelente (≥ 15%)',
    rotuloAmbar: 'Adequado (5 – 15%)',
    rotuloVermelho: 'Alerta (< 5%)',
  },
  roa: {
    verde: 8,
    ambar: 3,
    rotuloVerde: 'Excelente (≥ 8%)',
    rotuloAmbar: 'Adequado (3 – 8%)',
    rotuloVermelho: 'Alerta (< 3%)',
  },
  'margem-bruta': {
    verde: 40,
    ambar: 20,
    rotuloVerde: 'Excelente (≥ 40%)',
    rotuloAmbar: 'Média (20 – 40%)',
    rotuloVermelho: 'Baixa (< 20%)',
  },
  'margem-liquida': {
    verde: 10,
    ambar: 5,
    rotuloVerde: 'Excelente (≥ 10%)',
    rotuloAmbar: 'Adequado (5 – 10%)',
    rotuloVermelho: 'Alerta (< 5%)',
  },
  'giro-ativo': {
    verde: 1.0,
    ambar: 0.5,
    rotuloVerde: 'Excelente (≥ 1,0x)',
    rotuloAmbar: 'Adequado (0,5 – 1,0x)',
    rotuloVermelho: 'Alerta (< 0,5x)',
  },
  'margem-ebitda': {
    verde: 10,
    ambar: 0,
    rotuloVerde: 'Forte (≥ 10%)',
    rotuloAmbar: 'Moderada (0 – 10%)',
    rotuloVermelho: 'Fraca (< 0%)',
  },
}

function getStatus(val: number | null, lim: LimiarFaixa | undefined): Faixa {
  if (val === null || !Number.isFinite(val) || !lim) return 'indefinido'
  if (val >= lim.verde) return 'verde'
  if (val >= lim.ambar) return 'ambar'
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

const ROTULO_SEM_DADOS = 'Sem dados'

export function SecaoRentabilidadeHub({
  balancosAno,
  dreAno,
  anoAtivo,
  empresaId,
  segmento,
  isCliente,
}: SecaoRentabilidadeHubProps) {
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
    // Mesmas fórmulas oficiais de calcularIndicadores/calcularDre (financeCalculations)
    const ind = calcularIndicadores(bAtivo, dreAno)
    const calcD = calcularDre(dreAno)
    const calcB = calcularBalanco(bAtivo)
    const temDre = !!dreAno

    // Giro do Ativo: mesma fórmula da tela oficial (RL / AT), null quando sem base
    const giro =
      temDre && calcB.ativoTotal > 0 && calcD.receitaLiquida !== 0
        ? calcD.receitaLiquida / calcB.ativoTotal
        : null

    // Margem EBITDA: mesma fórmula do Painel de Indicadores do HUB (EBITDA / Receita)
    const margemEbitda =
      temDre && calcD.receitaLiquida !== 0 ? (calcD.ebitda / calcD.receitaLiquida) * 100 : null

    return [
      {
        id: 'roe',
        nome: 'Rentabilidade do PL',
        sigla: 'ROE',
        formula: 'LL / PL × 100',
        valor: temDre ? ind.roe : null,
        refValor: referencia?.roe,
        sufixo: '%',
      },
      {
        id: 'roa',
        nome: 'Retorno sobre Ativos',
        sigla: 'ROA',
        formula: 'LL / AT × 100',
        valor: temDre ? ind.roa : null,
        refValor: referencia?.roa,
        sufixo: '%',
      },
      {
        id: 'margem-bruta',
        nome: 'Margem Bruta',
        sigla: 'MB',
        formula: 'LB / RL × 100',
        valor: temDre ? ind.margemBruta : null,
        refValor: referencia?.margemBruta,
        sufixo: '%',
      },
      {
        id: 'margem-liquida',
        nome: 'Margem Líquida',
        sigla: 'ML',
        formula: 'LL / RL × 100',
        valor: temDre ? ind.margemLiquida : null,
        refValor: referencia?.margemLiquida,
        sufixo: '%',
      },
      {
        id: 'giro-ativo',
        nome: 'Giro do Ativo',
        sigla: 'GA',
        formula: 'RL / AT',
        valor: giro,
        refValor: referencia?.giroAtivo,
        sufixo: 'x',
      },
      {
        id: 'margem-ebitda',
        nome: 'Margem EBITDA',
        sigla: 'ME',
        formula: 'EBITDA / RL × 100',
        valor: margemEbitda,
        refValor: referencia?.margemEbitda,
        sufixo: '%',
      },
    ]
  }, [balancosAno, dreAno, anoAtivo, referencia])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
            Indicadores de Rentabilidade do Exercício {anoAtivo}
          </h2>
        </div>
        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1.5">
          <Percent className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          {referencia
            ? `Referência: ${referencia.rotuloSetor}${referencia.usarFallback ? ' (padrão)' : ''}`
            : 'Fonte: DRE & Balanço Patrimonial ativos'}
        </span>
      </div>

      {carregandoRef ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map((card) => {
            const lim = LIMIARES[card.id]
            const faixa = getStatus(card.valor, lim)
            const cores = CORES_FAIXA[faixa]
            // Indicador sem faixa mapeada nos limiares: estado neutro, nunca quebra
            const rotuloFaixa =
              faixa === 'verde'
                ? (lim?.rotuloVerde ?? ROTULO_SEM_DADOS)
                : faixa === 'ambar'
                  ? (lim?.rotuloAmbar ?? ROTULO_SEM_DADOS)
                  : faixa === 'vermelho'
                    ? (lim?.rotuloVermelho ?? ROTULO_SEM_DADOS)
                    : ROTULO_SEM_DADOS
            return (
              <div
                key={card.id}
                onClick={() =>
                  navigate(isCliente ? '/cliente/rentabilidade' : '/indicadores/rentabilidade')
                }
                className="group cursor-pointer rounded-2xl p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-emerald-400 dark:hover:border-emerald-500 transition-all duration-200 relative overflow-hidden"
              >
                <div className={`absolute top-0 left-0 right-0 h-1 ${cores.strip} opacity-80`} />
                <div className="flex items-center justify-between mb-2 gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {card.nome} ({card.sigla})
                  </span>
                  <Badge
                    variant="outline"
                    className={`${cores.badge} text-[10px] font-semibold whitespace-nowrap`}
                  >
                    {rotuloFaixa}
                  </Badge>
                </div>
                <div className={`text-2xl font-black tabular-nums tracking-tight ${cores.valor}`}>
                  {card.valor === null ? '—' : `${formatNumber(card.valor, 2)}${card.sufixo}`}
                </div>
                <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                  <span className="font-mono">{card.formula}</span>
                  {card.refValor !== undefined && card.valor !== null ? (
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                      Mercado: {formatNumber(card.refValor, 2)}
                      {card.sufixo}
                    </span>
                  ) : (
                    <span className="font-semibold group-hover:translate-x-0.5 transition-transform">
                      {isCliente ? 'Rentabilidade →' : 'Indicadores →'}
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

export default SecaoRentabilidadeHub
