import React, { useState, useMemo, useRef, useEffect } from 'react'
import {
  FileSpreadsheet,
  Upload,
  Sparkles,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  HelpCircle,
  Download,
  Trash2,
  RefreshCw,
  Building,
  ArrowRight,
  Filter,
  CheckSquare,
  Square,
  Search,
  ExternalLink,
  ChevronRight,
  Database,
  Info,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { SeletorPlanoContaCombobox } from '@/components/SeletorPlanoContaCombobox'
import { ModalQuickRegisterConta } from '@/components/ModalQuickRegisterConta'
import { lancamentosService, memoriaFornecedoresService } from '@/services/financeService'
import { planoContasMapeamentosService } from '@/services/planoContasMapeamentosService'
import {
  extrairLinhasExcel,
  sugerirMapeamentoHeuristico,
  analisarColunasComIA,
  processarLinhasPlanilha,
  gerarPlanilhaModeloExcel,
  colIndexToExcelLetter,
  formatarNomeColunaExcel,
  sanitizarValorCelula,
  NOMES_MESES_EXTENSO,
  type ColumnMappingState,
  type LancamentoExcelLinha,
  type ResumoImportacaoExcelLancamentos,
} from '@/services/importacaoLancamentosExcelIaService'
import type {
  EmpresaRecord,
  PlanoContaRecord,
  CentroRecord,
  TipoDespesaRecord,
  MemoriaFornecedorRecord,
  LancamentoRecord,
} from '@/types/finance'

interface ImportarLancamentosExcelIAProps {
  empresas: EmpresaRecord[]
  planoContas: PlanoContaRecord[]
  centros: CentroRecord[]
  tiposDespesas: TipoDespesaRecord[]
  onReloadCatalogs?: () => Promise<void>
}

export function ImportarLancamentosExcelIA({
  empresas,
  planoContas,
  centros,
  tiposDespesas,
  onReloadCatalogs,
}: ImportarLancamentosExcelIAProps) {
  const { toast } = useToast()

  // 1. Estado da Empresa Ativa
  const [selectedEmpresaId, setSelectedEmpresaId] = useState<string>(() => {
    return empresas.length > 0 ? empresas[0].id : ''
  })

  useEffect(() => {
    if (!selectedEmpresaId && empresas.length > 0) {
      setSelectedEmpresaId(empresas[0].id)
    }
  }, [empresas, selectedEmpresaId])

  const empresaSelecionada = useMemo(() => {
    return empresas.find((e) => e.id === selectedEmpresaId) || null
  }, [empresas, selectedEmpresaId])

  // Plano de contas filtrado para a empresa ativa (ou geral)
  const planoContasEmpresa = useMemo(() => {
    if (!selectedEmpresaId) return planoContas
    const filtrado = planoContas.filter((p) => p.empresa === selectedEmpresaId)
    return filtrado.length > 0 ? filtrado : planoContas
  }, [planoContas, selectedEmpresaId])

  // 2. Filtros de Ano e Período (Mês a Mês)
  const anoAtual = new Date().getFullYear()
  const [selectedAno, setSelectedAno] = useState<number>(anoAtual)
  const [mesInicial, setMesInicial] = useState<number>(1)
  const [mesFinal, setMesFinal] = useState<number>(12)
  const [mesesEspecificos, setMesesEspecificos] = useState<Set<number>>(
    new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]),
  )
  const [usarMesesIndividuais, setUsarMesesIndividuais] = useState<boolean>(false)

  // 3. Arquivo e Estado de Extração
  const [file, setFile] = useState<File | null>(null)
  const [isReadingFile, setIsReadingFile] = useState<boolean>(false)
  const [fileHeaders, setFileHeaders] = useState<string[]>([])
  const [rawRows, setRawRows] = useState<Array<Record<string, unknown>>>([])

  // 4. Mapeamento de Colunas (com IA)
  const [columnMapping, setColumnMapping] = useState<ColumnMappingState>({
    data: '',
    historico: '',
    valor: '',
    tipo: '',
    codigoConta: '',
    nomeConta: '',
    centroCusto: '',
    documento: '',
    formaPagamento: '',
  })
  const [isAnalyzingAi, setIsAnalyzingAi] = useState<boolean>(false)
  const [aiAnalysisNotes, setAiAnalysisNotes] = useState<string>('')
  const [mappingConfirmed, setMappingConfirmed] = useState<boolean>(false)

  // 5. Linhas Processadas e Pré-visualização
  const [linhas, setLinhas] = useState<LancamentoExcelLinha[]>([])
  const [resumo, setResumo] = useState<ResumoImportacaoExcelLancamentos | null>(null)
  const [filtroStatusTabela, setFiltroStatusTabela] = useState<
    'todos' | 'validos' | 'problemas' | 'duplicados' | 'fora_periodo'
  >('todos')
  const [filtroMesTabela, setFiltroMesTabela] = useState<string>('todos')
  const [buscaTabela, setBuscaTabela] = useState<string>('')

  // 6. Dados auxiliares para inteligência (memórias, aprendizados, lançamentos do ano)
  const [memorias, setMemorias] = useState<MemoriaFornecedorRecord[]>([])
  const [aprendidos, setAprendidos] = useState<
    Array<{ codigo_empresa: string; plano_conta: string }>
  >([])
  const [lancamentosAnoExistentes, setLancamentosAnoExistentes] = useState<LancamentoRecord[]>([])
  const [loadingDadosAuxiliares, setLoadingDadosAuxiliares] = useState<boolean>(false)

  // 7. Modal de Cadastro Rápido de Conta
  const [modalQuickOpen, setModalQuickOpen] = useState(false)
  const [quickCandidateName, setQuickCandidateName] = useState('')
  const [quickTargetRowId, setQuickTargetRowId] = useState<string | null>(null)

  // 8. Gravação / Importação Final
  const [step, setStep] = useState<'upload' | 'mapeamento' | 'previsualizacao' | 'sucesso'>(
    'upload',
  )
  const [isImporting, setIsImporting] = useState<boolean>(false)
  const [importProgress, setImportProgress] = useState<number>(0)
  const [importSummary, setImportSummary] = useState<{
    totalGravados: number
    totalPulados: number
    totalErros: number
    errosList: string[]
  } | null>(null)

  // Drag and drop
  const [isDragOver, setIsDragOver] = useState<boolean>(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Carrega aprendizados e dados auxiliares ao trocar de empresa ou ano
  useEffect(() => {
    if (!selectedEmpresaId) return
    let active = true

    const carregarAuxiliares = async () => {
      setLoadingDadosAuxiliares(true)
      try {
        const [mems, maps, lancs] = await Promise.all([
          memoriaFornecedoresService.getByEmpresa(selectedEmpresaId).catch(() => []),
          planoContasMapeamentosService.getAll(selectedEmpresaId).catch(() => []),
          lancamentosService
            .getAll({
              empresaId: selectedEmpresaId,
              dataInicio: `${selectedAno}-01-01`,
              dataFim: `${selectedAno}-12-31`,
              expandRelations: false,
            })
            .catch(() => []),
        ])

        if (active) {
          setMemorias(mems)
          setAprendidos(
            maps.map((m) => ({
              codigo_empresa: m.codigo_empresa,
              plano_conta: m.plano_conta,
            })),
          )
          setLancamentosAnoExistentes(lancs)
        }
      } catch (err) {
        console.warn('Erro ao carregar dados auxiliares:', err)
      } finally {
        if (active) setLoadingDadosAuxiliares(false)
      }
    }

    carregarAuxiliares()
    return () => {
      active = false
    }
  }, [selectedEmpresaId, selectedAno])

  // Recalcula o processamento das linhas sempre que o mapeamento, período ou arquivo mudar
  const reprocessarDados = (
    currentMapping: ColumnMappingState,
    rows: Array<Record<string, unknown>> = rawRows,
  ) => {
    if (!rows || rows.length === 0) return

    const { linhas: novasLinhas, resumo: novoResumo } = processarLinhasPlanilha({
      rawRows: rows,
      mapping: currentMapping,
      anoSelecionado: selectedAno,
      mesInicial,
      mesFinal,
      mesesHabilitados: usarMesesIndividuais ? mesesEspecificos : undefined,
      planoContas: planoContasEmpresa,
      memoriasFornecedores: memorias,
      mapeamentosAprendidos: aprendidos,
      lancamentosExistentes: lancamentosAnoExistentes,
    })

    setLinhas(novasLinhas)
    setResumo(novoResumo)
  }

  // Manipulação de Upload de Arquivo
  const handleFileChange = async (selectedFile: File) => {
    if (!selectedFile) return

    const ext = selectedFile.name.toLowerCase()
    if (!ext.endsWith('.xlsx') && !ext.endsWith('.xls') && !ext.endsWith('.csv')) {
      toast({
        title: 'Formato não suportado',
        description: 'Por favor, selecione um arquivo Excel (.xlsx, .xls) ou CSV (.csv).',
        variant: 'destructive',
      })
      return
    }

    setFile(selectedFile)
    setIsReadingFile(true)
    try {
      const { headers, rawRows: rows } = await extrairLinhasExcel(selectedFile)
      setFileHeaders(headers)
      setRawRows(rows)

      // Sugestão inicial por regras locais rápidas
      const heur = sugerirMapeamentoHeuristico(headers)
      setColumnMapping(heur)

      // Análise automática por IA em segundo plano
      setIsAnalyzingAi(true)
      analisarColunasComIA(headers, rows)
        .then((aiRes) => {
          if (aiRes.mapping) {
            setColumnMapping((prev) => ({
              ...prev,
              ...(aiRes.mapping as ColumnMappingState),
            }))
          }
          if (aiRes.observacoes) {
            setAiAnalysisNotes(aiRes.observacoes)
          }
          toast({
            title: 'Mapeamento detectado com IA ✨',
            description: 'Revise o mapeamento das colunas sugerido pela inteligência artificial.',
          })
        })
        .catch(() => {
          /* fallback já setado */
        })
        .finally(() => {
          setIsAnalyzingAi(false)
        })

      setStep('mapeamento')
    } catch (err: unknown) {
      const error = err as Error
      toast({
        title: 'Erro ao abrir planilha',
        description: error.message || 'Verifique se o arquivo não está corrompido.',
        variant: 'destructive',
      })
    } finally {
      setIsReadingFile(false)
    }
  }

  // Avança do Mapeamento para a Pré-visualização
  const handleConfirmarMapeamento = () => {
    if (!columnMapping.data || !columnMapping.valor) {
      toast({
        title: 'Mapeamento incompleto',
        description: 'É obrigatório selecionar as colunas de Data e de Valor da planilha.',
        variant: 'destructive',
      })
      return
    }

    setMappingConfirmed(true)
    reprocessarDados(columnMapping, rawRows)
    setStep('previsualizacao')
  }

  // Toggle do mês individual
  const toggleMesIndividual = (mes: number) => {
    setMesesEspecificos((prev) => {
      const next = new Set(prev)
      if (next.has(mes)) {
        if (next.size === 1) {
          toast({
            title: 'Pelo menos um mês deve ser selecionado',
            variant: 'destructive',
          })
          return prev
        }
        next.delete(mes)
      } else {
        next.add(mes)
      }
      return next
    })
  }

  // Efeito para reprocessar quando o período mudar e já estiver na pré-visualização
  useEffect(() => {
    if (step === 'previsualizacao' && rawRows.length > 0) {
      reprocessarDados(columnMapping, rawRows)
    }
  }, [selectedAno, mesInicial, mesFinal, mesesEspecificos, usarMesesIndividuais, selectedEmpresaId])

  // Alteração manual de conta na tabela
  const handleAtribuirContaLinha = async (linhaId: string, planoContaId: string) => {
    const pc = planoContasEmpresa.find((p) => p.id === planoContaId)
    if (!pc) return

    setLinhas((prev) =>
      prev.map((l) => {
        if (l.id !== linhaId) return l
        const novoStatus = l.status === 'alerta' || l.status === 'valido' ? 'valido' : l.status

        const errosFiltrados = l.errosOuAlertas.filter(
          (e) => !e.toLowerCase().includes('conta contábil'),
        )

        // Se o plano tiver tipo definido, ajusta o tipo da linha
        const tipoConta = pc.expand?.conta?.tipo
        const novoTipo =
          tipoConta === 'Receita' ? 'Receita' : tipoConta === 'Despesa' ? 'Despesa' : l.tipo

        return {
          ...l,
          planoContaId: pc.id,
          planoContaCodigo: pc.codigo,
          planoContaNome: pc.expand?.conta?.nome || pc.descricao,
          planoContaTipo: tipoConta,
          planoContaObj: pc,
          tipo: novoTipo,
          matchConfidence: 'manual',
          status: novoStatus,
          errosOuAlertas: errosFiltrados,
        }
      }),
    )

    // Aprende o mapeamento se a linha tinha código de empresa
    const linha = linhas.find((l) => l.id === linhaId)
    if (linha?.codigoContaPlanilha && selectedEmpresaId) {
      try {
        await planoContasMapeamentosService.salvarOuAtualizar({
          empresa: selectedEmpresaId,
          codigo_empresa: linha.codigoContaPlanilha,
          plano_conta: pc.id,
        })
      } catch {
        /* não-bloqueante */
      }
    }

    // Reforça na memória de fornecedores
    if (linha?.historico && selectedEmpresaId) {
      try {
        await memoriaFornecedoresService.registrarOuAtualizarVinculo({
          fornecedor_padrao: linha.historico,
          termo_busca: linha.historico,
          plano_conta: pc.id,
          empresa: selectedEmpresaId,
          categoria_sugerida: pc.expand?.conta?.nome,
        })
      } catch {
        /* não-bloqueante */
      }
    }
  }

  // Toggle de seleção de linhas
  const handleToggleLinha = (linhaId: string) => {
    setLinhas((prev) =>
      prev.map((l) => (l.id === linhaId ? { ...l, selecionado: !l.selecionado } : l)),
    )
  }

  // Selecionar ou desmarcar todas as linhas visíveis
  const handleToggleTodasVisiveis = (selecionar: boolean) => {
    const idsVisiveis = new Set(linhasFiltradas.map((l) => l.id))
    setLinhas((prev) =>
      prev.map((l) => (idsVisiveis.has(l.id) ? { ...l, selecionado: selecionar } : l)),
    )
  }

  // Descartar uma linha
  const handleDescartarLinha = (linhaId: string) => {
    setLinhas((prev) => prev.filter((l) => l.id !== linhaId))
    toast({
      title: 'Linha descartada',
      description: 'O lançamento foi removido da lista de importação.',
    })
  }

  // Filtros aplicados sobre a tabela
  const linhasFiltradas = useMemo(() => {
    return linhas.filter((l) => {
      // Filtro de status
      if (filtroStatusTabela === 'validos' && l.status !== 'valido') return false
      if (filtroStatusTabela === 'problemas' && l.status !== 'alerta' && l.status !== 'erro')
        return false
      if (filtroStatusTabela === 'duplicados' && l.status !== 'duplicado') return false
      if (filtroStatusTabela === 'fora_periodo' && l.status !== 'fora_periodo') return false

      // Filtro de mês
      if (filtroMesTabela !== 'todos' && String(l.mes) !== filtroMesTabela) return false

      // Busca textual
      if (buscaTabela.trim()) {
        const q = buscaTabela.toLowerCase().trim()
        const histMatch = l.historico.toLowerCase().includes(q)
        const contaMatch = (l.planoContaNome || '').toLowerCase().includes(q)
        const codMatch = (l.planoContaCodigo || '').toLowerCase().includes(q)
        const codPlanMatch = (l.codigoContaPlanilha || '').toLowerCase().includes(q)
        const valorMatch = l.valor.toFixed(2).includes(q)
        if (!histMatch && !contaMatch && !codMatch && !codPlanMatch && !valorMatch) {
          return false
        }
      }

      return true
    })
  }, [linhas, filtroStatusTabela, filtroMesTabela, buscaTabela])

  // Contadores para os botões de ação
  const selecionadasParaImportar = useMemo(() => {
    return linhas.filter((l) => l.selecionado && l.status !== 'erro' && l.planoContaId)
  }, [linhas])

  const selecionadasSemConta = useMemo(() => {
    return linhas.filter((l) => l.selecionado && !l.planoContaId)
  }, [linhas])

  // Executa a importação final para o PocketBase
  const handleExecutarImportacao = async () => {
    if (!selectedEmpresaId) {
      toast({
        title: 'Selecione uma empresa',
        description: 'É necessário selecionar a empresa de destino dos lançamentos.',
        variant: 'destructive',
      })
      return
    }

    if (selecionadasParaImportar.length === 0) {
      toast({
        title: 'Nenhum lançamento selecionado',
        description:
          'Selecione pelo menos um lançamento válido e com Conta Contábil atribuída para importar.',
        variant: 'destructive',
      })
      return
    }

    setIsImporting(true)
    setImportProgress(0)

    let totalGravados = 0
    let totalErros = 0
    const errosList: string[] = []

    const total = selecionadasParaImportar.length

    try {
      for (let i = 0; i < total; i++) {
        const item = selecionadasParaImportar[i]

        try {
          const histComplemento = [
            item.historico,
            item.documentoPlanilha ? `(Doc: ${item.documentoPlanilha})` : null,
            item.formaPagamentoPlanilha ? `[${item.formaPagamentoPlanilha}]` : null,
          ]
            .filter(Boolean)
            .join(' ')

          await lancamentosService.create({
            empresa: selectedEmpresaId,
            plano_conta: item.planoContaId!,
            data: item.dataIso,
            valor: item.valor,
            historico: histComplemento || `Importado Excel - ${file?.name}`,
          })

          totalGravados++

          // Reforça vínculo na memória se foi bem-sucedido
          if (item.historico) {
            memoriaFornecedoresService
              .registrarOuAtualizarVinculo({
                fornecedor_padrao: item.historico,
                termo_busca: item.historico,
                plano_conta: item.planoContaId!,
                empresa: selectedEmpresaId,
                categoria_sugerida: item.planoContaNome,
              })
              .catch(() => {})
          }
        } catch (err: unknown) {
          totalErros++
          const error = err as Error
          errosList.push(`Linha ${item.linhaPlanilha} (${item.historico}): ${error.message}`)
        }

        setImportProgress(Math.round(((i + 1) / total) * 100))
      }

      setImportSummary({
        totalGravados,
        totalPulados: linhas.length - totalGravados,
        totalErros,
        errosList,
      })

      setStep('sucesso')

      toast({
        title: 'Importação concluída com sucesso! 🎉',
        description: `${totalGravados} lançamentos foram gravados no sistema para o ano de ${selectedAno}.`,
      })

      if (onReloadCatalogs) {
        onReloadCatalogs().catch(() => {})
      }
    } catch (err: unknown) {
      const error = err as Error
      toast({
        title: 'Erro durante a importação',
        description: error.message || 'Falha ao processar os registros.',
        variant: 'destructive',
      })
    } finally {
      setIsImporting(false)
    }
  }

  // Reiniciar fluxo para nova importação
  const handleReset = () => {
    setFile(null)
    setRawRows([])
    setFileHeaders([])
    setLinhas([])
    setResumo(null)
    setMappingConfirmed(false)
    setStep('upload')
    setImportSummary(null)
  }

  return (
    <div className="space-y-6">
      {/* ========================================================================= */}
      {/* BANNER CORPORATIVO AZUL-MARINHO                                           */}
      {/* ========================================================================= */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 p-6 text-white shadow-xl border border-blue-900/50">
        <div className="absolute right-0 top-0 -mt-10 -mr-10 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-blue-500/20 px-3 py-1 text-xs font-semibold text-blue-300 border border-blue-400/30 uppercase tracking-wider">
              <Sparkles className="h-3.5 w-3.5 text-blue-400 animate-pulse" />
              Importação Inteligente Mês a Mês · Excel + IA
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
              <FileSpreadsheet className="w-6 h-6 text-emerald-400" />
              Importar Lançamentos de Planilha Excel
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              Importe receitas e despesas da sua empresa mês a mês a partir de planilhas Excel (
              <strong>.xlsx, .xls, .csv</strong>). A inteligência artificial detecta automaticamente
              as colunas, identifica datas e valores, sugere a conta contábil correspondente e evita
              duplicidades.
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
              Os lançamentos serão associados a esta empresa.
            </p>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SELEÇÃO DO ANO E PERÍODO (MÊS INICIAL E FINAL)                            */}
      {/* ========================================================================= */}
      <Card className="bg-white border-slate-200 shadow-sm">
        <CardHeader className="pb-3 border-b border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-600" />
                Definição do Período de Importação
              </CardTitle>
              <CardDescription className="text-xs">
                Selecione o ano e os meses contábeis que serão importados da planilha. Lançamentos
                fora deste período serão destacados e ignorados por padrão.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setUsarMesesIndividuais(!usarMesesIndividuais)}
                className="text-xs h-8 border-slate-300 text-slate-700 bg-white hover:bg-slate-50"
              >
                {usarMesesIndividuais
                  ? 'Alternar para Faixa Contínua'
                  : 'Escolher Meses Individuais'}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            {/* Ano */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Ano de Exercício *</Label>
              <Select
                value={String(selectedAno)}
                onValueChange={(val) => setSelectedAno(parseInt(val, 10))}
              >
                <SelectTrigger className="h-9 text-xs font-semibold bg-white border-slate-300">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[
                    anoAtual + 1,
                    anoAtual,
                    anoAtual - 1,
                    anoAtual - 2,
                    anoAtual - 3,
                    anoAtual - 4,
                  ].map((ano) => (
                    <SelectItem key={ano} value={String(ano)} className="text-xs">
                      {ano}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {!usarMesesIndividuais ? (
              <>
                {/* Mês Inicial */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Mês Inicial *</Label>
                  <Select
                    value={String(mesInicial)}
                    onValueChange={(val) => setMesInicial(parseInt(val, 10))}
                  >
                    <SelectTrigger className="h-9 text-xs bg-white border-slate-300">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {NOMES_MESES_EXTENSO.map((nome, idx) => (
                        <SelectItem key={idx + 1} value={String(idx + 1)} className="text-xs">
                          {String(idx + 1).padStart(2, '0')} - {nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Mês Final */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Mês Final *</Label>
                  <Select
                    value={String(mesFinal)}
                    onValueChange={(val) => setMesFinal(parseInt(val, 10))}
                  >
                    <SelectTrigger className="h-9 text-xs bg-white border-slate-300">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {NOMES_MESES_EXTENSO.map((nome, idx) => (
                        <SelectItem key={idx + 1} value={String(idx + 1)} className="text-xs">
                          {String(idx + 1).padStart(2, '0')} - {nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="text-xs text-slate-500 pb-2">
                  Período ativo:{' '}
                  <strong className="text-slate-800">
                    {NOMES_MESES_EXTENSO[mesInicial - 1]} a {NOMES_MESES_EXTENSO[mesFinal - 1]} de{' '}
                    {selectedAno}
                  </strong>
                </div>
              </>
            ) : (
              <div className="sm:col-span-3 space-y-2">
                <Label className="text-xs font-semibold text-slate-700 block">
                  Selecione os meses desejados para o ano de {selectedAno}:
                </Label>
                <div className="grid grid-cols-3 sm:grid-cols-6 lg:grid-cols-12 gap-1.5">
                  {NOMES_MESES_EXTENSO.map((nome, idx) => {
                    const mesNum = idx + 1
                    const ativo = mesesEspecificos.has(mesNum)
                    return (
                      <button
                        key={mesNum}
                        type="button"
                        onClick={() => toggleMesIndividual(mesNum)}
                        className={`px-2 py-1.5 rounded-lg text-xs font-medium text-center border transition-all ${
                          ativo
                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {nome.slice(0, 3)}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ========================================================================= */}
      {/* ETAPA 1: UPLOAD DE ARQUIVO                                                */}
      {/* ========================================================================= */}
      {step === 'upload' && (
        <Card className="bg-white border-slate-200 shadow-sm">
          <CardHeader className="pb-4 border-b border-slate-100">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Upload className="w-5 h-5 text-blue-600" />
                  Carregar Planilha de Lançamentos
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Envie sua planilha Excel (.xlsx, .xls) ou arquivo CSV com o histórico das receitas
                  e despesas.
                </CardDescription>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    gerarPlanilhaModeloExcel({
                      planoContas: planoContasEmpresa,
                      nomeEmpresa: empresaSelecionada?.nome,
                      ano: selectedAno,
                    })
                  }
                  className="text-xs h-9 gap-1.5 border-emerald-300 text-emerald-800 bg-emerald-50/50 hover:bg-emerald-100 shadow-xs font-semibold"
                >
                  <Download className="w-4 h-4 text-emerald-600" />
                  Baixar Modelo Excel (.xlsx)
                </Button>
              </div>
            </div>

            {/* Banner explicativo do Modelo Excel Atualizado */}
            <div className="mt-4 p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200/80 text-xs text-emerald-950 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-start sm:items-center gap-2.5">
                <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg shrink-0">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-semibold text-emerald-900">
                    Modelo com as 4 colunas essenciais do Plano de Contas:
                  </p>
                  <p className="text-emerald-800 text-[11px] mt-0.5">
                    <strong>1. Data do Lançamento</strong> (DD/MM/AAAA) &bull;{' '}
                    <strong>2. Código da Conta</strong> (do Plano de Contas) &bull;{' '}
                    <strong>3. Nome da Conta</strong> &bull; <strong>4. Valor</strong>.
                    {empresaSelecionada && (
                      <span className="ml-1 text-emerald-700">
                        O download já carrega códigos reais da empresa{' '}
                        <strong>{empresaSelecionada.nome}</strong> para o ano{' '}
                        <strong>{selectedAno}</strong>.
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  gerarPlanilhaModeloExcel({
                    planoContas: planoContasEmpresa,
                    nomeEmpresa: empresaSelecionada?.nome,
                    ano: selectedAno,
                  })
                }
                className="shrink-0 bg-white border-emerald-300 text-emerald-800 hover:bg-emerald-100 text-xs h-8 font-medium shadow-2xs"
              >
                <Download className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                Exportar Modelo da Empresa
              </Button>
            </div>
          </CardHeader>

          <CardContent className="pt-6">
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
              className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center cursor-pointer transition-all ${
                isDragOver
                  ? 'border-blue-500 bg-blue-50/60 scale-[1.01]'
                  : 'border-slate-300 hover:border-blue-400 bg-slate-50/40 hover:bg-blue-50/20'
              }`}
            >
              <input
                type="file"
                ref={fileInputRef}
                accept=".xlsx,.xls,.csv"
                onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
                className="hidden"
              />

              <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center mb-4 shadow-sm">
                <FileSpreadsheet className="w-8 h-8 text-blue-600" />
              </div>

              <h3 className="text-base font-bold text-slate-800">
                Arraste sua planilha Excel aqui ou clique para selecionar
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md text-center">
                Formatos suportados: <strong>Excel (.xlsx, .xls)</strong> e{' '}
                <strong>CSV (.csv)</strong>. Não se preocupe com a ordem das colunas: a IA fará o
                mapeamento automático.
              </p>

              <Button
                type="button"
                variant="outline"
                className="mt-6 border-blue-300 text-blue-700 bg-white hover:bg-blue-50 shadow-sm text-xs font-semibold"
              >
                <Upload className="w-3.5 h-3.5 mr-2 text-blue-600" />
                Selecionar Planilha do Computador
              </Button>
            </div>

            {/* Destaques do módulo com IA */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-600">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                <div className="flex items-center gap-2 font-semibold text-slate-900">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  Mapeamento com IA e Código
                </div>
                <p className="text-slate-500">
                  Reconhece automaticamente as colunas <strong>Data do Lançamento</strong>,{' '}
                  <strong>Código da Conta</strong>, <strong>Nome da Conta</strong> e{' '}
                  <strong>Valor</strong> com máxima prioridade.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                <div className="flex items-center gap-2 font-semibold text-slate-900">
                  <Calendar className="w-4 h-4 text-indigo-600" />
                  Filtragem Mês a Mês
                </div>
                <p className="text-slate-500">
                  Filtre por <strong>Ano</strong> ({selectedAno}) e <strong>Período</strong>{' '}
                  (intervalo de meses ou seleção individual). Lançamentos fora do período são
                  sinalizados.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                <div className="flex items-center gap-2 font-semibold text-slate-900">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Detecção de Duplicidades
                </div>
                <p className="text-slate-500">
                  Evite importar lançamentos repetidos com verificação automática de data, valor e
                  histórico já existentes.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* ETAPA 2: REVISÃO DO MAPEAMENTO DE COLUNAS (IA)                           */}
      {/* ========================================================================= */}
      {step === 'mapeamento' && (
        <Card className="bg-white border-slate-200 shadow-sm">
          <CardHeader className="pb-4 border-b border-slate-100">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-blue-600" />
                  Mapeamento de Colunas da Planilha
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Arquivo: <strong>{file?.name}</strong> ({rawRows.length} linhas lidas). Revise as
                  colunas detectadas pela IA antes de avançar para a pré-visualização.
                </CardDescription>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReset}
                  className="text-xs h-9 text-slate-600"
                >
                  <Trash2 className="w-4 h-4 mr-1 text-rose-500" />
                  Trocar Arquivo
                </Button>
                <Button
                  size="sm"
                  onClick={handleConfirmarMapeamento}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-9 gap-1.5 shadow-sm font-semibold"
                >
                  Avançar para Pré-visualização
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-6 space-y-6">
            {isAnalyzingAi && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-3">
                <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />
                <div className="text-xs text-blue-900">
                  <p className="font-semibold">
                    O assistente de IA está analisando sua planilha...
                  </p>
                  <p className="text-blue-700">
                    Identificando colunas de data, valores monetários e contas contábeis.
                  </p>
                </div>
              </div>
            )}

            {aiAnalysisNotes && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 flex items-center gap-2">
                <Info className="w-4 h-4 text-blue-600 shrink-0" />
                <span>
                  <strong>Nota da IA:</strong> {aiAnalysisNotes}
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Data */}
              <div className="space-y-1.5 p-3 rounded-xl border border-slate-200 bg-slate-50/50">
                <Label className="text-xs font-semibold text-slate-900 flex items-center justify-between">
                  <span>Coluna de Data *</span>
                  <Badge
                    variant="outline"
                    className="text-[10px] bg-blue-50 text-blue-700 border-blue-200"
                  >
                    Obrigatório
                  </Badge>
                </Label>
                {columnMapping.data && (
                  <div className="text-[11px] font-medium text-blue-800 bg-blue-50/70 border border-blue-200/60 px-2 py-1 rounded flex items-center justify-between">
                    <span>
                      Coluna {colIndexToExcelLetter(fileHeaders.indexOf(columnMapping.data))}
                    </span>
                    <span className="text-slate-600 truncate max-w-[150px]">
                      &ldquo;
                      {formatarNomeColunaExcel(
                        columnMapping.data,
                        fileHeaders.indexOf(columnMapping.data),
                      )}
                      &rdquo;
                    </span>
                  </div>
                )}
                <Select
                  value={columnMapping.data}
                  onValueChange={(val) => setColumnMapping((prev) => ({ ...prev, data: val }))}
                >
                  <SelectTrigger className="h-9 text-xs bg-white">
                    <SelectValue placeholder="Selecione a coluna" />
                  </SelectTrigger>
                  <SelectContent>
                    {fileHeaders.map((h, idx) => {
                      const colLetra = colIndexToExcelLetter(idx)
                      const nomeFormatado = formatarNomeColunaExcel(h, idx)
                      return (
                        <SelectItem key={h} value={h} className="text-xs">
                          <span className="font-bold text-blue-700 mr-1 font-mono">
                            Coluna {colLetra}
                          </span>
                          <span className="text-slate-400 mx-1">—</span>
                          <span>&ldquo;{nomeFormatado}&rdquo;</span>
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-slate-500">Ex: Data, Competência, Vencimento</p>
              </div>

              {/* Valor */}
              <div className="space-y-1.5 p-3 rounded-xl border border-slate-200 bg-slate-50/50">
                <Label className="text-xs font-semibold text-slate-900 flex items-center justify-between">
                  <span>Coluna de Valor *</span>
                  <Badge
                    variant="outline"
                    className="text-[10px] bg-blue-50 text-blue-700 border-blue-200"
                  >
                    Obrigatório
                  </Badge>
                </Label>
                {columnMapping.valor && (
                  <div className="text-[11px] font-medium text-blue-800 bg-blue-50/70 border border-blue-200/60 px-2 py-1 rounded flex items-center justify-between">
                    <span>
                      Coluna {colIndexToExcelLetter(fileHeaders.indexOf(columnMapping.valor))}
                    </span>
                    <span className="text-slate-600 truncate max-w-[150px]">
                      &ldquo;
                      {formatarNomeColunaExcel(
                        columnMapping.valor,
                        fileHeaders.indexOf(columnMapping.valor),
                      )}
                      &rdquo;
                    </span>
                  </div>
                )}
                <Select
                  value={columnMapping.valor}
                  onValueChange={(val) => setColumnMapping((prev) => ({ ...prev, valor: val }))}
                >
                  <SelectTrigger className="h-9 text-xs bg-white">
                    <SelectValue placeholder="Selecione a coluna" />
                  </SelectTrigger>
                  <SelectContent>
                    {fileHeaders.map((h, idx) => {
                      const colLetra = colIndexToExcelLetter(idx)
                      const nomeFormatado = formatarNomeColunaExcel(h, idx)
                      return (
                        <SelectItem key={h} value={h} className="text-xs">
                          <span className="font-bold text-blue-700 mr-1 font-mono">
                            Coluna {colLetra}
                          </span>
                          <span className="text-slate-400 mx-1">—</span>
                          <span>&ldquo;{nomeFormatado}&rdquo;</span>
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-slate-500">Ex: Valor, Total, Montante</p>
              </div>

              {/* Histórico / Descrição */}
              <div className="space-y-1.5 p-3 rounded-xl border border-slate-200 bg-slate-50/50">
                <Label className="text-xs font-semibold text-slate-900">
                  Coluna de Histórico / Descrição
                </Label>
                {columnMapping.historico && (
                  <div className="text-[11px] font-medium text-slate-700 bg-slate-100/80 border border-slate-200 px-2 py-1 rounded flex items-center justify-between">
                    <span>
                      Coluna {colIndexToExcelLetter(fileHeaders.indexOf(columnMapping.historico))}
                    </span>
                    <span className="text-slate-600 truncate max-w-[150px]">
                      &ldquo;
                      {formatarNomeColunaExcel(
                        columnMapping.historico,
                        fileHeaders.indexOf(columnMapping.historico),
                      )}
                      &rdquo;
                    </span>
                  </div>
                )}
                <Select
                  value={columnMapping.historico || 'none'}
                  onValueChange={(val) =>
                    setColumnMapping((prev) => ({ ...prev, historico: val === 'none' ? '' : val }))
                  }
                >
                  <SelectTrigger className="h-9 text-xs bg-white">
                    <SelectValue placeholder="Nenhuma / Opcional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" className="text-xs">
                      (Não mapear)
                    </SelectItem>
                    {fileHeaders.map((h, idx) => {
                      const colLetra = colIndexToExcelLetter(idx)
                      const nomeFormatado = formatarNomeColunaExcel(h, idx)
                      return (
                        <SelectItem key={h} value={h} className="text-xs">
                          <span className="font-bold text-blue-700 mr-1 font-mono">
                            Coluna {colLetra}
                          </span>
                          <span className="text-slate-400 mx-1">—</span>
                          <span>&ldquo;{nomeFormatado}&rdquo;</span>
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-slate-500">Ex: Histórico, Descrição, Detalhe</p>
              </div>

              {/* Tipo (Receita / Despesa) */}
              <div className="space-y-1.5 p-3 rounded-xl border border-slate-200 bg-slate-50/50">
                <Label className="text-xs font-semibold text-slate-900">
                  Coluna de Tipo (Receita/Despesa)
                </Label>
                {columnMapping.tipo && (
                  <div className="text-[11px] font-medium text-slate-700 bg-slate-100/80 border border-slate-200 px-2 py-1 rounded flex items-center justify-between">
                    <span>
                      Coluna {colIndexToExcelLetter(fileHeaders.indexOf(columnMapping.tipo))}
                    </span>
                    <span className="text-slate-600 truncate max-w-[150px]">
                      &ldquo;
                      {formatarNomeColunaExcel(
                        columnMapping.tipo,
                        fileHeaders.indexOf(columnMapping.tipo),
                      )}
                      &rdquo;
                    </span>
                  </div>
                )}
                <Select
                  value={columnMapping.tipo || 'none'}
                  onValueChange={(val) =>
                    setColumnMapping((prev) => ({ ...prev, tipo: val === 'none' ? '' : val }))
                  }
                >
                  <SelectTrigger className="h-9 text-xs bg-white">
                    <SelectValue placeholder="Opcional (Detectado por valor/conta)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" className="text-xs">
                      (Detectar automaticamente)
                    </SelectItem>
                    {fileHeaders.map((h, idx) => {
                      const colLetra = colIndexToExcelLetter(idx)
                      const nomeFormatado = formatarNomeColunaExcel(h, idx)
                      return (
                        <SelectItem key={h} value={h} className="text-xs">
                          <span className="font-bold text-blue-700 mr-1 font-mono">
                            Coluna {colLetra}
                          </span>
                          <span className="text-slate-400 mx-1">—</span>
                          <span>&ldquo;{nomeFormatado}&rdquo;</span>
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-slate-500">Ex: Tipo, Natureza, D/C</p>
              </div>

              {/* Código da Conta */}
              <div className="space-y-1.5 p-3 rounded-xl border border-slate-200 bg-slate-50/50">
                <Label className="text-xs font-semibold text-slate-900 flex items-center justify-between">
                  <span>Código da Conta</span>
                  <Badge
                    variant="outline"
                    className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200"
                  >
                    Prioridade 1
                  </Badge>
                </Label>
                {columnMapping.codigoConta && (
                  <div className="text-[11px] font-medium text-emerald-800 bg-emerald-50/70 border border-emerald-200/60 px-2 py-1 rounded flex items-center justify-between">
                    <span>
                      Coluna {colIndexToExcelLetter(fileHeaders.indexOf(columnMapping.codigoConta))}
                    </span>
                    <span className="text-slate-600 truncate max-w-[150px]">
                      &ldquo;
                      {formatarNomeColunaExcel(
                        columnMapping.codigoConta,
                        fileHeaders.indexOf(columnMapping.codigoConta),
                      )}
                      &rdquo;
                    </span>
                  </div>
                )}
                <Select
                  value={columnMapping.codigoConta || 'none'}
                  onValueChange={(val) =>
                    setColumnMapping((prev) => ({
                      ...prev,
                      codigoConta: val === 'none' ? '' : val,
                    }))
                  }
                >
                  <SelectTrigger className="h-9 text-xs bg-white">
                    <SelectValue placeholder="Nenhuma / Opcional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" className="text-xs">
                      (Não mapear)
                    </SelectItem>
                    {fileHeaders.map((h, idx) => {
                      const colLetra = colIndexToExcelLetter(idx)
                      const nomeFormatado = formatarNomeColunaExcel(h, idx)
                      return (
                        <SelectItem key={h} value={h} className="text-xs">
                          <span className="font-bold text-blue-700 mr-1 font-mono">
                            Coluna {colLetra}
                          </span>
                          <span className="text-slate-400 mx-1">—</span>
                          <span>&ldquo;{nomeFormatado}&rdquo;</span>
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-slate-500">Ex: Código da Conta, Código, Reduzido</p>
              </div>

              {/* Nome da Conta */}
              <div className="space-y-1.5 p-3 rounded-xl border border-slate-200 bg-slate-50/50">
                <Label className="text-xs font-semibold text-slate-900 flex items-center justify-between">
                  <span>Nome da Conta</span>
                  <Badge
                    variant="outline"
                    className="text-[10px] bg-indigo-50 text-indigo-700 border-indigo-200"
                  >
                    Prioridade 2
                  </Badge>
                </Label>
                {columnMapping.nomeConta && (
                  <div className="text-[11px] font-medium text-indigo-800 bg-indigo-50/70 border border-indigo-200/60 px-2 py-1 rounded flex items-center justify-between">
                    <span>
                      Coluna {colIndexToExcelLetter(fileHeaders.indexOf(columnMapping.nomeConta))}
                    </span>
                    <span className="text-slate-600 truncate max-w-[150px]">
                      &ldquo;
                      {formatarNomeColunaExcel(
                        columnMapping.nomeConta,
                        fileHeaders.indexOf(columnMapping.nomeConta),
                      )}
                      &rdquo;
                    </span>
                  </div>
                )}
                <Select
                  value={columnMapping.nomeConta || 'none'}
                  onValueChange={(val) =>
                    setColumnMapping((prev) => ({ ...prev, nomeConta: val === 'none' ? '' : val }))
                  }
                >
                  <SelectTrigger className="h-9 text-xs bg-white">
                    <SelectValue placeholder="Nenhuma / Opcional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" className="text-xs">
                      (Não mapear)
                    </SelectItem>
                    {fileHeaders.map((h, idx) => {
                      const colLetra = colIndexToExcelLetter(idx)
                      const nomeFormatado = formatarNomeColunaExcel(h, idx)
                      return (
                        <SelectItem key={h} value={h} className="text-xs">
                          <span className="font-bold text-blue-700 mr-1 font-mono">
                            Coluna {colLetra}
                          </span>
                          <span className="text-slate-400 mx-1">—</span>
                          <span>&ldquo;{nomeFormatado}&rdquo;</span>
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-slate-500">Ex: Nome da Conta, Conta Contábil</p>
              </div>

              {/* Centro de Custo */}
              <div className="space-y-1.5 p-3 rounded-xl border border-slate-200 bg-slate-50/50">
                <Label className="text-xs font-semibold text-slate-900">Centro de Custo</Label>
                {columnMapping.centroCusto && (
                  <div className="text-[11px] font-medium text-slate-700 bg-slate-100/80 border border-slate-200 px-2 py-1 rounded flex items-center justify-between">
                    <span>
                      Coluna {colIndexToExcelLetter(fileHeaders.indexOf(columnMapping.centroCusto))}
                    </span>
                    <span className="text-slate-600 truncate max-w-[150px]">
                      &ldquo;
                      {formatarNomeColunaExcel(
                        columnMapping.centroCusto,
                        fileHeaders.indexOf(columnMapping.centroCusto),
                      )}
                      &rdquo;
                    </span>
                  </div>
                )}
                <Select
                  value={columnMapping.centroCusto || 'none'}
                  onValueChange={(val) =>
                    setColumnMapping((prev) => ({
                      ...prev,
                      centroCusto: val === 'none' ? '' : val,
                    }))
                  }
                >
                  <SelectTrigger className="h-9 text-xs bg-white">
                    <SelectValue placeholder="Nenhuma / Opcional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" className="text-xs">
                      (Não mapear)
                    </SelectItem>
                    {fileHeaders.map((h, idx) => {
                      const colLetra = colIndexToExcelLetter(idx)
                      const nomeFormatado = formatarNomeColunaExcel(h, idx)
                      return (
                        <SelectItem key={h} value={h} className="text-xs">
                          <span className="font-bold text-blue-700 mr-1 font-mono">
                            Coluna {colLetra}
                          </span>
                          <span className="text-slate-400 mx-1">—</span>
                          <span>&ldquo;{nomeFormatado}&rdquo;</span>
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-slate-500">Ex: Centro de Custo, Unidade</p>
              </div>

              {/* Documento / NF */}
              <div className="space-y-1.5 p-3 rounded-xl border border-slate-200 bg-slate-50/50">
                <Label className="text-xs font-semibold text-slate-900">
                  Número do Documento / NF
                </Label>
                {columnMapping.documento && (
                  <div className="text-[11px] font-medium text-slate-700 bg-slate-100/80 border border-slate-200 px-2 py-1 rounded flex items-center justify-between">
                    <span>
                      Coluna {colIndexToExcelLetter(fileHeaders.indexOf(columnMapping.documento))}
                    </span>
                    <span className="text-slate-600 truncate max-w-[150px]">
                      &ldquo;
                      {formatarNomeColunaExcel(
                        columnMapping.documento,
                        fileHeaders.indexOf(columnMapping.documento),
                      )}
                      &rdquo;
                    </span>
                  </div>
                )}
                <Select
                  value={columnMapping.documento || 'none'}
                  onValueChange={(val) =>
                    setColumnMapping((prev) => ({ ...prev, documento: val === 'none' ? '' : val }))
                  }
                >
                  <SelectTrigger className="h-9 text-xs bg-white">
                    <SelectValue placeholder="Nenhuma / Opcional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" className="text-xs">
                      (Não mapear)
                    </SelectItem>
                    {fileHeaders.map((h, idx) => {
                      const colLetra = colIndexToExcelLetter(idx)
                      const nomeFormatado = formatarNomeColunaExcel(h, idx)
                      return (
                        <SelectItem key={h} value={h} className="text-xs">
                          <span className="font-bold text-blue-700 mr-1 font-mono">
                            Coluna {colLetra}
                          </span>
                          <span className="text-slate-400 mx-1">—</span>
                          <span>&ldquo;{nomeFormatado}&rdquo;</span>
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-slate-500">Ex: Documento, NF, Comprovante</p>
              </div>

              {/* Forma de Pagamento */}
              <div className="space-y-1.5 p-3 rounded-xl border border-slate-200 bg-slate-50/50">
                <Label className="text-xs font-semibold text-slate-900">Forma de Pagamento</Label>
                {columnMapping.formaPagamento && (
                  <div className="text-[11px] font-medium text-slate-700 bg-slate-100/80 border border-slate-200 px-2 py-1 rounded flex items-center justify-between">
                    <span>
                      Coluna{' '}
                      {colIndexToExcelLetter(fileHeaders.indexOf(columnMapping.formaPagamento))}
                    </span>
                    <span className="text-slate-600 truncate max-w-[150px]">
                      &ldquo;
                      {formatarNomeColunaExcel(
                        columnMapping.formaPagamento,
                        fileHeaders.indexOf(columnMapping.formaPagamento),
                      )}
                      &rdquo;
                    </span>
                  </div>
                )}
                <Select
                  value={columnMapping.formaPagamento || 'none'}
                  onValueChange={(val) =>
                    setColumnMapping((prev) => ({
                      ...prev,
                      formaPagamento: val === 'none' ? '' : val,
                    }))
                  }
                >
                  <SelectTrigger className="h-9 text-xs bg-white">
                    <SelectValue placeholder="Nenhuma / Opcional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" className="text-xs">
                      (Não mapear)
                    </SelectItem>
                    {fileHeaders.map((h, idx) => {
                      const colLetra = colIndexToExcelLetter(idx)
                      const nomeFormatado = formatarNomeColunaExcel(h, idx)
                      return (
                        <SelectItem key={h} value={h} className="text-xs">
                          <span className="font-bold text-blue-700 mr-1 font-mono">
                            Coluna {colLetra}
                          </span>
                          <span className="text-slate-400 mx-1">—</span>
                          <span>&ldquo;{nomeFormatado}&rdquo;</span>
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-slate-500">Ex: PIX, Boleto, Cartão</p>
              </div>
            </div>

            {/* PREVIEW DA PLANILHA ORIGINAL COM LETRAS DAS COLUNAS (A, B, C...) E NÚMEROS DE LINHAS (1, 2, 3...) */}
            {rawRows.length > 0 && fileHeaders.length > 0 && (
              <div className="space-y-2.5 pt-2 border-t border-slate-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                      Visualização da Planilha Original (Linhas e Colunas Excel)
                    </span>
                    <Badge variant="outline" className="text-[10px] bg-slate-100 text-slate-600">
                      Primeiras {Math.min(rawRows.length, 5)} de {rawRows.length} linhas
                    </Badge>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    Linha 1 = Cabeçalho da planilha · Células vazias exibidas como &ldquo;—&rdquo;
                  </span>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs max-h-[260px]">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      {/* Linha das Letras das Colunas Excel (A, B, C, D...) */}
                      <tr className="bg-slate-200/80 text-slate-600 font-mono text-[11px] border-b border-slate-200">
                        <th className="p-2 w-12 text-center bg-slate-300/80 font-bold border-r border-slate-300">
                          #
                        </th>
                        {fileHeaders.map((h, idx) => (
                          <th
                            key={`col_letter_${idx}`}
                            className="p-2 text-center font-bold tracking-wider border-r border-slate-200 min-w-[140px]"
                          >
                            Coluna {colIndexToExcelLetter(idx)}
                          </th>
                        ))}
                      </tr>
                      {/* Linha 1 do Excel: Cabeçalho detectado */}
                      <tr className="bg-slate-100 text-slate-800 font-semibold border-b border-slate-200 text-xs">
                        <td className="p-2 text-center font-mono font-bold text-slate-500 bg-slate-200/60 border-r border-slate-300">
                          1
                        </td>
                        {fileHeaders.map((h, idx) => {
                          const nomeExibicao = formatarNomeColunaExcel(h, idx)
                          const isVazio = !h || /^_{1,2}EMPTY(_\d+)?$/i.test(String(h).trim())
                          return (
                            <td
                              key={`header_row_${idx}`}
                              className="p-2 border-r border-slate-200 text-slate-900"
                            >
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-[10px] font-bold text-blue-600 bg-blue-50 px-1 py-0.5 rounded">
                                  {colIndexToExcelLetter(idx)}
                                </span>
                                {isVazio ? (
                                  <span className="text-slate-400 italic font-normal">
                                    — (vazio)
                                  </span>
                                ) : (
                                  <span className="font-medium text-slate-800 truncate">
                                    {nomeExibicao}
                                  </span>
                                )}
                              </div>
                            </td>
                          )
                        })}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-sans">
                      {rawRows.slice(0, 5).map((row, rIdx) => {
                        const numeroLinhaExcel = rIdx + 2 // Linha 1 foi o cabeçalho
                        return (
                          <tr
                            key={`sample_row_${rIdx}`}
                            className="hover:bg-slate-50 transition-colors"
                          >
                            <td className="p-2 text-center font-mono font-semibold text-slate-500 bg-slate-100/60 border-r border-slate-200">
                              {numeroLinhaExcel}
                            </td>
                            {fileHeaders.map((h, cIdx) => {
                              const valorCru = row[h]
                              const valorLimpo = sanitizarValorCelula(valorCru)
                              return (
                                <td
                                  key={`sample_cell_${rIdx}_${cIdx}`}
                                  className="p-2 border-r border-slate-100 text-slate-700 truncate max-w-[200px]"
                                >
                                  {valorLimpo !== '' ? (
                                    <span>{valorLimpo}</span>
                                  ) : (
                                    <span className="text-slate-300 italic select-none">—</span>
                                  )}
                                </td>
                              )
                            })}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="pt-2 flex justify-end gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                className="text-xs h-9 text-slate-600"
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleConfirmarMapeamento}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-9 px-6 font-semibold gap-1.5 shadow-sm"
              >
                Confirmar Mapeamento e Analisar
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* ETAPA 3: PRÉ-VISUALIZAÇÃO EM TABELA E REVISÃO INTERATIVA                 */}
      {/* ========================================================================= */}
      {step === 'previsualizacao' && resumo && (
        <div className="space-y-6">
          {/* CARDS DE RESUMO E MÉTRICAS */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <Card className="bg-white border-slate-200 shadow-xs">
              <CardContent className="p-3.5">
                <p className="text-[11px] font-semibold text-slate-500 uppercase">
                  Total na Planilha
                </p>
                <p className="text-xl font-bold text-slate-900 mt-0.5">{resumo.totalLidos}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  {resumo.totalNoPeriodo} no período
                </p>
              </CardContent>
            </Card>

            <Card className="bg-white border-slate-200 shadow-xs">
              <CardContent className="p-3.5">
                <p className="text-[11px] font-semibold text-emerald-700 uppercase">
                  Receitas Detectadas
                </p>
                <p className="text-xl font-bold text-emerald-700 mt-0.5">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                    resumo.valorTotalReceitas,
                  )}
                </p>
                <p className="text-[10px] text-emerald-600 mt-0.5">
                  {resumo.totalReceitas} registros
                </p>
              </CardContent>
            </Card>

            <Card className="bg-white border-slate-200 shadow-xs">
              <CardContent className="p-3.5">
                <p className="text-[11px] font-semibold text-rose-700 uppercase">
                  Despesas Detectadas
                </p>
                <p className="text-xl font-bold text-rose-700 mt-0.5">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                    resumo.valorTotalDespesas,
                  )}
                </p>
                <p className="text-[10px] text-rose-600 mt-0.5">{resumo.totalDespesas} registros</p>
              </CardContent>
            </Card>

            <Card className="bg-white border-slate-200 shadow-xs">
              <CardContent className="p-3.5">
                <p className="text-[11px] font-semibold text-blue-700 uppercase">
                  Prontos p/ Gravar
                </p>
                <p className="text-xl font-bold text-blue-700 mt-0.5">
                  {selecionadasParaImportar.length}
                </p>
                <p className="text-[10px] text-blue-600 mt-0.5">marcados para importar</p>
              </CardContent>
            </Card>

            <Card className="bg-white border-slate-200 shadow-xs">
              <CardContent className="p-3.5">
                <p className="text-[11px] font-semibold text-amber-700 uppercase">
                  Com Alerta / Sem Conta
                </p>
                <p className="text-xl font-bold text-amber-700 mt-0.5">{resumo.totalComProblema}</p>
                <p className="text-[10px] text-amber-600 mt-0.5">requer atenção</p>
              </CardContent>
            </Card>

            <Card className="bg-white border-slate-200 shadow-xs">
              <CardContent className="p-3.5">
                <p className="text-[11px] font-semibold text-purple-700 uppercase">
                  Duplicados / Fora
                </p>
                <p className="text-xl font-bold text-purple-700 mt-0.5">
                  {resumo.totalDuplicados + resumo.totalForaPeriodo}
                </p>
                <p className="text-[10px] text-purple-600 mt-0.5">
                  {resumo.totalDuplicados} dupl. · {resumo.totalForaPeriodo} fora
                </p>
              </CardContent>
            </Card>
          </div>

          {/* BARRA DE AÇÕES E FILTROS DA TABELA */}
          <Card className="bg-white border-slate-200 shadow-sm">
            <CardContent className="p-4 space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                {/* Filtros rápidos por status */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <Button
                    variant={filtroStatusTabela === 'todos' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFiltroStatusTabela('todos')}
                    className="text-xs h-8"
                  >
                    Todos ({linhas.length})
                  </Button>
                  <Button
                    variant={filtroStatusTabela === 'validos' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFiltroStatusTabela('validos')}
                    className="text-xs h-8"
                  >
                    Válidos ({resumo.totalValidos})
                  </Button>
                  <Button
                    variant={filtroStatusTabela === 'problemas' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFiltroStatusTabela('problemas')}
                    className="text-xs h-8 text-amber-700 border-amber-200 hover:bg-amber-50"
                  >
                    Alertas/Sem Conta ({resumo.totalComProblema})
                  </Button>
                  {resumo.totalDuplicados > 0 && (
                    <Button
                      variant={filtroStatusTabela === 'duplicados' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setFiltroStatusTabela('duplicados')}
                      className="text-xs h-8 text-purple-700 border-purple-200 hover:bg-purple-50"
                    >
                      Duplicados ({resumo.totalDuplicados})
                    </Button>
                  )}
                  {resumo.totalForaPeriodo > 0 && (
                    <Button
                      variant={filtroStatusTabela === 'fora_periodo' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setFiltroStatusTabela('fora_periodo')}
                      className="text-xs h-8 text-slate-600"
                    >
                      Fora do Período ({resumo.totalForaPeriodo})
                    </Button>
                  )}
                </div>

                {/* Filtro por Mês do Período */}
                <div className="flex items-center gap-2">
                  <Select value={filtroMesTabela} onValueChange={setFiltroMesTabela}>
                    <SelectTrigger className="h-8 text-xs w-44 bg-white border-slate-300">
                      <SelectValue placeholder="Filtrar por Mês" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos" className="text-xs">
                        Todos os Meses ({selectedAno})
                      </SelectItem>
                      {Object.keys(resumo.mesesDetectados)
                        .map((m) => parseInt(m, 10))
                        .sort((a, b) => a - b)
                        .map((m) => (
                          <SelectItem key={m} value={String(m)} className="text-xs">
                            {NOMES_MESES_EXTENSO[m - 1]} ({resumo.mesesDetectados[m]?.count || 0})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>

                  {/* Busca textual */}
                  <div className="relative w-48 sm:w-60">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                    <Input
                      value={buscaTabela}
                      onChange={(e) => setBuscaTabela(e.target.value)}
                      placeholder="Buscar por descrição, valor..."
                      className="h-8 pl-8 text-xs bg-white border-slate-300"
                    />
                  </div>
                </div>
              </div>

              {/* Ações em lote e botões finais */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleToggleTodasVisiveis(true)}
                    className="text-xs h-8 text-slate-700 bg-white"
                  >
                    <CheckSquare className="w-3.5 h-3.5 mr-1 text-blue-600" />
                    Marcar Visíveis
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleToggleTodasVisiveis(false)}
                    className="text-xs h-8 text-slate-700 bg-white"
                  >
                    <Square className="w-3.5 h-3.5 mr-1 text-slate-400" />
                    Desmarcar Visíveis
                  </Button>
                  <span className="text-xs text-slate-500 hidden md:inline">
                    Exibindo {linhasFiltradas.length} de {linhas.length} lançamentos
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setStep('mapeamento')}
                    className="text-xs h-9 text-slate-700 bg-white"
                  >
                    Ajustar Mapeamento
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleExecutarImportacao}
                    disabled={isImporting || selecionadasParaImportar.length === 0}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-9 px-5 font-bold shadow-md gap-1.5"
                  >
                    {isImporting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Gravando ({importProgress}%)...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        Gravar Lançamentos Selecionados ({selecionadasParaImportar.length})
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Barra de progresso se estiver gravando */}
              {isImporting && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-emerald-950">
                    <span>Gravando lançamentos no banco de dados...</span>
                    <span>{importProgress}%</span>
                  </div>
                  <div className="w-full bg-emerald-200 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-emerald-600 h-2.5 rounded-full transition-all duration-300"
                      style={{ width: `${importProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* TABELA DE PRÉ-VISUALIZAÇÃO */}
          <Card className="bg-white border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto max-h-[600px]">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100/90 text-slate-700 sticky top-0 z-10 font-semibold border-b border-slate-200 shadow-xs">
                  <tr>
                    <th className="p-3 w-10 text-center">Sel.</th>
                    <th className="p-3 w-12 text-slate-500">Linha</th>
                    <th className="p-3 w-24">Data</th>
                    <th className="p-3 min-w-[200px]">Histórico / Descrição</th>
                    <th className="p-3 w-28 text-right">Valor</th>
                    <th className="p-3 w-20 text-center">Tipo</th>
                    <th className="p-3 min-w-[260px]">Conta Contábil (Plano de Contas)</th>
                    <th className="p-3 w-28 text-center">Status</th>
                    <th className="p-3 w-16 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {linhasFiltradas.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-500">
                        Nenhum lançamento encontrado para os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    linhasFiltradas.map((l) => {
                      const isProblem = l.status === 'alerta' || l.status === 'erro'
                      const isDupl = l.status === 'duplicado'
                      const isFora = l.status === 'fora_periodo'

                      return (
                        <tr
                          key={l.id}
                          className={`hover:bg-slate-50/80 transition-colors ${
                            !l.selecionado ? 'opacity-60 bg-slate-50/30' : ''
                          } ${isProblem ? 'bg-amber-50/30' : ''} ${isDupl ? 'bg-purple-50/30' : ''}`}
                        >
                          {/* Checkbox */}
                          <td className="p-3 text-center">
                            <input
                              type="checkbox"
                              checked={l.selecionado}
                              onChange={() => handleToggleLinha(l.id)}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer h-4 w-4"
                            />
                          </td>

                          {/* Linha */}
                          <td className="p-3 font-mono text-slate-500 font-medium">
                            <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[11px] font-mono">
                              Linha {l.linhaPlanilha}
                            </span>
                          </td>

                          {/* Data */}
                          <td className="p-3 font-medium whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <span>{l.dataStr}</span>
                              {l.mes > 0 && (
                                <span className="text-[10px] text-slate-500">
                                  ({NOMES_MESES_EXTENSO[l.mes - 1]?.slice(0, 3)})
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Histórico */}
                          <td className="p-3">
                            <div className="font-medium text-slate-900 leading-snug">
                              {l.historico}
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[10px] text-slate-500">
                              {l.codigoContaPlanilha && (
                                <span className="bg-slate-100 text-slate-700 px-1 rounded font-mono">
                                  Planilha: {l.codigoContaPlanilha}
                                </span>
                              )}
                              {l.documentoPlanilha && <span>Doc: {l.documentoPlanilha}</span>}
                              {l.formaPagamentoPlanilha && (
                                <span className="text-slate-600 font-semibold">
                                  [{l.formaPagamentoPlanilha}]
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Valor */}
                          <td className="p-3 text-right font-mono font-semibold whitespace-nowrap">
                            <span
                              className={
                                l.tipo === 'Receita' ? 'text-emerald-700' : 'text-slate-900'
                              }
                            >
                              {new Intl.NumberFormat('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              }).format(l.valor)}
                            </span>
                          </td>

                          {/* Tipo */}
                          <td className="p-3 text-center">
                            <Badge
                              variant="outline"
                              className={`text-[10px] px-1.5 py-0.5 font-bold ${
                                l.tipo === 'Receita'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-rose-50 text-rose-700 border-rose-200'
                              }`}
                            >
                              {l.tipo}
                            </Badge>
                          </td>

                          {/* Conta Contábil vinculada */}
                          <td className="p-3">
                            <div className="space-y-1">
                              <SeletorPlanoContaCombobox
                                value={l.planoContaId || ''}
                                onValueChange={(val) => handleAtribuirContaLinha(l.id, val)}
                                planoContas={planoContasEmpresa}
                                empresaAtivaId={selectedEmpresaId}
                                placeholder="Selecione ou busque a conta..."
                                className="h-8 text-xs bg-white"
                                allowClear
                              />

                              <div className="flex items-center justify-between text-[10px]">
                                {l.planoContaId ? (
                                  <span className="text-emerald-700 flex items-center gap-1 font-medium">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                    {l.matchConfidence === 'memoria' &&
                                      'Aprendido de histórico anterior'}
                                    {l.matchConfidence === 'codigo_empresa' &&
                                      'Vínculo por Código da Empresa'}
                                    {l.matchConfidence === 'exato' && 'Match exato de conta'}
                                    {l.matchConfidence === 'similar' &&
                                      'Sugerido por similaridade (IA)'}
                                    {l.matchConfidence === 'manual' && 'Atribuído manualmente'}
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setQuickCandidateName(l.historico)
                                      setQuickTargetRowId(l.id)
                                      setModalQuickOpen(true)
                                    }}
                                    className="text-blue-600 hover:text-blue-800 font-semibold underline flex items-center gap-1"
                                  >
                                    + Cadastrar Nova Conta
                                  </button>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Status / Alertas */}
                          <td className="p-3 text-center whitespace-nowrap">
                            {l.status === 'valido' && (
                              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-100 text-[10px]">
                                Válido
                              </Badge>
                            )}
                            {l.status === 'alerta' && (
                              <Badge
                                variant="outline"
                                className="bg-amber-50 text-amber-800 border-amber-300 text-[10px]"
                                title={l.errosOuAlertas.join('; ')}
                              >
                                Sem Conta
                              </Badge>
                            )}
                            {l.status === 'erro' && (
                              <Badge
                                variant="destructive"
                                className="text-[10px]"
                                title={l.errosOuAlertas.join('; ')}
                              >
                                Erro
                              </Badge>
                            )}
                            {l.status === 'duplicado' && (
                              <Badge
                                variant="outline"
                                className="bg-purple-50 text-purple-800 border-purple-300 text-[10px]"
                                title="Mesma data, valor e histórico já no sistema"
                              >
                                Duplicado
                              </Badge>
                            )}
                            {l.status === 'fora_periodo' && (
                              <Badge
                                variant="outline"
                                className="bg-slate-100 text-slate-600 border-slate-300 text-[10px]"
                                title="Fora do período/ano selecionado"
                              >
                                Fora Período
                              </Badge>
                            )}
                          </td>

                          {/* Ações */}
                          <td className="p-3 text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDescartarLinha(l.id)}
                              className="h-7 w-7 p-0 text-slate-400 hover:text-rose-600"
                              title="Descartar esta linha da importação"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ETAPA 4: SUCESSO E RESUMO DA IMPORTAÇÃO                                  */}
      {/* ========================================================================= */}
      {step === 'sucesso' && importSummary && (
        <Card className="bg-white border-slate-200 shadow-md">
          <CardContent className="p-8 text-center space-y-6 max-w-2xl mx-auto">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 className="w-10 h-10 text-emerald-600" />
            </div>

            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-slate-900">Importação Concluída com Êxito!</h3>
              <p className="text-sm text-slate-600">
                Os lançamentos foram importados e vinculados com sucesso à empresa{' '}
                <strong>{empresaSelecionada?.nome}</strong> para o exercício de{' '}
                <strong>{selectedAno}</strong>.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200 text-center">
              <div>
                <p className="text-xs text-slate-500 font-semibold uppercase">Gravados</p>
                <p className="text-2xl font-bold text-emerald-700 mt-1">
                  {importSummary.totalGravados}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 font-semibold uppercase">Não Importados</p>
                <p className="text-2xl font-bold text-slate-600 mt-1">
                  {importSummary.totalPulados}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 font-semibold uppercase">Erros</p>
                <p className="text-2xl font-bold text-rose-600 mt-1">{importSummary.totalErros}</p>
              </div>
            </div>

            {importSummary.errosList.length > 0 && (
              <div className="text-left p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-1">
                <p className="text-xs font-bold text-rose-950">Erros registrados:</p>
                <ul className="text-xs text-rose-800 list-disc list-inside space-y-0.5 max-h-36 overflow-y-auto">
                  {importSummary.errosList.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button
                variant="outline"
                onClick={handleReset}
                className="text-xs h-10 px-5 text-slate-700 bg-white"
              >
                Importar Outra Planilha
              </Button>
              <Button
                onClick={() => {
                  window.location.href = '/lancamentos'
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-10 px-6 font-semibold gap-2 shadow-sm"
              >
                Ver Módulo de Lançamentos
                <ExternalLink className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* MODAL DE CADASTRO RÁPIDO DE CONTA                                         */}
      {/* ========================================================================= */}
      {modalQuickOpen && (
        <ModalQuickRegisterConta
          open={modalQuickOpen}
          onOpenChange={setModalQuickOpen}
          initialName={quickCandidateName}
          centros={centros}
          tiposDespesas={tiposDespesas}
          onSuccess={(novaConta) => {
            if (quickTargetRowId) {
              handleAtribuirContaLinha(quickTargetRowId, novaConta.id)
            }
            if (onReloadCatalogs) {
              onReloadCatalogs().catch(() => {})
            }
          }}
        />
      )}
    </div>
  )
}
