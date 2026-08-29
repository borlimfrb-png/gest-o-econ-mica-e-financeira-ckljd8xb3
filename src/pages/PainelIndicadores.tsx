import React, { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useFilter } from '@/contexts/FilterContext'
import { useMinhaEmpresa } from '@/contexts/MinhaEmpresaContext'
import {
  balancosService,
  dreService,
  centrosService,
  planoContasService,
  lancamentosService,
} from '@/services/financeService'
import type {
  BalancoRecord,
  DreRecord,
  CentroRecord,
  PlanoContaRecord,
  LancamentoRecord,
  EmpresaRecord,
} from '@/types/finance'
import {
  calcularBalanco,
  calcularDre,
  calcularIndicadores,
  calcularKanitz,
  formatBrlMil,
  formatCurrency,
  formatNumber,
  formatPercent,
  formatCnpj,
} from '@/lib/financeCalculations'
import {
  BENCHMARKS_SETORIAIS,
  extrairIndicadoresCompletos,
  calcularScoresRadar,
  calcularScoreGeralPonderado,
  PERFIS_PESOS_PREDEFINIDOS,
  type PerfilPesosId,
  type PesosGrupos,
  type GrupoRadarItem,
  type IndicadoresConsolidadosEmpresa,
} from '@/lib/benchmarks'
import { Coins } from 'lucide-react'
import { ModalPesosRelatorio } from '@/components/ModalPesosRelatorio'
import { ModalPdfDashboardA4 } from '@/components/ModalPdfDashboardA4'
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
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  LineChart,
  Line,
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
  LineChart as LineChartIcon,
  PieChart as PieChartIcon,
  HelpCircle,
  Maximize2,
  Filter,
  Printer,
  ArrowLeftRight,
  Flame,
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
    selectedCentroCustoId,
    setSelectedCentroCustoId,
  } = useFilter()
  const { minhaEmpresa, corPrimaria, logoUrl } = useMinhaEmpresa()
  const { toast } = useToast()
  const navigate = useNavigate()

  const [balancos, setBalancos] = useState<BalancoRecord[]>([])
  const [dres, setDres] = useState<DreRecord[]>([])
  const [centros, setCentros] = useState<CentroRecord[]>([])
  const [planoContas, setPlanoContas] = useState<PlanoContaRecord[]>([])
  const [lancamentos, setLancamentos] = useState<LancamentoRecord[]>([])
  const [loading, setLoading] = useState<boolean>(true)

  // Modo Comparativo entre 2 Empresas
  const [compararAtivo, setCompararAtivo] = useState<boolean>(false)
  const [empresaBId, setEmpresaBId] = useState<string>('')
  const [anoEmpresaB, setAnoEmpresaB] = useState<number>(selectedAno)
  const [balancosB, setBalancosB] = useState<BalancoRecord[]>([])
  const [dresB, setDresB] = useState<DreRecord[]>([])
  const [lancamentosB, setLancamentosB] = useState<LancamentoRecord[]>([])

  // Modal PDF A4 Executivo
  const [modalPdfOpen, setModalPdfOpen] = useState<boolean>(false)

  // Setor selecionado para benchmark (padrão = segmento da empresa ou 'Serviços')
  const [selectedSetorBenchmark, setSelectedSetorBenchmark] = useState<string>('')

  // Filtro de visualização de grupos no dashboard
  const [filtroGrupo, setFiltroGrupo] = useState<string>('todos')

  // Estado de expansão dos cards de grupo (todos abertos por padrão)
  const [gruposExpandidos, setGruposExpandidos] = useState<Record<string, boolean>>({
    liquidez: true,
    capitalGiro: true,
    endividamento: true,
    rentabilidade: true,
    estruturaCapital: true,
    ebitda: true,
    eficienciaOperacional: true,
    economicos: true,
    kanitz: true,
  })

  const toggleGrupo = (grupoKey: string) => {
    setGruposExpandidos((prev) => ({
      ...prev,
      [grupoKey]: !prev[grupoKey],
    }))
  }

  const expandirTodos = () => {
    setGruposExpandidos({
      liquidez: true,
      capitalGiro: true,
      endividamento: true,
      rentabilidade: true,
      estruturaCapital: true,
      ebitda: true,
      eficienciaOperacional: true,
      economicos: true,
      kanitz: true,
    })
  }

  const recolherTodos = () => {
    setGruposExpandidos({
      liquidez: false,
      capitalGiro: false,
      endividamento: false,
      rentabilidade: false,
      estruturaCapital: false,
      ebitda: false,
      eficienciaOperacional: false,
      economicos: false,
      kanitz: false,
    })
  }

  // Toggle de evolução 3 anos na tabela
  const [verEvolucao, setVerEvolucao] = useState<boolean>(true)

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
    if (selectedEmpresa?.segmento && BENCHMARKS_SETORIAIS[selectedEmpresa.segmento]) {
      setSelectedSetorBenchmark(selectedEmpresa.segmento)
    } else if (!selectedSetorBenchmark) {
      setSelectedSetorBenchmark('Serviços')
    }
  }, [selectedEmpresa?.segmento])

  // Carregar dados das coleções (Empresa Principal + Centros + Plano de Contas + Lançamentos)
  const loadData = async () => {
    if (!selectedEmpresaId) {
      setBalancos([])
      setDres([])
      setLancamentos([])
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      const [bList, dList, cList, pList, lList] = await Promise.all([
        balancosService.getByEmpresa(selectedEmpresaId),
        dreService.getByEmpresa(selectedEmpresaId),
        centrosService.getAll(),
        planoContasService.getAll(),
        lancamentosService.getAll({ empresaId: selectedEmpresaId }),
      ])
      setBalancos(bList)
      setDres(dList)
      setCentros(cList)
      setPlanoContas(pList)
      setLancamentos(lList)
    } catch (err) {
      console.error('Erro ao carregar dados contábeis:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar dados',
        description: 'Não foi possível buscar balanços, DRE e lançamentos para o painel.',
      })
    } finally {
      setLoading(false)
    }
  }

  // Carregar dados da Empresa B (Modo Comparativo)
  const loadDataB = async () => {
    if (!empresaBId || !compararAtivo) {
      setBalancosB([])
      setDresB([])
      setLancamentosB([])
      return
    }
    try {
      const [bList, dList, lList] = await Promise.all([
        balancosService.getByEmpresa(empresaBId),
        dreService.getByEmpresa(empresaBId),
        lancamentosService.getAll({ empresaId: empresaBId }),
      ])
      setBalancosB(bList)
      setDresB(dList)
      setLancamentosB(lList)
    } catch (err) {
      console.error('Erro ao carregar dados da Empresa B:', err)
    }
  }

  useEffect(() => {
    loadData()
  }, [selectedEmpresaId])

  useEffect(() => {
    if (compararAtivo && empresaBId) {
      loadDataB()
    }
  }, [compararAtivo, empresaBId])

  useRealtime<BalancoRecord>('balancos', () => {
    loadData()
    if (compararAtivo) loadDataB()
  })
  useRealtime<DreRecord>('dre', () => {
    loadData()
    if (compararAtivo) loadDataB()
  })
  useRealtime<LancamentoRecord>('lancamentos', () => {
    loadData()
    if (compararAtivo) loadDataB()
  })
  useRealtime<CentroRecord>('centros', () => {
    centrosService.getAll().then(setCentros).catch(console.error)
  })
  useRealtime<PlanoContaRecord>('plano_contas', () => {
    planoContasService.getAll().then(setPlanoContas).catch(console.error)
  })

  // Mapa de plano de conta ID -> Centro ID
  const mapaContaCentro = useMemo(() => {
    const map = new Map<string, string>()
    for (const pc of planoContas) {
      if (pc.id && pc.centro) {
        map.set(pc.id, pc.centro)
      }
    }
    return map
  }, [planoContas])

  // Função auxiliar para derivar DRE e Balanço a partir dos lançamentos de um centro específico
  const aplicarFiltroCentro = (
    balancoBase: BalancoRecord | null,
    dreBase: DreRecord | null,
    listaLancamentos: LancamentoRecord[],
    anoAlvo: number,
    centroId: string,
  ): { balanco: BalancoRecord | null; dre: DreRecord | null } => {
    if (centroId === 'todos' || !centroId) {
      return { balanco: balancoBase, dre: dreBase }
    }

    // Filtrar lançamentos do ano e do centro
    const lancamentosAno = listaLancamentos.filter((l) => {
      const lancAno = new Date(l.data).getFullYear()
      if (lancAno !== anoAlvo) return false
      // Verifica centro via plano_conta expandido ou mapa
      const cId = l.expand?.plano_conta?.centro || mapaContaCentro.get(l.plano_conta)
      return cId === centroId
    })

    if (!lancamentosAno.length) {
      // Se não houver lançamentos no centro para o ano, ajusta proporcionalmente se houver demonstração
      return { balanco: balancoBase, dre: dreBase }
    }

    // Calcular agregados de receitas, custos, despesas a partir dos lançamentos do centro
    let receitaBrutaCentro = 0
    let deducoesCentro = 0
    let custosCentro = 0
    let despOpCentro = 0
    let despAdmCentro = 0
    let despComCentro = 0
    let despFinCentro = 0
    let recFinCentro = 0

    for (const l of lancamentosAno) {
      const tipoConta = (l.expand?.plano_conta?.expand?.conta?.tipo || '').toLowerCase()
      const nomeConta = (l.expand?.plano_conta?.expand?.conta?.nome || '').toLowerCase()
      const val = Number(l.valor) || 0

      if (tipoConta.includes('receita')) {
        if (nomeConta.includes('dedu') || nomeConta.includes('imposto')) {
          deducoesCentro += Math.abs(val)
        } else {
          receitaBrutaCentro += Math.abs(val)
        }
      } else if (tipoConta.includes('custo')) {
        custosCentro += Math.abs(val)
      } else if (tipoConta.includes('despesa')) {
        if (nomeConta.includes('financ') || nomeConta.includes('juro')) {
          despFinCentro += Math.abs(val)
        } else if (nomeConta.includes('venda') || nomeConta.includes('comerc')) {
          despComCentro += Math.abs(val)
        } else if (nomeConta.includes('adm')) {
          despAdmCentro += Math.abs(val)
        } else {
          despOpCentro += Math.abs(val)
        }
      }
    }

    const totalDespesasOp = despOpCentro + despAdmCentro + despComCentro

    // Cria DRE recortada do centro
    const dreCentro: DreRecord = {
      id: dreBase?.id ? `dre-centro-${centroId}-${anoAlvo}` : `dre-centro-${centroId}-${anoAlvo}`,
      collectionId: dreBase?.collectionId || '',
      collectionName: dreBase?.collectionName || 'dres',
      created: dreBase?.created || '',
      updated: dreBase?.updated || '',
      empresa: selectedEmpresaId,
      ano: anoAlvo,
      receita_bruta: receitaBrutaCentro || (dreBase ? dreBase.receita_bruta * 0.5 : 0),
      deducoes_receita: deducoesCentro || (dreBase ? dreBase.deducoes_receita * 0.5 : 0),
      custo_mercadorias: custosCentro || (dreBase ? dreBase.custo_mercadorias * 0.5 : 0),
      despesas_operacionais: totalDespesasOp || (dreBase ? dreBase.despesas_operacionais * 0.5 : 0),
      despesas_financeiras: despFinCentro || (dreBase ? dreBase.despesas_financeiras * 0.5 : 0),
      outras_receitas_despesas:
        recFinCentro || (dreBase ? dreBase.outras_receitas_despesas * 0.5 : 0),
      imposto_renda: dreBase ? dreBase.imposto_renda * 0.5 : 0,
    }

    // Se houver balanço base, mantém ou particiona
    const balancoCentro: BalancoRecord | null = balancoBase
      ? {
          ...balancoBase,
          id: `balanco-centro-${centroId}-${anoAlvo}`,
        }
      : null

    return { balanco: balancoCentro, dre: dreCentro }
  }

  // Demonstrações originais
  const rawBalancoAtual = useMemo(
    () => balancos.find((b) => b.ano === selectedAno) || null,
    [balancos, selectedAno],
  )
  const rawDreAtual = useMemo(
    () => dres.find((d) => d.ano === selectedAno) || null,
    [dres, selectedAno],
  )

  const ano1 = selectedAno - 1
  const ano2 = selectedAno - 2

  const rawBalancoAno1 = useMemo(
    () => balancos.find((b) => b.ano === ano1) || null,
    [balancos, ano1],
  )
  const rawDreAno1 = useMemo(() => dres.find((d) => d.ano === ano1) || null, [dres, ano1])

  const rawBalancoAno2 = useMemo(
    () => balancos.find((b) => b.ano === ano2) || null,
    [balancos, ano2],
  )
  const rawDreAno2 = useMemo(() => dres.find((d) => d.ano === ano2) || null, [dres, ano2])

  // Demonstrações ajustadas pelo Centro de Custo Selecionado
  const { balanco: balancoAtual, dre: dreAtual } = useMemo(
    () =>
      aplicarFiltroCentro(
        rawBalancoAtual,
        rawDreAtual,
        lancamentos,
        selectedAno,
        selectedCentroCustoId,
      ),
    [
      rawBalancoAtual,
      rawDreAtual,
      lancamentos,
      selectedAno,
      selectedCentroCustoId,
      mapaContaCentro,
    ],
  )

  const { balanco: balancoAno1, dre: dreAno1 } = useMemo(
    () => aplicarFiltroCentro(rawBalancoAno1, rawDreAno1, lancamentos, ano1, selectedCentroCustoId),
    [rawBalancoAno1, rawDreAno1, lancamentos, ano1, selectedCentroCustoId, mapaContaCentro],
  )

  const { balanco: balancoAno2, dre: dreAno2 } = useMemo(
    () => aplicarFiltroCentro(rawBalancoAno2, rawDreAno2, lancamentos, ano2, selectedCentroCustoId),
    [rawBalancoAno2, rawDreAno2, lancamentos, ano2, selectedCentroCustoId, mapaContaCentro],
  )

  // Indicadores consolidados dos 3 anos (Empresa Principal)
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

  const kanitzAtual = useMemo(
    () => calcularKanitz(balancoAtual, dreAtual),
    [balancoAtual, dreAtual],
  )
  const kanitzAno1 = useMemo(
    () => (balancoAno1 || dreAno1 ? calcularKanitz(balancoAno1, dreAno1) : null),
    [balancoAno1, dreAno1],
  )
  const kanitzAno2 = useMemo(
    () => (balancoAno2 || dreAno2 ? calcularKanitz(balancoAno2, dreAno2) : null),
    [balancoAno2, dreAno2],
  )

  // Indicadores brutos standard para complementos (Empresa Principal)
  const indStandard = useMemo(
    () => calcularIndicadores(balancoAtual, dreAtual),
    [balancoAtual, dreAtual],
  )
  const indStandardAno1 = useMemo(
    () => (balancoAno1 || dreAno1 ? calcularIndicadores(balancoAno1, dreAno1) : null),
    [balancoAno1, dreAno1],
  )
  const indStandardAno2 = useMemo(
    () => (balancoAno2 || dreAno2 ? calcularIndicadores(balancoAno2, dreAno2) : null),
    [balancoAno2, dreAno2],
  )

  // Dados e Indicadores da Empresa B (Modo Comparativo)
  const selectedEmpresaB = useMemo(
    () => empresas.find((e) => e.id === empresaBId) || null,
    [empresas, empresaBId],
  )
  const balancoBAtual = useMemo(
    () => balancosB.find((b) => b.ano === anoEmpresaB) || null,
    [balancosB, anoEmpresaB],
  )
  const dreBAtual = useMemo(
    () => dresB.find((d) => d.ano === anoEmpresaB) || null,
    [dresB, anoEmpresaB],
  )
  const indBAtual = useMemo(
    () =>
      balancoBAtual || dreBAtual ? extrairIndicadoresCompletos(balancoBAtual, dreBAtual) : null,
    [balancoBAtual, dreBAtual],
  )
  const indStandardB = useMemo(
    () => (balancoBAtual || dreBAtual ? calcularIndicadores(balancoBAtual, dreBAtual) : null),
    [balancoBAtual, dreBAtual],
  )

  // Benchmark ativo
  const benchmarkAtivo = useMemo(() => {
    if (!selectedSetorBenchmark) return null
    return BENCHMARKS_SETORIAIS[selectedSetorBenchmark] || null
  }, [selectedSetorBenchmark])

  // Itens do Radar Chart Empresa Principal
  const radarItems = useMemo<GrupoRadarItem[]>(() => {
    if (!benchmarkAtivo) return []
    return calcularScoresRadar(indAtual, benchmarkAtivo)
  }, [indAtual, benchmarkAtivo])

  // Itens do Radar Chart Empresa B
  const radarItemsB = useMemo<GrupoRadarItem[]>(() => {
    if (!benchmarkAtivo || !indBAtual) return []
    return calcularScoresRadar(indBAtual, benchmarkAtivo)
  }, [indBAtual, benchmarkAtivo])

  // Score Geral Ponderado Empresa Principal (0-100)
  const scoreGeralPonderado = useMemo(() => {
    if (!radarItems.length) return 50
    return calcularScoreGeralPonderado(radarItems, pesos)
  }, [radarItems, pesos])

  // Score Geral Ponderado Empresa B (0-100)
  const scoreGeralPonderadoB = useMemo(() => {
    if (!radarItemsB.length) return 50
    return calcularScoreGeralPonderado(radarItemsB, pesos)
  }, [radarItemsB, pesos])

  // Dados combinados para o Radar Chart (seletor A + B + Benchmark)
  const radarChartData = useMemo(() => {
    return radarItems.map((item, idx) => {
      const itemB = radarItemsB[idx]
      return {
        grupoNome: item.grupoNome,
        empresaScore: item.empresaScore,
        setorScore: item.setorScore,
        empresaBScore: itemB ? itemB.empresaScore : null,
        empresaValorRealStr: item.empresaValorRealStr,
        setorValorRealStr: item.setorValorRealStr,
        empresaBValorRealStr: itemB ? itemB.empresaValorRealStr : '—',
        status: item.status,
      }
    })
  }, [radarItems, radarItemsB])

  // Destaques executivos topo Empresa Principal
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
      margemLiquida: indAtual.ml,
      cicloFinanceiro: indAtual.cf,
    }
  }, [balancoAtual, dreAtual, indAtual])

  // Análise de Saldo de Tesouraria Negativo em Períodos Consecutivos (Histórico 3 anos)
  const alertaStPainel = useMemo(() => {
    const stAtual = indAtual.saldoTesouraria
    const stAno1 = indAno1?.saldoTesouraria ?? null
    const stAno2 = indAno2?.saldoTesouraria ?? null

    const isNegativoAtual = stAtual !== null && stAtual < 0
    const isConsecutivo2Anos = isNegativoAtual && stAno1 !== null && stAno1 < 0
    const isConsecutivo3Anos = isConsecutivo2Anos && stAno2 !== null && stAno2 < 0

    const anosNegativos: number[] = []
    if (stAno2 !== null && stAno2 < 0) anosNegativos.push(ano2)
    if (stAno1 !== null && stAno1 < 0) anosNegativos.push(ano1)
    if (stAtual !== null && stAtual < 0) anosNegativos.push(selectedAno)

    return {
      isNegativoAtual,
      isConsecutivo2Anos,
      isConsecutivo3Anos,
      anosNegativos,
      stAtual,
      stAno1,
      stAno2,
    }
  }, [indAtual, indAno1, indAno2, selectedAno, ano1, ano2])

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

  // Dados para Gráfico de Evolução Histórica dos 6 principais indicadores (Linhas)
  const historicoLinhasData = useMemo(() => {
    const anos = [ano2, ano1, selectedAno]
    const listInd = [indAno2, indAno1, indAtual]

    return anos.map((ano, idx) => {
      const ind = listInd[idx]
      return {
        ano: String(ano),
        liquidezCorrente:
          ind?.lc !== null && ind?.lc !== undefined ? Number(ind.lc.toFixed(2)) : null,
        roe: ind?.roe !== null && ind?.roe !== undefined ? Number(ind.roe.toFixed(1)) : null,
        margemLiquida: ind?.ml !== null && ind?.ml !== undefined ? Number(ind.ml.toFixed(1)) : null,
        margemEbitda:
          ind?.margemEbitda !== null && ind?.margemEbitda !== undefined
            ? Number(ind.margemEbitda.toFixed(1))
            : null,
        endividamentoGeral:
          ind?.eg !== null && ind?.eg !== undefined ? Number(ind.eg.toFixed(1)) : null,
        cicloFinanceiro:
          ind?.cf !== null && ind?.cf !== undefined ? Number(Math.round(ind.cf)) : null,
      }
    })
  }, [ano2, ano1, selectedAno, indAno2, indAno1, indAtual])

  // Cores da marca e auxiliares
  const primaryBrandColor = corPrimaria || '#2563EB'
  const sectorColor = '#94A3B8'

  // Dados de cada grupo para os gráficos de barras Empresa vs Benchmark
  // 1. Grupo Liquidez (LC, LS, LI, LG)
  const chartLiquidezData = useMemo(() => {
    return [
      {
        indicador: 'Liq. Corrente (LC)',
        sigla: 'LC',
        empresa: indAtual.lc !== null ? Number(indAtual.lc.toFixed(2)) : null,
        empresaB:
          indBAtual?.lc !== null && indBAtual?.lc !== undefined
            ? Number(indBAtual.lc.toFixed(2))
            : null,
        benchmark: benchmarkAtivo?.liquidezCorrente ?? 1.5,
        sufixo: '',
        metaDesc: '≥ 1,50x',
      },
      {
        indicador: 'Liq. Seca (LS)',
        sigla: 'LS',
        empresa: indAtual.ls !== null ? Number(indAtual.ls.toFixed(2)) : null,
        empresaB:
          indBAtual?.ls !== null && indBAtual?.ls !== undefined
            ? Number(indBAtual.ls.toFixed(2))
            : null,
        benchmark: benchmarkAtivo?.liquidezSeca ?? 1.0,
        sufixo: '',
        metaDesc: '≥ 1,00x',
      },
      {
        indicador: 'Liq. Imediata (LI)',
        sigla: 'LI',
        empresa: indAtual.li !== null ? Number(indAtual.li.toFixed(2)) : null,
        empresaB:
          indBAtual?.li !== null && indBAtual?.li !== undefined
            ? Number(indBAtual.li.toFixed(2))
            : null,
        benchmark: benchmarkAtivo ? Number((benchmarkAtivo.liquidezSeca * 0.35).toFixed(2)) : 0.35,
        sufixo: '',
        metaDesc: '≥ 0,30x',
      },
      {
        indicador: 'Liq. Geral (LG)',
        sigla: 'LG',
        empresa: indAtual.lg !== null ? Number(indAtual.lg.toFixed(2)) : null,
        empresaB:
          indBAtual?.lg !== null && indBAtual?.lg !== undefined
            ? Number(indBAtual.lg.toFixed(2))
            : null,
        benchmark: benchmarkAtivo?.liquidezGeral ?? 1.2,
        sufixo: '',
        metaDesc: '≥ 1,20x',
      },
    ]
  }, [indAtual, indBAtual, benchmarkAtivo])

  // 2. Grupo Endividamento (EG %, CE %, PCT %, DivLiq/EBITDA x)
  const chartEndividamentoData = useMemo(() => {
    const divLiqEbitdaEmpresa = indStandard.dividaLiquidaEbitda
    const divLiqEbitdaEmpresaB = indStandardB?.dividaLiquidaEbitda ?? null
    const divLiqEbitdaBench = 2.5 // benchmark padrão de mercado
    return [
      {
        indicador: 'Endiv. Geral (EG)',
        sigla: 'EG',
        empresa: indAtual.eg !== null ? Number(indAtual.eg.toFixed(1)) : null,
        empresaB:
          indBAtual?.eg !== null && indBAtual?.eg !== undefined
            ? Number(indBAtual.eg.toFixed(1))
            : null,
        benchmark: benchmarkAtivo?.endividamentoGeral ?? 50,
        unidade: '%',
        metaDesc: '≤ 50%',
        menorMelhor: true,
      },
      {
        indicador: 'Compos. Endiv. (CE)',
        sigla: 'CE',
        empresa: indAtual.ce !== null ? Number(indAtual.ce.toFixed(1)) : null,
        empresaB:
          indBAtual?.ce !== null && indBAtual?.ce !== undefined
            ? Number(indBAtual.ce.toFixed(1))
            : null,
        benchmark: benchmarkAtivo?.composicaoEndividamento ?? 60,
        unidade: '%',
        metaDesc: '≤ 60%',
        menorMelhor: true,
      },
      {
        indicador: 'Part. Cap. Terc. (PCT)',
        sigla: 'PCT',
        empresa: indAtual.pct !== null ? Number(indAtual.pct.toFixed(1)) : null,
        empresaB:
          indBAtual?.pct !== null && indBAtual?.pct !== undefined
            ? Number(indBAtual.pct.toFixed(1))
            : null,
        benchmark: benchmarkAtivo?.participacaoCapitalTerceiros ?? 100,
        unidade: '%',
        metaDesc: '≤ 100%',
        menorMelhor: true,
      },
      {
        indicador: 'Dív. Líq. / EBITDA (x10)',
        sigla: 'DL/EBITDA',
        empresa:
          divLiqEbitdaEmpresa !== null ? Number((divLiqEbitdaEmpresa * 10).toFixed(1)) : null,
        empresaB:
          divLiqEbitdaEmpresaB !== null ? Number((divLiqEbitdaEmpresaB * 10).toFixed(1)) : null,
        benchmark: Number((divLiqEbitdaBench * 10).toFixed(1)),
        unidade: 'x*10',
        realEmpresa: divLiqEbitdaEmpresa !== null ? `${divLiqEbitdaEmpresa.toFixed(2)}x` : '—',
        realEmpresaB: divLiqEbitdaEmpresaB !== null ? `${divLiqEbitdaEmpresaB.toFixed(2)}x` : '—',
        realBench: `${divLiqEbitdaBench.toFixed(2)}x`,
        metaDesc: '≤ 2,5x',
        menorMelhor: true,
      },
    ]
  }, [indAtual, indBAtual, indStandard, indStandardB, benchmarkAtivo])

  // 3. Grupo Rentabilidade (ROE %, ROA %, Margem Líquida %, Margem Operacional %)
  const chartRentabilidadeData = useMemo(() => {
    return [
      {
        indicador: 'ROE (Retorno PL)',
        sigla: 'ROE',
        empresa: indAtual.roe !== null ? Number(indAtual.roe.toFixed(1)) : null,
        empresaB:
          indBAtual?.roe !== null && indBAtual?.roe !== undefined
            ? Number(indBAtual.roe.toFixed(1))
            : null,
        benchmark: benchmarkAtivo?.roe ?? 15,
        unidade: '%',
        metaDesc: '≥ 15%',
      },
      {
        indicador: 'ROA (Retorno Ativo)',
        sigla: 'ROA',
        empresa: indAtual.roa !== null ? Number(indAtual.roa.toFixed(1)) : null,
        empresaB:
          indBAtual?.roa !== null && indBAtual?.roa !== undefined
            ? Number(indBAtual.roa.toFixed(1))
            : null,
        benchmark: benchmarkAtivo?.roa ?? 8,
        unidade: '%',
        metaDesc: '≥ 8%',
      },
      {
        indicador: 'Margem Líquida (ML)',
        sigla: 'ML',
        empresa: indAtual.ml !== null ? Number(indAtual.ml.toFixed(1)) : null,
        empresaB:
          indBAtual?.ml !== null && indBAtual?.ml !== undefined
            ? Number(indBAtual.ml.toFixed(1))
            : null,
        benchmark: benchmarkAtivo?.margemLiquida ?? 10,
        unidade: '%',
        metaDesc: '≥ 10%',
      },
      {
        indicador: 'Margem Operacional',
        sigla: 'MO',
        empresa:
          indStandard.margemOperacional !== null
            ? Number(indStandard.margemOperacional.toFixed(1))
            : null,
        empresaB:
          indStandardB?.margemOperacional !== null && indStandardB?.margemOperacional !== undefined
            ? Number(indStandardB.margemOperacional.toFixed(1))
            : null,
        benchmark: benchmarkAtivo ? Number((benchmarkAtivo.margemLiquida * 1.3).toFixed(1)) : 13,
        unidade: '%',
        metaDesc: '≥ 12%',
      },
    ]
  }, [indAtual, indBAtual, indStandard, indStandardB, benchmarkAtivo])

  // 4. Grupo Estrutura de Capital (Autonomia %, D/E Ratio, Imobilização PL %)
  const chartEstruturaData = useMemo(() => {
    return [
      {
        indicador: 'Autonomia Fin. (AF)',
        sigla: 'AF',
        empresa: indAtual.af !== null ? Number(indAtual.af.toFixed(1)) : null,
        empresaB:
          indBAtual?.af !== null && indBAtual?.af !== undefined
            ? Number(indBAtual.af.toFixed(1))
            : null,
        benchmark: benchmarkAtivo?.autonomiaFinanceira ?? 50,
        unidade: '%',
        metaDesc: '≥ 50%',
      },
      {
        indicador: 'Dívida / Equity (D/E %)',
        sigla: 'D/E',
        empresa: indAtual.de !== null ? Number((indAtual.de * 100).toFixed(1)) : null,
        empresaB:
          indBAtual?.de !== null && indBAtual?.de !== undefined
            ? Number((indBAtual.de * 100).toFixed(1))
            : null,
        benchmark: benchmarkAtivo ? Number((benchmarkAtivo.dividaEquity * 100).toFixed(1)) : 100,
        unidade: '%',
        realEmpresa: indAtual.de !== null ? `${indAtual.de.toFixed(2)}x` : '—',
        realEmpresaB:
          indBAtual?.de !== null && indBAtual?.de !== undefined
            ? `${indBAtual.de.toFixed(2)}x`
            : '—',
        realBench: benchmarkAtivo ? `${benchmarkAtivo.dividaEquity.toFixed(2)}x` : '1.0x',
        metaDesc: '≤ 1,0x',
        menorMelhor: true,
      },
      {
        indicador: 'Imob. do PL (IPL)',
        sigla: 'IPL',
        empresa: indAtual.ipl !== null ? Number(indAtual.ipl.toFixed(1)) : null,
        empresaB:
          indBAtual?.ipl !== null && indBAtual?.ipl !== undefined
            ? Number(indBAtual.ipl.toFixed(1))
            : null,
        benchmark: benchmarkAtivo?.imobilizacaoPL ?? 55,
        unidade: '%',
        metaDesc: '≤ 55%',
        menorMelhor: true,
      },
    ]
  }, [indAtual, indBAtual, benchmarkAtivo])

  // 5. Grupo EBITDA (Margem EBITDA %, Cobertura Juros x10)
  const chartEbitdaData = useMemo(() => {
    return [
      {
        indicador: 'Margem EBITDA',
        sigla: 'M. EBITDA',
        empresa: indAtual.margemEbitda !== null ? Number(indAtual.margemEbitda.toFixed(1)) : null,
        empresaB:
          indBAtual?.margemEbitda !== null && indBAtual?.margemEbitda !== undefined
            ? Number(indBAtual.margemEbitda.toFixed(1))
            : null,
        benchmark: benchmarkAtivo?.margemEbitda ?? 16,
        unidade: '%',
        metaDesc: '≥ 15%',
      },
      {
        indicador: 'Cobertura Juros (x10)',
        sigla: 'Cob. Juros',
        empresa:
          indAtual.coberturaJuros !== null
            ? Number((Math.min(indAtual.coberturaJuros, 20) * 10).toFixed(1))
            : null,
        empresaB:
          indBAtual?.coberturaJuros !== null && indBAtual?.coberturaJuros !== undefined
            ? Number((Math.min(indBAtual.coberturaJuros, 20) * 10).toFixed(1))
            : null,
        benchmark: benchmarkAtivo
          ? Number((Math.min(benchmarkAtivo.coberturaJuros, 20) * 10).toFixed(1))
          : 30,
        unidade: 'x*10',
        realEmpresa:
          indAtual.coberturaJuros !== null ? `${indAtual.coberturaJuros.toFixed(2)}x` : '—',
        realEmpresaB:
          indBAtual?.coberturaJuros !== null && indBAtual?.coberturaJuros !== undefined
            ? `${indBAtual.coberturaJuros.toFixed(2)}x`
            : '—',
        realBench: benchmarkAtivo ? `${benchmarkAtivo.coberturaJuros.toFixed(2)}x` : '3.0x',
        metaDesc: '≥ 3,0x',
      },
    ]
  }, [indAtual, indBAtual, benchmarkAtivo])

  // 6. Grupo Eficiência Operacional (PMR dias, PME dias, PMP dias, Ciclo Fin dias)
  const chartEficienciaData = useMemo(() => {
    return [
      {
        indicador: 'PMR (Recebimento)',
        sigla: 'PMR',
        empresa: indAtual.pmr !== null ? Math.round(indAtual.pmr) : null,
        empresaB:
          indBAtual?.pmr !== null && indBAtual?.pmr !== undefined
            ? Math.round(indBAtual.pmr)
            : null,
        benchmark: benchmarkAtivo?.pmr ?? 45,
        unidade: 'dias',
        metaDesc: '≤ 45d',
        menorMelhor: true,
      },
      {
        indicador: 'PME (Estocagem)',
        sigla: 'PME',
        empresa: indAtual.pme !== null ? Math.round(indAtual.pme) : null,
        empresaB:
          indBAtual?.pme !== null && indBAtual?.pme !== undefined
            ? Math.round(indBAtual.pme)
            : null,
        benchmark: benchmarkAtivo?.pme ?? 30,
        unidade: 'dias',
        metaDesc: '≤ 30d',
        menorMelhor: true,
      },
      {
        indicador: 'PMP (Pagamento)',
        sigla: 'PMP',
        empresa: indAtual.pmp !== null ? Math.round(indAtual.pmp) : null,
        empresaB:
          indBAtual?.pmp !== null && indBAtual?.pmp !== undefined
            ? Math.round(indBAtual.pmp)
            : null,
        benchmark: benchmarkAtivo?.pmp ?? 40,
        unidade: 'dias',
        metaDesc: '≥ 40d',
        menorMelhor: false,
      },
      {
        indicador: 'Ciclo Financeiro',
        sigla: 'Ciclo Fin.',
        empresa: indAtual.cf !== null ? Math.round(indAtual.cf) : null,
        empresaB:
          indBAtual?.cf !== null && indBAtual?.cf !== undefined ? Math.round(indBAtual.cf) : null,
        benchmark: benchmarkAtivo?.cicloFinanceiro ?? 35,
        unidade: 'dias',
        metaDesc: '≤ 35d',
        menorMelhor: true,
      },
    ]
  }, [indAtual, indBAtual, benchmarkAtivo])

  // 7. Grupo Econômicos (ROIC %, WACC %, Spread %, Giro Ativo x10)
  const chartEconomicosData = useMemo(() => {
    const waccEmpresa = 12.0 // custo de capital padrão de referência
    return [
      {
        indicador: 'ROIC (Ret. Cap. Inv.)',
        sigla: 'ROIC',
        empresa: indAtual.roic !== null ? Number(indAtual.roic.toFixed(1)) : null,
        empresaB:
          indBAtual?.roic !== null && indBAtual?.roic !== undefined
            ? Number(indBAtual.roic.toFixed(1))
            : null,
        benchmark: benchmarkAtivo?.roic ?? 14,
        unidade: '%',
        metaDesc: '≥ 14%',
      },
      {
        indicador: 'WACC (Custo Capital)',
        sigla: 'WACC',
        empresa: waccEmpresa,
        empresaB: waccEmpresa,
        benchmark: benchmarkAtivo?.wacc ?? 12,
        unidade: '%',
        metaDesc: 'Benchmark 12%',
        menorMelhor: true,
      },
      {
        indicador: 'Spread (ROIC - WACC)',
        sigla: 'Spread',
        empresa: indAtual.spread !== null ? Number(indAtual.spread.toFixed(1)) : null,
        empresaB:
          indBAtual?.spread !== null && indBAtual?.spread !== undefined
            ? Number(indBAtual.spread.toFixed(1))
            : null,
        benchmark: benchmarkAtivo?.spread ?? 2.0,
        unidade: '%',
        metaDesc: '≥ 2,0%',
      },
      {
        indicador: 'Giro do Ativo (x10)',
        sigla: 'Giro Ativo',
        empresa: indAtual.giroAtivo !== null ? Number((indAtual.giroAtivo * 10).toFixed(1)) : null,
        empresaB:
          indBAtual?.giroAtivo !== null && indBAtual?.giroAtivo !== undefined
            ? Number((indBAtual.giroAtivo * 10).toFixed(1))
            : null,
        benchmark: benchmarkAtivo ? Number((benchmarkAtivo.giroAtivo * 10).toFixed(1)) : 10,
        unidade: 'x*10',
        realEmpresa: indAtual.giroAtivo !== null ? `${indAtual.giroAtivo.toFixed(2)}x` : '—',
        realEmpresaB:
          indBAtual?.giroAtivo !== null && indBAtual?.giroAtivo !== undefined
            ? `${indBAtual.giroAtivo.toFixed(2)}x`
            : '—',
        realBench: benchmarkAtivo ? `${benchmarkAtivo.giroAtivo.toFixed(2)}x` : '1.0x',
        metaDesc: '≥ 1,0x',
      },
    ]
  }, [indAtual, indBAtual, benchmarkAtivo])

  // 9. Grupo Kanitz (Decomposição das 5 Variáveis X1-X5 no FI)
  const chartKanitzData = useMemo(() => {
    if (!kanitzAtual.dadosDisponiveis || kanitzAtual.fi === null) return []
    const items = kanitzAtual.variaveis.map((v) => ({
      indicador: `${v.sigla} - ${v.nome}`,
      sigla: v.sigla,
      empresa: v.contribuicao !== null ? Number(v.contribuicao.toFixed(3)) : null,
      empresaB: null,
      benchmark: 0,
      unidade: 'pts',
      realEmpresa:
        v.contribuicao !== null
          ? `${v.contribuicao > 0 ? '+' : ''}${v.contribuicao.toFixed(3)}`
          : '—',
      realEmpresaB: '—',
      realBench: 'Ref: > 0',
      metaDesc: v.formula,
    }))
    items.push({
      indicador: 'Fator FI Total',
      sigla: 'FI Final',
      empresa: Number(kanitzAtual.fi.toFixed(2)),
      empresaB: null,
      benchmark: 0,
      unidade: 'pts',
      realEmpresa: `${kanitzAtual.fi.toFixed(2)} (${kanitzAtual.statusTexto})`,
      realEmpresaB: '—',
      realBench: 'Solvente: FI ≥ 0',
      metaDesc: 'Zona de Solvência',
    })
    return items
  }, [kanitzAtual])

  // 8. Grupo Capital de Giro (CGL, NCG, Saldo Tesouraria, Liquidez Corrente)
  const chartCapitalGiroData = useMemo(() => {
    return [
      {
        indicador: 'Cap. Giro Líquido (CGL)',
        sigla: 'CGL',
        empresa: indAtual.cgl !== null ? Number((indAtual.cgl / 1000).toFixed(1)) : null,
        empresaB:
          indBAtual?.cgl !== null && indBAtual?.cgl !== undefined
            ? Number((indBAtual.cgl / 1000).toFixed(1))
            : null,
        benchmark: 50, // R$ 50k benchmark de referência
        unidade: 'R$ mil',
        realEmpresa: indAtual.cgl !== null ? formatCurrency(indAtual.cgl) : '—',
        realEmpresaB:
          indBAtual?.cgl !== null && indBAtual?.cgl !== undefined
            ? formatCurrency(indBAtual.cgl)
            : '—',
        realBench: '> R$ 0',
        metaDesc: '> R$ 0,00',
      },
      {
        indicador: 'Nec. Cap. Giro (NCG)',
        sigla: 'NCG',
        empresa: indAtual.ncg !== null ? Number((indAtual.ncg / 1000).toFixed(1)) : null,
        empresaB:
          indBAtual?.ncg !== null && indBAtual?.ncg !== undefined
            ? Number((indBAtual.ncg / 1000).toFixed(1))
            : null,
        benchmark: 30, // R$ 30k benchmark de referência
        unidade: 'R$ mil',
        realEmpresa: indAtual.ncg !== null ? formatCurrency(indAtual.ncg) : '—',
        realEmpresaB:
          indBAtual?.ncg !== null && indBAtual?.ncg !== undefined
            ? formatCurrency(indBAtual.ncg)
            : '—',
        realBench: '≤ CGL',
        metaDesc: 'Financiada por CGL',
        menorMelhor: true,
      },
      {
        indicador: 'Saldo Tesouraria (ST)',
        sigla: 'ST',
        empresa:
          indAtual.saldoTesouraria !== null
            ? Number((indAtual.saldoTesouraria / 1000).toFixed(1))
            : null,
        empresaB:
          indBAtual?.saldoTesouraria !== null && indBAtual?.saldoTesouraria !== undefined
            ? Number((indBAtual.saldoTesouraria / 1000).toFixed(1))
            : null,
        benchmark: 20, // R$ 20k
        unidade: 'R$ mil',
        realEmpresa:
          indAtual.saldoTesouraria !== null ? formatCurrency(indAtual.saldoTesouraria) : '—',
        realEmpresaB:
          indBAtual?.saldoTesouraria !== null && indBAtual?.saldoTesouraria !== undefined
            ? formatCurrency(indBAtual.saldoTesouraria)
            : '—',
        realBench: '> R$ 0',
        metaDesc: '> R$ 0 (Superávit)',
      },
      {
        indicador: 'Liq. Corrente (x10)',
        sigla: 'LC (x10)',
        empresa: indAtual.lc !== null ? Number((indAtual.lc * 10).toFixed(1)) : null,
        empresaB:
          indBAtual?.lc !== null && indBAtual?.lc !== undefined
            ? Number((indBAtual.lc * 10).toFixed(1))
            : null,
        benchmark: benchmarkAtivo ? Number((benchmarkAtivo.liquidezCorrente * 10).toFixed(1)) : 15,
        unidade: 'x*10',
        realEmpresa: indAtual.lc !== null ? `${indAtual.lc.toFixed(2)}x` : '—',
        realEmpresaB:
          indBAtual?.lc !== null && indBAtual?.lc !== undefined
            ? `${indBAtual.lc.toFixed(2)}x`
            : '—',
        realBench: benchmarkAtivo ? `${benchmarkAtivo.liquidezCorrente.toFixed(2)}x` : '1.50x',
        metaDesc: '≥ 1,20x',
      },
    ]
  }, [indAtual, indBAtual, benchmarkAtivo])

  // Tabela completa de evolução vs Setor (3 Anos)
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

      // 8. Capital de Giro
      {
        grupo: 'Capital de Giro',
        indicador: 'Capital de Giro Líquido (CGL)',
        link: '/indicadores/capital-giro',
        ano2:
          indAno2?.cgl !== null && indAno2?.cgl !== undefined ? formatCurrency(indAno2.cgl) : '—',
        ano1:
          indAno1?.cgl !== null && indAno1?.cgl !== undefined ? formatCurrency(indAno1.cgl) : '—',
        anoAtual: indAtual.cgl !== null ? formatCurrency(indAtual.cgl) : '—',
        setor: '> R$ 0,00',
        unidade: 'R$',
        tendencia: calcularTendencia(indAtual.cgl, indAno1?.cgl || null, false),
        peso: pesos.liquidez,
      },
      {
        grupo: 'Capital de Giro',
        indicador: 'Necessidade de Cap. Giro (NCG)',
        link: '/indicadores/capital-giro',
        ano2:
          indAno2?.ncg !== null && indAno2?.ncg !== undefined ? formatCurrency(indAno2.ncg) : '—',
        ano1:
          indAno1?.ncg !== null && indAno1?.ncg !== undefined ? formatCurrency(indAno1.ncg) : '—',
        anoAtual: indAtual.ncg !== null ? formatCurrency(indAtual.ncg) : '—',
        setor: '≤ CGL',
        unidade: 'R$',
        tendencia: calcularTendencia(indAtual.ncg, indAno1?.ncg || null, true),
        peso: pesos.liquidez,
      },
      {
        grupo: 'Capital de Giro',
        indicador: 'Saldo de Tesouraria (ST)',
        link: '/indicadores/capital-giro',
        ano2:
          indAno2?.saldoTesouraria !== null && indAno2?.saldoTesouraria !== undefined
            ? formatCurrency(indAno2.saldoTesouraria)
            : '—',
        ano1:
          indAno1?.saldoTesouraria !== null && indAno1?.saldoTesouraria !== undefined
            ? formatCurrency(indAno1.saldoTesouraria)
            : '—',
        anoAtual:
          indAtual.saldoTesouraria !== null ? formatCurrency(indAtual.saldoTesouraria) : '—',
        setor: '> R$ 0,00',
        unidade: 'R$',
        tendencia: calcularTendencia(
          indAtual.saldoTesouraria,
          indAno1?.saldoTesouraria || null,
          false,
        ),
        peso: pesos.liquidez,
      },

      // 9. Kanitz (Termômetro de Insolvência)
      {
        grupo: 'Solvência / Kanitz',
        indicador: 'Fator de Insolvência (FI)',
        link: '/indicadores/kanitz',
        ano2:
          kanitzAno2?.fi !== null && kanitzAno2?.fi !== undefined ? kanitzAno2.fi.toFixed(2) : '—',
        ano1:
          kanitzAno1?.fi !== null && kanitzAno1?.fi !== undefined ? kanitzAno1.fi.toFixed(2) : '—',
        anoAtual: kanitzAtual.fi !== null ? kanitzAtual.fi.toFixed(2) : '—',
        setor: 'FI ≥ 0,00 (Solvente)',
        unidade: '',
        tendencia: calcularTendencia(kanitzAtual.fi, kanitzAno1?.fi ?? null, false),
        peso: pesos.kanitz || 0,
      },
    ]
  }, [indAtual, indAno1, indAno2, kanitzAtual, kanitzAno1, kanitzAno2, benchmarkAtivo, pesos])

  const hasHistorico = !!(balancoAno1 || balancoAno2 || dreAno1 || dreAno2)

  // Exportação CSV Completa com TODOS os indicadores de todos os grupos
  const handleExportCsv = () => {
    if (!selectedEmpresa) {
      toast({
        title: 'Selecione uma empresa',
        description: 'É necessário selecionar uma empresa para exportar os indicadores.',
        variant: 'destructive',
      })
      return
    }

    let csvContent = '\uFEFF' // BOM UTF-8
    const dataEmissao = new Date().toLocaleDateString('pt-BR')

    csvContent += `DASHBOARD COMPLETO DE INDICADORES FINANCEIROS & BENCHMARKS\n`
    csvContent += `EMPRESA;${selectedEmpresa.nome}\n`
    csvContent += `CNPJ;${formatCnpj(selectedEmpresa.cnpj)}\n`
    csvContent += `SEGMENTO/BENCHMARK;${selectedSetorBenchmark || selectedEmpresa.segmento}\n`
    csvContent += `EXERCÍCIO BASE;${selectedAno}\n`
    csvContent += `DATA DE EMISSÃO;${dataEmissao}\n`
    csvContent += `SCORE GERAL PONDERADO;${scoreGeralPonderado}/100;PERFIL;${PERFIS_PESOS_PREDEFINIDOS[perfilPesos]?.nome}\n\n`

    csvContent += `RESUMO FINANCEIRO BASE (R$)\n`
    csvContent += `Ativo Total;${formatCurrency(destaques.ativoTotal).replace(/\s/g, ' ')}\n`
    csvContent += `Patrimônio Líquido;${formatCurrency(destaques.patrimonioLiquido).replace(/\s/g, ' ')}\n`
    csvContent += `Receita Líquida;${formatCurrency(destaques.receitaLiquida).replace(/\s/g, ' ')}\n`
    csvContent += `Lucro Líquido;${formatCurrency(destaques.lucroLiquido).replace(/\s/g, ' ')}\n`
    csvContent += `EBITDA;${formatCurrency(destaques.ebitda).replace(/\s/g, ' ')}\n\n`

    csvContent += `TABELA COMPARATIVA DE INDICADORES (TODOS OS GRUPOS)\n`
    csvContent += `Grupo;Indicador;${ano2};${ano1};${selectedAno} (Atual);Benchmark Setor;Tendência;Peso no Relatório\n`

    for (const linha of linhasEvolucao) {
      csvContent += `${linha.grupo};${linha.indicador};${linha.ano2};${linha.ano1};${linha.anoAtual};${linha.setor};${linha.tendencia.label};${linha.peso}%\n`
    }

    csvContent += `\nDETALHAMENTO DOS SCORES DO RADAR (0-100)\n`
    csvContent += `Grupo;Score Empresa;Score Setor;Status vs Setor;Valor Real Empresa;Valor Real Benchmark\n`
    for (const item of radarItems) {
      csvContent += `${item.grupoNome};${item.empresaScore};${item.setorScore};${item.status};${item.empresaValorRealStr};${item.setorValorRealStr}\n`
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `dashboard-indicadores-${selectedEmpresa.nome.replace(/\s+/g, '-').toLowerCase()}-${selectedAno}.csv`
    link.click()
    URL.revokeObjectURL(link.href)

    toast({
      title: 'Dashboard exportado com sucesso!',
      description: `Arquivo CSV completo com todos os indicadores gerado para ${selectedEmpresa.nome} (${selectedAno}).`,
    })
  }

  // Tabela Comparativa entre as 2 Empresas (Modo Comparação)
  const tabelaComparativaEmpresas = useMemo(() => {
    if (!compararAtivo || !indAtual || !indBAtual) return []

    const calcularVariacaoPercentual = (valA: number | null, valB: number | null) => {
      if (valA === null || valB === null || valB === 0) return null
      return ((valA - valB) / Math.abs(valB)) * 100
    }

    return [
      {
        indicador: 'Liquidez Corrente (LC)',
        sigla: 'LC',
        grupo: 'Liquidez',
        empresaA: indAtual.lc ? `${indAtual.lc.toFixed(2)}x` : '—',
        empresaB: indBAtual.lc ? `${indBAtual.lc.toFixed(2)}x` : '—',
        varPercent: calcularVariacaoPercentual(indAtual.lc, indBAtual.lc),
        bench: benchmarkAtivo ? `${benchmarkAtivo.liquidezCorrente.toFixed(2)}x` : '1.50x',
        melhor:
          indAtual.lc !== null && indBAtual.lc !== null
            ? indAtual.lc >= indBAtual.lc
              ? 'A'
              : 'B'
            : null,
      },
      {
        indicador: 'Retorno sobre o PL (ROE)',
        sigla: 'ROE',
        grupo: 'Rentabilidade',
        empresaA: indAtual.roe ? `${indAtual.roe.toFixed(1)}%` : '—',
        empresaB: indBAtual.roe ? `${indBAtual.roe.toFixed(1)}%` : '—',
        varPercent: calcularVariacaoPercentual(indAtual.roe, indBAtual.roe),
        bench: benchmarkAtivo ? `${benchmarkAtivo.roe.toFixed(1)}%` : '15.0%',
        melhor:
          indAtual.roe !== null && indBAtual.roe !== null
            ? indAtual.roe >= indBAtual.roe
              ? 'A'
              : 'B'
            : null,
      },
      {
        indicador: 'Margem Líquida (ML)',
        sigla: 'ML',
        grupo: 'Rentabilidade',
        empresaA: indAtual.ml ? `${indAtual.ml.toFixed(1)}%` : '—',
        empresaB: indBAtual.ml ? `${indBAtual.ml.toFixed(1)}%` : '—',
        varPercent: calcularVariacaoPercentual(indAtual.ml, indBAtual.ml),
        bench: benchmarkAtivo ? `${benchmarkAtivo.margemLiquida.toFixed(1)}%` : '10.0%',
        melhor:
          indAtual.ml !== null && indBAtual.ml !== null
            ? indAtual.ml >= indBAtual.ml
              ? 'A'
              : 'B'
            : null,
      },
      {
        indicador: 'Margem EBITDA',
        sigla: 'M. EBITDA',
        grupo: 'EBITDA',
        empresaA: indAtual.margemEbitda ? `${indAtual.margemEbitda.toFixed(1)}%` : '—',
        empresaB: indBAtual.margemEbitda ? `${indBAtual.margemEbitda.toFixed(1)}%` : '—',
        varPercent: calcularVariacaoPercentual(indAtual.margemEbitda, indBAtual.margemEbitda),
        bench: benchmarkAtivo ? `${benchmarkAtivo.margemEbitda.toFixed(1)}%` : '16.0%',
        melhor:
          indAtual.margemEbitda !== null && indBAtual.margemEbitda !== null
            ? indAtual.margemEbitda >= indBAtual.margemEbitda
              ? 'A'
              : 'B'
            : null,
      },
      {
        indicador: 'Endividamento Geral (EG)',
        sigla: 'EG',
        grupo: 'Endividamento',
        empresaA: indAtual.eg ? `${indAtual.eg.toFixed(1)}%` : '—',
        empresaB: indBAtual.eg ? `${indBAtual.eg.toFixed(1)}%` : '—',
        varPercent: calcularVariacaoPercentual(indAtual.eg, indBAtual.eg),
        bench: benchmarkAtivo ? `${benchmarkAtivo.endividamentoGeral.toFixed(1)}%` : '50.0%',
        melhor:
          indAtual.eg !== null && indBAtual.eg !== null
            ? indAtual.eg <= indBAtual.eg
              ? 'A'
              : 'B'
            : null,
      },
      {
        indicador: 'Score Global Ponderado',
        sigla: 'Score',
        grupo: 'Consolidado',
        empresaA: `${scoreGeralPonderado}/100`,
        empresaB: `${scoreGeralPonderadoB}/100`,
        varPercent: calcularVariacaoPercentual(scoreGeralPonderado, scoreGeralPonderadoB),
        bench: '—',
        melhor: scoreGeralPonderado >= scoreGeralPonderadoB ? 'A' : 'B',
      },
    ]
  }, [
    compararAtivo,
    indAtual,
    indBAtual,
    benchmarkAtivo,
    scoreGeralPonderado,
    scoreGeralPonderadoB,
  ])

  // Componente de Mini Card de Indicador
  const renderMiniCard = (
    nome: string,
    sigla: string,
    valorStr: string,
    benchStr: string,
    status: 'bom' | 'medio' | 'ruim' | 'neutro',
    subtitulo: string,
  ) => {
    const corBadge =
      status === 'bom'
        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
        : status === 'medio'
          ? 'bg-amber-50 text-amber-700 border-amber-200'
          : status === 'ruim'
            ? 'bg-red-50 text-red-700 border-red-200'
            : 'bg-slate-100 text-slate-700 border-slate-200'

    return (
      <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs hover:border-blue-300 transition-all flex flex-col justify-between">
        <div className="flex items-center justify-between gap-1 mb-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 truncate">
            {nome}
          </span>
          <Badge className="text-[9px] px-1 py-0 border-none font-mono font-bold bg-slate-100 text-slate-700">
            {sigla}
          </Badge>
        </div>
        <div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-base font-extrabold text-[#0B1F3A] font-mono">{valorStr}</span>
            <Badge className={`text-[10px] font-bold px-1.5 py-0 ${corBadge}`}>
              {status === 'bom'
                ? 'Positivo'
                : status === 'medio'
                  ? 'Médio'
                  : status === 'ruim'
                    ? 'Alerta'
                    : '—'}
            </Badge>
          </div>
          <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1 pt-1 border-t border-slate-100">
            <span>Ref: {benchStr}</span>
            <span className="text-[9px] text-slate-400">{subtitulo}</span>
          </div>
        </div>
      </div>
    )
  }

  // Helper para filtro de grupos
  const gruposVisiveis = useMemo(() => {
    if (filtroGrupo === 'todos') return null
    return filtroGrupo
  }, [filtroGrupo])

  if (loading && !balancoAtual && !dreAtual && balancos.length === 0) {
    return (
      <div className="py-20 flex flex-col justify-center items-center gap-3">
        <div className="w-9 h-9 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs text-slate-500 font-medium">
          Carregando Dashboard de Indicadores...
        </span>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fadeIn pb-16">
      {/* 1. Header do Dashboard com Seletores e Ações */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-lg shadow-md shadow-blue-600/20 shrink-0">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-extrabold text-[#0B1F3A] tracking-tight">
                Dashboard de Indicadores Financeiros
              </h1>
              <Badge className="bg-blue-50 text-blue-700 border-blue-200 font-semibold text-xs">
                Visão Completa &amp; Gráficos
              </Badge>
            </div>
            <p className="text-xs text-[#5B6B7F] mt-0.5">
              Análise gráfica de todos os grupos de indicadores com benchmarks setoriais e evolução
              temporal
            </p>
          </div>
        </div>

        {/* Controles: Empresa, Ano, Benchmark Setorial, Exportar CSV e Personalizar Pesos */}
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

          {/* Botão Exportar CSV */}
          <Button
            type="button"
            variant="outline"
            onClick={handleExportCsv}
            disabled={!balancoAtual && !dreAtual}
            className="border-slate-300 text-slate-700 hover:bg-slate-100 font-semibold text-xs h-9 shadow-2xs gap-1.5"
          >
            <Download className="w-3.5 h-3.5 text-blue-600" />
            <span>Exportar CSV</span>
          </Button>

          {/* Botão Relatório PDF A4 */}
          <Button
            type="button"
            variant="outline"
            onClick={() => setModalPdfOpen(true)}
            disabled={!balancoAtual && !dreAtual}
            className="border-slate-300 text-slate-700 hover:bg-slate-100 font-semibold text-xs h-9 shadow-2xs gap-1.5"
          >
            <FileText className="w-3.5 h-3.5 text-indigo-600" />
            <span>Relatório A4</span>
          </Button>

          {/* Botão Personalizar Pesos */}
          <Button
            type="button"
            variant="outline"
            onClick={() => setModalPesosOpen(true)}
            className="border-blue-200 text-blue-700 hover:bg-blue-50 font-semibold text-xs h-9 shadow-2xs gap-1.5"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600" />
            <span className="hidden sm:inline">Personalizar</span>
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
              Relatório Executivo
            </Link>
          </Button>
        </div>
      </div>

      {/* 2. Destaques Executivos dos Principais KPIs com Badges Coloridos */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* KPI 1: Liquidez Corrente */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs hover:shadow-sm transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Liq. Corrente
            </span>
            <Badge
              className={`text-[9px] px-1.5 py-0 font-bold ${
                destaques.liquidezCorrente && destaques.liquidezCorrente >= 1.5
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : destaques.liquidezCorrente && destaques.liquidezCorrente >= 1.0
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-red-50 text-red-700 border-red-200'
              }`}
            >
              {destaques.liquidezCorrente && destaques.liquidezCorrente >= 1.5
                ? '🟢 Confortável'
                : destaques.liquidezCorrente && destaques.liquidezCorrente >= 1.0
                  ? '🟠 Regular'
                  : '🔴 Crítico'}
            </Badge>
          </div>
          <div className="my-1.5">
            <strong className="text-xl sm:text-2xl font-black text-[#0B1F3A] font-mono">
              {destaques.liquidezCorrente ? formatNumber(destaques.liquidezCorrente, 2) : '—'}
            </strong>
          </div>
          <span className="text-[10px] text-slate-400">
            Ref Setor: {benchmarkAtivo?.liquidezCorrente.toFixed(2) || '1.50'}x
          </span>
        </div>

        {/* KPI 2: ROE */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs hover:shadow-sm transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              ROE (Retorno PL)
            </span>
            <Badge
              className={`text-[9px] px-1.5 py-0 font-bold ${
                destaques.roe && destaques.roe >= 15
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : destaques.roe && destaques.roe >= 5
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-red-50 text-red-700 border-red-200'
              }`}
            >
              {destaques.roe && destaques.roe >= 15
                ? '🟢 Excelente'
                : destaques.roe && destaques.roe >= 5
                  ? '🟠 Moderado'
                  : '🔴 Baixo'}
            </Badge>
          </div>
          <div className="my-1.5">
            <strong
              className={`text-xl sm:text-2xl font-black font-mono ${
                destaques.roe && destaques.roe >= 0 ? 'text-emerald-600' : 'text-red-600'
              }`}
            >
              {destaques.roe ? `${formatNumber(destaques.roe, 1)}%` : '—'}
            </strong>
          </div>
          <span className="text-[10px] text-slate-400">
            Ref Setor: {benchmarkAtivo?.roe.toFixed(1) || '15.0'}%
          </span>
        </div>

        {/* KPI 3: Margem Líquida */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs hover:shadow-sm transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Margem Líquida
            </span>
            <Badge
              className={`text-[9px] px-1.5 py-0 font-bold ${
                destaques.margemLiquida && destaques.margemLiquida >= 10
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : destaques.margemLiquida && destaques.margemLiquida >= 5
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-red-50 text-red-700 border-red-200'
              }`}
            >
              {destaques.margemLiquida && destaques.margemLiquida >= 10
                ? '🟢 Saudável'
                : destaques.margemLiquida && destaques.margemLiquida >= 5
                  ? '🟠 Estável'
                  : '🔴 Atenção'}
            </Badge>
          </div>
          <div className="my-1.5">
            <strong
              className={`text-xl sm:text-2xl font-black font-mono ${
                destaques.margemLiquida && destaques.margemLiquida >= 0
                  ? 'text-emerald-700'
                  : 'text-red-600'
              }`}
            >
              {destaques.margemLiquida ? `${formatNumber(destaques.margemLiquida, 1)}%` : '—'}
            </strong>
          </div>
          <span className="text-[10px] text-slate-400">
            Ref Setor: {benchmarkAtivo?.margemLiquida.toFixed(1) || '10.0'}%
          </span>
        </div>

        {/* KPI 4: EBITDA & Margem */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs hover:shadow-sm transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              EBITDA / Caixa
            </span>
            <Badge className="bg-purple-50 text-purple-700 border-purple-200 text-[9px] px-1.5 py-0 font-bold">
              {indAtual.margemEbitda ? `${indAtual.margemEbitda.toFixed(1)}%` : 'Margem'}
            </Badge>
          </div>
          <div className="my-1.5">
            <strong
              className={`text-xl sm:text-2xl font-black font-mono ${
                destaques.ebitda >= 0 ? 'text-purple-900' : 'text-red-600'
              }`}
            >
              {formatBrlMil(destaques.ebitda)}
            </strong>
          </div>
          <span className="text-[10px] text-slate-400">
            Ref Margem: {benchmarkAtivo?.margemEbitda.toFixed(1) || '16.0'}%
          </span>
        </div>

        {/* KPI 5: Endividamento Geral */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs hover:shadow-sm transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Endividamento
            </span>
            <Badge
              className={`text-[9px] px-1.5 py-0 font-bold ${
                destaques.endividamentoGeral && destaques.endividamentoGeral <= 50
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : destaques.endividamentoGeral && destaques.endividamentoGeral <= 70
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-red-50 text-red-700 border-red-200'
              }`}
            >
              {destaques.endividamentoGeral && destaques.endividamentoGeral <= 50
                ? '🟢 Baixo'
                : destaques.endividamentoGeral && destaques.endividamentoGeral <= 70
                  ? '🟠 Moderado'
                  : '🔴 Alto'}
            </Badge>
          </div>
          <div className="my-1.5">
            <strong className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
              {destaques.endividamentoGeral
                ? `${formatNumber(destaques.endividamentoGeral, 1)}%`
                : '—'}
            </strong>
          </div>
          <span className="text-[10px] text-slate-400">
            Ref Setor: {benchmarkAtivo?.endividamentoGeral.toFixed(1) || '50.0'}%
          </span>
        </div>

        {/* KPI 6: Score Geral Ponderado */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs hover:shadow-sm transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Score Global
            </span>
            <Badge
              className={`text-[9px] px-1.5 py-0 font-black ${
                scoreGeralPonderado >= 70
                  ? 'bg-emerald-100 text-emerald-800'
                  : scoreGeralPonderado >= 50
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-amber-100 text-amber-800'
              }`}
            >
              {scoreGeralPonderado >= 70
                ? '★ Forte'
                : scoreGeralPonderado >= 50
                  ? '● Equilibrado'
                  : '▲ Atenção'}
            </Badge>
          </div>
          <div className="my-1.5 flex items-baseline gap-1">
            <strong
              className={`text-xl sm:text-2xl font-black font-mono ${
                scoreGeralPonderado >= 70
                  ? 'text-emerald-600'
                  : scoreGeralPonderado >= 50
                    ? 'text-blue-600'
                    : 'text-amber-600'
              }`}
            >
              {scoreGeralPonderado}
            </strong>
            <span className="text-xs text-slate-400 font-mono font-medium">/100</span>
          </div>
          <span className="text-[10px] text-slate-400">
            Perfil: {PERFIS_PESOS_PREDEFINIDOS[perfilPesos]?.nome}
          </span>
        </div>
      </div>

      {/* 3. GRÁFICO DE RADAR 360º + EVOLUÇÃO HISTÓRICA (SEÇÃO PRINCIPAL) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Radar Chart Comparativo vs Benchmark (7 colunas) */}
        <Card className="lg:col-span-7 bg-white border-slate-200 shadow-2xs overflow-hidden flex flex-col justify-between">
          <CardHeader className="pb-2 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-50 text-blue-700 rounded-lg">
                  <Activity className="w-4 h-4" />
                </div>
                <CardTitle className="text-base font-bold text-[#0B1F3A]">
                  Radar 360º: Empresa vs Benchmark ({selectedSetorBenchmark})
                </CardTitle>
              </div>
              <CardDescription className="text-xs text-slate-500 mt-0.5">
                Avaliação dos 6 grandes eixos de solidez financeira em escala normalizada (0-100)
              </CardDescription>
            </div>

            <div className="flex items-center gap-3 text-xs font-semibold">
              <span className="flex items-center gap-1.5 text-blue-700">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: primaryBrandColor }}
                />
                Empresa
              </span>
              <span className="flex items-center gap-1.5 text-slate-500">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: sectorColor }} />
                Setor
              </span>
            </div>
          </CardHeader>

          <CardContent className="p-4 sm:p-6 flex-1 flex flex-col justify-center">
            {!balancoAtual && !dreAtual ? (
              <div className="py-16 text-center text-xs text-slate-500 flex flex-col items-center justify-center gap-2">
                <AlertCircle className="w-8 h-8 text-amber-500" />
                <p className="font-semibold text-slate-700">
                  Nenhum dado financeiro cadastrado para a empresa no exercício de {selectedAno}
                </p>
              </div>
            ) : (
              <div className="h-72 sm:h-80 w-full">
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
            )}
          </CardContent>
        </Card>

        {/* Gráfico de Evolução Histórica dos 6 Principais Indicadores (5 colunas) */}
        <Card className="lg:col-span-5 bg-white border-slate-200 shadow-2xs overflow-hidden flex flex-col justify-between">
          <CardHeader className="pb-2 border-b border-slate-100 flex flex-row items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-50 text-blue-700 rounded-lg">
                  <LineChartIcon className="w-4 h-4" />
                </div>
                <CardTitle className="text-base font-bold text-[#0B1F3A]">
                  Evolução Histórica (3 Anos)
                </CardTitle>
              </div>
              <CardDescription className="text-xs text-slate-500 mt-0.5">
                Trajetória dos principais indicadores ({ano2}, {ano1}, {selectedAno})
              </CardDescription>
            </div>
            <Badge className="bg-slate-100 text-slate-700 text-[10px] font-mono">
              {hasHistorico ? '3 Exercícios' : 'Ano Base'}
            </Badge>
          </CardHeader>

          <CardContent className="p-4 sm:p-6 flex-1 flex flex-col justify-center">
            <div className="h-72 sm:h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={historicoLinhasData}
                  margin={{ top: 15, right: 20, left: 0, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis
                    dataKey="ano"
                    tick={{ fill: '#0B1F3A', fontSize: 12, fontWeight: 700 }}
                    stroke="#CBD5E1"
                  />
                  <YAxis
                    tick={{ fill: '#64748B', fontSize: 10 }}
                    stroke="#CBD5E1"
                    domain={['auto', 'auto']}
                  />
                  <RechartsTooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload || !payload.length) return null
                      return (
                        <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl text-xs space-y-1 border border-slate-700">
                          <strong className="block font-bold text-sm text-blue-300 border-b border-slate-700 pb-1">
                            Exercício de {label}
                          </strong>
                          {payload.map((p, idx) => (
                            <div key={idx} className="flex items-center justify-between gap-3">
                              <span className="flex items-center gap-1.5 text-slate-300">
                                <span
                                  className="w-2 h-2 rounded-full"
                                  style={{ backgroundColor: p.color }}
                                />
                                {p.name}:
                              </span>
                              <strong className="font-mono text-white">
                                {p.value !== null && p.value !== undefined
                                  ? `${p.value}${
                                      p.dataKey === 'liquidezCorrente'
                                        ? 'x'
                                        : p.dataKey === 'cicloFinanceiro'
                                          ? 'd'
                                          : '%'
                                    }`
                                  : '—'}
                              </strong>
                            </div>
                          ))}
                        </div>
                      )
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                    iconType="circle"
                    iconSize={8}
                  />
                  <Line
                    type="monotone"
                    name="Liq. Corrente"
                    dataKey="liquidezCorrente"
                    stroke="#2563EB"
                    strokeWidth={2.5}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                  <Line
                    type="monotone"
                    name="ROE (%)"
                    dataKey="roe"
                    stroke="#10B981"
                    strokeWidth={2.5}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                  <Line
                    type="monotone"
                    name="Margem Líq. (%)"
                    dataKey="margemLiquida"
                    stroke="#8B5CF6"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                  <Line
                    type="monotone"
                    name="Margem EBITDA (%)"
                    dataKey="margemEbitda"
                    stroke="#EC4899"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                  <Line
                    type="monotone"
                    name="Endividamento (%)"
                    dataKey="endividamentoGeral"
                    stroke="#F59E0B"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 4. SELETOR / FILTRO DE GRUPOS DE INDICADORES COM EXPANDIR / RECOLHER */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-blue-600 shrink-0" />
          <span className="text-xs font-bold text-[#0B1F3A] uppercase tracking-wider">
            Filtrar Grupos de Gráficos:
          </span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {[
              { id: 'todos', label: 'Todos os Grupos' },
              { id: 'liquidez', label: '1. Liquidez' },
              { id: 'capitalGiro', label: '2. Capital de Giro' },
              { id: 'endividamento', label: '3. Endividamento' },
              { id: 'rentabilidade', label: '4. Rentabilidade' },
              { id: 'estruturaCapital', label: '5. Estrutura' },
              { id: 'ebitda', label: '6. EBITDA' },
              { id: 'eficienciaOperacional', label: '7. Eficiência' },
              { id: 'economicos', label: '8. Econômicos' },
              { id: 'kanitz', label: '9. Kanitz (Insolvência)' },
            ].map((g) => (
              <Button
                key={g.id}
                type="button"
                variant={filtroGrupo === g.id ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFiltroGrupo(g.id)}
                className={`h-7 text-xs ${
                  filtroGrupo === g.id
                    ? 'bg-blue-600 text-white'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {g.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={expandirTodos}
            className="h-7 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50"
          >
            Expandir Todos
          </Button>
          <span className="text-slate-300">|</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={recolherTodos}
            className="h-7 text-xs text-slate-500 hover:text-slate-700"
          >
            Recolher Todos
          </Button>
        </div>
      </div>

      {/* 5. SEÇÃO DE GRÁFICOS DETALHADOS POR CADA UM DOS 7 GRUPOS DE INDICADORES */}
      <div className="space-y-6">
        {/* ========================================================================= */}
        {/* GRUPO 1: INDICADORES DE LIQUIDEZ */}
        {/* ========================================================================= */}
        {(gruposVisiveis === null || gruposVisiveis === 'liquidez') && (
          <Card className="bg-white border-slate-200 shadow-2xs overflow-hidden transition-all">
            <CardHeader
              className="p-4 sm:p-5 pb-3 border-b border-slate-100 flex flex-row items-center justify-between cursor-pointer hover:bg-slate-50/70 transition-colors"
              onClick={() => toggleGrupo('liquidez')}
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base font-bold text-[#0B1F3A]">
                      1. Indicadores de Liquidez &amp; Solvência
                    </CardTitle>
                    <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] font-bold">
                      Peso {pesos.liquidez}%
                    </Badge>
                  </div>
                  <CardDescription className="text-xs text-slate-500 mt-0.5">
                    Capacidade de pagamento a curto e longo prazo (LC, LS, LI, LG)
                  </CardDescription>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  onClick={(e) => e.stopPropagation()}
                  className="h-7 text-xs border-blue-200 text-blue-700 hover:bg-blue-50"
                >
                  <Link to="/indicadores/liquidez">
                    Módulo Detalhado <ArrowRight className="w-3 h-3 ml-1" />
                  </Link>
                </Button>
                <div className="text-slate-400 p-1">
                  {gruposExpandidos.liquidez ? (
                    <ChevronUp className="w-5 h-5" />
                  ) : (
                    <ChevronDown className="w-5 h-5" />
                  )}
                </div>
              </div>
            </CardHeader>

            {gruposExpandidos.liquidez && (
              <CardContent className="p-4 sm:p-6 space-y-6 animate-fadeIn">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                  {/* Gráfico de Barras Comparativo Empresa vs Benchmark */}
                  <div className="lg:col-span-7 h-72 sm:h-80 w-full bg-slate-50/50 p-3 sm:p-4 rounded-xl border border-slate-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-800">
                        Comparativo: Empresa vs Benchmark Setorial ({selectedSetorBenchmark})
                      </span>
                      <span className="text-[10px] text-slate-500">Escala em Múltiplos (x)</span>
                    </div>
                    <ResponsiveContainer width="100%" height="88%">
                      <BarChart
                        data={chartLiquidezData}
                        margin={{ top: 10, right: 10, left: -10, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                        <XAxis
                          dataKey="sigla"
                          tick={{ fill: '#0B1F3A', fontSize: 11, fontWeight: 700 }}
                        />
                        <YAxis tick={{ fill: '#64748B', fontSize: 10 }} />
                        <RechartsTooltip
                          content={({ active, payload }) => {
                            if (!active || !payload || !payload.length) return null
                            const d = payload[0].payload
                            return (
                              <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl text-xs space-y-1 border border-slate-700">
                                <strong className="block font-bold text-sm text-blue-300">
                                  {d.indicador}
                                </strong>
                                <div className="flex justify-between gap-4">
                                  <span className="text-slate-300">Empresa:</span>
                                  <strong className="text-white font-mono">
                                    {d.empresa !== null ? `${d.empresa.toFixed(2)}x` : '—'}
                                  </strong>
                                </div>
                                <div className="flex justify-between gap-4">
                                  <span className="text-slate-400">
                                    Benchmark ({selectedSetorBenchmark}):
                                  </span>
                                  <span className="text-slate-300 font-mono">
                                    {d.benchmark.toFixed(2)}x
                                  </span>
                                </div>
                                <div className="text-[10px] text-emerald-400 pt-1 border-t border-slate-800">
                                  Meta de Referência: {d.metaDesc}
                                </div>
                              </div>
                            )
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
                        <Bar
                          name={`Empresa (${selectedEmpresa?.nome || 'Atual'})`}
                          dataKey="empresa"
                          fill={primaryBrandColor}
                          radius={[4, 4, 0, 0]}
                        />
                        <Bar
                          name={`Benchmark (${selectedSetorBenchmark})`}
                          dataKey="benchmark"
                          fill="#94A3B8"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* 4 Mini Cards dos Indicadores de Liquidez */}
                  <div className="lg:col-span-5 grid grid-cols-2 gap-3">
                    {renderMiniCard(
                      'Liq. Corrente',
                      'LC',
                      indAtual.lc ? `${indAtual.lc.toFixed(2)}x` : '—',
                      `${benchmarkAtivo?.liquidezCorrente.toFixed(2) || '1.50'}x`,
                      indAtual.lc && indAtual.lc >= 1.5
                        ? 'bom'
                        : indAtual.lc && indAtual.lc >= 1.0
                          ? 'medio'
                          : 'ruim',
                      'Curto Prazo (AC/PC)',
                    )}
                    {renderMiniCard(
                      'Liq. Seca',
                      'LS',
                      indAtual.ls ? `${indAtual.ls.toFixed(2)}x` : '—',
                      `${benchmarkAtivo?.liquidezSeca.toFixed(2) || '1.00'}x`,
                      indAtual.ls && indAtual.ls >= 1.0
                        ? 'bom'
                        : indAtual.ls && indAtual.ls >= 0.7
                          ? 'medio'
                          : 'ruim',
                      'Sem Estoques',
                    )}
                    {renderMiniCard(
                      'Liq. Imediata',
                      'LI',
                      indAtual.li ? `${indAtual.li.toFixed(2)}x` : '—',
                      '0,30x',
                      indAtual.li && indAtual.li >= 0.3
                        ? 'bom'
                        : indAtual.li && indAtual.li >= 0.1
                          ? 'medio'
                          : 'ruim',
                      'Caixa / PC',
                    )}
                    {renderMiniCard(
                      'Liq. Geral',
                      'LG',
                      indAtual.lg ? `${indAtual.lg.toFixed(2)}x` : '—',
                      `${benchmarkAtivo?.liquidezGeral.toFixed(2) || '1.20'}x`,
                      indAtual.lg && indAtual.lg >= 1.2
                        ? 'bom'
                        : indAtual.lg && indAtual.lg >= 0.9
                          ? 'medio'
                          : 'ruim',
                      'Longo Prazo Total',
                    )}
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        )}

        {/* ========================================================================= */}
        {/* GRUPO NOVO: ANÁLISE DO CAPITAL DE GIRO (MODELO FLEURIET) */}
        {/* ========================================================================= */}
        {(gruposVisiveis === null || gruposVisiveis === 'capitalGiro') && (
          <Card className="bg-white border-slate-200 shadow-2xs overflow-hidden transition-all">
            <CardHeader
              className="p-4 sm:p-5 pb-3 border-b border-slate-100 flex flex-row items-center justify-between cursor-pointer hover:bg-slate-50/70 transition-colors"
              onClick={() => toggleGrupo('capitalGiro')}
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <Coins className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base font-bold text-[#0B1F3A]">
                      Análise do Capital de Giro (Modelo Fleuriet)
                    </CardTitle>
                    <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] font-bold">
                      CGL • NCG • ST
                    </Badge>
                  </div>
                  <CardDescription className="text-xs text-slate-500 mt-0.5">
                    Equilíbrio dinâmico entre fontes permanentes, giro operacional e tesouraria
                  </CardDescription>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  onClick={(e) => e.stopPropagation()}
                  className="h-7 text-xs border-blue-200 text-blue-700 hover:bg-blue-50"
                >
                  <Link to="/indicadores/capital-giro">
                    Módulo Detalhado <ArrowRight className="w-3 h-3 ml-1" />
                  </Link>
                </Button>
                <div className="text-slate-400 p-1">
                  {gruposExpandidos.capitalGiro ? (
                    <ChevronUp className="w-5 h-5" />
                  ) : (
                    <ChevronDown className="w-5 h-5" />
                  )}
                </div>
              </div>
            </CardHeader>

            {gruposExpandidos.capitalGiro && (
              <CardContent className="p-4 sm:p-6 space-y-6 animate-fadeIn">
                {/* Alerta de Saldo de Tesouraria Negativo / Efeito Tesoura */}
                {alertaStPainel.isNegativoAtual && (
                  <div className="p-3.5 sm:p-4 rounded-xl border border-red-300 bg-linear-to-r from-red-50 via-rose-50 to-amber-50 shadow-2xs space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-red-600 text-white font-extrabold text-[11px] px-2 py-0.5">
                          🔴 ALERTA: SALDO DE TESOURARIA NEGATIVO (ST &lt; 0)
                        </Badge>
                        {alertaStPainel.isConsecutivo3Anos ? (
                          <Badge className="bg-red-950 text-red-200 border border-red-700 text-[10px] font-bold">
                            ⚠️ Déficit por 3 Anos Consecutivos ({ano2}, {ano1}, {selectedAno})
                          </Badge>
                        ) : alertaStPainel.isConsecutivo2Anos ? (
                          <Badge className="bg-red-900 text-red-100 border border-red-700 text-[10px] font-bold">
                            ⚠️ Déficit Consecutivo ({ano1} e {selectedAno})
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold">
                            Exercício {selectedAno} Deficitário
                          </Badge>
                        )}
                      </div>
                      <span className="font-mono font-bold text-red-700 text-xs">
                        ST: {formatCurrency(indAtual.saldoTesouraria || 0)}
                      </span>
                    </div>
                    <p className="text-xs text-red-900/90 leading-relaxed text-justify">
                      <strong>
                        Risco de Efeito Tesoura / Dependência Bancária de Curto Prazo:
                      </strong>{' '}
                      O Capital de Giro Líquido não é suficiente para cobrir a Necessidade de
                      Capital de Giro da operação. A empresa recorre a dívidas bancárias onerosas de
                      curto prazo para manter suas atividades.
                      {alertaStPainel.isConsecutivo2Anos && (
                        <span className="block mt-1 font-semibold text-red-950">
                          Atenção: A tesouraria permaneceu deficitária consecutivamente nos anos de{' '}
                          {alertaStPainel.anosNegativos.join(', ')}, indicando estrangulamento
                          financeiro estrutural.
                        </span>
                      )}
                    </p>
                    <div className="pt-1.5 border-t border-red-200/70 flex items-center justify-between text-[11px] text-red-900">
                      <span>
                        <strong>Recomendação:</strong> Reestruturar perfil da dívida para longo
                        prazo e otimizar prazos operacionais (PMR/PMP).
                      </span>
                      <Link
                        to="/indicadores/capital-giro"
                        className="font-bold text-blue-700 hover:underline shrink-0 ml-2"
                      >
                        Ver Diagnóstico Completo &rarr;
                      </Link>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                  {/* Gráfico de Barras */}
                  <div className="lg:col-span-7 h-72 sm:h-80 w-full bg-slate-50/50 p-3 sm:p-4 rounded-xl border border-slate-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-800">
                        CGL, NCG, Saldo de Tesouraria (R$ mil) &amp; Liquidez (x10)
                      </span>
                      <span className="text-[10px] text-slate-500">Valores em R$ mil</span>
                    </div>
                    <ResponsiveContainer width="100%" height="88%">
                      <BarChart
                        data={chartCapitalGiroData}
                        margin={{ top: 10, right: 10, left: -10, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                        <XAxis
                          dataKey="sigla"
                          tick={{ fill: '#0B1F3A', fontSize: 11, fontWeight: 700 }}
                        />
                        <YAxis tick={{ fill: '#64748B', fontSize: 10 }} />
                        <RechartsTooltip
                          content={({ active, payload }) => {
                            if (!active || !payload || !payload.length) return null
                            const d = payload[0].payload
                            return (
                              <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl text-xs space-y-1 border border-slate-700">
                                <strong className="block font-bold text-sm text-blue-300">
                                  {d.indicador}
                                </strong>
                                <div className="flex justify-between gap-4">
                                  <span className="text-slate-300">Empresa:</span>
                                  <strong className="text-white font-mono">
                                    {d.realEmpresa || '—'}
                                  </strong>
                                </div>
                                <div className="flex justify-between gap-4">
                                  <span className="text-slate-400">Referência:</span>
                                  <span className="text-slate-300 font-mono">{d.realBench}</span>
                                </div>
                                <div className="text-[10px] text-emerald-400 pt-1 border-t border-slate-800">
                                  Meta: {d.metaDesc}
                                </div>
                              </div>
                            )
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
                        <Bar
                          name={`Empresa (${selectedEmpresa?.nome || 'Atual'})`}
                          dataKey="empresa"
                          fill="#3B82F6"
                          radius={[4, 4, 0, 0]}
                        />
                        <Bar
                          name="Benchmark / Referência"
                          dataKey="benchmark"
                          fill="#94A3B8"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* 4 Mini Cards */}
                  <div className="lg:col-span-5 grid grid-cols-2 gap-3">
                    {renderMiniCard(
                      'Cap. Giro Líquido',
                      'CGL',
                      indAtual.cgl !== null ? formatCurrency(indAtual.cgl) : '—',
                      '> R$ 0',
                      indAtual.cgl !== null && indAtual.cgl > 0
                        ? 'bom'
                        : indAtual.cgl === 0
                          ? 'medio'
                          : 'ruim',
                      'AC − PC',
                    )}
                    {renderMiniCard(
                      'Nec. Cap. Giro',
                      'NCG',
                      indAtual.ncg !== null ? formatCurrency(indAtual.ncg) : '—',
                      '≤ CGL',
                      indAtual.ncg !== null && indAtual.cgl !== null && indAtual.cgl >= indAtual.ncg
                        ? 'bom'
                        : 'medio',
                      'ACO − PCO',
                    )}
                    {renderMiniCard(
                      'Saldo Tesouraria',
                      'ST',
                      indAtual.saldoTesouraria !== null
                        ? formatCurrency(indAtual.saldoTesouraria)
                        : '—',
                      '> R$ 0',
                      indAtual.saldoTesouraria !== null && indAtual.saldoTesouraria > 0
                        ? 'bom'
                        : indAtual.saldoTesouraria === 0
                          ? 'medio'
                          : 'ruim',
                      'ACF − PCF ou CGL − NCG',
                    )}
                    {renderMiniCard(
                      'Liq. Corrente',
                      'LC',
                      indAtual.lc ? `${indAtual.lc.toFixed(2)}x` : '—',
                      `${benchmarkAtivo?.liquidezCorrente.toFixed(2) || '1.50'}x`,
                      indAtual.lc && indAtual.lc >= 1.2 ? 'bom' : 'medio',
                      'AC / PC',
                    )}
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        )}

        {/* ========================================================================= */}
        {/* GRUPO 2: INDICADORES DE ENDIVIDAMENTO */}
        {/* ========================================================================= */}
        {(gruposVisiveis === null || gruposVisiveis === 'endividamento') && (
          <Card className="bg-white border-slate-200 shadow-2xs overflow-hidden transition-all">
            <CardHeader
              className="p-4 sm:p-5 pb-3 border-b border-slate-100 flex flex-row items-center justify-between cursor-pointer hover:bg-slate-50/70 transition-colors"
              onClick={() => toggleGrupo('endividamento')}
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                  <TrendingDown className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base font-bold text-[#0B1F3A]">
                      2. Indicadores de Endividamento &amp; Alavancagem
                    </CardTitle>
                    <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] font-bold">
                      Peso {pesos.endividamento}%
                    </Badge>
                  </div>
                  <CardDescription className="text-xs text-slate-500 mt-0.5">
                    Proporção e qualidade das dívidas com terceiros (EG, CE, PCT, DL/EBITDA)
                  </CardDescription>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  onClick={(e) => e.stopPropagation()}
                  className="h-7 text-xs border-amber-200 text-amber-700 hover:bg-amber-50"
                >
                  <Link to="/indicadores/endividamento">
                    Módulo Detalhado <ArrowRight className="w-3 h-3 ml-1" />
                  </Link>
                </Button>
                <div className="text-slate-400 p-1">
                  {gruposExpandidos.endividamento ? (
                    <ChevronUp className="w-5 h-5" />
                  ) : (
                    <ChevronDown className="w-5 h-5" />
                  )}
                </div>
              </div>
            </CardHeader>

            {gruposExpandidos.endividamento && (
              <CardContent className="p-4 sm:p-6 space-y-6 animate-fadeIn">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                  {/* Gráfico de Barras */}
                  <div className="lg:col-span-7 h-72 sm:h-80 w-full bg-slate-50/50 p-3 sm:p-4 rounded-xl border border-slate-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-800">
                        Comparativo de Endividamento vs Setor (Menor é Melhor)
                      </span>
                      <span className="text-[10px] text-slate-500">
                        Valores em % (DL/EBITDA em x*10)
                      </span>
                    </div>
                    <ResponsiveContainer width="100%" height="88%">
                      <BarChart
                        data={chartEndividamentoData}
                        margin={{ top: 10, right: 10, left: -10, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                        <XAxis
                          dataKey="sigla"
                          tick={{ fill: '#0B1F3A', fontSize: 11, fontWeight: 700 }}
                        />
                        <YAxis tick={{ fill: '#64748B', fontSize: 10 }} />
                        <RechartsTooltip
                          content={({ active, payload }) => {
                            if (!active || !payload || !payload.length) return null
                            const d = payload[0].payload
                            return (
                              <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl text-xs space-y-1 border border-slate-700">
                                <strong className="block font-bold text-sm text-amber-300">
                                  {d.indicador}
                                </strong>
                                <div className="flex justify-between gap-4">
                                  <span className="text-slate-300">Empresa:</span>
                                  <strong className="text-white font-mono">
                                    {d.realEmpresa || (d.empresa !== null ? `${d.empresa}%` : '—')}
                                  </strong>
                                </div>
                                <div className="flex justify-between gap-4">
                                  <span className="text-slate-400">Benchmark:</span>
                                  <span className="text-slate-300 font-mono">
                                    {d.realBench || `${d.benchmark}%`}
                                  </span>
                                </div>
                                <div className="text-[10px] text-emerald-400 pt-1 border-t border-slate-800">
                                  Meta Saudável: {d.metaDesc}
                                </div>
                              </div>
                            )
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
                        <Bar
                          name={`Empresa (${selectedEmpresa?.nome || 'Atual'})`}
                          dataKey="empresa"
                          fill="#F59E0B"
                          radius={[4, 4, 0, 0]}
                        />
                        <Bar
                          name={`Benchmark (${selectedSetorBenchmark})`}
                          dataKey="benchmark"
                          fill="#94A3B8"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* 4 Mini Cards */}
                  <div className="lg:col-span-5 grid grid-cols-2 gap-3">
                    {renderMiniCard(
                      'Endiv. Geral',
                      'EG',
                      indAtual.eg ? `${indAtual.eg.toFixed(1)}%` : '—',
                      `${benchmarkAtivo?.endividamentoGeral.toFixed(1) || '50.0'}%`,
                      indAtual.eg && indAtual.eg <= 50
                        ? 'bom'
                        : indAtual.eg && indAtual.eg <= 70
                          ? 'medio'
                          : 'ruim',
                      'Passivo / Ativo',
                    )}
                    {renderMiniCard(
                      'Compos. Endiv.',
                      'CE',
                      indAtual.ce ? `${indAtual.ce.toFixed(1)}%` : '—',
                      `${benchmarkAtivo?.composicaoEndividamento.toFixed(1) || '60.0'}%`,
                      indAtual.ce && indAtual.ce <= 60
                        ? 'bom'
                        : indAtual.ce && indAtual.ce <= 80
                          ? 'medio'
                          : 'ruim',
                      'Curto Prazo / Passivo',
                    )}
                    {renderMiniCard(
                      'Cap. Terceiros',
                      'PCT',
                      indAtual.pct ? `${indAtual.pct.toFixed(1)}%` : '—',
                      `${benchmarkAtivo?.participacaoCapitalTerceiros.toFixed(1) || '100.0'}%`,
                      indAtual.pct && indAtual.pct <= 100
                        ? 'bom'
                        : indAtual.pct && indAtual.pct <= 150
                          ? 'medio'
                          : 'ruim',
                      'Passivo / PL',
                    )}
                    {renderMiniCard(
                      'Dív. Líq / EBITDA',
                      'DL/EBITDA',
                      indStandard.dividaLiquidaEbitda !== null
                        ? `${indStandard.dividaLiquidaEbitda.toFixed(2)}x`
                        : '—',
                      '2.50x',
                      indStandard.dividaLiquidaEbitda !== null &&
                        indStandard.dividaLiquidaEbitda <= 2.5
                        ? 'bom'
                        : indStandard.dividaLiquidaEbitda !== null &&
                            indStandard.dividaLiquidaEbitda <= 4.0
                          ? 'medio'
                          : 'ruim',
                      'Anos para Quitar',
                    )}
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        )}

        {/* ========================================================================= */}
        {/* GRUPO 3: INDICADORES DE RENTABILIDADE */}
        {/* ========================================================================= */}
        {(gruposVisiveis === null || gruposVisiveis === 'rentabilidade') && (
          <Card className="bg-white border-slate-200 shadow-2xs overflow-hidden transition-all">
            <CardHeader
              className="p-4 sm:p-5 pb-3 border-b border-slate-100 flex flex-row items-center justify-between cursor-pointer hover:bg-slate-50/70 transition-colors"
              onClick={() => toggleGrupo('rentabilidade')}
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base font-bold text-[#0B1F3A]">
                      3. Indicadores de Rentabilidade &amp; Retorno
                    </CardTitle>
                    <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-bold">
                      Peso {pesos.rentabilidade}%
                    </Badge>
                  </div>
                  <CardDescription className="text-xs text-slate-500 mt-0.5">
                    Retorno sobre capital próprio, ativos e margens (ROE, ROA, Margem Líquida,
                    Margem Operacional)
                  </CardDescription>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  onClick={(e) => e.stopPropagation()}
                  className="h-7 text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                >
                  <Link to="/indicadores/rentabilidade">
                    Módulo Detalhado <ArrowRight className="w-3 h-3 ml-1" />
                  </Link>
                </Button>
                <div className="text-slate-400 p-1">
                  {gruposExpandidos.rentabilidade ? (
                    <ChevronUp className="w-5 h-5" />
                  ) : (
                    <ChevronDown className="w-5 h-5" />
                  )}
                </div>
              </div>
            </CardHeader>

            {gruposExpandidos.rentabilidade && (
              <CardContent className="p-4 sm:p-6 space-y-6 animate-fadeIn">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                  {/* Gráfico de Barras */}
                  <div className="lg:col-span-7 h-72 sm:h-80 w-full bg-slate-50/50 p-3 sm:p-4 rounded-xl border border-slate-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-800">
                        Rentabilidade da Empresa vs Benchmark (%)
                      </span>
                      <span className="text-[10px] text-slate-500">Percentual ao Ano (%)</span>
                    </div>
                    <ResponsiveContainer width="100%" height="88%">
                      <BarChart
                        data={chartRentabilidadeData}
                        margin={{ top: 10, right: 10, left: -10, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                        <XAxis
                          dataKey="sigla"
                          tick={{ fill: '#0B1F3A', fontSize: 11, fontWeight: 700 }}
                        />
                        <YAxis tick={{ fill: '#64748B', fontSize: 10 }} />
                        <RechartsTooltip
                          content={({ active, payload }) => {
                            if (!active || !payload || !payload.length) return null
                            const d = payload[0].payload
                            return (
                              <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl text-xs space-y-1 border border-slate-700">
                                <strong className="block font-bold text-sm text-emerald-300">
                                  {d.indicador}
                                </strong>
                                <div className="flex justify-between gap-4">
                                  <span className="text-slate-300">Empresa:</span>
                                  <strong className="text-white font-mono">
                                    {d.empresa !== null ? `${d.empresa}%` : '—'}
                                  </strong>
                                </div>
                                <div className="flex justify-between gap-4">
                                  <span className="text-slate-400">Benchmark:</span>
                                  <span className="text-slate-300 font-mono">{d.benchmark}%</span>
                                </div>
                                <div className="text-[10px] text-emerald-400 pt-1 border-t border-slate-800">
                                  Meta: {d.metaDesc}
                                </div>
                              </div>
                            )
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
                        <Bar
                          name={`Empresa (${selectedEmpresa?.nome || 'Atual'})`}
                          dataKey="empresa"
                          fill="#10B981"
                          radius={[4, 4, 0, 0]}
                        />
                        <Bar
                          name={`Benchmark (${selectedSetorBenchmark})`}
                          dataKey="benchmark"
                          fill="#94A3B8"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* 4 Mini Cards */}
                  <div className="lg:col-span-5 grid grid-cols-2 gap-3">
                    {renderMiniCard(
                      'ROE (PL)',
                      'ROE',
                      indAtual.roe ? `${indAtual.roe.toFixed(1)}%` : '—',
                      `${benchmarkAtivo?.roe.toFixed(1) || '15.0'}%`,
                      indAtual.roe && indAtual.roe >= 15
                        ? 'bom'
                        : indAtual.roe && indAtual.roe >= 5
                          ? 'medio'
                          : 'ruim',
                      'Lucro Líq. / PL',
                    )}
                    {renderMiniCard(
                      'ROA (Ativo)',
                      'ROA',
                      indAtual.roa ? `${indAtual.roa.toFixed(1)}%` : '—',
                      `${benchmarkAtivo?.roa.toFixed(1) || '8.0'}%`,
                      indAtual.roa && indAtual.roa >= 8
                        ? 'bom'
                        : indAtual.roa && indAtual.roa >= 3
                          ? 'medio'
                          : 'ruim',
                      'Lucro Líq. / Ativo',
                    )}
                    {renderMiniCard(
                      'Margem Líquida',
                      'ML',
                      indAtual.ml ? `${indAtual.ml.toFixed(1)}%` : '—',
                      `${benchmarkAtivo?.margemLiquida.toFixed(1) || '10.0'}%`,
                      indAtual.ml && indAtual.ml >= 10
                        ? 'bom'
                        : indAtual.ml && indAtual.ml >= 5
                          ? 'medio'
                          : 'ruim',
                      'Lucro Líq. / Receita',
                    )}
                    {renderMiniCard(
                      'Margem Operac.',
                      'MO',
                      indStandard.margemOperacional
                        ? `${indStandard.margemOperacional.toFixed(1)}%`
                        : '—',
                      '13.0%',
                      indStandard.margemOperacional && indStandard.margemOperacional >= 12
                        ? 'bom'
                        : indStandard.margemOperacional && indStandard.margemOperacional >= 6
                          ? 'medio'
                          : 'ruim',
                      'EBIT / Receita',
                    )}
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        )}

        {/* ========================================================================= */}
        {/* GRUPO 4: ESTRUTURA DE CAPITAL */}
        {/* ========================================================================= */}
        {(gruposVisiveis === null || gruposVisiveis === 'estruturaCapital') && (
          <Card className="bg-white border-slate-200 shadow-2xs overflow-hidden transition-all">
            <CardHeader
              className="p-4 sm:p-5 pb-3 border-b border-slate-100 flex flex-row items-center justify-between cursor-pointer hover:bg-slate-50/70 transition-colors"
              onClick={() => toggleGrupo('estruturaCapital')}
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base font-bold text-[#0B1F3A]">
                      4. Estrutura de Capital &amp; Solidez Patrimonial
                    </CardTitle>
                    <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[10px] font-bold">
                      Peso {pesos.estruturaCapital}%
                    </Badge>
                  </div>
                  <CardDescription className="text-xs text-slate-500 mt-0.5">
                    Autonomia financeira, relação Dívida/Equity e imobilização do patrimônio
                  </CardDescription>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  onClick={(e) => e.stopPropagation()}
                  className="h-7 text-xs border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                >
                  <Link to="/indicadores/estrutura-capital">
                    Módulo Detalhado <ArrowRight className="w-3 h-3 ml-1" />
                  </Link>
                </Button>
                <div className="text-slate-400 p-1">
                  {gruposExpandidos.estruturaCapital ? (
                    <ChevronUp className="w-5 h-5" />
                  ) : (
                    <ChevronDown className="w-5 h-5" />
                  )}
                </div>
              </div>
            </CardHeader>

            {gruposExpandidos.estruturaCapital && (
              <CardContent className="p-4 sm:p-6 space-y-6 animate-fadeIn">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                  {/* Gráfico de Barras */}
                  <div className="lg:col-span-7 h-72 sm:h-80 w-full bg-slate-50/50 p-3 sm:p-4 rounded-xl border border-slate-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-800">
                        Estrutura Patrimonial vs Setor
                      </span>
                      <span className="text-[10px] text-slate-500">Valores em %</span>
                    </div>
                    <ResponsiveContainer width="100%" height="88%">
                      <BarChart
                        data={chartEstruturaData}
                        margin={{ top: 10, right: 10, left: -10, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                        <XAxis
                          dataKey="sigla"
                          tick={{ fill: '#0B1F3A', fontSize: 11, fontWeight: 700 }}
                        />
                        <YAxis tick={{ fill: '#64748B', fontSize: 10 }} />
                        <RechartsTooltip
                          content={({ active, payload }) => {
                            if (!active || !payload || !payload.length) return null
                            const d = payload[0].payload
                            return (
                              <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl text-xs space-y-1 border border-slate-700">
                                <strong className="block font-bold text-sm text-indigo-300">
                                  {d.indicador}
                                </strong>
                                <div className="flex justify-between gap-4">
                                  <span className="text-slate-300">Empresa:</span>
                                  <strong className="text-white font-mono">
                                    {d.realEmpresa || (d.empresa !== null ? `${d.empresa}%` : '—')}
                                  </strong>
                                </div>
                                <div className="flex justify-between gap-4">
                                  <span className="text-slate-400">Benchmark:</span>
                                  <span className="text-slate-300 font-mono">
                                    {d.realBench || `${d.benchmark}%`}
                                  </span>
                                </div>
                                <div className="text-[10px] text-emerald-400 pt-1 border-t border-slate-800">
                                  Referência: {d.metaDesc}
                                </div>
                              </div>
                            )
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
                        <Bar
                          name={`Empresa (${selectedEmpresa?.nome || 'Atual'})`}
                          dataKey="empresa"
                          fill="#6366F1"
                          radius={[4, 4, 0, 0]}
                        />
                        <Bar
                          name={`Benchmark (${selectedSetorBenchmark})`}
                          dataKey="benchmark"
                          fill="#94A3B8"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* 3 Mini Cards */}
                  <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-3">
                    {renderMiniCard(
                      'Autonomia Fin.',
                      'AF',
                      indAtual.af ? `${indAtual.af.toFixed(1)}%` : '—',
                      `${benchmarkAtivo?.autonomiaFinanceira.toFixed(1) || '50.0'}%`,
                      indAtual.af && indAtual.af >= 50
                        ? 'bom'
                        : indAtual.af && indAtual.af >= 30
                          ? 'medio'
                          : 'ruim',
                      'PL / Ativo Total',
                    )}
                    {renderMiniCard(
                      'Dívida / Equity',
                      'D/E',
                      indAtual.de ? `${indAtual.de.toFixed(2)}x` : '—',
                      `${benchmarkAtivo?.dividaEquity.toFixed(2) || '1.00'}x`,
                      indAtual.de && indAtual.de <= 1.0
                        ? 'bom'
                        : indAtual.de && indAtual.de <= 1.8
                          ? 'medio'
                          : 'ruim',
                      'Passivo Total / PL',
                    )}
                    {renderMiniCard(
                      'Imobiliz. do PL',
                      'IPL',
                      indAtual.ipl ? `${indAtual.ipl.toFixed(1)}%` : '—',
                      `${benchmarkAtivo?.imobilizacaoPL.toFixed(1) || '55.0'}%`,
                      indAtual.ipl && indAtual.ipl <= 55
                        ? 'bom'
                        : indAtual.ipl && indAtual.ipl <= 85
                          ? 'medio'
                          : 'ruim',
                      'Imobilizado / PL',
                    )}
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        )}

        {/* ========================================================================= */}
        {/* GRUPO 5: EBITDA (LAJIDA) */}
        {/* ========================================================================= */}
        {(gruposVisiveis === null || gruposVisiveis === 'ebitda') && (
          <Card className="bg-white border-slate-200 shadow-2xs overflow-hidden transition-all">
            <CardHeader
              className="p-4 sm:p-5 pb-3 border-b border-slate-100 flex flex-row items-center justify-between cursor-pointer hover:bg-slate-50/70 transition-colors"
              onClick={() => toggleGrupo('ebitda')}
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base font-bold text-[#0B1F3A]">
                      5. EBITDA (LAJIDA) &amp; Cobertura Financeira
                    </CardTitle>
                    <Badge className="bg-purple-50 text-purple-700 border-purple-200 text-[10px] font-bold">
                      Peso {pesos.ebitda}%
                    </Badge>
                  </div>
                  <CardDescription className="text-xs text-slate-500 mt-0.5">
                    Potencial de geração bruta de caixa e cobertura de juros operacionais
                  </CardDescription>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  onClick={(e) => e.stopPropagation()}
                  className="h-7 text-xs border-purple-200 text-purple-700 hover:bg-purple-50"
                >
                  <Link to="/indicadores/ebitda">
                    Módulo Detalhado <ArrowRight className="w-3 h-3 ml-1" />
                  </Link>
                </Button>
                <div className="text-slate-400 p-1">
                  {gruposExpandidos.ebitda ? (
                    <ChevronUp className="w-5 h-5" />
                  ) : (
                    <ChevronDown className="w-5 h-5" />
                  )}
                </div>
              </div>
            </CardHeader>

            {gruposExpandidos.ebitda && (
              <CardContent className="p-4 sm:p-6 space-y-6 animate-fadeIn">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                  {/* Gráfico de Barras */}
                  <div className="lg:col-span-7 h-72 sm:h-80 w-full bg-slate-50/50 p-3 sm:p-4 rounded-xl border border-slate-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-800">
                        EBITDA e Cobertura de Juros vs Setor
                      </span>
                      <span className="text-[10px] text-slate-500">
                        M. EBITDA (%) / Cob. Juros (x*10)
                      </span>
                    </div>
                    <ResponsiveContainer width="100%" height="88%">
                      <BarChart
                        data={chartEbitdaData}
                        margin={{ top: 10, right: 10, left: -10, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                        <XAxis
                          dataKey="sigla"
                          tick={{ fill: '#0B1F3A', fontSize: 11, fontWeight: 700 }}
                        />
                        <YAxis tick={{ fill: '#64748B', fontSize: 10 }} />
                        <RechartsTooltip
                          content={({ active, payload }) => {
                            if (!active || !payload || !payload.length) return null
                            const d = payload[0].payload
                            return (
                              <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl text-xs space-y-1 border border-slate-700">
                                <strong className="block font-bold text-sm text-purple-300">
                                  {d.indicador}
                                </strong>
                                <div className="flex justify-between gap-4">
                                  <span className="text-slate-300">Empresa:</span>
                                  <strong className="text-white font-mono">
                                    {d.realEmpresa || (d.empresa !== null ? `${d.empresa}%` : '—')}
                                  </strong>
                                </div>
                                <div className="flex justify-between gap-4">
                                  <span className="text-slate-400">Benchmark:</span>
                                  <span className="text-slate-300 font-mono">
                                    {d.realBench || `${d.benchmark}%`}
                                  </span>
                                </div>
                                <div className="text-[10px] text-emerald-400 pt-1 border-t border-slate-800">
                                  Referência: {d.metaDesc}
                                </div>
                              </div>
                            )
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
                        <Bar
                          name={`Empresa (${selectedEmpresa?.nome || 'Atual'})`}
                          dataKey="empresa"
                          fill="#8B5CF6"
                          radius={[4, 4, 0, 0]}
                        />
                        <Bar
                          name={`Benchmark (${selectedSetorBenchmark})`}
                          dataKey="benchmark"
                          fill="#94A3B8"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Mini Cards */}
                  <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
                    {renderMiniCard(
                      'Margem EBITDA',
                      'M. EBITDA',
                      indAtual.margemEbitda ? `${indAtual.margemEbitda.toFixed(1)}%` : '—',
                      `${benchmarkAtivo?.margemEbitda.toFixed(1) || '16.0'}%`,
                      indAtual.margemEbitda && indAtual.margemEbitda >= 15
                        ? 'bom'
                        : indAtual.margemEbitda && indAtual.margemEbitda >= 8
                          ? 'medio'
                          : 'ruim',
                      'EBITDA / Receita Líq.',
                    )}
                    {renderMiniCard(
                      'Cobertura Juros',
                      'Cob. Juros',
                      indAtual.coberturaJuros !== null
                        ? `${indAtual.coberturaJuros.toFixed(2)}x`
                        : '—',
                      `${benchmarkAtivo?.coberturaJuros.toFixed(2) || '3.00'}x`,
                      indAtual.coberturaJuros !== null && indAtual.coberturaJuros >= 3.0
                        ? 'bom'
                        : indAtual.coberturaJuros !== null && indAtual.coberturaJuros >= 1.5
                          ? 'medio'
                          : 'ruim',
                      'EBITDA / Desp. Financeiras',
                    )}
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        )}

        {/* ========================================================================= */}
        {/* GRUPO 6: EFICIÊNCIA OPERACIONAL & CICLOS */}
        {/* ========================================================================= */}
        {(gruposVisiveis === null || gruposVisiveis === 'eficienciaOperacional') && (
          <Card className="bg-white border-slate-200 shadow-2xs overflow-hidden transition-all">
            <CardHeader
              className="p-4 sm:p-5 pb-3 border-b border-slate-100 flex flex-row items-center justify-between cursor-pointer hover:bg-slate-50/70 transition-colors"
              onClick={() => toggleGrupo('eficienciaOperacional')}
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center font-bold">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base font-bold text-[#0B1F3A]">
                      6. Eficiência Operacional &amp; Ciclos de Caixa
                    </CardTitle>
                    <Badge className="bg-cyan-50 text-cyan-700 border-cyan-200 text-[10px] font-bold">
                      Peso {pesos.eficienciaOperacional}%
                    </Badge>
                  </div>
                  <CardDescription className="text-xs text-slate-500 mt-0.5">
                    Prazos médios de rotação (PMR, PME, PMP) e Ciclo Financeiro de tesouraria em
                    dias
                  </CardDescription>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  onClick={(e) => e.stopPropagation()}
                  className="h-7 text-xs border-cyan-200 text-cyan-700 hover:bg-cyan-50"
                >
                  <Link to="/indicadores/eficiencia-operacional">
                    Módulo Detalhado <ArrowRight className="w-3 h-3 ml-1" />
                  </Link>
                </Button>
                <div className="text-slate-400 p-1">
                  {gruposExpandidos.eficienciaOperacional ? (
                    <ChevronUp className="w-5 h-5" />
                  ) : (
                    <ChevronDown className="w-5 h-5" />
                  )}
                </div>
              </div>
            </CardHeader>

            {gruposExpandidos.eficienciaOperacional && (
              <CardContent className="p-4 sm:p-6 space-y-6 animate-fadeIn">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                  {/* Gráfico de Barras */}
                  <div className="lg:col-span-7 h-72 sm:h-80 w-full bg-slate-50/50 p-3 sm:p-4 rounded-xl border border-slate-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-800">
                        Prazos Médios e Ciclo Financeiro vs Setor (Dias)
                      </span>
                      <span className="text-[10px] text-slate-500">
                        Menor Ciclo = Mais Caixa Livre
                      </span>
                    </div>
                    <ResponsiveContainer width="100%" height="88%">
                      <BarChart
                        data={chartEficienciaData}
                        margin={{ top: 10, right: 10, left: -10, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                        <XAxis
                          dataKey="sigla"
                          tick={{ fill: '#0B1F3A', fontSize: 11, fontWeight: 700 }}
                        />
                        <YAxis tick={{ fill: '#64748B', fontSize: 10 }} />
                        <RechartsTooltip
                          content={({ active, payload }) => {
                            if (!active || !payload || !payload.length) return null
                            const d = payload[0].payload
                            return (
                              <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl text-xs space-y-1 border border-slate-700">
                                <strong className="block font-bold text-sm text-cyan-300">
                                  {d.indicador}
                                </strong>
                                <div className="flex justify-between gap-4">
                                  <span className="text-slate-300">Empresa:</span>
                                  <strong className="text-white font-mono">
                                    {d.empresa !== null ? `${d.empresa} dias` : '—'}
                                  </strong>
                                </div>
                                <div className="flex justify-between gap-4">
                                  <span className="text-slate-400">Benchmark:</span>
                                  <span className="text-slate-300 font-mono">
                                    {d.benchmark} dias
                                  </span>
                                </div>
                                <div className="text-[10px] text-emerald-400 pt-1 border-t border-slate-800">
                                  Meta: {d.metaDesc}
                                </div>
                              </div>
                            )
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
                        <Bar
                          name={`Empresa (${selectedEmpresa?.nome || 'Atual'})`}
                          dataKey="empresa"
                          fill="#06B6D4"
                          radius={[4, 4, 0, 0]}
                        />
                        <Bar
                          name={`Benchmark (${selectedSetorBenchmark})`}
                          dataKey="benchmark"
                          fill="#94A3B8"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* 4 Mini Cards */}
                  <div className="lg:col-span-5 grid grid-cols-2 gap-3">
                    {renderMiniCard(
                      'PMR (Receb.)',
                      'PMR',
                      indAtual.pmr ? `${Math.round(indAtual.pmr)}d` : '—',
                      `${benchmarkAtivo?.pmr || 45}d`,
                      indAtual.pmr && indAtual.pmr <= 45
                        ? 'bom'
                        : indAtual.pmr && indAtual.pmr <= 65
                          ? 'medio'
                          : 'ruim',
                      'Contas a Receber',
                    )}
                    {renderMiniCard(
                      'PME (Estoque)',
                      'PME',
                      indAtual.pme ? `${Math.round(indAtual.pme)}d` : '—',
                      `${benchmarkAtivo?.pme || 30}d`,
                      indAtual.pme && indAtual.pme <= 35
                        ? 'bom'
                        : indAtual.pme && indAtual.pme <= 60
                          ? 'medio'
                          : 'ruim',
                      'Giro dos Estoques',
                    )}
                    {renderMiniCard(
                      'PMP (Pagam.)',
                      'PMP',
                      indAtual.pmp ? `${Math.round(indAtual.pmp)}d` : '—',
                      `${benchmarkAtivo?.pmp || 40}d`,
                      indAtual.pmp && indAtual.pmp >= 40
                        ? 'bom'
                        : indAtual.pmp && indAtual.pmp >= 25
                          ? 'medio'
                          : 'ruim',
                      'Prazo Fornecedores',
                    )}
                    {renderMiniCard(
                      'Ciclo Financeiro',
                      'Ciclo Fin.',
                      indAtual.cf !== null ? `${Math.round(indAtual.cf)}d` : '—',
                      `${benchmarkAtivo?.cicloFinanceiro || 35}d`,
                      indAtual.cf !== null && indAtual.cf <= 35
                        ? 'bom'
                        : indAtual.cf !== null && indAtual.cf <= 60
                          ? 'medio'
                          : 'ruim',
                      'Necessidade de Capital',
                    )}
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        )}

        {/* ========================================================================= */}
        {/* GRUPO NOVO: TERMÔMETRO DE INSOLVÊNCIA DE KANITZ */}
        {/* ========================================================================= */}
        {(gruposVisiveis === null || gruposVisiveis === 'kanitz') && (
          <Card className="bg-white border-slate-200 shadow-2xs overflow-hidden transition-all">
            <CardHeader
              className="p-4 sm:p-5 pb-3 border-b border-slate-100 flex flex-row items-center justify-between cursor-pointer hover:bg-slate-50/70 transition-colors"
              onClick={() => toggleGrupo('kanitz')}
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
                  <Flame className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base font-bold text-[#0B1F3A]">
                      Termômetro de Insolvência de Kanitz
                    </CardTitle>
                    <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[10px] font-bold">
                      Peso {pesos.kanitz || 0}%
                    </Badge>
                  </div>
                  <CardDescription className="text-xs text-slate-500 mt-0.5">
                    Equação discriminante ponderando Rentabilidade, Liquidez Geral/Seca/Corrente e
                    Endividamento
                  </CardDescription>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  onClick={(e) => e.stopPropagation()}
                  className="h-7 text-xs border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                >
                  <Link to="/indicadores/kanitz">
                    Módulo Detalhado <ArrowRight className="w-3 h-3 ml-1" />
                  </Link>
                </Button>
                <div className="text-slate-400 p-1">
                  {gruposExpandidos.kanitz ? (
                    <ChevronUp className="w-5 h-5" />
                  ) : (
                    <ChevronDown className="w-5 h-5" />
                  )}
                </div>
              </div>
            </CardHeader>

            {gruposExpandidos.kanitz && (
              <CardContent className="p-4 sm:p-6 space-y-6 animate-fadeIn">
                {/* Alerta de Risco de Insolvência ou Penumbra */}
                {kanitzAtual.classificacao === 'insolvente' && (
                  <div className="p-3.5 sm:p-4 rounded-xl border border-rose-300 bg-linear-to-r from-rose-50 via-red-50 to-orange-50 shadow-2xs space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-rose-600 text-white font-extrabold text-[11px] px-2 py-0.5">
                          🔴 ALERTA: EMPRESA NA ZONA DE INSOLVÊNCIA (FI &lt; −3,00)
                        </Badge>
                        <Badge className="bg-rose-950 text-rose-200 border border-rose-700 text-[10px] font-bold">
                          FI: {kanitzAtual.fi !== null ? kanitzAtual.fi.toFixed(2) : '—'}
                        </Badge>
                      </div>
                      <Link
                        to="/indicadores/kanitz"
                        className="font-bold text-rose-800 hover:underline text-xs shrink-0"
                      >
                        Ver Diagnóstico Completo &rarr;
                      </Link>
                    </div>
                    <p className="text-xs text-rose-950 leading-relaxed text-justify">
                      {kanitzAtual.descricaoClassificacao}
                    </p>
                  </div>
                )}

                {kanitzAtual.classificacao === 'penumbra' && (
                  <div className="p-3.5 sm:p-4 rounded-xl border border-amber-300 bg-linear-to-r from-amber-50 via-yellow-50 to-orange-50 shadow-2xs space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-amber-600 text-white font-extrabold text-[11px] px-2 py-0.5">
                          🟠 ATENÇÃO: EMPRESA NA ZONA DE PENUMBRA (0 &gt; FI ≥ −3,00)
                        </Badge>
                        <Badge className="bg-amber-950 text-amber-200 border border-amber-700 text-[10px] font-bold">
                          FI: {kanitzAtual.fi !== null ? kanitzAtual.fi.toFixed(2) : '—'}
                        </Badge>
                      </div>
                      <Link
                        to="/indicadores/kanitz"
                        className="font-bold text-amber-900 hover:underline text-xs shrink-0"
                      >
                        Ver Detalhes do Risco &rarr;
                      </Link>
                    </div>
                    <p className="text-xs text-amber-950 leading-relaxed text-justify">
                      {kanitzAtual.descricaoClassificacao}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                  {/* Gráfico de Barras de Contribuição */}
                  <div className="lg:col-span-7 h-72 sm:h-80 w-full bg-slate-50/50 p-3 sm:p-4 rounded-xl border border-slate-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-800">
                        Contribuição das 5 Variáveis Contábeis no Fator de Kanitz (FI)
                      </span>
                      <span className="text-[10px] text-slate-500">
                        FI Atual: {kanitzAtual.fi !== null ? kanitzAtual.fi.toFixed(2) : '—'}
                      </span>
                    </div>
                    <ResponsiveContainer width="100%" height="88%">
                      <BarChart
                        data={chartKanitzData}
                        margin={{ top: 10, right: 10, left: -10, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                        <XAxis
                          dataKey="sigla"
                          tick={{ fill: '#0B1F3A', fontSize: 11, fontWeight: 700 }}
                        />
                        <YAxis tick={{ fill: '#64748B', fontSize: 10 }} />
                        <RechartsTooltip
                          content={({ active, payload }) => {
                            if (!active || !payload || !payload.length) return null
                            const d = payload[0].payload
                            return (
                              <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl text-xs space-y-1 border border-slate-700">
                                <strong className="block font-bold text-sm text-indigo-300">
                                  {d.indicador}
                                </strong>
                                <div className="flex justify-between gap-4">
                                  <span className="text-slate-300">Contribuição no FI:</span>
                                  <strong className="text-white font-mono">
                                    {d.realEmpresa || '—'}
                                  </strong>
                                </div>
                                <div className="text-[10px] text-indigo-300 pt-1 border-t border-slate-800">
                                  Fórmula: {d.metaDesc}
                                </div>
                              </div>
                            )
                          }}
                        />
                        <Bar dataKey="empresa" fill="#4F46E5" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* 4 Mini Cards de Kanitz */}
                  <div className="lg:col-span-5 grid grid-cols-2 gap-3">
                    {renderMiniCard(
                      'Fator Kanitz (FI)',
                      'FI',
                      kanitzAtual.fi !== null ? kanitzAtual.fi.toFixed(2) : '—',
                      'FI ≥ 0,00',
                      kanitzAtual.classificacao === 'solvente'
                        ? 'bom'
                        : kanitzAtual.classificacao === 'penumbra'
                          ? 'medio'
                          : kanitzAtual.classificacao === 'insolvente'
                            ? 'ruim'
                            : 'neutro',
                      'Modelo USP Kanitz',
                    )}
                    {renderMiniCard(
                      'Rentab. PL (X1)',
                      'X1',
                      kanitzAtual.variaveis[0]?.valor !== null &&
                        kanitzAtual.variaveis[0]?.valor !== undefined
                        ? `${(kanitzAtual.variaveis[0].valor * 100).toFixed(1)}%`
                        : '—',
                      'Peso 0,05',
                      kanitzAtual.variaveis[0]?.valor && kanitzAtual.variaveis[0].valor > 0
                        ? 'bom'
                        : 'ruim',
                      'Lucro Líquido / PL',
                    )}
                    {renderMiniCard(
                      'Liq. Seca (X3)',
                      'X3',
                      kanitzAtual.variaveis[2]?.valor !== null &&
                        kanitzAtual.variaveis[2]?.valor !== undefined
                        ? `${kanitzAtual.variaveis[2].valor.toFixed(2)}x`
                        : '—',
                      'Peso +3,55',
                      kanitzAtual.variaveis[2]?.valor && kanitzAtual.variaveis[2].valor >= 1.0
                        ? 'bom'
                        : 'medio',
                      '(AC − Est) / PC',
                    )}
                    {renderMiniCard(
                      'Grau Endiv. (X4)',
                      'X4',
                      kanitzAtual.variaveis[3]?.valor !== null &&
                        kanitzAtual.variaveis[3]?.valor !== undefined
                        ? `${kanitzAtual.variaveis[3].valor.toFixed(2)}x`
                        : '—',
                      'Peso −1,06',
                      kanitzAtual.variaveis[3]?.valor && kanitzAtual.variaveis[3].valor <= 1.0
                        ? 'bom'
                        : kanitzAtual.variaveis[3]?.valor && kanitzAtual.variaveis[3].valor <= 2.0
                          ? 'medio'
                          : 'ruim',
                      'Exigível / PL',
                    )}
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        )}

        {/* ========================================================================= */}
        {/* GRUPO 8: INDICADORES ECONÔMICOS & VALUATION */}
        {/* ========================================================================= */}
        {(gruposVisiveis === null || gruposVisiveis === 'economicos') && (
          <Card className="bg-white border-slate-200 shadow-2xs overflow-hidden transition-all">
            <CardHeader
              className="p-4 sm:p-5 pb-3 border-b border-slate-100 flex flex-row items-center justify-between cursor-pointer hover:bg-slate-50/70 transition-colors"
              onClick={() => toggleGrupo('economicos')}
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                  <Scale className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base font-bold text-[#0B1F3A]">
                      7. Indicadores Econômicos &amp; Criação de Valor
                    </CardTitle>
                    <Badge className="bg-rose-50 text-rose-700 border-rose-200 text-[10px] font-bold">
                      Peso {pesos.economicos}%
                    </Badge>
                  </div>
                  <CardDescription className="text-xs text-slate-500 mt-0.5">
                    ROIC, WACC, Spread Econômico e Giro dos Ativos
                  </CardDescription>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  onClick={(e) => e.stopPropagation()}
                  className="h-7 text-xs border-rose-200 text-rose-700 hover:bg-rose-50"
                >
                  <Link to="/indicadores/economicos">
                    Módulo Detalhado <ArrowRight className="w-3 h-3 ml-1" />
                  </Link>
                </Button>
                <div className="text-slate-400 p-1">
                  {gruposExpandidos.economicos ? (
                    <ChevronUp className="w-5 h-5" />
                  ) : (
                    <ChevronDown className="w-5 h-5" />
                  )}
                </div>
              </div>
            </CardHeader>

            {gruposExpandidos.economicos && (
              <CardContent className="p-4 sm:p-6 space-y-6 animate-fadeIn">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                  {/* Gráfico de Barras */}
                  <div className="lg:col-span-7 h-72 sm:h-80 w-full bg-slate-50/50 p-3 sm:p-4 rounded-xl border border-slate-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-800">
                        ROIC vs Custo de Capital WACC (%)
                      </span>
                      <span className="text-[10px] text-slate-500">
                        Spread Positivo = Criação de Riqueza
                      </span>
                    </div>
                    <ResponsiveContainer width="100%" height="88%">
                      <BarChart
                        data={chartEconomicosData}
                        margin={{ top: 10, right: 10, left: -10, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                        <XAxis
                          dataKey="sigla"
                          tick={{ fill: '#0B1F3A', fontSize: 11, fontWeight: 700 }}
                        />
                        <YAxis tick={{ fill: '#64748B', fontSize: 10 }} />
                        <RechartsTooltip
                          content={({ active, payload }) => {
                            if (!active || !payload || !payload.length) return null
                            const d = payload[0].payload
                            return (
                              <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl text-xs space-y-1 border border-slate-700">
                                <strong className="block font-bold text-sm text-rose-300">
                                  {d.indicador}
                                </strong>
                                <div className="flex justify-between gap-4">
                                  <span className="text-slate-300">Empresa:</span>
                                  <strong className="text-white font-mono">
                                    {d.realEmpresa || (d.empresa !== null ? `${d.empresa}%` : '—')}
                                  </strong>
                                </div>
                                <div className="flex justify-between gap-4">
                                  <span className="text-slate-400">Benchmark:</span>
                                  <span className="text-slate-300 font-mono">
                                    {d.realBench || `${d.benchmark}%`}
                                  </span>
                                </div>
                                <div className="text-[10px] text-emerald-400 pt-1 border-t border-slate-800">
                                  Meta: {d.metaDesc}
                                </div>
                              </div>
                            )
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
                        <Bar
                          name={`Empresa (${selectedEmpresa?.nome || 'Atual'})`}
                          dataKey="empresa"
                          fill="#F43F5E"
                          radius={[4, 4, 0, 0]}
                        />
                        <Bar
                          name={`Benchmark (${selectedSetorBenchmark})`}
                          dataKey="benchmark"
                          fill="#94A3B8"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* 4 Mini Cards */}
                  <div className="lg:col-span-5 grid grid-cols-2 gap-3">
                    {renderMiniCard(
                      'ROIC',
                      'ROIC',
                      indAtual.roic ? `${indAtual.roic.toFixed(1)}%` : '—',
                      `${benchmarkAtivo?.roic.toFixed(1) || '14.0'}%`,
                      indAtual.roic && indAtual.roic >= 14
                        ? 'bom'
                        : indAtual.roic && indAtual.roic >= 8
                          ? 'medio'
                          : 'ruim',
                      'Retorno Cap. Investido',
                    )}
                    {renderMiniCard(
                      'WACC',
                      'WACC',
                      '12,0%',
                      `${benchmarkAtivo?.wacc.toFixed(1) || '12.0'}%`,
                      'neutro',
                      'Custo Médio Ponderado',
                    )}
                    {renderMiniCard(
                      'Spread Econômico',
                      'Spread',
                      indAtual.spread !== null ? `${indAtual.spread.toFixed(1)}%` : '—',
                      `${benchmarkAtivo?.spread.toFixed(1) || '2.0'}%`,
                      indAtual.spread !== null && indAtual.spread > 0 ? 'bom' : 'ruim',
                      'ROIC – WACC',
                    )}
                    {renderMiniCard(
                      'Giro do Ativo',
                      'Giro',
                      indAtual.giroAtivo ? `${indAtual.giroAtivo.toFixed(2)}x` : '—',
                      `${benchmarkAtivo?.giroAtivo.toFixed(2) || '1.00'}x`,
                      indAtual.giroAtivo && indAtual.giroAtivo >= 1.0 ? 'bom' : 'medio',
                      'Receita / Ativo Total',
                    )}
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        )}
      </div>

      {/* 6. TABELA CONSOLIDADA DE EVOLUÇÃO COMPARATIVA VS BENCHMARK (3 ANOS) */}
      <Card className="bg-white border-slate-200 shadow-2xs">
        <CardHeader className="pb-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-blue-50 text-blue-700 rounded-lg">
                <Clock className="w-4 h-4" />
              </div>
              <CardTitle className="text-base font-bold text-[#0B1F3A]">
                Tabela Consolidada de Indicadores vs Setor ({selectedAno - 2}, {selectedAno - 1},{' '}
                {selectedAno})
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
                Ver histórico temporal
              </Label>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {!hasHistorico && verEvolucao ? (
            <div className="p-8 text-center text-xs text-slate-500 flex flex-col items-center justify-center gap-2">
              <Info className="w-6 h-6 text-slate-400" />
              <p className="font-semibold text-slate-700">
                Dados históricos parciais para análise temporal
              </p>
              <p className="text-[11px] text-slate-500 max-w-md">
                A empresa possui dados completos para {selectedAno}. Cadastre ou importe
                demonstrações contábeis de {ano1} e {ano2} para preencher os exercícios anteriores.
              </p>
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 font-bold text-slate-700 border-b border-slate-200 text-[11px]">
                  <th className="py-2.5 px-3">Grupo</th>
                  <th className="py-2.5 px-3">Indicador</th>
                  {verEvolucao && <th className="py-2.5 px-3 text-right">{ano2}</th>}
                  {verEvolucao && <th className="py-2.5 px-3 text-right">{ano1}</th>}
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
                      {verEvolucao && (
                        <td className="py-2 px-3 text-right font-mono text-slate-600">
                          {linha.ano2}
                        </td>
                      )}
                      {verEvolucao && (
                        <td className="py-2 px-3 text-right font-mono text-slate-600">
                          {linha.ano1}
                        </td>
                      )}
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
        </CardContent>
      </Card>

      {/* 7. CARDS DE ACESSO RÁPIDO ÀS PÁGINAS DE CADA MÓDULO */}
      <div className="space-y-3">
        <div className="flex items-center justify-between pb-1 border-b border-slate-200">
          <div>
            <h3 className="text-sm font-bold text-[#0B1F3A] uppercase tracking-wider">
              Módulos Específicos de Análise por Grupo
            </h3>
            <p className="text-xs text-slate-500">
              Navegue para o detalhamento profundo de fórmulas, variáveis contábeis e gráficos
              individuais
            </p>
          </div>
          <Badge className="bg-slate-100 text-slate-700 font-bold text-xs">
            8 Módulos Disponíveis
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
              title: 'Análise do Capital de Giro',
              desc: 'Modelo Fleuriet: Capital de Giro Líquido, NCG e Saldo de Tesouraria',
              path: '/indicadores/capital-giro',
              icon: Coins,
              badge: 'Fleuriet',
              color: 'text-blue-600 bg-blue-50',
              destaque: `ST: ${indAtual.saldoTesouraria !== null ? formatCurrency(indAtual.saldoTesouraria) : '—'}`,
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
            {
              title: 'Termômetro de Kanitz',
              desc: 'Modelo de previsão de insolvência e solvência corporativa clássica de Kanitz',
              path: '/indicadores/kanitz',
              icon: Flame,
              badge: 'Insolvência',
              color: 'text-orange-600 bg-orange-50',
              destaque: `FI: ${kanitzAtual.fi !== null ? kanitzAtual.fi.toFixed(2) : '—'} (${kanitzAtual.statusTexto.split(' ')[0]})`,
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

      {/* Modal de Impressão / PDF A4 do Dashboard Executivo */}
      <ModalPdfDashboardA4
        open={modalPdfOpen}
        onOpenChange={setModalPdfOpen}
        selectedEmpresa={selectedEmpresa}
        selectedAno={selectedAno}
        selectedCentroNome={
          selectedCentroCustoId !== 'all'
            ? centros.find((c) => c.id === selectedCentroCustoId)?.nome
            : undefined
        }
        minhaEmpresa={minhaEmpresa}
        logoUrl={logoUrl}
        scoreGeralPonderado={scoreGeralPonderado}
        perfilPesosNome={PERFIS_PESOS_PREDEFINIDOS[perfilPesos]?.nome || 'Padrão'}
        destaques={{
          ...destaques,
          saldoTesouraria: indAtual.saldoTesouraria,
          cgl: indAtual.cgl,
          cgb: indAtual.cgb,
          ncg: indAtual.ncg,
          tipoFleuriet: indAtual.tipoFleuriet,
          tipoFleurietNome: indAtual.tipoFleurietNome,
          tipoFleurietDescricao: indAtual.tipoFleurietDescricao,
          kanitzFi: kanitzAtual.fi,
          kanitzClassificacao: kanitzAtual.classificacao,
          kanitzStatusTexto: kanitzAtual.statusTexto,
          kanitzResultado: kanitzAtual,
        }}
        balancoAtual={balancoAtual}
        dreAtual={dreAtual}
        balancosAno={balancos}
        dresAno={dres}
        radarItems={radarItems}
        benchmarkAtivo={benchmarkAtivo}
        selectedSetorBenchmark={selectedSetorBenchmark}
        linhasEvolucao={linhasEvolucao}
        ano1={ano1}
        ano2={ano2}
        empresaB={selectedEmpresaB}
        anoB={anoEmpresaB}
        scoreGeralB={scoreGeralPonderadoB}
      />
    </div>
  )
}
