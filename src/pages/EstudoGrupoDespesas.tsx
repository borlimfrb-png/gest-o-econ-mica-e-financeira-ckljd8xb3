import { useMemo, useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-dom'
import { useNavigate as useReactRouterNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useFilter } from '@/contexts/FilterContext'
import { useToast } from '@/hooks/use-toast'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Layers,
  DollarSign,
  Percent,
  RefreshCw,
  Download,
  FileSpreadsheet,
  Printer,
  AlertTriangle,
  Calendar,
  Building,
  TrendingDown,
  FolderTree,
  Info,
} from 'lucide-react'
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
  BarChart,
} from 'recharts'
import {
  calcularEstudoGrupoDespesas,
  GRUPO_DESPESA_FALLBACK,
  type EstudoGrupoDespesasResultado,
} from '@/lib/estudoGrupoDespesasCalculo'
import {
  exportarEstudoGrupoDespesasExcel,
  exportarEstudoGrupoDespesasCsv,
} from '@/lib/estudoGrupoDespesasExport'
import { formatarPercentualExport } from '@/lib/despesasFixasExport'
import { gerarListaMeses } from '@/lib/dreGerencialCalculo'
import { lancamentosService } from '@/services/financeService'
import { contasService, planoContasService } from '@/services/financeService'
import { useRealtime } from '@/hooks/use-realtime'
import type { ContaRecord, LancamentoRecord, PlanoContaRecord } from '@/types/finance'
import { EstadoVazioClienteCard } from '@/components/EstadoVazioClienteCard'

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

interface SerieMensalItem {
  mes: string
  [grupo: string]: string | number
}

export default function EstudoGrupoDespesas() {
  const navigate = useReactRouterNavigate()
  const { toast } = useToast()
  const { user } = useAuth()
  const { selectedEmpresaId, selectedEmpresa, selectedAno, isGrupoAtivo, grupoAtivo } = useFilter()
  const isCliente = user?.role === 'cliente'

  const [loading, setLoading] = useState(true)
  const [lancamentos, setLancamentos] = useState<LancamentoRecord[]>([])
  const [contas, setContas] = useState<ContaRecord[]>([])
  const [planoContas, setPlanoContas] = useState<PlanoContaRecord[]>([])

  const currentYear = selectedAno || new Date().getFullYear()
  const [anoInicial, setAnoInicial] = useState<number>(currentYear)
  const [mesInicial, setMesInicial] = useState<number>(1)
  const [qtdMeses, setQtdMeses] = useState<number>(12)
  const [avisoLimiteMeses, setAvisoLimiteMeses] = useState(false)

  // Grupo em foco no gráfico de evolução (null = todos os grupos)
  const [grupoFoco, setGrupoFoco] = useState<string | null>(null)

  useEffect(() => {
    if (selectedAno) setAnoInicial(selectedAno)
  }, [selectedAno])

  const carregarDados = useCallback(async () => {
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
      console.error('Erro ao carregar dados do estudo por grupo de despesas:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar dados',
        description: 'Não foi possível carregar os lançamentos e o plano de contas.',
      })
    } finally {
      setLoading(false)
    }
  }, [selectedEmpresaId, isGrupoAtivo, grupoAtivo, toast])

  useEffect(() => {
    carregarDados()
  }, [carregarDados])

  useRealtime<LancamentoRecord>('lancamentos', () => carregarDados())
  useRealtime<ContaRecord>('contas', () => carregarDados())

  useEffect(() => {
    const handleRecarregar = () => carregarDados()
    window.addEventListener('dre-contas-atualizadas', handleRecarregar)
    window.addEventListener('dre-contas-atualizado', handleRecarregar)
    return () => {
      window.removeEventListener('dre-contas-atualizadas', handleRecarregar)
      window.removeEventListener('dre-contas-atualizado', handleRecarregar)
    }
  }, [carregarDados])

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

  const meses = useMemo(
    () => gerarListaMeses(anoInicial, mesInicial, qtdMeses),
    [anoInicial, mesInicial, qtdMeses],
  )

  const estudo = useMemo<EstudoGrupoDespesasResultado>(
    () => calcularEstudoGrupoDespesas(lancamentos, contas, meses, planoContas),
    [lancamentos, contas, meses, planoContas],
  )

  // Cores estáveis por grupo (paleta Tailwind-like, determinística pela ordem)
  const CORES_GRUPOS = [
    '#2563eb',
    '#059669',
    '#d97706',
    '#7c3aed',
    '#dc2626',
    '#0891b2',
    '#65a30d',
    '#db2777',
  ]
  const corPorIndice = (i: number) => CORES_GRUPOS[i % CORES_GRUPOS.length]

  // Dados do gráfico de evolução mensal (uma coluna por mês, uma série por grupo)
  const dadosEvolucao = useMemo<SerieMensalItem[]>(() => {
    return estudo.meses.map((m) => {
      const item: SerieMensalItem = { mes: m.rotuloCurto }
      for (const g of estudo.grupos) {
        item[g.grupo] = g.valoresPorMes[m.chave] || 0
      }
      item['Faturamento'] = estudo.faturamentoPorMes[m.chave] || 0
      return item
    })
  }, [estudo])

  const gruposVisiveis = useMemo(
    () => (grupoFoco ? estudo.grupos.filter((g) => g.grupo === grupoFoco) : estudo.grupos),
    [estudo, grupoFoco],
  )

  const handleImprimir = () => window.print()

  const handleExportarExcel = () => {
    try {
      exportarEstudoGrupoDespesasExcel(estudo, selectedEmpresa, anoInicial)
      toast({
        title: 'Estudo por Grupo Exportado',
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
      exportarEstudoGrupoDespesasCsv(estudo, selectedEmpresa, anoInicial)
      toast({
        title: 'Estudo por Grupo Exportado',
        description: 'Arquivo CSV gerado com valores e percentuais de faturamento.',
      })
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: 'Erro na exportação',
        description: e?.message || 'Falha ao gerar arquivo CSV.',
      })
    }
  }

  const tooltipFormatterMoeda = (value: number | string) => formatBrl(Number(value))

  return (
    <div className="space-y-4 animate-fadeIn pb-6 print:p-0 print:m-0">
      {/* Cabeçalho da tela */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-violet-100/80 text-violet-800 shadow-xs">
              <Layers className="w-5 h-5 text-violet-700" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-[#0B1F3A] tracking-tight">
                  Estudo por Grupo de Despesas
                </h1>
                <Badge
                  variant="outline"
                  className="bg-violet-50 text-violet-700 border-violet-200 text-[10px] font-semibold"
                >
                  Gerencial DRE
                </Badge>
              </div>
              <p className="text-[11px] text-[#5B6B7F]">
                Compara cada grupo de despesa fixa (campo "Grupo de Despesa" do plano de contas) com
                o faturamento do período, mês a mês e consolidado.
              </p>
            </div>
          </div>
        </div>

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

      {/* Barra de Filtros */}
      <Card className="bg-white border-slate-200/90 shadow-xs print:hidden">
        <CardContent className="py-3 px-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
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

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 print:grid-cols-4">
        <Card className="bg-white border-slate-200/90 shadow-xs hover:border-slate-300 transition-colors">
          <CardContent className="py-2.5 px-3.5">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                Total Despesas Fixas
              </p>
              <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
            </div>
            <p className="text-sm font-bold text-rose-700 mt-0.5 truncate">
              {formatBrl(estudo.totalDespesasFixasPeriodo)}
            </p>
            <p className="text-[9.5px] text-slate-500 mt-0.5">
              Soma no período ({meses.length} meses)
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200/90 shadow-xs hover:border-slate-300 transition-colors">
          <CardContent className="py-2.5 px-3.5">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                Faturamento (Receitas)
              </p>
              <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <p className="text-sm font-bold text-emerald-700 mt-0.5 truncate">
              {formatBrl(estudo.faturamentoTotalPeriodo)}
            </p>
            <p className="text-[9.5px] text-slate-500 mt-0.5">Base de cálculo mensal</p>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200/90 shadow-xs hover:border-slate-300 transition-colors">
          <CardContent className="py-2.5 px-3.5">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                % Despesas / Faturamento
              </p>
              <Percent className="w-3.5 h-3.5 text-blue-600" />
            </div>
            <p className="text-base font-extrabold text-[#0B1F3A] mt-0.5 truncate">
              {formatarPercentualExport(estudo.percentualTotalPeriodo)}
            </p>
            <p className="text-[9.5px] text-slate-500 mt-0.5">Índice consolidado do período</p>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200/90 shadow-xs hover:border-slate-300 transition-colors">
          <CardContent className="py-2.5 px-3.5">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                Grupos Cadastrados
              </p>
              <Layers className="w-3.5 h-3.5 text-violet-600" />
            </div>
            <p className="text-sm font-bold text-[#0B1F3A] mt-0.5 truncate">
              {estudo.grupos.length} grupo(s)
            </p>
            <p className="text-[9.5px] text-slate-500 mt-0.5">
              Campo "Grupo de Despesa" do plano de contas
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Cabeçalho para impressão */}
      <div className="hidden print:block mb-4 border-b border-slate-300 pb-2">
        <h2 className="text-lg font-bold text-slate-900">
          ESTUDO POR GRUPO DE DESPESAS E PERCENTUAIS DO FATURAMENTO
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

      {/* Gráfico: evolução mensal despesas fixas x faturamento */}
      <Card className="bg-white border-slate-200 shadow-sm print:hidden">
        <CardHeader className="py-3 px-5 border-b border-slate-100 bg-slate-50/50 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
              <Layers className="w-4 h-4 text-violet-700" />
              Evolução Mensal — Despesas Fixas por Grupo x Faturamento
            </CardTitle>
            <CardDescription className="text-xs">
              Barras: valor de despesa fixa por grupo. Linha: faturamento do mês.
            </CardDescription>
          </div>
          <Select
            value={grupoFoco ?? '__TODOS__'}
            onValueChange={(val) => setGrupoFoco(val === '__TODOS__' ? null : val)}
          >
            <SelectTrigger className="h-8 text-xs bg-white w-56 cursor-pointer">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__TODOS__" className="text-xs">
                Todos os grupos
              </SelectItem>
              {estudo.grupos.map((g) => (
                <SelectItem key={g.grupo} value={g.grupo} className="text-xs">
                  {g.grupo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="py-4 px-4">
          {estudo.grupos.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-10">Sem dados para o período.</p>
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={dadosEvolucao}
                  margin={{ top: 8, right: 12, bottom: 0, left: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    tickFormatter={(v: number) =>
                      v >= 1000000
                        ? `${(v / 1000000).toFixed(1)}M`
                        : v >= 1000
                          ? `${(v / 1000).toFixed(0)}k`
                          : String(v)
                    }
                  />
                  <RechartsTooltip
                    formatter={(value, name) => [
                      tooltipFormatterMoeda(value as number),
                      String(name),
                    ]}
                    labelStyle={{ fontWeight: 700, color: '#0B1F3A' }}
                    contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }}
                  />
                  <Legend wrapperStyle={{ fontSize: 10.5 }} />
                  {gruposVisiveis.map((g, i) => (
                    <Bar
                      key={g.grupo}
                      dataKey={g.grupo}
                      stackId="grupos"
                      fill={corPorIndice(estudo.grupos.findIndex((x) => x.grupo === g.grupo))}
                      radius={i === gruposVisiveis.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]}
                      maxBarSize={38}
                    />
                  ))}
                  <Line
                    type="monotone"
                    dataKey="Faturamento"
                    stroke="#059669"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Gráfico: % de cada grupo sobre o faturamento */}
      <Card className="bg-white border-slate-200 shadow-sm print:hidden">
        <CardHeader className="py-3 px-5 border-b border-slate-100 bg-slate-50/50">
          <CardTitle className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
            <Percent className="w-4 h-4 text-blue-700" />% de Cada Grupo sobre o Faturamento
          </CardTitle>
          <CardDescription className="text-xs">
            Peso de cada grupo de despesa fixa no faturamento do mês.
          </CardDescription>
        </CardHeader>
        <CardContent className="py-4 px-4">
          {estudo.grupos.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-10">Sem dados para o período.</p>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={estudo.meses.map((m) => {
                    const item: SerieMensalItem = { mes: m.rotuloCurto }
                    for (const g of estudo.grupos) {
                      item[g.grupo] = g.percentuaisPorMes[m.chave] ?? 0
                    }
                    return item
                  })}
                  margin={{ top: 8, right: 12, bottom: 0, left: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    tickFormatter={(v: number) => `${v.toFixed(0)}%`}
                  />
                  <RechartsTooltip
                    formatter={(value, name) => [`${Number(value).toFixed(2)}%`, String(name)]}
                    labelStyle={{ fontWeight: 700, color: '#0B1F3A' }}
                    contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }}
                  />
                  <Legend wrapperStyle={{ fontSize: 10.5 }} />
                  {estudo.grupos.map((g) => (
                    <Bar
                      key={g.grupo}
                      dataKey={g.grupo}
                      stackId="pct"
                      fill={corPorIndice(estudo.grupos.findIndex((x) => x.grupo === g.grupo))}
                      maxBarSize={38}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabela matricial por grupo */}
      <Card className="bg-white border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="py-3 px-5 border-b border-slate-100 bg-slate-50/50 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
              <Layers className="w-4 h-4 text-violet-700" />
              Estudo por Grupo de Despesa ({meses.length} meses)
            </CardTitle>
            <CardDescription className="text-xs">
              Para cada grupo: valor de despesa fixa e % sobre o faturamento do mesmo mês. Contas
              sem grupo cadastrado entram em "{GRUPO_DESPESA_FALLBACK}".
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
              <div className="w-8 h-8 border-3 border-violet-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-slate-500">Calculando grupos de despesa...</p>
            </div>
          ) : !estudo.temDados ? (
            <div className="p-6">
              {isCliente ? (
                <EstadoVazioClienteCard
                  empresaNome={selectedEmpresa?.nome}
                  ano={selectedAno || anoInicial}
                  mensagem="Nenhum grupo de despesa com lançamento foi encontrado para esta empresa no período selecionado. Entre em contato com seu consultor Borlim para a conciliação do período."
                />
              ) : (
                <div className="py-16 px-6 text-center max-w-md mx-auto space-y-3">
                  <div className="w-12 h-12 rounded-full bg-violet-50 text-violet-600 flex items-center justify-center mx-auto">
                    <FolderTree className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-800">Sem dados para o período</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Nenhuma despesa fixa lançada no horizonte selecionado ({meses[0]?.rotuloCurto} a{' '}
                    {meses[meses.length - 1]?.rotuloCurto}). Cadastre o "Grupo de Despesa" nas
                    contas (plano de contas) e lance as despesas do período.
                  </p>
                  <div className="pt-2 flex items-center justify-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => navigate('/contas')}
                      className="text-xs font-semibold bg-[#0B1F3A] hover:bg-blue-900 text-white gap-1.5 cursor-pointer"
                    >
                      <Info className="w-3.5 h-3.5" />
                      Cadastrar Grupos nas Contas
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 hover:bg-slate-50">
                    <TableHead className="text-[10.5px] font-bold text-slate-600 uppercase tracking-wider min-w-[220px]">
                      Grupo de Despesa
                    </TableHead>
                    {estudo.meses.map((m) => (
                      <TableHead
                        key={m.chave}
                        colSpan={2}
                        className="text-[10.5px] font-bold text-slate-600 text-center border-l border-slate-100"
                      >
                        {m.rotuloCurto}
                      </TableHead>
                    ))}
                    <TableHead
                      colSpan={2}
                      className="text-[10.5px] font-bold text-slate-900 text-center border-l border-slate-200 bg-slate-100"
                    >
                      Total Período
                    </TableHead>
                  </TableRow>
                  <TableRow className="bg-slate-50 hover:bg-slate-50">
                    <TableHead className="text-[9.5px] text-slate-400 font-semibold">
                      &nbsp;
                    </TableHead>
                    {estudo.meses.map((m) => (
                      <TableHeadContainer key={m.chave} />
                    ))}
                    <TableHeadContainer chave="total" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {estudo.grupos.map((g) => (
                    <TableRow key={g.grupo} className="hover:bg-slate-50/60">
                      <TableCell className="text-xs font-bold text-[#0B1F3A] py-2 max-w-[220px]">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="w-2.5 h-2.5 rounded-sm shrink-0"
                            style={{
                              backgroundColor: corPorIndice(
                                estudo.grupos.findIndex((x) => x.grupo === g.grupo),
                              ),
                            }}
                          />
                          <span className="truncate" title={g.contas.map((c) => c.nome).join(', ')}>
                            {g.grupo}
                          </span>
                          <span className="text-[9.5px] font-medium text-slate-400">
                            ({g.contas.length} conta{g.contas.length !== 1 ? 's' : ''})
                          </span>
                        </div>
                      </TableCell>
                      {estudo.meses.map((m) => (
                        <GrupoMesCells
                          key={m.chave}
                          valor={g.valoresPorMes[m.chave] || 0}
                          pct={g.percentuaisPorMes[m.chave]}
                        />
                      ))}
                      <GrupoMesCells destaque valor={g.totalPeriodo} pct={g.percentualPeriodo} />
                    </TableRow>
                  ))}
                  {/* TOTAL DESPESAS FIXAS */}
                  <TableRow className="bg-rose-50/60 hover:bg-rose-50/60 font-bold">
                    <TableCell className="text-xs font-extrabold text-rose-800 py-2">
                      TOTAL DE DESPESAS FIXAS
                    </TableCell>
                    {estudo.meses.map((m) => (
                      <GrupoMesCells
                        key={m.chave}
                        destaque
                        valor={estudo.totalDespesasFixasPorMes[m.chave] || 0}
                        pct={estudo.percentualTotalPorMes[m.chave]}
                      />
                    ))}
                    <GrupoMesCells
                      destaque
                      valor={estudo.totalDespesasFixasPeriodo}
                      pct={estudo.percentualTotalPeriodo}
                    />
                  </TableRow>
                  {/* FATURAMENTO */}
                  <TableRow className="bg-emerald-50/60 hover:bg-emerald-50/60 font-bold">
                    <TableCell className="text-xs font-extrabold text-emerald-800 py-2">
                      FATURAMENTO DO MÊS (RECEITAS)
                    </TableCell>
                    {estudo.meses.map((m) => (
                      <GrupoMesCells
                        key={m.chave}
                        destaque
                        valor={estudo.faturamentoPorMes[m.chave] || 0}
                        pct={null}
                        pctFixo="100,00%"
                      />
                    ))}
                    <GrupoMesCells
                      destaque
                      valor={estudo.faturamentoTotalPeriodo}
                      pct={null}
                      pctFixo="100,00%"
                    />
                  </TableRow>
                  {/* ÍNDICE CONSOLIDADO */}
                  <TableRow className="bg-blue-50/60 hover:bg-blue-50/60 font-bold">
                    <TableCell className="text-xs font-extrabold text-blue-800 py-2">
                      % DESPESAS FIXAS / FATURAMENTO
                    </TableCell>
                    {estudo.meses.map((m) => (
                      <GrupoMesCells
                        key={m.chave}
                        destaque
                        valor={null}
                        pct={estudo.percentualTotalPorMes[m.chave]}
                      />
                    ))}
                    <GrupoMesCells destaque valor={null} pct={estudo.percentualTotalPeriodo} />
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function TableHeadContainer({ chave }: { chave?: string }) {
  return (
    <>
      <TableHead className="text-[9.5px] text-slate-400 font-semibold text-right w-24 border-l border-slate-100">
        R$
      </TableHead>
      <TableHead key={chave} className="text-[9.5px] text-slate-400 font-semibold text-right w-16">
        %
      </TableHead>
    </>
  )
}

function GrupoMesCells({
  valor,
  pct,
  destaque,
  pctFixo,
}: {
  valor: number | null
  pct: number | null
  destaque?: boolean
  pctFixo?: string
}) {
  return (
    <>
      <TableCell
        className={`text-[11px] text-right py-1.5 border-l border-slate-100 ${
          destaque ? 'font-bold text-slate-800' : 'text-slate-600'
        }`}
      >
        {valor === null ? '—' : formatBrl(valor)}
      </TableCell>
      <TableCell
        className={`text-[11px] text-right py-1.5 ${
          destaque ? 'font-bold text-slate-800' : 'text-slate-500'
        }`}
      >
        {pctFixo ? pctFixo : formatarPercentualExport(pct)}
      </TableCell>
    </>
  )
}
