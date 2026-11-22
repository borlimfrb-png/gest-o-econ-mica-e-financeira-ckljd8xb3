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
 * Igual ao useRealtime, mas com debounce de 1,5s (trailing) nos callbacks —
 * para coleções que disparam muitos eventos seguidos (ex.: lancamentos).
 */
export function useRealtimeDebounced<TRecord extends RecordModel = RecordModel>(
  collectionName: string,
  callback: (data: RecordSubscription<TRecord>) => void,
  enabled = true,
) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  useEffect(() => {
    if (!enabled) return
    let unsubscribeFn: (() => Promise<void>) | undefined
    let cancelled = false
    pb.collection<TRecord>(collectionName)
      .subscribe('*', (e) => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        timeoutRef.current = setTimeout(() => callbackRef.current(e), 1500)
      })
      .then((fn) => {
        if (cancelled) fn().catch(() => {})
        else unsubscribeFn = fn
      })
      .catch(() => {})
    return () => {
      cancelled = true
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      if (unsubscribeFn) unsubscribeFn().catch(() => {})
    }
  }, [collectionName, enabled])
}

export default useRealtime
