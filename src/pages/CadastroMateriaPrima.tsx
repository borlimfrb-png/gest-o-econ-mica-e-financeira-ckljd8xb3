import React, { useState, useEffect, useMemo } from 'react'
import {
  materiasPrimasService,
  fichasTecnicasService,
  configuracoesTributariasService,
} from '@/services/formacaoPrecoService'
import { useFilter } from '@/contexts/FilterContext'
import type {
  MateriaPrimaRecord,
  FichaTecnicaRecord,
  ConfiguracaoTributariaRecord,
} from '@/types/finance'
import { useRealtime } from '@/hooks/use-realtime'
import { useToast } from '@/hooks/use-toast'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
  Tag,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  BarChart3,
  TrendingUp,
  Percent,
  Filter,
  ArrowUpDown,
  Sparkles,
  Info,
  Scale,
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
  PieChart,
  Pie,
} from 'recharts'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

function formatBrl(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return '—'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val)
}

function formatQty(val: number | null | undefined, unidade: string = ''): string {
  if (val === null || val === undefined || isNaN(val)) return '—'
  const fmt = val.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 3 })
  return unidade ? `${fmt} ${unidade}` : fmt
}

interface MateriaPrimaFormData {
  codigo: string
  nome: string
  unidade: string
  categoria: string
  custo_unitario: string
  estoque_atual: string
  estoque_minimo: string
  observacoes: string
}

const EMPTY_MP: MateriaPrimaFormData = {
  codigo: '',
  nome: '',
  unidade: 'UN',
  categoria: '',
  custo_unitario: '',
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
  custo_com_impostos: number
  quantidade: number
  valor_total: number
  percentual_individual: number
  percentual_acumulado: number
  classe: 'A' | 'B' | 'C'
  fichas_count: number
  observacoes?: string
}

export default function CadastroMateriaPrima() {
  const { toast } = useToast()
  const { selectedEmpresaId } = useFilter()

  const [materias, setMaterias] = useState<MateriaPrimaRecord[]>([])
  const [fichas, setFichas] = useState<FichaTecnicaRecord[]>([])
  const [configTributaria, setConfigTributaria] = useState<ConfiguracaoTributariaRecord | null>(
    null,
  )
  const [loading, setLoading] = useState(true)

  // Aba ativa: 'catalogo' | 'curva-abc'
  const [activeTab, setActiveTab] = useState<'catalogo' | 'curva-abc'>('catalogo')

  // Filtros catálogo
  const [search, setSearch] = useState('')
  const [categoriaFilter, setCategoriaFilter] = useState('todas')
  const [statusFilter, setStatusFilter] = useState<'todos' | 'critico' | 'atencao' | 'ok'>('todos')

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

  const loadData = async () => {
    try {
      setLoading(true)
      const [mList, fList, cfg] = await Promise.all([
        materiasPrimasService.getAll(),
        fichasTecnicasService.getAll(),
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
      const custoComImpostos = custoUnit > 0 ? Number((custoUnit * fatorGrossUp).toFixed(4)) : 0
      const consumoInfo = consumoFichasMap.get(m.id)
      const qtdConsumoFichas = consumoInfo ? consumoInfo.qtd : 0
      const qtdEstoque = Number(m.estoque_atual) || 0
      const fichasCount = consumoInfo ? consumoInfo.fichasSet.size : 0

      // Se a base for consumo_fichas, mas a soma for zero, caso o estoque seja maior que 0 e não houver fichas,
      // usamos a quantidade escolhida pelo usuário
      const qtdBase = baseCalculoABC === 'consumo_fichas' ? qtdConsumoFichas : qtdEstoque
      const valorTotal = qtdBase * custoUnit

      return {
        id: m.id,
        codigo: m.codigo || '',
        nome: m.nome,
        unidade: m.unidade || 'UN',
        categoria: m.categoria || 'Geral',
        custo_unitario: custoUnit,
        custo_com_impostos: custoComImpostos,
        quantidade: qtdBase,
        valor_total: valorTotal,
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

    // 5. Calcula percentuais individuais, acumulados e classifica em A (~80%), B (~15% => 80 a 95%) e C (~5% => > 95%)
    let acumulado = 0
    const itensClassificados: ItemCurvaABC[] = itensCalculados.map((it) => {
      const pctInd = valorGeralConsumido > 0 ? (it.valor_total / valorGeralConsumido) * 100 : 0
      acumulado += pctInd
      const pctAcum = Math.min(100, acumulado)

      let classe: 'A' | 'B' | 'C' = 'C'
      // Classe A: itens que compõem até ~80% do valor acumulado (ou o primeiro item mais relevante)
      if (pctAcum <= 80.05 || (acumulado - pctInd === 0 && pctInd > 0)) {
        classe = 'A'
      } else if (pctAcum <= 95.05) {
        // Classe B: itens que compõem os próximos ~15% (de 80% a 95%)
        classe = 'B'
      } else {
        // Classe C: itens finais (~5% restante)
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

  const materiasAtencao = useMemo(() => {
    return materias.filter((m) => {
      const st = getStatusEstoque(m).status
      return st === 'atencao'
    })
  }, [materias])

  // Filtradas
  const materiasFiltradas = useMemo(() => {
    return materias.filter((m) => {
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

      return matchSearch && matchCat && matchStatus
    })
  }, [materias, search, categoriaFilter, statusFilter])

  // Estatísticas
  const stats = useMemo(() => {
    const total = materias.length
    const valorTotalEstoque = materias.reduce((acc, m) => {
      const custo = Number(m.custo_unitario) || 0
      const qtd = Number(m.estoque_atual) || 0
      return acc + custo * qtd
    }, 0)
    const custoMedio =
      materias.length > 0
        ? materias.reduce((acc, m) => acc + (Number(m.custo_unitario) || 0), 0) / materias.length
        : 0

    const totalCriticos = materias.filter((m) => getStatusEstoque(m).status === 'critico').length
    const totalAtencao = materias.filter((m) => getStatusEstoque(m).status === 'atencao').length

    return {
      total,
      valorTotalEstoque,
      custoMedio,
      categoriasCount: categorias.length,
      totalCriticos,
      totalAtencao,
    }
  }, [materias, categorias])

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
    if (!form.unidade.trim()) {
      errs.unidade = 'Informe a unidade de medida (ex: KG, UN, M, L)'
    }
    if (form.custo_unitario.trim() !== '') {
      const c = Number(form.custo_unitario.replace(',', '.'))
      if (isNaN(c) || c < 0) errs.custo_unitario = 'Informe um custo unitário válido'
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
    setFormData(EMPTY_MP)
    setErrors({})
    setModalOpen(true)
  }

  const handleOpenEdit = (m: MateriaPrimaRecord) => {
    setEditingMP(m)
    setFormData({
      codigo: m.codigo || '',
      nome: m.nome,
      unidade: m.unidade || 'UN',
      categoria: m.categoria || '',
      custo_unitario:
        m.custo_unitario !== undefined && m.custo_unitario !== null ? String(m.custo_unitario) : '',
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
      const estoqueNum =
        formData.estoque_atual.trim() !== ''
          ? Number(formData.estoque_atual.replace(',', '.'))
          : undefined
      const estoqueMinNum =
        formData.estoque_minimo.trim() !== ''
          ? Number(formData.estoque_minimo.replace(',', '.'))
          : undefined

      const payload = {
        codigo: formData.codigo.trim() || undefined,
        nome: formData.nome.trim(),
        unidade: formData.unidade.trim().toUpperCase(),
        categoria: formData.categoria.trim() || undefined,
        custo_unitario: custoNum,
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

    const headers = [
      'Código',
      'Matéria-Prima',
      'Status Estoque',
      'Unidade',
      'Categoria',
      'Custo Unitário (R$)',
      'Estoque Atual',
      'Estoque Mínimo',
      'Valor Total em Estoque (R$)',
      'Observações',
    ]

    const linhas = [headers.map(escapeCsv).join(';')]

    for (const m of materiasFiltradas) {
      const custo = m.custo_unitario || 0
      const est = m.estoque_atual || 0
      const totalEstoque = custo * est

      const st = getStatusEstoque(m)
      const estMin =
        m.estoque_minimo !== undefined && m.estoque_minimo !== null
          ? m.estoque_minimo.toLocaleString('pt-BR')
          : ''

      linhas.push(
        [
          m.codigo || '',
          m.nome,
          st.label,
          m.unidade,
          m.categoria || '',
          fmtNum(m.custo_unitario),
          est.toLocaleString('pt-BR'),
          estMin,
          fmtNum(totalEstoque),
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
    link.setAttribute('download', `cadastro-materias-primas-${dataStr}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    toast({
      title: 'Exportação concluída',
      description: 'O arquivo CSV com as matérias-primas foi baixado.',
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
      'Custo Unitário s/ Impostos (R$)',
      `Custo Unitário c/ Impostos (${cargaTrib.toFixed(2)}%) (R$)`,
      baseCalculoABC === 'consumo_fichas' ? 'Qtd Consumo em Fichas' : 'Estoque Atual (Qtd)',
      'Fichas Técnicas Atendidas',
      'Valor Total Consumido / Valorizado (R$)',
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
          ? 'ALTA PRIORIDADE: Negociar contratos anuais, desconto por escala e monitorar preços semanalmente.'
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
          fmtNum(it.custo_com_impostos),
          it.quantidade.toLocaleString('pt-BR', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 3,
          }),
          it.fichas_count,
          fmtNum(it.valor_total),
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
      {/* Abas Superiores: Catálogo de Insumos vs Curva ABC */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <h2 className="text-lg font-bold text-[#0B1F3A] flex items-center gap-2">
            <Layers className="w-5 h-5 text-amber-600" />
            Matérias-Primas & Análise de Insumos
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Gerencie o catálogo de insumos e analise a Curva ABC de valor consumido para negociação
            com fornecedores.
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

          {/* Cards de Métricas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-white border-slate-200 shadow-xs">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500 font-medium">Total de Matérias-Primas</p>
                  <h3 className="text-xl font-bold text-[#0B1F3A] mt-1">{stats.total}</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">Insumos cadastrados</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Layers className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border-slate-200 shadow-xs">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500 font-medium">Valor Total em Estoque</p>
                  <h3 className="text-xl font-bold text-emerald-700 mt-1">
                    {formatBrl(stats.valorTotalEstoque)}
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">Saldo valorizado</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Boxes className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border-slate-200 shadow-xs">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500 font-medium">Custo Médio Unitário</p>
                  <h3 className="text-xl font-bold text-[#0B1F3A] mt-1">
                    {formatBrl(stats.custoMedio)}
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">Por item cadastrado</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Coins className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border-slate-200 shadow-xs">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500 font-medium">Status do Estoque</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={`text-xl font-bold ${stats.totalCriticos > 0 ? 'text-rose-600' : 'text-emerald-700'}`}
                    >
                      {stats.totalCriticos > 0
                        ? `${stats.totalCriticos} Crítico${stats.totalCriticos > 1 ? 's' : ''}`
                        : 'Estoque Regular'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {stats.totalAtencao > 0
                      ? `${stats.totalAtencao} em atenção`
                      : `${stats.categoriasCount} categorias cadastradas`}
                  </p>
                </div>
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    stats.totalCriticos > 0
                      ? 'bg-rose-50 text-rose-600'
                      : stats.totalAtencao > 0
                        ? 'bg-amber-50 text-amber-600'
                        : 'bg-emerald-50 text-emerald-600'
                  }`}
                >
                  {stats.totalCriticos > 0 ? (
                    <AlertTriangle className="w-5 h-5" />
                  ) : (
                    <CheckCircle2 className="w-5 h-5" />
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Catálogo de Matérias-Primas */}
          <Card className="bg-white border-slate-200 shadow-xs">
            <CardHeader className="pb-3 border-b border-slate-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base font-bold text-[#0B1F3A] flex items-center gap-2">
                    <Layers className="w-4 h-4 text-amber-600" />
                    Catálogo de Matérias-Primas e Insumos
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Insumos utilizados na produção e composição das fichas técnicas.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
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
                      ? 'Cadastre os insumos e matérias-primas que entram na composição dos seus produtos.'
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
                      <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-700 font-semibold">
                        <th className="py-3 px-3.5">Código</th>
                        <th className="py-3 px-3.5">Matéria-Prima</th>
                        <th className="py-3 px-3.5 text-center">Status Estoque</th>
                        <th className="py-3 px-3.5">Unidade</th>
                        <th className="py-3 px-3.5">Categoria</th>
                        <th className="py-3 px-3.5 text-right">Custo Unitário (R$)</th>
                        <th className="py-3 px-3.5 text-right">Estoque Atual</th>
                        <th className="py-3 px-3.5 text-right">Estoque Mínimo</th>
                        <th className="py-3 px-3.5 text-right">Valor em Estoque (R$)</th>
                        <th className="py-3 px-3.5 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {materiasFiltradas.map((m) => {
                        const custo = m.custo_unitario || 0
                        const estoque = m.estoque_atual || 0
                        const valorEstoque = custo * estoque
                        const st = getStatusEstoque(m)

                        return (
                          <tr
                            key={m.id}
                            className={`transition-colors ${
                              st.status === 'critico'
                                ? 'bg-rose-50/30 hover:bg-rose-50/60'
                                : st.status === 'atencao'
                                  ? 'bg-amber-50/20 hover:bg-amber-50/50'
                                  : 'hover:bg-slate-50/70'
                            }`}
                          >
                            <td className="py-3 px-3.5 font-mono font-semibold text-slate-600">
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
                              {m.observacoes && (
                                <div className="text-[11px] text-slate-400 truncate max-w-xs">
                                  {m.observacoes}
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-3.5 text-center whitespace-nowrap">
                              <Badge
                                variant={st.badgeVariant}
                                className={`text-[10px] px-2 py-0.5 ${st.badgeClass}`}
                              >
                                {st.status === 'critico' && '● '}
                                {st.status === 'atencao' && '▲ '}
                                {st.status === 'ok' && '✓ '}
                                {st.label}
                              </Badge>
                            </td>
                            <td className="py-3 px-3.5">
                              <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-semibold">
                                {m.unidade}
                              </span>
                            </td>
                            <td className="py-3 px-3.5 text-slate-600">
                              {m.categoria ? (
                                <Badge className="text-[10px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
                                  {m.categoria}
                                </Badge>
                              ) : (
                                <span className="text-slate-400 italic">—</span>
                              )}
                            </td>
                            <td className="py-3 px-3.5 text-right font-bold text-slate-800 whitespace-nowrap">
                              {formatBrl(m.custo_unitario)}
                            </td>
                            <td className="py-3 px-3.5 text-right whitespace-nowrap">
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
                            <td className="py-3 px-3.5 text-right whitespace-nowrap">
                              {m.estoque_minimo !== undefined && m.estoque_minimo !== null ? (
                                <span className="font-medium text-slate-500">
                                  {formatQty(m.estoque_minimo, m.unidade)}
                                </span>
                              ) : (
                                <span className="text-slate-400 italic">—</span>
                              )}
                            </td>
                            <td className="py-3 px-3.5 text-right font-semibold text-emerald-700 whitespace-nowrap">
                              {formatBrl(valorEstoque)}
                            </td>
                            <td className="py-3 px-3.5 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1">
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
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Modal Cadastro/Edição de Matéria-Prima */}
          <Dialog open={modalOpen} onOpenChange={setModalOpen}>
            <DialogContent className="sm:max-w-[500px] bg-white">
              <form onSubmit={handleSave}>
                <DialogHeader>
                  <DialogTitle className="text-base font-bold text-[#0B1F3A] flex items-center gap-2">
                    <Layers className="w-4 h-4 text-amber-600" />
                    {editingMP ? 'Editar Matéria-Prima' : 'Nova Matéria-Prima'}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-slate-500">
                    Cadastre as informações da matéria-prima e seus custos de aquisição.
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

                <div className="space-y-3 py-4">
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
                        className="h-9 text-xs uppercase"
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

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="mp-custo" className="text-xs font-semibold text-slate-700">
                        Custo Unitário (R$)
                      </Label>
                      <Input
                        id="mp-custo"
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={formData.custo_unitario}
                        onChange={(e) => setField('custo_unitario', e.target.value)}
                        className={`h-9 text-xs ${errors.custo_unitario ? 'border-red-500' : ''}`}
                      />
                      {errors.custo_unitario && (
                        <p className="text-[11px] text-red-600 font-medium">
                          {errors.custo_unitario}
                        </p>
                      )}
                    </div>

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
                        className={`h-9 text-xs ${errors.estoque_atual ? 'border-red-500' : ''}`}
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
                        className={`h-9 text-xs ${errors.estoque_minimo ? 'border-red-500' : ''}`}
                      />
                      {errors.estoque_minimo && (
                        <p className="text-[11px] text-red-600 font-medium">
                          {errors.estoque_minimo}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="mp-obs" className="text-xs font-semibold text-slate-700">
                      Observações / Fornecedor
                    </Label>
                    <Textarea
                      id="mp-obs"
                      placeholder="Informações do fornecedor, espessura, código de barras etc."
                      value={formData.observacoes}
                      onChange={(e) => setField('observacoes', e.target.value)}
                      className="min-h-[70px] text-xs resize-y"
                    />
                  </div>
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
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
                  obter os maiores ganhos de margem.
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
                    {curvaABCData.totalItens} insumos analisados
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
                    Lista classificada com percentuais acumulados e diretrizes para negociação com
                    fornecedores.
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
                        <th className="py-3 px-3 text-right">Custo s/ Imp.</th>
                        <th className="py-3 px-3 text-right text-amber-700">
                          Custo c/ Imp.{' '}
                          {configTributaria?.carga_tributaria_total
                            ? `(${Number(configTributaria.carga_tributaria_total).toFixed(1)}%)`
                            : ''}
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
                      {curvaABCFiltrada.map((item, index) => {
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
                            <td className="py-3 px-3 text-right font-bold text-amber-700 font-mono whitespace-nowrap bg-amber-50/30">
                              {formatBrl(item.custo_com_impostos)}
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
