import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Network,
  Building2,
  Plus,
  Search,
  Edit2,
  Trash2,
  Check,
  AlertCircle,
  Eye,
  Layers,
  ArrowRight,
  RotateCw,
  Users,
  Shield,
  FileText,
  AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import { useToast } from '@/hooks/use-toast'
import { useFilter } from '@/contexts/FilterContext'
import { useMinhaEmpresa } from '@/contexts/MinhaEmpresaContext'
import { useRealtime } from '@/hooks/use-realtime'
import { gruposEmpresariaisService, empresasService } from '@/services/financeService'
import { usuariosService } from '@/services/usuariosService'
import type { GrupoEmpresarialRecord, EmpresaRecord, UserRecord } from '@/types/finance'
import { ModalRelatorioConsolidadoGrupoA4 } from '@/components/ModalRelatorioConsolidadoGrupoA4'
import { extractUserGruposIds } from '@/lib/vinculosEmpresas'

function formatCnpj(v: string) {
  if (!v) return ''
  const d = v.replace(/\D/g, '')
  if (d.length !== 14) return v
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
}

export default function GruposEmpresariais() {
  const { toast } = useToast()
  const navigate = useNavigate()
  const { setSelectedEmpresaId, reloadEmpresas, selectedAno } = useFilter()
  const { minhaEmpresa, logoUrl } = useMinhaEmpresa()

  const [grupos, setGrupos] = useState<GrupoEmpresarialRecord[]>([])
  const [empresas, setEmpresas] = useState<EmpresaRecord[]>([])
  const [usuarios, setUsuarios] = useState<UserRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  // Modal formulário (Criar / Editar)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingGrupo, setEditingGrupo] = useState<GrupoEmpresarialRecord | null>(null)
  const [nomeGrupo, setNomeGrupo] = useState('')
  const [descricaoGrupo, setDescricaoGrupo] = useState('')
  const [selectedEmpresasIds, setSelectedEmpresasIds] = useState<string[]>([])
  const [buscaEmpresaModal, setBuscaEmpresaModal] = useState('')
  const [saving, setSaving] = useState(false)
  const [formErrors, setFormErrors] = useState<{ nome?: string; empresas?: string }>({})

  // Modal Relatório Consolidado A4 em PDF
  const [modalPdfConsolidadoOpen, setModalPdfConsolidadoOpen] = useState(false)
  const [grupoParaRelatorio, setGrupoParaRelatorio] = useState<GrupoEmpresarialRecord | null>(null)

  // Modal confirmação de exclusão
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [grupoToDelete, setGrupoToDelete] = useState<GrupoEmpresarialRecord | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadData = async () => {
    try {
      setLoading(true)
      const [gruposList, empresasList, usuariosList] = await Promise.all([
        gruposEmpresariaisService.getAll(),
        empresasService.getAll(),
        usuariosService.getAll().catch((err) => {
          console.warn('Não foi possível carregar usuários na tela de grupos:', err)
          return [] as UserRecord[]
        }),
      ])
      setGrupos(gruposList)
      setEmpresas(empresasList)
      setUsuarios(usuariosList)
    } catch (err) {
      console.error('Erro ao carregar dados da gestão de grupos:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar dados',
        description: 'Não foi possível carregar a listagem de grupos empresariais.',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useRealtime<GrupoEmpresarialRecord>('grupos_empresariais', () => {
    loadData()
    reloadEmpresas()
  })

  // Mapeamento de usuários vinculados por grupo
  const usuariosPorGrupo = useMemo(() => {
    const map = new Map<string, UserRecord[]>()
    for (const g of grupos) {
      map.set(g.id, [])
    }
    for (const u of usuarios) {
      // Usuários admin têm acesso global, mas verificamos vínculos explícitos do campo grupos_empresariais
      const gIds = extractUserGruposIds(u as any)
      for (const gid of gIds) {
        const arr = map.get(gid)
        if (arr) {
          arr.push(u)
        } else {
          map.set(gid, [u])
        }
      }
    }
    return map
  }, [grupos, usuarios])

  const openCreateModal = () => {
    setEditingGrupo(null)
    setNomeGrupo('')
    setDescricaoGrupo('')
    setSelectedEmpresasIds([])
    setBuscaEmpresaModal('')
    setFormErrors({})
    setModalOpen(true)
  }

  const openEditModal = (grupo: GrupoEmpresarialRecord) => {
    setEditingGrupo(grupo)
    setNomeGrupo(grupo.nome || '')
    setDescricaoGrupo(grupo.descricao || '')
    setSelectedEmpresasIds(grupo.empresas || [])
    setBuscaEmpresaModal('')
    setFormErrors({})
    setModalOpen(true)
  }

  const toggleEmpresaSelection = (empresaId: string) => {
    setSelectedEmpresasIds((prev) =>
      prev.includes(empresaId) ? prev.filter((id) => id !== empresaId) : [...prev, empresaId],
    )
    if (formErrors.empresas) {
      setFormErrors((prev) => ({ ...prev, empresas: undefined }))
    }
  }

  const selectAllEmpresas = () => {
    setSelectedEmpresasIds(empresas.map((e) => e.id))
    if (formErrors.empresas) {
      setFormErrors((prev) => ({ ...prev, empresas: undefined }))
    }
  }

  const deselectAllEmpresas = () => {
    setSelectedEmpresasIds([])
    if (formErrors.empresas) {
      setFormErrors((prev) => ({ ...prev, empresas: undefined }))
    }
  }

  const handleSaveGrupo = async (e: React.FormEvent) => {
    e.preventDefault()

    const errors: { nome?: string; empresas?: string } = {}
    if (!nomeGrupo.trim() || nomeGrupo.trim().length < 2) {
      errors.nome = 'O nome do grupo deve ter pelo menos 2 caracteres.'
    }
    if (selectedEmpresasIds.length === 0) {
      errors.empresas = 'Selecione pelo menos uma empresa participante para o grupo.'
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      return
    }

    setSaving(true)
    try {
      if (editingGrupo) {
        await gruposEmpresariaisService.update(editingGrupo.id, {
          nome: nomeGrupo,
          descricao: descricaoGrupo,
          empresas: selectedEmpresasIds,
        })
        toast({
          title: 'Grupo de empresas atualizado!',
          description: `O grupo "${nomeGrupo}" foi atualizado com ${selectedEmpresasIds.length} empresas.`,
        })
      } else {
        const novo = await gruposEmpresariaisService.create({
          nome: nomeGrupo,
          descricao: descricaoGrupo,
          empresas: selectedEmpresasIds,
        })
        toast({
          title: 'Grupo de empresas criado!',
          description: `O grupo "${novo.nome}" foi criado com sucesso com ${selectedEmpresasIds.length} empresas.`,
        })
      }

      setModalOpen(false)
      await loadData()
      await reloadEmpresas()
    } catch (err: any) {
      console.error('Erro ao salvar grupo:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar grupo',
        description: err?.message || 'Ocorreu um erro ao processar a operação.',
      })
    } finally {
      setSaving(false)
    }
  }

  const confirmDeleteGrupo = (grupo: GrupoEmpresarialRecord) => {
    setGrupoToDelete(grupo)
    setDeleteConfirmOpen(true)
  }

  const handleDeleteGrupo = async () => {
    if (!grupoToDelete) return
    setDeleting(true)
    try {
      await gruposEmpresariaisService.delete(grupoToDelete.id)
      toast({
        title: 'Grupo de empresas removido',
        description: `O grupo "${grupoToDelete.nome}" foi removido e os vínculos foram desassociados sem quebrar acessos.`,
      })
      setDeleteConfirmOpen(false)
      setGrupoToDelete(null)
      await loadData()
      await reloadEmpresas()
    } catch (err: any) {
      console.error('Erro ao excluir grupo:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir',
        description: err?.message || 'Não foi possível remover o grupo de empresas.',
      })
    } finally {
      setDeleting(false)
    }
  }

  const handleVerConsolidado = (grupo: GrupoEmpresarialRecord) => {
    setSelectedEmpresaId(`grupo-${grupo.id}`)
    toast({
      title: 'Visão consolidada ativada',
      description: `Agora visualizando o grupo consolidado "${grupo.nome}".`,
    })
    navigate('/dashboard')
  }

  const handleOpenRelatorioConsolidado = (grupo: GrupoEmpresarialRecord) => {
    setGrupoParaRelatorio(grupo)
    setModalPdfConsolidadoOpen(true)
  }

  // Filtragem dos grupos na lista
  const filteredGrupos = useMemo(() => {
    const q = searchTerm.toLowerCase().trim()
    if (!q) return grupos
    return grupos.filter((g) => {
      const matchNome = g.nome.toLowerCase().includes(q)
      const matchDesc = (g.descricao || '').toLowerCase().includes(q)
      const empExpand = g.expand?.empresas || []
      const matchEmpresas = empExpand.some(
        (emp) =>
          emp.nome.toLowerCase().includes(q) ||
          (emp.nome_fantasia || '').toLowerCase().includes(q) ||
          emp.cnpj.includes(q),
      )
      return matchNome || matchDesc || matchEmpresas
    })
  }, [grupos, searchTerm])

  // Lista de empresas filtrada para o modal de seleção
  const filteredEmpresasModal = useMemo(() => {
    const q = buscaEmpresaModal.toLowerCase().trim()
    if (!q) return empresas
    return empresas.filter(
      (emp) =>
        emp.nome.toLowerCase().includes(q) ||
        (emp.nome_fantasia || '').toLowerCase().includes(q) ||
        emp.cnpj.includes(q) ||
        (emp.segmento || '').toLowerCase().includes(q),
    )
  }, [empresas, buscaEmpresaModal])

  // Mapeamento rápido de empresas por ID para fácil exibição
  const empresasMap = useMemo(() => {
    const map = new Map<string, EmpresaRecord>()
    empresas.forEach((e) => map.set(e.id, e))
    return map
  }, [empresas])

  // Total de empresas participantes únicas em todos os grupos
  const totalEmpresasEmGrupos = useMemo(() => {
    const set = new Set<string>()
    grupos.forEach((g) => (g.empresas || []).forEach((id) => set.add(id)))
    return set.size
  }, [grupos])

  return (
    <div className="space-y-6 animate-fadeIn max-w-7xl mx-auto">
      {/* Top Header estilo Admin */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#0B1F3A] tracking-tight flex items-center gap-2">
            <Network className="w-6 h-6 text-purple-600" />
            Gerenciamento de Grupos de Empresas
          </h1>
          <p className="text-xs sm:text-sm text-[#5B6B7F] mt-1">
            Crie e gerencie Grupos Econômicos, vincule empresas participantes e controle os usuários
            com acesso consolidado.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loading}
            className="border-slate-300 hover:bg-slate-100 text-xs h-9"
          >
            <RotateCw className={`w-4 h-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button
            size="sm"
            onClick={openCreateModal}
            className="bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs h-9 shadow-xs"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Novo Grupo
          </Button>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="bg-white border-slate-200 shadow-2xs">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Total de Grupos
              </p>
              <h3 className="text-xl font-extrabold text-[#0B1F3A] mt-0.5">{grupos.length}</h3>
            </div>
            <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600 shrink-0">
              <Network className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200 shadow-2xs">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Empresas em Grupos
              </p>
              <h3 className="text-xl font-extrabold text-blue-700 mt-0.5">
                {totalEmpresasEmGrupos}
              </h3>
            </div>
            <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
              <Building2 className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200 shadow-2xs">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Total de Empresas
              </p>
              <h3 className="text-xl font-extrabold text-slate-800 mt-0.5">{empresas.length}</h3>
            </div>
            <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
              <Building2 className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200 shadow-2xs">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Usuários Vinculados
              </p>
              <h3 className="text-xl font-extrabold text-emerald-700 mt-0.5">
                {
                  usuarios.filter((u) => {
                    const gIds = extractUserGruposIds(u as any)
                    return gIds.length > 0
                  }).length
                }
              </h3>
            </div>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
              <Users className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dica Informativa de Consolidação & Permissões */}
      <div className="bg-gradient-to-r from-purple-50/90 via-indigo-50/70 to-slate-50 border border-purple-200/70 rounded-xl p-4 flex items-start gap-3">
        <div className="p-2 rounded-lg bg-purple-600 text-white shrink-0 mt-0.5 shadow-xs">
          <Layers className="w-4 h-4" />
        </div>
        <div className="space-y-1">
          <h2 className="text-xs font-bold text-purple-950">
            Grupos Econômicos & Permissões por Grupo
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            Ao vincular empresas a um grupo, seus balancetes e demonstrativos contábeis somam em
            tempo real nas análises consolidadas. Em{' '}
            <strong className="text-purple-900 font-semibold">Usuários & Permissões</strong>, você
            pode vincular usuários diretamente aos grupos criados aqui: com isso, o usuário ganha
            acesso automático a todas as empresas-membro do grupo.
          </p>
        </div>
      </div>

      {/* Barra de Busca e Filtros */}
      <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            placeholder="Buscar grupo por nome, descrição ou empresa participante..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9 text-xs border-slate-200 focus:border-purple-500"
          />
        </div>
        <Badge variant="outline" className="text-xs text-slate-500 font-medium whitespace-nowrap">
          {filteredGrupos.length} {filteredGrupos.length === 1 ? 'grupo' : 'grupos'}
        </Badge>
      </div>

      {/* Listagem de Grupos */}
      {loading ? (
        <div className="p-12 text-center flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 border-3 border-purple-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-slate-500 font-medium">
            Carregando grupos empresariais...
          </span>
        </div>
      ) : filteredGrupos.length === 0 ? (
        <Card className="bg-white border-dashed border-slate-300">
          <CardContent className="p-12 text-center flex flex-col items-center justify-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100">
              <Network className="w-6 h-6" />
            </div>
            <div className="max-w-md">
              <h2 className="text-sm font-bold text-slate-800">
                {searchTerm ? 'Nenhum grupo encontrado' : 'Nenhum grupo empresarial cadastrado'}
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                {searchTerm
                  ? 'Tente buscar por outro termo ou limpe a busca.'
                  : 'Crie seu primeiro grupo econômico para gerenciar empresas-membro e conceder permissões consolidadas aos usuários.'}
              </p>
            </div>
            {!searchTerm && (
              <Button
                onClick={openCreateModal}
                className="mt-2 bg-purple-600 hover:bg-purple-700 text-white text-xs h-8 font-semibold"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Criar Primeiro Grupo
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredGrupos.map((grupo) => {
            const grupoEmpresasIds = grupo.empresas || []
            const qtdEmpresas = grupoEmpresasIds.length
            const empresasDoGrupo = grupoEmpresasIds
              .map((id) => empresasMap.get(id))
              .filter(Boolean) as EmpresaRecord[]

            const usuariosVinculados = usuariosPorGrupo.get(grupo.id) || []
            const qtdUsuarios = usuariosVinculados.length

            return (
              <Card
                key={grupo.id}
                className="bg-white border-slate-200 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group"
              >
                <div>
                  <CardHeader className="p-4 pb-3 border-b border-slate-100 bg-gradient-to-br from-slate-50/50 to-purple-50/20">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="p-2 rounded-lg bg-purple-600 text-white shadow-2xs shrink-0">
                          <Network className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <CardTitle className="text-sm font-bold text-[#0B1F3A] leading-tight group-hover:text-purple-700 transition-colors truncate">
                            {grupo.nome}
                          </CardTitle>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="text-[11px] text-purple-700 font-semibold">
                              {qtdEmpresas}{' '}
                              {qtdEmpresas === 1 ? 'empresa-membro' : 'empresas-membro'}
                            </span>
                            <span className="text-slate-300">•</span>
                            <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                              <Users className="w-3 h-3 text-slate-400" />
                              {qtdUsuarios} {qtdUsuarios === 1 ? 'usuário' : 'usuários'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <Badge className="bg-purple-100 text-purple-900 border-purple-300 text-[10px] font-bold shrink-0">
                        Grupo Econômico
                      </Badge>
                    </div>

                    {grupo.descricao && (
                      <CardDescription className="text-xs text-slate-600 mt-2 line-clamp-2">
                        {grupo.descricao}
                      </CardDescription>
                    )}
                  </CardHeader>

                  <CardContent className="p-4 pt-3 space-y-3">
                    {/* Badges Roxas das Empresas Participantes (estilo Usuários & Permissões) */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          Empresas Participantes ({qtdEmpresas})
                        </span>
                      </div>
                      {empresasDoGrupo.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                          {empresasDoGrupo.map((emp) => (
                            <Badge
                              key={emp.id}
                              className="bg-purple-100 text-purple-900 border-purple-300 hover:bg-purple-200 text-[11px] font-medium px-2 py-0.5 flex items-center gap-1 shadow-2xs max-w-full"
                              title={`CNPJ: ${formatCnpj(emp.cnpj)} | Segmento: ${emp.segmento || 'Não informado'}`}
                            >
                              <Building2 className="w-3 h-3 text-purple-700 shrink-0" />
                              <span className="truncate max-w-[200px]">
                                {emp.nome_fantasia || emp.nome}
                              </span>
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-amber-600 italic flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5" />
                          Nenhuma empresa associada
                        </span>
                      )}
                    </div>

                    {/* Usuários Vinculados */}
                    {qtdUsuarios > 0 && (
                      <div className="pt-2 border-t border-slate-100">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                          Usuários Vinculados ({qtdUsuarios})
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {usuariosVinculados.slice(0, 3).map((u) => (
                            <span
                              key={u.id}
                              className="inline-flex items-center gap-1 text-[10px] text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 truncate max-w-[150px]"
                              title={`${u.name || 'Sem nome'} (${u.email}) - Perfil: ${u.role}`}
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                              <span className="truncate">{u.name || u.email}</span>
                            </span>
                          ))}
                          {qtdUsuarios > 3 && (
                            <span className="text-[10px] text-slate-500 font-medium self-center">
                              +{qtdUsuarios - 3} mais
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </div>

                <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleVerConsolidado(grupo)}
                      className="flex-1 text-xs font-semibold text-purple-700 hover:text-purple-800 hover:bg-purple-50 border-purple-200 h-8 gap-1 shadow-2xs"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Ver Análises</span>
                      <ArrowRight className="w-3 h-3" />
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenRelatorioConsolidado(grupo)}
                      className="text-xs font-semibold text-slate-700 hover:text-purple-700 hover:bg-purple-50 border-slate-200 h-8 gap-1 shadow-2xs"
                      title="Relatório Consolidado em PDF (A4)"
                    >
                      <FileText className="w-3.5 h-3.5 text-purple-600" />
                      <span className="hidden sm:inline">Relatório PDF</span>
                    </Button>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditModal(grupo)}
                      className="h-8 w-8 text-slate-600 hover:text-slate-900 hover:bg-slate-200"
                      title="Editar Grupo"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => confirmDeleteGrupo(grupo)}
                      className="h-8 w-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                      title="Excluir Grupo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Modal Criar / Editar Grupo Empresarial */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-purple-600 text-white">
                <Network className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-slate-900">
                  {editingGrupo ? 'Editar Grupo de Empresas' : 'Novo Grupo de Empresas'}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Defina o nome do grupo e selecione as empresas-membro participantes.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleSaveGrupo} className="space-y-4 pt-2">
            {/* Nome do Grupo */}
            <div className="space-y-1.5">
              <Label htmlFor="nome-grupo" className="text-xs font-bold text-slate-700">
                Nome do Grupo Econômico <span className="text-red-500">*</span>
              </Label>
              <Input
                id="nome-grupo"
                placeholder="Ex.: GRUPO CANEIRA, Holding Sul, etc."
                value={nomeGrupo}
                onChange={(e) => {
                  setNomeGrupo(e.target.value)
                  if (formErrors.nome) setFormErrors((prev) => ({ ...prev, nome: undefined }))
                }}
                className={`text-xs h-9 ${formErrors.nome ? 'border-red-500 focus-visible:ring-red-400' : ''}`}
              />
              {formErrors.nome && (
                <p className="text-[11px] text-red-600 font-medium">{formErrors.nome}</p>
              )}
            </div>

            {/* Descrição / Observações */}
            <div className="space-y-1.5">
              <Label htmlFor="descricao-grupo" className="text-xs font-semibold text-slate-700">
                Descrição ou Observações{' '}
                <span className="text-slate-400 font-normal">(Opcional)</span>
              </Label>
              <Textarea
                id="descricao-grupo"
                placeholder="Breve resumo sobre o grupo econômico, holdings ou critérios de consolidação..."
                rows={2}
                value={descricaoGrupo}
                onChange={(e) => setDescricaoGrupo(e.target.value)}
                className="text-xs resize-none"
              />
            </div>

            {/* Seleção Múltipla de Empresas */}
            <div className="space-y-2 pt-1 border-t border-slate-100">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <Label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-purple-600" />
                    Empresas-Membro do Grupo <span className="text-red-500">*</span>
                  </Label>
                  <p className="text-[11px] text-slate-500">
                    Marque as empresas participantes cujos demonstrativos serão somados.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Badge className="bg-purple-100 text-purple-900 border-purple-300 text-xs font-bold">
                    {selectedEmpresasIds.length} selecionada(s)
                  </Badge>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={selectAllEmpresas}
                    className="h-7 text-[11px] px-2 text-purple-700 hover:bg-purple-50 border-purple-200"
                  >
                    Marcar todas
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={deselectAllEmpresas}
                    disabled={selectedEmpresasIds.length === 0}
                    className="h-7 text-[11px] px-2 text-slate-600 hover:bg-slate-100"
                  >
                    Desmarcar todas
                  </Button>
                </div>
              </div>

              {formErrors.empresas && (
                <p className="text-[11px] text-red-600 font-medium bg-red-50 p-2 rounded-md border border-red-200">
                  {formErrors.empresas}
                </p>
              )}

              {/* Campo de Busca Rápida de Empresa no Modal */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <Input
                  placeholder="Filtrar empresas por razão social, nome fantasia ou CNPJ..."
                  value={buscaEmpresaModal}
                  onChange={(e) => setBuscaEmpresaModal(e.target.value)}
                  className="pl-8 h-8 text-xs"
                />
              </div>

              {/* Caixa de Seleção com Checkboxes (estilo Usuários & Permissões) */}
              <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100 bg-slate-50/50 p-1 space-y-1">
                {filteredEmpresasModal.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-500">
                    Nenhuma empresa encontrada com os termos buscados.
                  </div>
                ) : (
                  filteredEmpresasModal.map((emp) => {
                    const isSelected = selectedEmpresasIds.includes(emp.id)
                    return (
                      <div
                        key={emp.id}
                        onClick={() => toggleEmpresaSelection(emp.id)}
                        className={`flex items-center justify-between p-2.5 rounded-md cursor-pointer transition-colors text-xs ${
                          isSelected
                            ? 'bg-purple-50/80 border border-purple-200 text-purple-950 font-semibold'
                            : 'bg-white hover:bg-slate-100/80 border border-transparent text-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-4 h-4 rounded border flex items-center justify-center transition-colors shrink-0 ${
                              isSelected
                                ? 'bg-purple-600 border-purple-600 text-white'
                                : 'border-slate-300 bg-white'
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 truncate">
                              <span className="font-bold truncate">{emp.nome}</span>
                              {emp.nome_fantasia && (
                                <span className="text-[10px] text-slate-500 font-normal truncate">
                                  ({emp.nome_fantasia})
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-500 flex items-center gap-2 mt-0.5 flex-wrap">
                              <span>CNPJ: {formatCnpj(emp.cnpj)}</span>
                              {emp.segmento && (
                                <>
                                  <span>•</span>
                                  <span>{emp.segmento}</span>
                                </>
                              )}
                              {emp.cidade && emp.estado && (
                                <>
                                  <span>•</span>
                                  <span>
                                    {emp.cidade}/{emp.estado}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {isSelected && (
                          <Badge className="bg-purple-600 text-white text-[9px] px-1.5 py-0 font-bold shrink-0 ml-2">
                            Membro
                          </Badge>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            <DialogFooter className="pt-3 border-t border-slate-100">
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
                className="bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs h-9"
              >
                {saving ? (
                  <div className="flex items-center gap-1.5">
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Salvando...</span>
                  </div>
                ) : editingGrupo ? (
                  'Salvar Alterações'
                ) : (
                  'Criar Grupo'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Confirmação de Exclusão */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-2 text-rose-600 mb-1">
              <AlertTriangle className="w-5 h-5" />
              <AlertDialogTitle className="text-base font-bold text-slate-900">
                Excluir Grupo de Empresas?
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-xs text-slate-600 leading-relaxed space-y-2">
              <p>
                Tem certeza que deseja remover o grupo{' '}
                <strong className="text-slate-900">"{grupoToDelete?.nome}"</strong>?
              </p>
              <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[11px] space-y-1">
                <p className="font-semibold flex items-center gap-1 text-amber-800">
                  <Shield className="w-3.5 h-3.5" /> Tratamento automático de integridade:
                </p>
                <p>
                  1. As empresas participantes e seus balanços e DREs individuais{' '}
                  <strong>NÃO</strong> serão apagados.
                </p>
                <p>
                  2. Usuários vinculados a este grupo terão a referência removida automaticamente de
                  seus perfis, garantindo que o login e a resolução de acessos continuem funcionando
                  normalmente.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting} className="text-xs h-9">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteGrupo}
              disabled={deleting}
              className="bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs h-9"
            >
              {deleting ? 'Excluindo...' : 'Sim, Excluir Grupo'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal Relatório Consolidado A4 do Grupo em PDF */}
      <ModalRelatorioConsolidadoGrupoA4
        open={modalPdfConsolidadoOpen}
        onOpenChange={setModalPdfConsolidadoOpen}
        grupo={grupoParaRelatorio}
        empresas={empresas}
        selectedAnoInicial={selectedAno}
        minhaEmpresa={minhaEmpresa}
        logoUrl={logoUrl}
      />
    </div>
  )
}
