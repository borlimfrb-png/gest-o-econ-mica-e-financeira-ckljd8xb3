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
import { useFilter } from '@/contexts/FilterContext'
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
import {
  FolderTree,
  Plus,
  Pencil,
  Trash2,
  AlertCircle,
  Search,
  Download,
  Filter,
  Building2,
  Sparkles,
  UploadCloud,
} from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ModalCopiarModeloPadrao } from '@/components/ModalCopiarModeloPadrao'
import { ModalImportarPlanoContas } from '@/components/ModalImportarPlanoContas'
import { ModalCompararPlanos } from '@/components/ModalCompararPlanos'
import { ModalAssistenteSegmento } from '@/components/ModalAssistenteSegmento'
import { exportarPlanoContasExcel, exportarPlanoContasCsv } from '@/lib/exportacaoPlanoContas'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { FileSpreadsheet, GitCompare, Wand2, ChevronDown } from 'lucide-react'

const TIPOS_CONTA: TipoConta[] = ['Ativo', 'Passivo', 'Patrimônio Líquido', 'Receita', 'Despesa']
const TIPOS_CENTRO: TipoCentro[] = ['Receita', 'Despesa']

interface PlanoFormData {
  empresa: string
  conta: string
  centro: string
  tipo_despesa: string
  descricao: string
}

const EMPTY_FORM: PlanoFormData = {
  empresa: '',
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
  const { selectedEmpresaId, setSelectedEmpresaId, selectedEmpresa, empresas } = useFilter()

  const [itens, setItens] = useState<PlanoContaRecord[]>([])
  const [contas, setContas] = useState<ContaRecord[]>([])
  const [centros, setCentros] = useState<CentroRecord[]>([])
  const [tipos, setTipos] = useState<TipoDespesaRecord[]>([])
  const [loading, setLoading] = useState(true)

  // Próximo código (preview no formulário de criação)
  const [proximoCodigo, setProximoCodigo] = useState<string>('PC-001')

  // Form criação
  const [form, setForm] = useState<PlanoFormData>(() => ({
    ...EMPTY_FORM,
    empresa: selectedEmpresaId || '',
  }))
  const [errors, setErrors] = useState<FormErrors>({})
  const [saving, setSaving] = useState(false)

  // Modal edição
  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState<PlanoContaRecord | null>(null)

  // Modal exclusão
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [toDelete, setToDelete] = useState<PlanoContaRecord | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Modais de ações adicionais
  const [copiarModeloOpen, setCopiarModeloOpen] = useState(false)
  const [importarPlanilhaOpen, setImportarPlanilhaOpen] = useState(false)
  const [compararPlanosOpen, setCompararPlanosOpen] = useState(false)
  const [assistenteSegmentoOpen, setAssistenteSegmentoOpen] = useState(false)

  // Filtros
  const [busca, setBusca] = useState('')
  const [filtroConta, setFiltroConta] = useState<string>('todos')
  const [filtroCentro, setFiltroCentro] = useState<string>('todos')

  const loadData = async () => {
    try {
      setLoading(true)
      const [list, contasList, centrosList, tiposList] = await Promise.all([
        planoContasService.getAll(selectedEmpresaId ? { empresaId: selectedEmpresaId } : undefined),
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
    setForm((prev) => ({
      ...prev,
      empresa: selectedEmpresaId || prev.empresa || (empresas.length > 0 ? empresas[0].id : ''),
    }))
  }, [selectedEmpresaId, empresas])

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

  // Itens filtrados por busca (código, nome da conta, nome do centro) e dropdowns
  const itensFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return itens.filter((i) => {
      // Filtro por Conta
      if (filtroConta !== 'todos' && i.conta !== filtroConta) {
        return false
      }
      // Filtro por Centro
      if (filtroCentro !== 'todos' && i.centro !== filtroCentro) {
        return false
      }
      // Filtro por Busca de Texto
      if (!q) return true

      const codigo = (i.codigo || '').toLowerCase()
      const conta = contaMap.get(i.conta)
      const centro = centroMap.get(i.centro)
      const tipo = i.tipo_despesa ? tipoMap.get(i.tipo_despesa) : undefined
      const nomeConta = (conta?.nome || '').toLowerCase()
      const codConta = (conta?.codigo || '').toLowerCase()
      const nomeCentro = (centro?.nome || '').toLowerCase()
      const codCentro = (centro?.codigo || '').toLowerCase()
      const nomeTipo = (tipo?.nome || '').toLowerCase()
      const codTipo = (tipo?.codigo || '').toLowerCase()
      const desc = (i.descricao || '').toLowerCase()

      return (
        codigo.includes(q) ||
        nomeConta.includes(q) ||
        codConta.includes(q) ||
        nomeCentro.includes(q) ||
        codCentro.includes(q) ||
        nomeTipo.includes(q) ||
        codTipo.includes(q) ||
        desc.includes(q)
      )
    })
  }, [itens, busca, filtroConta, filtroCentro, contaMap, centroMap, tipoMap])

  // Exportação Excel (.xlsx) do Plano de Contas da empresa selecionada
  const handleExportExcelEmpresa = () => {
    if (itens.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Nenhum dado para exportar',
        description: 'A empresa selecionada não possui itens cadastrados no plano de contas.',
      })
      return
    }

    try {
      exportarPlanoContasExcel(selectedEmpresa, itens, contaMap, centroMap, tipoMap)
      toast({
        title: 'Excel exportado com sucesso!',
        description: `Arquivo .xlsx com ${itens.length} conta(s) da empresa ${selectedEmpresa?.nome || ''} baixado.`,
      })
    } catch (err: any) {
      console.error('Erro ao exportar Excel:', err)
      toast({
        variant: 'destructive',
        title: 'Erro na exportação Excel',
        description: err?.message || 'Não foi possível gerar a planilha Excel.',
      })
    }
  }

  // Exportação CSV do Plano de Contas da empresa selecionada
  const handleExportCsvEmpresa = () => {
    if (itens.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Nenhum dado para exportar',
        description: 'A empresa selecionada não possui itens cadastrados no plano de contas.',
      })
      return
    }

    try {
      exportarPlanoContasCsv(selectedEmpresa, itens, contaMap, centroMap, tipoMap)
      toast({
        title: 'CSV exportado com sucesso!',
        description: `Arquivo .csv com ${itens.length} conta(s) da empresa ${selectedEmpresa?.nome || ''} baixado.`,
      })
    } catch (err: any) {
      console.error('Erro ao exportar CSV:', err)
      toast({
        variant: 'destructive',
        title: 'Erro na exportação CSV',
        description: err?.message || 'Não foi possível gerar o arquivo CSV.',
      })
    }
  }

  // Exportação rápida dos registros filtrados da tabela
  const handleExportCsvFiltrados = () => {
    if (itensFiltrados.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Nenhum dado para exportar',
        description: 'Não há itens no plano de contas correspondentes aos filtros selecionados.',
      })
      return
    }

    exportarPlanoContasCsv(selectedEmpresa, itensFiltrados, contaMap, centroMap, tipoMap)
    toast({
      title: 'Itens filtrados exportados',
      description: `Arquivo CSV com ${itensFiltrados.length} item(ns) baixado.`,
    })
  }

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
    if (!f.empresa) errs.empresa = 'Selecione a empresa'
    if (!f.conta) errs.conta = 'Selecione a conta'
    if (!f.centro) errs.centro = 'Selecione o centro de custo'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    const targetEmpresa =
      form.empresa || selectedEmpresaId || (empresas.length > 0 ? empresas[0].id : '')
    const formToValidate = { ...form, empresa: targetEmpresa }
    if (!validate(formToValidate)) return
    setSaving(true)
    try {
      const novo = await planoContasService.create({
        empresa: targetEmpresa,
        conta: form.conta,
        centro: form.centro,
        tipo_despesa: form.tipo_despesa || undefined,
        descricao: form.descricao,
      })
      toast({
        title: 'Item do plano criado',
        description: `Vínculo cadastrado com o código ${novo.codigo}.`,
      })
      setForm({
        ...EMPTY_FORM,
        empresa: targetEmpresa,
      })
      loadData()
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
      empresa: i.empresa || selectedEmpresaId || (empresas.length > 0 ? empresas[0].id : ''),
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
        empresa: form.empresa,
        conta: form.conta,
        centro: form.centro,
        tipo_despesa: form.tipo_despesa,
        descricao: form.descricao,
      })
      toast({ title: 'Item atualizado', description: 'As alterações foram salvas.' })
      setEditOpen(false)
      setEditing(null)
      loadData()
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
      {/* Banner / Seletor de Empresa */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Empresa Selecionada:
              </span>
              <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                {selectedEmpresa?.nome || 'Nenhuma selecionada'}
              </span>
              <Badge
                variant="outline"
                className="text-xs font-semibold bg-emerald-50 text-emerald-800 border-emerald-200"
              >
                {totalItens} {totalItens === 1 ? 'conta' : 'contas'} ·{' '}
                {selectedEmpresa?.nome || 'Geral'}
              </Badge>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              O plano de contas e os lançamentos abaixo pertencem exclusivamente a esta empresa.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto">
          {empresas.length > 1 && (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <label
                htmlFor="empresa-filtro-plano"
                className="text-xs font-medium text-slate-600 shrink-0"
              >
                Trocar Empresa:
              </label>
              <select
                id="empresa-filtro-plano"
                value={selectedEmpresaId}
                onChange={(e) => setSelectedEmpresaId(e.target.value)}
                className="h-9 text-xs bg-white border border-slate-300 rounded-lg px-3 py-1 text-slate-800 font-medium focus:ring-2 focus:ring-blue-600 focus:outline-none w-full sm:w-60"
              >
                {empresas.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.nome} ({emp.segmento || 'Empresa'})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Cabeçalho com Ações Rápidas */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#0B1F3A] tracking-tight">
            Plano de Contas por Empresa
          </h1>
          <p className="text-xs text-[#5B6B7F]">
            Vincule contas a centros de custo (e tipos de despesa) para estruturar o plano
            operacional isolado de cada empresa.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* 1) Exportar Plano (Excel/CSV) da empresa ativa */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!selectedEmpresaId || itens.length === 0}
                className="h-9 text-xs font-semibold border-slate-300 text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-2xs gap-1.5"
                title="Exportar plano de contas da empresa ativa em Excel ou CSV"
              >
                <Download className="w-4 h-4 text-blue-600" />
                Exportar Plano (Excel/CSV)
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-white">
              <DropdownMenuItem
                onClick={handleExportExcelEmpresa}
                className="text-xs cursor-pointer gap-2 py-2"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <div className="flex flex-col">
                  <span className="font-semibold text-slate-800">Planilha Excel (.xlsx)</span>
                  <span className="text-[10px] text-slate-500">Formato formatado para backup</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleExportCsvEmpresa}
                className="text-xs cursor-pointer gap-2 py-2"
              >
                <Download className="w-4 h-4 text-blue-600" />
                <div className="flex flex-col">
                  <span className="font-semibold text-slate-800">Arquivo CSV (.csv)</span>
                  <span className="text-[10px] text-slate-500">Padrão UTF-8 brasileiro (;)</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  handleExportExcelEmpresa()
                  setTimeout(handleExportCsvEmpresa, 400)
                }}
                className="text-xs cursor-pointer gap-2 py-1.5 text-slate-600"
              >
                <span className="text-[11px] font-medium">Baixar ambos (.xlsx e .csv)</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* 2) Comparar Planos (Empresas) */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setCompararPlanosOpen(true)}
            disabled={empresas.length < 2}
            className={`h-9 text-xs font-semibold shadow-2xs gap-1.5 ${
              empresas.length < 2
                ? 'border-slate-200 text-slate-400 cursor-not-allowed'
                : 'border-indigo-300 text-indigo-700 hover:bg-indigo-50 hover:text-indigo-800'
            }`}
            title={
              empresas.length < 2
                ? 'Necessário ter ao menos 2 empresas cadastradas para comparar planos'
                : 'Comparar contas presentes, ausentes e divergências entre duas empresas'
            }
          >
            <GitCompare className="w-4 h-4 text-indigo-600" />
            Comparar Planos (Empresas)
          </Button>

          {/* 3) Assistente de Plano de Contas por Segmento */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setAssistenteSegmentoOpen(true)}
            disabled={!selectedEmpresaId}
            className="h-9 text-xs font-semibold border-violet-300 text-violet-700 hover:bg-violet-50 hover:text-violet-800 shadow-2xs gap-1.5"
            title="Sugerir contas contábeis faltantes com base no segmento/setor da empresa"
          >
            <Wand2 className="w-4 h-4 text-violet-600" />
            Assistente de Contas
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setCopiarModeloOpen(true)}
            disabled={!selectedEmpresaId}
            className="h-9 text-xs font-semibold border-blue-200 text-blue-700 hover:bg-blue-50 hover:text-blue-800 shadow-2xs gap-1.5"
            title="Copiar estrutura contábil completa para a empresa selecionada"
          >
            <Sparkles className="w-4 h-4 text-blue-600" />
            Copiar Modelo Padrão
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setImportarPlanilhaOpen(true)}
            disabled={!selectedEmpresaId}
            className="h-9 text-xs font-semibold border-emerald-300 text-emerald-800 hover:bg-emerald-50 hover:text-emerald-900 shadow-2xs gap-1.5"
            title="Importar contas de arquivo Excel ou CSV"
          >
            <UploadCloud className="w-4 h-4 text-emerald-600" />
            Importar Plano (Excel/CSV)
          </Button>
        </div>
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
                <Label htmlFor="pc-empresa" className="text-xs font-semibold text-slate-700">
                  Empresa *
                </Label>
                <Select
                  value={form.empresa || selectedEmpresaId}
                  onValueChange={(val) => setField('empresa', val)}
                >
                  <SelectTrigger id="pc-empresa" className="h-9 text-xs bg-white">
                    <SelectValue placeholder="Selecione a empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    {empresas.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id} className="text-xs">
                        {emp.nome} ({emp.segmento || 'Empresa'})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.empresa && (
                  <p className="text-[11px] text-red-600 font-medium">{errors.empresa}</p>
                )}
              </div>

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
                  Gerado automaticamente ao salvar (sequencial por empresa).
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <CardTitle className="text-sm font-bold text-[#0B1F3A]">
                  Itens do Plano ({itensFiltrados.length}
                  {busca.trim() || filtroConta !== 'todos' || filtroCentro !== 'todos'
                    ? ` de ${itens.length}`
                    : ''}
                  )
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  {itens.length === 0
                    ? 'Nenhum vínculo cadastrado ainda.'
                    : `${itens.length} item(ns) no total.`}
                </CardDescription>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleExportCsvFiltrados}
                disabled={itensFiltrados.length === 0}
                className="h-8 text-xs border-slate-200 hover:border-blue-300 hover:text-blue-700 font-medium self-start sm:self-auto shrink-0 gap-1.5"
                title="Exportar registros filtrados da tabela para arquivo CSV"
              >
                <Download className="w-3.5 h-3.5 text-blue-600" />
                Exportar CSV
              </Button>
            </div>

            {/* Linha de filtros: Busca + Filtro por Conta + Filtro por Centro */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <Input
                  placeholder="Buscar por código, conta, centro..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="h-8 text-xs pl-8"
                />
              </div>

              {/* Filtro por Conta */}
              <div className="relative">
                <Select value={filtroConta} onValueChange={setFiltroConta}>
                  <SelectTrigger className="h-8 text-xs bg-white">
                    <SelectValue placeholder="Todas as contas" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    <SelectItem value="todos" className="text-xs font-medium">
                      Todas as contas
                    </SelectItem>
                    {TIPOS_CONTA.map((tipo) => {
                      const lista = contasPorTipo.get(tipo) || []
                      if (lista.length === 0) return null
                      return (
                        <SelectGroup key={tipo}>
                          <SelectLabel className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                            {tipo}
                          </SelectLabel>
                          {lista.map((c) => (
                            <SelectItem key={c.id} value={c.id} className="text-xs">
                              {c.codigo || '—'} - {c.nome}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* Filtro por Centro */}
              <div className="relative">
                <Select value={filtroCentro} onValueChange={setFiltroCentro}>
                  <SelectTrigger className="h-8 text-xs bg-white">
                    <SelectValue placeholder="Todos os centros" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    <SelectItem value="todos" className="text-xs font-medium">
                      Todos os centros
                    </SelectItem>
                    {TIPOS_CENTRO.map((tipo) => {
                      const lista = centrosPorTipo.get(tipo) || []
                      if (lista.length === 0) return null
                      return (
                        <SelectGroup key={tipo}>
                          <SelectLabel className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                            {tipo}
                          </SelectLabel>
                          {lista.map((c) => (
                            <SelectItem key={c.id} value={c.id} className="text-xs">
                              {c.codigo || '—'} - {c.nome}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {(busca.trim() || filtroConta !== 'todos' || filtroCentro !== 'todos') && (
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-slate-500 flex items-center gap-1">
                  <Filter className="w-3 h-3 text-blue-600" />
                  Filtros ativos: exibindo {itensFiltrados.length} de {itens.length}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setBusca('')
                    setFiltroConta('todos')
                    setFiltroCentro('todos')
                  }}
                  className="text-[11px] font-medium text-blue-600 hover:text-blue-800 underline underline-offset-2"
                >
                  Limpar filtros
                </button>
              </div>
            )}
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
                <Label htmlFor="edit-pc-empresa" className="text-xs font-semibold text-slate-700">
                  Empresa *
                </Label>
                <Select value={form.empresa} onValueChange={(val) => setField('empresa', val)}>
                  <SelectTrigger id="edit-pc-empresa" className="h-9 text-xs bg-white">
                    <SelectValue placeholder="Selecione a empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    {empresas.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id} className="text-xs">
                        {emp.nome} ({emp.segmento || 'Empresa'})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.empresa && (
                  <p className="text-[11px] text-red-600 font-medium">{errors.empresa}</p>
                )}
              </div>

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

      {/* ============ MODAIS DAS 3 MELHORIAS ============ */}
      <ModalCopiarModeloPadrao
        open={copiarModeloOpen}
        onOpenChange={setCopiarModeloOpen}
        selectedEmpresa={selectedEmpresa}
        totalContasEmpresaAtual={totalItens}
        onSuccess={loadData}
      />

      <ModalImportarPlanoContas
        open={importarPlanilhaOpen}
        onOpenChange={setImportarPlanilhaOpen}
        selectedEmpresa={selectedEmpresa}
        totalContasEmpresaAtual={totalItens}
        onSuccess={loadData}
      />

      <ModalCompararPlanos
        open={compararPlanosOpen}
        onOpenChange={setCompararPlanosOpen}
        empresas={empresas}
        empresaInicialId={selectedEmpresaId}
      />

      <ModalAssistenteSegmento
        open={assistenteSegmentoOpen}
        onOpenChange={setAssistenteSegmentoOpen}
        selectedEmpresa={selectedEmpresa}
        planoAtualEmpresa={itens}
        catalogoContas={contas}
        onSuccess={loadData}
      />
    </div>
  )
}
