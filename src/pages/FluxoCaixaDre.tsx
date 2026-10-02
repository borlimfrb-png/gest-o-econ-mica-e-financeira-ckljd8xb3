import React, { useState, useEffect, useMemo } from 'react'
import { useFilter } from '@/contexts/FilterContext'
import { useToast } from '@/hooks/use-toast'
import { useRealtime } from '@/hooks/use-realtime'
import { contasService, lancamentosService, planoContasService } from '@/services/financeService'
import type { ContaRecord, LancamentoRecord, PlanoContaRecord } from '@/types/finance'
import { gerarListaMeses } from '@/lib/dreGerencialTypes'
import { calcularFluxoCaixaDre, type FluxoCaixaDreResultado } from '@/lib/fluxoCaixaDreCalculo'
import { exportarFluxoCaixaDreExcel, exportarFluxoCaixaDreCsv } from '@/lib/fluxoCaixaDreExport'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
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
  Coins,
  Calendar,
  ChevronDown,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Printer,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  Building,
  RefreshCw,
  Wallet,
  ArrowDownRight,
  ArrowUpRight,
  Layers,
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

export default function FluxoCaixaDre() {
  const { toast } = useToast()
  const { selectedEmpresaId, selectedEmpresa, selectedAno, isGrupoAtivo, grupoAtivo } = useFilter()

  // Estados de dados
  const [loading, setLoading] = useState(true)
  const [lancamentos, setLancamentos] = useState<LancamentoRecord[]>([])
  const [contas, setContas] = useState<ContaRecord[]>([])
  const [planoContas, setPlanoContas] = useState<PlanoContaRecord[]>([])

  // Filtros de período (máximo 12 meses)
  const currentYear = selectedAno || new Date().getFullYear()
  const [anoInicial, setAnoInicial] = useState<number>(currentYear)

  useEffect(() => {
    if (selectedAno) {
      setAnoInicial(selectedAno)
    }
  }, [selectedAno])

  const [mesInicial, setMesInicial] = useState<number>(1)
  const [qtdMeses, setQtdMeses] = useState<number>(12)
  const [avisoLimiteMeses, setAvisoLimiteMeses] = useState(false)

  // Controle de grupos expansíveis
  const [gruposExpandidos, setGruposExpandidos] = useState<Record<string, boolean>>({
    entradasOperacionais: true,
    saidasOperacionais: true,
    entradasFinanceiras: true,
    saidasFinanceiras: true,
  })

  // Carregar dados respeitando filtro de empresa / grupo
  const carregarDados = async () => {
    try {
      setLoading(true)

      let lancsPromise: Promise<LancamentoRecord[]>
      let contasPromise: Promise<ContaRecord[]>
      let planosPromise: Promise<PlanoContaRecord[]>

      if (isGrupoAtivo && grupoAtivo && grupoAtivo.empresas && grupoAtivo.empresas.length > 0) {
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
      console.error('Erro ao carregar dados do Fluxo de Caixa DRE:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar dados',
        description: 'Não foi possível carregar os lançamentos do fluxo de caixa.',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarDados()
  }, [selectedEmpresaId, isGrupoAtivo, grupoAtivo])

  // Realtime
  useRealtime<LancamentoRecord>('lancamentos', () => {
    carregarDados()
  })
  useRealtime<ContaRecord>('contas', () => {
    carregarDados()
  })
  useRealtime<PlanoContaRecord>('plano_contas', () => {
    carregarDados()
  })

  // Controle de limite de 12 meses
  const handleQtdMesesChange = (novaQtd: number) => {
    if (novaQtd > 12) {
      setQtdMeses(12)
      setAvisoLimiteMeses(true)
      toast({
        variant: 'destructive',
        title: 'Limite de 12 meses',
        description: 'O período do fluxo de caixa é limitado a no máximo 12 meses.',
      })
    } else if (novaQtd < 1) {
      setQtdMeses(1)
      setAvisoLimiteMeses(false)
    } else {
      setQtdMeses(novaQtd)
      setAvisoLimiteMeses(false)
    }
  }

  // Lista de meses
  const meses = useMemo(() => {
    return gerarListaMeses(anoInicial, mesInicial, qtdMeses)
  }, [anoInicial, mesInicial, qtdMeses])

  // Cálculo do Fluxo de Caixa DRE
  const fluxo = useMemo<FluxoCaixaDreResultado>(() => {
    return calcularFluxoCaixaDre(lancamentos, contas, meses, planoContas)
  }, [lancamentos, contas, meses, planoContas])

  const toggleGrupo = (chave: string) => {
    setGruposExpandidos((prev) => ({
      ...prev,
      [chave]: !prev[chave],
    }))
  }

  const expandirTodos = () => {
    setGruposExpandidos({
      entradasOperacionais: true,
      saidasOperacionais: true,
      entradasFinanceiras: true,
      saidasFinanceiras: true,
    })
  }

  const recolherTodos = () => {
    setGruposExpandidos({
      entradasOperacionais: false,
      saidasOperacionais: false,
      entradasFinanceiras: false,
      saidasFinanceiras: false,
    })
  }

  const handleImprimir = () => {
    window.print()
  }

  const handleExportarExcel = () => {
    try {
      exportarFluxoCaixaDreExcel(fluxo, selectedEmpresa)
      toast({
        title: 'Fluxo de Caixa Exportado',
        description: 'Planilha Excel gerada com a matriz e detalhamento das contas.',
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
      exportarFluxoCaixaDreCsv(fluxo, selectedEmpresa)
      toast({
        title: 'Fluxo de Caixa Exportado',
        description: 'Arquivo CSV com padrão brasileiro gerado.',
      })
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: 'Erro na exportação',
        description: e?.message || 'Falha ao gerar arquivo CSV.',
      })
    }
  }

  // Totais do período
  const totalEntradasOp = fluxo.entradasOperacionais.totalPeriodo
  const totalSaidasOp = fluxo.saidasOperacionais.totalPeriodo
  const totalGeracaoOp = fluxo.geracaoOperacional.totalPeriodo
  const totalGeracaoFin = fluxo.geracaoFinanceira.totalPeriodo
  const totalFluxoCaixa = fluxo.fluxoCaixaTotal.totalPeriodo
  const saldoFinal = fluxo.saldoAcumulado.saldoFinal

  return (
    <div className="space-y-4 animate-fadeIn pb-6 print:p-0 print:m-0">
      {/* Cabeçalho da tela */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-blue-100/80 text-blue-700 shadow-xs">
              <Layers className="w-4.5 h-4.5" />
            </span>
            <div>
              <h1 className="text-lg font-bold text-[#0B1F3A] tracking-tight">
                Fluxo de Caixa (DRE Gerencial)
              </h1>
              <p className="text-[11px] text-[#5B6B7F]">
                Demonstração mensal da movimentação de caixa baseada nos lançamentos com regime de
                caixa apurado mês a mês e saldo acumulado.
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
            title="Imprimir relatório em folha A4 / Salvar PDF"
          >
            <Printer className="w-3.5 h-3.5 text-slate-600" />
            Imprimir / PDF
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                size="sm"
                className="h-8 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-xs"
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
                  <span className="text-[10px] text-slate-500">
                    Estrutura com contas e acumulado
                  </span>
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
      <Card className="bg-white border-slate-200/90 shadow-xs print:hidden">
        <CardContent className="py-3 px-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            {/* Empresa Ativa */}
            <div className="flex items-center gap-2">
              <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <div className="text-xs">
                <span className="text-slate-500">Empresa / Grupo: </span>
                <span className="font-bold text-[#0B1F3A]">
                  {selectedEmpresa ? selectedEmpresa.nome : 'Todas as empresas (Consolidado)'}
                </span>
                {selectedEmpresa?.segmento && (
                  <Badge variant="outline" className="ml-2 text-[10px] py-0">
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

      {/* Cards de Resumo Executivo */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 print:grid-cols-3">
        {/* Entradas Operacionais */}
        <Card className="bg-white border-slate-200/90 shadow-xs hover:border-slate-300 transition-colors">
          <CardContent className="py-2.5 px-3.5">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                1. Entradas Op.
              </p>
              <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <p className="text-sm font-bold text-emerald-700 mt-0.5 truncate">
              {formatBrl(totalEntradasOp)}
            </p>
          </CardContent>
        </Card>

        {/* Saídas Operacionais */}
        <Card className="bg-white border-slate-200/90 shadow-xs hover:border-slate-300 transition-colors">
          <CardContent className="py-2.5 px-3.5">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                2. Saídas Op.
              </p>
              <ArrowDownRight className="w-3.5 h-3.5 text-rose-600" />
            </div>
            <p className="text-sm font-bold text-rose-700 mt-0.5 truncate">
              {formatBrl(totalSaidasOp)}
            </p>
          </CardContent>
        </Card>

        {/* Geração Operacional */}
        <Card
          className={`border shadow-xs ${
            totalGeracaoOp >= 0
              ? 'bg-gradient-to-br from-emerald-50/90 to-emerald-100/50 border-emerald-300'
              : 'bg-gradient-to-br from-rose-50/90 to-rose-100/50 border-rose-300'
          }`}
        >
          <CardContent className="py-2.5 px-3.5">
            <p className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">
              3. Geração Op.
            </p>
            <p
              className={`text-sm font-extrabold mt-0.5 truncate ${
                totalGeracaoOp >= 0 ? 'text-emerald-800' : 'text-rose-800'
              }`}
            >
              {formatBrl(totalGeracaoOp)}
            </p>
          </CardContent>
        </Card>

        {/* Geração Financeira */}
        <Card className="bg-white border-slate-200/90 shadow-xs hover:border-slate-300 transition-colors">
          <CardContent className="py-2.5 px-3.5">
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
              4. Geração Fin.
            </p>
            <p
              className={`text-sm font-bold mt-0.5 truncate ${
                totalGeracaoFin >= 0 ? 'text-emerald-700' : 'text-purple-700'
              }`}
            >
              {formatBrl(totalGeracaoFin)}
            </p>
          </CardContent>
        </Card>

        {/* Fluxo Total & Saldo Acumulado */}
        <Card
          className={`border shadow-xs ${
            totalFluxoCaixa >= 0
              ? 'bg-gradient-to-br from-blue-50/90 to-blue-100/50 border-blue-300 text-blue-950'
              : 'bg-gradient-to-br from-amber-50/90 to-amber-100/50 border-amber-300 text-amber-950'
          }`}
        >
          <CardContent className="py-2.5 px-3.5">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-wider">
                Total Período (Caixa)
              </p>
              <Wallet className="w-3.5 h-3.5 text-blue-700" />
            </div>
            <p
              className={`text-sm font-black mt-0.5 truncate ${
                totalFluxoCaixa >= 0 ? 'text-blue-900' : 'text-rose-900'
              }`}
            >
              {formatBrl(totalFluxoCaixa)}
            </p>
            <p className="text-[9.5px] font-semibold opacity-85 mt-0.5">
              Saldo Final: {formatBrl(saldoFinal)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Cabeçalho para impressão */}
      <div className="hidden print:block mb-4 border-b border-slate-300 pb-2">
        <h2 className="text-lg font-bold text-slate-900">
          DEMONSTRAÇÃO DO FLUXO DE CAIXA POR GRUPOS DA DRE
        </h2>
        <p className="text-xs text-slate-600">
          Empresa: {selectedEmpresa ? selectedEmpresa.nome : 'Consolidado'} · Período:{' '}
          {meses[0]?.rotuloCurto} a {meses[meses.length - 1]?.rotuloCurto} ({meses.length} meses)
        </p>
      </div>

      {/* ================= TABELA MATRICIAL DO FLUXO DE CAIXA ================= */}
      <Card className="bg-white border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="py-3 px-5 border-b border-slate-100 bg-slate-50/50 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
              <Coins className="w-4 h-4 text-emerald-600" />
              Matriz do Fluxo de Caixa ({meses.length} meses)
            </CardTitle>
            <CardDescription className="text-xs">
              Estrutura: Entradas Operacionais (1) – Saídas Operacionais (2) = Geração Operacional
              (3) + Entradas Financeiras (4) – Saídas Financeiras (5) = Geração Financeira (6) =
              Fluxo Total (7) e Saldo Acumulado.
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
              <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-slate-500">
                Calculando Fluxo de Caixa a partir dos lançamentos e contas DRE...
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto w-full max-w-full">
              <table
                className="text-xs border-collapse w-full"
                style={{ minWidth: `${Math.max(820, 280 + meses.length * 105 + 130)}px` }}
              >
                <thead>
                  <tr className="bg-slate-100/90 text-[#0B1F3A] border-b border-slate-200 font-bold text-left">
                    <th className="py-2 px-3 w-[260px] min-w-[220px] sticky left-0 bg-slate-100 z-10 border-r border-slate-200 text-xs">
                      Estrutura do Fluxo de Caixa
                    </th>
                    {meses.map((m) => (
                      <th
                        key={m.chave}
                        className="py-2 px-2 min-w-[96px] text-right border-r border-slate-200 font-semibold text-[11px] whitespace-nowrap"
                      >
                        {m.rotuloCurto}
                      </th>
                    ))}
                    <th className="py-2 px-3 min-w-[115px] text-right bg-slate-200/80 font-bold text-[#0B1F3A] text-xs whitespace-nowrap">
                      Total Período
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {/* ================= 1. ENTRADAS OPERACIONAIS ================= */}
                  <tr className="bg-emerald-50/50 hover:bg-emerald-50/70 transition-colors font-bold text-emerald-950">
                    <td className="py-2.5 px-4 sticky left-0 bg-inherit z-10 border-r border-slate-200">
                      <button
                        type="button"
                        onClick={() => toggleGrupo('entradasOperacionais')}
                        className="flex items-center gap-2 text-left w-full font-bold focus:outline-none"
                      >
                        {gruposExpandidos.entradasOperacionais ? (
                          <ChevronDown className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-emerald-600 shrink-0" />
                        )}
                        <span>{fluxo.entradasOperacionais.titulo}</span>
                        <Badge
                          variant="outline"
                          className="ml-auto text-[10px] bg-emerald-100 text-emerald-900 border-emerald-300"
                        >
                          {fluxo.contasEntradasOperacionais.length} conta(s)
                        </Badge>
                      </button>
                    </td>

                    {meses.map((m) => {
                      const val = fluxo.entradasOperacionais.valoresPorMes[m.chave] || 0
                      return (
                        <td
                          key={m.chave}
                          className="py-2.5 px-2 text-right font-semibold border-r border-slate-200 text-emerald-800 whitespace-nowrap"
                        >
                          {val !== 0 ? formatBrl(val) : <span className="text-slate-300">—</span>}
                        </td>
                      )
                    })}

                    <td className="py-2.5 px-4 text-right font-bold bg-emerald-100/60 text-emerald-950">
                      {formatBrl(fluxo.entradasOperacionais.totalPeriodo)}
                    </td>
                  </tr>

                  {/* Contas de Entradas Operacionais */}
                  {gruposExpandidos.entradasOperacionais &&
                    fluxo.contasEntradasOperacionais.map((conta) => (
                      <tr
                        key={conta.id}
                        className="hover:bg-emerald-50/20 text-slate-700 transition-colors text-[11px]"
                      >
                        <td className="py-2 pl-9 pr-4 sticky left-0 bg-white z-10 border-r border-slate-100">
                          <div className="flex items-center gap-1.5 truncate flex-wrap">
                            {conta.centroNome && (
                              <span className="inline-flex items-center px-1.5 py-0.2 text-[9px] font-semibold bg-slate-100 text-slate-700 rounded border border-slate-200 shrink-0">
                                {conta.centroNome}
                              </span>
                            )}
                            {conta.tipoDespesaNome && (
                              <span className="inline-flex items-center px-1.5 py-0.2 text-[9px] font-semibold bg-emerald-50 text-emerald-800 rounded border border-emerald-200 shrink-0">
                                {conta.tipoDespesaNome}
                              </span>
                            )}
                            {conta.codigo && (
                              <span className="font-mono text-[10px] text-emerald-600 font-semibold shrink-0">
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

                  {/* ================= 2. SAÍDAS OPERACIONAIS ================= */}
                  <tr className="bg-rose-50/40 hover:bg-rose-50/60 transition-colors font-bold text-rose-950">
                    <td className="py-2.5 px-4 sticky left-0 bg-inherit z-10 border-r border-slate-200">
                      <button
                        type="button"
                        onClick={() => toggleGrupo('saidasOperacionais')}
                        className="flex items-center gap-2 text-left w-full font-bold focus:outline-none"
                      >
                        {gruposExpandidos.saidasOperacionais ? (
                          <ChevronDown className="w-4 h-4 text-rose-600 shrink-0" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-rose-600 shrink-0" />
                        )}
                        <span>{fluxo.saidasOperacionais.titulo}</span>
                        <Badge
                          variant="outline"
                          className="ml-auto text-[10px] bg-rose-100 text-rose-900 border-rose-300"
                        >
                          {fluxo.contasSaidasOperacionais.length} conta(s)
                        </Badge>
                      </button>
                    </td>

                    {meses.map((m) => {
                      const val = fluxo.saidasOperacionais.valoresPorMes[m.chave] || 0
                      return (
                        <td
                          key={m.chave}
                          className="py-2.5 px-2 text-right font-semibold border-r border-slate-200 text-rose-800 whitespace-nowrap"
                        >
                          {val !== 0 ? formatBrl(val) : <span className="text-slate-300">—</span>}
                        </td>
                      )
                    })}

                    <td className="py-2.5 px-4 text-right font-bold bg-rose-100/60 text-rose-950">
                      {formatBrl(fluxo.saidasOperacionais.totalPeriodo)}
                    </td>
                  </tr>

                  {/* Contas de Saídas Operacionais */}
                  {gruposExpandidos.saidasOperacionais &&
                    fluxo.contasSaidasOperacionais.map((conta) => (
                      <tr
                        key={conta.id}
                        className="hover:bg-rose-50/20 text-slate-700 transition-colors text-[11px]"
                      >
                        <td className="py-2 pl-9 pr-4 sticky left-0 bg-white z-10 border-r border-slate-100">
                          <div className="flex items-center gap-1.5 truncate flex-wrap">
                            {conta.centroNome && (
                              <span className="inline-flex items-center px-1.5 py-0.2 text-[9px] font-semibold bg-slate-100 text-slate-700 rounded border border-slate-200 shrink-0">
                                {conta.centroNome}
                              </span>
                            )}
                            {conta.tipoDespesaNome && (
                              <span className="inline-flex items-center px-1.5 py-0.2 text-[9px] font-semibold bg-rose-50 text-rose-800 rounded border border-rose-200 shrink-0">
                                {conta.tipoDespesaNome}
                              </span>
                            )}
                            {conta.codigo && (
                              <span className="font-mono text-[10px] text-rose-600 font-semibold shrink-0">
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

                  {/* ================= 3. = GERAÇÃO OPERACIONAL DE CAIXA ================= */}
                  <tr className="bg-slate-100 text-slate-900 font-bold border-y-2 border-slate-300">
                    <td className="py-2.5 px-4 sticky left-0 bg-inherit z-10 border-r border-slate-300">
                      <span className="font-extrabold uppercase text-[11px] tracking-wider">
                        {fluxo.geracaoOperacional.titulo}
                      </span>
                    </td>

                    {meses.map((m) => {
                      const val = fluxo.geracaoOperacional.valoresPorMes[m.chave] || 0
                      const isPositivo = val >= 0
                      return (
                        <td
                          key={m.chave}
                          className={`py-2.5 px-2 text-right font-extrabold border-r border-slate-300 whitespace-nowrap ${
                            isPositivo ? 'text-emerald-800' : 'text-rose-800'
                          }`}
                        >
                          {formatBrl(val)}
                        </td>
                      )
                    })}

                    <td
                      className={`py-2.5 px-4 text-right font-black bg-slate-200/80 ${
                        fluxo.geracaoOperacional.totalPeriodo >= 0
                          ? 'text-emerald-900'
                          : 'text-rose-900'
                      }`}
                    >
                      {formatBrl(fluxo.geracaoOperacional.totalPeriodo)}
                    </td>
                  </tr>

                  {/* ================= 4. ENTRADAS FINANCEIRAS ================= */}
                  <tr className="bg-sky-50/40 hover:bg-sky-50/60 transition-colors font-bold text-sky-950">
                    <td className="py-2.5 px-4 sticky left-0 bg-inherit z-10 border-r border-slate-200">
                      <button
                        type="button"
                        onClick={() => toggleGrupo('entradasFinanceiras')}
                        className="flex items-center gap-2 text-left w-full font-bold focus:outline-none"
                      >
                        {gruposExpandidos.entradasFinanceiras ? (
                          <ChevronDown className="w-4 h-4 text-sky-600 shrink-0" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-sky-600 shrink-0" />
                        )}
                        <span>{fluxo.entradasFinanceiras.titulo}</span>
                        <Badge
                          variant="outline"
                          className="ml-auto text-[10px] bg-sky-100 text-sky-900 border-sky-300"
                        >
                          {fluxo.contasEntradasFinanceiras.length} conta(s)
                        </Badge>
                      </button>
                    </td>

                    {meses.map((m) => {
                      const val = fluxo.entradasFinanceiras.valoresPorMes[m.chave] || 0
                      return (
                        <td
                          key={m.chave}
                          className="py-2.5 px-2 text-right font-semibold border-r border-slate-200 text-sky-800 whitespace-nowrap"
                        >
                          {val !== 0 ? formatBrl(val) : <span className="text-slate-300">—</span>}
                        </td>
                      )
                    })}

                    <td className="py-2.5 px-4 text-right font-bold bg-sky-100/60 text-sky-950">
                      {formatBrl(fluxo.entradasFinanceiras.totalPeriodo)}
                    </td>
                  </tr>

                  {/* Contas de Entradas Financeiras */}
                  {gruposExpandidos.entradasFinanceiras &&
                    fluxo.contasEntradasFinanceiras.map((conta) => (
                      <tr
                        key={conta.id}
                        className="hover:bg-sky-50/20 text-slate-700 transition-colors text-[11px]"
                      >
                        <td className="py-2 pl-9 pr-4 sticky left-0 bg-white z-10 border-r border-slate-100">
                          <div className="flex items-center gap-1.5 truncate flex-wrap">
                            {conta.centroNome && (
                              <span className="inline-flex items-center px-1.5 py-0.2 text-[9px] font-semibold bg-slate-100 text-slate-700 rounded border border-slate-200 shrink-0">
                                {conta.centroNome}
                              </span>
                            )}
                            {conta.tipoDespesaNome && (
                              <span className="inline-flex items-center px-1.5 py-0.2 text-[9px] font-semibold bg-sky-50 text-sky-800 rounded border border-sky-200 shrink-0">
                                {conta.tipoDespesaNome}
                              </span>
                            )}
                            {conta.codigo && (
                              <span className="font-mono text-[10px] text-sky-600 font-semibold shrink-0">
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

                  {/* ================= 5. SAÍDAS FINANCEIRAS ================= */}
                  <tr className="bg-purple-50/40 hover:bg-purple-50/60 transition-colors font-bold text-purple-950">
                    <td className="py-2.5 px-4 sticky left-0 bg-inherit z-10 border-r border-slate-200">
                      <button
                        type="button"
                        onClick={() => toggleGrupo('saidasFinanceiras')}
                        className="flex items-center gap-2 text-left w-full font-bold focus:outline-none"
                      >
                        {gruposExpandidos.saidasFinanceiras ? (
                          <ChevronDown className="w-4 h-4 text-purple-600 shrink-0" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-purple-600 shrink-0" />
                        )}
                        <span>{fluxo.saidasFinanceiras.titulo}</span>
                        <Badge
                          variant="outline"
                          className="ml-auto text-[10px] bg-purple-100 text-purple-900 border-purple-300"
                        >
                          {fluxo.contasSaidasFinanceiras.length} conta(s)
                        </Badge>
                      </button>
                    </td>

                    {meses.map((m) => {
                      const val = fluxo.saidasFinanceiras.valoresPorMes[m.chave] || 0
                      return (
                        <td
                          key={m.chave}
                          className="py-2.5 px-2 text-right font-semibold border-r border-slate-200 text-purple-800 whitespace-nowrap"
                        >
                          {val !== 0 ? formatBrl(val) : <span className="text-slate-300">—</span>}
                        </td>
                      )
                    })}

                    <td className="py-2.5 px-4 text-right font-bold bg-purple-100/60 text-purple-950">
                      {formatBrl(fluxo.saidasFinanceiras.totalPeriodo)}
                    </td>
                  </tr>

                  {/* Contas de Saídas Financeiras */}
                  {gruposExpandidos.saidasFinanceiras &&
                    fluxo.contasSaidasFinanceiras.map((conta) => (
                      <tr
                        key={conta.id}
                        className="hover:bg-purple-50/20 text-slate-700 transition-colors text-[11px]"
                      >
                        <td className="py-2 pl-9 pr-4 sticky left-0 bg-white z-10 border-r border-slate-100">
                          <div className="flex items-center gap-1.5 truncate flex-wrap">
                            {conta.centroNome && (
                              <span className="inline-flex items-center px-1.5 py-0.2 text-[9px] font-semibold bg-slate-100 text-slate-700 rounded border border-slate-200 shrink-0">
                                {conta.centroNome}
                              </span>
                            )}
                            {conta.tipoDespesaNome && (
                              <span className="inline-flex items-center px-1.5 py-0.2 text-[9px] font-semibold bg-purple-50 text-purple-800 rounded border border-purple-200 shrink-0">
                                {conta.tipoDespesaNome}
                              </span>
                            )}
                            {conta.codigo && (
                              <span className="font-mono text-[10px] text-purple-600 font-semibold shrink-0">
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

                  {/* ================= 6. = GERAÇÃO FINANCEIRA DE CAIXA ================= */}
                  <tr className="bg-slate-100 text-slate-900 font-bold border-y-2 border-slate-300">
                    <td className="py-2.5 px-4 sticky left-0 bg-inherit z-10 border-r border-slate-300">
                      <span className="font-extrabold uppercase text-[11px] tracking-wider">
                        {fluxo.geracaoFinanceira.titulo}
                      </span>
                    </td>

                    {meses.map((m) => {
                      const val = fluxo.geracaoFinanceira.valoresPorMes[m.chave] || 0
                      const isPositivo = val >= 0
                      return (
                        <td
                          key={m.chave}
                          className={`py-2.5 px-2 text-right font-extrabold border-r border-slate-300 whitespace-nowrap ${
                            isPositivo ? 'text-emerald-800' : 'text-purple-800'
                          }`}
                        >
                          {formatBrl(val)}
                        </td>
                      )
                    })}

                    <td
                      className={`py-2.5 px-4 text-right font-black bg-slate-200/80 ${
                        fluxo.geracaoFinanceira.totalPeriodo >= 0
                          ? 'text-emerald-900'
                          : 'text-purple-900'
                      }`}
                    >
                      {formatBrl(fluxo.geracaoFinanceira.totalPeriodo)}
                    </td>
                  </tr>

                  {/* ================= 7. = FLUXO DE CAIXA TOTAL DO MÊS ================= */}
                  <tr
                    className={`border-t-2 font-extrabold text-xs ${
                      totalFluxoCaixa >= 0
                        ? 'bg-emerald-100/70 text-emerald-950 border-emerald-400'
                        : 'bg-rose-100/70 text-rose-950 border-rose-400'
                    }`}
                  >
                    <td className="py-3.5 px-4 sticky left-0 bg-inherit z-10 border-r border-slate-300">
                      <div className="flex items-center justify-between">
                        <span className="text-xs uppercase tracking-wider font-extrabold flex items-center gap-2">
                          {totalFluxoCaixa >= 0 ? (
                            <TrendingUp className="w-4 h-4 text-emerald-700" />
                          ) : (
                            <TrendingDown className="w-4 h-4 text-rose-700" />
                          )}
                          {fluxo.fluxoCaixaTotal.titulo}
                        </span>
                        <Badge
                          className={`text-[10px] font-bold ${
                            totalFluxoCaixa >= 0
                              ? 'bg-emerald-200 text-emerald-900 border-emerald-400'
                              : 'bg-rose-200 text-rose-900 border-rose-400'
                          }`}
                        >
                          {totalFluxoCaixa >= 0 ? 'CAIXA POSITIVO' : 'DÉFICIT'}
                        </Badge>
                      </div>
                    </td>

                    {meses.map((m) => {
                      const resMes = fluxo.fluxoCaixaTotal.valoresPorMes[m.chave] || 0
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
                        totalFluxoCaixa >= 0 ? 'text-emerald-900' : 'text-rose-900'
                      }`}
                    >
                      {formatBrl(fluxo.fluxoCaixaTotal.totalPeriodo)}
                    </td>
                  </tr>

                  {/* ================= 8. SALDO ACUMULADO (PROGRESSÃO) ================= */}
                  <tr className="bg-slate-50 text-slate-800 font-bold text-xs border-b border-slate-200">
                    <td className="py-3 px-4 sticky left-0 bg-slate-50 z-10 border-r border-slate-200">
                      <div className="flex items-center gap-2">
                        <Wallet className="w-4 h-4 text-blue-600" />
                        <span className="font-bold text-[#0B1F3A]">
                          {fluxo.saldoAcumulado.titulo}
                        </span>
                      </div>
                    </td>

                    {meses.map((m) => {
                      const saldoMes = fluxo.saldoAcumulado.valoresPorMes[m.chave] || 0
                      const isSaldoPositivo = saldoMes >= 0
                      return (
                        <td
                          key={m.chave}
                          className={`py-3 px-2 text-right font-bold border-r border-slate-200 whitespace-nowrap ${
                            isSaldoPositivo ? 'text-blue-900' : 'text-rose-900'
                          }`}
                        >
                          {formatBrl(saldoMes)}
                        </td>
                      )
                    })}

                    <td
                      className={`py-3 px-4 text-right font-black text-xs bg-slate-200/60 ${
                        saldoFinal >= 0 ? 'text-blue-950' : 'text-rose-950'
                      }`}
                    >
                      {formatBrl(saldoFinal)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rodapé explicativo institucional */}
      <div className="text-xs text-slate-500 bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1 print:border-none print:bg-white print:p-0">
        <p className="font-semibold text-slate-700">Sobre o Fluxo de Caixa por grupo DRE:</p>
        <p>
          • <strong>Geração Operacional:</strong> Entradas Operacionais (Receitas) – Saídas
          Operacionais (Despesas Variáveis e Fixas vinculadas às contas operacionais).
        </p>
        <p>
          • <strong>Geração Financeira:</strong> Entradas Financeiras (Receitas Financeiras) –
          Saídas Financeiras (Despesas Financeiras).
        </p>
        <p>
          • <strong>Saldo Acumulado:</strong> Representa a trajetória cumulativa mês a mês das
          gerações de caixa da empresa ao longo do horizonte selecionado (até 12 meses).
        </p>
      </div>
    </div>
  )
}
