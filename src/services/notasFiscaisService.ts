import pb from '@/lib/pocketbase/client'
import type { NotaFiscalRecord, EmpresaRecord, ContratoRecord } from '@/types/finance'

function currentUserId(): string {
  const id = pb.authStore.record?.id
  if (!id) throw new Error('Usuário não autenticado')
  return id
}

export interface EmitirNfseInput {
  empresa_id: string
  contrato_id?: string
  numero?: number
  serie?: string
  discriminacao: string
  item_cnae?: string
  codigo_servico_municipal?: string
  natureza_operacao?: string
  valor_servicos: number
  aliquota_iss?: number
  valor_iss?: number
  iss_retido?: boolean
  valor_pis?: number
  valor_cofins?: number
  valor_inss?: number
  valor_ir?: number
  valor_csll?: number
  outras_retencoes?: number
  desconto_incondicionado?: number
  valor_liquido: number
  competencia?: string
  vencimento?: string
  forcar_simulacao?: boolean
}

export interface EmitirNfseResponse {
  success: boolean
  message: string
  nota?: {
    id: string
    numero: number
    serie: string
    codigo_verificacao: string
    chave_acesso: string
    protocolo_autorizacao: string
    status: string
    modo_emissao: string
    gateway_status_resposta: string
    valor_liquido: number
    data_emissao: string
  }
}

export interface EnviarEmailNfseInput {
  nota_id: string
  destinatario_email?: string
  mensagem_personalizada?: string
}

export interface EnviarEmailNfseResponse {
  success: boolean
  message: string
  destinatario?: string
  data_envio?: string
}

export const notasFiscaisService = {
  /**
   * Lista todas as notas fiscais emitidas pelo usuário.
   */
  async listar(): Promise<NotaFiscalRecord[]> {
    const userId = currentUserId()
    return await pb.collection('notas_fiscais').getFullList<NotaFiscalRecord>({
      filter: `user = '${userId}'`,
      sort: '-data_emissao,-numero',
      expand: 'empresa,contrato',
    })
  },

  /**
   * Busca uma nota fiscal pelo seu ID.
   */
  async getById(id: string): Promise<NotaFiscalRecord> {
    return await pb.collection('notas_fiscais').getOne<NotaFiscalRecord>(id, {
      expand: 'empresa,contrato',
    })
  },

  /**
   * Obtém o próximo número sequencial de nota fiscal sugerido.
   */
  async getProximoNumero(): Promise<number> {
    try {
      const userId = currentUserId()
      const list = await pb.collection('notas_fiscais').getList<NotaFiscalRecord>(1, 1, {
        filter: `user = '${userId}'`,
        sort: '-numero',
      })
      if (list.items.length > 0 && list.items[0].numero) {
        return Number(list.items[0].numero) + 1
      }
      return 1
    } catch {
      return 1
    }
  },

  /**
   * Dispara a emissão e validação no Gateway / SEFAZ via hook server-side.
   */
  async emitirNfse(input: EmitirNfseInput): Promise<EmitirNfseResponse> {
    return await pb.send<EmitirNfseResponse>('/api/nfse/emitir', {
      method: 'POST',
      body: input,
    })
  },

  /**
   * Dispara o envio do e-mail com os dados da NFSe e anexo para o cliente.
   */
  async enviarEmail(input: EnviarEmailNfseInput): Promise<EnviarEmailNfseResponse> {
    return await pb.send<EnviarEmailNfseResponse>('/api/nfse/enviar-email', {
      method: 'POST',
      body: input,
    })
  },

  /**
   * Exclui ou cancela um registro de nota fiscal.
   */
  async excluir(id: string): Promise<boolean> {
    return await pb.collection('notas_fiscais').delete(id)
  },

  /**
   * Atualiza campos de uma nota fiscal.
   */
  async atualizar(id: string, data: Partial<NotaFiscalRecord>): Promise<NotaFiscalRecord> {
    return await pb.collection('notas_fiscais').update<NotaFiscalRecord>(id, data, {
      expand: 'empresa,contrato',
    })
  },

  /**
   * Busca empresas que estão com a flag emitir_nota_fiscal = true.
   */
  async getClientesHabilitados(): Promise<EmpresaRecord[]> {
    return await pb.collection('empresas').getFullList<EmpresaRecord>({
      filter: 'emitir_nota_fiscal = true',
      sort: 'nome',
    })
  },

  /**
   * Busca contrato vigente para um determinado cliente.
   */
  async getContratoPorCliente(empresaId: string): Promise<ContratoRecord | null> {
    try {
      const list = await pb.collection('contratos').getList<ContratoRecord>(1, 1, {
        filter: `contratante = '${empresaId}'`,
        sort: '-data_inicio',
        expand: 'contratante',
      })
      return list.items[0] || null
    } catch {
      return null
    }
  },
}
