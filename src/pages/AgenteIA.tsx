import React, { useState, useEffect, useRef } from 'react'
import { useFilter } from '@/contexts/FilterContext'
import {
  aiAgentService,
  PROMPTS_SUGERIDOS,
  type ConversationItem,
  type PromptSugestao,
} from '@/services/aiAgentService'
import { balancosService, dreService } from '@/services/financeService'
import {
  calcularBalanco,
  calcularDre,
  calcularIndicadores,
  calcularKanitz,
  calcularCapitalGiro,
  consolidarBalancoAnual,
  consolidarDreAnual,
  formatBrlMil,
  formatNumber,
  formatPercent,
} from '@/lib/financeCalculations'
import type { DisplayMessage, AgentCitation } from '@/lib/skipAi'
import type { BalancoRecord, DreRecord } from '@/types/finance'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Bot,
  User,
  Send,
  Sparkles,
  RefreshCw,
  PlusCircle,
  MessageSquare,
  Building,
  Calendar,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  Activity,
  Flame,
  Coins,
  Gauge,
  Scale,
  Copy,
  Check,
  Zap,
  Clock,
  ArrowRight,
  HelpCircle,
  Layers,
  ChevronRight,
  ShieldCheck,
  Sliders,
  Maximize2,
  Minimize2,
} from 'lucide-react'
import { toast } from '@/hooks/use-toast'

export default function AgenteIA() {
  const {
    empresas,
    selectedEmpresaId,
    setSelectedEmpresaId,
    selectedAno,
    setSelectedAno,
    anosDisponiveis,
    selectedEmpresa,
  } = useFilter()

  const [conversations, setConversations] = useState<ConversationItem[]>([])
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<DisplayMessage[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamDelta, setStreamDelta] = useState('')
  const [activeTool, setActiveTool] = useState<string | null>(null)
  const [activeCitations, setActiveCitations] = useState<AgentCitation[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)
  const [expandedStats, setExpandedStats] = useState(true)

  // Resumo financeiro rápido do período selecionado
  const [balancoAno, setBalancoAno] = useState<BalancoRecord | null>(null)
  const [dreAno, setDreAno] = useState<DreRecord | null>(null)
  const [loadingFinancials, setLoadingFinancials] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Rolagem automática suave para última mensagem
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, streamDelta, activeTool])

  // Carregar dados contábeis consolidados da empresa/ano para o painel de contexto
  useEffect(() => {
    async function loadFinancialContext() {
      if (!selectedEmpresaId) {
        setBalancoAno(null)
        setDreAno(null)
        return
      }
      try {
        setLoadingFinancials(true)
        const [bList, dList] = await Promise.all([
          balancosService.getByEmpresa(selectedEmpresaId),
          dreService.getByEmpresa(selectedEmpresaId),
        ])
        const bConsolidado = consolidarBalancoAnual(bList, selectedAno)
        const dConsolidado = consolidarDreAnual(dList, selectedAno)
        setBalancoAno(bConsolidado)
        setDreAno(dConsolidado)
      } catch (err) {
        console.warn('Erro ao carregar contexto financeiro da empresa:', err)
      } finally {
        setLoadingFinancials(false)
      }
    }

    loadFinancialContext()
  }, [selectedEmpresaId, selectedAno])

  // Carregar lista de conversas do backend
  const refreshConversations = async () => {
    const list = await aiAgentService.listConversations(30)
    setConversations(list)
  }

  useEffect(() => {
    refreshConversations()
  }, [])

  // Carregar mensagens ao trocar de conversa ativa
  const selectConversation = async (convId: string) => {
    if (convId === activeConversationId) return
    setActiveConversationId(convId)
    setIsLoadingHistory(true)
    setMessages([])
    setStreamDelta('')
    setActiveCitations([])
    try {
      const history = await aiAgentService.loadConversationMessages(convId)
      setMessages(history)
    } catch (err: any) {
      toast({
        title: 'Erro ao carregar histórico',
        description: err?.message || 'Não foi possível carregar as mensagens da conversa.',
        variant: 'destructive',
      })
    } finally {
      setIsLoadingHistory(false)
    }
  }

  const handleStartNewConversation = () => {
    if (isStreaming) {
      abortControllerRef.current?.abort()
    }
    setActiveConversationId(null)
    setMessages([])
    setStreamDelta('')
    setActiveCitations([])
    setInputMessage('')
    setTimeout(() => {
      textareaRef.current?.focus()
    }, 100)
  }

  // Envio de mensagem (streaming com agente nativo Skip Cloud)
  const handleSendMessage = async (customText?: string) => {
    const textToSend = (customText ?? inputMessage).trim()
    if (!textToSend || isStreaming) return

    setInputMessage('')
    setIsStreaming(true)
    setStreamDelta('')
    setActiveTool(null)
    setActiveCitations([])

    // Adiciona a mensagem do usuário na tela de imediato
    const userMsg: DisplayMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: textToSend,
      created: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, userMsg])

    const abortCtrl = new AbortController()
    abortControllerRef.current = abortCtrl

    try {
      const result = await aiAgentService.sendMessageStream({
        message: textToSend,
        conversationId: activeConversationId,
        empresa: selectedEmpresa,
        ano: selectedAno,
        signal: abortCtrl.signal,
        handlers: {
          onChunk: (_delta, full) => {
            setStreamDelta(full)
          },
          onToolCallStart: (info) => {
            setActiveTool(`Consultando dados contábeis em: ${info.name}...`)
          },
          onToolCallDone: () => {
            setActiveTool(null)
          },
          onCitations: (items) => {
            setActiveCitations(items)
          },
          onError: (errMsg) => {
            console.error('Erro retornado pelo stream do agente:', errMsg)
          },
        },
      })

      // Fixa o ID da conversa retornado pelo backend
      if (result.conversationId) {
        setActiveConversationId(result.conversationId)
        refreshConversations()
      }

      // Adiciona mensagem final do assistente ao histórico da tela
      const assistantMsg: DisplayMessage = {
        id: result.messageId || `asst-${Date.now()}`,
        role: 'assistant',
        content: result.content,
        citations: result.citations,
        created: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, assistantMsg])
      setStreamDelta('')
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        console.log('Stream cancelado pelo usuário.')
      } else {
        toast({
          title: 'Falha no Agente de IA',
          description:
            err?.message ||
            'Não foi possível obter resposta do agente. Verifique sua conexão ou tente novamente.',
          variant: 'destructive',
        })
      }
    } finally {
      setIsStreaming(false)
      setActiveTool(null)
      abortControllerRef.current = null
    }
  }

  const handleCopyMessage = (text: string, index: number) => {
    navigator.clipboard.writeText(text)
    setCopiedIndex(index)
    toast({
      title: 'Copiado para a área de transferência',
      description: 'O diagnóstico contábil foi copiado com sucesso.',
    })
    setTimeout(() => setCopiedIndex(null), 2000)
  }

  // Cálculos dinâmicos em tempo real para exibir no banner superior
  const balancoCalc = calcularBalanco(balancoAno)
  const dreCalc = calcularDre(dreAno)
  const indCalc = calcularIndicadores(balancoAno, dreAno)
  const fleurietCalc = calcularCapitalGiro(balancoAno, dreAno)
  const kanitzCalc = calcularKanitz(balancoAno, dreAno)

  // Status de saúde rápido com base nos indicadores reais
  const getSaudeEmpresa = () => {
    if (!balancoAno && !dreAno)
      return { status: 'Sem dados', cor: 'bg-slate-100 text-slate-700', icon: HelpCircle }
    const lc = indCalc.liquidezCorrente ?? 0
    const ml = indCalc.margemLiquida ?? 0
    const fi = kanitzCalc.fi ?? 0

    if (fi >= 0 && lc >= 1.2 && ml >= 5) {
      return {
        status: 'Saudável / Sólida',
        cor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
        icon: CheckCircle2,
      }
    } else if (fi < -3 || lc < 0.9 || ml < 0) {
      return {
        status: 'Crítica / Vulnerável',
        cor: 'bg-rose-100 text-rose-800 border-rose-300',
        icon: AlertCircle,
      }
    }
    return {
      status: 'Atenção / Moderada',
      cor: 'bg-amber-100 text-amber-800 border-amber-300',
      icon: AlertCircle,
    }
  }

  const saude = getSaudeEmpresa()
  const SaudeIcon = saude.icon

  return (
    <div className="flex flex-col h-[calc(100vh-100px)] min-h-[640px] max-w-7xl mx-auto gap-3">
      {/* 1. Header Superior com Contexto da Empresa e Indicadores Chave */}
      <div className="bg-white rounded-xl p-3.5 sm:p-4 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0B1F3A] to-blue-700 flex items-center justify-center text-white shadow-sm shrink-0">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base sm:text-lg font-bold text-[#0B1F3A] leading-tight">
                Agente de Diagnóstico & Estratégia Financeira
              </h1>
              <Badge
                variant="outline"
                className="text-[10px] font-semibold bg-blue-50 text-blue-700 border-blue-200 gap-1"
              >
                <Sparkles className="w-3 h-3 text-blue-600" />
                Skip Cloud Native Agent
              </Badge>
            </div>
            <p className="text-xs text-slate-500 line-clamp-1">
              Assistente persistente com leitura direta de Balanço, DRE, Indicadores, Fleuriet e
              Kanitz
            </p>
          </div>
        </div>

        {/* Seletores Rápidos de Empresa e Ano integrados */}
        <div className="flex items-center gap-2 flex-wrap justify-between md:justify-end">
          <div className="flex items-center gap-1.5 bg-[#F5F7FA] border border-slate-200 rounded-lg px-2.5 py-1 text-xs">
            <Building className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <select
              value={selectedEmpresaId}
              onChange={(e) => setSelectedEmpresaId(e.target.value)}
              className="bg-transparent border-none text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer max-w-[150px] sm:max-w-[200px] truncate"
            >
              {empresas.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.nome} ({emp.segmento})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-[#F5F7FA] border border-slate-200 rounded-lg px-2.5 py-1 text-xs">
            <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <select
              value={String(selectedAno)}
              onChange={(e) => setSelectedAno(Number(e.target.value))}
              className="bg-transparent border-none text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer"
            >
              {anosDisponiveis.map((ano) => (
                <option key={ano} value={String(ano)}>
                  {ano}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => setExpandedStats((prev) => !prev)}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs flex items-center gap-1 transition-colors"
            title={expandedStats ? 'Ocultar mini-painel' : 'Expandir mini-painel'}
          >
            {expandedStats ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">{expandedStats ? 'Compactar' : 'Métricas'}</span>
          </button>
        </div>
      </div>

      {/* 2. Mini-Painel de Indicadores Vivos (Retrátil) */}
      {expandedStats && (
        <div className="bg-white rounded-xl p-3 border border-slate-200 shadow-xs shrink-0 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 transition-all text-xs">
          {/* Status Geral */}
          <div className="flex flex-col justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
            <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">
              Situação Geral
            </span>
            <div className="flex items-center gap-1.5 mt-1">
              <span
                className={`px-2 py-0.5 rounded text-[11px] font-bold border ${saude.cor} flex items-center gap-1 truncate`}
              >
                <SaudeIcon className="w-3 h-3 shrink-0" />
                {saude.status}
              </span>
            </div>
          </div>

          {/* Receita Líquida */}
          <div className="flex flex-col justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
            <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">
              Receita Líquida
            </span>
            <span className="font-bold text-slate-800 text-sm truncate">
              {formatBrlMil(dreCalc.receitaLiquida)}
            </span>
          </div>

          {/* Lucro Líquido & Margem */}
          <div className="flex flex-col justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
            <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">
              Lucro / Margem
            </span>
            <div className="flex items-baseline gap-1 truncate">
              <span
                className={`font-bold text-sm ${dreCalc.lucroLiquido >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}
              >
                {formatBrlMil(dreCalc.lucroLiquido)}
              </span>
              <span className="text-[10px] text-slate-500 font-semibold">
                ({formatPercent(indCalc.margemLiquida, 1)})
              </span>
            </div>
          </div>

          {/* Liquidez Corrente */}
          <div className="flex flex-col justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
            <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">
              Liquidez Corrente
            </span>
            <div className="flex items-center gap-1">
              <Activity className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span className="font-bold text-slate-800 text-sm">
                {formatNumber(indCalc.liquidezCorrente, 2)}
              </span>
            </div>
          </div>

          {/* Modelo Fleuriet */}
          <div className="flex flex-col justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
            <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">
              Capital de Giro (Fleuriet)
            </span>
            <div className="flex items-center gap-1">
              <Coins className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span
                className="font-bold text-slate-800 text-xs truncate"
                title={fleurietCalc.tipoFleurietNome}
              >
                {fleurietCalc.tipoFleuriet === 'indefinido'
                  ? 'Sem dados'
                  : fleurietCalc.tipoFleurietNome.split('—')[0]}
              </span>
            </div>
          </div>

          {/* Kanitz (FI) */}
          <div className="flex flex-col justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
            <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">
              Kanitz (FI)
            </span>
            <div className="flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 text-purple-600 shrink-0" />
              <span
                className={`font-bold text-sm ${kanitzCalc.corStatus === 'verde' ? 'text-emerald-700' : kanitzCalc.corStatus === 'vermelho' ? 'text-rose-600' : 'text-amber-600'}`}
              >
                {kanitzCalc.fi !== null ? formatNumber(kanitzCalc.fi, 2) : '—'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 3. Área Principal: Sidebar de Conversas + Chat Stream Interativo */}
      <div className="flex-1 min-h-0 flex gap-3 overflow-hidden">
        {/* Sidebar Esquerda (Histórico de Conversas e Prompts Sugeridos) */}
        <div className="hidden md:flex flex-col w-72 bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden shrink-0">
          {/* Topo da Sidebar */}
          <div className="p-3 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-blue-700" />
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Conversas Anteriores
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleStartNewConversation}
              className="h-7 text-xs px-2 gap-1 border-blue-300 text-blue-700 hover:bg-blue-50"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              Nova
            </Button>
          </div>

          {/* Lista de Conversas com Scroll */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {conversations.length === 0 ? (
              <div className="p-4 text-center text-slate-400 text-xs">
                <p>Nenhuma conversa salva ainda.</p>
                <p className="text-[11px] mt-1 text-slate-400">
                  Inicie um novo diagnóstico para criar histórico.
                </p>
              </div>
            ) : (
              conversations.map((c) => {
                const isActive = c.id === activeConversationId
                return (
                  <button
                    key={c.id}
                    onClick={() => selectConversation(c.id)}
                    className={`w-full text-left p-2.5 rounded-lg text-xs transition-all flex items-start gap-2 ${
                      isActive
                        ? 'bg-blue-50 text-blue-900 font-semibold border border-blue-200 shadow-2xs'
                        : 'text-slate-600 hover:bg-slate-50 border border-transparent'
                    }`}
                  >
                    <MessageSquare
                      className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${isActive ? 'text-blue-600' : 'text-slate-400'}`}
                    />
                    <div className="truncate flex-1">
                      <p className="truncate leading-tight font-medium">
                        {c.title || 'Diagnóstico Financeiro'}
                      </p>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        {c.updated ? new Date(c.updated).toLocaleDateString('pt-BR') : 'Recente'}
                      </span>
                    </div>
                  </button>
                )
              })
            )}
          </div>

          {/* Dicas de uso no rodapé da Sidebar */}
          <div className="p-3 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-500 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>Memória contínua com isolamento seguro por usuário e empresa.</span>
          </div>
        </div>

        {/* Chat Principal */}
        <div className="flex-1 flex flex-col bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden min-w-0">
          {/* Mensagens / Fluxo da conversa */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
            {/* Se não houver mensagens ainda: Tela de boas-vindas com prompts sugeridos */}
            {messages.length === 0 && !isStreaming && !isLoadingHistory && (
              <div className="h-full flex flex-col justify-center max-w-2xl mx-auto py-4">
                <div className="text-center mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#0B1F3A] to-blue-600 text-white flex items-center justify-center mx-auto mb-3 shadow-md">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <h2 className="text-lg font-bold text-[#0B1F3A]">
                    Como posso ajudar a empresa {selectedEmpresa?.nome || 'selecionada'} hoje?
                  </h2>
                  <p className="text-xs text-slate-500 mt-1 max-w-lg mx-auto">
                    Sou o Agente de IA nativo com acesso direto a todo o histórico de Balanços,
                    DREs, lançamentos, impostos e indicadores da empresa em {selectedAno}. Escolha
                    uma das análises prontas abaixo ou digite sua dúvida.
                  </p>
                </div>

                {/* Grid de Prompts Prontos */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {PROMPTS_SUGERIDOS.map((sugestao) => {
                    return (
                      <button
                        key={sugestao.id}
                        onClick={() => handleSendMessage(sugestao.prompt)}
                        className="text-left p-3 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50/40 transition-all group flex items-start gap-3 bg-white shadow-2xs"
                      >
                        <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                          <Zap className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-xs text-slate-800 group-hover:text-blue-900">
                              {sugestao.titulo}
                            </span>
                            <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 transition-transform group-hover:translate-x-0.5" />
                          </div>
                          <p className="text-[11px] text-slate-500 line-clamp-2 mt-1 leading-snug">
                            {sugestao.prompt}
                          </p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Carregando histórico */}
            {isLoadingHistory && (
              <div className="flex flex-col items-center justify-center py-12 text-slate-500 gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
                <span className="text-xs">Carregando histórico da conversa...</span>
              </div>
            )}

            {/* Renderização das mensagens */}
            {messages.map((m, idx) => {
              const isUser = m.role === 'user'
              return (
                <div
                  key={m.id || idx}
                  className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  {!isUser && (
                    <Avatar className="w-8 h-8 bg-[#0B1F3A] text-white shrink-0 border border-slate-200 mt-1 shadow-2xs">
                      <AvatarFallback className="bg-[#0B1F3A] text-white text-xs font-bold">
                        <Bot className="w-4 h-4" />
                      </AvatarFallback>
                    </Avatar>
                  )}

                  <div
                    className={`max-w-[85%] sm:max-w-[80%] rounded-2xl p-4 text-xs sm:text-sm leading-relaxed shadow-2xs transition-all relative group ${
                      isUser
                        ? 'bg-blue-600 text-white rounded-tr-xs'
                        : 'bg-[#F8FAFC] text-slate-800 border border-slate-200 rounded-tl-xs'
                    }`}
                  >
                    {/* Botão de cópia rápida para mensagens do assistente */}
                    {!isUser && (
                      <button
                        onClick={() => handleCopyMessage(m.content, idx)}
                        className="absolute top-2 right-2 p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Copiar texto"
                      >
                        {copiedIndex === idx ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}

                    {/* Conteúdo formatado */}
                    <div className="whitespace-pre-wrap font-sans">{m.content}</div>

                    {/* Exibição de Citações / Fontes se houver */}
                    {m.citations && m.citations.length > 0 && (
                      <div className="mt-3 pt-2.5 border-t border-slate-200 text-[11px] text-slate-500 space-y-1">
                        <span className="font-semibold text-slate-700 block text-[10px] uppercase tracking-wider">
                          Fontes e Metodologias:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {m.citations.map((c, cIdx) => (
                            <span
                              key={cIdx}
                              className="bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-600 truncate max-w-[280px]"
                              title={c.excerpt}
                            >
                              [{c.n}] {c.excerpt}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <span
                      className={`text-[9px] block mt-2 text-right ${
                        isUser ? 'text-blue-100' : 'text-slate-400'
                      }`}
                    >
                      {m.created
                        ? new Date(m.created).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : ''}
                    </span>
                  </div>

                  {isUser && (
                    <Avatar className="w-8 h-8 bg-blue-700 text-white shrink-0 mt-1 shadow-2xs">
                      <AvatarFallback className="bg-blue-700 text-white text-xs font-bold">
                        <User className="w-4 h-4" />
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>
              )
            })}

            {/* Mensagem em streaming corrente */}
            {isStreaming && (
              <div className="flex gap-3 justify-start">
                <Avatar className="w-8 h-8 bg-[#0B1F3A] text-white shrink-0 border border-slate-200 mt-1 animate-pulse">
                  <AvatarFallback className="bg-[#0B1F3A] text-white text-xs font-bold">
                    <Bot className="w-4 h-4" />
                  </AvatarFallback>
                </Avatar>

                <div className="max-w-[85%] sm:max-w-[80%] rounded-2xl rounded-tl-xs p-4 text-xs sm:text-sm bg-[#F8FAFC] text-slate-800 border border-blue-200 shadow-2xs">
                  {activeTool && (
                    <div className="mb-2 flex items-center gap-2 text-blue-700 text-xs font-semibold bg-blue-50 p-2 rounded-lg border border-blue-100 animate-pulse">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
                      <span>{activeTool}</span>
                    </div>
                  )}

                  {streamDelta ? (
                    <div className="whitespace-pre-wrap font-sans">{streamDelta}</div>
                  ) : (
                    <div className="flex items-center gap-2 text-slate-500 text-xs py-1">
                      <div className="w-2 h-2 rounded-full bg-blue-600 animate-bounce" />
                      <div className="w-2 h-2 rounded-full bg-blue-600 animate-bounce [animation-delay:0.2s]" />
                      <div className="w-2 h-2 rounded-full bg-blue-600 animate-bounce [animation-delay:0.4s]" />
                      <span className="font-medium text-slate-600 ml-1">
                        Analisando demonstrativos contábeis...
                      </span>
                    </div>
                  )}

                  {activeCitations.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-slate-200 text-[11px] text-slate-500">
                      <span className="font-semibold text-slate-700 block text-[10px] uppercase">
                        Fontes:
                      </span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {activeCitations.map((c, cIdx) => (
                          <span
                            key={cIdx}
                            className="bg-white px-2 py-0.5 rounded border text-slate-600"
                          >
                            [{c.n}] {c.excerpt}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Barra de Entrada de Mensagem */}
          <div className="p-3 sm:p-4 bg-white border-t border-slate-200">
            {/* Sugestões rápidas acima do input se houver mensagens */}
            {messages.length > 0 && !isStreaming && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-1 scrollbar-none">
                <span className="text-[10px] font-semibold text-slate-400 uppercase shrink-0">
                  Perguntar:
                </span>
                <button
                  onClick={() =>
                    handleSendMessage(
                      'Qual é o melhor caminho prático para melhorar os resultados e estancar perdas de caixa?',
                    )
                  }
                  className="px-2 py-1 rounded-full bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-[11px] text-slate-600 transition-colors shrink-0"
                >
                  💡 Plano para melhorar resultados
                </button>
                <button
                  onClick={() =>
                    handleSendMessage(
                      'Como está o risco de insolvência segundo o Termômetro de Kanitz?',
                    )
                  }
                  className="px-2 py-1 rounded-full bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-[11px] text-slate-600 transition-colors shrink-0"
                >
                  🔥 Diagnóstico Kanitz
                </button>
                <button
                  onClick={() =>
                    handleSendMessage('A empresa corre risco de Efeito Tesoura no Capital de Giro?')
                  }
                  className="px-2 py-1 rounded-full bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-[11px] text-slate-600 transition-colors shrink-0"
                >
                  ⚠️ Risco Efeito Tesoura
                </button>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleSendMessage()
              }}
              className="flex items-end gap-2 bg-[#F8FAFC] border border-slate-300 focus-within:border-blue-600 rounded-xl p-2 transition-all shadow-inner"
            >
              <Textarea
                ref={textareaRef}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSendMessage()
                  }
                }}
                placeholder={`Pergunte sobre Balanço, DRE, Liquidez, Kanitz ou melhorias para ${selectedEmpresa?.nome || 'a empresa'}...`}
                className="min-h-[44px] max-h-[140px] resize-none border-none shadow-none bg-transparent text-xs sm:text-sm focus-visible:ring-0 p-1 placeholder:text-slate-400 text-slate-800"
                rows={1}
                disabled={isStreaming}
              />

              <div className="flex items-center gap-1 shrink-0 pb-0.5">
                {isStreaming ? (
                  <Button
                    type="button"
                    onClick={() => abortControllerRef.current?.abort()}
                    size="sm"
                    variant="destructive"
                    className="h-8 px-3 text-xs gap-1 rounded-lg"
                  >
                    Parar
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    size="sm"
                    disabled={!inputMessage.trim()}
                    className="h-8 px-3 text-xs gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-xs disabled:opacity-40"
                  >
                    <span>Enviar</span>
                    <Send className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </form>
            <div className="flex items-center justify-between text-[10px] text-slate-400 px-1 mt-1.5">
              <span>
                Pressione <strong>Enter</strong> para enviar, <strong>Shift+Enter</strong> para
                quebrar linha.
              </span>
              <span>
                Contexto ativo:{' '}
                <strong>
                  {selectedEmpresa?.nome || 'Nenhuma'} ({selectedAno})
                </strong>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
