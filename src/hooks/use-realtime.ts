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
 * NÃO REMOVER: usado por Dashboard e outras telas (DashboardBi, etc.).
 *
 * Wrapper de `useRealtime` com debounce trailing de 1,5s: quando vários
 * eventos chegam em sequência, apenas o último dispara o callback após
 * 1,5s de silêncio — evita recarregar dados pesados a cada evento.
 *
 * IMPORTANTE (rules-of-hooks): `useRealtime` é chamado SEMPRE no topo,
 * independente de qualquer condição.
 */
export function useRealtimeDebounced<TRecord extends RecordModel = RecordModel>(
  collectionName: string,
  callback: (data: RecordSubscription<TRecord>) => void,
  enabled: boolean = true,
) {
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  // Evento mais recente fica em ref; o timer (timeout) dispara o callback.
  const eventoPendenteRef = useRef<RecordSubscription<TRecord> | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Estado dummy apenas para forçar re-render quando o hook interno dispara,
  // sem recarregar dados — o próprio callback decide o que fazer.
  const [, setTick] = useState(0)

  const debounced = (data: RecordSubscription<TRecord>) => {
    eventoPendenteRef.current = data
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      eventoPendenteRef.current = null
      callbackRef.current(data)
      setTick((t) => t + 1)
    }, 1500)
  }

  useRealtime<TRecord>(collectionName, debounced, enabled)

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [])
}

export default useRealtime
