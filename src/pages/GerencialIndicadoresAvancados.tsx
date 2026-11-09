import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useFilter } from '@/contexts/FilterContext'
import { useToast } from '@/hooks/use-toast'
import { useRealtime } from '@/hooks/use-realtime'
import {
  balancosService,
  dreService,
  lancamentosService,
  contasService,
  planoContasService,
} from '@/services/financeService'
import type { BalancoRecord, DreRecord } from '@/types/finance'
import {
  calcularIndicadoresAvancados,
  ROTULO_CLASSIFICACAO_COBERTURA,
  DESCRICAO_CLASSIFICACAO_COBERTURA,
  type IndicadoresAvancadosResultado,
} from '@/lib/indicadoresAvancadosCalculo'
import {
  exportarIndicadoresAvancadosExcel,
  exportarIndicadoresAvancadosCsv,
} from '@/lib/indicadoresAvancadosExport'
import { DocumentPrintFooter } from '@/components/DocumentPrintFooter'
import { BorlimLogo } from '@/components/BorlimLogo'
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
  ArrowLeft,
  Calendar,
  Printer,
  Download,
  Sparkles,
  FileSpreadsheet,
  AlertTriangle,
  Info,
  Layers,
  Clock,
  TrendingUp,
  Percent,
  ShieldCheck,
  CheckCircle2,
  DollarSign,
  PieChart,
} from 'lucide-react'
import { gerarListaMeses } from '@/lib/dreGerencialTypes'
import { calcularAnaliseRentabilidade } from '@/lib/analiseRentabilidadeCalculo'

function formatNumero(valor: number | null, decimais = 2): string {
  if (valor === null || !Number.isFinite(valor)) return '—'
  return valor.toLocaleString('pt-BR', {
    minimumFractionDigits: decimais,
    maximumFractionDigits: decimais,
  })
}

function formatPercent(valor: number | null, decimais = 2): string {
  if (valor === null || !Number.isFinite(valor)) return '—'
  return `${valor.toLocaleString('pt-BR', {
    minimumFractionDigits: decimais,
    maximumFractionDigits: decimais,
  })}%`
}

function formatMoeda(valor: number | null): string {
  if (valor === null || !Number.isFinite(valor)) return '—'
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function GerencialIndicadoresAvancados() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { user } = useAuth()
  const {
    selectedEmpresaId,
    selectedEmpresa,
    selectedAno,
    isGrupoAtivo,
    grupoAtivo,
    empresasIdsAtivas,
    anosDisponiveis,
  } = useFilter()

  const [loading, setLoading] = useState(true)
  const [balanco, setBalanco] = useState<BalancoRecord | null>(null)
  const [dre, setDre] = useState<DreRecord | null>(null)

  // Premissas customizáveis pelo usuário
  const [custoCapitalWacc, setCustoCapitalWacc] = useState<number>(12.0) // 12% a.a.
  const [aliquotaIrEfetiva, setAliquotaIrEfetiva] = useState<number>(15.0) // 15% Simples/LP

  const currentYear = selectedAno || new Date().getFullYear()
  const [anoInicial, setAnoInicial] = useState<number>(currentYear)

  useEffect(() => {
    if (selectedAno) {
      setAnoInicial(selectedAno)
    }
  }, [selectedAno])

  const isGrupoSelecionado = Boolean(selectedEmpresaId && selectedEmpresaId.startsWith('grupo-'))

  const empresaIdAlvo =
    selectedEmpresaId && !selectedEmpresaId.startsWith('grupo-')
      ? selectedEmpresaId
      : selectedEmpresa?.id || null

  const nomeEntidade = useMemo(() => {
    if (isGrupoAtivo && grupoAtivo) {
      return `Grupo: ${grupoAtivo.nome}`
    }
    return selectedEmpresa?.nome || selectedEmpresa?.nome_fantasia || 'Empresa Ativa'
  }, [isGrupoAtivo, grupoAtivo, selectedEmpresa])

  const carregarDados = async () => {
    try {
      setLoading(true)

      const extrairSomaBalanco = (b: BalancoRecord): number => {
        return (
          (b.caixa_equivalentes || 0) +
          (b.aplicacoes_financeiras || 0) +
          (b.contas_receber || 0) +
          (b.estoques || 0) +
          (b.impostos_recuperar || 0) +
          (b.outros_ativo_circulante || 0) +
          (b.realizavel_longo_prazo || 0) +
          (b.investimentos || 0) +
          (b.imobilizado || 0) +
          (b.intangivel || 0) +
          (b.fornecedores || 0) +
          (b.emprestimos_curto_prazo || 0) +
          (b.obrigacoes_trabalhistas || 0) +
          (b.obrigacoes_tributarias || 0) +
          (b.outros_passivo_circulante || 0) +
          (b.emprestimos_longo_prazo || 0) +
          (b.outras_obrigacoes_longo_prazo || 0) +
          (b.capital_social || 0) +
          (b.reservas_lucros || 0) +
          (b.lucros_acumulados || 0)
        )
      }

      const selecionarMelhorBalanco = (list: BalancoRecord[]): BalancoRecord | null => {
        const doAno = list.filter((b) => Number(b.ano) === Number(anoInicial))
        const comDados = doAno.filter((b) => extrairSomaBalanco(b) > 0)
        if (comDados.length === 0) return null
        comDados.sort((a, b) => Number(b.mes ?? 12) - Number(a.mes ?? 12))
        return comDados[0]
      }

      const selecionarMelhorDre = (list: DreRecord[]): DreRecord | null => {
        const doAno = list.filter((d) => Number(d.ano) === Number(anoInicial))
        if (doAno.length === 0) return null
        const consolidado = doAno.find((d) => d.mes === 12 || !d.mes)
        if (consolidado) return consolidado
        doAno.sort((a, b) => Number(b.mes ?? 0) - Number(a.mes ?? 0))
        return doAno[0]
      }

      let balancoPromise: Promise<BalancoRecord | null>
      let drePromise: Promise<DreRecord | null>

      if (isGrupoSelecionado && selectedEmpresaId) {
        balancoPromise = balancosService
          .getByEmpresa(selectedEmpresaId)
          .then((list) => selecionarMelhorBalanco(list))
          .catch(() => null)
        drePromise = dreService
          .getByEmpresa(selectedEmpresaId)
          .then((list) => selecionarMelhorDre(list))
          .catch(() => null)
      } else if (empresaIdAlvo) {
        balancoPromise = balancosService
          .getByEmpresa(empresaIdAlvo)
          .then((list) => selecionarMelhorBalanco(list))
          .catch(() => null)
        drePromise = dreService
          .getByEmpresa(empresaIdAlvo)
          .then((list) => selecionarMelhorDre(list))
          .catch(() => null)
      } else if (empresasIdsAtivas.length > 0) {
        balancoPromise = balancosService
          .getAll()
          .then((allList) => {
            const listAtivas = allList.filter((b) => empresasIdsAtivas.includes(b.empresa))
            return selecionarMelhorBalanco(listAtivas)
          })
          .catch(() => null)
        drePromise = dreService
          .getAll()
          .then((allList) => {
            const listAtivas = allList.filter((d) => empresasIdsAtivas.includes(d.empresa))
            return selecionarMelhorDre(listAtivas)
          })
          .catch(() => null)
      } else {
        balancoPromise = Promise.resolve(null)
        drePromise = Promise.resolve(null)
      }

      const [balancoItem, dreItem] = await Promise.all([balancoPromise, drePromise])

      // Fallback sintético DRE
      if (!dreItem && empresaIdAlvo) {
        try {
          const [lancs, contas, planos] = await Promise.all([
            lancamentosService.getAll({ empresaId: empresaIdAlvo }),
            contasService.getAll({ empresaId: empresaIdAlvo }),
            planoContasService.getAll({ empresaId: empresaIdAlvo }),
          ])
          const meses = gerarListaMeses(anoInicial, 1, 12)
          const rent = calcularAnaliseRentabilidade(lancs, contas, meses, planos)
          if (
            rent.faturamentoTotal > 0 ||
            rent.despesasFixasTotal > 0 ||
            rent.despesasVariaveisTotal > 0 ||
            rent.lucroTotal !== 0
          ) {
            const sintetico: DreRecord = {
              id: `sintetico-${anoInicial}`,
              collectionId: 'dres',
              collectionName: 'dres',
              created: new Date().toISOString(),
              updated: new Date().toISOString(),
              empresa: empresaIdAlvo,
              ano: anoInicial,
              mes: 12,
              receita_bruta: rent.faturamentoTotal,
              deducoes_receita: 0,
              custo_mercadorias: rent.despesasVariaveisTotal,
              despesas_operacionais: rent.despesasFixasTotal,
              despesas_financeiras: rent.despesasFinanceirasTotal,
              outras_receitas_despesas: rent.receitasFinanceirasTotal,
              imposto_renda: 0,
            }
            setDre(sintetico)
            setBalanco(balancoItem)
            return
          }
        } catch {
          // ignora fallback se falhar
        }
      }

      setBalanco(balancoItem)
      setDre(dreItem)
    } catch (err) {
      console.error('Erro ao carregar dados dos Indicadores Avançados:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar dados',
        description: 'Não foi possível carregar os demonstrativos para os Indicadores Avançados.',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarDados()
  }, [empresaIdAlvo, anoInicial, empresasIdsAtivas, isGrupoSelecionado, selectedEmpresaId])

  useRealtime('balancos', () => carregarDados())
  useRealtime('dres', () => carregarDados())
  useRealtime('lancamentos', () => carregarDados())

  const resultado = useMemo<IndicadoresAvancadosResultado>(() => {
    return calcularIndicadoresAvancados(balanco, dre, custoCapitalWacc)
  }, [balanco, dre, custoCapitalWacc])

  const handleExportarExcel = () => {
    exportarIndicadoresAvancadosExcel(resultado, selectedEmpresa, anoInicial)
    toast({
      title: 'Planilha exportada com sucesso',
      description: 'O relatório de Indicadores Econômicos Avançados foi gerado.',
    })
  }

  const handleExportarCsv = () => {
    exportarIndicadoresAvancadosCsv(resultado, selectedEmpresa, anoInicial)
    toast({
      title: 'CSV exportado',
      description: 'O arquivo com os indicadores avançados foi gerado com sucesso.',
    })
  }

  const handleImprimir = () => {
    window.print()
  }

  const coresCobertura = {
    confortavel: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
    adequada: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30',
    apertada: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
    critica: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
  }

  return (
    <div className="space-y-6 pb-10 animate-fadeIn print:p-0 print:m-0 print:bg-white print:text-black">
      {/* Banner Superior Executivo Borlim */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#0B1F3A] via-[#0E284E] to-[#143A6E] border border-blue-900/40 p-6 sm:p-7 text-white shadow-xl shadow-slate-900/10 print:hidden">
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />

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
              <Badge className="bg-sky-500/20 text-sky-200 border-sky-400/30 text-xs font-semibold px-2.5 py-0.5 backdrop-blur-md">
                <Layers className="w-3 h-3 mr-1 text-sky-300" />
                Indicadores Avançados
              </Badge>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2.5">
              <span>Indicadores Econômicos Avançados</span>
            </h1>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Métricas executivas de alto nível: EVA® (Valor Econômico Agregado), Decomposição
              DuPont (ROE = Margem × Giro × Alavancagem), Ciclo de Conversão de Caixa (CCC) e
              Cobertura de Juros.
            </p>
          </div>

          {/* Controles de Período e Exportação */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0 bg-white/5 border border-white/15 p-3 rounded-2xl backdrop-blur-md">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-sky-300" />
              <Select
                value={String(anoInicial)}
                onValueChange={(val) => setAnoInicial(Number(val))}
              >
                <SelectTrigger className="h-8 w-24 bg-white/10 border-white/20 text-xs text-white">
                  <SelectValue placeholder="Ano" />
                </SelectTrigger>
                <SelectContent className="bg-[#0B1F3A] border-slate-700 text-white">
                  {(anosDisponiveis || [anoInicial, anoInicial - 1]).map((ano) => (
                    <SelectItem key={ano} value={String(ano)} className="text-xs">
                      {ano}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-1.5 border-t sm:border-t-0 sm:border-l border-white/15 pt-2 sm:pt-0 sm:pl-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleExportarExcel}
                className="h-8 px-2.5 text-xs bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-200 border-emerald-400/30 gap-1.5 cursor-pointer"
                title="Exportar Excel"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">Excel</span>
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={handleExportarCsv}
                className="h-8 px-2.5 text-xs bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-200 border-cyan-400/30 gap-1.5 cursor-pointer"
                title="Exportar CSV"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">CSV</span>
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={handleImprimir}
                className="h-8 px-2.5 text-xs bg-white/10 hover:bg-white/20 text-white border-white/20 gap-1.5 cursor-pointer"
                title="Imprimir Relatório A4"
              >
                <Printer className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">PDF/A4</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Banner de Impressão A4 */}
      <div className="hidden print:block mb-6 border-b-2 border-slate-900 pb-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-slate-900 uppercase tracking-tight">
              Indicadores Econômicos Avançados — Relatório Executivo
            </h1>
            <p className="text-xs text-slate-600 mt-0.5">
              Empresa: <strong>{nomeEntidade}</strong> | Exercício: <strong>{anoInicial}</strong>
            </p>
          </div>
          <BorlimLogo size="sm" variant="dark" />
        </div>
      </div>

      {/* Alerta de ausência de demonstrativos */}
      {!resultado.resumo.temDados && (
        <Card className="bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <div className="text-xs sm:text-sm">
              <strong>Demonstrativos Incompletos:</strong> Balanço e/ou DRE não encontrados com
              valores suficientes para o exercício {anoInicial}. Os cálculos exibem estimativas
              parciais.
            </div>
          </CardContent>
        </Card>
      )}

      {/* Barra de Premissas Ajustáveis para EVA e WACC */}
      <Card className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs print:hidden">
        <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-sky-500 shrink-0" />
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Premissas de Custo de Capital:
            </span>
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <label htmlFor="input-wacc" className="text-xs text-slate-500 font-medium">
                WACC (Custo de Capital):
              </label>
              <div className="flex items-center gap-1">
                <input
                  id="input-wacc"
                  type="number"
                  step="0.5"
                  min="1"
                  max="50"
                  value={custoCapitalWacc}
                  onChange={(e) => setCustoCapitalWacc(Number(e.target.value) || 0)}
                  className="w-16 h-8 text-xs font-mono font-bold text-right rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2"
                />
                <span className="text-xs text-slate-400">% a.a.</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="input-ir" className="text-xs text-slate-500 font-medium">
                IR/CSLL Efetivo:
              </label>
              <div className="flex items-center gap-1">
                <input
                  id="input-ir"
                  type="number"
                  step="1"
                  min="0"
                  max="40"
                  value={aliquotaIrEfetiva}
                  onChange={(e) => setAliquotaIrEfetiva(Number(e.target.value) || 0)}
                  className="w-16 h-8 text-xs font-mono font-bold text-right rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2"
                />
                <span className="text-xs text-slate-400">%</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* BLOCO 1: CARD EVA® — ECONOMIC VALUE ADDED */}
      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-md overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-blue-900/10 via-sky-500/5 to-transparent pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Badge className="bg-blue-600 text-white font-mono text-[10px]">EVA®</Badge>
                <CardTitle className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                  Economic Value Added (Valor Econômico Agregado)
                </CardTitle>
              </div>
              <CardDescription className="text-xs text-slate-500 mt-1">
                EVA = NOPAT - (Capital Investido × WACC). Mede se o retorno operacional remunera o
                custo de oportunidade do capital.
              </CardDescription>
            </div>

            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">
                Resultado EVA
              </span>
              <span
                className={`text-2xl sm:text-3xl font-black font-mono tracking-tight ${
                  (resultado.eva.eva || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'
                }`}
              >
                {formatMoeda(resultado.eva.eva)}
              </span>
              <Badge
                className={`text-[11px] font-bold mt-1 ${
                  (resultado.eva.eva || 0) >= 0
                    ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                    : 'bg-rose-500/20 text-rose-700 dark:text-rose-300'
                }`}
              >
                {(resultado.eva.eva || 0) >= 0
                  ? 'Criação de Valor Real'
                  : 'Destruição de Valor Econômico'}
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                NOPAT (Lucro Oper. Líq.)
              </span>
              <span className="text-sm font-extrabold text-slate-900 dark:text-slate-100 mt-1 block">
                {formatMoeda(resultado.eva.nopat)}
              </span>
              <span className="text-[10.5px] text-slate-400 block mt-0.5">
                EBIT - IR Efetivo ({aliquotaIrEfetiva}%)
              </span>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                Capital Investido
              </span>
              <span className="text-sm font-extrabold text-slate-900 dark:text-slate-100 mt-1 block">
                {formatMoeda(resultado.eva.capitalInvestido)}
              </span>
              <span className="text-[10.5px] text-slate-400 block mt-0.5">PL + Dívidas LP</span>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                Custo de Capital (R$)
              </span>
              <span className="text-sm font-extrabold text-slate-900 dark:text-slate-100 mt-1 block">
                {formatMoeda(resultado.eva.custoCapital)}
              </span>
              <span className="text-[10.5px] text-slate-400 block mt-0.5">
                {custoCapitalWacc}% a.a. sobre capital
              </span>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                Margem EVA
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-sm font-extrabold text-sky-600 dark:text-sky-400">
                  {formatPercent(resultado.eva.margemEva)}
                </span>
              </div>
              <span className="text-[10.5px] text-slate-400 block mt-0.5">
                EVA / Receita Líquida
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* BLOCO 2: DECOMPOSIÇÃO DUPONT (ROE & ROA) */}
      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-md">
        <CardHeader className="bg-gradient-to-r from-emerald-900/10 via-teal-500/5 to-transparent pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Badge className="bg-emerald-600 text-white font-mono text-[10px]">DuPont</Badge>
                <CardTitle className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                  Análise DuPont de 3 Fatores (Decomposição do ROE)
                </CardTitle>
              </div>
              <CardDescription className="text-xs text-slate-500 mt-1">
                ROE = Margem Líquida × Giro do Ativo × Multiplicador de Alavancagem Financeira
              </CardDescription>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  ROA (Ativo)
                </span>
                <span className="text-lg font-black text-teal-600 dark:text-teal-400 font-mono">
                  {formatPercent(resultado.dupont.roa)}
                </span>
              </div>
              <div className="text-right border-l border-slate-200 dark:border-slate-700 pl-4">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  ROE (PL)
                </span>
                <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                  {formatPercent(resultado.dupont.roe)}
                </span>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Fator 1: Margem Líquida */}
            <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 relative">
              <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                1. Eficiência Operacional
              </span>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                Margem Líquida
              </h3>
              <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                Lucro Líquido / Receita Líquida
              </p>
              <div className="mt-3">
                <span className="text-2xl font-black text-slate-900 dark:text-slate-100 font-mono">
                  {formatPercent(resultado.dupont.margemLiquida)}
                </span>
              </div>
            </div>

            {/* Fator 2: Giro do Ativo */}
            <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 relative">
              <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                2. Eficiência de Ativos
              </span>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                Giro do Ativo
              </h3>
              <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                Receita Líquida / Ativo Total
              </p>
              <div className="mt-3">
                <span className="text-2xl font-black text-slate-900 dark:text-slate-100 font-mono">
                  {formatNumero(resultado.dupont.giroAtivo, 2)}x
                </span>
              </div>
            </div>

            {/* Fator 3: Alavancagem */}
            <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 relative">
              <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                3. Alavancagem Financeira
              </span>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                Multiplicador de Alavancagem
              </h3>
              <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                Ativo Total / Patrimônio Líquido
              </p>
              <div className="mt-3">
                <span className="text-2xl font-black text-slate-900 dark:text-slate-100 font-mono">
                  {formatNumero(resultado.dupont.alavancagemFinanceira, 2)}x
                </span>
              </div>
            </div>
          </div>

          <div className="bg-emerald-50/50 dark:bg-emerald-950/20 p-3 rounded-xl border border-emerald-200 dark:border-emerald-800/50 flex items-center gap-2 text-xs text-emerald-900 dark:text-emerald-200">
            <Info className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              <strong>Identidade DuPont:</strong> Margem (
              {formatPercent(resultado.dupont.margemLiquida)}) × Giro (
              {formatNumero(resultado.dupont.giroAtivo, 2)}x) × Alavancagem (
              {formatNumero(resultado.dupont.alavancagemFinanceira, 2)}x) = ROE de{' '}
              <strong>{formatPercent(resultado.dupont.roe)}</strong>.
            </span>
          </div>
        </CardContent>
      </Card>

      {/* BLOCO 3: CICLO DE CONVERSÃO DE CAIXA (CCC / PME / PMR / PMP) */}
      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-md">
        <CardHeader className="bg-gradient-to-r from-purple-900/10 via-indigo-500/5 to-transparent pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Badge className="bg-purple-600 text-white font-mono text-[10px]">CCC</Badge>
                <CardTitle className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                  Ciclo de Conversão de Caixa (Base Comercial: 360 dias)
                </CardTitle>
              </div>
              <CardDescription className="text-xs text-slate-500 mt-1">
                CCC = PME (Estoques) + PMR (Recebimento) - PMP (Pagamento a Fornecedores).
              </CardDescription>
            </div>

            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">
                Ciclo de Caixa (CCC)
              </span>
              <span className="text-2xl sm:text-3xl font-black font-mono text-purple-600 dark:text-purple-400 tracking-tight">
                {resultado.ciclo.cicloConversaoCaixa !== null
                  ? `${Math.round(resultado.ciclo.cicloConversaoCaixa)} dias`
                  : '—'}
              </span>
              <span className="text-[11px] text-slate-400 block mt-0.5">
                Ciclo Operacional:{' '}
                {resultado.ciclo.cicloOperacional !== null
                  ? `${Math.round(resultado.ciclo.cicloOperacional)} dias`
                  : '—'}
              </span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] font-bold uppercase text-slate-400">
                PME (Prazo Médio de Estoque)
              </span>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-2xl font-black text-slate-900 dark:text-slate-100 font-mono">
                  {resultado.ciclo.pme !== null ? `${Math.round(resultado.ciclo.pme)} dias` : '—'}
                </span>
                <Clock className="w-4 h-4 text-purple-500" />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">(Estoques / Custo) × 360</p>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] font-bold uppercase text-slate-400">
                PMR (Recebimento de Vendas)
              </span>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-2xl font-black text-slate-900 dark:text-slate-100 font-mono">
                  {resultado.ciclo.pmr !== null ? `${Math.round(resultado.ciclo.pmr)} dias` : '—'}
                </span>
                <Clock className="w-4 h-4 text-sky-500" />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">(Contas a Receber / Receita) × 360</p>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] font-bold uppercase text-slate-400">
                PMP (Pagamento a Fornecedores)
              </span>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-2xl font-black text-slate-900 dark:text-slate-100 font-mono">
                  {resultado.ciclo.pmp !== null ? `${Math.round(resultado.ciclo.pmp)} dias` : '—'}
                </span>
                <Clock className="w-4 h-4 text-emerald-500" />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                (Fornecedores / Compras/Custo) × 360
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* BLOCO 4: COBERTURA DE JUROS */}
      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-md">
        <CardHeader className="bg-gradient-to-r from-amber-900/10 via-orange-500/5 to-transparent pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Badge className="bg-amber-600 text-white font-mono text-[10px]">ICJ</Badge>
                <CardTitle className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                  Índice de Cobertura de Juros (EBIT / Despesas Financeiras)
                </CardTitle>
              </div>
              <CardDescription className="text-xs text-slate-500 mt-1">
                Capacidade do lucro operacional (EBIT/EBITDA) de suportar as despesas financeiras da
                dívida.
              </CardDescription>
            </div>

            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">
                Índice de Cobertura
              </span>
              <span className="text-2xl sm:text-3xl font-black font-mono text-slate-900 dark:text-slate-100 tracking-tight">
                {resultado.cobertura.cobertura !== null
                  ? `${formatNumero(resultado.cobertura.cobertura, 2)}x`
                  : '—'}
              </span>
              <Badge
                className={`text-[11px] font-bold mt-1 border ${
                  coresCobertura[resultado.cobertura.classificacao]
                }`}
              >
                {ROTULO_CLASSIFICACAO_COBERTURA[resultado.cobertura.classificacao]}
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                EBITDA (EBIT oficial)
              </span>
              <span className="text-sm font-extrabold text-slate-900 dark:text-slate-100 mt-1 block">
                {formatMoeda(resultado.cobertura.ebit)}
              </span>
              <span className="text-[10.5px] text-slate-400 block mt-0.5">
                Paridade com Dashboard BI
              </span>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                Despesas Financeiras
              </span>
              <span className="text-sm font-extrabold text-slate-900 dark:text-slate-100 mt-1 block">
                {formatMoeda(resultado.cobertura.despesasFinanceiras)}
              </span>
              <span className="text-[10.5px] text-slate-400 block mt-0.5">
                Custo da dívida no exercício
              </span>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                Diagnóstico de Risco
              </span>
              <p className="text-xs text-slate-700 dark:text-slate-300 font-medium mt-1 leading-snug">
                {DESCRICAO_CLASSIFICACAO_COBERTURA[resultado.cobertura.classificacao]}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <DocumentPrintFooter />
    </div>
  )
}
