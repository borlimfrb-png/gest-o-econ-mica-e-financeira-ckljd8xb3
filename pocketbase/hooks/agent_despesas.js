routerAdd(
  'POST',
  '/backend/v1/agent-despesas/ask',
  (e) => {
    try {
      const userId = e.auth?.id
      if (!userId) return e.unauthorizedError('auth required')

      const body = e.requestInfo().body || {}
      const message = body.message
      if (!message || !message.trim()) {
        return e.badRequestError('message is required')
      }

      const convId = body.conversation_id || null

      const result = $ai.agent('importador-despesas').chat({
        user_id: userId,
        conversation_id: convId,
        message: message,
      })

      return e.json(200, {
        conversation_id: result.conversation_id,
        content: result.content,
        citations: result.citations,
        message_id: result.message_id,
      })
    } catch (err) {
      if (err instanceof SkipAiConfigError) {
        return e.json(503, { error: 'AI temporariamente indisponível no servidor.' })
      }
      if (err instanceof SkipAiAgentsError) {
        const status = err.status || 500
        return e.json(status, {
          error:
            status >= 500 ? 'Falha ao processar solicitação do agente de despesas.' : err.message,
        })
      }
      if (err instanceof SkipAiError) {
        const status = err.status || 502
        return e.json(status, {
          error: status >= 500 ? 'AI temporariamente indisponível.' : err.message,
        })
      }
      return e.json(500, {
        error: err.message || 'Erro interno no servidor ao consultar o agente de despesas.',
      })
    }
  },
  $apis.requireAuth(),
)

routerAdd(
  'POST',
  '/backend/v1/agent-despesas/stream',
  (e) => {
    try {
      const userId = e.auth?.id
      if (!userId) return e.unauthorizedError('auth required')

      const body = e.requestInfo().body || {}
      const message = body.message
      if (!message || !message.trim()) {
        return e.badRequestError('message is required')
      }

      const conv = $ai.agent('importador-despesas').getOrCreateConversation({
        user_id: userId,
        id: body.conversation_id || null,
        title: body.title || 'Importação de Despesas',
      })

      const iter = $ai.agent('importador-despesas').chat({
        user_id: userId,
        conversation_id: conv.id,
        message: message,
        stream: true,
      })

      e.response.header().set('Content-Type', 'text/event-stream')
      e.response.header().set('Cache-Control', 'no-cache')
      e.response.header().set('X-Conversation-Id', conv.id)

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
      return e.json(500, { error: err.message || 'Erro no streaming do agente de despesas.' })
    }
  },
  $apis.requireAuth(),
)
