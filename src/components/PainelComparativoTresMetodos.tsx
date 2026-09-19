import React from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
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
  ReferenceLine,
} from 'recharts'
import {
  Scale,
  TrendingUp,
  Briefcase,
  BarChart3,
  Award,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react'
import { formatCurrency, formatPercent } from '@/lib/financeCalculations'
import type { ComparativoTresMetodos } from '@/lib/valuationMultiplos'

export interface PainelComparativoTresMetodosProps {
  comparativo: ComparativoTresMetodos
  empresaNome?: string
  ano: number
}

export const PainelComparativoTresMetodos: React.FC<PainelComparativoTresMetodosProps> = ({
  comparativo,
  empresaNome,
  ano,
}) => {
  const {
    fcd,
    superlucro,
    multiplos,
    faixaGeralMin,
    faixaGeralMax,
    valorCentralTriplo,
    metodoMaisIndicado,
    tituloParecer,
    textoParecer,
    recomendacaoNegociacao,
  } = comparativo

  const dadosGraficoMetodos = [
    {
      metodo: 'Fluxo Descontado',
      sigla: 'FCD (Gordon)',
      valor: fcd.valido ? Number(fcd.valor.toFixed(2)) : 0,
      cor: '#2563EB',
      descricao: fcd.descricao,
    },
    {
      metodo: 'Superlucro (Goodwill)',
      sigla: 'Goodwill (PL+Superlucro)',
      valor: superlucro.valido ? Number(superlucro.valor.toFixed(2)) : 0,
      cor: '#059669',
      descricao: superlucro.descricao,
    },
    {
      metodo: 'Múltiplos de Mercado',
      sigla: 'Múltiplos (Mercado)',
      valor: multiplos.valido ? Number(multiplos.valor.toFixed(2)) : 0,
      cor: '#7C3AED',
      descricao: multiplos.descricao,
    },
  ]

  const dispersaoPercentual =
    faixaGeralMin > 0 ? ((faixaGeralMax - faixaGeralMin) / faixaGeralMin) * 100 : 0

  return (
    <div className="space-y-6">
      {/* 1. Header do Comparativo */}
      <Card className="bg-white border-slate-200 shadow-2xs">
        <CardHeader className="p-4 pb-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-bold text-[#0B1F3A]">
                  Comparativo Triplo de Avaliação: FCD vs Goodwill vs Múltiplos
                </CardTitle>
                <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 font-bold text-[10px]">
                  3 Metodologias
                </Badge>
              </div>
              <CardDescription className="text-xs text-slate-500">
                Visão integrada e triangulação de valor da empresa ({empresaNome || 'Empresa'}) para
                o exercício {ano}
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge className="bg-slate-100 text-slate-800 border-slate-200 text-xs font-semibold">
              Dispersão: {dispersaoPercentual.toFixed(1)}%
            </Badge>
          </div>
        </CardHeader>

        {/* 2. Três Cards Lado a Lado com os Valores de Cada Método */}
        <CardContent className="p-4 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Método 1: FCD */}
            <Card
              className={`border transition-all ${
                metodoMaisIndicado === 'fcd'
                  ? 'border-blue-500 shadow-md ring-2 ring-blue-500/20 bg-blue-50/20'
                  : 'border-slate-200 shadow-2xs bg-white'
              }`}
            >
              <CardHeader className="p-4 pb-2 border-b border-slate-100 flex flex-row items-center justify-between gap-2">
                <div>
                  <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                    Método 1 · Intrínseco
                  </span>
                  <CardTitle className="text-sm font-bold text-[#0B1F3A] mt-1">
                    Fluxo Descontado (FCD)
                  </CardTitle>
                </div>
                {metodoMaisIndicado === 'fcd' && (
                  <Badge className="bg-blue-600 text-white font-bold text-[10px]">
                    ⭐ Destaque
                  </Badge>
                )}
              </CardHeader>
              <CardContent className="p-4 space-y-2">
                <div className="text-2xl font-black text-blue-700">
                  {fcd.valido ? formatCurrency(fcd.valor) : 'N/D'}
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">{fcd.descricao}</p>
                <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-400">
                  Ideal para: empresas consolidadas com fluxos previsíveis
                </div>
              </CardContent>
            </Card>

            {/* Método 2: Superlucro (Goodwill) */}
            <Card
              className={`border transition-all ${
                metodoMaisIndicado === 'superlucro'
                  ? 'border-emerald-500 shadow-md ring-2 ring-emerald-500/20 bg-emerald-50/20'
                  : 'border-slate-200 shadow-2xs bg-white'
              }`}
            >
              <CardHeader className="p-4 pb-2 border-b border-slate-100 flex flex-row items-center justify-between gap-2">
                <div>
                  <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                    Método 2 · Patrimonial
                  </span>
                  <CardTitle className="text-sm font-bold text-[#0B1F3A] mt-1">
                    Superlucro (Goodwill)
                  </CardTitle>
                </div>
                {metodoMaisIndicado === 'superlucro' && (
                  <Badge className="bg-emerald-600 text-white font-bold text-[10px]">
                    ⭐ Destaque
                  </Badge>
                )}
              </CardHeader>
              <CardContent className="p-4 space-y-2">
                <div className="text-2xl font-black text-emerald-700">
                  {superlucro.valido ? formatCurrency(superlucro.valor) : 'N/D'}
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">{superlucro.descricao}</p>
                <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-400">
                  Ideal para: empresas com patrimônio líquido forte e lucros consistentes
                </div>
              </CardContent>
            </Card>

            {/* Método 3: Múltiplos de Mercado */}
            <Card
              className={`border transition-all ${
                metodoMaisIndicado === 'multiplos'
                  ? 'border-purple-500 shadow-md ring-2 ring-purple-500/20 bg-purple-50/20'
                  : 'border-slate-200 shadow-2xs bg-white'
              }`}
            >
              <CardHeader className="p-4 pb-2 border-b border-slate-100 flex flex-row items-center justify-between gap-2">
                <div>
                  <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider bg-purple-50 px-2 py-0.5 rounded border border-purple-100">
                    Método 3 · Mercado
                  </span>
                  <CardTitle className="text-sm font-bold text-[#0B1F3A] mt-1">
                    Múltiplos de Mercado
                  </CardTitle>
                </div>
                {metodoMaisIndicado === 'multiplos' && (
                  <Badge className="bg-purple-600 text-white font-bold text-[10px]">
                    ⭐ Destaque
                  </Badge>
                )}
              </CardHeader>
              <CardContent className="p-4 space-y-2">
                <div className="text-2xl font-black text-purple-700">
                  {multiplos.valido ? formatCurrency(multiplos.valor) : 'N/D'}
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">{multiplos.descricao}</p>
                <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-400">
                  Ideal para: balizamento direto em rodadas de M&A e sócios
                </div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* 3. Faixa de Negociação e Valor Central Triplo */}
      <Card className="bg-gradient-to-br from-[#0B1F3A] via-slate-900 to-indigo-950 text-white border-indigo-900 shadow-md">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
            <div className="space-y-1 md:border-r md:border-white/10 md:pr-4">
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-300">
                Piso da Faixa Negocial
              </span>
              <div className="text-xl sm:text-2xl font-black text-white">
                {formatCurrency(faixaGeralMin)}
              </div>
              <p className="text-[10px] text-slate-300">
                Menor valor apurado entre os três métodos válidos
              </p>
            </div>

            <div className="space-y-1 text-center md:border-r md:border-white/10 md:px-4">
              <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-400/30 text-[10px] font-extrabold uppercase">
                Consenso Central Triplo
              </Badge>
              <div className="text-2xl sm:text-3xl font-black text-emerald-300">
                {formatCurrency(valorCentralTriplo)}
              </div>
              <p className="text-[10px] text-slate-300">
                Média convergente das três abordagens de valuation
              </p>
            </div>

            <div className="space-y-1 md:pl-4 text-left md:text-right">
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-300">
                Teto da Faixa Negocial
              </span>
              <div className="text-xl sm:text-2xl font-black text-white">
                {formatCurrency(faixaGeralMax)}
              </div>
              <p className="text-[10px] text-slate-300">
                Maior valor apurado entre os três métodos válidos
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 4. Gráfico Comparativo dos Três Métodos */}
      <Card className="bg-white border-slate-200 shadow-2xs">
        <CardHeader className="pb-2 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <CardTitle className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-600" />
              Gráfico Comparativo dos 3 Métodos de Valuation
            </CardTitle>
            <CardDescription className="text-xs">
              Alinhamento horizontal das três óticas de avaliação da empresa
            </CardDescription>
          </div>

          <div className="flex items-center gap-3 text-xs font-semibold">
            <span className="flex items-center gap-1.5 text-blue-700">
              <span className="w-2.5 h-2.5 rounded-sm bg-blue-600" />
              FCD
            </span>
            <span className="flex items-center gap-1.5 text-emerald-700">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-600" />
              Goodwill
            </span>
            <span className="flex items-center gap-1.5 text-purple-700">
              <span className="w-2.5 h-2.5 rounded-sm bg-purple-600" />
              Múltiplos
            </span>
          </div>
        </CardHeader>

        <CardContent className="pt-6 space-y-4">
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={dadosGraficoMetodos}
                layout="vertical"
                margin={{ top: 10, right: 30, left: 30, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: '#64748B' }}
                  tickFormatter={(v) =>
                    Math.abs(v) >= 1000000
                      ? `R$ ${(v / 1000000).toFixed(1)}M`
                      : Math.abs(v) >= 1000
                        ? `R$ ${(v / 1000).toFixed(0)}k`
                        : `R$ ${v}`
                  }
                />
                <YAxis
                  dataKey="sigla"
                  type="category"
                  tick={{ fontSize: 12, fill: '#0B1F3A', fontWeight: 700 }}
                  width={150}
                />
                <RechartsTooltip
                  formatter={(val: any, _name: any, item: any) => [
                    formatCurrency(Number(val)),
                    item.payload.metodo,
                  ]}
                  labelFormatter={(label) => `Método: ${label}`}
                />
                {valorCentralTriplo > 0 && (
                  <ReferenceLine
                    x={valorCentralTriplo}
                    stroke="#D97706"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    label={{
                      value: `Central: ${formatCurrency(valorCentralTriplo)}`,
                      position: 'insideTopRight',
                      fill: '#B45309',
                      fontSize: 11,
                      fontWeight: 'bold',
                    }}
                  />
                )}
                <Bar dataKey="valor" radius={[0, 6, 6, 0]} barSize={28}>
                  {dadosGraficoMetodos.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.cor} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* 5. Parecer Comparativo Executivo */}
      <Card className="bg-white border-blue-200/80 shadow-2xs overflow-hidden">
        <CardHeader className="p-4 pb-3 bg-gradient-to-r from-blue-50/70 via-slate-50 to-slate-50 border-b border-blue-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-blue-600" />
            <div>
              <CardTitle className="text-sm font-bold text-[#0B1F3A]">
                Parecer Comparativo do Consultor: {tituloParecer}
              </CardTitle>
              <CardDescription className="text-xs">
                Qual método se aplica melhor ao perfil da empresa e recomendações de negociação
              </CardDescription>
            </div>
          </div>

          <Badge className="bg-blue-100 text-blue-800 border-blue-200 font-bold text-xs uppercase">
            Metodologia Recomendada: {metodoMaisIndicado.toUpperCase()}
          </Badge>
        </CardHeader>

        <CardContent className="p-5 space-y-4 text-xs leading-relaxed">
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
            <span className="font-bold text-[#0B1F3A] uppercase tracking-wider text-[11px] block">
              Diagnóstico Metodológico Comparativo
            </span>
            <p className="text-slate-700 leading-relaxed text-justify">{textoParecer}</p>
          </div>

          <div className="p-4 bg-emerald-50/60 rounded-xl border border-emerald-200 space-y-1.5">
            <span className="font-bold text-emerald-950 uppercase tracking-wider text-[11px] block flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Estratégia Recomendada para a Faixa de Negociação
            </span>
            <p className="text-emerald-900 leading-relaxed text-justify">
              {recomendacaoNegociacao}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
export default PainelComparativoTresMetodos
