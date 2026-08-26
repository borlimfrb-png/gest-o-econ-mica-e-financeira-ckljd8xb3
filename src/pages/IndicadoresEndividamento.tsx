import React, { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useFilter } from '@/contexts/FilterContext'
import { useMinhaEmpresa } from '@/contexts/MinhaEmpresaContext'
import { balancosService } from '@/services/financeService'
import type { BalancoRecord } from '@/types/finance'
import {
  calcularBalanco,
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
  TrendingDown,
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
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface IndicadorEndividamentoInfo {
  id: 'pct' | 'ce' | 'ipl' | 'irnc'
  nome: string
  sigla: string
  formula: string
  formulaExplicada: string
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
}

export default function IndicadoresEndividamento() {
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
  const [loading, setLoading] = useState<boolean>(true)

  // Estado de detalhes expandidos por card
  const [expandedDetails, setExpandedDetails] = useState<Record<string, boolean>>({
    pct: false,
    ce: false,
    ipl: false,
    irnc: false,
  })

  const toggleDetails = (id: string) => {
    setExpandedDetails((prev) => ({
      ...prev,
      [id]: !prev[id],
    }))
  }

  // Carregar dados das coleções de balanços
  const loadData = async () => {
    if (!selectedEmpresaId) {
      setBalancos([])
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      const bList = await balancosService.getByEmpresa(selectedEmpresaId)
      setBalancos(bList)
    } catch (err) {
      console.error('Erro ao carregar balanços para indicadores de endividamento:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar dados',
        description: 'Não foi possível buscar as informações de balanço da empresa selecionada.',
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

  const balancoAtual = useMemo(
    () => balancos.find((b) => b.ano === selectedAno) || null,
    [balancos, selectedAno],
  )

  const calcB = useMemo(() => calcularBalanco(balancoAtual), [balancoAtual])

  // Variáveis extraídas do Balanço
  const at = calcB.ativoTotal
  const ac = calcB.ativoCirculante
  const anc = calcB.ativoNaoCirculante
  const arlp = balancoAtual?.realizavel_longo_prazo || 0
  const imobilizadoIntangivel = Math.max(0, anc - arlp) // (ANC - ARLP)
  const pc = calcB.passivoCirculante
  const pnc = calcB.passivoNaoCirculante
  const pl = calcB.patrimonioLiquido
  const passivoTotal = pc + pnc

  // Anos disponíveis para a empresa
  const anosEmpresa = useMemo(() => {
    const anosSet = new Set<number>()
    balancos.forEach((b) => anosSet.add(b.ano))
    if (anosDisponiveis && anosDisponiveis.length > 0) {
      anosDisponiveis.forEach((a) => anosSet.add(a))
    }
    const arr = Array.from(anosSet).sort((a, b) => b - a)
    return arr.length > 0 ? arr : [selectedAno]
  }, [balancos, anosDisponiveis, selectedAno])

  // 1. Participação de Capital de Terceiros (PCT): (PC + PNC) / PL * 100
  // Badge: 🟢 <=100%, 🟠 100-200%, 🔴 >200%
  const pctValor = pl > 0 ? (passivoTotal / pl) * 100 : null
  const getPctStatus = (val: number | null): 'verde' | 'ambar' | 'vermelho' | 'indefinido' => {
    if (val === null || isNaN(val)) return 'indefinido'
    if (val <= 100) return 'verde'
    if (val <= 200) return 'ambar'
    return 'vermelho'
  }

  // 2. Composição do Endividamento (CE): PC / (PC + PNC) * 100
  // Badge: 🟢 <=50%, 🟠 50-70%, 🔴 >70%
  const ceValor = passivoTotal > 0 ? (pc / passivoTotal) * 100 : null
  const getCeStatus = (val: number | null): 'verde' | 'ambar' | 'vermelho' | 'indefinido' => {
    if (val === null || isNaN(val)) return 'indefinido'
    if (val <= 50) return 'verde'
    if (val <= 70) return 'ambar'
    return 'vermelho'
  }

  // 3. Imobilização do Patrimônio Líquido (IPL): (ANC - ARLP) / PL * 100
  // Badge: 🟢 <=80%, 🟠 80-100%, 🔴 >100%
  const iplValor = pl > 0 ? (imobilizadoIntangivel / pl) * 100 : null
  const getIplStatus = (val: number | null): 'verde' | 'ambar' | 'vermelho' | 'indefinido' => {
    if (val === null || isNaN(val)) return 'indefinido'
    if (val <= 80) return 'verde'
    if (val <= 100) return 'ambar'
    return 'vermelho'
  }

  // 4. Imobilização dos Recursos Não Correntes (IRNC): (ANC - ARLP) / (PL + PNC) * 100
  // Badge: 🟢 <=80%, 🟠 80-100%, 🔴 >100%
  const irncValor = pl + pnc > 0 ? (imobilizadoIntangivel / (pl + pnc)) * 100 : null
  const getIrncStatus = (val: number | null): 'verde' | 'ambar' | 'vermelho' | 'indefinido' => {
    if (val === null || isNaN(val)) return 'indefinido'
    if (val <= 80) return 'verde'
    if (val <= 100) return 'ambar'
    return 'vermelho'
  }

  // Interpretações textuais (2 a 3 frases em português claro)
  const getInterpretacaoPCT = (val: number | null): string => {
    if (val === null) {
      return 'Dados insuficientes de Patrimônio Líquido para o cálculo da Participação de Capital de Terceiros.'
    }
    if (val <= 100) {
      return `A empresa utiliza R$ ${formatNumber(val / 100, 2)} de capital de terceiros para cada R$ 1,00 de patrimônio próprio (${formatPercent(val, 1)}). Isso reflete uma estrutura com baixa dependência de credores e elevada autonomia patrimonial. A solvência global encontra-se em patamar muito seguro.`
    }
    if (val <= 200) {
      return `O volume de recursos de terceiros corresponde a ${formatPercent(val, 1)} do capital próprio (R$ ${formatNumber(val / 100, 2)} por R$ 1,00 de PL). O endividamento é moderado e compatível com empresas em ciclo de expansão. É aconselhável acompanhar a taxa de juros média das obrigações para evitar compressão dos lucros.`
    }
    return `Com ${formatPercent(val, 1)}, as dívidas totais superam em mais do que o dobro o patrimônio dos sócios. A empresa opera fortemente alavancada e com alta vulnerabilidade a choques de mercado ou aumentos na taxa de juros. Recomenda-se traçar um plano de amortização e retenção de resultados para recompor o capital próprio.`
  }

  const getInterpretacaoCE = (val: number | null): string => {
    if (val === null) {
      return 'Dados de passivo exigível indisponíveis para apuração da Composição do Endividamento.'
    }
    if (val <= 50) {
      return `Apenas ${formatPercent(val, 1)} das obrigações totais vencem no curto prazo, concentrando a maior fatia no longo prazo. Esse perfil de endividamento proporciona folga considerável para a tesouraria e o capital de giro. A empresa tem tempo suficiente para maturar seus investimentos antes de honrar as parcelas principais.`
    }
    if (val <= 70) {
      return `As dívidas de curto prazo representam ${formatPercent(val, 1)} do passivo exigível total. Trata-se de uma concentração intermediária, comum no varejo e serviços, que requer boa cadência de recebimentos. Sugere-se monitorar a liquidez operacional para evitar pressões de caixa no fechamento dos meses.`
    }
    return `Cerca de ${formatPercent(val, 1)} de todo o endividamento da empresa tem vencimento no curto prazo (Passivo Circulante). Essa alta concentração imediata gera pressão diária sobre a tesouraria e risco de estrangulamento do fluxo de caixa. É urgente renegociar contratos e alongar prazos com credores e instituições financeiras.`
  }

  const getInterpretacaoIPL = (val: number | null): string => {
    if (val === null) {
      return 'Não foi possível apurar a Imobilização do PL devido à ausência de dados do Patrimônio Líquido.'
    }
    if (val <= 80) {
      return `O ativo permanente consome ${formatPercent(val, 1)} do Patrimônio Líquido, restando pelo menos ${(100 - val).toFixed(1)}% do capital próprio livre para financiar o capital de giro. Essa situação proporciona grande flexibilidade financeira às atividades operacionais. A empresa não depende de dívidas caras para manter seu giro cotidiano.`
    }
    if (val <= 100) {
      return `O capital próprio cobre ${formatPercent(val, 1)} dos ativos imobilizados e intangíveis da organização. Há um equilíbrio estrito na cobertura dos ativos fixos, com pouca margem de capital próprio remanescente para o giro. Recomenda-se evitar novos investimentos imobilizados sem aporte proporcional de recursos de longo prazo.`
    }
    return `O indicador de ${formatPercent(val, 1)} revela que o Ativo Permanente excede o Patrimônio Líquido integral. Isso significa que a empresa foi forçada a recorrer a capital de terceiros para financiar seus ativos de difícil liquidez (imobilizado/intangível). Há risco estrutural relevante que exige reforço patrimonial.`
  }

  const getInterpretacaoIRNC = (val: number | null): string => {
    if (val === null) {
      return 'Dados insuficientes de recursos não correntes para cálculo do indicador IRNC.'
    }
    if (val <= 80) {
      return `Os ativos permanentes absorvem ${formatPercent(val, 1)} do somatório do Patrimônio Líquido com o Passivo Não Circulante. Há uma folga sadia de recursos estáveis financiando o ativo circulante líquido. A estrutura de capital cumpre com perfeição a regra de ouro do financiamento contábil.`
    }
    if (val <= 100) {
      return `A relação de ${formatPercent(val, 1)} indica que os recursos de longo prazo e próprios cobrem de forma exata os bens de uso permanente. A segurança estrutural está garantida, embora haja pouca sobra de financiamento estável para o giro. É prudente manter o foco na rentabilidade dos investimentos já implantados.`
    }
    return `Com ${formatPercent(val, 1)}, os recursos de longo prazo (PL + PNC) são insuficientes para cobrir o ativo não circulante operacional. Isso indica que recursos de curto prazo (Passivo Circulante) estão financiando bens permanentes, configurando grave desequilíbrio estrutural de prazos. Torna-se imperativo captar dívidas de longo prazo ou realizar aumento de capital.`
  }

  const indicadores: IndicadorEndividamentoInfo[] = [
    {
      id: 'pct',
      nome: 'Participação de Capital de Terceiros',
      sigla: 'PCT',
      formula: '(PC + PNC) / PL × 100',
      formulaExplicada: '(Passivo Circulante + Passivo Não Circulante) ÷ Patrimônio Líquido × 100',
      descricaoCurta: 'Uso de capital de terceiros em relação ao capital próprio',
      valor: pctValor,
      status: getPctStatus(pctValor),
      interpretacao: getInterpretacaoPCT(pctValor),
      referencia: '≤ 100% (Ideal: menor dependência de terceiros)',
      variaveis: [
        {
          label: 'Passivo Circulante (PC)',
          sigla: 'PC',
          valor: pc,
          detalhes: 'Dívidas e obrigações de curto prazo',
        },
        {
          label: 'Passivo Não Circulante (PNC)',
          sigla: 'PNC',
          valor: pnc,
          detalhes: 'Dívidas e financiamentos de longo prazo',
        },
        {
          label: 'Passivo Exigível Total (PC + PNC)',
          sigla: 'Dívidas',
          valor: passivoTotal,
          detalhes: 'Total do capital de terceiros captado',
        },
        {
          label: 'Patrimônio Líquido (PL)',
          sigla: 'PL',
          valor: pl,
          detalhes: 'Capital próprio dos sócios e reservas acumuladas',
        },
      ],
    },
    {
      id: 'ce',
      nome: 'Composição do Endividamento',
      sigla: 'CE',
      formula: 'PC / (PC + PNC) × 100',
      formulaExplicada: 'Passivo Circulante ÷ (Passivo Circulante + Passivo Não Circulante) × 100',
      descricaoCurta: 'Proporção das dívidas totais que vencem no curto prazo',
      valor: ceValor,
      status: getCeStatus(ceValor),
      interpretacao: getInterpretacaoCE(ceValor),
      referencia: '≤ 50% (Ideal: maioria das dívidas no longo prazo)',
      variaveis: [
        {
          label: 'Passivo Circulante (PC)',
          sigla: 'PC',
          valor: pc,
          detalhes: 'Obrigações com vencimento até o encerramento do exercício seguinte',
        },
        {
          label: 'Passivo Exigível Total (PC + PNC)',
          sigla: 'PC + PNC',
          valor: passivoTotal,
          detalhes: 'Soma de todas as dívidas e financiamentos com terceiros',
        },
      ],
    },
    {
      id: 'ipl',
      nome: 'Imobilização do Patrimônio Líquido',
      sigla: 'IPL',
      formula: '(ANC - ARLP) / PL × 100',
      formulaExplicada:
        '(Ativo Não Circulante − Realizável a Longo Prazo) ÷ Patrimônio Líquido × 100',
      descricaoCurta: 'Proporção do capital próprio aplicada em ativos permanentes',
      valor: iplValor,
      status: getIplStatus(iplValor),
      interpretacao: getInterpretacaoIPL(iplValor),
      referencia: '≤ 80% (Ideal: sobra de capital próprio para o giro)',
      variaveis: [
        {
          label: 'Ativo Não Circulante (ANC)',
          sigla: 'ANC',
          valor: anc,
          detalhes: 'Realizável a longo prazo, investimentos, imobilizado e intangível',
        },
        {
          label: 'Realizável a Longo Prazo (ARLP)',
          sigla: 'ARLP',
          valor: arlp,
          detalhes: 'Direitos realizáveis no longo prazo',
        },
        {
          label: 'Ativo Permanente (ANC − ARLP)',
          sigla: 'Imobilizado + Intangível',
          valor: imobilizadoIntangivel,
          detalhes: 'Bens de uso, instalações e ativos fixos da operação',
        },
        {
          label: 'Patrimônio Líquido (PL)',
          sigla: 'PL',
          valor: pl,
          detalhes: 'Capital social, reservas e lucros acumulados',
        },
      ],
    },
    {
      id: 'irnc',
      nome: 'Imobilização dos Recursos Não Correntes',
      sigla: 'IRNC',
      formula: '(ANC - ARLP) / (PL + PNC) × 100',
      formulaExplicada:
        '(Ativo Não Circulante − Realizável a Longo Prazo) ÷ (Patrimônio Líquido + Passivo Não Circulante) × 100',
      descricaoCurta: 'Comprometimento dos recursos de longo prazo com ativos permanentes',
      valor: irncValor,
      status: getIrncStatus(irncValor),
      interpretacao: getInterpretacaoIRNC(irncValor),
      referencia: '≤ 80% (Equilíbrio de longo prazo entre fontes e aplicações)',
      variaveis: [
        {
          label: 'Ativo Permanente (ANC − ARLP)',
          sigla: 'Permanente',
          valor: imobilizadoIntangivel,
          detalhes: 'Imobilizado, investimentos permanentes e intangíveis',
        },
        {
          label: 'Patrimônio Líquido (PL)',
          sigla: 'PL',
          valor: pl,
          detalhes: 'Recursos próprios dos sócios/acionistas',
        },
        {
          label: 'Passivo Não Circulante (PNC)',
          sigla: 'PNC',
          valor: pnc,
          detalhes: 'Financiamentos e dívidas de longo prazo',
        },
        {
          label: 'Recursos Não Correntes Totais (PL + PNC)',
          sigla: 'PL + PNC',
          valor: pl + pnc,
          detalhes: 'Total de fontes de capital estável/permanente',
        },
      ],
    },
  ]

  // Dados para o Gráfico Comparativo Horizontal
  const dadosGrafico = useMemo(() => {
    return [
      {
        nome: 'Part. Capital Terceiros (PCT)',
        sigla: 'PCT',
        formula: '(PC+PNC)/PL * 100',
        valor: pctValor !== null ? Number(pctValor.toFixed(1)) : 0,
        status: getPctStatus(pctValor),
        meta: 100,
        unidade: '%',
      },
      {
        nome: 'Composição Endividamento (CE)',
        sigla: 'CE',
        formula: 'PC/(PC+PNC) * 100',
        valor: ceValor !== null ? Number(ceValor.toFixed(1)) : 0,
        status: getCeStatus(ceValor),
        meta: 50,
        unidade: '%',
      },
      {
        nome: 'Imobilização do PL (IPL)',
        sigla: 'IPL',
        formula: '(ANC-ARLP)/PL * 100',
        valor: iplValor !== null ? Number(iplValor.toFixed(1)) : 0,
        status: getIplStatus(iplValor),
        meta: 80,
        unidade: '%',
      },
      {
        nome: 'Imobiliz. Rec. Não Corr. (IRNC)',
        sigla: 'IRNC',
        formula: '(ANC-ARLP)/(PL+PNC) * 100',
        valor: irncValor !== null ? Number(irncValor.toFixed(1)) : 0,
        status: getIrncStatus(irncValor),
        meta: 80,
        unidade: '%',
      },
    ]
  }, [pctValor, ceValor, iplValor, irncValor])

  // Parecer Consolidado do Consultor
  const parecerConsolidado = useMemo(() => {
    if (!balancoAtual) return null

    const scoreVerdes = [
      getPctStatus(pctValor),
      getCeStatus(ceValor),
      getIplStatus(iplValor),
      getIrncStatus(irncValor),
    ].filter((s) => s === 'verde').length

    const scoreVermelhos = [
      getPctStatus(pctValor),
      getCeStatus(ceValor),
      getIplStatus(iplValor),
      getIrncStatus(irncValor),
    ].filter((s) => s === 'vermelho').length

    let titulo = ''
    let nivel: 'excelente' | 'adequado' | 'alerta' | 'critico' = 'adequado'
    let recomendacao = ''
    let detalhesPosicao = ''

    if (scoreVermelhos >= 2 || (pctValor !== null && pctValor > 250)) {
      nivel = 'critico'
      titulo = 'Estrutura de Endividamento com Alavancagem Excessiva e Alto Risco'
      detalhesPosicao = `No exercício de ${selectedAno}, a empresa ${selectedEmpresa?.nome || ''} opera com índices de endividamento em zona crítica. A Participação de Capital de Terceiros atinge ${formatPercent(pctValor, 1)} e a Composição do Endividamento está em ${formatPercent(ceValor, 1)}, indicando dependência severa de credores e forte pressão de vencimentos no curto prazo.`
      recomendacao =
        'Recomenda-se com urgência: 1) Reestruturar o perfil da dívida através do alongamento de prazos bancários; 2) Suspender novas imobilizações que não tenham retorno financeiro imediato; 3) Reter os lucros futuros para recompor o Patrimônio Líquido e reduzir a alavancagem; 4) Negociar carências com instituições financeiras para aliviar a carga de juros no curto prazo.'
    } else if (scoreVermelhos === 1 || scoreVerdes <= 2) {
      nivel = 'alerta'
      titulo = 'Endividamento Moderado com Pontos de Atenção na Gestão de Prazos'
      detalhesPosicao = `No exercício ${selectedAno}, a empresa apresenta nível de endividamento geral controlado, porém com pontos de atenção no perfil das exigibilidades (PCT: ${formatPercent(pctValor, 1)}, CE: ${formatPercent(ceValor, 1)}, IPL: ${formatPercent(iplValor, 1)}). A imobilização dos recursos e a proporção de dívidas de curto prazo demandam monitoramento próximo.`
      recomendacao =
        'Recomenda-se: 1) Direcionar linhas de crédito para prazos mais longos vinculados à vida útil dos investimentos; 2) Evitar financiar ativos permanentes com dívidas de curto prazo; 3) Controlar rigorosamente a necessidade de capital de giro (NCG).'
    } else if (scoreVerdes >= 3) {
      nivel = 'excelente'
      titulo = 'Excelente Estrutura de Endividamento e Baixo Risco Financeiro'
      detalhesPosicao = `A empresa ${selectedEmpresa?.nome || ''} encerrou o ano de ${selectedAno} com sólida gestão de passivos. Com PCT de ${formatPercent(pctValor, 1)}, CE de ${formatPercent(ceValor, 1)} e Imobilização do PL em ${formatPercent(iplValor, 1)}, a organização possui ampla autonomia financeira, mantendo a maior parte do capital próprio livre para apoiar a operação comercial.`
      recomendacao =
        'Recomenda-se: 1) Manter a disciplina na alocação de capital e reinvestimento dos lucros; 2) Aproveitar o baixo endividamento para negociar taxas de juros competitivas caso decida financiar novos projetos de expansão; 3) Continuar priorizando fontes de financiamento de longo prazo com custos atrativos.'
    } else {
      nivel = 'adequado'
      titulo = 'Endividamento Equilibrado e Compatível com as Práticas de Mercado'
      detalhesPosicao = `Em ${selectedAno}, a empresa demonstra equilíbrio no uso de recursos de terceiros versus capital próprio (PCT: ${formatPercent(pctValor, 1)}, CE: ${formatPercent(ceValor, 1)}, IRNC: ${formatPercent(irncValor, 1)}). Os ativos permanentes estão adequadamente amparados por fontes de financiamento perenes.`
      recomendacao =
        'Recomenda-se: 1) Acompanhar periodicamente a evolução das taxas de juros incidentes sobre empréstimos bancários; 2) Manter a proporção de passivos de curto prazo abaixo de 50% do total exigível.'
    }

    return {
      titulo,
      nivel,
      detalhesPosicao,
      recomendacao,
    }
  }, [balancoAtual, pctValor, ceValor, iplValor, irncValor, selectedEmpresa, selectedAno])

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

    csvContent += `RELATÓRIO DE INDICADORES DE ENDIVIDAMENTO\n`
    csvContent += `EMPRESA;${selectedEmpresa.nome}\n`
    csvContent += `CNPJ;${formatCnpj(selectedEmpresa.cnpj)}\n`
    csvContent += `SEGMENTO;${selectedEmpresa.segmento}\n`
    csvContent += `EXERCÍCIO;${selectedAno}\n`
    csvContent += `DATA DE EMISSÃO;${dataEmissao}\n\n`

    csvContent += `VALORES BASE EXTRAÍDOS DO BALANÇO (R$)\n`
    csvContent += `Ativo Total;${at.toFixed(2).replace('.', ',')}\n`
    csvContent += `Ativo Não Circulante (ANC);${anc.toFixed(2).replace('.', ',')}\n`
    csvContent += `Realizável a Longo Prazo (ARLP);${arlp.toFixed(2).replace('.', ',')}\n`
    csvContent += `Ativo Permanente (ANC - ARLP);${imobilizadoIntangivel.toFixed(2).replace('.', ',')}\n`
    csvContent += `Passivo Circulante (PC);${pc.toFixed(2).replace('.', ',')}\n`
    csvContent += `Passivo Não Circulante (PNC);${pnc.toFixed(2).replace('.', ',')}\n`
    csvContent += `Passivo Exigível Total (PC + PNC);${passivoTotal.toFixed(2).replace('.', ',')}\n`
    csvContent += `Patrimônio Líquido (PL);${pl.toFixed(2).replace('.', ',')}\n\n`

    csvContent += `INDICADORES CALCULADOS\n`
    csvContent += `Indicador;Sigla;Fórmula;Valor Calculado (%);Classificação;Interpretação Resumida\n`

    for (const ind of indicadores) {
      const valStr = ind.valor !== null ? ind.valor.toFixed(1).replace('.', ',') + '%' : 'N/D'
      const classStr =
        ind.status === 'verde'
          ? 'Verde (Favorável)'
          : ind.status === 'ambar'
            ? 'Âmbar (Atenção)'
            : ind.status === 'vermelho'
              ? 'Vermelho (Alerta)'
              : 'Indefinido'

      const interpClean = ind.interpretacao.replace(/\n/g, ' ').replace(/;/g, ',')
      csvContent += `${ind.nome};${ind.sigla};${ind.formula};${valStr};${classStr};${interpClean}\n`
    }

    if (parecerConsolidado) {
      csvContent += `\nPARECER DO CONSULTOR FINANCEIRO - DIAGNÓSTICO DE ENDIVIDAMENTO\n`
      csvContent += `Diagnóstico;${parecerConsolidado.titulo.replace(/;/g, ',')}\n`
      csvContent += `Análise Estrutural;${parecerConsolidado.detalhesPosicao.replace(/\n/g, ' ').replace(/;/g, ',')}\n`
      csvContent += `Recomendações Práticas;${parecerConsolidado.recomendacao.replace(/\n/g, ' ').replace(/;/g, ',')}\n`
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `indicadores-endividamento-${selectedEmpresa.nome.replace(/\s+/g, '-').toLowerCase()}-${selectedAno}.csv`
    link.click()
    URL.revokeObjectURL(link.href)

    toast({
      title: 'CSV exportado com sucesso!',
      description: `Arquivo de indicadores de endividamento (${selectedAno}) gerado com sucesso.`,
    })
  }

  // Cor do badge e status conforme o indicador
  const renderBadge = (
    id: 'pct' | 'ce' | 'ipl' | 'irnc',
    status: 'verde' | 'ambar' | 'vermelho' | 'indefinido',
  ) => {
    let textVerde = '🟢 ≤ 100%'
    let textAmbar = '🟠 100% – 200%'
    let textVermelho = '🔴 > 200%'

    if (id === 'ce') {
      textVerde = '🟢 ≤ 50%'
      textAmbar = '🟠 50% – 70%'
      textVermelho = '🔴 > 70%'
    } else if (id === 'ipl' || id === 'irnc') {
      textVerde = '🟢 ≤ 80%'
      textAmbar = '🟠 80% – 100%'
      textVermelho = '🔴 > 100%'
    }

    switch (status) {
      case 'verde':
        return (
          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-300 font-bold text-xs flex items-center gap-1.5 px-2.5 py-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            {textVerde}
          </Badge>
        )
      case 'ambar':
        return (
          <Badge className="bg-amber-50 text-amber-700 border-amber-300 font-bold text-xs flex items-center gap-1.5 px-2.5 py-1">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            {textAmbar}
          </Badge>
        )
      case 'vermelho':
        return (
          <Badge className="bg-red-50 text-red-700 border-red-300 font-bold text-xs flex items-center gap-1.5 px-2.5 py-1">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            {textVermelho}
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
        return '#10B981'
      case 'ambar':
        return '#F59E0B'
      case 'vermelho':
        return '#EF4444'
      default:
        return '#94A3B8'
    }
  }

  if (loading && !balancoAtual && balancos.length === 0) {
    return (
      <div className="py-20 flex flex-col justify-center items-center gap-3">
        <div className="w-9 h-9 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs text-slate-500 font-medium">
          Carregando indicadores de endividamento...
        </span>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fadeIn pb-10">
      {/* 1. Header com Título, Seletores e Exportação */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-lg shadow-md shadow-blue-600/20 shrink-0">
            <TrendingDown className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-extrabold text-[#0B1F3A] tracking-tight">
                Indicadores de Endividamento
              </h1>
              <Badge className="bg-blue-50 text-blue-700 border-blue-200 font-semibold text-xs">
                Análise de Passivos e Imobilização
              </Badge>
            </div>
            <p className="text-xs text-[#5B6B7F] mt-0.5">
              Diagnóstico do nível de alavancagem, perfil de vencimentos e comprometimento do
              capital próprio
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
            disabled={!balancoAtual}
            variant="outline"
            className="border-slate-300 text-slate-700 hover:bg-slate-100 font-semibold text-xs h-9 shadow-2xs"
          >
            <Download className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {/* Sem balanço cadastrado */}
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
          {/* 2. Resumo de Variáveis Extraídas do Balanço */}
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
                  Ativo Total (AT)
                </span>
                <span className="text-sm font-bold text-slate-900 block mt-0.5">
                  {formatCurrency(at)}
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
                  Passivo Não Circulante (PNC)
                </span>
                <span className="text-sm font-bold text-slate-900 block mt-0.5">
                  {formatCurrency(pnc)}
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                <span className="text-[10px] font-semibold text-slate-500 uppercase block truncate">
                  Passivo Exigível Total
                </span>
                <span className="text-sm font-bold text-red-600 block mt-0.5">
                  {formatCurrency(passivoTotal)}
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                <span className="text-[10px] font-semibold text-slate-500 uppercase block truncate">
                  Patrimônio Líquido (PL)
                </span>
                <span className="text-sm font-bold text-emerald-700 block mt-0.5">
                  {formatCurrency(pl)}
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                <span className="text-[10px] font-semibold text-slate-500 uppercase block truncate">
                  Ativo Permanente (ANC−ARLP)
                </span>
                <span className="text-sm font-bold text-slate-900 block mt-0.5">
                  {formatCurrency(imobilizadoIntangivel)}
                </span>
              </div>
            </div>
          </div>

          {/* 3. Cards Individuais dos 4 Indicadores */}
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

                      {renderBadge(ind.id, ind.status)}
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
                            {formatPercent(ind.valor, 1)}
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
                              ? 'Ocultar Valores Extraídos do Balanço'
                              : 'Expandir Detalhes do Cálculo'}
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

          {/* 4. Gráfico Comparativo: Gráfico de Barras Horizontais */}
          <Card className="bg-white border-slate-200 shadow-2xs">
            <CardHeader className="pb-2 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">
                    <BarChart3 className="w-4 h-4" />
                  </div>
                  <CardTitle className="text-base font-bold text-[#0B1F3A]">
                    Comparativo Visual dos Indicadores de Endividamento ({selectedAno})
                  </CardTitle>
                </div>
                <CardDescription className="text-xs mt-0.5">
                  Comparação dos 4 indicadores percentuais de endividamento e imobilização
                </CardDescription>
              </div>

              {/* Legenda */}
              <div className="flex items-center gap-3 text-[11px] font-semibold">
                <span className="flex items-center gap-1 text-emerald-700">
                  <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                  Adequado / Seguro
                </span>
                <span className="flex items-center gap-1 text-amber-700">
                  <span className="w-2.5 h-2.5 rounded-sm bg-amber-500" />
                  Atenção Moderada
                </span>
                <span className="flex items-center gap-1 text-red-700">
                  <span className="w-2.5 h-2.5 rounded-sm bg-red-500" />
                  Alerta / Elevado
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
                      domain={[0, (dataMax: number) => Math.max(120, Math.ceil(dataMax * 1.15))]}
                      tick={{ fontSize: 11, fill: '#64748B' }}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <YAxis
                      dataKey="sigla"
                      type="category"
                      tick={{ fontSize: 12, fill: '#0B1F3A', fontWeight: 700 }}
                      width={45}
                    />
                    <RechartsTooltip
                      formatter={(val: any, name: any, item: any) => [
                        `${formatPercent(Number(val), 1)} (${item.payload.nome})`,
                        'Percentual',
                      ]}
                      labelFormatter={(label: any) => `Indicador: ${label}`}
                    />
                    <ReferenceLine
                      x={100}
                      stroke="#EF4444"
                      strokeDasharray="4 4"
                      strokeWidth={1.5}
                      label={{
                        value: 'Limite 100%',
                        fill: '#EF4444',
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

              {/* Tabela Resumo */}
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
                      {formatPercent(d.valor, 1)}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 5. Análise Consolidada com Diagnóstico de Endividamento */}
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
                        Diagnóstico integrado de estrutura de passivos e solvência · Exercício{' '}
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
                    Diagnóstico: {parecerConsolidado.nivel.toUpperCase()}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="pt-5 space-y-4 text-xs leading-relaxed">
                <div className="bg-white/5 p-4 rounded-xl border border-white/10 space-y-1.5">
                  <span className="font-bold text-blue-300 uppercase tracking-wider text-[11px] block">
                    1. Diagnóstico do Nível de Endividamento
                  </span>
                  <p className="text-slate-200 leading-relaxed">
                    {parecerConsolidado.detalhesPosicao}
                  </p>
                </div>

                <div className="bg-white/5 p-4 rounded-xl border border-white/10 space-y-1.5">
                  <span className="font-bold text-emerald-300 uppercase tracking-wider text-[11px] block">
                    2. Recomendações Estratégicas e Desalavancagem
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
