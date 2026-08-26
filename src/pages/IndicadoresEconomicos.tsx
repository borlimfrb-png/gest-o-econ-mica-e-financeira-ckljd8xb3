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
  formatPercent,
  formatCnpj,
} from '@/lib/financeCalculations'
import { useRealtime } from '@/hooks/use-realtime'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
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
  TrendingDown,
  Building2,
  Calendar,
  Download,
  ShieldCheck,
  AlertCircle,
  PlusCircle,
  Layers,
  Info,
  Scale,
  BarChart3,
  CheckCircle2,
  DollarSign,
  Activity,
  ArrowRight,
  GitMerge,
  Sparkles,
  SlidersHorizontal,
  Check,
  HelpCircle,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export default function IndicadoresEconomicos() {
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

  // WACC configurável pelo usuário (valor padrão 12% a.a.)
  const [wacc, setWacc] = useState<number>(12)

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
      console.error('Erro ao carregar balanços e DRE para indicadores econômicos:', err)
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

  // Demonstrações do ano selecionado
  const balancoAtual = useMemo(
    () => balancos.find((b) => b.ano === selectedAno) || null,
    [balancos, selectedAno],
  )
  const dreAtual = useMemo(
    () => dres.find((d) => d.ano === selectedAno) || null,
    [dres, selectedAno],
  )

  // Demonstrações do ano anterior (para comparar NOPAT crescente vs em queda)
  const balancoAnterior = useMemo(
    () => balancos.find((b) => b.ano === selectedAno - 1) || null,
    [balancos, selectedAno],
  )
  const dreAnterior = useMemo(
    () => dres.find((d) => d.ano === selectedAno - 1) || null,
    [dres, selectedAno],
  )

  const calcB = useMemo(() => calcularBalanco(balancoAtual), [balancoAtual])
  const calcD = useMemo(() => calcularDre(dreAtual), [dreAtual])

  const calcBAnterior = useMemo(() => calcularBalanco(balancoAnterior), [balancoAnterior])
  const calcDAnterior = useMemo(() => calcularDre(dreAnterior), [dreAnterior])

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

  // ================= 1. CÁLCULOS NOPAT =================
  // EBIT = Lucro Operacional (Receita Líquida - Custos - Despesas Operacionais)
  const rl = calcD.receitaLiquida
  const ebit = calcD.resultadoOperacional
  const lair = calcD.resultadoAntesIR
  const irCsll = dreAtual?.imposto_renda || 0
  const ll = calcD.lucroLiquido

  // Alíquota Efetiva: se houver dados de IR/CSLL no DRE e LAIR > 0, usar IR_CSLL / LAIR; senão 34% (0.34)
  const aliquotaEfetivaCalculada = useMemo(() => {
    if (irCsll > 0 && lair > 0) {
      const taxa = irCsll / lair
      // Limitando a valores realistas (entre 0% e 50%)
      if (taxa > 0 && taxa <= 0.5) return taxa
    }
    return 0.34
  }, [irCsll, lair])

  const nopat = useMemo(() => {
    return ebit * (1 - aliquotaEfetivaCalculada)
  }, [ebit, aliquotaEfetivaCalculada])

  const margemNopat = rl > 0 ? (nopat / rl) * 100 : null

  // NOPAT do ano anterior para cálculo de evolução
  const nopatAnterior = useMemo(() => {
    if (!dreAnterior) return null
    const ebitAnt = calcDAnterior.resultadoOperacional
    const lairAnt = calcDAnterior.resultadoAntesIR
    const irAnt = dreAnterior.imposto_renda || 0
    let aliqAnt = 0.34
    if (irAnt > 0 && lairAnt > 0) {
      const taxa = irAnt / lairAnt
      if (taxa > 0 && taxa <= 0.5) aliqAnt = taxa
    }
    return ebitAnt * (1 - aliqAnt)
  }, [dreAnterior, calcDAnterior])

  // Badge NOPAT: 🟢 NOPAT positivo e crescente vs ano anterior, 🟠 positivo mas em queda, 🔴 negativo
  const nopatStatus: 'verde' | 'ambar' | 'vermelho' | 'indefinido' = useMemo(() => {
    if (!dreAtual) return 'indefinido'
    if (nopat < 0) return 'vermelho'
    if (nopatAnterior !== null) {
      return nopat >= nopatAnterior ? 'verde' : 'ambar'
    }
    // Sem ano anterior, se for positivo consideramos verde
    return nopat > 0 ? 'verde' : 'vermelho'
  }, [dreAtual, nopat, nopatAnterior])

  // ================= 2. CÁLCULOS EVA (Economic Value Added) =================
  // Capital Investido = Ativo Total - Passivo Circulante (operacional)
  // OU simplificado: (PC + PNC + PL) - Fornecedores - Obrigações Fiscais. Caso os dados sejam limitados, Ativo Total.
  const at = calcB.ativoTotal
  const pc = calcB.passivoCirculante
  const pl = calcB.patrimonioLiquido
  const fornecedores = balancoAtual?.fornecedores || 0
  const obrigTributarias = balancoAtual?.obrigacoes_tributarias || 0

  const capitalInvestido = useMemo(() => {
    if (!balancoAtual) return 0
    // Usando fórmula operacional padrão: Ativo Total - Passivo Circulante não oneroso (Fornecedores + Obrigações Fiscais)
    // Se Passivo Circulante operacional existir:
    const passivoOperacional = fornecedores + obrigTributarias
    if (at > passivoOperacional && passivoOperacional > 0) {
      return at - passivoOperacional
    }
    if (at > pc && pc > 0) {
      return at - pc
    }
    return at > 0 ? at : 0
  }, [balancoAtual, at, pc, fornecedores, obrigTributarias])

  const waccTaxa = wacc / 100 // Ex: 0.12

  // ROIC = NOPAT / Capital Investido
  const roic = capitalInvestido > 0 ? (nopat / capitalInvestido) * 100 : 0

  // Custo de Capital = Capital Investido × WACC
  const custoCapital = capitalInvestido * waccTaxa

  // EVA = NOPAT - (Capital Investido × WACC)
  const eva = nopat - custoCapital

  // Spread = ROIC - WACC
  const spread = roic - wacc

  // Badges EVA: 🟢 EVA > 0 (cria valor), 🟠 EVA ≈ 0 (neutro - entre -1% e +1% do capital ou abs < 5000), 🔴 EVA < 0 (destrói valor)
  const evaStatus: 'verde' | 'ambar' | 'vermelho' | 'indefinido' = useMemo(() => {
    if (!balancoAtual && !dreAtual) return 'indefinido'
    if (eva > 500) return 'verde'
    if (Math.abs(eva) <= 500) return 'ambar'
    return 'vermelho'
  }, [balancoAtual, dreAtual, eva])

  // ================= 3. MODELO DUPONT =================
  // Nível 1 — ROE: LL / PL * 100
  // Badge: 🟢 ≥ 15%, 🟠 5-15%, 🔴 < 5%
  const roe = pl > 0 ? (ll / pl) * 100 : null
  const getRoeBadgeStatus = (val: number | null): 'verde' | 'ambar' | 'vermelho' | 'indefinido' => {
    if (val === null || isNaN(val)) return 'indefinido'
    if (val >= 15) return 'verde'
    if (val >= 5) return 'ambar'
    return 'vermelho'
  }

  // Nível 2 — Decomposição em 3 fatores:
  // 1. Margem Líquida = LL / Receita Líquida * 100 (Badge: 🟢 ≥ 10%, 🟠 5-10%, 🔴 < 5%)
  const margemLiquida = rl > 0 ? (ll / rl) * 100 : null
  const getMargemLiquidaStatus = (
    val: number | null,
  ): 'verde' | 'ambar' | 'vermelho' | 'indefinido' => {
    if (val === null || isNaN(val)) return 'indefinido'
    if (val >= 10) return 'verde'
    if (val >= 5) return 'ambar'
    return 'vermelho'
  }

  // 2. Giro do Ativo = Receita Líquida / Ativo Total (Badge: 🟢 ≥ 1,0x, 🟠 0,5-1,0x, 🔴 < 0,5x)
  const giroAtivo = at > 0 ? rl / at : null
  const getGiroAtivoStatus = (
    val: number | null,
  ): 'verde' | 'ambar' | 'vermelho' | 'indefinido' => {
    if (val === null || isNaN(val)) return 'indefinido'
    if (val >= 1.0) return 'verde'
    if (val >= 0.5) return 'ambar'
    return 'vermelho'
  }

  // 3. Alavancagem Financeira (Multiplicador de Alavancagem Patrimonial) = Ativo Total / PL (Badge: 🟢 1,5-3,0x, 🟠 3,0-5,0x, 🔴 > 5,0x ou < 1,0x)
  const alavancagemFinanceira = pl > 0 ? at / pl : null
  const getAlavancagemStatus = (
    val: number | null,
  ): 'verde' | 'ambar' | 'vermelho' | 'indefinido' => {
    if (val === null || isNaN(val)) return 'indefinido'
    if (val >= 1.5 && val <= 3.0) return 'verde'
    if (val > 3.0 && val <= 5.0) return 'ambar'
    if (val >= 1.0 && val < 1.5) return 'ambar'
    return 'vermelho'
  }

  // Verificação DuPont 3 fatores: (Margem Líquida / 100) * Giro do Ativo * Alavancagem Financeira * 100 = ROE
  const roeDuPontVerificado = useMemo(() => {
    if (margemLiquida !== null && giroAtivo !== null && alavancagemFinanceira !== null) {
      return (margemLiquida / 100) * giroAtivo * alavancagemFinanceira * 100
    }
    return null
  }, [margemLiquida, giroAtivo, alavancagemFinanceira])

  // Nível 3 — DuPont Estendida (5 fatores / 4 fatores com LAIR)
  // Carga Tributária = LL / LAIR (índice de retenção de lucro após impostos)
  const cargaTributaria = lair !== 0 ? ll / lair : null
  // Margem Operacional = LAIR / Receita Líquida
  const margemOperacionalLair = rl > 0 && lair !== 0 ? (lair / rl) * 100 : null
  // ROE Estendido = Margem Operacional * Giro do Ativo * Alavancagem * Carga Tributária
  const roeDuPontEstendido = useMemo(() => {
    if (
      margemOperacionalLair !== null &&
      giroAtivo !== null &&
      alavancagemFinanceira !== null &&
      cargaTributaria !== null
    ) {
      return (
        (margemOperacionalLair / 100) * giroAtivo * alavancagemFinanceira * cargaTributaria * 100
      )
    }
    return null
  }, [margemOperacionalLair, giroAtivo, alavancagemFinanceira, cargaTributaria])

  // ================= 4. DADOS PARA GRÁFICO RECHARTS =================
  // Gráfico de Barras comparando NOPAT vs Lucro Líquido vs EBIT
  const dadosGraficoComparativo = useMemo(() => {
    return [
      {
        nome: 'EBIT (Lucro Operacional)',
        sigla: 'EBIT',
        valor: Number(ebit.toFixed(2)),
        descricao: 'Resultado operacional antes de juros e tributos',
        cor: '#3B82F6', // blue-500
      },
      {
        nome: 'NOPAT (Operacional Líquido)',
        sigla: 'NOPAT',
        valor: Number(nopat.toFixed(2)),
        descricao: 'Lucro operacional após tributação (EBIT × (1 - t))',
        cor: nopat >= 0 ? '#10B981' : '#EF4444', // emerald / red
      },
      {
        nome: 'Lucro Líquido (LL)',
        sigla: 'Lucro Líquido',
        valor: Number(ll.toFixed(2)),
        descricao: 'Resultado final para os sócios após despesas financeiras e IRPJ',
        cor: ll >= 0 ? '#6366F1' : '#DC2626', // indigo / red-600
      },
    ]
  }, [ebit, nopat, ll])

  // ================= 5. PARECER CONSOLIDADO DO CONSULTOR =================
  const parecerConsolidado = useMemo(() => {
    if (!balancoAtual && !dreAtual) return null

    let nivel: 'excelente' | 'adequado' | 'alerta' | 'critico' = 'adequado'
    let titulo = ''
    let diagnosticoCriacaoValor = ''
    let diagnosticoEficiencia = ''
    let diagnosticoEstruturaCapital = ''
    let recomendacao = ''

    // Avaliação EVA e NOPAT
    if (eva > 0 && roic >= wacc) {
      if (roe && roe >= 15) {
        nivel = 'excelente'
        titulo = 'Alta Geração de Valor Econômico e Eficiência Global de Capital'
      } else {
        nivel = 'adequado'
        titulo = 'Geração de Valor Econômico Positiva com Desempenho Operacional Estável'
      }
      diagnosticoCriacaoValor = `A empresa gerou um EVA (Economic Value Added) positivo de ${formatCurrency(
        eva,
      )} no exercício de ${selectedAno}. Com ROIC de ${formatPercent(
        roic,
        1,
      )} superior ao custo médio ponderado de capital (WACC de ${formatPercent(
        wacc,
        1,
      )}), a operação gerou um spread econômico favorável de +${formatPercent(
        spread,
        1,
      )}. A empresa gera retorno acima do custo de capital, criando valor real para os acionistas.`
    } else if (Math.abs(eva) <= 500 || Math.abs(spread) <= 1.0) {
      nivel = 'alerta'
      titulo = 'Equilíbrio Econômico Neutro: Retorno Operacional Empatado com Custo de Capital'
      diagnosticoCriacaoValor = `O EVA apurado em ${formatCurrency(
        eva,
      )} indica situação de neutralidade na criação de riqueza (ROIC de ${formatPercent(
        roic,
        1,
      )} praticamente igual ao WACC de ${formatPercent(
        wacc,
        1,
      )}). A operação remunera estritamente os custos dos capitais empregados, sem excedente econômico expressivo.`
    } else {
      nivel = 'critico'
      titulo = 'Destruição de Valor Econômico: Custo de Capital Supera o Retorno Operacional'
      diagnosticoCriacaoValor = `Com EVA negativo de ${formatCurrency(
        eva,
      )}, a empresa destrói valor no período analisado, pois o retorno operacional (ROIC de ${formatPercent(
        roic,
        1,
      )}) não cobre o custo do capital investido (WACC de ${formatPercent(
        wacc,
        1,
      )}), gerando um spread negativo de ${formatPercent(
        spread,
        1,
      )}. Cada real adicional investido consome mais recursos do que é capaz de remunerar.`
    }

    // Avaliação DuPont
    const mlStr = margemLiquida !== null ? formatPercent(margemLiquida, 1) : '—'
    const gaStr = giroAtivo !== null ? `${formatNumber(giroAtivo, 2)}x` : '—'
    const alavStr =
      alavancagemFinanceira !== null ? `${formatNumber(alavancagemFinanceira, 2)}x` : '—'
    const roeStr = roe !== null ? formatPercent(roe, 1) : '—'

    diagnosticoEficiencia = `Pelo Modelo DuPont, o ROE de ${roeStr} é composto pela multiplicação da Margem Líquida (${mlStr}), Giro do Ativo (${gaStr}) e Alavancagem Financeira (${alavStr}). ${
      margemLiquida && margemLiquida >= 10
        ? 'A eficiência operacional é o principal vetor de lucratividade da empresa, indicando sólida precificação e controle de custos.'
        : margemLiquida && margemLiquida >= 5
          ? 'A empresa opera com margem líquida moderada, dependendo do volume de negócios para potencializar o retorno dos sócios.'
          : 'A baixa margem líquida é o principal fator restritivo da rentabilidade global da companhia.'
    }`

    diagnosticoEstruturaCapital = `Em termos de estrutura patrimonial, a alavancagem de ${alavStr} ${
      alavancagemFinanceira && alavancagemFinanceira > 4.0
        ? 'indica dependência excessiva de capital de terceiros, elevando o risco financeiro e os encargos de juros.'
        : alavancagemFinanceira && alavancagemFinanceira >= 1.5
          ? 'encontra-se em patamar equilibrado e saudável, alavancando os retornos do patrimônio líquido sem expor a empresa a risco de solvência.'
          : 'aponta para estrutura conservadora com baixo uso de dívida de terceiros, priorizando a segurança patrimonial.'
    }`

    // Recomendações
    if (nivel === 'critico') {
      recomendacao =
        '1) Otimizar urgentemente a margem operacional NOPAT revisando a precificação de vendas e cortando despesas fixas; 2) Desmobilizar ativos ociosos ou reduzir estoques para enxugar o Capital Investido; 3) Renegociar dívidas bancárias onerosas para reduzir a alíquota do WACC; 4) Monitorar mensalmente a geração de caixa operacional livre.'
    } else if (nivel === 'alerta') {
      recomendacao =
        '1) Focar no aumento do Giro do Ativo por meio de ações comerciais estratégicas; 2) Manter disciplina rígida no custo de aquisição de insumos para expandir a margem NOPAT; 3) Avaliar a estrutura de capital para baratear o custo médio dos financiamentos.'
    } else {
      recomendacao =
        '1) Reinvestir parte do valor econômico gerado em projetos de expansão com TIR superior ao WACC; 2) Preservar a vantagem competitiva de custos e margem operacional; 3) Planejar a distribuição equilibrada de proventos aos sócios assegurando a manutenção do capital de giro.'
    }

    return {
      nivel,
      titulo,
      diagnosticoCriacaoValor,
      diagnosticoEficiencia,
      diagnosticoEstruturaCapital,
      recomendacao,
    }
  }, [
    balancoAtual,
    dreAtual,
    selectedAno,
    nopat,
    capitalInvestido,
    wacc,
    roic,
    eva,
    spread,
    roe,
    margemLiquida,
    giroAtivo,
    alavancagemFinanceira,
  ])

  // ================= 6. EXPORTAÇÃO CSV =================
  const handleExportCsv = () => {
    if (!selectedEmpresa) {
      toast({
        title: 'Selecione uma empresa',
        description: 'É necessário selecionar uma empresa para exportar os indicadores econômicos.',
        variant: 'destructive',
      })
      return
    }

    let csvContent = '\uFEFF' // BOM UTF-8
    const dataEmissao = new Date().toLocaleDateString('pt-BR')

    csvContent += `RELATÓRIO DE INDICADORES ECONÔMICOS AVANÇADOS (NOPAT, EVA & MODELO DUPONT)\n`
    csvContent += `EMPRESA;${selectedEmpresa.nome}\n`
    csvContent += `CNPJ;${formatCnpj(selectedEmpresa.cnpj)}\n`
    csvContent += `SEGMENTO;${selectedEmpresa.segmento}\n`
    csvContent += `EXERCÍCIO;${selectedAno}\n`
    csvContent += `DATA DE EMISSÃO;${dataEmissao}\n`
    csvContent += `WACC ADOTADO;${wacc.toFixed(1).replace('.', ',')}%\n\n`

    csvContent += `BASES CONTÁBEIS E ECONÔMICAS (R$)\n`
    csvContent += `Receita Líquida (RL);${rl.toFixed(2).replace('.', ',')}\n`
    csvContent += `EBIT (Lucro Operacional);${ebit.toFixed(2).replace('.', ',')}\n`
    csvContent += `Alíquota Efetiva de Tributação;${(aliquotaEfetivaCalculada * 100).toFixed(1).replace('.', ',')}%\n`
    csvContent += `NOPAT;${nopat.toFixed(2).replace('.', ',')}\n`
    csvContent += `Ativo Total;${at.toFixed(2).replace('.', ',')}\n`
    csvContent += `Passivo Circulante;${pc.toFixed(2).replace('.', ',')}\n`
    csvContent += `Patrimônio Líquido;${pl.toFixed(2).replace('.', ',')}\n`
    csvContent += `Capital Investido;${capitalInvestido.toFixed(2).replace('.', ',')}\n`
    csvContent += `Custo de Capital (Capital × WACC);${custoCapital.toFixed(2).replace('.', ',')}\n`
    csvContent += `EVA (Economic Value Added);${eva.toFixed(2).replace('.', ',')}\n`
    csvContent += `Lucro Líquido (LL);${ll.toFixed(2).replace('.', ',')}\n\n`

    csvContent += `TABELA DE INDICADORES ECONÔMICOS E DUPONT\n`
    csvContent += `Indicador;Fórmula;Valor;Unidade;Classificação;Interpretação\n`

    // 1. NOPAT
    const nopatClass =
      nopatStatus === 'verde'
        ? 'Ótimo (Positivo e Crescente)'
        : nopatStatus === 'ambar'
          ? 'Atenção (Positivo em Queda)'
          : 'Crítico (Negativo)'
    const nopatInterp =
      nopat >= 0
        ? `Lucro operacional líquido gerado exclusivamente pela atividade-fim após dedução de tributos sobre a operação.`
        : `Prejuízo operacional líquido após tributos.`
    csvContent += `NOPAT;EBIT × (1 - Alíquota Efetiva);${nopat.toFixed(2).replace('.', ',')};R$;${nopatClass};${nopatInterp}\n`

    // Margem NOPAT
    const mNopatVal = margemNopat !== null ? margemNopat.toFixed(2).replace('.', ',') : 'N/D'
    csvContent += `Margem NOPAT;NOPAT / Receita Líquida × 100;${mNopatVal};%;${nopatClass};Percentual de conversão de faturamento líquido em lucro operacional livre de impostos.\n`

    // 2. EVA
    const evaClass =
      evaStatus === 'verde'
        ? 'Ótimo (Cria Valor)'
        : evaStatus === 'ambar'
          ? 'Bom / Neutro'
          : 'Crítico (Destrói Valor)'
    const evaInterp =
      eva > 0
        ? `A empresa gera retorno acima do custo de capital (${roic.toFixed(1)}% vs WACC ${wacc.toFixed(1)}%), criando valor para os acionistas.`
        : `A empresa destrói valor, pois o retorno operacional (${roic.toFixed(1)}%) não cobre o custo do capital investido (WACC ${wacc.toFixed(1)}%).`
    csvContent += `EVA (Economic Value Added);NOPAT - (Capital Investido × WACC);${eva.toFixed(2).replace('.', ',')};R$;${evaClass};${evaInterp}\n`

    // ROIC
    csvContent += `ROIC;NOPAT / Capital Investido × 100;${roic.toFixed(2).replace('.', ',')};%;${roic >= wacc ? 'Ótimo' : 'Crítico'};Retorno percentual gerado sobre todo o capital investido na operação.\n`

    // Spread Econômico
    csvContent += `Spread Econômico;ROIC - WACC;${spread.toFixed(2).replace('.', ',')};p.p.;${spread >= 0 ? 'Ótimo' : 'Crítico'};Diferença entre a taxa de retorno operacional e a taxa de custo de capital.\n`

    // 3. DuPont - ROE
    const roeClass =
      getRoeBadgeStatus(roe) === 'verde'
        ? 'Ótimo'
        : getRoeBadgeStatus(roe) === 'ambar'
          ? 'Atenção'
          : 'Crítico'
    const roeVal = roe !== null ? roe.toFixed(2).replace('.', ',') : 'N/D'
    csvContent += `ROE (Modelo DuPont Nível 1);LL / PL × 100;${roeVal};%;${roeClass};Remuneração final do capital próprio dos sócios.\n`

    // DuPont Fator 1 - Margem Líquida
    const mlClass =
      getMargemLiquidaStatus(margemLiquida) === 'verde'
        ? 'Ótimo'
        : getMargemLiquidaStatus(margemLiquida) === 'ambar'
          ? 'Bom'
          : 'Crítico'
    const mlVal = margemLiquida !== null ? margemLiquida.toFixed(2).replace('.', ',') : 'N/D'
    csvContent += `Margem Líquida (DuPont Nível 2);LL / Receita Líquida × 100;${mlVal};%;${mlClass};Eficiência operacional e poder de retenção de lucro nas vendas.\n`

    // DuPont Fator 2 - Giro do Ativo
    const gaClass =
      getGiroAtivoStatus(giroAtivo) === 'verde'
        ? 'Ótimo'
        : getGiroAtivoStatus(giroAtivo) === 'ambar'
          ? 'Bom'
          : 'Crítico'
    const gaVal = giroAtivo !== null ? giroAtivo.toFixed(2).replace('.', ',') : 'N/D'
    csvContent += `Giro do Ativo (DuPont Nível 2);Receita Líquida / Ativo Total;${gaVal};x;${gaClass};Eficiência e velocidade no uso dos ativos totais para gerar receitas.\n`

    // DuPont Fator 3 - Alavancagem Financeira
    const alavClass =
      getAlavancagemStatus(alavancagemFinanceira) === 'verde'
        ? 'Ótimo (Equilibrada)'
        : getAlavancagemStatus(alavancagemFinanceira) === 'ambar'
          ? 'Atenção'
          : 'Crítico (Excessiva ou Subaproveitada)'
    const alavVal =
      alavancagemFinanceira !== null ? alavancagemFinanceira.toFixed(2).replace('.', ',') : 'N/D'
    csvContent += `Alavancagem Financeira (DuPont Nível 2);Ativo Total / PL;${alavVal};x;${alavClass};Multiplicador de alavancagem e uso de capital de terceiros sobre o capital próprio.\n`

    if (parecerConsolidado) {
      csvContent += `\nPARECER CONSOLIDADO DO CONSULTOR FINANCEIRO\n`
      csvContent += `Diagnóstico;${parecerConsolidado.titulo.replace(/;/g, ',')}\n`
      csvContent += `Criação de Valor Econômico;${parecerConsolidado.diagnosticoCriacaoValor.replace(/\n/g, ' ').replace(/;/g, ',')}\n`
      csvContent += `Eficiência Operacional (DuPont);${parecerConsolidado.diagnosticoEficiencia.replace(/\n/g, ' ').replace(/;/g, ',')}\n`
      csvContent += `Estrutura de Capital;${parecerConsolidado.diagnosticoEstruturaCapital.replace(/\n/g, ' ').replace(/;/g, ',')}\n`
      csvContent += `Recomendações Práticas;${parecerConsolidado.recomendacao.replace(/\n/g, ' ').replace(/;/g, ',')}\n`
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `indicadores-economicos-${selectedEmpresa.nome.replace(/\s+/g, '-').toLowerCase()}-${selectedAno}.csv`
    link.click()
    URL.revokeObjectURL(link.href)

    toast({
      title: 'CSV exportado com sucesso!',
      description: `Relatório de Indicadores Econômicos (${selectedAno}) exportado com sucesso.`,
    })
  }

  if (loading && !balancoAtual && !dreAtual && balancos.length === 0) {
    return (
      <div className="py-20 flex flex-col justify-center items-center gap-3">
        <div className="w-9 h-9 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs text-slate-500 font-medium">
          Carregando indicadores econômicos avançados...
        </span>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* 1. Header com Título, Seletores, Input WACC e Exportação CSV */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-lg shadow-md shadow-blue-600/20 shrink-0">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-extrabold text-[#0B1F3A] tracking-tight">
                Indicadores Econômicos (Análise Avançada)
              </h1>
              <Badge className="bg-blue-50 text-blue-700 border-blue-200 font-semibold text-xs">
                NOPAT · EVA · DuPont
              </Badge>
            </div>
            <p className="text-xs text-[#5B6B7F] mt-0.5">
              Avaliação de criação de valor econômico agregado, retorno operacional sobre o capital
              e decomposição do ROE
            </p>
          </div>
        </div>

        {/* Seletores Globais + Ajuste WACC + Botão CSV */}
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
              <SelectTrigger className="h-7 border-none shadow-none bg-transparent text-xs font-semibold text-slate-800 p-0 focus:ring-0 w-[70px]">
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

          {/* Input WACC Configurável */}
          <div
            className="flex items-center gap-1.5 bg-blue-50/70 border border-blue-200 rounded-lg px-2.5 py-1 text-xs"
            title="Custo Médio Ponderado de Capital"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-blue-700 shrink-0" />
            <span className="text-[11px] font-bold text-blue-900">WACC:</span>
            <Input
              type="number"
              step="0.5"
              min="1"
              max="100"
              value={wacc}
              onChange={(e) => setWacc(Number(e.target.value) || 0)}
              className="h-6 w-14 text-xs font-bold text-blue-900 bg-white border border-blue-300 rounded px-1.5 py-0 text-center focus-visible:ring-1 focus-visible:ring-blue-500"
            />
            <span className="text-xs font-bold text-blue-900">%</span>
          </div>

          {/* Botão Exportar CSV */}
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
                exercício de {selectedAno}. Cadastre as demonstrações para calcular NOPAT, EVA e
                Árvore DuPont.
              </p>
            </div>
            <div className="flex items-center gap-3 flex-wrap justify-center pt-2">
              {selectedEmpresaId && (
                <Button
                  onClick={() => navigate(`/empresas/${selectedEmpresaId}`)}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-9 shadow-xs"
                >
                  <PlusCircle className="w-4 h-4 mr-1.5" />
                  Cadastrar Demonstrações em {selectedEmpresa?.nome}
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
          {/* ================= SEÇÃO 1: NOPAT & EVA (Lado a lado em desktop) ================= */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-[#0B1F3A] flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-600" />
                Seção 1 — Criação de Valor Econômico: NOPAT &amp; EVA
              </h2>
              <span className="text-xs text-slate-500">
                WACC de Referência: <strong className="text-slate-800">{wacc}% a.a.</strong>
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Card NOPAT */}
              <Card className="bg-white border-slate-200 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden">
                <div>
                  <CardHeader className="p-5 pb-3 border-b border-slate-100 flex flex-row items-start justify-between gap-3 space-y-0">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                          NOPAT
                        </span>
                        <CardTitle className="text-base font-bold text-[#0B1F3A]">
                          Net Operating Profit After Tax
                        </CardTitle>
                      </div>
                      <CardDescription className="text-xs text-slate-500 mt-1">
                        Lucro Operacional Líquido após Impostos (sem efeito da estrutura de capital)
                      </CardDescription>
                    </div>

                    {nopatStatus === 'verde' ? (
                      <Badge className="bg-emerald-50 text-emerald-700 border-emerald-300 font-bold text-xs flex items-center gap-1.5 px-2.5 py-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />🟢
                        Positivo &amp; Em Alta
                      </Badge>
                    ) : nopatStatus === 'ambar' ? (
                      <Badge className="bg-amber-50 text-amber-700 border-amber-300 font-bold text-xs flex items-center gap-1.5 px-2.5 py-1">
                        <span className="w-2 h-2 rounded-full bg-amber-500" />🟠 Positivo em Queda
                      </Badge>
                    ) : (
                      <Badge className="bg-red-50 text-red-700 border-red-300 font-bold text-xs flex items-center gap-1.5 px-2.5 py-1">
                        <span className="w-2 h-2 rounded-full bg-red-500" />🔴 Negativo
                      </Badge>
                    )}
                  </CardHeader>

                  <CardContent className="p-5 pt-4 space-y-4">
                    {/* Valor e Margem */}
                    <div className="flex items-end justify-between gap-4 p-3.5 bg-gradient-to-r from-slate-50 to-emerald-50/40 rounded-xl border border-slate-100">
                      <div>
                        <span className="text-[11px] font-semibold uppercase text-slate-500 block">
                          Fórmula de Cálculo
                        </span>
                        <code className="text-xs font-mono font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200 mt-0.5 inline-block">
                          EBIT × (1 - Alíquota Efetiva)
                        </code>
                        <div className="text-[11px] text-slate-600 mt-1.5 space-y-0.5">
                          <span>
                            EBIT: <strong>{formatCurrency(ebit)}</strong>
                          </span>
                          <span className="mx-1.5">·</span>
                          <span>
                            Alíquota:{' '}
                            <strong>{(aliquotaEfetivaCalculada * 100).toFixed(1)}%</strong>
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-[10px] font-semibold uppercase text-slate-400 block">
                          NOPAT Apurado
                        </span>
                        <div
                          className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${
                            nopat >= 0 ? 'text-emerald-600' : 'text-red-600'
                          }`}
                        >
                          {formatCurrency(nopat)}
                        </div>
                        {margemNopat !== null && (
                          <span className="text-xs font-bold text-slate-600 block mt-0.5">
                            Margem NOPAT: {formatPercent(margemNopat, 1)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Comparativo vs Ano Anterior */}
                    {nopatAnterior !== null && (
                      <div className="flex items-center justify-between text-xs p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                        <span className="text-slate-600">
                          Exercício Anterior ({selectedAno - 1}):{' '}
                          <strong className="text-slate-800">
                            {formatCurrency(nopatAnterior)}
                          </strong>
                        </span>
                        <div className="flex items-center gap-1 font-bold">
                          {nopat >= nopatAnterior ? (
                            <span className="text-emerald-600 flex items-center">
                              <TrendingUp className="w-3.5 h-3.5 mr-1" />+
                              {nopatAnterior !== 0
                                ? formatPercent(
                                    ((nopat - nopatAnterior) / Math.abs(nopatAnterior)) * 100,
                                    1,
                                  )
                                : '0%'}
                            </span>
                          ) : (
                            <span className="text-amber-600 flex items-center">
                              <TrendingDown className="w-3.5 h-3.5 mr-1" />
                              {nopatAnterior !== 0
                                ? formatPercent(
                                    ((nopat - nopatAnterior) / Math.abs(nopatAnterior)) * 100,
                                    1,
                                  )
                                : '0%'}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Interpretação */}
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        <Info className="w-3.5 h-3.5 text-blue-600" />
                        Interpretação Econômica
                      </span>
                      <p className="text-xs leading-relaxed text-slate-700 bg-slate-50/70 p-3 rounded-lg border border-slate-200/70">
                        {nopat >= 0
                          ? `A empresa produziu ${formatCurrency(
                              nopat,
                            )} de lucro puramente operacional livre de impostos sobre o resultado. Representa ${
                              margemNopat !== null ? formatPercent(margemNopat, 1) : '—'
                            } de cada real faturado na receita líquida, medindo o desempenho da atividade-fim isolada de dívidas financeiras.`
                          : `O NOPAT negativo de ${formatCurrency(
                              nopat,
                            )} evidencia que a operação central da empresa foi deficitária antes mesmo do cômputo das despesas financeiras.`}
                      </p>
                    </div>
                  </CardContent>
                </div>
              </Card>

              {/* Card EVA */}
              <Card className="bg-white border-slate-200 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden">
                <div>
                  <CardHeader className="p-5 pb-3 border-b border-slate-100 flex flex-row items-start justify-between gap-3 space-y-0">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                          EVA
                        </span>
                        <CardTitle className="text-base font-bold text-[#0B1F3A]">
                          Economic Value Added
                        </CardTitle>
                      </div>
                      <CardDescription className="text-xs text-slate-500 mt-1">
                        Valor Econômico Agregado gerado acima do custo de oportunidade do capital
                      </CardDescription>
                    </div>

                    {evaStatus === 'verde' ? (
                      <Badge className="bg-emerald-50 text-emerald-700 border-emerald-300 font-bold text-xs flex items-center gap-1.5 px-2.5 py-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />🟢
                        Cria Valor (EVA &gt; 0)
                      </Badge>
                    ) : evaStatus === 'ambar' ? (
                      <Badge className="bg-amber-50 text-amber-700 border-amber-300 font-bold text-xs flex items-center gap-1.5 px-2.5 py-1">
                        <span className="w-2 h-2 rounded-full bg-amber-500" />🟠 Neutro (EVA ≈ 0)
                      </Badge>
                    ) : (
                      <Badge className="bg-red-50 text-red-700 border-red-300 font-bold text-xs flex items-center gap-1.5 px-2.5 py-1">
                        <span className="w-2 h-2 rounded-full bg-red-500" />🔴 Destrói Valor (EVA
                        &lt; 0)
                      </Badge>
                    )}
                  </CardHeader>

                  <CardContent className="p-5 pt-4 space-y-4">
                    {/* Valor e Métricas ROIC / Spread */}
                    <div className="flex items-end justify-between gap-4 p-3.5 bg-gradient-to-r from-slate-50 to-blue-50/40 rounded-xl border border-slate-100">
                      <div>
                        <span className="text-[11px] font-semibold uppercase text-slate-500 block">
                          Fórmula de Cálculo
                        </span>
                        <code className="text-xs font-mono font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200 mt-0.5 inline-block">
                          NOPAT − (Capital Investido × WACC)
                        </code>
                        <div className="text-[11px] text-slate-600 mt-1.5 space-y-0.5">
                          <span>
                            ROIC: <strong>{formatPercent(roic, 1)}</strong>
                          </span>
                          <span className="mx-1.5">·</span>
                          <span>
                            WACC: <strong>{formatPercent(wacc, 1)}</strong>
                          </span>
                          <span className="mx-1.5">·</span>
                          <span>
                            Spread:{' '}
                            <strong className={spread >= 0 ? 'text-emerald-700' : 'text-red-600'}>
                              {spread >= 0
                                ? `+${formatPercent(spread, 1)}`
                                : formatPercent(spread, 1)}
                            </strong>
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-[10px] font-semibold uppercase text-slate-400 block">
                          EVA Apurado
                        </span>
                        <div
                          className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${
                            eva > 0
                              ? 'text-emerald-600'
                              : eva === 0
                                ? 'text-amber-600'
                                : 'text-red-600'
                          }`}
                        >
                          {formatCurrency(eva)}
                        </div>
                        <span className="text-xs font-bold text-slate-500 block mt-0.5">
                          Custo de Capital: {formatCurrency(custoCapital)}
                        </span>
                      </div>
                    </div>

                    {/* Breakdown do EVA */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                      <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
                        <span className="text-[10px] text-slate-500 block">NOPAT</span>
                        <strong className="text-slate-900 font-mono">
                          {formatCurrency(nopat)}
                        </strong>
                      </div>
                      <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
                        <span className="text-[10px] text-slate-500 block">Capital Investido</span>
                        <strong className="text-slate-900 font-mono">
                          {formatCurrency(capitalInvestido)}
                        </strong>
                      </div>
                      <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
                        <span className="text-[10px] text-slate-500 block">WACC Aplicado</span>
                        <strong className="text-blue-700 font-mono">{wacc}% a.a.</strong>
                      </div>
                      <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
                        <span className="text-[10px] text-slate-500 block">Custo Capital</span>
                        <strong className="text-slate-900 font-mono">
                          {formatCurrency(custoCapital)}
                        </strong>
                      </div>
                    </div>

                    {/* Interpretação */}
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        <Info className="w-3.5 h-3.5 text-blue-600" />
                        Interpretação Econômica
                      </span>
                      <p className="text-xs leading-relaxed text-slate-700 bg-slate-50/70 p-3 rounded-lg border border-slate-200/70">
                        {eva > 0
                          ? `A empresa gera retorno acima do custo de capital (${formatPercent(
                              roic,
                              1,
                            )} vs ${formatPercent(wacc, 1)}), criando R$ ${formatCurrency(
                              eva,
                            )} de riqueza econômica real para os acionistas além de todos os custos de oportunidade.`
                          : `A empresa destrói valor econômico no período (${formatCurrency(
                              eva,
                            )}), pois o retorno operacional (${formatPercent(
                              roic,
                              1,
                            )}) não cobre o custo do capital investido (${formatPercent(
                              wacc,
                              1,
                            )}).`}
                      </p>
                    </div>
                  </CardContent>
                </div>
              </Card>
            </div>
          </div>

          {/* ================= SEÇÃO 2: GRÁFICO RECHARTS COMPARATIVO ================= */}
          <Card className="bg-white border-slate-200 shadow-2xs">
            <CardHeader className="pb-2 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">
                    <BarChart3 className="w-4 h-4" />
                  </div>
                  <CardTitle className="text-base font-bold text-[#0B1F3A]">
                    Seção 2 — Gráfico Comparativo: NOPAT vs Lucro Líquido vs EBIT ({selectedAno})
                  </CardTitle>
                </div>
                <CardDescription className="text-xs mt-0.5">
                  Comparativo direto em reais (R$) entre os três principais resultados do exercício
                </CardDescription>
              </div>

              <div className="flex items-center gap-3 text-[11px] font-semibold">
                <span className="flex items-center gap-1 text-blue-700">
                  <span className="w-2.5 h-2.5 rounded-sm bg-blue-500" />
                  EBIT (Operacional)
                </span>
                <span className="flex items-center gap-1 text-emerald-700">
                  <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                  NOPAT (Pós-Impostos)
                </span>
                <span className="flex items-center gap-1 text-indigo-700">
                  <span className="w-2.5 h-2.5 rounded-sm bg-indigo-500" />
                  Lucro Líquido
                </span>
              </div>
            </CardHeader>

            <CardContent className="pt-6">
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={dadosGraficoComparativo}
                    margin={{ top: 10, right: 30, left: 50, bottom: 10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 11, fill: '#64748B' }}
                      tickFormatter={(v) =>
                        Math.abs(v) >= 1000000
                          ? `R$ ${(v / 1000000).toFixed(1)}M`
                          : Math.abs(v) >= 1000
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
                        formatCurrency(Number(val)),
                        item.payload.nome,
                      ]}
                      labelFormatter={(label: any) => `Indicador: ${label}`}
                    />
                    <ReferenceLine x={0} stroke="#94A3B8" />
                    <Bar dataKey="valor" radius={[0, 6, 6, 0]} barSize={26}>
                      {dadosGraficoComparativo.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.cor} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-3 text-center text-xs">
                <div className="p-2.5 rounded-lg bg-blue-50/50 border border-blue-100">
                  <span className="font-bold text-blue-900 block">EBIT (Lucro Operacional)</span>
                  <span className="text-sm font-extrabold text-blue-800 block mt-0.5">
                    {formatCurrency(ebit)}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    Antes de impostos e despesas financeiras
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-emerald-50/50 border border-emerald-100">
                  <span className="font-bold text-emerald-900 block">
                    NOPAT (Operacional Líquido)
                  </span>
                  <span className="text-sm font-extrabold text-emerald-800 block mt-0.5">
                    {formatCurrency(nopat)}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    Após dedução da alíquota tributária efetiva
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-indigo-50/50 border border-indigo-100">
                  <span className="font-bold text-indigo-900 block">Lucro Líquido (LL)</span>
                  <span className="text-sm font-extrabold text-indigo-800 block mt-0.5">
                    {formatCurrency(ll)}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    Resultado final atribuível aos sócios
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ================= SEÇÃO 3: MODELO DUPONT (Decomposição do ROE) ================= */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-[#0B1F3A] flex items-center gap-2">
                <GitMerge className="w-4 h-4 text-blue-600" />
                Seção 3 — Modelo DuPont: Árvore de Decomposição do ROE
              </h2>
              <span className="text-xs text-slate-500">
                ROE = Margem Líquida × Giro do Ativo × Alavancagem Financeira
              </span>
            </div>

            {/* Árvore DuPont Visual: Nível 1 Central no Topo */}
            <Card className="bg-gradient-to-br from-[#0B1F3A] via-blue-950 to-slate-900 text-white border-blue-900 shadow-md overflow-hidden">
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="space-y-2 text-center md:text-left">
                    <div className="flex items-center justify-center md:justify-start gap-2">
                      <span className="px-2 py-0.5 text-xs font-extrabold tracking-wider uppercase bg-blue-500/30 text-blue-300 rounded border border-blue-400/30">
                        Nível 1 · Retorno Global
                      </span>
                      {getRoeBadgeStatus(roe) === 'verde' ? (
                        <Badge className="bg-emerald-500 text-white font-bold text-xs">
                          🟢 ROE ≥ 15% (Excelente)
                        </Badge>
                      ) : getRoeBadgeStatus(roe) === 'ambar' ? (
                        <Badge className="bg-amber-500 text-slate-900 font-bold text-xs">
                          🟠 ROE 5% – 15% (Adequado)
                        </Badge>
                      ) : (
                        <Badge className="bg-red-500 text-white font-bold text-xs">
                          🔴 ROE &lt; 5% (Crítico)
                        </Badge>
                      )}
                    </div>

                    <h3 className="text-xl sm:text-2xl font-black text-white">
                      ROE (Return on Equity): {formatPercent(roe, 1)}
                    </h3>
                    <p className="text-xs text-blue-200/90 max-w-xl leading-relaxed">
                      Fórmula direta:{' '}
                      <code className="bg-white/10 px-1.5 py-0.5 rounded font-mono">
                        Lucro Líquido ({formatCurrency(ll)}) ÷ Patrimônio Líquido (
                        {formatCurrency(pl)}) × 100
                      </code>
                      . Mede a remuneração final gerada sobre o capital dos proprietários.
                    </p>
                  </div>

                  <div className="flex flex-col items-center justify-center bg-white/10 p-4 rounded-2xl border border-white/15 min-w-[200px]">
                    <span className="text-[11px] uppercase tracking-wider text-blue-200 font-semibold">
                      Rentabilidade dos Sócios
                    </span>
                    <div className="text-3xl sm:text-4xl font-black text-emerald-300 mt-1">
                      {formatPercent(roe, 1)}
                    </div>
                    <span className="text-[10px] text-slate-300 mt-1">
                      Multiplicação dos 3 fatores
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Setas e Conector da Árvore */}
            <div className="flex items-center justify-center gap-4 text-slate-400 py-1">
              <div className="h-0.5 w-16 bg-slate-300" />
              <span className="text-xs font-bold uppercase tracking-widest text-slate-600 flex items-center gap-1.5">
                <ArrowRight className="w-4 h-4 text-blue-600 rotate-90" />
                Decomposição em 3 Fatores de Desempenho (Nível 2)
                <ArrowRight className="w-4 h-4 text-blue-600 rotate-90" />
              </span>
              <div className="h-0.5 w-16 bg-slate-300" />
            </div>

            {/* Nível 2 — 3 Cards lado a lado: Margem Líquida, Giro do Ativo, Alavancagem Financeira */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Card 1: Margem Líquida */}
              <Card className="bg-white border-slate-200 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between">
                <CardHeader className="p-4 pb-2 border-b border-slate-100 flex flex-row items-start justify-between gap-2 space-y-0">
                  <div>
                    <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                      Fator 1 · Eficiência Operacional
                    </span>
                    <CardTitle className="text-sm font-bold text-[#0B1F3A] mt-1.5">
                      Margem Líquida
                    </CardTitle>
                  </div>

                  {getMargemLiquidaStatus(margemLiquida) === 'verde' ? (
                    <Badge className="bg-emerald-50 text-emerald-700 border-emerald-300 font-bold text-[11px]">
                      🟢 ≥ 10%
                    </Badge>
                  ) : getMargemLiquidaStatus(margemLiquida) === 'ambar' ? (
                    <Badge className="bg-amber-50 text-amber-700 border-amber-300 font-bold text-[11px]">
                      🟠 5% – 10%
                    </Badge>
                  ) : (
                    <Badge className="bg-red-50 text-red-700 border-red-300 font-bold text-[11px]">
                      🔴 &lt; 5%
                    </Badge>
                  )}
                </CardHeader>

                <CardContent className="p-4 space-y-3">
                  <div className="flex items-end justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">
                        Fórmula
                      </span>
                      <code className="text-xs font-mono font-bold block text-slate-800">
                        LL / Receita Líquida
                      </code>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-extrabold text-[#0B1F3A]">
                        {formatPercent(margemLiquida, 1)}
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100 leading-relaxed">
                    Mede o poder de precificação e controle de despesas. A cada R$ 100 faturados,
                    restam{' '}
                    <strong>R$ {margemLiquida ? formatNumber(margemLiquida, 2) : '0'}</strong>{' '}
                    livres.
                  </p>

                  <div className="text-[11px] text-slate-500 border-t border-slate-100 pt-2 flex justify-between">
                    <span>
                      LL: <strong>{formatCurrency(ll)}</strong>
                    </span>
                    <span>
                      RL: <strong>{formatCurrency(rl)}</strong>
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Card 2: Giro do Ativo */}
              <Card className="bg-white border-slate-200 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between">
                <CardHeader className="p-4 pb-2 border-b border-slate-100 flex flex-row items-start justify-between gap-2 space-y-0">
                  <div>
                    <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                      Fator 2 · Eficiência dos Ativos
                    </span>
                    <CardTitle className="text-sm font-bold text-[#0B1F3A] mt-1.5">
                      Giro do Ativo
                    </CardTitle>
                  </div>

                  {getGiroAtivoStatus(giroAtivo) === 'verde' ? (
                    <Badge className="bg-emerald-50 text-emerald-700 border-emerald-300 font-bold text-[11px]">
                      🟢 ≥ 1,0x
                    </Badge>
                  ) : getGiroAtivoStatus(giroAtivo) === 'ambar' ? (
                    <Badge className="bg-amber-50 text-amber-700 border-amber-300 font-bold text-[11px]">
                      🟠 0,5x – 1,0x
                    </Badge>
                  ) : (
                    <Badge className="bg-red-50 text-red-700 border-red-300 font-bold text-[11px]">
                      🔴 &lt; 0,5x
                    </Badge>
                  )}
                </CardHeader>

                <CardContent className="p-4 space-y-3">
                  <div className="flex items-end justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">
                        Fórmula
                      </span>
                      <code className="text-xs font-mono font-bold block text-slate-800">
                        Receita Líquida / Ativo Total
                      </code>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-extrabold text-[#0B1F3A]">
                        {giroAtivo !== null ? `${formatNumber(giroAtivo, 2)}x` : '—'}
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100 leading-relaxed">
                    Mede a velocidade na geração de vendas a partir dos bens e direitos totais
                    aplicados no negócio.
                  </p>

                  <div className="text-[11px] text-slate-500 border-t border-slate-100 pt-2 flex justify-between">
                    <span>
                      RL: <strong>{formatCurrency(rl)}</strong>
                    </span>
                    <span>
                      AT: <strong>{formatCurrency(at)}</strong>
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Card 3: Alavancagem Financeira */}
              <Card className="bg-white border-slate-200 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between">
                <CardHeader className="p-4 pb-2 border-b border-slate-100 flex flex-row items-start justify-between gap-2 space-y-0">
                  <div>
                    <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                      Fator 3 · Estrutura de Capital
                    </span>
                    <CardTitle className="text-sm font-bold text-[#0B1F3A] mt-1.5">
                      Alavancagem Financeira
                    </CardTitle>
                  </div>

                  {getAlavancagemStatus(alavancagemFinanceira) === 'verde' ? (
                    <Badge className="bg-emerald-50 text-emerald-700 border-emerald-300 font-bold text-[11px]">
                      🟢 1,5x – 3,0x
                    </Badge>
                  ) : getAlavancagemStatus(alavancagemFinanceira) === 'ambar' ? (
                    <Badge className="bg-amber-50 text-amber-700 border-amber-300 font-bold text-[11px]">
                      🟠 3,0x – 5,0x
                    </Badge>
                  ) : (
                    <Badge className="bg-red-50 text-red-700 border-red-300 font-bold text-[11px]">
                      🔴 &gt; 5,0x ou &lt; 1,0x
                    </Badge>
                  )}
                </CardHeader>

                <CardContent className="p-4 space-y-3">
                  <div className="flex items-end justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">
                        Fórmula
                      </span>
                      <code className="text-xs font-mono font-bold block text-slate-800">
                        Ativo Total / PL
                      </code>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-extrabold text-[#0B1F3A]">
                        {alavancagemFinanceira !== null
                          ? `${formatNumber(alavancagemFinanceira, 2)}x`
                          : '—'}
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100 leading-relaxed">
                    Mede o efeito multiplicador dos recursos de terceiros sobre o capital próprio
                    dos acionistas.
                  </p>

                  <div className="text-[11px] text-slate-500 border-t border-slate-100 pt-2 flex justify-between">
                    <span>
                      AT: <strong>{formatCurrency(at)}</strong>
                    </span>
                    <span>
                      PL: <strong>{formatCurrency(pl)}</strong>
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Card de Verificação Matemática do DuPont */}
            <Card className="bg-white border-blue-200 shadow-2xs">
              <CardContent className="p-4 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-blue-900">
                      Verificação Matemática DuPont (Identidade Fundamental)
                    </h4>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Margem Líquida (
                      {margemLiquida !== null ? `${formatNumber(margemLiquida / 100, 4)}` : '0'}) ×
                      Giro ({giroAtivo !== null ? formatNumber(giroAtivo, 2) : '0'}) × Alavancagem (
                      {alavancagemFinanceira !== null
                        ? formatNumber(alavancagemFinanceira, 2)
                        : '0'}
                      ) ={' '}
                      <strong className="text-slate-900 font-mono">
                        {roeDuPontVerificado !== null ? formatPercent(roeDuPontVerificado, 1) : '—'}
                      </strong>
                    </p>
                  </div>
                </div>

                <Badge className="bg-blue-600 text-white font-bold text-xs shrink-0 px-3 py-1">
                  ✓ ROE Calculado: {formatPercent(roe, 1)}
                </Badge>
              </CardContent>
            </Card>

            {/* Nível 3 — Análise DuPont Estendida (LAIR & Carga Tributária) */}
            {lair !== 0 && cargaTributaria !== null && margemOperacionalLair !== null && (
              <Card className="bg-slate-50 border-slate-200 shadow-2xs">
                <CardHeader className="p-4 pb-2 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-600" />
                    <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-800">
                      Nível 3 · DuPont Estendido (Retenção Fiscal &amp; Margem Operacional)
                    </CardTitle>
                  </div>
                  <CardDescription className="text-xs text-slate-500 mt-0.5">
                    ROE = Margem Operacional LAIR × Giro do Ativo × Alavancagem × Carga Tributária
                    (Índice de Retenção)
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-500 block uppercase font-semibold">
                      Margem LAIR
                    </span>
                    <strong className="text-slate-900 text-sm block mt-0.5">
                      {formatPercent(margemOperacionalLair, 1)}
                    </strong>
                    <span className="text-[10px] text-slate-400">LAIR / RL</span>
                  </div>

                  <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-500 block uppercase font-semibold">
                      Giro do Ativo
                    </span>
                    <strong className="text-slate-900 text-sm block mt-0.5">
                      {formatNumber(giroAtivo, 2)}x
                    </strong>
                    <span className="text-[10px] text-slate-400">RL / Ativo Total</span>
                  </div>

                  <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-500 block uppercase font-semibold">
                      Alavancagem
                    </span>
                    <strong className="text-slate-900 text-sm block mt-0.5">
                      {formatNumber(alavancagemFinanceira, 2)}x
                    </strong>
                    <span className="text-[10px] text-slate-400">Ativo Total / PL</span>
                  </div>

                  <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-500 block uppercase font-semibold">
                      Carga Tributária
                    </span>
                    <strong className="text-slate-900 text-sm block mt-0.5">
                      {formatNumber(cargaTributaria, 3)}
                    </strong>
                    <span className="text-[10px] text-slate-400">LL / LAIR (Retenção)</span>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* ================= SEÇÃO 4: ANÁLISE CONSOLIDADA DO CONSULTOR ================= */}
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
                        Parecer Integrado do Consultor Econômico-Financeiro · Exercício{' '}
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
                  <span className="font-bold text-emerald-300 uppercase tracking-wider text-[11px] block">
                    1. Diagnóstico de Criação de Valor (EVA &amp; NOPAT)
                  </span>
                  <p className="text-slate-200 leading-relaxed">
                    {parecerConsolidado.diagnosticoCriacaoValor}
                  </p>
                </div>

                <div className="bg-white/5 p-4 rounded-xl border border-white/10 space-y-1.5">
                  <span className="font-bold text-blue-300 uppercase tracking-wider text-[11px] block">
                    2. Decomposição DuPont (Eficiência Operacional &amp; Giro)
                  </span>
                  <p className="text-slate-200 leading-relaxed">
                    {parecerConsolidado.diagnosticoEficiencia}
                  </p>
                </div>

                <div className="bg-white/5 p-4 rounded-xl border border-white/10 space-y-1.5">
                  <span className="font-bold text-indigo-300 uppercase tracking-wider text-[11px] block">
                    3. Estrutura de Capital &amp; Alavancagem Financeira
                  </span>
                  <p className="text-slate-200 leading-relaxed">
                    {parecerConsolidado.diagnosticoEstruturaCapital}
                  </p>
                </div>

                <div className="bg-white/5 p-4 rounded-xl border border-white/10 space-y-1.5">
                  <span className="font-bold text-amber-300 uppercase tracking-wider text-[11px] block">
                    4. Recomendações Práticas do Consultor
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
