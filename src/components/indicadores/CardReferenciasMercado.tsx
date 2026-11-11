import React, { useMemo } from 'react'
import { Gauge, ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { avaliarVersusMercado, type ReferenciaMercado } from '@/components/indicadores/benchmarkHub'
import { formatPercent, formatNumber } from '@/lib/financeCalculations'

export interface CardReferenciasMercadoProps {
  referencia: ReferenciaMercado | null
  /** Indicadores apurados da empresa ativa (mesmos motores dos hodômetros). */
  dadosAnoAtivo: {
    roe: number | null
    margemBruta: number | null
    margemOperacional?: number | null
    margemLiquida: number | null
    margemEbitda: number | null
    liquidezCorrente: number | null
    endividamentoGeral: number | null
  }
  /** Nome da empresa ativa para o cabeçalho da tabela. */
  empresaNome?: string
  /** Segmento da empresa ativa (para nota quando houver fallback). */
  setor?: string | null
}

interface LinhaRef {
  rotulo: string
  valorEmpresa: number | null
  valorMercado: number
  unidade: 'percentual' | 'multiplo'
  inverteCor: boolean
}

/**
 * Card "Referências de Mercado — [setor]": benchmark setorial lado a lado
 * com o valor da empresa ativa, com badge Acima/Abaixo (endividamento invertido).
 * Somente perfil interno.
 */
export function CardReferenciasMercado({
  referencia,
  dadosAnoAtivo,
  empresaNome,
  setor,
}: CardReferenciasMercadoProps) {
  const linhas = useMemo<LinhaRef[]>(() => {
    if (!referencia) return []
    return [
      {
        rotulo: 'ROE',
        valorEmpresa: dadosAnoAtivo.roe,
        valorMercado: referencia.roe,
        unidade: 'percentual',
        inverteCor: false,
      },
      {
        rotulo: 'Margem Bruta',
        valorEmpresa: dadosAnoAtivo.margemBruta,
        valorMercado: referencia.margemBruta,
        unidade: 'percentual',
        inverteCor: false,
      },
      {
        rotulo: 'Margem Operacional',
        valorEmpresa: dadosAnoAtivo.margemOperacional ?? null,
        valorMercado: referencia.margemOperacional,
        unidade: 'percentual',
        inverteCor: false,
      },
      {
        rotulo: 'Margem Líquida',
        valorEmpresa: dadosAnoAtivo.margemLiquida,
        valorMercado: referencia.margemLiquida,
        unidade: 'percentual',
        inverteCor: false,
      },
      {
        rotulo: 'Margem EBITDA',
        valorEmpresa: dadosAnoAtivo.margemEbitda,
        valorMercado: referencia.margemEbitda,
        unidade: 'percentual',
        inverteCor: false,
      },
      {
        rotulo: 'Liquidez Corrente',
        valorEmpresa: dadosAnoAtivo.liquidezCorrente,
        valorMercado: referencia.liquidezCorrente,
        unidade: 'multiplo',
        inverteCor: false,
      },
      {
        rotulo: 'Endividamento Geral',
        valorEmpresa: dadosAnoAtivo.endividamentoGeral,
        valorMercado: referencia.endividamentoGeral,
        unidade: 'percentual',
        inverteCor: true,
      },
    ]
  }, [dadosAnoAtivo, referencia])

  const formatar = (v: number | null, unidade: 'percentual' | 'multiplo') => {
    if (v === null || !Number.isFinite(v)) return '—'
    return unidade === 'percentual' ? formatPercent(v, 1) : `${formatNumber(v, 2)}x`
  }

  if (!referencia || linhas.length === 0) {
    return (
      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
        <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Gauge className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <CardTitle className="text-base font-bold text-[#0B1F3A] dark:text-white">
              Referências de Mercado
            </CardTitle>
          </div>
          <CardDescription className="text-xs text-slate-500 dark:text-slate-400">
            Nenhuma referência de benchmark disponível para o setor da empresa ativa.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
      <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2 flex-wrap">
          <Gauge className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <CardTitle className="text-base font-bold text-[#0B1F3A] dark:text-white">
            Referências de Mercado — {setor || referencia.rotuloSetor}
          </CardTitle>
          {referencia.usarFallback && (
            <Badge className="text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800">
              Referência padrão Indústria
            </Badge>
          )}
        </div>
        <CardDescription className="text-xs text-slate-500 dark:text-slate-400">
          Benchmark setorial lado a lado com os indicadores apurados da empresa ativa. Para
          Endividamento, abaixo do mercado é bom (cor invertida).
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800">
                <th className="text-left py-2 px-2 font-bold text-slate-600 dark:text-slate-300">
                  Indicador
                </th>
                <th className="text-right py-2 px-2 font-bold text-slate-600 dark:text-slate-300">
                  {empresaNome || 'Empresa ativa'}
                </th>
                <th className="text-right py-2 px-2 font-bold text-slate-600 dark:text-slate-300">
                  Mercado ({referencia.rotuloSetor})
                </th>
                <th className="text-right py-2 px-2 font-bold text-slate-600 dark:text-slate-300">
                  Posição
                </th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => {
                const aval = avaliarVersusMercado(l.valorEmpresa, l.valorMercado, l.inverteCor)
                const icone =
                  aval.acima === null ? (
                    <Minus className="w-3 h-3" />
                  ) : aval.acima ? (
                    <ArrowUpRight className="w-3 h-3" />
                  ) : (
                    <ArrowDownRight className="w-3 h-3" />
                  )
                return (
                  <tr
                    key={l.rotulo}
                    className="border-b border-slate-100 dark:border-slate-800/60 last:border-0"
                  >
                    <td className="py-2 px-2 font-semibold text-slate-700 dark:text-slate-200">
                      {l.rotulo}
                    </td>
                    <td
                      className={`py-2 px-2 text-right font-mono font-bold ${
                        l.valorEmpresa === null
                          ? 'text-slate-400'
                          : 'text-slate-800 dark:text-slate-100'
                      }`}
                    >
                      {formatar(l.valorEmpresa, l.unidade)}
                    </td>
                    <td className="py-2 px-2 text-right font-mono text-slate-500 dark:text-slate-400">
                      {formatar(l.valorMercado, l.unidade)}
                    </td>
                    <td className="py-2 px-2 text-right">
                      <Badge className={`text-[10px] font-bold gap-1 ${aval.classes}`}>
                        {icone}
                        {aval.rotulo}
                      </Badge>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
