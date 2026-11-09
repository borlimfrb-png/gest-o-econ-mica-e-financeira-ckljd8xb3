import { useState, useEffect, useMemo } from 'react'
import { useFilter } from '@/contexts/FilterContext'
import { useToast } from '@/hooks/use-toast'
import {
  contasService,
  lancamentosService,
  planoContasService,
  balancosService,
} from '@/services/financeService'
import type {
  ContaRecord,
  LancamentoRecord,
  PlanoContaRecord,
  BalancoRecord,
} from '@/types/finance'
import { gerarListaMeses } from '@/lib/dreGerencialTypes'
import { calcularDreGerencialMatriz } from '@/lib/dreGerencialCalculo'
import {
  calcularProjecaoDre,
  montarLinhasMesesProjecao,
  rotuloCurtoMetodoProjecaoDre,
  descricaoMetodoProjecaoDre,
  formatPercentualBr,
  calcularProjecaoDrePlurianual,
  type ParametrosProjecaoDre,
  type ParametrosProjecaoPlurianual,
  type DadosAnoHistoricoDre,
  type ClassificacaoDre,
} from '@/lib/projecaoDreCalculo'
import {
  exportarProjecaoDreExcel,
  exportarProjecaoDreCsv,
  exportarProjecaoDrePlurianualExcel,
  exportarProjecaoDrePlurianualCsv,
} from '@/lib/projecaoDreExport'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { DoubleHorizontalScroll } from '@/components/DoubleHorizontalScroll'
import { DocumentPrintFooter } from '@/components/DocumentPrintFooter'
import { SecaoBalançoProjetado } from '@/components/SecaoBalançoProjetado'
import {
  CalendarClock,
  Download,
  FileSpreadsheet,
  TrendingUp,
  TrendingDown,
  Building,
  FolderOpen,
  RefreshCw,
  Info,
  SlidersHorizontal,
} from 'lucide-react'
import { Input } from '@/components/ui/input'

const ANO_ATUAL = new Date().getFullYear()
const ANOS_OPCOES = Array.from({ length: 7 }, (_, i) => ANO_ATUAL - 4 + i)

function formatBrl(val: number | undefined | null): string {
  if (val === undefined || val === null || isNaN(val)) return 'R$ 0,00'
  return val.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function formatPct(val: number | null): string {
  if (val === null) return '—'
  return `${val >= 0 ? '+' : ''}${val.toFixed(1)}%`
}

export default function ProjecaoDre() {
  const { toast } = useToast()
  const {
    selectedEmpresaId,
    selectedEmpresa,
    selectedAno,
    isGrupoAtivo,
    grupoAtivo,
    empresasIdsAtivas,
  } = useFilter()

  const [loading, setLoading] = useState(true)
  const [lancamentos, setLancamentos] = useState<LancamentoRecord[]>([])
  const [contas, setContas] = useState<ContaRecord[]>([])
  const [planoContas, setPlanoContas] = useState<PlanoContaRecord[]>([])
  const [balancos, setBalancos] = useState<BalancoRecord[]>([])

  const [exercicio, setExercicio] = useState<number>(selectedAno || ANO_ATUAL)

  // Parâmetros da projeção (estado de tela — não persistidos): modo + % de crescimento.
  const [parametros, setParametros] = useState<ParametrosProjecaoDre>({
    modo: 'media_mensal',
    percentualCrescimento: 0,
  })

  useEffect(() => {
    if (selectedAno) setExercicio(selectedAno)
  }, [selectedAno])

  const carregarDados = async () => {
    try {
      setLoading(true)
      let lancsPromise: Promise<LancamentoRecord[]>
      let contasPromise: Promise<ContaRecord[]>
      let planosPromise: Promise<PlanoContaRecord[]>
      let balancosPromise: Promise<BalancoRecord[]>

      if (isGrupoAtivo && grupoAtivo && grupoAtivo.empresas && grupoAtivo.empresas.length > 0) {
        const empIds = new Set(grupoAtivo.empresas)
        const opts = { empresasIds: grupoAtivo.empresas }
        lancsPromise = lancamentosService
          .getAll({ expandRelations: true })
          .then((list) => list.filter((l) => empIds.has(l.empresa)))
        contasPromise = contasService.getAll(opts)
        planosPromise = planoContasService.getAll(opts)
        balancosPromise = balancosService
          .getAll()
          .then((list) => list.filter((b) => empIds.has(b.empresa)))
          .catch(() => [])
      } else if (selectedEmpresaId && !selectedEmpresaId.startsWith('grupo-')) {
        lancsPromise = lancamentosService.getAll({
          empresaId: selectedEmpresaId,
          expandRelations: true,
        })
        contasPromise = contasService.getAll({ empresaId: selectedEmpresaId })
        planosPromise = planoContasService.getAll({ empresaId: selectedEmpresaId })
        balancosPromise = balancosService.getByEmpresa(selectedEmpresaId).catch(() => [])
      } else {
        const empOpts =
          empresasIdsAtivas.length > 0 ? { empresasIds: empresasIdsAtivas } : undefined
        lancsPromise = lancamentosService.getAll({ expandRelations: true })
        contasPromise = contasService.getAll(empOpts)
        planosPromise = planoContasService.getAll(empOpts)
        balancosPromise = balancosService
          .getAll()
          .then((list) =>
            empresasIdsAtivas.length > 0
              ? list.filter((b) => empresasIdsAtivas.includes(b.empresa))
              : list,
          )
          .catch(() => [])
      }

      const [contasList, lancamentosList, planosList, balancosList] = await Promise.all([
        contasPromise,
        lancsPromise,
        planosPromise,
        balancosPromise,
      ])

      setContas(Array.from(new Map(contasList.map((i) => [i.id, i])).values()))
      setLancamentos(lancamentosList)
      setPlanoContas(Array.from(new Map(planosList.map((i) => [i.id, i])).values()))
      setBalancos(balancosList)
    } catch (err: any) {
      console.error('Erro ao carregar dados da Projeção de DRE:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar dados',
        description: 'Não foi possível carregar lançamentos e contas para a projeção.',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarDados()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEmpresaId, isGrupoAtivo, grupoAtivo])

  // 12 meses do exercício escolhido
  const mesesExercicio = useMemo(() => gerarListaMeses(exercicio, 1, 12), [exercicio])

  // Matriz oficial da DRE Gerencial do exercício (meses realizados)
  const matrizAtual = useMemo(
    () => calcularDreGerencialMatriz(lancamentos, contas, mesesExercicio, planoContas),
    [lancamentos, contas, mesesExercicio, planoContas],
  )

  // Matriz do exercício anterior (tendência)
  const matrizAnoAnterior = useMemo(
    () =>
      calcularDreGerencialMatriz(
        lancamentos,
        contas,
        gerarListaMeses(exercicio - 1, 1, 12),
        planoContas,
      ),
    [lancamentos, contas, exercicio, planoContas],
  )

  const projecao = useMemo(
    () =>
      calcularProjecaoDre(
        matrizAtual,
        matrizAnoAnterior.meses.length > 0 ? matrizAnoAnterior : null,
        mesesExercicio,
        parametros,
      ),
    [matrizAtual, matrizAnoAnterior, mesesExercicio, parametros],
  )

  const linhasMeses = useMemo(
    () => montarLinhasMesesProjecao(mesesExercicio, projecao.mesesRealizadosComMovimento),
    [mesesExercicio, projecao.mesesRealizadosComMovimento],
  )

  const temDados = projecao.mesesRealizadosComMovimento.length > 0
  const temDadosAnoAnterior = matrizAnoAnterior.lucroPrejuizo.totalPeriodo !== 0

  // Aba ativa: 'mensal' (exercício atual mês a mês) ou 'plurianual' (próximos anos com base na média)
  const [abaAtiva, setAbaAtiva] = useState<'mensal' | 'plurianual'>('mensal')

  // Parâmetros da Projeção Plurianual (próximos anos)
  const [parametrosPlurianual, setParametrosPlurianual] = useState<ParametrosProjecaoPlurianual>({
    anosFuturos: 3,
    modo: 'media_simples',
    percentualCrescimentoAnual: 0,
  })

  // Consolidação dos anos históricos realizados a partir dos lançamentos contábeis
  const historicoAnos = useMemo<DadosAnoHistoricoDre[]>(() => {
    const anosSet = new Set<number>()
    for (const l of lancamentos) {
      if (l.estornado || !l.data) continue
      const anoNum = Number(l.data.slice(0, 4))
      if (anoNum >= 2000 && anoNum <= 2100) anosSet.add(anoNum)
    }
    // Inclui pelo menos o ano selecionado e os anos recentes se houver lançamentos
    if (anosSet.size === 0 && exercicio) {
      anosSet.add(exercicio)
    }
    const anosOrdenados = Array.from(anosSet).sort((a, b) => a - b)

    return anosOrdenados.map((ano) => {
      const mesesAno = gerarListaMeses(ano, 1, 12)
      const mat = calcularDreGerencialMatriz(lancamentos, contas, mesesAno, planoContas)
      const temMov =
        mat.totalReceitasPeriodo > 0 ||
        mat.grupos.some((g) => Math.abs(g.totalPeriodo) > 0) ||
        Math.abs(mat.lucroPrejuizo.totalPeriodo) > 0

      const totaisPorClassificacao: Record<ClassificacaoDre, number> = {
        Receita: 0,
        'Despesa Variável': 0,
        'Despesa Fixa': 0,
        'Despesa Financeira': 0,
        'Receita Financeira': 0,
      }
      for (const g of mat.grupos) {
        totaisPorClassificacao[g.classificacao] = g.totalPeriodo || 0
      }

      return {
        ano,
        temMovimento: temMov,
        totaisPorClassificacao,
        lucroPrejuizo: mat.lucroPrejuizo.totalPeriodo || 0,
      }
    })
  }, [lancamentos, contas, planoContas, exercicio])

  // Resultado da Projeção Plurianual (próximos anos)
  const projecaoPlurianual = useMemo(
    () => calcularProjecaoDrePlurianual(historicoAnos, exercicio, parametrosPlurianual),
    [historicoAnos, exercicio, parametrosPlurianual],
  )

  const entidadeNome =
    isGrupoAtivo && grupoAtivo ? grupoAtivo.nome : selectedEmpresa?.nome || 'Consolidado'

  const handleExportar = (formato: 'excel' | 'csv') => {
    const opcoes = {
      empresaNome: selectedEmpresa?.nome,
      isGrupo: isGrupoAtivo,
      nomeGrupo: isGrupoAtivo && grupoAtivo ? grupoAtivo.nome : undefined,
      exercicioAno: exercicio,
    }
    if (abaAtiva === 'plurianual') {
      if (formato === 'excel') {
        exportarProjecaoDrePlurianualExcel(projecaoPlurianual, opcoes)
      } else {
        exportarProjecaoDrePlurianualCsv(projecaoPlurianual, opcoes)
      }
      return
    }
    if (formato === 'excel') {
      exportarProjecaoDreExcel(projecao, mesesExercicio, opcoes)
    } else {
      exportarProjecaoDreCsv(projecao, mesesExercicio, opcoes)
    }
  }

  // Parâmetros → descrição reativa dos controles
  const modoSelecionado = parametros.modo === 'crescimento' ? 'crescimento' : 'media_mensal'
  const setModo = (modo: ParametrosProjecaoDre['modo']) => setParametros((p) => ({ ...p, modo }))
  const setPercentual = (valor: number) =>
    setParametros((p) => ({ ...p, percentualCrescimento: valor }))
  const percentualInput = String(parametros.percentualCrescimento).replace('.', ',')
  const onChangePercentualInput = (texto: string) => {
    const normalizado = texto.trim().replace(',', '.').replace('%', '').replace(/\s/g, '')
    if (normalizado === '' || normalizado === '-') {
      setPercentual(0)
      return
    }
    const num = Number(normalizado)
    if (!isNaN(num)) setPercentual(num)
  }

  const nomeMesPorChave = new Map(linhasMeses.map((lm) => [lm.chave, lm]))

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6 bg-[#F5F7FA] min-h-screen">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-lg bg-[#0B1F3A] text-white">
            <CalendarClock className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#0B1F3A]">Projeção de DRE</h1>
            <p className="text-sm text-muted-foreground max-w-2xl">
              Exercício com meses realizados (dados reais dos lançamentos) e meses futuros
              projetados pela média mensal das rubricas com movimento.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => carregarDados()}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                className="gap-2 bg-[#0B1F3A] hover:bg-[#0B1F3A]/90"
                disabled={loading}
              >
                <Download className="h-4 w-4" />
                Exportar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExportar('excel')}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Excel (.xlsx)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExportar('csv')}>
                <Download className="h-4 w-4 mr-2" />
                CSV (.csv)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Abas: Exercício Atual vs. Próximos Anos (Plurianual) */}
      <Tabs
        value={abaAtiva}
        onValueChange={(v) => setAbaAtiva(v as 'mensal' | 'plurianual')}
        className="space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <TabsList className="bg-slate-200/80 p-1">
            <TabsTrigger
              value="mensal"
              className="gap-2 text-xs md:text-sm font-semibold data-[state=active]:bg-[#0B1F3A] data-[state=active]:text-white"
            >
              <CalendarClock className="h-4 w-4" />
              Exercício {exercicio} (Mês a Mês)
            </TabsTrigger>
            <TabsTrigger
              value="plurianual"
              className="gap-2 text-xs md:text-sm font-semibold data-[state=active]:bg-[#0B1F3A] data-[state=active]:text-white"
            >
              <TrendingUp className="h-4 w-4" />
              Projeção Plurianual (Próximos Anos)
            </TabsTrigger>
          </TabsList>
          <span className="text-xs text-muted-foreground">
            {abaAtiva === 'mensal'
              ? 'Projeção dos meses faltantes do ano corrente'
              : 'Projeção dos anos futuros (+1 a +5 anos) pela média histórica'}
          </span>
        </div>

        {/* Filtros */}
        <Card className="border-slate-200">
          <CardContent className="pt-6 pb-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
                  <Building className="h-3.5 w-3.5" />
                  Empresa / Grupo (seletor global no topo)
                </label>
                <div className="text-sm font-medium text-[#0B1F3A] truncate">{entidadeNome}</div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
                  <CalendarClock className="h-3.5 w-3.5" />
                  Exercício Base
                </label>
                <Select value={String(exercicio)} onValueChange={(v) => setExercicio(Number(v))}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione o exercício" />
                  </SelectTrigger>
                  <SelectContent>
                    {ANOS_OPCOES.map((a) => (
                      <SelectItem key={a} value={String(a)}>
                        {a}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-600">Situação</label>
                {abaAtiva === 'mensal' ? (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <Badge variant="outline" className="border-slate-300 text-slate-700">
                      {projecao.mesesRealizadosComMovimento.length} mês(es) realizado(s)
                    </Badge>
                    <Badge
                      variant="outline"
                      className="border-amber-300 text-amber-700 bg-amber-50"
                    >
                      {12 - projecao.mesesRealizadosComMovimento.length} mês(es) projetado(s)
                    </Badge>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <Badge
                      variant="outline"
                      className="border-emerald-300 text-emerald-800 bg-emerald-50"
                    >
                      {projecaoPlurianual.anosBaseHistorico.length} ano(s) base na média
                    </Badge>
                    <Badge
                      variant="outline"
                      className="border-amber-300 text-amber-700 bg-amber-50"
                    >
                      +{projecaoPlurianual.anosFuturosProjetados.length} anos futuros projetados
                    </Badge>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Conteúdo Aba Mensal */}
        <TabsContent value="mensal" className="space-y-6 mt-0">
          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-28 w-full" />
              <Skeleton className="h-96 w-full" />
            </div>
          ) : !temDados ? (
            <Card className="border-dashed">
              <CardContent className="py-16 text-center">
                <CalendarClock className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                <h3 className="text-lg font-semibold text-slate-700 mb-1">
                  Sem movimento neste exercício
                </h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  Nenhum lançamento com movimento em {exercicio} para esta empresa/grupo. A projeção
                  usa apenas dados reais — nada é inventado. Verifique o exercício ou registre
                  lançamentos na DRE Gerencial.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Parâmetros da Projeção — controles reativos (estado de tela) */}
              <Card className="border-slate-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg text-[#0B1F3A] flex items-center gap-2">
                    <SlidersHorizontal className="h-5 w-5 text-amber-600" />
                    Parâmetros da Projeção
                  </CardTitle>
                  <CardDescription>
                    Definem como os meses projetados são calculados. O Balanço Projetado acompanha
                    na hora — sem recarregar.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap items-end gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                      Método
                    </label>
                    <div className="flex rounded-md border border-slate-300 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setModo('media_mensal')}
                        className={`px-3 py-2 text-sm transition-colors ${
                          modoSelecionado === 'media_mensal'
                            ? 'bg-[#0B1F3A] text-white font-medium'
                            : 'bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        Média mensal
                      </button>
                      <button
                        type="button"
                        onClick={() => setModo('crescimento')}
                        className={`px-3 py-2 text-sm transition-colors border-l border-slate-300 ${
                          modoSelecionado === 'crescimento'
                            ? 'bg-[#0B1F3A] text-white font-medium'
                            : 'bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        Crescimento %
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="percentual-crescimento"
                      className="text-xs font-medium text-slate-500 uppercase tracking-wide"
                    >
                      Crescimento mensal (%)
                    </label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="percentual-crescimento"
                        inputMode="decimal"
                        value={percentualInput}
                        disabled={modoSelecionado !== 'crescimento'}
                        onChange={(e) => onChangePercentualInput(e.target.value)}
                        className="w-28"
                        placeholder="0"
                      />
                      {modoSelecionado === 'crescimento' && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setPercentual(0)}
                          disabled={parametros.percentualCrescimento === 0}
                        >
                          Zerar
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {modoSelecionado === 'crescimento'
                        ? `Cada mês projetado = média × (1 + ${formatPercentualBr(parametros.percentualCrescimento)}%)ⁿ, composto a partir do último mês realizado.`
                        : 'Cada mês projetado = média mensal fixa das rubricas com movimento.'}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* KPIs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border-slate-200">
                  <CardContent className="pt-6">
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                      Receita — Total Ano
                    </p>
                    <p className="text-xl font-bold text-[#0B1F3A] mt-1">
                      {formatBrl(projecao.receitaTotalAno)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Realizado {formatBrl(projecao.receitaRealizada)} + Projetado{' '}
                      {formatBrl(projecao.receitaProjetada)}
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-slate-200">
                  <CardContent className="pt-6">
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                      Resultado — Total Ano
                    </p>
                    <p
                      className={`text-xl font-bold mt-1 ${
                        projecao.lucroPrejuizoTotalAno >= 0 ? 'text-emerald-700' : 'text-red-700'
                      }`}
                    >
                      {formatBrl(projecao.lucroPrejuizoTotalAno)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Realizado {formatBrl(projecao.lucroPrejuizoRealizado)} + Projetado{' '}
                      {formatBrl(projecao.lucroPrejuizoProjetado)}
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-slate-200">
                  <CardContent className="pt-6">
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                      Base da projeção
                    </p>
                    <p className="text-xl font-bold text-[#0B1F3A] mt-1">
                      {projecao.mesesRealizadosComMovimento.length} mês(es)
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {rotuloCurtoMetodoProjecaoDre(projecao.parametrosAplicados) === 'média mensal'
                        ? 'Média mensal por rubrica dos meses com movimento'
                        : `Média dos meses com movimento + ${rotuloCurtoMetodoProjecaoDre(projecao.parametrosAplicados)}`}
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-slate-200">
                  <CardContent className="pt-6">
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                      Tendência vs. {projecao.tendenciaVsAnoAnterior?.anoAnterior ?? exercicio - 1}
                    </p>
                    {temDadosAnoAnterior && projecao.tendenciaVsAnoAnterior ? (
                      <>
                        <p
                          className={`text-xl font-bold mt-1 flex items-center gap-1.5 ${
                            projecao.tendenciaVsAnoAnterior.favoravel
                              ? 'text-emerald-700'
                              : 'text-red-700'
                          }`}
                        >
                          {projecao.tendenciaVsAnoAnterior.favoravel ? (
                            <TrendingUp className="h-5 w-5" />
                          ) : (
                            <TrendingDown className="h-5 w-5" />
                          )}
                          {formatPct(projecao.tendenciaVsAnoAnterior.variacaoPercentual)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Resultado do ano projetado vs. exercício anterior
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-xl font-bold text-slate-400 mt-1">—</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Sem movimento no exercício anterior para comparar
                        </p>
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Tabela matriz */}
              <Card className="border-slate-200">
                <CardHeader>
                  <CardTitle className="text-lg text-[#0B1F3A]">
                    DRE {exercicio} — Realizado + Projetado
                  </CardTitle>
                  <CardDescription className="flex flex-wrap items-center gap-3">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="inline-block w-3 h-3 rounded-sm bg-slate-100 border border-slate-300" />
                      Realizado (dados reais)
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="inline-block w-3 h-3 rounded-sm bg-amber-50 border border-amber-300" />
                      Projetado ({rotuloCurtoMetodoProjecaoDre(projecao.parametrosAplicados)})
                    </span>
                    <span className="inline-flex items-center gap-1 text-amber-700">
                      <Info className="h-3.5 w-3.5" />
                      Colunas/valores em itálico tracejado = projeção
                    </span>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <DoubleHorizontalScroll>
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50 hover:bg-slate-50">
                          <TableHead className="sticky left-0 bg-slate-50 z-10 min-w-[280px]">
                            Estrutura
                          </TableHead>
                          {linhasMeses.map((lm) => (
                            <TableHead
                              key={lm.chave}
                              className={`text-right min-w-[110px] ${
                                lm.projetado
                                  ? 'italic border-b-2 border-dashed border-amber-400 text-amber-700'
                                  : ''
                              }`}
                            >
                              {lm.rotuloCurto}
                              {lm.projetado && (
                                <span className="block text-[10px] font-normal normal-case">
                                  projetado
                                </span>
                              )}
                            </TableHead>
                          ))}
                          <TableHead className="text-right min-w-[120px]">Realizado</TableHead>
                          <TableHead className="text-right min-w-[120px]">Projetado</TableHead>
                          <TableHead className="text-right min-w-[120px]">Total Ano</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {projecao.grupos.map((g) => (
                          <TableRow key={g.classificacao} className="hover:bg-slate-50/60">
                            <TableCell className="sticky left-0 bg-white z-10 font-medium text-slate-800">
                              <span className="flex items-center gap-1.5">
                                {g.titulo}
                                {g.sinal < 0 && <span className="text-xs text-slate-400">(–)</span>}
                              </span>
                            </TableCell>
                            {linhasMeses.map((lm) => {
                              const v = g.valoresPorMes[lm.chave] || 0
                              return (
                                <TableCell
                                  key={lm.chave}
                                  className={`text-right tabular-nums ${
                                    lm.projetado
                                      ? 'italic text-amber-800 bg-amber-50/60 border-x border-dashed border-amber-200'
                                      : ''
                                  }`}
                                >
                                  {formatBrl(v)}
                                </TableCell>
                              )
                            })}
                            <TableCell className="text-right tabular-nums font-medium">
                              {formatBrl(g.realizadoTotal)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums italic text-amber-800 bg-amber-50/60">
                              {formatBrl(g.projetadoTotal)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums font-bold text-[#0B1F3A]">
                              {formatBrl(g.totalAno)}
                            </TableCell>
                          </TableRow>
                        ))}
                        {/* Linha de resultado */}
                        <TableRow className="bg-slate-100/70 font-semibold hover:bg-slate-100/70">
                          <TableCell className="sticky left-0 bg-slate-100/70 z-10 text-[#0B1F3A]">
                            = Lucro ou Prejuízo (Resultado)
                          </TableCell>
                          {linhasMeses.map((lm) => {
                            const rec = projecao.grupos.find((x) => x.classificacao === 'Receita')
                            const dv = projecao.grupos.find(
                              (x) => x.classificacao === 'Despesa Variável',
                            )
                            const df = projecao.grupos.find(
                              (x) => x.classificacao === 'Despesa Fixa',
                            )
                            const dfin = projecao.grupos.find(
                              (x) => x.classificacao === 'Despesa Financeira',
                            )
                            const rf = projecao.grupos.find(
                              (x) => x.classificacao === 'Receita Financeira',
                            )
                            const lp =
                              (rec?.valoresPorMes[lm.chave] || 0) -
                              (dv?.valoresPorMes[lm.chave] || 0) -
                              (df?.valoresPorMes[lm.chave] || 0) -
                              (dfin?.valoresPorMes[lm.chave] || 0) +
                              (rf?.valoresPorMes[lm.chave] || 0)
                            return (
                              <TableCell
                                key={lm.chave}
                                className={`text-right tabular-nums ${
                                  lp < 0 ? 'text-red-700' : 'text-emerald-700'
                                } ${lm.projetado ? 'italic bg-amber-50/60 border-x border-dashed border-amber-200' : ''}`}
                              >
                                {formatBrl(lp)}
                              </TableCell>
                            )
                          })}
                          <TableCell className="text-right tabular-nums">
                            {formatBrl(projecao.lucroPrejuizoRealizado)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums italic text-amber-800 bg-amber-50/60">
                            {formatBrl(projecao.lucroPrejuizoProjetado)}
                          </TableCell>
                          <TableCell
                            className={`text-right tabular-nums font-bold ${
                              projecao.lucroPrejuizoTotalAno >= 0
                                ? 'text-emerald-700'
                                : 'text-red-700'
                            }`}
                          >
                            {formatBrl(projecao.lucroPrejuizoTotalAno)}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </DoubleHorizontalScroll>
                  <p className="text-xs text-muted-foreground mt-3 flex items-start gap-1.5">
                    <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    Meses realizados seguem exatamente a DRE Gerencial (mesmo motor de cálculo). A
                    projeção é {descricaoMetodoProjecaoDre(projecao.parametrosAplicados)} — é uma
                    estimativa, não dado contábil. Mês sem movimento = zero.
                  </p>
                  <DocumentPrintFooter />
                </CardContent>
              </Card>

              <SecaoBalançoProjetado
                balancos={balancos}
                projecao={projecao}
                exercicio={exercicio}
                entidadeNome={entidadeNome}
                isGrupo={isGrupoAtivo}
                nomeGrupo={isGrupoAtivo && grupoAtivo ? grupoAtivo.nome : undefined}
              />
            </>
          )}
        </TabsContent>

        {/* Conteúdo Aba Plurianual (Próximos Anos) */}
        <TabsContent value="plurianual" className="space-y-6 mt-0">
          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-28 w-full" />
              <Skeleton className="h-96 w-full" />
            </div>
          ) : projecaoPlurianual.anosBaseHistorico.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-16 text-center">
                <CalendarClock className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                <h3 className="text-lg font-semibold text-slate-700 mb-1">
                  Sem histórico suficiente
                </h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  Não foram encontrados exercícios anteriores com lançamentos válidos para calcular
                  a média histórica das rubricas. Registre lançamentos na DRE Gerencial para gerar a
                  projeção plurianual.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Controles da Projeção Plurianual */}
              <Card className="border-slate-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg text-[#0B1F3A] flex items-center gap-2">
                    <SlidersHorizontal className="h-5 w-5 text-amber-600" />
                    Parâmetros da Projeção Plurianual
                  </CardTitle>
                  <CardDescription>
                    Configure o horizonte de anos futuros e o modelo de projeção com base na média
                    dos exercícios anteriores realizados (
                    {projecaoPlurianual.anosBaseHistorico.join(', ')}).
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap items-end gap-4">
                  {/* Quantidade de anos futuros */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                      Horizonte Futuro
                    </label>
                    <Select
                      value={String(parametrosPlurianual.anosFuturos)}
                      onValueChange={(v) =>
                        setParametrosPlurianual((p) => ({ ...p, anosFuturos: Number(v) }))
                      }
                    >
                      <SelectTrigger className="w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">+1 Ano</SelectItem>
                        <SelectItem value="2">+2 Anos</SelectItem>
                        <SelectItem value="3">+3 Anos</SelectItem>
                        <SelectItem value="4">+4 Anos</SelectItem>
                        <SelectItem value="5">+5 Anos</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Método */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                      Método de Projeção
                    </label>
                    <div className="flex rounded-md border border-slate-300 overflow-hidden">
                      <button
                        type="button"
                        onClick={() =>
                          setParametrosPlurianual((p) => ({ ...p, modo: 'media_simples' }))
                        }
                        className={`px-3 py-2 text-sm transition-colors ${
                          parametrosPlurianual.modo === 'media_simples'
                            ? 'bg-[#0B1F3A] text-white font-medium'
                            : 'bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        Média Histórica Simples
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setParametrosPlurianual((p) => ({
                            ...p,
                            modo: 'media_com_crescimento',
                          }))
                        }
                        className={`px-3 py-2 text-sm transition-colors border-l border-slate-300 ${
                          parametrosPlurianual.modo === 'media_com_crescimento'
                            ? 'bg-[#0B1F3A] text-white font-medium'
                            : 'bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        Média + Crescimento % a.a.
                      </button>
                    </div>
                  </div>

                  {/* Percentual anual */}
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="percentual-plurianual"
                      className="text-xs font-medium text-slate-500 uppercase tracking-wide"
                    >
                      Crescimento Anual (% a.a.)
                    </label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="percentual-plurianual"
                        inputMode="decimal"
                        value={String(parametrosPlurianual.percentualCrescimentoAnual).replace(
                          '.',
                          ',',
                        )}
                        disabled={parametrosPlurianual.modo !== 'media_com_crescimento'}
                        onChange={(e) => {
                          const normalizado = e.target.value
                            .trim()
                            .replace(',', '.')
                            .replace('%', '')
                            .replace(/\s/g, '')
                          if (normalizado === '' || normalizado === '-') {
                            setParametrosPlurianual((p) => ({
                              ...p,
                              percentualCrescimentoAnual: 0,
                            }))
                            return
                          }
                          const num = Number(normalizado)
                          if (!isNaN(num)) {
                            setParametrosPlurianual((p) => ({
                              ...p,
                              percentualCrescimentoAnual: num,
                            }))
                          }
                        }}
                        className="w-28"
                        placeholder="0"
                      />
                      {parametrosPlurianual.modo === 'media_com_crescimento' && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setParametrosPlurianual((p) => ({
                              ...p,
                              percentualCrescimentoAnual: 0,
                            }))
                          }
                          disabled={parametrosPlurianual.percentualCrescimentoAnual === 0}
                        >
                          Zerar
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Cards de Resumo Plurianual */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border-slate-200">
                  <CardContent className="pt-6">
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                      Média Histórica da Receita
                    </p>
                    <p className="text-2xl font-bold text-[#0B1F3A] mt-1">
                      {formatBrl(projecaoPlurianual.mediaHistoricaReceita)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Base: anos {projecaoPlurianual.anosBaseHistorico.join(', ')}
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-slate-200">
                  <CardContent className="pt-6">
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                      Média Histórica do Lucro
                    </p>
                    <p
                      className={`text-2xl font-bold mt-1 ${
                        projecaoPlurianual.mediaHistoricaLucro >= 0
                          ? 'text-emerald-700'
                          : 'text-red-700'
                      }`}
                    >
                      {formatBrl(projecaoPlurianual.mediaHistoricaLucro)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Margem média:{' '}
                      {projecaoPlurianual.mediaHistoricaReceita > 0
                        ? `${(
                            (projecaoPlurianual.mediaHistoricaLucro /
                              projecaoPlurianual.mediaHistoricaReceita) *
                            100
                          ).toFixed(1)}%`
                        : '—'}
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-slate-200">
                  <CardContent className="pt-6">
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                      Próximo Ano ({projecaoPlurianual.anosFuturosProjetados[0] || '—'})
                    </p>
                    <p
                      className={`text-2xl font-bold mt-1 ${
                        (projecaoPlurianual.lucroPrejuizoPorAno[
                          projecaoPlurianual.anosFuturosProjetados[0]
                        ] || 0) >= 0
                          ? 'text-emerald-700'
                          : 'text-red-700'
                      }`}
                    >
                      {formatBrl(
                        projecaoPlurianual.lucroPrejuizoPorAno[
                          projecaoPlurianual.anosFuturosProjetados[0]
                        ] || 0,
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Lucro estimado para o 1º ano futuro
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-slate-200">
                  <CardContent className="pt-6">
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                      Anos Futuros Projetados
                    </p>
                    <p className="text-2xl font-bold text-[#0B1F3A] mt-1">
                      {projecaoPlurianual.anosFuturosProjetados.length} ano(s)
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {projecaoPlurianual.anosFuturosProjetados.join(', ')}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Tabela Matriz Plurianual */}
              <Card className="border-slate-200">
                <CardHeader>
                  <CardTitle className="text-lg text-[#0B1F3A]">
                    DRE Plurianual — Realizado ({projecaoPlurianual.anosBaseHistorico.join(', ')}) +
                    Projetado ({projecaoPlurianual.anosFuturosProjetados.join(', ')})
                  </CardTitle>
                  <CardDescription className="flex flex-wrap items-center gap-3">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="inline-block w-3 h-3 rounded-sm bg-slate-100 border border-slate-300" />
                      Realizado (dados oficiais)
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="inline-block w-3 h-3 rounded-sm bg-amber-50 border border-amber-300" />
                      Projetado pela Média
                    </span>
                    <span className="inline-flex items-center gap-1 text-amber-700">
                      <Info className="h-3.5 w-3.5" />
                      Colunas com fundo âmbar e itálico representam os anos futuros projetados
                    </span>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <DoubleHorizontalScroll>
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50 hover:bg-slate-50">
                          <TableHead className="sticky left-0 bg-slate-50 z-10 min-w-[280px]">
                            Estrutura
                          </TableHead>
                          <TableHead className="text-right min-w-[130px] bg-slate-100 font-semibold text-slate-700">
                            Média Histórica
                          </TableHead>
                          {projecaoPlurianual.colunas.map((col) => (
                            <TableHead
                              key={col.ano}
                              className={`text-right min-w-[130px] ${
                                col.projetado
                                  ? 'italic border-b-2 border-dashed border-amber-400 text-amber-800 bg-amber-50/50'
                                  : 'text-slate-800'
                              }`}
                            >
                              {col.rotulo}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {projecaoPlurianual.grupos.map((g) => (
                          <TableRow key={g.classificacao} className="hover:bg-slate-50/60">
                            <TableCell className="sticky left-0 bg-white z-10 font-medium text-slate-800">
                              <span className="flex items-center gap-1.5">
                                {g.titulo}
                                {g.sinal < 0 && <span className="text-xs text-slate-400">(–)</span>}
                              </span>
                            </TableCell>
                            <TableCell className="text-right tabular-nums bg-slate-50/80 font-medium text-slate-700">
                              {formatBrl(g.mediaHistoricaAnual)}
                            </TableCell>
                            {projecaoPlurianual.colunas.map((col) => {
                              const v = g.valoresPorAno[col.ano] || 0
                              return (
                                <TableCell
                                  key={col.ano}
                                  className={`text-right tabular-nums ${
                                    col.projetado
                                      ? 'italic text-amber-900 bg-amber-50/60 border-x border-dashed border-amber-200'
                                      : ''
                                  }`}
                                >
                                  {formatBrl(v)}
                                </TableCell>
                              )
                            })}
                          </TableRow>
                        ))}
                        {/* Linha de Resultado (Lucro/Prejuízo) */}
                        <TableRow className="bg-slate-100/70 font-semibold hover:bg-slate-100/70">
                          <TableCell className="sticky left-0 bg-slate-100/70 z-10 text-[#0B1F3A]">
                            = Lucro ou Prejuízo (Resultado)
                          </TableCell>
                          <TableCell
                            className={`text-right tabular-nums bg-slate-200/60 font-bold ${
                              projecaoPlurianual.mediaHistoricaLucro >= 0
                                ? 'text-emerald-700'
                                : 'text-red-700'
                            }`}
                          >
                            {formatBrl(projecaoPlurianual.mediaHistoricaLucro)}
                          </TableCell>
                          {projecaoPlurianual.colunas.map((col) => {
                            const lp = projecaoPlurianual.lucroPrejuizoPorAno[col.ano] || 0
                            return (
                              <TableCell
                                key={col.ano}
                                className={`text-right tabular-nums font-bold ${
                                  lp >= 0 ? 'text-emerald-700' : 'text-red-700'
                                } ${
                                  col.projetado
                                    ? 'italic bg-amber-50/60 border-x border-dashed border-amber-200'
                                    : ''
                                }`}
                              >
                                {formatBrl(lp)}
                              </TableCell>
                            )
                          })}
                        </TableRow>
                        {/* Linha de Margem Líquida % */}
                        <TableRow className="bg-slate-50/50 hover:bg-slate-50/50 text-xs">
                          <TableCell className="sticky left-0 bg-slate-50/50 z-10 text-slate-600 font-medium">
                            Margem Líquida (%)
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-medium text-slate-700">
                            {projecaoPlurianual.mediaHistoricaReceita > 0
                              ? `${(
                                  (projecaoPlurianual.mediaHistoricaLucro /
                                    projecaoPlurianual.mediaHistoricaReceita) *
                                  100
                                ).toFixed(1)}%`
                              : '—'}
                          </TableCell>
                          {projecaoPlurianual.colunas.map((col) => {
                            const m = projecaoPlurianual.margemLiquidaPorAno[col.ano]
                            return (
                              <TableCell
                                key={col.ano}
                                className={`text-right tabular-nums ${
                                  col.projetado
                                    ? 'italic bg-amber-50/60 border-x border-dashed border-amber-200 text-amber-800'
                                    : 'text-slate-600'
                                }`}
                              >
                                {m !== null && m !== undefined ? `${m.toFixed(1)}%` : '—'}
                              </TableCell>
                            )
                          })}
                        </TableRow>
                      </TableBody>
                    </Table>
                  </DoubleHorizontalScroll>
                  <p className="text-xs text-muted-foreground mt-3 flex items-start gap-1.5">
                    <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    {projecaoPlurianual.notaMetodologica}
                  </p>
                  <DocumentPrintFooter />
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
