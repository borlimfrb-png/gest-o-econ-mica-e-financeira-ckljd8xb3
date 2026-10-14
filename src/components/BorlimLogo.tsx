import React from 'react'

export interface BorlimLogoProps {
  /**
   * Tamanho do ícone/monograma: 'sm' (28px), 'md' (36px), 'lg' (44px), 'xl' (56px)
   */
  size?: 'sm' | 'md' | 'lg' | 'xl'
  /**
   * Se exibe o texto da marca ao lado do monograma
   */
  showText?: boolean
  /**
   * Se exibe o subtítulo descritivo abaixo da marca
   */
  showSubtitle?: boolean
  /**
   * Título descritivo / subtítulo
   */
  subtitle?: string
  /**
   * Variante de cor:
   * - 'auto': adapta conforme o modo escuro/claro
   * - 'light': força tons claros (para fundos escuros como sidebar azul-marinho)
   * - 'dark': força tons escuros (para superfícies brancas/claras)
   */
  variant?: 'auto' | 'light' | 'dark'
  /**
   * Classes extras no contêiner
   */
  className?: string
  /**
   * Se deve apenas renderizar o monograma B vetorial isolado
   */
  iconOnly?: boolean
}

/**
 * Ícone / Monograma vetorial Borlim (Monograma B estilizado + curva de crescimento financeiro)
 * Paleta Institucional oficial: Azul-marinho (#0B1F3A) + Azul Vibrante (#2563EB) + Sky Blue (#38BDF8)
 */
export const BorlimIcon: React.FC<{
  size?: number | string
  className?: string
  variant?: 'light' | 'dark' | 'auto'
}> = ({ size = 36, className = '', variant = 'auto' }) => {
  const isLightModeForced = variant === 'dark'

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 select-none ${className}`}
      aria-label="Borlim Consultoria"
    >
      <defs>
        <linearGradient
          id="borlim-bg-grad"
          x1="4"
          y1="4"
          x2="60"
          y2="60"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#0B1F3A" />
          <stop offset="60%" stopColor="#0F2B52" />
          <stop offset="100%" stopColor="#173B6F" />
        </linearGradient>
        <linearGradient
          id="borlim-accent-grad"
          x1="15"
          y1="14"
          x2="48"
          y2="50"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="55%" stopColor="#2563EB" />
          <stop offset="100%" stopColor="#1D4ED8" />
        </linearGradient>
        <linearGradient
          id="borlim-gold-grad"
          x1="20"
          y1="14"
          x2="48"
          y2="34"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#60A5FA" />
          <stop offset="100%" stopColor="#38BDF8" />
        </linearGradient>
      </defs>

      {/* Base moderna arredondada (medalhão com borda fina luminescente) */}
      <rect
        x="2.5"
        y="2.5"
        width="59"
        height="59"
        rx="15"
        fill="url(#borlim-bg-grad)"
        stroke="#38BDF8"
        strokeWidth="1.5"
        strokeOpacity="0.4"
      />

      {/* Brilho reflexivo sutil no canto superior esquerdo */}
      <path
        d="M6 18C6 11.3726 11.3726 6 18 6H40C26 8 10 20 6 36V18Z"
        fill="#FFFFFF"
        fillOpacity="0.08"
      />

      {/* Coluna do B com topo arredondado */}
      <rect x="15" y="14" width="7" height="36" rx="3.5" fill="url(#borlim-accent-grad)" />

      {/* Bojo Superior do B */}
      <path
        d="M19 14 H35 C41 14 45.5 17.5 45.5 23 C45.5 28 41.5 31.5 36 32 H19 Z"
        fill="url(#borlim-gold-grad)"
      />
      <path
        d="M22 18.5 H34 C37.5 18.5 40.5 20 40.5 23 C40.5 26 37.5 27.5 34 27.5 H22 Z"
        fill="#0B1F3A"
      />

      {/* Bojo Inferior do B com expansão/crescimento */}
      <path
        d="M19 30 H37 C43.5 30 48.5 34 48.5 40.5 C48.5 47 43.5 50 36 50 H19 Z"
        fill="url(#borlim-accent-grad)"
      />
      <path
        d="M22 34.5 H35.5 C39.5 34.5 43 36.8 43 40.5 C43 44.2 39.5 45.5 35.5 45.5 H22 Z"
        fill="#0B1F3A"
      />

      {/* Vetor gráfico ascendente estilizado (indicador de crescimento financeiro) */}
      <path
        d="M39 25 L49 15.5 M49 15.5 H43.5 M49 15.5 V21"
        stroke="#38BDF8"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * Logotipo Borlim completo com tipografia institucional e assinatura
 */
export const BorlimLogo: React.FC<BorlimLogoProps> = ({
  size = 'md',
  showText = true,
  showSubtitle = true,
  subtitle = 'Análise de Balanço & Consultoria',
  variant = 'auto',
  className = '',
  iconOnly = false,
}) => {
  const sizeMap = {
    sm: { icon: 28, titleClass: 'text-xs', subClass: 'text-[9px]' },
    md: { icon: 34, titleClass: 'text-sm', subClass: 'text-[10px]' },
    lg: { icon: 42, titleClass: 'text-base', subClass: 'text-xs' },
    xl: { icon: 52, titleClass: 'text-xl', subClass: 'text-xs' },
  }

  const { icon, titleClass, subClass } = sizeMap[size]

  // Cores de texto segundo a variante
  const isDarkBg = variant === 'light' // Fundo escuro -> texto branco
  const isLightBg = variant === 'dark' // Fundo claro -> texto escuro

  const titleColor = isDarkBg
    ? 'text-white'
    : isLightBg
      ? 'text-[#0B1F3A]'
      : 'text-[#0B1F3A] dark:text-white'

  const subColor = isDarkBg
    ? 'text-sky-200/90'
    : isLightBg
      ? 'text-blue-700'
      : 'text-blue-700 dark:text-sky-300'

  if (iconOnly || !showText) {
    return <BorlimIcon size={icon} variant={variant} className={className} />
  }

  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      <BorlimIcon size={icon} variant={variant} />

      <div className="flex flex-col min-w-0 leading-tight">
        <div className="flex items-center gap-1.5">
          <span className={`font-black tracking-tight ${titleClass} ${titleColor} truncate`}>
            BORLIM
          </span>
          <span className="font-semibold tracking-wider text-[10px] uppercase px-1.5 py-0.2 rounded bg-blue-500/15 text-sky-400 border border-blue-400/25">
            Consultoria
          </span>
        </div>

        {showSubtitle && subtitle && (
          <span
            className={`font-semibold tracking-wide uppercase ${subClass} ${subColor} truncate mt-0.5`}
          >
            {subtitle}
          </span>
        )}
      </div>
    </div>
  )
}

export default BorlimLogo
