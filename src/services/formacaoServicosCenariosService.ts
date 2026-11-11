import pb from '@/lib/pocketbase/client'
import { fetchAllRecords } from '@/lib/pocketbase/fetchAll'
import type { ParametrosCenario } from '@/lib/formacaoPrecoServicosCenarios'
import { CENARIO_BASE } from '@/lib/formacaoPrecoServicosCenarios'

export interface FormacaoServicoCenarioRecord {
  id: string
  usuario?: string
  empresa: string
  nome: string
  descricao?: string
  parametros: ParametrosCenario
  created?: string
  updated?: string
  [key: string]: any
}

const COLECAO_CENARIOS = 'formacao_servicos_cenarios'

function normalizarParametros(valor: unknown): ParametrosCenario {
  const v = (valor ?? {}) as Record<string, unknown>
  const num = (x: unknown, fallback: number) => {
    const n = Number(x)
    return Number.isFinite(n) ? n : fallback
  }
  return {
    percentual_margem: num(v.percentual_margem, 0),
    percentual_impostos: num(v.percentual_impostos, 0),
    percentual_comissao: num(v.percentual_comissao, 0),
    fator_custos_fixos: num(v.fator_custos_fixos, 1) || 1,
    fator_custos_diretos: num(v.fator_custos_diretos, 1) || 1,
    fator_horas: num(v.fator_horas, 1) || 1,
  }
}

/**
 * CRUD dos cenários nomeados da Formação de Preço de Serviços.
 * Escopo por empresa ativa (seletor do cabeçalho), no padrão das demais telas.
 * Perfil cliente não tem acesso (regras da coleção bloqueiam).
 */
export const formacaoServicosCenariosService = {
  async getAll(empresaId?: string): Promise<FormacaoServicoCenarioRecord[]> {
    if (!empresaId) return []
    return fetchAllRecords<FormacaoServicoCenarioRecord>(COLECAO_CENARIOS, {
      filter: pb.filter('empresa = {:empresaId}', { empresaId }),
      sort: '-created',
    })
  },

  async criar(
    empresaId: string,
    dados: { nome: string; descricao?: string; parametros: ParametrosCenario },
  ): Promise<FormacaoServicoCenarioRecord> {
    return pb.collection(COLECAO_CENARIOS).create<FormacaoServicoCenarioRecord>({
      empresa: empresaId,
      usuario: pb.authStore.record?.id,
      nome: dados.nome,
      descricao: dados.descricao || '',
      parametros: normalizarParametros(dados.parametros),
    })
  },

  async atualizar(
    id: string,
    dados: { nome?: string; descricao?: string; parametros: ParametrosCenario },
  ): Promise<FormacaoServicoCenarioRecord> {
    return pb.collection(COLECAO_CENARIOS).update<FormacaoServicoCenarioRecord>(id, {
      ...(dados.nome !== undefined ? { nome: dados.nome } : {}),
      ...(dados.descricao !== undefined ? { descricao: dados.descricao } : {}),
      parametros: normalizarParametros(dados.parametros),
    })
  },

  async excluir(id: string): Promise<void> {
    await pb.collection(COLECAO_CENARIOS).delete(id)
  },

  normalizarParametros,
}

/** Cenário vazio (fatores 1, percentuais 0) para iniciar um novo cenário. */
export function novoCenarioVazio(): ParametrosCenario {
  return { ...CENARIO_BASE }
}
