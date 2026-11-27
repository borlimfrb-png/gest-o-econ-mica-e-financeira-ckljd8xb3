import { useMemo } from 'react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  LineChart,
  Line,
  ComposedChart,
} from 'recharts'
import {
  AreaChart as AreaIcon,
  BarChart3,
  CalendarDays,
  TrendingUp,
  TrendingDown,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  montarSerieMensal360,
  type AnaliseAnual360Resultado,
  type TipoTelaAnalise,
} from '@/lib/analiseAnual360'
import { calcularRegressaoLinear } from '@/lib/regressaoLinearTendencia'

function formatBrl(val: number | undefined | null): string {
  if (val === undefined || val === null || !Number.isFinite(val)) return 'R$ 0,00'
  return val.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function formatBrlCompacto(val: number): string {
  if (!Number.isFinite(val)) return 'R$ 0'
  const abs = Math.abs(val)
  const sinal = val < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sinal}R$ ${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${sinal}R$ ${(abs / 1_000).toFixed(0)}k`
  return `${sinal}R$ ${abs.toFixed(0)}`
}

function formatPercent(val: number | undefined | null): string {
  if (val === undefined || val === null || !Number.isFinite(val)) return '—'
  return `${val.toFixed(2)}%`
}

interface SecaoAnaliseAnualProps {
  tipo: TipoTelaAnalise
  resultado: AnaliseAnual360Resultado
}

function CardResumo({
  titulo,
  valor,
  icone,
  cor,
  sub,
}: {
  titulo: string
  valor: string
  icone: React.ReactNode
  cor: string
  sub?: string
}) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-3.5">
      <div className="flex items-center gap-2 mb-1.5">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${cor}`}>
          {icone}
        </div>
        <span className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">
          {titulo}
        </span>
      </div>
      <p className="text-base font-bold text-slate-800 dark:text-slate-100 tabular-nums leading-tight">
        {valor}
      </p>
      {sub && <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{sub}</p>}
    </div>
  )
}

/**
 * Seção "Análise Anual": cards de resumo (total, média, maior/menor mês,
 * variação % vs ano anterior), evolução mensal e comparativo entre os últimos
 * exercícios (barras agrupadas). Somente leitura.
 *
 * Despesas (fixas/variáveis): gráfico de BARRAS mensais com linha de TENDÊNCIA
 * (regressão linear) sobreposta.
 * Rentabilidade: mantém o gráfico de linha da margem e o de barras receita vs
 * resultado (intocado, atende outras telas).
 */
export function SecaoAnaliseAnual({ tipo, resultado }: SecaoAnaliseAnualProps) {
  const eRentabilidade = tipo === 'rentabilidade'

  const serieMensal = useMemo(() => montarSerieMensal360(resultado), [resultado])

  const serieMensalComparada = useMemo(() => {
    if (!eRentabilidade) return []
    return (resultado.itensRentabilidade || []).map((i) => ({
      mes: i.rotuloCurto,
      mesCompleto: i.rotuloCompleto,
      faturamento: i.faturamento,
      resultado: i.lucroApurado,
      margem: i.margemSobreFaturamento ?? 0,
    }))
  }, [eRentabilidade, resultado])

  // Linha de tendência (regressão linear) sobre a série mensal de despesas
  const serieComTendencia = useMemo(() => {
    if (eRentabilidade) return serieMensal
    const regressao = calcularRegressaoLinear(
      serieMensal.map((p, i) => ({ ano: i, valor: p.valor })),
    )
    return serieMensal.map((p, i) => ({
      ...p,
      tendencia: regressao.pontosRegressao[i]?.valorAjustado ?? p.valor,
    }))
  }, [eRentabilidade, serieMensal])

  const dadosAnos = useMemo(
    () => resultado.anosComparados.filter((a) => a.temDados),
    [resultado.anosComparados],
  )

  const temDadosAtuais = serieMensal.some((p) => p.valor !== 0)

  const { resumo } = resultado

  // Em despesas, aumento = vermelho; em rentabilidade, aumento = verde.
  const corVariacao =
    resumo.variacaoPct === null
      ? 'text-slate-400'
      : resumo.variacaoPct >= 0 === eRentabilidade
        ? 'text-emerald-600 dark:text-emerald-400'
        : 'text-red-600 dark:text-red-400'

  const tooltipStyle = {
    borderRadius: 12,
    border: '1px solid #e2e8f0',
    fontSize: 12,
  } as const

  if (!temDadosAtuais && dadosAnos.length === 0) {
    return (
      <Card className="border-slate-200 dark:border-slate-800 print:break-inside-avoid">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[#0B1F3A] dark:text-slate-100">
            <AreaIcon className="w-4 h-4 text-sky-700 dark:text-sky-400" />
            Análise Anual
          </CardTitle>
          <CardDescription>Evolução mensal e comparativo entre exercícios.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/40 py-12 px-6 text-center">
            <CalendarDays className="w-8 h-8 text-slate-300 dark:text-slate-600 mb-3" />
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
              Sem dados para o período
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              Não há lançamentos nos exercícios analisados.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-slate-200 dark:border-slate-800 print:break-inside-avoid">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-[#0B1F3A] dark:text-slate-100">
          <AreaIcon className="w-4 h-4 text-sky-700 dark:text-sky-400" />
          Análise Anual
        </CardTitle>
        <CardDescription>
          Evolução mensal do exercício {resultado.anoAtual} e comparativo entre exercícios.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Cards de resumo */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
          <CardResumo
            titulo={eRentabilidade ? 'Resultado do Ano' : 'Total do Ano'}
            valor={
              eRentabilidade
                ? formatBrl(resumo.total)
                : resumo.total !== 0
                  ? formatBrl(resumo.total)
                  : '—'
            }
            icone={<CalendarDays className="w-3.5 h-3.5" />}
            cor={
              eRentabilidade
                ? resumo.total >= 0
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                  : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
                : 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300'
            }
          />
          <CardResumo
            titulo="Média Mensal"
            valor={resumo.mediaMensal === null ? '—' : formatBrl(resumo.mediaMensal)}
            icone={<BarChart3 className="w-3.5 h-3.5" />}
            cor="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
          />
          <CardResumo
            titulo="Maior Mês"
            valor={resumo.maiorMes ? formatBrl(resumo.maiorMes.valor) : '—'}
            sub={resumo.maiorMes?.rotulo}
            icone={<TrendingUp className="w-3.5 h-3.5" />}
            cor="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
          />
          <CardResumo
            titulo="Menor Mês"
            valor={resumo.menorMes ? formatBrl(resumo.menorMes.valor) : '—'}
            sub={resumo.menorMes?.rotulo}
            icone={<TrendingDown className="w-3.5 h-3.5" />}
            cor="bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
          />
          <CardResumo
            titulo="Variação vs Ano Anterior"
            valor={
              resumo.variacaoPct === null
                ? '—'
                : `${resumo.variacaoPct >= 0 ? '+' : ''}${resumo.variacaoPct.toFixed(1)}%`
            }
            sub={
              resultado.anoAnterior?.temDados
                ? `vs exercício ${resultado.anoAnterior?.ano}`
                : 'sem base de comparação'
            }
            icone={
              resumo.variacaoPct !== null && resumo.variacaoPct >= 0 ? (
                <TrendingUp className="w-3.5 h-3.5" />
              ) : (
                <TrendingDown className="w-3.5 h-3.5" />
              )
            }
            cor="bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
          />
        </div>

        {/* Evolução mensal */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
            {eRentabilidade
              ? 'Evolução mensal da margem (%)'
              : 'Evolução mensal (R$) com linha de tendência'}
          </h4>
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              {eRentabilidade ? (
                <LineChart
                  data={serieMensalComparada}
                  margin={{ top: 8, right: 16, bottom: 0, left: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    tickLine={false}
                    tickFormatter={(v: number) => `${Math.round(v)}%`}
                  />
                  <RechartsTooltip
                    formatter={(value: number | string, name: string) => [
                      `${Number(value).toFixed(2)}%`,
                      name,
                    ]}
                    labelFormatter={(label: string, payload) =>
                      payload?.[0]?.payload?.mesCompleto || label
                    }
                    contentStyle={tooltipStyle}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line
                    type="monotone"
                    dataKey="margem"
                    name="Margem s/ Faturamento"
                    stroke="#144272"
                    strokeWidth={2}
                    dot={{ r: 3, fill: '#144272' }}
                  />
                </LineChart>
              ) : (
                <ComposedChart
                  data={serieComTendencia}
                  margin={{ top: 8, right: 16, bottom: 0, left: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    tickLine={false}
                    tickFormatter={(v: number) => formatBrlCompacto(v)}
                  />
                  <RechartsTooltip
                    formatter={(value: number | string, name: string) => [
                      formatBrl(Number(value)),
                      name === 'tendencia' ? 'Tendência' : name,
                    ]}
                    labelFormatter={(label: string, payload) =>
                      payload?.[0]?.payload?.mesCompleto || label
                    }
                    contentStyle={tooltipStyle}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 12 }}
                    formatter={(value: string) => (value === 'tendencia' ? 'Tendência' : value)}
                  />
                  <Bar
                    dataKey="valor"
                    name="Total do Mês"
                    fill="#144272"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={48}
                  />
                  <Line
                    type="linear"
                    dataKey="tendencia"
                    name="Tendência"
                    stroke="#F59E0B"
                    strokeWidth={2.5}
                    strokeDasharray="6 3"
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </ComposedChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        {/* Barras receita vs resultado (apenas rentabilidade) */}
        {eRentabilidade && serieMensalComparada.length > 0 && (
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Receita vs Resultado por mês
            </h4>
            <div className="h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={serieMensalComparada}
                  margin={{ top: 8, right: 16, bottom: 0, left: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    tickLine={false}
                    tickFormatter={(v: number) => formatBrlCompacto(v)}
                  />
                  <RechartsTooltip
                    formatter={(value: number | string, name: string) => [
                      formatBrl(Number(value)),
                      name,
                    ]}
                    labelFormatter={(label: string, payload) =>
                      payload?.[0]?.payload?.mesCompleto || label
                    }
                    contentStyle={tooltipStyle}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar
                    dataKey="faturamento"
                    name="Faturamento"
                    fill="#144272"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar dataKey="resultado" name="Resultado" fill="#0e9f6e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Comparativo entre anos */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
            Comparativo entre exercícios
          </h4>
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dadosAnos} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="ano"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickLine={false}
                  tickFormatter={(v: number) => String(v)}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickLine={false}
                  tickFormatter={(v: number) => formatBrlCompacto(v)}
                />
                <RechartsTooltip
                  formatter={(value: number | string) => [
                    formatBrl(Number(value)),
                    eRentabilidade ? 'Resultado' : 'Total',
                  ]}
                  contentStyle={tooltipStyle}
                />
                <Bar
                  dataKey="total"
                  name={eRentabilidade ? 'Resultado do Ano' : 'Total do Ano'}
                  fill="#144272"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={72}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {dadosAnos.length === 0 && (
            <p className="text-xs text-slate-400 dark:text-slate-500 text-center mt-2">
              Sem dados nos exercícios {resultado.anoAtual - 2} a {resultado.anoAtual}.
            </p>
          )}
        </div>

        {/* Nota de variação com cor adequada ao contexto */}
        {resumo.variacaoPct !== null && (
          <p className={`text-xs font-semibold ${corVariacao}`}>
            {resumo.variacaoPct >= 0 ? '▲' : '▼'} {Math.abs(resumo.variacaoPct).toFixed(1)}% em
            relação ao exercício {resultado.anoAnterior?.ano} (
            {eRentabilidade ? 'variação do resultado' : 'variação das despesas'}).
          </p>
        )}
      </CardContent>
    </Card>
  )
}
