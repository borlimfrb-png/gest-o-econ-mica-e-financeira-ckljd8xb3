import React, { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { produtosService, fichasTecnicasService } from '@/services/formacaoPrecoService'
import type { ProdutoRecord, FichaTecnicaRecord } from '@/types/finance'
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
  Package,
  Plus,
  Pencil,
  Trash2,
  Search,
  Download,
  AlertCircle,
  TrendingUp,
  Percent,
  Layers,
  ClipboardList,
  ArrowUpDown,
  Tag,
  DollarSign,
  Info,
  Link as LinkIcon,
  Check,
  AlertTriangle,
  History,
} from 'lucide-react'
import { ModalHistoricoPrecos } from '@/components/ModalHistoricoPrecos'
import { Alert, AlertDescription } from '@/components/ui/alert'

function formatBrl(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return '—'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val)
}

function formatPct(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return '—'
  return `${val.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}%`
}

interface ProdutoFormData {
  codigo: string
  nome: string
  unidade: string
  categoria: string
  custo: string
  preco_venda: string
  margem_desejada: string
  observacoes: string
}

const EMPTY_PRODUTO: ProdutoFormData = {
  codigo: '',
  nome: '',
  unidade: 'UN',
  categoria: '',
  custo: '',
  preco_venda: '',
  margem_desejada: '',
  observacoes: '',
}

type ProdutoErrors = Partial<Record<keyof ProdutoFormData | 'general', string>>

export default function CadastroProdutos() {
  const { toast } = useToast()

  const [produtos, setProdutos] = useState<ProdutoRecord[]>([])
  const [fichas, setFichas] = useState<FichaTecnicaRecord[]>([])
  const [loading, setLoading] = useState(true)

  // Filtro e busca
  const [search, setSearch] = useState('')
  const [categoriaFilter, setCategoriaFilter] = useState('todas')

  // Modal Novo / Editar
  const [modalOpen, setModalOpen] = useState(false)
  const [editingProduto, setEditingProduto] = useState<ProdutoRecord | null>(null)
  const [formData, setFormData] = useState<ProdutoFormData>(EMPTY_PRODUTO)
  const [errors, setErrors] = useState<ProdutoErrors>({})
  const [saving, setSaving] = useState(false)

  // Modal Exclusão
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [produtoToDelete, setProdutoToDelete] = useState<ProdutoRecord | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Modal Vincular Preço Sugerido da Ficha ao Produto
  const [vincularOpen, setVincularOpen] = useState(false)
  const [produtoParaVincular, setProdutoParaVincular] = useState<ProdutoRecord | null>(null)
  const [fichaParaVincular, setFichaParaVincular] = useState<FichaTecnicaRecord | null>(null)
  const [tipoPrecoVinculo, setTipoPrecoVinculo] = useState<'margem' | 'markup'>('margem')
  const [vinculandoPreco, setVinculandoPreco] = useState(false)

  // Modal Histórico de Preços
  const [historicoModalOpen, setHistoricoModalOpen] = useState(false)
  const [produtoParaHistorico, setProdutoParaHistorico] = useState<ProdutoRecord | null>(null)

  const loadData = async () => {
    try {
      setLoading(true)
      const [prodList, fichasList] = await Promise.all([
        produtosService.getAll(),
        fichasTecnicasService.getAll(),
      ])
      setProdutos(prodList)
      setFichas(fichasList)
    } catch (err) {
      console.error('Erro ao carregar produtos:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar',
        description: 'Não foi possível carregar os produtos.',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useRealtime<ProdutoRecord>('produtos', () => loadData())
  useRealtime<FichaTecnicaRecord>('fichas_tecnicas', () => loadData())

  // Mapeamento produtoId -> ficha técnica
  const fichasMap = useMemo(() => {
    const map = new Map<string, FichaTecnicaRecord>()
    for (const f of fichas) {
      if (f.produto) {
        map.set(f.produto, f)
      }
    }
    return map
  }, [fichas])

  // Categorias únicas
  const categorias = useMemo(() => {
    const set = new Set<string>()
    for (const p of produtos) {
      if (p.categoria?.trim()) set.add(p.categoria.trim())
    }
    return Array.from(set).sort()
  }, [produtos])

  // Produtos filtrados
  const produtosFiltrados = useMemo(() => {
    return produtos.filter((p) => {
      const matchSearch =
        search.trim() === '' ||
        p.nome.toLowerCase().includes(search.toLowerCase()) ||
        (p.codigo && p.codigo.toLowerCase().includes(search.toLowerCase())) ||
        (p.categoria && p.categoria.toLowerCase().includes(search.toLowerCase()))

      const matchCat =
        categoriaFilter === 'todas' || (p.categoria && p.categoria.trim() === categoriaFilter)

      return matchSearch && matchCat
    })
  }, [produtos, search, categoriaFilter])

  // Resumos estatísticos
  const stats = useMemo(() => {
    const total = produtos.length
    const comFicha = produtos.filter((p) => fichasMap.has(p.id)).length
    const valorTotalEstoque = produtos.reduce((acc, p) => acc + (Number(p.preco_venda) || 0), 0)
    const margemMedia =
      produtos.length > 0
        ? produtos.reduce((acc, p) => {
            const custo = Number(p.custo) || 0
            const preco = Number(p.preco_venda) || 0
            if (preco > 0 && custo > 0) {
              return acc + ((preco - custo) / preco) * 100
            }
            return acc + (Number(p.margem_desejada) || 0)
          }, 0) / produtos.length
        : 0

    return { total, comFicha, valorTotalEstoque, margemMedia }
  }, [produtos, fichasMap])

  // Handlers do Formulário
  const setField = <K extends keyof ProdutoFormData>(key: K, value: ProdutoFormData[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }))
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  // Auto-cálculo da margem quando altera preço ou custo (ou vice-versa)
  const handleCustoOrPrecoChange = (
    tipo: 'custo' | 'preco_venda' | 'margem_desejada',
    val: string,
  ) => {
    setField(tipo, val)
    const c =
      tipo === 'custo' ? Number(val.replace(',', '.')) : Number(formData.custo.replace(',', '.'))
    const p =
      tipo === 'preco_venda'
        ? Number(val.replace(',', '.'))
        : Number(formData.preco_venda.replace(',', '.'))
    const m =
      tipo === 'margem_desejada'
        ? Number(val.replace(',', '.'))
        : Number(formData.margem_desejada.replace(',', '.'))

    if (tipo === 'margem_desejada' && !isNaN(m) && m < 100 && !isNaN(c) && c > 0) {
      // Sugere Preço de venda = Custo / (1 - margem/100)
      const novoPreco = c / (1 - m / 100)
      if (novoPreco > 0) {
        setFormData((prev) => ({
          ...prev,
          margem_desejada: val,
          preco_venda: novoPreco.toFixed(2),
        }))
      }
    } else if (
      (tipo === 'custo' || tipo === 'preco_venda') &&
      !isNaN(c) &&
      !isNaN(p) &&
      p > 0 &&
      c >= 0
    ) {
      // Calcula margem efetiva = ((Preço - Custo) / Preço) * 100
      const novaMargem = ((p - c) / p) * 100
      setFormData((prev) => ({
        ...prev,
        [tipo]: val,
        margem_desejada: novaMargem > 0 ? novaMargem.toFixed(1) : '0',
      }))
    }
  }

  const validate = (form: ProdutoFormData): boolean => {
    const errs: ProdutoErrors = {}
    if (!form.nome.trim() || form.nome.trim().length < 2) {
      errs.nome = 'Informe o nome do produto (mínimo 2 caracteres)'
    }
    if (!form.unidade.trim()) {
      errs.unidade = 'Informe a unidade de medida (ex: UN, KG, CX)'
    }
    if (form.custo.trim() !== '') {
      const c = Number(form.custo.replace(',', '.'))
      if (isNaN(c) || c < 0) errs.custo = 'Informe um custo válido'
    }
    if (form.preco_venda.trim() !== '') {
      const p = Number(form.preco_venda.replace(',', '.'))
      if (isNaN(p) || p < 0) errs.preco_venda = 'Informe um preço válido'
    }
    if (form.margem_desejada.trim() !== '') {
      const m = Number(form.margem_desejada.replace(',', '.'))
      if (isNaN(m) || m < 0 || m >= 100) errs.margem_desejada = 'Margem deve estar entre 0% e 99.9%'
    }

    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleOpenNew = () => {
    setEditingProduto(null)
    setFormData(EMPTY_PRODUTO)
    setErrors({})
    setModalOpen(true)
  }

  const handleOpenEdit = (p: ProdutoRecord) => {
    setEditingProduto(p)
    setFormData({
      codigo: p.codigo || '',
      nome: p.nome,
      unidade: p.unidade || 'UN',
      categoria: p.categoria || '',
      custo: p.custo !== undefined && p.custo !== null ? String(p.custo) : '',
      preco_venda:
        p.preco_venda !== undefined && p.preco_venda !== null ? String(p.preco_venda) : '',
      margem_desejada:
        p.margem_desejada !== undefined && p.margem_desejada !== null
          ? String(p.margem_desejada)
          : '',
      observacoes: p.observacoes || '',
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
        formData.custo.trim() !== '' ? Number(formData.custo.replace(',', '.')) : undefined
      const precoNum =
        formData.preco_venda.trim() !== ''
          ? Number(formData.preco_venda.replace(',', '.'))
          : undefined
      const margemNum =
        formData.margem_desejada.trim() !== ''
          ? Number(formData.margem_desejada.replace(',', '.'))
          : undefined

      const payload = {
        codigo: formData.codigo.trim() || undefined,
        nome: formData.nome.trim(),
        unidade: formData.unidade.trim().toUpperCase(),
        categoria: formData.categoria.trim() || undefined,
        custo: custoNum,
        preco_venda: precoNum,
        margem_desejada: margemNum,
        observacoes: formData.observacoes.trim() || undefined,
      }

      if (editingProduto) {
        await produtosService.update(editingProduto.id, payload)
        toast({
          title: 'Produto atualizado',
          description: `"${payload.nome}" foi atualizado com sucesso.`,
        })
      } else {
        await produtosService.create(payload)
        toast({
          title: 'Produto cadastrado',
          description: `"${payload.nome}" foi adicionado com sucesso.`,
        })
      }

      setModalOpen(false)
      loadData()
    } catch (err: any) {
      console.error(err)
      setErrors((prev) => ({
        ...prev,
        general: err?.message || 'Erro ao salvar o produto.',
      }))
    } finally {
      setSaving(false)
    }
  }

  // Vincular Preço Sugerido
  const handleOpenVincular = (p: ProdutoRecord) => {
    const ficha = fichasMap.get(p.id)
    if (!ficha) return
    setProdutoParaVincular(p)
    setFichaParaVincular(ficha)
    setTipoPrecoVinculo('margem')
    setVincularOpen(true)
  }

  const handleOpenHistorico = (p: ProdutoRecord) => {
    setProdutoParaHistorico(p)
    setHistoricoModalOpen(true)
  }

  const handleConfirmarVinculoPreco = async () => {
    if (!produtoParaVincular || !fichaParaVincular) return

    const custoTotal = Number(fichaParaVincular.custo_total) || 0
    const margem = Number(fichaParaVincular.margem_desejada) || 0
    const markup =
      fichaParaVincular.markup_desejado !== undefined && fichaParaVincular.markup_desejado !== null
        ? Number(fichaParaVincular.markup_desejado)
        : margem < 100 && margem > 0
          ? (margem / (100 - margem)) * 100
          : 50

    const precoMargem =
      Number(fichaParaVincular.preco_venda_sugerido) ||
      (margem < 100 && custoTotal > 0 ? custoTotal / (1 - margem / 100) : custoTotal)
    const precoMarkup =
      Number(fichaParaVincular.preco_venda_markup) ||
      (custoTotal > 0 ? custoTotal * (1 + markup / 100) : custoTotal)

    const precoFinal = tipoPrecoVinculo === 'margem' ? precoMargem : precoMarkup
    const margemFinal =
      tipoPrecoVinculo === 'margem'
        ? margem
        : precoFinal > 0
          ? ((precoFinal - custoTotal) / precoFinal) * 100
          : margem

    setVinculandoPreco(true)
    try {
      await fichasTecnicasService.vincularPrecoAoProduto(
        produtoParaVincular.id,
        precoFinal,
        margemFinal,
        tipoPrecoVinculo === 'margem' ? 'Preço Sugerido Margem' : 'Preço Sugerido Markup',
        `Preço vinculado a partir do preço sugerido por ${tipoPrecoVinculo === 'margem' ? 'Margem' : 'Markup'} da Ficha Técnica`,
      )
      toast({
        title: 'Preço vinculado com sucesso!',
        description: `O preço de "${produtoParaVincular.nome}" foi atualizado para ${formatBrl(
          precoFinal,
        )} (${tipoPrecoVinculo === 'margem' ? 'por margem' : 'por markup'}).`,
      })
      setVincularOpen(false)
      setProdutoParaVincular(null)
      setFichaParaVincular(null)
      await loadData()
    } catch (err: any) {
      console.error(err)
      toast({
        variant: 'destructive',
        title: 'Erro ao vincular preço',
        description: err?.message || 'Não foi possível atualizar o preço do produto.',
      })
    } finally {
      setVinculandoPreco(false)
    }
  }

  const confirmDelete = (p: ProdutoRecord) => {
    setProdutoToDelete(p)
    setDeleteOpen(true)
  }

  const handleDelete = async () => {
    if (!produtoToDelete) return
    setDeleting(true)
    try {
      await produtosService.delete(produtoToDelete.id)
      toast({
        title: 'Produto excluído',
        description: `"${produtoToDelete.nome}" foi removido do sistema.`,
      })
      setDeleteOpen(false)
      setProdutoToDelete(null)
      loadData()
    } catch (err: any) {
      console.error(err)
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir',
        description: err?.message || 'Não foi possível excluir o produto.',
      })
    } finally {
      setDeleting(false)
    }
  }

  // Exportar CSV
  const handleExportCsv = () => {
    if (produtos.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Nada para exportar',
        description: 'Não há produtos cadastrados.',
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
      'Produto',
      'Unidade',
      'Categoria',
      'Custo (R$)',
      'Preço Venda (R$)',
      'Margem (%)',
      'Possui Ficha Técnica',
      'Observações',
    ]

    const linhas = [headers.map(escapeCsv).join(';')]

    for (const p of produtosFiltrados) {
      const ficha = fichasMap.get(p.id)
      const custoFinal = ficha ? ficha.custo_total : p.custo
      const margemFinal =
        p.preco_venda && custoFinal && p.preco_venda > 0
          ? ((p.preco_venda - custoFinal) / p.preco_venda) * 100
          : p.margem_desejada

      linhas.push(
        [
          p.codigo || '',
          p.nome,
          p.unidade,
          p.categoria || '',
          fmtNum(custoFinal),
          fmtNum(p.preco_venda),
          margemFinal !== undefined ? margemFinal.toFixed(1) + '%' : '',
          ficha ? 'Sim' : 'Não',
          p.observacoes || '',
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
    link.setAttribute('download', `cadastro-produtos-${dataStr}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    toast({
      title: 'Exportação concluída',
      description: 'O arquivo CSV com os produtos foi baixado.',
    })
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Cards de Métricas Rápidas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white border-slate-200 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 font-medium">Total de Produtos</p>
              <h3 className="text-xl font-bold text-[#0B1F3A] mt-1">{stats.total}</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Itens cadastrados</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Package className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 font-medium">Com Ficha Técnica</p>
              <h3 className="text-xl font-bold text-[#0B1F3A] mt-1">{stats.comFicha}</h3>
              <p className="text-[11px] text-emerald-600 font-medium mt-0.5">
                {stats.total > 0 ? Math.round((stats.comFicha / stats.total) * 100) : 0}% com
                composição
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ClipboardList className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 font-medium">Margem Média</p>
              <h3 className="text-xl font-bold text-[#0B1F3A] mt-1">
                {formatPct(stats.margemMedia)}
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Sobre preço de venda</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Percent className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 font-medium">Categorias Ativas</p>
              <h3 className="text-xl font-bold text-[#0B1F3A] mt-1">{categorias.length}</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Segmentações</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Tag className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Ações e Filtros */}
      <Card className="bg-white border-slate-200 shadow-xs">
        <CardHeader className="pb-3 border-b border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold text-[#0B1F3A] flex items-center gap-2">
                <Package className="w-4 h-4 text-blue-600" />
                Catálogo de Produtos
              </CardTitle>
              <CardDescription className="text-xs">
                Produtos cadastrados com custos, preços de venda e fichas técnicas vinculadas.
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
                Novo Produto
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-center gap-3 mb-4">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Buscar por nome, código ou categoria..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>
            {categorias.length > 0 && (
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <span className="text-xs text-slate-500 shrink-0 font-medium">Categoria:</span>
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
              </div>
            )}
          </div>

          {/* Tabela de Produtos */}
          {loading ? (
            <div className="py-16 flex justify-center items-center">
              <div className="w-7 h-7 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : produtosFiltrados.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
                <Package className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-semibold text-slate-800">Nenhum produto encontrado</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                {produtos.length === 0
                  ? 'Cadastre seu primeiro produto para iniciar a formação de preços e ficha técnica.'
                  : 'Nenhum resultado para os filtros de busca aplicados.'}
              </p>
              {produtos.length === 0 && (
                <Button
                  onClick={handleOpenNew}
                  size="sm"
                  className="mt-4 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Plus className="w-3.5 h-3.5 mr-1.5" />
                  Cadastrar Primeiro Produto
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-700 font-semibold">
                    <th className="py-3 px-3.5">Código</th>
                    <th className="py-3 px-3.5">Produto</th>
                    <th className="py-3 px-3.5">Unidade</th>
                    <th className="py-3 px-3.5">Categoria</th>
                    <th className="py-3 px-3.5 text-right">Custo (R$)</th>
                    <th className="py-3 px-3.5 text-right">Preço Venda (R$)</th>
                    <th className="py-3 px-3.5 text-right">Margem (%)</th>
                    <th className="py-3 px-3.5 text-center">Ficha Técnica</th>
                    <th className="py-3 px-3.5 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {produtosFiltrados.map((p) => {
                    const ficha = fichasMap.get(p.id)
                    const custoFinal = ficha ? ficha.custo_total : p.custo
                    const precoVenda = p.preco_venda
                    const margemCalculada =
                      precoVenda && custoFinal && precoVenda > 0
                        ? ((precoVenda - custoFinal) / precoVenda) * 100
                        : p.margem_desejada

                    const margemPositiva = (margemCalculada || 0) >= 0

                    return (
                      <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-3.5 font-mono font-semibold text-slate-600">
                          {p.codigo ? (
                            <Badge
                              variant="outline"
                              className="text-[10px] font-mono bg-slate-50 text-slate-700"
                            >
                              {p.codigo}
                            </Badge>
                          ) : (
                            <span className="text-slate-400 italic">—</span>
                          )}
                        </td>
                        <td className="py-3 px-3.5">
                          <div className="font-semibold text-slate-900">{p.nome}</div>
                          {p.observacoes && (
                            <div className="text-[11px] text-slate-400 truncate max-w-xs">
                              {p.observacoes}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3.5 font-medium text-slate-600">
                          <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-semibold">
                            {p.unidade}
                          </span>
                        </td>
                        <td className="py-3 px-3.5 text-slate-600">
                          {p.categoria ? (
                            <Badge className="text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                              {p.categoria}
                            </Badge>
                          ) : (
                            <span className="text-slate-400 italic">—</span>
                          )}
                        </td>
                        <td className="py-3 px-3.5 text-right font-medium text-slate-800 whitespace-nowrap">
                          {formatBrl(custoFinal)}
                          {ficha && (
                            <span
                              className="ml-1 text-[10px] text-emerald-600 font-semibold"
                              title="Custo calculado via Ficha Técnica"
                            >
                              (Ficha)
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3.5 text-right font-bold text-blue-900 whitespace-nowrap">
                          {formatBrl(precoVenda)}
                        </td>
                        <td className="py-3 px-3.5 text-right whitespace-nowrap">
                          {margemCalculada !== undefined && margemCalculada !== null ? (
                            <span
                              className={`inline-flex items-center gap-0.5 font-bold ${
                                margemPositiva ? 'text-emerald-600' : 'text-rose-600'
                              }`}
                            >
                              <TrendingUp className="w-3 h-3" />
                              {margemCalculada.toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">—</span>
                          )}
                        </td>
                        <td className="py-3 px-3.5 text-center whitespace-nowrap">
                          {ficha ? (
                            <div className="inline-flex items-center gap-1.5">
                              <Link
                                to={`/formacao-preco/fichas-tecnicas?produto=${p.id}`}
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-1 rounded-md transition-colors"
                                title="Ver ficha técnica"
                              >
                                <ClipboardList className="w-3 h-3" />
                                {ficha.itens?.length || 0} insumos
                              </Link>
                              <Button
                                type="button"
                                onClick={() => handleOpenVincular(p)}
                                size="sm"
                                variant="outline"
                                className="h-6 px-1.5 text-[10px] text-blue-700 bg-blue-50/50 hover:bg-blue-100 border-blue-200 font-medium"
                                title="Vincular preço sugerido da ficha técnica ao produto"
                              >
                                <LinkIcon className="w-2.5 h-2.5 mr-1 text-blue-600" />
                                Vincular
                              </Button>
                            </div>
                          ) : (
                            <Link
                              to={`/formacao-preco/fichas-tecnicas?novoPara=${p.id}`}
                              className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-blue-600 hover:bg-blue-50 border border-dashed border-slate-300 px-2 py-0.5 rounded transition-colors"
                            >
                              <Plus className="w-3 h-3" />
                              Criar ficha
                            </Link>
                          )}
                        </td>
                        <td className="py-3 px-3.5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              onClick={() => handleOpenHistorico(p)}
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50"
                              title="Histórico de alterações de preço"
                            >
                              <History className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              onClick={() => handleOpenEdit(p)}
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                              title="Editar produto"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              onClick={() => confirmDelete(p)}
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-slate-500 hover:text-red-600 hover:bg-red-50"
                              title="Excluir produto"
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

      {/* Modal Cadastro/Edição de Produto */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-[540px] bg-white">
          <form onSubmit={handleSave}>
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-[#0B1F3A] flex items-center gap-2">
                <Package className="w-4 h-4 text-blue-600" />
                {editingProduto ? 'Editar Produto' : 'Novo Produto'}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Preencha as informações do produto e os valores para precificação.
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
                  <Label htmlFor="prod-codigo" className="text-xs font-semibold text-slate-700">
                    Código / SKU
                  </Label>
                  <Input
                    id="prod-codigo"
                    placeholder="Ex: PRD-001"
                    value={formData.codigo}
                    onChange={(e) => setField('codigo', e.target.value)}
                    className="h-9 text-xs uppercase"
                  />
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="prod-nome" className="text-xs font-semibold text-slate-700">
                    Nome do Produto *
                  </Label>
                  <Input
                    id="prod-nome"
                    placeholder="Ex: Gabinete Metálico Slim"
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
                  <Label htmlFor="prod-unidade" className="text-xs font-semibold text-slate-700">
                    Unidade de Medida *
                  </Label>
                  <Input
                    id="prod-unidade"
                    placeholder="UN, KG, M, CX, L, PAR"
                    value={formData.unidade}
                    onChange={(e) => setField('unidade', e.target.value)}
                    className={`h-9 text-xs uppercase ${errors.unidade ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                  />
                  {errors.unidade && (
                    <p className="text-[11px] text-red-600 font-medium">{errors.unidade}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="prod-categoria" className="text-xs font-semibold text-slate-700">
                    Categoria
                  </Label>
                  <Input
                    id="prod-categoria"
                    placeholder="Ex: Gabinetes, Ferragens, Acessórios"
                    value={formData.categoria}
                    onChange={(e) => setField('categoria', e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              {/* Bloco de Formação de Preço */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                  <DollarSign className="w-3.5 h-3.5 text-blue-600" />
                  Formação de Preço
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="prod-custo" className="text-xs font-semibold text-slate-700">
                      Custo Unitário (R$)
                    </Label>
                    <Input
                      id="prod-custo"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={formData.custo}
                      onChange={(e) => handleCustoOrPrecoChange('custo', e.target.value)}
                      className="h-9 text-xs bg-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="prod-margem" className="text-xs font-semibold text-slate-700">
                      Margem Desejada (%)
                    </Label>
                    <Input
                      id="prod-margem"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      max="99.9"
                      step="0.1"
                      placeholder="Ex: 40.0"
                      value={formData.margem_desejada}
                      onChange={(e) => handleCustoOrPrecoChange('margem_desejada', e.target.value)}
                      className="h-9 text-xs bg-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="prod-preco" className="text-xs font-semibold text-slate-700">
                      Preço de Venda (R$)
                    </Label>
                    <Input
                      id="prod-preco"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={formData.preco_venda}
                      onChange={(e) => handleCustoOrPrecoChange('preco_venda', e.target.value)}
                      className="h-9 text-xs bg-white font-bold text-blue-900"
                    />
                  </div>
                </div>

                <p className="text-[11px] text-slate-500 flex items-center gap-1">
                  <Info className="w-3 h-3 text-blue-500 shrink-0" />
                  Ao criar uma Ficha Técnica detalhada, o custo e o preço sugerido serão
                  recalculados automaticamente.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="prod-obs" className="text-xs font-semibold text-slate-700">
                  Observações / Detalhes
                </Label>
                <Textarea
                  id="prod-obs"
                  placeholder="Informações adicionais, especificações técnicas, acabamento etc."
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
                  : editingProduto
                    ? 'Salvar Alterações'
                    : 'Cadastrar Produto'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Vincular Preço Sugerido da Ficha Técnica */}
      <Dialog open={vincularOpen} onOpenChange={setVincularOpen}>
        <DialogContent className="sm:max-w-[480px] bg-white">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#0B1F3A] flex items-center gap-2">
              <LinkIcon className="w-4 h-4 text-blue-600" />
              Vincular Preço Sugerido da Ficha ao Produto
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Escolha qual preço sugerido pela ficha técnica você deseja aplicar ao produto{' '}
              <strong className="text-slate-800">"{produtoParaVincular?.nome}"</strong>.
            </DialogDescription>
          </DialogHeader>

          {fichaParaVincular &&
            produtoParaVincular &&
            (() => {
              const custoTotal = Number(fichaParaVincular.custo_total) || 0
              const margem = Number(fichaParaVincular.margem_desejada) || 0
              const markup =
                fichaParaVincular.markup_desejado !== undefined &&
                fichaParaVincular.markup_desejado !== null
                  ? Number(fichaParaVincular.markup_desejado)
                  : margem < 100 && margem > 0
                    ? (margem / (100 - margem)) * 100
                    : 50

              const precoMargem =
                Number(fichaParaVincular.preco_venda_sugerido) ||
                (margem < 100 && custoTotal > 0 ? custoTotal / (1 - margem / 100) : custoTotal)
              const precoMarkup =
                Number(fichaParaVincular.preco_venda_markup) ||
                (custoTotal > 0 ? custoTotal * (1 + markup / 100) : custoTotal)

              return (
                <div className="space-y-4 py-3">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Custo Total da Ficha:</span>
                      <span className="font-bold text-slate-900">{formatBrl(custoTotal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Preço de Venda Atual no Produto:</span>
                      <span className="font-bold text-slate-700">
                        {formatBrl(produtoParaVincular.preco_venda)}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-slate-700">
                      Selecione o Preço Sugerido para o Produto:
                    </Label>

                    {/* Opção 1: Margem */}
                    <div
                      onClick={() => setTipoPrecoVinculo('margem')}
                      className={`p-3 rounded-lg border cursor-pointer transition-all flex items-center justify-between ${
                        tipoPrecoVinculo === 'margem'
                          ? 'bg-emerald-50/80 border-emerald-500 ring-1 ring-emerald-500'
                          : 'bg-white border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                            tipoPrecoVinculo === 'margem'
                              ? 'border-emerald-600 bg-emerald-600 text-white'
                              : 'border-slate-300 bg-white'
                          }`}
                        >
                          {tipoPrecoVinculo === 'margem' && <Check className="w-2.5 h-2.5" />}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900">
                            Preço Sugerido por Margem ({formatPct(margem)})
                          </p>
                          <p className="text-[11px] text-slate-500">
                            Fórmula divisor: Custo / (1 - Margem)
                          </p>
                        </div>
                      </div>
                      <span className="text-sm font-bold text-emerald-800">
                        {formatBrl(precoMargem)}
                      </span>
                    </div>

                    {/* Opção 2: Markup */}
                    <div
                      onClick={() => setTipoPrecoVinculo('markup')}
                      className={`p-3 rounded-lg border cursor-pointer transition-all flex items-center justify-between ${
                        tipoPrecoVinculo === 'markup'
                          ? 'bg-blue-50/80 border-blue-500 ring-1 ring-blue-500'
                          : 'bg-white border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                            tipoPrecoVinculo === 'markup'
                              ? 'border-blue-600 bg-blue-600 text-white'
                              : 'border-slate-300 bg-white'
                          }`}
                        >
                          {tipoPrecoVinculo === 'markup' && <Check className="w-2.5 h-2.5" />}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900">
                            Preço Sugerido por Markup ({formatPct(markup)})
                          </p>
                          <p className="text-[11px] text-slate-500">
                            Fórmula multiplicador: Custo × (1 + Mk/100)
                          </p>
                        </div>
                      </div>
                      <span className="text-sm font-bold text-blue-800">
                        {formatBrl(precoMarkup)}
                      </span>
                    </div>
                  </div>

                  <div className="text-[11px] text-amber-700 bg-amber-50 p-2.5 rounded border border-amber-200 flex items-start gap-1.5">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                    <span>
                      O preço de venda do produto será atualizado para o valor selecionado e
                      sincronizado em tempo real com todas as telas do sistema.
                    </span>
                  </div>
                </div>
              )
            })()}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setVincularOpen(false)}
              disabled={vinculandoPreco}
              className="text-xs h-9"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleConfirmarVinculoPreco}
              disabled={vinculandoPreco}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-9 shadow-xs"
            >
              {vinculandoPreco ? 'Atualizando...' : 'Confirmar e Atualizar Preço'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Histórico de Preços */}
      <ModalHistoricoPrecos
        open={historicoModalOpen}
        onOpenChange={setHistoricoModalOpen}
        produto={produtoParaHistorico}
        onPrecoUpdated={loadData}
      />

      {/* Confirmação de Exclusão */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-red-600 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" /> Excluir Produto?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-600">
              Tem certeza que deseja excluir o produto{' '}
              <strong className="text-slate-900">"{produtoToDelete?.nome}"</strong>? Se este produto
              possuir uma ficha técnica associada, ela também será removida. Esta ação não pode ser
              desfeita.
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
