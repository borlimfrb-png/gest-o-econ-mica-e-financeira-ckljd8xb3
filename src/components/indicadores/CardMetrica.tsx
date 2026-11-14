/**
 * Card genérico de métrica da seção "Métricas Avançadas" (/indicadores/apresentacao).
 * Visual único para todos os cards: badge de faixa (quando existe), valor principal,
 * badge de comparação com o mercado (quando há referência) e detalhes.
 * Indicador sem dado mostra "—" com badge "Sem dados" — nunca zero enganoso.
 */
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { avaliarVersusMercado } from './benchmarkHub'

export const BADGE_SEM_DADOS =
  'bg-slate-50 text-slate-500 dark:bg-slate-900 dark:text-slate-400 border-slate-200 dark:border-slate-700'

export interface CardMetricaProps {
  titulo: string
  sigla: string
  icone: React.ElementType
  valorPrincipal: string
  rotuloPrincipal: string
  valorMercado?: string
  valorMercadoBruto?: number | undefined
  valorEmpresaBruto: number | null
  inverteCor?: boolean
  detalhes?: { rotulo: string; valor: string }[]
  descricao: string
  badgeFaixa?: { texto: string; classes: string }
  tooltipFaixa?: string
}

export function BadgeMercado({
  valorEmpresa,
  valorMercado,
  inverteCor,
}: {
  valorEmpresa: number | null
  valorMercado: number | undefined
  inverteCor: boolean
}) {
  if (valorMercado === undefined) {
    return (
      <Badge variant="outline" className={`text-[10px] ${BADGE_SEM_DADOS}`}>
        Sem dados
      </Badge>
    )
  }
  const aval = avaliarVersusMercado(valorEmpresa, valorMercado, inverteCor)
  return (
    <Badge variant="outline" className={`text-[10px] font-semibold ${aval.classes}`}>
      {aval.rotulo}
    </Badge>
  )
}

export function CardMetrica({
  titulo,
  sigla,
  icone: Icone,
  valorPrincipal,
  rotuloPrincipal,
  valorMercado,
  valorMercadoBruto,
  valorEmpresaBruto,
  inverteCor = false,
  detalhes = [],
  descricao,
  badgeFaixa,
  tooltipFaixa,
}: CardMetricaProps) {
  const semDados =
    valorEmpresaBruto === null ||
    valorEmpresaBruto === undefined ||
    !Number.isFinite(valorEmpresaBruto)

  return (
    <Card className="flex flex-col justify-between border-border/80 hover:shadow-md transition-shadow">
      <CardHeader className="p-4 pb-2 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1.5 rounded-md bg-emerald-100 text-emerald-800 shrink-0">
              <Icone className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-sm font-bold text-foreground line-clamp-1">
                {titulo}
              </CardTitle>
              <span className="text-[10px] font-mono uppercase text-muted-foreground">{sigla}</span>
            </div>
          </div>
          {badgeFaixa ? (
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge
                    variant="outline"
                    className={`text-[10px] font-semibold shrink-0 ${badgeFaixa.classes}`}
                  >
                    {badgeFaixa.texto}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-64 text-xs">
                  {tooltipFaixa}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <Badge variant="outline" className={`text-[10px] shrink-0 ${BADGE_SEM_DADOS}`}>
              Sem dados
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-4 pt-1 flex-1 flex flex-col justify-between space-y-2">
        <div className="rounded-lg border bg-gradient-to-r from-card to-muted/30 p-2.5">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[11px] font-medium text-muted-foreground">{rotuloPrincipal}</span>
            {semDados ? (
              <Badge variant="outline" className={`text-[10px] ${BADGE_SEM_DADOS}`}>
                Sem dados
              </Badge>
            ) : (
              <BadgeMercado
                valorEmpresa={valorEmpresaBruto}
                valorMercado={valorMercadoBruto}
                inverteCor={inverteCor}
              />
            )}
          </div>
          <div className="text-xl font-black tracking-tight text-foreground mt-0.5">
            {semDados ? '—' : valorPrincipal}
          </div>
          {valorMercado !== undefined && (
            <div className="text-[10px] text-muted-foreground mt-0.5">Mercado: {valorMercado}</div>
          )}
        </div>

        {detalhes.length > 0 && (
          <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] border-t border-border/60 pt-2">
            {detalhes.map((d) => (
              <div key={d.rotulo} className="flex items-center justify-between gap-1">
                <span className="text-muted-foreground">{d.rotulo}</span>
                <span className="font-mono font-semibold text-foreground">{d.valor}</span>
              </div>
            ))}
          </div>
        )}

        <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-3">
          {descricao}
        </p>
      </CardContent>
    </Card>
  )
}

export default CardMetrica
