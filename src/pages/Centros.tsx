import React, { useState, useEffect, useMemo } from 'react'
import { centrosService, lancamentosCentroService } from '@/services/financeService'
import type { CentroRecord, LancamentoCentroRecord, TipoCentro } from '@/types/finance'
import { useRealtime } from '@/hooks/use-realtime'
import { useToast } from '@/hooks/use-toast'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  CheckCircle2,
} from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

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

// Formata data ISO (YYYY-MM-DD) para dd/mm/yyyy
function formatData(iso: string): string {
  if (!iso) return '—'
  const part = iso.slice(0, 10)
  const [y, m, d] = part.split('-')
  if (!y || !m || !d) return part
  return `${d}/${m}/${y}`
}

// Converte valor digitado (com vírgula) em número
function parseValor(v: string): number {
  const norm = v.replace(/\s/g, '').replace(/R\$/gi, '').replace(/\./g, '').replace(',', '.')
  const n = Number(norm)
  return isNaN(n) ? 0 : n
}

interface CentroFormData {
  nome: string
  tipo: TipoCentro
  descricao: string
}

const EMPTY_CENTRO: CentroFormData = { nome: '', tipo: 'Despesa', descricao: '' }

type CentroErrors = Partial<Record<keyof CentroFormData | 'general', string>>

interface LancamentoFormData {
  data: string
  valor: string
  descricao: string
}

const EMPTY_LANC: LancamentoFormData = { data: '', valor: '', descricao: '' }

type LancErrors = Partial<Record<keyof LancamentoFormData | 'general', string>>

export default function Centros() {
  const { toast } = useToast()

  const [centros, setCentros] = useState<CentroRecord[]>([])
  const [lancamentos, setLancamentos] = useState<LancamentoCentroRecord[]>([])
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

  // Delete lançamento
  const [deleteLancOpen, setDeleteLancOpen] = useState(false)
  const [lancToDelete, setLancToDelete] = useState<LancamentoCentroRecord | null>(null)
  const [deletingLanc, setDeletingLanc] = useState(false)

  const loadData = async () => {
    try {
      setLoading(true)
      const [cList, lList] = await Promise.all([
        centrosService.getAll(),
        lancamentosCentroService.getAll(),
      ])
      setCentros(cList)
      setLancamentos(lList)
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

  const selectedCentro = useMemo(
    () => centros.find((c) => c.id === selectedCentroId) || null,
    [centros, selectedCentroId],
  )

  const lancamentosDoCentro = useMemo(
    () => (selectedCentroId ? lancamentos.filter((l) => l.centro === selectedCentroId) : []),
    [lancamentos, selectedCentroId],
  )

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

  const totalCentroSelecionado = useMemo(
    () => lancamentosDoCentro.reduce((acc, l) => acc + (Number(l.valor) || 0), 0),
    [lancamentosDoCentro],
  )

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
    setCentroForm({ nome: c.nome, tipo: c.tipo, descricao: c.descricao || '' })
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
    if (lancErrors[key]) setLancErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  const validateLanc = (form: LancamentoFormData): boolean => {
    const errors: LancErrors = {}
    if (!form.data) errors.data = 'Informe a data'
    const val = parseValor(form.valor)
    if (!form.valor.trim()) {
      errors.valor = 'Informe o valor'
    } else if (val <= 0) {
      errors.valor = 'O valor deve ser maior que zero'
    }
    setLancErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleCreateLanc = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCentroId || !validateLanc(lancForm)) return
    setSavingLanc(true)
    try {
      await lancamentosCentroService.create({
        centro: selectedCentroId,
        data: lancForm.data,
        valor: parseValor(lancForm.valor),
        descricao: lancForm.descricao,
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
      data: l.data ? l.data.slice(0, 10) : '',
      valor: String(l.valor).replace('.', ','),
      descricao: l.descricao || '',
    })
    setLancErrors({})
    setEditLancOpen(true)
  }

  const handleUpdateLanc = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingLanc || !validateLanc(lancForm)) return
    setSavingLanc(true)
    try {
      await lancamentosCentroService.update(editingLanc.id, {
        data: lancForm.data,
        valor: parseValor(lancForm.valor),
        descricao: lancForm.descricao,
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

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-xl font-bold text-[#0B1F3A] tracking-tight">Centros de Custo</h1>
        <p className="text-xs text-[#5B6B7F]">
          Cadastre centros de receita e despesa e registre lançamentos com data e valor para cada
          centro.
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
                  Selecione um centro na tabela ao lado para visualizar e registrar lançamentos com
                  data e valor.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Cabeçalho do centro selecionado */}
              <Card className="bg-white border-slate-200 shadow-xs">
                <CardContent className="pt-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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
                    <div className="text-right">
                      <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wide">
                        Total acumulado
                      </p>
                      <p
                        className={`text-lg font-bold ${
                          selectedCentro.tipo === 'Receita' ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {formatBrl(totalCentroSelecionado)}
                      </p>
                    </div>
                  </div>
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
                    Registre uma movimentação com data e valor para este centro.
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
                      <div className="space-y-1.5">
                        <Label htmlFor="lanc-data" className="text-xs font-semibold text-slate-700">
                          Data *
                        </Label>
                        <Input
                          id="lanc-data"
                          type="date"
                          value={lancForm.data}
                          onChange={(e) => setLancField('data', e.target.value)}
                          className={`h-9 text-xs ${lancErrors.data ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                        />
                        {lancErrors.data && (
                          <p className="text-[11px] text-red-600 font-medium">{lancErrors.data}</p>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <Label
                          htmlFor="lanc-valor"
                          className="text-xs font-semibold text-slate-700"
                        >
                          Valor (R$) *
                        </Label>
                        <Input
                          id="lanc-valor"
                          inputMode="decimal"
                          placeholder="0,00"
                          value={lancForm.valor}
                          onChange={(e) => setLancField('valor', e.target.value)}
                          className={`h-9 text-xs font-mono ${lancErrors.valor ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                        />
                        {lancErrors.valor && (
                          <p className="text-[11px] text-red-600 font-medium">{lancErrors.valor}</p>
                        )}
                      </div>

                      <div className="space-y-1.5 sm:col-span-2">
                        <Label
                          htmlFor="lanc-descricao"
                          className="text-xs font-semibold text-slate-700"
                        >
                          Descrição
                        </Label>
                        <Input
                          id="lanc-descricao"
                          placeholder="Ex: Campanha Google Ads, Salários Janeiro"
                          value={lancForm.descricao}
                          onChange={(e) => setLancField('descricao', e.target.value)}
                          className="h-9 text-xs"
                        />
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
                <CardHeader className="pb-3 border-b border-slate-100">
                  <CardTitle className="text-sm font-bold text-[#0B1F3A]">
                    Lançamentos ({lancamentosDoCentro.length})
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Ordenados por data decrescente.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  {lancamentosDoCentro.length === 0 ? (
                    <div className="py-12 text-center text-xs text-slate-500">
                      Nenhum lançamento neste centro. Adicione o primeiro acima.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 font-semibold">
                            <th className="py-3 px-4">Data</th>
                            <th className="py-3 px-4">Descrição</th>
                            <th className="py-3 px-4 text-right">Valor</th>
                            <th className="py-3 px-4 text-right">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {lancamentosDoCentro.map((l) => (
                            <tr key={l.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="py-3 px-4 whitespace-nowrap text-slate-700 font-medium">
                                {formatData(l.data)}
                              </td>
                              <td className="py-3 px-4 text-slate-700">
                                {l.descricao || (
                                  <span className="text-slate-400 italic">Sem descrição</span>
                                )}
                              </td>
                              <td
                                className={`py-3 px-4 text-right font-semibold whitespace-nowrap ${
                                  selectedCentro.tipo === 'Receita'
                                    ? 'text-emerald-600'
                                    : 'text-rose-600'
                                }`}
                              >
                                {formatBrl(Number(l.valor))}
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
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2 border-slate-200 bg-slate-50/70 font-semibold">
                            <td className="py-3 px-4 text-slate-700" colSpan={2}>
                              Total
                            </td>
                            <td
                              className={`py-3 px-4 text-right whitespace-nowrap ${
                                selectedCentro.tipo === 'Receita'
                                  ? 'text-emerald-600'
                                  : 'text-rose-600'
                              }`}
                            >
                              {formatBrl(totalCentroSelecionado)}
                            </td>
                            <td className="py-3 px-4" />
                          </tr>
                        </tfoot>
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
                Atualize os dados do lançamento. Campos com * são obrigatórios.
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-lanc-data" className="text-xs font-semibold text-slate-700">
                    Data *
                  </Label>
                  <Input
                    id="edit-lanc-data"
                    type="date"
                    value={lancForm.data}
                    onChange={(e) => setLancField('data', e.target.value)}
                    className={`h-9 text-xs ${lancErrors.data ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                  />
                  {lancErrors.data && (
                    <p className="text-[11px] text-red-600 font-medium">{lancErrors.data}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-lanc-valor" className="text-xs font-semibold text-slate-700">
                    Valor (R$) *
                  </Label>
                  <Input
                    id="edit-lanc-valor"
                    inputMode="decimal"
                    value={lancForm.valor}
                    onChange={(e) => setLancField('valor', e.target.value)}
                    className={`h-9 text-xs font-mono ${lancErrors.valor ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                  />
                  {lancErrors.valor && (
                    <p className="text-[11px] text-red-600 font-medium">{lancErrors.valor}</p>
                  )}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label
                  htmlFor="edit-lanc-descricao"
                  className="text-xs font-semibold text-slate-700"
                >
                  Descrição
                </Label>
                <Input
                  id="edit-lanc-descricao"
                  value={lancForm.descricao}
                  onChange={(e) => setLancField('descricao', e.target.value)}
                  className="h-9 text-xs"
                />
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
              Tem certeza que deseja excluir este lançamento de{' '}
              <strong className="text-slate-900 font-semibold">
                {formatBrl(Number(lancToDelete?.valor))}
              </strong>{' '}
              ({formatData(lancToDelete?.data || '')})? Esta ação não pode ser desfeita.
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
