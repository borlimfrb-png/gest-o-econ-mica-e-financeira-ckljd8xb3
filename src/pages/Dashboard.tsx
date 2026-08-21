import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useFilter } from '@/contexts/FilterContext'
import {
  balancosService,
  centrosService,
  contasService,
  dreService,
  lancamentosCentroService,
  lancamentosService,
  metasLancamentosService,
  planoContasService,
  tiposDespesaService,
} from '@/services/financeService'
import type {
  BalancoRecord,
  CentroRecord,
  ContaRecord,
  DreRecord,
  LancamentoCentroRecord,
  LancamentoRecord,
  MetaLancamentoRecord,
  PlanoContaRecord,
  TipoDespesaRecord,
} from '@/types/finance'
import { ModalGerenciarMetas } from '@/components/ModalGerenciarMetas'
import {
  calcularBalanco,
  calcularDre,
  calcularIndicadores,
  formatBrlMil,
  formatNumber,
  formatPercent,
  formatCnpj,
} from '@/lib/financeCalculations'
import { useRealtime } from '@/hooks/use-realtime'
import { AnimatedCounter } from '@/components/AnimatedCounter'
import {
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  AreaChart,
  Area,
  LineChart,
  Line,
} from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Building2,
  DollarSign,
  PieChart as PieIcon,
  BarChart3,
  Scale,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  CalendarClock,
  Target,
  FolderTree,
  Check,
  Tag,
  Download,
} from 'lucide-react'

const CHART_COLORS = ['#2563EB', '#0EA5E9', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899']

export default function Dashboard() {
  const { empresas, selectedEmpresaId, selectedAno, selectedEmpresa, isLoadingEmpresas } =
    useFilter()

  const [balancos, setBalancos] = useState<BalancoRecord[]>([])
  const [dres, setDres] = useState<DreRecord[]>([])
  const [allBalancos, setAllBalancos] = useState<BalancoRecord[]>([])
  const [lancamentosCentro, setLancamentosCentro] = useState<LancamentoCentroRecord[]>([])
  const [lancamentosFinanceiros, setLancamentosFinanceiros] = useState<LancamentoRecord[]>([])
  const [tiposDespesa, setTiposDespesa] = useState<TipoDespesaRecord[]>([])
  const [centros, setCentros] = useState<CentroRecord[]>([])
  const [contas, setContas] = useState<ContaRecord[]>([])
  const [planoContas, setPlanoContas] = useState<PlanoContaRecord[]>([])
  const [metas, setMetas] = useState<MetaLancamentoRecord[]>([])
  const [modalMetasOpen, setModalMetasOpen] = useState(false)
  const [loadingData, setLoadingData] = useState<boolean>(true)

  const loadData = async () => {
    try {
      setLoadingData(true)
      const [allB, allD, allL, allTd, allC, allContas, allPlano, allLancFin, allMetas] =
        await Promise.all([
          balancosService.getAll(),
          dreService.getAll(),
          lancamentosCentroService.getAll(),
          tiposDespesaService.getAll(),
          centrosService.getAll(),
          contasService.getAll(),
          planoContasService.getAll(),
          lancamentosService.getAll({ expandRelations: true }),
          metasLancamentosService.getAll({ expandRelations: true }),
        ])
      setAllBalancos(allB)
      setDres(allD)
      setLancamentosCentro(allL)
      setTiposDespesa(allTd)
      setCentros(allC)
      setContas(allContas)
      setPlanoContas(allPlano)
      setLancamentosFinanceiros(allLancFin)
      setMetas(allMetas)

      if (selectedEmpresaId) {
        setBalancos(allB.filter((b) => b.empresa === selectedEmpresaId))
      }
    } catch (err) {
      console.error('Erro ao carregar dados do dashboard:', err)
    } finally {
      setLoadingData(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [selectedEmpresaId])

  useRealtime<BalancoRecord>('balancos', () => {
    loadData()
  })
  useRealtime<DreRecord>('dre', () => {
    loadData()
  })
  useRealtime<LancamentoCentroRecord>('lancamentos_centro', () => {
    loadData()
  })
  useRealtime<LancamentoRecord>('lancamentos', () => {
    loadData()
  })
  useRealtime<TipoDespesaRecord>('tipos_despesa', () => {
    loadData()
  })
  useRealtime<CentroRecord>('centros', () => {
    loadData()
  })
  useRealtime<ContaRecord>('contas', () => {
    loadData()
  })
  useRealtime<PlanoContaRecord>('plano_contas', () => {
    loadData()
  })
  useRealtime<MetaLancamentoRecord>('metas_lancamentos', () => {
    loadData()
  })

  // Lookup maps
  const contasMap = useMemo(() => {
    const map = new Map<string, ContaRecord>()
    for (const c of contas) map.set(c.id, c)
    return map
  }, [contas])

  const centrosMap = useMemo(() => {
    const map = new Map<string, CentroRecord>()
    for (const c of centros) map.set(c.id, c)
    return map
  }, [centros])

  const tiposMap = useMemo(() => {
    const map = new Map<string, TipoDespesaRecord>()
    for (const t of tiposDespesa) map.set(t.id, t)
    return map
  }, [tiposDespesa])

  // Balanço e DRE do ano selecionado
  const balancoAtual = balancos.find((b) => b.ano === selectedAno)
  const dreAtual = dres.find((d) => d.empresa === selectedEmpresaId && d.ano === selectedAno)

  // Totais e Indicadores calculados
  const calcB = calcularBalanco(balancoAtual)
  const calcD = calcularDre(dreAtual)
  const calcInd = calcularIndicadores(balancoAtual, dreAtual)

  // SEÇÃO METAS DE LANÇAMENTOS DO MÊS / EXERCÍCIO / TRIMESTRE
  const cardsMetasCalculados = useMemo(() => {
    const agora = new Date()
    const anoAtual = agora.getFullYear()
    const mesAtual = agora.getMonth() + 1
    const diaAtual = agora.getDate()

    const metasFiltradas = metas.filter((m) => {
      const isAtiva = m.ativo ?? true
      if (!isAtiva) return false
      if (selectedEmpresaId && m.empresa !== selectedEmpresaId) return false
      return true
    })

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
      const emp = meta.expand?.empresa || empresas.find((e) => e.id === meta.empresa)
      const empNome = emp?.nome || 'Empresa'

      const centroObj =
        meta.expand?.centro || (meta.centro ? centrosMap.get(meta.centro) : undefined)
      const centroNome = centroObj
        ? centroObj.codigo
          ? `${centroObj.codigo} ${centroObj.nome}`
          : centroObj.nome
        : null

      // Meses correspondentes se for trimestral / anual
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
      const lancamentosMeta = lancamentosFinanceiros.filter((l) => {
        if (l.empresa !== meta.empresa) return false
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

      // Projeção para trimestral e anual
      let projecaoValor: number | null = null
      let projecaoPct: number | null = null
      let statusCor: 'green' | 'amber' | 'red' = 'red'

      if (isAnual) {
        // Meta Anual: Realizado acumulado até o mês atual. Projeção = (realizado / meses decorridos) * 12
        let mesesDecorridos = 0
        if (anoAtual > meta.ano) {
          mesesDecorridos = 12
        } else if (anoAtual < meta.ano) {
          mesesDecorridos = 0
        } else {
          // Mesmo ano: meses passados inteiros + fração do mês atual
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

        // Indicador tricolor: 🟢 projeção ≥ 100%, 🟠 70-99%, 🔴 < 70%
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
          // Mesmo ano
          for (const m of mesesDoPeriodo) {
            if (mesAtual > m) {
              mesesDecorridos += 1
            } else if (mesAtual === m) {
              // Mês corrente: fração dos dias passados do mês
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
        // Indicador mensal padrão: verde ≥100%, âmbar 70-99%, vermelho <70%
        if (atingimentoPct >= 100) {
          statusCor = 'green'
        } else if (atingimentoPct >= 70) {
          statusCor = 'amber'
        } else {
          statusCor = 'red'
        }
      }

      // Sparkline de evolução diária (apenas para metas do mês corrente, quando mensal)
      const isMesCorrente =
        !isTrimestral && !isAnual && meta.ano === anoAtual && meta.mes === mesAtual
      let sparklineData: { dia: number; valorAcumulado: number; pctAcumulado: number }[] = []

      if (isMesCorrente) {
        // Mapear cada dia de 1 até hoje
        const mapaDias = new Map<number, number>()
        for (let d = 1; d <= diaAtual; d++) {
          mapaDias.set(d, 0)
        }

        for (const l of lancamentosMeta) {
          const diaLanc = parseInt(l.data.slice(8, 10), 10)
          if (diaLanc >= 1 && diaLanc <= diaAtual) {
            mapaDias.set(diaLanc, (mapaDias.get(diaLanc) || 0) + (Number(l.valor) || 0))
          }
        }

        let somaAcumulada = 0
        for (let d = 1; d <= diaAtual; d++) {
          somaAcumulada += mapaDias.get(d) || 0
          const pctAcum = meta.valor > 0 ? (somaAcumulada / meta.valor) * 100 : 0
          sparklineData.push({
            dia: d,
            valorAcumulado: somaAcumulada,
            pctAcumulado: Number(pctAcum.toFixed(1)),
          })
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
        empresaNome: empNome,
        centroNome,
        mesNome,
        isAnual,
        periodoLabel,
        isTrimestral,
        isMesCorrente,
        sparklineData,
        realizado,
        atingimentoPct,
        projecaoValor,
        projecaoPct,
        statusCor,
      }
    })
  }, [
    metas,
    selectedEmpresaId,
    lancamentosFinanceiros,
    planoContas,
    contasMap,
    centrosMap,
    empresas,
  ])

  // Exportação CSV do Resumo de Metas
  const exportarResumoMetasCsv = () => {
    if (cardsMetasCalculados.length === 0) return

    const headers = [
      'Empresa',
      'Tipo',
      'Centro de Custo',
      'Período',
      'Referência',
      'Ano',
      'Valor Meta (R$)',
      'Realizado (R$)',
      'Atingimento (%)',
      'Projeção Trimestre (R$)',
      'Status',
    ]

    const rows = cardsMetasCalculados.map((m) => {
      const statusTexto =
        m.statusCor === 'green' ? 'No Alvo' : m.statusCor === 'amber' ? 'Atenção' : 'Em Risco'
      return [
        `"${m.empresaNome.replace(/"/g, '""')}"`,
        `"${m.tipo}"`,
        `"${(m.centroNome || 'Geral').replace(/"/g, '""')}"`,
        `"${m.isTrimestral ? 'Trimestral' : m.isAnual ? 'Anual' : 'Mensal'}"`,
        `"${m.isTrimestral ? m.trimestre : m.isAnual ? `Ano ${m.ano}` : m.mesNome}"`,
        m.ano,
        m.valor.toFixed(2),
        m.realizado.toFixed(2),
        m.atingimentoPct.toFixed(2),
        m.projecaoValor !== null ? m.projecaoValor.toFixed(2) : '',
        `"${statusTexto}"`,
      ].join(';')
    })

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `resumo_metas_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // SEÇÃO COMPARATIVO ENTRE EMPRESAS (MÊS ATUAL)
  const dadosComparativoEmpresas = useMemo(() => {
    const now = new Date()
    const anoAtual = now.getFullYear()
    const mesAtual = now.getMonth() // 0-11
    const mmAtualStr = String(mesAtual + 1).padStart(2, '0')
    const anoMesAtualKey = `${anoAtual}-${mmAtualStr}`

    const NOMES_MESES_ABREV = [
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
    const nomeMesAtual = `${NOMES_MESES_ABREV[mesAtual]}/${anoAtual}`

    const CORES_EMPRESAS = [
      '#2563EB',
      '#10B981',
      '#F59E0B',
      '#8B5CF6',
      '#EC4899',
      '#06B6D4',
      '#F97316',
      '#14B8A6',
      '#6366F1',
      '#84CC16',
    ]

    const dados = empresas.map((emp, idx) => {
      const lancs = lancamentosFinanceiros.filter(
        (l) => l.empresa === emp.id && (l.data || '').slice(0, 7) === anoMesAtualKey,
      )
      const totalMes = lancs.reduce((acc, l) => acc + (Number(l.valor) || 0), 0)

      return {
        empresaId: emp.id,
        nome: emp.nome,
        nomeCurto: emp.nome.length > 15 ? emp.nome.slice(0, 13) + '...' : emp.nome,
        segmento: emp.segmento,
        total: totalMes,
        qtd: lancs.length,
        color: CORES_EMPRESAS[idx % CORES_EMPRESAS.length],
      }
    })

    const totalGeral = dados.reduce((acc, d) => acc + d.total, 0)

    return {
      dados,
      nomeMesAtual,
      totalGeral,
    }
  }, [empresas, lancamentosFinanceiros])

  // Distribuição de gastos por tipo de despesa (todos os lançamentos do usuário)
  const dataGastosPorTipo = useMemo(() => {
    const map = new Map<string, number>()
    for (const l of lancamentosCentro) {
      if (!l.tipo_despesa) continue
      const cur = map.get(l.tipo_despesa) || 0
      map.set(l.tipo_despesa, cur + (Number(l.valor) || 0))
    }
    const total = Array.from(map.values()).reduce((acc, v) => acc + v, 0)
    return {
      data: Array.from(map.entries())
        .map(([tipoId, value], idx) => ({
          name: tiposDespesa.find((t) => t.id === tipoId)?.nome || 'Sem tipo',
          value,
          color: CHART_COLORS[idx % CHART_COLORS.length],
        }))
        .filter((d) => d.value > 0)
        .sort((a, b) => b.value - a.value),
      total,
    }
  }, [lancamentosCentro, tiposDespesa])

  // Contas vinculadas ao balanço do exercício selecionado
  const contasVinculadasBalançoIds = useMemo(() => {
    if (!balancoAtual?.vinculos_contas) return null
    const ids = Object.values(balancoAtual.vinculos_contas).filter(Boolean) as string[]
    return ids.length > 0 ? new Set(ids) : null
  }, [balancoAtual])

  const matrizPlanoItens = useMemo(() => {
    if (!contasVinculadasBalançoIds) return planoContas
    const filtrados = planoContas.filter((p) => contasVinculadasBalançoIds.has(p.conta))
    return filtrados.length > 0 ? filtrados : planoContas
  }, [planoContas, contasVinculadasBalançoIds])

  const matrizContas = useMemo(() => {
    const contasIds = Array.from(new Set(matrizPlanoItens.map((p) => p.conta)))
    const lista = contasIds
      .map((id) => contasMap.get(id))
      .filter((c): c is ContaRecord => Boolean(c))
    return lista.sort((a, b) => (a.codigo || '').localeCompare(b.codigo || ''))
  }, [matrizPlanoItens, contasMap])

  const matrizCentros = useMemo(() => {
    return [...centros].sort((a, b) => {
      const codA = a.codigo || ''
      const codB = b.codigo || ''
      if (codA && codB) return codA.localeCompare(codB)
      return a.nome.localeCompare(b.nome)
    })
  }, [centros])

  const vinculosMatrizMap = useMemo(() => {
    const map = new Map<string, PlanoContaRecord>()
    for (const item of matrizPlanoItens) {
      map.set(`${item.conta}_${item.centro}`, item)
    }
    return map
  }, [matrizPlanoItens])

  // RESUMO DE LANÇAMENTOS POR EMPRESA
  const resumoLancamentosEmpresa = useMemo(() => {
    if (!selectedEmpresaId) return null

    const lancamentosDaEmpresa = lancamentosFinanceiros.filter(
      (l) => l.empresa === selectedEmpresaId,
    )

    const now = new Date()
    const anoAtual = now.getFullYear()
    const mesAtual = now.getMonth() // 0-11

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

    for (const l of lancamentosDaEmpresa) {
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
      totalLancamentosEmpresa: lancamentosDaEmpresa.length,
    }
  }, [selectedEmpresaId, lancamentosFinanceiros, planoContas, contasMap])

  // Gráficos Composição
  const dataComposicaoAtivo = [
    { name: 'Ativo Circulante', value: calcB.ativoCirculante, color: '#2563EB' },
    { name: 'Ativo Não Circulante', value: calcB.ativoNaoCirculante, color: '#0EA5E9' },
  ].filter((d) => d.value > 0)

  const dataComposicaoPassivoPL = [
    { name: 'Passivo Circulante', value: calcB.passivoCirculante, color: '#F59E0B' },
    { name: 'Passivo Não Circulante', value: calcB.passivoNaoCirculante, color: '#8B5CF6' },
    { name: 'Patrimônio Líquido', value: calcB.patrimonioLiquido, color: '#10B981' },
  ].filter((d) => d.value > 0)

  const anosOrdenados = Array.from(new Set(balancos.map((b) => b.ano))).sort((a, b) => a - b)

  const dataEvolucaoPL = anosOrdenados.map((ano) => {
    const b = balancos.find((item) => item.ano === ano)
    const c = calcularBalanco(b)
    return {
      ano: String(ano),
      pl: c.patrimonioLiquido,
      ativo: c.ativoTotal,
    }
  })

  const dataEvolucaoReceitaLucro = anosOrdenados.map((ano) => {
    const d = dres.find((item) => item.empresa === selectedEmpresaId && item.ano === ano)
    const c = calcularDre(d)
    return {
      ano: String(ano),
      receitaLiquida: c.receitaLiquida,
      lucroLiquido: c.lucroLiquido,
    }
  })

  interface AlertaMetaRiscoItem {
    id: string
    titulo: string
    descricao: string
    severidade: 'amber' | 'red' // amber = laranja, red = vermelho
    atingimentoPct: number
    diasRestantes: number
  }

  // Alertas de Metas em Risco (Critérios específicos do requisito 1)
  const alertasMetasEmRisco = useMemo<AlertaMetaRiscoItem[]>(() => {
    const lista: AlertaMetaRiscoItem[] = []
    const agora = new Date()
    const anoAtual = agora.getFullYear()
    const mesAtual = agora.getMonth() + 1 // 1-12
    const diaAtual = agora.getDate()
    const totalDiasNoMes = new Date(anoAtual, agora.getMonth() + 1, 0).getDate()
    const diasRestantesMes = totalDiasNoMes - diaAtual

    // Trimestre atual
    const trimAtualNum = Math.floor((mesAtual - 1) / 3) + 1
    const trimAtualStr = `Q${trimAtualNum}` as const
    const mesesDoTrimestre = [
      (trimAtualNum - 1) * 3 + 1,
      (trimAtualNum - 1) * 3 + 2,
      (trimAtualNum - 1) * 3 + 3,
    ]
    const ultimoMesTrimestre = mesesDoTrimestre[2]
    const ultimoDiaTrimestre = new Date(anoAtual, ultimoMesTrimestre, 0).getDate()
    const fimTrimestreDate = new Date(anoAtual, ultimoMesTrimestre - 1, ultimoDiaTrimestre)
    const diffTimeTrimestre = fimTrimestreDate.getTime() - agora.getTime()
    const diasRestantesTrimestre = Math.max(0, Math.ceil(diffTimeTrimestre / (1000 * 60 * 60 * 24)))

    // Filtrar metas ativas do período corrente (mensais do mês atual OU trimestrais do trimestre atual OU anuais do ano atual)
    const metasCorrentes = metas.filter((m) => {
      const isAtiva = m.ativo ?? true
      if (!isAtiva) return false
      if (m.ano !== anoAtual) return false
      if (selectedEmpresaId && m.empresa !== selectedEmpresaId) return false

      const isTrimestral = m.periodo === 'Trimestral'
      const isAnual = m.periodo === 'Anual'
      if (isAnual) return true
      if (isTrimestral) {
        return m.trimestre === trimAtualStr
      }
      return m.mes === mesAtual
    })

    for (const meta of metasCorrentes) {
      const isTrimestral = meta.periodo === 'Trimestral'
      const isAnual = meta.periodo === 'Anual'
      const emp = meta.expand?.empresa || empresas.find((e) => e.id === meta.empresa)
      const empNome = emp?.nome || 'Empresa'
      const centroObj =
        meta.expand?.centro || (meta.centro ? centrosMap.get(meta.centro) : undefined)
      const centroLabel = centroObj
        ? ` · ${centroObj.codigo ? `${centroObj.codigo} ` : ''}${centroObj.nome}`
        : ''
      const periodoTag = isAnual
        ? ` [Anual ${meta.ano}]`
        : isTrimestral
          ? ` [Trimestral ${meta.trimestre}]`
          : ''
      const nomeIdentificador = `Meta de ${meta.tipo}${centroLabel}${periodoTag} (${empNome})`

      // Calcular realizado da meta respeitando tipo e centro vinculado
      const lancs = lancamentosFinanceiros.filter((l) => {
        if (l.empresa !== meta.empresa) return false
        if (!l.data) return false
        const anoLanc = parseInt(l.data.slice(0, 4), 10)
        const mesLanc = parseInt(l.data.slice(5, 7), 10)
        if (anoLanc !== meta.ano) return false

        if (isAnual) {
          // Todos os meses até o atual
          if (mesLanc > mesAtual) return false
        } else if (isTrimestral) {
          if (!mesesDoTrimestre.includes(mesLanc)) return false
        } else {
          if (mesLanc !== meta.mes) return false
        }

        const pc = l.expand?.plano_conta || planoContas.find((p) => p.id === l.plano_conta)
        const conta = pc?.expand?.conta || (pc?.conta ? contasMap.get(pc.conta) : undefined)
        if (conta?.tipo !== meta.tipo) return false

        if (meta.centro) {
          const centroDoPlano = pc?.expand?.centro?.id || pc?.centro
          if (centroDoPlano !== meta.centro) return false
        }
        return true
      })

      const realizado = lancs.reduce((acc, l) => acc + (Number(l.valor) || 0), 0)
      const pct = meta.valor > 0 ? (realizado / meta.valor) * 100 : 0
      const temLancamentos = lancs.length > 0 && realizado > 0

      if (isAnual) {
        // Regra Anual: < 50% faltando 3 meses ou menos para o fim do ano
        const mesesRestantesAno = 12 - mesAtual
        if (pct < 50 && mesesRestantesAno <= 3) {
          lista.push({
            id: `meta-risco-anual-${meta.id}`,
            titulo: `Meta Anual em risco: ${nomeIdentificador} está em ${formatPercent(
              pct,
              0,
            )} faltando ${mesesRestantesAno} ${mesesRestantesAno === 1 ? 'mês' : 'meses'}`,
            descricao: `Realizado acumulado de ${formatBrlMil(realizado)} de ${formatBrlMil(
              meta.valor,
            )} (${formatPercent(pct, 1)}). Faltam apenas ${mesesRestantesAno} ${
              mesesRestantesAno === 1 ? 'mês' : 'meses'
            } para o encerramento do exercício ${meta.ano}.`,
            severidade: 'amber',
            atingimentoPct: pct,
            diasRestantes: mesesRestantesAno * 30,
          })
        }
      } else if (isTrimestral) {
        // Regra Trimestral: menos de 50% e faltando menos de 15 dias para o fim do trimestre
        if (pct < 50 && diasRestantesTrimestre <= 15) {
          lista.push({
            id: `meta-risco-trim-${meta.id}`,
            titulo: `Meta Trimestral em risco: ${nomeIdentificador} está em ${formatPercent(
              pct,
              0,
            )} faltando ${diasRestantesTrimestre} ${diasRestantesTrimestre === 1 ? 'dia' : 'dias'}`,
            descricao: `Realizado acumulado de ${formatBrlMil(realizado)} de ${formatBrlMil(
              meta.valor,
            )} (${formatPercent(pct, 1)}). Faltam apenas ${diasRestantesTrimestre} ${
              diasRestantesTrimestre === 1 ? 'dia' : 'dias'
            } para o encerramento do trimestre (${meta.trimestre}/${meta.ano}).`,
            severidade: 'amber',
            atingimentoPct: pct,
            diasRestantes: diasRestantesTrimestre,
          })
        }
      } else {
        // Critério 2 (Vermelho): Meta com 0% de atingimento e mais de 15 dias do mês já passados
        if (!temLancamentos && diaAtual > 15) {
          lista.push({
            id: `meta-zero-${meta.id}`,
            titulo: `Atenção: ${nomeIdentificador} ainda não teve lançamentos este mês`,
            descricao: `Passaram-se ${diaAtual} dias do mês e nenhum lançamento de ${meta.tipo.toLowerCase()} foi registrado para esta meta de ${formatBrlMil(
              meta.valor,
            )}.`,
            severidade: 'red',
            atingimentoPct: 0,
            diasRestantes: diasRestantesMes,
          })
          continue
        }

        // Critério 1 (Laranja/Amber): Meta com menos de 50% de atingimento E faltando 5 dias ou menos para o fim do mês
        if (pct < 50 && diasRestantesMes <= 5) {
          lista.push({
            id: `meta-risco-${meta.id}`,
            titulo: `Meta em risco: ${nomeIdentificador} está em ${formatPercent(
              pct,
              0,
            )} faltando ${diasRestantesMes} ${diasRestantesMes === 1 ? 'dia' : 'dias'}`,
            descricao: `Realizado de ${formatBrlMil(realizado)} de ${formatBrlMil(
              meta.valor,
            )} (${formatPercent(pct, 1)}). Faltam apenas ${diasRestantesMes} ${
              diasRestantesMes === 1 ? 'dia' : 'dias'
            } para encerrar o mês.`,
            severidade: 'amber',
            atingimentoPct: pct,
            diasRestantes: diasRestantesMes,
          })
        }
      }
    }

    return lista
  }, [
    metas,
    selectedEmpresaId,
    empresas,
    centrosMap,
    lancamentosFinanceiros,
    planoContas,
    contasMap,
  ])

  const [mostrarTodosAlertas, setMostrarTodosAlertas] = useState(false)
  const alertasVisiveis = mostrarTodosAlertas
    ? alertasMetasEmRisco
    : alertasMetasEmRisco.slice(0, 4)

  const scrollToMetas = () => {
    const el = document.getElementById('secao-metas-dashboard')
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  // Lista de Últimos Balanços
  const ultimosBalancosList = allBalancos.slice(0, 5).map((b) => {
    const emp = empresas.find((e) => e.id === b.empresa)
    const cb = calcularBalanco(b)
    const lc = cb.passivoCirculante > 0 ? cb.ativoCirculante / cb.passivoCirculante : null
    return {
      id: b.id,
      empresaId: b.empresa,
      empresaNome: emp?.nome || 'Empresa',
      segmento: emp?.segmento || 'Outros',
      cnpj: emp?.cnpj || '',
      ano: b.ano,
      ativoTotal: cb.ativoTotal,
      passivoTotal: cb.passivoTotal,
      pl: cb.patrimonioLiquido,
      liquidezCorrente: lc,
    }
  })

  if (isLoadingEmpresas || (loadingData && empresas.length === 0)) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-500 font-medium">Carregando painel de indicadores...</p>
        </div>
      </div>
    )
  }

  if (empresas.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center max-w-lg mx-auto mt-8 shadow-sm">
        <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Building2 className="w-7 h-7" />
        </div>
        <h3 className="text-lg font-bold text-[#0B1F3A]">Nenhuma empresa cadastrada</h3>
        <p className="text-xs text-slate-500 mt-2 mb-6">
          Cadastre sua primeira empresa cliente para iniciar o diagnóstico financeiro e balanços
          patrimoniais.
        </p>
        <Button asChild className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs">
          <Link to="/empresas">Cadastrar Primeira Empresa</Link>
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
        selectedEmpresaId={selectedEmpresaId}
        selectedAno={selectedAno}
        onMetaChanged={loadData}
      />

      {/* Banner Empresa Selecionada */}
      {selectedEmpresa && (
        <div className="bg-white border border-slate-200/80 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-[#0B1F3A]">{selectedEmpresa.nome}</h2>
                <Badge
                  variant="secondary"
                  className="text-[11px] font-semibold bg-blue-50 text-blue-700 border-blue-200"
                >
                  {selectedEmpresa.segmento}
                </Badge>
              </div>
              <p className="text-xs text-[#5B6B7F]">
                CNPJ: {formatCnpj(selectedEmpresa.cnpj)} · Exercício de Referência:{' '}
                <span className="font-semibold text-slate-700">{selectedAno}</span>
              </p>
            </div>
          </div>

          <Button
            asChild
            size="sm"
            variant="outline"
            className="text-xs border-blue-200 hover:bg-blue-50 text-blue-700 self-start sm:self-auto font-medium"
          >
            <Link to={`/empresas/${selectedEmpresa.id}`}>
              Ver Análise Completa <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Link>
          </Button>
        </div>
      )}

      {/* Grid de KPIs - 2 colunas mobile, 6 colunas desktop */}
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
          <p className="text-[11px] text-slate-500 mt-1">Recursos sob gestão</p>
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
                ? 'Capacidade adequada (≥1,0)'
                : calcInd.liquidezCorrente >= 0.8
                  ? 'Atenção moderada'
                  : 'Insuficiência (<0,8)'}
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

      {/* ========================================================================= */}
      {/* SEÇÃO 1: ALERTAS DE METAS EM RISCO (LOGO ABAIXO DOS KPIS) */}
      {/* ========================================================================= */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-500" />
            Alertas de Metas em Risco
            {alertasMetasEmRisco.length > 0 && (
              <Badge
                className={`text-[10px] font-semibold ${
                  alertasMetasEmRisco.some((a) => a.severidade === 'red')
                    ? 'bg-red-50 text-red-700 border-red-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}
              >
                {alertasMetasEmRisco.length} meta(s) em risco
              </Badge>
            )}
          </h2>

          {alertasMetasEmRisco.length > 4 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setMostrarTodosAlertas((prev) => !prev)}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 h-7 px-2"
            >
              {mostrarTodosAlertas ? 'Mostrar menos' : `Ver todos (${alertasMetasEmRisco.length})`}
            </Button>
          )}
        </div>

        {alertasMetasEmRisco.length === 0 ? (
          <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3.5 flex items-center gap-3 shadow-2xs">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-emerald-900">Todas as metas estão em dia ✓</p>
              <p className="text-[11px] text-emerald-700">
                Nenhuma meta com risco de não atingimento ou sem lançamentos identificada no
                período.
              </p>
            </div>
          </div>
        ) : (
          <div
            className={`grid gap-3 ${
              alertasVisiveis.length === 1
                ? 'grid-cols-1'
                : alertasVisiveis.length === 2
                  ? 'grid-cols-1 sm:grid-cols-2'
                  : alertasVisiveis.length === 3
                    ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                    : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
            }`}
          >
            {alertasVisiveis.map((alerta) => {
              const isRed = alerta.severidade === 'red'
              const cardBg = isRed
                ? 'bg-red-50/80 border-red-300 hover:bg-red-100/70'
                : 'bg-amber-50/80 border-amber-300 hover:bg-amber-100/70'
              const iconBoxBg = isRed ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
              const titleColor = isRed ? 'text-red-950' : 'text-amber-950'
              const descColor = isRed ? 'text-red-800' : 'text-amber-800'

              return (
                <button
                  key={alerta.id}
                  type="button"
                  onClick={scrollToMetas}
                  className={`text-left p-3.5 rounded-xl border shadow-2xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between gap-2 ${cardBg}`}
                >
                  <div className="flex items-start gap-2.5">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold ${iconBoxBg}`}
                    >
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className={`text-xs font-bold leading-snug line-clamp-2 ${titleColor}`}>
                        {alerta.titulo}
                      </p>
                      <p className={`text-[11px] mt-1 line-clamp-2 ${descColor}`}>
                        {alerta.descricao}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-black/5 text-[10px] font-semibold text-slate-600">
                    <span className="flex items-center gap-1 text-blue-700">
                      Ver meta na seção abaixo <ArrowRight className="w-3 h-3" />
                    </span>
                    <span className={isRed ? 'text-red-700 font-bold' : 'text-amber-700 font-bold'}>
                      {isRed ? '0% Realizado' : `${alerta.atingimentoPct.toFixed(0)}% Atingido`}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* SEÇÃO METAS DE LANÇAMENTOS (ABAIXO DOS KPIS E ALERTAS, ANTES DOS GRÁFICOS) */}
      {/* ========================================================================= */}
      <Card id="secao-metas-dashboard" className="bg-white border-slate-200 shadow-2xs scroll-mt-6">
        <CardHeader className="pb-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
              <Target className="w-4 h-4 text-blue-600" />
              Metas de Lançamentos (Mensais, Trimestrais e Anuais)
              {cardsMetasCalculados.length > 0 && (
                <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] font-semibold">
                  {cardsMetasCalculados.length} ativa(s)
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">
              Acompanhamento de metas mensais, trimestrais e anuais com evolução diária (sparkline)
              e projeção automática
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={exportarResumoMetasCsv}
              className="text-xs border-slate-200 text-slate-700 hover:bg-slate-50 gap-1.5 font-medium"
              title="Exportar resumo de metas em arquivo CSV"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              Exportar CSV
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => setModalMetasOpen(true)}
              className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold self-start sm:self-auto gap-1.5 shrink-0 shadow-xs"
            >
              <Target className="w-3.5 h-3.5" />
              Gerenciar Metas
            </Button>
          </div>
        </CardHeader>

        <CardContent className="pt-4">
          {cardsMetasCalculados.length === 0 ? (
            <div className="py-8 flex flex-col items-center justify-center text-center bg-slate-50/70 rounded-xl border border-dashed border-slate-200">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-2">
                <Target className="w-5 h-5" />
              </div>
              <p className="text-xs font-bold text-slate-700">Nenhuma meta ativa cadastrada</p>
              <p className="text-[11px] text-slate-500 mt-0.5 max-w-sm mb-3">
                Cadastre metas mensais ou trimestrais de receitas ou despesas para acompanhar o
                progresso, atingimento e projeção em tempo real.
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

                const lineColor =
                  m.statusCor === 'green'
                    ? '#10B981'
                    : m.statusCor === 'amber'
                      ? '#F59E0B'
                      : '#EF4444'

                return (
                  <div
                    key={m.id}
                    className={`p-3.5 rounded-xl bg-white border ${borderCard} shadow-2xs hover:shadow-md transition-all flex flex-col justify-between`}
                  >
                    <div>
                      {/* Topo do Card da Meta */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p
                            className="text-xs font-bold text-[#0B1F3A] truncate"
                            title={
                              m.centroNome
                                ? `Meta de ${m.tipo} · ${m.centroNome} (${m.empresaNome})`
                                : `Meta de ${m.tipo} (${m.empresaNome})`
                            }
                          >
                            Meta de {m.tipo}
                            {m.centroNome && (
                              <span className="font-semibold text-blue-700 ml-1">
                                · {m.centroNome}
                              </span>
                            )}
                          </p>
                          <p className="text-[10px] text-slate-500 font-medium flex items-center gap-1.5 flex-wrap">
                            <span>{m.empresaNome}</span>
                            <span>·</span>
                            <span className="font-semibold text-slate-700">{m.periodoLabel}</span>
                          </p>
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

                      {/* Valores: Meta vs Realizado */}
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
                        {/* Projeção (para trimestrais e anuais) */}
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
                        )}{' '}
                      </div>

                      {/* Barra de Progresso Visual */}
                      <div className="mt-2.5">
                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${corProgresso}`}
                            style={{ width: `${Math.min(m.atingimentoPct, 100)}%` }}
                          />
                        </div>
                      </div>

                      {/* Mini Gráfico de Linha (Sparkline) para metas do mês corrente */}
                      {m.isMesCorrente && m.sparklineData && m.sparklineData.length > 0 ? (
                        <div className="mt-2.5 pt-2 border-t border-slate-100">
                          <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium mb-1">
                            <span>Evolução diária (Dia 1 ao {m.sparklineData.length})</span>
                            <span className="text-slate-600 font-semibold">
                              {m.sparklineData[m.sparklineData.length - 1]?.pctAcumulado}%
                            </span>
                          </div>
                          <div className="h-[60px] w-full">
                            <ResponsiveContainer width="100%" height={60}>
                              <LineChart
                                data={m.sparklineData}
                                margin={{ top: 4, right: 4, left: 4, bottom: 4 }}
                              >
                                <RechartsTooltip
                                  content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                      const d = payload[0].payload
                                      return (
                                        <div className="bg-[#0B1F3A] text-white text-[11px] rounded-md px-2 py-1 shadow-md">
                                          <p className="font-semibold">Dia {d.dia}</p>
                                          <p className="text-emerald-300">
                                            {formatBrlMil(d.valorAcumulado)} ({d.pctAcumulado}%)
                                          </p>
                                        </div>
                                      )
                                    }
                                    return null
                                  }}
                                />
                                <Line
                                  type="monotone"
                                  dataKey="pctAcumulado"
                                  stroke={lineColor}
                                  strokeWidth={2}
                                  dot={false}
                                  isAnimationActive={true}
                                />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      ) : !m.isTrimestral ? (
                        <div className="mt-2 pt-2 border-t border-slate-100 text-[10px] text-slate-400 text-center">
                          Meta de {m.mesNome}/{m.ano}
                        </div>
                      ) : null}
                    </div>

                    {/* Rodapé: % de Atingimento e Badge */}
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

      {/* Gráficos de Composição e Evolução */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Composição do Ativo (Donut) */}
        <Card className="bg-white border-slate-200 shadow-2xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-[#0B1F3A] flex items-center justify-between">
              <span className="flex items-center gap-2">
                <PieIcon className="w-4 h-4 text-blue-600" />
                Composição do Ativo
              </span>
              <span className="text-xs font-normal text-slate-500">
                Total: {formatBrlMil(calcB.ativoTotal)}
              </span>
            </CardTitle>
            <CardDescription className="text-xs">
              Divisão entre Ativo Circulante (curto prazo) e Não Circulante (longo
              prazo/imobilizado)
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
              Origem dos recursos: Terceiros (Circulante/Não Circulante) vs Próprios (PL)
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

        {/* Evolução Histórica do Patrimônio Líquido e Ativo */}
        <Card className="bg-white border-slate-200 shadow-2xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              Evolução Patrimonial (Ativo e PL)
            </CardTitle>
            <CardDescription className="text-xs">
              Crescimento do Ativo Total e Patrimônio Líquido ao longo dos exercícios
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
                      <linearGradient id="colorAtivo" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563EB" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorPL" x1="0" y1="0" x2="0" y2="1">
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
                      fill="url(#colorAtivo)"
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="pl"
                      name="Patrimônio Líquido"
                      stroke="#10B981"
                      fillOpacity={1}
                      fill="url(#colorPL)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-xs text-slate-400">
                Sem histórico de balanços
              </div>
            )}
          </CardContent>
        </Card>

        {/* Receita Líquida vs Lucro Líquido (Histórico) */}
        <Card className="bg-white border-slate-200 shadow-2xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-600" />
              Receita Líquida vs Lucro Líquido
            </CardTitle>
            <CardDescription className="text-xs">
              Comparação anual do faturamento com o resultado final da operação (DRE)
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

        {/* Distribuição de Gastos por Tipo de Despesa (Donut) */}
        <Card className="bg-white border-slate-200 shadow-2xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-[#0B1F3A] flex items-center justify-between">
              <span className="flex items-center gap-2">
                <PieIcon className="w-4 h-4 text-blue-600" />
                Gastos por Tipo de Despesa
              </span>
              <span className="text-xs font-normal text-slate-500">
                Total: {formatBrlMil(dataGastosPorTipo.total)}
              </span>
            </CardTitle>
            <CardDescription className="text-xs">
              Distribuição dos lançamentos de centros de custo agrupados por tipo de despesa.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            {dataGastosPorTipo.data.length > 0 ? (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={dataGastosPorTipo.data}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {dataGastosPorTipo.data.map((entry, index) => (
                        <Cell key={`cell-g-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      formatter={(val: any) => [formatBrlMil(Number(val)), 'Valor']}
                    />
                    <Legend
                      verticalAlign="bottom"
                      height={36}
                      formatter={(val, entry: any) => {
                        const total = dataGastosPorTipo.total || 1
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
                Nenhum lançamento registrado
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ========================================================================= */}
      {/* SEÇÃO: RESUMO DE LANÇAMENTOS POR EMPRESA (COMPARATIVO E GRÁFICO 6 MESES) */}
      {/* ========================================================================= */}
      <Card className="bg-white border-slate-200 shadow-2xs">
        <CardHeader className="pb-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-600" />
              Resumo de Lançamentos por Empresa
              {selectedEmpresa && (
                <Badge
                  variant="outline"
                  className="ml-1 bg-blue-50 text-blue-700 border-blue-200 text-[11px] font-semibold"
                >
                  {selectedEmpresa.nome}
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">
              Comparativo mês a mês e histórico dos últimos 6 meses segmentado por tipo de conta
              (Ativo, Passivo, Receita, Despesa)
            </CardDescription>
          </div>

          <Button
            asChild
            size="sm"
            variant="outline"
            className="text-xs border-blue-200 hover:bg-blue-50 text-blue-700 self-start sm:self-auto font-medium gap-1 shrink-0"
          >
            <Link to="/lancamentos">
              Ir para Lançamentos <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </Button>
        </CardHeader>

        <CardContent className="pt-4 space-y-4">
          {!selectedEmpresaId || !resumoLancamentosEmpresa ? (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
                <Building2 className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-[#0B1F3A]">Nenhuma empresa selecionada</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                Selecione uma empresa no topo do dashboard para visualizar os lançamentos do mês
                atual, comparativo com o mês anterior e gráfico segmentado por tipo de conta.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Cards Comparativos Mês Atual vs Mês Anterior */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Total Mês Atual */}
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Mês Atual ({resumoLancamentosEmpresa.nomeMesAtual})
                    </span>
                    <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-[10px] font-semibold">
                      {resumoLancamentosEmpresa.qtdMesAtual} lanç.
                    </Badge>
                  </div>
                  <div className="mt-2 text-xl font-bold text-[#0B1F3A] tracking-tight">
                    <AnimatedCounter
                      value={resumoLancamentosEmpresa.totalMesAtual}
                      formatter={(v) => formatBrlMil(v)}
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Volume financeiro lançado no mês
                  </p>
                </div>

                {/* Total Mês Anterior */}
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Mês Anterior ({resumoLancamentosEmpresa.nomeMesAnterior})
                    </span>
                    <Badge variant="outline" className="text-[10px] font-semibold text-slate-600">
                      {resumoLancamentosEmpresa.qtdMesAnterior} lanç.
                    </Badge>
                  </div>
                  <div className="mt-2 text-xl font-bold text-slate-700 tracking-tight">
                    <AnimatedCounter
                      value={resumoLancamentosEmpresa.totalMesAnterior}
                      formatter={(v) => formatBrlMil(v)}
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">Base de comparação do período</p>
                </div>

                {/* Variação Percentual */}
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Variação Mês a Mês
                    </span>
                    {resumoLancamentosEmpresa.variacaoPercentual !== null && (
                      <div
                        className={`p-1 rounded-md ${
                          resumoLancamentosEmpresa.variacaoPercentual >= 0
                            ? 'bg-emerald-50 text-emerald-600'
                            : 'bg-red-50 text-red-600'
                        }`}
                      >
                        {resumoLancamentosEmpresa.variacaoPercentual >= 0 ? (
                          <TrendingUp className="w-3.5 h-3.5" />
                        ) : (
                          <TrendingDown className="w-3.5 h-3.5" />
                        )}
                      </div>
                    )}
                  </div>
                  <div
                    className={`mt-2 text-xl font-bold tracking-tight ${
                      resumoLancamentosEmpresa.variacaoPercentual === null
                        ? 'text-slate-400'
                        : resumoLancamentosEmpresa.variacaoPercentual >= 0
                          ? 'text-emerald-600'
                          : 'text-red-600'
                    }`}
                  >
                    {resumoLancamentosEmpresa.variacaoPercentual !== null ? (
                      <>
                        {resumoLancamentosEmpresa.variacaoPercentual > 0 ? '+' : ''}
                        <AnimatedCounter
                          value={resumoLancamentosEmpresa.variacaoPercentual}
                          formatter={(v) => formatPercent(v, 1)}
                        />
                      </>
                    ) : (
                      '—'
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {resumoLancamentosEmpresa.variacaoPercentual === null
                      ? 'Sem base anterior'
                      : resumoLancamentosEmpresa.variacaoPercentual > 0
                        ? 'Crescimento em relação ao mês anterior'
                        : resumoLancamentosEmpresa.variacaoPercentual < 0
                          ? 'Redução em relação ao mês anterior'
                          : 'Estável em relação ao mês anterior'}
                  </p>
                </div>
              </div>

              {/* Gráfico de Barras Agrupadas/Empilhadas dos Últimos 6 Meses por Tipo de Conta */}
              <div className="pt-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-2">
                  <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <BarChart3 className="w-3.5 h-3.5 text-blue-600" />
                    Lançamentos por Mês (Últimos 6 Meses por Tipo de Conta)
                  </h4>
                  <span className="text-[11px] text-slate-500">
                    Total cadastrado: {resumoLancamentosEmpresa.totalLancamentosEmpresa}{' '}
                    lançamento(s)
                  </span>
                </div>

                <div className="h-68 w-full bg-slate-50/50 rounded-xl p-3 border border-slate-100">
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart
                      data={resumoLancamentosEmpresa.dadosUltimos6Meses}
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
            </div>
          )}
        </CardContent>
      </Card>

      {/* ========================================================================= */}
      {/* SEÇÃO: COMPARATIVO ENTRE EMPRESAS (ABAIXO DE RESUMO DE LANÇAMENTOS) */}
      {/* ========================================================================= */}
      <Card className="bg-white border-slate-200 shadow-2xs">
        <CardHeader className="pb-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-600" />
              Comparativo entre Empresas
              <Badge
                variant="outline"
                className="ml-1 bg-slate-50 text-slate-700 border-slate-200 text-[11px] font-semibold"
              >
                Mês Atual: {dadosComparativoEmpresas.nomeMesAtual}
              </Badge>
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">
              Comparação lado a lado do total de lançamentos de cada empresa no mês corrente com
              cores distintas
            </CardDescription>
          </div>

          <div className="text-left sm:text-right">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">
              Total Geral do Mês
            </span>
            <span className="text-sm font-bold text-[#0B1F3A]">
              {formatBrlMil(dadosComparativoEmpresas.totalGeral)}
            </span>
          </div>
        </CardHeader>

        <CardContent className="pt-4">
          {empresas.length <= 1 ? (
            <div className="py-10 flex flex-col items-center justify-center text-center bg-slate-50/70 rounded-xl border border-dashed border-slate-200">
              <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-2">
                <Building2 className="w-6 h-6" />
              </div>
              <h3 className="text-xs font-bold text-[#0B1F3A]">
                Cadastre mais empresas para ver o comparativo
              </h3>
              <p className="text-[11px] text-slate-500 mt-1 max-w-sm mb-3">
                O gráfico comparativo posiciona todas as empresas do usuário lado a lado no mês
                atual. Adicione uma segunda empresa para comparar volumes.
              </p>
              <Button
                asChild
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
              >
                <Link to="/empresas">Cadastrar Nova Empresa</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Gráfico de Barras Agrupadas com Recharts BarChart */}
              <div className="h-72 w-full bg-slate-50/50 rounded-xl p-3 border border-slate-100">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart
                    data={dadosComparativoEmpresas.dados}
                    margin={{ top: 15, right: 15, left: -10, bottom: 25 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis
                      dataKey="nomeCurto"
                      tick={{ fontSize: 11, fill: '#475569', fontWeight: 600 }}
                      interval={0}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: '#64748B' }}
                      tickFormatter={(v) => `R$ ${Math.round(v / 1000)}k`}
                    />
                    <RechartsTooltip
                      formatter={(val: any, _name: any, item: any) => [
                        formatBrlMil(Number(val)),
                        `Total (${item.payload.nome} - ${item.payload.segmento})`,
                      ]}
                      labelFormatter={(_label, payload) => {
                        if (payload && payload[0]) {
                          return `Empresa: ${payload[0].payload.nome}`
                        }
                        return ''
                      }}
                    />
                    <Bar dataKey="total" name="Total Lançado (R$)" radius={[4, 4, 0, 0]}>
                      {dadosComparativoEmpresas.dados.map((entry, index) => (
                        <Cell key={`cell-comp-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Cards de Resumo por Empresa no Mês */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 pt-1">
                {dadosComparativoEmpresas.dados.map((d) => (
                  <Link
                    key={d.empresaId}
                    to={`/dashboard/empresa/${d.empresaId}`}
                    className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between gap-2 hover:border-blue-300 hover:shadow-sm hover:scale-[1.01] transition-all group"
                    title={`Abrir Dashboard Exclusivo de ${d.nome}`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: d.color }}
                        />
                        <p
                          className="text-xs font-bold text-[#0B1F3A] group-hover:text-blue-600 truncate transition-colors"
                          title={d.nome}
                        >
                          {d.nome}
                        </p>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5 truncate">{d.segmento}</p>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-xs font-extrabold text-slate-800 group-hover:text-blue-700 transition-colors">
                        {formatBrlMil(d.total)}
                      </p>
                      <p className="text-[10px] text-slate-400">{d.qtd} lanç.</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Seção Matriz Plano de Contas */}
      <Card className="bg-white border-slate-200 shadow-2xs">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <CardTitle className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
              <FolderTree className="w-4 h-4 text-blue-600" />
              Matriz Plano de Contas
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">
              Mapeamento visual dos vínculos entre Contas (CO-xxx) e Centros de Custo (CC-xxx)
              {selectedEmpresa ? (
                <span>
                  {' '}
                  ·{' '}
                  <Link
                    to={`/dashboard/empresa/${selectedEmpresa.id}`}
                    className="text-blue-600 hover:underline font-semibold"
                    title="Ver Dashboard desta empresa"
                  >
                    {selectedEmpresa.nome}
                  </Link>{' '}
                  ({selectedAno})
                </span>
              ) : (
                ''
              )}
            </CardDescription>
          </div>
          <Button
            asChild
            size="sm"
            variant="outline"
            className="text-xs border-blue-200 hover:bg-blue-50 text-blue-700 self-start sm:self-auto font-medium gap-1 shrink-0"
          >
            <Link to="/plano-contas">
              Gerenciar Plano <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="pt-4">
          {matrizPlanoItens.length === 0 ||
          matrizContas.length === 0 ||
          matrizCentros.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mb-3">
                <FolderTree className="w-6 h-6 text-slate-400" />
              </div>
              <h3 className="text-sm font-bold text-[#0B1F3A]">Nenhum vínculo cadastrado</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mb-4">
                Não há dados cadastrados no Plano de Contas para compor a matriz de vínculos.
              </p>
              <Button
                asChild
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs"
              >
                <Link to="/plano-contas">Cadastrar Vínculos no Plano de Contas</Link>
              </Button>
            </div>
          ) : (
            <div>
              {/* Legenda e Totalizadores */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 text-xs text-slate-600">
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 font-bold text-[10px]">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </span>
                    <span className="font-medium text-slate-700">Vínculo Ativo</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="inline-block w-5 h-5 rounded bg-slate-100 border border-slate-200 text-slate-400" />
                    <span className="text-slate-500">Sem Vínculo</span>
                  </div>
                </div>
                <div className="text-[11px] text-slate-500 font-medium">
                  {matrizContas.length} conta(s) · {matrizCentros.length} centro(s) ·{' '}
                  {matrizPlanoItens.length} vínculo(s)
                </div>
              </div>

              {/* Visualização Desktop: Grid / Tabela da Matriz */}
              <div className="hidden md:block overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="py-2.5 px-3 font-bold text-[#0B1F3A] sticky left-0 bg-slate-50 z-10 min-w-[220px] shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]">
                        Conta
                      </th>
                      {matrizCentros.map((centro) => (
                        <th
                          key={centro.id}
                          className="py-2.5 px-3 font-semibold text-slate-700 text-center min-w-[120px]"
                          title={`${centro.codigo || '—'} - ${centro.nome} (${centro.tipo})`}
                        >
                          <div className="flex flex-col items-center">
                            <span className="font-mono text-[11px] text-blue-700 font-bold">
                              {centro.codigo || '—'}
                            </span>
                            <span className="text-[11px] text-slate-700 truncate max-w-[110px] font-medium">
                              {centro.nome}
                            </span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {matrizContas.map((conta) => (
                      <tr key={conta.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2.5 px-3 sticky left-0 bg-white z-10 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]">
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-slate-800 text-[11px]">
                                {conta.codigo || '—'}
                              </span>
                              <Badge
                                variant="outline"
                                className="text-[9px] px-1 py-0 border-slate-200 text-slate-500 font-normal"
                              >
                                {conta.tipo}
                              </Badge>
                            </div>
                            <span
                              className="text-xs text-slate-700 font-medium truncate max-w-[210px]"
                              title={conta.nome}
                            >
                              {conta.nome}
                            </span>
                          </div>
                        </td>
                        {matrizCentros.map((centro) => {
                          const vinculo = vinculosMatrizMap.get(`${conta.id}_${centro.id}`)
                          const tipoDespesa = vinculo?.tipo_despesa
                            ? tiposMap.get(vinculo.tipo_despesa)
                            : undefined

                          return (
                            <td key={centro.id} className="py-2.5 px-3 text-center align-middle">
                              {vinculo ? (
                                <div
                                  className="inline-flex flex-col items-center justify-center p-1 rounded-md bg-emerald-50/90 border border-emerald-200 hover:bg-emerald-100 transition-colors group cursor-default"
                                  title={`Vínculo: ${vinculo.codigo || 'PC'} | ${conta.nome} ↔ ${centro.nome}${
                                    tipoDespesa ? ` (${tipoDespesa.nome})` : ''
                                  }${vinculo.descricao ? ` - ${vinculo.descricao}` : ''}`}
                                >
                                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-600 text-white shadow-xs">
                                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                                  </span>
                                  {vinculo.codigo && (
                                    <span className="text-[9px] font-mono font-semibold text-emerald-800 mt-0.5">
                                      {vinculo.codigo}
                                    </span>
                                  )}
                                  {tipoDespesa && (
                                    <span
                                      className="text-[9px] text-slate-600 truncate max-w-[90px] mt-0.5 px-1 py-0.2 bg-white rounded border border-emerald-200/60"
                                      title={tipoDespesa.nome}
                                    >
                                      {tipoDespesa.codigo || tipoDespesa.nome}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <div className="inline-flex items-center justify-center w-6 h-6 rounded bg-slate-100/70 border border-slate-200/60 text-slate-300">
                                  <span className="text-xs">·</span>
                                </div>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Visualização Mobile: Lista Agrupada por Conta */}
              <div className="md:hidden space-y-3">
                {matrizContas.map((conta) => {
                  const vinculosConta = matrizCentros
                    .map((centro) => ({
                      centro,
                      vinculo: vinculosMatrizMap.get(`${conta.id}_${centro.id}`),
                    }))
                    .filter((item) => Boolean(item.vinculo))

                  return (
                    <div
                      key={conta.id}
                      className="p-3 bg-slate-50/70 rounded-xl border border-slate-200 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-blue-700 text-xs">
                            {conta.codigo || '—'}
                          </span>
                          <span className="font-semibold text-slate-800 text-xs truncate max-w-[180px]">
                            {conta.nome}
                          </span>
                        </div>
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0 border-slate-200 text-slate-600"
                        >
                          {conta.tipo}
                        </Badge>
                      </div>

                      {vinculosConta.length === 0 ? (
                        <p className="text-[11px] text-slate-400 italic">
                          Nenhum centro vinculado a esta conta.
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                          {vinculosConta.map(({ centro, vinculo }) => {
                            if (!vinculo) return null
                            const tipoDespesa = vinculo.tipo_despesa
                              ? tiposMap.get(vinculo.tipo_despesa)
                              : undefined

                            return (
                              <div
                                key={centro.id}
                                className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200 text-xs shadow-2xs"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-600 text-white shrink-0">
                                    <Check className="w-3 h-3 stroke-[3]" />
                                  </span>
                                  <div className="min-w-0">
                                    <p className="font-semibold text-slate-800 truncate text-[11px]">
                                      <span className="font-mono text-blue-700 mr-1">
                                        {centro.codigo || '—'}
                                      </span>
                                      {centro.nome}
                                    </p>
                                    {tipoDespesa && (
                                      <p className="text-[10px] text-slate-500 truncate flex items-center gap-1">
                                        <Tag className="w-2.5 h-2.5 text-slate-400" />
                                        {tipoDespesa.codigo || '—'} · {tipoDespesa.nome}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                {vinculo.codigo && (
                                  <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] font-mono px-1.5 py-0 shrink-0">
                                    {vinculo.codigo}
                                  </Badge>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabela de Últimos Balanços Lançados */}
      <Card className="bg-white border-slate-200 shadow-2xs">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-sm font-bold text-[#0B1F3A]">
              Últimos Balanços Cadastrados
            </CardTitle>
            <CardDescription className="text-xs">
              Resumo comparativo dos exercícios contábeis lançados
            </CardDescription>
          </div>
          <Button
            asChild
            size="sm"
            variant="ghost"
            className="text-xs text-blue-600 hover:text-blue-700 font-semibold"
          >
            <Link to="/empresas">
              Ver todas as empresas <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 font-semibold">
                  <th className="py-2.5 px-3">Empresa</th>
                  <th className="py-2.5 px-3">Ano</th>
                  <th className="py-2.5 px-3 text-right">Ativo Total</th>
                  <th className="py-2.5 px-3 text-right">Passivo Total</th>
                  <th className="py-2.5 px-3 text-right">Patrimônio Líquido</th>
                  <th className="py-2.5 px-3 text-center">Liquidez Corrente</th>
                  <th className="py-2.5 px-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ultimosBalancosList.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-3">
                      <div>
                        <Link
                          to={`/dashboard/empresa/${row.empresaId}`}
                          className="font-semibold text-slate-800 hover:text-blue-600 block transition-colors"
                          title="Abrir Dashboard da Empresa"
                        >
                          {row.empresaNome}
                        </Link>
                        <span className="text-[11px] text-slate-400">
                          {row.segmento} · {formatCnpj(row.cnpj)}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-3 font-semibold text-slate-700">{row.ano}</td>
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
                        asChild
                        size="sm"
                        variant="outline"
                        className="h-7 text-[11px] font-medium border-slate-200 hover:border-blue-300 hover:text-blue-700"
                      >
                        <Link to={`/dashboard/empresa/${row.empresaId}`}>Ver Dashboard</Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
