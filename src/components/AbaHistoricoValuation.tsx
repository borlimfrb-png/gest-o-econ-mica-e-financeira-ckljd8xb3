import React, { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  Layers,
  Save,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  HelpCircle,
  LineChart as LineChartIcon,
  Scale,
  Building2,
  Coins,
  Sparkles,
} from 'lucide-react'
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ReferenceLine,
} from 'recharts'
import { formatCurrency, formatPercent } from '@/lib/financeCalculations'
import type { HistoricoValuationPontoAno } from '@/types/finance'

export interface AbaHistoricoValuationProps {
  historicoSerie: HistoricoValuationPontoAno[]
  cagr: number | null
  empresaNome?: string
  anoAtual: number
  onSalvarSnapshotAnoAtual?: () => Promise<void>
  salvandoSnapshot?: boolean
  onSelecionarAno?: (ano: number) => void
  loading?: boolean
}

export function AbaHistoricoValuation({
  historicoSerie,
  cagr,
  empresaNome,
  anoAtual,
  onSalvarSnapshotAnoAtual,
  salvandoSnapshot = false,
  onSelecionarAno,
  loading = false,
}: AbaHistoricoValuationProps) {
  const [visaoMetodos, setVisaoMetodos] = useState<{
    fcd: boolean
    superlucro: boolean
    multiplos: boolean
    consenso: boolean
    faixaMinMax: boolean
  }>({
    fcd: true,
    superlucro: true,
    multiplos: true,
    consenso: true,
    faixaMinMax: true,
  })

  // Dados para cards resumo
  const totalExercicios = historicoSerie.length
  const pontoMaisRecente = totalExercicios > 0 ? historicoSerie[totalExercicios - 1] : null
  const pontoPrimeiro = totalExercicios > 0 ? historicoSerie[0] : null

  const valorAtual = pontoMaisRecente?.consenso ?? 0
  const variacaoVsAnterior = pontoMaisRecente?.variacaoPercentualVsAnterior ?? null

  // Preparar dados do gráfico
  const dadosGrafico = historicoSerie.map((p) => ({
    ano: String(p.ano),
    anoNum: p.ano,
    FCD: p.valorFcd && p.valorFcd > 0 ? Number(p.valorFcd.toFixed(2)) : null,
    Superlucro:
      p.valorSuperlucro && p.valorSuperlucro > 0 ? Number(p.valorSuperlucro.toFixed(2)) : null,
    Multiplos:
      p.valorMultiplos && p.valorMultiplos > 0 ? Number(p.valorMultiplos.toFixed(2)) : null,
    Consenso: p.consenso > 0 ? Number(p.consenso.toFixed(2)) : null,
    faixaMin: p.minimo > 0 ? Number(p.minimo.toFixed(2)) : null,
    faixaMax: p.maximo > 0 ? Number(p.maximo.toFixed(2)) : null,
    metodosContados: p.metodosContados,
    origem: p.origem,
  }))

  const toggleSerie = (key: keyof typeof visaoMetodos) => {
    setVisaoMetodos((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  // Estado Vazio: se não houver dados históricos
  if (totalExercicios === 0 && !loading) {
    return (
      <Card className="bg-white border-slate-200 shadow-2xs overflow-hidden">
        <CardContent className="p-10 text-center flex flex-col items-center justify-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 shadow-2xs">
            <LineChartIcon className="w-8 h-8" />
          </div>
          <div className="max-w-md space-y-2">
            <h3 className="text-base font-bold text-[#0B1F3A]">
              Histórico de Valuations Ainda Não Consolidado
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Não encontramos valuations ou demonstrações contábeis computadas para a empresa{' '}
              <strong className="text-slate-900">{empresaNome || 'selecionada'}</strong>.
            </p>
            <p className="text-xs text-slate-500 leading-relaxed">
              Navegue pelas abas de <strong>Múltiplos de Mercado</strong> e{' '}
              <strong>FCD &amp; Goodwill</strong> para calcular os métodos. Em seguida, clique em{' '}
              <em>"Salvar Snapshot do Ano"</em> para registrar e consolidar a evolução do valor de
              mercado da empresa exercício a exercício.
            </p>
          </div>

          {onSalvarSnapshotAnoAtual && (
            <div className="pt-2">
              <Button
                onClick={onSalvarSnapshotAnoAtual}
                disabled={salvandoSnapshot}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs h-9 shadow-xs gap-2"
              >
                {salvandoSnapshot ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Gravando Snapshot...
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    Gravar Snapshot do Exercício {anoAtual}
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* 1. Header do Histórico com Ações */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-blue-900 via-[#0B1F3A] to-slate-900 text-white p-5 rounded-2xl shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base sm:text-lg font-black tracking-tight flex items-center gap-2 text-white">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
              Evolução Histórica do Valor da Empresa
            </h2>
            <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-400/30 text-xs font-semibold">
              {totalExercicios} {totalExercicios === 1 ? 'exercício' : 'exercícios avaliados'}
            </Badge>
          </div>
          <p className="text-xs text-blue-200/80">
            Série temporal plurianual comparando Fluxo Descontado (FCD), Superlucro (Goodwill) e
            Múltiplos de Mercado com consenso central e faixa de dispersão.
          </p>
        </div>

        {onSalvarSnapshotAnoAtual && (
          <Button
            onClick={onSalvarSnapshotAnoAtual}
            disabled={salvandoSnapshot}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-9 shadow-md gap-2 shrink-0 self-start sm:self-center"
          >
            {salvandoSnapshot ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Gravando...
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                Salvar Snapshot de {anoAtual}
              </>
            )}
          </Button>
        )}
      </div>

      {/* 2. Cards-Resumo Principais (4 KPIs) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Valor Atual (Último Exercício) */}
        <Card className="bg-white border-slate-200 shadow-2xs hover:shadow-md transition-all">
          <CardHeader className="p-4 pb-2 border-b border-slate-100 flex flex-row items-center justify-between space-y-0">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Valor Atual (Consenso)
            </span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Coins className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 space-y-1">
            <div className="text-2xl font-black text-[#0B1F3A]">
              {valorAtual > 0 ? formatCurrency(valorAtual) : '—'}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <Calendar className="w-3.5 h-3.5 text-blue-600" />
              <span>Exercício {pontoMaisRecente?.ano ?? anoAtual}</span>
              {pontoMaisRecente && (
                <span className="text-[10px] font-semibold text-slate-400">
                  ({pontoMaisRecente.metodosContados}{' '}
                  {pontoMaisRecente.metodosContados === 1 ? 'método' : 'métodos'})
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* KPI 2: Variação vs. Ano Anterior */}
        <Card className="bg-white border-slate-200 shadow-2xs hover:shadow-md transition-all">
          <CardHeader className="p-4 pb-2 border-b border-slate-100 flex flex-row items-center justify-between space-y-0">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Variação vs. Ano Anterior
            </span>
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                variacaoVsAnterior !== null && variacaoVsAnterior >= 0
                  ? 'bg-emerald-50 text-emerald-600'
                  : variacaoVsAnterior !== null
                    ? 'bg-red-50 text-red-600'
                    : 'bg-slate-50 text-slate-500'
              }`}
            >
              {variacaoVsAnterior !== null && variacaoVsAnterior >= 0 ? (
                <TrendingUp className="w-4 h-4" />
              ) : variacaoVsAnterior !== null ? (
                <TrendingDown className="w-4 h-4" />
              ) : (
                <Scale className="w-4 h-4" />
              )}
            </div>
          </CardHeader>
          <CardContent className="p-4 space-y-1">
            <div
              className={`text-2xl font-black ${
                variacaoVsAnterior !== null && variacaoVsAnterior > 0
                  ? 'text-emerald-600'
                  : variacaoVsAnterior !== null && variacaoVsAnterior < 0
                    ? 'text-red-600'
                    : 'text-slate-800'
              }`}
            >
              {variacaoVsAnterior !== null
                ? `${variacaoVsAnterior > 0 ? '+' : ''}${formatPercent(variacaoVsAnterior, 1)}`
                : '1º Ano (Base)'}
            </div>
            <p className="text-xs text-slate-500">
              {totalExercicios >= 2 && pontoMaisRecente && historicoSerie[totalExercicios - 2]
                ? `Em relação a ${historicoSerie[totalExercicios - 2].ano} (${formatCurrency(historicoSerie[totalExercicios - 2].consenso)})`
                : 'Necessita de ao menos 2 exercícios'}
            </p>
          </CardContent>
        </Card>

        {/* KPI 3: Crescimento Médio Anual (CAGR) */}
        <Card className="bg-white border-slate-200 shadow-2xs hover:shadow-md transition-all">
          <CardHeader className="p-4 pb-2 border-b border-slate-100 flex flex-row items-center justify-between space-y-0">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              CAGR do Período
            </span>
            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 space-y-1">
            <div
              className={`text-2xl font-black ${
                cagr !== null && cagr >= 0
                  ? 'text-indigo-600'
                  : cagr !== null
                    ? 'text-amber-600'
                    : 'text-slate-400'
              }`}
            >
              {cagr !== null ? `${cagr > 0 ? '+' : ''}${formatPercent(cagr, 1)} a.a.` : 'N/D'}
            </div>
            <p className="text-xs text-slate-500">
              {pontoPrimeiro && pontoMaisRecente && totalExercicios >= 2
                ? `De ${pontoPrimeiro.ano} a ${pontoMaisRecente.ano} (${pontoMaisRecente.ano - pontoPrimeiro.ano} ${pontoMaisRecente.ano - pontoPrimeiro.ano === 1 ? 'ano' : 'anos'})`
                : 'Cálculo ativado com ≥ 2 exercícios'}
            </p>
          </CardContent>
        </Card>

        {/* KPI 4: Quantidade de Exercícios e Metodologias */}
        <Card className="bg-white border-slate-200 shadow-2xs hover:shadow-md transition-all">
          <CardHeader className="p-4 pb-2 border-b border-slate-100 flex flex-row items-center justify-between space-y-0">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Exercícios Monitorados
            </span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 space-y-1">
            <div className="text-2xl font-black text-[#0B1F3A]">
              {totalExercicios}{' '}
              <span className="text-sm font-semibold text-slate-500">
                {totalExercicios === 1 ? 'ano' : 'anos'}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>FCD, Superlucro &amp; Múltiplos</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 3. Gráfico Interativo de Evolução */}
      <Card className="bg-white border-slate-200 shadow-2xs">
        <CardHeader className="p-5 pb-3 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
              <LineChartIcon className="w-4 h-4 text-blue-600" />
              Trajetória Temporal do Valor da Empresa (Enterprise Value)
            </CardTitle>
            <CardDescription className="text-xs text-slate-500 mt-0.5">
              Valores expressos em Reais (R$) apurados em cada exercício contábil.
            </CardDescription>
          </div>

          {/* Filtros interativos para alternar séries visíveis no gráfico */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold text-slate-500 mr-1">Exibir:</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => toggleSerie('consenso')}
              className={`h-7 text-[11px] px-2 font-bold rounded-lg border transition-all ${
                visaoMetodos.consenso
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                  : 'bg-white text-slate-600 border-slate-200 opacity-60'
              }`}
            >
              Consenso Central
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => toggleSerie('fcd')}
              className={`h-7 text-[11px] px-2 font-bold rounded-lg border transition-all ${
                visaoMetodos.fcd
                  ? 'bg-blue-100 text-blue-800 border-blue-300'
                  : 'bg-white text-slate-600 border-slate-200 opacity-60'
              }`}
            >
              FCD
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => toggleSerie('superlucro')}
              className={`h-7 text-[11px] px-2 font-bold rounded-lg border transition-all ${
                visaoMetodos.superlucro
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                  : 'bg-white text-slate-600 border-slate-200 opacity-60'
              }`}
            >
              Superlucro
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => toggleSerie('multiplos')}
              className={`h-7 text-[11px] px-2 font-bold rounded-lg border transition-all ${
                visaoMetodos.multiplos
                  ? 'bg-purple-100 text-purple-800 border-purple-300'
                  : 'bg-white text-slate-600 border-slate-200 opacity-60'
              }`}
            >
              Múltiplos
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-5 pt-4">
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={dadosGrafico}
                margin={{ top: 20, right: 30, left: 20, bottom: 10 }}
              >
                <defs>
                  <linearGradient id="gradConsenso" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563EB" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis
                  dataKey="ano"
                  tick={{ fontSize: 12, fill: '#0B1F3A', fontWeight: 700 }}
                  tickLine={false}
                  axisLine={{ stroke: '#CBD5E1' }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#64748B' }}
                  tickLine={false}
                  axisLine={{ stroke: '#CBD5E1' }}
                  tickFormatter={(v) =>
                    Math.abs(v) >= 1000000
                      ? `R$ ${(v / 1000000).toFixed(1)}M`
                      : Math.abs(v) >= 1000
                        ? `R$ ${(v / 1000).toFixed(0)}k`
                        : `R$ ${v}`
                  }
                />
                <RechartsTooltip
                  formatter={(val: any, name: any) => {
                    if (val === null || val === undefined) return ['N/D', name]
                    const rotulos: Record<string, string> = {
                      Consenso: 'Consenso Central',
                      FCD: 'Fluxo de Caixa Descontado (FCD)',
                      Superlucro: 'Superlucro (Goodwill)',
                      Multiplos: 'Múltiplos de Mercado',
                    }
                    return [formatCurrency(Number(val)), rotulos[name] || name]
                  }}
                  labelFormatter={(label) => `Exercício: ${label}`}
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #E2E8F0',
                    borderRadius: '12px',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    fontSize: '12px',
                    padding: '10px 14px',
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: '11px', paddingTop: '14px' }}
                  formatter={(value) => {
                    const rotulos: Record<string, string> = {
                      Consenso: 'Consenso Central (Média dos Métodos)',
                      FCD: 'FCD (Gordon)',
                      Superlucro: 'Goodwill (Superlucro)',
                      Multiplos: 'Múltiplos de Mercado',
                    }
                    return (
                      <span className="font-semibold text-slate-700">
                        {rotulos[value] || value}
                      </span>
                    )
                  }}
                />

                {/* Área sob o Consenso */}
                {visaoMetodos.consenso && (
                  <Area
                    type="monotone"
                    dataKey="Consenso"
                    stroke="#2563EB"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#gradConsenso)"
                    dot={{ r: 5, fill: '#2563EB', strokeWidth: 2, stroke: '#FFFFFF' }}
                    activeDot={{ r: 7, strokeWidth: 3, stroke: '#1D4ED8' }}
                  />
                )}

                {/* Linha FCD */}
                {visaoMetodos.fcd && (
                  <Line
                    type="monotone"
                    dataKey="FCD"
                    stroke="#0284C7"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={{ r: 4, fill: '#0284C7', strokeWidth: 1.5, stroke: '#FFFFFF' }}
                    connectNulls
                  />
                )}

                {/* Linha Superlucro */}
                {visaoMetodos.superlucro && (
                  <Line
                    type="monotone"
                    dataKey="Superlucro"
                    stroke="#059669"
                    strokeWidth={2}
                    strokeDasharray="3 3"
                    dot={{ r: 4, fill: '#059669', strokeWidth: 1.5, stroke: '#FFFFFF' }}
                    connectNulls
                  />
                )}

                {/* Linha Múltiplos */}
                {visaoMetodos.multiplos && (
                  <Line
                    type="monotone"
                    dataKey="Multiplos"
                    stroke="#8B5CF6"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={{ r: 4, fill: '#8B5CF6', strokeWidth: 1.5, stroke: '#FFFFFF' }}
                    connectNulls
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-[11px] text-slate-600 flex-wrap gap-2">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" />
              <strong>Linha azul contínua:</strong> Consenso ponderado dos métodos aplicáveis no
              ano.
            </span>
            <span className="text-slate-400">
              Clique nos pontos da tabela abaixo para carregar os parâmetros daquele ano.
            </span>
          </div>
        </CardContent>
      </Card>

      {/* 4. Tabela Estruturada do Histórico */}
      <Card className="bg-white border-slate-200 shadow-2xs">
        <CardHeader className="p-5 pb-3 border-b border-slate-100 flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600" />
              Série Temporal Detalhada por Ano
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Abertura por método de precificação, consenso central, dispersão mín–máx e variação
              anual percentual.
            </CardDescription>
          </div>
          <Badge className="bg-slate-100 text-slate-700 border-slate-200 font-semibold text-xs">
            {totalExercicios} {totalExercicios === 1 ? 'registro' : 'registros'}
          </Badge>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="text-xs">
              <TableHeader className="bg-slate-50/80">
                <TableRow>
                  <TableHead className="font-bold text-slate-700 w-24">Ano</TableHead>
                  <TableHead className="text-right font-bold text-slate-700">
                    FCD (Gordon)
                  </TableHead>
                  <TableHead className="text-right font-bold text-slate-700">
                    Superlucro (Goodwill)
                  </TableHead>
                  <TableHead className="text-right font-bold text-slate-700">
                    Múltiplos de Mercado
                  </TableHead>
                  <TableHead className="text-right font-bold text-blue-800 bg-blue-50/60">
                    Consenso Central
                  </TableHead>
                  <TableHead className="text-right font-bold text-slate-700">
                    Faixa (Mín – Máx)
                  </TableHead>
                  <TableHead className="text-right font-bold text-slate-700">
                    Variação Anual
                  </TableHead>
                  <TableHead className="text-center font-bold text-slate-700">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historicoSerie.map((item, idx) => {
                  const isAtual = item.ano === anoAtual
                  const varPct = item.variacaoPercentualVsAnterior

                  return (
                    <TableRow
                      key={item.ano}
                      className={`transition-colors ${
                        isAtual
                          ? 'bg-blue-50/40 hover:bg-blue-50/60 font-medium'
                          : 'hover:bg-slate-50/70'
                      }`}
                    >
                      {/* Ano */}
                      <TableCell className="font-bold text-[#0B1F3A]">
                        <div className="flex items-center gap-1.5">
                          <span>{item.ano}</span>
                          {isAtual && (
                            <Badge className="bg-blue-600 text-white text-[10px] px-1.5 py-0 font-bold">
                              Atual
                            </Badge>
                          )}
                        </div>
                      </TableCell>

                      {/* FCD */}
                      <TableCell className="text-right font-mono text-slate-700">
                        {item.valorFcd && item.valorFcd > 0 ? (
                          formatCurrency(item.valorFcd)
                        ) : (
                          <span className="text-slate-400 font-sans">N/D</span>
                        )}
                      </TableCell>

                      {/* Superlucro */}
                      <TableCell className="text-right font-mono text-slate-700">
                        {item.valorSuperlucro && item.valorSuperlucro > 0 ? (
                          formatCurrency(item.valorSuperlucro)
                        ) : (
                          <span className="text-slate-400 font-sans">N/D</span>
                        )}
                      </TableCell>

                      {/* Múltiplos */}
                      <TableCell className="text-right font-mono text-slate-700">
                        {item.valorMultiplos && item.valorMultiplos > 0 ? (
                          formatCurrency(item.valorMultiplos)
                        ) : (
                          <span className="text-slate-400 font-sans">N/D</span>
                        )}
                      </TableCell>

                      {/* Consenso Central */}
                      <TableCell className="text-right font-mono font-bold text-blue-700 bg-blue-50/30">
                        {item.consenso > 0 ? (
                          formatCurrency(item.consenso)
                        ) : (
                          <span className="text-slate-400 font-sans">N/D</span>
                        )}
                      </TableCell>

                      {/* Faixa Mín - Máx */}
                      <TableCell className="text-right font-mono text-slate-600 text-[11px]">
                        {item.minimo > 0 && item.maximo > 0 ? (
                          <span>
                            {formatCurrency(item.minimo)} – {formatCurrency(item.maximo)}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-sans">N/D</span>
                        )}
                      </TableCell>

                      {/* Variação Anual */}
                      <TableCell className="text-right">
                        {varPct !== null && varPct !== undefined ? (
                          <span
                            className={`inline-flex items-center gap-1 font-bold font-mono text-xs ${
                              varPct > 0
                                ? 'text-emerald-700'
                                : varPct < 0
                                  ? 'text-red-700'
                                  : 'text-slate-600'
                            }`}
                          >
                            {varPct > 0 ? (
                              <TrendingUp className="w-3.5 h-3.5" />
                            ) : varPct < 0 ? (
                              <TrendingDown className="w-3.5 h-3.5" />
                            ) : null}
                            {varPct > 0 ? '+' : ''}
                            {formatPercent(varPct, 1)}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px] font-sans">Base</span>
                        )}
                      </TableCell>

                      {/* Ação: Selecionar Ano */}
                      <TableCell className="text-center">
                        {onSelecionarAno && item.ano !== anoAtual ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onSelecionarAno(item.ano)}
                            className="h-7 text-[11px] font-semibold text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2"
                          >
                            Ver {item.ano}
                          </Button>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-medium">
                            Selecionado
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
