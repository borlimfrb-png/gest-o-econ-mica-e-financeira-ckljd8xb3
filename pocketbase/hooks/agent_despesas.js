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

      const empresaInfo = body.empresa || {}
      const empresaId = empresaInfo.id || body.empresaId || ''
      const empresaNome = empresaInfo.nome || empresaInfo.razao_social || 'Empresa'
      const empresaSegmento = empresaInfo.segmento || 'Geral'

      // Exige empresa na requisição para não expor plano de outras empresas nem sugerir contas fora do escopo
      if (!empresaId) {
        return e.json(400, {
          error:
            'Empresa de destino não informada. É obrigatório selecionar uma empresa para analisar e conciliar despesas com o Plano de Contas.',
        })
      }

      // Consulta plano_contas filtrado ESTRITAMENTE pela empresa do usuário
      let planoContasResumo = []
      try {
        const safeEmpresaId = empresaId.replace(/'/g, "\\'")
        const records = $app.findRecordsByFilter(
          'plano_contas',
          `user = '${userId}' && empresa = '${safeEmpresaId}'`,
          '+created',
          80,
          0,
        )
        planoContasResumo = records.map((r) => {
          let contaNome = ''
          let centroNome = ''
          try {
            const c = $app.findRecordById('contas', r.getString('conta'))
            contaNome = c.getString('nome')
          } catch (_) {}
          try {
            const cc = $app.findRecordById('centros', r.getString('centro'))
            centroNome = cc.getString('nome')
          } catch (_) {}
          return `${r.getString('codigo')} - ${contaNome} (Centro: ${centroNome})`
        })
      } catch (_) {}

      // Consulta memórias de fornecedores filtradas pela empresa (ou memórias gerais do usuário)
      let memoriasResumo = []
      try {
        const safeEmpresaId = empresaId.replace(/'/g, "\\'")
        const mems = $app.findRecordsByFilter(
          'memoria_fornecedores_despesas',
          `user = '${userId}' && (empresa = '${safeEmpresaId}' || empresa = null || empresa = '')`,
          '-total_utilizacoes',
          25,
          0,
        )
        memoriasResumo = mems.map((m) => {
          return `${m.getString('fornecedor_padrao')} -> categoria: ${m.getString('categoria_sugerida')}`
        })
      } catch (_) {}

      const promptComContexto = `[CONTEXTO DA EMPRESA ATIVA]
- Empresa: ${empresaNome} (ID: ${empresaId}, Segmento: ${empresaSegmento})
- Plano de Contas desta Empresa (${planoContasResumo.length} contas cadastradas):
${
  planoContasResumo
    .slice(0, 50)
    .map((c) => `  * ${c}`)
    .join('\n') || '  (Nenhuma conta cadastrada para esta empresa ainda)'
}

- Memória de Fornecedores Conhecidos desta Empresa (${memoriasResumo.length} fornecedores):
${
  memoriasResumo
    .slice(0, 20)
    .map((m) => `  * ${m}`)
    .join('\n') || '  (Nenhum fornecedor registrado ainda)'
}

[SOLICITAÇÃO DO USUÁRIO]:
${message}`

      const convId = body.conversation_id || null

      const result = $ai.agent('importador-despesas').chat({
        user_id: userId,
        conversation_id: convId,
        message: promptComContexto,
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

      const empresaInfo = body.empresa || {}
      const empresaId = empresaInfo.id || body.empresaId || ''
      const empresaNome = empresaInfo.nome || empresaInfo.razao_social || 'Empresa'
      const empresaSegmento = empresaInfo.segmento || 'Geral'

      // Exige empresa na requisição para não expor plano de outras empresas nem sugerir contas fora do escopo
      if (!empresaId) {
        return e.json(400, {
          error:
            'Empresa de destino não informada. É obrigatório selecionar uma empresa para analisar e conciliar despesas com o Plano de Contas.',
        })
      }

      // Consulta plano_contas filtrado ESTRITAMENTE pela empresa do usuário
      let planoContasResumo = []
      try {
        const safeEmpresaId = empresaId.replace(/'/g, "\\'")
        const records = $app.findRecordsByFilter(
          'plano_contas',
          `user = '${userId}' && empresa = '${safeEmpresaId}'`,
          '+created',
          80,
          0,
        )
        planoContasResumo = records.map((r) => {
          let contaNome = ''
          let centroNome = ''
          try {
            const c = $app.findRecordById('contas', r.getString('conta'))
            contaNome = c.getString('nome')
          } catch (_) {}
          try {
            const cc = $app.findRecordById('centros', r.getString('centro'))
            centroNome = cc.getString('nome')
          } catch (_) {}
          return `${r.getString('codigo')} - ${contaNome} (Centro: ${centroNome})`
        })
      } catch (_) {}

      // Consulta memórias de fornecedores filtradas pela empresa (ou memórias gerais do usuário)
      let memoriasResumo = []
      try {
        const safeEmpresaId = empresaId.replace(/'/g, "\\'")
        const mems = $app.findRecordsByFilter(
          'memoria_fornecedores_despesas',
          `user = '${userId}' && (empresa = '${safeEmpresaId}' || empresa = null || empresa = '')`,
          '-total_utilizacoes',
          25,
          0,
        )
        memoriasResumo = mems.map((m) => {
          return `${m.getString('fornecedor_padrao')} -> categoria: ${m.getString('categoria_sugerida')}`
        })
      } catch (_) {}

      const promptComContexto = `[CONTEXTO DA EMPRESA ATIVA]
- Empresa: ${empresaNome} (ID: ${empresaId}, Segmento: ${empresaSegmento})
- Plano de Contas desta Empresa (${planoContasResumo.length} contas cadastradas):
${
  planoContasResumo
    .slice(0, 50)
    .map((c) => `  * ${c}`)
    .join('\n') || '  (Nenhuma conta cadastrada para esta empresa ainda)'
}

- Memória de Fornecedores Conhecidos desta Empresa (${memoriasResumo.length} fornecedores):
${
  memoriasResumo
    .slice(0, 20)
    .map((m) => `  * ${m}`)
    .join('\n') || '  (Nenhum fornecedor registrado ainda)'
}

[SOLICITAÇÃO DO USUÁRIO]:
${message}`

      const conv = $ai.agent('importador-despesas').getOrCreateConversation({
        user_id: userId,
        id: body.conversation_id || null,
        title: body.title || `Importação Despesas - ${empresaNome}`,
      })

      const iter = $ai.agent('importador-despesas').chat({
        user_id: userId,
        conversation_id: conv.id,
        message: promptComContexto,
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
