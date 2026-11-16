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
 * Variante com debounce do useRealtime: quando vários registros chegam em
 * rajada (importação, recálculo em lote), o callback só roda uma vez, após
 * `delayMs` sem novos eventos. Evita recarregar a tela inteira a cada insert.
 */
export function useRealtimeDebounced<TRecord extends RecordModel = RecordModel>(
  collectionName: string,
  callback: (data: RecordSubscription<TRecord> | null) => void,
  enabled: boolean = true,
  delayMs: number = 500,
) {
  const callbackRef = useRef(callback)
  callbackRef.current = callback
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!enabled) return

    let unsubscribeFn: (() => Promise<void>) | undefined
    let cancelled = false

    const agendar = () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        timerRef.current = null
        if (!cancelled) callbackRef.current(null)
      }, delayMs)
    }

    pb.collection<TRecord>(collectionName)
      .subscribe('*', () => {
        agendar()
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
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      if (unsubscribeFn) {
        unsubscribeFn().catch(() => {})
      }
    }
  }, [collectionName, enabled, delayMs])
}

export default useRealtime
