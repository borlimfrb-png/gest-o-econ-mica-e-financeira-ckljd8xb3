import pb from '@/lib/pocketbase/client'
import {
  NotaFiscalRecord,
  LancamentoRecord,
  EmpresaRecord,
  PlanoContaRecord,
} from '@/types/finance'
import { auditoriaLancamentosService } from './auditoriaLancamentosService'
import { auditoriaCadastrosService } from './auditoriaCadastrosService'

function currentUserId(): string {
  return pb.authStore.record?.id || ''
}

export const nfseLancamentosService = {
  /**
   * Verifica se a empresa tem o flag `integrar_nfse_lancamentos` ativado.
   * Se o campo for undefined ou true, o padrão é ativado (on por padrão).
   */
  async verificarIntegracaoHabilitada(empresaId: string): Promise<boolean> {
    if (!empresaId) return false
    try {
      const empresa = await pb.collection('empresas').getOne<EmpresaRecord>(empresaId)
      // On por padrão (se undefined ou null, considera true)
      return empresa.integrar_nfse_lancamentos !== false
    } catch (err) {
      console.warn('Erro ao verificar integracao da empresa:', err)
      return true
    }
  },

  /**
   * Atualiza a preferência da empresa sobre integração NFS-e com Lançamentos.
   */
  async alternarIntegracaoEmpresa(empresaId: string, habilitada: boolean): Promise<EmpresaRecord> {
    const updated = await pb.collection('empresas').update<EmpresaRecord>(empresaId, {
      integrar_nfse_lancamentos: habilitada,
    })
    return updated
  },

  /**
   * Localiza uma conta do plano de contas do tipo 'Receita' para a empresa.
   * Prioriza 'Receita de Prestação de Serviços' ou 'Receita Bruta' ou qualquer Receita operacional.
   */
  async obterContaReceitaPadrao(empresaId: string): Promise<PlanoContaRecord | null> {
    try {
      // 1. Tentar buscar plano de contas associado à empresa com expand de conta
      const planosEmpresa = await pb.collection('plano_contas').getFullList<PlanoContaRecord>({
        filter: `empresa = '${empresaId}'`,
        expand: 'conta,centro',
        sort: 'created',
      })

      // Filtra por contas cuja conta.tipo seja 'Receita'
      const receitas = planosEmpresa.filter(
        (p) =>
          p.expand?.conta?.tipo === 'Receita' || p.descricao?.toLowerCase().includes('receita'),
      )

      if (receitas.length > 0) {
        // Tenta achar com nome de serviços
        const servicos = receitas.find(
          (r) =>
            r.expand?.conta?.nome?.toLowerCase().includes('serviço') ||
            r.descricao?.toLowerCase().includes('serviço') ||
            r.expand?.conta?.grupo?.toLowerCase().includes('serviço'),
        )
        return servicos || receitas[0]
      }

      // 2. Se a empresa não tiver plano customizado, buscar do plano geral
      const planosGerais = await pb.collection('plano_contas').getFullList<PlanoContaRecord>({
        filter: `empresa = '' || empresa = null`,
        expand: 'conta,centro',
        sort: 'created',
      })

      const receitasGerais = planosGerais.filter(
        (p) =>
          p.expand?.conta?.tipo === 'Receita' || p.descricao?.toLowerCase().includes('receita'),
      )

      if (receitasGerais.length > 0) {
        const servicos = receitasGerais.find(
          (r) =>
            r.expand?.conta?.nome?.toLowerCase().includes('serviço') ||
            r.descricao?.toLowerCase().includes('serviço') ||
            r.expand?.conta?.grupo?.toLowerCase().includes('serviço'),
        )
        return servicos || receitasGerais[0]
      }

      // Se ainda assim não achar, pega o primeiro plano de contas disponível
      if (planosEmpresa.length > 0) return planosEmpresa[0]
      if (planosGerais.length > 0) return planosGerais[0]

      return null
    } catch (err) {
      console.warn('Erro ao buscar conta de receita para empresa:', err)
      return null
    }
  },

  /**
   * Gera ou atualiza o lançamento em Lançamentos Rápidos ao emitir ou reemitir uma nota fiscal.
   * - valor líquido = total serviços − retenções federais − ISS retido
   * - conta de receita do plano de contas da empresa
   * - sem duplicar na reemissão: atualiza o lançamento existente se já houver vínculo
   * - vínculo bidirecional: lancamento_ref na nota_fiscal e nota_fiscal_ref no lancamento
   */
  async sincronizarLancamentoNota(
    nota: NotaFiscalRecord,
    options?: { notaSubstituidaId?: string },
  ): Promise<LancamentoRecord | null> {
    const habilitada = await this.verificarIntegracaoHabilitada(nota.empresa)
    if (!habilitada) {
      console.log(
        `[nfseLancamentosService] Integração desabilitada para a empresa ${nota.empresa}.`,
      )
      return null
    }

    const valorLiquido = Number(nota.valor_liquido) || Number(nota.valor_servicos) || 0
    if (valorLiquido <= 0) {
      return null
    }

    const userId = currentUserId() || nota.user
    const dataEmissao = nota.data_emissao
      ? nota.data_emissao.includes(' ') || nota.data_emissao.includes('T')
        ? nota.data_emissao
        : `${nota.data_emissao} 12:00:00`
      : new Date().toISOString().replace('T', ' ').slice(0, 19)

    const tomadorNome = nota.tomador_razao_social || 'Cliente'
    const serie = nota.dps_serie || nota.serie || '1'
    const historicoPadrao = options?.notaSubstituidaId
      ? `Receita NFS-e Nacional nº ${nota.numero} (Série ${serie}) - ${tomadorNome} [Reemissão corrigida substitui NFS-e anterior]`
      : `Receita NFS-e Nacional nº ${nota.numero} (Série ${serie}) - ${tomadorNome}`

    // 1. Verificar se já existe lançamento vinculado diretamente ou via nota substituída
    let lancamentoIdExistente = nota.lancamento_ref

    if (!lancamentoIdExistente && options?.notaSubstituidaId) {
      try {
        const notaAntiga = await pb
          .collection('notas_fiscais')
          .getOne<NotaFiscalRecord>(options.notaSubstituidaId)
        if (notaAntiga.lancamento_ref) {
          lancamentoIdExistente = notaAntiga.lancamento_ref
        }
      } catch (err) {
        console.warn('Falha ao checar lançamento da nota substituída:', err)
      }
    }

    // Também verifica se existe um lançamento que já aponte para esta nota ou nota substituída
    if (!lancamentoIdExistente) {
      try {
        const busca = await pb.collection('lancamentos').getList<LancamentoRecord>(1, 1, {
          filter: options?.notaSubstituidaId
            ? `nota_fiscal_ref = '${nota.id}' || nota_fiscal_ref = '${options.notaSubstituidaId}'`
            : `nota_fiscal_ref = '${nota.id}'`,
        })
        if (busca.items.length > 0) {
          lancamentoIdExistente = busca.items[0].id
        }
      } catch {
        /* intentionally ignored */
      }
    }

    // 2. Se já existe lançamento, ATUALIZA (evita duplicidade na reemissão)
    if (lancamentoIdExistente) {
      try {
        const lancamentoAtualizado = await pb
          .collection('lancamentos')
          .update<LancamentoRecord>(lancamentoIdExistente, {
            valor: valorLiquido,
            data: dataEmissao,
            historico: historicoPadrao,
            nota_fiscal_ref: nota.id,
            estornado: false,
            motivo_estorno: null,
          })

        // Garante que a nova nota aponte para o lançamento
        if (nota.lancamento_ref !== lancamentoIdExistente) {
          await pb.collection('notas_fiscais').update(nota.id, {
            lancamento_ref: lancamentoIdExistente,
          })
          nota.lancamento_ref = lancamentoIdExistente
        }

        // Auditoria do lançamento atualizado
        try {
          await auditoriaLancamentosService.registrar({
            empresa: nota.empresa,
            lancamento_id: lancamentoAtualizado.id,
            acao: 'edicao',
            valor: valorLiquido,
            historico: historicoPadrao,
            detalhes: {
              motivo: options?.notaSubstituidaId
                ? `Atualização por reemissão de NFS-e nº ${nota.numero} (substituindo nota anterior)`
                : `Atualização de lançamento por emissão de NFS-e nº ${nota.numero}`,
              dados_novos: {
                valor: valorLiquido,
                nota_fiscal_ref: nota.id,
              },
            },
          })
        } catch (auditErr) {
          console.warn('Erro ao auditar lançamento atualizado:', auditErr)
        }

        return lancamentoAtualizado
      } catch (err) {
        console.warn('Erro ao atualizar lançamento existente da nota:', err)
      }
    }

    // 3. Caso não exista lançamento prévio, CRIA NOVO
    const contaReceita = await this.obterContaReceitaPadrao(nota.empresa)
    if (!contaReceita) {
      console.warn(
        `Nenhuma conta de receita encontrada para criar lançamento da NFS-e nº ${nota.numero}.`,
      )
      return null
    }

    try {
      const novoLancamento = await pb.collection('lancamentos').create<LancamentoRecord>({
        empresa: nota.empresa,
        plano_conta: contaReceita.id,
        data: dataEmissao,
        valor: valorLiquido,
        historico: historicoPadrao,
        user: userId,
        nota_fiscal_ref: nota.id,
        estornado: false,
      } as any)

      // Atualiza vínculo bidirecional na nota fiscal
      await pb.collection('notas_fiscais').update(nota.id, {
        lancamento_ref: novoLancamento.id,
      })
      nota.lancamento_ref = novoLancamento.id

      // Auditoria de criação
      try {
        await auditoriaLancamentosService.registrar({
          empresa: nota.empresa,
          lancamento_id: novoLancamento.id,
          acao: 'criacao',
          valor: valorLiquido,
          historico: historicoPadrao,
          conta_info: contaReceita.expand?.conta?.nome || contaReceita.descricao || 'Receita',
          detalhes: {
            motivo: `Lançamento gerado automaticamente pela emissão da NFS-e nº ${nota.numero}`,
            dados_novos: {
              valor: valorLiquido,
              nota_fiscal_ref: nota.id,
              plano_conta: contaReceita.id,
            },
          },
        })
      } catch (auditErr) {
        console.warn('Erro ao auditar criação de lançamento via NFS-e:', auditErr)
      }

      return novoLancamento
    } catch (err) {
      console.error('Erro ao criar lançamento automático para NFS-e:', err)
      return null
    }
  },

  /**
   * Estorna o lançamento vinculado quando a nota fiscal é cancelada.
   * Marca estornado=true, estornado_em=now, motivo_estorno.
   */
  async estornarLancamentoNota(
    notaId: string,
    motivoCancelamento: string,
  ): Promise<LancamentoRecord | null> {
    try {
      const nota = await pb.collection('notas_fiscais').getOne<NotaFiscalRecord>(notaId)
      let lancamentoId = nota.lancamento_ref

      if (!lancamentoId) {
        // Tenta achar pelo campo nota_fiscal_ref em lancamentos
        const busca = await pb.collection('lancamentos').getList<LancamentoRecord>(1, 1, {
          filter: `nota_fiscal_ref = '${notaId}'`,
        })
        if (busca.items.length > 0) {
          lancamentoId = busca.items[0].id
        }
      }

      if (!lancamentoId) {
        console.log(`Nota ${notaId} não possui lançamento vinculado para estorno.`)
        return null
      }

      const agoraIso = new Date().toISOString()
      const dataEstorno = agoraIso.replace('T', ' ').slice(0, 19)
      const motivoFormatado = `Cancelamento da NFS-e nº ${nota.numero}: ${motivoCancelamento}`

      const lancamentoEstornado = await pb
        .collection('lancamentos')
        .update<LancamentoRecord>(lancamentoId, {
          estornado: true,
          estornado_em: dataEstorno,
          motivo_estorno: motivoFormatado,
        })

      // Auditoria do estorno
      try {
        await auditoriaLancamentosService.registrar({
          empresa: lancamentoEstornado.empresa,
          lancamento_id: lancamentoEstornado.id,
          acao: 'edicao',
          valor: lancamentoEstornado.valor,
          historico: `${lancamentoEstornado.historico || ''} [ESTORNADO]`,
          detalhes: {
            motivo: `Lançamento estornado devido ao cancelamento da NFS-e nº ${nota.numero}`,
            dados_novos: {
              estornado: true,
              estornado_em: dataEstorno,
              motivo_estorno: motivoFormatado,
            },
          },
        })
      } catch (auditErr) {
        console.warn('Erro ao auditar estorno de lançamento:', auditErr)
      }

      return lancamentoEstornado
    } catch (err) {
      console.warn('Erro ao processar estorno de lançamento para nota:', err)
      return null
    }
  },

  /**
   * Processa uma substituição / reemissão corrigida completa:
   * 1. Marca nota original como 'Substituída'
   * 2. Cria nova nota com nota_substituida = original.id e justificativa_correcao
   * 3. Sincroniza lançamento (atualiza o lançamento existente da nota original, evitando duplicação)
   * 4. Registra evento de auditoria no módulo de auditoria_cadastros (entidade: 'nfse')
   */
  async processarReemissaoCorrigida(input: {
    notaOriginal: NotaFiscalRecord
    justificativaCorrecao: string
    novaNotaData: Partial<NotaFiscalRecord>
    userId?: string
    userName?: string
  }): Promise<{ novaNota: NotaFiscalRecord; notaOriginal: NotaFiscalRecord }> {
    const { notaOriginal, justificativaCorrecao, novaNotaData } = input
    const userId = input.userId || currentUserId() || notaOriginal.user
    const userName = input.userName || 'Sistema'

    if (!justificativaCorrecao || !justificativaCorrecao.trim()) {
      throw new Error('A justificativa / motivo da correção é obrigatória para reemissão.')
    }

    // 1. Criar a nova nota fiscal já com vínculo da nota_substituida
    const payloadCriacao: any = {
      ...novaNotaData,
      user: userId,
      status: 'Emitida',
      nota_substituida: notaOriginal.id,
      justificativa_correcao: justificativaCorrecao.trim(),
      lancamento_ref: notaOriginal.lancamento_ref || null,
    }

    const novaNota = await pb.collection('notas_fiscais').create<NotaFiscalRecord>(payloadCriacao, {
      expand: 'empresa,contrato,nota_substituida',
    })

    // 2. Marcar a nota original como 'Substituída'
    const notaOriginalAtualizada = await pb
      .collection('notas_fiscais')
      .update<NotaFiscalRecord>(notaOriginal.id, {
        status: 'Substituída',
      })

    // 3. Sincronizar o lançamento contábil (atualizar o existente sem duplicar)
    try {
      await this.sincronizarLancamentoNota(novaNota, {
        notaSubstituidaId: notaOriginal.id,
      })
    } catch (lancErr) {
      console.warn('Falha ao sincronizar lançamento durante reemissão:', lancErr)
    }

    // 4. Registrar auditoria em auditoria_cadastros (entidade: 'nfse')
    try {
      await auditoriaCadastrosService.registrar({
        empresa: novaNota.empresa || notaOriginal.empresa,
        entidade: 'nfse',
        registro_id: novaNota.id,
        registro_descricao: `NFS-e nº ${notaOriginal.numero} substituída pela NFS-e nº ${novaNota.numero} (Motivo: ${justificativaCorrecao.trim()})`,
        acao: 'edicao',
        detalhes: {
          motivo: justificativaCorrecao.trim(),
          dados_anteriores: {
            nota_id: notaOriginal.id,
            numero: notaOriginal.numero,
            status_anterior: notaOriginal.status,
            chave_acesso: notaOriginal.chave_acesso,
            valor_liquido: notaOriginal.valor_liquido,
          },
          dados_novos: {
            nota_id: novaNota.id,
            numero: novaNota.numero,
            status_novo: novaNota.status,
            chave_acesso: novaNota.chave_acesso,
            valor_liquido: novaNota.valor_liquido,
            justificativa: justificativaCorrecao.trim(),
          },
        },
      })
    } catch (auditErr) {
      console.warn('Erro ao auditar substituição de nota fiscal:', auditErr)
    }

    return {
      novaNota,
      notaOriginal: notaOriginalAtualizada,
    }
  },
}
