import pb from '@/lib/pocketbase/client'
import {
  streamAgentChat,
  displayableMessages,
  type AgentCitation,
  type AgentMessage,
  type DisplayMessage,
  type StreamAgentChatHandlers,
} from '@/lib/skipAi'
import type { EmpresaRecord } from '@/types/finance'

export interface ConversationItem {
  id: string
  title?: string
  created: string
  updated: string
  last_message_at?: string
}

export interface SendMessageOptions {
  message: string
  conversationId?: string | null
  title?: string
  empresa?: EmpresaRecord | null
  ano?: number
  anoComparacao?: number | null
  mes?: number | null
  dadosContextoExtra?: string | null
  handlers?: StreamAgentChatHandlers
  signal?: AbortSignal
}

export interface PromptSugestao {
  id: string
  titulo: string
  categoria: 'geral' | 'liquidez' | 'fleuriet' | 'rentabilidade' | 'kanitz' | 'plano_acao'
  prompt: string
  icone: string
}

export const PROMPTS_SUGERIDOS: PromptSugestao[] = [
  {
    id: 'diagnostico-completo',
    titulo: 'Diagnóstico Geral 360°',
    categoria: 'geral',
    prompt:
      'Faça uma análise diagnóstica completa 360° da empresa no período selecionado: avalie Balanço Patrimonial, DRE, todos os índices de Liquidez, Endividamento, Rentabilidade, Modelo Fleuriet e Kanitz. Dê a classificação geral da situação (Saudável, Atenção ou Crítica), aponte os pontos fortes, pontos fracos e qual é o melhor caminho prático para melhorar os resultados operacionais e de caixa.',
    icone: 'Gauge',
  },
  {
    id: 'comparar-periodos',
    titulo: 'Comparar Períodos',
    categoria: 'geral',
    prompt:
      'Compare detalhadamente o desempenho econômico-financeiro dos dois períodos selecionados: avalie a evolução de Receita, Custos, Lucro Líquido, Margens, EBITDA, Ativo Total, Patrimônio Líquido, índices de Liquidez, Endividamento, evolução no Modelo Fleuriet e no Termômetro de Kanitz. Destaque os avanços, retrocessos e recomende o plano de ação corretivo.',
    icone: 'Scale',
  },
  {
    id: 'fleuriet-capital-giro',
    titulo: 'Análise Fleuriet & Capital de Giro',
    categoria: 'fleuriet',
    prompt:
      'Avalie a dinâmica de Capital de Giro da empresa segundo o Modelo Fleuriet: calcule o Capital de Giro Líquido (CGL), Necessidade de Capital de Giro (NCG) e Saldo de Tesouraria (ST). Aponte em qual dos 6 tipos de Fleuriet a empresa se enquadra, se há risco de Efeito Tesoura e recomende ajustes nos prazos médios (PME, PMR e PMP).',
    icone: 'Coins',
  },
  {
    id: 'kanitz-solvencia',
    titulo: 'Termômetro de Insolvência (Kanitz)',
    categoria: 'kanitz',
    prompt:
      'Calcule o Fator de Insolvência de Stephen Kanitz (FI) detalhando cada uma das 5 variáveis (X1 a X5). Indique em qual zona a empresa se encontra (Solvência, Penumbra ou Insolvência) e quais medidas urgentes de reestruturação patrimonial ou de dívida são necessárias.',
    icone: 'Flame',
  },
  {
    id: 'rentabilidade-ebitda',
    titulo: 'Rentabilidade, Margens & EBITDA',
    categoria: 'rentabilidade',
    prompt:
      'Analise a DRE da empresa: Margem Bruta, Margem Operacional, Margem EBITDA e Margem Líquida, além do ROA e ROE. Compare a eficiência de geração de lucro com a receita gerada e recomende onde cortar custos ou elevar markup.',
    icone: 'TrendingUp',
  },
  {
    id: 'plano-acao-melhorias',
    titulo: 'Plano de Ação: Melhor Caminho',
    categoria: 'plano_acao',
    prompt:
      'Com base nos dados contábeis e financeiros atuais, qual é exatamente o melhor caminho para a empresa melhorar seus resultados nos próximos 30, 60 e 90 dias? Elabore um plano de ação prioritário com ações práticas em ordem de impacto financeiro.',
    icone: 'CheckCircle2',
  },
  {
    id: 'liquidez-endividamento',
    titulo: 'Liquidez & Dívidas Bancárias',
    categoria: 'liquidez',
    prompt:
      'Avalie a liquidez corrente, seca, imediata e geral, junto com a estrutura de endividamento (curto x longo prazo) e alavancagem financeira. A empresa tem capacidade de honrar compromissos sem sufoco de caixa?',
    icone: 'Activity',
  },
]

export const aiAgentService = {
  /**
   * Envia uma mensagem via streaming para o assistente nativo do Skip Cloud
   */
  async sendMessageStream(options: SendMessageOptions) {
    const { message, conversationId, title, empresa, ano, mes, handlers, signal } = options

    const backendUrl = import.meta.env.VITE_POCKETBASE_URL || ''
    const token = pb.authStore.token

    if (!token) {
      throw new Error('Sessão expirada. Faça login novamente para falar com o Agente de IA.')
    }

    // Adiciona metadados de contexto financeiro da tela caso disponíveis
    let contextualizedMessage = message.trim()
    const { anoComparacao, dadosContextoExtra } = options
    if (empresa) {
      const contextoExtraLinhas = [
        `\n\n[CONTEXTO ATUAL DA SESSÃO:`,
        `- Empresa: "${empresa.nome}" (ID: ${empresa.id}, CNPJ: ${empresa.cnpj || 'N/D'}, Segmento: ${empresa.segmento || 'Geral'})`,
        ano ? `- Ano Principal de Referência: ${ano}` : '',
        anoComparacao ? `- Ano de Comparação Selecionado: ${anoComparacao}` : '',
        mes ? `- Mês de Referência: ${mes}` : '',
        dadosContextoExtra
          ? `\n[DEMONSTRAÇÕES E INDICADORES CONSOLIDADOS]:\n${dadosContextoExtra}`
          : '',
        `Consulte diretamente os registros de balancos, dre e demais coleções da empresa "${empresa.nome}" para fundamentar as respostas com números reais comparativos.]`,
      ]
        .filter(Boolean)
        .join('\n')

      // Se o usuário não mencionou o nome da empresa expressamente ou se há contexto comparativo, contextualizamos no prompt
      if (
        !contextualizedMessage.toLowerCase().includes(empresa.nome.toLowerCase()) ||
        anoComparacao ||
        dadosContextoExtra
      ) {
        contextualizedMessage = `${contextualizedMessage}${contextoExtraLinhas}`
      }
    }

    const res = await fetch(`${backendUrl}/backend/v1/agent-diagnostico/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token,
      },
      body: JSON.stringify({
        message: contextualizedMessage,
        conversation_id: conversationId || null,
        title: title || (empresa ? `Diagnóstico ${empresa.nome}` : 'Diagnóstico Financeiro'),
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
   * Envia mensagem de forma síncrona (sem SSE)
   */
  async sendMessageSync(options: {
    message: string
    conversationId?: string | null
    empresa?: EmpresaRecord | null
    ano?: number
    anoComparacao?: number | null
  }) {
    const { message, conversationId, empresa, ano, anoComparacao } = options
    const backendUrl = import.meta.env.VITE_POCKETBASE_URL || ''
    const token = pb.authStore.token

    if (!token) {
      throw new Error('Usuário não autenticado.')
    }

    let contextualizedMessage = message.trim()
    if (empresa) {
      contextualizedMessage += `\n\n[Contexto: Empresa "${empresa.nome}" (ID: ${empresa.id}), Exercício: ${ano || 'Atual'}${anoComparacao ? ` vs ${anoComparacao}` : ''}]`
    }

    const res = await fetch(`${backendUrl}/backend/v1/agent-diagnostico/ask`, {
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
      throw new Error(data.error || 'Falha na comunicação com o agente.')
    }

    return data as {
      conversation_id: string
      content: string
      citations?: AgentCitation[]
      message_id: string
    }
  },

  /**
   * Lista todas as conversas existentes do usuário com o agente nativo
   */
  async listConversations(limit = 30): Promise<ConversationItem[]> {
    const backendUrl = import.meta.env.VITE_POCKETBASE_URL || ''
    const token = pb.authStore.token
    if (!token) return []

    try {
      const res = await fetch(
        `${backendUrl}/backend/v1/agent-diagnostico/conversations?limit=${limit}`,
        {
          headers: {
            Authorization: token,
          },
        },
      )
      if (!res.ok) {
        return []
      }
      const data = await res.json()
      return Array.isArray(data) ? data : data?.conversations || []
    } catch (err) {
      console.warn('Não foi possível carregar conversas anteriores:', err)
      return []
    }
  },

  /**
   * Carrega histórico completo de mensagens de uma conversa e formata para exibição
   */
  async loadConversationMessages(conversationId: string): Promise<DisplayMessage[]> {
    const backendUrl = import.meta.env.VITE_POCKETBASE_URL || ''
    const token = pb.authStore.token
    if (!token || !conversationId) return []

    const res = await fetch(
      `${backendUrl}/backend/v1/agent-diagnostico/conversations/${conversationId}/messages`,
      {
        headers: {
          Authorization: token,
        },
      },
    )

    const payload = await res.json()
    if (!res.ok) {
      throw new Error(payload?.error || 'Erro ao carregar mensagens da conversa.')
    }

    const rawMessages: AgentMessage[] = Array.isArray(payload) ? payload : payload?.messages || []

    return displayableMessages(rawMessages)
  },
}
