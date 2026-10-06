import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFilter } from '@/contexts/FilterContext'
import { useToast } from '@/hooks/use-toast'
import { useRealtime } from '@/hooks/use-realtime'
import { contasService, lancamentosService, planoContasService } from '@/services/financeService'
import type { ContaRecord, LancamentoRecord, PlanoContaRecord } from '@/types/finance'
import { gerarListaMeses } from '@/lib/dreGerencialTypes'
import {
  calcularComparativoDespesas,
  classificarSemaforoPercentual,
  getClassesSemaforoPercentual,
  type ComparativoDespesasResultado,
} from '@/lib/comparativoDespesasCalculo'
import {
  exportarComparativoDespesasExcel,
  exportarComparativoDespesasCsv,
  formatarPercentualExport,
} from '@/lib/comparativoDespesasExport'
import { DocumentPrintFooter } from '@/components/DocumentPrintFooter'
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
  Scale,
  Calendar,
  Download,
  FileSpreadsheet,
  Printer,
  AlertTriangle,
  Building,
  RefreshCw,
  FolderTree,
  TrendingDown,
  Percent,
  Info,
  DollarSign,
  ArrowRight,
  Sparkles,
  PieChart as PieChartIcon,
  BarChart3,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
} from 'lucide-react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  Line,
  ComposedChart,
} from 'recharts'

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

function formatMoedaCompacta(val: number): string {
  if (Math.abs(val) >= 1_000_000) {
    return `R$ ${(val / 1_000_000).toFixed(1)}M`
  }
  if (Math.abs(val) >= 1_000) {
    return `R$ ${(val / 1_000).toFixed(0)}k`
  }
  return `R$ ${val.toFixed(0)}`
}

export default function ComparativoDespesasAnalise() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { selectedEmpresaId, selectedEmpresa, selectedAno, isGrupoAtivo, grupoAtivo } = useFilter()

  // Estados de dados
  const [loading, setLoading] = useState(true)
  const [lancamentos, setLancamentos] = useState<LancamentoRecord[]>([])
  const [contas, setContas] = useState<ContaRecord[]>([])
  const [planoContas, setPlanoContas] = useState<PlanoContaRecord[]>([])

  // Modal de classificação DRE
  const [modalClassificacaoOpen, setModalClassificacaoOpen] = useState(false)

  // Filtros de período (sincronizado com seletor global, até 12 meses)
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

  // Controle de expansão de contas detalhadas
  const [expandirContasFixas, setExpandirContasFixas] = useState(true)
  const [expandirContasVariaveis, setExpandirContasVariaveis] = useState(true)

  // Carregar dados respeitando filtro de empresa / grupo
  const carregarDados = async () => {
    try {
      setLoading(true)

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

      const [contasList, lancamentosList, planosList] = await Promise.all([
        contasPromise,
        lancsPromise,
        planosPromise,
      ])

      setContas(contasList)
      setLancamentos(lancamentosList)
      setPlanoContas(planosList)
    } catch (err: any) {
      console.error('Erro ao carregar dados do comparativo de despesas:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar dados',
        description: 'Não foi possível carregar os lançamentos e contas.',
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

  useEffect(() => {
    const handleRecarregar = () => carregarDados()
    window.addEventListener('dre-contas-atualizadas', handleRecarregar)
    window.addEventListener('dre-contas-atualizado', handleRecarregar)
    return () => {
      window.removeEventListener('dre-contas-atualizadas', handleRecarregar)
      window.removeEventListener('dre-contas-atualizado', handleRecarregar)
    }
  }, [])

  const handleQtdMesesChange = (novaQtd: number) => {
    if (novaQtd > 12) {
      setQtdMeses(12)
      setAvisoLimiteMeses(true)
      toast({
        variant: 'destructive',
        title: 'Limite de 12 meses',
        description: 'O período do comparativo é limitado a no máximo 12 meses.',
      })
    } else if (novaQtd < 1) {
      setQtdMeses(1)
      setAvisoLimiteMeses(false)
    } else {
      setQtdMeses(novaQtd)
      setAvisoLimiteMeses(false)
    }
  }

  const meses = useMemo(() => {
    return gerarListaMeses(anoInicial, mesInicial, qtdMeses)
  }, [anoInicial, mesInicial, qtdMeses])

  // Cálculo da matriz e diagnóstico
  const comparativo = useMemo<ComparativoDespesasResultado>(() => {
    return calcularComparativoDespesas(lancamentos, contas, meses, planoContas)
  }, [lancamentos, contas, meses, planoContas])

  const handleImprimir = () => {
    window.print()
  }

  const handleExportarExcel = () => {
    try {
      exportarComparativoDespesasExcel(comparativo, selectedEmpresa, anoInicial)
      toast({
        title: 'Comparativo Exportado',
        description: 'Planilha Excel gerada com Fixas × Variáveis e pesos sobre o faturamento.',
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
      exportarComparativoDespesasCsv(comparativo, selectedEmpresa, anoInicial)
      toast({
        title: 'Comparativo Exportado',
        description: 'Arquivo CSV com delimitador brasileiro gerado com sucesso.',
      })
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: 'Erro na exportação',
        description: e?.message || 'Falha ao gerar arquivo CSV.',
      })
    }
  }

  // Dados para gráficos Recharts
  const dadosGraficoEvolucao = useMemo(() => {
    return comparativo.itensMes.map((m) => ({
      mes: m.rotuloCurto,
      Faturamento: m.faturamento,
      'Despesas Fixas': m.totalFixas,
      'Despesas Variáveis': m.totalVariaveis,
      'Total Despesas': m.totalDespesas,
      'Peso Fixas (%)': m.pctFixas ?? 0,
      'Peso Variáveis (%)': m.pctVariaveis ?? 0,
      'Peso Total (%)': m.pctTotal ?? 0,
    }))
  }, [comparativo.itensMes])

  const dadosGraficoPizza = useMemo(() => {
    const list = []
    if (comparativo.totalFixasPeriodo > 0) {
      list.push({
        name: 'Despesas Fixas',
        valor: comparativo.totalFixasPeriodo,
        percentual: comparativo.pesoFixasSobreTotalDespesas ?? 0,
        cor: '#E11D48', // rose-600
      })
    }
    if (comparativo.totalVariaveisPeriodo > 0) {
      list.push({
        name: 'Despesas Variáveis',
        valor: comparativo.totalVariaveisPeriodo,
        percentual: comparativo.pesoVariaveisSobreTotalDespesas ?? 0,
        cor: '#2563EB', // blue-600
      })
    }
    return list
  }, [
    comparativo.totalFixasPeriodo,
    comparativo.totalVariaveisPeriodo,
    comparativo.pesoFixasSobreTotalDespesas,
    comparativo.pesoVariaveisSobreTotalDespesas,
  ])

  // Semáforos consolidados
  const semaforoFixas = classificarSemaforoPercentual(comparativo.pctFixasPeriodo)
  const semaforoVariaveis = classificarSemaforoPercentual(comparativo.pctVariaveisPeriodo)
  const semaforoTotal = classificarSemaforoPercentual(comparativo.pctTotalPeriodo)

  return (
    <div className="space-y-4 animate-fadeIn pb-6 print:p-0 print:m-0">
      {/* Cabeçalho da tela */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-indigo-100/80 text-indigo-800 shadow-xs">
              <Scale className="w-5 h-5 text-indigo-700" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-[#0B1F3A] tracking-tight">
                  Comparativo Fixas × Variáveis
                </h1>
                <Badge
                  variant="outline"
                  className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[10px] font-semibold"
                >
                  Peso sobre Faturamento
                </Badge>
              </div>
              <p className="text-[11px] text-[#5B6B7F]">
                Análise comparativa simultânea da estrutura de custos: proporção de despesas fixas e
                variáveis, peso sobre o faturamento mês a mês e diagnóstico de alavancagem
                operacional.
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
            className="h-8 text-xs font-semibold border-slate-200 hover:bg-slate-50 text-slate-700 gap-1.5 cursor-pointer"
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
            className="h-8 text-xs font-semibold border-slate-200 hover:bg-slate-50 text-slate-700 gap-1.5 cursor-pointer"
            title="Abrir classificação DRE em lote"
          >
            <FolderTree className="w-3.5 h-3.5 text-blue-600" />
            Classificação DRE
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleImprimir}
            className="h-8 text-xs font-semibold border-slate-200 hover:bg-slate-50 text-slate-700 gap-1.5 cursor-pointer"
            title="Imprimir relatório em folha A4 / Salvar PDF"
          >
            <Printer className="w-3.5 h-3.5 text-slate-600" />
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
            <DropdownMenuContent align="end" className="w-60 bg-white">
              <DropdownMenuItem
                onClick={handleExportarExcel}
                className="text-xs cursor-pointer gap-2 py-2"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <div className="flex flex-col">
                  <span className="font-semibold text-slate-800">Planilha Excel (.xlsx)</span>
                  <span className="text-[10px] text-slate-500">
                    Fixas, Variáveis e % Faturamento
                  </span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleExportarCsv}
                className="text-xs cursor-pointer gap-2 py-2"
              >
                <Download className="w-4 h-4 text-blue-600" />
                <div className="flex flex-col">
                  <span className="font-semibold text-slate-800">Arquivo CSV (.csv)</span>
                  <span className="text-[10px] text-slate-500">
                    Padrão brasileiro delimitado por ';'
                  </span>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Barra de Filtros e Contexto Multi-tenant */}
      <Card className="bg-white border-slate-200/90 shadow-xs print:hidden">
        <CardContent className="py-3 px-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            {/* Empresa Ativa / Grupo */}
            <div className="flex items-center gap-2">
              <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <div className="text-xs">
                <span className="text-slate-500">Contexto: </span>
                <span className="font-bold text-[#0B1F3A]">
                  {isGrupoAtivo && grupoAtivo
                    ? `Grupo ${grupoAtivo.nome}`
                    : selectedEmpresa
                      ? selectedEmpresa.nome
                      : 'Todas as empresas (Consolidado Geral)'}
                </span>
                {selectedEmpresa?.segmento && (
                  <Badge variant="outline" className="ml-2 text-[10px] py-0">
                    {selectedEmpresa.segmento}
                  </Badge>
                )}
              </div>
            </div>

            {/* Seletores de Período (Até 12 meses) */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-slate-400" />
                <span className="text-xs text-slate-600 font-medium">Início:</span>
                <Select
                  value={String(mesInicial)}
                  onValueChange={(val) => setMesInicial(Number(val))}
                >
                  <SelectTrigger className="h-8 text-xs bg-white w-28 cursor-pointer">
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

                <Input
                  type="number"
                  value={anoInicial}
                  onChange={(e) => setAnoInicial(Number(e.target.value) || currentYear)}
                  className="h-8 w-20 text-xs font-semibold"
                  min={2000}
                  max={2100}
                />
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-600 font-medium">Qtd Meses:</span>
                <Input
                  type="number"
                  min={1}
                  max={12}
                  value={qtdMeses}
                  onChange={(e) => handleQtdMesesChange(Number(e.target.value))}
                  className="h-8 w-16 text-xs text-center font-bold"
                />
                <span className="text-[11px] text-slate-400">(máx 12)</span>
              </div>

              {/* Guia Semafórico Rápido */}
              <div className="hidden xl:flex items-center gap-2 pl-2 border-l border-slate-200 text-[10.5px]">
                <span className="text-slate-500 font-medium">Índice %:</span>
                <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold">
                  &lt;25% Baixo
                </span>
                <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-semibold">
                  25-40% Médio
                </span>
                <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-200 font-bold">
                  &gt;40% Alto
                </span>
              </div>
            </div>
          </div>

          {avisoLimiteMeses && (
            <div className="mt-3 flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 p-2 rounded-lg">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
              <span>O período foi ajustado automaticamente para o limite máximo de 12 meses.</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cards de Resumo Executivo (6 Cards: Totais e Percentuais de cada categoria) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5 print:grid-cols-6">
        {/* Total Despesas Fixas */}
        <Card className="bg-white border-slate-200/90 shadow-xs hover:border-slate-300 transition-colors">
          <CardContent className="py-2.5 px-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                Total Fixas
              </p>
              <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
            </div>
            <p className="text-sm font-bold text-rose-700 mt-0.5 truncate">
              {formatBrl(comparativo.totalFixasPeriodo)}
            </p>
            <p className="text-[9.5px] text-slate-500 mt-0.5 truncate">
              {comparativo.pesoFixasSobreTotalDespesas !== null
                ? `${comparativo.pesoFixasSobreTotalDespesas.toFixed(1)}% dos gastos`
                : '—'}
            </p>
          </CardContent>
        </Card>

        {/* % Fixas / Faturamento */}
        <Card
          className={`border shadow-xs ${
            semaforoFixas === 'verde'
              ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950'
              : semaforoFixas === 'ambar'
                ? 'bg-amber-50/70 border-amber-300 text-amber-950'
                : semaforoFixas === 'vermelho'
                  ? 'bg-rose-50/70 border-rose-300 text-rose-950'
                  : 'bg-white border-slate-200'
          }`}
        >
          <CardContent className="py-2.5 px-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-wider">% Fixas / Fat.</p>
              <Percent className="w-3.5 h-3.5 shrink-0 opacity-80" />
            </div>
            <p className="text-sm font-extrabold mt-0.5 truncate">
              {formatarPercentualExport(comparativo.pctFixasPeriodo)}
            </p>
            <p className="text-[9.5px] font-medium opacity-85 mt-0.5 truncate">
              {semaforoFixas === 'verde'
                ? 'Carga fixa saudável (<25%)'
                : semaforoFixas === 'ambar'
                  ? 'Atenção (25–40%)'
                  : semaforoFixas === 'vermelho'
                    ? 'Carga alta (>40%)'
                    : 'Sem base'}
            </p>
          </CardContent>
        </Card>

        {/* Total Despesas Variáveis */}
        <Card className="bg-white border-slate-200/90 shadow-xs hover:border-slate-300 transition-colors">
          <CardContent className="py-2.5 px-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                Total Variáveis
              </p>
              <PieChartIcon className="w-3.5 h-3.5 text-blue-600" />
            </div>
            <p className="text-sm font-bold text-blue-700 mt-0.5 truncate">
              {formatBrl(comparativo.totalVariaveisPeriodo)}
            </p>
            <p className="text-[9.5px] text-slate-500 mt-0.5 truncate">
              {comparativo.pesoVariaveisSobreTotalDespesas !== null
                ? `${comparativo.pesoVariaveisSobreTotalDespesas.toFixed(1)}% dos gastos`
                : '—'}
            </p>
          </CardContent>
        </Card>

        {/* % Variáveis / Faturamento */}
        <Card
          className={`border shadow-xs ${
            semaforoVariaveis === 'verde'
              ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950'
              : semaforoVariaveis === 'ambar'
                ? 'bg-amber-50/70 border-amber-300 text-amber-950'
                : semaforoVariaveis === 'vermelho'
                  ? 'bg-rose-50/70 border-rose-300 text-rose-950'
                  : 'bg-white border-slate-200'
          }`}
        >
          <CardContent className="py-2.5 px-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-wider">% Variáveis / Fat.</p>
              <Percent className="w-3.5 h-3.5 shrink-0 opacity-80" />
            </div>
            <p className="text-sm font-extrabold mt-0.5 truncate">
              {formatarPercentualExport(comparativo.pctVariaveisPeriodo)}
            </p>
            <p className="text-[9.5px] font-medium opacity-85 mt-0.5 truncate">
              {semaforoVariaveis === 'verde'
                ? 'Consumo proporcional'
                : semaforoVariaveis === 'ambar'
                  ? 'Atenção comercial'
                  : semaforoVariaveis === 'vermelho'
                    ? 'Erosão de margem'
                    : 'Sem base'}
            </p>
          </CardContent>
        </Card>

        {/* Faturamento do Período */}
        <Card className="bg-white border-slate-200/90 shadow-xs hover:border-slate-300 transition-colors">
          <CardContent className="py-2.5 px-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                Faturamento Total
              </p>
              <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <p className="text-sm font-bold text-emerald-700 mt-0.5 truncate">
              {formatBrl(comparativo.faturamentoTotalPeriodo)}
            </p>
            <p className="text-[9.5px] text-slate-500 mt-0.5 truncate">Base Receitas DRE</p>
          </CardContent>
        </Card>

        {/* % Total Despesas / Faturamento */}
        <Card
          className={`border shadow-xs ${
            semaforoTotal === 'verde'
              ? 'bg-gradient-to-br from-emerald-50/90 to-emerald-100/50 border-emerald-300 text-emerald-950'
              : semaforoTotal === 'ambar'
                ? 'bg-gradient-to-br from-amber-50/90 to-amber-100/50 border-amber-300 text-amber-950'
                : semaforoTotal === 'vermelho'
                  ? 'bg-gradient-to-br from-rose-50/90 to-rose-100/50 border-rose-300 text-rose-950'
                  : 'bg-white border-slate-200'
          }`}
        >
          <CardContent className="py-2.5 px-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-wider">% Total / Fat.</p>
              <Scale className="w-3.5 h-3.5 shrink-0 opacity-80" />
            </div>
            <p className="text-base font-extrabold mt-0.5 truncate">
              {formatarPercentualExport(comparativo.pctTotalPeriodo)}
            </p>
            <p className="text-[9.5px] font-medium opacity-85 mt-0.5 truncate">
              Fixas + Variáveis sobre Fat.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Cabeçalho para impressão */}
      <div className="hidden print:block mb-4 border-b border-slate-300 pb-2">
        <h2 className="text-lg font-bold text-slate-900">
          COMPARATIVO DE DESPESAS FIXAS × VARIÁVEIS (PESO SOBRE O FATURAMENTO)
        </h2>
        <p className="text-xs text-slate-600">
          Empresa / Grupo:{' '}
          {isGrupoAtivo && grupoAtivo
            ? `Grupo ${grupoAtivo.nome}`
            : selectedEmpresa
              ? selectedEmpresa.nome
              : 'Consolidado'}{' '}
          · Período: {meses[0]?.rotuloCurto} a {meses[meses.length - 1]?.rotuloCurto} (
          {meses.length} meses)
        </p>
      </div>

      {/* Gráficos Recharts (Evolução Mensal & Composição de Custos) */}
      {comparativo.temDados && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 print:hidden">
          {/* Gráfico 1: Evolução Mensal - Faturamento vs Despesas Fixas vs Despesas Variáveis */}
          <Card className="lg:col-span-2 bg-white border-slate-200/90 shadow-xs">
            <CardHeader className="py-3 px-4 border-b border-slate-100 bg-slate-50/40 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-xs font-bold text-[#0B1F3A] flex items-center gap-1.5">
                  <BarChart3 className="w-4 h-4 text-blue-600" />
                  Evolução Mensal: Faturamento × Fixas × Variáveis
                </CardTitle>
                <CardDescription className="text-[10.5px]">
                  Barras agrupadas de Fixas e Variáveis comparadas à curva de Faturamento (R$).
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-3 pt-4">
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={dadosGraficoEvolucao}
                    margin={{ top: 10, right: 15, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                    <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#64748B' }} />
                    <YAxis
                      yAxisId="esq"
                      tick={{ fontSize: 10, fill: '#64748B' }}
                      tickFormatter={formatMoedaCompacta}
                    />
                    <RechartsTooltip
                      formatter={(val: any, name: any) => [formatBrl(Number(val)), name]}
                      labelFormatter={(label) => `Mês: ${label}`}
                    />
                    <Legend
                      verticalAlign="top"
                      height={28}
                      wrapperStyle={{ fontSize: '11px', paddingTop: '0px' }}
                    />
                    <Bar
                      yAxisId="esq"
                      dataKey="Despesas Fixas"
                      fill="#E11D48"
                      radius={[3, 3, 0, 0]}
                      maxBarSize={22}
                    />
                    <Bar
                      yAxisId="esq"
                      dataKey="Despesas Variáveis"
                      fill="#2563EB"
                      radius={[3, 3, 0, 0]}
                      maxBarSize={22}
                    />
                    <Line
                      yAxisId="esq"
                      type="monotone"
                      dataKey="Faturamento"
                      stroke="#059669"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: '#059669' }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Gráfico 2: Composição Fixas × Variáveis (Donut / Rosca) */}
          <Card className="bg-white border-slate-200/90 shadow-xs flex flex-col justify-between">
            <CardHeader className="py-3 px-4 border-b border-slate-100 bg-slate-50/40">
              <CardTitle className="text-xs font-bold text-[#0B1F3A] flex items-center gap-1.5">
                <PieChartIcon className="w-4 h-4 text-indigo-600" />
                Composição do Gasto Operacional
              </CardTitle>
              <CardDescription className="text-[10.5px]">
                Divisão percentual entre Fixas e Variáveis no período.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-3 flex flex-col items-center justify-center flex-1">
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={dadosGraficoPizza}
                      cx="50%"
                      cy="50%"
                      innerRadius={46}
                      outerRadius={70}
                      paddingAngle={4}
                      dataKey="valor"
                    >
                      {dadosGraficoPizza.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.cor} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      formatter={(val: any, _name: any, item: any) => [
                        `${formatBrl(Number(val))} (${item.payload.percentual.toFixed(1)}%)`,
                        item.payload.name,
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-full pt-1 space-y-1.5 text-xs">
                <div className="flex items-center justify-between p-1.5 rounded-md bg-rose-50/60 border border-rose-100">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-600 shrink-0" />
                    <span className="text-rose-950 font-semibold text-[11px]">Fixas</span>
                  </div>
                  <span className="font-mono font-bold text-rose-900 text-[11px]">
                    {comparativo.pesoFixasSobreTotalDespesas !== null
                      ? `${comparativo.pesoFixasSobreTotalDespesas.toFixed(1)}%`
                      : '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between p-1.5 rounded-md bg-blue-50/60 border border-blue-100">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600 shrink-0" />
                    <span className="text-blue-950 font-semibold text-[11px]">Variáveis</span>
                  </div>
                  <span className="font-mono font-bold text-blue-900 text-[11px]">
                    {comparativo.pesoVariaveisSobreTotalDespesas !== null
                      ? `${comparativo.pesoVariaveisSobreTotalDespesas.toFixed(1)}%`
                      : '—'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ================= TABELA MATRICIAL DO COMPARATIVO ================= */}
      <Card className="bg-white border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="py-3 px-5 border-b border-slate-100 bg-slate-50/50 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
              <Scale className="w-4 h-4 text-indigo-700" />
              Matriz Comparativa Mês a Mês ({meses.length} meses)
            </CardTitle>
            <CardDescription className="text-xs">
              Valores em R$ e % sobre o Faturamento mensal para Despesas Fixas, Despesas Variáveis e
              Total. Contas detalhadas agrupadas por tipo com ordenação Centro → Tipo → Conta.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                const novo = !expandirContasFixas || !expandirContasVariaveis
                setExpandirContasFixas(novo)
                setExpandirContasVariaveis(novo)
              }}
              className="h-7 text-[11px] font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              {expandirContasFixas && expandirContasVariaveis
                ? 'Recolher Contas'
                : 'Expandir Contas'}
            </Button>
            <span className="text-slate-400">|</span>
            <span className="text-slate-500 font-medium">
              <strong className="text-slate-800">{meses[0]?.rotuloCurto}</strong> até{' '}
              <strong className="text-slate-800">{meses[meses.length - 1]?.rotuloCurto}</strong>
            </span>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-slate-500">
                Calculando comparativo de custos e percentuais de faturamento...
              </p>
            </div>
          ) : !comparativo.temDados ? (
            /* Estado vazio amigável */
            <div className="py-16 px-6 text-center max-w-md mx-auto space-y-3">
              <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
                <Scale className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">
                Nenhuma Despesa Classificada no Período
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Não foram encontrados lançamentos contábeis com as classificações "Despesa Fixa" ou
                "Despesa Variável" no período de {meses[0]?.rotuloCurto} a{' '}
                {meses[meses.length - 1]?.rotuloCurto}.
              </p>
              <div className="pt-2 flex items-center justify-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setModalClassificacaoOpen(true)}
                  className="text-xs font-semibold gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  Classificar Contas em Lote
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => navigate('/plano-contas')}
                  className="text-xs font-semibold bg-[#0B1F3A] hover:bg-blue-900 text-white gap-1.5 cursor-pointer"
                >
                  Plano de Contas
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto w-full max-w-full">
              <table
                className="text-xs border-collapse w-full"
                style={{
                  minWidth: `${Math.max(900, 320 + meses.length * 135 + 160)}px`,
                }}
              >
                <thead>
                  {/* Linha 1: Meses */}
                  <tr className="bg-[#0B1F3A] text-white font-bold text-left border-b border-slate-700">
                    <th
                      rowSpan={2}
                      className="py-2.5 px-3 w-[300px] min-w-[260px] sticky left-0 bg-[#0B1F3A] z-20 border-r border-slate-700 text-xs"
                    >
                      <div className="flex flex-col">
                        <span>Estrutura de Custos</span>
                        <span className="text-[10px] text-indigo-200/80 font-normal">
                          Fixas × Variáveis × Faturamento
                        </span>
                      </div>
                    </th>

                    {meses.map((m) => (
                      <th
                        key={m.chave}
                        colSpan={2}
                        className="py-1.5 px-2 text-center border-r border-slate-700/80 font-semibold text-[11px] whitespace-nowrap bg-[#0B1F3A]"
                      >
                        {m.rotuloCurto}
                      </th>
                    ))}

                    <th
                      colSpan={2}
                      className="py-1.5 px-3 text-center bg-[#152e50] font-bold text-white text-xs whitespace-nowrap border-l border-slate-700"
                    >
                      Total do Período
                    </th>
                  </tr>

                  {/* Linha 2: Subcolunas Valor e % Fat */}
                  <tr className="bg-slate-100 text-[#0B1F3A] border-b border-slate-300 font-semibold text-[10.5px]">
                    {meses.map((m) => (
                      <React.Fragment key={`sub-${m.chave}`}>
                        <th className="py-1 px-1.5 text-right border-r border-slate-200 min-w-[75px]">
                          Valor (R$)
                        </th>
                        <th className="py-1 px-1.5 text-right border-r border-slate-300 min-w-[55px] text-slate-600 bg-slate-50">
                          % Fat.
                        </th>
                      </React.Fragment>
                    ))}
                    <th className="py-1 px-2 text-right border-r border-slate-300 min-w-[90px] bg-slate-200/80 font-bold">
                      Valor (R$)
                    </th>
                    <th className="py-1 px-2 text-right min-w-[65px] bg-slate-200 font-bold text-slate-800">
                      % Fat.
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {/* ================= SEÇÃO 1: DESPESAS FIXAS ================= */}
                  <tr className="bg-rose-50/90 text-rose-950 font-bold border-t-2 border-rose-300 text-xs">
                    <td className="py-2.5 px-3 sticky left-0 bg-rose-50 z-10 border-r border-rose-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                      <div className="flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => setExpandirContasFixas((v) => !v)}
                          className="flex items-center gap-1.5 font-extrabold uppercase text-[11px] tracking-wider text-rose-950 hover:text-rose-800 text-left cursor-pointer"
                        >
                          {expandirContasFixas ? (
                            <ChevronDown className="w-3.5 h-3.5 text-rose-700" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5 text-rose-700" />
                          )}
                          TOTAL DESPESAS FIXAS
                        </button>
                        <Badge
                          variant="outline"
                          className="text-[9px] bg-rose-100 text-rose-900 border-rose-300"
                        >
                          {comparativo.contasFixas.length} conta(s)
                        </Badge>
                      </div>
                    </td>

                    {meses.map((m) => {
                      const totFixa = comparativo.totalFixasPorMes[m.chave] || 0
                      const pctTot = comparativo.pctFixasPorMes[m.chave]
                      const semaforo = classificarSemaforoPercentual(pctTot)

                      return (
                        <React.Fragment key={`tot-fix-${m.chave}`}>
                          <td className="py-2.5 px-1.5 text-right font-extrabold border-r border-rose-200 text-rose-900 whitespace-nowrap font-mono">
                            {totFixa !== 0 ? (
                              formatBrl(totFixa)
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                          <td
                            className={`py-2.5 px-1.5 text-right font-black border-r border-rose-300 whitespace-nowrap text-[11px] bg-rose-100/40 ${
                              semaforo === 'verde'
                                ? 'text-emerald-800'
                                : semaforo === 'ambar'
                                  ? 'text-amber-800'
                                  : semaforo === 'vermelho'
                                    ? 'text-rose-900'
                                    : 'text-slate-400'
                            }`}
                          >
                            {formatarPercentualExport(pctTot)}
                          </td>
                        </React.Fragment>
                      )
                    })}

                    <td className="py-2.5 px-2 text-right font-black text-rose-950 bg-rose-100 border-r border-rose-300 whitespace-nowrap font-mono">
                      {formatBrl(comparativo.totalFixasPeriodo)}
                    </td>
                    <td
                      className={`py-2.5 px-2 text-right font-black text-xs bg-rose-200/80 whitespace-nowrap ${
                        semaforoFixas === 'verde'
                          ? 'text-emerald-900'
                          : semaforoFixas === 'ambar'
                            ? 'text-amber-900'
                            : semaforoFixas === 'vermelho'
                              ? 'text-rose-950'
                              : 'text-slate-500'
                      }`}
                    >
                      {formatarPercentualExport(comparativo.pctFixasPeriodo)}
                    </td>
                  </tr>

                  {/* Contas Fixas Detalhadas (Expansíveis) */}
                  {expandirContasFixas &&
                    comparativo.contasFixas.map((conta) => (
                      <tr
                        key={`fixa-${conta.id}`}
                        className="hover:bg-slate-50/80 text-slate-700 transition-colors text-[11px] bg-white"
                      >
                        <td className="py-1.5 px-3 pl-6 sticky left-0 bg-white z-10 border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                          <div className="flex items-center gap-1.5 truncate flex-wrap">
                            {conta.centroNome && (
                              <span
                                className="inline-flex items-center px-1.5 py-0.2 text-[9px] font-semibold bg-slate-100 text-slate-700 rounded border border-slate-200 shrink-0"
                                title={`Centro de Custo: ${conta.centroNome}`}
                              >
                                {conta.centroNome}
                              </span>
                            )}
                            {conta.tipoDespesaNome && (
                              <span
                                className="inline-flex items-center px-1.5 py-0.2 text-[9px] font-semibold bg-rose-50 text-rose-800 rounded border border-rose-200 shrink-0"
                                title={`Tipo: ${conta.tipoDespesaNome}`}
                              >
                                {conta.tipoDespesaNome}
                              </span>
                            )}
                            {conta.codigo && (
                              <span className="font-mono text-[10px] text-rose-700 font-semibold shrink-0">
                                {conta.codigo}
                              </span>
                            )}
                            <span
                              className="truncate font-medium text-slate-900"
                              title={conta.nome}
                            >
                              {conta.nome}
                            </span>
                          </div>
                        </td>

                        {meses.map((m) => {
                          const val = conta.valoresPorMes[m.chave] || 0
                          const pct = conta.percentuaisPorMes[m.chave]
                          const classes = getClassesSemaforoPercentual(pct)
                          return (
                            <React.Fragment key={`cf-${conta.id}-${m.chave}`}>
                              <td className="py-1.5 px-1.5 text-right border-r border-slate-100 text-slate-700 whitespace-nowrap font-mono">
                                {val !== 0 ? (
                                  formatBrl(val)
                                ) : (
                                  <span className="text-slate-300">—</span>
                                )}
                              </td>
                              <td
                                className={`py-1.5 px-1.5 text-right border-r border-slate-200 whitespace-nowrap text-[10.5px] bg-slate-50/40 ${classes}`}
                              >
                                {formatarPercentualExport(pct)}
                              </td>
                            </React.Fragment>
                          )
                        })}

                        <td className="py-1.5 px-2 text-right font-semibold bg-slate-100/60 text-slate-900 border-r border-slate-200 whitespace-nowrap font-mono">
                          {formatBrl(conta.totalPeriodo)}
                        </td>
                        <td
                          className={`py-1.5 px-2 text-right font-semibold bg-slate-100/90 whitespace-nowrap text-[10.5px] ${getClassesSemaforoPercentual(
                            conta.percentualPeriodo,
                          )}`}
                        >
                          {formatarPercentualExport(conta.percentualPeriodo)}
                        </td>
                      </tr>
                    ))}

                  {/* ================= SEÇÃO 2: DESPESAS VARIÁVEIS ================= */}
                  <tr className="bg-blue-50/90 text-blue-950 font-bold border-t-2 border-blue-300 text-xs">
                    <td className="py-2.5 px-3 sticky left-0 bg-blue-50 z-10 border-r border-blue-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                      <div className="flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => setExpandirContasVariaveis((v) => !v)}
                          className="flex items-center gap-1.5 font-extrabold uppercase text-[11px] tracking-wider text-blue-950 hover:text-blue-800 text-left cursor-pointer"
                        >
                          {expandirContasVariaveis ? (
                            <ChevronDown className="w-3.5 h-3.5 text-blue-700" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5 text-blue-700" />
                          )}
                          TOTAL DESPESAS VARIÁVEIS
                        </button>
                        <Badge
                          variant="outline"
                          className="text-[9px] bg-blue-100 text-blue-900 border-blue-300"
                        >
                          {comparativo.contasVariaveis.length} conta(s)
                        </Badge>
                      </div>
                    </td>

                    {meses.map((m) => {
                      const totVar = comparativo.totalVariaveisPorMes[m.chave] || 0
                      const pctTot = comparativo.pctVariaveisPorMes[m.chave]
                      const semaforo = classificarSemaforoPercentual(pctTot)

                      return (
                        <React.Fragment key={`tot-var-${m.chave}`}>
                          <td className="py-2.5 px-1.5 text-right font-extrabold border-r border-blue-200 text-blue-900 whitespace-nowrap font-mono">
                            {totVar !== 0 ? (
                              formatBrl(totVar)
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                          <td
                            className={`py-2.5 px-1.5 text-right font-black border-r border-blue-300 whitespace-nowrap text-[11px] bg-blue-100/40 ${
                              semaforo === 'verde'
                                ? 'text-emerald-800'
                                : semaforo === 'ambar'
                                  ? 'text-amber-800'
                                  : semaforo === 'vermelho'
                                    ? 'text-rose-900'
                                    : 'text-slate-400'
                            }`}
                          >
                            {formatarPercentualExport(pctTot)}
                          </td>
                        </React.Fragment>
                      )
                    })}

                    <td className="py-2.5 px-2 text-right font-black text-blue-950 bg-blue-100 border-r border-blue-300 whitespace-nowrap font-mono">
                      {formatBrl(comparativo.totalVariaveisPeriodo)}
                    </td>
                    <td
                      className={`py-2.5 px-2 text-right font-black text-xs bg-blue-200/80 whitespace-nowrap ${
                        semaforoVariaveis === 'verde'
                          ? 'text-emerald-900'
                          : semaforoVariaveis === 'ambar'
                            ? 'text-amber-900'
                            : semaforoVariaveis === 'vermelho'
                              ? 'text-rose-950'
                              : 'text-slate-500'
                      }`}
                    >
                      {formatarPercentualExport(comparativo.pctVariaveisPeriodo)}
                    </td>
                  </tr>

                  {/* Contas Variáveis Detalhadas (Expansíveis) */}
                  {expandirContasVariaveis &&
                    comparativo.contasVariaveis.map((conta) => (
                      <tr
                        key={`var-${conta.id}`}
                        className="hover:bg-slate-50/80 text-slate-700 transition-colors text-[11px] bg-white"
                      >
                        <td className="py-1.5 px-3 pl-6 sticky left-0 bg-white z-10 border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                          <div className="flex items-center gap-1.5 truncate flex-wrap">
                            {conta.centroNome && (
                              <span
                                className="inline-flex items-center px-1.5 py-0.2 text-[9px] font-semibold bg-slate-100 text-slate-700 rounded border border-slate-200 shrink-0"
                                title={`Centro de Custo: ${conta.centroNome}`}
                              >
                                {conta.centroNome}
                              </span>
                            )}
                            {conta.tipoDespesaNome && (
                              <span
                                className="inline-flex items-center px-1.5 py-0.2 text-[9px] font-semibold bg-blue-50 text-blue-800 rounded border border-blue-200 shrink-0"
                                title={`Tipo: ${conta.tipoDespesaNome}`}
                              >
                                {conta.tipoDespesaNome}
                              </span>
                            )}
                            {conta.codigo && (
                              <span className="font-mono text-[10px] text-blue-700 font-semibold shrink-0">
                                {conta.codigo}
                              </span>
                            )}
                            <span
                              className="truncate font-medium text-slate-900"
                              title={conta.nome}
                            >
                              {conta.nome}
                            </span>
                          </div>
                        </td>

                        {meses.map((m) => {
                          const val = conta.valoresPorMes[m.chave] || 0
                          const pct = conta.percentuaisPorMes[m.chave]
                          const classes = getClassesSemaforoPercentual(pct)
                          return (
                            <React.Fragment key={`cv-${conta.id}-${m.chave}`}>
                              <td className="py-1.5 px-1.5 text-right border-r border-slate-100 text-slate-700 whitespace-nowrap font-mono">
                                {val !== 0 ? (
                                  formatBrl(val)
                                ) : (
                                  <span className="text-slate-300">—</span>
                                )}
                              </td>
                              <td
                                className={`py-1.5 px-1.5 text-right border-r border-slate-200 whitespace-nowrap text-[10.5px] bg-slate-50/40 ${classes}`}
                              >
                                {formatarPercentualExport(pct)}
                              </td>
                            </React.Fragment>
                          )
                        })}

                        <td className="py-1.5 px-2 text-right font-semibold bg-slate-100/60 text-slate-900 border-r border-slate-200 whitespace-nowrap font-mono">
                          {formatBrl(conta.totalPeriodo)}
                        </td>
                        <td
                          className={`py-1.5 px-2 text-right font-semibold bg-slate-100/90 whitespace-nowrap text-[10.5px] ${getClassesSemaforoPercentual(
                            conta.percentualPeriodo,
                          )}`}
                        >
                          {formatarPercentualExport(conta.percentualPeriodo)}
                        </td>
                      </tr>
                    ))}

                  {/* ================= SEÇÃO 3: TOTAL GERAL DESPESAS (FIXAS + VARIÁVEIS) ================= */}
                  <tr className="bg-purple-50/90 text-purple-950 font-bold border-t-2 border-purple-300 text-xs">
                    <td className="py-2.5 px-3 sticky left-0 bg-purple-50 z-10 border-r border-purple-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold uppercase text-[11px] tracking-wider text-purple-950">
                          TOTAL GERAL (FIXAS + VARIÁVEIS)
                        </span>
                        <Badge
                          variant="outline"
                          className="text-[9px] bg-purple-100 text-purple-900 border-purple-300"
                        >
                          Soma
                        </Badge>
                      </div>
                    </td>

                    {meses.map((m) => {
                      const totDesp = comparativo.totalDespesasPorMes[m.chave] || 0
                      const pctTot = comparativo.pctTotalPorMes[m.chave]
                      const semaforo = classificarSemaforoPercentual(pctTot)

                      return (
                        <React.Fragment key={`tot-desp-${m.chave}`}>
                          <td className="py-2.5 px-1.5 text-right font-extrabold border-r border-purple-200 text-purple-900 whitespace-nowrap font-mono">
                            {totDesp !== 0 ? (
                              formatBrl(totDesp)
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                          <td
                            className={`py-2.5 px-1.5 text-right font-black border-r border-purple-300 whitespace-nowrap text-[11px] bg-purple-100/40 ${
                              semaforo === 'verde'
                                ? 'text-emerald-800'
                                : semaforo === 'ambar'
                                  ? 'text-amber-800'
                                  : semaforo === 'vermelho'
                                    ? 'text-rose-900'
                                    : 'text-slate-400'
                            }`}
                          >
                            {formatarPercentualExport(pctTot)}
                          </td>
                        </React.Fragment>
                      )
                    })}

                    <td className="py-2.5 px-2 text-right font-black text-purple-950 bg-purple-100 border-r border-purple-300 whitespace-nowrap font-mono">
                      {formatBrl(comparativo.totalDespesasPeriodo)}
                    </td>
                    <td
                      className={`py-2.5 px-2 text-right font-black text-xs bg-purple-200/80 whitespace-nowrap ${
                        semaforoTotal === 'verde'
                          ? 'text-emerald-900'
                          : semaforoTotal === 'ambar'
                            ? 'text-amber-900'
                            : semaforoTotal === 'vermelho'
                              ? 'text-rose-950'
                              : 'text-slate-500'
                      }`}
                    >
                      {formatarPercentualExport(comparativo.pctTotalPeriodo)}
                    </td>
                  </tr>

                  {/* ================= SEÇÃO 4: FATURAMENTO (RECEITAS DRE) ================= */}
                  <tr className="bg-emerald-50/80 text-emerald-950 font-bold border-y-2 border-emerald-300 text-xs">
                    <td className="py-2.5 px-3 sticky left-0 bg-emerald-50 z-10 border-r border-emerald-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold uppercase text-[11px] tracking-wider text-emerald-950">
                          FATURAMENTO (RECEITAS DRE)
                        </span>
                        <Badge
                          variant="outline"
                          className="text-[9px] bg-emerald-100 text-emerald-900 border-emerald-300"
                        >
                          Base 100%
                        </Badge>
                      </div>
                    </td>

                    {meses.map((m) => {
                      const fat = comparativo.faturamentoPorMes[m.chave] || 0
                      return (
                        <React.Fragment key={`fat-${m.chave}`}>
                          <td className="py-2.5 px-1.5 text-right font-bold border-r border-emerald-200 text-emerald-900 whitespace-nowrap font-mono">
                            {fat !== 0 ? formatBrl(fat) : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="py-2.5 px-1.5 text-right font-semibold border-r border-emerald-300 text-emerald-700 whitespace-nowrap text-[10.5px] bg-emerald-100/30">
                            {fat > 0 ? '100%' : '—'}
                          </td>
                        </React.Fragment>
                      )
                    })}

                    <td className="py-2.5 px-2 text-right font-black text-emerald-950 bg-emerald-100 border-r border-emerald-300 whitespace-nowrap font-mono">
                      {formatBrl(comparativo.faturamentoTotalPeriodo)}
                    </td>
                    <td className="py-2.5 px-2 text-right font-black text-xs text-emerald-950 bg-emerald-200/70 whitespace-nowrap">
                      {comparativo.faturamentoTotalPeriodo > 0 ? '100%' : '—'}
                    </td>
                  </tr>

                  {/* ================= SEÇÃO 5: ÍNDICE CONSOLIDADO ================= */}
                  <tr className="bg-[#0B1F3A] text-white font-extrabold text-xs border-t-2 border-slate-700">
                    <td className="py-3 px-3 sticky left-0 bg-[#0B1F3A] z-10 border-r border-slate-700 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.25)]">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] uppercase tracking-wider font-extrabold text-indigo-100 flex items-center gap-1.5">
                          <Percent className="w-3.5 h-3.5 text-amber-300" />
                          PESO TOTAL / FATURAMENTO
                        </span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-slate-200 font-mono">
                          Mês a Mês
                        </span>
                      </div>
                    </td>

                    {meses.map((m) => {
                      const pctTot = comparativo.pctTotalPorMes[m.chave]
                      const semaforo = classificarSemaforoPercentual(pctTot)

                      return (
                        <React.Fragment key={`idx-${m.chave}`}>
                          <td className="py-3 px-1.5 text-right border-r border-slate-700 text-slate-300 whitespace-nowrap text-[10.5px]">
                            {comparativo.totalDespesasPorMes[m.chave] > 0
                              ? formatBrl(comparativo.totalDespesasPorMes[m.chave])
                              : '—'}
                          </td>
                          <td
                            className={`py-3 px-1.5 text-right border-r border-slate-700 whitespace-nowrap font-black text-xs ${
                              semaforo === 'verde'
                                ? 'text-emerald-300'
                                : semaforo === 'ambar'
                                  ? 'text-amber-300'
                                  : semaforo === 'vermelho'
                                    ? 'text-rose-300'
                                    : 'text-slate-400'
                            }`}
                          >
                            {formatarPercentualExport(pctTot)}
                          </td>
                        </React.Fragment>
                      )
                    })}

                    <td className="py-3 px-2 text-right border-r border-slate-700 text-indigo-200 whitespace-nowrap text-[10.5px] font-semibold bg-[#132c4d]">
                      Geral
                    </td>
                    <td
                      className={`py-3 px-2 text-right font-black text-sm whitespace-nowrap bg-[#18365e] ${
                        semaforoTotal === 'verde'
                          ? 'text-emerald-300'
                          : semaforoTotal === 'ambar'
                            ? 'text-amber-300'
                            : semaforoTotal === 'vermelho'
                              ? 'text-rose-300'
                              : 'text-slate-300'
                      }`}
                    >
                      {formatarPercentualExport(comparativo.pctTotalPeriodo)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bloco de Soma Geral & Parecer Executivo do Consultor */}
      {comparativo.temDados && (
        <Card className="bg-gradient-to-r from-[#0B1F3A] to-[#152e50] text-white border-none shadow-md overflow-hidden">
          <CardContent className="p-4 sm:p-5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="p-1 rounded bg-indigo-500/30 text-indigo-200 border border-indigo-400/40">
                    <Scale className="w-4 h-4" />
                  </span>
                  <h3 className="text-sm font-bold tracking-tight text-white">
                    Parecer Executivo: {comparativo.diagnostico.titulo}
                  </h3>
                </div>
                <p className="text-xs text-blue-100/90 leading-relaxed max-w-3xl">
                  {comparativo.diagnostico.descricao}
                </p>
                <div className="pt-1 flex items-center gap-2 text-xs text-amber-200 bg-white/5 rounded-lg p-2.5 border border-white/10 max-w-3xl">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span>
                    <strong>Recomendação Estratégica:</strong>{' '}
                    {comparativo.diagnostico.recomendacao}
                  </span>
                </div>
              </div>

              {/* Badges de Destaque Consolidado */}
              <div className="flex items-center gap-3 bg-white/10 rounded-xl p-3 border border-white/15 shrink-0">
                <div>
                  <p className="text-[10px] text-blue-200 uppercase font-semibold">Peso Fixas</p>
                  <p
                    className={`text-lg font-black ${
                      semaforoFixas === 'verde'
                        ? 'text-emerald-300'
                        : semaforoFixas === 'ambar'
                          ? 'text-amber-300'
                          : 'text-rose-300'
                    }`}
                  >
                    {formatarPercentualExport(comparativo.pctFixasPeriodo)}
                  </p>
                </div>
                <div className="h-8 w-px bg-white/20" />
                <div>
                  <p className="text-[10px] text-blue-200 uppercase font-semibold">
                    Peso Variáveis
                  </p>
                  <p
                    className={`text-lg font-black ${
                      semaforoVariaveis === 'verde'
                        ? 'text-emerald-300'
                        : semaforoVariaveis === 'ambar'
                          ? 'text-amber-300'
                          : 'text-rose-300'
                    }`}
                  >
                    {formatarPercentualExport(comparativo.pctVariaveisPeriodo)}
                  </p>
                </div>
                <div className="h-8 w-px bg-white/20" />
                <div>
                  <p className="text-[10px] text-blue-200 uppercase font-semibold">Peso Total</p>
                  <p
                    className={`text-lg font-black ${
                      semaforoTotal === 'verde'
                        ? 'text-emerald-300'
                        : semaforoTotal === 'ambar'
                          ? 'text-amber-300'
                          : 'text-rose-300'
                    }`}
                  >
                    {formatarPercentualExport(comparativo.pctTotalPeriodo)}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Explicação da Metodologia e Critérios de Análise */}
      <div className="text-xs text-slate-500 bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1.5 print:border-none print:bg-white print:p-0">
        <p className="font-semibold text-slate-700 flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-blue-600" />
          Metodologia do Comparativo Fixas × Variáveis:
        </p>
        <p>
          • <strong>Classificação Oficial DRE:</strong> Os gastos são segregados rigorosamente
          segundo o Plano de Contas em "Despesa Fixa" (custos estruturais independentes de volume) e
          "Despesa Variável" (custos proporcionais à venda ou produção). Contas marcadas como "Não
          exibir DRE" ou "Não exibir em nada" são excluídas.
        </p>
        <p>
          • <strong>Peso sobre Faturamento:</strong> Apurado pela razão entre o valor gasto e a
          receita bruta apurada na DRE daquele mesmo período (
          <code className="bg-slate-200/80 px-1 py-0.5 rounded text-slate-800 font-mono text-[10.5px]">
            (Despesa ÷ Faturamento) × 100
          </code>
          ). Meses sem faturamento exibem traço (—).
        </p>
        <p>
          • <strong>Ponto de Equilíbrio & Alavancagem:</strong> Quanto maior o peso das despesas
          fixas sobre a receita, mais alto é o faturamento mínimo necessário para cobrir todos os
          custos. Por outro lado, empresas com custos predominantemente variáveis desfrutam de maior
          margem de segurança contra quedas nas vendas.
        </p>
      </div>

      {/* Modal de Classificação DRE em Lote */}
      <ModalClassificacaoDreLote
        open={modalClassificacaoOpen}
        onOpenChange={setModalClassificacaoOpen}
        contas={contas}
        onSuccess={() => carregarDados()}
      />

      {/* Rodapé fixo na impressão / PDF A4 */}
      <DocumentPrintFooter
        documentTitle="Comparativo Fixas × Variáveis (Peso sobre Faturamento)"
        empresaNome={
          isGrupoAtivo && grupoAtivo
            ? `Grupo ${grupoAtivo.nome}`
            : selectedEmpresa?.nome || 'Consolidado Geral'
        }
        exercicioAno={selectedAno || anoInicial}
      />
    </div>
  )
}
