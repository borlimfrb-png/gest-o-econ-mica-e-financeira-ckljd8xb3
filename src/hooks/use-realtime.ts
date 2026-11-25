import { useEffect, useRef, useState } from 'react'
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
 * Variante com debounce do useRealtime: agrupa rajadas de eventos de tempo
 * real (sincronizações em lote, imports) em uma única chamada do callback,
 * com debounce "trailing" de 1,5s após o último evento.
 *
 * Assinatura idêntica à do useRealtime (mais um delay opcional em ms).
 */
export function useRealtimeDebounced<TRecord extends RecordModel = RecordModel>(
  collectionName: string,
  callback: (data: RecordSubscription<TRecord>) => void,
  enabled: boolean = true,
  delayMs: number = 1500,
) {
  const [evento, setEvento] = useState<RecordSubscription<TRecord> | null>(null)
  const eventoRef = useRef(evento)
  eventoRef.current = evento

  useRealtime<TRecord>(
    collectionName,
    (data) => {
      setEvento(data)
    },
    enabled,
  )

  useEffect(() => {
    if (!evento) return
    const timer = setTimeout(() => {
      callbackRef.current(eventoRef.current as RecordSubscription<TRecord>)
    }, delayMs)
    return () => clearTimeout(timer)
  }, [evento, delayMs])
}

export default useRealtime
