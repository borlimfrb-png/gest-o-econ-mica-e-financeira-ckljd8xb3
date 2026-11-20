import pb from '@/lib/pocketbase/client'
import type { MetaReceitaMensalRecord } from '@/types/finance'

/**
 * Serviço das METAS MENSAIS DE RECEITA do Ponto de Equilíbrio.
 *
 * Um registro por empresa + ano + mês (índice único no banco): o valor é a
 * meta de receita daquele mês, em R$. Coleção `metas_receita_mensal`
 * (migração 0116) — admin e perfil empresa/financeiro com vínculo; cliente
 * sem acesso (regras RLS da coleção).
 */

export interface SalvarMetaReceitaInput {
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

export const metasReceitaService = {
  /** Todas as metas da empresa (opcionalmente filtradas por ano). */
  async getAll(options?: { empresaId?: string; ano?: number }): Promise<MetaReceitaMensalRecord[]> {
    const filters: string[] = []
    if (options?.empresaId) filters.push(`empresa = '${options.empresaId}'`)
    if (options?.ano !== undefined) filters.push(`ano = ${options.ano}`)
    return await pb.collection('metas_receita_mensal').getFullList<MetaReceitaMensalRecord>({
      filter: filters.length ? filters.join(' && ') : undefined,
      sort: 'ano,mes',
      expand: EXPAND,
    })
  },

  /** Cria ou atualiza a meta de um mês (upsert pela chave empresa/ano/mês). */
  async salvar(input: SalvarMetaReceitaInput): Promise<MetaReceitaMensalRecord | null> {
    const valor = Number(input.valor) || 0
    const existente = await pb
      .collection('metas_receita_mensal')
      .getFirstListItem<MetaReceitaMensalRecord>(
        `empresa = '${input.empresa}' && ano = ${input.ano} && mes = ${input.mes}`,
      )
      .catch(() => null)

    if (!existente) {
      if (valor <= 0) return null // nada a criar: sem meta
      return await pb.collection('metas_receita_mensal').create<MetaReceitaMensalRecord>(
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
      await pb.collection('metas_receita_mensal').delete(existente.id)
      return null
    }
    return await pb
      .collection('metas_receita_mensal')
      .update<MetaReceitaMensalRecord>(existente.id, { valor }, { expand: EXPAND })
  },

  /** Salva em lote (usado pelo botão "Salvar Metas" da tela). */
  async salvarLote(itens: SalvarMetaReceitaInput[]): Promise<{ ok: number; falhas: number }> {
    let ok = 0
    let falhas = 0
    for (const item of itens) {
      try {
        await metasReceitaService.salvar(item)
        ok++
      } catch (e) {
        console.error('Falha ao salvar meta', item, e)
        falhas++
      }
    }
    return { ok, falhas }
  },
}
