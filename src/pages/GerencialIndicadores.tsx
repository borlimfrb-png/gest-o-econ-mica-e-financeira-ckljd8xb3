import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useFilter } from '@/contexts/FilterContext'
import { useToast } from '@/hooks/use-toast'
import { useRealtime } from '@/hooks/use-realtime'
import {
  contasService,
  lancamentosService,
  planoContasService,
  balancosService,
} from '@/services/financeService'
import type {
  ContaRecord,
  LancamentoRecord,
  PlanoContaRecord,
  BalancoRecord,
} from '@/types/finance'
import { gerarListaMeses } from '@/lib/dreGerencialTypes'
import {
  calcularPainelIndicadoresFinanceiros,
  type PainelIndicadoresResultado,
  type ItemIndicadorFinanceiro,
} from '@/lib/indicadoresFinanceirosCalculo'
import {
  exportarIndicadoresFinanceirosExcel,
  exportarIndicadoresFinanceirosCsv,
} from '@/lib/indicadoresFinanceirosExport'
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
  Gauge,
  ArrowLeft,
  Calendar,
  Building2,
  Printer,
  Download,
  Sparkles,
  FileSpreadsheet,
  AlertTriangle,
  Info,
  CheckCircle2,
  Scale,
  TrendingUp,
  Percent,
  Clock,
  ShieldCheck,
} from 'lucide-react'

function formatValorIndicador(ind: ItemIndicadorFinanceiro): string {
  if (ind.valor === null || !Number.isFinite(ind.valor)) {
    return 'Sem dados'
  }
  if (ind.unidade === 'percentual') {
    return `${ind.valor >= 0 ? '+' : ''}${ind.valor.toFixed(2)}%`
  }
  if (ind.unidade === 'dias') {
    return `${ind.valor.toFixed(0)} dias`
  }
  return `${ind.valor.toFixed(2)}x`
}

function getBadgeStatusStyle(variant: ItemIndicadorFinanceiro['badgeVariant']) {
  switch (variant) {
    case 'emerald':
      return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
    case 'blue':
      return 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30'
    case 'amber':
      return 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
    case 'rose':
      return 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30'
    default:
      return 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30'
  }
}

export default function GerencialIndicadores() {
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
  const [lancamentos, setLancamentos] = useState<LancamentoRecord[]>([])
  const [contas, setContas] = useState<ContaRecord[]>([])
  const [planoContas, setPlanoContas] = useState<PlanoContaRecord[]>([])
  const [balanco, setBalanco] = useState<BalancoRecord | null>(null)

  const currentYear = selectedAno || new Date().getFullYear()
  const [anoInicial, setAnoInicial] = useState<number>(currentYear)
  const [mesInicial, setMesInicial] = useState<number>(1)
  const [qtdMeses, setQtdMeses] = useState<number>(12)

  // Filtro de Categoria
  const [categoriaAtiva, setCategoriaAtiva] = useState<string>('Todas')

  useEffect(() => {
    if (selectedAno) {
      setAnoInicial(selectedAno)
    }
  }, [selectedAno])

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

      let lancsPromise: Promise<LancamentoRecord[]>
      let contasPromise: Promise<ContaRecord[]>
      let planosPromise: Promise<PlanoContaRecord[]>
      let balancoPromise: Promise<BalancoRecord | null>

      if (empresaIdAlvo) {
        lancsPromise = lancamentosService.getAll({
          empresaId: empresaIdAlvo,
          expandRelations: true,
        })
        contasPromise = contasService.getAll({ empresaId: empresaIdAlvo })
        planosPromise = planoContasService.getAll({ empresaId: empresaIdAlvo })
        balancoPromise = balancosService
          .getByEmpresa(empresaIdAlvo)
          .then((list) => list.find((b) => b.ano === anoInicial) || null)
          .catch(() => null)
      } else if (empresasIdsAtivas.length > 0) {
        const empOpts = { empresasIds: empresasIdsAtivas }
        lancsPromise = lancamentosService.getAll({ expandRelations: true })
        contasPromise = contasService.getAll(empOpts)
        planosPromise = planoContasService.getAll(empOpts)
        balancoPromise = Promise.resolve(null)
      } else {
        lancsPromise = Promise.resolve([])
        contasPromise = Promise.resolve([])
        planosPromise = Promise.resolve([])
        balancoPromise = Promise.resolve(null)
      }

      const [contasList, lancamentosList, planosList, balancoItem] = await Promise.all([
        contasPromise,
        lancsPromise,
        planosPromise,
        balancoPromise,
      ])

      setContas(Array.from(new Map(contasList.map((i) => [i.id, i])).values()))
      setLancamentos(lancamentosList)
      setPlanoContas(Array.from(new Map(planosList.map((i) => [i.id, i])).values()))
      setBalanco(balancoItem)
    } catch (err) {
      console.error('Erro ao carregar dados do Painel de Indicadores:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar dados',
        description: 'Não foi possível carregar os dados financeiros para apurar os indicadores.',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarDados()
  }, [empresaIdAlvo, anoInicial, empresasIdsAtivas])

  useRealtime('lancamentos', () => carregarDados())
  useRealtime('contas', () => carregarDados())
  useRealtime('plano_contas', () => carregarDados())
  useRealtime('balancos', () => carregarDados())

  const meses = useMemo(() => {
    return gerarListaMeses(anoInicial, mesInicial, qtdMeses)
  }, [anoInicial, mesInicial, qtdMeses])

  const painelResultado = useMemo<PainelIndicadoresResultado>(() => {
    return calcularPainelIndicadoresFinanceiros({
      balanco,
      lancamentos,
      contas,
      meses,
      planoContas,
      ano: anoInicial,
    })
  }, [balanco, lancamentos, contas, meses, planoContas, anoInicial])

  const indicadoresFiltrados = useMemo(() => {
    if (categoriaAtiva === 'Todas') {
      return painelResultado.indicadores
    }
    return painelResultado.indicadores.filter((ind) => ind.categoria === categoriaAtiva)
  }, [painelResultado.indicadores, categoriaAtiva])

  const handleExportarExcel = () => {
    exportarIndicadoresFinanceirosExcel(painelResultado, selectedEmpresa, anoInicial)
    toast({
      title: 'Planilha exportada com sucesso',
      description: 'O relatório de indicadores financeiros em Excel foi gerado.',
    })
  }

  const handleExportarCsv = () => {
    exportarIndicadoresFinanceirosCsv(painelResultado, selectedEmpresa, anoInicial)
    toast({
      title: 'Arquivo CSV gerado',
      description: 'O arquivo com os indicadores financeiros foi baixado.',
    })
  }

  const handleImprimir = () => {
    window.print()
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
              <Badge className="bg-emerald-500/20 text-emerald-200 border-emerald-400/30 text-xs font-semibold px-2.5 py-0.5 backdrop-blur-md">
                <Sparkles className="w-3 h-3 mr-1 text-emerald-300" />
                Indicadores Financeiros Gerenciais
              </Badge>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2.5">
              <span>Painel de Indicadores Financeiros Clássicos</span>
            </h1>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Diagnóstico econômico com métricas consolidadas de Liquidez, Endividamento,
              Rentabilidade (ROE/ROA/Margens) e Prazos Médios.
            </p>
          </div>

          {/* Controles de Período e Exportação */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0 bg-white/5 border border-white/15 p-3 rounded-2xl backdrop-blur-md">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-300" />
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

      {/* Banner Identificador de Impressão A4 Borlim */}
      <div className="hidden print:block mb-6 border-b-2 border-slate-900 pb-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-slate-900 uppercase tracking-tight">
              Painel de Indicadores Financeiros — Relatório Gerencial
            </h1>
            <p className="text-xs text-slate-600 mt-0.5">
              Empresa: <strong>{nomeEntidade}</strong> | Exercício: <strong>{anoInicial}</strong>
            </p>
          </div>
          <BorlimLogo size="sm" variant="dark" />
        </div>
      </div>

      {/* Alerta quando NÃO houver balanço no período */}
      {!painelResultado.temBalancoNoPeriodo && (
        <Card className="bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <div className="text-xs sm:text-sm">
              <strong>Atenção:</strong> Não há balanço patrimonial cadastrado para o exercício{' '}
              {anoInicial}. Os indicadores que dependem de dados patrimoniais (como Liquidez
              Corrente/Seca/Geral, Alavancagem e ROE) exibem o aviso "Sem dados de balanço para o
              período" em vez de números zerados incorretos. As margens apuradas via DRE continuam
              ativas normalmente.
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filtros rápidos por categoria de indicadores */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 print:hidden">
        {['Todas', 'Liquidez', 'Endividamento', 'Rentabilidade', 'Eficiência'].map((cat) => (
          <Button
            key={cat}
            variant={categoriaAtiva === cat ? 'default' : 'outline'}
            size="sm"
            onClick={() => setCategoriaAtiva(cat)}
            className={`h-8 text-xs cursor-pointer ${
              categoriaAtiva === cat
                ? 'bg-[#0B1F3A] hover:bg-[#123668] text-white'
                : 'text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700'
            }`}
          >
            {cat}
          </Button>
        ))}
      </div>

      {/* Grid de Cards dos Indicadores */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {indicadoresFiltrados.map((ind) => {
          const badgeClass = getBadgeStatusStyle(ind.badgeVariant)

          return (
            <Card
              key={ind.id}
              className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between print:break-inside-avoid"
            >
              <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between gap-2">
                  <Badge
                    variant="outline"
                    className="text-[10px] uppercase font-bold text-slate-500"
                  >
                    {ind.categoria} · {ind.sigla}
                  </Badge>
                  <Badge className={`text-[10px] font-bold border px-2 py-0.5 ${badgeClass}`}>
                    {ind.temDadosBalanco ? ind.status : 'Sem Balanço'}
                  </Badge>
                </div>
                <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-100 mt-2">
                  {ind.nome}
                </CardTitle>
                <span className="text-[11px] font-mono text-slate-400 block">{ind.formula}</span>
              </CardHeader>

              <CardContent className="pt-4 space-y-4">
                {/* Valor Apurado em destaque */}
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 border border-slate-100 dark:border-slate-800 flex items-baseline justify-between">
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">
                      Valor Apurado
                    </span>
                    <span
                      className={`text-2xl font-black mt-0.5 block ${
                        ind.temDadosBalanco
                          ? 'text-slate-900 dark:text-slate-100'
                          : 'text-slate-400 text-sm font-semibold italic'
                      }`}
                    >
                      {ind.temDadosBalanco
                        ? formatValorIndicador(ind)
                        : 'sem dados de balanço para o período'}
                    </span>
                  </div>

                  {ind.temDadosBalanco && (
                    <div className="text-right text-[11px] text-slate-500 font-mono">
                      <div>
                        Num:{' '}
                        {ind.detalhesCalculo.numerador.valor.toLocaleString('pt-BR', {
                          maximumFractionDigits: 0,
                        })}
                      </div>
                      <div>
                        Den:{' '}
                        {ind.detalhesCalculo.denominador.valor.toLocaleString('pt-BR', {
                          maximumFractionDigits: 0,
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Explicação Didática */}
                <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-blue-50/40 dark:bg-blue-950/20 p-2.5 rounded-lg border border-blue-100 dark:border-blue-900/30">
                  <div className="flex items-start gap-1.5">
                    <Info className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                    <span>{ind.explicacao}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <DocumentPrintFooter />
    </div>
  )
}
