import { useMemo, useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useFilter } from '@/contexts/FilterContext'
import { useToast } from '@/hooks/use-toast'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Percent,
  DollarSign,
  RefreshCw,
  Download,
  FileSpreadsheet,
  Printer,
  Calendar,
  Building,
  TrendingDown,
  TrendingUp,
  LineChart as LineChartIcon,
  Info,
} from 'lucide-react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
} from 'recharts'
import {
  calcularMargemContribuicao,
  classificarVariacaoMargem,
  type MargemContribuicaoResultado,
} from '@/lib/margemContribuicaoCalculo'
import {
  exportarMargemContribuicaoExcel,
  exportarMargemContribuicaoCsv,
} from '@/lib/margemContribuicaoExport'
import { formatarPercentualExport } from '@/lib/despesasFixasExport'
import { lancamentosService } from '@/services/financeService'
import { contasService, planoContasService } from '@/services/financeService'
import { useRealtime } from '@/hooks/use-realtime'
import type { ContaRecord, LancamentoRecord, PlanoContaRecord } from '@/types/finance'

function formatBrl(val: number | undefined | null): string {
  if (val === undefined || val === null || !Number.isFinite(val)) return '—'
  return val.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function formatPp(delta: number | null): string {
  if (delta === null || !Number.isFinite(delta)) return '—'
  const s = Math.abs(delta).toFixed(2).replace('.', ',')
  return `${delta > 0 ? '+' : delta < 0 ? '−' : ''}${s} p.p.`
}

const CORES_ANOS = ['#2563eb', '#059669', '#d97706', '#7c3aed', '#dc2626', '#0891b2']

interface PontoTendencia {
  mes: string
  [ano: string]: string | number | null
}

export default function MargemContribuicao() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { user } = useAuth()
  const { selectedEmpresaId, selectedEmpresa, selectedAno, isGrupoAtivo, grupoAtivo } = useFilter()
  const isCliente = user?.role === 'cliente'

  const [loading, setLoading] = useState(true)
  const [lancamentos, setLancamentos] = useState<LancamentoRecord[]>([])
  const [contas, setContas] = useState<ContaRecord[]>([])
  const [planoContas, setPlanoContas] = useState<PlanoContaRecord[]>([])

  const exercicio = selectedAno || new Date().getFullYear()

  const carregarDados = useCallback(async () => {
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
      console.error('Erro ao carregar dados da margem de contribuição:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar dados',
        description: 'Não foi possível carregar os lançamentos e o plano de contas.',
      })
    } finally {
      setLoading(false)
    }
  }, [selectedEmpresaId, isGrupoAtivo, grupoAtivo, toast])

  useEffect(() => {
    carregarDados()
  }, [carregarDados])

  useRealtime<LancamentoRecord>('lancamentos', () => carregarDados())
  useRealtime<ContaRecord>('contas', () => carregarDados())

  useEffect(() => {
    const handleRecarregar = () => carregarDados()
    window.addEventListener('dre-contas-atualizadas', handleRecarregar)
    window.addEventListener('dre-contas-atualizado', handleRecarregar)
    return () => {
      window.removeEventListener('dre-contas-atualizadas', handleRecarregar)
      window.removeEventListener('dre-contas-atualizado', handleRecarregar)
    }
  }, [carregarDados])

  const resultado = useMemo<MargemContribuicaoResultado>(
    () => calcularMargemContribuicao({ lancamentos, contas, planoContas, anoAtual: exercicio }),
    [lancamentos, contas, planoContas, exercicio],
  )

  const anoAtivo = resultado.anoAtivo
  const mesesMatriz = resultado.mesesAnoAtivo

  // Série do gráfico de tendências: uma coluna por mês, uma série (linha) por ano
  const dadosTendencia = useMemo<PontoTendencia[]>(() => {
    const rotulos = mesesMatriz.map((m) => m.rotuloCurto.split('/')[0])
    return rotulos.map((mes, idx) => {
      const ponto: PontoTendencia = { mes }
      for (const ano of resultado.anos) {
        const m = ano.meses[idx]
        ponto[String(ano.ano)] = m && m.temMovimento ? m.margemPercentual : null
      }
      return ponto
    })
  }, [resultado, mesesMatriz])

  const handleImprimir = () => window.print()

  const handleExportarExcel = () => {
    try {
      exportarMargemContribuicaoExcel(resultado, selectedEmpresa)
      toast({
        title: 'Margem de Contribuição Exportada',
        description: 'Planilha Excel gerada com receita, despesas variáveis e margem por ano.',
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
      exportarMargemContribuicaoCsv(resultado, selectedEmpresa)
      toast({
        title: 'Margem de Contribuição Exportada',
        description: 'Arquivo CSV gerado no padrão brasileiro.',
      })
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: 'Erro na exportação',
        description: e?.message || 'Falha ao gerar arquivo CSV.',
      })
    }
  }

  const contextoLabel =
    isGrupoAtivo && grupoAtivo
      ? `Grupo ${grupoAtivo.nome}`
      : selectedEmpresa
        ? selectedEmpresa.nome
        : 'Todas as empresas (Consolidado Geral)'

  return (
    <div className="space-y-4 animate-fadeIn pb-6 print:p-0 print:m-0">
      {/* Cabeçalho da tela */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-blue-100/80 text-blue-800 shadow-xs">
              <Percent className="w-5 h-5 text-blue-700" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-[#0B1F3A] tracking-tight">
                  Margem de Contribuição
                </h1>
                <Badge
                  variant="outline"
                  className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] font-semibold"
                >
                  Gerencial DRE
                </Badge>
              </div>
              <p className="text-[11px] text-[#5B6B7F]">
                Receita menos despesas variáveis, mês a mês, com comparativo entre anos e gráfico de
                tendências.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap print:hidden">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={carregarDados}
            disabled={loading}
            className="h-8 text-xs font-semibold border-slate-200 hover:bg-slate-50 text-slate-700 gap-1.5 cursor-pointer"
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
            className="h-8 text-xs font-semibold border-slate-200 hover:bg-slate-50 text-slate-700 gap-1.5 cursor-pointer"
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
                className="h-8 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-xs cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Exportar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-white">
              <DropdownMenuItem
                onClick={handleExportarExcel}
                className="text-xs cursor-pointer gap-2 py-2"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <div className="flex flex-col">
                  <span className="font-semibold text-slate-800">Planilha Excel (.xlsx)</span>
                  <span className="text-[10px] text-slate-500">
                    Receita, despesas variáveis e margem por ano
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
                    Padrão brasileiro delimitado por ';'
                  </span>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Barra de contexto: empresa + exercício */}
      <Card className="bg-white border-slate-200/90 shadow-xs print:hidden">
        <CardContent className="py-3 px-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <div className="text-xs">
                <span className="text-slate-500">Contexto: </span>
                <span className="font-bold text-[#0B1F3A]">{contextoLabel}</span>
                {selectedEmpresa?.segmento && (
                  <Badge variant="outline" className="ml-2 text-[10px] py-0">
                    {selectedEmpresa.segmento}
                  </Badge>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-slate-400" />
                <span className="text-xs text-slate-600 font-medium">Exercício ativo:</span>
                <span className="text-sm font-extrabold text-[#0B1F3A]">{exercicio}</span>
              </div>
              <span className="text-[11px] text-slate-400">
                (troque o ano pelo seletor de exercício do topo)
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cards de Resumo (exercício ativo) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 print:grid-cols-4">
        <Card className="bg-white border-slate-200/90 shadow-xs hover:border-slate-300 transition-colors">
          <CardContent className="py-2.5 px-3.5">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                Receita ({exercicio})
              </p>
              <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <p className="text-sm font-bold text-emerald-700 mt-0.5 truncate">
              {formatBrl(anoAtivo?.totalReceita ?? null)}
            </p>
            <p className="text-[9.5px] text-slate-500 mt-0.5">Jan a Dez do exercício</p>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200/90 shadow-xs hover:border-slate-300 transition-colors">
          <CardContent className="py-2.5 px-3.5">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                Despesas Variáveis ({exercicio})
              </p>
              <TrendingDown className="w-3.5 h-3.5 text-amber-600" />
            </div>
            <p className="text-sm font-bold text-amber-700 mt-0.5 truncate">
              {formatBrl(anoAtivo?.totalDespesasVariaveis ?? null)}
            </p>
            <p className="text-[9.5px] text-slate-500 mt-0.5">
              Contas classificadas como "Despesa Variável"
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200/90 shadow-xs hover:border-slate-300 transition-colors">
          <CardContent className="py-2.5 px-3.5">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                Margem de Contribuição (R$)
              </p>
              <LineChartIcon className="w-3.5 h-3.5 text-blue-600" />
            </div>
            <p className="text-sm font-bold text-[#0B1F3A] mt-0.5 truncate">
              {formatBrl(anoAtivo?.margemTotal ?? null)}
            </p>
            <p className="text-[9.5px] text-slate-500 mt-0.5">Receita − despesas variáveis</p>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200/90 shadow-xs hover:border-slate-300 transition-colors">
          <CardContent className="py-2.5 px-3.5">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                Margem de Contribuição (%)
              </p>
              <Percent className="w-3.5 h-3.5 text-blue-600" />
            </div>
            <p className="text-base font-extrabold text-[#0B1F3A] mt-0.5 truncate">
              {formatarPercentualExport(anoAtivo?.margemAnualPercentual ?? null)}
            </p>
            <p className="text-[9.5px] text-slate-500 mt-0.5">
              {formatPp(anoAtivo?.variacaoPpAnoAnterior ?? null)} vs ano anterior
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de tendências: uma linha por ano */}
      <Card className="bg-white border-slate-200 shadow-sm print:hidden">
        <CardHeader className="py-3 px-5 border-b border-slate-100 bg-slate-50/50">
          <CardTitle className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
            <LineChartIcon className="w-4 h-4 text-blue-700" />
            Tendência da Margem de Contribuição (%) — Comparativo entre Anos
          </CardTitle>
          <CardDescription className="text-xs">
            Uma linha por ano: evolução da margem de contribuição (margem ÷ receita) ao longo dos
            meses. Meses sem movimento ficam sem ponto (linha interrompida).
          </CardDescription>
        </CardHeader>
        <CardContent className="py-4 px-4">
          {!resultado.temDados ? (
            <p className="text-xs text-slate-500 text-center py-10">
              Sem dados de receita ou despesas variáveis na base.
            </p>
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dadosTendencia} margin={{ top: 8, right: 12, bottom: 0, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    tickFormatter={(v: number) => `${v.toFixed(0)}%`}
                  />
                  <RechartsTooltip
                    formatter={(value, name) => [
                      value === null || value === undefined
                        ? '—'
                        : `${Number(value).toFixed(2).replace('.', ',')}%`,
                      String(name),
                    ]}
                    labelStyle={{ fontWeight: 700, color: '#0B1F3A' }}
                    contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }}
                  />
                  <Legend wrapperStyle={{ fontSize: 10.5 }} />
                  {resultado.anos.map((a, i) => (
                    <Line
                      key={a.ano}
                      type="monotone"
                      dataKey={String(a.ano)}
                      stroke={CORES_ANOS[i % CORES_ANOS.length]}
                      strokeWidth={i === 0 ? 2.5 : 1.75}
                      dot={{ r: i === 0 ? 3 : 2 }}
                      connectNulls={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabela matricial do exercício ativo */}
      <Card className="bg-white border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="py-3 px-5 border-b border-slate-100 bg-slate-50/50 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
              <Percent className="w-4 h-4 text-blue-700" />
              Margem de Contribuição Mês a Mês ({exercicio})
            </CardTitle>
            <CardDescription className="text-xs">
              Receita e despesas variáveis por mês (jan–dez), margem em R$ e % sobre a receita.
              Mês/ano sem movimento exibe "—".
            </CardDescription>
          </div>
          <div className="text-xs text-slate-500 font-medium">
            Exercício: <strong className="text-slate-800">{exercicio}</strong>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-slate-500">Calculando margem de contribuição...</p>
            </div>
          ) : !anoAtivo || !anoAtivo.temDados ? (
            <div className="p-6">
              <div className="py-16 px-6 text-center max-w-md mx-auto space-y-3">
                <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
                  <Info className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-slate-800">Sem dados para o exercício</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Nenhuma receita ou despesa variável lançada para {exercicio}. Lance as receitas e
                  classifique as despesas variáveis no plano de contas.
                </p>
                <div className="pt-2 flex items-center justify-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => navigate('/contas')}
                    className="text-xs font-semibold bg-[#0B1F3A] hover:bg-blue-900 text-white gap-1.5 cursor-pointer"
                  >
                    <Info className="w-3.5 h-3.5" />
                    Classificar Contas
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 hover:bg-slate-50">
                    <TableHead className="text-[10.5px] font-bold text-slate-600 uppercase tracking-wider min-w-[200px]">
                      Linha ({exercicio})
                    </TableHead>
                    {mesesMatriz.map((m) => (
                      <TableHead
                        key={m.chave}
                        className="text-[10.5px] font-bold text-slate-600 text-center border-l border-slate-100"
                      >
                        {m.rotuloCurto}
                      </TableHead>
                    ))}
                    <TableHead className="text-[10.5px] font-bold text-slate-900 text-center border-l border-slate-200 bg-slate-100">
                      Total Ano
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* RECEITA */}
                  <TableRow className="bg-emerald-50/60 hover:bg-emerald-50/60 font-bold">
                    <TableCell className="text-xs font-extrabold text-emerald-800 py-2">
                      RECEITA
                    </TableCell>
                    {anoAtivo.meses.map((m) => (
                      <TableCell
                        key={m.chave}
                        className="text-[11px] text-right py-1.5 border-l border-slate-100 font-bold text-slate-800"
                      >
                        {m.temMovimento || m.receita !== 0 ? formatBrl(m.receita) : '—'}
                      </TableCell>
                    ))}
                    <TableCell className="text-[11px] text-right py-1.5 border-l border-slate-200 font-bold text-slate-800 bg-slate-50">
                      {formatBrl(anoAtivo.totalReceita)}
                    </TableCell>
                  </TableRow>
                  {/* DESPESAS VARIÁVEIS */}
                  <TableRow className="bg-amber-50/60 hover:bg-amber-50/60 font-bold">
                    <TableCell className="text-xs font-extrabold text-amber-800 py-2">
                      DESPESAS VARIÁVEIS
                    </TableCell>
                    {anoAtivo.meses.map((m) => (
                      <TableCell
                        key={m.chave}
                        className="text-[11px] text-right py-1.5 border-l border-slate-100 font-bold text-slate-800"
                      >
                        {m.temMovimento || m.despesasVariaveis !== 0
                          ? formatBrl(m.despesasVariaveis)
                          : '—'}
                      </TableCell>
                    ))}
                    <TableCell className="text-[11px] text-right py-1.5 border-l border-slate-200 font-bold text-slate-800 bg-slate-50">
                      {formatBrl(anoAtivo.totalDespesasVariaveis)}
                    </TableCell>
                  </TableRow>
                  {/* MARGEM R$ */}
                  <TableRow className="bg-blue-50/60 hover:bg-blue-50/60 font-bold">
                    <TableCell className="text-xs font-extrabold text-blue-800 py-2">
                      MARGEM DE CONTRIBUIÇÃO (R$)
                    </TableCell>
                    {anoAtivo.meses.map((m) => (
                      <TableCell
                        key={m.chave}
                        className={`text-[11px] text-right py-1.5 border-l border-slate-100 font-bold ${
                          !m.temMovimento
                            ? 'text-slate-400'
                            : m.margemValor >= 0
                              ? 'text-emerald-700'
                              : 'text-rose-700'
                        }`}
                      >
                        {m.temMovimento ? formatBrl(m.margemValor) : '—'}
                      </TableCell>
                    ))}
                    <TableCell className="text-[11px] text-right py-1.5 border-l border-slate-200 font-extrabold text-slate-900 bg-slate-50">
                      {formatBrl(anoAtivo.margemTotal)}
                    </TableCell>
                  </TableRow>
                  {/* MARGEM % */}
                  <TableRow className="bg-blue-50/60 hover:bg-blue-50/60 font-bold">
                    <TableCell className="text-xs font-extrabold text-blue-800 py-2">
                      MARGEM DE CONTRIBUIÇÃO (%)
                    </TableCell>
                    {anoAtivo.meses.map((m) => (
                      <TableCell
                        key={m.chave}
                        className="text-[11px] text-right py-1.5 border-l border-slate-100 font-bold text-slate-800"
                      >
                        {formatarPercentualExport(m.margemPercentual)}
                      </TableCell>
                    ))}
                    <TableCell className="text-[11px] text-right py-1.5 border-l border-slate-200 font-extrabold text-slate-900 bg-slate-50">
                      {formatarPercentualExport(anoAtivo.margemAnualPercentual)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Comparativo entre anos */}
      <Card className="bg-white border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="py-3 px-5 border-b border-slate-100 bg-slate-50/50">
          <CardTitle className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-700" />
            Comparativo entre Anos
          </CardTitle>
          <CardDescription className="text-xs">
            Totais anuais de receita, despesas variáveis e margem de contribuição, com a variação da
            margem em pontos percentuais vs o ano anterior (verde = melhora, vermelho = piora).
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {!resultado.temDados ? (
            <p className="text-xs text-slate-500 text-center py-10">Sem dados para comparar.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 hover:bg-slate-50">
                    <TableHead className="text-[10.5px] font-bold text-slate-600 uppercase tracking-wider">
                      Ano
                    </TableHead>
                    <TableHead className="text-[10.5px] font-bold text-slate-600 text-right">
                      Receita
                    </TableHead>
                    <TableHead className="text-[10.5px] font-bold text-slate-600 text-right">
                      Despesas Variáveis
                    </TableHead>
                    <TableHead className="text-[10.5px] font-bold text-slate-600 text-right">
                      Margem (R$)
                    </TableHead>
                    <TableHead className="text-[10.5px] font-bold text-slate-600 text-right">
                      Margem (%)
                    </TableHead>
                    <TableHead className="text-[10.5px] font-bold text-slate-600 text-right">
                      Variação (p.p.)
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resultado.anos.map((a) => {
                    const classe = classificarVariacaoMargem(a.variacaoPpAnoAnterior)
                    return (
                      <TableRow
                        key={a.ano}
                        className={`hover:bg-slate-50/60 ${a.ano === exercicio ? 'bg-blue-50/40 font-bold' : ''}`}
                      >
                        <TableCell className="text-xs font-bold text-[#0B1F3A] py-2">
                          <div className="flex items-center gap-1.5">
                            {a.ano === exercicio && (
                              <Badge
                                variant="outline"
                                className="bg-blue-50 text-blue-700 border-blue-200 text-[9px] py-0"
                              >
                                Exercício ativo
                              </Badge>
                            )}
                            {a.ano}
                            {!a.temDados && (
                              <span className="text-[9.5px] font-medium text-slate-400">
                                (sem movimento)
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-[11px] text-right py-1.5 text-slate-700">
                          {a.temDados ? formatBrl(a.totalReceita) : '—'}
                        </TableCell>
                        <TableCell className="text-[11px] text-right py-1.5 text-slate-700">
                          {a.temDados ? formatBrl(a.totalDespesasVariaveis) : '—'}
                        </TableCell>
                        <TableCell
                          className={`text-[11px] text-right py-1.5 font-bold ${
                            a.temDados && a.margemTotal < 0 ? 'text-rose-700' : 'text-slate-800'
                          }`}
                        >
                          {a.temDados ? formatBrl(a.margemTotal) : '—'}
                        </TableCell>
                        <TableCell className="text-[11px] text-right py-1.5 font-bold text-slate-800">
                          {formatarPercentualExport(a.margemAnualPercentual)}
                        </TableCell>
                        <TableCell className="text-[11px] text-right py-1.5">
                          <span
                            className={`text-[10.5px] font-bold rounded px-1.5 py-0.5 border ${
                              classe === 'melhora'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : classe === 'piora'
                                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                                  : 'bg-slate-50 text-slate-500 border-slate-200'
                            }`}
                          >
                            {formatPp(a.variacaoPpAnoAnterior)}
                          </span>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
