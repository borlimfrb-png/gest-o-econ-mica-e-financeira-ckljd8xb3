import React, { useMemo } from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
} from 'recharts'
import { TrendingUp } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { calcularRegressaoLinear, type PontoSerieAno } from '@/lib/regressaoLinearTendencia'
import { formatNumber } from '@/lib/financeCalculations'

export interface CardProjecaoIndicadoresProps {
  /** Série histórica anual (mesma base dos hodômetros). */
  serieAnual: Array<{
    ano: number
    roe: number | null
    margemLiquida: number | null
    liquidezCorrente: number | null
  }>
  anoAtivo: number
}

type ChaveProjecao = 'roe' | 'margemLiquida' | 'liquidezCorrente'

const CONFIG: Record<
  ChaveProjecao,
  { rotulo: string; unidade: 'percentual' | 'multiplo'; corReal: string; corProj: string }
> = {
  roe: {
    rotulo: 'ROE',
    unidade: 'percentual',
    corReal: '#8B5CF6',
    corProj: '#C4B5FD',
  },
  margemLiquida: {
    rotulo: 'Margem Líquida',
    unidade: 'percentual',
    corReal: '#059669',
    corProj: '#6EE7B7',
  },
  liquidezCorrente: {
    rotulo: 'Liquidez Corrente',
    unidade: 'multiplo',
    corReal: '#0284C7',
    corProj: '#7DD3FC',
  },
}

const ANOS_PROJECAO = 3
const MIN_ANOS_HISTORICO = 3

function formatarValor(valor: number | null | undefined, unidade: 'percentual' | 'multiplo') {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return '—'
  return unidade === 'percentual' ? `${formatNumber(valor, 1)}%` : `${formatNumber(valor, 2)}x`
}

/**
 * Card de PROJEÇÃO DE INDICADORES: estende ROE, Margem Líquida e Liquidez
 * Corrente +1 a +3 anos com regressão linear sobre a série histórica,
 * desenhando linha pontilhada a partir do último ano real.
 */
export function CardProjecaoIndicadores({ serieAnual, anoAtivo }: CardProjecaoIndicadoresProps) {
  const projecoes = useMemo(() => {
    const porAno = new Map<
      number,
      { real: Record<ChaveProjecao, number | null>; proj: Record<ChaveProjecao, number | null> }
    >()

    const linhas: Array<{
      ano: number
      real: Record<ChaveProjecao, number | null>
      proj: Record<ChaveProjecao, number | null>
    }> = []

    for (const item of [...serieAnual].sort((a, b) => a.ano - b.ano)) {
      porAno.set(item.ano, {
        real: {
          roe: item.roe,
          margemLiquida: item.margemLiquida,
          liquidezCorrente: item.liquidezCorrente,
        },
        proj: { roe: null, margemLiquida: null, liquidezCorrente: null },
      })
    }

    const anosReais = [...porAno.keys()].sort((a, b) => a - b)
    const ultimoAnoReal = anosReais.length > 0 ? anosReais[anosReais.length - 1] : anoAtivo

    // Contagem de anos reais com valor por indicador (mín. 3 para projetar)
    const contagemValidos: Record<ChaveProjecao, number> = {
      roe: 0,
      margemLiquida: 0,
      liquidezCorrente: 0,
    }
    for (const item of serieAnual) {
      ;(Object.keys(contagemValidos) as ChaveProjecao[]).forEach((k) => {
        const v = item[k]
        if (v !== null && v !== undefined && Number.isFinite(v)) contagemValidos[k] += 1
      })
    }

    const resultados: Partial<Record<ChaveProjecao, ReturnType<typeof calcularRegressaoLinear>>> =
      {}
    ;(Object.keys(contagemValidos) as ChaveProjecao[]).forEach((k) => {
      if (contagemValidos[k] < MIN_ANOS_HISTORICO) return
      const pontos: PontoSerieAno[] = serieAnual.map((item) => ({ ano: item.ano, valor: item[k] }))
      resultados[k] = calcularRegressaoLinear(pontos)
    })

    // Linhas projetadas: últimos anos reais + ANOS_PROJECAO anos futuros
    for (let i = 1; i <= ANOS_PROJECAO; i++) {
      const anoFuturo = ultimoAnoReal + i
      porAno.set(anoFuturo, {
        real: { roe: null, margemLiquida: null, liquidezCorrente: null },
        proj: { roe: null, margemLiquida: null, liquidezCorrente: null },
      })
    }

    ;(Object.keys(contagemValidos) as ChaveProjecao[]).forEach((k) => {
      const reg = resultados[k]
      if (!reg || contagemValidos[k] < MIN_ANOS_HISTORICO) return
      for (let i = 1; i <= ANOS_PROJECAO; i++) {
        const anoFuturo = ultimoAnoReal + i
        const linha = porAno.get(anoFuturo)
        if (!linha) continue
        const estimado = reg.inclinacao * anoFuturo + reg.intercepto
        linha.proj[k] = Number.isFinite(estimado) ? estimado : null
      }
      // Ponto de conexão: regressão ajustada do último ano real (liga histórico → projeção)
      const pontoUltimo = porAno.get(ultimoAnoReal)
      if (pontoUltimo) {
        const ajustado = reg.pontosRegressao.find((p) => p.ano === ultimoAnoReal)
        if (ajustado) pontoUltimo.proj[k] = ajustado.valorAjustado
      }
    })

    for (const [anoChave, dados] of [...porAno.entries()].sort((a, b) => a[0] - b[0])) {
      linhas.push({ ano: anoChave, ...dados })
    }
    return { linhas, contagemValidos }
  }, [serieAnual, anoAtivo])

  const podeProjetarAlgum = (Object.values(projecoes.contagemValidos) as number[]).some(
    (n) => n >= MIN_ANOS_HISTORICO,
  )

  return (
    <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
      <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-violet-600 dark:text-violet-400" />
          <CardTitle className="text-base font-bold text-[#0B1F3A] dark:text-white">
            Projeção de Indicadores (+1 a +3 anos)
          </CardTitle>
        </div>
        <CardDescription className="text-xs text-slate-500 dark:text-slate-400">
          Estimativa futura por regressão linear para ROE, Margem Líquida e Liquidez Corrente.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4 space-y-3">
        {podeProjetarAlgum ? (
          <>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={projecoes.linhas}
                  margin={{ top: 15, right: 20, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis
                    dataKey="ano"
                    tick={{ fontSize: 11, fill: '#64748B' }}
                    axisLine={{ stroke: '#CBD5E1' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#64748B' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: '#0B1F3A',
                      borderRadius: '0.75rem',
                      border: '1px solid rgba(255,255,255,0.15)',
                      color: '#FFFFFF',
                      fontSize: '12px',
                    }}
                    formatter={(val: any, name: any) => [
                      val !== null && val !== undefined && Number.isFinite(Number(val))
                        ? String(name).startsWith('proj_')
                          ? `${formatNumber(Number(val), 2)} (estimado)`
                          : formatarValor(Number(val), 'percentual')
                        : '—',
                      String(name).startsWith('proj_')
                        ? `${CONFIG[String(name).slice(5) as ChaveProjecao]?.rotulo ?? name} (Projeção)`
                        : (CONFIG[name as ChaveProjecao]?.rotulo ?? name),
                    ]}
                  />
                  <Legend
                    formatter={(val) => {
                      const chave = String(val)
                      if (chave.startsWith('proj_')) {
                        const ind = CONFIG[chave.slice(5) as ChaveProjecao]
                        return (
                          <span className="text-xs text-slate-700 dark:text-slate-300">
                            {ind?.rotulo ?? chave} (Projeção)
                          </span>
                        )
                      }
                      const ind = CONFIG[chave as ChaveProjecao]
                      return (
                        <span className="text-xs text-slate-700 dark:text-slate-300">
                          {ind?.rotulo ?? chave} (Real)
                        </span>
                      )
                    }}
                  />
                  {(Object.keys(CONFIG) as ChaveProjecao[]).map((k) => (
                    <React.Fragment key={k}>
                      <Line
                        type="monotone"
                        dataKey={`real.${k}`}
                        name={k}
                        stroke={CONFIG[k].corReal}
                        strokeWidth={2.5}
                        dot={{ r: 4, fill: CONFIG[k].corReal }}
                        connectNulls
                      />
                      <Line
                        type="linear"
                        dataKey={`proj.${k}`}
                        name={`proj_${k}`}
                        stroke={CONFIG[k].corProj}
                        strokeWidth={2}
                        strokeDasharray="6 4"
                        dot={{ r: 3, fill: CONFIG[k].corProj }}
                        connectNulls
                      />
                    </React.Fragment>
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[10px] text-slate-400 dark:text-slate-500">
              Nota metodológica: projeção por regressão linear dos exercícios históricos (mín. 3
              anos); valores estimados, não garantidos.
            </p>
          </>
        ) : (
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
            Ainda não é possível projetar: a regressão linear exige no mínimo 3 exercícios com dados
            para cada indicador. Importe balanços e DREs de pelo menos 3 anos para habilitar a
            projeção.
          </div>
        )}
      </CardContent>
    </Card>
  )
}
