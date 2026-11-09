import { useState, useEffect, useMemo } from 'react'
import { tiposDespesaService, lancamentosCentroService } from '@/services/financeService'
import type { TipoDespesaRecord } from '@/types/finance'
import { useFilter } from '@/contexts/FilterContext'
import { useAuth } from '@/contexts/AuthContext'
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
import {
  Tags,
  Plus,
  Pencil,
  Trash2,
  AlertCircle,
  GripVertical,
  Check,
  Loader2,
  Download,
} from 'lucide-react'
import { DoubleHorizontalScroll } from '@/components/DoubleHorizontalScroll'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface TipoDespesaFormData {
  nome: string
  descricao: string
}

const EMPTY_FORM: TipoDespesaFormData = { nome: '', descricao: '' }
type FormErrors = Partial<Record<keyof TipoDespesaFormData | 'general', string>>

export default function TiposDespesas() {
  const { toast } = useToast()
  const { selectedEmpresaId, isGrupoAtivo, grupoAtivo } = useFilter()
  const { user } = useAuth()
  const isCliente = user?.role === 'cliente'
  const effectiveEmpresaId = selectedEmpresaId || user?.empresa || ''

  // Desagrega empresas do grupo para busca segura e sem duplicidades
  const empresasIdsDoGrupo = useMemo(() => {
    if (isGrupoAtivo && grupoAtivo && (grupoAtivo.empresas || []).length > 0) {
      return grupoAtivo.empresas
    }
    return undefined
  }, [isGrupoAtivo, grupoAtivo])

  const [tipos, setTipos] = useState<TipoDespesaRecord[]>([])
  const [contagemLancamentos, setContagemLancamentos] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  // Drag & Drop reordenação
  const [arrastandoTipoId, setArrastandoTipoId] = useState<string | null>(null)
  const [indiceSoltarEm, setIndiceSoltarEm] = useState<number | null>(null)
  const [salvandoOrdemTipos, setSalvandoOrdemTipos] = useState(false)
  const [ordemSalvaSucesso, setOrdemSalvaSucesso] = useState(false)

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
      const opts = empresasIdsDoGrupo
        ? { empresasIds: empresasIdsDoGrupo }
        : effectiveEmpresaId && !effectiveEmpresaId.startsWith('grupo-')
          ? { empresaId: effectiveEmpresaId }
          : undefined

      const [tList, lList] = await Promise.all([
        tiposDespesaService.getAll(opts),
        lancamentosCentroService.getAll(opts),
      ])

      // Deduplicação defensiva por ID e exclusão de órfãos (empresa vazio para não-admin)
      const deduplicadosTipos = Array.from(new Map(tList.map((i) => [i.id, i])).values()).filter(
        (t) => {
          if (user?.role !== 'admin' && !t.empresa) return false
          return true
        },
      )

      setTipos(deduplicadosTipos)
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
  }, [effectiveEmpresaId, empresasIdsDoGrupo])

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
      const empresaParaCriar =
        effectiveEmpresaId && !effectiveEmpresaId.startsWith('grupo-')
          ? effectiveEmpresaId
          : empresasIdsDoGrupo && empresasIdsDoGrupo.length > 0
            ? empresasIdsDoGrupo[0]
            : user?.empresa || undefined

      const novo = await tiposDespesaService.create({
        nome: form.nome,
        descricao: form.descricao,
        empresa: empresaParaCriar,
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
    if (isCliente) return
    setEditing(t)
    setForm({ nome: t.nome, descricao: t.descricao || '' })
    setErrors({})
    setEditOpen(true)
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isCliente || !editing || !validate(form)) return
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
    if (isCliente) return
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

  const tiposOrdenados = useMemo(() => {
    return [...tipos].sort((a, b) => {
      const ordA = a.ordem != null ? a.ordem : 999999
      const ordB = b.ordem != null ? b.ordem : 999999
      if (ordA !== ordB) return ordA - ordB
      return (a.nome || '').localeCompare(b.nome || '')
    })
  }, [tipos])

  const handleExportarCsv = () => {
    if (tiposOrdenados.length === 0) {
      toast({
        title: 'Nenhum tipo para exportar',
        description: 'A lista de tipos de despesa está vazia.',
        variant: 'destructive',
      })
      return
    }

    const headers = [
      'Posição',
      'Código',
      'Nome do Tipo de Despesa',
      'Descrição',
      'Qtd. Lançamentos',
    ]

    const rows = tiposOrdenados.map((t, idx) => {
      const count = contagemLancamentos[t.id] || 0
      return [
        String(idx + 1),
        `"${(t.codigo || '').replace(/"/g, '""')}"`,
        `"${(t.nome || '').replace(/"/g, '""')}"`,
        `"${(t.descricao || '').replace(/"/g, '""')}"`,
        String(count),
      ]
    })

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\r\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `tipos_despesa_${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    toast({
      title: 'CSV exportado com sucesso',
      description: `${tiposOrdenados.length} tipo(s) de despesa exportado(s) na ordem da tela.`,
    })
  }

  const handleDragStart = (e: React.DragEvent, id: string) => {
    if (isCliente || salvandoOrdemTipos) {
      e.preventDefault()
      return
    }
    setArrastandoTipoId(id)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', id)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    if (isCliente || salvandoOrdemTipos) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (indiceSoltarEm !== index) {
      setIndiceSoltarEm(index)
    }
  }

  const handleDragLeave = () => {
    if (isCliente) return
    setIndiceSoltarEm(null)
  }

  const handleSoltar = async (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault()
    setIndiceSoltarEm(null)
    if (isCliente || salvandoOrdemTipos) return

    const draggedId = arrastandoTipoId || e.dataTransfer.getData('text/plain')
    setArrastandoTipoId(null)
    if (!draggedId) return

    const currentIndex = tiposOrdenados.findIndex((t) => t.id === draggedId)
    if (currentIndex === -1 || currentIndex === dropIndex) return

    const novaLista = [...tiposOrdenados]
    const [removido] = novaLista.splice(currentIndex, 1)
    novaLista.splice(dropIndex, 0, removido)

    // Otimista
    setTipos(novaLista)
    setSalvandoOrdemTipos(true)

    try {
      const idsOrdenados = novaLista.map((t) => t.id)
      await tiposDespesaService.reordenar(idsOrdenados)
      setOrdemSalvaSucesso(true)
      setTimeout(() => setOrdemSalvaSucesso(false), 2500)
      window.dispatchEvent(new CustomEvent('dre-contas-atualizado'))
      toast({
        title: 'Ordem atualizada',
        description: 'A nova ordem dos tipos de despesa foi salva com sucesso.',
      })
    } catch (err: any) {
      console.error('Erro ao reordenar tipos de despesa:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar ordem',
        description: err?.message || 'Não foi possível salvar a nova ordem.',
      })
      await loadData()
    } finally {
      setSalvandoOrdemTipos(false)
    }
  }

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
        {!isCliente && (
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
                  <Alert
                    variant="destructive"
                    className="bg-red-50 border-red-200 text-red-800 py-2"
                  >
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
        )}

        {/* ============ COLUNA DIREITA: TABELA ============ */}
        <Card className="bg-white border-slate-200 shadow-xs">
          <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="text-sm font-bold text-[#0B1F3A]">
                Tipos Cadastrados ({tiposOrdenados.length})
              </CardTitle>
              <CardDescription className="text-xs">
                {totalVinculados} lançamento(s) vinculado(s) no total.
                {!isCliente && ' Arraste pelo cabo para reordenar.'}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleExportarCsv}
                disabled={tiposOrdenados.length === 0}
                className="h-7 text-[11px] font-semibold border-slate-200 hover:bg-slate-50 text-slate-700"
                title="Exportar tipos de despesa em CSV na mesma ordem da tela"
              >
                <Download className="w-3.5 h-3.5 mr-1.5" />
                Exportar CSV
              </Button>
              {salvandoOrdemTipos && (
                <span className="inline-flex items-center gap-1.5 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-md px-2.5 py-1">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                  Salvando ordem...
                </span>
              )}
              {ordemSalvaSucesso && (
                <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-2.5 py-1">
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  Ordem salva
                </span>
              )}
            </div>
          </CardHeader>{' '}
          <CardContent className="p-0">
            {loading ? (
              <div className="py-12 flex justify-center items-center">
                <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : tiposOrdenados.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500">
                Nenhum tipo de despesa cadastrado.
                {!isCliente && ' Use o formulário ao lado para criar o primeiro.'}
              </div>
            ) : (
              <DoubleHorizontalScroll>
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 font-semibold">
                      <th className="py-3 px-4 w-10 text-center">#</th>
                      <th className="py-3 px-4">Código</th>
                      <th className="py-3 px-4">Nome</th>
                      <th className="py-3 px-4">Descrição</th>
                      <th className="py-3 px-4 text-center">Qtd. Lançamentos</th>
                      <th className="py-3 px-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {tiposOrdenados.map((t, idx) => {
                      const count = contagemLancamentos[t.id] || 0
                      const isDragging = arrastandoTipoId === t.id
                      const isDropTarget = indiceSoltarEm === idx && !isDragging
                      return (
                        <tr
                          key={t.id}
                          draggable={!isCliente && !salvandoOrdemTipos}
                          onDragStart={(e) => handleDragStart(e, t.id)}
                          onDragOver={(e) => handleDragOver(e, idx)}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => handleSoltar(e, idx)}
                          className={`hover:bg-slate-50/80 transition-colors ${
                            isDragging ? 'opacity-40 bg-blue-50/40' : ''
                          } ${isDropTarget ? 'border-t-2 border-blue-500 bg-blue-50/30' : ''}`}
                        >
                          <td className="py-3 px-3 text-center text-slate-400">
                            {!isCliente ? (
                              <div
                                className="cursor-grab active:cursor-grabbing inline-flex items-center justify-center p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700"
                                title="Clique e arraste para reordenar"
                              >
                                <GripVertical className="w-3.5 h-3.5" />
                              </div>
                            ) : (
                              <span className="text-[11px] font-mono text-slate-400">
                                {idx + 1}
                              </span>
                            )}
                          </td>
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
                              {!isCliente ? (
                                <>
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
                                </>
                              ) : (
                                <span className="text-[11px] text-slate-400 italic">
                                  Somente visualização
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </DoubleHorizontalScroll>
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
