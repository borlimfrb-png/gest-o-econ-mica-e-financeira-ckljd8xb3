import React, { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  produtosService,
  materiasPrimasService,
  fichasTecnicasService,
} from '@/services/formacaoPrecoService'
import type {
  ProdutoRecord,
  MateriaPrimaRecord,
  FichaTecnicaRecord,
  ItemFichaTecnica,
} from '@/types/finance'
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
  ClipboardList,
  Plus,
  Pencil,
  Trash2,
  Search,
  Download,
  AlertCircle,
  Percent,
  Layers,
  Package,
  Calculator,
  Coins,
  TrendingUp,
  TrendingDown,
  Info,
  DollarSign,
  PlusCircle,
  X,
  Sparkles,
  Copy,
  BarChart3,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Link as LinkIcon,
  PieChart as PieChartIcon,
  Check,
  Zap,
} from 'lucide-react'
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from 'recharts'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

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

interface ItemFormState {
  materia_prima_id: string
  quantidade: string
  custo_unitario: string
}

interface FichaFormData {
  produto_id: string
  outros_custos: string
  margem_desejada: string
  markup_desejado: string
  observacoes: string
  itens: ItemFormState[]
}

const EMPTY_FICHA: FichaFormData = {
  produto_id: '',
  outros_custos: '0.00',
  margem_desejada: '40',
  markup_desejado: '66.67',
  observacoes: '',
  itens: [
    {
      materia_prima_id: '',
      quantidade: '1',
      custo_unitario: '0',
    },
  ],
}

type FichaFormErrors = Partial<
  Record<'produto_id' | 'itens' | 'general' | 'margem_desejada' | 'markup_desejado', string>
>

export default function CadastroFichaTecnica() {
  const { toast } = useToast()
  const [searchParams] = useSearchParams()

  const [fichas, setFichas] = useState<FichaTecnicaRecord[]>([])
  const [produtos, setProdutos] = useState<ProdutoRecord[]>([])
  const [materias, setMaterias] = useState<MateriaPrimaRecord[]>([])
  const [loading, setLoading] = useState(true)

  // Filtros
  const [search, setSearch] = useState('')

  // Aba ativa: 'fichas' | 'relatorio'
  const [activeTab, setActiveTab] = useState<'fichas' | 'relatorio'>('fichas')

  // Modal Novo / Edição
  const [modalOpen, setModalOpen] = useState(false)
  const [editingFicha, setEditingFicha] = useState<FichaTecnicaRecord | null>(null)
  const [formData, setFormData] = useState<FichaFormData>(EMPTY_FICHA)
  const [errors, setErrors] = useState<FichaFormErrors>({})
  const [saving, setSaving] = useState(false)

  // Modal Exclusão
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [fichaToDelete, setFichaToDelete] = useState<FichaTecnicaRecord | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Visualização rápida de detalhes
  const [selectedFicha, setSelectedFicha] = useState<FichaTecnicaRecord | null>(null)

  // Modal Clonar Ficha
  const [cloneOpen, setCloneOpen] = useState(false)
  const [fichaToClone, setFichaToClone] = useState<FichaTecnicaRecord | null>(null)
  const [cloneNovoNome, setCloneNovoNome] = useState('')
  const [cloneNovoCodigo, setCloneNovoCodigo] = useState('')
  const [cloning, setCloning] = useState(false)

  // Modal Vincular Preço ao Produto
  const [vincularModalOpen, setVincularModalOpen] = useState(false)
  const [fichaParaVincular, setFichaParaVincular] = useState<FichaTecnicaRecord | null>(null)
  const [tipoPrecoVinculo, setTipoPrecoVinculo] = useState<'margem' | 'markup'>('margem')
  const [vinculandoPreco, setVinculandoPreco] = useState(false)

  // Modo de visualização do gráfico de composição de custo: 'donut' | 'bar'
  const [tipoGraficoComposicao, setTipoGraficoComposicao] = useState<'donut' | 'bar'>('donut')

  // Filtros específicos do Relatório de Margem Real
  const [relatorioSearch, setRelatorioSearch] = useState('')
  const [filtroStatusMargem, setFiltroStatusMargem] = useState<
    'todos' | 'acima' | 'abaixo' | 'alerta'
  >('todos')

  const loadData = async () => {
    try {
      setLoading(true)
      const [fList, pList, mList] = await Promise.all([
        fichasTecnicasService.getAll(),
        produtosService.getAll(),
        materiasPrimasService.getAll(),
      ])
      setFichas(fList)
      setProdutos(pList)
      setMaterias(mList)

      // Se passou param ?produto=ID ou ?novoPara=ID na URL
      const prodParam = searchParams.get('produto')
      const novoParaParam = searchParams.get('novoPara')
      if (prodParam) {
        const found = fList.find((f) => f.produto === prodParam)
        if (found) setSelectedFicha(found)
      } else if (novoParaParam) {
        handleOpenNewWithProduct(novoParaParam, pList)
      }
    } catch (err) {
      console.error('Erro ao carregar fichas técnicas:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar',
        description: 'Não foi possível carregar as fichas técnicas.',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useRealtime<FichaTecnicaRecord>('fichas_tecnicas', () => loadData())
  useRealtime<ProdutoRecord>('produtos', () => loadData())
  useRealtime<MateriaPrimaRecord>('materias_primas', () => loadData())

  const produtosMap = useMemo(() => {
    const map = new Map<string, ProdutoRecord>()
    for (const p of produtos) map.set(p.id, p)
    return map
  }, [produtos])

  const materiasMap = useMemo(() => {
    const map = new Map<string, MateriaPrimaRecord>()
    for (const m of materias) map.set(m.id, m)
    return map
  }, [materias])

  // Produtos que ainda não possuem ficha técnica (para novo cadastro)
  const produtosSemFicha = useMemo(() => {
    const comFichaSet = new Set(fichas.map((f) => f.produto))
    return produtos.filter((p) => !comFichaSet.has(p.id))
  }, [produtos, fichas])

  // Fichas filtradas
  const fichasFiltradas = useMemo(() => {
    return fichas.filter((f) => {
      const prod = produtosMap.get(f.produto)
      const prodNome = prod ? prod.nome.toLowerCase() : ''
      const prodCod = prod?.codigo ? prod.codigo.toLowerCase() : ''
      const q = search.toLowerCase()
      return (
        q === '' ||
        prodNome.includes(q) ||
        prodCod.includes(q) ||
        (f.observacoes && f.observacoes.toLowerCase().includes(q))
      )
    })
  }, [fichas, produtosMap, search])

  // Dados calculados para o Relatório de Custos e Margem Real
  const relatorioData = useMemo(() => {
    return fichas.map((f) => {
      const prod = produtosMap.get(f.produto)
      const custoTotal = Number(f.custo_total) || 0
      const custoMP = Number(f.custo_materia_prima) || 0
      const outrosCustos = Number(f.outros_custos) || 0

      // Preço de venda praticado no cadastro do produto (ou sugerido se produto não tem preço)
      const precoVenda = Number(prod?.preco_venda) || Number(f.preco_venda_sugerido) || 0
      const margemDesejada = Number(f.margem_desejada) || Number(prod?.margem_desejada) || 0

      // Margem Real (%) = ((Preço de Venda - Custo Total) / Preço de Venda) * 100
      let margemReal = 0
      let lucroUnitario = 0
      if (precoVenda > 0) {
        lucroUnitario = precoVenda - custoTotal
        margemReal = (lucroUnitario / precoVenda) * 100
      }

      // Diferença em pontos percentuais (Margem Real - Margem Desejada)
      const diffMargem = margemReal - margemDesejada

      // Status de desempenho de margem
      let statusMargem: 'acima' | 'abaixo' | 'critica' | 'atingida' = 'atingida'
      if (margemReal < 0) {
        statusMargem = 'critica'
      } else if (diffMargem >= 0.5) {
        statusMargem = 'acima'
      } else if (diffMargem <= -0.5) {
        statusMargem = 'abaixo'
      } else {
        statusMargem = 'atingida'
      }

      return {
        ficha: f,
        produto: prod,
        produtoNome: prod?.nome || 'Produto não encontrado',
        produtoCodigo: prod?.codigo || '',
        unidade: prod?.unidade || 'UN',
        categoria: prod?.categoria || '',
        itensCount: f.itens?.length || 0,
        custoMP,
        outrosCustos,
        custoTotal,
        precoVenda,
        precoSugerido: Number(f.preco_venda_sugerido) || 0,
        margemDesejada,
        margemReal,
        lucroUnitario,
        diffMargem,
        statusMargem,
      }
    })
  }, [fichas, produtosMap])

  // Relatório filtrado
  const relatorioFiltrado = useMemo(() => {
    return relatorioData.filter((item) => {
      const q = relatorioSearch.toLowerCase()
      const matchText =
        q === '' ||
        item.produtoNome.toLowerCase().includes(q) ||
        item.produtoCodigo.toLowerCase().includes(q) ||
        item.categoria.toLowerCase().includes(q)

      const matchStatus =
        filtroStatusMargem === 'todos' ||
        (filtroStatusMargem === 'acima' &&
          (item.statusMargem === 'acima' || item.statusMargem === 'atingida')) ||
        (filtroStatusMargem === 'abaixo' && item.statusMargem === 'abaixo') ||
        (filtroStatusMargem === 'alerta' && item.statusMargem === 'critica')

      return matchText && matchStatus
    })
  }, [relatorioData, relatorioSearch, filtroStatusMargem])

  // Estatísticas do Relatório de Custos e Margem Real
  const relatorioStats = useMemo(() => {
    const total = relatorioData.length
    if (total === 0) {
      return {
        total: 0,
        margemMediaReal: 0,
        margemMediaDesejada: 0,
        acimaOuAtingida: 0,
        abaixoCount: 0,
        criticaCount: 0,
      }
    }

    const somaMargemReal = relatorioData.reduce((acc, it) => acc + it.margemReal, 0)
    const somaMargemDesejada = relatorioData.reduce((acc, it) => acc + it.margemDesejada, 0)
    const acimaOuAtingida = relatorioData.filter(
      (it) => it.statusMargem === 'acima' || it.statusMargem === 'atingida',
    ).length
    const abaixoCount = relatorioData.filter((it) => it.statusMargem === 'abaixo').length
    const criticaCount = relatorioData.filter((it) => it.statusMargem === 'critica').length

    return {
      total,
      margemMediaReal: somaMargemReal / total,
      margemMediaDesejada: somaMargemDesejada / total,
      acimaOuAtingida,
      abaixoCount,
      criticaCount,
    }
  }, [relatorioData])

  // Estatísticas de Fichas
  const stats = useMemo(() => {
    const total = fichas.length
    const custoMedioMP =
      fichas.length > 0
        ? fichas.reduce((acc, f) => acc + (Number(f.custo_materia_prima) || 0), 0) / fichas.length
        : 0
    const custoTotalMedio =
      fichas.length > 0
        ? fichas.reduce((acc, f) => acc + (Number(f.custo_total) || 0), 0) / fichas.length
        : 0
    const precoMedioSugerido =
      fichas.length > 0
        ? fichas.reduce((acc, f) => acc + (Number(f.preco_venda_sugerido) || 0), 0) / fichas.length
        : 0

    return { total, custoMedioMP, custoTotalMedio, precoMedioSugerido }
  }, [fichas])

  // Cálculos em tempo real para o formulário aberto
  const formCalculations = useMemo(() => {
    let custoMP = 0
    const itensValidos: ItemFichaTecnica[] = []

    for (const item of formData.itens) {
      if (!item.materia_prima_id) continue
      const mp = materiasMap.get(item.materia_prima_id)
      const qtd = Number(item.quantidade.replace(',', '.')) || 0
      const unit =
        item.custo_unitario.trim() !== ''
          ? Number(item.custo_unitario.replace(',', '.'))
          : mp?.custo_unitario || 0
      const subtotal = qtd * unit
      custoMP += subtotal

      itensValidos.push({
        materia_prima_id: item.materia_prima_id,
        materia_prima_nome: mp?.nome || 'Insumo',
        unidade: mp?.unidade || 'UN',
        custo_unitario: unit,
        quantidade: qtd,
        subtotal,
      })
    }

    const outros = Number(formData.outros_custos.replace(',', '.')) || 0
    const custoTotal = custoMP + outros
    const margem = Number(formData.margem_desejada.replace(',', '.')) || 0
    const markup = Number(formData.markup_desejado.replace(',', '.')) || 0

    let precoSugeridoMargem = 0
    if (margem < 100 && margem >= 0 && custoTotal > 0) {
      // Fórmula por Margem (divisor): Custo / (1 - Margem/100)
      precoSugeridoMargem = custoTotal / (1 - margem / 100)
    } else if (custoTotal > 0) {
      precoSugeridoMargem = custoTotal
    }

    // Fórmula por Markup sobre custo total (multiplicador): Custo Total * (1 + markup/100)
    let precoSugeridoMarkup = 0
    if (custoTotal > 0) {
      precoSugeridoMarkup = custoTotal * (1 + (markup >= 0 ? markup : 0) / 100)
    }

    const lucroBrutoMargem = precoSugeridoMargem - custoTotal
    const lucroBrutoMarkup = precoSugeridoMarkup - custoTotal

    return {
      custoMP,
      outros,
      custoTotal,
      margem,
      markup,
      precoSugeridoMargem,
      precoSugeridoMarkup,
      precoSugerido: precoSugeridoMargem,
      lucroBrutoMargem,
      lucroBrutoMarkup,
      itensValidos,
    }
  }, [formData, materiasMap])

  // Handlers do Form
  const handleOpenNew = () => {
    setEditingFicha(null)
    setFormData(EMPTY_FICHA)
    setErrors({})
    setModalOpen(true)
  }

  const handleOpenNewWithProduct = (prodId: string, pList: ProdutoRecord[] = produtos) => {
    setEditingFicha(null)
    const prod = pList.find((p) => p.id === prodId)
    const margemDefault =
      prod?.margem_desejada !== undefined && prod?.margem_desejada !== null
        ? Number(prod.margem_desejada)
        : 40
    const markupDefault =
      margemDefault < 100 && margemDefault > 0 ? (margemDefault / (100 - margemDefault)) * 100 : 50

    setFormData({
      ...EMPTY_FICHA,
      produto_id: prodId,
      margem_desejada: String(margemDefault),
      markup_desejado: markupDefault.toFixed(2),
    })
    setErrors({})
    setModalOpen(true)
  }

  const handleOpenEdit = (f: FichaTecnicaRecord) => {
    setEditingFicha(f)
    const itensForm: ItemFormState[] =
      f.itens && f.itens.length > 0
        ? f.itens.map((it) => ({
            materia_prima_id: it.materia_prima_id,
            quantidade: String(it.quantidade),
            custo_unitario: String(it.custo_unitario),
          }))
        : [{ materia_prima_id: '', quantidade: '1', custo_unitario: '0' }]

    const margemVal =
      f.margem_desejada !== undefined && f.margem_desejada !== null ? Number(f.margem_desejada) : 40
    const markupVal =
      f.markup_desejado !== undefined && f.markup_desejado !== null
        ? Number(f.markup_desejado)
        : margemVal < 100 && margemVal > 0
          ? (margemVal / (100 - margemVal)) * 100
          : 50

    setFormData({
      produto_id: f.produto,
      outros_custos:
        f.outros_custos !== undefined && f.outros_custos !== null ? String(f.outros_custos) : '0',
      margem_desejada: String(margemVal),
      markup_desejado: markupVal.toFixed(2),
      observacoes: f.observacoes || '',
      itens: itensForm,
    })
    setErrors({})
    setModalOpen(true)
  }

  const handleAddItem = () => {
    setFormData((prev) => ({
      ...prev,
      itens: [
        ...prev.itens,
        {
          materia_prima_id: '',
          quantidade: '1',
          custo_unitario: '0',
        },
      ],
    }))
  }

  const handleRemoveItem = (index: number) => {
    setFormData((prev) => {
      const updated = [...prev.itens]
      updated.splice(index, 1)
      if (updated.length === 0) {
        updated.push({ materia_prima_id: '', quantidade: '1', custo_unitario: '0' })
      }
      return { ...prev, itens: updated }
    })
  }

  const handleItemChange = (index: number, field: keyof ItemFormState, value: string) => {
    setFormData((prev) => {
      const updated = [...prev.itens]
      const current = { ...updated[index], [field]: value }

      // Se mudou a matéria-prima, auto-preenche o custo unitário atual dela
      if (field === 'materia_prima_id') {
        const mp = materiasMap.get(value)
        if (mp && mp.custo_unitario !== undefined) {
          current.custo_unitario = String(mp.custo_unitario)
        }
      }

      updated[index] = current
      return { ...prev, itens: updated }
    })
  }

  const validate = (): boolean => {
    const errs: FichaFormErrors = {}
    if (!formData.produto_id) {
      errs.produto_id = 'Selecione o produto desta ficha técnica'
    }

    const validItens = formData.itens.filter(
      (it) => it.materia_prima_id && Number(it.quantidade.replace(',', '.')) > 0,
    )
    if (validItens.length === 0) {
      errs.itens = 'Adicione ao menos uma matéria-prima com quantidade maior que zero'
    }

    const margem = Number(formData.margem_desejada.replace(',', '.'))
    if (isNaN(margem) || margem < 0 || margem >= 100) {
      errs.margem_desejada = 'A margem desejada deve estar entre 0% e 99.9%'
    }

    const markup = Number(formData.markup_desejado.replace(',', '.'))
    if (isNaN(markup) || markup < 0) {
      errs.markup_desejado = 'Informe um percentual de markup válido (>= 0%)'
    }

    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setSaving(true)
    try {
      const {
        custoMP,
        outros,
        custoTotal,
        margem,
        markup,
        precoSugeridoMargem,
        precoSugeridoMarkup,
        itensValidos,
      } = formCalculations

      const payload = {
        produto: formData.produto_id,
        itens: itensValidos,
        custo_materia_prima: custoMP,
        outros_custos: outros,
        custo_total: custoTotal,
        margem_desejada: margem,
        preco_venda_sugerido: Math.round(precoSugeridoMargem * 100) / 100,
        markup_desejado: markup,
        preco_venda_markup: Math.round(precoSugeridoMarkup * 100) / 100,
        observacoes: formData.observacoes.trim() || undefined,
      }

      if (editingFicha) {
        await fichasTecnicasService.update(editingFicha.id, payload)
        toast({
          title: 'Ficha Técnica atualizada',
          description: 'A composição e os preços foram recalculados com sucesso.',
        })
      } else {
        await fichasTecnicasService.create(payload)
        toast({
          title: 'Ficha Técnica criada',
          description: 'A composição do produto foi cadastrada com sucesso.',
        })
      }

      setModalOpen(false)
      loadData()
    } catch (err: any) {
      console.error(err)
      setErrors((prev) => ({
        ...prev,
        general: err?.message || 'Erro ao salvar a ficha técnica.',
      }))
    } finally {
      setSaving(false)
    }
  }

  // Handlers para Vincular Preço ao Produto
  const handleOpenVincularPreco = (f: FichaTecnicaRecord) => {
    setFichaParaVincular(f)
    setTipoPrecoVinculo('margem')
    setVincularModalOpen(true)
  }

  const handleConfirmarVinculoPreco = async () => {
    if (!fichaParaVincular) return
    const prod = produtosMap.get(fichaParaVincular.produto)
    if (!prod) return

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
      await fichasTecnicasService.vincularPrecoAoProduto(prod.id, precoFinal, margemFinal)
      toast({
        title: 'Preço vinculado com sucesso!',
        description: `O preço de venda de "${prod.nome}" foi atualizado para ${formatBrl(
          precoFinal,
        )} (${tipoPrecoVinculo === 'margem' ? 'por margem' : 'por markup'}).`,
      })
      setVincularModalOpen(false)
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

  // Handlers para Clonagem de Ficha
  const handleOpenClone = (f: FichaTecnicaRecord) => {
    const prod = produtosMap.get(f.produto)
    setFichaToClone(f)
    setCloneNovoNome(prod ? `${prod.nome} (cópia)` : 'Produto (cópia)')
    setCloneNovoCodigo(prod?.codigo ? `${prod.codigo}-CP` : '')
    setCloneOpen(true)
  }

  const handleConfirmClone = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fichaToClone) return
    if (!cloneNovoNome.trim()) {
      toast({
        variant: 'destructive',
        title: 'Nome obrigatório',
        description: 'Informe o nome para o novo produto da ficha clonada.',
      })
      return
    }

    setCloning(true)
    try {
      const novaFicha = await fichasTecnicasService.clone(fichaToClone.id, {
        criarNovoProduto: true,
        novoProdutoNome: cloneNovoNome.trim(),
        novoProdutoCodigo: cloneNovoCodigo.trim() || undefined,
      })

      toast({
        title: 'Ficha Técnica clonada com sucesso!',
        description: `Criada nova ficha e produto "${cloneNovoNome}". Você já pode editar a composição.`,
      })

      setCloneOpen(false)
      setFichaToClone(null)
      await loadData()
      setSelectedFicha(novaFicha)
    } catch (err: any) {
      console.error(err)
      toast({
        variant: 'destructive',
        title: 'Erro ao clonar',
        description: err?.message || 'Não foi possível clonar a ficha técnica.',
      })
    } finally {
      setCloning(false)
    }
  }

  const confirmDelete = (f: FichaTecnicaRecord) => {
    setFichaToDelete(f)
    setDeleteOpen(true)
  }

  const handleDelete = async () => {
    if (!fichaToDelete) return
    setDeleting(true)
    try {
      await fichasTecnicasService.delete(fichaToDelete.id)
      toast({
        title: 'Ficha Técnica excluída',
        description: 'A ficha técnica foi removida.',
      })
      if (selectedFicha?.id === fichaToDelete.id) setSelectedFicha(null)
      setDeleteOpen(false)
      setFichaToDelete(null)
      loadData()
    } catch (err: any) {
      console.error(err)
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir',
        description: err?.message || 'Não foi possível excluir a ficha técnica.',
      })
    } finally {
      setDeleting(false)
    }
  }

  // Exportar CSV de Fichas
  const handleExportCsv = () => {
    if (fichas.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Nada para exportar',
        description: 'Não há fichas técnicas cadastradas.',
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
      'Código Produto',
      'Produto',
      'Qtd de Insumos',
      'Custo Matéria-Prima (R$)',
      'Outros Custos (R$)',
      'Custo Total (R$)',
      'Margem Desejada (%)',
      'Preço Sugerido por Margem (R$)',
      'Markup Desejado (%)',
      'Preço Sugerido por Markup (R$)',
      'Observações',
    ]

    const linhas = [headers.map(escapeCsv).join(';')]

    for (const f of fichasFiltradas) {
      const prod = produtosMap.get(f.produto)
      const custoTotal = Number(f.custo_total) || 0
      const markupVal =
        f.markup_desejado !== undefined && f.markup_desejado !== null
          ? f.markup_desejado
          : f.margem_desejada && f.margem_desejada < 100
            ? (f.margem_desejada / (100 - f.margem_desejada)) * 100
            : 50
      const precoMarkup =
        f.preco_venda_markup || (custoTotal > 0 ? custoTotal * (1 + markupVal / 100) : 0)

      linhas.push(
        [
          prod?.codigo || '',
          prod?.nome || 'Produto',
          f.itens?.length || 0,
          fmtNum(f.custo_materia_prima),
          fmtNum(f.outros_custos),
          fmtNum(f.custo_total),
          f.margem_desejada !== undefined ? f.margem_desejada.toFixed(1) + '%' : '',
          fmtNum(f.preco_venda_sugerido),
          markupVal !== undefined ? markupVal.toFixed(1) + '%' : '',
          fmtNum(precoMarkup),
          f.observacoes || '',
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
    link.setAttribute('download', `fichas-tecnicas-${dataStr}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    toast({
      title: 'Exportação concluída',
      description: 'O arquivo CSV com as fichas técnicas foi baixado.',
    })
  }

  // Exportar CSV do Relatório de Custos e Margem Real
  const handleExportRelatorioCsv = () => {
    if (relatorioData.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Nada para exportar',
        description: 'Não há produtos com ficha técnica para gerar relatório.',
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
      'Categoria',
      'Unidade',
      'Qtd Insumos',
      'Custo Matéria-Prima (R$)',
      'Outros Custos (R$)',
      'Custo Total Unitário (R$)',
      'Preço de Venda Praticado (R$)',
      'Preço Sugerido por Margem (R$)',
      'Preço Sugerido por Markup (R$)',
      'Markup Desejado (%)',
      'Lucro Unitário (R$)',
      'Margem Desejada (%)',
      'Margem Real (%)',
      'Diferença Margem (p.p.)',
      'Status Margem',
    ]

    const linhas = [headers.map(escapeCsv).join(';')]

    for (const item of relatorioFiltrado) {
      const statusLabel =
        item.statusMargem === 'critica'
          ? 'Margem Negativa / Prejuízo'
          : item.statusMargem === 'abaixo'
            ? 'Abaixo do Desejado'
            : item.statusMargem === 'atingida'
              ? 'Meta Atingida'
              : 'Acima do Desejado'

      const mkDesejado =
        item.ficha.markup_desejado !== undefined && item.ficha.markup_desejado !== null
          ? item.ficha.markup_desejado
          : item.margemDesejada < 100 && item.margemDesejada > 0
            ? (item.margemDesejada / (100 - item.margemDesejada)) * 100
            : 50

      const precoMk =
        item.ficha.preco_venda_markup ||
        (item.custoTotal > 0 ? item.custoTotal * (1 + mkDesejado / 100) : 0)

      linhas.push(
        [
          item.produtoCodigo,
          item.produtoNome,
          item.categoria,
          item.unidade,
          item.itensCount,
          fmtNum(item.custoMP),
          fmtNum(item.outrosCustos),
          fmtNum(item.custoTotal),
          fmtNum(item.precoVenda),
          fmtNum(item.precoSugerido),
          fmtNum(precoMk),
          mkDesejado.toFixed(1) + '%',
          fmtNum(item.lucroUnitario),
          item.margemDesejada.toFixed(2) + '%',
          item.margemReal.toFixed(2) + '%',
          (item.diffMargem >= 0 ? '+' : '') + item.diffMargem.toFixed(2) + ' p.p.',
          statusLabel,
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
    link.setAttribute('download', `relatorio-custos-margem-real-${dataStr}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    toast({
      title: 'Relatório exportado',
      description: 'O arquivo CSV do relatório de custos e margem real foi baixado.',
    })
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Abas Superiores: Gestão de Fichas vs Relatório de Custos e Margem Real */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <h2 className="text-lg font-bold text-[#0B1F3A] flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-blue-600" />
            Fichas Técnicas & Formação de Custo
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Gerencie composições de produtos, clone fichas e acompanhe a margem real praticada vs
            desejada.
          </p>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as any)}
          className="w-full sm:w-auto"
        >
          <TabsList className="bg-slate-100 p-1 w-full sm:w-auto grid grid-cols-2">
            <TabsTrigger
              value="fichas"
              className="text-xs font-semibold data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-xs gap-1.5"
            >
              <ClipboardList className="w-3.5 h-3.5" />
              Fichas Técnicas ({fichas.length})
            </TabsTrigger>
            <TabsTrigger
              value="relatorio"
              className="text-xs font-semibold data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-xs gap-1.5"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              Relatório de Margem Real
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {activeTab === 'fichas' ? (
        <>
          {/* Cards de Métricas de Fichas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-white border-slate-200 shadow-xs">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500 font-medium">Fichas Cadastradas</p>
                  <h3 className="text-xl font-bold text-[#0B1F3A] mt-1">{stats.total}</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">Produtos parametrizados</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <ClipboardList className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border-slate-200 shadow-xs">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500 font-medium">Custo Médio MP</p>
                  <h3 className="text-xl font-bold text-amber-700 mt-1">
                    {formatBrl(stats.custoMedioMP)}
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">Matérias-primas</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Layers className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border-slate-200 shadow-xs">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500 font-medium">Custo Total Médio</p>
                  <h3 className="text-xl font-bold text-slate-900 mt-1">
                    {formatBrl(stats.custoTotalMedio)}
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">MP + Outros custos</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
                  <Coins className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border-slate-200 shadow-xs">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500 font-medium">Preço Sugerido Médio</p>
                  <h3 className="text-xl font-bold text-emerald-700 mt-1">
                    {formatBrl(stats.precoMedioSugerido)}
                  </h3>
                  <p className="text-[11px] text-emerald-600 font-medium mt-0.5">
                    Com margem aplicada
                  </p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Lista de Fichas Técnicas */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
            {/* Coluna 1 & 2: Tabela Principal de Fichas */}
            <div className="xl:col-span-2 space-y-6">
              <Card className="bg-white border-slate-200 shadow-xs">
                <CardHeader className="pb-3 border-b border-slate-100">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <CardTitle className="text-base font-bold text-[#0B1F3A] flex items-center gap-2">
                        <ClipboardList className="w-4 h-4 text-blue-600" />
                        Fichas Técnicas de Produtos
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Estrutura de custo, lista de insumos e preço de venda sugerido.
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
                        Nova Ficha Técnica
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-4">
                  <div className="mb-4">
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <Input
                        placeholder="Buscar ficha por produto ou código..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9 h-9 text-xs"
                      />
                    </div>
                  </div>

                  {loading ? (
                    <div className="py-16 flex justify-center items-center">
                      <div className="w-7 h-7 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : fichasFiltradas.length === 0 ? (
                    <div className="py-16 text-center">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
                        <ClipboardList className="w-6 h-6" />
                      </div>
                      <h4 className="text-sm font-semibold text-slate-800">
                        Nenhuma ficha técnica cadastrada
                      </h4>
                      <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                        {fichas.length === 0
                          ? 'Crie a primeira ficha técnica vinculando um produto aos seus insumos de fabricação.'
                          : 'Nenhum resultado para os termos pesquisados.'}
                      </p>
                      {fichas.length === 0 && (
                        <Button
                          onClick={handleOpenNew}
                          size="sm"
                          className="mt-4 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          <Plus className="w-3.5 h-3.5 mr-1.5" />
                          Criar Primeira Ficha Técnica
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border border-slate-200">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-700 font-semibold">
                            <th className="py-3 px-3.5">Produto</th>
                            <th className="py-3 px-3.5 text-center">Itens</th>
                            <th className="py-3 px-3.5 text-right">Custo MP (R$)</th>
                            <th className="py-3 px-3.5 text-right">Outros (R$)</th>
                            <th className="py-3 px-3.5 text-right">Custo Total (R$)</th>
                            <th className="py-3 px-3.5 text-right">Margem (%)</th>
                            <th className="py-3 px-3.5 text-right">Preço Sugerido (R$)</th>
                            <th className="py-3 px-3.5 text-right">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {fichasFiltradas.map((f) => {
                            const prod = produtosMap.get(f.produto)
                            const isSel = selectedFicha?.id === f.id

                            return (
                              <tr
                                key={f.id}
                                onClick={() => setSelectedFicha(f)}
                                className={`cursor-pointer transition-colors ${
                                  isSel ? 'bg-blue-50/90' : 'hover:bg-slate-50/70'
                                }`}
                              >
                                <td className="py-3 px-3.5">
                                  <div className="font-semibold text-slate-900">
                                    {prod?.nome || 'Produto não encontrado'}
                                  </div>
                                  <div className="text-[11px] text-slate-400 font-mono">
                                    {prod?.codigo || 'Sem código'} · {prod?.unidade || 'UN'}
                                  </div>
                                </td>
                                <td className="py-3 px-3.5 text-center whitespace-nowrap">
                                  <Badge variant="outline" className="text-[10px] bg-slate-50">
                                    {f.itens?.length || 0} item(ns)
                                  </Badge>
                                </td>
                                <td className="py-3 px-3.5 text-right font-medium text-slate-700 whitespace-nowrap">
                                  {formatBrl(f.custo_materia_prima)}
                                </td>
                                <td className="py-3 px-3.5 text-right text-slate-500 whitespace-nowrap">
                                  {formatBrl(f.outros_custos)}
                                </td>
                                <td className="py-3 px-3.5 text-right font-bold text-slate-900 whitespace-nowrap">
                                  {formatBrl(f.custo_total)}
                                </td>
                                <td className="py-3 px-3.5 text-right font-semibold text-amber-700 whitespace-nowrap">
                                  <div>{formatPct(f.margem_desejada)}</div>
                                  <div className="text-[10px] text-slate-400 font-normal">
                                    Mk:{' '}
                                    {formatPct(
                                      f.markup_desejado ??
                                        (f.margem_desejada && f.margem_desejada < 100
                                          ? (f.margem_desejada / (100 - f.margem_desejada)) * 100
                                          : 50),
                                    )}
                                  </div>
                                </td>
                                <td className="py-3 px-3.5 text-right whitespace-nowrap">
                                  <div className="font-bold text-emerald-700">
                                    {formatBrl(f.preco_venda_sugerido)}
                                  </div>
                                  <div
                                    className="text-[10px] text-blue-600 font-medium"
                                    title="Preço Sugerido por Markup"
                                  >
                                    Mk:{' '}
                                    {formatBrl(
                                      f.preco_venda_markup ||
                                        (Number(f.custo_total) > 0
                                          ? Number(f.custo_total) *
                                            (1 +
                                              (f.markup_desejado ??
                                                (f.margem_desejada && f.margem_desejada < 100
                                                  ? (f.margem_desejada /
                                                      (100 - f.margem_desejada)) *
                                                    100
                                                  : 50)) /
                                                100)
                                          : 0),
                                    )}
                                  </div>
                                </td>
                                <td className="py-3 px-3.5 text-right whitespace-nowrap">
                                  <div className="flex items-center justify-end gap-1">
                                    <Button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleOpenVincularPreco(f)
                                      }}
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 px-2 text-[11px] text-blue-700 hover:text-blue-800 hover:bg-blue-50 font-semibold"
                                      title="Vincular preço sugerido ao produto"
                                    >
                                      <LinkIcon className="w-3 h-3 mr-1" />
                                      Vincular
                                    </Button>
                                    <Button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleOpenClone(f)
                                      }}
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 w-7 p-0 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50"
                                      title="Clonar ficha técnica (criar variação)"
                                    >
                                      <Copy className="w-3.5 h-3.5" />
                                    </Button>
                                    <Button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleOpenEdit(f)
                                      }}
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 w-7 p-0 text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                                      title="Editar ficha técnica"
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </Button>
                                    <Button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        confirmDelete(f)
                                      }}
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 w-7 p-0 text-slate-500 hover:text-red-600 hover:bg-red-50"
                                      title="Excluir ficha técnica"
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
            </div>

            {/* Coluna 3: Detalhamento da Ficha Selecionada */}
            <div className="space-y-6">
              {!selectedFicha ? (
                <Card className="bg-white border-dashed border-slate-300 shadow-xs">
                  <CardContent className="py-16 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
                      <Calculator className="w-6 h-6" />
                    </div>
                    <h4 className="text-sm font-semibold text-slate-800">Selecione uma Ficha</h4>
                    <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                      Clique em qualquer ficha técnica da tabela para visualizar a composição
                      detalhada de insumos e fórmula de precificação.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                (() => {
                  const prod = produtosMap.get(selectedFicha.produto)
                  const itens = selectedFicha.itens || []
                  const custoTotal = Number(selectedFicha.custo_total) || 0
                  const custoMP = Number(selectedFicha.custo_materia_prima) || 0
                  const outrosCustos = Number(selectedFicha.outros_custos) || 0
                  const margem = Number(selectedFicha.margem_desejada) || 0
                  const markup =
                    selectedFicha.markup_desejado !== undefined &&
                    selectedFicha.markup_desejado !== null
                      ? Number(selectedFicha.markup_desejado)
                      : margem < 100 && margem > 0
                        ? (margem / (100 - margem)) * 100
                        : 50

                  const precoMargem =
                    Number(selectedFicha.preco_venda_sugerido) ||
                    (margem < 100 && custoTotal > 0 ? custoTotal / (1 - margem / 100) : custoTotal)

                  const precoMarkup =
                    Number(selectedFicha.preco_venda_markup) ||
                    (custoTotal > 0 ? custoTotal * (1 + markup / 100) : custoTotal)

                  // Preparação de dados categorizados para o gráfico de composição
                  // Agrupa insumos por categoria (ex: Insumos principais, Embalagem, etc.) ou lista itens + outros custos
                  const categoriasInsumosMap = new Map<string, number>()
                  for (const it of itens) {
                    const mp = materiasMap.get(it.materia_prima_id)
                    const catName = mp?.categoria?.trim() || 'Matéria-Prima Direta'
                    const prev = categoriasInsumosMap.get(catName) || 0
                    categoriasInsumosMap.set(catName, prev + (it.subtotal || 0))
                  }

                  const chartDataList: Array<{ name: string; value: number; color: string }> = []
                  const PALETTE = ['#2563EB', '#0D9488', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4']
                  let pIdx = 0

                  if (categoriasInsumosMap.size > 0) {
                    categoriasInsumosMap.forEach((val, key) => {
                      if (val > 0) {
                        chartDataList.push({
                          name: key,
                          value: Math.round(val * 100) / 100,
                          color: PALETTE[pIdx % PALETTE.length],
                        })
                        pIdx++
                      }
                    })
                  } else if (custoMP > 0) {
                    chartDataList.push({
                      name: 'Matéria-Prima',
                      value: Math.round(custoMP * 100) / 100,
                      color: '#2563EB',
                    })
                  }

                  if (outrosCustos > 0) {
                    chartDataList.push({
                      name: 'Outros Custos / MOD',
                      value: Math.round(outrosCustos * 100) / 100,
                      color: '#F97316',
                    })
                  }

                  // Se tudo estiver zerado
                  if (chartDataList.length === 0) {
                    chartDataList.push({
                      name: 'Sem custo apurado',
                      value: 1,
                      color: '#CBD5E1',
                    })
                  }

                  const precoVendaAtualProd = Number(prod?.preco_venda) || 0

                  return (
                    <Card className="bg-white border-slate-200 shadow-xs">
                      <CardHeader className="pb-3 border-b border-slate-100">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                              Ficha Técnica Detalhada
                            </span>
                            <CardTitle className="text-base font-bold text-[#0B1F3A] mt-1.5">
                              {prod?.nome || 'Produto'}
                            </CardTitle>
                            <CardDescription className="text-xs">
                              {prod?.codigo ? `Código: ${prod.codigo} · ` : ''}Unidade:{' '}
                              {prod?.unidade || 'UN'}
                              {prod?.categoria ? ` · Categoria: ${prod.categoria}` : ''}
                            </CardDescription>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              onClick={() => handleOpenClone(selectedFicha)}
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 border-emerald-200"
                              title="Clonar esta ficha técnica"
                            >
                              <Copy className="w-3 h-3 mr-1" />
                              Clonar
                            </Button>
                            <Button
                              onClick={() => handleOpenEdit(selectedFicha)}
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs font-semibold"
                            >
                              <Pencil className="w-3 h-3 mr-1" />
                              Editar
                            </Button>
                          </div>
                        </div>
                      </CardHeader>

                      <CardContent className="p-4 space-y-5">
                        {/* 1. GRÁFICO DE COMPOSIÇÃO DE CUSTO DA FICHA TÉCNICA */}
                        <div className="p-3.5 bg-slate-50/90 border border-slate-200 rounded-xl space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                              <PieChartIcon className="w-3.5 h-3.5 text-blue-600" />
                              Composição do Custo Total
                            </h4>
                            <div className="flex items-center bg-white border border-slate-200 rounded p-0.5 text-[10px]">
                              <button
                                type="button"
                                onClick={() => setTipoGraficoComposicao('donut')}
                                className={`px-2 py-0.5 rounded font-semibold transition-colors ${
                                  tipoGraficoComposicao === 'donut'
                                    ? 'bg-blue-600 text-white'
                                    : 'text-slate-600 hover:text-slate-900'
                                }`}
                              >
                                Rosca
                              </button>
                              <button
                                type="button"
                                onClick={() => setTipoGraficoComposicao('bar')}
                                className={`px-2 py-0.5 rounded font-semibold transition-colors ${
                                  tipoGraficoComposicao === 'bar'
                                    ? 'bg-blue-600 text-white'
                                    : 'text-slate-600 hover:text-slate-900'
                                }`}
                              >
                                Barras
                              </button>
                            </div>
                          </div>

                          {custoTotal > 0 ? (
                            <>
                              <div className="h-44 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                  {tipoGraficoComposicao === 'donut' ? (
                                    <PieChart>
                                      <Tooltip
                                        formatter={(val: any, name: any) => [
                                          `${formatBrl(Number(val))} (${(
                                            (Number(val) / custoTotal) *
                                            100
                                          ).toFixed(1)}%)`,
                                          name,
                                        ]}
                                        contentStyle={{
                                          backgroundColor: '#0F172A',
                                          color: '#fff',
                                          borderRadius: '8px',
                                          fontSize: '11px',
                                          border: 'none',
                                        }}
                                      />
                                      <Pie
                                        data={chartDataList}
                                        dataKey="value"
                                        nameKey="name"
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={36}
                                        outerRadius={65}
                                        paddingAngle={3}
                                      >
                                        {chartDataList.map((entry, index) => (
                                          <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                      </Pie>
                                    </PieChart>
                                  ) : (
                                    <BarChart
                                      data={chartDataList}
                                      layout="vertical"
                                      margin={{ top: 5, right: 20, left: 20, bottom: 5 }}
                                    >
                                      <CartesianGrid
                                        strokeDasharray="3 3"
                                        horizontal={false}
                                        stroke="#E2E8F0"
                                      />
                                      <XAxis
                                        type="number"
                                        tickFormatter={(v) => `R$ ${v}`}
                                        fontSize={10}
                                      />
                                      <YAxis
                                        type="category"
                                        dataKey="name"
                                        width={80}
                                        fontSize={10}
                                      />
                                      <Tooltip
                                        formatter={(val: any) => [formatBrl(Number(val)), 'Custo']}
                                        contentStyle={{
                                          backgroundColor: '#0F172A',
                                          color: '#fff',
                                          borderRadius: '8px',
                                          fontSize: '11px',
                                        }}
                                      />
                                      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                                        {chartDataList.map((entry, index) => (
                                          <Cell key={`cell-bar-${index}`} fill={entry.color} />
                                        ))}
                                      </Bar>
                                    </BarChart>
                                  )}
                                </ResponsiveContainer>
                              </div>

                              {/* Legenda com R$ e % */}
                              <div className="space-y-1.5 pt-1 border-t border-slate-200">
                                {chartDataList.map((item, idx) => {
                                  const pct = custoTotal > 0 ? (item.value / custoTotal) * 100 : 0
                                  return (
                                    <div
                                      key={idx}
                                      className="flex items-center justify-between text-xs text-slate-700"
                                    >
                                      <div className="flex items-center gap-1.5 truncate pr-2">
                                        <span
                                          className="w-2.5 h-2.5 rounded-full shrink-0"
                                          style={{ backgroundColor: item.color }}
                                        />
                                        <span className="truncate">{item.name}</span>
                                      </div>
                                      <div className="font-semibold shrink-0 text-slate-900">
                                        {formatBrl(item.value)}{' '}
                                        <span className="text-[11px] text-slate-400 font-normal">
                                          ({pct.toFixed(1)}%)
                                        </span>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            </>
                          ) : (
                            <div className="py-6 text-center text-xs text-slate-400">
                              Nenhum custo cadastrado nesta ficha para gerar gráfico.
                            </div>
                          )}
                        </div>

                        {/* 2. BOTÃO E PAINEL: VINCULAR PREÇO AO PRODUTO */}
                        <div className="p-3.5 bg-gradient-to-br from-blue-50/80 to-indigo-50/70 border border-blue-200 rounded-xl space-y-2.5">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block">
                                Integração Produto
                              </span>
                              <span className="text-xs font-bold text-slate-900">
                                Preço no Catálogo: {formatBrl(precoVendaAtualProd)}
                              </span>
                            </div>
                            <Button
                              type="button"
                              onClick={() => handleOpenVincularPreco(selectedFicha)}
                              size="sm"
                              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-8 shadow-xs gap-1.5"
                            >
                              <LinkIcon className="w-3.5 h-3.5" />
                              Vincular Preço ao Produto
                            </Button>
                          </div>
                          <p className="text-[11px] text-slate-600">
                            Atualize o preço de venda do cadastro do produto com o preço sugerido
                            por margem ou markup.
                          </p>
                        </div>

                        {/* 3. COMPOSIÇÃO DE INSUMOS */}
                        <div>
                          <h4 className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                            <Layers className="w-3.5 h-3.5 text-amber-600" />
                            Composição de Insumos ({itens.length})
                          </h4>

                          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                            {itens.map((it, idx) => {
                              const mp = materiasMap.get(it.materia_prima_id)
                              return (
                                <div
                                  key={idx}
                                  className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between text-xs"
                                >
                                  <div>
                                    <p className="font-semibold text-slate-800">
                                      {it.materia_prima_nome || mp?.nome || 'Insumo'}
                                    </p>
                                    <p className="text-[11px] text-slate-500">
                                      {it.quantidade} {it.unidade || mp?.unidade || 'UN'} ×{' '}
                                      {formatBrl(it.custo_unitario)}
                                    </p>
                                  </div>
                                  <span className="font-bold text-slate-900">
                                    {formatBrl(it.subtotal)}
                                  </span>
                                </div>
                              )
                            })}
                          </div>
                        </div>

                        {/* 4. COMPARATIVO DE PREÇOS SUGERIDOS: MARGEM VS MARKUP */}
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2.5">
                          <div className="flex justify-between text-xs text-slate-600">
                            <span>Subtotal Matéria-Prima:</span>
                            <span className="font-semibold text-slate-800">
                              {formatBrl(custoMP)}
                            </span>
                          </div>
                          <div className="flex justify-between text-xs text-slate-600">
                            <span>Outros Custos (MOD/Despesas):</span>
                            <span className="font-semibold text-slate-800">
                              {formatBrl(outrosCustos)}
                            </span>
                          </div>
                          <div className="flex justify-between text-xs font-bold text-slate-900 border-t border-slate-200 pt-1.5">
                            <span>Custo Total Unitário:</span>
                            <span>{formatBrl(custoTotal)}</span>
                          </div>

                          {/* Comparativo dos Dois Preços Sugeridos */}
                          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200">
                            <div className="bg-emerald-50/90 border border-emerald-200 rounded-lg p-2.5 text-center">
                              <span className="text-[10px] font-bold text-emerald-800 block">
                                Por Margem ({formatPct(margem)})
                              </span>
                              <span className="text-xs text-slate-500 block text-[10px]">
                                Divisor: Custo / (1 - M)
                              </span>
                              <span className="text-sm font-extrabold text-emerald-800 mt-1 block">
                                {formatBrl(precoMargem)}
                              </span>
                            </div>

                            <div className="bg-blue-50/90 border border-blue-200 rounded-lg p-2.5 text-center">
                              <span className="text-[10px] font-bold text-blue-800 block">
                                Por Markup ({formatPct(markup)})
                              </span>
                              <span className="text-xs text-slate-500 block text-[10px]">
                                Custo × (1 + Mk/100)
                              </span>
                              <span className="text-sm font-extrabold text-blue-800 mt-1 block">
                                {formatBrl(precoMarkup)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {selectedFicha.observacoes && (
                          <div className="text-xs text-slate-600 bg-blue-50/50 p-2.5 rounded border border-blue-100">
                            <span className="font-semibold text-blue-900 block mb-0.5">
                              Observações:
                            </span>
                            {selectedFicha.observacoes}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )
                })()
              )}
            </div>
          </div>
        </>
      ) : (
        /* ABA DO RELATÓRIO DE CUSTOS E MARGEM REAL */
        <div className="space-y-6">
          {/* Métricas do Relatório */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-white border-slate-200 shadow-xs">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500 font-medium">Margem Real Média</p>
                  <h3
                    className={`text-xl font-bold mt-1 ${
                      relatorioStats.margemMediaReal >= relatorioStats.margemMediaDesejada
                        ? 'text-emerald-700'
                        : 'text-amber-700'
                    }`}
                  >
                    {formatPct(relatorioStats.margemMediaReal)}
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Meta média: {formatPct(relatorioStats.margemMediaDesejada)}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border-slate-200 shadow-xs">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500 font-medium">Produtos na Meta / Acima</p>
                  <h3 className="text-xl font-bold text-emerald-700 mt-1">
                    {relatorioStats.acimaOuAtingida}
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {relatorioStats.total > 0
                      ? Math.round((relatorioStats.acimaOuAtingida / relatorioStats.total) * 100)
                      : 0}
                    % das fichas técnicas
                  </p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border-slate-200 shadow-xs">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500 font-medium">Abaixo da Margem Desejada</p>
                  <h3 className="text-xl font-bold text-amber-700 mt-1">
                    {relatorioStats.abaixoCount}
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">Requer ajuste de preço/custo</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border-slate-200 shadow-xs">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500 font-medium">Margem Negativa (Prejuízo)</p>
                  <h3 className="text-xl font-bold text-rose-600 mt-1">
                    {relatorioStats.criticaCount}
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">Preço menor que custo total</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                  <TrendingDown className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Card Principal do Relatório */}
          <Card className="bg-white border-slate-200 shadow-xs">
            <CardHeader className="pb-3 border-b border-slate-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base font-bold text-[#0B1F3A] flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-emerald-700" />
                    Relatório Comparativo de Custos e Margem Real
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Comparação produto a produto: Custo Total da Ficha × Preço de Venda Praticado ×
                    Margem Real vs Margem Desejada.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    type="button"
                    onClick={handleExportRelatorioCsv}
                    size="sm"
                    className="h-9 text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs"
                  >
                    <Download className="w-3.5 h-3.5 mr-1.5" />
                    Exportar Relatório CSV
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row items-center gap-3 mb-4">
                <div className="relative flex-1 w-full">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input
                    placeholder="Buscar por produto, código ou categoria..."
                    value={relatorioSearch}
                    onChange={(e) => setRelatorioSearch(e.target.value)}
                    className="pl-9 h-9 text-xs"
                  />
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <span className="text-xs text-slate-500 shrink-0 font-medium">Status:</span>
                  <select
                    value={filtroStatusMargem}
                    onChange={(e) => setFiltroStatusMargem(e.target.value as any)}
                    className="h-9 text-xs bg-white border border-slate-200 rounded-md px-2.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-600 w-full sm:w-48"
                  >
                    <option value="todos">Todos os desempenhos</option>
                    <option value="acima">🟢 Meta Atingida ou Acima</option>
                    <option value="abaixo">🟡 Abaixo do Desejado</option>
                    <option value="alerta">🔴 Margem Negativa (Prejuízo)</option>
                  </select>
                </div>
              </div>

              {relatorioFiltrado.length === 0 ? (
                <div className="py-16 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
                    <BarChart3 className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-semibold text-slate-800">
                    Nenhum dado encontrado no relatório
                  </h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    {relatorioData.length === 0
                      ? 'Cadastre fichas técnicas para gerar a análise comparativa de margem real.'
                      : 'Nenhum produto corresponde aos filtros aplicados.'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-700 font-semibold">
                        <th className="py-3 px-3.5">Código</th>
                        <th className="py-3 px-3.5">Produto</th>
                        <th className="py-3 px-3.5">Categoria</th>
                        <th className="py-3 px-3.5 text-right">Custo MP</th>
                        <th className="py-3 px-3.5 text-right">Outros Custos</th>
                        <th className="py-3 px-3.5 text-right">Custo Total</th>
                        <th className="py-3 px-3.5 text-right">Preço Venda</th>
                        <th className="py-3 px-3.5 text-right">Preço Sug. (Margem)</th>
                        <th className="py-3 px-3.5 text-right">Preço Sug. (Markup)</th>
                        <th className="py-3 px-3.5 text-right">Margem Desejada</th>
                        <th className="py-3 px-3.5 text-right">Margem Real</th>
                        <th className="py-3 px-3.5 text-center">Desempenho</th>
                        <th className="py-3 px-3.5 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {relatorioFiltrado.map((item) => {
                        const isAtingida = item.statusMargem === 'atingida'
                        const isAbaixo = item.statusMargem === 'abaixo'
                        const isCritica = item.statusMargem === 'critica'
                        const markupVal =
                          item.ficha.markup_desejado !== undefined &&
                          item.ficha.markup_desejado !== null
                            ? item.ficha.markup_desejado
                            : item.margemDesejada < 100 && item.margemDesejada > 0
                              ? (item.margemDesejada / (100 - item.margemDesejada)) * 100
                              : 50
                        const precoMk =
                          item.ficha.preco_venda_markup ||
                          (item.custoTotal > 0 ? item.custoTotal * (1 + markupVal / 100) : 0)

                        return (
                          <tr
                            key={item.ficha.id}
                            className="hover:bg-slate-50/70 transition-colors"
                          >
                            <td className="py-3 px-3.5 font-mono text-slate-600 font-semibold">
                              {item.produtoCodigo ? (
                                <Badge variant="outline" className="text-[10px] bg-slate-50">
                                  {item.produtoCodigo}
                                </Badge>
                              ) : (
                                <span className="text-slate-400 italic">—</span>
                              )}
                            </td>
                            <td className="py-3 px-3.5">
                              <div className="font-semibold text-slate-900">{item.produtoNome}</div>
                              <div className="text-[11px] text-slate-400">
                                {item.itensCount} insumo(s) · Unidade: {item.unidade}
                              </div>
                            </td>
                            <td className="py-3 px-3.5 text-slate-600">
                              {item.categoria ? (
                                <Badge className="text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                                  {item.categoria}
                                </Badge>
                              ) : (
                                <span className="text-slate-400 italic">—</span>
                              )}
                            </td>
                            <td className="py-3 px-3.5 text-right text-slate-600 whitespace-nowrap">
                              {formatBrl(item.custoMP)}
                            </td>
                            <td className="py-3 px-3.5 text-right text-slate-500 whitespace-nowrap">
                              {formatBrl(item.outrosCustos)}
                            </td>
                            <td className="py-3 px-3.5 text-right font-bold text-slate-900 whitespace-nowrap">
                              {formatBrl(item.custoTotal)}
                            </td>
                            <td className="py-3 px-3.5 text-right font-bold text-slate-900 whitespace-nowrap">
                              {formatBrl(item.precoVenda)}
                            </td>
                            <td className="py-3 px-3.5 text-right font-semibold text-emerald-700 whitespace-nowrap">
                              {formatBrl(item.precoSugerido)}
                            </td>
                            <td className="py-3 px-3.5 text-right font-semibold text-blue-700 whitespace-nowrap">
                              {formatBrl(precoMk)}
                            </td>
                            <td className="py-3 px-3.5 text-right font-medium text-slate-600 whitespace-nowrap">
                              <div>{formatPct(item.margemDesejada)}</div>
                              <div className="text-[10px] text-slate-400">
                                Mk: {formatPct(markupVal)}
                              </div>
                            </td>
                            <td className="py-3 px-3.5 text-right whitespace-nowrap">
                              <span
                                className={`font-bold ${
                                  isCritica
                                    ? 'text-rose-600'
                                    : isAbaixo
                                      ? 'text-amber-700'
                                      : 'text-emerald-700'
                                }`}
                              >
                                {formatPct(item.margemReal)}
                              </span>
                            </td>
                            <td className="py-3 px-3.5 text-center whitespace-nowrap">
                              {isCritica ? (
                                <Badge className="text-[10px] bg-rose-100 text-rose-700 hover:bg-rose-100 border-rose-300 gap-1 font-bold">
                                  <ArrowDownRight className="w-3 h-3" />
                                  Negativa ({item.diffMargem.toFixed(1)} p.p.)
                                </Badge>
                              ) : isAbaixo ? (
                                <Badge className="text-[10px] bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-300 gap-1 font-bold">
                                  <ArrowDownRight className="w-3 h-3" />
                                  Abaixo ({item.diffMargem.toFixed(1)} p.p.)
                                </Badge>
                              ) : isAtingida ? (
                                <Badge className="text-[10px] bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-300 gap-1 font-semibold">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Meta Atingida
                                </Badge>
                              ) : (
                                <Badge className="text-[10px] bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-300 gap-1 font-bold">
                                  <ArrowUpRight className="w-3 h-3" />
                                  Acima (+{item.diffMargem.toFixed(1)} p.p.)
                                </Badge>
                              )}
                            </td>
                            <td className="py-3 px-3.5 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  onClick={() => {
                                    setSelectedFicha(item.ficha)
                                    setActiveTab('fichas')
                                  }}
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 text-[11px] text-blue-600 hover:bg-blue-50 px-2 font-medium"
                                  title="Ver ficha técnica"
                                >
                                  Ver Ficha
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
        </div>
      )}

      {/* Modal Criar / Editar Ficha Técnica */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto bg-white">
          <form onSubmit={handleSave}>
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-[#0B1F3A] flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-blue-600" />
                {editingFicha ? 'Editar Ficha Técnica' : 'Nova Ficha Técnica'}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Selecione o produto, adicione as matérias-primas e configure outros custos e margem.
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
              {/* Seleção do Produto */}
              <div className="space-y-1.5">
                <Label htmlFor="ficha-produto" className="text-xs font-semibold text-slate-700">
                  Produto *
                </Label>
                {editingFicha ? (
                  <Input
                    readOnly
                    value={produtosMap.get(formData.produto_id)?.nome || 'Produto'}
                    className="h-9 text-xs bg-slate-50 font-semibold text-slate-700 cursor-not-allowed"
                  />
                ) : (
                  <select
                    id="ficha-produto"
                    value={formData.produto_id}
                    onChange={(e) => {
                      const id = e.target.value
                      const prod = produtosMap.get(id)
                      setFormData((prev) => ({
                        ...prev,
                        produto_id: id,
                        margem_desejada:
                          prod?.margem_desejada !== undefined && prod?.margem_desejada !== null
                            ? String(prod.margem_desejada)
                            : prev.margem_desejada,
                      }))
                      if (errors.produto_id)
                        setErrors((prev) => ({ ...prev, produto_id: undefined }))
                    }}
                    className={`w-full h-9 text-xs bg-white border rounded-md px-2.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-600 ${
                      errors.produto_id ? 'border-red-500' : 'border-slate-200'
                    }`}
                  >
                    <option value="">Selecione o produto...</option>
                    {produtosSemFicha.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.codigo ? `[${p.codigo}] ` : ''}
                        {p.nome} ({p.unidade})
                      </option>
                    ))}
                  </select>
                )}
                {errors.produto_id && (
                  <p className="text-[11px] text-red-600 font-medium">{errors.produto_id}</p>
                )}
              </div>

              {/* Seção Itens de Matéria Prima */}
              <div className="space-y-2 border-t border-slate-100 pt-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-amber-600" />
                      Composição de Matérias-Primas *
                    </Label>
                    <p className="text-[11px] text-slate-400">
                      Selecione o insumo e a quantidade utilizada por unidade do produto.
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={handleAddItem}
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs font-semibold text-blue-600 border-blue-200 hover:bg-blue-50"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Adicionar Insumo
                  </Button>
                </div>

                {errors.itens && (
                  <p className="text-[11px] text-red-600 font-medium">{errors.itens}</p>
                )}

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {formData.itens.map((item, idx) => {
                    const mp = materiasMap.get(item.materia_prima_id)
                    const qtd = Number(item.quantidade.replace(',', '.')) || 0
                    const custo = Number(item.custo_unitario.replace(',', '.')) || 0
                    const subtotal = qtd * custo

                    return (
                      <div
                        key={idx}
                        className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center gap-2"
                      >
                        {/* Select Matéria Prima */}
                        <div className="flex-1 w-full sm:w-auto">
                          <select
                            value={item.materia_prima_id}
                            onChange={(e) =>
                              handleItemChange(idx, 'materia_prima_id', e.target.value)
                            }
                            className="w-full h-8 text-xs bg-white border border-slate-200 rounded px-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-600"
                          >
                            <option value="">Selecione o insumo...</option>
                            {materias.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.codigo ? `[${m.codigo}] ` : ''}
                                {m.nome} ({m.unidade}) · {formatBrl(m.custo_unitario)}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Quantidade */}
                        <div className="w-full sm:w-28 flex items-center gap-1">
                          <Input
                            type="number"
                            inputMode="decimal"
                            step="0.001"
                            min="0.001"
                            placeholder="Qtd"
                            value={item.quantidade}
                            onChange={(e) => handleItemChange(idx, 'quantidade', e.target.value)}
                            className="h-8 text-xs bg-white"
                          />
                          <span className="text-[11px] text-slate-500 font-semibold uppercase min-w-[24px]">
                            {mp?.unidade || 'UN'}
                          </span>
                        </div>

                        {/* Custo Unitário */}
                        <div className="w-full sm:w-28">
                          <Input
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            min="0"
                            placeholder="Custo un."
                            value={item.custo_unitario}
                            onChange={(e) =>
                              handleItemChange(idx, 'custo_unitario', e.target.value)
                            }
                            className="h-8 text-xs bg-white"
                            title="Custo unitário do insumo"
                          />
                        </div>

                        {/* Subtotal e Remover */}
                        <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-28">
                          <span className="text-xs font-bold text-slate-800">
                            {formatBrl(subtotal)}
                          </span>
                          <Button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50"
                            title="Remover item"
                          >
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Seção Outros Custos, Margem e Markup */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-slate-100 pt-3">
                <div className="space-y-1.5">
                  <Label htmlFor="ficha-outros" className="text-xs font-semibold text-slate-700">
                    Outros Custos / MOD (R$)
                  </Label>
                  <Input
                    id="ficha-outros"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={formData.outros_custos}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, outros_custos: e.target.value }))
                    }
                    className="h-9 text-xs"
                  />
                  <p className="text-[10px] text-slate-400">Mão de obra, energia, embalagem etc.</p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="ficha-margem" className="text-xs font-semibold text-slate-700">
                    Margem Desejada (%) *
                  </Label>
                  <Input
                    id="ficha-margem"
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    min="0"
                    max="99.9"
                    placeholder="Ex: 40.0"
                    value={formData.margem_desejada}
                    onChange={(e) => {
                      const val = e.target.value
                      const m = Number(val.replace(',', '.'))
                      // Se usuário altera margem, auto-atualiza markup equivalente para conveniência
                      let mkEquivalent = formData.markup_desejado
                      if (!isNaN(m) && m >= 0 && m < 100) {
                        mkEquivalent = ((m / (100 - m)) * 100).toFixed(2)
                      }
                      setFormData((prev) => ({
                        ...prev,
                        margem_desejada: val,
                        markup_desejado: mkEquivalent,
                      }))
                    }}
                    className={`h-9 text-xs ${errors.margem_desejada ? 'border-red-500' : ''}`}
                  />
                  {errors.margem_desejada ? (
                    <p className="text-[10px] text-red-600 font-medium">{errors.margem_desejada}</p>
                  ) : (
                    <p className="text-[10px] text-slate-400">Divisor: PV = Custo / (1 - Margem)</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="ficha-markup" className="text-xs font-semibold text-slate-700">
                    Markup sobre Custo Total (%) *
                  </Label>
                  <Input
                    id="ficha-markup"
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    min="0"
                    placeholder="Ex: 66.7"
                    value={formData.markup_desejado}
                    onChange={(e) => {
                      const val = e.target.value
                      setFormData((prev) => ({ ...prev, markup_desejado: val }))
                    }}
                    className={`h-9 text-xs ${errors.markup_desejado ? 'border-red-500' : ''}`}
                  />
                  {errors.markup_desejado ? (
                    <p className="text-[10px] text-red-600 font-medium">{errors.markup_desejado}</p>
                  ) : (
                    <p className="text-[10px] text-slate-400">
                      Multiplicador: PV = Custo × (1 + Mk)
                    </p>
                  )}
                </div>
              </div>

              {/* Painel de Apuração e Preços Sugeridos (Margem vs Markup) */}
              <div className="p-4 bg-gradient-to-r from-blue-50/70 via-indigo-50/50 to-emerald-50/70 border border-blue-200/70 rounded-xl space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-[#0B1F3A]">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  Apuração de Custos & Preços Sugeridos
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-500 font-medium block">
                      Custo Matéria-Prima
                    </span>
                    <span className="text-xs font-bold text-slate-800 mt-0.5 block">
                      {formatBrl(formCalculations.custoMP)}
                    </span>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-500 font-medium block">
                      Outros Custos
                    </span>
                    <span className="text-xs font-bold text-slate-800 mt-0.5 block">
                      {formatBrl(formCalculations.outros)}
                    </span>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-500 font-medium block">
                      Custo Total
                    </span>
                    <span className="text-xs font-bold text-slate-900 mt-0.5 block">
                      {formatBrl(formCalculations.custoTotal)}
                    </span>
                  </div>
                  <div className="bg-emerald-700 text-white p-2 rounded-lg shadow-xs">
                    <span className="text-[10px] font-medium block text-emerald-100">
                      Preço Sugerido (Margem)
                    </span>
                    <span className="text-xs font-extrabold mt-0.5 block">
                      {formatBrl(formCalculations.precoSugeridoMargem)}
                    </span>
                  </div>
                  <div className="bg-blue-700 text-white p-2 rounded-lg shadow-xs col-span-2 sm:col-span-1">
                    <span className="text-[10px] font-medium block text-blue-100">
                      Preço Sugerido (Markup)
                    </span>
                    <span className="text-xs font-extrabold mt-0.5 block">
                      {formatBrl(formCalculations.precoSugeridoMarkup)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ficha-obs" className="text-xs font-semibold text-slate-700">
                  Observações da Ficha
                </Label>
                <Textarea
                  id="ficha-obs"
                  placeholder="Instruções de montagem, tempo padrão de fabricação etc."
                  value={formData.observacoes}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, observacoes: e.target.value }))
                  }
                  className="min-h-[60px] text-xs resize-y"
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
                  : editingFicha
                    ? 'Salvar Alterações'
                    : 'Criar Ficha Técnica'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Clonar Ficha Técnica */}
      <Dialog open={cloneOpen} onOpenChange={setCloneOpen}>
        <DialogContent className="sm:max-w-[500px] bg-white">
          <form onSubmit={handleConfirmClone}>
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-[#0B1F3A] flex items-center gap-2">
                <Copy className="w-4 h-4 text-emerald-700" />
                Clonar Ficha Técnica
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Uma cópia exata de todos os insumos, quantidades, custos e parâmetros de formação de
                preço será criada com um novo produto para que você possa criar variações.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-4">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
                <div className="text-slate-500">Ficha Técnica Original:</div>
                <div className="font-bold text-slate-900">
                  {produtosMap.get(fichaToClone?.produto || '')?.nome || 'Produto Original'}
                </div>
                <div className="text-[11px] text-slate-500">
                  {fichaToClone?.itens?.length || 0} insumo(s) cadastrado(s) · Custo Total:{' '}
                  <strong>{formatBrl(fichaToClone?.custo_total)}</strong>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="clone-nome" className="text-xs font-semibold text-slate-700">
                  Nome do Novo Produto (Variação) *
                </Label>
                <Input
                  id="clone-nome"
                  required
                  placeholder="Ex: Gabinete Metálico Slim - Cor Preta"
                  value={cloneNovoNome}
                  onChange={(e) => setCloneNovoNome(e.target.value)}
                  className="h-9 text-xs"
                />
                <p className="text-[11px] text-slate-400">
                  Um novo produto será cadastrado automaticamente com este nome.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="clone-codigo" className="text-xs font-semibold text-slate-700">
                  Código / SKU do Novo Produto (Opcional)
                </Label>
                <Input
                  id="clone-codigo"
                  placeholder="Ex: PRD-001-B"
                  value={cloneNovoCodigo}
                  onChange={(e) => setCloneNovoCodigo(e.target.value)}
                  className="h-9 text-xs uppercase"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCloneOpen(false)}
                disabled={cloning}
                className="text-xs h-9"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={cloning}
                className="bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs h-9 shadow-xs"
              >
                {cloning ? 'Clonando...' : 'Confirmar e Clonar Ficha'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Vincular Preço ao Produto */}
      <Dialog open={vincularModalOpen} onOpenChange={setVincularModalOpen}>
        <DialogContent className="sm:max-w-[480px] bg-white">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#0B1F3A] flex items-center gap-2">
              <LinkIcon className="w-4 h-4 text-blue-600" />
              Vincular Preço Sugerido ao Produto
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Escolha qual preço sugerido pela ficha técnica você deseja aplicar como preço de venda
              oficial do produto.
            </DialogDescription>
          </DialogHeader>

          {fichaParaVincular &&
            (() => {
              const prod = produtosMap.get(fichaParaVincular.produto)
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
                    <div className="text-slate-500">Produto selecionado:</div>
                    <div className="font-bold text-slate-900 text-sm">
                      {prod?.nome || 'Produto'}
                    </div>
                    <div className="text-slate-500 flex items-center justify-between pt-1 border-t border-slate-200 mt-1">
                      <span>Preço de venda atual:</span>
                      <span className="font-semibold text-slate-800">
                        {formatBrl(prod?.preco_venda)}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-slate-700">
                      Selecione o Preço Sugerido a Aplicar:
                    </Label>

                    {/* Opção 1: Preço por Margem */}
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

                    {/* Opção 2: Preço por Markup */}
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
                      Ao confirmar, o preço de venda do produto <strong>"{prod?.nome}"</strong> será
                      atualizado no catálogo e refletirá imediatamente nas listagens e relatórios.
                    </span>
                  </div>
                </div>
              )
            })()}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setVincularModalOpen(false)}
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
              {vinculandoPreco ? 'Vinculando...' : 'Confirmar e Atualizar Preço'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação de Exclusão */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-red-600 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" /> Excluir Ficha Técnica?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-600">
              Tem certeza que deseja excluir a ficha técnica do produto{' '}
              <strong className="text-slate-900">
                "{produtosMap.get(fichaToDelete?.produto || '')?.nome || 'selecionado'}"
              </strong>
              ? O produto não será excluído, mas voltará a não ter ficha técnica vinculada.
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
