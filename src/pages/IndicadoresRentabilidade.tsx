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
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface IndicadorRentabilidadeInfo {
  id: 'roe' | 'roa' | 'margemLiquida' | 'giroAtivo'
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

export default function IndicadoresRentabilidade() {
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
    roe: false,
    roa: false,
    margemLiquida: false,
    giroAtivo: false,
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
      console.error('Erro ao carregar balanços e DRE para indicadores de rentabilidade:', err)
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

  // Variáveis contábeis
  const at = calcB.ativoTotal
  const pl = calcB.patrimonioLiquido
  const rl = calcD.receitaLiquida
  const ll = calcD.lucroLiquido
  const lb = calcD.lucroBruto
  const ro = calcD.resultadoOperacional

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

  // 1. ROE (Return on Equity): LL / PL * 100
  // Badge: 🟢 >=15%, 🟠 5-15%, 🔴 <5%
  const roeValor = pl > 0 ? (ll / pl) * 100 : null
  const getRoeStatus = (val: number | null): 'verde' | 'ambar' | 'vermelho' | 'indefinido' => {
    if (val === null || isNaN(val)) return 'indefinido'
    if (val >= 15) return 'verde'
    if (val >= 5) return 'ambar'
    return 'vermelho'
  }

  // 2. ROA (Return on Assets): LL / Ativo Total * 100
  // Badge: 🟢 >=8%, 🟠 3-8%, 🔴 <3%
  const roaValor = at > 0 ? (ll / at) * 100 : null
  const getRoaStatus = (val: number | null): 'verde' | 'ambar' | 'vermelho' | 'indefinido' => {
    if (val === null || isNaN(val)) return 'indefinido'
    if (val >= 8) return 'verde'
    if (val >= 3) return 'ambar'
    return 'vermelho'
  }

  // 3. Margem Líquida: LL / Receita Líquida * 100
  // Badge: 🟢 >=10%, 🟠 5-10%, 🔴 <5%
  const mlValor = rl !== 0 ? (ll / rl) * 100 : null
  const getMlStatus = (val: number | null): 'verde' | 'ambar' | 'vermelho' | 'indefinido' => {
    if (val === null || isNaN(val)) return 'indefinido'
    if (val >= 10) return 'verde'
    if (val >= 5) return 'ambar'
    return 'vermelho'
  }

  // 4. Giro do Ativo: Receita Líquida / Ativo Total
  // Badge: 🟢 >=1,0, 🟠 0,5-1,0, 🔴 <0,5
  const giroValor = at > 0 ? rl / at : null
  const getGiroStatus = (val: number | null): 'verde' | 'ambar' | 'vermelho' | 'indefinido' => {
    if (val === null || isNaN(val)) return 'indefinido'
    if (val >= 1.0) return 'verde'
    if (val >= 0.5) return 'ambar'
    return 'vermelho'
  }

  // Interpretações textuais (2 a 3 frases em português claro)
  const getInterpretacaoROE = (val: number | null): string => {
    if (val === null) {
      return 'Dados insuficientes de Patrimônio Líquido para o cálculo do ROE no exercício.'
    }
    if (val >= 15) {
      return `O Retorno sobre o Patrimônio Líquido de ${formatPercent(val, 1)} demonstra excelente remuneração do capital investido pelos sócios, superando o custo de oportunidade de mercado (~10% a.a.). A cada R$ 100,00 de patrimônio próprio, a organização gerou R$ ${formatNumber(val, 2)} em lucro líquido. A empresa comprova forte poder de criação de valor para seus acionistas.`
    }
    if (val >= 5) {
      return `Com ROE de ${formatPercent(val, 1)}, a rentabilidade sobre o capital dos sócios situa-se em patamar moderado. A remuneração é positiva, porém próxima das taxas de ativos de renda fixa sem risco. Sugere-se avaliar estratégias para aumentar o giro ou otimizar a margem líquida para alavancar os ganhos dos acionistas.`
    }
    if (val >= 0) {
      return `O ROE de ${formatPercent(val, 1)} sinaliza baixa atratividade do capital próprio investido no negócio. O rendimento obtido está aquém da taxa básica de juros, indicando subaproveitamento dos recursos dos proprietários. É necessário rever a estrutura de custos e despesas para recompor o resultado líquido.`
    }
    return `O ROE negativo de ${formatPercent(val, 1)} reflete destruição do patrimônio líquido devido ao prejuízo apurado de ${formatCurrency(ll)}. A continuidade operacional exigirá reestruturação urgente do modelo de negócios para estancar a queima de capital próprio.`
  }

  const getInterpretacaoROA = (val: number | null): string => {
    if (val === null) {
      return 'Dados insuficientes de Ativo Total para o cálculo do ROA no exercício.'
    }
    if (val >= 8) {
      return `O Retorno sobre o Ativo de ${formatPercent(val, 1)} comprova alta eficiência na conversão dos bens e direitos totais da empresa em lucro líquido. Para cada R$ 100,00 aplicados no ativo global, foram obtidos R$ ${formatNumber(val, 2)} de resultado líquido. Essa performance reflete gestão operacional e de investimentos de alto nível.`
    }
    if (val >= 3) {
      return `O ROA apurado em ${formatPercent(val, 1)} indica aproveitamento intermediário dos ativos totais da organização. A empresa gera retorno econômico sustentável, mas há espaço para acelerar a monetização dos recursos imobilizados ou do capital de giro. Acompanhar a ociosidade dos ativos é recomendável.`
    }
    if (val >= 0) {
      return `Com índice de ${formatPercent(val, 1)}, os ativos da empresa apresentam baixa produtividade na geração de lucro final. Grande volume de recursos encontra-se empregado para um retorno líquido proporcionalmente modesto. Avaliar a venda de ativos ociosos ou a readequação de estoques pode elevar este índice.`
    }
    return `O ROA negativo de ${formatPercent(val, 1)} confirma que a base total de ativos operou com prejuízo líquido no exercício. O custo de manter a estrutura de ativos superou a capacidade de geração de receita da operação.`
  }

  const getInterpretacaoML = (val: number | null): string => {
    if (val === null) {
      return 'Dados de Receita Líquida indisponíveis para apuração da Margem Líquida.'
    }
    if (val >= 10) {
      return `A Margem Líquida de ${formatPercent(val, 1)} evidencia grande poder de precificação e controle rigoroso de custos e despesas operacionais. De cada R$ 100,00 faturados líquidos, restam R$ ${formatNumber(val, 2)} livres como lucro para a empresa. Essa folga confere ampla blindagem contra volatilidades de mercado.`
    }
    if (val >= 5) {
      return `Com ${formatPercent(val, 1)} de margem líquida, a empresa converte adequadamente suas receitas em resultado, mantendo padrão típico dos segmentos comerciais e de serviços competitivos. A margem oferece segurança razoável, porém requer disciplina contínua com despesas financeiras e tributárias.`
    }
    if (val >= 0) {
      return `A Margem Líquida de ${formatPercent(val, 1)} revela que a maior parte da receita bruta é consumida por custos operacionais, tributos e encargos financeiros. Qualquer redução no volume de vendas ou aumento de custos pode levar o resultado ao território negativo. É prudente auditar os centros de custos.`
    }
    return `Com margem negativa de ${formatPercent(val, 1)}, a empresa encerrou o período operando no prejuízo. A receita gerada foi insuficiente para absorver os custos mercantis, despesas de vendas e encargos do exercício.`
  }

  const getInterpretacaoGiro = (val: number | null): string => {
    if (val === null) {
      return 'Dados de faturamento ou ativos insuficientes para o cálculo do Giro do Ativo.'
    }
    if (val >= 1.0) {
      return `O Giro do Ativo de ${formatNumber(val, 2)} vezes demonstra alta velocidade de renovação e dinamismo comercial. Para cada R$ 1,00 de ativo total mantido pela empresa, foram gerados R$ ${formatNumber(val, 2)} em receita líquida no ano. Essa eficiência maximiza a rentabilidade final combinando giro rápido com margens saudáveis.`
    }
    if (val >= 0.5) {
      return `Com giro de ${formatNumber(val, 2)}x ao ano, a empresa apresenta produtividade moderada dos ativos, padrão compatível com indústrias e operações de capital intensivo. Há potencial para otimizar os prazos de recebimento e acelerar o giro dos estoques para impulsionar a receita.`
    }
    return `O Giro do Ativo em ${formatNumber(val, 2)}x indica ritmo lento na conversão dos ativos em faturamento anual. A estrutura pode estar sobredimensionada em relação ao volume de vendas atual ou com estoques parados. Recomenda-se ações comerciais para expandir o mercado e elevar a utilização dos ativos.`
  }

  const indicadores: IndicadorRentabilidadeInfo[] = [
    {
      id: 'roe',
      nome: 'ROE (Return on Equity)',
      sigla: 'ROE',
      formula: 'LL / PL × 100',
      formulaExplicada: 'Lucro Líquido ÷ Patrimônio Líquido × 100',
      descricaoCurta: 'Retorno gerado sobre o capital próprio investido pelos sócios',
      valor: roeValor,
      tipoValor: 'percentual',
      status: getRoeStatus(roeValor),
      interpretacao: getInterpretacaoROE(roeValor),
      referencia: '≥ 15% (Excelente) · 5% a 15% (Adequado)',
      variaveis: [
        {
          label: 'Lucro Líquido do Exercício (LL)',
          sigla: 'LL',
          valor: ll,
          detalhes: 'Resultado líquido final apurado na DRE após tributos',
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
      id: 'roa',
      nome: 'ROA (Return on Assets)',
      sigla: 'ROA',
      formula: 'LL / Ativo Total × 100',
      formulaExplicada: 'Lucro Líquido ÷ Ativo Total × 100',
      descricaoCurta: 'Eficiência global na geração de lucro a partir de todos os ativos',
      valor: roaValor,
      tipoValor: 'percentual',
      status: getRoaStatus(roaValor),
      interpretacao: getInterpretacaoROA(roaValor),
      referencia: '≥ 8% (Excelente) · 3% a 8% (Adequado)',
      variaveis: [
        {
          label: 'Lucro Líquido (LL)',
          sigla: 'LL',
          valor: ll,
          detalhes: 'Resultado final disponível no exercício',
        },
        {
          label: 'Ativo Total (AT)',
          sigla: 'AT',
          valor: at,
          detalhes: 'Total de bens e direitos circulantes e não circulantes',
        },
      ],
    },
    {
      id: 'margemLiquida',
      nome: 'Margem Líquida',
      sigla: 'ML',
      formula: 'LL / Receita Líquida × 100',
      formulaExplicada: 'Lucro Líquido ÷ Receita Líquida de Vendas × 100',
      descricaoCurta: 'Percentual de cada real faturado que se transforma em lucro',
      valor: mlValor,
      tipoValor: 'percentual',
      status: getMlStatus(mlValor),
      interpretacao: getInterpretacaoML(mlValor),
      referencia: '≥ 10% (Excelente) · 5% a 10% (Adequado)',
      variaveis: [
        {
          label: 'Receita Líquida (RL)',
          sigla: 'RL',
          valor: rl,
          detalhes: 'Faturamento bruto deduzido de tributos, abatimentos e devoluções',
        },
        {
          label: 'Lucro Bruto (LB)',
          sigla: 'LB',
          valor: lb,
          detalhes: 'Receita Líquida menos custos das mercadorias/serviços (CMV)',
        },
        {
          label: 'Resultado Operacional (EBIT)',
          sigla: 'RO',
          valor: ro,
          detalhes: 'Lucro Bruto menos despesas administrativas e comerciais',
        },
        {
          label: 'Lucro Líquido (LL)',
          sigla: 'LL',
          valor: ll,
          detalhes: 'Resultado líquido final após resultado financeiro e tributos',
        },
      ],
    },
    {
      id: 'giroAtivo',
      nome: 'Giro do Ativo',
      sigla: 'GA',
      formula: 'Receita Líquida / Ativo Total',
      formulaExplicada: 'Receita Líquida de Vendas ÷ Ativo Total',
      descricaoCurta: 'Eficiência e velocidade no uso dos ativos para gerar receitas',
      valor: giroValor,
      tipoValor: 'multiplo',
      status: getGiroStatus(giroValor),
      interpretacao: getInterpretacaoGiro(giroValor),
      referencia: '≥ 1,00x (Excelente) · 0,50 a 1,00x (Adequado)',
      variaveis: [
        {
          label: 'Receita Líquida (RL)',
          sigla: 'RL',
          valor: rl,
          detalhes: 'Volume total de vendas líquidas do ano',
        },
        {
          label: 'Ativo Total (AT)',
          sigla: 'AT',
          valor: at,
          detalhes: 'Base total de investimentos aplicados no negócio',
        },
      ],
    },
  ]

  // Dados para o Gráfico Comparativo Horizontal
  const dadosGrafico = useMemo(() => {
    return [
      {
        nome: 'ROE (Return on Equity)',
        sigla: 'ROE',
        formula: 'LL / PL * 100',
        valor: roeValor !== null ? Number(roeValor.toFixed(1)) : 0,
        status: getRoeStatus(roeValor),
        meta: 15,
        tipo: 'percentual',
      },
      {
        nome: 'ROA (Return on Assets)',
        sigla: 'ROA',
        formula: 'LL / AT * 100',
        valor: roaValor !== null ? Number(roaValor.toFixed(1)) : 0,
        status: getRoaStatus(roaValor),
        meta: 8,
        tipo: 'percentual',
      },
      {
        nome: 'Margem Líquida',
        sigla: 'ML',
        formula: 'LL / RL * 100',
        valor: mlValor !== null ? Number(mlValor.toFixed(1)) : 0,
        status: getMlStatus(mlValor),
        meta: 10,
        tipo: 'percentual',
      },
      {
        nome: 'Giro do Ativo (x10)',
        sigla: 'GA (x10)',
        formula: 'RL / AT (escala x10)',
        valor: giroValor !== null ? Number((giroValor * 10).toFixed(1)) : 0,
        valorReal: giroValor !== null ? Number(giroValor.toFixed(2)) : 0,
        status: getGiroStatus(giroValor),
        meta: 10,
        tipo: 'multiplo',
      },
    ]
  }, [roeValor, roaValor, mlValor, giroValor])

  // Parecer Consolidado do Consultor
  const parecerConsolidado = useMemo(() => {
    if (!balancoAtual && !dreAtual) return null

    const scoreVerdes = [
      getRoeStatus(roeValor),
      getRoaStatus(roaValor),
      getMlStatus(mlValor),
      getGiroStatus(giroValor),
    ].filter((s) => s === 'verde').length

    const scoreVermelhos = [
      getRoeStatus(roeValor),
      getRoaStatus(roaValor),
      getMlStatus(mlValor),
      getGiroStatus(giroValor),
    ].filter((s) => s === 'vermelho').length

    let titulo = ''
    let nivel: 'excelente' | 'adequado' | 'alerta' | 'critico' = 'adequado'
    let recomendacao = ''
    let detalhesPosicao = ''

    if (ll < 0 || scoreVermelhos >= 2) {
      nivel = 'critico'
      titulo = 'Rentabilidade em Zona Crítica e Necessidade de Revisão Operacional'
      detalhesPosicao = `No exercício de ${selectedAno}, a empresa ${selectedEmpresa?.nome || ''} registrou desempenho de rentabilidade insatisfatório (Lucro Líquido: ${formatCurrency(ll)}, Margem Líquida: ${formatPercent(mlValor, 1)}, ROE: ${formatPercent(roeValor, 1)}). Os custos e despesas operacionais comprometeram a geração de valor sobre o capital investido.`
      recomendacao =
        'Recomenda-se com urgência: 1) Reavaliar a margem de contribuição por linha de produto/serviço e cortar itens deficitários; 2) Renegociar tabelas de preços com fornecedores para reduzir o CMV; 3) Conter despesas fixas e despesas financeiras; 4) Implementar metas de vendas com foco em margem líquida e não apenas faturamento bruto.'
    } else if (scoreVermelhos === 1 || scoreVerdes <= 2) {
      nivel = 'alerta'
      titulo = 'Rentabilidade Moderada com Potencial de Otimização de Margens'
      detalhesPosicao = `No exercício ${selectedAno}, a empresa opera com rentabilidade positiva (ROE: ${formatPercent(roeValor, 1)}, ROA: ${formatPercent(roaValor, 1)}, Margem Líquida: ${formatPercent(mlValor, 1)}), porém abaixo do potencial pleno de seu segmento. O giro dos ativos (${formatNumber(giroValor, 2)}x) demonstra que há espaço para aumentar o faturamento sem expansão proporcional da estrutura fixa.`
      recomendacao =
        'Recomenda-se: 1) Explorar canais de venda com maior valor agregado; 2) Acelerar o giro de estoques e prazos de recebimento para potencializar o ROA; 3) Otimizar a gestão tributária para reduzir o impacto fiscal sobre o lucro líquido.'
    } else if (scoreVerdes >= 3) {
      nivel = 'excelente'
      titulo = 'Excelente Rentabilidade e Alta Capacidade de Geração de Lucros'
      detalhesPosicao = `A empresa ${selectedEmpresa?.nome || ''} encerrou o ano de ${selectedAno} com indicadores de rentabilidade excepcionais. Com ROE de ${formatPercent(roeValor, 1)}, ROA de ${formatPercent(roaValor, 1)} e Margem Líquida de ${formatPercent(mlValor, 1)}, a organização remunera com grande folga o capital próprio dos acionistas e converte vendas em resultados reais com extrema eficiência.`
      recomendacao =
        'Recomenda-se: 1) Reinvestir parte dos lucros em modernização tecnológica e expansão de capacidade para sustentar a vantagem competitiva; 2) Manter a disciplina de precificação e controle de custos; 3) Avaliar a distribuição planejada de dividendos mantendo reserva para contingências.'
    } else {
      nivel = 'adequado'
      titulo = 'Rentabilidade Equilibrada e Alinhada com os Padrões Setoriais'
      detalhesPosicao = `No exercício de ${selectedAno}, a empresa manteve rentabilidade equilibrada (ROE: ${formatPercent(roeValor, 1)}, ROA: ${formatPercent(roaValor, 1)}, Margem Líquida: ${formatPercent(mlValor, 1)}, Giro: ${formatNumber(giroValor, 2)}x). A operação é sustentável e cobre satisfatoriamente as expectativas de retorno dos proprietários.`
      recomendacao =
        'Recomenda-se: 1) Monitorar mensalmente a evolução das despesas comerciais e administrativas; 2) Buscar ganhos incrementais de produtividade nos ativos para elevar gradualmente o ROA acima de 8%.'
    }

    return {
      titulo,
      nivel,
      detalhesPosicao,
      recomendacao,
    }
  }, [
    balancoAtual,
    dreAtual,
    roeValor,
    roaValor,
    mlValor,
    giroValor,
    ll,
    selectedEmpresa,
    selectedAno,
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

    csvContent += `RELATÓRIO DE INDICADORES DE RENTABILIDADE\n`
    csvContent += `EMPRESA;${selectedEmpresa.nome}\n`
    csvContent += `CNPJ;${formatCnpj(selectedEmpresa.cnpj)}\n`
    csvContent += `SEGMENTO;${selectedEmpresa.segmento}\n`
    csvContent += `EXERCÍCIO;${selectedAno}\n`
    csvContent += `DATA DE EMISSÃO;${dataEmissao}\n\n`

    csvContent += `VALORES BASE EXTRAÍDOS DO BALANÇO E DRE (R$)\n`
    csvContent += `Receita Líquida (RL);${rl.toFixed(2).replace('.', ',')}\n`
    csvContent += `Lucro Bruto (LB);${lb.toFixed(2).replace('.', ',')}\n`
    csvContent += `Resultado Operacional (EBIT);${ro.toFixed(2).replace('.', ',')}\n`
    csvContent += `Lucro Líquido (LL);${ll.toFixed(2).replace('.', ',')}\n`
    csvContent += `Ativo Total (AT);${at.toFixed(2).replace('.', ',')}\n`
    csvContent += `Patrimônio Líquido (PL);${pl.toFixed(2).replace('.', ',')}\n\n`

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
          ? 'Verde (Excelente)'
          : ind.status === 'ambar'
            ? 'Âmbar (Adequado)'
            : ind.status === 'vermelho'
              ? 'Vermelho (Alerta)'
              : 'Indefinido'

      const interpClean = ind.interpretacao.replace(/\n/g, ' ').replace(/;/g, ',')
      csvContent += `${ind.nome};${ind.sigla};${ind.formula};${valStr};${classStr};${interpClean}\n`
    }

    if (parecerConsolidado) {
      csvContent += `\nPARECER DO CONSULTOR FINANCEIRO - DIAGNÓSTICO DE RENTABILIDADE\n`
      csvContent += `Diagnóstico;${parecerConsolidado.titulo.replace(/;/g, ',')}\n`
      csvContent += `Análise de Retorno;${parecerConsolidado.detalhesPosicao.replace(/\n/g, ' ').replace(/;/g, ',')}\n`
      csvContent += `Recomendações Práticas;${parecerConsolidado.recomendacao.replace(/\n/g, ' ').replace(/;/g, ',')}\n`
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `indicadores-rentabilidade-${selectedEmpresa.nome.replace(/\s+/g, '-').toLowerCase()}-${selectedAno}.csv`
    link.click()
    URL.revokeObjectURL(link.href)

    toast({
      title: 'CSV exportado com sucesso!',
      description: `Arquivo de indicadores de rentabilidade (${selectedAno}) gerado com sucesso.`,
    })
  }

  // Cor do badge e status
  const renderBadge = (
    id: 'roe' | 'roa' | 'margemLiquida' | 'giroAtivo',
    status: 'verde' | 'ambar' | 'vermelho' | 'indefinido',
  ) => {
    let textVerde = '🟢 ≥ 15%'
    let textAmbar = '🟠 5% – 15%'
    let textVermelho = '🔴 < 5%'

    if (id === 'roa') {
      textVerde = '🟢 ≥ 8%'
      textAmbar = '🟠 3% – 8%'
      textVermelho = '🔴 < 3%'
    } else if (id === 'margemLiquida') {
      textVerde = '🟢 ≥ 10%'
      textAmbar = '🟠 5% – 10%'
      textVermelho = '🔴 < 5%'
    } else if (id === 'giroAtivo') {
      textVerde = '🟢 ≥ 1,0'
      textAmbar = '🟠 0,5 – 1,0'
      textVermelho = '🔴 < 0,5'
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

  if (loading && !balancoAtual && !dreAtual && balancos.length === 0) {
    return (
      <div className="py-20 flex flex-col justify-center items-center gap-3">
        <div className="w-9 h-9 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs text-slate-500 font-medium">
          Carregando indicadores de rentabilidade...
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
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-extrabold text-[#0B1F3A] tracking-tight">
                Indicadores de Rentabilidade
              </h1>
              <Badge className="bg-blue-50 text-blue-700 border-blue-200 font-semibold text-xs">
                Retorno &amp; Eficiência
              </Badge>
            </div>
            <p className="text-xs text-[#5B6B7F] mt-0.5">
              Diagnóstico do retorno sobre o capital próprio (ROE), ativos (ROA), margem e giro
              operacional
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
            disabled={!balancoAtual && !dreAtual}
            variant="outline"
            className="border-slate-300 text-slate-700 hover:bg-slate-100 font-semibold text-xs h-9 shadow-2xs"
          >
            <Download className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {/* Sem balanço ou DRE cadastrados */}
      {!balancoAtual && !dreAtual ? (
        <Card className="bg-white border-amber-200 shadow-2xs overflow-hidden">
          <CardContent className="p-8 text-center flex flex-col items-center justify-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200">
              <AlertCircle className="w-7 h-7" />
            </div>
            <div className="max-w-md space-y-1.5">
              <h3 className="text-base font-bold text-slate-800">
                Nenhuma Demonstração Contábil em {selectedAno}
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                A empresa{' '}
                <span className="font-semibold text-slate-900">
                  {selectedEmpresa?.nome || 'selecionada'}
                </span>{' '}
                ainda não possui lançamentos de Balanço Patrimonial ou DRE cadastrados para o
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
          {/* 2. Resumo de Variáveis Extraídas do Balanço e DRE */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Scale className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-bold text-[#0B1F3A] uppercase tracking-wider">
                  Bases do Balanço e DRE ({selectedAno})
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
                  Resultado Operacional
                </span>
                <span className="text-sm font-bold text-slate-900 block mt-0.5">
                  {formatCurrency(ro)}
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
                  Patrimônio Líquido (PL)
                </span>
                <span className="text-sm font-bold text-slate-900 block mt-0.5">
                  {formatCurrency(pl)}
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
                              ? 'Ocultar Valores Extraídos da DRE/Balanço'
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
                    Comparativo Visual dos Indicadores de Rentabilidade ({selectedAno})
                  </CardTitle>
                </div>
                <CardDescription className="text-xs mt-0.5">
                  Comparação de ROE, ROA, Margem Líquida (%) e Giro do Ativo (escala x10)
                </CardDescription>
              </div>

              {/* Legenda */}
              <div className="flex items-center gap-3 text-[11px] font-semibold">
                <span className="flex items-center gap-1 text-emerald-700">
                  <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                  Excelente / Alta Margem
                </span>
                <span className="flex items-center gap-1 text-amber-700">
                  <span className="w-2.5 h-2.5 rounded-sm bg-amber-500" />
                  Adequado / Moderado
                </span>
                <span className="flex items-center gap-1 text-red-700">
                  <span className="w-2.5 h-2.5 rounded-sm bg-red-500" />
                  Alerta / Baixo Retorno
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
                      domain={[0, (dataMax: number) => Math.max(25, Math.ceil(dataMax * 1.2))]}
                      tick={{ fontSize: 11, fill: '#64748B' }}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <YAxis
                      dataKey="sigla"
                      type="category"
                      tick={{ fontSize: 12, fill: '#0B1F3A', fontWeight: 700 }}
                      width={65}
                    />
                    <RechartsTooltip
                      formatter={(val: any, name: any, item: any) => [
                        item.payload.tipo === 'multiplo'
                          ? `${item.payload.valorReal}x (${item.payload.nome})`
                          : `${formatPercent(Number(val), 1)} (${item.payload.nome})`,
                        'Desempenho',
                      ]}
                      labelFormatter={(label: any) => `Indicador: ${label}`}
                    />
                    <ReferenceLine
                      x={15}
                      stroke="#10B981"
                      strokeDasharray="4 4"
                      strokeWidth={1.5}
                      label={{
                        value: 'Meta ROE: 15%',
                        fill: '#10B981',
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

          {/* 5. Análise Consolidada com Diagnóstico de Rentabilidade */}
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
                        Diagnóstico integrado de retorno econômico, margens e geração de valor ·
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
                    1. Diagnóstico de Eficiência e Retorno
                  </span>
                  <p className="text-slate-200 leading-relaxed">
                    {parecerConsolidado.detalhesPosicao}
                  </p>
                </div>

                <div className="bg-white/5 p-4 rounded-xl border border-white/10 space-y-1.5">
                  <span className="font-bold text-emerald-300 uppercase tracking-wider text-[11px] block">
                    2. Recomendações Estratégicas para Alavancagem de Lucro
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
