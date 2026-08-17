import { useState, useEffect, useMemo } from 'react'
import {
  planoContasService,
  contasService,
  centrosService,
  tiposDespesaService,
} from '@/services/financeService'
import type {
  PlanoContaRecord,
  ContaRecord,
  CentroRecord,
  TipoDespesaRecord,
  TipoConta,
  TipoCentro,
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
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
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
import { FolderTree, Plus, Pencil, Trash2, AlertCircle, Search } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

const TIPOS_CONTA: TipoConta[] = ['Ativo', 'Passivo', 'Patrimônio Líquido', 'Receita', 'Despesa']
const TIPOS_CENTRO: TipoCentro[] = ['Receita', 'Despesa']

interface PlanoFormData {
  conta: string
  centro: string
  tipo_despesa: string
  descricao: string
}

const EMPTY_FORM: PlanoFormData = {
  conta: '',
  centro: '',
  tipo_despesa: '',
  descricao: '',
}

type FormErrors = Partial<Record<keyof PlanoFormData | 'general', string>>

// Badge do tipo de conta
const TIPO_CONTA_BADGE: Record<TipoConta, string> = {
  Ativo: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-50',
  Passivo: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50',
  'Patrimônio Líquido': 'bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-50',
  Receita: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50',
  Despesa: 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-50',
}

const TIPO_CENTRO_BADGE: Record<TipoCentro, string> = {
  Receita: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50',
  Despesa: 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-50',
}

export default function PlanoContas() {
  const { toast } = useToast()

  const [itens, setItens] = useState<PlanoContaRecord[]>([])
  const [contas, setContas] = useState<ContaRecord[]>([])
  const [centros, setCentros] = useState<CentroRecord[]>([])
  const [tipos, setTipos] = useState<TipoDespesaRecord[]>([])
  const [loading, setLoading] = useState(true)

  // Próximo código (preview no formulário de criação)
  const [proximoCodigo, setProximoCodigo] = useState<string>('PC-001')

  // Form criação
  const [form, setForm] = useState<PlanoFormData>(EMPTY_FORM)
  const [errors, setErrors] = useState<FormErrors>({})
  const [saving, setSaving] = useState(false)

  // Modal edição
  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState<PlanoContaRecord | null>(null)

  // Modal exclusão
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [toDelete, setToDelete] = useState<PlanoContaRecord | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Filtro
  const [busca, setBusca] = useState('')

  const loadData = async () => {
    try {
      setLoading(true)
      const [list, contasList, centrosList, tiposList] = await Promise.all([
        planoContasService.getAll(),
        contasService.getAll(),
        centrosService.getAll(),
        tiposDespesaService.getAll(),
      ])
      setItens(list)
      setContas(contasList)
      setCentros(centrosList)
      setTipos(tiposList)
      setProximoCodigo(planoContasService.proximoCodigo(list.map((i) => i.codigo || '')))
    } catch (err) {
      console.error('Erro ao carregar plano de contas:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar',
        description: 'Não foi possível carregar o plano de contas.',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useRealtime<PlanoContaRecord>('plano_contas', () => loadData())

  // Mapas de lookup por id
  const contaMap = useMemo(() => {
    const m = new Map<string, ContaRecord>()
    for (const c of contas) m.set(c.id, c)
    return m
  }, [contas])

  const centroMap = useMemo(() => {
    const m = new Map<string, CentroRecord>()
    for (const c of centros) m.set(c.id, c)
    return m
  }, [centros])

  const tipoMap = useMemo(() => {
    const m = new Map<string, TipoDespesaRecord>()
    for (const t of tipos) m.set(t.id, t)
    return m
  }, [tipos])

  // Contas agrupadas por tipo (para o select)
  const contasPorTipo = useMemo(() => {
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

  // Centros agrupados por tipo (para o select)
  const centrosPorTipo = useMemo(() => {
    const map = new Map<TipoCentro, CentroRecord[]>()
    for (const c of centros) {
      const arr = map.get(c.tipo) || []
      arr.push(c)
      map.set(c.tipo, arr)
    }
    for (const [, arr] of map) {
      arr.sort((a, b) => (a.codigo || '').localeCompare(b.codigo || ''))
    }
    return map
  }, [centros])

  // Itens filtrados por busca (código, nome da conta, nome do centro)
  const itensFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    if (!q) return itens
    return itens.filter((i) => {
      const codigo = (i.codigo || '').toLowerCase()
      const conta = contaMap.get(i.conta)
      const centro = centroMap.get(i.centro)
      const nomeConta = (conta?.nome || '').toLowerCase()
      const codConta = (conta?.codigo || '').toLowerCase()
      const nomeCentro = (centro?.nome || '').toLowerCase()
      const codCentro = (centro?.codigo || '').toLowerCase()
      return (
        codigo.includes(q) ||
        nomeConta.includes(q) ||
        codConta.includes(q) ||
        nomeCentro.includes(q) ||
        codCentro.includes(q)
      )
    })
  }, [itens, busca, contaMap, centroMap])

  // Resumo para os cards
  const totalItens = itens.length
  const totalComTipoDespesa = useMemo(() => itens.filter((i) => !!i.tipo_despesa).length, [itens])
  const totalSemTipoDespesa = totalItens - totalComTipoDespesa
  const totalContasUsadas = useMemo(() => new Set(itens.map((i) => i.conta)).size, [itens])
  const totalCentrosUsados = useMemo(() => new Set(itens.map((i) => i.centro)).size, [itens])

  const setField = <K extends keyof PlanoFormData>(key: K, value: PlanoFormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  const validate = (f: PlanoFormData): boolean => {
    const errs: FormErrors = {}
    if (!f.conta) errs.conta = 'Selecione a conta'
    if (!f.centro) errs.centro = 'Selecione o centro de custo'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate(form)) return
    setSaving(true)
    try {
      const novo = await planoContasService.create({
        conta: form.conta,
        centro: form.centro,
        tipo_despesa: form.tipo_despesa || undefined,
        descricao: form.descricao,
      })
      toast({
        title: 'Item do plano criado',
        description: `Vínculo cadastrado com o código ${novo.codigo}.`,
      })
      setForm(EMPTY_FORM)
    } catch (err: any) {
      console.error(err)
      setErrors((prev) => ({
        ...prev,
        general: err?.message || 'Erro ao salvar o item do plano.',
      }))
    } finally {
      setSaving(false)
    }
  }

  const openEdit = (i: PlanoContaRecord) => {
    setEditing(i)
    setForm({
      conta: i.conta,
      centro: i.centro,
      tipo_despesa: i.tipo_despesa || '',
      descricao: i.descricao || '',
    })
    setErrors({})
    setEditOpen(true)
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editing || !validate(form)) return
    setSaving(true)
    try {
      await planoContasService.update(editing.id, {
        conta: form.conta,
        centro: form.centro,
        tipo_despesa: form.tipo_despesa,
        descricao: form.descricao,
      })
      toast({ title: 'Item atualizado', description: 'As alterações foram salvas.' })
      setEditOpen(false)
      setEditing(null)
    } catch (err: any) {
      console.error(err)
      setErrors((prev) => ({
        ...prev,
        general: err?.message || 'Erro ao atualizar o item do plano.',
      }))
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = (i: PlanoContaRecord) => {
    setToDelete(i)
    setDeleteOpen(true)
  }

  const handleDelete = async () => {
    if (!toDelete) return
    setDeleting(true)
    try {
      await planoContasService.delete(toDelete.id)
      toast({
        title: 'Item removido',
        description: `O vínculo ${toDelete.codigo} foi excluído.`,
      })
      setDeleteOpen(false)
      setToDelete(null)
    } catch (err: any) {
      console.error(err)
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir',
        description: err?.message || 'Não foi possível excluir o item do plano.',
      })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-xl font-bold text-[#0B1F3A] tracking-tight">Plano de Contas</h1>
        <p className="text-xs text-[#5B6B7F]">
          Vincule contas a centros de custo (e tipos de despesa) para estruturar o plano de contas
          operacional.
        </p>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <Card className="bg-white border-slate-200 shadow-xs">
          <CardContent className="py-3 px-4">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Total de itens
            </p>
            <p className="text-lg font-bold text-[#0B1F3A] mt-0.5">{totalItens}</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-slate-200 shadow-xs">
          <CardContent className="py-3 px-4">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Com tipo vinculado
            </p>
            <p className="text-lg font-bold text-emerald-600 mt-0.5">{totalComTipoDespesa}</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-slate-200 shadow-xs">
          <CardContent className="py-3 px-4">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Sem tipo vinculado
            </p>
            <p className="text-lg font-bold text-amber-600 mt-0.5">{totalSemTipoDespesa}</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-slate-200 shadow-xs">
          <CardContent className="py-3 px-4">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Contas usadas
            </p>
            <p className="text-lg font-bold text-blue-600 mt-0.5">{totalContasUsadas}</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-slate-200 shadow-xs">
          <CardContent className="py-3 px-4">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Centros usados
            </p>
            <p className="text-lg font-bold text-violet-600 mt-0.5">{totalCentrosUsados}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        {/* ============ COLUNA ESQUERDA: FORMULÁRIO ============ */}
        <Card className="bg-white border-slate-200 shadow-xs">
          <CardHeader className="pb-3 border-b border-slate-100">
            <CardTitle className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
              <FolderTree className="w-4 h-4 text-blue-600" />
              Novo Vínculo
            </CardTitle>
            <CardDescription className="text-xs">
              Relacione uma conta a um centro de custo. O código é gerado automaticamente.
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
                <Label htmlFor="pc-codigo" className="text-xs font-semibold text-slate-700">
                  Código
                </Label>
                <Input
                  id="pc-codigo"
                  readOnly
                  value={proximoCodigo}
                  className="h-9 text-xs font-mono font-semibold text-slate-600 bg-slate-50 border-slate-200 cursor-not-allowed"
                />
                <p className="text-[11px] text-slate-400">
                  Gerado automaticamente ao salvar (sequencial por usuário).
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pc-conta" className="text-xs font-semibold text-slate-700">
                  Conta *
                </Label>
                <Select value={form.conta} onValueChange={(val) => setField('conta', val)}>
                  <SelectTrigger id="pc-conta" className="h-9 text-xs bg-white">
                    <SelectValue placeholder="Selecione a conta" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_CONTA.map((tipo) => {
                      const lista = contasPorTipo.get(tipo) || []
                      if (lista.length === 0) return null
                      return (
                        <SelectGroup key={tipo}>
                          <SelectLabel className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                            {tipo}
                          </SelectLabel>
                          {lista.map((c) => (
                            <SelectItem key={c.id} value={c.id} className="text-xs">
                              {c.codigo || '—'} - {c.nome} ({c.tipo})
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      )
                    })}
                  </SelectContent>
                </Select>
                {errors.conta && (
                  <p className="text-[11px] text-red-600 font-medium">{errors.conta}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pc-centro" className="text-xs font-semibold text-slate-700">
                  Centro de Custo *
                </Label>
                <Select value={form.centro} onValueChange={(val) => setField('centro', val)}>
                  <SelectTrigger id="pc-centro" className="h-9 text-xs bg-white">
                    <SelectValue placeholder="Selecione o centro de custo" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_CENTRO.map((tipo) => {
                      const lista = centrosPorTipo.get(tipo) || []
                      if (lista.length === 0) return null
                      return (
                        <SelectGroup key={tipo}>
                          <SelectLabel className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                            {tipo}
                          </SelectLabel>
                          {lista.map((c) => (
                            <SelectItem key={c.id} value={c.id} className="text-xs">
                              {c.codigo || '—'} - {c.nome} ({c.tipo})
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      )
                    })}
                  </SelectContent>
                </Select>
                {errors.centro && (
                  <p className="text-[11px] text-red-600 font-medium">{errors.centro}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pc-tipo" className="text-xs font-semibold text-slate-700">
                  Tipo de Despesa
                </Label>
                <Select
                  value={form.tipo_despesa}
                  onValueChange={(val) => setField('tipo_despesa', val)}
                >
                  <SelectTrigger id="pc-tipo" className="h-9 text-xs bg-white">
                    <SelectValue placeholder="Opcional" />
                  </SelectTrigger>
                  <SelectContent>
                    {tipos.map((t) => (
                      <SelectItem key={t.id} value={t.id} className="text-xs">
                        {t.codigo || '—'} - {t.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-slate-400">Opcional — vincule um tipo de despesa.</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pc-descricao" className="text-xs font-semibold text-slate-700">
                  Descrição
                </Label>
                <Textarea
                  id="pc-descricao"
                  placeholder="Opcional"
                  value={form.descricao}
                  onChange={(e) => setField('descricao', e.target.value)}
                  className="min-h-[72px] text-xs"
                />
              </div>

              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={saving}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-9 shadow-xs"
                >
                  <Plus className="w-4 h-4 mr-1.5" />
                  {saving ? 'Salvando...' : 'Salvar Vínculo'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* ============ COLUNA DIREITA: TABELA ============ */}
        <Card className="bg-white border-slate-200 shadow-xs">
          <CardHeader className="pb-3 border-b border-slate-100 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-sm font-bold text-[#0B1F3A]">
                Itens do Plano ({itensFiltrados.length}
                {busca.trim() ? ` de ${itens.length}` : ''})
              </CardTitle>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <div className="relative flex-1 sm:w-56">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <Input
                  placeholder="Buscar por código, conta ou centro"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="h-8 text-xs pl-8"
                />
              </div>
            </div>
            <CardDescription className="text-xs">
              {itens.length === 0
                ? 'Nenhum vínculo cadastrado ainda.'
                : `${itens.length} item(ns) no total.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="py-12 flex justify-center items-center">
                <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : itens.length === 0 ? (
              <div className="py-16 flex flex-col items-center justify-center text-center">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                  <FolderTree className="w-7 h-7 text-slate-400" />
                </div>
                <h3 className="text-sm font-bold text-[#0B1F3A]">Nenhum vínculo cadastrado</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-xs">
                  Use o formulário ao lado para criar o primeiro vínculo do seu plano de contas.
                </p>
              </div>
            ) : itensFiltrados.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500">
                Nenhum item encontrado para a busca.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 font-semibold">
                      <th className="py-3 px-4">Código</th>
                      <th className="py-3 px-4">Conta</th>
                      <th className="py-3 px-4">Centro</th>
                      <th className="py-3 px-4">Tipo de Despesa</th>
                      <th className="py-3 px-4">Descrição</th>
                      <th className="py-3 px-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {itensFiltrados.map((i) => {
                      const conta = contaMap.get(i.conta)
                      const centro = centroMap.get(i.centro)
                      const tipo = i.tipo_despesa ? tipoMap.get(i.tipo_despesa) : undefined
                      return (
                        <tr key={i.id} className="hover:bg-slate-50/80 transition-colors align-top">
                          <td className="py-3 px-4">
                            <span className="font-mono font-semibold text-blue-700 text-[11px]">
                              {i.codigo || '—'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            {conta ? (
                              <div className="flex flex-col gap-1">
                                <Badge
                                  className={`text-[10px] font-semibold px-2 py-0.5 border w-fit ${
                                    TIPO_CONTA_BADGE[conta.tipo] || ''
                                  }`}
                                >
                                  <span className="font-mono">{conta.codigo || '—'}</span>
                                  <span className="mx-1">·</span>
                                  {conta.nome}
                                </Badge>
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">Conta removida</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            {centro ? (
                              <Badge
                                className={`text-[10px] font-semibold px-2 py-0.5 border w-fit ${
                                  TIPO_CENTRO_BADGE[centro.tipo] || ''
                                }`}
                              >
                                <span className="font-mono">{centro.codigo || '—'}</span>
                                <span className="mx-1">·</span>
                                {centro.nome}
                              </Badge>
                            ) : (
                              <span className="text-slate-400 italic">Centro removido</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            {tipo ? (
                              <Badge className="text-[10px] font-semibold px-2 py-0.5 border bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-50 w-fit">
                                <span className="font-mono">{tipo.codigo || '—'}</span>
                                <span className="mx-1">·</span>
                                {tipo.nome}
                              </Badge>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-slate-700 max-w-[220px]">
                            {i.descricao ? (
                              <span className="block truncate" title={i.descricao}>
                                {i.descricao}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                onClick={() => openEdit(i)}
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                                title="Editar vínculo"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                onClick={() => confirmDelete(i)}
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-slate-500 hover:text-red-600 hover:bg-red-50"
                                title="Excluir vínculo"
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
                Editar Vínculo
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Atualize as informações do vínculo. O código não pode ser alterado. Campos com * são
                obrigatórios.
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
                <Label htmlFor="edit-pc-codigo" className="text-xs font-semibold text-slate-700">
                  Código
                </Label>
                <Input
                  id="edit-pc-codigo"
                  readOnly
                  value={editing?.codigo || ''}
                  className="h-9 text-xs font-mono font-semibold text-slate-600 bg-slate-50 border-slate-200 cursor-not-allowed"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-pc-conta" className="text-xs font-semibold text-slate-700">
                  Conta *
                </Label>
                <Select value={form.conta} onValueChange={(val) => setField('conta', val)}>
                  <SelectTrigger id="edit-pc-conta" className="h-9 text-xs bg-white">
                    <SelectValue placeholder="Selecione a conta" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_CONTA.map((tipo) => {
                      const lista = contasPorTipo.get(tipo) || []
                      if (lista.length === 0) return null
                      return (
                        <SelectGroup key={tipo}>
                          <SelectLabel className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                            {tipo}
                          </SelectLabel>
                          {lista.map((c) => (
                            <SelectItem key={c.id} value={c.id} className="text-xs">
                              {c.codigo || '—'} - {c.nome} ({c.tipo})
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      )
                    })}
                  </SelectContent>
                </Select>
                {errors.conta && (
                  <p className="text-[11px] text-red-600 font-medium">{errors.conta}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-pc-centro" className="text-xs font-semibold text-slate-700">
                  Centro de Custo *
                </Label>
                <Select value={form.centro} onValueChange={(val) => setField('centro', val)}>
                  <SelectTrigger id="edit-pc-centro" className="h-9 text-xs bg-white">
                    <SelectValue placeholder="Selecione o centro de custo" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_CENTRO.map((tipo) => {
                      const lista = centrosPorTipo.get(tipo) || []
                      if (lista.length === 0) return null
                      return (
                        <SelectGroup key={tipo}>
                          <SelectLabel className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                            {tipo}
                          </SelectLabel>
                          {lista.map((c) => (
                            <SelectItem key={c.id} value={c.id} className="text-xs">
                              {c.codigo || '—'} - {c.nome} ({c.tipo})
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      )
                    })}
                  </SelectContent>
                </Select>
                {errors.centro && (
                  <p className="text-[11px] text-red-600 font-medium">{errors.centro}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-pc-tipo" className="text-xs font-semibold text-slate-700">
                  Tipo de Despesa
                </Label>
                <Select
                  value={form.tipo_despesa}
                  onValueChange={(val) => setField('tipo_despesa', val)}
                >
                  <SelectTrigger id="edit-pc-tipo" className="h-9 text-xs bg-white">
                    <SelectValue placeholder="Opcional" />
                  </SelectTrigger>
                  <SelectContent>
                    {tipos.map((t) => (
                      <SelectItem key={t.id} value={t.id} className="text-xs">
                        {t.codigo || '—'} - {t.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-pc-descricao" className="text-xs font-semibold text-slate-700">
                  Descrição
                </Label>
                <Textarea
                  id="edit-pc-descricao"
                  value={form.descricao}
                  onChange={(e) => setField('descricao', e.target.value)}
                  className="min-h-[72px] text-xs"
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
              <AlertCircle className="w-5 h-5" /> Excluir Vínculo?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-600">
              Tem certeza que deseja excluir o item{' '}
              <strong className="text-slate-900 font-semibold">{toDelete?.codigo}</strong> do plano
              de contas? Esta ação não pode ser desfeita e o código não será reutilizado.
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
