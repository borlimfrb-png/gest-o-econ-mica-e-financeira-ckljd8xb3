/// <reference path="../pb_data/types.d.ts" />

/**
 * GET /backend/v1/agent-diagnostico/conversations
 * Lista conversas do usuário autenticado FILTRADAS POR EMPRESA_ID
 */
routerAdd(
  'GET',
  '/backend/v1/agent-diagnostico/conversations',
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

      const query = e.requestInfo().query || {}
      const empresaId = query.empresa_id || ''
      const limit = parseInt(query.limit || '50', 10) || 50

      if (!empresaId) {
        return e.badRequestError('empresa_id query param is required')
      }

      const temAcesso = validarAcesso(e.app, e.auth, empresaId)
      if (!temAcesso) {
        return e.forbiddenError('Acesso não permitido a esta empresa.')
      }

      const filter = `user = "${userId}" && empresa_id = "${empresaId}"`
      const records = e.app.findRecordsByFilter('agente_conversas', filter, '-updated', limit, 0)

      const list = records.map((r) => ({
        id: r.id,
        empresa_id: r.getString('empresa_id'),
        empresa_nome: r.getString('empresa_nome'),
        title: r.getString('titulo') || 'Conversa sem título',
        skip_conversation_id: r.getString('skip_conversation_id'),
        ultimo_ano: r.getInt('ultimo_ano'),
        created: r.getString('created'),
        updated: r.getString('updated'),
        last_message_at: r.getString('ultima_mensagem_em') || r.getString('updated'),
      }))

      return e.json(200, list)
    } catch (err) {
      return e.json(500, { error: err.message || 'Erro ao listar conversas por empresa.' })
    }
  },
  $apis.requireAuth(),
)

/**
 * GET /backend/v1/agent-diagnostico/conversations/{conversationId}/messages
 * Retorna as mensagens de uma conversa específica após validar posse e empresa
 */
routerAdd(
  'GET',
  '/backend/v1/agent-diagnostico/conversations/{conversationId}/messages',
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

      const convId = e.request.pathValue('conversationId')
      let conversaRecord = null
      try {
        conversaRecord = e.app.findRecordById('agente_conversas', convId)
      } catch (_) {
        return e.notFoundError('Conversa não encontrada.')
      }

      if (conversaRecord.getString('user') !== userId && e.auth.getString('role') !== 'admin') {
        return e.forbiddenError('Acesso negado a esta conversa.')
      }

      const empresaId = conversaRecord.getString('empresa_id')
      const temAcesso = validarAcesso(e.app, e.auth, empresaId)
      if (!temAcesso) {
        return e.forbiddenError('Acesso não permitido à empresa desta conversa.')
      }

      const msgRecords = e.app.findRecordsByFilter(
        'agente_mensagens',
        `conversa = "${convId}"`,
        'created',
        200,
        0,
      )

      const messages = msgRecords.map((m) => {
        let citations = []
        try {
          const rawCit = m.get('citations')
          if (Array.isArray(rawCit)) citations = rawCit
          else if (typeof rawCit === 'string') citations = JSON.parse(rawCit)
        } catch (_) {}

        return {
          id: m.id,
          role: m.getString('role'),
          content: m.getString('content'),
          citations: citations,
          created: m.getString('created'),
        }
      })

      return e.json(200, {
        conversation: {
          id: conversaRecord.id,
          empresa_id: conversaRecord.getString('empresa_id'),
          empresa_nome: conversaRecord.getString('empresa_nome'),
          title: conversaRecord.getString('titulo'),
        },
        messages,
      })
    } catch (err) {
      return e.json(500, { error: err.message || 'Erro ao carregar mensagens da conversa.' })
    }
  },
  $apis.requireAuth(),
)

/**
 * POST /backend/v1/agent-diagnostico/save-assistant-message
 * Permite ao frontend registrar a resposta final do stream
 */
routerAdd(
  'POST',
  '/backend/v1/agent-diagnostico/save-assistant-message',
  (e) => {
    try {
      const userId = e.auth?.id
      if (!userId) return e.unauthorizedError('auth required')

      const body = e.requestInfo().body || {}
      const convId = body.app_conversation_id || ''
      const content = body.content || ''
      if (!convId || !content.trim()) {
        return e.badRequestError('app_conversation_id and content are required')
      }

      let convRecord = null
      try {
        convRecord = e.app.findRecordById('agente_conversas', convId)
      } catch (_) {
        return e.notFoundError('Conversa não encontrada.')
      }

      if (convRecord.getString('user') !== userId && e.auth.getString('role') !== 'admin') {
        return e.forbiddenError('Acesso não permitido.')
      }

      const msgCol = e.app.findCollectionByNameOrId('agente_mensagens')
      const msgRecord = new Record(msgCol)
      msgRecord.set('conversa', convId)
      msgRecord.set('user', userId)
      msgRecord.set('empresa_id', convRecord.getString('empresa_id'))
      msgRecord.set('role', 'assistant')
      msgRecord.set('content', content)
      if (body.citations) {
        msgRecord.set('citations', body.citations)
      }
      e.app.save(msgRecord)

      convRecord.set('ultima_mensagem_em', new Date().toISOString())
      e.app.save(convRecord)

      return e.json(200, { ok: true, message_id: msgRecord.id })
    } catch (err) {
      return e.json(500, { error: err.message || 'Erro ao salvar mensagem final da assistente.' })
    }
  },
  $apis.requireAuth(),
)
