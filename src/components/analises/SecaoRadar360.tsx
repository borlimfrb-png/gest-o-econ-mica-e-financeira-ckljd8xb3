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
import { Radar as RadarIcon, Info } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  montarDadosRadar360,
  type AnaliseAnual360Resultado,
  type TipoTelaAnalise,
} from '@/lib/analiseAnual360'

const AZUL_BORLIM = '#144272'
const AZUL_BORLIM_CLARO = '#3B82F6'
const CINZA_NEUTRO = '#94a3b8'

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

export function formatBrlCompacto(val: number): string {
  if (!Number.isFinite(val)) return 'R$ 0'
  const abs = Math.abs(val)
  const sinal = val < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sinal}R$ ${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${sinal}R$ ${(abs / 1_000).toFixed(0)}k`
  return `${sinal}R$ ${abs.toFixed(0)}`
}

/** Trunca rótulos longos de eixo para não cortarem/empilharem no radar. */
function truncarRotulo(rotulo: string, max = 18): string {
  return rotulo.length > max ? `${rotulo.slice(0, max - 1)}…` : rotulo
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

  const dados = useMemo(() => {
    const brutos = montarDadosRadar360(resultado)
    return brutos.map((d) => ({ ...d, eixo: truncarRotulo(d.eixo) }))
  }, [resultado])

  const temAnterior =
    resultado.tipo === 'rentabilidade'
      ? (resultado.radarRentabilidade?.anterior ?? []).some((v) => v !== null && v !== undefined)
      : !!resultado.anoAnterior?.temDados

  const formatoValor = eRentabilidade ? formatPercent : formatBrl

  // Escala do raio começa em zero e termina no maior valor (com folga de 10%)
  const dominioMax = useMemo(() => {
    let max = 0
    for (const d of dados) {
      max = Math.max(max, Math.abs(d.atual || 0), Math.abs(d.anterior || 0))
    }
    return max > 0 ? Math.ceil(max * 1.1) : undefined
  }, [dados])

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
        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart
              data={dados}
              margin={{ top: 28, right: 40, bottom: 16, left: 40 }}
              startAngle={90}
              endAngle={-270}
            >
              <PolarGrid stroke="#cbd5e1" strokeDasharray="3 3" gridType="polygon" />
              <PolarAngleAxis
                dataKey="eixo"
                tick={{ fill: '#334155', fontSize: 11, fontWeight: 600 }}
              />
              <PolarRadiusAxis
                angle={90}
                domain={[0, dominioMax ?? 'auto']}
                tick={{ fill: '#94a3b8', fontSize: 10 }}
                tickFormatter={(v: number) =>
                  eRentabilidade ? `${Math.round(v)}%` : formatBrlCompacto(v)
                }
              />
              <RechartsTooltip
                cursor={{ fill: 'rgba(20, 66, 114, 0.06)' }}
                formatter={(value: number | string, name: string) => [
                  formatoValor(Number(value)),
                  name,
                ]}
                labelStyle={{ fontWeight: 700, color: '#0B1F3A' }}
                contentStyle={{
                  borderRadius: 12,
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 4px 16px rgba(11, 31, 58, 0.08)',
                  fontSize: 12,
                }}
                itemStyle={{ padding: '2px 0' }}
              />
              <Legend
                wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                iconType="circle"
                iconSize={9}
              />
              <Radar
                name={`Exercício ${resultado.anoAtual}`}
                dataKey="atual"
                stroke={AZUL_BORLIM}
                fill={eRentabilidade ? AZUL_BORLIM_CLARO : AZUL_BORLIM}
                fillOpacity={eRentabilidade ? 0.3 : 0.28}
                strokeWidth={2.5}
                dot={{ r: 3.5, fill: AZUL_BORLIM, strokeWidth: 0 }}
                activeDot={{ r: 5 }}
              />
              {temAnterior && (
                <Radar
                  name={`Exercício ${resultado.anoAnterior?.ano}`}
                  dataKey="anterior"
                  stroke={CINZA_NEUTRO}
                  fill={CINZA_NEUTRO}
                  fillOpacity={0.15}
                  strokeWidth={2}
                  strokeDasharray="5 3"
                  dot={{ r: 3, fill: CINZA_NEUTRO, strokeWidth: 0 }}
                />
              )}
            </RadarChart>
          </ResponsiveContainer>
        </div>
        {!eRentabilidade && (
          <div className="flex items-start gap-1.5 mt-1 mb-2 px-1 text-[11px] text-slate-500 dark:text-slate-400">
            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-400" />
            <p>
              Valores em R$ reais por centro de custo. Passe o mouse sobre cada vértice para ver o
              valor exato.
            </p>
          </div>
        )}
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
