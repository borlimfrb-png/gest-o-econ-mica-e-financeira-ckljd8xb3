import React, { useState, useMemo } from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  Tooltip as RechartsTooltip,
} from 'recharts'
import {
  Calendar,
  Lock,
  Unlock,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ArrowRight,
  Info,
  Layers,
  FileSpreadsheet,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import type { BalancoRecord, DreRecord } from '@/types/finance'
import {
  gerarComparativoMensalAno,
  formatBrlMil,
  formatPercent,
  formatNumber,
  NOMES_MESES,
  type MesComparativoData,
} from '@/lib/financeCalculations'
import { fechamentoMensalService } from '@/services/financeService'

interface ComparativoMensalProps {
  empresaId: string
  empresaNome: string
  ano: number
  balancos: BalancoRecord[]
  dres: DreRecord[]
  onSelectMes: (mesNum: number) => void
  onOpenNovoLancamento: () => void
  onDataChange: () => void
}

export function ComparativoMensal({
  empresaId,
  empresaNome,
  ano,
  balancos,
  dres,
  onSelectMes,
  onOpenNovoLancamento,
  onDataChange,
}: ComparativoMensalProps) {
  const { toast } = useToast()

  // Modal de Fechamento de Mês
  const [modalFecharOpen, setModalFecharOpen] = useState(false)
  const [mesParaFechar, setMesParaFechar] = useState<MesComparativoData | null>(null)
  const [fechamentoObs, setFechamentoObs] = useState('')
  const [executingFechamento, setExecutingFechamento] = useState(false)

  // Modal de Reabertura de Mês
  const [modalReabrirOpen, setModalReabrirOpen] = useState(false)
  const [mesParaReabrir, setMesParaReabrir] = useState<MesComparativoData | null>(null)
  const [executingReabertura, setExecutingReabertura] = useState(false)

  // Filtro de exibição no gráfico
  const [metricaGrafico, setMetricaGrafico] = useState<'receita_lucro' | 'ativo_pl'>(
    'receita_lucro',
  )

  // Gera a série mensal completa (Jan a Dez)
  const dadosMensais = useMemo(() => {
    return gerarComparativoMensalAno(balancos, dres, ano)
  }, [balancos, dres, ano])

  // Estatísticas do Ano
  const mesesComLancamentos = dadosMensais.filter((m) => m.temDados).length
  const mesesFechados = dadosMensais.filter((m) => m.fechado).length
  const totalReceitaAno = dadosMensais.reduce((acc, m) => acc + m.receitaBruta, 0)
  const totalLucroAno = dadosMensais.reduce((acc, m) => acc + m.lucroLiquido, 0)

  // Dados para o gráfico com rótulo amigável
  const chartData = dadosMensais.map((m) => ({
    mesAbrev: m.mesAbrev,
    mesNome: m.mesNome,
    mesNum: m.mesNum,
    temDados: m.temDados,
    fechado: m.fechado,
    receitaBruta: m.temDados ? m.receitaBruta : null,
    receitaLiquida: m.temDados ? m.receitaLiquida : null,
    lucroLiquido: m.temDados ? m.lucroLiquido : null,
    ativoTotal: m.temBalanco ? m.ativoTotal : null,
    patrimonioLiquido: m.temBalanco ? m.patrimonioLiquido : null,
  }))

  const handleAbrirModalFechamento = (mesData: MesComparativoData) => {
    setMesParaFechar(mesData)
    setFechamentoObs(`Fechamento mensal de competência ${mesData.mesNome}/${ano}.`)
    setModalFecharOpen(true)
  }

  const handleConfirmarFechamento = async () => {
    if (!mesParaFechar) return
    setExecutingFechamento(true)
    try {
      const res = await fechamentoMensalService.fecharMes({
        empresaId,
        ano,
        mes: mesParaFechar.mesNum,
        observacoes: fechamentoObs,
      })

      const lucroFmt = formatBrlMil(res.lucroApurado)
      toast({
        title: `Mês de ${mesParaFechar.mesNome}/${ano} Fechado com Sucesso!`,
        description: `Resultado do período (${lucroFmt}) incorporado aos Lucros Acumulados no Balanço. Contas de resultado do mês seguinte preparadas e zeradas.`,
      })
      setModalFecharOpen(false)
      onDataChange()
    } catch (err: any) {
      console.error('Erro ao fechar mês:', err)
      toast({
        variant: 'destructive',
        title: 'Falha no fechamento mensal',
        description: err?.message || 'Não foi possível completar o fechamento contábil.',
      })
    } finally {
      setExecutingFechamento(false)
    }
  }

  const handleAbrirModalReabertura = (mesData: MesComparativoData) => {
    setMesParaReabrir(mesData)
    setModalReabrirOpen(true)
  }

  const handleConfirmarReabertura = async () => {
    if (!mesParaReabrir) return
    setExecutingReabertura(true)
    try {
      await fechamentoMensalService.reabrirMes({
        empresaId,
        ano,
        mes: mesParaReabrir.mesNum,
      })
      toast({
        title: `Mês de ${mesParaReabrir.mesNome}/${ano} Reaberto`,
        description: 'A competência está disponível novamente para edição e novos lançamentos.',
      })
      setModalReabrirOpen(false)
      onDataChange()
    } catch (err: any) {
      console.error('Erro ao reabrir mês:', err)
      toast({
        variant: 'destructive',
        title: 'Falha na reabertura',
        description: err?.message || 'Não foi possível reabrir a competência.',
      })
    } finally {
      setExecutingReabertura(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header com resumo do ano e KPIs de fechamento */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-white border-slate-200 shadow-2xs p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase text-slate-500">
              Meses com Lançamento
            </span>
            <Badge className="bg-blue-50 text-blue-700 border-blue-200 font-bold text-[11px]">
              {ano}
            </Badge>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-[#0B1F3A]">{mesesComLancamentos}</span>
            <span className="text-xs text-slate-400 font-medium">de 12 meses</span>
          </div>
          <div className="mt-2 w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-blue-600 h-full rounded-full transition-all duration-500"
              style={{ width: `${(mesesComLancamentos / 12) * 100}%` }}
            />
          </div>
        </Card>

        <Card className="bg-white border-slate-200 shadow-2xs p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase text-slate-500">
              Competências Fechadas
            </span>
            <Lock className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-emerald-700">{mesesFechados}</span>
            <span className="text-xs text-slate-400 font-medium">
              de {mesesComLancamentos} lançados
            </span>
          </div>
          <div className="mt-2 w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-500"
              style={{
                width: `${mesesComLancamentos > 0 ? (mesesFechados / mesesComLancamentos) * 100 : 0}%`,
              }}
            />
          </div>
        </Card>

        <Card className="bg-white border-slate-200 shadow-2xs p-4">
          <span className="text-[11px] font-semibold uppercase text-slate-500">
            Faturamento Anual Acumulado
          </span>
          <div className="mt-2 text-2xl font-extrabold text-blue-800">
            {formatBrlMil(totalReceitaAno)}
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            Soma da Receita Bruta dos meses cadastrados
          </p>
        </Card>

        <Card className="bg-white border-slate-200 shadow-2xs p-4">
          <span className="text-[11px] font-semibold uppercase text-slate-500">
            Resultado Líquido do Ano
          </span>
          <div
            className={`mt-2 text-2xl font-extrabold ${
              totalLucroAno >= 0 ? 'text-emerald-600' : 'text-red-600'
            }`}
          >
            {formatBrlMil(totalLucroAno)}
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            {totalLucroAno >= 0 ? 'Lucro Líquido Acumulado' : 'Prejuízo Líquido Acumulado'}
          </p>
        </Card>
      </div>

      {/* Gráfico de Evolução Mensal */}
      <Card className="bg-white border-slate-200 shadow-2xs">
        <CardHeader className="pb-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              <CardTitle className="text-sm font-bold text-[#0B1F3A]">
                Evolução Mês a Mês — Exercício {ano}
              </CardTitle>
            </div>
            <CardDescription className="text-xs">
              Acompanhamento mensal de receitas, resultados e patrimônio de Janeiro a Dezembro
            </CardDescription>
          </div>
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg">
            <button
              type="button"
              onClick={() => setMetricaGrafico('receita_lucro')}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all ${
                metricaGrafico === 'receita_lucro'
                  ? 'bg-white text-blue-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Receita vs Resultado
            </button>
            <button
              type="button"
              onClick={() => setMetricaGrafico('ativo_pl')}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all ${
                metricaGrafico === 'ativo_pl'
                  ? 'bg-white text-blue-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Ativo vs Patrimônio Líquido
            </button>
          </div>
        </CardHeader>
        <CardContent className="pt-2">
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              {metricaGrafico === 'receita_lucro' ? (
                <BarChart data={chartData} margin={{ top: 15, right: 15, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="mesAbrev" tick={{ fontSize: 11, fill: '#64748B' }} />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#64748B' }}
                    tickFormatter={(v) => `R$ ${Math.round(v / 1000)}k`}
                  />
                  <RechartsTooltip
                    formatter={(val: any, name: any) => [
                      val !== null ? formatBrlMil(Number(val)) : 'Sem lançamento',
                      name === 'receitaBruta'
                        ? 'Receita Bruta'
                        : name === 'lucroLiquido'
                          ? 'Lucro/Prejuízo Líquido'
                          : name,
                    ]}
                    labelFormatter={(label, payload) => {
                      const item = payload?.[0]?.payload
                      return item
                        ? `${item.mesNome}/${ano} ${item.fechado ? '🔒 [Fechado]' : ''}`
                        : label
                    }}
                  />
                  <Legend
                    formatter={(val) => (
                      <span className="text-xs text-slate-700">
                        {val === 'receitaBruta'
                          ? 'Receita Bruta (Faturamento)'
                          : 'Resultado Líquido (Lucro/Prejuízo)'}
                      </span>
                    )}
                  />
                  <Bar
                    dataKey="receitaBruta"
                    name="receitaBruta"
                    fill="#2563EB"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="lucroLiquido"
                    name="lucroLiquido"
                    fill="#10B981"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              ) : (
                <LineChart data={chartData} margin={{ top: 15, right: 20, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="mesAbrev" tick={{ fontSize: 11, fill: '#64748B' }} />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#64748B' }}
                    tickFormatter={(v) => `R$ ${Math.round(v / 1000)}k`}
                  />
                  <RechartsTooltip
                    formatter={(val: any, name: any) => [
                      val !== null ? formatBrlMil(Number(val)) : 'Sem lançamento',
                      name === 'ativoTotal' ? 'Ativo Total' : 'Patrimônio Líquido',
                    ]}
                    labelFormatter={(label, payload) => {
                      const item = payload?.[0]?.payload
                      return item ? `${item.mesNome}/${ano}` : label
                    }}
                  />
                  <Legend
                    formatter={(val) => (
                      <span className="text-xs text-slate-700">
                        {val === 'ativoTotal' ? 'Ativo Total' : 'Patrimônio Líquido'}
                      </span>
                    )}
                  />
                  <Line
                    type="monotone"
                    dataKey="ativoTotal"
                    name="ativoTotal"
                    stroke="#2563EB"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: '#2563EB' }}
                    connectNulls
                  />
                  <Line
                    type="monotone"
                    dataKey="patrimonioLiquido"
                    name="patrimonioLiquido"
                    stroke="#10B981"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: '#10B981' }}
                    connectNulls
                  />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Grade de Lançamentos de Janeiro a Dezembro */}
      <Card className="bg-white border-slate-200 shadow-2xs overflow-hidden">
        <CardHeader className="pb-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-600" />
              <CardTitle className="text-sm font-bold text-[#0B1F3A]">
                Demonstrativo Mensal Detalhado — Janeiro a Dezembro ({ano})
              </CardTitle>
            </div>
            <CardDescription className="text-xs">
              Visualize o balanço de cada mês, apure o resultado e realize o fechamento contábil de
              competência
            </CardDescription>
          </div>
          <Button
            onClick={onOpenNovoLancamento}
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-8"
          >
            + Novo Lançamento Mensal
          </Button>
        </CardHeader>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100/80 text-slate-700 font-semibold">
                <th className="py-2.5 px-3">Mês</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3 text-right">Rec. Bruta</th>
                <th className="py-2.5 px-3 text-right">Custos (CMV)</th>
                <th className="py-2.5 px-3 text-right">Desp. Oper.</th>
                <th className="py-2.5 px-3 text-right">Lucro Líquido</th>
                <th className="py-2.5 px-3 text-right">Margem Líq.</th>
                <th className="py-2.5 px-3 text-right">Ativo Total</th>
                <th className="py-2.5 px-3 text-right">Patrimônio Líq.</th>
                <th className="py-2.5 px-3 text-center">Ações / Fechamento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {dadosMensais.map((m) => {
                const hasData = m.temDados

                return (
                  <tr
                    key={m.mesNum}
                    className={`hover:bg-slate-50/80 transition-colors ${
                      !hasData ? 'bg-slate-50/40 text-slate-400' : 'text-slate-800'
                    }`}
                  >
                    {/* Nome do Mês */}
                    <td className="py-2.5 px-3 font-bold flex items-center gap-1.5">
                      <span className="w-5 text-slate-400 font-mono text-[11px]">{m.mesNum}</span>
                      <span className={hasData ? 'text-[#0B1F3A]' : 'text-slate-400'}>
                        {m.mesNome}
                      </span>
                    </td>

                    {/* Status do Lançamento */}
                    <td className="py-2.5 px-3 text-center">
                      {!hasData ? (
                        <Badge className="bg-slate-100 text-slate-500 border-slate-200 text-[10px]">
                          Sem dados
                        </Badge>
                      ) : m.fechado ? (
                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] font-semibold gap-1">
                          <Lock className="w-2.5 h-2.5" />
                          Fechado
                        </Badge>
                      ) : (
                        <Badge className="bg-amber-50 text-amber-800 border-amber-200 text-[10px] font-semibold">
                          Aberto
                        </Badge>
                      )}
                    </td>

                    {/* Receita Bruta */}
                    <td className="py-2.5 px-3 text-right font-medium">
                      {hasData && m.temDre ? formatBrlMil(m.receitaBruta) : '—'}
                    </td>

                    {/* CMV */}
                    <td className="py-2.5 px-3 text-right">
                      {hasData && m.temDre ? formatBrlMil(m.custoMercadorias) : '—'}
                    </td>

                    {/* Despesas Operacionais */}
                    <td className="py-2.5 px-3 text-right">
                      {hasData && m.temDre ? formatBrlMil(m.despesasOperacionais) : '—'}
                    </td>

                    {/* Lucro Líquido */}
                    <td className="py-2.5 px-3 text-right font-bold">
                      {hasData && m.temDre ? (
                        <span className={m.lucroLiquido >= 0 ? 'text-emerald-700' : 'text-red-600'}>
                          {formatBrlMil(m.lucroLiquido)}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>

                    {/* Margem Líquida */}
                    <td className="py-2.5 px-3 text-right">
                      {hasData && m.margemLiquida !== null
                        ? formatPercent(m.margemLiquida, 1)
                        : '—'}
                    </td>

                    {/* Ativo Total */}
                    <td className="py-2.5 px-3 text-right font-medium">
                      {hasData && m.temBalanco ? formatBrlMil(m.ativoTotal) : '—'}
                    </td>

                    {/* Patrimônio Líquido */}
                    <td className="py-2.5 px-3 text-right font-medium">
                      {hasData && m.temBalanco ? formatBrlMil(m.patrimonioLiquido) : '—'}
                    </td>

                    {/* Ações & Fechamento */}
                    <td className="py-2.5 px-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {hasData ? (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onSelectMes(m.mesNum)}
                              className="h-7 text-[11px] px-2 text-blue-700 hover:bg-blue-50"
                              title={`Abrir visão individual de ${m.mesNome}`}
                            >
                              Ver Mês
                              <ArrowRight className="w-3 h-3 ml-1" />
                            </Button>

                            {m.fechado ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleAbrirModalReabertura(m)}
                                className="h-7 text-[10px] px-2 text-slate-600 hover:text-amber-700 hover:bg-amber-50 border-slate-200"
                                title="Reabrir mês para ajustes"
                              >
                                <Unlock className="w-3 h-3 mr-1" />
                                Reabrir
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                onClick={() => handleAbrirModalFechamento(m)}
                                className="h-7 text-[10px] px-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-2xs"
                                title="Fechar mês e transferir resultado para Balanço"
                              >
                                <Lock className="w-3 h-3 mr-1" />
                                Fechar Mês
                              </Button>
                            )}
                          </>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={onOpenNovoLancamento}
                            className="h-7 text-[10px] px-2 text-slate-500 hover:text-blue-700 hover:bg-slate-100"
                          >
                            + Lançar
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-300 bg-slate-100 font-bold text-slate-900 text-xs">
                <td className="py-2.5 px-3" colSpan={2}>
                  CONSOLIDADO ANUAL ({ano})
                </td>
                <td className="py-2.5 px-3 text-right text-blue-800">
                  {formatBrlMil(totalReceitaAno)}
                </td>
                <td className="py-2.5 px-3 text-right">
                  {formatBrlMil(dadosMensais.reduce((acc, m) => acc + m.custoMercadorias, 0))}
                </td>
                <td className="py-2.5 px-3 text-right">
                  {formatBrlMil(dadosMensais.reduce((acc, m) => acc + m.despesasOperacionais, 0))}
                </td>
                <td
                  className={`py-2.5 px-3 text-right ${
                    totalLucroAno >= 0 ? 'text-emerald-700' : 'text-red-600'
                  }`}
                >
                  {formatBrlMil(totalLucroAno)}
                </td>
                <td className="py-2.5 px-3 text-right">
                  {totalReceitaAno > 0
                    ? formatPercent((totalLucroAno / totalReceitaAno) * 100, 1)
                    : '—'}
                </td>
                <td className="py-2.5 px-3 text-right" colSpan={3}>
                  <span className="text-[11px] font-normal text-slate-500 mr-2">
                    {mesesFechados} de {mesesComLancamentos} meses fechados
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      {/* =========================================================================
          MODAL DE CONFIRMAÇÃO DE FECHAMENTO MENSAL
      ========================================================================= */}
      <Dialog open={modalFecharOpen} onOpenChange={setModalFecharOpen}>
        <DialogContent className="sm:max-w-lg bg-white">
          <DialogHeader>
            <div className="flex items-center gap-2 text-emerald-700">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <Lock className="w-5 h-5 text-emerald-700" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-[#0B1F3A]">
                  Fechamento Contábil Mensal
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Competência de {mesParaFechar?.mesNome} de {ano} — {empresaNome}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {mesParaFechar && (
            <div className="space-y-4 text-xs py-2">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 space-y-2">
                <div className="font-bold text-emerald-950 flex items-center justify-between">
                  <span>Resultado Apurado no Período (DRE):</span>
                  <span
                    className={`text-sm ${
                      mesParaFechar.lucroLiquido >= 0 ? 'text-emerald-800' : 'text-red-600'
                    }`}
                  >
                    {formatBrlMil(mesParaFechar.lucroLiquido)}
                  </span>
                </div>
                <div className="text-[11px] text-emerald-900 leading-relaxed">
                  Ao confirmar o fechamento, o sistema realizará automaticamente:
                </div>
                <ul className="list-disc list-inside text-[11px] text-emerald-800 space-y-1">
                  <li>
                    Incorporação do <strong>Resultado Líquido</strong> do mês nos{' '}
                    <strong>Lucros/Prejuízos Acumulados</strong> do Balanço Patrimonial.
                  </li>
                  <li>
                    Marcação do período como <strong>Fechado</strong> com registro de data/hora.
                  </li>
                  <li>
                    Inicialização dos saldos patrimoniais acumulados para o mês seguinte (
                    {mesParaFechar.mesNum === 12
                      ? `Janeiro/${ano + 1}`
                      : `${NOMES_MESES[mesParaFechar.mesNum]}/${ano}`}
                    ) e <strong>zeramento das contas de resultado</strong> da DRE para o novo ciclo.
                  </li>
                </ul>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold text-slate-700">
                  Observações do Fechamento (opcional):
                </Label>
                <Textarea
                  value={fechamentoObs}
                  onChange={(e) => setFechamentoObs(e.target.value)}
                  placeholder="Ex: Competência fechada após conciliação bancária completa e apuração de tributos."
                  rows={3}
                  className="text-xs"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setModalFecharOpen(false)}
              disabled={executingFechamento}
              className="text-xs h-8"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleConfirmarFechamento}
              disabled={executingFechamento}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-8 gap-1.5"
            >
              {executingFechamento ? (
                'Processando Fechamento...'
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5" />
                  Confirmar e Fechar Mês
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* =========================================================================
          MODAL DE CONFIRMAÇÃO DE REABERTURA MENSAL
      ========================================================================= */}
      <Dialog open={modalReabrirOpen} onOpenChange={setModalReabrirOpen}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader>
            <div className="flex items-center gap-2 text-amber-700">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Unlock className="w-5 h-5 text-amber-700" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-[#0B1F3A]">
                  Reabrir Competência Mensal
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  {mesParaReabrir?.mesNome} de {ano} — {empresaNome}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-3 text-xs py-2 text-slate-600 leading-relaxed">
            <p>
              Você está prestes a reabrir a competência de{' '}
              <strong>
                {mesParaReabrir?.mesNome}/{ano}
              </strong>
              .
            </p>
            <p className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-amber-900 text-[11px]">
              <AlertCircle className="w-3.5 h-3.5 inline mr-1 text-amber-700" />
              A reabertura permite retificar e editar valores da DRE e do Balanço deste mês. Após
              concluir os ajustes, lembre-se de executar o fechamento novamente para atualizar os
              saldos.
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setModalReabrirOpen(false)}
              disabled={executingReabertura}
              className="text-xs h-8"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleConfirmarReabertura}
              disabled={executingReabertura}
              className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs h-8 gap-1.5"
            >
              {executingReabertura ? 'Reabrindo...' : 'Confirmar Reabertura'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
