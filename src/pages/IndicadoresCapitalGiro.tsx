import React, { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useFilter } from '@/contexts/FilterContext'
import { useMinhaEmpresa } from '@/contexts/MinhaEmpresaContext'
import { balancosService, dreService } from '@/services/financeService'
import type { BalancoRecord, DreRecord } from '@/types/finance'
import {
  calcularBalanco,
  calcularDre,
  calcularCapitalGiro,
  formatBrlMil,
  formatCurrency,
  formatNumber,
  formatPercent,
  formatCnpj,
} from '@/lib/financeCalculations'
import { useRealtime } from '@/hooks/use-realtime'
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { SparklineEvolucao } from '@/components/SparklineEvolucao'
import { getBenchmarkParaSegmento } from '@/lib/benchmarks'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Cell,
  ReferenceLine,
  Legend,
} from 'recharts'
import {
  Coins,
  Building2,
  Calendar,
  Download,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  TrendingUp,
  TrendingDown,
  BarChart3,
  FileSpreadsheet,
  PlusCircle,
  Layers,
  ArrowRight,
  Info,
  DollarSign,
  Scale,
  RefreshCw,
  PieChart as PieChartIcon,
  ShieldAlert,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Clock,
  Sparkles,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface IndicadorGiroCardInfo {
  id: 'cgb' | 'cgl' | 'ncg' | 'st' | 'lc' | 'ciclos'
  nome: string
  sigla: string
  formula: string
  formulaExplicada: string
  descricaoCurta: string
  valor: number | null
  isCurrency: boolean
  status: 'verde' | 'ambar' | 'vermelho' | 'indefinido'
  statusTexto: string
  interpretacao: string
  referencia: string
  variaveis: {
    label: string
    sigla: string
    valor: number
    isCurrency?: boolean
    detalhes?: string
  }[]
}

export default function IndicadoresCapitalGiro() {
  const {
    empresas,
    selectedEmpresaId,
    setSelectedEmpresaId,
    selectedAno,
    setSelectedAno,
    anosDisponiveis,
    selectedEmpresa,
  } = useFilter()
  const { minhaEmpresa } = useMinhaEmpresa()
  const { toast } = useToast()
  const navigate = useNavigate()

  const [balancos, setBalancos] = useState<BalancoRecord[]>([])
  const [dres, setDres] = useState<DreRecord[]>([])
  const [loading, setLoading] = useState<boolean>(true)

  // Toggle de evolução 3 anos
  const [verEvolucao, setVerEvolucao] = useState<boolean>(false)

  // Tipo de visualização do gráfico de evolução 3 anos: 'linhas' | 'barras'
  const [tipoGraficoEvolucao, setTipoGraficoEvolucao] = useState<'linhas' | 'barras'>('linhas')

  // Estado de detalhes expandidos por card
  const [expandedDetails, setExpandedDetails] = useState<Record<string, boolean>>({
    cgb: false,
    cgl: false,
    ncg: false,
    st: false,
    lc: false,
    ciclos: false,
  })

  const toggleDetails = (id: string) => {
    setExpandedDetails((prev) => ({
      ...prev,
      [id]: !prev[id],
    }))
  }

  // Carregar dados das demonstrações contábeis
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
      console.error('Erro ao carregar dados para análise de capital de giro:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar dados',
        description: 'Não foi possível buscar as informações contábeis da empresa selecionada.',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [selectedEmpresaId])

  // Tempo real via useRealtime
  useRealtime<BalancoRecord>('balancos', () => {
    loadData()
  })
  useRealtime<DreRecord>('dre', () => {
    loadData()
  })

  // Balanço e DRE dos 3 anos
  const balancoAtual = useMemo(
    () => balancos.find((b) => b.ano === selectedAno) || null,
    [balancos, selectedAno],
  )
  const dreAtual = useMemo(
    () => dres.find((d) => d.ano === selectedAno) || null,
    [dres, selectedAno],
  )

  const anoAnterior = selectedAno - 1
  const balancoAnterior = useMemo(
    () => balancos.find((b) => b.ano === anoAnterior) || null,
    [balancos, anoAnterior],
  )
  const dreAnterior = useMemo(
    () => dres.find((d) => d.ano === anoAnterior) || null,
    [dres, anoAnterior],
  )

  const ano2 = selectedAno - 2
  const balancoAno2 = useMemo(() => balancos.find((b) => b.ano === ano2) || null, [balancos, ano2])
  const dreAno2 = useMemo(() => dres.find((d) => d.ano === ano2) || null, [dres, ano2])

  // Cálculos contábeis de Capital de Giro
  const giroAtual = useMemo(
    () => calcularCapitalGiro(balancoAtual, dreAtual),
    [balancoAtual, dreAtual],
  )
  const giroAnterior = useMemo(
    () =>
      balancoAnterior || dreAnterior ? calcularCapitalGiro(balancoAnterior, dreAnterior) : null,
    [balancoAnterior, dreAnterior],
  )
  const giroAno2 = useMemo(
    () => (balancoAno2 || dreAno2 ? calcularCapitalGiro(balancoAno2, dreAno2) : null),
    [balancoAno2, dreAno2],
  )

  const calcB = useMemo(() => calcularBalanco(balancoAtual), [balancoAtual])
  const calcD = useMemo(() => calcularDre(dreAtual), [dreAtual])

  // Anos disponíveis para a empresa
  const anosEmpresa = useMemo(() => {
    const anosSet = new Set<number>()
    balancos.forEach((b) => anosSet.add(b.ano))
    dres.forEach((d) => anosSet.add(d.ano))
    if (anosDisponiveis && anosDisponiveis.length > 0) {
      anosDisponiveis.forEach((a) => anosSet.add(a))
    }
    const arr = Array.from(anosSet).sort((a, b) => b - a)
    return arr.length > 0 ? arr : [selectedAno]
  }, [balancos, dres, anosDisponiveis, selectedAno])

  const benchmarkSetor = useMemo(
    () => getBenchmarkParaSegmento(selectedEmpresa?.segmento),
    [selectedEmpresa?.segmento],
  )

  // ================= CLASSIFICAÇÕES & INTERPRETAÇÕES =================

  // 1. CGB (Capital de Giro Bruto)
  const cgbStatus: 'verde' | 'ambar' | 'vermelho' | 'indefinido' =
    giroAtual.cgb > 0 ? 'verde' : 'ambar'
  const cgbStatusTexto = giroAtual.cgb > 0 ? 'Ativo Circulante Positivo' : 'Sem Circulante'
  const cgbInterpretacao =
    giroAtual.cgb > 0
      ? `O Capital de Giro Bruto de ${formatCurrency(giroAtual.cgb)} representa o total de recursos de curto prazo aplicados no giro da empresa (ativos que serão convertidos em dinheiro ou consumidos no ciclo). Deste montante, ${formatCurrency(giroAtual.ativoCirculanteOperacional)} (${formatPercent(giroAtual.cgb > 0 ? (giroAtual.ativoCirculanteOperacional / giroAtual.cgb) * 100 : 0, 1)}) está aplicado nas operações comerciais e ${formatCurrency(giroAtual.ativoCirculanteFinanceiro)} em reservas imediatas de tesouraria.`
      : 'Não foram identificados valores registrados no Ativo Circulante no exercício.'

  // 2. CGL (Capital de Giro Líquido / Capital Circulante Líquido)
  const cglStatus: 'verde' | 'ambar' | 'vermelho' | 'indefinido' =
    giroAtual.cgl > 0 ? 'verde' : giroAtual.cgl === 0 ? 'ambar' : 'vermelho'
  const cglStatusTexto =
    giroAtual.cgl > 0
      ? 'Folga Financeira (CGL > 0)'
      : giroAtual.cgl === 0
        ? 'Equilíbrio Estrito (CGL = 0)'
        : 'Déficit Circulante (CGL < 0)'
  const cglInterpretacao =
    giroAtual.cgl > 0
      ? `O Capital de Giro Líquido positivo de ${formatCurrency(giroAtual.cgl)} indica que a empresa dispõe de recursos permanentes (longo prazo e patrimônio líquido) financiando a totalidade dos ativos não circulantes e ainda gerando uma folga de ${formatCurrency(giroAtual.cgl)} para suportar a operação de curto prazo. Isso confere robusta segurança contra choques e reduz a dependência de empréstimos emergenciais.`
      : giroAtual.cgl < 0
        ? `O Capital de Giro Líquido negativo de ${formatCurrency(giroAtual.cgl)} sinaliza que o Passivo Circulante excede o Ativo Circulante. A empresa está financiando ativos de longo prazo com recursos exigíveis a curto prazo, configurando descasamento estrutural de prazos e dependência crítica de renovação contínua de dívidas de curto prazo.`
        : 'O Ativo Circulante é exatamente igual ao Passivo Circulante, operando sem margem de segurança contra imprevistos operacionais.'

  // 3. NCG (Necessidade de Capital de Giro)
  const ncgStatus: 'verde' | 'ambar' | 'vermelho' | 'indefinido' =
    giroAtual.ncg <= 0
      ? 'verde'
      : giroAtual.cgl > 0 && giroAtual.cgl >= giroAtual.ncg
        ? 'verde'
        : 'ambar'
  const ncgStatusTexto =
    giroAtual.ncg < 0
      ? 'Financiada por Fornecedores (NCG < 0)'
      : giroAtual.ncg === 0
        ? 'NCG Nula'
        : giroAtual.cgl >= giroAtual.ncg
          ? 'NCG Coberta por CGL'
          : 'NCG Pressionando Caixa'
  const ncgInterpretacao =
    giroAtual.ncg > 0
      ? `A Necessidade de Capital de Giro de ${formatCurrency(giroAtual.ncg)} representa o volume de recursos financeiros que o ciclo operacional (estoques de ${formatCurrency(balancoAtual?.estoques || 0)} + contas a receber de ${formatCurrency(balancoAtual?.contas_receber || 0)}) exige além do financiamento obtido dos fornecedores e obrigações operacionais (${formatCurrency(giroAtual.passivoCirculanteOperacional)}). ${giroAtual.cgl >= giroAtual.ncg ? 'Como o CGL é superior à NCG, essa necessidade está confortavelmente coberta por recursos próprios/longo prazo.' : 'Como o CGL é inferior à NCG, há pressão sobre a tesouraria e necessidade de linhas de crédito de curto prazo.'}`
      : giroAtual.ncg < 0
        ? `A NCG NEGATIVA de ${formatCurrency(giroAtual.ncg)} é um cenário altamente favorável: as fontes operacionais gratuitas (fornecedores e impostos) financiam integralmente os estoques e recebíveis e ainda liberam ${formatCurrency(Math.abs(giroAtual.ncg))} para a tesouraria da organização, permitindo operar sem necessidade de capital de giro próprio.`
        : 'O Ativo Circulante Operacional equilibra-se perfeitamente com o Passivo Circulante Operacional, sem exigir recursos adicionais para giro.'

  // 4. Saldo de Tesouraria (ST)
  const stStatus: 'verde' | 'ambar' | 'vermelho' | 'indefinido' =
    giroAtual.saldoTesouraria > 0 ? 'verde' : giroAtual.saldoTesouraria === 0 ? 'ambar' : 'vermelho'
  const stStatusTexto =
    giroAtual.saldoTesouraria > 0
      ? 'Superávit Financeiro (ST > 0)'
      : giroAtual.saldoTesouraria === 0
        ? 'Tesouraria Zerada'
        : 'Déficit Bancário / Efeito Tesoura (ST < 0)'
  const stInterpretacao =
    giroAtual.saldoTesouraria > 0
      ? `O Saldo de Tesouraria SUPERAVITÁRIO de ${formatCurrency(giroAtual.saldoTesouraria)} evidencia excelente liquidez financeira. As disponibilidades de caixa e aplicações (${formatCurrency(giroAtual.ativoCirculanteFinanceiro)}) superam com folga as dívidas bancárias de curto prazo (${formatCurrency(giroAtual.passivoCirculanteFinanceiro)}). A empresa tem total autonomia e margem financeira contra imprevistos.`
      : giroAtual.saldoTesouraria < 0
        ? `O Saldo de Tesouraria DEFICITÁRIO de ${formatCurrency(giroAtual.saldoTesouraria)} alerta que a empresa está dependendo de empréstimos bancários de curto prazo (${formatCurrency(giroAtual.passivoCirculanteFinanceiro)}) para bancar a sua operação. Caso o ciclo se alongue ou as vendas cresçam rápido sem aumento de CGL, há risco de agravamento do "Efeito Tesoura" (crescimento da NCG consumindo mais crédito bancário oneroso).`
        : 'O saldo financeiro de disponibilidades empata estritamente com os empréstimos de curto prazo.'

  // 5. Liquidez Corrente
  const lcStatus: 'verde' | 'ambar' | 'vermelho' | 'indefinido' =
    giroAtual.liquidezCorrente === null
      ? 'indefinido'
      : giroAtual.liquidezCorrente >= 1.2
        ? 'verde'
        : giroAtual.liquidezCorrente >= 1.0
          ? 'ambar'
          : 'vermelho'

  // Históricos para Sparklines
  const histCGB = [
    { ano: ano2, valor: giroAno2?.cgb ?? null },
    { ano: anoAnterior, valor: giroAnterior?.cgb ?? null },
    { ano: selectedAno, valor: giroAtual.cgb },
  ]
  const histCGL = [
    { ano: ano2, valor: giroAno2?.cgl ?? null },
    { ano: anoAnterior, valor: giroAnterior?.cgl ?? null },
    { ano: selectedAno, valor: giroAtual.cgl },
  ]
  const histNCG = [
    { ano: ano2, valor: giroAno2?.ncg ?? null },
    { ano: anoAnterior, valor: giroAnterior?.ncg ?? null },
    { ano: selectedAno, valor: giroAtual.ncg },
  ]
  const histST = [
    { ano: ano2, valor: giroAno2?.saldoTesouraria ?? null },
    { ano: anoAnterior, valor: giroAnterior?.saldoTesouraria ?? null },
    { ano: selectedAno, valor: giroAtual.saldoTesouraria },
  ]

  // Lista dos Cards de Indicadores
  const cardsIndicadores: IndicadorGiroCardInfo[] = [
    {
      id: 'cgb',
      nome: 'Capital de Giro Bruto',
      sigla: 'CGB',
      formula: 'CGB = Ativo Circulante',
      formulaExplicada:
        'Soma integral de todos os direitos e bens realizáveis no curto prazo (Caixa + Bancos + Contas a Receber + Estoques + Impostos a Recuperar + Outros AC)',
      descricaoCurta: 'Volume total de recursos aplicados no giro de curto prazo',
      valor: giroAtual.cgb,
      isCurrency: true,
      status: cgbStatus,
      statusTexto: cgbStatusTexto,
      interpretacao: cgbInterpretacao,
      referencia: 'Compatível com o volume de vendas e giro operacional',
      variaveis: [
        {
          label: 'Ativo Circulante Operacional (ACO)',
          sigla: 'ACO',
          valor: giroAtual.ativoCirculanteOperacional,
          isCurrency: true,
          detalhes: 'Clientes + Estoques + Impostos Recuperar + Outros',
        },
        {
          label: 'Ativo Circulante Financeiro (ACF)',
          sigla: 'ACF',
          valor: giroAtual.ativoCirculanteFinanceiro,
          isCurrency: true,
          detalhes: 'Caixa e Equivalentes + Aplicações Financeiras',
        },
      ],
    },
    {
      id: 'cgl',
      nome: 'Capital de Giro Líquido',
      sigla: 'CGL',
      formula: 'CGL = Ativo Circulante − Passivo Circulante',
      formulaExplicada:
        'CGL = AC − PC (Equivalente estrutural a: (Patrimônio Líquido + Passivo Não Circulante) − Ativo Não Circulante)',
      descricaoCurta: 'Folga financeira líquida gerada por recursos de longo prazo',
      valor: giroAtual.cgl,
      isCurrency: true,
      status: cglStatus,
      statusTexto: cglStatusTexto,
      interpretacao: cglInterpretacao,
      referencia: '> R$ 0,00 (Ideal: CGL ≥ NCG para manter ST positivo)',
      variaveis: [
        {
          label: 'Ativo Circulante (AC)',
          sigla: 'AC',
          valor: giroAtual.ativoCirculante,
          isCurrency: true,
        },
        {
          label: 'Passivo Circulante (PC)',
          sigla: 'PC',
          valor: giroAtual.passivoCirculante,
          isCurrency: true,
        },
      ],
    },
    {
      id: 'ncg',
      nome: 'Necessidade de Capital de Giro',
      sigla: 'NCG',
      formula: 'NCG = Ativo Circ. Operacional − Passivo Circ. Operacional',
      formulaExplicada:
        'NCG = ACO − PCO (Recursos retidos nas atividades operacionais subtraídos das fontes de financiamento operacional espontâneas concedidas por fornecedores e tributos)',
      descricaoCurta: 'Recursos exigidos pelo ciclo de compras, estocagem e vendas',
      valor: giroAtual.ncg,
      isCurrency: true,
      status: ncgStatus,
      statusTexto: ncgStatusTexto,
      interpretacao: ncgInterpretacao,
      referencia: 'Quanto menor, melhor (Ideal: financiada por CGL ou NCG ≤ 0)',
      variaveis: [
        {
          label: 'Ativo Circulante Operacional (ACO)',
          sigla: 'ACO',
          valor: giroAtual.ativoCirculanteOperacional,
          isCurrency: true,
          detalhes: 'Contas a Receber + Estoques + Outros Operacionais',
        },
        {
          label: 'Passivo Circulante Operacional (PCO)',
          sigla: 'PCO',
          valor: giroAtual.passivoCirculanteOperacional,
          isCurrency: true,
          detalhes: 'Fornecedores + Obrigações Trabalhistas e Tributárias',
        },
      ],
    },
    {
      id: 'st',
      nome: 'Saldo de Tesouraria',
      sigla: 'ST',
      formula: 'ST = Ativo Circ. Financeiro − Passivo Circ. Financeiro',
      formulaExplicada:
        'ST = ACF − PCF (Identidade Fundamental de Fleuriet: ST = CGL − NCG). Mede a margem de segurança e o endividamento bancário de curto prazo.',
      descricaoCurta: 'Resultado líquido entre disponibilidades e dívidas bancárias CP',
      valor: giroAtual.saldoTesouraria,
      isCurrency: true,
      status: stStatus,
      statusTexto: stStatusTexto,
      interpretacao: stInterpretacao,
      referencia: '> R$ 0,00 (ST < 0 indica dependência de dívidas de curto prazo)',
      variaveis: [
        {
          label: 'Ativo Circulante Financeiro (ACF)',
          sigla: 'ACF',
          valor: giroAtual.ativoCirculanteFinanceiro,
          isCurrency: true,
          detalhes: 'Caixa + Aplicações Financeiras',
        },
        {
          label: 'Passivo Circulante Financeiro (PCF)',
          sigla: 'PCF',
          valor: giroAtual.passivoCirculanteFinanceiro,
          isCurrency: true,
          detalhes: 'Empréstimos e Financiamentos Bancários CP',
        },
        {
          label: 'Capital de Giro Líquido (CGL)',
          sigla: 'CGL',
          valor: giroAtual.cgl,
          isCurrency: true,
        },
        {
          label: 'Necessidade de Cap. Giro (NCG)',
          sigla: 'NCG',
          valor: giroAtual.ncg,
          isCurrency: true,
        },
      ],
    },
    {
      id: 'lc',
      nome: 'Índice de Liquidez Corrente',
      sigla: 'LC',
      formula: 'LC = Ativo Circulante / Passivo Circulante',
      formulaExplicada:
        'LC = AC ÷ PC. Mede quantas vezes o ativo circulante cobre as dívidas totais de curto prazo.',
      descricaoCurta: 'Capacidade de quitação de compromissos no curto prazo',
      valor: giroAtual.liquidezCorrente,
      isCurrency: false,
      status: lcStatus,
      statusTexto:
        giroAtual.liquidezCorrente && giroAtual.liquidezCorrente >= 1.2
          ? 'Confortável (LC ≥ 1,20)'
          : giroAtual.liquidezCorrente && giroAtual.liquidezCorrente >= 1.0
            ? 'Equilibrada (1,00 a 1,20)'
            : 'Atenção / Déficit (LC < 1,00)',
      interpretacao:
        giroAtual.liquidezCorrente && giroAtual.liquidezCorrente >= 1.2
          ? `A Liquidez Corrente de ${formatNumber(giroAtual.liquidezCorrente, 2)}x atesta confortável margem de segurança patrimonial: para cada R$ 1,00 de passivo exigível no exercício, a empresa possui R$ ${formatNumber(giroAtual.liquidezCorrente, 2)} em ativos realizáveis.`
          : `A Liquidez Corrente de ${giroAtual.liquidezCorrente !== null ? formatNumber(giroAtual.liquidezCorrente, 2) : '—'}x indica pressão no fluxo de curto prazo, demandando controle rigoroso dos desembolsos e prazos.`,
      referencia: '≥ 1,20x (Setor: 1,40x)',
      variaveis: [
        {
          label: 'Ativo Circulante (AC)',
          sigla: 'AC',
          valor: giroAtual.ativoCirculante,
          isCurrency: true,
        },
        {
          label: 'Passivo Circulante (PC)',
          sigla: 'PC',
          valor: giroAtual.passivoCirculante,
          isCurrency: true,
        },
      ],
    },
    {
      id: 'ciclos',
      nome: 'Ciclo Financeiro & Prazos Operacionais',
      sigla: 'CF / Prazos',
      formula: 'Ciclo Financeiro = (PME + PMR) − PMP',
      formulaExplicada:
        'Ciclo Operacional = PME + PMR. Ciclo Financeiro (Ciclo de Caixa) = Ciclo Operacional − PMP.',
      descricaoCurta: 'Tempo em dias entre desembolso a fornecedores e recebimento das vendas',
      valor: giroAtual.cicloFinanceiro,
      isCurrency: false,
      status:
        giroAtual.cicloFinanceiro === null
          ? 'indefinido'
          : giroAtual.cicloFinanceiro <= 30
            ? 'verde'
            : giroAtual.cicloFinanceiro <= 60
              ? 'ambar'
              : 'vermelho',
      statusTexto:
        giroAtual.cicloFinanceiro !== null && giroAtual.cicloFinanceiro < 0
          ? 'Negativo (Excelente)'
          : giroAtual.cicloFinanceiro !== null && giroAtual.cicloFinanceiro <= 30
            ? 'Ciclo Enxuto'
            : giroAtual.cicloFinanceiro !== null && giroAtual.cicloFinanceiro <= 60
              ? 'Ciclo Moderado'
              : 'Ciclo Alongado',
      interpretacao:
        giroAtual.cicloFinanceiro !== null
          ? `A empresa leva ${Math.round(giroAtual.cicloFinanceiro)} dias entre o pagamento de seus insumos/fornecedores e a efetiva conversão das vendas em caixa (PME: ${giroAtual.pme ? Math.round(giroAtual.pme) : 0}d + PMR: ${giroAtual.pmr ? Math.round(giroAtual.pmr) : 0}d − PMP: ${giroAtual.pmp ? Math.round(giroAtual.pmp) : 0}d). Quanto menor o ciclo financeiro, menor é a NCG requerida.`
          : 'Dados de DRE (CMV e Receitas) insuficientes para cálculo dos prazos médios.',
      referencia: '≤ 35 dias (Setor: ~40 dias)',
      variaveis: [
        {
          label: 'Prazo Médio de Estocagem (PME)',
          sigla: 'PME',
          valor: giroAtual.pme ?? 0,
          isCurrency: false,
          detalhes: `${giroAtual.pme ? Math.round(giroAtual.pme) : 0} dias`,
        },
        {
          label: 'Prazo Médio de Recebimento (PMR)',
          sigla: 'PMR',
          valor: giroAtual.pmr ?? 0,
          isCurrency: false,
          detalhes: `${giroAtual.pmr ? Math.round(giroAtual.pmr) : 0} dias`,
        },
        {
          label: 'Prazo Médio de Pagamento (PMP)',
          sigla: 'PMP',
          valor: giroAtual.pmp ?? 0,
          isCurrency: false,
          detalhes: `${giroAtual.pmp ? Math.round(giroAtual.pmp) : 0} dias`,
        },
      ],
    },
  ]

  // Dados para Gráfico 1: Comparativo CGB, CGL, NCG e Saldo de Tesouraria
  const dadosGraficoGiro = useMemo(() => {
    return [
      {
        nome: 'Cap. Giro Bruto (CGB)',
        sigla: 'CGB',
        valor: giroAtual.cgb,
        valorFormatado: formatCurrency(giroAtual.cgb),
        cor: '#3B82F6', // Blue
        descricao: 'Ativo Circulante Total',
      },
      {
        nome: 'Cap. Giro Líquido (CGL)',
        sigla: 'CGL',
        valor: giroAtual.cgl,
        valorFormatado: formatCurrency(giroAtual.cgl),
        cor: giroAtual.cgl >= 0 ? '#10B981' : '#EF4444', // Emerald / Red
        descricao: 'AC − PC (Recursos Próprios / LP)',
      },
      {
        nome: 'Necessidade de Cap. Giro (NCG)',
        sigla: 'NCG',
        valor: giroAtual.ncg,
        valorFormatado: formatCurrency(giroAtual.ncg),
        cor: '#F59E0B', // Amber
        descricao: 'ACO − PCO (Recursos retidos na operação)',
      },
      {
        nome: 'Saldo de Tesouraria (ST)',
        sigla: 'ST',
        valor: giroAtual.saldoTesouraria,
        valorFormatado: formatCurrency(giroAtual.saldoTesouraria),
        cor: giroAtual.saldoTesouraria >= 0 ? '#059669' : '#DC2626', // Emerald / Dark Red
        descricao: 'ACF − PCF ou CGL − NCG',
      },
    ]
  }, [giroAtual])

  // Dados para Gráfico de Evolução 3 Anos (CGB, CGL, NCG, ST)
  const dadosGraficoEvolucao3Anos = useMemo(() => {
    return [
      {
        ano: String(ano2),
        cgb: giroAno2?.cgb ?? null,
        cgl: giroAno2?.cgl ?? null,
        ncg: giroAno2?.ncg ?? null,
        st: giroAno2?.saldoTesouraria ?? null,
        hasData: !!giroAno2,
      },
      {
        ano: String(anoAnterior),
        cgb: giroAnterior?.cgb ?? null,
        cgl: giroAnterior?.cgl ?? null,
        ncg: giroAnterior?.ncg ?? null,
        st: giroAnterior?.saldoTesouraria ?? null,
        hasData: !!giroAnterior,
      },
      {
        ano: String(selectedAno),
        cgb: giroAtual.cgb,
        cgl: giroAtual.cgl,
        ncg: giroAtual.ncg,
        st: giroAtual.saldoTesouraria,
        hasData: !!balancoAtual,
      },
    ]
  }, [ano2, anoAnterior, selectedAno, giroAno2, giroAnterior, giroAtual, balancoAtual])

  // Informações sobre anos sem dados completos
  const anosComFaltaDados = useMemo(() => {
    const faltantes: string[] = []
    if (!giroAno2) faltantes.push(String(ano2))
    if (!giroAnterior) faltantes.push(String(anoAnterior))
    if (!balancoAtual) faltantes.push(String(selectedAno))
    return faltantes
  }, [ano2, anoAnterior, selectedAno, giroAno2, giroAnterior, balancoAtual])

  // Análise de Saldo de Tesouraria Negativo em Períodos Consecutivos (Histórico 3 anos)
  const analiseStConsecutivo = useMemo(() => {
    const stAtual = giroAtual.saldoTesouraria
    const stAnt = giroAnterior?.saldoTesouraria ?? null
    const stAno2 = giroAno2?.saldoTesouraria ?? null

    const anosNegativos: number[] = []
    if (stAno2 !== null && stAno2 < 0) anosNegativos.push(ano2)
    if (stAnt !== null && stAnt < 0) anosNegativos.push(anoAnterior)
    if (stAtual !== null && stAtual < 0) anosNegativos.push(selectedAno)

    const isNegativoAtual = stAtual !== null && stAtual < 0
    const isConsecutivo2Anos = isNegativoAtual && stAnt !== null && stAnt < 0
    const isConsecutivo3Anos = isConsecutivo2Anos && stAno2 !== null && stAno2 < 0

    return {
      isNegativoAtual,
      isConsecutivo2Anos,
      isConsecutivo3Anos,
      anosNegativos,
      stAtual,
      stAnt,
      stAno2,
    }
  }, [giroAtual, giroAnterior, giroAno2, selectedAno, anoAnterior, ano2])

  // Dados para Gráfico 2: Decomposição Ativo e Passivo Circulante (Operacional vs Financeiro)
  const dadosGraficoDecomposicao = useMemo(() => {
    return [
      {
        categoria: 'Ativo Circulante',
        Operacional: giroAtual.ativoCirculanteOperacional,
        Financeiro: giroAtual.ativoCirculanteFinanceiro,
        total: giroAtual.ativoCirculante,
      },
      {
        categoria: 'Passivo Circulante',
        Operacional: giroAtual.passivoCirculanteOperacional,
        Financeiro: giroAtual.passivoCirculanteFinanceiro,
        total: giroAtual.passivoCirculante,
      },
    ]
  }, [giroAtual])

  // Parecer Executivo Automatizado
  const parecerExecutivo = useMemo(() => {
    const pontos: { tipo: 'positivo' | 'alerta' | 'neutro'; texto: string }[] = []

    // 1. Diagnóstico do Modelo Fleuriet
    pontos.push({
      tipo:
        giroAtual.tipoFleuriet === 'excelente' || giroAtual.tipoFleuriet === 'solida'
          ? 'positivo'
          : giroAtual.tipoFleuriet === 'em_crescimento'
            ? 'alerta'
            : 'alerta',
      texto: `Estrutura de Fleuriet: ${giroAtual.tipoFleurietNome}. ${giroAtual.tipoFleurietDescricao}`,
    })

    // 2. Análise do CGL vs NCG
    if (giroAtual.cgl > 0 && giroAtual.ncg > 0) {
      if (giroAtual.cgl >= giroAtual.ncg) {
        pontos.push({
          tipo: 'positivo',
          texto: `O Capital de Giro Líquido (${formatCurrency(giroAtual.cgl)}) é suficiente para absorver 100% da Necessidade de Capital de Giro (${formatCurrency(giroAtual.ncg)}), gerando um excedente de tesouraria de ${formatCurrency(giroAtual.saldoTesouraria)}. Não há dependência de recursos bancários de curto prazo.`,
        })
      } else {
        pontos.push({
          tipo: 'alerta',
          texto: `A Necessidade de Capital de Giro (${formatCurrency(giroAtual.ncg)}) supera o Capital de Giro Líquido (${formatCurrency(giroAtual.cgl)}) em ${formatCurrency(Math.abs(giroAtual.saldoTesouraria))}. A diferença é suprida por dívidas financeiras de curto prazo (empréstimos bancários), o que onera o resultado financeiro com juros.`,
        })
      }
    } else if (giroAtual.cgl <= 0) {
      pontos.push({
        tipo: 'alerta',
        texto: `Capital de Giro Líquido negativo de ${formatCurrency(giroAtual.cgl)}. A empresa depende de recursos operacionais de curto prazo para bancar obrigações imediatas. Sugere-se alongar passivos ou integralizar capital.`,
      })
    }

    // 3. Análise dos Ciclos e Prazos
    if (giroAtual.cicloFinanceiro !== null) {
      if (giroAtual.cicloFinanceiro <= 30) {
        pontos.push({
          tipo: 'positivo',
          texto: `Ciclo financeiro enxuto de ${Math.round(giroAtual.cicloFinanceiro)} dias. A empresa recupera o caixa das vendas rapidamente frente ao prazo concedido por fornecedores (${giroAtual.pmp ? Math.round(giroAtual.pmp) : 0} dias), preservando a liquidez diária.`,
        })
      } else {
        pontos.push({
          tipo: 'alerta',
          texto: `Ciclo financeiro de ${Math.round(giroAtual.cicloFinanceiro)} dias. Há um descompasso temporal entre o pagamento das compras (${giroAtual.pmp ? Math.round(giroAtual.pmp) : 0}d) e o recebimento das vendas (${giroAtual.pmr ? Math.round(giroAtual.pmr) : 0}d) somado ao tempo de estocagem (${giroAtual.pme ? Math.round(giroAtual.pme) : 0}d). Otimizar o giro de estoques e renegociar prazos com fornecedores liberará caixa imediato.`,
        })
      }
    }

    // 4. Recomendações Estratégicas
    const recomendacoes: string[] = []
    if (giroAtual.saldoTesouraria < 0) {
      recomendacoes.push(
        'Alongar o perfil de endividamento substituindo linhas de crédito bancárias de curto prazo por financiamentos de longo prazo com menor taxa de juros.',
      )
    }
    if (giroAtual.pme && giroAtual.pme > 60) {
      recomendacoes.push(
        'Reduzir o volume de estoques parados através de campanhas promocionais de desova e implantação de compras sob demanda (Just-in-Time).',
      )
    }
    if (giroAtual.pmr && giroAtual.pmr > 45) {
      recomendacoes.push(
        'Incentivar pagamentos à vista via PIX ou boleto com desconto e implementar réguas automáticas de cobrança para acelerar o recebimento de recebíveis.',
      )
    }
    if (giroAtual.pmp && giroAtual.pmp < 30) {
      recomendacoes.push(
        'Renegociar termos com os principais fornecedores para estender o prazo médio de pagamento para no mínimo 30 a 45 dias sem custos adicionais.',
      )
    }
    if (recomendacoes.length === 0) {
      recomendacoes.push(
        'Manter a atual disciplina de prazos de recebimento e pagamento, monitorando mensalmente as oscilações sazonais da NCG.',
      )
      recomendacoes.push(
        'Aplicar os recursos excedentes de tesouraria em títulos de renda fixa de alta liquidez para maximizar as receitas financeiras.',
      )
    }

    return { pontos, recomendacoes }
  }, [giroAtual])

  // Exportação CSV Completa
  const handleExportCsv = () => {
    if (!selectedEmpresa) {
      toast({
        title: 'Selecione uma empresa',
        description: 'É necessário selecionar uma empresa para exportar os dados.',
        variant: 'destructive',
      })
      return
    }

    let csvContent = '\uFEFF' // BOM UTF-8
    const dataEmissao = new Date().toLocaleDateString('pt-BR')

    csvContent += `ANÁLISE COMPLETA DO CAPITAL DE GIRO & MODELO FLEURIET\n`
    csvContent += `EMPRESA;${selectedEmpresa.nome}\n`
    csvContent += `CNPJ;${formatCnpj(selectedEmpresa.cnpj)}\n`
    csvContent += `SEGMENTO;${selectedEmpresa.segmento || 'Serviços'}\n`
    csvContent += `EXERCÍCIO BASE;${selectedAno}\n`
    csvContent += `DATA DE EMISSÃO;${dataEmissao}\n`
    csvContent += `CLASSIFICAÇÃO FLEURIET;${giroAtual.tipoFleurietNome}\n\n`

    csvContent += `1. INDICADORES PRINCIPAIS DE CAPITAL DE GIRO\n`
    csvContent += `Indicador;Sigla;Valor (R$ / Ind);Fórmula;Classificação;Interpretação\n`
    for (const card of cardsIndicadores) {
      const valStr = card.isCurrency
        ? formatCurrency(card.valor).replace(/\s/g, ' ')
        : card.valor !== null
          ? formatNumber(card.valor, 2)
          : '—'
      csvContent += `${card.nome};${card.sigla};${valStr};${card.formula};${card.statusTexto};"${card.interpretacao.replace(/"/g, '""')}"\n`
    }

    csvContent += `\n2. DECOMPOSIÇÃO DO ATIVO E PASSIVO CIRCULANTE (R$)\n`
    csvContent += `Grupo;Componente;Valor (R$);Participação %\n`
    csvContent += `Ativo Circulante;Ativo Circulante Operacional (ACO);${formatCurrency(giroAtual.ativoCirculanteOperacional).replace(/\s/g, ' ')};${formatPercent(giroAtual.ativoCirculante > 0 ? (giroAtual.ativoCirculanteOperacional / giroAtual.ativoCirculante) * 100 : 0, 1)}\n`
    csvContent += `Ativo Circulante;Ativo Circulante Financeiro (ACF / Caixa);${formatCurrency(giroAtual.ativoCirculanteFinanceiro).replace(/\s/g, ' ')};${formatPercent(giroAtual.ativoCirculante > 0 ? (giroAtual.ativoCirculanteFinanceiro / giroAtual.ativoCirculante) * 100 : 0, 1)}\n`
    csvContent += `Ativo Circulante;Ativo Circulante Total (CGB);${formatCurrency(giroAtual.ativoCirculante).replace(/\s/g, ' ')};100.0%\n`
    csvContent += `Passivo Circulante;Passivo Circulante Operacional (PCO);${formatCurrency(giroAtual.passivoCirculanteOperacional).replace(/\s/g, ' ')};${formatPercent(giroAtual.passivoCirculante > 0 ? (giroAtual.passivoCirculanteOperacional / giroAtual.passivoCirculante) * 100 : 0, 1)}\n`
    csvContent += `Passivo Circulante;Passivo Circulante Financeiro (PCF / Empréstimos);${formatCurrency(giroAtual.passivoCirculanteFinanceiro).replace(/\s/g, ' ')};${formatPercent(giroAtual.passivoCirculante > 0 ? (giroAtual.passivoCirculanteFinanceiro / giroAtual.passivoCirculante) * 100 : 0, 1)}\n`
    csvContent += `Passivo Circulante;Passivo Circulante Total;${formatCurrency(giroAtual.passivoCirculante).replace(/\s/g, ' ')};100.0%\n`

    csvContent += `\n3. SÍNTESE DO MODELO FLEURIET\n`
    csvContent += `Capital de Giro Líquido (CGL);${formatCurrency(giroAtual.cgl).replace(/\s/g, ' ')}\n`
    csvContent += `Necessidade de Capital de Giro (NCG);${formatCurrency(giroAtual.ncg).replace(/\s/g, ' ')}\n`
    csvContent += `Saldo de Tesouraria (ST = CGL - NCG);${formatCurrency(giroAtual.saldoTesouraria).replace(/\s/g, ' ')}\n`
    csvContent += `Diagnóstico;${giroAtual.tipoFleurietDescricao}\n`

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `analise-capital-giro-${selectedEmpresa.nome.replace(/\s+/g, '-').toLowerCase()}-${selectedAno}.csv`
    link.click()
    URL.revokeObjectURL(link.href)

    toast({
      title: 'Exportação concluída!',
      description: `Relatório CSV de Capital de Giro gerado com sucesso para ${selectedEmpresa.nome} (${selectedAno}).`,
    })
  }

  // Renderizador de badge de status
  const renderStatusBadge = (
    status: 'verde' | 'ambar' | 'vermelho' | 'indefinido',
    texto: string,
  ) => {
    switch (status) {
      case 'verde':
        return (
          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs font-semibold hover:bg-emerald-100 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />🟢 {texto}
          </Badge>
        )
      case 'ambar':
        return (
          <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-xs font-semibold hover:bg-amber-100 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />🟠 {texto}
          </Badge>
        )
      case 'vermelho':
        return (
          <Badge className="bg-red-50 text-red-700 border-red-200 text-xs font-semibold hover:bg-red-100 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />🔴 {texto}
          </Badge>
        )
      default:
        return (
          <Badge className="bg-slate-50 text-slate-600 border-slate-200 text-xs font-semibold">
            Sem Dados
          </Badge>
        )
    }
  }

  return (
    <div className="space-y-6 pb-12">
      {/* 1. CABEÇALHO & SELETORES */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Coins className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-[#0B1F3A] tracking-tight flex items-center gap-2">
                Análise do Capital de Giro
                <Badge className="bg-blue-100 text-blue-800 border-blue-300 text-xs font-bold">
                  Modelo Fleuriet
                </Badge>
              </h1>
              <p className="text-xs text-slate-500">
                Avaliação dinâmica da Necessidade de Capital de Giro (NCG), CGL e Saldo de
                Tesouraria
              </p>
            </div>
          </div>
        </div>

        {/* Controles de Empresa, Ano e Ações */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Seletor de Empresa */}
          <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-200">
            <Building2 className="w-4 h-4 text-slate-400 ml-2" />
            <Select
              value={selectedEmpresaId || ''}
              onValueChange={(val) => setSelectedEmpresaId(val)}
            >
              <SelectTrigger className="w-[180px] sm:w-[220px] h-8 text-xs border-none bg-transparent shadow-none font-semibold text-[#0B1F3A] focus:ring-0">
                <SelectValue placeholder="Selecione a Empresa" />
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

          {/* Seletor de Ano */}
          <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-200">
            <Calendar className="w-4 h-4 text-slate-400 ml-2" />
            <Select
              value={String(selectedAno)}
              onValueChange={(val) => setSelectedAno(Number(val))}
            >
              <SelectTrigger className="w-[90px] h-8 text-xs border-none bg-transparent shadow-none font-semibold text-[#0B1F3A] focus:ring-0">
                <SelectValue placeholder="Ano" />
              </SelectTrigger>
              <SelectContent>
                {anosEmpresa.map((ano) => (
                  <SelectItem key={ano} value={String(ano)} className="text-xs font-mono">
                    {ano}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Toggle Evolução 3 Anos */}
          <div className="flex items-center gap-2 px-3 py-1 bg-slate-50 rounded-xl border border-slate-200">
            <Switch
              id="toggle-evolucao-giro"
              checked={verEvolucao}
              onCheckedChange={setVerEvolucao}
              className="scale-75 data-[state=checked]:bg-blue-600"
            />
            <Label
              htmlFor="toggle-evolucao-giro"
              className="text-xs font-semibold text-slate-700 cursor-pointer select-none"
            >
              Evolução 3 Anos
            </Label>
          </div>

          {/* Botão Exportar CSV */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            disabled={!selectedEmpresa}
            className="h-8 text-xs font-semibold border-slate-200 text-slate-700 hover:bg-slate-50 gap-1.5"
          >
            <Download className="w-3.5 h-3.5 text-blue-600" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {/* 2. ALERTA DE SALDO DE TESOURARIA NEGATIVO (EFEITO TESOURA & SÉRIE HISTÓRICA) */}
      {selectedEmpresa && analiseStConsecutivo.isNegativoAtual && (
        <div className="p-4 sm:p-5 rounded-2xl border-2 border-red-300 bg-linear-to-r from-red-50 via-rose-50 to-amber-50 shadow-xs animate-fadeIn">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-red-600 text-white flex items-center justify-center shrink-0 shadow-md">
                <AlertTriangle className="w-6 h-6 animate-pulse" />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className="bg-red-600 text-white border-0 font-extrabold text-xs px-2.5 py-0.5 tracking-wide uppercase">
                    🔴 ALERTA CRÍTICO: SALDO DE TESOURARIA DEFICITÁRIO (ST &lt; 0)
                  </Badge>
                  {analiseStConsecutivo.isConsecutivo3Anos ? (
                    <Badge className="bg-red-950 text-red-200 border border-red-700 text-xs font-bold px-2 py-0.5">
                      ⚠️ ST Negativo por 3 Anos Consecutivos ({ano2}, {anoAnterior}, {selectedAno})
                    </Badge>
                  ) : analiseStConsecutivo.isConsecutivo2Anos ? (
                    <Badge className="bg-red-900 text-red-100 border border-red-700 text-xs font-bold px-2 py-0.5">
                      ⚠️ ST Negativo Consecutivo ({anoAnterior} e {selectedAno})
                    </Badge>
                  ) : (
                    <Badge className="bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold px-2 py-0.5">
                      Exercício {selectedAno} Deficitário
                    </Badge>
                  )}
                </div>

                <h3 className="text-sm sm:text-base font-bold text-red-950">
                  Risco de "Efeito Tesoura" e Dependência Bancária de Curto Prazo
                </h3>

                <p className="text-xs text-red-900/90 leading-relaxed text-justify">
                  O Saldo de Tesouraria fechou em{' '}
                  <strong className="font-mono text-red-700 text-sm">
                    {formatCurrency(giroAtual.saldoTesouraria)}
                  </strong>
                  . Isto significa que as fontes de longo prazo (CGL de{' '}
                  {formatCurrency(giroAtual.cgl)}) não foram suficientes para sustentar as
                  necessidades operacionais do negócio (NCG de {formatCurrency(giroAtual.ncg)}),
                  forçando a empresa a cobrir a diferença através de{' '}
                  <strong>
                    empréstimos, descontos de duplicatas ou limites bancários de curto prazo (
                    {formatCurrency(giroAtual.passivoCirculanteFinanceiro)})
                  </strong>
                  .
                  {analiseStConsecutivo.isConsecutivo2Anos && (
                    <span className="block mt-1 font-semibold text-red-950">
                      🚨 <strong>Alerta de Série Histórica:</strong> A empresa mantém a tesouraria
                      negativa consecutivamente nos exercícios de{' '}
                      {analiseStConsecutivo.anosNegativos.join(', ')}. A persistência deste déficit
                      caracteriza dependência estrutural de crédito rotativo caro, comprimindo o
                      lucro líquido com despesas financeiras.
                    </span>
                  )}
                </p>

                <div className="pt-2 border-t border-red-200/80 flex flex-col sm:flex-row sm:items-center gap-2 text-xs text-red-900 font-medium">
                  <span className="font-bold text-red-950 shrink-0">
                    💡 Recomendação Executiva:
                  </span>
                  <span>
                    Alongar passivos convertendo dívidas de curto prazo para linhas de longo prazo,
                    renegociar prazos com fornecedores (aumentar PMP) e acelerar cobrança de
                    recebíveis (reduzir PMR) para estancar o consumo de caixa.
                  </span>
                </div>
              </div>
            </div>

            <div className="shrink-0 bg-white/90 backdrop-blur-xs p-3.5 rounded-xl border border-red-200 shadow-2xs text-xs space-y-1.5 self-stretch lg:self-auto min-w-[200px]">
              <div className="flex justify-between items-center text-slate-500">
                <span>Déficit ST Atual:</span>
                <strong className="text-red-700 font-mono text-sm">
                  {formatCurrency(giroAtual.saldoTesouraria)}
                </strong>
              </div>
              <div className="flex justify-between items-center text-slate-500">
                <span>Dívidas Bancárias CP:</span>
                <strong className="text-slate-800 font-mono">
                  {formatCurrency(giroAtual.passivoCirculanteFinanceiro)}
                </strong>
              </div>
              <div className="flex justify-between items-center text-slate-500">
                <span>Déficit NCG s/ CGL:</span>
                <strong className="text-amber-700 font-mono">
                  {formatCurrency(Math.abs(giroAtual.cgl - giroAtual.ncg))}
                </strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2.1 DIAGNÓSTICO FLEURIET (QUANDO NÃO ESTIVER EM DEFICIT SEVERO OU PARA COMPLEMENTO) */}
      {selectedEmpresa && (
        <div
          className={`p-4 rounded-2xl border transition-all ${
            giroAtual.tipoFleuriet === 'excelente' || giroAtual.tipoFleuriet === 'solida'
              ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
              : giroAtual.tipoFleuriet === 'em_crescimento'
                ? 'bg-blue-50/70 border-blue-200 text-blue-950'
                : 'bg-amber-50/70 border-amber-200 text-amber-950'
          }`}
        >
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  giroAtual.tipoFleuriet === 'excelente' || giroAtual.tipoFleuriet === 'solida'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : giroAtual.tipoFleuriet === 'em_crescimento'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-amber-600 text-white shadow-xs'
                }`}
              >
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs uppercase tracking-wider font-bold opacity-75">
                    Diagnóstico da Estrutura de Capital de Giro (Modelo Fleuriet)
                  </span>
                  <Badge
                    className={
                      giroAtual.tipoFleuriet === 'excelente' || giroAtual.tipoFleuriet === 'solida'
                        ? 'bg-emerald-600 text-white font-bold text-xs'
                        : giroAtual.tipoFleuriet === 'em_crescimento'
                          ? 'bg-blue-600 text-white font-bold text-xs'
                          : 'bg-amber-600 text-white font-bold text-xs'
                    }
                  >
                    {giroAtual.tipoFleurietNome}
                  </Badge>
                </div>
                <p className="text-xs sm:text-sm font-medium mt-0.5 leading-snug">
                  {giroAtual.tipoFleurietDescricao}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 self-end md:self-auto shrink-0 bg-white/70 backdrop-blur-xs px-3 py-1.5 rounded-xl border border-slate-200/60 text-xs">
              <div>
                <span className="text-[10px] text-slate-500 font-bold block">SALDO TESOURARIA</span>
                <span
                  className={`font-mono font-extrabold ${
                    giroAtual.saldoTesouraria >= 0 ? 'text-emerald-700' : 'text-red-600'
                  }`}
                >
                  {formatCurrency(giroAtual.saldoTesouraria)}
                </span>
              </div>
              <div className="border-l border-slate-200 pl-3">
                <span className="text-[10px] text-slate-500 font-bold block">CGL / NCG</span>
                <span className="font-mono font-bold text-slate-800">
                  {giroAtual.coberturaNcgPorCgl !== null
                    ? `${formatPercent(giroAtual.coberturaNcgPorCgl, 1)}`
                    : '—'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. GRID DOS 6 CARDS DE INDICADORES DE CAPITAL DE GIRO */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {cardsIndicadores.map((card) => {
          const isExpanded = expandedDetails[card.id]
          const isCGL = card.id === 'cgl'
          const isST = card.id === 'st'
          const isNCG = card.id === 'ncg'

          return (
            <Card
              key={card.id}
              className="bg-white border-slate-200 shadow-2xs hover:shadow-md transition-all rounded-2xl flex flex-col justify-between overflow-hidden"
            >
              <div>
                <CardHeader className="p-4 sm:p-5 pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">
                          {card.sigla}
                        </span>
                        {renderStatusBadge(card.status, card.statusTexto)}
                      </div>
                      <CardTitle className="text-base font-bold text-[#0B1F3A] mt-1">
                        {card.nome}
                      </CardTitle>
                      <CardDescription className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                        {card.descricaoCurta}
                      </CardDescription>
                    </div>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                        >
                          <HelpCircle className="w-4 h-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs text-xs">
                        <p className="font-bold">{card.nome}</p>
                        <p className="text-slate-300 mt-1">{card.formulaExplicada}</p>
                        <p className="text-slate-400 mt-1 text-[10px]">
                          Referência: {card.referencia}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </CardHeader>

                <CardContent className="p-4 sm:p-5 pt-0 space-y-3.5">
                  {/* Valor Principal em R$ ou Multiplicador */}
                  <div className="flex items-baseline justify-between pt-1">
                    <span
                      className={`text-2xl sm:text-3xl font-black font-mono tracking-tight ${
                        card.valor !== null && card.valor < 0
                          ? 'text-red-600'
                          : isST && card.valor !== null && card.valor > 0
                            ? 'text-emerald-600'
                            : 'text-[#0B1F3A]'
                      }`}
                    >
                      {card.isCurrency
                        ? formatCurrency(card.valor)
                        : card.id === 'ciclos'
                          ? card.valor !== null
                            ? `${Math.round(card.valor)} dias`
                            : '—'
                          : card.valor !== null
                            ? `${formatNumber(card.valor, 2)}x`
                            : '—'}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-500">
                      Exercício {selectedAno}
                    </span>
                  </div>

                  {/* Sparkline de Evolução (se toggle ativo) */}
                  {verEvolucao && (
                    <div className="pt-2 border-t border-slate-100">
                      <SparklineEvolucao
                        pontos={
                          card.id === 'cgb'
                            ? histCGB
                            : card.id === 'cgl'
                              ? histCGL
                              : card.id === 'ncg'
                                ? histNCG
                                : card.id === 'st'
                                  ? histST
                                  : [
                                      {
                                        ano: ano2,
                                        valor: giroAno2?.liquidezCorrente ?? null,
                                      },
                                      {
                                        ano: anoAnterior,
                                        valor: giroAnterior?.liquidezCorrente ?? null,
                                      },
                                      { ano: selectedAno, valor: giroAtual.liquidezCorrente },
                                    ]
                        }
                        benchmarkValor={
                          card.id === 'lc' ? (benchmarkSetor?.liquidezCorrente ?? 1.5) : null
                        }
                        unidade={card.isCurrency ? '' : card.id === 'ciclos' ? 'd' : 'x'}
                      />
                    </div>
                  )}

                  {/* Fórmula Visível no Card */}
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs space-y-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      Fórmula Contábil:
                    </span>
                    <code className="text-blue-700 font-mono font-semibold text-[11px] block">
                      {card.formula}
                    </code>
                  </div>

                  {/* Interpretação em Português */}
                  <div className="text-xs text-slate-600 leading-relaxed bg-blue-50/30 p-2.5 rounded-xl border border-blue-100/60">
                    <span className="font-bold text-slate-800 block text-[11px] mb-0.5">
                      Interpretação &amp; Impacto:
                    </span>
                    <p>{card.interpretacao}</p>
                  </div>
                </CardContent>
              </div>

              {/* Seção Expansível de Variáveis e Decomposição */}
              <div className="border-t border-slate-100 bg-slate-50/50 p-3">
                <button
                  type="button"
                  onClick={() => toggleDetails(card.id)}
                  className="w-full flex items-center justify-between text-xs font-semibold text-slate-600 hover:text-blue-700 transition-colors"
                >
                  <span className="flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-blue-600" />
                    {isExpanded ? 'Ocultar decomposição detalhada' : 'Ver decomposição detalhada'}
                  </span>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>

                {isExpanded && (
                  <div className="mt-3 space-y-2 pt-2 border-t border-slate-200/60 animate-fadeIn text-xs">
                    <p className="text-[11px] text-slate-500 mb-1">{card.formulaExplicada}</p>
                    <div className="space-y-1.5">
                      {card.variaveis.map((v, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-1.5 rounded-lg bg-white border border-slate-200"
                        >
                          <div className="truncate pr-2">
                            <span className="font-semibold text-slate-700">{v.label}</span>
                            {v.detalhes && (
                              <span className="text-[10px] text-slate-400 block truncate">
                                {v.detalhes}
                              </span>
                            )}
                          </div>
                          <strong className="font-mono text-slate-900 shrink-0">
                            {v.isCurrency !== false
                              ? formatCurrency(v.valor)
                              : v.detalhes || formatNumber(v.valor, 1)}
                          </strong>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          )
        })}
      </div>

      {/* 4. GRÁFICO DE EVOLUÇÃO DO CAPITAL DE GIRO (3 ANOS) */}
      <Card className="bg-white border-slate-200 shadow-2xs rounded-2xl p-5">
        <CardHeader className="p-0 pb-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                <TrendingUp className="w-4 h-4" />
              </div>
              <CardTitle className="text-base font-bold text-[#0B1F3A]">
                Evolução Temporal do Capital de Giro ({ano2} • {anoAnterior} • {selectedAno})
              </CardTitle>
            </div>
            <CardDescription className="text-xs text-slate-500 mt-0.5">
              Trajetória comparativa dos 4 pilares: CGB (Ativo Circulante), CGL, NCG e Saldo de
              Tesouraria (ST)
            </CardDescription>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {/* Seletor Linhas / Barras */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => setTipoGraficoEvolucao('linhas')}
                className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                  tipoGraficoEvolucao === 'linhas'
                    ? 'bg-white text-blue-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Linhas
              </button>
              <button
                type="button"
                onClick={() => setTipoGraficoEvolucao('barras')}
                className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                  tipoGraficoEvolucao === 'barras'
                    ? 'bg-white text-blue-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Barras
              </button>
            </div>
          </div>
        </CardHeader>

        {/* Nota informativa quando faltarem dados de algum exercício */}
        {anosComFaltaDados.length > 0 && (
          <div className="mt-3 p-3 bg-blue-50/60 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-600 shrink-0" />
            <span>
              <strong>Nota sobre o histórico:</strong> Não foram encontrados lançamentos contábeis
              completos para o(s) exercício(s){' '}
              <strong className="font-mono">{anosComFaltaDados.join(', ')}</strong>. Os indicadores
              correspondentes são exibidos como nulos até que as demonstrações sejam importadas.
            </span>
          </div>
        )}

        <CardContent className="p-0 pt-4 h-84 sm:h-96">
          <ResponsiveContainer width="100%" height="100%">
            {tipoGraficoEvolucao === 'linhas' ? (
              <LineChart
                data={dadosGraficoEvolucao3Anos}
                margin={{ top: 20, right: 25, left: 10, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="ano" tick={{ fill: '#0B1F3A', fontSize: 12, fontWeight: 700 }} />
                <YAxis
                  tick={{ fill: '#64748B', fontSize: 10 }}
                  tickFormatter={(val) => `R$ ${(val / 1000).toFixed(0)}k`}
                />
                <ReferenceLine y={0} stroke="#94A3B8" strokeWidth={1.5} strokeDasharray="2 2" />
                <RechartsTooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload || !payload.length) return null
                    return (
                      <div className="bg-slate-900 text-white p-3.5 rounded-xl shadow-xl text-xs space-y-2 border border-slate-700 min-w-[220px]">
                        <strong className="block font-bold text-sm text-blue-300 border-b border-slate-800 pb-1">
                          Exercício {label}
                        </strong>
                        <div className="space-y-1">
                          {payload.map((p, idx) => (
                            <div key={idx} className="flex items-center justify-between gap-4">
                              <span className="flex items-center gap-1.5 text-slate-300">
                                <span
                                  className="w-2.5 h-2.5 rounded-full inline-block"
                                  style={{ backgroundColor: p.color }}
                                />
                                {p.name}:
                              </span>
                              <strong className="font-mono text-white">
                                {p.value !== null && p.value !== undefined
                                  ? formatCurrency(p.value as number)
                                  : 'Sem dados'}
                              </strong>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                <Line
                  type="monotone"
                  name="CGB (Cap. Giro Bruto)"
                  dataKey="cgb"
                  stroke="#3B82F6"
                  strokeWidth={3}
                  dot={{ r: 5, fill: '#3B82F6' }}
                  activeDot={{ r: 7 }}
                  connectNulls={false}
                />
                <Line
                  type="monotone"
                  name="CGL (Cap. Giro Líquido)"
                  dataKey="cgl"
                  stroke="#10B981"
                  strokeWidth={3}
                  dot={{ r: 5, fill: '#10B981' }}
                  activeDot={{ r: 7 }}
                  connectNulls={false}
                />
                <Line
                  type="monotone"
                  name="NCG (Nec. Cap. Giro)"
                  dataKey="ncg"
                  stroke="#F59E0B"
                  strokeWidth={3}
                  dot={{ r: 5, fill: '#F59E0B' }}
                  activeDot={{ r: 7 }}
                  connectNulls={false}
                />
                <Line
                  type="monotone"
                  name="ST (Saldo de Tesouraria)"
                  dataKey="st"
                  stroke="#DC2626"
                  strokeWidth={3.5}
                  dot={{ r: 6, fill: '#DC2626' }}
                  activeDot={{ r: 8 }}
                  connectNulls={false}
                />
              </LineChart>
            ) : (
              <BarChart
                data={dadosGraficoEvolucao3Anos}
                margin={{ top: 20, right: 25, left: 10, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="ano" tick={{ fill: '#0B1F3A', fontSize: 12, fontWeight: 700 }} />
                <YAxis
                  tick={{ fill: '#64748B', fontSize: 10 }}
                  tickFormatter={(val) => `R$ ${(val / 1000).toFixed(0)}k`}
                />
                <ReferenceLine y={0} stroke="#94A3B8" strokeWidth={1.5} />
                <RechartsTooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload || !payload.length) return null
                    return (
                      <div className="bg-slate-900 text-white p-3.5 rounded-xl shadow-xl text-xs space-y-2 border border-slate-700 min-w-[220px]">
                        <strong className="block font-bold text-sm text-blue-300 border-b border-slate-800 pb-1">
                          Exercício {label}
                        </strong>
                        <div className="space-y-1">
                          {payload.map((p, idx) => (
                            <div key={idx} className="flex items-center justify-between gap-4">
                              <span className="flex items-center gap-1.5 text-slate-300">
                                <span
                                  className="w-2.5 h-2.5 rounded-full inline-block"
                                  style={{ backgroundColor: p.color }}
                                />
                                {p.name}:
                              </span>
                              <strong className="font-mono text-white">
                                {p.value !== null && p.value !== undefined
                                  ? formatCurrency(p.value as number)
                                  : 'Sem dados'}
                              </strong>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                <Bar
                  name="CGB (Cap. Giro Bruto)"
                  dataKey="cgb"
                  fill="#3B82F6"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  name="CGL (Cap. Giro Líquido)"
                  dataKey="cgl"
                  fill="#10B981"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  name="NCG (Nec. Cap. Giro)"
                  dataKey="ncg"
                  fill="#F59E0B"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  name="ST (Saldo de Tesouraria)"
                  dataKey="st"
                  fill="#DC2626"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            )}
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* 5. SEÇÃO DE GRÁFICOS INTERATIVOS DO EXERCÍCIO */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico 1: Comparativo CGB, CGL, NCG e Saldo de Tesouraria */}
        <Card className="bg-white border-slate-200 shadow-2xs rounded-2xl p-5">
          <CardHeader className="p-0 pb-4 border-b border-slate-100 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold text-[#0B1F3A] flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-600" />
                Comparativo Dinâmico de Capital de Giro ({selectedAno})
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Comparação em R$ entre CGB, CGL, NCG e Saldo de Tesouraria
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-0 pt-4 h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={dadosGraficoGiro}
                margin={{ top: 15, right: 15, left: 10, bottom: 25 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="sigla" tick={{ fill: '#0B1F3A', fontSize: 11, fontWeight: 700 }} />
                <YAxis
                  tick={{ fill: '#64748B', fontSize: 10 }}
                  tickFormatter={(val) => `R$ ${(val / 1000).toFixed(0)}k`}
                />
                <ReferenceLine y={0} stroke="#94A3B8" strokeWidth={1.5} />
                <RechartsTooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null
                    const d = payload[0].payload
                    return (
                      <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl text-xs space-y-1 border border-slate-700">
                        <strong className="block font-bold text-sm text-blue-300">{d.nome}</strong>
                        <div className="text-slate-300">{d.descricao}</div>
                        <div className="text-sm font-mono font-bold text-white pt-1 border-t border-slate-800">
                          Valor: {d.valorFormatado}
                        </div>
                      </div>
                    )
                  }}
                />
                <Bar dataKey="valor" radius={[6, 6, 0, 0]}>
                  {dadosGraficoGiro.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.cor} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Gráfico 2: Decomposição Ativo e Passivo Circulante (Operacional vs Financeiro) */}
        <Card className="bg-white border-slate-200 shadow-2xs rounded-2xl p-5">
          <CardHeader className="p-0 pb-4 border-b border-slate-100 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold text-[#0B1F3A] flex items-center gap-2">
                <PieChartIcon className="w-5 h-5 text-indigo-600" />
                Decomposição Circulante: Operacional vs Financeiro
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Segmentação entre recursos operacionais da atividade e reservas financeiras
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-0 pt-4 h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={dadosGraficoDecomposicao}
                margin={{ top: 15, right: 15, left: 10, bottom: 25 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis
                  dataKey="categoria"
                  tick={{ fill: '#0B1F3A', fontSize: 11, fontWeight: 700 }}
                />
                <YAxis
                  tick={{ fill: '#64748B', fontSize: 10 }}
                  tickFormatter={(val) => `R$ ${(val / 1000).toFixed(0)}k`}
                />
                <RechartsTooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null
                    const cat = payload[0].payload.categoria
                    return (
                      <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl text-xs space-y-1.5 border border-slate-700">
                        <strong className="block font-bold text-sm text-indigo-300">{cat}</strong>
                        {payload.map((p, i) => (
                          <div key={i} className="flex justify-between gap-4">
                            <span className="text-slate-300">{p.name}:</span>
                            <strong className="font-mono text-white">
                              {formatCurrency(p.value as number)}
                            </strong>
                          </div>
                        ))}
                      </div>
                    )
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
                <Bar
                  name="Operacional (ACO / PCO)"
                  dataKey="Operacional"
                  fill="#3B82F6"
                  stackId="a"
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  name="Financeiro (ACF / PCF)"
                  dataKey="Financeiro"
                  fill="#10B981"
                  stackId="a"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* 5. ANÁLISE CONSOLIDADA & PARECER EXECUTIVO DO CONSULTOR */}
      <Card className="bg-white border-slate-200 shadow-2xs rounded-2xl p-6 space-y-6">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#0B1F3A]">
              Parecer Executivo Consolidado — Capital de Giro &amp; Solvência
            </h3>
            <p className="text-xs text-slate-500">
              Diagnóstico fundamentado no Balanço Patrimonial e DRE para o exercício {selectedAno}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Coluna 1: Diagnóstico dos Pontos Críticos */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-blue-600" />
              1. Diagnóstico da Saúde Financeira &amp; Liquidez
            </h4>
            <div className="space-y-2.5">
              {parecerExecutivo.pontos.map((p, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-xl border text-xs leading-relaxed flex items-start gap-2.5 ${
                    p.tipo === 'positivo'
                      ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
                      : 'bg-amber-50/60 border-amber-200 text-amber-950'
                  }`}
                >
                  {p.tipo === 'positivo' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  )}
                  <span>{p.texto}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Coluna 2: Recomendações Práticas do Consultor */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              2. Recomendações Estratégicas de Otimização
            </h4>
            <div className="space-y-2 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
              {parecerExecutivo.recomendacoes.map((rec, idx) => (
                <div key={idx} className="flex items-start gap-2 text-slate-700 leading-relaxed">
                  <span className="w-5 h-5 rounded-md bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <span>{rec}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
