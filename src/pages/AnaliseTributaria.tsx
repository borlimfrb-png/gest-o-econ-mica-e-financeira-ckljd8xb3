import React, { useState, useEffect, useMemo } from 'react'
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
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
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
  Percent,
  ArrowRight,
  ShieldAlert,
  Layers,
  Scale,
  DollarSign,
  AlertCircle,
  RotateCcw,
  SlidersHorizontal,
  History,
  FileText,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { ModalParecerExecutivo } from '@/components/ModalParecerExecutivo'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ModalLancamentoTributario } from '@/components/ModalLancamentoTributario'
import { TabelaLancamentosTributarios } from '@/components/TabelaLancamentosTributarios'
import { PainelApuracaoEntradasSaidas } from '@/components/PainelApuracaoEntradasSaidas'
import { tributosLancamentosService } from '@/services/tributosLancamentosService'
import type {
  TributoLancamentoRecord,
  TributoLancamentoInput,
  TipoLancamentoTributario,
} from '@/types/finance'
import { ShoppingCart } from 'lucide-react'

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

  const { minhaEmpresa, logoUrl } = useMinhaEmpresa()
  const { toast } = useToast()

  const [balancos, setBalancos] = useState<BalancoRecord[]>([])
  const [dres, setDres] = useState<DreRecord[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(false)

  // Configuração interativa do usuário
  const [aliquotaIss, setAliquotaIss] = useState<number>(5.0)
  const [folhaPercentual, setFolhaPercentual] = useState<number>(25.0) // 25% da receita bruta

  // 1. Estados da Simulação de Cenários
  const [varReceitaPercent, setVarReceitaPercent] = useState<number>(0)
  const [varLucroPercent, setVarLucroPercent] = useState<number>(0)

  // 2. Estado do Comparativo com Ano Anterior
  const [compararAnoAnterior, setCompararAnoAnterior] = useState<boolean>(false)
  const anoAnterior = selectedAno - 1

  // 3. Estado do Modal de Parecer Executivo
  const [modalParecerOpen, setModalParecerOpen] = useState<boolean>(false)

  // 4. Estados dos Lançamentos Fiscais (Entradas e Saídas) e Aba Ativa
  const [abaAtiva, setAbaAtiva] = useState<string>('comparativo')
  const [lancamentosTributarios, setLancamentosTributarios] = useState<TributoLancamentoRecord[]>(
    [],
  )
  const [loadingLancamentos, setLoadingLancamentos] = useState<boolean>(false)

  // Modal de Lançamento (Novo / Edição)
  const [modalLancamentoOpen, setModalLancamentoOpen] = useState<boolean>(false)
  const [tipoLancamentoModal, setTipoLancamentoModal] =
    useState<TipoLancamentoTributario>('entrada')
  const [lancamentoEmEdicao, setLancamentoEmEdicao] = useState<TributoLancamentoRecord | null>(null)

  // Carregar lançamentos tributários da empresa e ano
  const carregarLancamentos = async () => {
    if (!selectedEmpresaId) return
    try {
      setLoadingLancamentos(true)
      const lista = await tributosLancamentosService.listar({
        empresaId: selectedEmpresaId,
        ano: selectedAno,
      })
      setLancamentosTributarios(lista)
    } catch (error) {
      console.error('Erro ao carregar lançamentos tributários:', error)
    } finally {
      setLoadingLancamentos(false)
    }
  }

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
    carregarLancamentos()
  }, [selectedEmpresaId, selectedAno])

  // Realtime updates
  useRealtime<BalancoRecord>('balancos', () => {
    if (selectedEmpresaId) loadData()
  })
  useRealtime<DreRecord>('dre', () => {
    if (selectedEmpresaId) loadData()
  })
  useRealtime<TributoLancamentoRecord>('tributos_lancamentos', () => {
    if (selectedEmpresaId) carregarLancamentos()
  })

  // DRE e Balanço do ano selecionado (Atual)
  const dreAtual = useMemo(() => {
    return dres.find((d) => d.ano === selectedAno) || null
  }, [dres, selectedAno])

  const dreCalculadoAtual = useMemo(() => {
    return calcularDre(dreAtual)
  }, [dreAtual])

  const receitaBrutaAtual = dreAtual?.receita_bruta || 0
  const lucroLiquidoAtual = dreCalculadoAtual.lucroLiquido || 0
  const folhaEstimadaAtual = receitaBrutaAtual * (folhaPercentual / 100)

  // DRE e Balanço do ano anterior (Comparativo)
  const dreAnterior = useMemo(() => {
    return dres.find((d) => d.ano === anoAnterior) || null
  }, [dres, anoAnterior])

  const dreCalculadoAnterior = useMemo(() => {
    return calcularDre(dreAnterior)
  }, [dreAnterior])

  const receitaBrutaAnterior = dreAnterior?.receita_bruta || 0
  const lucroLiquidoAnterior = dreCalculadoAnterior.lucroLiquido || 0
  const folhaEstimadaAnterior = receitaBrutaAnterior * (folhaPercentual / 100)
  const temDadosAnoAnterior = !!dreAnterior && receitaBrutaAnterior > 0

  // Lançamentos divididos em Entradas e Saídas
  const lancamentosEntradas = useMemo(() => {
    return lancamentosTributarios.filter((l) => l.tipo === 'entrada')
  }, [lancamentosTributarios])

  const lancamentosSaidas = useMemo(() => {
    return lancamentosTributarios.filter((l) => l.tipo === 'saida')
  }, [lancamentosTributarios])

  // Receita base: se não houver DRE, usa a soma dos lançamentos de saídas
  const receitaEfetiva = useMemo(() => {
    if (receitaBrutaAtual > 0) return receitaBrutaAtual
    return lancamentosSaidas.reduce((sum, l) => sum + (Number(l.valor_mercadoria) || 0), 0)
  }, [receitaBrutaAtual, lancamentosSaidas])

  const temDadosAno = receitaEfetiva > 0 || lancamentosTributarios.length > 0

  // Análise Base Real (Sem simulação)
  const analiseReal: AnaliseTributariaResultado = useMemo(() => {
    return compararRegimesTributarios({
      ano: selectedAno,
      receitaBruta: receitaEfetiva,
      lucroLiquido: lucroLiquidoAtual,
      folhaPagamento: folhaEstimadaAtual,
      aliquotaIssPercent: aliquotaIss,
      lancamentosTributarios,
    })
  }, [
    selectedAno,
    receitaEfetiva,
    lucroLiquidoAtual,
    folhaEstimadaAtual,
    aliquotaIss,
    lancamentosTributarios,
  ])

  // Análise Simulada (com variação % de receita e lucro)
  const receitaSimulada = useMemo(() => {
    return Math.max(0, receitaEfetiva * (1 + varReceitaPercent / 100))
  }, [receitaEfetiva, varReceitaPercent])

  const lucroSimulado = useMemo(() => {
    return lucroLiquidoAtual * (1 + varLucroPercent / 100)
  }, [lucroLiquidoAtual, varLucroPercent])

  const folhaSimulada = useMemo(() => {
    return receitaSimulada * (folhaPercentual / 100)
  }, [receitaSimulada, folhaPercentual])

  const isSimulando = varReceitaPercent !== 0 || varLucroPercent !== 0

  const analiseSimulada: AnaliseTributariaResultado = useMemo(() => {
    return compararRegimesTributarios({
      ano: selectedAno,
      receitaBruta: receitaSimulada,
      lucroLiquido: lucroSimulado,
      folhaPagamento: folhaSimulada,
      aliquotaIssPercent: aliquotaIss,
    })
  }, [selectedAno, receitaSimulada, lucroSimulado, folhaSimulada, aliquotaIss])

  // Análise do Ano Anterior
  const analiseAnterior: AnaliseTributariaResultado = useMemo(() => {
    return compararRegimesTributarios({
      ano: anoAnterior,
      receitaBruta: receitaBrutaAnterior,
      lucroLiquido: lucroLiquidoAnterior,
      folhaPagamento: folhaEstimadaAnterior,
      aliquotaIssPercent: aliquotaIss,
    })
  }, [anoAnterior, receitaBrutaAnterior, lucroLiquidoAnterior, folhaEstimadaAnterior, aliquotaIss])

  // Checagem se o regime recomendado mudou com a simulação
  const regimeMudouNaSimulacao = useMemo(() => {
    if (!isSimulando || !temDadosAno) return false
    return analiseSimulada.regimeRecomendado?.id !== analiseReal.regimeRecomendado?.id
  }, [
    isSimulando,
    temDadosAno,
    analiseSimulada.regimeRecomendado?.id,
    analiseReal.regimeRecomendado?.id,
  ])

  const handleResetSimulacao = () => {
    setVarReceitaPercent(0)
    setVarLucroPercent(0)
  }

  // Dados para o Gráfico de Barras Principal (Ano Atual)
  const chartData = useMemo(() => {
    return [
      {
        regime: 'Simples Nacional',
        imposto: analiseReal.regimes.simples.impostoTotal,
        aliquota: analiseReal.regimes.simples.aliquotaEfetiva,
        cor: analiseReal.regimes.simples.isRecomendado ? '#10b981' : '#3b82f6',
        isRecomendado: analiseReal.regimes.simples.isRecomendado,
      },
      {
        regime: 'Lucro Presumido',
        imposto: analiseReal.regimes.presumido.impostoTotal,
        aliquota: analiseReal.regimes.presumido.aliquotaEfetiva,
        cor: analiseReal.regimes.presumido.isRecomendado ? '#10b981' : '#6366f1',
        isRecomendado: analiseReal.regimes.presumido.isRecomendado,
      },
      {
        regime: 'Lucro Real',
        imposto: analiseReal.regimes.real.impostoTotal,
        aliquota: analiseReal.regimes.real.aliquotaEfetiva,
        cor: analiseReal.regimes.real.isRecomendado ? '#10b981' : '#f59e0b',
        isRecomendado: analiseReal.regimes.real.isRecomendado,
      },
    ]
  }, [analiseReal])

  // Dados para o Gráfico de Barras Agrupado (Ano Atual vs Ano Anterior)
  const chartDataComparativo = useMemo(() => {
    return [
      {
        regime: 'Simples Nacional',
        impostoAtual: analiseReal.regimes.simples.impostoTotal,
        aliquotaAtual: analiseReal.regimes.simples.aliquotaEfetiva,
        impostoAnterior: temDadosAnoAnterior ? analiseAnterior.regimes.simples.impostoTotal : 0,
        aliquotaAnterior: temDadosAnoAnterior ? analiseAnterior.regimes.simples.aliquotaEfetiva : 0,
      },
      {
        regime: 'Lucro Presumido',
        impostoAtual: analiseReal.regimes.presumido.impostoTotal,
        aliquotaAtual: analiseReal.regimes.presumido.aliquotaEfetiva,
        impostoAnterior: temDadosAnoAnterior ? analiseAnterior.regimes.presumido.impostoTotal : 0,
        aliquotaAnterior: temDadosAnoAnterior
          ? analiseAnterior.regimes.presumido.aliquotaEfetiva
          : 0,
      },
      {
        regime: 'Lucro Real',
        impostoAtual: analiseReal.regimes.real.impostoTotal,
        aliquotaAtual: analiseReal.regimes.real.aliquotaEfetiva,
        impostoAnterior: temDadosAnoAnterior ? analiseAnterior.regimes.real.impostoTotal : 0,
        aliquotaAnterior: temDadosAnoAnterior ? analiseAnterior.regimes.real.aliquotaEfetiva : 0,
      },
    ]
  }, [analiseReal, analiseAnterior, temDadosAnoAnterior])

  // Handlers para ações dos lançamentos fiscais
  const handleAbrirNovoLancamento = (tipo: TipoLancamentoTributario) => {
    setTipoLancamentoModal(tipo)
    setLancamentoEmEdicao(null)
    setModalLancamentoOpen(true)
  }

  const handleEditarLancamento = (item: TributoLancamentoRecord) => {
    setTipoLancamentoModal(item.tipo)
    setLancamentoEmEdicao(item)
    setModalLancamentoOpen(true)
  }

  const handleExcluirLancamento = async (id: string) => {
    try {
      await tributosLancamentosService.excluir(id)
      toast({
        title: 'Lançamento Removido',
        description: 'O lançamento tributário foi excluído com sucesso.',
      })
      carregarLancamentos()
    } catch (err: any) {
      console.error(err)
      toast({
        title: 'Erro ao excluir',
        description: 'Não foi possível excluir o lançamento.',
        variant: 'destructive',
      })
    }
  }

  const handleSalvarLancamento = async (
    dados: TributoLancamentoInput,
    id?: string,
  ): Promise<boolean> => {
    try {
      if (id) {
        await tributosLancamentosService.atualizar(id, dados)
        toast({
          title: 'Lançamento Atualizado',
          description: 'Os dados fiscais foram atualizados com sucesso.',
        })
      } else {
        await tributosLancamentosService.criar(dados)
        toast({
          title: 'Lançamento Registrado',
          description: `${dados.tipo === 'entrada' ? 'Compra (Entrada)' : 'Venda (Saída)'} cadastrada com sucesso.`,
        })
      }
      return true
    } catch (error: any) {
      console.error(error)
      toast({
        title: 'Erro ao salvar',
        description: error?.message || 'Falha ao salvar lançamento.',
        variant: 'destructive',
      })
      return false
    }
  }

  // Exportar CSV
  const handleExportCsv = () => {
    if (!selectedEmpresa) return

    let csv = '\uFEFF'
    csv += `RELATÓRIO DE ANÁLISE TRIBUTÁRIA E PLANEJAMENTO FISCAL\n`
    csv += `Empresa;${selectedEmpresa.nome}\n`
    csv += `CNPJ;${formatCnpj(selectedEmpresa.cnpj)}\n`
    csv += `Exercício Analisado;${selectedAno}\n`
    if (compararAnoAnterior) {
      csv += `Exercício Anterior;${anoAnterior}\n`
    }
    csv += `Data de Emissão;${new Date().toLocaleDateString('pt-BR')}\n`
    csv += `Alíquota ISS Aplicada;${aliquotaIss.toFixed(2)}%\n`
    csv += `Receita Bruta Anual;${formatCurrency(receitaEfetiva)}\n`
    csv += `Lucro Líquido Contábil;${formatCurrency(lucroLiquidoAtual)}\n\n`

    csv += `COMPARATIVO DOS REGIMES TRIBUTÁRIOS (${selectedAno})\n`
    csv += `Regime;Alíquota Efetiva;Imposto Total Estimado;Economia vs Pior;Recomendado?\n`
    csv += `Simples Nacional;${formatPercent(analiseReal.regimes.simples.aliquotaEfetiva, 2)};${formatCurrency(analiseReal.regimes.simples.impostoTotal)};${formatCurrency(analiseReal.regimes.simples.economiaVsPior)};${analiseReal.regimes.simples.isRecomendado ? 'SIM (Recomendado)' : 'Não'}\n`
    csv += `Lucro Presumido;${formatPercent(analiseReal.regimes.presumido.aliquotaEfetiva, 2)};${formatCurrency(analiseReal.regimes.presumido.impostoTotal)};${formatCurrency(analiseReal.regimes.presumido.economiaVsPior)};${analiseReal.regimes.presumido.isRecomendado ? 'SIM (Recomendado)' : 'Não'}\n`
    csv += `Lucro Real;${formatPercent(analiseReal.regimes.real.aliquotaEfetiva, 2)};${formatCurrency(analiseReal.regimes.real.impostoTotal)};${formatCurrency(analiseReal.regimes.real.economiaVsPior)};${analiseReal.regimes.real.isRecomendado ? 'SIM (Recomendado)' : 'Não'}\n\n`

    if (analiseReal.apuracaoEntradasSaidas) {
      const ap = analiseReal.apuracaoEntradasSaidas
      csv += `APURAÇÃO INTEGRADA DE ENTRADAS (COMPRAS) E SAÍDAS (VENDAS)\n`
      csv += `Total Vendas (Saídas);${formatCurrency(ap.totalMercadoriasSaidas)}\n`
      csv += `Total Compras (Entradas);${formatCurrency(ap.totalMercadoriasEntradas)}\n`
      csv += `Total Débitos Fiscais;${formatCurrency(ap.totalDebitos)}\n`
      csv += `Total Créditos Fiscais;${formatCurrency(ap.totalCreditos)}\n`
      csv += `Saldo a Recolher;${formatCurrency(ap.totalSaldoARecolher)}\n`
      csv += `Saldo Credor Acumulado;${formatCurrency(ap.totalSaldoCredor)}\n\n`

      csv += `DETALHAMENTO POR TRIBUTO (ICMS, IPI, PIS, COFINS)\n`
      csv += `Tributo;Base Débito;Débitos R$;Base Crédito;Créditos R$;Saldo Apurado R$;Situação\n`
      const tribs = [ap.tributos.icms, ap.tributos.ipi, ap.tributos.pis, ap.tributos.cofins]
      tribs.forEach((t) => {
        csv += `${t.tributo};${formatCurrency(t.baseDebito)};${formatCurrency(t.valorDebito)};${formatCurrency(t.baseCredito)};${formatCurrency(t.valorCredito)};${formatCurrency(t.saldoApurado)};${t.tipoSaldo === 'a_recolher' ? 'A Recolher' : 'Saldo Credor'}\n`
      })
      csv += `\n`

      if (lancamentosEntradas.length > 0) {
        csv += `LANÇAMENTOS DE ENTRADAS (COMPRAS)\n`
        csv += `Data;Fornecedor;CNPJ;NF-e;CFOP;Valor Mercadoria;ICMS Crédito;IPI Crédito;PIS Crédito;COFINS Crédito\n`
        lancamentosEntradas.forEach((e) => {
          csv += `${e.data ? e.data.split('T')[0] : ''};${e.fornecedor_tomador};${e.cnpj_cpf || ''};${e.numero_nota || ''};${e.cfop || ''};${formatCurrency(Number(e.valor_mercadoria) || 0)};${formatCurrency(Number(e.valor_icms) || 0)};${formatCurrency(Number(e.valor_ipi) || 0)};${formatCurrency(Number(e.valor_pis) || 0)};${formatCurrency(Number(e.valor_cofins) || 0)}\n`
        })
        csv += `\n`
      }

      if (lancamentosSaidas.length > 0) {
        csv += `LANÇAMENTOS DE SAÍDAS (VENDAS)\n`
        csv += `Data;Cliente/Tomador;CNPJ;NF-e;CFOP;Valor Mercadoria;ICMS Débito;IPI Débito;PIS Débito;COFINS Débito\n`
        lancamentosSaidas.forEach((s) => {
          csv += `${s.data ? s.data.split('T')[0] : ''};${s.fornecedor_tomador};${s.cnpj_cpf || ''};${s.numero_nota || ''};${s.cfop || ''};${formatCurrency(Number(s.valor_mercadoria) || 0)};${formatCurrency(Number(s.valor_icms) || 0)};${formatCurrency(Number(s.valor_ipi) || 0)};${formatCurrency(Number(s.valor_pis) || 0)};${formatCurrency(Number(s.valor_cofins) || 0)}\n`
        })
        csv += `\n`
      }
    }

    if (compararAnoAnterior && temDadosAnoAnterior) {
      csv += `EVOLUÇÃO DA CARGA TRIBUTÁRIA (${selectedAno} vs ${anoAnterior})\n`
      csv += `Regime / Tributo;Valor ${selectedAno};Valor ${anoAnterior};Variação R$;Variação %\n`

      const regimesNomes = [
        { id: 'simples', nome: 'Simples Nacional' },
        { id: 'presumido', nome: 'Lucro Presumido' },
        { id: 'real', nome: 'Lucro Real' },
      ] as const

      for (const r of regimesNomes) {
        const at = analiseReal.regimes[r.id]
        const ant = analiseAnterior.regimes[r.id]
        const diffTotal = at.impostoTotal - ant.impostoTotal
        const varTotalPct = ant.impostoTotal > 0 ? (diffTotal / ant.impostoTotal) * 100 : 0

        csv += `\n--- ${r.nome.toUpperCase()} ---\n`
        csv += `TOTAL DO REGIME;${formatCurrency(at.impostoTotal)};${formatCurrency(ant.impostoTotal)};${formatCurrency(diffTotal)};${formatPercent(varTotalPct, 1)}\n`

        at.breakdown.forEach((itemAt, idx) => {
          const itemAnt = ant.breakdown[idx]
          const vAnt = itemAnt ? itemAnt.valor : 0
          const diff = itemAt.valor - vAnt
          const varPct = vAnt > 0 ? (diff / vAnt) * 100 : 0
          csv += `${itemAt.sigla} - ${itemAt.nome};${formatCurrency(itemAt.valor)};${formatCurrency(vAnt)};${formatCurrency(diff)};${formatPercent(varPct, 1)}\n`
        })
      }
      csv += `\n`
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

  // Helper para renderizar card individual de regime (Normal ou Simulado)
  const renderCardRegime = (regime: RegimeResultado, isSimuladoView: boolean = false) => {
    const isRec = regime.isRecomendado && temDadosAno
    const isSimplesAcimaDoTeto =
      regime.id === 'simples' && (isSimuladoView ? receitaSimulada : receitaEfetiva) > 4800000

    return (
      <div
        key={regime.id}
        className={`relative rounded-2xl transition-all duration-200 flex flex-col justify-between ${
          isRec
            ? isSimuladoView && regimeMudouNaSimulacao
              ? 'bg-amber-50/70 border-2 border-amber-500 shadow-md ring-4 ring-amber-500/10'
              : 'bg-emerald-50/60 border-2 border-emerald-500 shadow-md ring-4 ring-emerald-500/10'
            : 'bg-white border border-slate-200 shadow-xs hover:border-slate-300'
        }`}
      >
        {/* Badge Flutuante de Recomendado */}
        {isRec && (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
            <span
              className={`inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-bold text-white shadow-md uppercase tracking-wider ${
                isSimuladoView && regimeMudouNaSimulacao ? 'bg-amber-600' : 'bg-emerald-600'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              {isSimuladoView && regimeMudouNaSimulacao
                ? '🏆 Recomendado (Simulado)'
                : '🏆 Regime Recomendado'}
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
                isRec
                  ? isSimuladoView && regimeMudouNaSimulacao
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'bg-emerald-500 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600'
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
                  isRec
                    ? isSimuladoView && regimeMudouNaSimulacao
                      ? 'text-amber-800'
                      : 'text-emerald-700'
                    : 'text-slate-800'
                }`}
              >
                {temDadosAno ? formatPercent(regime.aliquotaEfetiva, 2) : '0,00%'}
              </span>
              {isRec && (
                <Badge
                  variant="outline"
                  className={`font-bold text-[11px] ${
                    isSimuladoView && regimeMudouNaSimulacao
                      ? 'bg-amber-100 text-amber-900 border-amber-300'
                      : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                  }`}
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
            <div
              className={`text-xl font-bold ${
                isRec
                  ? isSimuladoView && regimeMudouNaSimulacao
                    ? 'text-amber-800'
                    : 'text-emerald-700'
                  : 'text-[#0B1F3A]'
              }`}
            >
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
                <div
                  className={`p-2.5 rounded-lg border text-xs flex items-center gap-2 ${
                    isSimuladoView && regimeMudouNaSimulacao && isRec
                      ? 'bg-amber-100/80 border-amber-300 text-amber-950'
                      : 'bg-emerald-100/70 border-emerald-200 text-emerald-900'
                  }`}
                >
                  <TrendingDown
                    className={`w-4 h-4 shrink-0 ${
                      isSimuladoView && regimeMudouNaSimulacao && isRec
                        ? 'text-amber-700'
                        : 'text-emerald-700'
                    }`}
                  />
                  <div>
                    <span className="font-semibold">Economia vs Pior Regime:</span>{' '}
                    <span
                      className={`font-bold ${
                        isSimuladoView && regimeMudouNaSimulacao && isRec
                          ? 'text-amber-900'
                          : 'text-emerald-800'
                      }`}
                    >
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

        {/* Controles de Empresa, Ano, Toggle Comparar Ano, ISS e Ações */}
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

          {/* Toggle Comparar com Ano Anterior */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs shadow-2xs">
            <Switch
              id="toggle-comparar-ano-tributario"
              checked={compararAnoAnterior}
              onCheckedChange={setCompararAnoAnterior}
            />
            <Label
              htmlFor="toggle-comparar-ano-tributario"
              className="text-xs font-semibold text-slate-700 cursor-pointer select-none"
            >
              Comparar com ano anterior ({anoAnterior})
            </Label>
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

          {/* Botões de Ação: Exportar CSV e Gerar Parecer Executivo */}
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
              onClick={() => setModalParecerOpen(true)}
              disabled={!temDadosAno}
              className="h-10 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs gap-1.5"
            >
              <FileText className="w-4 h-4" />
              Gerar Parecer Executivo
            </Button>
          </div>
        </div>
      </div>

      {/* 2. Banner de Resumo da Empresa Selecionada com Dados Contábeis */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium mb-1">
            <span>Receita Operacional</span>
            <DollarSign className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-xl font-extrabold text-[#0B1F3A]">
            {temDadosAno ? formatCurrency(receitaEfetiva) : 'R$ 0,00'}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {receitaBrutaAtual > 0 ? 'Base consolidada via DRE' : 'Base por notas de saídas'}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium mb-1">
            <span>Compras (Entradas)</span>
            <ShoppingCart className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-xl font-extrabold text-amber-900">
            {formatCurrency(
              lancamentosEntradas.reduce((s, l) => s + (Number(l.valor_mercadoria) || 0), 0),
            )}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {lancamentosEntradas.length}{' '}
            {lancamentosEntradas.length === 1 ? 'nota de compra' : 'notas de compras'}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium mb-1">
            <span>Folha de Pagamento Estimada</span>
            <Layers className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-xl font-extrabold text-[#0B1F3A]">
            {temDadosAno ? formatCurrency(folhaEstimadaAtual) : 'R$ 0,00'}
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
            {temDadosAno ? formatCurrency(analiseReal.economiaMaximaAnual) : 'R$ 0,00'}
          </div>
          <div className="text-[11px] text-emerald-700 mt-1">
            {temDadosAno && analiseReal.regimeRecomendado
              ? `Optando por ${analiseReal.regimeRecomendado.nome}`
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
              Esta empresa não possui dados de DRE ou lançamentos fiscais cadastrados para o ano de{' '}
              {selectedAno}. Cadastre as entradas e saídas de notas ou importe o DRE para habilitar
              a análise tributária comparativa completa.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button
                onClick={() => {
                  setAbaAtiva('entradas')
                  handleAbrirNovoLancamento('entrada')
                }}
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold"
              >
                <ShoppingCart className="w-4 h-4 mr-2" />
                Lançar Compra / Entrada
              </Button>
              <Button
                onClick={() => {
                  setAbaAtiva('saidas')
                  handleAbrirNovoLancamento('saida')
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold"
              >
                <TrendingUp className="w-4 h-4 mr-2" />
                Lançar Venda / Saída
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* 4. Navegação por Abas: Comparativo de Regimes, Apuração Entradas/Saídas, Entradas (Compras), Saídas (Vendas) */}
      <Tabs value={abaAtiva} onValueChange={setAbaAtiva} className="space-y-6">
        <TabsList className="bg-slate-100 p-1 rounded-xl h-auto flex flex-wrap gap-1 border border-slate-200">
          <TabsTrigger
            value="comparativo"
            className="rounded-lg text-xs font-bold py-2 px-3.5 data-[state=active]:bg-white data-[state=active]:text-[#0B1F3A] data-[state=active]:shadow-xs"
          >
            <Calculator className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
            Comparativo de Regimes
          </TabsTrigger>
          <TabsTrigger
            value="apuracao"
            className="rounded-lg text-xs font-bold py-2 px-3.5 data-[state=active]:bg-white data-[state=active]:text-[#0B1F3A] data-[state=active]:shadow-xs"
          >
            <Scale className="w-3.5 h-3.5 mr-1.5 text-indigo-600" />
            Apuração Débito x Crédito
            {analiseReal.apuracaoEntradasSaidas && (
              <Badge variant="secondary" className="ml-1.5 text-[10px] py-0 px-1 font-bold">
                ICMS / IPI / PIS / COFINS
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="entradas"
            className="rounded-lg text-xs font-bold py-2 px-3.5 data-[state=active]:bg-white data-[state=active]:text-[#0B1F3A] data-[state=active]:shadow-xs"
          >
            <ShoppingCart className="w-3.5 h-3.5 mr-1.5 text-amber-600" />
            Entradas (Compras)
            <Badge className="ml-1.5 text-[10px] py-0 px-1 bg-amber-100 text-amber-800 border-amber-300">
              {lancamentosEntradas.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger
            value="saidas"
            className="rounded-lg text-xs font-bold py-2 px-3.5 data-[state=active]:bg-white data-[state=active]:text-[#0B1F3A] data-[state=active]:shadow-xs"
          >
            <TrendingUp className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
            Saídas (Vendas)
            <Badge className="ml-1.5 text-[10px] py-0 px-1 bg-blue-100 text-blue-800 border-blue-300">
              {lancamentosSaidas.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        {/* ABA 1: COMPARATIVO DOS REGIMES */}
        <TabsContent value="comparativo" className="space-y-6 m-0">
          {temDadosAno && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-[#0B1F3A]">
                    Comparativo Detalhado dos Três Regimes Tributários ({selectedAno})
                  </h2>
                  <p className="text-xs text-slate-500">
                    Avaliação direta entre Simples Nacional (Anexo III), Lucro Presumido e Lucro
                    Real
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className="text-xs bg-slate-50 border-slate-200 text-slate-600 hidden sm:inline-flex"
                >
                  Confronto de Alíquotas Efetivas & Encargos
                </Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
                {renderCardRegime(analiseReal.regimes.simples)}
                {renderCardRegime(analiseReal.regimes.presumido)}
                {renderCardRegime(analiseReal.regimes.real)}
              </div>
            </div>
          )}

          {/* Gráfico de Barras Comparativo com Recharts (Ano Atual) */}
          {temDadosAno && (
            <Card className="rounded-2xl border-slate-200 bg-white shadow-xs">
              <CardHeader className="pb-3 border-b border-slate-100">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-base font-bold text-[#0B1F3A] flex items-center gap-2">
                      <Scale className="w-4 h-4 text-blue-600" />
                      Carga Tributária por Regime (R$ no Ano {selectedAno})
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
                    <BarChart
                      data={chartData}
                      margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                    >
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
                        <strong>{formatCurrency(receitaEfetiva)}</strong> e lucro contábil de{' '}
                        <strong>{formatCurrency(lucroLiquidoAtual)}</strong>, a opção pelo{' '}
                        <strong className="text-emerald-700">
                          {analiseReal.regimeRecomendado?.nome}
                        </strong>{' '}
                        proporciona uma alíquota efetiva de{' '}
                        <strong className="text-emerald-700">
                          {formatPercent(analiseReal.regimeRecomendado?.aliquotaEfetiva, 2)}
                        </strong>
                        , gerando economia anual estimada de{' '}
                        <strong className="text-emerald-700">
                          {formatCurrency(analiseReal.economiaMaximaAnual)}
                        </strong>{' '}
                        frente ao pior cenário ({analiseReal.maiorCustoRegime?.nome}).
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ABA 2: APURAÇÃO DÉBITOS X CRÉDITOS */}
        <TabsContent value="apuracao" className="space-y-6 m-0">
          {analiseReal.apuracaoEntradasSaidas ? (
            <PainelApuracaoEntradasSaidas
              apuracao={analiseReal.apuracaoEntradasSaidas}
              regimeNome={analiseReal.regimeRecomendado?.nome || 'Regime Recomendado'}
              regimeId={analiseReal.regimeRecomendado?.id || 'real'}
              ano={selectedAno}
            />
          ) : (
            <Card className="p-8 text-center rounded-2xl border-slate-200">
              <div className="max-w-md mx-auto space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 mx-auto flex items-center justify-center">
                  <Scale className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-[#0B1F3A]">
                  Sem Lançamentos Fiscais Cadastrados para Apuração
                </h3>
                <p className="text-xs text-slate-500">
                  Cadastre as notas de entradas (compras) e saídas (vendas) para que o motor apure
                  os débitos, créditos e o saldo a recolher por tributo (ICMS, IPI, PIS e COFINS).
                </p>
                <div className="flex items-center justify-center gap-3 pt-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      setAbaAtiva('entradas')
                      handleAbrirNovoLancamento('entrada')
                    }}
                    className="text-xs bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    <ShoppingCart className="w-4 h-4 mr-1.5" />
                    Cadastrar Compra (Entrada)
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      setAbaAtiva('saidas')
                      handleAbrirNovoLancamento('saida')
                    }}
                    className="text-xs bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <TrendingUp className="w-4 h-4 mr-1.5" />
                    Cadastrar Venda (Saída)
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </TabsContent>

        {/* ABA 3: ENTRADAS (COMPRAS) */}
        <TabsContent value="entradas" className="space-y-6 m-0">
          <TabelaLancamentosTributarios
            tipo="entrada"
            lancamentos={lancamentosEntradas}
            loading={loadingLancamentos}
            ano={selectedAno}
            onNovo={() => handleAbrirNovoLancamento('entrada')}
            onEditar={handleEditarLancamento}
            onExcluir={handleExcluirLancamento}
            onRecarregar={carregarLancamentos}
          />
        </TabsContent>

        {/* ABA 4: SAÍDAS (VENDAS) */}
        <TabsContent value="saidas" className="space-y-6 m-0">
          <TabelaLancamentosTributarios
            tipo="saida"
            lancamentos={lancamentosSaidas}
            loading={loadingLancamentos}
            ano={selectedAno}
            onNovo={() => handleAbrirNovoLancamento('saida')}
            onEditar={handleEditarLancamento}
            onExcluir={handleExcluirLancamento}
            onRecarregar={carregarLancamentos}
          />
        </TabsContent>
      </Tabs>

      {/* 5. Gráfico de Barras Comparativo com Recharts (Ano Atual) */}
      {temDadosAno && (
        <Card className="rounded-2xl border-slate-200 bg-white shadow-xs">
          <CardHeader className="pb-3 border-b border-slate-100">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base font-bold text-[#0B1F3A] flex items-center gap-2">
                  <Scale className="w-4 h-4 text-blue-600" />
                  Carga Tributária por Regime (R$ no Ano {selectedAno})
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
                    <strong>{formatCurrency(receitaBrutaAtual)}</strong> e lucro contábil de{' '}
                    <strong>{formatCurrency(lucroLiquidoAtual)}</strong>, a opção pelo{' '}
                    <strong className="text-emerald-700">
                      {analiseReal.regimeRecomendado?.nome}
                    </strong>{' '}
                    proporciona uma alíquota efetiva de{' '}
                    <strong className="text-emerald-700">
                      {formatPercent(analiseReal.regimeRecomendado?.aliquotaEfetiva, 2)}
                    </strong>
                    , gerando economia anual estimada de{' '}
                    <strong className="text-emerald-700">
                      {formatCurrency(analiseReal.economiaMaximaAnual)}
                    </strong>{' '}
                    frente ao pior cenário ({analiseReal.maiorCustoRegime?.nome}).
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* 1. SEÇÃO DE SIMULAÇÃO DE CENÁRIOS (SLIDERS, RECÁLCULO INSTANTÂNEO & RESUMO) */}
      {/* ========================================================================= */}
      {temDadosAno && (
        <Card className="rounded-2xl border-slate-200 bg-white shadow-xs overflow-hidden">
          <CardHeader className="pb-4 bg-slate-50/70 border-b border-slate-100">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-xs">
                  <SlidersHorizontal className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-base font-bold text-[#0B1F3A]">
                    Simulação de Cenários (Sensibilidade Financeira)
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Varie o faturamento e a lucratividade para avaliar a resiliência e mudanças no
                    enquadramento tributário
                  </CardDescription>
                </div>
              </div>

              {isSimulando && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResetSimulacao}
                  className="h-8 text-xs font-semibold border-slate-300 text-slate-700 hover:bg-slate-100 gap-1.5 self-start sm:self-auto"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                  Resetar Simulação
                </Button>
              )}
            </div>
          </CardHeader>

          <CardContent className="pt-6 space-y-6">
            {/* Controles de Sliders */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-5 rounded-xl bg-slate-50/80 border border-slate-200">
              {/* Slider 1: Variação na Receita */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="slider-receita"
                    className="text-xs font-bold text-slate-700 flex items-center gap-1.5"
                  >
                    <DollarSign className="w-4 h-4 text-blue-600" />
                    Variação na Receita (%)
                  </Label>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-extrabold px-2 py-0.5 rounded-md ${
                        varReceitaPercent > 0
                          ? 'bg-emerald-100 text-emerald-800'
                          : varReceitaPercent < 0
                            ? 'bg-red-100 text-red-800'
                            : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {varReceitaPercent > 0 ? `+${varReceitaPercent}%` : `${varReceitaPercent}%`}
                    </span>
                    <input
                      id="input-receita-percent"
                      type="number"
                      min="-50"
                      max="100"
                      step="5"
                      value={varReceitaPercent}
                      onChange={(e) =>
                        setVarReceitaPercent(
                          Math.min(100, Math.max(-50, Number(e.target.value) || 0)),
                        )
                      }
                      className="w-16 h-7 text-xs font-bold text-right px-2 rounded-lg border border-slate-300 bg-white"
                    />
                  </div>
                </div>

                <Slider
                  id="slider-receita"
                  min={-50}
                  max={100}
                  step={5}
                  value={[varReceitaPercent]}
                  onValueChange={(val) => setVarReceitaPercent(val[0])}
                  className="py-1 cursor-pointer"
                />

                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>-50% (Risco/Queda)</span>
                  <span className="font-semibold text-slate-700">
                    Simulado: {formatCurrency(receitaSimulada)}
                  </span>
                  <span>+100% (Crescimento)</span>
                </div>
              </div>

              {/* Slider 2: Variação no Lucro */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="slider-lucro"
                    className="text-xs font-bold text-slate-700 flex items-center gap-1.5"
                  >
                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                    Variação no Lucro Contábil (%)
                  </Label>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-extrabold px-2 py-0.5 rounded-md ${
                        varLucroPercent > 0
                          ? 'bg-emerald-100 text-emerald-800'
                          : varLucroPercent < 0
                            ? 'bg-red-100 text-red-800'
                            : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {varLucroPercent > 0 ? `+${varLucroPercent}%` : `${varLucroPercent}%`}
                    </span>
                    <input
                      id="input-lucro-percent"
                      type="number"
                      min="-50"
                      max="100"
                      step="5"
                      value={varLucroPercent}
                      onChange={(e) =>
                        setVarLucroPercent(
                          Math.min(100, Math.max(-50, Number(e.target.value) || 0)),
                        )
                      }
                      className="w-16 h-7 text-xs font-bold text-right px-2 rounded-lg border border-slate-300 bg-white"
                    />
                  </div>
                </div>

                <Slider
                  id="slider-lucro"
                  min={-50}
                  max={100}
                  step={5}
                  value={[varLucroPercent]}
                  onValueChange={(val) => setVarLucroPercent(val[0])}
                  className="py-1 cursor-pointer"
                />

                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>-50% (Compressão)</span>
                  <span className="font-semibold text-slate-700">
                    Simulado: {formatCurrency(lucroSimulado)}
                  </span>
                  <span>+100% (Expansão)</span>
                </div>
              </div>
            </div>

            {/* Resumo Textual e Alerta de Mudança de Regime */}
            <div className="space-y-3">
              {regimeMudouNaSimulacao ? (
                <div className="p-4 rounded-xl bg-amber-50 border-2 border-amber-400 text-amber-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs animate-fadeIn">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-amber-600 text-white font-bold text-xs">
                          ⚠️ O regime recomendado muda para{' '}
                          {analiseSimulada.regimeRecomendado?.nome}
                        </Badge>
                      </div>
                      <p className="text-xs text-amber-900 mt-1.5 leading-relaxed">
                        Com{' '}
                        <strong>
                          {varReceitaPercent > 0
                            ? `+${varReceitaPercent}%`
                            : `${varReceitaPercent}%`}
                        </strong>{' '}
                        na receita e{' '}
                        <strong>
                          {varLucroPercent > 0 ? `+${varLucroPercent}%` : `${varLucroPercent}%`}
                        </strong>{' '}
                        no lucro, o enquadramento original (
                        <em>{analiseReal.regimeRecomendado?.nome}</em>) deixa de ser o mais
                        vantajoso. A melhor opção passa a ser{' '}
                        <strong>{analiseSimulada.regimeRecomendado?.nome}</strong>, com alíquota
                        efetiva de{' '}
                        <strong>
                          {formatPercent(analiseSimulada.regimeRecomendado?.aliquotaEfetiva, 2)}
                        </strong>{' '}
                        e economia anual de{' '}
                        <strong>{formatCurrency(analiseSimulada.economiaMaximaAnual)}</strong>.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200 text-blue-950 flex items-start gap-3 shadow-2xs">
                  <Sparkles className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-900 leading-relaxed">
                    Com{' '}
                    <strong>
                      {varReceitaPercent > 0 ? `+${varReceitaPercent}%` : `${varReceitaPercent}%`}
                    </strong>{' '}
                    de variação na receita e{' '}
                    <strong>
                      {varLucroPercent > 0 ? `+${varLucroPercent}%` : `${varLucroPercent}%`}
                    </strong>{' '}
                    no lucro, o regime recomendado continua sendo{' '}
                    <strong className="text-blue-950">
                      {analiseSimulada.regimeRecomendado?.nome}
                    </strong>{' '}
                    com economia estimada de{' '}
                    <strong className="text-emerald-700">
                      {formatCurrency(analiseSimulada.economiaMaximaAnual)}
                    </strong>{' '}
                    frente ao pior cenário ({analiseSimulada.maiorCustoRegime?.nome}).
                  </p>
                </div>
              )}
            </div>

            {/* Três Cards Simulados se houver variação ativa */}
            {isSimulando && (
              <div className="pt-2">
                <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center justify-between">
                  <span>Resultado dos 3 Regimes no Cenário Simulado:</span>
                  <span className="text-[11px] text-slate-400 font-normal">
                    Receita: {formatCurrency(receitaSimulada)} · Lucro:{' '}
                    {formatCurrency(lucroSimulado)}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
                  {renderCardRegime(analiseSimulada.regimes.simples, true)}
                  {renderCardRegime(analiseSimulada.regimes.presumido, true)}
                  {renderCardRegime(analiseSimulada.regimes.real, true)}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* 2. COMPARAÇÃO COM ANO ANTERIOR (CARDS COMPARATIVOS, GRÁFICO & EVOLUÇÃO) */}
      {/* ========================================================================= */}
      {compararAnoAnterior && (
        <Card className="rounded-2xl border-blue-200 bg-linear-to-b from-blue-50/40 via-white to-slate-50/60 shadow-xs">
          <CardHeader className="pb-3 border-b border-blue-100">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-base font-bold text-[#0B1F3A]">
                    Comparativo Histórico de Regimes ({selectedAno} vs {anoAnterior})
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Evolução da carga tributária e comportamento da empresa em relação ao ano fiscal
                    anterior
                  </CardDescription>
                </div>
              </div>
              <Badge className="bg-blue-100 text-blue-800 border-blue-200 font-bold self-start sm:self-auto">
                Exercícios: {selectedAno} vs {anoAnterior}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="pt-6 space-y-6">
            {!temDadosAnoAnterior ? (
              <div className="p-8 rounded-xl bg-amber-50 border border-amber-200 text-center space-y-2">
                <AlertTriangle className="w-8 h-8 text-amber-600 mx-auto" />
                <h4 className="text-sm font-bold text-amber-900">
                  Sem dados de {anoAnterior} para comparação
                </h4>
                <p className="text-xs text-amber-800 max-w-md mx-auto">
                  Não foram localizados lançamentos de DRE ou faturamento para o exercício de{' '}
                  {anoAnterior}. Cadastre ou importe os demonstrativos do ano anterior para
                  habilitar a análise histórica completa.
                </p>
              </div>
            ) : (
              <>
                {/* 3 Cards Comparativos: Alíquota Efetiva, Imposto Total, Regime Recomendado */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Card 1: Alíquota Efetiva */}
                  <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                      <span>Alíquota Efetiva (Regime Recomendado)</span>
                      <Percent className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="flex items-baseline justify-between">
                      <div>
                        <div className="text-2xl font-black text-[#0B1F3A]">
                          {formatPercent(analiseReal.regimeRecomendado?.aliquotaEfetiva, 2)}
                        </div>
                        <div className="text-[11px] text-slate-400">Ano {selectedAno}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-base font-bold text-slate-600">
                          {formatPercent(analiseAnterior.regimeRecomendado?.aliquotaEfetiva, 2)}
                        </div>
                        <div className="text-[11px] text-slate-400">Ano {anoAnterior}</div>
                      </div>
                    </div>
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                      <span className="text-slate-500">Variação:</span>
                      {(() => {
                        const diff =
                          (analiseReal.regimeRecomendado?.aliquotaEfetiva || 0) -
                          (analiseAnterior.regimeRecomendado?.aliquotaEfetiva || 0)
                        return (
                          <span
                            className={`font-bold ${
                              diff < 0
                                ? 'text-emerald-700'
                                : diff > 0
                                  ? 'text-red-600'
                                  : 'text-slate-600'
                            }`}
                          >
                            {diff > 0 ? `+${diff.toFixed(2)} p.p.` : `${diff.toFixed(2)} p.p.`}
                          </span>
                        )
                      })()}
                    </div>
                  </div>

                  {/* Card 2: Imposto Total */}
                  <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                      <span>Imposto Total Anual (Recomendado)</span>
                      <DollarSign className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div className="flex items-baseline justify-between">
                      <div>
                        <div className="text-2xl font-black text-[#0B1F3A]">
                          {formatCurrency(analiseReal.regimeRecomendado?.impostoTotal)}
                        </div>
                        <div className="text-[11px] text-slate-400">Ano {selectedAno}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-base font-bold text-slate-600">
                          {formatCurrency(analiseAnterior.regimeRecomendado?.impostoTotal)}
                        </div>
                        <div className="text-[11px] text-slate-400">Ano {anoAnterior}</div>
                      </div>
                    </div>
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                      <span className="text-slate-500">Variação R$:</span>
                      {(() => {
                        const diff =
                          (analiseReal.regimeRecomendado?.impostoTotal || 0) -
                          (analiseAnterior.regimeRecomendado?.impostoTotal || 0)
                        return (
                          <span
                            className={`font-bold ${
                              diff < 0
                                ? 'text-emerald-700'
                                : diff > 0
                                  ? 'text-red-600'
                                  : 'text-slate-600'
                            }`}
                          >
                            {diff > 0 ? `+${formatCurrency(diff)}` : formatCurrency(diff)}
                          </span>
                        )
                      })()}
                    </div>
                  </div>

                  {/* Card 3: Regime Recomendado */}
                  <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                      <span>Regime Recomendado</span>
                      <Award className="w-4 h-4 text-amber-600" />
                    </div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-base font-extrabold text-emerald-700">
                          {analiseReal.regimeRecomendado?.nome}
                        </div>
                        <div className="text-[11px] text-slate-400">Exercício {selectedAno}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-slate-700">
                          {analiseAnterior.regimeRecomendado?.nome}
                        </div>
                        <div className="text-[11px] text-slate-400">Exercício {anoAnterior}</div>
                      </div>
                    </div>
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                      <span className="text-slate-500">Status da Opção:</span>
                      <span
                        className={`font-bold ${
                          analiseReal.regimeRecomendado?.id ===
                          analiseAnterior.regimeRecomendado?.id
                            ? 'text-emerald-700'
                            : 'text-amber-600'
                        }`}
                      >
                        {analiseReal.regimeRecomendado?.id === analiseAnterior.regimeRecomendado?.id
                          ? '✓ Mantido o mesmo regime'
                          : '⚠️ Alteração de regime recomendada'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Gráfico de Barras Agrupadas (3 regimes x 2 anos lado a lado) */}
                <div className="p-5 rounded-xl bg-white border border-slate-200">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="text-sm font-bold text-[#0B1F3A]">
                        Comparativo Gráfico por Regime ({selectedAno} vs {anoAnterior})
                      </h4>
                      <p className="text-xs text-slate-500">
                        Carga tributária total anual estimada lado a lado para cada regime
                      </p>
                    </div>
                  </div>

                  <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={chartDataComparativo}
                        margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                      >
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
                          content={({ active, payload, label }) => {
                            if (active && payload && payload.length) {
                              const item = payload[0].payload
                              return (
                                <div className="bg-[#0B1F3A] text-white p-3.5 rounded-xl shadow-xl text-xs space-y-2 border border-blue-900 min-w-[220px]">
                                  <p className="font-bold text-sm text-blue-200">{label}</p>
                                  <div className="space-y-1">
                                    <div className="flex justify-between gap-4 text-blue-300">
                                      <span>Ano {selectedAno}:</span>
                                      <span className="font-bold text-white">
                                        {formatCurrency(item.impostoAtual)} (
                                        {formatPercent(item.aliquotaAtual, 2)})
                                      </span>
                                    </div>
                                    <div className="flex justify-between gap-4 text-slate-300">
                                      <span>Ano {anoAnterior}:</span>
                                      <span className="font-bold text-white">
                                        {formatCurrency(item.impostoAnterior)} (
                                        {formatPercent(item.aliquotaAnterior, 2)})
                                      </span>
                                    </div>
                                    <div className="flex justify-between gap-4 pt-1 border-t border-white/10 text-xs">
                                      <span>Diferença:</span>
                                      <span
                                        className={`font-bold ${
                                          item.impostoAtual < item.impostoAnterior
                                            ? 'text-emerald-300'
                                            : 'text-amber-300'
                                        }`}
                                      >
                                        {formatCurrency(item.impostoAtual - item.impostoAnterior)}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              )
                            }
                            return null
                          }}
                        />
                        <Legend
                          wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
                          formatter={(value) => (
                            <span className="text-slate-700 font-semibold">{value}</span>
                          )}
                        />
                        <Bar
                          dataKey="impostoAtual"
                          name={`Imposto ${selectedAno}`}
                          fill="#2563EB"
                          radius={[6, 6, 0, 0]}
                          maxBarSize={50}
                        />
                        <Bar
                          dataKey="impostoAnterior"
                          name={`Imposto ${anoAnterior}`}
                          fill="#94A3B8"
                          radius={[6, 6, 0, 0]}
                          maxBarSize={50}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Tabela Resumo: "Evolução da Carga Tributária" com Tributos Discriminados */}
                <div className="p-5 rounded-xl bg-white border border-slate-200 space-y-4">
                  <div>
                    <h4 className="text-sm font-bold text-[#0B1F3A]">
                      Evolução da Carga Tributária Detalhada por Tributo
                    </h4>
                    <p className="text-xs text-slate-500">
                      Comparativo de cada tributo apurado nos exercícios de {selectedAno} e{' '}
                      {anoAnterior}
                    </p>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-100 font-bold text-slate-800 border-b border-slate-300">
                          <th className="py-2.5 px-3">Regime / Tributo</th>
                          <th className="py-2.5 px-3 text-right">Valor {selectedAno} (R$)</th>
                          <th className="py-2.5 px-3 text-right">Valor {anoAnterior} (R$)</th>
                          <th className="py-2.5 px-3 text-right">Variação (R$)</th>
                          <th className="py-2.5 px-3 text-right">Variação (%)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {(
                          [
                            { key: 'simples', nome: 'Simples Nacional' },
                            { key: 'presumido', nome: 'Lucro Presumido' },
                            { key: 'real', nome: 'Lucro Real' },
                          ] as const
                        ).map(({ key, nome }) => {
                          const rAtual = analiseReal.regimes[key]
                          const rAnt = analiseAnterior.regimes[key]
                          const diffTotal = rAtual.impostoTotal - rAnt.impostoTotal
                          const varPctTotal =
                            rAnt.impostoTotal > 0 ? (diffTotal / rAnt.impostoTotal) * 100 : 0

                          return (
                            <React.Fragment key={key}>
                              {/* Linha do Total do Regime */}
                              <tr className="bg-slate-50/90 font-bold text-slate-900 border-t-2 border-slate-200">
                                <td className="py-2 px-3 flex items-center gap-2">
                                  <span>{nome}</span>
                                  {rAtual.isRecomendado && (
                                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] py-0">
                                      Recomendado {selectedAno}
                                    </Badge>
                                  )}
                                </td>
                                <td className="py-2 px-3 text-right">
                                  {formatCurrency(rAtual.impostoTotal)}
                                </td>
                                <td className="py-2 px-3 text-right text-slate-600">
                                  {formatCurrency(rAnt.impostoTotal)}
                                </td>
                                <td
                                  className={`py-2 px-3 text-right ${
                                    diffTotal < 0
                                      ? 'text-emerald-700'
                                      : diffTotal > 0
                                        ? 'text-red-600'
                                        : 'text-slate-600'
                                  }`}
                                >
                                  {diffTotal > 0
                                    ? `+${formatCurrency(diffTotal)}`
                                    : formatCurrency(diffTotal)}
                                </td>
                                <td
                                  className={`py-2 px-3 text-right ${
                                    varPctTotal < 0
                                      ? 'text-emerald-700'
                                      : varPctTotal > 0
                                        ? 'text-red-600'
                                        : 'text-slate-600'
                                  }`}
                                >
                                  {varPctTotal > 0
                                    ? `+${varPctTotal.toFixed(1)}%`
                                    : `${varPctTotal.toFixed(1)}%`}
                                </td>
                              </tr>

                              {/* Linhas dos Tributos Individuais */}
                              {rAtual.breakdown.map((itemAtual, idx) => {
                                const itemAnt = rAnt.breakdown[idx]
                                const vAnt = itemAnt ? itemAnt.valor : 0
                                const diff = itemAtual.valor - vAnt
                                const varPct = vAnt > 0 ? (diff / vAnt) * 100 : 0

                                return (
                                  <tr key={idx} className="hover:bg-slate-50/50">
                                    <td className="py-1.5 px-6 text-slate-600">
                                      <span className="font-semibold text-slate-800">
                                        {itemAtual.sigla}
                                      </span>{' '}
                                      -{' '}
                                      <span className="text-[11px] text-slate-400">
                                        {itemAtual.nome}
                                      </span>
                                    </td>
                                    <td className="py-1.5 px-3 text-right font-medium text-slate-800">
                                      {formatCurrency(itemAtual.valor)}
                                    </td>
                                    <td className="py-1.5 px-3 text-right text-slate-500">
                                      {formatCurrency(vAnt)}
                                    </td>
                                    <td
                                      className={`py-1.5 px-3 text-right font-medium ${
                                        diff < 0
                                          ? 'text-emerald-700'
                                          : diff > 0
                                            ? 'text-red-600'
                                            : 'text-slate-500'
                                      }`}
                                    >
                                      {diff > 0 ? `+${formatCurrency(diff)}` : formatCurrency(diff)}
                                    </td>
                                    <td
                                      className={`py-1.5 px-3 text-right ${
                                        varPct < 0
                                          ? 'text-emerald-700'
                                          : varPct > 0
                                            ? 'text-red-600'
                                            : 'text-slate-500'
                                      }`}
                                    >
                                      {varPct > 0
                                        ? `+${varPct.toFixed(1)}%`
                                        : `${varPct.toFixed(1)}%`}
                                    </td>
                                  </tr>
                                )
                              })}
                            </React.Fragment>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
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

      {/* 3. Modal do Parecer Executivo em PDF */}
      <ModalParecerExecutivo
        open={modalParecerOpen}
        onOpenChange={setModalParecerOpen}
        selectedEmpresa={selectedEmpresa}
        selectedAno={selectedAno}
        receitaBruta={receitaEfetiva}
        lucroLiquido={lucroLiquidoAtual}
        aliquotaIss={aliquotaIss}
        analise={analiseReal}
        minhaEmpresa={minhaEmpresa}
        logoUrl={logoUrl}
        lancamentosEntradas={lancamentosEntradas}
        lancamentosSaidas={lancamentosSaidas}
      />

      {/* 4. Modal para Lançamento de Entradas ou Saídas */}
      {selectedEmpresaId && (
        <ModalLancamentoTributario
          open={modalLancamentoOpen}
          onOpenChange={setModalLancamentoOpen}
          tipo={tipoLancamentoModal}
          empresaId={selectedEmpresaId}
          lancamentoEmEdicao={lancamentoEmEdicao}
          onSalvo={carregarLancamentos}
          onSalvar={handleSalvarLancamento}
        />
      )}
    </div>
  )
}
