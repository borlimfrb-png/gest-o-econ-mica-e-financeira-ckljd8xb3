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
  empresa_id?: string
  empresa_nome?: string
  title?: string
  created: string
  updated: string
  last_message_at?: string
  ultimo_ano?: number
  skip_conversation_id?: string
}

export interface SendMessageOptions {
  message: string
  conversationId?: string | null
  title?: string
  empresa?: EmpresaRecord | null
  empresaId?: string | null
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
  categoria:
    | 'geral'
    | 'benchmark'
    | 'liquidez'
    | 'fleuriet'
    | 'rentabilidade'
    | 'kanitz'
    | 'plano_acao'
    | 'despesas'
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
    id: 'analise-despesas-fixas-variaveis',
    titulo: 'Despesas Fixas & Variáveis',
    categoria: 'despesas',
    prompt:
      'Analise a estrutura de despesas da empresa ativa: qual é o peso das despesas fixas recorrentes e das despesas variáveis de vendas sobre o faturamento? Quais centros de custo e tipos de despesa mais impactam o resultado líquido e onde há oportunidade imediata de racionalização?',
    icone: 'PieChart',
  },
  {
    id: 'benchmark-setorial',
    titulo: 'Benchmark Setorial',
    categoria: 'benchmark',
    prompt:
      'Compare detalhadamente todos os indicadores econômico-financeiros da empresa com as medianas de referência do seu setor/concorrentes no Brasil (Liquidez Corrente, Seca, Endividamento Geral, Composição da Dívida, Margens Bruta/EBITDA/Líquida, ROE, ROA, Giro do Ativo, Ciclo Financeiro, PMR, PMP, CGL, NCG e Saldo de Tesouraria). Mostre onde a empresa está acima, abaixo ou alinhada ao setor, destacando vantagens competitivas e pontos de melhoria prioritários.',
    icone: 'BarChart3',
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
   * Envia uma mensagem via streaming para o assistente nativo do Skip Cloud,
   * persistindo estritamente na conversa DA EMPRESA ATIVA.
   */
  async sendMessageStream(options: SendMessageOptions) {
    const {
      message,
      conversationId,
      title,
      empresa,
      empresaId: explicitEmpresaId,
      ano,
      mes,
      handlers,
      signal,
    } = options

    const backendUrl = import.meta.env.VITE_POCKETBASE_URL || ''
    const token = pb.authStore.token

    if (!token) {
      throw new Error('Sessão expirada. Faça login novamente para falar com o Agente de IA.')
    }

    const targetEmpresaId = explicitEmpresaId || empresa?.id
    if (!targetEmpresaId) {
      throw new Error(
        'Nenhuma empresa ativa selecionada. Selecione uma empresa no seletor para consultar o Agente de IA.',
      )
    }

    const empresaNome = empresa?.nome || 'Empresa Ativa'

    // Adiciona metadados de contexto financeiro da tela caso disponíveis
    let contextualizedMessage = message.trim()
    const { anoComparacao, dadosContextoExtra } = options

    const contextoExtraLinhas = [
      `\n\n[CONTEXTO ATUAL DA SESSÃO — BORLIM CONSULTORIA:`,
      `- Empresa Ativa: "${empresaNome}" (ID: ${targetEmpresaId}, CNPJ: ${empresa?.cnpj || 'N/D'}, Setor/Segmento: ${empresa?.segmento || 'Não informado / Geral'})`,
      ano ? `- Ano Principal de Referência: ${ano}` : '',
      anoComparacao ? `- Ano de Comparação Selecionado: ${anoComparacao}` : '',
      mes ? `- Mês de Referência: ${mes}` : '',
      `- Precedência de Benchmarks: Consulte "benchmarks_empresas" (meta específica da empresa), depois "benchmarks_setoriais" (personalizado do setor "${empresa?.segmento || 'Geral'}") e por fim a mediana padrão de mercado na sua memória.`,
      dadosContextoExtra
        ? `\n[DEMONSTRAÇÕES E INDICADORES CONSOLIDADOS DA EMPRESA ATIVA]:\n${dadosContextoExtra}`
        : '',
      `AVISO RIGOROSO: Consulte diretamente os registros de balancos, dre, lancamentos, centros, tipos_despesa, contas e plano_contas vinculados estritamente à empresa "${empresaNome}" (ID: ${targetEmpresaId}). Não traga dados de qualquer outra empresa.]`,
    ]
      .filter(Boolean)
      .join('\n')

    if (
      !contextualizedMessage.toLowerCase().includes(empresaNome.toLowerCase()) ||
      anoComparacao ||
      dadosContextoExtra
    ) {
      contextualizedMessage = `${contextualizedMessage}${contextoExtraLinhas}`
    }

    const res = await fetch(`${backendUrl}/backend/v1/agent-diagnostico/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token,
      },
      body: JSON.stringify({
        message: contextualizedMessage,
        empresa_id: targetEmpresaId,
        empresa_nome: empresaNome,
        app_conversation_id: conversationId || null,
        ano: ano || null,
        title: title || `Consulta ${empresaNome}`,
      }),
      signal,
    })

    const streamResult = await streamAgentChat(res, handlers)

    const resolvedConversationId =
      res.headers.get('X-Conversation-Id') ?? streamResult.conversation_id

    // Registrar fechamento assíncrono da mensagem no backend para persistência completa por empresa
    if (resolvedConversationId && streamResult.content) {
      try {
        await fetch(`${backendUrl}/backend/v1/agent-diagnostico/save-assistant-message`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: token,
          },
          body: JSON.stringify({
            app_conversation_id: resolvedConversationId,
            content: streamResult.content,
            citations: streamResult.citations,
          }),
        })
      } catch (err) {
        console.warn('Aviso: persistência secundária da resposta:', err)
      }
    }

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
    empresaId?: string | null
    ano?: number
    anoComparacao?: number | null
  }) {
    const {
      message,
      conversationId,
      empresa,
      empresaId: explicitEmpresaId,
      ano,
      anoComparacao,
    } = options
    const backendUrl = import.meta.env.VITE_POCKETBASE_URL || ''
    const token = pb.authStore.token

    if (!token) {
      throw new Error('Usuário não autenticado.')
    }

    const targetEmpresaId = explicitEmpresaId || empresa?.id
    if (!targetEmpresaId) {
      throw new Error('Nenhuma empresa ativa selecionada.')
    }

    const empresaNome = empresa?.nome || 'Empresa Ativa'

    let contextualizedMessage = message.trim()
    contextualizedMessage += `\n\n[Contexto: Empresa "${empresaNome}" (ID: ${targetEmpresaId}, Setor/Segmento: ${empresa?.segmento || 'Geral'}), Exercício: ${ano || 'Atual'}${anoComparacao ? ` vs ${anoComparacao}` : ''}. Precedência de benchmarks: benchmarks_empresas > benchmarks_setoriais > padrão mercado. Isolamento estrito à empresa "${empresaNome}".]`

    const res = await fetch(`${backendUrl}/backend/v1/agent-diagnostico/ask`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token,
      },
      body: JSON.stringify({
        message: contextualizedMessage,
        empresa_id: targetEmpresaId,
        empresa_nome: empresaNome,
        app_conversation_id: conversationId || null,
        ano: ano || null,
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.error || 'Falha na comunicação com o agente.')
    }

    return {
      conversation_id: data.app_conversation_id || data.conversation_id,
      content: data.content,
      citations: data.citations as AgentCitation[] | undefined,
      message_id: data.message_id,
    }
  },

  /**
   * Lista conversas do usuário FILTRADAS POR EMPRESA ATIVA
   */
  async listConversationsByEmpresa(empresaId: string, limit = 50): Promise<ConversationItem[]> {
    if (!empresaId) return []

    const backendUrl = import.meta.env.VITE_POCKETBASE_URL || ''
    const token = pb.authStore.token
    if (!token) return []

    try {
      const res = await fetch(
        `${backendUrl}/backend/v1/agent-diagnostico/conversations?empresa_id=${encodeURIComponent(empresaId)}&limit=${limit}`,
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
      console.warn('Não foi possível carregar conversas da empresa:', err)
      return []
    }
  },

  /**
   * Compatibilidade legado (caso alguma tela ainda chame listConversations sem empresa)
   */
  async listConversations(limit = 30): Promise<ConversationItem[]> {
    return []
  },

  /**
   * Carrega histórico completo de mensagens de uma conversa persistida por empresa
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
