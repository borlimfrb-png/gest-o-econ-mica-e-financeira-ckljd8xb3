import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  calcularPrecoServico,
  calcularSensibilidade,
  type ParametrosFormacaoServicos,
  type ServicoFormacao,
} from '@/lib/formacaoPrecoServicosCalculo'

function formatBrl(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return '—'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val)
}

function formatPct(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return '—'
  return `${val.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
}

const CORES_DECOMPOSICAO: Record<string, string> = {
  maoDeObra: '#1e40af',
  custosDiretos: '#0e7490',
  rateioFixos: '#6d28d9',
  impostos: '#b45309',
  comissao: '#be123c',
  lucro: '#15803d',
}

const ROTULOS_DECOMPOSICAO: Record<string, string> = {
  maoDeObra: 'Mão de Obra (excedente)',
  custosDiretos: 'Custos Diretos',
  rateioFixos: 'Fixos Rateados',
  impostos: 'Impostos',
  comissao: 'Comissão',
  lucro: 'Lucro',
}

interface Props {
  servicos: ServicoFormacao[]
  parametros: ParametrosFormacaoServicos
}

/**
 * Simulador de Preço de Venda de Serviços: composição detalhada, sliders de
 * margem/impostos/comissão com recálculo em tempo real, decomposição em barra
 * empilhada e tabela de sensibilidade.
 */
export default function SimuladorServicosPrecos({ servicos, parametros }: Props) {
  // Overrides locais dos percentuais (recalculam na hora via useMemo)
  const [override, setOverride] = useState<{
    impostos: number | null
    comissao: number | null
    margem: number | null
  }>({ impostos: null, comissao: null, margem: null })
  const [servicoSelecionadoId, setServicoSelecionadoId] = useState<string>('')

  useEffect(() => {
    if (!servicoSelecionadoId && servicos.length > 0) {
      setServicoSelecionadoId(servicos[0].id || '')
    }
    if (servicoSelecionadoId && !servicos.some((s) => s.id === servicoSelecionadoId)) {
      setServicoSelecionadoId(servicos[0]?.id || '')
    }
  }, [servicos, servicoSelecionadoId])

  const servico = servicos.find((s) => s.id === servicoSelecionadoId) || servicos[0]

  const parametrosEfetivos: ParametrosFormacaoServicos = useMemo(
    () => ({
      ...parametros,
      percentual_impostos: override.impostos ?? parametros.percentual_impostos,
      percentual_comissao: override.comissao ?? parametros.percentual_comissao,
      percentual_margem: override.margem ?? parametros.percentual_margem,
    }),
    [parametros, override],
  )

  const composicao = useMemo(
    () => (servico ? calcularPrecoServico(servico, parametrosEfetivos) : null),
    [servico, parametrosEfetivos],
  )

  const sensibilidade = useMemo(
    () => (servico ? calcularSensibilidade(servico, parametrosEfetivos) : []),
    [servico, parametrosEfetivos],
  )

  if (!servico || !composicao) {
    return (
      <Card className="bg-white border-slate-200 shadow-xs">
        <CardContent className="p-8 text-center">
          <p className="text-sm text-slate-500">
            Nenhum serviço cadastrado ainda. Cadastre um serviço na aba{' '}
            <span className="font-semibold">Serviços</span> para usar o simulador.
          </p>
        </CardContent>
      </Card>
    )
  }

  const c = composicao
  const d = c.decomposicao
  const partes = [
    { chave: 'maoDeObra', valor: d.maoDeObra },
    { chave: 'custosDiretos', valor: d.custosDiretos },
    { chave: 'rateioFixos', valor: d.rateioFixos },
    { chave: 'impostos', valor: d.impostos },
    { chave: 'comissao', valor: d.comissao },
    { chave: 'lucro', valor: d.lucro },
  ]
  const totalDecomp = partes.reduce((acc, p) => acc + p.valor, 0) || 1

  const selecionarPercentualTotal = (
    valor: number | null,
    campo: 'impostos' | 'comissao' | 'margem',
  ) => {
    setOverride((prev) => ({ ...prev, [campo]: valor }))
  }

  return (
    <div className="space-y-4">
      {/* Seleção do serviço */}
      <Card className="bg-white border-slate-200 shadow-xs">
        <CardContent className="p-4 flex flex-col md:flex-row md:items-center gap-3">
          <div className="flex-1">
            <Label className="text-xs font-medium text-slate-600">Serviço simulado</Label>
            <select
              value={servicoSelecionadoId}
              onChange={(e) => setServicoSelecionadoId(e.target.value)}
              className="mt-1 h-9 text-sm bg-white border border-slate-300 rounded-lg px-3 text-slate-800 font-medium focus:ring-2 focus:ring-blue-600 focus:outline-none w-full md:w-96"
            >
              {servicos.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome} ({s.horas_estimadas}h)
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-4 md:gap-6">
            <div>
              <p className="text-[11px] text-slate-500 font-medium">Custo Total do Serviço</p>
              <p className="text-lg font-bold text-[#0B1F3A]">{formatBrl(c.custoTotalServico)}</p>
            </div>
            <div>
              <p className="text-[11px] text-slate-500 font-medium">Preço Venda/Hora</p>
              <p className="text-lg font-bold text-blue-700">{formatBrl(c.precoVendaHora)}</p>
            </div>
            <div>
              <p className="text-[11px] text-slate-500 font-medium">Mark-up Divisor</p>
              <p className="text-lg font-bold text-[#0B1F3A]">
                {c.markupDivisor > 0 ? c.markupDivisor.toFixed(3) : '—'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Composição do custo */}
        <Card className="bg-white border-slate-200 shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-[#0B1F3A]">
              Composição do Custo
            </CardTitle>
            <CardDescription className="text-xs">
              Hora técnica × horas estimadas + custos diretos
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between text-sm border-b border-slate-100 pb-1.5">
              <span className="text-slate-600">Custo/Hora Técnica (fixos ÷ horas produtivas)</span>
              <span className="font-semibold text-slate-800">
                {formatBrl(c.custoHoraTecnica)}/h
              </span>
            </div>
            <div className="flex items-center justify-between text-sm border-b border-slate-100 pb-1.5">
              <span className="text-slate-600">
                Mão de obra ({servico.horas_estimadas}h
                {servico.profissionais_envolvidos > 1
                  ? ` × ${servico.profissionais_envolvidos} profissionais`
                  : ''}
                )
              </span>
              <span className="font-semibold text-slate-800">{formatBrl(c.custoMaoDeObra)}</span>
            </div>
            <div className="flex items-center justify-between text-sm border-b border-slate-100 pb-1.5">
              <span className="text-slate-600">Custos diretos (materiais/terceiros)</span>
              <span className="font-semibold text-slate-800">{formatBrl(c.custosDiretos)}</span>
            </div>
            <div className="flex items-center justify-between text-sm pt-1">
              <span className="font-semibold text-[#0B1F3A]">Custo Total do Serviço</span>
              <span className="font-bold text-[#0B1F3A]">{formatBrl(c.custoTotalServico)}</span>
            </div>
            <div className="mt-2 rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600 space-y-1">
              <p className="font-semibold text-slate-700">Mark-up divisor</p>
              <p>
                Preço = Custo ÷ (1 − ({formatPct(c.impostosPct)} + {formatPct(c.comissaoPct)} +{' '}
                {formatPct(c.margemPct)}) ÷ 100) = {formatBrl(c.custoTotalServico)} ÷{' '}
                {c.markupDivisor > 0 ? (1 / c.markupDivisor).toFixed(4) : '—'}
              </p>
              <p>
                <span className="font-semibold">Mark-up multiplicador (informativo):</span> preço ÷
                custo = {c.markupMultiplicador > 0 ? `${c.markupMultiplicador.toFixed(3)}×` : '—'} —
                equivalente a um mark-up de{' '}
                {c.markupMultiplicador > 0
                  ? `${((c.markupMultiplicador - 1) * 100).toFixed(1)}%`
                  : '—'}{' '}
                sobre o custo.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Preço sugerido + sliders */}
        <Card className="bg-white border-slate-200 shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-[#0B1F3A]">
              Preço de Venda Sugerido
            </CardTitle>
            <CardDescription className="text-xs">
              Ajuste os percentuais — o preço recalcula na hora
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl bg-[#0B1F3A] text-white p-4">
              <p className="text-[11px] text-blue-200 font-medium uppercase tracking-wide">
                Preço de Venda Sugerido (total)
              </p>
              <p className="text-3xl font-bold mt-0.5">{formatBrl(c.precoVendaSugerido)}</p>
              <p className="text-xs text-blue-200 mt-1">
                {formatBrl(c.precoVendaHora)} por hora · {servico.horas_estimadas}h de serviço
              </p>
            </div>

            {(
              [
                { campo: 'impostos', label: 'Impostos (%)', base: parametros.percentual_impostos },
                { campo: 'comissao', label: 'Comissão (%)', base: parametros.percentual_comissao },
                {
                  campo: 'margem',
                  label: 'Margem de Lucro (%)',
                  base: parametros.percentual_margem,
                },
              ] as const
            ).map(({ campo, label, base }) => {
              const valorAtual = override[campo] ?? base
              return (
                <div key={campo}>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium text-slate-600">{label}</Label>
                    <span className="text-xs font-semibold text-slate-800">
                      {formatPct(valorAtual)}
                    </span>
                  </div>
                  <Slider
                    value={[valorAtual]}
                    min={0}
                    max={campo === 'margem' ? 60 : 40}
                    step={0.5}
                    onValueChange={(vals) => selecionarPercentualTotal(vals[0] ?? 0, campo)}
                    className="mt-2"
                  />
                  {override[campo] !== null && override[campo] !== base && (
                    <button
                      type="button"
                      onClick={() => selecionarPercentualTotal(null, campo)}
                      className="text-[11px] text-blue-700 hover:underline mt-0.5"
                    >
                      Voltar ao parâmetro cadastrado ({formatPct(base)})
                    </button>
                  )}
                </div>
              )
            })}
          </CardContent>
        </Card>
      </div>

      {/* Decomposição — barra empilhada */}
      <Card className="bg-white border-slate-200 shadow-xs">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold text-[#0B1F3A]">
            Decomposição do Preço de Venda
          </CardTitle>
          <CardDescription className="text-xs">
            Cada componente em R$ e % do preço — soma = preço de venda
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-8 w-full rounded-lg overflow-hidden border border-slate-200">
            {partes.map((p) => (
              <div
                key={p.chave}
                style={{
                  width: `${(p.valor / totalDecomp) * 100}%`,
                  backgroundColor: CORES_DECOMPOSICAO[p.chave],
                }}
                title={`${ROTULOS_DECOMPOSICAO[p.chave]}: ${formatBrl(p.valor)}`}
              />
            ))}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-3">
            {partes.map((p) => (
              <div
                key={p.chave}
                className="flex items-center gap-2 rounded-lg border border-slate-100 px-2 py-1.5"
              >
                <span
                  className="w-3 h-3 rounded shrink-0"
                  style={{ backgroundColor: CORES_DECOMPOSICAO[p.chave] }}
                />
                <span className="text-xs text-slate-600 flex-1">
                  {ROTULOS_DECOMPOSICAO[p.chave]}
                </span>
                <span className="text-xs font-semibold text-slate-800">{formatBrl(p.valor)}</span>
                <Badge variant="outline" className="text-[10px] px-1 py-0">
                  {((p.valor / totalDecomp) * 100).toFixed(1)}%
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tabela de sensibilidade */}
      <Card className="bg-white border-slate-200 shadow-xs">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold text-[#0B1F3A]">
            Sensibilidade do Preço × Margem
          </CardTitle>
          <CardDescription className="text-xs">
            Preço de venda para margens de 10%, 20%, 30% e a margem alvo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Margem de Lucro</TableHead>
                <TableHead className="text-xs text-right">Preço Total (R$)</TableHead>
                <TableHead className="text-xs text-right">Preço por Hora (R$)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sensibilidade.map((s) => (
                <TableRow key={s.margem}>
                  <TableCell className="text-sm font-medium">
                    {s.margem === c.margemPct ? (
                      <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
                        {formatPct(s.margem)} (alvo)
                      </Badge>
                    ) : (
                      formatPct(s.margem)
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-right font-semibold text-[#0B1F3A]">
                    {formatBrl(s.preco)}
                  </TableCell>
                  <TableCell className="text-sm text-right text-slate-600">
                    {formatBrl(s.precoHora)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
