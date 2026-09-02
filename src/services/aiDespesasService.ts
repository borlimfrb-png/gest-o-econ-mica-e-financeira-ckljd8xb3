import pb from '@/lib/pocketbase/client'
import { streamAgentChat, type AgentCitation, type StreamAgentChatHandlers } from '@/lib/skipAi'
import type { EmpresaRecord } from '@/types/finance'

export interface AskDespesasAgentOptions {
  message: string
  conversationId?: string | null
  empresa?: EmpresaRecord | null
  handlers?: StreamAgentChatHandlers
  signal?: AbortSignal
}

export const aiDespesasService = {
  /**
   * Envia uma mensagem via streaming para o assistente de importação de despesas
   */
  async sendMessageStream(options: AskDespesasAgentOptions) {
    const { message, conversationId, empresa, handlers, signal } = options
    const backendUrl = import.meta.env.VITE_POCKETBASE_URL || ''
    const token = pb.authStore.token

    if (!token) {
      throw new Error('Sessão expirada. Faça login novamente.')
    }

    let contextualizedMessage = message.trim()
    if (empresa) {
      contextualizedMessage += `\n\n[Contexto da Empresa Ativa: "${empresa.nome}" (ID: ${empresa.id}, Segmento: ${empresa.segmento || 'Geral'})]`
    }

    const res = await fetch(`${backendUrl}/backend/v1/agent-despesas/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token,
      },
      body: JSON.stringify({
        message: contextualizedMessage,
        conversation_id: conversationId || null,
        title: empresa ? `Importação Despesas - ${empresa.nome}` : 'Importação de Despesas',
      }),
      signal,
    })

    const streamResult = await streamAgentChat(res, handlers)
    const resolvedConversationId =
      res.headers.get('X-Conversation-Id') ?? streamResult.conversation_id

    return {
      conversationId: resolvedConversationId,
      messageId: streamResult.message_id,
      content: streamResult.content,
      citations: streamResult.citations,
      toolCalls: streamResult.toolCalls,
    }
  },

  /**
   * Envia mensagem de forma síncrona para consultar o agente de despesas
   */
  async sendMessageSync(options: {
    message: string
    conversationId?: string | null
    empresa?: EmpresaRecord | null
  }) {
    const { message, conversationId, empresa } = options
    const backendUrl = import.meta.env.VITE_POCKETBASE_URL || ''
    const token = pb.authStore.token

    if (!token) {
      throw new Error('Usuário não autenticado.')
    }

    let contextualizedMessage = message.trim()
    if (empresa) {
      contextualizedMessage += `\n\n[Contexto da Empresa Ativa: "${empresa.nome}" (ID: ${empresa.id}, Segmento: ${empresa.segmento || 'Geral'})]`
    }

    const res = await fetch(`${backendUrl}/backend/v1/agent-despesas/ask`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token,
      },
      body: JSON.stringify({
        message: contextualizedMessage,
        conversation_id: conversationId || null,
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.error || 'Falha na comunicação com o agente de despesas.')
    }

    return data as {
      conversation_id: string
      content: string
      citations?: AgentCitation[]
      message_id: string
    }
  },
}
