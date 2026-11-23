/**
 * Blocos visuais do Comparativo de Regimes — parte visual da
 * SecaoComparativoRegimes (cards, matriz, gráfico), extraída para manter os
 * arquivos pequenos. Recebe o resultado já calculado pelo motor.
 */

import { AlertTriangle, Award, Calculator, Layers, TrendingDown, TrendingUp } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Cell,
} from 'recharts'
import type { RegimeCargaItem, SimuladorRegimesResultado } from '@/lib/simuladorRegimesCalculo'

export function formatBrl(valor: number | null | undefined): string {
  if (valor === null || valor === undefined || !isFinite(valor)) return '—'
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function formatPercent(valor: number | null | undefined): string {
  if (valor === null || valor === undefined || !isFinite(valor)) return '—'
  return `${valor.toFixed(2).replace('.', ',')}%`
}

/** Cards por regime, com badge "Menor carga" no vencedor. */
export function CardsRegimes({ resultado }: { resultado: SimuladorRegimesResultado }) {
  const listaRegimes = [
    resultado.regimes.simples,
    resultado.regimes.presumido,
    resultado.regimes.real,
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
      {listaRegimes.map((r) => {
        const vence = r.isMenorCarga && resultado.temDados
        return (
          <Card
            key={r.id}
            className={`relative rounded-2xl shadow-xs ${
              vence
                ? 'border-2 border-emerald-500 bg-emerald-50/50 ring-4 ring-emerald-500/10'
                : 'border border-slate-200 bg-white'
            }`}
          >
            {vence && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold text-white shadow-md uppercase tracking-wider bg-emerald-600">
                  <Award className="w-3.5 h-3.5" />
                  Menor carga
                </span>
              </div>
            )}
            <CardContent className={`p-5 ${vence ? 'pt-7' : ''}`}>
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <h3 className="text-sm font-bold text-[#0B1F3A]">{r.nome}</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{r.descricao}</p>
                </div>
                {r.isRegimeAtual && (
                  <Badge
                    variant="outline"
                    className="bg-amber-50 text-amber-900 border-amber-200 text-[10px] font-bold shrink-0"
                  >
                    Regime atual
                  </Badge>
                )}
              </div>

              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Carga Tributária
              </div>
              <div className="flex items-baseline gap-2 flex-wrap">
                <span
                  className={`text-3xl font-extrabold tracking-tight ${
                    vence ? 'text-emerald-700' : 'text-slate-800'
                  }`}
                >
                  {resultado.temDados ? formatPercent(r.aliquotaEfetiva) : '—'}
                </span>
                {resultado.temDados && (
                  <span className="text-xs text-slate-500 font-medium">
                    {formatBrl(r.impostoTotal)}
                  </span>
                )}
              </div>

              <div className="mt-3 p-3 rounded-xl bg-slate-50/90 border border-slate-200/80 space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-500">Imposto bruto:</span>
                  <span className="font-semibold text-slate-800">
                    {resultado.temDados ? formatBrl(r.impostoBruto) : '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Créditos s/ compras:</span>
                  <span className="font-semibold text-emerald-700">
                    {resultado.temDados
                      ? r.creditoCompras > 0
                        ? formatBrl(r.creditoCompras)
                        : 'Sem crédito neste regime'
                      : '—'}
                  </span>
                </div>
                {r.creditos && resultado.temDados && r.creditoCompras > 0 && (
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span className="pl-2">
                      PIS/COFINS · ICMS {resultado.aliquotaIcms.toFixed(0)}% · IPI{' '}
                      {resultado.aliquotaIpi.toFixed(0)}%
                    </span>
                    <span className="font-medium text-slate-600">
                      {[r.creditos.pis + r.creditos.cofins, r.creditos.icms, r.creditos.ipi]
                        .filter((v) => v > 0)
                        .map((v) => formatBrl(v))
                        .join(' + ') || '—'}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-500">Diferença vs menor:</span>
                  <span
                    className={`font-semibold ${
                      r.diferencaVsMenor > 0 ? 'text-rose-700' : 'text-emerald-700'
                    }`}
                  >
                    {resultado.temDados
                      ? r.diferencaVsMenor > 0
                        ? `+${formatBrl(r.diferencaVsMenor)} (${formatPercent(r.diferencaPercentual)})`
                        : '—'
                      : '—'}
                  </span>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-slate-100 space-y-1">
                {r.breakdown.map((b, idx) => (
                  <div key={idx} className="flex items-center justify-between text-[11px] py-0.5">
                    <span className="text-slate-600">
                      <span className="font-semibold text-slate-800">{b.sigla}</span>
                      <span className="text-slate-400"> · {b.nome}</span>
                    </span>
                    <span className="font-semibold text-slate-900">
                      {resultado.temDados ? formatBrl(b.valor) : '—'}
                    </span>
                  </div>
                ))}
                {r.faixaSimples && (
                  <div className="text-[10px] text-slate-400 pt-1">Faixa: {r.faixaSimples}</div>
                )}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

/** Tabela matricial comparativa dos três regimes. */
export function MatrizComparativa({ resultado }: { resultado: SimuladorRegimesResultado }) {
  const listaRegimes = [
    resultado.regimes.simples,
    resultado.regimes.presumido,
    resultado.regimes.real,
  ]
  const ano = resultado.ano

  return (
    <Card className="rounded-xl border-slate-200 bg-white shadow-xs overflow-hidden">
      <CardHeader className="bg-slate-50/70 border-b border-slate-100 py-3.5 px-4">
        <CardTitle className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
          <Layers className="w-4 h-4 text-indigo-600" />
          Matriz Comparativa dos Regimes — Exercício {ano}
        </CardTitle>
        <CardDescription className="text-xs text-slate-500 mt-0.5">
          Débitos sobre a receita da DRE e créditos (PIS/COFINS, ICMS{' '}
          {resultado.aliquotaIcms.toFixed(0)}% e IPI {resultado.aliquotaIpi.toFixed(0)}%) sobre as
          compras do {resultado.centroCustoCodigo} — Matéria Prima
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-2.5 px-4 text-left">Regime</th>
                <th className="py-2.5 px-3 text-right">Imposto Bruto (R$)</th>
                <th className="py-2.5 px-3 text-right text-emerald-700">Crédito s/ Compras</th>
                <th className="py-2.5 px-3 text-right">Carga Final (R$)</th>
                <th className="py-2.5 px-3 text-right">% da Receita</th>
                <th className="py-2.5 px-3 text-right">Δ vs Menor</th>
                <th className="py-2.5 px-4 text-center">Situação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {listaRegimes.map((r) => {
                const vedado = r.id === 'simples' && resultado.receitaBruta > 4800000
                return (
                  <tr
                    key={r.id}
                    className={`hover:bg-slate-50/70 transition-colors ${
                      !resultado.temDados ? 'text-slate-400' : ''
                    }`}
                  >
                    <td className="py-2.5 px-4 font-bold text-slate-800">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            r.id === 'simples'
                              ? 'bg-blue-600'
                              : r.id === 'presumido'
                                ? 'bg-indigo-600'
                                : 'bg-amber-500'
                          }`}
                        />
                        {r.nome}
                        {r.isRegimeAtual && (
                          <Badge
                            variant="outline"
                            className="text-[9px] py-0 px-1 bg-amber-50 text-amber-900 border-amber-200"
                          >
                            Atual
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-right font-medium">
                      {resultado.temDados ? formatBrl(r.impostoBruto) : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right text-emerald-700 font-medium">
                      {resultado.temDados
                        ? r.creditoCompras > 0
                          ? formatBrl(r.creditoCompras)
                          : '—'
                        : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                      {resultado.temDados && !vedado ? formatBrl(r.impostoTotal) : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-indigo-900">
                      {resultado.temDados && !vedado ? formatPercent(r.aliquotaEfetiva) : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-medium">
                      {resultado.temDados && !vedado && r.diferencaVsMenor > 0
                        ? `+${formatBrl(r.diferencaVsMenor)}`
                        : '—'}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      {vedado ? (
                        <Badge className="bg-slate-200 text-slate-600 border-slate-300 text-[10px] font-bold">
                          Vedado (acima do teto)
                        </Badge>
                      ) : r.isMenorCarga && resultado.temDados ? (
                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px] font-bold">
                          Menor carga
                        </Badge>
                      ) : resultado.temDados ? (
                        <Badge
                          variant="outline"
                          className="bg-white text-slate-500 border-slate-200 text-[10px]"
                        >
                          —
                        </Badge>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

/** Gráfico de barras da carga por regime + síntese do cenário da reforma. */
export function GraficoCargaRegimes({ resultado }: { resultado: SimuladorRegimesResultado }) {
  const chartData = [
    resultado.regimes.simples,
    resultado.regimes.presumido,
    resultado.regimes.real,
  ].map((r: RegimeCargaItem) => ({
    regime: r.nome,
    carga: r.impostoTotal,
    aliquota: r.aliquotaEfetiva,
    isMenorCarga: r.isMenorCarga && resultado.temDados,
  }))

  return (
    <Card className="rounded-xl border-slate-200 bg-white shadow-xs">
      <CardHeader className="pb-3 border-b border-slate-100">
        <CardTitle className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
          <Calculator className="w-4 h-4 text-blue-600" />
          Carga Tributária por Regime (R$ — {resultado.ano})
        </CardTitle>
        <CardDescription className="text-xs">
          Carga final após créditos sobre as compras do {resultado.centroCustoCodigo}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        {resultado.temDados ? (
          <>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis
                    dataKey="regime"
                    tick={{ fill: '#475569', fontSize: 12, fontWeight: 600 }}
                    axisLine={{ stroke: '#CBD5E1' }}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={(val: number) => `R$ ${(val / 1000).toFixed(0)}k`}
                    tick={{ fill: '#64748B', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <RechartsTooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const d = payload[0].payload
                        return (
                          <div className="bg-[#0B1F3A] text-white p-3 rounded-xl shadow-xl text-xs space-y-1 min-w-[200px]">
                            <p className="font-bold text-sm text-blue-200">{d.regime}</p>
                            <div className="flex justify-between gap-4 text-slate-300">
                              <span>Carga final:</span>
                              <span className="font-bold text-white">{formatBrl(d.carga)}</span>
                            </div>
                            <div className="flex justify-between gap-4 text-slate-300">
                              <span>% da receita:</span>
                              <span className="font-bold text-emerald-300">
                                {formatPercent(d.aliquota)}
                              </span>
                            </div>
                            {d.isMenorCarga && (
                              <p className="pt-1 text-emerald-400 font-bold border-t border-white/10">
                                Menor carga tributária
                              </p>
                            )}
                          </div>
                        )
                      }
                      return null
                    }}
                  />
                  <Bar dataKey="carga" radius={[8, 8, 0, 0]} maxBarSize={70}>
                    {chartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.isMenorCarga ? '#10b981' : '#64748b'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-4 p-4 rounded-xl bg-indigo-50/70 border border-indigo-100 flex items-start gap-3">
              {resultado.reforma.economia >= 0 ? (
                <TrendingDown className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <TrendingUp className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              )}
              <p className="text-xs text-slate-700 leading-relaxed">
                <strong>Cenário da Reforma ({resultado.reforma.fase.descricao}):</strong> carga do
                regime atual ({resultado.regimes[resultado.reforma.regimeAtualId].nome}) de{' '}
                <strong>{formatBrl(resultado.reforma.cargaRegimeAtual)}</strong> passa a{' '}
                <strong>{formatBrl(resultado.reforma.cargaPosReforma)}</strong> com CBS{' '}
                {formatPercent(resultado.reforma.aliquotaCbs)} + IBS{' '}
                {formatPercent(resultado.reforma.aliquotaIbs)} —{' '}
                {resultado.reforma.economia >= 0 ? (
                  <strong className="text-emerald-700">
                    economia de {formatBrl(resultado.reforma.economia)} (
                    {formatPercent(resultado.reforma.economiaPercentual)})
                  </strong>
                ) : (
                  <strong className="text-rose-700">
                    aumento de {formatBrl(Math.abs(resultado.reforma.economia))} (
                    {formatPercent(Math.abs(resultado.reforma.economiaPercentual))})
                  </strong>
                )}
                . Economia máxima entre regimes no modelo atual:{' '}
                <strong>{formatBrl(resultado.economiaMaxima)}</strong>.
              </p>
            </div>
          </>
        ) : (
          <div className="h-72 flex flex-col items-center justify-center text-slate-400 gap-2">
            <Calculator className="w-8 h-8" />
            <p className="text-xs font-medium">
              Sem dados para o gráfico no exercício {resultado.ano}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/** Aviso de período sem dados — nunca zero enganoso. */
export function AvisoSemDados({
  ano,
  centroCustoCodigo,
}: {
  ano: number
  centroCustoCodigo: string
}) {
  return (
    <Card className="border-amber-200 bg-amber-50/80 rounded-2xl">
      <CardContent className="p-8 text-center">
        <div className="max-w-lg mx-auto flex flex-col items-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mb-4">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-amber-900 mb-2">
            Sem dados para o exercício {ano}
          </h3>
          <p className="text-sm text-amber-800 leading-relaxed">
            Não há receita na DRE Gerencial nem lançamentos de compras no Centro de Custo{' '}
            {centroCustoCodigo} para {ano}. Importe o DRE ou registre os lançamentos para habilitar
            o comparativo.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
