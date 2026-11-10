import React, { useMemo, useState } from 'react'
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
} from 'recharts'
import {
  Radar as RadarIcon,
  BarChart3,
  GitCompareArrows,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { formatPercent, formatNumber } from '@/lib/financeCalculations'
import type {
  BalancoRecord,
  DreRecord,
  LancamentoRecord,
  ContaRecord,
  PlanoContaRecord,
} from '@/types/finance'
import {
  consolidarBalancoAnual,
  consolidarDreAnual,
  calcularDre,
  calcularBalanco,
} from '@/lib/financeCalculations'
import { calcularAnaliseFaturamento } from '@/lib/analiseFaturamentoCalculo'

export interface ComparacaoIndicadoresGraficosProps {
  empresaId: string | null
  anoAtivo: number
  anosDisponiveis: number[]
  balancos: BalancoRecord[]
  dres: DreRecord[]
  lancamentos: LancamentoRecord[]
  contas: ContaRecord[]
  planoContas: PlanoContaRecord[]
}

type ChaveIndicador =
  | 'roe'
  | 'margem_liquida'
  | 'margem_bruta'
  | 'margem_ebitda'
  | 'liquidez_corrente'
  | 'endividamento'

interface DefinicaoIndicador {
  chave: ChaveIndicador
  rotulo: string
  unidade: 'percentual' | 'multiplo'
  /** Valor máximo do domínio de referência para normalização no radar (0 a 1). */
  normalizacaoMax: number
  /** Endividamento: alta = piora (inverte cor verde/vermelho). */
  inverteCor: boolean
}

const INDICADORES_COMPARADOS: DefinicaoIndicador[] = [
  { chave: 'roe', rotulo: 'ROE', unidade: 'percentual', normalizacaoMax: 30, inverteCor: false },
  {
    chave: 'margem_liquida',
    rotulo: 'Margem Líquida',
    unidade: 'percentual',
    normalizacaoMax: 25,
    inverteCor: false,
  },
  {
    chave: 'margem_bruta',
    rotulo: 'Margem Bruta',
    unidade: 'percentual',
    normalizacaoMax: 80,
    inverteCor: false,
  },
  {
    chave: 'margem_ebitda',
    rotulo: 'Margem EBITDA',
    unidade: 'percentual',
    normalizacaoMax: 35,
    inverteCor: false,
  },
  {
    chave: 'liquidez_corrente',
    rotulo: 'Liquidez Corrente',
    unidade: 'multiplo',
    normalizacaoMax: 2.5,
    inverteCor: false,
  },
  {
    chave: 'endividamento',
    rotulo: 'Endividamento Geral',
    unidade: 'percentual',
    normalizacaoMax: 100,
    inverteCor: true,
  },
]

const CORES_SERIE = ['#2563EB', '#F59E0B', '#10B981']

interface ApuracaoAno {
  ano: number
  temDados: boolean
  valores: Record<ChaveIndicador, number | null>
}

/**
 * Apura os indicadores de um exercício usando EXATAMENTE os mesmos motores
 * de cálculo dos hodômetros (consolidação de balanço, DRE e fallback por
 * lançamentos via calcularAnaliseFaturamento) — nenhuma fórmula duplicada.
 */
function apurarIndicadoresAno(
  ano: number,
  balancos: BalancoRecord[],
  dres: DreRecord[],
  lancamentos: LancamentoRecord[],
  contas: ContaRecord[],
  planoContas: PlanoContaRecord[],
  empresaId: string | null,
): ApuracaoAno {
  const balancosDoAno = balancos.filter((b) => b.ano === ano)
  const dresDoAno = dres.filter((d) => d.ano === ano)

  let dConsol = consolidarDreAnual(dresDoAno, ano)
  const bConsol = consolidarBalancoAnual(balancosDoAno, ano)

  // Fallback sintético por lançamentos se DRE não tiver dados (mesma regra dos hodômetros)
  const dreSemDados =
    !dConsol ||
    (!dConsol.receita_bruta &&
      !dConsol.despesas_operacionais &&
      !dConsol.custo_mercadorias &&
      !dConsol.despesas_financeiras)

  const lancsAno = lancamentos.filter((l) => {
    const dataStr = l.data_competencia || l.data_pagamento || l.data_lancamento
    if (!dataStr) return false
    return new Date(dataStr).getFullYear() === ano
  })

  if (dreSemDados && lancsAno.length > 0) {
    const faturamentoMotor = calcularAnaliseFaturamento(lancsAno, contas, planoContas)
    const linhaAno = faturamentoMotor.linhasPorAno.find((l) => l.ano === ano)
    if (linhaAno && linhaAno.totalAno > 0) {
      dConsol = {
        id: `sintetico-${ano}`,
        collectionId: 'dres',
        collectionName: 'dres',
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        empresa: empresaId || '',
        ano,
        mes: 12,
        receita_bruta: linhaAno.totalAno,
        deducoes_receita: 0,
        custo_mercadorias: 0,
        despesas_operacionais: 0,
        despesas_financeiras: 0,
        outras_receitas_despesas: 0,
        imposto_renda: 0,
      }
    }
  }

  const calcD = calcularDre(dConsol)
  const calcB = calcularBalanco(bConsol)

  const receitaRef = calcD.receitaLiquida > 0 ? calcD.receitaLiquida : dConsol.receita_bruta || 0
  const lucro = calcD.lucroLiquido
  const temDados =
    (dConsol.receita_bruta || 0) > 0 ||
    calcD.receitaLiquida > 0 ||
    calcB.ativoTotal > 0 ||
    lucro !== 0 ||
    lancsAno.length > 0

  const valores: Record<ChaveIndicador, number | null> = {
    roe:
      calcB.patrimonioLiquido > 0 && lucro !== 0 ? (lucro / calcB.patrimonioLiquido) * 100 : null,
    margem_liquida: receitaRef > 0 ? (lucro / receitaRef) * 100 : null,
    margem_bruta: receitaRef > 0 ? (calcD.lucroBruto / receitaRef) * 100 : null,
    margem_ebitda: receitaRef > 0 ? (calcD.ebitda / receitaRef) * 100 : null,
    liquidez_corrente:
      calcB.passivoCirculante > 0 ? calcB.ativoCirculante / calcB.passivoCirculante : null,
    endividamento: calcB.ativoTotal > 0 ? (calcB.passivoTotal / calcB.ativoTotal) * 100 : null,
  }

  return { ano, temDados, valores }
}

function formatarValorIndicador(valor: number | null, unidade: 'percentual' | 'multiplo'): string {
  if (valor === null || !Number.isFinite(valor)) return '—'
  return unidade === 'percentual' ? formatPercent(valor, 1) : `${formatNumber(valor, 2)}x`
}

const tooltipStyle = {
  backgroundColor: '#0B1F3A',
  borderRadius: '0.75rem',
  border: '1px solid rgba(255,255,255,0.15)',
  color: '#FFFFFF',
  fontSize: '12px',
}

export function ComparacaoIndicadoresGraficos({
  empresaId,
  anoAtivo,
  anosDisponiveis,
  balancos,
  dres,
  lancamentos,
  contas,
  planoContas,
}: ComparacaoIndicadoresGraficosProps) {
  // Anos distintos com qualquer dado da empresa ativa (mesma base dos hodômetros)
  const anosComDados = useMemo(() => {
    const set = new Set<number>(anosDisponiveis)
    balancos.forEach((b) => set.add(Number(b.ano)))
    dres.forEach((d) => set.add(Number(d.ano)))
    lancamentos.forEach((l) => {
      const dataStr = l.data_competencia || l.data_pagamento || l.data_lancamento
      if (dataStr) {
        const ano = new Date(dataStr).getFullYear()
        if (ano > 2000 && ano < 2100) set.add(ano)
      }
    })
    return Array.from(set)
      .filter((a) => !Number.isNaN(a) && a > 2000 && a < 2100)
      .sort((a, b) => b - a) // mais recente primeiro
  }, [anosDisponiveis, balancos, dres, lancamentos])

  const [selecionados, setSelecionados] = useState<number[]>(() => {
    const inicial = [...anosComDados].slice(0, 2)
    return inicial.length > 0 ? inicial : []
  })

  const toggleAno = (ano: number) => {
    setSelecionados((prev) => {
      if (prev.includes(ano)) {
        // Não deixa remover o último exercício
        if (prev.length === 1) return prev
        return prev.filter((a) => a !== ano)
      }
      return [...prev, ano].slice(-3)
    })
  }

  const apuracoes = useMemo(() => {
    const anosParaApurar = selecionados.length > 0 ? selecionados : [anoAtivo]
    return [...anosParaApurar]
      .sort((a, b) => a - b)
      .map((ano) =>
        apurarIndicadoresAno(ano, balancos, dres, lancamentos, contas, planoContas, empresaId),
      )
  }, [selecionados, anoAtivo, balancos, dres, lancamentos, contas, planoContas, empresaId])

  const dadosRadar = useMemo(
    () =>
      INDICADORES_COMPARADOS.map((ind) => {
        const linha: Record<string, string | number | null> = { indicador: ind.rotulo }
        for (const ap of apuracoes) {
          const v = ap.valores[ind.chave]
          linha[`ex_${ap.ano}`] =
            v !== null && Number.isFinite(v)
              ? Math.min(Math.max(v / ind.normalizacaoMax, 0), 1)
              : null
          linha[`ex_${ap.ano}_real`] = v
        }
        return linha
      }),
    [apuracoes],
  )

  const dadosBarras = useMemo(
    () =>
      INDICADORES_COMPARADOS.map((ind) => {
        const linha: Record<string, string | number | null> = { indicador: ind.rotulo }
        for (const ap of apuracoes) {
          linha[`ex_${ap.ano}`] = ap.valores[ind.chave]
        }
        return linha
      }),
    [apuracoes],
  )

  const hasAnyData = apuracoes.some((a) => a.temDados)

  // ===== Comparação com ano anterior: delta absoluto e % =====
  const comparacoes = useMemo(() => {
    const anosOrdenados = [...apuracoes].sort((a, b) => a.ano - b.ano)
    // Pega a dupla consecutiva mais recente (os dois últimos exercícios selecionados)
    const atual = anosOrdenados.length >= 2 ? anosOrdenados[anosOrdenados.length - 1] : null
    const anterior = anosOrdenados.length >= 2 ? anosOrdenados[anosOrdenados.length - 2] : null

    return INDICADORES_COMPARADOS.map((ind) => {
      if (!atual || !anterior) {
        return { ind, atual: null, anterior: null, deltaAbs: null, deltaPct: null }
      }
      const vA = atual.valores[ind.chave]
      const vB = anterior.valores[ind.chave]
      if (vA === null || vB === null) {
        return { ind, atual: null, anterior: null, deltaAbs: null, deltaPct: null }
      }
      const deltaAbs = vA - vB
      const deltaPct = vB !== 0 ? (deltaAbs / Math.abs(vB)) * 100 : null
      return { ind, atual: atual.ano, anterior: anterior.ano, deltaAbs, deltaPct }
    })
  }, [apuracoes])

  const renderDelta = (
    deltaAbs: number | null,
    deltaPct: number | null,
    unidade: 'percentual' | 'multiplo',
    inverteCor: boolean,
  ) => {
    if (deltaAbs === null || !Number.isFinite(deltaAbs)) {
      return <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">—</span>
    }
    const neutro = Math.abs(deltaAbs) < 1e-9
    const melhora = !neutro && (inverteCor ? deltaAbs < 0 : deltaAbs > 0)
    const piora = !neutro && !melhora
    const cor = neutro
      ? 'text-slate-500 dark:text-slate-400'
      : melhora
        ? 'text-emerald-600 dark:text-emerald-400'
        : 'text-red-600 dark:text-red-400'
    const seta = neutro ? (
      <Minus className="w-3 h-3" />
    ) : melhora ? (
      <ArrowUpRight className="w-3 h-3" />
    ) : (
      <ArrowDownRight className="w-3 h-3" />
    )
    return (
      <span className={`inline-flex items-center gap-0.5 font-semibold text-xs ${cor}`}>
        {seta}
        {unidade === 'percentual'
          ? `${deltaAbs >= 0 ? '+' : ''}${formatNumber(deltaAbs, 1)} p.p.`
          : `${deltaAbs >= 0 ? '+' : ''}${formatNumber(deltaAbs, 2)}x`}
        {deltaPct !== null && (
          <span className="text-[10px] opacity-80">
            {' '}
            ({deltaPct >= 0 ? '+' : ''}
            {formatNumber(deltaPct, 0)}%)
          </span>
        )}
      </span>
    )
  }

  // Sem exercício com dados: estado vazio elegante
  if (!hasAnyData) {
    return (
      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
        <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <RadarIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <CardTitle className="text-base font-bold text-[#0B1F3A] dark:text-white">
              Comparação de Indicadores entre Exercícios
            </CardTitle>
          </div>
          <CardDescription className="text-xs text-slate-500 dark:text-slate-400">
            Radar e barras comparando ROE, margens, liquidez e endividamento entre exercícios.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4 text-xs text-slate-500 dark:text-slate-400">
          Nenhum dado disponível para a empresa ativa. Importe balanços, DREs ou lançamentos para
          visualizar a comparação entre exercícios.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* ===== CARD: Radar comparativo ===== */}
      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
        <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <RadarIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <CardTitle className="text-base font-bold text-[#0B1F3A] dark:text-white">
                Radar Comparativo de Indicadores
              </CardTitle>
            </div>
            <CardDescription className="text-xs text-slate-500 dark:text-slate-400">
              ROE, margens, Liquidez Corrente normalizada e Endividamento invertido, por exercício
              selecionado (máx. 3).
            </CardDescription>
          </div>

          {/* Seletor de exercícios (checkboxes) */}
          <div className="flex items-center gap-2 flex-wrap">
            {anosComDados.slice(0, 6).map((ano) => (
              <label
                key={ano}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-all ${
                  selecionados.includes(ano)
                    ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300'
                    : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                }`}
              >
                <Checkbox
                  checked={selecionados.includes(ano)}
                  onCheckedChange={() => toggleAno(ano)}
                  className="w-3.5 h-3.5"
                />
                {ano}
              </label>
            ))}
          </div>
        </CardHeader>

        <CardContent className="pt-4">
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={dadosRadar} margin={{ top: 10, right: 30, bottom: 0, left: 30 }}>
                <PolarGrid stroke="#E2E8F0" />
                <PolarAngleAxis dataKey="indicador" tick={{ fontSize: 11, fill: '#64748B' }} />
                <PolarRadiusAxis tick={false} axisLine={false} domain={[0, 1]} />
                {apuracoes.map((ap, i) => (
                  <Radar
                    key={ap.ano}
                    name={`Exercício ${ap.ano}`}
                    dataKey={`ex_${ap.ano}`}
                    stroke={CORES_SERIE[i % CORES_SERIE.length]}
                    fill={CORES_SERIE[i % CORES_SERIE.length]}
                    fillOpacity={0.18}
                    strokeWidth={2}
                    connectNulls
                  />
                ))}
                <RechartsTooltip contentStyle={tooltipStyle} />
                <Legend
                  formatter={(val) => (
                    <span className="text-xs text-slate-700 dark:text-slate-300">{val}</span>
                  )}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2 text-center">
            Cada eixo normalizado pelo domínio de referência do indicador (ROE até 30%, Margem
            Líquida até 25%, Margem Bruta até 80%, EBITDA até 35%, Liquidez até 2,5x, Endividamento
            até 100%).
          </p>
        </CardContent>
      </Card>

      {/* ===== CARD: Barras agrupadas ===== */}
      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
        <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <CardTitle className="text-base font-bold text-[#0B1F3A] dark:text-white">
              Barras Comparativas por Indicador
            </CardTitle>
          </div>
          <CardDescription className="text-xs text-slate-500 dark:text-slate-400">
            Um grupo por indicador, uma barra por exercício selecionado — valores apurados pelos
            mesmos motores de balanço, DRE e Z-Score Altman dos hodômetros.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dadosBarras} margin={{ top: 15, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis
                  dataKey="indicador"
                  tick={{ fontSize: 10, fill: '#64748B' }}
                  axisLine={{ stroke: '#CBD5E1' }}
                  tickLine={false}
                  interval={0}
                />
                <YAxis tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                <RechartsTooltip
                  contentStyle={tooltipStyle}
                  formatter={(val: any, name: any) => [
                    val !== null && val !== undefined && Number.isFinite(Number(val))
                      ? formatarValorIndicador(Number(val), 'percentual')
                      : '—',
                    name,
                  ]}
                />
                <Legend
                  formatter={(val) => (
                    <span className="text-xs text-slate-700 dark:text-slate-300">{val}</span>
                  )}
                />
                {apuracoes.map((ap, i) => (
                  <Bar
                    key={ap.ano}
                    dataKey={`ex_${ap.ano}`}
                    name={`Exercício ${ap.ano}`}
                    fill={CORES_SERIE[i % CORES_SERIE.length]}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={40}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* ===== CARD: Comparação com o ano anterior (deltas) ===== */}
      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
        <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <GitCompareArrows className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <CardTitle className="text-base font-bold text-[#0B1F3A] dark:text-white">
              Comparação com o Exercício Anterior
            </CardTitle>
          </div>
          <CardDescription className="text-xs text-slate-500 dark:text-slate-400">
            Variação absoluta e percentual entre os dois exercícios mais recentes selecionados. Para
            Endividamento, alta é piora (cores invertidas).
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {comparacoes.map(({ ind, atual, anterior, deltaAbs, deltaPct }) => (
              <div
                key={ind.chave}
                className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex flex-col gap-1"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                    {ind.rotulo}
                  </span>
                  <Badge
                    className={`text-[10px] font-bold ${
                      ind.inverteCor
                        ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                        : 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                    }`}
                  >
                    {ind.unidade === 'percentual' ? '%' : 'x'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-xs gap-2 flex-wrap">
                  <span className="text-slate-500 dark:text-slate-400">
                    {atual !== null && anterior !== null ? `${anterior} → ${atual}` : 'Sem par'}
                  </span>
                  {renderDelta(deltaAbs, deltaPct, ind.unidade, ind.inverteCor)}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
