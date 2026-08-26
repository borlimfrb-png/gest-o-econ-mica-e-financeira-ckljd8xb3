import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFilter } from '@/contexts/FilterContext'
import { balancosService, dreService } from '@/services/financeService'
import type { BalancoRecord, DreRecord } from '@/types/finance'
import {
  calcularBalanco,
  calcularDre,
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
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Cell,
} from 'recharts'
import {
  TrendingUp,
  Building2,
  Calendar,
  Download,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  AlertCircle,
  PlusCircle,
  Layers,
  Info,
  Scale,
  BarChart3,
  Percent,
  Activity,
  DollarSign,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface IndicadorEbitdaInfo {
  id: 'ebitda' | 'margemEbitda' | 'coberturaJuros'
  nome: string
  sigla: string
  formula: string
  formulaExplicada: string
  descricaoCurta: string
  valor: number | null
  tipoValor: 'moeda' | 'percentual' | 'multiplo'
  status: 'verde' | 'ambar' | 'vermelho' | 'indefinido'
  statusTexto: string
  interpretacao: string
  referencia: string
  variaveis: {
    label: string
    sigla: string
    valor: number
    detalhes?: string
  }[]
}

export default function IndicadoresEbitda() {
  const {
    empresas,
    selectedEmpresaId,
    setSelectedEmpresaId,
    selectedAno,
    setSelectedAno,
    anosDisponiveis,
    selectedEmpresa,
  } = useFilter()
  const { toast } = useToast()
  const navigate = useNavigate()

  const [balancos, setBalancos] = useState<BalancoRecord[]>([])
  const [dres, setDres] = useState<DreRecord[]>([])
  const [loading, setLoading] = useState<boolean>(true)

  // Estado de detalhes expandidos por card
  const [expandedDetails, setExpandedDetails] = useState<Record<string, boolean>>({
    ebitda: false,
    margemEbitda: false,
    coberturaJuros: false,
  })

  const toggleDetails = (id: string) => {
    setExpandedDetails((prev) => ({
      ...prev,
      [id]: !prev[id],
    }))
  }

  // Carregar dados das coleções balancos e dre
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
      console.error('Erro ao carregar balanços e DRE para indicadores EBITDA:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar dados',
        description: 'Não foi possível buscar as demonstrações contábeis da empresa selecionada.',
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

  const balancoAtual = useMemo(
    () => balancos.find((b) => b.ano === selectedAno) || null,
    [balancos, selectedAno],
  )
  const dreAtual = useMemo(
    () => dres.find((d) => d.ano === selectedAno) || null,
    [dres, selectedAno],
  )

  const calcB = useMemo(() => calcularBalanco(balancoAtual), [balancoAtual])
  const calcD = useMemo(() => calcularDre(dreAtual), [dreAtual])

  // Variáveis contábeis extraídas
  const rb = dreAtual?.receita_bruta || 0
  const ded = dreAtual?.deducoes_receita || 0
  const rl = calcD.receitaLiquida
  const cmv = dreAtual?.custo_mercadorias || 0
  const lb = calcD.lucroBruto
  const do_ = dreAtual?.despesas_operacionais || 0
  const ro = calcD.resultadoOperacional // Lucro Operacional Líquido (Receita Líquida - Custos - Despesas Operacionais)
  const df = dreAtual?.despesas_financeiras || 0
  const ord = dreAtual?.outras_receitas_despesas || 0
  const ir = dreAtual?.imposto_renda || 0
  const ll = calcD.lucroLiquido

  // Depreciação e Amortização aproximadas a partir dos ativos imobilizados e intangíveis do Balanço (ou 0 se não especificado)
  const imobilizado = balancoAtual?.imobilizado || 0
  const intangivel = balancoAtual?.intangivel || 0
  const depreciacao = 0 // Campo não destacado explicitamente na tabela DRE
  const amortizacao = 0 // Campo não destacado explicitamente na tabela DRE

  // EBITDA = Lucro Operacional Líquido + Depreciação + Amortização + Despesas Financeiras Líquidas
  // (Ou fórmula contábil padrão: Lucro Líquido + IR + Despesas Financeiras Líquidas)
  // Conforme especificado: EBITDA = Lucro Operacional Líquido + Depreciação + Amortização + Despesas Financeiras Líquidas
  // Se Lucro Operacional Líquido = ro (RL - CMV - DO), EBITDA = ro + depreciacao + amortizacao + df
  const ebitdaValor = dreAtual ? ro + depreciacao + amortizacao + df : null

  // Margem EBITDA = (EBITDA / Receita Líquida) * 100
  const margemEbitdaValor = ebitdaValor !== null && rl > 0 ? (ebitdaValor / rl) * 100 : null

  // Cobertura de Juros = EBITDA / Despesas Financeiras
  const coberturaJurosValor = ebitdaValor !== null && df > 0 ? ebitdaValor / df : null

  // Anos disponíveis
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

  // Status & Regras de Classificação
  // 1. EBITDA: 🟢 se positivo, 🔴 se negativo
  const getEbitdaStatus = (val: number | null): 'verde' | 'vermelho' | 'indefinido' => {
    if (val === null || isNaN(val)) return 'indefinido'
    return val >= 0 ? 'verde' : 'vermelho'
  }
  const getEbitdaStatusTexto = (val: number | null): string => {
    if (val === null || isNaN(val)) return 'Sem dados'
    return val >= 0 ? 'Geração Positiva' : 'Geração Negativa'
  }

  // 2. Margem EBITDA: 🟢 ≥ 25%, 🟠 10-25%, 🔴 < 10%
  const getMargemEbitdaStatus = (
    val: number | null,
  ): 'verde' | 'ambar' | 'vermelho' | 'indefinido' => {
    if (val === null || isNaN(val)) return 'indefinido'
    if (val >= 25) return 'verde'
    if (val >= 10) return 'ambar'
    return 'vermelho'
  }
  const getMargemEbitdaStatusTexto = (val: number | null): string => {
    if (val === null || isNaN(val)) return 'Sem dados'
    if (val >= 25) return 'Alta Eficiência'
    if (val >= 10) return 'Adequada'
    return 'Margem Baixa'
  }

  // 3. EBITDA / Despesas Financeiras (Cobertura de juros): 🟢 ≥ 3x, 🟠 1,5-3x, 🔴 < 1,5x
  const getCoberturaStatus = (
    val: number | null,
  ): 'verde' | 'ambar' | 'vermelho' | 'indefinido' => {
    if (val === null || isNaN(val)) return 'indefinido'
    if (val >= 3.0) return 'verde'
    if (val >= 1.5) return 'ambar'
    return 'vermelho'
  }
  const getCoberturaStatusTexto = (val: number | null): string => {
    if (val === null || isNaN(val)) return df === 0 ? 'Sem Despesas Fin.' : 'Sem dados'
    if (val >= 3.0) return 'Saudável'
    if (val >= 1.5) return 'Atenção'
    return 'Crítico'
  }

  // Interpretações textuais detalhadas em português (2 a 3 frases contextualizadas)
  const getInterpretacaoEbitda = (val: number | null): string => {
    if (val === null) {
      return 'Dados da Demonstração do Resultado (DRE) não disponíveis para apuração do EBITDA no exercício.'
    }
    if (val > 0) {
      return `O EBITDA apurado em ${formatCurrency(val)} comprova que a atividade operacional básica da empresa gera caixa genuíno antes dos efeitos tributários e de estrutura de capital. A organização detém capacidade financeira para suportar reinvestimentos em sua infraestrutura e honrar encargos com credores. Esse resultado demonstra eficiência operacional e viabilidade do modelo comercial.`
    }
    if (val === 0) {
      return `O EBITDA nulo indica que as receitas líquidas foram consumidas integralmente pelos custos de mercadorias e despesas operacionais da atividade. Não há excedente operacional de caixa gerado pela operação principal antes de impostos e despesas financeiras. Torna-se indispensável revisar despesas operacionais para recuperar a geração de caixa.`
    }
    return `O EBITDA negativo de ${formatCurrency(val)} revela que as operações fundamentais do negócio consomem caixa em vez de gerá-lo, antes mesmo de pagar juros e tributos. Cada real faturado não cobre a soma dos custos mercantis e das despesas operacionais da empresa. É imperativo implementar cortes imediatos de custos e reestruturar os processos de vendas para reverter o consumo de caixa.`
  }

  const getInterpretacaoMargemEbitda = (val: number | null): string => {
    if (val === null) {
      return 'Dados de Receita Líquida insuficientes para calcular a Margem EBITDA.'
    }
    if (val >= 25) {
      return `A Margem EBITDA de ${formatPercent(val, 1)} evidencia alta rentabilidade e expressivo poder de conversão de faturamento em potencial de geração de caixa. A empresa retém R$ ${formatNumber(val, 2)} de caixa operacional a cada R$ 100,00 faturados líquidos, situando-se no quartil superior de eficiência mercadológica. Essa folga robusta confere ampla flexibilidade para atravessar oscilações setoriais.`
    }
    if (val >= 10) {
      return `Com ${formatPercent(val, 1)} de Margem EBITDA, a empresa opera com rentabilidade operacional moderada, compatível com os padrões de mercado nos setores comerciais e industriais concorridos. Há uma conversão positiva de receita em caixa, mas oscilações nos custos podem pressionar o resultado operacional. Sugere-se otimizar os processos internos para buscar ampliação gradual dessa margem.`
    }
    if (val >= 0) {
      return `A Margem EBITDA de ${formatPercent(val, 1)} indica reduzida capacidade de retenção operacional de caixa a partir do faturamento líquido obtido. A maior parte da receita gerada é consumida na compra de produtos e nas rotinas operacionais cotidianas, deixando pouca margem para honrar despesas financeiras e investimentos. Recomenda-se auditar custos variáveis e precificação.`
    }
    return `Com Margem EBITDA negativa de ${formatPercent(val, 1)}, a operação principal registrou déficit direto em relação ao faturamento líquido do período. A empresa opera com margem de contribuição insuficiente para sustentar a estrutura corporativa instalada. Medidas severas de contenção de custos e revisão das linhas de produtos são urgentes.`
  }

  const getInterpretacaoCobertura = (val: number | null): string => {
    if (val === null) {
      if (df === 0 && ebitdaValor !== null && ebitdaValor > 0) {
        return 'A empresa não registrou despesas financeiras líquidas no período, indicando total autonomia perante juros bancários e ausência de pressão de serviço da dívida.'
      }
      return 'Dados de despesas financeiras insuficientes para a mensuração da cobertura de juros.'
    }
    if (val >= 3.0) {
      return `O EBITDA gerado cobre as despesas financeiras em ${formatNumber(val, 2)} vezes (índice ≥ 3,0x), indicando folga muito confortável para o pagamento do serviço da dívida. A empresa corre baixo risco de inadimplência perante instituições financeiras e possui excelente perfil de crédito para captação. O caixa operacional absorve os juros com ampla tranquilidade.`
    }
    if (val >= 1.5) {
      return `A cobertura de juros de ${formatNumber(val, 2)}x situa-se em patamar de atenção moderada (1,5x a 3,0x), com o EBITDA absorvendo as despesas financeiras mas sem grande folga para imprevistos. Qualquer retração nas vendas ou aumento nas taxas de juros pode comprometer a pontualidade do pagamento dos encargos da dívida. Recomenda-se negociar melhores taxas ou conter novas contratações onerosas.`
    }
    return `Com cobertura de apenas ${formatNumber(val, 2)}x (abaixo do piso de segurança de 1,5x), o EBITDA é insuficiente ou perigosamente justo para suportar as despesas financeiras da empresa. O custo da dívida compromete a sustentabilidade do fluxo de caixa e expõe o negócio a elevado risco de insolvência. É prioritário amortizar dívidas caras ou realizar um alongamento emergencial dos prazos contratuais.`
  }

  // Lista dos 3 Cards de Indicadores
  const indicadores: IndicadorEbitdaInfo[] = [
    {
      id: 'ebitda',
      nome: 'EBITDA (LAJIDA)',
      sigla: 'EBITDA',
      formula: 'L. Oper. + Deprec. + Amort. + Desp. Fin.',
      formulaExplicada:
        'Lucro Operacional Líquido + Depreciação + Amortização + Despesas Financeiras Líquidas',
      descricaoCurta:
        'Potencial de geração de caixa operacional antes de juros, impostos, depreciação e amortização',
      valor: ebitdaValor,
      tipoValor: 'moeda',
      status: getEbitdaStatus(ebitdaValor),
      statusTexto: getEbitdaStatusTexto(ebitdaValor),
      interpretacao: getInterpretacaoEbitda(ebitdaValor),
      referencia: '> R$ 0,00 (Positivo: operação gera caixa)',
      variaveis: [
        {
          label: 'Receita Líquida (RL)',
          sigla: 'RL',
          valor: rl,
          detalhes: 'Faturamento bruto menos deduções e impostos sobre vendas',
        },
        {
          label: 'Custos das Mercadorias/Serviços (CMV)',
          sigla: 'CMV',
          valor: cmv,
          detalhes: 'Custo direto das mercadorias vendidas ou serviços prestados',
        },
        {
          label: 'Despesas Operacionais (DO)',
          sigla: 'DO',
          valor: do_,
          detalhes: 'Despesas com vendas, gerais e administrativas',
        },
        {
          label: 'Lucro Operacional Líquido (EBIT)',
          sigla: 'RO',
          valor: ro,
          detalhes: 'Receita Líquida − Custos − Despesas Operacionais',
        },
        {
          label: 'Despesas Financeiras Líquidas (DF)',
          sigla: 'DF',
          valor: df,
          detalhes: 'Juros, tarifas e encargos financeiros sobre dívidas',
        },
        {
          label: 'Depreciação e Amortização (D&A)',
          sigla: 'D&A',
          valor: depreciacao + amortizacao,
          detalhes: 'Despesas não-caixa de depreciação de bens e amortização de intangíveis',
        },
      ],
    },
    {
      id: 'margemEbitda',
      nome: 'Margem EBITDA',
      sigla: 'Margem EBITDA',
      formula: '(EBITDA / Receita Líquida) × 100',
      formulaExplicada: 'EBITDA ÷ Receita Líquida de Vendas × 100',
      descricaoCurta:
        'Eficiência operacional na conversão de faturamento líquido em geração bruta de caixa',
      valor: margemEbitdaValor,
      tipoValor: 'percentual',
      status: getMargemEbitdaStatus(margemEbitdaValor),
      statusTexto: getMargemEbitdaStatusTexto(margemEbitdaValor),
      interpretacao: getInterpretacaoMargemEbitda(margemEbitdaValor),
      referencia: '≥ 25% (Saudável) · 10% a 25% (Atenção) · < 10% (Crítico)',
      variaveis: [
        {
          label: 'EBITDA Apurado',
          sigla: 'EBITDA',
          valor: ebitdaValor || 0,
          detalhes: 'Geração de caixa operacional bruto no exercício',
        },
        {
          label: 'Receita Líquida (RL)',
          sigla: 'RL',
          valor: rl,
          detalhes: 'Total das vendas líquidas apuradas na DRE',
        },
      ],
    },
    {
      id: 'coberturaJuros',
      nome: 'Cobertura de Juros (EBITDA / DF)',
      sigla: 'Cobertura de Juros',
      formula: 'EBITDA / Despesas Financeiras',
      formulaExplicada: 'EBITDA ÷ Despesas Financeiras Líquidas',
      descricaoCurta:
        'Capacidade do caixa operacional da empresa em honrar o serviço da dívida e encargos bancários',
      valor: coberturaJurosValor,
      tipoValor: 'multiplo',
      status: getCoberturaStatus(coberturaJurosValor),
      statusTexto: getCoberturaStatusTexto(coberturaJurosValor),
      interpretacao: getInterpretacaoCobertura(coberturaJurosValor),
      referencia: '≥ 3,0x (Saudável) · 1,5x a 3,0x (Atenção) · < 1,5x (Crítico)',
      variaveis: [
        {
          label: 'EBITDA Apurado',
          sigla: 'EBITDA',
          valor: ebitdaValor || 0,
          detalhes: 'Resultado operacional antes de juros, impostos e depreciações',
        },
        {
          label: 'Despesas Financeiras (DF)',
          sigla: 'DF',
          valor: df,
          detalhes: 'Total de juros e encargos pagos a instituições financeiras',
        },
        {
          label: 'Lucro Líquido Final (LL)',
          sigla: 'LL',
          valor: ll,
          detalhes: 'Resultado líquido residual após deduções financeiras e IR',
        },
      ],
    },
  ]

  // Dados para o Gráfico de Barras Horizontal Recharts: EBITDA vs Lucro Líquido vs Receita Líquida
  const dadosGrafico = useMemo(() => {
    return [
      {
        nome: 'Receita Líquida',
        sigla: 'Receita Líquida',
        valor: Math.max(0, rl),
        valorReal: rl,
        fill: '#3B82F6', // Blue
        descricao: 'Faturamento líquido gerado pelas vendas',
      },
      {
        nome: 'EBITDA',
        sigla: 'EBITDA',
        valor: ebitdaValor !== null ? Math.max(0, ebitdaValor) : 0,
        valorReal: ebitdaValor !== null ? ebitdaValor : 0,
        fill: ebitdaValor && ebitdaValor >= 0 ? '#10B981' : '#EF4444', // Green / Red
        descricao: 'Geração de caixa operacional da atividade',
      },
      {
        nome: 'Lucro Líquido',
        sigla: 'Lucro Líquido',
        valor: Math.max(0, ll),
        valorReal: ll,
        fill: ll >= 0 ? '#059669' : '#DC2626', // Emerald / Red dark
        descricao: 'Resultado final líquido após juros e tributos',
      },
    ]
  }, [rl, ebitdaValor, ll])

  // Análise Consolidada do Consultor Financeiro
  const parecerConsolidado = useMemo(() => {
    if (!dreAtual && !balancoAtual) return null

    const ebitdaOk = ebitdaValor !== null && ebitdaValor > 0
    const margemStatus = getMargemEbitdaStatus(margemEbitdaValor)
    const cobStatus = getCoberturaStatus(coberturaJurosValor)

    let titulo = ''
    let nivel: 'excelente' | 'adequado' | 'alerta' | 'critico' = 'adequado'
    let detalhesPosicao = ''
    let recomendacao = ''

    if (ebitdaValor !== null && ebitdaValor <= 0) {
      nivel = 'critico'
      titulo = 'Geração de Caixa Operacional Negativa e Alerta Estrutural'
      detalhesPosicao = `No exercício de ${selectedAno}, a empresa ${selectedEmpresa?.nome || ''} registrou EBITDA negativo de ${formatCurrency(ebitdaValor)} com Margem EBITDA de ${formatPercent(margemEbitdaValor, 1)}. A operação básica da empresa não é autossuficiente para cobrir custos e despesas rotineiras, demandando suporte constante de capital externo ou queima de reservas.`
      recomendacao =
        'Recomenda-se com urgência: 1) Realizar auditoria minuciosa da estrutura de custos fixos e variáveis, eliminando despesas não essenciais; 2) Revisar a política de precificação para garantir margem de contribuição saudável; 3) Renegociar contratos com fornecedores estratégicos para reduzir o CMV; 4) Buscar linhas de capital de giro de emergência para preservar a solvência imediata.'
    } else if (cobStatus === 'vermelho' || margemStatus === 'vermelho') {
      nivel = 'alerta'
      titulo = 'EBITDA Positivo com Pressão de Margens e Carga Financeira'
      detalhesPosicao = `No exercício ${selectedAno}, a empresa gerou EBITDA positivo de ${formatCurrency(ebitdaValor)} (Margem EBITDA: ${formatPercent(margemEbitdaValor, 1)}), porém a cobertura de despesas financeiras (${formatNumber(coberturaJurosValor, 2)}x) sinaliza forte comprometimento do caixa operacional com encargos bancários. Uma parcela substancial da geração operacional é absorvida pelo serviço da dívida.`
      recomendacao =
        'Recomenda-se: 1) Desenvolver um plano de amortização e repactuação de dívidas onerosas para reduzir o valor das despesas financeiras anuais; 2) Aumentar a eficiência operacional para elevar a Margem EBITDA acima de 20%; 3) Reter os lucros operacionais para diminuir a necessidade de novos empréstimos.'
    } else if (margemStatus === 'verde' && (cobStatus === 'verde' || df === 0)) {
      nivel = 'excelente'
      titulo = 'Excelente Eficiência Operacional e Ampla Geração de Caixa'
      detalhesPosicao = `A empresa ${selectedEmpresa?.nome || ''} encerrou ${selectedAno} com indicadores de EBITDA em patamar de excelência. Com EBITDA de ${formatCurrency(ebitdaValor)}, Margem EBITDA de ${formatPercent(margemEbitdaValor, 1)} e Cobertura de Juros de ${formatNumber(coberturaJurosValor, 2)}x, a organização demonstra vigor operacional excepcional, alto poder de geração de caixa e total tranquilidade no cumprimento de suas obrigações financeiras.`
      recomendacao =
        'Recomenda-se: 1) Reinvestir parte do excedente de caixa operacional em inovação e expansão de mercado para consolidar a liderança competitiva; 2) Preservar a disciplina de custos para sustentar a margem no longo prazo; 3) Avaliar uma política estruturada de remuneração aos sócios sem comprometer o fluxo de capital de giro.'
    } else {
      nivel = 'adequado'
      titulo = 'Geração de EBITDA Equilibrada e Alinhada com os Padrões Setoriais'
      detalhesPosicao = `No exercício de ${selectedAno}, a empresa apresentou geração de caixa operacional adequada (EBITDA: ${formatCurrency(ebitdaValor)}, Margem EBITDA: ${formatPercent(margemEbitdaValor, 1)}, Cobertura de Juros: ${formatNumber(coberturaJurosValor, 2)}x). A operação sustenta-se de forma equilibrada, gerando caixa suficiente para suportar despesas operacionais e honrar seus passivos.`
      recomendacao =
        'Recomenda-se: 1) Monitorar mensalmente a evolução das despesas operacionais em relação à receita líquida; 2) Buscar ganhos incrementais de produtividade para aproximar a Margem EBITDA de 25%; 3) Manter a cobertura de despesas financeiras confortavelmente acima de 3,0x.'
    }

    return {
      titulo,
      nivel,
      detalhesPosicao,
      recomendacao,
    }
  }, [
    dreAtual,
    balancoAtual,
    ebitdaValor,
    margemEbitdaValor,
    coberturaJurosValor,
    df,
    selectedEmpresa,
    selectedAno,
  ])

  // Exportação CSV com todos os dados calculados
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

    csvContent += `RELATÓRIO DE INDICADORES EBITDA E GERAÇÃO DE CAIXA\n`
    csvContent += `EMPRESA;${selectedEmpresa.nome}\n`
    csvContent += `CNPJ;${formatCnpj(selectedEmpresa.cnpj)}\n`
    csvContent += `SEGMENTO;${selectedEmpresa.segmento}\n`
    csvContent += `EXERCÍCIO;${selectedAno}\n`
    csvContent += `DATA DE EMISSÃO;${dataEmissao}\n\n`

    csvContent += `VALORES BASE EXTRAÍDOS DO DRE E BALANÇO (R$)\n`
    csvContent += `Receita Bruta (RB);${rb.toFixed(2).replace('.', ',')}\n`
    csvContent += `Deduções da Receita;${ded.toFixed(2).replace('.', ',')}\n`
    csvContent += `Receita Líquida (RL);${rl.toFixed(2).replace('.', ',')}\n`
    csvContent += `Custos de Mercadorias/Serviços (CMV);${cmv.toFixed(2).replace('.', ',')}\n`
    csvContent += `Lucro Bruto (LB);${lb.toFixed(2).replace('.', ',')}\n`
    csvContent += `Despesas Operacionais (DO);${do_.toFixed(2).replace('.', ',')}\n`
    csvContent += `Lucro Operacional Líquido (EBIT);${ro.toFixed(2).replace('.', ',')}\n`
    csvContent += `Despesas Financeiras Líquidas (DF);${df.toFixed(2).replace('.', ',')}\n`
    csvContent += `Outras Receitas/Despesas Operacionais;${ord.toFixed(2).replace('.', ',')}\n`
    csvContent += `Imposto de Renda e CSLL;${ir.toFixed(2).replace('.', ',')}\n`
    csvContent += `Lucro Líquido Final (LL);${ll.toFixed(2).replace('.', ',')}\n`
    csvContent += `Ativo Imobilizado;${imobilizado.toFixed(2).replace('.', ',')}\n`
    csvContent += `Ativo Intangível;${intangivel.toFixed(2).replace('.', ',')}\n\n`

    csvContent += `INDICADORES CALCULADOS\n`
    csvContent += `Indicador;Sigla;Fórmula;Valor Calculado;Classificação;Interpretação Resumida\n`

    for (const ind of indicadores) {
      let valStr = 'N/D'
      if (ind.valor !== null) {
        if (ind.tipoValor === 'moeda') {
          valStr = formatCurrency(ind.valor)
        } else if (ind.tipoValor === 'percentual') {
          valStr = ind.valor.toFixed(1).replace('.', ',') + '%'
        } else {
          valStr = ind.valor.toFixed(2).replace('.', ',') + 'x'
        }
      }

      const classStr =
        ind.status === 'verde'
          ? `Verde (${ind.statusTexto})`
          : ind.status === 'ambar'
            ? `Âmbar (${ind.statusTexto})`
            : ind.status === 'vermelho'
              ? `Vermelho (${ind.statusTexto})`
              : 'Indefinido'

      const interpClean = ind.interpretacao.replace(/\n/g, ' ').replace(/;/g, ',')
      csvContent += `${ind.nome};${ind.sigla};${ind.formula};${valStr};${classStr};${interpClean}\n`
    }

    if (parecerConsolidado) {
      csvContent += `\nPARECER DO CONSULTOR FINANCEIRO - DIAGNÓSTICO DE EBITDA\n`
      csvContent += `Diagnóstico;${parecerConsolidado.titulo.replace(/;/g, ',')}\n`
      csvContent += `Análise de Geração de Caixa;${parecerConsolidado.detalhesPosicao.replace(/\n/g, ' ').replace(/;/g, ',')}\n`
      csvContent += `Recomendações Estratégicas;${parecerConsolidado.recomendacao.replace(/\n/g, ' ').replace(/;/g, ',')}\n`
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `indicadores-ebitda-${selectedEmpresa.nome.replace(/\s+/g, '-').toLowerCase()}-${selectedAno}.csv`
    link.click()
    URL.revokeObjectURL(link.href)

    toast({
      title: 'CSV exportado com sucesso!',
      description: `Arquivo de indicadores de EBITDA (${selectedAno}) gerado com sucesso.`,
    })
  }

  // Renderização de Badge customizada por indicador
  const renderBadge = (ind: IndicadorEbitdaInfo) => {
    let badgeText = ind.statusTexto

    if (ind.id === 'ebitda') {
      badgeText = ind.status === 'verde' ? '🟢 Positivo' : '🔴 Negativo'
    } else if (ind.id === 'margemEbitda') {
      if (ind.status === 'verde') badgeText = '🟢 ≥ 25% (Saudável)'
      else if (ind.status === 'ambar') badgeText = '🟠 10%–25% (Atenção)'
      else if (ind.status === 'vermelho') badgeText = '🔴 < 10% (Crítico)'
    } else if (ind.id === 'coberturaJuros') {
      if (df === 0 && ebitdaValor && ebitdaValor > 0) {
        badgeText = '🟢 Sem Despesas Fin.'
      } else if (ind.status === 'verde') badgeText = '🟢 ≥ 3,0x (Saudável)'
      else if (ind.status === 'ambar') badgeText = '🟠 1,5x–3,0x (Atenção)'
      else if (ind.status === 'vermelho') badgeText = '🔴 < 1,5x (Crítico)'
    }

    switch (ind.status) {
      case 'verde':
        return (
          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-300 font-bold text-xs flex items-center gap-1.5 px-2.5 py-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            {badgeText}
          </Badge>
        )
      case 'ambar':
        return (
          <Badge className="bg-amber-50 text-amber-700 border-amber-300 font-bold text-xs flex items-center gap-1.5 px-2.5 py-1">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            {badgeText}
          </Badge>
        )
      case 'vermelho':
        return (
          <Badge className="bg-red-50 text-red-700 border-red-300 font-bold text-xs flex items-center gap-1.5 px-2.5 py-1">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            {badgeText}
          </Badge>
        )
      default:
        return (
          <Badge className="bg-slate-100 text-slate-600 border-slate-300 font-medium text-xs">
            ⚪ Sem dados
          </Badge>
        )
    }
  }

  if (loading && !balancoAtual && !dreAtual && balancos.length === 0) {
    return (
      <div className="py-20 flex flex-col justify-center items-center gap-3">
        <div className="w-9 h-9 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs text-slate-500 font-medium">
          Carregando indicadores de EBITDA...
        </span>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fadeIn pb-10">
      {/* 1. Header com Título, Seletores e Exportação CSV */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-lg shadow-md shadow-blue-600/20 shrink-0">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-extrabold text-[#0B1F3A] tracking-tight">
                Indicadores EBITDA (LAJIDA)
              </h1>
              <Badge className="bg-blue-50 text-blue-700 border-blue-200 font-semibold text-xs">
                Geração Operacional de Caixa
              </Badge>
            </div>
            <p className="text-xs text-[#5B6B7F] mt-0.5">
              Avaliação do potencial de geração de caixa operacional, margem e capacidade de
              cobertura de juros
            </p>
          </div>
        </div>

        {/* Seletores de Empresa e Ano + Botão CSV */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-1.5 bg-[#F5F7FA] border border-slate-200 rounded-lg px-2.5 py-1 text-xs">
            <Building2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <Select value={selectedEmpresaId} onValueChange={(id) => setSelectedEmpresaId(id)}>
              <SelectTrigger className="h-7 border-none shadow-none bg-transparent text-xs font-semibold text-slate-800 p-0 focus:ring-0 w-[160px] sm:w-[200px]">
                <SelectValue placeholder="Selecione a empresa" />
              </SelectTrigger>
              <SelectContent>
                {empresas.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id} className="text-xs">
                    {emp.nome} ({emp.segmento})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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
                {anosEmpresa.map((ano) => (
                  <SelectItem key={ano} value={String(ano)} className="text-xs">
                    {ano}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={handleExportCsv}
            disabled={!dreAtual}
            variant="outline"
            className="border-slate-300 text-slate-700 hover:bg-slate-100 font-semibold text-xs h-9 shadow-2xs"
          >
            <Download className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {/* Sem balanço ou DRE cadastrados */}
      {!dreAtual && !balancoAtual ? (
        <Card className="bg-white border-amber-200 shadow-2xs overflow-hidden">
          <CardContent className="p-8 text-center flex flex-col items-center justify-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200">
              <AlertCircle className="w-7 h-7" />
            </div>
            <div className="max-w-md space-y-1.5">
              <h3 className="text-base font-bold text-slate-800">
                Nenhuma Demonstração Cadastrada em {selectedAno}
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                A empresa{' '}
                <span className="font-semibold text-slate-900">
                  {selectedEmpresa?.nome || 'selecionada'}
                </span>{' '}
                ainda não possui lançamentos de DRE ou Balanço Patrimonial cadastrados para o
                exercício de {selectedAno}.
              </p>
            </div>
            <div className="flex items-center gap-3 flex-wrap justify-center pt-2">
              {selectedEmpresaId && (
                <Button
                  onClick={() => navigate(`/empresas/${selectedEmpresaId}`)}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-9 shadow-xs"
                >
                  <PlusCircle className="w-4 h-4 mr-1.5" />
                  Cadastrar Dados em {selectedEmpresa?.nome}
                </Button>
              )}
              {anosEmpresa.length > 1 && (
                <Button
                  variant="outline"
                  onClick={() => {
                    const outroAno = anosEmpresa.find((a) => a !== selectedAno)
                    if (outroAno) setSelectedAno(outroAno)
                  }}
                  className="text-xs h-9"
                >
                  Visualizar outro ano disponível
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* 2. Resumo de Variáveis Extraídas da DRE e Balanço */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Scale className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-bold text-[#0B1F3A] uppercase tracking-wider">
                  Bases Extraídas da DRE e Balanço ({selectedAno})
                </span>
              </div>
              <span className="text-[11px] text-slate-500">
                Empresa: <strong className="text-slate-800">{selectedEmpresa?.nome}</strong> · CNPJ:{' '}
                <strong className="text-slate-800 font-mono">
                  {formatCnpj(selectedEmpresa?.cnpj || '')}
                </strong>
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-3">
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                <span className="text-[10px] font-semibold text-slate-500 uppercase block truncate">
                  Receita Líquida (RL)
                </span>
                <span className="text-sm font-bold text-slate-900 block mt-0.5">
                  {formatCurrency(rl)}
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                <span className="text-[10px] font-semibold text-slate-500 uppercase block truncate">
                  Lucro Bruto (LB)
                </span>
                <span className="text-sm font-bold text-slate-900 block mt-0.5">
                  {formatCurrency(lb)}
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                <span className="text-[10px] font-semibold text-slate-500 uppercase block truncate">
                  Lucro Operacional (EBIT)
                </span>
                <span className="text-sm font-bold text-slate-900 block mt-0.5">
                  {formatCurrency(ro)}
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                <span className="text-[10px] font-semibold text-slate-500 uppercase block truncate">
                  Despesas Financeiras (DF)
                </span>
                <span className="text-sm font-bold text-red-600 block mt-0.5">
                  {formatCurrency(df)}
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                <span className="text-[10px] font-semibold text-slate-500 uppercase block truncate">
                  Lucro Líquido (LL)
                </span>
                <span
                  className={`text-sm font-bold block mt-0.5 ${
                    ll >= 0 ? 'text-emerald-700' : 'text-red-600'
                  }`}
                >
                  {formatCurrency(ll)}
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-blue-50/60 border border-blue-200">
                <span className="text-[10px] font-bold text-blue-700 uppercase block truncate">
                  EBITDA Apurado
                </span>
                <span
                  className={`text-sm font-extrabold block mt-0.5 ${
                    ebitdaValor !== null && ebitdaValor >= 0 ? 'text-emerald-700' : 'text-red-600'
                  }`}
                >
                  {formatCurrency(ebitdaValor)}
                </span>
              </div>
            </div>
          </div>

          {/* 3. Cards Visuais dos 3 Indicadores de EBITDA */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {indicadores.map((ind) => {
              const isExpanded = expandedDetails[ind.id]

              return (
                <Card
                  key={ind.id}
                  className={`bg-white border-slate-200 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden ${
                    ind.id === 'ebitda' ? 'ring-2 ring-blue-500/20' : ''
                  }`}
                >
                  <div>
                    {/* Header do Card */}
                    <CardHeader className="p-5 pb-3 border-b border-slate-100 flex flex-row items-start justify-between gap-3 space-y-0">
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                              ind.id === 'ebitda'
                                ? 'text-blue-800 bg-blue-100/70 border-blue-200'
                                : 'text-blue-700 bg-blue-50 border-blue-100'
                            }`}
                          >
                            {ind.sigla}
                          </span>
                          <CardTitle className="text-base font-bold text-[#0B1F3A]">
                            {ind.nome}
                          </CardTitle>
                        </div>
                        <CardDescription className="text-xs text-slate-500 mt-1">
                          {ind.descricaoCurta}
                        </CardDescription>
                      </div>

                      {renderBadge(ind)}
                    </CardHeader>

                    {/* Conteúdo Principal do Card */}
                    <CardContent className="p-5 pt-4 space-y-4">
                      {/* Valor Calculado e Fórmula */}
                      <div className="flex items-end justify-between gap-4 p-3.5 bg-gradient-to-r from-slate-50 to-blue-50/30 rounded-xl border border-slate-100">
                        <div>
                          <span className="text-[11px] font-semibold uppercase text-slate-500 block">
                            Fórmula de Cálculo
                          </span>
                          <code className="text-[11px] font-mono font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200 mt-0.5 inline-block">
                            {ind.formula}
                          </code>
                          <span className="text-[10px] text-slate-500 block mt-1">
                            Ref: {ind.referencia}
                          </span>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-[10px] font-semibold uppercase text-slate-400 block">
                            Valor Apurado
                          </span>
                          <div
                            className={`text-xl sm:text-2xl font-extrabold tracking-tight ${
                              ind.status === 'verde'
                                ? 'text-emerald-600'
                                : ind.status === 'ambar'
                                  ? 'text-amber-600'
                                  : ind.status === 'vermelho'
                                    ? 'text-red-600'
                                    : 'text-slate-600'
                            }`}
                          >
                            {ind.tipoValor === 'moeda'
                              ? formatCurrency(ind.valor)
                              : ind.tipoValor === 'percentual'
                                ? formatPercent(ind.valor, 1)
                                : ind.valor !== null
                                  ? `${formatNumber(ind.valor, 2)}x`
                                  : df === 0
                                    ? 'N/A (0 juros)'
                                    : '—'}
                          </div>
                        </div>
                      </div>

                      {/* Interpretação Textual Explicativa */}
                      <div className="space-y-1.5">
                        <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                          <Info className="w-3.5 h-3.5 text-blue-600" />
                          Interpretação para a Saúde Financeira
                        </span>
                        <p className="text-xs leading-relaxed text-slate-700 bg-slate-50/70 p-3 rounded-lg border border-slate-200/70">
                          {ind.interpretacao}
                        </p>
                      </div>

                      {/* Botão e Painel de Detalhes Expandidos */}
                      <div className="pt-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleDetails(ind.id)}
                          className="w-full flex items-center justify-between text-xs font-semibold text-blue-700 hover:text-blue-800 hover:bg-blue-50/80 h-8 px-2.5 rounded-lg transition-colors border border-dashed border-blue-200"
                        >
                          <span className="flex items-center gap-1.5">
                            <Layers className="w-3.5 h-3.5" />
                            {isExpanded
                              ? 'Ocultar Detalhes Extraídos da DRE'
                              : 'Ver Detalhes do Cálculo'}
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </Button>

                        {isExpanded && (
                          <div className="mt-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5 animate-fadeIn">
                            <div className="text-[11px] font-semibold text-slate-600">
                              Fórmula por extenso:{' '}
                              <strong className="text-slate-900">{ind.formulaExplicada}</strong>
                            </div>

                            <div className="space-y-1.5 pt-1">
                              {ind.variaveis.map((v, i) => (
                                <div
                                  key={i}
                                  className="flex items-center justify-between text-xs py-1 px-2 bg-white rounded-md border border-slate-100"
                                >
                                  <div className="truncate mr-2">
                                    <span className="font-semibold text-slate-800">{v.label}</span>
                                    {v.detalhes && (
                                      <span className="text-[10px] text-slate-500 block truncate">
                                        {v.detalhes}
                                      </span>
                                    )}
                                  </div>
                                  <span className="font-mono font-bold text-slate-900 shrink-0">
                                    {formatCurrency(v.valor)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </div>
                </Card>
              )
            })}
          </div>

          {/* 4. Gráfico de Barras Horizontal: Comparativo EBITDA vs Lucro Líquido vs Receita Líquida */}
          <Card className="bg-white border-slate-200 shadow-2xs">
            <CardHeader className="pb-2 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">
                    <BarChart3 className="w-4 h-4" />
                  </div>
                  <CardTitle className="text-base font-bold text-[#0B1F3A]">
                    Comparativo Visual: EBITDA vs Lucro Líquido vs Receita Líquida ({selectedAno})
                  </CardTitle>
                </div>
                <CardDescription className="text-xs mt-0.5">
                  Proporção de conversão da Receita Líquida em EBITDA e resultado final no exercício
                </CardDescription>
              </div>

              {/* Legenda de cores */}
              <div className="flex items-center gap-3 text-[11px] font-semibold flex-wrap">
                <span className="flex items-center gap-1 text-blue-700">
                  <span className="w-2.5 h-2.5 rounded-sm bg-blue-500" />
                  Receita Líquida
                </span>
                <span className="flex items-center gap-1 text-emerald-700">
                  <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                  EBITDA (LAJIDA)
                </span>
                <span className="flex items-center gap-1 text-slate-700">
                  <span className="w-2.5 h-2.5 rounded-sm bg-emerald-700" />
                  Lucro Líquido Final
                </span>
              </div>
            </CardHeader>

            <CardContent className="pt-6">
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={dadosGrafico}
                    margin={{ top: 10, right: 40, left: 60, bottom: 10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
                    <XAxis
                      type="number"
                      domain={[0, (dataMax: number) => Math.max(1000, Math.ceil(dataMax * 1.15))]}
                      tick={{ fontSize: 11, fill: '#64748B' }}
                      tickFormatter={(v) =>
                        v >= 1000000
                          ? `R$ ${(v / 1000000).toFixed(1)}M`
                          : v >= 1000
                            ? `R$ ${(v / 1000).toFixed(0)}k`
                            : `R$ ${v}`
                      }
                    />
                    <YAxis
                      dataKey="sigla"
                      type="category"
                      tick={{ fontSize: 12, fill: '#0B1F3A', fontWeight: 700 }}
                      width={100}
                    />
                    <RechartsTooltip
                      formatter={(val: any, name: any, item: any) => [
                        `${formatCurrency(item.payload.valorReal)} (${item.payload.descricao})`,
                        'Montante Real',
                      ]}
                      labelFormatter={(label: any) => `Conta: ${label}`}
                    />
                    <Bar dataKey="valor" radius={[0, 6, 6, 0]} barSize={28}>
                      {dadosGrafico.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Tabela Resumo */}
              <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-3 text-center text-xs">
                <div className="p-3 rounded-lg bg-blue-50/50 border border-blue-100">
                  <span className="font-bold text-slate-800 block">Receita Líquida (RL)</span>
                  <span className="text-[10px] text-slate-500 block truncate">
                    Total faturado líquido na DRE
                  </span>
                  <span className="text-sm font-extrabold text-blue-700 block mt-1">
                    {formatCurrency(rl)}
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-emerald-50/50 border border-emerald-100">
                  <span className="font-bold text-slate-800 block">EBITDA Gerado</span>
                  <span className="text-[10px] text-slate-500 block truncate">
                    Margem EBITDA:{' '}
                    <strong>
                      {margemEbitdaValor !== null ? formatPercent(margemEbitdaValor, 1) : '—'}
                    </strong>
                  </span>
                  <span
                    className={`text-sm font-extrabold block mt-1 ${
                      ebitdaValor !== null && ebitdaValor >= 0 ? 'text-emerald-700' : 'text-red-600'
                    }`}
                  >
                    {formatCurrency(ebitdaValor)}
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="font-bold text-slate-800 block">Lucro Líquido Final</span>
                  <span className="text-[10px] text-slate-500 block truncate">
                    Margem Líquida:{' '}
                    <strong>{rl > 0 ? formatPercent((ll / rl) * 100, 1) : '—'}</strong>
                  </span>
                  <span
                    className={`text-sm font-extrabold block mt-1 ${
                      ll >= 0 ? 'text-slate-900' : 'text-red-600'
                    }`}
                  >
                    {formatCurrency(ll)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 5. Análise Consolidada do Consultor: Diagnóstico Geral */}
          {parecerConsolidado && (
            <Card
              className={`border shadow-md overflow-hidden ${
                parecerConsolidado.nivel === 'critico'
                  ? 'bg-gradient-to-br from-red-950 via-slate-900 to-[#0B1F3A] border-red-900 text-white'
                  : parecerConsolidado.nivel === 'alerta'
                    ? 'bg-gradient-to-br from-amber-950 via-slate-900 to-[#0B1F3A] border-amber-900 text-white'
                    : 'bg-gradient-to-br from-blue-950 via-[#0B1F3A] to-slate-900 border-blue-900 text-white'
              }`}
            >
              <CardHeader className="pb-3 border-b border-white/10">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`p-2 rounded-xl text-white ${
                        parecerConsolidado.nivel === 'critico'
                          ? 'bg-red-600/40 border border-red-500/40'
                          : parecerConsolidado.nivel === 'alerta'
                            ? 'bg-amber-600/40 border border-amber-500/40'
                            : 'bg-emerald-600/40 border border-emerald-500/40'
                      }`}
                    >
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-bold text-white">
                        {parecerConsolidado.titulo}
                      </CardTitle>
                      <CardDescription className="text-xs text-blue-200/80">
                        Diagnóstico integrado sobre geração de caixa operacional, margem EBITDA e
                        cobertura de juros · Exercício {selectedAno}
                      </CardDescription>
                    </div>
                  </div>

                  <Badge
                    className={`font-bold text-xs uppercase px-3 py-1 ${
                      parecerConsolidado.nivel === 'critico'
                        ? 'bg-red-500 text-white'
                        : parecerConsolidado.nivel === 'alerta'
                          ? 'bg-amber-500 text-slate-900'
                          : 'bg-emerald-500 text-white'
                    }`}
                  >
                    Diagnóstico: {parecerConsolidado.nivel.toUpperCase()}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="pt-5 space-y-4 text-xs leading-relaxed">
                <div className="bg-white/5 p-4 rounded-xl border border-white/10 space-y-1.5">
                  <span className="font-bold text-blue-300 uppercase tracking-wider text-[11px] block">
                    1. Diagnóstico de Geração de Caixa e Rentabilidade Operacional
                  </span>
                  <p className="text-slate-200 leading-relaxed">
                    {parecerConsolidado.detalhesPosicao}
                  </p>
                </div>

                <div className="bg-white/5 p-4 rounded-xl border border-white/10 space-y-1.5">
                  <span className="font-bold text-emerald-300 uppercase tracking-wider text-[11px] block">
                    2. Recomendações Estratégicas do Consultor
                  </span>
                  <p className="text-slate-200 leading-relaxed">
                    {parecerConsolidado.recomendacao}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
