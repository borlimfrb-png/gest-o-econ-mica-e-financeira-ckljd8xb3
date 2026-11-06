import { useState, useEffect, useMemo } from 'react'
import { useFilter } from '@/contexts/FilterContext'
import { useToast } from '@/hooks/use-toast'
import { contasService, lancamentosService, planoContasService } from '@/services/financeService'
import type { ContaRecord, LancamentoRecord, PlanoContaRecord } from '@/types/finance'
import { gerarListaMeses } from '@/lib/dreGerencialTypes'
import { calcularDreGerencialMatriz } from '@/lib/dreGerencialCalculo'
import { calcularProjecaoDre, montarLinhasMesesProjecao } from '@/lib/projecaoDreCalculo'
import { exportarProjecaoDreExcel, exportarProjecaoDreCsv } from '@/lib/projecaoDreExport'
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
} from 'lucide-react'

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

  const [exercicio, setExercicio] = useState<number>(selectedAno || ANO_ATUAL)

  useEffect(() => {
    if (selectedAno) setExercicio(selectedAno)
  }, [selectedAno])

  const carregarDados = async () => {
    try {
      setLoading(true)
      let lancsPromise: Promise<LancamentoRecord[]>
      let contasPromise: Promise<ContaRecord[]>
      let planosPromise: Promise<PlanoContaRecord[]>

      if (isGrupoAtivo && grupoAtivo && grupoAtivo.empresas && grupoAtivo.empresas.length > 0) {
        const empIds = new Set(grupoAtivo.empresas)
        const opts = { empresasIds: grupoAtivo.empresas }
        lancsPromise = lancamentosService
          .getAll({ expandRelations: true })
          .then((list) => list.filter((l) => empIds.has(l.empresa)))
        contasPromise = contasService.getAll(opts)
        planosPromise = planoContasService.getAll(opts)
      } else if (selectedEmpresaId && !selectedEmpresaId.startsWith('grupo-')) {
        lancsPromise = lancamentosService.getAll({
          empresaId: selectedEmpresaId,
          expandRelations: true,
        })
        contasPromise = contasService.getAll({ empresaId: selectedEmpresaId })
        planosPromise = planoContasService.getAll({ empresaId: selectedEmpresaId })
      } else {
        const empOpts =
          empresasIdsAtivas.length > 0 ? { empresasIds: empresasIdsAtivas } : undefined
        lancsPromise = lancamentosService.getAll({ expandRelations: true })
        contasPromise = contasService.getAll(empOpts)
        planosPromise = planoContasService.getAll(empOpts)
      }

      const [contasList, lancamentosList, planosList] = await Promise.all([
        contasPromise,
        lancsPromise,
        planosPromise,
      ])

      setContas(Array.from(new Map(contasList.map((i) => [i.id, i])).values()))
      setLancamentos(lancamentosList)
      setPlanoContas(Array.from(new Map(planosList.map((i) => [i.id, i])).values()))
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
      ),
    [matrizAtual, matrizAnoAnterior, mesesExercicio],
  )

  const linhasMeses = useMemo(
    () => montarLinhasMesesProjecao(mesesExercicio, projecao.mesesRealizadosComMovimento),
    [mesesExercicio, projecao.mesesRealizadosComMovimento],
  )

  const temDados = projecao.mesesRealizadosComMovimento.length > 0
  const temDadosAnoAnterior = matrizAnoAnterior.lucroPrejuizo.totalPeriodo !== 0

  const entidadeNome =
    isGrupoAtivo && grupoAtivo ? grupoAtivo.nome : selectedEmpresa?.nome || 'Consolidado'

  const handleExportar = (formato: 'excel' | 'csv') => {
    const opcoes = {
      empresaNome: selectedEmpresa?.nome,
      isGrupo: isGrupoAtivo,
      nomeGrupo: isGrupoAtivo && grupoAtivo ? grupoAtivo.nome : undefined,
      exercicioAno: exercicio,
    }
    if (formato === 'excel') {
      exportarProjecaoDreExcel(projecao, mesesExercicio, opcoes)
    } else {
      exportarProjecaoDreCsv(projecao, mesesExercicio, opcoes)
    }
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
                Exercício
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
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Badge variant="outline" className="border-slate-300 text-slate-700">
                  {projecao.mesesRealizadosComMovimento.length} mês(es) realizado(s)
                </Badge>
                <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50">
                  {12 - projecao.mesesRealizadosComMovimento.length} mês(es) projetado(s)
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

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
              Nenhum lançamento com movimento em {exercicio} para esta empresa/grupo. A projeção usa
              apenas dados reais — nada é inventado. Verifique o exercício ou registre lançamentos
              na DRE Gerencial.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
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
                  Média mensal por rubrica dos meses com movimento
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
                  Projetado (média mensal)
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
                        const df = projecao.grupos.find((x) => x.classificacao === 'Despesa Fixa')
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
                          projecao.lucroPrejuizoTotalAno >= 0 ? 'text-emerald-700' : 'text-red-700'
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
                projeção aplica a média mensal de cada rubrica dos meses com movimento — é uma
                estimativa, não dado contábil. Mês sem movimento = zero.
              </p>
              <DocumentPrintFooter />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
