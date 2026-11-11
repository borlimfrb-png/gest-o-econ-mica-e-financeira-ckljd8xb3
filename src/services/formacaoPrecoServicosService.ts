import pb from '@/lib/pocketbase/client'
import { fetchAllRecords } from '@/lib/pocketbase/fetchAll'

export interface CustoFixoItemRecord {
  nome: string
  valor: number
}

export interface FormacaoServicoParametrosRecord {
  id: string
  usuario?: string
  empresa: string
  custos_fixos: CustoFixoItemRecord[]
  quantidade_profissionais: number
  horas_produtivas_profissional: number
  fator_ociosidade: number
  percentual_impostos: number
  percentual_comissao: number
  percentual_margem: number
  regime_tributario?: string
  observacoes?: string
  created?: string
  updated?: string
  [key: string]: any
}

export interface FormacaoServicoRecord {
  id: string
  usuario?: string
  empresa: string
  nome: string
  descricao?: string
  horas_estimadas: number
  custo_direto: number
  profissionais_envolvidos: number
  created?: string
  updated?: string
  [key: string]: any
}

const COLECAO_PARAMETROS = 'formacao_servicos_parametros'
const COLECAO_SERVICOS = 'formacao_servicos'

/**
 * CRUD dos parâmetros e serviços de Formação de Preço de Serviços.
 * Escopo por empresa ativa (seletor do cabeçalho), no padrão das demais telas.
 */
export const formacaoPrecoServicosService = {
  // ---------------- Parâmetros ----------------
  async getParametros(empresaId?: string): Promise<FormacaoServicoParametrosRecord | null> {
    if (!empresaId) return null
    const list = await pb
      .collection(COLECAO_PARAMETROS)
      .getList<FormacaoServicoParametrosRecord>(1, 1, {
        filter: pb.filter('empresa = {:empresaId}', { empresaId }),
      })
    return list.items[0] ?? null
  },

  async salvarParametros(
    empresaId: string,
    dados: Partial<FormacaoServicoParametrosRecord>,
    idExistente?: string,
  ): Promise<FormacaoServicoParametrosRecord> {
    const payload = {
      empresa: empresaId,
      usuario: pb.authStore.record?.id,
      custos_fixos: dados.custos_fixos ?? [],
      quantidade_profissionais: Number(dados.quantidade_profissionais) || 0,
      horas_produtivas_profissional: Number(dados.horas_produtivas_profissional) || 0,
      fator_ociosidade: Number(dados.fator_ociosidade) || 0,
      percentual_impostos: Number(dados.percentual_impostos) || 0,
      percentual_comissao: Number(dados.percentual_comissao) || 0,
      percentual_margem: Number(dados.percentual_margem) || 0,
      regime_tributario: dados.regime_tributario || '',
      observacoes: dados.observacoes || '',
    }
    if (idExistente) {
      return pb
        .collection(COLECAO_PARAMETROS)
        .update<FormacaoServicoParametrosRecord>(idExistente, payload)
    }
    return pb.collection(COLECAO_PARAMETROS).create<FormacaoServicoParametrosRecord>(payload)
  },

  // ---------------- Serviços ----------------
  async getAllServicos(empresaId?: string): Promise<FormacaoServicoRecord[]> {
    if (!empresaId) return []
    return fetchAllRecords<FormacaoServicoRecord>(COLECAO_SERVICOS, {
      filter: pb.filter('empresa = {:empresaId}', { empresaId }),
      sort: 'created',
    })
  },

  async criarServico(
    empresaId: string,
    dados: Partial<FormacaoServicoRecord>,
  ): Promise<FormacaoServicoRecord> {
    return pb.collection(COLECAO_SERVICOS).create<FormacaoServicoRecord>({
      empresa: empresaId,
      usuario: pb.authStore.record?.id,
      nome: dados.nome,
      descricao: dados.descricao || '',
      horas_estimadas: Number(dados.horas_estimadas) || 0,
      custo_direto: Number(dados.custo_direto) || 0,
      profissionais_envolvidos: Number(dados.profissionais_envolvidos) || 0,
    })
  },

  async atualizarServico(
    id: string,
    dados: Partial<FormacaoServicoRecord>,
  ): Promise<FormacaoServicoRecord> {
    return pb.collection(COLECAO_SERVICOS).update<FormacaoServicoRecord>(id, {
      nome: dados.nome,
      descricao: dados.descricao || '',
      horas_estimadas: Number(dados.horas_estimadas) || 0,
      custo_direto: Number(dados.custo_direto) || 0,
      profissionais_envolvidos: Number(dados.profissionais_envolvidos) || 0,
    })
  },

  async excluirServico(id: string): Promise<void> {
    await pb.collection(COLECAO_SERVICOS).delete(id)
  },
}
