import pb from '@/lib/pocketbase/client'
import type { ContratoRecord, EmpresaRecord, PeriodoCobrancaItem } from '@/types/finance'

function currentUserId(): string {
  const id = pb.authStore.record?.id
  if (!id) throw new Error('Usuário não autenticado')
  return id
}

export interface SalvarContratoInput {
  contratada_razao_social: string
  contratada_cnpj: string
  contratada_endereco?: string
  contratada_crc?: string
  contratante: string
  data_inicio: string // YYYY-MM-DD
  prazo_inicial: number
  quantidade_meses: number
  valor_parcela: number
  dia_vencimento: number
  data_final: string // YYYY-MM-DD
  parcelas: number
  // Suporte a períodos de cobrança recorrentes em faixas
  periodos_cobranca?: PeriodoCobrancaItem[]
  // Formas de pagamento pontuais (compatibilidade)
  forma_pagamento_1?: string
  valor_1?: number
  vencimento_1?: string
  forma_pagamento_2?: string
  valor_2?: number
  vencimento_2?: string
  observacoes_pagamento?: string
}

export const contratosService = {
  /**
   * Lista todos os contratos do usuário autenticado.
   */
  async listar(): Promise<ContratoRecord[]> {
    const userId = currentUserId()
    return await pb.collection('contratos').getFullList<ContratoRecord>({
      filter: `user = '${userId}'`,
      sort: '-created',
      expand: 'contratante',
    })
  },

  /**
   * Obtém um contrato por ID.
   */
  async getById(id: string): Promise<ContratoRecord> {
    return await pb.collection('contratos').getOne<ContratoRecord>(id, {
      expand: 'contratante',
    })
  },

  /**
   * Cria um novo contrato no backend com suporte às 2 formas de pagamento.
   */
  async criar(data: SalvarContratoInput): Promise<ContratoRecord> {
    const userId = currentUserId()

    const dataInicioFormatted = data.data_inicio.includes(' ')
      ? data.data_inicio
      : `${data.data_inicio} 12:00:00`

    const dataFinalFormatted = data.data_final.includes(' ')
      ? data.data_final
      : `${data.data_final} 12:00:00`

    const vencimento1Formatted = data.vencimento_1
      ? data.vencimento_1.includes(' ')
        ? data.vencimento_1
        : `${data.vencimento_1} 12:00:00`
      : null

    const vencimento2Formatted = data.vencimento_2
      ? data.vencimento_2.includes(' ')
        ? data.vencimento_2
        : `${data.vencimento_2} 12:00:00`
      : null

    const payload: Record<string, any> = {
      user: userId,
      contratada_razao_social: data.contratada_razao_social,
      contratada_cnpj: data.contratada_cnpj,
      contratada_endereco: data.contratada_endereco || '',
      contratada_crc: data.contratada_crc || '',
      contratante: data.contratante,
      data_inicio: dataInicioFormatted,
      prazo_inicial: Number(data.prazo_inicial) || 0,
      quantidade_meses: Number(data.quantidade_meses) || 0,
      valor_parcela: Number(data.valor_parcela) || 0,
      dia_vencimento: Number(data.dia_vencimento) || 1,
      data_final: dataFinalFormatted,
      parcelas: Number(data.parcelas) || 0,
      periodos_cobranca: data.periodos_cobranca || [],
      forma_pagamento_1: data.forma_pagamento_1 || 'Pix',
      valor_1: Number(data.valor_1) || 0,
      vencimento_1: vencimento1Formatted,
      forma_pagamento_2: data.forma_pagamento_2 || '',
      valor_2: Number(data.valor_2) || 0,
      vencimento_2: vencimento2Formatted,
      observacoes_pagamento: data.observacoes_pagamento || '',
    }

    return await pb.collection('contratos').create<ContratoRecord>(payload as any, {
      expand: 'contratante',
    })
  },

  /**
   * Atualiza um contrato existente no backend.
   */
  async atualizar(id: string, data: Partial<SalvarContratoInput>): Promise<ContratoRecord> {
    const payload: Record<string, any> = {}

    if (data.contratada_razao_social !== undefined)
      payload.contratada_razao_social = data.contratada_razao_social
    if (data.contratada_cnpj !== undefined) payload.contratada_cnpj = data.contratada_cnpj
    if (data.contratada_endereco !== undefined)
      payload.contratada_endereco = data.contratada_endereco
    if (data.contratada_crc !== undefined) payload.contratada_crc = data.contratada_crc
    if (data.contratante !== undefined) payload.contratante = data.contratante
    if (data.data_inicio !== undefined) {
      payload.data_inicio = data.data_inicio.includes(' ')
        ? data.data_inicio
        : `${data.data_inicio} 12:00:00`
    }
    if (data.prazo_inicial !== undefined) payload.prazo_inicial = Number(data.prazo_inicial) || 0
    if (data.quantidade_meses !== undefined)
      payload.quantidade_meses = Number(data.quantidade_meses) || 0
    if (data.valor_parcela !== undefined) payload.valor_parcela = Number(data.valor_parcela) || 0
    if (data.dia_vencimento !== undefined) payload.dia_vencimento = Number(data.dia_vencimento) || 1
    if (data.data_final !== undefined) {
      payload.data_final = data.data_final.includes(' ')
        ? data.data_final
        : `${data.data_final} 12:00:00`
    }
    if (data.parcelas !== undefined) payload.parcelas = Number(data.parcelas) || 0
    if (data.periodos_cobranca !== undefined) payload.periodos_cobranca = data.periodos_cobranca

    // Campos de formas de pagamento
    if (data.forma_pagamento_1 !== undefined) payload.forma_pagamento_1 = data.forma_pagamento_1
    if (data.valor_1 !== undefined) payload.valor_1 = Number(data.valor_1) || 0
    if (data.vencimento_1 !== undefined) {
      payload.vencimento_1 = data.vencimento_1
        ? data.vencimento_1.includes(' ')
          ? data.vencimento_1
          : `${data.vencimento_1} 12:00:00`
        : null
    }

    if (data.forma_pagamento_2 !== undefined) payload.forma_pagamento_2 = data.forma_pagamento_2
    if (data.valor_2 !== undefined) payload.valor_2 = Number(data.valor_2) || 0
    if (data.vencimento_2 !== undefined) {
      payload.vencimento_2 = data.vencimento_2
        ? data.vencimento_2.includes(' ')
          ? data.vencimento_2
          : `${data.vencimento_2} 12:00:00`
        : null
    }

    if (data.observacoes_pagamento !== undefined)
      payload.observacoes_pagamento = data.observacoes_pagamento

    return await pb.collection('contratos').update<ContratoRecord>(id, payload as any, {
      expand: 'contratante',
    })
  },

  /**
   * Exclui um contrato por ID.
   */
  async excluir(id: string): Promise<boolean> {
    return await pb.collection('contratos').delete(id)
  },
}
