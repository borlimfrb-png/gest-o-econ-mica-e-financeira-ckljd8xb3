import React from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Scale,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle2,
  AlertTriangle,
  Info,
  DollarSign,
  Layers,
} from 'lucide-react'
import type { ApuracaoEntradasSaidasResultado } from '@/lib/taxCalculations'
import { formatCurrency, formatPercent } from '@/lib/financeCalculations'

interface PainelApuracaoEntradasSaidasProps {
  apuracao: ApuracaoEntradasSaidasResultado
  regimeNome: string
  regimeId: 'simples' | 'presumido' | 'real'
  ano: number
}

export function PainelApuracaoEntradasSaidas({
  apuracao,
  regimeNome,
  regimeId,
  ano,
}: PainelApuracaoEntradasSaidasProps) {
  const isSimples = regimeId === 'simples'

  const listaTributos = [
    apuracao.tributos.icms,
    apuracao.tributos.ipi,
    apuracao.tributos.pis,
    apuracao.tributos.cofins,
  ]

  return (
    <Card className="rounded-2xl border-slate-200 bg-white shadow-xs overflow-hidden">
      <CardHeader className="pb-4 bg-linear-to-r from-blue-50/60 via-indigo-50/40 to-slate-50/60 border-b border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#0B1F3A] text-white flex items-center justify-center shadow-xs">
              <Scale className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <CardTitle className="text-base font-bold text-[#0B1F3A] flex items-center gap-2">
                <span>Apuração Fiscal Integrada de Débitos e Créditos ({ano})</span>
                <Badge className="bg-blue-600 text-white font-bold text-xs">{regimeNome}</Badge>
              </CardTitle>
              <CardDescription className="text-xs">
                Confronto entre saídas (débitos tributários) e entradas (créditos sobre compras)
                para ICMS, IPI, PIS e COFINS
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isSimples ? (
              <Badge
                variant="outline"
                className="bg-amber-50 text-amber-900 border-amber-300 text-xs"
              >
                Simples Nacional: Entradas como custo informativo (Sem crédito na DAS)
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="bg-emerald-50 text-emerald-900 border-emerald-300 text-xs"
              >
                Regime com Aproveitamento de Créditos Fiscais
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-6 space-y-6">
        {/* Aviso conceitual caso Simples Nacional */}
        {isSimples && (
          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 text-xs flex items-start gap-2.5">
            <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong>Nota sobre o Simples Nacional:</strong> Por determinação da Lei Complementar
              nº 123/2006, empresas optantes pelo Simples recolhem impostos unificados através do
              Documento de Arrecadação do Simples (DAS) sobre a receita bruta. Portanto,{' '}
              <strong>
                as entradas de compras não geram direito a crédito de ICMS, IPI, PIS ou COFINS
              </strong>{' '}
              para abater a guia única, servindo exclusivamente para controle contábil, composição
              do custo de aquisição e formação de preço.
            </p>
          </div>
        )}

        {/* 4 Cards de Resumo Geral da Apuração */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between text-xs text-slate-500 font-semibold mb-1">
              <span>Total Saídas (Vendas)</span>
              <ArrowUpRight className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-xl font-extrabold text-[#0B1F3A]">
              {formatCurrency(apuracao.totalMercadoriasSaidas)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Débitos Fiscais: <strong>{formatCurrency(apuracao.totalDebitos)}</strong>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between text-xs text-slate-500 font-semibold mb-1">
              <span>Total Entradas (Compras)</span>
              <ArrowDownLeft className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-xl font-extrabold text-amber-900">
              {formatCurrency(apuracao.totalMercadoriasEntradas)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Créditos Fiscais:{' '}
              <strong className={isSimples ? 'text-slate-400' : 'text-emerald-700'}>
                {isSimples ? 'R$ 0,00 (vedado)' : formatCurrency(apuracao.totalCreditos)}
              </strong>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-red-50/70 border border-red-200 shadow-2xs">
            <div className="flex items-center justify-between text-xs text-red-700 font-semibold mb-1">
              <span>Saldo a Recolher</span>
              <AlertTriangle className="w-4 h-4 text-red-600" />
            </div>
            <div className="text-xl font-extrabold text-red-700">
              {formatCurrency(apuracao.totalSaldoARecolher)}
            </div>
            <div className="text-[11px] text-red-600/80 mt-1">
              Tributos com débitos superiores aos créditos
            </div>
          </div>

          <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 shadow-2xs">
            <div className="flex items-center justify-between text-xs text-emerald-800 font-semibold mb-1">
              <span>Saldo Credor Acumulado</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-xl font-extrabold text-emerald-700">
              {formatCurrency(apuracao.totalSaldoCredor)}
            </div>
            <div className="text-[11px] text-emerald-700 mt-1">
              Créditos a compensar em períodos futuros
            </div>
          </div>
        </div>

        {/* Tabela Comparativa Detalhada por Tributo */}
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-100 font-bold text-slate-800 border-b border-slate-300">
                <th className="py-2.5 px-3">Tributo</th>
                <th className="py-2.5 px-3 text-right">Base Débito (Saídas)</th>
                <th className="py-2.5 px-3 text-right">Débitos (R$)</th>
                <th className="py-2.5 px-3 text-right">Base Crédito (Entradas)</th>
                <th className="py-2.5 px-3 text-right">Créditos (R$)</th>
                <th className="py-2.5 px-3 text-right">Saldo Apurado (R$)</th>
                <th className="py-2.5 px-3 text-center">Situação Fiscal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {listaTributos.map((item) => {
                const isRecolher = item.tipoSaldo === 'a_recolher'
                return (
                  <tr key={item.tributo} className="hover:bg-slate-50/60">
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-slate-900">{item.tributo}</div>
                      <div className="text-[10px] text-slate-400">{item.nomeCompleto}</div>
                    </td>
                    <td className="py-2.5 px-3 text-right font-medium text-slate-700">
                      {formatCurrency(item.baseDebito)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                      {formatCurrency(item.valorDebito)}
                      <span className="text-[10px] text-slate-400 block font-normal">
                        Média {formatPercent(item.aliquotaDebitoMedia, 1)}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-medium text-slate-700">
                      {formatCurrency(item.baseCredito)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-emerald-700">
                      {formatCurrency(item.valorCredito)}
                      <span className="text-[10px] text-slate-400 block font-normal">
                        Média {formatPercent(item.aliquotaCreditoMedia, 1)}
                      </span>
                    </td>
                    <td
                      className={`py-2.5 px-3 text-right font-extrabold text-sm ${
                        isRecolher ? 'text-red-700' : 'text-emerald-700'
                      }`}
                    >
                      {formatCurrency(item.saldoApurado)}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {item.saldoApurado === 0 ? (
                        <Badge variant="outline" className="text-[10px] text-slate-500">
                          Zerado
                        </Badge>
                      ) : isRecolher ? (
                        <Badge className="bg-red-100 text-red-800 border-red-300 text-[10px] font-bold">
                          A Recolher
                        </Badge>
                      ) : (
                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] font-bold">
                          Saldo Credor
                        </Badge>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100 font-extrabold text-slate-900 border-t-2 border-slate-300 text-xs">
                <td className="py-3 px-3">TOTAIS APURADOS</td>
                <td className="text-right py-3 px-3 text-slate-600">—</td>
                <td className="text-right py-3 px-3 text-slate-900">
                  {formatCurrency(apuracao.totalDebitos)}
                </td>
                <td className="text-right py-3 px-3 text-slate-600">—</td>
                <td className="text-right py-3 px-3 text-emerald-800">
                  {formatCurrency(apuracao.totalCreditos)}
                </td>
                <td className="text-right py-3 px-3 text-red-800">
                  {formatCurrency(apuracao.totalSaldoARecolher)} (Recolher)
                </td>
                <td className="text-center py-3 px-3 text-emerald-800">
                  {apuracao.totalSaldoCredor > 0 &&
                    `+${formatCurrency(apuracao.totalSaldoCredor)} Credor`}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
