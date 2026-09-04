import pb from '@/lib/pocketbase/client'
import type { AuditoriaLancamentoRecord, AcaoAuditoriaLancamento } from '@/types/finance'

export interface RegistrarAuditoriaInput {
  empresa: string
  lancamento_id: string
  acao: AcaoAuditoriaLancamento
  valor?: number
  historico?: string
  conta_info?: string
  detalhes?: {
    campos_alterados?: Record<string, { antes: any; depois: any }>
    dados_anteriores?: Record<string, any>
    dados_novos?: Record<string, any>
    motivo?: string
  }
}

export const auditoriaLancamentosService = {
  /**
   * Registra um evento de auditoria para um lançamento (criação, edição ou exclusão).
   * Captura automaticamente o usuário autenticado no PocketBase.
   */
  async registrar(input: RegistrarAuditoriaInput): Promise<AuditoriaLancamentoRecord | null> {
    try {
      const authModel = pb.authStore.record
      const usuarioId = authModel?.id || undefined
      const usuarioNome = (authModel as any)?.name || 'Usuário do Sistema'
      const usuarioEmail = (authModel as any)?.email || ''

      const record = await pb
        .collection('auditoria_lancamentos')
        .create<AuditoriaLancamentoRecord>({
          empresa: input.empresa,
          lancamento_id: input.lancamento_id,
          acao: input.acao,
          usuario: usuarioId,
          usuario_nome: usuarioNome,
          usuario_email: usuarioEmail,
          valor: input.valor !== undefined ? Number(input.valor) : undefined,
          historico: input.historico?.trim() || undefined,
          conta_info: input.conta_info?.trim() || undefined,
          detalhes: input.detalhes || null,
        } as any)

      return record
    } catch (err) {
      console.error('Falha ao registrar log de auditoria do lançamento:', err)
      // Não quebra a operação principal de lançamento se falhar a gravação da auditoria
      return null
    }
  },

  /**
   * Consulta o histórico de auditoria por lançamento específico ou geral da empresa.
   */
  async listar(options?: {
    empresaId?: string
    lancamentoId?: string
    acao?: AcaoAuditoriaLancamento
    limit?: number
  }): Promise<AuditoriaLancamentoRecord[]> {
    const filters: string[] = []
    if (options?.empresaId) {
      filters.push(`empresa = '${options.empresaId}'`)
    }
    if (options?.lancamentoId) {
      filters.push(`lancamento_id = '${options.lancamentoId}'`)
    }
    if (options?.acao) {
      filters.push(`acao = '${options.acao}'`)
    }

    const queryParams: Record<string, unknown> = {
      sort: '-created',
      expand: 'usuario,empresa',
    }

    if (filters.length > 0) {
      queryParams.filter = filters.join(' && ')
    }

    if (options?.limit) {
      const res = await pb
        .collection('auditoria_lancamentos')
        .getList<AuditoriaLancamentoRecord>(1, options.limit, queryParams)
      return res.items
    }

    return await pb
      .collection('auditoria_lancamentos')
      .getFullList<AuditoriaLancamentoRecord>(queryParams)
  },
}
