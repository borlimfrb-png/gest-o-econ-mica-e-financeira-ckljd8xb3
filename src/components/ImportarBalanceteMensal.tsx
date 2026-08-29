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
import { mapearBalanceteParaBalancoEDre, type BalanceteMapeadoResult } from '@/lib/balanceteParser'
import { balancosService, dreService } from '@/services/financeService'

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
  const [rawRowsCount, setRawRowsCount] = useState<number>(0)
  const [confirmModalOpen, setConfirmModalOpen] = useState(false)
  const [savingImport, setSavingImport] = useState(false)

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
      toast({
        title: 'Balancete Processado com Sucesso!',
        description: `${mapped.contasIdentificadas.length} contas contábeis foram mapeadas para Balanço e DRE de ${NOMES_MESES[selectedMes - 1]}/${selectedAno}.`,
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
    setErrorMsg(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
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

                <div className="flex items-center gap-2.5">
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

              {/* Cards de Balanço e DRE Mapeados */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Balanço Patrimonial */}
                <Card className="border-slate-200 shadow-2xs">
                  <CardHeader className="py-3 px-4 bg-slate-50/80 border-b border-slate-200 flex flex-row items-center justify-between">
                    <CardTitle className="text-xs font-bold text-[#0B1F3A] uppercase tracking-wider">
                      Balanço Patrimonial Apurado
                    </CardTitle>
                    <Badge className="bg-blue-100 text-blue-800 text-[10px]">
                      Ativo: {formatBrlMil(previewResult.totalAtivo)}
                    </Badge>
                  </CardHeader>
                  <CardContent className="p-4 space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-600">Caixa e Equivalentes:</span>
                      <strong className="font-mono">
                        {formatBrlMil(previewResult.balanco.caixa_equivalentes)}
                      </strong>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-600">Aplicações Financeiras:</span>
                      <strong className="font-mono">
                        {formatBrlMil(previewResult.balanco.aplicacoes_financeiras)}
                      </strong>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-600">Contas a Receber (Clientes):</span>
                      <strong className="font-mono">
                        {formatBrlMil(previewResult.balanco.contas_receber)}
                      </strong>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-600">Estoques:</span>
                      <strong className="font-mono">
                        {formatBrlMil(previewResult.balanco.estoques)}
                      </strong>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-600">Ativo Imobilizado:</span>
                      <strong className="font-mono">
                        {formatBrlMil(previewResult.balanco.imobilizado)}
                      </strong>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-600">Fornecedores (Passivo):</span>
                      <strong className="font-mono">
                        {formatBrlMil(previewResult.balanco.fornecedores)}
                      </strong>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-600">Empréstimos e Financiamentos:</span>
                      <strong className="font-mono">
                        {formatBrlMil(
                          (previewResult.balanco.emprestimos_curto_prazo || 0) +
                            (previewResult.balanco.emprestimos_longo_prazo || 0),
                        )}
                      </strong>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-600">Capital Social:</span>
                      <strong className="font-mono">
                        {formatBrlMil(previewResult.balanco.capital_social)}
                      </strong>
                    </div>
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
                      DRE (Demonstração do Resultado)
                    </CardTitle>
                    <Badge className="bg-emerald-100 text-emerald-800 text-[10px]">
                      Receita: {formatBrlMil(previewResult.totalReceitas)}
                    </Badge>
                  </CardHeader>
                  <CardContent className="p-4 space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-600">Receita Bruta:</span>
                      <strong className="font-mono text-emerald-700">
                        {formatBrlMil(previewResult.dre.receita_bruta)}
                      </strong>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-600">Deduções da Receita:</span>
                      <strong className="font-mono text-red-600">
                        {formatBrlMil(previewResult.dre.deducoes_receita)}
                      </strong>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-600">Custo Mercadorias / CMV:</span>
                      <strong className="font-mono text-red-600">
                        {formatBrlMil(previewResult.dre.custo_mercadorias)}
                      </strong>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-600">Despesas Operacionais:</span>
                      <strong className="font-mono text-red-600">
                        {formatBrlMil(previewResult.dre.despesas_operacionais)}
                      </strong>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-600">Despesas Financeiras:</span>
                      <strong className="font-mono text-red-600">
                        {formatBrlMil(previewResult.dre.despesas_financeiras)}
                      </strong>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-600">Imposto de Renda / CSLL:</span>
                      <strong className="font-mono text-red-600">
                        {formatBrlMil(previewResult.dre.imposto_renda)}
                      </strong>
                    </div>
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

              {/* Tabela de Contas Identificadas */}
              <Card className="border-slate-200 shadow-2xs overflow-hidden">
                <CardHeader className="py-3 px-4 bg-slate-50/80 border-b border-slate-200">
                  <CardTitle className="text-xs font-bold text-[#0B1F3A]">
                    Detalhamento das Contas Mapeadas ({previewResult.contasIdentificadas.length})
                  </CardTitle>
                </CardHeader>
                <div className="max-h-64 overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 sticky top-0 text-slate-700 font-semibold">
                      <tr>
                        <th className="py-2 px-3">Código</th>
                        <th className="py-2 px-3">Conta / Descrição</th>
                        <th className="py-2 px-3">Grupo Mapeado</th>
                        <th className="py-2 px-3 text-right">Valor (R$)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {previewResult.contasIdentificadas.map((c, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="py-1.5 px-3 font-mono text-[11px] text-slate-500">
                            {c.codigo || '—'}
                          </td>
                          <td className="py-1.5 px-3 font-medium text-slate-800">{c.descricao}</td>
                          <td className="py-1.5 px-3">
                            <Badge className="text-[10px] bg-slate-100 text-slate-700 border-slate-200">
                              {c.grupoContabil}
                            </Badge>
                          </td>
                          <td className="py-1.5 px-3 text-right font-mono font-semibold text-slate-900">
                            {formatBrlMil(c.valor)}
                          </td>
                        </tr>
                      ))}
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
