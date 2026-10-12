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

/**
 * Endpoint de Extração e Análise Assistida por IA de PDF de Despesas
 * POST /backend/v1/agent-despesas/analisar-pdf
 * Recebe o arquivo PDF via multipart ("arquivo"), extrai o texto/tabelas com $documents.toMarkdown,
 * e consulta o Agente de IA nativo 'importador-despesas' para retornar proposta estruturada:
 * {
 *   conta_principal: string,
 *   despesas: [{ id, descricao, valor, competencia, sugestao_conta, categoria }],
 *   observacoes: string,
 *   truncated: boolean
 * }
 */
routerAdd(
  'POST',
  '/backend/v1/agent-despesas/analisar-pdf',
  (e) => {
    try {
      const userId = e.auth?.id
      if (!userId) return e.unauthorizedError('auth required')

      const files = e.findUploadedFiles('arquivo')
      if (!files || files.length === 0) {
        return e.badRequestError('Arquivo PDF não anexado.')
      }
      const file = files[0]

      const requestInfo = e.requestInfo()
      const body = requestInfo.body || {}
      const empresaId = body.empresaId || ''
      const empresaNome = body.empresaNome || 'Empresa'
      const periodoInicio = body.periodoInicio || ''
      const periodoFim = body.periodoFim || periodoInicio

      // 1. Extração do texto e tabelas do PDF usando $documents.toMarkdown
      let markdownText = ''
      let isTruncated = false
      try {
        const docResult = $documents.toMarkdown({ file: file })
        markdownText = docResult.markdown || ''
        isTruncated = Boolean(docResult.truncated)
      } catch (docErr) {
        if (docErr && docErr.status === 422) {
          return e.json(422, {
            error:
              'O documento PDF não possui camada de texto selecionável (provável imagem escaneada). Por favor, forneça um PDF com texto digital ou extrato exportado do sistema.',
          })
        }
        if (docErr && docErr.status === 413) {
          return e.json(413, {
            error: 'O arquivo PDF excede o tamanho máximo suportado de 10 MB.',
          })
        }
        return e.json(400, {
          error:
            docErr?.message ||
            'Não foi possível converter o PDF para texto. Verifique se o arquivo está corrompido ou protegido por senha.',
        })
      }

      if (!markdownText || markdownText.trim().length < 15) {
        return e.json(422, {
          error:
            'Nenhum texto legível foi extraído deste PDF. O documento pode ser uma imagem escaneada sem OCR.',
        })
      }

      // 2. Consulta o catálogo de contas do plano de contas da empresa para passar de contexto ao agente
      let planoResumo = []
      if (empresaId) {
        try {
          const safeEmpresaId = empresaId.replace(/'/g, "\\'")
          const planos = $app.findRecordsByFilter(
            'plano_contas',
            `empresa = '${safeEmpresaId}'`,
            '+codigo',
            120,
            0,
          )
          planoResumo = planos.map((p) => {
            let nomeConta = ''
            let nomeCentro = ''
            let tipoDesp = ''
            try {
              const c = $app.findRecordById('contas', p.getString('conta'))
              nomeConta = c.getString('nome')
            } catch (_) {}
            try {
              const cc = $app.findRecordById('centros', p.getString('centro'))
              nomeCentro = cc.getString('nome')
            } catch (_) {}
            try {
              const td = $app.findRecordById('tipos_despesa', p.getString('tipo_despesa'))
              tipoDesp = td.getString('nome')
            } catch (_) {}

            return {
              id: p.id,
              codigo: p.getString('codigo'),
              codigo_empresa: p.getString('codigo_empresa'),
              conta_nome: nomeConta,
              centro_nome: nomeCentro,
              tipo: tipoDesp,
            }
          })
        } catch (_) {}
      }

      // 3. Monta prompt estrito para o Agente de IA gerar JSON puro com Conta Principal e Despesas Detalhadas
      const promptAgente = `Você é o Agente Especialista em Importação e Classificação de Despesas.
O usuário anexou um arquivo PDF contendo um relatório de despesas, faturas ou extrato gerencial.

PERÍODO ESCOLHIDO PELO USUÁRIO: ${periodoInicio}${periodoFim && periodoFim !== periodoInicio ? ' até ' + periodoFim : ''}
EMPRESA ATIVA: ${empresaNome} (ID: ${empresaId || 'Geral'})

PLANO DE CONTAS DISPONÍVEL NESTA EMPRESA (${planoResumo.length} contas cadastradas):
${
  planoResumo.length > 0
    ? planoResumo
        .slice(0, 60)
        .map(
          (p) =>
            `- ID: "${p.id}" | Cód: "${p.codigo}"${p.codigo_empresa ? ' [Emp: ' + p.codigo_empresa + ']' : ''} | Conta: "${p.conta_nome}" | Centro: "${p.centro_nome}" | Tipo: "${p.tipo}"`,
        )
        .join('\n')
    : '(Nenhuma conta cadastrada nesta empresa ainda)'
}

CONTEÚDO EXTRAÍDO DO PDF:
---
${markdownText.slice(0, 32000)}
---

SUA TAREFA:
1. Identificar a "conta_principal": a grande conta-mãe ou categoria agregadora sob a qual todas ou a maioria das despesas se agrupam neste documento (ex.: "Despesas Administrativas", "Custo dos Serviços Prestados", "Despesas Operacionais", "Despesas Comerciais & Marketing", "Despesas com Pessoal" ou "Despesas Financeiras").
2. Identificar e extrair cada uma das "despesas" detalhadas contidas no documento.
   Para cada despesa individual:
   - "descricao": nome do fornecedor, serviço ou item do gasto, limpo e legível
   - "valor": valor numérico estritamente positivo em float (ex: 1540.50)
   - "competencia": mês/ano ou data do gasto no formato "YYYY-MM" ou "YYYY-MM-DD" se identificável no texto; se não estiver no documento, use o período do usuário ("${periodoInicio.slice(0, 7) || '2025-01'}")
   - "categoria": grupo ou subcategoria do gasto (ex: "Serviços de Terceiros", "Material de Escritório", "TI & Softwares", "Encargos", "Tarifas Bancárias")
   - "sugestao_plano_conta_id": se alguma conta da lista do plano acima casar claramente com a despesa, preencha o ID exato dela; caso contrário, use null.

REGRAS DE RESPOSTA (OBRIGATÓRIO):
- Retorne EXCLUSIVAMENTE um objeto JSON válido (sem tags markdown, sem blocos de código adicionais, sem texto antes ou depois).
- O formato DEVE ser rigorosamente:
{
  "conta_principal": "Nome da Conta-Mãe Agregadora",
  "despesas": [
    {
      "id": "item_1",
      "descricao": "Fornecedor ou Despesa",
      "valor": 123.45,
      "competencia": "YYYY-MM",
      "categoria": "Categoria sugerida",
      "sugestao_plano_conta_id": "id_da_conta_se_houver_ou_null"
    }
  ],
  "observacoes": "Resumo objetivo da análise realizada pelo Agente de IA"
}`

      let agentResponseContent = ''
      try {
        const agentResult = $ai.agent('importador-despesas').chat({
          user_id: userId,
          message: promptAgente,
        })
        agentResponseContent = agentResult.content || ''
      } catch (agentErr) {
        // Fallback: se o agente nativo falhar por limite temporário, tenta $ai.chat fast
        try {
          const directChat = $ai.chat({
            model: 'fast',
            messages: [
              {
                role: 'system',
                content:
                  'Você é um parser contábil especialista em extração de despesas de PDFs em JSON puro. Retorne estritamente o JSON solicitado.',
              },
              {
                role: 'user',
                content: promptAgente,
              },
            ],
          })
          agentResponseContent = directChat?.choices?.[0]?.message?.content || ''
        } catch (chatErr) {
          return e.json(500, {
            error:
              'Falha na análise do PDF pelo Agente de IA: ' +
              (chatErr?.message || agentErr?.message || 'erro interno'),
          })
        }
      }

      // 4. Limpa e faz parse do JSON retornado pelo Agente
      let parsedData = null
      try {
        const cleanJson = agentResponseContent
          .replace(/```json/gi, '')
          .replace(/```/g, '')
          .trim()
        parsedData = JSON.parse(cleanJson)
      } catch (parseErr) {
        // Tenta regex para extrair bloco {...}
        const jsonMatch = agentResponseContent.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          try {
            parsedData = JSON.parse(jsonMatch[0])
          } catch (_) {}
        }
      }

      if (!parsedData || !parsedData.despesas || !Array.isArray(parsedData.despesas)) {
        return e.json(422, {
          error:
            'O Agente de IA não conseguiu identificar despesas detalhadas estruturadas neste documento PDF. Verifique se o arquivo possui tabelas ou valores claros de despesas.',
          rawContent: agentResponseContent.slice(0, 500),
        })
      }

      // Validação e normalização dos itens
      const despesasProcessadas = parsedData.despesas
        .map((d, idx) => {
          const valNum = Math.abs(Number(d.valor) || 0)
          return {
            id: d.id || `desp_${idx + 1}_${Date.now().toString(36)}`,
            descricao: String(d.descricao || `Despesa ${idx + 1}`).trim(),
            valor: valNum,
            competencia: String(d.competencia || periodoInicio || '').trim(),
            categoria: String(d.categoria || 'Despesas Operacionais').trim(),
            sugestao_plano_conta_id: d.sugestao_plano_conta_id || null,
          }
        })
        .filter((d) => d.valor > 0 && d.descricao.length >= 2)

      if (despesasProcessadas.length === 0) {
        return e.json(422, {
          error:
            'Nenhuma despesa com valor numérico positivo foi encontrada pelo Agente no PDF anexado.',
        })
      }

      const valorTotal = despesasProcessadas.reduce((acc, curr) => acc + curr.valor, 0)

      return e.json(200, {
        conta_principal: parsedData.conta_principal || 'Despesas Gerais / Operacionais',
        despesas: despesasProcessadas,
        total_despesas: despesasProcessadas.length,
        valor_total: valorTotal,
        observacoes:
          parsedData.observacoes ||
          `Agente de IA identificou ${despesasProcessadas.length} despesas sob a conta agregadora "${parsedData.conta_principal || 'Despesas Gerais'}".`,
        truncated: isTruncated,
      })
    } catch (err) {
      return e.json(500, {
        error: err.message || 'Erro inesperado ao processar PDF com o Agente de IA.',
      })
    }
  },
  $apis.requireAuth(),
)
