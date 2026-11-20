import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ReferenceLine,
} from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Target, ShieldCheck } from 'lucide-react'
import { getClassesMargemSeguranca, type PontoEquilibrioAno } from '@/lib/pontoEquilibrioCalculo'
import { formatBrlPontoEquilibrio } from './pontoEquilibrioFormat'

const CORES = {
  receita: '#059669',
  pe: '#dc2626',
  meta: '#2563eb',
  verde: '#10b981',
  ambar: '#f59e0b',
  vermelho: '#f43f5e',
}

export interface PontoGraficoData {
  mes: string
  receita: number | null
  pontoEquilibrio: number | null
  margemSeguranca: number | null
  /** Meta de receita do mês (null = sem meta — a linha não desenha) */
  meta: number | null
}

export function PontoEquilibrioGraficos({
  exercicio,
  dados,
  temDados,
}: {
  exercicio: number
  dados: PontoGraficoData[]
  temDados: boolean
}) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 print:hidden">
      <Card className="bg-white border-slate-200 shadow-sm">
        <CardHeader className="py-3 px-5 border-b border-slate-100 bg-slate-50/50">
          <CardTitle className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
            <Target className="w-4 h-4 text-rose-700" />
            Receita vs Ponto de Equilíbrio ({exercicio})
          </CardTitle>
          <CardDescription className="text-xs">
            Área verde = receita do mês; linha vermelha = PE do mês; linha azul tracejada = meta de
            receita. Quando a área fica abaixo da linha, o mês operou abaixo do ponto de equilíbrio.
          </CardDescription>
        </CardHeader>
        <CardContent className="py-4 px-4">
          {!temDados ? (
            <p className="text-xs text-slate-500 text-center py-10">
              Sem dados de receita ou despesas na base.
            </p>
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={dados} margin={{ top: 8, right: 12, bottom: 0, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    tickFormatter={(v: number) =>
                      `R$ ${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} mil`
                    }
                  />
                  <RechartsTooltip
                    formatter={(value, name) => [
                      value === null || value === undefined
                        ? '—'
                        : formatBrlPontoEquilibrio(Number(value)),
                      name === 'receita'
                        ? 'Receita'
                        : name === 'meta'
                          ? 'Meta de Receita'
                          : 'Ponto de Equilíbrio',
                    ]}
                    labelStyle={{ fontWeight: 700, color: '#0B1F3A' }}
                    contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="receita"
                    name="Receita"
                    stroke={CORES.receita}
                    fill={CORES.receita}
                    fillOpacity={0.15}
                    strokeWidth={2}
                    connectNulls={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="meta"
                    name="meta"
                    stroke={CORES.meta}
                    strokeWidth={2}
                    strokeDasharray="2 4"
                    dot={{ r: 2 }}
                    connectNulls={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="pontoEquilibrio"
                    name="Ponto de Equilíbrio"
                    stroke={CORES.pe}
                    strokeWidth={2}
                    strokeDasharray="6 3"
                    dot={{ r: 3 }}
                    connectNulls={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-white border-slate-200 shadow-sm">
        <CardHeader className="py-3 px-5 border-b border-slate-100 bg-slate-50/50">
          <CardTitle className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-700" />
            Margem de Segurança ao Longo do Ano ({exercicio})
          </CardTitle>
          <CardDescription className="text-xs">
            Distância percentual entre a receita e o ponto de equilíbrio de cada mês. Verde = folga,
            âmbar = atenção, vermelho = zona de risco.
          </CardDescription>
        </CardHeader>
        <CardContent className="py-4 px-4">
          {!temDados ? (
            <p className="text-xs text-slate-500 text-center py-10">
              Sem dados de receita ou despesas na base.
            </p>
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dados} margin={{ top: 8, right: 12, bottom: 0, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    tickFormatter={(v: number) => `${v.toFixed(0)}%`}
                  />
                  <RechartsTooltip
                    formatter={(value) => [
                      value === null || value === undefined
                        ? '—'
                        : `${Number(value).toFixed(2).replace('.', ',')}%`,
                      'Margem de Segurança',
                    ]}
                    labelStyle={{ fontWeight: 700, color: '#0B1F3A' }}
                    contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }}
                  />
                  <ReferenceLine y={0} stroke="#94a3b8" />
                  <Bar dataKey="margemSeguranca" name="Margem de Segurança" radius={[3, 3, 0, 0]}>
                    {dados.map((d, i) => (
                      <Cell
                        key={i}
                        fill={
                          d.margemSeguranca === null || d.margemSeguranca === undefined
                            ? '#e2e8f0'
                            : d.margemSeguranca >= 25
                              ? CORES.verde
                              : d.margemSeguranca >= 10
                                ? CORES.ambar
                                : CORES.vermelho
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

/** Exportado para reuso: cor do texto conforme a margem de segurança. */
export { getClassesMargemSeguranca }
