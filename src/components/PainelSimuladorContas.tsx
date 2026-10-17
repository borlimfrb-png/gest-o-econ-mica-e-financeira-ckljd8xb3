import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import {
  Calculator,
  RotateCcw,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Percent,
  Layers,
  ArrowRight,
  ShieldCheck,
  Check,
} from 'lucide-react'
import type { ContaVariavelResumo } from '@/lib/lancamentosVariaveisHelper'
import type { ResultadoSimuladorComContas } from '@/lib/indicadorCrescimentoCalculo'

interface PainelSimuladorContasProps {
  contasResumo: ContaVariavelResumo[]
  ajustesPorConta: Record<string, number>
  onAjusteContaChange: (contaId: string, percentual: number) => void
  onAplicarTodos: (percentual: number) => void
  onLimparSimulacao: () => void
  simulacaoResultado: ResultadoSimuladorComContas
  faturamentoBase: number
  faturamentoSimulado: number
}

function formatBrl(val: number | undefined | null): string {
  if (val === undefined || val === null || !Number.isFinite(val)) return 'R$ 0,00'
  return val.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function PainelSimuladorContas({
  contasResumo,
  ajustesPorConta,
  onAjusteContaChange,
  onAplicarTodos,
  onLimparSimulacao,
  simulacaoResultado,
  faturamentoBase,
  faturamentoSimulado,
}: PainelSimuladorContasProps) {
  // Input para aplicar a mesma porcentagem para todas as contas
  const [percentualEmMassa, setPercentualEmMassa] = useState<string>('-10')

  const totalOriginal = simulacaoResultado.despesasVariaveisOriginaisTotal
  const totalSimulado = simulacaoResultado.despesasVariaveisSimuladasTotal
  const economiaTotal = simulacaoResultado.economiaTotalReais

  const lucroBase = simulacaoResultado.resultadoGeral.cenarioBase.lucroPrejuizo
  const lucroSimulado = simulacaoResultado.resultadoGeral.cenarioSimulado.lucroPrejuizo
  const deltaLucro = lucroSimulado - lucroBase

  const margemBase = simulacaoResultado.resultadoGeral.cenarioBase.margemLiquidaPct
  const margemSimulada = simulacaoResultado.resultadoGeral.cenarioSimulado.margemLiquidaPct

  const margemContribBase = simulacaoResultado.resultadoGeral.cenarioBase.margemContribuicaoPct
  const margemContribSimulada =
    simulacaoResultado.resultadoGeral.cenarioSimulado.margemContribuicaoPct

  const handleAplicarEmMassa = () => {
    const n = Number(percentualEmMassa.replace(',', '.'))
    if (!isNaN(n)) {
      onAplicarTodos(n)
    }
  }

  const temAlgumaSimulacao = Object.values(ajustesPorConta).some((v) => v !== 0)

  return (
    <Card className="bg-white border-blue-200/80 shadow-xs flex flex-col h-full">
      <CardHeader className="py-3 px-4 border-b border-blue-100 bg-blue-50/40">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-blue-100 text-blue-800 shadow-xs">
              <Calculator className="w-4 h-4 text-blue-700" />
            </span>
            <div>
              <div className="flex items-center gap-1.5">
                <CardTitle className="text-sm font-bold text-[#0B1F3A]">
                  Simulador por Conta Contábil
                </CardTitle>
                <Badge
                  variant="outline"
                  className="text-[10px] bg-blue-50 text-blue-800 border-blue-200 font-mono"
                >
                  {contasResumo.length} {contasResumo.length === 1 ? 'conta' : 'contas'}
                </Badge>
              </div>
              <CardDescription className="text-[11px] text-slate-500">
                Ajuste metas de redução/aumento por conta e veja o impacto no lucro e na margem em
                tempo real
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {temAlgumaSimulacao && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onLimparSimulacao}
                className="h-7 text-[11px] text-slate-700 hover:text-rose-700 hover:bg-rose-50 border-slate-200 gap-1 px-2 cursor-pointer"
                title="Limpar todos os percentuais simulados e voltar à base"
              >
                <RotateCcw className="w-3 h-3 text-rose-500" />
                Limpar Simulação
              </Button>
            )}
          </div>
        </div>

        {/* Barra de Ação Rápida: Aplicar mesma % a todas as contas */}
        <div className="pt-2 p-2.5 rounded-xl bg-white border border-blue-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs text-slate-700">
            <Sparkles className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span className="font-semibold text-[11px]">Aplicar mesma % a todas as contas:</span>
          </div>

          <div className="flex items-center gap-1.5">
            <div className="relative w-24">
              <Input
                type="text"
                value={percentualEmMassa}
                onChange={(e) => setPercentualEmMassa(e.target.value)}
                placeholder="-10"
                className="h-7 text-xs pr-6 font-mono text-center font-bold"
              />
              <span className="text-[10px] text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                %
              </span>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={handleAplicarEmMassa}
              className="h-7 text-[11px] bg-blue-600 hover:bg-blue-700 text-white font-semibold px-2.5 gap-1 cursor-pointer shadow-xs"
            >
              <Check className="w-3 h-3" />
              Aplicar em Lote
            </Button>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setPercentualEmMassa('-5')
                  onAplicarTodos(-5)
                }}
                className="h-7 px-1.5 text-[10px] font-semibold text-slate-600 hover:text-blue-700 hover:bg-blue-50 rounded border border-slate-200 cursor-pointer"
                title="Reduzir 5% em todas as despesas variáveis"
              >
                -5%
              </button>
              <button
                type="button"
                onClick={() => {
                  setPercentualEmMassa('-10')
                  onAplicarTodos(-10)
                }}
                className="h-7 px-1.5 text-[10px] font-semibold text-slate-600 hover:text-blue-700 hover:bg-blue-50 rounded border border-slate-200 cursor-pointer"
                title="Reduzir 10% em todas as despesas variáveis"
              >
                -10%
              </button>
              <button
                type="button"
                onClick={() => {
                  setPercentualEmMassa('-15')
                  onAplicarTodos(-15)
                }}
                className="h-7 px-1.5 text-[10px] font-semibold text-slate-600 hover:text-blue-700 hover:bg-blue-50 rounded border border-slate-200 cursor-pointer"
                title="Reduzir 15% em todas as despesas variáveis"
              >
                -15%
              </button>
            </div>
          </div>
        </div>

        {/* Resumo do Impacto em Tempo Real */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
          {/* Nova Despesa Variável */}
          <div className="p-2 rounded-lg bg-white border border-slate-200 shadow-2xs">
            <span className="text-[9.5px] uppercase font-bold text-slate-500 block">
              Variáveis Projetadas
            </span>
            <span className="text-xs font-black font-mono text-slate-900 block mt-0.5">
              {formatBrl(totalSimulado)}
            </span>
            <span className="text-[9.5px] text-slate-400 font-mono block">
              Base: {formatBrl(totalOriginal)}
            </span>
          </div>

          {/* Economia / Impacto em R$ */}
          <div
            className={`p-2 rounded-lg border shadow-2xs ${
              economiaTotal > 0
                ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                : economiaTotal < 0
                  ? 'bg-rose-50/70 border-rose-200 text-rose-950'
                  : 'bg-white border-slate-200 text-slate-800'
            }`}
          >
            <span className="text-[9.5px] uppercase font-bold block">
              {economiaTotal >= 0 ? 'Economia Total' : 'Aumento de Custo'}
            </span>
            <span
              className={`text-xs font-black font-mono block mt-0.5 ${
                economiaTotal > 0
                  ? 'text-emerald-700'
                  : economiaTotal < 0
                    ? 'text-rose-700'
                    : 'text-slate-700'
              }`}
            >
              {economiaTotal > 0 ? '+' : ''}
              {formatBrl(economiaTotal)}
            </span>
            <span className="text-[9.5px] opacity-75 font-mono block">
              {totalOriginal > 0 ? `${((economiaTotal / totalOriginal) * 100).toFixed(1)}%` : '—'}
            </span>
          </div>

          {/* Novo Lucro Líquido */}
          <div
            className={`p-2 rounded-lg border shadow-2xs ${
              lucroSimulado >= 0
                ? 'bg-emerald-50/70 border-emerald-200'
                : 'bg-rose-50/70 border-rose-200'
            }`}
          >
            <span className="text-[9.5px] uppercase font-bold text-slate-600 block">
              Novo Lucro Líquido
            </span>
            <span
              className={`text-xs font-black font-mono block mt-0.5 ${
                lucroSimulado >= 0 ? 'text-emerald-700' : 'text-rose-700'
              }`}
            >
              {formatBrl(lucroSimulado)}
            </span>
            <span
              className={`text-[9.5px] font-mono font-semibold block ${
                deltaLucro >= 0 ? 'text-emerald-600' : 'text-rose-600'
              }`}
            >
              {deltaLucro >= 0 ? '+' : ''}
              {formatBrl(deltaLucro)} vs base
            </span>
          </div>

          {/* Nova Margem Líquida */}
          <div className="p-2 rounded-lg bg-white border border-slate-200 shadow-2xs">
            <span className="text-[9.5px] uppercase font-bold text-slate-500 block">
              Nova Margem Líq.
            </span>
            <span className="text-xs font-black font-mono text-blue-900 block mt-0.5">
              {margemSimulada !== null ? `${margemSimulada.toFixed(1)}%` : '—'}
            </span>
            <span className="text-[9.5px] text-slate-400 font-mono block">
              MC: {margemContribSimulada !== null ? `${margemContribSimulada.toFixed(1)}%` : '—'}
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0 flex-1 overflow-hidden flex flex-col">
        {contasResumo.length === 0 ? (
          <div className="p-8 text-center space-y-2 my-auto">
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
              <Layers className="w-5 h-5" />
            </div>
            <p className="text-xs font-semibold text-slate-700">
              Nenhuma conta variável no período
            </p>
            <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
              Para simular, selecione um período ou empresa com lançamentos em contas classificadas
              como Despesa Variável.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 overflow-y-auto max-h-[520px] p-2 space-y-2">
            {contasResumo.map((conta) => {
              const pctAtual = ajustesPorConta[conta.contaId] || 0
              const simulado = Math.max(0, conta.totalOriginal * (1 + pctAtual / 100))
              const deltaEconomia = conta.totalOriginal - simulado

              return (
                <div
                  key={conta.contaId}
                  className="p-3 border border-slate-200 rounded-xl bg-white hover:border-blue-300 transition-colors space-y-2.5 shadow-2xs"
                >
                  {/* Linha superior: Nome da Conta, Centros e Valores */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {conta.contaCodigo && (
                          <span className="text-[10px] font-mono font-semibold text-slate-500">
                            {conta.contaCodigo}
                          </span>
                        )}
                        <span className="text-xs font-bold text-[#0B1F3A] truncate">
                          {conta.contaNome}
                        </span>
                        <Badge
                          variant="outline"
                          className="text-[9px] px-1 py-0 bg-slate-50 text-slate-600 border-slate-200"
                        >
                          {conta.quantidade} {conta.quantidade === 1 ? 'lanç.' : 'lançs.'}
                        </Badge>
                      </div>

                      {conta.centrosNomes.length > 0 && (
                        <p className="text-[10px] text-slate-400 truncate mt-0.5">
                          Centros: {conta.centrosNomes.join(', ')}
                        </p>
                      )}
                    </div>

                    {/* Comparativo: Original -> Simulado e Economia */}
                    <div className="flex items-center gap-2 shrink-0 text-right">
                      <div>
                        <span className="text-[10px] text-slate-400 block line-through font-mono">
                          {formatBrl(conta.totalOriginal)}
                        </span>
                        <span className="text-xs font-black font-mono text-slate-900 block">
                          {formatBrl(simulado)}
                        </span>
                      </div>
                      {deltaEconomia !== 0 && (
                        <Badge
                          variant="outline"
                          className={`text-[9.5px] font-mono font-bold ${
                            deltaEconomia > 0
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}
                        >
                          {deltaEconomia > 0 ? 'Economia: +' : 'Aumento: '}
                          {formatBrl(deltaEconomia)}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Controles de Simulação: Slider + Input numérico */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[11px] text-slate-600 font-medium">
                        Meta de Variação (%):
                      </span>
                      <div className="flex items-center gap-1.5">
                        <Input
                          type="number"
                          step={1}
                          min={-100}
                          max={100}
                          value={pctAtual}
                          onChange={(e) =>
                            onAjusteContaChange(conta.contaId, Number(e.target.value) || 0)
                          }
                          className="h-6 w-16 text-xs text-center font-mono font-bold p-1 bg-slate-50"
                        />
                        <span className="text-[11px] font-mono text-slate-500">%</span>
                        {pctAtual !== 0 && (
                          <button
                            type="button"
                            onClick={() => onAjusteContaChange(conta.contaId, 0)}
                            className="text-[10px] text-slate-400 hover:text-slate-600 underline ml-1 cursor-pointer"
                            title="Resetar esta conta para 0%"
                          >
                            zerar
                          </button>
                        )}
                      </div>
                    </div>

                    <Slider
                      value={[pctAtual]}
                      min={-50}
                      max={50}
                      step={1}
                      onValueChange={(vals) => onAjusteContaChange(conta.contaId, vals[0])}
                      className="py-1 cursor-pointer"
                    />

                    <div className="flex items-center justify-between text-[9px] text-slate-400 font-mono">
                      <span>-50% (corte severo)</span>
                      <span>-20%</span>
                      <span>0% (atual)</span>
                      <span>+20%</span>
                      <span>+50% (expansão)</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>

      <div className="p-3 bg-slate-50/80 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
        <span className="flex items-center gap-1 text-slate-600">
          <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
          Simulação em memória: nenhuma alteração é gravada no banco.
        </span>
        <span className="font-mono text-[10px] text-slate-400">Impacto instantâneo na DRE</span>
      </div>
    </Card>
  )
}
