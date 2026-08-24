import pb from '@/lib/pocketbase/client'
import type { ContratoRecord, EmpresaRecord } from '@/types/finance'

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
   * Cria um novo contrato no backend.
   */
  async criar(data: SalvarContratoInput): Promise<ContratoRecord> {
    const userId = currentUserId()

    const dataInicioFormatted = data.data_inicio.includes(' ')
      ? data.data_inicio
      : `${data.data_inicio} 12:00:00`

    const dataFinalFormatted = data.data_final.includes(' ')
      ? data.data_final
      : `${data.data_final} 12:00:00`

    return await pb.collection('contratos').create<ContratoRecord>(
      {
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
      } as any,
      {
        expand: 'contratante',
      },
    )
  },

  /**
   * Exclui um contrato por ID.
   */
  async excluir(id: string): Promise<boolean> {
    return await pb.collection('contratos').delete(id)
  },
}
