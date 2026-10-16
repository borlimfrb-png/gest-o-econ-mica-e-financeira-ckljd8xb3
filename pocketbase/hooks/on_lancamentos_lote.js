/**
 * Hook para Gravação de Lançamentos em Lote Único Atômico
 * Endpoint: POST /backend/v1/lancamentos/lote
 *
 * Recebe:
 * {
 *   empresaId: string,
 *   lancamentos: Array<{
 *     plano_conta: string,
 *     data: string,
 *     valor: number,
 *     historico?: string,
 *     nota_fiscal_ref?: string
 *   }>,
 *   origem?: string,               // ex: 'importacao_ia_pdf', 'importacao_excel_ia', 'importacao_despesas_ia'
 *   arquivoNome?: string,
 *   periodoInicio?: string,
 *   periodoFim?: string,
 *   contaPrincipal?: string
 * }
 *
 * Comportamento:
 * 1. Autenticação obrigatória (bloqueia cliente, perfil somente leitura de importação).
 * 2. Validações prévias do lote (empresa válida, usuário ativo/autorizado, itens válidos).
 * 3. Gravação 100% ATÔMICA via $app.runInTransaction:
 *    - Se qualquer lançamento falhar, NENHUM registro é persistido (rollback total).
 *    - Registra auditoria consolidada de auditoria_lancamentos dentro da mesma transação.
 * 4. Retorna confirmação com contadores consolidados.
 */

routerAdd(
  'POST',
  '/backend/v1/lancamentos/lote',
  (e) => {
    try {
      const authRecord = e.auth
      const userId = authRecord?.id
      if (!userId) {
        return e.unauthorizedError('Usuário não autenticado.')
      }

      // Validação de perfil: 'cliente' não pode importar lançamentos
      const role = authRecord.get ? authRecord.get('role') : authRecord.role
      if (role === 'cliente') {
        return e.forbiddenError(
          'Acesso restrito: usuários com perfil cliente não possuem permissão para importar lançamentos.',
        )
      }

      const body = e.requestInfo().body || {}
      const empresaId = body.empresaId || body.empresa
      const itens = body.lancamentos || body.itens || []
      const origem = body.origem || 'importacao_lote'
      const arquivoNome = body.arquivoNome || ''
      const periodoInicio = body.periodoInicio || ''
      const periodoFim = body.periodoFim || periodoInicio
      const contaPrincipal = body.contaPrincipal || ''

      if (!empresaId) {
        return e.badRequestError('Empresa de destino é obrigatória.')
      }

      if (!Array.isArray(itens) || itens.length === 0) {
        return e.badRequestError('O lote não contém lançamentos para importar.')
      }

      // Validação de isolamento por empresa se não for admin
      const authEmpresa = authRecord.get ? authRecord.get('empresa') : authRecord.empresa
      if (role !== 'admin' && authEmpresa && authEmpresa !== empresaId) {
        return e.forbiddenError(
          'Permissão negada: você não possui permissão para gravar lançamentos nesta empresa.',
        )
      }

      // Valida se a empresa existe
      let empresaRecord
      try {
        empresaRecord = $app.findRecordById('empresas', empresaId)
      } catch (empErr) {
        return e.badRequestError('Empresa informada não foi encontrada no sistema.')
      }

      const empresaNome =
        empresaRecord.getString('nome_fantasia') ||
        empresaRecord.getString('razao_social') ||
        empresaRecord.getString('nome') ||
        'Empresa'

      // Pré-validação rigorosa de todos os itens antes de abrir a transação
      let valorTotalCalculado = 0
      const itensValidados = []

      for (let i = 0; i < itens.length; i++) {
        const item = itens[i]
        const linhaNum = i + 1

        if (!item || typeof item !== 'object') {
          return e.badRequestError(`Item #${linhaNum} inválido no lote.`)
        }

        const planoContaId = String(item.plano_conta || item.planoContaId || '').trim()
        if (!planoContaId) {
          return e.badRequestError(
            `Item #${linhaNum} sem Plano de Contas vinculado. Vincule todas as contas antes de importar.`,
          )
        }

        const rawData = String(item.data || '').trim()
        if (!rawData) {
          return e.badRequestError(`Item #${linhaNum} possui data vazia ou não informada.`)
        }

        // Formatação da data (aceita YYYY-MM-DD ou com hora)
        let dataFormatada = rawData
        if (dataFormatada.length === 7) {
          dataFormatada = `${dataFormatada}-01 12:00:00`
        } else if (dataFormatada.length === 10) {
          dataFormatada = `${dataFormatada} 12:00:00`
        }

        const numValor = Number(item.valor)
        if (isNaN(numValor) || numValor <= 0) {
          return e.badRequestError(
            `Item #${linhaNum} ("${item.historico || 'sem histórico'}") possui valor inválido (${item.valor}). O valor deve ser maior que zero.`,
          )
        }

        const historicoTexto = item.historico ? String(item.historico).trim() : ''

        valorTotalCalculado += numValor
        itensValidados.push({
          planoContaId,
          data: dataFormatada,
          valor: numValor,
          historico: historicoTexto,
          notaFiscalRef: item.nota_fiscal_ref || null,
        })
      }

      // Localiza as collections necessárias
      const colLancamentos = $app.findCollectionByNameOrId('lancamentos')
      const colAuditoria = $app.findCollectionByNameOrId('auditoria_lancamentos')

      // Usuário autenticado para auditoria
      const usuarioNome =
        (authRecord.get ? authRecord.get('name') : authRecord.name) || 'Usuário do Sistema'
      const usuarioEmail = (authRecord.get ? authRecord.get('email') : authRecord.email) || ''

      let idsCriados = []

      // EXECUÇÃO 100% ATÔMICA DENTRO DE UMA TRANSAÇÃO ÚNICA DO BANCO
      $app.runInTransaction((txApp) => {
        idsCriados = []

        // 1. Grava cada lançamento individual na collection lancamentos
        for (let i = 0; i < itensValidados.length; i++) {
          const it = itensValidados[i]
          const rec = new Record(colLancamentos)
          rec.set('empresa', empresaId)
          rec.set('plano_conta', it.planoContaId)
          rec.set('data', it.data)
          rec.set('valor', it.valor)
          if (it.historico) {
            rec.set('historico', it.historico)
          }
          rec.set('user', userId)
          if (it.notaFiscalRef) {
            rec.set('nota_fiscal_ref', it.notaFiscalRef)
          }

          // Persiste usando a instância transacional txApp
          txApp.save(rec)
          idsCriados.push(rec.id)
        }

        // 2. Grava a auditoria consolidada do lote (um único registro consolidado)
        if (colAuditoria) {
          const auditRec = new Record(colAuditoria)
          auditRec.set('empresa', empresaId)
          // Referência ao primeiro id criado ou identificador de lote
          auditRec.set('lancamento_id', idsCriados[0] || 'lote')
          auditRec.set('acao', 'criacao')
          auditRec.set('usuario', userId)
          auditRec.set('usuario_nome', usuarioNome)
          auditRec.set('usuario_email', usuarioEmail)
          auditRec.set('valor', valorTotalCalculado)
          auditRec.set(
            'historico',
            `[Lote Atômico] Importação de ${itensValidados.length} lançamentos (${origem})`,
          )
          auditRec.set(
            'conta_info',
            contaPrincipal ? `Conta-Mãe: ${contaPrincipal}` : 'Múltiplas Contas',
          )
          auditRec.set('detalhes', {
            modo: 'lote_atomico',
            origem: origem,
            arquivo: arquivoNome,
            total_itens: itensValidados.length,
            valor_total: valorTotalCalculado,
            periodo_inicio: periodoInicio,
            periodo_fim: periodoFim,
            conta_principal: contaPrincipal,
            ids_lancamentos: idsCriados.slice(0, 100),
          })

          txApp.save(auditRec)
        }
      })

      return e.json(200, {
        sucesso: true,
        message: `${itensValidados.length} lançamentos importados com sucesso em lote atômico único.`,
        empresaId,
        empresaNome,
        totalItens: itensValidados.length,
        valorTotal: valorTotalCalculado,
        idsCriados,
      })
    } catch (err) {
      console.log('[Lote Atômico] Falha na gravação em lote:', err)
      return e.json(500, {
        sucesso: false,
        error:
          err?.message ||
          'Erro interno ao processar lote atômico de lançamentos. Nenhum registro foi gravado.',
      })
    }
  },
  $apis.requireAuth(),
)

/**
 * Endpoint: POST /backend/v1/lancamentos/limpar-periodo
 *
 * Limpa ou pré-visualiza lançamentos de uma empresa em determinado intervalo de datas.
 * - Modo "contar": retorna { total, valor_total, excluidos } sem apagar nada.
 * - Modo "executar": exclusão atômica em transação ($app.runInTransaction) e
 *   gravação de registro consolidado em auditoria_lancamentos.
 */
routerAdd(
  'POST',
  '/backend/v1/lancamentos/limpar-periodo',
  (e) => {
    try {
      const authRecord = e.auth
      const userId = authRecord?.id
      if (!userId) {
        return e.unauthorizedError('Usuário não autenticado.')
      }

      // Validação de perfil: 'cliente' bloqueado
      const role = authRecord.get ? authRecord.get('role') : authRecord.role
      if (role === 'cliente') {
        return e.forbiddenError(
          'Acesso restrito: usuários com perfil cliente não possuem permissão para excluir lançamentos.',
        )
      }

      const body = e.requestInfo().body || {}
      const empresaId = String(body.empresa || body.empresaId || '').trim()
      let dataInicio = String(body.data_inicio || body.dataInicio || '').trim()
      let dataFim = String(body.data_fim || body.dataFim || '').trim()
      const modo = String(body.modo || 'executar')
        .trim()
        .toLowerCase()

      if (!empresaId) {
        return e.badRequestError('O ID da empresa é obrigatório.')
      }

      if (!dataInicio || !dataFim) {
        return e.badRequestError(
          'O período informado é inválido. data_inicio e data_fim são obrigatórias.',
        )
      }

      // Normaliza para formato YYYY-MM-DD se vier datetime
      if (dataInicio.length > 10) {
        dataInicio = dataInicio.slice(0, 10)
      }
      if (dataFim.length > 10) {
        dataFim = dataFim.slice(0, 10)
      }

      if (dataInicio > dataFim) {
        return e.badRequestError('A data inicial não pode ser superior à data final.')
      }

      // Validação de isolamento por empresa se não for admin
      const authEmpresa = authRecord.get ? authRecord.get('empresa') : authRecord.empresa
      if (role !== 'admin' && authEmpresa && authEmpresa !== empresaId) {
        return e.forbiddenError(
          'Permissão negada: você não possui permissão para gerenciar lançamentos desta empresa.',
        )
      }

      // Valida existência da empresa
      let empresaRecord
      try {
        empresaRecord = $app.findRecordById('empresas', empresaId)
      } catch (empErr) {
        return e.badRequestError('Empresa informada não foi encontrada no sistema.')
      }

      const empresaNome =
        empresaRecord.getString('nome_fantasia') ||
        empresaRecord.getString('razao_social') ||
        empresaRecord.getString('nome') ||
        'Empresa'

      // Filtro para buscar apenas lançamentos da empresa dentro do intervalo de data
      const startBound = `${dataInicio} 00:00:00.000Z`
      const endBound = `${dataFim} 23:59:59.999Z`

      const filterExpr = 'empresa = {:empresaId} && data >= {:startBound} && data <= {:endBound}'
      const params = {
        empresaId: empresaId,
        startBound: startBound,
        endBound: endBound,
      }

      const lancamentosParaExcluir = $app.findRecordsByFilter(
        'lancamentos',
        filterExpr,
        'data',
        0,
        0,
        params,
      )

      let totalRegistros = 0
      let valorTotalSomado = 0

      if (lancamentosParaExcluir && lancamentosParaExcluir.length > 0) {
        totalRegistros = lancamentosParaExcluir.length
        for (let i = 0; i < lancamentosParaExcluir.length; i++) {
          const rec = lancamentosParaExcluir[i]
          const val = rec.getFloat ? rec.getFloat('valor') : Number(rec.get('valor') || 0)
          valorTotalSomado += val
        }
      }

      valorTotalSomado = Math.round(valorTotalSomado * 100) / 100

      // Modo "contar": retorna a contagem prévia sem apagar nada
      if (modo === 'contar') {
        return e.json(200, {
          sucesso: true,
          modo: 'contar',
          empresaId,
          empresaNome,
          data_inicio: dataInicio,
          data_fim: dataFim,
          total: totalRegistros,
          excluidos: totalRegistros,
          valor_total: valorTotalSomado,
        })
      }

      // Caso não existam lançamentos no período
      if (totalRegistros === 0) {
        return e.json(200, {
          sucesso: true,
          empresaId,
          empresaNome,
          data_inicio: dataInicio,
          data_fim: dataFim,
          excluidos: 0,
          valor_total: 0,
          message: 'Nenhum lançamento encontrado no período informado.',
        })
      }

      const usuarioNome =
        (authRecord.get ? authRecord.get('name') : authRecord.name) || 'Usuário do Sistema'
      const usuarioEmail = (authRecord.get ? authRecord.get('email') : authRecord.email) || ''

      const colAuditoria = $app.findCollectionByNameOrId('auditoria_lancamentos')

      // Execução em transação atômica
      $app.runInTransaction((txApp) => {
        // 1. Exclui cada lançamento individualmente
        for (let i = 0; i < lancamentosParaExcluir.length; i++) {
          const lRec = lancamentosParaExcluir[i]
          txApp.delete(lRec)
        }

        // 2. Grava registro consolidado de auditoria
        if (colAuditoria) {
          const auditRec = new Record(colAuditoria)
          auditRec.set('empresa', empresaId)
          auditRec.set('lancamento_id', `limpeza_${dataInicio}_${dataFim}`)
          auditRec.set('acao', 'exclusao')
          auditRec.set('usuario', userId)
          auditRec.set('usuario_nome', usuarioNome)
          auditRec.set('usuario_email', usuarioEmail)
          auditRec.set('valor', valorTotalSomado)
          auditRec.set(
            'historico',
            `[Limpeza de Período] Exclusão de ${totalRegistros} lançamentos (${dataInicio} a ${dataFim})`,
          )
          auditRec.set('conta_info', `Limpeza DRE Gerencial (${dataInicio} a ${dataFim})`)
          auditRec.set('detalhes', {
            origem: 'limpeza_periodo_dre',
            empresa_id: empresaId,
            empresaNome: empresaNome,
            periodo_inicio: dataInicio,
            periodo_fim: dataFim,
            quantidade_apagada: totalRegistros,
            valor_total: valorTotalSomado,
            data_execucao: new Date().toISOString(),
          })

          txApp.save(auditRec)
        }
      })

      return e.json(200, {
        sucesso: true,
        empresaId,
        empresaNome,
        data_inicio: dataInicio,
        data_fim: dataFim,
        excluidos: totalRegistros,
        valor_total: valorTotalSomado,
        message: `${totalRegistros} lançamentos excluídos permanentemente no período de ${dataInicio} a ${dataFim}.`,
      })
    } catch (err) {
      console.log('[Limpar Período] Erro ao excluir lançamentos:', err)
      return e.json(500, {
        sucesso: false,
        error:
          err?.message ||
          'Erro interno ao processar exclusão de lançamentos por período. Nenhuma alteração foi realizada.',
      })
    }
  },
  $apis.requireAuth(),
)
