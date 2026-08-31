import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useFilter } from '@/contexts/FilterContext'
import { useMinhaEmpresa } from '@/contexts/MinhaEmpresaContext'
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
  formatCurrency,
} from '@/lib/financeCalculations'
import { analisarAlertasProativos, type AlertaProativoItem } from '@/lib/alertasProativos'
import { ModalPdfDiagnosticoA4 } from '@/components/ModalPdfDiagnosticoA4'
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
  AlertTriangle,
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
  FileText,
  Printer,
  ArrowLeftRight,
  BarChart3,
  X,
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

  const { minhaEmpresa, logoUrl } = useMinhaEmpresa()

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

  // Comparação de períodos
  const [modoComparacao, setModoComparacao] = useState(false)
  const [anoComparacao, setAnoComparacao] = useState<number>(() => {
    const anos = anosDisponiveis.filter((a) => a !== selectedAno)
    return anos.length > 0 ? anos[0] : selectedAno - 1
  })

  // Modal de Exportação em PDF (Laudo A4)
  const [modalPdfOpen, setModalPdfOpen] = useState(false)
  const [pdfDiagnosticoTexto, setPdfDiagnosticoTexto] = useState('')
  const [pdfCitations, setPdfCitations] = useState<AgentCitation[]>([])
  const [pdfDataGeracao, setPdfDataGeracao] = useState<string>('')

  // Resumo financeiro rápido do período selecionado e do período de comparação
  const [balancosRaw, setBalancosRaw] = useState<BalancoRecord[]>([])
  const [dresRaw, setDresRaw] = useState<DreRecord[]>([])
  const [balancoAno, setBalancoAno] = useState<BalancoRecord | null>(null)
  const [dreAno, setDreAno] = useState<DreRecord | null>(null)
  const [balancoComp, setBalancoComp] = useState<BalancoRecord | null>(null)
  const [dreComp, setDreComp] = useState<DreRecord | null>(null)
  const [loadingFinancials, setLoadingFinancials] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Rolagem suave para última mensagem
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, streamDelta, activeTool])

  // Ajustar ano de comparação caso o selectedAno mude
  useEffect(() => {
    if (anoComparacao === selectedAno) {
      const outroAno = anosDisponiveis.find((a) => a !== selectedAno) || selectedAno - 1
      setAnoComparacao(outroAno)
    }
  }, [selectedAno, anosDisponiveis, anoComparacao])

  // Carregar dados contábeis consolidados da empresa/ano
  useEffect(() => {
    async function loadFinancialContext() {
      if (!selectedEmpresaId) {
        setBalancoAno(null)
        setDreAno(null)
        setBalancoComp(null)
        setDreComp(null)
        setBalancosRaw([])
        setDresRaw([])
        return
      }
      try {
        setLoadingFinancials(true)
        const [bList, dList] = await Promise.all([
          balancosService.getByEmpresa(selectedEmpresaId),
          dreService.getByEmpresa(selectedEmpresaId),
        ])
        setBalancosRaw(bList)
        setDresRaw(dList)

        const bConsolidado = consolidarBalancoAnual(bList, selectedAno)
        const dConsolidado = consolidarDreAnual(dList, selectedAno)
        setBalancoAno(bConsolidado)
        setDreAno(dConsolidado)

        if (anoComparacao) {
          const bComp = consolidarBalancoAnual(bList, anoComparacao)
          const dComp = consolidarDreAnual(dList, anoComparacao)
          setBalancoComp(bComp)
          setDreComp(dComp)
        }
      } catch (err) {
        console.warn('Erro ao carregar contexto financeiro da empresa:', err)
      } finally {
        setLoadingFinancials(false)
      }
    }

    loadFinancialContext()
  }, [selectedEmpresaId, selectedAno, anoComparacao])

  // Alertas proativos de indicadores críticos
  const analiseProativa = useMemo(() => {
    return analisarAlertasProativos(balancosRaw, dresRaw, selectedAno, selectedEmpresa)
  }, [balancosRaw, dresRaw, selectedAno, selectedEmpresa])

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

  // Prepara o bloco comparativo consolidado para injeção no prompt do agente
  const montarContextoComparativo = () => {
    if (!modoComparacao || !anoComparacao) return null

    const b1 = balancoAno
    const d1 = dreAno
    const b2 = balancoComp
    const d2 = dreComp

    const ind1 = calcularIndicadores(b1, d1)
    const ind2 = calcularIndicadores(b2, d2)
    const k1 = calcularKanitz(b1, d1)
    const k2 = calcularKanitz(b2, d2)
    const f1 = calcularCapitalGiro(b1, d1)
    const f2 = calcularCapitalGiro(b2, d2)

    return `
--- DADOS CONSOLIDADOS PARA COMPARAÇÃO ---
* ANO BASE: ${selectedAno}
  - Receita Líquida: ${formatBrlMil(d1?.receita_liquida || 0)}
  - Lucro Líquido: ${formatBrlMil(d1?.lucro_liquido || 0)} (Margem Líquida: ${formatPercent(ind1.margemLiquida, 1)})
  - EBITDA: ${formatBrlMil(d1?.ebitda || 0)}
  - Ativo Total: ${formatBrlMil(b1?.ativo_total || 0)} | Patrimônio Líquido: ${formatBrlMil(b1?.patrimonio_liquido || 0)}
  - Liquidez Corrente: ${formatNumber(ind1.liquidezCorrente, 2)} | Liquidez Seca: ${formatNumber(ind1.liquidezSeca, 2)}
  - Endividamento Geral: ${formatPercent(ind1.endividamentoGeral, 1)}
  - Fleuriet: ${f1.tipoFleurietNome} (CGL: ${formatBrlMil(f1.cgl || 0)}, NCG: ${formatBrlMil(f1.ncg || 0)}, ST: ${formatBrlMil(f1.saldoTesouraria || 0)})
  - Kanitz: FI = ${formatNumber(k1.fi, 2)} (${k1.statusTexto})

* ANO DE COMPARAÇÃO: ${anoComparacao}
  - Receita Líquida: ${formatBrlMil(d2?.receita_liquida || 0)}
  - Lucro Líquido: ${formatBrlMil(d2?.lucro_liquido || 0)} (Margem Líquida: ${formatPercent(ind2.margemLiquida, 1)})
  - EBITDA: ${formatBrlMil(d2?.ebitda || 0)}
  - Ativo Total: ${formatBrlMil(b2?.ativo_total || 0)} | Patrimônio Líquido: ${formatBrlMil(b2?.patrimonio_liquido || 0)}
  - Liquidez Corrente: ${formatNumber(ind2.liquidezCorrente, 2)} | Liquidez Seca: ${formatNumber(ind2.liquidezSeca, 2)}
  - Endividamento Geral: ${formatPercent(ind2.endividamentoGeral, 1)}
  - Fleuriet: ${f2.tipoFleurietNome} (CGL: ${formatBrlMil(f2.cgl || 0)}, NCG: ${formatBrlMil(f2.ncg || 0)}, ST: ${formatBrlMil(f2.saldoTesouraria || 0)})
  - Kanitz: FI = ${formatNumber(k2.fi, 2)} (${k2.statusTexto})
------------------------------------------`
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

    const userMsg: DisplayMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: textToSend,
      created: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, userMsg])

    const abortCtrl = new AbortController()
    abortControllerRef.current = abortCtrl

    const contextoComparativo = modoComparacao ? montarContextoComparativo() : null

    try {
      const result = await aiAgentService.sendMessageStream({
        message: textToSend,
        conversationId: activeConversationId,
        empresa: selectedEmpresa,
        ano: selectedAno,
        anoComparacao: modoComparacao ? anoComparacao : null,
        dadosContextoExtra: contextoComparativo,
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

      if (result.conversationId) {
        setActiveConversationId(result.conversationId)
        refreshConversations()
      }

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

  // Abertura do Modal de PDF para exportar laudo A4
  const handleOpenPdfExport = (
    mensagemConteudo?: string,
    citacoes?: AgentCitation[],
    dataMsg?: string,
  ) => {
    let texto = mensagemConteudo

    // Se não veio mensagem específica, pega a última resposta do agente
    if (!texto) {
      const ultimaDoAgente = [...messages].reverse().find((m) => m.role === 'assistant')
      if (ultimaDoAgente) {
        texto = ultimaDoAgente.content
        citacoes = ultimaDoAgente.citations
        dataMsg = ultimaDoAgente.created
      } else if (streamDelta) {
        texto = streamDelta
        citacoes = activeCitations
      }
    }

    if (!texto) {
      toast({
        title: 'Nenhum diagnóstico disponível',
        description:
          'Gere primeiro uma análise com o Agente de IA para poder exportar o Laudo A4 em PDF.',
        variant: 'destructive',
      })
      return
    }

    setPdfDiagnosticoTexto(texto)
    setPdfCitations(citacoes || [])
    setPdfDataGeracao(dataMsg || new Date().toISOString())
    setModalPdfOpen(true)
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

  // Prompt rápido de comparação entre os dois anos selecionados
  const handlePromptComparacao = () => {
    setModoComparacao(true)
    const promptTexto = `Faça uma análise comparativa aprofundada dos exercícios de ${selectedAno} e ${anoComparacao} para ${selectedEmpresa?.nome || 'a empresa'}: compare a evolução da Receita Líquida, Margem Bruta, Margem EBITDA, Margem Líquida, Liquidez Corrente, Endividamento Geral, a dinâmica de Capital de Giro pelo Modelo Fleuriet e a evolução do Fator de Insolvência de Kanitz. Destaque os avanços, gargalos e qual o melhor plano de ação para os próximos períodos.`
    handleSendMessage(promptTexto)
  }

  // Prompt rápido de Benchmark Setorial
  const handlePromptBenchmark = () => {
    const segmento = selectedEmpresa?.segmento || 'o setor correspondente'
    const promptTexto = `Faça uma análise comparativa completa dos indicadores econômico-financeiros de ${selectedEmpresa?.nome || 'nossa empresa'} em ${selectedAno} com os benchmarks setoriais do mercado brasileiro para ${segmento}. Apresente um confronto detalhado (Liquidez Corrente, Seca, Endividamento Geral, Margens Bruta/EBITDA/Líquida, ROE, ROA, Giro do Ativo, Ciclo Financeiro, CGL, NCG e Saldo de Tesouraria) indicando onde estamos acima, abaixo ou alinhados à mediana do setor, e quais vantagens competitivas ou correções devemos priorizar.`
    handleSendMessage(promptTexto)
  }

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
                Agente de Diagnóstico &amp; Estratégia Financeira
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
              Assistente persistente com leitura de Balanço, DRE, Fleuriet, Kanitz e laudo A4 em PDF
            </p>
          </div>
        </div>

        {/* Seletores Rápidos de Empresa, Ano Principal e Ano de Comparação */}
        <div className="flex items-center gap-2 flex-wrap justify-between md:justify-end">
          {/* Seletor de Empresa */}
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

          {/* Seletor de Ano Principal */}
          <div className="flex items-center gap-1.5 bg-[#F5F7FA] border border-slate-200 rounded-lg px-2.5 py-1 text-xs">
            <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span className="text-[10px] text-slate-400 font-medium hidden sm:inline">Ano:</span>
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

          {/* Botão de Toggle do Modo Comparação de Períodos */}
          <button
            type="button"
            onClick={() => setModoComparacao((prev) => !prev)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold transition-all ${
              modoComparacao
                ? 'bg-indigo-50 border-indigo-300 text-indigo-900 shadow-2xs'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
            title="Ativar comparação entre dois anos contábeis"
          >
            <ArrowLeftRight
              className={`w-3.5 h-3.5 ${modoComparacao ? 'text-indigo-600' : 'text-slate-500'}`}
            />
            <span>Comparar</span>
          </button>

          {/* Seletor de Ano de Comparação (se modo comparação ativo) */}
          {modoComparacao && (
            <div className="flex items-center gap-1 bg-indigo-50 border border-indigo-300 rounded-lg px-2 py-1 text-xs animate-in fade-in duration-200">
              <span className="text-[10px] text-indigo-700 font-bold uppercase">vs:</span>
              <select
                value={String(anoComparacao)}
                onChange={(e) => setAnoComparacao(Number(e.target.value))}
                className="bg-transparent border-none text-xs font-bold text-indigo-950 focus:outline-none cursor-pointer"
              >
                {anosDisponiveis
                  .filter((a) => a !== selectedAno)
                  .map((ano) => (
                    <option key={ano} value={String(ano)}>
                      {ano}
                    </option>
                  ))}
                {!anosDisponiveis.some((a) => a !== selectedAno) && (
                  <option value={String(selectedAno - 1)}>{selectedAno - 1}</option>
                )}
              </select>
            </div>
          )}

          {/* Botão Exportar PDF A4 */}
          <Button
            size="sm"
            onClick={() => handleOpenPdfExport()}
            className="h-7 text-xs font-bold bg-[#0B1F3A] hover:bg-blue-900 text-white gap-1.5 shadow-2xs"
            title="Exportar laudo de diagnóstico financeiro em PDF padrão A4"
          >
            <Printer className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Exportar</span> Laudo PDF
          </Button>

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

      {/* 2. Banner de Alertas Proativos de Indicadores Críticos (se houver) */}
      {analiseProativa.temAlertas && (
        <div className="bg-gradient-to-r from-rose-50 via-amber-50 to-rose-50 border border-rose-200/80 rounded-xl p-3 shrink-0 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-start sm:items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                <AlertTriangle className="w-4 h-4 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-rose-950">
                    Alerta Proativo: {analiseProativa.totalCriticos} indicador(es) crítico(s)
                    detectado(s) em {selectedAno}
                  </span>
                  <Badge className="bg-rose-600 text-white text-[10px] px-1.5 py-0">
                    Zona Crítica
                  </Badge>
                </div>
                <p className="text-[11px] text-slate-600 mt-0.5 line-clamp-1 sm:line-clamp-none">
                  {analiseProativa.alertasCriticos.map((a) => a.indicadorNome).join(' · ')}
                </p>
              </div>
            </div>

            {/* Ações rápidas dos alertas */}
            <div className="flex items-center gap-1.5 flex-wrap self-end sm:self-center">
              {analiseProativa.alertasCriticos.slice(0, 2).map((alerta) => (
                <Button
                  key={alerta.id}
                  size="sm"
                  variant="outline"
                  onClick={() => handleSendMessage(alerta.acaoPrompt)}
                  disabled={isStreaming}
                  className="h-6.5 text-[11px] px-2.5 bg-white border-rose-300 text-rose-900 hover:bg-rose-100 font-semibold gap-1 shadow-2xs"
                >
                  <Zap className="w-3 h-3 text-rose-600" />
                  Diagnosticar {alerta.indicadorNome}
                </Button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 3. Mini-Painel de Indicadores Vivos (Retrátil) */}
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
              <span
                className={`font-bold text-sm ${
                  indCalc.liquidezCorrente !== null && indCalc.liquidezCorrente < 0.8
                    ? 'text-rose-600 font-extrabold'
                    : 'text-slate-800'
                }`}
              >
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
                className={`font-bold text-sm ${
                  kanitzCalc.corStatus === 'verde'
                    ? 'text-emerald-700'
                    : kanitzCalc.corStatus === 'vermelho'
                      ? 'text-rose-600'
                      : 'text-amber-600'
                }`}
              >
                {kanitzCalc.fi !== null ? formatNumber(kanitzCalc.fi, 2) : '—'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 4. Área Principal: Sidebar de Conversas + Chat Stream Interativo */}
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
                    DREs, lançamentos, impostos e indicadores da empresa em {selectedAno}
                    {modoComparacao ? ` (com comparação ativa a ${anoComparacao})` : ''}. Escolha
                    uma das análises prontas abaixo ou digite sua dúvida.
                  </p>
                </div>

                {/* Grid de Prompts Prontos */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {PROMPTS_SUGERIDOS.map((sugestao) => {
                    const isComparar = sugestao.id === 'comparar-periodos'
                    const isBenchmark = sugestao.id === 'benchmark-setorial'
                    return (
                      <button
                        key={sugestao.id}
                        onClick={() => {
                          if (isComparar) {
                            handlePromptComparacao()
                          } else if (isBenchmark) {
                            handlePromptBenchmark()
                          } else {
                            handleSendMessage(sugestao.prompt)
                          }
                        }}
                        className={`text-left p-3 rounded-xl border transition-all group flex items-start gap-3 bg-white shadow-2xs ${
                          isBenchmark
                            ? 'border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50/40 bg-emerald-50/10'
                            : isComparar
                              ? 'border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50/40 bg-indigo-50/10'
                              : 'border-slate-200 hover:border-blue-300 hover:bg-blue-50/40'
                        }`}
                      >
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                            isBenchmark
                              ? 'bg-emerald-100 text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white'
                              : isComparar
                                ? 'bg-indigo-100 text-indigo-700 group-hover:bg-indigo-600 group-hover:text-white'
                                : 'bg-blue-50 text-blue-700 group-hover:bg-blue-600 group-hover:text-white'
                          }`}
                        >
                          {isBenchmark ? (
                            <BarChart3 className="w-4 h-4" />
                          ) : (
                            <Zap className="w-4 h-4" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <span
                              className={`font-semibold text-xs ${
                                isBenchmark
                                  ? 'text-emerald-950 group-hover:text-emerald-900'
                                  : isComparar
                                    ? 'text-indigo-950 group-hover:text-indigo-900'
                                    : 'text-slate-800 group-hover:text-blue-900'
                              }`}
                            >
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
                    {/* Botões de Ação para mensagens do assistente (Copiar e Exportar PDF) */}
                    {!isUser && (
                      <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleOpenPdfExport(m.content, m.citations, m.created)}
                          className="p-1 rounded-md text-slate-500 hover:text-[#0B1F3A] hover:bg-slate-200/60 transition-colors flex items-center gap-1 text-[11px] font-semibold bg-white border border-slate-200 shadow-2xs px-1.5"
                          title="Exportar esta análise em laudo PDF A4"
                        >
                          <Printer className="w-3 h-3 text-blue-600" />
                          <span>PDF A4</span>
                        </button>
                        <button
                          onClick={() => handleCopyMessage(m.content, idx)}
                          className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors bg-white border border-slate-200 shadow-2xs"
                          title="Copiar texto"
                        >
                          {copiedIndex === idx ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
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
            {/* Sugestões rápidas acima do input */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-1 scrollbar-none">
              <span className="text-[10px] font-semibold text-slate-400 uppercase shrink-0">
                Atalhos:
              </span>
              <button
                type="button"
                onClick={handlePromptBenchmark}
                className="px-2.5 py-1 rounded-full bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 text-[11px] font-semibold transition-colors shrink-0 flex items-center gap-1 shadow-2xs"
              >
                <BarChart3 className="w-3 h-3 text-emerald-600" />📊 Benchmark Setorial (
                {selectedEmpresa?.segmento || 'Setor'})
              </button>
              <button
                type="button"
                onClick={handlePromptComparacao}
                className="px-2 py-1 rounded-full bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 text-[11px] font-semibold transition-colors shrink-0 flex items-center gap-1"
              >
                <ArrowLeftRight className="w-3 h-3 text-indigo-600" />
                Comparar {selectedAno} vs {anoComparacao}
              </button>
              <button
                type="button"
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
                type="button"
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
                type="button"
                onClick={() =>
                  handleSendMessage('A empresa corre risco de Efeito Tesoura no Capital de Giro?')
                }
                className="px-2 py-1 rounded-full bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-[11px] text-slate-600 transition-colors shrink-0"
              >
                ⚠️ Risco Efeito Tesoura
              </button>
            </div>

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
                placeholder={`Pergunte sobre Balanço, DRE, Liquidez, Kanitz, Comparação ${selectedAno} vs ${anoComparacao} para ${selectedEmpresa?.nome || 'a empresa'}...`}
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
            <div className="flex items-center justify-between text-[10px] text-slate-400 px-1 mt-1.5 flex-wrap gap-1">
              <span>
                Pressione <strong>Enter</strong> para enviar, <strong>Shift+Enter</strong> para
                quebrar linha.
              </span>
              <span>
                Contexto:{' '}
                <strong>
                  {selectedEmpresa?.nome || 'Nenhuma'} ({selectedAno}
                  {modoComparacao ? ` vs ${anoComparacao}` : ''})
                </strong>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Modal de Exportação do Laudo A4 em PDF */}
      <ModalPdfDiagnosticoA4
        open={modalPdfOpen}
        onOpenChange={setModalPdfOpen}
        selectedEmpresa={selectedEmpresa}
        selectedAno={selectedAno}
        anoComparacao={modoComparacao ? anoComparacao : null}
        minhaEmpresa={minhaEmpresa}
        logoUrl={logoUrl}
        diagnosticoTexto={pdfDiagnosticoTexto}
        citations={pdfCitations}
        dataGeracao={pdfDataGeracao}
        balancoAno={balancoAno}
        dreAno={dreAno}
        balancoComp={balancoComp}
        dreComp={dreComp}
        todasMensagens={messages}
      />
    </div>
  )
}
