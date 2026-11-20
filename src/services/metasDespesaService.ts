import pb from '@/lib/pocketbase/client'
import type { MetaDespesaMensalRecord } from '@/types/finance'

/**
 * Serviço das METAS MENSAIS DE DESPESA do Ponto de Equilíbrio.
 *
 * Espelho exato do metasReceitaService: um registro por empresa + ano + mês
 * (índice único no banco), o valor é a meta de despesa daquele mês, em R$.
 * Coleção `metas_despesa_mensal` (migração 0117) — admin e perfil
 * empresa/financeiro com vínculo; cliente sem acesso (regras RLS da coleção).
 */

export interface SalvarMetaDespesaInput {
  empresa: string
  ano: number
  mes: number
  /** Meta em R$; 0 ou indefinido remove a meta do mês. */
  valor: number
}

function currentUserId(): string {
  return pb.authStore.record?.id || ''
}

const EXPAND = 'empresa'

export const metasDespesaService = {
  /** Todas as metas da empresa (opcionalmente filtradas por ano). */
  async getAll(options?: { empresaId?: string; ano?: number }): Promise<MetaDespesaMensalRecord[]> {
    const filters: string[] = []
    if (options?.empresaId) filters.push(`empresa = '${options.empresaId}'`)
    if (options?.ano !== undefined) filters.push(`ano = ${options.ano}`)
    return await pb.collection('metas_despesa_mensal').getFullList<MetaDespesaMensalRecord>({
      filter: filters.length ? filters.join(' && ') : undefined,
      sort: 'ano,mes',
      expand: EXPAND,
    })
  },

  /** Cria ou atualiza a meta de um mês (upsert pela chave empresa/ano/mês). */
  async salvar(input: SalvarMetaDespesaInput): Promise<MetaDespesaMensalRecord | null> {
    const valor = Number(input.valor) || 0
    const existente = await pb
      .collection('metas_despesa_mensal')
      .getFirstListItem<MetaDespesaMensalRecord>(
        `empresa = '${input.empresa}' && ano = ${input.ano} && mes = ${input.mes}`,
      )
      .catch(() => null)

    if (!existente) {
      if (valor <= 0) return null // nada a criar: sem meta
      return await pb.collection('metas_despesa_mensal').create<MetaDespesaMensalRecord>(
        {
          empresa: input.empresa,
          ano: Math.trunc(input.ano),
          mes: Math.trunc(input.mes),
          valor,
          user: currentUserId(),
        },
        { expand: EXPAND },
      )
    }

    if (valor <= 0) {
      // Meta zerada/limpa: remove o registro.
      await pb.collection('metas_despesa_mensal').delete(existente.id)
      return null
    }
    return await pb
      .collection('metas_despesa_mensal')
      .update<MetaDespesaMensalRecord>(existente.id, { valor }, { expand: EXPAND })
  },

  /** Salva em lote (usado pelo botão "Salvar Metas" da tela). */
  async salvarLote(itens: SalvarMetaDespesaInput[]): Promise<{ ok: number; falhas: number }> {
    let ok = 0
    let falhas = 0
    for (const item of itens) {
      try {
        await metasDespesaService.salvar(item)
        ok++
      } catch (e) {
        console.error('Falha ao salvar meta de despesa', item, e)
        falhas++
      }
    }
    return { ok, falhas }
  },
}
