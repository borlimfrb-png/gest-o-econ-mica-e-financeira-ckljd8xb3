import React, { useMemo, useState, useEffect } from 'react'
import {
  Calculator,
  Calendar,
  Building2,
  FileSpreadsheet,
  FileText,
  Printer,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Scale,
  Sparkles,
  Layers,
  Info,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useFilter } from '@/contexts/FilterContext'
import { useMinhaEmpresa } from '@/contexts/MinhaEmpresaContext'
import { useToast } from '@/hooks/use-toast'
import { useRealtime } from '@/hooks/use-realtime'
import { SelectEmpresaOuGrupoItems } from '@/components/SelectEmpresaOuGrupoItems'
import {
  centrosService,
  contasService,
  lancamentosService,
  planoContasService,
} from '@/services/financeService'
import type { ContaRecord, LancamentoRecord, PlanoContaRecord } from '@/types/finance'
import {
  CBS_RATE,
  IBS_RATE,
  ALIQUOTA_COMBINADA_RATE,
  CENTRO_CUSTO_ENTRADAS_CODIGO,
  calcularReformaTributaria,
  type ReformaTributariaResultado,
} from '@/lib/reformaTributariaCalculo'
import {
  exportarReformaTributariaExcel,
  exportarReformaTributariaCsv,
} from '@/lib/reformaTributariaExport'

const NOMES_MESES = [
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

function formatBrl(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatPercent(valor: number): string {
  return `${valor.toFixed(2).replace('.', ',')}%`
}

export default function ReformaTributaria() {
  const {
    empresas,
    todasEntidades,
    selectedEmpresaId,
    setSelectedEmpresaId,
    selectedEmpresa,
    isGrupoAtivo,
    grupoAtivo,
    selectedAno,
    setSelectedAno,
    anosDisponiveis,
    empresasIdsAtivas,
  } = useFilter()

  const { toast } = useToast()
  const { minhaEmpresa, logoUrl } = useMinhaEmpresa()

  // Estado do tipo de período: 'mes' ou 'ano' (solicitação direta do usuário)
  const [periodoTipo, setPeriodoTipo] = useState<'mes' | 'ano'>('ano')
  const [selectedMes, setSelectedMes] = useState<number>(new Date().getMonth() + 1)

  // Dados do banco
  const [lancamentos, setLancamentos] = useState<LancamentoRecord[]>([])
  const [contas, setContas] = useState<ContaRecord[]>([])
  const [planoContas, setPlanoContas] = useState<PlanoContaRecord[]>([])
  const [centros, setCentros] = useState<Array<{ id: string; codigo?: string; nome?: string }>>([])
  const [loading, setLoading] = useState<boolean>(false)

  // Carregar dados de acordo com empresa ativa ou grupo econômico
  const carregarDados = async () => {
    try {
      setLoading(true)

      let lancsPromise: Promise<LancamentoRecord[]>
      let contasPromise: Promise<ContaRecord[]>
      let planosPromise: Promise<PlanoContaRecord[]>
      let centrosPromise: Promise<any[]>

      if (isGrupoAtivo && grupoAtivo && grupoAtivo.empresas && grupoAtivo.empresas.length > 0) {
        const empIds = new Set(grupoAtivo.empresas)
        const opts = { empresasIds: grupoAtivo.empresas }
        lancsPromise = lancamentosService
          .getAll({ expandRelations: true })
          .then((list) => list.filter((l) => empIds.has(l.empresa)))
        contasPromise = contasService.getAll(opts)
        planosPromise = planoContasService.getAll(opts)
        centrosPromise = centrosService.getAll()
      } else if (selectedEmpresaId && !selectedEmpresaId.startsWith('grupo-')) {
        lancsPromise = lancamentosService.getAll({
          empresaId: selectedEmpresaId,
          expandRelations: true,
        })
        contasPromise = contasService.getAll({ empresaId: selectedEmpresaId })
        planosPromise = planoContasService.getAll({ empresaId: selectedEmpresaId })
        centrosPromise = centrosService.getAll({ empresaId: selectedEmpresaId })
      } else {
        const empOpts =
          empresasIdsAtivas.length > 0 ? { empresasIds: empresasIdsAtivas } : undefined
        lancsPromise = lancamentosService.getAll({ expandRelations: true })
        contasPromise = contasService.getAll(empOpts)
        planosPromise = planoContasService.getAll(empOpts)
        centrosPromise = centrosService.getAll()
      }

      const [contasList, lancamentosList, planosList, centrosList] = await Promise.all([
        contasPromise,
        lancsPromise,
        planosPromise,
        centrosPromise,
      ])

      setContas(Array.from(new Map(contasList.map((i) => [i.id, i])).values()))
      setLancamentos(lancamentosList)
      setPlanoContas(Array.from(new Map(planosList.map((i) => [i.id, i])).values()))
      setCentros(
        centrosList.map((c) => ({
          id: c.id,
          codigo: c.codigo,
          nome: c.nome,
        })),
      )
    } catch (err: any) {
      console.error('Erro ao carregar dados para Reforma Tributária:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar dados',
        description: 'Não foi possível carregar os lançamentos contábeis.',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarDados()
  }, [selectedEmpresaId, isGrupoAtivo, grupoAtivo])

  // Realtime
  useRealtime<LancamentoRecord>('lancamentos', () => carregarDados())
  useRealtime<ContaRecord>('contas', () => carregarDados())
  useRealtime<PlanoContaRecord>('plano_contas', () => carregarDados())

  // Executa o motor de cálculo da Reforma Tributária
  const resultado: ReformaTributariaResultado = useMemo(() => {
    return calcularReformaTributaria({
      periodoTipo,
      ano: selectedAno,
      mes: selectedMes,
      lancamentos,
      contas,
      planoContas,
      centros,
      codigoCentroEntradas: CENTRO_CUSTO_ENTRADAS_CODIGO,
    })
  }, [periodoTipo, selectedAno, selectedMes, lancamentos, contas, planoContas, centros])

  // Nome da entidade ativa
  const nomeEntidade = isGrupoAtivo
    ? `Grupo Econômico: ${grupoAtivo?.nome || 'Consolidado'}`
    : selectedEmpresa?.nome || 'Empresa Selecionada'

  // Forma de tributação (regime tributário da empresa)
  const regimeAtual =
    selectedEmpresa?.forma_tributacao || minhaEmpresa?.regime_tributario || 'Não Informado'

  const handleExportarExcel = () => {
    try {
      exportarReformaTributariaExcel(resultado, {
        empresa: selectedEmpresa,
        isGrupo: Boolean(isGrupoAtivo),
        nomeGrupo: grupoAtivo?.nome,
      })
      toast({
        title: 'Planilha Excel gerada',
        description: 'Os dados da Reforma Tributária foram exportados com sucesso.',
      })
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro na exportação',
        description: err?.message || 'Falha ao gerar arquivo Excel.',
      })
    }
  }

  const handleExportarCsv = () => {
    try {
      exportarReformaTributariaCsv(resultado, {
        empresa: selectedEmpresa,
        isGrupo: Boolean(isGrupoAtivo),
        nomeGrupo: grupoAtivo?.nome,
      })
      toast({
        title: 'Arquivo CSV gerado',
        description: 'Arquivo CSV gerado no padrão brasileiro (;).',
      })
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro na exportação',
        description: err?.message || 'Falha ao gerar CSV.',
      })
    }
  }

  const handleImprimir = () => {
    window.print()
  }

  return (
    <div className="space-y-6 animate-fadeIn pb-10 print:p-0 print:m-0 w-full min-w-0 max-w-full overflow-hidden">
      {/* 1. Cabeçalho Executivo com Logo / Titularidade */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div className="flex items-start sm:items-center gap-3">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="Logo"
              className="w-12 h-12 object-contain rounded-xl border border-slate-200 bg-white p-1 shrink-0 shadow-xs"
            />
          ) : (
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-700 to-indigo-800 text-white flex items-center justify-center shrink-0 shadow-sm">
              <Scale className="w-6 h-6" />
            </div>
          )}
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-[#0B1F3A] tracking-tight">
                Reforma Tributária — CBS & IBS
              </h1>
              <Badge className="bg-indigo-100 text-indigo-800 border-indigo-200 text-xs font-bold">
                LC 214/2025
              </Badge>
              <Badge
                variant="outline"
                className="bg-slate-50 text-slate-700 border-slate-300 text-xs"
              >
                {periodoTipo === 'ano'
                  ? `Exercício ${selectedAno}`
                  : `${NOMES_MESES[selectedMes - 1]?.nome} / ${selectedAno}`}
              </Badge>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              Simulação de apuração não-cumulativa com débito sobre saídas da DRE e crédito sobre
              compras do Centro de Custo{' '}
              <strong className="text-indigo-700 font-semibold">
                {CENTRO_CUSTO_ENTRADAS_CODIGO}
              </strong>
              .
            </p>
          </div>
        </div>

        {/* Ações: Exportar Excel, CSV, Imprimir e Atualizar */}
        <div className="flex items-center gap-2 flex-wrap print:hidden">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={carregarDados}
            disabled={loading}
            className="h-8 text-xs font-semibold border-slate-200 hover:bg-slate-50 text-slate-700 gap-1.5"
            title="Recarregar lançamentos do banco"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExportarCsv}
            disabled={loading}
            className="h-8 text-xs font-semibold border-slate-200 hover:bg-slate-50 text-slate-700 gap-1.5"
            title="Exportar arquivo CSV com separador ponto-e-vírgula"
          >
            <FileText className="w-3.5 h-3.5 text-blue-600" />
            CSV
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExportarExcel}
            disabled={loading}
            className="h-8 text-xs font-semibold border-emerald-300 hover:bg-emerald-50 text-emerald-700 gap-1.5 shadow-xs"
            title="Exportar planilha Excel completa"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            Excel (.xlsx)
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleImprimir}
            className="h-8 text-xs font-semibold border-slate-200 hover:bg-slate-50 text-slate-700 gap-1.5"
            title="Imprimir relatório / Salvar PDF"
          >
            <Printer className="w-3.5 h-3.5 text-slate-600" />
            Imprimir / PDF
          </Button>
        </div>
      </div>

      {/* 2. Barra de Filtros: Empresa/Grupo, Visão (Mês vs Ano), Seletor de Mês e Seletor de Ano */}
      <Card className="rounded-xl border-slate-200 bg-white shadow-xs">
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Seletor de Empresa / Grupo Econômico */}
            <div className="flex-1 min-w-[260px]">
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                Empresa Ativa ou Grupo Econômico
              </label>
              <Select
                value={selectedEmpresaId || undefined}
                onValueChange={(val) => setSelectedEmpresaId(val)}
              >
                <SelectTrigger className="w-full text-xs font-medium bg-slate-50/70 border-slate-200 hover:bg-slate-100/70">
                  <SelectValue placeholder="Selecione a Empresa ou Grupo" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectEmpresaOuGrupoItems todasEntidades={todasEntidades} empresas={empresas} />
                </SelectContent>
              </Select>
            </div>

            {/* Seletor de Tipo de Período (MÊS ou ANO) */}
            <div>
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                Horizonte de Análise
              </label>
              <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                <button
                  type="button"
                  onClick={() => setPeriodoTipo('mes')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                    periodoTipo === 'mes'
                      ? 'bg-white text-blue-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Visão Mês a Mês
                </button>
                <button
                  type="button"
                  onClick={() => setPeriodoTipo('ano')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                    periodoTipo === 'ano'
                      ? 'bg-white text-blue-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Exercício Completo (Ano)
                </button>
              </div>
            </div>

            {/* Seletor de Mês (apenas quando períodoTipo === 'mes') */}
            {periodoTipo === 'mes' && (
              <div className="w-40">
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 block">
                  Mês de Referência
                </label>
                <Select
                  value={String(selectedMes)}
                  onValueChange={(val) => setSelectedMes(Number(val))}
                >
                  <SelectTrigger className="w-full text-xs font-medium bg-slate-50 border-slate-200">
                    <SelectValue placeholder="Selecione o mês" />
                  </SelectTrigger>
                  <SelectContent>
                    {NOMES_MESES.map((m) => (
                      <SelectItem key={m.valor} value={String(m.valor)} className="text-xs">
                        {m.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Seletor de Exercício (Ano) */}
            <div className="w-32">
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 block">
                Exercício
              </label>
              <Select
                value={String(selectedAno)}
                onValueChange={(val) => setSelectedAno(Number(val))}
              >
                <SelectTrigger className="w-full text-xs font-medium bg-slate-50 border-slate-200">
                  <SelectValue placeholder="Ano" />
                </SelectTrigger>
                <SelectContent>
                  {anosDisponiveis.map((ano) => (
                    <SelectItem key={ano} value={String(ano)} className="text-xs">
                      {ano}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Banner informativo de Alíquotas e Regime Atual */}
          <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-slate-500 font-medium">Entidade:</span>
              <strong className="text-slate-800">{nomeEntidade}</strong>
              <span className="text-slate-300">•</span>
              <span className="text-slate-500 font-medium">Regime Tributário Atual:</span>
              <Badge
                variant="outline"
                className="bg-amber-50 text-amber-900 border-amber-200 font-semibold"
              >
                {regimeAtual}
              </Badge>
            </div>

            {/* Alíquotas da Reforma */}
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className="bg-blue-100 text-blue-900 border-blue-200 text-xs font-semibold">
                CBS Federal: {(CBS_RATE * 100).toFixed(2).replace('.', ',')}%
              </Badge>
              <Badge className="bg-indigo-100 text-indigo-900 border-indigo-200 text-xs font-semibold">
                IBS Subnacional: {(IBS_RATE * 100).toFixed(2).replace('.', ',')}%
              </Badge>
              <Badge className="bg-slate-900 text-white text-xs font-bold">
                Alíquota Combinada: {(ALIQUOTA_COMBINADA_RATE * 100).toFixed(2).replace('.', ',')}%
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. Cards de KPI Principais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {/* KPI 1: Saídas (Receita DRE) */}
        <Card className="rounded-xl border-slate-200 bg-white p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">
              Saídas (Receita DRE)
            </span>
            <TrendingUp className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-lg font-extrabold text-[#0B1F3A] tracking-tight">
            {formatBrl(resultado.receitaBrutaSaidas)}
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Base geradora de débitos</p>
        </Card>

        {/* KPI 2: Entradas CC-018 */}
        <Card className="rounded-xl border-slate-200 bg-white p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">
              Entradas ({CENTRO_CUSTO_ENTRADAS_CODIGO})
            </span>
            <Layers className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-lg font-extrabold text-[#0B1F3A] tracking-tight">
            {formatBrl(resultado.entradasCC018)}
          </div>
          <div className="flex items-center gap-1 text-[10px] text-slate-500 mt-1 truncate">
            <span>{resultado.totalLancamentosCC018} lançamentos</span>
            {resultado.centroCustoNome && (
              <span className="truncate">· {resultado.centroCustoNome}</span>
            )}
          </div>
        </Card>

        {/* KPI 3: Débito Total (CBS + IBS) */}
        <Card className="rounded-xl border-slate-200 bg-white p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Débitos Fiscais</span>
            <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-1 py-0.2 rounded border border-rose-200">
              26,48%
            </span>
          </div>
          <div className="text-lg font-extrabold text-rose-700 tracking-tight">
            {formatBrl(resultado.totalDebitos)}
          </div>
          <p className="text-[10px] text-slate-500 mt-1">
            CBS: {formatBrl(resultado.cbs.debito)} • IBS: {formatBrl(resultado.ibs.debito)}
          </p>
        </Card>

        {/* KPI 4: Crédito Total (CBS + IBS) */}
        <Card className="rounded-xl border-slate-200 bg-white p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Créditos CC-018</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-lg font-extrabold text-emerald-700 tracking-tight">
            {formatBrl(resultado.totalCreditos)}
          </div>
          <p className="text-[10px] text-slate-500 mt-1">
            CBS: {formatBrl(resultado.cbs.credito)} • IBS: {formatBrl(resultado.ibs.credito)}
          </p>
        </Card>

        {/* KPI 5: Saldo Líquido (Débito - Crédito) com cor condicional */}
        <Card
          className={`rounded-xl p-3.5 shadow-xs border ${
            resultado.tipoSaldo === 'a_recolher'
              ? 'border-rose-200 bg-rose-50/40'
              : 'border-emerald-200 bg-emerald-50/40'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
              {resultado.tipoSaldo === 'a_recolher' ? 'Saldo a Recolher' : 'Saldo a Compensar'}
            </span>
            {resultado.tipoSaldo === 'a_recolher' ? (
              <TrendingUp className="w-4 h-4 text-rose-600" />
            ) : (
              <TrendingDown className="w-4 h-4 text-emerald-600" />
            )}
          </div>
          <div
            className={`text-lg font-extrabold tracking-tight ${
              resultado.tipoSaldo === 'a_recolher' ? 'text-rose-700' : 'text-emerald-700'
            }`}
          >
            {formatBrl(Math.abs(resultado.saldoLiquido))}
          </div>
          <p className="text-[10px] text-slate-600 mt-1">
            {resultado.tipoSaldo === 'a_recolher'
              ? 'Imposto líquido a recolher aos cofres públicos'
              : 'Crédito acumulado para compensação'}
          </p>
        </Card>

        {/* KPI 6: Carga Efetiva sobre a Receita */}
        <Card className="rounded-xl border-slate-200 bg-white p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Carga Efetiva</span>
            <Calculator className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-lg font-extrabold text-indigo-900 tracking-tight">
            {formatPercent(resultado.cargaEfetivaPercent)}
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Saldo líquido ÷ Receita bruta</p>
        </Card>
      </div>

      {/* 4. Tabela de Confronto por Tributo: CBS e IBS Lado a Lado */}
      <Card className="rounded-xl border-slate-200 bg-white shadow-xs overflow-hidden">
        <CardHeader className="bg-slate-50/70 border-b border-slate-100 py-3.5 px-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
                <Scale className="w-4 h-4 text-indigo-600" />
                Quadro de Apuração Não-Cumulativa por Tributo (CBS & IBS)
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 mt-0.5">
                Confronto de Débitos sobre Saídas versus Créditos sobre Entradas do Centro de Custo{' '}
                {CENTRO_CUSTO_ENTRADAS_CODIGO}
              </CardDescription>
            </div>
            <Badge variant="outline" className="bg-white text-slate-700 border-slate-300 text-xs">
              {resultado.descricaoPeriodo}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-2.5 px-4 text-left">Tributo / Esfera</th>
                  <th className="py-2.5 px-3 text-center">Alíquota de Ref.</th>
                  <th className="py-2.5 px-3 text-right">Base Saídas (Receita)</th>
                  <th className="py-2.5 px-3 text-right text-rose-700">Débito Apurado</th>
                  <th className="py-2.5 px-3 text-right">Base Entradas (CC-018)</th>
                  <th className="py-2.5 px-3 text-right text-emerald-700">Crédito Tomado</th>
                  <th className="py-2.5 px-4 text-right">Saldo Líquido</th>
                  <th className="py-2.5 px-3 text-center">Situação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {/* Linha CBS */}
                <tr className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-4 font-semibold text-[#0B1F3A]">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-600" />
                      <div>
                        <div className="font-bold text-xs">{resultado.cbs.tributo}</div>
                        <div className="text-[10px] text-slate-500">
                          Contribuição sobre Bens e Serviços (Federal)
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-center font-bold text-blue-700 bg-blue-50/40">
                    {resultado.cbs.aliquotaFormatada}
                  </td>
                  <td className="py-3 px-3 text-right font-medium text-slate-800">
                    {formatBrl(resultado.cbs.baseSaidas)}
                  </td>
                  <td className="py-3 px-3 text-right font-bold text-rose-700">
                    {formatBrl(resultado.cbs.debito)}
                  </td>
                  <td className="py-3 px-3 text-right font-medium text-slate-800">
                    {formatBrl(resultado.cbs.baseEntradas)}
                  </td>
                  <td className="py-3 px-3 text-right font-bold text-emerald-700">
                    {formatBrl(resultado.cbs.credito)}
                  </td>
                  <td className="py-3 px-4 text-right font-extrabold text-sm">
                    <span
                      className={
                        resultado.cbs.tipoSaldo === 'a_recolher'
                          ? 'text-rose-700'
                          : 'text-emerald-700'
                      }
                    >
                      {formatBrl(resultado.cbs.saldoLiquido)}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <Badge
                      className={`text-[10px] font-bold ${
                        resultado.cbs.tipoSaldo === 'a_recolher'
                          ? 'bg-rose-100 text-rose-800 border-rose-200'
                          : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                      }`}
                    >
                      {resultado.cbs.tipoSaldo === 'a_recolher' ? 'A Recolher' : 'Saldo Credor'}
                    </Badge>
                  </td>
                </tr>

                {/* Linha IBS */}
                <tr className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-4 font-semibold text-[#0B1F3A]">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-indigo-600" />
                      <div>
                        <div className="font-bold text-xs">{resultado.ibs.tributo}</div>
                        <div className="text-[10px] text-slate-500">
                          Imposto sobre Bens e Serviços (Estadual & Municipal)
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-center font-bold text-indigo-700 bg-indigo-50/40">
                    {resultado.ibs.aliquotaFormatada}
                  </td>
                  <td className="py-3 px-3 text-right font-medium text-slate-800">
                    {formatBrl(resultado.ibs.baseSaidas)}
                  </td>
                  <td className="py-3 px-3 text-right font-bold text-rose-700">
                    {formatBrl(resultado.ibs.debito)}
                  </td>
                  <td className="py-3 px-3 text-right font-medium text-slate-800">
                    {formatBrl(resultado.ibs.baseEntradas)}
                  </td>
                  <td className="py-3 px-3 text-right font-bold text-emerald-700">
                    {formatBrl(resultado.ibs.credito)}
                  </td>
                  <td className="py-3 px-4 text-right font-extrabold text-sm">
                    <span
                      className={
                        resultado.ibs.tipoSaldo === 'a_recolher'
                          ? 'text-rose-700'
                          : 'text-emerald-700'
                      }
                    >
                      {formatBrl(resultado.ibs.saldoLiquido)}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <Badge
                      className={`text-[10px] font-bold ${
                        resultado.ibs.tipoSaldo === 'a_recolher'
                          ? 'bg-rose-100 text-rose-800 border-rose-200'
                          : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                      }`}
                    >
                      {resultado.ibs.tipoSaldo === 'a_recolher' ? 'A Recolher' : 'Saldo Credor'}
                    </Badge>
                  </td>
                </tr>

                {/* Linha Total Consolidada */}
                <tr className="bg-slate-100/90 font-bold border-t-2 border-slate-300">
                  <td className="py-3.5 px-4 text-slate-900 font-extrabold uppercase tracking-wide">
                    TOTAL CONSOLIDADO (CBS + IBS)
                  </td>
                  <td className="py-3.5 px-3 text-center text-slate-900 font-extrabold bg-slate-200/60">
                    {(ALIQUOTA_COMBINADA_RATE * 100).toFixed(2).replace('.', ',')}%
                  </td>
                  <td className="py-3.5 px-3 text-right text-slate-900 font-bold">
                    {formatBrl(resultado.receitaBrutaSaidas)}
                  </td>
                  <td className="py-3.5 px-3 text-right text-rose-800 font-extrabold">
                    {formatBrl(resultado.totalDebitos)}
                  </td>
                  <td className="py-3.5 px-3 text-right text-slate-900 font-bold">
                    {formatBrl(resultado.entradasCC018)}
                  </td>
                  <td className="py-3.5 px-3 text-right text-emerald-800 font-extrabold">
                    {formatBrl(resultado.totalCreditos)}
                  </td>
                  <td className="py-3.5 px-4 text-right font-black text-base">
                    <span
                      className={
                        resultado.tipoSaldo === 'a_recolher' ? 'text-rose-700' : 'text-emerald-700'
                      }
                    >
                      {formatBrl(resultado.saldoLiquido)}
                    </span>
                  </td>
                  <td className="py-3.5 px-3 text-center">
                    <Badge
                      className={`text-xs font-black uppercase px-2 py-0.5 ${
                        resultado.tipoSaldo === 'a_recolher'
                          ? 'bg-rose-600 text-white'
                          : 'bg-emerald-600 text-white'
                      }`}
                    >
                      {resultado.tipoSaldo === 'a_recolher' ? 'A Recolher' : 'Saldo Credor'}
                    </Badge>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 5. Detalhamento Mensal (Exibido na visão por ANO ou quando houver meses gerados) */}
      {periodoTipo === 'ano' && resultado.meses && resultado.meses.length > 0 && (
        <Card className="rounded-xl border-slate-200 bg-white shadow-xs overflow-hidden">
          <CardHeader className="bg-slate-50/70 border-b border-slate-100 py-3.5 px-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <CardTitle className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  Evolução Mensal da Reforma Tributária — {selectedAno}
                </CardTitle>
                <CardDescription className="text-xs text-slate-500 mt-0.5">
                  Apuração mês a mês dos 12 meses do exercício: saídas da DRE, entradas do CC-018 e
                  saldo líquido
                </CardDescription>
              </div>
              <Badge variant="outline" className="bg-white text-slate-600 text-xs font-semibold">
                12 Meses
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-2 px-3 text-left">Mês</th>
                    <th className="py-2 px-3 text-right">Receita Saídas</th>
                    <th className="py-2 px-3 text-right">Entradas CC-018</th>
                    <th className="py-2 px-3 text-right text-rose-700">Débito CBS (8,8%)</th>
                    <th className="py-2 px-3 text-right text-emerald-700">Crédito CBS</th>
                    <th className="py-2 px-3 text-right text-rose-700">Débito IBS (17,68%)</th>
                    <th className="py-2 px-3 text-right text-emerald-700">Crédito IBS</th>
                    <th className="py-2 px-3 text-right font-bold">Débito Total</th>
                    <th className="py-2 px-3 text-right font-bold">Crédito Total</th>
                    <th className="py-2 px-3 text-right font-extrabold">Saldo Líquido</th>
                    <th className="py-2 px-3 text-center">Carga Ef.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {resultado.meses.map((m) => {
                    const hasMovimento = m.receitaSaidas > 0 || m.entradasCC018 > 0
                    return (
                      <tr
                        key={m.mesChave}
                        className={`hover:bg-slate-50/70 transition-colors ${!hasMovimento ? 'text-slate-400 bg-slate-50/20' : ''}`}
                      >
                        <td className="py-2 px-3 font-bold text-slate-800">{m.rotuloCurto}</td>
                        <td className="py-2 px-3 text-right font-medium">
                          {formatBrl(m.receitaSaidas)}
                        </td>
                        <td className="py-2 px-3 text-right font-medium">
                          {formatBrl(m.entradasCC018)}
                        </td>
                        <td className="py-2 px-3 text-right text-rose-700 font-medium">
                          {formatBrl(m.cbs.debito)}
                        </td>
                        <td className="py-2 px-3 text-right text-emerald-700 font-medium">
                          {formatBrl(m.cbs.credito)}
                        </td>
                        <td className="py-2 px-3 text-right text-rose-700 font-medium">
                          {formatBrl(m.ibs.debito)}
                        </td>
                        <td className="py-2 px-3 text-right text-emerald-700 font-medium">
                          {formatBrl(m.ibs.credito)}
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-slate-900">
                          {formatBrl(m.totalDebitos)}
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-slate-900">
                          {formatBrl(m.totalCreditos)}
                        </td>
                        <td className="py-2 px-3 text-right font-extrabold">
                          <span
                            className={
                              m.tipoSaldo === 'a_recolher' ? 'text-rose-700' : 'text-emerald-700'
                            }
                          >
                            {formatBrl(m.saldoLiquido)}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-center font-bold text-indigo-900">
                          {formatPercent(m.cargaEfetivaPercent)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 font-bold border-t-2 border-slate-300 text-slate-900">
                    <td className="py-2.5 px-3 uppercase font-extrabold">Total {selectedAno}</td>
                    <td className="py-2.5 px-3 text-right">
                      {formatBrl(resultado.receitaBrutaSaidas)}
                    </td>
                    <td className="py-2.5 px-3 text-right">{formatBrl(resultado.entradasCC018)}</td>
                    <td className="py-2.5 px-3 text-right text-rose-800">
                      {formatBrl(resultado.cbs.debito)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-emerald-800">
                      {formatBrl(resultado.cbs.credito)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-rose-800">
                      {formatBrl(resultado.ibs.debito)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-emerald-800">
                      {formatBrl(resultado.ibs.credito)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-black">
                      {formatBrl(resultado.totalDebitos)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-black">
                      {formatBrl(resultado.totalCreditos)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-black text-sm">
                      <span
                        className={
                          resultado.tipoSaldo === 'a_recolher'
                            ? 'text-rose-700'
                            : 'text-emerald-700'
                        }
                      >
                        {formatBrl(resultado.saldoLiquido)}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center font-black text-indigo-900">
                      {formatPercent(resultado.cargaEfetivaPercent)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 6. Parecer Técnico e Base Legal */}
      <Card className="rounded-xl border-slate-200 bg-slate-50/60 p-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 mt-0.5">
            <Info className="w-4 h-4" />
          </div>
          <div className="space-y-1.5 text-xs text-slate-600">
            <h4 className="font-bold text-[#0B1F3A]">
              Critérios Técnicos da Apuração da Reforma Tributária (LC 214/2025)
            </h4>
            <p className="leading-relaxed">
              • <strong>Débito sobre Saídas:</strong> calculado sobre a receita bruta mensal da DRE
              Gerencial de <strong>{nomeEntidade}</strong>, garantindo total integridade com o
              demonstrativo contábil.
            </p>
            <p className="leading-relaxed">
              • <strong>Crédito sobre Entradas:</strong> calculado exclusivamente a partir dos
              lançamentos vinculados ao Centro de Custo{' '}
              <strong>{CENTRO_CUSTO_ENTRADAS_CODIGO}</strong>{' '}
              {resultado.centroCustoNome ? `(${resultado.centroCustoNome})` : ''}, refletindo as
              compras e aquisições operacionais passíveis de apropriação de crédito.
            </p>
            <p className="leading-relaxed">
              • <strong>Não-Cumulatividade Plena:</strong> o saldo líquido representa o valor a
              recolher (quando os débitos superam os créditos) ou saldo credor acumulado passível de
              compensação futura.
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}
