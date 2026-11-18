import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend as RechartsLegend,
} from 'recharts'
import { BarChart3 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type {
  ComparativoIndicadoresAnuaisResultado,
  LinhaIndicadorAnual,
} from '@/lib/comparativoIndicadoresAnuais'

interface Props {
  resultado: ComparativoIndicadoresAnuaisResultado
  empresaNome: string
}

function formatarValor(linha: LinhaIndicadorAnual, ano: number): string {
  const v = linha.valores[ano]
  if (v === null || v === undefined || !Number.isFinite(v)) return '—'
  if (linha.unidade === 'multiplo') return v.toFixed(2)
  return `${v.toFixed(1)}%`
}

function formatarTooltip(linha: LinhaIndicadorAnual, ano: number): string {
  const v = linha.valores[ano]
  if (v === null || v === undefined || !Number.isFinite(v)) return 'Sem dados'
  if (linha.unidade === 'multiplo') return `${v.toFixed(2)}×`
  return `${v.toFixed(1)}%`
}

const CORES_BARRAS = ['#0B1F3A', '#1E40AF', '#0EA5E9', '#059669', '#F59E0B', '#DC2626']

/** Uma cor por ANO (série): gráfico de barras agrupadas por indicador. */
function montarDadosGrafico(resultado: ComparativoIndicadoresAnuaisResultado) {
  return resultado.linhas.map((linha) => {
    const item: Record<string, string | number | null> = { indicador: linha.sigla }
    for (const ano of resultado.anos) {
      const v = linha.valores[ano]
      item[String(ano)] = v === null || !Number.isFinite(v) ? 0 : v
    }
    return item
  })
}

export function SecaoComparativoIndicadoresAnuais({ resultado, empresaNome }: Props) {
  const dadosGrafico = montarDadosGrafico(resultado)
  const temDados = resultado.temDados

  return (
    <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs">
      <CardHeader className="py-3 px-4 sm:px-6 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <span className="p-1 rounded-md bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300">
            <BarChart3 className="w-4 h-4" />
          </span>
          <CardTitle className="text-sm font-bold text-[#0B1F3A] dark:text-slate-100">
            Comparativo de Indicadores Anuais
          </CardTitle>
          <Badge variant="outline" className="text-[10px] py-0">
            LC · LS · Endividamento · ROE · ROA · Margens
          </Badge>
        </div>
        <CardDescription className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Evolução ano a ano dos principais indicadores (janela de até 6 exercícios) — {empresaNome}
          . Liquidez em múltiplo; demais em % (uma casa decimal). "—" = sem dados apuráveis no ano.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 sm:p-6 space-y-5">
        {!temDados ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Sem dados para o período — apure lançamentos e/ou cadastre balanços para compor o
            comparativo.
          </p>
        ) : (
          <>
            {/* Tabela: linhas = indicadores, colunas = anos (mais recente primeiro) */}
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-x-auto">
              <table className="w-full text-xs min-w-[560px]">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300">
                    <th className="text-left font-semibold px-3 py-2">Indicador</th>
                    {resultado.anos.map((ano) => (
                      <th key={ano} className="text-right font-semibold px-3 py-2">
                        {ano}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {resultado.linhas.map((linha) => (
                    <tr
                      key={linha.sigla}
                      className="border-t border-slate-100 dark:border-slate-800"
                    >
                      <td className="px-3 py-2 text-slate-700 dark:text-slate-200">
                        <span className="font-semibold">{linha.sigla}</span>
                        <span className="ml-2 text-slate-400 dark:text-slate-500">
                          {linha.nome}
                        </span>
                      </td>
                      {resultado.anos.map((ano) => {
                        const v = linha.valores[ano]
                        return (
                          <td
                            key={ano}
                            title={formatarTooltip(linha, ano)}
                            className={`px-3 py-2 text-right tabular-nums ${
                              v === null || !Number.isFinite(v)
                                ? 'text-slate-400 dark:text-slate-600'
                                : 'text-slate-800 dark:text-slate-100 font-semibold'
                            }`}
                          >
                            {formatarValor(linha, ano)}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Gráfico de barras agrupadas por indicador (uma série por ano) */}
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                Evolução por Indicador (% / múltiplo)
              </p>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dadosGrafico} margin={{ top: 10, right: 15, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#94A3B8" opacity={0.25} />
                    <XAxis
                      dataKey="indicador"
                      stroke="#64748B"
                      fontSize={10}
                      tickLine={false}
                      axisLine={{ stroke: '#CBD5E1' }}
                      interval={0}
                      angle={-12}
                      textAnchor="end"
                      height={45}
                    />
                    <YAxis
                      stroke="#64748B"
                      fontSize={10}
                      tickLine={false}
                      axisLine={{ stroke: '#CBD5E1' }}
                      tickFormatter={(v: number) => v.toFixed(0)}
                    />
                    <RechartsTooltip
                      formatter={(valor, nome) => [String(valor), String(nome)]}
                      labelFormatter={(label, payload) => {
                        const p = payload?.[0]?.payload as
                          | Record<string, string | number | null>
                          | undefined
                        const linha = resultado.linhas.find((l) => l.sigla === label)
                        const partes = [String(label)]
                        if (p && linha) {
                          for (const ano of resultado.anos) {
                            partes.push(`${ano}: ${formatarTooltip(linha, ano)}`)
                          }
                        }
                        return partes.join('  ·  ')
                      }}
                      contentStyle={{
                        backgroundColor: '#FFFFFF',
                        border: '1px solid #E2E8F0',
                        borderRadius: 8,
                        fontSize: 11,
                      }}
                    />
                    <RechartsLegend wrapperStyle={{ fontSize: 11 }} />
                    {resultado.anos.map((ano, i) => (
                      <Bar
                        key={ano}
                        dataKey={String(ano)}
                        fill={CORES_BARRAS[i % CORES_BARRAS.length]}
                        radius={[3, 3, 0, 0]}
                        maxBarSize={26}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                Nota: os eixos unificam % e múltiplos por legibilidade; consulte os valores exatos
                na tabela acima e nos tooltips.
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
