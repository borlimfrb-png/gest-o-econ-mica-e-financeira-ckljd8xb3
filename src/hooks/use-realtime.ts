import { useEffect, useRef } from 'react'
import type { RecordModel, RecordSubscription } from 'pocketbase'

import pb from '@/lib/pocketbase/client'

/**
 * Hook for real-time subscriptions to a PocketBase collection.
 * ALWAYS use this hook instead of subscribing inline.
 * Uses the per-listener UnsubscribeFunc so multiple components
 * can safely subscribe to the same collection without conflicts.
 *
 * Generic over the record type: pass your collection's interface as
 * `useRealtime<MyRecord>(...)` to get a typed subscription payload
 * instead of `unknown`.
 */
export function useRealtime<TRecord extends RecordModel = RecordModel>(
  collectionName: string,
  callback: (data: RecordSubscription<TRecord>) => void,
  enabled: boolean = true,
) {
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  useEffect(() => {
    if (!enabled) return

    let unsubscribeFn: (() => Promise<void>) | undefined
    let cancelled = false

    pb.collection<TRecord>(collectionName)
      .subscribe('*', (e) => {
        callbackRef.current(e)
      })
      .then((fn) => {
        if (cancelled) {
          fn().catch(() => {})
        } else {
          unsubscribeFn = fn
        }
      })
      .catch(() => {})

    return () => {
      cancelled = true
      if (unsubscribeFn) {
        unsubscribeFn().catch(() => {})
      }
    }
  }, [collectionName, enabled])
}

/**
 * Variante com debounce/agrupamento de eventos em rajada (ex: importações
 * em lote que disparam dezenas de eventos seguidos). O primeiro evento dispara
 * o callback imediatamente; os demais dentro da janela são coalescidos e
 * disparados uma única vez ao final, para não estourar o rate limit do
 * backend (429) nem recarregar a tela dezenas de vezes.
 * Criado na 0.0.367 para os dashboards (Dashboard, DashboardBi).
 */
export function useRealtimeDebounced<TRecord extends RecordModel = RecordModel>(
  collectionName: string,
  callback: (data: RecordSubscription<TRecord>) => void,
  enabled: boolean = true,
  delayMs: number = 1500,
) {
  const callbackRef = useRef(callback)
  callbackRef.current = callback
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastFiredRef = useRef(0)

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [])

  useRealtime<TRecord>(
    collectionName,
    (data) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      const elapsed = Date.now() - lastFiredRef.current
      if (elapsed >= delayMs) {
        lastFiredRef.current = Date.now()
        callbackRef.current(data)
        return
      }
      timerRef.current = setTimeout(() => {
        timerRef.current = null
        lastFiredRef.current = Date.now()
        callbackRef.current(data as RecordSubscription<TRecord>)
      }, delayMs - elapsed)
    },
    enabled,
  )
}

export default useRealtime
