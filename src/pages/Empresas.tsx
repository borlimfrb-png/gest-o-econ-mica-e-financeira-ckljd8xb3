import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { empresasService, balancosService } from '@/services/financeService'
import type { EmpresaRecord, BalancoRecord, SegmentoEmpresa } from '@/types/finance'
import {
  formatCnpj,
  cleanCnpj,
  validateCnpj,
  formatBrlMil,
  calcularBalanco,
} from '@/lib/financeCalculations'
import { useRealtime } from '@/hooks/use-realtime'
import { useFilter } from '@/contexts/FilterContext'
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
  Building2,
  Plus,
  Pencil,
  Trash2,
  ArrowRight,
  Search,
  AlertCircle,
  Building,
} from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

const SEGMENTOS: SegmentoEmpresa[] = [
  'Indústria',
  'Comércio',
  'Serviços',
  'Agronegócio',
  'Tecnologia',
  'Saúde',
  'Construção',
  'Outros',
]

export default function Empresas() {
  const { reloadEmpresas, setSelectedEmpresaId } = useFilter()
  const { toast } = useToast()
  const navigate = useNavigate()

  const [empresas, setEmpresas] = useState<EmpresaRecord[]>([])
  const [balancos, setBalancos] = useState<BalancoRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [searchFilter, setSearchFilter] = useState('')

  // Modal State
  const [modalOpen, setModalOpen] = useState(false)
  const [editingEmpresa, setEditingEmpresa] = useState<EmpresaRecord | null>(null)
  const [formData, setFormData] = useState<{
    nome: string
    cnpj: string
    segmento: SegmentoEmpresa
  }>({
    nome: '',
    cnpj: '',
    segmento: 'Serviços',
  })
  const [formErrors, setFormErrors] = useState<{
    nome?: string
    cnpj?: string
    segmento?: string
    general?: string
  }>({})
  const [saving, setSaving] = useState(false)

  // Delete Dialog State
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [empresaToDelete, setEmpresaToDelete] = useState<EmpresaRecord | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadData = async () => {
    try {
      setLoading(true)
      const [empList, bList] = await Promise.all([
        empresasService.getAll(),
        balancosService.getAll(),
      ])
      setEmpresas(empList)
      setBalancos(bList)
    } catch (err) {
      console.error('Erro ao carregar empresas:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useRealtime<EmpresaRecord>('empresas', () => {
    loadData()
    reloadEmpresas()
  })

  const openNewModal = () => {
    setEditingEmpresa(null)
    setFormData({
      nome: '',
      cnpj: '',
      segmento: 'Serviços',
    })
    setFormErrors({})
    setModalOpen(true)
  }

  const openEditModal = (empresa: EmpresaRecord) => {
    setEditingEmpresa(empresa)
    setFormData({
      nome: empresa.nome,
      cnpj: formatCnpj(empresa.cnpj),
      segmento: empresa.segmento,
    })
    setFormErrors({})
    setModalOpen(true)
  }

  const validateForm = () => {
    const errors: { nome?: string; cnpj?: string; segmento?: string } = {}
    if (!formData.nome.trim() || formData.nome.trim().length < 3) {
      errors.nome = 'Nome da empresa deve ter pelo menos 3 caracteres'
    }

    const clean = cleanCnpj(formData.cnpj)
    if (!clean) {
      errors.cnpj = 'CNPJ é obrigatório'
    } else if (clean.length !== 14) {
      errors.cnpj = 'CNPJ deve conter 14 dígitos'
    } else if (!validateCnpj(clean)) {
      errors.cnpj = 'CNPJ informado é inválido'
    }

    if (!formData.segmento) {
      errors.segmento = 'Selecione um segmento'
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return

    setSaving(true)
    setFormErrors((prev) => ({ ...prev, general: undefined }))

    const payload = {
      nome: formData.nome.trim(),
      cnpj: cleanCnpj(formData.cnpj),
      segmento: formData.segmento,
    }

    try {
      if (editingEmpresa) {
        await empresasService.update(editingEmpresa.id, payload)
        toast({
          title: 'Empresa atualizada',
          description: `Os dados de "${payload.nome}" foram salvos com sucesso.`,
        })
      } else {
        const nova = await empresasService.create(payload)
        toast({
          title: 'Empresa cadastrada com sucesso!',
          description: `Você já pode lançar balanços e DREs para "${nova.nome}".`,
        })
        setSelectedEmpresaId(nova.id)
        // Redireciona para tela de análise para lançar o primeiro balanço
        navigate(`/empresas/${nova.id}`)
      }
      setModalOpen(false)
      loadData()
      reloadEmpresas()
    } catch (err: any) {
      console.error('Erro ao salvar empresa:', err)
      const dataErrors = err?.data?.data
      if (dataErrors?.cnpj) {
        setFormErrors((prev) => ({
          ...prev,
          cnpj: 'Este CNPJ já está cadastrado para outra empresa.',
        }))
      } else if (dataErrors?.nome) {
        setFormErrors((prev) => ({ ...prev, nome: dataErrors.nome.message }))
      } else {
        setFormErrors((prev) => ({
          ...prev,
          general:
            err?.message || 'Não foi possível salvar a empresa. Verifique se o CNPJ já existe.',
        }))
      }
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = (empresa: EmpresaRecord) => {
    setEmpresaToDelete(empresa)
    setDeleteConfirmOpen(true)
  }

  const handleDelete = async () => {
    if (!empresaToDelete) return
    setDeleting(true)
    try {
      await empresasService.delete(empresaToDelete.id)
      toast({
        title: 'Empresa removida',
        description: `A empresa "${empresaToDelete.nome}" e todos os seus lançamentos foram excluídos.`,
      })
      setDeleteConfirmOpen(false)
      setEmpresaToDelete(null)
      loadData()
      reloadEmpresas()
    } catch (err: any) {
      console.error('Erro ao excluir empresa:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir',
        description: err?.message || 'Ocorreu um erro ao excluir a empresa.',
      })
    } finally {
      setDeleting(false)
    }
  }

  // Filtragem
  const filteredEmpresas = empresas.filter((emp) => {
    const q = searchFilter.toLowerCase()
    return (
      emp.nome.toLowerCase().includes(q) ||
      emp.cnpj.includes(q) ||
      emp.segmento.toLowerCase().includes(q)
    )
  })

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Cabeçalho da página */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#0B1F3A] tracking-tight">Gestão de Empresas</h1>
          <p className="text-xs text-[#5B6B7F]">
            Cadastre clientes, consulte demonstrativos contábeis e acompanhe diagnósticos
            financeiros
          </p>
        </div>

        <Button
          onClick={openNewModal}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-9 shadow-sm"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Nova Empresa
        </Button>
      </div>

      {/* Card da Tabela */}
      <Card className="bg-white border-slate-200 shadow-2xs">
        <CardHeader className="pb-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-sm font-bold text-[#0B1F3A]">
              Empresas Cadastradas ({filteredEmpresas.length})
            </CardTitle>
            <CardDescription className="text-xs">
              Lista completa de clientes corporativos com seus últimos dados patrimoniais
            </CardDescription>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              type="text"
              placeholder="Buscar por nome, CNPJ..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="pl-8 h-8 text-xs bg-slate-50 border-slate-200 focus:bg-white"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 flex justify-center items-center">
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredEmpresas.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500">
              {searchFilter
                ? 'Nenhuma empresa encontrada para o filtro informado.'
                : 'Nenhuma empresa cadastrada. Clique em "Nova Empresa" para começar.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 font-semibold">
                    <th className="py-3 px-4">Empresa / Segmento</th>
                    <th className="py-3 px-4">CNPJ</th>
                    <th className="py-3 px-4 text-center">Último Balanço</th>
                    <th className="py-3 px-4 text-right">Total do Ativo</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredEmpresas.map((emp) => {
                    const empBalancos = balancos.filter((b) => b.empresa === emp.id)
                    const ultimoAno =
                      empBalancos.length > 0 ? Math.max(...empBalancos.map((b) => b.ano)) : null
                    const ultimoBalanco = empBalancos.find((b) => b.ano === ultimoAno)
                    const totalAtivo = ultimoBalanco
                      ? calcularBalanco(ultimoBalanco).ativoTotal
                      : null

                    return (
                      <tr key={emp.id} className="hover:bg-slate-50/80 transition-colors group">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs shrink-0">
                              <Building className="w-4 h-4" />
                            </div>
                            <div>
                              <Link
                                to={`/empresas/${emp.id}`}
                                className="font-semibold text-slate-900 hover:text-blue-600 transition-colors"
                              >
                                {emp.nome}
                              </Link>
                              <div>
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] font-semibold bg-slate-100 text-slate-700 border-none px-1.5 py-0 mt-0.5"
                                >
                                  {emp.segmento}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-600">
                          {formatCnpj(emp.cnpj)}
                        </td>
                        <td className="py-3 px-4 text-center font-semibold text-slate-700">
                          {ultimoAno ? (
                            <span className="inline-block px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md font-medium text-[11px]">
                              {ultimoAno}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-slate-800">
                          {formatBrlMil(totalAtivo)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              asChild
                              size="sm"
                              variant="outline"
                              className="h-7 text-[11px] font-medium border-slate-200 hover:border-blue-300 hover:text-blue-600"
                            >
                              <Link to={`/empresas/${emp.id}`}>
                                Ver Análise <ArrowRight className="w-3 h-3 ml-1" />
                              </Link>
                            </Button>
                            <Button
                              onClick={() => openEditModal(emp)}
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                              title="Editar empresa"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              onClick={() => confirmDelete(emp)}
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-slate-500 hover:text-red-600 hover:bg-red-50"
                              title="Excluir empresa"
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

      {/* Modal Nova / Editar Empresa */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-[460px] bg-white">
          <form onSubmit={handleFormSubmit}>
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-[#0B1F3A]">
                {editingEmpresa ? 'Editar Empresa' : 'Cadastrar Nova Empresa'}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                {editingEmpresa
                  ? 'Atualize as informações cadastrais da empresa.'
                  : 'Preencha os dados da empresa para iniciar a análise financeira.'}
              </DialogDescription>
            </DialogHeader>

            {formErrors.general && (
              <Alert
                variant="destructive"
                className="mt-4 bg-red-50 border-red-200 text-red-800 py-2"
              >
                <AlertCircle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-xs font-medium">
                  {formErrors.general}
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-4 py-4">
              {/* Nome */}
              <div className="space-y-1.5">
                <Label htmlFor="empresa-nome" className="text-xs font-semibold text-slate-700">
                  Nome da Empresa *
                </Label>
                <Input
                  id="empresa-nome"
                  placeholder="Ex: Indústrias Vale Verde Ltda"
                  value={formData.nome}
                  onChange={(e) => {
                    setFormData((prev) => ({ ...prev, nome: e.target.value }))
                    if (formErrors.nome) setFormErrors((prev) => ({ ...prev, nome: undefined }))
                  }}
                  className={`h-9 text-xs ${formErrors.nome ? 'border-red-500' : ''}`}
                />
                {formErrors.nome && (
                  <p className="text-[11px] text-red-600 font-medium">{formErrors.nome}</p>
                )}
              </div>

              {/* CNPJ */}
              <div className="space-y-1.5">
                <Label htmlFor="empresa-cnpj" className="text-xs font-semibold text-slate-700">
                  CNPJ (14 dígitos) *
                </Label>
                <Input
                  id="empresa-cnpj"
                  placeholder="00.000.000/0000-00"
                  value={formData.cnpj}
                  onChange={(e) => {
                    setFormData((prev) => ({ ...prev, cnpj: e.target.value }))
                    if (formErrors.cnpj) setFormErrors((prev) => ({ ...prev, cnpj: undefined }))
                  }}
                  className={`h-9 text-xs font-mono ${formErrors.cnpj ? 'border-red-500' : ''}`}
                />
                {formErrors.cnpj && (
                  <p className="text-[11px] text-red-600 font-medium">{formErrors.cnpj}</p>
                )}
              </div>

              {/* Segmento */}
              <div className="space-y-1.5">
                <Label htmlFor="empresa-segmento" className="text-xs font-semibold text-slate-700">
                  Segmento de Atuação *
                </Label>
                <Select
                  value={formData.segmento}
                  onValueChange={(val) =>
                    setFormData((prev) => ({ ...prev, segmento: val as SegmentoEmpresa }))
                  }
                >
                  <SelectTrigger id="empresa-segmento" className="h-9 text-xs bg-white">
                    <SelectValue placeholder="Selecione o segmento" />
                  </SelectTrigger>
                  <SelectContent>
                    {SEGMENTOS.map((seg) => (
                      <SelectItem key={seg} value={seg} className="text-xs">
                        {seg}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formErrors.segmento && (
                  <p className="text-[11px] text-red-600 font-medium">{formErrors.segmento}</p>
                )}
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalOpen(false)}
                disabled={saving}
                className="text-xs h-8"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-8 shadow-xs"
              >
                {saving
                  ? 'Salvando...'
                  : editingEmpresa
                    ? 'Salvar Alterações'
                    : 'Cadastrar Empresa'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-red-600 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" /> Excluir Empresa?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-600">
              Tem certeza que deseja excluir a empresa{' '}
              <strong className="text-slate-900 font-semibold">{empresaToDelete?.nome}</strong>?
              Esta ação removerá permanentemente todos os Balanços Patrimoniais e DREs associados a
              esta empresa em cascata.
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
              {deleting ? 'Excluindo...' : 'Sim, Excluir Empresa'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
