import { useState, useMemo } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Cell,
  ReferenceLine,
} from 'recharts'
import { BarChart3, TrendingUp, DollarSign, AlertCircle } from 'lucide-react'
import type { ItemCalculadoSimulacao, TotaisSimulacaoData } from '@/pages/SimuladorPrecos'

export interface GraficoContribuicaoProdutosProps {
  itensCalculados: ItemCalculadoSimulacao[]
  totaisSimulacao: TotaisSimulacaoData
}

function formatBrl(val?: number | null): string {
  if (val === undefined || val === null || isNaN(val)) return 'R$ 0,00'
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatPct(val?: number | null, dec: number = 2): string {
  if (val === undefined || val === null || isNaN(val)) return '0,00%'
  return `${Number(val).toLocaleString('pt-BR', {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  })}%`
}

export function GraficoContribuicaoProdutos({
  itensCalculados,
  totaisSimulacao,
}: GraficoContribuicaoProdutosProps) {
  const [metrica, setMetrica] = useState<'lucro' | 'receita'>('lucro')

  // Preparação e ordenação dos dados para o gráfico (do maior para o menor)
  const dadosGrafico = useMemo(() => {
    if (!itensCalculados || itensCalculados.length === 0) return []

    const base = itensCalculados.map((it) => {
      const lucro = it.lucroVendaInf
      const receita = it.precoVendaInformado
      const custo = it.custo

      // % de participação no lucro total (se total positivo)
      let participacaoLucroPct = 0
      if (totaisSimulacao.somaLucroInformado > 0) {
        participacaoLucroPct = (lucro / totaisSimulacao.somaLucroInformado) * 100
      }

      // % de participação na receita total
      let participacaoReceitaPct = 0
      if (totaisSimulacao.somaReceitaInformada > 0) {
        participacaoReceitaPct = (receita / totaisSimulacao.somaReceitaInformada) * 100
      }

      const nomeCurto = it.nome.length > 20 ? `${it.nome.substring(0, 18)}...` : it.nome
      const rotuloExibicao = it.codigo ? `[${it.codigo}] ${nomeCurto}` : nomeCurto

      return {
        id: it.id,
        codigo: it.codigo,
        nome: it.nome,
        rotulo: rotuloExibicao,
        lucro,
        receita,
        custo,
        isPrejuizo: it.isPrejuizo,
        margemPct: it.margemLucroInfPct,
        descontoMaximoPct: it.descontoMaximoPct,
        precoMinimoVenda: it.precoMinimoVenda,
        semMargemDesconto: it.semMargemDesconto,
        participacaoLucroPct,
        participacaoReceitaPct,
        // Valor numérico selecionado para a barra
        valor: metrica === 'lucro' ? lucro : receita,
        participacao: metrica === 'lucro' ? participacaoLucroPct : participacaoReceitaPct,
      }
    })

    // Ordenar do maior para o menor conforme a métrica selecionada
    return base.sort((a, b) => b.valor - a.valor)
  }, [itensCalculados, totaisSimulacao, metrica])

  // Altura dinâmica de acordo com a quantidade de produtos para evitar sobreposição
  const chartHeight = Math.max(280, dadosGrafico.length * 44 + 60)

  if (!itensCalculados || itensCalculados.length === 0) {
    return (
      <Card className="border-slate-200 shadow-xs bg-white">
        <CardContent className="p-8 text-center text-slate-500">
          <BarChart3 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-medium">Nenhum produto carregado na simulação.</p>
          <p className="text-xs text-slate-400 mt-1">
            Adicione produtos para visualizar o gráfico de contribuição por produto.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-slate-200 shadow-xs bg-white overflow-hidden">
      <CardHeader className="py-3 px-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <CardTitle className="text-xs font-bold text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-blue-600" />
            Contribuição de Cada Produto no {metrica === 'lucro' ? 'Lucro Líquido' : 'Faturamento'}
          </CardTitle>
          <CardDescription className="text-[11px] text-slate-500">
            {metrica === 'lucro'
              ? 'Ranking de produtos ordenados do maior lucro para o menor (produtos com prejuízo destacados em vermelho).'
              : 'Ranking de produtos ordenados pela maior receita bruta informada para a menor.'}
          </CardDescription>
        </div>

        {/* Alternância de Métrica: Lucro Líquido vs Receita Bruta */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg self-start sm:self-auto">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setMetrica('lucro')}
            className={`h-7 px-2.5 text-xs font-medium rounded-md transition-colors ${
              metrica === 'lucro'
                ? 'bg-white text-emerald-800 font-bold shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5 mr-1 text-emerald-600" />
            Lucro (R$)
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setMetrica('receita')}
            className={`h-7 px-2.5 text-xs font-medium rounded-md transition-colors ${
              metrica === 'receita'
                ? 'bg-white text-blue-900 font-bold shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5 mr-1 text-blue-600" />
            Receita (R$)
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-4">
        {/* Gráfico de Barras Horizontais */}
        <div style={{ width: '100%', height: chartHeight }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={dadosGrafico}
              layout="vertical"
              margin={{ top: 8, right: 30, left: 16, bottom: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
              <XAxis
                type="number"
                tick={{ fontSize: 11, fill: '#64748b' }}
                tickFormatter={(val) =>
                  Math.abs(val) >= 1000 ? `R$ ${(val / 1000).toFixed(1)}k` : `R$ ${val}`
                }
              />
              <YAxis
                type="category"
                dataKey="rotulo"
                width={160}
                tick={{ fontSize: 11, fill: '#334155', fontWeight: 500 }}
              />
              {/* Linha de referência zero para demarcar produtos com prejuízo */}
              <ReferenceLine x={0} stroke="#94a3b8" strokeWidth={1.5} />
              <RechartsTooltip
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null
                  const d = payload[0].payload
                  return (
                    <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-md text-xs space-y-1.5 min-w-[220px]">
                      <div className="font-bold text-slate-900 border-b pb-1">
                        {d.codigo ? (
                          <span className="font-mono text-slate-500 mr-1">[{d.codigo}]</span>
                        ) : null}
                        {d.nome}
                      </div>

                      <div className="space-y-1 text-[11px] pt-0.5">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500">Preço Informado:</span>
                          <strong className="text-blue-950 font-mono">
                            {formatBrl(d.receita)}
                          </strong>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500">Custo Ficha:</span>
                          <span className="text-slate-700 font-mono">{formatBrl(d.custo)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500">Lucro Líquido:</span>
                          <strong
                            className={`font-mono ${
                              d.isPrejuizo ? 'text-red-700 font-black' : 'text-emerald-700'
                            }`}
                          >
                            {formatBrl(d.lucro)} ({formatPct(d.margemPct)})
                          </strong>
                        </div>

                        <div className="flex justify-between items-center border-t pt-1">
                          <span className="text-slate-500">
                            Participação no {metrica === 'lucro' ? 'Lucro' : 'Faturamento'}:
                          </span>
                          <strong className="text-blue-700 font-mono">
                            {d.participacao.toFixed(1)}%
                          </strong>
                        </div>

                        <div className="flex justify-between items-center text-[10px] text-amber-900 bg-amber-50 p-1 rounded mt-1">
                          <span>Desconto Máx.:</span>
                          <span className="font-bold font-mono">
                            {d.semMargemDesconto
                              ? '0,00% (Sem margem)'
                              : formatPct(d.descontoMaximoPct)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                }}
              />
              <Bar dataKey="valor" radius={[0, 4, 4, 0]}>
                {dadosGrafico.map((entry) => {
                  let fillColor = '#2563eb' // azul padrão para receita
                  if (metrica === 'lucro') {
                    fillColor = entry.isPrejuizo ? '#dc2626' : '#16a34a' // vermelho se prejuízo, verde se lucro
                  }
                  return <Cell key={`cell-${entry.id}`} fill={fillColor} />
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Rodapé explicativo do gráfico */}
        <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between text-xs text-slate-500 gap-2">
          <div className="flex items-center gap-4">
            {metrica === 'lucro' ? (
              <>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-emerald-600" />
                  <span>Lucro positivo</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-red-600" />
                  <span>Prejuízo líquido</span>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-blue-600" />
                <span>Receita por produto</span>
              </div>
            )}
          </div>

          <div className="text-[11px] text-slate-400">
            Passe o mouse sobre as barras para ver detalhamento, custos e margem.
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
