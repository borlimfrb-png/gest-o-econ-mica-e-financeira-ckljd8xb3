import React, { useState, useMemo, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Upload,
  Bot,
  FileText,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Sparkles,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  ExternalLink,
  RefreshCw,
  FolderPlus,
  Layers,
  ArrowRight,
  Filter,
  DollarSign,
  Calendar,
  Building,
  Info,
  SlidersHorizontal,
  History,
  Printer,
  Lock,
  FileCheck2,
  Search,
  MousePointerClick,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { useToast } from '@/hooks/use-toast'
import {
  financeService,
  contasService,
  planoContasService,
  lancamentosService,
  memoriaFornecedoresService,
} from '@/services/financeService'
import { aiDespesasService } from '@/services/aiDespesasService'
import {
  parsePdfDespesas,
  parseExcelDespesas,
  matchDespesaComPlanoContas,
  agruparDespesasPorCategoria,
  type DespesaExtraidaItem,
  type DespesaGrupoResumo,
} from '@/lib/despesasParser'
import { ModalRelatorioConferenciaDespesas } from '@/components/ModalRelatorioConferenciaDespesas'
import { normalizeText } from '@/components/SeletorPlanoContaCombobox'
import type {
  EmpresaRecord,
  PlanoContaRecord,
  CentroRecord,
  TipoDespesaRecord,
  ContaRecord,
  MemoriaFornecedorRecord,
} from '@/types/finance'

const MESES_PTBR = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
]

interface ImportarDespesasIAProps {
  empresas: EmpresaRecord[]
  planoContas: PlanoContaRecord[]
  centros: CentroRecord[]
  tiposDespesas: TipoDespesaRecord[]
  onReloadCatalogs?: () => Promise<void>
}

export function ImportarDespesasIA({
  empresas,
  planoContas: initialPlanoContas,
  centros,
  tiposDespesas,
  onReloadCatalogs,
}: ImportarDespesasIAProps) {
  const { toast } = useToast()
  const navigate = useNavigate()

  // Lista viva de plano de contas (atualizada após novos cadastros)
  const [planoContas, setPlanoContas] = useState<PlanoContaRecord[]>(initialPlanoContas)

  // Memória de Fornecedores Recorrentes
  const [memoriasFornecedores, setMemoriasFornecedores] = useState<MemoriaFornecedorRecord[]>([])

  // Sincroniza se a prop mudar
  useEffect(() => {
    setPlanoContas(initialPlanoContas)
  }, [initialPlanoContas])

  // Empresa selecionada
  const [selectedEmpresaId, setSelectedEmpresaId] = useState<string>(() => {
    return empresas.length > 0 ? empresas[0].id : ''
  })

  useEffect(() => {
    if (!selectedEmpresaId && empresas.length > 0) {
      setSelectedEmpresaId(empresas[0].id)
    }
  }, [empresas, selectedEmpresaId])

  // Carrega o plano de contas e a memória de fornecedores da empresa selecionada
  const loadCatalogoEmpresa = async (empId: string) => {
    try {
      const [planos, memorias] = await Promise.all([
        planoContasService.getAll(empId ? { empresaId: empId } : undefined),
        memoriaFornecedoresService.getByEmpresa(empId || undefined),
      ])
      setPlanoContas(planos)
      setMemoriasFornecedores(memorias)

      // Se já houver despesas carregadas, reavalia a correspondência com o novo plano da empresa
      setDespesas((prev) => {
        if (prev.length === 0) return prev
        return prev.map((item) => {
          const match = matchDespesaComPlanoContas(
            item.descricao,
            item.categoriaSugerida,
            planos,
            memorias,
          )
          return {
            ...item,
            isCadastrada: match.isCadastrada,
            planoContaId: match.planoConta?.id,
            planoContaCodigo: match.planoConta?.codigo,
            planoContaNome: match.planoConta?.expand?.conta?.nome,
            categoriaSugerida: match.categoriaSugerida || item.categoriaSugerida,
            matchConfidence: match.confidence,
            matchScore: match.score,
            origemSugestao: match.origemSugestao,
          }
        })
      })
    } catch (err) {
      console.warn('Não foi possível carregar catálogo da empresa:', err)
    }
  }

  useEffect(() => {
    if (selectedEmpresaId) {
      loadCatalogoEmpresa(selectedEmpresaId)
    }
  }, [selectedEmpresaId])

  // Arquivos adicionados
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingProgress, setProcessingProgress] = useState(0)
  const [processingCurrentFile, setProcessingCurrentFile] = useState<string>('')

  // Reprocessamento de Despesas Não Classificadas
  const [isReprocessing, setIsReprocessing] = useState(false)

  // Lista de despesas extraídas e processadas
  const [despesas, setDespesas] = useState<DespesaExtraidaItem[]>([])
  const [step, setStep] = useState<'upload' | 'revisao' | 'sucesso'>('upload')

  // Data global do lançamento (mês/competência escolhida uma vez, travada para todas as linhas)
  const [dataLancamentoGlobal, setDataLancamentoGlobal] = useState('')
  const [mesLancamentoSelecionado, setMesLancamentoSelecionado] = useState('')
  const [dataGlobalAplicada, setDataGlobalAplicada] = useState<string | null>(null)
  // Linhas editadas individualmente com data diferente da global (preservam a própria data)
  const [datasIndividuaisIds, setDatasIndividuaisIds] = useState<Set<string>>(new Set())

  // Histórico de contas novas criadas nesta sessão de importação
  const [novasContasCriadas, setNovasContasCriadas] = useState<
    Array<{
      nome: string
      codigo?: string
      centro?: string
      tipo?: string
    }>
  >([])

  // Filtros na tela de revisão
  const [filtroStatus, setFiltroStatus] = useState<
    'todos' | 'cadastradas' | 'nao_cadastradas' | 'memoria' | 'baixa'
  >('todos')
  const [filtroCategoria, setFiltroCategoria] = useState<string>('todas')
  const [searchTerm, setSearchTerm] = useState('')

  // Modal para cadastrar nova conta no Plano de Contas
  const [modalCadastroOpen, setModalCadastroOpen] = useState(false)
  const [cadastroItem, setCadastroItem] = useState<DespesaExtraidaItem | null>(null)
  const [novoNomeConta, setNovoNomeConta] = useState('')
  const [novoCentroId, setNovoCentroId] = useState('')
  const [novoTipoDespesaId, setNovoTipoDespesaId] = useState('')
  const [isCadastrandoConta, setIsCadastrandoConta] = useState(false)

  // Modal para cadastro em lote de todas as não cadastradas
  const [modalCadastroLoteOpen, setModalCadastroLoteOpen] = useState(false)
  const [loteCentroId, setLoteCentroId] = useState('')
  const [loteTipoDespesaId, setLoteTipoDespesaId] = useState('')
  const [isCadastrandoLote, setIsCadastrandoLote] = useState(false)

  // Modal de edição inline de uma despesa
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [editDescricao, setEditDescricao] = useState('')
  const [editData, setEditData] = useState('')
  const [editValor, setEditValor] = useState<number>(0)
  const [editPlanoId, setEditPlanoId] = useState('')

  // Painel direito do Plano de Contas: linha selecionada + campo de digitação da conta
  const [despesaSelecionadaId, setDespesaSelecionadaId] = useState<string | null>(null)
  const [buscaContaPainel, setBuscaContaPainel] = useState('')

  // Modal de Relatório de Conferência da Importação em PDF A4
  const [modalRelatorioOpen, setModalRelatorioOpen] = useState(false)

  // Consulta ao Agente de IA para suporte/chat contextual
  const [aiAnalysisPrompt, setAiAnalysisPrompt] = useState('')
  const [isAiLoading, setIsAiLoading] = useState(false)
  const [aiResponse, setAiResponse] = useState<string | null>(null)
  const [showAiHelper, setShowAiHelper] = useState(false)

  // Resumo de sucesso após geração dos lançamentos
  const [generationSummary, setGenerationSummary] = useState<{
    totalItens: number
    totalValor: number
    novasContasCount: number
    lancamentosCount: number
    empresaNome: string
  } | null>(null)
  const [isGeneratingLancamentos, setIsGeneratingLancamentos] = useState(false)

  // Drag & drop
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Barra de rolagem horizontal sincronizada no topo da tabela de revisão
  const scrollBarraTopoRef = useRef<HTMLDivElement>(null)
  const tabelaScrollContainerRef = useRef<HTMLDivElement>(null)
  const tabelaElRef = useRef<HTMLTableElement>(null)
  const [tabelaScrollWidth, setTabelaScrollWidth] = useState(0)

  const handleScrollBarraParaTabela = () => {
    const barra = scrollBarraTopoRef.current
    const container = tabelaScrollContainerRef.current
    if (!barra || !container) return
    if (container.scrollLeft !== barra.scrollLeft) {
      container.scrollLeft = barra.scrollLeft
    }
  }

  const handleScrollTabelaParaBarra = () => {
    const barra = scrollBarraTopoRef.current
    const container = tabelaScrollContainerRef.current
    if (!barra || !container) return
    if (barra.scrollLeft !== container.scrollLeft) {
      barra.scrollLeft = container.scrollLeft
    }
  }

  // ----------------------------------------------------
  // Data global do lançamento: mês/competência + data aplicada a todas as linhas
  // ----------------------------------------------------
  const handleMesGlobalChange = (mes: string) => {
    setMesLancamentoSelecionado(mes)
    const diaAtual =
      dataLancamentoGlobal && /^\d{4}-\d{2}-\d{2}$/.test(dataLancamentoGlobal)
        ? dataLancamentoGlobal.slice(8, 10)
        : '01'
    setDataLancamentoGlobal(`${mes}-${diaAtual}`)
  }

  const handleDataGlobalChange = (valor: string) => {
    setDataLancamentoGlobal(valor)
    if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
      setMesLancamentoSelecionado(valor.slice(0, 7))
      // Data alterada mas ainda não reaplicada: destrava até o usuário aplicar de novo
      if (dataGlobalAplicada && valor !== dataGlobalAplicada) {
        setDataGlobalAplicada(null)
      }
    }
  }

  const aplicarDataGlobalLinhas = () => {
    const data = dataLancamentoGlobal

    if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
      toast({
        title: 'Data inválida',
        description: 'Selecione o mês/competência e a data do lançamento antes de aplicar.',
        variant: 'destructive',
      })
      return
    }

    const [ano, mes, dia] = data.split('-').map(Number)
    const dataObj = new Date(ano, mes - 1, dia)
    const dataCoerente =
      dataObj.getFullYear() === ano && dataObj.getMonth() === mes - 1 && dataObj.getDate() === dia

    if (!dataCoerente || ano < 2000 || ano > 2100) {
      toast({
        title: 'Data inválida',
        description: 'Verifique o dia, o mês e o ano da data do lançamento.',
        variant: 'destructive',
      })
      return
    }

    setDespesas((prev) => prev.map((item) => ({ ...item, data })))
    setDatasIndividuaisIds(new Set())
    setDataGlobalAplicada(data)

    const dataPtBr = `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${ano}`
    toast({
      title: 'Data aplicada a todas as linhas 🔒',
      description: `As ${despesas.length} linha(s) extraída(s) ficarão com a data ${dataPtBr} nos lançamentos gravados. Ajustes individuais por linha continuam possíveis pela edição.`,
    })
  }

  const removerDataGlobal = () => {
    setDataGlobalAplicada(null)
    setDatasIndividuaisIds(new Set())
    toast({
      title: 'Data destravada',
      description:
        'Cada linha volta a usar a data extraída do documento (mantendo a última aplicada).',
    })
  }

  // Data efetiva que vai no lançamento gerado (global travada vence a extraída)
  const dataEfetivaLancamento = (item: DespesaExtraidaItem): string =>
    dataGlobalAplicada && !datasIndividuaisIds.has(item.id) ? dataGlobalAplicada : item.data

  const empresaSelecionada = useMemo(() => {
    return empresas.find((e) => e.id === selectedEmpresaId) || null
  }, [empresas, selectedEmpresaId])

  // Formatação de moeda
  const formatMoeda = (val: number | null | undefined): string => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val || 0)
  }

  // ----------------------------------------------------
  // Leitura e Extração de Arquivos (PDF e Excel)
  // ----------------------------------------------------
  const handleFileSelect = async (files: FileList | File[]) => {
    const validFiles: File[] = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const ext = file.name.split('.').pop()?.toLowerCase()
      if (ext === 'pdf' || ext === 'xlsx' || ext === 'xls' || ext === 'csv') {
        validFiles.push(file)
      } else {
        toast({
          title: 'Formato não suportado',
          description: `O arquivo ${file.name} não é um PDF ou Excel suportado.`,
          variant: 'destructive',
        })
      }
    }

    if (validFiles.length === 0) return

    setUploadedFiles(validFiles)
    setIsProcessing(true)
    setProcessingProgress(0)

    // Atualiza memória antes da extração
    let memoriasAtuais = memoriasFornecedores
    try {
      memoriasAtuais = await memoriaFornecedoresService.getByEmpresa(selectedEmpresaId || undefined)
      setMemoriasFornecedores(memoriasAtuais)
    } catch {
      /* intentionally ignored */
    }

    const todasDespesas: DespesaExtraidaItem[] = []
    let arquivosComAvisoOcr = 0

    try {
      for (let idx = 0; idx < validFiles.length; idx++) {
        const file = validFiles[idx]
        setProcessingCurrentFile(file.name)
        const ext = file.name.split('.').pop()?.toLowerCase()

        if (ext === 'pdf') {
          const { itens, rawResult } = await parsePdfDespesas(
            file,
            planoContas,
            (pct) => {
              const basePct = (idx / validFiles.length) * 100
              const stepPct = pct / validFiles.length
              setProcessingProgress(Math.round(basePct + stepPct))
            },
            memoriasAtuais,
          )

          if (rawResult.isScannedOrEmpty && itens.length === 0) {
            arquivosComAvisoOcr++
          }

          todasDespesas.push(...itens)
        } else {
          // Excel / CSV
          const itens = await parseExcelDespesas(file, planoContas, memoriasAtuais)
          todasDespesas.push(...itens)
          setProcessingProgress(Math.round(((idx + 1) / validFiles.length) * 100))
        }
      }

      setDespesas(todasDespesas)
      setStep('revisao')

      // Pré-seleciona a data mais comum das linhas extraídas como sugestão global
      const contagemDatas = new Map<string, number>()
      todasDespesas.forEach((d) => {
        if (/^\d{4}-\d{2}-\d{2}$/.test(d.data)) {
          contagemDatas.set(d.data, (contagemDatas.get(d.data) || 0) + 1)
        }
      })
      let dataMaisComum = ''
      let maiorContagem = 0
      contagemDatas.forEach((n, data) => {
        if (n > maiorContagem) {
          maiorContagem = n
          dataMaisComum = data
        }
      })
      setDataLancamentoGlobal(dataMaisComum)
      setMesLancamentoSelecionado(dataMaisComum ? dataMaisComum.slice(0, 7) : '')
      setDataGlobalAplicada(null)
      setDatasIndividuaisIds(new Set())

      const lembradasCount = todasDespesas.filter((d) => d.matchConfidence === 'memoria').length

      if (todasDespesas.length === 0) {
        toast({
          title: 'Nenhuma despesa identificada',
          description:
            'Não foi possível encontrar linhas com descrições e valores monetários válidos nos arquivos selecionados.',
          variant: 'destructive',
        })
      } else {
        let descMsg = `Identificamos ${todasDespesas.length} despesas prontas para validação com o Plano de Contas.`
        if (lembradasCount > 0) {
          descMsg += ` 🧠 ${lembradasCount} foram reconhecidas automaticamente pela Memória de Fornecedores!`
        }

        toast({
          title: 'Arquivos processados com sucesso!',
          description: descMsg,
        })

        if (arquivosComAvisoOcr > 0) {
          toast({
            title: 'Aviso: PDF digitalizado/escaneado',
            description:
              'Um ou mais PDFs parecem ser imagens sem texto selecionável. Para esses casos, utilize também a ferramenta de OCR na aba "PDF para Excel".',
          })
        }
      }
    } catch (err: any) {
      console.error('Erro na extração de despesas:', err)
      toast({
        title: 'Falha no processamento',
        description: err?.message || 'Ocorreu um erro ao processar os arquivos.',
        variant: 'destructive',
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files)
    }
  }

  // -------------------------------------------------------------------------
  // 1. REPROCESSAR APENAS DESPESAS NÃO CLASSIFICADAS (SEM REFAZER UPLOAD)
  // -------------------------------------------------------------------------
  const handleReprocessarNaoClassificadas = async () => {
    const naoClassificadas = despesas.filter((d) => !d.isCadastrada)
    if (naoClassificadas.length === 0) {
      toast({
        title: 'Tudo já classificado!',
        description: 'Todas as despesas atuais já possuem vínculo com o Plano de Contas.',
      })
      return
    }

    setIsReprocessing(true)

    try {
      // 1. Recarrega as contas do Plano de Contas e a Memória de Fornecedores mais recentes da empresa de destino
      const [todosPlanos, todasMemorias] = await Promise.all([
        planoContasService.getAll(selectedEmpresaId ? { empresaId: selectedEmpresaId } : undefined),
        memoriaFornecedoresService.getByEmpresa(selectedEmpresaId || undefined),
      ])

      setPlanoContas(todosPlanos)
      setMemoriasFornecedores(todasMemorias)

      let reclassificadasCount = 0

      // 2. Reavalia APENAS os itens não cadastrados, mantendo os já cadastrados/resolvidos intactos
      const novasDespesas = despesas.map((item) => {
        if (item.isCadastrada) {
          return item // Mantém intacto o que já estava resolvido
        }

        const match = matchDespesaComPlanoContas(
          item.descricao,
          item.categoriaSugerida,
          todosPlanos,
          todasMemorias,
        )

        if (match.isCadastrada && match.planoConta) {
          reclassificadasCount++
          return {
            ...item,
            isCadastrada: true,
            planoContaId: match.planoConta.id,
            planoContaCodigo: match.planoConta.codigo,
            planoContaNome: match.planoConta.expand?.conta?.nome,
            categoriaSugerida: match.categoriaSugerida || item.categoriaSugerida,
            matchConfidence: match.confidence,
            matchScore: match.score,
            origemSugestao: match.origemSugestao,
            edited: true,
          }
        }

        return item
      })

      setDespesas(novasDespesas)

      if (reclassificadasCount > 0) {
        toast({
          title: 'Reprocessamento concluído com sucesso! 🎯',
          description: `${reclassificadasCount} despesa(s) pendente(s) foram classificadas com o novo Plano de Contas/Memória.`,
        })
      } else {
        toast({
          title: 'Reprocessamento finalizado',
          description:
            'Nenhuma nova correspondência foi encontrada para as despesas pendentes. Cadastre as contas faltantes no Plano de Contas.',
        })
      }
    } catch (err: any) {
      console.error('Erro ao reprocessar despesas:', err)
      toast({
        title: 'Erro ao reprocessar',
        description: err?.message || 'Falha ao reexecutar classificação das despesas pendentes.',
        variant: 'destructive',
      })
    } finally {
      setIsReprocessing(false)
    }
  }

  // ----------------------------------------------------
  // Ações na Tabela de Revisão
  // ----------------------------------------------------
  const handleToggleSelectAll = (checked: boolean) => {
    setDespesas((prev) => prev.map((item) => ({ ...item, selecionada: checked })))
  }

  const handleToggleSelectItem = (id: string) => {
    setDespesas((prev) =>
      prev.map((item) => (item.id === id ? { ...item, selecionada: !item.selecionada } : item)),
    )
  }

  const handleRemoveItem = (id: string) => {
    setDespesas((prev) => prev.filter((item) => item.id !== id))
    if (despesaSelecionadaId === id) setDespesaSelecionadaId(null)
  }

  const handleStartEdit = (item: DespesaExtraidaItem) => {
    setEditingItemId(item.id)
    setEditDescricao(item.descricao)
    setEditData(item.data)
    setEditValor(item.valor)
    setEditPlanoId(item.planoContaId || '')
  }

  const handleSaveEdit = async (id: string) => {
    const pc = planoContas.find((p) => p.id === editPlanoId)
    const itemTarget = despesas.find((d) => d.id === id)

    setDespesas((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          return {
            ...item,
            descricao: editDescricao.trim() || item.descricao,
            data: editData || item.data,
            valor: Number(editValor) > 0 ? Number(editValor) : item.valor,
            planoContaId: pc?.id,
            planoContaCodigo: pc?.codigo,
            planoContaNome: pc?.expand?.conta?.nome,
            isCadastrada: !!pc,
            matchConfidence: pc ? 'manual' : 'nenhuma',
            origemSugestao: pc ? 'vínculo manual pelo usuário' : undefined,
            edited: true,
          }
        }
        return item
      }),
    )

    // Se vinculou manualmente uma conta, salva na Memória de Fornecedores para importações futuras
    if (pc && itemTarget) {
      try {
        await memoriaFornecedoresService.registrarOuAtualizarVinculo({
          fornecedor_padrao: editDescricao.trim() || itemTarget.descricao,
          termo_busca: editDescricao.trim() || itemTarget.descricao,
          plano_conta: pc.id,
          empresa: selectedEmpresaId || undefined,
          categoria_sugerida: itemTarget.categoriaSugerida,
        })
        const data = await memoriaFornecedoresService.getByEmpresa(selectedEmpresaId || undefined)
        setMemoriasFornecedores(data)
      } catch (err) {
        console.warn('Erro ao salvar vínculo na memória:', err)
      }
    }

    // Se a data global está travada e o usuário editou a data desta linha individualmente,
    // preservamos a data da linha (ela deixa de seguir a trava global)
    if (dataGlobalAplicada && editData && editData !== dataGlobalAplicada) {
      setDatasIndividuaisIds((prev) => {
        const novo = new Set(prev)
        novo.add(id)
        return novo
      })
    }

    setEditingItemId(null)
  }

  const handleCancelEdit = () => {
    setEditingItemId(null)
  }

  // ----------------------------------------------------
  // Painel direito: vínculo da conta digitada/selecionada à linha selecionada.
  // Mesmo comportamento do vínculo manual da edição (handleSaveEdit):
  // atualiza a linha e registra a Memória de Fornecedores.
  // ----------------------------------------------------
  const handleVincularContaDigitada = async (pc: PlanoContaRecord) => {
    if (!despesaSelecionadaId) {
      toast({
        title: 'Nenhuma despesa selecionada',
        description:
          'Clique na descrição de uma linha da tabela para selecioná-la antes de vincular a conta.',
        variant: 'destructive',
      })
      return
    }

    const itemTarget = despesas.find((d) => d.id === despesaSelecionadaId)
    if (!itemTarget) return

    setDespesas((prev) =>
      prev.map((item) =>
        item.id === despesaSelecionadaId
          ? {
              ...item,
              planoContaId: pc.id,
              planoContaCodigo: pc.codigo,
              planoContaNome: pc.expand?.conta?.nome,
              isCadastrada: true,
              matchConfidence: 'manual',
              matchScore: 100,
              origemSugestao: 'vínculo manual pela digitação no Plano de Contas',
            }
          : item,
      ),
    )

    // Registra a memória de fornecedores (mesma gravação do clique/vínculo manual)
    try {
      await memoriaFornecedoresService.registrarOuAtualizarVinculo({
        fornecedor_padrao: itemTarget.descricao,
        termo_busca: itemTarget.descricao,
        plano_conta: pc.id,
        empresa: selectedEmpresaId || undefined,
        categoria_sugerida: itemTarget.categoriaSugerida,
      })
      const data = await memoriaFornecedoresService.getByEmpresa(selectedEmpresaId || undefined)
      setMemoriasFornecedores(data)
    } catch (err) {
      console.warn('Erro ao salvar vínculo na memória:', err)
    }

    toast({
      title: 'Conta vinculada!',
      description: `${pc.codigo || ''} ${pc.expand?.conta?.nome || ''} vinculada a "${itemTarget.descricao}" e salva na memória de fornecedores.`,
    })
  }

  // ----------------------------------------------------
  // Cadastro de Conta no Plano de Contas
  // ----------------------------------------------------
  const handleOpenCadastro = (item: DespesaExtraidaItem) => {
    setCadastroItem(item)
    setNovoNomeConta(item.sugestaoContaNome || item.descricao)
    setNovoCentroId(centros.length > 0 ? centros[0].id : '')
    setNovoTipoDespesaId(tiposDespesas.length > 0 ? tiposDespesas[0].id : '')
    setModalCadastroOpen(true)
  }

  const handleConfirmarCadastroConta = async () => {
    if (!cadastroItem || !novoNomeConta.trim()) {
      toast({
        title: 'Nome obrigatório',
        description: 'Informe o nome da conta para cadastro.',
        variant: 'destructive',
      })
      return
    }

    if (!novoCentroId) {
      toast({
        title: 'Centro de Custo obrigatório',
        description: 'Selecione o centro de custo vinculado.',
        variant: 'destructive',
      })
      return
    }

    setIsCadastrandoConta(true)
    try {
      // 1. Cria a Conta Contábil (tipo Despesa)
      const novaConta: ContaRecord = await contasService.create({
        nome: novoNomeConta.trim(),
        tipo: 'Despesa',
        descricao: `Criada via Agente IA a partir de ${cadastroItem.descricao}`,
        grupo: 'Despesas Operacionais',
        empresa: selectedEmpresaId || undefined,
      })

      // 2. Vincula no Plano de Contas para a empresa selecionada
      const novoPlano: PlanoContaRecord = await planoContasService.create({
        empresa: selectedEmpresaId || undefined,
        conta: novaConta.id,
        centro: novoCentroId,
        tipo_despesa: novoTipoDespesaId || undefined,
        descricao: `Vínculo automático via Agente de IA para ${novoNomeConta.trim()}`,
      })

      // Registra no histórico de novas contas para o relatório PDF
      const centroObj = centros.find((c) => c.id === novoCentroId)
      const tipoObj = tiposDespesas.find((t) => t.id === novoTipoDespesaId)
      setNovasContasCriadas((prev) => [
        ...prev,
        {
          nome: novaConta.nome,
          codigo: novoPlano.codigo || 'PC-Novo',
          centro: centroObj?.nome,
          tipo: tipoObj?.nome,
        },
      ])

      // 3. Grava na Memória de Fornecedores Recorrentes para aprender com a ação
      try {
        await memoriaFornecedoresService.registrarOuAtualizarVinculo({
          fornecedor_padrao: cadastroItem.descricao,
          termo_busca: cadastroItem.descricao,
          plano_conta: novoPlano.id,
          empresa: selectedEmpresaId || undefined,
          categoria_sugerida: cadastroItem.categoriaSugerida,
        })
        const memoriasAtualizadas = await memoriaFornecedoresService.getByEmpresa(
          selectedEmpresaId || undefined,
        )
        setMemoriasFornecedores(memoriasAtualizadas)
      } catch (errMem) {
        console.warn('Erro ao salvar na memória de fornecedores:', errMem)
      }

      // 4. Atualiza catálogo local de plano de contas da empresa
      const todosAtualizados = await planoContasService.getAll(
        selectedEmpresaId ? { empresaId: selectedEmpresaId } : undefined,
      )
      setPlanoContas(todosAtualizados)
      if (onReloadCatalogs) await onReloadCatalogs()

      const planoPopulada = todosAtualizados.find((p) => p.id === novoPlano.id) || novoPlano

      // 5. Atualiza todas as despesas idênticas na lista
      const nomeTarget = cadastroItem.descricao.toLowerCase()
      setDespesas((prev) =>
        prev.map((item) => {
          if (
            item.id === cadastroItem.id ||
            item.descricao.toLowerCase() === nomeTarget ||
            (!item.isCadastrada &&
              item.descricao.toLowerCase().includes(novoNomeConta.toLowerCase()))
          ) {
            return {
              ...item,
              isCadastrada: true,
              planoContaId: planoPopulada.id,
              planoContaCodigo: planoPopulada.codigo,
              planoContaNome: planoPopulada.expand?.conta?.nome || novaConta.nome,
              matchConfidence: 'alta',
              matchScore: 100,
              origemSugestao: 'conta recém-cadastrada no Plano de Contas',
            }
          }
          return item
        }),
      )

      toast({
        title: 'Conta cadastrada no Plano de Contas!',
        description: `A conta "${novoNomeConta.trim()}" (${planoPopulada.codigo || 'PC-Novo'}) foi criada e aprendida na memória de fornecedores.`,
      })

      setModalCadastroOpen(false)
      setCadastroItem(null)
    } catch (err: any) {
      console.error('Erro ao cadastrar conta:', err)
      toast({
        title: 'Erro ao cadastrar conta',
        description: err?.message || 'Não foi possível cadastrar a nova conta.',
        variant: 'destructive',
      })
    } finally {
      setIsCadastrandoConta(false)
    }
  }

  // ----------------------------------------------------
  // Cadastro em Lote das Contas Não Cadastradas
  // ----------------------------------------------------
  const naoCadastradas = useMemo(() => {
    return despesas.filter((d) => !d.isCadastrada && d.selecionada)
  }, [despesas])

  const handleConfirmarCadastroLote = async () => {
    if (!loteCentroId) {
      toast({
        title: 'Centro de Custo obrigatório',
        description: 'Selecione o centro de custo padrão para as novas contas.',
        variant: 'destructive',
      })
      return
    }

    setIsCadastrandoLote(true)
    let criadasCount = 0
    const novasRegistradas: Array<{
      nome: string
      codigo?: string
      centro?: string
      tipo?: string
    }> = []

    try {
      // Agrupa itens por nome de descrição único para não criar duplicados
      const nomesUnicos = Array.from(new Set(naoCadastradas.map((item) => item.descricao.trim())))

      for (const nome of nomesUnicos) {
        try {
          const novaConta = await contasService.create({
            nome,
            tipo: 'Despesa',
            descricao: 'Criada em lote via Agente IA de Importação',
            grupo: 'Despesas Operacionais',
            empresa: selectedEmpresaId || undefined,
          })

          const novoPlano = await planoContasService.create({
            empresa: selectedEmpresaId || undefined,
            conta: novaConta.id,
            centro: loteCentroId,
            tipo_despesa: loteTipoDespesaId || undefined,
            descricao: `Vínculo em lote IA para ${nome}`,
          })

          const centroObj = centros.find((c) => c.id === loteCentroId)
          const tipoObj = tiposDespesas.find((t) => t.id === loteTipoDespesaId)
          novasRegistradas.push({
            nome,
            codigo: novoPlano.codigo,
            centro: centroObj?.nome,
            tipo: tipoObj?.nome,
          })

          // Grava na memória de fornecedores
          try {
            await memoriaFornecedoresService.registrarOuAtualizarVinculo({
              fornecedor_padrao: nome,
              termo_busca: nome,
              plano_conta: novoPlano.id,
              empresa: selectedEmpresaId || undefined,
            })
          } catch {
            /* intentionally ignored */
          }

          criadasCount++
        } catch (err) {
          console.warn(`Erro ao criar conta ${nome} em lote:`, err)
        }
      }

      setNovasContasCriadas((prev) => [...prev, ...novasRegistradas])

      // Recarrega todos os planos atualizados e memórias da empresa de destino
      const [todosAtualizados, todasMemorias] = await Promise.all([
        planoContasService.getAll(selectedEmpresaId ? { empresaId: selectedEmpresaId } : undefined),
        memoriaFornecedoresService.getByEmpresa(selectedEmpresaId || undefined),
      ])

      setPlanoContas(todosAtualizados)
      setMemoriasFornecedores(todasMemorias)
      if (onReloadCatalogs) await onReloadCatalogs()

      // Re-vincula todas as despesas
      setDespesas((prev) =>
        prev.map((item) => {
          if (!item.isCadastrada) {
            const match = todosAtualizados.find(
              (p) => p.expand?.conta?.nome?.toLowerCase() === item.descricao.trim().toLowerCase(),
            )
            if (match) {
              return {
                ...item,
                isCadastrada: true,
                planoContaId: match.id,
                planoContaCodigo: match.codigo,
                planoContaNome: match.expand?.conta?.nome,
                matchConfidence: 'alta',
                matchScore: 100,
                origemSugestao: 'conta criada via lote no Plano de Contas',
              }
            }
          }
          return item
        }),
      )

      toast({
        title: 'Contas cadastradas com sucesso!',
        description: `${criadasCount} novas contas foram criadas no Plano de Contas, associadas às despesas e salvas na memória.`,
      })

      setModalCadastroLoteOpen(false)
    } catch (err: any) {
      console.error('Erro no cadastro em lote:', err)
      toast({
        title: 'Erro no cadastro em lote',
        description: err?.message || 'Falha ao cadastrar contas.',
        variant: 'destructive',
      })
    } finally {
      setIsCadastrandoLote(false)
    }
  }

  // ----------------------------------------------------
  // Geração dos Lançamentos em Lançamentos Rápidos
  // ----------------------------------------------------
  const handleGerarLancamentos = async () => {
    if (!selectedEmpresaId) {
      toast({
        title: 'Empresa não selecionada',
        description: 'Selecione uma empresa de destino para os lançamentos.',
        variant: 'destructive',
      })
      return
    }

    const itensParaLancamento = despesas.filter(
      (d) => d.selecionada && d.isCadastrada && d.planoContaId && d.valor > 0,
    )

    if (itensParaLancamento.length === 0) {
      toast({
        title: 'Nenhuma despesa válida para lançamento',
        description:
          'Certifique-se de que as despesas selecionadas estejam vinculadas ao Plano de Contas antes de gerar os lançamentos.',
        variant: 'destructive',
      })
      return
    }

    setIsGeneratingLancamentos(true)

    try {
      const loteParaGravar = itensParaLancamento.map((item) => ({
        plano_conta: item.planoContaId!,
        data: dataEfetivaLancamento(item),
        valor: item.valor,
        historico: `Importado via IA - ${item.sourceFile} (${item.categoriaSugerida}): ${item.descricao}`,
      }))

      // Gravação atômica em lote único
      const resLote = await lancamentosService.importarLote({
        empresaId: selectedEmpresaId,
        lancamentos: loteParaGravar,
        origem: 'importacao_despesas_ia',
      })

      // Reforça aprendizado na memória de fornecedores em segundo plano
      for (const item of itensParaLancamento) {
        try {
          await memoriaFornecedoresService.registrarOuAtualizarVinculo({
            fornecedor_padrao: item.descricao,
            termo_busca: item.descricao,
            plano_conta: item.planoContaId!,
            empresa: selectedEmpresaId,
            categoria_sugerida: item.categoriaSugerida,
          })
        } catch {
          /* intentionally ignored */
        }
      }

      setGenerationSummary({
        totalItens: itensParaLancamento.length,
        totalValor: resLote.valorTotal,
        novasContasCount: novasContasCriadas.length,
        lancamentosCount: resLote.totalItens,
        empresaNome: empresaSelecionada?.nome || resLote.empresaNome || 'Empresa',
      })

      setStep('sucesso')

      toast({
        title: 'Lançamentos gerados com sucesso! 🎉',
        description: `${resLote.totalItens} lançamentos gravados em lote único atômico para ${empresaSelecionada?.nome || 'a empresa'}.`,
      })
    } catch (err: any) {
      console.error('Erro ao gerar lote de lançamentos:', err)
      toast({
        title: 'Falha na gravação do lote (Nenhum lançamento gravado)',
        description:
          err?.message ||
          'Ocorreu um erro ao processar o lote atômico no servidor. Seus dados continuam no rascunho.',
        variant: 'destructive',
      })
    } finally {
      setIsGeneratingLancamentos(false)
    }
  }

  // ----------------------------------------------------
  // Consulta ao Agente de IA para Auditoria / Dúvidas
  // ----------------------------------------------------
  const handleConsultarAgente = async () => {
    if (!aiAnalysisPrompt.trim()) return

    setIsAiLoading(true)
    setAiResponse(null)

    try {
      const contextoDespesas = despesas.slice(0, 20).map((d) => ({
        data: d.data,
        descricao: d.descricao,
        categoria: d.categoriaSugerida,
        valor: d.valor,
        plano: d.isCadastrada ? d.planoContaNome : 'NÃO CADASTRADA',
        origem: d.origemSugestao || 'Padrão',
      }))

      const promptCompleto = `
Analise a seguinte amostra de despesas importadas pelo usuário:
${JSON.stringify(contextoDespesas, null, 2)}

Pergunta/Solicitação do usuário:
"${aiAnalysisPrompt}"

Por favor, responda de forma objetiva, com recomendações de classificação contábil, centro de custo e sugestões de Plano de Contas.
`

      const res = await aiDespesasService.sendMessageSync({
        message: promptCompleto,
        empresa: empresaSelecionada,
      })

      setAiResponse(res.content)
    } catch (err: any) {
      console.error('Erro ao consultar Agente de IA:', err)
      setAiResponse(
        `Erro na consulta ao Agente: ${err?.message || 'AI temporariamente indisponível.'}`,
      )
    } finally {
      setIsAiLoading(false)
    }
  }

  // ----------------------------------------------------
  // Filtros e Agrupamento
  // ----------------------------------------------------
  const despesasFiltradas = useMemo(() => {
    return despesas.filter((d) => {
      // Filtro status
      if (filtroStatus === 'cadastradas' && !d.isCadastrada) return false
      if (filtroStatus === 'nao_cadastradas' && d.isCadastrada) return false
      if (filtroStatus === 'memoria' && d.matchConfidence !== 'memoria') return false
      if (
        filtroStatus === 'baixa' &&
        d.matchConfidence !== 'baixa' &&
        d.matchConfidence !== 'nenhuma'
      )
        return false

      // Filtro categoria
      if (filtroCategoria !== 'todas' && d.categoriaSugerida !== filtroCategoria) return false

      // Busca textual
      if (searchTerm.trim()) {
        const termo = searchTerm.toLowerCase().trim()
        const descMatch = d.descricao.toLowerCase().includes(termo)
        const catMatch = d.categoriaSugerida.toLowerCase().includes(termo)
        const planoMatch = (d.planoContaNome || '').toLowerCase().includes(termo)
        const codMatch = (d.planoContaCodigo || '').toLowerCase().includes(termo)
        const origemMatch = (d.origemSugestao || '').toLowerCase().includes(termo)
        if (!descMatch && !catMatch && !planoMatch && !codMatch && !origemMatch) return false
      }

      return true
    })
  }, [despesas, filtroStatus, filtroCategoria, searchTerm])

  // Opções de mês/competência (últimos 24 meses + meses presentes nas linhas extraídas)
  const opcoesMesGlobal = useMemo(() => {
    const meses = new Set<string>()
    const agora = new Date()
    for (let i = 0; i < 24; i++) {
      const d = new Date(agora.getFullYear(), agora.getMonth() - i, 1)
      meses.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    }
    despesas.forEach((d) => {
      if (/^\d{4}-\d{2}-\d{2}$/.test(d.data)) meses.add(d.data.slice(0, 7))
    })
    if (/^\d{4}-\d{2}-\d{2}$/.test(dataLancamentoGlobal)) {
      meses.add(dataLancamentoGlobal.slice(0, 7))
    }
    return Array.from(meses).sort().reverse()
  }, [despesas, dataLancamentoGlobal])

  // Mantém a largura do espaçador da barra de rolagem superior em sync com a tabela
  useEffect(() => {
    const tabelaEl = tabelaElRef.current
    if (!tabelaEl) {
      setTabelaScrollWidth(0)
      return
    }
    const atualizar = () => {
      setTabelaScrollWidth(Math.max(tabelaEl.scrollWidth, tabelaEl.offsetWidth))
      const container = tabelaScrollContainerRef.current
      if (container && scrollBarraTopoRef.current) {
        scrollBarraTopoRef.current.scrollLeft = container.scrollLeft
      }
    }
    atualizar()
    const observer = new ResizeObserver(atualizar)
    observer.observe(tabelaEl)
    return () => observer.disconnect()
  }, [step, despesasFiltradas])

  // Painel direito: filtro do Plano de Contas por digitação (ignora acentos,
  // mesma normalização do SeletorPlanoContaCombobox)
  const planoContasPainelFiltrado = useMemo(() => {
    const termo = normalizeText(buscaContaPainel)
    if (!termo) return planoContas
    return planoContas.filter((pc) => {
      const alvo = normalizeText(
        `${pc.codigo || ''} ${pc.codigo_empresa || ''} ${pc.expand?.conta?.codigo || ''} ${
          pc.expand?.conta?.nome || ''
        } ${pc.expand?.centro?.nome || ''}`,
      )
      return alvo.includes(termo)
    })
  }, [planoContas, buscaContaPainel])

  const despesaSelecionada = useMemo(
    () => despesas.find((d) => d.id === despesaSelecionadaId) || null,
    [despesas, despesaSelecionadaId],
  )

  const gruposPorCategoria = useMemo(() => {
    return agruparDespesasPorCategoria(despesas)
  }, [despesas])

  const categoriasUnicas = useMemo(() => {
    return Array.from(new Set(despesas.map((d) => d.categoriaSugerida))).sort()
  }, [despesas])

  // Métricas gerais
  const totalDespesasCount = despesas.length
  const totalDespesasValor = despesas.reduce((acc, d) => acc + (d.valor || 0), 0)
  const cadastradasCount = despesas.filter((d) => d.isCadastrada).length
  const naoCadastradasCount = totalDespesasCount - cadastradasCount
  const memoriaCount = despesas.filter((d) => d.matchConfidence === 'memoria').length
  const baixaConfiancaCount = despesas.filter(
    (d) => d.matchConfidence === 'baixa' || d.matchConfidence === 'nenhuma',
  ).length
  const selecionadasCount = despesas.filter((d) => d.selecionada).length
  const selecionadasValor = despesas
    .filter((d) => d.selecionada)
    .reduce((acc, d) => acc + (d.valor || 0), 0)

  // =========================================================================
  // RENDERIZAÇÃO
  // =========================================================================
  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Banner Principal do Agente de IA */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950 p-6 text-white shadow-lg border border-blue-900/40">
        <div className="absolute right-0 top-0 -mt-10 -mr-10 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-blue-500/20 px-3 py-1 text-xs font-semibold text-blue-300 border border-blue-400/30 uppercase tracking-wider">
              <Bot className="h-3.5 w-3.5 text-blue-400 animate-pulse" />
              Agente Nativo de IA · Importação Inteligente & Memória Recorrente
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              Importação de Despesas com IA
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              Carregue faturas, relatórios bancários e notas em <strong>PDF</strong> ou planilhas{' '}
              <strong>Excel (.xlsx, .xls)</strong>. A IA lê as informações, separa despesa por
              despesa, <strong>lembra de fornecedores de importações passadas</strong>, verifica o
              Plano de Contas e gera relatório formal de conferência.
            </p>
          </div>

          {/* Seleção de Empresa de Destino */}
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/15 min-w-[280px]">
            <Label className="text-xs font-semibold text-blue-200 flex items-center gap-1.5 mb-1.5">
              <Building className="w-3.5 h-3.5 text-blue-300" />
              Empresa de Destino *
            </Label>
            <Select value={selectedEmpresaId} onValueChange={setSelectedEmpresaId}>
              <SelectTrigger className="h-9 text-xs bg-slate-900/80 border-slate-700 text-white font-medium">
                <SelectValue placeholder="Selecione a empresa" />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {empresas.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id} className="text-xs">
                    {emp.nome} ({emp.segmento || 'Geral'})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-slate-300 mt-1.5 flex items-center gap-1">
              <Info className="w-3 h-3 text-blue-400" />
              Os lançamentos serão gravados para esta empresa.
            </p>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ETAPA 1: ÁREA DE UPLOAD (DRAG & DROP MULTI-ARQUIVOS)                      */}
      {/* ========================================================================= */}
      {step === 'upload' && (
        <Card className="bg-white border-slate-200 shadow-sm">
          <CardHeader className="pb-4 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Upload className="w-4 h-4 text-blue-600" />
                  1. Selecione os Arquivos de Despesas
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Arraste ou clique para selecionar múltiplos arquivos PDF ou planilhas Excel
                  simultaneamente.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {memoriasFornecedores.length > 0 && (
                  <Badge
                    variant="outline"
                    className="bg-purple-50 text-purple-700 border-purple-200 text-xs gap-1"
                  >
                    <History className="w-3 h-3 text-purple-600" />
                    {memoriasFornecedores.length} fornecedor(es) na Memória
                  </Badge>
                )}
                <Badge
                  variant="outline"
                  className="bg-blue-50 text-blue-700 border-blue-200 text-xs"
                >
                  PDF + Excel Suportados
                </Badge>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-6">
            <div
              onDragOver={(e) => {
                e.preventDefault()
                setIsDragging(true)
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-blue-500 bg-blue-50/60 scale-[1.01]'
                  : 'border-slate-300 hover:border-blue-400 bg-slate-50/50 hover:bg-blue-50/20'
              }`}
            >
              <input
                type="file"
                ref={fileInputRef}
                multiple
                accept=".pdf,.xlsx,.xls,.csv"
                onChange={(e) => e.target.files && handleFileSelect(e.target.files)}
                className="hidden"
              />

              <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center mb-4 shadow-sm">
                <Upload className="w-8 h-8" />
              </div>

              <h3 className="text-base font-bold text-slate-800">
                Arraste seus arquivos PDF ou planilhas Excel aqui
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md text-center">
                Formatos aceitos: <strong>PDF (.pdf)</strong>, <strong>Excel (.xlsx, .xls)</strong>{' '}
                e <strong>CSV</strong>. Você pode enviar vários arquivos de uma só vez.
              </p>

              <Button
                type="button"
                variant="outline"
                className="mt-6 border-blue-200 text-blue-700 bg-white hover:bg-blue-50 shadow-sm text-xs font-semibold"
              >
                <Upload className="w-3.5 h-3.5 mr-2 text-blue-600" />
                Procurar Arquivos no Computador
              </Button>
            </div>

            {/* Barra de Progresso Durante a Extração */}
            {isProcessing && (
              <div className="mt-6 p-5 bg-blue-50/80 border border-blue-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />
                    <div>
                      <p className="text-xs font-bold text-blue-950">
                        Processando despesas com inteligência...
                      </p>
                      <p className="text-[11px] text-blue-700 truncate max-w-sm">
                        Lendo: {processingCurrentFile || 'Arquivos...'}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-bold text-blue-800">
                    {processingProgress}%
                  </span>
                </div>
                <div className="w-full bg-blue-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${processingProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Dicas e Instruções do Fluxo */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-600">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex gap-2.5">
                <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0">
                  1
                </div>
                <div>
                  <strong className="text-slate-800 block">Extração Automática</strong>
                  A IA lê faturas e extratos, separando data, valor e fornecedores.
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex gap-2.5">
                <div className="w-6 h-6 rounded-lg bg-purple-100 text-purple-700 font-bold flex items-center justify-center shrink-0">
                  2
                </div>
                <div>
                  <strong className="text-slate-800 block">Memória de Fornecedores</strong>
                  Lembrança automática de contas associadas em importações anteriores.
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex gap-2.5">
                <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center shrink-0">
                  3
                </div>
                <div>
                  <strong className="text-slate-800 block">Reprocessamento & Relatório</strong>
                  Reprocesse pendentes sem novo upload e gere laudo de conferência em PDF A4.
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* ETAPA 2: REVISÃO INTERATIVA, CADASTRO NO PLANO E CONFIRMAÇÃO              */}
      {/* ========================================================================= */}
      {step === 'revisao' && (
        <div className="space-y-6">
          {/* Barra Superior de Métricas e Ações em Destaque */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Card className="bg-white border-slate-200 shadow-xs">
              <CardContent className="py-3 px-4 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-semibold text-slate-500 uppercase">
                    Total de Despesas
                  </p>
                  <p className="text-xl font-bold text-slate-900 mt-0.5">{totalDespesasCount}</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <FileText className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border-slate-200 shadow-xs">
              <CardContent className="py-3 px-4 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-semibold text-slate-500 uppercase">
                    Valor Total Extraído
                  </p>
                  <p className="text-xl font-bold text-emerald-700 mt-0.5">
                    {formatMoeda(totalDespesasValor)}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <DollarSign className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border-slate-200 shadow-xs">
              <CardContent className="py-3 px-4 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-semibold text-slate-500 uppercase">
                    No Plano de Contas
                  </p>
                  <p className="text-xl font-bold text-emerald-600 mt-0.5">
                    {cadastradasCount}{' '}
                    <span className="text-xs font-normal text-slate-400">
                      (
                      {totalDespesasCount > 0
                        ? Math.round((cadastradasCount / totalDespesasCount) * 100)
                        : 0}
                      %)
                    </span>
                  </p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border-slate-200 shadow-xs">
              <CardContent className="py-3 px-4 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-semibold text-slate-500 uppercase">
                    Não Cadastradas
                  </p>
                  <p className="text-xl font-bold text-amber-600 mt-0.5">{naoCadastradasCount}</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <AlertCircle className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Destaque de Memória de Fornecedores Recorrentes */}
          {memoriaCount > 0 && (
            <div className="p-3.5 bg-purple-50/90 border border-purple-200 rounded-xl flex items-center justify-between gap-3 text-xs text-purple-950">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-purple-200 text-purple-800 flex items-center justify-center shrink-0 font-bold">
                  <History className="w-4 h-4" />
                </div>
                <div>
                  <strong className="text-purple-900 block">
                    Memória de Fornecedores Recorrentes Ativa
                  </strong>
                  <span>
                    <strong>{memoriaCount} despesa(s)</strong> foram vinculadas automaticamente com
                    base no seu histórico de importações anteriores.
                  </span>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFiltroStatus(filtroStatus === 'memoria' ? 'todos' : 'memoria')}
                className="h-7 text-[11px] bg-white border-purple-300 text-purple-800 hover:bg-purple-100 font-semibold shrink-0"
              >
                {filtroStatus === 'memoria' ? 'Mostrar Todas' : 'Filtrar Lembretes de Memória'}
              </Button>
            </div>
          )}

          {/* Banner de Baixa Confiança: vínculos incertos que merecem revisão manual */}
          {baixaConfiancaCount > 0 && (
            <div className="p-4 bg-amber-100/70 border border-amber-300 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-amber-950">
                    {baixaConfiancaCount} despesa(s) com vínculo de baixa confiança
                  </p>
                  <p className="text-[11px] text-amber-800 mt-0.5">
                    A IA não encontrou correspondência sólida (histórico, código ou similaridade).
                    Revise estas linhas antes de importar — elas estão destacadas em âmbar na
                    tabela.
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFiltroStatus(filtroStatus === 'baixa' ? 'todos' : 'baixa')}
                className="h-7 text-[11px] bg-white border-amber-400 text-amber-900 hover:bg-amber-200 font-semibold shrink-0"
              >
                {filtroStatus === 'baixa' ? 'Mostrar Todas' : 'Filtrar Baixa Confiança'}
              </Button>
            </div>
          )}

          {/* Banner de Ação se houver contas NÃO CADASTRADAS + Botão de Reprocessar */}
          {naoCadastradasCount > 0 && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-amber-950">
                    Atenção: Existem {naoCadastradasCount} despesa(s) sem conta correspondente no
                    Plano de Contas
                  </p>
                  <p className="text-[11px] text-amber-800 mt-0.5">
                    Você pode cadastrar novas contas ou reprocessar apenas as despesas não
                    classificadas sem precisar reenviar o arquivo.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleReprocessarNaoClassificadas}
                  disabled={isReprocessing}
                  className="bg-white border-amber-300 text-amber-900 hover:bg-amber-100 font-semibold text-xs h-8 shadow-xs gap-1.5"
                  title="Reexecuta a classificação apenas sobre as despesas pendentes mantendo as já resolvidas"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 text-amber-700 ${isReprocessing ? 'animate-spin' : ''}`}
                  />
                  {isReprocessing ? 'Reprocessando...' : 'Reprocessar Não Classificadas'}
                </Button>

                <Button
                  size="sm"
                  onClick={() => {
                    setLoteCentroId(centros.length > 0 ? centros[0].id : '')
                    setLoteTipoDespesaId(tiposDespesas.length > 0 ? tiposDespesas[0].id : '')
                    setModalCadastroLoteOpen(true)
                  }}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs h-8 shadow-xs gap-1.5"
                >
                  <FolderPlus className="w-3.5 h-3.5" />
                  Cadastrar Todas no Plano
                </Button>
              </div>
            </div>
          )}

          {/* Acordeão de Resumo Agrupado por Categoria */}
          <Card className="bg-white border-slate-200 shadow-xs">
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="grupos" className="border-none">
                <AccordionTrigger className="px-5 py-3 hover:no-underline">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                    <Layers className="w-4 h-4 text-blue-600" />
                    Resumo Agrupado por Categoria de Despesa ({gruposPorCategoria.length}{' '}
                    categorias)
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-5 pb-4 pt-1">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {gruposPorCategoria.map((g) => (
                      <div
                        key={g.categoria}
                        className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className="text-xs font-bold text-slate-800 truncate"
                            title={g.categoria}
                          >
                            {g.categoria}
                          </span>
                          <Badge variant="outline" className="text-[10px] bg-white text-slate-600">
                            {g.quantidade} item(s)
                          </Badge>
                        </div>
                        <p className="text-sm font-bold text-emerald-700 font-mono">
                          {formatMoeda(g.totalValor)}
                        </p>
                        <div className="flex items-center gap-2 text-[10px] text-slate-500 pt-1 border-t border-slate-200/60">
                          <span className="text-emerald-600 font-semibold">
                            ✓ {g.cadastradasCount} cadastradas
                          </span>
                          {g.naoCadastradasCount > 0 && (
                            <span className="text-amber-600 font-semibold">
                              ⚠️ {g.naoCadastradasCount} novas
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </Card>

          {/* Controle global de Mês/Data do Lançamento (aplicado a todas as linhas) */}
          <Card className="bg-white border-blue-200 shadow-xs">
            <CardContent className="py-3 px-4 flex flex-col lg:flex-row lg:items-center gap-3">
              <div className="flex items-center gap-2.5 min-w-[230px]">
                <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900">Mês / Data do Lançamento</p>
                  <p className="text-[10px] text-slate-500">
                    Escolha uma vez e aplique a todas as linhas extraídas.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 flex-1">
                <Select value={mesLancamentoSelecionado} onValueChange={handleMesGlobalChange}>
                  <SelectTrigger className="h-8 text-xs bg-white w-40">
                    <SelectValue placeholder="Mês/competência" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {opcoesMesGlobal.map((mes) => {
                      const [ano, m] = mes.split('-')
                      return (
                        <SelectItem key={mes} value={mes} className="text-xs">
                          {MESES_PTBR[Number(m) - 1]}/{ano} · competência
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>

                <Input
                  type="date"
                  value={dataLancamentoGlobal}
                  onChange={(e) => handleDataGlobalChange(e.target.value)}
                  className="h-8 text-xs bg-white w-40"
                />

                <Button
                  size="sm"
                  onClick={aplicarDataGlobalLinhas}
                  disabled={despesas.length === 0}
                  className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold gap-1.5"
                  title="Aplica a data escolhida a todas as linhas extraídas (os lançamentos serão gravados com ela)"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  Aplicar a todas as linhas
                </Button>

                {dataGlobalAplicada && (
                  <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-300 hover:bg-emerald-100 text-[10px] font-bold gap-1 h-6">
                    <Lock className="w-3 h-3 text-emerald-700" />
                    Data travada: {dataGlobalAplicada.split('-').reverse().join('/')}
                    <button
                      type="button"
                      onClick={removerDataGlobal}
                      className="ml-0.5 text-emerald-700 hover:text-emerald-900"
                      title="Destravar data (linhas voltam a seguir a data extraída)"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Tabela (esquerda) + Painel do Plano de Contas com digitação (direita) */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-start">
            {/* Card Principal da Tabela de Despesas */}
            <Card className="bg-white border-slate-200 shadow-xs xl:col-span-2">
              <CardHeader className="pb-3 border-b border-slate-100">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <SlidersHorizontal className="w-4 h-4 text-blue-600" />
                      Revisão das Despesas Extraídas ({despesasFiltradas.length} de{' '}
                      {despesas.length})
                    </CardTitle>
                    <CardDescription className="text-xs mt-0.5">
                      Revise cada lançamento, edite valores se necessário, vincule ao Plano de
                      Contas e selecione o que gravar.
                    </CardDescription>
                  </div>

                  {/* Filtros e Ações da Tabela */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="w-44">
                      <Input
                        placeholder="Buscar despesa, conta..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="h-8 text-xs bg-white"
                      />
                    </div>

                    <Select value={filtroStatus} onValueChange={(val: any) => setFiltroStatus(val)}>
                      <SelectTrigger className="h-8 text-xs bg-white w-36">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos" className="text-xs">
                          Todos os Status
                        </SelectItem>
                        <SelectItem
                          value="cadastradas"
                          className="text-xs text-emerald-700 font-medium"
                        >
                          Cadastradas
                        </SelectItem>
                        <SelectItem
                          value="nao_cadastradas"
                          className="text-xs text-amber-700 font-medium"
                        >
                          Não Cadastradas
                        </SelectItem>
                        <SelectItem value="memoria" className="text-xs text-purple-700 font-medium">
                          Memória Recorrente
                        </SelectItem>
                        <SelectItem value="baixa" className="text-xs text-amber-700 font-medium">
                          Baixa Confiança
                        </SelectItem>
                      </SelectContent>
                    </Select>

                    <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
                      <SelectTrigger className="h-8 text-xs bg-white w-40">
                        <SelectValue placeholder="Categoria" />
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
                        <SelectItem value="todas" className="text-xs">
                          Todas as Categorias
                        </SelectItem>
                        {categoriasUnicas.map((cat) => (
                          <SelectItem key={cat} value={cat} className="text-xs">
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Botão Reprocessar Apenas Não Classificadas */}
                    {naoCadastradasCount > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleReprocessarNaoClassificadas}
                        disabled={isReprocessing}
                        className="h-8 text-xs gap-1.5 bg-amber-50/70 border-amber-300 text-amber-900 hover:bg-amber-100 font-semibold"
                        title="Reprocessar apenas despesas não classificadas"
                      >
                        <RefreshCw
                          className={`w-3.5 h-3.5 text-amber-700 ${isReprocessing ? 'animate-spin' : ''}`}
                        />
                        Reprocessar ({naoCadastradasCount})
                      </Button>
                    )}

                    {/* Botão Relatório de Conferência em PDF */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setModalRelatorioOpen(true)}
                      className="h-8 text-xs gap-1.5 bg-slate-50 text-slate-800 hover:bg-slate-100 border-slate-300 font-semibold"
                      title="Visualizar e Imprimir Relatório de Conferência A4 em PDF"
                    >
                      <Printer className="w-3.5 h-3.5 text-blue-700" />
                      Relatório PDF
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowAiHelper(!showAiHelper)}
                      className={`h-8 text-xs gap-1.5 ${
                        showAiHelper ? 'bg-blue-50 text-blue-700 border-blue-300' : 'bg-white'
                      }`}
                    >
                      <Bot className="w-3.5 h-3.5 text-blue-600" />
                      Consultar IA
                    </Button>
                  </div>
                </div>
              </CardHeader>

              {/* Painel do Assistente de IA de Suporte */}
              {showAiHelper && (
                <div className="p-4 bg-slate-900 text-white border-b border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-blue-300">
                      <Bot className="w-4 h-4 text-blue-400" />
                      Agente Especialista em Despesas · Consulta em Tempo Real
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowAiHelper(false)}
                      className="h-6 w-6 p-0 text-slate-400 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Ex: Como devo classificar a despesa de Google Ads? Qual centro de custo é mais adequado?"
                      value={aiAnalysisPrompt}
                      onChange={(e) => setAiAnalysisPrompt(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleConsultarAgente()}
                      className="h-8 text-xs bg-slate-800 border-slate-700 text-white placeholder:text-slate-400"
                    />
                    <Button
                      size="sm"
                      disabled={isAiLoading || !aiAnalysisPrompt.trim()}
                      onClick={handleConsultarAgente}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-8 px-3 shrink-0"
                    >
                      {isAiLoading ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        'Perguntar'
                      )}
                    </Button>
                  </div>
                  {aiResponse && (
                    <div className="p-3 bg-slate-800/80 rounded-lg text-xs text-slate-200 leading-relaxed border border-slate-700">
                      <p className="font-semibold text-blue-300 mb-1">Resposta do Agente:</p>
                      <div className="whitespace-pre-wrap">{aiResponse}</div>
                    </div>
                  )}
                </div>
              )}

              <CardContent className="p-0">
                {despesasFiltradas.length === 0 ? (
                  <div className="py-12 text-center text-slate-500">
                    <HelpCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm font-semibold">
                      Nenhuma despesa encontrada com os filtros selecionados.
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Tente limpar a busca ou mudar o filtro de status.
                    </p>
                  </div>
                ) : (
                  <div>
                    {/* Barra de rolagem horizontal sincronizada no topo da tabela */}
                    <div
                      ref={scrollBarraTopoRef}
                      onScroll={handleScrollBarraParaTabela}
                      className="overflow-x-scroll overflow-y-hidden h-3 cursor-pointer border-b border-slate-200 bg-slate-50/80 [scrollbar-width:thin] [&::-webkit-scrollbar]:h-2.5 [&::-webkit-scrollbar-track]:bg-slate-100 [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-thumb]:rounded-full"
                      title="Barra de rolagem horizontal sincronizada com a tabela"
                    >
                      <div
                        style={{
                          width: tabelaScrollWidth ? `${tabelaScrollWidth}px` : '100%',
                          height: '1px',
                        }}
                      />
                    </div>
                    <div
                      ref={tabelaScrollContainerRef}
                      onScroll={handleScrollTabelaParaBarra}
                      className="overflow-x-auto"
                    >
                      <table ref={tabelaElRef} className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-600 font-semibold">
                            <th className="py-3 px-3 w-10 text-center">
                              <input
                                type="checkbox"
                                checked={
                                  despesasFiltradas.length > 0 &&
                                  despesasFiltradas.every((d) => d.selecionada)
                                }
                                onChange={(e) => handleToggleSelectAll(e.target.checked)}
                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              />
                            </th>
                            <th className="py-3 px-3 w-24">Data</th>
                            <th className="py-3 px-3 min-w-[200px]">Descrição / Fornecedor</th>
                            <th className="py-3 px-3 min-w-[140px]">Categoria Sugerida</th>
                            <th className="py-3 px-3 text-right w-28">Valor (R$)</th>
                            <th className="py-3 px-3 min-w-[220px]">Status no Plano de Contas</th>
                            <th className="py-3 px-3 min-w-[150px]">Origem / Sugestão</th>
                            <th className="py-3 px-3 text-right w-20">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {despesasFiltradas.map((item) => {
                            const isEditing = editingItemId === item.id

                            return (
                              <tr
                                key={item.id}
                                className={`transition-colors align-top ${
                                  !item.selecionada ? 'opacity-50 bg-slate-50/40' : ''
                                } ${!item.isCadastrada ? 'bg-amber-50/20' : ''} ${
                                  item.matchConfidence === 'memoria' ? 'bg-purple-50/20' : ''
                                } ${
                                  item.matchConfidence === 'baixa' ||
                                  item.matchConfidence === 'nenhuma'
                                    ? 'bg-amber-100/60 border-l-4 border-amber-400'
                                    : ''
                                } ${
                                  item.matchConfidence === 'baixa' ||
                                  item.matchConfidence === 'nenhuma'
                                    ? 'hover:bg-amber-100'
                                    : 'hover:bg-slate-50/80'
                                } ${
                                  despesaSelecionadaId === item.id
                                    ? 'ring-1 ring-inset ring-blue-500 bg-blue-50/70'
                                    : ''
                                }`}
                              >
                                {/* Checkbox de seleção */}
                                <td className="py-3 px-3 text-center">
                                  <input
                                    type="checkbox"
                                    checked={item.selecionada}
                                    onChange={() => handleToggleSelectItem(item.id)}
                                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                  />
                                </td>

                                {/* Data */}
                                <td className="py-3 px-3 whitespace-nowrap">
                                  {isEditing ? (
                                    <Input
                                      type="date"
                                      value={editData}
                                      onChange={(e) => setEditData(e.target.value)}
                                      className="h-7 text-xs p-1"
                                    />
                                  ) : (
                                    <span className="text-slate-700 font-medium font-mono">
                                      {item.data.split('-').reverse().join('/')}
                                    </span>
                                  )}
                                </td>

                                {/* Descrição (clique seleciona a linha para vínculo no painel direito) */}
                                <td
                                  className="py-3 px-3 cursor-pointer"
                                  onClick={() =>
                                    setDespesaSelecionadaId(
                                      despesaSelecionadaId === item.id ? null : item.id,
                                    )
                                  }
                                  title="Clique para selecionar esta despesa e vincular uma conta pelo painel do Plano de Contas"
                                >
                                  {isEditing ? (
                                    <Input
                                      value={editDescricao}
                                      onChange={(e) => setEditDescricao(e.target.value)}
                                      className="h-7 text-xs p-1"
                                    />
                                  ) : (
                                    <div>
                                      <p
                                        className="font-semibold text-slate-900"
                                        title={item.descricao}
                                      >
                                        {item.descricao}
                                      </p>
                                      <p className="text-[10px] text-slate-400 mt-0.5">
                                        Origem: {item.sourceFile} · {item.pageOrRowInfo}
                                      </p>
                                    </div>
                                  )}
                                </td>

                                {/* Categoria Sugerida */}
                                <td className="py-3 px-3">
                                  <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                    {item.categoriaSugerida}
                                  </span>
                                </td>

                                {/* Valor */}
                                <td className="py-3 px-3 text-right whitespace-nowrap">
                                  {isEditing ? (
                                    <Input
                                      type="number"
                                      step="0.01"
                                      value={editValor}
                                      onChange={(e) =>
                                        setEditValor(parseFloat(e.target.value) || 0)
                                      }
                                      className="h-7 text-xs text-right p-1 font-mono font-bold"
                                    />
                                  ) : (
                                    <span className="font-bold text-slate-900 font-mono">
                                      {formatMoeda(item.valor)}
                                    </span>
                                  )}
                                </td>

                                {/* Status no Plano de Contas */}
                                <td className="py-3 px-3">
                                  {isEditing ? (
                                    <Select value={editPlanoId} onValueChange={setEditPlanoId}>
                                      <SelectTrigger className="h-7 text-xs bg-white">
                                        <SelectValue placeholder="Vincular Plano de Contas" />
                                      </SelectTrigger>
                                      <SelectContent className="max-h-60 max-w-[360px]">
                                        {planoContas.map((pc) => (
                                          <SelectItem key={pc.id} value={pc.id} className="text-xs">
                                            {pc.codigo} | {pc.expand?.conta?.nome} (
                                            {pc.expand?.centro?.nome})
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  ) : item.isCadastrada ? (
                                    <div className="space-y-0.5">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border border-emerald-300 text-[10px] font-bold px-1.5 py-0">
                                          <Check className="w-2.5 h-2.5 mr-1" />
                                          Encontrada no Plano
                                        </Badge>
                                        <span className="font-mono text-[10px] text-blue-700 font-bold bg-blue-50 px-1 py-0.2 rounded border border-blue-200">
                                          {item.planoContaCodigo || 'PC-???'}
                                        </span>
                                      </div>
                                      <p
                                        className="text-[11px] text-slate-700 font-medium truncate max-w-[220px]"
                                        title={item.planoContaNome}
                                      >
                                        {item.planoContaNome}
                                      </p>
                                    </div>
                                  ) : (
                                    <div className="space-y-1">
                                      <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border border-amber-300 text-[10px] font-bold px-1.5 py-0">
                                        <AlertCircle className="w-2.5 h-2.5 mr-1 text-amber-600" />
                                        Não cadastrada
                                      </Badge>
                                      <div>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => handleOpenCadastro(item)}
                                          className="h-6 text-[10px] px-2 bg-white text-amber-800 border-amber-300 hover:bg-amber-50 font-semibold gap-1"
                                        >
                                          <Plus className="w-2.5 h-2.5" />
                                          Cadastrar no Plano
                                        </Button>
                                      </div>
                                    </div>
                                  )}
                                </td>

                                {/* Origem da Sugestão / Memória */}
                                <td className="py-3 px-3">
                                  {item.matchConfidence === 'codigo_empresa' ? (
                                    <div className="space-y-0.5">
                                      <Badge className="bg-emerald-100 text-emerald-900 border-emerald-300 hover:bg-emerald-100 text-[9px] font-bold gap-1">
                                        <Check className="w-2.5 h-2.5 text-emerald-700" />
                                        Código da Empresa
                                      </Badge>
                                      <p className="text-[10px] text-emerald-700 leading-tight">
                                        {item.origemSugestao || 'casado por código da empresa'}
                                      </p>
                                    </div>
                                  ) : item.matchConfidence === 'memoria' ? (
                                    <div className="space-y-0.5">
                                      <Badge className="bg-purple-100 text-purple-900 border-purple-300 hover:bg-purple-100 text-[9px] font-bold gap-1">
                                        <History className="w-2.5 h-2.5 text-purple-700" />
                                        Memória Recorrente
                                      </Badge>
                                      <p className="text-[10px] text-purple-700 leading-tight">
                                        Baseado em importações anteriores
                                      </p>
                                    </div>
                                  ) : item.matchConfidence === 'baixa' ||
                                    item.matchConfidence === 'nenhuma' ? (
                                    <div className="space-y-0.5">
                                      <Badge className="bg-amber-200 text-amber-900 border-amber-400 hover:bg-amber-200 text-[9px] font-bold gap-1">
                                        <AlertCircle className="w-2.5 h-2.5 text-amber-700" />
                                        Confiança baixa — revisar
                                      </Badge>
                                      <p className="text-[10px] text-amber-800 leading-tight">
                                        {item.origemSugestao ||
                                          'Vínculo incerto: confirme ou ajuste manualmente'}
                                      </p>
                                    </div>
                                  ) : item.origemSugestao ? (
                                    <span className="text-[10px] text-slate-500 leading-tight block">
                                      {item.origemSugestao}
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-slate-400">
                                      Classificação IA
                                    </span>
                                  )}
                                </td>

                                {/* Ações */}
                                <td className="py-3 px-3 text-right whitespace-nowrap">
                                  {isEditing ? (
                                    <div className="flex items-center justify-end gap-1">
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleSaveEdit(item.id)}
                                        className="h-7 w-7 p-0 text-emerald-600 hover:bg-emerald-50"
                                        title="Salvar alterações"
                                      >
                                        <Check className="w-3.5 h-3.5" />
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={handleCancelEdit}
                                        className="h-7 w-7 p-0 text-slate-500 hover:bg-slate-100"
                                        title="Cancelar"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                      </Button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center justify-end gap-1">
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleStartEdit(item)}
                                        className="h-7 w-7 p-0 text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                                        title="Editar despesa"
                                      >
                                        <Edit2 className="w-3.5 h-3.5" />
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleRemoveItem(item.id)}
                                        className="h-7 w-7 p-0 text-slate-500 hover:text-rose-600 hover:bg-rose-50"
                                        title="Remover da lista"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </Button>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>

                        {/* Rodapé Totalizador */}
                        <tfoot>
                          <tr className="border-t-2 border-slate-200 bg-slate-50 font-bold text-slate-800">
                            <td colSpan={4} className="py-3 px-3 text-xs">
                              Total Selecionado para Lançamento ({selecionadasCount} despesa
                              {selecionadasCount !== 1 ? 's' : ''})
                            </td>
                            <td className="py-3 px-3 text-right text-xs font-mono text-emerald-700">
                              {formatMoeda(selecionadasValor)}
                            </td>
                            <td colSpan={3} className="py-3 px-3 text-slate-500 text-[11px]">
                              {memoriaCount > 0 && (
                                <span className="text-purple-700 mr-2">
                                  🧠 {memoriaCount} lembrada(s)
                                </span>
                              )}
                              {naoCadastradasCount > 0 && (
                                <span className="text-amber-700">
                                  ⚠️ {naoCadastradasCount} pendente(s)
                                </span>
                              )}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}
              </CardContent>

              {/* Rodapé com Botão Principal de Geração de Lançamentos e Relatório */}
              <div className="p-4 bg-slate-50/90 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setStep('upload')}
                    className="text-xs bg-white"
                  >
                    ← Carregar Outros Arquivos
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setModalRelatorioOpen(true)}
                    className="text-xs bg-white text-slate-700 border-slate-300 gap-1.5"
                  >
                    <FileText className="w-3.5 h-3.5 text-blue-600" />
                    Visualizar Relatório de Conferência (PDF)
                  </Button>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right hidden sm:block">
                    <p className="text-xs font-semibold text-slate-700">
                      {selecionadasCount} lançamento(s) prontos para{' '}
                      <strong>{empresaSelecionada?.nome || 'Empresa'}</strong>
                    </p>
                    <p className="text-[11px] text-emerald-700 font-bold">
                      Total: {formatMoeda(selecionadasValor)}
                    </p>
                  </div>

                  <Button
                    onClick={handleGerarLancamentos}
                    disabled={isGeneratingLancamentos || selecionadasCount === 0}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-9 px-5 shadow-sm gap-2"
                  >
                    {isGeneratingLancamentos ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Gravando lançamentos...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        Gerar Lançamentos em Lançamentos Rápidos
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </Card>

            {/* =================================================================== */}
            {/* PAINEL DIREITO: Plano de Contas com vínculo por digitação           */}
            {/* =================================================================== */}
            <Card className="bg-white border-slate-200 shadow-xs xl:sticky xl:top-4">
              <CardHeader className="pb-3 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-indigo-600" />
                    Plano de Contas
                  </CardTitle>
                  <Badge variant="outline" className="text-[10px] font-mono text-slate-600">
                    {planoContasPainelFiltrado.length}/{planoContas.length}
                  </Badge>
                </div>
                <CardDescription className="text-xs mt-0.5">
                  Digite o código ou nome da conta (sem acentos) e clique nela para vincular à
                  despesa selecionada.
                </CardDescription>

                {/* Despesa atualmente selecionada na tabela */}
                <div
                  className={`mt-2 p-2 rounded-lg border text-xs ${
                    despesaSelecionada
                      ? 'bg-blue-50 border-blue-200'
                      : 'bg-slate-50 border-slate-200 flex items-center gap-1.5 text-slate-500'
                  }`}
                >
                  {despesaSelecionada ? (
                    <>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 block">
                        Despesa selecionada:
                      </span>
                      <p
                        className="font-semibold text-blue-950 truncate"
                        title={despesaSelecionada.descricao}
                      >
                        {despesaSelecionada.descricao}
                      </p>
                      <p className="text-[10px] text-blue-700 mt-0.5">
                        {despesaSelecionada.isCadastrada
                          ? `Vinculada a: ${despesaSelecionada.planoContaCodigo || '—'} ${
                              despesaSelecionada.planoContaNome || ''
                            }`
                          : 'Sem vínculo no Plano de Contas'}
                      </p>
                    </>
                  ) : (
                    <>
                      <MousePointerClick className="w-3.5 h-3.5 shrink-0" />
                      Clique na descrição de uma linha da tabela para selecionar a despesa.
                    </>
                  )}
                </div>

                {/* Campo de digitação da conta (busca ignora acentos) */}
                <div className="relative mt-2">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input
                    placeholder="Digitar código ou nome da conta..."
                    value={buscaContaPainel}
                    onChange={(e) => setBuscaContaPainel(e.target.value)}
                    className="pl-8 h-8 text-xs bg-slate-50 pr-8"
                  />
                  {buscaContaPainel && (
                    <button
                      type="button"
                      onClick={() => setBuscaContaPainel('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      title="Limpar busca"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </CardHeader>

              <CardContent className="p-2">
                {planoContasPainelFiltrado.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-xs">
                    Nenhuma conta localizada para "{buscaContaPainel}".
                  </div>
                ) : (
                  <div className="max-h-[420px] overflow-y-auto pr-1 divide-y divide-slate-100">
                    {planoContasPainelFiltrado.map((pc) => {
                      const nomeConta = pc.expand?.conta?.nome || 'Conta'
                      const codEmp = pc.codigo_empresa ? `[${pc.codigo_empresa}]` : ''
                      const centroNome = pc.expand?.centro?.nome || ''
                      const isVinculadaAtual = despesaSelecionada?.planoContaId === pc.id

                      return (
                        <button
                          key={pc.id}
                          type="button"
                          onClick={() => handleVincularContaDigitada(pc)}
                          className={`w-full text-left px-2.5 py-2 flex items-center justify-between gap-2 text-xs transition-colors ${
                            isVinculadaAtual ? 'bg-emerald-50' : 'hover:bg-blue-50'
                          }`}
                          title={`Vincular ${pc.codigo || ''} ${nomeConta} à despesa selecionada`}
                        >
                          <span className="flex items-center gap-2 min-w-0">
                            <span className="font-mono text-[11px] text-slate-500 shrink-0">
                              {pc.codigo || '—'} {codEmp}
                            </span>
                            <span className="truncate font-medium text-slate-700" title={nomeConta}>
                              {nomeConta}
                            </span>
                          </span>
                          <span className="flex items-center gap-1 shrink-0">
                            {centroNome && (
                              <span className="text-[9px] text-slate-400 truncate max-w-[90px]">
                                {centroNome}
                              </span>
                            )}
                            {isVinculadaAtual ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <ArrowRight className="w-3.5 h-3.5 text-slate-300" />
                            )}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ETAPA 3: RESUMO DE SUCESSO E ATALHO PARA LANÇAMENTOS                      */}
      {/* ========================================================================= */}
      {step === 'sucesso' && generationSummary && (
        <Card className="bg-white border-emerald-200 shadow-md">
          <CardContent className="py-10 px-6 text-center max-w-2xl mx-auto space-y-6">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div className="space-y-1">
              <h2 className="text-2xl font-bold text-slate-900">
                Lançamentos Gerados com Sucesso!
              </h2>
              <p className="text-sm text-slate-600">
                As despesas foram devidamente processadas, vinculadas ao Plano de Contas e
                registradas no módulo financeiro.
              </p>
            </div>

            {/* Card de Resumo Estatístico */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200 text-left">
              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase">Empresa</p>
                <p className="text-sm font-bold text-slate-800 truncate">
                  {generationSummary.empresaNome}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase">
                  Lançamentos Criados
                </p>
                <p className="text-base font-bold text-blue-600 font-mono">
                  {generationSummary.lancamentosCount}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase">
                  Valor Total Gravado
                </p>
                <p className="text-base font-bold text-emerald-700 font-mono">
                  {formatMoeda(generationSummary.totalValor)}
                </p>
              </div>
            </div>

            {/* Botões de Ação Final */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <Button
                onClick={() => setModalRelatorioOpen(true)}
                variant="outline"
                className="text-xs h-10 px-5 gap-2 border-blue-200 text-blue-800 bg-blue-50/50 hover:bg-blue-100 w-full sm:w-auto font-semibold"
              >
                <Printer className="w-4 h-4 text-blue-600" />
                Imprimir Relatório de Conferência (PDF)
              </Button>

              <Button
                onClick={() => navigate('/lancamentos')}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs h-10 px-6 shadow-sm gap-2 w-full sm:w-auto"
              >
                <ExternalLink className="w-4 h-4" />
                Ir para Lançamentos Rápidos
              </Button>

              <Button
                variant="outline"
                onClick={() => {
                  setDespesas([])
                  setUploadedFiles([])
                  setNovasContasCriadas([])
                  setStep('upload')
                }}
                className="text-xs h-10 px-5 w-full sm:w-auto"
              >
                Importar Novo Arquivo
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CADASTRO INDIVIDUAL NO PLANO DE CONTAS                             */}
      {/* ========================================================================= */}
      <Dialog open={modalCadastroOpen} onOpenChange={setModalCadastroOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <FolderPlus className="w-4 h-4 text-blue-600" />
              Cadastrar Conta no Plano de Contas
            </DialogTitle>
            <DialogDescription className="text-xs">
              Cria uma nova Conta Contábil e a vincula ao Plano de Contas associando ao Centro de
              Custo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-100 text-xs text-blue-900">
              <p className="font-semibold">Despesa de Origem:</p>
              <p className="truncate mt-0.5">{cadastroItem?.descricao}</p>
              <p className="text-[11px] text-blue-700 font-mono mt-1 font-bold">
                Valor: {formatMoeda(cadastroItem?.valor)}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">
                Nome da Conta no Plano *
              </Label>
              <Input
                value={novoNomeConta}
                onChange={(e) => setNovoNomeConta(e.target.value)}
                placeholder="Ex: Assinatura de Software - ChatGPT"
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Centro de Custo *</Label>
              <Select value={novoCentroId} onValueChange={setNovoCentroId}>
                <SelectTrigger className="text-xs bg-white">
                  <SelectValue placeholder="Selecione o Centro de Custo" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {centros.map((c) => (
                    <SelectItem key={c.id} value={c.id} className="text-xs">
                      {c.codigo || 'CC'} - {c.nome} ({c.tipo})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">
                Tipo de Despesa (Opcional)
              </Label>
              <Select value={novoTipoDespesaId} onValueChange={setNovoTipoDespesaId}>
                <SelectTrigger className="text-xs bg-white">
                  <SelectValue placeholder="Selecione o Tipo de Despesa" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {tiposDespesas.map((t) => (
                    <SelectItem key={t.id} value={t.id} className="text-xs">
                      {t.codigo || 'TD'} - {t.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setModalCadastroOpen(false)}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              disabled={isCadastrandoConta || !novoNomeConta.trim() || !novoCentroId}
              onClick={handleConfirmarCadastroConta}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs"
            >
              {isCadastrandoConta ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" />
              ) : null}
              Confirmar Cadastro
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL: CADASTRO EM LOTE NO PLANO DE CONTAS                                */}
      {/* ========================================================================= */}
      <Dialog open={modalCadastroLoteOpen} onOpenChange={setModalCadastroLoteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <FolderPlus className="w-4 h-4 text-amber-600" />
              Cadastrar Todas as Novas Contas no Plano
            </DialogTitle>
            <DialogDescription className="text-xs">
              Serão criadas {naoCadastradas.length} contas contábeis no Plano de Contas
              automaticamente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900">
              <p className="font-semibold">Resumo do lote:</p>
              <p className="mt-0.5">
                {naoCadastradas.length} despesa(s) serão vinculadas aos novos cadastros.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">
                Centro de Custo Padrão *
              </Label>
              <Select value={loteCentroId} onValueChange={setLoteCentroId}>
                <SelectTrigger className="text-xs bg-white">
                  <SelectValue placeholder="Selecione o Centro de Custo" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {centros.map((c) => (
                    <SelectItem key={c.id} value={c.id} className="text-xs">
                      {c.codigo || 'CC'} - {c.nome} ({c.tipo})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">
                Tipo de Despesa Padrão (Opcional)
              </Label>
              <Select value={loteTipoDespesaId} onValueChange={setLoteTipoDespesaId}>
                <SelectTrigger className="text-xs bg-white">
                  <SelectValue placeholder="Selecione o Tipo de Despesa" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {tiposDespesas.map((t) => (
                    <SelectItem key={t.id} value={t.id} className="text-xs">
                      {t.codigo || 'TD'} - {t.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setModalCadastroLoteOpen(false)}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              disabled={isCadastrandoLote || !loteCentroId}
              onClick={handleConfirmarCadastroLote}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs"
            >
              {isCadastrandoLote ? <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
              Cadastrar em Lote
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL: RELATÓRIO DE CONFERÊNCIA DA IMPORTAÇÃO EM PDF A4                   */}
      {/* ========================================================================= */}
      <ModalRelatorioConferenciaDespesas
        open={modalRelatorioOpen}
        onOpenChange={setModalRelatorioOpen}
        empresa={empresaSelecionada}
        arquivosImportados={uploadedFiles.map((f) => ({
          name: f.name,
          size: f.size,
          type: f.type,
        }))}
        despesas={despesas}
        gruposCategoria={gruposPorCategoria}
        resumoLancamentos={generationSummary}
        novasContasCriadas={novasContasCriadas}
      />
    </div>
  )
}
