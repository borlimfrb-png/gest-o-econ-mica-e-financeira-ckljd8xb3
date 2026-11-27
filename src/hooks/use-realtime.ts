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
 * Versão com debounce (trailing 1,5s) para telas que recebem rajadas de
 * eventos realtime — evita recálculo a cada evento individual.
 */
export function useRealtimeDebounced<TRecord extends RecordModel = RecordModel>(
  collectionName: string,
  callback: (data: RecordSubscription<TRecord>) => void,
  enabled: boolean = true,
  delayMs: number = 1500,
) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestRef = useRef<RecordSubscription<TRecord> | null>(null)
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  useEffect(() => {
    if (!enabled) return
    let cancelled = false

    const flush = () => {
      timeoutRef.current = null
      if (!cancelled && latestRef.current && callbackRef.current) {
        callbackRef.current(latestRef.current)
      }
    }

    const unsubscribePromise = pb
      .collection<TRecord>(collectionName)
      .subscribe('*', (e) => {
        latestRef.current = e
        if (timeoutRef.current === null) {
          timeoutRef.current = setTimeout(flush, delayMs)
        }
      })
      .then((fn) => {
        if (cancelled) {
          fn().catch(() => {})
        }
        return fn
      })
      .catch(() => undefined)

    return () => {
      cancelled = true
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      unsubscribePromise.then((fn) => fn?.()).catch(() => {})
    }
  }, [collectionName, enabled, delayMs])
}

export default useRealtime
