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

export function useRealtimeDebounced<TRecord extends RecordModel = RecordModel>(
  collectionName: string,
  callback: (data: RecordSubscription<TRecord>) => void,
  enabled: boolean = true,
  delayMs: number = 1500,
) {
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  useEffect(() => {
    if (!enabled) return

    let unsubscribeFn: (() => Promise<void>) | undefined
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined

    // Debounce: rajadas de eventos (importações em lote, várias coleções de
    // uma vez) são coalescidas em uma única chamada depois de `delayMs`.
    const fireDebounced = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        timer = undefined
        callbackRef.current({ action: '', record: {} as TRecord })
      }, delayMs)
    }

    pb.collection<TRecord>(collectionName)
      .subscribe('*', (e) => {
        fireDebounced()
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
      if (timer) clearTimeout(timer)
      if (unsubscribeFn) {
        unsubscribeFn().catch(() => {})
      }
    }
  }, [collectionName, enabled, delayMs])
}

export default useRealtime
