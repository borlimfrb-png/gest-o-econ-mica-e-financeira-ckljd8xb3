import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  contasService,
  centrosService,
  empresasService,
  planoContasService,
  tiposDespesaService,
} from '@/services/financeService'
import type {
  ContaRecord,
  CentroRecord,
  EmpresaRecord,
  TipoConta,
  ClassificacaoDre,
  PlanoContaRecord,
  TipoDespesaRecord,
} from '@/types/finance'
import { DialogEditarConta } from '@/components/contas/DialogEditarConta'
import type { ContaEdicaoForm } from '@/components/contas/DialogEditarConta'
import { ModalQuickRegisterConta } from '@/components/ModalQuickRegisterConta'
import { ModalCopiarModeloPadrao } from '@/components/ModalCopiarModeloPadrao'
import { ModalImportarPlanoContas } from '@/components/ModalImportarPlanoContas'
import { ModalCopiarPlanoEmpresas } from '@/components/ModalCopiarPlanoEmpresas'
import { ModalCompararPlanos } from '@/components/ModalCompararPlanos'
import { ModalEdicaoLoteCodigos } from '@/components/ModalEdicaoLoteCodigos'
import { DoubleHorizontalScroll } from '@/components/DoubleHorizontalScroll'
import { compararCentroTipoConta, compararContasDre } from '@/lib/dreGerencialTypes'
import { useFilter } from '@/contexts/FilterContext'
import { useAuth } from '@/contexts/AuthContext'
import { useRealtime } from '@/hooks/use-realtime'
import { useToast } from '@/hooks/use-toast'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
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
  FolderTree,
  GripVertical,
  Pencil,
  Trash2,
  Search,
  Download,
  Plus,
  Filter,
  Sparkles,
  Upload,
  Copy,
  Layers,
  AlertCircle,
  RefreshCw,
  Folder,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const TIPO_BADGE: Record<TipoConta, string> = {
  Ativo: 'bg-blue-50 text-blue-700 border-blue-200',
  Passivo: 'bg-amber-50 text-amber-700 border-amber-200',
  'Patrimônio Líquido': 'bg-violet-50 text-violet-700 border-violet-200',
  Receita: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Despesa: 'bg-rose-50 text-rose-700 border-rose-200',
}

interface GrupoCentroItem {
  centroId: string | null
  nome: string
  codigo?: string | null
  sequencia: number | null
  contas: ContaRecord[]
}

const EMPTY_FORM: ContaEdicaoForm = {
  nome: '',
  tipo: 'Despesa',
  grupo: '',
  centro: '',
  descricao: '',
  classificacao_dre: '',
  nao_exibir_dre: false,
  nao_exibir_fluxo_caixa: false,
  nao_exibir_em_nada: false,
}

export default function PlanoContas() {
  const { toast } = useToast()
  const { user } = useAuth()
  const { selectedEmpresaId } = useFilter()

  // Perfis autorizados a editar o plano de contas: admin, empresa, financeiro (cliente e comercial são somente leitura)
  const isCliente = user?.role === 'cliente'
  const isComercial = user?.role === 'comercial'
  const podeEditar = !isCliente && !isComercial

  // Empresa ativa efetiva: garante envio do ID tanto para admin quanto para perfis empresa/financeiro
  const effectiveEmpresaId =
    (selectedEmpresaId && !selectedEmpresaId.startsWith('grupo-') ? selectedEmpresaId : '') ||
    user?.empresa ||
    ''

  // Dados principais
  const [contas, setContas] = useState<ContaRecord[]>([])
  const [centros, setCentros] = useState<CentroRecord[]>([])
  const [empresas, setEmpresas] = useState<EmpresaRecord[]>([])
  const [planoContasRecords, setPlanoContasRecords] = useState<PlanoContaRecord[]>([])
  const [tiposDespesa, setTiposDespesa] = useState<TipoDespesaRecord[]>([])
  const [loading, setLoading] = useState(true)

  // Filtros
  const [busca, setBusca] = useState('')
  const [filtroCentro, setFiltroCentro] = useState<string>('todos')

  // Modais de ações
  const [modalNovaContaOpen, setModalNovaContaOpen] = useState(false)
  const [modalModeloPadraoOpen, setModalModeloPadraoOpen] = useState(false)
  const [modalImportarOpen, setModalImportarOpen] = useState(false)
  const [modalCopiarEmpresasOpen, setModalCopiarEmpresasOpen] = useState(false)
  const [modalCompararOpen, setModalCompararOpen] = useState(false)
  const [modalLoteCodigosOpen, setModalLoteCodigosOpen] = useState(false)

  // Edição e Exclusão
  const [editOpen, setEditOpen] = useState(false)
  const [editingConta, setEditingConta] = useState<ContaRecord | null>(null)
  const [editForm, setEditForm] = useState<ContaEdicaoForm>(EMPTY_FORM)
  const [savingEdit, setSavingEdit] = useState(false)
  const [editErrors, setEditErrors] = useState<{ nome?: string; general?: string }>({})

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [toDeleteConta, setToDeleteConta] = useState<ContaRecord | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Drag & drop otimista
  const [ordemIds, setOrdemIds] = useState<string[] | null>(null)
  const [centroOverride, setCentroOverride] = useState<Record<string, string | null>>({})
  const [dragId, setDragId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<{ id: string; posicao: 'antes' | 'depois' } | null>(
    null,
  )
  const [dropTargetCentro, setDropTargetCentro] = useState<string | null>(null)
  const [salvandoOrdem, setSalvandoOrdem] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const opts = effectiveEmpresaId ? { empresaId: effectiveEmpresaId } : undefined
      const [contasDiretas, centrosList, empresasList, planosList, tiposList] = await Promise.all([
        contasService.getAll(opts),
        centrosService.getAll(opts),
        empresasService.getAll(),
        planoContasService.getAll(opts).catch(() => []),
        tiposDespesaService.getAll(opts).catch(() => []),
      ])

      // Consolidação de contas: se há vínculos em plano_contas para a empresa ativa,
      // garantimos que todas as contas referenciadas pelos vínculos estejam na lista
      // mesmo que a conta não possua o campo empresa preenchido diretamente.
      const contasMap = new Map<string, ContaRecord>()
      for (const c of contasDiretas) {
        contasMap.set(c.id, c)
      }

      for (const p of planosList) {
        if (p.expand?.conta && !contasMap.has(p.expand.conta.id)) {
          contasMap.set(p.expand.conta.id, p.expand.conta as ContaRecord)
        }
      }

      const listaFinalContas = Array.from(contasMap.values())

      setContas(listaFinalContas)
      setCentros(centrosList)
      setEmpresas(empresasList)
      setPlanoContasRecords(planosList)
      setTiposDespesa(tiposList)
      setOrdemIds(null)
      setCentroOverride({})
    } catch (err: any) {
      console.error('Erro ao carregar dados do plano de contas:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar',
        description: err?.message || 'Falha ao buscar contas e centros.',
      })
    } finally {
      setLoading(false)
    }
  }, [effectiveEmpresaId, toast])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Escuta atualizações de outras telas
  useEffect(() => {
    const handleAtualizado = () => {
      loadData()
    }
    window.addEventListener('dre-contas-atualizado', handleAtualizado)
    window.addEventListener('dre-contas-atualizadas', handleAtualizado)
    return () => {
      window.removeEventListener('dre-contas-atualizado', handleAtualizado)
      window.removeEventListener('dre-contas-atualizadas', handleAtualizado)
    }
  }, [loadData])

  useRealtime('contas', loadData)
  useRealtime('centros_custos', loadData)
  useRealtime('plano_contas', loadData)
  useRealtime('tipos_despesa', loadData)

  const selectedEmpresa = useMemo(
    () => empresas.find((e) => e.id === selectedEmpresaId) || null,
    [empresas, selectedEmpresaId],
  )

  const contaMap = useMemo(() => {
    const m = new Map<string, ContaRecord>()
    for (const c of contas) m.set(c.id, c)
    return m
  }, [contas])

  const centroMap = useMemo(() => {
    const m = new Map<string, CentroRecord>()
    for (const ce of centros) m.set(ce.id, ce)
    return m
  }, [centros])

  const tipoDespesaMap = useMemo(() => {
    const m = new Map<string, TipoDespesaRecord>()
    for (const td of tiposDespesa) m.set(td.id, td)
    return m
  }, [tiposDespesa])

  // Centros ordenados segundo a regra compararCentroTipoConta (mesma da DRE Gerencial)
  const centrosOrdenados = useMemo(() => {
    return [...centros].sort((a, b) =>
      compararCentroTipoConta(
        {
          nome: '',
          centroNome: a.nome,
          centroCodigo: a.codigo,
          centroSequencia: a.sequencia,
        },
        {
          nome: '',
          centroNome: b.nome,
          centroCodigo: b.codigo,
          centroSequencia: b.sequencia,
        },
      ),
    )
  }, [centros])

  // Mapa de vínculo conta -> id do centro a partir de plano_contas
  const vinculoCentroPorConta = useMemo(() => {
    const map = new Map<string, string>()
    for (const p of planoContasRecords) {
      const contaId = p.conta || p.expand?.conta?.id
      const centroId = p.centro || p.expand?.centro?.id
      if (contaId && centroId) {
        map.set(contaId, centroId)
      }
    }
    return map
  }, [planoContasRecords])

  // Mapa de vínculo conta -> TipoDespesaRecord a partir de plano_contas
  const tipoDespesaPorConta = useMemo(() => {
    const map = new Map<string, TipoDespesaRecord>()
    for (const p of planoContasRecords) {
      const contaId = p.conta || p.expand?.conta?.id
      if (!contaId) continue
      if (p.expand?.tipo_despesa) {
        map.set(contaId, p.expand.tipo_despesa as TipoDespesaRecord)
      } else if (p.tipo_despesa) {
        const td = tipoDespesaMap.get(p.tipo_despesa)
        if (td) {
          map.set(contaId, td)
        }
      }
    }
    return map
  }, [planoContasRecords, tipoDespesaMap])

  // Contas com centro efetivo (vínculo plano_contas prioritário com fallback para conta.centro)
  // e suporte ao override otimista do drag & drop
  const contasComOverride = useMemo<ContaRecord[]>(() => {
    const temVinculosPlano = planoContasRecords.length > 0

    return contas.map((c) => {
      let centroEfetivo: string | undefined = c.centro
      if (temVinculosPlano) {
        centroEfetivo = vinculoCentroPorConta.get(c.id) || c.centro
      }

      if (c.id in centroOverride) {
        centroEfetivo = centroOverride[c.id] ?? undefined
      }

      return {
        ...c,
        centro: centroEfetivo,
      }
    })
  }, [contas, planoContasRecords.length, vinculoCentroPorConta, centroOverride])

  const contasOrdenadas = useMemo<ContaRecord[]>(() => {
    let lista = [...contasComOverride]
    if (ordemIds && ordemIds.length > 0) {
      const mapa = new Map(lista.map((c) => [c.id, c]))
      const naOrdem = ordemIds.map((id) => mapa.get(id)).filter(Boolean) as ContaRecord[]
      const fora = lista.filter((c) => !ordemIds.includes(c.id))
      fora.sort(compararContasDre)
      lista = [...naOrdem, ...fora]
    } else {
      lista.sort(compararContasDre)
    }
    return lista
  }, [contasComOverride, ordemIds])

  // Agrupamento completo por centro de custo (na ordem da sequência de centros)
  const todosGruposCentros = useMemo(() => {
    const mapa = new Map<string, ContaRecord[]>()
    for (const c of contasOrdenadas) {
      const k = c.centro || ''
      const arr = mapa.get(k) || []
      arr.push(c)
      mapa.set(k, arr)
    }

    const resultado: GrupoCentroItem[] = []

    // 1. Centros cadastrados ordenados (mantém todos os centros, mesmo vazios)
    for (const c of centrosOrdenados) {
      resultado.push({
        centroId: c.id,
        nome: c.nome,
        codigo: c.codigo,
        sequencia: c.sequencia ?? null,
        contas: mapa.get(c.id) || [],
      })
    }

    // 2. Contas sem centro de custo (ficam no final)
    const contasSemCentro = mapa.get('') || []
    if (contasSemCentro.length > 0) {
      resultado.push({
        centroId: null,
        nome: 'Sem Centro de Custo',
        codigo: null,
        sequencia: null,
        contas: contasSemCentro,
      })
    }

    return resultado
  }, [centrosOrdenados, contasOrdenadas])

  // Grupos filtrados pelo Seletor de Centro e Busca
  const gruposFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase()

    let base = todosGruposCentros

    // Filtro por seletor de centro de custo
    if (filtroCentro !== 'todos') {
      if (filtroCentro === 'sem_centro') {
        base = base.filter((g) => g.centroId === null)
      } else {
        base = base.filter((g) => g.centroId === filtroCentro)
      }
    }

    // Filtro por texto de busca (nome ou código da conta)
    if (q) {
      base = base
        .map((g) => ({
          ...g,
          contas: g.contas.filter(
            (c) =>
              c.nome.toLowerCase().includes(q) ||
              (c.codigo || '').toLowerCase().includes(q) ||
              (c.descricao || '').toLowerCase().includes(q) ||
              (c.grupo || '').toLowerCase().includes(q),
          ),
        }))
        .filter((g) => g.contas.length > 0)
    }

    return base
  }, [todosGruposCentros, filtroCentro, busca])

  const totalContasFiltradas = useMemo(() => {
    return gruposFiltrados.reduce((acc, g) => acc + g.contas.length, 0)
  }, [gruposFiltrados])

  // Drag & drop handlers
  const podeArrastar = podeEditar && !busca.trim() && !salvandoOrdem

  const limparArrasto = () => {
    setDragId(null)
    setDropTarget(null)
    setDropTargetCentro(null)
  }

  const concluirArrasto = async (alvoId: string, posicao: 'antes' | 'depois') => {
    const origemId = dragId
    limparArrasto()
    if (!origemId || origemId === alvoId) return

    const plano = gruposFiltrados.flatMap((g) => g.contas)
    const idxOrigem = plano.findIndex((c) => c.id === origemId)
    if (idxOrigem < 0) return
    const movida = plano[idxOrigem]

    const nova = [...plano]
    nova.splice(idxOrigem, 1)
    let idxDestino = nova.findIndex((c) => c.id === alvoId)
    if (idxDestino < 0) return
    if (posicao === 'depois') idxDestino += 1
    nova.splice(idxDestino, 0, movida)

    const ids = nova.map((c) => c.id)
    const grupoAlvo = gruposFiltrados.find((g) => g.contas.some((c) => c.id === alvoId))
    const centroNovo = grupoAlvo ? grupoAlvo.centroId : null
    const centroAnterior = movida.centro || null
    const trocouCentro = centroNovo !== centroAnterior

    setOrdemIds(ids)
    if (trocouCentro) {
      setCentroOverride((prev) => ({ ...prev, [movida.id]: centroNovo }))
    }

    setSalvandoOrdem(true)
    try {
      await contasService.reordenar(ids)
      if (trocouCentro) {
        await contasService.update(movida.id, { centro: centroNovo })

        // Se houver registro de plano_contas para a conta (empresa ativa), atualiza o centro desse vínculo
        const registroPlano = planoContasRecords.find(
          (p) => (p.conta || p.expand?.conta?.id) === movida.id,
        )
        if (registroPlano) {
          await planoContasService.update(registroPlano.id, { centro: centroNovo || '' })
        }
      }
      window.dispatchEvent(new CustomEvent('dre-contas-atualizado'))
      window.dispatchEvent(new CustomEvent('dre-contas-atualizadas'))
      await loadData()
      toast({
        title: 'Ordem atualizada',
        description: trocouCentro
          ? `"${movida.nome}" movida para "${grupoAlvo?.nome}" e ordem salva.`
          : 'A nova ordem das contas foi salva com sucesso.',
      })
    } catch (err: any) {
      setOrdemIds(null)
      if (trocouCentro) {
        setCentroOverride((prev) => {
          const cp = { ...prev }
          delete cp[movida.id]
          return cp
        })
      }
      toast({
        variant: 'destructive',
        title: 'Erro ao reordenar',
        description: err?.message || 'Falha ao salvar a nova ordem.',
      })
    } finally {
      setSalvandoOrdem(false)
    }
  }

  const concluirArrastoParaCentro = async (centroId: string | null) => {
    const origemId = dragId
    limparArrasto()
    if (!origemId) return

    const plano = gruposFiltrados.flatMap((g) => g.contas)
    const movida = plano.find((c) => c.id === origemId)
    if (!movida) return

    const centroAnterior = movida.centro || null
    const centroNovo = centroId || null
    if (centroNovo === centroAnterior) return

    const nova = plano.filter((c) => c.id !== origemId)
    const grupoAlvo = gruposFiltrados.find((g) => g.centroId === centroNovo)
    const ultimaConta = grupoAlvo?.contas[grupoAlvo.contas.length - 1]
    if (ultimaConta) {
      const idx = nova.findIndex((c) => c.id === ultimaConta.id)
      nova.splice(idx + 1, 0, movida)
    } else {
      nova.push(movida)
    }

    const ids = nova.map((c) => c.id)
    setOrdemIds(ids)
    setCentroOverride((prev) => ({ ...prev, [movida.id]: centroNovo }))

    setSalvandoOrdem(true)
    try {
      await contasService.reordenar(ids)
      await contasService.update(movida.id, { centro: centroNovo })

      // Se houver registro de plano_contas para a conta (empresa ativa), atualiza o centro desse vínculo
      const registroPlano = planoContasRecords.find(
        (p) => (p.conta || p.expand?.conta?.id) === movida.id,
      )
      if (registroPlano) {
        await planoContasService.update(registroPlano.id, { centro: centroNovo || '' })
      }

      window.dispatchEvent(new CustomEvent('dre-contas-atualizado'))
      window.dispatchEvent(new CustomEvent('dre-contas-atualizadas'))
      await loadData()
      toast({
        title: 'Conta movida de centro',
        description: `"${movida.nome}" movida para o centro selecionado.`,
      })
    } catch (err: any) {
      setOrdemIds(null)
      setCentroOverride((prev) => {
        const cp = { ...prev }
        delete cp[movida.id]
        return cp
      })
      toast({
        variant: 'destructive',
        title: 'Erro ao mover conta',
        description: err?.message || 'Falha ao transferir a conta.',
      })
    } finally {
      setSalvandoOrdem(false)
    }
  }

  // Abrir edição da conta
  const openEdit = (c: ContaRecord) => {
    if (isCliente) return
    setEditingConta(c)
    const tdVinculado = tipoDespesaPorConta.get(c.id)
    setEditForm({
      nome: c.nome,
      tipo: c.tipo,
      grupo: c.grupo || '',
      centro: c.centro || '',
      descricao: c.descricao || '',
      classificacao_dre: c.classificacao_dre || '',
      tipo_despesa: tdVinculado?.id || '',
      nao_exibir_dre: !!c.nao_exibir_dre,
      nao_exibir_fluxo_caixa: !!c.nao_exibir_fluxo_caixa,
      nao_exibir_em_nada: !!c.nao_exibir_em_nada,
    })
    setEditErrors({})
    setEditOpen(true)
  }

  const handleFieldChange = (campo: keyof ContaEdicaoForm, valor: any) => {
    setEditForm((prev) => ({ ...prev, [campo]: valor }))
    if (editErrors[campo as keyof typeof editErrors]) {
      setEditErrors((prev) => ({ ...prev, [campo]: undefined }))
    }
  }

  const handleSaveConta = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingConta) return
    if (!editForm.nome.trim()) {
      setEditErrors({ nome: 'O nome da conta é obrigatório.' })
      return
    }

    setSavingEdit(true)
    try {
      await contasService.update(editingConta.id, {
        nome: editForm.nome.trim(),
        tipo: editForm.tipo,
        grupo: editForm.grupo.trim() || undefined,
        centro: editForm.centro || null,
        descricao: editForm.descricao.trim() || undefined,
        classificacao_dre: (editForm.classificacao_dre as ClassificacaoDre) || undefined,
        nao_exibir_dre: editForm.nao_exibir_dre,
        nao_exibir_fluxo_caixa: editForm.nao_exibir_fluxo_caixa,
        nao_exibir_em_nada: editForm.nao_exibir_em_nada,
      })

      // Se houver registro de plano_contas para a conta, atualiza o centro e tipo_despesa no vínculo também
      const registroPlano = planoContasRecords.find(
        (p) => (p.conta || p.expand?.conta?.id) === editingConta.id,
      )
      if (registroPlano) {
        await planoContasService.update(registroPlano.id, {
          centro: editForm.centro || '',
          tipo_despesa: editForm.tipo_despesa || '',
        })
      } else if (editForm.centro) {
        // Se ainda não existia vínculo em plano_contas para a empresa ativa, cria agora
        await planoContasService.create({
          empresa: effectiveEmpresaId || undefined,
          conta: editingConta.id,
          centro: editForm.centro,
          tipo_despesa: editForm.tipo_despesa || undefined,
          descricao: editForm.descricao.trim() || undefined,
        })
      }

      window.dispatchEvent(new CustomEvent('dre-contas-atualizado'))
      window.dispatchEvent(new CustomEvent('dre-contas-atualizadas'))
      toast({
        title: 'Conta atualizada',
        description: `"${editForm.nome}" atualizada com sucesso.`,
      })
      setEditOpen(false)
      setEditingConta(null)
      loadData()
    } catch (err: any) {
      console.error('Erro ao atualizar conta:', err)
      setEditErrors((prev) => ({
        ...prev,
        general: err?.message || 'Falha ao salvar conta.',
      }))
    } finally {
      setSavingEdit(false)
    }
  }

  const confirmDelete = (c: ContaRecord) => {
    setToDeleteConta(c)
    setDeleteOpen(true)
  }

  const handleDeleteConta = async () => {
    if (!toDeleteConta) return
    setDeleting(true)
    try {
      await contasService.delete(toDeleteConta.id)
      window.dispatchEvent(new CustomEvent('dre-contas-atualizado'))
      window.dispatchEvent(new CustomEvent('dre-contas-atualizadas'))
      toast({
        title: 'Conta removida',
        description: `"${toDeleteConta.nome}" foi excluída.`,
      })
      setDeleteOpen(false)
      setToDeleteConta(null)
      if (editingConta?.id === toDeleteConta.id) {
        setEditOpen(false)
        setEditingConta(null)
      }
      loadData()
    } catch (err: any) {
      console.error(err)
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir conta',
        description: err?.message || 'Não foi possível excluir a conta.',
      })
    } finally {
      setDeleting(false)
    }
  }

  // Exportação CSV na mesma ordem da listagem filtrada
  const handleExportCsv = () => {
    const dataStr = new Date().toISOString().slice(0, 10)
    const safeEmpresa = selectedEmpresa?.nome
      ? selectedEmpresa.nome
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-zA-Z0-9_-]/g, '-')
          .toLowerCase()
      : 'empresa'
    const fileName = `plano-contas-${safeEmpresa}-${dataStr}.csv`

    const escapeCsv = (val: string | number | undefined | null): string => {
      if (val === null || val === undefined) return ''
      const s = String(val)
      if (/[;"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
      return s
    }

    const colunas = [
      'Sequência Centro',
      'Código Centro',
      'Centro de Custo',
      'Código da Conta',
      'Nome da Conta',
      'Tipo',
      'Classificação DRE',
      'Tipo de Despesa',
      'Grupo',
      'Ordem',
      'Descrição',
    ]

    const linhas: string[] = [colunas.map(escapeCsv).join(';')]

    for (const grupo of gruposFiltrados) {
      for (const c of grupo.contas) {
        const td = tipoDespesaPorConta.get(c.id)
        const tipoDespesaStr = td ? (td.codigo ? `[${td.codigo}] ${td.nome}` : td.nome) : '—'

        linhas.push(
          [
            grupo.sequencia != null ? String(grupo.sequencia) : '—',
            grupo.codigo || '—',
            grupo.nome,
            c.codigo || '—',
            c.nome,
            c.tipo,
            c.classificacao_dre || '—',
            tipoDespesaStr,
            c.grupo || '—',
            c.ordem != null ? String(c.ordem) : '—',
            c.descricao || '',
          ]
            .map(escapeCsv)
            .join(';'),
        )
      }
    }

    const csvContent = '\uFEFF' + linhas.join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.setAttribute('download', fileName)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(link.href)

    toast({
      title: 'Plano de Contas exportado',
      description: `CSV gerado com ${totalContasFiltradas} conta(s) na ordem da listagem.`,
    })
  }

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto">
      {/* ============ CABEÇALHO DA TELA ============ */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-600/10 text-blue-700 flex items-center justify-center shrink-0">
              <FolderTree className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-[#0B1F3A]">Plano de Contas</h1>
              <p className="text-xs text-slate-500">
                Estrutura contábil organizada pela sequência do Centro de Custo com ordenação manual
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {podeEditar && (
            <>
              <Button
                variant="default"
                size="sm"
                onClick={() => setModalNovaContaOpen(true)}
                className="text-xs h-9 bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-xs"
                title="Cadastrar uma nova conta vinculada ao centro de custo"
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                Nova Conta
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setModalModeloPadraoOpen(true)}
                className="text-xs h-9 border-amber-300 bg-amber-50/50 text-amber-900 hover:bg-amber-100/70"
                title="Copiar estrutura padrão recomendada de plano de contas"
              >
                <Sparkles className="w-3.5 h-3.5 mr-1.5 text-amber-600" />
                Modelo Padrão
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setModalImportarOpen(true)}
                className="text-xs h-9"
                title="Importar plano de contas via planilha Excel ou CSV"
              >
                <Upload className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
                Importar Excel
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setModalCopiarEmpresasOpen(true)}
                className="text-xs h-9"
                title="Copiar plano de contas de outra empresa cadastrada"
              >
                <Copy className="w-3.5 h-3.5 mr-1.5 text-purple-600" />
                Copiar Empresa
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setModalCompararOpen(true)}
                className="text-xs h-9"
                title="Comparar estrutura do plano de contas entre duas empresas"
              >
                <Layers className="w-3.5 h-3.5 mr-1.5 text-slate-600" />
                Comparar
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setModalLoteCodigosOpen(true)}
                className="text-xs h-9"
                title="Editar códigos internos da empresa em lote"
              >
                <Pencil className="w-3.5 h-3.5 mr-1.5 text-indigo-600" />
                Editar Códigos
              </Button>
            </>
          )}

          <Button
            variant="default"
            size="sm"
            onClick={handleExportCsv}
            disabled={loading || totalContasFiltradas === 0}
            className="text-xs h-9 bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
            title="Exportar listagem completa em CSV na mesma ordem da tela"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {/* ============ BARRA DE FILTROS & SELETOR DE CENTRO ============ */}
      <Card className="shadow-xs border-slate-200 bg-white">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-center">
            {/* Seletor de Centro de Custo */}
            <div className="lg:col-span-5 space-y-1">
              <label className="text-[11px] font-semibold text-slate-700 flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-blue-600" />
                Centro de Custo
              </label>
              <Select value={filtroCentro} onValueChange={setFiltroCentro}>
                <SelectTrigger className="h-9 text-xs bg-slate-50/70 border-slate-200">
                  <SelectValue placeholder="Filtrar por centro..." />
                </SelectTrigger>
                <SelectContent className="max-h-80">
                  <SelectItem value="todos" className="text-xs font-semibold">
                    Todos os Centros de Custo ({contas.length} contas)
                  </SelectItem>
                  {centrosOrdenados.map((c) => {
                    const qtd = contas.filter((item) => item.centro === c.id).length
                    const seqStr = c.sequencia != null ? `#${c.sequencia} · ` : ''
                    const codStr = c.codigo ? `[${c.codigo}] ` : ''
                    return (
                      <SelectItem key={c.id} value={c.id} className="text-xs">
                        {seqStr}
                        {codStr}
                        {c.nome} ({qtd})
                      </SelectItem>
                    )
                  })}
                  {contas.some((item) => !item.centro) && (
                    <SelectItem value="sem_centro" className="text-xs text-amber-700 font-medium">
                      Sem Centro de Custo ({contas.filter((item) => !item.centro).length})
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Campo de Busca textual */}
            <div className="lg:col-span-5 space-y-1">
              <label className="text-[11px] font-semibold text-slate-700 flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-slate-500" />
                Buscar Conta
              </label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <Input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Nome, código, grupo ou descrição..."
                  className="h-9 text-xs pl-8 bg-slate-50/70 border-slate-200"
                />
              </div>
            </div>

            {/* Botão de Limpar / Recarregar */}
            <div className="lg:col-span-2 flex items-end gap-2 pt-1 lg:pt-5">
              {(filtroCentro !== 'todos' || busca) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFiltroCentro('todos')
                    setBusca('')
                  }}
                  className="text-xs h-9 text-slate-600 hover:text-slate-900"
                >
                  Limpar
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={loadData}
                disabled={loading}
                className="text-xs h-9 ml-auto text-slate-600"
                title="Recarregar dados"
              >
                <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ============ LISTAGEM AGRUPADA POR CENTRO DE CUSTO ============ */}
      <Card className="shadow-xs border-slate-200 bg-white">
        <CardHeader className="pb-3 border-b border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
                <span>Contas Agrupadas por Centro de Custo</span>
                <Badge variant="outline" className="text-[11px] font-mono font-semibold">
                  {totalContasFiltradas} conta(s)
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 mt-0.5">
                {podeEditar
                  ? 'Arraste pelo cabo (⋮⋮) para reordenar ou solte sobre outro centro para transferir. Clique no número da conta para editar.'
                  : 'Perfil cliente com acesso somente para visualização dos registros.'}
              </CardDescription>
            </div>

            {podeEditar && !busca && (
              <Badge className="text-[10px] font-normal bg-blue-50 text-blue-700 border-blue-200">
                Drag & Drop Ativo
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center text-center">
              <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-xs text-slate-500">Carregando plano de contas...</p>
            </div>
          ) : totalContasFiltradas === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center text-center px-4">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
                <FolderTree className="w-7 h-7 text-slate-400" />
              </div>
              <h3 className="text-sm font-bold text-[#0B1F3A]">Nenhuma conta encontrada</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                {busca || filtroCentro !== 'todos'
                  ? 'Nenhum resultado corresponde aos filtros selecionados. Tente limpar os filtros.'
                  : 'Ainda não há contas cadastradas. Use os botões acima para aplicar o Modelo Padrão ou importar de uma planilha.'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {gruposFiltrados.map((grupo) => {
                const isTargetCentro = dropTargetCentro === grupo.centroId
                return (
                  <div
                    key={grupo.centroId || 'sem_centro'}
                    onDragOver={(e) => {
                      if (!dragId || !podeArrastar) return
                      e.preventDefault()
                      e.dataTransfer.dropEffect = 'move'
                      setDropTargetCentro(grupo.centroId)
                    }}
                    onDragLeave={() => {
                      if (dropTargetCentro === grupo.centroId) setDropTargetCentro(null)
                    }}
                    onDrop={async (e) => {
                      e.preventDefault()
                      if (!dragId || !podeArrastar) return
                      await concluirArrastoParaCentro(grupo.centroId)
                    }}
                    className={cn(
                      'transition-colors',
                      isTargetCentro && 'bg-blue-50/60 ring-2 ring-blue-400',
                    )}
                  >
                    {/* Cabeçalho do Grupo (Centro de Custo) */}
                    <div className="bg-slate-50/90 px-4 py-2.5 flex items-center justify-between border-b border-slate-200">
                      <div className="flex items-center gap-2">
                        <Folder className="w-4 h-4 text-blue-700 shrink-0" />
                        <span className="text-xs font-bold text-[#0B1F3A]">
                          {grupo.sequencia != null ? `#${grupo.sequencia} · ` : ''}
                          {grupo.nome}
                        </span>
                        {grupo.codigo && (
                          <span className="text-[11px] font-mono text-slate-500">
                            ({grupo.codigo})
                          </span>
                        )}
                      </div>
                      <Badge variant="outline" className="text-[10px] font-semibold bg-white">
                        {grupo.contas.length} conta(s)
                      </Badge>
                    </div>

                    {/* Tabela de Contas deste Centro */}
                    <DoubleHorizontalScroll>
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-slate-100 bg-white text-slate-500 font-semibold text-[11px]">
                            {podeEditar && <th className="py-2 px-2 w-8 text-center" />}
                            <th className="py-2 px-3 w-28">Código</th>
                            <th className="py-2 px-3">Nome da Conta</th>
                            <th className="py-2 px-3 w-28">Tipo</th>
                            <th className="py-2 px-3 w-36">Classificação DRE</th>
                            <th className="py-2 px-3 w-40">Tipo de Despesa</th>
                            <th className="py-2 px-3 w-36">Grupo</th>
                            <th className="py-2 px-3 text-right w-20">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {grupo.contas.map((c) => {
                            const isDragging = dragId === c.id
                            const isDropTarget = dropTarget?.id === c.id
                            return (
                              <tr
                                key={c.id}
                                draggable={podeArrastar}
                                onDragStart={() => podeArrastar && setDragId(c.id)}
                                onDragEnd={limparArrasto}
                                onDragOver={(e) => {
                                  if (!dragId || dragId === c.id || !podeArrastar) return
                                  e.preventDefault()
                                  e.dataTransfer.dropEffect = 'move'
                                  const rect = (
                                    e.currentTarget as HTMLElement
                                  ).getBoundingClientRect()
                                  const posicao =
                                    e.clientY < rect.top + rect.height / 2 ? 'antes' : 'depois'
                                  setDropTarget({ id: c.id, posicao })
                                }}
                                onDrop={async (e) => {
                                  e.preventDefault()
                                  if (!dragId || dragId === c.id || !podeArrastar) return
                                  const posicao =
                                    dropTarget?.id === c.id ? dropTarget.posicao : 'antes'
                                  await concluirArrasto(c.id, posicao)
                                }}
                                className={cn(
                                  'hover:bg-slate-50/80 transition-colors bg-white',
                                  isDragging && 'opacity-30 bg-blue-50',
                                  isDropTarget &&
                                    dropTarget.posicao === 'antes' &&
                                    'border-t-2 border-t-blue-500',
                                  isDropTarget &&
                                    dropTarget.posicao === 'depois' &&
                                    'border-b-2 border-b-blue-500',
                                )}
                              >
                                {podeEditar && (
                                  <td className="py-2 px-2 text-center">
                                    <span
                                      className={cn(
                                        'inline-flex p-1 rounded text-slate-400 hover:text-blue-600',
                                        podeArrastar
                                          ? 'cursor-grab active:cursor-grabbing hover:bg-blue-50'
                                          : 'cursor-not-allowed opacity-40',
                                      )}
                                      title={
                                        podeArrastar
                                          ? 'Arraste para reordenar'
                                          : 'Reordenação desabilitada durante filtro'
                                      }
                                    >
                                      <GripVertical className="w-3.5 h-3.5" />
                                    </span>
                                  </td>
                                )}

                                <td className="py-2 px-3">
                                  <button
                                    type="button"
                                    onClick={() => openEdit(c)}
                                    disabled={!podeEditar}
                                    className={cn(
                                      'font-mono font-semibold text-[11px] text-left transition-colors',
                                      podeEditar
                                        ? 'text-blue-700 hover:text-blue-900 hover:underline cursor-pointer'
                                        : 'text-slate-700 cursor-default',
                                    )}
                                    title={
                                      podeEditar
                                        ? `Clique no número para editar a conta ${c.nome}`
                                        : `Conta ${c.codigo || '—'}`
                                    }
                                  >
                                    {c.codigo || '—'}
                                  </button>
                                </td>

                                <td className="py-2 px-3">
                                  <div className="font-semibold text-slate-900 truncate max-w-md">
                                    {c.nome}
                                  </div>
                                  {c.descricao && (
                                    <div className="text-[10px] text-slate-500 truncate max-w-md">
                                      {c.descricao}
                                    </div>
                                  )}
                                </td>

                                <td className="py-2 px-3">
                                  <Badge
                                    className={cn(
                                      'text-[10px] font-semibold px-2 py-0.5 border',
                                      TIPO_BADGE[c.tipo] || '',
                                    )}
                                  >
                                    {c.tipo}
                                  </Badge>
                                </td>

                                <td className="py-2 px-3">
                                  {c.classificacao_dre ? (
                                    <Badge className="text-[10px] font-semibold px-2 py-0.5 border bg-emerald-50 text-emerald-800 border-emerald-200">
                                      {c.classificacao_dre}
                                    </Badge>
                                  ) : (
                                    <span className="text-[10.5px] text-slate-400 italic">
                                      Não classificada
                                    </span>
                                  )}
                                </td>

                                <td className="py-2 px-3">
                                  {(() => {
                                    const td = tipoDespesaPorConta.get(c.id)
                                    if (td) {
                                      return (
                                        <Badge
                                          variant="outline"
                                          className="text-[10px] font-medium px-2 py-0.5 bg-slate-50 text-slate-700 border-slate-200 truncate max-w-[150px]"
                                          title={td.nome}
                                        >
                                          {td.codigo ? `[${td.codigo}] ` : ''}
                                          {td.nome}
                                        </Badge>
                                      )
                                    }
                                    return <span className="text-[11px] text-slate-400">—</span>
                                  })()}
                                </td>

                                <td className="py-2 px-3 text-slate-600 text-xs truncate max-w-xs">
                                  {c.grupo || '—'}
                                </td>

                                <td className="py-2 px-3 text-right">
                                  {podeEditar ? (
                                    <div className="flex items-center justify-end gap-1">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => openEdit(c)}
                                        className="h-7 w-7 p-0 text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                                        title="Editar conta"
                                      >
                                        <Pencil className="w-3 h-3" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => confirmDelete(c)}
                                        className="h-7 w-7 p-0 text-slate-500 hover:text-red-600 hover:bg-red-50"
                                        title="Excluir conta"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </Button>
                                    </div>
                                  ) : (
                                    <span className="text-[10px] text-slate-400">Leitura</span>
                                  )}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </DoubleHorizontalScroll>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ============ MODAL RÁPIDO DE NOVA CONTA ============ */}
      {podeEditar && (
        <ModalQuickRegisterConta
          open={modalNovaContaOpen}
          onOpenChange={setModalNovaContaOpen}
          empresaId={effectiveEmpresaId}
          centros={centrosOrdenados}
          tiposDespesas={tiposDespesa}
          initialCentroId={
            filtroCentro && filtroCentro !== 'todos' && filtroCentro !== 'sem_centro'
              ? filtroCentro
              : undefined
          }
          onSuccess={async (novoPlano) => {
            // Se o novo plano de contas foi criado sem empresa e temos empresa ativa,
            // garantimos que o vínculo seja associado à empresa ativa
            if (novoPlano && effectiveEmpresaId && !novoPlano.empresa) {
              try {
                await planoContasService.update(novoPlano.id, { empresa: effectiveEmpresaId })
              } catch (err) {
                console.warn('Aviso ao associar empresa ao plano recém-criado:', err)
              }
            }
            window.dispatchEvent(new CustomEvent('dre-contas-atualizado'))
            window.dispatchEvent(new CustomEvent('dre-contas-atualizadas'))
            await loadData()
          }}
        />
      )}

      {/* ============ DIÁLOGO GRANDE DE EDIÇÃO DA CONTA ============ */}
      <DialogEditarConta
        open={editOpen}
        onOpenChange={setEditOpen}
        conta={editingConta}
        contas={contas}
        centros={centros}
        tiposDespesa={tiposDespesa}
        isCliente={isCliente}
        saving={savingEdit}
        errors={editErrors}
        form={editForm}
        onFieldChange={handleFieldChange}
        onSave={handleSaveConta}
        onDelete={confirmDelete}
        onSelectConta={openEdit}
        onReordenar={async (ids, movida) => {
          await contasService.reordenar(ids)
          if (movida) {
            await contasService.update(movida.id, { centro: movida.centro })
            const registroPlano = planoContasRecords.find(
              (p) => (p.conta || p.expand?.conta?.id) === movida.id,
            )
            if (registroPlano) {
              await planoContasService.update(registroPlano.id, { centro: movida.centro || '' })
            }
          }
          window.dispatchEvent(new CustomEvent('dre-contas-atualizado'))
          window.dispatchEvent(new CustomEvent('dre-contas-atualizadas'))
          await loadData()
        }}
      />

      {/* ============ MODAL DE CONFIRMAÇÃO DE EXCLUSÃO ============ */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-red-600 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" /> Excluir Conta?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-600">
              Tem certeza que deseja remover a conta{' '}
              <strong className="text-slate-900">{toDeleteConta?.nome}</strong> (
              {toDeleteConta?.codigo || 'sem código'})? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting} className="text-xs h-8">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConta}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white text-xs h-8 font-semibold"
            >
              {deleting ? 'Excluindo...' : 'Sim, Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ============ MODAL COPIAR MODELO PADRÃO ============ */}
      <ModalCopiarModeloPadrao
        open={modalModeloPadraoOpen}
        onOpenChange={setModalModeloPadraoOpen}
        selectedEmpresa={selectedEmpresa}
        totalContasEmpresaAtual={contas.length}
        onSuccess={loadData}
      />

      {/* ============ MODAL IMPORTAR PLANO DE CONTAS ============ */}
      <ModalImportarPlanoContas
        open={modalImportarOpen}
        onOpenChange={setModalImportarOpen}
        selectedEmpresa={selectedEmpresa}
        totalContasEmpresaAtual={contas.length}
        onSuccess={loadData}
      />

      {/* ============ MODAL COPIAR PLANO ENTRE EMPRESAS ============ */}
      <ModalCopiarPlanoEmpresas
        open={modalCopiarEmpresasOpen}
        onOpenChange={setModalCopiarEmpresasOpen}
        empresas={empresas}
        empresaDestinoPadraoId={selectedEmpresaId}
        onSuccess={loadData}
      />

      {/* ============ MODAL COMPARAR PLANOS DE CONTAS ============ */}
      <ModalCompararPlanos
        open={modalCompararOpen}
        onOpenChange={setModalCompararOpen}
        empresas={empresas}
        empresaInicialId={selectedEmpresaId}
      />

      {/* ============ MODAL EDIÇÃO EM LOTE DE CÓDIGOS ============ */}
      <ModalEdicaoLoteCodigos
        open={modalLoteCodigosOpen}
        onOpenChange={setModalLoteCodigosOpen}
        planoContas={planoContasRecords}
        selectedEmpresa={selectedEmpresa}
        contaMap={contaMap}
        centroMap={centroMap}
        onSuccess={loadData}
      />
    </div>
  )
}
