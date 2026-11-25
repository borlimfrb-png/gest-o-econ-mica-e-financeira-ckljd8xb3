import { useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Target, Loader2 } from 'lucide-react'
import { InputValorBrl } from '@/components/ui/input-valor-brl'
import { parseNumeroBrl } from '@/lib/inputValorBrl'
import { formatBrlPontoEquilibrio, formatPercentualPontoEquilibrio } from './pontoEquilibrioFormat'
import {
  getClassesPercentualMetaDespesa,
  type PontoEquilibrioAnoComMetaDespesa,
} from '@/lib/pontoEquilibrioMetaDespesaComparativo'

const TRACO = '—'

/** Editor de Metas Mensais de Despesa: um input por mês + salvar em lote. */
export function EditorMetasDespesaMensais({
  ano,
  rascunho,
  onRascunho,
  onSalvar,
  onDescartar,
  salvando,
  habilitado,
}: {
  ano: PontoEquilibrioAnoComMetaDespesa
  rascunho: Record<number, string>
  onRascunho: (mes: number, valor: string) => void
  onSalvar: () => void
  onDescartar: () => void
  salvando: boolean
  habilitado: boolean
}) {
  const meses = ano.meses
  const totalRascunho = useMemo(
    () => Object.values(rascunho).reduce((acc, v) => acc + (parseNumeroBrl(String(v)) ?? 0), 0),
    [rascunho],
  )

  return (
    <Card className="bg-white border-slate-200 shadow-sm">
      <CardHeader className="py-3 px-5 border-b border-slate-100 bg-slate-50/50">
        <CardTitle className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
          <Target className="w-4 h-4 text-purple-700" />
          Metas Mensais de Despesa ({ano.ano})
        </CardTitle>
        <CardDescription className="text-xs">
          {habilitado
            ? 'Digite a meta de despesa de cada mês (R$) e salve em lote. Ficar dentro ou abaixo da meta é o objetivo. Deixe em branco ou zere para remover a meta do mês.'
            : 'Somente admin e perfil empresa podem editar as metas.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4 pb-3 px-5 space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-12 gap-2">
          {meses.map((m) => (
            <div key={m.chave} className="space-y-1">
              <label
                className="text-[11px] font-semibold text-slate-600 block"
                htmlFor={`meta-desp-${m.chave}`}
              >
                {m.rotuloCurto}
                {m.metaDespesa !== null && (
                  <span className="font-normal text-slate-400">
                    {' '}
                    · {formatBrlPontoEquilibrio(m.metaDespesa)}
                  </span>
                )}
              </label>
              <InputValorBrl
                id={`meta-desp-${m.chave}`}
                className="h-8 text-xs tabular-nums"
                placeholder={
                  m.metaDespesa !== null ? formatBrlPontoEquilibrio(m.metaDespesa) : 'Sem meta'
                }
                value={parseNumeroBrl(rascunho[m.mes] ?? '')}
                disabled={!habilitado || salvando}
                onValueChange={(v) => onRascunho(m.mes, v === undefined ? '' : String(v))}
              />
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button size="sm" onClick={onSalvar} disabled={!habilitado || salvando}>
            {salvando ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando…
              </>
            ) : (
              'Salvar Metas'
            )}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onDescartar}
            disabled={!habilitado || salvando}
          >
            Descartar alterações
          </Button>
          <span className="text-xs text-slate-500 ml-auto flex items-center gap-3">
            <span>
              Soma das metas informadas:{' '}
              <strong className="text-slate-700">{formatBrlPontoEquilibrio(totalRascunho)}</strong>
            </span>
            <Badge
              variant="outline"
              className="border-purple-200 bg-purple-50 text-purple-700 text-[10px]"
            >
              Meta de despesa atual:{' '}
              {ano.totalMetaDespesa !== null
                ? formatBrlPontoEquilibrio(ano.totalMetaDespesa)
                : TRACO}
            </Badge>
            <Badge
              variant="outline"
              className={`text-[10px] ${getClassesPercentualMetaDespesa(ano.totalPercentualMetaDespesa).badge}`}
            >
              % do ano: {formatPercentualPontoEquilibrio(ano.totalPercentualMetaDespesa)}
            </Badge>
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
