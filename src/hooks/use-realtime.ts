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
 * Igual ao useRealtime, mas com debounce (trailing 1,5s): quando vários
 * registros mudam em sequência, o callback só dispara 1,5s depois do último
 * evento — evita recarregar a tela inteira a cada gravação.
 */
export function useRealtimeDebounced<TRecord extends RecordModel = RecordModel>(
  collectionName: string,
  callback: (data: RecordSubscription<TRecord>) => void,
  enabled: boolean = true,
  delayMs: number = 1500,
) {
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const lastEventRef = useRef<RecordSubscription<TRecord> | undefined>(undefined)

  useEffect(() => {
    if (!enabled) return

    let cancelled = false

    const fire = () => {
      timeoutRef.current = undefined
      const event = lastEventRef.current
      lastEventRef.current = undefined
      if (event) callbackRef.current(event)
    }

    const schedule = (data: RecordSubscription<TRecord>) => {
      lastEventRef.current = data
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(fire, delayMs)
    }

    const unsubscribePromise = pb
      .collection<TRecord>(collectionName)
      .subscribe('*', schedule)
      .then((fn) => {
        if (cancelled) {
          fn().catch(() => {})
        }
        return fn
      })
      .catch(() => undefined)

    return () => {
      cancelled = true
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = undefined
      }
      unsubscribePromise.then((fn) => fn?.().catch(() => {})).catch(() => {})
    }
  }, [collectionName, enabled, delayMs])
}

export default useRealtime
