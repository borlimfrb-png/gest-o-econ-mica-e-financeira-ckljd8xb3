import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useFilter } from '@/contexts/FilterContext'
import { useToast } from '@/hooks/use-toast'
import { EstadoVazioClienteCard } from '@/components/EstadoVazioClienteCard'
import { useRealtime } from '@/hooks/use-realtime'
import { contasService, lancamentosService, planoContasService } from '@/services/financeService'
import type { ContaRecord, LancamentoRecord, PlanoContaRecord } from '@/types/finance'
import { gerarListaMeses } from '@/lib/dreGerencialTypes'
import {
  calcularAnaliseDespesasVariaveis,
  classificarSemaforoPercentual,
  getClassesSemaforoPercentual,
  type DespesasVariaveisAnaliseResultado,
} from '@/lib/despesasVariaveisCalculo'
import {
  exportarDespesasVariaveisExcel,
  exportarDespesasVariaveisCsv,
  formatarPercentualExport,
} from '@/lib/despesasVariaveisExport'
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
  PieChart,
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

export default function DespesasVariaveisAnalise() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { user } = useAuth()
  const { selectedEmpresaId, selectedEmpresa, selectedAno, isGrupoAtivo, grupoAtivo } = useFilter()
  const isCliente = user?.role === 'cliente'

  // Estados de dados
  const [loading, setLoading] = useState(true)
  const [lancamentos, setLancamentos] = useState<LancamentoRecord[]>([])
  const [contas, setContas] = useState<ContaRecord[]>([])
  const [planoContas, setPlanoContas] = useState<PlanoContaRecord[]>([])

  // Modal para classificação em lote do plano de contas
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
      console.error('Erro ao carregar dados da análise de despesas variáveis:', err)
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

  // Validação do limite de 12 meses
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

  // Lista de colunas de meses
  const meses = useMemo(() => {
    return gerarListaMeses(anoInicial, mesInicial, qtdMeses)
  }, [anoInicial, mesInicial, qtdMeses])

  // Cálculo da Análise de Despesas Variáveis (Reutiliza a DRE Gerencial)
  const analise = useMemo<DespesasVariaveisAnaliseResultado>(() => {
    return calcularAnaliseDespesasVariaveis(lancamentos, contas, meses, planoContas)
  }, [lancamentos, contas, meses, planoContas])

  const handleImprimir = () => {
    window.print()
  }

  const handleExportarExcel = () => {
    try {
      exportarDespesasVariaveisExcel(analise, selectedEmpresa, anoInicial)
      toast({
        title: 'Despesas Variáveis Exportadas',
        description: 'Planilha Excel gerada com valores e percentuais de faturamento.',
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
      exportarDespesasVariaveisCsv(analise, selectedEmpresa, anoInicial)
      toast({
        title: 'Despesas Variáveis Exportadas',
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

  // Informações para os cards de resumo
  const totalDespesasVariaveis = analise.totalDespesasVariaveisPeriodo
  const faturamentoPeriodo = analise.faturamentoTotalPeriodo
  const percentualConsolidado = analise.percentualTotalPeriodo
  const semaforoConsolidado = classificarSemaforoPercentual(percentualConsolidado)

  return (
    <div className="space-y-4 animate-fadeIn pb-6 print:p-0 print:m-0">
      {/* Cabeçalho da tela */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-indigo-100/80 text-indigo-800 shadow-xs">
              <PieChart className="w-5 h-5 text-indigo-700" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-[#0B1F3A] tracking-tight">
                  Análise de Despesas Variáveis
                </h1>
                <Badge
                  variant="outline"
                  className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[10px] font-semibold"
                >
                  Gerencial DRE
                </Badge>
              </div>
              <p className="text-[11px] text-[#5B6B7F]">
                Acompanhamento mensal detalhado das contas de despesas variáveis com apuração do
                percentual de cada conta sobre o faturamento do mesmo mês e consolidação geral.
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
            <FolderTree className="w-3.5 h-3.5 text-indigo-600" />
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
                  <span className="text-[10px] text-slate-500">Valores e % do Faturamento</span>
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

      {/* Cards de Resumo Executivo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 print:grid-cols-4">
        {/* Total Despesas Variáveis */}
        <Card className="bg-white border-slate-200/90 shadow-xs hover:border-slate-300 transition-colors">
          <CardContent className="py-2.5 px-3.5">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                Total Despesas Variáveis
              </p>
              <TrendingDown className="w-3.5 h-3.5 text-indigo-600" />
            </div>
            <p className="text-sm font-bold text-indigo-700 mt-0.5 truncate">
              {formatBrl(totalDespesasVariaveis)}
            </p>
            <p className="text-[9.5px] text-slate-500 mt-0.5">
              Soma no período ({meses.length} meses)
            </p>
          </CardContent>
        </Card>

        {/* Faturamento do Período */}
        <Card className="bg-white border-slate-200/90 shadow-xs hover:border-slate-300 transition-colors">
          <CardContent className="py-2.5 px-3.5">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                Faturamento (Receitas)
              </p>
              <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <p className="text-sm font-bold text-emerald-700 mt-0.5 truncate">
              {formatBrl(faturamentoPeriodo)}
            </p>
            <p className="text-[9.5px] text-slate-500 mt-0.5">Base de cálculo mensal</p>
          </CardContent>
        </Card>

        {/* Percentual Consolidado do Período */}
        <Card
          className={`border shadow-xs ${
            semaforoConsolidado === 'verde'
              ? 'bg-gradient-to-br from-emerald-50/90 to-emerald-100/50 border-emerald-300 text-emerald-950'
              : semaforoConsolidado === 'ambar'
                ? 'bg-gradient-to-br from-amber-50/90 to-amber-100/50 border-amber-300 text-amber-950'
                : semaforoConsolidado === 'vermelho'
                  ? 'bg-gradient-to-br from-rose-50/90 to-rose-100/50 border-rose-300 text-rose-950'
                  : 'bg-white border-slate-200'
          }`}
        >
          <CardContent className="py-2.5 px-3.5">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-wider">
                % Despesas / Faturamento
              </p>
              <Percent className="w-3.5 h-3.5 shrink-0 opacity-80" />
            </div>
            <p className="text-base font-extrabold mt-0.5 truncate">
              {formatarPercentualExport(percentualConsolidado)}
            </p>
            <p className="text-[9.5px] font-medium opacity-85 mt-0.5">
              {semaforoConsolidado === 'verde'
                ? 'Carga variável saudável (<25%)'
                : semaforoConsolidado === 'ambar'
                  ? 'Atenção moderada (25-40%)'
                  : semaforoConsolidado === 'vermelho'
                    ? 'Carga variável crítica (>40%)'
                    : 'Sem faturamento base no período'}
            </p>
          </CardContent>
        </Card>

        {/* Quantidade de Contas Ativas */}
        <Card className="bg-white border-slate-200/90 shadow-xs hover:border-slate-300 transition-colors">
          <CardContent className="py-2.5 px-3.5">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                Contas com Lançamento
              </p>
              <FolderTree className="w-3.5 h-3.5 text-indigo-600" />
            </div>
            <p className="text-sm font-bold text-[#0B1F3A] mt-0.5 truncate">
              {analise.contas.length} conta(s)
            </p>
            <p className="text-[9.5px] text-slate-500 mt-0.5">
              Classificação: Despesa Variável DRE
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Cabeçalho para impressão */}
      <div className="hidden print:block mb-4 border-b border-slate-300 pb-2">
        <h2 className="text-lg font-bold text-slate-900">
          ANÁLISE DE DESPESAS VARIÁVEIS E PERCENTUAIS DO FATURAMENTO
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

      {/* ================= TABELA MATRICIAL DE DESPESAS VARIÁVEIS ================= */}
      <Card className="bg-white border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="py-3 px-5 border-b border-slate-100 bg-slate-50/50 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
              <PieChart className="w-4 h-4 text-indigo-700" />
              Matriz de Despesas Variáveis por Período ({meses.length} meses)
            </CardTitle>
            <CardDescription className="text-xs">
              Para cada mês: valor lançado da conta e % sobre o faturamento total daquele mesmo mês.
              No final: total do período e percentual consolidado.
            </CardDescription>
          </div>
          <div className="text-xs text-slate-500 font-medium">
            Período: <strong className="text-slate-800">{meses[0]?.rotuloCurto}</strong> até{' '}
            <strong className="text-slate-800">{meses[meses.length - 1]?.rotuloCurto}</strong>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-slate-500">
                Calculando despesas variáveis e percentuais de faturamento...
              </p>
            </div>
          ) : !analise.temDespesasVariaveis ? (
            /* Estado vazio amigável / orientado ao perfil */
            <div className="p-6">
              {isCliente ? (
                <EstadoVazioClienteCard
                  empresaNome={selectedEmpresa?.nome}
                  ano={selectedAno || anoInicial}
                  mensagem="Nenhum lançamento contábil classificado como despesa variável foi encontrado para esta empresa no exercício selecionado. Entre em contato com seu consultor Borlim para a conciliação do período."
                />
              ) : (
                <div className="py-16 px-6 text-center max-w-md mx-auto space-y-3">
                  <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
                    <FolderTree className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-800">
                    Nenhuma Despesa Variável Lançada no Período
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Não foram encontrados lançamentos para contas com a classificação "Despesa
                    Variável" no horizonte selecionado ({meses[0]?.rotuloCurto} a{' '}
                    {meses[meses.length - 1]?.rotuloCurto}).
                  </p>
                  <div className="pt-2 flex items-center justify-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setModalClassificacaoOpen(true)}
                      className="text-xs font-semibold gap-1.5 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
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
              )}
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
                  {/* Linha 1 de Cabeçalho: Nomes dos Meses */}
                  <tr className="bg-[#0B1F3A] text-white font-bold text-left border-b border-slate-700">
                    <th
                      rowSpan={2}
                      className="py-2.5 px-3 w-[300px] min-w-[260px] sticky left-0 bg-[#0B1F3A] z-20 border-r border-slate-700 text-xs"
                    >
                      <div className="flex flex-col">
                        <span>Contas de Despesas Variáveis</span>
                        <span className="text-[10px] text-blue-200/80 font-normal">
                          Centro de Custo → Tipo → Conta
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

                  {/* Linha 2 de Cabeçalho: Subcolunas Valor (R$) e % Faturamento */}
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
                  {/* Linhas das Contas Agrupadas por Centro de Custo */}
                  {analise.contas.map((conta, idx, arr) => {
                    const centroKey = conta.centroId || conta.centroNome || '__SEM_CENTRO__'
                    const centroAnteriorKey =
                      idx > 0
                        ? arr[idx - 1].centroId || arr[idx - 1].centroNome || '__SEM_CENTRO__'
                        : null
                    const mudouCentro = idx === 0 || centroKey !== centroAnteriorKey
                    const centroNomeExibicao =
                      conta.centroNome?.trim() ||
                      (conta.centroId ? `Centro ${conta.centroId}` : 'Sem Centro de Custo')

                    // Quantidade de contas no grupo do centro
                    const qtdContasNoCentro = arr.filter(
                      (c) => (c.centroId || c.centroNome || '__SEM_CENTRO__') === centroKey,
                    ).length

                    return (
                      <React.Fragment key={conta.id}>
                        {/* Linha / Cabeçalho de Grupo do Centro de Custo (aparece UMA única vez por centro) */}
                        {mudouCentro && (
                          <tr className="bg-slate-100/95 border-t-2 border-b border-slate-300 font-bold text-slate-800 text-[11px] select-none">
                            {/* Coluna fixa à esquerda */}
                            <td className="py-2 px-3 sticky left-0 bg-slate-100 z-10 border-r border-slate-300 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)]">
                              <div className="flex items-center gap-2">
                                <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-indigo-700 text-white shadow-xs">
                                  <Building className="w-3 h-3" />
                                </span>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-[10px] uppercase tracking-wider text-indigo-900 font-black">
                                    Centro de Custo:
                                  </span>
                                  <span className="font-bold text-slate-900 text-xs">
                                    {centroNomeExibicao}
                                  </span>
                                  <span className="text-[9.5px] font-normal text-slate-500 bg-white px-1.5 py-0.2 rounded border border-slate-200">
                                    {qtdContasNoCentro} conta{qtdContasNoCentro > 1 ? 's' : ''}
                                  </span>
                                </div>
                              </div>
                            </td>

                            {/* Colspan para cobrir todos os meses (2 colunas por mês) + 2 colunas do total do período */}
                            <td
                              colSpan={meses.length * 2 + 2}
                              className="py-2 px-3 text-[10px] text-slate-500 font-medium tracking-wide bg-slate-100"
                            >
                              <div className="flex items-center justify-between">
                                <span>Contas vinculadas a este Centro de Custo</span>
                                <span className="text-[9.5px] text-slate-400 font-mono">
                                  {meses.length} meses apurados
                                </span>
                              </div>
                            </td>
                          </tr>
                        )}

                        {/* Linha da Conta Individual (limpa, sem badge repetido de centro) */}
                        <tr className="hover:bg-indigo-50/40 text-slate-700 transition-colors text-[11px]">
                          {/* Coluna Fixa à Esquerda com recuo visual elegante */}
                          <td className="py-2 px-3 pl-6 sticky left-0 bg-white z-10 border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                            <div className="flex items-center gap-2 truncate">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
                              {conta.codigo && (
                                <span className="font-mono text-[10.5px] text-indigo-700 font-semibold shrink-0">
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

                          {/* Colunas dos Meses */}
                          {meses.map((m) => {
                            const val = conta.valoresPorMes[m.chave] || 0
                            const pct = conta.percentuaisPorMes[m.chave]
                            const classesSemaforo = getClassesSemaforoPercentual(pct)

                            return (
                              <React.Fragment key={`val-${conta.id}-${m.chave}`}>
                                {/* Valor R$ */}
                                <td className="py-2 px-1.5 text-right border-r border-slate-100 text-slate-700 whitespace-nowrap font-mono">
                                  {val !== 0 ? (
                                    formatBrl(val)
                                  ) : (
                                    <span className="text-slate-300">—</span>
                                  )}
                                </td>
                                {/* % Fat. */}
                                <td
                                  className={`py-2 px-1.5 text-right border-r border-slate-200 whitespace-nowrap text-[10.5px] bg-slate-50/40 ${classesSemaforo}`}
                                >
                                  {formatarPercentualExport(pct)}
                                </td>
                              </React.Fragment>
                            )
                          })}

                          {/* Total do Período para a conta */}
                          <td className="py-2 px-2 text-right font-semibold bg-slate-100/60 text-slate-900 border-r border-slate-200 whitespace-nowrap font-mono">
                            {formatBrl(conta.totalPeriodo)}
                          </td>
                          <td
                            className={`py-2 px-2 text-right font-semibold bg-slate-100/90 whitespace-nowrap text-[10.5px] ${getClassesSemaforoPercentual(
                              conta.percentualPeriodo,
                            )}`}
                          >
                            {formatarPercentualExport(conta.percentualPeriodo)}
                          </td>
                        </tr>
                      </React.Fragment>
                    )
                  })}

                  {/* ================= LINHA DE TOTAL DE DESPESAS VARIÁVEIS ================= */}
                  <tr className="bg-indigo-50/80 text-indigo-950 font-bold border-t-2 border-indigo-300 text-xs">
                    <td className="py-2.5 px-3 sticky left-0 bg-indigo-50 z-10 border-r border-indigo-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold uppercase text-[11px] tracking-wider text-indigo-950">
                          TOTAL DE DESPESAS VARIÁVEIS
                        </span>
                        <Badge
                          variant="outline"
                          className="text-[9px] bg-indigo-100 text-indigo-900 border-indigo-300"
                        >
                          Soma
                        </Badge>
                      </div>
                    </td>

                    {meses.map((m) => {
                      const totVar = analise.totalDespesasVariaveisPorMes[m.chave] || 0
                      const pctTot = analise.percentualTotalPorMes[m.chave]
                      const semaforo = classificarSemaforoPercentual(pctTot)

                      return (
                        <React.Fragment key={`tot-${m.chave}`}>
                          <td className="py-2.5 px-1.5 text-right font-extrabold border-r border-indigo-200 text-indigo-900 whitespace-nowrap font-mono">
                            {totVar !== 0 ? (
                              formatBrl(totVar)
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                          <td
                            className={`py-2.5 px-1.5 text-right font-black border-r border-indigo-300 whitespace-nowrap text-[11px] bg-indigo-100/40 ${
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

                    {/* Total Geral de Despesas Variáveis */}
                    <td className="py-2.5 px-2 text-right font-black text-indigo-950 bg-indigo-100 border-r border-indigo-300 whitespace-nowrap font-mono">
                      {formatBrl(analise.totalDespesasVariaveisPeriodo)}
                    </td>
                    <td
                      className={`py-2.5 px-2 text-right font-black text-xs bg-indigo-200/80 whitespace-nowrap ${
                        semaforoConsolidado === 'verde'
                          ? 'text-emerald-900'
                          : semaforoConsolidado === 'ambar'
                            ? 'text-amber-900'
                            : semaforoConsolidado === 'vermelho'
                              ? 'text-rose-950'
                              : 'text-slate-500'
                      }`}
                    >
                      {formatarPercentualExport(analise.percentualTotalPeriodo)}
                    </td>
                  </tr>

                  {/* ================= LINHA DE FATURAMENTO DO MÊS (RECEITAS DRE) ================= */}
                  <tr className="bg-emerald-50/70 text-emerald-950 font-bold border-y border-emerald-200 text-xs">
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
                      const fat = analise.faturamentoPorMes[m.chave] || 0
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
                      {formatBrl(analise.faturamentoTotalPeriodo)}
                    </td>
                    <td className="py-2.5 px-2 text-right font-black text-xs text-emerald-950 bg-emerald-200/70 whitespace-nowrap">
                      {analise.faturamentoTotalPeriodo > 0 ? '100%' : '—'}
                    </td>
                  </tr>

                  {/* ================= BLOCO FINAL DE SOMA GERAL & ÍNDICE CONSOLIDADO ================= */}
                  <tr className="bg-[#0B1F3A] text-white font-extrabold text-xs border-t-2 border-slate-700">
                    <td className="py-3 px-3 sticky left-0 bg-[#0B1F3A] z-10 border-r border-slate-700 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.25)]">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] uppercase tracking-wider font-extrabold text-blue-100 flex items-center gap-1.5">
                          <Percent className="w-3.5 h-3.5 text-amber-300" />
                          ÍNDICE CONSOLIDADO (% FATURAMENTO)
                        </span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-slate-200 font-mono">
                          Mês a Mês
                        </span>
                      </div>
                    </td>

                    {meses.map((m) => {
                      const pctTot = analise.percentualTotalPorMes[m.chave]
                      const semaforo = classificarSemaforoPercentual(pctTot)

                      return (
                        <React.Fragment key={`idx-${m.chave}`}>
                          <td className="py-3 px-1.5 text-right border-r border-slate-700 text-slate-300 whitespace-nowrap text-[10.5px]">
                            {totVarTexto(analise.totalDespesasVariaveisPorMes[m.chave])}
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

                    <td className="py-3 px-2 text-right border-r border-slate-700 text-blue-200 whitespace-nowrap text-[10.5px] font-semibold bg-[#132c4d]">
                      Geral
                    </td>
                    <td
                      className={`py-3 px-2 text-right font-black text-sm whitespace-nowrap bg-[#18365e] ${
                        semaforoConsolidado === 'verde'
                          ? 'text-emerald-300'
                          : semaforoConsolidado === 'ambar'
                            ? 'text-amber-300'
                            : semaforoConsolidado === 'vermelho'
                              ? 'text-rose-300'
                              : 'text-slate-300'
                      }`}
                    >
                      {formatarPercentualExport(analise.percentualTotalPeriodo)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bloco de Soma Geral Consolidada (Destaque ao Consultor) */}
      {analise.temDespesasVariaveis && (
        <Card className="bg-gradient-to-r from-[#0B1F3A] to-[#152e50] text-white border-none shadow-md overflow-hidden">
          <CardContent className="p-4 sm:p-5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="p-1 rounded bg-indigo-500/30 text-indigo-200 border border-indigo-400/40">
                    <Info className="w-4 h-4" />
                  </span>
                  <h3 className="text-sm font-bold tracking-tight text-white">
                    Soma Geral e Diagnóstico das Despesas Variáveis do Período
                  </h3>
                </div>
                <p className="text-xs text-blue-200/90 leading-relaxed max-w-2xl">
                  No período de <strong>{meses[0]?.rotuloCurto}</strong> a{' '}
                  <strong>{meses[meses.length - 1]?.rotuloCurto}</strong>, as despesas variáveis
                  acumularam <strong>{formatBrl(totalDespesasVariaveis)}</strong> contra um
                  faturamento geral de <strong>{formatBrl(faturamentoPeriodo)}</strong>, resultando
                  num percentual consolidado de{' '}
                  <strong className="text-amber-300">
                    {formatarPercentualExport(percentualConsolidado)}
                  </strong>
                  .
                </p>
              </div>

              {/* Indicador em destaque */}
              <div className="flex items-center gap-4 bg-white/10 rounded-xl p-3 border border-white/15 shrink-0">
                <div>
                  <p className="text-[10px] text-blue-200 uppercase font-semibold">
                    Índice Consolidado
                  </p>
                  <p
                    className={`text-xl font-black ${
                      semaforoConsolidado === 'verde'
                        ? 'text-emerald-300'
                        : semaforoConsolidado === 'ambar'
                          ? 'text-amber-300'
                          : 'text-rose-300'
                    }`}
                  >
                    {formatarPercentualExport(percentualConsolidado)}
                  </p>
                </div>
                <div className="h-8 w-px bg-white/20" />
                <div className="text-left text-[11px] leading-tight">
                  <span className="text-slate-300 block">Classificação:</span>
                  <span
                    className={`font-bold ${
                      semaforoConsolidado === 'verde'
                        ? 'text-emerald-300'
                        : semaforoConsolidado === 'ambar'
                          ? 'text-amber-300'
                          : 'text-rose-300'
                    }`}
                  >
                    {semaforoConsolidado === 'verde'
                      ? 'Nível Baixo (<25%)'
                      : semaforoConsolidado === 'ambar'
                        ? 'Nível Médio (25-40%)'
                        : 'Nível Elevado (>40%)'}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Explicação da Metodologia e Critérios de Análise */}
      <div className="text-xs text-slate-500 bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1.5 print:border-none print:bg-white print:p-0">
        <p className="font-semibold text-slate-700 flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-indigo-600" />
          Metodologia de Análise de Despesas Variáveis:
        </p>
        <p>
          • <strong>Resolução Contábil:</strong> Contas classificadas como "Despesa Variável" na
          estrutura DRE do Plano de Contas. Respeita as flags de exclusão gerencial: contas marcadas
          como "Não em nada" ou "Não DRE" são automaticamente ignoradas.
        </p>
        <p>
          • <strong>Percentual Mensal:</strong> Calculado pela fórmula{' '}
          <code className="bg-slate-200/80 px-1 py-0.5 rounded text-slate-800 font-mono text-[10.5px]">
            (Valor da Conta no Mês ÷ Faturamento Total do Mesmo Mês) × 100
          </code>
          . Meses sem faturamento são exibidos como traço (—) para não distorcer a média.
        </p>
        <p>
          • <strong>Índice de Sobrecarga Variável:</strong> Mede o impacto proporcional das despesas
          que variam diretamente com a atividade operacional ou volume de vendas (como comissões,
          fretes, taxas de intermediação e custos variáveis de operação) sobre a receita da empresa.
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
        documentTitle="Análise de Despesas Variáveis e % de Faturamento"
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

function totVarTexto(val: number | undefined): string {
  if (!val || val === 0) return '—'
  return formatBrl(val)
}
