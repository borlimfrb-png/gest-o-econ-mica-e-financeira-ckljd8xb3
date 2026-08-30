routerAdd(
  'POST',
  '/backend/v1/agent-diagnostico/ask',
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

      const result = $ai.agent('diagnostico-financeiro').chat({
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
            status >= 500 ? 'Falha ao processar solicitação do agente financeiro.' : err.message,
        })
      }
      if (err instanceof SkipAiError) {
        const status = err.status || 502
        return e.json(status, {
          error: status >= 500 ? 'AI temporariamente indisponível.' : err.message,
        })
      }
      return e.json(500, {
        error: err.message || 'Erro interno no servidor ao consultar o agente.',
      })
    }
  },
  $apis.requireAuth(),
)
