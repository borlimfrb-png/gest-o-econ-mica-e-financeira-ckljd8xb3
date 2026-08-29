import React, { useState, useEffect, useMemo } from 'react'
import { materiasPrimasService } from '@/services/formacaoPrecoService'
import type { MateriaPrimaRecord } from '@/types/finance'
import { useRealtime } from '@/hooks/use-realtime'
import { useToast } from '@/hooks/use-toast'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
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
} from 'lucide-react'
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

export default function CadastroMateriaPrima() {
  const { toast } = useToast()

  const [materias, setMaterias] = useState<MateriaPrimaRecord[]>([])
  const [loading, setLoading] = useState(true)

  // Filtros
  const [search, setSearch] = useState('')
  const [categoriaFilter, setCategoriaFilter] = useState('todas')
  const [statusFilter, setStatusFilter] = useState<'todos' | 'critico' | 'atencao' | 'ok'>('todos')

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
      const list = await materiasPrimasService.getAll()
      setMaterias(list)
    } catch (err) {
      console.error('Erro ao carregar matérias-primas:', err)
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
  }, [])

  useRealtime<MateriaPrimaRecord>('materias_primas', () => loadData())

  // Categorias únicas
  const categorias = useMemo(() => {
    const set = new Set<string>()
    for (const m of materias) {
      if (m.categoria?.trim()) set.add(m.categoria.trim())
    }
    return Array.from(set).sort()
  }, [materias])

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

  return (
    <div className="space-y-6 animate-fadeIn">
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
                  <Label htmlFor="mp-categoria" className="text-xs font-semibold text-slate-700">
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
                    <p className="text-[11px] text-red-600 font-medium">{errors.custo_unitario}</p>
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
                    <p className="text-[11px] text-red-600 font-medium">{errors.estoque_atual}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="mp-estoque-min" className="text-xs font-semibold text-slate-700">
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
                    <p className="text-[11px] text-red-600 font-medium">{errors.estoque_minimo}</p>
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
              <strong className="text-slate-900">"{mpToDelete?.nome}"</strong>? Esta ação não pode
              ser desfeita.
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
    </div>
  )
}
