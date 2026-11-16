import { useMemo } from 'react'
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
import { Building2, LineChart as LineChartIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { SINAL_MULTIPLICADOR_GRUPO, type MesItem } from '@/lib/dreGerencialTypes'
import type { calcularDreGerencialMatriz } from '@/lib/dreGerencialCalculo'

type DreMatriz = ReturnType<typeof calcularDreGerencialMatriz>

const CHAVE_SEM_CENTRO = '__sem_centro__'
const NOME_SEM_CENTRO = 'Sem Centro de Custo'

/** Paleta de cores distintas (padrão do app) para as séries de centros de custo */
const PALETA_CORES = [
  '#2563eb', // blue-600
  '#059669', // emerald-600
  '#d97706', // amber-600
  '#dc2626', // red-600
  '#7c3aed', // violet-600
  '#0891b2', // cyan-600
  '#ea580c', // orange-600
  '#0d9488', // teal-600
  '#db2777', // pink-600
  '#4f46e5', // indigo-600
  '#65a30d', // lime-600
  '#c026d3', // fuchsia-600
  '#0284c7', // sky-600
  '#9333ea', // purple-600
]
const COR_SEM_CENTRO = '#64748b' // slate-500

interface SerieCentro {
  id: string
  nome: string
  cor: string
  valores: Record<string, number> // chaveMes -> valor com sinal (contribuição ao resultado)
}

export interface GraficoEvolucaoCentroCustoProps {
  matrizPeriodo1: DreMatriz
  mesesPeriodo1: MesItem[]
  descricaoPeriodo1: string
  modoComparativo: boolean
  matrizPeriodo2?: DreMatriz
  mesesPeriodo2?: MesItem[]
  descricaoPeriodo2?: string
}

function formatBrl(val: number | undefined | null): string {
  if (val === undefined || val === null || isNaN(val)) return 'R$ 0,00'
  return val.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function formatCompactoEixo(val: number): string {
  const abs = Math.abs(val)
  const sinal = val < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sinal}R$ ${(abs / 1_000_000).toFixed(1).replace('.', ',')}M`
  if (abs >= 1_000) return `${sinal}R$ ${(abs / 1_000).toFixed(1).replace('.', ',')}k`
  return `${sinal}R$ ${abs.toFixed(0)}`
}

/**
 * Agrega as contas da matriz (todos os grupos + não classificados) por Centro de Custo,
 * mantendo os MESMOS valores mês a mês que alimentam a tabela. Despesas entram com sinal
 * negativo e receitas com sinal positivo (contribuição de cada centro ao resultado),
 * usando o mesmo multiplicador de grupos do cálculo da DRE.
 */
function agregarSeriesPorCentro(matriz: DreMatriz, meses: MesItem[]): SerieCentro[] {
  const mapa = new Map<
    string,
    { nome: string; sequencia: number | null; valores: Record<string, number> }
  >()

  const adicionarConta = (conta: {
    centroId?: string
    centroNome?: string
    centroSequencia?: number | null
    classificacao: string
    valoresPorMes: Record<string, number>
  }) => {
    const chave = conta.centroId || conta.centroNome || CHAVE_SEM_CENTRO
    const nome =
      chave === CHAVE_SEM_CENTRO
        ? NOME_SEM_CENTRO
        : conta.centroNome?.trim() || `Centro ${conta.centroId || ''}`.trim()

    let serie = mapa.get(chave)
    if (!serie) {
      const valores: Record<string, number> = {}
      for (const m of meses) valores[m.chave] = 0
      serie = {
        nome,
        sequencia: conta.centroSequencia ?? null,
        valores,
      }
      mapa.set(chave, serie)
    }

    const sinal =
      conta.classificacao === 'NaoClassificado'
        ? 1
        : (SINAL_MULTIPLICADOR_GRUPO[
            conta.classificacao as keyof typeof SINAL_MULTIPLICADOR_GRUPO
          ] ?? 1)

    for (const m of meses) {
      serie.valores[m.chave] += (conta.valoresPorMes[m.chave] || 0) * sinal
    }
  }

  for (const grupo of matriz.grupos) {
    for (const conta of grupo.contas) adicionarConta(conta)
  }
  for (const conta of matriz.naoClassificados.contas) adicionarConta(conta)

  // Ordena: centros com sequência, depois sem sequência; "Sem Centro de Custo" por último
  const ordenadas = Array.from(mapa.entries()).sort((a, b) => {
    const semCentroA = a[0] === CHAVE_SEM_CENTRO
    const semCentroB = b[0] === CHAVE_SEM_CENTRO
    if (semCentroA && !semCentroB) return 1
    if (!semCentroA && semCentroB) return -1

    const seqA = a[1].sequencia
    const seqB = b[1].sequencia
    if (seqA !== null && seqB !== null && seqA !== seqB) return seqA - seqB
    if (seqA !== null && seqB === null) return -1
    if (seqA === null && seqB !== null) return 1

    return a[1].nome.localeCompare(b[1].nome, 'pt-BR', { sensitivity: 'base' })
  })

  // Mantém apenas séries com alguma movimentação no período
  const comDados = ordenadas.filter(([, s]) =>
    Object.values(s.valores).some((v) => Math.abs(v) > 0.004),
  )

  return comDados.map(([id, s], idx) => ({
    id,
    nome: s.nome,
    cor: id === CHAVE_SEM_CENTRO ? COR_SEM_CENTRO : PALETA_CORES[idx % PALETA_CORES.length],
    valores: s.valores,
  }))
}

function construirDadosGrafico(meses: MesItem[], series: SerieCentro[]) {
  return meses.map((m) => {
    const linha: Record<string, string | number> = {
      chave: m.chave,
      mes: m.rotuloCurto,
      mesCompleto: m.rotuloCompleto,
    }
    for (const s of series) {
      const v = s.valores[m.chave] || 0
      linha[s.id] = v === 0 ? 0 : v // meses sem dados entram como 0 para não quebrar a série
    }
    return linha
  })
}

interface BlocoGraficoProps {
  titulo: string
  series: SerieCentro[]
  dados: Record<string, string | number>[]
  altura: number
}

function BlocoGrafico({ titulo, series, dados, altura }: BlocoGraficoProps) {
  if (series.length === 0 || dados.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <LineChartIcon className="w-8 h-8 text-slate-300 mb-2" />
        <p className="text-sm font-medium text-slate-500">
          Nenhuma movimentação por centro de custo no período.
        </p>
        <p className="text-xs text-slate-400 mt-1">
          Classifique contas com centro de custo para visualizar a evolução mensal.
        </p>
      </div>
    )
  }

  return (
    <div>
      <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-2">{titulo}</p>
      <div style={{ width: '100%', height: altura }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={dados} margin={{ top: 8, right: 16, left: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="mes"
              tick={{ fontSize: 11, fill: '#64748b' }}
              tickLine={false}
              axisLine={{ stroke: '#cbd5e1' }}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#64748b' }}
              tickFormatter={formatCompactoEixo}
              tickLine={false}
              axisLine={false}
              width={78}
            />
            <RechartsTooltip
              content={({ active, payload, label }) => {
                if (!active || !payload || payload.length === 0) return null
                const mesCompleto = payload[0]?.payload?.mesCompleto || label
                return (
                  <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-md text-xs min-w-[220px] max-w-[320px]">
                    <div className="font-bold text-slate-900 border-b border-slate-100 pb-1.5 mb-1.5">
                      {mesCompleto}
                    </div>
                    <div className="space-y-1">
                      {payload.map((entry) => (
                        <div
                          key={String(entry.dataKey)}
                          className="flex justify-between items-center gap-4"
                        >
                          <span className="flex items-center gap-1.5 text-slate-600 truncate">
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: entry.color }}
                            />
                            <span className="truncate">{String(entry.name)}</span>
                          </span>
                          <span
                            className={`font-mono font-semibold ${
                              Number(entry.value) >= 0 ? 'text-slate-900' : 'text-rose-700'
                            }`}
                          >
                            {formatBrl(Number(entry.value))}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="text-[9.5px] text-slate-400 mt-2 pt-1 border-t border-slate-100">
                      Despesas subtraem e receitas somam (contribuição ao resultado)
                    </div>
                  </div>
                )
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
              iconType="plainline"
              iconSize={14}
            />
            {series.map((s) => (
              <Line
                key={s.id}
                type="monotone"
                dataKey={s.id}
                name={s.nome}
                stroke={s.cor}
                strokeWidth={2}
                dot={{ r: 2.5, strokeWidth: 1, fill: '#ffffff' }}
                activeDot={{ r: 4 }}
                connectNulls
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export function GraficoEvolucaoCentroCusto({
  matrizPeriodo1,
  mesesPeriodo1,
  descricaoPeriodo1,
  modoComparativo,
  matrizPeriodo2,
  mesesPeriodo2,
  descricaoPeriodo2,
}: GraficoEvolucaoCentroCustoProps) {
  // Séries do período 1 (mesmas matrizes filtradas que alimentam a tabela)
  const seriesP1 = useMemo(
    () => agregarSeriesPorCentro(matrizPeriodo1, mesesPeriodo1),
    [matrizPeriodo1, mesesPeriodo1],
  )
  const dadosP1 = useMemo(
    () => construirDadosGrafico(mesesPeriodo1, seriesP1),
    [mesesPeriodo1, seriesP1],
  )

  // Séries do período 2 (modo comparativo)
  const seriesP2 = useMemo(
    () =>
      modoComparativo && matrizPeriodo2
        ? agregarSeriesPorCentro(matrizPeriodo2, mesesPeriodo2 || [])
        : [],
    [modoComparativo, matrizPeriodo2, mesesPeriodo2],
  )
  const dadosP2 = useMemo(
    () =>
      modoComparativo && matrizPeriodo2 ? construirDadosGrafico(mesesPeriodo2 || [], seriesP2) : [],
    [modoComparativo, matrizPeriodo2, mesesPeriodo2, seriesP2],
  )

  const temAlgumaSerie = seriesP1.length > 0 || seriesP2.length > 0

  return (
    <Card className="bg-white border-slate-200/90 shadow-xs print:break-inside-avoid">
      <CardHeader className="py-3 px-4 border-b border-slate-100">
        <CardTitle className="text-xs font-bold text-slate-900 flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-blue-700 text-white shadow-xs">
            <Building2 className="w-3.5 h-3.5" />
          </span>
          Evolução Mensal por Centro de Custo
        </CardTitle>
        <CardDescription className="text-[11px] text-slate-500">
          Evolução mês a mês de cada centro de custo. Uma linha por centro; receitas somam e
          despesas subtraem (contribuição ao resultado). Respeita o filtro de centro e o período
          ativo
          {modoComparativo ? ' (Período Atual vs Período Comparado)' : ` (${descricaoPeriodo1})`} .
        </CardDescription>
      </CardHeader>

      <CardContent className="p-4 space-y-6">
        {!temAlgumaSerie ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <LineChartIcon className="w-8 h-8 text-slate-300 mb-2" />
            <p className="text-sm font-medium text-slate-500">
              Nenhuma movimentação por centro de custo no período.
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Classifique contas com centro de custo (Plano de Contas ou seletor inline) para
              visualizar a evolução mensal.
            </p>
          </div>
        ) : (
          <>
            {/* Período 1 (ou Período Atual no modo comparativo) */}
            <BlocoGrafico
              titulo={
                modoComparativo
                  ? `Período Atual — ${descricaoPeriodo1}`
                  : `Período — ${descricaoPeriodo1}`
              }
              series={seriesP1}
              dados={dadosP1}
              altura={360}
            />

            {/* Período 2 apenas no modo comparativo */}
            {modoComparativo && (
              <BlocoGrafico
                titulo={`Período Comparado — ${descricaoPeriodo2 || ''}`}
                series={seriesP2}
                dados={dadosP2}
                altura={320}
              />
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
