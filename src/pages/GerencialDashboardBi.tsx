import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFilter } from '@/contexts/FilterContext'
import { useToast } from '@/hooks/use-toast'
import { useRealtime } from '@/hooks/use-realtime'
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
import {
  calcularAnaliseRentabilidade,
  type AnaliseRentabilidadeResultado,
} from '@/lib/analiseRentabilidadeCalculo'
import { calcularBalanco } from '@/lib/financeCalculations'
import { DocumentPrintFooter } from '@/components/DocumentPrintFooter'
import { BorlimLogo } from '@/components/BorlimLogo'
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
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import {
  DollarSign,
  TrendingUp,
  Percent,
  ArrowLeft,
  Calendar,
  Printer,
  Download,
  Sparkles,
  FileSpreadsheet,
  PieChart as PieIcon,
  Scale,
  BarChart3,
} from 'lucide-react'
import {
  exportarDashboardBiExcel,
  exportarDashboardBiCsv,
  type DadosExportacaoDashboardBi,
} from '@/lib/dashboardBiExport'
import {
  CORES_DONUT_BI,
  PALETA_BI,
  KpiCardBi,
  KpiCardBiSkeleton,
  EstadoVazioGraficoBi,
  gridPropsBI,
  legendStyleBI,
  tickPropsBI,
  tooltipLabelStyleBI,
  tooltipStyleBI,
} from '@/components/dashboardBiVisual'

export default function GerencialDashboardBi() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const {
    selectedEmpresaId,
    selectedEmpresa,
    selectedAno,
    isGrupoAtivo,
    grupoAtivo,
    empresasIdsAtivas,
    anosDisponiveis,
  } = useFilter()

  const [loading, setLoading] = useState(true)
  const [lancamentos, setLancamentos] = useState<LancamentoRecord[]>([])
  const [contas, setContas] = useState<ContaRecord[]>([])
  const [planoContas, setPlanoContas] = useState<PlanoContaRecord[]>([])
  const [balanco, setBalanco] = useState<BalancoRecord | null>(null)

  // Filtros de período (exercício e janela de meses)
  const currentYear = selectedAno || new Date().getFullYear()
  const [anoInicial, setAnoInicial] = useState<number>(currentYear)
  const [mesInicial, setMesInicial] = useState<number>(1)
  const [qtdMeses, setQtdMeses] = useState<number>(12)

  useEffect(() => {
    if (selectedAno) {
      setAnoInicial(selectedAno)
    }
  }, [selectedAno])

  const empresaIdAlvo =
    selectedEmpresaId && !selectedEmpresaId.startsWith('grupo-')
      ? selectedEmpresaId
      : selectedEmpresa?.id || null

  const nomeEntidade = useMemo(() => {
    if (isGrupoAtivo && grupoAtivo) {
      return `Grupo: ${grupoAtivo.nome}`
    }
    return selectedEmpresa?.nome || selectedEmpresa?.nome_fantasia || 'Empresa Ativa'
  }, [isGrupoAtivo, grupoAtivo, selectedEmpresa])

  const carregarDados = async () => {
    try {
      setLoading(true)

      let lancsPromise: Promise<LancamentoRecord[]>
      let contasPromise: Promise<ContaRecord[]>
      let planosPromise: Promise<PlanoContaRecord[]>
      let balancoPromise: Promise<BalancoRecord | null>

      if (empresaIdAlvo) {
        lancsPromise = lancamentosService.getAll({
          empresaId: empresaIdAlvo,
          expandRelations: true,
        })
        contasPromise = contasService.getAll({ empresaId: empresaIdAlvo })
        planosPromise = planoContasService.getAll({ empresaId: empresaIdAlvo })
        balancoPromise = balancosService
          .getByEmpresa(empresaIdAlvo)
          .then((list) => list.find((b) => b.ano === anoInicial) || null)
          .catch(() => null)
      } else if (empresasIdsAtivas.length > 0) {
        const empOpts = { empresasIds: empresasIdsAtivas }
        lancsPromise = lancamentosService.getAll({ expandRelations: true })
        contasPromise = contasService.getAll(empOpts)
        planosPromise = planoContasService.getAll(empOpts)
        balancoPromise = Promise.resolve(null)
      } else {
        lancsPromise = Promise.resolve([])
        contasPromise = Promise.resolve([])
        planosPromise = Promise.resolve([])
        balancoPromise = Promise.resolve(null)
      }

      const [contasList, lancamentosList, planosList, balancoItem] = await Promise.all([
        contasPromise,
        lancsPromise,
        planosPromise,
        balancoPromise,
      ])

      setContas(Array.from(new Map(contasList.map((i) => [i.id, i])).values()))
      setLancamentos(lancamentosList)
      setPlanoContas(Array.from(new Map(planosList.map((i) => [i.id, i])).values()))
      setBalanco(balancoItem)
    } catch (err) {
      console.error('Erro ao carregar dados do Dashboard BI Gerencial:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar dados',
        description: 'Não foi possível carregar os dados financeiros para o BI.',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarDados()
  }, [empresaIdAlvo, anoInicial, empresasIdsAtivas])

  useRealtime('lancamentos', () => carregarDados())
  useRealtime('contas', () => carregarDados())
  useRealtime('plano_contas', () => carregarDados())
  useRealtime('balancos', () => carregarDados())

  // Lista de meses
  const meses = useMemo(() => {
    return gerarListaMeses(anoInicial, mesInicial, qtdMeses)
  }, [anoInicial, mesInicial, qtdMeses])

  // Motor oficial DRE / Rentabilidade — números idênticos à DRE Gerencial (paridade EBITDA)
  const analiseRentabilidade = useMemo<AnaliseRentabilidadeResultado>(() => {
    return calcularAnaliseRentabilidade(lancamentos, contas, meses, planoContas)
  }, [lancamentos, contas, meses, planoContas])

  // Liquidez Corrente via balanço (null = sem balanço no exercício → nunca vira zero)
  const liquidezCorrente = useMemo<number | null>(() => {
    if (!balanco) return null
    const b = calcularBalanco(balanco)
    return b.passivoCirculante > 0 ? b.ativoCirculante / b.passivoCirculante : null
  }, [balanco])

  // Dados para o gráfico de evolução mensal (Faturamento vs Despesas e Lucro)
  const dadosEvolucaoMensal = useMemo(() => {
    return analiseRentabilidade.itensPorMes.map((item) => {
      const despesasTotais = item.despesasVariaveis + item.despesasFixas + item.despesasFinanceiras
      return {
        mes: item.rotuloCurto,
        mesCompleto: item.rotuloCompleto,
        faturamento: item.faturamento,
        despesasTotais,
        despesasFixas: item.despesasFixas,
        despesasVariaveis: item.despesasVariaveis,
        despesasFinanceiras: item.despesasFinanceiras,
        lucroApurado: item.lucroApurado,
        margemLiquida: item.margemSobreFaturamento,
        margemBruta: item.margemBruta,
        margemOperacional: item.margemOperacional,
      }
    })
  }, [analiseRentabilidade])

  const temMovimentoMensal = dadosEvolucaoMensal.some(
    (d) => d.faturamento > 0 || d.despesasTotais > 0,
  )

  // Composição de despesas por centro de custo (Donut)
  const centrosDonut = useMemo(() => {
    const mapaCentros = new Map<string, number>()
    const planosMap = new Map<string, PlanoContaRecord>()
    for (const p of planoContas) planosMap.set(p.id, p)

    const chavesMeses = new Set(meses.map((m) => m.chave))

    for (const l of lancamentos) {
      if (l.estornado || !l.data) continue
      const mChave = l.data.slice(0, 7)
      if (!chavesMeses.has(mChave)) continue

      const p = l.plano_conta ? planosMap.get(l.plano_conta) : undefined
      const centroNome = p?.expand?.centro?.nome || 'Geral / Não Alocado'
      const valor = Number(l.valor) || 0

      // Considera apenas débitos operacionais
      if (l.tipo === 'debito') {
        mapaCentros.set(centroNome, (mapaCentros.get(centroNome) || 0) + valor)
      }
    }

    const totalDespesas = Array.from(mapaCentros.values()).reduce((a, b) => a + b, 0)
    const lista = Array.from(mapaCentros.entries())
      .map(([centro, valor]) => ({
        centro,
        valor,
        participacao: totalDespesas > 0 ? (valor / totalDespesas) * 100 : 0,
      }))
      .sort((a, b) => b.valor - a.valor)

    return { total: totalDespesas, itens: lista }
  }, [lancamentos, planoContas, meses])

  const periodoDescricao = useMemo(() => {
    if (meses.length === 0) return ''
    return `${meses[0].rotuloCurto} a ${meses[meses.length - 1].rotuloCurto}`
  }, [meses])

  const handleExportarExcel = () => {
    const payload: DadosExportacaoDashboardBi = {
      periodoRotulo: `${periodoDescricao} (Ano ${anoInicial})`,
      kpis: {
        faturamento: analiseRentabilidade.faturamentoTotal,
        lucroApurado: analiseRentabilidade.lucroTotal,
        margemLiquida: analiseRentabilidade.margemSobreFaturamentoTotal,
        despesasFixas: analiseRentabilidade.despesasFixasTotal,
        despesasVariaveis: analiseRentabilidade.despesasVariaveisTotal,
        despesasFinanceiras: analiseRentabilidade.despesasFinanceirasTotal,
        liquidezCorrente,
      },
      evolucaoMensal: dadosEvolucaoMensal.map((d) => ({
        mes: d.mesCompleto,
        faturamento: d.faturamento,
        despesasTotais: d.despesasTotais,
        lucroApurado: d.lucroApurado,
        margemLiquida: d.margemLiquida,
      })),
      centrosCusto: centrosDonut.itens,
    }
    exportarDashboardBiExcel(payload, selectedEmpresa, anoInicial)
    toast({
      title: 'Planilha exportada com sucesso',
      description: 'O relatório executivo em Excel foi gerado.',
    })
  }

  const handleExportarCsv = () => {
    const payload: DadosExportacaoDashboardBi = {
      periodoRotulo: `${periodoDescricao} (Ano ${anoInicial})`,
      kpis: {
        faturamento: analiseRentabilidade.faturamentoTotal,
        lucroApurado: analiseRentabilidade.lucroTotal,
        margemLiquida: analiseRentabilidade.margemSobreFaturamentoTotal,
        despesasFixas: analiseRentabilidade.despesasFixasTotal,
        despesasVariaveis: analiseRentabilidade.despesasVariaveisTotal,
        despesasFinanceiras: analiseRentabilidade.despesasFinanceirasTotal,
        liquidezCorrente,
      },
      evolucaoMensal: dadosEvolucaoMensal.map((d) => ({
        mes: d.mesCompleto,
        faturamento: d.faturamento,
        despesasTotais: d.despesasTotais,
        lucroApurado: d.lucroApurado,
        margemLiquida: d.margemLiquida,
      })),
      centrosCusto: centrosDonut.itens,
    }
    exportarDashboardBiCsv(payload, selectedEmpresa, anoInicial)
    toast({
      title: 'Arquivo CSV gerado',
      description: 'O arquivo de dados do BI foi baixado.',
    })
  }

  const handleImprimir = () => {
    window.print()
  }

  const cardChartClass =
    'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm rounded-xl print:break-inside-avoid'

  return (
    <div className="space-y-5 pb-10 animate-fadeIn print:p-0 print:m-0 print:bg-white print:text-black">
      {/* Banner Superior Executivo Borlim */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#0B1F3A] via-[#0E284E] to-[#143A6E] border border-blue-900/40 p-5 sm:p-6 text-white shadow-lg shadow-slate-900/10 print:hidden">
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />

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
              <Badge className="bg-cyan-500/15 text-cyan-200 border-cyan-400/30 text-xs font-semibold px-2.5 py-0.5 backdrop-blur-md">
                <Sparkles className="w-3 h-3 mr-1 text-cyan-300" />
                Dashboard BI Interativo Gerencial
              </Badge>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2.5">
              <span>Painel Executivo &amp; BI Interativo</span>
            </h1>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Consolidação analítica de faturamento, lucros, custos fixos e variáveis, liquidez e
              composição por centros de custo. Cálculos integrados com o motor oficial da DRE.
            </p>
          </div>

          {/* Controles de Período e Exportação */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0 bg-white/5 border border-white/15 p-3 rounded-xl backdrop-blur-md">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-cyan-300" />
              <Select
                value={String(anoInicial)}
                onValueChange={(val) => setAnoInicial(Number(val))}
              >
                <SelectTrigger className="h-8 w-24 bg-white/10 border-white/20 text-xs text-white">
                  <SelectValue placeholder="Ano" />
                </SelectTrigger>
                <SelectContent className="bg-[#0B1F3A] border-slate-700 text-white">
                  {(anosDisponiveis || [anoInicial, anoInicial - 1]).map((ano) => (
                    <SelectItem key={ano} value={String(ano)} className="text-xs">
                      {ano}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={String(qtdMeses)} onValueChange={(val) => setQtdMeses(Number(val))}>
                <SelectTrigger className="h-8 w-28 bg-white/10 border-white/20 text-xs text-white">
                  <SelectValue placeholder="Janela" />
                </SelectTrigger>
                <SelectContent className="bg-[#0B1F3A] border-slate-700 text-white">
                  <SelectItem value="3" className="text-xs">
                    3 Meses
                  </SelectItem>
                  <SelectItem value="6" className="text-xs">
                    6 Meses
                  </SelectItem>
                  <SelectItem value="12" className="text-xs">
                    12 Meses
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-1.5 border-t sm:border-t-0 sm:border-l border-white/15 pt-2 sm:pt-0 sm:pl-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleExportarExcel}
                className="h-8 px-2.5 text-xs bg-emerald-600/15 hover:bg-emerald-600/25 text-emerald-200 border-emerald-400/30 gap-1.5 cursor-pointer"
                title="Exportar Excel"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">Excel</span>
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={handleExportarCsv}
                className="h-8 px-2.5 text-xs bg-cyan-600/15 hover:bg-cyan-600/25 text-cyan-200 border-cyan-400/30 gap-1.5 cursor-pointer"
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
          </div>
        </div>
      </div>

      {/* Banner Identificador de Impressão A4 (Fundo Branco Padrão Borlim) */}
      <div className="hidden print:block mb-6 border-b-2 border-slate-900 pb-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-slate-900 uppercase tracking-tight">
              Dashboard BI Interativo — Relatório Gerencial
            </h1>
            <p className="text-xs text-slate-600 mt-0.5">
              Empresa: <strong>{nomeEntidade}</strong> | Período:{' '}
              <strong>
                {periodoDescricao} ({anoInicial})
              </strong>
            </p>
          </div>
          <BorlimLogo size="sm" variant="dark" />
        </div>
      </div>

      {/* Grid de KPIs Consolidados */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {loading ? (
          Array.from({ length: 7 }).map((_, i) => <KpiCardBiSkeleton key={`kpi-sk-${i}`} />)
        ) : (
          <>
            <KpiCardBi
              label="Faturamento"
              valor={formatBrl(analiseRentabilidade.faturamentoTotal)}
              apoio="Receita DRE"
              icon={DollarSign}
              accent="text-sky-700 dark:text-sky-400"
              accentBar="bg-sky-600"
            />
            <KpiCardBi
              label="Lucro Apurado"
              valor={formatBrl(analiseRentabilidade.lucroTotal)}
              apoio="Resultado Líquido"
              icon={TrendingUp}
              accent={
                analiseRentabilidade.lucroTotal >= 0
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : 'text-rose-700 dark:text-rose-400'
              }
              accentBar={analiseRentabilidade.lucroTotal >= 0 ? 'bg-emerald-600' : 'bg-rose-600'}
            />
            <KpiCardBi
              label="Margem Líquida"
              valor={formatPercent(analiseRentabilidade.margemSobreFaturamentoTotal)}
              apoio="s/ Faturamento"
              icon={Percent}
              accent="text-sky-700 dark:text-sky-400"
              accentBar="bg-sky-500"
            />
            <KpiCardBi
              label="Despesas Fixas"
              valor={formatBrl(analiseRentabilidade.despesasFixasTotal)}
              apoio="Estrutura fixa"
              icon={Percent}
              accent="text-slate-700 dark:text-slate-300"
              accentBar="bg-slate-400"
            />
            <KpiCardBi
              label="Desp. Variáveis"
              valor={formatBrl(analiseRentabilidade.despesasVariaveisTotal)}
              apoio="Comerciais / Venda"
              icon={Percent}
              accent="text-amber-700 dark:text-amber-400"
              accentBar="bg-amber-500"
            />
            <KpiCardBi
              label="Desp. Financeiras"
              valor={formatBrl(analiseRentabilidade.despesasFinanceirasTotal)}
              apoio="Juros & Encargos"
              icon={Percent}
              accent="text-violet-700 dark:text-violet-400"
              accentBar="bg-violet-500"
            />
            <KpiCardBi
              label="Liquidez Corrente"
              valor={liquidezCorrente !== null ? `${liquidezCorrente.toFixed(2)}x` : '—'}
              apoio={
                liquidezCorrente !== null
                  ? 'AC / PC (Balanço)'
                  : 'Sem balanço cadastrado p/ exercício'
              }
              icon={Scale}
              accent="text-teal-700 dark:text-teal-400"
              accentBar="bg-teal-600"
              semDado={liquidezCorrente === null}
              className="col-span-2 md:col-span-1"
            />
          </>
        )}
      </div>

      {/* Gráfico 1: Evolução Mensal Faturamento vs Despesas e Lucro Apurado */}
      <Card className={cardChartClass}>
        <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-sky-600" />
                Evolução Mensal — Faturamento vs. Despesas e Lucro Líquido
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 mt-0.5">
                Comparativo mensal contínuo entre entradas brutas, custos operacionais totais e
                margem líquida
              </CardDescription>
            </div>
            <Badge
              variant="outline"
              className="hidden sm:inline-flex text-[10px] text-slate-500 border-slate-200 bg-slate-50"
            >
              {periodoDescricao} · {anoInicial}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-5">
          {loading ? (
            <div className="h-[320px] w-full flex items-center justify-center">
              <SkeletonGraficoBi />
            </div>
          ) : !temMovimentoMensal ? (
            <div className="h-[320px] w-full">
              <EstadoVazioGraficoBi
                icon={BarChart3}
                titulo="Sem movimento no período"
                descricao={`Não há lançamentos de faturamento ou despesas em ${periodoDescricao || 'a janela selecionada'} (${anoInicial}). Importe o balancete ou registre lançamentos na DRE para visualizar a evolução mensal.`}
              />
            </div>
          ) : (
            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={dadosEvolucaoMensal}
                  margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
                >
                  <CartesianGrid {...gridPropsBI} />
                  <XAxis
                    dataKey="mes"
                    tick={tickPropsBI}
                    tickLine={false}
                    axisLine={{ stroke: PALETA_BI.grid }}
                  />
                  <YAxis
                    yAxisId="left"
                    tick={tickPropsBI}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => `R$ ${(val / 1000).toFixed(0)}k`}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={tickPropsBI}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => `${val}%`}
                    domain={[-20, 80]}
                  />
                  <RechartsTooltip
                    formatter={(val: any, name: string) => {
                      if (name.includes('Margem')) return [`${Number(val).toFixed(2)}%`, name]
                      return [formatBrl(Number(val)), name]
                    }}
                    contentStyle={tooltipStyleBI}
                    labelStyle={tooltipLabelStyleBI}
                    cursor={{ fill: 'rgba(11, 31, 58, 0.05)' }}
                  />
                  <Legend wrapperStyle={legendStyleBI} iconSize={10} />
                  <Bar
                    yAxisId="left"
                    dataKey="faturamento"
                    name="Faturamento (Receita)"
                    fill={PALETA_BI.azulAcao}
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    yAxisId="left"
                    dataKey="despesasTotais"
                    name="Despesas Totais"
                    fill={PALETA_BI.vermelho}
                    radius={[4, 4, 0, 0]}
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="lucroApurado"
                    name="Lucro Apurado (R$)"
                    stroke={PALETA_BI.verde}
                    strokeWidth={3}
                    dot={{ r: 4, fill: PALETA_BI.verde }}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="margemLiquida"
                    name="Margem Líquida (%)"
                    stroke={PALETA_BI.celeste}
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={{ r: 3, fill: PALETA_BI.celeste }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Grid Inferior: Donut Centros de Custo + Evolução das Margens */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
        {/* Composição de Despesas por Centro de Custo */}
        <Card className={cardChartClass}>
          <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
            <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <PieIcon className="w-4 h-4 text-teal-600" />
              Composição de Despesas por Centro de Custo
            </CardTitle>
            <CardDescription className="text-xs text-slate-500 mt-0.5">
              Alocação dos gastos operacionais acumulados na janela do período
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 flex flex-col md:flex-row items-center justify-between gap-4">
            {loading ? (
              <div className="h-[240px] w-full flex items-center justify-center">
                <SkeletonGraficoBi donut />
              </div>
            ) : centrosDonut.itens.length === 0 ? (
              <div className="h-[240px] w-full">
                <EstadoVazioGraficoBi
                  icon={PieIcon}
                  titulo="Sem despesas por centro de custo"
                  descricao={`Nenhum lançamento de débito com centro de custo vinculado em ${periodoDescricao || 'a janela selecionada'}. Vincule centros de custo no plano de contas para acompanhar a composição dos gastos.`}
                />
              </div>
            ) : (
              <>
                <div className="h-[240px] w-full md:w-1/2">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={centrosDonut.itens}
                        dataKey="valor"
                        nameKey="centro"
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={3}
                      >
                        {centrosDonut.itens.map((_, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={CORES_DONUT_BI[index % CORES_DONUT_BI.length]}
                          />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        formatter={(val: any) => [formatBrl(Number(val)), 'Gasto Acumulado']}
                        contentStyle={tooltipStyleBI}
                        labelStyle={tooltipLabelStyleBI}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="w-full md:w-1/2 space-y-2 max-h-[240px] overflow-y-auto pr-2">
                  {centrosDonut.itens.map((c, i) => (
                    <div key={c.centro} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className="w-2.5 h-2.5 rounded-full shrink-0 ring-1 ring-black/5"
                          style={{ backgroundColor: CORES_DONUT_BI[i % CORES_DONUT_BI.length] }}
                        />
                        <span
                          className="truncate font-medium text-slate-700 dark:text-slate-300"
                          title={c.centro}
                        >
                          {c.centro}
                        </span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                          {formatBrl(c.valor)}
                        </span>
                        <span className="text-[10px] text-slate-400 ml-1.5 tabular-nums">
                          ({c.participacao.toFixed(1)}%)
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Evolução das Margens (Bruta, Operacional e Líquida) */}
        <Card className={cardChartClass}>
          <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
            <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Percent className="w-4 h-4 text-violet-600" />
              Evolução das Margens de Rentabilidade (%)
            </CardTitle>
            <CardDescription className="text-xs text-slate-500 mt-0.5">
              Margem Bruta (após variáveis), Operacional (após fixas) e Líquida final
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-5">
            {loading ? (
              <div className="h-[240px] w-full flex items-center justify-center">
                <SkeletonGraficoBi />
              </div>
            ) : !temMovimentoMensal ? (
              <div className="h-[240px] w-full">
                <EstadoVazioGraficoBi
                  icon={Percent}
                  titulo="Sem margens no período"
                  descricao={`Sem faturamento ou despesas registrados em ${periodoDescricao || 'a janela selecionada'} (${anoInicial}). As curvas de margem aparecem assim que houver lançamentos na DRE.`}
                />
              </div>
            ) : (
              <div className="h-[240px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={dadosEvolucaoMensal}
                    margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
                  >
                    <CartesianGrid {...gridPropsBI} />
                    <XAxis
                      dataKey="mes"
                      tick={tickPropsBI}
                      tickLine={false}
                      axisLine={{ stroke: PALETA_BI.grid }}
                    />
                    <YAxis
                      tick={tickPropsBI}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(val) => `${val}%`}
                      domain={[-10, 100]}
                    />
                    <RechartsTooltip
                      formatter={(val: any, name: string) => [`${Number(val).toFixed(2)}%`, name]}
                      contentStyle={tooltipStyleBI}
                      labelStyle={tooltipLabelStyleBI}
                    />
                    <Legend wrapperStyle={{ ...legendStyleBI, paddingTop: '6px' }} iconSize={10} />
                    <Line
                      type="monotone"
                      dataKey="margemBruta"
                      name="Margem Bruta (%)"
                      stroke={PALETA_BI.verde}
                      strokeWidth={2.5}
                      dot={{ r: 3 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="margemOperacional"
                      name="Margem Operacional (%)"
                      stroke={PALETA_BI.azulAcao}
                      strokeWidth={2.5}
                      dot={{ r: 3 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="margemLiquida"
                      name="Margem Líquida (%)"
                      stroke={PALETA_BI.celeste}
                      strokeWidth={2.5}
                      strokeDasharray="3 3"
                      dot={{ r: 3 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <DocumentPrintFooter />
    </div>
  )
}

// formatadores locais (mesmo padrão da tela do cliente)
function formatBrl(val: number | undefined | null): string {
  if (val === undefined || val === null || !Number.isFinite(val)) return 'R$ 0,00'
  return val.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function formatPercent(val: number | null | undefined, casas = 2): string {
  if (val === null || val === undefined || !Number.isFinite(val)) return '—'
  return `${val >= 0 ? '+' : ''}${val.toFixed(casas)}%`
}

/** Esqueleto genérico de gráfico (barras ou donut) */
function SkeletonGraficoBi({ donut = false }: { donut?: boolean }) {
  if (donut) {
    return (
      <div className="flex items-center gap-6 w-full justify-center">
        <div className="w-40 h-40 rounded-full border-[14px] border-slate-100 dark:border-slate-800" />
        <div className="space-y-2.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-3 rounded bg-slate-100 dark:bg-slate-800"
              style={{ width: 120 - i * 14 }}
            />
          ))}
        </div>
      </div>
    )
  }
  return (
    <div className="flex items-end gap-2 sm:gap-3 h-3/4 w-full px-6">
      {[55, 75, 45, 85, 65, 95, 50, 70, 60, 80, 40, 90].map((h, i) => (
        <div
          key={i}
          className="flex-1 rounded-t bg-slate-100 dark:bg-slate-800 animate-pulse"
          style={{ height: `${h}%`, animationDelay: `${i * 80}ms` }}
        />
      ))}
    </div>
  )
}
