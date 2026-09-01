import React, { useState, useEffect, useMemo } from 'react'
import {
  materiasPrimasService,
  fichasTecnicasService,
  configuracoesTributariasService,
} from '@/services/formacaoPrecoService'
import { useFilter } from '@/contexts/FilterContext'
import { useMinhaEmpresa } from '@/contexts/MinhaEmpresaContext'
import type {
  MateriaPrimaRecord,
  FichaTecnicaRecord,
  ConfiguracaoTributariaRecord,
} from '@/types/finance'
import { ModalPdfMateriaPrima } from '@/components/ModalPdfMateriaPrima'
import { useRealtime } from '@/hooks/use-realtime'
import { useToast } from '@/hooks/use-toast'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Layers,
  Plus,
  Pencil,
  Trash2,
  Search,
  Download,
  AlertCircle,
  Coins,
  Boxes,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  BarChart3,
  TrendingUp,
  Percent,
  Scale,
  Calculator,
  Receipt,
  ArrowDownRight,
  DollarSign,
  Calendar,
  Printer,
  FileText,
  Building2,
  ArrowRightLeft,
  CheckSquare,
} from 'lucide-react'
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  Cell,
} from 'recharts'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { calcularTributosMateriaPrima } from '@/lib/taxCalculations'

export function formatBrl(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return '—'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val)
}

export function formatPct(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return '0,00%'
  return (
    val.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + '%'
  )
}

function formatQty(val: number | null | undefined, unidade: string = ''): string {
  if (val === null || val === undefined || isNaN(val)) return '—'
  const fmt = val.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 3 })
  return unidade ? `${fmt} ${unidade}` : fmt
}

interface MateriaPrimaFormData {
  empresa: string
  codigo: string
  nome: string
  unidade: string
  categoria: string
  custo_unitario: string
  icms_percentual: string
  pis_percentual: string
  cofins_percentual: string
  ipi_percentual: string
  frete_percentual: string
  perdas_percentual: string
  isenta_st: boolean
  tipo_tributacao: 'tributada' | 'isenta' | 'substituicao_tributaria'
  estoque_atual: string
  estoque_minimo: string
  observacoes: string
}

const EMPTY_MP: MateriaPrimaFormData = {
  empresa: '',
  codigo: '',
  nome: '',
  unidade: 'UN',
  categoria: '',
  custo_unitario: '',
  icms_percentual: '',
  pis_percentual: '',
  cofins_percentual: '',
  ipi_percentual: '',
  frete_percentual: '',
  perdas_percentual: '',
  isenta_st: false,
  tipo_tributacao: 'tributada',
  estoque_atual: '',
  estoque_minimo: '',
  observacoes: '',
}

export type StatusEstoqueMP = 'critico' | 'atencao' | 'ok' | 'indefinido'

export function getStatusEstoque(m: MateriaPrimaRecord): {
  status: StatusEstoqueMP
  label: string
  badgeVariant: 'destructive' | 'default' | 'outline' | 'secondary'
  badgeClass: string
} {
  const atual = Number(m.estoque_atual)
  const min = Number(m.estoque_minimo)

  if (isNaN(min) || min <= 0 || m.estoque_minimo === undefined || m.estoque_minimo === null) {
    return {
      status: 'indefinido',
      label: 'Não def.',
      badgeVariant: 'outline',
      badgeClass: 'text-slate-500 border-slate-200 bg-slate-50',
    }
  }

  const estoqueAtualNum = isNaN(atual) ? 0 : atual

  if (estoqueAtualNum < min) {
    return {
      status: 'critico',
      label: 'Crítico',
      badgeVariant: 'destructive',
      badgeClass: 'bg-rose-100 text-rose-700 hover:bg-rose-100 border-rose-300 font-bold',
    }
  }

  // Atenção quando o estoque está até 20% acima do mínimo (entre min e 1.2 * min)
  if (estoqueAtualNum <= min * 1.2) {
    return {
      status: 'atencao',
      label: 'Atenção',
      badgeVariant: 'outline',
      badgeClass: 'bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-300 font-bold',
    }
  }

  return {
    status: 'ok',
    label: 'OK',
    badgeVariant: 'outline',
    badgeClass:
      'bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-300 font-semibold',
  }
}

type MPFormErrors = Partial<Record<keyof MateriaPrimaFormData | 'general', string>>

export interface ItemCurvaABC {
  id: string
  codigo: string
  nome: string
  unidade: string
  categoria: string
  custo_unitario: number
  custo_liquido: number
  icms_percentual: number
  pis_percentual: number
  cofins_percentual: number
  ipi_percentual: number
  frete_percentual: number
  perdas_percentual: number
  total_impostos_valor: number
  total_acrescimos_valor: number
  valor_ipi: number
  valor_frete: number
  valor_perdas: number
  custo_com_impostos: number
  quantidade: number
  valor_total: number
  valor_total_liquido: number
  percentual_individual: number
  percentual_acumulado: number
  classe: 'A' | 'B' | 'C'
  fichas_count: number
  observacoes?: string
}

export default function CadastroMateriaPrima() {
  const { toast } = useToast()
  const { selectedEmpresaId, setSelectedEmpresaId, selectedEmpresa, empresas } = useFilter()
  const { minhaEmpresa, logoUrl } = useMinhaEmpresa()

  const [materias, setMaterias] = useState<MateriaPrimaRecord[]>([])
  const [fichas, setFichas] = useState<FichaTecnicaRecord[]>([])
  const [configTributaria, setConfigTributaria] = useState<ConfiguracaoTributariaRecord | null>(
    null,
  )
  const [loading, setLoading] = useState(true)

  // Modal PDF de Custos por Matéria-Prima (A4)
  const [pdfModalOpen, setPdfModalOpen] = useState(false)

  // Aba ativa: 'catalogo' | 'curva-abc'
  const [activeTab, setActiveTab] = useState<'catalogo' | 'curva-abc'>('catalogo')

  // Filtros catálogo
  const [search, setSearch] = useState('')
  const [categoriaFilter, setCategoriaFilter] = useState('todas')
  const [statusFilter, setStatusFilter] = useState<'todos' | 'critico' | 'atencao' | 'ok'>('todos')
  const [tributacaoFilter, setTributacaoFilter] = useState<'todos' | 'tributada' | 'isenta_st'>(
    'todos',
  )
  const [periodoCreditos, setPeriodoCreditos] = useState<string>('todos') // 'todos' | 'mes_atual' | 'ano_atual' | 'custom'
  const [dataInicioCreditos, setDataInicioCreditos] = useState<string>('')
  const [dataFimCreditos, setDataFimCreditos] = useState<string>('')

  // Configurações e filtros da Curva ABC
  // baseCalculo: 'consumo_fichas' (Qtd consumida nas fichas técnicas) | 'estoque' (Estoque Atual valorizado)
  const [baseCalculoABC, setBaseCalculoABC] = useState<'consumo_fichas' | 'estoque'>(
    'consumo_fichas',
  )
  const [filtroClasseABC, setFiltroClasseABC] = useState<'todos' | 'A' | 'B' | 'C'>('todos')
  const [searchABC, setSearchABC] = useState('')

  // Modal Novo / Edição
  const [modalOpen, setModalOpen] = useState(false)
  const [editingMP, setEditingMP] = useState<MateriaPrimaRecord | null>(null)
  const [formData, setFormData] = useState<MateriaPrimaFormData>(EMPTY_MP)
  const [errors, setErrors] = useState<MPFormErrors>({})
  const [saving, setSaving] = useState(false)

  // Modal Exclusão
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [mpToDelete, setMpToDelete] = useState<MateriaPrimaRecord | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Multi-seleção em lote
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [transferirLoteModalOpen, setTransferirLoteModalOpen] = useState(false)
  const [empresaDestinoLoteId, setEmpresaDestinoLoteId] = useState('')
  const [mapaFichasLote, setMapaFichasLote] = useState<Map<string, FichaTecnicaRecord[]>>(new Map())
  const [verificandoLote, setVerificandoLote] = useState(false)
  const [transferindoLote, setTransferindoLote] = useState(false)

  // Modal Mover / Transferir Matéria-Prima de Empresa
  const [transferirModalOpen, setTransferirModalOpen] = useState(false)
  const [mpParaTransferir, setMpParaTransferir] = useState<MateriaPrimaRecord | null>(null)
  const [empresaDestinoId, setEmpresaDestinoId] = useState('')
  const [fichasAfetadas, setFichasAfetadas] = useState<FichaTecnicaRecord[]>([])
  const [verificandoFichas, setVerificandoFichas] = useState(false)
  const [transferindo, setTransferindo] = useState(false)

  const loadData = async () => {
    try {
      setLoading(true)
      const [mList, fList, cfg] = await Promise.all([
        materiasPrimasService.getAll(selectedEmpresaId || undefined),
        fichasTecnicasService.getAll(selectedEmpresaId || undefined),
        selectedEmpresaId
          ? configuracoesTributariasService.getByEmpresa(selectedEmpresaId)
          : Promise.resolve(null),
      ])
      setMaterias(mList)
      setFichas(fList)
      setConfigTributaria(cfg)
    } catch (err) {
      console.error('Erro ao carregar matérias-primas/tributos:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar',
        description: 'Não foi possível carregar as matérias-primas.',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [selectedEmpresaId])

  useRealtime<MateriaPrimaRecord>('materias_primas', () => loadData())
  useRealtime<FichaTecnicaRecord>('fichas_tecnicas', () => loadData())

  // Categorias únicas
  const categorias = useMemo(() => {
    const set = new Set<string>()
    for (const m of materias) {
      if (m.categoria?.trim()) set.add(m.categoria.trim())
    }
    return Array.from(set).sort()
  }, [materias])

  // Cálculo de tributos do formulário em tempo real
  const formCalculos = useMemo(() => {
    const c = Number(formData.custo_unitario.replace(',', '.')) || 0
    const icms = Number(formData.icms_percentual.replace(',', '.')) || 0
    const pis = Number(formData.pis_percentual.replace(',', '.')) || 0
    const cofins = Number(formData.cofins_percentual.replace(',', '.')) || 0
    const ipi = Number(formData.ipi_percentual.replace(',', '.')) || 0
    const frete = Number(formData.frete_percentual.replace(',', '.')) || 0
    const perdas = Number(formData.perdas_percentual.replace(',', '.')) || 0
    return calcularTributosMateriaPrima(
      c,
      icms,
      pis,
      cofins,
      formData.isenta_st,
      formData.tipo_tributacao,
      ipi,
      frete,
      perdas,
    )
  }, [
    formData.custo_unitario,
    formData.icms_percentual,
    formData.pis_percentual,
    formData.cofins_percentual,
    formData.ipi_percentual,
    formData.frete_percentual,
    formData.perdas_percentual,
    formData.isenta_st,
    formData.tipo_tributacao,
  ])

  // Cálculo da Curva ABC
  const curvaABCData = useMemo(() => {
    // 1. Mapeamento de consumo de matérias-primas nas fichas técnicas
    const consumoFichasMap = new Map<string, { qtd: number; fichasSet: Set<string> }>()
    for (const f of fichas) {
      if (f.itens && Array.isArray(f.itens)) {
        for (const it of f.itens) {
          if (!it.materia_prima_id) continue
          const cur = consumoFichasMap.get(it.materia_prima_id) || {
            qtd: 0,
            fichasSet: new Set<string>(),
          }
          cur.qtd += Number(it.quantidade) || 0
          cur.fichasSet.add(f.id)
          consumoFichasMap.set(it.materia_prima_id, cur)
        }
      }
    }

    // 2. Calcula valor consumido (quantidade × custo unitário) por item e custo com impostos
    const cargaTrib = Number(configTributaria?.carga_tributaria_total) || 0
    const fatorGrossUp = cargaTrib > 0 && cargaTrib < 100 ? 1 / (1 - cargaTrib / 100) : 1

    const itensCalculados = materias.map((m) => {
      const custoUnit = Number(m.custo_unitario) || 0
      const calcTrib = calcularTributosMateriaPrima(
        custoUnit,
        m.icms_percentual,
        m.pis_percentual,
        m.cofins_percentual,
        m.isenta_st,
        m.tipo_tributacao,
        m.ipi_percentual,
        m.frete_percentual,
        m.perdas_percentual,
      )
      const custoComImpostos = custoUnit > 0 ? Number((custoUnit * fatorGrossUp).toFixed(4)) : 0
      const consumoInfo = consumoFichasMap.get(m.id)
      const qtdConsumoFichas = consumoInfo ? consumoInfo.qtd : 0
      const qtdEstoque = Number(m.estoque_atual) || 0
      const fichasCount = consumoInfo ? consumoInfo.fichasSet.size : 0

      const qtdBase = baseCalculoABC === 'consumo_fichas' ? qtdConsumoFichas : qtdEstoque
      const valorTotal = qtdBase * custoUnit
      const valorTotalLiquido = qtdBase * calcTrib.custoLiquido

      return {
        id: m.id,
        codigo: m.codigo || '',
        nome: m.nome,
        unidade: m.unidade || 'UN',
        categoria: m.categoria || 'Geral',
        custo_unitario: custoUnit,
        custo_liquido: calcTrib.custoLiquido,
        icms_percentual: calcTrib.icmsPercentual,
        pis_percentual: calcTrib.pisPercentual,
        cofins_percentual: calcTrib.cofinsPercentual,
        ipi_percentual: calcTrib.ipiPercentual,
        frete_percentual: calcTrib.fretePercentual,
        perdas_percentual: calcTrib.perdasPercentual,
        total_impostos_valor: calcTrib.totalCreditos,
        total_acrescimos_valor: calcTrib.totalAcrescimos,
        valor_ipi: calcTrib.valorIpi,
        valor_frete: calcTrib.valorFrete,
        valor_perdas: calcTrib.valorPerdas,
        custo_com_impostos: custoComImpostos,
        quantidade: qtdBase,
        valor_total: valorTotal,
        valor_total_liquido: valorTotalLiquido,
        percentual_individual: 0,
        percentual_acumulado: 0,
        classe: 'C' as 'A' | 'B' | 'C',
        fichas_count: fichasCount,
        observacoes: m.observacoes || '',
      }
    })

    // 3. Ordena decrescente por valor total (os maiores valores primeiro)
    itensCalculados.sort((a, b) => b.valor_total - a.valor_total)

    // 4. Valor total geral
    const valorGeralConsumido = itensCalculados.reduce((acc, it) => acc + it.valor_total, 0)
    const valorGeralConsumidoLiquido = itensCalculados.reduce(
      (acc, it) => acc + it.valor_total_liquido,
      0,
    )

    // 5. Calcula percentuais individuais, acumulados e classifica em A (~80%), B (~15% => 80 a 95%) e C (~5% => > 95%)
    let acumulado = 0
    const itensClassificados: ItemCurvaABC[] = itensCalculados.map((it) => {
      const pctInd = valorGeralConsumido > 0 ? (it.valor_total / valorGeralConsumido) * 100 : 0
      acumulado += pctInd
      const pctAcum = Math.min(100, acumulado)

      let classe: 'A' | 'B' | 'C' = 'C'
      if (pctAcum <= 80.05 || (acumulado - pctInd === 0 && pctInd > 0)) {
        classe = 'A'
      } else if (pctAcum <= 95.05) {
        classe = 'B'
      } else {
        classe = 'C'
      }

      return {
        ...it,
        percentual_individual: pctInd,
        percentual_acumulado: pctAcum,
        classe,
      }
    })

    // 6. Totais e sumários por classe
    const totalItens = itensClassificados.length
    const itensA = itensClassificados.filter((i) => i.classe === 'A')
    const itensB = itensClassificados.filter((i) => i.classe === 'B')
    const itensC = itensClassificados.filter((i) => i.classe === 'C')

    const valorA = itensA.reduce((acc, i) => acc + i.valor_total, 0)
    const valorB = itensB.reduce((acc, i) => acc + i.valor_total, 0)
    const valorC = itensC.reduce((acc, i) => acc + i.valor_total, 0)

    const pctValorA = valorGeralConsumido > 0 ? (valorA / valorGeralConsumido) * 100 : 0
    const pctValorB = valorGeralConsumido > 0 ? (valorB / valorGeralConsumido) * 100 : 0
    const pctValorC = valorGeralConsumido > 0 ? (valorC / valorGeralConsumido) * 100 : 0

    const pctItensA = totalItens > 0 ? (itensA.length / totalItens) * 100 : 0
    const pctItensB = totalItens > 0 ? (itensB.length / totalItens) * 100 : 0
    const pctItensC = totalItens > 0 ? (itensC.length / totalItens) * 100 : 0

    return {
      itens: itensClassificados,
      valorGeralConsumido,
      valorGeralConsumidoLiquido,
      totalItens,
      classeA: {
        count: itensA.length,
        valor: valorA,
        pctValor: pctValorA,
        pctItens: pctItensA,
      },
      classeB: {
        count: itensB.length,
        valor: valorB,
        pctValor: pctValorB,
        pctItens: pctItensB,
      },
      classeC: {
        count: itensC.length,
        valor: valorC,
        pctValor: pctValorC,
        pctItens: pctItensC,
      },
    }
  }, [materias, fichas, baseCalculoABC, configTributaria])

  // Itens da Curva ABC filtrados para a tabela
  const curvaABCFiltrada = useMemo(() => {
    return curvaABCData.itens.filter((it) => {
      const matchClasse = filtroClasseABC === 'todos' || it.classe === filtroClasseABC
      const matchSearch =
        searchABC.trim() === '' ||
        it.nome.toLowerCase().includes(searchABC.toLowerCase()) ||
        it.codigo.toLowerCase().includes(searchABC.toLowerCase()) ||
        it.categoria.toLowerCase().includes(searchABC.toLowerCase())
      return matchClasse && matchSearch
    })
  }, [curvaABCData.itens, filtroClasseABC, searchABC])

  // Matérias com estoque abaixo do mínimo (críticas) ou em atenção
  const materiasCriticas = useMemo(() => {
    return materias.filter((m) => {
      const st = getStatusEstoque(m).status
      return st === 'critico'
    })
  }, [materias])

  // Matérias filtradas por período (para o consolidado de créditos tributários e visualização)
  const materiasPorPeriodo = useMemo(() => {
    if (periodoCreditos === 'todos') return materias

    const now = new Date()
    const anoAtual = now.getFullYear()
    const mesAtual = now.getMonth()

    return materias.filter((m) => {
      const dataStr = m.created || m.updated
      if (!dataStr) return true
      const d = new Date(dataStr)
      if (isNaN(d.getTime())) return true

      if (periodoCreditos === 'mes_atual') {
        return d.getFullYear() === anoAtual && d.getMonth() === mesAtual
      }
      if (periodoCreditos === 'ano_atual') {
        return d.getFullYear() === anoAtual
      }
      if (periodoCreditos === 'custom') {
        const start = dataInicioCreditos ? new Date(`${dataInicioCreditos}T00:00:00`) : null
        const end = dataFimCreditos ? new Date(`${dataFimCreditos}T23:59:59`) : null
        if (start && d < start) return false
        if (end && d > end) return false
        return true
      }
      return true
    })
  }, [materias, periodoCreditos, dataInicioCreditos, dataFimCreditos])

  // Filtradas para a tabela do catálogo
  const materiasFiltradas = useMemo(() => {
    return materiasPorPeriodo.filter((m) => {
      const matchSearch =
        search.trim() === '' ||
        m.nome.toLowerCase().includes(search.toLowerCase()) ||
        (m.codigo && m.codigo.toLowerCase().includes(search.toLowerCase())) ||
        (m.categoria && m.categoria.toLowerCase().includes(search.toLowerCase()))

      const matchCat =
        categoriaFilter === 'todas' || (m.categoria && m.categoria.trim() === categoriaFilter)

      const st = getStatusEstoque(m).status
      const matchStatus =
        statusFilter === 'todos' ||
        (statusFilter === 'critico' && st === 'critico') ||
        (statusFilter === 'atencao' && st === 'atencao') ||
        (statusFilter === 'ok' && st === 'ok')

      const isIsenta =
        m.isenta_st ||
        m.tipo_tributacao === 'isenta' ||
        m.tipo_tributacao === 'substituicao_tributaria'
      const matchTrib =
        tributacaoFilter === 'todos' ||
        (tributacaoFilter === 'tributada' && !isIsenta) ||
        (tributacaoFilter === 'isenta_st' && isIsenta)

      return matchSearch && matchCat && matchStatus && matchTrib
    })
  }, [materiasPorPeriodo, search, categoriaFilter, statusFilter, tributacaoFilter])

  // Multi-seleção handlers
  const allFilteredSelected =
    materiasFiltradas.length > 0 && materiasFiltradas.every((m) => selectedIds.includes(m.id))

  const handleSelectAll = () => {
    if (allFilteredSelected) {
      const filteredIdsSet = new Set(materiasFiltradas.map((m) => m.id))
      setSelectedIds((prev) => prev.filter((id) => !filteredIdsSet.has(id)))
    } else {
      const newIds = Array.from(new Set([...selectedIds, ...materiasFiltradas.map((m) => m.id)]))
      setSelectedIds(newIds)
    }
  }

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    )
  }

  // Abertura do Modal de Transferência em Lote
  const handleOpenTransferirLote = async () => {
    if (selectedIds.length === 0) return
    const primeiraEmpresa = materias.find((m) => m.id === selectedIds[0])?.empresa
    const outraEmpresa = empresas.find((e) => e.id !== primeiraEmpresa)
    setEmpresaDestinoLoteId(outraEmpresa ? outraEmpresa.id : '')
    setTransferirLoteModalOpen(true)
    setVerificandoLote(true)
    try {
      const mapa = await materiasPrimasService.verificarUsoEmFichasLote(selectedIds)
      setMapaFichasLote(mapa)
    } catch (err) {
      console.warn('Erro ao verificar fichas do lote:', err)
      setMapaFichasLote(new Map())
    } finally {
      setVerificandoLote(false)
    }
  }

  const handleConfirmarTransferenciaLote = async () => {
    if (selectedIds.length === 0 || !empresaDestinoLoteId) {
      toast({
        variant: 'destructive',
        title: 'Selecione o destino',
        description: 'Por favor, escolha a empresa de destino.',
      })
      return
    }

    const empresaDestinoObj = empresas.find((e) => e.id === empresaDestinoLoteId)
    const nomeDestino = empresaDestinoObj?.nome || 'empresa de destino'

    setTransferindoLote(true)
    try {
      const res = await materiasPrimasService.transferirLote(selectedIds, empresaDestinoLoteId)
      if (res.sucesso > 0) {
        toast({
          title: 'Transferência em lote concluída!',
          description: `${res.sucesso} de ${res.total} matérias-primas foram movidas com sucesso para ${nomeDestino}.`,
        })
      }
      if (res.falhas.length > 0) {
        toast({
          variant: 'destructive',
          title: 'Algumas falhas ocorreram',
          description: `${res.falhas.length} matéria(s)-prima(s) não puderam ser transferidas.`,
        })
      }
      setTransferirLoteModalOpen(false)
      setSelectedIds([])
      loadData()
    } catch (err: any) {
      console.error(err)
      toast({
        variant: 'destructive',
        title: 'Erro ao transferir em lote',
        description: err?.message || 'Não foi possível concluir a transferência em lote.',
      })
    } finally {
      setTransferindoLote(false)
    }
  }

  // Estatísticas gerais e consolidado de créditos tributários e acréscimos
  const stats = useMemo(() => {
    const total = materiasPorPeriodo.length
    let valorTotalEstoqueBruto = 0
    let valorTotalEstoqueLiquido = 0
    let totalCreditoImpostosEstoque = 0
    let totalCreditoIcmsEstoque = 0
    let totalCreditoPisEstoque = 0
    let totalCreditoCofinsEstoque = 0

    let totalIpiEstoque = 0
    let totalFreteEstoque = 0
    let totalPerdasEstoque = 0
    let totalAcrescimosEstoque = 0

    let somaCustoBruto = 0
    let somaCustoLiquido = 0
    let somaCreditoIcmsUnit = 0
    let somaCreditoPisUnit = 0
    let somaCreditoCofinsUnit = 0
    let somaCreditosTotaisUnit = 0
    let somaIpiUnit = 0
    let somaFreteUnit = 0
    let somaPerdasUnit = 0
    let somaAcrescimosUnit = 0

    let countIsentasST = 0
    let countTributadas = 0

    materiasPorPeriodo.forEach((m) => {
      const calc = calcularTributosMateriaPrima(
        m.custo_unitario || 0,
        m.icms_percentual || 0,
        m.pis_percentual || 0,
        m.cofins_percentual || 0,
        m.isenta_st,
        m.tipo_tributacao,
        m.ipi_percentual || 0,
        m.frete_percentual || 0,
        m.perdas_percentual || 0,
      )
      const qtd = Number(m.estoque_atual) || 0

      if (calc.isIsentaOuST) {
        countIsentasST++
      } else {
        countTributadas++
      }

      valorTotalEstoqueBruto += calc.custoBruto * qtd
      valorTotalEstoqueLiquido += calc.custoLiquido * qtd

      const cIcmsEst = calc.creditoIcms * qtd
      const cPisEst = calc.creditoPis * qtd
      const cCofEst = calc.creditoCofins * qtd

      totalCreditoIcmsEstoque += cIcmsEst
      totalCreditoPisEstoque += cPisEst
      totalCreditoCofinsEstoque += cCofEst
      totalCreditoImpostosEstoque += calc.totalCreditos * qtd

      totalIpiEstoque += calc.valorIpi * qtd
      totalFreteEstoque += calc.valorFrete * qtd
      totalPerdasEstoque += calc.valorPerdas * qtd
      totalAcrescimosEstoque += calc.totalAcrescimos * qtd

      somaCustoBruto += calc.custoBruto
      somaCustoLiquido += calc.custoLiquido
      somaCreditoIcmsUnit += calc.creditoIcms
      somaCreditoPisUnit += calc.creditoPis
      somaCreditoCofinsUnit += calc.creditoCofins
      somaCreditosTotaisUnit += calc.totalCreditos
      somaIpiUnit += calc.valorIpi
      somaFreteUnit += calc.valorFrete
      somaPerdasUnit += calc.valorPerdas
      somaAcrescimosUnit += calc.totalAcrescimos
    })

    const custoMedioBruto = total > 0 ? somaCustoBruto / total : 0
    const custoMedioLiquido = total > 0 ? somaCustoLiquido / total : 0
    const percentualEconomiaEstoque =
      valorTotalEstoqueBruto > 0 ? (totalCreditoImpostosEstoque / valorTotalEstoqueBruto) * 100 : 0

    const totalCriticos = materiasPorPeriodo.filter(
      (m) => getStatusEstoque(m).status === 'critico',
    ).length
    const totalAtencao = materiasPorPeriodo.filter(
      (m) => getStatusEstoque(m).status === 'atencao',
    ).length

    return {
      total,
      totalGeralSemFiltro: materias.length,
      valorTotalEstoqueBruto,
      valorTotalEstoqueLiquido,
      totalCreditoImpostosEstoque,
      totalCreditoIcmsEstoque,
      totalCreditoPisEstoque,
      totalCreditoCofinsEstoque,
      totalIpiEstoque,
      totalFreteEstoque,
      totalPerdasEstoque,
      totalAcrescimosEstoque,
      somaCreditoIcmsUnit,
      somaCreditoPisUnit,
      somaCreditoCofinsUnit,
      somaCreditosTotaisUnit,
      somaIpiUnit,
      somaFreteUnit,
      somaPerdasUnit,
      somaAcrescimosUnit,
      custoMedioBruto,
      custoMedioLiquido,
      percentualEconomiaEstoque,
      countIsentasST,
      countTributadas,
      categoriasCount: categorias.length,
      totalCriticos,
      totalAtencao,
    }
  }, [materiasPorPeriodo, materias.length, categorias])

  const setField = <K extends keyof MateriaPrimaFormData>(
    key: K,
    value: MateriaPrimaFormData[K],
  ) => {
    setFormData((prev) => ({ ...prev, [key]: value }))
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  const validate = (form: MateriaPrimaFormData): boolean => {
    const errs: MPFormErrors = {}
    if (!form.nome.trim() || form.nome.trim().length < 2) {
      errs.nome = 'Informe o nome da matéria-prima (mínimo 2 caracteres)'
    }
    if (!form.empresa) {
      errs.general = 'Selecione uma empresa para vincular a matéria-prima'
    }
    if (!form.unidade.trim()) {
      errs.unidade = 'Informe a unidade de medida (ex: KG, UN, L)'
    }
    if (form.custo_unitario.trim() !== '') {
      const c = Number(form.custo_unitario.replace(',', '.'))
      if (isNaN(c) || c < 0) errs.custo_unitario = 'Informe um custo unitário válido'
    }
    if (form.icms_percentual.trim() !== '') {
      const icms = Number(form.icms_percentual.replace(',', '.'))
      if (isNaN(icms) || icms < 0 || icms > 100)
        errs.icms_percentual = 'Percentual de ICMS inválido (0 a 100)'
    }
    if (form.pis_percentual.trim() !== '') {
      const pis = Number(form.pis_percentual.replace(',', '.'))
      if (isNaN(pis) || pis < 0 || pis > 100)
        errs.pis_percentual = 'Percentual de PIS inválido (0 a 100)'
    }
    if (form.cofins_percentual.trim() !== '') {
      const cofins = Number(form.cofins_percentual.replace(',', '.'))
      if (isNaN(cofins) || cofins < 0 || cofins > 100)
        errs.cofins_percentual = 'Percentual de COFINS inválido (0 a 100)'
    }
    if (form.ipi_percentual.trim() !== '') {
      const ipi = Number(form.ipi_percentual.replace(',', '.'))
      if (isNaN(ipi) || ipi < 0 || ipi > 100)
        errs.ipi_percentual = 'Percentual de IPI inválido (0 a 100)'
    }
    if (form.frete_percentual.trim() !== '') {
      const frete = Number(form.frete_percentual.replace(',', '.'))
      if (isNaN(frete) || frete < 0 || frete > 100)
        errs.frete_percentual = 'Percentual de Frete inválido (0 a 100)'
    }
    if (form.perdas_percentual.trim() !== '') {
      const perdas = Number(form.perdas_percentual.replace(',', '.'))
      if (isNaN(perdas) || perdas < 0 || perdas > 100)
        errs.perdas_percentual = 'Percentual de Perdas inválido (0 a 100)'
    }
    if (form.estoque_atual.trim() !== '') {
      const e = Number(form.estoque_atual.replace(',', '.'))
      if (isNaN(e) || e < 0) errs.estoque_atual = 'Informe uma quantidade de estoque válida'
    }
    if (form.estoque_minimo.trim() !== '') {
      const min = Number(form.estoque_minimo.replace(',', '.'))
      if (isNaN(min) || min < 0) errs.estoque_minimo = 'Informe um estoque mínimo válido'
    }

    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleOpenNew = () => {
    setEditingMP(null)
    setFormData({
      ...EMPTY_MP,
      empresa: selectedEmpresaId || (empresas.length > 0 ? empresas[0].id : ''),
    })
    setErrors({})
    setModalOpen(true)
  }

  const handleOpenEdit = (m: MateriaPrimaRecord) => {
    setEditingMP(m)
    const isIsenta = Boolean(
      m.isenta_st ||
      m.tipo_tributacao === 'isenta' ||
      m.tipo_tributacao === 'substituicao_tributaria',
    )
    setFormData({
      empresa: m.empresa || selectedEmpresaId || (empresas.length > 0 ? empresas[0].id : ''),
      codigo: m.codigo || '',
      nome: m.nome,
      unidade: m.unidade || 'UN',
      categoria: m.categoria || '',
      custo_unitario:
        m.custo_unitario !== undefined && m.custo_unitario !== null ? String(m.custo_unitario) : '',
      icms_percentual:
        m.icms_percentual !== undefined && m.icms_percentual !== null
          ? String(m.icms_percentual)
          : '',
      pis_percentual:
        m.pis_percentual !== undefined && m.pis_percentual !== null ? String(m.pis_percentual) : '',
      cofins_percentual:
        m.cofins_percentual !== undefined && m.cofins_percentual !== null
          ? String(m.cofins_percentual)
          : '',
      ipi_percentual:
        m.ipi_percentual !== undefined && m.ipi_percentual !== null ? String(m.ipi_percentual) : '',
      frete_percentual:
        m.frete_percentual !== undefined && m.frete_percentual !== null
          ? String(m.frete_percentual)
          : '',
      perdas_percentual:
        m.perdas_percentual !== undefined && m.perdas_percentual !== null
          ? String(m.perdas_percentual)
          : '',
      isenta_st: isIsenta,
      tipo_tributacao: m.tipo_tributacao || (isIsenta ? 'isenta' : 'tributada'),
      estoque_atual:
        m.estoque_atual !== undefined && m.estoque_atual !== null ? String(m.estoque_atual) : '',
      estoque_minimo:
        m.estoque_minimo !== undefined && m.estoque_minimo !== null ? String(m.estoque_minimo) : '',
      observacoes: m.observacoes || '',
    })
    setErrors({})
    setModalOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate(formData)) return

    setSaving(true)
    try {
      const custoNum =
        formData.custo_unitario.trim() !== ''
          ? Number(formData.custo_unitario.replace(',', '.'))
          : undefined
      const icmsNum =
        formData.icms_percentual.trim() !== ''
          ? Number(formData.icms_percentual.replace(',', '.'))
          : 0
      const pisNum =
        formData.pis_percentual.trim() !== ''
          ? Number(formData.pis_percentual.replace(',', '.'))
          : 0
      const cofinsNum =
        formData.cofins_percentual.trim() !== ''
          ? Number(formData.cofins_percentual.replace(',', '.'))
          : 0
      const ipiNum =
        formData.ipi_percentual.trim() !== ''
          ? Number(formData.ipi_percentual.replace(',', '.'))
          : 0
      const freteNum =
        formData.frete_percentual.trim() !== ''
          ? Number(formData.frete_percentual.replace(',', '.'))
          : 0
      const perdasNum =
        formData.perdas_percentual.trim() !== ''
          ? Number(formData.perdas_percentual.replace(',', '.'))
          : 0
      const estoqueNum =
        formData.estoque_atual.trim() !== ''
          ? Number(formData.estoque_atual.replace(',', '.'))
          : undefined
      const estoqueMinNum =
        formData.estoque_minimo.trim() !== ''
          ? Number(formData.estoque_minimo.replace(',', '.'))
          : undefined

      const isIsentaFinal = Boolean(
        formData.isenta_st ||
        formData.tipo_tributacao === 'isenta' ||
        formData.tipo_tributacao === 'substituicao_tributaria',
      )

      const payload = {
        empresa: formData.empresa || selectedEmpresaId || undefined,
        codigo: formData.codigo.trim() || undefined,
        nome: formData.nome.trim(),
        unidade: formData.unidade.trim().toUpperCase(),
        categoria: formData.categoria.trim() || undefined,
        custo_unitario: custoNum,
        icms_percentual: isIsentaFinal ? 0 : icmsNum,
        pis_percentual: isIsentaFinal ? 0 : pisNum,
        cofins_percentual: isIsentaFinal ? 0 : cofinsNum,
        ipi_percentual: ipiNum,
        frete_percentual: freteNum,
        perdas_percentual: perdasNum,
        isenta_st: isIsentaFinal,
        tipo_tributacao: formData.tipo_tributacao,
        estoque_atual: estoqueNum,
        estoque_minimo: estoqueMinNum,
        observacoes: formData.observacoes.trim() || undefined,
      }

      if (editingMP) {
        await materiasPrimasService.update(editingMP.id, payload)
        toast({
          title: 'Matéria-prima atualizada',
          description: `"${payload.nome}" foi atualizada com sucesso.`,
        })
      } else {
        await materiasPrimasService.create(payload)
        toast({
          title: 'Matéria-prima cadastrada',
          description: `"${payload.nome}" foi adicionada com sucesso.`,
        })
      }

      setModalOpen(false)
      loadData()
    } catch (err: any) {
      console.error(err)
      setErrors((prev) => ({
        ...prev,
        general: err?.message || 'Erro ao salvar a matéria-prima.',
      }))
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = (m: MateriaPrimaRecord) => {
    setMpToDelete(m)
    setDeleteOpen(true)
  }

  const handleOpenTransferir = async (m: MateriaPrimaRecord) => {
    setMpParaTransferir(m)
    const outraEmpresa = empresas.find((e) => e.id !== m.empresa)
    setEmpresaDestinoId(outraEmpresa ? outraEmpresa.id : '')
    setTransferirModalOpen(true)
    setVerificandoFichas(true)
    try {
      const usadas = await materiasPrimasService.verificarUsoEmFichas(m.id)
      setFichasAfetadas(usadas)
    } catch (err) {
      console.warn('Erro ao verificar uso em fichas:', err)
      setFichasAfetadas([])
    } finally {
      setVerificandoFichas(false)
    }
  }

  const handleConfirmarTransferencia = async () => {
    if (!mpParaTransferir || !empresaDestinoId) {
      toast({
        variant: 'destructive',
        title: 'Selecione o destino',
        description: 'Por favor, escolha a empresa de destino.',
      })
      return
    }

    if (mpParaTransferir.empresa === empresaDestinoId) {
      toast({
        variant: 'destructive',
        title: 'Empresa idêntica',
        description: 'A empresa de destino deve ser diferente da empresa atual.',
      })
      return
    }

    const empresaDestinoObj = empresas.find((e) => e.id === empresaDestinoId)
    const nomeDestino = empresaDestinoObj?.nome || 'nova empresa'

    setTransferindo(true)
    try {
      await materiasPrimasService.transferirEmpresa(mpParaTransferir.id, empresaDestinoId)
      toast({
        title: 'Matéria-prima transferida!',
        description: `"${mpParaTransferir.nome}" foi movida com sucesso para ${nomeDestino}.`,
      })
      setTransferirModalOpen(false)
      setMpParaTransferir(null)
      loadData()
    } catch (err: any) {
      console.error(err)
      toast({
        variant: 'destructive',
        title: 'Erro ao transferir',
        description: err?.message || 'Não foi possível concluir a transferência da matéria-prima.',
      })
    } finally {
      setTransferindo(false)
    }
  }

  const handleDelete = async () => {
    if (!mpToDelete) return
    setDeleting(true)
    try {
      await materiasPrimasService.delete(mpToDelete.id)
      toast({
        title: 'Matéria-prima excluída',
        description: `"${mpToDelete.nome}" foi removida do sistema.`,
      })
      setDeleteOpen(false)
      setMpToDelete(null)
      loadData()
    } catch (err: any) {
      console.error(err)
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir',
        description: err?.message || 'Não foi possível excluir a matéria-prima.',
      })
    } finally {
      setDeleting(false)
    }
  }

  // Exportar CSV
  const handleExportCsv = () => {
    if (materias.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Nada para exportar',
        description: 'Não há matérias-primas cadastradas.',
      })
      return
    }

    const escapeCsv = (val: string | number | undefined | null): string => {
      if (val === null || val === undefined) return ''
      const s = String(val)
      if (/[;"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
      return s
    }

    const fmtNum = (n?: number) =>
      n !== undefined && n !== null
        ? n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : ''

    const fmtPctVal = (n?: number) =>
      n !== undefined && n !== null
        ? n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%'
        : '0,00%'

    const headers = [
      'Código',
      'Matéria-Prima',
      'Status Tributário',
      'Status Estoque',
      'Unidade',
      'Categoria',
      'Custo Unitário Bruto (R$)',
      'ICMS (%)',
      'Valor Crédito ICMS (R$)',
      'PIS (%)',
      'Valor Crédito PIS (R$)',
      'COFINS (%)',
      'Valor Crédito COFINS (R$)',
      'Total Créditos Dedução (R$)',
      'IPI (%)',
      'Valor IPI (R$)',
      'Frete (%)',
      'Valor Frete (R$)',
      'Perdas (%)',
      'Valor Perdas (R$)',
      'Total Acréscimos (R$)',
      'Custo Unitário Líquido (R$)',
      'Estoque Atual',
      'Estoque Mínimo',
      'Crédito Total no Estoque (R$)',
      'Acréscimos Total no Estoque (R$)',
      'Valor Total em Estoque Líquido (R$)',
      'Valor Total em Estoque Bruto (R$)',
      'Observações',
    ]

    const linhas = [headers.map(escapeCsv).join(';')]

    for (const m of materiasFiltradas) {
      const calc = calcularTributosMateriaPrima(
        m.custo_unitario || 0,
        m.icms_percentual || 0,
        m.pis_percentual || 0,
        m.cofins_percentual || 0,
        m.isenta_st,
        m.tipo_tributacao,
        m.ipi_percentual || 0,
        m.frete_percentual || 0,
        m.perdas_percentual || 0,
      )
      const est = m.estoque_atual || 0
      const totalEstoqueBruto = calc.custoBruto * est
      const totalEstoqueLiquido = calc.custoLiquido * est
      const creditoTotalEstoqueItem = calc.totalCreditos * est
      const acrescimosTotalEstoqueItem = calc.totalAcrescimos * est

      const st = getStatusEstoque(m)
      const estMin =
        m.estoque_minimo !== undefined && m.estoque_minimo !== null
          ? m.estoque_minimo.toLocaleString('pt-BR')
          : ''

      const situacaoTrib = calc.isIsentaOuST
        ? m.tipo_tributacao === 'substituicao_tributaria'
          ? 'Substituição Tributária (ST)'
          : 'Isenta'
        : 'Tributada (Gera Créditos)'

      linhas.push(
        [
          m.codigo || '',
          m.nome,
          situacaoTrib,
          st.label,
          m.unidade,
          m.categoria || '',
          fmtNum(calc.custoBruto),
          fmtPctVal(calc.icmsPercentual),
          fmtNum(calc.creditoIcms),
          fmtPctVal(calc.pisPercentual),
          fmtNum(calc.creditoPis),
          fmtPctVal(calc.cofinsPercentual),
          fmtNum(calc.creditoCofins),
          fmtNum(calc.totalCreditos),
          fmtPctVal(calc.ipiPercentual),
          fmtNum(calc.valorIpi),
          fmtPctVal(calc.fretePercentual),
          fmtNum(calc.valorFrete),
          fmtPctVal(calc.perdasPercentual),
          fmtNum(calc.valorPerdas),
          fmtNum(calc.totalAcrescimos),
          fmtNum(calc.custoLiquido),
          est.toLocaleString('pt-BR'),
          estMin,
          fmtNum(creditoTotalEstoqueItem),
          fmtNum(acrescimosTotalEstoqueItem),
          fmtNum(totalEstoqueLiquido),
          fmtNum(totalEstoqueBruto),
          m.observacoes || '',
        ]
          .map(escapeCsv)
          .join(';'),
      )
    }

    const csvContent = '\uFEFF' + linhas.join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    const dataStr = new Date().toISOString().slice(0, 10)
    link.setAttribute('download', `cadastro-materias-primas-impostos-${dataStr}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    toast({
      title: 'Exportação concluída',
      description: 'O arquivo CSV com as matérias-primas e tributos foi baixado.',
    })
  }

  // Exportar CSV da Curva ABC
  const handleExportCurvaAbcCsv = () => {
    if (curvaABCData.itens.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Nada para exportar',
        description: 'Não há matérias-primas cadastradas para Curva ABC.',
      })
      return
    }

    const escapeCsv = (val: string | number | undefined | null): string => {
      if (val === null || val === undefined) return ''
      const s = String(val)
      if (/[;"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
      return s
    }

    const fmtNum = (n?: number) =>
      n !== undefined && n !== null
        ? n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : ''

    const cargaTrib = Number(configTributaria?.carga_tributaria_total) || 0
    const headers = [
      'Ranking (Posição)',
      'Classe ABC',
      'Código',
      'Matéria-Prima',
      'Unidade',
      'Categoria',
      'Custo Unitário Bruto (R$)',
      'ICMS (%)',
      'PIS (%)',
      'COFINS (%)',
      'Total Impostos/Créditos (R$)',
      'IPI (%)',
      'Frete (%)',
      'Perdas (%)',
      'Total Acréscimos (R$)',
      'Custo Unitário Líquido (R$)',
      `Custo c/ Gross-up Tributário (${cargaTrib.toFixed(2)}%) (R$)`,
      baseCalculoABC === 'consumo_fichas' ? 'Qtd Consumo em Fichas' : 'Estoque Atual (Qtd)',
      'Fichas Técnicas Atendidas',
      'Valor Total Consumido Bruto (R$)',
      'Valor Total Consumido Líquido (R$)',
      '% Individual sobre Total',
      '% Acumulado',
      'Prioridade de Negociação / Estratégia',
    ]

    const linhas = [
      ['RELATÓRIO DE CURVA ABC DE MATÉRIAS-PRIMAS'].map(escapeCsv).join(';'),
      [
        'Base de Cálculo:',
        baseCalculoABC === 'consumo_fichas'
          ? 'Consumo por Unidade nas Fichas Técnicas (Quantidade × Custo Unitário)'
          : 'Estoque Atual Valorizado (Quantidade em Estoque × Custo Unitário)',
      ]
        .map(escapeCsv)
        .join(';'),
      ['Data de Emissão:', new Date().toLocaleDateString('pt-BR')].map(escapeCsv).join(';'),
      [
        'Resumo Classe A:',
        `${curvaABCData.classeA.count} itens (${curvaABCData.classeA.pctItens.toFixed(1)}% dos itens) = R$ ${fmtNum(curvaABCData.classeA.valor)} (${curvaABCData.classeA.pctValor.toFixed(1)}% do valor)`,
      ]
        .map(escapeCsv)
        .join(';'),
      [
        'Resumo Classe B:',
        `${curvaABCData.classeB.count} itens (${curvaABCData.classeB.pctItens.toFixed(1)}% dos itens) = R$ ${fmtNum(curvaABCData.classeB.valor)} (${curvaABCData.classeB.pctValor.toFixed(1)}% do valor)`,
      ]
        .map(escapeCsv)
        .join(';'),
      [
        'Resumo Classe C:',
        `${curvaABCData.classeC.count} itens (${curvaABCData.classeC.pctItens.toFixed(1)}% dos itens) = R$ ${fmtNum(curvaABCData.classeC.valor)} (${curvaABCData.classeC.pctValor.toFixed(1)}% do valor)`,
      ]
        .map(escapeCsv)
        .join(';'),
      '',
      headers.map(escapeCsv).join(';'),
    ]

    curvaABCFiltrada.forEach((it, index) => {
      const estrategia =
        it.classe === 'A'
          ? 'ALTA PRIORIDADE: Negociar contratos anuais, desconto por escala e monitorar créditos de ICMS/PIS/COFINS.'
          : it.classe === 'B'
            ? 'MÉDIA PRIORIDADE: Revisão periódica de fornecedores e cotação trimestral.'
            : 'BAIXA PRIORIDADE / OPERACIONAL: Manter estoque de segurança básico e compras simplificadas.'

      linhas.push(
        [
          index + 1,
          `Classe ${it.classe}`,
          it.codigo || '',
          it.nome,
          it.unidade,
          it.categoria,
          fmtNum(it.custo_unitario),
          it.icms_percentual.toFixed(2) + '%',
          it.pis_percentual.toFixed(2) + '%',
          it.cofins_percentual.toFixed(2) + '%',
          fmtNum(it.total_impostos_valor),
          it.ipi_percentual.toFixed(2) + '%',
          it.frete_percentual.toFixed(2) + '%',
          it.perdas_percentual.toFixed(2) + '%',
          fmtNum(it.total_acrescimos_valor),
          fmtNum(it.custo_liquido),
          fmtNum(it.custo_com_impostos),
          it.quantidade.toLocaleString('pt-BR', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 3,
          }),
          it.fichas_count,
          fmtNum(it.valor_total),
          fmtNum(it.valor_total_liquido),
          it.percentual_individual.toFixed(2) + '%',
          it.percentual_acumulado.toFixed(2) + '%',
          estrategia,
        ]
          .map(escapeCsv)
          .join(';'),
      )
    })

    const csvContent = '\uFEFF' + linhas.join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    const dataStr = new Date().toISOString().slice(0, 10)
    link.setAttribute('download', `curva-abc-materias-primas-${dataStr}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    toast({
      title: 'Curva ABC exportada com sucesso!',
      description: 'O arquivo CSV com o ranking e a classificação ABC foi baixado.',
    })
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Seletor de Empresa, Banner de Contexto e Indicador de Quantidade Resumido */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Empresa Selecionada:
              </span>
              <span className="text-xs font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                {selectedEmpresa?.nome || 'Nenhuma selecionada'}
              </span>
              {/* Indicador Resumido da Empresa Ativa */}
              <Badge
                variant="outline"
                className="text-xs font-semibold bg-amber-50 text-amber-900 border-amber-300"
              >
                {stats.total} {stats.total === 1 ? 'item' : 'itens'} ·{' '}
                {selectedEmpresa?.nome || 'Geral'}
              </Badge>
              {fichas.length > 0 && (
                <Badge
                  variant="outline"
                  className="text-xs font-medium bg-blue-50/70 text-blue-700 border-blue-200"
                >
                  {fichas.length} {fichas.length === 1 ? 'ficha vinculada' : 'fichas vinculadas'}
                </Badge>
              )}
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              Os insumos, tributos e curva ABC exibidos pertencem exclusivamente a esta empresa.
            </p>
          </div>
        </div>

        {empresas.length > 1 && (
          <div className="flex items-center gap-2 w-full md:w-auto">
            <label
              htmlFor="empresa-filtro-mp"
              className="text-xs font-medium text-slate-600 shrink-0"
            >
              Trocar Empresa:
            </label>
            <select
              id="empresa-filtro-mp"
              value={selectedEmpresaId}
              onChange={(e) => setSelectedEmpresaId(e.target.value)}
              className="h-9 text-xs bg-white border border-slate-300 rounded-lg px-3 py-1 text-slate-800 font-medium focus:ring-2 focus:ring-amber-600 focus:outline-none w-full md:w-64"
            >
              {empresas.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.nome} ({emp.segmento || 'Empresa'})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Abas Superiores: Catálogo de Insumos vs Curva ABC */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <h2 className="text-lg font-bold text-[#0B1F3A] flex items-center gap-2">
            <Layers className="w-5 h-5 text-amber-600" />
            Matérias-Primas & Insumos
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Cadastre custos unitários, deduções (ICMS, PIS, COFINS) e acréscimos sobre o bruto (IPI,
            Frete, Perdas) para apurar o Custo Unitário Líquido.
          </p>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as any)}
          className="w-full sm:w-auto"
        >
          <TabsList className="bg-slate-100 p-1 w-full sm:w-auto grid grid-cols-2">
            <TabsTrigger
              value="catalogo"
              className="text-xs font-semibold data-[state=active]:bg-white data-[state=active]:text-amber-800 data-[state=active]:shadow-xs gap-1.5"
            >
              <Layers className="w-3.5 h-3.5" />
              Catálogo ({materias.length})
            </TabsTrigger>
            <TabsTrigger
              value="curva-abc"
              className="text-xs font-semibold data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-xs gap-1.5"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              Curva ABC de Insumos
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Modal PDF de Custos por Matéria-Prima (A4) */}
      <ModalPdfMateriaPrima
        open={pdfModalOpen}
        onOpenChange={setPdfModalOpen}
        materias={materiasFiltradas.length > 0 ? materiasFiltradas : materias}
        selectedEmpresa={selectedEmpresa}
        minhaEmpresa={minhaEmpresa}
        logoUrl={logoUrl}
        configTributaria={configTributaria}
        filtroCategoria={categoriaFilter}
        filtroTributacao={tributacaoFilter}
      />

      {activeTab === 'catalogo' ? (
        <>
          {/* Alerta de Estoque Mínimo no Topo */}
          {materiasCriticas.length > 0 && (
            <Alert className="border-rose-300 bg-rose-50 text-rose-900 shadow-xs">
              <ShieldAlert className="h-5 w-5 text-rose-600" />
              <div className="ml-2">
                <AlertTitle className="text-sm font-bold text-rose-900 flex items-center gap-2">
                  Alerta de Reposição Urgente: {materiasCriticas.length}{' '}
                  {materiasCriticas.length === 1 ? 'insumo abaixo' : 'insumos abaixo'} do estoque
                  mínimo!
                </AlertTitle>
                <AlertDescription className="text-xs text-rose-800 mt-1">
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {materiasCriticas.map((m) => {
                      const atual = Number(m.estoque_atual) || 0
                      const min = Number(m.estoque_minimo) || 0
                      return (
                        <span
                          key={m.id}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-rose-300 text-rose-900 text-xs font-semibold shadow-2xs"
                        >
                          <span className="font-bold">{m.nome}</span>
                          <span className="text-rose-600 font-normal">
                            ({formatQty(atual, m.unidade)} / min: {formatQty(min, m.unidade)})
                          </span>
                        </span>
                      )
                    })}
                  </div>
                </AlertDescription>
              </div>
            </Alert>
          )}

          {/* Resumo de Créditos Tributários Recuperáveis e Filtro de Período (Melhoria 2) */}
          <div className="p-4 rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-slate-50 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-blue-600 text-white text-[10px] font-bold uppercase tracking-wider">
                    Créditos de Impostos na Compra
                  </span>
                  <span className="text-xs text-slate-500 font-medium">
                    Consolidado Tributário Recuperável
                  </span>
                </div>
                <h3 className="text-sm sm:text-base font-bold text-[#0B1F3A] flex items-center gap-1.5">
                  <Receipt className="w-4 h-4 text-blue-700" />
                  Resumo de Créditos Tributários por Período
                </h3>
              </div>

              {/* Filtro por Período */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  <select
                    value={periodoCreditos}
                    onChange={(e) => setPeriodoCreditos(e.target.value)}
                    className="text-xs bg-transparent border-0 font-semibold text-slate-700 focus:outline-none cursor-pointer"
                  >
                    <option value="todos">Todo o Período / Acumulado</option>
                    <option value="mes_atual">Mês Atual</option>
                    <option value="ano_atual">Ano Atual</option>
                    <option value="custom">Personalizado (Datas)</option>
                  </select>
                </div>

                {periodoCreditos === 'custom' && (
                  <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-lg border border-slate-200 text-xs">
                    <Input
                      type="date"
                      value={dataInicioCreditos}
                      onChange={(e) => setDataInicioCreditos(e.target.value)}
                      className="h-7 text-[11px] p-1 border-0"
                      placeholder="De"
                    />
                    <span className="text-slate-400">até</span>
                    <Input
                      type="date"
                      value={dataFimCreditos}
                      onChange={(e) => setDataFimCreditos(e.target.value)}
                      className="h-7 text-[11px] p-1 border-0"
                      placeholder="Até"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Cards do Resumo Tributário e Acréscimos (ICMS, PIS, COFINS, IPI, Frete, Perdas, Totais) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
              <div className="p-3 bg-white rounded-lg border border-blue-100 shadow-2xs space-y-0.5">
                <span className="text-[10px] font-bold uppercase text-blue-700 block">
                  Créditos Impostos (-)
                </span>
                <strong className="text-sm sm:text-base font-black font-mono text-blue-900 block">
                  {formatBrl(stats.totalCreditoImpostosEstoque)}
                </strong>
                <span className="text-[10px] text-slate-500 block">
                  ICMS: {formatBrl(stats.totalCreditoIcmsEstoque)} | PIS/COF:{' '}
                  {formatBrl(stats.totalCreditoPisEstoque + stats.totalCreditoCofinsEstoque)}
                </span>
              </div>

              <div className="p-3 bg-white rounded-lg border border-orange-100 shadow-2xs space-y-0.5">
                <span className="text-[10px] font-bold uppercase text-orange-700 block">
                  IPI (+)
                </span>
                <strong className="text-sm sm:text-base font-black font-mono text-orange-900 block">
                  {formatBrl(stats.totalIpiEstoque)}
                </strong>
                <span className="text-[10px] text-slate-500 block">
                  Unit. soma: {formatBrl(stats.somaIpiUnit)}
                </span>
              </div>

              <div className="p-3 bg-white rounded-lg border border-cyan-100 shadow-2xs space-y-0.5">
                <span className="text-[10px] font-bold uppercase text-cyan-700 block">
                  Frete (+)
                </span>
                <strong className="text-sm sm:text-base font-black font-mono text-cyan-900 block">
                  {formatBrl(stats.totalFreteEstoque)}
                </strong>
                <span className="text-[10px] text-slate-500 block">
                  Unit. soma: {formatBrl(stats.somaFreteUnit)}
                </span>
              </div>

              <div className="p-3 bg-white rounded-lg border border-rose-100 shadow-2xs space-y-0.5">
                <span className="text-[10px] font-bold uppercase text-rose-700 block">
                  Perdas (+)
                </span>
                <strong className="text-sm sm:text-base font-black font-mono text-rose-900 block">
                  {formatBrl(stats.totalPerdasEstoque)}
                </strong>
                <span className="text-[10px] text-slate-500 block">
                  Unit. soma: {formatBrl(stats.somaPerdasUnit)}
                </span>
              </div>

              <div className="p-3 bg-white rounded-lg border border-amber-200 shadow-2xs space-y-0.5">
                <span className="text-[10px] font-bold uppercase text-amber-800 block">
                  Total Acréscimos (+)
                </span>
                <strong className="text-sm sm:text-base font-black font-mono text-amber-900 block">
                  {formatBrl(stats.totalAcrescimosEstoque)}
                </strong>
                <span className="text-[10px] text-slate-500 block">IPI + Frete + Perdas</span>
              </div>

              <div className="p-3 bg-emerald-600 text-white rounded-lg shadow-2xs space-y-0.5">
                <span className="text-[10px] font-bold uppercase text-emerald-100 block">
                  Estoque Líquido Total
                </span>
                <strong className="text-sm sm:text-base font-black font-mono text-white block">
                  {formatBrl(stats.valorTotalEstoqueLiquido)}
                </strong>
                <span className="text-[10px] text-emerald-100 block">
                  Bruto: {formatBrl(stats.valorTotalEstoqueBruto)}
                </span>
              </div>
            </div>
          </div>
          {/* Barra de Ações em Lote de Matérias-Primas (Quando há itens selecionados) */}
          {selectedIds.length > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3 animate-fadeIn">
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-900">
                <CheckSquare className="w-4 h-4 text-amber-700" />
                <span>
                  <strong>{selectedIds.length}</strong>{' '}
                  {selectedIds.length === 1
                    ? 'matéria-prima selecionada'
                    : 'matérias-primas selecionadas'}
                </span>
                <span className="text-amber-600 font-normal">|</span>
                <button
                  type="button"
                  onClick={() => setSelectedIds([])}
                  className="text-amber-800 underline text-[11px] hover:text-amber-950 font-normal"
                >
                  Desmarcar todas
                </button>
              </div>

              {empresas.length > 1 && (
                <div className="flex items-center gap-2">
                  <Button
                    onClick={handleOpenTransferirLote}
                    size="sm"
                    className="h-8 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white shadow-xs gap-1.5"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                    Transferir Selecionadas de Empresa ({selectedIds.length})
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Catálogo de Matérias-Primas */}
          <Card className="bg-white border-slate-200 shadow-xs">
            <CardHeader className="pb-3 border-b border-slate-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base font-bold text-[#0B1F3A] flex items-center gap-2">
                    <Layers className="w-4 h-4 text-amber-600" />
                    Catálogo de Matérias-Primas, Alíquotas e Custos Líquidos
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Demonstração detalhada do Custo Bruto, deduções (ICMS, PIS, COFINS), acréscimos
                    (IPI, Frete, Perdas) e Custo Líquido.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    type="button"
                    onClick={() => setPdfModalOpen(true)}
                    variant="outline"
                    size="sm"
                    className="h-9 text-xs font-semibold border-blue-300 text-blue-900 bg-blue-50/50 hover:bg-blue-100/70"
                    title="Gerar Relatório A4 / PDF de Custos por Matéria-Prima com cabeçalho e assinaturas"
                  >
                    <Printer className="w-3.5 h-3.5 mr-1.5 text-blue-700" />
                    Relatório Custos (PDF/A4)
                  </Button>
                  <Button
                    type="button"
                    onClick={handleExportCsv}
                    variant="outline"
                    size="sm"
                    className="h-9 text-xs font-semibold border-slate-200 text-slate-700 hover:bg-slate-50"
                  >
                    <Download className="w-3.5 h-3.5 mr-1.5" />
                    Exportar CSV
                  </Button>
                  <Button
                    type="button"
                    onClick={handleOpenNew}
                    size="sm"
                    className="h-9 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1.5" />
                    Nova Matéria-Prima
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row items-center gap-3 mb-4">
                <div className="relative flex-1 w-full">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input
                    placeholder="Buscar por matéria-prima, código ou categoria..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 h-9 text-xs"
                  />
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap sm:flex-nowrap">
                  {/* Filtro por Tributação (Isenta/ST vs Tributada) */}
                  <select
                    value={tributacaoFilter}
                    onChange={(e) => setTributacaoFilter(e.target.value as any)}
                    className="h-9 text-xs bg-white border border-slate-200 rounded-md px-2.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-600 w-full sm:w-40"
                  >
                    <option value="todos">Todas as tributações</option>
                    <option value="tributada">Tributada (Com Crédito)</option>
                    <option value="isenta_st">Isenta / ST</option>
                  </select>

                  {/* Filtro por Status do Estoque */}
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                    className="h-9 text-xs bg-white border border-slate-200 rounded-md px-2.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-600 w-full sm:w-36"
                  >
                    <option value="todos">Todos os status</option>
                    <option value="critico">🔴 Crítico (Abaixo do Mín.)</option>
                    <option value="atencao">🟡 Atenção (Próximo)</option>
                    <option value="ok">🟢 OK (Suficiente)</option>
                  </select>

                  {categorias.length > 0 && (
                    <select
                      value={categoriaFilter}
                      onChange={(e) => setCategoriaFilter(e.target.value)}
                      className="h-9 text-xs bg-white border border-slate-200 rounded-md px-2.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-600 w-full sm:w-44"
                    >
                      <option value="todas">Todas as categorias</option>
                      {categorias.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {/* Tabela de Matérias-Primas */}
              {loading ? (
                <div className="py-16 flex justify-center items-center">
                  <div className="w-7 h-7 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : materiasFiltradas.length === 0 ? (
                <div className="py-16 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
                    <Layers className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-semibold text-slate-800">
                    Nenhuma matéria-prima encontrada
                  </h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    {materias.length === 0
                      ? 'Cadastre os insumos e matérias-primas com os percentuais de ICMS, PIS e COFINS.'
                      : 'Nenhum resultado para os filtros de busca aplicados.'}
                  </p>
                  {materias.length === 0 && (
                    <Button
                      onClick={handleOpenNew}
                      size="sm"
                      className="mt-4 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1.5" />
                      Cadastrar Primeira Matéria-Prima
                    </Button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/90 text-slate-700 font-semibold">
                        <th className="py-3 px-3 w-10 text-center">
                          <Checkbox
                            checked={allFilteredSelected}
                            onCheckedChange={handleSelectAll}
                            aria-label="Selecionar todas as matérias-primas"
                          />
                        </th>
                        <th className="py-3 px-3">Código</th>
                        <th className="py-3 px-3.5 min-w-[180px]">Matéria-Prima</th>
                        <th className="py-3 px-2.5 text-center">Unid.</th>
                        <th className="py-3 px-3 text-right">Custo Bruto</th>
                        <th className="py-3 px-2.5 text-right bg-blue-50/40 text-blue-900">
                          ICMS (-)
                        </th>
                        <th className="py-3 px-2.5 text-right bg-indigo-50/40 text-indigo-900">
                          PIS (-)
                        </th>
                        <th className="py-3 px-2.5 text-right bg-purple-50/40 text-purple-900">
                          COFINS (-)
                        </th>
                        <th className="py-3 px-2.5 text-right bg-orange-50/50 text-orange-900">
                          IPI (+)
                        </th>
                        <th className="py-3 px-2.5 text-right bg-cyan-50/50 text-cyan-900">
                          Frete (+)
                        </th>
                        <th className="py-3 px-2.5 text-right bg-rose-50/50 text-rose-900">
                          Perdas (+)
                        </th>
                        <th className="py-3 px-3 text-right bg-amber-50/50 text-amber-900">
                          Deduções / Acréscimos
                        </th>
                        <th className="py-3 px-3.5 text-right bg-emerald-50/70 text-emerald-950 font-bold">
                          Custo Líquido
                        </th>
                        <th className="py-3 px-2.5 text-right">Estoque</th>
                        <th className="py-3 px-3 text-right">Saldo Líquido</th>
                        <th className="py-3 px-2.5 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {materiasFiltradas.map((m) => {
                        const calc = calcularTributosMateriaPrima(
                          m.custo_unitario || 0,
                          m.icms_percentual || 0,
                          m.pis_percentual || 0,
                          m.cofins_percentual || 0,
                          m.isenta_st,
                          m.tipo_tributacao,
                          m.ipi_percentual || 0,
                          m.frete_percentual || 0,
                          m.perdas_percentual || 0,
                        )
                        const estoque = m.estoque_atual || 0
                        const saldoEstoqueLiquido = calc.custoLiquido * estoque
                        const st = getStatusEstoque(m)
                        const isSelected = selectedIds.includes(m.id)

                        return (
                          <tr
                            key={m.id}
                            className={`transition-colors ${
                              isSelected
                                ? 'bg-amber-50/50'
                                : st.status === 'critico'
                                  ? 'bg-rose-50/30 hover:bg-rose-50/60'
                                  : st.status === 'atencao'
                                    ? 'bg-amber-50/20 hover:bg-amber-50/50'
                                    : 'hover:bg-slate-50/70'
                            }`}
                          >
                            <td className="py-3 px-3 text-center">
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => handleToggleSelect(m.id)}
                                aria-label={`Selecionar matéria-prima ${m.nome}`}
                              />
                            </td>
                            <td className="py-3 px-3 font-mono font-semibold text-slate-600 whitespace-nowrap">
                              {m.codigo ? (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] font-mono bg-slate-50 text-slate-700"
                                >
                                  {m.codigo}
                                </Badge>
                              ) : (
                                <span className="text-slate-400 italic">—</span>
                              )}
                            </td>
                            <td className="py-3 px-3.5">
                              <div className="font-semibold text-slate-900">{m.nome}</div>
                              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                {m.categoria && (
                                  <Badge className="text-[9px] px-1.5 py-0 font-medium bg-amber-50 text-amber-800 border border-amber-200">
                                    {m.categoria}
                                  </Badge>
                                )}
                                {calc.isIsentaOuST ? (
                                  <Badge className="text-[9px] px-1.5 py-0 font-semibold bg-slate-100 text-slate-700 border border-slate-300">
                                    {m.tipo_tributacao === 'substituicao_tributaria'
                                      ? 'ST (Sem Crédito)'
                                      : 'Isenta (Sem Crédito)'}
                                  </Badge>
                                ) : (
                                  <Badge className="text-[9px] px-1.5 py-0 font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                    Tributada (Gera Crédito)
                                  </Badge>
                                )}
                                <Badge
                                  variant={st.badgeVariant}
                                  className={`text-[9px] px-1.5 py-0 ${st.badgeClass}`}
                                >
                                  {st.label}
                                </Badge>
                              </div>
                              {m.observacoes && (
                                <div className="text-[11px] text-slate-400 truncate max-w-xs mt-0.5">
                                  {m.observacoes}
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-2.5 text-center whitespace-nowrap">
                              <span className="inline-block px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-semibold">
                                {m.unidade}
                              </span>
                            </td>
                            {/* Custo Unitário Bruto */}
                            <td className="py-3 px-3 text-right font-medium text-slate-700 whitespace-nowrap font-mono">
                              {formatBrl(calc.custoBruto)}
                            </td>
                            {/* ICMS */}
                            <td className="py-3 px-2.5 text-right whitespace-nowrap bg-blue-50/20">
                              <div className="text-blue-900 font-semibold font-mono">
                                -{formatBrl(calc.creditoIcms)}
                              </div>
                              <div className="text-[10px] text-blue-600 font-mono">
                                {calc.icmsPercentual > 0
                                  ? `${calc.icmsPercentual.toFixed(2)}%`
                                  : '0%'}
                              </div>
                            </td>
                            {/* PIS */}
                            <td className="py-3 px-2.5 text-right whitespace-nowrap bg-indigo-50/20">
                              <div className="text-indigo-900 font-semibold font-mono">
                                -{formatBrl(calc.creditoPis)}
                              </div>
                              <div className="text-[10px] text-indigo-600 font-mono">
                                {calc.pisPercentual > 0
                                  ? `${calc.pisPercentual.toFixed(2)}%`
                                  : '0%'}
                              </div>
                            </td>
                            {/* COFINS */}
                            <td className="py-3 px-2.5 text-right whitespace-nowrap bg-purple-50/20">
                              <div className="text-purple-900 font-semibold font-mono">
                                -{formatBrl(calc.creditoCofins)}
                              </div>
                              <div className="text-[10px] text-purple-600 font-mono">
                                {calc.cofinsPercentual > 0
                                  ? `${calc.cofinsPercentual.toFixed(2)}%`
                                  : '0%'}
                              </div>
                            </td>
                            {/* IPI */}
                            <td className="py-3 px-2.5 text-right whitespace-nowrap bg-orange-50/20">
                              <div className="text-orange-900 font-semibold font-mono">
                                +{formatBrl(calc.valorIpi)}
                              </div>
                              <div className="text-[10px] text-orange-600 font-mono">
                                {calc.ipiPercentual > 0
                                  ? `${calc.ipiPercentual.toFixed(2)}%`
                                  : '0%'}
                              </div>
                            </td>
                            {/* Frete */}
                            <td className="py-3 px-2.5 text-right whitespace-nowrap bg-cyan-50/20">
                              <div className="text-cyan-900 font-semibold font-mono">
                                +{formatBrl(calc.valorFrete)}
                              </div>
                              <div className="text-[10px] text-cyan-600 font-mono">
                                {calc.fretePercentual > 0
                                  ? `${calc.fretePercentual.toFixed(2)}%`
                                  : '0%'}
                              </div>
                            </td>
                            {/* Perdas */}
                            <td className="py-3 px-2.5 text-right whitespace-nowrap bg-rose-50/20">
                              <div className="text-rose-900 font-semibold font-mono">
                                +{formatBrl(calc.valorPerdas)}
                              </div>
                              <div className="text-[10px] text-rose-600 font-mono">
                                {calc.perdasPercentual > 0
                                  ? `${calc.perdasPercentual.toFixed(2)}%`
                                  : '0%'}
                              </div>
                            </td>
                            {/* Total Deduções e Acréscimos */}
                            <td className="py-3 px-3 text-right whitespace-nowrap bg-amber-50/30">
                              <div className="text-[11px] font-mono">
                                <span className="text-blue-900 font-semibold">
                                  -{formatBrl(calc.totalCreditos)}
                                </span>
                                <span className="text-slate-400 mx-1">/</span>
                                <span className="text-amber-900 font-semibold">
                                  +{formatBrl(calc.totalAcrescimos)}
                                </span>
                              </div>
                              <div className="text-[10px] text-slate-500 font-mono">
                                Líq: {calc.totalAcrescimos >= calc.totalCreditos ? '+' : ''}
                                {formatBrl(calc.totalAcrescimos - calc.totalCreditos)}
                              </div>
                            </td>
                            {/* Custo Unitário Líquido */}
                            <td className="py-3 px-3.5 text-right whitespace-nowrap bg-emerald-50/50">
                              <div className="text-emerald-900 font-extrabold font-mono text-[13px]">
                                {formatBrl(calc.custoLiquido)}
                              </div>
                              <div className="text-[10px] text-emerald-700 font-semibold">
                                Líquido
                              </div>
                            </td>
                            {/* Estoque */}
                            <td className="py-3 px-2.5 text-right whitespace-nowrap font-mono">
                              {m.estoque_atual !== undefined && m.estoque_atual !== null ? (
                                <span
                                  className={`font-semibold ${
                                    st.status === 'critico'
                                      ? 'text-rose-700 font-bold'
                                      : st.status === 'atencao'
                                        ? 'text-amber-700'
                                        : 'text-slate-700'
                                  }`}
                                >
                                  {formatQty(m.estoque_atual, m.unidade)}
                                </span>
                              ) : (
                                <span className="text-slate-400 italic">—</span>
                              )}
                            </td>
                            {/* Saldo Líquido do Estoque */}
                            <td className="py-3 px-3 text-right font-bold text-slate-800 whitespace-nowrap font-mono">
                              {formatBrl(saldoEstoqueLiquido)}
                            </td>
                            {/* Ações */}
                            <td className="py-3 px-2.5 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1">
                                {empresas.length > 1 && (
                                  <Button
                                    onClick={() => handleOpenTransferir(m)}
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 w-7 p-0 text-slate-500 hover:text-amber-600 hover:bg-amber-50"
                                    title="Mover/Transferir para outra empresa"
                                  >
                                    <ArrowRightLeft className="w-3.5 h-3.5" />
                                  </Button>
                                )}
                                <Button
                                  onClick={() => handleOpenEdit(m)}
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0 text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                                  title="Editar matéria-prima"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  onClick={() => confirmDelete(m)}
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0 text-slate-500 hover:text-red-600 hover:bg-red-50"
                                  title="Excluir matéria-prima"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-slate-300 bg-slate-50 font-bold text-slate-900">
                        <td colSpan={4} className="py-3 px-3 uppercase text-xs">
                          Totais ({materiasFiltradas.length} itens)
                        </td>{' '}
                        <td className="py-3 px-3 text-right font-mono text-slate-700">
                          {formatBrl(
                            materiasFiltradas.reduce(
                              (acc, m) => acc + (Number(m.custo_unitario) || 0),
                              0,
                            ),
                          )}
                        </td>
                        <td className="py-3 px-2.5 text-right font-mono text-blue-900 bg-blue-50/40">
                          -
                          {formatBrl(
                            materiasFiltradas.reduce((acc, m) => {
                              const c = calcularTributosMateriaPrima(
                                m.custo_unitario || 0,
                                m.icms_percentual || 0,
                                m.pis_percentual || 0,
                                m.cofins_percentual || 0,
                                m.isenta_st,
                                m.tipo_tributacao,
                                m.ipi_percentual || 0,
                                m.frete_percentual || 0,
                                m.perdas_percentual || 0,
                              )
                              return acc + c.creditoIcms
                            }, 0),
                          )}
                        </td>
                        <td className="py-3 px-2.5 text-right font-mono text-indigo-900 bg-indigo-50/40">
                          -
                          {formatBrl(
                            materiasFiltradas.reduce((acc, m) => {
                              const c = calcularTributosMateriaPrima(
                                m.custo_unitario || 0,
                                m.icms_percentual || 0,
                                m.pis_percentual || 0,
                                m.cofins_percentual || 0,
                                m.isenta_st,
                                m.tipo_tributacao,
                                m.ipi_percentual || 0,
                                m.frete_percentual || 0,
                                m.perdas_percentual || 0,
                              )
                              return acc + c.creditoPis
                            }, 0),
                          )}
                        </td>
                        <td className="py-3 px-2.5 text-right font-mono text-purple-900 bg-purple-50/40">
                          -
                          {formatBrl(
                            materiasFiltradas.reduce((acc, m) => {
                              const c = calcularTributosMateriaPrima(
                                m.custo_unitario || 0,
                                m.icms_percentual || 0,
                                m.pis_percentual || 0,
                                m.cofins_percentual || 0,
                                m.isenta_st,
                                m.tipo_tributacao,
                                m.ipi_percentual || 0,
                                m.frete_percentual || 0,
                                m.perdas_percentual || 0,
                              )
                              return acc + c.creditoCofins
                            }, 0),
                          )}
                        </td>
                        <td className="py-3 px-2.5 text-right font-mono text-orange-900 bg-orange-50/40">
                          +
                          {formatBrl(
                            materiasFiltradas.reduce((acc, m) => {
                              const c = calcularTributosMateriaPrima(
                                m.custo_unitario || 0,
                                m.icms_percentual || 0,
                                m.pis_percentual || 0,
                                m.cofins_percentual || 0,
                                m.isenta_st,
                                m.tipo_tributacao,
                                m.ipi_percentual || 0,
                                m.frete_percentual || 0,
                                m.perdas_percentual || 0,
                              )
                              return acc + c.valorIpi
                            }, 0),
                          )}
                        </td>
                        <td className="py-3 px-2.5 text-right font-mono text-cyan-900 bg-cyan-50/40">
                          +
                          {formatBrl(
                            materiasFiltradas.reduce((acc, m) => {
                              const c = calcularTributosMateriaPrima(
                                m.custo_unitario || 0,
                                m.icms_percentual || 0,
                                m.pis_percentual || 0,
                                m.cofins_percentual || 0,
                                m.isenta_st,
                                m.tipo_tributacao,
                                m.ipi_percentual || 0,
                                m.frete_percentual || 0,
                                m.perdas_percentual || 0,
                              )
                              return acc + c.valorFrete
                            }, 0),
                          )}
                        </td>
                        <td className="py-3 px-2.5 text-right font-mono text-rose-900 bg-rose-50/40">
                          +
                          {formatBrl(
                            materiasFiltradas.reduce((acc, m) => {
                              const c = calcularTributosMateriaPrima(
                                m.custo_unitario || 0,
                                m.icms_percentual || 0,
                                m.pis_percentual || 0,
                                m.cofins_percentual || 0,
                                m.isenta_st,
                                m.tipo_tributacao,
                                m.ipi_percentual || 0,
                                m.frete_percentual || 0,
                                m.perdas_percentual || 0,
                              )
                              return acc + c.valorPerdas
                            }, 0),
                          )}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-amber-900 bg-amber-50/50">
                          +
                          {formatBrl(
                            materiasFiltradas.reduce((acc, m) => {
                              const c = calcularTributosMateriaPrima(
                                m.custo_unitario || 0,
                                m.icms_percentual || 0,
                                m.pis_percentual || 0,
                                m.cofins_percentual || 0,
                                m.isenta_st,
                                m.tipo_tributacao,
                                m.ipi_percentual || 0,
                                m.frete_percentual || 0,
                                m.perdas_percentual || 0,
                              )
                              return acc + c.totalAcrescimos
                            }, 0),
                          )}
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono text-emerald-950 font-black bg-emerald-50/70">
                          {formatBrl(
                            materiasFiltradas.reduce((acc, m) => {
                              const c = calcularTributosMateriaPrima(
                                m.custo_unitario || 0,
                                m.icms_percentual || 0,
                                m.pis_percentual || 0,
                                m.cofins_percentual || 0,
                                m.isenta_st,
                                m.tipo_tributacao,
                                m.ipi_percentual || 0,
                                m.frete_percentual || 0,
                                m.perdas_percentual || 0,
                              )
                              return acc + c.custoLiquido
                            }, 0),
                          )}
                        </td>
                        <td className="py-3 px-2.5 text-right font-mono text-slate-600">—</td>
                        <td className="py-3 px-3 text-right font-mono text-slate-900">
                          {formatBrl(
                            materiasFiltradas.reduce((acc, m) => {
                              const c = calcularTributosMateriaPrima(
                                m.custo_unitario || 0,
                                m.icms_percentual || 0,
                                m.pis_percentual || 0,
                                m.cofins_percentual || 0,
                                m.isenta_st,
                                m.tipo_tributacao,
                                m.ipi_percentual || 0,
                                m.frete_percentual || 0,
                                m.perdas_percentual || 0,
                              )
                              return acc + c.custoLiquido * (Number(m.estoque_atual) || 0)
                            }, 0),
                          )}
                        </td>
                        <td className="py-3 px-2.5 text-slate-400 text-right">—</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Modal Cadastro/Edição de Matéria-Prima com Cálculo de Tributos e Dedução */}
          <Dialog open={modalOpen} onOpenChange={setModalOpen}>
            <DialogContent className="sm:max-w-[620px] bg-white max-h-[92vh] overflow-y-auto">
              <form onSubmit={handleSave}>
                <DialogHeader>
                  <DialogTitle className="text-base font-bold text-[#0B1F3A] flex items-center gap-2">
                    <Layers className="w-4 h-4 text-amber-600" />
                    {editingMP ? 'Editar Matéria-Prima' : 'Nova Matéria-Prima'}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-slate-500">
                    Cadastre o custo unitário bruto e os percentuais de ICMS, PIS e COFINS para
                    obter o Custo Unitário Líquido.
                  </DialogDescription>
                </DialogHeader>

                {errors.general && (
                  <Alert
                    variant="destructive"
                    className="mt-4 bg-red-50 border-red-200 text-red-800 py-2"
                  >
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    <AlertDescription className="text-xs font-medium">
                      {errors.general}
                    </AlertDescription>
                  </Alert>
                )}

                <div className="space-y-4 py-4">
                  {/* Seletor de Empresa no Modal */}
                  <div className="space-y-1.5 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    <Label
                      htmlFor="mp-empresa"
                      className="text-xs font-semibold text-slate-700 flex items-center gap-1.5"
                    >
                      <Building2 className="w-3.5 h-3.5 text-blue-600" />
                      Empresa Cliente *
                    </Label>
                    <select
                      id="mp-empresa"
                      value={formData.empresa}
                      onChange={(e) => setField('empresa', e.target.value)}
                      className="w-full h-9 text-xs bg-white border border-slate-300 rounded-md px-2.5 text-slate-800 font-medium focus:ring-1 focus:ring-blue-600 focus:outline-none"
                      required
                    >
                      <option value="" disabled>
                        Selecione a empresa...
                      </option>
                      {empresas.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.nome} {emp.cnpj ? `(${emp.cnpj})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Seção 1: Identificação */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="mp-codigo" className="text-xs font-semibold text-slate-700">
                        Código
                      </Label>
                      <Input
                        id="mp-codigo"
                        placeholder="Ex: MP-001"
                        value={formData.codigo}
                        onChange={(e) => setField('codigo', e.target.value)}
                        className="h-9 text-xs uppercase font-mono"
                      />
                    </div>

                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="mp-nome" className="text-xs font-semibold text-slate-700">
                        Nome da Matéria-Prima *
                      </Label>
                      <Input
                        id="mp-nome"
                        placeholder="Ex: Chapa de Aço Inox 2mm"
                        value={formData.nome}
                        onChange={(e) => setField('nome', e.target.value)}
                        className={`h-9 text-xs ${errors.nome ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                      />
                      {errors.nome && (
                        <p className="text-[11px] text-red-600 font-medium">{errors.nome}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="mp-unidade" className="text-xs font-semibold text-slate-700">
                        Unidade de Medida *
                      </Label>
                      <Input
                        id="mp-unidade"
                        placeholder="KG, UN, M, L, M2, G"
                        value={formData.unidade}
                        onChange={(e) => setField('unidade', e.target.value)}
                        className={`h-9 text-xs uppercase ${errors.unidade ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                      />
                      {errors.unidade && (
                        <p className="text-[11px] text-red-600 font-medium">{errors.unidade}</p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label
                        htmlFor="mp-categoria"
                        className="text-xs font-semibold text-slate-700"
                      >
                        Categoria
                      </Label>
                      <Input
                        id="mp-categoria"
                        placeholder="Ex: Metais, Embalagem, Tintas"
                        value={formData.categoria}
                        onChange={(e) => setField('categoria', e.target.value)}
                        className="h-9 text-xs"
                      />
                    </div>
                  </div>

                  {/* Seção 2: Custo Bruto, Toggle Isenta/ST, Deduções e Acréscimos (IPI, Frete, Perdas) */}
                  <div className="p-3.5 rounded-lg border border-blue-200 bg-blue-50/40 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-blue-200/70 pb-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-blue-900">
                        <Receipt className="w-4 h-4 text-blue-700" />
                        Custos, Deduções Fiscais & Acréscimos Operacionais
                      </div>
                      <span className="text-[10px] text-blue-700 font-semibold bg-white px-2 py-0.5 rounded border border-blue-200">
                        Todos calculados sobre Custo Bruto
                      </span>
                    </div>

                    {/* Custo Unitário Bruto */}
                    <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                      <Label
                        htmlFor="mp-custo"
                        className="text-xs font-bold text-slate-900 flex items-center gap-1"
                      >
                        Custo Unitário Bruto (R$) *
                      </Label>
                      <Input
                        id="mp-custo"
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.01"
                        placeholder="0,00"
                        value={formData.custo_unitario}
                        onChange={(e) => setField('custo_unitario', e.target.value)}
                        className={`h-9 text-xs font-mono bg-white font-semibold mt-1 ${errors.custo_unitario ? 'border-red-500' : ''}`}
                      />
                      {errors.custo_unitario && (
                        <p className="text-[10px] text-red-600 font-medium mt-0.5">
                          {errors.custo_unitario}
                        </p>
                      )}
                    </div>

                    {/* Bloco de Deduções: ICMS, PIS, COFINS */}
                    <div className="p-2.5 bg-white rounded-lg border border-blue-100 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-blue-900 flex items-center gap-1">
                          1. Créditos Tributários (Deduções −)
                        </span>
                        <span className="text-[10px] text-slate-500">Subtraem do custo</span>
                      </div>

                      {/* Toggle / Regime Especial: Isenta ou Substituição Tributária (ST) */}
                      <div className="p-2 bg-slate-50 rounded border border-slate-200 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div>
                            <Label
                              htmlFor="toggle-isenta-st"
                              className="text-[11px] font-bold text-slate-800 cursor-pointer block"
                            >
                              Matéria-Prima Isenta ou Substituição Tributária (ST)
                            </Label>
                            <p className="text-[10px] text-slate-500">
                              Se marcada, zera os créditos de ICMS/PIS/COFINS.
                            </p>
                          </div>
                          <input
                            id="toggle-isenta-st"
                            type="checkbox"
                            checked={formData.isenta_st}
                            onChange={(e) => {
                              const checked = e.target.checked
                              setFormData((prev) => ({
                                ...prev,
                                isenta_st: checked,
                                tipo_tributacao: checked
                                  ? prev.tipo_tributacao === 'tributada'
                                    ? 'isenta'
                                    : prev.tipo_tributacao
                                  : 'tributada',
                                icms_percentual: checked ? '0' : prev.icms_percentual,
                                pis_percentual: checked ? '0' : prev.pis_percentual,
                                cofins_percentual: checked ? '0' : prev.cofins_percentual,
                              }))
                            }}
                            className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                          />
                        </div>

                        {formData.isenta_st && (
                          <div className="pt-1.5 border-t border-slate-200 flex items-center gap-3">
                            <Label className="text-[10px] font-semibold text-slate-700">
                              Enquadramento:
                            </Label>
                            <div className="flex items-center gap-3 text-[11px]">
                              <label className="inline-flex items-center gap-1 cursor-pointer">
                                <input
                                  type="radio"
                                  name="tipo_tributacao_radio"
                                  value="isenta"
                                  checked={formData.tipo_tributacao === 'isenta'}
                                  onChange={() =>
                                    setFormData((prev) => ({
                                      ...prev,
                                      tipo_tributacao: 'isenta',
                                    }))
                                  }
                                  className="text-blue-600"
                                />
                                <span>Isenta / Não Trib.</span>
                              </label>
                              <label className="inline-flex items-center gap-1 cursor-pointer">
                                <input
                                  type="radio"
                                  name="tipo_tributacao_radio"
                                  value="substituicao_tributaria"
                                  checked={formData.tipo_tributacao === 'substituicao_tributaria'}
                                  onChange={() =>
                                    setFormData((prev) => ({
                                      ...prev,
                                      tipo_tributacao: 'substituicao_tributaria',
                                    }))
                                  }
                                  className="text-blue-600"
                                />
                                <span>Subst. Tributária (ST)</span>
                              </label>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div className="space-y-1">
                          <Label
                            htmlFor="mp-icms"
                            className="text-[11px] font-semibold text-blue-900"
                          >
                            ICMS (%) {formData.isenta_st && '(Zerado)'}
                          </Label>
                          <Input
                            id="mp-icms"
                            type="number"
                            inputMode="decimal"
                            min="0"
                            max="100"
                            step="0.01"
                            placeholder="Ex: 18.00"
                            disabled={formData.isenta_st}
                            value={formData.isenta_st ? '0' : formData.icms_percentual}
                            onChange={(e) => setField('icms_percentual', e.target.value)}
                            className={`h-8 text-xs font-mono ${formData.isenta_st ? 'bg-slate-100 text-slate-400' : 'bg-white'} ${errors.icms_percentual ? 'border-red-500' : ''}`}
                          />
                          {errors.icms_percentual && (
                            <p className="text-[10px] text-red-600 font-medium">
                              {errors.icms_percentual}
                            </p>
                          )}
                        </div>

                        <div className="space-y-1">
                          <Label
                            htmlFor="mp-pis"
                            className="text-[11px] font-semibold text-indigo-900"
                          >
                            PIS (%) {formData.isenta_st && '(Zerado)'}
                          </Label>
                          <Input
                            id="mp-pis"
                            type="number"
                            inputMode="decimal"
                            min="0"
                            max="100"
                            step="0.01"
                            placeholder="Ex: 1.65"
                            disabled={formData.isenta_st}
                            value={formData.isenta_st ? '0' : formData.pis_percentual}
                            onChange={(e) => setField('pis_percentual', e.target.value)}
                            className={`h-8 text-xs font-mono ${formData.isenta_st ? 'bg-slate-100 text-slate-400' : 'bg-white'} ${errors.pis_percentual ? 'border-red-500' : ''}`}
                          />
                          {errors.pis_percentual && (
                            <p className="text-[10px] text-red-600 font-medium">
                              {errors.pis_percentual}
                            </p>
                          )}
                        </div>

                        <div className="space-y-1">
                          <Label
                            htmlFor="mp-cofins"
                            className="text-[11px] font-semibold text-purple-900"
                          >
                            COFINS (%) {formData.isenta_st && '(Zerado)'}
                          </Label>
                          <Input
                            id="mp-cofins"
                            type="number"
                            inputMode="decimal"
                            min="0"
                            max="100"
                            step="0.01"
                            placeholder="Ex: 7.60"
                            disabled={formData.isenta_st}
                            value={formData.isenta_st ? '0' : formData.cofins_percentual}
                            onChange={(e) => setField('cofins_percentual', e.target.value)}
                            className={`h-8 text-xs font-mono ${formData.isenta_st ? 'bg-slate-100 text-slate-400' : 'bg-white'} ${errors.cofins_percentual ? 'border-red-500' : ''}`}
                          />
                          {errors.cofins_percentual && (
                            <p className="text-[10px] text-red-600 font-medium">
                              {errors.cofins_percentual}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Bloco de Acréscimos: IPI, Frete, Perdas */}
                    <div className="p-2.5 bg-white rounded-lg border border-amber-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-amber-900 flex items-center gap-1">
                          2. Acréscimos Operacionais (IPI, Frete, Perdas +)
                        </span>
                        <span className="text-[10px] text-slate-500">
                          Somam ao custo líquido (base: Custo Bruto)
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div className="space-y-1">
                          <Label
                            htmlFor="mp-ipi"
                            className="text-[11px] font-semibold text-orange-900"
                          >
                            IPI (%)
                          </Label>
                          <Input
                            id="mp-ipi"
                            type="number"
                            inputMode="decimal"
                            min="0"
                            max="100"
                            step="0.01"
                            placeholder="Ex: 5.00"
                            value={formData.ipi_percentual}
                            onChange={(e) => setField('ipi_percentual', e.target.value)}
                            className={`h-8 text-xs font-mono bg-white ${errors.ipi_percentual ? 'border-red-500' : ''}`}
                          />
                          {errors.ipi_percentual && (
                            <p className="text-[10px] text-red-600 font-medium">
                              {errors.ipi_percentual}
                            </p>
                          )}
                        </div>

                        <div className="space-y-1">
                          <Label
                            htmlFor="mp-frete"
                            className="text-[11px] font-semibold text-cyan-900"
                          >
                            Frete (%)
                          </Label>
                          <Input
                            id="mp-frete"
                            type="number"
                            inputMode="decimal"
                            min="0"
                            max="100"
                            step="0.01"
                            placeholder="Ex: 3.50"
                            value={formData.frete_percentual}
                            onChange={(e) => setField('frete_percentual', e.target.value)}
                            className={`h-8 text-xs font-mono bg-white ${errors.frete_percentual ? 'border-red-500' : ''}`}
                          />
                          {errors.frete_percentual && (
                            <p className="text-[10px] text-red-600 font-medium">
                              {errors.frete_percentual}
                            </p>
                          )}
                        </div>

                        <div className="space-y-1">
                          <Label
                            htmlFor="mp-perdas"
                            className="text-[11px] font-semibold text-rose-900"
                          >
                            Perdas (%)
                          </Label>
                          <Input
                            id="mp-perdas"
                            type="number"
                            inputMode="decimal"
                            min="0"
                            max="100"
                            step="0.01"
                            placeholder="Ex: 2.00"
                            value={formData.perdas_percentual}
                            onChange={(e) => setField('perdas_percentual', e.target.value)}
                            className={`h-8 text-xs font-mono bg-white ${errors.perdas_percentual ? 'border-red-500' : ''}`}
                          />
                          {errors.perdas_percentual && (
                            <p className="text-[10px] text-red-600 font-medium">
                              {errors.perdas_percentual}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Demonstrativo em tempo real do cálculo dos tributos, acréscimos e custo líquido */}
                    <div className="p-3 bg-white rounded-lg border border-blue-200/80 space-y-2">
                      <div className="text-[11px] font-bold text-slate-800 flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <Calculator className="w-3.5 h-3.5 text-blue-600" />
                          Memória de Cálculo Completa
                        </span>
                        <span className="text-[10px] font-semibold text-slate-500">
                          Base = {formatBrl(formCalculos.custoBruto)}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs pt-1 border-t border-slate-100">
                        <div className="p-2 bg-blue-50/50 rounded border border-blue-100">
                          <div className="text-[10px] text-blue-700 font-semibold">
                            ICMS ({formCalculos.icmsPercentual.toFixed(2)}%)
                          </div>
                          <div className="font-mono font-bold text-blue-900">
                            -{formatBrl(formCalculos.creditoIcms)}
                          </div>
                        </div>

                        <div className="p-2 bg-indigo-50/50 rounded border border-indigo-100">
                          <div className="text-[10px] text-indigo-700 font-semibold">
                            PIS ({formCalculos.pisPercentual.toFixed(2)}%)
                          </div>
                          <div className="font-mono font-bold text-indigo-900">
                            -{formatBrl(formCalculos.creditoPis)}
                          </div>
                        </div>

                        <div className="p-2 bg-purple-50/50 rounded border border-purple-100">
                          <div className="text-[10px] text-purple-700 font-semibold">
                            COFINS ({formCalculos.cofinsPercentual.toFixed(2)}%)
                          </div>
                          <div className="font-mono font-bold text-purple-900">
                            -{formatBrl(formCalculos.creditoCofins)}
                          </div>
                        </div>

                        <div className="p-2 bg-orange-50/50 rounded border border-orange-100">
                          <div className="text-[10px] text-orange-700 font-semibold">
                            IPI ({formCalculos.ipiPercentual.toFixed(2)}%)
                          </div>
                          <div className="font-mono font-bold text-orange-900">
                            +{formatBrl(formCalculos.valorIpi)}
                          </div>
                        </div>

                        <div className="p-2 bg-cyan-50/50 rounded border border-cyan-100">
                          <div className="text-[10px] text-cyan-700 font-semibold">
                            Frete ({formCalculos.fretePercentual.toFixed(2)}%)
                          </div>
                          <div className="font-mono font-bold text-cyan-900">
                            +{formatBrl(formCalculos.valorFrete)}
                          </div>
                        </div>

                        <div className="p-2 bg-rose-50/50 rounded border border-rose-100">
                          <div className="text-[10px] text-rose-700 font-semibold">
                            Perdas ({formCalculos.perdasPercentual.toFixed(2)}%)
                          </div>
                          <div className="font-mono font-bold text-rose-900">
                            +{formatBrl(formCalculos.valorPerdas)}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1">
                        <div className="p-1.5 bg-blue-50/80 rounded border border-blue-200 text-blue-900 flex justify-between">
                          <span>Total Deduções (Créditos):</span>
                          <strong className="font-mono">
                            -{formatBrl(formCalculos.totalCreditos)}
                          </strong>
                        </div>
                        <div className="p-1.5 bg-amber-50/80 rounded border border-amber-200 text-amber-900 flex justify-between">
                          <span>Total Acréscimos:</span>
                          <strong className="font-mono">
                            +{formatBrl(formCalculos.totalAcrescimos)}
                          </strong>
                        </div>
                      </div>

                      <div className="p-2.5 bg-gradient-to-r from-emerald-500/10 via-emerald-50 to-teal-50 rounded-lg border border-emerald-300 flex items-center justify-between mt-2">
                        <div>
                          <div className="text-[11px] font-bold text-emerald-950 flex items-center gap-1">
                            <ArrowDownRight className="w-3.5 h-3.5 text-emerald-700" />
                            Custo Unitário Líquido (Base para Ficha Técnica)
                          </div>
                          <div className="text-[10px] text-emerald-800">
                            <span>
                              {formatBrl(formCalculos.custoBruto)} −{' '}
                              {formatBrl(formCalculos.totalCreditos)} +{' '}
                              {formatBrl(formCalculos.totalAcrescimos)}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-black text-emerald-900 font-mono">
                            {formatBrl(formCalculos.custoLiquido)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Seção 3: Estoques */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="mp-estoque" className="text-xs font-semibold text-slate-700">
                        Estoque Atual (Qtd)
                      </Label>
                      <Input
                        id="mp-estoque"
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.01"
                        placeholder="0"
                        value={formData.estoque_atual}
                        onChange={(e) => setField('estoque_atual', e.target.value)}
                        className={`h-9 text-xs font-mono ${errors.estoque_atual ? 'border-red-500' : ''}`}
                      />
                      {errors.estoque_atual && (
                        <p className="text-[11px] text-red-600 font-medium">
                          {errors.estoque_atual}
                        </p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label
                        htmlFor="mp-estoque-min"
                        className="text-xs font-semibold text-slate-700"
                      >
                        Estoque Mínimo (Qtd)
                      </Label>
                      <Input
                        id="mp-estoque-min"
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.01"
                        placeholder="0"
                        value={formData.estoque_minimo}
                        onChange={(e) => setField('estoque_minimo', e.target.value)}
                        className={`h-9 text-xs font-mono ${errors.estoque_minimo ? 'border-red-500' : ''}`}
                      />
                      {errors.estoque_minimo && (
                        <p className="text-[11px] text-red-600 font-medium">
                          {errors.estoque_minimo}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Seção 4: Observações */}
                  <div className="space-y-1.5">
                    <Label htmlFor="mp-obs" className="text-xs font-semibold text-slate-700">
                      Observações / Dados do Fornecedor
                    </Label>
                    <Textarea
                      id="mp-obs"
                      placeholder="Informações do fornecedor, espessura, código de barras etc."
                      value={formData.observacoes}
                      onChange={(e) => setField('observacoes', e.target.value)}
                      className="min-h-[60px] text-xs resize-y"
                    />
                  </div>
                </div>

                <DialogFooter className="gap-2 sm:gap-0 border-t border-slate-100 pt-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setModalOpen(false)}
                    disabled={saving}
                    className="text-xs h-9"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={saving}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-9 shadow-xs"
                  >
                    {saving
                      ? 'Salvando...'
                      : editingMP
                        ? 'Salvar Alterações'
                        : 'Cadastrar Matéria-Prima'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          {/* Confirmação de Exclusão */}
          <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <AlertDialogContent className="bg-white">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-base font-bold text-red-600 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" /> Excluir Matéria-Prima?
                </AlertDialogTitle>
                <AlertDialogDescription className="text-xs text-slate-600">
                  Tem certeza que deseja excluir{' '}
                  <strong className="text-slate-900">"{mpToDelete?.nome}"</strong>? Esta ação não
                  pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deleting} className="text-xs h-9">
                  Cancelar
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  disabled={deleting}
                  className="bg-red-600 hover:bg-red-700 text-white font-semibold text-xs h-9"
                >
                  {deleting ? 'Excluindo...' : 'Sim, Excluir'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Modal Mover / Transferir Matéria-Prima de Empresa */}
          <Dialog open={transferirModalOpen} onOpenChange={setTransferirModalOpen}>
            <DialogContent className="sm:max-w-[480px] bg-white">
              <DialogHeader>
                <DialogTitle className="text-base font-bold text-[#0B1F3A] flex items-center gap-2">
                  <ArrowRightLeft className="w-4 h-4 text-amber-600" />
                  Transferir Matéria-Prima de Empresa
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Mova o insumo para o catálogo de outra empresa cadastrada.
                </DialogDescription>
              </DialogHeader>

              {mpParaTransferir && (
                <div className="space-y-4 py-3">
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Insumo:</span>
                      <span className="font-bold text-slate-900">{mpParaTransferir.nome}</span>
                    </div>
                    {mpParaTransferir.codigo && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Código:</span>
                        <span className="font-mono text-slate-700">{mpParaTransferir.codigo}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-slate-500">Empresa de Origem:</span>
                      <span className="font-semibold text-slate-700">
                        {empresas.find((e) => e.id === mpParaTransferir.empresa)?.nome ||
                          selectedEmpresa?.nome ||
                          'Empresa Atual'}
                      </span>
                    </div>
                  </div>

                  {/* Verificação de Integridade com Fichas Técnicas */}
                  {verificandoFichas ? (
                    <div className="p-3 bg-slate-50 rounded-lg text-xs text-slate-500 flex items-center gap-2">
                      <div className="w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      Verificando fichas técnicas vinculadas...
                    </div>
                  ) : fichasAfetadas.length > 0 ? (
                    <div className="p-3 bg-amber-50 rounded-lg border border-amber-300 text-xs text-amber-900 space-y-2">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold">
                            Atenção à Integridade: Este insumo é usado em {fichasAfetadas.length}{' '}
                            {fichasAfetadas.length === 1 ? 'ficha técnica' : 'fichas técnicas'}:
                          </p>
                          <ul className="list-disc list-inside mt-1 text-[11px] text-amber-800 space-y-0.5">
                            {fichasAfetadas.slice(0, 4).map((f) => (
                              <li key={f.id}>
                                {f.expand?.produto?.nome || 'Ficha Técnica'} (Empresa:{' '}
                                {f.expand?.empresa?.nome ||
                                  f.expand?.produto?.expand?.empresa?.nome ||
                                  'Origem'}
                                )
                              </li>
                            ))}
                            {fichasAfetadas.length > 4 && (
                              <li>... e mais {fichasAfetadas.length - 4} fichas</li>
                            )}
                          </ul>
                        </div>
                      </div>
                      <p className="text-[11px] text-amber-800 border-t border-amber-200 pt-1.5">
                        💡 <strong>Integridade preservada:</strong> Os dados históricos das fichas
                        atuais permanecerão intactos, mas a matéria-prima passará a ser listada para
                        a nova empresa de destino.
                      </p>
                    </div>
                  ) : (
                    <div className="p-2.5 bg-emerald-50 rounded-lg border border-emerald-200 text-xs text-emerald-800 flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                      Nenhuma ficha técnica vinculada no momento. Transferência 100% livre.
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label
                      htmlFor="empresa-destino-mp"
                      className="text-xs font-semibold text-slate-700 flex items-center gap-1.5"
                    >
                      <Building2 className="w-3.5 h-3.5 text-blue-600" />
                      Selecione a Empresa de Destino *
                    </Label>
                    <select
                      id="empresa-destino-mp"
                      value={empresaDestinoId}
                      onChange={(e) => setEmpresaDestinoId(e.target.value)}
                      className="w-full h-9 text-xs bg-white border border-slate-300 rounded-md px-2.5 text-slate-800 font-medium focus:ring-2 focus:ring-blue-600 focus:outline-none"
                    >
                      <option value="" disabled>
                        Selecione o destino...
                      </option>
                      {empresas
                        .filter((emp) => emp.id !== mpParaTransferir.empresa)
                        .map((emp) => (
                          <option key={emp.id} value={emp.id}>
                            {emp.nome} {emp.cnpj ? `(${emp.cnpj})` : ''} - {emp.segmento || 'Geral'}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
              )}

              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setTransferirModalOpen(false)}
                  disabled={transferindo}
                  className="text-xs h-9"
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={handleConfirmarTransferencia}
                  disabled={transferindo || !empresaDestinoId}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs h-9 shadow-xs"
                >
                  {transferindo ? 'Transferindo...' : 'Confirmar Transferência'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Modal Transferência em Lote de Matérias-Primas */}
          <Dialog open={transferirLoteModalOpen} onOpenChange={setTransferirLoteModalOpen}>
            <DialogContent className="sm:max-w-[500px] bg-white">
              <DialogHeader>
                <DialogTitle className="text-base font-bold text-[#0B1F3A] flex items-center gap-2">
                  <ArrowRightLeft className="w-4 h-4 text-amber-600" />
                  Transferir {selectedIds.length} Matérias-Primas em Lote
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Mova os insumos selecionados para o catálogo de outra empresa cadastrada.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-3">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-2">
                  <div className="flex justify-between font-semibold text-slate-800 border-b border-slate-200 pb-1.5">
                    <span>Total Selecionado:</span>
                    <span className="text-amber-700 font-bold">{selectedIds.length} insumo(s)</span>
                  </div>
                  <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                    {materias
                      .filter((m) => selectedIds.includes(m.id))
                      .map((m) => {
                        const fichasDoItem = mapaFichasLote.get(m.id) || []
                        return (
                          <div
                            key={m.id}
                            className="flex items-center justify-between text-[11px] p-1.5 bg-white rounded border border-slate-200"
                          >
                            <span className="font-medium text-slate-800 truncate max-w-[200px]">
                              {m.nome}
                            </span>
                            <div className="flex items-center gap-1.5">
                              {fichasDoItem.length > 0 && (
                                <Badge className="text-[9px] px-1 py-0 bg-amber-50 text-amber-800 border border-amber-200">
                                  {fichasDoItem.length} fichas
                                </Badge>
                              )}
                              <span className="text-slate-400 font-mono text-[10px]">
                                {m.codigo || m.unidade}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                  </div>
                </div>

                {/* Verificação de Integridade em Lote */}
                {verificandoLote ? (
                  <div className="p-3 bg-slate-50 rounded-lg text-xs text-slate-500 flex items-center gap-2">
                    <div className="w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    Verificando vínculos em fichas técnicas...
                  </div>
                ) : (
                  (() => {
                    let totalFichasAfetadas = 0
                    const nomesProdutosAfetados: string[] = []
                    mapaFichasLote.forEach((fichasList) => {
                      totalFichasAfetadas += fichasList.length
                      fichasList.forEach((f) => {
                        const pNome = f.expand?.produto?.nome || 'Produto sem nome'
                        if (!nomesProdutosAfetados.includes(pNome)) {
                          nomesProdutosAfetados.push(pNome)
                        }
                      })
                    })

                    if (totalFichasAfetadas > 0) {
                      return (
                        <div className="p-3 bg-amber-50 rounded-lg border border-amber-300 text-xs text-amber-900 space-y-2">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                            <div>
                              <p className="font-bold">
                                Atenção: Os insumos selecionados estão vinculados a{' '}
                                {totalFichasAfetadas} ficha(s) técnica(s):
                              </p>
                              <p className="text-[11px] text-amber-800 mt-0.5">
                                Produtos afetados: {nomesProdutosAfetados.slice(0, 4).join(', ')}
                                {nomesProdutosAfetados.length > 4 &&
                                  ` e mais ${nomesProdutosAfetados.length - 4}...`}
                              </p>
                            </div>
                          </div>
                          <p className="text-[11px] text-amber-800 border-t border-amber-200 pt-1.5">
                            💡 As composições e custos atuais das fichas serão preservados, mas os
                            insumos passarão a pertencer ao catálogo da empresa de destino.
                          </p>
                        </div>
                      )
                    }

                    return (
                      <div className="p-2.5 bg-emerald-50 rounded-lg border border-emerald-200 text-xs text-emerald-800 flex items-center gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                        Nenhuma ficha técnica vinculada aos itens selecionados. Transferência 100%
                        livre.
                      </div>
                    )
                  })()
                )}

                <div className="space-y-1.5">
                  <Label
                    htmlFor="empresa-destino-lote-mp"
                    className="text-xs font-semibold text-slate-700 flex items-center gap-1.5"
                  >
                    <Building2 className="w-3.5 h-3.5 text-blue-600" />
                    Selecione a Empresa de Destino *
                  </Label>
                  <select
                    id="empresa-destino-lote-mp"
                    value={empresaDestinoLoteId}
                    onChange={(e) => setEmpresaDestinoLoteId(e.target.value)}
                    className="w-full h-9 text-xs bg-white border border-slate-300 rounded-md px-2.5 text-slate-800 font-medium focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  >
                    <option value="" disabled>
                      Selecione o destino...
                    </option>
                    {empresas.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.nome} {emp.cnpj ? `(${emp.cnpj})` : ''} - {emp.segmento || 'Geral'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setTransferirLoteModalOpen(false)}
                  disabled={transferindoLote}
                  className="text-xs h-9"
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={handleConfirmarTransferenciaLote}
                  disabled={transferindoLote || !empresaDestinoLoteId}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs h-9 shadow-xs"
                >
                  {transferindoLote
                    ? 'Transferindo em lote...'
                    : `Transferir ${selectedIds.length} Matéria(s)`}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      ) : (
        /* ABA DA CURVA ABC DE MATÉRIAS-PRIMAS */
        <div className="space-y-6 animate-fadeIn">
          {/* Banner Informativo sobre a Metodologia ABC */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-blue-900 via-[#0B1F3A] to-indigo-950 text-white shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-blue-500/30 text-blue-200 text-[10px] font-bold uppercase tracking-wider border border-blue-400/30">
                    Estratégia de Compras & Negociação
                  </span>
                  <span className="text-xs text-blue-200 font-medium">
                    Princípio de Pareto (80/20)
                  </span>
                </div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Scale className="w-4 h-4 text-amber-400" />
                  Curva ABC de Matérias-Primas por Valor Consumido
                </h3>
                <p className="text-xs text-blue-100 max-w-3xl">
                  Identifique os insumos de maior impacto financeiro na formação de preço. Concentre
                  até 80% do seu esforço de negociação nos itens da <strong>Classe A</strong> para
                  obter os maiores ganhos de margem e créditos tributários (ICMS/PIS/COFINS).
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                <div className="bg-white/10 backdrop-blur-xs rounded-lg p-2 border border-white/15 text-right">
                  <div className="text-[10px] text-blue-200">Base de Apuração:</div>
                  <select
                    value={baseCalculoABC}
                    onChange={(e) => setBaseCalculoABC(e.target.value as any)}
                    className="mt-0.5 bg-slate-900 text-white text-xs rounded border border-blue-400/50 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-300"
                  >
                    <option value="consumo_fichas">Consumo nas Fichas Técnicas</option>
                    <option value="estoque">Estoque Atual Valorizado</option>
                  </select>
                </div>
                <Button
                  onClick={handleExportCurvaAbcCsv}
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-9 shadow-xs gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  Exportar Curva ABC (CSV)
                </Button>
              </div>
            </div>
          </div>

          {/* Cards de Resumo por Classe ABC */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Card Geral */}
            <Card className="bg-white border-slate-200 shadow-xs">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500 font-medium">Valor Total da Curva</p>
                  <h3 className="text-xl font-bold text-[#0B1F3A] mt-1 font-mono">
                    {formatBrl(curvaABCData.valorGeralConsumido)}
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Líquido: {formatBrl(curvaABCData.valorGeralConsumidoLiquido)}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Coins className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>

            {/* Classe A */}
            <Card className="bg-gradient-to-br from-rose-50/70 to-white border-rose-200 shadow-xs">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-600" />
                    <p className="text-xs font-bold text-rose-900 uppercase">
                      Classe A (Alta Prioridade)
                    </p>
                  </div>
                  <h3 className="text-xl font-black text-rose-700 mt-1 font-mono">
                    {formatBrl(curvaABCData.classeA.valor)}
                  </h3>
                  <div className="flex items-center gap-2 text-[11px] text-rose-800 font-semibold mt-0.5">
                    <span>{curvaABCData.classeA.pctValor.toFixed(1)}% do valor</span>
                    <span>·</span>
                    <span>
                      {curvaABCData.classeA.count} itens ({curvaABCData.classeA.pctItens.toFixed(1)}
                      %)
                    </span>
                  </div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold text-base">
                  A
                </div>
              </CardContent>
            </Card>

            {/* Classe B */}
            <Card className="bg-gradient-to-br from-amber-50/70 to-white border-amber-200 shadow-xs">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    <p className="text-xs font-bold text-amber-900 uppercase">
                      Classe B (Média Prioridade)
                    </p>
                  </div>
                  <h3 className="text-xl font-black text-amber-700 mt-1 font-mono">
                    {formatBrl(curvaABCData.classeB.valor)}
                  </h3>
                  <div className="flex items-center gap-2 text-[11px] text-amber-800 font-semibold mt-0.5">
                    <span>{curvaABCData.classeB.pctValor.toFixed(1)}% do valor</span>
                    <span>·</span>
                    <span>
                      {curvaABCData.classeB.count} itens ({curvaABCData.classeB.pctItens.toFixed(1)}
                      %)
                    </span>
                  </div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-base">
                  B
                </div>
              </CardContent>
            </Card>

            {/* Classe C */}
            <Card className="bg-gradient-to-br from-emerald-50/70 to-white border-emerald-200 shadow-xs">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                    <p className="text-xs font-bold text-emerald-900 uppercase">
                      Classe C (Operacional)
                    </p>
                  </div>
                  <h3 className="text-xl font-black text-emerald-700 mt-1 font-mono">
                    {formatBrl(curvaABCData.classeC.valor)}
                  </h3>
                  <div className="flex items-center gap-2 text-[11px] text-emerald-800 font-semibold mt-0.5">
                    <span>{curvaABCData.classeC.pctValor.toFixed(1)}% do valor</span>
                    <span>·</span>
                    <span>
                      {curvaABCData.classeC.count} itens ({curvaABCData.classeC.pctItens.toFixed(1)}
                      %)
                    </span>
                  </div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-base">
                  C
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Gráfico da Curva ABC (Gráfico de Pareto: Barras de Valor + Linha de % Acumulado) */}
          <Card className="bg-white border-slate-200 shadow-xs">
            <CardHeader className="pb-2 border-b border-slate-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base font-bold text-[#0B1F3A] flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-blue-600" />
                    Diagrama de Pareto & Distribuição de Valor Acumulado
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Visualização dos insumos ordenados por valor financeiro (barras) e percentual
                    acumulado (linha até 100%).
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="flex items-center gap-1 text-slate-600">
                    <span className="w-3 h-3 rounded bg-rose-600 inline-block" /> Classe A (~80%)
                  </span>
                  <span className="flex items-center gap-1 text-slate-600">
                    <span className="w-3 h-3 rounded bg-amber-500 inline-block" /> Classe B (~15%)
                  </span>
                  <span className="flex items-center gap-1 text-slate-600">
                    <span className="w-3 h-3 rounded bg-emerald-600 inline-block" /> Classe C (~5%)
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              {curvaABCData.itens.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  Cadastre matérias-primas e vincule-as em fichas técnicas para gerar o gráfico.
                </div>
              ) : (
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={curvaABCData.itens.slice(0, 25)}
                      margin={{ top: 10, right: 30, left: 20, bottom: 25 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                      <XAxis
                        dataKey="nome"
                        interval={0}
                        angle={-25}
                        textAnchor="end"
                        height={45}
                        fontSize={10}
                        tickFormatter={(v) => (v.length > 15 ? `${v.substring(0, 13)}...` : v)}
                      />
                      <YAxis
                        yAxisId="left"
                        tickFormatter={(v) => `R$ ${v}`}
                        fontSize={10}
                        stroke="#64748B"
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        domain={[0, 100]}
                        tickFormatter={(v) => `${v}%`}
                        fontSize={10}
                        stroke="#2563EB"
                      />
                      <RechartsTooltip
                        formatter={(val: any, name: any) => {
                          if (name === 'Valor Consumido') return [formatBrl(Number(val)), name]
                          if (name === '% Acumulado') return [`${Number(val).toFixed(1)}%`, name]
                          return [val, name]
                        }}
                        contentStyle={{
                          backgroundColor: '#0F172A',
                          color: '#fff',
                          borderRadius: '8px',
                          fontSize: '11px',
                          border: 'none',
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                      <Bar
                        yAxisId="left"
                        dataKey="valor_total"
                        name="Valor Consumido"
                        radius={[4, 4, 0, 0]}
                      >
                        {curvaABCData.itens.slice(0, 25).map((entry, idx) => (
                          <Cell
                            key={`cell-${idx}`}
                            fill={
                              entry.classe === 'A'
                                ? '#E11D48'
                                : entry.classe === 'B'
                                  ? '#F59E0B'
                                  : '#10B981'
                            }
                          />
                        ))}
                      </Bar>
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="percentual_acumulado"
                        name="% Acumulado"
                        stroke="#2563EB"
                        strokeWidth={2.5}
                        dot={{ r: 3, fill: '#2563EB' }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tabela Detalhada com Ranking e Recomendações Estratégicas */}
          <Card className="bg-white border-slate-200 shadow-xs">
            <CardHeader className="pb-3 border-b border-slate-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base font-bold text-[#0B1F3A] flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-blue-600" />
                    Ranking ABC de Matérias-Primas & Plano de Ação
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Lista classificada com custos brutos, deduções fiscais, custo líquido e
                    diretrizes para negociação com fornecedores.
                  </CardDescription>
                </div>

                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                  <div className="relative w-full sm:w-60">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <Input
                      placeholder="Buscar no ranking..."
                      value={searchABC}
                      onChange={(e) => setSearchABC(e.target.value)}
                      className="pl-8 h-8 text-xs"
                    />
                  </div>

                  <select
                    value={filtroClasseABC}
                    onChange={(e) => setFiltroClasseABC(e.target.value as any)}
                    className="h-8 text-xs bg-white border border-slate-200 rounded-md px-2.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-600 w-full sm:w-44"
                  >
                    <option value="todos">Todas as Classes</option>
                    <option value="A">🔴 Apenas Classe A (~80%)</option>
                    <option value="B">🟡 Apenas Classe B (~15%)</option>
                    <option value="C">🟢 Apenas Classe C (~5%)</option>
                  </select>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-4">
              {curvaABCFiltrada.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-500">
                  Nenhuma matéria-prima encontrada com os filtros selecionados.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-700 font-semibold">
                        <th className="py-3 px-3 text-center">Rank</th>
                        <th className="py-3 px-3 text-center">Classe</th>
                        <th className="py-3 px-3.5">Matéria-Prima</th>
                        <th className="py-3 px-3">Unid.</th>
                        <th className="py-3 px-3 text-right">Custo Bruto</th>
                        <th className="py-3 px-3 text-right bg-blue-50/40 text-blue-900">
                          Impostos (-)
                        </th>
                        <th className="py-3 px-3 text-right bg-emerald-50/60 text-emerald-950 font-bold">
                          Custo Líquido
                        </th>
                        <th className="py-3 px-3.5 text-right">
                          {baseCalculoABC === 'consumo_fichas' ? 'Qtd em Fichas' : 'Estoque Atual'}
                        </th>
                        <th className="py-3 px-3.5 text-right">Valor Total (R$)</th>
                        <th className="py-3 px-3 text-right">% Indiv.</th>
                        <th className="py-3 px-3 text-right">% Acum.</th>
                        <th className="py-3 px-4">Diretriz de Negociação / Estratégia</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {curvaABCFiltrada.map((item) => {
                        const rankOriginal =
                          curvaABCData.itens.findIndex((i) => i.id === item.id) + 1
                        return (
                          <tr
                            key={item.id}
                            className={`transition-colors ${
                              item.classe === 'A'
                                ? 'bg-rose-50/30 hover:bg-rose-50/60'
                                : item.classe === 'B'
                                  ? 'bg-amber-50/20 hover:bg-amber-50/50'
                                  : 'hover:bg-slate-50/70'
                            }`}
                          >
                            <td className="py-3 px-3 text-center font-bold text-slate-600 font-mono">
                              #{rankOriginal}
                            </td>
                            <td className="py-3 px-3 text-center whitespace-nowrap">
                              <Badge
                                className={`text-[11px] font-extrabold px-2.5 py-0.5 border ${
                                  item.classe === 'A'
                                    ? 'bg-rose-100 text-rose-800 border-rose-300'
                                    : item.classe === 'B'
                                      ? 'bg-amber-100 text-amber-800 border-amber-300'
                                      : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                }`}
                              >
                                Classe {item.classe}
                              </Badge>
                            </td>
                            <td className="py-3 px-3.5">
                              <div className="font-semibold text-slate-900">{item.nome}</div>
                              <div className="text-[11px] text-slate-400 font-mono">
                                {item.codigo ? `[${item.codigo}] ` : ''}
                                {item.categoria}
                                {item.fichas_count > 0 &&
                                  ` · Presente em ${item.fichas_count} ficha(s)`}
                              </div>
                            </td>
                            <td className="py-3 px-3 font-semibold text-slate-600">
                              {item.unidade}
                            </td>
                            <td className="py-3 px-3 text-right font-medium text-slate-700 font-mono whitespace-nowrap">
                              {formatBrl(item.custo_unitario)}
                            </td>
                            <td className="py-3 px-3 text-right whitespace-nowrap font-mono bg-blue-50/30">
                              <div className="text-blue-900 font-semibold">
                                - {formatBrl(item.total_impostos_valor)}
                              </div>
                              <div className="text-[10px] text-blue-700 font-medium">
                                ICMS:{item.icms_percentual}% PIS:{item.pis_percentual}% COF:
                                {item.cofins_percentual}%
                              </div>
                            </td>
                            <td className="py-3 px-3 text-right font-black text-emerald-900 font-mono whitespace-nowrap bg-emerald-50/50">
                              {formatBrl(item.custo_liquido)}
                            </td>
                            <td className="py-3 px-3.5 text-right font-semibold text-slate-800 font-mono whitespace-nowrap">
                              {item.quantidade.toLocaleString('pt-BR', {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 3,
                              })}
                            </td>
                            <td className="py-3 px-3.5 text-right font-bold text-slate-900 font-mono whitespace-nowrap">
                              {formatBrl(item.valor_total)}
                            </td>
                            <td className="py-3 px-3 text-right font-medium text-slate-700 font-mono whitespace-nowrap">
                              {item.percentual_individual.toFixed(2)}%
                            </td>
                            <td className="py-3 px-3 text-right font-bold text-blue-700 font-mono whitespace-nowrap">
                              {item.percentual_acumulado.toFixed(2)}%
                            </td>
                            <td className="py-3 px-4 text-xs text-slate-600 min-w-[260px]">
                              {item.classe === 'A' ? (
                                <div className="text-rose-900 bg-rose-100/60 p-1.5 rounded border border-rose-200 text-[11px]">
                                  <strong>Crítico:</strong> Foco em redução de custos, contratos de
                                  fornecimento em lote e compras programadas.
                                </div>
                              ) : item.classe === 'B' ? (
                                <div className="text-amber-900 bg-amber-100/50 p-1.5 rounded border border-amber-200 text-[11px]">
                                  <strong>Importante:</strong> Cotações com 2 ou 3 fornecedores
                                  concorrentes e acompanhamento de estoques.
                                </div>
                              ) : (
                                <div className="text-emerald-900 bg-emerald-100/40 p-1.5 rounded border border-emerald-200 text-[11px]">
                                  <strong>Operacional:</strong> Reposição simples, pedidos
                                  automatizados e controle de estoque básico.
                                </div>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-slate-300 bg-slate-50 font-bold text-slate-900">
                        <td colSpan={7} className="py-3 px-3.5 uppercase text-xs">
                          Total Geral Apurado ({curvaABCData.totalItens} insumos)
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono text-sm">
                          {formatBrl(curvaABCData.valorGeralConsumido)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono">100.00%</td>
                        <td className="py-3 px-3 text-right font-mono text-blue-700">100.00%</td>
                        <td className="py-3 px-4 text-slate-400">—</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
