import pb from '@/lib/pocketbase/client'

export interface DetalheAuditoriaColecao {
  colecao: string
  categoria: string
  conforme: boolean
  erro?: string
  regrasAtuais?: {
    list: string
    view: string
    create: string
    update: string
    delete: string
  }
}

export interface AuditoriaSegurancaRecord {
  id: string
  data_verificacao: string
  status_geral: 'ok' | 'divergencia'
  total_colecoes: number
  total_conformes: number
  total_divergencias: number
  detalhes?: DetalheAuditoriaColecao[] | string
  executado_por?: string
  created: string
  updated: string
}

export interface DispararVerificacaoResponse {
  success: boolean
  relatorio: {
    id: string
    data_verificacao: string
    status_geral: 'ok' | 'divergencia'
    total_colecoes: number
    total_conformes: number
    total_divergencias: number
    detalhes: DetalheAuditoriaColecao[]
  }
}

export const auditoriaSegurancaService = {
  /**
   * Busca todo o histórico de relatórios de auditoria de segurança (ordem decrescente de criação)
   */
  async listar(): Promise<AuditoriaSegurancaRecord[]> {
    try {
      const records = await pb
        .collection('auditoria_seguranca')
        .getFullList<AuditoriaSegurancaRecord>({
          sort: '-created',
        })
      return records.map((r) => {
        let detalhes = r.detalhes
        if (typeof detalhes === 'string') {
          try {
            detalhes = JSON.parse(detalhes)
          } catch {
            /* intentionally ignored */
          }
        }
        return {
          ...r,
          detalhes,
        }
      })
    } catch (err) {
      console.error('Erro ao listar auditorias de segurança:', err)
      return []
    }
  },

  /**
   * Obtém a auditoria mais recente
   */
  async obterUltima(): Promise<AuditoriaSegurancaRecord | null> {
    try {
      const record = await pb
        .collection('auditoria_seguranca')
        .getFirstListItem<AuditoriaSegurancaRecord>('', {
          sort: '-created',
        })
      let detalhes = record.detalhes
      if (typeof detalhes === 'string') {
        try {
          detalhes = JSON.parse(detalhes)
        } catch {
          /* intentionally ignored */
        }
      }
      return {
        ...record,
        detalhes,
      }
    } catch {
      return null
    }
  },

  /**
   * Dispara a verificação sob demanda via endpoint customizado no backend
   */
  async dispararVerificacaoManual(): Promise<DispararVerificacaoResponse> {
    const res = await pb.send<DispararVerificacaoResponse>(
      '/api/admin/auditoria-seguranca/verificar',
      {
        method: 'POST',
      },
    )
    return res
  },
}
