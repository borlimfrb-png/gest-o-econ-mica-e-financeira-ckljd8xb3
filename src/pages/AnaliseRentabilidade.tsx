import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useFilter } from '@/contexts/FilterContext'
import { useToast } from '@/hooks/use-toast'
import { useRealtime } from '@/hooks/use-realtime'
import { contasService, lancamentosService, planoContasService } from '@/services/financeService'
import type { ContaRecord, LancamentoRecord, PlanoContaRecord } from '@/types/finance'
import { gerarListaMeses } from '@/lib/dreGerencialTypes'
import {
  calcularAnaliseRentabilidade,
  type AnaliseRentabilidadeResultado,
} from '@/lib/analiseRentabilidadeCalculo'
import {
  exportarAnaliseRentabilidadeExcel,
  exportarAnaliseRentabilidadeCsv,
  formatarPercentualExport,
} from '@/lib/analiseRentabilidadeExport'
import { DocumentPrintFooter } from '@/components/DocumentPrintFooter'
import { DoubleHorizontalScroll } from '@/components/DoubleHorizontalScroll'
import { ModalClassificacaoDreLote } from '@/components/ModalClassificacaoDreLote'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ReferenceLine,
} from 'recharts'
import {
  Percent,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  Building,
  RefreshCw,
  FolderTree,
  Printer,
  Download,
  FileSpreadsheet,
  Award,
  AlertTriangle,
  Sparkles,
  PieChart,
  BarChart3,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  CheckCircle2,
} from 'lucide-react'

const MESES_OPCOES = [
  { valor: 1, nome: 'Janeiro' },
  { valor: 2, nome: 'Fevereiro' },
  { valor: 3, nome: 'Março' },
  { valor: 4, nome: 'Abril' },
  { valor: 5, nome: 'Maio' },
  { valor: 6, nome: 'Junho' },
  { valor: 7, nome: 'Julho' },
  { valor: 8, nome: 'Agosto' },
  { valor: 9, nome: 'Setembro' },
  { valor: 10, nome: 'Outubro' },
  { valor: 11, nome: 'Novembro' },
  { valor: 12, nome: 'Dezembro' },
]

function formatBrl(val: number | undefined | null): string {
  if (val === undefined || val === null || !Number.isFinite(val)) return 'R$ 0,00'
  return val.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function formatBrlCompacto(val: number): string {
  if (!Number.isFinite(val)) return 'R$ 0'
  const abs = Math.abs(val)
  const sinal = val < 0 ? '-' : ''
  if (abs >= 1_000_000) {
    return `${sinal}R$ ${(abs / 1_000_000).toFixed(1)}M`
  }
  if (abs >= 1_000) {
    return `${sinal}R$ ${(abs / 1_000).toFixed(0)}k`
  }
  return `${sinal}R$ ${abs.toFixed(0)}`
}

function formatPercent(val: number | null | undefined, casas = 2): string {
  if (val === null || val === undefined || !Number.isFinite(val)) return '—'
  return `${val >= 0 ? '+' : ''}${val.toFixed(casas)}%`
}

export default function AnaliseRentabilidade() {
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

  // Estados de dados
  const [loading, setLoading] = useState(true)
  const [lancamentos, setLancamentos] = useState<LancamentoRecord[]>([])
  const [contas, setContas] = useState<ContaRecord[]>([])
  const [planoContas, setPlanoContas] = useState<PlanoContaRecord[]>([])

  // Modal para classificação em lote do plano de contas
  const [modalClassificacaoOpen, setModalClassificacaoOpen] = useState(false)

  // Filtros de período (sincronizado com seletor global do exercício, até 12 meses)
  const currentYear = selectedAno || new Date().getFullYear()
  const [anoInicial, setAnoInicial] = useState<number>(currentYear)

  useEffect(() => {
    if (selectedAno) {
      setAnoInicial(selectedAno)
    }
  }, [selectedAno])

  const [mesInicial, setMesInicial] = useState<number>(1)
  const [qtdMeses, setQtdMeses] = useState<number>(12)
  const [avisoLimiteMeses, setAvisoLimiteMeses] = useState(false)

  // Tipo de visualização gráfica
  const [tipoVisualizacaoGrafico, setTipoVisualizacaoGrafico] = useState<
    'barras_linha' | 'linhas_margem'
  >('barras_linha')

  // Carregar dados respeitando filtro de empresa ativa / grupo econômico
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

      // Deduplicação por id por segurança
      setContas(Array.from(new Map(contasList.map((i) => [i.id, i])).values()))
      setLancamentos(lancamentosList)
      setPlanoContas(Array.from(new Map(planosList.map((i) => [i.id, i])).values()))
    } catch (err: any) {
      console.error('Erro ao carregar dados da análise de rentabilidade:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar dados',
        description: 'Não foi possível carregar os lançamentos para a análise.',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarDados()
  }, [selectedEmpresaId, isGrupoAtivo, grupoAtivo])

  // Realtime
  useRealtime<LancamentoRecord>('lancamentos', () => carregarDados())
  useRealtime<ContaRecord>('contas', () => carregarDados())
  useRealtime<PlanoContaRecord>('plano_contas', () => carregarDados())

  // Listener para evento customizado de atualização de contas
  useEffect(() => {
    const handleRecarregar = () => carregarDados()
    window.addEventListener('dre-contas-atualizadas', handleRecarregar)
    window.addEventListener('dre-contas-atualizado', handleRecarregar)
    return () => {
      window.removeEventListener('dre-contas-atualizadas', handleRecarregar)
      window.removeEventListener('dre-contas-atualizado', handleRecarregar)
    }
  }, [])

  // Validação de quantidade de meses (máximo 12)
  const handleQtdMesesChange = (novaQtd: number) => {
    if (novaQtd > 12) {
      setQtdMeses(12)
      setAvisoLimiteMeses(true)
      toast({
        variant: 'destructive',
        title: 'Limite de 12 meses',
        description: 'O período da análise é limitado a no máximo 12 meses.',
      })
    } else if (novaQtd < 1) {
      setQtdMeses(1)
      setAvisoLimiteMeses(false)
    } else {
      setQtdMeses(novaQtd)
      setAvisoLimiteMeses(false)
    }
  }

  // Lista de colunas de meses geradas para o período
  const meses = useMemo(() => {
    return gerarListaMeses(anoInicial, mesInicial, qtdMeses)
  }, [anoInicial, mesInicial, qtdMeses])

  // Cálculo da Análise de Rentabilidade reutilizando a DRE Gerencial oficial
  const analise = useMemo<AnaliseRentabilidadeResultado>(() => {
    return calcularAnaliseRentabilidade(lancamentos, contas, meses, planoContas)
  }, [lancamentos, contas, meses, planoContas])

  const periodoDescricao = useMemo(() => {
    if (meses.length === 0) return ''
    return `${meses[0].rotuloCurto} a ${meses[meses.length - 1].rotuloCurto}`
  }, [meses])

  const nomeContexto =
    isGrupoAtivo && grupoAtivo
      ? `Grupo ${grupoAtivo.nome}`
      : selectedEmpresa
        ? selectedEmpresa.nome
        : 'Todas as empresas (Consolidado Geral)'

  const handleImprimir = () => {
    window.print()
  }

  const handleExportarExcel = () => {
    try {
      exportarAnaliseRentabilidadeExcel(analise, selectedEmpresa, anoInicial)
      toast({
        title: 'Planilha Exportada com Sucesso',
        description: 'A Análise de Rentabilidade foi gerada em formato Excel (.xlsx).',
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
      exportarAnaliseRentabilidadeCsv(analise, selectedEmpresa, anoInicial)
      toast({
        title: 'Arquivo CSV Exportado',
        description: 'Delimitador padrão nacional (;) com codificação UTF-8.',
      })
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: 'Erro na exportação',
        description: e?.message || 'Falha ao gerar arquivo CSV.',
      })
    }
  }

  // Dados para o Recharts
  const dadosGrafico = useMemo(() => {
    return analise.itensPorMes.map((item) => ({
      mes: item.rotuloCurto,
      mesCompleto: item.rotuloCompleto,
      faturamento: item.faturamento,
      lucroApurado: item.lucroApurado,
      margemSobreFaturamento: item.margemSobreFaturamento ?? 0,
      margemBruta: item.margemBruta ?? 0,
      margemOperacional: item.margemOperacional ?? 0,
    }))
  }, [analise.itensPorMes])

  const margemConsolidada = analise.margemSobreFaturamentoTotal
  const margemBrutaConsolidada = analise.margemBrutaTotal
  const margemOperacionalConsolidada = analise.margemOperacionalTotal

  const getMargemBadgeColor = (val: number | null) => {
    if (val === null) return 'bg-slate-100 text-slate-600 border-slate-200'
    if (val >= 15)
      return 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300'
    if (val >= 5)
      return 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950 dark:text-blue-300'
    if (val >= 0)
      return 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300'
    return 'bg-red-100 text-red-800 border-red-300 dark:bg-red-950 dark:text-red-300'
  }

  return (
    <div className="space-y-4 animate-fadeIn pb-8 print:p-0 print:m-0">
      {/* Cabeçalho da Tela */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-100/90 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 shadow-xs">
              <Percent className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-[#0B1F3A] dark:text-slate-100 tracking-tight">
                  Análise de Rentabilidade
                </h1>
                <Badge
                  variant="outline"
                  className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800 text-[10px] font-semibold"
                >
                  DRE Gerencial
                </Badge>
              </div>
              <p className="text-[11px] text-[#5B6B7F] dark:text-slate-400">
                Acompanhamento consolidado do faturamento e lucro apurado no DRE, com margens
                percentuais e gráfico evolutivo do período selecionado.
              </p>
            </div>
          </div>
        </div>

        {/* Botões de Ações e Exportação */}
        <div className="flex items-center gap-2 flex-wrap print:hidden">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={carregarDados}
            disabled={loading}
            className="h-8 text-xs font-semibold border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 gap-1.5 cursor-pointer"
            title="Recarregar dados"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setModalClassificacaoOpen(true)}
            className="h-8 text-xs font-semibold border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 gap-1.5 cursor-pointer"
            title="Classificação DRE em lote"
          >
            <FolderTree className="w-3.5 h-3.5 text-emerald-600" />
            Classificação DRE
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => navigate('/gerencial/dre')}
            className="h-8 text-xs font-semibold border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 gap-1.5 cursor-pointer"
            title="Ir para a DRE Gerencial completa"
          >
            <BarChart3 className="w-3.5 h-3.5 text-blue-600" />
            Ver DRE Completa
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleImprimir}
            className="h-8 text-xs font-semibold border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 gap-1.5 cursor-pointer"
            title="Imprimir relatório em folha A4 / Salvar PDF"
          >
            <Printer className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
            Imprimir / PDF
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                size="sm"
                className="h-8 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-xs cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Exportar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-56 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
            >
              <DropdownMenuItem
                onClick={handleExportarExcel}
                className="text-xs cursor-pointer gap-2 py-2"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <div className="flex flex-col">
                  <span className="font-semibold text-slate-800 dark:text-slate-100">
                    Planilha Excel (.xlsx)
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                    Meses, faturamento, lucro e margens
                  </span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleExportarCsv}
                className="text-xs cursor-pointer gap-2 py-2"
              >
                <Download className="w-4 h-4 text-blue-600" />
                <div className="flex flex-col">
                  <span className="font-semibold text-slate-800 dark:text-slate-100">
                    Arquivo CSV (.csv)
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                    Delimitador ';' padrão nacional
                  </span>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Barra de Filtros e Contexto Multi-tenant */}
      <Card className="bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800 shadow-xs print:hidden">
        <CardContent className="py-3 px-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            {/* Empresa Ativa / Grupo */}
            <div className="flex items-center gap-2">
              <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <div className="text-xs">
                <span className="text-slate-500 dark:text-slate-400">Escopo da Análise: </span>
                <span className="font-bold text-[#0B1F3A] dark:text-slate-100">{nomeContexto}</span>
                {selectedEmpresa?.segmento && (
                  <Badge variant="outline" className="ml-2 text-[10px] py-0">
                    {selectedEmpresa.segmento}
                  </Badge>
                )}
                <span className="ml-2 text-slate-400">({periodoDescricao})</span>
              </div>
            </div>

            {/* Seletores de Período (Até 12 meses) */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-slate-400" />
                <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                  Início:
                </span>
                <Select
                  value={String(mesInicial)}
                  onValueChange={(val) => setMesInicial(Number(val))}
                >
                  <SelectTrigger className="h-8 text-xs bg-white dark:bg-slate-800 w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MESES_OPCOES.map((m) => (
                      <SelectItem key={m.valor} value={String(m.valor)} className="text-xs">
                        {m.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={String(anoInicial)}
                  onValueChange={(val) => setAnoInicial(Number(val))}
                >
                  <SelectTrigger className="h-8 text-xs bg-white dark:bg-slate-800 w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(anosDisponiveis && anosDisponiveis.length > 0
                      ? anosDisponiveis
                      : [anoInicial - 1, anoInicial, anoInicial + 1]
                    ).map((ano) => (
                      <SelectItem key={ano} value={String(ano)} className="text-xs">
                        {ano}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                  Meses:
                </span>
                <Input
                  type="number"
                  min={1}
                  max={12}
                  value={qtdMeses}
                  onChange={(e) => handleQtdMesesChange(Number(e.target.value))}
                  className="h-8 w-16 text-xs text-center"
                />
                <span className="text-[11px] text-slate-400">máx. 12</span>
              </div>

              {avisoLimiteMeses && (
                <Badge variant="destructive" className="text-[10px]">
                  Máximo 12 meses
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cards de KPIs de Topo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* 1. Faturamento Total */}
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-600" />
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Faturamento (Receitas)
                </p>
                <h3 className="text-xl font-extrabold text-[#0B1F3A] dark:text-slate-100 mt-1 tracking-tight tabular-nums">
                  {formatBrl(analise.faturamentoTotal)}
                </h3>
              </div>
              <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400 shadow-xs">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-2">
              <span>Período de {meses.length} mês(es)</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                Média: {formatBrl(meses.length > 0 ? analise.faturamentoTotal / meses.length : 0)}
                /mês
              </span>
            </div>
          </CardContent>
        </Card>

        {/* 2. Lucro Apurado (Resultado do DRE) */}
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
          <div
            className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${
              analise.lucroTotal >= 0 ? 'from-emerald-500 to-teal-600' : 'from-red-500 to-rose-600'
            }`}
          />
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Lucro Apurado (DRE)
                </p>
                <h3
                  className={`text-xl font-extrabold mt-1 tracking-tight tabular-nums ${
                    analise.lucroTotal >= 0
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {formatBrl(analise.lucroTotal)}
                </h3>
              </div>
              <div
                className={`p-2.5 rounded-xl shadow-xs ${
                  analise.lucroTotal >= 0
                    ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400'
                    : 'bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400'
                }`}
              >
                {analise.lucroTotal >= 0 ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <AlertTriangle className="w-5 h-5" />
                )}
              </div>
            </div>
            <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-2">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                {analise.mesesComLucro}m com lucro
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                {analise.mesesComPrejuizo}m prejuízo
              </span>
            </div>
          </CardContent>
        </Card>

        {/* 3. Margem sobre Faturamento (Margem Líquida DRE) */}
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-orange-600" />
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Margem s/ Faturamento
                </p>
                <div className="flex items-baseline gap-2 mt-1">
                  <h3
                    className={`text-xl font-extrabold tracking-tight tabular-nums ${
                      margemConsolidada !== null && margemConsolidada >= 0
                        ? 'text-[#0B1F3A] dark:text-slate-100'
                        : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    {formatPercent(margemConsolidada)}
                  </h3>
                  {margemConsolidada !== null && (
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-bold px-1.5 py-0 rounded-full ${getMargemBadgeColor(
                        margemConsolidada,
                      )}`}
                    >
                      {margemConsolidada >= 15
                        ? 'Excelente'
                        : margemConsolidada >= 5
                          ? 'Adequada'
                          : margemConsolidada >= 0
                            ? 'Atenção'
                            : 'Crítica'}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400 shadow-xs">
                <Percent className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-2">
              <span>Lucro / Faturamento</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {analise.maiorMargemMes
                  ? `Pico: ${analise.maiorMargemMes.rotulo} (${formatPercent(
                      analise.maiorMargemMes.margem,
                      1,
                    )})`
                  : '—'}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* 4. Margens Estruturais (Bruta e Operacional) */}
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 to-pink-600" />
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Margens Operacionais
                </p>
                <div className="mt-1 space-y-0.5">
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="text-slate-600 dark:text-slate-400 font-medium">
                      Margem Bruta:
                    </span>
                    <strong className="text-purple-700 dark:text-purple-300 font-bold tabular-nums">
                      {formatPercent(margemBrutaConsolidada)}
                    </strong>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="text-slate-600 dark:text-slate-400 font-medium">
                      Margem Operac.:
                    </span>
                    <strong
                      className={`font-bold tabular-nums ${
                        margemOperacionalConsolidada !== null && margemOperacionalConsolidada >= 0
                          ? 'text-teal-700 dark:text-teal-300'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {formatPercent(margemOperacionalConsolidada)}
                    </strong>
                  </div>
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400 shadow-xs">
                <Layers className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-2">
              <span>Absorção Fixa / Variável</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                Estrutura DRE
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico Principal de Evolução no Período */}
      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs">
        <CardHeader className="py-3 px-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1 rounded-md bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                <BarChart3 className="w-4 h-4" />
              </span>
              <CardTitle className="text-sm font-bold text-[#0B1F3A] dark:text-slate-100">
                Evolução Mensal: Faturamento vs Lucro Apurado
              </CardTitle>
            </div>
            <CardDescription className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Barras agrupadas de faturamento e lucro com linha de margem sobre o faturamento (%) no
              eixo secundário
            </CardDescription>
          </div>

          <div className="flex items-center gap-2 print:hidden">
            <Button
              type="button"
              variant={tipoVisualizacaoGrafico === 'barras_linha' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTipoVisualizacaoGrafico('barras_linha')}
              className="h-7 text-xs font-semibold cursor-pointer"
            >
              Faturamento × Lucro
            </Button>
            <Button
              type="button"
              variant={tipoVisualizacaoGrafico === 'linhas_margem' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTipoVisualizacaoGrafico('linhas_margem')}
              className="h-7 text-xs font-semibold cursor-pointer"
            >
              Evolução das Margens (%)
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-6">
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              {tipoVisualizacaoGrafico === 'barras_linha' ? (
                <ComposedChart
                  data={dadosGrafico}
                  margin={{ top: 15, right: 25, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#94A3B8" opacity={0.25} />
                  <XAxis
                    dataKey="mes"
                    stroke="#64748B"
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: '#CBD5E1' }}
                  />
                  {/* Eixo Esquerdo: Valores em R$ */}
                  <YAxis
                    yAxisId="left"
                    stroke="#64748B"
                    fontSize={11}
                    tickFormatter={formatBrlCompacto}
                    tickLine={false}
                    axisLine={{ stroke: '#CBD5E1' }}
                  />
                  {/* Eixo Direito: Margem em % */}
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke="#F59E0B"
                    fontSize={11}
                    tickFormatter={(v) => `${v}%`}
                    tickLine={false}
                    axisLine={{ stroke: '#F59E0B' }}
                  />
                  <ReferenceLine yAxisId="left" y={0} stroke="#94A3B8" strokeWidth={1} />
                  <ReferenceLine
                    yAxisId="right"
                    y={0}
                    stroke="#F59E0B"
                    strokeDasharray="2 2"
                    strokeWidth={1}
                  />
                  <RechartsTooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload || !payload.length) return null
                      const d = payload[0].payload
                      return (
                        <div className="bg-[#0B1F3A] text-white p-3 rounded-xl shadow-xl border border-slate-700 text-xs min-w-[220px]">
                          <p className="font-bold border-b border-white/10 pb-1.5 text-blue-200">
                            {d.mesCompleto}
                          </p>
                          <div className="space-y-1.5 mt-2">
                            <div className="flex items-center justify-between gap-3">
                              <span className="flex items-center gap-1.5 text-blue-300">
                                <span className="w-2.5 h-2.5 rounded-sm bg-[#2563EB]" />
                                Faturamento:
                              </span>
                              <strong className="font-semibold tabular-nums text-white">
                                {formatBrl(d.faturamento)}
                              </strong>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span className="flex items-center gap-1.5 text-emerald-300">
                                <span className="w-2.5 h-2.5 rounded-sm bg-[#10B981]" />
                                Lucro Apurado:
                              </span>
                              <strong
                                className={`font-semibold tabular-nums ${
                                  d.lucroApurado >= 0 ? 'text-emerald-300' : 'text-red-300'
                                }`}
                              >
                                {formatBrl(d.lucroApurado)}
                              </strong>
                            </div>
                            <div className="flex items-center justify-between gap-3 pt-1 border-t border-white/10">
                              <span className="flex items-center gap-1.5 text-amber-300">
                                <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]" />
                                Margem s/ Fat:
                              </span>
                              <strong className="font-bold tabular-nums text-amber-300">
                                {formatPercent(d.margemSobreFaturamento)}
                              </strong>
                            </div>
                          </div>
                        </div>
                      )
                    }}
                  />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    wrapperStyle={{ paddingBottom: '12px', fontSize: '11px' }}
                  />
                  <Bar
                    yAxisId="left"
                    dataKey="faturamento"
                    name="Faturamento (Receitas)"
                    fill="#2563EB"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={38}
                  />
                  <Bar
                    yAxisId="left"
                    dataKey="lucroApurado"
                    name="Lucro Apurado"
                    fill="#10B981"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={38}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="margemSobreFaturamento"
                    name="Margem sobre Faturamento (%)"
                    stroke="#F59E0B"
                    strokeWidth={2.5}
                    dot={{ fill: '#F59E0B', r: 4 }}
                    activeDot={{ r: 6, fill: '#D97706' }}
                  />
                </ComposedChart>
              ) : (
                <ComposedChart
                  data={dadosGrafico}
                  margin={{ top: 15, right: 25, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#94A3B8" opacity={0.25} />
                  <XAxis
                    dataKey="mes"
                    stroke="#64748B"
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: '#CBD5E1' }}
                  />
                  <YAxis
                    stroke="#64748B"
                    fontSize={11}
                    tickFormatter={(v) => `${v}%`}
                    tickLine={false}
                    axisLine={{ stroke: '#CBD5E1' }}
                  />
                  <ReferenceLine y={0} stroke="#94A3B8" strokeWidth={1} />
                  <RechartsTooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null
                      const d = payload[0].payload
                      return (
                        <div className="bg-[#0B1F3A] text-white p-3 rounded-xl shadow-xl border border-slate-700 text-xs min-w-[210px]">
                          <p className="font-bold border-b border-white/10 pb-1.5 text-blue-200">
                            {d.mesCompleto}
                          </p>
                          <div className="space-y-1.5 mt-2">
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-purple-300">Margem Bruta:</span>
                              <strong className="font-semibold tabular-nums text-purple-300">
                                {formatPercent(d.margemBruta)}
                              </strong>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-teal-300">Margem Operacional:</span>
                              <strong className="font-semibold tabular-nums text-teal-300">
                                {formatPercent(d.margemOperacional)}
                              </strong>
                            </div>
                            <div className="flex items-center justify-between gap-3 pt-1 border-t border-white/10">
                              <span className="text-amber-300">Margem Líquida:</span>
                              <strong className="font-bold tabular-nums text-amber-300">
                                {formatPercent(d.margemSobreFaturamento)}
                              </strong>
                            </div>
                          </div>
                        </div>
                      )
                    }}
                  />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    wrapperStyle={{ paddingBottom: '12px', fontSize: '11px' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="margemBruta"
                    name="Margem Bruta (%)"
                    stroke="#8B5CF6"
                    strokeWidth={2}
                    dot={{ fill: '#8B5CF6', r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="margemOperacional"
                    name="Margem Operacional (%)"
                    stroke="#0D9488"
                    strokeWidth={2}
                    dot={{ fill: '#0D9488', r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="margemSobreFaturamento"
                    name="Margem Líquida s/ Fat. (%)"
                    stroke="#F59E0B"
                    strokeWidth={2.5}
                    dot={{ fill: '#F59E0B', r: 4 }}
                  />
                </ComposedChart>
              )}
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Tabela Detalhada por Mês do Período */}
      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs">
        <CardHeader className="py-3 px-4 sm:px-6 flex flex-row items-center justify-between border-b border-slate-100 dark:border-slate-800">
          <div>
            <CardTitle className="text-sm font-bold text-[#0B1F3A] dark:text-slate-100">
              Demonstração Mensal de Rentabilidade ({periodoDescricao})
            </CardTitle>
            <CardDescription className="text-xs text-slate-500 dark:text-slate-400">
              Detalhamento de faturamento, custos/despesas, lucro apurado e margens percentuais
            </CardDescription>
          </div>
          <Badge
            variant="outline"
            className="text-[11px] font-semibold bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
          >
            {meses.length} mês(es) apurados
          </Badge>
        </CardHeader>

        <CardContent className="p-0">
          <DoubleHorizontalScroll>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                    <th className="py-3 px-4 text-left">Mês</th>
                    <th className="py-3 px-4 text-right">Faturamento (R$)</th>
                    <th className="py-3 px-3 text-right">Despesas Var. (R$)</th>
                    <th className="py-3 px-3 text-right">Despesas Fixas (R$)</th>
                    <th className="py-3 px-3 text-right">Res. Financeiro (R$)</th>
                    <th className="py-3 px-4 text-right">Lucro Apurado (R$)</th>
                    <th className="py-3 px-3 text-right">Margem Bruta (%)</th>
                    <th className="py-3 px-3 text-right">Margem Oper. (%)</th>
                    <th className="py-3 px-4 text-right">Margem s/ Fat (%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {analise.itensPorMes.map((item) => (
                    <tr
                      key={item.chave}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-2.5 px-4 font-semibold text-[#0B1F3A] dark:text-slate-100">
                        {item.rotuloCompleto}
                      </td>
                      <td className="py-2.5 px-4 text-right font-medium text-slate-800 dark:text-slate-200 tabular-nums">
                        {formatBrl(item.faturamento)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-600 dark:text-slate-400 tabular-nums">
                        {formatBrl(item.despesasVariaveis)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-600 dark:text-slate-400 tabular-nums">
                        {formatBrl(item.despesasFixas)}
                      </td>
                      <td
                        className={`py-2.5 px-3 text-right tabular-nums ${
                          item.resultadoFinanceiro >= 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-red-500 dark:text-red-400'
                        }`}
                      >
                        {formatBrl(item.resultadoFinanceiro)}
                      </td>
                      <td
                        className={`py-2.5 px-4 text-right font-bold tabular-nums ${
                          item.lucroApurado >= 0
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        {formatBrl(item.lucroApurado)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-purple-700 dark:text-purple-300 font-semibold tabular-nums">
                        {formatPercent(item.margemBruta)}
                      </td>
                      <td
                        className={`py-2.5 px-3 text-right font-semibold tabular-nums ${
                          item.margemOperacional !== null && item.margemOperacional >= 0
                            ? 'text-teal-700 dark:text-teal-300'
                            : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        {formatPercent(item.margemOperacional)}
                      </td>
                      <td className="py-2.5 px-4 text-right tabular-nums">
                        <span
                          className={`inline-block font-bold px-2 py-0.5 rounded-full text-[11px] ${getMargemBadgeColor(
                            item.margemSobreFaturamento,
                          )}`}
                        >
                          {formatPercent(item.margemSobreFaturamento)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100/90 dark:bg-slate-800/90 border-t-2 border-slate-300 dark:border-slate-700 font-bold text-[11.5px] text-[#0B1F3A] dark:text-slate-100">
                    <td className="py-3 px-4 uppercase tracking-wider">TOTAL DO PERÍODO</td>
                    <td className="py-3 px-4 text-right tabular-nums font-extrabold text-blue-700 dark:text-blue-300">
                      {formatBrl(analise.faturamentoTotal)}
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums text-slate-700 dark:text-slate-300">
                      {formatBrl(analise.despesasVariaveisTotal)}
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums text-slate-700 dark:text-slate-300">
                      {formatBrl(analise.despesasFixasTotal)}
                    </td>
                    <td
                      className={`py-3 px-3 text-right tabular-nums ${
                        analise.resultadoFinanceiroTotal >= 0
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {formatBrl(analise.resultadoFinanceiroTotal)}
                    </td>
                    <td
                      className={`py-3 px-4 text-right tabular-nums font-extrabold ${
                        analise.lucroTotal >= 0
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {formatBrl(analise.lucroTotal)}
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums font-bold text-purple-700 dark:text-purple-300">
                      {formatPercent(analise.margemBrutaTotal)}
                    </td>
                    <td
                      className={`py-3 px-3 text-right tabular-nums font-bold ${
                        analise.margemOperacionalTotal !== null &&
                        analise.margemOperacionalTotal >= 0
                          ? 'text-teal-700 dark:text-teal-300'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {formatPercent(analise.margemOperacionalTotal)}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums">
                      <span
                        className={`inline-block font-extrabold px-2.5 py-0.5 rounded-full text-xs ${getMargemBadgeColor(
                          analise.margemSobreFaturamentoTotal,
                        )}`}
                      >
                        {formatPercent(analise.margemSobreFaturamentoTotal)}
                      </span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </DoubleHorizontalScroll>
        </CardContent>
      </Card>

      {/* Modal para Classificação em Lote do Plano de Contas */}
      <ModalClassificacaoDreLote
        open={modalClassificacaoOpen}
        onOpenChange={setModalClassificacaoOpen}
        contas={contas}
        onSuccess={() => carregarDados()}
      />

      {/* Rodapé exclusivo de impressão A4 */}
      <DocumentPrintFooter />
    </div>
  )
}
