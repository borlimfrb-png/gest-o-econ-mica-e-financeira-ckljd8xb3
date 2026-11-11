import { useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FileSpreadsheet, FileText, FlasksConical, Layers, Scale, TrendingUp } from 'lucide-react'
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
  calcularSensibilidade,
  calcularComparativoServicos,
} from '@/lib/formacaoPrecoServicosRelatorios'
import {
  exportarEstruturaPreco,
  exportarSensibilidade,
  exportarComparativoServicos,
} from '@/lib/formacaoPrecoServicosRelatoriosExport'

interface Props {
  dadosResumo: LinhaResumo[]
  parametros: ParametrosFormacaoServicos
  nomeEmpresa: string
  exercicioAno?: number
}

type Relatorio = 'estrutura' | 'sensibilidade' | 'comparativo'

const CORES_ESTRUTURA = ['#6d28d9', '#0ea5e9', '#b45309', '#be123c', '#15803d']

const fmtMoeda = (v: number) =>
  Number.isFinite(v) ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'
const fmtPct = (v: number | null, casas = 2) =>
  v !== null && Number.isFinite(v)
    ? `${v.toLocaleString('pt-BR', { maximumFractionDigits: casas })}%`
    : '—'

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

  const estrutura = useMemo(
    () => calcularEstruturaPreco(dadosResumo, parametros),
    [dadosResumo, parametros],
  )
  const sensibilidade = useMemo(
    () => calcularSensibilidade(dadosResumo, parametros),
    [dadosResumo, parametros],
  )
  const comparativo = useMemo(
    () => calcularComparativoServicos(dadosResumo, parametros),
    [dadosResumo, parametros],
  )

  const semDados = estrutura.length === 0

  // Gráfico: barras empilhadas (100%) da composição por serviço
  const dadosGrafico = useMemo(
    () =>
      estrutura.map((e) => ({
        nome: e.nomeServico,
        'Custo direto': e.custoDiretoPct,
        'Fixos rateados': e.despesasFixasPct,
        Impostos: e.impostosPct,
        Comissão: e.comissaoPct,
        Margem: e.margemPct,
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

  const selecionar = (r: Relatorio) => {
    setSelecionado(r)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Seletor de relatório */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={selecionado === 'estrutura' ? 'default' : 'outline'}
          size="sm"
          onClick={() => selecionar('estrutura')}
        >
          <Layers className="mr-2 h-4 w-4" /> Estrutura de Preço
        </Button>
        <Button
          variant={selecionado === 'sensibilidade' ? 'default' : 'outline'}
          size="sm"
          onClick={() => selecionar('sensibilidade')}
        >
          <FlasksConical className="mr-2 h-4 w-4" /> Sensibilidade
        </Button>
        <Button
          variant={selecionado === 'comparativo' ? 'default' : 'outline'}
          size="sm"
          onClick={() => selecionar('comparativo')}
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
                  Composição percentual do preço de cada serviço: custo direto, fixos rateados,
                  impostos, comissão e margem.
                </CardDescription>
              </div>
              <BotoesExport
                onExcel={() => exportarEstruturaPreco(nomeEmpresa, estrutura, exercicioAno)}
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
                    <Bar dataKey="Custo direto" stackId="a" fill={CORES_ESTRUTURA[0]} />
                    <Bar dataKey="Fixos rateados" stackId="a" fill={CORES_ESTRUTURA[1]} />
                    <Bar dataKey="Impostos" stackId="a" fill={CORES_ESTRUTURA[2]} />
                    <Bar dataKey="Comissão" stackId="a" fill={CORES_ESTRUTURA[3]} />
                    <Bar
                      dataKey="Margem"
                      stackId="a"
                      fill={CORES_ESTRUTURA[4]}
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Nota metodológica: percentuais sobre o preço sugerido por serviço; a soma fecha em
                100% (custo + rateio de fixos + impostos + comissão + margem).
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
                      <th className="px-3 py-2 text-right">Custo direto %</th>
                      <th className="px-3 py-2 text-right">Fixos %</th>
                      <th className="px-3 py-2 text-right">Impostos %</th>
                      <th className="px-3 py-2 text-right">Comissão %</th>
                      <th className="px-3 py-2 text-right">Margem %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {estrutura.map((e) => (
                      <tr key={e.idServico} className="border-b last:border-0">
                        <td className="px-3 py-2 font-medium">{e.nomeServico}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {fmtMoeda(e.precoSugerido)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {fmtPct(e.custoDiretoPct)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {fmtPct(e.despesasFixasPct)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {fmtPct(e.impostosPct)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {fmtPct(e.comissaoPct)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtPct(e.margemPct)}</td>
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
              onExcel={() => exportarSensibilidade(nomeEmpresa, sensibilidade, exercicioAno)}
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
                  {sensibilidade.map((linha) => (
                    <tr
                      key={`${linha.idServico}-${linha.cenario}`}
                      className="border-b last:border-0"
                    >
                      <td className="px-3 py-2 font-medium">{linha.nomeServico}</td>
                      <td className="px-3 py-2">
                        {linha.cenario === 'base' ? (
                          <Badge variant="outline">Base</Badge>
                        ) : (
                          linha.cenario
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtMoeda(linha.preco)}</td>
                      <td
                        className={`px-3 py-2 text-right tabular-nums ${
                          linha.deltaPreco > 0
                            ? 'text-emerald-600'
                            : linha.deltaPreco < 0
                              ? 'text-red-600'
                              : 'text-muted-foreground'
                        }`}
                      >
                        {linha.deltaPreco === 0 ? '—' : fmtMoeda(linha.deltaPreco)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {fmtPct(linha.margemPct)}
                      </td>
                      <td
                        className={`px-3 py-2 text-right tabular-nums ${
                          (linha.deltaMargemPp ?? 0) > 0
                            ? 'text-emerald-600'
                            : (linha.deltaMargemPp ?? 0) < 0
                              ? 'text-red-600'
                              : 'text-muted-foreground'
                        }`}
                      >
                        {linha.deltaMargemPp === null ? '—' : fmtPct(linha.deltaMargemPp)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Nota metodológica: cenários variam um componente por vez sobre os parâmetros vigentes.
              O custo/hora ±10% simula variação de produtividade/custos fixos com horas constantes.
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
                  Ranking por margem percentual e preço sugerido × ponto de equilíbrio (custo/hora
                  técnica).
                </CardDescription>
              </div>
              <BotoesExport
                onExcel={() => exportarComparativoServicos(nomeEmpresa, comparativo, exercicioAno)}
                onCsv={() => exportarComparativoServicosCsv(nomeEmpresa, comparativo, exercicioAno)}
              />
            </CardHeader>
            <CardContent>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={comparativo
                      .slice()
                      .sort((a, b) => b.margemPct - a.margemPct)
                      .map((c) => ({
                        nome: c.nomeServico,
                        'Margem %': Number(c.margemPct.toFixed(2)),
                      }))}
                    margin={{ top: 8, right: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="nome" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => `${Number(v).toFixed(2)}%`} />
                    <Bar dataKey="Margem %" radius={[4, 4, 0, 0]}>
                      {comparativo
                        .slice()
                        .sort((a, b) => b.margemPct - a.margemPct)
                        .map((c) => (
                          <Cell
                            key={c.idServico}
                            fill={c.abaixoMargemAlvo ? '#b45309' : '#15803d'}
                          />
                        ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Nota metodológica: ranking pela margem percentual realizada sobre o preço. Barras em
                âmbar indicam serviços abaixo da margem alvo ({parametros.percentual_margem}%).
                Comparação de preço: sugerido × ponto de equilíbrio (custo/hora técnica × horas).
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
                      <th className="px-3 py-2 text-right">Ponto equilíbrio</th>
                      <th className="px-3 py-2 text-right">Folga</th>
                      <th className="px-3 py-2 text-right">Margem %</th>
                      <th className="px-3 py-2 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparativo.map((c, i) => (
                      <tr key={c.idServico} className="border-b last:border-0">
                        <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                        <td className="px-3 py-2 font-medium">{c.nomeServico}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {fmtMoeda(c.precoSugerido)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {fmtMoeda(c.pontoEquilibrio)}
                        </td>
                        <td
                          className={`px-3 py-2 text-right tabular-nums ${
                            (c.folgaSobreEquilibrio ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-600'
                          }`}
                        >
                          {c.folgaSobreEquilibrio === null ? '—' : fmtMoeda(c.folgaSobreEquilibrio)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtPct(c.margemPct)}</td>
                        <td className="px-3 py-2 text-right">
                          {c.abaixoMargemAlvo ? (
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
