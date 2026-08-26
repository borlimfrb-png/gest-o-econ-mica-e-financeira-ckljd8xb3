import React, { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useFilter } from '@/contexts/FilterContext'
import { useMinhaEmpresa } from '@/contexts/MinhaEmpresaContext'
import { balancosService, dreService } from '@/services/financeService'
import type { BalancoRecord, DreRecord } from '@/types/finance'
import {
  calcularBalanco,
  calcularDre,
  calcularIndicadores,
  formatBrlMil,
  formatCurrency,
  formatNumber,
  formatPercent,
  formatCnpj,
} from '@/lib/financeCalculations'
import {
  BENCHMARKS_SETORIAIS,
  getBenchmarkParaSegmento,
  extrairIndicadoresCompletos,
  calcularScoresRadar,
  calcularScoreGeralPonderado,
  PERFIS_PESOS_PREDEFINIDOS,
  type PerfilPesosId,
  type PesosGrupos,
  type GrupoRadarItem,
} from '@/lib/benchmarks'
import { ModalPesosRelatorio } from '@/components/ModalPesosRelatorio'
import { useRealtime } from '@/hooks/use-realtime'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Tooltip as RechartsTooltip,
  Legend,
} from 'recharts'
import {
  Gauge,
  Building2,
  Calendar,
  Download,
  SlidersHorizontal,
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
  Layers,
  ShieldCheck,
  FileText,
  Clock,
  Scale,
  Sparkles,
  Info,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  BarChart3,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export default function PainelIndicadores() {
  const {
    empresas,
    selectedEmpresaId,
    setSelectedEmpresaId,
    selectedAno,
    setSelectedAno,
    anosDisponiveis,
    selectedEmpresa,
  } = useFilter()
  const { minhaEmpresa, corPrimaria } = useMinhaEmpresa()
  const { toast } = useToast()
  const navigate = useNavigate()

  const [balancos, setBalancos] = useState<BalancoRecord[]>([])
  const [dres, setDres] = useState<DreRecord[]>([])
  const [loading, setLoading] = useState<boolean>(true)

  // Setor selecionado para benchmark (padrão = segmento da empresa ou 'Serviços')
  const [selectedSetorBenchmark, setSelectedSetorBenchmark] = useState<string>('')

  // Toggle de evolução 3 anos
  const [verEvolucao, setVerEvolucao] = useState<boolean>(false)

  // Modal de Pesos
  const [modalPesosOpen, setModalPesosOpen] = useState<boolean>(false)
  const [perfilPesos, setPerfilPesos] = useState<PerfilPesosId>(() => {
    const saved = localStorage.getItem('relatorio_perfil_pesos')
    return (saved as PerfilPesosId) || 'servicos'
  })
  const [pesos, setPesos] = useState<PesosGrupos>(() => {
    const saved = localStorage.getItem('relatorio_pesos_custom')
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch {
        // fallback
      }
    }
    return PERFIS_PESOS_PREDEFINIDOS.servicos.pesos
  })

  // Sincroniza o setor de benchmark quando a empresa selecionada muda
  useEffect(() => {
    if (selectedEmpresa?.segmento) {
      setSelectedSetorBenchmark(selectedEmpresa.segmento)
    } else if (!selectedSetorBenchmark) {
      setSelectedSetorBenchmark('Serviços')
    }
  }, [selectedEmpresa?.segmento])

  // Carregar dados das coleções
  const loadData = async () => {
    if (!selectedEmpresaId) {
      setBalancos([])
      setDres([])
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      const [bList, dList] = await Promise.all([
        balancosService.getByEmpresa(selectedEmpresaId),
        dreService.getByEmpresa(selectedEmpresaId),
      ])
      setBalancos(bList)
      setDres(dList)
    } catch (err) {
      console.error('Erro ao carregar dados contábeis:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar dados',
        description: 'Não foi possível buscar balanços e DRE para o painel.',
      })
    } finally {
      setLoading(false)
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

  // Demonstrações do ano selecionado
  const balancoAtual = useMemo(
    () => balancos.find((b) => b.ano === selectedAno) || null,
    [balancos, selectedAno],
  )
  const dreAtual = useMemo(
    () => dres.find((d) => d.ano === selectedAno) || null,
    [dres, selectedAno],
  )

  // Demonstrações dos últimos 3 anos (anoAtual, anoAtual - 1, anoAtual - 2)
  const ano1 = selectedAno - 1
  const ano2 = selectedAno - 2

  const balancoAno1 = useMemo(() => balancos.find((b) => b.ano === ano1) || null, [balancos, ano1])
  const dreAno1 = useMemo(() => dres.find((d) => d.ano === ano1) || null, [dres, ano1])

  const balancoAno2 = useMemo(() => balancos.find((b) => b.ano === ano2) || null, [balancos, ano2])
  const dreAno2 = useMemo(() => dres.find((d) => d.ano === ano2) || null, [dres, ano2])

  // Indicadores consolidados dos 3 anos
  const indAtual = useMemo(
    () => extrairIndicadoresCompletos(balancoAtual, dreAtual),
    [balancoAtual, dreAtual],
  )
  const indAno1 = useMemo(
    () => (balancoAno1 || dreAno1 ? extrairIndicadoresCompletos(balancoAno1, dreAno1) : null),
    [balancoAno1, dreAno1],
  )
  const indAno2 = useMemo(
    () => (balancoAno2 || dreAno2 ? extrairIndicadoresCompletos(balancoAno2, dreAno2) : null),
    [balancoAno2, dreAno2],
  )

  // Benchmark ativo
  const benchmarkAtivo = useMemo(() => {
    if (!selectedSetorBenchmark) return null
    return BENCHMARKS_SETORIAIS[selectedSetorBenchmark] || null
  }, [selectedSetorBenchmark])

  // Itens do Radar Chart
  const radarItems = useMemo<GrupoRadarItem[]>(() => {
    if (!benchmarkAtivo) return []
    return calcularScoresRadar(indAtual, benchmarkAtivo)
  }, [indAtual, benchmarkAtivo])

  // Score Geral Ponderado (0-100)
  const scoreGeralPonderado = useMemo(() => {
    if (!radarItems.length) return 50
    return calcularScoreGeralPonderado(radarItems, pesos)
  }, [radarItems, pesos])

  // Cards de Destaques
  const destaques = useMemo(() => {
    const calcB = calcularBalanco(balancoAtual)
    const calcD = calcularDre(dreAtual)
    return {
      ativoTotal: calcB.ativoTotal,
      patrimonioLiquido: calcB.patrimonioLiquido,
      receitaLiquida: calcD.receitaLiquida,
      lucroLiquido: calcD.lucroLiquido,
      ebitda: calcD.ebitda,
      liquidezCorrente: indAtual.lc,
      roe: indAtual.roe,
      endividamentoGeral: indAtual.eg,
    }
  }, [balancoAtual, dreAtual, indAtual])

  // Salvar Pesos
  const handleSalvarPesos = (novoPerfil: PerfilPesosId, novosPesos: PesosGrupos) => {
    setPerfilPesos(novoPerfil)
    setPesos(novosPesos)
    localStorage.setItem('relatorio_perfil_pesos', novoPerfil)
    localStorage.setItem('relatorio_pesos_custom', JSON.stringify(novosPesos))
    toast({
      title: 'Ponderação de Indicadores Atualizada',
      description: `Perfil ${PERFIS_PESOS_PREDEFINIDOS[novoPerfil].nome} aplicado com sucesso.`,
    })
  }

  // Tabela de Evolução vs Setor (3 Anos)
  const linhasEvolucao = useMemo(() => {
    if (!benchmarkAtivo) return []

    const calcularTendencia = (
      valAtual: number | null,
      valAnt1: number | null,
      isLowerBetter = false,
    ): { icon: 'up' | 'down' | 'stable'; label: string; color: string } => {
      if (valAtual === null || valAnt1 === null) {
        return { icon: 'stable', label: '—', color: 'text-slate-400' }
      }
      const diff = valAtual - valAnt1
      if (Math.abs(diff) < 0.05) {
        return { icon: 'stable', label: 'Estável', color: 'text-slate-500' }
      }
      if (isLowerBetter) {
        if (diff < 0) return { icon: 'up', label: 'Melhora', color: 'text-emerald-600' }
        return { icon: 'down', label: 'Piora', color: 'text-red-600' }
      } else {
        if (diff > 0) return { icon: 'up', label: 'Melhora', color: 'text-emerald-600' }
        return { icon: 'down', label: 'Piora', color: 'text-red-600' }
      }
    }

    return [
      // 1. Liquidez
      {
        grupo: 'Liquidez',
        indicador: 'Liquidez Corrente (LC)',
        link: '/indicadores/liquidez',
        ano2: indAno2?.lc ? indAno2.lc.toFixed(2) : '—',
        ano1: indAno1?.lc ? indAno1.lc.toFixed(2) : '—',
        anoAtual: indAtual.lc ? indAtual.lc.toFixed(2) : '—',
        setor: benchmarkAtivo.liquidezCorrente.toFixed(2),
        unidade: '',
        tendencia: calcularTendencia(indAtual.lc, indAno1?.lc || null, false),
        peso: pesos.liquidez,
      },
      {
        grupo: 'Liquidez',
        indicador: 'Liquidez Seca (LS)',
        link: '/indicadores/liquidez',
        ano2: indAno2?.ls ? indAno2.ls.toFixed(2) : '—',
        ano1: indAno1?.ls ? indAno1.ls.toFixed(2) : '—',
        anoAtual: indAtual.ls ? indAtual.ls.toFixed(2) : '—',
        setor: benchmarkAtivo.liquidezSeca.toFixed(2),
        unidade: '',
        tendencia: calcularTendencia(indAtual.ls, indAno1?.ls || null, false),
        peso: pesos.liquidez,
      },
      {
        grupo: 'Liquidez',
        indicador: 'Liquidez Geral (LG)',
        link: '/indicadores/liquidez',
        ano2: indAno2?.lg ? indAno2.lg.toFixed(2) : '—',
        ano1: indAno1?.lg ? indAno1.lg.toFixed(2) : '—',
        anoAtual: indAtual.lg ? indAtual.lg.toFixed(2) : '—',
        setor: benchmarkAtivo.liquidezGeral.toFixed(2),
        unidade: '',
        tendencia: calcularTendencia(indAtual.lg, indAno1?.lg || null, false),
        peso: pesos.liquidez,
      },

      // 2. Endividamento
      {
        grupo: 'Endividamento',
        indicador: 'Endividamento Geral (%)',
        link: '/indicadores/endividamento',
        ano2: indAno2?.eg ? `${indAno2.eg.toFixed(1)}%` : '—',
        ano1: indAno1?.eg ? `${indAno1.eg.toFixed(1)}%` : '—',
        anoAtual: indAtual.eg ? `${indAtual.eg.toFixed(1)}%` : '—',
        setor: `${benchmarkAtivo.endividamentoGeral.toFixed(1)}%`,
        unidade: '%',
        tendencia: calcularTendencia(indAtual.eg, indAno1?.eg || null, true),
        peso: pesos.endividamento,
      },
      {
        grupo: 'Endividamento',
        indicador: 'Composição do Endividamento (%)',
        link: '/indicadores/endividamento',
        ano2: indAno2?.ce ? `${indAno2.ce.toFixed(1)}%` : '—',
        ano1: indAno1?.ce ? `${indAno1.ce.toFixed(1)}%` : '—',
        anoAtual: indAtual.ce ? `${indAtual.ce.toFixed(1)}%` : '—',
        setor: `${benchmarkAtivo.composicaoEndividamento.toFixed(1)}%`,
        unidade: '%',
        tendencia: calcularTendencia(indAtual.ce, indAno1?.ce || null, true),
        peso: pesos.endividamento,
      },
      {
        grupo: 'Endividamento',
        indicador: 'Part. Capital de Terceiros (%)',
        link: '/indicadores/endividamento',
        ano2: indAno2?.pct ? `${indAno2.pct.toFixed(1)}%` : '—',
        ano1: indAno1?.pct ? `${indAno1.pct.toFixed(1)}%` : '—',
        anoAtual: indAtual.pct ? `${indAtual.pct.toFixed(1)}%` : '—',
        setor: `${benchmarkAtivo.participacaoCapitalTerceiros.toFixed(1)}%`,
        unidade: '%',
        tendencia: calcularTendencia(indAtual.pct, indAno1?.pct || null, true),
        peso: pesos.endividamento,
      },

      // 3. Rentabilidade
      {
        grupo: 'Rentabilidade',
        indicador: 'ROE (Retorno sobre PL %)',
        link: '/indicadores/rentabilidade',
        ano2: indAno2?.roe ? `${indAno2.roe.toFixed(1)}%` : '—',
        ano1: indAno1?.roe ? `${indAno1.roe.toFixed(1)}%` : '—',
        anoAtual: indAtual.roe ? `${indAtual.roe.toFixed(1)}%` : '—',
        setor: `${benchmarkAtivo.roe.toFixed(1)}%`,
        unidade: '%',
        tendencia: calcularTendencia(indAtual.roe, indAno1?.roe || null, false),
        peso: pesos.rentabilidade,
      },
      {
        grupo: 'Rentabilidade',
        indicador: 'ROA (Retorno sobre Ativo %)',
        link: '/indicadores/rentabilidade',
        ano2: indAno2?.roa ? `${indAno2.roa.toFixed(1)}%` : '—',
        ano1: indAno1?.roa ? `${indAno1.roa.toFixed(1)}%` : '—',
        anoAtual: indAtual.roa ? `${indAtual.roa.toFixed(1)}%` : '—',
        setor: `${benchmarkAtivo.roa.toFixed(1)}%`,
        unidade: '%',
        tendencia: calcularTendencia(indAtual.roa, indAno1?.roa || null, false),
        peso: pesos.rentabilidade,
      },
      {
        grupo: 'Rentabilidade',
        indicador: 'Margem Líquida (%)',
        link: '/indicadores/rentabilidade',
        ano2: indAno2?.ml ? `${indAno2.ml.toFixed(1)}%` : '—',
        ano1: indAno1?.ml ? `${indAno1.ml.toFixed(1)}%` : '—',
        anoAtual: indAtual.ml ? `${indAtual.ml.toFixed(1)}%` : '—',
        setor: `${benchmarkAtivo.margemLiquida.toFixed(1)}%`,
        unidade: '%',
        tendencia: calcularTendencia(indAtual.ml, indAno1?.ml || null, false),
        peso: pesos.rentabilidade,
      },

      // 4. Estrutura de Capital
      {
        grupo: 'Estrutura de Capital',
        indicador: 'Autonomia Financeira (%)',
        link: '/indicadores/estrutura-capital',
        ano2: indAno2?.af ? `${indAno2.af.toFixed(1)}%` : '—',
        ano1: indAno1?.af ? `${indAno1.af.toFixed(1)}%` : '—',
        anoAtual: indAtual.af ? `${indAtual.af.toFixed(1)}%` : '—',
        setor: `${benchmarkAtivo.autonomiaFinanceira.toFixed(1)}%`,
        unidade: '%',
        tendencia: calcularTendencia(indAtual.af, indAno1?.af || null, false),
        peso: pesos.estruturaCapital,
      },
      {
        grupo: 'Estrutura de Capital',
        indicador: 'Relação Dívida / Equity',
        link: '/indicadores/estrutura-capital',
        ano2: indAno2?.de ? `${indAno2.de.toFixed(2)}x` : '—',
        ano1: indAno1?.de ? `${indAno1.de.toFixed(2)}x` : '—',
        anoAtual: indAtual.de ? `${indAtual.de.toFixed(2)}x` : '—',
        setor: `${benchmarkAtivo.dividaEquity.toFixed(2)}x`,
        unidade: 'x',
        tendencia: calcularTendencia(indAtual.de, indAno1?.de || null, true),
        peso: pesos.estruturaCapital,
      },

      // 5. EBITDA
      {
        grupo: 'EBITDA',
        indicador: 'Margem EBITDA (%)',
        link: '/indicadores/ebitda',
        ano2: indAno2?.margemEbitda ? `${indAno2.margemEbitda.toFixed(1)}%` : '—',
        ano1: indAno1?.margemEbitda ? `${indAno1.margemEbitda.toFixed(1)}%` : '—',
        anoAtual: indAtual.margemEbitda ? `${indAtual.margemEbitda.toFixed(1)}%` : '—',
        setor: `${benchmarkAtivo.margemEbitda.toFixed(1)}%`,
        unidade: '%',
        tendencia: calcularTendencia(indAtual.margemEbitda, indAno1?.margemEbitda || null, false),
        peso: pesos.ebitda,
      },
      {
        grupo: 'EBITDA',
        indicador: 'Cobertura de Juros (EBITDA/DF)',
        link: '/indicadores/ebitda',
        ano2: indAno2?.coberturaJuros ? `${indAno2.coberturaJuros.toFixed(2)}x` : '—',
        ano1: indAno1?.coberturaJuros ? `${indAno1.coberturaJuros.toFixed(2)}x` : '—',
        anoAtual: indAtual.coberturaJuros ? `${indAtual.coberturaJuros.toFixed(2)}x` : '—',
        setor: `${benchmarkAtivo.coberturaJuros.toFixed(2)}x`,
        unidade: 'x',
        tendencia: calcularTendencia(
          indAtual.coberturaJuros,
          indAno1?.coberturaJuros || null,
          false,
        ),
        peso: pesos.ebitda,
      },

      // 6. Eficiência Operacional
      {
        grupo: 'Eficiência Operacional',
        indicador: 'Ciclo Financeiro (dias)',
        link: '/indicadores/eficiencia-operacional',
        ano2:
          indAno2?.cf !== null && indAno2?.cf !== undefined ? `${Math.round(indAno2.cf)}d` : '—',
        ano1:
          indAno1?.cf !== null && indAno1?.cf !== undefined ? `${Math.round(indAno1.cf)}d` : '—',
        anoAtual: indAtual.cf !== null ? `${Math.round(indAtual.cf)}d` : '—',
        setor: `${benchmarkAtivo.cicloFinanceiro}d`,
        unidade: 'd',
        tendencia: calcularTendencia(indAtual.cf, indAno1?.cf || null, true),
        peso: pesos.eficienciaOperacional,
      },
      {
        grupo: 'Eficiência Operacional',
        indicador: 'Prazo Médio Recebimento (PMR)',
        link: '/indicadores/eficiencia-operacional',
        ano2: indAno2?.pmr ? `${Math.round(indAno2.pmr)}d` : '—',
        ano1: indAno1?.pmr ? `${Math.round(indAno1.pmr)}d` : '—',
        anoAtual: indAtual.pmr ? `${Math.round(indAtual.pmr)}d` : '—',
        setor: `${benchmarkAtivo.pmr}d`,
        unidade: 'd',
        tendencia: calcularTendencia(indAtual.pmr, indAno1?.pmr || null, true),
        peso: pesos.eficienciaOperacional,
      },

      // 7. Econômicos
      {
        grupo: 'Econômicos',
        indicador: 'ROIC vs WACC (Spread %)',
        link: '/indicadores/economicos',
        ano2:
          indAno2?.spread !== null && indAno2?.spread !== undefined
            ? `${indAno2.spread.toFixed(1)}%`
            : '—',
        ano1:
          indAno1?.spread !== null && indAno1?.spread !== undefined
            ? `${indAno1.spread.toFixed(1)}%`
            : '—',
        anoAtual: indAtual.spread !== null ? `${indAtual.spread.toFixed(1)}%` : '—',
        setor: `${benchmarkAtivo.spread.toFixed(1)}%`,
        unidade: '%',
        tendencia: calcularTendencia(indAtual.spread, indAno1?.spread || null, false),
        peso: pesos.economicos,
      },
    ]
  }, [indAtual, indAno1, indAno2, benchmarkAtivo, pesos])

  const hasHistorico = !!(balancoAno1 || balancoAno2 || dreAno1 || dreAno2)

  // Cores do Radar
  const primaryBrandColor = corPrimaria || '#2563EB'
  const sectorColor = '#94A3B8'

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* 1. Header do Painel com Seletor de Benchmark, Empresa, Ano e Personalizar Relatório */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-lg shadow-md shadow-blue-600/20 shrink-0">
            <Gauge className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-extrabold text-[#0B1F3A] tracking-tight">
                Painel de Indicadores &amp; Benchmarks
              </h1>
              <Badge className="bg-blue-50 text-blue-700 border-blue-200 font-semibold text-xs">
                Diagnóstico 360º
              </Badge>
            </div>
            <p className="text-xs text-[#5B6B7F] mt-0.5">
              Análise comparativa da empresa frente ao benchmark do setor com gráfico de radar e
              histórico de 3 anos
            </p>
          </div>
        </div>

        {/* Controles: Empresa, Ano, Benchmark Setorial, Botão de Pesos */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Seletor Empresa */}
          <div className="flex items-center gap-1.5 bg-[#F5F7FA] border border-slate-200 rounded-lg px-2.5 py-1 text-xs">
            <Building2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <Select value={selectedEmpresaId} onValueChange={(id) => setSelectedEmpresaId(id)}>
              <SelectTrigger className="h-7 border-none shadow-none bg-transparent text-xs font-semibold text-slate-800 p-0 focus:ring-0 w-[150px] sm:w-[180px]">
                <SelectValue placeholder="Selecione a empresa" />
              </SelectTrigger>
              <SelectContent>
                {empresas.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id} className="text-xs">
                    {emp.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Seletor Ano */}
          <div className="flex items-center gap-1.5 bg-[#F5F7FA] border border-slate-200 rounded-lg px-2.5 py-1 text-xs">
            <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <Select
              value={String(selectedAno)}
              onValueChange={(val) => setSelectedAno(Number(val))}
            >
              <SelectTrigger className="h-7 border-none shadow-none bg-transparent text-xs font-semibold text-slate-800 p-0 focus:ring-0 w-[75px]">
                <SelectValue placeholder="Ano" />
              </SelectTrigger>
              <SelectContent>
                {(anosDisponiveis || [selectedAno]).map((ano) => (
                  <SelectItem key={ano} value={String(ano)} className="text-xs">
                    {ano}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Seletor Benchmark Setorial */}
          <div className="flex items-center gap-1.5 bg-blue-50/70 border border-blue-200 rounded-lg px-2.5 py-1 text-xs">
            <Scale className="w-3.5 h-3.5 text-blue-700 shrink-0" />
            <Select
              value={selectedSetorBenchmark}
              onValueChange={(val) => setSelectedSetorBenchmark(val)}
            >
              <SelectTrigger className="h-7 border-none shadow-none bg-transparent text-xs font-bold text-blue-900 p-0 focus:ring-0 w-[130px]">
                <SelectValue placeholder="Setor Benchmark" />
              </SelectTrigger>
              <SelectContent>
                {Object.keys(BENCHMARKS_SETORIAIS).map((setor) => (
                  <SelectItem key={setor} value={setor} className="text-xs font-medium">
                    Setor: {setor}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Botão Personalizar Pesos / Relatório */}
          <Button
            type="button"
            variant="outline"
            onClick={() => setModalPesosOpen(true)}
            className="border-blue-200 text-blue-700 hover:bg-blue-50 font-semibold text-xs h-9 shadow-2xs gap-1.5"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600" />
            <span>Personalizar Relatório</span>
            <Badge className="bg-blue-100 text-blue-800 border-none text-[10px] px-1.5 py-0">
              {PERFIS_PESOS_PREDEFINIDOS[perfilPesos]?.nome || 'Pesos'}
            </Badge>
          </Button>

          {/* Botão Ir para Relatório Executivo */}
          <Button
            asChild
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-9 shadow-xs"
          >
            <Link to="/relatorios">
              <FileText className="w-3.5 h-3.5 mr-1.5" />
              Gerar Relatório Executivo
            </Link>
          </Button>
        </div>
      </div>

      {/* 2. Destaques Executivos dos Principais KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-semibold text-slate-500 uppercase block truncate">
            Ativo Total
          </span>
          <strong className="text-sm sm:text-base font-bold text-slate-900 block mt-0.5">
            {formatBrlMil(destaques.ativoTotal)}
          </strong>
          <span className="text-[10px] text-slate-400 block mt-0.5">Base patrimonial</span>
        </div>

        <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-semibold text-slate-500 uppercase block truncate">
            Patrimônio Líquido
          </span>
          <strong className="text-sm sm:text-base font-bold text-emerald-700 block mt-0.5">
            {formatBrlMil(destaques.patrimonioLiquido)}
          </strong>
          <span className="text-[10px] text-slate-400 block mt-0.5">Recursos próprios</span>
        </div>

        <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-semibold text-slate-500 uppercase block truncate">
            Receita Líquida
          </span>
          <strong className="text-sm sm:text-base font-bold text-slate-900 block mt-0.5">
            {formatBrlMil(destaques.receitaLiquida)}
          </strong>
          <span className="text-[10px] text-slate-400 block mt-0.5">Faturamento líq.</span>
        </div>

        <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-semibold text-slate-500 uppercase block truncate">
            Lucro Líquido
          </span>
          <strong
            className={`text-sm sm:text-base font-bold block mt-0.5 ${
              destaques.lucroLiquido >= 0 ? 'text-emerald-600' : 'text-red-600'
            }`}
          >
            {formatBrlMil(destaques.lucroLiquido)}
          </strong>
          <span className="text-[10px] text-slate-400 block mt-0.5">Resultado final</span>
        </div>

        <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-semibold text-slate-500 uppercase block truncate">
            Liq. Corrente (LC)
          </span>
          <strong className="text-sm sm:text-base font-bold text-blue-700 block mt-0.5">
            {destaques.liquidezCorrente ? formatNumber(destaques.liquidezCorrente, 2) : '—'}
          </strong>
          <span className="text-[10px] text-slate-400 block mt-0.5">
            Ref setor: {benchmarkAtivo?.liquidezCorrente.toFixed(2) || '—'}
          </span>
        </div>

        <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-semibold text-slate-500 uppercase block truncate">
            Score Ponderado
          </span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <strong
              className={`text-sm sm:text-base font-black ${
                scoreGeralPonderado >= 70
                  ? 'text-emerald-600'
                  : scoreGeralPonderado >= 50
                    ? 'text-blue-600'
                    : 'text-amber-600'
              }`}
            >
              {scoreGeralPonderado}/100
            </strong>
            <Badge className="bg-slate-100 text-slate-700 text-[10px] px-1 py-0 border-none font-semibold">
              {scoreGeralPonderado >= 70
                ? 'Forte'
                : scoreGeralPonderado >= 50
                  ? 'Médio'
                  : 'Atenção'}
            </Badge>
          </div>
          <span className="text-[10px] text-slate-400 block mt-0.5">
            Perfil: {PERFIS_PESOS_PREDEFINIDOS[perfilPesos]?.nome}
          </span>
        </div>
      </div>

      {/* 3. GRÁFICO DE RADAR (TEIA) COMPARATIVO VS BENCHMARK */}
      <Card className="bg-white border-slate-200 shadow-2xs overflow-hidden">
        <CardHeader className="pb-2 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-blue-50 text-blue-700 rounded-lg">
                <Activity className="w-4 h-4" />
              </div>
              <CardTitle className="text-base font-bold text-[#0B1F3A]">
                Gráfico de Radar: Desempenho Global vs Benchmark Setorial ({selectedSetorBenchmark})
              </CardTitle>
            </div>
            <CardDescription className="text-xs text-slate-500 mt-0.5">
              Normalização em escala 0-100 para comparação equilibrada entre grupos de naturezas
              distintas
            </CardDescription>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs font-semibold">
              <span className="flex items-center gap-1.5 text-blue-700">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: primaryBrandColor }}
                />
                Empresa ({selectedEmpresa?.nome || 'Atual'})
              </span>
              <span className="flex items-center gap-1.5 text-slate-500 ml-2">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: sectorColor }} />
                Setor ({selectedSetorBenchmark})
              </span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-6">
          {!selectedSetorBenchmark ? (
            <div className="py-16 text-center text-xs text-slate-500 flex flex-col items-center justify-center gap-2">
              <AlertCircle className="w-8 h-8 text-amber-500" />
              <p className="font-semibold text-slate-700">
                Selecione um setor no benchmark para ativar o gráfico comparativo
              </p>
            </div>
          ) : !balancoAtual && !dreAtual ? (
            <div className="py-16 text-center text-xs text-slate-500 flex flex-col items-center justify-center gap-2">
              <AlertCircle className="w-8 h-8 text-amber-500" />
              <p className="font-semibold text-slate-700">
                Nenhum dado financeiro cadastrado para a empresa no exercício de {selectedAno}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              {/* Radar Chart Recharts */}
              <div className="lg:col-span-7 h-80 sm:h-96 w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart
                    cx="50%"
                    cy="50%"
                    outerRadius="75%"
                    data={radarItems}
                    margin={{ top: 10, right: 30, left: 30, bottom: 10 }}
                  >
                    <PolarGrid stroke="#E2E8F0" />
                    <PolarAngleAxis
                      dataKey="grupoNome"
                      tick={{
                        fill: '#0B1F3A',
                        fontSize: 11,
                        fontWeight: 700,
                      }}
                    />
                    <PolarRadiusAxis
                      angle={30}
                      domain={[0, 100]}
                      tick={{ fill: '#64748B', fontSize: 10 }}
                      stroke="#E2E8F0"
                    />
                    <RechartsTooltip
                      content={({ active, payload }) => {
                        if (!active || !payload || !payload.length) return null
                        const item = payload[0].payload as GrupoRadarItem
                        return (
                          <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl text-xs space-y-1.5 border border-slate-700">
                            <strong className="block font-bold text-sm text-blue-300 border-b border-slate-700 pb-1">
                              {item.grupoNome}
                            </strong>
                            <div className="flex justify-between gap-4">
                              <span className="text-slate-300">Empresa (Score):</span>
                              <strong className="text-white font-mono">
                                {item.empresaScore}/100
                              </strong>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span className="text-slate-400">Valor Real:</span>
                              <span className="text-blue-200 font-mono font-semibold">
                                {item.empresaValorRealStr}
                              </span>
                            </div>
                            <div className="flex justify-between gap-4 pt-1 border-t border-slate-800">
                              <span className="text-slate-400">Setor (Score):</span>
                              <strong className="text-slate-300 font-mono">
                                {item.setorScore}/100
                              </strong>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span className="text-slate-400">Benchmark Setor:</span>
                              <span className="text-slate-300 font-mono">
                                {item.setorValorRealStr}
                              </span>
                            </div>
                          </div>
                        )
                      }}
                    />
                    <Radar
                      name="Setor"
                      dataKey="setorScore"
                      stroke={sectorColor}
                      fill={sectorColor}
                      fillOpacity={0.25}
                      strokeWidth={1.5}
                      strokeDasharray="4 4"
                    />
                    <Radar
                      name="Empresa"
                      dataKey="empresaScore"
                      stroke={primaryBrandColor}
                      fill={primaryBrandColor}
                      fillOpacity={0.45}
                      strokeWidth={2.5}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              {/* Tabela Resumo dos Eixos do Radar ao Lado */}
              <div className="lg:col-span-5 space-y-2.5">
                <div className="flex items-center justify-between pb-1 border-b border-slate-200">
                  <span className="text-xs font-bold text-[#0B1F3A] uppercase tracking-wider">
                    Detalhamento dos 6 Eixos do Radar
                  </span>
                  <span className="text-[11px] text-slate-500">Normalizado (0-100)</span>
                </div>

                <div className="space-y-2">
                  {radarItems.map((item) => {
                    const pesoGrupo = pesos[item.grupoId] || 0
                    return (
                      <div
                        key={item.grupoId}
                        className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/60 hover:bg-white transition-all space-y-1"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-800">{item.grupoNome}</span>
                            <Badge className="bg-slate-200 text-slate-700 text-[9px] px-1 py-0 border-none font-mono">
                              Peso {pesoGrupo}%
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-slate-900">
                              {item.empresaScore} vs {item.setorScore}
                            </span>
                            {item.status === 'acima' && (
                              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] px-1.5 py-0 font-bold">
                                ↑ Acima
                              </Badge>
                            )}
                            {item.status === 'abaixo' && (
                              <Badge className="bg-red-50 text-red-700 border-red-200 text-[10px] px-1.5 py-0 font-bold">
                                ↓ Abaixo
                              </Badge>
                            )}
                            {item.status === 'em_linha' && (
                              <Badge className="bg-slate-100 text-slate-600 border-slate-200 text-[10px] px-1.5 py-0">
                                → Em linha
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Barra comparativa de progresso */}
                        <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden flex">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${item.empresaScore}%`,
                              backgroundColor:
                                item.empresaScore >= item.setorScore
                                  ? '#10B981'
                                  : item.empresaScore >= item.setorScore - 15
                                    ? '#F59E0B'
                                    : '#EF4444',
                            }}
                          />
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
                          <span>
                            Empresa:{' '}
                            <strong className="text-slate-700">{item.empresaValorRealStr}</strong>
                          </span>
                          <span>
                            Setor:{' '}
                            <strong className="text-slate-600">{item.setorValorRealStr}</strong>
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 4. SEÇÃO: HISTÓRICO DE BENCHMARKS (3 ANOS) COM TOGGLE */}
      <Card className="bg-white border-slate-200 shadow-2xs">
        <CardHeader className="pb-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-blue-50 text-blue-700 rounded-lg">
                <Clock className="w-4 h-4" />
              </div>
              <CardTitle className="text-base font-bold text-[#0B1F3A]">
                Evolução vs Setor ({selectedAno - 2}, {selectedAno - 1}, {selectedAno})
              </CardTitle>
            </div>
            <CardDescription className="text-xs text-slate-500 mt-0.5">
              Comparativo temporal com badges de tendência e metas de mercado
            </CardDescription>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg">
              <Switch id="evolucao-toggle" checked={verEvolucao} onCheckedChange={setVerEvolucao} />
              <Label
                htmlFor="evolucao-toggle"
                className="text-xs font-bold text-slate-700 cursor-pointer"
              >
                Ver evolução (3 anos)
              </Label>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {!hasHistorico ? (
            <div className="p-8 text-center text-xs text-slate-500 flex flex-col items-center justify-center gap-2">
              <Info className="w-6 h-6 text-slate-400" />
              <p className="font-semibold text-slate-700">
                Dados insuficientes para análise histórica completa
              </p>
              <p className="text-[11px] text-slate-500 max-w-md">
                A empresa possui apenas registros para o exercício corrente. Para ativar a visão de
                tendência temporal completa, cadastre ou importe balanços dos anos {ano1} e {ano2}.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 font-bold text-slate-700 border-b border-slate-200 text-[11px]">
                    <th className="py-2.5 px-3">Grupo</th>
                    <th className="py-2.5 px-3">Indicador</th>
                    <th className="py-2.5 px-3 text-right">{ano2}</th>
                    <th className="py-2.5 px-3 text-right">{ano1}</th>
                    <th className="py-2.5 px-3 text-right bg-blue-50/50 text-blue-900">
                      {selectedAno} (Atual)
                    </th>
                    <th className="py-2.5 px-3 text-right bg-slate-100/70 text-slate-800">
                      Benchmark Setor
                    </th>
                    <th className="py-2.5 px-3 text-center">Tendência</th>
                    <th className="py-2.5 px-3 text-center">Página</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-[11px]">
                  {linhasEvolucao.map((linha, idx) => {
                    const isHighWeight = linha.peso >= 25
                    return (
                      <tr
                        key={idx}
                        className={`hover:bg-slate-50/80 transition-colors ${
                          isHighWeight ? 'bg-amber-50/20 font-medium' : ''
                        }`}
                      >
                        <td className="py-2 px-3 text-slate-500">
                          <span className="font-semibold text-slate-700">{linha.grupo}</span>
                          {isHighWeight && (
                            <Badge className="ml-1.5 bg-blue-100 text-blue-800 text-[9px] px-1 py-0 border-none font-bold">
                              ★ Peso {linha.peso}%
                            </Badge>
                          )}
                        </td>
                        <td
                          className={`py-2 px-3 ${isHighWeight ? 'font-bold text-slate-900' : 'text-slate-800'}`}
                        >
                          {linha.indicador}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-slate-600">
                          {linha.ano2}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-slate-600">
                          {linha.ano1}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold bg-blue-50/40 text-blue-900">
                          {linha.anoAtual}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-semibold bg-slate-100/50 text-slate-700">
                          {linha.setor}
                        </td>
                        <td className="py-2 px-3 text-center">
                          {linha.tendencia.icon === 'up' && (
                            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] gap-1 px-1.5 py-0 font-bold">
                              <TrendingUp className="w-3 h-3 text-emerald-600" />↑ Melhora
                            </Badge>
                          )}
                          {linha.tendencia.icon === 'down' && (
                            <Badge className="bg-red-50 text-red-700 border-red-200 text-[10px] gap-1 px-1.5 py-0 font-bold">
                              <TrendingDown className="w-3 h-3 text-red-600" />↓ Piora
                            </Badge>
                          )}
                          {linha.tendencia.icon === 'stable' && (
                            <Badge className="bg-slate-100 text-slate-600 border-slate-200 text-[10px] gap-1 px-1.5 py-0">
                              <Minus className="w-3 h-3" />→ Estável
                            </Badge>
                          )}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <Button
                            asChild
                            variant="ghost"
                            size="sm"
                            className="h-6 text-[10px] text-blue-600 hover:text-blue-800 px-2"
                          >
                            <Link to={linha.link}>
                              Ver <ArrowRight className="w-3 h-3 ml-0.5" />
                            </Link>
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

      {/* 5. CARDS DE ACESSO RÁPIDO ÀS 7 PÁGINAS DE INDICADORES */}
      <div className="space-y-3">
        <div className="flex items-center justify-between pb-1 border-b border-slate-200">
          <div>
            <h3 className="text-sm font-bold text-[#0B1F3A] uppercase tracking-wider">
              Módulos Específicos de Análise por Grupo
            </h3>
            <p className="text-xs text-slate-500">
              Navegue para o detalhamento profundo de fórmulas, variáveis contábeis e gráficos por
              grupo
            </p>
          </div>
          <Badge className="bg-slate-100 text-slate-700 font-bold text-xs">
            7 Módulos Disponíveis
          </Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[
            {
              title: 'Indicadores de Liquidez',
              desc: 'Capacidade de pagamento no curto e longo prazo (LC, LS, LI, LG)',
              path: '/indicadores/liquidez',
              icon: Activity,
              badge: 'Solvência',
              color: 'text-blue-600 bg-blue-50',
              destaque: `LC: ${indAtual.lc ? indAtual.lc.toFixed(2) : '—'}`,
            },
            {
              title: 'Indicadores de Endividamento',
              desc: 'Perfil e proporção das dívidas com terceiros (EG, CE, PCT, IPL)',
              path: '/indicadores/endividamento',
              icon: TrendingDown,
              badge: 'Estrutura',
              color: 'text-amber-600 bg-amber-50',
              destaque: `End. Geral: ${indAtual.eg ? `${indAtual.eg.toFixed(1)}%` : '—'}`,
            },
            {
              title: 'Indicadores de Rentabilidade',
              desc: 'Retorno sobre o patrimônio, ativo e margens (ROE, ROA, Margem Líquida)',
              path: '/indicadores/rentabilidade',
              icon: TrendingUp,
              badge: 'Retorno',
              color: 'text-emerald-600 bg-emerald-50',
              destaque: `ROE: ${indAtual.roe ? `${indAtual.roe.toFixed(1)}%` : '—'}`,
            },
            {
              title: 'Estrutura de Capital',
              desc: 'Autonomia patrimonial, dependência financeira e relação D/E',
              path: '/indicadores/estrutura-capital',
              icon: Building2,
              badge: 'Solidez',
              color: 'text-indigo-600 bg-indigo-50',
              destaque: `Autonomia: ${indAtual.af ? `${indAtual.af.toFixed(1)}%` : '—'}`,
            },
            {
              title: 'EBITDA (LAJIDA)',
              desc: 'Potencial de geração operacional bruta de caixa e cobertura de juros',
              path: '/indicadores/ebitda',
              icon: Sparkles,
              badge: 'Caixa Operacional',
              color: 'text-purple-600 bg-purple-50',
              destaque: `Margem EBITDA: ${indAtual.margemEbitda ? `${indAtual.margemEbitda.toFixed(1)}%` : '—'}`,
            },
            {
              title: 'Eficiência Operacional',
              desc: 'Prazos médios (PME, PMR, PMP) e Ciclos Operacional e Financeiro',
              path: '/indicadores/eficiencia-operacional',
              icon: Clock,
              badge: 'Giro & Prazos',
              color: 'text-cyan-600 bg-cyan-50',
              destaque: `Ciclo Fin: ${indAtual.cf !== null ? `${Math.round(indAtual.cf)}d` : '—'}`,
            },
            {
              title: 'Econômicos (Avançado)',
              desc: 'Criação de valor econômico (EVA), NOPAT, ROIC e Modelo DuPont',
              path: '/indicadores/economicos',
              icon: Scale,
              badge: 'Geração de Valor',
              color: 'text-rose-600 bg-rose-50',
              destaque: `Spread: ${indAtual.spread !== null ? `${indAtual.spread.toFixed(1)}%` : '—'}`,
            },
          ].map((item, i) => {
            const Icon = item.icon
            return (
              <Card
                key={i}
                className="bg-white border-slate-200 shadow-2xs hover:shadow-md hover:border-blue-300 transition-all flex flex-col justify-between"
              >
                <CardHeader className="p-4 pb-2 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className={`p-2 rounded-xl ${item.color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <Badge className="bg-slate-100 text-slate-700 text-[10px] font-semibold border-slate-200">
                      {item.badge}
                    </Badge>
                  </div>
                  <div>
                    <CardTitle className="text-sm font-bold text-[#0B1F3A]">{item.title}</CardTitle>
                    <CardDescription className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                      {item.desc}
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-2 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-slate-700">
                    {item.destaque}
                  </span>
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs border-blue-200 text-blue-700 hover:bg-blue-50"
                  >
                    <Link to={item.path}>
                      Acessar <ArrowRight className="w-3 h-3 ml-1" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Modal de Personalização de Pesos */}
      <ModalPesosRelatorio
        open={modalPesosOpen}
        onOpenChange={setModalPesosOpen}
        perfilAtual={perfilPesos}
        pesosAtuais={pesos}
        onSalvar={handleSalvarPesos}
      />
    </div>
  )
}
