import { useMemo } from 'react'
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
  Tooltip as RechartsTooltip,
} from 'recharts'
import { Radar as RadarIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  montarDadosRadar360,
  type AnaliseAnual360Resultado,
  type TipoTelaAnalise,
} from '@/lib/analiseAnual360'

function formatBrl(val: number | undefined | null): string {
  if (val === undefined || val === null || !Number.isFinite(val)) return 'R$ 0,00'
  return val.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function formatPercent(val: number | undefined | null): string {
  if (val === undefined || val === null || !Number.isFinite(val)) return '—'
  return `${val.toFixed(2)}%`
}

interface SecaoRadar360Props {
  tipo: TipoTelaAnalise
  resultado: AnaliseAnual360Resultado
}

/**
 * Seção "Radar 360": gráfico de radar comparando o exercício atual vs o
 * anterior. Para despesas (fixas/variáveis) os eixos são os centros de custo e
 * o valor é o total do exercício; para rentabilidade, os eixos são as
 * componentes de margem (%). Somente leitura.
 */
export function SecaoRadar360({ tipo, resultado }: SecaoRadar360Props) {
  const eRentabilidade = tipo === 'rentabilidade'

  const dados = useMemo(() => montarDadosRadar360(resultado), [resultado])

  const temAnterior =
    resultado.tipo === 'rentabilidade'
      ? (resultado.radarRentabilidade?.anterior ?? []).some((v) => v !== null && v !== undefined)
      : !!resultado.anoAnterior?.temDados

  const formatoValor = eRentabilidade ? formatPercent : formatBrl

  if (dados.length === 0) {
    return (
      <Card className="border-slate-200 dark:border-slate-800 print:break-inside-avoid">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[#0B1F3A] dark:text-slate-100">
            <RadarIcon className="w-4 h-4 text-sky-700 dark:text-sky-400" />
            Radar 360
          </CardTitle>
          <CardDescription>
            {eRentabilidade
              ? 'Comparação consolidada das margens entre exercícios.'
              : 'Comparação consolidada por centro de custo entre exercícios.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/40 py-12 px-6 text-center">
            <RadarIcon className="w-8 h-8 text-slate-300 dark:text-slate-600 mb-3" />
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
              Sem dados para o período
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              Não há lançamentos suficientes para montar o Radar 360 deste exercício.
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
          <RadarIcon className="w-4 h-4 text-sky-700 dark:text-sky-400" />
          Radar 360
        </CardTitle>
        <CardDescription>
          {eRentabilidade
            ? 'Margens consolidadas — exercício atual vs anterior (%).'
            : 'Totais por centro de custo — exercício atual vs anterior.'}{' '}
          Exercício {resultado.anoAtual}
          {temAnterior ? ` vs ${resultado.anoAnterior?.ano}` : ''}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[380px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={dados} margin={{ top: 12, right: 24, bottom: 12, left: 24 }}>
              <PolarGrid stroke="#cbd5e1" strokeDasharray="3 3" />
              <PolarAngleAxis dataKey="eixo" tick={{ fill: '#475569', fontSize: 11 }} />
              <PolarRadiusAxis
                tick={{ fill: '#94a3b8', fontSize: 10 }}
                tickFormatter={(v: number) =>
                  eRentabilidade ? `${Math.round(v)}%` : formatBrlCompacto(v)
                }
              />
              <RechartsTooltip
                formatter={(value: number | string, name: string) => [
                  formatoValor(Number(value)),
                  name,
                ]}
                labelStyle={{ fontWeight: 700, color: '#0B1F3A' }}
                contentStyle={{
                  borderRadius: 12,
                  border: '1px solid #e2e8f0',
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
              <Radar
                name={`Exercício ${resultado.anoAtual}`}
                dataKey="atual"
                stroke="#144272"
                fill="#144272"
                fillOpacity={0.35}
                strokeWidth={2}
                dot={{ r: 3, fill: '#144272' }}
              />
              {temAnterior && (
                <Radar
                  name={`Exercício ${resultado.anoAnterior?.ano}`}
                  dataKey="anterior"
                  stroke="#94a3b8"
                  fill="#94a3b8"
                  fillOpacity={0.18}
                  strokeWidth={2}
                  strokeDasharray="4 3"
                  dot={{ r: 3, fill: '#94a3b8' }}
                />
              )}
            </RadarChart>
          </ResponsiveContainer>
        </div>
        {!temAnterior && (
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 text-center">
            Sem lançamentos no exercício {resultado.anoAnterior?.ano} — exibindo apenas o exercício
            atual.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function formatBrlCompacto(val: number): string {
  if (!Number.isFinite(val)) return 'R$ 0'
  const abs = Math.abs(val)
  const sinal = val < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sinal}R$ ${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${sinal}R$ ${(abs / 1_000).toFixed(0)}k`
  return `${sinal}R$ ${abs.toFixed(0)}`
}
