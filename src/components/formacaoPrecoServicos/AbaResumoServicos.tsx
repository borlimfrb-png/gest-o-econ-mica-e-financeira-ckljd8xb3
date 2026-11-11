import { useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Award, FileSpreadsheet, FileText, TrendingDown, TrendingUp, Wallet } from 'lucide-react'
import type {
  ComposicaoPrecoServico,
  ParametrosFormacaoServicos,
  ServicoFormacao,
} from '@/lib/formacaoPrecoServicosCalculo'

export interface LinhaResumo {
  servico: ServicoFormacao
  composicao: ComposicaoPrecoServico
}

interface Props {
  dadosResumo: LinhaResumo[]
  resultadoParametros: {
    custosFixosMensais: number
    horasProdutivasMes: number
    custoHoraTecnica: number
  }
  parametrosCalculo: ParametrosFormacaoServicos
  onExportExcel: () => void
  onExportCsv: () => void
  exportDesabilitado: boolean
}

const fmtBRL = (v: number) =>
  Number.isFinite(v) ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'
const fmtPct = (v: number) =>
  Number.isFinite(v) ? `${v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%` : '—'

/**
 * Aba "Resumo": síntese executiva da formação de preço de serviços —
 * custo/hora técnica, mark-up ativo, quantidade de serviços, preço médio
 * sugerido, tabela-resumo e destaque do maior/menor preço.
 */
export default function AbaResumoServicos({
  dadosResumo,
  resultadoParametros,
  parametrosCalculo,
  onExportExcel,
  onExportCsv,
  exportDesabilitado,
}: Props) {
  const somaPerc =
    parametrosCalculo.percentual_impostos +
    parametrosCalculo.percentual_comissao +
    parametrosCalculo.percentual_margem
  const markupDivisor = somaPerc < 100 ? 1 / (1 - somaPerc / 100) : 0
  const markupMultiplicador =
    dadosResumo.length > 0
      ? dadosResumo.reduce((acc, l) => acc + l.composicao.markupMultiplicador, 0) /
        dadosResumo.length
      : 0

  const precoMedio = useMemo(() => {
    const comPreco = dadosResumo.filter((l) => l.composicao.precoVendaSugerido > 0)
    if (comPreco.length === 0) return 0
    return comPreco.reduce((acc, l) => acc + l.composicao.precoVendaSugerido, 0) / comPreco.length
  }, [dadosResumo])

  const maior = useMemo(
    () =>
      dadosResumo.length > 0
        ? dadosResumo.reduce((a, b) =>
            b.composicao.precoVendaSugerido > a.composicao.precoVendaSugerido ? b : a,
          )
        : null,
    [dadosResumo],
  )
  const menor = useMemo(
    () =>
      dadosResumo.length > 0
        ? dadosResumo.reduce((a, b) =>
            b.composicao.precoVendaSugerido < a.composicao.precoVendaSugerido ? b : a,
          )
        : null,
    [dadosResumo],
  )

  if (dadosResumo.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
          <Wallet className="h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm font-medium">Nenhum serviço cadastrado</p>
          <p className="max-w-md text-xs text-muted-foreground">
            Cadastre os parâmetros (aba “Parâmetros”) e os serviços (aba “Serviços”) para o Resumo
            montar a síntese de preços, margens e mark-ups. O export de Excel/CSV também depende de
            ao menos um serviço.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Cards de síntese */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Custo/Hora Técnica ativo</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {resultadoParametros.custoHoraTecnica > 0
                ? fmtBRL(resultadoParametros.custoHoraTecnica)
                : '—'}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {fmtBRL(resultadoParametros.custosFixosMensais)} de custos fixos ÷{' '}
            {resultadoParametros.horasProdutivasMes.toLocaleString('pt-BR', {
              maximumFractionDigits: 1,
            })}{' '}
            h produtivas/mês
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Mark-up ativo</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {markupDivisor > 0 ? markupDivisor.toFixed(4) : '—'}
              {markupMultiplicador > 0 && (
                <span className="ml-1 text-sm font-medium text-muted-foreground">
                  ≈ {markupMultiplicador.toFixed(2)}×
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Divisor 1 ÷ (1 − ({fmtPct(parametrosCalculo.percentual_impostos)} +{' '}
            {fmtPct(parametrosCalculo.percentual_comissao)} +{' '}
            {fmtPct(parametrosCalculo.percentual_margem)}) ÷ 100)
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Serviços cadastrados</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{dadosResumo.length}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Preço médio sugerido:{' '}
            <span className="font-semibold text-foreground">{fmtBRL(precoMedio)}</span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Preço médio sugerido</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {precoMedio > 0 ? fmtBRL(precoMedio) : '—'}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Média dos preços de venda dos {dadosResumo.length} serviço(s) com preço &gt; 0
          </CardContent>
        </Card>
      </div>

      {/* Maior / menor preço */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
              Maior preço sugerido
            </CardDescription>
            {maior && (
              <>
                <CardTitle className="text-xl tabular-nums">
                  {fmtBRL(maior.composicao.precoVendaSugerido)}
                </CardTitle>
                <CardDescription className="text-xs">
                  {maior.servico.nome} · {maior.servico.horas_estimadas}h ·{' '}
                  {fmtBRL(maior.composicao.precoVendaHora)}/h · margem efetiva{' '}
                  {fmtPct(maior.composicao.margemEfetivaPct)}
                </CardDescription>
              </>
            )}
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <TrendingDown className="h-4 w-4 text-amber-600" />
              Menor preço sugerido
            </CardDescription>
            {menor && (
              <>
                <CardTitle className="text-xl tabular-nums">
                  {fmtBRL(menor.composicao.precoVendaSugerido)}
                </CardTitle>
                <CardDescription className="text-xs">
                  {menor.servico.nome} · {menor.servico.horas_estimadas}h ·{' '}
                  {fmtBRL(menor.composicao.precoVendaHora)}/h · margem efetiva{' '}
                  {fmtPct(menor.composicao.margemEfetivaPct)}
                </CardDescription>
              </>
            )}
          </CardHeader>
        </Card>
      </div>

      {/* Tabela-resumo dos serviços */}
      <Card>
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Award className="h-4 w-4 text-primary" />
              Síntese dos Serviços
            </CardTitle>
            <CardDescription>
              Preço sugerido pelo mark-up divisor com os parâmetros ativos.
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onExportExcel}
              disabled={exportDesabilitado}
            >
              <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel
            </Button>
            <Button variant="outline" size="sm" onClick={onExportCsv} disabled={exportDesabilitado}>
              <FileText className="mr-2 h-4 w-4" /> CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Serviço</th>
                  <th className="py-2 pr-4 text-right font-medium">Custo total</th>
                  <th className="py-2 pr-4 text-right font-medium">Mark-up (divisor)</th>
                  <th className="py-2 pr-4 text-right font-medium">Impostos</th>
                  <th className="py-2 pr-4 text-right font-medium">Preço sugerido</th>
                  <th className="py-2 text-right font-medium">Margem efetiva</th>
                </tr>
              </thead>
              <tbody>
                {dadosResumo.map(({ servico, composicao: c }) => (
                  <tr key={servico.id} className="border-b last:border-0">
                    <td className="py-2 pr-4">
                      <span className="font-medium">{servico.nome}</span>
                      {servico.descricao && (
                        <span className="block text-xs text-muted-foreground">
                          {servico.descricao}
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {fmtBRL(c.custoTotalServico)}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {c.markupDivisor > 0 ? c.markupDivisor.toFixed(4) : '—'}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">{fmtPct(c.impostosPct)}</td>
                    <td className="py-2 pr-4 text-right font-semibold tabular-nums">
                      {fmtBRL(c.precoVendaSugerido)}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      <Badge
                        variant="outline"
                        className={
                          c.margemEfetivaPct >= parametrosCalculo.percentual_margem
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : 'border-amber-200 bg-amber-50 text-amber-700'
                        }
                      >
                        {fmtPct(c.margemEfetivaPct)}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
