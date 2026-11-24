import pb from '@/lib/pocketbase/client'
import type { AjustesFiscaisIfrsRecord, ItemAjusteFiscal } from '@/types/finance'

/**
 * Serviço dos AJUSTES FISCAIS IFRS do Simulador de Regimes (/analise-tributaria).
 *
 * Um registro por empresa + ano (índice único na coleção `ajustes_fiscais_ifrs`,
 * migração 0119); o campo JSON `ajustes` guarda a lista de itens da conciliação
 * IFRS → Lucro Fiscal: [{ descricao, tipo: 'Aditivo' | 'Exclusivo', valor }].
 * Mesma estratégia de persistência do metasDespesaService (metas do Ponto de
 * Equilíbrio). Sem acesso ao perfil cliente (RLS da coleção).
 */

export const ajustesFiscaisService = {
  /** Ajustes da empresa + ano; sem registro devolve null (nenhum ajuste lançado). */
  async getByEmpresaAno(empresaId: string, ano: number): Promise<ItemAjusteFiscal[] | null> {
    if (!empresaId) return null
    const rec = await pb
      .collection('ajustes_fiscais_ifrs')
      .getFirstListItem<AjustesFiscaisIfrsRecord>(`empresa = '${empresaId}' && ano = ${ano}`)
      .catch(() => null)
    if (!rec) return null
    return Array.isArray(rec.ajustes) ? rec.ajustes : null
  },

  /**
   * Salva (upsert) a lista completa de ajustes da empresa + ano. Lista vazia remove o registro.
   * Devolve a LISTA de itens efetivamente persistida (normalizada) — os chamadores
   * (AjustesFiscaisCard.onSalvo) sincronizam o estado com ela.
   */
  async salvar(
    empresaId: string,
    ano: number,
    ajustes: ItemAjusteFiscal[],
  ): Promise<ItemAjusteFiscal[]> {
    if (!empresaId) return []
    const existente = await pb
      .collection('ajustes_fiscais_ifrs')
      .getFirstListItem<AjustesFiscaisIfrsRecord>(`empresa = '${empresaId}' && ano = ${ano}`)
      .catch(() => null)

    const normalizados: ItemAjusteFiscal[] = (ajustes || [])
      .filter((a) => a && (a.descricao || '').trim() !== '' && Number(a.valor) !== 0)
      .map((a) => ({
        descricao: String(a.descricao).trim(),
        tipo: a.tipo === 'Exclusivo' ? 'Exclusivo' : 'Aditivo',
        valor: Math.abs(Number(a.valor) || 0),
      }))

    // Lista vazia: remove o registro (ano volta ao estado "sem ajustes").
    if (normalizados.length === 0) {
      if (existente) await pb.collection('ajustes_fiscais_ifrs').delete(existente.id)
      return []
    }

    const user = pb.authStore.record?.id || ''
    if (existente) {
      const rec = await pb
        .collection('ajustes_fiscais_ifrs')
        .update<AjustesFiscaisIfrsRecord>(existente.id, { ajustes: normalizados })
      return Array.isArray(rec?.ajustes) ? (rec.ajustes as ItemAjusteFiscal[]) : normalizados
    }
    const rec = await pb
      .collection('ajustes_fiscais_ifrs')
      .create<AjustesFiscaisIfrsRecord>({ empresa: empresaId, ano, ajustes: normalizados, user })
    return Array.isArray(rec?.ajustes) ? (rec.ajustes as ItemAjusteFiscal[]) : normalizados
  },
}

export default ajustesFiscaisService
