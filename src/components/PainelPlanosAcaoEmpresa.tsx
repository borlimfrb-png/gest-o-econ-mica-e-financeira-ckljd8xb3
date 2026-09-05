import React, { useState, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { bscService } from '@/services/bscService'
import type {
  BscKpiRecord,
  BscIniciativaRecord,
  BscIniciativaStatus,
  EmpresaRecord,
} from '@/types/finance'
import {
  ListTodo,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Flame,
  Search,
  Filter,
  Calendar,
  User,
  Pencil,
  Plus,
  RefreshCw,
  TrendingDown,
  Target,
  Building2,
  Sparkles,
} from 'lucide-react'

export interface PainelPlanosAcaoEmpresaProps {
  empresa: EmpresaRecord | null
  empresaId: string
  anoAtivo: number
  anosDisponiveis: number[]
  kpis: BscKpiRecord[]
  iniciativas: BscIniciativaRecord[]
  isLoading?: boolean
  onRecarregar: () => Promise<void>
  onEditarPlano: (plano: BscIniciativaRecord, kpi: BscKpiRecord | null) => void
  onNovoPlano: (kpiPadrao?: BscKpiRecord | null) => void
  calcularAtingimentoKpi: (kpi: BscKpiRecord) => {
    pct: number
    status: 'atingido' | 'proximo' | 'abaixo' | 'indefinido'
  }
}

export function PainelPlanosAcaoEmpresa({
  empresa,
  empresaId,
  anoAtivo,
  anosDisponiveis,
  kpis,
  iniciativas,
  isLoading = false,
  onRecarregar,
  onEditarPlano,
  onNovoPlano,
  calcularAtingimentoKpi,
}: PainelPlanosAcaoEmpresaProps) {
  const { toast } = useToast()

  // Filtros locais
  const [filtroAno, setFiltroAno] = useState<string>('todos') // 'todos' ou ano específico como string
  const [filtroStatus, setFiltroStatus] = useState<string>('todos')
  const [buscaTexto, setBuscaTexto] = useState<string>('')
  const [filtroCritico, setFiltroCritico] = useState<boolean>(false) // se apenas planos de KPIs críticos
  const [isUpdatingId, setIsUpdatingId] = useState<string | null>(null)

  // Mapa de KPI por ID para acesso rápido
  const mapaKpis = useMemo(() => {
    const map = new Map<string, BscKpiRecord>()
    kpis.forEach((k) => map.set(k.id, k))
    return map
  }, [kpis])

  // KPIs Críticos (atingimento < 70%)
  const kpisCriticos = useMemo(() => {
    return kpis.filter((k) => {
      const at = calcularAtingimentoKpi(k)
      return at.status === 'abaixo' // < 70%
    })
  }, [kpis, calcularAtingimentoKpi])

  // Mapa de cálculo de atingimento por KPI
  const mapaAtingimento = useMemo(() => {
    const map = new Map<
      string,
      { pct: number; status: 'atingido' | 'proximo' | 'abaixo' | 'indefinido' }
    >()
    kpis.forEach((k) => {
      map.set(k.id, calcularAtingimentoKpi(k))
    })
    return map
  }, [kpis, calcularAtingimentoKpi])

  // Identificação de prazos e datas
  const hojeStr = useMemo(() => new Date().toISOString().split('T')[0], [])
  const daqui30Str = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() + 30)
    return d.toISOString().split('T')[0]
  }, [])

  // Filtragem da lista de iniciativas
  const iniciativasFiltradas = useMemo(() => {
    return iniciativas.filter((ini) => {
      // Filtro por ano
      if (filtroAno !== 'todos' && String(ini.ano) !== filtroAno) {
        return false
      }

      // Filtro por status
      if (filtroStatus !== 'todos') {
        if (filtroStatus === 'atrasadas') {
          if (ini.status === 'concluida' || !ini.prazo) return false
          if (ini.prazo.split('T')[0] >= hojeStr) return false
        } else if (filtroStatus === 'vencendo_30d') {
          if (ini.status === 'concluida' || !ini.prazo) return false
          const p = ini.prazo.split('T')[0]
          if (p < hojeStr || p > daqui30Str) return false
        } else if (ini.status !== filtroStatus) {
          return false
        }
      }

      // Filtro apenas de KPIs críticos
      if (filtroCritico) {
        const kpi = mapaKpis.get(ini.kpi) || ini.expand?.kpi
        if (!kpi) return false
        const at = mapaAtingimento.get(kpi.id)
        if (at?.status !== 'abaixo') return false
      }

      // Busca por título, responsável ou nome do KPI
      if (buscaTexto.trim()) {
        const q = buscaTexto.toLowerCase().trim()
        const kpi = mapaKpis.get(ini.kpi) || ini.expand?.kpi
        const matchTitulo = ini.titulo.toLowerCase().includes(q)
        const matchResp = (ini.responsavel || '').toLowerCase().includes(q)
        const matchDesc = (ini.descricao || '').toLowerCase().includes(q)
        const matchKpi = (kpi?.nome || '').toLowerCase().includes(q)
        if (!matchTitulo && !matchResp && !matchDesc && !matchKpi) {
          return false
        }
      }

      return true
    })
  }, [
    iniciativas,
    filtroAno,
    filtroStatus,
    filtroCritico,
    buscaTexto,
    hojeStr,
    daqui30Str,
    mapaKpis,
    mapaAtingimento,
  ])

  // Estatísticas e contadores gerais da empresa selecionada (considerando o filtro de ano selecionado ou todos)
  const resumoEstatisticas = useMemo(() => {
    const baseIniciativas =
      filtroAno === 'todos' ? iniciativas : iniciativas.filter((i) => String(i.ano) === filtroAno)

    const total = baseIniciativas.length
    const concluidas = baseIniciativas.filter((i) => i.status === 'concluida').length
    const abertas = baseIniciativas.filter(
      (i) => i.status === 'planejada' || i.status === 'em_andamento',
    ).length

    const vencendo30d = baseIniciativas.filter((i) => {
      if (i.status === 'concluida' || !i.prazo) return false
      const p = i.prazo.split('T')[0]
      return p >= hojeStr && p <= daqui30Str
    }).length

    const atrasadas = baseIniciativas.filter((i) => {
      if (i.status === 'concluida' || !i.prazo) return false
      return i.prazo.split('T')[0] < hojeStr
    }).length

    const taxaConclusao = total > 0 ? Math.round((concluidas / total) * 100) : 0

    return {
      total,
      concluidas,
      abertas,
      vencendo30d,
      atrasadas,
      taxaConclusao,
    }
  }, [iniciativas, filtroAno, hojeStr, daqui30Str])

  // Atualização rápida inline de status ou conclusão
  const handleAlternarConclusaoInline = async (ini: BscIniciativaRecord) => {
    try {
      setIsUpdatingId(ini.id)
      const novoStatus: BscIniciativaStatus =
        ini.status === 'concluida' ? 'em_andamento' : 'concluida'
      const novoProgresso = novoStatus === 'concluida' ? 100 : 50

      await bscService.updateIniciativa(ini.id, {
        status: novoStatus,
        progresso: novoProgresso,
      })

      toast({
        title: novoStatus === 'concluida' ? 'Plano concluído! 🎉' : 'Plano reaberto',
        description: `O status da iniciativa "${ini.titulo}" foi atualizado.`,
      })
      await onRecarregar()
    } catch (err) {
      console.error('Erro ao atualizar status inline:', err)
      toast({
        title: 'Erro ao atualizar plano',
        description: 'Não foi possível alterar o status. Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setIsUpdatingId(null)
    }
  }

  // Atualização rápida inline de progresso (%)
  const handleAlterarProgressoInline = async (ini: BscIniciativaRecord, novoProgresso: number) => {
    const val = Math.min(100, Math.max(0, novoProgresso))
    try {
      setIsUpdatingId(ini.id)
      const novoStatus: BscIniciativaStatus =
        val === 100 ? 'concluida' : val > 0 ? 'em_andamento' : ini.status

      await bscService.updateIniciativa(ini.id, {
        progresso: val,
        status: novoStatus,
      })
      await onRecarregar()
    } catch (err) {
      console.error('Erro ao alterar progresso inline:', err)
      toast({
        title: 'Erro ao alterar progresso',
        variant: 'destructive',
      })
    } finally {
      setIsUpdatingId(null)
    }
  }

  // Atualização rápida inline de status via Select
  const handleAlterarStatusInline = async (
    ini: BscIniciativaRecord,
    novoStatus: BscIniciativaStatus,
  ) => {
    try {
      setIsUpdatingId(ini.id)
      const novoProgresso =
        novoStatus === 'concluida' ? 100 : ini.progresso === 100 ? 75 : (ini.progresso ?? 0)

      await bscService.updateIniciativa(ini.id, {
        status: novoStatus,
        progresso: novoProgresso,
      })
      toast({
        title: 'Status atualizado',
        description: `Iniciativa alterada para ${
          novoStatus === 'concluida'
            ? 'Concluída'
            : novoStatus === 'em_andamento'
              ? 'Em Andamento'
              : novoStatus === 'planejada'
                ? 'Planejada'
                : 'Cancelada'
        }.`,
      })
      await onRecarregar()
    } catch (err) {
      console.error('Erro ao alterar status:', err)
      toast({
        title: 'Erro ao atualizar',
        variant: 'destructive',
      })
    } finally {
      setIsUpdatingId(null)
    }
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* 1. CABEÇALHO DO PAINEL DE PLANOS */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="p-2 rounded-xl bg-red-600 text-white shadow-xs">
              <Flame className="w-5 h-5" />
            </span>
            <h2 className="text-lg sm:text-xl font-bold text-[#0B1F3A] tracking-tight">
              Painel de Planos de Ação &amp; Iniciativas Estratégicas
            </h2>
            <Badge className="bg-slate-100 text-slate-800 border-slate-200 text-xs font-semibold flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-slate-500" />
              {empresa?.nome_fantasia || empresa?.nome || 'Empresa Ativa'}
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-600">
            Visão consolidada de todas as iniciativas corretivas e projetos vinculados aos KPIs do
            Balanced Scorecard, com foco prioritário em metas críticas (&lt; 70%).
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            onClick={() => onRecarregar()}
            variant="outline"
            size="sm"
            disabled={isLoading}
            className="h-9 text-xs font-semibold border-slate-200 text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>

          <Button
            onClick={() => onNovoPlano(null)}
            size="sm"
            className="h-9 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Novo Plano de Ação
          </Button>
        </div>
      </div>

      {/* 2. CARDS RESUMO DE INDICADORES / KPI METRICS */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* Total Cadastradas */}
        <Card className="bg-white border-slate-200 shadow-2xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Total de Planos
              </span>
              <div className="text-2xl font-mono font-extrabold text-[#0B1F3A]">
                {resumoEstatisticas.total}
              </div>
              <span className="text-[10px] text-slate-500">
                {resumoEstatisticas.taxaConclusao}% concluídos
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
              <ListTodo className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        {/* Em Aberto */}
        <Card className="bg-white border-slate-200 shadow-2xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Abertas / Em Curso
              </span>
              <div className="text-2xl font-mono font-extrabold text-blue-600">
                {resumoEstatisticas.abertas}
              </div>
              <span className="text-[10px] text-blue-700 font-medium">Aguardando entrega</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        {/* Vencendo em 30 Dias */}
        <Card className="bg-white border-amber-200 shadow-2xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider block">
                Vencendo em 30d
              </span>
              <div className="text-2xl font-mono font-extrabold text-amber-700">
                {resumoEstatisticas.vencendo30d}
              </div>
              <span className="text-[10px] text-amber-700 font-medium">Atenção ao cronograma</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        {/* Atrasadas */}
        <Card
          className={`shadow-2xs ${
            resumoEstatisticas.atrasadas > 0
              ? 'bg-red-50/40 border-red-300'
              : 'bg-white border-slate-200'
          }`}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-red-700 uppercase tracking-wider block">
                Atrasadas
              </span>
              <div className="text-2xl font-mono font-extrabold text-red-700">
                {resumoEstatisticas.atrasadas}
              </div>
              <span className="text-[10px] text-red-600 font-medium">
                Prazo limite ultrapassado
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-red-100 text-red-700 flex items-center justify-center shrink-0">
              <Flame className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        {/* Concluídas */}
        <Card className="bg-white border-emerald-200 shadow-2xs col-span-2 sm:col-span-1">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">
                Concluídas
              </span>
              <div className="text-2xl font-mono font-extrabold text-emerald-700">
                {resumoEstatisticas.concluidas}
              </div>
              <span className="text-[10px] text-emerald-700 font-medium">Metas finalizadas</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 3. ALERTA DE KPIS CRÍTICOS DA EMPRESA QUE PRECISAM DE AÇÃO */}
      {kpisCriticos.length > 0 && (
        <div className="bg-red-50/90 border border-red-200 rounded-2xl p-4 sm:p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="p-2 rounded-xl bg-red-600 text-white shrink-0 mt-0.5">
                <AlertTriangle className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-red-950 flex items-center gap-2">
                  Atenção: {kpisCriticos.length}{' '}
                  {kpisCriticos.length === 1 ? 'indicador está' : 'indicadores estão'} com
                  atingimento crítico (🔴 &lt; 70%)
                </h3>
                <p className="text-xs text-red-800 mt-0.5">
                  Recomendamos a criação imediata de planos de ação para reverter desvios
                  orçamentários, de liquidez ou operacionais nestes KPIs.
                </p>
              </div>
            </div>

            <Button
              onClick={() => setFiltroCritico(!filtroCritico)}
              size="sm"
              variant={filtroCritico ? 'default' : 'outline'}
              className={`text-xs font-semibold h-8 shrink-0 ${
                filtroCritico
                  ? 'bg-red-700 hover:bg-red-800 text-white'
                  : 'border-red-300 text-red-800 hover:bg-red-100'
              }`}
            >
              {filtroCritico ? 'Exibindo Apenas Críticos' : 'Filtrar Planos de KPIs Críticos'}
            </Button>
          </div>

          <div className="mt-3 pt-3 border-t border-red-200/70 flex flex-wrap gap-2">
            {kpisCriticos.map((kpi) => {
              const at = mapaAtingimento.get(kpi.id)
              const temIniciativas = iniciativas.some((i) => i.kpi === kpi.id)
              return (
                <div
                  key={kpi.id}
                  className="bg-white/90 border border-red-200 rounded-lg px-2.5 py-1 text-xs flex items-center gap-2"
                >
                  <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
                  <span className="font-semibold text-slate-800">{kpi.nome}:</span>
                  <span className="font-mono font-bold text-red-700">{at?.pct ?? 0}%</span>
                  <Badge
                    variant="outline"
                    className={`text-[9px] px-1 py-0 ${
                      temIniciativas
                        ? 'border-emerald-300 text-emerald-800 bg-emerald-50'
                        : 'border-red-300 text-red-700 bg-red-50'
                    }`}
                  >
                    {temIniciativas ? 'Com Plano Vinculado' : 'Sem Plano!'}
                  </Badge>
                  {!temIniciativas && (
                    <Button
                      onClick={() => onNovoPlano(kpi)}
                      size="sm"
                      variant="ghost"
                      className="h-6 px-1.5 text-[10px] text-red-700 hover:bg-red-100 font-bold"
                    >
                      + Criar Plano
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 4. BARRA DE FILTROS E BUSCA */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <Input
              value={buscaTexto}
              onChange={(e) => setBuscaTexto(e.target.value)}
              placeholder="Buscar por plano, responsável ou KPI..."
              className="pl-9 text-xs h-9"
            />
          </div>

          {/* Filtro por Ano */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-xs text-slate-500 font-medium hidden sm:inline">Ano:</span>
            <Select value={filtroAno} onValueChange={(val) => setFiltroAno(val)}>
              <SelectTrigger className="h-9 text-xs w-[110px]">
                <SelectValue placeholder="Ano" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos" className="text-xs">
                  Todos os Anos
                </SelectItem>
                {anosDisponiveis.map((ano) => (
                  <SelectItem key={ano} value={String(ano)} className="text-xs">
                    {ano} {ano === anoAtivo ? '(Ativo)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Filtro por Status */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-xs text-slate-500 font-medium hidden sm:inline">Status:</span>
            <Select value={filtroStatus} onValueChange={(val) => setFiltroStatus(val)}>
              <SelectTrigger className="h-9 text-xs w-[130px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos" className="text-xs">
                  Todos Status
                </SelectItem>
                <SelectItem value="planejada" className="text-xs">
                  🟡 Planejada
                </SelectItem>
                <SelectItem value="em_andamento" className="text-xs">
                  🔵 Em Andamento
                </SelectItem>
                <SelectItem value="vencendo_30d" className="text-xs">
                  🟠 Vencendo em 30d
                </SelectItem>
                <SelectItem value="atrasadas" className="text-xs">
                  🔴 Atrasadas
                </SelectItem>
                <SelectItem value="concluida" className="text-xs">
                  🟢 Concluída
                </SelectItem>
                <SelectItem value="cancelada" className="text-xs">
                  ⚪ Cancelada
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-2 justify-between sm:justify-end text-xs text-slate-500">
          <span>
            Mostrando <strong>{iniciativasFiltradas.length}</strong> de{' '}
            <strong>{iniciativas.length}</strong> iniciativas
          </span>
          {(buscaTexto || filtroAno !== 'todos' || filtroStatus !== 'todos' || filtroCritico) && (
            <Button
              onClick={() => {
                setBuscaTexto('')
                setFiltroAno('todos')
                setFiltroStatus('todos')
                setFiltroCritico(false)
              }}
              variant="ghost"
              size="sm"
              className="text-xs text-blue-600 hover:text-blue-800 h-8 px-2"
            >
              Limpar Filtros
            </Button>
          )}
        </div>
      </div>

      {/* 5. LISTAGEM CONSOLIDADA DE PLANOS DE AÇÃO */}
      <Card className="bg-white border-slate-200 shadow-xs overflow-hidden">
        <CardHeader className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm sm:text-base font-bold text-[#0B1F3A] flex items-center gap-2">
              <ListTodo className="w-4 h-4 text-blue-600" />
              Planos de Ação Cadastrados
            </CardTitle>
            <Badge variant="outline" className="text-xs font-mono font-medium">
              {iniciativasFiltradas.length} {iniciativasFiltradas.length === 1 ? 'item' : 'itens'}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-16 text-center text-xs text-slate-500 flex flex-col items-center justify-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
              <span>Carregando planos de ação da empresa...</span>
            </div>
          ) : iniciativasFiltradas.length === 0 ? (
            <div className="py-16 px-4 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                <ListTodo className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-700">Nenhum plano de ação encontrado</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {buscaTexto || filtroStatus !== 'todos' || filtroCritico
                  ? 'Nenhum resultado corresponde aos filtros aplicados. Tente ajustar os parâmetros de busca.'
                  : 'Crie iniciativas corretivas vinculadas aos indicadores do BSC para acompanhar o plano de recuperação e metas.'}
              </p>
              <Button
                onClick={() => onNovoPlano(null)}
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Criar Primeiro Plano de Ação
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50/90 text-slate-600 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                    <th className="py-3 px-4 w-12 text-center">Status</th>
                    <th className="py-3 px-3">Plano de Ação / Escopo</th>
                    <th className="py-3 px-3 min-w-[200px]">KPI de Origem &amp; Semáforo</th>
                    <th className="py-3 px-3">Responsável</th>
                    <th className="py-3 px-3 text-center">Prazo Limite</th>
                    <th className="py-3 px-4 min-w-[150px]">Progresso</th>
                    <th className="py-3 px-3 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {iniciativasFiltradas.map((ini) => {
                    const isConcluida = ini.status === 'concluida'
                    const prazoFormatado = ini.prazo
                      ? new Date(ini.prazo).toLocaleDateString('pt-BR')
                      : 'Sem prazo'

                    const isAtrasado =
                      ini.prazo && ini.prazo.split('T')[0] < hojeStr && !isConcluida
                    const isVencendo30d =
                      ini.prazo &&
                      ini.prazo.split('T')[0] >= hojeStr &&
                      ini.prazo.split('T')[0] <= daqui30Str &&
                      !isConcluida

                    // KPI Vinculado
                    const kpiVinculado = mapaKpis.get(ini.kpi) || ini.expand?.kpi || null
                    const atingimentoKpi = kpiVinculado
                      ? mapaAtingimento.get(kpiVinculado.id) || calcularAtingimentoKpi(kpiVinculado)
                      : null

                    const isKpiCritico = atingimentoKpi?.status === 'abaixo'

                    return (
                      <tr
                        key={ini.id}
                        className={`transition-colors ${
                          isConcluida
                            ? 'bg-slate-50/50 opacity-85 hover:bg-slate-50'
                            : isAtrasado
                              ? 'bg-red-50/30 hover:bg-red-50/50'
                              : 'hover:bg-slate-50/80'
                        }`}
                      >
                        {/* Checkbox de Conclusão Rápida */}
                        <td className="py-3.5 px-4 text-center">
                          <button
                            type="button"
                            disabled={isUpdatingId === ini.id}
                            onClick={() => handleAlternarConclusaoInline(ini)}
                            className={`w-6 h-6 rounded-md border flex items-center justify-center transition-all mx-auto ${
                              isConcluida
                                ? 'bg-emerald-600 border-emerald-600 text-white shadow-2xs'
                                : 'border-slate-300 hover:border-blue-500 bg-white'
                            }`}
                            title={isConcluida ? 'Marcar em andamento' : 'Marcar como concluída'}
                          >
                            {isConcluida ? (
                              <CheckCircle2 className="w-4 h-4" />
                            ) : (
                              <span className="w-2 h-2 rounded-full bg-slate-300 hover:bg-blue-400" />
                            )}
                          </button>
                        </td>

                        {/* Título, Descrição e Exercício */}
                        <td className="py-3.5 px-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className={`font-bold text-xs sm:text-sm leading-tight ${
                                  isConcluida
                                    ? 'line-through text-slate-500'
                                    : isAtrasado
                                      ? 'text-red-950 font-extrabold'
                                      : 'text-slate-900'
                                }`}
                              >
                                {ini.titulo}
                              </span>
                              <Badge variant="outline" className="text-[9px] px-1.5 py-0 font-mono">
                                Exercício {ini.ano}
                              </Badge>
                              {isAtrasado && (
                                <Badge className="bg-red-100 text-red-800 border-red-200 text-[9px] px-1 py-0 font-bold">
                                  Atrasada
                                </Badge>
                              )}
                              {isVencendo30d && (
                                <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-[9px] px-1 py-0 font-bold">
                                  Vence em 30d
                                </Badge>
                              )}
                            </div>

                            {ini.descricao && (
                              <p className="text-[11px] text-slate-500 line-clamp-2 max-w-md">
                                {ini.descricao}
                              </p>
                            )}
                          </div>
                        </td>

                        {/* KPI de Origem com Semáforo e Atingimento */}
                        <td className="py-3.5 px-3">
                          {kpiVinculado ? (
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <Target className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                <span className="font-semibold text-slate-900 text-xs">
                                  {kpiVinculado.nome}
                                </span>
                              </div>

                              <div className="flex items-center gap-2 text-[11px]">
                                {atingimentoKpi && (
                                  <>
                                    <span
                                      className={`inline-flex items-center gap-1 font-mono font-bold text-[10px] px-1.5 py-0.2 rounded border ${
                                        atingimentoKpi.status === 'atingido'
                                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                          : atingimentoKpi.status === 'proximo'
                                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                                            : atingimentoKpi.status === 'abaixo'
                                              ? 'bg-red-50 text-red-800 border-red-200'
                                              : 'bg-slate-50 text-slate-600 border-slate-200'
                                      }`}
                                    >
                                      {atingimentoKpi.status === 'atingido' && '🟢'}
                                      {atingimentoKpi.status === 'proximo' && '🟡'}
                                      {atingimentoKpi.status === 'abaixo' && '🔴'}
                                      {atingimentoKpi.pct}% atingido
                                    </span>

                                    <span className="text-[10px] text-slate-500 font-mono">
                                      Meta: {kpiVinculado.meta} {kpiVinculado.unidade || ''}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">
                              KPI não localizado
                            </span>
                          )}
                        </td>

                        {/* Responsável */}
                        <td className="py-3.5 px-3">
                          {ini.responsavel ? (
                            <div className="flex items-center gap-1.5 text-slate-700">
                              <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="font-medium text-xs">{ini.responsavel}</span>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">Não atribuído</span>
                          )}
                        </td>

                        {/* Prazo */}
                        <td className="py-3.5 px-3 text-center">
                          <div className="inline-flex items-center gap-1 font-mono text-xs">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            <span
                              className={
                                isAtrasado
                                  ? 'text-red-700 font-bold'
                                  : isVencendo30d
                                    ? 'text-amber-700 font-semibold'
                                    : 'text-slate-700'
                              }
                            >
                              {prazoFormatado}
                            </span>
                          </div>
                        </td>

                        {/* Progresso com Controle Inline */}
                        <td className="py-3.5 px-4">
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-[11px]">
                              {/* Seletor Inline de Status */}
                              <Select
                                value={ini.status}
                                onValueChange={(val) =>
                                  handleAlterarStatusInline(ini, val as BscIniciativaStatus)
                                }
                                disabled={isUpdatingId === ini.id}
                              >
                                <SelectTrigger className="h-6 text-[10px] py-0 px-1.5 w-auto border-none bg-slate-100 hover:bg-slate-200">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="planejada" className="text-xs">
                                    🟡 Planejada
                                  </SelectItem>
                                  <SelectItem value="em_andamento" className="text-xs">
                                    🔵 Em Andamento
                                  </SelectItem>
                                  <SelectItem value="concluida" className="text-xs">
                                    🟢 Concluída
                                  </SelectItem>
                                  <SelectItem value="cancelada" className="text-xs">
                                    ⚪ Cancelada
                                  </SelectItem>
                                </SelectContent>
                              </Select>

                              <span className="font-mono font-bold text-slate-800">
                                {ini.progresso ?? 0}%
                              </span>
                            </div>

                            {/* Barra de Progresso Interativa */}
                            <div className="flex items-center gap-1">
                              <div className="flex-1">
                                <Progress value={ini.progresso ?? 0} className="h-1.5" />
                              </div>
                              {/* Atalhos rápidos de progresso */}
                              <div className="flex items-center gap-0.5 shrink-0">
                                {[25, 50, 75, 100].map((step) => (
                                  <button
                                    key={step}
                                    type="button"
                                    onClick={() => handleAlterarProgressoInline(ini, step)}
                                    className={`text-[9px] px-1 py-0.2 rounded font-mono transition-colors ${
                                      (ini.progresso ?? 0) === step
                                        ? 'bg-blue-600 text-white font-bold'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                                    title={`Ajustar progresso para ${step}%`}
                                  >
                                    {step}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Ações */}
                        <td className="py-3.5 px-3 text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onEditarPlano(ini, kpiVinculado)}
                            className="h-8 text-xs font-semibold text-slate-600 hover:text-blue-700 hover:bg-blue-50 gap-1"
                            title="Editar escopo, responsáveis e datas deste plano"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Editar</span>
                          </Button>
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
    </div>
  )
}

export default PainelPlanosAcaoEmpresa
