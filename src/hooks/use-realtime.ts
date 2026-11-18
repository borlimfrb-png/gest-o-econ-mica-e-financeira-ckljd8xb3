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
 * Realtime com debounce: rajadas de eventos (importações em lote, várias
 * coleções alteradas de uma vez) são coalescidas numa única recarga, evitando
 * estourar o rate limit do backend (429) e recargas em cascata.
 *
 * Padrão usado nas telas de Dashboard e Dashboard BI (desde v0.0.367):
 * cada evento apenas agenda a callback para rodar uma única vez após o
 * intervalo (~1,5s); eventos subsequentes dentro da janela reiniciam o timer.
 */
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
    let timerId: ReturnType<typeof setTimeout> | undefined

    const agendar = () => {
      if (timerId !== undefined) {
        clearTimeout(timerId)
      }
      timerId = setTimeout(() => {
        timerId = undefined
        callbackRef.current(undefined as unknown as RecordSubscription<TRecord>)
      }, delayMs)
    }

    pb.collection<TRecord>(collectionName)
      .subscribe('*', (e) => {
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
      if (timerId !== undefined) {
        clearTimeout(timerId)
      }
      if (unsubscribeFn) {
        unsubscribeFn().catch(() => {})
      }
    }
  }, [collectionName, enabled, delayMs])
}

export default useRealtime
