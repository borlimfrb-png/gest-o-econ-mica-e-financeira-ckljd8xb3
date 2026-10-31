/// <reference path="../pb_data/types.d.ts" />

routerAdd(
  'POST',
  '/backend/v1/agent-diagnostico/stream',
  (e) => {
    function validarAcesso(app, authUser, empresaId) {
      if (!authUser) return false
      const role = authUser.getString('role')
      if (role === 'admin') return true

      if (!empresaId) return false
      const empIdClean = String(empresaId).trim()

      if (empIdClean.startsWith('grupo-')) {
        const rawGrupoId = empIdClean.replace(/^grupo-/, '')
        const userGrupos = authUser.getStringSlice('grupos_empresariais') || []
        if (userGrupos.includes(rawGrupoId)) return true

        try {
          const grupoRecord = app.findRecordById('grupos_empresariais', rawGrupoId)
          const empDoGrupo = grupoRecord.getStringSlice('empresas') || []
          const userEmpresas = authUser.getStringSlice('empresas') || []
          const legadoEmp = authUser.getString('empresa')
          if (legadoEmp) userEmpresas.push(legadoEmp)

          const intersec = empDoGrupo.some((id) => userEmpresas.includes(id))
          if (intersec) return true
        } catch (_) {}
        return false
      }

      const userEmpresas = authUser.getStringSlice('empresas') || []
      const legadoEmp = authUser.getString('empresa')
      if (legadoEmp && !userEmpresas.includes(legadoEmp)) {
        userEmpresas.push(legadoEmp)
      }

      if (userEmpresas.includes(empIdClean)) return true

      const userGrupos = authUser.getStringSlice('grupos_empresariais') || []
      for (let i = 0; i < userGrupos.length; i++) {
        try {
          const gRec = app.findRecordById('grupos_empresariais', userGrupos[i])
          const empresasDoGrupo = gRec.getStringSlice('empresas') || []
          if (empresasDoGrupo.includes(empIdClean)) {
            return true
          }
        } catch (_) {}
      }

      return false
    }

    try {
      const userId = e.auth?.id
      if (!userId) return e.unauthorizedError('auth required')

      const body = e.requestInfo().body || {}
      const message = body.message
      if (!message || !message.trim()) {
        return e.badRequestError('message is required')
      }

      const empresaId = body.empresa_id || ''
      if (!empresaId) {
        return e.badRequestError('empresa_id is required')
      }

      const temAcesso = validarAcesso(e.app, e.auth, empresaId)
      if (!temAcesso) {
        return e.forbiddenError('Você não tem permissão para consultar dados desta empresa.')
      }

      const empresaNome = body.empresa_nome || ''
      const ano = body.ano || null
      let appConvId = body.app_conversation_id || null

      let conversaRecord = null
      if (appConvId) {
        try {
          conversaRecord = e.app.findRecordById('agente_conversas', appConvId)
          if (conversaRecord.getString('user') !== userId && e.auth.getString('role') !== 'admin') {
            return e.forbiddenError('Conversa pertence a outro usuário.')
          }
          if (conversaRecord.getString('empresa_id') !== empresaId) {
            return e.badRequestError('Esta conversa não pertence à empresa ativa selecionada.')
          }
        } catch (_) {
          conversaRecord = null
        }
      }

      if (!conversaRecord) {
        const convCol = e.app.findCollectionByNameOrId('agente_conversas')
        conversaRecord = new Record(convCol)
        conversaRecord.set('user', userId)
        conversaRecord.set('empresa_id', empresaId)
        conversaRecord.set('empresa_nome', empresaNome)
        conversaRecord.set(
          'titulo',
          body.title || message.trim().slice(0, 60) + (message.trim().length > 60 ? '...' : ''),
        )
        conversaRecord.set('agent_slug', 'diagnostico-financeiro')
        if (ano) conversaRecord.set('ultimo_ano', ano)
        conversaRecord.set('ultima_mensagem_em', new Date().toISOString())
        e.app.save(conversaRecord)
      } else {
        conversaRecord.set('ultima_mensagem_em', new Date().toISOString())
        if (ano) conversaRecord.set('ultimo_ano', ano)
        e.app.save(conversaRecord)
      }

      const msgCol = e.app.findCollectionByNameOrId('agente_mensagens')
      const userMsgRecord = new Record(msgCol)
      userMsgRecord.set('conversa', conversaRecord.id)
      userMsgRecord.set('user', userId)
      userMsgRecord.set('empresa_id', empresaId)
      userMsgRecord.set('role', 'user')
      userMsgRecord.set('content', message)
      e.app.save(userMsgRecord)

      const existingSkipConvId = conversaRecord.getString('skip_conversation_id') || null
      const skipConv = $ai.agent('diagnostico-financeiro').getOrCreateConversation({
        user_id: userId,
        id: existingSkipConvId,
        title: conversaRecord.getString('titulo') || 'Diagnóstico Financeiro',
      })

      if (!existingSkipConvId && skipConv.id) {
        conversaRecord.set('skip_conversation_id', skipConv.id)
        e.app.save(conversaRecord)
      }

      const iter = $ai.agent('diagnostico-financeiro').chat({
        user_id: userId,
        conversation_id: skipConv.id,
        message: message,
        stream: true,
      })

      e.response.header().set('Content-Type', 'text/event-stream')
      e.response.header().set('Cache-Control', 'no-cache')
      e.response.header().set('X-Conversation-Id', conversaRecord.id)
      e.response.header().set('X-Skip-Conversation-Id', skipConv.id)

      $response.stream(e, iter)
    } catch (err) {
      if (err instanceof SkipAiConfigError) {
        return e.json(503, { error: 'AI temporariamente indisponível.' })
      }
      if (err instanceof SkipAiAgentsError) {
        const status = err.status || 500
        return e.json(status, {
          error: status >= 500 ? 'Falha na execução do agente.' : err.message,
        })
      }
      if (err instanceof SkipAiError) {
        const status = err.status || 502
        return e.json(status, {
          error: status >= 500 ? 'AI indisponível no momento.' : err.message,
        })
      }
      return e.json(500, { error: err.message || 'Erro no streaming do agente.' })
    }
  },
  $apis.requireAuth(),
)
