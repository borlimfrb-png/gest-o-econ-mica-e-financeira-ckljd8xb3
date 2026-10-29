import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
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
  TrendingUp,
  Percent,
  ArrowLeft,
  Calendar,
  Sparkles,
  PieChart as PieIcon,
  Printer,
} from 'lucide-react'

const CORES_DONUT = [
  '#0284C7',
  '#10B981',
  '#F59E0B',
  '#6366F1',
  '#EC4899',
  '#8B5CF6',
  '#14B8A6',
  '#F97316',
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

function formatPercent(val: number | null | undefined, casas = 2): string {
  if (val === null || val === undefined || !Number.isFinite(val)) return '—'
  return `${val >= 0 ? '+' : ''}${val.toFixed(casas)}%`
}

export default function ClienteDashboardBi() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { user } = useAuth()
  const { selectedEmpresaId, selectedEmpresa, selectedAno, empresasIdsAtivas, anosDisponiveis } =
    useFilter()

  const [loading, setLoading] = useState(true)
  const [lancamentos, setLancamentos] = useState<LancamentoRecord[]>([])
  const [contas, setContas] = useState<ContaRecord[]>([])
  const [planoContas, setPlanoContas] = useState<PlanoContaRecord[]>([])
  const [balanco, setBalanco] = useState<BalancoRecord | null>(null)

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
      : selectedEmpresa?.id || (empresasIdsAtivas.length > 0 ? empresasIdsAtivas[0] : null)

  const nomeEntidade = selectedEmpresa?.nome || selectedEmpresa?.nome_fantasia || 'Minha Empresa'

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
      console.error('Erro ao carregar dados do Dashboard BI Cliente:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar dados',
        description: 'Não foi possível carregar as informações do BI da empresa.',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarDados()
  }, [empresaIdAlvo, anoInicial])

  useRealtime('lancamentos', () => carregarDados())
  useRealtime('contas', () => carregarDados())
  useRealtime('plano_contas', () => carregarDados())
  useRealtime('balancos', () => carregarDados())

  const meses = useMemo(() => {
    return gerarListaMeses(anoInicial, mesInicial, qtdMeses)
  }, [anoInicial, mesInicial, qtdMeses])

  const analiseRentabilidade = useMemo<AnaliseRentabilidadeResultado>(() => {
    return calcularAnaliseRentabilidade(lancamentos, contas, meses, planoContas)
  }, [lancamentos, contas, meses, planoContas])

  const liquidezCorrente = useMemo<number | null>(() => {
    if (!balanco) return null
    const b = calcularBalanco(balanco)
    return b.passivoCirculante > 0 ? b.ativoCirculante / b.passivoCirculante : null
  }, [balanco])

  const dadosEvolucaoMensal = useMemo(() => {
    return analiseRentabilidade.itensPorMes.map((item) => {
      const despesasTotais = item.despesasVariaveis + item.despesasFixas + item.despesasFinanceiras
      return {
        mes: item.rotuloCurto,
        mesCompleto: item.rotuloCompleto,
        faturamento: item.faturamento,
        despesasTotais,
        lucroApurado: item.lucroApurado,
        margemLiquida: item.margemSobreFaturamento,
        margemBruta: item.margemBruta,
        margemOperacional: item.margemOperacional,
      }
    })
  }, [analiseRentabilidade])

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
      const centroNome = p?.expand?.centro?.nome || 'Geral / Operação'
      const valor = Number(l.valor) || 0

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

  return (
    <div className="space-y-6 pb-10 animate-fadeIn print:p-0 print:m-0 print:bg-white print:text-black">
      {/* Banner Superior Executivo Borlim */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#0B1F3A] via-[#0E284E] to-[#143A6E] border border-blue-900/40 p-6 sm:p-7 text-white shadow-xl shadow-slate-900/10 print:hidden">
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
              <Badge className="bg-cyan-500/20 text-cyan-200 border-cyan-400/30 text-xs font-semibold px-2.5 py-0.5 backdrop-blur-md">
                <Sparkles className="w-3 h-3 mr-1 text-cyan-300" />
                Dashboard BI Interativo — Visão Cliente
              </Badge>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2.5">
              <span>{nomeEntidade}</span>
            </h1>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Painel executivo interativo em modo somente leitura com faturamento, lucro apurado,
              margens e custos consolidados.
            </p>
          </div>

          {/* Filtro simples de Exercício */}
          <div className="flex items-center gap-2.5 shrink-0 bg-white/5 border border-white/15 p-3 rounded-2xl backdrop-blur-md">
            <Calendar className="w-4 h-4 text-cyan-300" />
            <Select value={String(anoInicial)} onValueChange={(val) => setAnoInicial(Number(val))}>
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

            <Button
              size="sm"
              variant="outline"
              onClick={() => window.print()}
              className="h-8 px-2.5 text-xs bg-white/10 hover:bg-white/20 text-white border-white/20 gap-1.5 cursor-pointer ml-1"
              title="Imprimir Relatório"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Imprimir</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Grid de KPIs Consolidados */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3.5">
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
          <CardContent className="p-4">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Faturamento
            </span>
            <div className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-slate-100 mt-1">
              {formatBrl(analiseRentabilidade.faturamentoTotal)}
            </div>
            <span className="text-[10px] text-slate-500 mt-0.5 block">Receita DRE</span>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
          <CardContent className="p-4">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Lucro Apurado
            </span>
            <div
              className={`text-base sm:text-lg font-extrabold mt-1 ${
                analiseRentabilidade.lucroTotal >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {formatBrl(analiseRentabilidade.lucroTotal)}
            </div>
            <span className="text-[10px] text-slate-500 mt-0.5 block">Resultado Líquido</span>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
          <CardContent className="p-4">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Margem Líquida
            </span>
            <div className="text-base sm:text-lg font-extrabold text-sky-600 dark:text-sky-400 mt-1">
              {formatPercent(analiseRentabilidade.margemSobreFaturamentoTotal)}
            </div>
            <span className="text-[10px] text-slate-500 mt-0.5 block">s/ Faturamento</span>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
          <CardContent className="p-4">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Despesas Fixas
            </span>
            <div className="text-base sm:text-lg font-extrabold text-slate-800 dark:text-slate-200 mt-1">
              {formatBrl(analiseRentabilidade.despesasFixasTotal)}
            </div>
            <span className="text-[10px] text-slate-500 mt-0.5 block">Estrutura fixa</span>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
          <CardContent className="p-4">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Desp. Variáveis
            </span>
            <div className="text-base sm:text-lg font-extrabold text-amber-600 dark:text-amber-400 mt-1">
              {formatBrl(analiseRentabilidade.despesasVariaveisTotal)}
            </div>
            <span className="text-[10px] text-slate-500 mt-0.5 block">Comerciais / Venda</span>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
          <CardContent className="p-4">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Desp. Financeiras
            </span>
            <div className="text-base sm:text-lg font-extrabold text-purple-600 dark:text-purple-400 mt-1">
              {formatBrl(analiseRentabilidade.despesasFinanceirasTotal)}
            </div>
            <span className="text-[10px] text-slate-500 mt-0.5 block">Juros & Encargos</span>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm col-span-2 md:col-span-1">
          <CardContent className="p-4">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Liquidez Corrente
            </span>
            <div className="text-base sm:text-lg font-extrabold text-teal-600 dark:text-teal-400 mt-1">
              {liquidezCorrente !== null ? `${liquidezCorrente.toFixed(2)}x` : '—'}
            </div>
            <span className="text-[10px] text-slate-500 mt-0.5 block">
              {liquidezCorrente !== null ? 'AC / PC (Balanço)' : 'Sem balanço'}
            </span>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico 1: Evolução Mensal Faturamento vs Despesas e Lucro Apurado */}
      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm print:break-inside-avoid">
        <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
          <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-sky-500" />
            Evolução Mensal — Faturamento vs. Despesas e Lucro Líquido
          </CardTitle>
          <CardDescription className="text-xs text-slate-500 mt-0.5">
            Acompanhamento mensal da receita, despesas operacionais totais e margem líquida gerada
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-5">
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={dadosEvolucaoMensal}
                margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(val) => `R$ ${(val / 1000).toFixed(0)}k`}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(val) => `${val}%`}
                  domain={[-20, 80]}
                />
                <RechartsTooltip
                  formatter={(val: any, name: string) => {
                    if (name.includes('Margem')) return [`${Number(val).toFixed(2)}%`, name]
                    return [formatBrl(Number(val)), name]
                  }}
                  contentStyle={{
                    backgroundColor: '#0B1F3A',
                    borderColor: '#334155',
                    color: '#fff',
                    borderRadius: '8px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Bar
                  yAxisId="left"
                  dataKey="faturamento"
                  name="Faturamento (Receita)"
                  fill="#0284C7"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  yAxisId="left"
                  dataKey="despesasTotais"
                  name="Despesas Totais"
                  fill="#EF4444"
                  radius={[4, 4, 0, 0]}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="lucroApurado"
                  name="Lucro Apurado (R$)"
                  stroke="#10B981"
                  strokeWidth={3}
                  dot={{ r: 4, fill: '#10B981' }}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="margemLiquida"
                  name="Margem Líquida (%)"
                  stroke="#F59E0B"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={{ r: 3, fill: '#F59E0B' }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Grid Inferior: Donut Centros de Custo + Evolução das Margens */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm print:break-inside-avoid">
          <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
            <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <PieIcon className="w-4 h-4 text-emerald-500" />
              Composição de Despesas por Centro de Custo
            </CardTitle>
            <CardDescription className="text-xs text-slate-500 mt-0.5">
              Participação de cada área ou centro no total de gastos do exercício
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 flex flex-col md:flex-row items-center justify-between gap-4">
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
                      <Cell key={`cell-${index}`} fill={CORES_DONUT[index % CORES_DONUT.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    formatter={(val: any) => [formatBrl(Number(val)), 'Gasto Total']}
                    contentStyle={{
                      backgroundColor: '#0B1F3A',
                      borderColor: '#334155',
                      color: '#fff',
                      borderRadius: '8px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="w-full md:w-1/2 space-y-2 max-h-[240px] overflow-y-auto pr-2">
              {centrosDonut.itens.length === 0 ? (
                <p className="text-xs text-slate-400">
                  Nenhuma despesa por centro de custo no período.
                </p>
              ) : (
                centrosDonut.itens.map((c, i) => (
                  <div key={c.centro} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: CORES_DONUT[i % CORES_DONUT.length] }}
                      />
                      <span
                        className="truncate font-medium text-slate-700 dark:text-slate-300"
                        title={c.centro}
                      >
                        {c.centro}
                      </span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-bold text-slate-900 dark:text-slate-100">
                        {formatBrl(c.valor)}
                      </span>
                      <span className="text-[10px] text-slate-400 ml-1.5">
                        ({c.participacao.toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm print:break-inside-avoid">
          <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
            <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Percent className="w-4 h-4 text-purple-500" />
              Evolução das Margens de Rentabilidade (%)
            </CardTitle>
            <CardDescription className="text-xs text-slate-500 mt-0.5">
              Curvas de rentabilidade mensal: Margem Bruta, Margem Operacional e Margem Líquida
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-5">
            <div className="h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={dadosEvolucaoMensal}
                  margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
                  <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickFormatter={(val) => `${val}%`}
                    domain={[-10, 100]}
                  />
                  <RechartsTooltip
                    formatter={(val: any, name: string) => [`${Number(val).toFixed(2)}%`, name]}
                    contentStyle={{
                      backgroundColor: '#0B1F3A',
                      borderColor: '#334155',
                      color: '#fff',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }} />
                  <Line
                    type="monotone"
                    dataKey="margemBruta"
                    name="Margem Bruta (%)"
                    stroke="#10B981"
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="margemOperacional"
                    name="Margem Operacional (%)"
                    stroke="#0284C7"
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="margemLiquida"
                    name="Margem Líquida (%)"
                    stroke="#EC4899"
                    strokeWidth={2.5}
                    strokeDasharray="3 3"
                    dot={{ r: 3 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <DocumentPrintFooter />
    </div>
  )
}
