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
  contratoId?: string
  contratoDescricao?: string
}

export interface ParcelaPreview {
  parcela: number
  vencimento: string // YYYY-MM-DD
  valor: number
  status?: 'Pendente' | 'Pago'
  lembrete_agendado?: boolean
  nfse_automatica_agendada?: boolean
  contrato?: string
  descricao?: string
  forma_pagamento?: string
  periodo_ordem?: number
}

export interface ResumoTitulosContrato {
  contratoId: string
  total: number
  pagos: number
  pendentes: number
  totalValor: number
  valorPago: number
  valorPendente: number
}

export interface SincronizarTitulosContratoResult {
  criados: number
  atualizados: number
  removidos: number
  mantidosPagos: number
  totalAtual: number
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
          contrato: p.contrato || input.contratoId || null,
          descricao:
            p.descricao ||
            (input.contratoDescricao
              ? `${input.contratoDescricao} — Parcela ${p.parcela}/${parcelasToCreate.length}`
              : `Parcela ${p.parcela}`),
          forma_pagamento: p.forma_pagamento || '',
          periodo_ordem: p.periodo_ordem || null,
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
          expand: 'empresa,nota_fiscal,contrato',
        },
      )
      createdRecords.push(record)
    }

    return createdRecords
  },

  /**
   * Lista recebíveis vinculados a um contrato específico.
   */
  async listarPorContrato(contratoId: string): Promise<RecebivelRecord[]> {
    return await pb.collection('recebiveis').getFullList<RecebivelRecord>({
      filter: `contrato = '${contratoId}'`,
      sort: 'parcela,vencimento',
      expand: 'empresa,nota_fiscal,contrato',
    })
  },

  /**
   * Obtém resumo (estatística) dos títulos de um contrato (total, pagos, pendentes).
   */
  async obterResumoTitulosContrato(contratoId: string): Promise<ResumoTitulosContrato> {
    const titulos = await this.listarPorContrato(contratoId)
    let pagos = 0
    let pendentes = 0
    let totalValor = 0
    let valorPago = 0
    let valorPendente = 0

    for (const t of titulos) {
      const v = Number(t.valor) || 0
      totalValor += v
      if (t.status === 'Pago') {
        pagos += 1
        valorPago += v
      } else {
        pendentes += 1
        valorPendente += v
      }
    }

    return {
      contratoId,
      total: titulos.length,
      pagos,
      pendentes,
      totalValor,
      valorPago,
      valorPendente,
    }
  },

  /**
   * Sincroniza e reconcilia os títulos a receber de um contrato a partir do cronograma de parcelas:
   * 1. Idempotência por contrato + parcela (número da parcela como chave única por contrato).
   * 2. Preserva integralmente parcelas já BAIXADAS / PAGAS (nunca altera nem apaga, integridade financeira).
   * 3. Atualiza parcelas pendentes existentes se valor, vencimento ou forma mudaram.
   * 4. Remove parcelas pendentes excedentes que não existem mais no novo cronograma.
   * 5. Cria novas parcelas que foram adicionadas no cronograma como pendentes.
   */
  async sincronizarTitulosContrato(
    contrato: {
      id: string
      contratante: string
      data_inicio: string
      dia_vencimento?: number
      quantidade_meses?: number
      descricaoContrato?: string
    },
    parcelasCronograma: Array<{
      parcela: number
      vencimento: string
      valor: number
      forma_pagamento?: string
      periodo_ordem?: number
      lembrete_agendado?: boolean
      nfse_automatica_agendada?: boolean
      descricao?: string
    }>,
  ): Promise<SincronizarTitulosContratoResult> {
    const userId = currentUserId()
    const contratoId = contrato.id
    const empresaId = contrato.contratante

    // 1. Busca os recebíveis existentes vinculados a este contrato
    const existentes = await this.listarPorContrato(contratoId)

    // Mapa por número de parcela
    const existentesPorParcela = new Map<number, RecebivelRecord>()
    for (const rec of existentes) {
      existentesPorParcela.set(Number(rec.parcela), rec)
    }

    const dataInicioFormatted = contrato.data_inicio.includes(' ')
      ? contrato.data_inicio
      : `${contrato.data_inicio.slice(0, 10)} 12:00:00`

    const descricaoBase = contrato.descricaoContrato || `Contrato ${contratoId.slice(0, 8)}`

    let criados = 0
    let atualizados = 0
    let mantidosPagos = 0
    let removidos = 0

    const parcelasNoCronograma = new Set<number>()

    // 2. Itera pelo novo cronograma e reconcilia
    for (const p of parcelasCronograma) {
      const numParcela = Number(p.parcela)
      parcelasNoCronograma.add(numParcela)

      const vencimentoFormatted = p.vencimento.includes(' ')
        ? p.vencimento
        : `${p.vencimento.slice(0, 10)} 12:00:00`

      const descricaoFinal =
        p.descricao || `${descricaoBase} — Parcela ${numParcela}/${parcelasCronograma.length}`

      const existente = existentesPorParcela.get(numParcela)

      if (existente) {
        // Se já existe e foi PAGO: NÃO toca no valor nem status nem data de pagamento
        if (existente.status === 'Pago') {
          mantidosPagos += 1
          // Atualiza apenas metadados cosméticos seguros se necessário (ex: descricao/forma de pagamento)
          try {
            await pb.collection('recebiveis').update(existente.id, {
              contrato: contratoId,
              descricao: descricaoFinal,
              forma_pagamento: p.forma_pagamento || existente.forma_pagamento || '',
              periodo_ordem: p.periodo_ordem || existente.periodo_ordem || null,
            })
          } catch {
            /* intentionally ignored */
          }
          continue
        }

        // Se está Pendente: atualiza valor, vencimento, forma e descrição
        const valorNum = Number(p.valor) || 0
        const mudouValor = Math.abs((Number(existente.valor) || 0) - valorNum) >= 0.01
        const mudouVencimento =
          (existente.vencimento || '').slice(0, 10) !== p.vencimento.slice(0, 10)
        const mudouForma = (existente.forma_pagamento || '') !== (p.forma_pagamento || '')
        const mudouDescricao = existente.descricao !== descricaoFinal

        if (mudouValor || mudouVencimento || mudouForma || mudouDescricao) {
          await pb.collection('recebiveis').update(existente.id, {
            valor: valorNum,
            vencimento: vencimentoFormatted,
            descricao: descricaoFinal,
            forma_pagamento: p.forma_pagamento || '',
            periodo_ordem: p.periodo_ordem || null,
            lembrete_agendado:
              p.lembrete_agendado !== undefined ? p.lembrete_agendado : existente.lembrete_agendado,
            nfse_automatica_agendada:
              p.nfse_automatica_agendada !== undefined
                ? p.nfse_automatica_agendada
                : existente.nfse_automatica_agendada,
          })
          atualizados += 1
        }
      } else {
        // Nova parcela: cria como Pendente
        await pb.collection('recebiveis').create({
          user: userId,
          empresa: empresaId,
          contrato: contratoId,
          parcela: numParcela,
          vencimento: vencimentoFormatted,
          valor: Number(p.valor) || 0,
          status: 'Pendente',
          data_inicio_servicos: dataInicioFormatted,
          descricao: descricaoFinal,
          forma_pagamento: p.forma_pagamento || '',
          periodo_ordem: p.periodo_ordem || null,
          lembrete_agendado: p.lembrete_agendado ?? true,
          lembrete_enviado: false,
          nfse_automatica_agendada: p.nfse_automatica_agendada ?? true,
        })
        criados += 1
      }
    }

    // 3. Remove parcelas antigas que NÃO existem mais no novo cronograma
    // REGRA DE OURO: Parcelas já PAGAS NUNCA são excluídas!
    for (const [numParcela, rec] of existentesPorParcela.entries()) {
      if (!parcelasNoCronograma.has(numParcela)) {
        if (rec.status === 'Pago') {
          // Mantém por integridade contábil
          mantidosPagos += 1
        } else {
          // Pendente que não existe mais: pode ser cancelada/removida
          try {
            await pb.collection('recebiveis').delete(rec.id)
            removidos += 1
          } catch (delErr) {
            console.warn(`Erro ao remover parcela excedente ${numParcela}:`, delErr)
          }
        }
      }
    }

    const totalAtual = existentes.length - removidos + criados

    return {
      criados,
      atualizados,
      removidos,
      mantidosPagos,
      totalAtual,
    }
  },

  /**
   * Lista recebíveis filtrados por empresa.
   */
  async listarPorEmpresa(empresaId: string): Promise<RecebivelRecord[]> {
    return await pb.collection('recebiveis').getFullList<RecebivelRecord>({
      filter: `empresa = '${empresaId}'`,
      sort: 'vencimento,parcela',
      expand: 'empresa,nota_fiscal,contrato',
    })
  },

  /**
   * Lista recebíveis filtrados por período e opcionalmente por empresa e status.
   */
  async listarPorPeriodo(options?: {
    empresaId?: string
    contratoId?: string
    dataInicio?: string
    dataFim?: string
    status?: StatusRecebivel
  }): Promise<RecebivelRecord[]> {
    const filters: string[] = []

    if (options?.empresaId && options.empresaId !== 'todas') {
      filters.push(`empresa = '${options.empresaId}'`)
    }

    if (options?.contratoId) {
      filters.push(`contrato = '${options.contratoId}'`)
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
