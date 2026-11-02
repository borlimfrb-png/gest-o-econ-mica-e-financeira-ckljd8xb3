import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Scale,
  Calendar,
  FileSpreadsheet,
  Download,
  Printer,
  Sparkles,
  ArrowLeft,
  AlertTriangle,
  TrendingUp,
  BarChart3,
  DollarSign,
  PieChart,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Info,
} from 'lucide-react'
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { BorlimLogo } from '@/components/BorlimLogo'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/contexts/AuthContext'
import { useFilter } from '@/contexts/FilterContext'
import { useRealtime } from '@/hooks/use-realtime'
import { lancamentosService } from '@/services/financeService'
import { contasService } from '@/services/financeService'
import { planoContasService } from '@/services/financeService'
import { balancosService } from '@/services/financeService'

import type {
  LancamentoRecord,
  ContaRecord,
  PlanoContaRecord,
  BalancoRecord,
} from '@/types/finance'
import {
  calcularComparativoMensalDreBalanco,
  NOMES_MESES_ABREV,
  type ComparativoDreBalancoResultado,
  type MesComparativoDreBalanco,
} from '@/lib/comparativoDreBalancoCalculo'
import {
  exportarComparativoDreBalancoExcel,
  exportarComparativoDreBalancoCsv,
} from '@/lib/comparativoDreBalancoExport'

function formatBrl(val: number | undefined | null): string {
  if (val === undefined || val === null || isNaN(val)) return 'R$ 0,00'
  return val.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function formatPercent(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return '—'
  return `${val.toFixed(2).replace('.', ',')}%`
}

function formatRatio(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return '—'
  return `${val.toFixed(2).replace('.', ',')}x`
}

export default function ComparativoMensalDreBalanco() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { user } = useAuth()
  const {
    selectedEmpresaId,
    selectedEmpresa,
    selectedAno,
    isGrupoAtivo,
    grupoAtivo,
    empresasIdsAtivas,
    anosDisponiveis,
  } = useFilter()

  const isCliente = user?.role === 'cliente'

  const [loading, setLoading] = useState(true)
  const [lancamentos, setLancamentos] = useState<LancamentoRecord[]>([])
  const [contas, setContas] = useState<ContaRecord[]>([])
  const [planoContas, setPlanoContas] = useState<PlanoContaRecord[]>([])
  const [balancos, setBalancos] = useState<BalancoRecord[]>([])

  const currentYear = selectedAno || new Date().getFullYear()
  const [anoInicial, setAnoInicial] = useState<number>(currentYear)

  useEffect(() => {
    if (selectedAno) {
      setAnoInicial(selectedAno)
    }
  }, [selectedAno])

  const isGrupoSelecionado = Boolean(
    isGrupoAtivo || (selectedEmpresaId && selectedEmpresaId.startsWith('grupo-')),
  )

  const membrosGrupoIds = useMemo(() => {
    if (grupoAtivo && grupoAtivo.empresas && grupoAtivo.empresas.length > 0) {
      return grupoAtivo.empresas
    }
    if (isGrupoSelecionado && empresasIdsAtivas.length > 0) {
      return empresasIdsAtivas
    }
    return []
  }, [grupoAtivo, isGrupoSelecionado, empresasIdsAtivas])

  const empresaIdAlvo =
    selectedEmpresaId && !selectedEmpresaId.startsWith('grupo-')
      ? selectedEmpresaId
      : selectedEmpresa?.id || null

  const nomeEntidade = useMemo(() => {
    if (isGrupoAtivo && grupoAtivo) {
      return `Grupo Econômico: ${grupoAtivo.nome}`
    }
    return selectedEmpresa?.nome || selectedEmpresa?.nome_fantasia || 'Empresa Ativa'
  }, [isGrupoAtivo, grupoAtivo, selectedEmpresa])

  // Carregar dados de Lançamentos, Contas, Plano de Contas e Balanços
  const carregarDados = async () => {
    try {
      setLoading(true)

      let lancsPromise: Promise<LancamentoRecord[]>
      let contasPromise: Promise<ContaRecord[]>
      let planosPromise: Promise<PlanoContaRecord[]>
      let balancosPromise: Promise<BalancoRecord[]>

      if (isGrupoSelecionado && membrosGrupoIds.length > 0) {
        const empIdsSet = new Set(membrosGrupoIds)
        const opts = { empresasIds: membrosGrupoIds }

        lancsPromise = lancamentosService
          .getAll({ expandRelations: true })
          .then((list) => list.filter((l) => empIdsSet.has(l.empresa)))
        contasPromise = contasService.getAll(opts)
        planosPromise = planoContasService.getAll(opts)
        balancosPromise = balancosService
          .getAll()
          .then((list) => list.filter((b) => empIdsSet.has(b.empresa)))
          .catch(() => [])
      } else if (empresaIdAlvo) {
        lancsPromise = lancamentosService.getAll({
          empresaId: empresaIdAlvo,
          expandRelations: true,
        })
        contasPromise = contasService.getAll({ empresaId: empresaIdAlvo })
        planosPromise = planoContasService.getAll({ empresaId: empresaIdAlvo })
        balancosPromise = balancosService.getByEmpresa(empresaIdAlvo).catch(() => [])
      } else if (empresasIdsAtivas.length > 0) {
        const empOpts = { empresasIds: empresasIdsAtivas }
        lancsPromise = lancamentosService.getAll({ expandRelations: true })
        contasPromise = contasService.getAll(empOpts)
        planosPromise = planoContasService.getAll(empOpts)
        balancosPromise = balancosService
          .getAll()
          .then((list) => list.filter((b) => empresasIdsAtivas.includes(b.empresa)))
          .catch(() => [])
      } else {
        lancsPromise = Promise.resolve([])
        contasPromise = Promise.resolve([])
        planosPromise = Promise.resolve([])
        balancosPromise = Promise.resolve([])
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
    } catch (err) {
      console.error('Erro ao carregar dados do Comparativo DRE x Balanço:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar dados',
        description: 'Não foi possível carregar lançamentos e balanços patrimoniais.',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarDados()
  }, [empresaIdAlvo, anoInicial, isGrupoSelecionado, membrosGrupoIds])

  useRealtime('lancamentos', () => carregarDados())
  useRealtime('contas', () => carregarDados())
  useRealtime('plano_contas', () => carregarDados())
  useRealtime('balancos', () => carregarDados())

  // Cálculo da matriz comparativa mês a mês
  const comparativo = useMemo<ComparativoDreBalancoResultado>(() => {
    return calcularComparativoMensalDreBalanco({
      ano: anoInicial,
      lancamentos,
      contas,
      planoContas,
      balancos,
      isGrupo: isGrupoSelecionado,
      membrosGrupoIds,
      empresaNome: nomeEntidade,
    })
  }, [
    anoInicial,
    lancamentos,
    contas,
    planoContas,
    balancos,
    isGrupoSelecionado,
    membrosGrupoIds,
    nomeEntidade,
  ])

  // Dados para os gráficos Recharts
  const dadosGrafico = useMemo(() => {
    return comparativo.meses.map((m) => ({
      name: m.mesAbrev,
      mesNome: m.mesNome,
      receitaBruta: m.receitaBruta,
      resultadoLiquido: m.resultadoLiquido,
      ativoTotal: m.ativoTotal,
      passivoTotal: m.passivoTotal,
      patrimonioLiquido: m.patrimonioLiquido,
      liquidezCorrente: m.liquidezCorrente,
    }))
  }, [comparativo.meses])

  const opcoesExportacao = useMemo(() => {
    return {
      empresa: selectedEmpresa,
      exercicioAno: anoInicial,
      isGrupo: isGrupoSelecionado,
      nomeGrupo: grupoAtivo?.nome || undefined,
    }
  }, [selectedEmpresa, anoInicial, isGrupoSelecionado, grupoAtivo])

  const handleExportarExcel = () => {
    try {
      exportarComparativoDreBalancoExcel(comparativo, opcoesExportacao)
      toast({
        title: 'Planilha Excel Gerada',
        description: 'Comparativo mensal DRE × Balanço exportado com sucesso.',
      })
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: 'Erro na exportação',
        description: e?.message || 'Falha ao gerar arquivo Excel.',
      })
    }
  }

  const handleExportarCsv = () => {
    try {
      exportarComparativoDreBalancoCsv(comparativo, opcoesExportacao)
      toast({
        title: 'Arquivo CSV Gerado',
        description: 'Arquivo CSV exportado com separador (;).',
      })
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: 'Erro na exportação',
        description: e?.message || 'Falha ao gerar arquivo CSV.',
      })
    }
  }

  const handleImprimir = () => {
    window.print()
  }

  // Cores de badges de indicadores
  const getBadgeLc = (val: number | null) => {
    if (val === null) return 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
    if (val >= 1.5)
      return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
    if (val >= 1.0) return 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
    return 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30'
  }

  const getBadgeRoe = (val: number | null) => {
    if (val === null) return 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
    if (val >= 15)
      return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
    if (val > 0) return 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30'
    return 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30'
  }

  const getBadgeMargem = (val: number | null) => {
    if (val === null) return 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
    if (val >= 15)
      return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
    if (val > 0) return 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
    return 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30'
  }

  return (
    <div className="space-y-6 pb-12 animate-fadeIn print:p-0 print:m-0 print:bg-white print:text-black">
      {/* Banner Superior Executivo Borlim */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#0B1F3A] via-[#0E284E] to-[#143A6E] border border-blue-900/40 p-6 sm:p-7 text-white shadow-xl shadow-slate-900/10 print:hidden">
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-2.5 max-w-3xl">
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => navigate('/analise-economica-financeira')}
                className="h-7 px-2 text-xs text-sky-200 hover:text-white hover:bg-white/10 gap-1 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Voltar ao Hub
              </Button>
              <span className="text-slate-400">·</span>
              <BorlimLogo
                size="sm"
                variant="light"
                showSubtitle={false}
                className="shadow-xs scale-90 origin-left"
              />
              <Badge className="bg-emerald-500/20 text-emerald-200 border-emerald-400/30 text-xs font-semibold px-2.5 py-0.5 backdrop-blur-md">
                <Sparkles className="w-3 h-3 mr-1 text-emerald-300" />
                DRE (Fluxo) × Balanço (Estoque)
              </Badge>
              {isGrupoSelecionado && (
                <Badge className="bg-purple-500/25 text-purple-200 border-purple-400/40 text-xs font-bold px-2 py-0.5">
                  Grupo Consolidado
                </Badge>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2.5">
              <span>Comparativo Mensal DRE × Balanço Patrimonial</span>
            </h1>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Visão simultânea mês a mês (Jan–Dez) da geração de riqueza operacional (DRE) versus a
              estrutura patrimonial e solvência (Balanço), apurada a partir da base oficial de
              lançamentos e balanços.
            </p>
          </div>

          {/* Controles de Período e Exportação */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0 bg-white/5 border border-white/15 p-3 rounded-2xl backdrop-blur-md">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-300" />
              <Select
                value={String(anoInicial)}
                onValueChange={(val) => setAnoInicial(Number(val))}
              >
                <SelectTrigger className="h-8 w-24 bg-white/10 border-white/20 text-xs text-white">
                  <SelectValue placeholder="Ano" />
                </SelectTrigger>
                <SelectContent className="bg-[#0B1F3A] border-slate-700 text-white">
                  {(anosDisponiveis || [anoInicial, anoInicial - 1, anoInicial - 2]).map((ano) => (
                    <SelectItem key={ano} value={String(ano)} className="text-xs">
                      {ano}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Exportações (desabilitadas em perfil cliente quando aplicável) */}
            {!isCliente && (
              <div className="flex items-center gap-1.5 border-t sm:border-t-0 sm:border-l border-white/15 pt-2 sm:pt-0 sm:pl-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleExportarExcel}
                  className="h-8 px-2.5 text-xs bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-200 border-emerald-400/30 gap-1.5 cursor-pointer"
                  title="Exportar Excel"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span className="hidden lg:inline">Excel</span>
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleExportarCsv}
                  className="h-8 px-2.5 text-xs bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-200 border-cyan-400/30 gap-1.5 cursor-pointer"
                  title="Exportar CSV"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden lg:inline">CSV</span>
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleImprimir}
                  className="h-8 px-2.5 text-xs bg-white/10 hover:bg-white/20 text-white border-white/20 gap-1.5 cursor-pointer"
                  title="Imprimir Relatório A4"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span className="hidden lg:inline">PDF/A4</span>
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Banner Identificador de Impressão A4 */}
      <div className="hidden print:block mb-6 border-b-2 border-slate-900 pb-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-slate-900 uppercase tracking-tight">
              Comparativo Mensal DRE × Balanço Patrimonial
            </h1>
            <p className="text-xs text-slate-600 mt-0.5">
              Entidade: <strong>{nomeEntidade}</strong> | Exercício: <strong>{anoInicial}</strong>
            </p>
          </div>
          <BorlimLogo size="sm" variant="dark" />
        </div>
      </div>

      {/* Alerta de ausência de balanço se nenhum mês contiver balanço */}
      {comparativo.mesesComBalancoCount === 0 && (
        <Card className="bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 shadow-sm print:hidden">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <div className="text-xs sm:text-sm">
              <strong>Nota sobre o Balanço Patrimonial:</strong> Nenhum registro de balanço com
              valores reais foi encontrado para o exercício {anoInicial}. Os números de fluxo da DRE
              permanecem visíveis normalmente, enquanto as linhas de Ativo, Passivo e Liquidez
              aguardam o lançamento ou importação do balancete.
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cards de Resumo Executivo do Exercício */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Receita Bruta Total */}
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] uppercase font-bold text-slate-400">
                Receita Bruta Acumulada
              </span>
              <div className="text-lg font-extrabold text-slate-900 dark:text-slate-100">
                {formatBrl(comparativo.totalExercicio.receitaBruta)}
              </div>
              <div className="text-[11px] text-slate-500">Fluxo DRE no exercício {anoInicial}</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        {/* Resultado Líquido Total */}
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] uppercase font-bold text-slate-400">
                Resultado Líquido (Lucro/Prej.)
              </span>
              <div
                className={`text-lg font-extrabold ${
                  comparativo.totalExercicio.resultadoLiquido >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {formatBrl(comparativo.totalExercicio.resultadoLiquido)}
              </div>
              <div className="text-[11px] text-slate-500">
                Margem Líquida: {formatPercent(comparativo.totalExercicio.margemLiquida)}
              </div>
            </div>
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                comparativo.totalExercicio.resultadoLiquido >= 0
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                  : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400'
              }`}
            >
              <DollarSign className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        {/* Ativo Total (Posição Final) */}
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] uppercase font-bold text-slate-400">
                Ativo Total (Posição Final)
              </span>
              <div className="text-lg font-extrabold text-slate-900 dark:text-slate-100">
                {formatBrl(comparativo.totalExercicio.ativoTotal)}
              </div>
              <div className="text-[11px] text-slate-500">
                {comparativo.totalExercicio.ultimoMesComBalanco
                  ? `Posição apurada em ${NOMES_MESES_ABREV[comparativo.totalExercicio.ultimoMesComBalanco - 1]}`
                  : 'Sem balanço preenchido'}
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
              <Layers className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        {/* Patrimônio Líquido e ROE */}
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] uppercase font-bold text-slate-400">
                Patrimônio Líquido & ROE
              </span>
              <div className="text-lg font-extrabold text-slate-900 dark:text-slate-100">
                {formatBrl(comparativo.totalExercicio.patrimonioLiquido)}
              </div>
              <div className="text-[11px] text-slate-500">
                ROE do Exercício: {formatPercent(comparativo.totalExercicio.roeAcumulado)}
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Scale className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Seção Gráfica: Fluxo (DRE) vs Estoque (Balanço) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 print:break-inside-avoid">
        {/* Gráfico 1: Resultado Líquido Mensal (Barra) vs Patrimônio Líquido (Linha) */}
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
              <BarChart3 className="w-4 h-4 text-emerald-500" />
              Resultado Líquido (DRE) vs. Patrimônio Líquido (Balanço)
            </CardTitle>
            <CardDescription className="text-xs">
              Evolução mensal do lucro líquido gerado em relação à base de capital próprio (PL).
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={dadosGrafico}
                  margin={{ top: 10, right: 20, bottom: 0, left: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis
                    yAxisId="left"
                    tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`}
                    tick={{ fontSize: 10 }}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`}
                    tick={{ fontSize: 10 }}
                  />
                  <Tooltip
                    formatter={(val: any, name: any) => [
                      formatBrl(Number(val)),
                      name === 'resultadoLiquido'
                        ? 'Resultado Líquido (DRE)'
                        : 'Patrimônio Líquido (Balanço)',
                    ]}
                    labelFormatter={(label) => `Mês: ${label}/${anoInicial}`}
                    contentStyle={{
                      backgroundColor: '#0B1F3A',
                      borderColor: '#1E3A8A',
                      color: '#FFFFFF',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Legend
                    verticalAlign="top"
                    wrapperStyle={{ fontSize: '11px', paddingBottom: '10px' }}
                  />
                  <Bar
                    yAxisId="left"
                    dataKey="resultadoLiquido"
                    name="Resultado Líquido"
                    fill="#10B981"
                    radius={[4, 4, 0, 0]}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="patrimonioLiquido"
                    name="Patrimônio Líquido"
                    stroke="#3B82F6"
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Gráfico 2: Receita Bruta (Fluxo) vs Ativo Total (Estoque) */}
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
              <TrendingUp className="w-4 h-4 text-sky-500" />
              Receita Bruta (DRE) vs. Ativo Total (Balanço)
            </CardTitle>
            <CardDescription className="text-xs">
              Capacidade de geração de receita mensal comparada ao volume de ativos mobilizados.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={dadosGrafico}
                  margin={{ top: 10, right: 20, bottom: 0, left: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis
                    yAxisId="left"
                    tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`}
                    tick={{ fontSize: 10 }}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`}
                    tick={{ fontSize: 10 }}
                  />
                  <Tooltip
                    formatter={(val: any, name: any) => [
                      formatBrl(Number(val)),
                      name === 'receitaBruta' ? 'Receita Bruta (DRE)' : 'Ativo Total (Balanço)',
                    ]}
                    labelFormatter={(label) => `Mês: ${label}/${anoInicial}`}
                    contentStyle={{
                      backgroundColor: '#0B1F3A',
                      borderColor: '#1E3A8A',
                      color: '#FFFFFF',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Legend
                    verticalAlign="top"
                    wrapperStyle={{ fontSize: '11px', paddingBottom: '10px' }}
                  />
                  <Bar
                    yAxisId="left"
                    dataKey="receitaBruta"
                    name="Receita Bruta"
                    fill="#0EA5E9"
                    radius={[4, 4, 0, 0]}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="ativoTotal"
                    name="Ativo Total"
                    stroke="#8B5CF6"
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela Comparativa Matricial Completa: Jan a Dez + Coluna Total/Posição */}
      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <CardHeader className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Scale className="w-4 h-4 text-emerald-600" />
              Matriz Comparativa Mês a Mês ({anoInicial})
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Linhas de fluxo (DRE) somam os 12 meses; linhas patrimoniais (Balanço) refletem o
              saldo estático de cada mês e a posição do último mês na coluna final.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs font-semibold">
              {comparativo.mesesComDadosCount} meses com dados
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse text-left">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold">
                  <th className="py-2.5 px-3 min-w-[240px] sticky left-0 bg-slate-100 dark:bg-slate-800/95 z-10 shadow-xs">
                    Demonstração / Rubrica
                  </th>
                  {NOMES_MESES_ABREV.map((abrev) => (
                    <th key={abrev} className="py-2.5 px-2 text-right min-w-[100px]">
                      {abrev}
                    </th>
                  ))}
                  <th className="py-2.5 px-3 text-right min-w-[125px] bg-slate-200/80 dark:bg-slate-800 font-bold text-slate-900 dark:text-white border-l border-slate-200 dark:border-slate-700">
                    Total / Posição
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {/* SEÇÃO 1: DRE GERENCIAL (FLUXO) */}
                <tr className="bg-emerald-500/10 dark:bg-emerald-950/20 font-bold text-emerald-900 dark:text-emerald-300">
                  <td colSpan={14} className="py-2 px-3 tracking-wider uppercase text-[11px]">
                    1. Demonstração do Resultado (DRE Gerencial — Fluxo do Período)
                  </td>
                </tr>

                {/* Receita Bruta */}
                <tr className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                  <td className="py-2 px-3 font-semibold text-slate-900 dark:text-slate-100 sticky left-0 bg-white dark:bg-slate-900 z-10">
                    (+) Receita Bruta / Faturamento
                  </td>
                  {comparativo.meses.map((m) => (
                    <td
                      key={m.chave}
                      className="py-2 px-2 text-right font-medium text-slate-800 dark:text-slate-200"
                    >
                      {m.receitaBruta > 0 ? formatBrl(m.receitaBruta) : '—'}
                    </td>
                  ))}
                  <td className="py-2 px-3 text-right font-bold text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-850 border-l border-slate-100 dark:border-slate-800">
                    {formatBrl(comparativo.totalExercicio.receitaBruta)}
                  </td>
                </tr>

                {/* Receita Líquida */}
                <tr className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                  <td className="py-2 px-3 text-slate-700 dark:text-slate-300 pl-6 sticky left-0 bg-white dark:bg-slate-900 z-10">
                    (=) Receita Líquida
                  </td>
                  {comparativo.meses.map((m) => (
                    <td
                      key={m.chave}
                      className="py-2 px-2 text-right text-slate-700 dark:text-slate-300"
                    >
                      {m.receitaLiquida > 0 ? formatBrl(m.receitaLiquida) : '—'}
                    </td>
                  ))}
                  <td className="py-2 px-3 text-right font-bold text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-850 border-l border-slate-100 dark:border-slate-800">
                    {formatBrl(comparativo.totalExercicio.receitaLiquida)}
                  </td>
                </tr>

                {/* Custos / Despesas Variáveis */}
                <tr className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 text-rose-600 dark:text-rose-400">
                  <td className="py-2 px-3 pl-6 sticky left-0 bg-white dark:bg-slate-900 z-10">
                    (-) Custos / Despesas Variáveis
                  </td>
                  {comparativo.meses.map((m) => (
                    <td key={m.chave} className="py-2 px-2 text-right">
                      {m.custosVariaveis > 0 ? `-${formatBrl(m.custosVariaveis)}` : '—'}
                    </td>
                  ))}
                  <td className="py-2 px-3 text-right font-bold bg-slate-50 dark:bg-slate-850 border-l border-slate-100 dark:border-slate-800">
                    {comparativo.totalExercicio.custosVariaveis > 0
                      ? `-${formatBrl(comparativo.totalExercicio.custosVariaveis)}`
                      : '—'}
                  </td>
                </tr>

                {/* Despesas Fixas */}
                <tr className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 text-amber-600 dark:text-amber-400">
                  <td className="py-2 px-3 pl-6 sticky left-0 bg-white dark:bg-slate-900 z-10">
                    (-) Despesas Fixas Operacionais
                  </td>
                  {comparativo.meses.map((m) => (
                    <td key={m.chave} className="py-2 px-2 text-right">
                      {m.despesasFixas > 0 ? `-${formatBrl(m.despesasFixas)}` : '—'}
                    </td>
                  ))}
                  <td className="py-2 px-3 text-right font-bold bg-slate-50 dark:bg-slate-850 border-l border-slate-100 dark:border-slate-800">
                    {comparativo.totalExercicio.despesasFixas > 0
                      ? `-${formatBrl(comparativo.totalExercicio.despesasFixas)}`
                      : '—'}
                  </td>
                </tr>

                {/* Despesas Financeiras */}
                <tr className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 text-slate-500">
                  <td className="py-2 px-3 pl-6 sticky left-0 bg-white dark:bg-slate-900 z-10">
                    (-) Despesas Financeiras
                  </td>
                  {comparativo.meses.map((m) => (
                    <td key={m.chave} className="py-2 px-2 text-right">
                      {m.despesasFinanceiras > 0 ? `-${formatBrl(m.despesasFinanceiras)}` : '—'}
                    </td>
                  ))}
                  <td className="py-2 px-3 text-right font-medium bg-slate-50 dark:bg-slate-850 border-l border-slate-100 dark:border-slate-800">
                    {comparativo.totalExercicio.despesasFinanceiras > 0
                      ? `-${formatBrl(comparativo.totalExercicio.despesasFinanceiras)}`
                      : '—'}
                  </td>
                </tr>

                {/* EBITDA Estimado */}
                <tr className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 bg-slate-50/40 dark:bg-slate-800/20 font-semibold text-slate-800 dark:text-slate-200">
                  <td className="py-2 px-3 sticky left-0 bg-slate-50 dark:bg-slate-850 z-10">
                    (=) EBITDA Estimado
                  </td>
                  {comparativo.meses.map((m) => (
                    <td key={m.chave} className="py-2 px-2 text-right">
                      {m.temDre ? formatBrl(m.ebitda) : '—'}
                    </td>
                  ))}
                  <td className="py-2 px-3 text-right font-bold bg-slate-100 dark:bg-slate-800 border-l border-slate-200 dark:border-slate-700">
                    {formatBrl(comparativo.totalExercicio.ebitda)}
                  </td>
                </tr>

                {/* Resultado Líquido */}
                <tr className="bg-emerald-500/5 dark:bg-emerald-950/20 font-bold border-t border-b border-emerald-500/20">
                  <td className="py-2 px-3 text-slate-900 dark:text-white sticky left-0 bg-emerald-50/70 dark:bg-slate-850 z-10">
                    (=) Resultado Líquido (Lucro/Prejuízo)
                  </td>
                  {comparativo.meses.map((m) => {
                    const res = m.resultadoLiquido
                    const cor = !m.temDre
                      ? 'text-slate-400'
                      : res >= 0
                        ? 'text-emerald-700 dark:text-emerald-300'
                        : 'text-rose-700 dark:text-rose-300'
                    return (
                      <td key={m.chave} className={`py-2 px-2 text-right ${cor}`}>
                        {m.temDre ? formatBrl(res) : '—'}
                      </td>
                    )
                  })}
                  <td
                    className={`py-2 px-3 text-right font-extrabold border-l border-emerald-500/20 ${
                      comparativo.totalExercicio.resultadoLiquido >= 0
                        ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-100/50 dark:bg-emerald-950/40'
                        : 'text-rose-700 dark:text-rose-300 bg-rose-100/50 dark:bg-rose-950/40'
                    }`}
                  >
                    {formatBrl(comparativo.totalExercicio.resultadoLiquido)}
                  </td>
                </tr>

                {/* Margem Líquida */}
                <tr className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 text-slate-600 dark:text-slate-400">
                  <td className="py-1.5 px-3 pl-6 sticky left-0 bg-white dark:bg-slate-900 z-10">
                    Margem Líquida (%)
                  </td>
                  {comparativo.meses.map((m) => (
                    <td key={m.chave} className="py-1.5 px-2 text-right font-mono text-[11px]">
                      {m.margemLiquida !== null ? (
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${getBadgeMargem(m.margemLiquida)}`}
                        >
                          {formatPercent(m.margemLiquida)}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                  ))}
                  <td className="py-1.5 px-3 text-right font-mono font-bold text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-850 border-l border-slate-100 dark:border-slate-800">
                    {formatPercent(comparativo.totalExercicio.margemLiquida)}
                  </td>
                </tr>

                {/* SEÇÃO 2: BALANÇO PATRIMONIAL (ESTOQUE) */}
                <tr className="bg-sky-500/10 dark:bg-sky-950/20 font-bold text-sky-900 dark:text-sky-300">
                  <td colSpan={14} className="py-2 px-3 tracking-wider uppercase text-[11px]">
                    2. Balanço Patrimonial (Posição Estática no Final de Cada Mês)
                  </td>
                </tr>

                {/* Ativo Total */}
                <tr className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 font-semibold text-slate-900 dark:text-slate-100">
                  <td className="py-2 px-3 sticky left-0 bg-white dark:bg-slate-900 z-10">
                    Ativo Total
                  </td>
                  {comparativo.meses.map((m) => (
                    <td key={m.chave} className="py-2 px-2 text-right">
                      {m.temBalanco ? formatBrl(m.ativoTotal) : '—'}
                    </td>
                  ))}
                  <td className="py-2 px-3 text-right font-bold bg-slate-50 dark:bg-slate-850 border-l border-slate-100 dark:border-slate-800">
                    {formatBrl(comparativo.totalExercicio.ativoTotal)}
                  </td>
                </tr>

                {/* Ativo Circulante */}
                <tr className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 text-slate-700 dark:text-slate-300">
                  <td className="py-1.5 px-3 pl-6 sticky left-0 bg-white dark:bg-slate-900 z-10">
                    Ativo Circulante (AC)
                  </td>
                  {comparativo.meses.map((m) => (
                    <td key={m.chave} className="py-1.5 px-2 text-right">
                      {m.temBalanco ? formatBrl(m.ativoCirculante) : '—'}
                    </td>
                  ))}
                  <td className="py-1.5 px-3 text-right font-medium bg-slate-50 dark:bg-slate-850 border-l border-slate-100 dark:border-slate-800">
                    {formatBrl(comparativo.totalExercicio.ativoCirculante)}
                  </td>
                </tr>

                {/* Caixa e Equivalentes */}
                <tr className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 text-slate-500 text-[11px]">
                  <td className="py-1 px-3 pl-9 sticky left-0 bg-white dark:bg-slate-900 z-10">
                    Caixa e Equivalentes
                  </td>
                  {comparativo.meses.map((m) => (
                    <td key={m.chave} className="py-1 px-2 text-right">
                      {m.temBalanco ? formatBrl(m.caixaEquivalentes) : '—'}
                    </td>
                  ))}
                  <td className="py-1 px-3 text-right font-medium bg-slate-50 dark:bg-slate-850 border-l border-slate-100 dark:border-slate-800">
                    {formatBrl(comparativo.totalExercicio.caixaEquivalentes)}
                  </td>
                </tr>

                {/* Contas a Receber */}
                <tr className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 text-slate-500 text-[11px]">
                  <td className="py-1 px-3 pl-9 sticky left-0 bg-white dark:bg-slate-900 z-10">
                    Contas a Receber (Clientes)
                  </td>
                  {comparativo.meses.map((m) => (
                    <td key={m.chave} className="py-1 px-2 text-right">
                      {m.temBalanco ? formatBrl(m.contasReceber) : '—'}
                    </td>
                  ))}
                  <td className="py-1 px-3 text-right font-medium bg-slate-50 dark:bg-slate-850 border-l border-slate-100 dark:border-slate-800">
                    {formatBrl(comparativo.totalExercicio.contasReceber)}
                  </td>
                </tr>

                {/* Estoques */}
                <tr className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 text-slate-500 text-[11px]">
                  <td className="py-1 px-3 pl-9 sticky left-0 bg-white dark:bg-slate-900 z-10">
                    Estoques
                  </td>
                  {comparativo.meses.map((m) => (
                    <td key={m.chave} className="py-1 px-2 text-right">
                      {m.temBalanco ? formatBrl(m.estoques) : '—'}
                    </td>
                  ))}
                  <td className="py-1 px-3 text-right font-medium bg-slate-50 dark:bg-slate-850 border-l border-slate-100 dark:border-slate-800">
                    {formatBrl(comparativo.totalExercicio.estoques)}
                  </td>
                </tr>

                {/* Ativo Não Circulante */}
                <tr className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 text-slate-700 dark:text-slate-300">
                  <td className="py-1.5 px-3 pl-6 sticky left-0 bg-white dark:bg-slate-900 z-10">
                    Ativo Não Circulante (ANC)
                  </td>
                  {comparativo.meses.map((m) => (
                    <td key={m.chave} className="py-1.5 px-2 text-right">
                      {m.temBalanco ? formatBrl(m.ativoNaoCirculante) : '—'}
                    </td>
                  ))}
                  <td className="py-1.5 px-3 text-right font-medium bg-slate-50 dark:bg-slate-850 border-l border-slate-100 dark:border-slate-800">
                    {formatBrl(comparativo.totalExercicio.ativoNaoCirculante)}
                  </td>
                </tr>

                {/* Passivo Total */}
                <tr className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 font-semibold text-slate-900 dark:text-slate-100">
                  <td className="py-2 px-3 sticky left-0 bg-white dark:bg-slate-900 z-10">
                    Passivo Total (Exigível Geral)
                  </td>
                  {comparativo.meses.map((m) => (
                    <td key={m.chave} className="py-2 px-2 text-right">
                      {m.temBalanco ? formatBrl(m.passivoTotal) : '—'}
                    </td>
                  ))}
                  <td className="py-2 px-3 text-right font-bold bg-slate-50 dark:bg-slate-850 border-l border-slate-100 dark:border-slate-800">
                    {formatBrl(comparativo.totalExercicio.passivoTotal)}
                  </td>
                </tr>

                {/* Passivo Circulante */}
                <tr className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 text-slate-700 dark:text-slate-300">
                  <td className="py-1.5 px-3 pl-6 sticky left-0 bg-white dark:bg-slate-900 z-10">
                    Passivo Circulante (PC)
                  </td>
                  {comparativo.meses.map((m) => (
                    <td key={m.chave} className="py-1.5 px-2 text-right">
                      {m.temBalanco ? formatBrl(m.passivoCirculante) : '—'}
                    </td>
                  ))}
                  <td className="py-1.5 px-3 text-right font-medium bg-slate-50 dark:bg-slate-850 border-l border-slate-100 dark:border-slate-800">
                    {formatBrl(comparativo.totalExercicio.passivoCirculante)}
                  </td>
                </tr>

                {/* Fornecedores */}
                <tr className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 text-slate-500 text-[11px]">
                  <td className="py-1 px-3 pl-9 sticky left-0 bg-white dark:bg-slate-900 z-10">
                    Fornecedores
                  </td>
                  {comparativo.meses.map((m) => (
                    <td key={m.chave} className="py-1 px-2 text-right">
                      {m.temBalanco ? formatBrl(m.fornecedores) : '—'}
                    </td>
                  ))}
                  <td className="py-1 px-3 text-right font-medium bg-slate-50 dark:bg-slate-850 border-l border-slate-100 dark:border-slate-800">
                    {formatBrl(comparativo.totalExercicio.fornecedores)}
                  </td>
                </tr>

                {/* Passivo Não Circulante */}
                <tr className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 text-slate-700 dark:text-slate-300">
                  <td className="py-1.5 px-3 pl-6 sticky left-0 bg-white dark:bg-slate-900 z-10">
                    Passivo Não Circulante (PNC)
                  </td>
                  {comparativo.meses.map((m) => (
                    <td key={m.chave} className="py-1.5 px-2 text-right">
                      {m.temBalanco ? formatBrl(m.passivoNaoCirculante) : '—'}
                    </td>
                  ))}
                  <td className="py-1.5 px-3 text-right font-medium bg-slate-50 dark:bg-slate-850 border-l border-slate-100 dark:border-slate-800">
                    {formatBrl(comparativo.totalExercicio.passivoNaoCirculante)}
                  </td>
                </tr>

                {/* Patrimônio Líquido */}
                <tr className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 bg-sky-50/40 dark:bg-sky-950/20 font-bold text-slate-900 dark:text-white">
                  <td className="py-2 px-3 sticky left-0 bg-sky-50 dark:bg-slate-850 z-10">
                    Patrimônio Líquido (PL)
                  </td>
                  {comparativo.meses.map((m) => (
                    <td key={m.chave} className="py-2 px-2 text-right">
                      {m.temBalanco ? formatBrl(m.patrimonioLiquido) : '—'}
                    </td>
                  ))}
                  <td className="py-2 px-3 text-right font-extrabold bg-sky-100/60 dark:bg-sky-950/40 border-l border-slate-200 dark:border-slate-700">
                    {formatBrl(comparativo.totalExercicio.patrimonioLiquido)}
                  </td>
                </tr>

                {/* SEÇÃO 3: INDICADORES INTEGRADOS */}
                <tr className="bg-purple-500/10 dark:bg-purple-950/20 font-bold text-purple-900 dark:text-purple-300">
                  <td colSpan={14} className="py-2 px-3 tracking-wider uppercase text-[11px]">
                    3. Indicadores Derivados Mensais (Solvência, Alavancagem e ROE)
                  </td>
                </tr>

                {/* Liquidez Corrente */}
                <tr className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                  <td className="py-2 px-3 sticky left-0 bg-white dark:bg-slate-900 z-10 font-medium text-slate-800 dark:text-slate-200">
                    Liquidez Corrente (AC / PC)
                  </td>
                  {comparativo.meses.map((m) => (
                    <td key={m.chave} className="py-2 px-2 text-right font-mono">
                      {m.liquidezCorrente !== null ? (
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${getBadgeLc(m.liquidezCorrente)}`}
                        >
                          {formatRatio(m.liquidezCorrente)}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                  ))}
                  <td className="py-2 px-3 text-right font-mono font-bold bg-slate-50 dark:bg-slate-850 border-l border-slate-100 dark:border-slate-800">
                    {formatRatio(comparativo.totalExercicio.liquidezCorrente)}
                  </td>
                </tr>

                {/* Liquidez Geral */}
                <tr className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 text-slate-600 dark:text-slate-400">
                  <td className="py-1.5 px-3 pl-6 sticky left-0 bg-white dark:bg-slate-900 z-10">
                    Liquidez Geral [(AC+RLP) / (PC+PNC)]
                  </td>
                  {comparativo.meses.map((m) => (
                    <td key={m.chave} className="py-1.5 px-2 text-right font-mono">
                      {m.liquidezGeral !== null ? formatRatio(m.liquidezGeral) : '—'}
                    </td>
                  ))}
                  <td className="py-1.5 px-3 text-right font-mono font-medium bg-slate-50 dark:bg-slate-850 border-l border-slate-100 dark:border-slate-800">
                    {formatRatio(comparativo.totalExercicio.liquidezGeral)}
                  </td>
                </tr>

                {/* Endividamento Total / PL */}
                <tr className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 text-slate-600 dark:text-slate-400">
                  <td className="py-1.5 px-3 pl-6 sticky left-0 bg-white dark:bg-slate-900 z-10">
                    Endividamento Total / PL (Passivo Total / PL)
                  </td>
                  {comparativo.meses.map((m) => (
                    <td key={m.chave} className="py-1.5 px-2 text-right font-mono">
                      {m.endividamentoTotalPl !== null ? formatRatio(m.endividamentoTotalPl) : '—'}
                    </td>
                  ))}
                  <td className="py-1.5 px-3 text-right font-mono font-medium bg-slate-50 dark:bg-slate-850 border-l border-slate-100 dark:border-slate-800">
                    {formatRatio(comparativo.totalExercicio.endividamentoTotalPl)}
                  </td>
                </tr>

                {/* Endividamento Curto Prazo (PC / PL) */}
                <tr className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 text-slate-600 dark:text-slate-400">
                  <td className="py-1.5 px-3 pl-6 sticky left-0 bg-white dark:bg-slate-900 z-10">
                    Endividamento CP / PL (PC / PL)
                  </td>
                  {comparativo.meses.map((m) => (
                    <td key={m.chave} className="py-1.5 px-2 text-right font-mono">
                      {m.endividamentoPcPl !== null ? formatRatio(m.endividamentoPcPl) : '—'}
                    </td>
                  ))}
                  <td className="py-1.5 px-3 text-right font-mono font-medium bg-slate-50 dark:bg-slate-850 border-l border-slate-100 dark:border-slate-800">
                    {formatRatio(comparativo.totalExercicio.endividamentoPcPl)}
                  </td>
                </tr>

                {/* ROE Mensal / Acumulado */}
                <tr className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 bg-purple-50/30 dark:bg-purple-950/20 font-semibold">
                  <td className="py-2 px-3 sticky left-0 bg-purple-50/50 dark:bg-slate-850 z-10 text-slate-900 dark:text-slate-100">
                    ROE (Resultado Líquido / PL %)
                  </td>
                  {comparativo.meses.map((m) => (
                    <td key={m.chave} className="py-2 px-2 text-right font-mono">
                      {m.roeMensal !== null ? (
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${getBadgeRoe(m.roeMensal)}`}
                        >
                          {formatPercent(m.roeMensal)}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                  ))}
                  <td className="py-2 px-3 text-right font-mono font-extrabold bg-purple-100/50 dark:bg-purple-950/40 border-l border-slate-200 dark:border-slate-700">
                    {formatPercent(comparativo.totalExercicio.roeAcumulado)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
