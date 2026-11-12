import { useCallback, useEffect, useMemo, useState } from 'react'
import pb from '@/lib/pocketbase/client'
import type { SegmentoEmpresa } from '@/types/finance'
import { useAuth } from '@/contexts/AuthContext'
import { useMinhaEmpresa } from '@/contexts/MinhaEmpresaContext'
import { useToast } from '@/hooks/use-toast'
import { resolverReferenciaMercado } from '@/components/indicadores/benchmarkHub'
import {
  analisarPlanejamentoEconomico,
  carregarEmpresasEAnos,
  montarPayloadPlanejamento,
  type EmpresaAnosDisponiveis,
  type PlanejamentoEconomicoAnalise,
} from '@/services/planejamentoEconomicoService'
import {
  exportarCsvPlanejamento,
  exportarXlsxPlanejamento,
} from '@/lib/planejamentoEconomicoExport'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { TooltipProvider } from '@/components/ui/tooltip'
import {
  BrainCircuit,
  Building2,
  CalendarClock,
  Download,
  FileSpreadsheet,
  Loader2,
  RefreshCw,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from 'lucide-react'

type StatusExecucao = 'ocioso' | 'carregando' | 'concluido' | 'erro'

const fmtBRL = (v: number) =>
  (Number.isFinite(v) ? v : 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const fmtPct = (v: number | null) =>
  v === null || !Number.isFinite(v)
    ? '—'
    : `${v > 0 ? '+' : ''}${v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`

export default function PlanejamentoEconomico() {
  useAuth() // garante guarda de perfil já aplicada pela rota
  const { minhaEmpresa } = useMinhaEmpresa()
  const { toast } = useToast()

  const [empresasAnos, setEmpresasAnos] = useState<EmpresaAnosDisponiveis[]>([])
  const [empresaId, setEmpresaId] = useState<string>('')
  const [anoBase, setAnoBase] = useState<number | null>(null)
  const [planejamento, setPlanejamento] = useState<PlanejamentoEconomicoAnalise | null>(null)
  const [status, setStatus] = useState<StatusExecucao>('ocioso')
  const [erroMsg, setErroMsg] = useState<string>('')
  const [regenerado, setRegenerado] = useState<boolean | null>(null)
  const [carregandoLista, setCarregandoLista] = useState(true)

  const empresaNome = useMemo(
    () => empresasAnos.find((e) => e.empresa === empresaId)?.empresaNome || '',
    [empresasAnos, empresaId],
  )

  // Anos fechados (com Dezembro lançado) dos últimos 3 + o ano aberto mais recente
  const anosSelecionaveis = useMemo(() => {
    const ea = empresasAnos.find((e) => e.empresa === empresaId)
    if (!ea) return [] as { ano: number; fechado: boolean }[]
    const lista: { ano: number; fechado: boolean }[] = []
    for (const a of ea.anosFechados) lista.push({ ano: a, fechado: true })
    for (const a of ea.anosAbertos)
      if (!ea.anosFechados.includes(a)) lista.push({ ano: a, fechado: false })
    return lista.sort((x, y) => y.ano - x.ano)
  }, [empresasAnos, empresaId])

  const carregarSalvos = useCallback(async (empId: string) => {
    setCarregandoLista(true)
    try {
      const resp = await pb.collection('planejamento_economico').getList(1, 1, {
        filter: `empresa = '${empId}'`,
        sort: '-ano_base',
      })
      if (resp.items.length > 0) {
        setPlanejamento(resp.items[0] as unknown as PlanejamentoEconomicoAnalise)
        setAnoBase(resp.items[0].ano_base)
        setRegenerado(null)
      } else {
        setPlanejamento(null)
      }
    } catch {
      setPlanejamento(null)
    } finally {
      setCarregandoLista(false)
    }
  }, [])

  useEffect(() => {
    ;(async () => {
      try {
        const lista = await carregarEmpresasEAnos()
        setEmpresasAnos(lista)
        const inicial = lista.find((e) => e.empresa === minhaEmpresa?.id) || lista[0]
        if (inicial) {
          setEmpresaId(inicial.empresa)
          await carregarSalvos(inicial.empresa)
          if (inicial.anosAbertos.length > 0)
            setAnoBase(inicial.anosAbertos[inicial.anosAbertos.length - 1])
          else if (inicial.anosFechados.length > 0) setAnoBase(inicial.anosFechados[0])
        } else {
          setCarregandoLista(false)
        }
      } catch {
        setCarregandoLista(false)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const trocarEmpresa = async (id: string) => {
    setEmpresaId(id)
    setPlanejamento(null)
    setStatus('ocioso')
    setErroMsg('')
    const ea = empresasAnos.find((e) => e.empresa === id)
    if (ea?.anosAbertos.length) setAnoBase(ea.anosAbertos[ea.anosAbertos.length - 1])
    else if (ea?.anosFechados.length) setAnoBase(ea.anosFechados[ea.anosFechados.length - 1])
    await carregarSalvos(id)
  }

  const executarAnalise = async (forcarRegenerar = false) => {
    if (!empresaId || anoBase === null) return
    setStatus('carregando')
    setErroMsg('')
    setRegenerado(null)
    try {
      const ea = empresasAnos.find((e) => e.empresa === empresaId)
      let segmentoEmpresa: SegmentoEmpresa | null = null
      try {
        const rec = await pb
          .collection('empresas')
          .getOne<{ segmento?: SegmentoEmpresa }>(empresaId)
        segmentoEmpresa = rec?.segmento ?? null
      } catch {
        segmentoEmpresa = null
      }
      const ref = await resolverReferenciaMercado(segmentoEmpresa, empresaId)
      const rotulo = ref?.rotuloSetor || 'Benchmark setorial'
      const benchmark = {
        margem_bruta: ref?.margemBruta ?? null,
        margem_operacional: ref?.margemOperacional ?? null,
        margem_ebitda: ref?.margemEbitda ?? null,
        margem_liquida: ref?.margemLiquida ?? null,
      }
      const payload = await montarPayloadPlanejamento({
        empresaId,
        empresaNome: ea?.empresaNome || '',
        anoBase,
        benchmarkRotulo: rotulo,
        benchmark,
      })
      if (payload.contas.length === 0) {
        throw new Error(
          'Nenhum dado do DRE Gerencial encontrado para esta empresa nos anos selecionados.',
        )
      }
      const { planejamento: resultado, regenerado: foiRegenerado } =
        await analisarPlanejamentoEconomico(payload, { forcarRegenerar })
      setPlanejamento(resultado)
      setRegenerado(foiRegenerado)
      setStatus('concluido')
      toast({
        title: foiRegenerado ? 'Planejamento gerado' : 'Planejamento reaberto',
        description: `Projeção de ${resultado.ano_projecao} salva para ${resultado.benchmark_rotulo || 'benchmark setorial'}.`,
      })
    } catch (err) {
      setStatus('erro')
      setErroMsg(err instanceof Error ? err.message : 'Erro inesperado ao rodar a análise.')
    }
  }

  const baixarCsv = () => planejamento && exportarCsvPlanejamento(planejamento, empresaNome)
  const baixarXlsx = () => planejamento && exportarXlsxPlanejamento(planejamento, empresaNome)

  const contasPorClassificacao = useMemo(() => {
    const mapa = new Map<string, PlanejamentoEconomicoAnalise['contas']>()
    for (const c of planejamento?.contas ?? []) {
      if (!mapa.has(c.classificacao)) mapa.set(c.classificacao, [])
      mapa.get(c.classificacao)!.push(c)
    }
    return mapa
  }, [planejamento])

  const topImpacto = useMemo(() => {
    if (!planejamento) return []
    return [...planejamento.contas]
      .filter((c) => c.classificacao !== 'Receita')
      .map((c) => ({ ...c, impacto: Math.abs(c.valor_projetado - c.atual) }))
      .sort((a, b) => b.impacto - a.impacto)
      .slice(0, 5)
  }, [planejamento])

  return (
    <TooltipProvider delayDuration={200}>
      <div className="container mx-auto space-y-6 p-4 md:p-6">
        {/* Cabeçalho */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2.5">
              <BrainCircuit className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight md:text-2xl">
                Planejamento Econômico
              </h1>
              <p className="text-sm text-muted-foreground">
                Agente de IA que analisa o DRE Gerencial (3 últimos anos + ano atual) conta por
                conta, cruza com o benchmark setorial e projeta cada conta para o próximo ano.
              </p>
            </div>
          </div>
          {planejamento && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={baixarCsv}>
                <Download className="mr-1.5 h-4 w-4" /> CSV
              </Button>
              <Button variant="outline" size="sm" onClick={baixarXlsx}>
                <FileSpreadsheet className="mr-1.5 h-4 w-4" /> Excel
              </Button>
            </div>
          )}
        </div>

        {/* Seletor + execução */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClock className="h-4 w-4" /> Parâmetros da análise
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Empresa ativa</label>
                <Select value={empresaId} onValueChange={trocarEmpresa}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    {empresasAnos.map((e) => (
                      <SelectItem key={e.empresa} value={e.empresa}>
                        {e.empresaNome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Exercício base (ano atual do DRE a partir do qual projeta)
                </label>
                <Select
                  value={anoBase !== null ? String(anoBase) : ''}
                  onValueChange={(v) => setAnoBase(Number(v))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o ano" />
                  </SelectTrigger>
                  <SelectContent>
                    {anosSelecionaveis.map(({ ano, fechado }) => (
                      <SelectItem key={ano} value={String(ano)}>
                        {ano} {fechado ? '(fechado)' : '(em andamento)'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-2">
                <Button
                  className="flex-1"
                  onClick={() => executarAnalise(false)}
                  disabled={status === 'carregando' || !empresaId || anoBase === null}
                >
                  {status === 'carregando' ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analisando e projetando…
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" /> Analisar e Projetar
                    </>
                  )}
                </Button>
                {planejamento && (
                  <Button
                    variant="outline"
                    onClick={() => executarAnalise(true)}
                    disabled={status === 'carregando'}
                    title="Descarta a projeção salva e regera com o agente"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
            {anoBase !== null && (
              <p className="text-xs text-muted-foreground">
                O agente receberá os exercícios {anoBase - 3}, {anoBase - 2} e {anoBase - 1}{' '}
                (fechados) + o ano atual {anoBase}, conta por conta, e projetará {anoBase + 1}.
              </p>
            )}

            {status === 'carregando' && (
              <Alert>
                <Loader2 className="h-4 w-4 animate-spin" />
                <AlertTitle>Análise em execução</AlertTitle>
                <AlertDescription>
                  O agente está lendo o DRE Gerencial conta por conta, comparando com o benchmark
                  setorial e projetando o próximo ano. Isso pode levar até um minuto.
                </AlertDescription>
              </Alert>
            )}
            {status === 'erro' && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertTitle>Erro na análise</AlertTitle>
                <AlertDescription>{erroMsg}</AlertDescription>
              </Alert>
            )}
            {status === 'concluido' && (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertTitle>
                  {regenerado ? 'Planejamento gerado e salvo' : 'Planejamento reaberto (salvo)'}
                </AlertTitle>
                <AlertDescription>
                  Projeção do exercício {planejamento?.ano_projecao} disponível abaixo. Fechar e
                  reabrir a tela recarrega esta projeção sem regerar.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Carregando lista de salvos */}
        {carregandoLista && (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        )}

        {/* Resultado */}
        {planejamento && !carregandoLista && (
          <>
            {/* Indicadores de resumo */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <TrendingUp className="h-4 w-4" /> Receita projetada {planejamento.ano_projecao}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{fmtBRL(planejamento.receita_projetada)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Benchmark: {planejamento.benchmark_rotulo || '—'}
                  </p>
                </CardContent>
              </Card>
              <Card className="md:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Principais contas que mais impactam o próximo ano
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1.5">
                  {topImpacto.map((c) => (
                    <div
                      key={c.conta_id}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <span className="truncate">{c.nome}</span>
                      <span className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{fmtBRL(c.atual)} →</span>
                        <Badge variant={c.valor_projetado >= c.atual ? 'default' : 'destructive'}>
                          {fmtPct(c.variacao_pct)}
                        </Badge>
                      </span>
                    </div>
                  ))}
                  {topImpacto.length === 0 && (
                    <p className="text-sm text-muted-foreground">Sem variações relevantes.</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Parecer geral */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="h-4 w-4 text-primary" /> Parecer geral do agente
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="whitespace-pre-line text-sm leading-relaxed">
                  {planejamento.parecer_geral}
                </p>
                {planejamento.benchmark_mencionado && (
                  <>
                    <Separator />
                    <div className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Building2 className="mt-0.5 h-4 w-4 shrink-0" />
                      <p>
                        <span className="font-medium text-foreground">
                          Comparação com o mercado:
                        </span>{' '}
                        {planejamento.benchmark_mencionado}
                      </p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Tabela comparativa conta por conta */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  Projeção conta por conta — exercício {planejamento.ano_projecao}
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Histórico {planejamento.contas[0]?.anos.join(', ')} + ano atual{' '}
                  {planejamento.ano_base}. Variação comparada ao exercício base.
                </p>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[980px] text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="py-2 pr-3 font-medium">Conta</th>
                        {[...(planejamento.contas[0]?.anos ?? [])].reverse().map((a) => (
                          <th key={a} className="py-2 pr-3 text-right font-medium">
                            {a}
                          </th>
                        ))}
                        <th className="py-2 pr-3 text-right font-medium">
                          {planejamento.ano_base} (atual)
                        </th>
                        <th className="py-2 pr-3 text-right font-medium">
                          Projeção {planejamento.ano_projecao}
                        </th>
                        <th className="py-2 pr-3 text-right font-medium">Variação</th>
                        <th className="py-2 pr-3 font-medium">Análise do agente</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...contasPorClassificacao.entries()].map(([classificacao, contas]) => (
                        <SecaoClassificacao
                          key={classificacao}
                          classificacao={classificacao}
                          contas={contas}
                          anoBase={planejamento.ano_base}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* Estado vazio */}
        {!carregandoLista && !planejamento && status === 'ocioso' && (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <BrainCircuit className="h-10 w-10 text-muted-foreground" />
              <p className="font-medium">Nenhum planejamento salvo para esta empresa</p>
              <p className="max-w-lg text-sm text-muted-foreground">
                Escolha a empresa e o exercício base e clique em “Analisar e Projetar”. O agente de
                IA analisa o DRE Gerencial dos últimos 3 anos + o ano atual, conta por conta,
                compara com o benchmark setorial e salva a projeção para reabertura posterior.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </TooltipProvider>
  )
}

/** Bloco de uma classificação DRE dentro da tabela comparativa. */
function SecaoClassificacao({
  classificacao,
  contas,
  anoBase,
}: {
  classificacao: string
  contas: PlanejamentoEconomicoAnalise['contas']
  anoBase: number
}) {
  return (
    <>
      <tr className="bg-muted/50">
        <td colSpan={8} className="py-1.5 pl-2 text-xs font-semibold uppercase tracking-wide">
          {classificacao === 'NaoClassificado' ? 'Sem classificação DRE' : classificacao}
        </td>
      </tr>
      {contas.map((c) => {
        const anoAtualHistorico = c.anos[c.anos.length - 1] ?? 0
        const alertaDivergencia =
          c.atual > 0 &&
          Math.abs(c.variacao_pct) > 25 &&
          Math.abs(c.valor_projetado - c.atual) > Math.abs(c.atual) * 0.25
        return (
          <tr key={c.conta_id} className="border-b align-top last:border-0 hover:bg-muted/30">
            <td className="py-2 pr-3">
              <span className="font-medium">{c.nome}</span>
              {c.codigo && <span className="ml-1.5 text-xs text-muted-foreground">{c.codigo}</span>}
              {alertaDivergencia && (
                <span
                  className="ml-1.5 inline-flex"
                  title="Variação forte vs ano atual — revisar com o agente"
                >
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                </span>
              )}
            </td>
            {[...c.anos].reverse().map((v, i) => (
              <td key={i} className="py-2 pr-3 text-right tabular-nums">
                {fmtBRL(v)}
              </td>
            ))}
            <td className="py-2 pr-3 text-right font-medium tabular-nums">{fmtBRL(c.atual)}</td>
            <td className="py-2 pr-3 text-right font-semibold tabular-nums">
              {fmtBRL(c.valor_projetado)}
            </td>
            <td className="py-2 pr-3 text-right">
              <Badge
                variant={c.variacao_pct >= 0 ? 'default' : 'destructive'}
                className="tabular-nums"
              >
                {fmtPct(c.variacao_pct)}
              </Badge>
            </td>
            <td className="max-w-md py-2 pr-3 text-xs leading-relaxed text-muted-foreground">
              {c.comentario}
              <span className="ml-1 text-[10px] uppercase text-muted-foreground/70">
                ({c.confianca})
              </span>
              <span className="sr-only">vs {anoBase}</span>
              <span className="hidden">{anoAtualHistorico}</span>
            </td>
          </tr>
        )
      })}
    </>
  )
}
