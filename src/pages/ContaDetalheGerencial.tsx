import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import {
  ArrowLeft,
  Download,
  Printer,
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  Building,
  Tag,
  Hash,
  FileSpreadsheet,
  FileText,
  Search,
  Filter,
  BarChart3,
  DollarSign,
  AlertCircle,
  HelpCircle,
  Calculator,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  Check,
  Percent,
} from 'lucide-react'
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts'
import * as XLSX from 'xlsx'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/contexts/AuthContext'
import { useFilter } from '@/contexts/FilterContext'
import { lancamentosService, contasService, planoContasService } from '@/services/financeService'
import { LancamentoRecord, ContaRecord, PlanoContaRecord } from '@/types/finance'
import { DocumentPrintFooter } from '@/components/DocumentPrintFooter'
import {
  extrairCenarioBaseDre,
  calcularSimulacaoContaUnica,
  type CenarioBaseDre,
  type ResultadoSimulacaoContaUnica,
} from '@/lib/indicadorCrescimentoCalculo'
import { gerarListaMeses } from '@/lib/dreGerencialTypes'
import { obterClassificacaoDreConta } from '@/lib/dreClassificacaoHeuristica'

function formatBrl(val: number | undefined | null): string {
  if (val === undefined || val === null || isNaN(val)) return 'R$ 0,00'
  return val.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function formatBrlCurto(val: number): string {
  const abs = Math.abs(val)
  if (abs >= 1_000_000) {
    return `${(val / 1_000_000).toFixed(1).replace('.', ',')}M`
  }
  if (abs >= 1_000) {
    return `${(val / 1_000).toFixed(0)}k`
  }
  return val.toFixed(0)
}

function parseDataIso(dataStr?: string): {
  ano: number
  mes: number
  chave: string
  dataFormatada: string
} {
  if (!dataStr) {
    return { ano: 0, mes: 0, chave: '', dataFormatada: '—' }
  }
  const limpo = dataStr.slice(0, 10)
  const partes = limpo.split('-')
  if (partes.length === 3) {
    const ano = Number(partes[0]) || 0
    const mes = Number(partes[1]) || 0
    const dia = partes[2]
    return {
      ano,
      mes,
      chave: `${ano}-${String(mes).padStart(2, '0')}`,
      dataFormatada: `${dia}/${String(mes).padStart(2, '0')}/${ano}`,
    }
  }
  return { ano: 0, mes: 0, chave: '', dataFormatada: dataStr }
}

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

interface PontoMensal {
  chave: string // YYYY-MM
  rotulo: string // MMM/AA
  ano: number
  mes: number
  valor: number
  indice: number
  tendencia?: number
  valorSimulado?: number
  qtdLancamentos: number
}

interface LancamentoFormatado {
  id: string
  data: string
  dataFormatada: string
  mesAnoChave: string
  competencia: string
  historico: string
  valor: number
  centroNome: string
  tipoDespesaNome: string
  empresaNome: string
  notaFiscalRef?: string
}

export default function ContaDetalheGerencial() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { toast } = useToast()
  const { user } = useAuth()
  const { selectedEmpresa, selectedEmpresaId, empresasIdsAtivas, empresas } = useFilter()

  // Extrai parâmetros da URL
  const paramContaId = searchParams.get('contaId') || ''
  const paramCodigo = searchParams.get('codigo') || ''
  const paramEmpresaId = searchParams.get('empresaId') || ''
  const paramAno = searchParams.get('ano') || ''

  // Estado de carregamento e dados brutos
  const [loading, setLoading] = useState(true)
  const [contaObj, setContaObj] = useState<ContaRecord | null>(null)
  const [planoContas, setPlanoContas] = useState<PlanoContaRecord[]>([])
  const [lancamentos, setLancamentos] = useState<LancamentoRecord[]>([])
  const [todosLancamentosBase, setTodosLancamentosBase] = useState<LancamentoRecord[]>([])
  const [todasContasBase, setTodasContasBase] = useState<ContaRecord[]>([])

  // Estado do Simulador por Conta Contábil (-50% a +50%)
  const [percentualSimulado, setPercentualSimulado] = useState<number>(0)
  const [percentualInput, setPercentualInput] = useState<string>('0')

  // Filtros internos da tela
  const [filtroTexto, setFiltroTexto] = useState('')
  const [filtroAno, setFiltroAno] = useState<string>('todos')
  const [filtroCentro, setFiltroCentro] = useState<string>('todos')
  const [filtroTipoDespesa, setFiltroTipoDespesa] = useState<string>('todos')

  // Se o usuário for cliente, bloqueia
  const isCliente = user?.role === 'cliente'

  // Carrega conta contábil, plano de contas e lançamentos históricos
  useEffect(() => {
    if (isCliente) {
      toast({
        variant: 'destructive',
        title: 'Acesso Restrito',
        description:
          'O perfil Cliente não possui permissão para visualizar o detalhamento da conta.',
      })
      navigate('/analise-economica-financeira', { replace: true })
      return
    }

    let isMounted = true

    async function carregarTudo() {
      try {
        setLoading(true)

        // 1. Determina escopo de empresas ativas
        const targetEmpresasIds = new Set<string>()
        if (paramEmpresaId && !paramEmpresaId.startsWith('grupo-')) {
          targetEmpresasIds.add(paramEmpresaId)
        } else if (empresasIdsAtivas && empresasIdsAtivas.length > 0) {
          empresasIdsAtivas.forEach((id) => targetEmpresasIds.add(id))
        } else if (selectedEmpresaId && !selectedEmpresaId.startsWith('grupo-')) {
          targetEmpresasIds.add(selectedEmpresaId)
        }

        // 2. Busca contas para localizar a conta solicitada (por id ou codigo)
        const listaContas = await contasService.getAll()
        let contaEncontrada: ContaRecord | null = null

        if (paramContaId && paramContaId !== '__sem_conta__') {
          contaEncontrada = listaContas.find((c) => c.id === paramContaId) || null
        }
        if (!contaEncontrada && paramCodigo) {
          const codTrim = paramCodigo.trim()
          contaEncontrada = listaContas.find((c) => c.codigo && c.codigo.trim() === codTrim) || null
        }

        // 3. Busca o plano de contas para cruzar centros e tipos
        const listaPlanos = await planoContasService.getAll()

        // 4. Busca TODOS os lançamentos da base (sem limitação de data ou 12 meses)
        const listaLancamentos = await lancamentosService.getAll({
          expandRelations: true,
        })

        if (!isMounted) return

        setContaObj(contaEncontrada)
        setPlanoContas(listaPlanos)
        setTodasContasBase(listaContas)
        setTodosLancamentosBase(listaLancamentos)

        // Filtra lançamentos que pertençam a esta conta (ou código) e às empresas do escopo
        const contaIdAlvo = contaEncontrada?.id || paramContaId
        const codigoAlvo = contaEncontrada?.codigo?.trim() || paramCodigo.trim()

        const planosIdsDaConta = new Set<string>()
        for (const p of listaPlanos) {
          if (
            (contaIdAlvo && p.conta === contaIdAlvo) ||
            (codigoAlvo && p.codigo && p.codigo.trim() === codigoAlvo) ||
            (codigoAlvo && p.codigo_empresa && p.codigo_empresa.trim() === codigoAlvo)
          ) {
            planosIdsDaConta.add(p.id)
          }
        }

        const lancsFiltrados = listaLancamentos.filter((l) => {
          if (l.estornado) return false

          // Verifica filtro de empresa se houver restrição
          if (targetEmpresasIds.size > 0 && !targetEmpresasIds.has(l.empresa)) {
            return false
          }

          // Checa se o lançamento pertence à conta
          const expandPlano = l.expand?.plano_conta
          const lancContaId =
            expandPlano?.expand?.conta?.id || expandPlano?.conta || (l as any).conta

          if (contaIdAlvo && lancContaId === contaIdAlvo) {
            return true
          }

          if (l.plano_conta && planosIdsDaConta.has(l.plano_conta)) {
            return true
          }

          const planoRef = listaPlanos.find((p) => p.id === l.plano_conta)
          if (planoRef) {
            if (contaIdAlvo && planoRef.conta === contaIdAlvo) return true
            if (codigoAlvo && planoRef.codigo && planoRef.codigo.trim() === codigoAlvo) return true
            if (
              codigoAlvo &&
              planoRef.codigo_empresa &&
              planoRef.codigo_empresa.trim() === codigoAlvo
            ) {
              return true
            }
          }

          // Fallback por código no histórico
          if (codigoAlvo && l.historico && l.historico.includes(codigoAlvo)) {
            return true
          }

          return false
        })

        setLancamentos(lancsFiltrados)
      } catch (err: any) {
        console.error('Erro ao carregar lançamentos históricos da conta:', err)
        if (isMounted) {
          toast({
            variant: 'destructive',
            title: 'Erro ao carregar detalhes',
            description: 'Não foi possível carregar os lançamentos da conta selecionada.',
          })
        }
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    carregarTudo()

    return () => {
      isMounted = false
    }
  }, [
    paramContaId,
    paramCodigo,
    paramEmpresaId,
    empresasIdsAtivas,
    selectedEmpresaId,
    isCliente,
    navigate,
    toast,
  ])

  // Normalização e formatação dos lançamentos
  const lancamentosFormatados: LancamentoFormatado[] = useMemo(() => {
    const mapaEmpresas = new Map<string, string>()
    for (const e of empresas) {
      mapaEmpresas.set(e.id, e.nome)
    }

    const mapaPlanos = new Map<string, PlanoContaRecord>()
    for (const p of planoContas) {
      mapaPlanos.set(p.id, p)
    }

    return lancamentos
      .map((l) => {
        const infoData = parseDataIso(l.data)
        const plano =
          l.expand?.plano_conta || (l.plano_conta ? mapaPlanos.get(l.plano_conta) : undefined)
        const centroNome =
          l.expand?.plano_conta?.expand?.centro?.nome || plano?.expand?.centro?.nome || 'Sem Centro'
        const tipoDespesaNome =
          l.expand?.plano_conta?.expand?.tipo_despesa?.nome ||
          plano?.expand?.tipo_despesa?.nome ||
          'Sem Tipo'
        const empresaNome = l.expand?.empresa?.nome || mapaEmpresas.get(l.empresa) || 'Empresa'

        const valor = Number(l.valor) || 0

        return {
          id: l.id,
          data: l.data || '',
          dataFormatada: infoData.dataFormatada,
          mesAnoChave: infoData.chave,
          competencia:
            infoData.mes > 0
              ? `${NOMES_MESES_ABREV[infoData.mes - 1]}/${String(infoData.ano).slice(-2)}`
              : '—',
          historico: l.historico?.trim() || '(sem histórico informado)',
          valor,
          centroNome,
          tipoDespesaNome,
          empresaNome,
          notaFiscalRef: l.nota_fiscal_ref,
        }
      })
      .sort((a, b) => b.data.localeCompare(a.data)) // Mais recentes primeiro
  }, [lancamentos, empresas, planoContas])

  // Lista de anos disponíveis nos lançamentos
  const anosDisponiveis = useMemo(() => {
    const anos = new Set<number>()
    lancamentosFormatados.forEach((l) => {
      const info = parseDataIso(l.data)
      if (info.ano > 0) anos.add(info.ano)
    })
    return Array.from(anos).sort((a, b) => b - a)
  }, [lancamentosFormatados])

  // Lista de centros e tipos disponíveis nos lançamentos da conta
  const centrosDisponiveis = useMemo(() => {
    const set = new Set<string>()
    lancamentosFormatados.forEach((l) => {
      if (l.centroNome) set.add(l.centroNome)
    })
    return Array.from(set).sort()
  }, [lancamentosFormatados])

  const tiposDisponiveis = useMemo(() => {
    const set = new Set<string>()
    lancamentosFormatados.forEach((l) => {
      if (l.tipoDespesaNome) set.add(l.tipoDespesaNome)
    })
    return Array.from(set).sort()
  }, [lancamentosFormatados])

  // Aplica filtros locais
  const lancamentosFiltrados = useMemo(() => {
    return lancamentosFormatados.filter((l) => {
      if (filtroAno !== 'todos') {
        const info = parseDataIso(l.data)
        if (String(info.ano) !== filtroAno) return false
      }
      if (filtroCentro !== 'todos' && l.centroNome !== filtroCentro) {
        return false
      }
      if (filtroTipoDespesa !== 'todos' && l.tipoDespesaNome !== filtroTipoDespesa) {
        return false
      }
      if (filtroTexto.trim()) {
        const q = filtroTexto.toLowerCase()
        const matchHist = l.historico.toLowerCase().includes(q)
        const matchData = l.dataFormatada.includes(q)
        const matchValor = l.valor.toFixed(2).replace('.', ',').includes(q)
        const matchCentro = l.centroNome.toLowerCase().includes(q)
        const matchTipo = l.tipoDespesaNome.toLowerCase().includes(q)
        if (!matchHist && !matchData && !matchValor && !matchCentro && !matchTipo) {
          return false
        }
      }
      return true
    })
  }, [lancamentosFormatados, filtroAno, filtroCentro, filtroTipoDespesa, filtroTexto])

  // Determina a classificação contábil efetiva da conta para cálculo do DRE
  const classificacaoConta = useMemo(() => {
    if (contaObj) {
      return obterClassificacaoDreConta(contaObj)
    }
    // Caso ainda não tenha o objeto conta carregado, usa objeto mínimo compatível
    const contaMinima = {
      id: paramContaId || 'temp',
      user: '',
      collectionId: 'contas',
      collectionName: 'contas',
      codigo: paramCodigo || '',
      nome: paramCodigo || 'Conta',
      tipo: 'Despesa' as const,
      grupo: '',
      created: '',
      updated: '',
    }
    return obterClassificacaoDreConta(contaMinima as ContaRecord)
  }, [contaObj, paramContaId, paramCodigo])

  // Identifica o ano base para a simulação DRE (usa o ano do parâmetro se fornecido, senão o ano mais recente dos lançamentos ou o atual)
  const anoSimulacaoDre = useMemo(() => {
    if (paramAno && !isNaN(Number(paramAno))) {
      return Number(paramAno)
    }
    if (anosDisponiveis.length > 0) {
      return anosDisponiveis[0]
    }
    return new Date().getFullYear()
  }, [paramAno, anosDisponiveis])

  // Cenario Base DRE extraído dos lançamentos e contas da empresa ativa (12 meses do ano)
  const cenarioBaseDre: CenarioBaseDre = useMemo(() => {
    const mesesAno = gerarListaMeses(anoSimulacaoDre, 1, 12)
    return extrairCenarioBaseDre(todosLancamentosBase, todasContasBase, mesesAno, planoContas)
  }, [todosLancamentosBase, todasContasBase, planoContas, anoSimulacaoDre])

  // Total da conta no ano da simulação (ou total acumulado se nenhum ano específico selecionado)
  const totalContaAnoSimulacao = useMemo(() => {
    const mesesAnoItens = gerarListaMeses(anoSimulacaoDre, 1, 12)
    const mesesAnoSet = new Set(mesesAnoItens.map((m) => m.chave))
    let somaAno = 0
    let somaTotal = 0
    lancamentosFormatados.forEach((l) => {
      somaTotal += l.valor
      if (mesesAnoSet.has(l.mesAnoChave)) {
        somaAno += l.valor
      }
    })
    // Se no ano não houver lançamentos mas houver total acumulado na conta, usa o total acumulado como base
    if (somaAno === 0 && somaTotal > 0) {
      return somaTotal
    }
    return somaAno
  }, [lancamentosFormatados, anoSimulacaoDre])

  // Cálculo da simulação isolada para a conta atual
  const resultadoSimulacao: ResultadoSimulacaoContaUnica = useMemo(() => {
    return calcularSimulacaoContaUnica(
      cenarioBaseDre,
      {
        id: contaObj?.id || paramContaId || paramCodigo,
        nome: contaObj?.nome || paramCodigo || 'Conta Contábil',
        codigo: contaObj?.codigo || paramCodigo,
        classificacao: classificacaoConta,
        totalOriginal: totalContaAnoSimulacao,
      },
      percentualSimulado,
    )
  }, [
    cenarioBaseDre,
    contaObj,
    paramContaId,
    paramCodigo,
    classificacaoConta,
    totalContaAnoSimulacao,
    percentualSimulado,
  ])

  // Handlers para o Simulador
  const handlePercentualSliderChange = (valores: number[]) => {
    const v = valores[0] ?? 0
    setPercentualSimulado(v)
    setPercentualInput(String(v))
  }

  const handlePercentualInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valStr = e.target.value
    setPercentualInput(valStr)
    const num = parseFloat(valStr)
    if (!isNaN(num)) {
      const clamped = Math.max(-50, Math.min(50, num))
      setPercentualSimulado(clamped)
    }
  }

  const handleAplicarAtalho = (pct: number) => {
    setPercentualSimulado(pct)
    setPercentualInput(String(pct))
  }

  const handleLimparSimulacao = () => {
    setPercentualSimulado(0)
    setPercentualInput('0')
  }

  // Agrupamento mensal para a série temporal (gráfico) — ordenado cronologicamente crescente
  const serieMensal = useMemo<PontoMensal[]>(() => {
    const mapaMeses = new Map<string, { valor: number; qtd: number; ano: number; mes: number }>()

    lancamentosFiltrados.forEach((l) => {
      const info = parseDataIso(l.data)
      if (!info.chave) return
      const atual = mapaMeses.get(info.chave) || {
        valor: 0,
        qtd: 0,
        ano: info.ano,
        mes: info.mes,
      }
      atual.valor += l.valor
      atual.qtd += 1
      mapaMeses.set(info.chave, atual)
    })

    // Ordena as chaves cronologicamente (YYYY-MM)
    const chavesOrdenadas = Array.from(mapaMeses.keys()).sort()

    const pontos: PontoMensal[] = chavesOrdenadas.map((chave, idx) => {
      const item = mapaMeses.get(chave)!
      const rotulo =
        item.mes > 0 ? `${NOMES_MESES_ABREV[item.mes - 1]}/${String(item.ano).slice(-2)}` : chave
      return {
        chave,
        rotulo,
        ano: item.ano,
        mes: item.mes,
        valor: item.valor,
        indice: idx,
        qtdLancamentos: item.qtd,
      }
    })

    // Regressão Linear Simples: y = ax + b sobre x = indice (0, 1, 2, ..., n-1)
    const n = pontos.length
    if (n >= 2) {
      let sumX = 0
      let sumY = 0
      let sumXY = 0
      let sumXX = 0

      for (let i = 0; i < n; i++) {
        const x = i
        const y = pontos[i].valor
        sumX += x
        sumY += y
        sumXY += x * y
        sumXX += x * x
      }

      const divisor = n * sumXX - sumX * sumX
      const inclinacao = divisor !== 0 ? (n * sumXY - sumX * sumY) / divisor : 0
      const intercepto = (sumY - inclinacao * sumX) / n

      pontos.forEach((p, idx) => {
        p.tendencia = Number((inclinacao * idx + intercepto).toFixed(2))
        if (percentualSimulado !== 0) {
          p.valorSimulado = Math.max(
            0,
            Number((p.valor * (1 + percentualSimulado / 100)).toFixed(2)),
          )
        }
      })
    } else if (n === 1) {
      pontos[0].tendencia = pontos[0].valor
      if (percentualSimulado !== 0) {
        pontos[0].valorSimulado = Math.max(
          0,
          Number((pontos[0].valor * (1 + percentualSimulado / 100)).toFixed(2)),
        )
      }
    }

    return pontos
  }, [lancamentosFiltrados, percentualSimulado])

  // Coeficiente angular e direção da tendência
  const dadosRegressao = useMemo(() => {
    const n = serieMensal.length
    if (n < 2) {
      return {
        inclinacao: 0,
        direcao: 'estavel' as 'alta' | 'queda' | 'estavel',
        descricao: 'Dados insuficientes para regressão linear (mínimo 2 meses)',
      }
    }

    const p0 = serieMensal[0]
    const pUltimo = serieMensal[n - 1]
    const deltaY = (pUltimo.tendencia ?? pUltimo.valor) - (p0.tendencia ?? p0.valor)
    const inclinacao = deltaY / (n - 1)

    // Tolerância para estabilidade: variação menor que 0.5% da média mensal
    const somaValores = serieMensal.reduce((acc, p) => acc + p.valor, 0)
    const media = somaValores / n
    const threshold = Math.abs(media) * 0.005

    let direcao: 'alta' | 'queda' | 'estavel' = 'estavel'
    if (inclinacao > threshold) {
      direcao = 'alta'
    } else if (inclinacao < -threshold) {
      direcao = 'queda'
    }

    return {
      inclinacao,
      direcao,
      descricao:
        direcao === 'alta'
          ? `Tendência de Alta (+${formatBrl(Math.abs(inclinacao))}/mês estimado pela regressão)`
          : direcao === 'queda'
            ? `Tendência de Redução (-${formatBrl(Math.abs(inclinacao))}/mês estimado pela regressão)`
            : 'Tendência Estável / Variação Residual',
    }
  }, [serieMensal])

  // Estatísticas resumo
  const estatisticas = useMemo(() => {
    const totalAcumulado = lancamentosFiltrados.reduce((acc, l) => acc + l.valor, 0)
    const qtdMesesComLancamento = serieMensal.length
    const mediaMensal = qtdMesesComLancamento > 0 ? totalAcumulado / qtdMesesComLancamento : 0

    let maiorMes: PontoMensal | null = null
    let menorMes: PontoMensal | null = null

    serieMensal.forEach((p) => {
      if (!maiorMes || p.valor > maiorMes.valor) maiorMes = p
      if (!menorMes || p.valor < menorMes.valor) menorMes = p
    })

    return {
      totalAcumulado,
      mediaMensal,
      qtdMesesComLancamento,
      qtdTotalLancamentos: lancamentosFiltrados.length,
      maiorMes,
      menorMes,
    }
  }, [lancamentosFiltrados, serieMensal])

  // Exportação Excel (.xlsx)
  const handleExportarExcel = () => {
    try {
      const nomeConta = contaObj?.nome || paramCodigo || 'Conta'
      const rowsLancamentos = lancamentosFiltrados.map((l) => ({
        Data: l.dataFormatada,
        Competência: l.competencia,
        'Código Conta': contaObj?.codigo || paramCodigo || '',
        'Nome da Conta': nomeConta,
        'Centro de Custo': l.centroNome,
        'Tipo de Despesa': l.tipoDespesaNome,
        Histórico: l.historico,
        'Valor (R$)': l.valor,
        Empresa: l.empresaNome,
      }))

      const rowsMensal = serieMensal.map((p) => ({
        Mês: p.rotulo,
        'Chave (YYYY-MM)': p.chave,
        'Lançamentos (Qtd)': p.qtdLancamentos,
        'Total do Mês (R$)': p.valor,
        'Linha de Tendência (R$)': p.tendencia ?? p.valor,
      }))

      const wb = XLSX.utils.book_new()
      const wsLanc = XLSX.utils.json_to_sheet(rowsLancamentos)
      const wsMensal = XLSX.utils.json_to_sheet(rowsMensal)

      XLSX.utils.book_append_sheet(wb, wsLanc, 'Lançamentos')
      XLSX.utils.book_append_sheet(wb, wsMensal, 'Série Mensal & Tendência')

      const codSanitizado = (contaObj?.codigo || paramCodigo || 'conta').replace(
        /[^a-zA-Z0-9_-]/g,
        '_',
      )
      const fileName = `historico-conta-${codSanitizado}-${new Date().toISOString().slice(0, 10)}.xlsx`
      XLSX.writeFile(wb, fileName)

      toast({
        title: 'Planilha Excel Gerada',
        description: `Exportados ${rowsLancamentos.length} lançamentos e série mensal histórica.`,
      })
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro na exportação',
        description: err?.message || 'Falha ao gerar arquivo Excel.',
      })
    }
  }

  // Exportação CSV com ponto e vírgula e UTF-8 BOM
  const handleExportarCsv = () => {
    try {
      const nomeConta = contaObj?.nome || paramCodigo || 'Conta'
      const colunas = [
        'Data',
        'Competência',
        'Código Conta',
        'Nome da Conta',
        'Centro de Custo',
        'Tipo de Despesa',
        'Histórico',
        'Valor (R$)',
        'Empresa',
      ]

      const escapeCsv = (val: any): string => {
        if (val === null || val === undefined) return ''
        const s = String(val)
        if (/[;"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
        return s
      }

      const linhas = [colunas.map(escapeCsv).join(';')]
      lancamentosFiltrados.forEach((l) => {
        linhas.push(
          [
            l.dataFormatada,
            l.competencia,
            contaObj?.codigo || paramCodigo || '',
            nomeConta,
            l.centroNome,
            l.tipoDespesaNome,
            l.historico,
            l.valor.toFixed(2).replace('.', ','),
            l.empresaNome,
          ]
            .map(escapeCsv)
            .join(';'),
        )
      })

      const csvContent = '\uFEFF' + linhas.join('\n')
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      const codSanitizado = (contaObj?.codigo || paramCodigo || 'conta').replace(
        /[^a-zA-Z0-9_-]/g,
        '_',
      )
      link.setAttribute(
        'download',
        `historico-conta-${codSanitizado}-${new Date().toISOString().slice(0, 10)}.csv`,
      )
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(link.href)

      toast({
        title: 'Arquivo CSV Gerado',
        description: 'Arquivo pronto para importação no Excel ou outros sistemas.',
      })
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro na exportação CSV',
        description: err?.message || 'Falha ao gerar arquivo CSV.',
      })
    }
  }

  const handleVoltar = () => {
    if (location.key !== 'default') {
      navigate(-1)
    } else {
      navigate('/gerencial/dre')
    }
  }

  const handleImprimir = () => {
    window.print()
  }

  // Título e identificadores da conta
  const codigoContaExibicao = contaObj?.codigo || paramCodigo || 'S/C'
  const nomeContaExibicao = contaObj?.nome || 'Conta Contábil Gerencial'
  const tipoContaExibicao = contaObj?.tipo || contaObj?.grupo || 'Contábil'

  return (
    <div className="space-y-4 animate-fadeIn pb-8 print:p-0 print:m-0 w-full min-w-0 max-w-full overflow-hidden">
      {/* Barra Superior de Ações e Título */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs print:hidden">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleVoltar}
            className="h-8 gap-1.5 text-xs text-slate-700 hover:text-slate-900 border-slate-300 font-medium"
            title="Voltar para a tela anterior"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Voltar
          </Button>

          <div className="h-6 w-px bg-slate-200" />

          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-blue-100 text-blue-700 font-mono font-bold text-xs shrink-0">
              <Hash className="w-4 h-4 inline mr-1" />
              {codigoContaExibicao}
            </span>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-[#0B1F3A] tracking-tight truncate max-w-md">
                {nomeContaExibicao}
              </h1>
              <p className="text-[11px] text-slate-500 flex items-center gap-2">
                <span>Histórico Completo & Análise de Tendências</span>
                <span>•</span>
                <span className="font-medium text-slate-700">
                  {selectedEmpresa?.nome || 'Empresa Ativa'}
                </span>
                {paramAno && (
                  <>
                    <span>•</span>
                    <span>Exercício Origem: {paramAno}</span>
                  </>
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExportarCsv}
            className="h-8 text-xs gap-1.5 border-slate-300 text-slate-700 hover:bg-slate-50"
            title="Exportar dados para CSV"
          >
            <FileText className="w-3.5 h-3.5 text-slate-600" />
            CSV
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExportarExcel}
            className="h-8 text-xs gap-1.5 border-emerald-300 text-emerald-800 bg-emerald-50/50 hover:bg-emerald-100/60 font-semibold"
            title="Exportar dados e série histórica em planilha Excel"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            Excel
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleImprimir}
            className="h-8 text-xs gap-1.5 border-slate-300 text-slate-700 hover:bg-slate-50"
            title="Imprimir relatório / Salvar como PDF A4"
          >
            <Printer className="w-3.5 h-3.5 text-slate-600" />
            Imprimir A4
          </Button>
        </div>
      </div>

      {/* Cabeçalho exclusivo para Impressão */}
      <div className="hidden print:block mb-4 border-b border-slate-300 pb-2">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-sm text-blue-900">
                {codigoContaExibicao}
              </span>
              <span className="text-slate-400">—</span>
              <h1 className="text-base font-bold text-slate-900">{nomeContaExibicao}</h1>
            </div>
            <p className="text-[10pt] text-slate-600">
              Relatório Analítico de Lançamentos Históricos e Regressão Linear de Tendência
            </p>
          </div>
          <div className="text-right text-[9pt] text-slate-500">
            <p className="font-bold text-slate-800">{selectedEmpresa?.nome || 'Empresa'}</p>
            <p>Histórico completo acumulado</p>
          </div>
        </div>
      </div>

      {/* Painel do Simulador por Conta Contábil */}
      <Card className="border-blue-200 bg-linear-to-r from-blue-50/70 via-indigo-50/40 to-slate-50/60 shadow-xs print:hidden">
        <CardHeader className="p-4 pb-3 border-b border-blue-100/80">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-blue-600 text-white shadow-xs">
                <Calculator className="w-4 h-4" />
              </span>
              <div>
                <CardTitle className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
                  Simulador de Cenário por Conta Contábil
                  {percentualSimulado !== 0 ? (
                    <Badge className="bg-amber-100 text-amber-900 border-amber-300 font-bold text-[10px] gap-1">
                      <Sparkles className="w-3 h-3 text-amber-600" />
                      Cenário Simulado (
                      {percentualSimulado > 0
                        ? `+${percentualSimulado}%`
                        : `${percentualSimulado}%`}
                      )
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="text-slate-500 border-slate-300 font-normal text-[10px]"
                    >
                      Real (Sem Simulação)
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Simule variações de -50% a +50% nesta conta ({codigoContaExibicao} •{' '}
                  {classificacaoConta}) e visualize em tempo real o novo valor, a economia em R$, o
                  novo lucro líquido e as margens resultantes. É cenário puro: nenhum dado é gravado
                  no banco.
                </CardDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {percentualSimulado !== 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleLimparSimulacao}
                  className="h-7 text-xs gap-1 border-slate-300 text-slate-600 hover:text-slate-900 bg-white/80"
                  title="Restaurar valores reais da conta"
                >
                  <RotateCcw className="w-3 h-3" />
                  Limpar Simulação
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 space-y-4">
          {/* Controles: Slider + Input numérico + Atalhos rápidos */}
          <div className="bg-white p-3.5 rounded-xl border border-blue-100 shadow-2xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-1">
                <span className="text-xs font-semibold text-slate-700 min-w-32">
                  Variação Simulada:
                </span>
                <div className="flex-1 max-w-md px-2">
                  <Slider
                    value={[percentualSimulado]}
                    min={-50}
                    max={50}
                    step={1}
                    onValueChange={handlePercentualSliderChange}
                    className="cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 mt-1 font-mono">
                    <span>-50%</span>
                    <span>-25%</span>
                    <span className="text-slate-600 font-bold">0% (Real)</span>
                    <span>+25%</span>
                    <span>+50%</span>
                  </div>
                </div>
              </div>

              {/* Campo Numérico de % */}
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <div className="relative w-24">
                  <Input
                    type="number"
                    min={-50}
                    max={50}
                    step={0.5}
                    value={percentualInput}
                    onChange={handlePercentualInputChange}
                    className="h-8 text-xs font-mono font-bold text-center pr-6 border-slate-300"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">
                    %
                  </span>
                </div>
              </div>

              {/* Botões rápidos de atalhos */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] text-slate-500 font-medium mr-1">Atalhos:</span>
                <Button
                  type="button"
                  size="sm"
                  variant={percentualSimulado === -5 ? 'default' : 'outline'}
                  onClick={() => handleAplicarAtalho(-5)}
                  className={`h-7 px-2.5 text-xs font-mono font-bold ${
                    percentualSimulado === -5
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : 'border-emerald-300 text-emerald-800 bg-emerald-50/50 hover:bg-emerald-100/60'
                  }`}
                >
                  -5%
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={percentualSimulado === -10 ? 'default' : 'outline'}
                  onClick={() => handleAplicarAtalho(-10)}
                  className={`h-7 px-2.5 text-xs font-mono font-bold ${
                    percentualSimulado === -10
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : 'border-emerald-300 text-emerald-800 bg-emerald-50/50 hover:bg-emerald-100/60'
                  }`}
                >
                  -10%
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={percentualSimulado === -15 ? 'default' : 'outline'}
                  onClick={() => handleAplicarAtalho(-15)}
                  className={`h-7 px-2.5 text-xs font-mono font-bold ${
                    percentualSimulado === -15
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : 'border-emerald-300 text-emerald-800 bg-emerald-50/50 hover:bg-emerald-100/60'
                  }`}
                >
                  -15%
                </Button>
              </div>
            </div>
          </div>

          {/* Cards de Impacto em Tempo Real */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* 1. Valor da Conta: Real vs Simulado */}
            <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
              <span className="text-[10.5px] font-semibold text-slate-500 uppercase tracking-wider block">
                Valor da Conta ({anoSimulacaoDre})
              </span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-base font-black font-mono text-[#0B1F3A]">
                  {formatBrl(resultadoSimulacao.valorSimulado)}
                </span>
                <span className="text-[11px] font-mono text-slate-500 line-through">
                  {formatBrl(resultadoSimulacao.valorOriginal)}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5">
                {percentualSimulado === 0
                  ? 'Valor original sem alteração'
                  : `Variação simulada de ${percentualSimulado > 0 ? `+${percentualSimulado}%` : `${percentualSimulado}%`}`}
              </p>
            </div>

            {/* 2. Impacto / Economia em R$ com Badge */}
            <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
              <span className="text-[10.5px] font-semibold text-slate-500 uppercase tracking-wider block">
                Economia / Impacto em R$
              </span>
              <div className="mt-1 flex items-center justify-between">
                <span
                  className={`text-base font-black font-mono ${
                    resultadoSimulacao.deltaEconomia > 0
                      ? 'text-emerald-700'
                      : resultadoSimulacao.deltaEconomia < 0
                        ? 'text-rose-700'
                        : 'text-slate-700'
                  }`}
                >
                  {resultadoSimulacao.deltaEconomia > 0
                    ? `+${formatBrl(resultadoSimulacao.deltaEconomia)}`
                    : resultadoSimulacao.deltaEconomia < 0
                      ? `-${formatBrl(Math.abs(resultadoSimulacao.deltaEconomia))}`
                      : 'R$ 0,00'}
                </span>
                {resultadoSimulacao.deltaEconomia > 0 ? (
                  <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-bold text-[10px] gap-1">
                    <TrendingUp className="w-3 h-3 text-emerald-600" />
                    Economia
                  </Badge>
                ) : resultadoSimulacao.deltaEconomia < 0 ? (
                  <Badge className="bg-rose-100 text-rose-800 border-rose-300 font-bold text-[10px] gap-1">
                    <TrendingDown className="w-3 h-3 text-rose-600" />
                    Aumento Custo
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-slate-500 border-slate-300 text-[10px]">
                    Neutro
                  </Badge>
                )}
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5">
                {resultadoSimulacao.deltaEconomia >= 0
                  ? 'Ganho direto projetado no resultado'
                  : 'Custo adicional sobre a base'}
              </p>
            </div>

            {/* 3. Novo Lucro Líquido Projetado */}
            <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
              <span className="text-[10.5px] font-semibold text-slate-500 uppercase tracking-wider block">
                Novo Lucro Líquido Projetado
              </span>
              <div className="flex items-baseline justify-between mt-1">
                <span
                  className={`text-base font-black font-mono ${
                    resultadoSimulacao.novoLucroLiquido >= 0 ? 'text-[#0B1F3A]' : 'text-rose-700'
                  }`}
                >
                  {formatBrl(resultadoSimulacao.novoLucroLiquido)}
                </span>
                {resultadoSimulacao.deltaLucroReais !== 0 && (
                  <span
                    className={`text-[11px] font-mono font-bold ${
                      resultadoSimulacao.deltaLucroReais > 0 ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {resultadoSimulacao.deltaLucroReais > 0 ? '+' : ''}
                    {formatBrl(resultadoSimulacao.deltaLucroReais)}
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5">
                Lucro base {anoSimulacaoDre}: {formatBrl(cenarioBaseDre.lucroPrejuizo)}
              </p>
            </div>

            {/* 4. Margens Resultantes: Líquida e de Contribuição */}
            <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
              <span className="text-[10.5px] font-semibold text-slate-500 uppercase tracking-wider block">
                Margens Resultantes
              </span>
              <div className="mt-1 flex items-center justify-between text-xs">
                <div>
                  <span className="text-[10.5px] text-slate-500 block">Margem Líquida</span>
                  <span className="font-mono font-black text-slate-900 text-sm">
                    {resultadoSimulacao.novaMargemLiquidaPct !== null
                      ? `${resultadoSimulacao.novaMargemLiquidaPct.toFixed(1)}%`
                      : '—'}
                  </span>
                  {cenarioBaseDre.margemLiquidaPct !== null &&
                    resultadoSimulacao.novaMargemLiquidaPct !== null &&
                    resultadoSimulacao.novaMargemLiquidaPct !== cenarioBaseDre.margemLiquidaPct && (
                      <span className="text-[9.5px] text-slate-400 block">
                        de {cenarioBaseDre.margemLiquidaPct.toFixed(1)}%
                      </span>
                    )}
                </div>
                <div className="text-right">
                  <span className="text-[10.5px] text-slate-500 block">Margem Contribuição</span>
                  <span className="font-mono font-black text-slate-900 text-sm">
                    {resultadoSimulacao.novaMargemContribuicaoPct !== null
                      ? `${resultadoSimulacao.novaMargemContribuicaoPct.toFixed(1)}%`
                      : '—'}
                  </span>
                  {cenarioBaseDre.margemContribuicaoPct !== null &&
                    resultadoSimulacao.novaMargemContribuicaoPct !== null &&
                    resultadoSimulacao.novaMargemContribuicaoPct !==
                      cenarioBaseDre.margemContribuicaoPct && (
                      <span className="text-[9.5px] text-slate-400 block">
                        de {cenarioBaseDre.margemContribuicaoPct.toFixed(1)}%
                      </span>
                    )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cards de Resumo Executivo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Card 1: Total Acumulado */}
        <Card className="border-slate-200 shadow-2xs">
          <CardContent className="p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[10.5px] font-semibold text-slate-500 uppercase tracking-wider">
                Total Acumulado
              </span>
              <span className="p-1 rounded-md bg-blue-50 text-blue-700">
                <DollarSign className="w-3.5 h-3.5" />
              </span>
            </div>
            <p className="text-lg font-black text-[#0B1F3A] mt-1 font-mono">
              {formatBrl(estatisticas.totalAcumulado)}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">
              {estatisticas.qtdTotalLancamentos} lançamento(s) na série
            </p>
          </CardContent>
        </Card>

        {/* Card 2: Média Mensal */}
        <Card className="border-slate-200 shadow-2xs">
          <CardContent className="p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[10.5px] font-semibold text-slate-500 uppercase tracking-wider">
                Média Mensal
              </span>
              <span className="p-1 rounded-md bg-slate-100 text-slate-700">
                <Calendar className="w-3.5 h-3.5" />
              </span>
            </div>
            <p className="text-lg font-black text-slate-900 mt-1 font-mono">
              {formatBrl(estatisticas.mediaMensal)}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">
              base em {estatisticas.qtdMesesComLancamento} mês(es) ativos
            </p>
          </CardContent>
        </Card>

        {/* Card 3: Maior Mês */}
        <Card className="border-slate-200 shadow-2xs">
          <CardContent className="p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[10.5px] font-semibold text-slate-500 uppercase tracking-wider">
                Maior Mês
              </span>
              <span className="p-1 rounded-md bg-rose-50 text-rose-700">
                <TrendingUp className="w-3.5 h-3.5" />
              </span>
            </div>
            <p className="text-lg font-black text-rose-900 mt-1 font-mono">
              {estatisticas.maiorMes ? formatBrl(estatisticas.maiorMes.valor) : '—'}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">
              {estatisticas.maiorMes ? `Pico em ${estatisticas.maiorMes.rotulo}` : 'Sem dados'}
            </p>
          </CardContent>
        </Card>

        {/* Card 4: Menor Mês */}
        <Card className="border-slate-200 shadow-2xs">
          <CardContent className="p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[10.5px] font-semibold text-slate-500 uppercase tracking-wider">
                Menor Mês
              </span>
              <span className="p-1 rounded-md bg-emerald-50 text-emerald-700">
                <TrendingDown className="w-3.5 h-3.5" />
              </span>
            </div>
            <p className="text-lg font-black text-emerald-900 mt-1 font-mono">
              {estatisticas.menorMes ? formatBrl(estatisticas.menorMes.valor) : '—'}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">
              {estatisticas.menorMes ? `Mínimo em ${estatisticas.menorMes.rotulo}` : 'Sem dados'}
            </p>
          </CardContent>
        </Card>

        {/* Card 5: Direção da Tendência (Regressão Linear) */}
        <Card className="border-slate-200 shadow-2xs">
          <CardContent className="p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[10.5px] font-semibold text-slate-500 uppercase tracking-wider">
                Tendência Linear
              </span>
              {dadosRegressao.direcao === 'alta' ? (
                <span className="p-1 rounded-md bg-amber-50 text-amber-700">
                  <TrendingUp className="w-3.5 h-3.5" />
                </span>
              ) : dadosRegressao.direcao === 'queda' ? (
                <span className="p-1 rounded-md bg-emerald-50 text-emerald-700">
                  <TrendingDown className="w-3.5 h-3.5" />
                </span>
              ) : (
                <span className="p-1 rounded-md bg-slate-100 text-slate-600">
                  <Minus className="w-3.5 h-3.5" />
                </span>
              )}
            </div>
            <div className="mt-1 flex items-center gap-1.5">
              {dadosRegressao.direcao === 'alta' ? (
                <Badge className="bg-amber-100 text-amber-900 border-amber-300 font-bold text-xs gap-1">
                  <TrendingUp className="w-3 h-3 text-amber-700" />
                  Alta
                </Badge>
              ) : dadosRegressao.direcao === 'queda' ? (
                <Badge className="bg-emerald-100 text-emerald-900 border-emerald-300 font-bold text-xs gap-1">
                  <TrendingDown className="w-3 h-3 text-emerald-700" />
                  Redução
                </Badge>
              ) : (
                <Badge className="bg-slate-100 text-slate-800 border-slate-300 font-bold text-xs gap-1">
                  <Minus className="w-3 h-3 text-slate-500" />
                  Estável
                </Badge>
              )}
            </div>
            <p
              className="text-[10px] text-slate-500 mt-1 truncate"
              title={dadosRegressao.descricao}
            >
              {dadosRegressao.descricao}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico Recharts de Barras Mensais + Linha de Tendência */}
      <Card className="border-slate-200 shadow-xs print:border-slate-300">
        <CardHeader className="p-4 pb-2 border-b border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-blue-600" />
                Evolução Mensal & Linha de Tendência (Regressão Linear)
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Barras azuis indicam a soma mensal de lançamentos da conta; a linha pontilhada âmbar
                projeta a inclinação média calculada por regressão simples.
              </CardDescription>
            </div>

            <div className="flex items-center gap-3 text-xs flex-wrap">
              <span className="flex items-center gap-1 text-slate-600 font-medium">
                <span className="w-3 h-3 rounded-xs bg-[#1E40AF]" />
                Lançamentos Reais
              </span>
              {percentualSimulado !== 0 && (
                <span className="flex items-center gap-1 text-emerald-700 font-medium">
                  <span className="w-3 h-0.5 bg-emerald-600 border border-emerald-600" />
                  Cenário Simulado (
                  {percentualSimulado > 0 ? `+${percentualSimulado}%` : `${percentualSimulado}%`})
                </span>
              )}
              <span className="flex items-center gap-1 text-amber-700 font-medium">
                <span className="w-3 h-0.5 bg-amber-500 border border-amber-500" />
                Linha de Tendência
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-4">
          {loading ? (
            <div className="h-64 flex items-center justify-center">
              <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : serieMensal.length === 0 ? (
            <div className="h-56 flex flex-col items-center justify-center text-slate-400 text-xs">
              <AlertCircle className="w-8 h-8 mb-2 text-slate-300" />
              Nenhum lançamento registrado nesta conta para o filtro selecionado.
            </div>
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={serieMensal}
                  margin={{ top: 10, right: 20, left: 20, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis
                    dataKey="rotulo"
                    tick={{ fontSize: 11, fill: '#475569' }}
                    axisLine={{ stroke: '#CBD5E1' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#64748B' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={formatBrlCurto}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null
                      const item = payload[0].payload as PontoMensal
                      return (
                        <div className="bg-[#0B1F3A] text-white p-2.5 rounded-lg shadow-xl text-xs border border-slate-700 space-y-1">
                          <p className="font-bold text-blue-200 border-b border-slate-700 pb-1">
                            {item.rotulo} ({item.chave})
                          </p>
                          <div className="flex justify-between gap-4">
                            <span className="text-slate-300">Total do Mês:</span>
                            <span className="font-bold font-mono text-emerald-300">
                              {formatBrl(item.valor)}
                            </span>
                          </div>
                          {item.valorSimulado !== undefined && (
                            <div className="flex justify-between gap-4">
                              <span className="text-emerald-300">
                                Simulado (
                                {percentualSimulado > 0
                                  ? `+${percentualSimulado}%`
                                  : `${percentualSimulado}%`}
                                ):
                              </span>
                              <span className="font-bold font-mono text-emerald-400">
                                {formatBrl(item.valorSimulado)}
                              </span>
                            </div>
                          )}
                          {item.tendencia !== undefined && (
                            <div className="flex justify-between gap-4">
                              <span className="text-slate-300">Tendência:</span>
                              <span className="font-bold font-mono text-amber-300">
                                {formatBrl(item.tendencia)}
                              </span>
                            </div>
                          )}
                          <div className="flex justify-between gap-4 text-[10.5px] text-slate-400 pt-0.5">
                            <span>Lançamentos:</span>
                            <span>{item.qtdLancamentos} registros</span>
                          </div>
                        </div>
                      )
                    }}
                  />
                  <Bar
                    dataKey="valor"
                    name="Total Lançado (R$)"
                    fill="#1E40AF"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={48}
                  />
                  {percentualSimulado !== 0 && (
                    <Line
                      type="monotone"
                      dataKey="valorSimulado"
                      name="Valor Simulado"
                      stroke="#059669"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: '#059669' }}
                    />
                  )}
                  <Line
                    type="linear"
                    dataKey="tendencia"
                    name="Tendência Linear"
                    stroke="#F59E0B"
                    strokeWidth={2.5}
                    strokeDasharray="4 4"
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabela Detalhada de Lançamentos */}
      <Card className="border-slate-200 shadow-xs">
        <CardHeader className="p-4 pb-3 border-b border-slate-100">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                Lançamentos da Conta ({lancamentosFiltrados.length})
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Lista detalhada contendo competência, centro de custo, classificação, histórico e
                valor.
              </CardDescription>
            </div>

            {/* Filtros em linha */}
            <div className="flex items-center gap-2 flex-wrap text-xs">
              {/* Filtro de Texto */}
              <div className="relative w-48 sm:w-56">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <Input
                  type="text"
                  placeholder="Filtrar histórico..."
                  value={filtroTexto}
                  onChange={(e) => setFiltroTexto(e.target.value)}
                  className="h-8 pl-8 text-xs border-slate-200"
                />
              </div>

              {/* Filtro de Ano */}
              <Select value={filtroAno} onValueChange={setFiltroAno}>
                <SelectTrigger className="h-8 w-28 text-xs border-slate-200">
                  <SelectValue placeholder="Ano" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os anos</SelectItem>
                  {anosDisponiveis.map((a) => (
                    <SelectItem key={a} value={String(a)}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Filtro de Centro de Custo */}
              {centrosDisponiveis.length > 1 && (
                <Select value={filtroCentro} onValueChange={setFiltroCentro}>
                  <SelectTrigger className="h-8 w-36 text-xs border-slate-200 truncate">
                    <SelectValue placeholder="Centro" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os Centros</SelectItem>
                    {centrosDisponiveis.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {/* Filtro de Tipo de Despesa */}
              {tiposDisponiveis.length > 1 && (
                <Select value={filtroTipoDespesa} onValueChange={setFiltroTipoDespesa}>
                  <SelectTrigger className="h-8 w-36 text-xs border-slate-200 truncate">
                    <SelectValue placeholder="Tipo Despesa" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os Tipos</SelectItem>
                    {tiposDisponiveis.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-[#0B1F3A] border-b border-slate-200 font-bold">
                  <th className="py-2.5 px-3 whitespace-nowrap w-24">Data</th>
                  <th className="py-2.5 px-3 whitespace-nowrap w-20">Compet.</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Centro de Custo</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Tipo de Despesa</th>
                  <th className="py-2.5 px-3">Histórico / Descrição</th>
                  <th className="py-2.5 px-3 whitespace-nowrap text-right w-32">Valor (R$)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                      Carregando lançamentos...
                    </td>
                  </tr>
                ) : lancamentosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      Nenhum lançamento encontrado para os filtros aplicados.
                    </td>
                  </tr>
                ) : (
                  lancamentosFiltrados.map((l) => (
                    <tr
                      key={l.id}
                      className="hover:bg-blue-50/30 transition-colors text-slate-700 text-[11px]"
                    >
                      <td className="py-2 px-3 font-mono text-slate-600 whitespace-nowrap">
                        {l.dataFormatada}
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap">
                        <span className="inline-block px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[10px]">
                          {l.competencia}
                        </span>
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 text-slate-700 font-medium">
                          <Building className="w-3 h-3 text-slate-400" />
                          {l.centroNome}
                        </span>
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 text-slate-700 font-medium">
                          <Tag className="w-3 h-3 text-slate-400" />
                          {l.tipoDespesaNome}
                        </span>
                      </td>
                      <td
                        className="py-2 px-3 text-slate-900 font-medium max-w-md truncate"
                        title={l.historico}
                      >
                        {l.historico}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap tabular-nums">
                        {formatBrl(l.valor)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {lancamentosFiltrados.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-100/90 font-extrabold text-slate-900 border-t-2 border-slate-300 text-xs">
                    <td colSpan={5} className="py-2.5 px-3 uppercase tracking-wider text-right">
                      Total ({lancamentosFiltrados.length} lançamentos):
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-black text-sm text-[#0B1F3A] tabular-nums">
                      {formatBrl(estatisticas.totalAcumulado)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Nota Explicativa */}
      <div className="text-xs text-slate-500 bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1 print:hidden">
        <p className="font-semibold text-slate-700 flex items-center gap-1.5">
          <HelpCircle className="w-3.5 h-3.5 text-blue-600" />
          Sobre a tela de detalhamento histórico e tendência:
        </p>
        <p>
          • <strong>Escopo Temporal Irrestrito:</strong> A consulta traz todos os lançamentos
          registrados na base para a conta, tanto de exercícios anteriores quanto posteriores ao ano
          ativo.
        </p>
        <p>
          • <strong>Regressão Linear:</strong> A reta de tendência utiliza o método dos mínimos
          quadrados ordinários (y = ax + b) sobre a sequência dos meses, revelando a direção geral
          da despesa/receita independentemente da sazonalidade pontual.
        </p>
      </div>

      {/* Rodapé fixo na impressão / PDF A4 */}
      <DocumentPrintFooter
        documentTitle={`Detalhamento da Conta ${codigoContaExibicao} - ${nomeContaExibicao}`}
        empresaNome={selectedEmpresa?.nome}
        exercicioAno={paramAno || new Date().getFullYear()}
      />
    </div>
  )
}
