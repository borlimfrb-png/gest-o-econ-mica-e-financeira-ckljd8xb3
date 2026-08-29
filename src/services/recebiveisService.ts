import pb from '@/lib/pocketbase/client'
import type { RecebivelRecord, StatusRecebivel } from '@/types/finance'

function currentUserId(): string {
  const id = pb.authStore.record?.id
  if (!id) throw new Error('Usuário não autenticado')
  return id
}

export interface GerarParcelasInput {
  empresa: string
  data_inicio_servicos: string // YYYY-MM-DD
  dia_vencimento: number // 1 a 28
  valor: number
  meses: number
  lembrete_agendado?: boolean
  nfse_automatica_agendada?: boolean
}

export interface ParcelaPreview {
  parcela: number
  vencimento: string // YYYY-MM-DD
  valor: number
  status?: 'Pendente' | 'Pago'
  lembrete_agendado?: boolean
  nfse_automatica_agendada?: boolean
}
export const recebiveisService = {
  /**
   * Calcula as datas de vencimento e gera a lista em memória (preview) antes de salvar.
   */
  calcularPreviewParcelas(input: GerarParcelasInput): ParcelaPreview[] {
    const { data_inicio_servicos, dia_vencimento, valor, meses } = input
    const parcelas: ParcelaPreview[] = []

    // Converte a data de início (esperado YYYY-MM-DD)
    const [startYear, startMonth] = data_inicio_servicos.split('-').map(Number)
    const baseYear = startYear || new Date().getFullYear()
    const baseMonth = startMonth ? startMonth - 1 : new Date().getMonth() // 0-based

    for (let i = 0; i < meses; i++) {
      // Calcula o mês da parcela somando i meses ao mês base
      const targetDate = new Date(baseYear, baseMonth + i, 1)
      const year = targetDate.getFullYear()
      const month = targetDate.getMonth() // 0-indexed

      // Garante dia válido respeitando o mês e dia_vencimento (1 a 28 já é seguro para todos os meses)
      const day = Math.min(Math.max(dia_vencimento, 1), 28)
      const formattedMonth = String(month + 1).padStart(2, '0')
      const formattedDay = String(day).padStart(2, '0')
      const vencimento = `${year}-${formattedMonth}-${formattedDay}`

      parcelas.push({
        parcela: i + 1,
        vencimento,
        valor: Number(valor) || 0,
        status: 'Pendente',
      })
    }

    return parcelas
  },

  /**
   * Grava um lote de parcelas no banco de dados para a empresa especificada.
   */
  async gerarParcelas(
    input: GerarParcelasInput,
    parcelasPersonalizadas?: ParcelaPreview[],
  ): Promise<RecebivelRecord[]> {
    const userId = currentUserId()
    const parcelasToCreate = parcelasPersonalizadas || this.calcularPreviewParcelas(input)

    const dateInicioFormatted = input.data_inicio_servicos.includes(' ')
      ? input.data_inicio_servicos
      : `${input.data_inicio_servicos} 12:00:00`

    const createdRecords: RecebivelRecord[] = []

    for (const p of parcelasToCreate) {
      const vencimentoFormatted = p.vencimento.includes(' ')
        ? p.vencimento
        : `${p.vencimento} 12:00:00`

      const record = await pb.collection('recebiveis').create<RecebivelRecord>(
        {
          user: userId,
          empresa: input.empresa,
          parcela: p.parcela,
          vencimento: vencimentoFormatted,
          valor: Number(p.valor) || 0,
          status: p.status || 'Pendente',
          data_inicio_servicos: dateInicioFormatted,
          lembrete_agendado: p.lembrete_agendado ?? input.lembrete_agendado ?? false,
          lembrete_enviado: false,
          nfse_automatica_agendada:
            p.nfse_automatica_agendada ?? input.nfse_automatica_agendada ?? false,
        },
        {
          expand: 'empresa,nota_fiscal',
        },
      )
      createdRecords.push(record)
    }

    return createdRecords
  },

  /**
   * Lista recebíveis filtrados por empresa.
   */
  async listarPorEmpresa(empresaId: string): Promise<RecebivelRecord[]> {
    return await pb.collection('recebiveis').getFullList<RecebivelRecord>({
      filter: `empresa = '${empresaId}'`,
      sort: 'vencimento,parcela',
      expand: 'empresa,nota_fiscal',
    })
  },

  /**
   * Lista recebíveis filtrados por período e opcionalmente por empresa e status.
   */
  async listarPorPeriodo(options?: {
    empresaId?: string
    dataInicio?: string
    dataFim?: string
    status?: StatusRecebivel
  }): Promise<RecebivelRecord[]> {
    const filters: string[] = []

    if (options?.empresaId && options.empresaId !== 'todas') {
      filters.push(`empresa = '${options.empresaId}'`)
    }

    if (options?.dataInicio) {
      const inicio = options.dataInicio.slice(0, 10)
      filters.push(`vencimento >= '${inicio} 00:00:00'`)
    }

    if (options?.dataFim) {
      const fim = options.dataFim.slice(0, 10)
      filters.push(`vencimento <= '${fim} 23:59:59'`)
    }

    if (options?.status) {
      filters.push(`status = '${options.status}'`)
    }

    const queryParams: Record<string, unknown> = {
      sort: 'vencimento,parcela',
      expand: 'empresa,nota_fiscal',
    }

    if (filters.length > 0) {
      queryParams.filter = filters.join(' && ')
    }

    return await pb.collection('recebiveis').getFullList<RecebivelRecord>(queryParams)
  },

  /**
   * Dá baixa no recebível, atualizando status para 'Pago', salvando a data de pagamento
   * e realizando CONCILIAÇÃO AUTOMÁTICA com nota fiscal emitida vinculada (nota ↔ parcela).
   */
  async darBaixa(id: string, dataPagamento?: string): Promise<RecebivelRecord> {
    const dataFormatted = dataPagamento
      ? dataPagamento.includes(' ')
        ? dataPagamento
        : `${dataPagamento} 12:00:00`
      : `${new Date().toISOString().slice(0, 10)} 12:00:00`

    // 1. Busca recebível atual
    const recebivelAtual = await pb.collection('recebiveis').getOne<RecebivelRecord>(id, {
      expand: 'empresa,nota_fiscal',
    })

    let notaVinculadaId = recebivelAtual.nota_fiscal || null

    // 2. Se ainda não tem nota_fiscal explícita vinculada no recebível, procura por notas emitidas do mesmo cliente
    if (!notaVinculadaId) {
      try {
        const userId = currentUserId()
        const notasCandidatas = await pb.collection('notas_fiscais').getFullList<any>({
          filter: `user = '${userId}' && empresa = '${recebivelAtual.empresa}' && status != 'Cancelada'`,
          sort: '-created',
        })

        // Tenta encontrar por recebivel == id ou por valor exato / parcela
        const match = notasCandidatas.find(
          (n) =>
            n.recebivel === id ||
            (n.parcela_referencia &&
              Number(n.parcela_referencia) === Number(recebivelAtual.parcela)) ||
            Math.abs(Number(n.valor_servicos) - Number(recebivelAtual.valor)) < 0.05,
        )

        if (match) {
          notaVinculadaId = match.id
        }
      } catch (errFind) {
        console.warn('Erro ao buscar notas candidatas para conciliação:', errFind)
      }
    }

    const updateData: Record<string, any> = {
      status: 'Pago',
      data_pagamento: dataFormatted,
    }

    if (notaVinculadaId) {
      updateData.nota_fiscal = notaVinculadaId
      updateData.conciliado = true
      updateData.conciliado_em = dataFormatted

      // Atualiza também a nota fiscal como conciliada
      try {
        await pb.collection('notas_fiscais').update(notaVinculadaId, {
          recebivel: id,
          conciliada: true,
          conciliada_em: dataFormatted,
        })
      } catch (errNota) {
        console.warn('Erro ao atualizar status conciliado na nota fiscal:', errNota)
      }
    }

    return await pb.collection('recebiveis').update<RecebivelRecord>(id, updateData, {
      expand: 'empresa,nota_fiscal',
    })
  },

  /**
   * Desfaz a baixa do recebível, voltando para 'Pendente', limpando data_pagamento e estornando a conciliação.
   */
  async desfazerBaixa(id: string): Promise<RecebivelRecord> {
    const recebivelAtual = await pb.collection('recebiveis').getOne<RecebivelRecord>(id)

    if (recebivelAtual.nota_fiscal) {
      try {
        await pb.collection('notas_fiscais').update(recebivelAtual.nota_fiscal, {
          conciliada: false,
          conciliada_em: null,
        })
      } catch {
        /* intentionally ignored */
      }
    }

    return await pb.collection('recebiveis').update<RecebivelRecord>(
      id,
      {
        status: 'Pendente',
        data_pagamento: null,
        conciliado: false,
        conciliado_em: null,
      },
      {
        expand: 'empresa,nota_fiscal',
      },
    )
  },

  /**
   * Alterna o agendamento de emissão automática de NFSe para esta parcela.
   */
  async toggleAgendamentoNfse(id: string, agendado: boolean): Promise<RecebivelRecord> {
    return await pb.collection('recebiveis').update<RecebivelRecord>(
      id,
      {
        nfse_automatica_agendada: agendado,
      },
      {
        expand: 'empresa,nota_fiscal',
      },
    )
  },

  /**
   * Vincula ou desvincula manualmente uma nota fiscal a uma parcela de recebível.
   */
  async vincularNotaFiscal(id: string, notaId: string | null): Promise<RecebivelRecord> {
    const recebivel = await pb.collection('recebiveis').getOne<RecebivelRecord>(id)
    const isPago = recebivel.status === 'Pago'
    const hojeFormatted = `${new Date().toISOString().slice(0, 10)} 12:00:00`

    const updateData: Record<string, any> = {
      nota_fiscal: notaId,
      conciliado: Boolean(notaId && isPago),
      conciliado_em: notaId && isPago ? hojeFormatted : null,
    }

    if (notaId) {
      try {
        await pb.collection('notas_fiscais').update(notaId, {
          recebivel: id,
          conciliada: Boolean(isPago),
          conciliada_em: isPago ? hojeFormatted : null,
        })
      } catch {
        /* intentionally ignored */
      }
    }

    return await pb.collection('recebiveis').update<RecebivelRecord>(id, updateData, {
      expand: 'empresa,nota_fiscal',
    })
  },

  /**
   * Renegocia o valor e/ou vencimento de uma parcela de recebível.
   */
  async renegociarParcela(
    id: string,
    novoValor: number,
    novoVencimento?: string,
  ): Promise<RecebivelRecord> {
    const dados: Record<string, any> = {
      valor: Number(novoValor) || 0,
    }
    if (novoVencimento) {
      dados.vencimento = novoVencimento.includes(' ')
        ? novoVencimento
        : `${novoVencimento} 12:00:00`
    }

    return await pb.collection('recebiveis').update<RecebivelRecord>(id, dados, {
      expand: 'empresa',
    })
  },

  /**
   * Exclui uma parcela individual de recebível.
   */
  async excluirParcela(id: string): Promise<boolean> {
    return await pb.collection('recebiveis').delete(id)
  },

  /**
   * Exclui todas as parcelas de uma empresa (útil para recriar/limpar).
   */
  async excluirPorEmpresa(empresaId: string): Promise<number> {
    const list = await this.listarPorEmpresa(empresaId)
    for (const item of list) {
      await pb.collection('recebiveis').delete(item.id)
    }
    return list.length
  },
}
