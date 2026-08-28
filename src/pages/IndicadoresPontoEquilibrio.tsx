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
import { Label } from '@/components/ui/label'
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
  Legend,
} from 'recharts'
import {
  Scale,
  Building2,
  Calendar,
  Download,
  ShieldCheck,
  AlertCircle,
  PlusCircle,
  Layers,
  Info,
  BarChart3,
  DollarSign,
  SlidersHorizontal,
  RotateCcw,
  TrendingUp,
  Percent,
  Target,
  Activity,
  CheckCircle2,
  HelpCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export default function IndicadoresPontoEquilibrio() {
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

  // Estados dos parâmetros editáveis (com override manual)
  const [custosFixosEdit, setCustosFixosEdit] = useState<string>('')
  const [custosVariaveisEdit, setCustosVariaveisEdit] = useState<string>('')
  const [depreciacaoEdit, setDepreciacaoEdit] = useState<string>('')
  const [lucroDesejadoEdit, setLucroDesejadoEdit] = useState<string>('')
  const [isManualOverride, setIsManualOverride] = useState<boolean>(false)
  const [expandDetails, setExpandDetails] = useState<boolean>(false)

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
      console.error('Erro ao carregar balanços e DRE para ponto de equilíbrio:', err)
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

  const calcB = useMemo(() => calcularBalanco(balancoAtual), [balancoAtual])
  const calcD = useMemo(() => calcularDre(dreAtual), [dreAtual])

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

  // Heurística padrão baseada no DRE e Balanço
  // Receita Líquida = Faturamento líquido
  const receitaLiquida = calcD.receitaLiquida

  // Heurística de Custos e Despesas:
  // Custos e Despesas Variáveis padrão = Custo das Mercadorias/Serviços Vendidos (CMV/CPV)
  const defaultCustosVariaveis = useMemo(() => {
    return dreAtual?.custo_mercadorias || 0
  }, [dreAtual])

  // Custos e Despesas Fixas padrão = Despesas Operacionais + Despesas Financeiras
  const defaultCustosFixos = useMemo(() => {
    const despOp = dreAtual?.despesas_operacionais || 0
    const despFin = dreAtual?.despesas_financeiras || 0
    return despOp + despFin
  }, [dreAtual])

  // Depreciação / Amortização padrão:
  // Heurística: se Imobilizado > 0, estimar ~10% de depreciação do imobilizado, ou 0 se não especificado
  const defaultDepreciacao = useMemo(() => {
    const imobilizado = balancoAtual?.imobilizado || 0
    const intangivel = balancoAtual?.intangivel || 0
    const baseAtivoNaoCirc = imobilizado + intangivel
    if (baseAtivoNaoCirc > 0) {
      // 10% do imobilizado ao ano como estimativa não desembolsável razoável
      const estimativa = imobilizado * 0.1
      // Limitando para não ultrapassar as despesas operacionais
      const despOp = dreAtual?.despesas_operacionais || 0
      return Math.min(estimativa, despOp > 0 ? despOp * 0.5 : estimativa)
    }
    return 0
  }, [balancoAtual, dreAtual])

  // Lucro Desejado padrão:
  // Lucro Líquido apurado no DRE (ou se negativo/zero, 10% da receita líquida como meta saudável)
  const defaultLucroDesejado = useMemo(() => {
    if (calcD.lucroLiquido > 0) {
      return calcD.lucroLiquido
    }
    if (receitaLiquida > 0) {
      return receitaLiquida * 0.1 // 10% da RL como meta padrão
    }
    return 0
  }, [calcD.lucroLiquido, receitaLiquida])

  // Sincronizar inputs quando muda empresa/ano ou carregar dados pela primeira vez (se o usuário não tiver customizado manualmente na sessão)
  useEffect(() => {
    if (!isManualOverride) {
      setCustosFixosEdit(defaultCustosFixos.toString())
      setCustosVariaveisEdit(defaultCustosVariaveis.toString())
      setDepreciacaoEdit(defaultDepreciacao > 0 ? defaultDepreciacao.toFixed(2) : '0')
      setLucroDesejadoEdit(defaultLucroDesejado > 0 ? defaultLucroDesejado.toFixed(2) : '0')
    }
  }, [
    selectedEmpresaId,
    selectedAno,
    defaultCustosFixos,
    defaultCustosVariaveis,
    defaultDepreciacao,
    defaultLucroDesejado,
    isManualOverride,
  ])

  // Valores efetivos em número
  const custosFixos = isManualOverride ? Number(custosFixosEdit) || 0 : defaultCustosFixos
  const custosVariaveis = isManualOverride
    ? Number(custosVariaveisEdit) || 0
    : defaultCustosVariaveis
  const depreciacao = isManualOverride ? Number(depreciacaoEdit) || 0 : defaultDepreciacao
  const lucroDesejado = isManualOverride ? Number(lucroDesejadoEdit) || 0 : defaultLucroDesejado

  // Handler de Reset para valores automáticos do DRE
  const handleResetDefaults = () => {
    setIsManualOverride(false)
    setCustosFixosEdit(defaultCustosFixos.toString())
    setCustosVariaveisEdit(defaultCustosVariaveis.toString())
    setDepreciacaoEdit(defaultDepreciacao > 0 ? defaultDepreciacao.toFixed(2) : '0')
    setLucroDesejadoEdit(defaultLucroDesejado > 0 ? defaultLucroDesejado.toFixed(2) : '0')
    toast({
      title: 'Parâmetros Restaurados',
      description: 'Os valores foram redefinidos a partir dos dados do DRE e Balanço.',
    })
  }

  // ================= CÁLCULOS PRINCIPAIS DE PONTO DE EQUILÍBRIO =================
  // 1. Margem de Contribuição em R$ = Receita Líquida − Custos e Despesas Variáveis
  const margemContribuicaoReais = receitaLiquida - custosVariaveis

  // 2. Margem de Contribuição em % = Margem de Contribuição R$ ÷ Receita Líquida
  const margemContribuicaoPercentual =
    receitaLiquida > 0 ? (margemContribuicaoReais / receitaLiquida) * 100 : 0
  const mcDecimal = margemContribuicaoPercentual / 100 // em decimal (ex: 0.40)

  // 1. Ponto de Equilíbrio Contábil (PEC em R$) = Custos e Despesas Fixas ÷ Margem de Contribuição (%)
  const pec = useMemo(() => {
    if (mcDecimal > 0 && custosFixos >= 0) {
      return custosFixos / mcDecimal
    }
    return 0
  }, [custosFixos, mcDecimal])

  // 2. Ponto de Equilíbrio Econômico (PEE em R$) = (Custos e Despesas Fixas + Lucro Desejado) ÷ Margem de Contribuição (%)
  const pee = useMemo(() => {
    if (mcDecimal > 0) {
      return (custosFixos + Math.max(0, lucroDesejado)) / mcDecimal
    }
    return 0
  }, [custosFixos, lucroDesejado, mcDecimal])

  // 3. Ponto de Equilíbrio Financeiro (PEF em R$) = (Custos e Despesas Fixas − Depreciação/Amortização) ÷ Margem de Contribuição (%)
  const pef = useMemo(() => {
    if (mcDecimal > 0) {
      const fixosDesembolsaveis = Math.max(0, custosFixos - depreciacao)
      return fixosDesembolsaveis / mcDecimal
    }
    return 0
  }, [custosFixos, depreciacao, mcDecimal])

  // Margem de Segurança = (Receita Atual − Ponto de Equilíbrio Contábil) ÷ Receita Atual
  const margemSeguranca = useMemo(() => {
    if (receitaLiquida > 0 && pec > 0) {
      return ((receitaLiquida - pec) / receitaLiquida) * 100
    }
    if (receitaLiquida > 0 && pec === 0) {
      return 100
    }
    return 0
  }, [receitaLiquida, pec])

  // Margem de Segurança em R$
  const margemSegurancaReais = receitaLiquida - pec

  // Classificação da situação da empresa:
  // Se Receita Líquida > PEC:
  // 🟢 Lucro / Operação saudável: Receita > PEC + 15% (Margem de segurança > 15%)
  // 🟠 Atenção / Próxima ao equilíbrio: Receita entre PEC e PEC + 15% (ou Margem de segurança entre 0% e 15%)
  // 🔴 Prejuízo / Operação deficitária: Receita < PEC (Margem de segurança < 0%)
  const situacaoOperacao: 'lucro' | 'atencao' | 'prejuizo' | 'indefinido' = useMemo(() => {
    if (!dreAtual || receitaLiquida === 0) return 'indefinido'
    if (margemSeguranca >= 15) return 'lucro'
    if (margemSeguranca >= 0) return 'atencao'
    return 'prejuizo'
  }, [dreAtual, receitaLiquida, margemSeguranca])

  // Classificação dos pontos individuais
  const getStatusVsReceita = (ponto: number) => {
    if (receitaLiquida === 0 || ponto === 0) return 'indefinido'
    if (receitaLiquida >= ponto * 1.1) return 'verde' // Receita supera com folga (+10%)
    if (receitaLiquida >= ponto) return 'ambar' // Receita supera no limite
    return 'vermelho' // Receita abaixo do ponto de equilíbrio
  }

  // Dados para Gráfico de Barras Recharts: Receita Atual vs 3 Pontos de Equilíbrio
  const dadosGraficoComparativo = useMemo(() => {
    return [
      {
        nome: 'Receita Líquida Atual',
        sigla: 'Receita Atual',
        valor: Number(receitaLiquida.toFixed(2)),
        descricao: 'Faturamento líquido gerado pela empresa no exercício',
        cor: '#2563EB', // Blue
      },
      {
        nome: 'PE Contábil (PEC)',
        sigla: 'PE Contábil',
        valor: Number(pec.toFixed(2)),
        descricao: 'Faturamento mínimo para cobrir todos os custos e despesas fixas (Lucro Zero)',
        cor: '#059669', // Emerald
      },
      {
        nome: 'PE Econômico (PEE)',
        sigla: 'PE Econômico',
        valor: Number(pee.toFixed(2)),
        descricao: 'Faturamento necessário para cobrir custos fixos + remunerar o lucro desejado',
        cor: '#7C3AED', // Purple
      },
      {
        nome: 'PE Financeiro (PEF)',
        sigla: 'PE Financeiro',
        valor: Number(pef.toFixed(2)),
        descricao:
          'Faturamento estritamente necessário para cobrir as saídas de caixa operacionais',
        cor: '#D97706', // Amber
      },
    ]
  }, [receitaLiquida, pec, pee, pef])

  // Diagnóstico e Recomendações
  const parecerConsolidado = useMemo(() => {
    if (!dreAtual && !balancoAtual) return null

    let titulo = ''
    let nivel: 'excelente' | 'adequado' | 'alerta' | 'critico' = 'adequado'
    let diagnosticoPEC = ''
    let diagnosticoPEE = ''
    let diagnosticoPEF = ''
    let recomendacao = ''

    if (situacaoOperacao === 'lucro') {
      nivel = 'excelente'
      titulo = 'Operação Saudável com Ampla Margem de Segurança Operacional'
      diagnosticoPEC = `A empresa opera com Receita Líquida de ${formatCurrency(
        receitaLiquida,
      )}, superando o Ponto de Equilíbrio Contábil (${formatCurrency(
        pec,
      )}) com folga de ${formatCurrency(
        margemSegurancaReais,
      )} e Margem de Segurança de ${formatPercent(
        margemSeguranca,
        1,
      )}. A cada R$ 100 faturados, R$ ${formatNumber(
        margemContribuicaoPercentual,
        1,
      )} sobram para cobrir a estrutura fixa e gerar lucro líquido.`
      diagnosticoPEE =
        receitaLiquida >= pee
          ? `A receita atual também supera o Ponto de Equilíbrio Econômico (${formatCurrency(
              pee,
            )}), remunerando integralmente o lucro almejado de ${formatCurrency(lucroDesejado)}.`
          : `A receita cobre o equilíbrio contábil, porém está próxima do Ponto de Equilíbrio Econômico (${formatCurrency(
              pee,
            )}), indicando que o lucro desejado de ${formatCurrency(
              lucroDesejado,
            )} é atingido parcialmente.`
      diagnosticoPEF = `O Ponto de Equilíbrio Financeiro é de ${formatCurrency(
        pef,
      )}. Como a receita atual supera amplamente o PEF, a operação gera caixa líquido positivo robusto, sem risco de descumprimento de desembolsos imediatos.`
      recomendacao =
        '1) Manter o controle dos custos variáveis para preservar a Margem de Contribuição em patamar elevado; 2) Aproveitar a margem de segurança para realizar investimentos graduais em expansão de mercado; 3) Monitorar o ponto de equilíbrio econômico para sustentar a remuneração planejada aos acionistas.'
    } else if (situacaoOperacao === 'atencao') {
      nivel = 'alerta'
      titulo = 'Operação Próxima ao Ponto de Equilíbrio: Alerta para Margem de Segurança Reduzida'
      diagnosticoPEC = `A empresa fatura ${formatCurrency(
        receitaLiquida,
      )}, operando muito próxima ao Ponto de Equilíbrio Contábil (${formatCurrency(
        pec,
      )}). A Margem de Segurança é de apenas ${formatPercent(margemSeguranca, 1)} (${formatCurrency(
        margemSegurancaReais,
      )}). Qualquer oscilação negativa de demanda ou aumento inesperado de custos pode empurrar a empresa para o prejuízo operacional.`
      diagnosticoPEE = `Para atingir o Ponto de Equilíbrio Econômico (${formatCurrency(
        pee,
      )}) e garantir o lucro desejado de ${formatCurrency(
        lucroDesejado,
      )}, a empresa precisaria expandir seu faturamento em ${formatPercent(
        receitaLiquida > 0 ? ((pee - receitaLiquida) / receitaLiquida) * 100 : 0,
        1,
      )}.`
      diagnosticoPEF = `O Ponto de Equilíbrio Financeiro (${formatCurrency(
        pef,
      )}) está coberto, permitindo que as contas de caixa do dia a dia sejam honradas, mas a geração de excedente econômico é limitada.`
      recomendacao =
        '1) Realizar revisão detalhada das despesas fixas para rebaixar o Ponto de Equilíbrio Contábil; 2) Analisar a precificação de vendas buscando elevar a Margem de Contribuição unitária; 3) Conter a contratação de novas despesas fixas recorrentes.'
    } else {
      nivel = 'critico'
      titulo = 'Operação Deficitária: Receita Abaixo do Ponto de Equilíbrio Contábil'
      diagnosticoPEC = `Com Receita Líquida de ${formatCurrency(
        receitaLiquida,
      )}, a empresa opera ${formatCurrency(
        Math.abs(margemSegurancaReais),
      )} abaixo do Ponto de Equilíbrio Contábil de ${formatCurrency(
        pec,
      )} (Margem de Segurança negativa de ${formatPercent(
        margemSeguranca,
        1,
      )}). A receita gerada não é suficiente para cobrir os custos fixos da operação, resultando em prejuízo contábil.`
      diagnosticoPEE = `O Ponto de Equilíbrio Econômico de ${formatCurrency(
        pee,
      )} está distante da realidade atual de faturamento, exigindo um salto substancial de vendas ou reestruturação drástica da estrutura de despesas.`
      diagnosticoPEF =
        receitaLiquida < pef
          ? `Situação de alto risco: a receita (${formatCurrency(
              receitaLiquida,
            )}) está abaixo até mesmo do Ponto de Equilíbrio Financeiro (${formatCurrency(
              pef,
            )}), gerando queima direta de caixa operacional e necessidade de aporte de capital de giro.`
          : `A receita cobre estritamente o Ponto de Equilíbrio Financeiro (${formatCurrency(
              pef,
            )}), mantendo a solvência imediata do caixa apenas porque as despesas não desembolsáveis (como depreciação) absorvem o impacto contábil.`
      recomendacao =
        '1) Cortar imediatamente despesas fixas não essenciais para reduzir o valor do PEC; 2) Renegociar custos de mercadorias e insumos para expandir a Margem de Contribuição; 3) Implementar campanha comercial focada nos produtos/serviços de maior margem unitária; 4) Monitorar diariamente o fluxo de caixa.'
    }

    return {
      titulo,
      nivel,
      diagnosticoPEC,
      diagnosticoPEE,
      diagnosticoPEF,
      recomendacao,
    }
  }, [
    dreAtual,
    balancoAtual,
    situacaoOperacao,
    receitaLiquida,
    pec,
    pee,
    pef,
    margemSeguranca,
    margemSegurancaReais,
    margemContribuicaoPercentual,
    lucroDesejado,
  ])

  // Exportação CSV
  const handleExportCsv = () => {
    if (!selectedEmpresa) {
      toast({
        title: 'Selecione uma empresa',
        description:
          'É necessário selecionar uma empresa para exportar os dados de ponto de equilíbrio.',
        variant: 'destructive',
      })
      return
    }

    let csvContent = '\uFEFF' // BOM UTF-8
    const dataEmissao = new Date().toLocaleDateString('pt-BR')

    csvContent += `RELATÓRIO DE PONTO DE EQUILÍBRIO (BREAK-EVEN POINT)\n`
    csvContent += `EMPRESA;${selectedEmpresa.nome}\n`
    csvContent += `CNPJ;${formatCnpj(selectedEmpresa.cnpj)}\n`
    csvContent += `SEGMENTO;${selectedEmpresa.segmento}\n`
    csvContent += `EXERCÍCIO;${selectedAno}\n`
    csvContent += `DATA DE EMISSÃO;${dataEmissao}\n\n`

    csvContent += `PARÂMETROS E BASES FINANCEIRAS (R$)\n`
    csvContent += `Receita Líquida Atual (RL);${receitaLiquida.toFixed(2).replace('.', ',')}\n`
    csvContent += `Custos e Despesas Variáveis;${custosVariaveis.toFixed(2).replace('.', ',')}\n`
    csvContent += `Margem de Contribuição (R$);${margemContribuicaoReais.toFixed(2).replace('.', ',')}\n`
    csvContent += `Margem de Contribuição (%);${margemContribuicaoPercentual.toFixed(2).replace('.', ',')}%\n`
    csvContent += `Custos e Despesas Fixas;${custosFixos.toFixed(2).replace('.', ',')}\n`
    csvContent += `Despesas Não Desembolsáveis (Depreciação/Amortização);${depreciacao.toFixed(2).replace('.', ',')}\n`
    csvContent += `Lucro Desejado (Meta de Remuneração);${lucroDesejado.toFixed(2).replace('.', ',')}\n\n`

    csvContent += `PONTOS DE EQUILÍBRIO E INDICADORES CALCULADOS\n`
    csvContent += `Indicador;Fórmula;Valor em R$;Status vs Receita Atual;Margem de Segurança;Interpretação\n`

    // PEC
    const pecStatusStr =
      receitaLiquida >= pec * 1.15
        ? 'Saudável (Lucro)'
        : receitaLiquida >= pec
          ? 'Atenção (Próximo)'
          : 'Deficitário (Prejuízo)'
    csvContent += `Ponto de Equilíbrio Contábil (PEC);Custos Fixos / Margem Contribuição (%);${pec.toFixed(2).replace('.', ',')};${pecStatusStr};${margemSeguranca.toFixed(1).replace('.', ',')}%;Faturamento necessário para cobrir todos os custos e despesas fixas (Lucro Operacional Zero)\n`

    // PEE
    const peeStatusStr = receitaLiquida >= pee ? 'Meta Atingida' : 'Abaixo da Meta'
    csvContent += `Ponto de Equilíbrio Econômico (PEE);(Custos Fixos + Lucro Desejado) / Margem Contribuição (%);${pee.toFixed(2).replace('.', ',')};${peeStatusStr};—;Faturamento necessário para cobrir custos fixos e entregar o lucro desejado de ${formatCurrency(lucroDesejado)}\n`

    // PEF
    const pefStatusStr = receitaLiquida >= pef ? 'Caixa Seguro' : 'Queima de Caixa'
    csvContent += `Ponto de Equilíbrio Financeiro (PEF);(Custos Fixos - Depreciação) / Margem Contribuição (%);${pef.toFixed(2).replace('.', ',')};${pefStatusStr};—;Faturamento estritamente necessário para honrar todas as saídas de caixa operacionais\n`

    // Margens
    csvContent += `Margem de Contribuição;RL − Custos Variáveis;${margemContribuicaoReais.toFixed(2).replace('.', ',')};${margemContribuicaoPercentual >= 30 ? 'Forte' : 'Moderada'};${margemContribuicaoPercentual.toFixed(1).replace('.', ',')}%;Percentual de cada real que sobra para cobrir a estrutura fixa\n`
    csvContent += `Margem de Segurança;(Receita Atual − PEC) / Receita Atual;${margemSegurancaReais.toFixed(2).replace('.', ',')};${situacaoOperacao === 'lucro' ? 'Confortável' : situacaoOperacao === 'atencao' ? 'Atenção' : 'Crítico'};${margemSeguranca.toFixed(1).replace('.', ',')}%;Percentual de queda de vendas que a empresa suporta antes de entrar em prejuízo\n\n`

    if (parecerConsolidado) {
      csvContent += `DIAGNÓSTICO CONSOLIDADO E RECOMENDAÇÕES DO CONSULTOR\n`
      csvContent += `Diagnóstico Geral;${parecerConsolidado.titulo.replace(/;/g, ',')}\n`
      csvContent += `Análise do Ponto Contábil;${parecerConsolidado.diagnosticoPEC.replace(/\n/g, ' ').replace(/;/g, ',')}\n`
      csvContent += `Análise do Ponto Econômico;${parecerConsolidado.diagnosticoPEE.replace(/\n/g, ' ').replace(/;/g, ',')}\n`
      csvContent += `Análise do Ponto Financeiro;${parecerConsolidado.diagnosticoPEF.replace(/\n/g, ' ').replace(/;/g, ',')}\n`
      csvContent += `Recomendações Práticas;${parecerConsolidado.recomendacao.replace(/\n/g, ' ').replace(/;/g, ',')}\n`
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `ponto-equilibrio-${selectedEmpresa.nome.replace(/\s+/g, '-').toLowerCase()}-${selectedAno}.csv`
    link.click()
    URL.revokeObjectURL(link.href)

    toast({
      title: 'CSV exportado com sucesso!',
      description: `Relatório de Ponto de Equilíbrio (${selectedAno}) exportado com sucesso.`,
    })
  }

  if (loading && !balancoAtual && !dreAtual && balancos.length === 0) {
    return (
      <div className="py-20 flex flex-col justify-center items-center gap-3">
        <div className="w-9 h-9 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs text-slate-500 font-medium">
          Carregando análise de Ponto de Equilíbrio...
        </span>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* 1. Header com Título, Seletores de Empresa/Ano e Botão Exportar CSV */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-lg shadow-md shadow-blue-600/20 shrink-0">
            <Scale className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-extrabold text-[#0B1F3A] tracking-tight">
                Ponto de Equilíbrio (Break-Even Point)
              </h1>
              <Badge className="bg-blue-50 text-blue-700 border-blue-200 font-semibold text-xs">
                Contábil · Econômico · Financeiro
              </Badge>
            </div>
            <p className="text-xs text-[#5B6B7F] mt-0.5">
              Determinação do volume mínimo de faturamento necessário para cobrir custos, honrar o
              caixa e atingir o lucro planejado
            </p>
          </div>
        </div>

        {/* Seletores Globais de Empresa e Ano + Botão CSV */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Seletor Empresa */}
          <div className="flex items-center gap-1.5 bg-[#F5F7FA] border border-slate-200 rounded-lg px-2.5 py-1 text-xs">
            <Building2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <Select value={selectedEmpresaId} onValueChange={(id) => setSelectedEmpresaId(id)}>
              <SelectTrigger className="h-7 border-none shadow-none bg-transparent text-xs font-semibold text-slate-800 p-0 focus:ring-0 w-[150px] sm:w-[190px]">
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
                exercício de {selectedAno}. Cadastre as demonstrações para calcular os pontos de
                equilíbrio.
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
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* ================= SEÇÃO DE PARÂMETROS EDITÁVEIS ================= */}
          <Card className="bg-white border-blue-200/80 shadow-2xs overflow-hidden">
            <CardHeader className="p-4 pb-3 bg-gradient-to-r from-blue-50/70 via-slate-50 to-slate-50 border-b border-blue-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-blue-600" />
                <div>
                  <CardTitle className="text-sm font-bold text-[#0B1F3A]">
                    Parâmetros e Estrutura de Custos do Exercício ({selectedAno})
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Pré-preenchidos automaticamente com base no DRE e Balanço. Ajuste manualmente se
                    desejar simular cenários.
                  </CardDescription>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {isManualOverride && (
                  <Badge className="bg-amber-100 text-amber-800 border-amber-300 font-semibold text-[10px]">
                    Valores Customizados
                  </Badge>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleResetDefaults}
                  className="text-xs text-slate-600 hover:text-blue-700 border-slate-300 h-7 px-2.5"
                  title="Restaurar valores padrão calculados a partir da DRE"
                >
                  <RotateCcw className="w-3 h-3 mr-1" />
                  Restaurar Padrões do DRE
                </Button>
              </div>
            </CardHeader>

            <CardContent className="p-4 pt-3 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {/* 1. Custos e Despesas Fixas */}
                <div className="space-y-1 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] font-bold text-slate-700 uppercase">
                      Custos e Despesas Fixas (R$)
                    </Label>
                    <span className="text-[10px] text-slate-400">Desp. Operac. + Financ.</span>
                  </div>
                  <div className="flex items-center bg-white border border-slate-300 rounded-lg px-2 py-1 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500">
                    <span className="text-xs font-bold text-slate-400 mr-1">R$</span>
                    <Input
                      type="number"
                      step="1000"
                      min="0"
                      value={custosFixosEdit}
                      onChange={(e) => {
                        setIsManualOverride(true)
                        setCustosFixosEdit(e.target.value)
                      }}
                      className="h-6 text-xs font-bold text-slate-900 border-none p-0 focus-visible:ring-0 text-right"
                    />
                  </div>
                  <span className="text-[10px] text-slate-500 block truncate">
                    Base: {formatCurrency(defaultCustosFixos)}
                  </span>
                </div>

                {/* 2. Custos e Despesas Variáveis */}
                <div className="space-y-1 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] font-bold text-slate-700 uppercase">
                      Custos e Despesas Variáveis (R$)
                    </Label>
                    <span className="text-[10px] text-slate-400">CMV / CPV</span>
                  </div>
                  <div className="flex items-center bg-white border border-slate-300 rounded-lg px-2 py-1 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500">
                    <span className="text-xs font-bold text-slate-400 mr-1">R$</span>
                    <Input
                      type="number"
                      step="1000"
                      min="0"
                      value={custosVariaveisEdit}
                      onChange={(e) => {
                        setIsManualOverride(true)
                        setCustosVariaveisEdit(e.target.value)
                      }}
                      className="h-6 text-xs font-bold text-slate-900 border-none p-0 focus-visible:ring-0 text-right"
                    />
                  </div>
                  <span className="text-[10px] text-slate-500 block truncate">
                    Base: {formatCurrency(defaultCustosVariaveis)}
                  </span>
                </div>

                {/* 3. Depreciação / Amortização (Não desembolsável) */}
                <div className="space-y-1 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] font-bold text-slate-700 uppercase">
                      Depreciação/Amortização (R$)
                    </Label>
                    <span className="text-[10px] text-slate-400">Não Desembolsável</span>
                  </div>
                  <div className="flex items-center bg-white border border-slate-300 rounded-lg px-2 py-1 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500">
                    <span className="text-xs font-bold text-slate-400 mr-1">R$</span>
                    <Input
                      type="number"
                      step="500"
                      min="0"
                      value={depreciacaoEdit}
                      onChange={(e) => {
                        setIsManualOverride(true)
                        setDepreciacaoEdit(e.target.value)
                      }}
                      className="h-6 text-xs font-bold text-slate-900 border-none p-0 focus-visible:ring-0 text-right"
                    />
                  </div>
                  <span className="text-[10px] text-slate-500 block truncate">
                    Base: {formatCurrency(defaultDepreciacao)}
                  </span>
                </div>

                {/* 4. Lucro Desejado (Para PE Econômico) */}
                <div className="space-y-1 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] font-bold text-slate-700 uppercase">
                      Lucro Desejado (R$)
                    </Label>
                    <span className="text-[10px] text-slate-400">Meta do Sócio</span>
                  </div>
                  <div className="flex items-center bg-white border border-slate-300 rounded-lg px-2 py-1 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500">
                    <span className="text-xs font-bold text-slate-400 mr-1">R$</span>
                    <Input
                      type="number"
                      step="1000"
                      min="0"
                      value={lucroDesejadoEdit}
                      onChange={(e) => {
                        setIsManualOverride(true)
                        setLucroDesejadoEdit(e.target.value)
                      }}
                      className="h-6 text-xs font-bold text-slate-900 border-none p-0 focus-visible:ring-0 text-right"
                    />
                  </div>
                  <span className="text-[10px] text-slate-500 block truncate">
                    Base: {formatCurrency(defaultLucroDesejado)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ================= SEÇÃO 1: OS 3 PONTOS DE EQUILÍBRIO (CARDS DE DESTAQUE) ================= */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-[#0B1F3A] flex items-center gap-2">
                <Target className="w-4 h-4 text-blue-600" />
                Seção 1 — Pontos de Equilíbrio em R$ (Break-Even Points)
              </h2>
              <div className="flex items-center gap-2">
                {situacaoOperacao === 'lucro' ? (
                  <Badge className="bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 px-3 py-1">
                    <span className="w-2 h-2 rounded-full bg-white animate-pulse" />🟢 Operação
                    Saudável (Lucro)
                  </Badge>
                ) : situacaoOperacao === 'atencao' ? (
                  <Badge className="bg-amber-500 text-slate-900 font-bold text-xs flex items-center gap-1.5 px-3 py-1">
                    <span className="w-2 h-2 rounded-full bg-slate-900" />🟠 Atenção (Próxima ao
                    Equilíbrio)
                  </Badge>
                ) : (
                  <Badge className="bg-red-500 text-white font-bold text-xs flex items-center gap-1.5 px-3 py-1">
                    <span className="w-2 h-2 rounded-full bg-white animate-pulse" />🔴 Operação
                    Deficitária (Prejuízo)
                  </Badge>
                )}
              </div>
            </div>

            {/* Grid dos 3 Cards Principais: Contábil, Econômico e Financeiro */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Card 1: Ponto de Equilíbrio Contábil (PEC) */}
              <Card className="bg-white border-slate-200 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden">
                <div>
                  <CardHeader className="p-4 pb-2 border-b border-slate-100 flex flex-row items-start justify-between gap-2 space-y-0">
                    <div>
                      <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                        Ponto Contábil
                      </span>
                      <CardTitle className="text-base font-bold text-[#0B1F3A] mt-1.5">
                        PE Contábil (PEC)
                      </CardTitle>
                    </div>

                    {getStatusVsReceita(pec) === 'verde' ? (
                      <Badge className="bg-emerald-50 text-emerald-700 border-emerald-300 font-bold text-xs flex items-center gap-1 px-2.5 py-1">
                        🟢 Faturamento Acima
                      </Badge>
                    ) : getStatusVsReceita(pec) === 'ambar' ? (
                      <Badge className="bg-amber-50 text-amber-700 border-amber-300 font-bold text-xs flex items-center gap-1 px-2.5 py-1">
                        🟠 No Limite
                      </Badge>
                    ) : (
                      <Badge className="bg-red-50 text-red-700 border-red-300 font-bold text-xs flex items-center gap-1 px-2.5 py-1">
                        🔴 Abaixo do Ponto
                      </Badge>
                    )}
                  </CardHeader>

                  <CardContent className="p-4 space-y-3">
                    <div className="p-3 bg-gradient-to-r from-slate-50 to-emerald-50/40 rounded-xl border border-slate-100">
                      <span className="text-[10px] font-semibold uppercase text-slate-500 block">
                        Fórmula
                      </span>
                      <code className="text-xs font-mono font-bold text-slate-800 bg-white px-1.5 py-0.5 rounded border border-slate-200 mt-0.5 inline-block">
                        Custos Fixos ÷ Margem de Contribuição (%)
                      </code>
                      <div className="text-right mt-2">
                        <span className="text-[10px] font-semibold text-slate-400 block uppercase">
                          PEC Necessário
                        </span>
                        <div className="text-2xl font-black text-emerald-700 tracking-tight">
                          {formatCurrency(pec)}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                        <Info className="w-3.5 h-3.5 text-blue-600" />
                        O que este valor significa?
                      </span>
                      <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100 leading-relaxed">
                        É o volume de faturamento em que o Lucro Contábil é exatamente zero
                        (empate). Cobrem-se todos os custos e despesas fixas (
                        {formatCurrency(custosFixos)}), sem gerar lucro nem prejuízo contábil.
                      </p>
                    </div>

                    <div className="text-[11px] text-slate-500 border-t border-slate-100 pt-2 flex justify-between">
                      <span>
                        Receita Atual: <strong>{formatCurrency(receitaLiquida)}</strong>
                      </span>
                      <span
                        className={
                          receitaLiquida >= pec
                            ? 'text-emerald-700 font-bold'
                            : 'text-red-600 font-bold'
                        }
                      >
                        {receitaLiquida >= pec
                          ? `+${formatCurrency(receitaLiquida - pec)}`
                          : formatCurrency(receitaLiquida - pec)}
                      </span>
                    </div>
                  </CardContent>
                </div>
              </Card>

              {/* Card 2: Ponto de Equilíbrio Econômico (PEE) */}
              <Card className="bg-white border-slate-200 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden">
                <div>
                  <CardHeader className="p-4 pb-2 border-b border-slate-100 flex flex-row items-start justify-between gap-2 space-y-0">
                    <div>
                      <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider bg-purple-50 px-2 py-0.5 rounded border border-purple-100">
                        Ponto Econômico
                      </span>
                      <CardTitle className="text-base font-bold text-[#0B1F3A] mt-1.5">
                        PE Econômico (PEE)
                      </CardTitle>
                    </div>

                    {getStatusVsReceita(pee) === 'verde' ? (
                      <Badge className="bg-purple-50 text-purple-700 border-purple-300 font-bold text-xs flex items-center gap-1 px-2.5 py-1">
                        🟢 Lucro Atingido
                      </Badge>
                    ) : getStatusVsReceita(pee) === 'ambar' ? (
                      <Badge className="bg-amber-50 text-amber-700 border-amber-300 font-bold text-xs flex items-center gap-1 px-2.5 py-1">
                        🟠 Próximo da Meta
                      </Badge>
                    ) : (
                      <Badge className="bg-red-50 text-red-700 border-red-300 font-bold text-xs flex items-center gap-1 px-2.5 py-1">
                        🔴 Meta Não Atingida
                      </Badge>
                    )}
                  </CardHeader>

                  <CardContent className="p-4 space-y-3">
                    <div className="p-3 bg-gradient-to-r from-slate-50 to-purple-50/40 rounded-xl border border-slate-100">
                      <span className="text-[10px] font-semibold uppercase text-slate-500 block">
                        Fórmula
                      </span>
                      <code className="text-xs font-mono font-bold text-slate-800 bg-white px-1.5 py-0.5 rounded border border-slate-200 mt-0.5 inline-block">
                        (Custos Fixos + Lucro Desejado) ÷ MC (%)
                      </code>
                      <div className="text-right mt-2">
                        <span className="text-[10px] font-semibold text-slate-400 block uppercase">
                          PEE Necessário
                        </span>
                        <div className="text-2xl font-black text-purple-700 tracking-tight">
                          {formatCurrency(pee)}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                        <Info className="w-3.5 h-3.5 text-blue-600" />
                        O que este valor significa?
                      </span>
                      <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100 leading-relaxed">
                        Faturamento mínimo necessário para cobrir os custos fixos E garantir a meta
                        de lucro desejado ({formatCurrency(lucroDesejado)}), remunerando o custo de
                        oportunidade do capital dos sócios.
                      </p>
                    </div>

                    <div className="text-[11px] text-slate-500 border-t border-slate-100 pt-2 flex justify-between">
                      <span>
                        Lucro Meta: <strong>{formatCurrency(lucroDesejado)}</strong>
                      </span>
                      <span
                        className={
                          receitaLiquida >= pee ? 'text-purple-700 font-bold' : 'text-slate-600'
                        }
                      >
                        {receitaLiquida >= pee
                          ? `+${formatCurrency(receitaLiquida - pee)}`
                          : `Faltam ${formatCurrency(pee - receitaLiquida)}`}
                      </span>
                    </div>
                  </CardContent>
                </div>
              </Card>

              {/* Card 3: Ponto de Equilíbrio Financeiro (PEF) */}
              <Card className="bg-white border-slate-200 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden">
                <div>
                  <CardHeader className="p-4 pb-2 border-b border-slate-100 flex flex-row items-start justify-between gap-2 space-y-0">
                    <div>
                      <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider bg-amber-50 px-2 py-0.5 rounded border border-amber-100">
                        Ponto Financeiro (Caixa)
                      </span>
                      <CardTitle className="text-base font-bold text-[#0B1F3A] mt-1.5">
                        PE Financeiro (PEF)
                      </CardTitle>
                    </div>

                    {getStatusVsReceita(pef) === 'verde' ? (
                      <Badge className="bg-amber-50 text-amber-800 border-amber-300 font-bold text-xs flex items-center gap-1 px-2.5 py-1">
                        🟢 Caixa Positivo
                      </Badge>
                    ) : getStatusVsReceita(pef) === 'ambar' ? (
                      <Badge className="bg-amber-50 text-amber-700 border-amber-300 font-bold text-xs flex items-center gap-1 px-2.5 py-1">
                        🟠 Caixa no Limite
                      </Badge>
                    ) : (
                      <Badge className="bg-red-50 text-red-700 border-red-300 font-bold text-xs flex items-center gap-1 px-2.5 py-1">
                        🔴 Queima de Caixa
                      </Badge>
                    )}
                  </CardHeader>

                  <CardContent className="p-4 space-y-3">
                    <div className="p-3 bg-gradient-to-r from-slate-50 to-amber-50/40 rounded-xl border border-slate-100">
                      <span className="text-[10px] font-semibold uppercase text-slate-500 block">
                        Fórmula
                      </span>
                      <code className="text-xs font-mono font-bold text-slate-800 bg-white px-1.5 py-0.5 rounded border border-slate-200 mt-0.5 inline-block">
                        (Custos Fixos − Depreciação) ÷ MC (%)
                      </code>
                      <div className="text-right mt-2">
                        <span className="text-[10px] font-semibold text-slate-400 block uppercase">
                          PEF Necessário
                        </span>
                        <div className="text-2xl font-black text-amber-700 tracking-tight">
                          {formatCurrency(pef)}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                        <Info className="w-3.5 h-3.5 text-blue-600" />
                        O que este valor significa?
                      </span>
                      <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100 leading-relaxed">
                        Faturamento mínimo estritamente para honrar as despesas desembolsáveis
                        (saídas reais de caixa). Exclui despesas não financeiras como depreciação e
                        amortização ({formatCurrency(depreciacao)}).
                      </p>
                    </div>

                    <div className="text-[11px] text-slate-500 border-t border-slate-100 pt-2 flex justify-between">
                      <span>
                        Desembolso Fixo:{' '}
                        <strong>{formatCurrency(Math.max(0, custosFixos - depreciacao))}</strong>
                      </span>
                      <span className="text-amber-800 font-bold">
                        {receitaLiquida >= pef ? '✓ Caixa Coberto' : '✗ Déficit de Caixa'}
                      </span>
                    </div>
                  </CardContent>
                </div>
              </Card>
            </div>
          </div>

          {/* ================= SEÇÃO 2: MARGEM DE CONTRIBUIÇÃO E MARGEM DE SEGURANÇA ================= */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-[#0B1F3A] flex items-center gap-2">
                <Percent className="w-4 h-4 text-emerald-600" />
                Seção 2 — Margem de Contribuição e Margem de Segurança
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Card 1: Margem de Contribuição (R$ e %) */}
              <Card className="bg-white border-slate-200 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between">
                <CardHeader className="p-4 pb-2 border-b border-slate-100">
                  <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                    Ganho Bruto Unitário
                  </span>
                  <CardTitle className="text-sm font-bold text-[#0B1F3A] mt-1.5">
                    Margem de Contribuição (MC)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-end justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">
                        Valor em R$
                      </span>
                      <div className="text-xl font-black text-blue-900">
                        {formatCurrency(margemContribuicaoReais)}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">
                        Percentual
                      </span>
                      <div className="text-2xl font-black text-blue-600">
                        {formatPercent(margemContribuicaoPercentual, 1)}
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100 leading-relaxed">
                    A cada R$ 100 faturados, restam{' '}
                    <strong>R$ {formatNumber(margemContribuicaoPercentual, 2)}</strong> livres para
                    pagar a estrutura fixa e gerar lucro líquido aos sócios.
                  </p>
                </CardContent>
              </Card>

              {/* Card 2: Margem de Segurança (%) */}
              <Card className="bg-white border-slate-200 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between">
                <CardHeader className="p-4 pb-2 border-b border-slate-100 flex flex-row items-start justify-between gap-2 space-y-0">
                  <div>
                    <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                      Folga Operacional
                    </span>
                    <CardTitle className="text-sm font-bold text-[#0B1F3A] mt-1.5">
                      Margem de Segurança (MS)
                    </CardTitle>
                  </div>

                  {margemSeguranca >= 15 ? (
                    <Badge className="bg-emerald-50 text-emerald-700 border-emerald-300 font-bold text-[11px]">
                      🟢 Folga Alta (≥ 15%)
                    </Badge>
                  ) : margemSeguranca >= 0 ? (
                    <Badge className="bg-amber-50 text-amber-700 border-amber-300 font-bold text-[11px]">
                      🟠 Folga Baixa (&lt; 15%)
                    </Badge>
                  ) : (
                    <Badge className="bg-red-50 text-red-700 border-red-300 font-bold text-[11px]">
                      🔴 Margem Negativa
                    </Badge>
                  )}
                </CardHeader>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-end justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">
                        Folga em R$
                      </span>
                      <div
                        className={`text-xl font-black ${
                          margemSegurancaReais >= 0 ? 'text-emerald-700' : 'text-red-600'
                        }`}
                      >
                        {formatCurrency(margemSegurancaReais)}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">
                        Folga em %
                      </span>
                      <div
                        className={`text-2xl font-black ${
                          margemSeguranca >= 15
                            ? 'text-emerald-600'
                            : margemSeguranca >= 0
                              ? 'text-amber-600'
                              : 'text-red-600'
                        }`}
                      >
                        {formatPercent(margemSeguranca, 1)}
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100 leading-relaxed">
                    {margemSeguranca >= 0
                      ? `As vendas podem cair até ${formatPercent(
                          margemSeguranca,
                          1,
                        )} antes que a empresa comece a operar no prejuízo contábil.`
                      : `A empresa está operando ${formatPercent(
                          Math.abs(margemSeguranca),
                          1,
                        )} abaixo do volume necessário para empatar seus custos.`}
                  </p>
                </CardContent>
              </Card>

              {/* Card 3: Resultado Operacional vs Fixos */}
              <Card className="bg-white border-slate-200 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between">
                <CardHeader className="p-4 pb-2 border-b border-slate-100">
                  <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                    Resultado da Operação
                  </span>
                  <CardTitle className="text-sm font-bold text-[#0B1F3A] mt-1.5">
                    Cobertura de Custos Fixos
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-end justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">
                        MC Total Gerada
                      </span>
                      <div className="text-lg font-bold text-slate-900">
                        {formatCurrency(margemContribuicaoReais)}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">
                        Custos Fixos Totais
                      </span>
                      <div className="text-lg font-bold text-slate-700">
                        {formatCurrency(custosFixos)}
                      </div>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-blue-50/50 border border-blue-100 flex items-center justify-between text-xs">
                    <span className="font-semibold text-blue-950">Excedente Contábil (EBIT):</span>
                    <strong
                      className={`font-mono text-sm ${
                        margemContribuicaoReais - custosFixos >= 0
                          ? 'text-emerald-700'
                          : 'text-red-600'
                      }`}
                    >
                      {formatCurrency(margemContribuicaoReais - custosFixos)}
                    </strong>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* ================= SEÇÃO 3: GRÁFICO RECHARTS COMPARATIVO ================= */}
          <Card className="bg-white border-slate-200 shadow-2xs">
            <CardHeader className="pb-2 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">
                    <BarChart3 className="w-4 h-4" />
                  </div>
                  <CardTitle className="text-base font-bold text-[#0B1F3A]">
                    Seção 3 — Gráfico Comparativo: Receita Líquida vs 3 Pontos de Equilíbrio (
                    {selectedAno})
                  </CardTitle>
                </div>
                <CardDescription className="text-xs mt-0.5">
                  Comparativo direto em reais (R$) entre a receita atual da empresa e os pontos de
                  equilíbrio Contábil, Econômico e Financeiro
                </CardDescription>
              </div>

              <div className="flex items-center gap-3 text-[11px] font-semibold flex-wrap">
                <span className="flex items-center gap-1 text-blue-700">
                  <span className="w-2.5 h-2.5 rounded-sm bg-blue-600" />
                  Receita Atual
                </span>
                <span className="flex items-center gap-1 text-emerald-700">
                  <span className="w-2.5 h-2.5 rounded-sm bg-emerald-600" />
                  PE Contábil
                </span>
                <span className="flex items-center gap-1 text-purple-700">
                  <span className="w-2.5 h-2.5 rounded-sm bg-purple-600" />
                  PE Econômico
                </span>
                <span className="flex items-center gap-1 text-amber-700">
                  <span className="w-2.5 h-2.5 rounded-sm bg-amber-600" />
                  PE Financeiro
                </span>
              </div>
            </CardHeader>

            <CardContent className="pt-6">
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={dadosGraficoComparativo}
                    margin={{ top: 10, right: 30, left: 60, bottom: 10 }}
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
                      width={120}
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

              {/* Grid explicativo inferior */}
              <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-4 gap-3 text-center text-xs">
                <div className="p-2.5 rounded-lg bg-blue-50/50 border border-blue-100">
                  <span className="font-bold text-blue-900 block">Receita Líquida</span>
                  <span className="text-sm font-extrabold text-blue-800 block mt-0.5">
                    {formatCurrency(receitaLiquida)}
                  </span>
                  <span className="text-[10px] text-slate-500">Faturamento atual da empresa</span>
                </div>

                <div className="p-2.5 rounded-lg bg-emerald-50/50 border border-emerald-100">
                  <span className="font-bold text-emerald-900 block">PE Contábil (PEC)</span>
                  <span className="text-sm font-extrabold text-emerald-800 block mt-0.5">
                    {formatCurrency(pec)}
                  </span>
                  <span className="text-[10px] text-slate-500">Cobre todos os custos fixos</span>
                </div>

                <div className="p-2.5 rounded-lg bg-purple-50/50 border border-purple-100">
                  <span className="font-bold text-purple-900 block">PE Econômico (PEE)</span>
                  <span className="text-sm font-extrabold text-purple-800 block mt-0.5">
                    {formatCurrency(pee)}
                  </span>
                  <span className="text-[10px] text-slate-500">Fixos + Lucro Desejado</span>
                </div>

                <div className="p-2.5 rounded-lg bg-amber-50/50 border border-amber-100">
                  <span className="font-bold text-amber-900 block">PE Financeiro (PEF)</span>
                  <span className="text-sm font-extrabold text-amber-800 block mt-0.5">
                    {formatCurrency(pef)}
                  </span>
                  <span className="text-[10px] text-slate-500">Cobre saídas de caixa reais</span>
                </div>
              </div>
            </CardContent>
          </Card>

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
                        Parecer Integrado do Consultor Financeiro · Ponto de Equilíbrio{' '}
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
                    1. Diagnóstico do Ponto de Equilíbrio Contábil (PEC)
                  </span>
                  <p className="text-slate-200 leading-relaxed">
                    {parecerConsolidado.diagnosticoPEC}
                  </p>
                </div>

                <div className="bg-white/5 p-4 rounded-xl border border-white/10 space-y-1.5">
                  <span className="font-bold text-purple-300 uppercase tracking-wider text-[11px] block">
                    2. Diagnóstico do Ponto de Equilíbrio Econômico (PEE)
                  </span>
                  <p className="text-slate-200 leading-relaxed">
                    {parecerConsolidado.diagnosticoPEE}
                  </p>
                </div>

                <div className="bg-white/5 p-4 rounded-xl border border-white/10 space-y-1.5">
                  <span className="font-bold text-amber-300 uppercase tracking-wider text-[11px] block">
                    3. Diagnóstico do Ponto de Equilíbrio Financeiro (PEF - Caixa)
                  </span>
                  <p className="text-slate-200 leading-relaxed">
                    {parecerConsolidado.diagnosticoPEF}
                  </p>
                </div>

                <div className="bg-white/5 p-4 rounded-xl border border-white/10 space-y-1.5">
                  <span className="font-bold text-blue-300 uppercase tracking-wider text-[11px] block">
                    4. Recomendações Estratégicas do Consultor
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
