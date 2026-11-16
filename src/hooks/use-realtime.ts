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
 * Versão com debounce COMPARTILHADO entre todos os listeners ativos:
 * um evento em qualquer coleção dispara os callbacks registrados, mas rajadas
 * (importações em lote, várias coleções de uma vez) são coalescidas num único
 * disparo por callback para não estourar o rate limit do backend (429).
 */
const DEBOUNCE_MS = 800

type Callback = () => void

const callbacksPendentes = new Set<Callback>()
let timerDebounce: ReturnType<typeof setTimeout> | null = null

function agendarDisparo(callback: Callback) {
  callbacksPendentes.add(callback)
  if (timerDebounce !== null) return
  timerDebounce = setTimeout(() => {
    timerDebounce = null
    const pendentes = Array.from(callbacksPendentes)
    callbacksPendentes.clear()
    for (const cb of pendentes) {
      try {
        cb()
      } catch (err) {
        console.error('useRealtimeDebounced: erro em callback', err)
      }
    }
  }, DEBOUNCE_MS)
}

export function useRealtimeDebounced<TRecord extends RecordModel = RecordModel>(
  collectionName: string,
  callback: Callback,
  enabled: boolean = true,
) {
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  useEffect(() => {
    if (!enabled) return

    const fn = () => agendarDisparo(() => callbackRef.current())
    let unsubscribeFn: (() => Promise<void>) | undefined
    let cancelled = false

    pb.collection<TRecord>(collectionName)
      .subscribe('*', fn)
      .then((unsub) => {
        if (cancelled) {
          unsub().catch(() => {})
        } else {
          unsubscribeFn = unsub
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

export default useRealtime
