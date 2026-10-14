import React from 'react'
import { Sun, Moon } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface ThemeToggleProps {
  className?: string
  showLabel?: boolean
  size?: 'sm' | 'md' | 'lg'
}

/**
 * Botão alternador do Modo Escuro / Claro institucional
 * Com ícone animado de Sol / Lua e transição suave de cores.
 */
export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  className = '',
  showLabel = false,
  size = 'md',
}) => {
  const { resolvedTheme, toggleTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const buttonSizeClass =
    size === 'sm'
      ? 'h-8 px-2 text-xs'
      : size === 'lg'
        ? 'h-10 px-3 text-sm'
        : 'h-8.5 px-2.5 text-xs'

  const iconSizeClass = size === 'sm' ? 'w-3.5 h-3.5' : size === 'lg' ? 'w-4.5 h-4.5' : 'w-4 h-4'

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={toggleTheme}
            className={`relative inline-flex items-center justify-center gap-1.5 rounded-xl border transition-all duration-200 cursor-pointer select-none outline-none focus-visible:ring-2 focus-visible:ring-sky-400 active:scale-95 ${
              isDark
                ? 'bg-slate-800/80 hover:bg-slate-700/80 border-slate-700 text-amber-300 hover:text-amber-200 shadow-inner'
                : 'bg-white/10 hover:bg-white/20 border-white/15 text-blue-100 hover:text-white shadow-xs'
            } ${buttonSizeClass} ${className}`}
            aria-label={isDark ? 'Alternar para Modo Claro' : 'Alternar para Modo Escuro'}
            title={isDark ? 'Ativar Modo Claro' : 'Ativar Modo Escuro'}
          >
            <div className="relative flex items-center justify-center">
              {isDark ? (
                <Moon
                  className={`${iconSizeClass} text-sky-300 transition-transform duration-300 rotate-0`}
                />
              ) : (
                <Sun
                  className={`${iconSizeClass} text-amber-300 transition-transform duration-300 rotate-0 hover:rotate-45`}
                />
              )}
            </div>

            {showLabel && (
              <span className="font-semibold tracking-wide">
                {isDark ? 'Modo Escuro' : 'Modo Claro'}
              </span>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          className="bg-[#0B1F3A] text-white border-slate-700 text-xs shadow-xl"
        >
          {isDark ? 'Mudar para Modo Claro' : 'Mudar para Modo Escuro'}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export default ThemeToggle
