import React from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ReferenceLine,
} from 'recharts'
import { TrendingUp, TrendingDown, Minus, Info } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

export interface PontoEvolucao {
  ano: number
  valor: number | null
}

interface SparklineEvolucaoProps {
  pontos: PontoEvolucao[]
  benchmarkValor: number | null
  unidade?: string // '%' | 'x' | 'dias' | 'R$'
  isLowerBetter?: boolean
}

export function SparklineEvolucao({
  pontos,
  benchmarkValor,
  unidade = '',
  isLowerBetter = false,
}: SparklineEvolucaoProps) {
  // Ordenar pontos por ano crescente
  const pontosOrdenados = [...pontos].sort((a, b) => a.ano - b.ano)
  const pontosComValor = pontosOrdenados.filter(
    (p) => p.valor !== null && !isNaN(p.valor as number),
  )

  if (pontosComValor.length < 2) {
    return (
      <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-lg text-center text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
        <Info className="w-3.5 h-3.5 text-slate-400" />
        Dados insuficientes para análise histórica (necessário 2+ anos)
      </div>
    )
  }

  // Tendência recente (último ano vs ano imediatamente anterior)
  const penultimo = pontosComValor[pontosComValor.length - 2]
  const ultimo = pontosComValor[pontosComValor.length - 1]

  const delta = (ultimo.valor as number) - (penultimo.valor as number)
  let tendencia: 'melhora' | 'piora' | 'estavel' = 'estavel'

  if (Math.abs(delta) > 0.001) {
    if (isLowerBetter) {
      tendencia = delta < 0 ? 'melhora' : 'piora'
    } else {
      tendencia = delta > 0 ? 'melhora' : 'piora'
    }
  }

  // Prepara dados para o chart
  const data = pontosOrdenados.map((p) => ({
    ano: String(p.ano),
    empresa: p.valor !== null ? Number(p.valor.toFixed(2)) : null,
    benchmark: benchmarkValor !== null ? Number(benchmarkValor.toFixed(2)) : null,
  }))

  const valoresEmpresa = pontosComValor.map((p) => p.valor as number)
  if (benchmarkValor !== null) valoresEmpresa.push(benchmarkValor)
  const minVal = Math.min(...valoresEmpresa)
  const maxVal = Math.max(...valoresEmpresa)
  const padding = Math.max(0.1, (maxVal - minVal) * 0.15)

  return (
    <div className="p-3 bg-slate-50/80 border border-slate-200/80 rounded-xl space-y-2">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
            Evolução (3 Anos vs Setor)
          </span>
          {tendencia === 'melhora' && (
            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 font-bold text-[10px] gap-1 px-1.5 py-0">
              <TrendingUp className="w-3 h-3 text-emerald-600" />
              Melhorando
            </Badge>
          )}
          {tendencia === 'piora' && (
            <Badge className="bg-red-50 text-red-700 border-red-200 font-bold text-[10px] gap-1 px-1.5 py-0">
              <TrendingDown className="w-3 h-3 text-red-600" />
              Piorando
            </Badge>
          )}
          {tendencia === 'estavel' && (
            <Badge className="bg-slate-100 text-slate-600 border-slate-200 font-bold text-[10px] gap-1 px-1.5 py-0">
              <Minus className="w-3 h-3" />
              Estável
            </Badge>
          )}
        </div>

        {benchmarkValor !== null && (
          <span className="text-[10px] text-slate-500">
            Setor:{' '}
            <strong className="text-slate-700 font-mono">
              {benchmarkValor.toFixed(2)}
              {unidade}
            </strong>
          </span>
        )}
      </div>

      {/* Mini Sparkline Chart */}
      <div className="h-20 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <XAxis
              dataKey="ano"
              tick={{ fontSize: 10, fill: '#64748B' }}
              axisLine={{ stroke: '#E2E8F0' }}
              tickLine={false}
            />
            <YAxis hide domain={[minVal - padding, maxVal + padding]} />
            <RechartsTooltip
              content={({ active, payload, label }) => {
                if (!active || !payload || !payload.length) return null
                const emp = payload.find((p) => p.dataKey === 'empresa')?.value
                const bmk = payload.find((p) => p.dataKey === 'benchmark')?.value
                return (
                  <div className="bg-slate-900 text-white text-[10px] px-2.5 py-1.5 rounded shadow-lg space-y-0.5 font-sans">
                    <span className="font-bold block text-slate-300">Ano {label}</span>
                    <span className="text-blue-300 block">
                      Empresa:{' '}
                      <strong>
                        {emp !== undefined && emp !== null ? `${emp}${unidade}` : '—'}
                      </strong>
                    </span>
                    {bmk !== undefined && bmk !== null && (
                      <span className="text-slate-400 block">
                        Setor: {bmk}
                        {unidade}
                      </span>
                    )}
                  </div>
                )
              }}
            />
            {benchmarkValor !== null && (
              <ReferenceLine
                y={benchmarkValor}
                stroke="#94A3B8"
                strokeDasharray="3 3"
                strokeWidth={1}
              />
            )}
            <Line
              type="monotone"
              dataKey="empresa"
              stroke="#2563EB"
              strokeWidth={2.5}
              dot={{ r: 3.5, fill: '#2563EB', strokeWidth: 1.5, stroke: '#FFFFFF' }}
              activeDot={{ r: 5, fill: '#1D4ED8' }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Mini Tabela de Valores por Ano */}
      <div className="grid grid-cols-4 gap-1.5 pt-1 text-center border-t border-slate-200/60">
        {pontosOrdenados.map((p) => (
          <div key={p.ano} className="bg-white p-1 rounded border border-slate-100">
            <span className="text-[9px] text-slate-400 block font-medium">{p.ano}</span>
            <span className="text-[11px] font-bold text-slate-800 block font-mono">
              {p.valor !== null && !isNaN(p.valor) ? `${p.valor.toFixed(2)}${unidade}` : '—'}
            </span>
          </div>
        ))}
        {benchmarkValor !== null && (
          <div className="bg-blue-50/50 p-1 rounded border border-blue-100">
            <span className="text-[9px] text-blue-600 block font-semibold">Setor</span>
            <span className="text-[11px] font-bold text-blue-900 block font-mono">
              {benchmarkValor.toFixed(2)}
              {unidade}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
