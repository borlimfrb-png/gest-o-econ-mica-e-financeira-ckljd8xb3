import React, { useState, useEffect, useRef } from 'react'

import {
  FileSpreadsheet,
  FileText,
  Upload,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Download,
  Trash2,
  RefreshCw,
  Plus,
  Edit2,
  Check,
  Eye,
  Building2,
  Calendar,
  DollarSign,
  HelpCircle,
  FileSearch,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { useToast } from '@/hooks/use-toast'
import { financeService } from '@/services/financeService'
import type {
  EmpresaRecord,
  PlanoContaRecord,
  CentroRecord,
  TipoDespesaRecord,
} from '@/types/finance'
import { extractTextFromPdf, type PdfExtractionResult } from '@/lib/pdfParser'
import {
  matchPdfCandidatesWithPlanoContas,
  formatPlanoContaDisplay,
  type MatchedItem,
} from '@/lib/pdfMatching'
import { ModalQuickRegisterConta } from '@/components/ModalQuickRegisterConta'
import { useNavigate } from 'react-router-dom'
import * as XLSX from 'xlsx'

export default function Importacao() {
  const { toast } = useToast()
  const navigate = useNavigate()

  // ----------------------------------------------------
  // Estados Compartilhados e Catálogos
  // ----------------------------------------------------
  const [empresas, setEmpresas] = useState<EmpresaRecord[]>([])
  const [planoContas, setPlanoContas] = useState<PlanoContaRecord[]>([])
  const [centros, setCentros] = useState<CentroRecord[]>([])
  const [tiposDespesas, setTiposDespesas] = useState<TipoDespesaRecord[]>([])
  const [loadingData, setLoadingData] = useState(true)

  // ----------------------------------------------------
  // Aba Excel (Estados)
  // ----------------------------------------------------
  const [excelEmpresaId, setExcelEmpresaId] = useState('')
  const [excelFile, setExcelFile] = useState<File | null>(null)
  const [excelParsedRows, setExcelParsedRows] = useState<
    Array<{
      codigo_pc?: string
      conta_nome?: string
      centro_nome?: string
      tipo_despesa_nome?: string
      data: string
      valor: number
      historico?: string
      recorrente?: boolean
      plano_conta_id?: string
      status: 'valido' | 'erro'
      erro_msg?: string
    }>
  >([])
  const [excelImporting, setExcelImporting] = useState(false)
  const [excelSuccess, setExcelSuccess] = useState(false)
  const [excelImportedCount, setExcelImportedCount] = useState(0)

  // ----------------------------------------------------
  // Aba PDF (Estados)
  // ----------------------------------------------------
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [pdfExtracting, setPdfExtracting] = useState(false)
  const [pdfProgress, setPdfProgress] = useState(0)
  const [pdfCurrentPage, setPdfCurrentPage] = useState(0)
  const [pdfTotalPages, setPdfTotalPages] = useState(0)
  const [pdfResult, setPdfResult] = useState<PdfExtractionResult | null>(null)
  const [pdfErrorDetail, setPdfErrorDetail] = useState<string | null>(null)
  const [matchedItems, setMatchedItems] = useState<MatchedItem[]>([])
  const [pdfActiveStep, setPdfActiveStep] = useState<1 | 2 | 3>(1)
  const [showRawTextPreview, setShowRawTextPreview] = useState(false)

  // Modal Cadastro Rápido de Conta não encontrada
  const [quickRegisterOpen, setQuickRegisterOpen] = useState(false)
  const [quickRegisterCandidateName, setQuickRegisterCandidateName] = useState('')
  const [quickRegisterItemId, setQuickRegisterItemId] = useState<string | null>(null)

  // Modal de Confirmação de Lançamentos
  const [confirmModalOpen, setConfirmModalOpen] = useState(false)
  const [targetEmpresaId, setTargetEmpresaId] = useState('')
  const [targetData, setTargetData] = useState(new Date().toISOString().split('T')[0])
  const [isSubmittingLancamentos, setIsSubmittingLancamentos] = useState(false)

  // Success summary modal / card
  const [createdLancamentosSummary, setCreatedLancamentosSummary] = useState<{
    count: number
    empresaNome: string
    dataRef: string
  } | null>(null)

  // Drag & Drop visual states
  const [isPdfDragOver, setIsPdfDragOver] = useState(false)
  const pdfInputRef = useRef<HTMLInputElement>(null)

  // ----------------------------------------------------
  // Carrega Catálogos Iniciais
  // ----------------------------------------------------
  const loadInitialCatalogs = async () => {
    setLoadingData(true)
    try {
      const [empRes, pcRes, ccRes, tdRes] = await Promise.all([
        financeService.getEmpresas(),
        financeService.getPlanoContas(),
        financeService.getCentros(),
        financeService.getTiposDespesas(),
      ])
      setEmpresas(empRes)
      setPlanoContas(pcRes)
      setCentros(ccRes)
      setTiposDespesas(tdRes)

      if (empRes.length > 0) {
        if (!excelEmpresaId) setExcelEmpresaId(empRes[0].id)
        if (!targetEmpresaId) setTargetEmpresaId(empRes[0].id)
      }
    } catch (err) {
      console.error('Erro ao carregar dados:', err)
      toast({
        title: 'Erro de carregamento',
        description: 'Não foi possível carregar empresas e plano de contas.',
        variant: 'destructive',
      })
    } finally {
      setLoadingData(false)
    }
  }

  useEffect(() => {
    loadInitialCatalogs()
  }, [])

  // ----------------------------------------------------
  // Handlers do PDF
  // ----------------------------------------------------
  const handlePdfFileSelect = async (file: File) => {
    if (!file) return

    // Validação de tipo
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      toast({
        title: 'Formato inválido',
        description: 'Por favor, selecione um arquivo no formato PDF (.pdf).',
        variant: 'destructive',
      })
      return
    }

    // Validação de tamanho (máximo 50MB)
    const MAX_SIZE_MB = 50
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      toast({
        title: 'Arquivo muito grande',
        description: `O arquivo excede o limite de ${MAX_SIZE_MB}MB.`,
        variant: 'destructive',
      })
      return
    }

    setPdfFile(file)
    setPdfExtracting(true)
    setPdfProgress(0)
    setPdfCurrentPage(0)
    setPdfTotalPages(0)
    setPdfErrorDetail(null)
    setCreatedLancamentosSummary(null)

    try {
      const res = await extractTextFromPdf(file, (progress, current, total) => {
        setPdfProgress(progress)
        setPdfCurrentPage(current)
        setPdfTotalPages(total)
      })

      setPdfResult(res)
      setPdfErrorDetail(null)

      // Executa matching inicial
      const matched = matchPdfCandidatesWithPlanoContas(res.candidates, planoContas)
      setMatchedItems(matched)
      setPdfActiveStep(2)

      if (res.isScannedOrEmpty) {
        toast({
          title: 'Aviso: PDF Digitalizado/Escaneado',
          description:
            'Pouco ou nenhum texto foi detectado no documento. Se for um PDF escaneado (imagem/foto), use OCR antes do upload para extrair os lançamentos.',
        })
      } else {
        toast({
          title: 'PDF Processado com sucesso!',
          description: `${res.totalPages} ${res.totalPages === 1 ? 'página analisada' : 'páginas analisadas'}. Encontrados ${res.candidates.length} candidatos de contas/valores.`,
        })
      }
    } catch (err: unknown) {
      const error = err as Error
      const errorMessage = error?.message || 'Ocorreu um erro inesperado ao ler o arquivo PDF.'
      console.error('Erro na extração de PDF:', error)
      setPdfErrorDetail(errorMessage)
      toast({
        title: 'Falha ao processar PDF',
        description: errorMessage,
        variant: 'destructive',
      })
    } finally {
      setPdfExtracting(false)
    }
  }

  const handlePdfDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsPdfDragOver(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handlePdfFileSelect(e.dataTransfer.files[0])
    }
  }

  const handleResetPdf = () => {
    setPdfFile(null)
    setPdfResult(null)
    setPdfErrorDetail(null)
    setMatchedItems([])
    setPdfActiveStep(1)
    setCreatedLancamentosSummary(null)
  }

  // Alteração manual de valor do candidato
  const handleItemValueChange = (id: string, newValor: number) => {
    setMatchedItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, valor: newValor } : item)),
    )
  }

  // Associação manual do Plano de Contas
  const handleItemPlanoChange = (id: string, planoId: string) => {
    const plano = planoContas.find((p) => p.id === planoId)
    setMatchedItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          if (plano) {
            return {
              ...item,
              planoConta: plano,
              planoContaId: plano.id,
              conta: plano.expand?.conta,
              centro: plano.expand?.centro,
              tipoDespesa: plano.expand?.tipo_despesa,
              isMatched: true,
              matchedBy: 'manual',
            }
          } else {
            return {
              ...item,
              planoConta: undefined,
              planoContaId: undefined,
              conta: undefined,
              centro: undefined,
              tipoDespesa: undefined,
              isMatched: false,
            }
          }
        }
        return item
      }),
    )
  }

  // Exclusão de um item da lista
  const handleRemoveItem = (id: string) => {
    setMatchedItems((prev) => prev.filter((item) => item.id !== id))
  }

  // Abertura do Modal de Cadastro Rápido
  const handleOpenQuickRegister = (item: MatchedItem) => {
    setQuickRegisterCandidateName(item.rawAccountName)
    setQuickRegisterItemId(item.id)
    setQuickRegisterOpen(true)
  }

  // Callback de sucesso ao cadastrar nova conta
  const handleQuickRegisterSuccess = async (newPlano: PlanoContaRecord) => {
    // Recarrega os planos de contas para atualizar a lista geral
    const updatedPlanos = await financeService.getPlanoContas()
    setPlanoContas(updatedPlanos)

    const populatedPlano = updatedPlanos.find((p) => p.id === newPlano.id) || newPlano

    if (quickRegisterItemId) {
      setMatchedItems((prev) =>
        prev.map((item) => {
          if (item.id === quickRegisterItemId) {
            return {
              ...item,
              planoConta: populatedPlano,
              planoContaId: populatedPlano.id,
              conta: populatedPlano.expand?.conta,
              centro: populatedPlano.expand?.centro,
              tipoDespesa: populatedPlano.expand?.tipo_despesa,
              isMatched: true,
              matchedBy: 'manual',
            }
          }
          return item
        }),
      )
    }
  }

  // Submissão dos Lançamentos do PDF
  const handleConfirmLancamentos = async () => {
    if (!targetEmpresaId) {
      toast({
        title: 'Selecione uma Empresa',
        description: 'Informe a empresa de destino dos lançamentos.',
        variant: 'destructive',
      })
      return
    }

    if (!targetData) {
      toast({
        title: 'Data base obrigatória',
        description: 'Selecione a data de referência para os lançamentos.',
        variant: 'destructive',
      })
      return
    }

    // Filtra itens matched com valor > 0 e planoConta válido
    const validItems = matchedItems.filter((i) => i.isMatched && i.planoContaId && i.valor > 0)

    if (validItems.length === 0) {
      toast({
        title: 'Nenhum lançamento válido',
        description: 'Não há contas vinculadas com valor maior que zero para registrar.',
        variant: 'destructive',
      })
      return
    }

    setIsSubmittingLancamentos(true)
    let createdCount = 0
    const errors: string[] = []

    try {
      for (const item of validItems) {
        try {
          await financeService.createLancamento({
            empresa: targetEmpresaId,
            plano_conta: item.planoContaId!,
            data: targetData,
            valor: Number(item.valor),
            historico: `Importado do PDF - ${pdfFile?.name || 'Documento'} (Pág. ${item.pageNumber}: ${item.rawAccountName})`,
          })
          createdCount++
        } catch (err: unknown) {
          const error = err as Error
          errors.push(
            `Erro ao criar lançamento para ${item.rawAccountName}: ${error.message || 'Falha'}`,
          )
        }
      }

      const empresaSelecionada =
        empresas.find((e) => e.id === targetEmpresaId)?.razao_social ||
        empresas.find((e) => e.id === targetEmpresaId)?.nome_fantasia ||
        'Empresa'

      // Formata data em pt-BR
      const [ano, mes, dia] = targetData.split('-')
      const dataFormatada = `${dia}/${mes}/${ano}`

      setCreatedLancamentosSummary({
        count: createdCount,
        empresaNome: empresaSelecionada,
        dataRef: dataFormatada,
      })

      setPdfActiveStep(3)
      setConfirmModalOpen(false)

      toast({
        title: 'Lançamentos criados com sucesso!',
        description: `${createdCount} lançamentos criados para ${empresaSelecionada} em ${dataFormatada}.`,
      })

      if (errors.length > 0) {
        console.warn('Alguns lançamentos falharam:', errors)
      }
    } catch (err: unknown) {
      const error = err as Error
      toast({
        title: 'Erro ao processar lançamentos',
        description: error.message || 'Ocorreu um erro durante a criação dos lançamentos.',
        variant: 'destructive',
      })
    } finally {
      setIsSubmittingLancamentos(false)
    }
  }

  // ----------------------------------------------------
  // Handlers do Excel (Mantidos e Aprimorados)
  // ----------------------------------------------------
  const handleExcelFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setExcelFile(file)
    setExcelSuccess(false)
    setExcelImportedCount(0)

    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result
        const wb = XLSX.read(bstr, { type: 'binary', cellDates: true })
        const wsname = wb.SheetNames[0]
        const ws = wb.Sheets[wsname]
        const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws)

        if (data.length === 0) {
          toast({
            title: 'Arquivo vazio',
            description: 'A planilha não contém dados para importar.',
            variant: 'destructive',
          })
          return
        }

        const parsed = data.map((row) => {
          const codPC = String(
            row['Codigo Plano'] || row['codigo_plano'] || row['Codigo'] || row['codigo'] || '',
          ).trim()
          const rawData = row['Data'] || row['data'] || row['Data Lancamento'] || ''
          const rawValor = row['Valor'] || row['valor'] || 0
          const historico = String(row['Historico'] || row['historico'] || row['Descricao'] || '')
          const recorrente = Boolean(row['Recorrente'] || row['recorrente'])

          let dataFormatada = ''
          if (rawData instanceof Date) {
            dataFormatada = rawData.toISOString().split('T')[0]
          } else if (typeof rawData === 'string') {
            if (rawData.includes('/')) {
              const parts = rawData.split('/')
              if (parts.length === 3) {
                dataFormatada = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`
              }
            } else {
              dataFormatada = rawData
            }
          }

          let numValor = 0
          if (typeof rawValor === 'number') {
            numValor = rawValor
          } else if (typeof rawValor === 'string') {
            numValor = parseFloat(rawValor.replace(/[R$\s.]/g, '').replace(',', '.')) || 0
          }

          const pcEncontrado = planoContas.find(
            (p) =>
              p.codigo?.toLowerCase() === codPC.toLowerCase() ||
              p.expand?.conta?.nome?.toLowerCase() ===
                String(row['Conta'] || '')
                  .trim()
                  .toLowerCase(),
          )

          let status: 'valido' | 'erro' = 'valido'
          let erro_msg = ''

          if (!pcEncontrado && !codPC) {
            status = 'erro'
            erro_msg = 'Código do Plano de Contas não informado'
          } else if (!pcEncontrado) {
            status = 'erro'
            erro_msg = `Plano de contas "${codPC}" não encontrado`
          } else if (!dataFormatada || isNaN(Date.parse(dataFormatada))) {
            status = 'erro'
            erro_msg = 'Data inválida'
          } else if (numValor <= 0) {
            status = 'erro'
            erro_msg = 'Valor deve ser maior que zero'
          }

          return {
            codigo_pc: codPC,
            conta_nome: pcEncontrado?.expand?.conta?.nome || String(row['Conta'] || ''),
            centro_nome: pcEncontrado?.expand?.centro?.nome || String(row['Centro'] || ''),
            tipo_despesa_nome: pcEncontrado?.expand?.tipo_despesa?.nome,
            data: dataFormatada,
            valor: numValor,
            historico,
            recorrente,
            plano_conta_id: pcEncontrado?.id,
            status,
            erro_msg,
          }
        })

        setExcelParsedRows(parsed)
      } catch (err: unknown) {
        const error = err as Error
        toast({
          title: 'Erro ao ler arquivo Excel',
          description: error.message || 'Verifique o formato da planilha.',
          variant: 'destructive',
        })
      }
    }
    reader.readAsBinaryString(file)
  }

  const handleImportExcel = async () => {
    if (!excelEmpresaId) {
      toast({
        title: 'Selecione uma empresa',
        description: 'É necessário selecionar a empresa para vincular os lançamentos.',
        variant: 'destructive',
      })
      return
    }

    const validRows = excelParsedRows.filter((r) => r.status === 'valido' && r.plano_conta_id)
    if (validRows.length === 0) {
      toast({
        title: 'Nenhuma linha válida',
        description: 'Corrija os erros na planilha antes de importar.',
        variant: 'destructive',
      })
      return
    }

    setExcelImporting(true)
    let imported = 0
    const errors: string[] = []

    try {
      for (const row of validRows) {
        try {
          await financeService.createLancamento({
            empresa: excelEmpresaId,
            plano_conta: row.plano_conta_id!,
            data: row.data,
            valor: row.valor,
            historico: row.historico || `Importado da planilha: ${excelFile?.name}`,
          })
          imported++
        } catch (err: unknown) {
          const error = err as Error
          errors.push(`Linha ${imported + 1}: ${error.message}`)
        }
      }

      setExcelImportedCount(imported)
      setExcelSuccess(true)
      toast({
        title: 'Importação concluída!',
        description: `${imported} lançamentos importados com sucesso.`,
      })
    } catch (err: unknown) {
      const error = err as Error
      toast({
        title: 'Erro na importação',
        description: error.message || 'Ocorreu um erro durante o processo.',
        variant: 'destructive',
      })
    } finally {
      setExcelImporting(false)
    }
  }

  const handleDownloadExcelTemplate = () => {
    const templateData = [
      {
        'Codigo Plano': 'PC-001',
        Conta: 'Vendas de Produtos',
        Centro: 'Comercial',
        Data: '2025-01-15',
        Valor: 15000.0,
        Historico: 'Vendas da primeira quinzena',
        Recorrente: 'NAO',
      },
      {
        'Codigo Plano': 'PC-002',
        Conta: 'Salários e Ordenados',
        Centro: 'Administrativo',
        Data: '2025-01-05',
        Valor: 8500.0,
        Historico: 'Folha de pagamento Janeiro',
        Recorrente: 'SIM',
      },
    ]

    const ws = XLSX.utils.json_to_sheet(templateData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Modelo_Lancamentos')
    XLSX.writeFile(wb, 'modelo_importacao_lancamentos.xlsx')
  }

  // Totais e estatísticas do PDF
  const matchedFound = matchedItems.filter((i) => i.isMatched)
  const matchedNotFound = matchedItems.filter((i) => !i.isMatched)
  const totalMatchedValue = matchedFound.reduce((acc, curr) => acc + (curr.valor || 0), 0)

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Principal */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-5">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Importação de Dados</h1>
          <p className="text-slate-500 mt-1">
            Importe seus demonstrativos contábeis via Excel ou diretamente através de arquivos PDF
            inteligentes.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadInitialCatalogs}
            disabled={loadingData}
            className="gap-2 bg-white"
          >
            <RefreshCw className={`w-4 h-4 ${loadingData ? 'animate-spin' : ''}`} />
            Atualizar Catálogos
          </Button>
        </div>
      </div>

      {/* Abas Principais: Excel vs PDF */}
      <Tabs defaultValue="pdf" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 max-w-md bg-slate-100 p-1 rounded-xl">
          <TabsTrigger
            value="pdf"
            className="flex items-center gap-2 font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg"
          >
            <FileText className="w-4 h-4 text-rose-500" />
            Importar PDF
            <span className="text-[10px] bg-blue-100 text-blue-700 font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wider">
              Novo
            </span>
          </TabsTrigger>
          <TabsTrigger
            value="excel"
            className="flex items-center gap-2 font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            Importar Excel
          </TabsTrigger>
        </TabsList>

        {/* ========================================================================= */}
        {/* ABA 1: IMPORTAR PDF                                                      */}
        {/* ========================================================================= */}
        <TabsContent value="pdf" className="space-y-6 focus:outline-none">
          {/* Step Wizard visual */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div className="grid grid-cols-3 gap-2 md:gap-6 relative">
              {/* Step 1 */}
              <div
                className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${
                  pdfActiveStep === 1
                    ? 'bg-blue-50 text-blue-800'
                    : pdfActiveStep > 1
                      ? 'text-emerald-700'
                      : 'text-slate-400'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                    pdfActiveStep > 1
                      ? 'bg-emerald-600 text-white'
                      : pdfActiveStep === 1
                        ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                        : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {pdfActiveStep > 1 ? <Check className="w-4 h-4" /> : '1'}
                </div>
                <div className="hidden sm:block">
                  <p className="text-xs font-medium uppercase tracking-wider">Passo 1</p>
                  <p className="text-sm font-semibold">Upload do PDF</p>
                </div>
              </div>

              {/* Step 2 */}
              <div
                className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${
                  pdfActiveStep === 2
                    ? 'bg-blue-50 text-blue-800'
                    : pdfActiveStep > 2
                      ? 'text-emerald-700'
                      : 'text-slate-400'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                    pdfActiveStep > 2
                      ? 'bg-emerald-600 text-white'
                      : pdfActiveStep === 2
                        ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                        : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {pdfActiveStep > 2 ? <Check className="w-4 h-4" /> : '2'}
                </div>
                <div className="hidden sm:block">
                  <p className="text-xs font-medium uppercase tracking-wider">Passo 2</p>
                  <p className="text-sm font-semibold">Revisão & Match</p>
                </div>
              </div>

              {/* Step 3 */}
              <div
                className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${
                  pdfActiveStep === 3 ? 'bg-emerald-50 text-emerald-800' : 'text-slate-400'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                    pdfActiveStep === 3
                      ? 'bg-emerald-600 text-white ring-4 ring-emerald-100'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  3
                </div>
                <div className="hidden sm:block">
                  <p className="text-xs font-medium uppercase tracking-wider">Passo 3</p>
                  <p className="text-sm font-semibold">Lançamentos Criados</p>
                </div>
              </div>
            </div>
          </div>

          {/* SEÇÃO 1: Upload de PDF (Passo 1 ou troca de arquivo) */}
          {pdfActiveStep === 1 && (
            <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm">
              <div className="max-w-2xl mx-auto text-center space-y-6">
                <div
                  onDragOver={(e) => {
                    e.preventDefault()
                    setIsPdfDragOver(true)
                  }}
                  onDragLeave={() => setIsPdfDragOver(false)}
                  onDrop={handlePdfDrop}
                  onClick={() => pdfInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center cursor-pointer transition-all ${
                    isPdfDragOver
                      ? 'border-blue-500 bg-blue-50/50 scale-[1.01]'
                      : 'border-slate-300 hover:border-slate-400 bg-slate-50/50'
                  }`}
                >
                  <input
                    type="file"
                    ref={pdfInputRef}
                    onChange={(e) => e.target.files?.[0] && handlePdfFileSelect(e.target.files[0])}
                    accept=".pdf,application/pdf"
                    className="hidden"
                  />

                  <div className="w-16 h-16 rounded-full bg-rose-50 border border-rose-100 text-rose-500 flex items-center justify-center mb-4 shadow-sm">
                    <FileText className="w-8 h-8" />
                  </div>

                  <h3 className="text-lg font-bold text-slate-800">
                    Arraste e solte o seu PDF aqui
                  </h3>
                  <p className="text-sm text-slate-500 mt-1 max-w-sm">
                    Suporta Balancetes, Razões e Demonstrativos Contábeis em formato PDF de até 300
                    páginas.
                  </p>

                  <Button
                    type="button"
                    variant="outline"
                    className="mt-6 border-slate-300 bg-white shadow-sm font-medium"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Selecionar Arquivo PDF
                  </Button>
                </div>

                {/* Alerta detalhado de erro se ocorrer falha no processamento */}
                {pdfErrorDetail && (
                  <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-left flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                    <div className="space-y-1 text-sm text-rose-900 flex-1">
                      <p className="font-semibold text-rose-950">
                        Falha ao processar o arquivo PDF
                      </p>
                      <p className="text-xs text-rose-800 leading-relaxed">{pdfErrorDetail}</p>
                      <div className="pt-2 text-xs text-rose-700 flex items-center gap-2">
                        <span>
                          Dica: Verifique se o arquivo não está corrompido, protegido por senha ou é
                          um PDF escaneado (imagem).
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPdfErrorDetail(null)}
                      className="text-rose-600 hover:text-rose-800 hover:bg-rose-100 h-7 px-2 text-xs"
                    >
                      Fechar
                    </Button>
                  </div>
                )}

                {/* Informações e dicas sobre extração client-side */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex gap-3">
                    <div className="text-blue-600 mt-0.5">
                      <CheckCircle className="w-4 h-4" />
                    </div>
                    <div className="text-xs text-slate-600 leading-relaxed">
                      <span className="font-semibold text-slate-800 block">100% Client-Side</span>
                      Seu arquivo PDF é processado de forma segura direto no seu navegador.
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex gap-3">
                    <div className="text-blue-600 mt-0.5">
                      <CheckCircle className="w-4 h-4" />
                    </div>
                    <div className="text-xs text-slate-600 leading-relaxed">
                      <span className="font-semibold text-slate-800 block">
                        Matching Automático
                      </span>
                      Detecta nomes de contas e valores em R$ associando com o Plano de Contas.
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex gap-3">
                    <div className="text-amber-600 mt-0.5">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <div className="text-xs text-slate-600 leading-relaxed">
                      <span className="font-semibold text-slate-800 block">PDFs Digitais</span>
                      Para PDFs escaneados como imagem (fotos), converta com OCR antes do upload.
                    </div>
                  </div>
                </div>
              </div>

              {/* Loading state com barra de progresso durante a leitura */}
              {pdfExtracting && (
                <div className="mt-8 p-6 bg-blue-50/60 border border-blue-200 rounded-xl space-y-4 max-w-xl mx-auto">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />
                      <div>
                        <p className="text-sm font-semibold text-blue-950">
                          Extraindo dados do PDF...
                        </p>
                        <p className="text-xs text-blue-700">
                          Lendo página {pdfCurrentPage} de {pdfTotalPages}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-blue-800">{pdfProgress}%</span>
                  </div>
                  <div className="w-full bg-blue-200 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                      style={{ width: `${pdfProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
          {/* SEÇÃO 2: Revisão dos dados e Matching (Passo 2) */}
          {pdfActiveStep === 2 && pdfResult && (
            <div className="space-y-6">
              {/* Cabeçalho do arquivo analisado */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-rose-50 text-rose-600 rounded-xl border border-rose-100">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-slate-900">{pdfResult.fileName}</h2>
                      <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-medium">
                        {pdfResult.totalPages} página{pdfResult.totalPages > 1 ? 's' : ''}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {matchedItems.length} linhas de contas/valores extraídas •{' '}
                      <span className="text-emerald-700 font-semibold">
                        {matchedFound.length} vinculadas
                      </span>{' '}
                      •{' '}
                      <span className="text-rose-600 font-semibold">
                        {matchedNotFound.length} pendentes
                      </span>
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowRawTextPreview(!showRawTextPreview)}
                    className="gap-2 text-slate-700 bg-white"
                  >
                    <Eye className="w-4 h-4" />
                    {showRawTextPreview ? 'Ocultar Prévia de Texto' : 'Ver Texto do PDF'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleResetPdf}
                    className="text-slate-500 hover:text-rose-600 gap-1.5"
                  >
                    <Trash2 className="w-4 h-4" />
                    Trocar PDF
                  </Button>
                  <Button
                    onClick={() => setConfirmModalOpen(true)}
                    disabled={matchedFound.length === 0}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold gap-2 shadow-sm"
                  >
                    <DollarSign className="w-4 h-4" />
                    Registrar Lançamentos ({matchedFound.length})
                  </Button>
                </div>
              </div>

              {/* Aviso se for PDF escaneado */}
              {pdfResult.isScannedOrEmpty && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-800">
                    <p className="font-semibold">Possível PDF escaneado (sem texto digital)</p>
                    <p className="mt-1 text-xs text-amber-700 leading-relaxed">
                      Não conseguimos extrair texto selecionável deste PDF. Se ele foi gerado a
                      partir de um scanner ou foto, use uma ferramenta de OCR (reconhecimento óptico
                      de caracteres) antes de importar ou digite manualmente.
                    </p>
                  </div>
                </div>
              )}

              {/* Prévia sanfonada do texto extraído por página */}
              {showRawTextPreview && (
                <div className="bg-slate-900 text-slate-100 rounded-xl p-5 border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                      <FileSearch className="w-4 h-4 text-blue-400" />
                      Texto Extraído por Página ({pdfResult.pages.length} páginas)
                    </div>
                    <span className="text-xs text-slate-400">
                      Clique em cada página para expandir
                    </span>
                  </div>
                  <Accordion type="single" collapsible className="w-full space-y-2">
                    {pdfResult.pages.map((p) => (
                      <AccordionItem
                        key={p.pageNumber}
                        value={`page-${p.pageNumber}`}
                        className="border border-slate-800 bg-slate-950/60 rounded-lg px-4"
                      >
                        <AccordionTrigger className="text-xs font-mono text-slate-300 hover:text-white py-3">
                          Página {p.pageNumber} ({p.lines.length} linhas de texto)
                        </AccordionTrigger>
                        <AccordionContent className="pt-2 pb-4">
                          <pre className="text-xs font-mono text-slate-300 bg-slate-900 p-3 rounded-lg overflow-x-auto whitespace-pre-wrap max-h-60 leading-relaxed border border-slate-800">
                            {p.rawText || '(Nenhum texto detectado nesta página)'}
                          </pre>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </div>
              )}

              {/* Resumo de Métricas de Extração */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">
                      Contas Encontradas ✅
                    </p>
                    <p className="text-2xl font-bold text-emerald-950 mt-1">
                      {matchedFound.length}
                    </p>
                  </div>
                  <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl">
                    <CheckCircle className="w-5 h-5" />
                  </div>
                </div>

                <div className="bg-rose-50/60 border border-rose-200 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-rose-800 uppercase tracking-wider">
                      Não Encontradas ❌
                    </p>
                    <p className="text-2xl font-bold text-rose-950 mt-1">
                      {matchedNotFound.length}
                    </p>
                  </div>
                  <div className="p-2.5 bg-rose-100 text-rose-700 rounded-xl">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                </div>

                <div className="bg-blue-50/60 border border-blue-200 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-blue-800 uppercase tracking-wider">
                      Total a Lançar
                    </p>
                    <p className="text-2xl font-bold text-blue-950 mt-1">
                      {new Intl.NumberFormat('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      }).format(totalMatchedValue)}
                    </p>
                  </div>
                  <div className="p-2.5 bg-blue-100 text-blue-700 rounded-xl">
                    <DollarSign className="w-5 h-5" />
                  </div>
                </div>
              </div>

              {/* TABELA 1: CONTAS ENCONTRADAS ✅ */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 bg-emerald-50/40 border-b border-emerald-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-emerald-600" />
                    <h3 className="font-bold text-slate-800 text-base">
                      Contas Encontradas ({matchedFound.length})
                    </h3>
                  </div>
                  <span className="text-xs text-slate-500">Valores editáveis antes de gravar</span>
                </div>

                {matchedFound.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">
                    <p className="text-sm">Nenhuma conta com correspondência automática.</p>
                    <p className="text-xs mt-1">
                      Cadastre as contas abaixo para vinculá-las a este grupo.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50 text-slate-600 font-semibold text-xs uppercase border-b border-slate-200">
                        <tr>
                          <th className="py-3 px-4">Pág</th>
                          <th className="py-3 px-4">Nome Extraído no PDF</th>
                          <th className="py-3 px-4">Correspondência no Plano de Contas</th>
                          <th className="py-3 px-4 text-right w-48">Valor Sugerido (R$)</th>
                          <th className="py-3 px-4 text-center w-20">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {matchedFound.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-4 font-mono text-xs text-slate-500">
                              p.{item.pageNumber}
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-medium text-slate-900">
                                {item.rawAccountName}
                              </div>
                              <div className="text-[11px] text-slate-400 font-mono truncate max-w-xs">
                                {item.originalLine}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="space-y-1">
                                <Select
                                  value={item.planoContaId || ''}
                                  onValueChange={(val) => handleItemPlanoChange(item.id, val)}
                                >
                                  <SelectTrigger className="h-8 text-xs bg-white">
                                    <SelectValue
                                      placeholder={
                                        item.planoConta
                                          ? formatPlanoContaDisplay(item.planoConta)
                                          : 'Selecionar Plano'
                                      }
                                    />
                                  </SelectTrigger>
                                  <SelectContent className="max-h-64">
                                    {planoContas.map((p) => (
                                      <SelectItem key={p.id} value={p.id} className="text-xs">
                                        {formatPlanoContaDisplay(p)}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <span className="text-xs text-slate-400 font-medium">R$</span>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={item.valor}
                                  onChange={(e) =>
                                    handleItemValueChange(item.id, parseFloat(e.target.value) || 0)
                                  }
                                  className="h-8 w-32 text-right font-mono text-sm bg-white"
                                />
                              </div>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveItem(item.id)}
                                className="h-8 w-8 text-slate-400 hover:text-rose-600"
                                title="Remover este item da importação"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* TABELA 2: CONTAS NÃO ENCONTRADAS ❌ */}
              {matchedNotFound.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-4 bg-rose-50/40 border-b border-rose-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-rose-500" />
                      <h3 className="font-bold text-slate-800 text-base">
                        Contas Não Encontradas ({matchedNotFound.length})
                      </h3>
                    </div>
                    <span className="text-xs text-slate-500">
                      Cadastre rapidamente para incluir nos lançamentos
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50 text-slate-600 font-semibold text-xs uppercase border-b border-slate-200">
                        <tr>
                          <th className="py-3 px-4">Pág</th>
                          <th className="py-3 px-4">Nome Extraído</th>
                          <th className="py-3 px-4">Linha Original no PDF</th>
                          <th className="py-3 px-4 text-right">Valor Detectado</th>
                          <th className="py-3 px-4 text-right w-44">Ação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {matchedNotFound.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-4 font-mono text-xs text-slate-500">
                              p.{item.pageNumber}
                            </td>
                            <td className="py-3 px-4 font-medium text-slate-900">
                              {item.rawAccountName}
                            </td>
                            <td className="py-3 px-4 text-xs font-mono text-slate-500 max-w-sm truncate">
                              {item.originalLine}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-medium text-slate-800">
                              {new Intl.NumberFormat('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              }).format(item.valor)}
                            </td>
                            <td className="py-3 px-4 text-right space-x-2">
                              <Button
                                size="sm"
                                onClick={() => handleOpenQuickRegister(item)}
                                className="h-8 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs gap-1.5 shadow-sm"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                Cadastrar
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveItem(item.id)}
                                className="h-8 w-8 text-slate-400 hover:text-rose-600"
                                title="Ignorar esta linha"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Botão Inferior de Lançamento */}
              <div className="flex justify-end gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={handleResetPdf}
                  className="bg-white border-slate-300"
                >
                  Voltar / Cancelar
                </Button>
                <Button
                  onClick={() => setConfirmModalOpen(true)}
                  disabled={matchedFound.length === 0}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold gap-2 shadow-sm px-6"
                >
                  <Check className="w-4 h-4" />
                  Registrar {matchedFound.length} Lançamentos
                </Button>
              </div>
            </div>
          )}

          {/* SEÇÃO 3: Sucesso de Lançamentos (Passo 3) */}
          {pdfActiveStep === 3 && createdLancamentosSummary && (
            <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm text-center max-w-2xl mx-auto space-y-6">
              <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto border border-emerald-100">
                <CheckCircle className="w-8 h-8" />
              </div>

              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-slate-900">
                  Lançamentos Criados com Sucesso!
                </h2>
                <p className="text-slate-600 text-sm">
                  Foram registrados <strong>{createdLancamentosSummary.count} lançamentos</strong>{' '}
                  para a empresa <strong>{createdLancamentosSummary.empresaNome}</strong> com data
                  base <strong>{createdLancamentosSummary.dataRef}</strong>.
                </p>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-around text-center">
                <div>
                  <span className="text-xs text-slate-500 uppercase font-semibold">Empresa</span>
                  <p className="font-bold text-slate-800">
                    {createdLancamentosSummary.empresaNome}
                  </p>
                </div>
                <div className="border-r border-slate-200 h-8" />
                <div>
                  <span className="text-xs text-slate-500 uppercase font-semibold">Data Base</span>
                  <p className="font-bold text-slate-800">{createdLancamentosSummary.dataRef}</p>
                </div>
                <div className="border-r border-slate-200 h-8" />
                <div>
                  <span className="text-xs text-slate-500 uppercase font-semibold">
                    Lançamentos
                  </span>
                  <p className="font-bold text-emerald-700">
                    {createdLancamentosSummary.count} registros
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={handleResetPdf}
                  className="w-full sm:w-auto bg-white border-slate-300"
                >
                  Importar Outro PDF
                </Button>
                <Button
                  onClick={() => navigate('/lancamentos')}
                  className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-semibold gap-2 shadow-sm"
                >
                  Ir para Lançamentos
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ========================================================================= */}
        {/* ABA 2: IMPORTAR EXCEL (Existente)                                         */}
        {/* ========================================================================= */}
        <TabsContent value="excel" className="space-y-6 focus:outline-none">
          {/* Download Modelo */}
          <div className="bg-emerald-50/50 border border-emerald-200 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-semibold text-emerald-950">
                  Planilha Modelo de Lançamentos (.xlsx)
                </h3>
                <p className="text-xs text-emerald-800 mt-0.5">
                  Baixe o modelo pré-formatado com as colunas necessárias para importar seus dados
                  sem erros.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadExcelTemplate}
              className="bg-white text-emerald-700 border-emerald-300 hover:bg-emerald-50 gap-2 shrink-0 font-medium"
            >
              <Download className="w-4 h-4" />
              Baixar Planilha Modelo
            </Button>
          </div>

          {/* Configuração da Importação Excel */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="excelEmpresa" className="font-medium text-slate-700">
                  Empresa de Destino *
                </Label>
                <Select value={excelEmpresaId} onValueChange={setExcelEmpresaId}>
                  <SelectTrigger id="excelEmpresa" className="bg-white">
                    <SelectValue placeholder="Selecione a empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    {empresas.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.razao_social || emp.nome_fantasia}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500">
                  Todos os lançamentos do arquivo serão atribuídos a esta empresa.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="excelFile" className="font-medium text-slate-700">
                  Arquivo Excel (.xlsx, .xls) *
                </Label>
                <Input
                  id="excelFile"
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleExcelFileChange}
                  className="bg-white cursor-pointer"
                />
                <p className="text-xs text-slate-500">
                  Selecione a planilha com os dados a serem importados.
                </p>
              </div>
            </div>

            {/* Tabela de Pré-visualização Excel */}
            {excelParsedRows.length > 0 && (
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-slate-800">
                      Pré-visualização dos Registros ({excelParsedRows.length})
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {excelParsedRows.filter((r) => r.status === 'valido').length} válidos,{' '}
                      {excelParsedRows.filter((r) => r.status === 'erro').length} com erro.
                    </p>
                  </div>
                  <Button
                    onClick={handleImportExcel}
                    disabled={
                      excelImporting ||
                      !excelEmpresaId ||
                      excelParsedRows.filter((r) => r.status === 'valido').length === 0
                    }
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium gap-2 shadow-sm"
                  >
                    {excelImporting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Importando...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        Confirmar e Importar (
                        {excelParsedRows.filter((r) => r.status === 'valido').length})
                      </>
                    )}
                  </Button>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="max-h-96 overflow-y-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 text-slate-600 font-semibold uppercase sticky top-0 border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3">Status</th>
                          <th className="py-2.5 px-3">Cód. Plano</th>
                          <th className="py-2.5 px-3">Conta</th>
                          <th className="py-2.5 px-3">Centro</th>
                          <th className="py-2.5 px-3">Data</th>
                          <th className="py-2.5 px-3 text-right">Valor</th>
                          <th className="py-2.5 px-3">Histórico</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {excelParsedRows.map((row, idx) => (
                          <tr
                            key={idx}
                            className={
                              row.status === 'erro' ? 'bg-rose-50/50' : 'hover:bg-slate-50/60'
                            }
                          >
                            <td className="py-2.5 px-3">
                              {row.status === 'valido' ? (
                                <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                                  <CheckCircle className="w-3.5 h-3.5" /> Válido
                                </span>
                              ) : (
                                <span
                                  className="inline-flex items-center gap-1 text-rose-600 font-medium"
                                  title={row.erro_msg}
                                >
                                  <AlertCircle className="w-3.5 h-3.5" /> {row.erro_msg}
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 font-mono font-medium">
                              {row.codigo_pc || '-'}
                            </td>
                            <td className="py-2.5 px-3">{row.conta_nome || '-'}</td>
                            <td className="py-2.5 px-3">{row.centro_nome || '-'}</td>
                            <td className="py-2.5 px-3 font-mono">{row.data}</td>
                            <td className="py-2.5 px-3 text-right font-mono font-medium">
                              {new Intl.NumberFormat('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              }).format(row.valor)}
                            </td>
                            <td className="py-2.5 px-3 text-slate-500 max-w-xs truncate">
                              {row.historico || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Mensagem de sucesso do Excel */}
            {excelSuccess && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-emerald-950">
                      {excelImportedCount} lançamentos importados com sucesso!
                    </p>
                    <p className="text-xs text-emerald-700">
                      Os registros já estão disponíveis na consulta e relatórios da empresa.
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => navigate('/lancamentos')}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs gap-1.5"
                >
                  Ir para Lançamentos
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* ========================================================================= */}
      {/* MODAL: Confirmação de Criação de Lançamentos do PDF                       */}
      {/* ========================================================================= */}
      <Dialog open={confirmModalOpen} onOpenChange={setConfirmModalOpen}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                <DollarSign className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-xl">Registrar Lançamentos</DialogTitle>
                <DialogDescription>
                  Vincular os valores extraídos do PDF a uma empresa e data de referência.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
              <div className="flex justify-between text-xs text-slate-500">
                <span>Total de contas selecionadas:</span>
                <span className="font-bold text-slate-800">
                  {matchedFound.filter((i) => i.valor > 0).length} contas
                </span>
              </div>
              <div className="flex justify-between text-xs text-slate-500">
                <span>Valor total a ser registrado:</span>
                <span className="font-bold text-blue-700 text-sm">
                  {new Intl.NumberFormat('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  }).format(
                    matchedFound
                      .filter((i) => i.valor > 0)
                      .reduce((acc, curr) => acc + curr.valor, 0),
                  )}
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="targetEmpresa">Empresa de Destino *</Label>
              <Select
                value={targetEmpresaId}
                onValueChange={setTargetEmpresaId}
                disabled={isSubmittingLancamentos}
              >
                <SelectTrigger id="targetEmpresa">
                  <SelectValue placeholder="Selecione a empresa" />
                </SelectTrigger>
                <SelectContent>
                  {empresas.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.razao_social || emp.nome_fantasia}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="targetData">Data Base do Lançamento *</Label>
              <Input
                id="targetData"
                type="date"
                value={targetData}
                onChange={(e) => setTargetData(e.target.value)}
                disabled={isSubmittingLancamentos}
              />
              <p className="text-[11px] text-slate-500">
                Data contábil associada a todos os registros importados deste PDF.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setConfirmModalOpen(false)}
              disabled={isSubmittingLancamentos}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmLancamentos}
              disabled={isSubmittingLancamentos || !targetEmpresaId || !targetData}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold"
            >
              {isSubmittingLancamentos ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Criando Lançamentos...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Confirmar Lançamentos
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL: Cadastro Rápido de Conta (Não Encontrada)                           */}
      {/* ========================================================================= */}
      <ModalQuickRegisterConta
        open={quickRegisterOpen}
        onOpenChange={setQuickRegisterOpen}
        initialName={quickRegisterCandidateName}
        centros={centros}
        tiposDespesas={tiposDespesas}
        onSuccess={handleQuickRegisterSuccess}
      />
    </div>
  )
}
