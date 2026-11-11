import { useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FileSpreadsheet, FileText, FlaskConical, Layers, Scale, TrendingUp } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { LinhaResumo } from '@/lib/formacaoPrecoServicosRelatorios'
import type { ParametrosFormacaoServicos } from '@/lib/formacaoPrecoServicosCalculo'
import {
  calcularEstruturaPreco,
  calcularSensibilidadeComponentes,
  calcularComparativoServicos,
} from '@/lib/formacaoPrecoServicosRelatorios'
import {
  exportarEstruturaPrecoExcel,
  exportarEstruturaPrecoCsv,
  exportarSensibilidadeExcel,
  exportarSensibilidadeCsv,
  exportarComparativoExcel,
  exportarComparativoCsv,
} from '@/lib/formacaoPrecoServicosRelatoriosExport'

interface Props {
  dadosResumo: LinhaResumo[]
  parametros: ParametrosFormacaoServicos
  nomeEmpresa: string
  exercicioAno?: number
}

type Relatorio = 'estrutura' | 'sensibilidade' | 'comparativo'

const CORES_ESTRUTURA: Record<string, string> = {
  maoDeObra: '#6d28d9',
  custosDiretos: '#0ea5e9',
  rateioFixos: '#b45309',
  impostos: '#be123c',
  comissao: '#0891b2',
  lucro: '#15803d',
}

const fmtMoeda = (v: number) =>
  Number.isFinite(v) ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'
const fmtPct = (v: number, casas = 2) =>
  Number.isFinite(v) ? `${v.toLocaleString('pt-BR', { maximumFractionDigits: casas })}%` : '—'

function BotoesExport({
  onExcel,
  onCsv,
  desabilitado,
}: {
  onExcel: () => void
  onCsv: () => void
  desabilitado?: boolean
}) {
  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" onClick={onExcel} disabled={desabilitado}>
        <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel
      </Button>
      <Button variant="outline" size="sm" onClick={onCsv} disabled={desabilitado}>
        <FileText className="mr-2 h-4 w-4" /> CSV
      </Button>
    </div>
  )
}

/**
 * Aba Relatórios da Formação de Preço de Serviços:
 * 1) Estrutura de Preço (composição % do preço por serviço, barras empilhadas);
 * 2) Sensibilidade de Preço (impostos ±2pp, comissão ±1pp, custo/hora ±10%);
 * 3) Comparativo de Serviços (ranking por margem, preço × equilíbrio, abaixo do alvo).
 */
export default function AbaRelatoriosServicos({
  dadosResumo,
  parametros,
  nomeEmpresa,
  exercicioAno,
}: Props) {
  const [selecionado, setSelecionado] = useState<Relatorio>('estrutura')

  const estrutura = useMemo(() => calcularEstruturaPreco(dadosResumo), [dadosResumo])
  const sensibilidade = useMemo(
    () => dadosResumo.map(({ servico }) => calcularSensibilidadeComponentes(servico, parametros)),
    [dadosResumo, parametros],
  )
  const comparativo = useMemo(
    () => calcularComparativoServicos(dadosResumo, parametros.percentual_margem),
    [dadosResumo, parametros.percentual_margem],
  )

  const semDados = estrutura.length === 0

  // Gráfico: barras empilhadas (100%) da composição por serviço
  const dadosGrafico = useMemo(
    () =>
      estrutura.map((e) => ({
        nome: e.nomeServico,
        'Mão de Obra': Number(e.percentuais.maoDeObra.toFixed(2)),
        'Custos Diretos': Number(e.percentuais.custosDiretos.toFixed(2)),
        'Fixos Rateados': Number(e.percentuais.rateioFixos.toFixed(2)),
        Impostos: Number(e.percentuais.impostos.toFixed(2)),
        Comissão: Number(e.percentuais.comissao.toFixed(2)),
        Margem: Number(e.percentuais.lucro.toFixed(2)),
      })),
    [estrutura],
  )

  if (semDados) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Layers className="h-4 w-4 text-primary" />
            Relatórios de Formação de Preço
          </CardTitle>
          <CardDescription>
            Estrutura de preço, sensibilidade e comparativo entre serviços.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
          <Layers className="h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm font-medium">Sem serviços calculados</p>
          <p className="max-w-md text-xs text-muted-foreground">
            Cadastre os parâmetros e os serviços para gerar os relatórios. Enquanto isso: —
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Seletor de relatório */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={selecionado === 'estrutura' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSelecionado('estrutura')}
        >
          <Layers className="mr-2 h-4 w-4" /> Estrutura de Preço
        </Button>
        <Button
          variant={selecionado === 'sensibilidade' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSelecionado('sensibilidade')}
        >
          <FlaskConical className="mr-2 h-4 w-4" /> Sensibilidade
        </Button>
        <Button
          variant={selecionado === 'comparativo' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSelecionado('comparativo')}
        >
          <Scale className="mr-2 h-4 w-4" /> Comparativo
        </Button>
      </div>

      {/* 1) Estrutura de preço */}
      {selecionado === 'estrutura' && (
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader className="flex flex-col gap-2 pb-2 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="text-base">Relatório de Estrutura de Preço</CardTitle>
                <CardDescription>
                  Composição percentual do preço de cada serviço: mão de obra, custos diretos, fixos
                  rateados, impostos, comissão e margem.
                </CardDescription>
              </div>
              <BotoesExport
                onExcel={() => exportarEstruturaPrecoExcel(nomeEmpresa, estrutura, exercicioAno)}
                onCsv={() => exportarEstruturaPrecoCsv(nomeEmpresa, estrutura, exercicioAno)}
              />
            </CardHeader>
            <CardContent>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dadosGrafico} margin={{ top: 8, right: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="nome" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} unit="%" />
                    <Tooltip formatter={(v) => `${Number(v).toFixed(2)}%`} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    {(
                      [
                        'Mão de Obra',
                        'Custos Diretos',
                        'Fixos Rateados',
                        'Impostos',
                        'Comissão',
                        'Margem',
                      ] as const
                    ).map((chave, i) => (
                      <Bar
                        key={chave}
                        dataKey={chave}
                        stackId="a"
                        fill={Object.values(CORES_ESTRUTURA)[i]}
                        radius={i === 5 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Nota metodológica: percentuais sobre o preço sugerido por serviço; a soma fecha em
                100% (mão de obra + custos diretos + fixos rateados + impostos + comissão + margem).
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-3 py-2">Serviço</th>
                      <th className="px-3 py-2 text-right">Preço</th>
                      <th className="px-3 py-2 text-right">Mão de obra %</th>
                      <th className="px-3 py-2 text-right">Custos diretos %</th>
                      <th className="px-3 py-2 text-right">Fixos %</th>
                      <th className="px-3 py-2 text-right">Impostos %</th>
                      <th className="px-3 py-2 text-right">Comissão %</th>
                      <th className="px-3 py-2 text-right">Margem %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {estrutura.map((e) => (
                      <tr key={e.servicoId} className="border-b last:border-0">
                        <td className="px-3 py-2 font-medium">{e.nomeServico}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {fmtMoeda(e.precoVendaSugerido)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {fmtPct(e.percentuais.maoDeObra)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {fmtPct(e.percentuais.custosDiretos)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {fmtPct(e.percentuais.rateioFixos)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {fmtPct(e.percentuais.impostos)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {fmtPct(e.percentuais.comissao)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {fmtPct(e.percentuais.lucro)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 2) Sensibilidade */}
      {selecionado === 'sensibilidade' && (
        <Card>
          <CardHeader className="flex flex-col gap-2 pb-2 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-base">Relatório de Sensibilidade de Preço</CardTitle>
              <CardDescription>
                Impacto no preço sugerido e na margem ao variar impostos (±2 p.p.), comissão (±1
                p.p.) e custo/hora (±10%).
              </CardDescription>
            </div>
            <BotoesExport
              onExcel={() => exportarSensibilidadeExcel(nomeEmpresa, sensibilidade, exercicioAno)}
              onCsv={() => exportarSensibilidadeCsv(nomeEmpresa, sensibilidade, exercicioAno)}
            />
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2">Serviço</th>
                    <th className="px-3 py-2">Cenário</th>
                    <th className="px-3 py-2 text-right">Preço</th>
                    <th className="px-3 py-2 text-right">Δ Preço</th>
                    <th className="px-3 py-2 text-right">Margem %</th>
                    <th className="px-3 py-2 text-right">Δ Margem (p.p.)</th>
                  </tr>
                </thead>
                <tbody>
                  {sensibilidade.flatMap((s) => (
                    <FragmentSensibilidade key={s.servicoId} sensibilidade={s} />
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Nota metodológica: cada cenário varia um componente por vez sobre os parâmetros
              vigentes. O custo/hora ±10% simula variação dos custos fixos com horas constantes.
            </p>
          </CardContent>
        </Card>
      )}

      {/* 3) Comparativo */}
      {selecionado === 'comparativo' && (
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader className="flex flex-col gap-2 pb-2 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="text-base">Relatório Comparativo de Serviços</CardTitle>
                <CardDescription>
                  Ranking por margem efetiva e preço sugerido × ponto de equilíbrio por hora.
                </CardDescription>
              </div>
              <BotoesExport
                onExcel={() =>
                  exportarComparativoExcel(
                    nomeEmpresa,
                    comparativo,
                    parametros.percentual_margem,
                    exercicioAno,
                  )
                }
                onCsv={() =>
                  exportarComparativoCsv(
                    nomeEmpresa,
                    comparativo,
                    parametros.percentual_margem,
                    exercicioAno,
                  )
                }
              />
            </CardHeader>
            <CardContent>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={comparativo.map((c) => ({
                      servicoId: c.servicoId,
                      nome: c.nomeServico,
                      'Margem %': Number(c.margemEfetivaPct.toFixed(2)),
                    }))}
                    margin={{ top: 8, right: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="nome" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} unit="%" />
                    <Tooltip formatter={(v) => `${Number(v).toFixed(2)}%`} />
                    <Bar dataKey="Margem %" radius={[4, 4, 0, 0]}>
                      {comparativo.map((c) => (
                        <Cell
                          key={c.servicoId}
                          fill={c.abaixoDaMargemAlvo ? '#b45309' : '#15803d'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Nota metodológica: ranking pela margem efetiva sobre o preço. Barras em âmbar
                indicam serviços abaixo da margem alvo ({fmtPct(parametros.percentual_margem)}).
                Folga = preço/hora − ponto de equilíbrio por hora.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-3 py-2">#</th>
                      <th className="px-3 py-2">Serviço</th>
                      <th className="px-3 py-2 text-right">Preço sugerido</th>
                      <th className="px-3 py-2 text-right">Preço/hora</th>
                      <th className="px-3 py-2 text-right">Equilíbrio (R$/h)</th>
                      <th className="px-3 py-2 text-right">Folga</th>
                      <th className="px-3 py-2 text-right">Margem %</th>
                      <th className="px-3 py-2 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparativo.map((c) => (
                      <tr key={c.servicoId} className="border-b last:border-0">
                        <td className="px-3 py-2 text-muted-foreground">{c.ranking}</td>
                        <td className="px-3 py-2 font-medium">{c.nomeServico}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {fmtMoeda(c.precoSugerido)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {fmtMoeda(c.precoHora)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {fmtMoeda(c.pontoEquilibrioHora)}
                        </td>
                        <td
                          className={`px-3 py-2 text-right tabular-nums ${
                            c.folgaSobreEquilibrio >= 0 ? 'text-emerald-600' : 'text-red-600'
                          }`}
                        >
                          {fmtMoeda(c.folgaSobreEquilibrio)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {fmtPct(c.margemEfetivaPct)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {c.abaixoDaMargemAlvo ? (
                            <Badge
                              variant="outline"
                              className="border-amber-200 bg-amber-50 text-amber-700"
                            >
                              Abaixo do alvo
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="border-emerald-200 bg-emerald-50 text-emerald-700"
                            >
                              <TrendingUp className="mr-1 h-3 w-3" /> No alvo
                            </Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

/** Bloco de linhas da sensibilidade de um serviço (base + 6 cenários). */
function FragmentSensibilidade({
  sensibilidade: s,
}: {
  sensibilidade: ReturnType<typeof calcularSensibilidadeComponentes>
}) {
  return (
    <>
      <tr className="border-b bg-muted/30">
        <td className="px-3 py-2 font-medium">{s.nomeServico}</td>
        <td className="px-3 py-2">
          <Badge variant="outline">Base</Badge>
        </td>
        <td className="px-3 py-2 text-right tabular-nums">{fmtMoeda(s.precoBase)}</td>
        <td className="px-3 py-2 text-right text-muted-foreground">—</td>
        <td className="px-3 py-2 text-right tabular-nums">{fmtPct(s.margemBasePct)}</td>
        <td className="px-3 py-2 text-right text-muted-foreground">—</td>
      </tr>
      {s.cenarios.map((c) => (
        <tr key={`${s.servicoId}-${c.cenario}`} className="border-b last:border-0">
          <td className="px-3 py-2">{s.nomeServico}</td>
          <td className="px-3 py-2">{c.cenario}</td>
          <td className="px-3 py-2 text-right tabular-nums">{fmtMoeda(c.precoSugerido)}</td>
          <td
            className={`px-3 py-2 text-right tabular-nums ${
              c.deltaPreco > 0
                ? 'text-emerald-600'
                : c.deltaPreco < 0
                  ? 'text-red-600'
                  : 'text-muted-foreground'
            }`}
          >
            {c.deltaPreco === 0 ? '—' : fmtMoeda(c.deltaPreco)}
          </td>
          <td className="px-3 py-2 text-right tabular-nums">{fmtPct(c.margemEfetivaPct)}</td>
          <td
            className={`px-3 py-2 text-right tabular-nums ${
              c.deltaMargemPp > 0
                ? 'text-emerald-600'
                : c.deltaMargemPp < 0
                  ? 'text-red-600'
                  : 'text-muted-foreground'
            }`}
          >
            {c.deltaMargemPp === 0 ? '—' : fmtPct(c.deltaMargemPp)}
          </td>
        </tr>
      ))}
    </>
  )
}
