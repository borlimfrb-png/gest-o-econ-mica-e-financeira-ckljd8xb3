import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useFilter } from '@/contexts/FilterContext'
import { useMinhaEmpresa } from '@/contexts/MinhaEmpresaContext'
import { balancosService, dreService } from '@/services/financeService'
import type { BalancoRecord, DreRecord } from '@/types/finance'
import {
  compararRegimesTributarios,
  type AnaliseTributariaResultado,
  type RegimeResultado,
} from '@/lib/taxCalculations'
import { formatCurrency, formatPercent, formatCnpj, calcularDre } from '@/lib/financeCalculations'
import { useRealtime } from '@/hooks/use-realtime'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Cell,
  Legend,
} from 'recharts'
import {
  Calculator,
  Building2,
  Calendar,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Award,
  AlertTriangle,
  Info,
  Printer,
  FileSpreadsheet,
  CheckCircle2,
  HelpCircle,
  Percent,
  ArrowRight,
  ShieldAlert,
  Layers,
  Scale,
  DollarSign,
  AlertCircle,
  RotateCcw,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export default function AnaliseTributaria() {
  const {
    empresas,
    selectedEmpresaId,
    setSelectedEmpresaId,
    selectedAno,
    setSelectedAno,
    anosDisponiveis,
    selectedEmpresa,
  } = useFilter()

  const { minhaEmpresa, logoUrl, corPrimaria, corSecundaria } = useMinhaEmpresa()
  const { toast } = useToast()

  const [balancos, setBalancos] = useState<BalancoRecord[]>([])
  const [dres, setDres] = useState<DreRecord[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(false)

  // Configuração interativa do usuário
  const [aliquotaIss, setAliquotaIss] = useState<number>(5.0)
  const [folhaPercentual, setFolhaPercentual] = useState<number>(25.0) // 25% da receita bruta
  const [mostrarBreakdownCompleto, setMostrarBreakdownCompleto] = useState<boolean>(false)

  // Carregar dados de Balanço e DRE
  const loadData = async () => {
    if (!selectedEmpresaId) return
    try {
      setIsLoading(true)
      const [bList, dList] = await Promise.all([
        balancosService.getByEmpresa(selectedEmpresaId),
        dreService.getByEmpresa(selectedEmpresaId),
      ])
      setBalancos(bList)
      setDres(dList)
    } catch (error) {
      console.error('Erro ao carregar dados financeiros para análise tributária:', error)
      toast({
        title: 'Erro ao carregar dados',
        description: 'Não foi possível carregar os dados de balanço e DRE da empresa.',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [selectedEmpresaId])

  // Realtime updates
  useRealtime<BalancoRecord>('balancos', () => {
    if (selectedEmpresaId) loadData()
  })
  useRealtime<DreRecord>('dre', () => {
    if (selectedEmpresaId) loadData()
  })

  // DRE e Balanço do ano selecionado
  const balancoAtual = useMemo(() => {
    return balancos.find((b) => b.ano === selectedAno) || null
  }, [balancos, selectedAno])

  const dreAtual = useMemo(() => {
    return dres.find((d) => d.ano === selectedAno) || null
  }, [dres, selectedAno])

  // Cálculo financeiro base
  const dreCalculado = useMemo(() => {
    return calcularDre(dreAtual)
  }, [dreAtual])

  const receitaBruta = dreAtual?.receita_bruta || 0
  const lucroLiquido = dreCalculado.lucroLiquido || 0
  const folhaEstimada = receitaBruta * (folhaPercentual / 100)

  // Comparativo dos regimes
  const analise: AnaliseTributariaResultado = useMemo(() => {
    return compararRegimesTributarios({
      ano: selectedAno,
      receitaBruta,
      lucroLiquido,
      folhaPagamento: folhaEstimada,
      aliquotaIssPercent: aliquotaIss,
    })
  }, [selectedAno, receitaBruta, lucroLiquido, folhaEstimada, aliquotaIss])

  const temDadosAno = !!dreAtual && receitaBruta > 0

  // Dados para o Gráfico de Barras do Recharts
  const chartData = useMemo(() => {
    return [
      {
        regime: 'Simples Nacional',
        imposto: analise.regimes.simples.impostoTotal,
        aliquota: analise.regimes.simples.aliquotaEfetiva,
        cor: analise.regimes.simples.isRecomendado ? '#10b981' : '#3b82f6',
        isRecomendado: analise.regimes.simples.isRecomendado,
      },
      {
        regime: 'Lucro Presumido',
        imposto: analise.regimes.presumido.impostoTotal,
        aliquota: analise.regimes.presumido.aliquotaEfetiva,
        cor: analise.regimes.presumido.isRecomendado ? '#10b981' : '#6366f1',
        isRecomendado: analise.regimes.presumido.isRecomendado,
      },
      {
        regime: 'Lucro Real',
        imposto: analise.regimes.real.impostoTotal,
        aliquota: analise.regimes.real.aliquotaEfetiva,
        cor: analise.regimes.real.isRecomendado ? '#10b981' : '#f59e0b',
        isRecomendado: analise.regimes.real.isRecomendado,
      },
    ]
  }, [analise])

  // Exportar / Imprimir PDF da Análise
  const handlePrint = () => {
    window.print()
  }

  // Exportar CSV
  const handleExportCsv = () => {
    if (!selectedEmpresa) return

    let csv = '\uFEFF'
    csv += `RELATÓRIO DE ANÁLISE TRIBUTÁRIA E PLANEJAMENTO FISCAL\n`
    csv += `Empresa;${selectedEmpresa.nome}\n`
    csv += `CNPJ;${formatCnpj(selectedEmpresa.cnpj)}\n`
    csv += `Exercício Analisado;${selectedAno}\n`
    csv += `Data de Emissão;${new Date().toLocaleDateString('pt-BR')}\n`
    csv += `Alíquota ISS Aplicada;${aliquotaIss.toFixed(2)}%\n`
    csv += `Receita Bruta Anual;${formatCurrency(receitaBruta)}\n`
    csv += `Lucro Líquido Contábil;${formatCurrency(lucroLiquido)}\n\n`

    csv += `COMPARATIVO DOS REGIMES TRIBUTÁRIOS\n`
    csv += `Regime;Alíquota Efetiva;Imposto Total Estimado;Economia vs Pior;Recomendado?\n`
    csv += `Simples Nacional;${formatPercent(analise.regimes.simples.aliquotaEfetiva, 2)};${formatCurrency(analise.regimes.simples.impostoTotal)};${formatCurrency(analise.regimes.simples.economiaVsPior)};${analise.regimes.simples.isRecomendado ? 'SIM (Recomendado)' : 'Não'}\n`
    csv += `Lucro Presumido;${formatPercent(analise.regimes.presumido.aliquotaEfetiva, 2)};${formatCurrency(analise.regimes.presumido.impostoTotal)};${formatCurrency(analise.regimes.presumido.economiaVsPior)};${analise.regimes.presumido.isRecomendado ? 'SIM (Recomendado)' : 'Não'}\n`
    csv += `Lucro Real;${formatPercent(analise.regimes.real.aliquotaEfetiva, 2)};${formatCurrency(analise.regimes.real.impostoTotal)};${formatCurrency(analise.regimes.real.economiaVsPior)};${analise.regimes.real.isRecomendado ? 'SIM (Recomendado)' : 'Não'}\n\n`

    csv += `BREAKDOWN DETALHADO POR REGIME\n`
    const regimesList = [analise.regimes.simples, analise.regimes.presumido, analise.regimes.real]
    for (const r of regimesList) {
      csv += `\n--- ${r.nome.toUpperCase()} ---\n`
      csv += `Tributo;Base de Cálculo (R$);Alíquota Nominal (%);Valor Estimado (R$);Descrição\n`
      r.breakdown.forEach((item) => {
        csv += `${item.nome} (${item.sigla});${formatCurrency(item.baseCalculo)};${formatPercent(item.aliquotaNominal, 2)};${formatCurrency(item.valor)};"${item.descricao || ''}"\n`
      })
      csv += `TOTAL DO REGIME;;;${formatCurrency(r.impostoTotal)};\n`
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.setAttribute(
      'download',
      `analise_tributaria_${selectedEmpresa.nome.toLowerCase().replace(/\s+/g, '_')}_${selectedAno}.csv`,
    )
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    toast({
      title: 'Exportação Concluída',
      description: 'O arquivo CSV da Análise Tributária foi gerado com sucesso.',
    })
  }

  // Helper para renderizar card individual de regime
  const renderCardRegime = (regime: RegimeResultado) => {
    const isRec = regime.isRecomendado && temDadosAno
    const isSimplesAcimaDoTeto = regime.id === 'simples' && receitaBruta > 4800000

    return (
      <div
        key={regime.id}
        className={`relative rounded-2xl transition-all duration-200 flex flex-col justify-between ${
          isRec
            ? 'bg-emerald-50/60 border-2 border-emerald-500 shadow-md ring-4 ring-emerald-500/10'
            : 'bg-white border border-slate-200 shadow-xs hover:border-slate-300'
        }`}
      >
        {/* Badge Flutuante de Recomendado */}
        {isRec && (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-bold bg-emerald-600 text-white shadow-md uppercase tracking-wider">
              <Award className="w-3.5 h-3.5" />🏆 Regime Recomendado
            </span>
          </div>
        )}

        {/* Cabeçalho do Card */}
        <div className={`p-5 sm:p-6 ${isRec ? 'pt-7' : ''} border-b border-slate-100 flex-1`}>
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <h3 className="text-lg font-bold text-[#0B1F3A] flex items-center gap-2">
                {regime.nome}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{regime.descricao}</p>
            </div>
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                isRec ? 'bg-emerald-500 text-white shadow-xs' : 'bg-slate-100 text-slate-600'
              }`}
            >
              <Calculator className="w-4 h-4" />
            </div>
          </div>

          {/* Aviso se ultrapassou o teto do Simples */}
          {isSimplesAcimaDoTeto && (
            <div className="mb-4 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
              <span>
                <strong>Atenção:</strong> Receita anual superior a R$ 4,8 milhões desenquadra a
                empresa do Simples Nacional obrigatoriamente.
              </span>
            </div>
          )}

          {/* Destaque Alíquota Efetiva e Total Estimado */}
          <div className="my-4 pt-2">
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Alíquota Efetiva Total
              </span>
              <span className="text-xs text-slate-400 font-medium">sobre a Receita</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span
                className={`text-3xl sm:text-4xl font-extrabold tracking-tight ${
                  isRec ? 'text-emerald-700' : 'text-slate-800'
                }`}
              >
                {temDadosAno ? formatPercent(regime.aliquotaEfetiva, 2) : '0,00%'}
              </span>
              {isRec && (
                <Badge
                  variant="outline"
                  className="bg-emerald-100 text-emerald-800 border-emerald-300 font-bold text-[11px]"
                >
                  Menor Carga
                </Badge>
              )}
            </div>
          </div>

          {/* Valor em Reais do Imposto Anual */}
          <div className="p-3.5 rounded-xl bg-slate-50/90 border border-slate-200/80 mb-4">
            <div className="text-[11px] font-semibold text-slate-500 mb-0.5">
              Imposto Estimado Anual
            </div>
            <div className={`text-xl font-bold ${isRec ? 'text-emerald-700' : 'text-[#0B1F3A]'}`}>
              {temDadosAno ? formatCurrency(regime.impostoTotal) : 'R$ 0,00'}
            </div>
            <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
              <span>Mensal Estimado:</span>
              <span className="font-semibold text-slate-700">
                {temDadosAno ? formatCurrency(regime.impostoTotal / 12) : 'R$ 0,00'}
              </span>
            </div>
          </div>

          {/* Comparativo de Economia */}
          {temDadosAno && (
            <div className="mb-4 space-y-1.5">
              {regime.economiaVsPior > 0 ? (
                <div className="p-2.5 rounded-lg bg-emerald-100/70 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-emerald-700 shrink-0" />
                  <div>
                    <span className="font-semibold">Economia vs Pior Regime:</span>{' '}
                    <span className="font-bold text-emerald-800">
                      {formatCurrency(regime.economiaVsPior)}/ano
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <div>
                    <span className="font-semibold">Pior cenário tributário:</span>{' '}
                    <span>Maior carga fiscal do exercício</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tabela Compacta de Breakdown */}
          <div className="mt-4 pt-3 border-t border-slate-100">
            <div className="text-xs font-bold text-slate-700 mb-2 flex items-center justify-between">
              <span>Composição dos Tributos</span>
              <span className="text-[10px] text-slate-400 font-normal">Base & Alíq.</span>
            </div>
            <div className="space-y-1.5">
              {regime.breakdown.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between text-xs py-1 px-1.5 rounded-md hover:bg-slate-100/60 transition-colors"
                >
                  <div className="flex flex-col">
                    <span className="font-medium text-slate-700">{item.sigla}</span>
                    <span className="text-[10px] text-slate-400">{item.nome}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-semibold text-slate-900 block">
                      {temDadosAno ? formatCurrency(item.valor) : 'R$ 0,00'}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {temDadosAno ? formatPercent(item.aliquotaNominal, 2) : '0%'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer do Card com Base de Cálculo */}
        <div className="p-4 bg-slate-50/70 border-t border-slate-100 rounded-b-2xl text-[11px] text-slate-500">
          <div className="flex items-center justify-between">
            <span>
              Base Principal (
              {regime.id === 'real'
                ? 'Lucro Real'
                : regime.id === 'presumido'
                  ? 'Lucro Presumido'
                  : 'Receita Bruta'}
              ):
            </span>
            <span className="font-semibold text-slate-700">
              {temDadosAno ? formatCurrency(regime.baseCalculoPrincipal) : 'R$ 0,00'}
            </span>
          </div>
          {regime.detalhesCalculo.faixaSimples && (
            <div className="flex items-center justify-between mt-1 text-slate-500">
              <span>Faixa Aplicada:</span>
              <span className="font-medium text-slate-700 truncate max-w-[170px]">
                {regime.detalhesCalculo.faixaSimples}
              </span>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* 1. Header com Título, Seletores e Ações */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-[#0B1F3A] tracking-tight">
                Análise Tributária e Planejamento Fiscal
              </h1>
              <p className="text-xs sm:text-sm text-slate-500">
                Simulador comparativo de regimes (Simples Nacional, Lucro Presumido e Lucro Real)
                com base no Balanço e DRE
              </p>
            </div>
          </div>
        </div>

        {/* Controles de Empresa, Ano, ISS e Ações */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Seletor Empresa */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs shadow-2xs">
            <Building2 className="w-4 h-4 text-blue-600 shrink-0" />
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-400 font-semibold uppercase">Empresa</span>
              <Select value={selectedEmpresaId} onValueChange={(id) => setSelectedEmpresaId(id)}>
                <SelectTrigger className="h-6 border-none shadow-none bg-transparent text-xs font-bold text-slate-800 p-0 focus:ring-0 w-[180px]">
                  <SelectValue placeholder="Selecione a empresa" />
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
          </div>

          {/* Seletor Ano */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs shadow-2xs">
            <Calendar className="w-4 h-4 text-blue-600 shrink-0" />
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-400 font-semibold uppercase">Exercício</span>
              <Select
                value={String(selectedAno)}
                onValueChange={(val) => setSelectedAno(Number(val))}
              >
                <SelectTrigger className="h-6 border-none shadow-none bg-transparent text-xs font-bold text-slate-800 p-0 focus:ring-0 w-[70px]">
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

          {/* Campo Alíquota ISS configurável */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs shadow-2xs">
            <Percent className="w-4 h-4 text-emerald-600 shrink-0" />
            <div className="flex flex-col">
              <label
                htmlFor="aliquota-iss"
                className="text-[10px] text-slate-400 font-semibold uppercase cursor-pointer"
              >
                Alíquota ISS (%)
              </label>
              <div className="flex items-center gap-1">
                <input
                  id="aliquota-iss"
                  type="number"
                  min="2"
                  max="5"
                  step="0.5"
                  value={aliquotaIss}
                  onChange={(e) => setAliquotaIss(parseFloat(e.target.value) || 0)}
                  className="w-12 h-6 bg-transparent text-xs font-bold text-slate-800 border-none p-0 focus:outline-hidden focus:ring-0"
                />
                <span className="text-[11px] font-semibold text-slate-500">%</span>
              </div>
            </div>
          </div>

          {/* Botões de Ação: Exportar CSV e Imprimir/PDF */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              disabled={!temDadosAno}
              className="h-10 text-xs font-semibold border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl gap-1.5"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              Exportar CSV
            </Button>
            <Button
              size="sm"
              onClick={handlePrint}
              disabled={!temDadosAno}
              className="h-10 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs gap-1.5"
            >
              <Printer className="w-4 h-4" />
              Exportar Análise (PDF)
            </Button>
          </div>
        </div>
      </div>

      {/* 2. Banner de Resumo da Empresa Selecionada com Dados Contábeis */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium mb-1">
            <span>Receita Bruta (DRE)</span>
            <DollarSign className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-xl font-extrabold text-[#0B1F3A]">
            {temDadosAno ? formatCurrency(receitaBruta) : 'R$ 0,00'}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Base anual para faturamento</div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium mb-1">
            <span>Lucro Líquido (DRE)</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div
            className={`text-xl font-extrabold ${
              lucroLiquido >= 0 ? 'text-emerald-700' : 'text-red-600'
            }`}
          >
            {temDadosAno ? formatCurrency(lucroLiquido) : 'R$ 0,00'}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Margem Líquida:{' '}
            {receitaBruta > 0 ? formatPercent((lucroLiquido / receitaBruta) * 100, 1) : '—'}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium mb-1">
            <span>Folha de Pagamento Estimada</span>
            <Layers className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-xl font-extrabold text-[#0B1F3A]">
            {temDadosAno ? formatCurrency(folhaEstimada) : 'R$ 0,00'}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Estimada em {folhaPercentual}% da receita
          </div>
        </div>

        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-emerald-800 font-semibold mb-1">
            <span>Economia Tributária Máxima</span>
            <Sparkles className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl font-extrabold text-emerald-700">
            {temDadosAno ? formatCurrency(analise.economiaMaximaAnual) : 'R$ 0,00'}
          </div>
          <div className="text-[11px] text-emerald-700 mt-1">
            {temDadosAno && analise.regimeRecomendado
              ? `Optando por ${analise.regimeRecomendado.nome}`
              : 'Sem dados calculados'}
          </div>
        </div>
      </div>

      {/* 3. Se a empresa não tiver dados cadastrados para o ano */}
      {!temDadosAno && (
        <Card className="border-amber-200 bg-amber-50/80 p-8 text-center rounded-2xl shadow-xs">
          <div className="max-w-md mx-auto flex flex-col items-center">
            <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mb-4">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-amber-900 mb-2">
              Dados Financeiros Ausentes no Exercício {selectedAno}
            </h3>
            <p className="text-sm text-amber-800 leading-relaxed mb-6">
              Esta empresa não possui dados de balanço ou DRE cadastrados para o ano de{' '}
              {selectedAno}. Cadastre os lançamentos ou faça a importação do DRE para habilitar a
              análise tributária comparativa completa.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  if (anosDisponiveis.length > 0) {
                    setSelectedAno(anosDisponiveis[0])
                  }
                }}
                className="border-amber-300 text-amber-900 hover:bg-amber-100"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Alternar para Ano Disponível
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* 4. Três Cards Lado a Lado (Desktop) / 2 Colunas (Tablet) / Empilhados (Mobile) */}
      {temDadosAno && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-[#0B1F3A]">
                Comparativo Detalhado dos Três Regimes Tributários
              </h2>
              <p className="text-xs text-slate-500">
                Avaliação direta entre Simples Nacional (Anexo III), Lucro Presumido e Lucro Real
              </p>
            </div>
            <Badge
              variant="outline"
              className="text-xs bg-slate-50 border-slate-200 text-slate-600 hidden sm:inline-flex"
            >
              Simulação para Prestação de Serviços / Consultoria
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
            {renderCardRegime(analise.regimes.simples)}
            {renderCardRegime(analise.regimes.presumido)}
            {renderCardRegime(analise.regimes.real)}
          </div>
        </div>
      )}

      {/* 5. Gráfico de Barras Comparativo com Recharts */}
      {temDadosAno && (
        <Card className="rounded-2xl border-slate-200 bg-white shadow-xs">
          <CardHeader className="pb-3 border-b border-slate-100">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base font-bold text-[#0B1F3A] flex items-center gap-2">
                  <Scale className="w-4 h-4 text-blue-600" />
                  Carga Tributária por Regime (R$ no Ano)
                </CardTitle>
                <CardDescription className="text-xs">
                  Comparação gráfica do montante total de tributos devidos no exercício{' '}
                  {selectedAno}
                </CardDescription>
              </div>
              <div className="flex items-center gap-4 text-xs font-medium">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
                  <span className="text-slate-600">Recomendado</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-slate-400 inline-block" />
                  <span className="text-slate-600">Outros Regimes</span>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis
                    dataKey="regime"
                    tick={{ fill: '#475569', fontSize: 12, fontWeight: 600 }}
                    axisLine={{ stroke: '#CBD5E1' }}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={(val) => `R$ ${(val / 1000).toFixed(0)}k`}
                    tick={{ fill: '#64748B', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <RechartsTooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload
                        return (
                          <div className="bg-[#0B1F3A] text-white p-3.5 rounded-xl shadow-xl text-xs space-y-1.5 border border-blue-900 min-w-[200px]">
                            <p className="font-bold text-sm text-blue-200">{data.regime}</p>
                            <div className="flex justify-between gap-4 text-slate-300">
                              <span>Imposto Total:</span>
                              <span className="font-bold text-white">
                                {formatCurrency(data.imposto)}
                              </span>
                            </div>
                            <div className="flex justify-between gap-4 text-slate-300">
                              <span>Alíquota Efetiva:</span>
                              <span className="font-bold text-emerald-300">
                                {formatPercent(data.aliquota, 2)}
                              </span>
                            </div>
                            {data.isRecomendado && (
                              <p className="pt-1 text-emerald-400 font-bold border-t border-white/10 flex items-center gap-1">
                                <Award className="w-3.5 h-3.5" /> Regime Mais Econômico
                              </p>
                            )}
                          </div>
                        )
                      }
                      return null
                    }}
                  />
                  <Bar dataKey="imposto" radius={[8, 8, 0, 0]} maxBarSize={70}>
                    {chartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.isRecomendado ? '#10b981' : '#64748b'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Veredito do Consultor Tributário */}
            <div className="mt-6 p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 mt-0.5">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[#0B1F3A]">
                    Parecer do Diagnóstico Fiscal
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed mt-0.5">
                    Para o perfil operacional de{' '}
                    <strong className="text-slate-800">{selectedEmpresa?.nome}</strong> em{' '}
                    {selectedAno}, com faturamento de{' '}
                    <strong>{formatCurrency(receitaBruta)}</strong> e lucro contábil de{' '}
                    <strong>{formatCurrency(lucroLiquido)}</strong>, a opção pelo{' '}
                    <strong className="text-emerald-700">{analise.regimeRecomendado?.nome}</strong>{' '}
                    proporciona uma alíquota efetiva de{' '}
                    <strong className="text-emerald-700">
                      {formatPercent(analise.regimeRecomendado?.aliquotaEfetiva, 2)}
                    </strong>
                    , gerando economia anual estimada de{' '}
                    <strong className="text-emerald-700">
                      {formatCurrency(analise.economiaMaximaAnual)}
                    </strong>{' '}
                    frente ao pior cenário ({analise.maiorCustoRegime?.nome}).
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 6. Seção Informativa: Impacto da Reforma Tributária (IBS / CBS) */}
      <Card className="rounded-2xl border-indigo-200 bg-linear-to-br from-indigo-50/70 via-white to-blue-50/60 shadow-xs">
        <CardHeader className="pb-3 border-b border-indigo-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-base font-bold text-[#0B1F3A]">
                Impacto da Reforma Tributária (Emenda Constitucional 132/2023)
              </CardTitle>
              <CardDescription className="text-xs">
                Entenda a transição para o IBS (estados/municípios) e CBS (União) entre 2026 e 2033
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Bloco 1: Transição */}
            <div className="p-4 rounded-xl bg-white border border-indigo-100/90 shadow-2xs">
              <div className="text-xs font-bold text-indigo-900 mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-indigo-600" />
                Período de Transição (2026 – 2033)
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                A substituição de PIS, COFINS, ISS e ICMS pela <strong>CBS</strong> (federal) e{' '}
                <strong>IBS</strong> (estadual/municipal) ocorrerá de forma gradual a partir de
                2026, com extinção completa do modelo atual em 2033.
              </p>
            </div>

            {/* Bloco 2: Alerta para Serviços */}
            <div className="p-4 rounded-xl bg-white border border-amber-200 shadow-2xs">
              <div className="text-xs font-bold text-amber-900 mb-1.5 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                Atenção ao Setor de Serviços
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Como as empresas de serviços possuem baixa cadeia de créditos tributários (pouco
                insumo físico), a alíquota padrão estimada em ~26,5% a 28% poderá representar{' '}
                <strong>elevação de carga fiscal</strong> no Lucro Presumido/Real.
              </p>
            </div>

            {/* Bloco 3: Simples Nacional & Revisão */}
            <div className="p-4 rounded-xl bg-white border border-emerald-200 shadow-2xs">
              <div className="text-xs font-bold text-emerald-900 mb-1.5 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Revisão e Simples Nacional
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                O Simples Nacional foi mantido constitucionalmente, mas as empresas poderão optar
                por recolher o IBS/CBS por fora para transferir créditos a clientes PJ. É essencial
                a <strong>revisão anual da opção tributária</strong>.
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-indigo-100/60 border border-indigo-200/80 text-xs text-indigo-950 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-indigo-700 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong>Recomendação Estratégica:</strong> Mantenha a escrituração contábil
              rigorosamente atualizada. Durante a transição, o planejamento tributário anual prévio
              a cada mês de janeiro definirá ganhos expressivos de competitividade e liquidez para a
              empresa.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 7. Impressão / PDF Container Oculto em Tela, Ativo na Impressão */}
      <div className="hidden print:block font-sans text-slate-900 p-4 space-y-6">
        <div className="border-b-2 border-slate-900 pb-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold uppercase tracking-tight">
              Relatório Executivo de Análise Tributária
            </h1>
            <p className="text-xs text-slate-600">
              Planejamento e Comparativo de Regimes Fiscais · Exercício {selectedAno}
            </p>
          </div>
          <div className="text-right text-xs">
            <p className="font-bold">
              {minhaEmpresa?.nome_fantasia ||
                minhaEmpresa?.razao_social ||
                'Consultoria Financeira'}
            </p>
            <p className="text-slate-500">Emissão: {new Date().toLocaleDateString('pt-BR')}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-xs border p-3 rounded-md bg-slate-50">
          <div>
            <p>
              <strong>Empresa Cliente:</strong> {selectedEmpresa?.nome}
            </p>
            <p>
              <strong>CNPJ:</strong> {formatCnpj(selectedEmpresa?.cnpj || '')}
            </p>
            <p>
              <strong>Segmento:</strong> {selectedEmpresa?.segmento}
            </p>
          </div>
          <div>
            <p>
              <strong>Receita Bruta:</strong> {formatCurrency(receitaBruta)}
            </p>
            <p>
              <strong>Lucro Líquido Contábil:</strong> {formatCurrency(lucroLiquido)}
            </p>
            <p>
              <strong>Alíquota ISS Aplicada:</strong> {aliquotaIss.toFixed(2)}%
            </p>
          </div>
        </div>

        <div>
          <h2 className="text-sm font-bold uppercase mb-2 border-b pb-1">
            Resumo Comparativo dos Regimes
          </h2>
          <table className="w-full text-xs text-left border border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b">
                <th className="p-2 border">Regime</th>
                <th className="p-2 border">Base de Cálculo</th>
                <th className="p-2 border">Alíquota Efetiva</th>
                <th className="p-2 border">Imposto Estimado (Ano)</th>
                <th className="p-2 border">Economia vs Pior</th>
                <th className="p-2 border">Situação</th>
              </tr>
            </thead>
            <tbody>
              {[analise.regimes.simples, analise.regimes.presumido, analise.regimes.real].map(
                (r) => (
                  <tr
                    key={r.id}
                    className={`border-b ${r.isRecomendado ? 'bg-emerald-50 font-bold' : ''}`}
                  >
                    <td className="p-2 border">{r.nome}</td>
                    <td className="p-2 border">{formatCurrency(r.baseCalculoPrincipal)}</td>
                    <td className="p-2 border">{formatPercent(r.aliquotaEfetiva, 2)}</td>
                    <td className="p-2 border">{formatCurrency(r.impostoTotal)}</td>
                    <td className="p-2 border">{formatCurrency(r.economiaVsPior)}</td>
                    <td className="p-2 border">
                      {r.isRecomendado ? '🏆 RECOMENDADO' : 'Opção alternativa'}
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>

        <div className="border p-4 rounded-md bg-slate-50 text-xs space-y-2">
          <h3 className="font-bold uppercase text-slate-800">Conclusão e Parecer Técnico:</h3>
          <p className="leading-relaxed">
            Com base nos dados fornecidos do DRE e Balanço do exercício de {selectedAno},
            recomendamos a adoção do regime <strong>{analise.regimeRecomendado?.nome}</strong> para
            a empresa <strong>{selectedEmpresa?.nome}</strong>. Esta escolha resulta em uma carga
            tributária efetiva de{' '}
            <strong>{formatPercent(analise.regimeRecomendado?.aliquotaEfetiva, 2)}</strong> sobre a
            receita bruta, gerando uma economia estimada de{' '}
            <strong>{formatCurrency(analise.economiaMaximaAnual)}</strong> ao longo do ano quando
            comparada ao regime menos favorável.
          </p>
        </div>

        <div className="pt-12 flex justify-between items-end text-xs">
          <div className="text-center w-64 border-t border-slate-400 pt-1">
            <p className="font-bold">{minhaEmpresa?.contador_nome || 'Consultor Tributário'}</p>
            <p className="text-slate-500">CRC {minhaEmpresa?.contador_crc || 'Ativo'}</p>
          </div>
          <div className="text-center w-64 border-t border-slate-400 pt-1">
            <p className="font-bold">{selectedEmpresa?.nome}</p>
            <p className="text-slate-500">Representante Legal</p>
          </div>
        </div>
      </div>
    </div>
  )
}
