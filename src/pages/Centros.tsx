import React, { useState, useEffect, useMemo } from 'react'
import {
  centrosService,
  lancamentosCentroService,
  tiposDespesaService,
  contasService,
} from '@/services/financeService'
import type {
  CentroRecord,
  ContaRecord,
  LancamentoCentroRecord,
  TipoCentro,
  TipoDespesaRecord,
} from '@/types/finance'
import { Tag, CheckCircle2, Circle, BookOpen } from 'lucide-react'
import { useRealtime } from '@/hooks/use-realtime'
import { useToast } from '@/hooks/use-toast'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  PieChart,
  Plus,
  Pencil,
  Trash2,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Receipt,
  Download,
  CalendarDays,
} from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  ResponsiveContainer,
  ReferenceLine,
  ComposedChart,
} from 'recharts'

const TIPOS: TipoCentro[] = ['Receita', 'Despesa']

// Formata valor monetário em R$ com 2 casas decimais
function formatBrl(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return '—'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val)
}

// Retorna a data atual no formato ISO (YYYY-MM-DD)
function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

interface CentroFormData {
  nome: string
  tipo: TipoCentro
  descricao: string
  meta_mensal: string
  meta_anual: string
}

const EMPTY_CENTRO: CentroFormData = {
  nome: '',
  tipo: 'Despesa',
  descricao: '',
  meta_mensal: '',
  meta_anual: '',
}

type CentroErrors = Partial<Record<keyof CentroFormData | 'general', string>>

interface LancamentoFormData {
  descricao: string
  tipo_despesa: string
  conta: string
  concluido: boolean
}

const EMPTY_LANC: LancamentoFormData = {
  descricao: '',
  tipo_despesa: '',
  conta: '',
  concluido: false,
}

type LancErrors = Partial<Record<'general', string>>

// Converte o valor digitado no campo de meta mensal (aceita vírgula decimal)
function parseMeta(value: string): number | undefined {
  const trimmed = value.trim()
  if (trimmed === '') return undefined
  const n = Number(trimmed.replace(',', '.'))
  return isNaN(n) ? undefined : n
}

export default function Centros() {
  const { toast } = useToast()

  const [centros, setCentros] = useState<CentroRecord[]>([])
  const [lancamentos, setLancamentos] = useState<LancamentoCentroRecord[]>([])
  const [tiposDespesa, setTiposDespesa] = useState<TipoDespesaRecord[]>([])
  const [contas, setContas] = useState<ContaRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCentroId, setSelectedCentroId] = useState<string | null>(null)

  // Form centro
  const [centroForm, setCentroForm] = useState<CentroFormData>(EMPTY_CENTRO)
  const [centroErrors, setCentroErrors] = useState<CentroErrors>({})
  const [savingCentro, setSavingCentro] = useState(false)

  // Modal edição centro
  const [editCentroOpen, setEditCentroOpen] = useState(false)
  const [editingCentro, setEditingCentro] = useState<CentroRecord | null>(null)

  // Delete centro
  const [deleteCentroOpen, setDeleteCentroOpen] = useState(false)
  const [centroToDelete, setCentroToDelete] = useState<CentroRecord | null>(null)
  const [deletingCentro, setDeletingCentro] = useState(false)

  // Form lançamento
  const [lancForm, setLancForm] = useState<LancamentoFormData>(EMPTY_LANC)
  const [lancErrors, setLancErrors] = useState<LancErrors>({})
  const [savingLanc, setSavingLanc] = useState(false)

  // Modal edição lançamento
  const [editLancOpen, setEditLancOpen] = useState(false)
  const [editingLanc, setEditingLanc] = useState<LancamentoCentroRecord | null>(null)

  // Filtro por tipo de despesa (persiste ao trocar de centro)
  const [filtroTipoDespesa, setFiltroTipoDespesa] = useState<string>('todos')

  // Ordenação dos lançamentos (persiste ao trocar de centro)
  const [ordenacao, setOrdenacao] = useState<string>('padrao')

  // Delete lançamento
  const [deleteLancOpen, setDeleteLancOpen] = useState(false)
  const [lancToDelete, setLancToDelete] = useState<LancamentoCentroRecord | null>(null)
  const [deletingLanc, setDeletingLanc] = useState(false)

  const loadData = async () => {
    try {
      setLoading(true)
      const [cList, lList, tdList, contasList] = await Promise.all([
        centrosService.getAll(),
        lancamentosCentroService.getAll(),
        tiposDespesaService.getAll(),
        contasService.getAll(),
      ])
      setCentros(cList)
      setLancamentos(lList)
      setTiposDespesa(tdList)
      setContas(contasList)
    } catch (err) {
      console.error('Erro ao carregar centros:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar',
        description: 'Não foi possível carregar os centros de custo.',
      })
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    loadData()
  }, [])

  useRealtime<CentroRecord>('centros', () => loadData())
  useRealtime<LancamentoCentroRecord>('lancamentos_centro', () => loadData())
  useRealtime<TipoDespesaRecord>('tipos_despesa', () => loadData())
  useRealtime<ContaRecord>('contas', () => loadData())

  const selectedCentro = useMemo(
    () => centros.find((c) => c.id === selectedCentroId) || null,
    [centros, selectedCentroId],
  )

  // Mapa de contas por id (para exibição de badges)
  const contasMap = useMemo(() => {
    const map = new Map<string, ContaRecord>()
    for (const c of contas) map.set(c.id, c)
    return map
  }, [contas])

  // Contas ordenadas: quando o centro é Despesa, contas do tipo Despesa aparecem
  // primeiro; quando Receita, contas do tipo Receita primeiro. Todas as contas
  // permanecem selecionáveis.
  const contasOrdenadas = useMemo(() => {
    const tipoPreferido = selectedCentro?.tipo === 'Receita' ? 'Receita' : 'Despesa'
    return [...contas].sort((a, b) => {
      const aPref = a.tipo === tipoPreferido ? 0 : 1
      const bPref = b.tipo === tipoPreferido ? 0 : 1
      if (aPref !== bPref) return aPref - bPref
      return (a.codigo || '').localeCompare(b.codigo || '')
    })
  }, [contas, selectedCentro])

  const lancamentosDoCentro = useMemo(
    () => (selectedCentroId ? lancamentos.filter((l) => l.centro === selectedCentroId) : []),
    [lancamentos, selectedCentroId],
  )

  // Lançamentos do centro após aplicar o filtro por tipo de despesa
  const lancamentosFiltrados = useMemo(() => {
    if (filtroTipoDespesa === 'todos') return lancamentosDoCentro
    return lancamentosDoCentro.filter((l) => l.tipo_despesa === filtroTipoDespesa)
  }, [lancamentosDoCentro, filtroTipoDespesa])

  // Lançamentos filtrados + ordenados (primeiro filtra, depois ordena)
  const lancamentosOrdenados = useMemo(() => {
    const base = [...lancamentosFiltrados]
    if (ordenacao === 'pendentes') {
      base.sort((a, b) => {
        const ca = a.concluido ? 1 : 0
        const cb = b.concluido ? 1 : 0
        if (ca !== cb) return ca - cb // pendentes (0) primeiro
        return (b.created || '').localeCompare(a.created || '')
      })
    } else if (ordenacao === 'concluidos') {
      base.sort((a, b) => {
        const ca = a.concluido ? 1 : 0
        const cb = b.concluido ? 1 : 0
        if (ca !== cb) return cb - ca // concluídos (1) primeiro
        return (b.created || '').localeCompare(a.created || '')
      })
    } else {
      // padrão: mais recentes primeiro
      base.sort((a, b) => (b.created || '').localeCompare(a.created || ''))
    }
    return base
  }, [lancamentosFiltrados, ordenacao])

  // Contagem de concluídos vs pendentes
  const conclusaoLancamentos = useMemo(() => {
    const total = lancamentosDoCentro.length
    const concluidos = lancamentosDoCentro.filter((l) => !!l.concluido).length
    const pendentes = total - concluidos
    const percentual = total > 0 ? Math.round((concluidos / total) * 100) : 0
    return { total, concluidos, pendentes, percentual }
  }, [lancamentosDoCentro])

  // Orçado vs realizado (meta mensal)
  const orcadoRealizado = useMemo(() => {
    const meta = selectedCentro?.meta_mensal ? Number(selectedCentro.meta_mensal) || 0 : 0
    const agora = new Date()
    const mes = agora.getMonth()
    const ano = agora.getFullYear()
    const realizado = lancamentosDoCentro
      .filter((l) => {
        if (!l.data) return false
        const d = new Date(l.data + 'T00:00:00')
        return d.getMonth() === mes && d.getFullYear() === ano
      })
      .reduce((acc, l) => acc + (Number(l.valor) || 0), 0)
    const diferenca = realizado - meta
    const percentual = meta > 0 ? (realizado / meta) * 100 : 0
    return { meta, realizado, diferenca, percentual }
  }, [selectedCentro, lancamentosDoCentro])

  // Orçado vs realizado ANUAL (meta anual + projeção)
  const orcadoRealizadoAnual = useMemo(() => {
    const meta = selectedCentro?.meta_anual ? Number(selectedCentro.meta_anual) || 0 : 0
    const ano = new Date().getFullYear()
    const realizado = lancamentosDoCentro
      .filter((l) => {
        if (!l.data) return false
        const d = new Date(l.data + 'T00:00:00')
        return d.getFullYear() === ano
      })
      .reduce((acc, l) => acc + (Number(l.valor) || 0), 0)
    const mesesPassados = new Date().getMonth() + 1 // 1..12
    const projecao = mesesPassados > 0 ? (realizado / mesesPassados) * 12 : 0
    const diferenca = realizado - meta
    const percentual = meta > 0 ? (realizado / meta) * 100 : 0
    return { meta, realizado, diferenca, percentual, projecao, mesesPassados }
  }, [selectedCentro, lancamentosDoCentro])

  const tiposDespesaMap = useMemo(() => {
    const map = new Map<string, TipoDespesaRecord>()
    for (const t of tiposDespesa) map.set(t.id, t)
    return map
  }, [tiposDespesa])

  // Evolução mensal de gastos (últimos 12 meses) do centro selecionado
  const evolucaoMensal = useMemo(() => {
    const meses = [
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
    const hoje = new Date()
    const pontos: { mes: string; valor: number; ano: number; numMes: number }[] = []
    // Últimos 12 meses (incluindo o atual) do mais antigo para o mais recente
    for (let i = 11; i >= 0; i--) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1)
      const ano = d.getFullYear()
      const numMes = d.getMonth()
      const total = lancamentosDoCentro
        .filter((l) => {
          if (!l.data) return false
          const ld = new Date(l.data + 'T00:00:00')
          return ld.getMonth() === numMes && ld.getFullYear() === ano
        })
        .reduce((acc, l) => acc + (Number(l.valor) || 0), 0)
      pontos.push({ mes: meses[numMes], valor: total, ano, numMes })
    }
    return pontos
  }, [lancamentosDoCentro])

  const evolucaoTemDados = evolucaoMensal.some((p) => p.valor > 0)
  const metaMensalCentro = selectedCentro?.meta_mensal ? Number(selectedCentro.meta_mensal) || 0 : 0

  // Mapa de totais por centro (id -> { count, total })
  const statsPorCentro = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>()
    for (const l of lancamentos) {
      const cur = map.get(l.centro) || { count: 0, total: 0 }
      cur.count += 1
      cur.total += Number(l.valor) || 0
      map.set(l.centro, cur)
    }
    return map
  }, [lancamentos])

  // ---------- Centro handlers ----------
  const setCentroField = <K extends keyof CentroFormData>(key: K, value: CentroFormData[K]) => {
    setCentroForm((prev) => ({ ...prev, [key]: value }))
    if (centroErrors[key]) setCentroErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  const validateCentro = (form: CentroFormData): boolean => {
    const errors: CentroErrors = {}
    if (!form.nome.trim() || form.nome.trim().length < 2) {
      errors.nome = 'Informe um nome com pelo menos 2 caracteres'
    }
    if (!form.tipo) errors.tipo = 'Selecione o tipo'
    if (form.meta_mensal.trim() !== '') {
      const n = Number(form.meta_mensal.replace(',', '.'))
      if (isNaN(n) || n < 0) {
        errors.meta_mensal = 'Informe um valor válido'
      }
    }
    if (form.meta_anual.trim() !== '') {
      const n = Number(form.meta_anual.replace(',', '.'))
      if (isNaN(n) || n < 0) {
        errors.meta_anual = 'Informe um valor válido'
      }
    }
    setCentroErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleCreateCentro = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateCentro(centroForm)) return
    setSavingCentro(true)
    try {
      const novo = await centrosService.create({
        nome: centroForm.nome,
        tipo: centroForm.tipo,
        descricao: centroForm.descricao,
        meta_mensal: parseMeta(centroForm.meta_mensal),
        meta_anual: parseMeta(centroForm.meta_anual),
      })
      toast({
        title: 'Centro de custo criado',
        description: `"${novo.nome}" foi cadastrado com sucesso.`,
      })
      setCentroForm(EMPTY_CENTRO)
      setSelectedCentroId(novo.id)
    } catch (err: any) {
      console.error(err)
      setCentroErrors((prev) => ({
        ...prev,
        general: err?.message || 'Erro ao salvar o centro de custo.',
      }))
    } finally {
      setSavingCentro(false)
    }
  }

  const openEditCentro = (c: CentroRecord) => {
    setEditingCentro(c)
    setCentroForm({
      nome: c.nome,
      tipo: c.tipo,
      descricao: c.descricao || '',
      meta_mensal:
        c.meta_mensal !== undefined && c.meta_mensal !== null ? String(c.meta_mensal) : '',
      meta_anual: c.meta_anual !== undefined && c.meta_anual !== null ? String(c.meta_anual) : '',
    })
    setCentroErrors({})
    setEditCentroOpen(true)
  }

  const handleUpdateCentro = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingCentro || !validateCentro(centroForm)) return
    setSavingCentro(true)
    try {
      await centrosService.update(editingCentro.id, {
        nome: centroForm.nome,
        tipo: centroForm.tipo,
        descricao: centroForm.descricao,
        meta_mensal: parseMeta(centroForm.meta_mensal),
        meta_anual: parseMeta(centroForm.meta_anual),
      })
      toast({ title: 'Centro atualizado', description: 'As alterações foram salvas.' })
      setEditCentroOpen(false)
      setEditingCentro(null)
    } catch (err: any) {
      console.error(err)
      setCentroErrors((prev) => ({
        ...prev,
        general: err?.message || 'Erro ao atualizar o centro.',
      }))
    } finally {
      setSavingCentro(false)
    }
  }

  const confirmDeleteCentro = (c: CentroRecord) => {
    setCentroToDelete(c)
    setDeleteCentroOpen(true)
  }

  const handleDeleteCentro = async () => {
    if (!centroToDelete) return
    setDeletingCentro(true)
    try {
      await centrosService.delete(centroToDelete.id)
      toast({
        title: 'Centro removido',
        description: `"${centroToDelete.nome}" e seus lançamentos foram excluídos.`,
      })
      if (selectedCentroId === centroToDelete.id) setSelectedCentroId(null)
      setDeleteCentroOpen(false)
      setCentroToDelete(null)
    } catch (err: any) {
      console.error(err)
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir',
        description: err?.message || 'Não foi possível excluir o centro.',
      })
    } finally {
      setDeletingCentro(false)
    }
  }

  // ---------- Lançamento handlers ----------
  const setLancField = <K extends keyof LancamentoFormData>(
    key: K,
    value: LancamentoFormData[K],
  ) => {
    setLancForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleCreateLanc = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCentroId) return
    setSavingLanc(true)
    try {
      await lancamentosCentroService.create({
        centro: selectedCentroId,
        data: todayIso(),
        valor: 0,
        descricao: lancForm.descricao,
        tipo_despesa: lancForm.tipo_despesa || undefined,
        conta: lancForm.conta || undefined,
        concluido: lancForm.concluido,
      })
      toast({ title: 'Lançamento adicionado', description: 'O lançamento foi registrado.' })
      setLancForm(EMPTY_LANC)
    } catch (err: any) {
      console.error(err)
      setLancErrors((prev) => ({
        ...prev,
        general: err?.message || 'Erro ao salvar o lançamento.',
      }))
    } finally {
      setSavingLanc(false)
    }
  }

  const openEditLanc = (l: LancamentoCentroRecord) => {
    setEditingLanc(l)
    setLancForm({
      descricao: l.descricao || '',
      tipo_despesa: l.tipo_despesa || '',
      conta: l.conta || '',
      concluido: !!l.concluido,
    })
    setLancErrors({})
    setEditLancOpen(true)
  }

  // Toggle inline do campo concluído direto na tabela (bônus)
  const handleToggleConcluido = async (l: LancamentoCentroRecord) => {
    const novoValor = !l.concluido
    // Atualização otimista local
    setLancamentos((prev) => prev.map((x) => (x.id === l.id ? { ...x, concluido: novoValor } : x)))
    try {
      await lancamentosCentroService.update(l.id, { concluido: novoValor })
    } catch (err: any) {
      // Reverte em caso de erro
      setLancamentos((prev) =>
        prev.map((x) => (x.id === l.id ? { ...x, concluido: !novoValor } : x)),
      )
      toast({
        variant: 'destructive',
        title: 'Erro ao atualizar',
        description: err?.message || 'Não foi possível atualizar o lançamento.',
      })
    }
  }

  const handleUpdateLanc = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingLanc) return
    setSavingLanc(true)
    try {
      await lancamentosCentroService.update(editingLanc.id, {
        descricao: lancForm.descricao,
        tipo_despesa: lancForm.tipo_despesa || '',
        conta: lancForm.conta || '',
        concluido: lancForm.concluido,
      })
      toast({ title: 'Lançamento atualizado', description: 'As alterações foram salvas.' })
      setEditLancOpen(false)
      setEditingLanc(null)
    } catch (err: any) {
      console.error(err)
      setLancErrors((prev) => ({
        ...prev,
        general: err?.message || 'Erro ao atualizar o lançamento.',
      }))
    } finally {
      setSavingLanc(false)
    }
  }

  const confirmDeleteLanc = (l: LancamentoCentroRecord) => {
    setLancToDelete(l)
    setDeleteLancOpen(true)
  }

  const handleDeleteLanc = async () => {
    if (!lancToDelete) return
    setDeletingLanc(true)
    try {
      await lancamentosCentroService.delete(lancToDelete.id)
      toast({ title: 'Lançamento excluído' })
      setDeleteLancOpen(false)
      setLancToDelete(null)
    } catch (err: any) {
      console.error(err)
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir',
        description: err?.message || 'Não foi possível excluir o lançamento.',
      })
    } finally {
      setDeletingLanc(false)
    }
  }

  const TipoBadge = ({ tipo }: { tipo: TipoCentro }) =>
    tipo === 'Receita' ? (
      <Badge className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-50 px-2 py-0.5">
        <TrendingUp className="w-3 h-3 mr-1" /> Receita
      </Badge>
    ) : (
      <Badge className="text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-50 px-2 py-0.5">
        <TrendingDown className="w-3 h-3 mr-1" /> Despesa
      </Badge>
    )

  // Classes de cor para o card de orçado vs realizado
  const temMeta = orcadoRealizado.meta > 0
  const pct = orcadoRealizado.percentual
  const corTexto = !temMeta
    ? 'text-slate-500'
    : pct >= 100
      ? 'text-emerald-600'
      : pct >= 70
        ? 'text-amber-600'
        : 'text-red-600'
  const corBarra = !temMeta
    ? 'bg-slate-300'
    : pct >= 100
      ? 'bg-emerald-500'
      : pct >= 70
        ? 'bg-amber-500'
        : 'bg-red-500'
  const barraWidth = temMeta ? Math.min(pct, 100) : 0
  const bordaCard = !temMeta
    ? 'border-slate-200'
    : pct >= 100
      ? 'border-emerald-200'
      : pct >= 70
        ? 'border-amber-200'
        : 'border-red-200'

  // Classes de cor para o indicador anual
  const temMetaAnual = orcadoRealizadoAnual.meta > 0
  const pctAnual = orcadoRealizadoAnual.percentual
  const corTextoAnual = !temMetaAnual
    ? 'text-slate-500'
    : pctAnual >= 100
      ? 'text-emerald-600'
      : pctAnual >= 70
        ? 'text-amber-600'
        : 'text-red-600'
  const corBarraAnual = !temMetaAnual
    ? 'bg-slate-300'
    : pctAnual >= 100
      ? 'bg-emerald-500'
      : pctAnual >= 70
        ? 'bg-amber-500'
        : 'bg-red-500'
  const barraWidthAnual = temMetaAnual ? Math.min(pctAnual, 100) : 0

  // Exportar resumo Orçado vs Realizado em CSV (todos os centros)
  const handleExportResumo = () => {
    if (centros.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Nada para exportar',
        description: 'Não há centros de custo cadastrados.',
      })
      return
    }
    const agora = new Date()
    const ano = agora.getFullYear()
    const mes = agora.getMonth()
    const mesesPassados = mes + 1

    const lancPorCentro = new Map<string, LancamentoCentroRecord[]>()
    for (const l of lancamentos) {
      const arr = lancPorCentro.get(l.centro) || []
      arr.push(l)
      lancPorCentro.set(l.centro, arr)
    }

    // Mapa id -> código/nome da conta para o CSV
    const contaInfo = (id?: string) => {
      if (!id) return ''
      const c = contasMap.get(id)
      return c ? `${c.codigo || ''} - ${c.nome}` : ''
    }

    const escapeCsv = (val: string | number | undefined | null): string => {
      if (val === null || val === undefined) return ''
      const s = String(val)
      if (/[;"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
      return s
    }
    const fmtNum = (n: number) =>
      n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    const fmtPct = (n: number) =>
      n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%'

    const linhas: string[] = []
    linhas.push(
      [
        'Centro',
        'Tipo',
        'Conta',
        'Meta Mensal',
        'Realizado Mês',
        '% Mês',
        'Meta Anual',
        'Realizado Ano',
        '% Ano',
        'Projeção',
      ]
        .map(escapeCsv)
        .join(';'),
    )

    for (const c of centros) {
      const lancs = lancPorCentro.get(c.id) || []
      const metaMensal = c.meta_mensal ? Number(c.meta_mensal) || 0 : 0
      const realizadoMes = lancs
        .filter((l) => {
          if (!l.data) return false
          const d = new Date(l.data + 'T00:00:00')
          return d.getMonth() === mes && d.getFullYear() === ano
        })
        .reduce((acc, l) => acc + (Number(l.valor) || 0), 0)
      const pctMes = metaMensal > 0 ? (realizadoMes / metaMensal) * 100 : 0

      const metaAnual = c.meta_anual ? Number(c.meta_anual) || 0 : 0
      const realizadoAno = lancs
        .filter((l) => {
          if (!l.data) return false
          const d = new Date(l.data + 'T00:00:00')
          return d.getFullYear() === ano
        })
        .reduce((acc, l) => acc + (Number(l.valor) || 0), 0)
      const pctAno = metaAnual > 0 ? (realizadoAno / metaAnual) * 100 : 0
      const projecao = mesesPassados > 0 ? (realizadoAno / mesesPassados) * 12 : 0

      // Conta vinculada do primeiro lançamento do centro (representativo)
      const contaCsv = lancs
        .map((l) => contaInfo(l.conta))
        .filter(Boolean)
        .join(' | ')

      linhas.push(
        [
          c.nome,
          c.tipo,
          contaCsv,
          metaMensal > 0 ? fmtNum(metaMensal) : '',
          fmtNum(realizadoMes),
          metaMensal > 0 ? fmtPct(pctMes) : '',
          metaAnual > 0 ? fmtNum(metaAnual) : '',
          fmtNum(realizadoAno),
          metaAnual > 0 ? fmtPct(pctAno) : '',
          fmtNum(projecao),
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
    link.setAttribute('download', `orcado-vs-realizado-${dataStr}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    toast({
      title: 'Resumo exportado',
      description: 'O arquivo CSV com o comparativo Orçado vs Realizado foi baixado.',
    })
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-xl font-bold text-[#0B1F3A] tracking-tight">Centros de Custo</h1>
        <p className="text-xs text-[#5B6B7F]">
          Cadastre centros de receita e despesa e registre lançamentos para cada centro.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        {/* ============ COLUNA ESQUERDA: CENTROS ============ */}
        <div className="space-y-6">
          {/* Card Novo Centro */}
          <Card className="bg-white border-slate-200 shadow-xs">
            <CardHeader className="pb-3 border-b border-slate-100">
              <CardTitle className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
                <PieChart className="w-4 h-4 text-blue-600" />
                Novo Centro de Custo
              </CardTitle>
              <CardDescription className="text-xs">
                Crie um centro de receita ou despesa para agrupar lançamentos.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <form onSubmit={handleCreateCentro} className="space-y-3">
                {centroErrors.general && (
                  <Alert
                    variant="destructive"
                    className="bg-red-50 border-red-200 text-red-800 py-2"
                  >
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    <AlertDescription className="text-xs font-medium">
                      {centroErrors.general}
                    </AlertDescription>
                  </Alert>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="centro-nome" className="text-xs font-semibold text-slate-700">
                      Nome *
                    </Label>
                    <Input
                      id="centro-nome"
                      placeholder="Ex: Marketing, Operações, TI, Vendas"
                      value={centroForm.nome}
                      onChange={(e) => setCentroField('nome', e.target.value)}
                      className={`h-9 text-xs ${centroErrors.nome ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                    />
                    {centroErrors.nome && (
                      <p className="text-[11px] text-red-600 font-medium">{centroErrors.nome}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="centro-tipo" className="text-xs font-semibold text-slate-700">
                      Tipo *
                    </Label>
                    <Select
                      value={centroForm.tipo}
                      onValueChange={(val) => setCentroField('tipo', val as TipoCentro)}
                    >
                      <SelectTrigger id="centro-tipo" className="h-9 text-xs bg-white">
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        {TIPOS.map((t) => (
                          <SelectItem key={t} value={t} className="text-xs">
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {centroErrors.tipo && (
                      <p className="text-[11px] text-red-600 font-medium">{centroErrors.tipo}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label
                      htmlFor="centro-descricao"
                      className="text-xs font-semibold text-slate-700"
                    >
                      Descrição
                    </Label>
                    <Input
                      id="centro-descricao"
                      placeholder="Opcional"
                      value={centroForm.descricao}
                      onChange={(e) => setCentroField('descricao', e.target.value)}
                      className="h-9 text-xs"
                    />
                  </div>

                  <div className="space-y-1.5 sm:col-span-2">
                    <Label
                      htmlFor="centro-meta-mensal"
                      className="text-xs font-semibold text-slate-700"
                    >
                      Meta mensal (R$)
                    </Label>
                    <Input
                      id="centro-meta-mensal"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      placeholder="Opcional — ex: 5000.00"
                      value={centroForm.meta_mensal}
                      onChange={(e) => setCentroField('meta_mensal', e.target.value)}
                      className={`h-9 text-xs ${
                        centroErrors.meta_mensal ? 'border-red-500 focus-visible:ring-red-500' : ''
                      }`}
                    />
                    {centroErrors.meta_mensal ? (
                      <p className="text-[11px] text-red-600 font-medium">
                        {centroErrors.meta_mensal}
                      </p>
                    ) : (
                      <p className="text-[11px] text-slate-400">
                        Usada no comparativo de orçado vs realizado do mês.
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5 sm:col-span-2">
                    <Label
                      htmlFor="centro-meta-anual"
                      className="text-xs font-semibold text-slate-700"
                    >
                      Meta anual (R$)
                    </Label>
                    <Input
                      id="centro-meta-anual"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      placeholder="Opcional — ex: 60000.00"
                      value={centroForm.meta_anual}
                      onChange={(e) => setCentroField('meta_anual', e.target.value)}
                      className={`h-9 text-xs ${
                        centroErrors.meta_anual ? 'border-red-500 focus-visible:ring-red-500' : ''
                      }`}
                    />
                    {centroErrors.meta_anual ? (
                      <p className="text-[11px] text-red-600 font-medium">
                        {centroErrors.meta_anual}
                      </p>
                    ) : (
                      <p className="text-[11px] text-slate-400">
                        Usada no comparativo anual com projeção de atingimento.
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button
                    type="submit"
                    disabled={savingCentro}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-9 shadow-xs"
                  >
                    <Plus className="w-4 h-4 mr-1.5" />
                    {savingCentro ? 'Salvando...' : 'Salvar Centro'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Tabela de Centros */}
          <Card className="bg-white border-slate-200 shadow-xs">
            <CardHeader className="pb-3 border-b border-slate-100">
              <CardTitle className="text-sm font-bold text-[#0B1F3A]">
                Centros Cadastrados ({centros.length})
              </CardTitle>
              <CardDescription className="text-xs">
                Clique em um centro para ver e lançar movimentações.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="py-12 flex justify-center items-center">
                  <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : centros.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-500">
                  Nenhum centro cadastrado. Use o formulário acima para criar o primeiro.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 font-semibold">
                        <th className="py-3 px-4">Código</th>
                        <th className="py-3 px-4">Nome</th>
                        <th className="py-3 px-4">Tipo</th>
                        <th className="py-3 px-4 text-center">Qtd. Lanç.</th>
                        <th className="py-3 px-4 text-right">Total</th>
                        <th className="py-3 px-4 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {centros.map((c) => {
                        const stats = statsPorCentro.get(c.id) || { count: 0, total: 0 }
                        const isSel = c.id === selectedCentroId
                        return (
                          <tr
                            key={c.id}
                            onClick={() => setSelectedCentroId(c.id)}
                            className={`cursor-pointer transition-colors ${
                              isSel ? 'bg-blue-50/80' : 'hover:bg-slate-50/80'
                            }`}
                          >
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2.5">
                                <div
                                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                    c.tipo === 'Receita'
                                      ? 'bg-emerald-50 text-emerald-600'
                                      : 'bg-rose-50 text-rose-600'
                                  }`}
                                >
                                  <Receipt className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                  <span className="font-semibold text-slate-900 block truncate">
                                    {c.nome}
                                  </span>
                                  {c.descricao ? (
                                    <span className="text-[11px] text-slate-500 block truncate">
                                      {c.descricao}
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <TipoBadge tipo={c.tipo} />
                            </td>
                            <td className="py-3 px-4 text-center font-medium text-slate-700">
                              {stats.count}
                            </td>
                            <td className="py-3 px-4 text-right font-semibold text-slate-800 whitespace-nowrap">
                              {formatBrl(stats.total)}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    openEditCentro(c)
                                  }}
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0 text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                                  title="Editar centro"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    confirmDeleteCentro(c)
                                  }}
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0 text-slate-500 hover:text-red-600 hover:bg-red-50"
                                  title="Excluir centro"
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

        {/* ============ COLUNA DIREITA: LANÇAMENTOS ============ */}
        <div className="space-y-6">
          {!selectedCentro ? (
            <Card className="bg-white border-dashed border-slate-300 shadow-xs">
              <CardContent className="py-16 flex flex-col items-center justify-center text-center">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                  <PieChart className="w-7 h-7 text-slate-400" />
                </div>
                <h3 className="text-sm font-bold text-[#0B1F3A]">Nenhum centro selecionado</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-xs">
                  Selecione um centro na tabela ao lado para visualizar e registrar lançamentos.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Cabeçalho do centro selecionado */}
              <Card className="bg-white border-slate-200 shadow-xs">
                <CardContent className="pt-5">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                        selectedCentro.tipo === 'Receita'
                          ? 'bg-emerald-50 text-emerald-600'
                          : 'bg-rose-50 text-rose-600'
                      }`}
                    >
                      <Receipt className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-[#0B1F3A] leading-tight">
                        {selectedCentro.nome}
                      </h2>
                      <div className="flex items-center gap-2 mt-1">
                        <TipoBadge tipo={selectedCentro.tipo} />
                        <span className="text-[11px] text-slate-500">
                          {lancamentosDoCentro.length} lançamento(s)
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Gráfico de conclusão (concluídos vs pendentes) */}
              {lancamentosDoCentro.length === 0 ? (
                <Card className="bg-white border-slate-200 shadow-xs">
                  <CardContent className="py-4">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <PieChart className="w-4 h-4 text-slate-400" />
                      <span>Nenhum lançamento</span>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="bg-white border-slate-200 shadow-xs">
                  <CardContent className="py-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Conclusão dos lançamentos
                      </span>
                      <span className="text-xs font-bold text-[#0B1F3A]">
                        {conclusaoLancamentos.concluidos} de {conclusaoLancamentos.total} concluídos
                        ({conclusaoLancamentos.percentual}%)
                      </span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden flex">
                      <div
                        className="h-full bg-emerald-500 transition-all"
                        style={{ width: `${conclusaoLancamentos.percentual}%` }}
                      />
                    </div>
                    <div className="flex items-center gap-4 text-[11px] text-slate-500">
                      <span className="flex items-center gap-1">
                        <span className="inline-block w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                        {conclusaoLancamentos.concluidos} concluído(s)
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="inline-block w-2.5 h-2.5 rounded-sm bg-slate-200" />
                        {conclusaoLancamentos.pendentes} pendente(s)
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Card Orçado vs Realizado */}
              <Card className={`bg-white border ${bordaCard} shadow-xs`}>
                <CardHeader className="pb-2 border-b border-slate-100">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-blue-600" />
                      Orçado vs Realizado
                    </CardTitle>
                    <Button
                      type="button"
                      onClick={handleExportResumo}
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px] font-semibold border-slate-200 hover:bg-slate-50 text-slate-700"
                      title="Exportar resumo de todos os centros em CSV"
                    >
                      <Download className="w-3.5 h-3.5 mr-1.5" />
                      Exportar Resumo
                    </Button>
                  </div>
                  <CardDescription className="text-xs">
                    Comparativo da meta mensal com o realizado no mês atual e projeção anual.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  {/* --- Seção mensal --- */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500" />
                      Mensal
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg bg-slate-50 p-3">
                        <p className="text-[11px] text-slate-500 font-medium">Meta mensal</p>
                        <p className="text-sm font-bold text-[#0B1F3A] mt-0.5">
                          {temMeta ? formatBrl(orcadoRealizado.meta) : 'Não definida'}
                        </p>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-3">
                        <p className="text-[11px] text-slate-500 font-medium">Realizado este mês</p>
                        <p className="text-sm font-bold text-[#0B1F3A] mt-0.5">
                          {formatBrl(orcadoRealizado.realizado)}
                        </p>
                      </div>
                    </div>

                    {temMeta ? (
                      <>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500">Atingimento da meta</span>
                          <span className={`font-bold ${corTexto}`}>{pct.toFixed(1)}%</span>
                        </div>
                        <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className={`h-full transition-all ${corBarra}`}
                            style={{ width: `${barraWidth}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500">Diferença</span>
                          <span
                            className={`font-bold ${
                              orcadoRealizado.diferenca >= 0 ? 'text-emerald-600' : 'text-red-600'
                            }`}
                          >
                            {orcadoRealizado.diferenca >= 0 ? '+' : ''}
                            {formatBrl(orcadoRealizado.diferenca)}
                          </span>
                        </div>
                      </>
                    ) : (
                      <p className="text-[11px] text-slate-400">
                        Defina uma meta mensal para este centro no formulário de edição para
                        acompanhar o atingimento.
                      </p>
                    )}
                  </div>

                  {/* --- Seção anual (só se houver meta anual definida) --- */}
                  {temMetaAnual ? (
                    <div className="space-y-3 border-t border-slate-100 pt-3">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                          <CalendarDays className="w-3.5 h-3.5 text-blue-500" />
                          Anual ({new Date().getFullYear()})
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-lg bg-slate-50 p-3">
                          <p className="text-[11px] text-slate-500 font-medium">Meta anual</p>
                          <p className="text-sm font-bold text-[#0B1F3A] mt-0.5">
                            {formatBrl(orcadoRealizadoAnual.meta)}
                          </p>
                        </div>
                        <div className="rounded-lg bg-slate-50 p-3">
                          <p className="text-[11px] text-slate-500 font-medium">Realizado no ano</p>
                          <p className="text-sm font-bold text-[#0B1F3A] mt-0.5">
                            {formatBrl(orcadoRealizadoAnual.realizado)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">Atingimento da meta anual</span>
                        <span className={`font-bold ${corTextoAnual}`}>
                          {orcadoRealizadoAnual.percentual.toFixed(1)}%
                        </span>
                      </div>
                      <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className={`h-full transition-all ${corBarraAnual}`}
                          style={{ width: `${barraWidthAnual}%` }}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Diferença</span>
                          <span
                            className={`font-bold ${
                              orcadoRealizadoAnual.diferenca >= 0
                                ? 'text-emerald-600'
                                : 'text-red-600'
                            }`}
                          >
                            {orcadoRealizadoAnual.diferenca >= 0 ? '+' : ''}
                            {formatBrl(orcadoRealizadoAnual.diferenca)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Projeção</span>
                          <span className="font-bold text-blue-700">
                            {formatBrl(orcadoRealizadoAnual.projecao)}
                          </span>
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Projeção = realizado em {orcadoRealizadoAnual.mesesPassados}{' '}
                        {orcadoRealizadoAnual.mesesPassados === 1 ? 'mês' : 'meses'} × 12.
                      </p>
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              {/* Gráfico de Evolução Mensal de Gastos (últimos 12 meses) */}
              <Card className="bg-white border-slate-200 shadow-xs">
                <CardHeader className="pb-2 border-b border-slate-100">
                  <CardTitle className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
                    <CalendarDays className="w-4 h-4 text-blue-600" />
                    Evolução Mensal de Gastos
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Soma dos lançamentos nos últimos 12 meses
                    {metaMensalCentro > 0 ? ' · linha tracejada = meta mensal' : ''}.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                  {evolucaoTemDados ? (
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart
                          data={evolucaoMensal}
                          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                          <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#64748B' }} />
                          <YAxis
                            tick={{ fontSize: 11, fill: '#64748B' }}
                            tickFormatter={(v) => `R$ ${Math.round(Number(v) / 1000)}k`}
                          />
                          <RTooltip
                            formatter={(val: number) => [formatBrl(Number(val)), 'Gastos no mês']}
                            labelFormatter={(_label, payload) => {
                              const p = payload?.[0]?.payload as
                                | { mes: string; ano: number; numMes: number }
                                | undefined
                              if (!p) return ''
                              return `${p.mes}/${p.ano}`
                            }}
                          />
                          {metaMensalCentro > 0 && (
                            <ReferenceLine
                              y={metaMensalCentro}
                              stroke="#F59E0B"
                              strokeDasharray="6 4"
                              strokeWidth={1.5}
                              label={{
                                value: 'Meta',
                                position: 'insideTopRight',
                                fill: '#D97706',
                                fontSize: 10,
                              }}
                            />
                          )}
                          <Bar dataKey="valor" name="Gastos" fill="#2563EB" radius={[4, 4, 0, 0]} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-64 flex items-center justify-center text-xs text-slate-400">
                      Sem dados para o período
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Card Novo Lançamento */}
              <Card className="bg-white border-slate-200 shadow-xs">
                <CardHeader className="pb-3 border-b border-slate-100">
                  <CardTitle className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
                    <Plus className="w-4 h-4 text-blue-600" />
                    Novo Lançamento
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Registre uma movimentação para este centro.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                  <form onSubmit={handleCreateLanc} className="space-y-3">
                    {lancErrors.general && (
                      <Alert
                        variant="destructive"
                        className="bg-red-50 border-red-200 text-red-800 py-2"
                      >
                        <AlertCircle className="h-4 w-4 text-red-600" />
                        <AlertDescription className="text-xs font-medium">
                          {lancErrors.general}
                        </AlertDescription>
                      </Alert>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label
                          htmlFor="lanc-tipo-despesa"
                          className="text-xs font-semibold text-slate-700"
                        >
                          Tipo de Despesa
                        </Label>
                        <Select
                          value={lancForm.tipo_despesa}
                          onValueChange={(val) => setLancField('tipo_despesa', val)}
                        >
                          <SelectTrigger id="lanc-tipo-despesa" className="h-9 text-xs bg-white">
                            <SelectValue placeholder="Selecione (opcional)" />
                          </SelectTrigger>
                          <SelectContent>
                            {tiposDespesa.map((t) => (
                              <SelectItem key={t.id} value={t.id} className="text-xs">
                                {t.nome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {tiposDespesa.length === 0 && (
                          <p className="text-[11px] text-slate-400">
                            Nenhum tipo cadastrado. Crie em "Tipos de Despesas".
                          </p>
                        )}
                        {lancForm.tipo_despesa ? (
                          <button
                            type="button"
                            onClick={() => setLancField('tipo_despesa', '')}
                            className="text-[11px] text-slate-500 hover:text-red-600 font-medium self-start"
                          >
                            Remover tipo de despesa
                          </button>
                        ) : null}
                      </div>

                      <div className="space-y-1.5 sm:col-span-2">
                        <Label
                          htmlFor="lanc-conta"
                          className="text-xs font-semibold text-slate-700"
                        >
                          Conta
                        </Label>
                        <Select
                          value={lancForm.conta || 'nenhuma'}
                          onValueChange={(val) =>
                            setLancField('conta', val === 'nenhuma' ? '' : val)
                          }
                        >
                          <SelectTrigger id="lanc-conta" className="h-9 text-xs bg-white">
                            <SelectValue placeholder="Selecione (opcional)" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="nenhuma" className="text-xs">
                              Nenhuma conta
                            </SelectItem>
                            {contasOrdenadas.map((c) => (
                              <SelectItem key={c.id} value={c.id} className="text-xs">
                                {c.codigo || '—'} - {c.nome}
                                <span className="text-slate-400"> ({c.tipo})</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {contas.length === 0 ? (
                          <p className="text-[11px] text-slate-400">
                            Nenhuma conta cadastrada. Crie em "Contas".
                          </p>
                        ) : (
                          <p className="text-[11px] text-slate-400">
                            {selectedCentro?.tipo === 'Receita'
                              ? 'Contas do tipo Receita aparecem primeiro.'
                              : 'Contas do tipo Despesa aparecem primeiro.'}
                          </p>
                        )}
                      </div>

                      <div className="space-y-1.5 sm:col-span-2">
                        <Label
                          htmlFor="lanc-descricao"
                          className="text-xs font-semibold text-slate-700"
                        >
                          Descrição
                        </Label>
                        <Textarea
                          id="lanc-descricao"
                          placeholder="Ex: Campanha Google Ads, Salários Janeiro"
                          value={lancForm.descricao}
                          onChange={(e) => setLancField('descricao', e.target.value)}
                          className="min-h-[80px] text-xs resize-y"
                        />
                      </div>

                      <div className="sm:col-span-2 flex items-center gap-2 pt-1">
                        <Checkbox
                          id="lanc-concluido"
                          checked={lancForm.concluido}
                          onCheckedChange={(val) => setLancField('concluido', val === true)}
                        />
                        <Label
                          htmlFor="lanc-concluido"
                          className="text-xs font-semibold text-slate-700 cursor-pointer"
                        >
                          Concluído
                        </Label>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <Button
                        type="submit"
                        disabled={savingLanc}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-9 shadow-xs"
                      >
                        <Plus className="w-4 h-4 mr-1.5" />
                        {savingLanc ? 'Salvando...' : 'Adicionar Lançamento'}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>

              {/* Tabela de Lançamentos */}
              <Card className="bg-white border-slate-200 shadow-xs">
                <CardHeader className="pb-3 border-b border-slate-100 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle className="text-sm font-bold text-[#0B1F3A]">
                      Lançamentos ({lancamentosOrdenados.length}
                      {filtroTipoDespesa !== 'todos' &&
                      lancamentosOrdenados.length !== lancamentosDoCentro.length
                        ? ` de ${lancamentosDoCentro.length}`
                        : ''}
                      )
                    </CardTitle>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3">
                    <Label
                      htmlFor="filtro-tipo"
                      className="text-xs font-semibold text-slate-700 shrink-0"
                    >
                      Filtrar por tipo:
                    </Label>
                    <Select
                      value={filtroTipoDespesa}
                      onValueChange={(val) => setFiltroTipoDespesa(val)}
                    >
                      <SelectTrigger
                        id="filtro-tipo"
                        className="h-8 text-xs bg-white w-full sm:w-60"
                      >
                        <SelectValue placeholder="Todos os tipos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos" className="text-xs">
                          Todos os tipos
                        </SelectItem>
                        {tiposDespesa.map((t) => (
                          <SelectItem key={t.id} value={t.id} className="text-xs">
                            {t.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Label
                      htmlFor="ordenacao"
                      className="text-xs font-semibold text-slate-700 shrink-0 sm:ml-2"
                    >
                      Ordenar:
                    </Label>
                    <Select value={ordenacao} onValueChange={(val) => setOrdenacao(val)}>
                      <SelectTrigger id="ordenacao" className="h-8 text-xs bg-white w-full sm:w-56">
                        <SelectValue placeholder="Padrão" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="padrao" className="text-xs">
                          Padrão (mais recentes primeiro)
                        </SelectItem>
                        <SelectItem value="pendentes" className="text-xs">
                          Pendentes primeiro
                        </SelectItem>
                        <SelectItem value="concluidos" className="text-xs">
                          Concluídos primeiro
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <CardDescription className="text-xs">
                    Lançamentos registrados para este centro.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  {lancamentosDoCentro.length === 0 ? (
                    <div className="py-12 text-center text-xs text-slate-500">
                      Nenhum lançamento neste centro. Adicione o primeiro acima.
                    </div>
                  ) : lancamentosOrdenados.length === 0 ? (
                    <div className="py-12 text-center text-xs text-slate-500">
                      Nenhum lançamento encontrado para o filtro selecionado.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 font-semibold">
                            <th className="py-3 px-4 text-center">Status</th>
                            <th className="py-3 px-4">Tipo de Despesa</th>
                            <th className="py-3 px-4">Conta</th>
                            <th className="py-3 px-4">Descrição</th>
                            <th className="py-3 px-4 text-right">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {lancamentosOrdenados.map((l) => {
                            const tipo = l.tipo_despesa ? tiposDespesaMap.get(l.tipo_despesa) : null
                            const concluido = !!l.concluido
                            return (
                              <tr key={l.id} className="hover:bg-slate-50/80 transition-colors">
                                <td className="py-3 px-4 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleToggleConcluido(l)}
                                    title={
                                      concluido
                                        ? 'Concluído (clique para marcar pendente)'
                                        : 'Pendente (clique para concluir)'
                                    }
                                    className="inline-flex items-center justify-center"
                                  >
                                    {concluido ? (
                                      <CheckCircle2 className="w-4 h-4 text-emerald-600 hover:text-emerald-700" />
                                    ) : (
                                      <Circle className="w-4 h-4 text-slate-300 hover:text-slate-400" />
                                    )}
                                  </button>
                                </td>
                                <td className="py-3 px-4 text-slate-700">
                                  {tipo ? (
                                    <Badge className="text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-50 px-2 py-0.5">
                                      <Tag className="w-3 h-3 mr-1" />
                                      {tipo.nome}
                                    </Badge>
                                  ) : (
                                    <span className="text-slate-400 italic">—</span>
                                  )}
                                </td>
                                <td className="py-3 px-4 text-slate-700">
                                  {(() => {
                                    const cnt = l.conta ? contasMap.get(l.conta) : null
                                    return cnt ? (
                                      <Badge className="text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-50 px-2 py-0.5">
                                        <BookOpen className="w-3 h-3 mr-1" />
                                        {cnt.codigo || '—'}
                                      </Badge>
                                    ) : (
                                      <span className="text-slate-400 italic">—</span>
                                    )
                                  })()}
                                </td>
                                <td className="py-3 px-4 text-slate-700">
                                  {l.descricao || (
                                    <span className="text-slate-400 italic">Sem descrição</span>
                                  )}
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <Button
                                      onClick={() => openEditLanc(l)}
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 w-7 p-0 text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                                      title="Editar lançamento"
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </Button>
                                    <Button
                                      onClick={() => confirmDeleteLanc(l)}
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 w-7 p-0 text-slate-500 hover:text-red-600 hover:bg-red-50"
                                      title="Excluir lançamento"
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
            </>
          )}
        </div>
      </div>

      {/* ============ MODAL EDIÇÃO CENTRO ============ */}
      <Dialog open={editCentroOpen} onOpenChange={setEditCentroOpen}>
        <DialogContent className="sm:max-w-[480px] bg-white">
          <form onSubmit={handleUpdateCentro}>
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-[#0B1F3A] flex items-center gap-2">
                <Pencil className="w-4 h-4 text-blue-600" />
                Editar Centro de Custo
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Atualize as informações do centro. Campos com * são obrigatórios.
              </DialogDescription>
            </DialogHeader>

            {centroErrors.general && (
              <Alert
                variant="destructive"
                className="mt-4 bg-red-50 border-red-200 text-red-800 py-2"
              >
                <AlertCircle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-xs font-medium">
                  {centroErrors.general}
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-3 py-4">
              <div className="space-y-1.5">
                <Label
                  htmlFor="edit-centro-codigo"
                  className="text-xs font-semibold text-slate-700"
                >
                  Código
                </Label>
                <Input
                  id="edit-centro-codigo"
                  readOnly
                  value={editingCentro?.codigo || ''}
                  className="h-9 text-xs font-mono font-semibold text-slate-600 bg-slate-50 border-slate-200 cursor-not-allowed"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-centro-nome" className="text-xs font-semibold text-slate-700">
                  Nome *
                </Label>
                <Input
                  id="edit-centro-nome"
                  value={centroForm.nome}
                  onChange={(e) => setCentroField('nome', e.target.value)}
                  className={`h-9 text-xs ${centroErrors.nome ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                />
                {centroErrors.nome && (
                  <p className="text-[11px] text-red-600 font-medium">{centroErrors.nome}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-centro-tipo" className="text-xs font-semibold text-slate-700">
                  Tipo *
                </Label>
                <Select
                  value={centroForm.tipo}
                  onValueChange={(val) => setCentroField('tipo', val as TipoCentro)}
                >
                  <SelectTrigger id="edit-centro-tipo" className="h-9 text-xs bg-white">
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS.map((t) => (
                      <SelectItem key={t} value={t} className="text-xs">
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label
                  htmlFor="edit-centro-descricao"
                  className="text-xs font-semibold text-slate-700"
                >
                  Descrição
                </Label>
                <Input
                  id="edit-centro-descricao"
                  value={centroForm.descricao}
                  onChange={(e) => setCentroField('descricao', e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label
                  htmlFor="edit-centro-meta-mensal"
                  className="text-xs font-semibold text-slate-700"
                >
                  Meta mensal (R$)
                </Label>
                <Input
                  id="edit-centro-meta-mensal"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  placeholder="Opcional — ex: 5000.00"
                  value={centroForm.meta_mensal}
                  onChange={(e) => setCentroField('meta_mensal', e.target.value)}
                  className={`h-9 text-xs ${
                    centroErrors.meta_mensal ? 'border-red-500 focus-visible:ring-red-500' : ''
                  }`}
                />
                {centroErrors.meta_mensal ? (
                  <p className="text-[11px] text-red-600 font-medium">{centroErrors.meta_mensal}</p>
                ) : null}
              </div>
              <div className="space-y-1.5">
                <Label
                  htmlFor="edit-centro-meta-anual"
                  className="text-xs font-semibold text-slate-700"
                >
                  Meta anual (R$)
                </Label>
                <Input
                  id="edit-centro-meta-anual"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  placeholder="Opcional — ex: 60000.00"
                  value={centroForm.meta_anual}
                  onChange={(e) => setCentroField('meta_anual', e.target.value)}
                  className={`h-9 text-xs ${
                    centroErrors.meta_anual ? 'border-red-500 focus-visible:ring-red-500' : ''
                  }`}
                />
                {centroErrors.meta_anual ? (
                  <p className="text-[11px] text-red-600 font-medium">{centroErrors.meta_anual}</p>
                ) : null}
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditCentroOpen(false)}
                disabled={savingCentro}
                className="text-xs h-9"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={savingCentro}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-9 shadow-xs"
              >
                {savingCentro ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ============ MODAL EDIÇÃO LANÇAMENTO ============ */}
      <Dialog open={editLancOpen} onOpenChange={setEditLancOpen}>
        <DialogContent className="sm:max-w-[480px] bg-white">
          <form onSubmit={handleUpdateLanc}>
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-[#0B1F3A] flex items-center gap-2">
                <Pencil className="w-4 h-4 text-blue-600" />
                Editar Lançamento
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Atualize os dados do lançamento.
              </DialogDescription>
            </DialogHeader>

            {lancErrors.general && (
              <Alert
                variant="destructive"
                className="mt-4 bg-red-50 border-red-200 text-red-800 py-2"
              >
                <AlertCircle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-xs font-medium">
                  {lancErrors.general}
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-3 py-4">
              <div className="space-y-1.5">
                <Label
                  htmlFor="edit-lanc-descricao"
                  className="text-xs font-semibold text-slate-700"
                >
                  Descrição
                </Label>
                <Textarea
                  id="edit-lanc-descricao"
                  value={lancForm.descricao}
                  onChange={(e) => setLancField('descricao', e.target.value)}
                  className="min-h-[80px] text-xs resize-y"
                />
              </div>
              <div className="space-y-1.5">
                <Label
                  htmlFor="edit-lanc-tipo-despesa"
                  className="text-xs font-semibold text-slate-700"
                >
                  Tipo de Despesa
                </Label>
                <Select
                  value={lancForm.tipo_despesa}
                  onValueChange={(val) => setLancField('tipo_despesa', val)}
                >
                  <SelectTrigger id="edit-lanc-tipo-despesa" className="h-9 text-xs bg-white">
                    <SelectValue placeholder="Selecione (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {tiposDespesa.map((t) => (
                      <SelectItem key={t.id} value={t.id} className="text-xs">
                        {t.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {lancForm.tipo_despesa ? (
                  <button
                    type="button"
                    onClick={() => setLancField('tipo_despesa', '')}
                    className="text-[11px] text-slate-500 hover:text-red-600 font-medium self-start"
                  >
                    Remover tipo de despesa
                  </button>
                ) : null}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-lanc-conta" className="text-xs font-semibold text-slate-700">
                  Conta
                </Label>
                <Select
                  value={lancForm.conta || 'nenhuma'}
                  onValueChange={(val) => setLancField('conta', val === 'nenhuma' ? '' : val)}
                >
                  <SelectTrigger id="edit-lanc-conta" className="h-9 text-xs bg-white">
                    <SelectValue placeholder="Selecione (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nenhuma" className="text-xs">
                      Nenhuma conta
                    </SelectItem>
                    {contasOrdenadas.map((c) => (
                      <SelectItem key={c.id} value={c.id} className="text-xs">
                        {c.codigo || '—'} - {c.nome}
                        <span className="text-slate-400"> ({c.tipo})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Checkbox
                  id="edit-lanc-concluido"
                  checked={lancForm.concluido}
                  onCheckedChange={(val) => setLancField('concluido', val === true)}
                />
                <Label
                  htmlFor="edit-lanc-concluido"
                  className="text-xs font-semibold text-slate-700 cursor-pointer"
                >
                  Concluído
                </Label>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditLancOpen(false)}
                disabled={savingLanc}
                className="text-xs h-9"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={savingLanc}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-9 shadow-xs"
              >
                {savingLanc ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ============ CONFIRMAÇÃO EXCLUSÃO CENTRO ============ */}
      <AlertDialog open={deleteCentroOpen} onOpenChange={setDeleteCentroOpen}>
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-red-600 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" /> Excluir Centro de Custo?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-600">
              Tem certeza que deseja excluir o centro{' '}
              <strong className="text-slate-900 font-semibold">{centroToDelete?.nome}</strong>?
              Todos os lançamentos associados serão removidos em cascata. Esta ação não pode ser
              desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingCentro} className="text-xs h-8">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCentro}
              disabled={deletingCentro}
              className="bg-red-600 hover:bg-red-700 text-white text-xs h-8 font-semibold"
            >
              {deletingCentro ? 'Excluindo...' : 'Sim, Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ============ CONFIRMAÇÃO EXCLUSÃO LANÇAMENTO ============ */}
      <AlertDialog open={deleteLancOpen} onOpenChange={setDeleteLancOpen}>
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-red-600 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" /> Excluir Lançamento?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-600">
              Tem certeza que deseja excluir este lançamento
              {lancToDelete?.descricao ? (
                <>
                  {' '}
                  <strong className="text-slate-900 font-semibold">{lancToDelete.descricao}</strong>
                </>
              ) : null}
              ? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingLanc} className="text-xs h-8">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteLanc}
              disabled={deletingLanc}
              className="bg-red-600 hover:bg-red-700 text-white text-xs h-8 font-semibold"
            >
              {deletingLanc ? 'Excluindo...' : 'Sim, Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
