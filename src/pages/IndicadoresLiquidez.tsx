import React, { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useFilter } from '@/contexts/FilterContext'
import { useMinhaEmpresa } from '@/contexts/MinhaEmpresaContext'
import { balancosService, dreService } from '@/services/financeService'
import type { BalancoRecord, DreRecord } from '@/types/finance'
import {
  calcularBalanco,
  calcularDre,
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
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Cell,
  ReferenceLine,
} from 'recharts'
import {
  Gauge,
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
  BarChart3,
  FileSpreadsheet,
  PlusCircle,
  Layers,
  ArrowRight,
  Info,
  DollarSign,
  Scale,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface IndicadorLiquidezInfo {
  id: 'lc' | 'ls' | 'li' | 'lg'
  nome: string
  sigla: string
  formula: string
  descricaoCurta: string
  valor: number | null
  status: 'verde' | 'ambar' | 'vermelho' | 'indefinido'
  interpretacao: string
  referencia: string
  variaveis: {
    label: string
    sigla: string
    valor: number
    detalhes?: string
  }[]
  formulaExplicada: string
}

export default function IndicadoresLiquidez() {
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

  // Estado de detalhes expandidos por card
  const [expandedDetails, setExpandedDetails] = useState<Record<string, boolean>>({
    lc: false,
    ls: false,
    li: false,
    lg: false,
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
      console.error('Erro ao carregar balanços e DRE para indicadores de liquidez:', err)
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

  // Balanço e DRE do ano atual e ano anterior
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

  // Cálculos contábeis
  const calcB = useMemo(() => calcularBalanco(balancoAtual), [balancoAtual])
  const calcD = useMemo(() => calcularDre(dreAtual), [dreAtual])

  const calcBAnterior = useMemo(() => calcularBalanco(balancoAnterior), [balancoAnterior])

  // Variáveis extraídas do Balanço
  const ac = calcB.ativoCirculante
  const arlp = balancoAtual?.realizavel_longo_prazo || 0
  const pc = calcB.passivoCirculante
  const pnc = calcB.passivoNaoCirculante
  const estoques = balancoAtual?.estoques || 0
  const caixa = balancoAtual?.caixa_equivalentes || 0
  const aplicacoes = balancoAtual?.aplicacoes_financeiras || 0
  const disponivel = caixa + aplicacoes

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

  // Cálculo dos 4 Indicadores de Liquidez
  // a) Liquidez Corrente (LC) = AC / PC
  const lcValor = pc > 0 ? ac / pc : null

  // b) Liquidez Seca (LS) = (AC - Estoques) / PC
  const lsValor = pc > 0 ? (ac - estoques) / pc : null

  // c) Liquidez Imediata (LI) = Disponível / PC
  const liValor = pc > 0 ? disponivel / pc : null

  // d) Liquidez Geral (LG) = (AC + ARLP) / (PC + PNC)
  const lgValor = pc + pnc > 0 ? (ac + arlp) / (pc + pnc) : null

  // Classificação de status
  const getStatus = (val: number | null): 'verde' | 'ambar' | 'vermelho' | 'indefinido' => {
    if (val === null || isNaN(val)) return 'indefinido'
    if (val >= 1.0) return 'verde'
    if (val >= 0.8) return 'ambar'
    return 'vermelho'
  }

  // Gera interpretação textual para cada indicador (2 a 3 frases em português claro)
  const getInterpretacaoLC = (val: number | null): string => {
    if (val === null) {
      return 'Não foi possível calcular a Liquidez Corrente devido à ausência de dados do Passivo Circulante no exercício.'
    }
    if (val >= 1.5) {
      return `A empresa possui R$ ${formatNumber(val, 2)} de ativos de curto prazo para cada R$ 1,00 de dívida circulante. Esse resultado reflete uma posição de solvência muito confortável e ampla margem de segurança operacional. A organização tem total capacidade de honrar seus compromissos imediatos com folga.`
    }
    if (val >= 1.0) {
      return `A Liquidez Corrente de ${formatNumber(val, 2)} indica que a empresa dispõe de recursos circulantes suficientes para cobrir integralmente suas obrigações de curto prazo. A gestão do capital de giro encontra-se equilibrada, embora demande acompanhamento contínuo dos prazos de recebimento e pagamento. A solvência imediata está preservada.`
    }
    if (val >= 0.8) {
      return `Com índice de ${formatNumber(val, 2)}, a empresa possui R$ ${formatNumber(val, 2)} em ativos circulantes para cada R$ 1,00 de passivo de curto prazo. O capital de giro líquido está levemente pressionado, indicando dependência da renovação de compromissos ou de novas vendas. Recomenda-se cautela no alongamento de prazos a clientes.`
    }
    return `O indicador de ${formatNumber(val, 2)} sinaliza risco de liquidez e insuficiência de capital de giro no curto prazo. Para cada R$ 1,00 devido no próximo exercício, a empresa dispõe de apenas R$ ${formatNumber(val, 2)} em ativos realizáveis. Há necessidade urgente de renegociação de prazos com credores ou injeção de capital de giro.`
  }

  const getInterpretacaoLS = (val: number | null): string => {
    if (val === null) {
      return 'Dados insuficientes para cálculo da Liquidez Seca no período selecionado.'
    }
    if (val >= 1.0) {
      return `Mesmo desconsiderando totalmente os estoques, a empresa possui R$ ${formatNumber(val, 2)} em ativos realizáveis para cada R$ 1,00 de dívida circulante. Isso comprova alta liquidez intrínseca e independência absoluta da velocidade de giro de mercadorias. A saúde financeira perante credores de curto prazo é robusta.`
    }
    if (val >= 0.8) {
      return `A Liquidez Seca de ${formatNumber(val, 2)} demonstra que a maior parte das obrigações imediatas pode ser quitada sem depender da venda imediata de mercadorias. Há uma dependência moderada do estoque (R$ ${formatBrlMil(estoques)}) para atingir o equilíbrio pleno. A composição dos recebíveis deve ser monitorada com atenção.`
    }
    return `Com ${formatNumber(val, 2)}, a empresa depende significativamente da comercialização de seus estoques para cumprir compromissos de curto prazo. Caso haja lentidão nas vendas ou inadimplência, poderá ocorrer descompasso no fluxo de caixa. Sugere-se otimizar os níveis de estoque e priorizar recebimentos à vista.`
  }

  const getInterpretacaoLI = (val: number | null): string => {
    if (val === null) {
      return 'Dados de disponibilidades ou passivo circulante não disponíveis para cálculo.'
    }
    if (val >= 0.5) {
      return `A empresa dispõe de R$ ${formatNumber(val, 2)} em dinheiro em caixa e aplicações imediatas para cada R$ 1,00 de passivo circulante (${formatPercent(val * 100, 1)}). Trata-se de uma reserva de emergência e liquidez instantânea extremamente alta. Proporciona tranquilidade absoluta contra choques imprevistos de curto prazo.`
    }
    if (val >= 0.2) {
      return `A Liquidez Imediata em ${formatNumber(val, 2)} cobre de pronto ${formatPercent(val * 100, 1)} de todo o passivo circulante apenas com recursos em caixa e bancos. Esse patamar é considerado muito saudável para operações normais de mercado. As disponibilidades oferecem um colchão de segurança adequado.`
    }
    if (val >= 0.05) {
      return `Com ${formatNumber(val, 2)}, as disponibilidades imediatas cobrem ${formatPercent(val * 100, 1)} das dívidas de curto prazo. É um nível comum no ambiente corporativo brasileiro, sustentado pelo fluxo rotineiro de recebimentos de clientes. Recomenda-se manter controle diário rigoroso do fluxo de caixa.`
    }
    return `O índice imediato de ${formatNumber(val, 2)} indica baixíssimo saldo em caixa e bancos frente às exigibilidades de curto prazo. A empresa opera no limite das disponibilidades e depende criticamente das entradas operacionais diárias. Qualquer atraso de clientes pode exigir uso de linhas de crédito bancárias emergenciais.`
  }

  const getInterpretacaoLG = (val: number | null): string => {
    if (val === null) {
      return 'Dados de ativos realizáveis ou obrigações totais insuficientes para apuração da Liquidez Geral.'
    }
    if (val >= 1.2) {
      return `A Liquidez Geral de ${formatNumber(val, 2)} atesta solidez estrutural e solvência global de longo prazo. Para a totalidade das obrigações (curto e longo prazo), a empresa possui R$ ${formatNumber(val, 2)} em direitos realizáveis. A estrutura financeira é sólida e o risco de descontinuidade operacional é mínimo.`
    }
    if (val >= 1.0) {
      return `Com índice de ${formatNumber(val, 2)}, todos os direitos realizáveis (circulante + longo prazo) superam o somatório das obrigações com terceiros. A empresa apresenta equilíbrio financeiro global no horizonte ampliado. A capacidade de honrar compromissos futuros está assegurada pelo perfil dos ativos.`
    }
    if (val >= 0.8) {
      return `A Liquidez Geral em ${formatNumber(val, 2)} aponta para uma ligeira pressão sobre os compromissos totais da empresa frente aos ativos monetizáveis. Parte das dívidas de longo prazo precisará ser amortizada pela geração contínua de lucros futuros. Convém alongar o perfil das dívidas onerosas.`
    }
    return `O índice de ${formatNumber(val, 2)} revela que as dívidas totais (circulantes e de longo prazo) superam os ativos realizáveis da empresa. Há vulnerabilidade estrutural e elevada dependência de receitas operacionais futuras para evitar insolvência. É fundamental implementar um plano de desalavancagem e reestruturação de passivos.`
  }

  // Lista estruturada dos 4 indicadores
  const indicadores: IndicadorLiquidezInfo[] = [
    {
      id: 'lc',
      nome: 'Liquidez Corrente',
      sigla: 'LC',
      formula: 'AC / PC',
      formulaExplicada: 'Ativo Circulante ÷ Passivo Circulante',
      descricaoCurta: 'Capacidade de pagamento de compromissos no curto prazo',
      valor: lcValor,
      status: getStatus(lcValor),
      interpretacao: getInterpretacaoLC(lcValor),
      referencia: '≥ 1,00 (Ideal: 1,20 a 2,00)',
      variaveis: [
        {
          label: 'Ativo Circulante (AC)',
          sigla: 'AC',
          valor: ac,
          detalhes: 'Caixa, Bancos, Aplicações, Clientes, Estoques e Outros Créditos',
        },
        {
          label: 'Passivo Circulante (PC)',
          sigla: 'PC',
          valor: pc,
          detalhes: 'Fornecedores, Empréstimos CP, Obrigações Trabalhistas e Tributárias',
        },
      ],
    },
    {
      id: 'ls',
      nome: 'Liquidez Seca',
      sigla: 'LS',
      formula: '(AC - Estoques) / PC',
      formulaExplicada: '(Ativo Circulante − Estoques) ÷ Passivo Circulante',
      descricaoCurta: 'Solvência de curto prazo sem depender da venda de estoques',
      valor: lsValor,
      status: getStatus(lsValor),
      interpretacao: getInterpretacaoLS(lsValor),
      referencia: '≥ 1,00 (Aceitável: ≥ 0,80)',
      variaveis: [
        {
          label: 'Ativo Circulante (AC)',
          sigla: 'AC',
          valor: ac,
          detalhes: 'Total de bens e direitos circulantes',
        },
        {
          label: 'Estoques',
          sigla: 'Estoques',
          valor: estoques,
          detalhes: 'Matérias-primas, produtos em elaboração e mercadorias',
        },
        {
          label: 'Ativo Circulante Líquido (AC − Estoques)',
          sigla: 'AC - Est',
          valor: ac - estoques,
          detalhes: 'Disponibilidades imediatas e contas a receber de clientes',
        },
        {
          label: 'Passivo Circulante (PC)',
          sigla: 'PC',
          valor: pc,
          detalhes: 'Obrigações exigíveis a curto prazo',
        },
      ],
    },
    {
      id: 'li',
      nome: 'Liquidez Imediata',
      sigla: 'LI',
      formula: 'Disponível / PC',
      formulaExplicada: '(Caixa + Equivalentes + Aplicações Financeiras) ÷ Passivo Circulante',
      descricaoCurta: 'Recursos disponíveis instantaneamente para quitação imediata',
      valor: liValor,
      status: getStatus(liValor),
      interpretacao: getInterpretacaoLI(liValor),
      referencia: '0,10 a 0,30 (≥ 0,20 muito seguro)',
      variaveis: [
        {
          label: 'Caixa e Equivalentes de Caixa',
          sigla: 'Caixa',
          valor: caixa,
          detalhes: 'Saldos em conta corrente e recursos em espécie',
        },
        {
          label: 'Aplicações Financeiras de Curto Prazo',
          sigla: 'Aplicações',
          valor: aplicacoes,
          detalhes: 'Investimentos de liquidez diária/imediata',
        },
        {
          label: 'Total Disponível',
          sigla: 'Disponível',
          valor: disponivel,
          detalhes: 'Soma de caixa e aplicações imediatas',
        },
        {
          label: 'Passivo Circulante (PC)',
          sigla: 'PC',
          valor: pc,
          detalhes: 'Obrigações exigíveis a curto prazo',
        },
      ],
    },
    {
      id: 'lg',
      nome: 'Liquidez Geral',
      sigla: 'LG',
      formula: '(AC + ARLP) / (PC + PNC)',
      formulaExplicada:
        '(Ativo Circulante + Realizável a Longo Prazo) ÷ (Passivo Circulante + Passivo Não Circulante)',
      descricaoCurta: 'Solvência global da empresa considerando curto e longo prazo',
      valor: lgValor,
      status: getStatus(lgValor),
      interpretacao: getInterpretacaoLG(lgValor),
      referencia: '≥ 1,00 (Solvência total garantida)',
      variaveis: [
        {
          label: 'Ativo Circulante (AC)',
          sigla: 'AC',
          valor: ac,
          detalhes: 'Bens e direitos realizáveis no curto prazo',
        },
        {
          label: 'Ativo Realizável a Longo Prazo (ARLP)',
          sigla: 'ARLP',
          valor: arlp,
          detalhes: 'Direitos realizáveis após o término do exercício seguinte',
        },
        {
          label: 'Total Ativos Realizáveis (AC + ARLP)',
          sigla: 'AC + ARLP',
          valor: ac + arlp,
          detalhes: 'Capacidade total de realização financeira da empresa',
        },
        {
          label: 'Passivo Circulante (PC)',
          sigla: 'PC',
          valor: pc,
          detalhes: 'Exigibilidades de curto prazo',
        },
        {
          label: 'Passivo Não Circulante (PNC)',
          sigla: 'PNC',
          valor: pnc,
          detalhes: 'Dívidas e financiamentos de longo prazo',
        },
        {
          label: 'Total de Exigibilidades (PC + PNC)',
          sigla: 'PC + PNC',
          valor: pc + pnc,
          detalhes: 'Total do capital de terceiros contratado pela empresa',
        },
      ],
    },
  ]

  // Dados para o Gráfico Comparativo Horizontal
  const dadosGrafico = useMemo(() => {
    return [
      {
        nome: 'Liquidez Corrente (LC)',
        sigla: 'LC',
        formula: 'AC / PC',
        valor: lcValor !== null ? Number(lcValor.toFixed(2)) : 0,
        status: getStatus(lcValor),
        meta: 1.0,
      },
      {
        nome: 'Liquidez Seca (LS)',
        sigla: 'LS',
        formula: '(AC - Estoques) / PC',
        valor: lsValor !== null ? Number(lsValor.toFixed(2)) : 0,
        status: getStatus(lsValor),
        meta: 1.0,
      },
      {
        nome: 'Liquidez Imediata (LI)',
        sigla: 'LI',
        formula: 'Disponível / PC',
        valor: liValor !== null ? Number(liValor.toFixed(2)) : 0,
        status: getStatus(liValor),
        meta: 0.2,
      },
      {
        nome: 'Liquidez Geral (LG)',
        sigla: 'LG',
        formula: '(AC + ARLP) / (PC + PNC)',
        valor: lgValor !== null ? Number(lgValor.toFixed(2)) : 0,
        status: getStatus(lgValor),
        meta: 1.0,
      },
    ]
  }, [lcValor, lsValor, liValor, lgValor])

  // Parecer Consolidado do Consultor
  const parecerConsolidado = useMemo(() => {
    if (!balancoAtual) return null

    const hasAnyNull = lcValor === null || lsValor === null || liValor === null || lgValor === null
    const scoreVerdes = [lcValor, lsValor, lgValor].filter((v) => v !== null && v >= 1.0).length
    const scoreAmbares = [lcValor, lsValor, lgValor].filter(
      (v) => v !== null && v >= 0.8 && v < 1.0,
    ).length
    const scoreVermelhos = [lcValor, lsValor, lgValor].filter((v) => v !== null && v < 0.8).length

    let titulo = ''
    let nivel: 'excelente' | 'adequado' | 'alerta' | 'critico' = 'adequado'
    let recomendacao = ''
    let detalhesPosicao = ''

    if (scoreVermelhos >= 2 || (lcValor !== null && lcValor < 0.8)) {
      nivel = 'critico'
      titulo = 'Situação de Liquidez sob Atenção Crítica'
      detalhesPosicao = `A empresa ${selectedEmpresa?.nome || ''} encerrou o exercício de ${selectedAno} com indicadores de liquidez em patamar de fragilidade. A Liquidez Corrente de ${formatNumber(lcValor, 2)} e Geral de ${formatNumber(lgValor, 2)} revelam que os ativos circulantes e de longo prazo são insuficientes para cobrir o montante exigível por terceiros.`
      recomendacao =
        'Recomenda-se com urgência: 1) Renegociar e alongar os vencimentos de empréstimos bancários do Passivo Circulante para o Longo Prazo; 2) Implementar uma política rígida de cobrança para reduzir a inadimplência e acelerar o giro do Contas a Receber; 3) Liquidar estoques com baixo giro para recompor o caixa imediato; 4) Avaliar aporte de capital pelos sócios ou retenção integral dos lucros.'
    } else if (scoreAmbares >= 2 || (lcValor !== null && lcValor < 1.0)) {
      nivel = 'alerta'
      titulo = 'Posição de Liquidez Moderada com Necessidade de Ajustes no Capital de Giro'
      detalhesPosicao = `No exercício ${selectedAno}, a empresa apresenta liquidez em nível limítrofe (LC: ${formatNumber(lcValor, 2)}, LS: ${formatNumber(lsValor, 2)}, LG: ${formatNumber(lgValor, 2)}). Embora haja capacidade operacional de honrar compromissos, a margem de segurança é restrita caso ocorram oscilações bruscas no faturamento ou atrasos de clientes.`
      recomendacao =
        'Recomenda-se: 1) Adequar os prazos médios concedidos a clientes com os prazos obtidos junto a fornecedores (equilíbrio de tesouraria); 2) Reduzir o volume de capital imobilizado em estoques ociosos (atualmente em R$ ' +
        formatBrlMil(estoques) +
        '); 3) Manter reserva de liquidez imediata correspondente a pelo menos 30 dias de despesas operacionais.'
    } else if (scoreVerdes >= 3 && lcValor !== null && lcValor >= 1.3) {
      nivel = 'excelente'
      titulo = 'Excelente Posição de Liquidez e Alta Solvência Financeira'
      detalhesPosicao = `A empresa ${selectedEmpresa?.nome || ''} demonstra sólida saúde financeira no exercício de ${selectedAno}. Com Liquidez Corrente de ${formatNumber(lcValor, 2)}, Liquidez Seca de ${formatNumber(lsValor, 2)} e Liquidez Geral de ${formatNumber(lgValor, 2)}, a organização detém ampla capacidade de pagamento tanto no curto quanto no longo prazo.`
      recomendacao =
        'Recomenda-se: 1) Aproveitar a solidez do caixa para negociar descontos significativos para pagamentos à vista com fornecedores-chave; 2) Otimizar o rendimento das disponibilidades (R$ ' +
        formatBrlMil(disponivel) +
        ') através de aplicações financeiras de baixo risco com rentabilidade indexada ao CDI; 3) Avaliar investimentos estratégicos em expansão ou modernização mantendo a folga de liquidez acima de 1,20.'
    } else {
      nivel = 'adequado'
      titulo = 'Liquidez Equilibrada e Compatível com as Atividades Operacionais'
      detalhesPosicao = `No ano de ${selectedAno}, a empresa exibe estrutura de liquidez equilibrada (LC: ${formatNumber(lcValor, 2)}, LS: ${formatNumber(lsValor, 2)}, LG: ${formatNumber(lgValor, 2)}). Os recursos realizáveis superam as obrigações imediatas e totais, garantindo a continuidade harmônica dos negócios.`
      recomendacao =
        'Recomenda-se: 1) Acompanhar mensalmente o fluxo de caixa projetado para antecipar eventuais sazonalidades de demanda; 2) Monitorar o índice de Liquidez Imediata (atualmente em ' +
        formatNumber(liValor, 2) +
        ') para assegurar que eventos inesperados sejam absorvidos sem necessidade de endividamento caro.'
    }

    return {
      titulo,
      nivel,
      detalhesPosicao,
      recomendacao,
      hasAnyNull,
    }
  }, [
    balancoAtual,
    lcValor,
    lsValor,
    liValor,
    lgValor,
    selectedEmpresa,
    selectedAno,
    estoques,
    disponivel,
  ])

  // Exportação CSV
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

    csvContent += `RELATÓRIO DE INDICADORES DE LIQUIDEZ\n`
    csvContent += `EMPRESA;${selectedEmpresa.nome}\n`
    csvContent += `CNPJ;${formatCnpj(selectedEmpresa.cnpj)}\n`
    csvContent += `SEGMENTO;${selectedEmpresa.segmento}\n`
    csvContent += `EXERCÍCIO;${selectedAno}\n`
    csvContent += `DATA DE EMISSÃO;${dataEmissao}\n\n`

    csvContent += `VALORES BASE EXTRAÍDOS DO BALANÇO (R$)\n`
    csvContent += `Ativo Circulante (AC);${ac.toFixed(2).replace('.', ',')}\n`
    csvContent += `Ativo Realizável a Longo Prazo (ARLP);${arlp.toFixed(2).replace('.', ',')}\n`
    csvContent += `Passivo Circulante (PC);${pc.toFixed(2).replace('.', ',')}\n`
    csvContent += `Passivo Não Circulante (PNC);${pnc.toFixed(2).replace('.', ',')}\n`
    csvContent += `Estoques;${estoques.toFixed(2).replace('.', ',')}\n`
    csvContent += `Caixa e Equivalentes;${caixa.toFixed(2).replace('.', ',')}\n`
    csvContent += `Aplicações Financeiras;${aplicacoes.toFixed(2).replace('.', ',')}\n`
    csvContent += `Disponível Total;${disponivel.toFixed(2).replace('.', ',')}\n\n`

    csvContent += `INDICADORES CALCULADOS\n`
    csvContent += `Indicador;Sigla;Fórmula;Valor Calculado;Classificação;Interpretação Resumida\n`

    for (const ind of indicadores) {
      const valStr = ind.valor !== null ? ind.valor.toFixed(2).replace('.', ',') : 'N/D'
      const classStr =
        ind.status === 'verde'
          ? 'Verde (Adequado >= 1,00)'
          : ind.status === 'ambar'
            ? 'Âmbar (Atenção 0,80 a 1,00)'
            : ind.status === 'vermelho'
              ? 'Vermelho (Alerta < 0,80)'
              : 'Indefinido'

      // Limpa quebras de linha para o CSV
      const interpClean = ind.interpretacao.replace(/\n/g, ' ').replace(/;/g, ',')
      csvContent += `${ind.nome};${ind.sigla};${ind.formula};${valStr};${classStr};${interpClean}\n`
    }

    if (parecerConsolidado) {
      csvContent += `\nPARECER DO CONSULTOR FINANCEIRO\n`
      csvContent += `Diagnóstico;${parecerConsolidado.titulo.replace(/;/g, ',')}\n`
      csvContent += `Análise Geral;${parecerConsolidado.detalhesPosicao.replace(/\n/g, ' ').replace(/;/g, ',')}\n`
      csvContent += `Recomendações Práticas;${parecerConsolidado.recomendacao.replace(/\n/g, ' ').replace(/;/g, ',')}\n`
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `indicadores-liquidez-${selectedEmpresa.nome.replace(/\s+/g, '-').toLowerCase()}-${selectedAno}.csv`
    link.click()
    URL.revokeObjectURL(link.href)

    toast({
      title: 'CSV exportado com sucesso!',
      description: `Arquivo de indicadores de liquidez (${selectedAno}) gerado com sucesso.`,
    })
  }

  // Cor do badge e status
  const renderBadge = (status: 'verde' | 'ambar' | 'vermelho' | 'indefinido') => {
    switch (status) {
      case 'verde':
        return (
          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-300 font-bold text-xs flex items-center gap-1.5 px-2.5 py-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />🟢 Adequado (≥
            1,0)
          </Badge>
        )
      case 'ambar':
        return (
          <Badge className="bg-amber-50 text-amber-700 border-amber-300 font-bold text-xs flex items-center gap-1.5 px-2.5 py-1">
            <span className="w-2 h-2 rounded-full bg-amber-500" />🟠 Atenção (0,8 – 1,0)
          </Badge>
        )
      case 'vermelho':
        return (
          <Badge className="bg-red-50 text-red-700 border-red-300 font-bold text-xs flex items-center gap-1.5 px-2.5 py-1">
            <span className="w-2 h-2 rounded-full bg-red-500" />🔴 Alerta (&lt; 0,8)
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

  const getBarColor = (status: 'verde' | 'ambar' | 'vermelho' | 'indefinido') => {
    switch (status) {
      case 'verde':
        return '#10B981' // emerald-500
      case 'ambar':
        return '#F59E0B' // amber-500
      case 'vermelho':
        return '#EF4444' // red-500
      default:
        return '#94A3B8'
    }
  }

  // Loading state
  if (loading && !balancoAtual && balancos.length === 0) {
    return (
      <div className="py-20 flex flex-col justify-center items-center gap-3">
        <div className="w-9 h-9 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs text-slate-500 font-medium">
          Carregando indicadores de liquidez...
        </span>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fadeIn pb-10">
      {/* 1. Header com Título, Seletores e Ação de Exportação */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-lg shadow-md shadow-blue-600/20 shrink-0">
            <Gauge className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-extrabold text-[#0B1F3A] tracking-tight">
                Indicadores de Liquidez
              </h1>
              <Badge className="bg-blue-50 text-blue-700 border-blue-200 font-semibold text-xs">
                Análise Financeira
              </Badge>
            </div>
            <p className="text-xs text-[#5B6B7F] mt-0.5">
              Diagnóstico de capacidade de pagamento e solvência (Curto e Longo Prazo)
            </p>
          </div>
        </div>

        {/* Seletores de Empresa e Ano + Botão CSV */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Seletor Empresa */}
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
                {anosEmpresa.map((ano) => (
                  <SelectItem key={ano} value={String(ano)} className="text-xs">
                    {ano}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Botão Exportar CSV */}
          <Button
            onClick={handleExportCsv}
            disabled={!balancoAtual}
            variant="outline"
            className="border-slate-300 text-slate-700 hover:bg-slate-100 font-semibold text-xs h-9 shadow-2xs"
          >
            <Download className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {/* Se não houver balanço cadastrado para este ano, exibir mensagem informativa com link */}
      {!balancoAtual ? (
        <Card className="bg-white border-amber-200 shadow-2xs overflow-hidden">
          <CardContent className="p-8 text-center flex flex-col items-center justify-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200">
              <AlertCircle className="w-7 h-7" />
            </div>
            <div className="max-w-md space-y-1.5">
              <h3 className="text-base font-bold text-slate-800">
                Nenhum Balanço Patrimonial em {selectedAno}
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                A empresa{' '}
                <span className="font-semibold text-slate-900">
                  {selectedEmpresa?.nome || 'selecionada'}
                </span>{' '}
                ainda não possui lançamentos de Balanço Patrimonial cadastrados para o exercício de{' '}
                {selectedAno}.
              </p>
            </div>
            <div className="flex items-center gap-3 flex-wrap justify-center pt-2">
              {selectedEmpresaId && (
                <Button
                  onClick={() => navigate(`/empresas/${selectedEmpresaId}`)}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-9 shadow-xs"
                >
                  <PlusCircle className="w-4 h-4 mr-1.5" />
                  Cadastrar Balanço em {selectedEmpresa?.nome}
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
          {/* 2. Resumo de Variáveis Extraídas do Balanço (Fita de apoio) */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Scale className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-bold text-[#0B1F3A] uppercase tracking-wider">
                  Balanço Patrimonial Base ({selectedAno})
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
                  Ativo Circulante (AC)
                </span>
                <span className="text-sm font-bold text-slate-900 block mt-0.5">
                  {formatCurrency(ac)}
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                <span className="text-[10px] font-semibold text-slate-500 uppercase block truncate">
                  Passivo Circulante (PC)
                </span>
                <span className="text-sm font-bold text-slate-900 block mt-0.5">
                  {formatCurrency(pc)}
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                <span className="text-[10px] font-semibold text-slate-500 uppercase block truncate">
                  Estoques
                </span>
                <span className="text-sm font-bold text-slate-900 block mt-0.5">
                  {formatCurrency(estoques)}
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                <span className="text-[10px] font-semibold text-slate-500 uppercase block truncate">
                  Disponível (Caixa+Apic.)
                </span>
                <span className="text-sm font-bold text-emerald-700 block mt-0.5">
                  {formatCurrency(disponivel)}
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                <span className="text-[10px] font-semibold text-slate-500 uppercase block truncate">
                  Realizável L. Prazo (ARLP)
                </span>
                <span className="text-sm font-bold text-slate-900 block mt-0.5">
                  {formatCurrency(arlp)}
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                <span className="text-[10px] font-semibold text-slate-500 uppercase block truncate">
                  Passivo Não Circulante (PNC)
                </span>
                <span className="text-sm font-bold text-slate-900 block mt-0.5">
                  {formatCurrency(pnc)}
                </span>
              </div>
            </div>
          </div>

          {/* 3. Cards Individuais dos 4 Indicadores de Liquidez */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {indicadores.map((ind) => {
              const isExpanded = expandedDetails[ind.id]

              return (
                <Card
                  key={ind.id}
                  className="bg-white border-slate-200 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden"
                >
                  <div>
                    {/* Header do Card */}
                    <CardHeader className="p-5 pb-3 border-b border-slate-100 flex flex-row items-start justify-between gap-3 space-y-0">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
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

                      {renderBadge(ind.status)}
                    </CardHeader>

                    {/* Conteúdo Principal do Card */}
                    <CardContent className="p-5 pt-4 space-y-4">
                      {/* Valor Calculado e Fórmula */}
                      <div className="flex items-end justify-between gap-4 p-3.5 bg-gradient-to-r from-slate-50 to-blue-50/30 rounded-xl border border-slate-100">
                        <div>
                          <span className="text-[11px] font-semibold uppercase text-slate-500 block">
                            Fórmula de Cálculo
                          </span>
                          <code className="text-xs font-mono font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200 mt-0.5 inline-block">
                            {ind.formula}
                          </code>
                          <span className="text-[10px] text-slate-500 block mt-1">
                            Ref: {ind.referencia}
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="text-[10px] font-semibold uppercase text-slate-400 block">
                            Valor Apurado
                          </span>
                          <div
                            className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${
                              ind.status === 'verde'
                                ? 'text-emerald-600'
                                : ind.status === 'ambar'
                                  ? 'text-amber-600'
                                  : ind.status === 'vermelho'
                                    ? 'text-red-600'
                                    : 'text-slate-600'
                            }`}
                          >
                            {formatNumber(ind.valor, 2)}
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

                      {/* Botão e Painel de Detalhes Expandidos (Valores do Balanço) */}
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
                              ? 'Ocultar Valores Extraídos do Balanço'
                              : 'Expandir Detalhes do Cálculo'}
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </Button>

                        {/* Detalhes com grid de variáveis */}
                        {isExpanded && (
                          <div className="mt-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5 animate-fadeIn">
                            <div className="text-[11px] font-semibold text-slate-600">
                              Fórmula detalhada:{' '}
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

          {/* 4. Gráfico Comparativo: Gráfico de Barras Horizontais com os 4 Indicadores */}
          <Card className="bg-white border-slate-200 shadow-2xs">
            <CardHeader className="pb-2 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">
                    <BarChart3 className="w-4 h-4" />
                  </div>
                  <CardTitle className="text-base font-bold text-[#0B1F3A]">
                    Comparativo Visual dos 4 Indicadores de Liquidez ({selectedAno})
                  </CardTitle>
                </div>
                <CardDescription className="text-xs mt-0.5">
                  Comparação lado a lado com linha de referência em 1,00 (equilíbrio entre ativos e
                  passivos)
                </CardDescription>
              </div>

              {/* Legenda visual rápida */}
              <div className="flex items-center gap-3 text-[11px] font-semibold">
                <span className="flex items-center gap-1 text-emerald-700">
                  <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />≥ 1,00 (Adequado)
                </span>
                <span className="flex items-center gap-1 text-amber-700">
                  <span className="w-2.5 h-2.5 rounded-sm bg-amber-500" />
                  0,80 a 1,00 (Atenção)
                </span>
                <span className="flex items-center gap-1 text-red-700">
                  <span className="w-2.5 h-2.5 rounded-sm bg-red-500" />
                  &lt; 0,80 (Alerta)
                </span>
              </div>
            </CardHeader>

            <CardContent className="pt-6">
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={dadosGrafico}
                    margin={{ top: 10, right: 30, left: 40, bottom: 10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
                    <XAxis
                      type="number"
                      domain={[
                        0,
                        (dataMax: number) => Math.max(2.0, Math.ceil(dataMax * 1.2 * 10) / 10),
                      ]}
                      tick={{ fontSize: 11, fill: '#64748B' }}
                      tickFormatter={(v) => v.toFixed(1)}
                    />
                    <YAxis
                      dataKey="sigla"
                      type="category"
                      tick={{ fontSize: 12, fill: '#0B1F3A', fontWeight: 700 }}
                      width={45}
                    />
                    <RechartsTooltip
                      formatter={(val: any, name: any, item: any) => [
                        `${formatNumber(Number(val), 2)} (${item.payload.nome})`,
                        'Índice',
                      ]}
                      labelFormatter={(label: any) => `Indicador: ${label}`}
                    />
                    <ReferenceLine
                      x={1.0}
                      stroke="#2563EB"
                      strokeDasharray="4 4"
                      strokeWidth={1.5}
                      label={{
                        value: 'Meta: 1.00',
                        fill: '#2563EB',
                        fontSize: 10,
                        position: 'top',
                      }}
                    />
                    <Bar dataKey="valor" radius={[0, 6, 6, 0]} barSize={26}>
                      {dadosGrafico.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={getBarColor(entry.status)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Tabela Resumo abaixo do Gráfico */}
              <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                {dadosGrafico.map((d, i) => (
                  <div key={i} className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="font-bold text-slate-800 block">{d.sigla}</span>
                    <span className="text-[10px] text-slate-500 block truncate">{d.formula}</span>
                    <span
                      className={`text-sm font-extrabold block mt-0.5 ${
                        d.status === 'verde'
                          ? 'text-emerald-600'
                          : d.status === 'ambar'
                            ? 'text-amber-600'
                            : 'text-red-600'
                      }`}
                    >
                      {formatNumber(d.valor, 2)}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 5. Análise Consolidada com Recomendação do Consultor */}
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
                        Diagnóstico integrado de solvência e gestão do capital de giro · Exercício{' '}
                        {selectedAno}
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
                    Status: {parecerConsolidado.nivel.toUpperCase()}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="pt-5 space-y-4 text-xs leading-relaxed">
                {/* Diagnóstico da Posição */}
                <div className="bg-white/5 p-4 rounded-xl border border-white/10 space-y-1.5">
                  <span className="font-bold text-blue-300 uppercase tracking-wider text-[11px] block">
                    1. Posição Geral de Liquidez
                  </span>
                  <p className="text-slate-200 leading-relaxed">
                    {parecerConsolidado.detalhesPosicao}
                  </p>
                </div>

                {/* Recomendações Práticas do Consultor */}
                <div className="bg-white/5 p-4 rounded-xl border border-white/10 space-y-1.5">
                  <span className="font-bold text-emerald-300 uppercase tracking-wider text-[11px] block">
                    2. Recomendações e Plano de Ação Estratégico
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
