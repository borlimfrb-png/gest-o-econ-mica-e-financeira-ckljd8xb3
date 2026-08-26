import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFilter } from '@/contexts/FilterContext'
import { useMinhaEmpresa } from '@/contexts/MinhaEmpresaContext'
import { balancosService, dreService } from '@/services/financeService'
import type { BalancoRecord, DreRecord } from '@/types/finance'
import {
  calcularBalanco,
  calcularDre,
  formatCurrency,
  formatNumber,
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
  Clock,
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
  Repeat,
  ArrowRightLeft,
  Timer,
  Wallet,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface IndicadorEficienciaInfo {
  id: 'pme' | 'pmr' | 'pmp' | 'co' | 'cf' | 'ge' | 'gr' | 'gf'
  nome: string
  sigla: string
  formula: string
  formulaExplicada: string
  descricaoCurta: string
  valor: number | null
  unidade: 'dias' | 'vezes'
  status: 'verde' | 'ambar' | 'vermelho' | 'indefinido'
  statusTexto: string
  interpretacao: string
  referencia: string
  variaveis: {
    label: string
    sigla: string
    valor: number
    detalhes?: string
    isCurrency?: boolean
  }[]
}

export default function IndicadoresEficienciaOperacional() {
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
    pme: false,
    pmr: false,
    pmp: false,
    co: false,
    cf: false,
    ge: false,
    gr: false,
    gf: false,
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
      console.error('Erro ao carregar balanços e DRE para eficiência operacional:', err)
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
  // Balanço:
  const estoques = balancoAtual?.estoques || 0
  const contasReceber = balancoAtual?.contas_receber || 0
  const fornecedores = balancoAtual?.fornecedores || 0
  const ac = calcB.ativoCirculante
  const at = calcB.ativoTotal

  // DRE:
  const rb = dreAtual?.receita_bruta || 0
  const rl = calcD.receitaLiquida
  const cmv = dreAtual?.custo_mercadorias || 0
  // Se Compras não estiver explicitamente disponível, usamos o CMV como proxy
  const comprasProxy = cmv

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

  // ================= CÁLCULOS DOS 8 INDICADORES =================

  // 1. Prazo Médio de Estocagem (PME) = (Estoque / CMV) × 360
  const pmeValor = cmv > 0 ? (estoques / cmv) * 360 : null

  // 2. Prazo Médio de Recebimento (PMR) = (Contas a Receber / Receita Bruta) × 360
  // (Caso Receita Bruta seja 0 mas Receita Líquida > 0, usamos RL como fallback seguro)
  const receitaBaseVendas = rb > 0 ? rb : rl
  const pmrValor = receitaBaseVendas > 0 ? (contasReceber / receitaBaseVendas) * 360 : null

  // 3. Prazo Médio de Pagamento (PMP) = (Fornecedores / ComprasProxy) × 360
  const pmpValor = comprasProxy > 0 ? (fornecedores / comprasProxy) * 360 : null

  // 4. Ciclo Operacional = PME + PMR
  const cicloOperacionalValor = pmeValor !== null && pmrValor !== null ? pmeValor + pmrValor : null

  // 5. Ciclo Financeiro (Ciclo de Caixa) = Ciclo Operacional - PMP
  const cicloFinanceiroValor =
    cicloOperacionalValor !== null && pmpValor !== null ? cicloOperacionalValor - pmpValor : null

  // 6. Giro do Estoque = CMV / Estoque (vezes por ano)
  const giroEstoqueValor = estoques > 0 ? cmv / estoques : null

  // 7. Giro de Contas a Receber = Receita Bruta / Contas a Receber (vezes por ano)
  const giroReceberValor = contasReceber > 0 ? receitaBaseVendas / contasReceber : null

  // 8. Giro de Fornecedores = ComprasProxy / Fornecedores (vezes por ano)
  const giroFornecedoresValor = fornecedores > 0 ? comprasProxy / fornecedores : null

  // ================= STATUS & CLASSIFICAÇÃO =================

  // 1. PME: 🟢 <= 60 dias (Eficiente), 🟠 60–90 dias (Atenção), 🔴 > 90 dias (Alto)
  const getPmeStatus = (val: number | null): 'verde' | 'ambar' | 'vermelho' | 'indefinido' => {
    if (val === null || isNaN(val)) return 'indefinido'
    if (val <= 60) return 'verde'
    if (val <= 90) return 'ambar'
    return 'vermelho'
  }
  const getPmeStatusTexto = (val: number | null): string => {
    if (val === null || isNaN(val)) return 'Sem dados'
    if (val <= 60) return 'Eficiente'
    if (val <= 90) return 'Atenção'
    return 'Alto'
  }

  // 2. PMR: 🟢 <= 30 dias (Rápido), 🟠 30–60 dias (Moderado), 🔴 > 60 dias (Lento)
  const getPmrStatus = (val: number | null): 'verde' | 'ambar' | 'vermelho' | 'indefinido' => {
    if (val === null || isNaN(val)) return 'indefinido'
    if (val <= 30) return 'verde'
    if (val <= 60) return 'ambar'
    return 'vermelho'
  }
  const getPmrStatusTexto = (val: number | null): string => {
    if (val === null || isNaN(val)) return 'Sem dados'
    if (val <= 30) return 'Rápido'
    if (val <= 60) return 'Moderado'
    return 'Lento'
  }

  // 3. PMP: 🟢 >= 60 dias (Favorável), 🟠 30–60 dias (Neutro), 🔴 < 30 dias (Curto)
  const getPmpStatus = (val: number | null): 'verde' | 'ambar' | 'vermelho' | 'indefinido' => {
    if (val === null || isNaN(val)) return 'indefinido'
    if (val >= 60) return 'verde'
    if (val >= 30) return 'ambar'
    return 'vermelho'
  }
  const getPmpStatusTexto = (val: number | null): string => {
    if (val === null || isNaN(val)) return 'Sem dados'
    if (val >= 60) return 'Favorável'
    if (val >= 30) return 'Neutro'
    return 'Curto'
  }

  // 4. Ciclo Operacional: 🟢 <= 90 dias, 🟠 90–150 dias, 🔴 > 150 dias
  const getCoStatus = (val: number | null): 'verde' | 'ambar' | 'vermelho' | 'indefinido' => {
    if (val === null || isNaN(val)) return 'indefinido'
    if (val <= 90) return 'verde'
    if (val <= 150) return 'ambar'
    return 'vermelho'
  }
  const getCoStatusTexto = (val: number | null): string => {
    if (val === null || isNaN(val)) return 'Sem dados'
    if (val <= 90) return 'Ciclo Rápido'
    if (val <= 150) return 'Ciclo Médio'
    return 'Ciclo Extenso'
  }

  // 5. Ciclo Financeiro: 🟢 <= 30 dias (ou negativo: 🟢), 🟠 30–60 dias, 🔴 > 60 dias
  const getCfStatus = (val: number | null): 'verde' | 'ambar' | 'vermelho' | 'indefinido' => {
    if (val === null || isNaN(val)) return 'indefinido'
    if (val <= 30) return 'verde'
    if (val <= 60) return 'ambar'
    return 'vermelho'
  }
  const getCfStatusTexto = (val: number | null): string => {
    if (val === null || isNaN(val)) return 'Sem dados'
    if (val < 0) return 'Excelente (Negativo)'
    if (val <= 30) return 'Confortável'
    if (val <= 60) return 'Moderado'
    return 'Pressão no Caixa'
  }

  // 6. Giro do Estoque: 🟢 >= 8x, 🟠 4–8x, 🔴 < 4x
  const getGeStatus = (val: number | null): 'verde' | 'ambar' | 'vermelho' | 'indefinido' => {
    if (val === null || isNaN(val)) return 'indefinido'
    if (val >= 8) return 'verde'
    if (val >= 4) return 'ambar'
    return 'vermelho'
  }
  const getGeStatusTexto = (val: number | null): string => {
    if (val === null || isNaN(val)) return 'Sem dados'
    if (val >= 8) return 'Alto Giro'
    if (val >= 4) return 'Giro Médio'
    return 'Giro Lento'
  }

  // 7. Giro de Contas a Receber: 🟢 >= 12x, 🟠 6–12x, 🔴 < 6x
  const getGrStatus = (val: number | null): 'verde' | 'ambar' | 'vermelho' | 'indefinido' => {
    if (val === null || isNaN(val)) return 'indefinido'
    if (val >= 12) return 'verde'
    if (val >= 6) return 'ambar'
    return 'vermelho'
  }
  const getGrStatusTexto = (val: number | null): string => {
    if (val === null || isNaN(val)) return 'Sem dados'
    if (val >= 12) return 'Alta Conversão'
    if (val >= 6) return 'Conversão Média'
    return 'Cobrança Lenta'
  }

  // 8. Giro de Fornecedores: 🟢 <= 6x (paga devagar = bom), 🟠 6–12x, 🔴 > 12x (paga rápido demais)
  const getGfStatus = (val: number | null): 'verde' | 'ambar' | 'vermelho' | 'indefinido' => {
    if (val === null || isNaN(val)) return 'indefinido'
    if (val <= 6) return 'verde'
    if (val <= 12) return 'ambar'
    return 'vermelho'
  }
  const getGfStatusTexto = (val: number | null): string => {
    if (val === null || isNaN(val)) return 'Sem dados'
    if (val <= 6) return 'Financiado por Fornecedores'
    if (val <= 12) return 'Rotatividade Equilibrada'
    return 'Pagamento Acelerado'
  }

  // ================= INTERPRETAÇÕES TEXTUAIS =================

  const getInterpretacaoPme = (val: number | null): string => {
    if (val === null) {
      return 'Dados de Estoque no Balanço ou Custos das Mercadorias (CMV) na DRE não disponíveis para cálculo do PME.'
    }
    if (val <= 60) {
      return `As mercadorias ou matérias-primas permanecem estocadas em média por ${formatNumber(val, 1)} dias antes de serem comercializadas. Este ritmo rápido de renovação evita a obsolescência de produtos e minimiza o capital de giro imobilizado em armazém. Reflete uma excelente gestão de suprimentos e demanda comercial alinhada.`
    }
    if (val <= 90) {
      return `O prazo médio de estocagem de ${formatNumber(val, 1)} dias situa-se em patamar intermediário de atenção. Embora atenda aos ciclos mercantis habituais, pode indicar lotes de compras ligeiramente acima do ritmo de escoamento. Recomenda-se calibrar os pedidos de reposição para liberar recursos no fluxo de caixa.`
    }
    return `Com ${formatNumber(val, 1)} dias de estocagem, a empresa opera com volume elevado de produtos parados em estoque frente ao custo das vendas. Esse prazo estendido eleva custos de armazenagem, risco de perdas e consome capital de giro que poderia estar disponível em caixa. É fundamental realizar promoções de desova e ajustar a política de compras.`
  }

  const getInterpretacaoPmr = (val: number | null): string => {
    if (val === null) {
      return 'Dados de Contas a Receber no Balanço ou Receita de Vendas na DRE insuficientes para apurar o PMR.'
    }
    if (val <= 30) {
      return `A empresa leva em média ${formatNumber(val, 1)} dias para converter suas vendas faturadas em dinheiro líquido em conta. Essa agilidade no recebimento assegura rapidez na recomposição da tesouraria e reduz significativamente o risco de inadimplência. Demonstra rigor e eficiência na concessão de crédito aos clientes.`
    }
    if (val <= 60) {
      return `O prazo médio de recebimento de ${formatNumber(val, 1)} dias reflete condições comerciais padrão concedidas no mercado (30 a 60 dias). O fluxo de entradas é previsível, contudo exige acompanhamento contínuo da pontualidade dos boletos e cartões. É prudente manter réguas de cobrança preventiva automatizadas.`
    }
    return `O prazo de ${formatNumber(val, 1)} dias para recebimento é considerado lento e alongado. A empresa está financiando as operações de seus clientes por longo período, o que pressiona o caixa e pode exigir antecipações bancárias custosas. Sugere-se rever prazos contratuais de parcelamento e incentivar pagamentos à vista via descontos ou PIX.`
  }

  const getInterpretacaoPmp = (val: number | null): string => {
    if (val === null) {
      return 'Dados da conta Fornecedores no Balanço ou Compras/CMV na DRE não disponíveis para cálculo do PMP.'
    }
    if (val >= 60) {
      return `A empresa obtém em média ${formatNumber(val, 1)} dias de prazo junto aos seus fornecedores para pagar insumos e mercadorias. Esse prazo estendido permite que a operação seja financiada diretamente pelos parceiros comerciais sem custo financeiro de juros. Confere elevado fôlego e estabilidade ao capital de giro da empresa.`
    }
    if (val >= 30) {
      return `Com ${formatNumber(val, 1)} dias para quitação de fornecedores, a empresa opera em prazo equilibrado e alinhado aos padrões da cadeia de suprimentos. Há uma convivência harmônica com as datas de recebimento de clientes, embora sempre haja espaço para negociar prazos maiores com fornecedores parceiros.`
    }
    return `O prazo médio de pagamento de apenas ${formatNumber(val, 1)} dias indica que a empresa liquida suas faturas de compras muito rapidamente. Esse desembolso precoce exige recursos imediatos de caixa antes mesmo da maturação das vendas. Recomenda-se negociar com fornecedores-chave a ampliação dos prazos para no mínimo 30 a 45 dias.`
  }

  const getInterpretacaoCo = (val: number | null): string => {
    if (val === null) {
      return 'Dados de prazos médios de estocagem ou recebimento insuficientes para compor o Ciclo Operacional.'
    }
    if (val <= 90) {
      return `A empresa leva apenas ${formatNumber(val, 1)} dias desde a aquisição das mercadorias/matérias-primas até o recebimento final das vendas (PME: ${pmeValor !== null ? formatNumber(pmeValor, 1) : '—'}d + PMR: ${pmrValor !== null ? formatNumber(pmrValor, 1) : '—'}d). Esse ciclo enxuto demonstra agilidade no fluxo produtivo-comercial e reduz a necessidade global de capital de giro.`
    }
    if (val <= 150) {
      return `O Ciclo Operacional totaliza ${formatNumber(val, 1)} dias entre a estocagem e a entrada dos recursos das vendas. A cadência operacional é moderada e requer planejamento cuidadoso para que a estocagem e os prazos concedidos não sobrecarreguem as contas a pagar no curto prazo.`
    }
    return `Com ${formatNumber(val, 1)} dias de Ciclo Operacional, a empresa enfrenta um percurso excessivamente longo entre a compra de insumos e a liquidação das vendas. A morosidade no ciclo produtivo ou no recebimento imobiliza montantes expressivos em ativos circulantes. É prioritário acelerar o giro dos estoques e encurtar os prazos concedidos.`
  }

  const getInterpretacaoCf = (val: number | null): string => {
    if (val === null) {
      return 'Dados insuficientes para mensurar o Ciclo Financeiro (Ciclo de Caixa).'
    }
    if (val < 0) {
      return `O Ciclo Financeiro é NEGATIVO (${formatNumber(val, 1)} dias), o que representa uma situação de máxima excelência financeira. A empresa recebe de seus clientes ${formatNumber(Math.abs(val), 1)} dias ANTES de precisar pagar seus fornecedores. A atividade gera caixa operacional espontâneo e dispensa financiamento bancário para giro.`
    }
    if (val <= 30) {
      return `O Ciclo Financeiro de ${formatNumber(val, 1)} dias revela que a empresa precisa financiar apenas um intervalo curto entre o pagamento aos fornecedores e a entrada das vendas. A dependência de capital de giro próprio ou de terceiros é pequena e totalmente sustentável com os lucros da atividade.`
    }
    if (val <= 60) {
      return `Com ${formatNumber(val, 1)} dias de descasamento entre pagamentos e recebimentos, a empresa demanda um colchão constante de capital de giro para honrar suas obrigações. É importante acompanhar as linhas de crédito rotativo para garantir que o custo da dívida não comprometa a rentabilidade da operação.`
    }
    return `O Ciclo Financeiro de ${formatNumber(val, 1)} dias indica um severo hiato temporal em que a empresa já pagou fornecedores mas ainda não recebeu de seus clientes. Esse descasamento prolongado pressiona intensamente a tesouraria e gera forte dependência de empréstimos onerosos de capital de giro. É urgente ampliar o PMP ou reduzir o PME/PMR.`
  }

  const getInterpretacaoGe = (val: number | null): string => {
    if (val === null) {
      return 'Dados de estoques ou custo das mercadorias insuficientes para o Giro do Estoque.'
    }
    if (val >= 8) {
      return `O estoque da empresa é totalmente renovado ${formatNumber(val, 1)} vezes ao ano, comprovando altíssima rotatividade e dinâmica de vendas aquecida. Esse dinamismo maximiza o retorno sobre o capital aplicado em mercadorias e reduz desperdícios ou perdas por validade.`
    }
    if (val >= 4) {
      return `O estoque gira ${formatNumber(val, 1)} vezes no decorrer do exercício. Trata-se de uma frequência padrão e estável para a maioria dos setores do comércio e indústria. Sugere-se manter inventários periódicos para identificar itens de menor tração comercial.`
    }
    return `Com apenas ${formatNumber(val, 1)} giros por ano, o estoque da empresa move-se lentamente, retendo recursos financeiros preciosos em prateleiras ou depósitos. Há risco de perdas patrimoniais e obsolescência. Recomenda-se adotar compras just-in-time e reavaliar itens com giro estagnado.`
  }

  const getInterpretacaoGr = (val: number | null): string => {
    if (val === null) {
      return 'Dados de faturamento e contas a receber não disponíveis para cálculo do Giro de Recebíveis.'
    }
    if (val >= 12) {
      return `A carteira de contas a receber é liquidada e renovada ${formatNumber(val, 1)} vezes por ano (mais de uma vez por mês). Isso demonstra uma política de cobrança altamente eficiente e baixo índice de títulos vencidos em aberto. O fluxo de receitas é convertido com rapidez em disponibilidades.`
    }
    if (val >= 6) {
      return `O contas a receber gira ${formatNumber(val, 1)} vezes ao ano, indicando uma cadência bimensal regular de liquidação de títulos. A taxa de conversão é equilibrada, recomendando-se monitorar de perto a pontualidade dos clientes de maior porte.`
    }
    return `Com ${formatNumber(val, 1)} rotações ao ano, a carteira de recebíveis apresenta baixa velocidade de renovação. A empresa acumula saldos pendentes elevados em relação ao seu volume de vendas, sugerindo prazos excessivos ou inadimplência. É recomendável fortalecer o departamento de análise de crédito e cobrança.`
  }

  const getInterpretacaoGf = (val: number | null): string => {
    if (val === null) {
      return 'Dados de fornecedores ou compras indisponíveis para o cálculo do Giro de Fornecedores.'
    }
    if (val <= 6) {
      return `A empresa quita sua carteira de fornecedores ${formatNumber(val, 1)} vezes por ano (aproximadamente a cada 60 dias ou mais). Essa baixa rotatividade de desembolso é muito benéfica, pois retém o capital na conta da empresa por mais tempo, financiando o giro com recursos comerciais sem juros.`
    }
    if (val <= 12) {
      return `O giro de fornecedores em ${formatNumber(val, 1)} vezes anuais reflete pagamentos mensais regulares das obrigações de compras. A relação com parceiros é estável e dentro da média corporativa, existindo oportunidade para negociar condições de prazo mais vantajosas.`
    }
    return `Com giro de ${formatNumber(val, 1)} vezes ao ano, a empresa liquida seus compromissos com fornecedores de forma acelerada (em prazos inferiores a um mês). Esse ritmo rápido de pagamento drena o caixa precocemente. Sugere-se repactuar prazos de faturamento junto aos principais distribuidores.`
  }

  // ================= LISTA DOS 8 INDICADORES =================

  const indicadores: IndicadorEficienciaInfo[] = [
    {
      id: 'pme',
      nome: 'Prazo Médio de Estocagem (PME)',
      sigla: 'PME',
      formula: '(Estoque / CMV) × 360',
      formulaExplicada: '(Estoques de Mercadorias ÷ Custo das Mercadorias Vendidas) × 360 dias',
      descricaoCurta:
        'Tempo médio que os produtos e matérias-primas permanecem em estoque até a venda',
      valor: pmeValor,
      unidade: 'dias',
      status: getPmeStatus(pmeValor),
      statusTexto: getPmeStatusTexto(pmeValor),
      interpretacao: getInterpretacaoPme(pmeValor),
      referencia: '🟢 ≤ 60 dias (Eficiente) · 🟠 60–90 dias (Atenção) · 🔴 > 90 dias (Alto)',
      variaveis: [
        {
          label: 'Estoques de Mercadorias/Insumos',
          sigla: 'Estoques',
          valor: estoques,
          detalhes: 'Saldo de produtos, matérias-primas e mercadorias no Balanço',
          isCurrency: true,
        },
        {
          label: 'Custo das Mercadorias Vendidas (CMV)',
          sigla: 'CMV',
          valor: cmv,
          detalhes: 'Custo total das vendas no exercício (DRE)',
          isCurrency: true,
        },
        {
          label: 'Fator Base Anual',
          sigla: 'Dias',
          valor: 360,
          detalhes: 'Ano comercial padrão para cálculo de prazos',
          isCurrency: false,
        },
      ],
    },
    {
      id: 'pmr',
      nome: 'Prazo Médio de Recebimento (PMR)',
      sigla: 'PMR',
      formula: '(Contas a Receber / Receita Bruta) × 360',
      formulaExplicada: '(Contas a Receber de Clientes ÷ Receita Bruta de Vendas) × 360 dias',
      descricaoCurta:
        'Tempo médio decorrido entre a realização das vendas e a entrada do dinheiro em caixa',
      valor: pmrValor,
      unidade: 'dias',
      status: getPmrStatus(pmrValor),
      statusTexto: getPmrStatusTexto(pmrValor),
      interpretacao: getInterpretacaoPmr(pmrValor),
      referencia: '🟢 ≤ 30 dias (Rápido) · 🟠 30–60 dias (Moderado) · 🔴 > 60 dias (Lento)',
      variaveis: [
        {
          label: 'Contas a Receber (Clientes)',
          sigla: 'Clientes',
          valor: contasReceber,
          detalhes: 'Direitos a receber de clientes no Balanço Patrimonial',
          isCurrency: true,
        },
        {
          label: 'Receita Bruta de Vendas (ou RL)',
          sigla: 'Receita',
          valor: receitaBaseVendas,
          detalhes: 'Faturamento de vendas no exercício (DRE)',
          isCurrency: true,
        },
        {
          label: 'Fator Base Anual',
          sigla: 'Dias',
          valor: 360,
          detalhes: 'Ano comercial padrão contábil',
          isCurrency: false,
        },
      ],
    },
    {
      id: 'pmp',
      nome: 'Prazo Médio de Pagamento (PMP)',
      sigla: 'PMP',
      formula: '(Fornecedores / Compras) × 360',
      formulaExplicada: '(Saldo de Fornecedores ÷ Compras de Mercadorias/CMV) × 360 dias',
      descricaoCurta:
        'Prazo médio concedido pelos fornecedores para quitação das compras de insumos',
      valor: pmpValor,
      unidade: 'dias',
      status: getPmpStatus(pmpValor),
      statusTexto: getPmpStatusTexto(pmpValor),
      interpretacao: getInterpretacaoPmp(pmpValor),
      referencia: '🟢 ≥ 60 dias (Favorável) · 🟠 30–60 dias (Neutro) · 🔴 < 30 dias (Curto)',
      variaveis: [
        {
          label: 'Fornecedores a Pagar',
          sigla: 'Fornecedores',
          valor: fornecedores,
          detalhes: 'Obrigações comerciais no Passivo Circulante',
          isCurrency: true,
        },
        {
          label: 'Compras no Período (CMV Proxy)',
          sigla: 'Compras',
          valor: comprasProxy,
          detalhes: 'Volume de compras/custo das mercadorias apurado na DRE',
          isCurrency: true,
        },
        {
          label: 'Fator Base Anual',
          sigla: 'Dias',
          valor: 360,
          detalhes: 'Ano comercial padrão contábil',
          isCurrency: false,
        },
      ],
    },
    {
      id: 'co',
      nome: 'Ciclo Operacional',
      sigla: 'Ciclo Operacional',
      formula: 'PME + PMR',
      formulaExplicada: 'Prazo Médio de Estocagem (dias) + Prazo Médio de Recebimento (dias)',
      descricaoCurta:
        'Tempo total desde a compra da matéria-prima/produto até o recebimento final das vendas',
      valor: cicloOperacionalValor,
      unidade: 'dias',
      status: getCoStatus(cicloOperacionalValor),
      statusTexto: getCoStatusTexto(cicloOperacionalValor),
      interpretacao: getInterpretacaoCo(cicloOperacionalValor),
      referencia: '🟢 ≤ 90 dias · 🟠 90–150 dias · 🔴 > 150 dias',
      variaveis: [
        {
          label: 'Prazo Médio de Estocagem (PME)',
          sigla: 'PME',
          valor: pmeValor || 0,
          detalhes: 'Dias que a mercadoria fica estocada',
          isCurrency: false,
        },
        {
          label: 'Prazo Médio de Recebimento (PMR)',
          sigla: 'PMR',
          valor: pmrValor || 0,
          detalhes: 'Dias para receber dos clientes',
          isCurrency: false,
        },
      ],
    },
    {
      id: 'cf',
      nome: 'Ciclo Financeiro (Ciclo de Caixa)',
      sigla: 'Ciclo de Caixa',
      formula: 'Ciclo Operacional − PMP',
      formulaExplicada: '(PME + PMR) − Prazo Médio de Pagamento a Fornecedores',
      descricaoCurta:
        'Intervalo de tempo em que a empresa necessita financiar suas operações com capital próprio/bancário',
      valor: cicloFinanceiroValor,
      unidade: 'dias',
      status: getCfStatus(cicloFinanceiroValor),
      statusTexto: getCfStatusTexto(cicloFinanceiroValor),
      interpretacao: getInterpretacaoCf(cicloFinanceiroValor),
      referencia: '🟢 ≤ 30 dias (ou negativo: excelente) · 🟠 30–60 dias · 🔴 > 60 dias',
      variaveis: [
        {
          label: 'Ciclo Operacional (PME + PMR)',
          sigla: 'CO',
          valor: cicloOperacionalValor || 0,
          detalhes: 'Período total do fluxo produtivo e comercial',
          isCurrency: false,
        },
        {
          label: 'Prazo Médio de Pagamento (PMP)',
          sigla: 'PMP',
          valor: pmpValor || 0,
          detalhes: 'Prazo financiado por fornecedores',
          isCurrency: false,
        },
      ],
    },
    {
      id: 'ge',
      nome: 'Giro do Estoque',
      sigla: 'Giro Estoque',
      formula: 'CMV / Estoque',
      formulaExplicada: 'Custo das Mercadorias Vendidas ÷ Saldo Médio de Estoques',
      descricaoCurta: 'Quantidade de vezes que o estoque da empresa é renovado ao longo do ano',
      valor: giroEstoqueValor,
      unidade: 'vezes',
      status: getGeStatus(giroEstoqueValor),
      statusTexto: getGeStatusTexto(giroEstoqueValor),
      interpretacao: getInterpretacaoGe(giroEstoqueValor),
      referencia: '🟢 ≥ 8x (Alto giro) · 🟠 4–8x (Médio) · 🔴 < 4x (Lento)',
      variaveis: [
        {
          label: 'Custo das Mercadorias (CMV)',
          sigla: 'CMV',
          valor: cmv,
          detalhes: 'Custo total de produtos na DRE',
          isCurrency: true,
        },
        {
          label: 'Saldo de Estoques',
          sigla: 'Estoques',
          valor: estoques,
          detalhes: 'Ativo Circulante no Balanço',
          isCurrency: true,
        },
      ],
    },
    {
      id: 'gr',
      nome: 'Giro de Contas a Receber',
      sigla: 'Giro Receber',
      formula: 'Receita Bruta / Contas a Receber',
      formulaExplicada: 'Receita Bruta de Vendas ÷ Contas a Receber de Clientes',
      descricaoCurta:
        'Número de vezes que a carteira de contas a receber é faturada e liquidada no ano',
      valor: giroReceberValor,
      unidade: 'vezes',
      status: getGrStatus(giroReceberValor),
      statusTexto: getGrStatusTexto(giroReceberValor),
      interpretacao: getInterpretacaoGr(giroReceberValor),
      referencia: '🟢 ≥ 12x (Mensal ou superior) · 🟠 6–12x · 🔴 < 6x (Lento)',
      variaveis: [
        {
          label: 'Receita Bruta de Vendas',
          sigla: 'Receita',
          valor: receitaBaseVendas,
          detalhes: 'Faturamento bruto da DRE',
          isCurrency: true,
        },
        {
          label: 'Contas a Receber (Clientes)',
          sigla: 'Clientes',
          valor: contasReceber,
          detalhes: 'Títulos em aberto no Balanço',
          isCurrency: true,
        },
      ],
    },
    {
      id: 'gf',
      nome: 'Giro de Fornecedores',
      sigla: 'Giro Fornecedores',
      formula: 'Compras / Fornecedores',
      formulaExplicada: 'Compras no Período (CMV Proxy) ÷ Saldo de Fornecedores',
      descricaoCurta: 'Quantidade de vezes que a conta fornecedores é renovada e quitada por ano',
      valor: giroFornecedoresValor,
      unidade: 'vezes',
      status: getGfStatus(giroFornecedoresValor),
      statusTexto: getGfStatusTexto(giroFornecedoresValor),
      interpretacao: getInterpretacaoGf(giroFornecedoresValor),
      referencia:
        '🟢 ≤ 6x (Paga mais devagar = vantajoso) · 🟠 6–12x · 🔴 > 12x (Paga rápido demais)',
      variaveis: [
        {
          label: 'Compras no Período (CMV)',
          sigla: 'Compras',
          valor: comprasProxy,
          detalhes: 'Total de insumos adquiridos no exercício',
          isCurrency: true,
        },
        {
          label: 'Saldo de Fornecedores',
          sigla: 'Fornecedores',
          valor: fornecedores,
          detalhes: 'Passivo com terceiros no Balanço',
          isCurrency: true,
        },
      ],
    },
  ]

  // ================= DADOS PARA O GRÁFICO RECHARTS =================
  // Gráfico de Barras Horizontal comparando PME, PMR e PMP lado a lado em dias com cores condicionais por faixa
  const dadosGraficoPrazos = useMemo(() => {
    return [
      {
        nome: 'Prazo Médio de Estocagem',
        sigla: 'PME (Estoque)',
        valor: pmeValor !== null ? Math.max(0, Number(pmeValor.toFixed(1))) : 0,
        valorReal: pmeValor !== null ? pmeValor : 0,
        status: getPmeStatus(pmeValor),
        statusTexto: getPmeStatusTexto(pmeValor),
        descricao: 'Tempo em estoque',
      },
      {
        nome: 'Prazo Médio de Recebimento',
        sigla: 'PMR (Clientes)',
        valor: pmrValor !== null ? Math.max(0, Number(pmrValor.toFixed(1))) : 0,
        valorReal: pmrValor !== null ? pmrValor : 0,
        status: getPmrStatus(pmrValor),
        statusTexto: getPmrStatusTexto(pmrValor),
        descricao: 'Tempo para receber de clientes',
      },
      {
        nome: 'Prazo Médio de Pagamento',
        sigla: 'PMP (Fornecedores)',
        valor: pmpValor !== null ? Math.max(0, Number(pmpValor.toFixed(1))) : 0,
        valorReal: pmpValor !== null ? pmpValor : 0,
        status: getPmpStatus(pmpValor),
        statusTexto: getPmpStatusTexto(pmpValor),
        descricao: 'Prazo de pagamento a fornecedores',
      },
    ]
  }, [pmeValor, pmrValor, pmpValor])

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

  // ================= PARECER CONSOLIDADO DO CONSULTOR =================
  const parecerConsolidado = useMemo(() => {
    if (!dreAtual && !balancoAtual) return null

    const pmeStatus = getPmeStatus(pmeValor)
    const pmrStatus = getPmrStatus(pmrValor)
    const pmpStatus = getPmpStatus(pmpValor)
    const cfStatus = getCfStatus(cicloFinanceiroValor)

    let titulo = ''
    let nivel: 'excelente' | 'adequado' | 'alerta' | 'critico' = 'adequado'
    let detalhesPosicao = ''
    let recomendacao = ''

    if (cicloFinanceiroValor !== null && cicloFinanceiroValor < 0) {
      nivel = 'excelente'
      titulo = 'Eficiência Operacional de Excelência com Ciclo Financeiro Negativo'
      detalhesPosicao = `A empresa ${selectedEmpresa?.nome || ''} encerrou ${selectedAno} com um perfil operacional de alta performance. O Ciclo Financeiro é negativo em ${formatNumber(cicloFinanceiroValor, 1)} dias, resultado da combinação virtuosa entre prazo favorável de fornecedores (${formatNumber(pmpValor, 1)} dias) e agilidade na estocagem (${formatNumber(pmeValor, 1)} dias) e recebimento (${formatNumber(pmrValor, 1)} dias). A empresa recebe suas receitas antes de honrar suas compras, gerando autofinanciamento espontâneo.`
      recomendacao =
        'Recomenda-se: 1) Preservar o excelente relacionamento com fornecedores para manter as condições de prazo estendidas; 2) Aplicar os recursos excedentes de tesouraria em investimentos de liquidez imediata com rendimento atrelado ao CDI; 3) Aproveitar a folga de caixa para negociar descontos financeiros em compras pontuais de grande volume.'
    } else if (cfStatus === 'vermelho' || pmeStatus === 'vermelho' || pmrStatus === 'vermelho') {
      nivel = 'critico'
      titulo = 'Descasamento Crítico de Prazos e Pressão Excessiva sobre o Capital de Giro'
      detalhesPosicao = `No exercício de ${selectedAno}, a empresa opera com Ciclo Financeiro dilatado de ${formatNumber(cicloFinanceiroValor, 1)} dias e Ciclo Operacional de ${formatNumber(cicloOperacionalValor, 1)} dias. O tempo necessário para girar estoques (${formatNumber(pmeValor, 1)} dias) e receber vendas (${formatNumber(pmrValor, 1)} dias) supera com folga o prazo obtido junto aos fornecedores (${formatNumber(pmpValor, 1)} dias). Esse descompasso consome montantes volumosos de capital de giro e força o endividamento bancário de curto prazo.`
      recomendacao =
        'Recomenda-se com urgência: 1) Implementar campanhas de liquidação de estoques parados para reduzir o PME para menos de 60 dias; 2) Encurtar a política de crédito aos clientes, oferecendo condições especiais para recebimentos à vista (PIX) e limitando prazos a 30 dias; 3) Renegociar com fornecedores o alongamento do PMP para pelo menos 45 a 60 dias; 4) Monitorar diariamente o fluxo de caixa projetado para evitar pagamento de juros de cheque especial e antecipação de recebíveis.'
    } else if (cfStatus === 'ambar' || pmpStatus === 'vermelho') {
      nivel = 'alerta'
      titulo = 'Ciclo Financeiro Moderado com Oportunidade de Otimização de Prazos'
      detalhesPosicao = `Em ${selectedAno}, a empresa apresenta Ciclo Financeiro de ${formatNumber(cicloFinanceiroValor, 1)} dias e Ciclo Operacional de ${formatNumber(cicloOperacionalValor, 1)} dias. Embora a operação mantenha fluidez, há uma janela em que o caixa precisa sustentar os desembolsos de compras antes de receber a liquidação das vendas. O giro de fornecedores (${formatNumber(giroFornecedoresValor, 1)}x) indica potencial para melhoria nas condições comerciais.`
      recomendacao =
        'Recomenda-se: 1) Desenvolver parcerias estratégicas com fornecedores-chave para estender os prazos médios de pagamento; 2) Otimizar os níveis de estoque mínimo para evitar acúmulos desnecessários de capital; 3) Automatizar réguas de cobrança preventiva para assegurar a pontualidade dos recebíveis.'
    } else {
      nivel = 'adequado'
      titulo = 'Prazos e Ciclos Operacionais Equilibrados e Compatíveis com o Mercado'
      detalhesPosicao = `No exercício de ${selectedAno}, a empresa ${selectedEmpresa?.nome || ''} demonstra gestão harmônica de seus prazos e ciclos (PME: ${formatNumber(pmeValor, 1)}d, PMR: ${formatNumber(pmrValor, 1)}d, PMP: ${formatNumber(pmpValor, 1)}d, Ciclo Financeiro: ${formatNumber(cicloFinanceiroValor, 1)}d). O fluxo de caixa operacional transcorre com estabilidade, absorvendo os custos de compras sem sobressaltos.`
      recomendacao =
        'Recomenda-se: 1) Manter o monitoramento mensal dos indicadores de giro de estoques e recebíveis; 2) Buscar ganhos marginais na redução do PME através de compras mais fracionadas; 3) Preservar a disciplina financeira para sustentar o Ciclo Financeiro em patamar inferior a 30 dias.'
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
    pmeValor,
    pmrValor,
    pmpValor,
    cicloOperacionalValor,
    cicloFinanceiroValor,
    giroFornecedoresValor,
    selectedEmpresa,
    selectedAno,
  ])

  // ================= EXPORTAÇÃO CSV =================
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

    csvContent += `RELATÓRIO DE EFICIÊNCIA OPERACIONAL (PRAZOS E CICLOS)\n`
    csvContent += `EMPRESA;${selectedEmpresa.nome}\n`
    csvContent += `CNPJ;${formatCnpj(selectedEmpresa.cnpj)}\n`
    csvContent += `SEGMENTO;${selectedEmpresa.segmento}\n`
    csvContent += `EXERCÍCIO;${selectedAno}\n`
    csvContent += `DATA DE EMISSÃO;${dataEmissao}\n\n`

    csvContent += `VALORES BASE EXTRAÍDOS DO BALANÇO E DRE (R$)\n`
    csvContent += `Estoques de Mercadorias/Insumos;${estoques.toFixed(2).replace('.', ',')}\n`
    csvContent += `Contas a Receber (Clientes);${contasReceber.toFixed(2).replace('.', ',')}\n`
    csvContent += `Fornecedores a Pagar;${fornecedores.toFixed(2).replace('.', ',')}\n`
    csvContent += `Ativo Circulante Total;${ac.toFixed(2).replace('.', ',')}\n`
    csvContent += `Ativo Total;${at.toFixed(2).replace('.', ',')}\n`
    csvContent += `Receita Bruta de Vendas;${rb.toFixed(2).replace('.', ',')}\n`
    csvContent += `Receita Líquida (RL);${rl.toFixed(2).replace('.', ',')}\n`
    csvContent += `Custos das Mercadorias Vendidas (CMV);${cmv.toFixed(2).replace('.', ',')}\n`
    csvContent += `Compras Estimadas (Proxy CMV);${comprasProxy.toFixed(2).replace('.', ',')}\n\n`

    csvContent += `INDICADORES DE EFICIÊNCIA OPERACIONAL (8 MÉTRICAS)\n`
    csvContent += `Indicador;Sigla;Fórmula;Valor Calculado;Unidade;Classificação;Interpretação Resumida\n`

    for (const ind of indicadores) {
      const valStr =
        ind.valor !== null
          ? ind.unidade === 'dias'
            ? ind.valor.toFixed(1).replace('.', ',')
            : ind.valor.toFixed(2).replace('.', ',')
          : 'N/D'

      const classStr =
        ind.status === 'verde'
          ? `Adequado (${ind.statusTexto})`
          : ind.status === 'ambar'
            ? `Atenção (${ind.statusTexto})`
            : ind.status === 'vermelho'
              ? `Alerta (${ind.statusTexto})`
              : 'Indefinido'

      const interpClean = ind.interpretacao.replace(/\n/g, ' ').replace(/;/g, ',')
      csvContent += `${ind.nome};${ind.sigla};${ind.formula};${valStr};${ind.unidade};${classStr};${interpClean}\n`
    }

    if (parecerConsolidado) {
      csvContent += `\nPARECER DO CONSULTOR FINANCEIRO - EFICIÊNCIA OPERACIONAL\n`
      csvContent += `Diagnóstico;${parecerConsolidado.titulo.replace(/;/g, ',')}\n`
      csvContent += `Análise de Prazos e Ciclos;${parecerConsolidado.detalhesPosicao.replace(/\n/g, ' ').replace(/;/g, ',')}\n`
      csvContent += `Recomendações Estratégicas;${parecerConsolidado.recomendacao.replace(/\n/g, ' ').replace(/;/g, ',')}\n`
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `eficiencia-operacional-${selectedEmpresa.nome.replace(/\s+/g, '-').toLowerCase()}-${selectedAno}.csv`
    link.click()
    URL.revokeObjectURL(link.href)

    toast({
      title: 'CSV exportado com sucesso!',
      description: `Arquivo de indicadores de Eficiência Operacional (${selectedAno}) gerado com sucesso.`,
    })
  }

  // ================= BADGE CUSTOMIZADA =================
  const renderBadge = (ind: IndicadorEficienciaInfo) => {
    switch (ind.status) {
      case 'verde':
        return (
          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-300 font-bold text-xs flex items-center gap-1.5 px-2.5 py-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />🟢{' '}
            {ind.statusTexto}
          </Badge>
        )
      case 'ambar':
        return (
          <Badge className="bg-amber-50 text-amber-700 border-amber-300 font-bold text-xs flex items-center gap-1.5 px-2.5 py-1">
            <span className="w-2 h-2 rounded-full bg-amber-500" />🟠 {ind.statusTexto}
          </Badge>
        )
      case 'vermelho':
        return (
          <Badge className="bg-red-50 text-red-700 border-red-300 font-bold text-xs flex items-center gap-1.5 px-2.5 py-1">
            <span className="w-2 h-2 rounded-full bg-red-500" />🔴 {ind.statusTexto}
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
          Carregando indicadores de eficiência operacional...
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
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-extrabold text-[#0B1F3A] tracking-tight">
                Eficiência Operacional (Prazos e Ciclos)
              </h1>
              <Badge className="bg-blue-50 text-blue-700 border-blue-200 font-semibold text-xs">
                Ciclos de Caixa e Giro
              </Badge>
            </div>
            <p className="text-xs text-[#5B6B7F] mt-0.5">
              Diagnóstico de prazos médios de estocagem, recebimento e pagamento, ciclos
              operacionais e giros de atividade
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
                exercício de {selectedAno}. Cadastre as demonstrações contábeis primeiro para apurar
                os prazos médios e ciclos operacionais.
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
                  Variáveis Extraídas do Balanço e DRE ({selectedAno})
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
                  Estoques
                </span>
                <span className="text-sm font-bold text-slate-900 block mt-0.5">
                  {formatCurrency(estoques)}
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                <span className="text-[10px] font-semibold text-slate-500 uppercase block truncate">
                  Contas a Receber (Clientes)
                </span>
                <span className="text-sm font-bold text-slate-900 block mt-0.5">
                  {formatCurrency(contasReceber)}
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                <span className="text-[10px] font-semibold text-slate-500 uppercase block truncate">
                  Fornecedores a Pagar
                </span>
                <span className="text-sm font-bold text-slate-900 block mt-0.5">
                  {formatCurrency(fornecedores)}
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                <span className="text-[10px] font-semibold text-slate-500 uppercase block truncate">
                  Custo Mercadorias (CMV)
                </span>
                <span className="text-sm font-bold text-red-600 block mt-0.5">
                  {formatCurrency(cmv)}
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                <span className="text-[10px] font-semibold text-slate-500 uppercase block truncate">
                  Receita de Vendas (RB/RL)
                </span>
                <span className="text-sm font-bold text-blue-700 block mt-0.5">
                  {formatCurrency(receitaBaseVendas)}
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-blue-50/60 border border-blue-200">
                <span className="text-[10px] font-bold text-blue-700 uppercase block truncate">
                  Ativo Circulante (AC)
                </span>
                <span className="text-sm font-extrabold text-[#0B1F3A] block mt-0.5">
                  {formatCurrency(ac)}
                </span>
              </div>
            </div>
          </div>

          {/* 3. Resumo dos Ciclos em Destaque */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Card Ciclo Operacional */}
            <Card className="bg-gradient-to-br from-blue-900 to-[#0B1F3A] text-white border-blue-800 shadow-md">
              <CardContent className="p-5 flex flex-col justify-between h-full space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-200 flex items-center gap-1.5">
                    <Repeat className="w-4 h-4 text-blue-400" />
                    Ciclo Operacional
                  </span>
                  <Badge
                    className={`font-bold text-xs uppercase px-2 py-0.5 ${
                      getCoStatus(cicloOperacionalValor) === 'verde'
                        ? 'bg-emerald-500 text-white'
                        : getCoStatus(cicloOperacionalValor) === 'ambar'
                          ? 'bg-amber-500 text-slate-900'
                          : 'bg-red-500 text-white'
                    }`}
                  >
                    {getCoStatusTexto(cicloOperacionalValor)}
                  </Badge>
                </div>

                <div>
                  <div className="text-3xl font-extrabold tracking-tight text-white">
                    {cicloOperacionalValor !== null
                      ? `${formatNumber(cicloOperacionalValor, 1)} dias`
                      : '—'}
                  </div>
                  <p className="text-xs text-blue-200/90 mt-1">
                    PME ({pmeValor !== null ? formatNumber(pmeValor, 1) : '—'}d) + PMR (
                    {pmrValor !== null ? formatNumber(pmrValor, 1) : '—'}d)
                  </p>
                </div>

                <p className="text-[11px] text-slate-300 leading-relaxed border-t border-white/10 pt-2">
                  A empresa leva{' '}
                  <strong className="text-white">
                    {cicloOperacionalValor !== null
                      ? `${formatNumber(cicloOperacionalValor, 1)} dias`
                      : 'X dias'}
                  </strong>{' '}
                  desde a compra da matéria-prima até o efetivo recebimento das vendas.
                </p>
              </CardContent>
            </Card>

            {/* Card Ciclo Financeiro (Ciclo de Caixa) */}
            <Card
              className={`text-white border shadow-md ${
                cicloFinanceiroValor !== null && cicloFinanceiroValor < 0
                  ? 'bg-gradient-to-br from-emerald-950 via-[#0B1F3A] to-slate-900 border-emerald-700'
                  : getCfStatus(cicloFinanceiroValor) === 'verde'
                    ? 'bg-gradient-to-br from-emerald-900 to-[#0B1F3A] border-emerald-800'
                    : getCfStatus(cicloFinanceiroValor) === 'ambar'
                      ? 'bg-gradient-to-br from-amber-950 to-[#0B1F3A] border-amber-800'
                      : 'bg-gradient-to-br from-red-950 to-[#0B1F3A] border-red-800'
              }`}
            >
              <CardContent className="p-5 flex flex-col justify-between h-full space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-200 flex items-center gap-1.5">
                    <Wallet className="w-4 h-4 text-emerald-400" />
                    Ciclo Financeiro (Caixa)
                  </span>
                  <Badge
                    className={`font-bold text-xs uppercase px-2 py-0.5 ${
                      getCfStatus(cicloFinanceiroValor) === 'verde'
                        ? 'bg-emerald-500 text-white'
                        : getCfStatus(cicloFinanceiroValor) === 'ambar'
                          ? 'bg-amber-500 text-slate-900'
                          : 'bg-red-500 text-white'
                    }`}
                  >
                    {getCfStatusTexto(cicloFinanceiroValor)}
                  </Badge>
                </div>

                <div>
                  <div className="text-3xl font-extrabold tracking-tight text-white">
                    {cicloFinanceiroValor !== null
                      ? `${formatNumber(cicloFinanceiroValor, 1)} dias`
                      : '—'}
                  </div>
                  <p className="text-xs text-emerald-200/90 mt-1">
                    Ciclo Operacional − PMP ({pmpValor !== null ? formatNumber(pmpValor, 1) : '—'}d)
                  </p>
                </div>

                <p className="text-[11px] text-slate-300 leading-relaxed border-t border-white/10 pt-2">
                  {cicloFinanceiroValor !== null && cicloFinanceiroValor < 0 ? (
                    <span className="text-emerald-300 font-semibold">
                      Excelente: a empresa recebe dos clientes antes de pagar os fornecedores
                      (autofinanciamento).
                    </span>
                  ) : (
                    <span>
                      Intervalo de{' '}
                      <strong className="text-white">
                        {cicloFinanceiroValor !== null
                          ? `${formatNumber(cicloFinanceiroValor, 1)} dias`
                          : 'X dias'}
                      </strong>{' '}
                      que demanda suporte de capital de giro até a entrada das receitas.
                    </span>
                  )}
                </p>
              </CardContent>
            </Card>

            {/* Card Análise do Fluxo Operacional */}
            <Card className="bg-white border-slate-200 shadow-2xs">
              <CardContent className="p-5 flex flex-col justify-between h-full space-y-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">
                    <Timer className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wider text-[#0B1F3A]">
                    Equilíbrio de Tesouraria
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-slate-600 leading-relaxed">
                  <div className="flex justify-between items-center py-1 border-b border-slate-100">
                    <span className="text-slate-500">Prazo Fornecedores (PMP):</span>
                    <strong className="text-slate-900 font-mono">
                      {pmpValor !== null ? `${formatNumber(pmpValor, 1)} dias` : '—'}
                    </strong>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-100">
                    <span className="text-slate-500">Prazo Recebimento (PMR):</span>
                    <strong className="text-slate-900 font-mono">
                      {pmrValor !== null ? `${formatNumber(pmrValor, 1)} dias` : '—'}
                    </strong>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-slate-500">Prazo Estocagem (PME):</span>
                    <strong className="text-slate-900 font-mono">
                      {pmeValor !== null ? `${formatNumber(pmeValor, 1)} dias` : '—'}
                    </strong>
                  </div>
                </div>

                <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 text-[11px] text-slate-600">
                  {pmpValor && pmeValor && pmrValor && pmpValor >= pmeValor + pmrValor ? (
                    <span className="text-emerald-700 font-medium">
                      ✓ Fornecedores financiam integralmente todo o ciclo operacional.
                    </span>
                  ) : (
                    <span className="text-slate-600">
                      Necessidade de Capital de Giro cobrindo{' '}
                      <strong>
                        {cicloFinanceiroValor !== null
                          ? Math.max(0, Number(cicloFinanceiroValor.toFixed(0)))
                          : 0}{' '}
                        dias
                      </strong>{' '}
                      de operação.
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 4. Gráfico de Barras Horizontal (Recharts): Comparativo PME, PMR e PMP */}
          <Card className="bg-white border-slate-200 shadow-2xs">
            <CardHeader className="pb-2 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">
                    <BarChart3 className="w-4 h-4" />
                  </div>
                  <CardTitle className="text-base font-bold text-[#0B1F3A]">
                    Comparativo Visual dos Prazos Médios (PME vs PMR vs PMP) · {selectedAno}
                  </CardTitle>
                </div>
                <CardDescription className="text-xs mt-0.5">
                  Comparação em dias com coloração condicional de eficiência operacional (verde,
                  âmbar e vermelho)
                </CardDescription>
              </div>

              {/* Legenda */}
              <div className="flex items-center gap-3 text-[11px] font-semibold flex-wrap">
                <span className="flex items-center gap-1 text-emerald-700">
                  <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                  Favorável / Eficiente
                </span>
                <span className="flex items-center gap-1 text-amber-700">
                  <span className="w-2.5 h-2.5 rounded-sm bg-amber-500" />
                  Atenção / Neutro
                </span>
                <span className="flex items-center gap-1 text-red-700">
                  <span className="w-2.5 h-2.5 rounded-sm bg-red-500" />
                  Alerta / Ineficiente
                </span>
              </div>
            </CardHeader>

            <CardContent className="pt-6">
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={dadosGraficoPrazos}
                    margin={{ top: 10, right: 40, left: 60, bottom: 10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
                    <XAxis
                      type="number"
                      domain={[0, (dataMax: number) => Math.max(90, Math.ceil(dataMax * 1.2))]}
                      tick={{ fontSize: 11, fill: '#64748B' }}
                      tickFormatter={(v) => `${v}d`}
                    />
                    <YAxis
                      dataKey="sigla"
                      type="category"
                      tick={{ fontSize: 12, fill: '#0B1F3A', fontWeight: 700 }}
                      width={130}
                    />
                    <RechartsTooltip
                      formatter={(val: any, name: any, item: any) => [
                        `${formatNumber(Number(val), 1)} dias (${item.payload.statusTexto})`,
                        item.payload.nome,
                      ]}
                      labelFormatter={(label: any) => `Indicador: ${label}`}
                    />
                    <Bar dataKey="valor" radius={[0, 6, 6, 0]} barSize={26}>
                      {dadosGraficoPrazos.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={getBarColor(entry.status)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Tabela Resumo abaixo do Gráfico */}
              <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-3 text-center text-xs">
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="font-bold text-slate-800 block">
                    Prazo Médio de Estocagem (PME)
                  </span>
                  <span className="text-[10px] text-slate-500 block truncate">
                    Tempo médio em estoque
                  </span>
                  <span
                    className={`text-base font-extrabold block mt-1 ${
                      getPmeStatus(pmeValor) === 'verde'
                        ? 'text-emerald-600'
                        : getPmeStatus(pmeValor) === 'ambar'
                          ? 'text-amber-600'
                          : 'text-red-600'
                    }`}
                  >
                    {pmeValor !== null ? `${formatNumber(pmeValor, 1)} dias` : '—'}
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="font-bold text-slate-800 block">
                    Prazo Médio de Recebimento (PMR)
                  </span>
                  <span className="text-[10px] text-slate-500 block truncate">
                    Tempo de entrada de vendas
                  </span>
                  <span
                    className={`text-base font-extrabold block mt-1 ${
                      getPmrStatus(pmrValor) === 'verde'
                        ? 'text-emerald-600'
                        : getPmrStatus(pmrValor) === 'ambar'
                          ? 'text-amber-600'
                          : 'text-red-600'
                    }`}
                  >
                    {pmrValor !== null ? `${formatNumber(pmrValor, 1)} dias` : '—'}
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="font-bold text-slate-800 block">
                    Prazo Médio de Pagamento (PMP)
                  </span>
                  <span className="text-[10px] text-slate-500 block truncate">
                    Prazo obtido com fornecedores
                  </span>
                  <span
                    className={`text-base font-extrabold block mt-1 ${
                      getPmpStatus(pmpValor) === 'verde'
                        ? 'text-emerald-600'
                        : getPmpStatus(pmpValor) === 'ambar'
                          ? 'text-amber-600'
                          : 'text-red-600'
                    }`}
                  >
                    {pmpValor !== null ? `${formatNumber(pmpValor, 1)} dias` : '—'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 5. Grid dos 8 Cards Individuais de Indicadores */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-[#0B1F3A] flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-600" />
                Detalhamento dos 8 Indicadores de Eficiência Operacional
              </h2>
              <span className="text-xs text-slate-500">
                Clique em "Ver Detalhes do Cálculo" para inspecionar variáveis contábeis
              </span>
            </div>

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
                            <code className="text-xs font-mono font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200 mt-0.5 inline-block">
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
                              {ind.valor !== null
                                ? ind.unidade === 'dias'
                                  ? `${formatNumber(ind.valor, 1)} dias`
                                  : `${formatNumber(ind.valor, 2)}x / ano`
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
                                ? 'Ocultar Detalhes do Cálculo'
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
                                      <span className="font-semibold text-slate-800">
                                        {v.label}
                                      </span>
                                      {v.detalhes && (
                                        <span className="text-[10px] text-slate-500 block truncate">
                                          {v.detalhes}
                                        </span>
                                      )}
                                    </div>
                                    <span className="font-mono font-bold text-slate-900 shrink-0">
                                      {v.isCurrency
                                        ? formatCurrency(v.valor)
                                        : `${formatNumber(v.valor, 1)} ${ind.unidade}`}
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
          </div>

          {/* 6. Análise Consolidada do Consultor: Diagnóstico Executivo */}
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
                        Parecer executivo sobre eficiência operacional, gargalos de prazos e impacto
                        no capital de giro · Exercício {selectedAno}
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
                    1. Diagnóstico dos Ciclos e Eficiência Operacional
                  </span>
                  <p className="text-slate-200 leading-relaxed">
                    {parecerConsolidado.detalhesPosicao}
                  </p>
                </div>

                <div className="bg-white/5 p-4 rounded-xl border border-white/10 space-y-1.5">
                  <span className="font-bold text-emerald-300 uppercase tracking-wider text-[11px] block">
                    2. Recomendações Estratégicas e Otimização do Capital de Giro
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
