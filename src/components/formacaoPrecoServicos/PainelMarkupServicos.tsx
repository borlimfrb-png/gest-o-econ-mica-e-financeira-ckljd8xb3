import { useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FileSpreadsheet, FileText, Gauge, TriangleAlert } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts'
import { HodometroGauge } from '@/components/HodometroGauge'
import {
  calcularPainelMarkup,
  FAIXA_MARKUP_SAUDAVEL,
  type LinhaResumo,
} from '@/lib/formacaoPrecoServicosRelatorios'
import type { ParametrosFormacaoServicos } from '@/lib/formacaoPrecoServicosCalculo'
import { exportarPainelMarkup } from '@/lib/formacaoPrecoServicosRelatoriosExport'

interface Props {
  dadosResumo: LinhaResumo[]
  parametros: ParametrosFormacaoServicos
  nomeEmpresa: string
  exercicioAno?: number
}

const fmtPct = (v: number, casas = 2) =>
  Number.isFinite(v) ? `${v.toLocaleString('pt-BR', { maximumFractionDigits: casas })}%` : '—'

/**
 * Painel visual do mark-up: hodômetro (gauge) do multiplicador contra a
 * faixa saudável, decomposição do multiplicador em barras horizontais
 * (1 + fixos + impostos + comissão + margem) e badge divisor × multiplicador.
 * Sem dados → “—” e estado vazio, nunca zero enganoso.
 */
export default function PainelMarkupServicos({
  dadosResumo,
  parametros,
  nomeEmpresa,
  exercicioAno,
}: Props) {
  const painel = useMemo(
    () => calcularPainelMarkup(dadosResumo, parametros),
    [dadosResumo, parametros],
  )
  const dec = painel.decomposicao

  const dadosBarras = useMemo(() => {
    if (!dec) return []
    return [
      { nome: 'Base (1,0)', valor: dec.parcelas.base },
      { nome: 'Fixos rateados', valor: dec.parcelas.despesasFixasPct },
      { nome: 'Impostos', valor: dec.parcelas.impostosPct },
      { nome: 'Comissão', valor: dec.parcelas.comissaoPct },
      { nome: 'Margem', valor: dec.parcelas.margemPct },
    ]
  }, [dec])

  const statusFaixa = useMemo(() => {
    if (!painel.markupMultiplicador) return null
    const m = painel.markupMultiplicador
    if (m < FAIXA_MARKUP_SAUDAVEL.min)
      return { texto: 'Abaixo da faixa saudável', tipo: 'alerta' as const }
    if (m > FAIXA_MARKUP_SAUDAVEL.max)
      return { texto: 'Acima da faixa saudável', tipo: 'alerta' as const }
    return { texto: 'Dentro da faixa saudável', tipo: 'positivo' as const }
  }, [painel.markupMultiplicador])

  const handleExport = () => {
    if (!dec) return
    exportarPainelMarkup(nomeEmpresa, dec, exercicioAno)
  }

  if (!painel.markupMultiplicador || !dec) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Gauge className="h-4 w-4 text-primary" />
            Painel do Mark-up
          </CardTitle>
          <CardDescription>
            Medidor do mark-up multiplicador, decomposição do multiplicador e divergência entre
            divisor e multiplicador.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
          <Gauge className="h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm font-medium">Sem dados de mark-up</p>
          <p className="max-w-md text-xs text-muted-foreground">
            Cadastre os parâmetros (aba “Parâmetros”) e ao menos um serviço com preço calculado (aba
            “Serviços”) para visualizar o mark-up. Enquanto isso: —
          </p>
        </CardContent>
      </Card>
    )
  }

  const divergencia = dec.divergenciaPct
  const divergenciaGrave = divergencia !== null && Math.abs(divergencia) > 5

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Gauge do multiplicador */}
        <Card>
          <CardHeader className="pb-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Gauge className="h-4 w-4 text-primary" />
              Mark-up Multiplicador
            </CardTitle>
            <CardDescription>
              Média ponderada pelos custos · faixa saudável {FAIXA_MARKUP_SAUDAVEL.min}× a{' '}
              {FAIXA_MARKUP_SAUDAVEL.max}×
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            <HodometroGauge
              valor={painel.markupMultiplicador}
              min={1}
              max={3}
              titulo="Mark-up multiplicador"
              unidade="×"
              formatarValor={(v) => `${v.toFixed(2)}×`}
              zonas={[
                { de: 1, ate: FAIXA_MARKUP_SAUDAVEL.min, cor: '#EF4444' },
                { de: FAIXA_MARKUP_SAUDAVEL.min, ate: FAIXA_MARKUP_SAUDAVEL.max, cor: '#10B981' },
                { de: FAIXA_MARKUP_SAUDAVEL.max, ate: 3, cor: '#F59E0B' },
              ]}
              statusTexto={statusFaixa?.texto}
              statusTipo={statusFaixa?.tipo}
              tamanho="md"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Mark-up divisor (teórico):{' '}
              <span className="font-semibold text-foreground">
                {painel.markupDivisor != null ? painel.markupDivisor.toFixed(4) : '—'}
              </span>
            </p>
          </CardContent>
        </Card>

        {/* Decomposição do multiplicador */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-col gap-2 pb-2 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-base">Decomposição do Multiplicador</CardTitle>
              <CardDescription>
                1 + fixos rateados + impostos + comissão + margem ={' '}
                {painel.markupMultiplicador.toFixed(3)}×
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleExport}>
                <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel
              </Button>
              <Button variant="outline" size="sm" onClick={handleExport}>
                <FileText className="mr-2 h-4 w-4" /> CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dadosBarras} layout="vertical" margin={{ left: 8, right: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => v.toFixed(1)}
                  />
                  <YAxis type="category" dataKey="nome" width={110} tick={{ fontSize: 11 }} />
                  <Bar dataKey="valor" radius={[0, 4, 4, 0]} barSize={18}>
                    <LabelList
                      dataKey="valor"
                      position="right"
                      formatter={(v: number) => (Number.isFinite(v) ? `+${v.toFixed(3)}` : '')}
                      style={{ fontSize: 11 }}
                    />
                    {dadosBarras.map((_, i) => (
                      <Cell
                        key={i}
                        fill={['#64748b', '#6d28d9', '#b45309', '#be123c', '#15803d'][i % 5]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Badge divisor × multiplicador */}
      <Card>
        <CardContent className="flex flex-col gap-2 p-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">Divisor × Multiplicador:</span>
            <Badge variant="outline">
              Divisor {painel.markupDivisor != null ? painel.markupDivisor.toFixed(4) : '—'}
            </Badge>
            <Badge variant="outline">Multiplicador {painel.markupMultiplicador.toFixed(4)}</Badge>
            {divergencia !== null && (
              <Badge
                variant="outline"
                className={
                  divergenciaGrave
                    ? 'border-amber-200 bg-amber-50 text-amber-700'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                }
              >
                Divergência {fmtPct(divergencia)}
              </Badge>
            )}
            {divergenciaGrave && (
              <span className="inline-flex items-center gap-1 text-xs text-amber-700">
                <TriangleAlert className="h-3.5 w-3.5" />
                Divergência acima de 5% — revise custos diretos e rateio de fixos.
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Nota: o divisor é teórico (1 ÷ (1 − soma%)) e o multiplicador realizado (preço ÷ custo).
            Serviços com preço 0 ficam fora da média.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
