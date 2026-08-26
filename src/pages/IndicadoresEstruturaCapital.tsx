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

interface IndicadorEstruturaInfo {
  id: 'eg' | 'af' | 'df' | 'de'
  nome: string
  sigla: string
  formula: string
  formulaExplicada: string
  descricaoCurta: string
  valor: number | null
  tipoValor: 'percentual' | 'multiplo'
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

export default function IndicadoresEstruturaCapital() {
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
    eg: false,
    af: false,
    df: false,
    de: false,
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
      console.error('Erro ao carregar balanços para indicadores de estrutura de capital:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar dados',
        description: 'Não foi possível buscar os balanços patrimoniais da empresa selecionada.',
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
  const pc = calcB.passivoCirculante
  const pnc = calcB.passivoNaoCirculante
  const pl = calcB.patrimonioLiquido
  const passivoTotal = pc + pnc
  const passivoTotalEPL = passivoTotal + pl // Total das fontes de capital

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

  // 1. Endividamento Geral (EG): (PC + PNC) / Ativo Total * 100
  // Badge: 🟢 <=50%, 🟠 50-70%, 🔴 >70%
  const egValor = at > 0 ? (passivoTotal / at) * 100 : null
  const getEgStatus = (val: number | null): 'verde' | 'ambar' | 'vermelho' | 'indefinido' => {
    if (val === null || isNaN(val)) return 'indefinido'
    if (val <= 50) return 'verde'
    if (val <= 70) return 'ambar'
    return 'vermelho'
  }

  // 2. Autonomia Financeira: PL / Ativo Total * 100
  // Badge: 🟢 >=50%, 🟠 30-50%, 🔴 <30%
  const afValor = at > 0 ? (pl / at) * 100 : null
  const getAfStatus = (val: number | null): 'verde' | 'ambar' | 'vermelho' | 'indefinido' => {
    if (val === null || isNaN(val)) return 'indefinido'
    if (val >= 50) return 'verde'
    if (val >= 30) return 'ambar'
    return 'vermelho'
  }

  // 3. Dependência Financeira: (PC + PNC) / (PC + PNC + PL) * 100
  // Badge: 🟢 <=50%, 🟠 50-70%, 🔴 >70%
  const dfValor = passivoTotalEPL > 0 ? (passivoTotal / passivoTotalEPL) * 100 : null
  const getDfStatus = (val: number | null): 'verde' | 'ambar' | 'vermelho' | 'indefinido' => {
    if (val === null || isNaN(val)) return 'indefinido'
    if (val <= 50) return 'verde'
    if (val <= 70) return 'ambar'
    return 'vermelho'
  }

  // 4. Relação Dívida/Equity: (PC + PNC) / PL
  // Badge: 🟢 <=0,5, 🟠 0,5-1,0, 🔴 >1,0
  const deValor = pl > 0 ? passivoTotal / pl : null
  const getDeStatus = (val: number | null): 'verde' | 'ambar' | 'vermelho' | 'indefinido' => {
    if (val === null || isNaN(val)) return 'indefinido'
    if (val <= 0.5) return 'verde'
    if (val <= 1.0) return 'ambar'
    return 'vermelho'
  }

  // Interpretações textuais (2 a 3 frases em português claro)
  const getInterpretacaoEG = (val: number | null): string => {
    if (val === null) {
      return 'Dados insuficientes de Ativo Total para apuração do Endividamento Geral.'
    }
    if (val <= 50) {
      return `O Endividamento Geral de ${formatPercent(val, 1)} demonstra que mais da metade dos ativos da empresa é financiada por capital próprio. Essa estrutura oferece ampla segurança contra volatilidades econômicas e reduz sensivelmente o risco financeiro perante o mercado. A organização possui excelente poder de solvência e capacidade de captação.`
    }
    if (val <= 70) {
      return `Com ${formatPercent(val, 1)} de endividamento geral, o capital de terceiros financia a maior parte dos ativos da organização. Trata-se de uma estrutura moderada e frequente em empresas de comércio e indústria em fase de expansão. É importante monitorar o custo médio da dívida para não erodir a rentabilidade líquida.`
    }
    return `O indicador de ${formatPercent(val, 1)} aponta elevado nível de endividamento geral, com credores financiando quase a totalidade dos ativos. Esse patamar aumenta a vulnerabilidade a variações na taxa básica de juros e encarece o crédito bancário. Recomenda-se um plano de desalavancagem e retenção integral dos lucros.`
  }

  const getInterpretacaoAF = (val: number | null): string => {
    if (val === null) {
      return 'Dados de Patrimônio Líquido indisponíveis para apuração da Autonomia Financeira.'
    }
    if (val >= 50) {
      return `A Autonomia Financeira de ${formatPercent(val, 1)} atesta que os sócios e acionistas garantem a maior parte dos recursos aplicados no ativo total. A independência em relação a bancos e fornecedores é alta, garantindo total soberania nas decisões de investimento. O risco de liquidação forçada é mínimo.`
    }
    if (val >= 30) {
      return `Com ${formatPercent(val, 1)} de autonomia financeira, o capital próprio representa uma fatia intermediária do financiamento dos ativos. Há um equilíbrio razoável entre recursos próprios e alavancagem externa. A gestão deve buscar o fortalecimento do patrimônio líquido por meio da incorporação de resultados positivos.`
    }
    return `Com apenas ${formatPercent(val, 1)} de capital próprio financiando os ativos totais, a empresa opera com baixa autonomia financeira e dependência crítica de recursos externos. Pequenas perdas operacionais podem comprometer severamente o patrimônio líquido remanescente. Torna-se prioritário capitalizar a empresa ou limitar novas contratações de dívidas.`
  }

  const getInterpretacaoDF = (val: number | null): string => {
    if (val === null) {
      return 'Dados insuficientes do somatório das fontes de capital para calcular a Dependência Financeira.'
    }
    if (val <= 50) {
      return `A Dependência Financeira de ${formatPercent(val, 1)} indica que menos da metade dos recursos totais da empresa provém de obrigações com terceiros. A empresa mantém controle equilibrado de suas fontes de financiamento, preservando a higidez patrimonial. A solvência global encontra-se em patamar muito confortável.`
    }
    if (val <= 70) {
      return `As exigibilidades com terceiros representam ${formatPercent(val, 1)} de todas as fontes de financiamento (Passivo + PL). A dependência é relevante, mas administrável desde que os fluxos operacionais permaneçam estáveis. Convém evitar o endividamento de curto prazo atrelado a juros pós-fixados elevados.`
    }
    return `Com ${formatPercent(val, 1)} de dependência financeira, as obrigações com terceiros dominam a estrutura de fontes da organização. A empresa está excessivamente exposta a exigências de credores e prazos de renovação de dívidas. Recomenda-se reestruturar os passivos e fortalecer os aportes societários.`
  }

  const getInterpretacaoDE = (val: number | null): string => {
    if (val === null) {
      return 'Dados de Patrimônio Líquido não disponíveis para cálculo da Relação Dívida/Equity.'
    }
    if (val <= 0.5) {
      return `Para cada R$ 1,00 de patrimônio líquido, a empresa possui apenas R$ ${formatNumber(val, 2)} em dívidas totais (relação D/E de ${formatNumber(val, 2)}x). Essa baixa alavancagem confere classificação de crédito de primeira linha e excelente margem de segurança. Os proprietários detêm o controle absoluto das decisões patrimoniais.`
    }
    if (val <= 1.0) {
      return `A relação Dívida/Equity de ${formatNumber(val, 2)}x indica que o volume de dívidas equivale a R$ ${formatNumber(val, 2)} por real de capital próprio. A estrutura é equilibrada e representa o patamar clássico de alavancagem saudável. A empresa se beneficia do efeito multiplicador do capital de terceiros sem assumir riscos desmedidos.`
    }
    return `Com Dívida/Equity de ${formatNumber(val, 2)}x, o endividamento total supera o capital próprio dos sócios (R$ ${formatNumber(val, 2)} de dívida para cada R$ 1,00 de PL). A alavancagem financeira é elevada e reduz a flexibilidade para obtenção de novos financiamentos em condições vantajosas. Sugere-se amortizar passivos onerosos.`
  }

  const indicadores: IndicadorEstruturaInfo[] = [
    {
      id: 'eg',
      nome: 'Endividamento Geral (EG)',
      sigla: 'EG',
      formula: '(PC + PNC) / Ativo Total × 100',
      formulaExplicada: '(Passivo Circulante + Passivo Não Circulante) ÷ Ativo Total × 100',
      descricaoCurta: 'Percentual do ativo total financiado por recursos de terceiros',
      valor: egValor,
      tipoValor: 'percentual',
      status: getEgStatus(egValor),
      interpretacao: getInterpretacaoEG(egValor),
      referencia: '≤ 50% (Ideal) · 50% a 70% (Moderado) · > 70% (Elevado)',
      variaveis: [
        {
          label: 'Passivo Circulante (PC)',
          sigla: 'PC',
          valor: pc,
          detalhes: 'Dívidas e obrigações com vencimento no curto prazo',
        },
        {
          label: 'Passivo Não Circulante (PNC)',
          sigla: 'PNC',
          valor: pnc,
          detalhes: 'Dívidas e financiamentos exigíveis a longo prazo',
        },
        {
          label: 'Passivo Exigível Total (PC + PNC)',
          sigla: 'Dívidas Totais',
          valor: passivoTotal,
          detalhes: 'Somatório de todas as obrigações com terceiros',
        },
        {
          label: 'Ativo Total (AT)',
          sigla: 'AT',
          valor: at,
          detalhes: 'Total de bens e direitos mantidos pela empresa',
        },
      ],
    },
    {
      id: 'af',
      nome: 'Autonomia Financeira',
      sigla: 'AF',
      formula: 'PL / Ativo Total × 100',
      formulaExplicada: 'Patrimônio Líquido ÷ Ativo Total × 100',
      descricaoCurta:
        'Independência em relação ao capital de terceiros e solidez do capital próprio',
      valor: afValor,
      tipoValor: 'percentual',
      status: getAfStatus(afValor),
      interpretacao: getInterpretacaoAF(afValor),
      referencia: '≥ 50% (Alta autonomia) · 30% a 50% (Moderada) · < 30% (Baixa)',
      variaveis: [
        {
          label: 'Patrimônio Líquido (PL)',
          sigla: 'PL',
          valor: pl,
          detalhes: 'Capital próprio, reservas de lucros e resultados acumulados',
        },
        {
          label: 'Ativo Total (AT)',
          sigla: 'AT',
          valor: at,
          detalhes: 'Total dos bens e direitos aplicados na atividade',
        },
      ],
    },
    {
      id: 'df',
      nome: 'Dependência Financeira',
      sigla: 'DF',
      formula: '(PC + PNC) / (PC + PNC + PL) × 100',
      formulaExplicada:
        '(Passivo Circulante + Passivo Não Circulante) ÷ (Passivo Total + PL) × 100',
      descricaoCurta: 'Proporção do capital de terceiros no total das fontes de recursos',
      valor: dfValor,
      tipoValor: 'percentual',
      status: getDfStatus(dfValor),
      interpretacao: getInterpretacaoDF(dfValor),
      referencia: '≤ 50% (Adequado) · 50% a 70% (Atenção) · > 70% (Elevada)',
      variaveis: [
        {
          label: 'Passivo Exigível Total (PC + PNC)',
          sigla: 'Dívidas Totais',
          valor: passivoTotal,
          detalhes: 'Recursos captados com fornecedores, bancos e terceiros',
        },
        {
          label: 'Patrimônio Líquido (PL)',
          sigla: 'PL',
          valor: pl,
          detalhes: 'Recursos próprios dos sócios/acionistas',
        },
        {
          label: 'Origens Totais de Recursos (PC + PNC + PL)',
          sigla: 'Passivo + PL',
          valor: passivoTotalEPL,
          detalhes: 'Totalidade dos recursos à disposição da empresa',
        },
      ],
    },
    {
      id: 'de',
      nome: 'Relação Dívida / Equity',
      sigla: 'D/E',
      formula: '(PC + PNC) / PL',
      formulaExplicada: '(Passivo Circulante + Passivo Não Circulante) ÷ Patrimônio Líquido',
      descricaoCurta:
        'Múltiplo de capital de terceiros utilizado para cada real de capital próprio',
      valor: deValor,
      tipoValor: 'multiplo',
      status: getDeStatus(deValor),
      interpretacao: getInterpretacaoDE(deValor),
      referencia: '≤ 0,50x (Conservador) · 0,50 a 1,00x (Equilibrado) · > 1,00x (Alavancado)',
      variaveis: [
        {
          label: 'Passivo Exigível Total (PC + PNC)',
          sigla: 'Dívidas',
          valor: passivoTotal,
          detalhes: 'Total de recursos de terceiros',
        },
        {
          label: 'Patrimônio Líquido (PL)',
          sigla: 'PL',
          valor: pl,
          detalhes: 'Capital próprio investido pelos acionistas',
        },
      ],
    },
  ]

  // Dados para o Gráfico Comparativo Horizontal
  const dadosGrafico = useMemo(() => {
    return [
      {
        nome: 'Endividamento Geral (EG)',
        sigla: 'EG',
        formula: '(PC+PNC)/AT * 100',
        valor: egValor !== null ? Number(egValor.toFixed(1)) : 0,
        status: getEgStatus(egValor),
        meta: 50,
        tipo: 'percentual',
      },
      {
        nome: 'Autonomia Financeira (AF)',
        sigla: 'AF',
        formula: 'PL/AT * 100',
        valor: afValor !== null ? Number(afValor.toFixed(1)) : 0,
        status: getAfStatus(afValor),
        meta: 50,
        tipo: 'percentual',
      },
      {
        nome: 'Dependência Financeira (DF)',
        sigla: 'DF',
        formula: 'Dívidas/(Dívidas+PL) * 100',
        valor: dfValor !== null ? Number(dfValor.toFixed(1)) : 0,
        status: getDfStatus(dfValor),
        meta: 50,
        tipo: 'percentual',
      },
      {
        nome: 'Dívida / Equity (D/E x50)',
        sigla: 'D/E (x50)',
        formula: 'Dívidas/PL (escala x50)',
        valor: deValor !== null ? Number((deValor * 50).toFixed(1)) : 0,
        valorReal: deValor !== null ? Number(deValor.toFixed(2)) : 0,
        status: getDeStatus(deValor),
        meta: 25,
        tipo: 'multiplo',
      },
    ]
  }, [egValor, afValor, dfValor, deValor])

  // Parecer Consolidado do Consultor
  const parecerConsolidado = useMemo(() => {
    if (!balancoAtual) return null

    const scoreVerdes = [
      getEgStatus(egValor),
      getAfStatus(afValor),
      getDfStatus(dfValor),
      getDeStatus(deValor),
    ].filter((s) => s === 'verde').length

    const scoreVermelhos = [
      getEgStatus(egValor),
      getAfStatus(afValor),
      getDfStatus(dfValor),
      getDeStatus(deValor),
    ].filter((s) => s === 'vermelho').length

    let titulo = ''
    let nivel: 'excelente' | 'adequado' | 'alerta' | 'critico' = 'adequado'
    let recomendacao = ''
    let detalhesPosicao = ''

    if (scoreVermelhos >= 2 || (egValor !== null && egValor > 75)) {
      nivel = 'critico'
      titulo = 'Estrutura de Capital Altamente Alavancada e com Baixa Autonomia'
      detalhesPosicao = `No exercício de ${selectedAno}, a empresa ${selectedEmpresa?.nome || ''} apresenta estrutura de capital pressionada por alto volume de recursos de terceiros (EG: ${formatPercent(egValor, 1)}, Autonomia Financeira: ${formatPercent(afValor, 1)}, Dívida/Equity: ${formatNumber(deValor, 2)}x). A dependência de credores limita a flexibilidade estratégica e onera o resultado com despesas financeiras.`
      recomendacao =
        'Recomenda-se com urgência: 1) Desenvolver um plano de amortização acelerada de dívidas com maiores encargos; 2) Reter 100% dos lucros gerados nos próximos exercícios para expansão da base de capital próprio; 3) Avaliar novo aporte de capital pelos sócios; 4) Negociar o alongamento de prazos para suavizar a pressão de desembolso.'
    } else if (scoreVermelhos === 1 || scoreVerdes <= 2) {
      nivel = 'alerta'
      titulo = 'Estrutura de Capital em Nível Moderado com Necessidade de Equilíbrio'
      detalhesPosicao = `Em ${selectedAno}, a empresa exibe estrutura de financiamento intermediária (EG: ${formatPercent(egValor, 1)}, Autonomia: ${formatPercent(afValor, 1)}, D/E: ${formatNumber(deValor, 2)}x). Embora haja sustentabilidade no curto prazo, a proporção de capital de terceiros aproxima-se dos limites de cautela.`
      recomendacao =
        'Recomenda-se: 1) Priorizar a geração orgânica de caixa para financiar investimentos adicionais; 2) Manter a relação Dívida/Equity abaixo de 1,00x; 3) Monitorar o custo efetivo de captação frente à rentabilidade do ativo (ROA).'
    } else if (scoreVerdes >= 3) {
      nivel = 'excelente'
      titulo = 'Excelente Solidez de Capital e Alta Autonomia Financeira'
      detalhesPosicao = `A empresa ${selectedEmpresa?.nome || ''} encerrou o ano de ${selectedAno} com estrutura de capital extremamente sólida. Com Autonomia Financeira de ${formatPercent(afValor, 1)}, Endividamento Geral de ${formatPercent(egValor, 1)} e Dívida/Equity em ${formatNumber(deValor, 2)}x, a organização possui independência estratégica perante o sistema bancário e robusta blindagem patrimonial.`
      recomendacao =
        'Recomenda-se: 1) Manter a disciplina na governança de capital; 2) Utilizar a forte classificação de crédito para obter linhas de financiamento de longo prazo com juros reduzidos para projetos de expansão; 3) Preservar a participação do capital próprio acima de 50% do ativo total.'
    } else {
      nivel = 'adequado'
      titulo = 'Estrutura de Capital Equilibrada e Alinhada com as Boas Práticas'
      detalhesPosicao = `No exercício de ${selectedAno}, a empresa opera com divisão harmoniosa entre capital próprio e recursos de terceiros (EG: ${formatPercent(egValor, 1)}, Autonomia: ${formatPercent(afValor, 1)}, D/E: ${formatNumber(deValor, 2)}x). As fontes de financiamento mostram-se proporcionais ao tamanho dos ativos.`
      recomendacao =
        'Recomenda-se: 1) Manter a cadência de reinvestimento de lucros operacionais; 2) Acompanhar o índice de alavancagem para que não ultrapasse a capacidade de geração de EBITDA.'
    }

    return {
      titulo,
      nivel,
      detalhesPosicao,
      recomendacao,
    }
  }, [balancoAtual, egValor, afValor, dfValor, deValor, selectedEmpresa, selectedAno])

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

    csvContent += `RELATÓRIO DE INDICADORES DE ESTRUTURA DE CAPITAL\n`
    csvContent += `EMPRESA;${selectedEmpresa.nome}\n`
    csvContent += `CNPJ;${formatCnpj(selectedEmpresa.cnpj)}\n`
    csvContent += `SEGMENTO;${selectedEmpresa.segmento}\n`
    csvContent += `EXERCÍCIO;${selectedAno}\n`
    csvContent += `DATA DE EMISSÃO;${dataEmissao}\n\n`

    csvContent += `VALORES BASE EXTRAÍDOS DO BALANÇO (R$)\n`
    csvContent += `Ativo Total (AT);${at.toFixed(2).replace('.', ',')}\n`
    csvContent += `Passivo Circulante (PC);${pc.toFixed(2).replace('.', ',')}\n`
    csvContent += `Passivo Não Circulante (PNC);${pnc.toFixed(2).replace('.', ',')}\n`
    csvContent += `Passivo Exigível Total (PC + PNC);${passivoTotal.toFixed(2).replace('.', ',')}\n`
    csvContent += `Patrimônio Líquido (PL);${pl.toFixed(2).replace('.', ',')}\n`
    csvContent += `Origens Totais (PC + PNC + PL);${passivoTotalEPL.toFixed(2).replace('.', ',')}\n\n`

    csvContent += `INDICADORES CALCULADOS\n`
    csvContent += `Indicador;Sigla;Fórmula;Valor Calculado;Classificação;Interpretação Resumida\n`

    for (const ind of indicadores) {
      let valStr = 'N/D'
      if (ind.valor !== null) {
        valStr =
          ind.tipoValor === 'percentual'
            ? ind.valor.toFixed(1).replace('.', ',') + '%'
            : ind.valor.toFixed(2).replace('.', ',') + 'x'
      }

      const classStr =
        ind.status === 'verde'
          ? 'Verde (Adequado/Sólido)'
          : ind.status === 'ambar'
            ? 'Âmbar (Moderado)'
            : ind.status === 'vermelho'
              ? 'Vermelho (Alerta)'
              : 'Indefinido'

      const interpClean = ind.interpretacao.replace(/\n/g, ' ').replace(/;/g, ',')
      csvContent += `${ind.nome};${ind.sigla};${ind.formula};${valStr};${classStr};${interpClean}\n`
    }

    if (parecerConsolidado) {
      csvContent += `\nPARECER DO CONSULTOR FINANCEIRO - DIAGNÓSTICO DE ESTRUTURA DE CAPITAL\n`
      csvContent += `Diagnóstico;${parecerConsolidado.titulo.replace(/;/g, ',')}\n`
      csvContent += `Análise de Solidez;${parecerConsolidado.detalhesPosicao.replace(/\n/g, ' ').replace(/;/g, ',')}\n`
      csvContent += `Recomendações Práticas;${parecerConsolidado.recomendacao.replace(/\n/g, ' ').replace(/;/g, ',')}\n`
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `indicadores-estrutura-capital-${selectedEmpresa.nome.replace(/\s+/g, '-').toLowerCase()}-${selectedAno}.csv`
    link.click()
    URL.revokeObjectURL(link.href)

    toast({
      title: 'CSV exportado com sucesso!',
      description: `Arquivo de indicadores de estrutura de capital (${selectedAno}) gerado com sucesso.`,
    })
  }

  // Cor do badge e status
  const renderBadge = (
    id: 'eg' | 'af' | 'df' | 'de',
    status: 'verde' | 'ambar' | 'vermelho' | 'indefinido',
  ) => {
    let textVerde = '🟢 ≤ 50%'
    let textAmbar = '🟠 50% – 70%'
    let textVermelho = '🔴 > 70%'

    if (id === 'af') {
      textVerde = '🟢 ≥ 50%'
      textAmbar = '🟠 30% – 50%'
      textVermelho = '🔴 < 30%'
    } else if (id === 'de') {
      textVerde = '🟢 ≤ 0,5'
      textAmbar = '🟠 0,5 – 1,0'
      textVermelho = '🔴 > 1,0'
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
          Carregando indicadores de estrutura de capital...
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
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-extrabold text-[#0B1F3A] tracking-tight">
                Indicadores de Estrutura de Capital
              </h1>
              <Badge className="bg-blue-50 text-blue-700 border-blue-200 font-semibold text-xs">
                Solidez &amp; Autonomia
              </Badge>
            </div>
            <p className="text-xs text-[#5B6B7F] mt-0.5">
              Diagnóstico de endividamento geral, autonomia patrimonial, dependência e relação
              Dívida/Equity
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
                  Fontes Totais (Passivo+PL)
                </span>
                <span className="text-sm font-bold text-blue-700 block mt-0.5">
                  {formatCurrency(passivoTotalEPL)}
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
                            {ind.tipoValor === 'percentual'
                              ? formatPercent(ind.valor, 1)
                              : `${formatNumber(ind.valor, 2)}x`}
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
                    Comparativo Visual dos Indicadores de Estrutura de Capital ({selectedAno})
                  </CardTitle>
                </div>
                <CardDescription className="text-xs mt-0.5">
                  Comparação de Endividamento Geral, Autonomia, Dependência e Dívida/Equity (escala
                  x50)
                </CardDescription>
              </div>

              {/* Legenda */}
              <div className="flex items-center gap-3 text-[11px] font-semibold">
                <span className="flex items-center gap-1 text-emerald-700">
                  <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                  Sólido / Seguro
                </span>
                <span className="flex items-center gap-1 text-amber-700">
                  <span className="w-2.5 h-2.5 rounded-sm bg-amber-500" />
                  Moderado
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
                      domain={[0, (dataMax: number) => Math.max(100, Math.ceil(dataMax * 1.15))]}
                      tick={{ fontSize: 11, fill: '#64748B' }}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <YAxis
                      dataKey="sigla"
                      type="category"
                      tick={{ fontSize: 12, fill: '#0B1F3A', fontWeight: 700 }}
                      width={70}
                    />
                    <RechartsTooltip
                      formatter={(val: any, name: any, item: any) => [
                        item.payload.tipo === 'multiplo'
                          ? `${item.payload.valorReal}x (${item.payload.nome})`
                          : `${formatPercent(Number(val), 1)} (${item.payload.nome})`,
                        'Estrutura',
                      ]}
                      labelFormatter={(label: any) => `Indicador: ${label}`}
                    />
                    <ReferenceLine
                      x={50}
                      stroke="#2563EB"
                      strokeDasharray="4 4"
                      strokeWidth={1.5}
                      label={{
                        value: 'Equilíbrio: 50%',
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

              {/* Tabela Resumo */}
              <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                {indicadores.map((d, i) => (
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
                      {d.tipoValor === 'percentual'
                        ? formatPercent(d.valor, 1)
                        : `${formatNumber(d.valor, 2)}x`}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 5. Análise Consolidada com Diagnóstico de Estrutura de Capital */}
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
                        Diagnóstico integrado de autonomia patrimonial, solidez e alavancagem ·
                        Exercício {selectedAno}
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
                    1. Diagnóstico de Solidez e Independência Patrimonial
                  </span>
                  <p className="text-slate-200 leading-relaxed">
                    {parecerConsolidado.detalhesPosicao}
                  </p>
                </div>

                <div className="bg-white/5 p-4 rounded-xl border border-white/10 space-y-1.5">
                  <span className="font-bold text-emerald-300 uppercase tracking-wider text-[11px] block">
                    2. Recomendações Estratégicas para Composição de Capital
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
