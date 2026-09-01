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
  Info,
  CheckCircle2,
  Layers,
  ArrowRight,
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
import { useRealtime } from '@/hooks/use-realtime'
import { gruposEmpresariaisService, empresasService } from '@/services/financeService'
import type { GrupoEmpresarialRecord, EmpresaRecord } from '@/types/finance'
function formatCnpj(v: string) {
  if (!v) return ''
  const d = v.replace(/\D/g, '')
  if (d.length !== 14) return v
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
}

export default function GruposEmpresariais() {
  const { toast } = useToast()
  const navigate = useNavigate()
  const { setSelectedEmpresaId, reloadEmpresas } = useFilter()

  const [grupos, setGrupos] = useState<GrupoEmpresarialRecord[]>([])
  const [empresas, setEmpresas] = useState<EmpresaRecord[]>([])
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

  // Modal confirmação de exclusão
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [grupoToDelete, setGrupoToDelete] = useState<GrupoEmpresarialRecord | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadData = async () => {
    try {
      setLoading(true)
      const [gruposList, empresasList] = await Promise.all([
        gruposEmpresariaisService.getAll(),
        empresasService.getAll(),
      ])
      setGrupos(gruposList)
      setEmpresas(empresasList)
    } catch (err) {
      console.error('Erro ao carregar grupos e empresas:', err)
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

  const selectAllFiltered = (filteredIds: string[]) => {
    const allSelected = filteredIds.every((id) => selectedEmpresasIds.includes(id))
    if (allSelected) {
      setSelectedEmpresasIds((prev) => prev.filter((id) => !filteredIds.includes(id)))
    } else {
      setSelectedEmpresasIds((prev) => Array.from(new Set([...prev, ...filteredIds])))
    }
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
      errors.empresas = 'Selecione pelo menos uma empresa participante para consolidar.'
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
          title: 'Grupo empresarial atualizado!',
          description: `O grupo "${nomeGrupo}" foi atualizado com sucesso.`,
        })
      } else {
        const novo = await gruposEmpresariaisService.create({
          nome: nomeGrupo,
          descricao: descricaoGrupo,
          empresas: selectedEmpresasIds,
        })
        toast({
          title: 'Grupo empresarial criado!',
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
        title: 'Grupo empresarial removido',
        description: `O grupo "${grupoToDelete.nome}" foi removido com sucesso.`,
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
        description: err?.message || 'Não foi possível remover o grupo empresarial.',
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

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Cabeçalho da página */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-[#0B1F3A] tracking-tight">Grupos Empresariais</h1>
            <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 font-semibold text-xs">
              Consolidação Econômica
            </Badge>
          </div>
          <p className="text-xs text-[#5B6B7F] mt-0.5">
            Monte grupos com múltiplas empresas participantes para somar Balanço Patrimonial e DRE e
            gerar análises consolidadas
          </p>
        </div>

        <Button
          onClick={openCreateModal}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-9 shadow-xs"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Novo Grupo Empresarial
        </Button>
      </div>

      {/* Dica Informativa de Consolidação */}
      <div className="bg-gradient-to-r from-blue-50/80 via-indigo-50/60 to-slate-50 border border-blue-100/80 rounded-xl p-4 flex items-start gap-3">
        <div className="p-2 rounded-lg bg-blue-600 text-white shrink-0 mt-0.5 shadow-xs">
          <Layers className="w-4 h-4" />
        </div>
        <div className="space-y-1">
          <h2 className="text-xs font-bold text-blue-950">
            Como funciona a consolidação de Balanço e DRE por Grupo?
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            Uma mesma empresa pode pertencer a quantos grupos você desejar. Ao selecionar o grupo no
            seletor global do topo ou na barra lateral, todos os demonstrativos (Balanço mensal ou
            anual, DRE, índices de Liquidez, Rentabilidade, EBITDA, Fleuriet, Kanitz, Valuation e
            Agente IA) somam em tempo real os lançamentos das empresas associadas.
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
            className="pl-9 h-9 text-xs border-slate-200 focus:border-blue-500"
          />
        </div>
        <Badge variant="outline" className="text-xs text-slate-500 font-medium whitespace-nowrap">
          {filteredGrupos.length} {filteredGrupos.length === 1 ? 'grupo' : 'grupos'}
        </Badge>
      </div>

      {/* Listagem de Grupos */}
      {loading ? (
        <div className="p-12 text-center flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-slate-500 font-medium">
            Carregando grupos empresariais...
          </span>
        </div>
      ) : filteredGrupos.length === 0 ? (
        <Card className="bg-white border-dashed border-slate-300">
          <CardContent className="p-12 text-center flex flex-col items-center justify-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
              <Network className="w-6 h-6" />
            </div>
            <div className="max-w-md">
              <h2 className="text-sm font-bold text-slate-800">
                {searchTerm ? 'Nenhum grupo encontrado' : 'Nenhum grupo empresarial cadastrado'}
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                {searchTerm
                  ? 'Tente buscar por outro termo ou limpe a busca.'
                  : 'Crie seu primeiro grupo econômico para visualizar relatórios e indicadores consolidados de várias empresas juntas.'}
              </p>
            </div>
            {!searchTerm && (
              <Button
                onClick={openCreateModal}
                className="mt-2 bg-blue-600 hover:bg-blue-700 text-white text-xs h-8 font-semibold"
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

            return (
              <Card
                key={grupo.id}
                className="bg-white border-slate-200 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group"
              >
                <div>
                  <CardHeader className="p-4 pb-3 border-b border-slate-100 bg-gradient-to-br from-slate-50/50 to-indigo-50/20">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-indigo-600 text-white shadow-2xs">
                          <Network className="w-4 h-4" />
                        </div>
                        <div>
                          <CardTitle className="text-sm font-bold text-[#0B1F3A] leading-tight group-hover:text-indigo-700 transition-colors">
                            {grupo.nome}
                          </CardTitle>
                          <span className="text-[11px] text-slate-500 font-medium block mt-0.5">
                            {qtdEmpresas}{' '}
                            {qtdEmpresas === 1 ? 'empresa vinculada' : 'empresas vinculadas'}
                          </span>
                        </div>
                      </div>

                      <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[10px] font-bold">
                        Consolidado
                      </Badge>
                    </div>

                    {grupo.descricao && (
                      <CardDescription className="text-xs text-slate-600 mt-2 line-clamp-2">
                        {grupo.descricao}
                      </CardDescription>
                    )}
                  </CardHeader>

                  <CardContent className="p-4 pt-3 space-y-3">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                        Empresas Participantes
                      </span>
                      {empresasDoGrupo.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1">
                          {empresasDoGrupo.map((emp) => (
                            <span
                              key={emp.id}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-[11px] text-slate-700 font-medium"
                              title={`CNPJ: ${formatCnpj(emp.cnpj)} | Segmento: ${emp.segmento}`}
                            >
                              <Building2 className="w-3 h-3 text-slate-400" />
                              <span className="truncate max-w-[150px]">{emp.nome}</span>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-amber-600 italic flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5" />
                          Nenhuma empresa associada
                        </span>
                      )}
                    </div>
                  </CardContent>
                </div>

                <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleVerConsolidado(grupo)}
                    className="flex-1 text-xs font-semibold text-indigo-700 hover:text-indigo-800 hover:bg-indigo-50 border-indigo-200 h-8 gap-1 shadow-2xs"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Ver Análises</span>
                    <ArrowRight className="w-3 h-3" />
                  </Button>

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
              <div className="p-2 rounded-lg bg-indigo-600 text-white">
                <Network className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-slate-900">
                  {editingGrupo ? 'Editar Grupo Empresarial' : 'Novo Grupo Empresarial'}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Agrupe empresas pelo nome para somar demonstrativos e calcular relatórios
                  consolidados.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleSaveGrupo} className="space-y-4 pt-2">
            {/* Nome do Grupo */}
            <div className="space-y-1.5">
              <Label htmlFor="nome-grupo" className="text-xs font-bold text-slate-700">
                Nome do Grupo Empresarial <span className="text-red-500">*</span>
              </Label>
              <Input
                id="nome-grupo"
                placeholder="Ex.: Grupo ABC Participações, Holding Sul, etc."
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
                placeholder="Breve resumo sobre o propósito do grupo, holdings, sócios em comum ou critérios de consolidação..."
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
                    <Building2 className="w-3.5 h-3.5 text-blue-600" />
                    Empresas Participantes do Grupo <span className="text-red-500">*</span>
                  </Label>
                  <p className="text-[11px] text-slate-500">
                    Selecione as empresas cujos demonstrativos serão somados na consolidação.
                  </p>
                </div>

                <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-xs font-bold">
                  {selectedEmpresasIds.length} selecionada(s)
                </Badge>
              </div>

              {formErrors.empresas && (
                <p className="text-[11px] text-red-600 font-medium bg-red-50 p-2 rounded-md border border-red-200">
                  {formErrors.empresas}
                </p>
              )}

              {/* Campo de Busca Rápida de Empresa no Modal */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <Input
                    placeholder="Filtrar por razão social, nome fantasia ou CNPJ..."
                    value={buscaEmpresaModal}
                    onChange={(e) => setBuscaEmpresaModal(e.target.value)}
                    className="pl-8 h-8 text-xs"
                  />
                </div>
                {filteredEmpresasModal.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => selectAllFiltered(filteredEmpresasModal.map((e) => e.id))}
                    className="h-8 text-[11px] font-semibold text-slate-700 px-2"
                  >
                    {filteredEmpresasModal.every((e) => selectedEmpresasIds.includes(e.id))
                      ? 'Desmarcar Filtradas'
                      : 'Marcar Filtradas'}
                  </Button>
                )}
              </div>

              {/* Caixa de Seleção com Checkboxes */}
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
                            ? 'bg-blue-50/80 border border-blue-200 text-blue-900 font-semibold'
                            : 'bg-white hover:bg-slate-100/80 border border-transparent text-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                              isSelected
                                ? 'bg-blue-600 border-blue-600 text-white'
                                : 'border-slate-300 bg-white'
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold">{emp.nome}</span>
                              {emp.nome_fantasia && (
                                <span className="text-[10px] text-slate-500 font-normal">
                                  ({emp.nome_fantasia})
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-500 flex items-center gap-2 mt-0.5">
                              <span>CNPJ: {formatCnpj(emp.cnpj)}</span>
                              <span>•</span>
                              <span>{emp.segmento}</span>
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
                          <Badge className="bg-blue-600 text-white text-[9px] px-1.5 py-0 font-bold">
                            Vinculada
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
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-9"
              >
                {saving ? (
                  <div className="flex items-center gap-1.5">
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Salvando...</span>
                  </div>
                ) : editingGrupo ? (
                  'Salvar Alterações'
                ) : (
                  'Criar Grupo Empresarial'
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
            <AlertDialogTitle className="text-base font-bold text-slate-900">
              Excluir Grupo Empresarial?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-600 leading-relaxed">
              Tem certeza que deseja remover o grupo{' '}
              <strong className="text-slate-900">"{grupoToDelete?.nome}"</strong>?
              <br />
              <br />
              Esta ação <strong>NÃO</strong> remove as empresas participantes nem seus balanços e
              DREs individuais, apenas a consolidação do grupo.
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
    </div>
  )
}
