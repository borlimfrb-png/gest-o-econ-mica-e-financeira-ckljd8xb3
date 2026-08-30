routerAdd(
  'GET',
  '/backend/v1/agent-diagnostico/conversations',
  (e) => {
    try {
      const userId = e.auth?.id
      if (!userId) return e.unauthorizedError('auth required')

      const limit = parseInt(e.requestInfo().query?.limit || '30', 10) || 30
      const list = $ai.agent('diagnostico-financeiro').listConversations({
        user_id: userId,
        limit: limit,
      })

      return e.json(200, list)
    } catch (err) {
      if (err instanceof SkipAiAgentsError) {
        const status = err.status || 500
        return e.json(status, { error: status >= 500 ? 'Falha ao listar conversas.' : err.message })
      }
      return e.json(500, { error: err.message || 'Erro ao listar conversas do agente.' })
    }
  },
  $apis.requireAuth(),
)

routerAdd(
  'GET',
  '/backend/v1/agent-diagnostico/conversations/{conversationId}/messages',
  (e) => {
    try {
      const userId = e.auth?.id
      if (!userId) return e.unauthorizedError('auth required')

      const convId = e.request.pathValue('conversationId')
      const list = $ai.agent('diagnostico-financeiro').listMessages({
        conversation_id: convId,
        user_id: userId,
      })

      return e.json(200, list)
    } catch (err) {
      if (err instanceof SkipAiAgentsError) {
        const status = err.status || 500
        return e.json(status, {
          error: status >= 500 ? 'Conversa não encontrada ou inacessível.' : err.message,
        })
      }
      return e.json(500, { error: err.message || 'Erro ao carregar mensagens da conversa.' })
    }
  },
  $apis.requireAuth(),
)
