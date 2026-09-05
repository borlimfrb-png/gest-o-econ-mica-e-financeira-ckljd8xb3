import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { bscService } from '@/services/bscService'
import { balancosService, dreService } from '@/services/financeService'
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
  BscKpiRecord,
  BscPerspectiva,
  EmpresaRecord,
  GrupoEmpresarialRecord,
  BalancoRecord,
  DreRecord,
} from '@/types/finance'
import {
  GitCompare,
  Building2,
  TrendingUp,
  Users,
  Cpu,
  GraduationCap,
  Trophy,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  RefreshCw,
  Scale,
  Sparkles,
} from 'lucide-react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  Tooltip as RechartsTooltip,
} from 'recharts'

export interface ModalCompararBscGrupoProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  grupo: GrupoEmpresarialRecord | null
  empresasDoGrupo: EmpresaRecord[]
  ano: number
}

interface PerspectivaItem {
  id: BscPerspectiva
  nome: string
  icon: React.ComponentType<{ className?: string }>
}

const PERSPECTIVAS_LISTA: PerspectivaItem[] = [
  { id: 'financeira', nome: 'Financeira', icon: TrendingUp },
  { id: 'clientes', nome: 'Clientes & Mercado', icon: Users },
  { id: 'processos_internos', nome: 'Processos Internos', icon: Cpu },
  { id: 'aprendizado_crescimento', nome: 'Aprendizado & Crescimento', icon: GraduationCap },
]

export function ModalCompararBscGrupo({
  open,
  onOpenChange,
  grupo,
  empresasDoGrupo,
  ano,
}: ModalCompararBscGrupoProps) {
  // Empresas selecionadas A e B
  const [empresaAId, setEmpresaAId] = useState<string>('')
  const [empresaBId, setEmpresaBId] = useState<string>('')

  // Estados de dados Empresa A
  const [kpisA, setKpisA] = useState<BscKpiRecord[]>([])
  const [balancosA, setBalancosA] = useState<BalancoRecord[]>([])
  const [dresA, setDresA] = useState<DreRecord[]>([])

  // Estados de dados Empresa B
  const [kpisB, setKpisB] = useState<BscKpiRecord[]>([])
  const [balancosB, setBalancosB] = useState<BalancoRecord[]>([])
  const [dresB, setDresB] = useState<DreRecord[]>([])

  const [isLoading, setIsLoading] = useState<boolean>(false)

  // Inicializar seleção padrão quando abre o modal
  useEffect(() => {
    if (open && empresasDoGrupo.length > 0) {
      if (!empresaAId || !empresasDoGrupo.some((e) => e.id === empresaAId)) {
        setEmpresaAId(empresasDoGrupo[0].id)
      }
      if (
        !empresaBId ||
        !empresasDoGrupo.some((e) => e.id === empresaBId) ||
        empresaBId === empresaAId
      ) {
        const outra = empresasDoGrupo.find((e) => e.id !== (empresaAId || empresasDoGrupo[0].id))
        setEmpresaBId(outra ? outra.id : empresasDoGrupo[0].id)
      }
    }
  }, [open, empresasDoGrupo])

  // Carregar dados de A e B
  const carregarDadosComparacao = useCallback(async () => {
    if (!empresaAId || !empresaBId) return
    setIsLoading(true)
    try {
      const [listKpisA, listBalA, listDreA, listKpisB, listBalB, listDreB] = await Promise.all([
        bscService.getByEmpresaEAno(empresaAId, ano).catch(() => [] as BscKpiRecord[]),
        balancosService.getByEmpresa(empresaAId).catch(() => [] as BalancoRecord[]),
        dreService.getByEmpresa(empresaAId).catch(() => [] as DreRecord[]),
        bscService.getByEmpresaEAno(empresaBId, ano).catch(() => [] as BscKpiRecord[]),
        balancosService.getByEmpresa(empresaBId).catch(() => [] as BalancoRecord[]),
        dreService.getByEmpresa(empresaBId).catch(() => [] as DreRecord[]),
      ])

      setKpisA(listKpisA)
      setBalancosA(listBalA)
      setDresA(listDreA)

      setKpisB(listKpisB)
      setBalancosB(listBalB)
      setDresB(listDreB)
    } catch (err) {
      console.error('Erro ao carregar dados comparativos das empresas:', err)
    } finally {
      setIsLoading(false)
    }
  }, [empresaAId, empresaBId, ano])

  useEffect(() => {
    if (open && empresaAId && empresaBId) {
      carregarDadosComparacao()
    }
  }, [open, empresaAId, empresaBId, carregarDadosComparacao])

  // Empresas objetos
  const empresaA = useMemo(
    () => empresasDoGrupo.find((e) => e.id === empresaAId) || null,
    [empresasDoGrupo, empresaAId],
  )
  const empresaB = useMemo(
    () => empresasDoGrupo.find((e) => e.id === empresaBId) || null,
    [empresasDoGrupo, empresaBId],
  )

  // Cálculos contábeis da Empresa A
  const balancoAtualA = useMemo(() => consolidarBalancoAnual(balancosA, ano), [balancosA, ano])
  const dreAtualA = useMemo(() => consolidarDreAnual(dresA, ano), [dresA, ano])
  const dreAnteriorA = useMemo(() => consolidarDreAnual(dresA, ano - 1), [dresA, ano])

  const formulasA = useMemo<Record<string, number | null>>(() => {
    const calcInd = calcularIndicadores(balancoAtualA, dreAtualA)
    const calcD = calcularDre(dreAtualA)
    const calcGiro = calcularCapitalGiro(balancoAtualA, dreAtualA)

    let crescimentoReceita: number | null = null
    const recAtual = calcD.receitaLiquida
    const dreAntCalc = dreAnteriorA ? calcularDre(dreAnteriorA) : null
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
  }, [balancoAtualA, dreAtualA, dreAnteriorA])

  // Cálculos contábeis da Empresa B
  const balancoAtualB = useMemo(() => consolidarBalancoAnual(balancosB, ano), [balancosB, ano])
  const dreAtualB = useMemo(() => consolidarDreAnual(dresB, ano), [dresB, ano])
  const dreAnteriorB = useMemo(() => consolidarDreAnual(dresB, ano - 1), [dresB, ano])

  const formulasB = useMemo<Record<string, number | null>>(() => {
    const calcInd = calcularIndicadores(balancoAtualB, dreAtualB)
    const calcD = calcularDre(dreAtualB)
    const calcGiro = calcularCapitalGiro(balancoAtualB, dreAtualB)

    let crescimentoReceita: number | null = null
    const recAtual = calcD.receitaLiquida
    const dreAntCalc = dreAnteriorB ? calcularDre(dreAnteriorB) : null
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
  }, [balancoAtualB, dreAtualB, dreAnteriorB])

  // Função para calcular atingimento de um KPI
  const calcularAtingimento = useCallback(
    (kpi: BscKpiRecord, formulasAtivas: Record<string, number | null>) => {
      let real: number | null = null
      if (kpi.tipo === 'auto' && kpi.formula) {
        real = formulasAtivas[kpi.formula] ?? null
      } else {
        real = kpi.valor_atual ?? 0
      }

      if (real === null || real === undefined) {
        return { pct: 0, disponivel: false }
      }

      const meta = kpi.meta
      if (meta === 0) return { pct: 100, disponivel: true }

      let pct = 0
      if (kpi.sentido === 'maior_melhor') {
        pct = (real / meta) * 100
      } else {
        if (real <= 0) pct = 120
        else pct = (meta / real) * 100
      }

      const pctClamped = Math.max(0, Math.min(150, pct))
      return { pct: Math.round(pctClamped), disponivel: true }
    },
    [],
  )

  // Calcular score por perspectiva e global para uma lista de KPIs e suas fórmulas
  const calcularScoreCompleto = useCallback(
    (kpisList: BscKpiRecord[], formulas: Record<string, number | null>) => {
      let somaPonderadaGlobal = 0
      let somaPesosGlobal = 0

      const perspectivasResumo = PERSPECTIVAS_LISTA.map((persp) => {
        const kpisPersp = kpisList.filter((k) => k.perspectiva === persp.id)
        let somaPonderada = 0
        let somaPesos = 0
        let validos = 0

        kpisPersp.forEach((k) => {
          const { pct, disponivel } = calcularAtingimento(k, formulas)
          if (disponivel) {
            const peso = k.peso && k.peso > 0 ? k.peso : 10
            somaPonderada += pct * peso
            somaPesos += peso
            validos++
          }
        })

        const score = somaPesos > 0 ? Math.round(somaPonderada / somaPesos) : 0

        if (somaPesos > 0) {
          somaPonderadaGlobal += score * 25
          somaPesosGlobal += 25
        }

        return {
          perspectiva: persp.id,
          nome: persp.nome,
          score,
          totalKpis: kpisPersp.length,
          kpisAvaliados: validos,
        }
      })

      const scoreGlobal =
        somaPesosGlobal > 0 ? Math.round(somaPonderadaGlobal / somaPesosGlobal) : 0

      return {
        scoreGlobal,
        perspectivas: perspectivasResumo,
        totalKpis: kpisList.length,
      }
    },
    [calcularAtingimento],
  )

  // Scores calculados para A e B
  const scoreDataA = useMemo(
    () => calcularScoreCompleto(kpisA, formulasA),
    [calcularScoreCompleto, kpisA, formulasA],
  )
  const scoreDataB = useMemo(
    () => calcularScoreCompleto(kpisB, formulasB),
    [calcularScoreCompleto, kpisB, formulasB],
  )

  // Comparativo e Gráfico Recharts
  const dadosComparativos = useMemo(() => {
    const nomeA = empresaA?.nome_fantasia || empresaA?.nome || 'Empresa A'
    const nomeB = empresaB?.nome_fantasia || empresaB?.nome || 'Empresa B'

    const chartData = PERSPECTIVAS_LISTA.map((p) => {
      const itemA = scoreDataA.perspectivas.find((item) => item.perspectiva === p.id)
      const itemB = scoreDataB.perspectivas.find((item) => item.perspectiva === p.id)

      const sA = itemA?.score ?? 0
      const sB = itemB?.score ?? 0
      const diff = sA - sB

      let lider: 'A' | 'B' | 'empate' = 'empate'
      if (sA > sB) lider = 'A'
      else if (sB > sA) lider = 'B'

      return {
        perspectiva: p.nome,
        id: p.id,
        scoreA: sA,
        scoreB: sB,
        diff,
        lider,
        kpisCountA: itemA?.totalKpis ?? 0,
        kpisCountB: itemB?.totalKpis ?? 0,
      }
    })

    const diffGlobal = scoreDataA.scoreGlobal - scoreDataB.scoreGlobal
    let liderGlobal: 'A' | 'B' | 'empate' = 'empate'
    if (scoreDataA.scoreGlobal > scoreDataB.scoreGlobal) liderGlobal = 'A'
    else if (scoreDataB.scoreGlobal > scoreDataA.scoreGlobal) liderGlobal = 'B'

    return {
      nomeA,
      nomeB,
      chartData,
      diffGlobal,
      liderGlobal,
    }
  }, [empresaA, empresaB, scoreDataA, scoreDataB])

  // Checagens graciosas de dados
  const temDemonstracoesA = !!balancoAtualA && !!dreAtualA
  const temDemonstracoesB = !!balancoAtualB && !!dreAtualB

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-indigo-600 text-white shadow-xs">
              <Scale className="w-5 h-5" />
            </span>
            <div>
              <DialogTitle className="text-base sm:text-lg font-bold text-[#0B1F3A] flex items-center gap-2">
                Comparativo de BSC entre Empresas do Grupo
                <Badge className="bg-indigo-100 text-indigo-800 border-indigo-200 text-xs font-semibold">
                  {grupo?.nome || 'Grupo Ativo'}
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Avaliação simultânea de desempenho estratégico e score por perspectiva no exercício
                de {ano}.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* 1. SELETORES DE EMPRESA A E EMPRESA B */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
              Empresa A (Referência)
            </label>
            <Select value={empresaAId} onValueChange={(val) => setEmpresaAId(val)}>
              <SelectTrigger className="h-9 text-xs bg-white border-blue-200 font-semibold text-slate-800">
                <SelectValue placeholder="Selecione a Empresa A" />
              </SelectTrigger>
              <SelectContent>
                {empresasDoGrupo.map((emp) => (
                  <SelectItem
                    key={emp.id}
                    value={emp.id}
                    className="text-xs"
                    disabled={emp.id === empresaBId}
                  >
                    {emp.nome_fantasia || emp.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-[11px] text-slate-500 block">
              {kpisA.length} KPIs no BSC ·{' '}
              {temDemonstracoesA ? 'Balanço & DRE vinculados' : 'Sem Balanço/DRE em ' + ano}
            </span>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
              Empresa B (Comparada)
            </label>
            <Select value={empresaBId} onValueChange={(val) => setEmpresaBId(val)}>
              <SelectTrigger className="h-9 text-xs bg-white border-emerald-200 font-semibold text-slate-800">
                <SelectValue placeholder="Selecione a Empresa B" />
              </SelectTrigger>
              <SelectContent>
                {empresasDoGrupo.map((emp) => (
                  <SelectItem
                    key={emp.id}
                    value={emp.id}
                    className="text-xs"
                    disabled={emp.id === empresaAId}
                  >
                    {emp.nome_fantasia || emp.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-[11px] text-slate-500 block">
              {kpisB.length} KPIs no BSC ·{' '}
              {temDemonstracoesB ? 'Balanço & DRE vinculados' : 'Sem Balanço/DRE em ' + ano}
            </span>
          </div>
        </div>

        {/* AVISOS GRACIOSOS SE FALTAR DADOS */}
        {(!temDemonstracoesA || !temDemonstracoesB || kpisA.length === 0 || kpisB.length === 0) && (
          <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 space-y-1">
            <div className="flex items-center gap-1.5 font-bold">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              Observação sobre os dados contábeis em {ano}:
            </div>
            <ul className="list-disc list-inside space-y-0.5 text-[11px] text-amber-800">
              {!temDemonstracoesA && (
                <li>
                  <strong>{dadosComparativos.nomeA}:</strong> Não possui Balanço e/ou DRE fechados
                  para {ano}. Indicadores automáticos foram desconsiderados sem quebrar o scorecard.
                </li>
              )}
              {!temDemonstracoesB && (
                <li>
                  <strong>{dadosComparativos.nomeB}:</strong> Não possui Balanço e/ou DRE fechados
                  para {ano}. Indicadores automáticos foram desconsiderados sem quebrar o scorecard.
                </li>
              )}
              {kpisA.length === 0 && (
                <li>
                  <strong>{dadosComparativos.nomeA}:</strong> Não possui indicadores cadastrados no
                  BSC em {ano}.
                </li>
              )}
              {kpisB.length === 0 && (
                <li>
                  <strong>{dadosComparativos.nomeB}:</strong> Não possui indicadores cadastrados no
                  BSC em {ano}.
                </li>
              )}
            </ul>
          </div>
        )}

        {/* 2. PLACAR GLOBAL DO SCORECARD PONDERADO */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Card Empresa A */}
          <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-200">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-blue-900 uppercase tracking-wider">
                {dadosComparativos.nomeA}
              </span>
              {dadosComparativos.liderGlobal === 'A' && (
                <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px] font-bold flex items-center gap-1">
                  <Trophy className="w-3 h-3 text-amber-600" /> Líder Global
                </Badge>
              )}
            </div>
            <div className="text-3xl font-mono font-extrabold text-blue-700 mt-2">
              {scoreDataA.scoreGlobal}%
            </div>
            <span className="text-[11px] text-slate-500">
              Score ponderado global ({kpisA.length} KPIs)
            </span>
            <Progress value={scoreDataA.scoreGlobal} className="h-1.5 mt-2" />
          </div>

          {/* Card Empresa B */}
          <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-emerald-900 uppercase tracking-wider">
                {dadosComparativos.nomeB}
              </span>
              {dadosComparativos.liderGlobal === 'B' && (
                <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px] font-bold flex items-center gap-1">
                  <Trophy className="w-3 h-3 text-amber-600" /> Líder Global
                </Badge>
              )}
            </div>
            <div className="text-3xl font-mono font-extrabold text-emerald-700 mt-2">
              {scoreDataB.scoreGlobal}%
            </div>
            <span className="text-[11px] text-slate-500">
              Score ponderado global ({kpisB.length} KPIs)
            </span>
            <Progress value={scoreDataB.scoreGlobal} className="h-1.5 mt-2" />
          </div>

          {/* Variação e Veredito */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Diferencial Competitivo
            </span>
            <div className="flex items-baseline gap-1 mt-2">
              <span
                className={`text-2xl font-mono font-extrabold flex items-center gap-1 ${
                  dadosComparativos.diffGlobal > 0
                    ? 'text-blue-700'
                    : dadosComparativos.diffGlobal < 0
                      ? 'text-emerald-700'
                      : 'text-slate-700'
                }`}
              >
                {Math.abs(dadosComparativos.diffGlobal)} p.p.
              </span>
              <span className="text-[11px] text-slate-500">
                {dadosComparativos.diffGlobal !== 0
                  ? `de vantagem para ${
                      dadosComparativos.liderGlobal === 'A'
                        ? dadosComparativos.nomeA
                        : dadosComparativos.nomeB
                    }`
                  : 'Empate de pontuação'}
              </span>
            </div>
            <p className="text-[11px] text-slate-600 mt-2">
              {dadosComparativos.liderGlobal === 'A' && (
                <span>
                  <strong>{dadosComparativos.nomeA}</strong> lidera o grupo com maior consistência
                  na execução estratégica.
                </span>
              )}
              {dadosComparativos.liderGlobal === 'B' && (
                <span>
                  <strong>{dadosComparativos.nomeB}</strong> apresenta melhor índice médio de
                  atingimento de metas.
                </span>
              )}
              {dadosComparativos.liderGlobal === 'empate' && (
                <span>Ambas empresas mantêm o mesmo patamar global ponderado no período.</span>
              )}
            </p>
          </div>
        </div>

        {/* 3. GRÁFICO RECHARTS LADO A LADO DAS 4 PERSPECTIVAS */}
        <div className="space-y-2 pt-2">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Atingimento por Perspectiva (Empresa A vs. Empresa B)
          </h3>
          <div className="h-64 sm:h-72 w-full bg-slate-50/50 p-2 rounded-xl border border-slate-200">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={dadosComparativos.chartData}
                margin={{ top: 15, right: 20, left: -10, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis
                  dataKey="perspectiva"
                  tick={{ fill: '#334155', fontSize: 11, fontWeight: 600 }}
                />
                <YAxis domain={[0, 100]} tick={{ fill: '#64748B', fontSize: 10 }} unit="%" />
                <RechartsTooltip
                  formatter={(value: any, name: any) => [`${value}%`, name]}
                  contentStyle={{
                    backgroundColor: '#0B1F3A',
                    borderColor: '#1E293B',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                />
                <Legend
                  verticalAlign="top"
                  align="right"
                  iconType="circle"
                  wrapperStyle={{ fontSize: '11px', paddingBottom: '10px' }}
                />
                <Bar
                  dataKey="scoreA"
                  name={dadosComparativos.nomeA}
                  fill="#2563EB"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="scoreB"
                  name={dadosComparativos.nomeB}
                  fill="#10B981"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 4. TABELA DE COMPARAÇÃO COM SCORE, VARIAÇÃO E DESTAQUE DE LIDERANÇA */}
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] border-b border-slate-200">
                <th className="py-3 px-3">Perspectiva BSC</th>
                <th className="py-3 px-3 text-center text-blue-900">
                  Score {dadosComparativos.nomeA}
                </th>
                <th className="py-3 px-3 text-center text-emerald-900">
                  Score {dadosComparativos.nomeB}
                </th>
                <th className="py-3 px-3 text-center">Diferença (p.p.)</th>
                <th className="py-3 px-3 text-center">Empresa Líder na Perspectiva</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[11px]">
              {dadosComparativos.chartData.map((item) => {
                const isLiderA = item.lider === 'A'
                const isLiderB = item.lider === 'B'
                const isEmpate = item.lider === 'empate'

                return (
                  <tr key={item.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-3 font-semibold text-slate-900">{item.perspectiva}</td>
                    <td className="py-3 px-3 text-center font-mono font-bold text-blue-700">
                      {item.scoreA}%
                    </td>
                    <td className="py-3 px-3 text-center font-mono font-bold text-emerald-700">
                      {item.scoreB}%
                    </td>
                    <td className="py-3 px-3 text-center font-mono font-semibold text-slate-700">
                      {item.diff > 0 ? `+${item.diff}` : item.diff} p.p.
                    </td>
                    <td className="py-3 px-3 text-center">
                      {isLiderA && (
                        <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-[10px] font-bold">
                          🏆 {dadosComparativos.nomeA} (+{item.diff} p.p.)
                        </Badge>
                      )}
                      {isLiderB && (
                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px] font-bold">
                          🏆 {dadosComparativos.nomeB} (+{Math.abs(item.diff)} p.p.)
                        </Badge>
                      )}
                      {isEmpate && (
                        <Badge variant="outline" className="text-[10px] text-slate-500">
                          ⚖️ Empate Técnico ({item.scoreA}%)
                        </Badge>
                      )}
                    </td>
                  </tr>
                )
              })}
              {/* Linha Totalizadora Global */}
              <tr className="bg-slate-100/70 font-bold border-t-2 border-slate-200">
                <td className="py-3 px-3 text-slate-900 uppercase">Scorecard Global Ponderado</td>
                <td className="py-3 px-3 text-center font-mono text-sm text-blue-700">
                  {scoreDataA.scoreGlobal}%
                </td>
                <td className="py-3 px-3 text-center font-mono text-sm text-emerald-700">
                  {scoreDataB.scoreGlobal}%
                </td>
                <td className="py-3 px-3 text-center font-mono text-slate-800">
                  {dadosComparativos.diffGlobal > 0
                    ? `+${dadosComparativos.diffGlobal}`
                    : dadosComparativos.diffGlobal}{' '}
                  p.p.
                </td>
                <td className="py-3 px-3 text-center">
                  <Badge
                    className={`text-[10px] font-bold ${
                      dadosComparativos.liderGlobal === 'A'
                        ? 'bg-blue-600 text-white'
                        : dadosComparativos.liderGlobal === 'B'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-600 text-white'
                    }`}
                  >
                    {dadosComparativos.liderGlobal === 'A'
                      ? `Liderança: ${dadosComparativos.nomeA}`
                      : dadosComparativos.liderGlobal === 'B'
                        ? `Liderança: ${dadosComparativos.nomeB}`
                        : 'Equilíbrio Total'}
                  </Badge>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <DialogFooter className="pt-2 border-t border-slate-100 flex items-center justify-between">
          <p className="text-[11px] text-slate-500">
            Comparação exclusiva para Administradores de Grupos Empresariais consolidados.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs"
          >
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default ModalCompararBscGrupo
