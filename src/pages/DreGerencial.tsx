import React, { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useFilter } from '@/contexts/FilterContext'
import { useToast } from '@/hooks/use-toast'
import { contasService, lancamentosService } from '@/services/financeService'
import type { ContaRecord, LancamentoRecord } from '@/types/finance'
import { gerarListaMeses, type ClassificacaoDre } from '@/lib/dreGerencialTypes'
import { calcularDreGerencialMatriz } from '@/lib/dreGerencialCalculo'
import { exportarDreGerencialExcel, exportarDreGerencialCsv } from '@/lib/dreGerencialExport'
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
  const { selectedEmpresaId, selectedEmpresa, empresas, selectedAno } = useFilter()

  // Estados de dados
  const [loading, setLoading] = useState(true)
  const [lancamentos, setLancamentos] = useState<LancamentoRecord[]>([])
  const [contas, setContas] = useState<ContaRecord[]>([])

  // Filtros de período (máximo 12 meses)
  const currentYear = selectedAno || new Date().getFullYear()
  const [anoInicial, setAnoInicial] = useState<number>(currentYear)
  const [mesInicial, setMesInicial] = useState<number>(1)
  const [qtdMeses, setQtdMeses] = useState<number>(12)
  const [avisoLimiteMeses, setAvisoLimiteMeses] = useState(false)

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
      const [contasList, lancamentosList] = await Promise.all([
        contasService.getAll(selectedEmpresaId ? { empresaId: selectedEmpresaId } : undefined),
        lancamentosService.getAll(selectedEmpresaId ? { empresaId: selectedEmpresaId } : undefined),
      ])
      setContas(contasList)
      setLancamentos(lancamentosList)
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
  }, [selectedEmpresaId])

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

  // Lista de colunas de meses geradas
  const meses = useMemo(() => {
    return gerarListaMeses(anoInicial, mesInicial, qtdMeses)
  }, [anoInicial, mesInicial, qtdMeses])

  // Cálculo da matriz da DRE
  const matriz = useMemo(() => {
    return calcularDreGerencialMatriz(lancamentos, contas, meses)
  }, [lancamentos, contas, meses])

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
      exportarDreGerencialExcel(matriz, selectedEmpresa)
      toast({
        title: 'DRE Exportada com sucesso',
        description: 'Planilha Excel gerada com a matriz da DRE Gerencial.',
      })
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
      exportarDreGerencialCsv(matriz, selectedEmpresa)
      toast({
        title: 'DRE Exportada com sucesso',
        description: 'Arquivo CSV gerado com separador padrão brasileiro (;).',
      })
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

        {/* Botões de Ações e Exportação */}
        <div className="flex items-center gap-2 flex-wrap print:hidden">
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
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-slate-400" />
                <span className="text-xs text-slate-600 font-medium">Início:</span>
                <Select
                  value={String(mesInicial)}
                  onValueChange={(val) => setMesInicial(Number(val))}
                >
                  <SelectTrigger className="h-8 text-xs bg-white w-28">
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
                  className="h-8 w-20 text-xs font-semibold"
                  min={2000}
                  max={2100}
                />
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-600 font-medium">Qtd Meses:</span>
                <Input
                  type="number"
                  min={1}
                  max={12}
                  value={qtdMeses}
                  onChange={(e) => handleQtdMesesChange(Number(e.target.value))}
                  className="h-8 w-16 text-xs text-center font-bold"
                />
                <span className="text-[11px] text-slate-400">(máx 12)</span>
              </div>

              <div className="flex items-center gap-1.5 ml-auto lg:ml-2">
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

          {avisoLimiteMeses && (
            <div className="mt-3 flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 p-2 rounded-lg">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
              <span>O período foi ajustado automaticamente para o limite máximo de 12 meses.</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cards de Resumo Gerencial */}
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

      {/* Cabeçalho para impressão */}
      <div className="hidden print:block mb-4 border-b border-slate-300 pb-2">
        <h2 className="text-lg font-bold text-slate-900">
          DEMONSTRAÇÃO DO RESULTADO DO EXERCÍCIO (DRE GERENCIAL)
        </h2>
        <p className="text-xs text-slate-600">
          Empresa: {selectedEmpresa ? selectedEmpresa.nome : 'Consolidado'} · Período:{' '}
          {meses[0]?.rotuloCurto} a {meses[meses.length - 1]?.rotuloCurto} ({meses.length} meses)
        </p>
      </div>

      {/* ================= TABELA MATRICIAL DA DRE ================= */}
      <Card className="bg-white border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="py-3 px-5 border-b border-slate-100 bg-slate-50/50 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-600" />
              Matriz Gerencial de Resultados ({meses.length} meses)
            </CardTitle>
            <CardDescription className="text-xs">
              Estrutura: Receitas (1) – Despesas Variáveis (2) – Despesas Fixas (3) – Despesas
              Financeiras (4) + Receitas Financeiras (5) = Lucro/Prejuízo (6).
            </CardDescription>
          </div>
          <div className="text-xs text-slate-500 font-medium">
            Período: <strong className="text-slate-800">{meses[0]?.rotuloCurto}</strong> até{' '}
            <strong className="text-slate-800">{meses[meses.length - 1]?.rotuloCurto}</strong>
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
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/90 text-[#0B1F3A] border-b border-slate-200 font-bold text-left">
                    <th className="py-3 px-4 min-w-[280px] sticky left-0 bg-slate-100 z-10 border-r border-slate-200">
                      Estrutura de Contas / Grupos
                    </th>
                    {meses.map((m) => (
                      <th
                        key={m.chave}
                        className="py-3 px-3 min-w-[110px] text-right border-r border-slate-200 font-semibold"
                      >
                        {m.rotuloCurto}
                      </th>
                    ))}
                    <th className="py-3 px-4 min-w-[130px] text-right bg-slate-200/80 font-bold text-[#0B1F3A]">
                      Total Período
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {/* Grupos 1 a 5 da DRE */}
                  {matriz.grupos.map((grupo, idx) => {
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
                                className="py-2.5 px-3 text-right font-semibold border-r border-slate-200"
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
                                    className="py-2 px-3 text-right border-r border-slate-100 text-slate-600"
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
                          className={`py-3.5 px-3 text-right font-extrabold border-r border-slate-300 ${
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
                          className="py-2.5 px-3 text-right border-r border-slate-200 font-semibold"
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
                              className="py-3 px-3 text-right font-semibold border-r border-slate-200 text-amber-900"
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
                                  className="py-2 px-3 text-right border-r border-slate-100 text-slate-600"
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
        onSuccess={carregarDados}
      />
    </div>
  )
}
