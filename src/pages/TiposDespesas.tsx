import { useState, useEffect, useMemo } from 'react'
import { tiposDespesaService, lancamentosCentroService } from '@/services/financeService'
import type { TipoDespesaRecord } from '@/types/finance'
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Tags, Plus, Pencil, Trash2, AlertCircle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface TipoDespesaFormData {
  nome: string
  descricao: string
}

const EMPTY_FORM: TipoDespesaFormData = { nome: '', descricao: '' }
type FormErrors = Partial<Record<keyof TipoDespesaFormData | 'general', string>>

export default function TiposDespesas() {
  const { toast } = useToast()

  const [tipos, setTipos] = useState<TipoDespesaRecord[]>([])
  const [contagemLancamentos, setContagemLancamentos] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  // Form criação
  const [form, setForm] = useState<TipoDespesaFormData>(EMPTY_FORM)
  const [errors, setErrors] = useState<FormErrors>({})
  const [saving, setSaving] = useState(false)

  // Modal edição
  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState<TipoDespesaRecord | null>(null)

  // Modal exclusão
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [toDelete, setToDelete] = useState<TipoDespesaRecord | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadData = async () => {
    try {
      setLoading(true)
      const [tList, lList] = await Promise.all([
        tiposDespesaService.getAll(),
        lancamentosCentroService.getAll(),
      ])
      setTipos(tList)
      const counts: Record<string, number> = {}
      for (const l of lList) {
        if (l.tipo_despesa) {
          counts[l.tipo_despesa] = (counts[l.tipo_despesa] || 0) + 1
        }
      }
      setContagemLancamentos(counts)
    } catch (err) {
      console.error('Erro ao carregar tipos de despesa:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar',
        description: 'Não foi possível carregar os tipos de despesa.',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useRealtime<TipoDespesaRecord>('tipos_despesa', () => loadData())
  useRealtime('lancamentos_centro', () => loadData())

  const setField = <K extends keyof TipoDespesaFormData>(key: K, value: TipoDespesaFormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  const validate = (f: TipoDespesaFormData): boolean => {
    const errs: FormErrors = {}
    if (!f.nome.trim() || f.nome.trim().length < 2) {
      errs.nome = 'Informe um nome com pelo menos 2 caracteres'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate(form)) return
    setSaving(true)
    try {
      const novo = await tiposDespesaService.create({
        nome: form.nome,
        descricao: form.descricao,
      })
      toast({
        title: 'Tipo de despesa criado',
        description: `"${novo.nome}" foi cadastrado com sucesso.`,
      })
      setForm(EMPTY_FORM)
    } catch (err: any) {
      console.error(err)
      setErrors((prev) => ({
        ...prev,
        general: err?.message || 'Erro ao salvar o tipo de despesa.',
      }))
    } finally {
      setSaving(false)
    }
  }

  const openEdit = (t: TipoDespesaRecord) => {
    setEditing(t)
    setForm({ nome: t.nome, descricao: t.descricao || '' })
    setErrors({})
    setEditOpen(true)
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editing || !validate(form)) return
    setSaving(true)
    try {
      await tiposDespesaService.update(editing.id, {
        nome: form.nome,
        descricao: form.descricao,
      })
      toast({ title: 'Tipo de despesa atualizado', description: 'As alterações foram salvas.' })
      setEditOpen(false)
      setEditing(null)
    } catch (err: any) {
      console.error(err)
      setErrors((prev) => ({
        ...prev,
        general: err?.message || 'Erro ao atualizar o tipo de despesa.',
      }))
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = (t: TipoDespesaRecord) => {
    setToDelete(t)
    setDeleteOpen(true)
  }

  const handleDelete = async () => {
    if (!toDelete) return
    setDeleting(true)
    try {
      await tiposDespesaService.delete(toDelete.id)
      toast({
        title: 'Tipo de despesa removido',
        description: `"${toDelete.nome}" foi excluído.`,
      })
      setDeleteOpen(false)
      setToDelete(null)
    } catch (err: any) {
      console.error(err)
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir',
        description: err?.message || 'Não foi possível excluir o tipo de despesa.',
      })
    } finally {
      setDeleting(false)
    }
  }

  const totalVinculados = useMemo(
    () => Object.values(contagemLancamentos).reduce((a, b) => a + b, 0),
    [contagemLancamentos],
  )

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-xl font-bold text-[#0B1F3A] tracking-tight">Tipos de Despesas</h1>
        <p className="text-xs text-[#5B6B7F]">
          Cadastre tipos de despesa para classificar os lançamentos dos centros de custo.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        {/* ============ COLUNA ESQUERDA: FORMULÁRIO ============ */}
        <Card className="bg-white border-slate-200 shadow-xs">
          <CardHeader className="pb-3 border-b border-slate-100">
            <CardTitle className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
              <Tags className="w-4 h-4 text-blue-600" />
              Novo Tipo de Despesa
            </CardTitle>
            <CardDescription className="text-xs">
              Crie um tipo para classificar lançamentos de despesa nos centros de custo.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <form onSubmit={handleCreate} className="space-y-3">
              {errors.general && (
                <Alert variant="destructive" className="bg-red-50 border-red-200 text-red-800 py-2">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-xs font-medium">
                    {errors.general}
                  </AlertDescription>
                </Alert>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="tipo-nome" className="text-xs font-semibold text-slate-700">
                  Nome *
                </Label>
                <Input
                  id="tipo-nome"
                  placeholder="Ex: Aluguel, Folha de Pagamento, Impostos, Marketing"
                  value={form.nome}
                  onChange={(e) => setField('nome', e.target.value)}
                  className={`h-9 text-xs ${errors.nome ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                />
                {errors.nome && (
                  <p className="text-[11px] text-red-600 font-medium">{errors.nome}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tipo-descricao" className="text-xs font-semibold text-slate-700">
                  Descrição
                </Label>
                <Input
                  id="tipo-descricao"
                  placeholder="Opcional"
                  value={form.descricao}
                  onChange={(e) => setField('descricao', e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={saving}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-9 shadow-xs"
                >
                  <Plus className="w-4 h-4 mr-1.5" />
                  {saving ? 'Salvando...' : 'Salvar Tipo'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* ============ COLUNA DIREITA: TABELA ============ */}
        <Card className="bg-white border-slate-200 shadow-xs">
          <CardHeader className="pb-3 border-b border-slate-100">
            <CardTitle className="text-sm font-bold text-[#0B1F3A]">
              Tipos Cadastrados ({tipos.length})
            </CardTitle>
            <CardDescription className="text-xs">
              {totalVinculados} lançamento(s) vinculado(s) no total.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="py-12 flex justify-center items-center">
                <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : tipos.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500">
                Nenhum tipo de despesa cadastrado. Use o formulário ao lado para criar o primeiro.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 font-semibold">
                      <th className="py-3 px-4">Código</th>
                      <th className="py-3 px-4">Nome</th>
                      <th className="py-3 px-4">Descrição</th>
                      <th className="py-3 px-4 text-center">Qtd. Lançamentos</th>
                      <th className="py-3 px-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {tipos.map((t) => {
                      const count = contagemLancamentos[t.id] || 0
                      return (
                        <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4">
                            <span className="font-mono font-semibold text-blue-700 text-[11px]">
                              {t.codigo || '—'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-blue-50 text-blue-600">
                                <Tags className="w-4 h-4" />
                              </div>
                              <span className="font-semibold text-slate-900">{t.nome}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-slate-700">
                            {t.descricao ? (
                              t.descricao
                            ) : (
                              <span className="text-slate-400 italic">Sem descrição</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <Badge
                              className={`text-[10px] font-semibold px-2 py-0.5 border ${
                                count > 0
                                  ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-50'
                                  : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-50'
                              }`}
                            >
                              {count}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                onClick={() => openEdit(t)}
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                                title="Editar tipo"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                onClick={() => confirmDelete(t)}
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-slate-500 hover:text-red-600 hover:bg-red-50"
                                title="Excluir tipo"
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

      {/* ============ MODAL EDIÇÃO ============ */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[480px] bg-white">
          <form onSubmit={handleUpdate}>
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-[#0B1F3A] flex items-center gap-2">
                <Pencil className="w-4 h-4 text-blue-600" />
                Editar Tipo de Despesa
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Atualize as informações do tipo de despesa. Campos com * são obrigatórios.
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
              <div className="space-y-1.5">
                <Label htmlFor="edit-tipo-nome" className="text-xs font-semibold text-slate-700">
                  Nome *
                </Label>
                <Input
                  id="edit-tipo-nome"
                  value={form.nome}
                  onChange={(e) => setField('nome', e.target.value)}
                  className={`h-9 text-xs ${errors.nome ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                />
                {errors.nome && (
                  <p className="text-[11px] text-red-600 font-medium">{errors.nome}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label
                  htmlFor="edit-tipo-descricao"
                  className="text-xs font-semibold text-slate-700"
                >
                  Descrição
                </Label>
                <Input
                  id="edit-tipo-descricao"
                  value={form.descricao}
                  onChange={(e) => setField('descricao', e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditOpen(false)}
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
                {saving ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ============ CONFIRMAÇÃO EXCLUSÃO ============ */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-red-600 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" /> Excluir Tipo de Despesa?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-600">
              Tem certeza que deseja excluir o tipo{' '}
              <strong className="text-slate-900 font-semibold">{toDelete?.nome}</strong>? Os
              lançamentos já vinculados perderão essa classificação (o tipo será removido, mas os
              lançamentos permanecem). Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting} className="text-xs h-8">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white text-xs h-8 font-semibold"
            >
              {deleting ? 'Excluindo...' : 'Sim, Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
