import React from 'react'

export interface ZonaHodometro {
  de: number
  ate: number
  cor: string // Ex: '#EF4444', '#F59E0B', '#10B981'
  rotulo?: string
}

export interface HodometroGaugeProps {
  valor: number | null | undefined
  min?: number
  max?: number
  titulo: string
  subtitulo?: string
  unidade?: string // '%', 'x', 'pts', 'dias', 'R$'
  formatarValor?: (val: number) => string
  zonas?: ZonaHodometro[]
  invertido?: boolean // se true, valores menores são melhores (ex.: endividamento)
  statusTexto?: string
  statusTipo?: 'positivo' | 'alerta' | 'critico' | 'neutro'
  metaTexto?: string
  tamanho?: 'sm' | 'md' | 'lg'
  className?: string
  onClickDetalhes?: () => void
}

/**
 * Converte coordenadas polares em cartesianas
 */
function polarToCartesian(
  centerX: number,
  centerY: number,
  radius: number,
  angleInDegrees: number,
) {
  const angleInRadians = ((angleInDegrees - 180) * Math.PI) / 180.0
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  }
}

/**
 * Cria o path SVG de um arco entre dois ângulos
 */
function describeArc(x: number, y: number, radius: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(x, y, radius, endAngle)
  const end = polarToCartesian(x, y, radius, startAngle)
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1'

  return ['M', start.x, start.y, 'A', radius, radius, 0, largeArcFlag, 0, end.x, end.y].join(' ')
}

export function HodometroGauge({
  valor,
  min = 0,
  max = 100,
  titulo,
  subtitulo,
  unidade = '%',
  formatarValor,
  zonas,
  statusTexto,
  statusTipo,
  metaTexto,
  tamanho = 'md',
  className = '',
  onClickDetalhes,
}: HodometroGaugeProps) {
  const hasValue = valor !== null && valor !== undefined && !Number.isNaN(valor)
  const safeValue = hasValue ? Number(valor) : min

  // Dimensões do gauge
  const width = tamanho === 'sm' ? 190 : tamanho === 'lg' ? 260 : 220
  const height = tamanho === 'sm' ? 120 : tamanho === 'lg' ? 160 : 140
  const cx = width / 2
  const cy = height - (tamanho === 'sm' ? 18 : 22)
  const r = tamanho === 'sm' ? 68 : tamanho === 'lg' ? 95 : 82
  const strokeWidth = tamanho === 'sm' ? 10 : tamanho === 'lg' ? 14 : 12

  // Ângulos do hodômetro: de 0° a 180° (semicírculo superior clássico de velocímetro)
  const START_ANGLE = 0
  const END_ANGLE = 180

  // Mapeia valor para o ângulo da agulha (clamped entre min e max)
  const clampedVal = Math.min(Math.max(safeValue, min), max)
  const percent = max > min ? (clampedVal - min) / (max - min) : 0
  const needleAngle = START_ANGLE + percent * (END_ANGLE - START_ANGLE)

  // Coordenadas da ponta da agulha
  const needleLength = r - (strokeWidth / 2 + 6)
  const needleRad = ((needleAngle - 180) * Math.PI) / 180
  const needleX = cx + needleLength * Math.cos(needleRad)
  const needleY = cy + needleLength * Math.sin(needleRad)

  // Zonas padrão quando não fornecidas: Verde / Âmbar / Vermelho
  const zonasPadrao: ZonaHodometro[] = zonas || [
    { de: min, ate: min + (max - min) * 0.33, cor: '#EF4444' }, // Vermelho
    { de: min + (max - min) * 0.33, ate: min + (max - min) * 0.66, cor: '#F59E0B' }, // Âmbar
    { de: min + (max - min) * 0.66, ate: max, cor: '#10B981' }, // Verde
  ]

  // Formatação amigável do valor
  const displayValue = hasValue
    ? formatarValor
      ? formatarValor(safeValue)
      : `${safeValue.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}${unidade ? ` ${unidade}` : ''}`
    : '—'

  // Cor do status badge
  const statusColorClass =
    statusTipo === 'positivo'
      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
      : statusTipo === 'critico'
        ? 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300 border-red-200 dark:border-red-800'
        : statusTipo === 'alerta'
          ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200 dark:border-amber-800'
          : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700'

  return (
    <div
      onClick={onClickDetalhes}
      className={`relative flex flex-col items-center justify-between p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs hover:shadow-md transition-all ${
        onClickDetalhes ? 'cursor-pointer hover:border-sky-300 dark:hover:border-sky-600' : ''
      } ${className}`}
    >
      {/* Cabeçalho do Card */}
      <div className="w-full flex items-start justify-between gap-2 mb-1">
        <div className="min-w-0">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 truncate">
            {titulo}
          </h4>
          {subtitulo && (
            <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
              {subtitulo}
            </p>
          )}
        </div>
        {statusTexto && (
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${statusColorClass}`}
          >
            {statusTexto}
          </span>
        )}
      </div>

      {/* SVG Hodômetro */}
      <div className="relative my-1 flex items-center justify-center">
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="overflow-visible select-none"
        >
          <defs>
            {/* Sombra suave para o pino central da agulha */}
            <filter id="needle-shadow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.25" />
            </filter>
            <linearGradient id="needle-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0B1F3A" />
              <stop offset="100%" stopColor="#1E3A8A" />
            </linearGradient>
          </defs>

          {/* Arco de fundo (trilho cinza) */}
          <path
            d={describeArc(cx, cy, r, START_ANGLE, END_ANGLE)}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            className="text-slate-100 dark:text-slate-800"
          />

          {/* Arcos das Zonas Coloridas */}
          {zonasPadrao.map((zona, idx) => {
            const zMinClamped = Math.max(min, Math.min(zona.de, max))
            const zMaxClamped = Math.max(min, Math.min(zona.ate, max))
            if (zMaxClamped <= zMinClamped) return null

            const pStart = (zMinClamped - min) / (max - min)
            const pEnd = (zMaxClamped - min) / (max - min)
            const aStart = START_ANGLE + pStart * (END_ANGLE - START_ANGLE)
            const aEnd = START_ANGLE + pEnd * (END_ANGLE - START_ANGLE)

            return (
              <path
                key={idx}
                d={describeArc(cx, cy, r, aStart, aEnd)}
                fill="none"
                stroke={zona.cor}
                strokeWidth={strokeWidth}
                strokeLinecap="butt"
                opacity={hasValue ? 0.95 : 0.4}
              />
            )
          })}

          {/* Traços e marcas de escala (0%, 50%, 100%) */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
            const tickAngle = START_ANGLE + pct * (END_ANGLE - START_ANGLE)
            const tickRad = ((tickAngle - 180) * Math.PI) / 180
            const innerR = r - strokeWidth / 2 - 2
            const outerR = r + strokeWidth / 2 + 2
            const x1 = cx + innerR * Math.cos(tickRad)
            const y1 = cy + innerR * Math.sin(tickRad)
            const x2 = cx + outerR * Math.cos(tickRad)
            const y2 = cy + outerR * Math.sin(tickRad)

            return (
              <line
                key={idx}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="#FFFFFF"
                strokeWidth={1.5}
                opacity={0.8}
              />
            )
          })}

          {/* Rótulo de Mínimo e Máximo nas pontas do arco */}
          <text
            x={cx - r}
            y={cy + (tamanho === 'sm' ? 12 : 14)}
            textAnchor="middle"
            className="text-[9px] font-mono fill-slate-400 dark:fill-slate-500 font-semibold"
          >
            {min}
          </text>
          <text
            x={cx + r}
            y={cy + (tamanho === 'sm' ? 12 : 14)}
            textAnchor="middle"
            className="text-[9px] font-mono fill-slate-400 dark:fill-slate-500 font-semibold"
          >
            {max}
            {unidade && unidade !== 'R$' ? unidade : ''}
          </text>

          {/* Agulha do Hodômetro com efeito de velocímetro */}
          {hasValue ? (
            <g filter="url(#needle-shadow)" className="transition-all duration-700 ease-out">
              {/* Linha da agulha */}
              <line
                x1={cx}
                y1={cy}
                x2={needleX}
                y2={needleY}
                stroke="#0B1F3A"
                strokeWidth={3}
                strokeLinecap="round"
                className="dark:stroke-sky-400"
              />
              {/* Ponta da agulha (triângulo sutil) */}
              <circle cx={needleX} cy={needleY} r={2.5} fill="#EF4444" className="animate-pulse" />
              {/* Pino central metálico */}
              <circle cx={cx} cy={cy} r={6} fill="#0B1F3A" className="dark:fill-slate-200" />
              <circle cx={cx} cy={cy} r={3} fill="#FFFFFF" />
            </g>
          ) : (
            /* Estado quando sem dados: agulha pontilhada no centro ou pino apagado */
            <g opacity={0.4}>
              <circle cx={cx} cy={cy} r={5} fill="#94A3B8" />
            </g>
          )}
        </svg>
      </div>

      {/* Valor central em destaque */}
      <div className="text-center mt-0.5">
        <div
          className={`text-xl sm:text-2xl font-black font-mono tracking-tight ${
            hasValue
              ? 'text-slate-900 dark:text-white'
              : 'text-slate-400 dark:text-slate-600 italic text-base'
          }`}
        >
          {displayValue}
        </div>
        {metaTexto && (
          <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
            {metaTexto}
          </div>
        )}
      </div>
    </div>
  )
}
