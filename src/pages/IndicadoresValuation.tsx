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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
  ShieldCheck,
  AlertCircle,
  PlusCircle,
  Layers,
  Info,
  Scale,
  BarChart3,
  DollarSign,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Coins,
  Sparkles,
  ArrowRight,
  Calculator,
  Briefcase,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export default function IndicadoresValuation() {
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

  // ================= PARÂMETROS CONFIGURÁVEIS PELO USUÁRIO =================
  // Modelo FCD
  const [taxaPerpetuidade, setTaxaPerpetuidade] = useState<number>(3.0) // g (%)
  const [taxaWacc, setTaxaWacc] = useState<number>(12.0) // WACC (%)
  const [anosProjecao, setAnosProjecao] = useState<number>(5) // anos (3 a 10)
  const [crescimentoAnualFcf, setCrescimentoAnualFcf] = useState<number>(5.0) // crescimento no período projetado (%)

  // Modelo Goodwill
  const [taxaRetornoEsperadoPL, setTaxaRetornoEsperadoPL] = useState<number>(12.0) // taxa retorno esperado sobre o PL (%)
  const [taxaCapitalizacaoGoodwill, setTaxaCapitalizacaoGoodwill] = useState<number>(20.0) // taxa de capitalização (%)

  // Detalhes expandidos dos cards
  const [expandDetailsFcd, setExpandDetailsFcd] = useState<boolean>(false)
  const [expandDetailsGoodwill, setExpandDetailsGoodwill] = useState<boolean>(false)

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
      console.error('Erro ao carregar balanços e DRE para valuation:', err)
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

  // ================= 1. MODELO FLUXO DE CAIXA DESCONTADO (FCD) =================
  // Base de fluxo de caixa: EBITDA (ou Lucro Operacional caso EBITDA não esteja disponível / seja 0)
  const baseFluxoCaixa = useMemo(() => {
    if (calcD.ebitda !== 0) return calcD.ebitda
    return calcD.resultadoOperacional || 0
  }, [calcD.ebitda, calcD.resultadoOperacional])

  const nomeBaseFluxo = calcD.ebitda !== 0 ? 'EBITDA' : 'Lucro Operacional'

  const waccDecimal = taxaWacc / 100
  const gDecimal = taxaPerpetuidade / 100
  const fcfGrowthDecimal = crescimentoAnualFcf / 100

  // Validação: WACC deve ser estritamente maior que g para o modelo de Gordon
  const isWaccMenorOuIgualG = waccDecimal <= gDecimal

  // Projeção ano a ano
  const projecaoAnual = useMemo(() => {
    const anosValidos = Math.max(3, Math.min(10, anosProjecao || 5))
    const fluxos = []
    let fcfAcum = baseFluxoCaixa
    let somaVp = 0

    for (let t = 1; t <= anosValidos; t++) {
      fcfAcum = fcfAcum * (1 + fcfGrowthDecimal)
      const fatorDesconto = Math.pow(1 + waccDecimal, t)
      const vp = fatorDesconto > 0 ? fcfAcum / fatorDesconto : 0
      somaVp += vp

      fluxos.push({
        anoIndex: t,
        anoCalendario: selectedAno + t,
        fcf: fcfAcum,
        fatorDesconto,
        vp,
      })
    }

    return {
      fluxos,
      somaVp,
      fcfFinal: fcfAcum,
      anosValidos,
    }
  }, [baseFluxoCaixa, fcfGrowthDecimal, waccDecimal, anosProjecao, selectedAno])

  // Valor Terminal (Perpetuidade de Gordon)
  // Terminal Value = FCF_final * (1 + g) / (WACC - g)
  // VP do Terminal = Terminal Value / (1 + WACC)^n
  const { valorTerminalNominal, vpValorTerminal, valorEmpresaFCD } = useMemo(() => {
    if (isWaccMenorOuIgualG || waccDecimal <= 0) {
      return {
        valorTerminalNominal: 0,
        vpValorTerminal: 0,
        valorEmpresaFCD: 0,
      }
    }

    const { fcfFinal, somaVp, anosValidos } = projecaoAnual
    const terminalNominal = (fcfFinal * (1 + gDecimal)) / (waccDecimal - gDecimal)
    const fatorDescontoTerminal = Math.pow(1 + waccDecimal, anosValidos)
    const vpTerminal = fatorDescontoTerminal > 0 ? terminalNominal / fatorDescontoTerminal : 0
    const ev = somaVp + vpTerminal

    return {
      valorTerminalNominal: terminalNominal,
      vpValorTerminal: vpTerminal,
      valorEmpresaFCD: ev,
    }
  }, [isWaccMenorOuIgualG, waccDecimal, gDecimal, projecaoAnual])

  // ================= 2. MODELO GOODWILL (SUPERLUCRO) =================
  // Valor Contábil = Patrimônio Líquido (PL)
  const patrimonioLiquido = calcB.patrimonioLiquido
  const lucroLiquido = calcD.lucroLiquido

  const taxaRetornoPLDecimal = taxaRetornoEsperadoPL / 100
  const taxaCapGoodwillDecimal = taxaCapitalizacaoGoodwill / 100

  // Lucro Normal = PL * taxa de retorno esperado
  const lucroNormal = patrimonioLiquido * taxaRetornoPLDecimal

  // Superlucro = Lucro Líquido - Lucro Normal
  const superlucro = lucroLiquido - lucroNormal

  // Goodwill = Superlucro / taxa de capitalização
  // Se superlucro < 0, goodwill é negativo (destruição de valor relativo)
  const goodwill = taxaCapGoodwillDecimal > 0 ? superlucro / taxaCapGoodwillDecimal : 0

  // Valor da Empresa pelo Goodwill = PL + Goodwill
  const valorEmpresaGoodwill = patrimonioLiquido + goodwill

  // ================= 3. COMPARATIVO ENTRE OS DOIS MODELOS =================
  const diferencaValor = valorEmpresaFCD - valorEmpresaGoodwill
  const diferencaPercentual =
    valorEmpresaGoodwill !== 0 ? (diferencaValor / Math.abs(valorEmpresaGoodwill)) * 100 : 0

  const dadosGraficoComparativo = useMemo(() => {
    return [
      {
        nome: 'Fluxo de Caixa Descontado (FCD)',
        sigla: 'FCD (Gordon)',
        valor: isWaccMenorOuIgualG ? 0 : Number(valorEmpresaFCD.toFixed(2)),
        descricao: 'Valor intrínseco pela capacidade futura de geração de caixa',
        cor: '#2563EB', // blue-600
      },
      {
        nome: 'Modelo Goodwill (Superlucro)',
        sigla: 'Goodwill (PL + Excedente)',
        valor: Number(valorEmpresaGoodwill.toFixed(2)),
        descricao: 'Valor contábil acrescido da capitalização de lucros anormais',
        cor: '#059669', // emerald-600
      },
    ]
  }, [isWaccMenorOuIgualG, valorEmpresaFCD, valorEmpresaGoodwill])

  // ================= 4. PARECER EXECUTIVO E CONSOLIDADO =================
  const parecerConsolidado = useMemo(() => {
    if (!balancoAtual && !dreAtual) return null

    let nivel: 'excelente' | 'adequado' | 'alerta' | 'critico' = 'adequado'
    let titulo = ''
    let diagnosticoFCD = ''
    let diagnosticoGoodwill = ''
    let comparativoTexto = ''
    let recomendacao = ''

    if (isWaccMenorOuIgualG) {
      nivel = 'alerta'
      titulo = 'Parâmetros de Desconto Incompatíveis com a Perpetuidade'
      diagnosticoFCD =
        'A taxa de desconto (WACC) é inferior ou igual à taxa de crescimento perpétuo (g), tornando a fórmula de Gordon matematicamente indefinida ou negativa. Ajuste o WACC para valor superior ao crescimento de longo prazo.'
    } else if (valorEmpresaFCD > 0 && superlucro > 0) {
      nivel = 'excelente'
      titulo = 'Forte Criação de Valor Intrínseco e Superlucro Consistente'
      diagnosticoFCD = `Pelo modelo FCD, a empresa foi avaliada em ${formatCurrency(
        valorEmpresaFCD,
      )} (sendo ${formatCurrency(projecaoAnual.somaVp)} de fluxos projetados e ${formatCurrency(
        vpValorTerminal,
      )} de valor terminal a valor presente). O fluxo de caixa operacional (base de ${formatCurrency(
        baseFluxoCaixa,
      )}) suporta uma sólida avaliação de mercado.`
      diagnosticoGoodwill = `Pelo método do Goodwill, a empresa apresenta superlucro positivo de ${formatCurrency(
        superlucro,
      )} acima do retorno esperado de ${formatPercent(
        taxaRetornoEsperadoPL,
        1,
      )} sobre o PL. O goodwill apurado de ${formatCurrency(
        goodwill,
      )} eleva o valor global para ${formatCurrency(valorEmpresaGoodwill)}.`
    } else if (valorEmpresaFCD > 0 && superlucro <= 0) {
      nivel = 'alerta'
      titulo = 'Capacidade de Geração de Caixa Futura com Desafio de Rentabilidade Atual sobre o PL'
      diagnosticoFCD = `O modelo FCD aponta valor de ${formatCurrency(
        valorEmpresaFCD,
      )}, impulsionado pela projeção dos fluxos operacionais. No entanto, no ano de ${selectedAno}, o lucro líquido (${formatCurrency(
        lucroLiquido,
      )}) não atingiu a meta de remuneração esperada do PL (${formatCurrency(
        lucroNormal,
      )} a ${taxaRetornoEsperadoPL}% a.a.).`
      diagnosticoGoodwill = `Com superlucro negativo de ${formatCurrency(
        superlucro,
      )}, não há criação de goodwill positivo no exercício corrente, indicando que a empresa ainda precisa converter sua estrutura de ativos em maior rentabilidade imediata.`
    } else {
      nivel = 'critico'
      titulo = 'Sinais de Fragilidade nos Resultados Operacionais e no Valor Econômico'
      diagnosticoFCD = `A base de fluxo de caixa operacional (${formatCurrency(
        baseFluxoCaixa,
      )}) e o lucro líquido (${formatCurrency(
        lucroLiquido,
      )}) impactaram negativamente a precificação da companhia em ambos os modelos.`
      diagnosticoGoodwill = `O valor patrimonial líquido (PL de ${formatCurrency(
        patrimonioLiquido,
      )}) sofreu deságio pelo goodwill negativo de ${formatCurrency(
        goodwill,
      )}, totalizando ${formatCurrency(valorEmpresaGoodwill)}.`
    }

    if (!isWaccMenorOuIgualG) {
      const diffValorAbs = Math.abs(diferencaValor)
      const diffPctAbs = Math.abs(diferencaPercentual)
      if (valorEmpresaFCD > valorEmpresaGoodwill) {
        comparativoTexto = `O método FCD precifica a organização em patamar superior ao Goodwill (+${formatCurrency(
          diffValorAbs,
        )} ou +${formatPercent(
          diffPctAbs,
          1,
        )}). Isso ocorre porque o FCD captura o potencial de crescimento futuro dos fluxos livres, enquanto o Goodwill reflete preponderantemente a fotografia contábil histórica do Patrimônio Líquido adicionada do lucro corrente.`
      } else {
        comparativoTexto = `O método Goodwill resultou em avaliação superior ao FCD (+${formatCurrency(
          diffValorAbs,
        )} ou +${formatPercent(
          diffPctAbs,
          1,
        )}), indicando forte base patrimonial instalada (PL de ${formatCurrency(
          patrimonioLiquido,
        )}) frente à capacidade atual de projeção de fluxos de caixa livres operacionais.`
      }
    }

    if (nivel === 'excelente') {
      recomendacao =
        '1) Utilizar a avaliação FCD como balizador principal em negociações societárias e captação de sócios estratégicos; 2) Monitorar a taxa WACC frente às oscilações da taxa básica de juros (Selic); 3) Manter os investimentos operacionais para sustentar a taxa de crescimento g projetada.'
    } else if (nivel === 'alerta') {
      recomendacao =
        '1) Otimizar os custos fixos para expandir a margem de lucro líquido e transformar o superlucro em positivo; 2) Revisar a taxa de retorno esperada dos sócios para alinhar expectativas realistas de remuneração do capital; 3) Reavaliar ativos operacionais ociosos para enxugar o patrimônio líquido empregado.'
    } else {
      recomendacao =
        '1) Implementar plano de reestruturação de receitas e despesas operacionais; 2) Conter investimentos em ativos fixos não monetizáveis; 3) Preservar a liquidez imediata e renegociar despesas financeiras onerosas.'
    }

    return {
      nivel,
      titulo,
      diagnosticoFCD,
      diagnosticoGoodwill,
      comparativoTexto,
      recomendacao,
    }
  }, [
    balancoAtual,
    dreAtual,
    selectedAno,
    isWaccMenorOuIgualG,
    valorEmpresaFCD,
    valorEmpresaGoodwill,
    projecaoAnual,
    vpValorTerminal,
    baseFluxoCaixa,
    lucroLiquido,
    lucroNormal,
    superlucro,
    goodwill,
    patrimonioLiquido,
    taxaRetornoEsperadoPL,
    diferencaValor,
    diferencaPercentual,
  ])

  // ================= 5. EXPORTAÇÃO CSV COMPLETA =================
  const handleExportCsv = () => {
    if (!selectedEmpresa) {
      toast({
        title: 'Selecione uma empresa',
        description: 'É necessário selecionar uma empresa para exportar o valuation.',
        variant: 'destructive',
      })
      return
    }

    let csvContent = '\uFEFF' // BOM UTF-8
    const dataEmissao = new Date().toLocaleDateString('pt-BR')

    csvContent += `RELATÓRIO DE VALUATION - AVALIAÇÃO DE EMPRESAS\n`
    csvContent += `EMPRESA;${selectedEmpresa.nome}\n`
    csvContent += `CNPJ;${formatCnpj(selectedEmpresa.cnpj)}\n`
    csvContent += `SEGMENTO;${selectedEmpresa.segmento}\n`
    csvContent += `EXERCÍCIO BASE;${selectedAno}\n`
    csvContent += `DATA DE EMISSÃO;${dataEmissao}\n\n`

    csvContent += `PARÂMETROS UTILIZADOS\n`
    csvContent += `Taxa de Desconto (WACC);${taxaWacc.toFixed(2).replace('.', ',')}%\n`
    csvContent += `Taxa de Crescimento na Perpetuidade (g);${taxaPerpetuidade.toFixed(2).replace('.', ',')}%\n`
    csvContent += `Crescimento Anual Projetado (FCF);${crescimentoAnualFcf.toFixed(2).replace('.', ',')}%\n`
    csvContent += `Período Projetado;${anosProjecao} anos\n`
    csvContent += `Taxa de Retorno Esperado sobre PL (Goodwill);${taxaRetornoEsperadoPL.toFixed(2).replace('.', ',')}%\n`
    csvContent += `Taxa de Capitalização do Goodwill;${taxaCapitalizacaoGoodwill.toFixed(2).replace('.', ',')}%\n\n`

    csvContent += `DADOS BASE EXTRAÍDOS DAS DEMONSTRAÇÕES (R$)\n`
    csvContent += `Receita Líquida;${calcD.receitaLiquida.toFixed(2).replace('.', ',')}\n`
    csvContent += `EBITDA (Base FCD);${calcD.ebitda.toFixed(2).replace('.', ',')}\n`
    csvContent += `Resultado Operacional (EBIT);${calcD.resultadoOperacional.toFixed(2).replace('.', ',')}\n`
    csvContent += `Lucro Líquido (LL);${calcD.lucroLiquido.toFixed(2).replace('.', ',')}\n`
    csvContent += `Patrimônio Líquido (PL - Valor Contábil);${calcB.patrimonioLiquido.toFixed(2).replace('.', ',')}\n`
    csvContent += `Ativo Total;${calcB.ativoTotal.toFixed(2).replace('.', ',')}\n\n`

    csvContent += `PROJEÇÃO DE FLUXOS DE CAIXA LIVRES (FCD) ANO A ANO\n`
    csvContent += `Período;Ano Calendário;FCF Projetado (R$);Fator de Desconto;Valor Presente (VP) (R$)\n`
    projecaoAnual.fluxos.forEach((f) => {
      csvContent += `Ano ${f.anoIndex};${f.anoCalendario};${f.fcf.toFixed(2).replace('.', ',')};${f.fatorDesconto.toFixed(4).replace('.', ',')};${f.vp.toFixed(2).replace('.', ',')}\n`
    })
    csvContent += `Soma do VP dos Fluxos Projetados;;;;${projecaoAnual.somaVp.toFixed(2).replace('.', ',')}\n`
    csvContent += `Valor Terminal Nominal (Gordon);;;;${valorTerminalNominal.toFixed(2).replace('.', ',')}\n`
    csvContent += `VP do Valor Terminal;;;;${vpValorTerminal.toFixed(2).replace('.', ',')}\n`
    csvContent += `VALOR TOTAL DA EMPRESA (FCD);;;;${valorEmpresaFCD.toFixed(2).replace('.', ',')}\n\n`

    csvContent += `AVALIAÇÃO PELO MODELO GOODWILL (SUPERLUCRO)\n`
    csvContent += `Componente;Fórmula;Valor (R$);Observação\n`
    csvContent += `Patrimônio Líquido (PL);Balanço Patrimonial;${patrimonioLiquido.toFixed(2).replace('.', ',')};Valor Contábil Base\n`
    csvContent += `Lucro Normal Esperado;PL × ${taxaRetornoEsperadoPL}%;${lucroNormal.toFixed(2).replace('.', ',')};Custo de Oportunidade do PL\n`
    csvContent += `Lucro Líquido Real;DRE;${lucroLiquido.toFixed(2).replace('.', ',')};Resultado do Exercício\n`
    csvContent += `Superlucro;Lucro Líquido − Lucro Normal;${superlucro.toFixed(2).replace('.', ',')};${superlucro >= 0 ? 'Lucro Excedente Positivo' : 'Superlucro Negativo / Deságio'}\n`
    csvContent += `Goodwill;Superlucro / ${taxaCapitalizacaoGoodwill}%;${goodwill.toFixed(2).replace('.', ',')};Capitalização do Lucro Excedente\n`
    csvContent += `VALOR TOTAL DA EMPRESA (GOODWILL);PL + Goodwill;${valorEmpresaGoodwill.toFixed(2).replace('.', ',')};Valor Econômico pelo Goodwill\n\n`

    csvContent += `COMPARATIVO DOS MODELOS DE VALUATION\n`
    csvContent += `Modelo;Valor da Empresa (R$);Diferença Absoluta (R$);Diferença Percentual (%)\n`
    csvContent += `Fluxo de Caixa Descontado (FCD);${valorEmpresaFCD.toFixed(2).replace('.', ',')};${diferencaValor.toFixed(2).replace('.', ',')};${diferencaPercentual.toFixed(2).replace('.', ',')}%\n`
    csvContent += `Modelo Goodwill;${valorEmpresaGoodwill.toFixed(2).replace('.', ',')};0,00;0,00%\n\n`

    if (parecerConsolidado) {
      csvContent += `PARECER EXECUTIVO DO CONSULTOR FINANCEIRO\n`
      csvContent += `Diagnóstico Geral;${parecerConsolidado.titulo.replace(/;/g, ',')}\n`
      csvContent += `Análise FCD;${parecerConsolidado.diagnosticoFCD.replace(/\n/g, ' ').replace(/;/g, ',')}\n`
      csvContent += `Análise Goodwill;${parecerConsolidado.diagnosticoGoodwill.replace(/\n/g, ' ').replace(/;/g, ',')}\n`
      csvContent += `Comparativo Metodológico;${parecerConsolidado.comparativoTexto.replace(/\n/g, ' ').replace(/;/g, ',')}\n`
      csvContent += `Recomendações Estratégicas;${parecerConsolidado.recomendacao.replace(/\n/g, ' ').replace(/;/g, ',')}\n`
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `valuation-${selectedEmpresa.nome.replace(/\s+/g, '-').toLowerCase()}-${selectedAno}.csv`
    link.click()
    URL.revokeObjectURL(link.href)

    toast({
      title: 'CSV exportado com sucesso!',
      description: `Relatório de Valuation (${selectedAno}) exportado com sucesso.`,
    })
  }

  // Loading state
  if (loading && !balancoAtual && !dreAtual && balancos.length === 0) {
    return (
      <div className="py-20 flex flex-col justify-center items-center gap-3">
        <div className="w-9 h-9 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs text-slate-500 font-medium">
          Calculando avaliação de empresas (Valuation)...
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
            <Coins className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-extrabold text-[#0B1F3A] tracking-tight">
                Valuation — Avaliação da Empresa
              </h1>
              <Badge className="bg-blue-50 text-blue-700 border-blue-200 font-semibold text-xs">
                FCD &amp; Goodwill
              </Badge>
            </div>
            <p className="text-xs text-[#5B6B7F] mt-0.5">
              Estimativa do valor da empresa (Enterprise Value) por Fluxo de Caixa Descontado e
              Capitalização de Superlucro (Goodwill)
            </p>
          </div>
        </div>

        {/* Seletores Globais de Empresa e Ano + Exportação CSV */}
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

      {/* Painel de Parâmetros Customizáveis no Topo */}
      <Card className="bg-white border-blue-200/80 shadow-2xs overflow-hidden">
        <CardHeader className="p-4 pb-3 bg-gradient-to-r from-blue-50/70 via-slate-50 to-slate-50 border-b border-blue-100 flex flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-blue-600" />
            <CardTitle className="text-sm font-bold text-[#0B1F3A]">
              Parâmetros de Precificação e Premissas dos Modelos
            </CardTitle>
          </div>
          <span className="text-[11px] text-slate-500">
            Ajuste as taxas para simular cenários de valuation
          </span>
        </CardHeader>

        <CardContent className="p-4 pt-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* 1. WACC */}
            <div className="space-y-1">
              <Label className="text-[10px] font-bold text-slate-600 uppercase">
                Taxa de Desconto (WACC)
              </Label>
              <div className="flex items-center bg-slate-50 border border-slate-200 rounded-md px-2 py-1">
                <Input
                  type="number"
                  step="0.5"
                  min="1"
                  max="50"
                  value={taxaWacc}
                  onChange={(e) => setTaxaWacc(Number(e.target.value) || 0)}
                  className="h-6 text-xs font-bold text-slate-900 bg-transparent border-none p-0 focus-visible:ring-0 text-right"
                />
                <span className="text-xs font-semibold text-slate-500 ml-1">% a.a.</span>
              </div>
            </div>

            {/* 2. Taxa Perpetuidade (g) */}
            <div className="space-y-1">
              <Label className="text-[10px] font-bold text-slate-600 uppercase">
                Crescimento Perpétuo (g)
              </Label>
              <div className="flex items-center bg-slate-50 border border-slate-200 rounded-md px-2 py-1">
                <Input
                  type="number"
                  step="0.5"
                  min="0"
                  max="15"
                  value={taxaPerpetuidade}
                  onChange={(e) => setTaxaPerpetuidade(Number(e.target.value) || 0)}
                  className="h-6 text-xs font-bold text-slate-900 bg-transparent border-none p-0 focus-visible:ring-0 text-right"
                />
                <span className="text-xs font-semibold text-slate-500 ml-1">% a.a.</span>
              </div>
            </div>

            {/* 3. Anos Projeção */}
            <div className="space-y-1">
              <Label className="text-[10px] font-bold text-slate-600 uppercase">
                Anos Projetados
              </Label>
              <div className="flex items-center bg-slate-50 border border-slate-200 rounded-md px-2 py-1">
                <Input
                  type="number"
                  step="1"
                  min="3"
                  max="10"
                  value={anosProjecao}
                  onChange={(e) => {
                    const val = Number(e.target.value) || 5
                    setAnosProjecao(Math.max(3, Math.min(10, val)))
                  }}
                  className="h-6 text-xs font-bold text-slate-900 bg-transparent border-none p-0 focus-visible:ring-0 text-right"
                />
                <span className="text-xs font-semibold text-slate-500 ml-1">anos (3-10)</span>
              </div>
            </div>

            {/* 4. Crescimento FCF Anual */}
            <div className="space-y-1">
              <Label className="text-[10px] font-bold text-slate-600 uppercase">
                Crescimento Anual FCF
              </Label>
              <div className="flex items-center bg-slate-50 border border-slate-200 rounded-md px-2 py-1">
                <Input
                  type="number"
                  step="0.5"
                  min="-20"
                  max="50"
                  value={crescimentoAnualFcf}
                  onChange={(e) => setCrescimentoAnualFcf(Number(e.target.value) || 0)}
                  className="h-6 text-xs font-bold text-slate-900 bg-transparent border-none p-0 focus-visible:ring-0 text-right"
                />
                <span className="text-xs font-semibold text-slate-500 ml-1">% a.a.</span>
              </div>
            </div>

            {/* 5. Retorno Esperado sobre PL */}
            <div className="space-y-1">
              <Label className="text-[10px] font-bold text-slate-600 uppercase">
                Retorno Esperado s/ PL
              </Label>
              <div className="flex items-center bg-slate-50 border border-slate-200 rounded-md px-2 py-1">
                <Input
                  type="number"
                  step="0.5"
                  min="1"
                  max="50"
                  value={taxaRetornoEsperadoPL}
                  onChange={(e) => setTaxaRetornoEsperadoPL(Number(e.target.value) || 0)}
                  className="h-6 text-xs font-bold text-slate-900 bg-transparent border-none p-0 focus-visible:ring-0 text-right"
                />
                <span className="text-xs font-semibold text-slate-500 ml-1">% a.a.</span>
              </div>
            </div>

            {/* 6. Taxa Capitalização Goodwill */}
            <div className="space-y-1">
              <Label className="text-[10px] font-bold text-slate-600 uppercase">
                Capitalização Goodwill
              </Label>
              <div className="flex items-center bg-slate-50 border border-slate-200 rounded-md px-2 py-1">
                <Input
                  type="number"
                  step="1"
                  min="5"
                  max="100"
                  value={taxaCapitalizacaoGoodwill}
                  onChange={(e) => setTaxaCapitalizacaoGoodwill(Number(e.target.value) || 0)}
                  className="h-6 text-xs font-bold text-slate-900 bg-transparent border-none p-0 focus-visible:ring-0 text-right"
                />
                <span className="text-xs font-semibold text-slate-500 ml-1">% a.a.</span>
              </div>
            </div>
          </div>

          {/* Aviso se WACC <= g */}
          {isWaccMenorOuIgualG && (
            <div className="mt-3 p-3 bg-amber-50 border border-amber-300 rounded-xl flex items-start gap-2.5 text-xs text-amber-900">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold">Atenção ao cálculo da Perpetuidade de Gordon:</strong>{' '}
                A taxa de desconto (WACC = {taxaWacc}%) deve ser estritamente maior que a taxa de
                crescimento perpétuo (g = {taxaPerpetuidade}%). Com WACC ≤ g, o modelo matemático
                resultaria em valor negativo ou infinito. Por favor, ajuste o WACC para um patamar
                superior a g.
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sem demonstrações cadastradas */}
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
                exercício de {selectedAno}. Cadastre os demonstrativos para apurar o valuation.
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
          {/* ================= SEÇÃO A: MODELO FLUXO DE CAIXA DESCONTADO (FCD) ================= */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-[#0B1F3A] flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-600" />
                Modelo A — Fluxo de Caixa Descontado (FCD / Gordon)
              </h2>
              <Badge className="bg-blue-50 text-blue-700 border-blue-200 font-semibold text-xs">
                Base: {nomeBaseFluxo} ({formatCurrency(baseFluxoCaixa)})
              </Badge>
            </div>

            {/* Cards de Destaque FCD: VP Fluxos, Valor Terminal e Enterprise Value Total */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Card 1: VP dos Fluxos Projetados */}
              <Card className="bg-white border-slate-200 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between">
                <CardHeader className="p-4 pb-2 border-b border-slate-100 flex flex-row items-start justify-between gap-2 space-y-0">
                  <div>
                    <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                      Período Explícito ({anosProjecao} anos)
                    </span>
                    <CardTitle className="text-sm font-bold text-[#0B1F3A] mt-1.5">
                      VP dos Fluxos Projetados
                    </CardTitle>
                  </div>
                  <Badge className="bg-blue-100 text-blue-800 border-blue-200 font-bold text-[11px]">
                    Σ VP Fluxos
                  </Badge>
                </CardHeader>

                <CardContent className="p-4 space-y-2">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase block">
                    Valor Presente Acumulado
                  </span>
                  <div className="text-2xl font-extrabold text-[#0B1F3A]">
                    {formatCurrency(projecaoAnual.somaVp)}
                  </div>
                  <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100 leading-relaxed">
                    Soma dos fluxos de caixa livres projetados ano a ano descontados pela taxa WACC
                    de {taxaWacc}%.
                  </p>
                </CardContent>
              </Card>

              {/* Card 2: Valor Terminal na Perpetuidade */}
              <Card className="bg-white border-slate-200 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between">
                <CardHeader className="p-4 pb-2 border-b border-slate-100 flex flex-row items-start justify-between gap-2 space-y-0">
                  <div>
                    <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                      Perpetuidade de Gordon
                    </span>
                    <CardTitle className="text-sm font-bold text-[#0B1F3A] mt-1.5">
                      VP do Valor Terminal
                    </CardTitle>
                  </div>
                  <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 font-bold text-[11px]">
                    g = {taxaPerpetuidade}%
                  </Badge>
                </CardHeader>

                <CardContent className="p-4 space-y-2">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase block">
                    Valor Terminal a Valor Presente
                  </span>
                  <div className="text-2xl font-extrabold text-emerald-700">
                    {isWaccMenorOuIgualG ? 'N/D' : formatCurrency(vpValorTerminal)}
                  </div>
                  <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100 leading-relaxed">
                    Nominal de {formatCurrency(valorTerminalNominal)} descontado do ano{' '}
                    {anosProjecao} pelo WACC.
                  </p>
                </CardContent>
              </Card>

              {/* Card 3: Valor Total da Empresa (Enterprise Value) */}
              <Card className="bg-gradient-to-br from-blue-900 via-[#0B1F3A] to-slate-900 text-white border-blue-800 shadow-md flex flex-col justify-between">
                <CardHeader className="p-4 pb-2 border-b border-white/10 flex flex-row items-start justify-between gap-2 space-y-0">
                  <div>
                    <span className="text-[10px] font-extrabold text-blue-300 uppercase tracking-wider bg-blue-500/20 px-2 py-0.5 rounded border border-blue-400/30">
                      Enterprise Value (EV)
                    </span>
                    <CardTitle className="text-base font-bold text-white mt-1.5">
                      Valor Total da Empresa (FCD)
                    </CardTitle>
                  </div>
                  <Badge className="bg-emerald-500 text-white font-bold text-xs">
                    🟢 Avaliação FCD
                  </Badge>
                </CardHeader>

                <CardContent className="p-4 space-y-2">
                  <span className="text-[10px] font-semibold text-blue-200 uppercase block">
                    VP dos Fluxos + VP do Terminal
                  </span>
                  <div className="text-2xl sm:text-3xl font-black text-emerald-300">
                    {isWaccMenorOuIgualG ? 'N/D' : formatCurrency(valorEmpresaFCD)}
                  </div>
                  <span className="text-[10px] text-slate-300 block">
                    Capacidade futura de geração de riqueza descontada a valor presente
                  </span>
                </CardContent>
              </Card>
            </div>

            {/* Tabela de Projeção Ano a Ano + Botão Ver Detalhes */}
            <Card className="bg-white border-slate-200 shadow-2xs overflow-hidden">
              <CardHeader className="p-4 pb-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-sm font-bold text-[#0B1F3A]">
                    Tabela de Projeção dos Fluxos de Caixa Livres ({anosProjecao} anos)
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Evolução projetada com crescimento de {crescimentoAnualFcf}% a.a. e desconto
                    pelo WACC de {taxaWacc}% a.a.
                  </CardDescription>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setExpandDetailsFcd((prev) => !prev)}
                  className="text-xs font-semibold text-blue-700 border-blue-200 h-8"
                >
                  <Layers className="w-3.5 h-3.5 mr-1.5" />
                  {expandDetailsFcd ? 'Ocultar Fórmulas e Detalhes' : 'Ver Detalhes e Fórmulas'}
                  {expandDetailsFcd ? (
                    <ChevronUp className="w-3.5 h-3.5 ml-1" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 ml-1" />
                  )}
                </Button>
              </CardHeader>

              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-slate-50/80">
                      <TableRow>
                        <TableHead className="text-xs font-bold text-slate-700 w-24">
                          Período
                        </TableHead>
                        <TableHead className="text-xs font-bold text-slate-700">
                          Ano Calendário
                        </TableHead>
                        <TableHead className="text-xs font-bold text-slate-700 text-right">
                          FCF Projetado (R$)
                        </TableHead>
                        <TableHead className="text-xs font-bold text-slate-700 text-right">
                          Fator de Desconto (1+WACC)ᵗ
                        </TableHead>
                        <TableHead className="text-xs font-bold text-slate-700 text-right">
                          Valor Presente (VP) (R$)
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow className="bg-blue-50/30 font-medium">
                        <TableCell className="text-xs text-slate-600">Ano 0 (Base)</TableCell>
                        <TableCell className="text-xs text-slate-900 font-semibold">
                          {selectedAno} (Exercício Atual)
                        </TableCell>
                        <TableCell className="text-xs text-right font-mono font-bold text-slate-900">
                          {formatCurrency(baseFluxoCaixa)}
                        </TableCell>
                        <TableCell className="text-xs text-right font-mono text-slate-500">
                          1,0000
                        </TableCell>
                        <TableCell className="text-xs text-right font-mono text-slate-500">
                          Base de Partida
                        </TableCell>
                      </TableRow>

                      {projecaoAnual.fluxos.map((f) => (
                        <TableRow key={f.anoIndex} className="hover:bg-slate-50/60">
                          <TableCell className="text-xs font-bold text-blue-900">
                            Ano {f.anoIndex}
                          </TableCell>
                          <TableCell className="text-xs text-slate-800">
                            {f.anoCalendario}
                          </TableCell>
                          <TableCell className="text-xs text-right font-mono text-slate-900 font-semibold">
                            {formatCurrency(f.fcf)}
                          </TableCell>
                          <TableCell className="text-xs text-right font-mono text-slate-600">
                            {formatNumber(f.fatorDesconto, 4)}
                          </TableCell>
                          <TableCell className="text-xs text-right font-mono font-bold text-emerald-700">
                            {formatCurrency(f.vp)}
                          </TableCell>
                        </TableRow>
                      ))}

                      <TableRow className="bg-slate-100/70 font-bold border-t-2 border-slate-200">
                        <TableCell colSpan={4} className="text-xs text-slate-800">
                          Soma do Valor Presente dos Fluxos Projetados ({anosProjecao} anos)
                        </TableCell>
                        <TableCell className="text-xs text-right font-mono text-emerald-800 text-sm">
                          {formatCurrency(projecaoAnual.somaVp)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>

                {/* Detalhes expandidos com fórmulas por extenso */}
                {expandDetailsFcd && (
                  <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-3 text-xs animate-fadeIn">
                    <div className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                      <Info className="w-3.5 h-3.5 text-blue-600" />
                      Fórmulas e Memorial de Cálculo do Modelo FCD
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-slate-700">
                      <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-1">
                        <span className="font-semibold text-blue-900 block">
                          1. Projeção do Fluxo de Caixa Livre (FCF):
                        </span>
                        <code className="block font-mono text-xs bg-slate-100 p-1.5 rounded text-slate-800">
                          FCFₜ = Base ({nomeBaseFluxo}: {formatCurrency(baseFluxoCaixa)}) × (1 +{' '}
                          {crescimentoAnualFcf}%)ᵗ
                        </code>
                        <p className="text-[11px] text-slate-500">
                          O fluxo é projetado a uma taxa de {crescimentoAnualFcf}% ao ano ao longo
                          de {anosProjecao} exercícios.
                        </p>
                      </div>

                      <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-1">
                        <span className="font-semibold text-blue-900 block">
                          2. Desconto pelo Custo Médio Ponderado (WACC):
                        </span>
                        <code className="block font-mono text-xs bg-slate-100 p-1.5 rounded text-slate-800">
                          VPₜ = FCFₜ ÷ (1 + {taxaWacc}%)ᵗ
                        </code>
                        <p className="text-[11px] text-slate-500">
                          Cada fluxo futuro é trazido a valor presente utilizando a taxa de desconto
                          WACC de {taxaWacc}%.
                        </p>
                      </div>

                      <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-1">
                        <span className="font-semibold text-blue-900 block">
                          3. Valor Terminal pela Perpetuidade de Gordon:
                        </span>
                        <code className="block font-mono text-xs bg-slate-100 p-1.5 rounded text-slate-800">
                          VT = [FCF_{anosProjecao} × (1 + {taxaPerpetuidade}%)] ÷ ({taxaWacc}% −{' '}
                          {taxaPerpetuidade}%)
                        </code>
                        <p className="text-[11px] text-slate-500">
                          Valor nominal do terminal: {formatCurrency(valorTerminalNominal)}. VP do
                          terminal = VT ÷ (1 + {taxaWacc}%)^{anosProjecao} ={' '}
                          {formatCurrency(vpValorTerminal)}.
                        </p>
                      </div>

                      <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-1">
                        <span className="font-semibold text-blue-900 block">
                          4. Valor da Empresa (Enterprise Value):
                        </span>
                        <code className="block font-mono text-xs bg-slate-100 p-1.5 rounded text-slate-800">
                          EV = Σ VP(Fluxos) + VP(Terminal) = {formatCurrency(projecaoAnual.somaVp)}{' '}
                          + {formatCurrency(vpValorTerminal)} = {formatCurrency(valorEmpresaFCD)}
                        </code>
                        <p className="text-[11px] text-slate-500">
                          Representa o valor total do negócio baseado na capacidade futura de
                          geração de caixa livre.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ================= SEÇÃO B: MODELO GOODWILL (SUPERLUCRO) ================= */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-[#0B1F3A] flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-emerald-600" />
                Modelo B — Goodwill (Método Indireto de Capitalização do Superlucro)
              </h2>
              <Badge
                className={
                  superlucro >= 0
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold text-xs'
                    : 'bg-amber-50 text-amber-700 border-amber-200 font-semibold text-xs'
                }
              >
                {superlucro >= 0
                  ? '🟢 Superlucro Positivo'
                  : '🟠 Superlucro Negativo (Sem Goodwill)'}
              </Badge>
            </div>

            {/* Grid com 5 Cards: PL, Lucro Normal, Superlucro, Goodwill e Valor Total */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
              {/* Card 1: Patrimônio Líquido */}
              <Card className="bg-white border-slate-200 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between">
                <CardHeader className="p-3.5 pb-2 border-b border-slate-100">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">
                    1. Valor Contábil
                  </span>
                  <CardTitle className="text-xs font-bold text-[#0B1F3A]">
                    Patrimônio Líquido (PL)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3.5 pt-2">
                  <div className="text-lg font-extrabold text-slate-900">
                    {formatCurrency(patrimonioLiquido)}
                  </div>
                  <span className="text-[10px] text-slate-500 block mt-0.5">
                    Capital e reservas contábeis
                  </span>
                </CardContent>
              </Card>

              {/* Card 2: Lucro Normal Esperado */}
              <Card className="bg-white border-slate-200 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between">
                <CardHeader className="p-3.5 pb-2 border-b border-slate-100">
                  <span className="text-[10px] font-bold text-blue-600 uppercase">
                    2. Custo do Capital Próprio
                  </span>
                  <CardTitle className="text-xs font-bold text-[#0B1F3A]">
                    Lucro Normal Esperado
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3.5 pt-2">
                  <div className="text-lg font-extrabold text-blue-700">
                    {formatCurrency(lucroNormal)}
                  </div>
                  <span className="text-[10px] text-slate-500 block mt-0.5">
                    PL × {taxaRetornoEsperadoPL}% retorno
                  </span>
                </CardContent>
              </Card>

              {/* Card 3: Superlucro */}
              <Card className="bg-white border-slate-200 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between">
                <CardHeader className="p-3.5 pb-2 border-b border-slate-100">
                  <span className="text-[10px] font-bold text-indigo-600 uppercase">
                    3. Lucro Excedente
                  </span>
                  <CardTitle className="text-xs font-bold text-[#0B1F3A]">
                    Superlucro do Exercício
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3.5 pt-2">
                  <div
                    className={`text-lg font-extrabold ${
                      superlucro >= 0 ? 'text-emerald-700' : 'text-amber-600'
                    }`}
                  >
                    {formatCurrency(superlucro)}
                  </div>
                  <span className="text-[10px] text-slate-500 block mt-0.5">
                    LL ({formatCurrency(lucroLiquido)}) − Lucro Normal
                  </span>
                </CardContent>
              </Card>

              {/* Card 4: Goodwill Apurado */}
              <Card className="bg-white border-slate-200 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between">
                <CardHeader className="p-3.5 pb-2 border-b border-slate-100">
                  <span className="text-[10px] font-bold text-emerald-600 uppercase">
                    4. Ativo Intangível
                  </span>
                  <CardTitle className="text-xs font-bold text-[#0B1F3A]">
                    Goodwill Capitalizado
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3.5 pt-2">
                  <div
                    className={`text-lg font-extrabold ${
                      goodwill >= 0 ? 'text-emerald-700' : 'text-amber-600'
                    }`}
                  >
                    {formatCurrency(goodwill)}
                  </div>
                  <span className="text-[10px] text-slate-500 block mt-0.5">
                    Superlucro ÷ {taxaCapitalizacaoGoodwill}% taxa
                  </span>
                </CardContent>
              </Card>

              {/* Card 5: Valor Total da Empresa pelo Goodwill */}
              <Card className="bg-gradient-to-br from-emerald-900 via-slate-900 to-[#0B1F3A] text-white border-emerald-800 shadow-md flex flex-col justify-between">
                <CardHeader className="p-3.5 pb-2 border-b border-white/10">
                  <span className="text-[10px] font-extrabold text-emerald-300 uppercase">
                    5. Avaliação Global
                  </span>
                  <CardTitle className="text-xs font-bold text-white">
                    Valor Empresa (Goodwill)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3.5 pt-2">
                  <div className="text-lg font-black text-emerald-300">
                    {formatCurrency(valorEmpresaGoodwill)}
                  </div>
                  <span className="text-[10px] text-slate-300 block mt-0.5">PL + Goodwill</span>
                </CardContent>
              </Card>
            </div>

            {/* Interpretação do Goodwill e Botão Detalhes */}
            <Card className="bg-white border-slate-200 shadow-2xs">
              <CardContent className="p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Info className="w-4 h-4 text-emerald-600" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                      Diagnóstico do Modelo Goodwill
                    </h3>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setExpandDetailsGoodwill((prev) => !prev)}
                    className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 h-7 px-2"
                  >
                    <Layers className="w-3.5 h-3.5 mr-1" />
                    {expandDetailsGoodwill
                      ? 'Ocultar Breakdown Contábil'
                      : 'Ver Breakdown do Superlucro'}
                    {expandDetailsGoodwill ? (
                      <ChevronUp className="w-3.5 h-3.5 ml-1" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 ml-1" />
                    )}
                  </Button>
                </div>

                <p className="text-xs leading-relaxed text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-200">
                  {superlucro >= 0 ? (
                    <>
                      A empresa gerou um <strong>Superlucro de {formatCurrency(superlucro)}</strong>{' '}
                      acima da taxa de retorno esperada de {taxaRetornoEsperadoPL}% sobre o
                      Patrimônio Líquido. A capitalização dessa vantagem competitiva a uma taxa de{' '}
                      {taxaCapitalizacaoGoodwill}% a.a. resulta em um{' '}
                      <strong>Goodwill positivo de {formatCurrency(goodwill)}</strong>, elevando o
                      valor econômico da empresa para além do seu patrimônio contábil estrito (PL de{' '}
                      {formatCurrency(patrimonioLiquido)}).
                    </>
                  ) : (
                    <>
                      O lucro líquido apurado ({formatCurrency(lucroLiquido)}) foi inferior ao Lucro
                      Normal esperado de {formatCurrency(lucroNormal)} ({taxaRetornoEsperadoPL}%
                      sobre o PL de {formatCurrency(patrimonioLiquido)}), gerando um{' '}
                      <strong>superlucro negativo de {formatCurrency(superlucro)}</strong>. Nesse
                      cenário, não há goodwill positivo constituído no exercício, indicando
                      sub-remuneração do capital próprio contábil investido na empresa.
                    </>
                  )}
                </p>

                {/* Detalhes expandidos */}
                {expandDetailsGoodwill && (
                  <div className="pt-2 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs animate-fadeIn">
                    <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                      <span className="text-[10px] text-slate-500 block uppercase font-semibold">
                        Patrimônio Líquido (PL)
                      </span>
                      <strong className="text-slate-900 text-sm block mt-0.5">
                        {formatCurrency(patrimonioLiquido)}
                      </strong>
                      <span className="text-[10px] text-slate-400">
                        Capital Social + Reservas + Lucros
                      </span>
                    </div>

                    <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                      <span className="text-[10px] text-slate-500 block uppercase font-semibold">
                        Lucro Líquido do DRE
                      </span>
                      <strong className="text-slate-900 text-sm block mt-0.5">
                        {formatCurrency(lucroLiquido)}
                      </strong>
                      <span className="text-[10px] text-slate-400">
                        Resultado final pós-impostos
                      </span>
                    </div>

                    <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                      <span className="text-[10px] text-slate-500 block uppercase font-semibold">
                        Fórmula de Goodwill
                      </span>
                      <code className="text-xs font-mono font-bold text-emerald-800 block mt-0.5">
                        (LL − PL×{taxaRetornoEsperadoPL}%) ÷ {taxaCapitalizacaoGoodwill}%
                      </code>
                      <span className="text-[10px] text-slate-400">
                        Método clássico indireto de superlucro
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ================= SEÇÃO 3: COMPARATIVO ENTRE OS DOIS MODELOS ================= */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-[#0B1F3A] flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-indigo-600" />
                Seção 3 — Comparativo: Valor pela FCD vs Valor pelo Goodwill
              </h2>
              <span className="text-xs text-slate-500">
                Diferença:{' '}
                <strong className="text-slate-900">
                  {diferencaValor >= 0
                    ? `+${formatCurrency(diferencaValor)}`
                    : formatCurrency(diferencaValor)}{' '}
                  ({formatPercent(diferencaPercentual, 1)})
                </strong>
              </span>
            </div>

            <Card className="bg-white border-slate-200 shadow-2xs">
              <CardHeader className="pb-2 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-sm font-bold text-[#0B1F3A]">
                    Comparação de Avaliação entre Métodos ({selectedAno})
                  </CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    Valor da empresa em reais (R$) calculado pelos dois métodos de precificação
                  </CardDescription>
                </div>

                <div className="flex items-center gap-3 text-[11px] font-semibold">
                  <span className="flex items-center gap-1 text-blue-700">
                    <span className="w-2.5 h-2.5 rounded-sm bg-blue-600" />
                    FCD (Fluxo Descontado)
                  </span>
                  <span className="flex items-center gap-1 text-emerald-700">
                    <span className="w-2.5 h-2.5 rounded-sm bg-emerald-600" />
                    Goodwill (Superlucro)
                  </span>
                </div>
              </CardHeader>

              <CardContent className="pt-6">
                <div className="h-60 w-full">
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
                        width={130}
                      />
                      <RechartsTooltip
                        formatter={(val: any, name: any, item: any) => [
                          formatCurrency(Number(val)),
                          item.payload.nome,
                        ]}
                        labelFormatter={(label: any) => `Modelo: ${label}`}
                      />
                      <ReferenceLine x={0} stroke="#94A3B8" />
                      <Bar dataKey="valor" radius={[0, 6, 6, 0]} barSize={28}>
                        {dadosGraficoComparativo.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.cor} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Explicação de aplicabilidade metodológica em português */}
                <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="p-3.5 bg-blue-50/50 rounded-xl border border-blue-100 space-y-1.5">
                    <span className="font-bold text-blue-900 block flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
                      Quando utilizar o Fluxo de Caixa Descontado (FCD)?
                    </span>
                    <p className="text-slate-700 leading-relaxed">
                      O <strong>FCD</strong> é o método padrão de mercado para empresas em marcha
                      normal (going concern) com histórico previsível de receitas e capacidade de
                      projeção de fluxos livres. Ele reflete a capacidade futura de geração de
                      riqueza da operação, independentemente dos registros contábeis históricos.
                    </p>
                  </div>

                  <div className="p-3.5 bg-emerald-50/50 rounded-xl border border-emerald-100 space-y-1.5">
                    <span className="font-bold text-emerald-900 block flex items-center gap-1.5">
                      <Briefcase className="w-3.5 h-3.5 text-emerald-600" />
                      Quando utilizar o Modelo Goodwill (Superlucro)?
                    </span>
                    <p className="text-slate-700 leading-relaxed">
                      O <strong>Modelo Goodwill</strong> é indicado quando se busca uma ponte direta
                      entre o valor contábil patrimonial (PL) e o valor econômico de mercado. Ele
                      quantifica o valor da marca, clientela e vantagens competitivas através do
                      lucro que excede a remuneração normal exigida pelos acionistas.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ================= SEÇÃO 4: ANÁLISE CONSOLIDADA E PARECER EXECUTIVO ================= */}
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
                        Parecer Integrado de Valuation · Exercício {selectedAno}
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
                {/* 1. Diagnóstico FCD */}
                <div className="bg-white/5 p-4 rounded-xl border border-white/10 space-y-1.5">
                  <span className="font-bold text-blue-300 uppercase tracking-wider text-[11px] block">
                    1. Diagnóstico do Fluxo de Caixa Descontado (FCD)
                  </span>
                  <p className="text-slate-200 leading-relaxed">
                    {parecerConsolidado.diagnosticoFCD}
                  </p>
                </div>

                {/* 2. Diagnóstico Goodwill */}
                <div className="bg-white/5 p-4 rounded-xl border border-white/10 space-y-1.5">
                  <span className="font-bold text-emerald-300 uppercase tracking-wider text-[11px] block">
                    2. Diagnóstico do Modelo Goodwill e Superlucro
                  </span>
                  <p className="text-slate-200 leading-relaxed">
                    {parecerConsolidado.diagnosticoGoodwill}
                  </p>
                </div>

                {/* 3. Comparativo Metodológico */}
                {parecerConsolidado.comparativoTexto && (
                  <div className="bg-white/5 p-4 rounded-xl border border-white/10 space-y-1.5">
                    <span className="font-bold text-indigo-300 uppercase tracking-wider text-[11px] block">
                      3. Análise Comparativa entre FCD e Goodwill
                    </span>
                    <p className="text-slate-200 leading-relaxed">
                      {parecerConsolidado.comparativoTexto}
                    </p>
                  </div>
                )}

                {/* 4. Recomendações do Consultor */}
                <div className="bg-white/5 p-4 rounded-xl border border-white/10 space-y-1.5">
                  <span className="font-bold text-amber-300 uppercase tracking-wider text-[11px] block">
                    4. Recomendações Estratégicas e Sensibilidade
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
