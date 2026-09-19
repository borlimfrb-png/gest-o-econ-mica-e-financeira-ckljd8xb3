import React, { useState, useMemo, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Building2,
  TrendingUp,
  Percent,
  Activity,
  Layers,
  Scale,
  Search,
  ExternalLink,
  Info,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  HelpCircle,
  Briefcase,
  ChevronRight,
  Filter,
} from 'lucide-react'
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import {
  Tooltip as UiTooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  Cell,
} from 'recharts'
import { useFilter } from '@/contexts/FilterContext'
import { empresasService, balancosService, dreService } from '@/services/financeService'
import type { EmpresaRecord, BalancoRecord, DreRecord, SetorEmpresa } from '@/types/finance'
import { SETORES_PADRAO } from '@/types/finance'
import {
  BENCHMARKS_SETORIAIS,
  extrairIndicadoresCompletos,
  type BenchmarkSetorValores,
  type IndicadoresConsolidadosEmpresa,
} from '@/lib/benchmarks'
import {
  MULTIPLOS_SETORIAIS_PADRAO,
  type MultiploConfigSetor,
  calcularMultiplosMercado,
} from '@/lib/valuationMultiplos'
import { formatBrlMil, formatPercent } from '@/lib/financeCalculations'

interface ResumoEmpresaSetor {
  empresa: EmpresaRecord
  balanco: BalancoRecord | null
  dre: DreRecord | null
  indicadores: IndicadoresConsolidadosEmpresa | null
  ebitda: number
  evEbitdaImplied: number | null
  temDados: boolean
}

export default function SetoresMercado() {
  const { selectedAno } = useFilter()
  const [empresas, setEmpresas] = useState<EmpresaRecord[]>([])
  const [balancos, setBalancos] = useState<BalancoRecord[]>([])
  const [dres, setDres] = useState<DreRecord[]>([])
  const [loading, setLoading] = useState(true)

  // Setor ativo selecionado (default Serviços)
  const [setorSelecionado, setSetorSelecionado] = useState<SetorEmpresa>('Serviços')
  const [filtroPesquisa, setFiltroPesquisa] = useState('')
  const [tabAtiva, setTabAtiva] = useState<'visao_geral' | 'detalhes' | 'comparativo'>('detalhes')

  useEffect(() => {
    async function carregarDados() {
      try {
        setLoading(true)
        const [empList, bList, dList] = await Promise.all([
          empresasService.getAll(),
          balancosService.getAll(),
          dreService.getAll(),
        ])
        setEmpresas(empList)
        setBalancos(bList)
        setDres(dList)
      } catch (err) {
        console.error('Erro ao carregar dados setoriais:', err)
      } finally {
        setLoading(false)
      }
    }
    carregarDados()
  }, [])

  // Informações de mercado do setor selecionado
  const benchmarkSetor: BenchmarkSetorValores =
    BENCHMARKS_SETORIAIS[setorSelecionado] || BENCHMARKS_SETORIAIS['Outros']
  const multiplosSetor: MultiploConfigSetor =
    MULTIPLOS_SETORIAIS_PADRAO[setorSelecionado] || MULTIPLOS_SETORIAIS_PADRAO['Outros']

  // Empresas que pertencem ao setor selecionado
  const empresasDoSetor = useMemo(() => {
    return empresas.filter(
      (e) => (e.setor || '').trim().toLowerCase() === setorSelecionado.toLowerCase(),
    )
  }, [empresas, setorSelecionado])

  // Empresas que possuem o campo Setor preenchido no sistema
  const totalEmpresasComSetor = useMemo(() => {
    return empresas.filter((e) => !!e.setor).length
  }, [empresas])

  // Processa dados de cada empresa do setor no ano selecionado
  const dadosEmpresasDoSetor: ResumoEmpresaSetor[] = useMemo(() => {
    return empresasDoSetor.map((emp) => {
      // Pega o balanço e dre para o ano ativo (ou último disponível)
      const balancosEmp = balancos.filter((b) => b.empresa === emp.id)
      const dresEmp = dres.filter((d) => d.empresa === emp.id)

      let balancoAno = balancosEmp.find((b) => b.ano === selectedAno) || null
      let dreAno = dresEmp.find((d) => d.ano === selectedAno) || null

      if (!balancoAno && balancosEmp.length > 0) {
        // pega o mais recente
        const maxAno = Math.max(...balancosEmp.map((b) => b.ano))
        balancoAno = balancosEmp.find((b) => b.ano === maxAno) || null
      }
      if (!dreAno && dresEmp.length > 0) {
        const maxAno = Math.max(...dresEmp.map((d) => d.ano))
        dreAno = dresEmp.find((d) => d.ano === maxAno) || null
      }

      const temDados = !!(balancoAno || dreAno)
      let indicadores: IndicadoresConsolidadosEmpresa | null = null
      let ebitda = 0
      let evEbitdaImplied: number | null = null

      if (temDados) {
        indicadores = extrairIndicadoresCompletos(balancoAno, dreAno)
        ebitda = indicadores.ebitda
        if (ebitda > 0) {
          const resumoMult = calcularMultiplosMercado({
            balanco: balancoAno,
            dre: dreAno,
            segmento: setorSelecionado,
          })
          const itemEv = resumoMult.itens.find((it) => it.key === 'ev_ebitda')
          if (itemEv && itemEv.valorImplícitoEmpresa > 0) {
            evEbitdaImplied = itemEv.valorImplícitoEmpresa
          }
        }
      }

      return {
        empresa: emp,
        balanco: balancoAno,
        dre: dreAno,
        indicadores,
        ebitda,
        evEbitdaImplied,
        temDados,
      }
    })
  }, [empresasDoSetor, balancos, dres, selectedAno, setorSelecionado])

  // Médias apuradas das empresas do setor no tenant
  const mediasTenantSetor = useMemo(() => {
    const comDados = dadosEmpresasDoSetor.filter((d) => d.temDados && d.indicadores)
    if (comDados.length === 0) {
      return null
    }

    const calcMedia = (key: 'ml' | 'roe' | 'lc' | 'margemEbitda') => {
      const vals = comDados
        .map((d) => d.indicadores?.[key])
        .filter((v): v is number => v !== null && v !== undefined && !isNaN(v))
      if (vals.length === 0) return null
      return vals.reduce((a, b) => a + b, 0) / vals.length
    }

    return {
      totalComDados: comDados.length,
      margemLiquidaMedia: calcMedia('ml'),
      roeMedio: calcMedia('roe'),
      liquidezCorrenteMedia: calcMedia('lc'),
      margemEbitdaMedia: calcMedia('margemEbitda'),
    }
  }, [dadosEmpresasDoSetor])

  // Diagnóstico / parecer executivo curto
  const parecerSetor = useMemo(() => {
    if (!mediasTenantSetor) {
      return {
        titulo: 'Sem empresas com lançamentos no exercício',
        texto: `Não há balanços ou DREs apurados para empresas cadastradas no setor ${setorSelecionado} no ano ${selectedAno}.`,
        status: 'neutro' as const,
      }
    }

    const mlDelta =
      mediasTenantSetor.margemLiquidaMedia !== null
        ? mediasTenantSetor.margemLiquidaMedia - benchmarkSetor.margemLiquida
        : null
    const roeDelta =
      mediasTenantSetor.roeMedio !== null ? mediasTenantSetor.roeMedio - benchmarkSetor.roe : null
    const lcDelta =
      mediasTenantSetor.liquidezCorrenteMedia !== null
        ? mediasTenantSetor.liquidezCorrenteMedia - benchmarkSetor.liquidezCorrente
        : null

    let pontosPositivos = 0
    let pontosNegativos = 0

    if (mlDelta !== null) {
      if (mlDelta >= 1) pontosPositivos++
      else if (mlDelta <= -1) pontosNegativos++
    }
    if (roeDelta !== null) {
      if (roeDelta >= 2) pontosPositivos++
      else if (roeDelta <= -2) pontosNegativos++
    }
    if (lcDelta !== null) {
      if (lcDelta >= 0.15) pontosPositivos++
      else if (lcDelta <= -0.15) pontosNegativos++
    }

    if (pontosPositivos >= 2) {
      return {
        titulo: 'Empresas acima da média do mercado setorial',
        texto: `A carteira de empresas deste setor apresenta rentabilidade superior (Margem Líquida e ROE) e boa sustentação financeira comparada aos referenciais do mercado brasileiro para ${setorSelecionado}.`,
        status: 'positivo' as const,
      }
    } else if (pontosNegativos >= 2) {
      return {
        titulo: 'Empresas sob pressão em relação ao mercado',
        texto: `As métricas apuradas indicam margens ou liquidez inferiores à mediana de mercado em ${setorSelecionado}. Recomenda-se revisão da estrutura de custos e otimização do capital de giro.`,
        status: 'alerta' as const,
      }
    } else {
      return {
        titulo: 'Empresas em linha com os benchmarks de mercado',
        texto: `O desempenho consolidado das empresas no setor ${setorSelecionado} acompanha a média das empresas brasileiras no mesmo ramo, com indicadores de liquidez e rentabilidade equilibrados.`,
        status: 'neutro' as const,
      }
    }
  }, [mediasTenantSetor, benchmarkSetor, setorSelecionado, selectedAno])

  // Dados para o gráfico Recharts comparativo
  const dadosGraficoComparativo = useMemo(() => {
    return [
      {
        indicador: 'Margem Líquida (%)',
        mercado: benchmarkSetor.margemLiquida,
        empresasTenant: mediasTenantSetor?.margemLiquidaMedia
          ? Number(mediasTenantSetor.margemLiquidaMedia.toFixed(1))
          : 0,
      },
      {
        indicador: 'ROE (%)',
        mercado: benchmarkSetor.roe,
        empresasTenant: mediasTenantSetor?.roeMedio
          ? Number(mediasTenantSetor.roeMedio.toFixed(1))
          : 0,
      },
      {
        indicador: 'Margem EBITDA (%)',
        mercado: benchmarkSetor.margemEbitda,
        empresasTenant: mediasTenantSetor?.margemEbitdaMedia
          ? Number(mediasTenantSetor.margemEbitdaMedia.toFixed(1))
          : 0,
      },
      {
        indicador: 'Liquidez Corrente (x10)',
        mercado: Number((benchmarkSetor.liquidezCorrente * 10).toFixed(1)),
        empresasTenant: mediasTenantSetor?.liquidezCorrenteMedia
          ? Number((mediasTenantSetor.liquidezCorrenteMedia * 10).toFixed(1))
          : 0,
      },
    ]
  }, [benchmarkSetor, mediasTenantSetor])

  // Lista com contagem de empresas por setor para a visão geral
  const setoresComEstatisticas = useMemo(() => {
    return SETORES_PADRAO.map((setor) => {
      const bench = BENCHMARKS_SETORIAIS[setor] || BENCHMARKS_SETORIAIS['Outros']
      const mult = MULTIPLOS_SETORIAIS_PADRAO[setor] || MULTIPLOS_SETORIAIS_PADRAO['Outros']
      const count = empresas.filter(
        (e) => (e.setor || '').trim().toLowerCase() === setor.toLowerCase(),
      ).length
      return {
        setor,
        bench,
        mult,
        count,
      }
    }).filter((s) => {
      if (!filtroPesquisa.trim()) return true
      const q = filtroPesquisa.toLowerCase()
      return s.setor.toLowerCase().includes(q) || s.bench.descricao.toLowerCase().includes(q)
    })
  }, [empresas, filtroPesquisa])

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-[#0B1F3A] tracking-tight">Setores (Mercado)</h1>
            <Badge className="bg-blue-600 text-white hover:bg-blue-600 text-[10px] font-bold px-2 py-0.5 uppercase tracking-wide">
              Novo
            </Badge>
          </div>
          <p className="text-xs text-[#5B6B7F] mt-1">
            Panorama macroeconômico e benchmarks setoriais de mercado brasileiro (Múltiplos
            EV/EBITDA, P/L, faixas de rentabilidade e liquidez) com comparativo das suas empresas.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Seletor Rápido de Setor */}
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-xs font-semibold text-slate-600 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-blue-600" />
              Setor:
            </span>
            <Select
              value={setorSelecionado}
              onValueChange={(val) => {
                setSetorSelecionado(val as SetorEmpresa)
                if (tabAtiva === 'visao_geral') setTabAtiva('detalhes')
              }}
            >
              <SelectTrigger className="h-8 text-xs font-bold w-44 bg-slate-50 border-slate-200 focus:bg-white">
                <SelectValue placeholder="Escolha o setor" />
              </SelectTrigger>
              <SelectContent>
                {SETORES_PADRAO.map((s) => {
                  const qtd = empresas.filter(
                    (e) => (e.setor || '').trim().toLowerCase() === s.toLowerCase(),
                  ).length
                  return (
                    <SelectItem key={s} value={s} className="text-xs">
                      {s} {qtd > 0 ? `(${qtd} ${qtd === 1 ? 'empresa' : 'empresas'})` : ''}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>

          <Button
            asChild
            size="sm"
            variant="outline"
            className="h-9 text-xs border-slate-200 hover:bg-slate-50 text-slate-700"
          >
            <Link to="/empresas">
              <Building2 className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
              Cadastrar Setor
            </Link>
          </Button>
        </div>
      </div>

      {/* Alerta se nenhuma empresa tiver Setor preenchido */}
      {!loading && totalEmpresasComSetor === 0 && (
        <Card className="bg-amber-50/70 border-amber-200 text-amber-900 shadow-xs">
          <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-amber-900">
                  Nenhuma empresa com campo "Setor" preenchido
                </p>
                <p className="text-xs text-amber-800">
                  Para ver o posicionamento das suas empresas contra os benchmarks de mercado,
                  acesse o cadastro de empresas e selecione o Setor correspondente de cada uma.
                </p>
              </div>
            </div>
            <Button
              asChild
              size="sm"
              className="bg-amber-700 hover:bg-amber-800 text-white text-xs shrink-0 h-8"
            >
              <Link to="/empresas">Ir para Cadastro de Empresas</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Abas de Navegação */}
      <Tabs
        value={tabAtiva}
        onValueChange={(val) => setTabAtiva(val as any)}
        className="w-full space-y-4"
      >
        <TabsList className="bg-slate-100 p-1 rounded-xl h-auto flex flex-wrap gap-1 border border-slate-200 w-full sm:w-auto">
          <TabsTrigger
            value="detalhes"
            className="text-xs font-bold gap-1.5 px-4 py-2 rounded-lg data-[state=active]:bg-white data-[state=active]:text-blue-900 data-[state=active]:shadow-xs"
          >
            <Activity className="w-3.5 h-3.5 text-blue-600" />
            Detalhamento do Setor: {setorSelecionado}
            <Badge variant="outline" className="text-[10px] ml-1 font-mono">
              {empresasDoSetor.length}
            </Badge>
          </TabsTrigger>

          <TabsTrigger
            value="comparativo"
            className="text-xs font-bold gap-1.5 px-4 py-2 rounded-lg data-[state=active]:bg-white data-[state=active]:text-emerald-900 data-[state=active]:shadow-xs"
          >
            <Scale className="w-3.5 h-3.5 text-emerald-600" />
            Comparativo Empresa × Setor
            {mediasTenantSetor && (
              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px] ml-1">
                Ativo
              </Badge>
            )}
          </TabsTrigger>

          <TabsTrigger
            value="visao_geral"
            className="text-xs font-bold gap-1.5 px-4 py-2 rounded-lg data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-xs"
          >
            <Layers className="w-3.5 h-3.5 text-slate-600" />
            Visão Geral de Todos os 10 Setores
          </TabsTrigger>
        </TabsList>

        {/* ========================================================= */}
        {/* ABA 1: DETALHAMENTO DO SETOR SELECIONADO                  */}
        {/* ========================================================= */}
        <TabsContent value="detalhes" className="space-y-6">
          {/* Card Resumo do Setor */}
          <div className="bg-gradient-to-r from-[#0B1F3A] to-[#163761] rounded-2xl p-6 text-white shadow-md">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-300">
                    Setor Econômico Analisado
                  </span>
                  <Badge className="bg-blue-500/30 text-blue-200 border border-blue-400/40 text-[10px]">
                    Referência Brasil
                  </Badge>
                </div>
                <h2 className="text-2xl font-bold tracking-tight mt-1">{setorSelecionado}</h2>
                <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                  {benchmarkSetor.descricao}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="bg-white/10 backdrop-blur-xs px-4 py-2.5 rounded-xl border border-white/15 text-center">
                  <span className="text-[10px] text-blue-200 uppercase font-semibold block">
                    Empresas no Tenant
                  </span>
                  <strong className="text-xl font-mono font-extrabold text-white">
                    {empresasDoSetor.length}
                  </strong>
                </div>

                <div className="bg-white/10 backdrop-blur-xs px-4 py-2.5 rounded-xl border border-white/15 text-center">
                  <span className="text-[10px] text-blue-200 uppercase font-semibold block">
                    Exercício Ativo
                  </span>
                  <strong className="text-xl font-mono font-extrabold text-white">
                    {selectedAno}
                  </strong>
                </div>
              </div>
            </div>
          </div>

          {/* Grid: 6 Múltiplos de Valuation do Mercado */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-blue-600" />
                  Múltiplos de Mercado do Setor ({setorSelecionado})
                </h3>
                <p className="text-xs text-slate-500">
                  Referências empíricas praticadas em transações de M&amp;A e bolsa no mercado
                  brasileiro
                </p>
              </div>
              <TooltipProvider>
                <UiTooltip>
                  <TooltipTrigger asChild>
                    <button className="text-slate-400 hover:text-slate-600">
                      <Info className="w-4 h-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs">
                    Múltiplos medianos padronizados no sistema e reutilizados no módulo Valuation
                    por Múltiplos de Mercado.
                  </TooltipContent>
                </UiTooltip>
              </TooltipProvider>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <Card className="bg-white border-slate-200 shadow-2xs hover:border-blue-300 transition-colors">
                <CardContent className="p-3.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    EV / EBITDA
                  </span>
                  <div className="text-xl font-mono font-extrabold text-[#0B1F3A] mt-1">
                    {multiplosSetor.ev_ebitda.toFixed(1)}x
                  </div>
                  <span className="text-[10px] text-slate-500 mt-0.5 block leading-tight">
                    Firma sobre EBITDA
                  </span>
                </CardContent>
              </Card>

              <Card className="bg-white border-slate-200 shadow-2xs hover:border-blue-300 transition-colors">
                <CardContent className="p-3.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    P / L (Preço/Lucro)
                  </span>
                  <div className="text-xl font-mono font-extrabold text-[#0B1F3A] mt-1">
                    {multiplosSetor.pl.toFixed(1)}x
                  </div>
                  <span className="text-[10px] text-slate-500 mt-0.5 block leading-tight">
                    Anos de Lucro Líquido
                  </span>
                </CardContent>
              </Card>

              <Card className="bg-white border-slate-200 shadow-2xs hover:border-blue-300 transition-colors">
                <CardContent className="p-3.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    P / VP (Patrimonial)
                  </span>
                  <div className="text-xl font-mono font-extrabold text-[#0B1F3A] mt-1">
                    {multiplosSetor.pvp.toFixed(1)}x
                  </div>
                  <span className="text-[10px] text-slate-500 mt-0.5 block leading-tight">
                    Sobre Patr. Líquido
                  </span>
                </CardContent>
              </Card>

              <Card className="bg-white border-slate-200 shadow-2xs hover:border-blue-300 transition-colors">
                <CardContent className="p-3.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    EV / Receita
                  </span>
                  <div className="text-xl font-mono font-extrabold text-[#0B1F3A] mt-1">
                    {multiplosSetor.ev_receita.toFixed(1)}x
                  </div>
                  <span className="text-[10px] text-slate-500 mt-0.5 block leading-tight">
                    Sobre Faturamento
                  </span>
                </CardContent>
              </Card>

              <Card className="bg-white border-slate-200 shadow-2xs hover:border-blue-300 transition-colors">
                <CardContent className="p-3.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    EV / EBIT
                  </span>
                  <div className="text-xl font-mono font-extrabold text-[#0B1F3A] mt-1">
                    {multiplosSetor.ev_ebit.toFixed(1)}x
                  </div>
                  <span className="text-[10px] text-slate-500 mt-0.5 block leading-tight">
                    Sobre Res. Operacional
                  </span>
                </CardContent>
              </Card>

              <Card className="bg-white border-slate-200 shadow-2xs hover:border-blue-300 transition-colors">
                <CardContent className="p-3.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    P / EBITDA
                  </span>
                  <div className="text-xl font-mono font-extrabold text-[#0B1F3A] mt-1">
                    {multiplosSetor.p_ebitda.toFixed(1)}x
                  </div>
                  <span className="text-[10px] text-slate-500 mt-0.5 block leading-tight">
                    Equity sobre Caixa
                  </span>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Faixas Típicas de Indicadores Financeiros do Setor */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-white border-slate-200 shadow-2xs">
              <CardHeader className="pb-3 border-b border-slate-100">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Percent className="w-4 h-4 text-emerald-600" />
                  Rentabilidade &amp; Margens
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 font-medium">Margem Líquida Alvo:</span>
                  <span className="font-mono font-bold text-slate-900">
                    {benchmarkSetor.margemLiquida.toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 font-medium">Margem Operacional:</span>
                  <span className="font-mono font-bold text-slate-900">
                    {benchmarkSetor.margemOperacional.toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 font-medium">Margem Bruta Típica:</span>
                  <span className="font-mono font-bold text-slate-900">
                    {benchmarkSetor.margemBruta.toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 font-medium">ROE (Retorno s/ PL):</span>
                  <span className="font-mono font-bold text-emerald-700">
                    {benchmarkSetor.roe.toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 font-medium">ROA (Retorno s/ Ativo):</span>
                  <span className="font-mono font-bold text-slate-900">
                    {benchmarkSetor.roa.toFixed(1)}%
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border-slate-200 shadow-2xs">
              <CardHeader className="pb-3 border-b border-slate-100">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-blue-600" />
                  Liquidez &amp; Solvência
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 font-medium">Liquidez Corrente:</span>
                  <span className="font-mono font-bold text-blue-700">
                    {benchmarkSetor.liquidezCorrente.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 font-medium">Liquidez Seca:</span>
                  <span className="font-mono font-bold text-slate-900">
                    {benchmarkSetor.liquidezSeca.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 font-medium">Liquidez Imediata:</span>
                  <span className="font-mono font-bold text-slate-900">
                    {benchmarkSetor.liquidezImediata.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 font-medium">Liquidez Geral:</span>
                  <span className="font-mono font-bold text-slate-900">
                    {benchmarkSetor.liquidezGeral.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 font-medium">Endividamento Geral:</span>
                  <span className="font-mono font-bold text-slate-900">
                    {benchmarkSetor.endividamentoGeral.toFixed(1)}%
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border-slate-200 shadow-2xs">
              <CardHeader className="pb-3 border-b border-slate-100">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Scale className="w-4 h-4 text-amber-600" />
                  Eficiência &amp; EBITDA
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 font-medium">Margem EBITDA Setor:</span>
                  <span className="font-mono font-bold text-slate-900">
                    {benchmarkSetor.margemEbitda.toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 font-medium">Cobertura de Juros:</span>
                  <span className="font-mono font-bold text-slate-900">
                    {benchmarkSetor.coberturaJuros.toFixed(1)}x
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 font-medium">Ciclo Operacional:</span>
                  <span className="font-mono font-bold text-slate-900">
                    {benchmarkSetor.cicloOperacional} dias
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 font-medium">Ciclo Financeiro:</span>
                  <span className="font-mono font-bold text-slate-900">
                    {benchmarkSetor.cicloFinanceiro} dias
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 font-medium">ROIC de Mercado:</span>
                  <span className="font-mono font-bold text-slate-900">
                    {benchmarkSetor.roic.toFixed(1)}%
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Lista de Empresas Cadastradas neste Setor */}
          <Card className="bg-white border-slate-200 shadow-2xs">
            <CardHeader className="pb-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-sm font-bold text-[#0B1F3A]">
                  Empresas do Tenant no Setor {setorSelecionado} ({empresasDoSetor.length})
                </CardTitle>
                <CardDescription className="text-xs">
                  Empresas vinculadas a este setor e seu posicionamento financeiro apurado
                </CardDescription>
              </div>

              <Button
                asChild
                size="sm"
                variant="outline"
                className="h-8 text-xs border-slate-200 text-slate-700"
              >
                <Link to="/empresas">
                  Gerenciar Empresas <ChevronRight className="w-3.5 h-3.5 ml-1" />
                </Link>
              </Button>
            </CardHeader>

            <CardContent className="p-0">
              {empresasDoSetor.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-500 space-y-2">
                  <p>Nenhuma empresa cadastrada com o Setor "{setorSelecionado}".</p>
                  <Button asChild size="sm" variant="outline" className="text-xs">
                    <Link to="/empresas">Cadastrar ou Editar Empresa para associar ao Setor</Link>
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 font-semibold">
                        <th className="py-3 px-4">Empresa</th>
                        <th className="py-3 px-4">Segmento Original</th>
                        <th className="py-3 px-4 text-center">Exercício Base</th>
                        <th className="py-3 px-4 text-right">Margem Líquida</th>
                        <th className="py-3 px-4 text-right">ROE</th>
                        <th className="py-3 px-4 text-right">Liquidez Corrente</th>
                        <th className="py-3 px-4 text-center">Posicionamento vs. Mercado</th>
                        <th className="py-3 px-4 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {dadosEmpresasDoSetor.map((item) => {
                        const ind = item.indicadores
                        const ml = ind?.ml ?? null
                        const roe = ind?.roe ?? null
                        const lc = ind?.lc ?? null

                        // Avaliação de semáforo simples
                        let statusCor = 'bg-slate-100 text-slate-600 border-slate-200'
                        let statusTexto = 'Sem Dados'

                        if (item.temDados && ind) {
                          const pts =
                            (ml !== null && ml >= benchmarkSetor.margemLiquida ? 1 : 0) +
                            (roe !== null && roe >= benchmarkSetor.roe ? 1 : 0) +
                            (lc !== null && lc >= benchmarkSetor.liquidezCorrente ? 1 : 0)

                          if (pts >= 2) {
                            statusCor = 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            statusTexto = 'Acima da Média'
                          } else if (pts === 1) {
                            statusCor = 'bg-amber-50 text-amber-700 border-amber-200'
                            statusTexto = 'Na Média'
                          } else {
                            statusCor = 'bg-red-50 text-red-700 border-red-200'
                            statusTexto = 'Abaixo da Média'
                          }
                        }

                        return (
                          <tr
                            key={item.empresa.id}
                            className="hover:bg-slate-50/80 transition-colors"
                          >
                            <td className="py-3 px-4">
                              <div className="font-semibold text-slate-900">
                                {item.empresa.nome}
                              </div>
                              {item.empresa.nome_fantasia && (
                                <div className="text-[11px] text-slate-500">
                                  {item.empresa.nome_fantasia}
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-4 text-slate-600">{item.empresa.segmento}</td>
                            <td className="py-3 px-4 text-center">
                              {item.balanco?.ano || item.dre?.ano ? (
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] bg-blue-50 text-blue-700 font-mono"
                                >
                                  {item.balanco?.ano || item.dre?.ano}
                                </Badge>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-medium">
                              {ml !== null ? (
                                <span
                                  className={
                                    ml >= benchmarkSetor.margemLiquida
                                      ? 'text-emerald-700 font-bold'
                                      : 'text-slate-700'
                                  }
                                >
                                  {ml.toFixed(1)}%
                                </span>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-medium">
                              {roe !== null ? (
                                <span
                                  className={
                                    roe >= benchmarkSetor.roe
                                      ? 'text-emerald-700 font-bold'
                                      : 'text-slate-700'
                                  }
                                >
                                  {roe.toFixed(1)}%
                                </span>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-medium">
                              {lc !== null ? (
                                <span
                                  className={
                                    lc >= benchmarkSetor.liquidezCorrente
                                      ? 'text-emerald-700 font-bold'
                                      : 'text-slate-700'
                                  }
                                >
                                  {lc.toFixed(2)}
                                </span>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <Badge
                                variant="outline"
                                className={`text-[10px] font-semibold border ${statusCor}`}
                              >
                                {statusTexto}
                              </Badge>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <Button
                                asChild
                                size="sm"
                                variant="ghost"
                                className="h-7 text-[11px] text-blue-600 hover:bg-blue-50 font-medium"
                              >
                                <Link to={`/empresas/${item.empresa.id}`}>Ver Análise</Link>
                              </Button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========================================================= */}
        {/* ABA 2: COMPARATIVO EMPRESA × SETOR                        */}
        {/* ========================================================= */}
        <TabsContent value="comparativo" className="space-y-6">
          {/* Parecer Executivo / Diagnóstico */}
          <Card
            className={`border shadow-xs ${
              parecerSetor.status === 'positivo'
                ? 'bg-emerald-50/60 border-emerald-200'
                : parecerSetor.status === 'alerta'
                  ? 'bg-red-50/60 border-red-200'
                  : 'bg-blue-50/60 border-blue-200'
            }`}
          >
            <CardContent className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    parecerSetor.status === 'positivo'
                      ? 'bg-emerald-600 text-white'
                      : parecerSetor.status === 'alerta'
                        ? 'bg-red-600 text-white'
                        : 'bg-blue-600 text-white'
                  }`}
                >
                  {parecerSetor.status === 'positivo' ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : parecerSetor.status === 'alerta' ? (
                    <AlertTriangle className="w-5 h-5" />
                  ) : (
                    <Info className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">
                    Parecer Executivo Setorial ({setorSelecionado} • {selectedAno})
                  </span>
                  <h3 className="text-base font-bold text-[#0B1F3A] mt-0.5">
                    {parecerSetor.titulo}
                  </h3>
                  <p className="text-xs text-slate-600 mt-1 max-w-3xl leading-relaxed">
                    {parecerSetor.texto}
                  </p>
                </div>
              </div>

              {mediasTenantSetor && (
                <div className="shrink-0 text-right">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold block">
                    Amostra Apurada
                  </span>
                  <strong className="text-sm font-mono font-bold text-slate-800">
                    {mediasTenantSetor.totalComDados} de {empresasDoSetor.length} empresas com dados
                  </strong>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Gráfico de Barras Comparativo Recharts */}
          <Card className="bg-white border-slate-200 shadow-2xs">
            <CardHeader className="pb-3 border-b border-slate-100">
              <CardTitle className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
                <Scale className="w-4 h-4 text-blue-600" />
                Média do Tenant vs. Benchmark de Mercado ({setorSelecionado})
              </CardTitle>
              <CardDescription className="text-xs">
                Comparativo visual das principais métricas financeiras (Margens, ROE e Liquidez
                normalizada)
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5">
              <div className="h-72 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={dadosGraficoComparativo}
                    margin={{ top: 10, right: 30, left: 0, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis
                      dataKey="indicador"
                      tick={{ fill: '#334155', fontSize: 11, fontWeight: 600 }}
                    />
                    <YAxis tick={{ fill: '#64748B', fontSize: 10 }} />
                    <RechartsTooltip
                      contentStyle={{
                        backgroundColor: '#0B1F3A',
                        borderColor: '#1E293B',
                        borderRadius: '8px',
                        color: '#fff',
                        fontSize: '12px',
                      }}
                      formatter={(val: any, name: any) => [
                        `${val}`,
                        name === 'mercado'
                          ? `Mercado (${setorSelecionado})`
                          : 'Média Empresas Tenant',
                      ]}
                    />
                    <Legend
                      verticalAlign="top"
                      align="right"
                      iconType="circle"
                      wrapperStyle={{ fontSize: '11px', paddingBottom: '10px' }}
                    />
                    <Bar
                      dataKey="mercado"
                      name={`Mercado (${setorSelecionado})`}
                      fill="#94A3B8"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="empresasTenant"
                      name="Média Empresas Tenant"
                      fill="#2563EB"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Cards Detalhados dos 3 Indicadores Principais com Medidores de Faixa */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 1. Margem Líquida */}
            <Card className="bg-white border-slate-200 shadow-2xs">
              <CardHeader className="pb-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Indicador de Rentabilidade
                </span>
                <CardTitle className="text-sm font-bold text-[#0B1F3A]">
                  Margem Líquida (%)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-baseline justify-between">
                  <div>
                    <span className="text-xs text-slate-500">Média das Empresas:</span>
                    <div className="text-2xl font-mono font-extrabold text-[#0B1F3A]">
                      {mediasTenantSetor?.margemLiquidaMedia !== null &&
                      mediasTenantSetor?.margemLiquidaMedia !== undefined
                        ? `${mediasTenantSetor.margemLiquidaMedia.toFixed(1)}%`
                        : '—'}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-500">Benchmark Setor:</span>
                    <div className="text-base font-mono font-bold text-slate-600">
                      {benchmarkSetor.margemLiquida.toFixed(1)}%
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-500">Status relativo:</span>
                  {mediasTenantSetor?.margemLiquidaMedia !== null &&
                  mediasTenantSetor?.margemLiquidaMedia !== undefined ? (
                    mediasTenantSetor.margemLiquidaMedia >= benchmarkSetor.margemLiquida ? (
                      <span className="font-bold text-emerald-700 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Acima da meta
                      </span>
                    ) : (
                      <span className="font-bold text-amber-700 flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" /> Abaixo da meta
                      </span>
                    )
                  ) : (
                    <span className="text-slate-400">Sem dados</span>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* 2. ROE */}
            <Card className="bg-white border-slate-200 shadow-2xs">
              <CardHeader className="pb-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Retorno sobre o Acionista
                </span>
                <CardTitle className="text-sm font-bold text-[#0B1F3A]">ROE (% a.a.)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-baseline justify-between">
                  <div>
                    <span className="text-xs text-slate-500">Média das Empresas:</span>
                    <div className="text-2xl font-mono font-extrabold text-emerald-700">
                      {mediasTenantSetor?.roeMedio !== null &&
                      mediasTenantSetor?.roeMedio !== undefined
                        ? `${mediasTenantSetor.roeMedio.toFixed(1)}%`
                        : '—'}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-500">Benchmark Setor:</span>
                    <div className="text-base font-mono font-bold text-slate-600">
                      {benchmarkSetor.roe.toFixed(1)}%
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-500">Status relativo:</span>
                  {mediasTenantSetor?.roeMedio !== null &&
                  mediasTenantSetor?.roeMedio !== undefined ? (
                    mediasTenantSetor.roeMedio >= benchmarkSetor.roe ? (
                      <span className="font-bold text-emerald-700 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Acima da meta
                      </span>
                    ) : (
                      <span className="font-bold text-amber-700 flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" /> Abaixo da meta
                      </span>
                    )
                  ) : (
                    <span className="text-slate-400">Sem dados</span>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* 3. Liquidez Corrente */}
            <Card className="bg-white border-slate-200 shadow-2xs">
              <CardHeader className="pb-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Capacidade de Pagamento
                </span>
                <CardTitle className="text-sm font-bold text-[#0B1F3A]">
                  Liquidez Corrente
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-baseline justify-between">
                  <div>
                    <span className="text-xs text-slate-500">Média das Empresas:</span>
                    <div className="text-2xl font-mono font-extrabold text-blue-700">
                      {mediasTenantSetor?.liquidezCorrenteMedia !== null &&
                      mediasTenantSetor?.liquidezCorrenteMedia !== undefined
                        ? mediasTenantSetor.liquidezCorrenteMedia.toFixed(2)
                        : '—'}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-500">Benchmark Setor:</span>
                    <div className="text-base font-mono font-bold text-slate-600">
                      {benchmarkSetor.liquidezCorrente.toFixed(2)}
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-500">Status relativo:</span>
                  {mediasTenantSetor?.liquidezCorrenteMedia !== null &&
                  mediasTenantSetor?.liquidezCorrenteMedia !== undefined ? (
                    mediasTenantSetor.liquidezCorrenteMedia >= benchmarkSetor.liquidezCorrente ? (
                      <span className="font-bold text-emerald-700 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Folga financeira
                      </span>
                    ) : (
                      <span className="font-bold text-red-700 flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" /> Pressionada
                      </span>
                    )
                  ) : (
                    <span className="text-slate-400">Sem dados</span>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ========================================================= */}
        {/* ABA 3: VISÃO GERAL DE TODOS OS 10 SETORES                */}
        {/* ========================================================= */}
        <TabsContent value="visao_geral" className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-[#0B1F3A]">
                Matriz Completa de Setores de Mercado
              </h3>
              <p className="text-xs text-slate-500">
                Comparativo de múltiplos e parâmetros macroeconômicos entre todos os 10 setores
                padronizados no sistema
              </p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar setor..."
                value={filtroPesquisa}
                onChange={(e) => setFiltroPesquisa(e.target.value)}
                className="pl-8 h-8 text-xs bg-white border border-slate-200 rounded-lg w-full focus:outline-hidden focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {setoresComEstatisticas.map((item) => {
              const isAtivo = item.setor === setorSelecionado
              return (
                <Card
                  key={item.setor}
                  className={`border transition-all cursor-pointer ${
                    isAtivo
                      ? 'bg-blue-50/40 border-blue-400 ring-2 ring-blue-500/20 shadow-sm'
                      : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
                  }`}
                  onClick={() => {
                    setSetorSelecionado(item.setor as SetorEmpresa)
                    setTabAtiva('detalhes')
                  }}
                >
                  <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-sm font-bold text-[#0B1F3A]">
                          {item.setor}
                        </CardTitle>
                        {isAtivo && (
                          <Badge className="bg-blue-600 text-white text-[9px] px-1.5 py-0">
                            Selecionado
                          </Badge>
                        )}
                      </div>
                      <CardDescription className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                        {item.bench.descricao}
                      </CardDescription>
                    </div>

                    <Badge
                      variant="outline"
                      className="text-[10px] font-mono font-bold bg-slate-50 text-slate-700"
                    >
                      {item.count} {item.count === 1 ? 'empresa' : 'empresas'}
                    </Badge>
                  </CardHeader>

                  <CardContent className="p-4 space-y-3 text-xs">
                    {/* Linha 1: Múltiplos */}
                    <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-center">
                      <div>
                        <span className="text-[10px] text-slate-500 block">EV/EBITDA</span>
                        <strong className="text-xs font-mono font-bold text-[#0B1F3A]">
                          {item.mult.ev_ebitda.toFixed(1)}x
                        </strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block">P/L</span>
                        <strong className="text-xs font-mono font-bold text-[#0B1F3A]">
                          {item.mult.pl.toFixed(1)}x
                        </strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block">P/VP</span>
                        <strong className="text-xs font-mono font-bold text-[#0B1F3A]">
                          {item.mult.pvp.toFixed(1)}x
                        </strong>
                      </div>
                    </div>

                    {/* Linha 2: Indicadores */}
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <span className="text-[10px] text-slate-500 block">Margem Líq.</span>
                        <span className="font-mono font-semibold text-slate-800">
                          {item.bench.margemLiquida.toFixed(1)}%
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block">ROE</span>
                        <span className="font-mono font-semibold text-emerald-700">
                          {item.bench.roe.toFixed(1)}%
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block">Liq. Corrente</span>
                        <span className="font-mono font-semibold text-blue-700">
                          {item.bench.liquidezCorrente.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
