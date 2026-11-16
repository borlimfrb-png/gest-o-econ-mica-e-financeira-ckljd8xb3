import pb from '@/lib/pocketbase/client'

export interface OtimizacaoLogRecord {
  id: string
  disparo: 'automatico' | 'manual'
  sucesso: boolean
  colecoes_analisadas: number
  registros_totais: number
  indices_recomendados: number
  aplicados: string[]
  falhas: { indice: string; motivo: string }[]
  pendentes_antes: number
  pendentes_depois: number
  executado_por: string
  created: string
  updated: string
}

/** Busca a última execução de otimização (automática ou manual). */
export async function ultimaOtimizacao(
  disparo?: 'automatico' | 'manual',
): Promise<OtimizacaoLogRecord | null> {
  try {
    const lista = await pb.collection('db_otimizacoes_log').getList(1, 1, {
      sort: '-created',
      filter: disparo ? `disparo='${disparo}'` : undefined,
    })
    const item = lista.items[0]
    if (!item) return null
    return {
      id: item.id,
      disparo: (item.disparo as 'automatico' | 'manual') || 'automatico',
      sucesso: !!item.sucesso,
      colecoes_analisadas: item.colecoes_analisadas ?? 0,
      registros_totais: item.registros_totais ?? 0,
      indices_recomendados: item.indices_recomendados ?? 0,
      aplicados: Array.isArray(item.aplicados) ? (item.aplicados as string[]) : [],
      falhas: Array.isArray(item.falhas)
        ? (item.falhas as { indice: string; motivo: string }[])
        : [],
      pendentes_antes: item.pendentes_antes ?? 0,
      pendentes_depois: item.pendentes_depois ?? 0,
      executado_por: item.executado_por || '',
      created: item.created,
      updated: item.updated,
    }
  } catch {
    return null
  }
}
