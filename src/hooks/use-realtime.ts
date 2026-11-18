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
 * Debounced wrapper around useRealtime.
 *
 * NUNCA remover esse export: Dashboard.tsx e DashboardBi.tsx o importam.
 * (Ele já foi apagado acidentalmente 4+ vezes quebrando o build.)
 *
 * Calls useRealtime at the top level (rules-of-hooks); the debounce keeps
 * the LAST event received and fires the callback once after a trailing
 * window of 1.5s — so a burst of realtime events triggers a single reload.
 */
export function useRealtimeDebounced<TRecord extends RecordModel = RecordModel>(
  collectionName: string,
  callback: (data: RecordSubscription<TRecord>) => void,
  enabled: boolean = true,
  delayMs: number = 1500,
) {
  const lastEventRef = useRef<RecordSubscription<TRecord> | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // useRealtime é chamado no topo do hook (nunca condicional — rules-of-hooks)
  useRealtime<TRecord>(
    collectionName,
    (data) => {
      lastEventRef.current = data
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null
        const ev = lastEventRef.current
        lastEventRef.current = null
        if (ev) callbackRef.current(ev)
      }, delayMs)
    },
    enabled,
  )

  const callbackRef = useRef(callback)
  callbackRef.current = callback

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])
}

export default useRealtime
