import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useFilter } from '@/contexts/FilterContext'
import { useToast } from '@/hooks/use-toast'
import { useRealtime } from '@/hooks/use-realtime'
import { contasService, lancamentosService, planoContasService } from '@/services/financeService'
import type { ContaRecord, LancamentoRecord, PlanoContaRecord } from '@/types/finance'
import { gerarListaMeses } from '@/lib/dreGerencialTypes'
import {
  calcularAnaliseRentabilidade,
  calcularComparativoRentabilidadeAnos,
  type AnaliseRentabilidadeResultado,
  type AnoRentabilidadeComparado,
} from '@/lib/analiseRentabilidadeCalculo'
import { DoubleHorizontalScroll } from '@/components/DoubleHorizontalScroll'
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
  Percent,
  TrendingUp,
  Building2,
  Calendar,
  Printer,
  Sparkles,
  Layers,
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
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

function formatPercent(val: number | null | undefined, casas = 2): string {
  if (val === null || val === undefined || !Number.isFinite(val)) return '—'
  return `${val >= 0 ? '+' : ''}${val.toFixed(casas)}%`
}

export default function ClienteRentabilidade() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { user } = useAuth()
  const { selectedEmpresaId, selectedEmpresa, selectedAno, empresasIdsAtivas, anosDisponiveis } =
    useFilter()

  // Dados
  const [loading, setLoading] = useState(true)
  const [lancamentos, setLancamentos] = useState<LancamentoRecord[]>([])
  const [contas, setContas] = useState<ContaRecord[]>([])
  const [planoContas, setPlanoContas] = useState<PlanoContaRecord[]>([])

  // Filtros de período (mês inicial, exercício e duração de 1 a 12 meses)
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

  // Modo comparativo multi-ano (somente leitura para o cliente)
  const [modoComparativo, setModoComparativo] = useState(false)
  const [anosComparados, setAnosComparados] = useState<number[]>([])

  // Tipo de visualização gráfica
  const [tipoVisualizacaoGrafico, setTipoVisualizacaoGrafico] = useState<
    'barras_linha' | 'linhas_margem'
  >('barras_linha')

  // Identificação da empresa vinculada
  const empresaIdAlvo =
    selectedEmpresaId && !selectedEmpresaId.startsWith('grupo-')
      ? selectedEmpresaId
      : selectedEmpresa?.id || user?.empresa || null

  const empresaNome = selectedEmpresa?.nome || selectedEmpresa?.nome_fantasia || 'Minha Empresa'

  // Carregar dados estritamente restritos à empresa do cliente
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

      // Identifica anos disponíveis nos lançamentos carregados para a empresa
      const anosSet = new Set<number>()
      lancamentosList.forEach((l) => {
        if (l.data) {
          const a = parseInt(l.data.slice(0, 4), 10)
          if (!isNaN(a) && a > 2000 && a < 2100) anosSet.add(a)
        }
      })
      if (anosSet.size > 0) {
        const listaAnos = Array.from(anosSet).sort((a, b) => b - a)
        setAnosComparados((prev) => {
          if (prev.length > 0) {
            const filtrados = prev.filter((a) => listaAnos.includes(a) && a !== anoInicial)
            if (filtrados.length > 0) return filtrados
          }
          const anoAnt = anoInicial - 1
          return listaAnos.includes(anoAnt) ? [anoAnt] : []
        })
      }
    } catch (err: any) {
      console.error('Erro ao carregar dados de rentabilidade do cliente:', err)
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

  // Lista de meses
  const meses = useMemo(() => {
    return gerarListaMeses(anoInicial, mesInicial, qtdMeses)
  }, [anoInicial, mesInicial, qtdMeses])

  // Lista de anos com dados reais nos lançamentos
  const anosComDados = useMemo<number[]>(() => {
    const s = new Set<number>()
    lancamentos.forEach((l) => {
      if (l.data) {
        const a = parseInt(l.data.slice(0, 4), 10)
        if (!isNaN(a) && a > 2000 && a < 2100) s.add(a)
      }
    })
    if (anosDisponiveis && anosDisponiveis.length > 0) {
      anosDisponiveis.forEach((a) => s.add(a))
    }
    s.add(anoInicial)
    return Array.from(s).sort((a, b) => b - a)
  }, [lancamentos, anosDisponiveis, anoInicial])

  // Cálculo da Análise de Rentabilidade via motor oficial
  const analise = useMemo<AnaliseRentabilidadeResultado>(() => {
    return calcularAnaliseRentabilidade(lancamentos, contas, meses, planoContas)
  }, [lancamentos, contas, meses, planoContas])

  // Cálculo comparativo multi-ano via motor oficial (somente leitura)
  const comparativoAnos = useMemo<AnoRentabilidadeComparado[]>(() => {
    if (!modoComparativo || anosComparados.length === 0) {
      return [{ ano: anoInicial, resultado: analise }]
    }
    return calcularComparativoRentabilidadeAnos(
      lancamentos,
      contas,
      anoInicial,
      mesInicial,
      qtdMeses,
      anosComparados,
      planoContas,
    )
  }, [
    modoComparativo,
    anosComparados,
    anoInicial,
    mesInicial,
    qtdMeses,
    lancamentos,
    contas,
    planoContas,
    analise,
  ])

  const toggleAnoComparado = (ano: number) => {
    setAnosComparados((prev) =>
      prev.includes(ano) ? prev.filter((a) => a !== ano) : [...prev, ano].sort((a, b) => b - a),
    )
  }

  const periodoDescricao = useMemo(() => {
    if (meses.length === 0) return ''
    return `${meses[0].rotuloCurto} a ${meses[meses.length - 1].rotuloCurto}`
  }, [meses])

  const temMovimentacao = useMemo(() => {
    if (lancamentos.length === 0) return false
    return (
      analise.faturamentoTotal !== 0 ||
      analise.lucroTotal !== 0 ||
      analise.despesasFixasTotal !== 0 ||
      analise.despesasVariaveisTotal !== 0
    )
  }, [lancamentos, analise])

  // Dados para o gráfico Recharts
  const dadosGrafico = useMemo(() => {
    return analise.itensPorMes.map((item) => ({
      mes: item.rotuloCurto,
      mesCompleto: item.rotuloCompleto,
      faturamento: item.faturamento,
      lucroApurado: item.lucroApurado,
      margemSobreFaturamento: item.margemSobreFaturamento ?? 0,
      margemBruta: item.margemBruta ?? 0,
      margemOperacional: item.margemOperacional ?? 0,
    }))
  }, [analise.itensPorMes])

  // Dados do gráfico comparativo multi-ano
  const dadosGraficoComparativo = useMemo(() => {
    if (!modoComparativo || comparativoAnos.length <= 1) return []
    const mesesBase = comparativoAnos[0]?.resultado?.itensPorMes || []
    return mesesBase.map((itemBase, idx) => {
      const ponto: Record<string, any> = {
        mes: itemBase.rotuloCurto,
        mesCompleto: itemBase.rotuloCompleto,
      }
      for (const comp of comparativoAnos) {
        const itemAno = comp.resultado.itensPorMes[idx]
        if (itemAno) {
          ponto[`fat_${comp.ano}`] = itemAno.faturamento
          ponto[`lucro_${comp.ano}`] = itemAno.lucroApurado
          ponto[`margem_${comp.ano}`] = itemAno.margemSobreFaturamento ?? 0
        }
      }
      return ponto
    })
  }, [modoComparativo, comparativoAnos])

  const margemConsolidada = analise.margemSobreFaturamentoTotal
  const margemBrutaConsolidada = analise.margemBrutaTotal
  const margemOperacionalConsolidada = analise.margemOperacionalTotal

  const getMargemBadgeColor = (val: number | null) => {
    if (val === null) return 'bg-slate-100 text-slate-600 border-slate-200'
    if (val >= 15)
      return 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300'
    if (val >= 5)
      return 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950 dark:text-blue-300'
    if (val >= 0)
      return 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300'
    return 'bg-red-100 text-red-800 border-red-300 dark:bg-red-950 dark:text-red-300'
  }

  const getSeloQualidade = (val: number | null) => {
    if (val === null) return null
    if (val >= 15)
      return { texto: 'Excelente', cor: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40' }
    if (val >= 5)
      return { texto: 'Adequada', cor: 'bg-blue-500/20 text-blue-300 border-blue-400/40' }
    if (val >= 0)
      return { texto: 'Atenção', cor: 'bg-amber-500/20 text-amber-300 border-amber-400/40' }
    return { texto: 'Crítica', cor: 'bg-rose-500/20 text-rose-300 border-rose-400/40' }
  }

  const selo = getSeloQualidade(margemConsolidada)

  const handleImprimir = () => {
    window.print()
  }

  return (
    <div className="space-y-5 pb-8 animate-fadeIn print:p-0 print:m-0 print:bg-white print:text-black">
      {/* Banner Superior Executivo Borlim */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#0B1F3A] via-[#0E2C52] to-[#144272] border border-blue-900/40 p-6 sm:p-7 text-white shadow-xl shadow-slate-900/10 print:hidden">
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
              <Badge className="bg-emerald-500/20 text-emerald-200 border-emerald-400/30 text-xs font-semibold px-2.5 py-0.5 backdrop-blur-md">
                <Sparkles className="w-3 h-3 mr-1 text-emerald-300" />
                Análise de Rentabilidade
              </Badge>
              <Badge className="bg-white/10 text-slate-200 border-white/20 text-xs font-medium px-2 py-0.5">
                Visão Cliente
              </Badge>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Análise de Rentabilidade
            </h1>

            <p className="text-xs sm:text-sm text-slate-300/90 leading-relaxed">
              Demonstração simplificada de faturamento, lucro apurado no DRE e margens de
              rentabilidade da sua empresa pela{' '}
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
              Análise de Rentabilidade — Visão do Cliente
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

      {/* Barra de Filtro de Período (mesmo seletor da tela completa, até 12 meses) */}
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

          {/* Seletor do Modo Comparativo Multi-Ano (Visão Cliente - Somente Leitura) */}
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-2.5">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={modoComparativo}
                  onChange={(e) => setModoComparativo(e.target.checked)}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                />
                <span className="text-xs font-bold text-[#0B1F3A] dark:text-slate-100 flex items-center gap-1.5">
                  <BarChart3 className="w-3.5 h-3.5 text-emerald-600" />
                  Comparar com outros anos
                </span>
              </label>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:inline">
                (Compara o mesmo intervalo de meses entre os exercícios disponíveis)
              </span>
            </div>

            {modoComparativo && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 mr-1">
                  Incluir anos anteriores:
                </span>
                {(() => {
                  const opcoesAnos = anosComDados.filter((a) => a !== anoInicial)
                  const listaFinal =
                    opcoesAnos.length > 0
                      ? opcoesAnos
                      : [anoInicial - 1, anoInicial - 2].filter((a) => a > 2000)
                  return listaFinal.map((ano) => {
                    const ativo = anosComparados.includes(ano)
                    return (
                      <Button
                        key={ano}
                        type="button"
                        size="sm"
                        variant={ativo ? 'default' : 'outline'}
                        onClick={() => toggleAnoComparado(ano)}
                        className={`h-7 px-2.5 text-xs font-semibold cursor-pointer ${
                          ativo
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            : 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                        }`}
                      >
                        {ano}
                      </Button>
                    )
                  })
                })()}
                {anosComparados.length === 0 && (
                  <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                    Selecione ao menos um ano para comparar
                  </span>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Estado vazio para cliente sem lançamentos */}
      {!loading && !temMovimentacao && (
        <EstadoVazioClienteCard
          empresaNome={empresaNome}
          ano={anoInicial}
          mensagem="Nenhum lançamento de faturamento ou despesa encontrado para sua empresa no período selecionado. Entre em contato com seu consultor Borlim para a conciliação e liberação do fechamento contábil."
        />
      )}

      {/* Cards de KPIs Principais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* 1. Faturamento Total */}
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden print:border-slate-300 print:shadow-none">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-600 print:hidden" />
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Faturamento Total
                </p>
                <h3 className="text-xl font-extrabold text-[#0B1F3A] dark:text-slate-100 mt-1 tracking-tight tabular-nums">
                  {formatBrl(analise.faturamentoTotal)}
                </h3>
              </div>
              <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400 shadow-xs print:hidden">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-2">
              <span>{meses.length} mês(es) no período</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                Média: {formatBrl(meses.length > 0 ? analise.faturamentoTotal / meses.length : 0)}
                /mês
              </span>
            </div>
          </CardContent>
        </Card>

        {/* 2. Lucro Apurado no DRE */}
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden print:border-slate-300 print:shadow-none">
          <div
            className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${
              analise.lucroTotal >= 0 ? 'from-emerald-500 to-teal-600' : 'from-red-500 to-rose-600'
            } print:hidden`}
          />
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Lucro Apurado (DRE)
                </p>
                <h3
                  className={`text-xl font-extrabold mt-1 tracking-tight tabular-nums ${
                    analise.lucroTotal >= 0
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {formatBrl(analise.lucroTotal)}
                </h3>
              </div>
              <div
                className={`p-2.5 rounded-xl shadow-xs print:hidden ${
                  analise.lucroTotal >= 0
                    ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400'
                    : 'bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400'
                }`}
              >
                {analise.lucroTotal >= 0 ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <AlertTriangle className="w-5 h-5" />
                )}
              </div>
            </div>
            <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-2">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                {analise.mesesComLucro}m com lucro
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                {analise.mesesComPrejuizo}m prejuízo
              </span>
            </div>
          </CardContent>
        </Card>

        {/* 3. Margem sobre Faturamento com Selo de Qualidade */}
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden print:border-slate-300 print:shadow-none">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-orange-600 print:hidden" />
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Margem s/ Faturamento
                </p>
                <div className="flex items-baseline gap-2 mt-1">
                  <h3
                    className={`text-xl font-extrabold tracking-tight tabular-nums ${
                      margemConsolidada !== null && margemConsolidada >= 0
                        ? 'text-[#0B1F3A] dark:text-slate-100'
                        : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    {formatPercent(margemConsolidada)}
                  </h3>
                  {selo && (
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-bold px-1.5 py-0 rounded-full ${getMargemBadgeColor(
                        margemConsolidada,
                      )}`}
                    >
                      {selo.texto}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400 shadow-xs print:hidden">
                <Percent className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-2">
              <span>Lucro / Faturamento</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {analise.maiorMargemMes
                  ? `Pico: ${analise.maiorMargemMes.rotulo} (${formatPercent(
                      analise.maiorMargemMes.margem,
                      1,
                    )})`
                  : '—'}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* 4. Margem Bruta e Margem Operacional */}
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden print:border-slate-300 print:shadow-none">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 to-pink-600 print:hidden" />
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Margens Estruturais
                </p>
                <div className="mt-1 space-y-0.5">
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="text-slate-600 dark:text-slate-400 font-medium">
                      Margem Bruta:
                    </span>
                    <strong className="text-purple-700 dark:text-purple-300 font-bold tabular-nums">
                      {formatPercent(margemBrutaConsolidada)}
                    </strong>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="text-slate-600 dark:text-slate-400 font-medium">
                      Margem Operac.:
                    </span>
                    <strong
                      className={`font-bold tabular-nums ${
                        margemOperacionalConsolidada !== null && margemOperacionalConsolidada >= 0
                          ? 'text-teal-700 dark:text-teal-300'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {formatPercent(margemOperacionalConsolidada)}
                    </strong>
                  </div>
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400 shadow-xs print:hidden">
                <Layers className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-2">
              <span>Absorção Custos DRE</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                Fixas + Variáveis
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bloco Exclusivo de Comparativo Multi-Ano (Quando ativado) */}
      {modoComparativo && comparativoAnos.length > 1 && (
        <div className="space-y-4">
          {/* Gráfico Comparativo Multi-Ano */}
          <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs">
            <CardHeader className="py-3 px-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-1 rounded-md bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                    <BarChart3 className="w-4 h-4" />
                  </span>
                  <CardTitle className="text-sm font-bold text-[#0B1F3A] dark:text-slate-100">
                    Comparativo Multi-Ano: Faturamento e Lucro Apurado
                  </CardTitle>
                </div>
                <CardDescription className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Barras agrupadas de faturamento e lucro com linha de margem % (
                  {comparativoAnos.map((c) => c.ano).join(' vs ')})
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={dadosGraficoComparativo}
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
                      stroke="#F59E0B"
                      fontSize={11}
                      tickFormatter={(v) => `${v}%`}
                      tickLine={false}
                      axisLine={{ stroke: '#F59E0B' }}
                    />
                    <ReferenceLine yAxisId="left" y={0} stroke="#94A3B8" strokeWidth={1} />
                    <RechartsTooltip
                      content={({ active, payload }) => {
                        if (!active || !payload || !payload.length) return null
                        const d = payload[0].payload
                        return (
                          <div className="bg-[#0B1F3A] text-white p-3 rounded-xl shadow-xl border border-slate-700 text-xs min-w-[240px]">
                            <p className="font-bold border-b border-white/10 pb-1.5 text-blue-200">
                              {d.mesCompleto} — Comparativo
                            </p>
                            <div className="space-y-2 mt-2">
                              {comparativoAnos.map((c) => (
                                <div
                                  key={c.ano}
                                  className="border-b border-white/10 pb-1.5 last:border-0 last:pb-0"
                                >
                                  <div className="text-[11px] font-bold text-slate-300">
                                    Ano {c.ano}
                                  </div>
                                  <div className="flex justify-between gap-3 text-[11px]">
                                    <span className="text-blue-300">Faturamento:</span>
                                    <strong className="text-white">
                                      {formatBrl(d[`fat_${c.ano}`] || 0)}
                                    </strong>
                                  </div>
                                  <div className="flex justify-between gap-3 text-[11px]">
                                    <span className="text-emerald-300">Lucro:</span>
                                    <strong
                                      className={
                                        d[`lucro_${c.ano}`] >= 0
                                          ? 'text-emerald-300'
                                          : 'text-red-300'
                                      }
                                    >
                                      {formatBrl(d[`lucro_${c.ano}`] || 0)}
                                    </strong>
                                  </div>
                                  <div className="flex justify-between gap-3 text-[11px]">
                                    <span className="text-amber-300">Margem:</span>
                                    <strong className="text-amber-300">
                                      {formatPercent(d[`margem_${c.ano}`] ?? null)}
                                    </strong>
                                  </div>
                                </div>
                              ))}
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
                    {comparativoAnos.map((comp, idx) => {
                      const coresFat = ['#2563EB', '#60A5FA', '#93C5FD', '#1D4ED8']
                      const coresLucro = ['#10B981', '#34D399', '#6EE7B7', '#047857']
                      const coresMargem = ['#F59E0B', '#FBBF24', '#D97706', '#B45309']
                      return [
                        <Bar
                          key={`fat_${comp.ano}`}
                          yAxisId="left"
                          dataKey={`fat_${comp.ano}`}
                          name={`Fat. ${comp.ano}`}
                          fill={coresFat[idx % coresFat.length]}
                          radius={[3, 3, 0, 0]}
                          maxBarSize={28}
                        />,
                        <Bar
                          key={`lucro_${comp.ano}`}
                          yAxisId="left"
                          dataKey={`lucro_${comp.ano}`}
                          name={`Lucro ${comp.ano}`}
                          fill={coresLucro[idx % coresLucro.length]}
                          radius={[3, 3, 0, 0]}
                          maxBarSize={28}
                        />,
                        <Line
                          key={`margem_${comp.ano}`}
                          yAxisId="right"
                          type="monotone"
                          dataKey={`margem_${comp.ano}`}
                          name={`Margem ${comp.ano} (%)`}
                          stroke={coresMargem[idx % coresMargem.length]}
                          strokeWidth={2}
                          dot={{ r: 3 }}
                        />,
                      ]
                    })}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Cards de Resumo Comparativo Lado a Lado com Variações YoY */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {comparativoAnos.map((comp) => {
              const res = comp.resultado
              const varAnt = comp.variacoes
              return (
                <Card
                  key={comp.ano}
                  className={`bg-white dark:bg-slate-900 border shadow-xs relative overflow-hidden ${
                    comp.ano === anoInicial
                      ? 'border-blue-300 dark:border-blue-700 ring-1 ring-blue-400/30'
                      : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div
                    className={`absolute top-0 left-0 right-0 h-1 ${
                      comp.ano === anoInicial ? 'bg-blue-600' : 'bg-slate-400 dark:bg-slate-600'
                    }`}
                  />
                  <CardHeader className="py-3 px-4 pb-2 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-sm text-[#0B1F3A] dark:text-slate-100">
                          Exercício {comp.ano}
                        </span>
                        {comp.ano === anoInicial && (
                          <Badge
                            variant="outline"
                            className="text-[10px] bg-blue-50 text-blue-700 border-blue-300"
                          >
                            Ano Base
                          </Badge>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-500">{meses.length} mês(es)</span>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 space-y-2.5 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Faturamento:</span>
                      <div className="text-right">
                        <span className="font-bold text-[#0B1F3A] dark:text-slate-100 tabular-nums">
                          {formatBrl(res.faturamentoTotal)}
                        </span>
                        {varAnt && (
                          <div
                            className={`text-[10px] font-semibold tabular-nums ${
                              varAnt.faturamento.favoravel ? 'text-emerald-600' : 'text-red-500'
                            }`}
                          >
                            {varAnt.faturamento.deltaPercentual !== null
                              ? `${varAnt.faturamento.deltaPercentual >= 0 ? '+' : ''}${varAnt.faturamento.deltaPercentual.toFixed(1)}% vs ${varAnt.faturamento.anoAnterior}`
                              : '—'}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Lucro Apurado:</span>
                      <div className="text-right">
                        <span
                          className={`font-bold tabular-nums ${
                            res.lucroTotal >= 0 ? 'text-emerald-600' : 'text-red-600'
                          }`}
                        >
                          {formatBrl(res.lucroTotal)}
                        </span>
                        {varAnt && (
                          <div
                            className={`text-[10px] font-semibold tabular-nums ${
                              varAnt.lucroApurado.favoravel ? 'text-emerald-600' : 'text-red-500'
                            }`}
                          >
                            {varAnt.lucroApurado.deltaPercentual !== null
                              ? `${varAnt.lucroApurado.deltaPercentual >= 0 ? '+' : ''}${varAnt.lucroApurado.deltaPercentual.toFixed(1)}% vs ${varAnt.lucroApurado.anoAnterior}`
                              : '—'}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Despesas Financeiras:</span>
                      <span className="font-semibold text-amber-800 dark:text-amber-300 tabular-nums">
                        {formatBrl(res.despesasFinanceirasTotal)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-800">
                      <span className="text-slate-500 font-medium">Margem Líquida:</span>
                      <div className="text-right">
                        <span
                          className={`font-extrabold px-2 py-0.5 rounded text-[11px] ${getMargemBadgeColor(
                            res.margemSobreFaturamentoTotal,
                          )}`}
                        >
                          {formatPercent(res.margemSobreFaturamentoTotal)}
                        </span>
                        {varAnt && varAnt.margemSobreFaturamento.deltaPontos !== null && (
                          <div
                            className={`text-[10px] font-semibold mt-0.5 tabular-nums ${
                              varAnt.margemSobreFaturamento.favoravel
                                ? 'text-emerald-600'
                                : 'text-red-500'
                            }`}
                          >
                            {varAnt.margemSobreFaturamento.deltaPontos >= 0 ? '+' : ''}
                            {varAnt.margemSobreFaturamento.deltaPontos.toFixed(1)} p.p. vs{' '}
                            {varAnt.margemSobreFaturamento.anoAnterior}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Tabela Comparativa Lado a Lado (Mês a Mês) */}
          <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs">
            <CardHeader className="py-3 px-4 sm:px-6 flex flex-row items-center justify-between border-b border-slate-100 dark:border-slate-800">
              <div>
                <CardTitle className="text-sm font-bold text-[#0B1F3A] dark:text-slate-100">
                  Tabela Comparativa Multi-Ano: Mês a Mês Lado a Lado
                </CardTitle>
                <CardDescription className="text-xs text-slate-500 dark:text-slate-400">
                  Meses idênticos comparados entre os exercícios selecionados
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <DoubleHorizontalScroll>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                        <th className="py-3 px-4 text-left">Mês</th>
                        {comparativoAnos.map((c) => (
                          <th key={`cli_h_fat_${c.ano}`} className="py-3 px-3 text-right">
                            Fat. {c.ano}
                          </th>
                        ))}
                        {comparativoAnos.map((c) => (
                          <th key={`cli_h_luc_${c.ano}`} className="py-3 px-3 text-right">
                            Lucro {c.ano}
                          </th>
                        ))}
                        {comparativoAnos.map((c) => (
                          <th key={`cli_h_mg_${c.ano}`} className="py-3 px-3 text-right">
                            Margem {c.ano}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {meses.map((mes, idx) => (
                        <tr
                          key={mes.chave}
                          className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                        >
                          <td className="py-2.5 px-4 font-semibold text-[#0B1F3A] dark:text-slate-100">
                            {mes.rotuloCompleto}
                          </td>
                          {comparativoAnos.map((c) => (
                            <td
                              key={`cli_v_fat_${c.ano}_${idx}`}
                              className="py-2.5 px-3 text-right tabular-nums text-slate-800 dark:text-slate-200 font-medium"
                            >
                              {formatBrl(c.resultado.itensPorMes[idx]?.faturamento || 0)}
                            </td>
                          ))}
                          {comparativoAnos.map((c) => {
                            const valLucro = c.resultado.itensPorMes[idx]?.lucroApurado || 0
                            return (
                              <td
                                key={`cli_v_luc_${c.ano}_${idx}`}
                                className={`py-2.5 px-3 text-right tabular-nums font-bold ${
                                  valLucro >= 0
                                    ? 'text-emerald-700 dark:text-emerald-400'
                                    : 'text-red-600 dark:text-red-400'
                                }`}
                              >
                                {formatBrl(valLucro)}
                              </td>
                            )
                          })}
                          {comparativoAnos.map((c) => {
                            const mg = c.resultado.itensPorMes[idx]?.margemSobreFaturamento
                            return (
                              <td
                                key={`cli_v_mg_${c.ano}_${idx}`}
                                className="py-2.5 px-3 text-right tabular-nums"
                              >
                                <span
                                  className={`inline-block font-bold px-2 py-0.5 rounded-full text-[10.5px] ${getMargemBadgeColor(mg ?? null)}`}
                                >
                                  {formatPercent(mg ?? null)}
                                </span>
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-100/90 dark:bg-slate-800/90 border-t-2 border-slate-300 dark:border-slate-700 font-bold text-[11.5px] text-[#0B1F3A] dark:text-slate-100">
                        <td className="py-3 px-4 uppercase tracking-wider">TOTAL DO PERÍODO</td>
                        {comparativoAnos.map((c) => (
                          <td
                            key={`cli_tot_fat_${c.ano}`}
                            className="py-3 px-3 text-right tabular-nums font-extrabold text-blue-700 dark:text-blue-300"
                          >
                            {formatBrl(c.resultado.faturamentoTotal)}
                          </td>
                        ))}
                        {comparativoAnos.map((c) => (
                          <td
                            key={`cli_tot_luc_${c.ano}`}
                            className={`py-3 px-3 text-right tabular-nums font-extrabold ${
                              c.resultado.lucroTotal >= 0
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : 'text-red-600 dark:text-red-400'
                            }`}
                          >
                            {formatBrl(c.resultado.lucroTotal)}
                          </td>
                        ))}
                        {comparativoAnos.map((c) => (
                          <td
                            key={`cli_tot_mg_${c.ano}`}
                            className="py-3 px-3 text-right tabular-nums font-extrabold"
                          >
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] ${getMargemBadgeColor(c.resultado.margemSobreFaturamentoTotal)}`}
                            >
                              {formatPercent(c.resultado.margemSobreFaturamentoTotal)}
                            </span>
                          </td>
                        ))}
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </DoubleHorizontalScroll>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Gráfico Principal de Evolução no Período */}
      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs print:border-slate-300">
        <CardHeader className="py-3 px-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1 rounded-md bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 print:hidden">
                <TrendingUp className="w-4 h-4" />
              </span>
              <CardTitle className="text-sm font-bold text-[#0B1F3A] dark:text-slate-100">
                Evolução Mensal: Faturamento vs Lucro Apurado
              </CardTitle>
            </div>
            <CardDescription className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Barras de faturamento e lucro mês a mês com curva de margem percentual no eixo
              secundário
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
              Faturamento × Lucro
            </Button>
            <Button
              type="button"
              variant={tipoVisualizacaoGrafico === 'linhas_margem' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTipoVisualizacaoGrafico('linhas_margem')}
              className="h-7 text-xs font-semibold cursor-pointer"
            >
              Curvas de Margens (%)
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
                    stroke="#F59E0B"
                    fontSize={11}
                    tickFormatter={(v) => `${v}%`}
                    tickLine={false}
                    axisLine={{ stroke: '#F59E0B' }}
                  />
                  <ReferenceLine yAxisId="left" y={0} stroke="#94A3B8" strokeWidth={1} />
                  <ReferenceLine
                    yAxisId="right"
                    y={0}
                    stroke="#F59E0B"
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
                            <div className="flex items-center justify-between gap-3">
                              <span className="flex items-center gap-1.5 text-emerald-300">
                                <span className="w-2.5 h-2.5 rounded-xs bg-[#10B981]" />
                                Lucro Apurado:
                              </span>
                              <strong
                                className={`font-semibold tabular-nums ${
                                  d.lucroApurado >= 0 ? 'text-emerald-300' : 'text-red-300'
                                }`}
                              >
                                {formatBrl(d.lucroApurado)}
                              </strong>
                            </div>
                            <div className="flex items-center justify-between gap-3 pt-1 border-t border-white/10">
                              <span className="flex items-center gap-1.5 text-amber-300">
                                <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]" />
                                Margem Líquida:
                              </span>
                              <strong className="font-bold tabular-nums text-amber-300">
                                {formatPercent(d.margemSobreFaturamento)}
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
                    yAxisId="left"
                    dataKey="faturamento"
                    name="Faturamento (Receitas)"
                    fill="#2563EB"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={38}
                  />
                  <Bar
                    yAxisId="left"
                    dataKey="lucroApurado"
                    name="Lucro Apurado"
                    fill="#10B981"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={38}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="margemSobreFaturamento"
                    name="Margem s/ Faturamento (%)"
                    stroke="#F59E0B"
                    strokeWidth={2.5}
                    dot={{ fill: '#F59E0B', r: 4 }}
                    activeDot={{ r: 6, fill: '#D97706' }}
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
                    tickFormatter={(v) => `${v}%`}
                    tickLine={false}
                    axisLine={{ stroke: '#CBD5E1' }}
                  />
                  <ReferenceLine y={0} stroke="#94A3B8" strokeWidth={1} />
                  <RechartsTooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null
                      const d = payload[0].payload
                      return (
                        <div className="bg-[#0B1F3A] text-white p-3 rounded-xl shadow-xl border border-slate-700 text-xs min-w-[210px]">
                          <p className="font-bold border-b border-white/10 pb-1.5 text-blue-200">
                            {d.mesCompleto}
                          </p>
                          <div className="space-y-1.5 mt-2">
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-purple-300">Margem Bruta:</span>
                              <strong className="font-semibold tabular-nums text-purple-300">
                                {formatPercent(d.margemBruta)}
                              </strong>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-teal-300">Margem Operacional:</span>
                              <strong className="font-semibold tabular-nums text-teal-300">
                                {formatPercent(d.margemOperacional)}
                              </strong>
                            </div>
                            <div className="flex items-center justify-between gap-3 pt-1 border-t border-white/10">
                              <span className="text-amber-300">Margem Líquida:</span>
                              <strong className="font-bold tabular-nums text-amber-300">
                                {formatPercent(d.margemSobreFaturamento)}
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
                  <Line
                    type="monotone"
                    dataKey="margemBruta"
                    name="Margem Bruta (%)"
                    stroke="#8B5CF6"
                    strokeWidth={2}
                    dot={{ fill: '#8B5CF6', r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="margemOperacional"
                    name="Margem Operacional (%)"
                    stroke="#0D9488"
                    strokeWidth={2}
                    dot={{ fill: '#0D9488', r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="margemSobreFaturamento"
                    name="Margem Líquida s/ Fat. (%)"
                    stroke="#F59E0B"
                    strokeWidth={2.5}
                    dot={{ fill: '#F59E0B', r: 4 }}
                  />
                </ComposedChart>
              )}
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Tabela Mensal Simplificada (mês, faturamento, lucro, margem % com totais no rodapé) */}
      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs print:border-slate-300">
        <CardHeader className="py-3 px-4 sm:px-6 flex flex-row items-center justify-between border-b border-slate-100 dark:border-slate-800">
          <div>
            <CardTitle className="text-sm font-bold text-[#0B1F3A] dark:text-slate-100">
              Demonstração Mensal Simplificada ({periodoDescricao})
            </CardTitle>
            <CardDescription className="text-xs text-slate-500 dark:text-slate-400">
              Acompanhamento mensal de faturamento, lucro apurado e margem sobre faturamento
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
                  <th className="py-3 px-4 text-right">Faturamento (R$)</th>
                  <th className="py-3 px-4 text-right text-amber-800 dark:text-amber-300 print:text-black">
                    Desp. Fin. (R$)
                  </th>
                  <th className="py-3 px-4 text-right">Lucro Apurado (R$)</th>
                  <th className="py-3 px-4 text-right">Margem s/ Faturamento (%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 print:divide-slate-200">
                {analise.itensPorMes.map((item) => (
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
                    <td className="py-2.5 px-4 text-right text-amber-900 dark:text-amber-200 tabular-nums font-medium print:text-black">
                      {formatBrl(item.despesasFinanceiras)}
                    </td>
                    <td
                      className={`py-2.5 px-4 text-right font-bold tabular-nums ${
                        item.lucroApurado >= 0
                          ? 'text-emerald-700 dark:text-emerald-400 print:text-emerald-800'
                          : 'text-red-600 dark:text-red-400 print:text-red-700'
                      }`}
                    >
                      {formatBrl(item.lucroApurado)}
                    </td>
                    <td className="py-2.5 px-4 text-right tabular-nums">
                      <span
                        className={`inline-block font-bold px-2.5 py-0.5 rounded-full text-[11px] ${getMargemBadgeColor(
                          item.margemSobreFaturamento,
                        )}`}
                      >
                        {formatPercent(item.margemSobreFaturamento)}
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
                    {formatBrl(analise.faturamentoTotal)}
                  </td>
                  <td className="py-3 px-4 text-right tabular-nums font-extrabold text-amber-900 dark:text-amber-200 print:text-black">
                    {formatBrl(analise.despesasFinanceirasTotal)}
                  </td>
                  <td
                    className={`py-3 px-4 text-right tabular-nums font-extrabold ${
                      analise.lucroTotal >= 0
                        ? 'text-emerald-700 dark:text-emerald-400 print:text-emerald-900'
                        : 'text-red-600 dark:text-red-400 print:text-red-900'
                    }`}
                  >
                    {formatBrl(analise.lucroTotal)}
                  </td>
                  <td className="py-3 px-4 text-right tabular-nums">
                    <span
                      className={`inline-block font-extrabold px-3 py-0.5 rounded-full text-xs ${getMargemBadgeColor(
                        analise.margemSobreFaturamentoTotal,
                      )}`}
                    >
                      {formatPercent(analise.margemSobreFaturamentoTotal)}
                    </span>
                  </td>
                </tr>
              </tfoot>{' '}
            </table>
          </div>
        </CardContent>
      </Card>

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
