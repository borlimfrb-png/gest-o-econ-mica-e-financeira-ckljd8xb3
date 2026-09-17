import pb from '@/lib/pocketbase/client'
import type {
  TributoLancamentoInput,
  TributoLancamentoRecord,
  TipoLancamentoTributario,
} from '@/types/finance'

export interface FiltrosTributosLancamentos {
  empresaId: string
  tipo?: TipoLancamentoTributario
  ano?: number
  mes?: number
  dataInicio?: string
  dataFim?: string
  busca?: string
}

export const tributosLancamentosService = {
  /**
   * Lista lançamentos tributários (entradas ou saídas) de uma empresa
   */
  async listar(filtros: FiltrosTributosLancamentos): Promise<TributoLancamentoRecord[]> {
    const filterParts: string[] = [`empresa = "${filtros.empresaId}"`]

    if (filtros.tipo) {
      filterParts.push(`tipo = "${filtros.tipo}"`)
    }

    if (filtros.ano && !filtros.dataInicio && !filtros.dataFim) {
      const inicio = `${filtros.ano}-01-01 00:00:00`
      const fim = `${filtros.ano}-12-31 23:59:59`
      filterParts.push(`data >= "${inicio}" && data <= "${fim}"`)
    } else {
      if (filtros.dataInicio) {
        filterParts.push(`data >= "${filtros.dataInicio} 00:00:00"`)
      }
      if (filtros.dataFim) {
        filterParts.push(`data <= "${filtros.dataFim} 23:59:59"`)
      }
    }

    if (filtros.busca && filtros.busca.trim() !== '') {
      const term = filtros.busca.replace(/"/g, '\\"')
      filterParts.push(
        `(fornecedor_tomador ~ "${term}" || numero_nota ~ "${term}" || cfop ~ "${term}" || cnpj_cpf ~ "${term}")`,
      )
    }

    try {
      return await pb.collection('tributos_lancamentos').getFullList<TributoLancamentoRecord>({
        filter: filterParts.join(' && '),
        sort: '-data,-created',
      })
    } catch (error) {
      console.error('Erro ao listar lançamentos tributários:', error)
      return []
    }
  },

  /**
   * Obtém um lançamento por ID
   */
  async getById(id: string): Promise<TributoLancamentoRecord | null> {
    try {
      return await pb.collection('tributos_lancamentos').getOne<TributoLancamentoRecord>(id)
    } catch (error) {
      console.error('Erro ao buscar lançamento tributário:', error)
      return null
    }
  },

  /**
   * Cria um novo lançamento de tributo (entrada ou saída)
   */
  async criar(dados: TributoLancamentoInput): Promise<TributoLancamentoRecord> {
    const authId = pb.authStore.record?.id
    const payload = {
      ...dados,
      user: authId || null,
    }
    return await pb.collection('tributos_lancamentos').create<TributoLancamentoRecord>(payload)
  },

  /**
   * Atualiza um lançamento tributário existente
   */
  async atualizar(
    id: string,
    dados: Partial<TributoLancamentoInput>,
  ): Promise<TributoLancamentoRecord> {
    return await pb.collection('tributos_lancamentos').update<TributoLancamentoRecord>(id, dados)
  },

  /**
   * Exclui um lançamento tributário
   */
  async excluir(id: string): Promise<boolean> {
    return await pb.collection('tributos_lancamentos').delete(id)
  },
}
