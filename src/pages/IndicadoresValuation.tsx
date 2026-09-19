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
  Legend,
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
  Printer,
  History,
  Grid,
} from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { ModalLaudoValuation } from '@/components/ModalLaudoValuation'
import { AbaMultiplosMercado } from '@/components/AbaMultiplosMercado'
import { PainelComparativoTresMetodos } from '@/components/PainelComparativoTresMetodos'
import { AbaHistoricoValuation } from '@/components/AbaHistoricoValuation'
import {
  calcularMultiplosMercado,
  gerarComparativoTresMetodos,
  obterMultiplosPadraoSetor,
  PESOS_PADRAO,
  ATIVOS_PADRAO,
  type MultiploKey,
} from '@/lib/valuationMultiplos'
import { valuationMultiplosService } from '@/services/valuationMultiplosService'
import { valuationHistoricoService } from '@/services/valuationHistoricoService'
import type {
  ValuationMultiplosRecord,
  ValuationHistoricoRecord,
  HistoricoValuationPontoAno,
} from '@/types/finance'

// Função auxiliar de cálculo de Valuation para um ano específico
function calcularValuationParaAno({
  balanco,
  dre,
  taxaWacc,
  taxaPerpetuidade,
  anosProjecao,
  crescimentoAnualFcf,
  taxaRetornoEsperadoPL,
  taxaCapitalizacaoGoodwill,
}: {
  balanco: BalancoRecord | null
  dre: DreRecord | null
  taxaWacc: number
  taxaPerpetuidade: number
  anosProjecao: number
  crescimentoAnualFcf: number
  taxaRetornoEsperadoPL: number
  taxaCapitalizacaoGoodwill: number
}) {
  const calcB = calcularBalanco(balanco)
  const calcD = calcularDre(dre)

  const baseFcf = calcD.ebitda !== 0 ? calcD.ebitda : calcD.resultadoOperacional || 0
  const waccDec = taxaWacc / 100
  const gDec = taxaPerpetuidade / 100
  const fcfGrowthDec = crescimentoAnualFcf / 100

  // FCD
  let somaVp = 0
  let fcfAcum = baseFcf
  const anosValidos = Math.max(3, Math.min(10, anosProjecao || 5))

  for (let t = 1; t <= anosValidos; t++) {
    fcfAcum = fcfAcum * (1 + fcfGrowthDec)
    const fatorDesconto = Math.pow(1 + waccDec, t)
    const vp = fatorDesconto > 0 ? fcfAcum / fatorDesconto : 0
    somaVp += vp
  }

  let valorTerminalNominal = 0
  let vpValorTerminal = 0
  let valorFCD = 0

  if (waccDec > gDec && waccDec > 0) {
    valorTerminalNominal = (fcfAcum * (1 + gDec)) / (waccDec - gDec)
    const fatorDescontoTerminal = Math.pow(1 + waccDec, anosValidos)
    vpValorTerminal = fatorDescontoTerminal > 0 ? valorTerminalNominal / fatorDescontoTerminal : 0
    valorFCD = somaVp + vpValorTerminal
  }

  // Goodwill
  const pl = calcB.patrimonioLiquido
  const ll = calcD.lucroLiquido
  const taxaRetornoPLDec = taxaRetornoEsperadoPL / 100
  const taxaCapGoodwillDec = taxaCapitalizacaoGoodwill / 100

  const lucroNormal = pl * taxaRetornoPLDec
  const superlucro = ll - lucroNormal
  const goodwill = taxaCapGoodwillDec > 0 ? superlucro / taxaCapGoodwillDec : 0
  const valorGoodwill = pl + goodwill

  return {
    hasData: !!(balanco || dre),
    hasBalanco: !!balanco,
    hasDre: !!dre,
    baseFcf,
    patrimonioLiquido: pl,
    lucroLiquido: ll,
    lucroNormal,
    superlucro,
    goodwill,
    valorFCD: Number(valorFCD.toFixed(2)),
    valorGoodwill: Number(valorGoodwill.toFixed(2)),
    somaVp,
    vpValorTerminal,
    valorTerminalNominal,
  }
}

// Função utilitária para colorir a escala de calor (Heatmap)
function getHeatmapColorClass(
  valor: number | null,
  minVal: number,
  maxVal: number,
  isExactMatch: boolean,
) {
  if (valor === null) {
    return 'bg-slate-50 text-slate-400 border-slate-200'
  }

  if (isExactMatch) {
    return 'bg-blue-600 text-white font-black ring-2 ring-blue-700 shadow-md scale-102 z-10'
  }

  if (maxVal === minVal) {
    return 'bg-emerald-100 text-emerald-950 font-semibold'
  }

  const ratio = Math.max(0, Math.min(1, (valor - minVal) / (maxVal - minVal)))

  if (ratio >= 0.85) return 'bg-emerald-600 text-white font-bold'
  if (ratio >= 0.7) return 'bg-emerald-500 text-white font-semibold'
  if (ratio >= 0.55) return 'bg-emerald-400 text-slate-900 font-semibold'
  if (ratio >= 0.4) return 'bg-emerald-200 text-emerald-950'
  if (ratio >= 0.25) return 'bg-emerald-100 text-emerald-900'
  if (ratio >= 0.15) return 'bg-amber-100 text-amber-950'
  return 'bg-red-100 text-red-950'
}

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
  const { minhaEmpresa, logoUrl } = useMinhaEmpresa()
  const { toast } = useToast()
  const navigate = useNavigate()

  const [balancos, setBalancos] = useState<BalancoRecord[]>([])
  const [dres, setDres] = useState<DreRecord[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [modalLaudoOpen, setModalLaudoOpen] = useState<boolean>(false)

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

  // ================= PARÂMETROS DA ABA MÚLTIPLOS DE MERCADO =================
  const [abaAtiva, setAbaAtiva] = useState<string>('multiplos')
  const [segmentoRefMultiplos, setSegmentoRefMultiplos] = useState<string>('Serviços')
  const [multiplosRefState, setMultiplosRefState] = useState<Record<MultiploKey, number>>({
    ev_ebitda: 6.5,
    pl: 10.0,
    pvp: 2.2,
    ev_receita: 1.4,
    ev_ebit: 8.5,
    p_ebitda: 5.5,
  })
  const [pesosMultiplosState, setPesosMultiplosState] = useState<Record<MultiploKey, number>>({
    ...PESOS_PADRAO,
  })
  const [ativosMultiplosState, setAtivosMultiplosState] = useState<Record<MultiploKey, boolean>>({
    ...ATIVOS_PADRAO,
  })
  const [dividaLiquidaManual, setDividaLiquidaManual] = useState<number | undefined>(undefined)
  const [salvandoMultiplos, setSalvandoMultiplos] = useState<boolean>(false)
  const [registroMultiplosDb, setRegistroMultiplosDb] = useState<ValuationMultiplosRecord | null>(
    null,
  )
  const [historicoDb, setHistoricoDb] = useState<ValuationHistoricoRecord[]>([])
  const [salvandoSnapshotHistorico, setSalvandoSnapshotHistorico] = useState<boolean>(false)

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
  const patrimonioLiquido = calcB.patrimonioLiquido
  const lucroLiquido = calcD.lucroLiquido

  const taxaRetornoPLDecimal = taxaRetornoEsperadoPL / 100
  const taxaCapGoodwillDecimal = taxaCapitalizacaoGoodwill / 100

  const lucroNormal = patrimonioLiquido * taxaRetornoPLDecimal
  const superlucro = lucroLiquido - lucroNormal
  const goodwill = taxaCapGoodwillDecimal > 0 ? superlucro / taxaCapGoodwillDecimal : 0
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
        cor: '#2563EB',
      },
      {
        nome: 'Modelo Goodwill (Superlucro)',
        sigla: 'Goodwill (PL + Excedente)',
        valor: Number(valorEmpresaGoodwill.toFixed(2)),
        descricao: 'Valor contábil acrescido da capitalização de lucros anormais',
        cor: '#059669',
      },
    ]
  }, [isWaccMenorOuIgualG, valorEmpresaFCD, valorEmpresaGoodwill])

  // ================= 4. MELHORIA 1: TABELA DE SENSIBILIDADE (HEATMAP) =================
  const sensibilidadeGrid = useMemo(() => {
    // Definir variações de WACC e g em torno dos valores configurados ou padrão fixo expandido
    // WACC linhas (ex: 8%, 10%, 12%, 15%, 18% ou variações dinâmicas)
    const baseWaccs = [8.0, 10.0, 12.0, 15.0, 18.0]
    if (!baseWaccs.some((w) => Math.abs(w - taxaWacc) < 0.01)) {
      baseWaccs.push(taxaWacc)
    }
    const waccValues = Array.from(new Set(baseWaccs)).sort((a, b) => a - b)

    const baseGs = [1.0, 2.0, 3.0, 4.0, 5.0]
    if (!baseGs.some((g) => Math.abs(g - taxaPerpetuidade) < 0.01)) {
      baseGs.push(taxaPerpetuidade)
    }
    const gValues = Array.from(new Set(baseGs)).sort((a, b) => a - b)

    const matrix: (number | null)[][] = []
    let minVal = Number.MAX_VALUE
    let maxVal = Number.MIN_VALUE

    const anosValidos = Math.max(3, Math.min(10, anosProjecao || 5))

    for (let r = 0; r < waccValues.length; r++) {
      const wVal = waccValues[r]
      const row: (number | null)[] = []

      for (let c = 0; c < gValues.length; c++) {
        const gVal = gValues[c]

        // Regra de proteção: WACC <= g não calcula
        if (wVal <= gVal || wVal <= 0) {
          row.push(null)
          continue
        }

        const wDec = wVal / 100
        const gDec = gVal / 100
        const fcfGrowthDec = crescimentoAnualFcf / 100

        let somaVpCell = 0
        let fcfAcumCell = baseFluxoCaixa

        for (let t = 1; t <= anosValidos; t++) {
          fcfAcumCell = fcfAcumCell * (1 + fcfGrowthDec)
          const fator = Math.pow(1 + wDec, t)
          somaVpCell += fator > 0 ? fcfAcumCell / fator : 0
        }

        const terminalNominal = (fcfAcumCell * (1 + gDec)) / (wDec - gDec)
        const fatorTerminal = Math.pow(1 + wDec, anosValidos)
        const vpTerminalCell = fatorTerminal > 0 ? terminalNominal / fatorTerminal : 0
        const totalEV = somaVpCell + vpTerminalCell

        row.push(totalEV)

        if (totalEV < minVal) minVal = totalEV
        if (totalEV > maxVal) maxVal = totalEV
      }

      matrix.push(row)
    }

    if (minVal === Number.MAX_VALUE) minVal = 0
    if (maxVal === Number.MIN_VALUE) maxVal = 0

    return {
      waccValues,
      gValues,
      matrix,
      minVal,
      maxVal,
    }
  }, [taxaWacc, taxaPerpetuidade, anosProjecao, crescimentoAnualFcf, baseFluxoCaixa])

  // ================= 5. MELHORIA 2: EVOLUÇÃO DO VALUATION ÚLTIMOS 3 ANOS =================
  const evolucaoUltimosAnos = useMemo(() => {
    // 3 anos: selectedAno, selectedAno - 1, selectedAno - 2
    const anos = [selectedAno - 2, selectedAno - 1, selectedAno]

    const dados = anos.map((ano) => {
      const b = balancos.find((x) => x.ano === ano) || null
      const d = dres.find((x) => x.ano === ano) || null

      const res = calcularValuationParaAno({
        balanco: b,
        dre: d,
        taxaWacc,
        taxaPerpetuidade,
        anosProjecao,
        crescimentoAnualFcf,
        taxaRetornoEsperadoPL,
        taxaCapitalizacaoGoodwill,
      })

      return {
        ano,
        temDados: res.hasData,
        fcd: res.hasData && !isWaccMenorOuIgualG ? res.valorFCD : 0,
        goodwill: res.hasData ? res.valorGoodwill : 0,
        patrimonioLiquido: res.patrimonioLiquido,
        lucroLiquido: res.lucroLiquido,
        baseFcf: res.baseFcf,
      }
    })

    const anosComDados = dados.filter((d) => d.temDados)
    const faltamAnos = anosComDados.length < 3

    return {
      dados,
      anosComDados,
      faltamAnos,
    }
  }, [
    selectedAno,
    balancos,
    dres,
    taxaWacc,
    taxaPerpetuidade,
    anosProjecao,
    crescimentoAnualFcf,
    taxaRetornoEsperadoPL,
    taxaCapitalizacaoGoodwill,
    isWaccMenorOuIgualG,
  ])

  // ================= 6. PARECER EXECUTIVO E CONSOLIDADO =================
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
    superlucro,
    taxaRetornoEsperadoPL,
    goodwill,
    lucroLiquido,
    lucroNormal,
    patrimonioLiquido,
    diferencaValor,
    diferencaPercentual,
  ])

  // Carregar histórico de valuations da empresa selecionada
  const carregarHistoricoDb = async () => {
    if (!selectedEmpresaId) {
      setHistoricoDb([])
      return
    }
    try {
      const records = await valuationHistoricoService.getByEmpresa(selectedEmpresaId)
      setHistoricoDb(records)
    } catch (err) {
      console.warn('Erro ao carregar histórico de valuation:', err)
    }
  }

  useEffect(() => {
    carregarHistoricoDb()
  }, [selectedEmpresaId])

  useRealtime<ValuationHistoricoRecord>('valuation_historico', () => {
    carregarHistoricoDb()
  })

  // Carregar configuração salva de múltiplos de mercado para a empresa e ano
  const carregarMultiplosDb = async () => {
    if (!selectedEmpresaId || !selectedAno) return
    try {
      const reg = await valuationMultiplosService.getByEmpresaEAno(selectedEmpresaId, selectedAno)
      setRegistroMultiplosDb(reg)
      const segmentoEmpresa = selectedEmpresa?.segmento || 'Serviços'
      const setorBase = reg?.segmento_referencia || segmentoEmpresa
      setSegmentoRefMultiplos(setorBase)

      const padrao = obterMultiplosPadraoSetor(setorBase)

      setMultiplosRefState({
        ev_ebitda: reg?.ev_ebitda_ref ?? padrao.ev_ebitda,
        pl: reg?.pl_ref ?? padrao.pl,
        pvp: reg?.pvp_ref ?? padrao.pvp,
        ev_receita: reg?.ev_receita_ref ?? padrao.ev_receita,
        ev_ebit: reg?.ev_ebit_ref ?? padrao.ev_ebit,
        p_ebitda: reg?.p_ebitda_ref ?? padrao.p_ebitda,
      })

      setPesosMultiplosState({
        ev_ebitda: reg?.ev_ebitda_peso ?? PESOS_PADRAO.ev_ebitda,
        pl: reg?.pl_peso ?? PESOS_PADRAO.pl,
        pvp: reg?.pvp_peso ?? PESOS_PADRAO.pvp,
        ev_receita: reg?.ev_receita_peso ?? PESOS_PADRAO.ev_receita,
        ev_ebit: reg?.ev_ebit_peso ?? PESOS_PADRAO.ev_ebit,
        p_ebitda: reg?.p_ebitda_peso ?? PESOS_PADRAO.p_ebitda,
      })

      if (reg?.multiplos_ativos && typeof reg.multiplos_ativos === 'object') {
        setAtivosMultiplosState({
          ev_ebitda: reg.multiplos_ativos.ev_ebitda ?? true,
          pl: reg.multiplos_ativos.pl ?? true,
          pvp: reg.multiplos_ativos.pvp ?? true,
          ev_receita: reg.multiplos_ativos.ev_receita ?? true,
          ev_ebit: reg.multiplos_ativos.ev_ebit ?? true,
          p_ebitda: reg.multiplos_ativos.p_ebitda ?? true,
        })
      } else {
        setAtivosMultiplosState({ ...ATIVOS_PADRAO })
      }

      setDividaLiquidaManual(reg?.divida_liquida_manual ?? undefined)
    } catch (err) {
      console.warn('Erro ao carregar múltiplos do banco:', err)
    }
  }

  useEffect(() => {
    carregarMultiplosDb()
  }, [selectedEmpresaId, selectedAno, selectedEmpresa?.segmento])

  useRealtime<ValuationMultiplosRecord>('valuation_multiplos', () => {
    carregarMultiplosDb()
  })

  // Handlers para Múltiplos
  const handleSegmentoMultiploChange = (novoSetor: string) => {
    setSegmentoRefMultiplos(novoSetor)
    const padrao = obterMultiplosPadraoSetor(novoSetor)
    setMultiplosRefState({
      ev_ebitda: padrao.ev_ebitda,
      pl: padrao.pl,
      pvp: padrao.pvp,
      ev_receita: padrao.ev_receita,
      ev_ebit: padrao.ev_ebit,
      p_ebitda: padrao.p_ebitda,
    })
  }

  const handleRestaurarPadroesSetor = () => {
    const padrao = obterMultiplosPadraoSetor(segmentoRefMultiplos)
    setMultiplosRefState({
      ev_ebitda: padrao.ev_ebitda,
      pl: padrao.pl,
      pvp: padrao.pvp,
      ev_receita: padrao.ev_receita,
      ev_ebit: padrao.ev_ebit,
      p_ebitda: padrao.p_ebitda,
    })
    setPesosMultiplosState({ ...PESOS_PADRAO })
    setAtivosMultiplosState({ ...ATIVOS_PADRAO })
    toast({
      title: 'Padrões setoriais restaurados',
      description: `Múltiplos e pesos restaurados para os benchmarks de ${segmentoRefMultiplos}.`,
    })
  }

  const handleMultiploRefChange = (key: MultiploKey, val: number) => {
    setMultiplosRefState((prev) => ({ ...prev, [key]: val }))
  }

  const handlePesoChange = (key: MultiploKey, val: number) => {
    setPesosMultiplosState((prev) => ({ ...prev, [key]: val }))
  }

  const handleToggleAtivo = (key: MultiploKey, ativo: boolean) => {
    setAtivosMultiplosState((prev) => ({ ...prev, [key]: ativo }))
  }

  const handleSalvarConfigMultiplos = async () => {
    if (!selectedEmpresaId) {
      toast({
        title: 'Selecione uma empresa',
        description: 'Selecione uma empresa antes de salvar os múltiplos.',
        variant: 'destructive',
      })
      return
    }

    try {
      setSalvandoMultiplos(true)
      const salvo = await valuationMultiplosService.save({
        empresa: selectedEmpresaId,
        ano: selectedAno,
        segmento_referencia: segmentoRefMultiplos,
        ev_ebitda_ref: multiplosRefState.ev_ebitda,
        pl_ref: multiplosRefState.pl,
        pvp_ref: multiplosRefState.pvp,
        ev_receita_ref: multiplosRefState.ev_receita,
        ev_ebit_ref: multiplosRefState.ev_ebit,
        p_ebitda_ref: multiplosRefState.p_ebitda,
        ev_ebitda_peso: pesosMultiplosState.ev_ebitda,
        pl_peso: pesosMultiplosState.pl,
        pvp_peso: pesosMultiplosState.pvp,
        ev_receita_peso: pesosMultiplosState.ev_receita,
        ev_ebit_peso: pesosMultiplosState.ev_ebit,
        p_ebitda_peso: pesosMultiplosState.p_ebitda,
        multiplos_ativos: ativosMultiplosState,
        divida_liquida_manual: dividaLiquidaManual,
      })
      setRegistroMultiplosDb(salvo)
      toast({
        title: 'Configurações de Múltiplos salvas!',
        description: `Múltiplos e ponderações de ${selectedAno} salvos com sucesso no banco.`,
      })
    } catch (err) {
      console.error('Erro ao salvar múltiplos:', err)
      toast({
        title: 'Erro ao salvar múltiplos',
        description: 'Não foi possível persistir as configurações. Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSalvandoMultiplos(false)
    }
  }

  // ================= CÁLCULO DOS MÚLTIPLOS DE MERCADO =================
  const resumoMultiplos = useMemo(() => {
    return calcularMultiplosMercado({
      balanco: balancoAtual,
      dre: dreAtual,
      segmento: segmentoRefMultiplos,
      multiplosRef: multiplosRefState,
      pesos: pesosMultiplosState,
      multiplosAtivos: ativosMultiplosState,
      dividaLiquidaManual,
    })
  }, [
    balancoAtual,
    dreAtual,
    segmentoRefMultiplos,
    multiplosRefState,
    pesosMultiplosState,
    ativosMultiplosState,
    dividaLiquidaManual,
  ])

  // ================= COMPARATIVO DOS 3 MÉTODOS =================
  const comparativoTresMetodos = useMemo(() => {
    return gerarComparativoTresMetodos({
      valorFCD: isWaccMenorOuIgualG ? 0 : valorEmpresaFCD,
      valorSuperlucro: valorEmpresaGoodwill,
      valorMultiplos: resumoMultiplos.valorPonderado,
      ebitda: calcD.ebitda,
      lucroLiquido: calcD.lucroLiquido,
      patrimonioLiquido: calcB.patrimonioLiquido,
      segmento: selectedEmpresa?.segmento,
    })
  }, [
    isWaccMenorOuIgualG,
    valorEmpresaFCD,
    valorEmpresaGoodwill,
    resumoMultiplos.valorPonderado,
    calcD.ebitda,
    calcD.lucroLiquido,
    calcB.patrimonioLiquido,
    selectedEmpresa?.segmento,
  ])

  // ================= HISTÓRICO DE VALUATIONS CONSOLIDADO =================
  const historicoValuationSerie = useMemo<HistoricoValuationPontoAno[]>(() => {
    return valuationHistoricoService.consolidarSerieHistorica(historicoDb, anosEmpresa, (ano) => {
      // Se for o ano atualmente selecionado com todos os parâmetros customizados
      if (ano === selectedAno) {
        return {
          valorFcd: isWaccMenorOuIgualG ? null : valorEmpresaFCD,
          valorSuperlucro: valorEmpresaGoodwill,
          valorMultiplos:
            resumoMultiplos.valorPonderado > 0 ? resumoMultiplos.valorPonderado : null,
          detalhesFcd: { taxaWacc, taxaPerpetuidade, anosProjecao },
          detalhesSuperlucro: { taxaRetornoEsperadoPL, taxaCapitalizacaoGoodwill },
          detalhesMultiplos: { segmento: segmentoRefMultiplos },
        }
      }

      // Anos adicionais: calcula a partir das demonstrações daquele ano
      const balAno = balancos.find((b) => b.ano === ano) || null
      const dreAno = dres.find((d) => d.ano === ano) || null
      const v = calcularValuationParaAno({
        balanco: balAno,
        dre: dreAno,
        taxaWacc,
        taxaPerpetuidade,
        anosProjecao,
        crescimentoAnualFcf,
        taxaRetornoEsperadoPL,
        taxaCapitalizacaoGoodwill,
      })

      return {
        valorFcd: v.valorFCD > 0 ? v.valorFCD : null,
        valorSuperlucro: v.valorGoodwill > 0 ? v.valorGoodwill : null,
        valorMultiplos: null,
        detalhesFcd: { fcd: v.valorFCD },
        detalhesSuperlucro: { goodwill: v.valorGoodwill },
      }
    })
  }, [
    historicoDb,
    anosEmpresa,
    selectedAno,
    isWaccMenorOuIgualG,
    valorEmpresaFCD,
    valorEmpresaGoodwill,
    resumoMultiplos.valorPonderado,
    taxaWacc,
    taxaPerpetuidade,
    anosProjecao,
    taxaRetornoEsperadoPL,
    taxaCapitalizacaoGoodwill,
    segmentoRefMultiplos,
    balancos,
    dres,
  ])

  const cagrHistorico = useMemo(() => {
    return valuationHistoricoService.calcularCagr(historicoValuationSerie)
  }, [historicoValuationSerie])

  // Gravar Snapshot do Ano Atual
  const handleSalvarSnapshotAnoAtual = async () => {
    if (!selectedEmpresaId) {
      toast({
        title: 'Selecione uma empresa',
        description: 'Selecione uma empresa antes de salvar o snapshot histórico.',
        variant: 'destructive',
      })
      return
    }

    try {
      setSalvandoSnapshotHistorico(true)
      const fcdVal = isWaccMenorOuIgualG ? 0 : valorEmpresaFCD
      const superlucroVal = valorEmpresaGoodwill
      const multiplosVal = resumoMultiplos.valorPonderado
      const consensoVal = comparativoTresMetodos.valorCentralTriplo

      await valuationHistoricoService.salvarSnapshotsAno(selectedEmpresaId, selectedAno, {
        fcd:
          fcdVal > 0
            ? {
                valor: fcdVal,
                detalhes: {
                  taxaWacc,
                  taxaPerpetuidade,
                  anosProjecao,
                  crescimentoAnualFcf,
                  somaVp: projecaoAnual.somaVp,
                  vpValorTerminal,
                },
              }
            : null,
        superlucro:
          superlucroVal > 0
            ? {
                valor: superlucroVal,
                detalhes: {
                  patrimonioLiquido,
                  lucroLiquido,
                  lucroNormal,
                  superlucro,
                  goodwill,
                  taxaRetornoEsperadoPL,
                  taxaCapitalizacaoGoodwill,
                },
              }
            : null,
        multiplos:
          multiplosVal > 0
            ? {
                valor: multiplosVal,
                detalhes: {
                  segmentoRef: segmentoRefMultiplos,
                  multiplosRef: multiplosRefState,
                  pesos: pesosMultiplosState,
                },
              }
            : null,
        consenso:
          consensoVal > 0
            ? {
                valor: consensoVal,
                detalhes: {
                  faixaMin: comparativoTresMetodos.faixaGeralMin,
                  faixaMax: comparativoTresMetodos.faixaGeralMax,
                },
              }
            : null,
      })

      await carregarHistoricoDb()

      toast({
        title: 'Snapshot de Valuation Salvo!',
        description: `Os valores calculados para o exercício de ${selectedAno} foram consolidados no histórico com sucesso.`,
      })
    } catch (err) {
      console.error('Erro ao salvar snapshot de valuation:', err)
      toast({
        title: 'Erro ao salvar snapshot',
        description: 'Não foi possível gravar o snapshot histórico no banco.',
        variant: 'destructive',
      })
    } finally {
      setSalvandoSnapshotHistorico(false)
    }
  }

  // ================= 7. EXPORTAÇÃO CSV COMPLETA =================
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

    csvContent += `ANÁLISE DE SENSIBILIDADE DO FCD (WACC vs g) (R$)\n`
    csvContent += `WACC \\ g;` + sensibilidadeGrid.gValues.map((g) => `${g}%`).join(';') + `\n`
    sensibilidadeGrid.waccValues.forEach((w, rIdx) => {
      const rowVals = sensibilidadeGrid.matrix[rIdx].map((v) =>
        v !== null ? v.toFixed(2).replace('.', ',') : '—',
      )
      csvContent += `${w}%;` + rowVals.join(';') + `\n`
    })
    csvContent += `\n`

    csvContent += `AVALIAÇÃO POR MÚLTIPLOS DE MERCADO\n`
    csvContent += `Setor de Referência;${segmentoRefMultiplos}\n`
    csvContent += `Múltiplo;Conceito;Métrica-Base (R$);Múltiplo Ref (x);Peso (%);Valor Implícito (R$);Ativo\n`
    resumoMultiplos.itens.forEach((m) => {
      csvContent += `${m.sigla};${m.nome};${m.valorMetricaBase.toFixed(2).replace('.', ',')};${m.multiploReferencia.toFixed(1).replace('.', ',')};${m.pesoPercentual}%;${m.valorImplícitoEmpresa.toFixed(2).replace('.', ',')};${m.ativo ? 'SIM' : 'NÃO'}\n`
    })
    csvContent += `Valuation Ponderado por Múltiplos;;;;;${resumoMultiplos.valorPonderado.toFixed(2).replace('.', ',')}\n`
    csvContent += `Média Simples;;;;;${resumoMultiplos.valorMedio.toFixed(2).replace('.', ',')}\n`
    csvContent += `Mediana;;;;;${resumoMultiplos.valorMediana.toFixed(2).replace('.', ',')}\n`
    csvContent += `Piso (Mínimo);;;;;${resumoMultiplos.valorMinimo.toFixed(2).replace('.', ',')}\n`
    csvContent += `Teto (Máximo);;;;;${resumoMultiplos.valorMaximo.toFixed(2).replace('.', ',')}\n\n`

    csvContent += `COMPARATIVO DOS 3 MÉTODOS DE VALUATION\n`
    csvContent += `Método 1 - Fluxo de Caixa Descontado (FCD);${isWaccMenorOuIgualG ? 'N/D' : valorEmpresaFCD.toFixed(2).replace('.', ',')}\n`
    csvContent += `Método 2 - Superlucro Capitalizado (Goodwill);${valorEmpresaGoodwill.toFixed(2).replace('.', ',')}\n`
    csvContent += `Método 3 - Múltiplos de Mercado (Consolidado);${resumoMultiplos.valorPonderado.toFixed(2).replace('.', ',')}\n`
    csvContent += `Consenso Central Triplo;${comparativoTresMetodos.valorCentralTriplo.toFixed(2).replace('.', ',')}\n`
    csvContent += `Piso Faixa Negocial;${comparativoTresMetodos.faixaGeralMin.toFixed(2).replace('.', ',')}\n`
    csvContent += `Teto Faixa Negocial;${comparativoTresMetodos.faixaGeralMax.toFixed(2).replace('.', ',')}\n\n`

    csvContent += `HISTÓRICO DE VALUATIONS POR EXERCÍCIO (EVOLUÇÃO PLURIANUAL)\n`
    csvContent += `Ano;FCD (Gordon) (R$);Superlucro (Goodwill) (R$);Múltiplos de Mercado (R$);Consenso Central (R$);Mínimo (R$);Máximo (R$);Variação vs Ano Anterior (%)\n`
    historicoValuationSerie.forEach((hp) => {
      const fcdStr =
        hp.valorFcd && hp.valorFcd > 0 ? hp.valorFcd.toFixed(2).replace('.', ',') : 'N/D'
      const slStr =
        hp.valorSuperlucro && hp.valorSuperlucro > 0
          ? hp.valorSuperlucro.toFixed(2).replace('.', ',')
          : 'N/D'
      const multStr =
        hp.valorMultiplos && hp.valorMultiplos > 0
          ? hp.valorMultiplos.toFixed(2).replace('.', ',')
          : 'N/D'
      const consStr = hp.consenso > 0 ? hp.consenso.toFixed(2).replace('.', ',') : 'N/D'
      const minStr = hp.minimo > 0 ? hp.minimo.toFixed(2).replace('.', ',') : 'N/D'
      const maxStr = hp.maximo > 0 ? hp.maximo.toFixed(2).replace('.', ',') : 'N/D'
      const varStr =
        hp.variacaoPercentualVsAnterior !== null && hp.variacaoPercentualVsAnterior !== undefined
          ? `${hp.variacaoPercentualVsAnterior.toFixed(2).replace('.', ',')}%`
          : 'Base'
      csvContent += `${hp.ano};${fcdStr};${slStr};${multStr};${consStr};${minStr};${maxStr};${varStr}\n`
    })
    if (cagrHistorico !== null) {
      csvContent += `CAGR do Período;;;;;;;${cagrHistorico.toFixed(2).replace('.', ',')}%\n`
    }
    csvContent += `\n`

    csvContent += `EVOLUÇÃO CONTÁBIL DOS ÚLTIMOS ANOS (BALANÇO/DRE)\n`
    csvContent += `Ano;FCD (R$);Goodwill (R$);Patrimônio Líquido (R$);Lucro Líquido (R$)\n`
    evolucaoUltimosAnos.dados.forEach((ev) => {
      csvContent += `${ev.ano};${ev.fcd.toFixed(2).replace('.', ',')};${ev.goodwill.toFixed(2).replace('.', ',')};${ev.patrimonioLiquido.toFixed(2).replace('.', ',')};${ev.lucroLiquido.toFixed(2).replace('.', ',')}\n`
    })
    csvContent += `\n`

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
      {/* 1. Header com Título, Seletores de Empresa/Ano, Botão Laudo PDF e Botão Exportar CSV */}
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
                Múltiplos · FCD · Goodwill
              </Badge>
            </div>
            <p className="text-xs text-[#5B6B7F] mt-0.5">
              Estimativa do valor da empresa (Enterprise Value) por Múltiplos de Mercado, Fluxo de
              Caixa Descontado e Capitalização de Superlucro (Goodwill)
            </p>
          </div>
        </div>

        {/* Seletores Globais de Empresa e Ano + Botão Laudo PDF + Exportação CSV */}
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

          {/* Botão Gerar Laudo de Valuation (PDF) */}
          <Button
            onClick={() => setModalLaudoOpen(true)}
            disabled={!balancoAtual && !dreAtual}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs h-9 shadow-xs"
          >
            <Printer className="w-3.5 h-3.5 mr-1.5" />
            Gerar Laudo de Valuation
          </Button>

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
                exercício de {selectedAno}. Cadastre os demonstrativos para apurar o valuation por
                Múltiplos de Mercado, Fluxo Descontado ou Goodwill.
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
        <Tabs value={abaAtiva} onValueChange={setAbaAtiva} className="w-full space-y-6">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <TabsList className="bg-slate-100 p-1 rounded-xl h-10">
              <TabsTrigger
                value="historico"
                className="text-xs font-bold gap-1.5 data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-xs"
              >
                <TrendingUp className="w-3.5 h-3.5" />
                Histórico / Evolução
                {historicoValuationSerie.length > 0 && (
                  <Badge className="ml-1 bg-emerald-100 text-emerald-800 border-none text-[10px] px-1.5 py-0 h-4">
                    {historicoValuationSerie.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="multiplos"
                className="text-xs font-bold gap-1.5 data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-xs"
              >
                <BarChart3 className="w-3.5 h-3.5" />
                Múltiplos de Mercado
              </TabsTrigger>
              <TabsTrigger
                value="comparativo"
                className="text-xs font-bold gap-1.5 data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:shadow-xs"
              >
                <Scale className="w-3.5 h-3.5" />
                Comparativo dos 3 Métodos
              </TabsTrigger>
              <TabsTrigger
                value="fcd_goodwill"
                className="text-xs font-bold gap-1.5 data-[state=active]:bg-white data-[state=active]:text-[#0B1F3A] data-[state=active]:shadow-xs"
              >
                <Layers className="w-3.5 h-3.5" />
                FCD &amp; Goodwill
              </TabsTrigger>
            </TabsList>

            <span className="text-xs text-slate-500 hidden sm:inline">
              Abordagem ativa:{' '}
              <strong className="text-slate-800">
                {abaAtiva === 'historico'
                  ? 'Histórico / Evolução Temporal'
                  : abaAtiva === 'multiplos'
                    ? 'Múltiplos de Mercado'
                    : abaAtiva === 'comparativo'
                      ? 'Comparativo Triplo'
                      : 'FCD & Goodwill'}
              </strong>
            </span>
          </div>

          {/* TAB HISTÓRICO: EVOLUÇÃO TEMPORAL POR ANO */}
          <TabsContent value="historico" className="mt-0">
            <AbaHistoricoValuation
              historicoSerie={historicoValuationSerie}
              cagr={cagrHistorico}
              empresaNome={selectedEmpresa?.nome}
              anoAtual={selectedAno}
              onSalvarSnapshotAnoAtual={handleSalvarSnapshotAnoAtual}
              salvandoSnapshot={salvandoSnapshotHistorico}
              onSelecionarAno={(ano) => setSelectedAno(ano)}
              loading={loading}
            />
          </TabsContent>

          {/* TAB 1: MÚLTIPLOS DE MERCADO */}
          <TabsContent value="multiplos" className="mt-0">
            <AbaMultiplosMercado
              resumoMultiplos={resumoMultiplos}
              segmentoSelecionado={segmentoRefMultiplos}
              onSegmentoChange={handleSegmentoMultiploChange}
              multiplosRef={multiplosRefState}
              onMultiploRefChange={handleMultiploRefChange}
              pesos={pesosMultiplosState}
              onPesoChange={handlePesoChange}
              multiplosAtivos={ativosMultiplosState}
              onToggleAtivo={handleToggleAtivo}
              dividaLiquidaManual={dividaLiquidaManual}
              onDividaLiquidaChange={setDividaLiquidaManual}
              onRestaurarPadroesSetor={handleRestaurarPadroesSetor}
              onSalvarConfiguracao={handleSalvarConfigMultiplos}
              salvando={salvandoMultiplos}
              empresaNome={selectedEmpresa?.nome}
              ano={selectedAno}
            />
          </TabsContent>

          {/* TAB 2: COMPARATIVO DOS 3 MÉTODOS */}
          <TabsContent value="comparativo" className="mt-0">
            <PainelComparativoTresMetodos
              comparativo={comparativoTresMetodos}
              empresaNome={selectedEmpresa?.nome}
              ano={selectedAno}
            />
          </TabsContent>

          {/* TAB 3: FCD & SUPERLUCRO (GOODWILL) */}
          <TabsContent value="fcd_goodwill" className="mt-0 space-y-6">
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
                      Soma dos fluxos de caixa livres projetados ano a ano descontados pela taxa
                      WACC de {taxaWacc}%.
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
                            Cada fluxo futuro é trazido a valor presente utilizando a taxa de
                            desconto WACC de {taxaWacc}%.
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
                            EV = Σ VP(Fluxos) + VP(Terminal) ={' '}
                            {formatCurrency(projecaoAnual.somaVp)} +{' '}
                            {formatCurrency(vpValorTerminal)} = {formatCurrency(valorEmpresaFCD)}
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

              {/* ================= MELHORIA 1: TABELA DE SENSIBILIDADE HEATMAP NO FCD ================= */}
              <Card className="bg-white border-blue-200/90 shadow-2xs overflow-hidden">
                <CardHeader className="p-4 pb-3 bg-gradient-to-r from-blue-50/50 via-slate-50 to-emerald-50/30 border-b border-blue-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                      <Grid className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-bold text-[#0B1F3A]">
                        Análise de Sensibilidade do Valuation FCD (Heatmap)
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Valor Total da Empresa para diferentes combinações de WACC e Crescimento na
                        Perpetuidade (g)
                      </CardDescription>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-[11px] flex-wrap">
                    <span className="flex items-center gap-1 font-semibold text-slate-600">
                      <span className="w-3 h-3 rounded bg-blue-600 ring-1 ring-blue-700" />
                      Cenário Atual ({taxaWacc}% / {taxaPerpetuidade}%)
                    </span>
                    <span className="flex items-center gap-1 text-slate-500">
                      <span className="w-3 h-3 rounded bg-emerald-600" /> Maior Valor
                    </span>
                    <span className="flex items-center gap-1 text-slate-500">
                      <span className="w-3 h-3 rounded bg-red-100 border border-red-300" /> Menor
                      Valor
                    </span>
                  </div>
                </CardHeader>

                <CardContent className="p-4 space-y-3">
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <Table className="text-xs">
                      <TableHeader className="bg-slate-100">
                        <TableRow>
                          <TableHead className="font-extrabold text-[#0B1F3A] bg-slate-200/80 w-32">
                            WACC \ g (%)
                          </TableHead>
                          {sensibilidadeGrid.gValues.map((g) => {
                            const isColSelected = Math.abs(g - taxaPerpetuidade) < 0.01
                            return (
                              <TableHead
                                key={g}
                                className={`text-right font-bold ${
                                  isColSelected
                                    ? 'bg-blue-100/90 text-blue-950 font-black border-x border-blue-200'
                                    : 'text-slate-700'
                                }`}
                              >
                                g = {g.toFixed(1)}%
                              </TableHead>
                            )
                          })}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sensibilidadeGrid.waccValues.map((wVal, rIdx) => {
                          const isRowSelected = Math.abs(wVal - taxaWacc) < 0.01

                          return (
                            <TableRow key={wVal} className="hover:bg-slate-50/50">
                              <TableCell
                                className={`font-bold ${
                                  isRowSelected
                                    ? 'bg-blue-100/90 text-blue-950 font-black border-y border-blue-200'
                                    : 'bg-slate-100/70 text-slate-800'
                                }`}
                              >
                                WACC = {wVal.toFixed(1)}%
                              </TableCell>

                              {sensibilidadeGrid.gValues.map((gVal, cIdx) => {
                                const cellVal = sensibilidadeGrid.matrix[rIdx]?.[cIdx]
                                const isExactMatch =
                                  Math.abs(wVal - taxaWacc) < 0.01 &&
                                  Math.abs(gVal - taxaPerpetuidade) < 0.01

                                const colorClass = getHeatmapColorClass(
                                  cellVal,
                                  sensibilidadeGrid.minVal,
                                  sensibilidadeGrid.maxVal,
                                  isExactMatch,
                                )

                                return (
                                  <TableCell
                                    key={gVal}
                                    className={`text-right font-mono transition-all py-2.5 px-3 border-b border-slate-100 ${colorClass} ${
                                      isExactMatch ? 'font-extrabold shadow-sm' : ''
                                    }`}
                                  >
                                    {cellVal === null ? (
                                      <span className="text-slate-400 font-sans text-xs select-none">
                                        —
                                      </span>
                                    ) : (
                                      <span>{formatCurrency(cellVal)}</span>
                                    )}
                                  </TableCell>
                                )
                              })}
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 flex-wrap gap-2">
                    <span>
                      💡 <strong>Interpretação da Sensibilidade:</strong> O valor da empresa aumenta
                      à medida que o custo de capital (WACC) diminui e a taxa de crescimento
                      perpétuo (g) aumenta. Células com &ldquo;—&rdquo; indicam restrição matemática
                      do modelo de Gordon (WACC ≤ g).
                    </span>
                    <span className="font-semibold text-blue-900 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-100">
                      Cenário Atual Selecionado: {formatCurrency(valorEmpresaFCD)}
                    </span>
                  </div>
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
                        A empresa gerou um{' '}
                        <strong>Superlucro de {formatCurrency(superlucro)}</strong> acima da taxa de
                        retorno esperada de {taxaRetornoEsperadoPL}% sobre o Patrimônio Líquido. A
                        capitalização dessa vantagem competitiva a uma taxa de{' '}
                        {taxaCapitalizacaoGoodwill}% a.a. resulta em um{' '}
                        <strong>Goodwill positivo de {formatCurrency(goodwill)}</strong>, elevando o
                        valor econômico da empresa para além do seu patrimônio contábil estrito (PL
                        de {formatCurrency(patrimonioLiquido)}).
                      </>
                    ) : (
                      <>
                        O lucro líquido apurado ({formatCurrency(lucroLiquido)}) foi inferior ao
                        Lucro Normal esperado de {formatCurrency(lucroNormal)} (
                        {taxaRetornoEsperadoPL}% sobre o PL de {formatCurrency(patrimonioLiquido)}),
                        gerando um{' '}
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
                  Seção 3 — Comparativo: Valor pelo FCD vs Valor pelo Goodwill
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
                        O <strong>Modelo Goodwill</strong> é indicado quando se busca uma ponte
                        direta entre o valor contábil patrimonial (PL) e o valor econômico de
                        mercado. Ele quantifica o valor da marca, clientela e vantagens competitivas
                        através do lucro que excede a remuneração normal exigida pelos acionistas.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* ================= MELHORIA 2: GRÁFICO DE EVOLUÇÃO DOS ÚLTIMOS 3 ANOS ================= */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-[#0B1F3A] flex items-center gap-2">
                  <History className="w-4 h-4 text-blue-600" />
                  Evolução do Valuation ao Longo dos Últimos 3 Anos
                </h2>
                <Badge className="bg-slate-100 text-slate-700 border-slate-200 font-semibold text-xs">
                  {selectedAno - 2} — {selectedAno}
                </Badge>
              </div>

              <Card className="bg-white border-slate-200 shadow-2xs">
                <CardHeader className="pb-2 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-sm font-bold text-[#0B1F3A]">
                      Trajetória Histórica do Enterprise Value ({selectedEmpresa?.nome || 'Empresa'}
                      )
                    </CardTitle>
                    <CardDescription className="text-xs mt-0.5">
                      Comparativo dos modelos FCD e Goodwill para o exercício selecionado (
                      {selectedAno}) e os dois anos anteriores
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

                <CardContent className="pt-6 space-y-4">
                  {evolucaoUltimosAnos.anosComDados.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200">
                      Não há demonstrações contábeis disponíveis para o período de {selectedAno - 2}{' '}
                      a {selectedAno}.
                    </div>
                  ) : (
                    <>
                      <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={evolucaoUltimosAnos.dados}
                            margin={{ top: 10, right: 20, left: 20, bottom: 10 }}
                          >
                            <CartesianGrid
                              strokeDasharray="3 3"
                              stroke="#F1F5F9"
                              vertical={false}
                            />
                            <XAxis
                              dataKey="ano"
                              tick={{ fontSize: 12, fill: '#0B1F3A', fontWeight: 700 }}
                            />
                            <YAxis
                              tick={{ fontSize: 11, fill: '#64748B' }}
                              tickFormatter={(v) =>
                                Math.abs(v) >= 1000000
                                  ? `R$ ${(v / 1000000).toFixed(1)}M`
                                  : Math.abs(v) >= 1000
                                    ? `R$ ${(v / 1000).toFixed(0)}k`
                                    : `R$ ${v}`
                              }
                            />
                            <RechartsTooltip
                              formatter={(val: any, name: any) => [
                                Number(val) > 0 ? formatCurrency(Number(val)) : 'Sem Dados / N/D',
                                name === 'fcd' ? 'FCD (Fluxo Descontado)' : 'Goodwill (Superlucro)',
                              ]}
                              labelFormatter={(label) => `Exercício: ${label}`}
                            />
                            <Legend
                              formatter={(value) =>
                                value === 'fcd'
                                  ? 'Fluxo de Caixa Descontado (FCD)'
                                  : 'Modelo Goodwill (Superlucro)'
                              }
                              wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                            />
                            <ReferenceLine y={0} stroke="#94A3B8" />
                            <Bar
                              dataKey="fcd"
                              name="fcd"
                              fill="#2563EB"
                              radius={[4, 4, 0, 0]}
                              barSize={32}
                            />
                            <Bar
                              dataKey="goodwill"
                              name="goodwill"
                              fill="#059669"
                              radius={[4, 4, 0, 0]}
                              barSize={32}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Nota informativa quando faltam dados em algum dos anos */}
                      {evolucaoUltimosAnos.faltamAnos && (
                        <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl flex items-start gap-2 text-xs text-amber-900">
                          <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <strong>Nota sobre a série histórica:</strong> Exibindo apenas os
                            exercícios com demonstrações contábeis (Balanço/DRE) cadastradas no
                            sistema. Para uma série trienal completa ({selectedAno - 2},{' '}
                            {selectedAno - 1} e {selectedAno}), realize o cadastro ou importação dos
                            dados contábeis pendentes.
                          </div>
                        </div>
                      )}

                      {/* Resumo em tabela dos 3 anos */}
                      <div className="overflow-x-auto rounded-xl border border-slate-200">
                        <Table className="text-xs">
                          <TableHeader className="bg-slate-50">
                            <TableRow>
                              <TableHead className="font-bold text-slate-700">Ano</TableHead>
                              <TableHead className="text-right font-bold text-slate-700">
                                FCD (Enterprise Value)
                              </TableHead>
                              <TableHead className="text-right font-bold text-slate-700">
                                Goodwill (PL + Superlucro)
                              </TableHead>
                              <TableHead className="text-right font-bold text-slate-700">
                                Patrimônio Líquido (PL)
                              </TableHead>
                              <TableHead className="text-right font-bold text-slate-700">
                                Lucro Líquido
                              </TableHead>
                              <TableHead className="text-center font-bold text-slate-700">
                                Status dos Dados
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {evolucaoUltimosAnos.dados.map((ev) => (
                              <TableRow
                                key={ev.ano}
                                className={
                                  ev.ano === selectedAno
                                    ? 'bg-blue-50/50 font-semibold'
                                    : 'hover:bg-slate-50/50'
                                }
                              >
                                <TableCell className="font-bold text-[#0B1F3A]">
                                  {ev.ano} {ev.ano === selectedAno && '(Atual)'}
                                </TableCell>
                                <TableCell className="text-right font-mono font-bold text-blue-700">
                                  {ev.temDados && !isWaccMenorOuIgualG
                                    ? formatCurrency(ev.fcd)
                                    : '—'}
                                </TableCell>
                                <TableCell className="text-right font-mono font-bold text-emerald-700">
                                  {ev.temDados ? formatCurrency(ev.goodwill) : '—'}
                                </TableCell>
                                <TableCell className="text-right font-mono text-slate-700">
                                  {ev.temDados ? formatCurrency(ev.patrimonioLiquido) : '—'}
                                </TableCell>
                                <TableCell className="text-right font-mono text-slate-700">
                                  {ev.temDados ? formatCurrency(ev.lucroLiquido) : '—'}
                                </TableCell>
                                <TableCell className="text-center">
                                  {ev.temDados ? (
                                    <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold text-[10px]">
                                      ✓ Disponível
                                    </Badge>
                                  ) : (
                                    <Badge className="bg-slate-100 text-slate-500 border-slate-200 font-normal text-[10px]">
                                      Sem Demonstração
                                    </Badge>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </>
                  )}
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
          </TabsContent>
        </Tabs>
      )}

      {/* Modal Laudo de Valuation (A4 PDF) */}
      <ModalLaudoValuation
        open={modalLaudoOpen}
        onOpenChange={setModalLaudoOpen}
        selectedEmpresa={selectedEmpresa || null}
        selectedAno={selectedAno}
        minhaEmpresa={minhaEmpresa}
        logoUrl={logoUrl}
        taxaWacc={taxaWacc}
        taxaPerpetuidade={taxaPerpetuidade}
        anosProjecao={anosProjecao}
        crescimentoAnualFcf={crescimentoAnualFcf}
        baseFluxoCaixa={baseFluxoCaixa}
        nomeBaseFluxo={nomeBaseFluxo}
        valorEmpresaFCD={valorEmpresaFCD}
        somaVpFluxos={projecaoAnual.somaVp}
        vpValorTerminal={vpValorTerminal}
        valorTerminalNominal={valorTerminalNominal}
        taxaRetornoEsperadoPL={taxaRetornoEsperadoPL}
        taxaCapitalizacaoGoodwill={taxaCapitalizacaoGoodwill}
        patrimonioLiquido={patrimonioLiquido}
        lucroLiquido={lucroLiquido}
        lucroNormal={lucroNormal}
        superlucro={superlucro}
        goodwill={goodwill}
        valorEmpresaGoodwill={valorEmpresaGoodwill}
        sensibilidadeGrid={{
          waccValues: sensibilidadeGrid.waccValues,
          gValues: sensibilidadeGrid.gValues,
          matrix: sensibilidadeGrid.matrix,
        }}
        parecerConsolidado={parecerConsolidado}
        resumoMultiplos={resumoMultiplos}
        comparativoTresMetodos={comparativoTresMetodos}
        segmentoRefMultiplos={segmentoRefMultiplos}
        historicoSerie={historicoValuationSerie}
        cagrHistorico={cagrHistorico}
      />
    </div>
  )
}
