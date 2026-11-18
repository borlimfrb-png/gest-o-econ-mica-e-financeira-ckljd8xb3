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
 * Versão com debounce do evento: guarda o último RecordSubscription recebido em
 * ref e o dispara uma única vez, `delayMs` após o último evento (trailing).
 * Chama useRealtime no topo do hook (rules-of-hooks).
 */
export function useRealtimeDebounced<TRecord extends RecordModel = RecordModel>(
  collectionName: string,
  callback: (data: RecordSubscription<TRecord>) => void,
  enabled: boolean = true,
  delayMs = 1500,
) {
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  const timerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null)
  const ultimoEventoRef = useRef<RecordSubscription<TRecord> | null>(null)

  useRealtime<TRecord>(
    collectionName,
    (data) => {
      ultimoEventoRef.current = data
      if (timerRef.current) window.clearTimeout(timerRef.current)
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null
        if (ultimoEventoRef.current) callbackRef.current(ultimoEventoRef.current)
      }, delayMs)
    },
    enabled,
  )

  // Limpa o timer pendente no unmount (o cleanup do useRealtime cobre só a
  // subscription; o debounce é próprio deste hook).
  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
    }
  }, [])
}

export default useRealtime
