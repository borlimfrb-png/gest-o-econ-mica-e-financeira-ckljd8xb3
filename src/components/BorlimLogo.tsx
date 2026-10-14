import React from 'react'
import { BORLIM_LOGO_URL } from '@/lib/borlimLogoAsset'

export interface BorlimLogoProps {
  /**
   * Tamanho do componente: 'sm' (h-8 aprox.), 'md' (h-10 aprox.), 'lg' (h-12 aprox.), 'xl' (h-16 aprox.)
   */
  size?: 'sm' | 'md' | 'lg' | 'xl'
  /**
   * Se exibe o texto descritivo complementar ao lado ou abaixo se necessário
   */
  showText?: boolean
  /**
   * Se exibe subtítulo descritivo
   */
  showSubtitle?: boolean
  /**
   * Subtítulo descritivo institucional
   */
  subtitle?: string
  /**
   * Variante de superfície:
   * - 'auto': adapta no modo escuro/claro
   * - 'light': força exibição sobre fundos escuros (usa chip/card branco translúcido ou nítido para máximo contraste da marca)
   * - 'dark': para superfícies brancas/claras
   */
  variant?: 'auto' | 'light' | 'dark'
  /**
   * Classes extras no container
   */
  className?: string
  /**
   * Se deve apenas renderizar o ícone / recorte visual da marca
   */
  iconOnly?: boolean
  /**
   * Se deve forçar estilo sem chip de fundo (apenas imagem crua)
   */
  raw?: boolean
}

/**
 * Ícone Oficial da Borlim Consultoria Empresarial
 * Recorta com precisão o símbolo e a letra B com os swashes verde→azul característicos da marca oficial.
 * Renderizado sobre chip arredondado branco para contraste perfeito em superfícies escuras (sidebar, dark mode).
 */
export const BorlimIcon: React.FC<{
  size?: number | string
  className?: string
  variant?: 'light' | 'dark' | 'auto'
}> = ({ size = 36, className = '', variant = 'auto' }) => {
  const numericSize = typeof size === 'number' ? size : parseInt(String(size), 10) || 36

  // Estilo do chip de contraste: sobre fundo escuro (light variant ou dark mode)
  const isDarkSurface = variant === 'light'
  const isAuto = variant === 'auto'

  const chipClasses = isDarkSurface
    ? 'bg-white shadow-sm ring-1 ring-white/30'
    : isAuto
      ? 'bg-white shadow-sm ring-1 ring-slate-200/80 dark:ring-white/20'
      : 'bg-white shadow-xs border border-slate-200/60'

  return (
    <div
      className={`inline-flex items-center justify-center rounded-xl p-1 shrink-0 select-none overflow-hidden transition-all ${chipClasses} ${className}`}
      style={{
        width: numericSize,
        height: numericSize,
      }}
      title="Borlim Consultoria Empresarial"
      aria-label="Borlim Consultoria Empresarial"
    >
      <img
        src={BORLIM_LOGO_URL}
        alt="Borlim Consultoria Empresarial"
        className="w-full h-full object-contain pointer-events-none drop-shadow-2xs"
        loading="eager"
      />
    </div>
  )
}

/**
 * Logotipo Oficial Completo da Borlim Consultoria Empresarial
 * Utiliza o logotipo oficial horizontal com "BORLIM" em azul royal, "Consultoria Empresarial" em verde
 * e os swashes gráficos verde→azul característicos da marca.
 * Em fundos escuros (sidebar navy, welcome splash, dark mode), aplica um chip branco arredondado
 * elegante para garantir legibilidade impecável conforme as diretrizes da marca.
 */
export const BorlimLogo: React.FC<BorlimLogoProps> = ({
  size = 'md',
  showText = true,
  showSubtitle = false,
  subtitle = 'Análise de Balanço & Consultoria',
  variant = 'auto',
  className = '',
  iconOnly = false,
  raw = false,
}) => {
  const sizeMap = {
    sm: {
      height: 'h-8 sm:h-9',
      imgHeight: 'h-7 sm:h-8',
      iconSize: 32,
      subClass: 'text-[9px]',
      padding: 'px-2.5 py-1',
    },
    md: {
      height: 'h-10 sm:h-11',
      imgHeight: 'h-8 sm:h-9.5',
      iconSize: 38,
      subClass: 'text-[10px]',
      padding: 'px-3 py-1.5',
    },
    lg: {
      height: 'h-12 sm:h-14',
      imgHeight: 'h-10 sm:h-12',
      iconSize: 46,
      subClass: 'text-xs',
      padding: 'px-3.5 py-2',
    },
    xl: {
      height: 'h-16 sm:h-20',
      imgHeight: 'h-14 sm:h-16',
      iconSize: 56,
      subClass: 'text-xs',
      padding: 'px-4 py-2.5',
    },
  }

  const { imgHeight, iconSize, subClass, padding } = sizeMap[size]

  if (iconOnly || !showText) {
    return <BorlimIcon size={iconSize} variant={variant} className={className} />
  }

  // Comportamento do card/chip:
  // Em fundos escuros (ex: sidebar navy, Splash, ou dark mode), o chip branco dá legibilidade 100% fiel
  const isDarkSurface = variant === 'light'
  const isAuto = variant === 'auto'

  let containerSurfaceClasses = ''
  if (!raw) {
    if (isDarkSurface) {
      containerSurfaceClasses =
        'bg-white text-slate-900 rounded-2xl shadow-md border border-white/40 ring-1 ring-black/5'
    } else if (isAuto) {
      containerSurfaceClasses =
        'bg-white dark:bg-white text-slate-900 rounded-2xl shadow-xs border border-slate-200/70 dark:border-white/30 dark:shadow-md'
    } else {
      containerSurfaceClasses = 'bg-white text-slate-900 rounded-xl'
    }
  }

  return (
    <div
      className={`inline-flex flex-col items-center justify-center shrink-0 ${containerSurfaceClasses} ${!raw ? padding : ''} ${className}`}
    >
      <img
        src={BORLIM_LOGO_URL}
        alt="Borlim Consultoria Empresarial"
        className={`${imgHeight} max-w-[280px] w-auto object-contain select-none pointer-events-none transition-transform`}
        loading="eager"
      />

      {showSubtitle && subtitle && (
        <span
          className={`font-semibold tracking-wider uppercase ${subClass} text-slate-600 dark:text-slate-600 text-center mt-1 truncate max-w-[260px]`}
        >
          {subtitle}
        </span>
      )}
    </div>
  )
}

export default BorlimLogo
