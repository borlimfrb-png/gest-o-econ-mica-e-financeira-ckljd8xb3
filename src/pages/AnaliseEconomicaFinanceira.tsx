import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Scale,
  BarChart3,
  Tags,
  PieChart,
  TrendingUp,
  Percent,
  ArrowRight,
  Building2,
  Calendar,
  Sparkles,
  ShieldCheck,
  ChevronRight,
  Gauge,
  Bot,
  Activity,
  Calculator,
  Coins,
  Cpu,
} from 'lucide-react'
import { useFilter } from '@/contexts/FilterContext'
import { useAuth } from '@/contexts/AuthContext'
import {
  lancamentosService,
  balancosService,
  dreService,
  contasService,
  planoContasService,
  tiposDespesaService,
} from '@/services/financeService'
import {
  calcularDre,
  consolidarDreAnual,
  consolidarBalancoAnual,
  calcularBalanco,
  formatCurrency,
} from '@/lib/financeCalculations'
import { calcularAnaliseRentabilidade } from '@/lib/analiseRentabilidadeCalculo'
import { calcularAnaliseFaturamento } from '@/lib/analiseFaturamentoCalculo'
import { gerarListaMeses } from '@/lib/dreGerencialTypes'
import { EstadoVazioClienteCard } from '@/components/EstadoVazioClienteCard'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { BorlimLogo } from '@/components/BorlimLogo'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SelectEmpresaOuGrupoItems } from '@/components/SelectEmpresaOuGrupoItems'
import type {
  BalancoRecord,
  DreRecord,
  LancamentoRecord,
  ContaRecord,
  PlanoContaRecord,
  TipoDespesaRecord,
} from '@/types/finance'

interface HubShortcut {
  id: string
  titulo: string
  subtitulo: string
  descricao: string
  badge: string
  badgeVariant?: 'blue' | 'emerald' | 'amber' | 'cyan' | 'purple'
  icon: typeof Scale
  gradient: string
  borderGlow: string
  iconBg: string
  rota: (empresaId: string | null) => string
  metricasTexto: string
  valorDestaque?: string | null
  rotuloDestaque?: string | null
}

export default function AnaliseEconomicaFinanceira() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const {
    empresas,
    todasEntidades,
    selectedEmpresa,
    selectedEmpresaId,
    setSelectedEmpresaId,
    selectedAno,
    userEmpresasIds,
  } = useFilter()
  const isCliente = user?.role === 'cliente'
  const temMultiplosVinculos =
    (userEmpresasIds && userEmpresasIds.length > 1) ||
    empresas.length > 1 ||
    todasEntidades.length > 1

  const [verificandoDados, setVerificandoDados] = useState<boolean>(false)
  const [temDadosCliente, setTemDadosCliente] = useState<boolean>(true)

  // Dados para cálculo de EBITDA e Valuation do exercício ativo (perfis internos)
  const [balancosAno, setBalancosAno] = useState<BalancoRecord[]>([])
  const [dresAno, setDresAno] = useState<DreRecord[]>([])
  const [lancamentosAno, setLancamentosAno] = useState<LancamentoRecord[]>([])
  const [todosLancamentosEmpresa, setTodosLancamentosEmpresa] = useState<LancamentoRecord[]>([])
  const [contasCad, setContasCad] = useState<ContaRecord[]>([])
  const [planoCad, setPlanoCad] = useState<PlanoContaRecord[]>([])
  const [tiposDespesasCad, setTiposDespesasCad] = useState<TipoDespesaRecord[]>([])

  const empresaAtivaId =
    selectedEmpresaId && !selectedEmpresaId.startsWith('grupo-')
      ? selectedEmpresaId
      : selectedEmpresa?.id || null

  const empresaNome = selectedEmpresa?.nome || 'Empresa Ativa'
  const anoAtivo = selectedAno || new Date().getFullYear()

  useEffect(() => {
    let cancelado = false

    const carregarDadosHub = async () => {
      if (!empresaAtivaId) {
        if (!cancelado) {
          setTemDadosCliente(false)
          setBalancosAno([])
          setDresAno([])
          setLancamentosAno([])
        }
        return
      }

      setVerificandoDados(true)
      try {
        const promises: [
          Promise<BalancoRecord[]>,
          Promise<DreRecord[]>,
          Promise<LancamentoRecord[]>,
          Promise<ContaRecord[]>,
          Promise<PlanoContaRecord[]>,
          Promise<TipoDespesaRecord[]>,
        ] = [
          balancosService
            .getByEmpresa(empresaAtivaId)
            .then((list) => list.filter((b) => b.ano === anoAtivo))
            .catch(() => [] as BalancoRecord[]),
          dreService
            .getByEmpresa(empresaAtivaId)
            .then((list) => list.filter((d) => d.ano === anoAtivo))
            .catch(() => [] as DreRecord[]),
          lancamentosService
            .getAll({ empresaId: empresaAtivaId })
            .catch(() => [] as LancamentoRecord[]),
          contasService.getAll().catch(() => [] as ContaRecord[]),
          planoContasService.getAll().catch(() => [] as PlanoContaRecord[]),
          tiposDespesaService.getAll().catch(() => [] as TipoDespesaRecord[]),
        ]

        const [bList, dList, allLancs, cList, pList, tdList] = await Promise.all(promises)

        if (!cancelado) {
          const lListAno = allLancs.filter((l) => {
            const dataStr = l.data_competencia || l.data_pagamento || l.data_lancamento
            if (!dataStr) return false
            return new Date(dataStr).getFullYear() === anoAtivo
          })

          setBalancosAno(bList)
          setDresAno(dList)
          setTodosLancamentosEmpresa(allLancs)
          setLancamentosAno(lListAno)
          setContasCad(cList)
          setPlanoCad(pList)
          setTiposDespesasCad(tdList)

          const temAlgumDado = bList.length > 0 || dList.length > 0 || lListAno.length > 0
          setTemDadosCliente(temAlgumDado)
        }
      } catch (err) {
        console.error('Erro ao verificar dados da empresa para o hub:', err)
        if (!cancelado) {
          setTemDadosCliente(true)
        }
      } finally {
        if (!cancelado) {
          setVerificandoDados(false)
        }
      }
    }

    carregarDadosHub()

    return () => {
      cancelado = true
    }
  }, [empresaAtivaId, anoAtivo, isCliente])

  // Consolidação DRE e Balanço do exercício ativo (com fallback sintético por lançamentos idêntico ao Dashboard BI)
  const { ebitdaAtivo, valuationAtivo } = useMemo(() => {
    let dAtivo = consolidarDreAnual(dresAno, anoAtivo)
    const bAtivo = consolidarBalancoAnual(balancosAno, anoAtivo)

    // Fallback por lançamentos se DRE não tiver dados
    const dreSemDados =
      !dAtivo ||
      (!dAtivo.receita_bruta &&
        !dAtivo.despesas_operacionais &&
        !dAtivo.custo_mercadorias &&
        !dAtivo.despesas_financeiras)

    if (dreSemDados && lancamentosAno.length > 0) {
      const meses = gerarListaMeses(anoAtivo, 1, 12)
      const rent = calcularAnaliseRentabilidade(lancamentosAno, contasCad, meses, planoCad)
      const temDadosLancs =
        rent.faturamentoTotal > 0 ||
        rent.despesasFixasTotal > 0 ||
        rent.despesasVariaveisTotal > 0 ||
        rent.despesasFinanceirasTotal > 0 ||
        rent.lucroTotal !== 0

      if (temDadosLancs) {
        const sintetico: DreRecord = {
          id: `sintetico-${anoAtivo}-${empresaAtivaId || 'empresa'}`,
          collectionId: 'dres',
          collectionName: 'dres',
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
          empresa: empresaAtivaId || 'empresa',
          ano: anoAtivo,
          mes: 12,
          receita_bruta: rent.faturamentoTotal,
          deducoes_receita: 0,
          custo_mercadorias: rent.despesasVariaveisTotal,
          despesas_operacionais: rent.despesasFixasTotal,
          despesas_financeiras: rent.despesasFinanceirasTotal,
          outras_receitas_despesas: rent.receitasFinanceirasTotal,
          imposto_renda: 0,
        }
        dAtivo = sintetico
      }
    }

    const calcD = calcularDre(dAtivo)
    const calcB = calcularBalanco(bAtivo)

    const ebitda = calcD.ebitda

    // Valuation FCD (Gordon padrão: WACC=12%, g=2%, anos=5, crescimento FCF=5%)
    let valFcd = 0
    const baseFcf = calcD.ebitda !== 0 ? calcD.ebitda : calcD.resultadoOperacional || 0
    if (baseFcf > 0) {
      const wacc = 0.12
      const g = 0.02
      const gFcf = 0.05
      const nAnos = 5
      let fcfAcum = baseFcf
      let somaVp = 0
      for (let t = 1; t <= nAnos; t++) {
        fcfAcum = fcfAcum * (1 + gFcf)
        const fator = Math.pow(1 + wacc, t)
        somaVp += fcfAcum / fator
      }
      const terminal = (fcfAcum * (1 + g)) / (wacc - g)
      const vpTerminal = terminal / Math.pow(1 + wacc, nAnos)
      valFcd = somaVp + vpTerminal
    } else if (calcB.patrimonioLiquido > 0) {
      // Se não houver FCF positivo, usa o PL contábil como referência de valor patrimonial
      valFcd = calcB.patrimonioLiquido
    }

    return {
      ebitdaAtivo: ebitda,
      valuationAtivo: valFcd,
    }
  }, [dresAno, balancosAno, lancamentosAno, contasCad, planoCad, anoAtivo, empresaAtivaId])

  // Cálculo dos dados oficiais de vendas/faturamento (paridade exata com /gerencial/analise-faturamento)
  const dadosVendasHub = useMemo(() => {
    // Usa exatamente a mesma função de motor da tela Análise de Faturamento
    const res = calcularAnaliseFaturamento(
      todosLancamentosEmpresa.length > 0 ? todosLancamentosEmpresa : lancamentosAno,
      contasCad,
      planoCad,
    )

    // Localiza a linha do ano ativo selecionado
    const linhaAno = res.linhasPorAno.find((l) => l.ano === anoAtivo)

    if (!linhaAno || linhaAno.totalAno === 0) {
      return {
        faturamentoTotal: 0,
        mesesComMovimento: 0,
        mediaMensal: 0,
        mesPico: null as { mes: number; mesNome: string; valor: number } | null,
        temMovimento: false,
      }
    }

    const nomesMeses = [
      'Janeiro',
      'Fevereiro',
      'Março',
      'Abril',
      'Maio',
      'Junho',
      'Julho',
      'Agosto',
      'Setembro',
      'Outubro',
      'Novembro',
      'Dezembro',
    ]

    let mesesComMovimento = 0
    let mesPico: { mes: number; mesNome: string; valor: number } | null = null

    for (let m = 1; m <= 12; m++) {
      const v = linhaAno.valoresPorMes[m] || 0
      if (v > 0 || linhaAno.mesesComDados[m]) {
        mesesComMovimento++
      }
      if (v > 0) {
        if (!mesPico || v > mesPico.valor) {
          mesPico = {
            mes: m,
            mesNome: nomesMeses[m - 1],
            valor: v,
          }
        }
      }
    }

    const mediaMensal = mesesComMovimento > 0 ? linhaAno.totalAno / mesesComMovimento : 0

    return {
      faturamentoTotal: linhaAno.totalAno,
      mesesComMovimento,
      mediaMensal,
      mesPico,
      temMovimento: linhaAno.totalAno > 0,
    }
  }, [todosLancamentosEmpresa, lancamentosAno, contasCad, planoCad, anoAtivo])

  const atalhos: HubShortcut[] = useMemo(() => {
    const lista: HubShortcut[] = [
      {
        id: 'balanco',
        titulo: 'Balanço Patrimonial',
        subtitulo: 'Ativo, Passivo & Patrimônio Líquido',
        descricao:
          'Visão analítica da posição estática e estrutura de capital da empresa no exercício selecionado.',
        badge: 'Balanço',
        badgeVariant: 'cyan',
        icon: Scale,
        gradient: 'from-[#0B1F3A] via-[#0D294E] to-[#123668]',
        borderGlow: 'hover:border-sky-400/70 hover:shadow-sky-500/15',
        iconBg: 'bg-gradient-to-tr from-sky-500/25 to-blue-600/20 text-sky-300 border-sky-400/40',
        rota: (empId) => (empId ? `/empresas/${empId}?aba=balanco` : '/empresas'),
        metricasTexto: 'Ativo Circulante, Realizável L.P., Passivos e PL',
      },
      {
        id: 'dre',
        titulo: 'DRE Gerencial',
        subtitulo: 'Demonstração do Resultado do Exercício',
        descricao:
          'Acompanhamento mensal detalhado de receitas, custos, despesas, margens de contribuição e lucro líquido.',
        badge: 'Gerencial',
        badgeVariant: 'emerald',
        icon: BarChart3,
        gradient: 'from-[#0B1F3A] via-[#0C3042] to-[#11494F]',
        borderGlow: 'hover:border-emerald-400/70 hover:shadow-emerald-500/15',
        iconBg:
          'bg-gradient-to-tr from-emerald-500/25 to-teal-600/20 text-emerald-300 border-emerald-400/40',
        rota: () => '/gerencial/dre',
        metricasTexto: 'Receita Líquida, Margem de Contribuição e Resultado Líquido',
      },
      {
        id: 'despesas-fixas',
        titulo: 'Despesas Fixas',
        subtitulo: 'Estrutura Operacional & Administrativa',
        descricao:
          'Detalhamento das despesas fixas recorrentes, evolução mensal e percentual de impacto sobre o faturamento.',
        badge: 'Fixas',
        badgeVariant: 'blue',
        icon: Tags,
        gradient: 'from-[#0B1F3A] via-[#102952] to-[#163870]',
        borderGlow: 'hover:border-blue-400/70 hover:shadow-blue-500/15',
        iconBg:
          'bg-gradient-to-tr from-blue-500/25 to-indigo-600/20 text-blue-300 border-blue-400/40',
        rota: () => '/gerencial/despesas-fixas',
        metricasTexto: 'Alocação por tipo de conta, centro de custo e matriz mensal',
      },
      {
        id: 'despesas-variaveis',
        titulo: 'Despesas Variáveis',
        subtitulo: 'Custos Comerciais & Operacionais',
        descricao:
          'Análise das despesas diretamente ligadas às operações de venda (impostos, fretes, comissões e taxas).',
        badge: 'Variáveis',
        badgeVariant: 'amber',
        icon: PieChart,
        gradient: 'from-[#0B1F3A] via-[#212745] to-[#2E284F]',
        borderGlow: 'hover:border-amber-400/70 hover:shadow-amber-500/15',
        iconBg:
          'bg-gradient-to-tr from-amber-500/25 to-orange-600/20 text-amber-300 border-amber-400/40',
        rota: () => '/gerencial/despesas-variaveis',
        metricasTexto: 'Deduções sobre faturamento, comissões, taxas e fretes',
      },
      {
        id: 'faturamento',
        titulo: 'Análise de Faturamento',
        subtitulo: 'Receita Operacional & Composição Anual',
        descricao:
          'Curva mensal de faturamento de Jan a Dez, participação de cada mês no total anual e comparativos.',
        badge: 'Faturamento',
        badgeVariant: 'blue',
        icon: BarChart3,
        gradient: 'from-[#0B1F3A] via-[#102347] to-[#172D5C]',
        borderGlow: 'hover:border-blue-400/70 hover:shadow-blue-500/15',
        iconBg:
          'bg-gradient-to-tr from-blue-500/25 to-cyan-600/20 text-blue-300 border-blue-400/40',
        rota: () => '/gerencial/analise-faturamento',
        metricasTexto: 'Sazonalidade Jan-Dez, participação percentual e comparativos',
        valorDestaque: dadosVendasHub.temMovimento
          ? formatCurrency(dadosVendasHub.faturamentoTotal)
          : null,
        rotuloDestaque: `Vendas ${anoAtivo}`,
      },
      {
        id: 'rentabilidade',
        titulo: 'Análise de Rentabilidade',
        subtitulo: 'Faturamento vs. Lucro & Margens',
        descricao:
          'Visão de rentabilidade gerencial com faturamento, lucro apurado no DRE, margens percentuais e gráfico evolutivo.',
        badge: 'Rentabilidade',
        badgeVariant: 'emerald',
        icon: Percent,
        gradient: 'from-[#0B1F3A] via-[#0E343D] to-[#124B40]',
        borderGlow: 'hover:border-emerald-400/70 hover:shadow-emerald-500/15',
        iconBg:
          'bg-gradient-to-tr from-emerald-500/25 to-teal-600/20 text-emerald-300 border-emerald-400/40',
        rota: () => (isCliente ? '/cliente/rentabilidade' : '/gerencial/rentabilidade'),
        metricasTexto: 'Faturamento, Lucro Apurado, Margem Líquida, Bruta e Operacional',
      },
      {
        id: 'crescimento',
        titulo: 'Indicador de Crescimento',
        subtitulo: 'Evolução de Vendas & Taxas MoM / YoY',
        descricao:
          'Acompanhamento do ritmo de crescimento do faturamento, comparações mensais, taxas anuais e selo de qualidade da expansão.',
        badge: 'Crescimento',
        badgeVariant: 'cyan',
        icon: TrendingUp,
        gradient: 'from-[#0B1F3A] via-[#0D2E54] to-[#12467A]',
        borderGlow: 'hover:border-cyan-400/70 hover:shadow-cyan-500/15',
        iconBg:
          'bg-gradient-to-tr from-cyan-500/25 to-blue-600/20 text-cyan-300 border-cyan-400/40',
        rota: () => (isCliente ? '/cliente/crescimento' : '/gerencial/indicador-crescimento'),
        metricasTexto: 'Crescimento no período, comparativo anual e qualidade da expansão',
      },
      {
        id: 'dashboard-bi',
        titulo: 'Dashboard BI Interativo',
        subtitulo: 'Painel Executivo & BI Interativo',
        descricao:
          'Painel executivo com KPIs consolidados, evolução mensal faturamento vs. despesas, donut de centros de custo e curvas de margens.',
        badge: 'BI Interativo',
        badgeVariant: 'cyan',
        icon: Sparkles,
        gradient: 'from-[#0B1F3A] via-[#0E284E] to-[#143A6E]',
        borderGlow: 'hover:border-cyan-400/70 hover:shadow-cyan-500/15',
        iconBg: 'bg-gradient-to-tr from-cyan-500/25 to-sky-600/20 text-cyan-300 border-cyan-400/40',
        rota: () => (isCliente ? '/cliente/dashboard-bi' : '/gerencial/dashboard-bi'),
        metricasTexto: 'Faturamento, Lucro, Margens, Custos Fixos/Variáveis e Centros de Custo',
      },
      {
        id: 'indicadores',
        titulo: 'Indicadores',
        subtitulo: 'Métricas Econômico-Financeiras Clássicas',
        descricao:
          'Painel de indicadores financeiros: Liquidez Corrente/Seca/Geral, Alavancagem (Dívida/PL), ROE, ROI, Margens e Prazos Médios com badges de status.',
        badge: 'Indicadores',
        badgeVariant: 'emerald',
        icon: Gauge,
        gradient: 'from-[#0B1F3A] via-[#103438] to-[#164842]',
        borderGlow: 'hover:border-emerald-400/70 hover:shadow-emerald-500/15',
        iconBg:
          'bg-gradient-to-tr from-emerald-500/25 to-teal-600/20 text-emerald-300 border-emerald-400/40',
        rota: () => (isCliente ? '/cliente/indicadores' : '/gerencial/indicadores'),
        metricasTexto: 'Liquidez, Endividamento, ROE/ROA, Margens e Prazos Médios PMR/PMP',
      },
    ]

    // Módulos executivos exclusivos para perfis internos (não cliente)
    if (!isCliente) {
      // 1. Termômetro de Insolvência (Altman Z-Score)
      lista.push({
        id: 'termometro-insolvencia',
        titulo: 'Termômetro de Insolvência',
        subtitulo: 'Altman Z-Score & Risco de Falência',
        descricao:
          'Diagnóstico preditivo de solvência pelo modelo de Edward Altman (Z-Score privado e clássico). Medidor visual nas zonas de solvência, cinzenta e insolvência com decomposição dos 5 índices X1–X5.',
        badge: 'Solvência Z-Score',
        badgeVariant: 'amber',
        icon: Activity,
        gradient: 'from-[#0B1F3A] via-[#2A1E35] to-[#3B1F42]',
        borderGlow: 'hover:border-amber-400/70 hover:shadow-amber-500/15',
        iconBg:
          'bg-gradient-to-tr from-amber-500/25 to-rose-600/20 text-amber-300 border-amber-400/40',
        rota: () => '/gerencial/termometro-insolvencia',
        metricasTexto: 'Z-Score Altman, Índices X1 a X5, Gauge de Risco e Parecer Executivo',
      })

      // 2. EBITDA (LAJIDA) com valor do exercício ativo
      lista.push({
        id: 'ebitda-lajida',
        titulo: 'EBITDA (LAJIDA)',
        subtitulo: 'Geração Operacional de Caixa',
        descricao:
          'Lucro antes de Juros, Impostos, Depreciação e Amortização consolidado no exercício ativo. Integração direta com o motor contábil da DRE e com o Dashboard BI.',
        badge: 'LAJIDA Operacional',
        badgeVariant: 'emerald',
        icon: Calculator,
        gradient: 'from-[#0B1F3A] via-[#0E3534] to-[#124B40]',
        borderGlow: 'hover:border-emerald-400/70 hover:shadow-emerald-500/15',
        iconBg:
          'bg-gradient-to-tr from-emerald-500/25 to-teal-600/20 text-emerald-300 border-emerald-400/40',
        rota: () => '/gerencial/dashboard-bi',
        metricasTexto: 'Lucro Líquido + IR/CSLL + Despesas Financeiras Líquidas',
        valorDestaque: formatCurrency(ebitdaAtivo),
        rotuloDestaque: `EBITDA ${anoAtivo}`,
      })

      // 3. Valuation com valor do exercício ativo
      lista.push({
        id: 'valuation-mercado',
        titulo: 'Valuation',
        subtitulo: 'Avaliação Econômica da Empresa',
        descricao:
          'Avaliação de Enterprise Value / Equity Value pelo Fluxo de Caixa Descontado (Gordon) e Múltiplos de Mercado. Estimativa consolidada calculada sobre o exercício ativo.',
        badge: 'Avaliação Econômica',
        badgeVariant: 'cyan',
        icon: Coins,
        gradient: 'from-[#0B1F3A] via-[#0F2A52] to-[#143B73]',
        borderGlow: 'hover:border-cyan-400/70 hover:shadow-cyan-500/15',
        iconBg: 'bg-gradient-to-tr from-cyan-500/25 to-sky-600/20 text-cyan-300 border-cyan-400/40',
        rota: () => '/indicadores-valuation',
        metricasTexto: 'FCD Perpetuidade, Múltiplos Setoriais e Superlucro Goodwill',
        valorDestaque: formatCurrency(valuationAtivo),
        rotuloDestaque: `Valuation ${anoAtivo}`,
      })

      // 4. Indicadores Econômicos Avançados
      lista.push({
        id: 'indicadores-avancados',
        titulo: 'Indicadores Econômicos Avançados',
        subtitulo: 'EVA, DuPont, Ciclo de Caixa & Cobertura',
        descricao:
          'Métricas avançadas de criação de valor: EVA (Economic Value Added), Decomposição DuPont (Margem × Giro × Alavancagem = ROE), Ciclo Financeiro (CCC) e Cobertura de Juros.',
        badge: 'EVA & DuPont',
        badgeVariant: 'purple',
        icon: Cpu,
        gradient: 'from-[#0B1F3A] via-[#1F1D46] to-[#2E2059]',
        borderGlow: 'hover:border-purple-400/70 hover:shadow-purple-500/15',
        iconBg:
          'bg-gradient-to-tr from-purple-500/25 to-violet-600/20 text-purple-300 border-purple-400/40',
        rota: () => '/gerencial/indicadores-avancados',
        metricasTexto: 'EVA, Pirâmide DuPont ROE, CCC Prazos Médios e Cobertura de Juros',
      })

      // Comparativo DRE x Balanço
      lista.push({
        id: 'comparativo-mensal',
        titulo: 'Comparativo DRE × Balanço',
        subtitulo: 'Visão Mês a Mês: Fluxo × Estoque',
        descricao:
          'Comparação mensal de Jan a Dez entre números da DRE Gerencial (faturamento, custos, lucro) e Balanço Patrimonial (ativo, passivo, PL) com indicadores e gráficos.',
        badge: 'Mês a Mês',
        badgeVariant: 'emerald',
        icon: Scale,
        gradient: 'from-[#0B1F3A] via-[#13334A] to-[#18465C]',
        borderGlow: 'hover:border-sky-400/70 hover:shadow-sky-500/15',
        iconBg: 'bg-gradient-to-tr from-teal-500/25 to-sky-600/20 text-sky-300 border-sky-400/40',
        rota: () => '/gerencial/comparativo-mensal',
        metricasTexto: 'Receita, Lucro, Ativo, Passivo, PL, Liquidez e ROE mês a mês',
      })
    }

    // Agente de IA Borlim
    lista.push({
      id: 'agente-ia',
      titulo: 'Agente de IA Borlim',
      subtitulo: 'Consultoria Econômico-Financeira Inteligente',
      descricao:
        'Assistente de IA nativo com histórico exclusivo por empresa ativa. Responde sobre faturamento, despesas fixas/variáveis, margens, centros de custo e planos de ação.',
      badge: 'IA Nativa',
      badgeVariant: 'purple',
      icon: Bot,
      gradient: 'from-[#0B1F3A] via-[#1E1945] to-[#2D1B54]',
      borderGlow: 'hover:border-purple-400/80 hover:shadow-purple-500/20',
      iconBg:
        'bg-gradient-to-tr from-purple-500/30 to-violet-600/25 text-purple-300 border-purple-400/50 shadow-purple-950/40',
      rota: () => (isCliente ? '/cliente/agente-ia' : '/gerencial/agente-ia'),
      metricasTexto: 'Consultas, diagnósticos e histórico isolados por empresa ativa',
    })

    return lista
  }, [isCliente, ebitdaAtivo, valuationAtivo, anoAtivo])

  return (
    <div className="space-y-6 pb-8 animate-fadeIn">
      {/* Banner Principal com Tema Azul-Marinho Profundo e Gradiente Moderno */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#0B1F3A] via-[#0E284E] to-[#143A6E] border border-blue-900/40 p-6 sm:p-8 text-white shadow-xl shadow-slate-900/10">
        {/* Luzes de fundo / Glassmorphism decorativo */}
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3 max-w-3xl">
            <div className="flex items-center gap-2.5 flex-wrap">
              <BorlimLogo size="md" variant="light" showSubtitle={false} className="shadow-md" />
              <Badge className="bg-cyan-500/20 text-cyan-200 border-cyan-400/30 text-xs font-semibold px-2.5 py-0.5 backdrop-blur-md">
                <Sparkles className="w-3 h-3 mr-1 text-cyan-300" />
                Painel Executivo Integrado
              </Badge>
              {user?.role === 'cliente' && (
                <Badge className="bg-white/10 text-slate-200 border-white/20 text-xs font-medium px-2 py-0.5">
                  Acesso Cliente
                </Badge>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Análise Econômica e Financeira
            </h1>

            <p className="text-sm text-slate-300/90 leading-relaxed">
              Central estratégica de demonstrações contábeis e gerenciais pela{' '}
              <strong className="text-sky-300">Borlim Consultoria</strong>. Acesse o Balanço
              Patrimonial, DRE, Rentabilidade, Indicador de Crescimento, Dashboard BI, Termômetro de
              Insolvência, EBITDA, Valuation e Indicadores Econômicos Avançados.
            </p>
          </div>

          {/* Card compacto com contexto da empresa e exercício ativo */}
          <div className="shrink-0 bg-white/5 border border-white/15 rounded-2xl p-4 backdrop-blur-md flex flex-col sm:flex-row md:flex-col gap-3 min-w-[240px]">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-200 shrink-0">
                <Building2 className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">
                  Empresa Ativa
                </span>
                {temMultiplosVinculos && !isCliente ? (
                  <Select
                    value={selectedEmpresaId || undefined}
                    onValueChange={(val) => setSelectedEmpresaId(val)}
                  >
                    <SelectTrigger className="h-7 text-xs font-bold bg-white/10 border-white/20 text-white p-1 px-2 mt-0.5 max-w-[200px] truncate">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectEmpresaOuGrupoItems
                        empresas={empresas}
                        todasEntidades={todasEntidades}
                      />
                    </SelectContent>
                  </Select>
                ) : (
                  <span className="text-sm font-bold text-white block truncate" title={empresaNome}>
                    {empresaNome}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2.5 pt-2 border-t border-white/10">
              <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-400/30 flex items-center justify-center text-cyan-200 shrink-0">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">
                  Exercício Ativo
                </span>
                <span className="text-sm font-bold text-cyan-300">{anoAtivo}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Estado vazio para cliente sem dados no período */}
      {isCliente && !verificandoDados && !temDadosCliente && (
        <EstadoVazioClienteCard
          empresaNome={empresaNome}
          ano={anoAtivo}
          mensagem="Nenhum balanço contábil, DRE ou lançamento registrado para esta empresa no exercício selecionado. Entre em contato com seu consultor Borlim para a importação e liberação dos demonstrativos."
        />
      )}

      {/* SEÇÃO 1: PAINEL DE KPIS EXECUTIVOS & DADOS DE VENDAS */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
              Indicadores-Chave (KPIs) & Vendas do Exercício {anoAtivo}
            </h2>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Integração em tempo real · Motor oficial DRE & Vendas
          </span>
        </div>

        {verificandoDados ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-28 rounded-28" />
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* KPI 1: Vendas / Faturamento Total (Integração Direta com Análise de Faturamento) */}
            <div
              onClick={() => navigate('/gerencial/analise-faturamento')}
              className="group cursor-pointer rounded-2xl p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-blue-400 dark:hover:border-blue-500 transition-all duration-200 relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500 opacity-80" />
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Vendas / Faturamento
                </span>
                <Badge
                  variant="outline"
                  className="bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border-blue-200 dark:border-blue-800 text-[10px] font-semibold"
                >
                  {dadosVendasHub.mesesComMovimento} meses
                </Badge>
              </div>
              <div className="text-2xl font-black text-[#0B1F3A] dark:text-white tabular-nums tracking-tight">
                {formatCurrency(dadosVendasHub.faturamentoTotal)}
              </div>
              <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                <span>Média: {formatCurrency(dadosVendasHub.mediaMensal)}/mês</span>
                <span className="text-blue-600 dark:text-blue-400 font-semibold group-hover:translate-x-0.5 transition-transform flex items-center">
                  Ver vendas →
                </span>
              </div>
            </div>

            {/* KPI 2: EBITDA (LAJIDA) Operacional */}
            <div
              onClick={() =>
                navigate(isCliente ? '/cliente/dashboard-bi' : '/gerencial/dashboard-bi')
              }
              className="group cursor-pointer rounded-2xl p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-emerald-400 dark:hover:border-emerald-500 transition-all duration-200 relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500 opacity-80" />
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  EBITDA (LAJIDA)
                </span>
                <Badge
                  variant="outline"
                  className={`text-[10px] font-semibold ${
                    ebitdaAtivo >= 0
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-200'
                      : 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300 border-red-200'
                  }`}
                >
                  {ebitdaAtivo >= 0 ? 'Positivo' : 'Negativo'}
                </Badge>
              </div>
              <div
                className={`text-2xl font-black tabular-nums tracking-tight ${
                  ebitdaAtivo >= 0
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-red-600 dark:text-red-400'
                }`}
              >
                {formatCurrency(ebitdaAtivo)}
              </div>
              <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                <span>Geração Caixa Op.</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold group-hover:translate-x-0.5 transition-transform flex items-center">
                  Dashboard BI →
                </span>
              </div>
            </div>

            {/* KPI 3: Valuation Estimado */}
            <div
              onClick={() =>
                navigate(isCliente ? '/cliente/dashboard-bi' : '/indicadores-valuation')
              }
              className="group cursor-pointer rounded-2xl p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-sky-400 dark:hover:border-sky-500 transition-all duration-200 relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-1 bg-sky-500 opacity-80" />
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Valuation Estimado
                </span>
                <Badge
                  variant="outline"
                  className="bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300 border-sky-200 text-[10px] font-semibold"
                >
                  Gordon FCD
                </Badge>
              </div>
              <div className="text-2xl font-black text-[#0B1F3A] dark:text-white tabular-nums tracking-tight">
                {formatCurrency(valuationAtivo)}
              </div>
              <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                <span>Enterprise Value</span>
                <span className="text-sky-600 dark:text-sky-400 font-semibold group-hover:translate-x-0.5 transition-transform flex items-center">
                  Valuation →
                </span>
              </div>
            </div>

            {/* KPI 4: Sazonalidade / Mês de Pico de Vendas */}
            <div
              onClick={() => navigate('/gerencial/analise-faturamento')}
              className="group cursor-pointer rounded-2xl p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-amber-400 dark:hover:border-amber-500 transition-all duration-200 relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-1 bg-amber-500 opacity-80" />
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Pico de Vendas
                </span>
                <Badge
                  variant="outline"
                  className="bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200 text-[10px] font-semibold"
                >
                  {dadosVendasHub.mesPico ? dadosVendasHub.mesPico.mesNome : 'S/ dado'}
                </Badge>
              </div>
              <div className="text-2xl font-black text-[#0B1F3A] dark:text-white tabular-nums tracking-tight">
                {dadosVendasHub.mesPico ? formatCurrency(dadosVendasHub.mesPico.valor) : 'R$ 0,00'}
              </div>
              <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                <span>
                  {dadosVendasHub.mesPico && dadosVendasHub.faturamentoTotal > 0
                    ? `${((dadosVendasHub.mesPico.valor / dadosVendasHub.faturamentoTotal) * 100).toFixed(1)}% do ano`
                    : 'Curva Jan–Dez'}
                </span>
                <span className="text-amber-600 dark:text-amber-400 font-semibold group-hover:translate-x-0.5 transition-transform flex items-center">
                  Detalhes →
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Grid de Módulos e Demonstrações Disponíveis */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#0B1F3A] dark:text-slate-100">
              Módulos e Demonstrações Disponíveis
            </h2>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            {atalhos.length} módulos executivos estruturados
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {atalhos.map((item, index) => {
            const Icon = item.icon
            const destino = item.rota(empresaAtivaId)

            return (
              <Card
                key={item.id}
                onClick={() => navigate(destino)}
                className={`group relative overflow-hidden bg-gradient-to-br ${item.gradient} border border-slate-700/60 rounded-2xl p-6 text-white cursor-pointer transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl ${item.borderGlow} flex flex-col justify-between min-h-[275px] backdrop-blur-md`}
              >
                {/* Linha de acento no topo do card ao passar o mouse */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-sky-400/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                {/* Efeito sutil de vidro reflexivo */}
                <div className="absolute inset-0 bg-white/[0.04] opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

                {/* Topo do Card: Medalhão do Ícone + Badge */}
                <div className="space-y-4 relative z-10">
                  <div className="flex items-center justify-between">
                    <div
                      className={`w-13 h-13 rounded-2xl flex items-center justify-center border transition-all duration-300 group-hover:scale-108 shadow-lg shadow-black/20 ${item.iconBg}`}
                    >
                      <Icon className="w-6.5 h-6.5" />
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono text-slate-400 font-bold bg-white/5 border border-white/10 px-2 py-0.5 rounded-full">
                        {index + 1 < 10 ? `0${index + 1}` : index + 1}
                      </span>
                      <Badge
                        variant="secondary"
                        className="bg-white/10 text-white border-white/20 text-[10.5px] font-bold backdrop-blur-xs px-2 py-0.5"
                      >
                        {item.badge}
                      </Badge>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-extrabold text-white group-hover:text-sky-300 transition-colors flex items-center gap-1.5">
                      {item.titulo}
                    </h3>
                    <p className="text-xs font-semibold text-sky-200/90 mt-0.5">{item.subtitulo}</p>
                    <p className="text-xs text-slate-300/80 mt-2.5 leading-relaxed line-clamp-3">
                      {item.descricao}
                    </p>
                  </div>

                  {/* Destaque de Valor Numérico quando aplicável (EBITDA / Valuation / Vendas) com hierarquia visual aprimorada */}
                  {item.valorDestaque && (
                    <div className="mt-3 p-3 rounded-xl bg-gradient-to-r from-white/15 to-white/5 border border-white/20 backdrop-blur-sm flex items-center justify-between shadow-inner">
                      <div>
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-300 block">
                          {item.rotuloDestaque || 'Valor Consolidado'}
                        </span>
                        <span className="text-[10px] text-slate-400">Exercício {anoAtivo}</span>
                      </div>
                      <span className="text-base font-black text-cyan-200 tabular-nums font-mono drop-shadow-sm">
                        {item.valorDestaque}
                      </span>
                    </div>
                  )}
                </div>

                {/* Base do Card: Metadados + Botão de Ação */}
                <div className="pt-4 mt-4 border-t border-white/10 flex items-center justify-between text-xs relative z-10">
                  <span className="text-[11px] text-slate-400 truncate max-w-[190px]">
                    {item.metricasTexto}
                  </span>

                  <div className="flex items-center gap-1.5 font-bold text-sky-300 group-hover:text-sky-200 transition-colors shrink-0 bg-white/5 px-2.5 py-1 rounded-lg border border-white/10 group-hover:border-sky-400/40">
                    <span>Acessar</span>
                    <ArrowRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-1" />
                  </div>
                </div>
              </Card>
            )
          })}

          {/* Card Resumo / Guia de Apoio para fechar o grid harmoniosamente */}
          <Card className="bg-[#0B1F3A]/60 border border-dashed border-slate-700/80 rounded-2xl p-6 text-white flex flex-col justify-between backdrop-blur-md">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-600/20 border border-blue-400/30 flex items-center justify-center text-blue-300">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white">Governança & Consultoria</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                As demonstrações contábeis e gerenciais são integradas em tempo real com os
                lançamentos e balancetes da empresa. Utilize os filtros globais no cabeçalho
                superior para alternar entre diferentes exercícios e anos contábeis.
              </p>
            </div>

            <div className="pt-4 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
              <span className="text-[11px]">Ambiente Seguro & Auditado</span>
              <div className="flex items-center gap-1 text-slate-300">
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Assinatura Oficial da Borlim Consultoria Empresarial */}
      <div className="pt-6 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-3">
          <BorlimLogo size="sm" variant="auto" className="shadow-xs scale-90 origin-left" />
          <span className="font-semibold text-slate-700 dark:text-slate-300">
            Borlim Consultoria Empresarial
          </span>
          <span className="hidden md:inline text-slate-400">·</span>
          <span className="hidden md:inline">
            Especialistas em Reestruturação, Gestão Financeira e Controladoria
          </span>
        </div>
        <span className="text-slate-400 text-[11px]">
          Exercício: <strong>{anoAtivo}</strong> | {empresaNome}
        </span>
      </div>
    </div>
  )
}
