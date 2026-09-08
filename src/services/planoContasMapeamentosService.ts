import pb from '@/lib/pocketbase/client'
import type { PlanoContaMapeamentoRecord } from '@/types/finance'

export interface SalvarMapeamentoInput {
  empresa: string
  codigo_empresa: string
  plano_conta: string
}

function currentUserId(): string {
  return pb.authStore.record?.id || ''
}

export const planoContasMapeamentosService = {
  /**
   * Obtém todos os mapeamentos gravados para uma empresa específica
   */
  async getAll(empresaId: string): Promise<PlanoContaMapeamentoRecord[]> {
    if (!empresaId) return []
    try {
      return await pb
        .collection('plano_contas_mapeamentos')
        .getFullList<PlanoContaMapeamentoRecord>({
          filter: `empresa = '${empresaId}'`,
          expand: 'plano_conta.conta,plano_conta.centro,plano_conta.tipo_despesa',
          sort: '-updated',
          requestKey: null,
        })
    } catch (err) {
      console.warn('[planoContasMapeamentosService] Falha ao buscar mapeamentos:', err)
      return []
    }
  },

  /**
   * Salva ou atualiza um vínculo codigo_empresa -> plano_conta para uma empresa.
   * Se já existir vínculo para este codigo_empresa na mesma empresa, atualiza para o novo plano_conta.
   */
  async salvarOuAtualizar(
    input: SalvarMapeamentoInput,
  ): Promise<PlanoContaMapeamentoRecord | null> {
    const codNormalizado = input.codigo_empresa.trim()
    if (!input.empresa || !codNormalizado || !input.plano_conta) {
      return null
    }

    try {
      const sanitizedCod = codNormalizado.replace(/'/g, "\\'")
      const existentes = await pb
        .collection('plano_contas_mapeamentos')
        .getFullList<PlanoContaMapeamentoRecord>({
          filter: `empresa = '${input.empresa}' && codigo_empresa = '${sanitizedCod}'`,
          requestKey: null,
        })

      if (existentes.length > 0) {
        const itemExistente = existentes[0]
        if (itemExistente.plano_conta !== input.plano_conta) {
          return await pb.collection('plano_contas_mapeamentos').update<PlanoContaMapeamentoRecord>(
            itemExistente.id,
            {
              plano_conta: input.plano_conta,
              user: currentUserId() || itemExistente.user,
            },
            {
              expand: 'plano_conta.conta,plano_conta.centro,plano_conta.tipo_despesa',
            },
          )
        }
        return itemExistente
      }

      return await pb.collection('plano_contas_mapeamentos').create<PlanoContaMapeamentoRecord>(
        {
          empresa: input.empresa,
          codigo_empresa: codNormalizado,
          plano_conta: input.plano_conta,
          user: currentUserId(),
        },
        {
          expand: 'plano_conta.conta,plano_conta.centro,plano_conta.tipo_despesa',
        },
      )
    } catch (err) {
      console.warn('[planoContasMapeamentosService] Erro não fatal ao salvar mapeamento:', err)
      return null
    }
  },

  /**
   * Remove um mapeamento por id
   */
  async delete(id: string): Promise<boolean> {
    try {
      return await pb.collection('plano_contas_mapeamentos').delete(id)
    } catch (err) {
      console.warn('[planoContasMapeamentosService] Falha ao deletar mapeamento:', err)
      return false
    }
  },
}
