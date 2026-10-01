import React, { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useFilter } from '@/contexts/FilterContext'
import { useToast } from '@/hooks/use-toast'
import { useRealtime } from '@/hooks/use-realtime'
import { contasService, lancamentosService, planoContasService } from '@/services/financeService'
import type { ContaRecord, LancamentoRecord, PlanoContaRecord } from '@/types/finance'
import { gerarListaMeses, type ClassificacaoDre } from '@/lib/dreGerencialTypes'
import { calcularDreGerencialMatriz, calcularComparativoDre } from '@/lib/dreGerencialCalculo'
import {
  exportarDreGerencialExcel,
  exportarDreGerencialCsv,
  exportarDreComparativoExcel,
  exportarDreComparativoCsv,
} from '@/lib/dreGerencialExport'
import { ModalClassificacaoDreLote } from '@/components/ModalClassificacaoDreLote'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  BarChart3,
  Calendar,
  ChevronDown,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Layers,
  Printer,
  Sparkles,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  Building,
  RefreshCw,
  FolderOpen,
  Folder,
} from 'lucide-react'

const MESES_OPCOES = [
  { valor: 1, nome: 'Janeiro' },
  { valor: 2, nome: 'Fevereiro' },
  { valor: 3, nome: 'Março' },
  { valor: 4, nome: 'Abril' },
  { valor: 5, nome: 'Maio' },
  { valor: 6, nome: 'Junho' },
  { valor: 7, nome: 'Julho' },
  { valor: 8, nome: 'Agosto' },
  { valor: 9, nome: 'Setembro' },
  { valor: 10, nome: 'Outubro' },
  { valor: 11, nome: 'Novembro' },
  { valor: 12, nome: 'Dezembro' },
]

function formatBrl(val: number | undefined | null): string {
  if (val === undefined || val === null || isNaN(val)) return 'R$ 0,00'
  return val.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export default function DreGerencial() {
  const { toast } = useToast()
  const { selectedEmpresaId, selectedEmpresa, empresas, selectedAno, isGrupoAtivo, grupoAtivo } =
    useFilter()

  // Estados de dados
  const [loading, setLoading] = useState(true)
  const [lancamentos, setLancamentos] = useState<LancamentoRecord[]>([])
  const [contas, setContas] = useState<ContaRecord[]>([])
  const [planoContas, setPlanoContas] = useState<PlanoContaRecord[]>([])

  // Modo de visualização: 'unico' ou 'comparativo'
  const [modoVisualizacao, setModoVisualizacao] = useState<'unico' | 'comparativo'>('unico')

  // Filtros de período 1 (base) - máximo 12 meses
  const currentYear = selectedAno || new Date().getFullYear()
  const [anoInicial, setAnoInicial] = useState<number>(currentYear)

  // Sincroniza o ano inicial se o selectedAno mudar externamente (ex.: seletor global)
  useEffect(() => {
    if (selectedAno) {
      setAnoInicial(selectedAno)
      // Ajusta período 2 para o ano imediatamente anterior se ainda não configurado
      setAnoPeriodo2(selectedAno - 1)
    }
  }, [selectedAno])

  const [mesInicial, setMesInicial] = useState<number>(1)
  const [qtdMeses, setQtdMeses] = useState<number>(12)
  const [avisoLimiteMeses, setAvisoLimiteMeses] = useState(false)

  // Filtros de período 2 (comparativo) - ex.: ano anterior ou período customizado até 12 meses
  const [anoPeriodo2, setAnoPeriodo2] = useState<number>(currentYear - 1)
  const [mesInicialPeriodo2, setMesInicialPeriodo2] = useState<number>(1)
  const [qtdMesesPeriodo2, setQtdMesesPeriodo2] = useState<number>(12)
  const [avisoLimiteMeses2, setAvisoLimiteMeses2] = useState(false)

  // Controle de grupos expandidos (drill-down por grupo)
  const [gruposExpandidos, setGruposExpandidos] = useState<Record<string, boolean>>({
    Receita: true,
    'Despesa Variável': true,
    'Despesa Fixa': true,
    'Despesa Financeira': true,
    'Receita Financeira': true,
    naoClassificados: true,
  })

  // Modal para corrigir classificações
  const [modalClassificacaoOpen, setModalClassificacaoOpen] = useState(false)

  // Carregar dados
  const carregarDados = async () => {
    try {
      setLoading(true)

      // Identifica quais empresas devem ser consultadas
      // Se for grupo empresarial selecionado ("grupo-..."), busca lançamentos das empresas do grupo
      let lancsPromise: Promise<LancamentoRecord[]>
      let contasPromise: Promise<ContaRecord[]>
      let planosPromise: Promise<PlanoContaRecord[]>

      if (isGrupoAtivo && grupoAtivo && grupoAtivo.empresas && grupoAtivo.empresas.length > 0) {
        // Carrega lançamentos e cadastros de todas as empresas do grupo
        const empIds = new Set(grupoAtivo.empresas)
        lancsPromise = lancamentosService
          .getAll({ expandRelations: true })
          .then((list) => list.filter((l) => empIds.has(l.empresa)))
        contasPromise = contasService
          .getAll()
          .then((list) => list.filter((c) => !c.empresa || empIds.has(c.empresa)))
        planosPromise = planoContasService
          .getAll()
          .then((list) => list.filter((p) => !p.empresa || empIds.has(p.empresa)))
      } else if (selectedEmpresaId && !selectedEmpresaId.startsWith('grupo-')) {
        lancsPromise = lancamentosService.getAll({
          empresaId: selectedEmpresaId,
          expandRelations: true,
        })
        contasPromise = contasService.getAll({ empresaId: selectedEmpresaId })
        planosPromise = planoContasService.getAll({ empresaId: selectedEmpresaId })
      } else {
        // Sem filtro ou consolidado geral
        lancsPromise = lancamentosService.getAll({ expandRelations: true })
        contasPromise = contasService.getAll()
        planosPromise = planoContasService.getAll()
      }

      const [contasList, lancamentosList, planosList] = await Promise.all([
        contasPromise,
        lancsPromise,
        planosPromise,
      ])

      setContas(contasList)
      setLancamentos(lancamentosList)
      setPlanoContas(planosList)
    } catch (err: any) {
      console.error('Erro ao carregar dados da DRE:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar dados',
        description: 'Não foi possível carregar lançamentos rápidos e contas.',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarDados()
  }, [selectedEmpresaId, isGrupoAtivo, grupoAtivo])

  // Realtime para atualizar a DRE quando novos lançamentos ou contas forem cadastrados/editados
  useRealtime<LancamentoRecord>('lancamentos', () => {
    carregarDados()
  })
  useRealtime<ContaRecord>('contas', () => {
    carregarDados()
  })
  useRealtime<PlanoContaRecord>('plano_contas', () => {
    carregarDados()
  })

  // Listener para evento de atualização cadastral no mesmo navegador
  useEffect(() => {
    const handleRecarregar = () => carregarDados()
    window.addEventListener('dre-contas-atualizadas', handleRecarregar)
    return () => {
      window.removeEventListener('dre-contas-atualizadas', handleRecarregar)
    }
  }, [])

  // Tratar alteração na quantidade de meses com validação do limite de 12
  const handleQtdMesesChange = (novaQtd: number) => {
    if (novaQtd > 12) {
      setQtdMeses(12)
      setAvisoLimiteMeses(true)
      toast({
        variant: 'destructive',
        title: 'Limite de 12 meses',
        description: 'O período máximo para a análise da DRE gerencial é de 12 meses.',
      })
    } else if (novaQtd < 1) {
      setQtdMeses(1)
      setAvisoLimiteMeses(false)
    } else {
      setQtdMeses(novaQtd)
      setAvisoLimiteMeses(false)
    }
  }

  const handleQtdMesesPeriodo2Change = (novaQtd: number) => {
    if (novaQtd > 12) {
      setQtdMesesPeriodo2(12)
      setAvisoLimiteMeses2(true)
      toast({
        variant: 'destructive',
        title: 'Limite de 12 meses',
        description: 'O período 2 também possui o limite máximo de 12 meses.',
      })
    } else if (novaQtd < 1) {
      setQtdMesesPeriodo2(1)
      setAvisoLimiteMeses2(false)
    } else {
      setQtdMesesPeriodo2(novaQtd)
      setAvisoLimiteMeses2(false)
    }
  }

  // Lista de colunas de meses geradas para período 1
  const meses = useMemo(() => {
    return gerarListaMeses(anoInicial, mesInicial, qtdMeses)
  }, [anoInicial, mesInicial, qtdMeses])

  // Lista de colunas de meses geradas para período 2 (comparativo)
  const mesesPeriodo2 = useMemo(() => {
    return gerarListaMeses(anoPeriodo2, mesInicialPeriodo2, qtdMesesPeriodo2)
  }, [anoPeriodo2, mesInicialPeriodo2, qtdMesesPeriodo2])

  // Cálculo da matriz da DRE período 1
  const matriz = useMemo(() => {
    return calcularDreGerencialMatriz(lancamentos, contas, meses, planoContas)
  }, [lancamentos, contas, meses, planoContas])

  // Cálculo da matriz da DRE período 2
  const matrizPeriodo2 = useMemo(() => {
    return calcularDreGerencialMatriz(lancamentos, contas, mesesPeriodo2, planoContas)
  }, [lancamentos, contas, mesesPeriodo2, planoContas])

  // Descrições textuais dos períodos
  const p1Descricao = useMemo(() => {
    if (meses.length === 0) return ''
    return `${meses[0].rotuloCurto} a ${meses[meses.length - 1].rotuloCurto}`
  }, [meses])

  const p2Descricao = useMemo(() => {
    if (mesesPeriodo2.length === 0) return ''
    return `${mesesPeriodo2[0].rotuloCurto} a ${mesesPeriodo2[mesesPeriodo2.length - 1].rotuloCurto}`
  }, [mesesPeriodo2])

  // Comparativo consolidado entre Período 2 (base comparada) vs Período 1 (referência)
  // Período 1: ex. Ano Anterior, Período 2: ex. Ano Atual (para variação P2 - P1)
  // De acordo com o padrão contábil comparativo: Base (P1) -> Comparado (P2)
  const comparativo = useMemo(() => {
    return calcularComparativoDre(matrizPeriodo2, matriz, p2Descricao, p1Descricao)
  }, [matrizPeriodo2, matriz, p2Descricao, p1Descricao])

  const toggleGrupo = (chave: string) => {
    setGruposExpandidos((prev) => ({
      ...prev,
      [chave]: !prev[chave],
    }))
  }

  const expandirTodos = () => {
    setGruposExpandidos({
      Receita: true,
      'Despesa Variável': true,
      'Despesa Fixa': true,
      'Despesa Financeira': true,
      'Receita Financeira': true,
      naoClassificados: true,
    })
  }

  const recolherTodos = () => {
    setGruposExpandidos({
      Receita: false,
      'Despesa Variável': false,
      'Despesa Fixa': false,
      'Despesa Financeira': false,
      'Receita Financeira': false,
      naoClassificados: false,
    })
  }

  const handleImprimir = () => {
    window.print()
  }

  const handleExportarExcel = () => {
    try {
      if (modoVisualizacao === 'comparativo') {
        exportarDreComparativoExcel(comparativo, selectedEmpresa)
        toast({
          title: 'DRE Comparativa Exportada',
          description: 'Planilha Excel gerada com a comparação dos 2 períodos e variações.',
        })
      } else {
        exportarDreGerencialExcel(matriz, selectedEmpresa)
        toast({
          title: 'DRE Exportada com sucesso',
          description: 'Planilha Excel gerada com a matriz da DRE Gerencial.',
        })
      }
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: 'Erro na exportação',
        description: e?.message || 'Falha ao gerar arquivo Excel.',
      })
    }
  }

  const handleExportarCsv = () => {
    try {
      if (modoVisualizacao === 'comparativo') {
        exportarDreComparativoCsv(comparativo, selectedEmpresa)
        toast({
          title: 'DRE Comparativa Exportada',
          description: 'Arquivo CSV com dados comparativos e variações gerado.',
        })
      } else {
        exportarDreGerencialCsv(matriz, selectedEmpresa)
        toast({
          title: 'DRE Exportada com sucesso',
          description: 'Arquivo CSV gerado com separador padrão brasileiro (;).',
        })
      }
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: 'Erro na exportação',
        description: e?.message || 'Falha ao gerar arquivo CSV.',
      })
    }
  }

  // Estatísticas do cabeçalho
  const lucroTotal = matriz.lucroPrejuizo.totalPeriodo
  const isLucro = lucroTotal >= 0
  const totalReceitas = matriz.totalReceitasPeriodo
  const totalDespesasVar =
    matriz.grupos.find((g) => g.classificacao === 'Despesa Variável')?.totalPeriodo || 0
  const totalDespesasFix =
    matriz.grupos.find((g) => g.classificacao === 'Despesa Fixa')?.totalPeriodo || 0
  const totalDespesasFin =
    matriz.grupos.find((g) => g.classificacao === 'Despesa Financeira')?.totalPeriodo || 0
  const totalReceitasFin =
    matriz.grupos.find((g) => g.classificacao === 'Receita Financeira')?.totalPeriodo || 0

  return (
    <div className="space-y-6 animate-fadeIn pb-12 print:p-0 print:m-0">
      {/* Cabeçalho da tela */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-blue-100/70 text-blue-700">
              <BarChart3 className="w-5 h-5" />
            </span>
            <div>
              <h1 className="text-xl font-bold text-[#0B1F3A] tracking-tight">
                DRE Gerencial por Período
              </h1>
              <p className="text-xs text-[#5B6B7F]">
                Demonstração do Resultado gerencial matricial extraída diretamente dos lançamentos
                rápidos (até 12 meses).
              </p>
            </div>
          </div>
        </div>

        {/* Toggle de Modo: Período único vs Comparativo e Ações */}
        <div className="flex items-center gap-2 flex-wrap print:hidden">
          {/* Toggle de Modo */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setModoVisualizacao('unico')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                modoVisualizacao === 'unico'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Período Único
            </button>
            <button
              type="button"
              onClick={() => setModoVisualizacao('comparativo')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${
                modoVisualizacao === 'comparativo'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Comparativo</span>
              <Badge
                variant="secondary"
                className="text-[9px] px-1 py-0 h-4 bg-blue-50 text-blue-700 border-blue-200"
              >
                2 Períodos
              </Badge>
            </button>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setModalClassificacaoOpen(true)}
            className="h-8 text-xs font-semibold border-slate-200 hover:bg-slate-50 text-slate-700 gap-1.5"
            title="Classificar contas contábeis para a DRE"
          >
            <Layers className="w-3.5 h-3.5 text-blue-600" />
            Classificação das Contas
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={carregarDados}
            disabled={loading}
            className="h-8 text-xs font-semibold border-slate-200 hover:bg-slate-50 text-slate-700 gap-1.5"
            title="Recarregar dados"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleImprimir}
            className="h-8 text-xs font-semibold border-slate-200 hover:bg-slate-50 text-slate-700 gap-1.5"
            title="Imprimir visualização em folha A4 / Salvar PDF"
          >
            <Printer className="w-3.5 h-3.5 text-slate-600" />
            Imprimir / PDF
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                size="sm"
                className="h-8 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white gap-1.5 shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                Exportar
                <ChevronDown className="w-3 h-3 text-white/80" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 bg-white">
              <DropdownMenuItem
                onClick={handleExportarExcel}
                className="text-xs cursor-pointer gap-2 py-2"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <div className="flex flex-col">
                  <span className="font-semibold text-slate-800">Planilha Excel (.xlsx)</span>
                  <span className="text-[10px] text-slate-500">Matriz com grupos e contas</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleExportarCsv}
                className="text-xs cursor-pointer gap-2 py-2"
              >
                <Download className="w-4 h-4 text-blue-600" />
                <div className="flex flex-col">
                  <span className="font-semibold text-slate-800">Arquivo CSV (.csv)</span>
                  <span className="text-[10px] text-slate-500">
                    Padrão delimitado por ponto e vírgula
                  </span>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Barra de Filtros e Empresa */}
      <Card className="bg-white border-slate-200 shadow-xs print:hidden">
        <CardContent className="py-4 px-5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Empresa Ativa */}
            <div className="flex items-center gap-2">
              <Building className="w-4 h-4 text-slate-400 shrink-0" />
              <div className="text-xs">
                <span className="text-slate-500">Empresa: </span>
                <span className="font-bold text-[#0B1F3A]">
                  {selectedEmpresa ? selectedEmpresa.nome : 'Todas as empresas (Consolidado)'}
                </span>
                {selectedEmpresa?.segmento && (
                  <Badge variant="outline" className="ml-2 text-[10px]">
                    {selectedEmpresa.segmento}
                  </Badge>
                )}
              </div>
            </div>

            {/* Seletores de Período */}
            <div className="flex flex-col lg:flex-row lg:items-center gap-4 flex-wrap">
              {/* Bloco Período 1 (ou Período Principal) */}
              <div className="flex items-center gap-2 bg-slate-50/80 p-1.5 rounded-lg border border-slate-200/80">
                <div className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-blue-600" />
                  <span className="text-[11px] font-bold text-slate-700 uppercase">
                    {modoVisualizacao === 'comparativo' ? 'Período Atual:' : 'Início:'}
                  </span>
                </div>
                <Select
                  value={String(mesInicial)}
                  onValueChange={(val) => setMesInicial(Number(val))}
                >
                  <SelectTrigger className="h-7 text-xs bg-white w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MESES_OPCOES.map((m) => (
                      <SelectItem key={m.valor} value={String(m.valor)} className="text-xs">
                        {m.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Input
                  type="number"
                  value={anoInicial}
                  onChange={(e) => setAnoInicial(Number(e.target.value) || currentYear)}
                  className="h-7 w-18 text-xs font-semibold"
                  min={2000}
                  max={2100}
                />

                <span className="text-[11px] text-slate-500 font-medium">Meses:</span>
                <Input
                  type="number"
                  min={1}
                  max={12}
                  value={qtdMeses}
                  onChange={(e) => handleQtdMesesChange(Number(e.target.value))}
                  className="h-7 w-12 text-xs text-center font-bold"
                  title="Quantidade de meses (máx 12)"
                />
              </div>

              {/* Bloco Período 2 (Aparece apenas quando comparativo ativo) */}
              {modoVisualizacao === 'comparativo' && (
                <div className="flex items-center gap-2 bg-purple-50/70 p-1.5 rounded-lg border border-purple-200/80">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-purple-600" />
                    <span className="text-[11px] font-bold text-purple-900 uppercase">
                      Período Comparado:
                    </span>
                  </div>
                  <Select
                    value={String(mesInicialPeriodo2)}
                    onValueChange={(val) => setMesInicialPeriodo2(Number(val))}
                  >
                    <SelectTrigger className="h-7 text-xs bg-white w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MESES_OPCOES.map((m) => (
                        <SelectItem key={m.valor} value={String(m.valor)} className="text-xs">
                          {m.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Input
                    type="number"
                    value={anoPeriodo2}
                    onChange={(e) => setAnoPeriodo2(Number(e.target.value) || currentYear - 1)}
                    className="h-7 w-18 text-xs font-semibold"
                    min={2000}
                    max={2100}
                  />

                  <span className="text-[11px] text-slate-500 font-medium">Meses:</span>
                  <Input
                    type="number"
                    min={1}
                    max={12}
                    value={qtdMesesPeriodo2}
                    onChange={(e) => handleQtdMesesPeriodo2Change(Number(e.target.value))}
                    className="h-7 w-12 text-xs text-center font-bold"
                    title="Quantidade de meses do período 2 (máx 12)"
                  />
                </div>
              )}

              <div className="flex items-center gap-1.5 ml-auto">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={expandirTodos}
                  className="h-7 text-[11px] text-slate-600 hover:text-blue-700"
                >
                  Expandir Todos
                </Button>
                <span className="text-slate-300">|</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={recolherTodos}
                  className="h-7 text-[11px] text-slate-600 hover:text-blue-700"
                >
                  Recolher Todos
                </Button>
              </div>
            </div>
          </div>

          {(avisoLimiteMeses || avisoLimiteMeses2) && (
            <div className="mt-3 flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 p-2 rounded-lg">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
              <span>
                O período foi ajustado automaticamente para o limite máximo de 12 meses por período.
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cards de Resumo Gerencial */}
      {modoVisualizacao === 'unico' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 print:grid-cols-3">
          <Card className="bg-white border-slate-200 shadow-xs">
            <CardContent className="py-3 px-4">
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                1. Receitas
              </p>
              <p className="text-base font-bold text-emerald-700 mt-1 truncate">
                {formatBrl(totalReceitas)}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white border-slate-200 shadow-xs">
            <CardContent className="py-3 px-4">
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                2. Desp. Variáveis
              </p>
              <p className="text-base font-bold text-amber-700 mt-1 truncate">
                {formatBrl(totalDespesasVar)}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white border-slate-200 shadow-xs">
            <CardContent className="py-3 px-4">
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                3. Desp. Fixas
              </p>
              <p className="text-base font-bold text-rose-700 mt-1 truncate">
                {formatBrl(totalDespesasFix)}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white border-slate-200 shadow-xs">
            <CardContent className="py-3 px-4">
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                4. Desp. Financeiras
              </p>
              <p className="text-base font-bold text-purple-700 mt-1 truncate">
                {formatBrl(totalDespesasFin)}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white border-slate-200 shadow-xs">
            <CardContent className="py-3 px-4">
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                5. Rec. Financeiras
              </p>
              <p className="text-base font-bold text-sky-700 mt-1 truncate">
                {formatBrl(totalReceitasFin)}
              </p>
            </CardContent>
          </Card>

          {/* Lucro ou Prejuízo com Destaque Visual */}
          <Card
            className={`border shadow-xs ${
              isLucro
                ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950'
                : 'bg-rose-50/70 border-rose-300 text-rose-950'
            }`}
          >
            <CardContent className="py-3 px-4">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-wider">
                  {isLucro ? 'Lucro do Período' : 'Prejuízo do Período'}
                </p>
                {isLucro ? (
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-rose-600" />
                )}
              </div>
              <p
                className={`text-base font-extrabold mt-1 truncate ${
                  isLucro ? 'text-emerald-700' : 'text-rose-700'
                }`}
              >
                {formatBrl(lucroTotal)}
              </p>
              <p className="text-[10px] font-semibold opacity-80 mt-0.5">
                Margem Líquida:{' '}
                {matriz.margemLiquidaTotal !== null
                  ? `${matriz.margemLiquidaTotal.toFixed(1)}%`
                  : '—'}
              </p>
            </CardContent>
          </Card>
        </div>
      ) : (
        /* Cards do Comparativo Consolidado */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 print:grid-cols-3">
          {/* Card Período Anterior/Comparado */}
          <Card className="bg-white border-slate-200 shadow-xs">
            <CardContent className="py-3 px-4">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-[11px] font-semibold uppercase tracking-wider">
                  Período Comparado ({p2Descricao})
                </span>
                <Badge variant="outline" className="text-[10px]">
                  Ref
                </Badge>
              </div>
              <div className="mt-2 space-y-1">
                <div className="flex justify-between items-baseline">
                  <span className="text-xs text-slate-600">Lucro / Prejuízo:</span>
                  <span
                    className={`text-sm font-bold ${
                      matrizPeriodo2.lucroPrejuizo.totalPeriodo >= 0
                        ? 'text-emerald-700'
                        : 'text-rose-700'
                    }`}
                  >
                    {formatBrl(matrizPeriodo2.lucroPrejuizo.totalPeriodo)}
                  </span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-xs text-slate-600">Margem Líquida:</span>
                  <span className="text-xs font-semibold text-slate-800">
                    {matrizPeriodo2.margemLiquidaTotal !== null
                      ? `${matrizPeriodo2.margemLiquidaTotal.toFixed(1)}%`
                      : '—'}
                  </span>
                </div>
                <div className="flex justify-between items-baseline text-[11px] text-slate-500">
                  <span>Receitas Totais:</span>
                  <span>{formatBrl(matrizPeriodo2.totalReceitasPeriodo)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card Período Atual */}
          <Card className="bg-white border-slate-200 shadow-xs">
            <CardContent className="py-3 px-4">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-[11px] font-semibold uppercase tracking-wider">
                  Período Atual ({p1Descricao})
                </span>
                <Badge variant="default" className="text-[10px] bg-blue-600">
                  Atual
                </Badge>
              </div>
              <div className="mt-2 space-y-1">
                <div className="flex justify-between items-baseline">
                  <span className="text-xs text-slate-600">Lucro / Prejuízo:</span>
                  <span
                    className={`text-sm font-bold ${
                      matriz.lucroPrejuizo.totalPeriodo >= 0 ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {formatBrl(matriz.lucroPrejuizo.totalPeriodo)}
                  </span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-xs text-slate-600">Margem Líquida:</span>
                  <span className="text-xs font-semibold text-slate-800">
                    {matriz.margemLiquidaTotal !== null
                      ? `${matriz.margemLiquidaTotal.toFixed(1)}%`
                      : '—'}
                  </span>
                </div>
                <div className="flex justify-between items-baseline text-[11px] text-slate-500">
                  <span>Receitas Totais:</span>
                  <span>{formatBrl(matriz.totalReceitasPeriodo)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card Variação Consolidada */}
          <Card
            className={`border shadow-xs ${
              comparativo.lucroPrejuizo.favoravel
                ? 'bg-emerald-50/70 border-emerald-300'
                : 'bg-rose-50/70 border-rose-300'
            }`}
          >
            <CardContent className="py-3 px-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-800">
                  Variação Consolidada (Atual vs Ref)
                </span>
                {comparativo.lucroPrejuizo.favoravel ? (
                  <Badge className="bg-emerald-600 text-white text-[10px]">Favorável</Badge>
                ) : (
                  <Badge className="bg-rose-600 text-white text-[10px]">Desfavorável</Badge>
                )}
              </div>
              <div className="mt-2 space-y-1">
                <div className="flex justify-between items-baseline">
                  <span className="text-xs text-slate-700 font-medium">Variação do Lucro:</span>
                  <span
                    className={`text-sm font-extrabold ${
                      comparativo.lucroPrejuizo.favoravel ? 'text-emerald-800' : 'text-rose-800'
                    }`}
                  >
                    {comparativo.lucroPrejuizo.diferenca >= 0 ? '+' : ''}
                    {formatBrl(comparativo.lucroPrejuizo.diferenca)}
                    {comparativo.lucroPrejuizo.percentual !== null && (
                      <span className="text-xs ml-1 font-semibold">
                        ({comparativo.lucroPrejuizo.percentual >= 0 ? '+' : ''}
                        {comparativo.lucroPrejuizo.percentual.toFixed(1)}%)
                      </span>
                    )}
                  </span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-xs text-slate-700 font-medium">Dif. Margem Líquida:</span>
                  <span
                    className={`text-xs font-bold ${
                      comparativo.margemLiquida.favoravel ? 'text-emerald-800' : 'text-rose-800'
                    }`}
                  >
                    {comparativo.margemLiquida.diferencaPontos !== null
                      ? `${comparativo.margemLiquida.diferencaPontos >= 0 ? '+' : ''}${comparativo.margemLiquida.diferencaPontos.toFixed(1)} p.p.`
                      : '—'}
                  </span>
                </div>
                <div className="flex justify-between items-baseline text-[11px] text-slate-600">
                  <span>Var. Receitas:</span>
                  <span
                    className={`font-semibold ${
                      comparativo.grupos[0]?.favoravel ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {comparativo.grupos[0]?.diferenca >= 0 ? '+' : ''}
                    {formatBrl(comparativo.grupos[0]?.diferenca)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Cabeçalho para impressão */}
      <div className="hidden print:block mb-4 border-b border-slate-300 pb-2">
        <h2 className="text-lg font-bold text-slate-900">
          DEMONSTRAÇÃO DO RESULTADO DO EXERCÍCIO (DRE GERENCIAL)
        </h2>
        <p className="text-xs text-slate-600">
          Empresa: {selectedEmpresa ? selectedEmpresa.nome : 'Consolidado'} ·{' '}
          {modoVisualizacao === 'comparativo'
            ? `Comparativo: ${p1Descricao} (Atual) vs ${p2Descricao} (Comparado)`
            : `Período: ${meses[0]?.rotuloCurto} a ${meses[meses.length - 1]?.rotuloCurto} (${meses.length} meses)`}
        </p>
      </div>

      {/* ================= TABELA MATRICIAL OU COMPARATIVA DA DRE ================= */}
      <Card className="bg-white border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="py-3 px-5 border-b border-slate-100 bg-slate-50/50 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-600" />
              {modoVisualizacao === 'comparativo'
                ? 'DRE Comparativa entre Períodos (Lado a Lado)'
                : `Matriz Gerencial de Resultados (${meses.length} meses)`}
            </CardTitle>
            <CardDescription className="text-xs">
              {modoVisualizacao === 'comparativo'
                ? `Análise lado a lado de ${p1Descricao} (Atual) vs ${p2Descricao} (Comparado) com variação absoluta (R$) e percentual (%).`
                : 'Estrutura: Receitas (1) – Despesas Variáveis (2) – Despesas Fixas (3) – Despesas Financeiras (4) + Receitas Financeiras (5) = Lucro/Prejuízo (6).'}
            </CardDescription>
          </div>
          <div className="text-xs text-slate-500 font-medium">
            {modoVisualizacao === 'comparativo' ? (
              <span>
                Comparando: <strong className="text-blue-700">{p1Descricao}</strong> vs{' '}
                <strong className="text-purple-700">{p2Descricao}</strong>
              </span>
            ) : (
              <span>
                Período: <strong className="text-slate-800">{meses[0]?.rotuloCurto}</strong> até{' '}
                <strong className="text-slate-800">{meses[meses.length - 1]?.rotuloCurto}</strong>
              </span>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-slate-500">
                Calculando DRE a partir dos lançamentos rápidos...
              </p>
            </div>
          ) : modoVisualizacao === 'unico' ? (
            /* TABELA PERÍODO ÚNICO (Matriz mês a mês) */
            <div className="overflow-x-auto w-full max-w-full">
              <table
                className="text-xs border-collapse w-full"
                style={{ minWidth: `${Math.max(800, 260 + meses.length * 105 + 130)}px` }}
              >
                <thead>
                  <tr className="bg-slate-100/90 text-[#0B1F3A] border-b border-slate-200 font-bold text-left">
                    <th className="py-3 px-4 w-[260px] min-w-[220px] sticky left-0 bg-slate-100 z-10 border-r border-slate-200">
                      Estrutura de Contas / Grupos
                    </th>
                    {meses.map((m) => (
                      <th
                        key={m.chave}
                        className="py-3 px-2 min-w-[105px] text-right border-r border-slate-200 font-semibold whitespace-nowrap"
                      >
                        {m.rotuloCurto}
                      </th>
                    ))}
                    <th className="py-3 px-4 min-w-[130px] text-right bg-slate-200/80 font-bold text-[#0B1F3A] whitespace-nowrap">
                      Total Período
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {/* Grupos 1 a 5 da DRE */}
                  {matriz.grupos.map((grupo) => {
                    const isExpandido = !!gruposExpandidos[grupo.classificacao]
                    const corFundo =
                      grupo.classificacao === 'Receita'
                        ? 'bg-emerald-50/40 text-emerald-950 font-bold'
                        : grupo.classificacao === 'Receita Financeira'
                          ? 'bg-sky-50/40 text-sky-950 font-bold'
                          : 'bg-slate-50/80 text-slate-900 font-bold'

                    return (
                      <React.Fragment key={grupo.classificacao}>
                        {/* Linha do Grupo Master */}
                        <tr className={`${corFundo} hover:bg-slate-100/80 transition-colors`}>
                          <td className="py-2.5 px-4 sticky left-0 bg-inherit z-10 border-r border-slate-200">
                            <button
                              type="button"
                              onClick={() => toggleGrupo(grupo.classificacao)}
                              className="flex items-center gap-2 text-left w-full font-bold focus:outline-none"
                            >
                              {isExpandido ? (
                                <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                              )}
                              <span>{grupo.titulo}</span>
                              <Badge
                                variant="outline"
                                className="ml-auto text-[10px] font-normal opacity-70"
                              >
                                {grupo.contas.length} conta(s)
                              </Badge>
                            </button>
                          </td>

                          {meses.map((m) => {
                            const val = grupo.valoresPorMes[m.chave] || 0
                            return (
                              <td
                                key={m.chave}
                                className="py-2.5 px-2 text-right font-semibold border-r border-slate-200 whitespace-nowrap"
                              >
                                {val !== 0 ? (
                                  formatBrl(val)
                                ) : (
                                  <span className="text-slate-300 font-normal">—</span>
                                )}
                              </td>
                            )
                          })}

                          <td className="py-2.5 px-4 text-right font-bold bg-slate-100/70">
                            {formatBrl(grupo.totalPeriodo)}
                          </td>
                        </tr>

                        {/* Contas do Grupo (Drill-down) */}
                        {isExpandido &&
                          grupo.contas.map((conta) => (
                            <tr
                              key={conta.id}
                              className="hover:bg-blue-50/30 text-slate-700 transition-colors text-[11px]"
                            >
                              <td className="py-2 pl-9 pr-4 sticky left-0 bg-white z-10 border-r border-slate-100">
                                <div className="flex items-center gap-2 truncate">
                                  {conta.codigo && (
                                    <span className="font-mono text-[10px] text-blue-600 font-semibold shrink-0">
                                      {conta.codigo}
                                    </span>
                                  )}
                                  <span className="truncate font-medium">{conta.nome}</span>
                                </div>
                              </td>

                              {meses.map((m) => {
                                const val = conta.valoresPorMes[m.chave] || 0
                                return (
                                  <td
                                    key={m.chave}
                                    className="py-2 px-2 text-right border-r border-slate-100 text-slate-600 whitespace-nowrap"
                                  >
                                    {val !== 0 ? (
                                      formatBrl(val)
                                    ) : (
                                      <span className="text-slate-300">—</span>
                                    )}
                                  </td>
                                )
                              })}

                              <td className="py-2 px-4 text-right font-semibold bg-slate-50/50 text-slate-800">
                                {formatBrl(conta.totalPeriodo)}
                              </td>
                            </tr>
                          ))}

                        {/* Se o grupo não tiver contas vinculadas no período */}
                        {isExpandido && grupo.contas.length === 0 && (
                          <tr className="bg-white text-[11px] text-slate-400 italic">
                            <td
                              colSpan={meses.length + 2}
                              className="py-2 pl-9 pr-4 sticky left-0 bg-white"
                            >
                              Nenhum lançamento no período para este grupo.
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    )
                  })}

                  {/* ================= LINHA 6: LUCRO OU PREJUÍZO (RESULTADO) ================= */}
                  <tr
                    className={`border-t-2 font-extrabold text-xs ${
                      isLucro
                        ? 'bg-emerald-100/70 text-emerald-950 border-emerald-400'
                        : 'bg-rose-100/70 text-rose-950 border-rose-400'
                    }`}
                  >
                    <td className="py-3.5 px-4 sticky left-0 bg-inherit z-10 border-r border-slate-300">
                      <div className="flex items-center justify-between">
                        <span className="text-xs uppercase tracking-wider font-extrabold flex items-center gap-2">
                          {isLucro ? (
                            <TrendingUp className="w-4 h-4 text-emerald-700" />
                          ) : (
                            <TrendingDown className="w-4 h-4 text-rose-700" />
                          )}
                          {matriz.lucroPrejuizo.titulo}
                        </span>
                        <Badge
                          className={`text-[10px] font-bold ${
                            isLucro
                              ? 'bg-emerald-200 text-emerald-900 border-emerald-400'
                              : 'bg-rose-200 text-rose-900 border-rose-400'
                          }`}
                        >
                          {isLucro ? 'LUCRO LÍQUIDO' : 'PREJUÍZO'}
                        </Badge>
                      </div>
                    </td>

                    {meses.map((m) => {
                      const resMes = matriz.lucroPrejuizo.valoresPorMes[m.chave] || 0
                      const isMesPositivo = resMes >= 0
                      return (
                        <td
                          key={m.chave}
                          className={`py-3.5 px-2 text-right font-extrabold border-r border-slate-300 whitespace-nowrap ${
                            isMesPositivo ? 'text-emerald-800' : 'text-rose-800'
                          }`}
                        >
                          {formatBrl(resMes)}
                        </td>
                      )
                    })}

                    <td
                      className={`py-3.5 px-4 text-right font-black text-sm bg-black/5 ${
                        isLucro ? 'text-emerald-900' : 'text-rose-900'
                      }`}
                    >
                      {formatBrl(matriz.lucroPrejuizo.totalPeriodo)}
                    </td>
                  </tr>

                  {/* ================= MARGEM LÍQUIDA (%) ================= */}
                  <tr className="bg-slate-50/90 text-slate-700 font-semibold text-[11px] border-b border-slate-200">
                    <td className="py-2.5 px-4 sticky left-0 bg-slate-50 z-10 border-r border-slate-200">
                      <span className="font-semibold text-slate-800">
                        Margem Líquida (% s/ Receitas)
                      </span>
                    </td>

                    {meses.map((m) => {
                      const mg = matriz.margemLiquidaPorMes[m.chave]
                      return (
                        <td
                          key={m.chave}
                          className="py-2.5 px-2 text-right border-r border-slate-200 font-semibold whitespace-nowrap"
                        >
                          {mg !== null && mg !== undefined ? (
                            <span
                              className={
                                mg >= 0 ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'
                              }
                            >
                              {mg.toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                      )
                    })}

                    <td className="py-2.5 px-4 text-right font-bold text-slate-900 bg-slate-200/50">
                      {matriz.margemLiquidaTotal !== null &&
                      matriz.margemLiquidaTotal !== undefined ? (
                        <span
                          className={
                            matriz.margemLiquidaTotal >= 0
                              ? 'text-emerald-800 font-extrabold'
                              : 'text-rose-800 font-extrabold'
                          }
                        >
                          {matriz.margemLiquidaTotal.toFixed(1)}%
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>

                  {/* ================= NÃO CLASSIFICADOS (SE HOUVER) ================= */}
                  {matriz.naoClassificados.contas.length > 0 && (
                    <React.Fragment>
                      <tr className="bg-amber-50/70 text-amber-950 font-bold border-t-2 border-amber-300">
                        <td className="py-3 px-4 sticky left-0 bg-inherit z-10 border-r border-slate-200">
                          <button
                            type="button"
                            onClick={() => toggleGrupo('naoClassificados')}
                            className="flex items-center gap-2 text-left w-full font-bold focus:outline-none"
                          >
                            {gruposExpandidos.naoClassificados ? (
                              <ChevronDown className="w-4 h-4 text-amber-600 shrink-0" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-amber-600 shrink-0" />
                            )}
                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                            <span>{matriz.naoClassificados.titulo}</span>
                            <Badge className="ml-auto text-[10px] bg-amber-200 text-amber-900 border-amber-400">
                              {matriz.naoClassificados.contas.length} conta(s) pendente(s)
                            </Badge>
                          </button>
                        </td>

                        {meses.map((m) => {
                          const val = matriz.naoClassificados.valoresPorMes[m.chave] || 0
                          return (
                            <td
                              key={m.chave}
                              className="py-3 px-2 text-right font-semibold border-r border-slate-200 text-amber-900 whitespace-nowrap"
                            >
                              {val !== 0 ? (
                                formatBrl(val)
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>
                          )
                        })}

                        <td className="py-3 px-4 text-right font-bold bg-amber-100 text-amber-950">
                          {formatBrl(matriz.naoClassificados.totalPeriodo)}
                        </td>
                      </tr>

                      {gruposExpandidos.naoClassificados &&
                        matriz.naoClassificados.contas.map((conta) => (
                          <tr
                            key={conta.id}
                            className="hover:bg-amber-50/30 text-slate-700 transition-colors text-[11px]"
                          >
                            <td className="py-2 pl-9 pr-4 sticky left-0 bg-white z-10 border-r border-slate-100">
                              <div className="flex items-center justify-between gap-2">
                                <span className="truncate font-medium">{conta.nome}</span>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setModalClassificacaoOpen(true)}
                                  className="h-6 text-[10px] text-blue-600 hover:text-blue-800 p-1"
                                >
                                  Classificar
                                </Button>
                              </div>
                            </td>

                            {meses.map((m) => {
                              const val = conta.valoresPorMes[m.chave] || 0
                              return (
                                <td
                                  key={m.chave}
                                  className="py-2 px-2 text-right border-r border-slate-100 text-slate-600 whitespace-nowrap"
                                >
                                  {val !== 0 ? (
                                    formatBrl(val)
                                  ) : (
                                    <span className="text-slate-300">—</span>
                                  )}
                                </td>
                              )
                            })}

                            <td className="py-2 px-4 text-right font-semibold bg-slate-50/50 text-slate-800">
                              {formatBrl(conta.totalPeriodo)}
                            </td>
                          </tr>
                        ))}
                    </React.Fragment>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            /* TABELA COMPARATIVA LADO A LADO */
            <div className="overflow-x-auto w-full max-w-full">
              <table className="text-xs border-collapse w-full min-w-[760px]">
                <thead>
                  <tr className="bg-slate-100 text-[#0B1F3A] border-b border-slate-200 font-bold text-left">
                    <th className="py-3 px-4 w-[280px] sticky left-0 bg-slate-100 z-10 border-r border-slate-200">
                      Estrutura de Contas / Grupos
                    </th>
                    <th className="py-3 px-3 text-right border-r border-slate-200 whitespace-nowrap min-w-[125px] bg-purple-50/60 text-purple-950 font-bold">
                      Período Comparado ({p2Descricao})
                    </th>
                    <th className="py-3 px-3 text-right border-r border-slate-200 whitespace-nowrap min-w-[125px] bg-blue-50/60 text-blue-950 font-bold">
                      Período Atual ({p1Descricao})
                    </th>
                    <th className="py-3 px-3 text-right border-r border-slate-200 whitespace-nowrap min-w-[110px] font-bold">
                      Variação (R$)
                    </th>
                    <th className="py-3 px-3 text-right border-r border-slate-200 whitespace-nowrap min-w-[95px] font-bold">
                      Variação (%)
                    </th>
                    <th className="py-3 px-3 text-center whitespace-nowrap min-w-[95px] font-bold">
                      Impacto
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {comparativo.grupos.map((grupo) => {
                    const isExpandido = !!gruposExpandidos[grupo.classificacao]
                    const corFundo =
                      grupo.classificacao === 'Receita'
                        ? 'bg-emerald-50/40 text-emerald-950 font-bold'
                        : grupo.classificacao === 'Receita Financeira'
                          ? 'bg-sky-50/40 text-sky-950 font-bold'
                          : 'bg-slate-50/80 text-slate-900 font-bold'

                    return (
                      <React.Fragment key={grupo.classificacao}>
                        {/* Linha Grupo Master */}
                        <tr className={`${corFundo} hover:bg-slate-100/80 transition-colors`}>
                          <td className="py-2.5 px-4 sticky left-0 bg-inherit z-10 border-r border-slate-200">
                            <button
                              type="button"
                              onClick={() => toggleGrupo(grupo.classificacao)}
                              className="flex items-center gap-2 text-left w-full font-bold focus:outline-none"
                            >
                              {isExpandido ? (
                                <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                              )}
                              <span>{grupo.titulo}</span>
                              <Badge
                                variant="outline"
                                className="ml-auto text-[10px] font-normal opacity-70"
                              >
                                {grupo.contas.length} conta(s)
                              </Badge>
                            </button>
                          </td>

                          {/* Período 1 (Comparado / Ref) */}
                          <td className="py-2.5 px-3 text-right font-semibold border-r border-slate-200 whitespace-nowrap bg-purple-50/30 text-purple-950">
                            {formatBrl(grupo.valorPeriodo1)}
                          </td>

                          {/* Período 2 (Atual) */}
                          <td className="py-2.5 px-3 text-right font-semibold border-r border-slate-200 whitespace-nowrap bg-blue-50/30 text-blue-950">
                            {formatBrl(grupo.valorPeriodo2)}
                          </td>

                          {/* Variação R$ */}
                          <td
                            className={`py-2.5 px-3 text-right font-bold border-r border-slate-200 whitespace-nowrap ${
                              grupo.favoravel ? 'text-emerald-700' : 'text-rose-700'
                            }`}
                          >
                            {grupo.diferenca >= 0 ? '+' : ''}
                            {formatBrl(grupo.diferenca)}
                          </td>

                          {/* Variação % */}
                          <td
                            className={`py-2.5 px-3 text-right font-bold border-r border-slate-200 whitespace-nowrap ${
                              grupo.favoravel ? 'text-emerald-700' : 'text-rose-700'
                            }`}
                          >
                            {grupo.percentual !== null ? (
                              <span>
                                {grupo.percentual >= 0 ? '+' : ''}
                                {grupo.percentual.toFixed(1)}%
                              </span>
                            ) : (
                              <span className="text-slate-400 font-normal">—</span>
                            )}
                          </td>

                          {/* Tag de Impacto */}
                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                            <Badge
                              className={`text-[10px] font-bold ${
                                grupo.favoravel
                                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                  : 'bg-rose-100 text-rose-800 border-rose-300'
                              }`}
                            >
                              {grupo.favoravel ? 'Favorável' : 'Desfavorável'}
                            </Badge>
                          </td>
                        </tr>

                        {/* Contas do Grupo no comparativo */}
                        {isExpandido &&
                          grupo.contas.map((conta) => (
                            <tr
                              key={conta.id}
                              className="hover:bg-blue-50/30 text-slate-700 transition-colors text-[11px]"
                            >
                              <td className="py-2 pl-9 pr-4 sticky left-0 bg-white z-10 border-r border-slate-100">
                                <div className="flex items-center gap-2 truncate">
                                  {conta.codigo && (
                                    <span className="font-mono text-[10px] text-blue-600 font-semibold shrink-0">
                                      {conta.codigo}
                                    </span>
                                  )}
                                  <span className="truncate font-medium">{conta.nome}</span>
                                </div>
                              </td>

                              <td className="py-2 px-3 text-right border-r border-slate-100 text-slate-600 whitespace-nowrap">
                                {formatBrl(conta.valorPeriodo1)}
                              </td>

                              <td className="py-2 px-3 text-right border-r border-slate-100 text-slate-600 whitespace-nowrap">
                                {formatBrl(conta.valorPeriodo2)}
                              </td>

                              <td
                                className={`py-2 px-3 text-right border-r border-slate-100 font-medium whitespace-nowrap ${
                                  conta.favoravel ? 'text-emerald-700' : 'text-rose-700'
                                }`}
                              >
                                {conta.diferenca >= 0 ? '+' : ''}
                                {formatBrl(conta.diferenca)}
                              </td>

                              <td
                                className={`py-2 px-3 text-right border-r border-slate-100 font-medium whitespace-nowrap ${
                                  conta.favoravel ? 'text-emerald-700' : 'text-rose-700'
                                }`}
                              >
                                {conta.percentual !== null ? (
                                  <span>
                                    {conta.percentual >= 0 ? '+' : ''}
                                    {conta.percentual.toFixed(1)}%
                                  </span>
                                ) : (
                                  <span className="text-slate-400 font-normal">—</span>
                                )}
                              </td>

                              <td className="py-2 px-3 text-center whitespace-nowrap text-[10px]">
                                <span
                                  className={`inline-block px-1.5 py-0.5 rounded ${
                                    conta.favoravel
                                      ? 'text-emerald-700 bg-emerald-50'
                                      : 'text-rose-700 bg-rose-50'
                                  }`}
                                >
                                  {conta.favoravel ? '✓ Fav' : '✗ Desfav'}
                                </span>
                              </td>
                            </tr>
                          ))}

                        {isExpandido && grupo.contas.length === 0 && (
                          <tr className="bg-white text-[11px] text-slate-400 italic">
                            <td colSpan={6} className="py-2 pl-9 pr-4 sticky left-0 bg-white">
                              Nenhuma conta vinculada com movimentação nos períodos selecionados.
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    )
                  })}

                  {/* ================= LINHA COMPARATIVA: LUCRO OU PREJUÍZO ================= */}
                  <tr
                    className={`border-t-2 font-extrabold text-xs ${
                      comparativo.lucroPrejuizo.favoravel
                        ? 'bg-emerald-100/70 text-emerald-950 border-emerald-400'
                        : 'bg-rose-100/70 text-rose-950 border-rose-400'
                    }`}
                  >
                    <td className="py-3.5 px-4 sticky left-0 bg-inherit z-10 border-r border-slate-300">
                      <div className="flex items-center justify-between">
                        <span className="text-xs uppercase tracking-wider font-extrabold flex items-center gap-2">
                          {comparativo.lucroPrejuizo.valorPeriodo2 >= 0 ? (
                            <TrendingUp className="w-4 h-4 text-emerald-700" />
                          ) : (
                            <TrendingDown className="w-4 h-4 text-rose-700" />
                          )}
                          {comparativo.lucroPrejuizo.titulo}
                        </span>
                        <Badge
                          className={`text-[10px] font-bold ${
                            comparativo.lucroPrejuizo.valorPeriodo2 >= 0
                              ? 'bg-emerald-200 text-emerald-900 border-emerald-400'
                              : 'bg-rose-200 text-rose-900 border-rose-400'
                          }`}
                        >
                          {comparativo.lucroPrejuizo.valorPeriodo2 >= 0
                            ? 'LUCRO LÍQUIDO'
                            : 'PREJUÍZO'}
                        </Badge>
                      </div>
                    </td>

                    <td className="py-3.5 px-3 text-right font-extrabold border-r border-slate-300 whitespace-nowrap bg-purple-100/50">
                      {formatBrl(comparativo.lucroPrejuizo.valorPeriodo1)}
                    </td>

                    <td className="py-3.5 px-3 text-right font-extrabold border-r border-slate-300 whitespace-nowrap bg-blue-100/50">
                      {formatBrl(comparativo.lucroPrejuizo.valorPeriodo2)}
                    </td>

                    <td
                      className={`py-3.5 px-3 text-right font-black border-r border-slate-300 whitespace-nowrap ${
                        comparativo.lucroPrejuizo.favoravel ? 'text-emerald-900' : 'text-rose-900'
                      }`}
                    >
                      {comparativo.lucroPrejuizo.diferenca >= 0 ? '+' : ''}
                      {formatBrl(comparativo.lucroPrejuizo.diferenca)}
                    </td>

                    <td
                      className={`py-3.5 px-3 text-right font-black border-r border-slate-300 whitespace-nowrap ${
                        comparativo.lucroPrejuizo.favoravel ? 'text-emerald-900' : 'text-rose-900'
                      }`}
                    >
                      {comparativo.lucroPrejuizo.percentual !== null ? (
                        <span>
                          {comparativo.lucroPrejuizo.percentual >= 0 ? '+' : ''}
                          {comparativo.lucroPrejuizo.percentual.toFixed(1)}%
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>

                    <td className="py-3.5 px-3 text-center whitespace-nowrap">
                      <Badge
                        className={`text-[10px] font-bold ${
                          comparativo.lucroPrejuizo.favoravel
                            ? 'bg-emerald-600 text-white'
                            : 'bg-rose-600 text-white'
                        }`}
                      >
                        {comparativo.lucroPrejuizo.favoravel ? 'Favorável' : 'Desfavorável'}
                      </Badge>
                    </td>
                  </tr>

                  {/* ================= MARGEM LÍQUIDA (%) COMPARATIVA ================= */}
                  <tr className="bg-slate-50/90 text-slate-700 font-semibold text-[11px] border-b border-slate-200">
                    <td className="py-2.5 px-4 sticky left-0 bg-slate-50 z-10 border-r border-slate-200">
                      <span className="font-semibold text-slate-800">
                        Margem Líquida (% s/ Receitas)
                      </span>
                    </td>

                    <td className="py-2.5 px-3 text-right border-r border-slate-200 font-semibold whitespace-nowrap">
                      {comparativo.margemLiquida.margemPeriodo1 !== null
                        ? `${comparativo.margemLiquida.margemPeriodo1.toFixed(1)}%`
                        : '—'}
                    </td>

                    <td className="py-2.5 px-3 text-right border-r border-slate-200 font-semibold whitespace-nowrap">
                      {comparativo.margemLiquida.margemPeriodo2 !== null
                        ? `${comparativo.margemLiquida.margemPeriodo2.toFixed(1)}%`
                        : '—'}
                    </td>

                    <td
                      className={`py-2.5 px-3 text-right border-r border-slate-200 font-bold whitespace-nowrap ${
                        comparativo.margemLiquida.favoravel ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {comparativo.margemLiquida.diferencaPontos !== null
                        ? `${comparativo.margemLiquida.diferencaPontos >= 0 ? '+' : ''}${comparativo.margemLiquida.diferencaPontos.toFixed(1)} p.p.`
                        : '—'}
                    </td>

                    <td className="py-2.5 px-3 text-right border-r border-slate-200 text-slate-400">
                      —
                    </td>

                    <td className="py-2.5 px-3 text-center whitespace-nowrap text-[10px]">
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded font-semibold ${
                          comparativo.margemLiquida.favoravel
                            ? 'text-emerald-700 bg-emerald-50'
                            : 'text-rose-700 bg-rose-50'
                        }`}
                      >
                        {comparativo.margemLiquida.favoravel ? '✓ Melhora' : '✗ Queda'}
                      </span>
                    </td>
                  </tr>

                  {/* Não Classificados se houver */}
                  {comparativo.naoClassificados.contas.length > 0 && (
                    <React.Fragment>
                      <tr className="bg-amber-50/70 text-amber-950 font-bold border-t-2 border-amber-300">
                        <td className="py-3 px-4 sticky left-0 bg-inherit z-10 border-r border-slate-200">
                          <button
                            type="button"
                            onClick={() => toggleGrupo('naoClassificados')}
                            className="flex items-center gap-2 text-left w-full font-bold focus:outline-none"
                          >
                            {gruposExpandidos.naoClassificados ? (
                              <ChevronDown className="w-4 h-4 text-amber-600 shrink-0" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-amber-600 shrink-0" />
                            )}
                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                            <span>{comparativo.naoClassificados.titulo}</span>
                          </button>
                        </td>

                        <td className="py-3 px-3 text-right border-r border-slate-200 font-semibold text-amber-900">
                          {formatBrl(comparativo.naoClassificados.valorPeriodo1)}
                        </td>

                        <td className="py-3 px-3 text-right border-r border-slate-200 font-semibold text-amber-900">
                          {formatBrl(comparativo.naoClassificados.valorPeriodo2)}
                        </td>

                        <td className="py-3 px-3 text-right border-r border-slate-200 font-bold text-amber-900">
                          {formatBrl(comparativo.naoClassificados.diferenca)}
                        </td>

                        <td className="py-3 px-3 text-right border-r border-slate-200 font-bold text-amber-900">
                          {comparativo.naoClassificados.percentual !== null
                            ? `${comparativo.naoClassificados.percentual.toFixed(1)}%`
                            : '—'}
                        </td>

                        <td className="py-3 px-3 text-center">
                          <Badge className="bg-amber-200 text-amber-900 border-amber-400 text-[10px]">
                            Pendente
                          </Badge>
                        </td>
                      </tr>

                      {gruposExpandidos.naoClassificados &&
                        comparativo.naoClassificados.contas.map((conta) => (
                          <tr
                            key={conta.id}
                            className="hover:bg-amber-50/30 text-slate-700 transition-colors text-[11px]"
                          >
                            <td className="py-2 pl-9 pr-4 sticky left-0 bg-white z-10 border-r border-slate-100">
                              <span className="truncate font-medium">{conta.nome}</span>
                            </td>
                            <td className="py-2 px-3 text-right border-r border-slate-100 text-slate-600">
                              {formatBrl(conta.valorPeriodo1)}
                            </td>
                            <td className="py-2 px-3 text-right border-r border-slate-100 text-slate-600">
                              {formatBrl(conta.valorPeriodo2)}
                            </td>
                            <td className="py-2 px-3 text-right border-r border-slate-100 text-slate-600">
                              {formatBrl(conta.diferenca)}
                            </td>
                            <td className="py-2 px-3 text-right border-r border-slate-100 text-slate-600">
                              {conta.percentual !== null ? `${conta.percentual.toFixed(1)}%` : '—'}
                            </td>
                            <td className="py-2 px-3 text-center text-[10px] text-amber-700">
                              Requer ajuste
                            </td>
                          </tr>
                        ))}
                    </React.Fragment>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Nota de rodapé explicativa */}
      <div className="text-xs text-slate-500 bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1 print:border-none print:bg-white print:p-0">
        <p className="font-semibold text-slate-700">Sobre o cálculo da DRE Gerencial:</p>
        <p>
          • <strong>Fórmula:</strong> Lucro/Prejuízo = Receitas (+) – Despesas Variáveis (–) –
          Despesas Fixas (–) – Despesas Financeiras (–) + Receitas Financeiras (+).
        </p>
        <p>
          • <strong>Fonte de Dados:</strong> Agregação mensal dos lançamentos rápidos cadastrados
          para a empresa selecionada.
        </p>
        <p>
          • <strong>Classificação:</strong> As contas são classificadas no Plano de Contas. Contas
          não classificadas manualmente usam heurística de palavras-chave ou são agrupadas em
          &quot;Não classificados&quot; para evitar perda de dados.
        </p>
      </div>

      {/* Modal de Classificação de Contas */}
      <ModalClassificacaoDreLote
        open={modalClassificacaoOpen}
        onOpenChange={setModalClassificacaoOpen}
        contas={contas}
        onSuccess={() => {
          carregarDados()
          window.dispatchEvent(new CustomEvent('dre-contas-atualizadas'))
        }}
      />
    </div>
  )
}
