import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useFilter } from '@/contexts/FilterContext'
import { useAuth } from '@/contexts/AuthContext'
import { useRealtime } from '@/hooks/use-realtime'
import { balancosService, dreService } from '@/services/financeService'
import { bscService } from '@/services/bscService'
import {
  calcularBalanco,
  calcularDre,
  calcularIndicadores,
  calcularCapitalGiro,
  consolidarBalancoAnual,
  consolidarDreAnual,
  formatNumber,
  formatPercent,
  formatCurrency,
} from '@/lib/financeCalculations'
import type {
  BalancoRecord,
  DreRecord,
  BscKpiRecord,
  BscPerspectiva,
  BscSentido,
  BscKpiTipo,
} from '@/types/finance'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useToast } from '@/hooks/use-toast'

import {
  Target,
  Plus,
  Sparkles,
  TrendingUp,
  Users,
  Cpu,
  GraduationCap,
  Pencil,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  RefreshCw,
  Info,
  Calendar,
  Building,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  Zap,
} from 'lucide-react'

import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Tooltip as RechartsTooltip,
} from 'recharts'

interface PerspectivaInfo {
  id: BscPerspectiva
  nome: string
  subtitulo: string
  descricao: string
  icon: React.ComponentType<{ className?: string }>
  cor: {
    bg: string
    border: string
    text: string
    badge: string
    accent: string
    radarFill: string
    radarStroke: string
  }
}

const PERSPECTIVAS: PerspectivaInfo[] = [
  {
    id: 'financeira',
    nome: 'Financeira',
    subtitulo: 'Como agregamos valor aos acionistas e mantemos solidez?',
    descricao:
      'Foca em rentabilidade, liquidez, margens e geração de caixa a partir das demonstrações financeiras.',
    icon: TrendingUp,
    cor: {
      bg: 'bg-blue-50/70',
      border: 'border-blue-200',
      text: 'text-blue-900',
      badge: 'bg-blue-100 text-blue-800 border-blue-200',
      accent: '#2563EB',
      radarFill: '#3B82F6',
      radarStroke: '#1D4ED8',
    },
  },
  {
    id: 'clientes',
    nome: 'Clientes & Mercado',
    subtitulo: 'Como somos vistos por nossos clientes e mercado-alvo?',
    descricao:
      'Mede a satisfação, atração de novas contas, retenção e a proposta de valor percebida.',
    icon: Users,
    cor: {
      bg: 'bg-emerald-50/70',
      border: 'border-emerald-200',
      text: 'text-emerald-900',
      badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      accent: '#10B981',
      radarFill: '#10B981',
      radarStroke: '#047857',
    },
  },
  {
    id: 'processos_internos',
    nome: 'Processos Internos',
    subtitulo: 'Em quais processos críticos devemos ser excelentes?',
    descricao:
      'Garante eficiência operacional, qualidade, pontualidade e otimização dos prazos de giro.',
    icon: Cpu,
    cor: {
      bg: 'bg-amber-50/70',
      border: 'border-amber-200',
      text: 'text-amber-900',
      badge: 'bg-amber-100 text-amber-800 border-amber-200',
      accent: '#F59E0B',
      radarFill: '#F59E0B',
      radarStroke: '#B45309',
    },
  },
  {
    id: 'aprendizado_crescimento',
    nome: 'Aprendizado & Crescimento',
    subtitulo: 'Como continuaremos a melhorar, inovar e capacitar pessoas?',
    descricao:
      'Avalia o capital humano, clima organizacional, retenção de talentos e inovação tecnológica.',
    icon: GraduationCap,
    cor: {
      bg: 'bg-purple-50/70',
      border: 'border-purple-200',
      text: 'text-purple-900',
      badge: 'bg-purple-100 text-purple-800 border-purple-200',
      accent: '#8B5CF6',
      radarFill: '#8B5CF6',
      radarStroke: '#6D28D9',
    },
  },
]

export default function BalancedScorecard() {
  const { selectedEmpresaId, selectedAno, selectedEmpresa, anosDisponiveis, setSelectedAno } =
    useFilter()
  const { isAuthenticated } = useAuth()
  const { toast } = useToast()

  const [kpis, setKpis] = useState<BscKpiRecord[]>([])
  const [balancos, setBalancos] = useState<BalancoRecord[]>([])
  const [dres, setDres] = useState<DreRecord[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isSaving, setIsSaving] = useState<boolean>(false)
  const [isCarregandoModelo, setIsCarregandoModelo] = useState<boolean>(false)

  // Modais de Criação / Edição de KPI
  const [modalKpiOpen, setModalKpiOpen] = useState(false)
  const [kpiEmEdicao, setKpiEmEdicao] = useState<BscKpiRecord | null>(null)
  const [kpiToDelete, setKpiToDelete] = useState<BscKpiRecord | null>(null)

  // Formulário do KPI
  const [formPerspectiva, setFormPerspectiva] = useState<BscPerspectiva>('financeira')
  const [formNome, setFormNome] = useState('')
  const [formDescricao, setFormDescricao] = useState('')
  const [formUnidade, setFormUnidade] = useState('')
  const [formMeta, setFormMeta] = useState<string>('')
  const [formValorAtual, setFormValorAtual] = useState<string>('')
  const [formTipo, setFormTipo] = useState<BscKpiTipo>('manual')
  const [formFormula, setFormFormula] = useState<string>('')
  const [formPeso, setFormPeso] = useState<string>('15')
  const [formSentido, setFormSentido] = useState<BscSentido>('maior_melhor')

  // Carregar Balanços e DREs da empresa/ano
  const carregarDemonstracoes = useCallback(async () => {
    if (!selectedEmpresaId) return
    try {
      const [bList, dList] = await Promise.all([
        balancosService.getByEmpresa(selectedEmpresaId),
        dreService.getByEmpresa(selectedEmpresaId),
      ])
      setBalancos(bList)
      setDres(dList)
    } catch (err) {
      console.error('Erro ao carregar balanços e DREs para BSC:', err)
    }
  }, [selectedEmpresaId])

  // Carregar KPIs do BSC
  const carregarKpis = useCallback(async () => {
    if (!selectedEmpresaId) {
      setKpis([])
      setIsLoading(false)
      return
    }
    try {
      setIsLoading(true)
      const list = await bscService.getByEmpresaEAno(selectedEmpresaId, selectedAno)
      setKpis(list)
    } catch (err) {
      console.error('Erro ao carregar KPIs do BSC:', err)
      toast({
        title: 'Erro ao carregar BSC',
        description: 'Não foi possível carregar os indicadores do Balanced Scorecard.',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }, [selectedEmpresaId, selectedAno, toast])

  useEffect(() => {
    carregarDemonstracoes()
    carregarKpis()
  }, [carregarDemonstracoes, carregarKpis])

  // Realtime para refletir balanços, DRE e os próprios KPIs do BSC
  useRealtime<BalancoRecord>('balancos', () => carregarDemonstracoes(), isAuthenticated)
  useRealtime<DreRecord>('dre', () => carregarDemonstracoes(), isAuthenticated)
  useRealtime<BscKpiRecord>('bsc_kpis', () => carregarKpis(), isAuthenticated)

  // Balanço e DRE consolidados do ano ativo e anterior
  const balancoAtual = useMemo(
    () => consolidarBalancoAnual(balancos, selectedAno),
    [balancos, selectedAno],
  )
  const dreAtual = useMemo(() => consolidarDreAnual(dres, selectedAno), [dres, selectedAno])

  const dreAnterior = useMemo(() => consolidarDreAnual(dres, selectedAno - 1), [dres, selectedAno])

  // Cálculo financeiro apurado
  const calcB = useMemo(() => calcularBalanco(balancoAtual), [balancoAtual])
  const calcD = useMemo(() => calcularDre(dreAtual), [dreAtual])
  const calcInd = useMemo(
    () => calcularIndicadores(balancoAtual, dreAtual),
    [balancoAtual, dreAtual],
  )
  const calcGiro = useMemo(
    () => calcularCapitalGiro(balancoAtual, dreAtual),
    [balancoAtual, dreAtual],
  )

  // Dicionário de fórmulas automáticas calculadas do Balanço e DRE
  const formulasCalculadas = useMemo<Record<string, number | null>>(() => {
    // Crescimento da receita
    let crescimentoReceita: number | null = null
    const recAtual = calcD.receitaLiquida
    const dreAntCalc = dreAnterior ? calcularDre(dreAnterior) : null
    const recAnt = dreAntCalc?.receitaLiquida || 0
    if (recAtual > 0 && recAnt > 0) {
      crescimentoReceita = ((recAtual - recAnt) / recAnt) * 100
    }

    return {
      liquidez_corrente: calcInd.liquidezCorrente,
      liquidez_seca: calcInd.liquidezSeca,
      liquidez_imediata: calcInd.liquidezImediata,
      liquidez_geral: calcInd.liquidezGeral,
      endividamento_geral: calcInd.endividamentoGeral,
      composicao_endividamento: calcInd.composicaoEndividamento,
      margem_bruta: calcInd.margemBruta,
      margem_operacional: calcInd.margemOperacional,
      margem_liquida: calcInd.margemLiquida,
      roe: calcInd.roe,
      roa: calcInd.roa,
      ebitda: calcD.ebitda,
      crescimento_receita: crescimentoReceita,
      pmr: calcGiro.pmr,
      pmp: calcGiro.pmp,
      pme: calcGiro.pme,
      ciclo_operacional: calcGiro.cicloOperacional,
      ciclo_financeiro: calcGiro.cicloFinanceiro,
    }
  }, [calcInd, calcD, dreAnterior, calcGiro])

  // Obter valor real apurado de um KPI (seja auto ou manual)
  const getValorApurado = useCallback(
    (kpi: BscKpiRecord): { valor: number | null; formatado: string; disponivel: boolean } => {
      if (kpi.tipo === 'auto' && kpi.formula) {
        const val = formulasCalculadas[kpi.formula] ?? null
        if (val === null || val === undefined) {
          return { valor: null, formatado: 'Pendente (sem Balanço/DRE)', disponivel: false }
        }
        let str = ''
        if (kpi.unidade === 'R$') {
          str = formatCurrency(val)
        } else if (kpi.unidade === '%') {
          str = formatPercent(val, 1)
        } else if (kpi.unidade === 'dias' || kpi.unidade === 'un') {
          str = `${formatNumber(val, 0)} ${kpi.unidade}`
        } else {
          str = `${formatNumber(val, 2)} ${kpi.unidade || ''}`.trim()
        }
        return { valor: val, formatado: str, disponivel: true }
      }

      // Manual
      const valManual = kpi.valor_atual ?? 0
      let str = ''
      if (kpi.unidade === 'R$') {
        str = formatCurrency(valManual)
      } else if (kpi.unidade === '%') {
        str = formatPercent(valManual, 1)
      } else if (kpi.unidade === 'dias' || kpi.unidade === 'un' || kpi.unidade === 'horas') {
        str = `${formatNumber(valManual, 0)} ${kpi.unidade}`
      } else {
        str = `${formatNumber(valManual, 2)} ${kpi.unidade || ''}`.trim()
      }
      return { valor: valManual, formatado: str, disponivel: true }
    },
    [formulasCalculadas],
  )

  // Cálculo do Atingimento de um KPI (0 a 100%+)
  const calcularAtingimentoKpi = useCallback(
    (
      kpi: BscKpiRecord,
    ): { pct: number; status: 'atingido' | 'proximo' | 'abaixo' | 'indefinido' } => {
      const apurado = getValorApurado(kpi)
      if (!apurado.disponivel || apurado.valor === null) {
        return { pct: 0, status: 'indefinido' }
      }

      const meta = kpi.meta
      const real = apurado.valor
      if (meta === 0) {
        return { pct: 100, status: 'atingido' }
      }

      let pct = 0
      if (kpi.sentido === 'maior_melhor') {
        // Ex: meta 15%, real 18% -> 120%
        pct = (real / meta) * 100
      } else {
        // Menor é melhor: ex: meta endividamento <= 50%, real 40% -> atingiu com folga (>100%)
        // se real = 50% -> 100%
        // se real = 60% -> 50 / 60 = 83.3%
        if (real <= 0) {
          pct = 120
        } else {
          pct = (meta / real) * 100
        }
      }

      // Limitar apresentação a 0% no piso e 150% no teto para evitar distorções de escala
      const pctClamped = Math.max(0, Math.min(150, pct))

      let status: 'atingido' | 'proximo' | 'abaixo' = 'abaixo'
      if (pct >= 95) {
        status = 'atingido'
      } else if (pct >= 75) {
        status = 'proximo'
      } else {
        status = 'abaixo'
      }

      return { pct: Math.round(pctClamped), status }
    },
    [getValorApurado],
  )

  // Estatísticas e Score Global Ponderado
  const { resumoPerspectivas, scoreGlobalBsc, totalKpisCount } = useMemo(() => {
    let somaPonderadaGlobal = 0
    let somaPesosGlobal = 0
    let totalKpis = 0

    const resumo = PERSPECTIVAS.map((p) => {
      const kpisDaPerspectiva = kpis.filter((k) => k.perspectiva === p.id)
      totalKpis += kpisDaPerspectiva.length

      let somaPonderada = 0
      let somaPesos = 0
      let atingidos = 0
      let proximos = 0
      let abaixo = 0

      kpisDaPerspectiva.forEach((k) => {
        const peso = k.peso && k.peso > 0 ? k.peso : 10
        const { pct, status } = calcularAtingimentoKpi(k)
        if (status !== 'indefinido') {
          somaPonderada += pct * peso
          somaPesos += peso
          if (status === 'atingido') atingidos++
          else if (status === 'proximo') proximos++
          else abaixo++
        }
      })

      const scorePerspectiva = somaPesos > 0 ? Math.round(somaPonderada / somaPesos) : 0

      if (somaPesos > 0) {
        somaPonderadaGlobal += scorePerspectiva * 25 // cada perspectiva com 25% de peso no scorecard global
        somaPesosGlobal += 25
      }

      return {
        perspectiva: p.id,
        nome: p.nome,
        subtitulo: p.subtitulo,
        total: kpisDaPerspectiva.length,
        atingidos,
        proximos,
        abaixo,
        score: scorePerspectiva,
        kpis: kpisDaPerspectiva,
      }
    })

    const scoreGlobal = somaPesosGlobal > 0 ? Math.round(somaPonderadaGlobal / somaPesosGlobal) : 0

    return {
      resumoPerspectivas: resumo,
      scoreGlobalBsc: scoreGlobal,
      totalKpisCount: totalKpis,
    }
  }, [kpis, calcularAtingimentoKpi])

  // Dados para o Gráfico Radar das 4 Perspectivas
  const radarData = useMemo(() => {
    return resumoPerspectivas.map((r) => {
      const info = PERSPECTIVAS.find((p) => p.id === r.perspectiva)
      return {
        perspectiva: info?.nome || r.nome,
        score: r.score,
        metaReferencia: 100,
        fullMark: 100,
      }
    })
  }, [resumoPerspectivas])

  // Abrir Modal para Criar Novo KPI
  const handleNovoKpi = (perspectivaSugerida?: BscPerspectiva) => {
    setKpiEmEdicao(null)
    setFormPerspectiva(perspectivaSugerida || 'financeira')
    setFormNome('')
    setFormDescricao('')
    setFormUnidade('%')
    setFormMeta('10')
    setFormValorAtual('0')
    setFormTipo('manual')
    setFormFormula('')
    setFormPeso('15')
    setFormSentido('maior_melhor')
    setModalKpiOpen(true)
  }

  // Abrir Modal para Editar KPI
  const handleEditarKpi = (kpi: BscKpiRecord) => {
    setKpiEmEdicao(kpi)
    setFormPerspectiva(kpi.perspectiva)
    setFormNome(kpi.nome)
    setFormDescricao(kpi.descricao || '')
    setFormUnidade(kpi.unidade || '')
    setFormMeta(String(kpi.meta))
    setFormValorAtual(String(kpi.valor_atual ?? 0))
    setFormTipo(kpi.tipo)
    setFormFormula(kpi.formula || '')
    setFormPeso(String(kpi.peso || 15))
    setFormSentido(kpi.sentido)
    setModalKpiOpen(true)
  }

  // Salvar KPI
  const handleSalvarKpi = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formNome.trim()) {
      toast({
        title: 'Nome obrigatório',
        description: 'Informe um nome descritivo para o KPI.',
        variant: 'destructive',
      })
      return
    }

    const metaNum = Number(formMeta)
    if (isNaN(metaNum)) {
      toast({
        title: 'Meta inválida',
        description: 'A meta deve ser um número válido.',
        variant: 'destructive',
      })
      return
    }

    setIsSaving(true)
    try {
      const payload = {
        empresa: selectedEmpresaId,
        ano: selectedAno,
        perspectiva: formPerspectiva,
        nome: formNome.trim(),
        descricao: formDescricao.trim() || undefined,
        unidade: formUnidade.trim() || undefined,
        meta: metaNum,
        valor_atual: Number(formValorAtual) || 0,
        tipo: formTipo,
        formula: formTipo === 'auto' ? formFormula : undefined,
        peso: Number(formPeso) || 10,
        sentido: formSentido,
        ordem: kpiEmEdicao?.ordem ?? kpis.length + 1,
      }

      if (kpiEmEdicao) {
        await bscService.update(kpiEmEdicao.id, payload)
        toast({
          title: 'KPI atualizado',
          description: `O indicador "${formNome}" foi atualizado com sucesso.`,
        })
      } else {
        await bscService.create(payload)
        toast({
          title: 'KPI cadastrado',
          description: `O indicador "${formNome}" foi criado com sucesso no BSC.`,
        })
      }

      setModalKpiOpen(false)
      await carregarKpis()
    } catch (err) {
      console.error('Erro ao salvar KPI:', err)
      toast({
        title: 'Erro ao salvar KPI',
        description: 'Não foi possível gravar o indicador. Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  // Confirmar Exclusão de KPI
  const handleConfirmarExclusao = async () => {
    if (!kpiToDelete) return
    try {
      await bscService.delete(kpiToDelete.id)
      toast({
        title: 'KPI excluído',
        description: `O indicador "${kpiToDelete.nome}" foi removido do BSC.`,
      })
      setKpiToDelete(null)
      await carregarKpis()
    } catch (err) {
      console.error('Erro ao excluir KPI:', err)
      toast({
        title: 'Erro ao excluir',
        description: 'Não foi possível excluir o indicador selecionado.',
        variant: 'destructive',
      })
    }
  }

  // Carregar modelo sugerido do Balanced Scorecard
  const handleCarregarModeloPadrao = async () => {
    if (!selectedEmpresaId) return
    setIsCarregandoModelo(true)
    try {
      const novos = await bscService.carregarModeloPadrao(selectedEmpresaId, selectedAno)
      toast({
        title: 'Modelo Sugerido Carregado!',
        description: `${novos.length} indicadores foram criados nas 4 perspectivas do BSC para o exercício de ${selectedAno}.`,
      })
      await carregarKpis()
    } catch (err) {
      console.error('Erro ao semear modelo BSC:', err)
      toast({
        title: 'Falha ao carregar modelo',
        description: 'Ocorreu um erro ao gerar os indicadores pré-configurados.',
        variant: 'destructive',
      })
    } finally {
      setIsCarregandoModelo(false)
    }
  }

  // Cor do semáforo global
  const statusSemaforoGlobal =
    scoreGlobalBsc >= 90 ? 'verde' : scoreGlobalBsc >= 70 ? 'ambar' : 'vermelho'

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-fadeIn">
      {/* 1. CABEÇALHO PRINCIPAL COM CONTEXTO DA EMPRESA, ANO E AÇÕES RÁPIDAS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="p-2 rounded-xl bg-blue-600 text-white shadow-xs">
              <Target className="w-5 h-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-bold text-[#0B1F3A] tracking-tight">
              Balanced Scorecard (BSC)
            </h1>
            <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs font-semibold">
              Exercício {selectedAno}
            </Badge>
            {balancoAtual && dreAtual ? (
              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-xs font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Balanço &amp; DRE Vinculados
              </Badge>
            ) : (
              <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-xs font-medium flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Demonstrações Parciais em {selectedAno}
              </Badge>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-600">
            Acompanhe o desempenho estratégico da{' '}
            <strong className="text-slate-900 font-semibold">
              {selectedEmpresa?.nome_fantasia || selectedEmpresa?.nome || 'Empresa Selecionada'}
            </strong>{' '}
            em 4 dimensões integradas: Financeira (apuração automática), Clientes, Processos e
            Pessoas.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Seletor de Ano Rápido */}
          <div className="flex items-center gap-1.5 bg-[#F5F7FA] border border-slate-200 rounded-lg px-2.5 py-1 text-xs">
            <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span className="text-slate-500 font-medium">Ano:</span>
            <Select
              value={String(selectedAno)}
              onValueChange={(val) => setSelectedAno(Number(val))}
            >
              <SelectTrigger className="h-7 border-none shadow-none bg-transparent text-xs font-bold text-slate-800 p-0 focus:ring-0 w-[68px]">
                <SelectValue placeholder="Ano" />
              </SelectTrigger>
              <SelectContent>
                {anosDisponiveis.map((ano) => (
                  <SelectItem key={ano} value={String(ano)} className="text-xs">
                    {ano}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Botão Novo KPI */}
          <Button
            onClick={() => handleNovoKpi()}
            className="bg-blue-600 hover:bg-blue-700 text-white shadow-xs text-xs font-semibold h-9"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Novo Indicador (KPI)
          </Button>

          {/* Botão Modelo Sugerido se lista estiver vazia */}
          {kpis.length === 0 && (
            <Button
              onClick={handleCarregarModeloPadrao}
              disabled={isCarregandoModelo}
              variant="outline"
              className="border-blue-300 text-blue-700 hover:bg-blue-50 text-xs font-semibold h-9"
            >
              <Sparkles className="w-4 h-4 mr-1.5 text-blue-600" />
              {isCarregandoModelo ? 'Gerando KPIs...' : 'Carregar Modelo Sugerido'}
            </Button>
          )}
        </div>
      </div>

      {/* 2. SCORECARD RESUMO NO TOPO + RADAR DAS 4 PERSPECTIVAS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Card 1: Score Global e Semáforo Geral (7 colunas) */}
        <Card className="lg:col-span-7 bg-white border-slate-200 shadow-xs overflow-hidden flex flex-col justify-between">
          <CardHeader className="pb-3 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base sm:text-lg font-bold text-[#0B1F3A] flex items-center gap-2">
                  <Zap className="w-5 h-5 text-amber-500" />
                  Score Global de Execução Estratégica
                </CardTitle>
                <CardDescription className="text-xs text-slate-500 mt-0.5">
                  Índice ponderado de atingimento das metas pactuadas para o exercício de{' '}
                  {selectedAno}
                </CardDescription>
              </div>

              {/* Semáforo Global */}
              <div
                className={`px-3 py-1.5 rounded-xl border font-bold text-xs flex items-center gap-1.5 ${
                  statusSemaforoGlobal === 'verde'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : statusSemaforoGlobal === 'ambar'
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-red-50 text-red-700 border-red-200'
                }`}
              >
                <span
                  className={`w-2.5 h-2.5 rounded-full animate-pulse ${
                    statusSemaforoGlobal === 'verde'
                      ? 'bg-emerald-500'
                      : statusSemaforoGlobal === 'ambar'
                        ? 'bg-amber-500'
                        : 'bg-red-500'
                  }`}
                />
                {statusSemaforoGlobal === 'verde' && 'Atingimento Alto (≥ 90%)'}
                {statusSemaforoGlobal === 'ambar' && 'Atenção / Próximo (70–89%)'}
                {statusSemaforoGlobal === 'vermelho' && 'Crítico / Abaixo (< 70%)'}
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-5 sm:p-6 space-y-6">
            {/* Bloco de Destaque Numérico */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 flex flex-col justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Scorecard Global
                </span>
                <div className="flex items-baseline gap-1 mt-2">
                  <span
                    className={`text-3xl sm:text-4xl font-extrabold tracking-tight font-mono ${
                      statusSemaforoGlobal === 'verde'
                        ? 'text-emerald-600'
                        : statusSemaforoGlobal === 'ambar'
                          ? 'text-amber-600'
                          : 'text-red-600'
                    }`}
                  >
                    {scoreGlobalBsc}%
                  </span>
                  <span className="text-xs text-slate-400 font-medium">de 100%</span>
                </div>
                <Progress value={scoreGlobalBsc} className="h-2 mt-3" />
              </div>

              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 flex flex-col justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  KPIs Cadastrados
                </span>
                <div className="flex items-baseline gap-1 mt-2">
                  <span className="text-3xl sm:text-4xl font-extrabold text-[#0B1F3A] font-mono">
                    {totalKpisCount}
                  </span>
                  <span className="text-xs text-slate-400 font-medium">indicadores</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-3">
                  Distribuídos nas 4 perspectivas clássicas do modelo BSC.
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 flex flex-col justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Status das Metas
                </span>
                <div className="space-y-1.5 mt-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-emerald-700 font-medium">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" /> Atingidas
                    </span>
                    <strong className="font-mono text-emerald-700">
                      {resumoPerspectivas.reduce((acc, r) => acc + r.atingidos, 0)}
                    </strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-amber-700 font-medium">
                      <span className="w-2 h-2 rounded-full bg-amber-500" /> Próximas
                    </span>
                    <strong className="font-mono text-amber-700">
                      {resumoPerspectivas.reduce((acc, r) => acc + r.proximos, 0)}
                    </strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-red-700 font-medium">
                      <span className="w-2 h-2 rounded-full bg-red-500" /> Abaixo
                    </span>
                    <strong className="font-mono text-red-700">
                      {resumoPerspectivas.reduce((acc, r) => acc + r.abaixo, 0)}
                    </strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Barras de Desempenho por Perspectiva */}
            <div className="space-y-3 pt-2">
              <span className="text-xs font-bold text-[#0B1F3A] uppercase tracking-wider block">
                Cumprimento Ponderado por Perspectiva:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {resumoPerspectivas.map((r) => {
                  const info = PERSPECTIVAS.find((p) => p.id === r.perspectiva)
                  const Icon = info?.icon || Target
                  return (
                    <div
                      key={r.perspectiva}
                      className="p-3 rounded-xl border border-slate-100 bg-slate-50/60 space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                          <Icon className="w-3.5 h-3.5 text-slate-600" />
                          {info?.nome}
                        </span>
                        <span className="font-mono font-bold text-slate-900">{r.score}%</span>
                      </div>
                      <Progress value={r.score} className="h-1.5" />
                      <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
                        <span>{r.total} KPIs cadastrados</span>
                        <span>
                          {r.atingidos} atingidos · {r.proximos} próx. · {r.abaixo} abaixo
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Gráfico Radar das 4 Perspectivas (5 colunas) */}
        <Card className="lg:col-span-5 bg-white border-slate-200 shadow-xs flex flex-col justify-between">
          <CardHeader className="pb-2 border-b border-slate-100">
            <CardTitle className="text-base sm:text-lg font-bold text-[#0B1F3A] flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-blue-600" />
              Equilíbrio Estratégico (Radar 360°)
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Harmonia entre resultados econômicos, satisfação, eficiência e desenvolvimento humano
            </CardDescription>
          </CardHeader>

          <CardContent className="p-4 sm:p-5 flex-1 flex flex-col items-center justify-center">
            {totalKpisCount === 0 ? (
              <div className="text-center py-10 px-4 space-y-3">
                <Target className="w-12 h-12 text-slate-300 mx-auto" />
                <p className="text-xs text-slate-500 max-w-xs mx-auto">
                  Carregue o modelo sugerido ou cadastre indicadores para visualizar o diagrama
                  radar do BSC.
                </p>
                <Button
                  onClick={handleCarregarModeloPadrao}
                  disabled={isCarregandoModelo}
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs"
                >
                  <Sparkles className="w-3.5 h-3.5 mr-1" />
                  Carregar Modelo Agora
                </Button>
              </div>
            ) : (
              <div className="h-64 sm:h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart
                    cx="50%"
                    cy="50%"
                    outerRadius="70%"
                    data={radarData}
                    margin={{ top: 10, right: 20, left: 20, bottom: 10 }}
                  >
                    <PolarGrid stroke="#E2E8F0" />
                    <PolarAngleAxis
                      dataKey="perspectiva"
                      tick={{ fill: '#0B1F3A', fontSize: 11, fontWeight: 700 }}
                    />
                    <PolarRadiusAxis
                      angle={30}
                      domain={[0, 100]}
                      tick={{ fill: '#94A3B8', fontSize: 9 }}
                      stroke="#CBD5E1"
                    />
                    <RechartsTooltip
                      content={({ active, payload }) => {
                        if (!active || !payload || !payload.length) return null
                        const item = payload[0].payload as {
                          perspectiva: string
                          score: number
                        }
                        return (
                          <div className="bg-slate-900 text-white p-2.5 rounded-lg shadow-xl text-xs space-y-1 border border-slate-700">
                            <strong className="block text-blue-300 font-bold">
                              {item.perspectiva}
                            </strong>
                            <div className="flex items-center justify-between gap-3 text-slate-200">
                              <span>Score Alcançado:</span>
                              <span className="font-mono font-bold text-white">
                                {item.score}% de 100%
                              </span>
                            </div>
                          </div>
                        )
                      }}
                    />
                    {/* Linha de Referência de Meta (100%) */}
                    <Radar
                      name="Meta Pactuada (100%)"
                      dataKey="metaReferencia"
                      stroke="#94A3B8"
                      fill="#CBD5E1"
                      fillOpacity={0.12}
                      strokeWidth={1.5}
                      strokeDasharray="4 4"
                    />
                    {/* Resultado Real do BSC */}
                    <Radar
                      name="Desempenho Real"
                      dataKey="score"
                      stroke="#2563EB"
                      fill="#3B82F6"
                      fillOpacity={0.4}
                      strokeWidth={2.5}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="flex items-center justify-center gap-4 text-[11px] text-slate-500 pt-2 border-t border-slate-100 w-full">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-blue-500" /> Real Apurado
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-0.5 bg-slate-400 border border-dashed border-slate-400" />{' '}
                Meta 100%
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 3. SEÇÃO PRINCIPAL DAS 4 PERSPECTIVAS DO BSC COM LISTA DE KPIS */}
      <div className="space-y-6">
        {PERSPECTIVAS.map((persp) => {
          const kpisPersp = kpis.filter((k) => k.perspectiva === persp.id)
          const Icon = persp.icon
          const resumoPersp = resumoPerspectivas.find((r) => r.perspectiva === persp.id)

          return (
            <Card
              key={persp.id}
              className="bg-white border-slate-200 shadow-xs overflow-hidden transition-all hover:border-slate-300"
            >
              <CardHeader className={`p-4 sm:p-5 border-b ${persp.cor.border} ${persp.cor.bg}`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shadow-xs shrink-0 text-white"
                      style={{ backgroundColor: persp.cor.accent }}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <CardTitle className="text-base sm:text-lg font-bold text-[#0B1F3A]">
                          Perspectiva {persp.nome}
                        </CardTitle>
                        <Badge className={`${persp.cor.badge} text-[11px] font-semibold`}>
                          Score: {resumoPersp?.score ?? 0}%
                        </Badge>
                        <Badge variant="outline" className="text-[10px] text-slate-500">
                          {kpisPersp.length} {kpisPersp.length === 1 ? 'indicador' : 'indicadores'}
                        </Badge>
                      </div>
                      <p className="text-xs font-medium text-slate-600 mt-0.5">{persp.subtitulo}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5 hidden sm:block">
                        {persp.descricao}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      onClick={() => handleNovoKpi(persp.id)}
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs font-semibold bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-2xs"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1 text-blue-600" />
                      Adicionar KPI
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                {kpisPersp.length === 0 ? (
                  <div className="py-8 px-4 text-center space-y-2">
                    <p className="text-xs text-slate-500">
                      Nenhum indicador cadastrado para a perspectiva {persp.nome} em {selectedAno}.
                    </p>
                    <Button
                      onClick={() => handleNovoKpi(persp.id)}
                      variant="ghost"
                      size="sm"
                      className="text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Criar primeiro indicador
                    </Button>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-slate-50/80 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                          <th className="py-3 px-4">Indicador (KPI)</th>
                          <th className="py-3 px-3 text-center">Tipo</th>
                          <th className="py-3 px-3 text-right">Meta Pactuada</th>
                          <th className="py-3 px-3 text-right">Resultado Real</th>
                          <th className="py-3 px-3 text-center">Sentido</th>
                          <th className="py-3 px-4 min-w-[160px]">Progresso da Meta</th>
                          <th className="py-3 px-3 text-center">Peso</th>
                          <th className="py-3 px-3 text-center">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {kpisPersp.map((kpi) => {
                          const apurado = getValorApurado(kpi)
                          const atingimento = calcularAtingimentoKpi(kpi)

                          let metaFormatada = ''
                          if (kpi.unidade === 'R$') {
                            metaFormatada = formatCurrency(kpi.meta)
                          } else if (kpi.unidade === '%') {
                            metaFormatada = formatPercent(kpi.meta, 1)
                          } else if (
                            kpi.unidade === 'dias' ||
                            kpi.unidade === 'un' ||
                            kpi.unidade === 'horas'
                          ) {
                            metaFormatada = `${formatNumber(kpi.meta, 0)} ${kpi.unidade}`
                          } else {
                            metaFormatada =
                              `${formatNumber(kpi.meta, 2)} ${kpi.unidade || ''}`.trim()
                          }

                          return (
                            <tr key={kpi.id} className="hover:bg-slate-50/70 transition-colors">
                              {/* Nome e Descrição */}
                              <td className="py-3.5 px-4">
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-1.5 font-bold text-slate-900 text-xs sm:text-sm">
                                    <span>{kpi.nome}</span>
                                    {kpi.tipo === 'auto' && (
                                      <span
                                        className="text-[9px] bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.2 rounded font-medium"
                                        title="Indicador recalculado em tempo real com base no Balanço Patrimonial e DRE"
                                      >
                                        Auto (Balanço/DRE)
                                      </span>
                                    )}
                                  </div>
                                  {kpi.descricao && (
                                    <p className="text-[11px] text-slate-500 line-clamp-1 max-w-md">
                                      {kpi.descricao}
                                    </p>
                                  )}
                                </div>
                              </td>

                              {/* Tipo */}
                              <td className="py-3.5 px-3 text-center">
                                {kpi.tipo === 'auto' ? (
                                  <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-[10px]">
                                    Automático
                                  </Badge>
                                ) : (
                                  <Badge className="bg-slate-100 text-slate-700 border-slate-200 text-[10px]">
                                    Manual
                                  </Badge>
                                )}
                              </td>

                              {/* Meta */}
                              <td className="py-3.5 px-3 text-right font-mono font-bold text-slate-800">
                                {metaFormatada}
                              </td>

                              {/* Real Apurado */}
                              <td className="py-3.5 px-3 text-right font-mono font-bold">
                                {apurado.disponivel ? (
                                  <span className="text-slate-900">{apurado.formatado}</span>
                                ) : (
                                  <span className="text-amber-600 text-[11px] font-normal italic">
                                    Pendente DRE/Balanço
                                  </span>
                                )}
                              </td>

                              {/* Sentido */}
                              <td className="py-3.5 px-3 text-center">
                                {kpi.sentido === 'maior_melhor' ? (
                                  <span
                                    className="inline-flex items-center gap-0.5 text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full"
                                    title="Maior é melhor (ex: receita, lucros, margens, satisfação)"
                                  >
                                    <ArrowUpRight className="w-3 h-3" /> Maior
                                  </span>
                                ) : (
                                  <span
                                    className="inline-flex items-center gap-0.5 text-[10px] text-blue-700 font-semibold bg-blue-50 px-2 py-0.5 rounded-full"
                                    title="Menor é melhor (ex: endividamento, custos, tempo, defeitos)"
                                  >
                                    <ArrowDownRight className="w-3 h-3" /> Menor
                                  </span>
                                )}
                              </td>

                              {/* Barra de Progresso e % de Atingimento */}
                              <td className="py-3.5 px-4">
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between text-[11px]">
                                    <span
                                      className={`font-semibold font-mono flex items-center gap-1 ${
                                        atingimento.status === 'atingido'
                                          ? 'text-emerald-700'
                                          : atingimento.status === 'proximo'
                                            ? 'text-amber-700'
                                            : atingimento.status === 'abaixo'
                                              ? 'text-red-700'
                                              : 'text-slate-400'
                                      }`}
                                    >
                                      {atingimento.status === 'atingido' && (
                                        <CheckCircle2 className="w-3 h-3" />
                                      )}
                                      {atingimento.status === 'proximo' && (
                                        <AlertTriangle className="w-3 h-3" />
                                      )}
                                      {atingimento.status === 'abaixo' && (
                                        <XCircle className="w-3 h-3" />
                                      )}
                                      {atingimento.status === 'indefinido'
                                        ? 'N/D'
                                        : `${atingimento.pct}%`}
                                    </span>
                                    <span className="text-[10px] text-slate-500">
                                      {atingimento.status === 'atingido'
                                        ? '🟢 Atingido'
                                        : atingimento.status === 'proximo'
                                          ? '🟡 Próximo'
                                          : atingimento.status === 'abaixo'
                                            ? '🔴 Abaixo'
                                            : 'Sem dados'}
                                    </span>
                                  </div>
                                  <Progress
                                    value={atingimento.pct}
                                    className={`h-1.5 ${
                                      atingimento.status === 'atingido'
                                        ? '[&>div]:bg-emerald-600'
                                        : atingimento.status === 'proximo'
                                          ? '[&>div]:bg-amber-500'
                                          : '[&>div]:bg-red-500'
                                    }`}
                                  />
                                </div>
                              </td>

                              {/* Peso */}
                              <td className="py-3.5 px-3 text-center font-mono text-slate-600 font-semibold">
                                {kpi.peso || 10}%
                              </td>

                              {/* Ações */}
                              <td className="py-3.5 px-3 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleEditarKpi(kpi)}
                                    className="w-7 h-7 text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                                    title="Editar indicador"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setKpiToDelete(kpi)}
                                    className="w-7 h-7 text-slate-500 hover:text-red-600 hover:bg-red-50"
                                    title="Excluir indicador"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* 4. MODAL DE CRIAÇÃO / EDIÇÃO DE KPI */}
      <Dialog open={modalKpiOpen} onOpenChange={setModalKpiOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#0B1F3A] flex items-center gap-2">
              <Target className="w-5 h-5 text-blue-600" />
              {kpiEmEdicao
                ? 'Editar Indicador Estratégico (KPI)'
                : 'Novo Indicador Estratégico (KPI)'}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Cadastre indicadores manuais ou conecte fórmulas com apuração automática de Balanço e
              DRE.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSalvarKpi} className="space-y-4 py-2">
            {/* Perspectiva */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Perspectiva BSC</Label>
              <Select
                value={formPerspectiva}
                onValueChange={(val) => setFormPerspectiva(val as BscPerspectiva)}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Selecione a perspectiva" />
                </SelectTrigger>
                <SelectContent>
                  {PERSPECTIVAS.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="text-xs">
                      {p.nome} — {p.subtitulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Nome do KPI */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Nome do Indicador *</Label>
              <Input
                value={formNome}
                onChange={(e) => setFormNome(e.target.value)}
                placeholder="Ex: Liquidez Corrente, Satisfação do Cliente (NPS), etc."
                className="h-9 text-xs"
                required
              />
            </div>

            {/* Descrição */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Descrição / Objetivo</Label>
              <Textarea
                value={formDescricao}
                onChange={(e) => setFormDescricao(e.target.value)}
                placeholder="Breve explicação da metodologia, fórmula ou objetivo de negócio."
                className="text-xs min-h-[60px]"
              />
            </div>

            {/* Tipo: Auto ou Manual */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Origem da Apuração</Label>
                <Select value={formTipo} onValueChange={(val) => setFormTipo(val as BscKpiTipo)}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto" className="text-xs">
                      ⚡ Automático (Balanço / DRE)
                    </SelectItem>
                    <SelectItem value="manual" className="text-xs">
                      ✍️ Manual (Digitado pelo Usuário)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Sentido do Indicador */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Sentido Desejado</Label>
                <Select
                  value={formSentido}
                  onValueChange={(val) => setFormSentido(val as BscSentido)}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="maior_melhor" className="text-xs">
                      📈 Quanto MAIOR, melhor
                    </SelectItem>
                    <SelectItem value="menor_melhor" className="text-xs">
                      📉 Quanto MENOR, melhor
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Fórmula se for Auto */}
            {formTipo === 'auto' && (
              <div className="space-y-1.5 bg-blue-50/60 p-3 rounded-xl border border-blue-200">
                <Label className="text-xs font-semibold text-blue-900 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-blue-600" />
                  Métrica Calculada a Partir do Balanço / DRE
                </Label>
                <Select value={formFormula} onValueChange={(val) => setFormFormula(val)}>
                  <SelectTrigger className="h-9 text-xs bg-white border-blue-200">
                    <SelectValue placeholder="Selecione a fórmula vinculada..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="liquidez_corrente">Liquidez Corrente (AC ÷ PC)</SelectItem>
                    <SelectItem value="liquidez_seca">
                      Liquidez Seca ((AC - Estoques) ÷ PC)
                    </SelectItem>
                    <SelectItem value="liquidez_imediata">
                      Liquidez Imediata (Disponível ÷ PC)
                    </SelectItem>
                    <SelectItem value="liquidez_geral">
                      Liquidez Geral ((AC + RLP) ÷ Exigível)
                    </SelectItem>
                    <SelectItem value="endividamento_geral">
                      Endividamento Geral (%) (Passivo ÷ Ativo)
                    </SelectItem>
                    <SelectItem value="composicao_endividamento">
                      Composição do Endividamento (%)
                    </SelectItem>
                    <SelectItem value="margem_bruta">
                      Margem Bruta (%) (Lucro Bruto ÷ Receita Líquida)
                    </SelectItem>
                    <SelectItem value="margem_operacional">Margem Operacional (%)</SelectItem>
                    <SelectItem value="margem_liquida">
                      Margem Líquida (%) (Lucro Líq. ÷ Receita Líq.)
                    </SelectItem>
                    <SelectItem value="roe">Retorno s/ Patrimônio Líquido - ROE (%)</SelectItem>
                    <SelectItem value="roa">Retorno s/ Ativo Total - ROA (%)</SelectItem>
                    <SelectItem value="ebitda">EBITDA / LAJIDA (R$)</SelectItem>
                    <SelectItem value="crescimento_receita">
                      Crescimento de Receita (Ano x Ano Ant. %)
                    </SelectItem>
                    <SelectItem value="pmr">Prazo Médio de Recebimento (PMR em dias)</SelectItem>
                    <SelectItem value="pmp">Prazo Médio de Pagamento (PMP em dias)</SelectItem>
                    <SelectItem value="pme">
                      Prazo Médio de Renovação de Estoques (PME em dias)
                    </SelectItem>
                    <SelectItem value="ciclo_operacional">Ciclo Operacional (dias)</SelectItem>
                    <SelectItem value="ciclo_financeiro">Ciclo Financeiro (dias)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-blue-700 mt-1">
                  O valor será apurado automaticamente a cada atualização nos lançamentos contábeis.
                </p>
              </div>
            )}

            {/* Metas, Unidade, Valor Atual e Peso */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Meta *</Label>
                <Input
                  type="number"
                  step="any"
                  value={formMeta}
                  onChange={(e) => setFormMeta(e.target.value)}
                  placeholder="Ex: 15"
                  className="h-9 text-xs font-mono"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Unidade</Label>
                <Input
                  value={formUnidade}
                  onChange={(e) => setFormUnidade(e.target.value)}
                  placeholder="%, R$, dias, un"
                  className="h-9 text-xs"
                />
              </div>

              {formTipo === 'manual' ? (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Valor Atual</Label>
                  <Input
                    type="number"
                    step="any"
                    value={formValorAtual}
                    onChange={(e) => setFormValorAtual(e.target.value)}
                    placeholder="Ex: 12"
                    className="h-9 text-xs font-mono"
                  />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-400">Valor Atual</Label>
                  <div className="h-9 flex items-center px-3 bg-slate-100 rounded-md border border-slate-200 text-xs text-slate-600 font-mono">
                    Automático
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Peso (%)</Label>
                <Input
                  type="number"
                  min="1"
                  max="100"
                  value={formPeso}
                  onChange={(e) => setFormPeso(e.target.value)}
                  placeholder="15"
                  className="h-9 text-xs font-mono"
                />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setModalKpiOpen(false)}
                className="text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSaving}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
              >
                {isSaving ? 'Salvando...' : kpiEmEdicao ? 'Salvar Alterações' : 'Cadastrar KPI'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 5. DIÁLOGO DE CONFIRMAÇÃO DE EXCLUSÃO */}
      <AlertDialog open={!!kpiToDelete} onOpenChange={(open) => !open && setKpiToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-slate-900">
              Confirmar exclusão de indicador?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-500">
              Tem certeza que deseja remover o KPI{' '}
              <strong className="text-slate-800 font-semibold">{kpiToDelete?.nome}</strong> do
              Balanced Scorecard? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmarExclusao}
              className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold"
            >
              Excluir KPI
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
