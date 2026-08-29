import React, { useState, useRef, useMemo } from 'react'
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Pencil,
  RotateCcw,
  Building2,
  Calendar,
  Layers,
  Trash2,
  Check,
  RefreshCw,
  Eye,
  FileText,
  Plus,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
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
import { formatBrlMil } from '@/lib/financeCalculations'
import {
  mapearBalanceteParaBalancoEDre,
  recalcularBalanceteMapeado,
  type BalanceteMapeadoResult,
  type ContaMapeadaItem,
} from '@/lib/balanceteParser'
import { extractTextFromPdf, parseBrlNumber } from '@/lib/pdfParser'
import { convertPdfPagesToExcelRows } from '@/lib/pdfToExcel'
import { balancosService, dreService } from '@/services/financeService'
import type { EmpresaRecord, BalancoRecord, DreRecord } from '@/types/finance'
import { useNavigate } from 'react-router-dom'
import * as XLSX from 'xlsx'

const NOMES_MESES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

/**
 * Tenta inferir o mês (1-12) pelo nome do arquivo (ex: "balancete_janeiro_2024.xlsx", "01-2024.pdf", "mar24.xlsx")
 */
function inferirMesPeloNomeArquivo(nome: string, mesPadrao: number): number {
  const norm = nome.toLowerCase()
  const mesesKeywords = [
    {
      mes: 1,
      keys: ['janeiro', 'jan', '-01-', '_01_', '-01.', '_01.', '01_20', '01-20', 'jan2', 'jan_'],
    },
    {
      mes: 2,
      keys: ['fevereiro', 'fev', '-02-', '_02_', '-02.', '_02.', '02_20', '02-20', 'fev2', 'fev_'],
    },
    {
      mes: 3,
      keys: [
        'marco',
        'março',
        'mar',
        '-03-',
        '_03_',
        '-03.',
        '_03.',
        '03_20',
        '03-20',
        'mar2',
        'mar_',
      ],
    },
    {
      mes: 4,
      keys: ['abril', 'abr', '-04-', '_04_', '-04.', '_04.', '04_20', '04-20', 'abr2', 'abr_'],
    },
    {
      mes: 5,
      keys: ['maio', 'mai', '-05-', '_05_', '-05.', '_05.', '05_20', '05-20', 'mai2', 'mai_'],
    },
    {
      mes: 6,
      keys: ['junho', 'jun', '-06-', '_06_', '-06.', '_06.', '06_20', '06-20', 'jun2', 'jun_'],
    },
    {
      mes: 7,
      keys: ['julho', 'jul', '-07-', '_07_', '-07.', '_07.', '07_20', '07-20', 'jul2', 'jul_'],
    },
    {
      mes: 8,
      keys: ['agosto', 'ago', '-08-', '_08_', '-08.', '_08.', '08_20', '08-20', 'ago2', 'ago_'],
    },
    {
      mes: 9,
      keys: ['setembro', 'set', '-09-', '_09_', '-09.', '_09.', '09_20', '09-20', 'set2', 'set_'],
    },
    {
      mes: 10,
      keys: ['outubro', 'out', '-10-', '_10_', '-10.', '_10.', '10_20', '10-20', 'out2', 'out_'],
    },
    {
      mes: 11,
      keys: ['novembro', 'nov', '-11-', '_11_', '-11.', '_11.', '11_20', '11-20', 'nov2', 'nov_'],
    },
    {
      mes: 12,
      keys: ['dezembro', 'dez', '-12-', '_12_', '-12.', '_12.', '12_20', '12-20', 'dez2', 'dez_'],
    },
  ]

  for (const m of mesesKeywords) {
    if (m.keys.some((k) => norm.includes(k))) {
      return m.mes
    }
  }
  return mesPadrao
}

export interface BalanceteArquivoItem {
  id: string
  file: File
  mes: number
  ano: number
  status: 'pendente' | 'processando' | 'processado' | 'erro' | 'gravado'
  progress: number
  errorMsg?: string
  previewResult?: BalanceteMapeadoResult
  originalPreviewResult?: BalanceteMapeadoResult
}

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
    initialEmpresaId || empresas[0]?.id || '',
  )
  const [selectedAno, setSelectedAno] = useState<number>(initialAno || new Date().getFullYear())

  // Lista de arquivos selecionados (múltiplos balancetes)
  const [arquivos, setArquivos] = useState<BalanceteArquivoItem[]>([])
  // Índice do arquivo ativo para revisão e edição célula a célula
  const [activeArquivoId, setActiveArquivoId] = useState<string | null>(null)

  const [confirmModalOpen, setConfirmModalOpen] = useState(false)
  const [savingImport, setSavingImport] = useState(false)

  // Controle de edição manual célula a célula no balancete ativo
  const [editingContaIdx, setEditingContaIdx] = useState<number | null>(null)
  const [editingBalancoField, setEditingBalancoField] = useState<string | null>(null)
  const [editingDreField, setEditingDreField] = useState<string | null>(null)
  const [filterContasTerm, setFilterContasTerm] = useState('')

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  // Balancete atualmente em visualização detalhada
  const activeBalancete = useMemo(() => {
    return arquivos.find((a) => a.id === activeArquivoId) || arquivos[0] || null
  }, [arquivos, activeArquivoId])

  // Processa um arquivo individual (Excel ou PDF) para extrair as linhas e mapear
  const processarArquivoIndividual = async (
    item: BalanceteArquivoItem,
    empresaId: string,
    ano: number,
  ): Promise<BalanceteArquivoItem> => {
    const { file, mes } = item
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    const isExcel =
      file.type.includes('sheet') ||
      file.type.includes('excel') ||
      file.name.toLowerCase().endsWith('.xlsx') ||
      file.name.toLowerCase().endsWith('.xls') ||
      file.name.toLowerCase().endsWith('.csv')

    if (!isPdf && !isExcel) {
      return {
        ...item,
        status: 'erro',
        progress: 100,
        errorMsg: 'Formato não suportado. Envie Excel (.xlsx, .xls) ou PDF (.pdf).',
      }
    }

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
        const pdfResult = await extractTextFromPdf(file)
        if (pdfResult.isScannedOrEmpty) {
          throw new Error('PDF escaneado como imagem ou sem texto legível.')
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
        const arrayBuffer = await file.arrayBuffer()
        const wb = XLSX.read(arrayBuffer, { type: 'array' })
        const sheetName = wb.SheetNames[0]
        const ws = wb.Sheets[sheetName]
        const jsonRows = XLSX.utils.sheet_to_json<any>(ws, { header: 1 })

        for (const row of jsonRows) {
          if (!Array.isArray(row) || row.length === 0) continue
          let codigo = ''
          let desc = ''
          let valor = 0

          for (const cell of row) {
            const cellStr = String(cell || '').trim()
            if (!cellStr) continue

            if (/^\d{1,5}(?:\.\d+)*$/.test(cellStr) && !codigo) {
              codigo = cellStr
              continue
            }

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

      if (extractedRows.length === 0) {
        throw new Error('Nenhuma linha contábil com valor válido foi identificada.')
      }

      const mapped = mapearBalanceteParaBalancoEDre(extractedRows, ano, mes, empresaId)
      return {
        ...item,
        status: 'processado',
        progress: 100,
        previewResult: mapped,
        originalPreviewResult: JSON.parse(JSON.stringify(mapped)),
      }
    } catch (err: any) {
      return {
        ...item,
        status: 'erro',
        progress: 100,
        errorMsg: err?.message || 'Falha ao processar balancete.',
      }
    }
  }

  // Lida com múltiplos arquivos selecionados
  const handleFilesSelected = async (fileList: FileList | File[]) => {
    const filesArray = Array.from(fileList)
    if (filesArray.length === 0) return

    const novosItens: BalanceteArquivoItem[] = []
    let proximoMesBase = initialMes || new Date().getMonth() + 1

    // Adiciona cada arquivo descobrindo ou incrementando o mês
    filesArray.forEach((f, idx) => {
      const mesInferido = inferirMesPeloNomeArquivo(
        f.name,
        Math.min(12, Math.max(1, proximoMesBase + idx)),
      )
      novosItens.push({
        id: `balancete-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`,
        file: f,
        mes: mesInferido,
        ano: selectedAno,
        status: 'processando',
        progress: 20,
      })
    })

    const listaAtualizada = [...arquivos, ...novosItens]
    setArquivos(listaAtualizada)
    if (!activeArquivoId && novosItens.length > 0) {
      setActiveArquivoId(novosItens[0].id)
    }

    // Processa os novos arquivos
    for (const item of novosItens) {
      const resultadoProcessado = await processarArquivoIndividual(
        item,
        selectedEmpresaId,
        selectedAno,
      )
      setArquivos((prev) => prev.map((a) => (a.id === item.id ? resultadoProcessado : a)))
    }

    toast({
      title: `${novosItens.length} arquivo(s) adicionado(s)`,
      description: 'Revise os meses atribuídos e confira a pré-visualização de cada balancete.',
    })
  }

  // Alterar mês de um arquivo específico
  const handleChangeMesArquivo = (id: string, novoMes: number) => {
    setArquivos((prev) =>
      prev.map((a) => {
        if (a.id !== id) return a
        let novoPreview = a.previewResult
        if (novoPreview) {
          novoPreview = recalcularBalanceteMapeado(
            novoPreview.contasIdentificadas,
            selectedAno,
            novoMes,
            selectedEmpresaId,
          )
        }
        return {
          ...a,
          mes: novoMes,
          previewResult: novoPreview,
        }
      }),
    )
  }

  // Remover arquivo da lista de importação
  const handleRemoverArquivo = (id: string) => {
    setArquivos((prev) => {
      const filtered = prev.filter((a) => a.id !== id)
      if (activeArquivoId === id) {
        setActiveArquivoId(filtered[0]?.id || null)
      }
      return filtered
    })
  }

  // Reprocessar arquivo específico
  const handleReprocessarArquivo = async (id: string) => {
    const item = arquivos.find((a) => a.id === id)
    if (!item) return
    setArquivos((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: 'processando', progress: 20 } : a)),
    )
    const res = await processarArquivoIndividual(item, selectedEmpresaId, selectedAno)
    setArquivos((prev) => prev.map((a) => (a.id === id ? res : a)))
  }

  // Atualização direta de campo do Balanço no arquivo ativo
  const handleUpdateBalancoField = (campo: keyof BalancoRecord, novoValor: number) => {
    if (!activeBalancete?.previewResult) return
    const prevRes = activeBalancete.previewResult
    const updatedBalanco = {
      ...prevRes.balanco,
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

    const updatedResult: BalanceteMapeadoResult = {
      ...prevRes,
      balanco: updatedBalanco,
      totalAtivo,
      totalPassivo,
    }

    setArquivos((prev) =>
      prev.map((a) => (a.id === activeBalancete.id ? { ...a, previewResult: updatedResult } : a)),
    )
  }

  // Atualização direta de campo da DRE no arquivo ativo
  const handleUpdateDreField = (campo: keyof DreRecord, novoValor: number) => {
    if (!activeBalancete?.previewResult) return
    const prevRes = activeBalancete.previewResult
    const updatedDre = {
      ...prevRes.dre,
      [campo]: novoValor,
    }

    const totalReceitas = updatedDre.receita_bruta || 0
    const totalDespesas =
      (updatedDre.deducoes_receita || 0) +
      (updatedDre.custo_mercadorias || 0) +
      (updatedDre.despesas_operacionais || 0) +
      (updatedDre.despesas_financeiras || 0) +
      (updatedDre.imposto_renda || 0)

    const updatedResult: BalanceteMapeadoResult = {
      ...prevRes,
      dre: updatedDre,
      totalReceitas,
      totalDespesas,
    }

    setArquivos((prev) =>
      prev.map((a) => (a.id === activeBalancete.id ? { ...a, previewResult: updatedResult } : a)),
    )
  }

  // Atualização de uma conta da tabela detalhada no arquivo ativo
  const handleUpdateContaItem = (index: number, updatedFields: Partial<ContaMapeadaItem>) => {
    if (!activeBalancete?.previewResult) return
    const novasContas = [...activeBalancete.previewResult.contasIdentificadas]
    novasContas[index] = {
      ...novasContas[index],
      ...updatedFields,
    }

    const recalculado = recalcularBalanceteMapeado(
      novasContas,
      selectedAno,
      activeBalancete.mes,
      selectedEmpresaId,
    )

    setArquivos((prev) =>
      prev.map((a) => (a.id === activeBalancete.id ? { ...a, previewResult: recalculado } : a)),
    )
  }

  // Exclusão de conta da lista no arquivo ativo
  const handleRemoverContaItem = (index: number) => {
    if (!activeBalancete?.previewResult) return
    const novasContas = activeBalancete.previewResult.contasIdentificadas.filter(
      (_, idx) => idx !== index,
    )
    const recalculado = recalcularBalanceteMapeado(
      novasContas,
      selectedAno,
      activeBalancete.mes,
      selectedEmpresaId,
    )

    setArquivos((prev) =>
      prev.map((a) => (a.id === activeBalancete.id ? { ...a, previewResult: recalculado } : a)),
    )
    toast({
      title: 'Conta removida do balancete',
      description: 'Os totais de Balanço e DRE foram recalculados.',
    })
  }

  // Restaurar valores originais do balancete ativo
  const handleRestaurarValoresOriginais = () => {
    if (activeBalancete?.originalPreviewResult) {
      const original = JSON.parse(JSON.stringify(activeBalancete.originalPreviewResult))
      setArquivos((prev) =>
        prev.map((a) => (a.id === activeBalancete.id ? { ...a, previewResult: original } : a)),
      )
      toast({
        title: 'Valores restaurados',
        description:
          'Os valores deste balancete voltaram à detecção automática inicial do arquivo.',
      })
    }
  }

  // Confirmar e gravar todos os balancetes processados com sucesso
  const handleConfirmarGravacaoLote = async () => {
    const prontosParaGravar = arquivos.filter((a) => a.status === 'processado' && a.previewResult)
    if (prontosParaGravar.length === 0 || !selectedEmpresaId) {
      toast({
        variant: 'destructive',
        title: 'Nenhum balancete pronto para gravação',
        description: 'Adicione e processe pelo menos um balancete válido.',
      })
      return
    }

    setSavingImport(true)
    let sucessos = 0
    const erros: string[] = []

    try {
      for (const item of prontosParaGravar) {
        try {
          const res = item.previewResult!
          await Promise.all([
            balancosService.upsert(
              selectedEmpresaId,
              selectedAno,
              {
                ...res.balanco,
                ano: selectedAno,
                mes: item.mes,
                fechado: false,
                fechamento_obs: `Importado de Balancete Mensal (${item.file.name})`,
              },
              item.mes,
            ),
            dreService.upsert(
              selectedEmpresaId,
              selectedAno,
              {
                ...res.dre,
                ano: selectedAno,
                mes: item.mes,
                fechado: false,
                fechamento_obs: `Importado de Balancete Mensal (${item.file.name})`,
              },
              item.mes,
            ),
          ])
          sucessos++
        } catch (err: any) {
          erros.push(`${NOMES_MESES[item.mes - 1]}: ${err?.message || 'Erro desconhecido'}`)
        }
      }

      if (sucessos > 0) {
        toast({
          title: `${sucessos} Balancete(s) Gravado(s) com Sucesso!`,
          description: `Os registros de Balanço e DRE para os respectivos meses de ${selectedAno} foram atualizados.`,
        })

        setConfirmModalOpen(false)
        if (onImportSuccess) {
          onImportSuccess(selectedEmpresaId, selectedAno, prontosParaGravar[0].mes)
        } else {
          navigate(`/empresas/${selectedEmpresaId}?aba=comparativo-mensal`)
        }
      } else {
        toast({
          variant: 'destructive',
          title: 'Erro ao gravar balancetes',
          description: erros.join(' | ') || 'Não foi possível gravar os dados no banco.',
        })
      }
    } catch (err: any) {
      console.error('Erro ao gravar balancetes em lote:', err)
      toast({
        variant: 'destructive',
        title: 'Falha na gravação',
        description: err?.message || 'Erro ao persistir informações no banco de dados.',
      })
    } finally {
      setSavingImport(false)
    }
  }

  const arquivosProcessadosValidos = arquivos.filter(
    (a) => a.status === 'processado' && a.previewResult,
  )

  return (
    <div className="space-y-6">
      {/* Card Principal de Seleção e Múltiplos Arquivos */}
      <Card className="bg-white border-slate-200 shadow-2xs">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 font-bold">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-base font-bold text-[#0B1F3A]">
                Importar Balancetes Mensais (Excel / PDF)
              </CardTitle>
              <CardDescription className="text-xs">
                Selecione múltiplos arquivos de uma vez (um balancete por mês) para gerar
                automaticamente os lançamentos de Balanço e DRE de cada competência.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Seletores de Empresa e Ano */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/80 p-4 rounded-xl border border-slate-200/80">
            <div>
              <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 mb-1.5">
                <Building2 className="w-3.5 h-3.5 text-blue-600" />
                Empresa Destino
              </Label>
              <Select
                value={selectedEmpresaId}
                onValueChange={(val) => {
                  setSelectedEmpresaId(val)
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
                  const ano = Number(e.target.value)
                  setSelectedAno(ano)
                  // Atualiza ano nos arquivos já carregados
                  setArquivos((prev) =>
                    prev.map((a) => ({
                      ...a,
                      ano,
                      previewResult: a.previewResult
                        ? recalcularBalanceteMapeado(
                            a.previewResult.contasIdentificadas,
                            ano,
                            a.mes,
                            selectedEmpresaId,
                          )
                        : undefined,
                    })),
                  )
                }}
                className="h-9 text-xs bg-white"
              />
            </div>
          </div>

          {/* Área de Drag and Drop de Múltiplos Arquivos */}
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setIsDragOver(true)
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => {
              e.preventDefault()
              setIsDragOver(false)
              if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                handleFilesSelected(e.dataTransfer.files)
              }
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all ${
              isDragOver
                ? 'border-blue-500 bg-blue-50/50 scale-[1.01]'
                : 'border-slate-300 hover:border-blue-400 bg-slate-50/50 hover:bg-blue-50/20'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              multiple
              onChange={(e) => e.target.files && handleFilesSelected(e.target.files)}
              accept=".xlsx,.xls,.csv,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              className="hidden"
            />

            <div className="w-12 h-12 rounded-full bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center mb-2">
              <Upload className="w-6 h-6" />
            </div>

            <h4 className="text-sm font-bold text-slate-800">
              Arraste múltiplos balancetes (um por mês) ou clique para selecionar
            </h4>
            <p className="text-xs text-slate-500 mt-1 max-w-md text-center">
              Formatos aceitos: <strong>Excel (.xlsx, .xls)</strong> ou <strong>PDF (.pdf)</strong>.
              O sistema identificará cada mês e gerará os dados de Balanço e DRE correspondentes.
            </p>

            <Button
              type="button"
              variant="outline"
              className="mt-3 border-blue-200 text-blue-700 bg-white hover:bg-blue-50 text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
              Adicionar Arquivo(s) de Balancete
            </Button>
          </div>

          {/* =========================================================================
              LISTA DE ARQUIVOS CARREGADOS COM SELETOR DE MÊS POR ARQUIVO
          ========================================================================= */}
          {arquivos.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-[#0B1F3A] uppercase tracking-wider flex items-center gap-2">
                  <Layers className="w-4 h-4 text-blue-600" />
                  Balancetes Selecionados ({arquivos.length})
                </h3>
                <span className="text-[11px] text-slate-500">
                  {arquivosProcessadosValidos.length} de {arquivos.length} prontos para gravação
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {arquivos.map((item) => {
                  const isActive = activeBalancete?.id === item.id
                  const isProcessing = item.status === 'processando'
                  const isError = item.status === 'erro'
                  const isDone = item.status === 'processado'

                  return (
                    <div
                      key={item.id}
                      className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between gap-3 ${
                        isActive
                          ? 'border-blue-500 bg-blue-50/40 shadow-sm ring-1 ring-blue-500'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div>
                        {/* Cabeçalho do Card do Arquivo */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="p-1.5 bg-slate-100 rounded-lg shrink-0 text-slate-700">
                              {item.file.name.toLowerCase().endsWith('.pdf') ? (
                                <FileText className="w-4 h-4 text-red-600" />
                              ) : (
                                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p
                                className="text-xs font-bold text-slate-900 truncate"
                                title={item.file.name}
                              >
                                {item.file.name}
                              </p>
                              <p className="text-[10px] text-slate-500">
                                {(item.file.size / 1024).toFixed(0)} KB
                              </p>
                            </div>
                          </div>

                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoverArquivo(item.id)}
                            className="h-6 w-6 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50"
                            title="Remover este arquivo"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>

                        {/* Seletor de Competência (Mês) */}
                        <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
                          <Label className="text-[11px] font-semibold text-slate-600 shrink-0">
                            Mês:
                          </Label>
                          <Select
                            value={String(item.mes)}
                            onValueChange={(val) => handleChangeMesArquivo(item.id, Number(val))}
                          >
                            <SelectTrigger className="h-7 text-xs bg-white font-bold w-36">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {NOMES_MESES.map((nome, idx) => (
                                <SelectItem
                                  key={idx + 1}
                                  value={String(idx + 1)}
                                  className="text-xs"
                                >
                                  {idx + 1} - {nome}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Status / Progresso */}
                        <div className="mt-2 text-xs">
                          {isProcessing && (
                            <div className="flex items-center gap-1.5 text-blue-600 text-[11px] font-medium">
                              <RefreshCw className="w-3 h-3 animate-spin" />
                              Processando balancete...
                            </div>
                          )}
                          {isError && (
                            <div className="text-[11px] text-red-600 font-medium flex items-center gap-1">
                              <AlertCircle className="w-3 h-3 shrink-0" />
                              <span className="truncate">{item.errorMsg || 'Erro na leitura'}</span>
                            </div>
                          )}
                          {isDone && item.previewResult && (
                            <div className="flex items-center justify-between text-[11px] text-slate-600">
                              <span className="text-emerald-700 font-semibold flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                {item.previewResult.contasIdentificadas.length} contas mapeadas
                              </span>
                              <span className="font-mono text-slate-700 font-bold">
                                Ativo: {formatBrlMil(item.previewResult.totalAtivo)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Botões de Ação do Arquivo */}
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                        {isError ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleReprocessarArquivo(item.id)}
                            className="text-[10px] h-6 px-2 text-slate-700"
                          >
                            Reprocessar
                          </Button>
                        ) : isDone ? (
                          <Button
                            type="button"
                            size="sm"
                            variant={isActive ? 'default' : 'outline'}
                            onClick={() => setActiveArquivoId(item.id)}
                            className={`text-[10px] h-6 px-2.5 gap-1 font-semibold ${
                              isActive
                                ? 'bg-blue-600 text-white hover:bg-blue-700'
                                : 'text-blue-700 border-blue-200 hover:bg-blue-50'
                            }`}
                          >
                            <Eye className="w-3 h-3" />
                            {isActive ? 'Revisando' : 'Revisar / Editar'}
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Botão de Gravação Geral em Lote */}
              {arquivosProcessadosValidos.length > 0 && (
                <div className="bg-slate-900 text-white rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md mt-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      <h4 className="text-sm font-bold text-white">
                        {arquivosProcessadosValidos.length} balancete(s) pronto(s) para gravação
                      </h4>
                    </div>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Competências:{' '}
                      {arquivosProcessadosValidos
                        .map((a) => `${NOMES_MESES[a.mes - 1]}/${selectedAno}`)
                        .join(', ')}
                    </p>
                  </div>

                  <Button
                    type="button"
                    onClick={() => setConfirmModalOpen(true)}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs h-9 shadow-md gap-1.5 px-4 self-start sm:self-auto"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Confirmar e Gravar Todos ({arquivosProcessadosValidos.length})
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* =========================================================================
              PRÉ-VISUALIZAÇÃO E EDIÇÃO DO BALANCETE ATIVO
          ========================================================================= */}
          {activeBalancete?.previewResult && (
            <div className="space-y-6 pt-4 border-t border-slate-200">
              {/* Cabeçalho de Revisão do Arquivo Ativo */}
              <div className="bg-gradient-to-r from-blue-900 via-slate-900 to-slate-800 text-white rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <h3 className="text-sm font-bold text-white">
                      Revisando Balancete: {NOMES_MESES[activeBalancete.mes - 1]} / {selectedAno}
                    </h3>
                  </div>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Arquivo: <strong className="text-white">{activeBalancete.file.name}</strong> ·{' '}
                    {activeBalancete.previewResult.contasIdentificadas.length} contas contábeis
                    mapeadas
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {activeBalancete.originalPreviewResult && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRestaurarValoresOriginais}
                      className="bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs h-8 gap-1"
                      title="Restaurar valores detectados originalmente no arquivo"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Restaurar
                    </Button>
                  )}
                </div>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between gap-3 text-xs text-blue-900">
                <span className="flex items-center gap-1.5">
                  <Pencil className="w-4 h-4 text-blue-600 shrink-0" />
                  <strong>Edição Célula a Célula Habilitada:</strong> Clique sobre qualquer valor
                  nas tabelas abaixo para editar manualmente antes da gravação final.
                </span>
                <Badge className="bg-white text-blue-800 border-blue-300 text-[10px] font-semibold">
                  {activeBalancete.previewResult.contasIdentificadas.length} contas
                </Badge>
              </div>

              {/* Cards de Balanço e DRE Mapeados com Edição Célula a Célula */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Balanço Patrimonial */}
                <Card className="border-slate-200 shadow-2xs">
                  <CardHeader className="py-3 px-4 bg-slate-50/80 border-b border-slate-200 flex flex-row items-center justify-between">
                    <CardTitle className="text-xs font-bold text-[#0B1F3A] uppercase tracking-wider">
                      Balanço Patrimonial Apurado ({NOMES_MESES[activeBalancete.mes - 1]})
                    </CardTitle>
                    <Badge className="bg-blue-100 text-blue-800 text-[10px]">
                      Ativo: {formatBrlMil(activeBalancete.previewResult.totalAtivo)}
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
                      const val = (activeBalancete.previewResult?.balanco as any)?.[item.key] || 0
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
                        {formatBrlMil(activeBalancete.previewResult.totalPassivo)}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                {/* 2. DRE */}
                <Card className="border-slate-200 shadow-2xs">
                  <CardHeader className="py-3 px-4 bg-slate-50/80 border-b border-slate-200 flex flex-row items-center justify-between">
                    <CardTitle className="text-xs font-bold text-[#0B1F3A] uppercase tracking-wider">
                      DRE (Demonstração do Resultado — {NOMES_MESES[activeBalancete.mes - 1]})
                    </CardTitle>
                    <Badge className="bg-emerald-100 text-emerald-800 text-[10px]">
                      Receita: {formatBrlMil(activeBalancete.previewResult.totalReceitas)}
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
                      const val = (activeBalancete.previewResult?.dre as any)?.[item.key] || 0
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
                          activeBalancete.previewResult.totalReceitas -
                            activeBalancete.previewResult.totalDespesas >=
                          0
                            ? 'text-emerald-700'
                            : 'text-red-600'
                        }
                      >
                        {formatBrlMil(
                          activeBalancete.previewResult.totalReceitas -
                            activeBalancete.previewResult.totalDespesas,
                        )}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Tabela Detalhada de Contas Identificadas */}
              <Card className="border-slate-200 shadow-2xs overflow-hidden">
                <CardHeader className="py-3 px-4 bg-slate-50/80 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-xs font-bold text-[#0B1F3A]">
                      Detalhamento das Contas Mapeadas (
                      {activeBalancete.previewResult.contasIdentificadas.length})
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
                      {activeBalancete.previewResult.contasIdentificadas
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
          MODAL DE CONFIRMAÇÃO DE GRAVAÇÃO EM LOTE
      ========================================================================= */}
      <Dialog open={confirmModalOpen} onOpenChange={setConfirmModalOpen}>
        <DialogContent className="sm:max-w-lg bg-white">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#0B1F3A]">
              Confirmar Gravação de Balancetes Mensais
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Gravar lançamentos de Balanço e DRE para {arquivosProcessadosValidos.length}{' '}
              competência(s) de {selectedAno}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-xs py-2 text-slate-700 leading-relaxed">
            <p>
              Os seguintes balancetes serão gravados para a empresa selecionada no exercício de{' '}
              <strong>{selectedAno}</strong>:
            </p>

            <div className="max-h-48 overflow-y-auto space-y-1.5 border border-slate-200 rounded-xl p-2.5 bg-slate-50">
              {arquivosProcessadosValidos.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between text-xs py-1 px-2 bg-white rounded-lg border border-slate-100"
                >
                  <span className="font-bold text-[#0B1F3A]">
                    {NOMES_MESES[a.mes - 1]} / {selectedAno}
                  </span>
                  <span className="text-slate-500 text-[11px] truncate max-w-[200px]">
                    {a.file.name}
                  </span>
                  <span className="font-mono text-emerald-700 font-semibold text-[11px]">
                    Ativo: {formatBrlMil(a.previewResult?.totalAtivo || 0)}
                  </span>
                </div>
              ))}
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-blue-900 text-[11px] space-y-1">
              <p>
                • Se já existirem registros para os meses indicados, eles serão atualizados com os
                novos saldos.
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
              onClick={handleConfirmarGravacaoLote}
              disabled={savingImport}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-8"
            >
              {savingImport
                ? 'Gravando balancetes...'
                : `Gravar ${arquivosProcessadosValidos.length} Balancete(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
