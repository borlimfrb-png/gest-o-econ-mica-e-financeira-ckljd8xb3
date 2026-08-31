import React, { useState, useEffect, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BENCHMARKS_SETORIAIS, type BenchmarkSetorValores } from '@/lib/benchmarks'
import { benchmarksService } from '@/services/benchmarksService'
import { useToast } from '@/hooks/use-toast'
import type { EmpresaRecord, BenchmarkEmpresaRecord } from '@/types/finance'
import {
  Scale,
  RotateCcw,
  Save,
  CheckCircle2,
  Building2,
  FileSpreadsheet,
  Upload,
  Download,
  Trash2,
  HelpCircle,
  AlertCircle,
  Layers,
  Copy,
  ArrowRight,
  AlertTriangle,
} from 'lucide-react'

interface ModalEditarBenchmarksProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  setorInicial?: string
  benchmarksMap: Record<string, BenchmarkSetorValores>
  empresas?: EmpresaRecord[]
  empresaSelecionadaInicial?: EmpresaRecord | null
  empresaBenchmarksMap?: Record<string, BenchmarkEmpresaRecord>
  onSavedSetor?: (setor: string, novosValores: BenchmarkSetorValores) => void
  onSavedEmpresa?: (empresaId: string, novosValores: BenchmarkSetorValores) => void
  onDeletedEmpresaBenchmark?: (empresaId: string) => void
  onImportCsvSuccess?: (dadosAtualizados: Record<string, BenchmarkSetorValores>) => void
}

export function ModalEditarBenchmarks({
  open,
  onOpenChange,
  setorInicial = 'Serviços',
  benchmarksMap,
  empresas = [],
  empresaSelecionadaInicial = null,
  empresaBenchmarksMap = {},
  onSavedSetor,
  onSavedEmpresa,
  onDeletedEmpresaBenchmark,
  onImportCsvSuccess,
}: ModalEditarBenchmarksProps) {
  const { toast } = useToast()

  // Modo: 'setor' (por setor) ou 'empresa' (por empresa individual)
  const [modo, setModo] = useState<'setor' | 'empresa'>('setor')

  // Estado do Setor
  const [selectedSetor, setSelectedSetor] = useState<string>(setorInicial)

  // Estado da Empresa
  const [selectedEmpresaId, setSelectedEmpresaId] = useState<string>(
    empresaSelecionadaInicial?.id || (empresas.length > 0 ? empresas[0].id : ''),
  )

  // Dados do Formulário
  const [formData, setFormData] = useState<BenchmarkSetorValores>(
    () => benchmarksMap[setorInicial] || BENCHMARKS_SETORIAIS['Serviços'],
  )

  const [saving, setSaving] = useState<boolean>(false)
  const [activeTab, setActiveTab] = useState<string>('liquidez')

  // CSV Import State
  const [importandoCsv, setImportandoCsv] = useState<boolean>(false)
  const [csvErros, setCsvErros] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Estado de Duplicação de Metas
  const [modalDuplicarOpen, setModalDuplicarOpen] = useState<boolean>(false)
  const [empresaDestinoId, setEmpresaDestinoId] = useState<string>('')
  const [duplicando, setDuplicando] = useState<boolean>(false)

  // Encontrar empresa ativa selecionada
  const empresaAtiva = empresas.find((e) => e.id === selectedEmpresaId) || null

  // Sincronizar dados do formulário quando mudar modo, setor ou empresa
  useEffect(() => {
    if (!open) return

    if (modo === 'setor') {
      const targetSetor = selectedSetor || setorInicial || 'Serviços'
      const base =
        benchmarksMap[targetSetor] ||
        BENCHMARKS_SETORIAIS[targetSetor] ||
        BENCHMARKS_SETORIAIS['Outros']
      setFormData({ ...base })
    } else {
      // Modo Empresa
      if (selectedEmpresaId && empresaBenchmarksMap[selectedEmpresaId]) {
        const empBench = empresaBenchmarksMap[selectedEmpresaId]
        const setorBase =
          (empresaAtiva?.segmento && benchmarksMap[empresaAtiva.segmento]) ||
          BENCHMARKS_SETORIAIS['Outros']

        setFormData({
          ...setorBase,
          setor: empresaAtiva?.segmento || 'Geral',
          descricao:
            empBench.descricao || `Metas personalizadas para ${empresaAtiva?.nome || 'empresa'}`,
          liquidezCorrente: empBench.liquidezCorrente ?? setorBase.liquidezCorrente,
          liquidezSeca: empBench.liquidezSeca ?? setorBase.liquidezSeca,
          liquidezImediata: empBench.liquidezImediata ?? setorBase.liquidezImediata,
          liquidezGeral: empBench.liquidezGeral ?? setorBase.liquidezGeral,
          endividamentoGeral: empBench.endividamentoGeral ?? setorBase.endividamentoGeral,
          composicaoEndividamento:
            empBench.composicaoEndividamento ?? setorBase.composicaoEndividamento,
          participacaoCapitalTerceiros:
            empBench.participacaoCapitalTerceiros ?? setorBase.participacaoCapitalTerceiros,
          imobilizacaoPL: empBench.imobilizacaoPL ?? setorBase.imobilizacaoPL,
          margemBruta: empBench.margemBruta ?? setorBase.margemBruta,
          margemOperacional: empBench.margemOperacional ?? setorBase.margemOperacional,
          margemLiquida: empBench.margemLiquida ?? setorBase.margemLiquida,
          roa: empBench.roa ?? setorBase.roa,
          roe: empBench.roe ?? setorBase.roe,
          giroAtivo: empBench.giroAtivo ?? setorBase.giroAtivo,
          autonomiaFinanceira: empBench.autonomiaFinanceira ?? setorBase.autonomiaFinanceira,
          dependenciaFinanceira: empBench.dependenciaFinanceira ?? setorBase.dependenciaFinanceira,
          dividaEquity: empBench.dividaEquity ?? setorBase.dividaEquity,
          margemEbitda: empBench.margemEbitda ?? setorBase.margemEbitda,
          coberturaJuros: empBench.coberturaJuros ?? setorBase.coberturaJuros,
          pme: empBench.pme ?? setorBase.pme,
          pmr: empBench.pmr ?? setorBase.pmr,
          pmp: empBench.pmp ?? setorBase.pmp,
          cicloOperacional: empBench.cicloOperacional ?? setorBase.cicloOperacional,
          cicloFinanceiro: empBench.cicloFinanceiro ?? setorBase.cicloFinanceiro,
          giroEstoque: empBench.giroEstoque ?? setorBase.giroEstoque,
          giroReceber: empBench.giroReceber ?? setorBase.giroReceber,
          giroFornecedores: empBench.giroFornecedores ?? setorBase.giroFornecedores,
          roic: empBench.roic ?? setorBase.roic,
          wacc: empBench.wacc ?? setorBase.wacc,
          spread: empBench.spread ?? setorBase.spread,
        })
      } else {
        // Sem benchmark por empresa cadastrado ainda: carregar padrão do setor da empresa
        const setorDaEmpresa = empresaAtiva?.segmento || 'Serviços'
        const base =
          benchmarksMap[setorDaEmpresa] ||
          BENCHMARKS_SETORIAIS[setorDaEmpresa] ||
          BENCHMARKS_SETORIAIS['Outros']
        setFormData({
          ...base,
          descricao: `Metas específicas para ${empresaAtiva?.nome || 'a empresa'}`,
        })
      }
    }
  }, [
    modo,
    selectedSetor,
    selectedEmpresaId,
    open,
    benchmarksMap,
    empresaBenchmarksMap,
    empresaAtiva,
    setorInicial,
  ])

  // Inicializar quando o modal abre
  useEffect(() => {
    if (open) {
      if (empresaSelecionadaInicial?.id) {
        setSelectedEmpresaId(empresaSelecionadaInicial.id)
      }
      if (setorInicial) {
        setSelectedSetor(setorInicial)
      }
      setCsvErros([])
    }
  }, [open, empresaSelecionadaInicial, setorInicial])

  const handleChange = (field: keyof BenchmarkSetorValores, value: string | number) => {
    setFormData((prev) => ({
      ...prev,
      [field]: typeof value === 'string' ? (value === '' ? 0 : Number(value)) : value,
    }))
  }

  const handleTextChange = (field: keyof BenchmarkSetorValores, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  // Verificar se o setor atual diverge do padrão original de fábrica
  const isCustomizadoSetor = () => {
    const padrao = BENCHMARKS_SETORIAIS[selectedSetor]
    if (!padrao) return false
    return JSON.stringify(formData) !== JSON.stringify(padrao)
  }

  const hasEmpresaCustomizada = Boolean(
    selectedEmpresaId && empresaBenchmarksMap[selectedEmpresaId],
  )

  // Restaurar padrão de fábrica do setor selecionado
  const handleRestaurarPadraoSetor = async () => {
    const padrao = BENCHMARKS_SETORIAIS[selectedSetor] || BENCHMARKS_SETORIAIS['Outros']
    if (!padrao) return

    setFormData({ ...padrao })
    try {
      setSaving(true)
      await benchmarksService.restorePadrao(selectedSetor)
      if (onSavedSetor) onSavedSetor(selectedSetor, padrao)
      toast({
        title: 'Valores Padrão Restaurados',
        description: `O setor ${selectedSetor} foi restaurado para os parâmetros de referência originais.`,
      })
    } catch (err) {
      console.error(err)
      toast({
        variant: 'destructive',
        title: 'Erro ao restaurar',
        description: 'Não foi possível salvar a restauração do setor no banco.',
      })
    } finally {
      setSaving(false)
    }
  }

  // Excluir meta personalizada da empresa e voltar a herdar do setor
  const handleRemoverMetaEmpresa = async () => {
    if (!selectedEmpresaId) return
    try {
      setSaving(true)
      await benchmarksService.deleteEmpresa(selectedEmpresaId)
      if (onDeletedEmpresaBenchmark) {
        onDeletedEmpresaBenchmark(selectedEmpresaId)
      }
      // Carregar os valores do setor correspondente
      const setorEmpresa = empresaAtiva?.segmento || 'Serviços'
      const baseSetor =
        benchmarksMap[setorEmpresa] ||
        BENCHMARKS_SETORIAIS[setorEmpresa] ||
        BENCHMARKS_SETORIAIS['Outros']
      setFormData({ ...baseSetor })

      toast({
        title: 'Meta da Empresa Removida',
        description: `A empresa "${empresaAtiva?.nome}" voltou a herdar os benchmarks do setor ${setorEmpresa}.`,
      })
    } catch (err) {
      console.error(err)
      toast({
        variant: 'destructive',
        title: 'Erro ao remover meta',
        description: 'Não foi possível remover o benchmark específico da empresa.',
      })
    } finally {
      setSaving(false)
    }
  }

  // Salvar alterações
  const handleSalvar = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    try {
      setSaving(true)
      const roicVal = formData.roic ?? 0
      const waccVal = formData.wacc ?? 12
      const spreadCalc = Number((roicVal - waccVal).toFixed(2))

      if (modo === 'setor') {
        const dadosParaSalvar: BenchmarkSetorValores = {
          ...formData,
          setor: selectedSetor,
          spread: spreadCalc,
        }

        await benchmarksService.saveSetor(selectedSetor, dadosParaSalvar)
        if (onSavedSetor) onSavedSetor(selectedSetor, dadosParaSalvar)

        toast({
          title: 'Benchmark Setorial Atualizado!',
          description: `Os parâmetros para o setor "${selectedSetor}" foram salvos com sucesso.`,
        })
      } else {
        // Modo Empresa
        if (!selectedEmpresaId) {
          toast({
            variant: 'destructive',
            title: 'Selecione uma empresa',
            description: 'Escolha a empresa para vincular as metas.',
          })
          return
        }

        const dadosParaSalvar: BenchmarkSetorValores = {
          ...formData,
          setor: empresaAtiva?.segmento || 'Geral',
          spread: spreadCalc,
          empresaId: selectedEmpresaId,
          empresaNome: empresaAtiva?.nome,
          origemTipo: 'empresa',
        }

        await benchmarksService.saveEmpresa(selectedEmpresaId, dadosParaSalvar)
        if (onSavedEmpresa) onSavedEmpresa(selectedEmpresaId, dadosParaSalvar)

        toast({
          title: 'Metas da Empresa Salvas!',
          description: `As metas e benchmarks específicos para "${empresaAtiva?.nome}" foram salvas e têm prioridade máxima nos cálculos.`,
        })
      }

      onOpenChange(false)
    } catch (err) {
      console.error('Erro ao salvar benchmark:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar',
        description: 'Ocorreu um erro ao gravar as alterações do benchmark.',
      })
    } finally {
      setSaving(false)
    }
  }

  // ==========================================
  // DUPLICAÇÃO DE METAS ENTRE EMPRESAS
  // ==========================================
  const handleConfirmarDuplicacao = async () => {
    if (!selectedEmpresaId || !empresaDestinoId) {
      toast({
        variant: 'destructive',
        title: 'Seleção incompleta',
        description: 'Selecione a empresa de destino para receber a cópia das metas.',
      })
      return
    }

    if (selectedEmpresaId === empresaDestinoId) {
      toast({
        variant: 'destructive',
        title: 'Empresas iguais',
        description: 'A empresa de destino deve ser diferente da empresa de origem.',
      })
      return
    }

    const destino = empresas.find((e) => e.id === empresaDestinoId)
    const roicVal = formData.roic ?? 0
    const waccVal = formData.wacc ?? 12
    const spreadCalc = Number((roicVal - waccVal).toFixed(2))

    const metasParaDuplicar: Partial<BenchmarkSetorValores> = {
      ...formData,
      setor: destino?.segmento || empresaAtiva?.segmento || 'Geral',
      spread: spreadCalc,
      empresaId: empresaDestinoId,
      empresaNome: destino?.nome,
      descricao: `Metas copiadas de ${empresaAtiva?.nome || 'empresa de origem'} para ${destino?.nome || 'empresa de destino'}`,
      origemTipo: 'empresa',
    }

    try {
      setDuplicando(true)
      await benchmarksService.duplicateEmpresaMetas(
        selectedEmpresaId,
        empresaDestinoId,
        metasParaDuplicar,
        destino?.nome,
      )

      if (onSavedEmpresa) {
        onSavedEmpresa(empresaDestinoId, metasParaDuplicar as BenchmarkSetorValores)
      }

      toast({
        title: 'Metas Duplicadas com Sucesso! 🚀',
        description: `As 28 metas de "${empresaAtiva?.nome}" foram aplicadas à empresa "${destino?.nome}".`,
      })

      setModalDuplicarOpen(false)
    } catch (err: any) {
      console.error('Erro ao duplicar metas:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao duplicar',
        description:
          err?.message || 'Não foi possível duplicar as metas para a empresa de destino.',
      })
    } finally {
      setDuplicando(false)
    }
  }

  // ==========================================
  // EXPORTAÇÃO CSV
  // ==========================================
  const handleExportarCsv = () => {
    try {
      const csvData = benchmarksService.exportToCsv(benchmarksMap)
      const dataHora = new Date().toISOString().slice(0, 10)
      benchmarksService.downloadCsv(csvData, `benchmarks_setoriais_${dataHora}.csv`)
      toast({
        title: 'CSV Exportado com Sucesso!',
        description:
          'A tabela completa com todos os 10 setores e indicadores foi baixada em formato CSV.',
      })
    } catch (err) {
      console.error(err)
      toast({
        variant: 'destructive',
        title: 'Falha na Exportação',
        description: 'Não foi possível gerar o arquivo CSV.',
      })
    }
  }

  // ==========================================
  // IMPORTAÇÃO CSV
  // ==========================================
  const handleTriggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
      fileInputRef.current.click()
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith('.csv') && !file.type.includes('csv') && !file.type.includes('text')) {
      toast({
        variant: 'destructive',
        title: 'Formato inválido',
        description: 'Por favor, selecione um arquivo válido com extensão .csv.',
      })
      return
    }

    try {
      setImportandoCsv(true)
      setCsvErros([])
      const text = await file.text()
      const parseResult = benchmarksService.parseAndValidateCsv(text)

      if (!parseResult.success || parseResult.totalSetores === 0) {
        setCsvErros(parseResult.errors)
        toast({
          variant: 'destructive',
          title: 'Erro na Validação do CSV',
          description:
            parseResult.errors[0] ||
            'O arquivo CSV não pôde ser lido corretamente. Verifique o layout.',
        })
        return
      }

      // Persistir dados importados no PocketBase
      const totalSalvos = await benchmarksService.saveImportedCsvData(parseResult.data)

      if (onImportCsvSuccess) {
        onImportCsvSuccess(parseResult.data)
      }

      // Se o setor ativo estava nos importados, atualizar form
      if (parseResult.data[selectedSetor]) {
        setFormData({ ...parseResult.data[selectedSetor] })
      }

      toast({
        title: 'CSV Importado com Sucesso! 🎉',
        description: `${totalSalvos} setores foram atualizados no banco de dados e sincronizados.`,
      })

      if (parseResult.errors.length > 0) {
        setCsvErros(parseResult.errors)
      }
    } catch (err: any) {
      console.error('Erro na importação do CSV:', err)
      toast({
        variant: 'destructive',
        title: 'Falha na Importação',
        description: err?.message || 'Ocorreu um erro ao processar o arquivo CSV.',
      })
    } finally {
      setImportandoCsv(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-0 gap-0 rounded-2xl border-slate-200">
        <DialogHeader className="p-5 pb-4 border-b border-slate-100 bg-slate-50/80">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-xs">
                <Scale className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-extrabold text-[#0B1F3A] flex items-center gap-2">
                  Metas & Benchmarks Personalizados
                  <Badge className="bg-blue-100 text-blue-800 border-none text-[10px] font-bold">
                    Empresa & Setor
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 mt-0.5">
                  Precedência: <strong>Empresa Individual</strong> &gt;{' '}
                  <strong>Setor Personalizado</strong> &gt; <strong>Padrão de Mercado</strong>.
                </DialogDescription>
              </div>
            </div>

            {/* Ações Rápidas: Exportar / Importar CSV */}
            <div className="flex items-center gap-1.5 shrink-0">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv,text/plain"
                className="hidden"
                onChange={handleFileChange}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleExportarCsv}
                className="h-8 text-xs font-semibold border-slate-300 text-slate-700 hover:bg-slate-100 gap-1.5 shadow-2xs"
                title="Baixar tabela de benchmarks setoriais em CSV"
              >
                <Download className="w-3.5 h-3.5 text-blue-600" />
                <span className="hidden sm:inline">Exportar</span> CSV
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleTriggerFileInput}
                disabled={importandoCsv}
                className="h-8 text-xs font-semibold border-slate-300 text-slate-700 hover:bg-slate-100 gap-1.5 shadow-2xs"
                title="Carregar arquivo CSV com benchmarks"
              >
                {importandoCsv ? (
                  <div className="w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Upload className="w-3.5 h-3.5 text-emerald-600" />
                )}
                <span className="hidden sm:inline">Importar</span> CSV
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="p-5 space-y-4">
          {/* Seletor de Modo: Por Setor ou Por Empresa */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-100/90 p-2 rounded-xl border border-slate-200">
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                size="sm"
                variant={modo === 'setor' ? 'default' : 'ghost'}
                onClick={() => setModo('setor')}
                className={`h-8 text-xs font-bold gap-1.5 transition-all ${
                  modo === 'setor'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                1. Benchmark por Setor
              </Button>
              <Button
                type="button"
                size="sm"
                variant={modo === 'empresa' ? 'default' : 'ghost'}
                onClick={() => setModo('empresa')}
                className={`h-8 text-xs font-bold gap-1.5 transition-all ${
                  modo === 'empresa'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                2. Meta Específica por Empresa
                {empresas.length > 0 && (
                  <span className="bg-indigo-100 text-indigo-900 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                    {Object.keys(empresaBenchmarksMap).length}
                  </span>
                )}
              </Button>
            </div>

            {/* Seletores Dinâmicos conforme o Modo */}
            {modo === 'setor' ? (
              <div className="flex items-center gap-2">
                <Label className="text-xs font-bold text-slate-700 whitespace-nowrap">Setor:</Label>
                <Select value={selectedSetor} onValueChange={(val) => setSelectedSetor(val)}>
                  <SelectTrigger className="h-8 text-xs font-bold bg-white border-slate-300 w-[170px] text-blue-950">
                    <SelectValue placeholder="Selecione o setor" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(BENCHMARKS_SETORIAIS).map((s) => (
                      <SelectItem key={s} value={s} className="text-xs font-medium">
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Label className="text-xs font-bold text-slate-700 whitespace-nowrap">
                  Empresa:
                </Label>
                <Select
                  value={selectedEmpresaId}
                  onValueChange={(val) => setSelectedEmpresaId(val)}
                  disabled={empresas.length === 0}
                >
                  <SelectTrigger className="h-8 text-xs font-bold bg-white border-slate-300 w-[200px] text-indigo-950">
                    <SelectValue placeholder="Escolha a empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    {empresas.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id} className="text-xs font-medium">
                        {emp.nome} ({emp.segmento || 'Geral'})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Banner Informativo do Alvo Ativo */}
          {modo === 'setor' ? (
            <div className="bg-blue-50/60 border border-blue-200 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-blue-950">
                    Setor em Edição:{' '}
                    <span className="text-blue-700 underline">{selectedSetor}</span>
                  </span>
                  {isCustomizadoSetor() ? (
                    <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px] font-bold">
                      Personalizado pelo Usuário
                    </Badge>
                  ) : (
                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] font-bold">
                      Padrão de Mercado
                    </Badge>
                  )}
                </div>
                <p className="text-[11px] text-slate-600 mt-1 max-w-xl">
                  {formData.descricao ||
                    'Define a mediana de mercado aplicada às empresas deste segmento.'}
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRestaurarPadraoSetor}
                disabled={saving}
                className="h-8 text-xs border-slate-300 text-slate-700 hover:bg-slate-100 shrink-0 gap-1.5 shadow-2xs font-semibold"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                Restaurar Padrão
              </Button>
            </div>
          ) : (
            <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-indigo-950">
                    Metas para:{' '}
                    <span className="text-indigo-700 underline">
                      {empresaAtiva?.nome || 'Selecione uma empresa'}
                    </span>
                  </span>
                  {hasEmpresaCustomizada ? (
                    <Badge className="bg-indigo-100 text-indigo-900 border-indigo-300 text-[10px] font-bold">
                      Meta Individual Ativa (Prioridade Máxima)
                    </Badge>
                  ) : (
                    <Badge className="bg-slate-100 text-slate-700 border-slate-300 text-[10px] font-medium">
                      Herdando do Setor ({empresaAtiva?.segmento || 'Geral'})
                    </Badge>
                  )}
                </div>
                <p className="text-[11px] text-slate-600 mt-1 max-w-xl">
                  Ao salvar metas nesta tela, elas prevalecerão sobre qualquer benchmark setorial
                  nos diagnósticos e no radar desta empresa específica.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                {empresas.length > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      // Sugere a primeira empresa diferente da atual como destino
                      const outra = empresas.find((e) => e.id !== selectedEmpresaId)
                      setEmpresaDestinoId(outra ? outra.id : '')
                      setModalDuplicarOpen(true)
                    }}
                    disabled={saving}
                    className="h-8 text-xs border-indigo-300 text-indigo-800 hover:bg-indigo-100/70 gap-1.5 shadow-2xs font-semibold"
                    title="Duplicar estas metas para outra empresa cadastrada"
                  >
                    <Copy className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Duplicar Metas</span>
                  </Button>
                )}

                {hasEmpresaCustomizada && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleRemoverMetaEmpresa}
                    disabled={saving}
                    className="h-8 text-xs border-rose-300 text-rose-700 hover:bg-rose-50 gap-1.5 shadow-2xs font-semibold"
                    title="Remover meta individual e voltar a herdar do setor"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                    Voltar ao Setor
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Alertas / Erros do CSV se houver */}
          {csvErros.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                Avisos da Importação CSV:
              </div>
              <ul className="list-disc pl-5 space-y-0.5 text-[11px] text-amber-800">
                {csvErros.slice(0, 4).map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
                {csvErros.length > 4 && (
                  <li>... e mais {csvErros.length - 4} observações no arquivo.</li>
                )}
              </ul>
            </div>
          )}

          {/* Abas por Grupo de Indicadores (7 abas) */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 h-auto p-1 bg-slate-100/80 rounded-xl gap-1">
              <TabsTrigger
                value="liquidez"
                className="text-xs py-1.5 font-bold data-[state=active]:bg-white data-[state=active]:text-blue-700 shadow-2xs"
              >
                1. Liquidez
              </TabsTrigger>
              <TabsTrigger
                value="endividamento"
                className="text-xs py-1.5 font-bold data-[state=active]:bg-white data-[state=active]:text-amber-700 shadow-2xs"
              >
                2. Endividamento
              </TabsTrigger>
              <TabsTrigger
                value="rentabilidade"
                className="text-xs py-1.5 font-bold data-[state=active]:bg-white data-[state=active]:text-emerald-700 shadow-2xs"
              >
                3. Rentabilidade
              </TabsTrigger>
              <TabsTrigger
                value="estrutura"
                className="text-xs py-1.5 font-bold data-[state=active]:bg-white data-[state=active]:text-indigo-700 shadow-2xs"
              >
                4. Estrutura
              </TabsTrigger>
              <TabsTrigger
                value="ebitda"
                className="text-xs py-1.5 font-bold data-[state=active]:bg-white data-[state=active]:text-purple-700 shadow-2xs"
              >
                5. EBITDA
              </TabsTrigger>
              <TabsTrigger
                value="eficiencia"
                className="text-xs py-1.5 font-bold data-[state=active]:bg-white data-[state=active]:text-cyan-700 shadow-2xs"
              >
                6. Eficiência
              </TabsTrigger>
              <TabsTrigger
                value="economicos"
                className="text-xs py-1.5 font-bold data-[state=active]:bg-white data-[state=active]:text-rose-700 shadow-2xs"
              >
                7. Econômicos
              </TabsTrigger>
            </TabsList>

            {/* 1. ABA LIQUIDEZ */}
            <TabsContent value="liquidez" className="space-y-4 pt-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-slate-800">
                      Liquidez Corrente (LC)
                    </Label>
                    <span className="text-[10px] font-mono text-slate-400">AC / PC</span>
                  </div>
                  <Input
                    type="number"
                    step="0.05"
                    min="0"
                    value={formData.liquidezCorrente ?? ''}
                    onChange={(e) => handleChange('liquidezCorrente', e.target.value)}
                    className="h-9 text-xs font-mono font-bold"
                  />
                  <p className="text-[10px] text-slate-500">
                    Capacidade de honrar obrigações de curto prazo (ex: 1,50x).
                  </p>
                </div>

                <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-slate-800">Liquidez Seca (LS)</Label>
                    <span className="text-[10px] font-mono text-slate-400">
                      (AC − Estoques) / PC
                    </span>
                  </div>
                  <Input
                    type="number"
                    step="0.05"
                    min="0"
                    value={formData.liquidezSeca ?? ''}
                    onChange={(e) => handleChange('liquidezSeca', e.target.value)}
                    className="h-9 text-xs font-mono font-bold"
                  />
                  <p className="text-[10px] text-slate-500">
                    Liquidez sem depender da venda de estoques (ex: 1,00x).
                  </p>
                </div>

                <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-slate-800">
                      Liquidez Imediata (LI)
                    </Label>
                    <span className="text-[10px] font-mono text-slate-400">Caixa / PC</span>
                  </div>
                  <Input
                    type="number"
                    step="0.05"
                    min="0"
                    value={formData.liquidezImediata ?? ''}
                    onChange={(e) => handleChange('liquidezImediata', e.target.value)}
                    className="h-9 text-xs font-mono font-bold"
                  />
                  <p className="text-[10px] text-slate-500">
                    Disponibilidades imediatas frente às dívidas de curto prazo (ex: 0,25x).
                  </p>
                </div>

                <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-slate-800">Liquidez Geral (LG)</Label>
                    <span className="text-[10px] font-mono text-slate-400">
                      (AC + RLP) / (PC + PNC)
                    </span>
                  </div>
                  <Input
                    type="number"
                    step="0.05"
                    min="0"
                    value={formData.liquidezGeral ?? ''}
                    onChange={(e) => handleChange('liquidezGeral', e.target.value)}
                    className="h-9 text-xs font-mono font-bold"
                  />
                  <p className="text-[10px] text-slate-500">
                    Solvência total de curto e longo prazo (ex: 1,25x).
                  </p>
                </div>
              </div>
            </TabsContent>

            {/* 2. ABA ENDIVIDAMENTO */}
            <TabsContent value="endividamento" className="space-y-4 pt-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-slate-800">
                      Endividamento Geral (EG %)
                    </Label>
                    <span className="text-[10px] font-mono text-slate-400">Passivo / Ativo</span>
                  </div>
                  <Input
                    type="number"
                    step="0.5"
                    min="0"
                    max="100"
                    value={formData.endividamentoGeral ?? ''}
                    onChange={(e) => handleChange('endividamentoGeral', e.target.value)}
                    className="h-9 text-xs font-mono font-bold"
                  />
                  <p className="text-[10px] text-slate-500">
                    Porcentagem do ativo total financiada por terceiros (ex: 50%).
                  </p>
                </div>

                <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-slate-800">
                      Composição do Endividamento (CE %)
                    </Label>
                    <span className="text-[10px] font-mono text-slate-400">PC / Passivo Total</span>
                  </div>
                  <Input
                    type="number"
                    step="0.5"
                    min="0"
                    max="100"
                    value={formData.composicaoEndividamento ?? ''}
                    onChange={(e) => handleChange('composicaoEndividamento', e.target.value)}
                    className="h-9 text-xs font-mono font-bold"
                  />
                  <p className="text-[10px] text-slate-500">
                    Concentração da dívida no curto prazo (ex: 55%).
                  </p>
                </div>

                <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-slate-800">
                      Part. Cap. de Terceiros (PCT %)
                    </Label>
                    <span className="text-[10px] font-mono text-slate-400">Passivo / PL</span>
                  </div>
                  <Input
                    type="number"
                    step="1"
                    min="0"
                    value={formData.participacaoCapitalTerceiros ?? ''}
                    onChange={(e) => handleChange('participacaoCapitalTerceiros', e.target.value)}
                    className="h-9 text-xs font-mono font-bold"
                  />
                  <p className="text-[10px] text-slate-500">
                    Relação entre capital de terceiros e patrimônio líquido (ex: 100%).
                  </p>
                </div>

                <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-slate-800">
                      Imobilização do PL (IPL %)
                    </Label>
                    <span className="text-[10px] font-mono text-slate-400">Imobilizado / PL</span>
                  </div>
                  <Input
                    type="number"
                    step="1"
                    min="0"
                    value={formData.imobilizacaoPL ?? ''}
                    onChange={(e) => handleChange('imobilizacaoPL', e.target.value)}
                    className="h-9 text-xs font-mono font-bold"
                  />
                  <p className="text-[10px] text-slate-500">
                    Comprometimento do PL em ativos imobilizados fixos (ex: 50%).
                  </p>
                </div>
              </div>
            </TabsContent>

            {/* 3. ABA RENTABILIDADE */}
            <TabsContent value="rentabilidade" className="space-y-4 pt-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-slate-800">Margem Bruta (%)</Label>
                    <span className="text-[10px] font-mono text-slate-400">LB / RL</span>
                  </div>
                  <Input
                    type="number"
                    step="0.5"
                    min="0"
                    value={formData.margemBruta ?? ''}
                    onChange={(e) => handleChange('margemBruta', e.target.value)}
                    className="h-9 text-xs font-mono font-bold"
                  />
                  <p className="text-[10px] text-slate-500">Lucro bruto sobre vendas (ex: 35%).</p>
                </div>

                <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-slate-800">
                      Margem Operacional (%)
                    </Label>
                    <span className="text-[10px] font-mono text-slate-400">EBIT / RL</span>
                  </div>
                  <Input
                    type="number"
                    step="0.5"
                    value={formData.margemOperacional ?? ''}
                    onChange={(e) => handleChange('margemOperacional', e.target.value)}
                    className="h-9 text-xs font-mono font-bold"
                  />
                  <p className="text-[10px] text-slate-500">Eficiência das operações (ex: 12%).</p>
                </div>

                <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-slate-800">Margem Líquida (%)</Label>
                    <span className="text-[10px] font-mono text-slate-400">LL / RL</span>
                  </div>
                  <Input
                    type="number"
                    step="0.5"
                    value={formData.margemLiquida ?? ''}
                    onChange={(e) => handleChange('margemLiquida', e.target.value)}
                    className="h-9 text-xs font-mono font-bold"
                  />
                  <p className="text-[10px] text-slate-500">
                    Lucro líquido final sobre vendas (ex: 10%).
                  </p>
                </div>

                <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-slate-800">ROE (Retorno PL %)</Label>
                    <span className="text-[10px] font-mono text-slate-400">LL / PL</span>
                  </div>
                  <Input
                    type="number"
                    step="0.5"
                    value={formData.roe ?? ''}
                    onChange={(e) => handleChange('roe', e.target.value)}
                    className="h-9 text-xs font-mono font-bold"
                  />
                  <p className="text-[10px] text-slate-500">
                    Rentabilidade dos sócios/acionistas (ex: 15%).
                  </p>
                </div>

                <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-slate-800">
                      ROA (Retorno Ativo %)
                    </Label>
                    <span className="text-[10px] font-mono text-slate-400">LL / Ativo</span>
                  </div>
                  <Input
                    type="number"
                    step="0.5"
                    value={formData.roa ?? ''}
                    onChange={(e) => handleChange('roa', e.target.value)}
                    className="h-9 text-xs font-mono font-bold"
                  />
                  <p className="text-[10px] text-slate-500">
                    Rentabilidade dos ativos totais (ex: 8%).
                  </p>
                </div>

                <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-slate-800">Giro do Ativo (x)</Label>
                    <span className="text-[10px] font-mono text-slate-400">RL / Ativo</span>
                  </div>
                  <Input
                    type="number"
                    step="0.05"
                    min="0"
                    value={formData.giroAtivo ?? ''}
                    onChange={(e) => handleChange('giroAtivo', e.target.value)}
                    className="h-9 text-xs font-mono font-bold"
                  />
                  <p className="text-[10px] text-slate-500">
                    Eficiência de giro da receita sobre o ativo (ex: 1,00x).
                  </p>
                </div>
              </div>
            </TabsContent>

            {/* 4. ABA ESTRUTURA DE CAPITAL */}
            <TabsContent value="estrutura" className="space-y-4 pt-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-slate-800">
                      Autonomia Financeira (%)
                    </Label>
                    <span className="text-[10px] font-mono text-slate-400">PL / Ativo</span>
                  </div>
                  <Input
                    type="number"
                    step="0.5"
                    min="0"
                    max="100"
                    value={formData.autonomiaFinanceira ?? ''}
                    onChange={(e) => handleChange('autonomiaFinanceira', e.target.value)}
                    className="h-9 text-xs font-mono font-bold"
                  />
                  <p className="text-[10px] text-slate-500">
                    Grau de independência com recursos próprios (ex: 50%).
                  </p>
                </div>

                <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-slate-800">
                      Dependência Financeira (%)
                    </Label>
                    <span className="text-[10px] font-mono text-slate-400">Passivo / Ativo</span>
                  </div>
                  <Input
                    type="number"
                    step="0.5"
                    min="0"
                    max="100"
                    value={formData.dependenciaFinanceira ?? ''}
                    onChange={(e) => handleChange('dependenciaFinanceira', e.target.value)}
                    className="h-9 text-xs font-mono font-bold"
                  />
                  <p className="text-[10px] text-slate-500">
                    Proporção do capital de terceiros no ativo (ex: 50%).
                  </p>
                </div>

                <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-slate-800">
                      Dívida / Equity (D/E x)
                    </Label>
                    <span className="text-[10px] font-mono text-slate-400">Passivo / PL</span>
                  </div>
                  <Input
                    type="number"
                    step="0.05"
                    min="0"
                    value={formData.dividaEquity ?? ''}
                    onChange={(e) => handleChange('dividaEquity', e.target.value)}
                    className="h-9 text-xs font-mono font-bold"
                  />
                  <p className="text-[10px] text-slate-500">
                    Multiplicador da dívida sobre o patrimônio (ex: 1,00x).
                  </p>
                </div>
              </div>
            </TabsContent>

            {/* 5. ABA EBITDA */}
            <TabsContent value="ebitda" className="space-y-4 pt-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-slate-800">Margem EBITDA (%)</Label>
                    <span className="text-[10px] font-mono text-slate-400">EBITDA / RL</span>
                  </div>
                  <Input
                    type="number"
                    step="0.5"
                    value={formData.margemEbitda ?? ''}
                    onChange={(e) => handleChange('margemEbitda', e.target.value)}
                    className="h-9 text-xs font-mono font-bold"
                  />
                  <p className="text-[10px] text-slate-500">
                    Geração operacional de caixa sobre vendas (ex: 17%).
                  </p>
                </div>

                <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-slate-800">
                      Cobertura de Juros (x)
                    </Label>
                    <span className="text-[10px] font-mono text-slate-400">
                      EBITDA / Desp. Fin.
                    </span>
                  </div>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    value={formData.coberturaJuros ?? ''}
                    onChange={(e) => handleChange('coberturaJuros', e.target.value)}
                    className="h-9 text-xs font-mono font-bold"
                  />
                  <p className="text-[10px] text-slate-500">
                    Vezes que o EBITDA cobre as despesas financeiras (ex: 3,5x).
                  </p>
                </div>
              </div>
            </TabsContent>

            {/* 6. ABA EFICIÊNCIA OPERACIONAL */}
            <TabsContent value="eficiencia" className="space-y-4 pt-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-slate-800">
                      PMR (Recebimento - dias)
                    </Label>
                    <span className="text-[10px] font-mono text-slate-400">Clientes</span>
                  </div>
                  <Input
                    type="number"
                    step="1"
                    min="0"
                    value={formData.pmr ?? ''}
                    onChange={(e) => handleChange('pmr', e.target.value)}
                    className="h-9 text-xs font-mono font-bold"
                  />
                  <p className="text-[10px] text-slate-500">
                    Prazo médio de recebimento de vendas a prazo (ex: 45 dias).
                  </p>
                </div>

                <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-slate-800">
                      PME (Estocagem - dias)
                    </Label>
                    <span className="text-[10px] font-mono text-slate-400">Estoques</span>
                  </div>
                  <Input
                    type="number"
                    step="1"
                    min="0"
                    value={formData.pme ?? ''}
                    onChange={(e) => handleChange('pme', e.target.value)}
                    className="h-9 text-xs font-mono font-bold"
                  />
                  <p className="text-[10px] text-slate-500">
                    Prazo médio de permanência dos estoques (ex: 30 dias).
                  </p>
                </div>

                <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-slate-800">
                      PMP (Pagamento - dias)
                    </Label>
                    <span className="text-[10px] font-mono text-slate-400">Fornecedores</span>
                  </div>
                  <Input
                    type="number"
                    step="1"
                    min="0"
                    value={formData.pmp ?? ''}
                    onChange={(e) => handleChange('pmp', e.target.value)}
                    className="h-9 text-xs font-mono font-bold"
                  />
                  <p className="text-[10px] text-slate-500">
                    Prazo médio de pagamento a fornecedores (ex: 40 dias).
                  </p>
                </div>

                <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-slate-800">
                      Ciclo Operacional (dias)
                    </Label>
                    <span className="text-[10px] font-mono text-slate-400">PME + PMR</span>
                  </div>
                  <Input
                    type="number"
                    step="1"
                    min="0"
                    value={formData.cicloOperacional ?? ''}
                    onChange={(e) => handleChange('cicloOperacional', e.target.value)}
                    className="h-9 text-xs font-mono font-bold"
                  />
                  <p className="text-[10px] text-slate-500">
                    Tempo total da compra à venda recebida (ex: 75 dias).
                  </p>
                </div>

                <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-slate-800">
                      Ciclo Financeiro (dias)
                    </Label>
                    <span className="text-[10px] font-mono text-slate-400">CO − PMP</span>
                  </div>
                  <Input
                    type="number"
                    step="1"
                    value={formData.cicloFinanceiro ?? ''}
                    onChange={(e) => handleChange('cicloFinanceiro', e.target.value)}
                    className="h-9 text-xs font-mono font-bold"
                  />
                  <p className="text-[10px] text-slate-500">
                    Período em que a operação requer caixa financiado (ex: 35 dias).
                  </p>
                </div>
              </div>
            </TabsContent>

            {/* 7. ABA ECONÔMICOS & VALUATION */}
            <TabsContent value="economicos" className="space-y-4 pt-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-slate-800">ROIC (%)</Label>
                    <span className="text-[10px] font-mono text-slate-400">
                      NOPAT / Cap. Investido
                    </span>
                  </div>
                  <Input
                    type="number"
                    step="0.5"
                    value={formData.roic ?? ''}
                    onChange={(e) => handleChange('roic', e.target.value)}
                    className="h-9 text-xs font-mono font-bold"
                  />
                  <p className="text-[10px] text-slate-500">
                    Retorno sobre o capital total investido (ex: 14%).
                  </p>
                </div>

                <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-slate-800">WACC (%)</Label>
                    <span className="text-[10px] font-mono text-slate-400">Custo Capital</span>
                  </div>
                  <Input
                    type="number"
                    step="0.5"
                    value={formData.wacc ?? ''}
                    onChange={(e) => handleChange('wacc', e.target.value)}
                    className="h-9 text-xs font-mono font-bold"
                  />
                  <p className="text-[10px] text-slate-500">
                    Custo médio ponderado de capital (ex: 12%).
                  </p>
                </div>

                <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-1.5 bg-rose-50/30">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-rose-950">Spread Econômico (%)</Label>
                    <span className="text-[10px] font-mono text-rose-700">ROIC − WACC</span>
                  </div>
                  <Input
                    type="number"
                    step="0.5"
                    disabled
                    value={Number(((formData.roic ?? 0) - (formData.wacc ?? 12)).toFixed(1))}
                    className="h-9 text-xs font-mono font-bold bg-white text-rose-800"
                  />
                  <p className="text-[10px] text-rose-700">
                    Calculado automaticamente (positivo indica criação de valor).
                  </p>
                </div>
              </div>

              {/* Descrição do Setor ou da Empresa */}
              <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-1.5">
                <Label className="text-xs font-bold text-slate-800">
                  {modo === 'setor'
                    ? `Descrição e Particularidades do Setor ${selectedSetor}`
                    : `Observações e Metas para ${empresaAtiva?.nome || 'a Empresa'}`}
                </Label>
                <Textarea
                  rows={2}
                  value={formData.descricao ?? ''}
                  onChange={(e) => handleTextChange('descricao', e.target.value)}
                  placeholder={
                    modo === 'setor'
                      ? 'Descreva as premissas e medianas deste setor...'
                      : 'Descreva as metas estratégicas e objetivos pactuados com esta empresa...'
                  }
                  className="text-xs resize-none"
                />
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="p-4 border-t border-slate-100 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-slate-500 text-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Sincronizado em tempo real com o Agente de IA e os Painéis.</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={saving}
              className="text-xs h-9 border-slate-300"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSalvar}
              disabled={saving}
              className={`text-xs h-9 font-bold gap-1.5 shadow-xs text-white ${
                modo === 'empresa'
                  ? 'bg-indigo-600 hover:bg-indigo-700'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {saving ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  Salvar {modo === 'empresa' ? 'Metas da Empresa' : 'Benchmark do Setor'}
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>

      {/* Submodal de Confirmação e Configuração da Duplicação de Metas */}
      <Dialog open={modalDuplicarOpen} onOpenChange={setModalDuplicarOpen}>
        <DialogContent className="max-w-md rounded-2xl border-slate-200">
          <DialogHeader className="pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
                <Copy className="w-4 h-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-[#0B1F3A]">
                  Duplicar Metas entre Empresas
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Copie o conjunto completo de metas configurado na empresa de origem
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="py-3 space-y-4 text-xs">
            {/* Resumo da Empresa Origem */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Empresa de Origem:</span>
                <span className="font-bold text-[#0B1F3A]">{empresaAtiva?.nome || '—'}</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-500">Setor da Origem:</span>
                <Badge variant="outline" className="bg-white text-slate-700 border-slate-300">
                  {empresaAtiva?.segmento || 'Geral'}
                </Badge>
              </div>
              <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200">
                <span className="text-slate-500">Total de Indicadores/Metas:</span>
                <span className="font-mono font-bold text-indigo-700">28 metas configuradas</span>
              </div>
            </div>

            <div className="flex items-center justify-center text-slate-400">
              <ArrowRight className="w-4 h-4 text-indigo-600" />
            </div>

            {/* Seleção da Empresa Destino */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">
                Selecione a Empresa de Destino:
              </Label>
              <Select value={empresaDestinoId} onValueChange={(val) => setEmpresaDestinoId(val)}>
                <SelectTrigger className="h-9 text-xs font-bold bg-white border-slate-300 w-full text-indigo-950">
                  <SelectValue placeholder="Escolha a empresa de destino" />
                </SelectTrigger>
                <SelectContent>
                  {empresas
                    .filter((emp) => emp.id !== selectedEmpresaId)
                    .map((emp) => (
                      <SelectItem key={emp.id} value={emp.id} className="text-xs font-medium">
                        {emp.nome} ({emp.segmento || 'Geral'})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Alertas contextuais da Empresa de Destino */}
            {(() => {
              const destino = empresas.find((e) => e.id === empresaDestinoId)
              if (!destino) return null

              const mesmoSetor = destino.segmento === empresaAtiva?.segmento
              const destinoJaTemMetas = Boolean(empresaBenchmarksMap[destino.id])

              return (
                <div className="space-y-2">
                  {!mesmoSetor && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div className="text-[11px] leading-relaxed">
                        <strong>Aviso de Setores Diferentes:</strong> A origem é do setor{' '}
                        <strong>{empresaAtiva?.segmento || 'Geral'}</strong> e o destino é do setor{' '}
                        <strong>{destino.segmento || 'Geral'}</strong>. As metas serão copiadas
                        exatamente como estão na tela.
                      </div>
                    </div>
                  )}

                  {destinoJaTemMetas && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                      <div className="text-[11px] leading-relaxed">
                        <strong>Substituição de Metas (Upsert):</strong> A empresa destino{' '}
                        <strong>"{destino.nome}"</strong> já possui metas específicas cadastradas.
                        Ao confirmar, os valores existentes serão sobrescritos pelas novas metas.
                      </div>
                    </div>
                  )}

                  {mesmoSetor && !destinoJaTemMetas && (
                    <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 flex items-center gap-2 text-[11px]">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>
                        Mesmo setor (<strong>{destino.segmento}</strong>). Cópia direta recomendada.
                      </span>
                    </div>
                  )}
                </div>
              )
            })()}
          </div>

          <DialogFooter className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setModalDuplicarOpen(false)}
              disabled={duplicando}
              className="text-xs h-8"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleConfirmarDuplicacao}
              disabled={duplicando || !empresaDestinoId}
              className="text-xs h-8 font-bold bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 shadow-xs"
            >
              {duplicando ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Duplicando...
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Confirmar e Gravar Metas
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}
export default ModalEditarBenchmarks
