import { useMemo, useState, useEffect, useCallback } from 'react'
import { useToast } from '@/hooks/use-toast'
import { useRealtimeDebounced } from '@/hooks/use-realtime'
import { useFilter } from '@/contexts/FilterContext'
import { useAuth } from '@/contexts/AuthContext'
import type { ContaRecord, LancamentoRecord, PlanoContaRecord } from '@/types/finance'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import {
  Scale,
  TrendingDown,
  TrendingUp,
  DollarSign,
  Percent,
  ShieldAlert,
  BarChart3,
  Download,
  FileSpreadsheet,
  Target,
} from 'lucide-react'
import { calcularPontoEquilibrio, getClassesMargemSeguranca } from '@/lib/pontoEquilibrioCalculo'
import {
  mesclarMetasNoAno,
  mapearMetasPorMes,
  getClassesPercentualMeta,
  type PontoEquilibrioAnoComMeta,
} from '@/lib/pontoEquilibrioMetaComparativo'
import { metasReceitaService } from '@/services/metasReceitaService'
import { parseValorMoeda, formatarValorParaEdicao } from '@/lib/moedaInput'
import type { PontoGraficoData } from '@/components/pontoEquilibrio/PontoEquilibrioGraficos'
import {
  formatBrlPontoEquilibrio,
  formatPercentualPontoEquilibrio,
  formatMultiploPontoEquilibrio,
} from '@/components/pontoEquilibrio/pontoEquilibrioFormat'
import {
  exportarPontoEquilibrioCsv,
  exportarPontoEquilibrioExcel,
} from '@/lib/pontoEquilibrioExport'
import { MatrizPontoEquilibrio } from '@/components/pontoEquilibrio/MatrizPontoEquilibrio'
import { PontoEquilibrioGraficos } from '@/components/pontoEquilibrio/PontoEquilibrioGraficos'
import { EditorMetasMensais } from '@/components/pontoEquilibrio/EditorMetasMensais'
import { lancamentosService } from '@/services/financeService'
import { contasService, planoContasService } from '@/services/financeService'

const CORES_CARD_ICONE = 'h-4 w-4'

function CardResumo({
  titulo,
  valor,
  sub,
  icone,
  badge,
  badgeClasses,
}: {
  titulo: string
  valor: string
  sub?: string
  icone: React.ReactNode
  badge?: string
  badgeClasses?: string
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{titulo}</CardTitle>
        {icone}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{valor}</div>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
        {badge && (
          <Badge variant="outline" className={`mt-2 ${badgeClasses || ''}`}>
            {badge}
          </Badge>
        )}
      </CardContent>
    </Card>
  )
}

/** Preenche o rascunho do editor com as metas salvas (formato de edição pt-BR). */
function preencherRascunho(metas: Map<number, number>): Record<number, string> {
  const novo: Record<number, string> = {}
  metas.forEach((valor, mes) => {
    novo[mes] = formatarValorParaEdicao(valor)
  })
  return novo
}

export default function PontoEquilibrio() {
  // Padrão das telas irmãs do Menu Gerencial: empresa ativa vem do seletor global
  // (FilterContext), que já auto-seleciona a primeira empresa/grupo válido —
  // inclusive quando o usuário tem uma única empresa vinculada.
  const { selectedEmpresaId, selectedEmpresa, selectedAno, isGrupoAtivo, grupoAtivo } = useFilter()
  const { user } = useAuth()
  const { toast } = useToast()
  const [lancamentos, setLancamentos] = useState<LancamentoRecord[]>([])
  const [contas, setContas] = useState<ContaRecord[]>([])
  const [planoContas, setPlanoContas] = useState<PlanoContaRecord[]>([])
  const [metas, setMetas] = useState<Map<number, number>>(new Map())
  const [rascunho, setRascunho] = useState<Record<number, string>>({})
  const [salvandoMetas, setSalvandoMetas] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const [exercicioAno, setExercicioAno] = useState<number>(selectedAno || new Date().getFullYear())

  // Metas editáveis por admin e perfil empresa (cliente já não acessa a tela)
  const podeEditarMetas = user?.role === 'admin' || user?.role === 'empresa'

  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      let lancsPromise: Promise<LancamentoRecord[]>
      let contasPromise: Promise<ContaRecord[]>
      let planosPromise: Promise<PlanoContaRecord[]>

      if (isGrupoAtivo && grupoAtivo && grupoAtivo.empresas && grupoAtivo.empresas.length > 0) {
        const empIds = new Set(grupoAtivo.empresas)
        lancsPromise = lancamentosService
          .getAll({ expandRelations: true })
          .then((list) => list.filter((l) => empIds.has(l.empresa)))
        contasPromise = contasService
          .getAll()
          .then((list) => list.filter((c) => !c.empresa || empIds.has(c.empresa)))
        planosPromise = planoContasService
          .getAll()
          .then((list) => list.filter((p) => !p.empresa || empIds.has(p.empresa)))
      } else if (selectedEmpresaId && !selectedEmpresaId.startsWith('grupo-')) {
        lancsPromise = lancamentosService.getAll({
          empresaId: selectedEmpresaId,
          expandRelations: true,
        })
        contasPromise = contasService.getAll({ empresaId: selectedEmpresaId })
        planosPromise = planoContasService.getAll({ empresaId: selectedEmpresaId })
      } else {
        lancsPromise = lancamentosService.getAll({ expandRelations: true })
        contasPromise = contasService.getAll()
        planosPromise = planoContasService.getAll()
      }

      const [lancs, cts, plano] = await Promise.all([lancsPromise, contasPromise, planosPromise])
      setLancamentos(lancs)
      setContas(cts)
      setPlanoContas(plano)
    } catch (e) {
      console.error(e)
      toast({
        title: 'Erro ao carregar dados',
        description: 'Não foi possível carregar os dados do ponto de equilíbrio.',
        variant: 'destructive',
      })
    } finally {
      setCarregando(false)
    }
  }, [selectedEmpresaId, isGrupoAtivo, grupoAtivo, toast])

  useEffect(() => {
    carregar()
  }, [carregar])

  useRealtimeDebounced('lancamentos', carregar)
  useRealtimeDebounced('contas', carregar)
  useRealtimeDebounced('plano_contas', carregar)

  // Metas de receita da empresa ativa (todas os anos — o mapa filtra pelo ano)
  const carregarMetas = useCallback(async () => {
    if (!selectedEmpresaId || selectedEmpresaId.startsWith('grupo-')) {
      setMetas(new Map())
      return
    }
    try {
      const lista = await metasReceitaService.getAll({ empresaId: selectedEmpresaId })
      setMetas(mapearMetasPorMes(lista, exercicioAno))
    } catch (e) {
      console.error(e)
      setMetas(new Map())
    }
  }, [selectedEmpresaId, exercicioAno])

  useEffect(() => {
    carregarMetas()
  }, [carregarMetas])

  useEffect(() => {
    const handleRecarregar = () => carregar()
    window.addEventListener('dre-contas-atualizado', handleRecarregar)
    return () => window.removeEventListener('dre-contas-atualizado', handleRecarregar)
  }, [carregar])

  // Acompanha o exercício do seletor global (padrão das telas irmãs)
  useEffect(() => {
    if (selectedAno) setExercicioAno(selectedAno)
  }, [selectedAno])

  const resultado = useMemo(
    () => calcularPontoEquilibrio({ lancamentos, contas, planoContas, anoAtual: exercicioAno }),
    [lancamentos, contas, planoContas, exercicioAno],
  )

  // Ano ativo já com as metas mescladas (receita vs. meta por mês)
  const ao: PontoEquilibrioAnoComMeta | null = useMemo(
    () => (resultado.anoAtivo ? mesclarMetasNoAno(resultado.anoAtivo, metas) : null),
    [resultado.anoAtivo, metas],
  )

  const exerciciosDisponiveis = useMemo(() => resultado.anos.map((a) => a.ano), [resultado])

  useEffect(() => {
    if (exerciciosDisponiveis.length && !exerciciosDisponiveis.includes(exercicioAno)) {
      setExercicioAno(exerciciosDisponiveis[0])
    }
  }, [exerciciosDisponiveis, exercicioAno])

  const formatarMoeda = formatBrlPontoEquilibrio
  const formatarPercentual = formatPercentualPontoEquilibrio
  const formatarMultiplo = formatMultiploPontoEquilibrio

  /** Editor: ao trocar de exercício/empresa, preenche o rascunho com o salvo. */
  useEffect(() => {
    setRascunho(preencherRascunho(metas))
  }, [metas, exercicioAno])

  const handleSalvarMetas = useCallback(async () => {
    if (!selectedEmpresaId || selectedEmpresaId.startsWith('grupo-')) {
      toast({
        title: 'Selecione uma empresa',
        description: 'As metas são cadastradas por empresa — selecione uma no seletor do topo.',
        variant: 'destructive',
      })
      return
    }
    setSalvandoMetas(true)
    try {
      const itens = Array.from({ length: 12 }, (_, i) => ({
        empresa: selectedEmpresaId,
        ano: exercicioAno,
        mes: i + 1,
        valor: parseValorMoeda(rascunho[i + 1] ?? ''),
      }))
      const { ok, falhas } = await metasReceitaService.salvarLote(itens)
      if (falhas > 0) {
        toast({
          title: 'Metas salvas com ressalvas',
          description: `${ok} mês(es) salvos, ${falhas} falha(s). Tente novamente para as pendentes.`,
        })
      } else {
        toast({
          title: 'Metas salvas',
          description: `Metas de receita de ${exercicioAno} salvas com sucesso.`,
        })
      }
      await carregarMetas()
    } catch (e) {
      console.error(e)
      toast({
        title: 'Erro ao salvar metas',
        description: 'Não foi possível salvar as metas de receita. Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSalvandoMetas(false)
    }
  }, [selectedEmpresaId, exercicioAno, rascunho, toast, carregarMetas])

  /** Dados dos gráficos: um ponto por mês, null = "—" (sem movimento / PE indefinido). */
  const dadosGrafico: PontoGraficoData[] = useMemo(
    () =>
      (ao?.meses || []).map((m) => ({
        mes: m.rotuloCurto,
        receita: m.temMovimento ? m.receita : null,
        pontoEquilibrio: m.pontoEquilibrio,
        margemSeguranca: m.margemSegurancaPercentual,
        meta: m.meta,
      })),
    [ao],
  )

  const temMetasCadastradas = ao?.totalMetaDefinida ?? false

  if (!selectedEmpresaId) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Selecione uma empresa no seletor do topo para visualizar o ponto de equilíbrio.
          </CardContent>
        </Card>
        <Button variant="outline" className="mt-4" onClick={() => window.history.back()}>
          Voltar
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center">
            <Scale className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Ponto de Equilíbrio</h1>
            <p className="text-sm text-muted-foreground">
              {isGrupoAtivo && grupoAtivo
                ? `Grupo ${grupoAtivo.nome}`
                : selectedEmpresa?.nome || 'Carregando...'}{' '}
              · Exercício {ao?.ano || exercicioAno}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={exercicioAno}
            onChange={(e) => setExercicioAno(Number(e.target.value))}
          >
            {exerciciosDisponiveis.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              exportarPontoEquilibrioExcel({ anoAtivo: ao }, selectedEmpresa, exercicioAno)
            }
          >
            <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              exportarPontoEquilibrioCsv({ anoAtivo: ao }, selectedEmpresa, exercicioAno)
            }
          >
            <Download className="mr-2 h-4 w-4" /> CSV
          </Button>
        </div>
      </div>

      {/* Aviso de margem não positiva */}
      {ao && !ao.temDados && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="py-4 text-sm text-amber-800">
            Sem lançamentos para o exercício {exercicioAno}. Selecione outro exercício ou registre
            movimentos para calcular o ponto de equilíbrio.
          </CardContent>
        </Card>
      )}

      {ao && ao.temDados && !ao.temDespesasFixas && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="py-4 text-sm text-amber-800">
            Nenhuma despesa fixa classificada no exercício. O ponto de equilíbrio contábil exige
            despesas fixas para ser calculado.
          </CardContent>
        </Card>
      )}

      {carregando ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : ao && ao.temDados ? (
        <>
          {/* Editor de metas (acima dos cards — é o ponto de partida do painel) */}
          {!isGrupoAtivo && (
            <EditorMetasMensais
              ano={ao}
              rascunho={rascunho}
              onRascunho={(mes, valor) => setRascunho((r) => ({ ...r, [mes]: valor }))}
              onSalvar={handleSalvarMetas}
              onDescartar={() => setRascunho(preencherRascunho(metas))}
              salvando={salvandoMetas}
              habilitado={podeEditarMetas}
            />
          )}

          {/* Cards de resumo */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <CardResumo
              titulo={`Despesas Fixas ${ao.ano}`}
              valor={formatarMoeda(ao.totalDespesasFixas)}
              icone={<TrendingDown className={CORES_CARD_ICONE} />}
            />
            <CardResumo
              titulo="Margem de Contribuição"
              valor={formatarMoeda(ao.margemTotal)}
              sub={`Margem: ${formatarPercentual(ao.margemAnualPercentual)}`}
              icone={<Percent className={CORES_CARD_ICONE} />}
            />
            <CardResumo
              titulo="Ponto de Equilíbrio (R$)"
              valor={formatarMoeda(ao.pontoEquilibrioAnual)}
              sub={
                ao.pontoEquilibrioAnual === null
                  ? 'Indefinido: margem de contribuição ≤ 0 no período'
                  : 'Fixas ÷ Margem de Contribuição %'
              }
              icone={<Scale className={CORES_CARD_ICONE} />}
            />
            <CardResumo
              titulo={`Receita ${ao.ano}`}
              valor={formatarMoeda(ao.totalReceita)}
              icone={<DollarSign className={CORES_CARD_ICONE} />}
            />
            <CardResumo
              titulo={`Meta de Receita ${ao.ano}`}
              valor={temMetasCadastradas ? formatarMoeda(ao.totalMeta) : '—'}
              sub={
                temMetasCadastradas
                  ? `Realizado ÷ Meta: ${formatarPercentual(ao.totalPercentualMeta)} · Diferença: ${
                      ao.totalDiferencaMeta !== null
                        ? (ao.totalDiferencaMeta >= 0 ? '+' : '') +
                          formatarMoeda(ao.totalDiferencaMeta)
                        : '—'
                    }`
                  : 'Nenhuma meta cadastrada — preencha no editor de metas acima'
              }
              icone={<Target className={CORES_CARD_ICONE} />}
              badge={
                ao.totalPercentualMeta !== null
                  ? `${ao.totalPercentualMeta.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% atingido`
                  : undefined
              }
              badgeClasses={getClassesPercentualMeta(ao.totalPercentualMeta).badge}
            />
            <CardResumo
              titulo="Lucro / Prejuízo"
              valor={formatarMoeda(ao.resultadoAnual)}
              icone={
                ao.resultadoAnual >= 0 ? (
                  <TrendingUp className={CORES_CARD_ICONE} />
                ) : (
                  <TrendingDown className={CORES_CARD_ICONE} />
                )
              }
            />
            <CardResumo
              titulo="Margem de Segurança"
              valor={formatarPercentual(ao.margemSegurancaAnualPercentual)}
              sub="Quanto a receita pode cair antes de atingir o PE"
              icone={<ShieldAlert className={CORES_CARD_ICONE} />}
              badge={
                ao.margemSegurancaAnualPercentual !== null
                  ? ao.margemSegurancaAnualPercentual >= 25
                    ? 'Confortável'
                    : ao.margemSegurancaAnualPercentual >= 10
                      ? 'Atenção'
                      : 'Crítico'
                  : undefined
              }
              badgeClasses={getClassesMargemSeguranca(ao.margemSegurancaAnualPercentual).badge}
            />
            <CardResumo
              titulo="Grau de Alavancagem Operacional (GAO)"
              valor={formatarMultiplo(ao.grauAlavancagemAnual)}
              sub="MC ÷ Resultado — sensibilidade do lucro a variações da receita"
              icone={<BarChart3 className={CORES_CARD_ICONE} />}
            />
          </div>

          {/* Gráficos */}
          <PontoEquilibrioGraficos
            exercicio={ao.ano}
            dados={dadosGrafico}
            temDados={dadosGrafico.some(
              (d) => d.receita !== null || d.pontoEquilibrio !== null || d.meta !== null,
            )}
          />

          {/* Matriz mês a mês */}
          <MatrizPontoEquilibrio ano={ao} />
        </>
      ) : (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Sem dados para o exercício {exercicioAno}.
          </CardContent>
        </Card>
      )}
    </div>
  )
}
