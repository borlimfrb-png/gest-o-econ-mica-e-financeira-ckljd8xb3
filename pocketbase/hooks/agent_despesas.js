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
      let isDocTruncated = false
      let docPagesInfo = null
      try {
        const docResult = $documents.toMarkdown({ file: file })
        markdownText = docResult.markdown || ''
        isDocTruncated = Boolean(docResult.truncated)
        docPagesInfo = docResult.pages || null
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

      // 2.1 Heurística de estimativa do total de despesas e páginas no documento
      const totalCaractereExtraido = markdownText.length
      // Linhas com potenciais valores monetários no markdown
      const linhasComValores = markdownText.split('\n').filter((l) => {
        return /\b\d{1,3}(?:\.\d{3})*,\d{2}\b|\b\d+\.\d{2}\b/i.test(l) && !/total|saldo\s*final/i.test(l)
      })
      const totalEstimadoLinhasDespesa = Math.max(linhasComValores.length, 1)

      // 2.2 Pré-compactação inteligente do texto para não estourar tokens do modelo e não perder tabelas
      // Remove linhas puramente decorativas (várias repetições de tracinhos, espaços vazios)
      const compactarMarkdown = (txt) => {
        const lines = txt.split('\n')
        const filtered = []
        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed) continue
          // Pula separadores excessivos
          if (/^[-=_*]{4,}$/.test(trimmed)) continue
          filtered.push(trimmed)
        }
        return filtered.join('\n')
      }

      const markdownCompacto = compactarMarkdown(markdownText)
      const CHUNK_SIZE = 48000 // suporta documentos médios/grandes
      let textoParaAgente = markdownCompacto
      let isTextTruncated = false

      if (markdownCompacto.length > CHUNK_SIZE) {
        textoParaAgente = markdownCompacto.slice(0, CHUNK_SIZE)
        isTextTruncated = true
      }

      // 3. Monta prompt estrito para o Agente de IA extrair a hierarquia CONTA -> SUBCONTA -> DESPESAS
      const promptAgente = `Você é o Agente Especialista em Importação e Classificação de Despesas.
O usuário anexou um arquivo PDF contendo um relatório de despesas, faturas ou extrato gerencial.

PERÍODO ESCOLHIDO PELO USUÁRIO: ${periodoInicio}${periodoFim && periodoFim !== periodoInicio ? ' até ' + periodoFim : ''}
EMPRESA ATIVA: ${empresaNome} (ID: ${empresaId || 'Geral'})

PLANO DE CONTAS DISPONÍVEL NESTA EMPRESA (${planoResumo.length} contas cadastradas):
${
  planoResumo.length > 0
    ? planoResumo
        .slice(0, 80)
        .map(
          (p) =>
            `- ID: "${p.id}" | Cód: "${p.codigo}"${p.codigo_empresa ? ' [Emp: ' + p.codigo_empresa + ']' : ''} | Conta: "${p.conta_nome}" | Centro: "${p.centro_nome}" | Tipo: "${p.tipo}"`,
        )
        .join('\n')
    : '(Nenhuma conta cadastrada nesta empresa ainda)'
}

CONTEÚDO EXTRAÍDO DO PDF:
---
${textoParaAgente}
---

SUA TAREFA - EXTRAÇÃO HIERÁRQUICA COMPLETA:
ATENÇÃO: Extraia TODAS as despesas encontradas no texto acima, SEM LIMITAR nem resumir os itens. Não omita linhas com valores!
Analise detalhadamente a estrutura do documento e organize os gastos na hierarquia CONTA → SUBCONTA → DESPESAS conforme vier no documento:
1. "conta_principal": a grande conta agregadora macro no topo (ex.: "Despesas Administrativas", "Custos Operacionais", "Despesas Comerciais", "Despesas com Pessoal", "Despesas Financeiras").
2. "contas": lista de contas/grupos contábeis encontrados. Cada "conta" possui:
   - "nome": nome do grupo (ex: "Despesas Administrativas", "Custos das Instalações")
   - "subcontas": lista de subcontas pertencentes a esta conta. Cada subconta possui:
     - "nome": nome da subconta (ex: "Salários e Encargos", "Energia Elétrica", "Água e Telefone", "Serviços de TI")
     - "despesas": lista com TODOS os itens de despesa detalhados contidos nessa subconta.
   * REGRA DE DEGRADAÇÃO: Se o PDF não tiver divisões explícitas de subcontas, crie uma subconta única com o mesmo nome da conta ou agrupe as despesas diretamente.
3. Para cada item individual em "despesas":
   - "id": identificador único (ex: "item_1")
   - "descricao": fornecedor, serviço ou item do gasto, limpo e legível
   - "valor": valor numérico estritamente positivo em float (ex: 1540.50)
   - "competencia": mês/ano ou data do gasto no formato "YYYY-MM" ou "YYYY-MM-DD" (se não especificado, use "${periodoInicio.slice(0, 7) || '2025-01'}")
   - "categoria": categoria/subconta correspondente
   - "sugestao_plano_conta_id": se alguma conta da lista do plano acima casar claramente com a despesa, preencha o ID exato dela; caso contrário, use null.

REGRAS DE RESPOSTA (OBRIGATÓRIO):
- Retorne EXCLUSIVAMENTE um objeto JSON válido (sem tags markdown, sem blocos de texto extras).
- O formato DEVE ser rigorosamente:
{
  "conta_principal": "Nome da Conta Agregadora Geral",
  "contas": [
    {
      "nome": "Despesas Administrativas",
      "subcontas": [
        {
          "nome": "Energia e Utilidades",
          "despesas": [
            {
              "id": "item_1",
              "descricao": "Companhia Elétrica - Fornecimento",
              "valor": 1250.80,
              "competencia": "YYYY-MM",
              "categoria": "Energia e Utilidades",
              "sugestao_plano_conta_id": "id_da_conta_se_houver_ou_null"
            }
          ]
        }
      ]
    }
  ],
  "despesas": [
    /* Lista plana de todos os itens de despesa para retrocompatibilidade */
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
                  'Você é um parser contábil especialista em extração hierárquica de despesas de PDFs (Conta -> Subconta -> Despesas) em JSON puro. Retorne estritamente o JSON solicitado.',
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

      // 4. Limpa e faz parse do JSON retornado pelo Agente com tolerância a respostas longas
      let parsedData = null
      let isAiResponseTruncated = false
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
        // Se ainda falhar, pode ter havido corte prematuro na resposta da IA (JSON inacabado)
        if (!parsedData && agentResponseContent.includes('"contas"')) {
          isAiResponseTruncated = true
          // Tenta fechar o JSON artificialmente para recuperar o máximo de dados
          const candidateClose = agentResponseContent.replace(/```json/gi, '').replace(/```/g, '').trim()
          const tryClose = [
            candidateClose + ']}',
            candidateClose + ']}]}',
            candidateClose + ']}]}]}',
            candidateClose + '"}]}]}]}',
          ]
          for (const tc of tryClose) {
            try {
              parsedData = JSON.parse(tc)
              break
            } catch (_) {}
          }
        }
      }

      if (!parsedData) {
        return e.json(422, {
          error:
            'O Agente de IA não conseguiu identificar despesas estruturadas neste documento PDF. Verifique se o arquivo possui tabelas ou valores claros de despesas.',
          rawContent: agentResponseContent.slice(0, 500),
        })
      }

      // 5. Normalização robusta da hierarquia Conta -> Subconta -> Despesas
      let seqId = 1
      const normalizarItemDespesa = (rawItem, nomeConta, nomeSubconta) => {
        const valNum = Math.abs(Number(rawItem.valor) || 0)
        const desc = String(rawItem.descricao || `Despesa ${seqId}`).trim()
        if (valNum <= 0 || desc.length < 2) return null

        const itemObj = {
          id: rawItem.id || `desp_${seqId++}_${Date.now().toString(36)}`,
          descricao: desc,
          valor: valNum,
          competencia: String(rawItem.competencia || periodoInicio || '').trim(),
          categoria: String(rawItem.categoria || nomeSubconta || nomeConta || 'Despesas').trim(),
          conta_hierarquia: nomeConta,
          subconta_hierarquia: nomeSubconta,
          sugestao_plano_conta_id: rawItem.sugestao_plano_conta_id || null,
        }
        return itemObj
      }

      const contasProcessadas = []
      const todasDespesas = []

      // Caso A: O modelo retornou a árvore "contas"
      if (Array.isArray(parsedData.contas) && parsedData.contas.length > 0) {
        for (const c of parsedData.contas) {
          const nomeConta = String(c.nome || c.conta || 'Despesas Gerais').trim()
          const subcontasProcessadas = []

          // Se tem subcontas
          if (Array.isArray(c.subcontas) && c.subcontas.length > 0) {
            for (const sc of c.subcontas) {
              const nomeSubconta = String(sc.nome || sc.subconta || nomeConta).trim()
              const despesasDaSubconta = []

              const rawList = Array.isArray(sc.despesas)
                ? sc.despesas
                : Array.isArray(sc.itens)
                  ? sc.itens
                  : []

              for (const rawD of rawList) {
                const itemNorm = normalizarItemDespesa(rawD, nomeConta, nomeSubconta)
                if (itemNorm) {
                  despesasDaSubconta.push(itemNorm)
                  todasDespesas.push(itemNorm)
                }
              }

              if (despesasDaSubconta.length > 0) {
                const subtotalSubconta = despesasDaSubconta.reduce((acc, d) => acc + d.valor, 0)
                subcontasProcessadas.push({
                  id: `sub_${subcontasProcessadas.length + 1}_${Date.now().toString(36)}`,
                  nome: nomeSubconta,
                  despesas: despesasDaSubconta,
                  total_despesas: despesasDaSubconta.length,
                  valor_subtotal: subtotalSubconta,
                })
              }
            }
          } else if (Array.isArray(c.despesas) && c.despesas.length > 0) {
            // Degradação graciosa: conta com despesas diretas sem subcontas
            const despesasDiretas = []
            for (const rawD of c.despesas) {
              const itemNorm = normalizarItemDespesa(rawD, nomeConta, 'Geral')
              if (itemNorm) {
                despesasDiretas.push(itemNorm)
                todasDespesas.push(itemNorm)
              }
            }
            if (despesasDiretas.length > 0) {
              const subtotal = despesasDiretas.reduce((acc, d) => acc + d.valor, 0)
              subcontasProcessadas.push({
                id: `sub_geral_${Date.now().toString(36)}`,
                nome: 'Geral',
                despesas: despesasDiretas,
                total_despesas: despesasDiretas.length,
                valor_subtotal: subtotal,
              })
            }
          }

          if (subcontasProcessadas.length > 0) {
            const totalConta = subcontasProcessadas.reduce((acc, sc) => acc + sc.valor_subtotal, 0)
            const totalItensConta = subcontasProcessadas.reduce(
              (acc, sc) => acc + sc.total_despesas,
              0,
            )
            contasProcessadas.push({
              id: `conta_${contasProcessadas.length + 1}_${Date.now().toString(36)}`,
              nome: nomeConta,
              subcontas: subcontasProcessadas,
              total_despesas: totalItensConta,
              valor_total: totalConta,
            })
          }
        }
      }

      // Caso B: Se o modelo não retornou "contas" estruturadas ou se a árvore ficou vazia,
      // mas retornou a lista plana "despesas", constrói a árvore a partir de categoria/subconta
      if (
        contasProcessadas.length === 0 &&
        Array.isArray(parsedData.despesas) &&
        parsedData.despesas.length > 0
      ) {
        const contaMaeNome = parsedData.conta_principal || 'Despesas Gerais / Operacionais'
        const gruposPorSubconta = new Map()

        for (const rawD of parsedData.despesas) {
          const nomeSub = String(rawD.subconta || rawD.categoria || 'Geral').trim()
          const itemNorm = normalizarItemDespesa(rawD, contaMaeNome, nomeSub)
          if (itemNorm) {
            todasDespesas.push(itemNorm)
            const list = gruposPorSubconta.get(nomeSub) || []
            list.push(itemNorm)
            gruposPorSubconta.set(nomeSub, list)
          }
        }

        const subcontasArr = []
        for (const [nomeSub, itens] of gruposPorSubconta.entries()) {
          const subtotal = itens.reduce((acc, d) => acc + d.valor, 0)
          subcontasArr.push({
            id: `sub_${subcontasArr.length + 1}_${Date.now().toString(36)}`,
            nome: nomeSub,
            despesas: itens,
            total_despesas: itens.length,
            valor_subtotal: subtotal,
          })
        }

        if (subcontasArr.length > 0) {
          const totalConta = subcontasArr.reduce((acc, sc) => acc + sc.valor_subtotal, 0)
          contasProcessadas.push({
            id: `conta_1_${Date.now().toString(36)}`,
            nome: contaMaeNome,
            subcontas: subcontasArr,
            total_despesas: todasDespesas.length,
            valor_total: totalConta,
          })
        }
      }

      if (todasDespesas.length === 0) {
        return e.json(422, {
          error:
            'Nenhuma despesa com valor numérico positivo foi encontrada pelo Agente no PDF anexado.',
          rawContent: agentResponseContent.slice(0, 500),
        })
      }

      const valorTotalGeral = todasDespesas.reduce((acc, curr) => acc + curr.valor, 0)
      const contaPrincipalFinal =
        parsedData.conta_principal ||
        (contasProcessadas.length === 1
          ? contasProcessadas[0].nome
          : 'Despesas Gerais / Operacionais')

      // Contagem total de subcontas
      const totalSubcontas = contasProcessadas.reduce(
        (acc, c) => acc + (c.subcontas ? c.subcontas.length : 0),
        0,
      )

      const isTruncatedFinal = isDocTruncated || isTextTruncated || isAiResponseTruncated

      return e.json(200, {
        conta_principal: contaPrincipalFinal,
        contas: contasProcessadas,
        despesas: todasDespesas,
        total_despesas: todasDespesas.length,
        total_contas: contasProcessadas.length,
        total_subcontas: totalSubcontas,
        total_estimado: totalEstimadoLinhasDespesa,
        caracteres_extraidos: totalCaractereExtraido,
        valor_total: valorTotalGeral,
        observacoes:
          parsedData.observacoes ||
          `Agente de IA identificou ${todasDespesas.length} despesas distribuídas em ${contasProcessadas.length} contas e ${totalSubcontas} subcontas sob "${contaPrincipalFinal}".`,
        truncated: isTruncatedFinal,
        truncamento_detalhes: {
          doc_truncated: isDocTruncated,
          text_truncated: isTextTruncated,
          ai_truncated: isAiResponseTruncated,
          total_lido: todasDespesas.length,
          total_estimado: totalEstimadoLinhasDespesa,
          caracteres_extraidos: totalCaractereExtraido,
        },
      })
    } catch (err) {
      return e.json(500, {
        error: err.message || 'Erro inesperado ao processar PDF com o Agente de IA.',
      })
    }
  },
  $apis.requireAuth(),
)
