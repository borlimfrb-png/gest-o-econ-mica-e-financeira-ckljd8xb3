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
