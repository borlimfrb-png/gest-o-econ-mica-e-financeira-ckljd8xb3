import React, { useState, useEffect, useMemo, useRef } from 'react'
import {
  lancamentosService,
  lancamentosRecorrentesService,
  empresasService,
  planoContasService,
} from '@/services/financeService'
import type {
  LancamentoRecord,
  LancamentoRecorrenteRecord,
  EmpresaRecord,
  PlanoContaRecord,
} from '@/types/finance'
import { useRealtime } from '@/hooks/use-realtime'
import { useToast } from '@/hooks/use-toast'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
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
  FileText,
  Plus,
  Pencil,
  Trash2,
  AlertCircle,
  Calendar,
  Building,
  Unlock,
  Lock,
  DollarSign,
  Receipt,
  TrendingUp,
  Download,
  History,
  Repeat,
  Search,
  CheckCircle2,
  Clock,
  Filter,
} from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

// Formata data ISO ou YYYY-MM-DD para dd/mm/aaaa
function formatarDataBr(dataStr?: string): string {
  if (!dataStr) return '—'
  const partes = dataStr.slice(0, 10).split('-')
  if (partes.length === 3) {
    const [ano, mes, dia] = partes
    return `${dia}/${mes}/${ano}`
  }
  return dataStr
}

// Formata número para moeda brasileira R$ 1.234,56
function formatarMoeda(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return 'R$ 0,00'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(val)
}

// Formata input monetário a partir de string com máscara R$
function parseValorMonetario(input: string): number {
  const limpo = input.replace(/[^\d]/g, '')
  if (!limpo) return 0
  return Number(limpo) / 100
}

function formatarInputMoeda(val: number): string {
  if (val === 0) return ''
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(val)
}

function dataHojeIso(): string {
  return new Date().toISOString().slice(0, 10)
}

// Retorna primeiro e último dia do mês corrente (YYYY-MM-DD)
function periodoMesCorrenteIso(): { inicio: string; fim: string } {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  const primeiroDia = new Date(y, m, 1)
  const ultimoDia = new Date(y, m + 1, 0)
  return {
    inicio: primeiroDia.toISOString().slice(0, 10),
    fim: ultimoDia.toISOString().slice(0, 10),
  }
}

// Calcula a próxima data prevista para uma recorrência dado o dia_mes (1 a 28)
function calcularProximoLancamento(diaMes: number): { dataIso: string; dataFormatada: string } {
  const now = new Date()
  const ano = now.getFullYear()
  const mes = now.getMonth() // 0-11
  const diaHoje = now.getDate()
  const diaClamped = Math.min(Math.max(diaMes, 1), 28)

  let dataAlvo: Date
  if (diaHoje <= diaClamped) {
    // Ainda no mês atual
    dataAlvo = new Date(ano, mes, diaClamped)
  } else {
    // Próximo mês
    dataAlvo = new Date(ano, mes + 1, diaClamped)
  }

  const yyyy = dataAlvo.getFullYear()
  const mm = String(dataAlvo.getMonth() + 1).padStart(2, '0')
  const dd = String(dataAlvo.getDate()).padStart(2, '0')
  const dataIso = `${yyyy}-${mm}-${dd}`
  return {
    dataIso,
    dataFormatada: `${dd}/${mm}/${yyyy}`,
  }
}

export default function Lancamentos() {
  const { toast } = useToast()

  // Aba ativa: 'lancamento' | 'historico' | 'recorrentes'
  const [activeTab, setActiveTab] = useState<string>('lancamento')

  // Dados carregados do backend
  const [empresas, setEmpresas] = useState<EmpresaRecord[]>([])
  const [planoContas, setPlanoContas] = useState<PlanoContaRecord[]>([])
  const [todosLancamentos, setTodosLancamentos] = useState<LancamentoRecord[]>([])
  const [recorrentes, setRecorrentes] = useState<LancamentoRecorrenteRecord[]>([])
  const [loading, setLoading] = useState(true)

  // Estado fixo (travado) de Empresa e Data na aba Lançamentos Rápidos
  const [empresaFixaId, setEmpresaFixaId] = useState<string>('')
  const [dataFixa, setDataFixa] = useState<string>(dataHojeIso())
  const [isTravado, setIsTravado] = useState(false)

  // Campos do formulário de novo lançamento rápido
  const [selectedPlanoConta, setSelectedPlanoConta] = useState<string>('')
  const [valorInput, setValorInput] = useState<string>('')
  const [historicoInput, setHistoricoInput] = useState<string>('')
  const [isRecorrente, setIsRecorrente] = useState<boolean>(false)
  const [diaMesRecorrente, setDiaMesRecorrente] = useState<number>(5)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  // Referência para focar no select de Plano de Contas após salvar
  const planoContaTriggerRef = useRef<HTMLButtonElement>(null)

  // Modal de edição de lançamento regular
  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState<LancamentoRecord | null>(null)
  const [editEmpresa, setEditEmpresa] = useState<string>('')
  const [editData, setEditData] = useState<string>('')
  const [editPlanoConta, setEditPlanoConta] = useState<string>('')
  const [editValorInput, setEditValorInput] = useState<string>('')
  const [editHistorico, setEditHistorico] = useState<string>('')
  const [editErrors, setEditErrors] = useState<Record<string, string>>({})
  const [savingEdit, setSavingEdit] = useState(false)

  // Modal de confirmação de exclusão de lançamento regular
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [toDelete, setToDelete] = useState<LancamentoRecord | null>(null)
  const [deleting, setDeleting] = useState(false)

  // ================== ESTADOS DA ABA HISTÓRICO ==================
  const initialPeriodo = useMemo(() => periodoMesCorrenteIso(), [])
  const [histEmpresaId, setHistEmpresaId] = useState<string>('todas')
  const [histDataInicio, setHistDataInicio] = useState<string>(initialPeriodo.inicio)
  const [histDataFim, setHistDataFim] = useState<string>(initialPeriodo.fim)
  const [histPlanoContaFiltro, setHistPlanoContaFiltro] = useState<string>('todos')
  const [histSearchTerm, setHistSearchTerm] = useState<string>('')

  // ================== ESTADOS DA ABA RECORRENTES ==================
  const [recEmpresaFiltro, setRecEmpresaFiltro] = useState<string>('todas')
  const [deleteRecOpen, setDeleteRecOpen] = useState(false)
  const [toDeleteRec, setToDeleteRec] = useState<LancamentoRecorrenteRecord | null>(null)
  const [deletingRec, setDeletingRec] = useState(false)

  // Modal de criação/edição direta de recorrência
  const [recModalOpen, setRecModalOpen] = useState(false)
  const [recEditing, setRecEditing] = useState<LancamentoRecorrenteRecord | null>(null)
  const [recEmpresa, setRecEmpresa] = useState<string>('')
  const [recPlanoConta, setRecPlanoConta] = useState<string>('')
  const [recDiaMes, setRecDiaMes] = useState<number>(5)
  const [recValorInput, setRecValorInput] = useState<string>('')
  const [recHistorico, setRecHistorico] = useState<string>('')
  const [recAtivo, setRecAtivo] = useState<boolean>(true)
  const [recErrors, setRecErrors] = useState<Record<string, string>>({})
  const [savingRec, setSavingRec] = useState(false)

  // Carregar dados principais
  const loadData = async () => {
    try {
      setLoading(true)
      const [empList, planoList, lancList, recList] = await Promise.all([
        empresasService.getAll(),
        planoContasService.getAll(),
        lancamentosService.getAll({ expandRelations: true }),
        lancamentosRecorrentesService.getAll({ expandRelations: true }),
      ])
      setEmpresas(empList)
      setPlanoContas(planoList)
      setTodosLancamentos(lancList)
      setRecorrentes(recList)

      // Se ainda não selecionou empresa e existem empresas cadastradas, define a primeira como default
      if (!empresaFixaId && empList.length > 0) {
        setEmpresaFixaId(empList[0].id)
      }
    } catch (err) {
      console.error('Erro ao carregar dados de lançamentos:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar',
        description: 'Não foi possível carregar os lançamentos e cadastros.',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Atualização em tempo real para sincronizar múltiplos usuários/abas
  useRealtime<LancamentoRecord>('lancamentos', () => {
    lancamentosService.getAll({ expandRelations: true }).then((list) => {
      setTodosLancamentos(list)
    })
  })

  useRealtime<LancamentoRecorrenteRecord>('lancamentos_recorrentes', () => {
    lancamentosRecorrentesService.getAll({ expandRelations: true }).then((list) => {
      setRecorrentes(list)
    })
  })

  // Mapas de lookup para enriquecimento
  const empresaMap = useMemo(() => {
    const m = new Map<string, EmpresaRecord>()
    for (const e of empresas) m.set(e.id, e)
    return m
  }, [empresas])

  const planoContaMap = useMemo(() => {
    const m = new Map<string, PlanoContaRecord>()
    for (const p of planoContas) m.set(p.id, p)
    return m
  }, [planoContas])

  // Empresa ativa na aba lançamento rápido
  const empresaAtiva = empresaMap.get(empresaFixaId)

  // Formata o label de um item do plano de contas para exibição
  // Formato: PC-001 | CO-003 - Caixa → CC-002 - Marketing [→ TD-001 - Fixa]
  const formatPlanoContaLabel = (item: PlanoContaRecord): string => {
    const expandConta = item.expand?.conta
    const expandCentro = item.expand?.centro
    const expandTipo = item.expand?.tipo_despesa

    const codPC = item.codigo || 'PC-???'
    const codConta = expandConta?.codigo || 'CO-???'
    const nomeConta = expandConta?.nome || 'Conta'
    const codCentro = expandCentro?.codigo || 'CC-???'
    const nomeCentro = expandCentro?.nome || 'Centro'

    let label = `${codPC} | ${codConta} - ${nomeConta} → ${codCentro} - ${nomeCentro}`

    if (expandTipo && expandTipo.nome) {
      const codTipo = expandTipo.codigo || 'TD-???'
      const nomeTipo = expandTipo.nome
      label += ` → ${codTipo} - ${nomeTipo}`
    }

    return label
  }

  // Itens do Plano de Contas ordenados e formatados
  const planoContasOptions = useMemo(() => {
    return [...planoContas].sort((a, b) => (a.codigo || '').localeCompare(b.codigo || ''))
  }, [planoContas])

  // Lançamentos da sessão atual (mesma empresa e mesma data selecionadas)
  const lancamentosSessao = useMemo(() => {
    if (!empresaFixaId || !dataFixa) return []
    const dataAlvo = dataFixa.slice(0, 10)
    return todosLancamentos.filter((l) => {
      const lancDate = (l.data || '').slice(0, 10)
      return l.empresa === empresaFixaId && lancDate === dataAlvo
    })
  }, [todosLancamentos, empresaFixaId, dataFixa])

  // Totalizador da sessão
  const totalValorSessao = useMemo(() => {
    return lancamentosSessao.reduce((acc, l) => acc + (Number(l.valor) || 0), 0)
  }, [lancamentosSessao])

  const totalQuantidadeSessao = lancamentosSessao.length

  // Handlers para o formulário de inclusão rápida
  const handleValorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    const parsed = parseValorMonetario(raw)
    setValorInput(parsed > 0 ? formatarInputMoeda(parsed) : '')
    if (formErrors.valor) {
      setFormErrors((prev) => ({ ...prev, valor: '' }))
    }
  }

  const handleEditValorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    const parsed = parseValorMonetario(raw)
    setEditValorInput(parsed > 0 ? formatarInputMoeda(parsed) : '')
    if (editErrors.valor) {
      setEditErrors((prev) => ({ ...prev, valor: '' }))
    }
  }

  const handleRecValorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    const parsed = parseValorMonetario(raw)
    setRecValorInput(parsed > 0 ? formatarInputMoeda(parsed) : '')
    if (recErrors.valor) {
      setRecErrors((prev) => ({ ...prev, valor: '' }))
    }
  }

  const validateForm = (): boolean => {
    const errs: Record<string, string> = {}
    if (!empresaFixaId) {
      errs.empresa = 'Selecione uma empresa'
    }
    if (!dataFixa) {
      errs.data = 'Informe a data do lançamento'
    }
    if (!selectedPlanoConta) {
      errs.plano_conta = 'Selecione o plano de contas'
    }
    const val = parseValorMonetario(valorInput)
    if (!val || val <= 0) {
      errs.valor = 'Informe um valor válido maior que zero'
    }
    if (isRecorrente) {
      if (!diaMesRecorrente || diaMesRecorrente < 1 || diaMesRecorrente > 28) {
        errs.dia_mes = 'O dia do mês deve estar entre 1 e 28'
      }
    }
    setFormErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSalvarLancamento = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return

    const valorNumerico = parseValorMonetario(valorInput)
    setSaving(true)

    try {
      // 1. Se for recorrente, cria o registro em lancamentos_recorrentes
      // O hook do PocketBase onRecordAfterCreateSuccess criará o lançamento do mês corrente automaticamente
      if (isRecorrente) {
        const novaRecorrencia = await lancamentosRecorrentesService.create({
          empresa: empresaFixaId,
          plano_conta: selectedPlanoConta,
          dia_mes: Number(diaMesRecorrente) || 1,
          valor: valorNumerico,
          historico: historicoInput,
          ativo: true,
        })
        setRecorrentes((prev) => [novaRecorrencia, ...prev])

        // Recarrega lançamentos para pegar o lançamento gerado pelo hook
        const lancList = await lancamentosService.getAll({ expandRelations: true })
        setTodosLancamentos(lancList)

        toast({
          title: 'Lançamento recorrente salvo',
          description: `Recorrência mensal (dia ${diaMesRecorrente}) criada e 1º lançamento gerado com sucesso.`,
        })
      } else {
        // Lançamento normal único
        const criado = await lancamentosService.create({
          empresa: empresaFixaId,
          plano_conta: selectedPlanoConta,
          data: dataFixa,
          valor: valorNumerico,
          historico: historicoInput,
        })

        // Adiciona na lista local imediatamente para UI responsiva
        setTodosLancamentos((prev) => [criado, ...prev.filter((item) => item.id !== criado.id)])

        toast({
          title: 'Lançamento registrado',
          description: `Valor de ${formatarMoeda(valorNumerico)} salvo com sucesso.`,
        })
      }

      // Regra de negócio: Travar empresa e data
      setIsTravado(true)

      // Limpar campos de lançamento (Plano de Contas, Valor e Histórico)
      setSelectedPlanoConta('')
      setValorInput('')
      setHistoricoInput('')
      setIsRecorrente(false)
      setFormErrors({})

      // Retornar foco para o select de Plano de Contas para agilidade
      setTimeout(() => {
        planoContaTriggerRef.current?.focus()
      }, 50)
    } catch (err: any) {
      console.error('Erro ao salvar lançamento:', err)
      setFormErrors((prev) => ({
        ...prev,
        general: err?.message || 'Erro ao registrar o lançamento.',
      }))
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar',
        description: err?.message || 'Não foi possível salvar o lançamento.',
      })
    } finally {
      setSaving(false)
    }
  }

  // Destravar empresa e data para seleção de outro lote/dia
  const handleDestravar = () => {
    setIsTravado(false)
    toast({
      title: 'Modo de seleção ativado',
      description: 'Agora você pode escolher outra empresa ou data para novos lançamentos.',
    })
  }

  // Abrir modal de edição de lançamento regular
  const handleOpenEdit = (lanc: LancamentoRecord) => {
    setEditing(lanc)
    setEditEmpresa(lanc.empresa)
    setEditData((lanc.data || '').slice(0, 10))
    setEditPlanoConta(lanc.plano_conta)
    setEditValorInput(formatarInputMoeda(lanc.valor || 0))
    setEditHistorico(lanc.historico || '')
    setEditErrors({})
    setEditOpen(true)
  }

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editing) return

    const errs: Record<string, string> = {}
    if (!editEmpresa) errs.empresa = 'Selecione a empresa'
    if (!editData) errs.data = 'Informe a data'
    if (!editPlanoConta) errs.plano_conta = 'Selecione o plano de contas'
    const val = parseValorMonetario(editValorInput)
    if (!val || val <= 0) errs.valor = 'Informe um valor válido maior que zero'

    if (Object.keys(errs).length > 0) {
      setEditErrors(errs)
      return
    }

    setSavingEdit(true)
    try {
      const atualizado = await lancamentosService.update(editing.id, {
        empresa: editEmpresa,
        plano_conta: editPlanoConta,
        data: editData,
        valor: val,
        historico: editHistorico,
      })

      setTodosLancamentos((prev) =>
        prev.map((item) => (item.id === atualizado.id ? atualizado : item)),
      )

      toast({
        title: 'Lançamento atualizado',
        description: 'As alterações foram salvas com sucesso.',
      })
      setEditOpen(false)
      setEditing(null)
    } catch (err: any) {
      console.error('Erro ao atualizar lançamento:', err)
      setEditErrors({ general: err?.message || 'Erro ao atualizar lançamento.' })
    } finally {
      setSavingEdit(false)
    }
  }

  // Exclusão de lançamento regular
  const handleConfirmDelete = (lanc: LancamentoRecord) => {
    setToDelete(lanc)
    setDeleteOpen(true)
  }

  const handleDelete = async () => {
    if (!toDelete) return
    setDeleting(true)
    try {
      await lancamentosService.delete(toDelete.id)
      setTodosLancamentos((prev) => prev.filter((i) => i.id !== toDelete.id))
      toast({
        title: 'Lançamento excluído',
        description: 'O lançamento foi removido com sucesso.',
      })
      setDeleteOpen(false)
      setToDelete(null)
    } catch (err: any) {
      console.error('Erro ao excluir lançamento:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir',
        description: err?.message || 'Não foi possível excluir o lançamento.',
      })
    } finally {
      setDeleting(false)
    }
  }

  // ================== CONTROLE DA SEÇÃO RECORRENTES ==================
  const handleToggleRecorrenteAtivo = async (rec: LancamentoRecorrenteRecord) => {
    const novoStatus = !rec.ativo
    try {
      await lancamentosRecorrentesService.toggleAtivo(rec.id, novoStatus)
      setRecorrentes((prev) =>
        prev.map((item) => (item.id === rec.id ? { ...item, ativo: novoStatus } : item)),
      )
      toast({
        title: novoStatus ? 'Recorrência ativada' : 'Recorrência pausada',
        description: `A recorrência está agora ${novoStatus ? 'ativa' : 'pausada'}.`,
      })
    } catch (err) {
      console.error('Erro ao alternar status de recorrência:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao alterar status',
        description: 'Não foi possível alterar o status da recorrência.',
      })
    }
  }

  const handleConfirmDeleteRec = (rec: LancamentoRecorrenteRecord) => {
    setToDeleteRec(rec)
    setDeleteRecOpen(true)
  }

  const handleDeleteRec = async () => {
    if (!toDeleteRec) return
    setDeletingRec(true)
    try {
      await lancamentosRecorrentesService.delete(toDeleteRec.id)
      setRecorrentes((prev) => prev.filter((i) => i.id !== toDeleteRec.id))
      toast({
        title: 'Recorrência excluída',
        description: 'A recorrência foi removida. Os lançamentos passados foram mantidos.',
      })
      setDeleteRecOpen(false)
      setToDeleteRec(null)
    } catch (err: any) {
      console.error('Erro ao excluir recorrência:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir',
        description: err?.message || 'Não foi possível excluir a recorrência.',
      })
    } finally {
      setDeletingRec(false)
    }
  }

  // Abrir modal de criação direta de recorrência
  const handleOpenNovaRecorrencia = () => {
    setRecEditing(null)
    setRecEmpresa(empresaFixaId || (empresas[0]?.id ?? ''))
    setRecPlanoConta(planoContas[0]?.id ?? '')
    setRecDiaMes(5)
    setRecValorInput('')
    setRecHistorico('')
    setRecAtivo(true)
    setRecErrors({})
    setRecModalOpen(true)
  }

  const handleOpenEditRecorrencia = (rec: LancamentoRecorrenteRecord) => {
    setRecEditing(rec)
    setRecEmpresa(rec.empresa)
    setRecPlanoConta(rec.plano_conta)
    setRecDiaMes(rec.dia_mes || 5)
    setRecValorInput(formatarInputMoeda(rec.valor || 0))
    setRecHistorico(rec.historico || '')
    setRecAtivo(rec.ativo ?? true)
    setRecErrors({})
    setRecModalOpen(true)
  }

  const handleSaveRecorrenciaModal = async (e: React.FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!recEmpresa) errs.empresa = 'Selecione a empresa'
    if (!recPlanoConta) errs.plano_conta = 'Selecione o plano de contas'
    if (!recDiaMes || recDiaMes < 1 || recDiaMes > 28) errs.dia_mes = 'O dia deve ser entre 1 e 28'
    const val = parseValorMonetario(recValorInput)
    if (!val || val <= 0) errs.valor = 'Informe um valor válido maior que zero'

    if (Object.keys(errs).length > 0) {
      setRecErrors(errs)
      return
    }

    setSavingRec(true)
    try {
      if (recEditing) {
        const atualizado = await lancamentosRecorrentesService.update(recEditing.id, {
          empresa: recEmpresa,
          plano_conta: recPlanoConta,
          dia_mes: recDiaMes,
          valor: val,
          historico: recHistorico,
          ativo: recAtivo,
        })
        setRecorrentes((prev) =>
          prev.map((item) => (item.id === atualizado.id ? atualizado : item)),
        )
        toast({
          title: 'Recorrência atualizada',
          description: 'As alterações foram salvas com sucesso.',
        })
      } else {
        const novo = await lancamentosRecorrentesService.create({
          empresa: recEmpresa,
          plano_conta: recPlanoConta,
          dia_mes: recDiaMes,
          valor: val,
          historico: recHistorico,
          ativo: recAtivo,
        })
        setRecorrentes((prev) => [novo, ...prev])
        // Recarregar lançamentos gerados pelo hook
        const lancList = await lancamentosService.getAll({ expandRelations: true })
        setTodosLancamentos(lancList)
        toast({
          title: 'Recorrência cadastrada',
          description: `Recorrência no dia ${recDiaMes} criada com sucesso.`,
        })
      }
      setRecModalOpen(false)
    } catch (err: any) {
      console.error('Erro ao salvar recorrência:', err)
      setRecErrors({ general: err?.message || 'Erro ao salvar recorrência.' })
    } finally {
      setSavingRec(false)
    }
  }

  // Filtragem da lista de recorrências
  const recorrentesFiltrados = useMemo(() => {
    return recorrentes.filter((r) => {
      if (recEmpresaFiltro !== 'todas' && r.empresa !== recEmpresaFiltro) return false
      return true
    })
  }, [recorrentes, recEmpresaFiltro])

  // Totalizador de recorrências ativas
  const totalRecorrenteMensal = useMemo(() => {
    return recorrentesFiltrados
      .filter((r) => r.ativo)
      .reduce((acc, r) => acc + (Number(r.valor) || 0), 0)
  }, [recorrentesFiltrados])

  // ================== FILTRAGEM E EXPORTAÇÃO DA ABA HISTÓRICO ==================
  const lancamentosHistorico = useMemo(() => {
    return todosLancamentos.filter((l) => {
      // Filtro empresa
      if (histEmpresaId !== 'todas' && l.empresa !== histEmpresaId) return false

      // Filtro de data
      const dataStr = (l.data || '').slice(0, 10)
      if (histDataInicio && dataStr < histDataInicio) return false
      if (histDataFim && dataStr > histDataFim) return false

      // Filtro de plano de contas
      if (histPlanoContaFiltro !== 'todos' && l.plano_conta !== histPlanoContaFiltro) return false

      // Filtro de busca textual (histórico, código PC, nome conta, nome centro)
      if (histSearchTerm.trim()) {
        const termo = histSearchTerm.toLowerCase().trim()
        const pc = l.expand?.plano_conta || planoContaMap.get(l.plano_conta)
        const conta = pc?.expand?.conta
        const centro = pc?.expand?.centro
        const emp = l.expand?.empresa || empresaMap.get(l.empresa)

        const matchHist = (l.historico || '').toLowerCase().includes(termo)
        const matchEmp = (emp?.nome || '').toLowerCase().includes(termo)
        const matchPcCod = (pc?.codigo || '').toLowerCase().includes(termo)
        const matchConta =
          (conta?.nome || '').toLowerCase().includes(termo) ||
          (conta?.codigo || '').toLowerCase().includes(termo)
        const matchCentro =
          (centro?.nome || '').toLowerCase().includes(termo) ||
          (centro?.codigo || '').toLowerCase().includes(termo)

        if (!matchHist && !matchEmp && !matchPcCod && !matchConta && !matchCentro) return false
      }

      return true
    })
  }, [
    todosLancamentos,
    histEmpresaId,
    histDataInicio,
    histDataFim,
    histPlanoContaFiltro,
    histSearchTerm,
    planoContaMap,
    empresaMap,
  ])

  // Totalizadores do Histórico Filtrado
  const totalHistoricoValor = useMemo(() => {
    return lancamentosHistorico.reduce((acc, l) => acc + (Number(l.valor) || 0), 0)
  }, [lancamentosHistorico])

  // Exportar dados da sessão rápida em CSV
  const handleExportCsvSessao = () => {
    exportarParaCsv(
      lancamentosSessao,
      `lancamentos_${(empresaAtiva?.nome || 'empresa').toLowerCase().replace(/\s+/g, '_')}_${dataFixa}.csv`,
    )
  }

  // Exportar histórico filtrado para CSV
  const handleExportCsvHistorico = () => {
    const nomeEmpresa =
      histEmpresaId === 'todas'
        ? 'todas_empresas'
        : (empresaMap.get(histEmpresaId)?.nome || 'empresa').toLowerCase().replace(/\s+/g, '_')
    exportarParaCsv(
      lancamentosHistorico,
      `historico_lancamentos_${nomeEmpresa}_${histDataInicio}_a_${histDataFim}.csv`,
    )
  }

  // Função genérica de exportação CSV
  const exportarParaCsv = (lista: LancamentoRecord[], filename: string) => {
    if (lista.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Nenhum lançamento',
        description: 'Não há lançamentos para exportar no período ou filtro selecionado.',
      })
      return
    }

    const escapeCsv = (val: string | number | undefined | null): string => {
      if (val === null || val === undefined) return ''
      const s = String(val)
      if (/[;"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
      return s
    }

    const colunas = [
      'Data',
      'Empresa',
      'Código PC',
      'Conta',
      'Centro de Custo',
      'Tipo Despesa',
      'Valor (R$)',
      'Histórico',
    ]

    const linhas: string[] = []
    linhas.push(colunas.map(escapeCsv).join(';'))

    for (const l of lista) {
      const pc = l.expand?.plano_conta || planoContaMap.get(l.plano_conta)
      const emp = l.expand?.empresa || empresaMap.get(l.empresa)
      const conta = pc?.expand?.conta
      const centro = pc?.expand?.centro
      const tipo = pc?.expand?.tipo_despesa

      const dt = formatarDataBr(l.data)
      const empNome = emp?.nome || ''
      const pcCod = pc?.codigo || ''
      const contaStr = conta ? `${conta.codigo || ''} - ${conta.nome}` : ''
      const centroStr = centro ? `${centro.codigo || ''} - ${centro.nome}` : ''
      const tipoStr = tipo ? `${tipo.codigo || ''} - ${tipo.nome}` : ''
      const valorStr = (l.valor || 0).toFixed(2).replace('.', ',')
      const histStr = l.historico || ''

      linhas.push(
        [dt, empNome, pcCod, contaStr, centroStr, tipoStr, valorStr, histStr]
          .map(escapeCsv)
          .join(';'),
      )
    }

    const csvContent = '\uFEFF' + linhas.join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.setAttribute('download', filename)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(link.href)

    toast({
      title: 'CSV exportado',
      description: `${lista.length} lançamento(s) exportado(s) com sucesso.`,
    })
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Cabeçalho Principal da Página com Abas */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#0B1F3A] tracking-tight flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            Lançamentos Financeiros
          </h1>
          <p className="text-xs text-[#5B6B7F]">
            Lançamento rápido, histórico consolidado por período e gestão de recorrências.
          </p>
        </div>

        {/* Informações da Sessão Ativa / Botão de Destravar (apenas quando na aba lançamento) */}
        {activeTab === 'lancamento' && isTravado && (
          <div className="flex items-center gap-2 bg-blue-50/80 border border-blue-200/80 rounded-xl px-3 py-1.5 shadow-2xs">
            <div className="flex items-center gap-1.5 text-xs text-blue-950 font-semibold">
              <Lock className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span>Sessão Fixada:</span>
              <Badge className="bg-blue-600 text-white hover:bg-blue-600 text-[11px] font-bold px-2 py-0.5">
                <Building className="w-3 h-3 mr-1 inline" />
                {empresaAtiva?.nome || 'Empresa selecionada'}
              </Badge>
              <Badge
                variant="outline"
                className="bg-white text-blue-900 border-blue-300 text-[11px] font-semibold px-2 py-0.5"
              >
                <Calendar className="w-3 h-3 mr-1 inline text-blue-600" />
                {formatarDataBr(dataFixa)}
              </Badge>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDestravar}
              className="h-7 text-xs bg-white text-blue-700 hover:text-blue-800 hover:bg-blue-100/60 border-blue-200 font-semibold ml-1 shadow-2xs gap-1"
              title="Permite trocar a empresa e a data dos próximos lançamentos"
            >
              <Unlock className="w-3 h-3" />
              Alterar
            </Button>
          </div>
        )}
      </div>

      {/* Navegação por Abas Principais */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full sm:w-auto grid-cols-3 bg-slate-100/80 p-1 border border-slate-200 rounded-xl h-10">
          <TabsTrigger
            value="lancamento"
            className="text-xs font-semibold data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-xs gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Lançamento Rápido
          </TabsTrigger>
          <TabsTrigger
            value="historico"
            className="text-xs font-semibold data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-xs gap-1.5"
          >
            <History className="w-3.5 h-3.5" />
            Histórico por Período
            {lancamentosHistorico.length > 0 && (
              <Badge
                variant="secondary"
                className="ml-1 text-[10px] px-1.5 py-0 bg-slate-200 text-slate-700 font-bold"
              >
                {lancamentosHistorico.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="recorrentes"
            className="text-xs font-semibold data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-xs gap-1.5"
          >
            <Repeat className="w-3.5 h-3.5" />
            Recorrências
            {recorrentes.length > 0 && (
              <Badge
                variant="secondary"
                className="ml-1 text-[10px] px-1.5 py-0 bg-blue-100 text-blue-700 font-bold"
              >
                {recorrentes.filter((r) => r.ativo).length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ========================================================================= */}
        {/* ABA 1: LANÇAMENTO RÁPIDO (Mantém fluxo ágil fixado com toggle recorrente) */}
        {/* ========================================================================= */}
        <TabsContent value="lancamento" className="space-y-6 mt-4">
          {/* Cards de Resumo da Sessão Atual */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Card className="bg-white border-slate-200 shadow-xs">
              <CardContent className="py-3 px-4 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Lançamentos na sessão
                  </p>
                  <p className="text-xl font-bold text-[#0B1F3A] mt-0.5">{totalQuantidadeSessao}</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Receipt className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border-slate-200 shadow-xs">
              <CardContent className="py-3 px-4 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Total da sessão
                  </p>
                  <p className="text-xl font-bold text-emerald-700 mt-0.5">
                    {formatarMoeda(totalValorSessao)}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <DollarSign className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border-slate-200 shadow-xs">
              <CardContent className="py-3 px-4 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Status do formulário
                  </p>
                  <p className="text-xs font-semibold text-slate-700 mt-1 flex items-center gap-1.5">
                    {isTravado ? (
                      <>
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        Modo Rápido Ativo (Fixado)
                      </>
                    ) : (
                      <>
                        <span className="w-2 h-2 rounded-full bg-amber-500" />
                        Seleção de Empresa e Data
                      </>
                    )}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Grid Principal: Formulário de Lançamento e Tabela da Sessão */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            {/* Form Lançamento Rápido (5 cols) */}
            <div className="xl:col-span-5">
              <Card className="bg-white border-slate-200 shadow-xs">
                <CardHeader className="pb-3 border-b border-slate-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
                        <Plus className="w-4 h-4 text-blue-600" />
                        {isTravado ? 'Novo Lançamento Rápido' : 'Configurar Lançamentos'}
                      </CardTitle>
                      <CardDescription className="text-xs mt-0.5">
                        {isTravado
                          ? 'Empresa e data fixadas. Preencha o plano, valor e histórico.'
                          : 'Escolha a empresa e a data para iniciar a sequência de lançamentos.'}
                      </CardDescription>
                    </div>
                    {isTravado && (
                      <Badge
                        variant="outline"
                        className="text-[10px] bg-blue-50 text-blue-700 border-blue-200 font-semibold"
                      >
                        Empresa/Data Fixas
                      </Badge>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="pt-4">
                  <form onSubmit={handleSalvarLancamento} className="space-y-4">
                    {formErrors.general && (
                      <Alert
                        variant="destructive"
                        className="bg-red-50 border-red-200 text-red-800 py-2"
                      >
                        <AlertCircle className="h-4 w-4 text-red-600" />
                        <AlertDescription className="text-xs font-medium">
                          {formErrors.general}
                        </AlertDescription>
                      </Alert>
                    )}

                    {/* Bloco de Empresa e Data quando DESTRAVADO */}
                    {!isTravado ? (
                      <div className="p-3.5 bg-slate-50/90 rounded-xl border border-slate-200 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                            <Building className="w-3.5 h-3.5 text-blue-600" />
                            1. Empresa e Data de Referência
                          </span>
                          <span className="text-[10px] text-slate-500 font-medium">
                            Ficarão fixas após salvar
                          </span>
                        </div>

                        <div className="space-y-1.5">
                          <Label
                            htmlFor="lan-empresa"
                            className="text-xs font-semibold text-slate-700"
                          >
                            Empresa *
                          </Label>
                          <Select
                            value={empresaFixaId}
                            onValueChange={(val) => {
                              setEmpresaFixaId(val)
                              if (formErrors.empresa) {
                                setFormErrors((prev) => ({ ...prev, empresa: '' }))
                              }
                            }}
                          >
                            <SelectTrigger id="lan-empresa" className="h-9 text-xs bg-white">
                              <SelectValue placeholder="Selecione a empresa" />
                            </SelectTrigger>
                            <SelectContent className="max-h-60">
                              {empresas.map((emp) => (
                                <SelectItem key={emp.id} value={emp.id} className="text-xs">
                                  {emp.nome} ({emp.segmento})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {formErrors.empresa && (
                            <p className="text-[11px] text-red-600 font-medium">
                              {formErrors.empresa}
                            </p>
                          )}
                        </div>

                        <div className="space-y-1.5">
                          <Label
                            htmlFor="lan-data"
                            className="text-xs font-semibold text-slate-700"
                          >
                            Data *
                          </Label>
                          <Input
                            id="lan-data"
                            type="date"
                            value={dataFixa}
                            onChange={(e) => {
                              setDataFixa(e.target.value)
                              if (formErrors.data) {
                                setFormErrors((prev) => ({ ...prev, data: '' }))
                              }
                            }}
                            className="h-9 text-xs bg-white"
                          />
                          {formErrors.data && (
                            <p className="text-[11px] text-red-600 font-medium">
                              {formErrors.data}
                            </p>
                          )}
                        </div>
                      </div>
                    ) : (
                      /* Bloco resumido quando TRAVADO */
                      <div className="flex items-center justify-between p-3 bg-blue-50/50 rounded-xl border border-blue-100">
                        <div className="space-y-0.5">
                          <p className="text-[10px] text-blue-900/70 uppercase font-semibold">
                            Lançando para
                          </p>
                          <p className="text-xs font-bold text-[#0B1F3A] truncate">
                            {empresaAtiva?.nome}
                          </p>
                          <p className="text-[11px] text-blue-700 font-medium flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatarDataBr(dataFixa)}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleDestravar}
                          className="h-7 text-xs text-blue-700 hover:text-blue-900 hover:bg-blue-100/70"
                          title="Destravar empresa e data"
                        >
                          <Unlock className="w-3.5 h-3.5 mr-1" />
                          Alterar
                        </Button>
                      </div>
                    )}

                    {/* Select do Plano de Contas */}
                    <div className="space-y-1.5">
                      <Label htmlFor="lan-plano" className="text-xs font-semibold text-slate-700">
                        Plano de Contas (Vínculo Conta → Centro) *
                      </Label>
                      <Select
                        value={selectedPlanoConta}
                        onValueChange={(val) => {
                          setSelectedPlanoConta(val)
                          if (formErrors.plano_conta) {
                            setFormErrors((prev) => ({ ...prev, plano_conta: '' }))
                          }
                        }}
                      >
                        <SelectTrigger
                          id="lan-plano"
                          ref={planoContaTriggerRef}
                          className="h-9 text-xs bg-white text-left truncate"
                        >
                          <SelectValue placeholder="Selecione o plano de contas (PC-xxx | Conta → Centro)" />
                        </SelectTrigger>
                        <SelectContent className="max-h-72">
                          {planoContasOptions.length === 0 ? (
                            <div className="p-3 text-center text-xs text-slate-500">
                              Nenhum plano de contas cadastrado.
                            </div>
                          ) : (
                            planoContasOptions.map((item) => (
                              <SelectItem key={item.id} value={item.id} className="text-xs py-2">
                                <span className="text-slate-800">
                                  {formatPlanoContaLabel(item)}
                                </span>
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      {formErrors.plano_conta && (
                        <p className="text-[11px] text-red-600 font-medium">
                          {formErrors.plano_conta}
                        </p>
                      )}
                    </div>

                    {/* Input Valor (R$) */}
                    <div className="space-y-1.5">
                      <Label htmlFor="lan-valor" className="text-xs font-semibold text-slate-700">
                        Valor (R$) *
                      </Label>
                      <div className="relative">
                        <DollarSign className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <Input
                          id="lan-valor"
                          type="text"
                          placeholder="R$ 0,00"
                          value={valorInput}
                          onChange={handleValorChange}
                          className="h-9 text-xs pl-8 font-semibold text-slate-900"
                        />
                      </div>
                      {formErrors.valor && (
                        <p className="text-[11px] text-red-600 font-medium">{formErrors.valor}</p>
                      )}
                    </div>

                    {/* Textarea Histórico */}
                    <div className="space-y-1.5">
                      <Label
                        htmlFor="lan-historico"
                        className="text-xs font-semibold text-slate-700"
                      >
                        Histórico / Observações
                      </Label>
                      <Textarea
                        id="lan-historico"
                        placeholder="Descrição detalhada do lançamento (opcional)..."
                        value={historicoInput}
                        onChange={(e) => setHistoricoInput(e.target.value)}
                        className="min-h-[64px] text-xs"
                      />
                    </div>

                    {/* ============ SEÇÃO: LANÇAMENTO RECORRENTE ============ */}
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label
                            htmlFor="recorrente-toggle"
                            className="text-xs font-bold text-slate-800 flex items-center gap-1.5 cursor-pointer"
                          >
                            <Repeat className="w-3.5 h-3.5 text-blue-600" />
                            Lançamento recorrente
                          </Label>
                          <p className="text-[11px] text-slate-500">
                            Repetir automaticamente todo mês neste dia.
                          </p>
                        </div>
                        <Switch
                          id="recorrente-toggle"
                          checked={isRecorrente}
                          onCheckedChange={setIsRecorrente}
                        />
                      </div>

                      {isRecorrente && (
                        <div className="pt-2 border-t border-slate-200/80 space-y-2 animate-fadeIn">
                          <div className="flex items-center gap-3">
                            <div className="flex-1 space-y-1">
                              <Label
                                htmlFor="lan-dia-mes"
                                className="text-xs font-semibold text-slate-700"
                              >
                                Dia do mês (1 a 28) *
                              </Label>
                              <Input
                                id="lan-dia-mes"
                                type="number"
                                min={1}
                                max={28}
                                value={diaMesRecorrente}
                                onChange={(e) =>
                                  setDiaMesRecorrente(
                                    Math.min(Math.max(Number(e.target.value) || 1, 1), 28),
                                  )
                                }
                                className="h-9 text-xs bg-white font-mono font-bold"
                              />
                            </div>
                            <div className="flex-1 text-[11px] text-slate-600 bg-blue-50/70 border border-blue-200/60 rounded-lg p-2 mt-4">
                              <p className="font-semibold text-blue-900">Próximo previsto:</p>
                              <p className="text-blue-700 font-mono font-bold">
                                {calcularProximoLancamento(diaMesRecorrente).dataFormatada}
                              </p>
                            </div>
                          </div>
                          {formErrors.dia_mes && (
                            <p className="text-[11px] text-red-600 font-medium">
                              {formErrors.dia_mes}
                            </p>
                          )}
                          <p className="text-[10px] text-slate-500 italic">
                            O 1º lançamento será gerado automaticamente para o mês corrente.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Botão de Gravação */}
                    <div className="pt-1 flex items-center justify-between">
                      <p className="text-[11px] text-slate-400">
                        {isTravado
                          ? 'Ao salvar, o foco volta para o Plano de Contas.'
                          : 'Empresa e data serão travadas após salvar.'}
                      </p>
                      <Button
                        type="submit"
                        disabled={saving || planoContasOptions.length === 0}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-9 shadow-xs"
                      >
                        <Plus className="w-4 h-4 mr-1.5" />
                        {saving
                          ? 'Salvando...'
                          : isRecorrente
                            ? 'Salvar Recorrência'
                            : 'Salvar Lançamento'}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </div>

            {/* Tabela de Lançamentos da Sessão Atual (7 cols) */}
            <div className="xl:col-span-7">
              <Card className="bg-white border-slate-200 shadow-xs">
                <CardHeader className="pb-3 border-b border-slate-100">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <CardTitle className="text-sm font-bold text-[#0B1F3A]">
                        Lançamentos da Sessão ({lancamentosSessao.length})
                      </CardTitle>
                      <CardDescription className="text-xs mt-0.5">
                        {empresaAtiva ? empresaAtiva.nome : 'Empresa'} · {formatarDataBr(dataFixa)}
                      </CardDescription>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleExportCsvSessao}
                        disabled={lancamentosSessao.length === 0}
                        className="h-8 text-xs border-slate-200 hover:border-blue-300 hover:text-blue-700 font-medium gap-1.5"
                        title="Exportar lançamentos desta sessão para CSV"
                      >
                        <Download className="w-3.5 h-3.5 text-blue-600" />
                        Exportar CSV
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-0">
                  {loading ? (
                    <div className="py-12 flex justify-center items-center">
                      <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : lancamentosSessao.length === 0 ? (
                    <div className="py-16 flex flex-col items-center justify-center text-center px-4">
                      <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
                        <FileText className="w-7 h-7 text-slate-400" />
                      </div>
                      <h3 className="text-sm font-bold text-[#0B1F3A]">
                        Nenhum lançamento nesta sessão
                      </h3>
                      <p className="text-xs text-slate-500 mt-1 max-w-xs">
                        Preencha o formulário ao lado para registrar o primeiro lançamento para{' '}
                        <strong>{empresaAtiva?.nome || 'esta empresa'}</strong> na data{' '}
                        <strong>{formatarDataBr(dataFixa)}</strong>.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 font-semibold">
                            <th className="py-3 px-3.5">PC</th>
                            <th className="py-3 px-3">Conta (CO)</th>
                            <th className="py-3 px-3">Centro (CC)</th>
                            <th className="py-3 px-3 text-right">Valor</th>
                            <th className="py-3 px-3.5">Histórico</th>
                            <th className="py-3 px-3 text-right">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {lancamentosSessao.map((l) => {
                            const pc = l.expand?.plano_conta || planoContaMap.get(l.plano_conta)
                            const conta = pc?.expand?.conta
                            const centro = pc?.expand?.centro

                            return (
                              <tr
                                key={l.id}
                                className="hover:bg-slate-50/80 transition-colors align-top"
                              >
                                <td className="py-3 px-3.5 whitespace-nowrap">
                                  <div className="flex flex-col">
                                    <span className="font-mono font-semibold text-blue-700 text-[11px] bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 w-fit">
                                      {pc?.codigo || 'PC-???'}
                                    </span>
                                    {conta && (
                                      <span
                                        className="text-[11px] text-slate-700 font-medium mt-1 truncate max-w-[170px]"
                                        title={`${conta.codigo || 'CO-???'} - ${conta.nome}`}
                                      >
                                        <span className="font-mono text-slate-500 text-[10px]">
                                          {conta.codigo || 'CO-???'} -
                                        </span>{' '}
                                        {conta.nome}
                                      </span>
                                    )}
                                  </div>
                                </td>

                                <td className="py-3 px-3 max-w-[150px]">
                                  {conta ? (
                                    <div className="flex flex-col">
                                      <span
                                        className="font-medium text-slate-800 truncate"
                                        title={conta.nome}
                                      >
                                        {conta.nome}
                                      </span>
                                      <span className="text-[10px] text-slate-400 font-mono">
                                        {conta.codigo || '—'}
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-slate-400 italic">
                                      Conta não encontrada
                                    </span>
                                  )}
                                </td>

                                <td className="py-3 px-3 max-w-[150px]">
                                  {centro ? (
                                    <div className="flex flex-col">
                                      <span
                                        className="font-medium text-slate-800 truncate"
                                        title={centro.nome}
                                      >
                                        {centro.nome}
                                      </span>
                                      <span className="text-[10px] text-slate-400 font-mono">
                                        {centro.codigo || '—'}
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-slate-400 italic">
                                      Centro não encontrado
                                    </span>
                                  )}
                                </td>

                                <td className="py-3 px-3 text-right whitespace-nowrap">
                                  <span className="font-bold text-slate-900 font-mono">
                                    {formatarMoeda(l.valor)}
                                  </span>
                                </td>

                                <td className="py-3 px-3.5 text-slate-600 max-w-[180px]">
                                  {l.historico ? (
                                    <span className="block truncate" title={l.historico}>
                                      {l.historico}
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 italic">—</span>
                                  )}
                                </td>

                                <td className="py-3 px-3 text-right whitespace-nowrap">
                                  <div className="flex items-center justify-end gap-1">
                                    <Button
                                      onClick={() => handleOpenEdit(l)}
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 w-7 p-0 text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                                      title="Editar lançamento"
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </Button>
                                    <Button
                                      onClick={() => handleConfirmDelete(l)}
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

                        <tfoot>
                          <tr className="border-t-2 border-slate-200 bg-slate-50/90 font-bold text-slate-800">
                            <td colSpan={3} className="py-3 px-4 text-xs">
                              Totalizador da Sessão ({lancamentosSessao.length} registro
                              {lancamentosSessao.length !== 1 ? 's' : ''})
                            </td>
                            <td className="py-3 px-3 text-right text-xs font-mono text-emerald-700">
                              {formatarMoeda(totalValorSessao)}
                            </td>
                            <td colSpan={2} className="py-3 px-4"></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ========================================================================= */}
        {/* ABA 2: HISTÓRICO POR EMPRESA E PERÍODO (Totalmente independente do fluxo) */}
        {/* ========================================================================= */}
        <TabsContent value="historico" className="space-y-4 mt-4">
          {/* Card de Filtros de Período e Empresa */}
          <Card className="bg-white border-slate-200 shadow-xs">
            <CardHeader className="pb-3 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
                  <Filter className="w-4 h-4 text-blue-600" />
                  Filtros de Busca por Período
                </CardTitle>
                <Badge variant="outline" className="text-xs bg-slate-50 text-slate-600">
                  {lancamentosHistorico.length} resultado(s)
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {/* Seletor Empresa */}
                <div className="space-y-1.5">
                  <Label htmlFor="hist-empresa" className="text-xs font-semibold text-slate-700">
                    Empresa
                  </Label>
                  <Select value={histEmpresaId} onValueChange={setHistEmpresaId}>
                    <SelectTrigger id="hist-empresa" className="h-9 text-xs bg-white">
                      <SelectValue placeholder="Selecione a empresa" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      <SelectItem value="todas" className="text-xs font-semibold text-blue-700">
                        Todas as Empresas
                      </SelectItem>
                      {empresas.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id} className="text-xs">
                          {emp.nome} ({emp.segmento})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Filtro Plano de Contas */}
                <div className="space-y-1.5">
                  <Label htmlFor="hist-plano" className="text-xs font-semibold text-slate-700">
                    Plano de Contas
                  </Label>
                  <Select value={histPlanoContaFiltro} onValueChange={setHistPlanoContaFiltro}>
                    <SelectTrigger
                      id="hist-plano"
                      className="h-9 text-xs bg-white truncate text-left"
                    >
                      <SelectValue placeholder="Todos os planos" />
                    </SelectTrigger>
                    <SelectContent className="max-h-64 max-w-[420px]">
                      <SelectItem value="todos" className="text-xs font-semibold text-blue-700">
                        Todos os Planos de Contas
                      </SelectItem>
                      {planoContasOptions.map((item) => (
                        <SelectItem key={item.id} value={item.id} className="text-xs py-2">
                          <span>{formatPlanoContaLabel(item)}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Data Início */}
                <div className="space-y-1.5">
                  <Label htmlFor="hist-inicio" className="text-xs font-semibold text-slate-700">
                    Data Inicial
                  </Label>
                  <Input
                    id="hist-inicio"
                    type="date"
                    value={histDataInicio}
                    onChange={(e) => setHistDataInicio(e.target.value)}
                    className="h-9 text-xs bg-white"
                  />
                </div>

                {/* Data Fim */}
                <div className="space-y-1.5">
                  <Label htmlFor="hist-fim" className="text-xs font-semibold text-slate-700">
                    Data Final
                  </Label>
                  <Input
                    id="hist-fim"
                    type="date"
                    value={histDataFim}
                    onChange={(e) => setHistDataFim(e.target.value)}
                    className="h-9 text-xs bg-white"
                  />
                </div>

                {/* Busca Textual */}
                <div className="space-y-1.5">
                  <Label htmlFor="hist-busca" className="text-xs font-semibold text-slate-700">
                    Buscar termo / Histórico
                  </Label>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <Input
                      id="hist-busca"
                      type="text"
                      placeholder="Histórico, conta, centro..."
                      value={histSearchTerm}
                      onChange={(e) => setHistSearchTerm(e.target.value)}
                      className="h-9 text-xs pl-8 bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Botões Rápidos de Período & Exportar */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] font-semibold text-slate-500 mr-1">Atalhos:</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px] px-2"
                    onClick={() => {
                      const p = periodoMesCorrenteIso()
                      setHistDataInicio(p.inicio)
                      setHistDataFim(p.fim)
                    }}
                  >
                    Mês Atual
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px] px-2"
                    onClick={() => {
                      const now = new Date()
                      const y = now.getFullYear()
                      const m = now.getMonth() - 1
                      const inicio = new Date(y, m, 1).toISOString().slice(0, 10)
                      const fim = new Date(y, m + 1, 0).toISOString().slice(0, 10)
                      setHistDataInicio(inicio)
                      setHistDataFim(fim)
                    }}
                  >
                    Mês Anterior
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px] px-2"
                    onClick={() => {
                      const y = new Date().getFullYear()
                      setHistDataInicio(`${y}-01-01`)
                      setHistDataFim(`${y}-12-31`)
                    }}
                  >
                    Ano Completo ({new Date().getFullYear()})
                  </Button>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleExportCsvHistorico}
                  disabled={lancamentosHistorico.length === 0}
                  className="h-8 text-xs border-slate-200 hover:border-blue-300 hover:text-blue-700 font-medium gap-1.5"
                >
                  <Download className="w-3.5 h-3.5 text-blue-600" />
                  Exportar CSV ({lancamentosHistorico.length})
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Tabela do Histórico Consolidado */}
          <Card className="bg-white border-slate-200 shadow-xs">
            <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
                  <History className="w-4 h-4 text-blue-600" />
                  Lançamentos no Período
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  De {formatarDataBr(histDataInicio)} até {formatarDataBr(histDataFim)} · Total:{' '}
                  <strong className="text-emerald-700">{formatarMoeda(totalHistoricoValor)}</strong>
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {lancamentosHistorico.length === 0 ? (
                <div className="py-16 flex flex-col items-center justify-center text-center px-4">
                  <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
                    <Search className="w-7 h-7 text-slate-400" />
                  </div>
                  <h3 className="text-sm font-bold text-[#0B1F3A]">Nenhum lançamento encontrado</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs">
                    Tente ajustar o intervalo de datas ou selecionar outra empresa nos filtros
                    acima.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 font-semibold">
                        <th className="py-3 px-3.5">Data</th>
                        <th className="py-3 px-3">Empresa</th>
                        <th className="py-3 px-3">PC</th>
                        <th className="py-3 px-3">Conta (CO)</th>
                        <th className="py-3 px-3">Centro (CC)</th>
                        <th className="py-3 px-3 text-right">Valor (R$)</th>
                        <th className="py-3 px-3.5">Histórico</th>
                        <th className="py-3 px-3 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {lancamentosHistorico.map((l) => {
                        const pc = l.expand?.plano_conta || planoContaMap.get(l.plano_conta)
                        const emp = l.expand?.empresa || empresaMap.get(l.empresa)
                        const conta = pc?.expand?.conta
                        const centro = pc?.expand?.centro

                        return (
                          <tr
                            key={l.id}
                            className="hover:bg-slate-50/80 transition-colors align-top"
                          >
                            {/* Data */}
                            <td className="py-3 px-3.5 whitespace-nowrap font-medium text-slate-800">
                              <span className="flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                {formatarDataBr(l.data)}
                              </span>
                            </td>

                            {/* Empresa */}
                            <td className="py-3 px-3 max-w-[140px]">
                              <span
                                className="font-semibold text-slate-900 truncate block"
                                title={emp?.nome}
                              >
                                {emp?.nome || '—'}
                              </span>
                            </td>

                            {/* Código PC */}
                            <td className="py-3 px-3 whitespace-nowrap">
                              <div className="flex flex-col">
                                <span className="font-mono font-semibold text-blue-700 text-[11px] bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 w-fit">
                                  {pc?.codigo || 'PC-???'}
                                </span>
                                {conta && (
                                  <span
                                    className="text-[11px] text-slate-700 font-medium mt-1 truncate max-w-[170px]"
                                    title={`${conta.codigo || 'CO-???'} - ${conta.nome}`}
                                  >
                                    <span className="font-mono text-slate-500 text-[10px]">
                                      {conta.codigo || 'CO-???'} -
                                    </span>{' '}
                                    {conta.nome}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Conta */}
                            <td className="py-3 px-3 max-w-[150px]">
                              {conta ? (
                                <div className="flex flex-col">
                                  <span
                                    className="font-medium text-slate-800 truncate"
                                    title={conta.nome}
                                  >
                                    {conta.nome}
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-mono">
                                    {conta.codigo || '—'}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-slate-400 italic">Conta não encontrada</span>
                              )}
                            </td>

                            {/* Centro */}
                            <td className="py-3 px-3 max-w-[150px]">
                              {centro ? (
                                <div className="flex flex-col">
                                  <span
                                    className="font-medium text-slate-800 truncate"
                                    title={centro.nome}
                                  >
                                    {centro.nome}
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-mono">
                                    {centro.codigo || '—'}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-slate-400 italic">Centro não encontrado</span>
                              )}
                            </td>

                            {/* Valor */}
                            <td className="py-3 px-3 text-right whitespace-nowrap">
                              <span className="font-bold text-slate-900 font-mono">
                                {formatarMoeda(l.valor)}
                              </span>
                            </td>

                            {/* Histórico */}
                            <td className="py-3 px-3.5 text-slate-600 max-w-[200px]">
                              {l.historico ? (
                                <span className="block truncate" title={l.historico}>
                                  {l.historico}
                                </span>
                              ) : (
                                <span className="text-slate-400 italic">—</span>
                              )}
                            </td>

                            {/* Ações */}
                            <td className="py-3 px-3 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  onClick={() => handleOpenEdit(l)}
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0 text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                                  title="Editar lançamento"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  onClick={() => handleConfirmDelete(l)}
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

                    {/* Totalizador no Rodapé */}
                    <tfoot>
                      <tr className="border-t-2 border-slate-200 bg-slate-50/90 font-bold text-slate-800">
                        <td colSpan={5} className="py-3 px-4 text-xs">
                          Total do Período ({lancamentosHistorico.length} registro
                          {lancamentosHistorico.length !== 1 ? 's' : ''})
                        </td>
                        <td className="py-3 px-3 text-right text-xs font-mono text-emerald-700">
                          {formatarMoeda(totalHistoricoValor)}
                        </td>
                        <td colSpan={2} className="py-3 px-4"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========================================================================= */}
        {/* ABA 3: LANÇAMENTOS RECORRENTES (Listagem, Toggle Ativo/Pausado, Exclusão)  */}
        {/* ========================================================================= */}
        <TabsContent value="recorrentes" className="space-y-4 mt-4">
          {/* Header de Ações e Resumo de Recorrências */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Card className="bg-white border-slate-200 shadow-xs">
              <CardContent className="py-3 px-4 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Recorrências Ativas
                  </p>
                  <p className="text-xl font-bold text-blue-600 mt-0.5">
                    {recorrentesFiltrados.filter((r) => r.ativo).length} de{' '}
                    {recorrentesFiltrados.length}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Repeat className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border-slate-200 shadow-xs">
              <CardContent className="py-3 px-4 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Impacto Mensal Previsto
                  </p>
                  <p className="text-xl font-bold text-emerald-700 mt-0.5">
                    {formatarMoeda(totalRecorrenteMensal)}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <DollarSign className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border-slate-200 shadow-xs flex items-center justify-center p-3">
              <Button
                onClick={handleOpenNovaRecorrencia}
                className="w-full h-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs py-2 shadow-xs gap-1.5"
              >
                <Plus className="w-4 h-4" />
                Nova Recorrência
              </Button>
            </Card>
          </div>

          {/* Filtro e Tabela de Recorrências */}
          <Card className="bg-white border-slate-200 shadow-xs">
            <CardHeader className="pb-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
                  <Repeat className="w-4 h-4 text-blue-600" />
                  Regras de Recorrência Mensal
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Lançamentos automáticos gerados todo mês no dia configurado.
                </CardDescription>
              </div>

              {/* Filtro Empresa */}
              <div className="flex items-center gap-2">
                <Select value={recEmpresaFiltro} onValueChange={setRecEmpresaFiltro}>
                  <SelectTrigger className="h-8 text-xs bg-white w-48">
                    <SelectValue placeholder="Filtrar por empresa" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    <SelectItem value="todas" className="text-xs font-semibold text-blue-700">
                      Todas as Empresas
                    </SelectItem>
                    {empresas.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id} className="text-xs">
                        {emp.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {recorrentesFiltrados.length === 0 ? (
                <div className="py-16 flex flex-col items-center justify-center text-center px-4">
                  <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
                    <Repeat className="w-7 h-7 text-slate-400" />
                  </div>
                  <h3 className="text-sm font-bold text-[#0B1F3A]">
                    Nenhuma recorrência cadastrada
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs mb-4">
                    Cadastre despesas ou receitas recorrentes mensais (ex: aluguel, software,
                    salários).
                  </p>
                  <Button
                    onClick={handleOpenNovaRecorrencia}
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Cadastrar Recorrência
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 font-semibold">
                        <th className="py-3 px-3.5">Status</th>
                        <th className="py-3 px-3">Empresa</th>
                        <th className="py-3 px-3">Plano de Contas</th>
                        <th className="py-3 px-3 text-center">Dia do Mês</th>
                        <th className="py-3 px-3">Próximo Previsto</th>
                        <th className="py-3 px-3 text-right">Valor Mensal</th>
                        <th className="py-3 px-3.5">Histórico</th>
                        <th className="py-3 px-3 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {recorrentesFiltrados.map((rec) => {
                        const pc = rec.expand?.plano_conta || planoContaMap.get(rec.plano_conta)
                        const emp = rec.expand?.empresa || empresaMap.get(rec.empresa)
                        const conta = pc?.expand?.conta
                        const centro = pc?.expand?.centro
                        const proximo = calcularProximoLancamento(rec.dia_mes || 1)

                        return (
                          <tr
                            key={rec.id}
                            className={`hover:bg-slate-50/80 transition-colors align-middle ${
                              !rec.ativo ? 'opacity-60 bg-slate-50/40' : ''
                            }`}
                          >
                            {/* Switch Ativo / Inativo */}
                            <td className="py-3 px-3.5 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <Switch
                                  checked={rec.ativo}
                                  onCheckedChange={() => handleToggleRecorrenteAtivo(rec)}
                                  title={rec.ativo ? 'Clique para pausar' : 'Clique para ativar'}
                                />
                                <span
                                  className={`text-[11px] font-semibold ${
                                    rec.ativo ? 'text-emerald-700' : 'text-slate-400'
                                  }`}
                                >
                                  {rec.ativo ? 'Ativo' : 'Pausado'}
                                </span>
                              </div>
                            </td>

                            {/* Empresa */}
                            <td className="py-3 px-3 max-w-[140px]">
                              <span className="font-semibold text-slate-900 truncate block">
                                {emp?.nome || '—'}
                              </span>
                            </td>

                            {/* Plano de Contas */}
                            <td className="py-3 px-3 max-w-[240px]">
                              <div className="flex flex-col">
                                <div className="flex items-center gap-1">
                                  <span className="font-mono font-bold text-blue-700 text-[11px]">
                                    {pc?.codigo || 'PC-???'}
                                  </span>
                                  <span
                                    className="font-medium text-slate-800 truncate"
                                    title={
                                      conta
                                        ? `${conta.codigo || 'CO-???'} - ${conta.nome}`
                                        : 'Conta'
                                    }
                                  >
                                    | {conta?.codigo || 'CO-???'} - {conta?.nome || 'Conta'}
                                  </span>
                                </div>
                                <span className="text-[10px] text-slate-500 truncate mt-0.5">
                                  → {centro?.codigo || 'CC-???'} - {centro?.nome || 'Centro'}
                                  {pc?.expand?.tipo_despesa && (
                                    <span className="text-slate-400">
                                      {' '}
                                      → {pc.expand.tipo_despesa.codigo || 'TD-???'} -{' '}
                                      {pc.expand.tipo_despesa.nome}
                                    </span>
                                  )}
                                </span>
                              </div>
                            </td>

                            {/* Dia do Mês */}
                            <td className="py-3 px-3 text-center whitespace-nowrap">
                              <Badge className="bg-slate-100 text-slate-800 border-slate-300 font-mono font-bold text-xs">
                                Todo dia {rec.dia_mes}
                              </Badge>
                            </td>

                            {/* Próximo Previsto */}
                            <td className="py-3 px-3 whitespace-nowrap">
                              <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                                <Clock className="w-3.5 h-3.5 text-blue-600" />
                                <span>{proximo.dataFormatada}</span>
                              </div>
                            </td>

                            {/* Valor Mensal */}
                            <td className="py-3 px-3 text-right whitespace-nowrap">
                              <span className="font-bold text-slate-900 font-mono">
                                {formatarMoeda(rec.valor)}
                              </span>
                            </td>

                            {/* Histórico */}
                            <td className="py-3 px-3.5 text-slate-600 max-w-[180px]">
                              {rec.historico ? (
                                <span className="block truncate" title={rec.historico}>
                                  {rec.historico}
                                </span>
                              ) : (
                                <span className="text-slate-400 italic">—</span>
                              )}
                            </td>

                            {/* Ações */}
                            <td className="py-3 px-3 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  onClick={() => handleOpenEditRecorrencia(rec)}
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0 text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                                  title="Editar recorrência"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  onClick={() => handleConfirmDeleteRec(rec)}
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0 text-slate-500 hover:text-red-600 hover:bg-red-50"
                                  title="Excluir recorrência"
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
        </TabsContent>
      </Tabs>

      {/* ============ MODAL DE EDIÇÃO DE LANÇAMENTO ============ */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[580px] bg-white">
          <form onSubmit={handleSaveEdit}>
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-[#0B1F3A] flex items-center gap-2">
                <Pencil className="w-4 h-4 text-blue-600" />
                Editar Lançamento
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Altere as informações do lançamento selecionado.
              </DialogDescription>
            </DialogHeader>

            {editErrors.general && (
              <Alert
                variant="destructive"
                className="mt-3 bg-red-50 border-red-200 text-red-800 py-2"
              >
                <AlertCircle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-xs font-medium">
                  {editErrors.general}
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-3 py-4">
              {/* Empresa */}
              <div className="space-y-1.5">
                <Label htmlFor="edit-lan-empresa" className="text-xs font-semibold text-slate-700">
                  Empresa *
                </Label>
                <Select value={editEmpresa} onValueChange={setEditEmpresa}>
                  <SelectTrigger id="edit-lan-empresa" className="h-9 text-xs bg-white">
                    <SelectValue placeholder="Selecione a empresa" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {empresas.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id} className="text-xs">
                        {emp.nome} ({emp.segmento})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {editErrors.empresa && (
                  <p className="text-[11px] text-red-600 font-medium">{editErrors.empresa}</p>
                )}
              </div>

              {/* Data */}
              <div className="space-y-1.5">
                <Label htmlFor="edit-lan-data" className="text-xs font-semibold text-slate-700">
                  Data *
                </Label>
                <Input
                  id="edit-lan-data"
                  type="date"
                  value={editData}
                  onChange={(e) => setEditData(e.target.value)}
                  className="h-9 text-xs bg-white"
                />
                {editErrors.data && (
                  <p className="text-[11px] text-red-600 font-medium">{editErrors.data}</p>
                )}
              </div>

              {/* Plano de Contas */}
              <div className="space-y-1.5">
                <Label htmlFor="edit-lan-plano" className="text-xs font-semibold text-slate-700">
                  Plano de Contas *
                </Label>
                <Select value={editPlanoConta} onValueChange={setEditPlanoConta}>
                  <SelectTrigger
                    id="edit-lan-plano"
                    className="h-9 text-xs bg-white text-left truncate"
                  >
                    <SelectValue placeholder="Selecione o plano de contas (PC-xxx | Conta → Centro)" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {planoContasOptions.map((item) => (
                      <SelectItem key={item.id} value={item.id} className="text-xs py-2">
                        <span>{formatPlanoContaLabel(item)}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {editErrors.plano_conta && (
                  <p className="text-[11px] text-red-600 font-medium">{editErrors.plano_conta}</p>
                )}
              </div>

              {/* Valor */}
              <div className="space-y-1.5">
                <Label htmlFor="edit-lan-valor" className="text-xs font-semibold text-slate-700">
                  Valor (R$) *
                </Label>
                <div className="relative">
                  <DollarSign className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <Input
                    id="edit-lan-valor"
                    type="text"
                    value={editValorInput}
                    onChange={handleEditValorChange}
                    className="h-9 text-xs pl-8 font-semibold text-slate-900"
                  />
                </div>
                {editErrors.valor && (
                  <p className="text-[11px] text-red-600 font-medium">{editErrors.valor}</p>
                )}
              </div>

              {/* Histórico */}
              <div className="space-y-1.5">
                <Label
                  htmlFor="edit-lan-historico"
                  className="text-xs font-semibold text-slate-700"
                >
                  Histórico / Observações
                </Label>
                <Textarea
                  id="edit-lan-historico"
                  value={editHistorico}
                  onChange={(e) => setEditHistorico(e.target.value)}
                  className="min-h-[72px] text-xs"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditOpen(false)}
                disabled={savingEdit}
                className="text-xs h-9"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={savingEdit}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-9 shadow-xs"
              >
                {savingEdit ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ============ MODAL DE CRIAÇÃO / EDIÇÃO DE RECORRÊNCIA ============ */}
      <Dialog open={recModalOpen} onOpenChange={setRecModalOpen}>
        <DialogContent className="sm:max-w-[580px] bg-white">
          <form onSubmit={handleSaveRecorrenciaModal}>
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-[#0B1F3A] flex items-center gap-2">
                <Repeat className="w-4 h-4 text-blue-600" />
                {recEditing ? 'Editar Recorrência' : 'Nova Recorrência Mensal'}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Configure os dados para repetição automática mensal.
              </DialogDescription>
            </DialogHeader>

            {recErrors.general && (
              <Alert
                variant="destructive"
                className="mt-3 bg-red-50 border-red-200 text-red-800 py-2"
              >
                <AlertCircle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-xs font-medium">
                  {recErrors.general}
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-3 py-4">
              {/* Empresa */}
              <div className="space-y-1.5">
                <Label htmlFor="modal-rec-empresa" className="text-xs font-semibold text-slate-700">
                  Empresa *
                </Label>
                <Select value={recEmpresa} onValueChange={setRecEmpresa}>
                  <SelectTrigger id="modal-rec-empresa" className="h-9 text-xs bg-white">
                    <SelectValue placeholder="Selecione a empresa" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {empresas.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id} className="text-xs">
                        {emp.nome} ({emp.segmento})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {recErrors.empresa && (
                  <p className="text-[11px] text-red-600 font-medium">{recErrors.empresa}</p>
                )}
              </div>

              {/* Plano de Contas */}
              <div className="space-y-1.5">
                <Label htmlFor="modal-rec-plano" className="text-xs font-semibold text-slate-700">
                  Plano de Contas *
                </Label>
                <Select value={recPlanoConta} onValueChange={setRecPlanoConta}>
                  <SelectTrigger
                    id="modal-rec-plano"
                    className="h-9 text-xs bg-white text-left truncate"
                  >
                    <SelectValue placeholder="Selecione o plano de contas (PC-xxx | Conta → Centro)" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {planoContasOptions.map((item) => (
                      <SelectItem key={item.id} value={item.id} className="text-xs py-2">
                        <span>{formatPlanoContaLabel(item)}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {recErrors.plano_conta && (
                  <p className="text-[11px] text-red-600 font-medium">{recErrors.plano_conta}</p>
                )}
              </div>

              {/* Dia do Mês e Próximo previsto */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="modal-rec-dia" className="text-xs font-semibold text-slate-700">
                    Dia do mês (1-28) *
                  </Label>
                  <Input
                    id="modal-rec-dia"
                    type="number"
                    min={1}
                    max={28}
                    value={recDiaMes}
                    onChange={(e) =>
                      setRecDiaMes(Math.min(Math.max(Number(e.target.value) || 1, 1), 28))
                    }
                    className="h-9 text-xs bg-white font-mono font-bold"
                  />
                  {recErrors.dia_mes && (
                    <p className="text-[11px] text-red-600 font-medium">{recErrors.dia_mes}</p>
                  )}
                </div>

                <div className="p-2.5 bg-blue-50/70 border border-blue-200/70 rounded-lg flex flex-col justify-center">
                  <span className="text-[10px] text-blue-900 uppercase font-semibold">
                    Próxima execução:
                  </span>
                  <span className="text-xs font-bold text-blue-700 font-mono">
                    {calcularProximoLancamento(recDiaMes).dataFormatada}
                  </span>
                </div>
              </div>

              {/* Valor */}
              <div className="space-y-1.5">
                <Label htmlFor="modal-rec-valor" className="text-xs font-semibold text-slate-700">
                  Valor Mensal (R$) *
                </Label>
                <div className="relative">
                  <DollarSign className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <Input
                    id="modal-rec-valor"
                    type="text"
                    value={recValorInput}
                    onChange={handleRecValorChange}
                    className="h-9 text-xs pl-8 font-semibold text-slate-900"
                  />
                </div>
                {recErrors.valor && (
                  <p className="text-[11px] text-red-600 font-medium">{recErrors.valor}</p>
                )}
              </div>

              {/* Histórico */}
              <div className="space-y-1.5">
                <Label
                  htmlFor="modal-rec-historico"
                  className="text-xs font-semibold text-slate-700"
                >
                  Histórico / Observações
                </Label>
                <Textarea
                  id="modal-rec-historico"
                  value={recHistorico}
                  onChange={(e) => setRecHistorico(e.target.value)}
                  className="min-h-[64px] text-xs"
                />
              </div>

              {/* Ativo switch */}
              <div className="flex items-center justify-between pt-2">
                <Label
                  htmlFor="modal-rec-ativo"
                  className="text-xs font-semibold text-slate-700 cursor-pointer"
                >
                  Recorrência Ativa
                </Label>
                <Switch id="modal-rec-ativo" checked={recAtivo} onCheckedChange={setRecAtivo} />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setRecModalOpen(false)}
                disabled={savingRec}
                className="text-xs h-9"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={savingRec}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-9 shadow-xs"
              >
                {savingRec ? 'Salvando...' : recEditing ? 'Salvar Alterações' : 'Criar Recorrência'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ============ MODAL DE CONFIRMAÇÃO DE EXCLUSÃO (LANÇAMENTO) ============ */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-red-600 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" /> Excluir Lançamento?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-600">
              Tem certeza que deseja excluir o lançamento de{' '}
              <strong className="text-slate-900 font-semibold">
                {formatarMoeda(toDelete?.valor)}
              </strong>{' '}
              da data{' '}
              <strong className="text-slate-900 font-semibold">
                {formatarDataBr(toDelete?.data)}
              </strong>
              ? Esta ação não pode ser desfeita.
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

      {/* ============ MODAL DE CONFIRMAÇÃO DE EXCLUSÃO (RECORRÊNCIA) ============ */}
      <AlertDialog open={deleteRecOpen} onOpenChange={setDeleteRecOpen}>
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-red-600 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" /> Excluir Recorrência?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-600">
              Tem certeza que deseja excluir a recorrência de{' '}
              <strong className="text-slate-900 font-semibold">
                {formatarMoeda(toDeleteRec?.valor)} (todo dia {toDeleteRec?.dia_mes})
              </strong>
              ? Novos lançamentos mensais automáticos não serão mais criados. Lançamentos passados
              serão preservados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingRec} className="text-xs h-8">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteRec}
              disabled={deletingRec}
              className="bg-red-600 hover:bg-red-700 text-white text-xs h-8 font-semibold"
            >
              {deletingRec ? 'Excluindo...' : 'Sim, Excluir Recorrência'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
