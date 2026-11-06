import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'

// ============================================================
// Paleta corporativa sóbria do Dashboard BI (identidade Borlim)
// ============================================================

/** Tons de azul-marinho/sky da identidade do app + neutros funcionais */
export const PALETA_BI = {
  azulMarinho: '#0B1F3A',
  azulMedio: '#0E284E',
  azulClaro: '#143A6E',
  azulAcao: '#2563EB', // faturamento / série principal
  celeste: '#0EA5E9', // margem líquida / série secundária
  verde: '#0F766E', // lucro / resultado positivo (teal sóbrio)
  ambar: '#B45309', // despesas variáveis (âmbar escuro legível)
  vermelho: '#B91C1C', // despesas totais / resultado negativo
  roxo: '#7C3AED', // despesas financeiras
  grid: '#E2E8F0', // gridlines discretas
  eixo: '#64748B', // labels dos eixos
} as const

/**
 * Paleta ordenada do donut: azul-marinho/azul → teal → neutros quentes sóbrios.
 * Usada igualmente no donut e na legenda lateral.
 */
export const CORES_DONUT_BI = [
  '#0B1F3A', // azul-marinho
  '#1D4ED8', // azul
  '#0EA5E9', // celeste
  '#0F766E', // teal
  '#B45309', // âmbar escuro
  '#64748B', // slate
  '#7C3AED', // violeta
  '#B91C1C', // vermelho sóbrio
]

/** Estilo compartilhado dos tooltips Recharts (padrão do app) */
export const tooltipStyleBI = {
  backgroundColor: '#0B1F3A',
  borderColor: '#334155',
  color: '#F8FAFC',
  borderRadius: '10px',
  fontSize: '12px',
  padding: '8px 12px',
  boxShadow: '0 8px 24px rgba(11, 31, 58, 0.28)',
} as const

/** Label do tooltip em peso maior */
export const tooltipLabelStyleBI = {
  color: '#CBD5E1',
  fontWeight: 600,
  marginBottom: 4,
} as const

/** Gridlines discretas padrão do BI */
export const gridPropsBI = {
  strokeDasharray: '4 4',
  stroke: PALETA_BI.grid,
  vertical: false,
} as const

/** Tick padrão dos eixos (tamanho/contraste legíveis) */
export const tickPropsBI = { fontSize: 11, fill: PALETA_BI.eixo } as const

/** Legendas padrão do BI */
export const legendStyleBI = {
  fontSize: '12px',
  paddingTop: '10px',
  color: PALETA_BI.eixo,
} as const

// ============================================================
// Card de KPI
// ============================================================

interface KpiCardBiProps {
  /** Rótulo superior (ex.: "Faturamento") */
  label: string
  /** Valor principal — sempre tipograficamente dominante */
  valor: string
  /** Linha de apoio (unidade, período, fonte do dado) */
  apoio: string
  /** Ícone decorativo coerente com o restante do app */
  icon: LucideIcon
  /** Cor do ícone/acento (Tailwind classes) */
  accent: string
  /** Acento colorido superior — padrão da identidade */
  accentBar?: string
  className?: string
  /** Indica dado não calculável: valor vira "—" com destaque reduzido */
  semDado?: boolean
}

export function KpiCardBi({
  label,
  valor,
  apoio,
  icon: Icon,
  accent,
  accentBar = 'bg-sky-600',
  className,
  semDado = false,
}: KpiCardBiProps) {
  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800',
        'bg-white dark:bg-slate-900 shadow-sm hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700',
        'transition-shadow duration-200 h-full flex flex-col',
        className,
      )}
    >
      <span className={cn('absolute top-0 left-0 right-0 h-[3px]', accentBar)} />
      <div className="p-4 flex flex-col gap-1 flex-1 justify-between">
        <div className="flex items-start justify-between gap-2">
          <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider leading-tight block">
            {label}
          </span>
          <span
            className={cn(
              'shrink-0 w-7 h-7 rounded-lg flex items-center justify-center',
              'bg-slate-100 dark:bg-slate-800 transition-colors',
              accent,
            )}
          >
            <Icon className="w-3.5 h-3.5" />
          </span>
        </div>
        <div
          className={cn(
            'mt-1',
            semDado
              ? 'text-lg sm:text-xl font-bold text-slate-400 dark:text-slate-500 italic'
              : 'text-lg sm:text-xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50 tabular-nums',
          )}
        >
          {valor}
        </div>
        <span
          className={cn(
            'text-[10px] leading-snug mt-0.5 block',
            semDado
              ? 'text-amber-700/90 dark:text-amber-400/90 font-medium'
              : 'text-slate-400 dark:text-slate-500',
          )}
        >
          {apoio}
        </span>
      </div>
    </div>
  )
}

/** Esqueleto do KPI (mesmas dimensões do card real) */
export function KpiCardBiSkeleton() {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 h-full flex flex-col gap-2.5">
      <div className="flex items-start justify-between">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="w-7 h-7 rounded-lg" />
      </div>
      <Skeleton className="h-6 w-3/4 mt-1" />
      <Skeleton className="h-2.5 w-1/2" />
    </div>
  )
}

// ============================================================
// Estados vazio / sem dado
// ============================================================

interface EstadoVazioGraficoBiProps {
  titulo: string
  descricao: string
  icon: LucideIcon
}

/** Mensagem elegante quando o gráfico não tem dados no período */
export function EstadoVazioGraficoBi({ titulo, descricao, icon: Icon }: EstadoVazioGraficoBiProps) {
  return (
    <div className="h-full w-full min-h-[200px] flex flex-col items-center justify-center gap-3 px-6 text-center">
      <span className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
        <Icon className="w-5 h-5 text-slate-400" />
      </span>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">{titulo}</p>
        <p className="text-xs text-slate-400 dark:text-slate-500 max-w-sm leading-relaxed">
          {descricao}
        </p>
      </div>
    </div>
  )
}

/** Badge discreta de "sem dado calculável" para indicadores individuais */
export function BadgeSemDadoBi({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-800/40 rounded px-1.5 py-0.5">
      {children}
    </span>
  )
}

/** Linha divisória fina dentro de cards (alinhamento consistente) */
export function DividerBi({ className }: { className?: string }) {
  return <Separator className={cn('bg-slate-100 dark:bg-slate-800', className)} />
}
