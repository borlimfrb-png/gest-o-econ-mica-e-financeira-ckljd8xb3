import pb from '@/lib/pocketbase/client'
import type { RecordModel } from 'pocketbase'

export type KpiOperador = 'nenhum' | 'divisao' | 'subtracao' | 'soma' | 'multiplicacao'

export type KpiMetrica =
  | 'roe'
  | 'margem_liquida'
  | 'margem_bruta'
  | 'margem_ebitda'
  | 'liquidez_corrente'
  | 'endividamento'
  | 'receita'
  | 'lucro'
  | 'ebitda'

export interface KpiPersonalizadoRecord extends RecordModel {
  usuario?: string
  empresa: string
  nome: string
  metrica_base: KpiMetrica
  metrica_secundaria?: KpiMetrica | ''
  operador: KpiOperador
  cor?: string
  ordem?: number
  ativo?: boolean
}

export interface KpiComposto {
  /** rótulo curto, ex.: "EBITDA / Receita" */
  formula: string
  /** valor calculado no exercício ativo (não normalizado) */
  valorAtivo: number
  /** valor calculado no exercício anterior (não normalizado) */
  valorAnoAnterior: number
  /** unidade derivada da fórmula: % (divisão de mesmo tipo), x, R$ ou p.p. */
  unidade: '%' | 'x' | 'R$' | 'p.p.'
  temAnoAnterior: boolean
}

export const KPI_METRICAS: { value: KpiMetrica; label: string; grupo: 'margem' | 'valor' }[] = [
  { value: 'roe', label: 'ROE', grupo: 'margem' },
  { value: 'margem_liquida', label: 'Margem Líquida', grupo: 'margem' },
  { value: 'margem_bruta', label: 'Margem Bruta', grupo: 'margem' },
  { value: 'margem_ebitda', label: 'Margem EBITDA', grupo: 'margem' },
  { value: 'liquidez_corrente', label: 'Liquidez Corrente', grupo: 'margem' },
  { value: 'endividamento', label: 'Endividamento', grupo: 'margem' },
  { value: 'receita', label: 'Receita', grupo: 'valor' },
  { value: 'lucro', label: 'Lucro', grupo: 'valor' },
  { value: 'ebitda', label: 'EBITDA', grupo: 'valor' },
]

export function kpiMetricaLabel(metrica: KpiMetrica): string {
  return KPI_METRICAS.find((m) => m.value === metrica)?.label ?? metrica
}

/**
 * Serviço de KPIs personalizados do HUB (coleção `kpis_personalizados`).
 * CRUD no mesmo padrão do benchmarksService.
 */
export const kpisPersonalizadosService = {
  async getAll(empresaId?: string): Promise<KpiPersonalizadoRecord[]> {
    try {
      const options: Record<string, any> = { sort: 'ordem,created' }
      if (empresaId) {
        options.filter = `empresa = "${empresaId}"`
      }
      return await pb.collection<KpiPersonalizadoRecord>('kpis_personalizados').getFullList(options)
    } catch (err) {
      console.error('Erro ao buscar KPIs personalizados:', err)
      return []
    }
  },

  async create(
    payload: Omit<KpiPersonalizadoRecord, 'id' | 'expand'>,
  ): Promise<KpiPersonalizadoRecord> {
    const userId = pb.authStore.record?.id
    if (!userId) throw new Error('Usuário não autenticado.')

    return await pb
      .collection<KpiPersonalizadoRecord>('kpis_personalizados')
      .create<KpiPersonalizadoRecord>({ ...payload, usuario: userId })
  },

  async update(
    id: string,
    payload: Partial<KpiPersonalizadoRecord>,
  ): Promise<KpiPersonalizadoRecord> {
    return await pb
      .collection<KpiPersonalizadoRecord>('kpis_personalizados')
      .update<KpiPersonalizadoRecord>(id, payload)
  },

  async remove(id: string): Promise<boolean> {
    try {
      await pb.collection('kpis_personalizados').delete(id)
      return true
    } catch {
      return false
    }
  },
}
