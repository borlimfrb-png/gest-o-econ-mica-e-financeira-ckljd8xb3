import pb from '@/lib/pocketbase/client'
import type { ValuationMultiplosRecord } from '@/types/finance'

export interface SalvarValuationMultiplosInput {
  empresa: string
  ano: number
  segmento_referencia?: string
  ev_ebitda_ref?: number
  pl_ref?: number
  pvp_ref?: number
  ev_receita_ref?: number
  ev_ebit_ref?: number
  p_ebitda_ref?: number
  ev_ebitda_peso?: number
  pl_peso?: number
  pvp_peso?: number
  ev_receita_peso?: number
  ev_ebit_peso?: number
  p_ebitda_peso?: number
  multiplos_ativos?: Record<string, boolean>
  divida_liquida_manual?: number
  observacoes?: string
}

export const valuationMultiplosService = {
  async getByEmpresaEAno(empresaId: string, ano: number): Promise<ValuationMultiplosRecord | null> {
    if (!empresaId || !ano) return null
    try {
      const records = await pb
        .collection('valuation_multiplos')
        .getFullList<ValuationMultiplosRecord>({
          filter: `empresa = "${empresaId}" && ano = ${ano}`,
          sort: '-updated',
          requestKey: null,
        })
      return records.length > 0 ? records[0] : null
    } catch (err: any) {
      if (err?.status === 404) return null
      console.warn('Erro ao buscar múltiplos de valuation:', err)
      return null
    }
  },

  async getByEmpresa(empresaId: string): Promise<ValuationMultiplosRecord[]> {
    if (!empresaId) return []
    try {
      return await pb.collection('valuation_multiplos').getFullList<ValuationMultiplosRecord>({
        filter: `empresa = "${empresaId}"`,
        sort: '-ano',
        requestKey: null,
      })
    } catch (err) {
      console.warn('Erro ao listar múltiplos de valuation da empresa:', err)
      return []
    }
  },

  async save(data: SalvarValuationMultiplosInput): Promise<ValuationMultiplosRecord> {
    const existing = await this.getByEmpresaEAno(data.empresa, data.ano)
    const authId = pb.authStore.model?.id

    const payload = {
      ...data,
      user: authId || undefined,
    }

    if (existing) {
      return await pb
        .collection('valuation_multiplos')
        .update<ValuationMultiplosRecord>(existing.id, payload)
    } else {
      return await pb.collection('valuation_multiplos').create<ValuationMultiplosRecord>(payload)
    }
  },

  async delete(id: string): Promise<boolean> {
    try {
      await pb.collection('valuation_multiplos').delete(id)
      return true
    } catch (err) {
      console.error('Erro ao deletar valuation_multiplos:', err)
      throw err
    }
  },
}
