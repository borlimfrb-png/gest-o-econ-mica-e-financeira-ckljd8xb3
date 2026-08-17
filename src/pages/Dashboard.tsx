import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useFilter } from '@/contexts/FilterContext'
import {
  balancosService,
  centrosService,
  dreService,
  lancamentosCentroService,
  tiposDespesaService,
} from '@/services/financeService'
import type {
  BalancoRecord,
  CentroRecord,
  DreRecord,
  LancamentoCentroRecord,
  TipoDespesaRecord,
} from '@/types/finance'
import {
  calcularBalanco,
  calcularDre,
  calcularIndicadores,
  formatBrlMil,
  formatNumber,
  formatPercent,
  formatCnpj,
} from '@/lib/financeCalculations'
import { useRealtime } from '@/hooks/use-realtime'
import { AnimatedCounter } from '@/components/AnimatedCounter'
import {
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  AreaChart,
  Area,
} from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Building2,
  DollarSign,
  PieChart as PieIcon,
  BarChart3,
  Scale,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  CalendarClock,
  Target,
} from 'lucide-react'

const CHART_COLORS = ['#2563EB', '#0EA5E9', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899']

export default function Dashboard() {
  const { empresas, selectedEmpresaId, selectedAno, selectedEmpresa, isLoadingEmpresas } =
    useFilter()

  const [balancos, setBalancos] = useState<BalancoRecord[]>([])
  const [dres, setDres] = useState<DreRecord[]>([])
  const [allBalancos, setAllBalancos] = useState<BalancoRecord[]>([])
  const [lancamentosCentro, setLancamentosCentro] = useState<LancamentoCentroRecord[]>([])
  const [tiposDespesa, setTiposDespesa] = useState<TipoDespesaRecord[]>([])
  const [centros, setCentros] = useState<CentroRecord[]>([])
  const [loadingData, setLoadingData] = useState<boolean>(true)

  const loadData = async () => {
    try {
      setLoadingData(true)
      const [allB, allD, allL, allTd, allC] = await Promise.all([
        balancosService.getAll(),
        dreService.getAll(),
        lancamentosCentroService.getAll(),
        tiposDespesaService.getAll(),
        centrosService.getAll(),
      ])
      setAllBalancos(allB)
      setDres(allD)
      setLancamentosCentro(allL)
      setTiposDespesa(allTd)
      setCentros(allC)

      if (selectedEmpresaId) {
        setBalancos(allB.filter((b) => b.empresa === selectedEmpresaId))
      }
    } catch (err) {
      console.error('Erro ao carregar dados do dashboard:', err)
    } finally {
      setLoadingData(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [selectedEmpresaId])

  useRealtime<BalancoRecord>('balancos', () => {
    loadData()
  })
  useRealtime<DreRecord>('dre', () => {
    loadData()
  })
  useRealtime<LancamentoCentroRecord>('lancamentos_centro', () => {
    loadData()
  })
  useRealtime<TipoDespesaRecord>('tipos_despesa', () => {
    loadData()
  })
  useRealtime<CentroRecord>('centros', () => {
    loadData()
  })

  // Distribuição de gastos por tipo de despesa (todos os lançamentos do usuário)
  const dataGastosPorTipo = useMemo(() => {
    const map = new Map<string, number>()
    for (const l of lancamentosCentro) {
      if (!l.tipo_despesa) continue
      const cur = map.get(l.tipo_despesa) || 0
      map.set(l.tipo_despesa, cur + (Number(l.valor) || 0))
    }
    const total = Array.from(map.values()).reduce((acc, v) => acc + v, 0)
    return {
      data: Array.from(map.entries())
        .map(([tipoId, value], idx) => ({
          name: tiposDespesa.find((t) => t.id === tipoId)?.nome || 'Sem tipo',
          value,
          color: CHART_COLORS[idx % CHART_COLORS.length],
        }))
        .filter((d) => d.value > 0)
        .sort((a, b) => b.value - a.value),
      total,
    }
  }, [lancamentosCentro, tiposDespesa])

  // Balanço e DRE do ano selecionado
  const balancoAtual = balancos.find((b) => b.ano === selectedAno)
  const dreAtual = dres.find((d) => d.empresa === selectedEmpresaId && d.ano === selectedAno)

  // Totais e Indicadores calculados
  const calcB = calcularBalanco(balancoAtual)
  const calcD = calcularDre(dreAtual)
  const calcInd = calcularIndicadores(balancoAtual, dreAtual)

  // Dados para Gráfico Composição do Ativo
  const dataComposicaoAtivo = [
    { name: 'Ativo Circulante', value: calcB.ativoCirculante, color: '#2563EB' },
    { name: 'Ativo Não Circulante', value: calcB.ativoNaoCirculante, color: '#0EA5E9' },
  ].filter((d) => d.value > 0)

  // Dados para Gráfico Composição Passivo + PL
  const dataComposicaoPassivoPL = [
    { name: 'Passivo Circulante', value: calcB.passivoCirculante, color: '#F59E0B' },
    { name: 'Passivo Não Circulante', value: calcB.passivoNaoCirculante, color: '#8B5CF6' },
    { name: 'Patrimônio Líquido', value: calcB.patrimonioLiquido, color: '#10B981' },
  ].filter((d) => d.value > 0)

  // Dados para Evolução do PL e Receita vs Lucro (últimos anos da empresa)
  const anosOrdenados = Array.from(new Set(balancos.map((b) => b.ano))).sort((a, b) => a - b)

  const dataEvolucaoPL = anosOrdenados.map((ano) => {
    const b = balancos.find((item) => item.ano === ano)
    const c = calcularBalanco(b)
    return {
      ano: String(ano),
      pl: c.patrimonioLiquido,
      ativo: c.ativoTotal,
    }
  })

  const dataEvolucaoReceitaLucro = anosOrdenados.map((ano) => {
    const d = dres.find((item) => item.empresa === selectedEmpresaId && item.ano === ano)
    const c = calcularDre(d)
    return {
      ano: String(ano),
      receitaLiquida: c.receitaLiquida,
      lucroLiquido: c.lucroLiquido,
    }
  })

  // ---------- ALERTAS INTELIGENTES ----------
  interface AlertaItem {
    id: string
    titulo: string
    descricao: string
    to: string
    severidade: 'amber' | 'red'
    icone: 'target' | 'calendar' | 'building' | 'liquidez'
  }

  const alertas = useMemo<AlertaItem[]>(() => {
    const lista: AlertaItem[] = []
    const agora = new Date()
    const anoCorrente = agora.getFullYear()
    const mesCorrente = agora.getMonth() // 0-11
    const diaDoMes = agora.getDate()
    const diasNoMes = new Date(anoCorrente, mesCorrente + 1, 0).getDate()
    const diasRestantesMes = diasNoMes - diaDoMes

    // 1. Centros de custo com menos de 50% da meta mensal atingida e faltando < 7 dias para o fim do mês
    if (diasRestantesMes < 7) {
      for (const c of centros) {
        const meta = c.meta_mensal ? Number(c.meta_mensal) || 0 : 0
        if (meta <= 0) continue
        const realizado = lancamentosCentro
          .filter((l) => {
            if (l.centro !== c.id || !l.data) return false
            const d = new Date(l.data + 'T00:00:00')
            return d.getMonth() === mesCorrente && d.getFullYear() === anoCorrente
          })
          .reduce((acc, l) => acc + (Number(l.valor) || 0), 0)
        const pct = meta > 0 ? (realizado / meta) * 100 : 0
        if (pct < 50) {
          lista.push({
            id: `meta-mensal-${c.id}`,
            titulo: `Meta mensal baixa: ${c.nome}`,
            descricao: `Atingiu ${pct.toFixed(0)}% da meta mensal e faltam apenas ${diasRestantesMes} dia(s) para o fim do mês.`,
            to: '/centros',
            severidade: 'amber',
            icone: 'target',
          })
        }
      }
    }

    // 2. Centros de custo com menos de 60% da meta anual e já passados 9+ meses do ano
    if (mesCorrente + 1 >= 9) {
      for (const c of centros) {
        const metaAnual = c.meta_anual ? Number(c.meta_anual) || 0 : 0
        if (metaAnual <= 0) continue
        const realizado = lancamentosCentro
          .filter((l) => {
            if (l.centro !== c.id || !l.data) return false
            const d = new Date(l.data + 'T00:00:00')
            return d.getFullYear() === anoCorrente
          })
          .reduce((acc, l) => acc + (Number(l.valor) || 0), 0)
        const pct = metaAnual > 0 ? (realizado / metaAnual) * 100 : 0
        if (pct < 60) {
          lista.push({
            id: `meta-anual-${c.id}`,
            titulo: `Meta anual em risco: ${c.nome}`,
            descricao: `Atingiu ${pct.toFixed(0)}% da meta anual com ${mesCorrente + 1} meses decorridos.`,
            to: '/centros',
            severidade: 'amber',
            icone: 'calendar',
          })
        }
      }
    }

    // 3. Empresas sem balanço lançado no ano corrente
    for (const emp of empresas) {
      const temBalancoAnoCorrente = allBalancos.some(
        (b) => b.empresa === emp.id && b.ano === anoCorrente,
      )
      if (!temBalancoAnoCorrente) {
        lista.push({
          id: `sem-balanco-${emp.id}`,
          titulo: `Sem balanço em ${anoCorrente}: ${emp.nome}`,
          descricao: `A empresa não possui balanço lançado para o exercício de ${anoCorrente}.`,
          to: `/empresas/${emp.id}`,
          severidade: 'amber',
          icone: 'building',
        })
      }
    }

    // 4. Liquidez Corrente < 0.8 (empresa/ano selecionados)
    if (calcInd.liquidezCorrente !== null && calcInd.liquidezCorrente < 0.8) {
      lista.push({
        id: 'liquidez-baixa',
        titulo: 'Liquidez Corrente crítica',
        descricao: `Índice de liquidez corrente de ${formatNumber(
          calcInd.liquidezCorrente,
          2,
        )} está abaixo de 0,8 — atenção à capacidade de pagamento de curto prazo.`,
        to: `/empresas/${selectedEmpresaId}`,
        severidade: 'red',
        icone: 'liquidez',
      })
    }

    return lista
  }, [lancamentosCentro, empresas, allBalancos, calcInd, selectedEmpresaId])

  const alertasVisiveis = alertas.slice(0, 4)

  // Lista de Últimos Balanços (todas as empresas ou empresa selecionada)
  const ultimosBalancosList = allBalancos.slice(0, 5).map((b) => {
    const emp = empresas.find((e) => e.id === b.empresa)
    const cb = calcularBalanco(b)
    const lc = cb.passivoCirculante > 0 ? cb.ativoCirculante / cb.passivoCirculante : null
    return {
      id: b.id,
      empresaId: b.empresa,
      empresaNome: emp?.nome || 'Empresa',
      segmento: emp?.segmento || 'Outros',
      cnpj: emp?.cnpj || '',
      ano: b.ano,
      ativoTotal: cb.ativoTotal,
      passivoTotal: cb.passivoTotal,
      pl: cb.patrimonioLiquido,
      liquidezCorrente: lc,
    }
  })

  if (isLoadingEmpresas || (loadingData && empresas.length === 0)) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-500 font-medium">Carregando painel de indicadores...</p>
        </div>
      </div>
    )
  }

  if (empresas.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center max-w-lg mx-auto mt-8 shadow-sm">
        <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Building2 className="w-7 h-7" />
        </div>
        <h3 className="text-lg font-bold text-[#0B1F3A]">Nenhuma empresa cadastrada</h3>
        <p className="text-xs text-slate-500 mt-2 mb-6">
          Cadastre sua primeira empresa cliente para iniciar o diagnóstico financeiro e balanços
          patrimoniais.
        </p>
        <Button asChild className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs">
          <Link to="/empresas">Cadastrar Primeira Empresa</Link>
        </Button>
      </div>
    )
  }

  const renderAlertIcon = (icone: AlertaItem['icone']) => {
    if (icone === 'target') return <Target className="w-4 h-4" />
    if (icone === 'calendar') return <CalendarClock className="w-4 h-4" />
    if (icone === 'building') return <Building2 className="w-4 h-4" />
    return <Scale className="w-4 h-4" />
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Seção de Alertas Inteligentes */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-500" />
            Alertas
            {alertas.length > 0 && (
              <Badge className="bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-50 text-[10px] font-semibold">
                {alertas.length}
              </Badge>
            )}
          </h2>
        </div>
        {alertas.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3 shadow-2xs">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#0B1F3A]">Nenhum alerta no momento</p>
              <p className="text-[11px] text-slate-500">
                Todos os indicadores estão dentro dos parâmetros esperados.
              </p>
            </div>
          </div>
        ) : (
          <div
            className={`grid gap-3 ${
              alertasVisiveis.length >= 4
                ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
                : `grid-cols-1 sm:grid-cols-2 lg:grid-cols-${alertasVisiveis.length}`
            }`}
          >
            {alertasVisiveis.map((a) => (
              <Link
                key={a.id}
                to={a.to}
                className={`bg-white border rounded-xl p-3.5 flex flex-col gap-2 shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all ${
                  a.severidade === 'red' ? 'border-red-200' : 'border-amber-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                      a.severidade === 'red'
                        ? 'bg-red-50 text-red-600'
                        : 'bg-amber-50 text-amber-600'
                    }`}
                  >
                    {renderAlertIcon(a.icone)}
                  </div>
                  <AlertTriangle
                    className={`w-3.5 h-3.5 ml-auto ${
                      a.severidade === 'red' ? 'text-red-500' : 'text-amber-500'
                    }`}
                  />
                </div>
                <p className="text-xs font-bold text-[#0B1F3A] leading-tight line-clamp-2">
                  {a.titulo}
                </p>
                <p className="text-[11px] text-slate-500 line-clamp-3">{a.descricao}</p>
              </Link>
            ))}
          </div>
        )}
        {alertas.length > 4 && (
          <p className="text-[11px] text-slate-400 mt-2 text-right">
            Mostrando 4 de {alertas.length} alertas.
          </p>
        )}
      </div>

      {/* Banner Empresa Selecionada */}
      {selectedEmpresa && (
        <div className="bg-white border border-slate-200/80 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-[#0B1F3A]">{selectedEmpresa.nome}</h2>
                <Badge
                  variant="secondary"
                  className="text-[11px] font-semibold bg-blue-50 text-blue-700 border-blue-200"
                >
                  {selectedEmpresa.segmento}
                </Badge>
              </div>
              <p className="text-xs text-[#5B6B7F]">
                CNPJ: {formatCnpj(selectedEmpresa.cnpj)} · Exercício de Referência:{' '}
                <span className="font-semibold text-slate-700">{selectedAno}</span>
              </p>
            </div>
          </div>

          <Button
            asChild
            size="sm"
            variant="outline"
            className="text-xs border-blue-200 hover:bg-blue-50 text-blue-700 self-start sm:self-auto font-medium"
          >
            <Link to={`/empresas/${selectedEmpresa.id}`}>
              Ver Análise Completa <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Link>
          </Button>
        </div>
      )}

      {/* Grid de KPIs - 2 colunas mobile, 4 colunas desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* Ativo Total */}
        <Card className="p-4 bg-white border-slate-200 shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Ativo Total
            </span>
            <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-bold text-[#0B1F3A] tracking-tight">
            <AnimatedCounter value={calcB.ativoTotal} formatter={(v) => formatBrlMil(v)} />
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Recursos sob gestão</p>
        </Card>

        {/* Passivo Total */}
        <Card className="p-4 bg-white border-slate-200 shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Passivo Total
            </span>
            <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">
              <Scale className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-bold text-[#0B1F3A] tracking-tight">
            <AnimatedCounter value={calcB.passivoTotal} formatter={(v) => formatBrlMil(v)} />
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Capital de terceiros</p>
        </Card>

        {/* Patrimônio Líquido */}
        <Card className="p-4 bg-white border-slate-200 shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Patrimônio Líquido
            </span>
            <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-bold text-[#0B1F3A] tracking-tight">
            <AnimatedCounter value={calcB.patrimonioLiquido} formatter={(v) => formatBrlMil(v)} />
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Capital próprio</p>
        </Card>

        {/* Liquidez Corrente */}
        <Card className="p-4 bg-white border-slate-200 shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Liquidez Corrente
            </span>
            <span
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                (calcInd.liquidezCorrente || 0) >= 1.0
                  ? 'bg-emerald-50 text-emerald-700'
                  : (calcInd.liquidezCorrente || 0) >= 0.8
                    ? 'bg-amber-50 text-amber-700'
                    : 'bg-red-50 text-red-700'
              }`}
            >
              AC / PC
            </span>
          </div>
          <div
            className={`mt-2 text-xl sm:text-2xl font-bold tracking-tight ${
              calcInd.liquidezCorrente === null
                ? 'text-slate-400'
                : calcInd.liquidezCorrente >= 1.0
                  ? 'text-emerald-600'
                  : calcInd.liquidezCorrente >= 0.8
                    ? 'text-amber-500'
                    : 'text-red-600'
            }`}
          >
            {calcInd.liquidezCorrente !== null ? (
              <AnimatedCounter
                value={calcInd.liquidezCorrente}
                formatter={(v) => formatNumber(v, 2)}
              />
            ) : (
              '—'
            )}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {calcInd.liquidezCorrente === null
              ? 'Sem dados'
              : calcInd.liquidezCorrente >= 1.0
                ? 'Capacidade adequada (≥1,0)'
                : calcInd.liquidezCorrente >= 0.8
                  ? 'Atenção moderada'
                  : 'Insuficiência (<0,8)'}
          </p>
        </Card>

        {/* ROE */}
        <Card className="p-4 bg-white border-slate-200 shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              ROE (Retorno PL)
            </span>
            <span className="text-[10px] font-bold text-slate-500">LL / PL</span>
          </div>
          <div
            className={`mt-2 text-xl sm:text-2xl font-bold tracking-tight ${
              calcInd.roe === null
                ? 'text-slate-400'
                : calcInd.roe >= 0
                  ? 'text-emerald-600'
                  : 'text-red-600'
            }`}
          >
            {calcInd.roe !== null ? (
              <AnimatedCounter value={calcInd.roe} formatter={(v) => formatPercent(v, 1)} />
            ) : (
              '—'
            )}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {calcInd.roe === null
              ? 'Sem dados'
              : calcInd.roe >= 10
                ? 'Gera valor (>10%)'
                : calcInd.roe >= 0
                  ? 'Rentável'
                  : 'Prejuízo patrimonial'}
          </p>
        </Card>

        {/* Margem Líquida */}
        <Card className="p-4 bg-white border-slate-200 shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Margem Líquida
            </span>
            <span className="text-[10px] font-bold text-slate-500">LL / RL</span>
          </div>
          <div
            className={`mt-2 text-xl sm:text-2xl font-bold tracking-tight ${
              calcInd.margemLiquida === null
                ? 'text-slate-400'
                : calcInd.margemLiquida >= 0
                  ? 'text-emerald-600'
                  : 'text-red-600'
            }`}
          >
            {calcInd.margemLiquida !== null ? (
              <AnimatedCounter
                value={calcInd.margemLiquida}
                formatter={(v) => formatPercent(v, 1)}
              />
            ) : (
              '—'
            )}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {calcInd.margemLiquida === null
              ? 'Sem dados'
              : calcInd.margemLiquida >= 0
                ? 'Margem positiva'
                : 'Alerta de prejuízo'}
          </p>
        </Card>
      </div>

      {/* Gráficos de Composição e Evolução */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Composição do Ativo (Donut) */}
        <Card className="bg-white border-slate-200 shadow-2xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-[#0B1F3A] flex items-center justify-between">
              <span>Composição do Ativo ({selectedAno})</span>
              <span className="text-xs font-normal text-slate-500">
                Total: {formatBrlMil(calcB.ativoTotal)}
              </span>
            </CardTitle>
            <CardDescription className="text-xs">
              Distribuição entre Ativo Circulante (Curto Prazo) e Não Circulante (Longo
              Prazo/Imobilizado)
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            {dataComposicaoAtivo.length > 0 ? (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={dataComposicaoAtivo}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {dataComposicaoAtivo.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      formatter={(val: any) => [formatBrlMil(Number(val)), 'Valor']}
                    />
                    <Legend
                      verticalAlign="bottom"
                      height={36}
                      formatter={(val, entry: any) => {
                        const total = calcB.ativoTotal || 1
                        const pct = ((entry.payload.value / total) * 100).toFixed(1)
                        return (
                          <span className="text-xs font-medium text-slate-700">
                            {val}: {formatBrlMil(entry.payload.value)} ({pct}%)
                          </span>
                        )
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-xs text-slate-400">
                Sem dados de balanço para {selectedAno}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Composição do Passivo + PL (Donut) */}
        <Card className="bg-white border-slate-200 shadow-2xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-[#0B1F3A] flex items-center justify-between">
              <span>Composição do Passivo + PL ({selectedAno})</span>
              <span className="text-xs font-normal text-slate-500">
                Total: {formatBrlMil(calcB.passivoEPL)}
              </span>
            </CardTitle>
            <CardDescription className="text-xs">
              Origem dos recursos: Passivo Circulante, Não Circulante e Patrimônio Líquido
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            {dataComposicaoPassivoPL.length > 0 ? (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={dataComposicaoPassivoPL}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {dataComposicaoPassivoPL.map((entry, index) => (
                        <Cell key={`cell-p-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      formatter={(val: any) => [formatBrlMil(Number(val)), 'Valor']}
                    />
                    <Legend
                      verticalAlign="bottom"
                      height={36}
                      formatter={(val, entry: any) => {
                        const total = calcB.passivoEPL || 1
                        const pct = ((entry.payload.value / total) * 100).toFixed(1)
                        return (
                          <span className="text-xs font-medium text-slate-700">
                            {val}: {formatBrlMil(entry.payload.value)} ({pct}%)
                          </span>
                        )
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-xs text-slate-400">
                Sem dados de passivo para {selectedAno}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Evolução do Patrimônio Líquido (Área) */}
        <Card className="bg-white border-slate-200 shadow-2xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-[#0B1F3A]">
              Evolução do Patrimônio Líquido vs Ativo
            </CardTitle>
            <CardDescription className="text-xs">
              Crescimento do capital próprio e base de ativos ao longo dos anos
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            {dataEvolucaoPL.length > 0 ? (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={dataEvolucaoPL}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="colorPL" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorAtivo" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563EB" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                    <XAxis dataKey="ano" tick={{ fontSize: 12, fill: '#64748B' }} />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#64748B' }}
                      tickFormatter={(v) => `R$ ${Math.round(v / 1000)}k`}
                    />
                    <RechartsTooltip formatter={(val: any) => [formatBrlMil(Number(val)), '']} />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="ativo"
                      name="Ativo Total"
                      stroke="#2563EB"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorAtivo)"
                    />
                    <Area
                      type="monotone"
                      dataKey="pl"
                      name="Patrimônio Líquido"
                      stroke="#10B981"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorPL)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-xs text-slate-400">
                Sem histórico de balanços
              </div>
            )}
          </CardContent>
        </Card>

        {/* Evolução Receita vs Lucro Líquido (Barras agrupadas) */}
        <Card className="bg-white border-slate-200 shadow-2xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-[#0B1F3A]">
              Evolução da Receita Líquida vs Lucro Líquido
            </CardTitle>
            <CardDescription className="text-xs">
              Desempenho operacional e conversão em lucro ao longo dos exercícios
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            {dataEvolucaoReceitaLucro.length > 0 ? (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={dataEvolucaoReceitaLucro}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                    <XAxis dataKey="ano" tick={{ fontSize: 12, fill: '#64748B' }} />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#64748B' }}
                      tickFormatter={(v) => `R$ ${Math.round(v / 1000)}k`}
                    />
                    <RechartsTooltip formatter={(val: any) => [formatBrlMil(Number(val)), '']} />
                    <Legend />
                    <Bar
                      dataKey="receitaLiquida"
                      name="Receita Líquida"
                      fill="#2563EB"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="lucroLiquido"
                      name="Lucro Líquido"
                      fill="#10B981"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-xs text-slate-400">
                Sem histórico de DRE
              </div>
            )}
          </CardContent>
        </Card>

        {/* Distribuição de Gastos por Tipo de Despesa (Donut) */}
        <Card className="bg-white border-slate-200 shadow-2xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-[#0B1F3A] flex items-center justify-between">
              <span className="flex items-center gap-2">
                <PieIcon className="w-4 h-4 text-blue-600" />
                Gastos por Tipo de Despesa
              </span>
              <span className="text-xs font-normal text-slate-500">
                Total: {formatBrlMil(dataGastosPorTipo.total)}
              </span>
            </CardTitle>
            <CardDescription className="text-xs">
              Distribuição dos lançamentos de centros de custo agrupados por tipo de despesa.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            {dataGastosPorTipo.data.length > 0 ? (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={dataGastosPorTipo.data}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {dataGastosPorTipo.data.map((entry, index) => (
                        <Cell key={`cell-g-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      formatter={(val: any) => [formatBrlMil(Number(val)), 'Valor']}
                    />
                    <Legend
                      verticalAlign="bottom"
                      height={36}
                      formatter={(val, entry: any) => {
                        const total = dataGastosPorTipo.total || 1
                        const pct = ((entry.payload.value / total) * 100).toFixed(1)
                        return (
                          <span className="text-xs font-medium text-slate-700">
                            {val}: {formatBrlMil(entry.payload.value)} ({pct}%)
                          </span>
                        )
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-xs text-slate-400">
                Nenhum lançamento registrado
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Últimos Balanços Lançados */}
      <Card className="bg-white border-slate-200 shadow-2xs">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-sm font-bold text-[#0B1F3A]">
              Últimos Balanços Cadastrados
            </CardTitle>
            <CardDescription className="text-xs">
              Resumo comparativo dos exercícios contábeis lançados
            </CardDescription>
          </div>
          <Button
            asChild
            size="sm"
            variant="ghost"
            className="text-xs text-blue-600 hover:text-blue-700 font-semibold"
          >
            <Link to="/empresas">
              Ver todas as empresas <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 font-semibold">
                  <th className="py-2.5 px-3">Empresa</th>
                  <th className="py-2.5 px-3">Ano</th>
                  <th className="py-2.5 px-3 text-right">Ativo Total</th>
                  <th className="py-2.5 px-3 text-right">Passivo Total</th>
                  <th className="py-2.5 px-3 text-right">Patrimônio Líquido</th>
                  <th className="py-2.5 px-3 text-center">Liquidez Corrente</th>
                  <th className="py-2.5 px-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ultimosBalancosList.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-3">
                      <div>
                        <span className="font-semibold text-slate-800 block">
                          {row.empresaNome}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {row.segmento} · {formatCnpj(row.cnpj)}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-3 font-semibold text-slate-700">{row.ano}</td>
                    <td className="py-3 px-3 text-right font-medium text-slate-700">
                      {formatBrlMil(row.ativoTotal)}
                    </td>
                    <td className="py-3 px-3 text-right font-medium text-slate-700">
                      {formatBrlMil(row.passivoTotal)}
                    </td>
                    <td className="py-3 px-3 text-right font-semibold text-emerald-700">
                      {formatBrlMil(row.pl)}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                          (row.liquidezCorrente || 0) >= 1.0
                            ? 'bg-emerald-50 text-emerald-700'
                            : (row.liquidezCorrente || 0) >= 0.8
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-red-50 text-red-700'
                        }`}
                      >
                        {formatNumber(row.liquidezCorrente, 2)}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <Button
                        asChild
                        size="sm"
                        variant="outline"
                        className="h-7 text-[11px] font-medium border-slate-200 hover:border-blue-300 hover:text-blue-700"
                      >
                        <Link to={`/empresas/${row.empresaId}`}>Ver Análise</Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
