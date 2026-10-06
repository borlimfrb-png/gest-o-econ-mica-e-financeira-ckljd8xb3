import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFilter } from '@/contexts/FilterContext'
import { useToast } from '@/hooks/use-toast'
import { useRealtime } from '@/hooks/use-realtime'
import { contasService, lancamentosService, planoContasService } from '@/services/financeService'
import type { ContaRecord, LancamentoRecord, PlanoContaRecord } from '@/types/finance'
import {
  calcularAnaliseFaturamento,
  classificarSemaforoVariacao,
  MESES_ROTULOS,
  type AnaliseFaturamentoResultado,
} from '@/lib/analiseFaturamentoCalculo'
import {
  exportarAnaliseFaturamentoExcel,
  exportarAnaliseFaturamentoCsv,
  formatarPercentualExport,
} from '@/lib/analiseFaturamentoExport'
import { DocumentPrintFooter } from '@/components/DocumentPrintFooter'
import { ModalClassificacaoDreLote } from '@/components/ModalClassificacaoDreLote'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
} from 'recharts'
import {
  TrendingUp,
  Download,
  FileSpreadsheet,
  Printer,
  Building,
  RefreshCw,
  FolderTree,
  DollarSign,
  ArrowRight,
  Sparkles,
  Award,
  AlertTriangle,
  Lightbulb,
  Layers,
  CalendarDays,
  Percent,
} from 'lucide-react'

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
  if (Math.abs(val) >= 1_000_000) {
    return `R$ ${(val / 1_000_000).toFixed(1)}M`
  }
  if (Math.abs(val) >= 1_000) {
    return `R$ ${(val / 1_000).toFixed(0)}k`
  }
  return `R$ ${val.toFixed(0)}`
}

// Paleta de cores para cada ano no gráfico de linhas de perfil mensal
const CORES_ANOS = [
  '#2563EB', // Azul Royal
  '#10B981', // Esmeralda
  '#F59E0B', // Âmbar
  '#8B5CF6', // Roxo
  '#EC4899', // Rosa
  '#06B6D4', // Ciano
  '#F97316', // Laranja
  '#64748B', // Ardósia
]

export default function AnaliseFaturamento() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { selectedEmpresaId, selectedEmpresa, isGrupoAtivo, grupoAtivo, selectedAno } = useFilter()

  // Estados de dados
  const [loading, setLoading] = useState(true)
  const [lancamentos, setLancamentos] = useState<LancamentoRecord[]>([])
  const [contas, setContas] = useState<ContaRecord[]>([])
  const [planoContas, setPlanoContas] = useState<PlanoContaRecord[]>([])

  // Modal para classificação em lote do plano de contas
  const [modalClassificacaoOpen, setModalClassificacaoOpen] = useState(false)

  // Tipo de visualização gráfica: 'evolucao_anual' (barras/área) ou 'perfil_mensal' (linhas comparativas jan-dez)
  const [tipoGrafico, setTipoGrafico] = useState<'evolucao_anual' | 'perfil_mensal'>(
    'evolucao_anual',
  )

  // Carregar dados respeitando empresa ativa OU grupo de empresas
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
      console.error('Erro ao carregar dados da análise de faturamento:', err)
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

  // Cálculo da Análise de Faturamento de TODOS os anos
  const analise = useMemo<AnaliseFaturamentoResultado>(() => {
    return calcularAnaliseFaturamento(lancamentos, contas, planoContas)
  }, [lancamentos, contas, planoContas])

  const handleImprimir = () => {
    window.print()
  }

  const handleExportarExcel = () => {
    try {
      exportarAnaliseFaturamentoExcel(analise, selectedEmpresa)
      toast({
        title: 'Planilha Gerada com Sucesso',
        description: 'A análise de faturamento de todos os anos foi exportada para Excel.',
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
      exportarAnaliseFaturamentoCsv(analise, selectedEmpresa)
      toast({
        title: 'Arquivo CSV Exportado',
        description: 'Formato brasileiro delimitado por ponto e vírgula gerado.',
      })
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: 'Erro na exportação',
        description: e?.message || 'Falha ao gerar arquivo CSV.',
      })
    }
  }

  // Dados para Gráfico 1: Evolução Ano a Ano (Barras)
  const dadosGraficoAnual = useMemo(() => {
    return analise.linhasPorAno.map((l) => ({
      ano: String(l.ano),
      faturamento: l.totalAno,
      participacao: l.participacaoAcumulado || 0,
      variacaoYoY: l.variacaoYoY,
    }))
  }, [analise.linhasPorAno])

  // Dados para Gráfico 2: Perfil Mensal comparando os anos (Jan a Dez no eixo X, linhas para cada ano)
  const dadosGraficoMensal = useMemo(() => {
    return MESES_ROTULOS.map((m) => {
      const ponto: Record<string, any> = {
        mes: m.sigla,
        mesNome: m.nome,
      }
      for (const l of analise.linhasPorAno) {
        ponto[`ano_${l.ano}`] = l.valoresPorMes[m.mes] || 0
      }
      return ponto
    })
  }, [analise.linhasPorAno])

  const nomeContexto =
    isGrupoAtivo && grupoAtivo
      ? `Grupo ${grupoAtivo.nome}`
      : selectedEmpresa
        ? selectedEmpresa.nome
        : 'Todas as empresas (Consolidado)'

  return (
    <div className="space-y-4 animate-fadeIn pb-8 print:p-0 print:m-0">
      {/* Cabeçalho da Tela */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-100/80 text-emerald-800 shadow-xs">
              <TrendingUp className="w-5 h-5 text-emerald-700" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-[#0B1F3A] tracking-tight">
                  Análise de Faturamento
                </h1>
                <Badge
                  variant="outline"
                  className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-semibold"
                >
                  DRE Histórica Plurianual
                </Badge>
              </div>
              <p className="text-[11px] text-[#5B6B7F]">
                Demonstração consolidada de faturamento (Receitas da DRE Gerencial) de todos os anos
                disponíveis, com percentuais de participação sobre o acumulado e variação ano a ano
                (YoY).
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
            title="Classificação DRE em lote"
          >
            <FolderTree className="w-3.5 h-3.5 text-emerald-600" />
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
            <DropdownMenuContent align="end" className="w-56 bg-white">
              <DropdownMenuItem
                onClick={handleExportarExcel}
                className="text-xs cursor-pointer gap-2 py-2"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <div className="flex flex-col">
                  <span className="font-semibold text-slate-800">Planilha Excel (.xlsx)</span>
                  <span className="text-[10px] text-slate-500">
                    Todos os anos, meses e percentuais
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
                    Delimitador ';' padrão nacional
                  </span>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Barra de Contexto Multi-tenant */}
      <Card className="bg-white border-slate-200/90 shadow-xs print:hidden">
        <CardContent className="py-2.5 px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <div className="text-xs">
              <span className="text-slate-500">Escopo da Análise: </span>
              <strong className="text-[#0B1F3A]">{nomeContexto}</strong>
              {selectedEmpresa?.segmento && (
                <Badge variant="outline" className="ml-2 text-[10px] py-0">
                  {selectedEmpresa.segmento}
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-600">
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="w-3.5 h-3.5 text-emerald-600" />
              <span>
                Anos analisados:{' '}
                <strong className="text-slate-900">
                  {analise.anos.length > 0
                    ? `${analise.anos[0]} a ${analise.anos[analise.anos.length - 1]} (${analise.anos.length} ano${analise.anos.length > 1 ? 's' : ''})`
                    : 'Nenhum'}
                </strong>
              </span>
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Cards de Resumo Executivo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 print:grid-cols-5">
        {/* Faturamento Acumulado de Todos os Anos */}
        <Card className="bg-white border-slate-200/90 shadow-xs hover:border-slate-300 transition-colors">
          <CardContent className="py-2.5 px-3.5">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                Faturamento Total
              </p>
              <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <p className="text-sm font-bold text-emerald-700 mt-0.5 truncate">
              {formatBrl(analise.totalGeralTodosAnos)}
            </p>
            <p className="text-[9.5px] text-slate-500 mt-0.5">Soma de todos os anos da base</p>
          </CardContent>
        </Card>

        {/* Quantidade de Anos */}
        <Card className="bg-white border-slate-200/90 shadow-xs hover:border-slate-300 transition-colors">
          <CardContent className="py-2.5 px-3.5">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                Anos Analisados
              </p>
              <Layers className="w-3.5 h-3.5 text-blue-600" />
            </div>
            <p className="text-sm font-bold text-[#0B1F3A] mt-0.5 truncate">
              {analise.anos.length} exercício{analise.anos.length > 1 ? 's' : ''}
            </p>
            <p className="text-[9.5px] text-slate-500 mt-0.5">
              {analise.anos.length > 0
                ? `${analise.anos[0]} — ${analise.anos[analise.anos.length - 1]}`
                : 'Sem lançamentos'}
            </p>
          </CardContent>
        </Card>

        {/* Média Anual de Faturamento */}
        <Card className="bg-white border-slate-200/90 shadow-xs hover:border-slate-300 transition-colors">
          <CardContent className="py-2.5 px-3.5">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                Média Anual
              </p>
              <Percent className="w-3.5 h-3.5 text-indigo-600" />
            </div>
            <p className="text-sm font-bold text-indigo-700 mt-0.5 truncate">
              {formatBrl(analise.mediaAnualFaturamento)}
            </p>
            <p className="text-[9.5px] text-slate-500 mt-0.5">Faturamento médio por exercício</p>
          </CardContent>
        </Card>

        {/* Melhor Ano */}
        <Card className="bg-gradient-to-br from-emerald-50/70 to-emerald-100/40 border-emerald-200/90 shadow-xs">
          <CardContent className="py-2.5 px-3.5">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold text-emerald-900 uppercase tracking-wider">
                Melhor Ano
              </p>
              <Award className="w-3.5 h-3.5 text-emerald-700" />
            </div>
            <p className="text-sm font-extrabold text-emerald-900 mt-0.5 truncate">
              {analise.melhorAno ? `${analise.melhorAno.ano}` : '—'}
            </p>
            <p className="text-[9.5px] font-medium text-emerald-800 mt-0.5 truncate">
              {analise.melhorAno ? formatBrlCompacto(analise.melhorAno.valor) : 'Sem dados'}
              {analise.melhorAno?.variacaoYoY !== null &&
                analise.melhorAno?.variacaoYoY !== undefined && (
                  <span className="ml-1 font-bold">
                    (
                    {formatarPercentualExport(analise.melhorAno.variacaoYoY, {
                      incluirSinal: true,
                    })}
                    )
                  </span>
                )}
            </p>
          </CardContent>
        </Card>

        {/* Pior Ano */}
        <Card className="bg-white border-slate-200/90 shadow-xs hover:border-slate-300 transition-colors">
          <CardContent className="py-2.5 px-3.5">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                Pior Ano
              </p>
              <AlertTriangle className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <p className="text-sm font-bold text-slate-800 mt-0.5 truncate">
              {analise.piorAno ? `${analise.piorAno.ano}` : '—'}
            </p>
            <p className="text-[9.5px] text-slate-500 mt-0.5 truncate">
              {analise.piorAno ? formatBrlCompacto(analise.piorAno.valor) : 'Sem dados'}
              {analise.piorAno?.variacaoYoY !== null &&
                analise.piorAno?.variacaoYoY !== undefined && (
                  <span className="ml-1 font-medium">
                    ({formatarPercentualExport(analise.piorAno.variacaoYoY, { incluirSinal: true })}
                    )
                  </span>
                )}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Cabeçalho exclusivo para Impressão */}
      <div className="hidden print:block mb-4 border-b border-slate-300 pb-2">
        <h2 className="text-lg font-bold text-slate-900">
          ANÁLISE DE FATURAMENTO ANUAL & HISTÓRICO DE RECEITAS DRE
        </h2>
        <p className="text-xs text-slate-600">
          Escopo: {nomeContexto} · Anos Analisados:{' '}
          {analise.anos.length > 0
            ? `${analise.anos[0]} a ${analise.anos[analise.anos.length - 1]} (${analise.anos.length} exercícios)`
            : 'Nenhum'}
        </p>
      </div>

      {/* ================= TABELA MATRICIAL POR ANO × MÊS ================= */}
      <Card className="bg-white border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="py-3 px-5 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <CardTitle className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-700" />
              Matriz Histórica de Faturamento por Ano e Mês
            </CardTitle>
            <CardDescription className="text-xs">
              Valores mensais de receita contábil (DRE) por ano, total anual, % de participação no
              acumulado de todos os anos e variação ano sobre ano (YoY).
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Verde: Crescimento YoY
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-800 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              Vermelho: Queda YoY
            </span>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-slate-500">
                Processando faturamento contábil de todos os anos...
              </p>
            </div>
          ) : !analise.temDados ? (
            /* Estado vazio amigável */
            <div className="py-16 px-6 text-center max-w-md mx-auto space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                <TrendingUp className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">
                Nenhum Faturamento Encontrado na Base
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Não foram identificadas receitas nos lançamentos contábeis da empresa para compor a
                análise histórica. Importe extratos ou balancetes, ou vincule suas contas de receita
                na classificação DRE.
              </p>
              <div className="pt-2 flex items-center justify-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setModalClassificacaoOpen(true)}
                  className="text-xs font-semibold gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  Classificar Contas DRE
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => navigate('/importacao')}
                  className="text-xs font-semibold bg-[#0B1F3A] hover:bg-blue-900 text-white gap-1.5 cursor-pointer"
                >
                  Importar Lançamentos
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto w-full max-w-full">
              <table
                className="text-xs border-collapse w-full"
                style={{
                  minWidth: '1180px',
                }}
              >
                <thead>
                  <tr className="bg-[#0B1F3A] text-white font-bold text-left border-b border-slate-700">
                    <th className="py-2.5 px-3 w-[110px] min-w-[100px] sticky left-0 bg-[#0B1F3A] z-20 border-r border-slate-700 text-xs">
                      Ano
                    </th>

                    {MESES_ROTULOS.map((m) => (
                      <th
                        key={m.mes}
                        className="py-2 px-2 text-right border-r border-slate-700/80 font-semibold text-[11px] whitespace-nowrap min-w-[75px]"
                      >
                        {m.sigla}
                      </th>
                    ))}

                    <th className="py-2.5 px-3 text-right bg-[#152e50] font-bold text-white text-xs whitespace-nowrap border-l border-slate-700 min-w-[110px]">
                      Total do Ano
                    </th>
                    <th className="py-2.5 px-3 text-right bg-[#18365e] font-bold text-blue-100 text-[11px] whitespace-nowrap min-w-[95px]">
                      % Acumulado
                    </th>
                    <th className="py-2.5 px-3 text-right bg-[#1d4375] font-bold text-emerald-200 text-[11px] whitespace-nowrap min-w-[95px]">
                      Variação YoY
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {analise.linhasPorAno.map((linha) => {
                    const statusSemaforo = classificarSemaforoVariacao(linha.variacaoYoY)

                    return (
                      <tr
                        key={linha.ano}
                        className="hover:bg-slate-50/80 text-slate-700 transition-colors text-[11px]"
                      >
                        {/* Coluna Fixa do Ano */}
                        <td className="py-2 px-3 sticky left-0 bg-white z-10 border-r border-slate-200 font-bold text-[#0B1F3A] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs">{linha.ano}</span>
                            {linha.totalAno === analise.melhorAno?.valor &&
                              analise.anos.length > 1 && (
                                <span
                                  className="w-1.5 h-1.5 rounded-full bg-emerald-500"
                                  title="Melhor ano da série"
                                />
                              )}
                          </div>
                        </td>

                        {/* Colunas Jan a Dez */}
                        {MESES_ROTULOS.map((m) => {
                          const val = linha.valoresPorMes[m.mes] || 0
                          const teveDados = linha.mesesComDados[m.mes]

                          return (
                            <td
                              key={m.mes}
                              className="py-2 px-2 text-right border-r border-slate-100 whitespace-nowrap font-mono"
                            >
                              {val > 0 || (teveDados && val !== 0) ? (
                                formatBrl(val)
                              ) : (
                                <span className="text-slate-300 font-sans">—</span>
                              )}
                            </td>
                          )
                        })}

                        {/* Total do Ano */}
                        <td className="py-2 px-3 text-right font-bold text-slate-900 bg-slate-50/80 border-r border-slate-200 whitespace-nowrap font-mono text-xs">
                          {formatBrl(linha.totalAno)}
                        </td>

                        {/* % Participação Acumulada */}
                        <td className="py-2 px-3 text-right font-semibold text-slate-700 bg-slate-50/50 border-r border-slate-200 whitespace-nowrap text-xs">
                          {formatarPercentualExport(linha.participacaoAcumulado)}
                        </td>

                        {/* Variação YoY (%) */}
                        <td
                          className={`py-2 px-3 text-right whitespace-nowrap font-bold text-xs ${
                            statusSemaforo === 'verde'
                              ? 'text-emerald-700 bg-emerald-50/40'
                              : statusSemaforo === 'vermelho'
                                ? 'text-rose-700 bg-rose-50/40'
                                : 'text-slate-400'
                          }`}
                        >
                          {linha.variacaoYoY !== null ? (
                            <span className="inline-flex items-center justify-end gap-0.5">
                              {formatarPercentualExport(linha.variacaoYoY, { incluirSinal: true })}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-sans font-normal">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}

                  {/* ================= LINHA DE TOTAL GERAL ================= */}
                  <tr className="bg-emerald-50/90 text-emerald-950 font-bold border-t-2 border-emerald-300 text-xs">
                    <td className="py-2.5 px-3 sticky left-0 bg-emerald-100/90 z-10 border-r border-emerald-300 font-extrabold uppercase text-[10.5px] tracking-wider shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                      TOTAL GERAL
                    </td>

                    {MESES_ROTULOS.map((m) => {
                      const totMes = analise.totalGeralPorMes[m.mes] || 0
                      return (
                        <td
                          key={m.mes}
                          className="py-2.5 px-2 text-right font-extrabold border-r border-emerald-200 text-emerald-950 whitespace-nowrap font-mono"
                        >
                          {totMes > 0 ? (
                            formatBrl(totMes)
                          ) : (
                            <span className="text-slate-400 font-sans font-normal">—</span>
                          )}
                        </td>
                      )
                    })}

                    {/* Total Geral de Todos os Anos */}
                    <td className="py-2.5 px-3 text-right font-black text-emerald-950 bg-emerald-200/80 border-r border-emerald-300 whitespace-nowrap font-mono text-xs">
                      {formatBrl(analise.totalGeralTodosAnos)}
                    </td>

                    {/* % Total (100%) */}
                    <td className="py-2.5 px-3 text-right font-black text-emerald-950 bg-emerald-100 border-r border-emerald-300 whitespace-nowrap text-xs">
                      {analise.totalGeralTodosAnos > 0 ? '100,00%' : '—'}
                    </td>

                    {/* Variação YoY para Total Geral (não se aplica) */}
                    <td className="py-2.5 px-3 text-right font-semibold text-slate-400 whitespace-nowrap text-xs">
                      —
                    </td>
                  </tr>

                  {/* ================= LINHA DE MÉDIA ANUAL ================= */}
                  <tr className="bg-slate-100 text-slate-800 font-semibold border-t border-slate-200 text-[11px]">
                    <td className="py-2 px-3 sticky left-0 bg-slate-100 z-10 border-r border-slate-300 font-bold uppercase text-[10px] tracking-wider text-slate-700 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                      MÉDIA ANUAL
                    </td>

                    {MESES_ROTULOS.map((m) => {
                      const qtdAnos = analise.linhasPorAno.length || 1
                      const mediaMes = (analise.totalGeralPorMes[m.mes] || 0) / qtdAnos
                      return (
                        <td
                          key={m.mes}
                          className="py-2 px-2 text-right border-r border-slate-200 text-slate-700 whitespace-nowrap font-mono"
                        >
                          {mediaMes > 0 ? (
                            formatBrl(mediaMes)
                          ) : (
                            <span className="text-slate-400 font-sans font-normal">—</span>
                          )}
                        </td>
                      )
                    })}

                    <td className="py-2 px-3 text-right font-bold text-slate-900 bg-slate-200/70 border-r border-slate-300 whitespace-nowrap font-mono">
                      {formatBrl(analise.mediaAnualFaturamento)}
                    </td>

                    <td className="py-2 px-3 text-right text-slate-400 border-r border-slate-300 whitespace-nowrap">
                      —
                    </td>

                    <td className="py-2 px-3 text-right text-slate-400 whitespace-nowrap">—</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ================= GRÁFICOS RECHARTS ================= */}
      {analise.temDados && (
        <Card className="bg-white border-slate-200 shadow-sm print:hidden">
          <CardHeader className="py-3 px-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                Comportamento Gráfico do Faturamento
              </CardTitle>
              <CardDescription className="text-xs">
                Visualize a trajetória histórica ano a ano ou o perfil comparativo da sazonalidade
                mensal de cada exercício.
              </CardDescription>
            </div>
            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => setTipoGrafico('evolucao_anual')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  tipoGrafico === 'evolucao_anual'
                    ? 'bg-white text-emerald-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Evolução Anual
              </button>
              <button
                type="button"
                onClick={() => setTipoGrafico('perfil_mensal')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  tipoGrafico === 'perfil_mensal'
                    ? 'bg-white text-emerald-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Perfil Mensal (Jan–Dez)
              </button>
            </div>
          </CardHeader>

          <CardContent className="pt-4 pb-4 px-4 sm:px-6">
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                {tipoGrafico === 'evolucao_anual' ? (
                  <BarChart
                    data={dadosGraficoAnual}
                    margin={{ top: 15, right: 15, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                    <XAxis dataKey="ano" tick={{ fontSize: 11, fill: '#64748B' }} />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#64748B' }}
                      tickFormatter={(v) => formatBrlCompacto(v)}
                    />
                    <RechartsTooltip
                      formatter={(val: any, name: any) => [
                        formatBrl(Number(val)),
                        name === 'faturamento' ? 'Faturamento Total do Ano' : name,
                      ]}
                      labelFormatter={(label) => `Exercício ${label}`}
                    />
                    <Legend
                      formatter={() => (
                        <span className="text-xs font-medium text-slate-700">
                          Faturamento Anual (Receitas DRE)
                        </span>
                      )}
                    />
                    <Bar
                      dataKey="faturamento"
                      name="faturamento"
                      fill="#10B981"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                ) : (
                  <LineChart
                    data={dadosGraficoMensal}
                    margin={{ top: 15, right: 20, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                    <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#64748B' }} />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#64748B' }}
                      tickFormatter={(v) => formatBrlCompacto(v)}
                    />
                    <RechartsTooltip
                      formatter={(val: any, name: any) => [
                        formatBrl(Number(val)),
                        `Ano ${String(name).replace('ano_', '')}`,
                      ]}
                      labelFormatter={(label, payload) => {
                        const item = payload?.[0]?.payload
                        return item ? `${item.mesNome} (Perfil Mensal)` : label
                      }}
                    />
                    <Legend
                      formatter={(val) => (
                        <span className="text-xs font-medium text-slate-700">
                          {String(val).replace('ano_', 'Ano ')}
                        </span>
                      )}
                    />
                    {analise.linhasPorAno.map((l, idx) => (
                      <Line
                        key={l.ano}
                        type="monotone"
                        dataKey={`ano_${l.ano}`}
                        name={`ano_${l.ano}`}
                        stroke={CORES_ANOS[idx % CORES_ANOS.length]}
                        strokeWidth={2.5}
                        dot={{ r: 3.5, fill: CORES_ANOS[idx % CORES_ANOS.length] }}
                        activeDot={{ r: 6 }}
                        connectNulls
                      />
                    ))}
                  </LineChart>
                )}
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ================= DIAGNÓSTICO EXECUTIVO DO CONSULTOR ================= */}
      {analise.temDados && (
        <Card className="bg-gradient-to-r from-[#0B1F3A] to-[#152e50] text-white border-none shadow-md overflow-hidden">
          <CardContent className="p-4 sm:p-5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-emerald-500/25 text-emerald-300 border border-emerald-400/40">
                    <Lightbulb className="w-4 h-4" />
                  </span>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold tracking-tight text-white">
                      Parecer do Consultor: {analise.diagnostico.titulo}
                    </h3>
                    <Badge
                      variant="outline"
                      className="bg-white/10 text-emerald-200 border-white/20 text-[10px] font-semibold"
                    >
                      Diagnóstico Automático
                    </Badge>
                  </div>
                </div>
                <p className="text-xs text-blue-100/90 leading-relaxed max-w-3xl">
                  {analise.diagnostico.descricao}
                </p>
              </div>

              {/* Indicadores complementares em destaque */}
              <div className="flex items-center gap-4 bg-white/10 rounded-xl p-3 border border-white/15 shrink-0">
                <div>
                  <p className="text-[10px] text-blue-200 uppercase font-semibold">
                    Melhor Trimestre
                  </p>
                  <p className="text-base font-black text-amber-300">
                    {analise.diagnostico.melhorTrimestre || '1º Tri'}
                  </p>
                </div>
                <div className="h-8 w-px bg-white/20" />
                <div>
                  <p className="text-[10px] text-blue-200 uppercase font-semibold">
                    Crescimento Médio YoY
                  </p>
                  <p
                    className={`text-base font-black ${
                      (analise.diagnostico.crescimentoMedioYoY || 0) >= 0
                        ? 'text-emerald-300'
                        : 'text-rose-300'
                    }`}
                  >
                    {analise.diagnostico.crescimentoMedioYoY !== null &&
                    analise.diagnostico.crescimentoMedioYoY !== undefined
                      ? `${analise.diagnostico.crescimentoMedioYoY > 0 ? '+' : ''}${analise.diagnostico.crescimentoMedioYoY.toFixed(1)}%`
                      : '—'}
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
          <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
          Metodologia de Resolução Contábil do Faturamento:
        </p>
        <p>
          • <strong>Fonte de Dados Oficial:</strong> Motor <code>calcularDreGerencialMatriz</code>{' '}
          da DRE Gerencial. Faturamento = grupo Receitas, considerando resolução contábil lançamento
          → plano de contas → conta.
        </p>
        <p>
          • <strong>Regras de Exclusão & Integridade:</strong> Lançamentos marcados como estornados
          e contas com flags <code>nao_exibir_dre</code> ou <code>nao_exibir_em_nada</code> são
          automaticamente desconsiderados para evitar duplicidade ou distorção fiscal.
        </p>
        <p>
          • <strong>% de Participação Acumulada:</strong> Mede o peso relativo de cada exercício
          financeiro em relação ao total faturado acumulado pela organização ao longo de toda a base
          histórica.
        </p>
        <p>
          • <strong>Variação Ano sobre Ano (YoY):</strong> Apura a taxa de crescimento ou retração
          em relação ao exercício financeiro anterior. Verde indica crescimento e vermelho retração.
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
        documentTitle="Análise de Faturamento Histórico (DRE Gerencial)"
        empresaNome={nomeContexto}
        exercicioAno={
          selectedAno ||
          (analise.anos.length > 0 ? analise.anos[analise.anos.length - 1] : undefined)
        }
      />
    </div>
  )
}
