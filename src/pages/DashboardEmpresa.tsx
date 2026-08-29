import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  Building2,
  Calendar,
  DollarSign,
  TrendingUp,
  Scale,
  ArrowLeft,
  PieChart as PieIcon,
  BarChart3,
  Target,
  ArrowRight,
  TrendingDown,
  Building,
} from 'lucide-react'
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  Legend,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  BarChart,
  Bar,
} from 'recharts'
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
import { AnimatedCounter } from '@/components/AnimatedCounter'
import { ModalGerenciarMetas } from '@/components/ModalGerenciarMetas'
import {
  empresasService,
  balancosService,
  dreService,
  lancamentosService,
  metasLancamentosService,
  centrosService,
  contasService,
  planoContasService,
} from '@/services/financeService'
import {
  calcularBalanco,
  calcularDre,
  calcularIndicadores,
  consolidarBalancoAnual,
  consolidarDreAnual,
  formatBrlMil,
  formatNumber,
  formatPercent,
  formatCnpj,
} from '@/lib/financeCalculations'
import { useRealtime } from '@/hooks/use-realtime'
import type {
  EmpresaRecord,
  BalancoRecord,
  DreRecord,
  LancamentoRecord,
  MetaLancamentoRecord,
  CentroRecord,
  ContaRecord,
  PlanoContaRecord,
} from '@/types/finance'

export default function DashboardEmpresa() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [empresa, setEmpresa] = useState<EmpresaRecord | null>(null)
  const [empresas, setEmpresas] = useState<EmpresaRecord[]>([])
  const [balancos, setBalancos] = useState<BalancoRecord[]>([])
  const [dres, setDres] = useState<DreRecord[]>([])
  const [lancamentos, setLancamentos] = useState<LancamentoRecord[]>([])
  const [metas, setMetas] = useState<MetaLancamentoRecord[]>([])
  const [centros, setCentros] = useState<CentroRecord[]>([])
  const [contas, setContas] = useState<ContaRecord[]>([])
  const [planoContas, setPlanoContas] = useState<PlanoContaRecord[]>([])

  const [selectedAno, setSelectedAno] = useState<number>(new Date().getFullYear())
  const [loading, setLoading] = useState(true)
  const [modalMetasOpen, setModalMetasOpen] = useState(false)

  // Carregar dados exclusivos da empresa
  const loadEmpresaData = useCallback(async () => {
    if (!id) return
    try {
      setLoading(true)
      const [
        emp,
        allEmpresas,
        allBalancos,
        allDres,
        allLancamentos,
        allMetas,
        allCentros,
        allContas,
        allPlano,
      ] = await Promise.all([
        empresasService.getById(id),
        empresasService.getAll(),
        balancosService.getAll(),
        dreService.getAll(),
        lancamentosService.getAll({ expandRelations: true }),
        metasLancamentosService.getAll({ expandRelations: true }),
        centrosService.getAll(),
        contasService.getAll(),
        planoContasService.getAll(),
      ])

      setEmpresa(emp)
      setEmpresas(allEmpresas)
      setCentros(allCentros)
      setContas(allContas)
      setPlanoContas(allPlano)

      // Filtrar estritamente para esta empresa
      const empBalancos = allBalancos.filter((b) => b.empresa === id)
      const empDres = allDres.filter((d) => d.empresa === id)
      const empLancamentos = allLancamentos.filter((l) => l.empresa === id)
      const empMetas = allMetas.filter((m) => m.empresa === id)

      setBalancos(empBalancos)
      setDres(empDres)
      setLancamentos(empLancamentos)
      setMetas(empMetas)

      // Ajustar ano selecionado se houver balanços cadastrados
      if (empBalancos.length > 0) {
        const anos = empBalancos.map((b) => b.ano)
        const anoRecente = Math.max(...anos)
        setSelectedAno(anoRecente)
      }
    } catch (err) {
      console.error('Erro ao carregar dados da empresa:', err)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    loadEmpresaData()
  }, [loadEmpresaData])

  // Inscrições Realtime em todas as collections relevantes
  useRealtime<EmpresaRecord>('empresas', () => loadEmpresaData())
  useRealtime<BalancoRecord>('balancos', () => loadEmpresaData())
  useRealtime<DreRecord>('dre', () => loadEmpresaData())
  useRealtime<LancamentoRecord>('lancamentos', () => loadEmpresaData())
  useRealtime<MetaLancamentoRecord>('metas_lancamentos', () => loadEmpresaData())
  useRealtime<PlanoContaRecord>('plano_contas', () => loadEmpresaData())

  // Mapeamentos
  const contasMap = useMemo(() => new Map(contas.map((c) => [c.id, c])), [contas])
  const centrosMap = useMemo(() => new Map(centros.map((c) => [c.id, c])), [centros])

  // Anos disponíveis para esta empresa
  const anosDisponiveis = useMemo(() => {
    const set = new Set<number>()
    balancos.forEach((b) => set.add(b.ano))
    dres.forEach((d) => set.add(d.ano))
    lancamentos.forEach((l) => {
      if (l.data) {
        const anoL = parseInt(l.data.slice(0, 4), 10)
        if (!isNaN(anoL)) set.add(anoL)
      }
    })
    metas.forEach((m) => set.add(m.ano))

    if (set.size === 0) set.add(new Date().getFullYear())
    return Array.from(set).sort((a, b) => b - a)
  }, [balancos, dres, lancamentos, metas])

  // Balanço e DRE consolidados do ano selecionado
  const balancoAtual = useMemo(
    () => consolidarBalancoAnual(balancos, selectedAno),
    [balancos, selectedAno],
  )
  const dreAtual = useMemo(() => consolidarDreAnual(dres, selectedAno), [dres, selectedAno])

  const calcB = calcularBalanco(balancoAtual)
  const calcInd = calcularIndicadores(balancoAtual, dreAtual)

  // Gráficos Composição
  const dataComposicaoAtivo = useMemo(() => {
    return [
      { name: 'Ativo Circulante', value: calcB.ativoCirculante, color: '#2563EB' },
      { name: 'Ativo Não Circulante', value: calcB.ativoNaoCirculante, color: '#0EA5E9' },
    ].filter((d) => d.value > 0)
  }, [calcB.ativoCirculante, calcB.ativoNaoCirculante])

  const dataComposicaoPassivoPL = useMemo(() => {
    return [
      { name: 'Passivo Circulante', value: calcB.passivoCirculante, color: '#F59E0B' },
      { name: 'Passivo Não Circulante', value: calcB.passivoNaoCirculante, color: '#8B5CF6' },
      { name: 'Patrimônio Líquido', value: calcB.patrimonioLiquido, color: '#10B981' },
    ].filter((d) => d.value > 0)
  }, [calcB.passivoCirculante, calcB.passivoNaoCirculante, calcB.patrimonioLiquido])

  // Evolução do PL por Ano (Histórico da empresa)
  const anosOrdenados = useMemo(() => {
    const anos = Array.from(
      new Set([...balancos.map((b) => b.ano), ...dres.map((d) => d.ano)]),
    ).sort((a, b) => a - b)
    return anos
  }, [balancos, dres])

  const dataEvolucaoPL = useMemo(() => {
    return anosOrdenados.map((ano) => {
      const b = consolidarBalancoAnual(balancos, ano)
      const c = calcularBalanco(b)
      return {
        ano: String(ano),
        pl: c.patrimonioLiquido,
        ativo: c.ativoTotal,
      }
    })
  }, [anosOrdenados, balancos])

  const dataEvolucaoReceitaLucro = useMemo(() => {
    return anosOrdenados.map((ano) => {
      const d = consolidarDreAnual(dres, ano)
      const c = calcularDre(d)
      return {
        ano: String(ano),
        receitaLiquida: c.receitaLiquida,
        lucroLiquido: c.lucroLiquido,
      }
    })
  }, [anosOrdenados, dres])

  // Metas da Empresa
  const cardsMetasCalculados = useMemo(() => {
    const agora = new Date()
    const anoAtual = agora.getFullYear()
    const mesAtual = agora.getMonth() + 1
    const diaAtual = agora.getDate()

    const metasFiltradas = metas.filter((m) => m.ativo ?? true)

    const nomesMesesLista = [
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

    return metasFiltradas.map((meta) => {
      const isTrimestral = meta.periodo === 'Trimestral'
      const isAnual = meta.periodo === 'Anual'
      const centroObj =
        meta.expand?.centro || (meta.centro ? centrosMap.get(meta.centro) : undefined)
      const centroNome = centroObj
        ? centroObj.codigo
          ? `${centroObj.codigo} ${centroObj.nome}`
          : centroObj.nome
        : null

      let mesesDoPeriodo: number[] = []
      if (isAnual) {
        mesesDoPeriodo = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
      } else if (isTrimestral) {
        const qStr = meta.trimestre || 'Q1'
        const qNum = parseInt(qStr.replace('Q', ''), 10) || 1
        mesesDoPeriodo = [(qNum - 1) * 3 + 1, (qNum - 1) * 3 + 2, (qNum - 1) * 3 + 3]
      } else {
        mesesDoPeriodo = [meta.mes]
      }

      // Filtrar lançamentos da meta
      const lancamentosMeta = lancamentos.filter((l) => {
        if (!l.data) return false
        const anoLanc = parseInt(l.data.slice(0, 4), 10)
        const mesLanc = parseInt(l.data.slice(5, 7), 10)
        if (anoLanc !== meta.ano) return false
        if (!mesesDoPeriodo.includes(mesLanc)) return false

        const pc = l.expand?.plano_conta || planoContas.find((p) => p.id === l.plano_conta)
        const conta = pc?.expand?.conta || (pc?.conta ? contasMap.get(pc.conta) : undefined)
        if (conta?.tipo !== meta.tipo) return false

        if (meta.centro) {
          const centroDoPlano = pc?.expand?.centro?.id || pc?.centro
          if (centroDoPlano !== meta.centro) return false
        }
        return true
      })

      const realizado = lancamentosMeta.reduce((acc, l) => acc + (Number(l.valor) || 0), 0)
      const atingimentoPct = meta.valor > 0 ? (realizado / meta.valor) * 100 : 0

      let projecaoValor: number | null = null
      let projecaoPct: number | null = null
      let statusCor: 'green' | 'amber' | 'red' = 'red'

      if (isAnual) {
        let mesesDecorridos = 0
        if (anoAtual > meta.ano) {
          mesesDecorridos = 12
        } else if (anoAtual < meta.ano) {
          mesesDecorridos = 0
        } else {
          const totalDiasMes = new Date(anoAtual, mesAtual, 0).getDate()
          const fracaoMes = Math.min(1, Math.max(0.1, diaAtual / totalDiasMes))
          mesesDecorridos = mesAtual - 1 + fracaoMes
        }

        if (mesesDecorridos > 0 && realizado > 0) {
          projecaoValor = (realizado / mesesDecorridos) * 12
          projecaoPct = meta.valor > 0 ? (projecaoValor / meta.valor) * 100 : 0
        } else {
          projecaoValor = realizado
          projecaoPct = atingimentoPct
        }

        if ((projecaoPct ?? 0) >= 100) {
          statusCor = 'green'
        } else if ((projecaoPct ?? 0) >= 70) {
          statusCor = 'amber'
        } else {
          statusCor = 'red'
        }
      } else if (isTrimestral) {
        let mesesDecorridos = 0
        if (anoAtual > meta.ano) {
          mesesDecorridos = 3
        } else if (anoAtual < meta.ano) {
          mesesDecorridos = 0
        } else {
          for (const m of mesesDoPeriodo) {
            if (mesAtual > m) {
              mesesDecorridos += 1
            } else if (mesAtual === m) {
              const totalDiasMes = new Date(anoAtual, mesAtual, 0).getDate()
              const fracaoMes = Math.min(1, Math.max(0.1, diaAtual / totalDiasMes))
              mesesDecorridos += fracaoMes
            }
          }
        }

        if (mesesDecorridos > 0 && realizado > 0) {
          projecaoValor = (realizado / mesesDecorridos) * 3
          projecaoPct = meta.valor > 0 ? (projecaoValor / meta.valor) * 100 : 0
        } else {
          projecaoValor = realizado
          projecaoPct = atingimentoPct
        }

        if ((projecaoPct ?? 0) >= 100) {
          statusCor = 'green'
        } else if ((projecaoPct ?? 0) >= 70) {
          statusCor = 'amber'
        } else {
          statusCor = 'red'
        }
      } else {
        if (atingimentoPct >= 100) {
          statusCor = 'green'
        } else if (atingimentoPct >= 70) {
          statusCor = 'amber'
        } else {
          statusCor = 'red'
        }
      }

      const mesNome = nomesMesesLista[meta.mes - 1] || `Mês ${meta.mes}`
      const periodoLabel = isTrimestral
        ? `${meta.trimestre || 'Q1'}/${meta.ano}`
        : isAnual
          ? `Ano ${meta.ano}`
          : `${mesNome}/${meta.ano}`

      return {
        ...meta,
        centroNome,
        mesNome,
        periodoLabel,
        isTrimestral,
        isAnual,
        realizado,
        atingimentoPct,
        projecaoValor,
        projecaoPct,
        statusCor,
      }
    })
  }, [metas, lancamentos, planoContas, contasMap, centrosMap])

  // Resumo de Lançamentos da Empresa (Últimos 6 Meses por tipo de conta)
  const resumoLancamentos = useMemo(() => {
    const now = new Date()
    const anoAtual = now.getFullYear()
    const mesAtual = now.getMonth()

    const mmAtualStr = String(mesAtual + 1).padStart(2, '0')
    const anoMesAtualKey = `${anoAtual}-${mmAtualStr}`

    const dataMesAnterior = new Date(anoAtual, mesAtual - 1, 1)
    const anoAnterior = dataMesAnterior.getFullYear()
    const mesAnterior = dataMesAnterior.getMonth()
    const mmAntStr = String(mesAnterior + 1).padStart(2, '0')
    const anoMesAnteriorKey = `${anoAnterior}-${mmAntStr}`

    let totalMesAtual = 0
    let totalMesAnterior = 0
    let qtdMesAtual = 0
    let qtdMesAnterior = 0

    const nomesMesesAbrev = [
      'Jan',
      'Fev',
      'Mar',
      'Abr',
      'Mai',
      'Jun',
      'Jul',
      'Ago',
      'Set',
      'Out',
      'Nov',
      'Dez',
    ]
    const mesesUltimos6: {
      key: string
      label: string
      ativo: number
      passivo: number
      receita: number
      despesa: number
      pl: number
      outros: number
      total: number
    }[] = []

    for (let i = 5; i >= 0; i--) {
      const d = new Date(anoAtual, mesAtual - i, 1)
      const y = d.getFullYear()
      const m = d.getMonth()
      const key = `${y}-${String(m + 1).padStart(2, '0')}`
      const label = `${nomesMesesAbrev[m]}/${String(y).slice(2)}`
      mesesUltimos6.push({
        key,
        label,
        ativo: 0,
        passivo: 0,
        receita: 0,
        despesa: 0,
        pl: 0,
        outros: 0,
        total: 0,
      })
    }

    const mapMeses = new Map<string, (typeof mesesUltimos6)[0]>()
    for (const mObj of mesesUltimos6) {
      mapMeses.set(mObj.key, mObj)
    }

    for (const l of lancamentos) {
      const val = Number(l.valor) || 0
      const dStr = (l.data || '').slice(0, 7)
      if (!dStr) continue

      if (dStr === anoMesAtualKey) {
        totalMesAtual += val
        qtdMesAtual += 1
      }
      if (dStr === anoMesAnteriorKey) {
        totalMesAnterior += val
        qtdMesAnterior += 1
      }

      const mesObj = mapMeses.get(dStr)
      if (mesObj) {
        mesObj.total += val
        const pc = l.expand?.plano_conta || planoContas.find((p) => p.id === l.plano_conta)
        const conta = pc?.expand?.conta || (pc?.conta ? contasMap.get(pc.conta) : undefined)
        const tipoConta = conta?.tipo

        if (tipoConta === 'Ativo') {
          mesObj.ativo += val
        } else if (tipoConta === 'Passivo') {
          mesObj.passivo += val
        } else if (tipoConta === 'Receita') {
          mesObj.receita += val
        } else if (tipoConta === 'Despesa') {
          mesObj.despesa += val
        } else if (tipoConta === 'Patrimônio Líquido') {
          mesObj.pl += val
        } else {
          mesObj.outros += val
        }
      }
    }

    let variacaoPercentual: number | null = null
    if (totalMesAnterior > 0) {
      variacaoPercentual = ((totalMesAtual - totalMesAnterior) / totalMesAnterior) * 100
    } else if (totalMesAtual > 0 && totalMesAnterior === 0) {
      variacaoPercentual = 100
    } else if (totalMesAtual === 0 && totalMesAnterior === 0) {
      variacaoPercentual = 0
    }

    const nomeMesAtual = `${nomesMesesAbrev[mesAtual]}/${anoAtual}`
    const nomeMesAnterior = `${nomesMesesAbrev[mesAnterior]}/${anoAnterior}`

    return {
      totalMesAtual,
      totalMesAnterior,
      qtdMesAtual,
      qtdMesAnterior,
      variacaoPercentual,
      nomeMesAtual,
      nomeMesAnterior,
      dadosUltimos6Meses: mesesUltimos6,
      totalLancamentosEmpresa: lancamentos.length,
    }
  }, [lancamentos, planoContas, contasMap])

  // Lista de Balanços desta Empresa
  const balancosEmpresaList = useMemo(() => {
    return balancos
      .slice()
      .sort((a, b) => b.ano - a.ano)
      .map((b) => {
        const cb = calcularBalanco(b)
        const lc = cb.passivoCirculante > 0 ? cb.ativoCirculante / cb.passivoCirculante : null
        return {
          id: b.id,
          ano: b.ano,
          ativoTotal: cb.ativoTotal,
          passivoTotal: cb.passivoTotal,
          pl: cb.patrimonioLiquido,
          liquidezCorrente: lc,
        }
      })
  }, [balancos])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-500 font-medium">Carregando dashboard da empresa...</p>
        </div>
      </div>
    )
  }

  if (!empresa) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center max-w-lg mx-auto mt-8 shadow-sm">
        <div className="w-14 h-14 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Building2 className="w-7 h-7" />
        </div>
        <h3 className="text-lg font-bold text-[#0B1F3A]">Empresa não encontrada</h3>
        <p className="text-xs text-slate-500 mt-2 mb-6">
          A empresa solicitada não existe ou foi removida do sistema.
        </p>
        <Button asChild className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs">
          <Link to="/dashboard">Voltar ao Dashboard Geral</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Modal Gerenciar Metas */}
      <ModalGerenciarMetas
        open={modalMetasOpen}
        onOpenChange={setModalMetasOpen}
        empresas={empresas}
        centros={centros}
        metas={metas}
        selectedEmpresaId={empresa.id}
        selectedAno={selectedAno}
        onMetaChanged={loadEmpresaData}
      />

      {/* CABEÇALHO EXCLUSIVO DA EMPRESA */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-2xs">
        <div className="flex items-start sm:items-center gap-3.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => navigate('/dashboard')}
            className="text-xs text-slate-600 hover:text-[#0B1F3A] hover:bg-slate-50 border-slate-200 gap-1.5 shrink-0"
            title="Voltar ao Dashboard Geral"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Voltar ao Geral</span>
          </Button>

          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm">
            <Building className="w-5 h-5" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-xl font-extrabold text-[#0B1F3A] tracking-tight truncate">
                {empresa.nome}
              </h1>
              <Badge
                variant="secondary"
                className="text-xs font-semibold bg-blue-50 text-blue-700 border-blue-200"
              >
                {empresa.segmento}
              </Badge>
            </div>
            <p className="text-xs text-[#5B6B7F] mt-0.5 flex items-center gap-2 flex-wrap">
              <span>CNPJ: {formatCnpj(empresa.cnpj)}</span>
              <span>·</span>
              <span className="text-emerald-700 font-semibold">Dashboard Exclusivo</span>
            </p>
          </div>
        </div>

        {/* Controles do Cabeçalho: Seletor de Ano + Links */}
        <div className="flex items-center gap-2.5 flex-wrap self-end md:self-auto">
          {/* Seletor de Ano */}
          <div className="flex items-center gap-1.5 bg-[#F5F7FA] border border-slate-200 rounded-lg px-2.5 py-1 text-xs">
            <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <Select
              value={String(selectedAno)}
              onValueChange={(val) => setSelectedAno(Number(val))}
            >
              <SelectTrigger className="h-7 border-none shadow-none bg-transparent text-xs font-semibold text-slate-800 p-0 focus:ring-0 w-[80px]">
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

          <Button
            asChild
            size="sm"
            variant="outline"
            className="text-xs border-blue-200 hover:bg-blue-50 text-blue-700 font-medium"
          >
            <Link to={`/empresas/${empresa.id}`}>
              Diagnóstico Completo <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Link>
          </Button>
        </div>
      </div>

      {/* KPIS DA EMPRESA (6 colunas desktop, 2 mobile) */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* Ativo Total */}
        <Card className="p-4 bg-white border-slate-200 shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Ativo Total
            </span>
            <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-bold text-[#0B1F3A] tracking-tight">
            <AnimatedCounter value={calcB.ativoTotal} formatter={(v) => formatBrlMil(v)} />
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Exercício {selectedAno}</p>
        </Card>

        {/* Passivo Total */}
        <Card className="p-4 bg-white border-slate-200 shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Passivo Total
            </span>
            <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">
              <Scale className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-bold text-[#0B1F3A] tracking-tight">
            <AnimatedCounter value={calcB.passivoTotal} formatter={(v) => formatBrlMil(v)} />
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Capital de terceiros</p>
        </Card>

        {/* Patrimônio Líquido */}
        <Card className="p-4 bg-white border-slate-200 shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Patrimônio Líquido
            </span>
            <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-bold text-[#0B1F3A] tracking-tight">
            <AnimatedCounter value={calcB.patrimonioLiquido} formatter={(v) => formatBrlMil(v)} />
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Capital próprio</p>
        </Card>

        {/* Liquidez Corrente */}
        <Card className="p-4 bg-white border-slate-200 shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Liquidez Corrente
            </span>
            <span
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                (calcInd.liquidezCorrente || 0) >= 1.0
                  ? 'bg-emerald-50 text-emerald-700'
                  : (calcInd.liquidezCorrente || 0) >= 0.8
                    ? 'bg-amber-50 text-amber-700'
                    : 'bg-red-50 text-red-700'
              }`}
            >
              AC / PC
            </span>
          </div>
          <div
            className={`mt-2 text-xl sm:text-2xl font-bold tracking-tight ${
              calcInd.liquidezCorrente === null
                ? 'text-slate-400'
                : calcInd.liquidezCorrente >= 1.0
                  ? 'text-emerald-600'
                  : calcInd.liquidezCorrente >= 0.8
                    ? 'text-amber-500'
                    : 'text-red-600'
            }`}
          >
            {calcInd.liquidezCorrente !== null ? (
              <AnimatedCounter
                value={calcInd.liquidezCorrente}
                formatter={(v) => formatNumber(v, 2)}
              />
            ) : (
              '—'
            )}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {calcInd.liquidezCorrente === null
              ? 'Sem dados'
              : calcInd.liquidezCorrente >= 1.0
                ? 'Capacidade adequada'
                : 'Atenção liquidez'}
          </p>
        </Card>

        {/* ROE */}
        <Card className="p-4 bg-white border-slate-200 shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              ROE (Retorno PL)
            </span>
            <span className="text-[10px] font-bold text-slate-500">LL / PL</span>
          </div>
          <div
            className={`mt-2 text-xl sm:text-2xl font-bold tracking-tight ${
              calcInd.roe === null
                ? 'text-slate-400'
                : calcInd.roe >= 0
                  ? 'text-emerald-600'
                  : 'text-red-600'
            }`}
          >
            {calcInd.roe !== null ? (
              <AnimatedCounter value={calcInd.roe} formatter={(v) => formatPercent(v)} />
            ) : (
              '—'
            )}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Rentabilidade do capital</p>
        </Card>

        {/* Margem Líquida */}
        <Card className="p-4 bg-white border-slate-200 shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Margem Líquida
            </span>
            <span className="text-[10px] font-bold text-slate-500">LL / Rec</span>
          </div>
          <div
            className={`mt-2 text-xl sm:text-2xl font-bold tracking-tight ${
              calcInd.margemLiquida === null
                ? 'text-slate-400'
                : calcInd.margemLiquida >= 0
                  ? 'text-emerald-600'
                  : 'text-red-600'
            }`}
          >
            {calcInd.margemLiquida !== null ? (
              <AnimatedCounter value={calcInd.margemLiquida} formatter={(v) => formatPercent(v)} />
            ) : (
              '—'
            )}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Eficiência operacional</p>
        </Card>
      </div>

      {/* SEÇÃO METAS FILTRADAS DA EMPRESA */}
      <Card className="bg-white border-slate-200 shadow-2xs">
        <CardHeader className="pb-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
              <Target className="w-4 h-4 text-blue-600" />
              Metas de {empresa.nome} (Mensais, Trimestrais e Anuais)
              {cardsMetasCalculados.length > 0 && (
                <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] font-semibold">
                  {cardsMetasCalculados.length} meta(s)
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">
              Acompanhamento de metas orçamentárias de Receita e Despesa com projeção
            </CardDescription>
          </div>

          <Button
            type="button"
            size="sm"
            onClick={() => setModalMetasOpen(true)}
            className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold self-start sm:self-auto gap-1.5 shrink-0 shadow-xs"
          >
            <Target className="w-3.5 h-3.5" />
            Gerenciar Metas
          </Button>
        </CardHeader>

        <CardContent className="pt-4">
          {cardsMetasCalculados.length === 0 ? (
            <div className="py-8 flex flex-col items-center justify-center text-center bg-slate-50/70 rounded-xl border border-dashed border-slate-200">
              <Target className="w-8 h-8 text-slate-400 mb-2" />
              <p className="text-xs font-bold text-slate-700">
                Nenhuma meta cadastrada para esta empresa
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5 max-w-sm mb-3">
                Cadastre metas mensais, trimestrais ou anuais para acompanhar o desempenho
                financeiro.
              </p>
              <Button
                type="button"
                size="sm"
                onClick={() => setModalMetasOpen(true)}
                variant="outline"
                className="text-xs border-blue-200 text-blue-700 hover:bg-blue-50 font-semibold"
              >
                Definir Nova Meta
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {cardsMetasCalculados.map((m) => {
                const corBadge =
                  m.statusCor === 'green'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                    : m.statusCor === 'amber'
                      ? 'bg-amber-50 text-amber-700 border-amber-300'
                      : 'bg-red-50 text-red-700 border-red-300'

                const corProgresso =
                  m.statusCor === 'green'
                    ? 'bg-emerald-500'
                    : m.statusCor === 'amber'
                      ? 'bg-amber-500'
                      : 'bg-red-500'

                const borderCard =
                  m.statusCor === 'green'
                    ? 'border-emerald-200 hover:border-emerald-300'
                    : m.statusCor === 'amber'
                      ? 'border-amber-200 hover:border-amber-300'
                      : 'border-red-200 hover:border-red-300'

                return (
                  <div
                    key={m.id}
                    className={`p-3.5 rounded-xl bg-white border ${borderCard} shadow-2xs hover:shadow-md transition-all flex flex-col justify-between`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-[#0B1F3A] truncate">
                            Meta de {m.tipo}
                            {m.centroNome && (
                              <span className="font-semibold text-blue-700 ml-1">
                                · {m.centroNome}
                              </span>
                            )}
                          </p>
                          <p className="text-[10px] text-slate-500 font-medium">{m.periodoLabel}</p>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <Badge
                            variant="secondary"
                            className={`text-[9px] font-semibold px-1.5 py-0 ${
                              m.isTrimestral
                                ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                : m.isAnual
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-blue-50 text-blue-700 border border-blue-200'
                            }`}
                          >
                            {m.isTrimestral ? 'Trimestral' : m.isAnual ? 'Anual' : 'Mensal'}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={`text-[9px] font-bold px-1.5 py-0 ${
                              m.tipo === 'Receita'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-red-50 text-red-700 border-red-200'
                            }`}
                          >
                            {m.tipo}
                          </Badge>
                        </div>
                      </div>

                      <div className="mt-3 space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500">
                            {m.isTrimestral
                              ? 'Meta Trimestral:'
                              : m.isAnual
                                ? 'Meta Anual:'
                                : 'Meta Estipulada:'}
                          </span>
                          <span className="font-bold text-slate-700">{formatBrlMil(m.valor)}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500">
                            {m.isTrimestral || m.isAnual ? 'Realizado Acumulado:' : 'Realizado:'}
                          </span>
                          <span className="font-extrabold text-[#0B1F3A]">
                            {formatBrlMil(m.realizado)}
                          </span>
                        </div>

                        {(m.isTrimestral || m.isAnual) && (
                          <div className="pt-1.5 mt-1 border-t border-dashed border-slate-100 flex items-center justify-between text-xs">
                            <span className="text-slate-500 flex items-center gap-1">
                              <TrendingUp
                                className={`w-3 h-3 ${m.isAnual ? 'text-emerald-600' : 'text-purple-600'}`}
                              />
                              {m.isAnual ? 'Projeção Anual:' : 'Projeção Trimestre:'}
                            </span>
                            <span
                              className={`font-bold ${m.isAnual ? 'text-emerald-900' : 'text-purple-900'}`}
                            >
                              {formatBrlMil(m.projecaoValor ?? 0)} (
                              {formatPercent(m.projecaoPct ?? 0, 0)})
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="mt-2.5">
                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${corProgresso}`}
                            style={{ width: `${Math.min(m.atingimentoPct, 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-slate-500">Atingimento:</span>
                      <Badge className={`text-[11px] font-bold border px-2 py-0.5 ${corBadge}`}>
                        {formatPercent(m.atingimentoPct, 1)}
                      </Badge>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* GRÁFICOS DE COMPOSIÇÃO E EVOLUÇÃO */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Composição do Ativo (Donut) */}
        <Card className="bg-white border-slate-200 shadow-2xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-[#0B1F3A] flex items-center justify-between">
              <span className="flex items-center gap-2">
                <PieIcon className="w-4 h-4 text-blue-600" />
                Composição do Ativo ({selectedAno})
              </span>
              <span className="text-xs font-normal text-slate-500">
                Total: {formatBrlMil(calcB.ativoTotal)}
              </span>
            </CardTitle>
            <CardDescription className="text-xs">
              Divisão entre Ativo Circulante e Não Circulante
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            {dataComposicaoAtivo.length > 0 ? (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={dataComposicaoAtivo}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {dataComposicaoAtivo.map((entry, index) => (
                        <Cell key={`cell-a-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      formatter={(val: any) => [formatBrlMil(Number(val)), 'Valor']}
                    />
                    <Legend
                      verticalAlign="bottom"
                      height={36}
                      formatter={(val, entry: any) => {
                        const total = calcB.ativoTotal || 1
                        const pct = ((entry.payload.value / total) * 100).toFixed(1)
                        return (
                          <span className="text-xs font-medium text-slate-700">
                            {val}: {formatBrlMil(entry.payload.value)} ({pct}%)
                          </span>
                        )
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-xs text-slate-400">
                Sem dados de balanço para {selectedAno}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Composição Passivo + PL (Donut) */}
        <Card className="bg-white border-slate-200 shadow-2xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-[#0B1F3A] flex items-center justify-between">
              <span className="flex items-center gap-2">
                <PieIcon className="w-4 h-4 text-blue-600" />
                Estrutura de Capital (Passivo + PL)
              </span>
              <span className="text-xs font-normal text-slate-500">
                Total: {formatBrlMil(calcB.passivoTotal + calcB.patrimonioLiquido)}
              </span>
            </CardTitle>
            <CardDescription className="text-xs">
              Origem dos recursos: Terceiros vs Próprios ({selectedAno})
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            {dataComposicaoPassivoPL.length > 0 ? (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={dataComposicaoPassivoPL}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {dataComposicaoPassivoPL.map((entry, index) => (
                        <Cell key={`cell-p-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      formatter={(val: any) => [formatBrlMil(Number(val)), 'Valor']}
                    />
                    <Legend
                      verticalAlign="bottom"
                      height={36}
                      formatter={(val, entry: any) => {
                        const total = calcB.passivoTotal + calcB.patrimonioLiquido || 1
                        const pct = ((entry.payload.value / total) * 100).toFixed(1)
                        return (
                          <span className="text-xs font-medium text-slate-700">
                            {val}: {formatBrlMil(entry.payload.value)} ({pct}%)
                          </span>
                        )
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-xs text-slate-400">
                Sem dados de balanço para {selectedAno}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Evolução Histórica do PL e Ativo (Área) */}
        <Card className="bg-white border-slate-200 shadow-2xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              Evolução Patrimonial por Ano (Ativo e PL)
            </CardTitle>
            <CardDescription className="text-xs">
              Crescimento do Ativo Total e Patrimônio Líquido de {empresa.nome}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            {dataEvolucaoPL.length > 0 ? (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={dataEvolucaoPL}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="colorAtivoEmp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563EB" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorPLEmp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                    <XAxis dataKey="ano" tick={{ fontSize: 12, fill: '#64748B' }} />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#64748B' }}
                      tickFormatter={(v) => `R$ ${Math.round(v / 1000)}k`}
                    />
                    <RechartsTooltip formatter={(val: any) => [formatBrlMil(Number(val)), '']} />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="ativo"
                      name="Ativo Total"
                      stroke="#2563EB"
                      fillOpacity={1}
                      fill="url(#colorAtivoEmp)"
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="pl"
                      name="Patrimônio Líquido"
                      stroke="#10B981"
                      fillOpacity={1}
                      fill="url(#colorPLEmp)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-xs text-slate-400">
                Sem histórico de balanços cadastrados
              </div>
            )}
          </CardContent>
        </Card>

        {/* Receita Líquida vs Lucro Líquido (Barras Agrupadas) */}
        <Card className="bg-white border-slate-200 shadow-2xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-600" />
              Evolução Receita vs Lucro Líquido
            </CardTitle>
            <CardDescription className="text-xs">
              Comparação anual de Receita e Lucro Líquido (DRE)
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            {dataEvolucaoReceitaLucro.length > 0 ? (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={dataEvolucaoReceitaLucro}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                    <XAxis dataKey="ano" tick={{ fontSize: 12, fill: '#64748B' }} />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#64748B' }}
                      tickFormatter={(v) => `R$ ${Math.round(v / 1000)}k`}
                    />
                    <RechartsTooltip formatter={(val: any) => [formatBrlMil(Number(val)), '']} />
                    <Legend />
                    <Bar
                      dataKey="receitaLiquida"
                      name="Receita Líquida"
                      fill="#2563EB"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="lucroLiquido"
                      name="Lucro Líquido"
                      fill="#10B981"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-xs text-slate-400">
                Sem histórico de DRE
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* RESUMO DE LANÇAMENTOS DA EMPRESA */}
      <Card className="bg-white border-slate-200 shadow-2xs">
        <CardHeader className="pb-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-600" />
              Resumo de Lançamentos de {empresa.nome}
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">
              Comparativo de movimentação financeira e histórico dos últimos 6 meses segmentado por
              tipo de conta
            </CardDescription>
          </div>

          <Button
            asChild
            size="sm"
            variant="outline"
            className="text-xs border-blue-200 hover:bg-blue-50 text-blue-700 self-start sm:self-auto font-medium gap-1 shrink-0"
          >
            <Link to="/lancamentos">
              Ver Lançamentos <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </Button>
        </CardHeader>

        <CardContent className="pt-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Mês Atual ({resumoLancamentos.nomeMesAtual})
                </span>
                <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-[10px] font-semibold">
                  {resumoLancamentos.qtdMesAtual} lanç.
                </Badge>
              </div>
              <div className="mt-2 text-xl font-bold text-[#0B1F3A] tracking-tight">
                <AnimatedCounter
                  value={resumoLancamentos.totalMesAtual}
                  formatter={(v) => formatBrlMil(v)}
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Volume lançado no mês</p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Mês Anterior ({resumoLancamentos.nomeMesAnterior})
                </span>
                <Badge variant="outline" className="text-[10px] font-semibold text-slate-600">
                  {resumoLancamentos.qtdMesAnterior} lanç.
                </Badge>
              </div>
              <div className="mt-2 text-xl font-bold text-slate-700 tracking-tight">
                <AnimatedCounter
                  value={resumoLancamentos.totalMesAnterior}
                  formatter={(v) => formatBrlMil(v)}
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Base de comparação anterior</p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Variação Mês a Mês
                </span>
                {resumoLancamentos.variacaoPercentual !== null && (
                  <div
                    className={`p-1 rounded-md ${
                      resumoLancamentos.variacaoPercentual >= 0
                        ? 'bg-emerald-50 text-emerald-600'
                        : 'bg-red-50 text-red-600'
                    }`}
                  >
                    {resumoLancamentos.variacaoPercentual >= 0 ? (
                      <TrendingUp className="w-3.5 h-3.5" />
                    ) : (
                      <TrendingDown className="w-3.5 h-3.5" />
                    )}
                  </div>
                )}
              </div>
              <div
                className={`mt-2 text-xl font-bold tracking-tight ${
                  resumoLancamentos.variacaoPercentual === null
                    ? 'text-slate-400'
                    : resumoLancamentos.variacaoPercentual >= 0
                      ? 'text-emerald-600'
                      : 'text-red-600'
                }`}
              >
                {resumoLancamentos.variacaoPercentual !== null ? (
                  <>
                    {resumoLancamentos.variacaoPercentual > 0 ? '+' : ''}
                    <AnimatedCounter
                      value={resumoLancamentos.variacaoPercentual}
                      formatter={(v) => formatPercent(v, 1)}
                    />
                  </>
                ) : (
                  '—'
                )}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                {resumoLancamentos.variacaoPercentual === null
                  ? 'Sem base anterior'
                  : resumoLancamentos.variacaoPercentual >= 0
                    ? 'Crescimento de lançamentos'
                    : 'Redução de lançamentos'}
              </p>
            </div>
          </div>

          <div className="pt-2">
            <h4 className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
              <BarChart3 className="w-3.5 h-3.5 text-blue-600" />
              Evolução dos Lançamentos nos Últimos 6 Meses por Tipo de Conta
            </h4>

            <div className="h-68 w-full bg-slate-50/50 rounded-xl p-3 border border-slate-100">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={resumoLancamentos.dadosUltimos6Meses}
                  margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: '#475569', fontWeight: 600 }}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#64748B' }}
                    tickFormatter={(v) => `R$ ${Math.round(v / 1000)}k`}
                  />
                  <RechartsTooltip
                    formatter={(val: any, name: any) => [formatBrlMil(Number(val)), name]}
                    labelFormatter={(label) => `Mês: ${label}`}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }} />
                  <Bar
                    dataKey="ativo"
                    name="Ativo"
                    fill="#2563EB"
                    radius={[3, 3, 0, 0]}
                    stackId="a"
                  />
                  <Bar
                    dataKey="passivo"
                    name="Passivo"
                    fill="#F59E0B"
                    radius={[3, 3, 0, 0]}
                    stackId="a"
                  />
                  <Bar
                    dataKey="receita"
                    name="Receita"
                    fill="#10B981"
                    radius={[3, 3, 0, 0]}
                    stackId="a"
                  />
                  <Bar
                    dataKey="despesa"
                    name="Despesa"
                    fill="#EF4444"
                    radius={[3, 3, 0, 0]}
                    stackId="a"
                  />
                  <Bar
                    dataKey="pl"
                    name="Patrimônio Líquido"
                    fill="#8B5CF6"
                    radius={[3, 3, 0, 0]}
                    stackId="a"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* TABELA DE ÚLTIMOS BALANÇOS DA EMPRESA */}
      <Card className="bg-white border-slate-200 shadow-2xs">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-sm font-bold text-[#0B1F3A]">
              Histórico de Balanços de {empresa.nome}
            </CardTitle>
            <CardDescription className="text-xs">
              Evolução patrimonial dos exercícios contábeis cadastrados
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {balancosEmpresaList.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              Nenhum balanço cadastrado para esta empresa.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 font-semibold">
                    <th className="py-2.5 px-3">Exercício (Ano)</th>
                    <th className="py-2.5 px-3 text-right">Ativo Total</th>
                    <th className="py-2.5 px-3 text-right">Passivo Total</th>
                    <th className="py-2.5 px-3 text-right">Patrimônio Líquido</th>
                    <th className="py-2.5 px-3 text-center">Liquidez Corrente</th>
                    <th className="py-2.5 px-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {balancosEmpresaList.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3 font-bold text-[#0B1F3A]">{row.ano}</td>
                      <td className="py-3 px-3 text-right font-medium text-slate-700">
                        {formatBrlMil(row.ativoTotal)}
                      </td>
                      <td className="py-3 px-3 text-right font-medium text-slate-700">
                        {formatBrlMil(row.passivoTotal)}
                      </td>
                      <td className="py-3 px-3 text-right font-semibold text-emerald-700">
                        {formatBrlMil(row.pl)}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                            (row.liquidezCorrente || 0) >= 1.0
                              ? 'bg-emerald-50 text-emerald-700'
                              : (row.liquidezCorrente || 0) >= 0.8
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-red-50 text-red-700'
                          }`}
                        >
                          {formatNumber(row.liquidezCorrente, 2)}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedAno(row.ano)}
                          className="h-7 text-[11px] font-medium border-slate-200 hover:border-blue-300 hover:text-blue-700"
                        >
                          Selecionar {row.ano}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
