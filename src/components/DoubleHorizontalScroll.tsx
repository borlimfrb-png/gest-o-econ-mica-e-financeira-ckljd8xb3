import React, { useCallback, useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

export interface DoubleHorizontalScrollProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  /** Classe adicional para o container externo */
  className?: string
  /** Classe adicional para o container de scroll inferior (o container real) */
  scrollClassName?: string
  /** Classe adicional para a barra de scroll do topo */
  topScrollClassName?: string
  /** Se deve forçar exibição da barra superior mesmo se não houver overflow (default: false) */
  alwaysShowTopBar?: boolean
  /** Altura da barra superior espelhada em pixels (default: 12) */
  topBarHeight?: number
}

/**
 * Componente DoubleHorizontalScroll:
 * Fornece duas barras de rolagem horizontais (uma no topo e outra na base da tabela/área de dados),
 * mantendo ambas sincronizadas em tempo real.
 *
 * Características:
 * - Suporta elementos sticky (ex: primeira coluna fixa de contas) sem quebrar posicionamento.
 * - Suporta scroll por mouse, touchpad, trackpad e touch em mobile/tablet.
 * - Oculta a barra superior dinamicamente se a tabela não tiver overflow horizontal.
 * - Desativa-se na impressão (print:hidden) para evitar interferência na exportação PDF A4.
 * - Utiliza ResizeObserver e MutationObserver para manter scrollWidth e clientWidth sempre atualizados.
 */
export const DoubleHorizontalScroll = React.forwardRef<HTMLDivElement, DoubleHorizontalScrollProps>(
  (
    {
      children,
      className,
      scrollClassName,
      topScrollClassName,
      alwaysShowTopBar = false,
      topBarHeight = 12,
      ...props
    },
    forwardedRef,
  ) => {
    const bottomContainerRef = useRef<HTMLDivElement>(null)
    const topContainerRef = useRef<HTMLDivElement>(null)
    const isSyncingRef = useRef(false)

    const [hasOverflow, setHasOverflow] = useState(false)
    const [contentWidth, setContentWidth] = useState(0)

    const updateDimensions = useCallback(() => {
      const bottomEl = bottomContainerRef.current
      if (!bottomEl) return

      const scrollW = bottomEl.scrollWidth
      const clientW = bottomEl.clientWidth
      const overflow = scrollW > clientW + 1

      setHasOverflow(overflow)
      setContentWidth(scrollW)

      // Se o scroll atual estourou os limites, sincroniza
      if (topContainerRef.current) {
        topContainerRef.current.scrollLeft = bottomEl.scrollLeft
      }
    }, [])

    // Sincronização Top -> Bottom
    const handleTopScroll = useCallback(() => {
      if (isSyncingRef.current) return
      const topEl = topContainerRef.current
      const bottomEl = bottomContainerRef.current
      if (!topEl || !bottomEl) return

      isSyncingRef.current = true
      bottomEl.scrollLeft = topEl.scrollLeft
      requestAnimationFrame(() => {
        isSyncingRef.current = false
      })
    }, [])

    // Sincronização Bottom -> Top
    const handleBottomScroll = useCallback(() => {
      if (isSyncingRef.current) return
      const topEl = topContainerRef.current
      const bottomEl = bottomContainerRef.current
      if (!topEl || !bottomEl) return

      isSyncingRef.current = true
      topEl.scrollLeft = bottomEl.scrollLeft
      requestAnimationFrame(() => {
        isSyncingRef.current = false
      })
    }, [])

    // Observa redimensionamento da janela, do container e de seu conteúdo
    useEffect(() => {
      const bottomEl = bottomContainerRef.current
      if (!bottomEl) return

      updateDimensions()

      // ResizeObserver para mudanças de tamanho do elemento ou do primeiro filho (tabela)
      const ro = new ResizeObserver(() => {
        updateDimensions()
      })
      ro.observe(bottomEl)

      if (bottomEl.firstElementChild) {
        ro.observe(bottomEl.firstElementChild)
      }

      // MutationObserver para quando linhas da tabela expandirem/colapsarem
      const mo = new MutationObserver(() => {
        updateDimensions()
      })
      mo.observe(bottomEl, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class'],
      })

      window.addEventListener('resize', updateDimensions)

      return () => {
        ro.disconnect()
        mo.disconnect()
        window.removeEventListener('resize', updateDimensions)
      }
    }, [updateDimensions])

    const showTopBar = alwaysShowTopBar || hasOverflow

    return (
      <div
        ref={forwardedRef}
        className={cn('w-full max-w-full flex flex-col', className)}
        {...props}
      >
        {/* Barra de rolagem horizontal superior espelhada */}
        {showTopBar && (
          <div
            ref={topContainerRef}
            onScroll={handleTopScroll}
            className={cn(
              'overflow-x-auto overflow-y-hidden w-full max-w-full print:hidden select-none bg-slate-50/60 border-b border-slate-200/80',
              topScrollClassName,
            )}
            style={{
              height: `${topBarHeight}px`,
              minHeight: `${topBarHeight}px`,
            }}
            aria-hidden="true"
            tabIndex={-1}
            title="Barra de rolagem horizontal superior (sincronizada)"
          >
            {/* Div fantasma com a largura exata de scroll do conteúdo da tabela */}
            <div
              style={{
                width: `${contentWidth}px`,
                height: '1px',
                pointerEvents: 'none',
              }}
            />
          </div>
        )}

        {/* Container real com a tabela e a barra inferior nativa */}
        <div
          ref={bottomContainerRef}
          onScroll={handleBottomScroll}
          className={cn('overflow-x-auto w-full max-w-full touch-pan-x', scrollClassName)}
        >
          {children}
        </div>
      </div>
    )
  },
)

DoubleHorizontalScroll.displayName = 'DoubleHorizontalScroll'
