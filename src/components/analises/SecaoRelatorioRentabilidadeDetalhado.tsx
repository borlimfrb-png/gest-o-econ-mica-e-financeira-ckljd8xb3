import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { FileText, TrendingUp, TrendingDown } from 'lucide-react'
import type {
  AnaliseRentabilidadeResultado,
  AnoRentabilidadeComparado,
} from '@/lib/analiseRentabilidadeCalculo'
import { formatarPercentualExport } from '@/lib/analiseRentabilidadeExport'

interface Props {
  resultado: AnaliseRentabilidadeResultado
  comparativo: AnoRentabilidadeComparado[]
  nomeContexto: string
  exercicioAno: number
}

interface LinhaDreVisual {
  rotulo: string
  valor: number
  margem: number | null
  destaque?: boolean
  subtrai?: boolean
}

function montarLinhas(resultado: AnaliseRentabilidadeResultado): LinhaDreVisual[] {
  const receitaBruta = resultado.faturamentoTotal
  const cmv = resultado.despesasVariaveisTotal
  const receitaLiquida = receitaBruta - cmv
  const despesasOperacionais =
    resultado.despesasFixasTotal +
    resultado.despesasFinanceirasTotal -
    resultado.receitasFinanceirasTotal
  const lucroOperacional = receitaLiquida - despesasOperacionais
  const lucroLiquido = resultado.lucroTotal
  const m = (v: number) => (receitaBruta > 0 ? (v / receitaBruta) * 100 : null)

  return [
    { rotulo: 'Receita Bruta', valor: receitaBruta, margem: null },
    { rotulo: '(−) Deduções e Custos Variáveis (CMV)', valor: cmv, margem: m(cmv), subtrai: true },
    { rotulo: '= Receita Líquida', valor: receitaLiquida, margem: null, destaque: true },
    {
      rotulo: '(−) Despesas Operacionais (Fixas + Financeiras − Rec. Financeiras)',
      valor: despesasOperacionais,
      margem: m(despesasOperacionais),
      subtrai: true,
    },
    { rotulo: '= Lucro Operacional', valor: lucroOperacional, margem: null, destaque: true },
    { rotulo: '= Lucro Líquido do Exercício', valor: lucroLiquido, margem: null, destaque: true },
  ]
}

const fmtBrl = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 })

export function SecaoRelatorioRentabilidadeDetalhado({
  resultado,
  comparativo,
  nomeContexto,
  exercicioAno,
}: Props) {
  const linhas = montarLinhas(resultado)

  const temMovimento =
    resultado.faturamentoTotal !== 0 ||
    resultado.lucroTotal !== 0 ||
    resultado.despesasVariaveisTotal !== 0 ||
    resultado.despesasFixasTotal !== 0

  const multiAno = comparativo.length > 1

  const valoresAno = (r: AnaliseRentabilidadeResultado) => {
    const receitaBruta = r.faturamentoTotal
    const receitaLiquida = receitaBruta - r.despesasVariaveisTotal
    const despesasOperacionais =
      r.despesasFixasTotal + r.despesasFinanceirasTotal - r.receitasFinanceirasTotal
    return {
      receitaBruta,
      cmv: r.despesasVariaveisTotal,
      receitaLiquida,
      despesasOperacionais,
      lucroOperacional: receitaLiquida - despesasOperacionais,
      lucroLiquido: r.lucroTotal,
      margemBruta: r.margemBrutaTotal,
      margemOperacional: r.margemOperacionalTotal,
      margemLiquida: r.margemSobreFaturamentoTotal,
    }
  }

  const linhasComp: Array<{
    rotulo: string
    margem: boolean
    pegar: (v: ReturnType<typeof valoresAno>) => number | null
  }> = [
    { rotulo: 'Receita Bruta', margem: false, pegar: (v) => v.receitaBruta },
    { rotulo: '(−) CMV / Deduções', margem: false, pegar: (v) => v.cmv },
    { rotulo: '= Receita Líquida', margem: false, pegar: (v) => v.receitaLiquida },
    { rotulo: '(−) Despesas Operacionais', margem: false, pegar: (v) => v.despesasOperacionais },
    { rotulo: '= Lucro Operacional', margem: false, pegar: (v) => v.lucroOperacional },
    { rotulo: '= Lucro Líquido', margem: false, pegar: (v) => v.lucroLiquido },
    { rotulo: 'Margem Bruta', margem: true, pegar: (v) => v.margemBruta },
    { rotulo: 'Margem Operacional', margem: true, pegar: (v) => v.margemOperacional },
    { rotulo: 'Margem Líquida', margem: true, pegar: (v) => v.margemLiquida },
  ]

  return (
    <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs">
      <CardHeader className="py-3 px-4 sm:px-6 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <span className="p-1 rounded-md bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
            <FileText className="w-4 h-4" />
          </span>
          <CardTitle className="text-sm font-bold text-[#0B1F3A] dark:text-slate-100">
            Relatório Detalhado de Rentabilidade
          </CardTitle>
          <Badge variant="outline" className="text-[10px] py-0">
            DRE Resumida · Margens · Comparativo
          </Badge>
        </div>
        <CardDescription className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Demonstration de resultado consolidada do exercício {exercicioAno} — {nomeContexto}. Use
          "Imprimir / PDF" para gerar a versão A4.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 sm:p-6">
        {!temMovimento ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Sem movimentação no período selecionado para compor o relatório.
          </p>
        ) : (
          <div className="space-y-5">
            {/* DRE Resumida do exercício */}
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                DRE Resumida — Exercício {exercicioAno}
              </p>
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300">
                      <th className="text-left font-semibold px-3 py-2">Conta</th>
                      <th className="text-right font-semibold px-3 py-2">Valor (R$)</th>
                      <th className="text-right font-semibold px-3 py-2">% Receita Bruta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linhas.map((l) => (
                      <tr
                        key={l.rotulo}
                        className={`border-t border-slate-100 dark:border-slate-800 ${
                          l.destaque ? 'bg-emerald-50/60 dark:bg-emerald-950/30 font-semibold' : ''
                        }`}
                      >
                        <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{l.rotulo}</td>
                        <td
                          className={`px-3 py-2 text-right tabular-nums ${
                            l.subtrai
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-slate-800 dark:text-slate-100'
                          }`}
                        >
                          {fmtBrl(l.valor)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-600 dark:text-slate-300">
                          {l.margem === null ? '—' : formatarPercentualExport(l.margem)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Margens estruturais */}
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                Margens do Exercício
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  { rotulo: 'Margem Bruta', valor: resultado.margemBrutaTotal },
                  { rotulo: 'Margem Operacional', valor: resultado.margemOperacionalTotal },
                  {
                    rotulo: 'Margem Líquida s/ Faturamento',
                    valor: resultado.margemSobreFaturamentoTotal,
                  },
                ].map((mg) => (
                  <div
                    key={mg.rotulo}
                    className="rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2 flex items-center justify-between"
                  >
                    <span className="text-xs text-slate-600 dark:text-slate-300">{mg.rotulo}</span>
                    <span className="flex items-center gap-1 font-bold text-xs tabular-nums text-[#0B1F3A] dark:text-slate-100">
                      {mg.valor !== null && mg.valor >= 0 ? (
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <TrendingDown className="w-3.5 h-3.5 text-red-500" />
                      )}
                      {formatarPercentualExport(mg.valor)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Comparativo multi-ano */}
            {multiAno && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                  Comparativo entre Anos (mesmo intervalo de meses)
                </p>
                <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-x-auto">
                  <table className="w-full text-xs min-w-[560px]">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300">
                        <th className="text-left font-semibold px-3 py-2">Conta</th>
                        {comparativo.map((c) => (
                          <th key={c.ano} className="text-right font-semibold px-3 py-2">
                            {c.ano}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {linhasComp.map((lc) => (
                        <tr
                          key={lc.rotulo}
                          className="border-t border-slate-100 dark:border-slate-800"
                        >
                          <td className="px-3 py-2 text-slate-700 dark:text-slate-200">
                            {lc.rotulo}
                          </td>
                          {comparativo.map((c) => {
                            const v = lc.pegar(valoresAno(c.resultado))
                            return (
                              <td
                                key={c.ano}
                                className={`px-3 py-2 text-right tabular-nums ${
                                  lc.margem
                                    ? 'text-indigo-700 dark:text-indigo-300 font-semibold'
                                    : 'text-slate-800 dark:text-slate-100'
                                }`}
                              >
                                {lc.margem
                                  ? formatarPercentualExport(v)
                                  : v === null
                                    ? '—'
                                    : fmtBrl(v)}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
