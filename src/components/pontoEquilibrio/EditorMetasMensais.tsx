import { useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Target, Loader2 } from 'lucide-react'
import { InputValorBrl } from '@/components/ui/input-valor-brl'
import { parseNumeroBrl } from '@/lib/inputValorBrl'
import { formatBrlPontoEquilibrio, formatPercentualPontoEquilibrio } from './pontoEquilibrioFormat'
import {
  getClassesPercentualMeta,
  type PontoEquilibrioAnoComMeta,
} from '@/lib/pontoEquilibrioMetaComparativo'

const TRACO = '—'

/** Editor de Metas Mensais de Receita: um input por mês + salvar em lote. */
export function EditorMetasMensais({
  ano,
  rascunho,
  onRascunho,
  onSalvar,
  onDescartar,
  salvando,
  habilitado,
}: {
  ano: PontoEquilibrioAnoComMeta
  rascunho: Record<number, string>
  onRascunho: (mes: number, valor: string) => void
  onSalvar: () => void
  onDescartar: () => void
  salvando: boolean
  habilitado: boolean
}) {
  const meses = ano.meses
  const totalMeta = useMemo(
    () => Object.values(rascunho).reduce((acc, v) => acc + (parseNumeroBrl(String(v)) ?? 0), 0),
    [rascunho],
  )

  return (
    <Card className="bg-white border-slate-200 shadow-sm">
      <CardHeader className="py-3 px-5 border-b border-slate-100 bg-slate-50/50">
        <CardTitle className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
          <Target className="w-4 h-4 text-blue-700" />
          Metas Mensais de Receita ({ano.ano})
        </CardTitle>
        <CardDescription className="text-xs">
          {habilitado
            ? 'Digite a meta de cada mês (R$) e salve em lote. Deixe em branco ou zere para remover a meta do mês.'
            : 'Somente admin e perfil empresa podem editar as metas.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4 pb-3 px-5 space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-12 gap-2">
          {meses.map((m) => (
            <div key={m.chave} className="space-y-1">
              <label
                className="text-[11px] font-semibold text-slate-600 block"
                htmlFor={`meta-${m.chave}`}
              >
                {m.rotuloCurto}
                {m.meta !== null && (
                  <span className="font-normal text-slate-400">
                    {' '}
                    · {formatBrlPontoEquilibrio(m.meta)}
                  </span>
                )}
              </label>
              <InputValorBrl
                id={`meta-${m.chave}`}
                className="h-8 text-xs tabular-nums"
                placeholder={m.meta !== null ? formatBrlPontoEquilibrio(m.meta) : 'Sem meta'}
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
              <strong className="text-slate-700">{formatBrlPontoEquilibrio(totalMeta)}</strong>
            </span>
            <Badge
              variant="outline"
              className="border-blue-200 bg-blue-50 text-blue-700 text-[10px]"
            >
              Meta anual atual:{' '}
              {ano.totalMeta !== null ? formatBrlPontoEquilibrio(ano.totalMeta) : TRACO}
            </Badge>
            <Badge
              variant="outline"
              className={`text-[10px] ${getClassesPercentualMeta(ano.totalPercentualMeta).badge}`}
            >
              % do ano: {formatPercentualPontoEquilibrio(ano.totalPercentualMeta)}
            </Badge>
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
