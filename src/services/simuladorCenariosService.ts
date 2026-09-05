import pb from '@/lib/pocketbase/client'
import type { SimuladorCenarioRecord, SimuladorParametrosJson } from '@/types/finance'

export interface SalvarCenarioInput {
  id?: string
  empresa: string
  nome: string
  descricao?: string
  parametros: SimuladorParametrosJson
  divisor_calculado?: number
}

export interface EnviarSimulacaoEmailInput {
  destinatario_email: string
  assunto?: string
  mensagem_opcional?: string
  empresa_id?: string
  empresa_nome?: string
  html_conteudo?: string
}

export const simuladorCenariosService = {
  /**
   * Lista todos os cenários da empresa ativa (ordenados por mais recentes)
   */
  async listarPorEmpresa(empresaId: string): Promise<SimuladorCenarioRecord[]> {
    if (!empresaId) return []
    try {
      return await pb.collection('simulador_cenarios').getFullList<SimuladorCenarioRecord>({
        filter: `empresa = "${empresaId}"`,
        sort: '-created',
        expand: 'usuario,empresa',
        requestKey: null,
      })
    } catch (err) {
      console.error('Erro ao listar cenários do simulador:', err)
      return []
    }
  },

  /**
   * Cria um novo cenário de simulação
   */
  async criar(data: SalvarCenarioInput): Promise<SimuladorCenarioRecord> {
    const currentUser = pb.authStore.record
    const payload = {
      empresa: data.empresa,
      usuario: currentUser?.id || undefined,
      nome: data.nome.trim(),
      descricao: data.descricao?.trim() || '',
      parametros: data.parametros,
      divisor_calculado: data.divisor_calculado,
    }

    return await pb.collection('simulador_cenarios').create<SimuladorCenarioRecord>(payload, {
      expand: 'usuario,empresa',
    })
  },

  /**
   * Atualiza um cenário existente
   */
  async atualizar(id: string, data: Partial<SalvarCenarioInput>): Promise<SimuladorCenarioRecord> {
    const payload: Record<string, any> = {}
    if (data.nome !== undefined) payload.nome = data.nome.trim()
    if (data.descricao !== undefined) payload.descricao = data.descricao.trim()
    if (data.parametros !== undefined) payload.parametros = data.parametros
    if (data.divisor_calculado !== undefined) payload.divisor_calculado = data.divisor_calculado

    return await pb.collection('simulador_cenarios').update<SimuladorCenarioRecord>(id, payload, {
      expand: 'usuario,empresa',
    })
  },

  /**
   * Exclui um cenário de simulação
   */
  async excluir(id: string): Promise<boolean> {
    return await pb.collection('simulador_cenarios').delete(id)
  },

  /**
   * Dispara o laudo de simulação por e-mail chamando o backend hook
   */
  async enviarLaudoEmail(payload: EnviarSimulacaoEmailInput): Promise<{
    success: boolean
    message: string
    destinatario?: string
    codigo?: string
  }> {
    const res = await pb.send<{
      success: boolean
      message: string
      destinatario?: string
      codigo?: string
    }>('/api/simulador/enviar-laudo-email', {
      method: 'POST',
      body: payload,
    })
    return res
  },
}
