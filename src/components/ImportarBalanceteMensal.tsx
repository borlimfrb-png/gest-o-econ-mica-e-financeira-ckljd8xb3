import React, { useState, useRef } from 'react'
import {
  FileSpreadsheet,
  FileText,
  Upload,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Eye,
  RefreshCw,
  Sparkles,
  Layers,
  Building2,
  Calendar,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import * as XLSX from 'xlsx'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
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
import { useToast } from '@/hooks/use-toast'
import type { EmpresaRecord, BalancoRecord, DreRecord } from '@/types/finance'
import { NOMES_MESES, formatBrlMil } from '@/lib/financeCalculations'
import { extractTextFromPdf, parseBrlNumber } from '@/lib/pdfParser'
import { convertPdfPagesToExcelRows } from '@/lib/pdfToExcel'
import {
  mapearBalanceteParaBalancoEDre,
  recalcularBalanceteMapeado,
  type BalanceteMapeadoResult,
  type ContaMapeadaItem,
} from '@/lib/balanceteParser'
import { balancosService, dreService } from '@/services/financeService'
import { Pencil, Trash2, Plus, Check, RotateCcw } from 'lucide-react'

interface ImportarBalanceteMensalProps {
  empresas: EmpresaRecord[]
  initialEmpresaId?: string
  initialAno?: number
  initialMes?: number
  onImportSuccess?: (empresaId: string, ano: number, mes: number) => void
}

export function ImportarBalanceteMensal({
  empresas,
  initialEmpresaId,
  initialAno,
  initialMes,
  onImportSuccess,
}: ImportarBalanceteMensalProps) {
  const { toast } = useToast()
  const navigate = useNavigate()

  const [selectedEmpresaId, setSelectedEmpresaId] = useState<string>(
    initialEmpresaId || (empresas.length > 0 ? empresas[0].id : ''),
  )
  const [selectedAno, setSelectedAno] = useState<number>(initialAno || new Date().getFullYear())
  const [selectedMes, setSelectedMes] = useState<number>(initialMes || new Date().getMonth() + 1)

  const [file, setFile] = useState<File | null>(null)
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Resultado do mapeamento prévio
  const [previewResult, setPreviewResult] = useState<BalanceteMapeadoResult | null>(null)
  const [originalPreviewResult, setOriginalPreviewResult] = useState<BalanceteMapeadoResult | null>(
    null,
  )
  const [rawRowsCount, setRawRowsCount] = useState<number>(0)
  const [confirmModalOpen, setConfirmModalOpen] = useState(false)
  const [savingImport, setSavingImport] = useState(false)

  // Controle de edição manual célula a célula
  const [editingContaIdx, setEditingContaIdx] = useState<number | null>(null)
  const [editingBalancoField, setEditingBalancoField] = useState<string | null>(null)
  const [editingDreField, setEditingDreField] = useState<string | null>(null)
  const [filterContasTerm, setFilterContasTerm] = useState('')

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  const handleFileChange = async (selectedFile: File) => {
    if (!selectedFile) return
    setErrorMsg(null)
    setPreviewResult(null)
    setFile(selectedFile)

    const isPdf =
      selectedFile.type === 'application/pdf' || selectedFile.name.toLowerCase().endsWith('.pdf')
    const isExcel =
      selectedFile.type.includes('sheet') ||
      selectedFile.type.includes('excel') ||
      selectedFile.name.toLowerCase().endsWith('.xlsx') ||
      selectedFile.name.toLowerCase().endsWith('.xls') ||
      selectedFile.name.toLowerCase().endsWith('.csv')

    if (!isPdf && !isExcel) {
      setErrorMsg(
        'Formato de arquivo não suportado. Por favor, envie um arquivo Excel (.xlsx, .xls) ou PDF (.pdf).',
      )
      return
    }

    setProcessing(true)
    setProgress(10)

    try {
      let extractedRows: Array<{
        codigo?: string
        conta?: string
        descricao?: string
        valor: number
        tipo?: string
        natureza?: string
        linhaOriginal?: string
      }> = []

      if (isPdf) {
        setProgress(30)
        const pdfResult = await extractTextFromPdf(selectedFile, (pct) => {
          setProgress(30 + Math.round(pct * 0.4))
        })

        if (pdfResult.isScannedOrEmpty) {
          throw new Error('O arquivo PDF parece estar escaneado como imagem ou sem texto legível.')
        }

        const excelRows = convertPdfPagesToExcelRows(pdfResult.pages)
        extractedRows = excelRows.map((r) => ({
          codigo: r.codigo !== '-' ? r.codigo : undefined,
          conta: r.conta,
          descricao: r.descricao,
          valor: r.valor,
          tipo: r.tipo,
          natureza: r.natureza,
          linhaOriginal: r.linhaOriginal,
        }))
      } else {
        // Leitura de Excel via XLSX
        setProgress(40)
        const arrayBuffer = await selectedFile.arrayBuffer()
        const wb = XLSX.read(arrayBuffer, { type: 'array' })
        const sheetName = wb.SheetNames[0]
        const ws = wb.Sheets[sheetName]
        const jsonRows = XLSX.utils.sheet_to_json<any>(ws, { header: 1 })

        setProgress(60)

        // Itera sobre as linhas procurando colunas de código, descrição e saldo/valor
        for (const row of jsonRows) {
          if (!Array.isArray(row) || row.length === 0) continue

          let codigo = ''
          let desc = ''
          let valor = 0

          // Procura colunas
          for (const cell of row) {
            const cellStr = String(cell || '').trim()
            if (!cellStr) continue

            // Código contábil (ex: 1.1.01 ou 12345)
            if (/^\d{1,5}(?:\.\d+)*$/.test(cellStr) && !codigo) {
              codigo = cellStr
              continue
            }

            // Valor numérico
            if (typeof cell === 'number') {
              valor = cell
            } else if (
              /(?:R\$\s*)?(?:(?:\d{1,3}(?:\.\d{3})+|\d+),\d{2}|\b\d+\.\d{2}\b)/.test(cellStr)
            ) {
              valor = parseBrlNumber(cellStr)
            } else if (cellStr.length > 2 && !desc) {
              desc = cellStr
            }
          }

          if (desc && valor !== 0) {
            extractedRows.push({
              codigo: codigo || undefined,
              descricao: desc,
              valor,
            })
          }
        }
      }

      setProgress(85)
      setRawRowsCount(extractedRows.length)

      if (extractedRows.length === 0) {
        throw new Error('Nenhuma linha contábil com valor válido foi identificada no arquivo.')
      }

      // Executa o mapeamento inteligente
      const mapped = mapearBalanceteParaBalancoEDre(
        extractedRows,
        selectedAno,
        selectedMes,
        selectedEmpresaId,
      )

      setProgress(100)
      setPreviewResult(mapped)
      setOriginalPreviewResult(JSON.parse(JSON.stringify(mapped)))
      toast({
        title: 'Balancete Processado com Sucesso!',
        description: `${mapped.contasIdentificadas.length} contas contábeis foram mapeadas para Balanço e DRE de ${NOMES_MESES[selectedMes - 1]}/${selectedAno}. Você pode editar qualquer célula antes de confirmar.`,
      })
    } catch (err: any) {
      console.error('Erro ao processar balancete:', err)
      const msg = err?.message || 'Falha ao analisar o documento.'
      setErrorMsg(msg)
      toast({
        variant: 'destructive',
        title: 'Erro na importação do balancete',
        description: msg,
      })
    } finally {
      setProcessing(false)
    }
  }

  const handleConfirmarGravacao = async () => {
    if (!previewResult || !selectedEmpresaId) return
    setSavingImport(true)
    try {
      await Promise.all([
        balancosService.upsert(
          selectedEmpresaId,
          selectedAno,
          {
            ...previewResult.balanco,
            ano: selectedAno,
            mes: selectedMes,
            fechado: false,
            fechamento_obs: `Importado de Balancete Mensal (${file?.name || 'arquivo'})`,
          },
          selectedMes,
        ),
        dreService.upsert(
          selectedEmpresaId,
          selectedAno,
          {
            ...previewResult.dre,
            ano: selectedAno,
            mes: selectedMes,
            fechado: false,
            fechamento_obs: `Importado de Balancete Mensal (${file?.name || 'arquivo'})`,
          },
          selectedMes,
        ),
      ])

      toast({
        title: 'Lançamentos Importados e Gravados com Sucesso!',
        description: `Os registros de Balanço e DRE para ${NOMES_MESES[selectedMes - 1]}/${selectedAno} foram atualizados.`,
      })

      setConfirmModalOpen(false)
      if (onImportSuccess) {
        onImportSuccess(selectedEmpresaId, selectedAno, selectedMes)
      } else {
        navigate(`/analise/${selectedEmpresaId}`)
      }
    } catch (err: any) {
      console.error('Erro ao gravar balancete:', err)
      toast({
        variant: 'destructive',
        title: 'Falha ao salvar dados importados',
        description: err?.message || 'Erro ao persistir informações no banco de dados.',
      })
    } finally {
      setSavingImport(false)
    }
  }

  const handleReset = () => {
    setFile(null)
    setPreviewResult(null)
    setOriginalPreviewResult(null)
    setErrorMsg(null)
    setEditingContaIdx(null)
    setEditingBalancoField(null)
    setEditingDreField(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // Atualização direta de campo do Balanço
  const handleUpdateBalancoField = (campo: keyof BalancoRecord, novoValor: number) => {
    if (!previewResult) return
    const updatedBalanco = {
      ...previewResult.balanco,
      [campo]: novoValor,
    }

    const totalAtivo =
      (updatedBalanco.caixa_equivalentes || 0) +
      (updatedBalanco.aplicacoes_financeiras || 0) +
      (updatedBalanco.contas_receber || 0) +
      (updatedBalanco.estoques || 0) +
      (updatedBalanco.impostos_recuperar || 0) +
      (updatedBalanco.outros_ativo_circulante || 0) +
      (updatedBalanco.realizavel_longo_prazo || 0) +
      (updatedBalanco.investimentos || 0) +
      (updatedBalanco.imobilizado || 0) +
      (updatedBalanco.intangivel || 0)

    const totalPassivo =
      (updatedBalanco.fornecedores || 0) +
      (updatedBalanco.emprestimos_curto_prazo || 0) +
      (updatedBalanco.obrigacoes_trabalhistas || 0) +
      (updatedBalanco.obrigacoes_tributarias || 0) +
      (updatedBalanco.outros_passivo_circulante || 0) +
      (updatedBalanco.emprestimos_longo_prazo || 0) +
      (updatedBalanco.outras_obrigacoes_longo_prazo || 0) +
      (updatedBalanco.capital_social || 0) +
      (updatedBalanco.reservas_lucros || 0) +
      (updatedBalanco.lucros_acumulados || 0)

    setPreviewResult({
      ...previewResult,
      balanco: updatedBalanco,
      totalAtivo,
      totalPassivo,
    })
  }

  // Atualização direta de campo da DRE
  const handleUpdateDreField = (campo: keyof DreRecord, novoValor: number) => {
    if (!previewResult) return
    const updatedDre = {
      ...previewResult.dre,
      [campo]: novoValor,
    }

    const totalReceitas = updatedDre.receita_bruta || 0
    const totalDespesas =
      (updatedDre.deducoes_receita || 0) +
      (updatedDre.custo_mercadorias || 0) +
      (updatedDre.despesas_operacionais || 0) +
      (updatedDre.despesas_financeiras || 0) +
      (updatedDre.imposto_renda || 0)

    setPreviewResult({
      ...previewResult,
      dre: updatedDre,
      totalReceitas,
      totalDespesas,
    })
  }

  // Atualização de uma conta da tabela detalhada
  const handleUpdateContaItem = (index: number, updatedFields: Partial<ContaMapeadaItem>) => {
    if (!previewResult) return
    const novasContas = [...previewResult.contasIdentificadas]
    novasContas[index] = {
      ...novasContas[index],
      ...updatedFields,
    }

    const recalculado = recalcularBalanceteMapeado(
      novasContas,
      selectedAno,
      selectedMes,
      selectedEmpresaId,
    )
    setPreviewResult(recalculado)
  }

  // Exclusão de conta da lista
  const handleRemoverContaItem = (index: number) => {
    if (!previewResult) return
    const novasContas = previewResult.contasIdentificadas.filter((_, idx) => idx !== index)
    const recalculado = recalcularBalanceteMapeado(
      novasContas,
      selectedAno,
      selectedMes,
      selectedEmpresaId,
    )
    setPreviewResult(recalculado)
    toast({
      title: 'Conta removida do balancete',
      description: 'Os totais de Balanço e DRE foram recalculados.',
    })
  }

  // Restaurar valores originais
  const handleRestaurarValoresOriginais = () => {
    if (originalPreviewResult) {
      setPreviewResult(JSON.parse(JSON.stringify(originalPreviewResult)))
      toast({
        title: 'Valores restaurados',
        description: 'Os valores do balancete voltaram à detecção automática inicial do arquivo.',
      })
    }
  }

  return (
    <div className="space-y-6">
      {/* Card Principal de Upload e Seleção */}
      <Card className="bg-white border-slate-200 shadow-2xs">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 font-bold">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-base font-bold text-[#0B1F3A]">
                Importar Balancete Mensal (Excel / PDF)
              </CardTitle>
              <CardDescription className="text-xs">
                Faça o upload do balancete contábil mensal para gerar automaticamente os lançamentos
                de Balanço Patrimonial e DRE com pré-visualização.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Seletores de Empresa, Ano e Mês */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50/80 p-4 rounded-xl border border-slate-200/80">
            <div>
              <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 mb-1.5">
                <Building2 className="w-3.5 h-3.5 text-blue-600" />
                Empresa Destino
              </Label>
              <Select
                value={selectedEmpresaId}
                onValueChange={(val) => {
                  setSelectedEmpresaId(val)
                  setPreviewResult(null)
                }}
              >
                <SelectTrigger className="h-9 text-xs bg-white">
                  <SelectValue placeholder="Selecione a empresa..." />
                </SelectTrigger>
                <SelectContent>
                  {empresas.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id} className="text-xs">
                      {emp.nome} ({emp.segmento})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 mb-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                Ano de Exercício
              </Label>
              <Input
                type="number"
                min={2000}
                max={2100}
                value={selectedAno}
                onChange={(e) => {
                  setSelectedAno(Number(e.target.value))
                  setPreviewResult(null)
                }}
                className="h-9 text-xs bg-white"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 mb-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                Mês de Competência
              </Label>
              <Select
                value={String(selectedMes)}
                onValueChange={(val) => {
                  setSelectedMes(Number(val))
                  setPreviewResult(null)
                }}
              >
                <SelectTrigger className="h-9 text-xs bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NOMES_MESES.map((nome, idx) => (
                    <SelectItem key={idx + 1} value={String(idx + 1)} className="text-xs">
                      {idx + 1} - {nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Área de Drag and Drop de Arquivo */}
          {!previewResult && (
            <div
              onDragOver={(e) => {
                e.preventDefault()
                setIsDragOver(true)
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={(e) => {
                e.preventDefault()
                setIsDragOver(false)
                if (e.dataTransfer.files?.[0]) {
                  handleFileChange(e.dataTransfer.files[0])
                }
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all ${
                isDragOver
                  ? 'border-blue-500 bg-blue-50/50 scale-[1.01]'
                  : 'border-slate-300 hover:border-blue-400 bg-slate-50/50 hover:bg-blue-50/20'
              }`}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
                accept=".xlsx,.xls,.csv,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                className="hidden"
              />

              <div className="w-14 h-14 rounded-full bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center mb-3">
                <Upload className="w-7 h-7" />
              </div>

              <h4 className="text-base font-bold text-slate-800">
                Arraste o balancete ou clique para selecionar
              </h4>
              <p className="text-xs text-slate-500 mt-1 max-w-md text-center">
                Formatos aceitos: <strong>Excel (.xlsx, .xls)</strong> ou{' '}
                <strong>PDF (.pdf)</strong>. O sistema extrairá automaticamente os saldos do Ativo,
                Passivo e grupos da DRE.
              </p>

              <Button
                type="button"
                variant="outline"
                className="mt-4 border-blue-200 text-blue-700 bg-white hover:bg-blue-50 text-xs font-semibold"
              >
                <Upload className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
                Escolher Arquivo do Balancete
              </Button>
            </div>
          )}

          {/* Progresso de leitura */}
          {processing && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-blue-900">
                <span className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                  Lendo e estruturando balancete...
                </span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-blue-200 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-blue-600 h-full rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Erro */}
          {errorMsg && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div className="text-xs text-red-800 flex-1">
                <p className="font-bold text-red-900">Não foi possível processar o arquivo</p>
                <p className="mt-0.5">{errorMsg}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                className="text-xs text-red-700 hover:bg-red-100 h-7"
              >
                Tentar outro
              </Button>
            </div>
          )}

          {/* =========================================================================
              PRÉ-VISUALIZAÇÃO DO MAPEAMENTO
          ========================================================================= */}
          {previewResult && (
            <div className="space-y-6 pt-2">
              {/* Resumo Geral do Mapeamento */}
              <div className="bg-gradient-to-r from-blue-900 via-slate-900 to-slate-800 text-white rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <h3 className="text-base font-bold text-white">
                      Pré-visualização do Balancete ({NOMES_MESES[selectedMes - 1]}/{selectedAno})
                    </h3>
                  </div>
                  <p className="text-xs text-slate-300 mt-1">
                    Arquivo: <strong className="text-white">{file?.name}</strong> ·{' '}
                    {previewResult.contasIdentificadas.length} contas contábeis mapeadas
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {originalPreviewResult && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRestaurarValoresOriginais}
                      className="bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs h-9 gap-1"
                      title="Restaurar valores detectados originalmente no arquivo"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Restaurar
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleReset}
                    className="bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs h-9"
                  >
                    Trocar Arquivo
                  </Button>
                  <Button
                    onClick={() => setConfirmModalOpen(true)}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs h-9 shadow-md gap-1.5 px-4"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Confirmar e Gravar Lançamentos
                  </Button>
                </div>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between gap-3 text-xs text-blue-900">
                <span className="flex items-center gap-1.5">
                  <Pencil className="w-4 h-4 text-blue-600 shrink-0" />
                  <strong>Ajuste Manual Célula a Célula Habilitado:</strong> Clique sobre qualquer
                  valor ou campo nas tabelas abaixo para editar manualmente antes da gravação final.
                </span>
                <Badge className="bg-white text-blue-800 border-blue-300 text-[10px] font-semibold">
                  {previewResult.contasIdentificadas.length} contas
                </Badge>
              </div>

              {/* Cards de Balanço e DRE Mapeados com Edição Célula a Célula */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Balanço Patrimonial */}
                <Card className="border-slate-200 shadow-2xs">
                  <CardHeader className="py-3 px-4 bg-slate-50/80 border-b border-slate-200 flex flex-row items-center justify-between">
                    <CardTitle className="text-xs font-bold text-[#0B1F3A] uppercase tracking-wider">
                      Balanço Patrimonial Apurado (Editável)
                    </CardTitle>
                    <Badge className="bg-blue-100 text-blue-800 text-[10px]">
                      Ativo: {formatBrlMil(previewResult.totalAtivo)}
                    </Badge>
                  </CardHeader>
                  <CardContent className="p-4 space-y-2 text-xs">
                    {[
                      { key: 'caixa_equivalentes', label: 'Caixa e Equivalentes' },
                      { key: 'aplicacoes_financeiras', label: 'Aplicações Financeiras' },
                      { key: 'contas_receber', label: 'Contas a Receber (Clientes)' },
                      { key: 'estoques', label: 'Estoques' },
                      { key: 'impostos_recuperar', label: 'Impostos a Recuperar' },
                      { key: 'imobilizado', label: 'Ativo Imobilizado' },
                      { key: 'fornecedores', label: 'Fornecedores (Passivo)' },
                      { key: 'emprestimos_curto_prazo', label: 'Empréstimos Curto Prazo' },
                      { key: 'capital_social', label: 'Capital Social' },
                      { key: 'lucros_acumulados', label: 'Lucros Acumulados' },
                    ].map((item) => {
                      const val = (previewResult.balanco as any)[item.key] || 0
                      const isEditing = editingBalancoField === item.key

                      return (
                        <div
                          key={item.key}
                          className="flex items-center justify-between py-1 border-b border-slate-100 gap-2"
                        >
                          <span className="text-slate-600 truncate">{item.label}:</span>
                          {isEditing ? (
                            <div className="flex items-center gap-1">
                              <Input
                                type="number"
                                step="any"
                                defaultValue={val}
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleUpdateBalancoField(
                                      item.key as keyof BalancoRecord,
                                      Number((e.target as HTMLInputElement).value) || 0,
                                    )
                                    setEditingBalancoField(null)
                                  } else if (e.key === 'Escape') {
                                    setEditingBalancoField(null)
                                  }
                                }}
                                onBlur={(e) => {
                                  handleUpdateBalancoField(
                                    item.key as keyof BalancoRecord,
                                    Number(e.target.value) || 0,
                                  )
                                  setEditingBalancoField(null)
                                }}
                                className="h-7 w-28 text-xs font-mono font-bold text-right"
                              />
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setEditingBalancoField(item.key)}
                              className="font-mono font-bold text-slate-800 hover:text-blue-600 hover:bg-blue-50 px-1.5 py-0.5 rounded transition-colors flex items-center gap-1 group"
                              title="Clique para editar este valor manualmente"
                            >
                              <span>{formatBrlMil(val)}</span>
                              <Pencil className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>
                          )}
                        </div>
                      )
                    })}
                    <div className="flex justify-between pt-2 font-bold text-slate-800">
                      <span>Total Passivo + PL Mapeado:</span>
                      <span className="text-blue-700">
                        {formatBrlMil(previewResult.totalPassivo)}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                {/* 2. DRE */}
                <Card className="border-slate-200 shadow-2xs">
                  <CardHeader className="py-3 px-4 bg-slate-50/80 border-b border-slate-200 flex flex-row items-center justify-between">
                    <CardTitle className="text-xs font-bold text-[#0B1F3A] uppercase tracking-wider">
                      DRE (Demonstração do Resultado — Editável)
                    </CardTitle>
                    <Badge className="bg-emerald-100 text-emerald-800 text-[10px]">
                      Receita: {formatBrlMil(previewResult.totalReceitas)}
                    </Badge>
                  </CardHeader>
                  <CardContent className="p-4 space-y-2 text-xs">
                    {[
                      { key: 'receita_bruta', label: 'Receita Bruta', color: 'text-emerald-700' },
                      {
                        key: 'deducoes_receita',
                        label: 'Deduções da Receita',
                        color: 'text-red-600',
                      },
                      {
                        key: 'custo_mercadorias',
                        label: 'Custo Mercadorias / CMV',
                        color: 'text-red-600',
                      },
                      {
                        key: 'despesas_operacionais',
                        label: 'Despesas Operacionais',
                        color: 'text-red-600',
                      },
                      {
                        key: 'despesas_financeiras',
                        label: 'Despesas Financeiras',
                        color: 'text-red-600',
                      },
                      {
                        key: 'imposto_renda',
                        label: 'Imposto de Renda / CSLL',
                        color: 'text-red-600',
                      },
                      {
                        key: 'outras_receitas_despesas',
                        label: 'Outras Rec./Desp.',
                        color: 'text-slate-700',
                      },
                    ].map((item) => {
                      const val = (previewResult.dre as any)[item.key] || 0
                      const isEditing = editingDreField === item.key

                      return (
                        <div
                          key={item.key}
                          className="flex items-center justify-between py-1 border-b border-slate-100 gap-2"
                        >
                          <span className="text-slate-600 truncate">{item.label}:</span>
                          {isEditing ? (
                            <div className="flex items-center gap-1">
                              <Input
                                type="number"
                                step="any"
                                defaultValue={val}
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleUpdateDreField(
                                      item.key as keyof DreRecord,
                                      Number((e.target as HTMLInputElement).value) || 0,
                                    )
                                    setEditingDreField(null)
                                  } else if (e.key === 'Escape') {
                                    setEditingDreField(null)
                                  }
                                }}
                                onBlur={(e) => {
                                  handleUpdateDreField(
                                    item.key as keyof DreRecord,
                                    Number(e.target.value) || 0,
                                  )
                                  setEditingDreField(null)
                                }}
                                className="h-7 w-28 text-xs font-mono font-bold text-right"
                              />
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setEditingDreField(item.key)}
                              className={`font-mono font-bold ${item.color} hover:bg-slate-100 px-1.5 py-0.5 rounded transition-colors flex items-center gap-1 group`}
                              title="Clique para editar este valor manualmente"
                            >
                              <span>{formatBrlMil(val)}</span>
                              <Pencil className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>
                          )}
                        </div>
                      )
                    })}
                    <div className="flex justify-between pt-2 font-bold text-slate-800">
                      <span>Resultado Líquido Estimado:</span>
                      <span
                        className={
                          previewResult.totalReceitas - previewResult.totalDespesas >= 0
                            ? 'text-emerald-700'
                            : 'text-red-600'
                        }
                      >
                        {formatBrlMil(previewResult.totalReceitas - previewResult.totalDespesas)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Tabela Detalhada de Contas Identificadas com Edição Célula a Célula */}
              <Card className="border-slate-200 shadow-2xs overflow-hidden">
                <CardHeader className="py-3 px-4 bg-slate-50/80 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-xs font-bold text-[#0B1F3A]">
                      Detalhamento das Contas Mapeadas ({previewResult.contasIdentificadas.length})
                    </CardTitle>
                    <CardDescription className="text-[11px]">
                      Edite nomes, códigos, grupos contábeis e valores numéricos diretamente na
                      tabela
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="text"
                      placeholder="Filtrar contas..."
                      value={filterContasTerm}
                      onChange={(e) => setFilterContasTerm(e.target.value)}
                      className="h-7 text-xs w-48 bg-white"
                    />
                  </div>
                </CardHeader>
                <div className="max-h-80 overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 sticky top-0 text-slate-700 font-semibold z-10">
                      <tr>
                        <th className="py-2 px-3 w-28">Código</th>
                        <th className="py-2 px-3">Conta / Descrição</th>
                        <th className="py-2 px-3">Grupo Contábil</th>
                        <th className="py-2 px-3 text-right">Valor (R$)</th>
                        <th className="py-2 px-3 text-center w-20">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {previewResult.contasIdentificadas
                        .map((c, originalIdx) => ({ c, originalIdx }))
                        .filter(
                          ({ c }) =>
                            !filterContasTerm ||
                            c.descricao.toLowerCase().includes(filterContasTerm.toLowerCase()) ||
                            (c.codigo && c.codigo.includes(filterContasTerm)) ||
                            c.grupoContabil.toLowerCase().includes(filterContasTerm.toLowerCase()),
                        )
                        .map(({ c, originalIdx }) => {
                          const isEditing = editingContaIdx === originalIdx

                          return (
                            <tr
                              key={c.id || originalIdx}
                              className="hover:bg-slate-50 transition-colors"
                            >
                              {/* Código */}
                              <td className="py-1.5 px-3 font-mono text-[11px] text-slate-500">
                                {isEditing ? (
                                  <Input
                                    defaultValue={c.codigo || ''}
                                    onChange={(e) =>
                                      handleUpdateContaItem(originalIdx, {
                                        codigo: e.target.value,
                                      })
                                    }
                                    className="h-6 text-[11px] font-mono"
                                  />
                                ) : (
                                  c.codigo || '—'
                                )}
                              </td>

                              {/* Descrição */}
                              <td className="py-1.5 px-3 font-medium text-slate-800">
                                {isEditing ? (
                                  <Input
                                    defaultValue={c.descricao}
                                    onChange={(e) =>
                                      handleUpdateContaItem(originalIdx, {
                                        descricao: e.target.value,
                                      })
                                    }
                                    className="h-6 text-xs"
                                  />
                                ) : (
                                  c.descricao
                                )}
                              </td>

                              {/* Grupo Contábil / Campo Mapeado */}
                              <td className="py-1.5 px-3">
                                {isEditing ? (
                                  <select
                                    value={c.campoMapeado}
                                    onChange={(e) => {
                                      const novoCampo = e.target.value
                                      handleUpdateContaItem(originalIdx, {
                                        campoMapeado: novoCampo,
                                        grupoContabil:
                                          e.target.selectedOptions[0]?.text || novoCampo,
                                      })
                                    }}
                                    className="h-6 text-[11px] rounded border border-slate-300 bg-white px-1"
                                  >
                                    <optgroup label="Ativo">
                                      <option value="caixa_equivalentes">
                                        Ativo - Caixa e Equivalentes
                                      </option>
                                      <option value="aplicacoes_financeiras">
                                        Ativo - Aplicações Financeiras
                                      </option>
                                      <option value="contas_receber">
                                        Ativo - Clientes a Receber
                                      </option>
                                      <option value="estoques">Ativo - Estoques</option>
                                      <option value="impostos_recuperar">
                                        Ativo - Impostos a Recuperar
                                      </option>
                                      <option value="imobilizado">Ativo - Imobilizado</option>
                                      <option value="intangivel">Ativo - Intangível</option>
                                      <option value="investimentos">Ativo - Investimentos</option>
                                      <option value="realizavel_longo_prazo">
                                        Ativo - Realizável LP
                                      </option>
                                      <option value="outros_ativo_circulante">
                                        Ativo - Outros Circulantes
                                      </option>
                                    </optgroup>
                                    <optgroup label="Passivo e PL">
                                      <option value="fornecedores">Passivo - Fornecedores</option>
                                      <option value="emprestimos_curto_prazo">
                                        Passivo - Empréstimos CP
                                      </option>
                                      <option value="obrigacoes_trabalhistas">
                                        Passivo - Trab./Folha
                                      </option>
                                      <option value="obrigacoes_tributarias">
                                        Passivo - Impostos/Tributos
                                      </option>
                                      <option value="emprestimos_longo_prazo">
                                        Passivo - Empréstimos LP
                                      </option>
                                      <option value="capital_social">PL - Capital Social</option>
                                      <option value="reservas_lucros">
                                        PL - Reservas de Lucros
                                      </option>
                                      <option value="lucros_acumulados">
                                        PL - Lucros Acumulados
                                      </option>
                                    </optgroup>
                                    <optgroup label="DRE (Resultado)">
                                      <option value="receita_bruta">DRE - Receita Bruta</option>
                                      <option value="deducoes_receita">
                                        DRE - Deduções da Receita
                                      </option>
                                      <option value="custo_mercadorias">DRE - CMV / Custos</option>
                                      <option value="despesas_operacionais">
                                        DRE - Despesas Operacionais
                                      </option>
                                      <option value="despesas_financeiras">
                                        DRE - Despesas Financeiras
                                      </option>
                                      <option value="imposto_renda">DRE - IRPJ / CSLL</option>
                                      <option value="outras_receitas_despesas">
                                        DRE - Outras Receitas/Desp.
                                      </option>
                                    </optgroup>
                                  </select>
                                ) : (
                                  <Badge className="text-[10px] bg-slate-100 text-slate-700 border-slate-200">
                                    {c.grupoContabil}
                                  </Badge>
                                )}
                              </td>

                              {/* Valor */}
                              <td className="py-1.5 px-3 text-right font-mono font-semibold text-slate-900">
                                {isEditing ? (
                                  <Input
                                    type="number"
                                    step="any"
                                    defaultValue={c.valor}
                                    onChange={(e) =>
                                      handleUpdateContaItem(originalIdx, {
                                        valor: Number(e.target.value) || 0,
                                      })
                                    }
                                    className="h-6 text-xs font-mono text-right w-28 ml-auto"
                                  />
                                ) : (
                                  formatBrlMil(c.valor)
                                )}
                              </td>

                              {/* Ações */}
                              <td className="py-1.5 px-3 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  {isEditing ? (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => setEditingContaIdx(null)}
                                      className="h-6 w-6 p-0 text-emerald-600 hover:bg-emerald-50"
                                      title="Salvar edição"
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                    </Button>
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => setEditingContaIdx(originalIdx)}
                                      className="h-6 w-6 p-0 text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                                      title="Editar célula"
                                    >
                                      <Pencil className="w-3 h-3" />
                                    </Button>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleRemoverContaItem(originalIdx)}
                                    className="h-6 w-6 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50"
                                    title="Remover do balancete"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>

      {/* =========================================================================
          MODAL DE CONFIRMAÇÃO DE GRAVAÇÃO
      ========================================================================= */}
      <Dialog open={confirmModalOpen} onOpenChange={setConfirmModalOpen}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#0B1F3A]">
              Confirmar Importação de Balancete
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Gravar lançamentos mensais de Balanço e DRE para {NOMES_MESES[selectedMes - 1]}/
              {selectedAno}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-xs py-2 text-slate-700 leading-relaxed">
            <p>
              Os dados extraídos do arquivo <strong>{file?.name}</strong> serão gravados na
              competência de{' '}
              <strong>
                {NOMES_MESES[selectedMes - 1]} de {selectedAno}
              </strong>{' '}
              da empresa selecionada.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-blue-900 text-[11px] space-y-1">
              <p>
                • Se já existirem registros para este mês, eles serão atualizados com os novos
                saldos.
              </p>
              <p>• Os dados ficam integrados na Análise da Empresa e no Comparativo Mês a Mês.</p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmModalOpen(false)}
              disabled={savingImport}
              className="text-xs h-8"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleConfirmarGravacao}
              disabled={savingImport}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-8"
            >
              {savingImport ? 'Gravando...' : 'Confirmar e Gravar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
