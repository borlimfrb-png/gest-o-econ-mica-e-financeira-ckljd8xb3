import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import {
  empresasService,
  balancosService,
  dreService,
  contasService,
} from '@/services/financeService'
import type {
  EmpresaRecord,
  BalancoRecord,
  ContaRecord,
  DreRecord,
  TipoConta,
  VinculosContasBalanco,
} from '@/types/finance'
import { BookOpen } from 'lucide-react'
import {
  calcularBalanco,
  calcularDre,
  calcularIndicadores,
  gerarAnaliseAutomatica,
  consolidarBalancoAnual,
  consolidarDreAnual,
  NOMES_MESES,
  NOMES_MESES_ABREV,
  formatBrlMil,
  formatNumber,
  formatPercent,
  formatCnpj,
} from '@/lib/financeCalculations'
import { useRealtime } from '@/hooks/use-realtime'
import { useFilter } from '@/contexts/FilterContext'
import { useToast } from '@/hooks/use-toast'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Building2,
  Calendar,
  Plus,
  Pencil,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronUp,
  BarChart3,
  PieChart as PieIcon,
  Scale,
  DollarSign,
  FileSpreadsheet,
  Lock,
  CalendarRange,
} from 'lucide-react'
import { ComparativoMensal } from '@/components/ComparativoMensal'
import { ImportarBalanceteMensal } from '@/components/ImportarBalanceteMensal'
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
  LineChart,
  Line,
} from 'recharts'

export default function AnaliseEmpresa() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { toast } = useToast()
  const { setSelectedEmpresaId } = useFilter()

  const [empresa, setEmpresa] = useState<EmpresaRecord | null>(null)
  const [balancos, setBalancos] = useState<BalancoRecord[]>([])
  const [dres, setDres] = useState<DreRecord[]>([])
  const [selectedAno, setSelectedAno] = useState<number>(2024)
  // Filtro de mês: 'todos' = visão anual consolidada; '1'..'12' = mês específico
  const [selectedMes, setSelectedMes] = useState<string>('todos')
  const [loading, setLoading] = useState(true)

  // Abas (com suporte a param ?aba= via URL)
  const [activeTab, setActiveTab] = useState(() => {
    const tabParam = searchParams.get('aba')
    if (tabParam === 'comparativo-mensal' || tabParam === 'comparativo') return 'comparativo'
    if (tabParam) return tabParam
    return 'visao-geral'
  })

  useEffect(() => {
    const tabParam = searchParams.get('aba')
    const novoParam = searchParams.get('novo')
    if (tabParam === 'comparativo-mensal' || tabParam === 'comparativo') {
      setActiveTab('comparativo-mensal')
    } else if (tabParam) {
      setActiveTab(tabParam)
    }
    if (novoParam === 'true' || novoParam === '1' || novoParam === 'balanco-dre') {
      openNovoLancamentoModal()
    }
  }, [searchParams])

  // Modais
  const [modalBalancoOpen, setModalBalancoOpen] = useState(false)
  const [modalDreOpen, setModalDreOpen] = useState(false)
  const [modalNovoLancamentoOpen, setModalNovoLancamentoOpen] = useState(false)
  const [savingModal, setSavingModal] = useState(false)

  // Mês alvo nos modais de edição individual
  const [modalBalancoMes, setModalBalancoMes] = useState<number>(12)
  const [modalDreMes, setModalDreMes] = useState<number>(12)
  const [novoMes, setNovoMes] = useState<number>(12)

  // Modal de Importação de Balancete Mensal
  const [modalImportarBalanceteOpen, setModalImportarBalanceteOpen] = useState(false)

  // Indicadores Accordions (expandir/recolher)
  const [expandedInd, setExpandedInd] = useState<{
    liquidez: boolean
    endividamento: boolean
    rentabilidade: boolean
    estrutura: boolean
  }>({
    liquidez: true,
    endividamento: true,
    rentabilidade: true,
    estrutura: true,
  })

  // Formulário Balanço
  const [formBalanco, setFormBalanco] = useState<Partial<BalancoRecord>>({})
  // Formulário DRE
  const [formDre, setFormDre] = useState<Partial<DreRecord>>({})
  // Formulário Novo Lançamento (Ano + Balanço + DRE)
  const [novoAno, setNovoAno] = useState<number>(2025)

  // Contas cadastradas pelo usuário (para vínculo com campos do balanço)
  const [contas, setContas] = useState<ContaRecord[]>([])

  const loadData = async () => {
    if (!id) return
    try {
      setLoading(true)
      const [emp, bList, dList, contasList] = await Promise.all([
        empresasService.getById(id),
        balancosService.getByEmpresa(id),
        dreService.getByEmpresa(id),
        contasService.getAll(),
      ])
      setEmpresa(emp)
      setBalancos(bList)
      setDres(dList)
      setContas(contasList)
      setSelectedEmpresaId(emp.id)

      const anos = Array.from(new Set(bList.map((b) => b.ano))).sort((a, b) => b - a)
      if (anos.length > 0 && !anos.includes(selectedAno)) {
        setSelectedAno(anos[0])
      }
    } catch (err) {
      console.error('Erro ao carregar análise da empresa:', err)
      toast({
        variant: 'destructive',
        title: 'Empresa não encontrada',
        description: 'Não foi possível encontrar a empresa informada.',
      })
      navigate('/empresas')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [id])

  useRealtime<BalancoRecord>('balancos', () => {
    if (id) loadData()
  })
  useRealtime<DreRecord>('dre', () => {
    if (id) loadData()
  })
  useRealtime<ContaRecord>('contas', () => {
    if (id) loadData()
  })

  const anosDisponiveis = Array.from(new Set(balancos.map((b) => b.ano))).sort((a, b) => b - a)

  // Mapa de contas por id e agrupadas por tipo (para vínculo no balanço)
  const contasMap = React.useMemo(() => {
    const map = new Map<string, ContaRecord>()
    for (const c of contas) map.set(c.id, c)
    return map
  }, [contas])
  const contasPorTipo = React.useMemo(() => {
    const map = new Map<TipoConta, ContaRecord[]>()
    for (const c of contas) {
      const arr = map.get(c.tipo) || []
      arr.push(c)
      map.set(c.tipo, arr)
    }
    for (const [, arr] of map) {
      arr.sort((a, b) => (a.codigo || '').localeCompare(b.codigo || ''))
    }
    return map
  }, [contas])

  // Meses que possuem lançamentos cadastrados no ano selecionado
  const mesesComDadosNoAno = React.useMemo(() => {
    const mesesSet = new Set<number>()
    balancos.filter((b) => b.ano === selectedAno).forEach((b) => mesesSet.add(b.mes ?? 12))
    dres.filter((d) => d.ano === selectedAno).forEach((d) => mesesSet.add(d.mes ?? 12))
    return Array.from(mesesSet).sort((a, b) => a - b)
  }, [balancos, dres, selectedAno])

  // Balanço e DRE Atual e Anterior considerando se o usuário selecionou um mês específico ou "todos" (Consolidado Anual)
  const balancoAtual = React.useMemo(() => {
    if (selectedMes === 'todos') {
      return consolidarBalancoAnual(balancos, selectedAno)
    }
    const m = Number(selectedMes)
    return balancos.find((b) => b.ano === selectedAno && (b.mes ?? 12) === m) || null
  }, [balancos, selectedAno, selectedMes])

  const dreAtual = React.useMemo(() => {
    if (selectedMes === 'todos') {
      return consolidarDreAnual(dres, selectedAno)
    }
    const m = Number(selectedMes)
    return dres.find((d) => d.ano === selectedAno && (d.mes ?? 12) === m) || null
  }, [dres, selectedAno, selectedMes])

  const anoAnterior = selectedAno - 1
  const balancoAnterior = React.useMemo(() => {
    if (selectedMes === 'todos') {
      return consolidarBalancoAnual(balancos, anoAnterior)
    }
    const m = Number(selectedMes)
    return balancos.find((b) => b.ano === anoAnterior && (b.mes ?? 12) === m) || null
  }, [balancos, anoAnterior, selectedMes])

  const dreAnterior = React.useMemo(() => {
    if (selectedMes === 'todos') {
      return consolidarDreAnual(dres, anoAnterior)
    }
    const m = Number(selectedMes)
    return dres.find((d) => d.ano === anoAnterior && (d.mes ?? 12) === m) || null
  }, [dres, anoAnterior, selectedMes])

  // Vínculos do balanço atual (campo -> contaId)
  const vinculosAtual: VinculosContasBalanco = balancoAtual?.vinculos_contas || {}
  const vinculosForm: VinculosContasBalanco = formBalanco.vinculos_contas || {}

  // Helper: código de conta vinculada a um campo do balanço (visualização)
  const codigoVinculado = (campo: string): string | null => {
    const contaId = vinculosAtual[campo]
    if (!contaId) return null
    const c = contasMap.get(contaId)
    return c?.codigo || null
  }

  // Renderiza o nome do campo com badge do código da conta vinculada (tabela)
  const campoBalanco = (campo: string, label: string) => (
    <div className="flex items-center gap-1.5">
      {label}
      {codigoVinculado(campo) && (
        <Badge className="text-[9px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0">
          <BookOpen className="w-2.5 h-2.5 mr-0.5" />
          {codigoVinculado(campo)}
        </Badge>
      )}
    </div>
  )

  // Helper para renderizar o select de vínculo no modal (agrupado por tipo)
  const renderSelectVinculo = (campo: string) => {
    const valorAtual = vinculosForm[campo] || 'nenhuma'
    return (
      <Select
        value={valorAtual}
        onValueChange={(val) =>
          setFormBalanco((p) => ({
            ...p,
            vinculos_contas: {
              ...(p.vinculos_contas || {}),
              [campo]: val === 'nenhuma' ? undefined : val,
            },
          }))
        }
      >
        <SelectTrigger className="h-8 text-[11px] bg-white">
          <SelectValue placeholder="Sem vínculo" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="nenhuma" className="text-[11px]">
            Sem vínculo
          </SelectItem>
          {(['Ativo', 'Passivo', 'Patrimônio Líquido', 'Receita', 'Despesa'] as TipoConta[]).map(
            (tipo) => {
              const lista = contasPorTipo.get(tipo) || []
              if (lista.length === 0) return null
              return (
                <SelectGroup key={tipo}>
                  <SelectLabel className="text-[10px] font-semibold text-slate-500 uppercase">
                    {tipo}
                  </SelectLabel>
                  {lista.map((c) => (
                    <SelectItem key={c.id} value={c.id} className="text-[11px]">
                      {c.codigo || '—'} - {c.nome}
                    </SelectItem>
                  ))}
                </SelectGroup>
              )
            },
          )}
        </SelectContent>
      </Select>
    )
  }

  // Cálculos
  const calcBAtual = calcularBalanco(balancoAtual)
  const calcBAnterior = calcularBalanco(balancoAnterior)

  const calcDAtual = calcularDre(dreAtual)
  const calcDAnterior = calcularDre(dreAnterior)

  const indAtual = calcularIndicadores(balancoAtual, dreAtual)
  const indAnterior = balancoAnterior ? calcularIndicadores(balancoAnterior, dreAnterior) : null

  const analiseTexto = gerarAnaliseAutomatica(balancoAtual, dreAtual, balancoAnterior, dreAnterior)

  // Helpers para Variação %
  const calcVar = (atual?: number | null, ant?: number | null) => {
    if (atual === undefined || atual === null || ant === undefined || ant === null || ant === 0)
      return null
    return ((atual - ant) / Math.abs(ant)) * 100
  }

  // Helpers para Análise Vertical e Horizontal
  const calcAV = (val: number | undefined | null, base: number) => {
    if (!val || !base) return '—'
    return `${((val / base) * 100).toFixed(1)}%`
  }

  const calcAH = (atualVal?: number | null, antVal?: number | null) => {
    const v = calcVar(atualVal, antVal)
    if (v === null) return '—'
    return `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`
  }

  // Abertura de Modal de Edição Balanço
  const openEditBalancoModal = (mesAlvo?: number) => {
    const targetMes = mesAlvo ?? (selectedMes === 'todos' ? 12 : Number(selectedMes))
    setModalBalancoMes(targetMes)
    const existing = balancos.find((b) => b.ano === selectedAno && (b.mes ?? 12) === targetMes)
    if (existing) {
      setFormBalanco({
        ...existing,
        mes: targetMes,
        vinculos_contas: { ...(existing.vinculos_contas || {}) },
      })
    } else {
      setFormBalanco({
        empresa: id,
        ano: selectedAno,
        mes: targetMes,
        caixa_equivalentes: 0,
        aplicacoes_financeiras: 0,
        contas_receber: 0,
        estoques: 0,
        impostos_recuperar: 0,
        outros_ativo_circulante: 0,
        realizavel_longo_prazo: 0,
        investimentos: 0,
        imobilizado: 0,
        intangivel: 0,
        fornecedores: 0,
        emprestimos_curto_prazo: 0,
        obrigacoes_trabalhistas: 0,
        obrigacoes_tributarias: 0,
        outros_passivo_circulante: 0,
        emprestimos_longo_prazo: 0,
        outras_obrigacoes_longo_prazo: 0,
        capital_social: 0,
        reservas_lucros: 0,
        lucros_acumulados: 0,
        vinculos_contas: {},
      })
    }
    setModalBalancoOpen(true)
  }

  const handleMudarMesModalBalanco = (novoMesValor: number) => {
    setModalBalancoMes(novoMesValor)
    const existing = balancos.find((b) => b.ano === selectedAno && (b.mes ?? 12) === novoMesValor)
    if (existing) {
      setFormBalanco({
        ...existing,
        mes: novoMesValor,
        vinculos_contas: { ...(existing.vinculos_contas || {}) },
      })
    } else {
      setFormBalanco((prev) => ({
        ...prev,
        mes: novoMesValor,
      }))
    }
  }

  const saveBalancoModal = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id) return
    setSavingModal(true)
    try {
      await balancosService.upsert(
        id,
        selectedAno,
        { ...formBalanco, mes: modalBalancoMes },
        modalBalancoMes,
      )
      toast({
        title: 'Balanço salvo com sucesso!',
        description: `Os dados do Balanço Patrimonial (${NOMES_MESES[modalBalancoMes - 1]}/${selectedAno}) foram atualizados.`,
      })
      setModalBalancoOpen(false)
      loadData()
    } catch (err: any) {
      console.error('Erro ao salvar balanço:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar balanço',
        description: err?.message || 'Verifique os valores informados.',
      })
    } finally {
      setSavingModal(false)
    }
  }

  // Abertura de Modal de Edição DRE
  const openEditDreModal = (mesAlvo?: number) => {
    const targetMes = mesAlvo ?? (selectedMes === 'todos' ? 12 : Number(selectedMes))
    setModalDreMes(targetMes)
    const existing = dres.find((d) => d.ano === selectedAno && (d.mes ?? 12) === targetMes)
    if (existing) {
      setFormDre({ ...existing, mes: targetMes })
    } else {
      setFormDre({
        empresa: id,
        ano: selectedAno,
        mes: targetMes,
        receita_bruta: 0,
        deducoes_receita: 0,
        custo_mercadorias: 0,
        despesas_operacionais: 0,
        despesas_financeiras: 0,
        outras_receitas_despesas: 0,
        imposto_renda: 0,
      })
    }
    setModalDreOpen(true)
  }

  const handleMudarMesModalDre = (novoMesValor: number) => {
    setModalDreMes(novoMesValor)
    const existing = dres.find((d) => d.ano === selectedAno && (d.mes ?? 12) === novoMesValor)
    if (existing) {
      setFormDre({ ...existing, mes: novoMesValor })
    } else {
      setFormDre((prev) => ({
        ...prev,
        mes: novoMesValor,
      }))
    }
  }

  const saveDreModal = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id) return
    setSavingModal(true)
    try {
      await dreService.upsert(id, selectedAno, { ...formDre, mes: modalDreMes }, modalDreMes)
      toast({
        title: 'DRE salva com sucesso!',
        description: `O Demonstrativo de Resultado (${NOMES_MESES[modalDreMes - 1]}/${selectedAno}) foi atualizado.`,
      })
      setModalDreOpen(false)
      loadData()
    } catch (err: any) {
      console.error('Erro ao salvar DRE:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar DRE',
        description: err?.message || 'Verifique os valores informados.',
      })
    } finally {
      setSavingModal(false)
    }
  }

  // Abertura de Modal de Novo Lançamento (Ano + Mês com Balanço + DRE)
  const openNovoLancamentoModal = () => {
    const currentAno = anosDisponiveis.length > 0 ? anosDisponiveis[0] : new Date().getFullYear()
    setNovoAno(currentAno)
    setNovoMes(new Date().getMonth() + 1)
    setFormBalanco({
      empresa: id,
      ano: currentAno,
      mes: new Date().getMonth() + 1,
      caixa_equivalentes: 0,
      aplicacoes_financeiras: 0,
      contas_receber: 0,
      estoques: 0,
      impostos_recuperar: 0,
      outros_ativo_circulante: 0,
      realizavel_longo_prazo: 0,
      investimentos: 0,
      imobilizado: 0,
      intangivel: 0,
      fornecedores: 0,
      emprestimos_curto_prazo: 0,
      obrigacoes_trabalhistas: 0,
      obrigacoes_tributarias: 0,
      outros_passivo_circulante: 0,
      emprestimos_longo_prazo: 0,
      outras_obrigacoes_longo_prazo: 0,
      capital_social: 0,
      reservas_lucros: 0,
      lucros_acumulados: 0,
      vinculos_contas: {},
    })
    setFormDre({
      empresa: id,
      ano: currentAno,
      mes: new Date().getMonth() + 1,
      receita_bruta: 0,
      deducoes_receita: 0,
      custo_mercadorias: 0,
      despesas_operacionais: 0,
      despesas_financeiras: 0,
      outras_receitas_despesas: 0,
      imposto_renda: 0,
    })
    setModalNovoLancamentoOpen(true)
  }

  const saveNovoLancamentoModal = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id) return
    setSavingModal(true)
    try {
      await Promise.all([
        balancosService.upsert(
          id,
          novoAno,
          { ...formBalanco, ano: novoAno, mes: novoMes },
          novoMes,
        ),
        dreService.upsert(id, novoAno, { ...formDre, ano: novoAno, mes: novoMes }, novoMes),
      ])
      toast({
        title: 'Lançamento mensal registrado com sucesso!',
        description: `Balanço e DRE de ${NOMES_MESES[novoMes - 1]}/${novoAno} foram gravados.`,
      })
      setSelectedAno(novoAno)
      setModalNovoLancamentoOpen(false)
      loadData()
    } catch (err: any) {
      console.error('Erro ao registrar novo lançamento:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao cadastrar lançamento',
        description: err?.message || 'Verifique se o período já não foi cadastrado.',
      })
    } finally {
      setSavingModal(false)
    }
  }

  // Gráficos da Visão Geral
  const dataComposicaoAtivo = [
    { name: 'Ativo Circulante', value: calcBAtual.ativoCirculante, color: '#2563EB' },
    { name: 'Ativo Não Circulante', value: calcBAtual.ativoNaoCirculante, color: '#0EA5E9' },
  ].filter((d) => d.value > 0)

  const dataComposicaoPassivoPL = [
    { name: 'Passivo Circulante', value: calcBAtual.passivoCirculante, color: '#F59E0B' },
    { name: 'Passivo Não Circulante', value: calcBAtual.passivoNaoCirculante, color: '#8B5CF6' },
    { name: 'Patrimônio Líquido', value: calcBAtual.patrimonioLiquido, color: '#10B981' },
  ].filter((d) => d.value > 0)

  const anosCronologicos = Array.from(new Set(balancos.map((b) => b.ano))).sort((a, b) => a - b)
  const dataReceitaVsLucro = anosCronologicos.map((ano) => {
    const d = dres.find((item) => item.ano === ano)
    const c = calcularDre(d)
    return {
      ano: String(ano),
      receitaLiquida: c.receitaLiquida,
      lucroLiquido: c.lucroLiquido,
    }
  })

  const dataEvolucaoEndividamento = anosCronologicos.map((ano) => {
    const b = balancos.find((item) => item.ano === ano)
    const cb = calcularBalanco(b)
    const eg = cb.ativoTotal > 0 ? (cb.passivoTotal / cb.ativoTotal) * 100 : 0
    return {
      ano: String(ano),
      endividamento: Number(eg.toFixed(1)),
    }
  })

  if (loading && !empresa) {
    return (
      <div className="py-20 flex justify-center items-center">
        <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!empresa) return null

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header Corporativo da Empresa */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-lg shadow-md shadow-blue-600/20">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-extrabold text-[#0B1F3A] tracking-tight">
                {empresa.nome}
              </h1>
              <Badge className="bg-blue-50 text-blue-700 border-blue-200 font-semibold text-xs">
                {empresa.segmento}
              </Badge>
            </div>
            <p className="text-xs text-[#5B6B7F] mt-0.5">
              CNPJ: <span className="font-mono">{formatCnpj(empresa.cnpj)}</span> · Cadastrada em:{' '}
              {new Date(empresa.created).toLocaleDateString('pt-BR')}
            </p>
          </div>
        </div>

        {/* Controles de Período e Ações */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Seletor de Ano */}
          <div className="flex items-center gap-1.5 bg-[#F5F7FA] border border-slate-200 rounded-lg px-3 py-1.5 text-xs">
            <Calendar className="w-3.5 h-3.5 text-blue-600" />
            <span className="font-semibold text-slate-700">Ano:</span>
            <Select
              value={String(selectedAno)}
              onValueChange={(val) => setSelectedAno(Number(val))}
            >
              <SelectTrigger className="h-6 border-none shadow-none bg-transparent text-xs font-bold text-blue-700 p-0 focus:ring-0 w-[60px]">
                <SelectValue />
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

          {/* Seletor de Período: Consolidado Anual ou Mês Específico */}
          <div className="flex items-center gap-1.5 bg-[#F5F7FA] border border-slate-200 rounded-lg px-3 py-1.5 text-xs">
            <span className="font-semibold text-slate-700">Visão:</span>
            <Select value={selectedMes} onValueChange={(val) => setSelectedMes(val)}>
              <SelectTrigger className="h-6 border-none shadow-none bg-transparent text-xs font-bold text-blue-700 p-0 focus:ring-0 w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos" className="text-xs font-semibold">
                  Consolidado Anual
                </SelectItem>
                <SelectGroup>
                  <SelectLabel className="text-[10px] font-semibold text-slate-400 uppercase">
                    Meses Cadastrados
                  </SelectLabel>
                  {NOMES_MESES.map((nomeMes, idx) => {
                    const mesNum = idx + 1
                    const temDados = mesesComDadosNoAno.includes(mesNum)
                    return (
                      <SelectItem key={mesNum} value={String(mesNum)} className="text-xs">
                        {nomeMes} {temDados ? '•' : '(vazio)'}
                      </SelectItem>
                    )
                  })}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={() => setModalImportarBalanceteOpen(true)}
            variant="outline"
            className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-200 font-semibold text-xs h-9 shadow-xs gap-1.5"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-600" />
            Importar Balancete
          </Button>

          <Button
            onClick={openNovoLancamentoModal}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-9 shadow-xs"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Novo Lançamento Mensal
          </Button>
        </div>
      </div>

      {/* Navegação por Abas */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5 bg-slate-200/70 p-1 rounded-xl mb-6">
          <TabsTrigger
            value="visao-geral"
            className="rounded-lg text-xs font-semibold data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm transition-all"
          >
            Visão Geral
          </TabsTrigger>
          <TabsTrigger
            value="comparativo-mensal"
            className="rounded-lg text-xs font-semibold data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm transition-all flex items-center gap-1.5"
          >
            <CalendarRange className="w-3.5 h-3.5" />
            Comparativo Mensal (Jan-Dez)
          </TabsTrigger>
          <TabsTrigger
            value="balanco"
            className="rounded-lg text-xs font-semibold data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm transition-all"
          >
            Balanço Patrimonial
          </TabsTrigger>
          <TabsTrigger
            value="dre"
            className="rounded-lg text-xs font-semibold data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm transition-all"
          >
            DRE
          </TabsTrigger>
          <TabsTrigger
            value="indicadores"
            className="rounded-lg text-xs font-semibold data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm transition-all"
          >
            Indicadores Financeiros
          </TabsTrigger>
        </TabsList>
        {/* =========================================================================
            ABA 1: VISÃO GERAL
        ========================================================================= */}
        <TabsContent value="visao-geral" className="space-y-6 focus-visible:outline-none">
          {' '}
          {/* Cards KPI com variação vs ano anterior */}
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 sm:gap-4">
            {/* Ativo Total */}
            <Card className="p-4 bg-white border-slate-200 shadow-2xs hover:shadow-md transition-all">
              <span className="text-[11px] font-semibold uppercase text-slate-500">
                Ativo Total
              </span>
              <div className="mt-1 text-xl font-bold text-[#0B1F3A]">
                {formatBrlMil(calcBAtual.ativoTotal)}
              </div>
              <div className="mt-2 flex items-center gap-1 text-[11px]">
                {calcVar(calcBAtual.ativoTotal, calcBAnterior.ativoTotal) !== null ? (
                  <>
                    {(calcVar(calcBAtual.ativoTotal, calcBAnterior.ativoTotal) || 0) >= 0 ? (
                      <span className="text-emerald-600 font-semibold flex items-center">
                        <ArrowUpRight className="w-3.5 h-3.5" /> +
                        {formatNumber(calcVar(calcBAtual.ativoTotal, calcBAnterior.ativoTotal), 1)}%
                      </span>
                    ) : (
                      <span className="text-red-600 font-semibold flex items-center">
                        <ArrowDownRight className="w-3.5 h-3.5" />
                        {formatNumber(calcVar(calcBAtual.ativoTotal, calcBAnterior.ativoTotal), 1)}%
                      </span>
                    )}
                    <span className="text-slate-400">vs {anoAnterior}</span>
                  </>
                ) : (
                  <span className="text-slate-400">Sem base {anoAnterior}</span>
                )}
              </div>
            </Card>

            {/* Passivo Total */}
            <Card className="p-4 bg-white border-slate-200 shadow-2xs hover:shadow-md transition-all">
              <span className="text-[11px] font-semibold uppercase text-slate-500">
                Passivo Total
              </span>
              <div className="mt-1 text-xl font-bold text-[#0B1F3A]">
                {formatBrlMil(calcBAtual.passivoTotal)}
              </div>
              <div className="mt-2 flex items-center gap-1 text-[11px]">
                {calcVar(calcBAtual.passivoTotal, calcBAnterior.passivoTotal) !== null ? (
                  <>
                    {(calcVar(calcBAtual.passivoTotal, calcBAnterior.passivoTotal) || 0) >= 0 ? (
                      <span className="text-amber-600 font-semibold flex items-center">
                        <ArrowUpRight className="w-3.5 h-3.5" /> +
                        {formatNumber(
                          calcVar(calcBAtual.passivoTotal, calcBAnterior.passivoTotal),
                          1,
                        )}
                        %
                      </span>
                    ) : (
                      <span className="text-emerald-600 font-semibold flex items-center">
                        <ArrowDownRight className="w-3.5 h-3.5" />
                        {formatNumber(
                          calcVar(calcBAtual.passivoTotal, calcBAnterior.passivoTotal),
                          1,
                        )}
                        %
                      </span>
                    )}
                    <span className="text-slate-400">vs {anoAnterior}</span>
                  </>
                ) : (
                  <span className="text-slate-400">Sem base {anoAnterior}</span>
                )}
              </div>
            </Card>

            {/* Patrimônio Líquido */}
            <Card className="p-4 bg-white border-slate-200 shadow-2xs hover:shadow-md transition-all">
              <span className="text-[11px] font-semibold uppercase text-slate-500">
                Patrimônio Líquido
              </span>
              <div className="mt-1 text-xl font-bold text-emerald-700">
                {formatBrlMil(calcBAtual.patrimonioLiquido)}
              </div>
              <div className="mt-2 flex items-center gap-1 text-[11px]">
                {calcVar(calcBAtual.patrimonioLiquido, calcBAnterior.patrimonioLiquido) !== null ? (
                  <>
                    {(calcVar(calcBAtual.patrimonioLiquido, calcBAnterior.patrimonioLiquido) ||
                      0) >= 0 ? (
                      <span className="text-emerald-600 font-semibold flex items-center">
                        <ArrowUpRight className="w-3.5 h-3.5" /> +
                        {formatNumber(
                          calcVar(calcBAtual.patrimonioLiquido, calcBAnterior.patrimonioLiquido),
                          1,
                        )}
                        %
                      </span>
                    ) : (
                      <span className="text-red-600 font-semibold flex items-center">
                        <ArrowDownRight className="w-3.5 h-3.5" />
                        {formatNumber(
                          calcVar(calcBAtual.patrimonioLiquido, calcBAnterior.patrimonioLiquido),
                          1,
                        )}
                        %
                      </span>
                    )}
                    <span className="text-slate-400">vs {anoAnterior}</span>
                  </>
                ) : (
                  <span className="text-slate-400">Sem base {anoAnterior}</span>
                )}
              </div>
            </Card>

            {/* Liquidez Corrente */}
            <Card className="p-4 bg-white border-slate-200 shadow-2xs hover:shadow-md transition-all">
              <span className="text-[11px] font-semibold uppercase text-slate-500">
                Liquidez Corrente
              </span>
              <div
                className={`mt-1 text-xl font-bold ${
                  (indAtual.liquidezCorrente || 0) >= 1.0
                    ? 'text-emerald-600'
                    : (indAtual.liquidezCorrente || 0) >= 0.8
                      ? 'text-amber-500'
                      : 'text-red-600'
                }`}
              >
                {formatNumber(indAtual.liquidezCorrente, 2)}
              </div>
              <div className="mt-2 text-[11px] text-slate-400">
                {indAnterior?.liquidezCorrente
                  ? `Ant: ${formatNumber(indAnterior.liquidezCorrente, 2)}`
                  : 'Sem base ant.'}
              </div>
            </Card>

            {/* ROE */}
            <Card className="p-4 bg-white border-slate-200 shadow-2xs hover:shadow-md transition-all">
              <span className="text-[11px] font-semibold uppercase text-slate-500">
                ROE (Rent. PL)
              </span>
              <div
                className={`mt-1 text-xl font-bold ${
                  (indAtual.roe || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'
                }`}
              >
                {formatPercent(indAtual.roe, 1)}
              </div>
              <div className="mt-2 text-[11px] text-slate-400">
                {indAnterior?.roe ? `Ant: ${formatPercent(indAnterior.roe, 1)}` : 'Sem base ant.'}
              </div>
            </Card>

            {/* Margem Líquida */}
            <Card className="p-4 bg-white border-slate-200 shadow-2xs hover:shadow-md transition-all">
              <span className="text-[11px] font-semibold uppercase text-slate-500">
                Margem Líquida
              </span>
              <div
                className={`mt-1 text-xl font-bold ${
                  (indAtual.margemLiquida || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'
                }`}
              >
                {formatPercent(indAtual.margemLiquida, 1)}
              </div>
              <div className="mt-2 text-[11px] text-slate-400">
                {indAnterior?.margemLiquida
                  ? `Ant: ${formatPercent(indAnterior.margemLiquida, 1)}`
                  : 'Sem base ant.'}
              </div>
            </Card>
          </div>
          {/* Gráficos Visão Geral */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Composição Ativo */}
            <Card className="bg-white border-slate-200 shadow-2xs">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold text-[#0B1F3A]">
                  Composição do Ativo ({selectedAno})
                </CardTitle>
                <CardDescription className="text-xs">
                  Ativo Circulante vs Não Circulante
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={dataComposicaoAtivo}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
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
                        height={32}
                        formatter={(val, entry: any) => (
                          <span className="text-xs text-slate-700">
                            {val}: {formatBrlMil(entry.payload.value)}
                          </span>
                        )}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Composição Passivo + PL */}
            <Card className="bg-white border-slate-200 shadow-2xs">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold text-[#0B1F3A]">
                  Composição do Passivo e PL ({selectedAno})
                </CardTitle>
                <CardDescription className="text-xs">
                  Passivo Circulante, Não Circulante e Capital Próprio
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={dataComposicaoPassivoPL}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
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
                        height={32}
                        formatter={(val, entry: any) => (
                          <span className="text-xs text-slate-700">
                            {val}: {formatBrlMil(entry.payload.value)}
                          </span>
                        )}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Evolução Receita vs Lucro */}
            <Card className="bg-white border-slate-200 shadow-2xs">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold text-[#0B1F3A]">
                  Evolução Receita vs Lucro Líquido
                </CardTitle>
                <CardDescription className="text-xs">
                  Faturamento líquido e resultado nos períodos disponíveis
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={dataReceitaVsLucro}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                      <XAxis dataKey="ano" tick={{ fontSize: 11, fill: '#64748B' }} />
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
              </CardContent>
            </Card>

            {/* Evolução do Endividamento Geral */}
            <Card className="bg-white border-slate-200 shadow-2xs">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold text-[#0B1F3A]">
                  Evolução do Endividamento Geral (%)
                </CardTitle>
                <CardDescription className="text-xs">
                  Percentual do Ativo financiado por Capital de Terceiros
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={dataEvolucaoEndividamento}
                      margin={{ top: 10, right: 20, left: -20, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                      <XAxis dataKey="ano" tick={{ fontSize: 11, fill: '#64748B' }} />
                      <YAxis
                        tick={{ fontSize: 11, fill: '#64748B' }}
                        tickFormatter={(v) => `${v}%`}
                        domain={[0, 100]}
                      />
                      <RechartsTooltip formatter={(val: any) => [`${val}%`, 'Endividamento']} />
                      <Line
                        type="monotone"
                        dataKey="endividamento"
                        name="Endividamento Geral"
                        stroke="#F59E0B"
                        strokeWidth={2.5}
                        dot={{ r: 4, fill: '#F59E0B' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
          {/* Painel "Análise do Consultor" */}
          <Card className="bg-gradient-to-br from-blue-900 to-[#0B1F3A] text-white border-blue-950 shadow-md">
            <CardHeader className="pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-500/30 rounded-lg text-blue-300">
                  <ShieldCheck className="w-5 h-5 text-blue-300" />
                </div>
                <div>
                  <CardTitle className="text-base font-bold text-white">
                    Parecer do Consultor Financeiro ({selectedAno})
                  </CardTitle>
                  <CardDescription className="text-xs text-blue-200/70">
                    Diagnóstico automático gerado com base nas regras contábeis e evolução
                    patrimonial
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-3 text-xs leading-relaxed text-blue-50">
              {analiseTexto.visaoGeral.map((paragrafo, idx) => (
                <p key={idx} className="bg-white/5 p-3 rounded-xl border border-white/10">
                  {paragrafo}
                </p>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
        {/* =========================================================================
            NOVA ABA: COMPARATIVO MÊS A MÊS (JANEIRO A DEZEMBRO + FECHAMENTO)
        ========================================================================= */}
        <TabsContent value="comparativo-mensal" className="space-y-6 focus-visible:outline-none">
          <ComparativoMensal
            empresaId={id || ''}
            empresaNome={empresa.nome}
            ano={selectedAno}
            balancos={balancos}
            dres={dres}
            onSelectMes={(mesNum) => {
              setSelectedMes(String(mesNum))
              setActiveTab('balanco')
            }}
            onOpenNovoLancamento={openNovoLancamentoModal}
            onDataChange={loadData}
          />
        </TabsContent>
        {/* =========================================================================
            ABA 2: BALANÇO PATRIMONIAL
        ========================================================================= */}{' '}
        <TabsContent value="balanco" className="space-y-4 focus-visible:outline-none">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-[#0B1F3A]">Balanço Patrimonial Completo</h3>
                {selectedMes !== 'todos' ? (
                  <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-[11px] font-semibold">
                    Mês de {NOMES_MESES[Number(selectedMes) - 1]} / {selectedAno}
                  </Badge>
                ) : (
                  <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[11px] font-semibold">
                    Consolidado Anual ({selectedAno})
                  </Badge>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Valores em R$ mil · Análise Vertical (AV%) sobre grupos e Horizontal (AH%) vs{' '}
                {anoAnterior}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                onClick={() =>
                  openEditBalancoModal(selectedMes !== 'todos' ? Number(selectedMes) : 12)
                }
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-8"
              >
                <Pencil className="w-3.5 h-3.5 mr-1.5" />
                {selectedMes !== 'todos'
                  ? `Editar Balanço (${NOMES_MESES_ABREV[Number(selectedMes) - 1]}/${selectedAno})`
                  : `Editar Balanço (Dezembro/${selectedAno})`}
              </Button>
            </div>
          </div>

          <Card className="bg-white border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-100/80 text-slate-700 font-semibold">
                    <th className="py-2.5 px-4">Conta Patrimonial</th>
                    <th className="py-2.5 px-4 text-right">{selectedAno} (R$ mil)</th>
                    <th className="py-2.5 px-4 text-right">{anoAnterior} (R$ mil)</th>
                    <th className="py-2.5 px-4 text-center">AV% ({selectedAno})</th>
                    <th className="py-2.5 px-4 text-center">AH% (vs {anoAnterior})</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {/* === ATIVO === */}
                  <tr className="bg-blue-50/70 font-bold text-blue-950">
                    <td className="py-2 px-4">1. ATIVO TOTAL</td>
                    <td className="py-2 px-4 text-right">{formatBrlMil(calcBAtual.ativoTotal)}</td>
                    <td className="py-2 px-4 text-right">
                      {formatBrlMil(calcBAnterior.ativoTotal)}
                    </td>
                    <td className="py-2 px-4 text-center">100,0%</td>
                    <td className="py-2 px-4 text-center">
                      {calcAH(calcBAtual.ativoTotal, calcBAnterior.ativoTotal)}
                    </td>
                  </tr>

                  {/* 1.1 ATIVO CIRCULANTE */}
                  <tr className="bg-slate-50/90 font-semibold text-slate-900">
                    <td className="py-1.5 px-6">1.1 Ativo Circulante</td>
                    <td className="py-1.5 px-4 text-right">
                      {formatBrlMil(calcBAtual.ativoCirculante)}
                    </td>
                    <td className="py-1.5 px-4 text-right">
                      {formatBrlMil(calcBAnterior.ativoCirculante)}
                    </td>
                    <td className="py-1.5 px-4 text-center font-medium">
                      {calcAV(calcBAtual.ativoCirculante, calcBAtual.ativoTotal)}
                    </td>
                    <td className="py-1.5 px-4 text-center font-medium">
                      {calcAH(calcBAtual.ativoCirculante, calcBAnterior.ativoCirculante)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1 px-8 text-slate-600">
                      <div className="flex items-center gap-1.5">
                        Caixa e Equivalentes de Caixa
                        {codigoVinculado('caixa_equivalentes') && (
                          <Badge className="text-[9px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0">
                            <BookOpen className="w-2.5 h-2.5 mr-0.5" />
                            {codigoVinculado('caixa_equivalentes')}
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="py-1 px-4 text-right">
                      {formatBrlMil(balancoAtual?.caixa_equivalentes)}
                    </td>
                    <td className="py-1 px-4 text-right">
                      {formatBrlMil(balancoAnterior?.caixa_equivalentes)}
                    </td>
                    <td className="py-1 px-4 text-center text-slate-500">
                      {calcAV(balancoAtual?.caixa_equivalentes, calcBAtual.ativoTotal)}
                    </td>
                    <td className="py-1 px-4 text-center text-slate-500">
                      {calcAH(
                        balancoAtual?.caixa_equivalentes,
                        balancoAnterior?.caixa_equivalentes,
                      )}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1 px-8 text-slate-600">
                      <div className="flex items-center gap-1.5">
                        Aplicações Financeiras
                        {codigoVinculado('aplicacoes_financeiras') && (
                          <Badge className="text-[9px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0">
                            <BookOpen className="w-2.5 h-2.5 mr-0.5" />
                            {codigoVinculado('aplicacoes_financeiras')}
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="py-1 px-4 text-right">
                      {formatBrlMil(balancoAtual?.aplicacoes_financeiras)}
                    </td>
                    <td className="py-1 px-4 text-right">
                      {formatBrlMil(balancoAnterior?.aplicacoes_financeiras)}
                    </td>
                    <td className="py-1 px-4 text-center text-slate-500">
                      {calcAV(balancoAtual?.aplicacoes_financeiras, calcBAtual.ativoTotal)}
                    </td>
                    <td className="py-1 px-4 text-center text-slate-500">
                      {calcAH(
                        balancoAtual?.aplicacoes_financeiras,
                        balancoAnterior?.aplicacoes_financeiras,
                      )}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1 px-8 text-slate-600">
                      <div className="flex items-center gap-1.5">
                        Contas a Receber (Clientes)
                        {codigoVinculado('contas_receber') && (
                          <Badge className="text-[9px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0">
                            <BookOpen className="w-2.5 h-2.5 mr-0.5" />
                            {codigoVinculado('contas_receber')}
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="py-1 px-4 text-right">
                      {formatBrlMil(balancoAtual?.contas_receber)}
                    </td>
                    <td className="py-1 px-4 text-right">
                      {formatBrlMil(balancoAnterior?.contas_receber)}
                    </td>
                    <td className="py-1 px-4 text-center text-slate-500">
                      {calcAV(balancoAtual?.contas_receber, calcBAtual.ativoTotal)}
                    </td>
                    <td className="py-1 px-4 text-center text-slate-500">
                      {calcAH(balancoAtual?.contas_receber, balancoAnterior?.contas_receber)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1 px-8 text-slate-600">
                      <div className="flex items-center gap-1.5">
                        Estoques
                        {codigoVinculado('estoques') && (
                          <Badge className="text-[9px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0">
                            <BookOpen className="w-2.5 h-2.5 mr-0.5" />
                            {codigoVinculado('estoques')}
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="py-1 px-4 text-right">{formatBrlMil(balancoAtual?.estoques)}</td>
                    <td className="py-1 px-4 text-right">
                      {formatBrlMil(balancoAnterior?.estoques)}
                    </td>
                    <td className="py-1 px-4 text-center text-slate-500">
                      {calcAV(balancoAtual?.estoques, calcBAtual.ativoTotal)}
                    </td>
                    <td className="py-1 px-4 text-center text-slate-500">
                      {calcAH(balancoAtual?.estoques, balancoAnterior?.estoques)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1 px-8 text-slate-600">
                      <div className="flex items-center gap-1.5">
                        Impostos a Recuperar
                        {codigoVinculado('impostos_recuperar') && (
                          <Badge className="text-[9px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0">
                            <BookOpen className="w-2.5 h-2.5 mr-0.5" />
                            {codigoVinculado('impostos_recuperar')}
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="py-1 px-4 text-right">
                      {formatBrlMil(balancoAtual?.impostos_recuperar)}
                    </td>
                    <td className="py-1 px-4 text-right">
                      {formatBrlMil(balancoAnterior?.impostos_recuperar)}
                    </td>
                    <td className="py-1 px-4 text-center text-slate-500">
                      {calcAV(balancoAtual?.impostos_recuperar, calcBAtual.ativoTotal)}
                    </td>
                    <td className="py-1 px-4 text-center text-slate-500">
                      {calcAH(
                        balancoAtual?.impostos_recuperar,
                        balancoAnterior?.impostos_recuperar,
                      )}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1 px-8 text-slate-600">
                      <div className="flex items-center gap-1.5">
                        Outros Ativos Circulantes
                        {codigoVinculado('outros_ativo_circulante') && (
                          <Badge className="text-[9px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0">
                            <BookOpen className="w-2.5 h-2.5 mr-0.5" />
                            {codigoVinculado('outros_ativo_circulante')}
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="py-1 px-4 text-right">
                      {formatBrlMil(balancoAtual?.outros_ativo_circulante)}
                    </td>
                    <td className="py-1 px-4 text-right">
                      {formatBrlMil(balancoAnterior?.outros_ativo_circulante)}
                    </td>
                    <td className="py-1 px-4 text-center text-slate-500">
                      {calcAV(balancoAtual?.outros_ativo_circulante, calcBAtual.ativoTotal)}
                    </td>
                    <td className="py-1 px-4 text-center text-slate-500">
                      {calcAH(
                        balancoAtual?.outros_ativo_circulante,
                        balancoAnterior?.outros_ativo_circulante,
                      )}
                    </td>
                  </tr>

                  {/* 1.2 ATIVO NÃO CIRCULANTE */}
                  <tr className="bg-slate-50/90 font-semibold text-slate-900">
                    <td className="py-1.5 px-6">1.2 Ativo Não Circulante</td>
                    <td className="py-1.5 px-4 text-right">
                      {formatBrlMil(calcBAtual.ativoNaoCirculante)}
                    </td>
                    <td className="py-1.5 px-4 text-right">
                      {formatBrlMil(calcBAnterior.ativoNaoCirculante)}
                    </td>
                    <td className="py-1.5 px-4 text-center font-medium">
                      {calcAV(calcBAtual.ativoNaoCirculante, calcBAtual.ativoTotal)}
                    </td>
                    <td className="py-1.5 px-4 text-center font-medium">
                      {calcAH(calcBAtual.ativoNaoCirculante, calcBAnterior.ativoNaoCirculante)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1 px-8 text-slate-600">
                      {campoBalanco('realizavel_longo_prazo', 'Realizável a Longo Prazo')}
                    </td>
                    <td className="py-1 px-4 text-right">
                      {formatBrlMil(balancoAtual?.realizavel_longo_prazo)}
                    </td>
                    <td className="py-1 px-4 text-right">
                      {formatBrlMil(balancoAnterior?.realizavel_longo_prazo)}
                    </td>
                    <td className="py-1 px-4 text-center text-slate-500">
                      {calcAV(balancoAtual?.realizavel_longo_prazo, calcBAtual.ativoTotal)}
                    </td>
                    <td className="py-1 px-4 text-center text-slate-500">
                      {calcAH(
                        balancoAtual?.realizavel_longo_prazo,
                        balancoAnterior?.realizavel_longo_prazo,
                      )}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1 px-8 text-slate-600">
                      {campoBalanco('investimentos', 'Investimentos')}
                    </td>
                    <td className="py-1 px-4 text-right">
                      {formatBrlMil(balancoAtual?.investimentos)}
                    </td>
                    <td className="py-1 px-4 text-right">
                      {formatBrlMil(balancoAnterior?.investimentos)}
                    </td>
                    <td className="py-1 px-4 text-center text-slate-500">
                      {calcAV(balancoAtual?.investimentos, calcBAtual.ativoTotal)}
                    </td>
                    <td className="py-1 px-4 text-center text-slate-500">
                      {calcAH(balancoAtual?.investimentos, balancoAnterior?.investimentos)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1 px-8 text-slate-600">
                      {campoBalanco('imobilizado', 'Imobilizado')}
                    </td>
                    <td className="py-1 px-4 text-right">
                      {formatBrlMil(balancoAtual?.imobilizado)}
                    </td>
                    <td className="py-1 px-4 text-right">
                      {formatBrlMil(balancoAnterior?.imobilizado)}
                    </td>
                    <td className="py-1 px-4 text-center text-slate-500">
                      {calcAV(balancoAtual?.imobilizado, calcBAtual.ativoTotal)}
                    </td>
                    <td className="py-1 px-4 text-center text-slate-500">
                      {calcAH(balancoAtual?.imobilizado, balancoAnterior?.imobilizado)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1 px-8 text-slate-600">
                      {campoBalanco('intangivel', 'Intangível')}
                    </td>
                    <td className="py-1 px-4 text-right">
                      {formatBrlMil(balancoAtual?.intangivel)}
                    </td>
                    <td className="py-1 px-4 text-right">
                      {formatBrlMil(balancoAnterior?.intangivel)}
                    </td>
                    <td className="py-1 px-4 text-center text-slate-500">
                      {calcAV(balancoAtual?.intangivel, calcBAtual.ativoTotal)}
                    </td>
                    <td className="py-1 px-4 text-center text-slate-500">
                      {calcAH(balancoAtual?.intangivel, balancoAnterior?.intangivel)}
                    </td>
                  </tr>

                  {/* === PASSIVO E PL === */}
                  <tr className="bg-amber-50/70 font-bold text-amber-950">
                    <td className="py-2 px-4">2. PASSIVO E PATRIMÔNIO LÍQUIDO</td>
                    <td className="py-2 px-4 text-right">{formatBrlMil(calcBAtual.passivoEPL)}</td>
                    <td className="py-2 px-4 text-right">
                      {formatBrlMil(calcBAnterior.passivoEPL)}
                    </td>
                    <td className="py-2 px-4 text-center">100,0%</td>
                    <td className="py-2 px-4 text-center">
                      {calcAH(calcBAtual.passivoEPL, calcBAnterior.passivoEPL)}
                    </td>
                  </tr>

                  {/* 2.1 PASSIVO CIRCULANTE */}
                  <tr className="bg-slate-50/90 font-semibold text-slate-900">
                    <td className="py-1.5 px-6">2.1 Passivo Circulante (Curto Prazo)</td>
                    <td className="py-1.5 px-4 text-right">
                      {formatBrlMil(calcBAtual.passivoCirculante)}
                    </td>
                    <td className="py-1.5 px-4 text-right">
                      {formatBrlMil(calcBAnterior.passivoCirculante)}
                    </td>
                    <td className="py-1.5 px-4 text-center font-medium">
                      {calcAV(calcBAtual.passivoCirculante, calcBAtual.passivoEPL)}
                    </td>
                    <td className="py-1.5 px-4 text-center font-medium">
                      {calcAH(calcBAtual.passivoCirculante, calcBAnterior.passivoCirculante)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1 px-8 text-slate-600">
                      {campoBalanco('fornecedores', 'Fornecedores')}
                    </td>
                    <td className="py-1 px-4 text-right">
                      {formatBrlMil(balancoAtual?.fornecedores)}
                    </td>
                    <td className="py-1 px-4 text-right">
                      {formatBrlMil(balancoAnterior?.fornecedores)}
                    </td>
                    <td className="py-1 px-4 text-center text-slate-500">
                      {calcAV(balancoAtual?.fornecedores, calcBAtual.passivoEPL)}
                    </td>
                    <td className="py-1 px-4 text-center text-slate-500">
                      {calcAH(balancoAtual?.fornecedores, balancoAnterior?.fornecedores)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1 px-8 text-slate-600">
                      <div className="flex items-center gap-1.5">
                        {campoBalanco(
                          'emprestimos_curto_prazo',
                          'Empréstimos e Financiamentos de Curto Prazo',
                        )}
                      </div>
                    </td>
                    <td className="py-1 px-4 text-right">
                      {formatBrlMil(balancoAtual?.emprestimos_curto_prazo)}
                    </td>
                    <td className="py-1 px-4 text-right">
                      {formatBrlMil(balancoAnterior?.emprestimos_curto_prazo)}
                    </td>
                    <td className="py-1 px-4 text-center text-slate-500">
                      {calcAV(balancoAtual?.emprestimos_curto_prazo, calcBAtual.passivoEPL)}
                    </td>
                    <td className="py-1 px-4 text-center text-slate-500">
                      {calcAH(
                        balancoAtual?.emprestimos_curto_prazo,
                        balancoAnterior?.emprestimos_curto_prazo,
                      )}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1 px-8 text-slate-600">
                      {campoBalanco(
                        'obrigacoes_trabalhistas',
                        'Obrigações Trabalhistas e Previdenciárias',
                      )}
                    </td>
                    <td className="py-1 px-4 text-right">
                      {formatBrlMil(balancoAtual?.obrigacoes_trabalhistas)}
                    </td>
                    <td className="py-1 px-4 text-right">
                      {formatBrlMil(balancoAnterior?.obrigacoes_trabalhistas)}
                    </td>
                    <td className="py-1 px-4 text-center text-slate-500">
                      {calcAV(balancoAtual?.obrigacoes_trabalhistas, calcBAtual.passivoEPL)}
                    </td>
                    <td className="py-1 px-4 text-center text-slate-500">
                      {calcAH(
                        balancoAtual?.obrigacoes_trabalhistas,
                        balancoAnterior?.obrigacoes_trabalhistas,
                      )}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1 px-8 text-slate-600">
                      {campoBalanco('obrigacoes_tributarias', 'Obrigações Tributárias')}
                    </td>
                    <td className="py-1 px-4 text-right">
                      {formatBrlMil(balancoAtual?.obrigacoes_tributarias)}
                    </td>
                    <td className="py-1 px-4 text-right">
                      {formatBrlMil(balancoAnterior?.obrigacoes_tributarias)}
                    </td>
                    <td className="py-1 px-4 text-center text-slate-500">
                      {calcAV(balancoAtual?.obrigacoes_tributarias, calcBAtual.passivoEPL)}
                    </td>
                    <td className="py-1 px-4 text-center text-slate-500">
                      {calcAH(
                        balancoAtual?.obrigacoes_tributarias,
                        balancoAnterior?.obrigacoes_tributarias,
                      )}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1 px-8 text-slate-600">
                      {campoBalanco('outros_passivo_circulante', 'Outros Passivos Circulantes')}
                    </td>
                    <td className="py-1 px-4 text-right">
                      {formatBrlMil(balancoAtual?.outros_passivo_circulante)}
                    </td>
                    <td className="py-1 px-4 text-right">
                      {formatBrlMil(balancoAnterior?.outros_passivo_circulante)}
                    </td>
                    <td className="py-1 px-4 text-center text-slate-500">
                      {calcAV(balancoAtual?.outros_passivo_circulante, calcBAtual.passivoEPL)}
                    </td>
                    <td className="py-1 px-4 text-center text-slate-500">
                      {calcAH(
                        balancoAtual?.outros_passivo_circulante,
                        balancoAnterior?.outros_passivo_circulante,
                      )}
                    </td>
                  </tr>

                  {/* 2.2 PASSIVO NÃO CIRCULANTE */}
                  <tr className="bg-slate-50/90 font-semibold text-slate-900">
                    <td className="py-1.5 px-6">2.2 Passivo Não Circulante (Longo Prazo)</td>
                    <td className="py-1.5 px-4 text-right">
                      {formatBrlMil(calcBAtual.passivoNaoCirculante)}
                    </td>
                    <td className="py-1.5 px-4 text-right">
                      {formatBrlMil(calcBAnterior.passivoNaoCirculante)}
                    </td>
                    <td className="py-1.5 px-4 text-center font-medium">
                      {calcAV(calcBAtual.passivoNaoCirculante, calcBAtual.passivoEPL)}
                    </td>
                    <td className="py-1.5 px-4 text-center font-medium">
                      {calcAH(calcBAtual.passivoNaoCirculante, calcBAnterior.passivoNaoCirculante)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1 px-8 text-slate-600">
                      {campoBalanco(
                        'emprestimos_longo_prazo',
                        'Empréstimos e Financiamentos de Longo Prazo',
                      )}
                    </td>
                    <td className="py-1 px-4 text-right">
                      {formatBrlMil(balancoAtual?.emprestimos_longo_prazo)}
                    </td>
                    <td className="py-1 px-4 text-right">
                      {formatBrlMil(balancoAnterior?.emprestimos_longo_prazo)}
                    </td>
                    <td className="py-1 px-4 text-center text-slate-500">
                      {calcAV(balancoAtual?.emprestimos_longo_prazo, calcBAtual.passivoEPL)}
                    </td>
                    <td className="py-1 px-4 text-center text-slate-500">
                      {calcAH(
                        balancoAtual?.emprestimos_longo_prazo,
                        balancoAnterior?.emprestimos_longo_prazo,
                      )}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1 px-8 text-slate-600">
                      {campoBalanco(
                        'outras_obrigacoes_longo_prazo',
                        'Outras Obrigações de Longo Prazo',
                      )}
                    </td>
                    <td className="py-1 px-4 text-right">
                      {formatBrlMil(balancoAtual?.outras_obrigacoes_longo_prazo)}
                    </td>
                    <td className="py-1 px-4 text-right">
                      {formatBrlMil(balancoAnterior?.outras_obrigacoes_longo_prazo)}
                    </td>
                    <td className="py-1 px-4 text-center text-slate-500">
                      {calcAV(balancoAtual?.outras_obrigacoes_longo_prazo, calcBAtual.passivoEPL)}
                    </td>
                    <td className="py-1 px-4 text-center text-slate-500">
                      {calcAH(
                        balancoAtual?.outras_obrigacoes_longo_prazo,
                        balancoAnterior?.outras_obrigacoes_longo_prazo,
                      )}
                    </td>
                  </tr>

                  {/* 2.3 PATRIMÔNIO LÍQUIDO */}
                  <tr className="bg-emerald-50/80 font-bold text-emerald-950">
                    <td className="py-1.5 px-6">2.3 Patrimônio Líquido (Capital Próprio)</td>
                    <td className="py-1.5 px-4 text-right">
                      {formatBrlMil(calcBAtual.patrimonioLiquido)}
                    </td>
                    <td className="py-1.5 px-4 text-right">
                      {formatBrlMil(calcBAnterior.patrimonioLiquido)}
                    </td>
                    <td className="py-1.5 px-4 text-center font-semibold">
                      {calcAV(calcBAtual.patrimonioLiquido, calcBAtual.passivoEPL)}
                    </td>
                    <td className="py-1.5 px-4 text-center font-semibold">
                      {calcAH(calcBAtual.patrimonioLiquido, calcBAnterior.patrimonioLiquido)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1 px-8 text-slate-600">
                      {campoBalanco('capital_social', 'Capital Social Integralizado')}
                    </td>
                    <td className="py-1 px-4 text-right">
                      {formatBrlMil(balancoAtual?.capital_social)}
                    </td>
                    <td className="py-1 px-4 text-right">
                      {formatBrlMil(balancoAnterior?.capital_social)}
                    </td>
                    <td className="py-1 px-4 text-center text-slate-500">
                      {calcAV(balancoAtual?.capital_social, calcBAtual.passivoEPL)}
                    </td>
                    <td className="py-1 px-4 text-center text-slate-500">
                      {calcAH(balancoAtual?.capital_social, balancoAnterior?.capital_social)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1 px-8 text-slate-600">
                      {campoBalanco('reservas_lucros', 'Reservas de Lucros')}
                    </td>
                    <td className="py-1 px-4 text-right">
                      {formatBrlMil(balancoAtual?.reservas_lucros)}
                    </td>
                    <td className="py-1 px-4 text-right">
                      {formatBrlMil(balancoAnterior?.reservas_lucros)}
                    </td>
                    <td className="py-1 px-4 text-center text-slate-500">
                      {calcAV(balancoAtual?.reservas_lucros, calcBAtual.passivoEPL)}
                    </td>
                    <td className="py-1 px-4 text-center text-slate-500">
                      {calcAH(balancoAtual?.reservas_lucros, balancoAnterior?.reservas_lucros)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1 px-8 text-slate-600">
                      {campoBalanco('lucros_acumulados', 'Lucros ou Prejuízos Acumulados')}
                    </td>
                    <td className="py-1 px-4 text-right">
                      {formatBrlMil(balancoAtual?.lucros_acumulados)}
                    </td>
                    <td className="py-1 px-4 text-right">
                      {formatBrlMil(balancoAnterior?.lucros_acumulados)}
                    </td>
                    <td className="py-1 px-4 text-center text-slate-500">
                      {calcAV(balancoAtual?.lucros_acumulados, calcBAtual.passivoEPL)}
                    </td>
                    <td className="py-1 px-4 text-center text-slate-500">
                      {calcAH(balancoAtual?.lucros_acumulados, balancoAnterior?.lucros_acumulados)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
        {/* =========================================================================
            ABA 3: DRE (DEMONSTRATIVO DO RESULTADO DO EXERCÍCIO)
        ========================================================================= */}
        <TabsContent value="dre" className="space-y-4 focus-visible:outline-none">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-[#0B1F3A]">
                  Demonstrativo do Resultado do Exercício (DRE)
                </h3>
                {selectedMes !== 'todos' ? (
                  <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-[11px] font-semibold">
                    Mês de {NOMES_MESES[Number(selectedMes) - 1]} / {selectedAno}
                  </Badge>
                ) : (
                  <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[11px] font-semibold">
                    Consolidado Anual (Soma dos 12 meses de {selectedAno})
                  </Badge>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Valores em R$ mil · Análise Vertical (AV%) sobre a Receita Líquida e Horizontal
                (AH%) vs {anoAnterior}
              </p>
            </div>
            <Button
              onClick={() => openEditDreModal(selectedMes !== 'todos' ? Number(selectedMes) : 12)}
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-8"
            >
              <Pencil className="w-3.5 h-3.5 mr-1.5" />
              {selectedMes !== 'todos'
                ? `Editar DRE (${NOMES_MESES_ABREV[Number(selectedMes) - 1]}/${selectedAno})`
                : `Editar DRE (Dezembro/${selectedAno})`}
            </Button>
          </div>

          <Card className="bg-white border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-100/80 text-slate-700 font-semibold">
                    <th className="py-2.5 px-4">Linha da DRE</th>
                    <th className="py-2.5 px-4 text-right">{selectedAno} (R$ mil)</th>
                    <th className="py-2.5 px-4 text-right">{anoAnterior} (R$ mil)</th>
                    <th className="py-2.5 px-4 text-center">AV% (sobre Rec. Líq.)</th>
                    <th className="py-2.5 px-4 text-center">AH% (vs {anoAnterior})</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {/* Receita Bruta */}
                  <tr>
                    <td className="py-2 px-4 font-medium text-slate-800">
                      (=) Receita Operacional Bruta
                    </td>
                    <td className="py-2 px-4 text-right font-medium">
                      {formatBrlMil(dreAtual?.receita_bruta)}
                    </td>
                    <td className="py-2 px-4 text-right text-slate-600">
                      {formatBrlMil(dreAnterior?.receita_bruta)}
                    </td>
                    <td className="py-2 px-4 text-center text-slate-500">
                      {calcAV(dreAtual?.receita_bruta, calcDAtual.receitaLiquida)}
                    </td>
                    <td className="py-2 px-4 text-center text-slate-500">
                      {calcAH(dreAtual?.receita_bruta, dreAnterior?.receita_bruta)}
                    </td>
                  </tr>

                  {/* Deduções */}
                  <tr>
                    <td className="py-2 px-6 text-red-600">
                      (−) Deduções da Receita Bruta e Impostos
                    </td>
                    <td className="py-2 px-4 text-right text-red-600">
                      {dreAtual?.deducoes_receita
                        ? `- ${formatBrlMil(dreAtual.deducoes_receita)}`
                        : '—'}
                    </td>
                    <td className="py-2 px-4 text-right text-slate-600">
                      {dreAnterior?.deducoes_receita
                        ? `- ${formatBrlMil(dreAnterior.deducoes_receita)}`
                        : '—'}
                    </td>
                    <td className="py-2 px-4 text-center text-slate-500">
                      {calcAV(dreAtual?.deducoes_receita, calcDAtual.receitaLiquida)}
                    </td>
                    <td className="py-2 px-4 text-center text-slate-500">
                      {calcAH(dreAtual?.deducoes_receita, dreAnterior?.deducoes_receita)}
                    </td>
                  </tr>

                  {/* Receita Líquida (Calculada) */}
                  <tr className="bg-blue-50/70 font-bold text-blue-950">
                    <td className="py-2 px-4">(=) RECEITA OPERACIONAL LÍQUIDA</td>
                    <td className="py-2 px-4 text-right">
                      {formatBrlMil(calcDAtual.receitaLiquida)}
                    </td>
                    <td className="py-2 px-4 text-right">
                      {formatBrlMil(calcDAnterior.receitaLiquida)}
                    </td>
                    <td className="py-2 px-4 text-center">100,0%</td>
                    <td className="py-2 px-4 text-center">
                      {calcAH(calcDAtual.receitaLiquida, calcDAnterior.receitaLiquida)}
                    </td>
                  </tr>

                  {/* Custo */}
                  <tr>
                    <td className="py-2 px-6 text-red-600">
                      (−) Custo dos Produtos / Mercadorias / Serviços (CMV/CPV)
                    </td>
                    <td className="py-2 px-4 text-right text-red-600">
                      {dreAtual?.custo_mercadorias
                        ? `- ${formatBrlMil(dreAtual.custo_mercadorias)}`
                        : '—'}
                    </td>
                    <td className="py-2 px-4 text-right text-slate-600">
                      {dreAnterior?.custo_mercadorias
                        ? `- ${formatBrlMil(dreAnterior.custo_mercadorias)}`
                        : '—'}
                    </td>
                    <td className="py-2 px-4 text-center text-slate-500">
                      {calcAV(dreAtual?.custo_mercadorias, calcDAtual.receitaLiquida)}
                    </td>
                    <td className="py-2 px-4 text-center text-slate-500">
                      {calcAH(dreAtual?.custo_mercadorias, dreAnterior?.custo_mercadorias)}
                    </td>
                  </tr>

                  {/* Lucro Bruto (Calculado) */}
                  <tr className="bg-slate-50 font-semibold text-slate-900">
                    <td className="py-2 px-4">(=) LUCRO BRUTO</td>
                    <td className="py-2 px-4 text-right">{formatBrlMil(calcDAtual.lucroBruto)}</td>
                    <td className="py-2 px-4 text-right">
                      {formatBrlMil(calcDAnterior.lucroBruto)}
                    </td>
                    <td className="py-2 px-4 text-center font-medium">
                      {calcAV(calcDAtual.lucroBruto, calcDAtual.receitaLiquida)}
                    </td>
                    <td className="py-2 px-4 text-center font-medium">
                      {calcAH(calcDAtual.lucroBruto, calcDAnterior.lucroBruto)}
                    </td>
                  </tr>

                  {/* Despesas Operacionais */}
                  <tr>
                    <td className="py-2 px-6 text-red-600">
                      (−) Despesas Operacionais (Vendas, Gerais e Administrativas)
                    </td>
                    <td className="py-2 px-4 text-right text-red-600">
                      {dreAtual?.despesas_operacionais
                        ? `- ${formatBrlMil(dreAtual.despesas_operacionais)}`
                        : '—'}
                    </td>
                    <td className="py-2 px-4 text-right text-slate-600">
                      {dreAnterior?.despesas_operacionais
                        ? `- ${formatBrlMil(dreAnterior.despesas_operacionais)}`
                        : '—'}
                    </td>
                    <td className="py-2 px-4 text-center text-slate-500">
                      {calcAV(dreAtual?.despesas_operacionais, calcDAtual.receitaLiquida)}
                    </td>
                    <td className="py-2 px-4 text-center text-slate-500">
                      {calcAH(dreAtual?.despesas_operacionais, dreAnterior?.despesas_operacionais)}
                    </td>
                  </tr>

                  {/* Resultado Operacional (Calculado) */}
                  <tr className="bg-slate-50 font-semibold text-slate-900">
                    <td className="py-2 px-4">(=) RESULTADO OPERACIONAL (EBIT)</td>
                    <td className="py-2 px-4 text-right">
                      {formatBrlMil(calcDAtual.resultadoOperacional)}
                    </td>
                    <td className="py-2 px-4 text-right">
                      {formatBrlMil(calcDAnterior.resultadoOperacional)}
                    </td>
                    <td className="py-2 px-4 text-center font-medium">
                      {calcAV(calcDAtual.resultadoOperacional, calcDAtual.receitaLiquida)}
                    </td>
                    <td className="py-2 px-4 text-center font-medium">
                      {calcAH(calcDAtual.resultadoOperacional, calcDAnterior.resultadoOperacional)}
                    </td>
                  </tr>

                  {/* Despesas Financeiras */}
                  <tr>
                    <td className="py-2 px-6 text-red-600">(−) Despesas Financeiras Líquidas</td>
                    <td className="py-2 px-4 text-right text-red-600">
                      {dreAtual?.despesas_financeiras
                        ? `- ${formatBrlMil(dreAtual.despesas_financeiras)}`
                        : '—'}
                    </td>
                    <td className="py-2 px-4 text-right text-slate-600">
                      {dreAnterior?.despesas_financeiras
                        ? `- ${formatBrlMil(dreAnterior.despesas_financeiras)}`
                        : '—'}
                    </td>
                    <td className="py-2 px-4 text-center text-slate-500">
                      {calcAV(dreAtual?.despesas_financeiras, calcDAtual.receitaLiquida)}
                    </td>
                    <td className="py-2 px-4 text-center text-slate-500">
                      {calcAH(dreAtual?.despesas_financeiras, dreAnterior?.despesas_financeiras)}
                    </td>
                  </tr>

                  {/* Outras Receitas/Despesas */}
                  <tr>
                    <td className="py-2 px-6 text-slate-600">
                      (±) Outras Receitas / Despesas Diversas
                    </td>
                    <td className="py-2 px-4 text-right">
                      {formatBrlMil(dreAtual?.outras_receitas_despesas)}
                    </td>
                    <td className="py-2 px-4 text-right text-slate-600">
                      {formatBrlMil(dreAnterior?.outras_receitas_despesas)}
                    </td>
                    <td className="py-2 px-4 text-center text-slate-500">
                      {calcAV(dreAtual?.outras_receitas_despesas, calcDAtual.receitaLiquida)}
                    </td>
                    <td className="py-2 px-4 text-center text-slate-500">
                      {calcAH(
                        dreAtual?.outras_receitas_despesas,
                        dreAnterior?.outras_receitas_despesas,
                      )}
                    </td>
                  </tr>

                  {/* Imposto de Renda */}
                  <tr>
                    <td className="py-2 px-6 text-red-600">
                      (−) Provisão para Imposto de Renda e CSLL
                    </td>
                    <td className="py-2 px-4 text-right text-red-600">
                      {dreAtual?.imposto_renda ? `- ${formatBrlMil(dreAtual.imposto_renda)}` : '—'}
                    </td>
                    <td className="py-2 px-4 text-right text-slate-600">
                      {dreAnterior?.imposto_renda
                        ? `- ${formatBrlMil(dreAnterior.imposto_renda)}`
                        : '—'}
                    </td>
                    <td className="py-2 px-4 text-center text-slate-500">
                      {calcAV(dreAtual?.imposto_renda, calcDAtual.receitaLiquida)}
                    </td>
                    <td className="py-2 px-4 text-center text-slate-500">
                      {calcAH(dreAtual?.imposto_renda, dreAnterior?.imposto_renda)}
                    </td>
                  </tr>

                  {/* Lucro Líquido (Calculado) */}
                  <tr className="bg-emerald-50 font-bold text-emerald-950">
                    <td className="py-2.5 px-4">(=) LUCRO LÍQUIDO DO EXERCÍCIO</td>
                    <td className="py-2.5 px-4 text-right text-emerald-700">
                      {formatBrlMil(calcDAtual.lucroLiquido)}
                    </td>
                    <td className="py-2.5 px-4 text-right text-emerald-700">
                      {formatBrlMil(calcDAnterior.lucroLiquido)}
                    </td>
                    <td className="py-2.5 px-4 text-center font-bold">
                      {calcAV(calcDAtual.lucroLiquido, calcDAtual.receitaLiquida)}
                    </td>
                    <td className="py-2.5 px-4 text-center font-bold">
                      {calcAH(calcDAtual.lucroLiquido, calcDAnterior.lucroLiquido)}
                    </td>
                  </tr>

                  {/* EBITDA Informativo */}
                  <tr className="bg-slate-100/60 text-slate-700 font-semibold border-t-2 border-slate-300">
                    <td className="py-2 px-4">EBITDA (LAJIDA aproximado) *</td>
                    <td className="py-2 px-4 text-right font-bold text-blue-800">
                      {formatBrlMil(calcDAtual.ebitda)}
                    </td>
                    <td className="py-2 px-4 text-right text-slate-600">
                      {formatBrlMil(calcDAnterior.ebitda)}
                    </td>
                    <td className="py-2 px-4 text-center">
                      {calcAV(calcDAtual.ebitda, calcDAtual.receitaLiquida)}
                    </td>
                    <td className="py-2 px-4 text-center">
                      {calcAH(calcDAtual.ebitda, calcDAnterior.ebitda)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
          <p className="text-[11px] text-slate-500 italic">
            * Nota: EBITDA calculado como Lucro Líquido + Imposto de Renda + Despesas Financeiras
            (exclui depreciação e amortização não discriminadas separadamente).
          </p>
        </TabsContent>
        {/* =========================================================================
            ABA 4: INDICADORES FINANCEIROS
        ========================================================================= */}
        <TabsContent value="indicadores" className="space-y-6 focus-visible:outline-none">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-[#0B1F3A]">
                Indicadores Econômico-Financeiros
              </h3>
              <p className="text-xs text-slate-500">
                Índices de Liquidez, Endividamento, Rentabilidade e Estrutura de Capital com
                avaliação automática
              </p>
            </div>
          </div>

          {/* 1. GRUPO: LIQUIDEZ */}
          <Card className="bg-white border-slate-200 shadow-2xs overflow-hidden">
            <div
              onClick={() => setExpandedInd((p) => ({ ...p, liquidez: !p.liquidez }))}
              className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between cursor-pointer hover:bg-slate-100/70 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
                  <DollarSign className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[#0B1F3A]">1. Indicadores de Liquidez</h4>
                  <p className="text-xs text-slate-500">
                    Capacidade de honrar compromissos financeiros no curto e longo prazo
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                {expandedInd.liquidez ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </Button>
            </div>

            {expandedInd.liquidez && (
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Liquidez Corrente */}
                <div className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-800">
                        Liquidez Corrente (AC / PC)
                      </span>
                      <p className="text-[11px] text-slate-500">
                        Capacidade de pagamento no curto prazo
                      </p>
                    </div>
                    <span
                      className={`text-sm font-extrabold px-2 py-0.5 rounded ${
                        (indAtual.liquidezCorrente || 0) >= 1.0
                          ? 'bg-emerald-100 text-emerald-800'
                          : (indAtual.liquidezCorrente || 0) >= 0.8
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {formatNumber(indAtual.liquidezCorrente, 2)}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-600 bg-white p-2.5 rounded-lg border border-slate-100">
                    {analiseTexto.liquidez.texto}
                  </div>
                </div>

                {/* Liquidez Seca */}
                <div className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-800">
                        Liquidez Seca ((AC − Estoques) / PC)
                      </span>
                      <p className="text-[11px] text-slate-500">
                        Solvência imediata sem depender de vendas
                      </p>
                    </div>
                    <span className="text-sm font-extrabold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                      {formatNumber(indAtual.liquidezSeca, 2)}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-600 bg-white p-2.5 rounded-lg border border-slate-100">
                    {(indAtual.liquidezSeca || 0) >= 1.0
                      ? 'Excelente capacidade de liquidação sem depender da realização de estoques.'
                      : 'Dependência parcial da venda de estoques para cobrir o passivo circulante.'}
                  </div>
                </div>

                {/* Liquidez Imediata */}
                <div className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-800">
                        Liquidez Imediata ((Caixa + Aplicações) / PC)
                      </span>
                      <p className="text-[11px] text-slate-500">
                        Recursos disponíveis instantaneamente
                      </p>
                    </div>
                    <span className="text-sm font-extrabold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                      {formatNumber(indAtual.liquidezImediata, 2)}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-600 bg-white p-2.5 rounded-lg border border-slate-100">
                    Indica quanto da dívida de curto prazo pode ser quitada imediatamente com
                    disponibilidades.
                  </div>
                </div>

                {/* Liquidez Geral */}
                <div className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-800">
                        Liquidez Geral ((AC + RLP) / (PC + PNC))
                      </span>
                      <p className="text-[11px] text-slate-500">
                        Solvência global (curto e longo prazo)
                      </p>
                    </div>
                    <span className="text-sm font-extrabold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                      {formatNumber(indAtual.liquidezGeral, 2)}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-600 bg-white p-2.5 rounded-lg border border-slate-100">
                    {(indAtual.liquidezGeral || 0) >= 1.0
                      ? 'A empresa possui ativos totais realizáveis superiores ao total de suas obrigações.'
                      : 'Obrigações totais superam a soma dos ativos circulantes e realizáveis a longo prazo.'}
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* 2. GRUPO: ENDIVIDAMENTO */}
          <Card className="bg-white border-slate-200 shadow-2xs overflow-hidden">
            <div
              onClick={() => setExpandedInd((p) => ({ ...p, endividamento: !p.endividamento }))}
              className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between cursor-pointer hover:bg-slate-100/70 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 text-amber-700 rounded-lg">
                  <Scale className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[#0B1F3A]">
                    2. Indicadores de Endividamento
                  </h4>
                  <p className="text-xs text-slate-500">
                    Nível de dependência de capital de terceiros e perfil da dívida
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                {expandedInd.endividamento ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </Button>
            </div>

            {expandedInd.endividamento && (
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Endividamento Geral */}
                <div className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-800">
                        Endividamento Geral ((PC + PNC) / Ativo)
                      </span>
                      <p className="text-[11px] text-slate-500">
                        Percentual do ativo financiado por terceiros
                      </p>
                    </div>
                    <span
                      className={`text-sm font-extrabold px-2 py-0.5 rounded ${
                        (indAtual.endividamentoGeral || 0) < 40
                          ? 'bg-emerald-100 text-emerald-800'
                          : (indAtual.endividamentoGeral || 0) <= 60
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {formatPercent(indAtual.endividamentoGeral, 1)}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-600 bg-white p-2.5 rounded-lg border border-slate-100">
                    {analiseTexto.endividamento.texto}
                  </div>
                </div>

                {/* Composição do Endividamento */}
                <div className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-800">
                        Composição do Endividamento (PC / Passivo Total)
                      </span>
                      <p className="text-[11px] text-slate-500">
                        Proporção de curto prazo na dívida total
                      </p>
                    </div>
                    <span className="text-sm font-extrabold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                      {formatPercent(indAtual.composicaoEndividamento, 1)}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-600 bg-white p-2.5 rounded-lg border border-slate-100">
                    {(indAtual.composicaoEndividamento || 0) > 50
                      ? 'Maior concentração de dívidas vencendo no curto prazo (pressão no fluxo de caixa).'
                      : 'Boa distribuição temporal, com maior fatia da dívida alongada no longo prazo.'}
                  </div>
                </div>

                {/* Dívida Líquida / EBITDA */}
                <div className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-800">
                        Dívida Líquida / EBITDA
                      </span>
                      <p className="text-[11px] text-slate-500">
                        Anos de geração operacional para quitar passivos líquidos
                      </p>
                    </div>
                    <span className="text-sm font-extrabold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                      {formatNumber(indAtual.dividaLiquidaEbitda, 2)}x
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-600 bg-white p-2.5 rounded-lg border border-slate-100">
                    {(indAtual.dividaLiquidaEbitda || 0) <= 2.5
                      ? 'Relação saudável, indicando capacidade confortável de amortização.'
                      : 'Alavancagem elevada frente à capacidade de geração de caixa operacional.'}
                  </div>
                </div>

                {/* Cobertura de Juros */}
                <div className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-800">
                        Cobertura de Juros (EBIT / Despesas Fin.)
                      </span>
                      <p className="text-[11px] text-slate-500">
                        Capacidade de honrar despesas financeiras
                      </p>
                    </div>
                    <span className="text-sm font-extrabold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                      {formatNumber(indAtual.coberturaJuros, 2)}x
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-600 bg-white p-2.5 rounded-lg border border-slate-100">
                    {(indAtual.coberturaJuros || 0) >= 3.0
                      ? 'Ampla cobertura de encargos financeiros com o resultado operacional gerado.'
                      : 'Atenção aos encargos da dívida em relação ao lucro operacional.'}
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* 3. GRUPO: RENTABILIDADE */}
          <Card className="bg-white border-slate-200 shadow-2xs overflow-hidden">
            <div
              onClick={() => setExpandedInd((p) => ({ ...p, rentabilidade: !p.rentabilidade }))}
              className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between cursor-pointer hover:bg-slate-100/70 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[#0B1F3A]">
                    3. Indicadores de Rentabilidade
                  </h4>
                  <p className="text-xs text-slate-500">
                    Margens de ganho operacional e retorno sobre os ativos e capital próprio
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                {expandedInd.rentabilidade ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </Button>
            </div>

            {expandedInd.rentabilidade && (
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Margem Bruta */}
                <div className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-800">
                        Margem Bruta (LB / RL)
                      </span>
                      <p className="text-[11px] text-slate-500">Ganho após custos diretos</p>
                    </div>
                    <span className="text-sm font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                      {formatPercent(indAtual.margemBruta, 1)}
                    </span>
                  </div>
                </div>

                {/* Margem Operacional */}
                <div className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-800">
                        Margem Operacional (EBIT / RL)
                      </span>
                      <p className="text-[11px] text-slate-500">Eficiência da operação principal</p>
                    </div>
                    <span className="text-sm font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                      {formatPercent(indAtual.margemOperacional, 1)}
                    </span>
                  </div>
                </div>

                {/* Margem Líquida */}
                <div className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-800">
                        Margem Líquida (LL / RL)
                      </span>
                      <p className="text-[11px] text-slate-500">Lucro final por real faturado</p>
                    </div>
                    <span
                      className={`text-sm font-extrabold px-2 py-0.5 rounded ${
                        (indAtual.margemLiquida || 0) >= 0
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {formatPercent(indAtual.margemLiquida, 1)}
                    </span>
                  </div>
                </div>

                {/* ROA */}
                <div className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-800">
                        ROA (Retorno sobre Ativo)
                      </span>
                      <p className="text-[11px] text-slate-500">LL / Ativo Total</p>
                    </div>
                    <span className="text-sm font-extrabold text-blue-800 bg-blue-50 px-2 py-0.5 rounded">
                      {formatPercent(indAtual.roa, 1)}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-600 bg-white p-2 rounded-lg border border-slate-100">
                    Eficiência global de todos os ativos investidos na geração de lucro.
                  </div>
                </div>

                {/* ROE */}
                <div className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/50 space-y-2 md:col-span-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-800">
                        ROE (Retorno sobre Patrimônio Líquido)
                      </span>
                      <p className="text-[11px] text-slate-500">LL / Patrimônio Líquido</p>
                    </div>
                    <span
                      className={`text-sm font-extrabold px-2 py-0.5 rounded ${
                        (indAtual.roe || 0) >= 10
                          ? 'bg-emerald-100 text-emerald-800'
                          : (indAtual.roe || 0) >= 0
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {formatPercent(indAtual.roe, 1)}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-600 bg-white p-2 rounded-lg border border-slate-100">
                    {analiseTexto.roe.texto}
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* 4. GRUPO: ESTRUTURA DE CAPITAL */}
          <Card className="bg-white border-slate-200 shadow-2xs overflow-hidden">
            <div
              onClick={() => setExpandedInd((p) => ({ ...p, estrutura: !p.estrutura }))}
              className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between cursor-pointer hover:bg-slate-100/70 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">
                  <BarChart3 className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[#0B1F3A]">
                    4. Estrutura de Capital e Imobilização
                  </h4>
                  <p className="text-xs text-slate-500">
                    Relação entre capital de terceiros, capital próprio e comprometimento do
                    imobilizado
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                {expandedInd.estrutura ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </Button>
            </div>

            {expandedInd.estrutura && (
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Capital de Terceiros / Próprio */}
                <div className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-800">
                        Capital de Terceiros / Próprio ((PC + PNC) / PL)
                      </span>
                      <p className="text-[11px] text-slate-500">
                        Proporção de dívida em relação ao PL
                      </p>
                    </div>
                    <span className="text-sm font-extrabold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                      {formatPercent(indAtual.capitalTerceirosSobreProprio, 1)}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-600 bg-white p-2.5 rounded-lg border border-slate-100">
                    Para cada R$ 100 de capital próprio investido, a empresa utiliza R${' '}
                    {formatNumber(indAtual.capitalTerceirosSobreProprio, 1)} de recursos de
                    terceiros.
                  </div>
                </div>

                {/* Imobilização do PL */}
                <div className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-800">
                        Imobilização do PL (Imobilizado / PL)
                      </span>
                      <p className="text-[11px] text-slate-500">
                        Quanto do patrimônio líquido está retido em bens fixos
                      </p>
                    </div>
                    <span className="text-sm font-extrabold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                      {formatPercent(indAtual.imobilizacaoPL, 1)}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-600 bg-white p-2.5 rounded-lg border border-slate-100">
                    {(indAtual.imobilizacaoPL || 0) <= 100
                      ? 'O patrimônio próprio cobre todo o ativo permanente e ainda sobra para o capital de giro.'
                      : 'O imobilizado ultrapassa o PL, exigindo recursos de terceiros para financiar ativos fixos.'}
                  </div>
                </div>

                {/* Imobilização de Recursos Não Correntes */}
                <div className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-800">
                        Imob. Recursos Não Correntes (Imob / (PL + PNC))
                      </span>
                      <p className="text-[11px] text-slate-500">
                        Bens fixos financiados por fontes estáveis de longo prazo
                      </p>
                    </div>
                    <span className="text-sm font-extrabold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                      {formatPercent(indAtual.imobilizacaoRecursosNaoCorrentes, 1)}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-600 bg-white p-2.5 rounded-lg border border-slate-100">
                    {(indAtual.imobilizacaoRecursosNaoCorrentes || 0) <= 100
                      ? 'Estrutura segura: os recursos de longo prazo e PL cobrem integralmente o ativo fixo.'
                      : 'Risco de liquidez: ativos permanentes estão sendo financiados com dívida de curto prazo.'}
                  </div>
                </div>

                {/* Alavancagem Financeira */}
                <div className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-800">
                        Alavancagem Financeira ((PC + PNC) / PL)
                      </span>
                      <p className="text-[11px] text-slate-500">
                        Grau de multiplicação dos recursos próprios
                      </p>
                    </div>
                    <span className="text-sm font-extrabold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                      {formatNumber(indAtual.alavancagemFinanceira, 2)}x
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-600 bg-white p-2.5 rounded-lg border border-slate-100">
                    Múltiplo de exposição a capital de terceiros em relação aos recursos dos sócios.
                  </div>
                </div>
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {/* =========================================================================
          MODAL: EDITAR BALANÇO PATRIMONIAL
      ========================================================================= */}
      <Dialog open={modalBalancoOpen} onOpenChange={setModalBalancoOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto bg-white">
          <form onSubmit={saveBalancoModal}>
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-[#0B1F3A]">
                Editar Balanço Patrimonial — {empresa.nome}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Selecione o mês de competência e preencha os valores contábeis em R$ mil.
              </DialogDescription>
            </DialogHeader>

            <div className="py-3 px-3 bg-blue-50/80 border border-blue-200 rounded-xl flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-600" />
                <span className="font-bold text-slate-800 text-xs">Ano de Competência:</span>
                <span className="font-extrabold text-blue-800 text-sm">{selectedAno}</span>
              </div>
              <div className="flex items-center gap-2">
                <Label className="font-bold text-slate-800 text-xs">Mês:</Label>
                <Select
                  value={String(modalBalancoMes)}
                  onValueChange={(val) => handleMudarMesModalBalanco(Number(val))}
                >
                  <SelectTrigger className="h-8 w-36 bg-white text-xs font-semibold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {NOMES_MESES.map((nomeMes, idx) => (
                      <SelectItem key={idx + 1} value={String(idx + 1)} className="text-xs">
                        {idx + 1} - {nomeMes}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="py-4 space-y-6 text-xs">
              {/* 1. Ativo Circulante */}
              <div className="space-y-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between font-bold text-slate-800">
                  <span>1.1 Ativo Circulante (Curto Prazo)</span>
                  <span className="text-blue-700">
                    Subtotal: {formatBrlMil(calcularBalanco(formBalanco).ativoCirculante)}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-[11px]">Caixa e Equivalentes (R$ mil)</Label>
                    <Input
                      type="number"
                      step="any"
                      value={formBalanco.caixa_equivalentes ?? ''}
                      onChange={(e) =>
                        setFormBalanco((p) => ({
                          ...p,
                          caixa_equivalentes: Number(e.target.value),
                        }))
                      }
                      className="h-8 text-xs bg-white"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px]">Aplicações Financeiras (R$ mil)</Label>
                    <Input
                      type="number"
                      step="any"
                      value={formBalanco.aplicacoes_financeiras ?? ''}
                      onChange={(e) =>
                        setFormBalanco((p) => ({
                          ...p,
                          aplicacoes_financeiras: Number(e.target.value),
                        }))
                      }
                      className="h-8 text-xs bg-white"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px]">Contas a Receber (R$ mil)</Label>
                    <Input
                      type="number"
                      step="any"
                      value={formBalanco.contas_receber ?? ''}
                      onChange={(e) =>
                        setFormBalanco((p) => ({ ...p, contas_receber: Number(e.target.value) }))
                      }
                      className="h-8 text-xs bg-white"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px]">Estoques (R$ mil)</Label>
                    <Input
                      type="number"
                      step="any"
                      value={formBalanco.estoques ?? ''}
                      onChange={(e) =>
                        setFormBalanco((p) => ({ ...p, estoques: Number(e.target.value) }))
                      }
                      className="h-8 text-xs bg-white"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px]">Impostos a Recuperar (R$ mil)</Label>
                    <Input
                      type="number"
                      step="any"
                      value={formBalanco.impostos_recuperar ?? ''}
                      onChange={(e) =>
                        setFormBalanco((p) => ({
                          ...p,
                          impostos_recuperar: Number(e.target.value),
                        }))
                      }
                      className="h-8 text-xs bg-white"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px]">Outros Ativos Circulantes (R$ mil)</Label>
                    <Input
                      type="number"
                      step="any"
                      value={formBalanco.outros_ativo_circulante ?? ''}
                      onChange={(e) =>
                        setFormBalanco((p) => ({
                          ...p,
                          outros_ativo_circulante: Number(e.target.value),
                        }))
                      }
                      className="h-8 text-xs bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* 2. Ativo Não Circulante */}
              <div className="space-y-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between font-bold text-slate-800">
                  <span>1.2 Ativo Não Circulante (Longo Prazo / Permanente)</span>
                  <span className="text-blue-700">
                    Subtotal: {formatBrlMil(calcularBalanco(formBalanco).ativoNaoCirculante)}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <Label className="text-[11px]">Realizável a Longo Prazo</Label>
                    <Input
                      type="number"
                      step="any"
                      value={formBalanco.realizavel_longo_prazo ?? ''}
                      onChange={(e) =>
                        setFormBalanco((p) => ({
                          ...p,
                          realizavel_longo_prazo: Number(e.target.value),
                        }))
                      }
                      className="h-8 text-xs bg-white"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px]">Investimentos</Label>
                    <Input
                      type="number"
                      step="any"
                      value={formBalanco.investimentos ?? ''}
                      onChange={(e) =>
                        setFormBalanco((p) => ({ ...p, investimentos: Number(e.target.value) }))
                      }
                      className="h-8 text-xs bg-white"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px]">Imobilizado</Label>
                    <Input
                      type="number"
                      step="any"
                      value={formBalanco.imobilizado ?? ''}
                      onChange={(e) =>
                        setFormBalanco((p) => ({ ...p, imobilizado: Number(e.target.value) }))
                      }
                      className="h-8 text-xs bg-white"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px]">Intangível</Label>
                    <Input
                      type="number"
                      step="any"
                      value={formBalanco.intangivel ?? ''}
                      onChange={(e) =>
                        setFormBalanco((p) => ({ ...p, intangivel: Number(e.target.value) }))
                      }
                      className="h-8 text-xs bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* 3. Passivo Circulante */}
              <div className="space-y-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between font-bold text-slate-800">
                  <span>2.1 Passivo Circulante (Curto Prazo)</span>
                  <span className="text-amber-700">
                    Subtotal: {formatBrlMil(calcularBalanco(formBalanco).passivoCirculante)}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-[11px]">Fornecedores</Label>
                    <Input
                      type="number"
                      step="any"
                      value={formBalanco.fornecedores ?? ''}
                      onChange={(e) =>
                        setFormBalanco((p) => ({ ...p, fornecedores: Number(e.target.value) }))
                      }
                      className="h-8 text-xs bg-white"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px]">Empréstimos Curto Prazo</Label>
                    <Input
                      type="number"
                      step="any"
                      value={formBalanco.emprestimos_curto_prazo ?? ''}
                      onChange={(e) =>
                        setFormBalanco((p) => ({
                          ...p,
                          emprestimos_curto_prazo: Number(e.target.value),
                        }))
                      }
                      className="h-8 text-xs bg-white"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px]">Obrigações Trabalhistas</Label>
                    <Input
                      type="number"
                      step="any"
                      value={formBalanco.obrigacoes_trabalhistas ?? ''}
                      onChange={(e) =>
                        setFormBalanco((p) => ({
                          ...p,
                          obrigacoes_trabalhistas: Number(e.target.value),
                        }))
                      }
                      className="h-8 text-xs bg-white"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px]">Obrigações Tributárias</Label>
                    <Input
                      type="number"
                      step="any"
                      value={formBalanco.obrigacoes_tributarias ?? ''}
                      onChange={(e) =>
                        setFormBalanco((p) => ({
                          ...p,
                          obrigacoes_tributarias: Number(e.target.value),
                        }))
                      }
                      className="h-8 text-xs bg-white"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px]">Outros Passivos Circulantes</Label>
                    <Input
                      type="number"
                      step="any"
                      value={formBalanco.outros_passivo_circulante ?? ''}
                      onChange={(e) =>
                        setFormBalanco((p) => ({
                          ...p,
                          outros_passivo_circulante: Number(e.target.value),
                        }))
                      }
                      className="h-8 text-xs bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* 4. Passivo Não Circulante & PL */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between font-bold text-slate-800">
                    <span>2.2 Passivo Não Circulante</span>
                    <span className="text-amber-700">
                      Subtotal: {formatBrlMil(calcularBalanco(formBalanco).passivoNaoCirculante)}
                    </span>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <Label className="text-[11px]">Empréstimos Longo Prazo</Label>
                      <Input
                        type="number"
                        step="any"
                        value={formBalanco.emprestimos_longo_prazo ?? ''}
                        onChange={(e) =>
                          setFormBalanco((p) => ({
                            ...p,
                            emprestimos_longo_prazo: Number(e.target.value),
                          }))
                        }
                        className="h-8 text-xs bg-white"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px]">Outras Obrigações LP</Label>
                      <Input
                        type="number"
                        step="any"
                        value={formBalanco.outras_obrigacoes_longo_prazo ?? ''}
                        onChange={(e) =>
                          setFormBalanco((p) => ({
                            ...p,
                            outras_obrigacoes_longo_prazo: Number(e.target.value),
                          }))
                        }
                        className="h-8 text-xs bg-white"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-3 bg-emerald-50/50 p-3.5 rounded-xl border border-emerald-200/80">
                  <div className="flex items-center justify-between font-bold text-emerald-950">
                    <span>2.3 Patrimônio Líquido</span>
                    <span className="text-emerald-700">
                      Total PL: {formatBrlMil(calcularBalanco(formBalanco).patrimonioLiquido)}
                    </span>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <Label className="text-[11px]">Capital Social</Label>
                      <Input
                        type="number"
                        step="any"
                        value={formBalanco.capital_social ?? ''}
                        onChange={(e) =>
                          setFormBalanco((p) => ({ ...p, capital_social: Number(e.target.value) }))
                        }
                        className="h-8 text-xs bg-white"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px]">Reservas de Lucros</Label>
                      <Input
                        type="number"
                        step="any"
                        value={formBalanco.reservas_lucros ?? ''}
                        onChange={(e) =>
                          setFormBalanco((p) => ({ ...p, reservas_lucros: Number(e.target.value) }))
                        }
                        className="h-8 text-xs bg-white"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px]">Lucros/Prejuízos Acumulados</Label>
                      <Input
                        type="number"
                        step="any"
                        value={formBalanco.lucros_acumulados ?? ''}
                        onChange={(e) =>
                          setFormBalanco((p) => ({
                            ...p,
                            lucros_acumulados: Number(e.target.value),
                          }))
                        }
                        className="h-8 text-xs bg-white"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Vínculos de contas por campo do balanço */}
              <div className="space-y-3 bg-indigo-50/40 p-3.5 rounded-xl border border-indigo-200/70">
                <div className="flex items-center gap-2 font-bold text-slate-800">
                  <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                  Vínculo de Contas (opcional)
                  <span className="font-normal text-[11px] text-slate-500">
                    — associe cada campo a uma conta cadastrada
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {[
                    ['caixa_equivalentes', 'Caixa e Equivalentes'],
                    ['aplicacoes_financeiras', 'Aplicações Financeiras'],
                    ['contas_receber', 'Contas a Receber'],
                    ['estoques', 'Estoques'],
                    ['impostos_recuperar', 'Impostos a Recuperar'],
                    ['outros_ativo_circulante', 'Outros Ativos Circulantes'],
                    ['realizavel_longo_prazo', 'Realizável a Longo Prazo'],
                    ['investimentos', 'Investimentos'],
                    ['imobilizado', 'Imobilizado'],
                    ['intangivel', 'Intangível'],
                    ['fornecedores', 'Fornecedores'],
                    ['emprestimos_curto_prazo', 'Empréstimos Curto Prazo'],
                    ['obrigacoes_trabalhistas', 'Obrigações Trabalhistas'],
                    ['obrigacoes_tributarias', 'Obrigações Tributárias'],
                    ['outros_passivo_circulante', 'Outros Passivos Circulantes'],
                    ['emprestimos_longo_prazo', 'Empréstimos Longo Prazo'],
                    ['outras_obrigacoes_longo_prazo', 'Outras Obrigações LP'],
                    ['capital_social', 'Capital Social'],
                    ['reservas_lucros', 'Reservas de Lucros'],
                    ['lucros_acumulados', 'Lucros Acumulados'],
                  ].map(([campo, label]) => (
                    <div key={campo} className="space-y-1">
                      <Label className="text-[11px] text-slate-600">{label}</Label>
                      {renderSelectVinculo(campo)}
                    </div>
                  ))}
                </div>
                {contas.length === 0 && (
                  <p className="text-[11px] text-slate-500">
                    Nenhuma conta cadastrada. Crie contas em "Contas" para habilitar os vínculos.
                  </p>
                )}
              </div>

              {/* Totais comparativos ao vivo */}
              <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-xl flex items-center justify-between text-xs font-semibold">
                <span>
                  Ativo Total Calculado:{' '}
                  <strong className="text-blue-800">
                    {formatBrlMil(calcularBalanco(formBalanco).ativoTotal)}
                  </strong>
                </span>
                <span>
                  Passivo + PL Calculado:{' '}
                  <strong className="text-emerald-800">
                    {formatBrlMil(calcularBalanco(formBalanco).passivoEPL)}
                  </strong>
                </span>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalBalancoOpen(false)}
                disabled={savingModal}
                className="text-xs h-8"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={savingModal}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-8"
              >
                {savingModal ? 'Salvando...' : 'Salvar Balanço'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* =========================================================================
          MODAL: EDITAR DRE
      ========================================================================= */}
      <Dialog open={modalDreOpen} onOpenChange={setModalDreOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto bg-white">
          <form onSubmit={saveDreModal}>
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-[#0B1F3A]">
                Editar DRE — {empresa.nome}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Selecione o mês de competência e preencha as linhas da DRE em R$ mil.
              </DialogDescription>
            </DialogHeader>

            <div className="py-3 px-3 bg-blue-50/80 border border-blue-200 rounded-xl flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-600" />
                <span className="font-bold text-slate-800 text-xs">Ano de Competência:</span>
                <span className="font-extrabold text-blue-800 text-sm">{selectedAno}</span>
              </div>
              <div className="flex items-center gap-2">
                <Label className="font-bold text-slate-800 text-xs">Mês:</Label>
                <Select
                  value={String(modalDreMes)}
                  onValueChange={(val) => handleMudarMesModalDre(Number(val))}
                >
                  <SelectTrigger className="h-8 w-36 bg-white text-xs font-semibold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {NOMES_MESES.map((nomeMes, idx) => (
                      <SelectItem key={idx + 1} value={String(idx + 1)} className="text-xs">
                        {idx + 1} - {nomeMes}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="py-4 space-y-3 text-xs">
              <div>
                <Label className="text-[11px]">Receita Operacional Bruta (R$ mil)</Label>
                <Input
                  type="number"
                  step="any"
                  value={formDre.receita_bruta ?? ''}
                  onChange={(e) =>
                    setFormDre((p) => ({ ...p, receita_bruta: Number(e.target.value) }))
                  }
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <Label className="text-[11px]">
                  Deduções da Receita / Impostos sobre Vendas (R$ mil)
                </Label>
                <Input
                  type="number"
                  step="any"
                  value={formDre.deducoes_receita ?? ''}
                  onChange={(e) =>
                    setFormDre((p) => ({ ...p, deducoes_receita: Number(e.target.value) }))
                  }
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <Label className="text-[11px]">
                  Custo dos Produtos/Serviços Vendidos - CMV (R$ mil)
                </Label>
                <Input
                  type="number"
                  step="any"
                  value={formDre.custo_mercadorias ?? ''}
                  onChange={(e) =>
                    setFormDre((p) => ({ ...p, custo_mercadorias: Number(e.target.value) }))
                  }
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <Label className="text-[11px]">
                  Despesas Operacionais (Vendas, Administrativas) (R$ mil)
                </Label>
                <Input
                  type="number"
                  step="any"
                  value={formDre.despesas_operacionais ?? ''}
                  onChange={(e) =>
                    setFormDre((p) => ({ ...p, despesas_operacionais: Number(e.target.value) }))
                  }
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <Label className="text-[11px]">Despesas Financeiras Líquidas (R$ mil)</Label>
                <Input
                  type="number"
                  step="any"
                  value={formDre.despesas_financeiras ?? ''}
                  onChange={(e) =>
                    setFormDre((p) => ({ ...p, despesas_financeiras: Number(e.target.value) }))
                  }
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <Label className="text-[11px]">Outras Receitas / Despesas (R$ mil)</Label>
                <Input
                  type="number"
                  step="any"
                  value={formDre.outras_receitas_despesas ?? ''}
                  onChange={(e) =>
                    setFormDre((p) => ({ ...p, outras_receitas_despesas: Number(e.target.value) }))
                  }
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <Label className="text-[11px]">Imposto de Renda e CSLL (R$ mil)</Label>
                <Input
                  type="number"
                  step="any"
                  value={formDre.imposto_renda ?? ''}
                  onChange={(e) =>
                    setFormDre((p) => ({ ...p, imposto_renda: Number(e.target.value) }))
                  }
                  className="h-8 text-xs"
                />
              </div>

              {/* Resumo ao vivo */}
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1 font-semibold text-xs">
                <div className="flex justify-between">
                  <span>Receita Líquida Calculada:</span>
                  <strong>{formatBrlMil(calcularDre(formDre).receitaLiquida)}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Lucro Líquido Calculado:</span>
                  <strong className="text-emerald-700">
                    {formatBrlMil(calcularDre(formDre).lucroLiquido)}
                  </strong>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalDreOpen(false)}
                disabled={savingModal}
                className="text-xs h-8"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={savingModal}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-8"
              >
                {savingModal ? 'Salvando...' : 'Salvar DRE'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* =========================================================================
          MODAL: NOVO LANÇAMENTO (MENSAL / ANUAL)
      ========================================================================= */}
      <Dialog open={modalNovoLancamentoOpen} onOpenChange={setModalNovoLancamentoOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto bg-white">
          <form onSubmit={saveNovoLancamentoModal}>
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-[#0B1F3A]">
                Novo Lançamento Mensal — {empresa.nome}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Cadastre Balanço Patrimonial e DRE para o mês e ano especificados.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-4 text-xs">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <Label className="font-bold text-slate-800 text-xs shrink-0">
                    Ano do Exercício:
                  </Label>
                  <Input
                    type="number"
                    min={2000}
                    max={2100}
                    value={novoAno}
                    onChange={(e) => setNovoAno(Number(e.target.value))}
                    className="h-8 text-xs bg-white w-24 font-bold"
                    required
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Label className="font-bold text-slate-800 text-xs shrink-0">
                    Mês de Competência:
                  </Label>
                  <Select value={String(novoMes)} onValueChange={(val) => setNovoMes(Number(val))}>
                    <SelectTrigger className="h-8 w-36 bg-white text-xs font-semibold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {NOMES_MESES.map((nomeMes, idx) => (
                        <SelectItem key={idx + 1} value={String(idx + 1)} className="text-xs">
                          {idx + 1} - {nomeMes}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Grupo Ativo */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                <span className="font-bold text-slate-800">
                  Ativo Circulante & Não Circulante (R$ mil)
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <Label className="text-[10px]">Caixa e Equiv.</Label>
                    <Input
                      type="number"
                      step="any"
                      value={formBalanco.caixa_equivalentes ?? ''}
                      onChange={(e) =>
                        setFormBalanco((p) => ({
                          ...p,
                          caixa_equivalentes: Number(e.target.value),
                        }))
                      }
                      className="h-7 text-xs bg-white"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px]">Aplicações Fin.</Label>
                    <Input
                      type="number"
                      step="any"
                      value={formBalanco.aplicacoes_financeiras ?? ''}
                      onChange={(e) =>
                        setFormBalanco((p) => ({
                          ...p,
                          aplicacoes_financeiras: Number(e.target.value),
                        }))
                      }
                      className="h-7 text-xs bg-white"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px]">Contas a Receber</Label>
                    <Input
                      type="number"
                      step="any"
                      value={formBalanco.contas_receber ?? ''}
                      onChange={(e) =>
                        setFormBalanco((p) => ({ ...p, contas_receber: Number(e.target.value) }))
                      }
                      className="h-7 text-xs bg-white"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px]">Estoques</Label>
                    <Input
                      type="number"
                      step="any"
                      value={formBalanco.estoques ?? ''}
                      onChange={(e) =>
                        setFormBalanco((p) => ({ ...p, estoques: Number(e.target.value) }))
                      }
                      className="h-7 text-xs bg-white"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px]">Imobilizado</Label>
                    <Input
                      type="number"
                      step="any"
                      value={formBalanco.imobilizado ?? ''}
                      onChange={(e) =>
                        setFormBalanco((p) => ({ ...p, imobilizado: Number(e.target.value) }))
                      }
                      className="h-7 text-xs bg-white"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px]">Realizável LP</Label>
                    <Input
                      type="number"
                      step="any"
                      value={formBalanco.realizavel_longo_prazo ?? ''}
                      onChange={(e) =>
                        setFormBalanco((p) => ({
                          ...p,
                          realizavel_longo_prazo: Number(e.target.value),
                        }))
                      }
                      className="h-7 text-xs bg-white"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px]">Investimentos</Label>
                    <Input
                      type="number"
                      step="any"
                      value={formBalanco.investimentos ?? ''}
                      onChange={(e) =>
                        setFormBalanco((p) => ({ ...p, investimentos: Number(e.target.value) }))
                      }
                      className="h-7 text-xs bg-white"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px]">Intangível</Label>
                    <Input
                      type="number"
                      step="any"
                      value={formBalanco.intangivel ?? ''}
                      onChange={(e) =>
                        setFormBalanco((p) => ({ ...p, intangivel: Number(e.target.value) }))
                      }
                      className="h-7 text-xs bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Grupo Passivo & PL */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                <span className="font-bold text-slate-800">
                  Passivo & Patrimônio Líquido (R$ mil)
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <Label className="text-[10px]">Fornecedores</Label>
                    <Input
                      type="number"
                      step="any"
                      value={formBalanco.fornecedores ?? ''}
                      onChange={(e) =>
                        setFormBalanco((p) => ({ ...p, fornecedores: Number(e.target.value) }))
                      }
                      className="h-7 text-xs bg-white"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px]">Empréstimos CP</Label>
                    <Input
                      type="number"
                      step="any"
                      value={formBalanco.emprestimos_curto_prazo ?? ''}
                      onChange={(e) =>
                        setFormBalanco((p) => ({
                          ...p,
                          emprestimos_curto_prazo: Number(e.target.value),
                        }))
                      }
                      className="h-7 text-xs bg-white"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px]">Empréstimos LP</Label>
                    <Input
                      type="number"
                      step="any"
                      value={formBalanco.emprestimos_longo_prazo ?? ''}
                      onChange={(e) =>
                        setFormBalanco((p) => ({
                          ...p,
                          emprestimos_longo_prazo: Number(e.target.value),
                        }))
                      }
                      className="h-7 text-xs bg-white"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px]">Obrigações Trab./Trib.</Label>
                    <Input
                      type="number"
                      step="any"
                      value={formBalanco.obrigacoes_trabalhistas ?? ''}
                      onChange={(e) =>
                        setFormBalanco((p) => ({
                          ...p,
                          obrigacoes_trabalhistas: Number(e.target.value),
                        }))
                      }
                      className="h-7 text-xs bg-white"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px]">Capital Social</Label>
                    <Input
                      type="number"
                      step="any"
                      value={formBalanco.capital_social ?? ''}
                      onChange={(e) =>
                        setFormBalanco((p) => ({ ...p, capital_social: Number(e.target.value) }))
                      }
                      className="h-7 text-xs bg-white"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px]">Reservas de Lucros</Label>
                    <Input
                      type="number"
                      step="any"
                      value={formBalanco.reservas_lucros ?? ''}
                      onChange={(e) =>
                        setFormBalanco((p) => ({ ...p, reservas_lucros: Number(e.target.value) }))
                      }
                      className="h-7 text-xs bg-white"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px]">Lucros Acumulados</Label>
                    <Input
                      type="number"
                      step="any"
                      value={formBalanco.lucros_acumulados ?? ''}
                      onChange={(e) =>
                        setFormBalanco((p) => ({ ...p, lucros_acumulados: Number(e.target.value) }))
                      }
                      className="h-7 text-xs bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Grupo DRE */}
              <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-200/70 space-y-2">
                <span className="font-bold text-blue-900">
                  Demonstrativo de Resultado - DRE (R$ mil)
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <Label className="text-[10px]">Receita Bruta</Label>
                    <Input
                      type="number"
                      step="any"
                      value={formDre.receita_bruta ?? ''}
                      onChange={(e) =>
                        setFormDre((p) => ({ ...p, receita_bruta: Number(e.target.value) }))
                      }
                      className="h-7 text-xs bg-white"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px]">Deduções Receita</Label>
                    <Input
                      type="number"
                      step="any"
                      value={formDre.deducoes_receita ?? ''}
                      onChange={(e) =>
                        setFormDre((p) => ({ ...p, deducoes_receita: Number(e.target.value) }))
                      }
                      className="h-7 text-xs bg-white"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px]">Custo Mercadorias</Label>
                    <Input
                      type="number"
                      step="any"
                      value={formDre.custo_mercadorias ?? ''}
                      onChange={(e) =>
                        setFormDre((p) => ({ ...p, custo_mercadorias: Number(e.target.value) }))
                      }
                      className="h-7 text-xs bg-white"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px]">Despesas Operac.</Label>
                    <Input
                      type="number"
                      step="any"
                      value={formDre.despesas_operacionais ?? ''}
                      onChange={(e) =>
                        setFormDre((p) => ({ ...p, despesas_operacionais: Number(e.target.value) }))
                      }
                      className="h-7 text-xs bg-white"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px]">Despesas Financeiras</Label>
                    <Input
                      type="number"
                      step="any"
                      value={formDre.despesas_financeiras ?? ''}
                      onChange={(e) =>
                        setFormDre((p) => ({ ...p, despesas_financeiras: Number(e.target.value) }))
                      }
                      className="h-7 text-xs bg-white"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px]">Imposto de Renda</Label>
                    <Input
                      type="number"
                      step="any"
                      value={formDre.imposto_renda ?? ''}
                      onChange={(e) =>
                        setFormDre((p) => ({ ...p, imposto_renda: Number(e.target.value) }))
                      }
                      className="h-7 text-xs bg-white"
                    />
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalNovoLancamentoOpen(false)}
                disabled={savingModal}
                className="text-xs h-8"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={savingModal}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-8"
              >
                {savingModal ? 'Cadastrando...' : 'Gravar Exercício Completo'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* =========================================================================
          MODAL DE IMPORTAÇÃO DE BALANCETE MENSAL DIRETO
      ========================================================================= */}
      <Dialog open={modalImportarBalanceteOpen} onOpenChange={setModalImportarBalanceteOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white p-6">
          <DialogHeader className="pb-2">
            <DialogTitle className="text-lg font-bold text-[#0B1F3A]">
              Importar Balancete Mensal — {empresa.nome}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Faça upload do balancete em Excel ou PDF para gerar os lançamentos de Balanço e DRE
            </DialogDescription>
          </DialogHeader>

          <ImportarBalanceteMensal
            empresas={empresa ? [empresa] : []}
            initialEmpresaId={empresa.id}
            initialAno={selectedAno}
            initialMes={selectedMes !== 'todos' ? Number(selectedMes) : new Date().getMonth() + 1}
            onImportSuccess={() => {
              setModalImportarBalanceteOpen(false)
              loadData()
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
