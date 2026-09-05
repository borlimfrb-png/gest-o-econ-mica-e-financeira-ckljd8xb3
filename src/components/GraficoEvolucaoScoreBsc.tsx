import React, { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ReferenceLine,
} from 'recharts'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Target,
  ArrowRight,
  TrendingUp,
  Award,
  Calendar,
  Layers,
  Sparkles,
  Info,
  CheckCircle2,
  Clock,
  AlertCircle,
} from 'lucide-react'
import type { EvolucaoScoreBscResult, PontoMesScoreBsc } from '@/lib/bscMonthlyCalculations'

export interface GraficoEvolucaoScoreBscProps {
  dadosEvolucao: EvolucaoScoreBscResult
  empresaNome?: string
  isGrupo?: boolean
  ano: number
  className?: string
  loading?: boolean
}

type VisaoGrafico = 'global' | 'perspectivas' | 'empresas'

const CORES_PERSPECTIVAS = {
  financeira: '#2563EB', // Blue
  clientes: '#10B981', // Emerald
  processos_internos: '#F59E0B', // Amber
  aprendizado_crescimento: '#8B5CF6', // Purple
}

const PALETA_EMPRESAS = [
  '#2563EB',
  '#10B981',
  '#8B5CF6',
  '#F59E0B',
  '#EC4899',
  '#06B6D4',
  '#F97316',
  '#6366F1',
]

export const GraficoEvolucaoScoreBsc: React.FC<GraficoEvolucaoScoreBscProps> = ({
  dadosEvolucao,
  empresaNome,
  isGrupo = false,
  ano,
  className = '',
  loading = false,
}) => {
  const [visao, setVisao] = useState<VisaoGrafico>('global')

  const {
    temKpisNoAno,
    totalKpis,
    scoreMedioAno,
    scoreUltimoMesComDados,
    melhorMes,
    mesesComDadosCount,
    serieMensal,
    empresasDoGrupo,
  } = dadosEvolucao

  // Preparar dados para o Recharts
  const chartData = useMemo(() => {
    return serieMensal.map((ponto) => {
      const item: Record<string, any> = {
        mesNum: ponto.mesNum,
        mesNome: ponto.mesNome,
        mesAbrev: ponto.mesAbrev,
        temDados: ponto.temDados,
        scoreGlobal: ponto.scoreGlobal,
        scoreFinanceira: ponto.scoreFinanceira,
        scoreClientes: ponto.scoreClientes,
        scoreProcessos: ponto.scoreProcessos,
        scoreAprendizado: ponto.scoreAprendizado,
        totalKpisAvaliados: ponto.totalKpisAvaliados,
        atingidos: ponto.atingidos,
        proximos: ponto.proximos,
        abaixo: ponto.abaixo,
      }

      // Adicionar empresas se for grupo
      if (ponto.scorePorEmpresa) {
        Object.entries(ponto.scorePorEmpresa).forEach(([empId, score]) => {
          item[`empresa_${empId}`] = score
        })
      }

      return item
    })
  }, [serieMensal])

  // Custom Tooltip corporativo em Português
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null

    const ponto: PontoMesScoreBsc | undefined = serieMensal.find(
      (p) => p.mesAbrev === label || p.mesNome === label,
    )

    if (!ponto || !ponto.temDados) {
      return (
        <div className="bg-[#0B1F3A] text-white p-3 rounded-xl shadow-xl border border-slate-700 text-xs">
          <p className="font-bold text-slate-200">
            {ponto?.mesNome || label} / {ano}
          </p>
          <p className="text-slate-400 mt-1 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-slate-400" />
            Nenhum balancete ou DRE registrado nesta competência.
          </p>
        </div>
      )
    }

    return (
      <div className="bg-[#0B1F3A] text-white p-3.5 rounded-xl shadow-xl border border-slate-700/80 text-xs space-y-2 min-w-[220px]">
        <div className="flex items-center justify-between border-b border-slate-700 pb-1.5">
          <span className="font-bold text-slate-200 text-sm">
            {ponto.mesNome} / {ano}
          </span>
          {ponto.scoreGlobal !== null && (
            <Badge
              className={`text-[10px] font-bold ${
                ponto.scoreGlobal >= 90
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  : ponto.scoreGlobal >= 70
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                    : 'bg-red-500/20 text-red-300 border-red-500/30'
              }`}
            >
              Score: {ponto.scoreGlobal}%
            </Badge>
          )}
        </div>

        {/* Linhas ativas no tooltip */}
        <div className="space-y-1">
          {payload.map((entry: any, index: number) => {
            if (entry.value === null || entry.value === undefined) return null
            return (
              <div
                key={`tt-${index}`}
                className="flex items-center justify-between gap-3 text-[11px]"
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="text-slate-300">{entry.name}:</span>
                </div>
                <span className="font-bold font-mono text-white">{entry.value}%</span>
              </div>
            )
          })}
        </div>

        {/* Resumo de atingimento */}
        {ponto.totalKpisAvaliados > 0 && (
          <div className="pt-2 border-t border-slate-700/80 grid grid-cols-3 gap-1 text-center text-[10px]">
            <div className="bg-emerald-950/60 text-emerald-300 rounded p-1 border border-emerald-800/40">
              <span className="block font-bold">{ponto.atingidos}</span>
              <span className="text-[9px] text-emerald-400">≥95%</span>
            </div>
            <div className="bg-amber-950/60 text-amber-300 rounded p-1 border border-amber-800/40">
              <span className="block font-bold">{ponto.proximos}</span>
              <span className="text-[9px] text-amber-400">75-94%</span>
            </div>
            <div className="bg-red-950/60 text-red-300 rounded p-1 border border-red-800/40">
              <span className="block font-bold">{ponto.abaixo}</span>
              <span className="text-[9px] text-red-400">&lt;75%</span>
            </div>
          </div>
        )}
      </div>
    )
  }

  // Estado Vazio: Empresa sem KPIs cadastrados no ano
  if (!temKpisNoAno && !loading) {
    return (
      <Card className={`bg-white border-slate-200 shadow-2xs ${className}`}>
        <CardHeader className="pb-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <CardTitle className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
              <Target className="w-4 h-4 text-blue-600" />
              Evolução do Score BSC — {ano}
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">
              Scorecard estratégico mensal ponderado pelas 4 perspectivas do Balanced Scorecard
            </CardDescription>
          </div>
          <Badge
            variant="outline"
            className="text-[11px] font-semibold text-slate-500 bg-slate-50 border-slate-200 self-start sm:self-auto"
          >
            {empresaNome || 'Empresa Ativa'}
          </Badge>
        </CardHeader>
        <CardContent className="pt-6 pb-8">
          <div className="py-8 px-4 flex flex-col items-center justify-center text-center bg-slate-50/70 rounded-2xl border border-dashed border-slate-200 max-w-xl mx-auto">
            <div className="w-12 h-12 rounded-2xl bg-blue-100/70 text-blue-700 flex items-center justify-center mb-3 shadow-inner">
              <Target className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-[#0B1F3A]">
              Nenhum Indicador BSC Cadastrado para {ano}
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md leading-relaxed mb-4">
              O Balanced Scorecard de <strong>{empresaNome || 'sua empresa'}</strong> ainda não
              possui indicadores estratégicos parametrizados para o exercício de {ano}. Configure os
              KPIs automáticos e manuais para acompanhar a evolução mensal do desempenho.
            </p>
            <Button
              asChild
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs gap-1.5"
            >
              <Link to="/planejamento/bsc">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Configurar Balanced Scorecard ({ano})</span>
                <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={`bg-white border-slate-200 shadow-2xs ${className}`}>
      <CardHeader className="pb-3 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <CardTitle className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
              <Target className="w-4 h-4 text-blue-600 shrink-0" />
              <span>Evolução do Score BSC — {ano}</span>
            </CardTitle>
            <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] font-bold">
              {totalKpis} KPI{totalKpis !== 1 ? 's' : ''} parametrizado{totalKpis !== 1 ? 's' : ''}
            </Badge>
            {isGrupo && (
              <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[10px] font-bold">
                Consolidado do Grupo
              </Badge>
            )}
          </div>
          <CardDescription className="text-xs mt-0.5">
            Acompanhamento mensal do atingimento das metas nas perspectivas Financeira, Clientes,
            Processos e Pessoas
          </CardDescription>
        </div>

        {/* Ações e Alternância de Visão */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Botões de Alternância de Visão */}
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50/80 p-0.5 text-xs font-medium">
            <button
              type="button"
              onClick={() => setVisao('global')}
              className={`px-2.5 py-1 rounded-md text-[11px] transition-all font-semibold ${
                visao === 'global'
                  ? 'bg-white text-blue-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Score Global
            </button>
            <button
              type="button"
              onClick={() => setVisao('perspectivas')}
              className={`px-2.5 py-1 rounded-md text-[11px] transition-all font-semibold ${
                visao === 'perspectivas'
                  ? 'bg-white text-blue-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              4 Perspectivas
            </button>
            {isGrupo && empresasDoGrupo && empresasDoGrupo.length > 0 && (
              <button
                type="button"
                onClick={() => setVisao('empresas')}
                className={`px-2.5 py-1 rounded-md text-[11px] transition-all font-semibold ${
                  visao === 'empresas'
                    ? 'bg-white text-indigo-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Por Empresa
              </button>
            )}
          </div>

          <Button
            asChild
            size="sm"
            variant="outline"
            className="text-xs border-blue-200 hover:bg-blue-50 text-blue-700 font-medium h-8 gap-1 shrink-0"
          >
            <Link to="/planejamento/bsc">
              Ver BSC Completo <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-4">
        {/* Métricas de Cabeçalho do Score BSC */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {/* 1. Score Médio no Ano */}
          <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/80">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              Média do Exercício
            </span>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-black text-[#0B1F3A]">
                {scoreMedioAno !== null ? `${scoreMedioAno}%` : '—'}
              </span>
              {scoreMedioAno !== null && (
                <Badge
                  className={`text-[9px] font-bold ${
                    scoreMedioAno >= 90
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                      : scoreMedioAno >= 70
                        ? 'bg-amber-100 text-amber-800 border-amber-200'
                        : 'bg-red-100 text-red-800 border-red-200'
                  }`}
                >
                  {scoreMedioAno >= 90 ? 'Excelente' : scoreMedioAno >= 70 ? 'Regular' : 'Crítico'}
                </Badge>
              )}
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {mesesComDadosCount} mês(es) com apuração
            </p>
          </div>

          {/* 2. Última Competência */}
          <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/80">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              Última Competência
            </span>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-black text-blue-900">
                {scoreUltimoMesComDados !== null ? `${scoreUltimoMesComDados}%` : '—'}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">Posição contábil mais recente</p>
          </div>

          {/* 3. Melhor Mês */}
          <div className="p-3 rounded-xl bg-emerald-50/50 border border-emerald-200/70">
            <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block flex items-center gap-1">
              <Award className="w-3 h-3 text-emerald-600" />
              Melhor Desempenho
            </span>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-black text-emerald-950">
                {melhorMes ? `${melhorMes.score}%` : '—'}
              </span>
              {melhorMes && (
                <span className="text-xs font-bold text-emerald-700">
                  ({melhorMes.mesNome.slice(0, 3)})
                </span>
              )}
            </div>
            <p className="text-[10px] text-emerald-700/80 mt-0.5">Pico de atingimento de metas</p>
          </div>

          {/* 4. Meta Estratégica Corporativa */}
          <div className="p-3 rounded-xl bg-blue-50/50 border border-blue-200/70">
            <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider block flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-blue-600" />
              Meta Corporativa
            </span>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-black text-blue-950">100%</span>
              <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-[9px] font-bold">
                Alvo
              </Badge>
            </div>
            <p className="text-[10px] text-blue-700/80 mt-0.5">Referencial estratégico anual</p>
          </div>
        </div>

        {/* Gráfico Recharts de Evolução */}
        <div className="h-72 sm:h-80 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 15, right: 15, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis
                dataKey="mesAbrev"
                tick={{ fontSize: 11, fill: '#64748B' }}
                axisLine={{ stroke: '#E2E8F0' }}
                tickLine={false}
              />
              <YAxis
                domain={[0, 150]}
                ticks={[0, 25, 50, 75, 100, 125, 150]}
                tick={{ fontSize: 11, fill: '#64748B' }}
                axisLine={{ stroke: '#E2E8F0' }}
                tickLine={false}
                tickFormatter={(v) => `${v}%`}
              />
              <RechartsTooltip content={<CustomTooltip />} />
              <Legend
                verticalAlign="bottom"
                height={32}
                iconType="circle"
                wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
              />

              {/* Linha de Referência da Meta 100% */}
              <ReferenceLine
                y={100}
                stroke="#10B981"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                label={{
                  value: 'Meta (100%)',
                  position: 'right',
                  fill: '#059669',
                  fontSize: 10,
                  fontWeight: 600,
                }}
              />

              {/* Linha de Referência de Alerta (70%) */}
              <ReferenceLine
                y={70}
                stroke="#F59E0B"
                strokeDasharray="3 3"
                strokeWidth={1}
                label={{
                  value: 'Atenção (70%)',
                  position: 'right',
                  fill: '#D97706',
                  fontSize: 10,
                }}
              />

              {/* MODO 1: Score Global Único */}
              {visao === 'global' && (
                <Line
                  type="monotone"
                  dataKey="scoreGlobal"
                  name="Score Global BSC"
                  stroke="#2563EB"
                  strokeWidth={3}
                  dot={{ r: 4, fill: '#2563EB', strokeWidth: 2, stroke: '#FFFFFF' }}
                  activeDot={{ r: 6, fill: '#1D4ED8', stroke: '#FFFFFF', strokeWidth: 2 }}
                  connectNulls={true}
                  isAnimationActive={true}
                />
              )}

              {/* MODO 2: As 4 Perspectivas Separadas */}
              {visao === 'perspectivas' && (
                <>
                  <Line
                    type="monotone"
                    dataKey="scoreFinanceira"
                    name="Financeira"
                    stroke={CORES_PERSPECTIVAS.financeira}
                    strokeWidth={2.2}
                    dot={{ r: 3.5, fill: CORES_PERSPECTIVAS.financeira }}
                    connectNulls={true}
                  />
                  <Line
                    type="monotone"
                    dataKey="scoreClientes"
                    name="Clientes & Mercado"
                    stroke={CORES_PERSPECTIVAS.clientes}
                    strokeWidth={2.2}
                    dot={{ r: 3.5, fill: CORES_PERSPECTIVAS.clientes }}
                    connectNulls={true}
                  />
                  <Line
                    type="monotone"
                    dataKey="scoreProcessos"
                    name="Processos Internos"
                    stroke={CORES_PERSPECTIVAS.processos_internos}
                    strokeWidth={2.2}
                    dot={{ r: 3.5, fill: CORES_PERSPECTIVAS.processos_internos }}
                    connectNulls={true}
                  />
                  <Line
                    type="monotone"
                    dataKey="scoreAprendizado"
                    name="Aprendizado & Crescimento"
                    stroke={CORES_PERSPECTIVAS.aprendizado_crescimento}
                    strokeWidth={2.2}
                    dot={{ r: 3.5, fill: CORES_PERSPECTIVAS.aprendizado_crescimento }}
                    connectNulls={true}
                  />
                </>
              )}

              {/* MODO 3: Comparativo por Empresa do Grupo */}
              {visao === 'empresas' &&
                empresasDoGrupo &&
                empresasDoGrupo.map((emp, index) => (
                  <Line
                    key={emp.id}
                    type="monotone"
                    dataKey={`empresa_${emp.id}`}
                    name={emp.nome}
                    stroke={PALETA_EMPRESAS[index % PALETA_EMPRESAS.length]}
                    strokeWidth={2}
                    dot={{ r: 3.5, fill: PALETA_EMPRESAS[index % PALETA_EMPRESAS.length] }}
                    connectNulls={true}
                  />
                ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Rodapé Informativo */}
        <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span>
              Meses sem balancete apurado são omitidos suavemente da curva (sem quebra do gráfico).
            </span>
          </div>

          <div className="flex items-center gap-3 text-[11px] font-medium">
            <span className="flex items-center gap-1 text-emerald-700">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              ≥90% Alta Performance
            </span>
            <span className="flex items-center gap-1 text-amber-700">
              <Clock className="w-3 h-3 text-amber-600" />
              70–89% Em Atenção
            </span>
            <span className="flex items-center gap-1 text-red-700">
              <AlertCircle className="w-3 h-3 text-red-600" />
              &lt;70% Plano de Ação
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default GraficoEvolucaoScoreBsc
