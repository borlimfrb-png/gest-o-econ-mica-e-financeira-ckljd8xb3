import { useState, useEffect, useMemo } from 'react'
import { contasService, lancamentosCentroService } from '@/services/financeService'
import type { ContaRecord, TipoConta, LancamentoCentroRecord } from '@/types/finance'
import { useRealtime } from '@/hooks/use-realtime'
import { useToast } from '@/hooks/use-toast'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
  BookOpen,
  Plus,
  Pencil,
  Trash2,
  AlertCircle,
  Search,
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  FileText,
  ChevronsDownUp,
  ChevronsUpDown,
} from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

const TIPOS_CONTA: TipoConta[] = ['Ativo', 'Passivo', 'Patrimônio Líquido', 'Receita', 'Despesa']
const TIPOS_PLANO_ORDEM: TipoConta[] = [
  'Ativo',
  'Passivo',
  'Patrimônio Líquido',
  'Receita',
  'Despesa',
]

// Grupos sugeridos por tipo de conta (apenas sugestão — o usuário pode digitar outro)
const GRUPOS_POR_TIPO: Record<TipoConta, string[]> = {
  Ativo: ['Ativo Circulante', 'Ativo Não Circulante'],
  Passivo: ['Passivo Circulante', 'Passivo Não Circulante'],
  'Patrimônio Líquido': ['Patrimônio Líquido'],
  Receita: ['Receitas Operacionais', 'Outras Receitas'],
  Despesa: ['Despesas Operacionais', 'Despesas Financeiras', 'Outras Despesas'],
}

interface ContaFormData {
  nome: string
  tipo: TipoConta
  grupo: string
  descricao: string
}

const EMPTY_FORM: ContaFormData = {
  nome: '',
  tipo: 'Ativo',
  grupo: '',
  descricao: '',
}

type FormErrors = Partial<Record<keyof ContaFormData | 'general', string>>

// Cores do badge por tipo de conta
const TIPO_BADGE: Record<TipoConta, string> = {
  Ativo: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-50',
  Passivo: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50',
  'Patrimônio Líquido': 'bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-50',
  Receita: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50',
  Despesa: 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-50',
}

export default function Contas() {
  const { toast } = useToast()

  const [contas, setContas] = useState<ContaRecord[]>([])
  const [lancamentos, setLancamentos] = useState<LancamentoCentroRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [abaContas, setAbaContas] = useState<'lista' | 'plano'>('lista')
  const [expandedTipos, setExpandedTipos] = useState<Record<string, boolean>>({})
  const [expandedGrupos, setExpandedGrupos] = useState<Record<string, boolean>>({})

  // Próximo código (preview no formulário de criação)
  const [proximoCodigo, setProximoCodigo] = useState<string>('CO-001')

  // Form criação
  const [form, setForm] = useState<ContaFormData>(EMPTY_FORM)
  const [errors, setErrors] = useState<FormErrors>({})
  const [saving, setSaving] = useState(false)

  // Modal edição
  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState<ContaRecord | null>(null)

  // Modal exclusão
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [toDelete, setToDelete] = useState<ContaRecord | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Filtros
  const [filtroTipo, setFiltroTipo] = useState<string>('todos')
  const [busca, setBusca] = useState('')

  const loadData = async () => {
    try {
      setLoading(true)
      const [list, lancList] = await Promise.all([
        contasService.getAll(),
        lancamentosCentroService.getAll(),
      ])
      setContas(list)
      setLancamentos(lancList)
      // Próximo código com base nos códigos já existentes
      setProximoCodigo(contasService.proximoCodigo(list.map((c) => c.codigo || '')))
    } catch (err) {
      console.error('Erro ao carregar contas:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar',
        description: 'Não foi possível carregar as contas.',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useRealtime<ContaRecord>('contas', () => loadData())
  useRealtime<LancamentoCentroRecord>('lancamentos_centro', () => loadData())

  // Soma de valores dos lançamentos vinculados a cada conta (id -> total)
  const totaisPorConta = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>()
    for (const l of lancamentos) {
      if (!l.conta) continue
      const cur = map.get(l.conta) || { count: 0, total: 0 }
      cur.count += 1
      cur.total += Number(l.valor) || 0
      map.set(l.conta, cur)
    }
    return map
  }, [lancamentos])

  // Estrutura hierárquica do Plano de Contas: Tipo -> Grupo -> Contas
  const planoHierarquico = useMemo(() => {
    return TIPOS_PLANO_ORDEM.map((tipo) => {
      const contasDoTipo = contas.filter((c) => c.tipo === tipo)
      const gruposMap = new Map<string, ContaRecord[]>()
      for (const c of contasDoTipo) {
        const g = c.grupo?.trim() || 'Sem grupo'
        const arr = gruposMap.get(g) || []
        arr.push(c)
        gruposMap.set(g, arr)
      }
      const grupos = Array.from(gruposMap.entries())
        .map(([nome, lista]) => ({
          nome,
          contas: lista.sort((a, b) => (a.codigo || '').localeCompare(b.codigo || '')),
        }))
        .sort((a, b) => a.nome.localeCompare(b.nome))
      return { tipo, grupos }
    }).filter((t) => t.grupos.length > 0)
  }, [contas])

  const todasChavesTipo = planoHierarquico.map((t) => t.tipo)
  const todasChavesGrupo = useMemo(() => {
    const chaves: string[] = []
    for (const t of planoHierarquico) {
      for (const g of t.grupos) {
        chaves.push(`${t.tipo}::${g.nome}`)
      }
    }
    return chaves
  }, [planoHierarquico])

  const expandirTudo = () => {
    const tipos: Record<string, boolean> = {}
    const grupos: Record<string, boolean> = {}
    for (const t of todasChavesTipo) tipos[t] = true
    for (const g of todasChavesGrupo) grupos[g] = true
    setExpandedTipos(tipos)
    setExpandedGrupos(grupos)
  }

  const recolherTudo = () => {
    setExpandedTipos({})
    setExpandedGrupos({})
  }

  // Contas filtradas (por tipo + busca por nome/código)
  const contasFiltradas = useMemo(() => {
    let base = contas
    if (filtroTipo !== 'todos') {
      base = base.filter((c) => c.tipo === filtroTipo)
    }
    const q = busca.trim().toLowerCase()
    if (q) {
      base = base.filter(
        (c) =>
          c.nome.toLowerCase().includes(q) ||
          (c.codigo || '').toLowerCase().includes(q) ||
          (c.grupo || '').toLowerCase().includes(q),
      )
    }
    return base
  }, [contas, filtroTipo, busca])

  const setField = <K extends keyof ContaFormData>(key: K, value: ContaFormData[K]) => {
    setForm((prev) => {
      // Ao trocar o tipo, limpa o grupo se não pertencer aos sugeridos do novo tipo
      if (key === 'tipo') {
        const novoTipo = value as TipoConta
        const gruposSugeridos = GRUPOS_POR_TIPO[novoTipo] || []
        const grupoAtual = prev.grupo
        const grupoAindaValido = grupoAtual && !gruposSugeridos.includes(grupoAtual)
        // mantém grupo customizado digitado pelo usuário; se for um sugerido de outro tipo, limpa
        return {
          ...prev,
          tipo: novoTipo,
          grupo: grupoAindaValido ? grupoAtual : '',
        }
      }
      return { ...prev, [key]: value }
    })
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  const validate = (f: ContaFormData): boolean => {
    const errs: FormErrors = {}
    if (!f.nome.trim() || f.nome.trim().length < 2) {
      errs.nome = 'Informe um nome com pelo menos 2 caracteres'
    }
    if (!f.tipo) errs.tipo = 'Selecione o tipo'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate(form)) return
    setSaving(true)
    try {
      const novo = await contasService.create({
        nome: form.nome,
        tipo: form.tipo,
        grupo: form.grupo,
        descricao: form.descricao,
      })
      toast({
        title: 'Conta cadastrada',
        description: `"${novo.nome}" foi criada com o código ${novo.codigo}.`,
      })
      setForm(EMPTY_FORM)
    } catch (err: any) {
      console.error(err)
      setErrors((prev) => ({
        ...prev,
        general: err?.message || 'Erro ao salvar a conta.',
      }))
    } finally {
      setSaving(false)
    }
  }

  const openEdit = (c: ContaRecord) => {
    setEditing(c)
    setForm({
      nome: c.nome,
      tipo: c.tipo,
      grupo: c.grupo || '',
      descricao: c.descricao || '',
    })
    setErrors({})
    setEditOpen(true)
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editing || !validate(form)) return
    setSaving(true)
    try {
      await contasService.update(editing.id, {
        nome: form.nome,
        tipo: form.tipo,
        grupo: form.grupo,
        descricao: form.descricao,
      })
      toast({ title: 'Conta atualizada', description: 'As alterações foram salvas.' })
      setEditOpen(false)
      setEditing(null)
    } catch (err: any) {
      console.error(err)
      setErrors((prev) => ({
        ...prev,
        general: err?.message || 'Erro ao atualizar a conta.',
      }))
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = (c: ContaRecord) => {
    setToDelete(c)
    setDeleteOpen(true)
  }

  const handleDelete = async () => {
    if (!toDelete) return
    setDeleting(true)
    try {
      await contasService.delete(toDelete.id)
      toast({
        title: 'Conta removida',
        description: `"${toDelete.nome}" foi excluída.`,
      })
      setDeleteOpen(false)
      setToDelete(null)
    } catch (err: any) {
      console.error(err)
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir',
        description: err?.message || 'Não foi possível excluir a conta.',
      })
    } finally {
      setDeleting(false)
    }
  }

  // Resumo por tipo
  const resumoPorTipo = useMemo(() => {
    const map: Record<string, number> = {}
    for (const c of contas) {
      map[c.tipo] = (map[c.tipo] || 0) + 1
    }
    return map
  }, [contas])

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-xl font-bold text-[#0B1F3A] tracking-tight">Cadastro de Contas</h1>
        <p className="text-xs text-[#5B6B7F]">
          Cadastre o plano de contas para classificar lançamentos contábeis por tipo e grupo.
        </p>
      </div>

      {/* Resumo rápido por tipo */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {TIPOS_CONTA.map((t) => (
          <Card key={t} className="bg-white border-slate-200 shadow-xs">
            <CardContent className="py-3 px-4">
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                {t}
              </p>
              <p className="text-lg font-bold text-[#0B1F3A] mt-0.5">{resumoPorTipo[t] || 0}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs
        value={abaContas}
        onValueChange={(v) => setAbaContas(v as 'lista' | 'plano')}
        className="w-full"
      >
        <TabsList className="bg-slate-200/70 p-1 rounded-xl mb-4">
          <TabsTrigger
            value="lista"
            className="rounded-lg text-xs font-semibold data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm transition-all"
          >
            Lista
          </TabsTrigger>
          <TabsTrigger
            value="plano"
            className="rounded-lg text-xs font-semibold data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm transition-all"
          >
            Plano de Contas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="lista" className="focus-visible:outline-none">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
            {/* ============ COLUNA ESQUERDA: FORMULÁRIO ============ */}
            <Card className="bg-white border-slate-200 shadow-xs">
              <CardHeader className="pb-3 border-b border-slate-100">
                <CardTitle className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-blue-600" />
                  Nova Conta
                </CardTitle>
                <CardDescription className="text-xs">
                  Crie uma conta do plano de contas. O código é gerado automaticamente.
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
                    <Label htmlFor="conta-codigo" className="text-xs font-semibold text-slate-700">
                      Código
                    </Label>
                    <Input
                      id="conta-codigo"
                      readOnly
                      value={proximoCodigo}
                      className="h-9 text-xs font-mono font-semibold text-slate-600 bg-slate-50 border-slate-200 cursor-not-allowed"
                    />
                    <p className="text-[11px] text-slate-400">
                      Gerado automaticamente ao salvar (sequencial por usuário).
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="conta-nome" className="text-xs font-semibold text-slate-700">
                      Nome *
                    </Label>
                    <Input
                      id="conta-nome"
                      placeholder="Ex: Caixa, Bancos, Fornecedores, Capital Social"
                      value={form.nome}
                      onChange={(e) => setField('nome', e.target.value)}
                      className={`h-9 text-xs ${errors.nome ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                    />
                    {errors.nome && (
                      <p className="text-[11px] text-red-600 font-medium">{errors.nome}</p>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="conta-tipo" className="text-xs font-semibold text-slate-700">
                        Tipo *
                      </Label>
                      <Select
                        value={form.tipo}
                        onValueChange={(val) => setField('tipo', val as TipoConta)}
                      >
                        <SelectTrigger id="conta-tipo" className="h-9 text-xs bg-white">
                          <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                        <SelectContent>
                          {TIPOS_CONTA.map((t) => (
                            <SelectItem key={t} value={t} className="text-xs">
                              {t}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors.tipo && (
                        <p className="text-[11px] text-red-600 font-medium">{errors.tipo}</p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="conta-grupo" className="text-xs font-semibold text-slate-700">
                        Grupo
                      </Label>
                      <Select value={form.grupo} onValueChange={(val) => setField('grupo', val)}>
                        <SelectTrigger id="conta-grupo" className="h-9 text-xs bg-white">
                          <SelectValue placeholder="Opcional" />
                        </SelectTrigger>
                        <SelectContent>
                          {(GRUPOS_POR_TIPO[form.tipo] || []).map((g) => (
                            <SelectItem key={g} value={g} className="text-xs">
                              {g}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-[11px] text-slate-400">
                        Sugestões conforme o tipo. Você também pode digitar um grupo personalizado
                        na edição.
                      </p>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="conta-descricao"
                      className="text-xs font-semibold text-slate-700"
                    >
                      Descrição
                    </Label>
                    <Input
                      id="conta-descricao"
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
                      {saving ? 'Salvando...' : 'Salvar Conta'}
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
                    Contas Cadastradas ({contasFiltradas.length}
                    {filtroTipo !== 'todos' || busca.trim() ? ` de ${contas.length}` : ''})
                  </CardTitle>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <div className="flex items-center gap-1.5 w-full sm:w-auto">
                    <div className="relative flex-1 sm:w-56">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <Input
                        placeholder="Buscar por nome, código ou grupo"
                        value={busca}
                        onChange={(e) => setBusca(e.target.value)}
                        className="h-8 text-xs pl-8"
                      />
                    </div>
                  </div>
                  <Select value={filtroTipo} onValueChange={(val) => setFiltroTipo(val)}>
                    <SelectTrigger className="h-8 text-xs bg-white w-full sm:w-48">
                      <SelectValue placeholder="Todos os tipos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos" className="text-xs">
                        Todos os tipos
                      </SelectItem>
                      {TIPOS_CONTA.map((t) => (
                        <SelectItem key={t} value={t} className="text-xs">
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <CardDescription className="text-xs">
                  {contas.length === 0
                    ? 'Nenhuma conta cadastrada ainda.'
                    : `${contas.length} conta(s) no total.`}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {loading ? (
                  <div className="py-12 flex justify-center items-center">
                    <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : contas.length === 0 ? (
                  <div className="py-16 flex flex-col items-center justify-center text-center">
                    <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                      <BookOpen className="w-7 h-7 text-slate-400" />
                    </div>
                    <h3 className="text-sm font-bold text-[#0B1F3A]">Nenhuma conta cadastrada</h3>
                    <p className="text-xs text-slate-500 mt-1 max-w-xs">
                      Use o formulário ao lado para criar a primeira conta do seu plano de contas.
                    </p>
                  </div>
                ) : contasFiltradas.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-500">
                    Nenhuma conta encontrada para os filtros selecionados.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 font-semibold">
                          <th className="py-3 px-4">Código</th>
                          <th className="py-3 px-4">Nome</th>
                          <th className="py-3 px-4">Tipo</th>
                          <th className="py-3 px-4">Grupo</th>
                          <th className="py-3 px-4 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {contasFiltradas.map((c) => (
                          <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-4">
                              <span className="font-mono font-semibold text-blue-700 text-[11px]">
                                {c.codigo || '—'}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-blue-50 text-blue-600">
                                  <BookOpen className="w-4 h-4" />
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
                              <Badge
                                className={`text-[10px] font-semibold px-2 py-0.5 border ${TIPO_BADGE[c.tipo] || ''}`}
                              >
                                {c.tipo}
                              </Badge>
                            </td>
                            <td className="py-3 px-4 text-slate-700">
                              {c.grupo ? c.grupo : <span className="text-slate-400 italic">—</span>}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  onClick={() => openEdit(c)}
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0 text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                                  title="Editar conta"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  onClick={() => confirmDelete(c)}
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0 text-slate-500 hover:text-red-600 hover:bg-red-50"
                                  title="Excluir conta"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ============ ABA: PLANO DE CONTAS (HIERÁRQUICO) ============ */}
        <TabsContent value="plano" className="focus-visible:outline-none">
          <Card className="bg-white border-slate-200 shadow-xs">
            <CardHeader className="pb-3 border-b border-slate-100 space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <CardTitle className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-blue-600" />
                    Plano de Contas Hierárquico
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Contas organizadas por Tipo → Grupo → Conta, com total de lançamentos
                    vinculados.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={expandirTudo}
                    className="h-7 text-[11px] font-semibold border-slate-200 hover:bg-slate-50 text-slate-700"
                  >
                    <ChevronsUpDown className="w-3.5 h-3.5 mr-1.5" />
                    Expandir tudo
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={recolherTudo}
                    className="h-7 text-[11px] font-semibold border-slate-200 hover:bg-slate-50 text-slate-700"
                  >
                    <ChevronsDownUp className="w-3.5 h-3.5 mr-1.5" />
                    Recolher tudo
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="py-12 flex justify-center items-center">
                  <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : contas.length === 0 ? (
                <div className="py-16 flex flex-col items-center justify-center text-center">
                  <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                    <BookOpen className="w-7 h-7 text-slate-400" />
                  </div>
                  <h3 className="text-sm font-bold text-[#0B1F3A]">Nenhuma conta cadastrada</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs">
                    Cadastre contas na aba "Lista" para visualizá-las hierarquicamente aqui.
                  </p>
                </div>
              ) : planoHierarquico.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-500">
                  Nenhuma conta para exibir.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {planoHierarquico.map((noTipo) => {
                    const tipoAberto = !!expandedTipos[noTipo.tipo]
                    const totalContasTipo = noTipo.grupos.reduce(
                      (acc, g) => acc + g.contas.length,
                      0,
                    )
                    return (
                      <div key={noTipo.tipo}>
                        {/* Nível Tipo */}
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedTipos((p) => ({ ...p, [noTipo.tipo]: !tipoAberto }))
                          }
                          className="w-full flex items-center gap-2 px-4 py-3 hover:bg-slate-50/80 transition-colors text-left"
                        >
                          {tipoAberto ? (
                            <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                          )}
                          {tipoAberto ? (
                            <FolderOpen className="w-4 h-4 shrink-0 text-blue-600" />
                          ) : (
                            <Folder className="w-4 h-4 shrink-0 text-blue-600" />
                          )}
                          <span className="text-sm font-bold text-[#0B1F3A]">{noTipo.tipo}</span>
                          <Badge
                            className={`text-[10px] font-semibold px-2 py-0.5 border ${TIPO_BADGE[noTipo.tipo] || ''}`}
                          >
                            {totalContasTipo} conta(s)
                          </Badge>
                        </button>

                        {/* Nível Grupo + Contas */}
                        {tipoAberto && (
                          <div className="bg-slate-50/40">
                            {noTipo.grupos.map((noGrupo) => {
                              const chaveGrupo = `${noTipo.tipo}::${noGrupo.nome}`
                              const grupoAberto = !!expandedGrupos[chaveGrupo]
                              const totalLancGrupo = noGrupo.contas.reduce((acc, c) => {
                                const st = totaisPorConta.get(c.id)
                                return acc + (st?.count || 0)
                              }, 0)
                              return (
                                <div key={chaveGrupo}>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setExpandedGrupos((p) => ({
                                        ...p,
                                        [chaveGrupo]: !grupoAberto,
                                      }))
                                    }
                                    className="w-full flex items-center gap-2 pl-10 pr-4 py-2 hover:bg-slate-100/60 transition-colors text-left"
                                  >
                                    {grupoAberto ? (
                                      <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                    ) : (
                                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                    )}
                                    {grupoAberto ? (
                                      <FolderOpen className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                                    ) : (
                                      <Folder className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                                    )}
                                    <span className="text-xs font-semibold text-slate-700">
                                      {noGrupo.nome}
                                    </span>
                                    <span className="text-[11px] text-slate-400">
                                      {noGrupo.contas.length} conta(s)
                                      {totalLancGrupo > 0
                                        ? ` · ${totalLancGrupo} lançamento(s)`
                                        : ''}
                                    </span>
                                  </button>

                                  {grupoAberto && (
                                    <div>
                                      {noGrupo.contas.map((c) => {
                                        const st = totaisPorConta.get(c.id)
                                        return (
                                          <div
                                            key={c.id}
                                            className="flex items-center gap-2 pl-16 pr-4 py-2 hover:bg-white transition-colors group"
                                          >
                                            <FileText className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                                            <span className="font-mono font-semibold text-blue-700 text-[11px] w-16 shrink-0">
                                              {c.codigo || '—'}
                                            </span>
                                            <span className="text-xs font-medium text-slate-800 truncate">
                                              {c.nome}
                                            </span>
                                            {c.descricao ? (
                                              <span className="text-[11px] text-slate-400 truncate hidden sm:inline">
                                                · {c.descricao}
                                              </span>
                                            ) : null}
                                            <span className="ml-auto text-[11px] text-slate-500 whitespace-nowrap">
                                              {st
                                                ? `${st.count} lanç. · ${st.total.toLocaleString(
                                                    'pt-BR',
                                                    {
                                                      style: 'currency',
                                                      currency: 'BRL',
                                                    },
                                                  )}`
                                                : '0 lanç.'}
                                            </span>
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                              <Button
                                                onClick={() => openEdit(c)}
                                                size="sm"
                                                variant="ghost"
                                                className="h-6 w-6 p-0 text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                                                title="Editar conta"
                                              >
                                                <Pencil className="w-3 h-3" />
                                              </Button>
                                              <Button
                                                onClick={() => confirmDelete(c)}
                                                size="sm"
                                                variant="ghost"
                                                className="h-6 w-6 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50"
                                                title="Excluir conta"
                                              >
                                                <Trash2 className="w-3 h-3" />
                                              </Button>
                                            </div>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ============ MODAL EDIÇÃO ============ */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[480px] bg-white">
          <form onSubmit={handleUpdate}>
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-[#0B1F3A] flex items-center gap-2">
                <Pencil className="w-4 h-4 text-blue-600" />
                Editar Conta
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Atualize as informações da conta. O código não pode ser alterado. Campos com * são
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
                <Label htmlFor="edit-conta-codigo" className="text-xs font-semibold text-slate-700">
                  Código
                </Label>
                <Input
                  id="edit-conta-codigo"
                  readOnly
                  value={editing?.codigo || ''}
                  className="h-9 text-xs font-mono font-semibold text-slate-600 bg-slate-50 border-slate-200 cursor-not-allowed"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-conta-nome" className="text-xs font-semibold text-slate-700">
                  Nome *
                </Label>
                <Input
                  id="edit-conta-nome"
                  value={form.nome}
                  onChange={(e) => setField('nome', e.target.value)}
                  className={`h-9 text-xs ${errors.nome ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                />
                {errors.nome && (
                  <p className="text-[11px] text-red-600 font-medium">{errors.nome}</p>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-conta-tipo" className="text-xs font-semibold text-slate-700">
                    Tipo *
                  </Label>
                  <Select
                    value={form.tipo}
                    onValueChange={(val) => setField('tipo', val as TipoConta)}
                  >
                    <SelectTrigger id="edit-conta-tipo" className="h-9 text-xs bg-white">
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {TIPOS_CONTA.map((t) => (
                        <SelectItem key={t} value={t} className="text-xs">
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label
                    htmlFor="edit-conta-grupo"
                    className="text-xs font-semibold text-slate-700"
                  >
                    Grupo
                  </Label>
                  <Select value={form.grupo} onValueChange={(val) => setField('grupo', val)}>
                    <SelectTrigger id="edit-conta-grupo" className="h-9 text-xs bg-white">
                      <SelectValue placeholder="Opcional" />
                    </SelectTrigger>
                    <SelectContent>
                      {(GRUPOS_POR_TIPO[form.tipo] || []).map((g) => (
                        <SelectItem key={g} value={g} className="text-xs">
                          {g}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label
                  htmlFor="edit-conta-descricao"
                  className="text-xs font-semibold text-slate-700"
                >
                  Descrição
                </Label>
                <Input
                  id="edit-conta-descricao"
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
              <AlertCircle className="w-5 h-5" /> Excluir Conta?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-600">
              Tem certeza que deseja excluir a conta{' '}
              <strong className="text-slate-900 font-semibold">{toDelete?.nome}</strong> (
              {toDelete?.codigo})? Esta ação não pode ser desfeita e o código não será reutilizado.
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
