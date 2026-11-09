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
import type {
  BalancoRecord,
  DreRecord,
  ContaRecord,
  LancamentoRecord,
  PlanoContaRecord,
} from '@/types/finance'
import {
  calcularZScoreAltman,
  ROTULO_ZONA,
  DESCRICAO_ZONA,
  type ZScoreResultado,
  type ZonaInsolvencia,
  type ComponenteZScore,
} from '@/lib/termometroInsolvenciaCalculo'
import { exportarTermometroExcel, exportarTermometroCsv } from '@/lib/termometroInsolvenciaExport'
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
  ShieldCheck,
  Activity,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from 'lucide-react'
import { gerarListaMeses } from '@/lib/dreGerencialTypes'
import { calcularAnaliseRentabilidade } from '@/lib/analiseRentabilidadeCalculo'

function formatNumero(valor: number | null, decimais = 3): string {
  if (valor === null || !Number.isFinite(valor)) return '—'
  return valor.toLocaleString('pt-BR', {
    minimumFractionDigits: decimais,
    maximumFractionDigits: decimais,
  })
}

function formatMoeda(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function GerencialTermometroInsolvencia() {
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
  const [modeloSelecionado, setModeloSelecionado] = useState<'privada' | 'classica'>('privada')

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
        // Preferencialmente consolidado anual (mes === 12 ou mes null)
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

      // Fallback sintético para DRE se não houver DRE gravada mas houver lançamentos
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
      console.error('Erro ao carregar dados do Termômetro de Insolvência:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar dados',
        description:
          'Não foi possível carregar os demonstrativos para o Termômetro de Insolvência.',
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

  const resultadoZ = useMemo<ZScoreResultado>(() => {
    return calcularZScoreAltman(balanco, dre)
  }, [balanco, dre])

  const zAtual = modeloSelecionado === 'privada' ? resultadoZ.zPrivada : resultadoZ.zClassica
  const zonaAtual: ZonaInsolvencia | null =
    modeloSelecionado === 'privada' ? resultadoZ.zonaPrivada : resultadoZ.zonaClassica
  const componentesAtuais: ComponenteZScore[] =
    modeloSelecionado === 'privada' ? resultadoZ.componentesPrivada : resultadoZ.componentesClassica

  const handleExportarExcel = () => {
    exportarTermometroExcel(resultadoZ, selectedEmpresa, anoInicial)
    toast({
      title: 'Planilha exportada com sucesso',
      description: 'O relatório do Termômetro de Insolvência (Altman) foi baixado.',
    })
  }

  const handleExportarCsv = () => {
    exportarTermometroCsv(resultadoZ, selectedEmpresa, anoInicial)
    toast({
      title: 'CSV exportado',
      description: 'O arquivo com os indicadores do Termômetro foi gerado com sucesso.',
    })
  }

  const handleImprimir = () => {
    window.print()
  }

  // Posição no ponteiro do gauge (0 a 100%)
  const calcularPosicaoGauge = (z: number | null, modelo: 'privada' | 'classica'): number => {
    if (z === null) return 50
    if (modelo === 'privada') {
      // Limites: < 1.1 (vermelho: 0-33%), 1.1-2.6 (âmbar: 33-66%), > 2.6 (verde: 66-100%)
      if (z <= 0) return 5
      if (z < 1.1) return Math.min(32, Math.max(5, (z / 1.1) * 33))
      if (z <= 2.6) return 33 + ((z - 1.1) / (2.6 - 1.1)) * 33
      if (z <= 5.0) return 66 + ((z - 2.6) / (5.0 - 2.6)) * 28
      return 95
    } else {
      // Clássica: < 1.81 (0-33%), 1.81-2.99 (33-66%), > 2.99 (66-100%)
      if (z <= 0) return 5
      if (z < 1.81) return Math.min(32, Math.max(5, (z / 1.81) * 33))
      if (z <= 2.99) return 33 + ((z - 1.81) / (2.99 - 1.81)) * 33
      if (z <= 6.0) return 66 + ((z - 2.99) / (6.0 - 2.99)) * 28
      return 95
    }
  }

  const posicaoGauge = calcularPosicaoGauge(zAtual, modeloSelecionado)

  const getCoresZona = (zona: ZonaInsolvencia | null) => {
    if (zona === 'solvencia') {
      return {
        bg: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
        badge: 'bg-emerald-600 text-white',
        text: 'text-emerald-600 dark:text-emerald-400',
        border: 'border-emerald-500/40',
        gradient: 'from-emerald-500/20 via-emerald-500/5 to-transparent',
      }
    }
    if (zona === 'cinzenta') {
      return {
        bg: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
        badge: 'bg-amber-600 text-white',
        text: 'text-amber-600 dark:text-amber-400',
        border: 'border-amber-500/40',
        gradient: 'from-amber-500/20 via-amber-500/5 to-transparent',
      }
    }
    if (zona === 'insolvencia') {
      return {
        bg: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
        badge: 'bg-rose-600 text-white',
        text: 'text-rose-600 dark:text-rose-400',
        border: 'border-rose-500/40',
        gradient: 'from-rose-500/20 via-rose-500/5 to-transparent',
      }
    }
    return {
      bg: 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30',
      badge: 'bg-slate-600 text-white',
      text: 'text-slate-600 dark:text-slate-400',
      border: 'border-slate-500/40',
      gradient: 'from-slate-500/20 via-slate-500/5 to-transparent',
    }
  }

  const estiloZona = getCoresZona(zonaAtual)

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
              <Badge className="bg-rose-500/20 text-rose-200 border-rose-400/30 text-xs font-semibold px-2.5 py-0.5 backdrop-blur-md">
                <Activity className="w-3 h-3 mr-1 text-rose-300" />
                Termômetro de Insolvência
              </Badge>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2.5">
              <span>Termômetro de Insolvência (Z-Score de Altman)</span>
            </h1>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Diagnóstico preventivo de saúde financeira baseado nos modelos de Altman (Modelo
              Privado Z&apos;&apos; para empresas de capital fechado e Clássico 1968). Mede
              solvência, liquidez e capacidade operacional com paridade ao EBITDA oficial do
              sistema.
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

      {/* Banner de Impressão A4 */}
      <div className="hidden print:block mb-6 border-b-2 border-slate-900 pb-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-slate-900 uppercase tracking-tight">
              Termômetro de Insolvência (Altman) — Relatório Executivo
            </h1>
            <p className="text-xs text-slate-600 mt-0.5">
              Empresa: <strong>{nomeEntidade}</strong> | Exercício: <strong>{anoInicial}</strong>
            </p>
          </div>
          <BorlimLogo size="sm" variant="dark" />
        </div>
      </div>

      {/* Alerta de ausência de balanço */}
      {!resultadoZ.temDados && (
        <Card className="bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <div className="text-xs sm:text-sm">
              <strong>Demonstrativo Incompleto:</strong> Não foram encontrados lançamentos de
              Balanço Patrimonial com Ativo Total positivo para o exercício de {anoInicial}.
              Cadastre ou importe o balancete patrimonial para apuração completa do Z-Score de
              Altman.
            </div>
          </CardContent>
        </Card>
      )}

      {/* Seletor de Modelo de Altman */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
            Modelo de Cálculo:
          </span>
          <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setModeloSelecionado('privada')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                modeloSelecionado === 'privada'
                  ? 'bg-[#0B1F3A] text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
              }`}
            >
              Modelo Privado Z&apos;&apos; (Recomendado PMEs)
            </button>
            <button
              type="button"
              onClick={() => setModeloSelecionado('classica')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                modeloSelecionado === 'classica'
                  ? 'bg-[#0B1F3A] text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
              }`}
            >
              Modelo Clássico 1968 (Indústria / Capital Aberto)
            </button>
          </div>
        </div>

        <Badge variant="outline" className="text-xs text-slate-500 font-mono">
          EBIT Oficial: {formatMoeda(resultadoZ.ebitAproximado)} (Paridade EBITDA Dashboard BI)
        </Badge>
      </div>

      {/* MEDIDOR VISUAL / GAUGE EM DESTAQUE */}
      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-md overflow-hidden">
        <div
          className={`p-6 sm:p-8 bg-gradient-to-b ${estiloZona.gradient} border-b border-slate-100 dark:border-slate-800`}
        >
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-2 text-center md:text-left">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Classificação de Solvência
              </span>
              <div className="flex items-center justify-center md:justify-start gap-3">
                <span className="text-4xl sm:text-5xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                  {zAtual !== null ? formatNumero(zAtual, 2) : '—'}
                </span>
                <Badge className={`text-sm font-extrabold px-3 py-1 border ${estiloZona.bg}`}>
                  {zonaAtual ? ROTULO_ZONA[zonaAtual] : 'Aguardando Dados'}
                </Badge>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-xl">
                {zonaAtual
                  ? DESCRICAO_ZONA[zonaAtual]
                  : 'Cadastre os demonstrativos contábeis para apuração.'}
              </p>
            </div>

            {/* Medidor Barra de Zonas com Ponteiro */}
            <div className="w-full md:w-96 space-y-3 bg-white/70 dark:bg-slate-950/60 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 backdrop-blur-xs">
              <div className="flex justify-between text-[11px] font-bold">
                <span className="text-rose-600 dark:text-rose-400">Insolvência</span>
                <span className="text-amber-600 dark:text-amber-400">Zona Cinzenta</span>
                <span className="text-emerald-600 dark:text-emerald-400">Solvência</span>
              </div>

              {/* Barra gradiente do termômetro */}
              <div className="relative h-5 rounded-full overflow-hidden flex shadow-inner border border-slate-300 dark:border-slate-700">
                <div className="w-1/3 bg-gradient-to-r from-rose-600 to-rose-400 h-full" />
                <div className="w-1/3 bg-gradient-to-r from-amber-400 to-amber-300 h-full" />
                <div className="w-1/3 bg-gradient-to-r from-emerald-400 to-emerald-600 h-full" />

                {/* Linhas de corte das zonas */}
                <div className="absolute top-0 bottom-0 left-1/3 w-0.5 bg-white/80 shadow-xs" />
                <div className="absolute top-0 bottom-0 left-2/3 w-0.5 bg-white/80 shadow-xs" />

                {/* Marcador do ponteiro */}
                {zAtual !== null && (
                  <div
                    className="absolute top-0 bottom-0 w-3 -ml-1.5 bg-slate-900 dark:bg-white rounded-full border-2 border-white dark:border-slate-900 shadow-lg transition-all duration-500"
                    style={{ left: `${posicaoGauge}%` }}
                    title={`Z-Score: ${formatNumero(zAtual, 2)}`}
                  />
                )}
              </div>

              <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                {modeloSelecionado === 'privada' ? (
                  <>
                    <span>Z &lt; 1.10</span>
                    <span>1.10 ≤ Z ≤ 2.60</span>
                    <span>Z &gt; 2.60</span>
                  </>
                ) : (
                  <>
                    <span>Z &lt; 1.81</span>
                    <span>1.81 ≤ Z ≤ 2.99</span>
                    <span>Z &gt; 2.99</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Fórmulas do modelo selecionado */}
        <CardContent className="p-4 sm:p-6 bg-slate-50/60 dark:bg-slate-900/60">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <Info className="w-4 h-4 text-sky-500 shrink-0" />
            <span>
              {modeloSelecionado === 'privada'
                ? "Fórmula Z'' (empresas privadas): Z'' = 6.56 × X1 + 3.26 × X2 + 6.72 × X3 + 1.05 × X4"
                : 'Fórmula Z Clássica (1968): Z = 1.2 × X1 + 1.4 × X2 + 3.3 × X3 + 0.6 × X4 + 1.0 × X5'}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* COMPONENTES X1..X5 COM FÓRMULAS, VALORES E CONTRIBUIÇÃO */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#0B1F3A] dark:text-slate-100 flex items-center gap-2">
            <Activity className="w-4 h-4 text-sky-600" />
            Componentes e Índices do Modelo (
            {modeloSelecionado === 'privada' ? 'X1 a X4' : 'X1 a X5'})
          </h2>
          <span className="text-xs text-slate-500">
            {componentesAtuais.length} variáveis normalizadas pelo Ativo Total
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {componentesAtuais.map((comp) => {
            return (
              <Card
                key={comp.codigo}
                className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between"
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <Badge
                      variant="outline"
                      className="font-mono text-xs font-bold text-sky-600 border-sky-300"
                    >
                      {comp.codigo}
                    </Badge>
                    <span className="text-[11px] font-mono text-slate-400">Peso: ×{comp.peso}</span>
                  </div>
                  <CardTitle className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-1 line-clamp-2">
                    {comp.nome}
                  </CardTitle>
                  <CardDescription className="text-[10.5px] font-mono text-slate-400 line-clamp-2">
                    {comp.formula}
                  </CardDescription>
                </CardHeader>

                <CardContent className="pt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-2">
                  <div className="flex justify-between items-baseline">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Índice:</span>
                    <span className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                      {formatNumero(comp.valor, 4)}
                    </span>
                  </div>

                  <div className="flex justify-between items-baseline bg-slate-50 dark:bg-slate-800/50 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] uppercase font-bold text-slate-500">
                      Contribuição ao Z:
                    </span>
                    <span className="text-sm font-black text-sky-600 dark:text-sky-400 font-mono">
                      {formatNumero(comp.contribuicao, 4)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {/* SÍNTESE PATRIMONIAL E RESULTADOS BASE */}
      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
        <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
          <CardTitle className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Demonstrativo Base Consolidado do Período ({anoInicial})
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">
            Valores patrimoniais e de resultado empregados no cálculo do Altman Z-Score
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
            <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                Ativo Total
              </span>
              <span className="text-sm font-extrabold text-slate-900 dark:text-slate-100 mt-0.5 block truncate">
                {formatMoeda(resultadoZ.ativoTotal)}
              </span>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                Capital de Giro Líquido
              </span>
              <span className="text-sm font-extrabold text-slate-900 dark:text-slate-100 mt-0.5 block truncate">
                {formatMoeda(resultadoZ.capitalGiroLiquido)}
              </span>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                Lucros Acumulados
              </span>
              <span className="text-sm font-extrabold text-slate-900 dark:text-slate-100 mt-0.5 block truncate">
                {formatMoeda(resultadoZ.lucrosAcumulados)}
              </span>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                EBITDA (EBIT oficial)
              </span>
              <span className="text-sm font-extrabold text-slate-900 dark:text-slate-100 mt-0.5 block truncate">
                {formatMoeda(resultadoZ.ebitAproximado)}
              </span>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                Patrimônio Líquido
              </span>
              <span className="text-sm font-extrabold text-slate-900 dark:text-slate-100 mt-0.5 block truncate">
                {formatMoeda(resultadoZ.patrimonioLiquido)}
              </span>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                Passivo Total
              </span>
              <span className="text-sm font-extrabold text-slate-900 dark:text-slate-100 mt-0.5 block truncate">
                {formatMoeda(resultadoZ.passivoTotal)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <DocumentPrintFooter />
    </div>
  )
}
