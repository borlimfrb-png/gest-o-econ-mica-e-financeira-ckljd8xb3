import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  DollarSign,
  PieChart as PieChartIcon,
  Maximize2,
  Minimize2,
  Printer,
  Download,
  Filter,
  RefreshCw,
  Building2,
  Calendar,
  Layers,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  SlidersHorizontal,
  ChevronRight,
  ShieldCheck,
  Scale,
  Package,
  FileText,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  HelpCircle,
} from 'lucide-react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ComposedChart,
} from 'recharts'

import { useFilter } from '@/contexts/FilterContext'
import { useAuth } from '@/contexts/AuthContext'
import { useRealtime } from '@/hooks/use-realtime'
import { useToast } from '@/hooks/use-toast'

import {
  empresasService,
  balancosService,
  dreService,
  gruposEmpresariaisService,
  consolidarBalancosPorGrupo,
  consolidarDrePorGrupo,
} from '@/services/financeService'
import { produtosService } from '@/services/formacaoPrecoService'
import { recebiveisService } from '@/services/recebiveisService'
import { notasFiscaisService } from '@/services/notasFiscaisService'
import { bscService } from '@/services/bscService'

import {
  calcularBalanco,
  calcularDre,
  calcularIndicadores,
  calcularCapitalGiro,
  gerarComparativoMensalAno,
  formatBrlMil,
  formatCurrency,
  formatNumber,
  formatPercent,
  consolidarBalancoAnual,
  consolidarDreAnual,
} from '@/lib/financeCalculations'
import { calcularScoreBscMomento, extrairFormulasDemonstracoes } from '@/lib/bscMonthlyCalculations'

import type {
  EmpresaRecord,
  GrupoEmpresarialRecord,
  BalancoRecord,
  DreRecord,
  ProdutoRecord,
  RecebivelRecord,
  NotaFiscalRecord,
  BscKpiRecord,
  BscIniciativaRecord,
} from '@/types/finance'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'

// Paleta de cores corporativa executiva
const COLORS = {
  navy: '#0B1F3A',
  blue: '#1E40AF',
  sky: '#0284C7',
  cyan: '#06B6D4',
  teal: '#0D9488',
  emerald: '#10B981',
  amber: '#F59E0B',
  rose: '#F43F5E',
  indigo: '#6366F1',
  violet: '#8B5CF6',
  slate: '#64748B',
}

const PIE_PALETTE_ATIVO = ['#1E40AF', '#0284C7', '#0D9488', '#F59E0B', '#6366F1']
const PIE_PALETTE_PASSIVO = ['#EF4444', '#F97316', '#3B82F6', '#10B981', '#64748B']
const STATUS_RECEBIVEL_PALETTE: Record<string, string> = {
  Pendente: '#F59E0B',
  Recebido: '#10B981',
  Atrasado: '#EF4444',
  Cancelado: '#94A3B8',
}

interface WidgetVisibilidade {
  kpis: boolean
  composicaoPatrimonio: boolean
  receitaLucro: boolean
  evolucaoMensal: boolean
  comparativoAnos: boolean
  notasTomadores: boolean
  recebiveis: boolean
  produtosCapacidade: boolean
  painelBsc: boolean
  detalhamentoModal?: boolean
}

export default function DashboardBi() {
  const { user } = useAuth()
  const { toast } = useToast()
  const {
    selectedEmpresaId,
    setSelectedEmpresaId,
    selectedAno,
    setSelectedAno,
    isGrupoAtivo,
    grupoAtivo,
    empresas: empresasDoContexto,
    grupos: gruposDoContexto,
    selectedEmpresa,
  } = useFilter()

  // Estado de tela cheia / modo apresentação
  const [modoApresentacao, setModoApresentacao] = useState(false)

  // Ano comparativo de base
  const [anoComparativo, setAnoComparativo] = useState<number>(() => {
    return (selectedAno || new Date().getFullYear()) - 1
  })

  // Sincroniza anoComparativo se selectedAno mudar
  useEffect(() => {
    if (selectedAno) {
      setAnoComparativo((prev) => (prev === selectedAno ? selectedAno - 1 : prev))
    }
  }, [selectedAno])

  // Visibilidade de widgets configurável
  const [widgets, setWidgets] = useState<WidgetVisibilidade>({
    kpis: true,
    composicaoPatrimonio: true,
    receitaLucro: true,
    evolucaoMensal: true,
    comparativoAnos: true,
    notasTomadores: true,
    recebiveis: true,
    produtosCapacidade: true,
    painelBsc: true,
  })

  // Cross-filter / Drill-down ativo
  const [filtroDrilldown, setFiltroDrilldown] = useState<{
    tipo: 'ativo' | 'passivo' | 'recebivel_status' | 'tomador' | 'produto' | null
    valor: string | null
    detalhes?: any
  }>({ tipo: null, valor: null })

  // Modal de detalhamento do drilldown
  const [modalDetalhesAberto, setModalDetalhesAberto] = useState(false)
  const [conteudoModalDetalhes, setConteudoModalDetalhes] = useState<{
    titulo: string
    subtitulo: string
    itens: Array<{ label: string; valor: string | number; extra?: string }>
  } | null>(null)

  // Dados brutos
  const [loading, setLoading] = useState(true)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const [empresas, setEmpresas] = useState<EmpresaRecord[]>([])
  const [grupos, setGrupos] = useState<GrupoEmpresarialRecord[]>([])
  const [balancos, setBalancos] = useState<BalancoRecord[]>([])
  const [dres, setDres] = useState<DreRecord[]>([])
  const [produtos, setProdutos] = useState<ProdutoRecord[]>([])
  const [recebiveis, setRecebiveis] = useState<RecebivelRecord[]>([])
  const [notasFiscais, setNotasFiscais] = useState<NotaFiscalRecord[]>([])
  const [kpisBsc, setKpisBsc] = useState<BscKpiRecord[]>([])
  const [iniciativasBsc, setIniciativasBsc] = useState<BscIniciativaRecord[]>([])

  // Assinaturas Realtime nas coleções relevantes
  const reloadData = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1)
  }, [])

  useRealtime('empresas', reloadData)
  useRealtime('balancos', reloadData)
  useRealtime('dre', reloadData)
  useRealtime('produtos', reloadData)
  useRealtime('recebiveis', reloadData)
  useRealtime('notas_fiscais', reloadData)
  useRealtime('bsc_kpis', reloadData)
  useRealtime('bsc_iniciativas', reloadData)

  // Carga inicial e sob filtros
  useEffect(() => {
    let cancelado = false
    async function carregarTudo() {
      setLoading(true)
      try {
        const [empRes, grupRes] = await Promise.all([
          empresasService.getAll(),
          gruposEmpresariaisService.getAll(),
        ])
        if (cancelado) return
        setEmpresas(empRes)
        setGrupos(grupRes)

        // Se nenhuma empresa ou grupo estiver selecionado, auto-seleciona a primeira empresa
        if (!selectedEmpresaId && empRes.length > 0) {
          setSelectedEmpresaId(empRes[0].id)
        }

        // Buscar demonstrações e operacionais
        const [balRes, dreRes, prodRes, recRes, nfRes, kpiRes, iniRes] = await Promise.all([
          balancosService.getAll(),
          dreService.getAll(),
          produtosService.getAll(),
          recebiveisService.listarPorPeriodo().catch(() => [] as RecebivelRecord[]),
          notasFiscaisService.listar().catch(() => [] as NotaFiscalRecord[]),
          bscService.getAll().catch(() => [] as BscKpiRecord[]),
          bscService.getAllIniciativas().catch(() => [] as BscIniciativaRecord[]),
        ])

        if (cancelado) return
        setBalancos(balRes)
        setDres(dreRes)
        setProdutos(prodRes)
        setRecebiveis(recRes)
        setNotasFiscais(nfRes)
        setKpisBsc(kpiRes)
        setIniciativasBsc(iniRes)
      } catch (err) {
        console.error('Erro ao carregar dados do Dashboard BI:', err)
        toast({
          title: 'Erro ao carregar indicadores',
          description: 'Não foi possível carregar as informações do BI.',
          variant: 'destructive',
        })
      } finally {
        if (!cancelado) setLoading(false)
      }
    }

    carregarTudo()
    return () => {
      cancelado = true
    }
  }, [refreshTrigger, toast])

  // Empresas ativas sob o escopo selecionado (individual ou grupo)
  const empresasNoEscopo = useMemo<EmpresaRecord[]>(() => {
    if (isGrupoAtivo && grupoAtivo) {
      const idsNoGrupo = grupoAtivo.empresas || []
      return empresas.filter((e) => idsNoGrupo.includes(e.id))
    }
    if (selectedEmpresaId) {
      return empresas.filter((e) => e.id === selectedEmpresaId)
    }
    return empresas.slice(0, 1)
  }, [empresas, isGrupoAtivo, grupoAtivo, selectedEmpresaId])

  const idsEmpresasEscopo = useMemo(
    () => new Set(empresasNoEscopo.map((e) => e.id)),
    [empresasNoEscopo],
  )

  const nomeEntidadeExibida = useMemo(() => {
    if (isGrupoAtivo && grupoAtivo) {
      return `Grupo: ${grupoAtivo.nome}`
    }
    if (selectedEmpresa) {
      return selectedEmpresa.nome
    }
    const e = empresas.find((item) => item.id === selectedEmpresaId)
    return e ? e.nome : 'Empresa Selecionada'
  }, [isGrupoAtivo, grupoAtivo, selectedEmpresa, empresas, selectedEmpresaId])

  // Balanços e DREs consolidados sob o escopo
  const balancosEscopo = useMemo(() => {
    if (isGrupoAtivo) {
      return balancos.filter((b) => idsEmpresasEscopo.has(b.empresa))
    }
    return balancos.filter((b) => b.empresa === selectedEmpresaId)
  }, [balancos, isGrupoAtivo, idsEmpresasEscopo, selectedEmpresaId])

  const dresEscopo = useMemo(() => {
    if (isGrupoAtivo) {
      return dres.filter((d) => idsEmpresasEscopo.has(d.empresa))
    }
    return dres.filter((d) => d.empresa === selectedEmpresaId)
  }, [dres, isGrupoAtivo, idsEmpresasEscopo, selectedEmpresaId])

  // Balanço e DRE consolidados do Ano Atual e do Ano Anterior
  const { balancoAtual, dreAtual, balancoAnt, dreAnt } = useMemo(() => {
    const anoA = selectedAno || new Date().getFullYear()
    const anoB = anoComparativo

    const bAtual = consolidarBalancoAnual(balancosEscopo, anoA)
    const dAtual = consolidarDreAnual(dresEscopo, anoA)
    const bAnt = consolidarBalancoAnual(balancosEscopo, anoB)
    const dAnt = consolidarDreAnual(dresEscopo, anoB)

    return { balancoAtual: bAtual, dreAtual: dAtual, balancoAnt: bAnt, dreAnt: dAnt }
  }, [selectedAno, anoComparativo, balancosEscopo, dresEscopo])

  // Indicadores calculados Ano Atual
  const indAtual = useMemo(() => {
    return calcularIndicadores(balancoAtual, dreAtual)
  }, [balancoAtual, dreAtual])

  // Indicadores calculados Ano Anterior
  const indAnt = useMemo(() => {
    return calcularIndicadores(balancoAnt, dreAnt)
  }, [balancoAnt, dreAnt])

  // Balanço e DRE formatados estruturalmente
  const calcBalAtual = useMemo(() => calcularBalanco(balancoAtual), [balancoAtual])
  const calcBalAnt = useMemo(() => calcularBalanco(balancoAnt), [balancoAnt])
  const calcDreAtual = useMemo(() => calcularDre(dreAtual), [dreAtual])
  const calcDreAnt = useMemo(() => calcularDre(dreAnt), [dreAnt])

  // Capital de Giro e Prazos Médios
  const cgAtual = useMemo(
    () => calcularCapitalGiro(balancoAtual, dreAtual),
    [balancoAtual, dreAtual],
  )
  const cgAnt = useMemo(() => calcularCapitalGiro(balancoAnt, dreAnt), [balancoAnt, dreAnt])

  // Série Mensal para gráficos de linha (caso haja dados mensais)
  const serieMensal = useMemo(() => {
    const anoA = selectedAno || new Date().getFullYear()
    return gerarComparativoMensalAno(balancosEscopo, dresEscopo, anoA)
  }, [selectedAno, balancosEscopo, dresEscopo])

  const temDadosMensais = useMemo(() => {
    return serieMensal.filter((m) => m.temDados).length > 1
  }, [serieMensal])

  // Dados para Donut: Composição do Ativo
  const dadosComposicaoAtivo = useMemo(() => {
    if (!balancoAtual) return []
    const b = balancoAtual
    const disponivel = (b.caixa_equivalentes || 0) + (b.aplicacoes_financeiras || 0)
    const clientes = b.contas_receber || 0
    const estoques = b.estoques || 0
    const outrosCirc = (b.impostos_recuperar || 0) + (b.outros_ativo_circulante || 0)
    const imobilizado = (b.imobilizado || 0) + (b.intangivel || 0) + (b.realizavel_longo_prazo || 0)

    const itens = [
      { name: 'Disponibilidades (Caixa/Aplicações)', value: disponivel, chave: 'disponivel' },
      { name: 'Contas a Receber (Clientes)', value: clientes, chave: 'clientes' },
      { name: 'Estoques', value: estoques, chave: 'estoques' },
      { name: 'Outros Circulantes', value: outrosCirc, chave: 'outrosCirc' },
      { name: 'Ativo Não Circulante (Imobilizado)', value: imobilizado, chave: 'imobilizado' },
    ].filter((i) => i.value > 0)

    return itens
  }, [balancoAtual])

  // Dados para Donut: Composição do Passivo e PL
  const dadosComposicaoPassivo = useMemo(() => {
    if (!balancoAtual) return []
    const b = balancoAtual
    const fornecedores = b.fornecedores || 0
    const emprestimos = (b.emprestimos_curto_prazo || 0) + (b.emprestimos_longo_prazo || 0)
    const obrigacoes =
      (b.obrigacoes_trabalhistas || 0) +
      (b.obrigacoes_tributarias || 0) +
      (b.outros_passivo_circulante || 0)
    const pnc = b.outros_passivo_nao_circulante || 0
    const pl = calcBalAtual.patrimonioLiquido > 0 ? calcBalAtual.patrimonioLiquido : 0

    const itens = [
      { name: 'Fornecedores', value: fornecedores, chave: 'fornecedores' },
      { name: 'Empréstimos / Dívida Financeira', value: emprestimos, chave: 'emprestimos' },
      { name: 'Obrigações Fiscais/Trabalhistas', value: obrigacoes, chave: 'obrigacoes' },
      { name: 'Outros Passivos LP', value: pnc, chave: 'pnc' },
      { name: 'Patrimônio Líquido (Capital Próprio)', value: pl, chave: 'pl' },
    ].filter((i) => i.value > 0)

    return itens
  }, [balancoAtual, calcBalAtual.patrimonioLiquido])

  // Receitas por Tomador (Top 10 a partir de notas_fiscais)
  const dadosReceitasPorTomador = useMemo(() => {
    const anoA = selectedAno || new Date().getFullYear()
    const nfEscopo = notasFiscais.filter((n) => {
      if (n.status === 'Cancelada') return false
      if (!idsEmpresasEscopo.has(n.empresa)) return false
      const anoNota = n.data_emissao ? new Date(n.data_emissao).getFullYear() : null
      return anoNota === anoA
    })

    const mapa = new Map<string, { nome: string; total: number; qtd: number }>()
    nfEscopo.forEach((n) => {
      const nomeTomador = n.tomador_razao_social || 'Cliente Geral'
      const valor = n.valor_liquido || n.valor_servicos || 0
      const reg = mapa.get(nomeTomador) || { nome: nomeTomador, total: 0, qtd: 0 }
      reg.total += valor
      reg.qtd += 1
      mapa.set(nomeTomador, reg)
    })

    const lista = Array.from(mapa.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)

    return lista
  }, [notasFiscais, idsEmpresasEscopo])

  // Situação dos Recebíveis (Aberto, Pago, Atrasado, etc.)
  const dadosSituacaoRecebiveis = useMemo(() => {
    const recEscopo = recebiveis.filter((r) => {
      if (!r.empresa) return false
      return idsEmpresasEscopo.has(r.empresa)
    })

    const agora = new Date()
    const mapa: Record<string, { total: number; count: number }> = {
      Pendente: { total: 0, count: 0 },
      Recebido: { total: 0, count: 0 },
      Atrasado: { total: 0, count: 0 },
      Cancelado: { total: 0, count: 0 },
    }

    recEscopo.forEach((r) => {
      let st: string = r.status || 'Pendente'
      if (st === 'Pendente' && r.vencimento) {
        const venc = new Date(r.vencimento)
        if (venc < agora) {
          st = 'Atrasado'
        }
      }
      if (!mapa[st]) {
        mapa[st] = { total: 0, count: 0 }
      }
      const val = Number(r.valor_liquido || r.valor_parcela || 0)
      mapa[st].total += val
      mapa[st].count += 1
    })

    return Object.entries(mapa)
      .filter(([_, d]) => d.count > 0 || d.total > 0)
      .map(([status, d]) => ({
        status,
        valor: d.total,
        quantidade: d.count,
        color: STATUS_RECEBIVEL_PALETTE[status] || COLORS.slate,
      }))
  }, [recebiveis, idsEmpresasEscopo])

  // Capacidade de Produção vs Quantidade Vendida por Produto
  const dadosProdutosCapacidade = useMemo(() => {
    const prodEscopo = produtos.filter((p) => {
      if (!p.empresa) return true
      return idsEmpresasEscopo.has(p.empresa)
    })

    return prodEscopo
      .filter((p) => (p.capacidade_producao || 0) > 0 || (p.quantidade_vendida || 0) > 0)
      .map((p) => {
        const cap = Number(p.capacidade_producao || 0)
        const vend = Number(p.quantidade_vendida || 0)
        const ociosa = Math.max(0, cap - vend)
        const ociosidadePct = cap > 0 ? (ociosa / cap) * 100 : 0
        const utilizacaoPct = cap > 0 ? (vend / cap) * 100 : 0
        const gargalo = vend > cap
        return {
          id: p.id,
          nome: p.nome,
          codigo: p.codigo || '',
          capacidade: cap,
          vendido: vend,
          ociosa,
          ociosidadePct,
          utilizacaoPct,
          gargalo,
        }
      })
      .slice(0, 10)
  }, [produtos, idsEmpresasEscopo])

  // Score BSC e Iniciativas de Planos de Ação
  const dadosBscPainel = useMemo(() => {
    const anoA = selectedAno || new Date().getFullYear()
    const kpisEscopo = kpisBsc.filter((k) => {
      if (!idsEmpresasEscopo.has(k.empresa)) return false
      return k.ano === anoA
    })

    const formulasCalculadas = extrairFormulasDemonstracoes(balancoAtual, dreAtual, dreAnt || null)
    const momento = calcularScoreBscMomento(kpisEscopo, formulasCalculadas)

    // Iniciativas no escopo
    const iniEscopo = iniciativasBsc.filter((i) => {
      if (!i.empresa) return true
      return idsEmpresasEscopo.has(i.empresa)
    })

    const agora = new Date()
    const emAtraso = iniEscopo.filter((i) => {
      if (i.status === 'concluida' || i.status === 'cancelada') return false
      if (!i.prazo) return false
      return new Date(i.prazo) < agora
    })

    const proximasVencer = iniEscopo.filter((i) => {
      if (i.status === 'concluida' || i.status === 'cancelada') return false
      if (!i.prazo) return false
      const venc = new Date(i.prazo)
      const diffDias = (venc.getTime() - agora.getTime()) / (1000 * 3600 * 24)
      return diffDias >= 0 && diffDias <= 15
    })

    return {
      kpisEscopo,
      scoreGlobal: momento.scoreGlobal,
      scorePorPerspectiva: momento.scorePorPerspectiva,
      totalAvaliados: momento.totalAvaliados,
      atingidos: momento.atingidos,
      abaixo: momento.abaixo,
      proximos: momento.proximos,
      totalIniciativas: iniEscopo.length,
      emAtraso,
      proximasVencer,
    }
  }, [kpisBsc, idsEmpresasEscopo, balancoAtual, dreAtual, dreAnt, iniciativasBsc])

  // Comparativo Ano A vs Ano B em barras agrupadas
  const dadosComparativoAnual = useMemo(() => {
    const anoA = selectedAno || new Date().getFullYear()
    const anoB = anoComparativo

    return [
      {
        indicador: 'Ativo Total',
        [anoA]: calcBalAtual.ativoTotal / 1000,
        [anoB]: calcBalAnt.ativoTotal / 1000,
        unidade: 'R$ mil',
      },
      {
        indicador: 'Patrimônio Líquido',
        [anoA]: calcBalAtual.patrimonioLiquido / 1000,
        [anoB]: calcBalAnt.patrimonioLiquido / 1000,
        unidade: 'R$ mil',
      },
      {
        indicador: 'Receita Líquida',
        [anoA]: calcDreAtual.receitaLiquida / 1000,
        [anoB]: calcDreAnt.receitaLiquida / 1000,
        unidade: 'R$ mil',
      },
      {
        indicador: 'EBITDA',
        [anoA]: calcDreAtual.ebitda / 1000,
        [anoB]: calcDreAnt.ebitda / 1000,
        unidade: 'R$ mil',
      },
      {
        indicador: 'Lucro Líquido',
        [anoA]: calcDreAtual.lucroLiquido / 1000,
        [anoB]: calcDreAnt.lucroLiquido / 1000,
        unidade: 'R$ mil',
      },
      {
        indicador: 'Margem Líquida (%)',
        [anoA]: indAtual.margemLiquida ?? 0,
        [anoB]: indAnt.margemLiquida ?? 0,
        unidade: '%',
      },
      {
        indicador: 'ROE (%)',
        [anoA]: indAtual.roe ?? 0,
        [anoB]: indAnt.roe ?? 0,
        unidade: '%',
      },
      {
        indicador: 'Liquidez Corrente',
        [anoA]: indAtual.liquidezCorrente ?? 0,
        [anoB]: indAnt.liquidezCorrente ?? 0,
        unidade: 'índice',
      },
    ]
  }, [anoComparativo, calcBalAtual, calcBalAnt, calcDreAtual, calcDreAnt, indAtual, indAnt])

  // Helper para variação percentual com seta e cor
  const renderVariacao = (
    valAtual: number | null | undefined,
    valAnt: number | null | undefined,
    invertido = false,
  ) => {
    if (
      valAtual === null ||
      valAtual === undefined ||
      valAnt === null ||
      valAnt === undefined ||
      valAnt === 0
    ) {
      return (
        <span className="text-[11px] text-slate-400 font-normal flex items-center gap-0.5">
          <span>vs. {anoComparativo}:</span>
          <span className="font-medium">—</span>
        </span>
      )
    }

    const varPct = ((valAtual - valAnt) / Math.abs(valAnt)) * 100
    const subiu = varPct > 0
    const neutro = Math.abs(varPct) < 0.1

    let cor = 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200'
    if (invertido ? subiu : !subiu) {
      cor = 'text-rose-600 bg-rose-50 dark:bg-rose-950/40 border-rose-200'
    }
    if (neutro) {
      cor = 'text-slate-500 bg-slate-50 border-slate-200'
    }

    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        <span
          className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${cor}`}
        >
          {subiu ? (
            <ArrowUpRight className="w-3 h-3 stroke-[2.5]" />
          ) : (
            <ArrowDownRight className="w-3 h-3 stroke-[2.5]" />
          )}
          {Math.abs(varPct).toFixed(1)}%
        </span>
        <span className="text-[10px] text-slate-500">vs. {anoComparativo}</span>
      </div>
    )
  }

  // Tratamento de drill-down ao clicar em fatias ou barras
  const handleDrilldownClick = (
    tipo: 'ativo' | 'passivo' | 'recebivel_status' | 'tomador' | 'produto',
    item: any,
  ) => {
    if (
      filtroDrilldown.tipo === tipo &&
      filtroDrilldown.valor === (item.name || item.status || item.nome)
    ) {
      // Limpa filtro se clicar no mesmo
      setFiltroDrilldown({ tipo: null, valor: null })
      return
    }

    const valorChave = item.name || item.status || item.nome || ''
    setFiltroDrilldown({ tipo, valor: valorChave, detalhes: item })

    // Abre modal com detalhes tabulares do item clicado
    if (tipo === 'ativo' || tipo === 'passivo') {
      setConteudoModalDetalhes({
        titulo: `Detalhamento: ${item.name}`,
        subtitulo: `Valores contábeis consolidados para o exercício ${selectedAno}`,
        itens: [
          { label: 'Valor Contábil', valor: formatCurrency(item.value) },
          {
            label: 'Participação Relativa',
            valor: `${(
              (item.value /
                (tipo === 'ativo'
                  ? calcBalAtual.ativoTotal || 1
                  : calcBalAtual.passivoTotal || 1)) *
              100
            ).toFixed(1)}%`,
          },
          { label: 'Exercício', valor: `${selectedAno}` },
          { label: 'Entidade', valor: nomeEntidadeExibida },
        ],
      })
      setModalDetalhesAberto(true)
    } else if (tipo === 'tomador') {
      const nfTomador = notasFiscais.filter(
        (n) => n.tomador_razao_social === item.nome && idsEmpresasEscopo.has(n.empresa),
      )
      setConteudoModalDetalhes({
        titulo: `Detalhamento do Cliente: ${item.nome}`,
        subtitulo: `Faturamento e notas emitidas no ano ${selectedAno}`,
        itens: [
          { label: 'Faturamento Total', valor: formatCurrency(item.total) },
          { label: 'Total de Notas Emitidas', valor: item.qtd },
          {
            label: 'Ticket Médio por Nota',
            valor: item.qtd > 0 ? formatCurrency(item.total / item.qtd) : '—',
          },
          {
            label: 'Última Nota Emitida',
            valor: nfTomador[0]?.numero ? `Nº ${nfTomador[0].numero}` : '—',
          },
        ],
      })
      setModalDetalhesAberto(true)
    } else if (tipo === 'recebivel_status') {
      const parcelasStatus = recebiveis.filter((r) => {
        if (!idsEmpresasEscopo.has(r.empresa)) return false
        if (item.status === 'Atrasado') {
          return r.status === 'Pendente' && r.vencimento && new Date(r.vencimento) < new Date()
        }
        return r.status === item.status
      })
      setConteudoModalDetalhes({
        titulo: `Recebíveis: Status "${item.status}"`,
        subtitulo: `Total de títulos em carteira e montante a liquidar`,
        itens: [
          { label: 'Volume Total em R$', valor: formatCurrency(item.valor) },
          { label: 'Quantidade de Títulos', valor: item.quantidade },
          {
            label: 'Valor Médio por Título',
            valor: item.quantidade > 0 ? formatCurrency(item.valor / item.quantidade) : '—',
          },
          {
            label: 'Amostra de Títulos',
            valor:
              parcelasStatus
                .slice(0, 3)
                .map((p) => `Parcela ${p.numero_parcela || 1} (${formatCurrency(p.valor_parcela)})`)
                .join(' · ') || 'Sem títulos',
          },
        ],
      })
      setModalDetalhesAberto(true)
    } else if (tipo === 'produto') {
      setConteudoModalDetalhes({
        titulo: `Capacidade Operacional: ${item.nome}`,
        subtitulo: `Balanço de produção e vendas do produto`,
        itens: [
          { label: 'Capacidade Instalada', valor: `${formatNumber(item.capacidade, 0)} un.` },
          { label: 'Volume Vendido', valor: `${formatNumber(item.vendido, 0)} un.` },
          {
            label: 'Taxa de Ocupação',
            valor: `${item.utilizacaoPct.toFixed(1)}%`,
          },
          {
            label: 'Capacidade Ociosa',
            valor: `${formatNumber(item.ociosa, 0)} un. (${item.ociosidadePct.toFixed(1)}%)`,
          },
          {
            label: 'Diagnóstico Operacional',
            valor: item.gargalo
              ? 'ALERTA DE GARGALO: Demanda superior à capacidade máxima!'
              : item.ociosidadePct > 40
                ? 'ATENÇÃO: Alta ociosidade fabril instalada.'
                : 'Adequado e equilibrado.',
          },
        ],
      })
      setModalDetalhesAberto(true)
    }
  }

  // Exportação para Impressão / PDF do Dashboard
  const handleImprimir = () => {
    window.print()
  }

  // Exportação CSV com todos os dados tabulares do BI
  const handleExportarCsv = () => {
    try {
      const anoA = selectedAno || new Date().getFullYear()
      const linhas: string[] = []

      linhas.push(`DASHBOARD DE BI EXECUTIVO - ${nomeEntidadeExibida.toUpperCase()}`)
      linhas.push(`Exercício Analisado;${anoA};Comparativo;${anoComparativo}`)
      linhas.push(
        `Data de Geração;${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}`,
      )
      linhas.push('')

      // 1. KPIs
      linhas.push('INDICADORES EXECUTIVOS;ANO ATUAL;ANO ANTERIOR;UNIDADE')
      linhas.push(`Ativo Total;${calcBalAtual.ativoTotal};${calcBalAnt.ativoTotal};BRL`)
      linhas.push(`Passivo Total;${calcBalAtual.passivoTotal};${calcBalAnt.passivoTotal};BRL`)
      linhas.push(
        `Patrimônio Líquido;${calcBalAtual.patrimonioLiquido};${calcBalAnt.patrimonioLiquido};BRL`,
      )
      linhas.push(`Receita Líquida;${calcDreAtual.receitaLiquida};${calcDreAnt.receitaLiquida};BRL`)
      linhas.push(`EBITDA;${calcDreAtual.ebitda};${calcDreAnt.ebitda};BRL`)
      linhas.push(`Lucro Líquido;${calcDreAtual.lucroLiquido};${calcDreAnt.lucroLiquido};BRL`)
      linhas.push(`Margem Bruta;${indAtual.margemBruta ?? ''};${indAnt.margemBruta ?? ''};%`)
      linhas.push(
        `Margem Operacional;${indAtual.margemOperacional ?? ''};${indAnt.margemOperacional ?? ''};%`,
      )
      linhas.push(`Margem Líquida;${indAtual.margemLiquida ?? ''};${indAnt.margemLiquida ?? ''};%`)
      linhas.push(`ROE;${indAtual.roe ?? ''};${indAnt.roe ?? ''};%`)
      linhas.push(`ROA;${indAtual.roa ?? ''};${indAnt.roa ?? ''};%`)
      linhas.push(
        `Liquidez Corrente;${indAtual.liquidezCorrente ?? ''};${indAnt.liquidezCorrente ?? ''};indice`,
      )
      linhas.push(
        `Liquidez Seca;${indAtual.liquidezSeca ?? ''};${indAnt.liquidezSeca ?? ''};indice`,
      )
      linhas.push(
        `Liquidez Imediata;${indAtual.liquidezImediata ?? ''};${indAnt.liquidezImediata ?? ''};indice`,
      )
      linhas.push(
        `Endividamento Geral;${indAtual.endividamentoGeral ?? ''};${indAnt.endividamentoGeral ?? ''};%`,
      )
      linhas.push(`Prazo Médio Recebimento (PMR);${cgAtual.pmr ?? ''};${cgAnt.pmr ?? ''};dias`)
      linhas.push(`Prazo Médio Pagamento (PMP);${cgAtual.pmp ?? ''};${cgAnt.pmp ?? ''};dias`)
      linhas.push(
        `Ciclo Financeiro;${cgAtual.cicloFinanceiro ?? ''};${cgAnt.cicloFinanceiro ?? ''};dias`,
      )
      linhas.push('')

      // 2. Composição Ativo
      linhas.push('COMPOSICAO DO ATIVO;VALOR (R$)')
      dadosComposicaoAtivo.forEach((it) => {
        linhas.push(`${it.name};${it.value}`)
      })
      linhas.push('')

      // 3. Composição Passivo
      linhas.push('COMPOSICAO DO PASSIVO E PL;VALOR (R$)')
      dadosComposicaoPassivo.forEach((it) => {
        linhas.push(`${it.name};${it.value}`)
      })
      linhas.push('')

      // 4. Receitas por Tomador
      linhas.push('TOP CLIENTES / TOMADORES DE RECEITA;VALOR TOTAL (R$);QTD NOTAS')
      dadosReceitasPorTomador.forEach((it) => {
        linhas.push(`${it.nome};${it.total};${it.qtd}`)
      })
      linhas.push('')

      // 5. Recebíveis
      linhas.push('SITUACAO DE RECEBIVEIS;VALOR TOTAL (R$);QTD PARCELAS')
      dadosSituacaoRecebiveis.forEach((it) => {
        linhas.push(`${it.status};${it.valor};${it.quantidade}`)
      })
      linhas.push('')

      // 6. Produtos & Capacidade
      linhas.push(
        'CAPACIDADE E VENDAS POR PRODUTO;CAPACIDADE INSTALADA;QUANTIDADE VENDIDA;OCIOSIDADE (%)',
      )
      dadosProdutosCapacidade.forEach((it) => {
        linhas.push(`${it.nome};${it.capacidade};${it.vendido};${it.ociosidadePct.toFixed(1)}%`)
      })

      const conteudoCsv = '\uFEFF' + linhas.join('\n')
      const blob = new Blob([conteudoCsv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.setAttribute('href', url)
      link.setAttribute('download', `BI_${nomeEntidadeExibida.replace(/\s+/g, '_')}_${anoA}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast({
        title: 'Exportação CSV Concluída',
        description: 'Os dados do dashboard de BI foram baixados com sucesso.',
      })
    } catch (e) {
      console.error(e)
      toast({
        title: 'Erro na exportação',
        description: 'Não foi possível gerar a planilha CSV.',
        variant: 'destructive',
      })
    }
  }

  // Checagem de ausência total de dados
  const semDadosContabeis = !balancoAtual && !dreAtual

  return (
    <div
      className={`min-h-screen bg-[#F5F7FA] text-slate-800 transition-all ${
        modoApresentacao
          ? 'fixed inset-0 z-50 overflow-y-auto bg-slate-900 text-white p-4 sm:p-8'
          : 'p-4 sm:p-6 lg:p-8'
      }`}
    >
      {/* CABEÇALHO DO BI & CONTROLES */}
      <div className="mb-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-800/90 rounded-2xl p-4 sm:p-6 border border-slate-200/80 shadow-xs print:hidden">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-blue-600/10 text-blue-600 flex items-center justify-center font-bold">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-extrabold text-[#0B1F3A] dark:text-white tracking-tight flex items-center gap-2">
                  <span>Dashboard BI Interativo</span>
                  <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 font-semibold text-xs">
                    Apresentação Executiva
                  </Badge>
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                  Painel analítico completo para demonstração estratégica aos gestores e
                  investidores da empresa.
                </p>
              </div>
            </div>
          </div>

          {/* Ações do cabeçalho */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Seletor do ano comparativo */}
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-700 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-600 text-xs font-medium">
              <span className="text-slate-500 dark:text-slate-300">Comparar com:</span>
              <select
                value={anoComparativo}
                onChange={(e) => setAnoComparativo(Number(e.target.value))}
                className="bg-transparent font-bold text-blue-600 dark:text-blue-400 outline-hidden cursor-pointer"
              >
                {[...Array(6)].map((_, i) => {
                  const anoOp = (selectedAno || new Date().getFullYear()) - (i + 1)
                  return (
                    <option key={anoOp} value={anoOp} className="text-slate-800">
                      {anoOp}
                    </option>
                  )
                })}
              </select>
            </div>

            {/* Alternância Empresa vs Grupo */}
            {grupos.length > 0 && (
              <Button
                variant={isGrupoAtivo ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  if (isGrupoAtivo) {
                    // Volta para a primeira empresa
                    if (empresas.length > 0) {
                      setSelectedEmpresaId(empresas[0].id)
                    }
                  } else {
                    // Seleciona o primeiro grupo
                    if (grupos.length > 0) {
                      setSelectedEmpresaId(`grupo-${grupos[0].id}`)
                    }
                  }
                }}
                className="gap-1.5 text-xs font-semibold rounded-xl"
              >
                <Layers className="w-3.5 h-3.5" />
                {isGrupoAtivo ? 'Consolidado do Grupo' : 'Visão por Empresa'}
              </Button>
            )}

            {/* Ocultar/Mostrar Widgets (Popover) */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs rounded-xl">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
                  <span>Widgets</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                className="w-72 p-4 space-y-3 z-50 bg-white shadow-xl rounded-xl border"
              >
                <div className="font-bold text-xs text-slate-800 border-b pb-2 flex items-center justify-between">
                  <span>Exibir no Dashboard</span>
                  <Badge variant="secondary" className="text-[10px]">
                    Customizável
                  </Badge>
                </div>
                <div className="space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="w-kpis" className="cursor-pointer">
                      Cards Executivos (KPIs)
                    </Label>
                    <Switch
                      id="w-kpis"
                      checked={widgets.kpis}
                      onCheckedChange={(c) => setWidgets((w) => ({ ...w, kpis: c }))}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="w-patrimonio" className="cursor-pointer">
                      Composição Patrimonial (Donut)
                    </Label>
                    <Switch
                      id="w-patrimonio"
                      checked={widgets.composicaoPatrimonio}
                      onCheckedChange={(c) =>
                        setWidgets((w) => ({ ...w, composicaoPatrimonio: c }))
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="w-rec-lucro" className="cursor-pointer">
                      Receita × Lucro
                    </Label>
                    <Switch
                      id="w-rec-lucro"
                      checked={widgets.receitaLucro}
                      onCheckedChange={(c) => setWidgets((w) => ({ ...w, receitaLucro: c }))}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="w-evolucao" className="cursor-pointer">
                      Evolução Mensal (Linhas)
                    </Label>
                    <Switch
                      id="w-evolucao"
                      checked={widgets.evolucaoMensal}
                      onCheckedChange={(c) => setWidgets((w) => ({ ...w, evolucaoMensal: c }))}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="w-comparativo" className="cursor-pointer">
                      Comparativo Ano A × B
                    </Label>
                    <Switch
                      id="w-comparativo"
                      checked={widgets.comparativoAnos}
                      onCheckedChange={(c) => setWidgets((w) => ({ ...w, comparativoAnos: c }))}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="w-tomadores" className="cursor-pointer">
                      Top Clientes / Tomadores
                    </Label>
                    <Switch
                      id="w-tomadores"
                      checked={widgets.notasTomadores}
                      onCheckedChange={(c) => setWidgets((w) => ({ ...w, notasTomadores: c }))}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="w-rec" className="cursor-pointer">
                      Situação dos Recebíveis
                    </Label>
                    <Switch
                      id="w-rec"
                      checked={widgets.recebiveis}
                      onCheckedChange={(c) => setWidgets((w) => ({ ...w, recebiveis: c }))}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="w-prod" className="cursor-pointer">
                      Capacidade Fabril / Produtos
                    </Label>
                    <Switch
                      id="w-prod"
                      checked={widgets.produtosCapacidade}
                      onCheckedChange={(c) => setWidgets((w) => ({ ...w, produtosCapacidade: c }))}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="w-bsc" className="cursor-pointer">
                      Painel BSC & Planos de Ação
                    </Label>
                    <Switch
                      id="w-bsc"
                      checked={widgets.painelBsc}
                      onCheckedChange={(c) => setWidgets((w) => ({ ...w, painelBsc: c }))}
                    />
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            {/* Exportar CSV */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportarCsv}
              className="gap-1.5 text-xs rounded-xl"
              title="Exportar dados do dashboard em planilha CSV"
            >
              <Download className="w-3.5 h-3.5 text-blue-600" />
              <span>CSV</span>
            </Button>

            {/* Imprimir / Salvar PDF */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleImprimir}
              className="gap-1.5 text-xs rounded-xl"
              title="Imprimir ou salvar PDF com layout limpo"
            >
              <Printer className="w-3.5 h-3.5 text-slate-600" />
              <span>Imprimir</span>
            </Button>

            {/* Modo Apresentação / Tela Cheia */}
            <Button
              variant={modoApresentacao ? 'secondary' : 'default'}
              size="sm"
              onClick={() => setModoApresentacao(!modoApresentacao)}
              className="gap-1.5 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white"
            >
              {modoApresentacao ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5" />
                  <span>Sair Apresentação</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>Modo Apresentação</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Barra de Filtro Drill-down Ativo (se houver) */}
        {filtroDrilldown.tipo && (
          <div className="flex items-center justify-between gap-3 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200 px-4 py-2.5 rounded-xl text-xs shadow-xs animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-blue-600 animate-pulse" />
              <span>
                Filtro Interativo Ativo (Cross-filter): <strong>{filtroDrilldown.valor}</strong>{' '}
                <span className="opacity-80">({filtroDrilldown.tipo})</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setModalDetalhesAberto(true)}
                className="h-7 text-xs text-blue-700 hover:bg-blue-100"
              >
                Ver Detalhes
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFiltroDrilldown({ tipo: null, valor: null })}
                className="h-7 text-xs bg-white text-slate-700 hover:bg-slate-50 border-blue-200"
              >
                Limpar Filtro
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* BANNER DE IDENTIFICAÇÃO NA APRESENTAÇÃO */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-[#0B1F3A] to-[#1E3A8A] text-white p-4 sm:p-5 rounded-2xl shadow-md border border-blue-900/40">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-xs">
            <Building2 className="w-6 h-6 text-blue-300" />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-blue-200 font-semibold">
              Entidade em Análise
            </div>
            <div className="text-lg sm:text-xl font-bold tracking-tight">{nomeEntidadeExibida}</div>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <div className="bg-white/10 px-3.5 py-1.5 rounded-xl flex items-center gap-2 border border-white/10">
            <Calendar className="w-4 h-4 text-amber-300" />
            <span>
              Exercício Base: <strong>{selectedAno}</strong>
            </span>
          </div>
          <div className="bg-white/10 px-3.5 py-1.5 rounded-xl flex items-center gap-2 border border-white/10">
            <Activity className="w-4 h-4 text-emerald-300" />
            <span>
              Comparado a: <strong>{anoComparativo}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* ESTADO VAZIO: SEM DADOS NO ANO */}
      {semDadosContabeis && (
        <Card className="border-amber-200 bg-amber-50/50 mb-8 rounded-2xl shadow-xs">
          <CardContent className="p-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 mx-auto flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">
              Nenhuma Demonstração Contábil Encontrada para {selectedAno}
            </h3>
            <p className="text-xs text-slate-600 max-w-lg mx-auto">
              Para visualizar os indicadores patrimoniais, liquidez, rentabilidade e composição
              deste ano, importe o balancete ou realize os lançamentos anuais no menu{' '}
              <strong>Importação</strong> ou <strong>Balanço & DRE</strong>.
            </p>
          </CardContent>
        </Card>
      )}

      {/* 1. SEÇÃO DE KPIS EXECUTIVOS EM CARDS GRANDES */}
      {widgets.kpis && (
        <div className="mb-8 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-600" />
              <span>Indicadores Chave de Performance (KPIs)</span>
            </h2>
            <span className="text-xs text-slate-400">
              Valores calculados em tempo real vs. {anoComparativo}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {/* Ativo Total */}
            <Card className="rounded-2xl border-slate-200/90 shadow-xs hover:shadow-md transition-shadow">
              <CardContent className="p-5 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="font-semibold">Ativo Total</span>
                  <DollarSign className="w-4 h-4 text-blue-600" />
                </div>
                <div className="text-2xl font-black text-[#0B1F3A] dark:text-white">
                  {formatCurrency(calcBalAtual.ativoTotal)}
                </div>
                {renderVariacao(calcBalAtual.ativoTotal, calcBalAnt.ativoTotal)}
              </CardContent>
            </Card>

            {/* Passivo Total */}
            <Card className="rounded-2xl border-slate-200/90 shadow-xs hover:shadow-md transition-shadow">
              <CardContent className="p-5 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="font-semibold">Passivo Exigível</span>
                  <Scale className="w-4 h-4 text-rose-600" />
                </div>
                <div className="text-2xl font-black text-[#0B1F3A] dark:text-white">
                  {formatCurrency(calcBalAtual.passivoTotal)}
                </div>
                {renderVariacao(calcBalAtual.passivoTotal, calcBalAnt.passivoTotal, true)}
              </CardContent>
            </Card>

            {/* Patrimônio Líquido */}
            <Card className="rounded-2xl border-slate-200/90 shadow-xs hover:shadow-md transition-shadow">
              <CardContent className="p-5 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="font-semibold">Patrimônio Líquido (PL)</span>
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="text-2xl font-black text-[#0B1F3A] dark:text-white">
                  {formatCurrency(calcBalAtual.patrimonioLiquido)}
                </div>
                {renderVariacao(calcBalAtual.patrimonioLiquido, calcBalAnt.patrimonioLiquido)}
              </CardContent>
            </Card>

            {/* Receita Líquida */}
            <Card className="rounded-2xl border-slate-200/90 shadow-xs hover:shadow-md transition-shadow">
              <CardContent className="p-5 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="font-semibold">Receita Líquida</span>
                  <TrendingUp className="w-4 h-4 text-indigo-600" />
                </div>
                <div className="text-2xl font-black text-[#0B1F3A] dark:text-white">
                  {formatCurrency(calcDreAtual.receitaLiquida)}
                </div>
                {renderVariacao(calcDreAtual.receitaLiquida, calcDreAnt.receitaLiquida)}
              </CardContent>
            </Card>

            {/* EBITDA */}
            <Card className="rounded-2xl border-slate-200/90 shadow-xs hover:shadow-md transition-shadow">
              <CardContent className="p-5 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="font-semibold">EBITDA (LAJIDA)</span>
                  <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700">
                    Operacional
                  </Badge>
                </div>
                <div className="text-2xl font-black text-[#0B1F3A] dark:text-white">
                  {formatCurrency(calcDreAtual.ebitda)}
                </div>
                {renderVariacao(calcDreAtual.ebitda, calcDreAnt.ebitda)}
              </CardContent>
            </Card>

            {/* Lucro Líquido & Margem Líquida */}
            <Card className="rounded-2xl border-slate-200/90 shadow-xs hover:shadow-md transition-shadow">
              <CardContent className="p-5 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="font-semibold">Lucro Líquido</span>
                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    Mg: {formatPercent(indAtual.margemLiquida, 1)}
                  </span>
                </div>
                <div
                  className={`text-2xl font-black ${
                    calcDreAtual.lucroLiquido >= 0 ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                >
                  {formatCurrency(calcDreAtual.lucroLiquido)}
                </div>
                {renderVariacao(calcDreAtual.lucroLiquido, calcDreAnt.lucroLiquido)}
              </CardContent>
            </Card>

            {/* ROE & ROA */}
            <Card className="rounded-2xl border-slate-200/90 shadow-xs hover:shadow-md transition-shadow">
              <CardContent className="p-5 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="font-semibold">ROE (Retorno s/ PL)</span>
                  <span className="text-[11px] font-semibold text-slate-400">
                    ROA: {formatPercent(indAtual.roa, 1)}
                  </span>
                </div>
                <div className="text-2xl font-black text-[#0B1F3A] dark:text-white">
                  {formatPercent(indAtual.roe, 1)}
                </div>
                {renderVariacao(indAtual.roe, indAnt.roe)}
              </CardContent>
            </Card>

            {/* Liquidez Corrente & Seca */}
            <Card className="rounded-2xl border-slate-200/90 shadow-xs hover:shadow-md transition-shadow">
              <CardContent className="p-5 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="font-semibold">Liquidez Corrente</span>
                  <span className="text-[11px] font-semibold text-slate-400">
                    Seca: {formatNumber(indAtual.liquidezSeca, 2)}x
                  </span>
                </div>
                <div className="text-2xl font-black text-[#0B1F3A] dark:text-white">
                  {formatNumber(indAtual.liquidezCorrente, 2)}x
                </div>
                {renderVariacao(indAtual.liquidezCorrente, indAnt.liquidezCorrente)}
              </CardContent>
            </Card>

            {/* Endividamento Geral */}
            <Card className="rounded-2xl border-slate-200/90 shadow-xs hover:shadow-md transition-shadow">
              <CardContent className="p-5 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="font-semibold">Endividamento Geral</span>
                  <span className="text-[10px] text-slate-400">Passivo / Ativo</span>
                </div>
                <div className="text-2xl font-black text-[#0B1F3A] dark:text-white">
                  {formatPercent(indAtual.endividamentoGeral, 1)}
                </div>
                {renderVariacao(indAtual.endividamentoGeral, indAnt.endividamentoGeral, true)}
              </CardContent>
            </Card>

            {/* Prazo Médio Recebimento vs Pagamento */}
            <Card className="rounded-2xl border-slate-200/90 shadow-xs hover:shadow-md transition-shadow">
              <CardContent className="p-5 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="font-semibold">PMR vs. PMP</span>
                  <Clock className="w-4 h-4 text-amber-500" />
                </div>
                <div className="text-2xl font-black text-[#0B1F3A] dark:text-white">
                  {cgAtual.pmr !== null ? `${Math.round(cgAtual.pmr)} dias` : '—'}
                </div>
                <div className="text-[11px] text-slate-500">
                  PMP:{' '}
                  <strong>{cgAtual.pmp !== null ? `${Math.round(cgAtual.pmp)} dias` : '—'}</strong>
                </div>
              </CardContent>
            </Card>

            {/* Ciclo Financeiro */}
            <Card className="rounded-2xl border-slate-200/90 shadow-xs hover:shadow-md transition-shadow">
              <CardContent className="p-5 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="font-semibold">Ciclo Financeiro</span>
                  <RefreshCw className="w-4 h-4 text-sky-600" />
                </div>
                <div className="text-2xl font-black text-[#0B1F3A] dark:text-white">
                  {cgAtual.cicloFinanceiro !== null
                    ? `${Math.round(cgAtual.cicloFinanceiro)} dias`
                    : '—'}
                </div>
                {renderVariacao(cgAtual.cicloFinanceiro, cgAnt.cicloFinanceiro, true)}
              </CardContent>
            </Card>

            {/* Margem Bruta & Operacional */}
            <Card className="rounded-2xl border-slate-200/90 shadow-xs hover:shadow-md transition-shadow">
              <CardContent className="p-5 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="font-semibold">Margem Bruta</span>
                  <span className="text-[11px] font-semibold text-slate-400">
                    Op: {formatPercent(indAtual.margemOperacional, 1)}
                  </span>
                </div>
                <div className="text-2xl font-black text-[#0B1F3A] dark:text-white">
                  {formatPercent(indAtual.margemBruta, 1)}
                </div>
                {renderVariacao(indAtual.margemBruta, indAnt.margemBruta)}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* 2. GRÁFICOS INTERATIVOS - SEÇÃO PRINCIPAL */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* COMPOSIÇÃO DO ATIVO (DONUT) */}
        {widgets.composicaoPatrimonio && (
          <Card className="rounded-2xl border-slate-200/90 shadow-xs">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <PieChartIcon className="w-4 h-4 text-blue-600" />
                    <span>Composição do Ativo</span>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Distribuição patrimonial dos bens e direitos (clique para detalhar)
                  </CardDescription>
                </div>
                <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-200">
                  {formatCurrency(calcBalAtual.ativoTotal)}
                </span>
              </div>
            </CardHeader>
            <CardContent className="pt-2">
              {dadosComposicaoAtivo.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-xs text-slate-400">
                  Sem dados para composição do ativo em {selectedAno}
                </div>
              ) : (
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={dadosComposicaoAtivo}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={65}
                        outerRadius={95}
                        paddingAngle={3}
                        cursor="pointer"
                        onClick={(data) => handleDrilldownClick('ativo', data)}
                      >
                        {dadosComposicaoAtivo.map((entry, index) => (
                          <Cell
                            key={`cell-ativo-${index}`}
                            fill={PIE_PALETTE_ATIVO[index % PIE_PALETTE_ATIVO.length]}
                            stroke={filtroDrilldown.valor === entry.name ? '#000' : 'transparent'}
                            strokeWidth={filtroDrilldown.valor === entry.name ? 2 : 0}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(val: number) => [formatCurrency(val), 'Valor']}
                        contentStyle={{
                          backgroundColor: '#0B1F3A',
                          borderColor: '#1E293B',
                          borderRadius: '12px',
                          color: '#fff',
                          fontSize: '12px',
                        }}
                      />
                      <Legend
                        verticalAlign="bottom"
                        wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* COMPOSIÇÃO DO PASSIVO & PL (DONUT) */}
        {widgets.composicaoPatrimonio && (
          <Card className="rounded-2xl border-slate-200/90 shadow-xs">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Scale className="w-4 h-4 text-rose-600" />
                    <span>Composição do Passivo & PL</span>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Origem dos recursos: terceiros vs. capital próprio
                  </CardDescription>
                </div>
                <span className="text-xs font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-200">
                  {formatCurrency(calcBalAtual.passivoTotal + calcBalAtual.patrimonioLiquido)}
                </span>
              </div>
            </CardHeader>
            <CardContent className="pt-2">
              {dadosComposicaoPassivo.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-xs text-slate-400">
                  Sem dados para composição do passivo em {selectedAno}
                </div>
              ) : (
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={dadosComposicaoPassivo}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={65}
                        outerRadius={95}
                        paddingAngle={3}
                        cursor="pointer"
                        onClick={(data) => handleDrilldownClick('passivo', data)}
                      >
                        {dadosComposicaoPassivo.map((entry, index) => (
                          <Cell
                            key={`cell-passivo-${index}`}
                            fill={PIE_PALETTE_PASSIVO[index % PIE_PALETTE_PASSIVO.length]}
                            stroke={filtroDrilldown.valor === entry.name ? '#000' : 'transparent'}
                            strokeWidth={filtroDrilldown.valor === entry.name ? 2 : 0}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(val: number) => [formatCurrency(val), 'Valor']}
                        contentStyle={{
                          backgroundColor: '#0B1F3A',
                          borderColor: '#1E293B',
                          borderRadius: '12px',
                          color: '#fff',
                          fontSize: '12px',
                        }}
                      />
                      <Legend
                        verticalAlign="bottom"
                        wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* 3. EVOLUÇÃO RECEITA × LUCRO E COMPARATIVO ANUAL */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* EVOLUÇÃO RECEITA × LUCRO */}
        {widgets.receitaLucro && (
          <Card className="rounded-2xl border-slate-200/90 shadow-xs">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-indigo-600" />
                    <span>Evolução Receita × Lucro ({selectedAno})</span>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Comportamento do faturamento bruto, custos e geração de lucro
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-2">
              {temDadosMensais ? (
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={serieMensal}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                      <XAxis dataKey="mesAbrev" tick={{ fontSize: 11 }} />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`}
                      />
                      <Tooltip
                        formatter={(val: number) => [formatCurrency(val), '']}
                        contentStyle={{
                          backgroundColor: '#0B1F3A',
                          borderRadius: '12px',
                          color: '#fff',
                          fontSize: '12px',
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                      <Bar
                        dataKey="receitaLiquida"
                        name="Receita Líquida"
                        fill="#3B82F6"
                        radius={[4, 4, 0, 0]}
                      />
                      <Line
                        type="monotone"
                        dataKey="lucroLiquido"
                        name="Lucro Líquido"
                        stroke="#10B981"
                        strokeWidth={3}
                        dot={{ r: 4 }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                /* Fallback anual comparativo */
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={[
                        {
                          periodo: `${anoComparativo}`,
                          Receita: calcDreAnt.receitaLiquida,
                          Lucro: calcDreAnt.lucroLiquido,
                          Ebitda: calcDreAnt.ebitda,
                        },
                        {
                          periodo: `${selectedAno}`,
                          Receita: calcDreAtual.receitaLiquida,
                          Lucro: calcDreAtual.lucroLiquido,
                          Ebitda: calcDreAtual.ebitda,
                        },
                      ]}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                      <XAxis dataKey="periodo" tick={{ fontSize: 12, fontWeight: 'bold' }} />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`}
                      />
                      <Tooltip
                        formatter={(val: number) => [formatCurrency(val), '']}
                        contentStyle={{
                          backgroundColor: '#0B1F3A',
                          borderRadius: '12px',
                          color: '#fff',
                          fontSize: '12px',
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                      <Bar dataKey="Receita" fill="#3B82F6" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="Ebitda" fill="#8B5CF6" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="Lucro" fill="#10B981" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* COMPARATIVO ANO A × ANO B POR INDICADOR */}
        {widgets.comparativoAnos && (
          <Card className="rounded-2xl border-slate-200/90 shadow-xs">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Activity className="w-4 h-4 text-emerald-600" />
                    <span>
                      Comparativo {selectedAno} × {anoComparativo}
                    </span>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Evolução consolidada dos principais saldos e margens
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={dadosComparativoAnual}
                    layout="vertical"
                    margin={{ left: 30, right: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis
                      dataKey="indicador"
                      type="category"
                      tick={{ fontSize: 11 }}
                      width={120}
                    />
                    <Tooltip
                      formatter={(val: number, name: string, item: any) => [
                        item.payload.unidade === 'R$ mil'
                          ? `R$ ${val.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`
                          : item.payload.unidade === '%'
                            ? `${val.toFixed(1)}%`
                            : val.toFixed(2),
                        `Exercício ${name}`,
                      ]}
                      contentStyle={{
                        backgroundColor: '#0B1F3A',
                        borderRadius: '12px',
                        color: '#fff',
                        fontSize: '12px',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    <Bar dataKey={anoComparativo} fill="#94A3B8" radius={[0, 4, 4, 0]} />
                    <Bar
                      dataKey={selectedAno || new Date().getFullYear()}
                      fill="#0284C7"
                      radius={[0, 4, 4, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* 4. EVOLUÇÃO MENSAL DE LIQUIDEZ E RENTABILIDADE (se houver dados mensais) */}
      {widgets.evolucaoMensal && temDadosMensais && (
        <Card className="rounded-2xl border-slate-200/90 shadow-xs mb-8">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-sky-600" />
                  <span>Evolução dos Indicadores Mês a Mês ({selectedAno})</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Linhas de tendência de Liquidez Corrente e Margem Líquida ao longo do ano
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={serieMensal}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="mesAbrev" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0B1F3A',
                      borderRadius: '12px',
                      color: '#fff',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="liquidezCorrente"
                    name="Liquidez Corrente (x)"
                    stroke="#2563EB"
                    strokeWidth={2.5}
                    dot={{ r: 4 }}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="margemLiquida"
                    name="Margem Líquida (%)"
                    stroke="#10B981"
                    strokeWidth={2.5}
                    dot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 5. VENDAS, RECEBÍVEIS E CAPACIDADE OPERACIONAL */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* TOP CLIENTES / TOMADORES (NOTAS FISCAIS) */}
        {widgets.notasTomadores && (
          <Card className="rounded-2xl border-slate-200/90 shadow-xs">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-600" />
                    <span>Top Clientes / Receita</span>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Distribuição das notas fiscais emitidas (clique para detalhar)
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-2">
              {dadosReceitasPorTomador.length === 0 ? (
                <div className="h-60 flex items-center justify-center text-xs text-slate-400">
                  Nenhuma NFS-e emitida registrada no exercício
                </div>
              ) : (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={dadosReceitasPorTomador}
                      layout="vertical"
                      margin={{ left: 10, right: 10 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                      <XAxis
                        type="number"
                        tick={{ fontSize: 10 }}
                        tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`}
                      />
                      <YAxis
                        dataKey="nome"
                        type="category"
                        tick={{ fontSize: 10 }}
                        width={90}
                        tickFormatter={(v) => (v.length > 12 ? `${v.slice(0, 11)}…` : v)}
                      />
                      <Tooltip
                        formatter={(val: number) => [formatCurrency(val), 'Faturamento']}
                        contentStyle={{
                          backgroundColor: '#0B1F3A',
                          borderRadius: '12px',
                          color: '#fff',
                          fontSize: '12px',
                        }}
                      />
                      <Bar
                        dataKey="total"
                        fill="#0284C7"
                        radius={[0, 4, 4, 0]}
                        cursor="pointer"
                        onClick={(data) => handleDrilldownClick('tomador', data)}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* SITUAÇÃO DOS RECEBÍVEIS */}
        {widgets.recebiveis && (
          <Card className="rounded-2xl border-slate-200/90 shadow-xs">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-600" />
                    <span>Situação dos Recebíveis</span>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Status da carteira de cobranças (clique para detalhar)
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-2">
              {dadosSituacaoRecebiveis.length === 0 ? (
                <div className="h-60 flex items-center justify-center text-xs text-slate-400">
                  Nenhum recebível cadastrado no escopo
                </div>
              ) : (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={dadosSituacaoRecebiveis}
                        dataKey="valor"
                        nameKey="status"
                        cx="50%"
                        cy="50%"
                        outerRadius={75}
                        innerRadius={45}
                        paddingAngle={3}
                        cursor="pointer"
                        onClick={(data) => handleDrilldownClick('recebivel_status', data)}
                      >
                        {dadosSituacaoRecebiveis.map((entry, index) => (
                          <Cell
                            key={`cell-rec-${index}`}
                            fill={entry.color}
                            stroke={filtroDrilldown.valor === entry.status ? '#000' : 'transparent'}
                            strokeWidth={filtroDrilldown.valor === entry.status ? 2 : 0}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(val: number, name: string, item: any) => [
                          `${formatCurrency(val)} (${item.payload.quantidade} parcelas)`,
                          'Montante',
                        ]}
                        contentStyle={{
                          backgroundColor: '#0B1F3A',
                          borderRadius: '12px',
                          color: '#fff',
                          fontSize: '12px',
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* CAPACIDADE DE PRODUÇÃO × QUANTIDADE VENDIDA */}
        {widgets.produtosCapacidade && (
          <Card className="rounded-2xl border-slate-200/90 shadow-xs">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Package className="w-4 h-4 text-indigo-600" />
                    <span>Capacidade × Vendas</span>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Ocupação industrial e pontos de ociosidade/gargalo
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-2">
              {dadosProdutosCapacidade.length === 0 ? (
                <div className="h-60 flex items-center justify-center text-xs text-slate-400">
                  Cadastre capacidade e vendas em "Produtos" para ver a análise
                </div>
              ) : (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={dadosProdutosCapacidade}
                      margin={{ left: -10, right: 10, bottom: 10 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                      <XAxis
                        dataKey="nome"
                        tick={{ fontSize: 9 }}
                        tickFormatter={(v) => (v.length > 8 ? `${v.slice(0, 7)}…` : v)}
                      />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip
                        formatter={(val: number, name: string) => [
                          `${val.toLocaleString('pt-BR')} unidades`,
                          name,
                        ]}
                        contentStyle={{
                          backgroundColor: '#0B1F3A',
                          borderRadius: '12px',
                          color: '#fff',
                          fontSize: '12px',
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                      <Bar
                        dataKey="capacidade"
                        name="Capacidade"
                        fill="#94A3B8"
                        radius={[4, 4, 0, 0]}
                        cursor="pointer"
                        onClick={(data) => handleDrilldownClick('produto', data)}
                      />
                      <Bar
                        dataKey="vendido"
                        name="Vendido"
                        fill="#6366F1"
                        radius={[4, 4, 0, 0]}
                        cursor="pointer"
                        onClick={(data) => handleDrilldownClick('produto', data)}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* 6. PAINEL ESTRATÉGICO: BALANCED SCORECARD & PLANOS DE AÇÃO */}
      {widgets.painelBsc && (
        <Card className="rounded-2xl border-slate-200/90 shadow-xs mb-8">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Target className="w-5 h-5 text-indigo-600" />
                  <span>Painel Estratégico BSC & Gestão de Iniciativas</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Visão consolidada das metas estratégicas e execução dos planos de ação
                </CardDescription>
              </div>

              {dadosBscPainel.scoreGlobal !== null && (
                <div className="flex items-center gap-3 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 px-3.5 py-1.5 rounded-xl">
                  <div className="text-right">
                    <div className="text-[10px] uppercase font-bold text-indigo-600 dark:text-indigo-300">
                      Score BSC Global
                    </div>
                    <div className="text-lg font-black text-indigo-900 dark:text-white">
                      {dadosBscPainel.scoreGlobal}%
                    </div>
                  </div>
                  <Progress
                    value={dadosBscPainel.scoreGlobal}
                    className="w-20 h-2.5 bg-indigo-200"
                  />
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Scores por Perspectiva */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-1.5">
                <div className="text-xs font-semibold text-slate-500">1. Financeira</div>
                <div className="text-xl font-bold text-slate-800 dark:text-white">
                  {dadosBscPainel.scorePorPerspectiva.financeira !== null
                    ? `${dadosBscPainel.scorePorPerspectiva.financeira}%`
                    : 'N/D'}
                </div>
                <Progress
                  value={dadosBscPainel.scorePorPerspectiva.financeira || 0}
                  className="h-1.5"
                />
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-1.5">
                <div className="text-xs font-semibold text-slate-500">2. Clientes & Mercado</div>
                <div className="text-xl font-bold text-slate-800 dark:text-white">
                  {dadosBscPainel.scorePorPerspectiva.clientes !== null
                    ? `${dadosBscPainel.scorePorPerspectiva.clientes}%`
                    : 'N/D'}
                </div>
                <Progress
                  value={dadosBscPainel.scorePorPerspectiva.clientes || 0}
                  className="h-1.5"
                />
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-1.5">
                <div className="text-xs font-semibold text-slate-500">3. Processos Internos</div>
                <div className="text-xl font-bold text-slate-800 dark:text-white">
                  {dadosBscPainel.scorePorPerspectiva.processos_internos !== null
                    ? `${dadosBscPainel.scorePorPerspectiva.processos_internos}%`
                    : 'N/D'}
                </div>
                <Progress
                  value={dadosBscPainel.scorePorPerspectiva.processos_internos || 0}
                  className="h-1.5"
                />
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-1.5">
                <div className="text-xs font-semibold text-slate-500">
                  4. Aprendizado & Crescimento
                </div>
                <div className="text-xl font-bold text-slate-800 dark:text-white">
                  {dadosBscPainel.scorePorPerspectiva.aprendizado_crescimento !== null
                    ? `${dadosBscPainel.scorePorPerspectiva.aprendizado_crescimento}%`
                    : 'N/D'}
                </div>
                <Progress
                  value={dadosBscPainel.scorePorPerspectiva.aprendizado_crescimento || 0}
                  className="h-1.5"
                />
              </div>
            </div>

            {/* Iniciativas em Atraso e Próximas de Vencer */}
            <div className="border-t pt-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                <span>Iniciativas Críticas & Planos de Ação que Demandam Atenção</span>
              </h4>

              {dadosBscPainel.emAtraso.length === 0 &&
              dadosBscPainel.proximasVencer.length === 0 ? (
                <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 text-emerald-800 dark:text-emerald-300 rounded-xl text-xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    Excelente! Nenhum plano de ação atrasado ou vencendo nos próximos 15 dias.
                  </span>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Em Atraso */}
                  {dadosBscPainel.emAtraso.map((ini) => (
                    <div
                      key={ini.id}
                      className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 rounded-xl text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-rose-800 dark:text-rose-300 truncate max-w-[200px]">
                          {ini.titulo}
                        </span>
                        <Badge variant="destructive" className="text-[10px] uppercase">
                          Em Atraso
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-slate-500 text-[11px]">
                        <span>
                          Prazo: {ini.prazo ? new Date(ini.prazo).toLocaleDateString('pt-BR') : '—'}
                        </span>
                        <span>Resp: {ini.responsavel || 'Não definido'}</span>
                      </div>
                    </div>
                  ))}

                  {/* Próximas de Vencer */}
                  {dadosBscPainel.proximasVencer.map((ini) => (
                    <div
                      key={ini.id}
                      className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 rounded-xl text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-amber-800 dark:text-amber-300 truncate max-w-[200px]">
                          {ini.titulo}
                        </span>
                        <Badge className="bg-amber-500 text-white text-[10px] uppercase">
                          Vencendo
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-slate-500 text-[11px]">
                        <span>
                          Prazo: {ini.prazo ? new Date(ini.prazo).toLocaleDateString('pt-BR') : '—'}
                        </span>
                        <span>Resp: {ini.responsavel || 'Não definido'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* MODAL DE DETALHAMENTO CROSS-FILTER / DRILL-DOWN */}
      <Dialog open={modalDetalhesAberto} onOpenChange={setModalDetalhesAberto}>
        <DialogContent className="max-w-md bg-white rounded-2xl p-6">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-base font-bold text-slate-900">
              {conteudoModalDetalhes?.titulo || 'Detalhamento do Indicador'}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              {conteudoModalDetalhes?.subtitulo || 'Valores analíticos extraídos do modelo'}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-3">
            {conteudoModalDetalhes?.itens.map((it, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs"
              >
                <span className="text-slate-500 font-medium">{it.label}</span>
                <span className="font-bold text-slate-900 text-right">{it.valor}</span>
              </div>
            ))}
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setModalDetalhesAberto(false)}
              className="text-xs rounded-xl"
            >
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
