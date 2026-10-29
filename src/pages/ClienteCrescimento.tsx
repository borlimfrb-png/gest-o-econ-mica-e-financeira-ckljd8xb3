import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useFilter } from '@/contexts/FilterContext'
import { useToast } from '@/hooks/use-toast'
import { useRealtime } from '@/hooks/use-realtime'
import { contasService, lancamentosService, planoContasService } from '@/services/financeService'
import type { ContaRecord, LancamentoRecord, PlanoContaRecord } from '@/types/finance'
import { gerarListaMeses, type MesItem } from '@/lib/dreGerencialTypes'
import {
  extrairCenarioBaseDre,
  calcularDeltaPercentual,
  type CenarioBaseDre,
} from '@/lib/indicadorCrescimentoCalculo'
import {
  extrairLancamentosDespesasVariaveis,
  agruparLancamentosPorCentroCusto,
  calcularTotaisVariaveis,
  type LancamentoVariavelItem,
} from '@/lib/lancamentosVariaveisHelper'
import { PainelDespesasVariaveisCentros } from '@/components/PainelDespesasVariaveisCentros'
import { DocumentPrintFooter } from '@/components/DocumentPrintFooter'
import { EstadoVazioClienteCard } from '@/components/EstadoVazioClienteCard'
import { BorlimLogo } from '@/components/BorlimLogo'
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
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ReferenceLine,
} from 'recharts'
import {
  TrendingUp,
  TrendingDown,
  Building2,
  Calendar,
  Printer,
  Sparkles,
  ArrowLeft,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  RefreshCw,
  Award,
  ShieldCheck,
  Scale,
} from 'lucide-react'

const MESES_OPCOES = [
  { valor: 1, nome: 'Janeiro' },
  { valor: 2, nome: 'Fevereiro' },
  { valor: 3, nome: 'Março' },
  { valor: 4, nome: 'Abril' },
  { valor: 5, nome: 'Maio' },
  { valor: 6, nome: 'Junho' },
  { valor: 7, nome: 'Julho' },
  { valor: 8, nome: 'Agosto' },
  { valor: 9, nome: 'Setembro' },
  { valor: 10, nome: 'Outubro' },
  { valor: 11, nome: 'Novembro' },
  { valor: 12, nome: 'Dezembro' },
]

function formatBrl(val: number | undefined | null): string {
  if (val === undefined || val === null || !Number.isFinite(val)) return 'R$ 0,00'
  return val.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function formatBrlCompacto(val: number): string {
  if (!Number.isFinite(val)) return 'R$ 0'
  const abs = Math.abs(val)
  const sinal = val < 0 ? '-' : ''
  if (abs >= 1_000_000) {
    return `${sinal}R$ ${(abs / 1_000_000).toFixed(1)}M`
  }
  if (abs >= 1_000) {
    return `${sinal}R$ ${(abs / 1_000).toFixed(0)}k`
  }
  return `${sinal}R$ ${abs.toFixed(0)}`
}

function formatPercent(val: number | null | undefined, casas = 2, incluirSinal = true): string {
  if (val === null || val === undefined || !Number.isFinite(val)) return '—'
  const prefixo = incluirSinal && val > 0 ? '+' : ''
  return `${prefixo}${val.toFixed(casas)}%`
}

interface ItemMesCrescimento {
  chave: string
  rotuloCurto: string
  rotuloCompleto: string
  ano: number
  mes: number
  faturamento: number
  faturamentoAnterior: number | null
  faturamentoAnoPassado: number | null
  variacaoMoM: number | null
  variacaoYoY: number | null
  deltaAbsolutoMoM: number | null
}

export default function ClienteCrescimento() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { user } = useAuth()
  const { selectedEmpresaId, selectedEmpresa, selectedAno, empresasIdsAtivas, anosDisponiveis } =
    useFilter()

  // Dados brutos
  const [loading, setLoading] = useState(true)
  const [lancamentos, setLancamentos] = useState<LancamentoRecord[]>([])
  const [contas, setContas] = useState<ContaRecord[]>([])
  const [planoContas, setPlanoContas] = useState<PlanoContaRecord[]>([])

  // Filtros de período sincronizados com o FilterContext
  const currentYear = selectedAno || new Date().getFullYear()
  const [anoInicial, setAnoInicial] = useState<number>(currentYear)

  useEffect(() => {
    if (selectedAno) {
      setAnoInicial(selectedAno)
    }
  }, [selectedAno])

  const [mesInicial, setMesInicial] = useState<number>(1)
  const [qtdMeses, setQtdMeses] = useState<number>(12)
  const [avisoLimiteMeses, setAvisoLimiteMeses] = useState(false)

  // Tipo de visualização gráfica
  const [tipoVisualizacaoGrafico, setTipoVisualizacaoGrafico] = useState<
    'barras_linha' | 'comparativo_ano_anterior'
  >('barras_linha')

  // Filtro de texto para despesas variáveis
  const [filtroTextoVar, setFiltroTextoVar] = useState('')

  // Identificação da empresa vinculada ao cliente selecionada no contexto
  const empresaIdAlvo =
    selectedEmpresaId && !selectedEmpresaId.startsWith('grupo-')
      ? selectedEmpresaId
      : selectedEmpresa?.id || (empresasIdsAtivas.length > 0 ? empresasIdsAtivas[0] : null)

  const empresaNome = selectedEmpresa?.nome || selectedEmpresa?.nome_fantasia || 'Minha Empresa'

  // Carregar dados restritos à empresa do cliente
  const carregarDados = async () => {
    try {
      setLoading(true)

      let lancsPromise: Promise<LancamentoRecord[]>
      let contasPromise: Promise<ContaRecord[]>
      let planosPromise: Promise<PlanoContaRecord[]>

      if (empresaIdAlvo) {
        lancsPromise = lancamentosService.getAll({
          empresaId: empresaIdAlvo,
          expandRelations: true,
        })
        contasPromise = contasService.getAll({ empresaId: empresaIdAlvo })
        planosPromise = planoContasService.getAll({ empresaId: empresaIdAlvo })
      } else if (empresasIdsAtivas.length > 0) {
        const empOpts = { empresasIds: empresasIdsAtivas }
        lancsPromise = lancamentosService.getAll({ expandRelations: true })
        contasPromise = contasService.getAll(empOpts)
        planosPromise = planoContasService.getAll(empOpts)
      } else {
        lancsPromise = Promise.resolve([])
        contasPromise = Promise.resolve([])
        planosPromise = Promise.resolve([])
      }

      const [contasList, lancamentosList, planosList] = await Promise.all([
        contasPromise,
        lancsPromise,
        planosPromise,
      ])

      setContas(Array.from(new Map(contasList.map((i) => [i.id, i])).values()))
      setLancamentos(lancamentosList)
      setPlanoContas(Array.from(new Map(planosList.map((i) => [i.id, i])).values()))
    } catch (err: any) {
      console.error('Erro ao carregar dados de crescimento do cliente:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar dados',
        description: 'Não foi possível carregar os lançamentos da sua empresa.',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarDados()
  }, [empresaIdAlvo])

  // Realtime
  useRealtime<LancamentoRecord>('lancamentos', () => carregarDados())
  useRealtime<ContaRecord>('contas', () => carregarDados())
  useRealtime<PlanoContaRecord>('plano_contas', () => carregarDados())

  const handleQtdMesesChange = (novaQtd: number) => {
    if (novaQtd > 12) {
      setQtdMeses(12)
      setAvisoLimiteMeses(true)
      toast({
        variant: 'destructive',
        title: 'Limite de 12 meses',
        description: 'O período da análise é de no máximo 12 meses.',
      })
    } else if (novaQtd < 1) {
      setQtdMeses(1)
      setAvisoLimiteMeses(false)
    } else {
      setQtdMeses(novaQtd)
      setAvisoLimiteMeses(false)
    }
  }

  // Lista de meses do período corrente
  const meses = useMemo<MesItem[]>(() => {
    return gerarListaMeses(anoInicial, mesInicial, qtdMeses)
  }, [anoInicial, mesInicial, qtdMeses])

  // Lista de meses equivalentes no ano anterior (para comparativo YoY)
  const mesesAnoAnterior = useMemo<MesItem[]>(() => {
    return gerarListaMeses(anoInicial - 1, mesInicial, qtdMeses)
  }, [anoInicial, mesInicial, qtdMeses])

  const periodoDescricao = useMemo(() => {
    if (meses.length === 0) return ''
    return `${meses[0].rotuloCurto} a ${meses[meses.length - 1].rotuloCurto}`
  }, [meses])

  // Extração via motor oficial da DRE Gerencial / Indicador de Crescimento
  // 1) Cenário base do período corrente
  const cenarioBasePeriodo: CenarioBaseDre = useMemo(() => {
    return extrairCenarioBaseDre(lancamentos, contas, meses, planoContas)
  }, [lancamentos, contas, meses, planoContas])

  // 2) Cenário base do mesmo período no ano anterior
  const cenarioBaseAnoAnterior: CenarioBaseDre = useMemo(() => {
    return extrairCenarioBaseDre(lancamentos, contas, mesesAnoAnterior, planoContas)
  }, [lancamentos, contas, mesesAnoAnterior, planoContas])

  // Lançamentos individuais de Despesas Variáveis extraídos para a empresa vinculada
  const lancamentosVariaveis = useMemo<LancamentoVariavelItem[]>(() => {
    return extrairLancamentosDespesasVariaveis(lancamentos, contas, planoContas, {
      empresaId: empresaIdAlvo || undefined,
      ano: anoInicial,
      mesesChaves: meses.map((m) => m.chave),
    })
  }, [lancamentos, contas, planoContas, empresaIdAlvo, anoInicial, meses])

  const lancamentosVariaveisFiltrados = useMemo(() => {
    if (!filtroTextoVar.trim()) return lancamentosVariaveis
    const q = filtroTextoVar.toLowerCase()
    return lancamentosVariaveis.filter(
      (item) =>
        (item.historico && item.historico.toLowerCase().includes(q)) ||
        (item.contaNome && item.contaNome.toLowerCase().includes(q)) ||
        (item.contaCodigo && item.contaCodigo.toLowerCase().includes(q)) ||
        (item.centroNome && item.centroNome.toLowerCase().includes(q)) ||
        (item.data && item.data.toLowerCase().includes(q)),
    )
  }, [lancamentosVariaveis, filtroTextoVar])

  // Agrupamento por Centro de Custo para visão do cliente
  const gruposPorCentroCusto = useMemo(() => {
    return agruparLancamentosPorCentroCusto(lancamentosVariaveisFiltrados)
  }, [lancamentosVariaveisFiltrados])

  const totaisVariaveisApurados = useMemo(() => {
    return calcularTotaisVariaveis(lancamentosVariaveisFiltrados)
  }, [lancamentosVariaveisFiltrados])

  // 3) Cálculo mês a mês utilizando extração oficial para cada mês individual
  const itensPorMes = useMemo<ItemMesCrescimento[]>(() => {
    const lista: ItemMesCrescimento[] = []

    let fatAnterior: number | null = null

    // Para o primeiro mês da lista, buscar o mês cronológico imediatamente anterior se disponível
    if (meses.length > 0) {
      const primeiroMes = meses[0]
      const mesCronAnterior = primeiroMes.mes === 1 ? 12 : primeiroMes.mes - 1
      const anoCronAnterior = primeiroMes.mes === 1 ? primeiroMes.ano - 1 : primeiroMes.ano
      const mesItemAnterior = gerarListaMeses(anoCronAnterior, mesCronAnterior, 1)
      const baseAnt = extrairCenarioBaseDre(lancamentos, contas, mesItemAnterior, planoContas)
      if (baseAnt.temDados && baseAnt.faturamento > 0) {
        fatAnterior = baseAnt.faturamento
      }
    }

    for (let i = 0; i < meses.length; i++) {
      const m = meses[i]
      const mArray: MesItem[] = [m]
      const baseMes = extrairCenarioBaseDre(lancamentos, contas, mArray, planoContas)
      const fatMes = baseMes.faturamento

      // Mês equivalente no ano anterior gerado com o gerador oficial
      const mAnoAntArray: MesItem[] = gerarListaMeses(m.ano - 1, m.mes, 1)
      const baseMesAnoAnt = extrairCenarioBaseDre(lancamentos, contas, mAnoAntArray, planoContas)
      const fatAnoPassado = baseMesAnoAnt.temDados ? baseMesAnoAnt.faturamento : null

      // Variação MoM (em relação ao mês cronologicamente anterior)
      const varMoM = fatAnterior !== null ? calcularDeltaPercentual(fatAnterior, fatMes) : null
      const deltaMoM = fatAnterior !== null ? fatMes - fatAnterior : null

      // Variação YoY (em relação ao mesmo mês do ano anterior)
      const varYoY =
        fatAnoPassado !== null && fatAnoPassado > 0
          ? calcularDeltaPercentual(fatAnoPassado, fatMes)
          : null

      lista.push({
        chave: m.chave,
        rotuloCurto: m.rotuloCurto,
        rotuloCompleto: m.rotuloCompleto,
        ano: m.ano,
        mes: m.mes,
        faturamento: fatMes,
        faturamentoAnterior: fatAnterior,
        faturamentoAnoPassado: fatAnoPassado,
        variacaoMoM: varMoM,
        variacaoYoY: varYoY,
        deltaAbsolutoMoM: deltaMoM,
      })

      // Atualiza fatAnterior para a próxima iteração
      fatAnterior = fatMes
    }

    return lista
  }, [meses, lancamentos, contas, planoContas])

  // Indicadores consolidados do período
  const faturamentoTotalPeriodo = cenarioBasePeriodo.faturamento
  const faturamentoTotalAnoAnterior = cenarioBaseAnoAnterior.faturamento

  // Crescimento YoY do período completo
  const crescimentoPeriodoYoY = useMemo<number | null>(() => {
    if (faturamentoTotalAnoAnterior <= 0) return null
    return calcularDeltaPercentual(faturamentoTotalAnoAnterior, faturamentoTotalPeriodo)
  }, [faturamentoTotalAnoAnterior, faturamentoTotalPeriodo])

  const deltaAbsolutoPeriodoYoY = faturamentoTotalPeriodo - faturamentoTotalAnoAnterior

  // Primeiro mês vs Último mês do período (trajetória dentro da janela)
  const primeiroMesFat = itensPorMes.length > 0 ? itensPorMes[0].faturamento : 0
  const ultimoMesFat = itensPorMes.length > 0 ? itensPorMes[itensPorMes.length - 1].faturamento : 0
  const crescimentoPontaAPontaPct = useMemo<number | null>(() => {
    if (itensPorMes.length < 2 || primeiroMesFat <= 0) return null
    return calcularDeltaPercentual(primeiroMesFat, ultimoMesFat)
  }, [itensPorMes.length, primeiroMesFat, ultimoMesFat])

  // Meses com crescimento MoM positivo
  const mesesComAlta = itensPorMes.filter((i) => i.variacaoMoM !== null && i.variacaoMoM > 0).length
  const mesesComQueda = itensPorMes.filter(
    (i) => i.variacaoMoM !== null && i.variacaoMoM < 0,
  ).length

  // Pico de faturamento no período
  const picoMes = useMemo(() => {
    if (itensPorMes.length === 0) return null
    return [...itensPorMes].sort((a, b) => b.faturamento - a.faturamento)[0]
  }, [itensPorMes])

  // Selo de qualidade equivalente ao da Rentabilidade (Excelente/Adequada/Atenção/Crítica)
  // Regra baseada na taxa de crescimento consolidada (YoY quando disponível, senão ponta a ponta):
  // ≥ 15%: Excelente (alta expansão)
  // ≥ 5%: Adequada (crescimento consistente)
  // ≥ 0%: Atenção (estabilidade / crescimento marginal)
  // < 0%: Crítica (retração operacional)
  const taxaReferencia =
    crescimentoPeriodoYoY !== null ? crescimentoPeriodoYoY : crescimentoPontaAPontaPct

  const getSeloQualidade = (taxa: number | null) => {
    if (taxa === null) return null
    if (taxa >= 15) {
      return {
        texto: 'Excelente',
        cor: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40',
        badgeClasse:
          'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300',
        descricao: 'Forte ritmo de expansão com crescimento acima de 15%.',
      }
    }
    if (taxa >= 5) {
      return {
        texto: 'Adequada',
        cor: 'bg-blue-500/20 text-blue-300 border-blue-400/40',
        badgeClasse:
          'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950 dark:text-blue-300',
        descricao: 'Crescimento saudável e consistente com ganhos operacionais.',
      }
    }
    if (taxa >= 0) {
      return {
        texto: 'Atenção',
        cor: 'bg-amber-500/20 text-amber-300 border-amber-400/40',
        badgeClasse:
          'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300',
        descricao: 'Faturamento em platô de estabilidade; requer atenção ao mix comercial.',
      }
    }
    return {
      texto: 'Crítica',
      cor: 'bg-rose-500/20 text-rose-300 border-rose-400/40',
      badgeClasse: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-950 dark:text-red-300',
      descricao: 'Retração de receitas identificada; exige plano de recuperação de vendas.',
    }
  }

  const selo = getSeloQualidade(taxaReferencia)

  const temMovimentacao = useMemo(() => {
    if (lancamentos.length === 0) return false
    return cenarioBasePeriodo.faturamento > 0 || cenarioBasePeriodo.temDados
  }, [lancamentos, cenarioBasePeriodo])

  // Dados para o gráfico Recharts
  const dadosGrafico = useMemo(() => {
    return itensPorMes.map((item) => ({
      mes: item.rotuloCurto,
      mesCompleto: item.rotuloCompleto,
      faturamento: item.faturamento,
      faturamentoAnoPassado: item.faturamentoAnoPassado ?? 0,
      variacaoMoM: item.variacaoMoM ?? 0,
      variacaoYoY: item.variacaoYoY ?? 0,
    }))
  }, [itensPorMes])

  const getVariacaoBadgeColor = (val: number | null) => {
    if (val === null) return 'bg-slate-100 text-slate-600 border-slate-200'
    if (val > 0)
      return 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300'
    if (val === 0) return 'bg-slate-100 text-slate-700 border-slate-300'
    return 'bg-red-100 text-red-800 border-red-300 dark:bg-red-950 dark:text-red-300'
  }

  const handleImprimir = () => {
    window.print()
  }

  return (
    <div className="space-y-5 pb-8 animate-fadeIn print:p-0 print:m-0 print:bg-white print:text-black">
      {/* Banner Superior Executivo Borlim (Idêntico ao padrão ClienteRentabilidade) */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#0B1F3A] via-[#0E284E] to-[#143A6E] border border-blue-900/40 p-6 sm:p-7 text-white shadow-xl shadow-slate-900/10 print:hidden">
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-2.5 max-w-3xl">
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => navigate('/analise-economica-financeira')}
                className="h-7 px-2 text-xs text-sky-200 hover:text-white hover:bg-white/10 gap-1 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Voltar ao Hub
              </Button>
              <span className="text-slate-400">·</span>
              <BorlimLogo
                size="sm"
                variant="light"
                showSubtitle={false}
                className="shadow-xs scale-90 origin-left"
              />
              <Badge className="bg-cyan-500/20 text-cyan-200 border-cyan-400/30 text-xs font-semibold px-2.5 py-0.5 backdrop-blur-md">
                <Sparkles className="w-3 h-3 mr-1 text-cyan-300" />
                Indicador de Crescimento
              </Badge>
              <Badge className="bg-white/10 text-slate-200 border-white/20 text-xs font-medium px-2 py-0.5">
                Visão Cliente
              </Badge>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Indicador de Crescimento
            </h1>

            <p className="text-xs sm:text-sm text-slate-300/90 leading-relaxed">
              Demonstração simplificada da evolução do faturamento, taxas de crescimento mês a mês e
              comparativo anual da sua empresa pela{' '}
              <strong className="text-sky-300">Borlim Consultoria</strong>.
            </p>
          </div>

          {/* Contexto da empresa e botões */}
          <div className="shrink-0 flex flex-col sm:flex-row md:flex-col gap-3 min-w-[220px]">
            <div className="bg-white/5 border border-white/15 rounded-2xl p-3.5 backdrop-blur-md space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-200 shrink-0">
                  <Building2 className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">
                    Empresa Vinculada
                  </span>
                  <span
                    className="text-xs font-bold text-white truncate block max-w-[190px]"
                    title={empresaNome}
                  >
                    {empresaNome}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1.5 border-t border-white/10 text-[11px] text-cyan-200">
                <Calendar className="w-3.5 h-3.5 text-cyan-300" />
                <span>
                  Exercício {anoInicial} ({periodoDescricao})
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={carregarDados}
                disabled={loading}
                className="flex-1 h-8 text-xs font-semibold bg-white/10 border-white/20 hover:bg-white/20 text-white gap-1.5 cursor-pointer"
                title="Recarregar dados"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleImprimir}
                className="flex-1 h-8 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-xs cursor-pointer"
                title="Imprimir relatório em folha A4 / Salvar PDF"
              >
                <Printer className="w-3.5 h-3.5" />
                Imprimir / PDF
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Cabeçalho exclusivo para impressão (A4, fundo branco garantido) */}
      <div className="hidden print:block border-b-2 border-slate-800 pb-3 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <BorlimLogo size="md" variant="dark" />
            <h1 className="text-xl font-bold text-slate-900 mt-2">
              Indicador de Crescimento — Visão do Cliente
            </h1>
            <p className="text-xs text-slate-600">
              Empresa: <strong>{empresaNome}</strong> · Período: <strong>{periodoDescricao}</strong>{' '}
              (Exercício {anoInicial})
            </p>
          </div>
          <div className="text-right text-xs text-slate-500">
            <p className="font-semibold text-slate-700">Borlim Consultoria Empresarial</p>
            <p>Gerado em {new Date().toLocaleDateString('pt-BR')}</p>
          </div>
        </div>
      </div>

      {/* Barra de Filtro de Período (sincronizada com o FilterContext, até 12 meses) */}
      <Card className="bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800 shadow-xs print:hidden">
        <CardContent className="py-3 px-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="text-xs font-bold text-[#0B1F3A] dark:text-slate-100">
                Período da Demonstração:
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {periodoDescricao} ({meses.length} mês(es))
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                  Mês Inicial:
                </span>
                <Select
                  value={String(mesInicial)}
                  onValueChange={(val) => setMesInicial(Number(val))}
                >
                  <SelectTrigger className="h-8 text-xs bg-white dark:bg-slate-800 w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MESES_OPCOES.map((m) => (
                      <SelectItem key={m.valor} value={String(m.valor)} className="text-xs">
                        {m.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                  Exercício:
                </span>
                <Select
                  value={String(anoInicial)}
                  onValueChange={(val) => setAnoInicial(Number(val))}
                >
                  <SelectTrigger className="h-8 text-xs bg-white dark:bg-slate-800 w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(anosDisponiveis && anosDisponiveis.length > 0
                      ? anosDisponiveis
                      : [anoInicial - 1, anoInicial, anoInicial + 1]
                    ).map((ano) => (
                      <SelectItem key={ano} value={String(ano)} className="text-xs">
                        {ano}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                  Duração:
                </span>
                <Input
                  type="number"
                  min={1}
                  max={12}
                  value={qtdMeses}
                  onChange={(e) => handleQtdMesesChange(Number(e.target.value))}
                  className="h-8 w-16 text-xs text-center"
                />
                <span className="text-[11px] text-slate-400">meses (máx 12)</span>
              </div>

              {avisoLimiteMeses && (
                <Badge variant="destructive" className="text-[10px]">
                  Máximo 12 meses
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Estado vazio para cliente sem lançamentos de receita */}
      {!loading && !temMovimentacao && (
        <EstadoVazioClienteCard
          empresaNome={empresaNome}
          ano={anoInicial}
          mensagem="Nenhum lançamento contábil ou DRE de faturamento encontrado para sua empresa no período selecionado. Entre em contato com seu consultor Borlim para a conciliação do faturamento e liberação do demonstrativo."
        />
      )}

      {/* Cards de KPIs Principais Simplificados */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* 1. Faturamento Total no Período */}
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden print:border-slate-300 print:shadow-none">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-600 print:hidden" />
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Faturamento no Período
                </p>
                <h3 className="text-xl font-extrabold text-[#0B1F3A] dark:text-slate-100 mt-1 tracking-tight tabular-nums">
                  {formatBrl(faturamentoTotalPeriodo)}
                </h3>
              </div>
              <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400 shadow-xs print:hidden">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-2">
              <span>{meses.length} mês(es) apurados</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                Média: {formatBrl(meses.length > 0 ? faturamentoTotalPeriodo / meses.length : 0)}
                /mês
              </span>
            </div>
          </CardContent>
        </Card>

        {/* 2. Variação no Período / Comparativo YoY */}
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden print:border-slate-300 print:shadow-none">
          <div
            className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${
              crescimentoPeriodoYoY !== null && crescimentoPeriodoYoY >= 0
                ? 'from-emerald-500 to-teal-600'
                : 'from-amber-500 to-rose-600'
            } print:hidden`}
          />
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Comparativo vs Ano Anterior
                </p>
                <div className="flex items-baseline gap-2 mt-1">
                  <h3
                    className={`text-xl font-extrabold tracking-tight tabular-nums ${
                      crescimentoPeriodoYoY !== null && crescimentoPeriodoYoY >= 0
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : crescimentoPeriodoYoY !== null
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-[#0B1F3A] dark:text-slate-100'
                    }`}
                  >
                    {formatPercent(crescimentoPeriodoYoY)}
                  </h3>
                </div>
              </div>
              <div
                className={`p-2.5 rounded-xl shadow-xs print:hidden ${
                  crescimentoPeriodoYoY !== null && crescimentoPeriodoYoY >= 0
                    ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400'
                    : 'bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400'
                }`}
              >
                {crescimentoPeriodoYoY !== null && crescimentoPeriodoYoY >= 0 ? (
                  <ArrowUpRight className="w-5 h-5" />
                ) : crescimentoPeriodoYoY !== null ? (
                  <ArrowDownRight className="w-5 h-5" />
                ) : (
                  <Minus className="w-5 h-5" />
                )}
              </div>
            </div>
            <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-2">
              <span>
                Ano {anoInicial - 1}: {formatBrlCompacto(faturamentoTotalAnoAnterior)}
              </span>
              <span
                className={`font-semibold ${
                  deltaAbsolutoPeriodoYoY >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-red-600 dark:text-red-400'
                }`}
              >
                {deltaAbsolutoPeriodoYoY >= 0 ? '+' : ''}
                {formatBrlCompacto(deltaAbsolutoPeriodoYoY)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* 3. Indicador de Qualidade de Crescimento (Selo) */}
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden print:border-slate-300 print:shadow-none">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 to-blue-600 print:hidden" />
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Qualidade do Crescimento
                </p>
                <div className="flex items-baseline gap-2 mt-1">
                  <h3 className="text-xl font-extrabold text-[#0B1F3A] dark:text-slate-100 tracking-tight tabular-nums">
                    {selo ? selo.texto : 'Em Apuração'}
                  </h3>
                  {selo && (
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-bold px-1.5 py-0 rounded-full ${selo.badgeClasse}`}
                    >
                      {formatPercent(taxaReferencia)}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-cyan-50 text-cyan-600 dark:bg-cyan-950 dark:text-cyan-400 shadow-xs print:hidden">
                <Award className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-2">
              <span className="truncate max-w-[200px]">
                {selo ? selo.descricao : 'Aguardando dados comparativos'}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* 4. Dinâmica Mensal / Trajetória Ponta a Ponta */}
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden print:border-slate-300 print:shadow-none">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 to-indigo-600 print:hidden" />
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Trajetória na Janela
                </p>
                <div className="flex items-baseline gap-2 mt-1">
                  <h3
                    className={`text-xl font-extrabold tracking-tight tabular-nums ${
                      crescimentoPontaAPontaPct !== null && crescimentoPontaAPontaPct >= 0
                        ? 'text-[#0B1F3A] dark:text-slate-100'
                        : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    {formatPercent(crescimentoPontaAPontaPct)}
                  </h3>
                  <span className="text-[10px] text-slate-400 font-medium">1º vs último mês</span>
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400 shadow-xs print:hidden">
                <Scale className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-2">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                {mesesComAlta}m em alta
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                {mesesComQueda}m em retração
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico Principal de Evolução do Crescimento */}
      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs print:border-slate-300">
        <CardHeader className="py-3 px-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1 rounded-md bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 print:hidden">
                <TrendingUp className="w-4 h-4" />
              </span>
              <CardTitle className="text-sm font-bold text-[#0B1F3A] dark:text-slate-100">
                Evolução do Faturamento & Taxa de Crescimento
              </CardTitle>
            </div>
            <CardDescription className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Barras de faturamento mensal com curva de crescimento percentual no eixo secundário
            </CardDescription>
          </div>

          <div className="flex items-center gap-2 print:hidden">
            <Button
              type="button"
              variant={tipoVisualizacaoGrafico === 'barras_linha' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTipoVisualizacaoGrafico('barras_linha')}
              className="h-7 text-xs font-semibold cursor-pointer"
            >
              Faturamento × Crescimento (%)
            </Button>
            <Button
              type="button"
              variant={
                tipoVisualizacaoGrafico === 'comparativo_ano_anterior' ? 'default' : 'outline'
              }
              size="sm"
              onClick={() => setTipoVisualizacaoGrafico('comparativo_ano_anterior')}
              className="h-7 text-xs font-semibold cursor-pointer"
            >
              Comparativo Anual ({anoInicial} vs {anoInicial - 1})
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-6">
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              {tipoVisualizacaoGrafico === 'barras_linha' ? (
                <ComposedChart
                  data={dadosGrafico}
                  margin={{ top: 15, right: 25, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#94A3B8" opacity={0.25} />
                  <XAxis
                    dataKey="mes"
                    stroke="#64748B"
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: '#CBD5E1' }}
                  />
                  <YAxis
                    yAxisId="left"
                    stroke="#64748B"
                    fontSize={11}
                    tickFormatter={formatBrlCompacto}
                    tickLine={false}
                    axisLine={{ stroke: '#CBD5E1' }}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke="#0EA5E9"
                    fontSize={11}
                    tickFormatter={(v) => `${v}%`}
                    tickLine={false}
                    axisLine={{ stroke: '#0EA5E9' }}
                  />
                  <ReferenceLine yAxisId="left" y={0} stroke="#94A3B8" strokeWidth={1} />
                  <ReferenceLine
                    yAxisId="right"
                    y={0}
                    stroke="#0EA5E9"
                    strokeDasharray="2 2"
                    strokeWidth={1}
                  />
                  <RechartsTooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null
                      const d = payload[0].payload
                      return (
                        <div className="bg-[#0B1F3A] text-white p-3 rounded-xl shadow-xl border border-slate-700 text-xs min-w-[220px]">
                          <p className="font-bold border-b border-white/10 pb-1.5 text-blue-200">
                            {d.mesCompleto}
                          </p>
                          <div className="space-y-1.5 mt-2">
                            <div className="flex items-center justify-between gap-3">
                              <span className="flex items-center gap-1.5 text-blue-300">
                                <span className="w-2.5 h-2.5 rounded-xs bg-[#2563EB]" />
                                Faturamento:
                              </span>
                              <strong className="font-semibold tabular-nums text-white">
                                {formatBrl(d.faturamento)}
                              </strong>
                            </div>
                            <div className="flex items-center justify-between gap-3 pt-1 border-t border-white/10">
                              <span className="flex items-center gap-1.5 text-cyan-300">
                                <span className="w-2.5 h-2.5 rounded-full bg-[#0EA5E9]" />
                                Variação MoM:
                              </span>
                              <strong
                                className={`font-bold tabular-nums ${
                                  d.variacaoMoM >= 0 ? 'text-emerald-300' : 'text-red-300'
                                }`}
                              >
                                {formatPercent(d.variacaoMoM)}
                              </strong>
                            </div>
                            {d.variacaoYoY !== 0 && (
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-slate-300">Variação YoY (ano ant.):</span>
                                <strong
                                  className={`font-semibold tabular-nums ${
                                    d.variacaoYoY >= 0 ? 'text-emerald-300' : 'text-red-300'
                                  }`}
                                >
                                  {formatPercent(d.variacaoYoY)}
                                </strong>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    }}
                  />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    wrapperStyle={{ paddingBottom: '12px', fontSize: '11px' }}
                  />
                  <Bar
                    yAxisId="left"
                    dataKey="faturamento"
                    name={`Faturamento ${anoInicial}`}
                    fill="#2563EB"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={40}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="variacaoMoM"
                    name="Crescimento Mensal (%)"
                    stroke="#0EA5E9"
                    strokeWidth={2.5}
                    dot={{ fill: '#0EA5E9', r: 4 }}
                    activeDot={{ r: 6, fill: '#0284C7' }}
                  />
                </ComposedChart>
              ) : (
                <ComposedChart
                  data={dadosGrafico}
                  margin={{ top: 15, right: 25, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#94A3B8" opacity={0.25} />
                  <XAxis
                    dataKey="mes"
                    stroke="#64748B"
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: '#CBD5E1' }}
                  />
                  <YAxis
                    stroke="#64748B"
                    fontSize={11}
                    tickFormatter={formatBrlCompacto}
                    tickLine={false}
                    axisLine={{ stroke: '#CBD5E1' }}
                  />
                  <ReferenceLine y={0} stroke="#94A3B8" strokeWidth={1} />
                  <RechartsTooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null
                      const d = payload[0].payload
                      return (
                        <div className="bg-[#0B1F3A] text-white p-3 rounded-xl shadow-xl border border-slate-700 text-xs min-w-[220px]">
                          <p className="font-bold border-b border-white/10 pb-1.5 text-blue-200">
                            {d.mesCompleto}
                          </p>
                          <div className="space-y-1.5 mt-2">
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-blue-300">Exercício {anoInicial}:</span>
                              <strong className="font-semibold tabular-nums text-white">
                                {formatBrl(d.faturamento)}
                              </strong>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-slate-300">Exercício {anoInicial - 1}:</span>
                              <strong className="font-semibold tabular-nums text-slate-300">
                                {formatBrl(d.faturamentoAnoPassado)}
                              </strong>
                            </div>
                            <div className="flex items-center justify-between gap-3 pt-1 border-t border-white/10">
                              <span className="text-cyan-300">Variação Anual:</span>
                              <strong
                                className={`font-bold tabular-nums ${
                                  d.variacaoYoY >= 0 ? 'text-emerald-300' : 'text-red-300'
                                }`}
                              >
                                {formatPercent(d.variacaoYoY)}
                              </strong>
                            </div>
                          </div>
                        </div>
                      )
                    }}
                  />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    wrapperStyle={{ paddingBottom: '12px', fontSize: '11px' }}
                  />
                  <Bar
                    dataKey="faturamento"
                    name={`Exercício ${anoInicial}`}
                    fill="#2563EB"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={32}
                  />
                  <Bar
                    dataKey="faturamentoAnoPassado"
                    name={`Exercício ${anoInicial - 1}`}
                    fill="#94A3B8"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={32}
                  />
                </ComposedChart>
              )}
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Tabela Mensal Simplificada (mês, faturamento, variação % com totais no rodapé) */}
      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs print:border-slate-300">
        <CardHeader className="py-3 px-4 sm:px-6 flex flex-row items-center justify-between border-b border-slate-100 dark:border-slate-800">
          <div>
            <CardTitle className="text-sm font-bold text-[#0B1F3A] dark:text-slate-100">
              Demonstração Mensal de Crescimento ({periodoDescricao})
            </CardTitle>
            <CardDescription className="text-xs text-slate-500 dark:text-slate-400">
              Acompanhamento mensal de faturamento, variação em relação ao mês anterior (MoM) e ao
              ano anterior (YoY)
            </CardDescription>
          </div>
          <Badge
            variant="outline"
            className="text-[11px] font-semibold bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 print:border-slate-300"
          >
            {meses.length} mês(es) apurados
          </Badge>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wider print:bg-slate-100 print:text-black">
                  <th className="py-3 px-4 text-left">Mês</th>
                  <th className="py-3 px-4 text-right">Faturamento ({anoInicial})</th>
                  <th className="py-3 px-4 text-right">Faturamento ({anoInicial - 1})</th>
                  <th className="py-3 px-4 text-right">Variação Mensal (MoM)</th>
                  <th className="py-3 px-4 text-right">Variação Anual (YoY)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 print:divide-slate-200">
                {itensPorMes.map((item) => (
                  <tr
                    key={item.chave}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-2.5 px-4 font-semibold text-[#0B1F3A] dark:text-slate-100 print:text-black">
                      {item.rotuloCompleto}
                    </td>
                    <td className="py-2.5 px-4 text-right font-medium text-slate-800 dark:text-slate-200 tabular-nums print:text-black">
                      {formatBrl(item.faturamento)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-normal text-slate-500 dark:text-slate-400 tabular-nums print:text-slate-600">
                      {item.faturamentoAnoPassado !== null
                        ? formatBrl(item.faturamentoAnoPassado)
                        : '—'}
                    </td>
                    <td className="py-2.5 px-4 text-right tabular-nums">
                      <span
                        className={`inline-block font-bold px-2 py-0.5 rounded-full text-[11px] ${getVariacaoBadgeColor(
                          item.variacaoMoM,
                        )}`}
                      >
                        {formatPercent(item.variacaoMoM)}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right tabular-nums">
                      <span
                        className={`inline-block font-bold px-2 py-0.5 rounded-full text-[11px] ${getVariacaoBadgeColor(
                          item.variacaoYoY,
                        )}`}
                      >
                        {formatPercent(item.variacaoYoY)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100/90 dark:bg-slate-800/90 border-t-2 border-slate-300 dark:border-slate-700 font-bold text-[11.5px] text-[#0B1F3A] dark:text-slate-100 print:bg-slate-200 print:text-black">
                  <td className="py-3 px-4 uppercase tracking-wider font-extrabold">
                    TOTAL DO PERÍODO
                  </td>
                  <td className="py-3 px-4 text-right tabular-nums font-extrabold text-blue-700 dark:text-blue-300 print:text-blue-900">
                    {formatBrl(faturamentoTotalPeriodo)}
                  </td>
                  <td className="py-3 px-4 text-right tabular-nums font-semibold text-slate-600 dark:text-slate-400 print:text-slate-700">
                    {formatBrl(faturamentoTotalAnoAnterior)}
                  </td>
                  <td className="py-3 px-4 text-right tabular-nums">
                    <span
                      className={`inline-block font-extrabold px-2.5 py-0.5 rounded-full text-xs ${getVariacaoBadgeColor(
                        crescimentoPontaAPontaPct,
                      )}`}
                      title="Crescimento ponta a ponta na janela"
                    >
                      {formatPercent(crescimentoPontaAPontaPct)}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right tabular-nums">
                    <span
                      className={`inline-block font-extrabold px-3 py-0.5 rounded-full text-xs ${getVariacaoBadgeColor(
                        crescimentoPeriodoYoY,
                      )}`}
                      title="Variação total consolidada vs ano anterior"
                    >
                      {formatPercent(crescimentoPeriodoYoY)}
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ================= BLOCO DE DESPESAS VARIÁVEIS POR CENTRO DE CUSTO ================= */}
      {temMovimentacao && (
        <div className="pt-2">
          <PainelDespesasVariaveisCentros
            grupos={gruposPorCentroCusto}
            totalGeral={totaisVariaveisApurados.totalValor}
            quantidadeTotal={totaisVariaveisApurados.quantidade}
            filtroTexto={filtroTextoVar}
            onFiltroTextoChange={setFiltroTextoVar}
            isCliente={true}
          />
        </div>
      )}

      {/* Assinatura Borlim no final da página */}
      <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400 print:hidden">
        <div className="flex items-center gap-2.5">
          <BorlimLogo size="sm" variant="auto" className="shadow-xs scale-90 origin-left" />
          <span className="font-semibold text-slate-700 dark:text-slate-300">
            Borlim Consultoria Empresarial
          </span>
          <span className="hidden md:inline text-slate-400">·</span>
          <span className="hidden md:inline">
            Inteligência Estratégica, Controladoria & Finanças
          </span>
        </div>
        <span className="text-[11px] text-slate-400">
          Relatório Executivo · Exercício {anoInicial}
        </span>
      </div>

      {/* Rodapé A4 de Impressão */}
      <DocumentPrintFooter />
    </div>
  )
}
