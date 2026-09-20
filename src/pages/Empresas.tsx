import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { empresasService, balancosService } from '@/services/financeService'
import type {
  EmpresaRecord,
  BalancoRecord,
  SegmentoEmpresa,
  SetorEmpresa,
  PorteEmpresa,
  UfEmpresa,
} from '@/types/finance'
import { SETORES_PADRAO, type SetorRecord } from '@/types/finance'
import { setoresService } from '@/services/setoresService'
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
import { Textarea } from '@/components/ui/textarea'
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
  Briefcase,
  MapPin,
  Phone,
  FileText,
} from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

const SEGMENTOS: SegmentoEmpresa[] = [
  'Indústria',
  'Comércio',
  'Serviços',
  'Tecnologia',
  'Agronegócio',
  'Construção',
  'Saúde',
  'Educação',
  'Financeiro',
  'Outros',
]

const PORTES: PorteEmpresa[] = ['MEI', 'Microempresa', 'Pequena', 'Média', 'Grande']

const UFS: UfEmpresa[] = [
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
]

interface EmpresaFormData {
  nome: string
  nome_fantasia: string
  cnpj: string
  segmento: SegmentoEmpresa
  setor: SetorEmpresa | ''
  porte: PorteEmpresa | ''
  data_fundacao: string
  logradouro: string
  numero: string
  complemento: string
  bairro: string
  cidade: string
  estado: UfEmpresa | ''
  cep: string
  telefone: string
  email: string
  site: string
  contato_principal: string
  observacoes: string
  emitir_nota_fiscal: boolean
}

const EMPTY_FORM: EmpresaFormData = {
  nome: '',
  nome_fantasia: '',
  cnpj: '',
  segmento: 'Serviços',
  setor: '',
  porte: '',
  data_fundacao: '',
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  estado: '',
  cep: '',
  telefone: '',
  email: '',
  site: '',
  contato_principal: '',
  observacoes: '',
  emitir_nota_fiscal: false,
}

type FieldErrors = Partial<Record<keyof EmpresaFormData | 'general', string>>

// Máscaras
const formatCnpjMask = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 14)
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}

const formatCepMask = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 8)
  return d.replace(/^(\d{5})(\d)/, '$1-$2')
}

const formatPhoneMask = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 10) {
    return d.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2')
  }
  return d.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2')
}

const isEmailValid = (email: string) => {
  if (!email.trim()) return true
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

const PORTE_LABELS: Record<PorteEmpresa, { label: string; cls: string }> = {
  MEI: { label: 'MEI', cls: 'bg-amber-50 text-amber-700' },
  Microempresa: { label: 'ME', cls: 'bg-sky-50 text-sky-700' },
  Pequena: { label: 'PP', cls: 'bg-emerald-50 text-emerald-700' },
  Média: { label: 'PM', cls: 'bg-violet-50 text-violet-700' },
  Grande: { label: 'GE', cls: 'bg-rose-50 text-rose-700' },
}

export default function Empresas() {
  const { reloadEmpresas, setSelectedEmpresaId } = useFilter()
  const { toast } = useToast()
  const navigate = useNavigate()

  const [empresas, setEmpresas] = useState<EmpresaRecord[]>([])
  const [balancos, setBalancos] = useState<BalancoRecord[]>([])
  const [listaSetores, setListaSetores] = useState<SetorRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [searchFilter, setSearchFilter] = useState('')

  // Modal State
  const [modalOpen, setModalOpen] = useState(false)
  const [editingEmpresa, setEditingEmpresa] = useState<EmpresaRecord | null>(null)
  const [formData, setFormData] = useState<EmpresaFormData>(EMPTY_FORM)
  const [formErrors, setFormErrors] = useState<FieldErrors>({})
  const [saving, setSaving] = useState(false)

  // Delete Dialog State
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [empresaToDelete, setEmpresaToDelete] = useState<EmpresaRecord | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadData = async () => {
    try {
      setLoading(true)
      const [empList, bList, setList] = await Promise.all([
        empresasService.getAll(),
        balancosService.getAll(),
        setoresService.getAtivos(),
      ])
      setEmpresas(empList)
      setBalancos(bList)
      setListaSetores(setList)
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

  useRealtime<SetorRecord>('setores', () => {
    setoresService.getAtivos().then(setListaSetores).catch(console.error)
    loadData()
  })

  const openNewModal = () => {
    setEditingEmpresa(null)
    setFormData(EMPTY_FORM)
    setFormErrors({})
    setModalOpen(true)
  }

  const openEditModal = (empresa: EmpresaRecord) => {
    setEditingEmpresa(empresa)
    setFormData({
      nome: empresa.nome || '',
      nome_fantasia: empresa.nome_fantasia || '',
      cnpj: formatCnpj(empresa.cnpj),
      segmento: empresa.segmento,
      setor: empresa.setor || '',
      porte: empresa.porte || '',
      data_fundacao: empresa.data_fundacao ? empresa.data_fundacao.slice(0, 10) : '',
      logradouro: empresa.logradouro || '',
      numero: empresa.numero || '',
      complemento: empresa.complemento || '',
      bairro: empresa.bairro || '',
      cidade: empresa.cidade || '',
      estado: empresa.estado || '',
      cep: empresa.cep ? formatCepMask(empresa.cep) : '',
      telefone: empresa.telefone ? formatPhoneMask(empresa.telefone) : '',
      email: empresa.email || '',
      site: empresa.site || '',
      contato_principal: empresa.contato_principal || '',
      observacoes: empresa.observacoes || '',
      emitir_nota_fiscal: Boolean(empresa.emitir_nota_fiscal),
    })
    setFormErrors({})
    setModalOpen(true)
  }

  const setField = <K extends keyof EmpresaFormData>(key: K, value: EmpresaFormData[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }))
    if (formErrors[key]) setFormErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  const validateForm = () => {
    const errors: FieldErrors = {}

    // Razão Social
    if (!formData.nome.trim() || formData.nome.trim().length < 3) {
      errors.nome = 'Razão Social deve ter pelo menos 3 caracteres'
    }

    // CNPJ
    const clean = cleanCnpj(formData.cnpj)
    if (!clean) {
      errors.cnpj = 'CNPJ é obrigatório'
    } else if (clean.length !== 14) {
      errors.cnpj = 'CNPJ deve conter 14 dígitos'
    } else if (!validateCnpj(clean)) {
      errors.cnpj = 'CNPJ inválido (dígitos verificadores não conferem)'
    }

    // Segmento
    if (!formData.segmento) {
      errors.segmento = 'Selecione um segmento'
    }

    // Cidade
    if (!formData.cidade.trim()) {
      errors.cidade = 'Informe a cidade'
    }

    // Estado
    if (!formData.estado) {
      errors.estado = 'Selecione o estado (UF)'
    }

    // E-mail (se preenchido)
    if (!isEmailValid(formData.email)) {
      errors.email = 'E-mail inválido'
    }

    // Site (se preenchido) — aceita com ou sem protocolo
    if (formData.site.trim()) {
      const s = formData.site.trim()
      const candidate = /^https?:\/\//i.test(s) ? s : `https://${s}`
      try {
        new URL(candidate)
      } catch {
        errors.site = 'Site inválido'
      }
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const buildPayload = () => {
    const cleanTel = formData.telefone.replace(/\D/g, '')
    const cleanCepVal = formData.cep.replace(/\D/g, '')
    const siteVal = formData.site.trim()
      ? /^https?:\/\//i.test(formData.site.trim())
        ? formData.site.trim()
        : `https://${formData.site.trim()}`
      : ''

    return {
      nome: formData.nome.trim(),
      nome_fantasia: formData.nome_fantasia.trim(),
      cnpj: cleanCnpj(formData.cnpj),
      segmento: formData.segmento,
      setor: formData.setor || undefined,
      porte: formData.porte || undefined,
      data_fundacao: formData.data_fundacao || undefined,
      logradouro: formData.logradouro.trim(),
      numero: formData.numero.trim(),
      complemento: formData.complemento.trim(),
      bairro: formData.bairro.trim(),
      cidade: formData.cidade.trim(),
      estado: formData.estado || undefined,
      cep: cleanCepVal || undefined,
      telefone: cleanTel || undefined,
      email: formData.email.trim() || undefined,
      site: siteVal || undefined,
      contato_principal: formData.contato_principal.trim(),
      observacoes: formData.observacoes.trim(),
      emitir_nota_fiscal: Boolean(formData.emitir_nota_fiscal),
    }
  }

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return

    setSaving(true)
    setFormErrors((prev) => ({ ...prev, general: undefined }))

    const payload = buildPayload()

    try {
      if (editingEmpresa) {
        await empresasService.update(editingEmpresa.id, payload)
        toast({
          title: 'Empresa atualizada',
          description: `Os dados de "${payload.nome}" foram salvos com sucesso.`,
        })
        setModalOpen(false)
      } else {
        const nova = await empresasService.create(payload as any)
        toast({
          title: 'Empresa cadastrada com sucesso!',
          description: `Você já pode lançar balanços e DREs para "${nova.nome}".`,
        })
        setSelectedEmpresaId(nova.id)
        setModalOpen(false)
        // Redireciona para tela de análise para lançar o primeiro balanço
        navigate(`/empresas/${nova.id}`)
      }
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
      } else if (dataErrors?.email) {
        setFormErrors((prev) => ({ ...prev, email: dataErrors.email.message }))
      } else if (dataErrors?.site) {
        setFormErrors((prev) => ({ ...prev, site: 'Site inválido' }))
      } else if (dataErrors?.nome) {
        setFormErrors((prev) => ({ ...prev, nome: dataErrors.nome.message }))
      } else {
        setFormErrors((prev) => ({
          ...prev,
          general:
            err?.message ||
            'Não foi possível salvar a empresa. Verifique os dados e tente novamente.',
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
      (emp.nome_fantasia || '').toLowerCase().includes(q) ||
      emp.cnpj.includes(q) ||
      emp.segmento.toLowerCase().includes(q) ||
      (emp.cidade || '').toLowerCase().includes(q) ||
      (emp.estado || '').toLowerCase().includes(q)
    )
  })

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Cabeçcalho da página */}
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
              placeholder="Buscar por nome, CNPJ, cidade..."
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
                    <th className="py-3 px-4">Razão Social / Nome Fantasia</th>
                    <th className="py-3 px-4">CNPJ</th>
                    <th className="py-3 px-4">Segmento</th>
                    <th className="py-3 px-4">Setor (Mercado)</th>
                    <th className="py-3 px-4">Porte</th>
                    <th className="py-3 px-4">Cidade / UF</th>
                    <th className="py-3 px-4 text-center">NFSe</th>
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
                    const porteInfo = emp.porte ? PORTE_LABELS[emp.porte] : null

                    return (
                      <tr key={emp.id} className="hover:bg-slate-50/80 transition-colors group">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs shrink-0">
                              <Building className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <Link
                                to={`/empresas/${emp.id}`}
                                className="font-semibold text-slate-900 hover:text-blue-600 transition-colors block truncate"
                              >
                                {emp.nome}
                              </Link>
                              {emp.nome_fantasia ? (
                                <span className="text-[11px] text-slate-500 block truncate">
                                  {emp.nome_fantasia}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">
                          {formatCnpj(emp.cnpj)}
                        </td>
                        <td className="py-3 px-4">
                          <Badge
                            variant="secondary"
                            className="text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200 px-1.5 py-0"
                          >
                            {emp.segmento}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          {emp.setor ? (
                            <Badge
                              variant="outline"
                              className="text-[10px] font-semibold bg-blue-50 text-blue-700 border-blue-200 px-1.5 py-0"
                            >
                              {emp.setor}
                            </Badge>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">Não informado</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {porteInfo ? (
                            <span
                              className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-semibold ${porteInfo.cls}`}
                            >
                              {porteInfo.label}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                          {emp.cidade || emp.estado ? (
                            <span>
                              {emp.cidade || '—'}
                              {emp.estado ? (
                                <span className="text-slate-400">/{emp.estado}</span>
                              ) : null}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {emp.emitir_nota_fiscal ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Sim
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500">
                              Não
                            </span>
                          )}
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
                        <td className="py-3 px-4 text-right font-medium text-slate-800 whitespace-nowrap">
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
        <DialogContent className="sm:max-w-[860px] bg-white max-h-[92vh] overflow-y-auto">
          <form onSubmit={handleFormSubmit}>
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-[#0B1F3A] flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-600" />
                {editingEmpresa ? 'Editar Empresa' : 'Cadastrar Nova Empresa'}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                {editingEmpresa
                  ? 'Atualize as informações cadastrais da empresa. Campos com * são obrigatórios.'
                  : 'Preencha os dados da empresa para iniciar a análise financeira. Campos com * são obrigatórios.'}
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

            <div className="space-y-6 py-4">
              {/* Seção: Dados Básicos */}
              <fieldset className="space-y-3">
                <legend className="flex items-center gap-2 text-xs font-bold text-[#0B1F3A] uppercase tracking-wide mb-1">
                  <Briefcase className="w-3.5 h-3.5 text-blue-600" />
                  Dados Básicos
                </legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="empresa-nome" className="text-xs font-semibold text-slate-700">
                      Razão Social *
                    </Label>
                    <Input
                      id="empresa-nome"
                      placeholder="Ex: Indústrias Vale Verde Ltda"
                      value={formData.nome}
                      onChange={(e) => setField('nome', e.target.value)}
                      className={`h-9 text-xs ${formErrors.nome ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                    />
                    {formErrors.nome && (
                      <p className="text-[11px] text-red-600 font-medium">{formErrors.nome}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label
                      htmlFor="empresa-nome-fantasia"
                      className="text-xs font-semibold text-slate-700"
                    >
                      Nome Fantasia
                    </Label>
                    <Input
                      id="empresa-nome-fantasia"
                      placeholder="Ex: Vale Verde"
                      value={formData.nome_fantasia}
                      onChange={(e) => setField('nome_fantasia', e.target.value)}
                      className="h-9 text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="empresa-cnpj" className="text-xs font-semibold text-slate-700">
                      CNPJ *
                    </Label>
                    <Input
                      id="empresa-cnpj"
                      placeholder="00.000.000/0000-00"
                      value={formData.cnpj}
                      onChange={(e) => setField('cnpj', formatCnpjMask(e.target.value))}
                      className={`h-9 text-xs font-mono ${formErrors.cnpj ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                    />
                    {formErrors.cnpj && (
                      <p className="text-[11px] text-red-600 font-medium">{formErrors.cnpj}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label
                      htmlFor="empresa-segmento"
                      className="text-xs font-semibold text-slate-700"
                    >
                      Segmento de Atuação *
                    </Label>
                    <Select
                      value={formData.segmento}
                      onValueChange={(val) => setField('segmento', val as SegmentoEmpresa)}
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

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label
                        htmlFor="empresa-setor"
                        className="text-xs font-semibold text-slate-700"
                      >
                        Setor (Mercado / Benchmarks)
                      </Label>
                      <span className="text-[10px] text-slate-400 font-medium">Opcional</span>
                    </div>
                    <Select
                      value={formData.setor || 'NONE'}
                      onValueChange={(val) =>
                        setField('setor', val === 'NONE' ? '' : (val as SetorEmpresa))
                      }
                    >
                      <SelectTrigger id="empresa-setor" className="h-9 text-xs bg-white">
                        <SelectValue placeholder="Selecione o setor de referência" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NONE" className="text-xs text-slate-400">
                          (Nenhum / Definir depois)
                        </SelectItem>
                        {/* Opções dinâmicas da coleção de setores com fallback para SETORES_PADRAO */}
                        {listaSetores.length > 0
                          ? listaSetores.map((s) => (
                              <SelectItem key={s.id} value={s.nome} className="text-xs">
                                {s.nome}
                              </SelectItem>
                            ))
                          : SETORES_PADRAO.map((set) => (
                              <SelectItem key={set} value={set} className="text-xs">
                                {set}
                              </SelectItem>
                            ))}
                        {/* Se o valor atual não estiver na lista de ativos, mantém visível para não perder */}
                        {formData.setor &&
                          !listaSetores.some((s) => s.nome === formData.setor) &&
                          !SETORES_PADRAO.includes(formData.setor as any) && (
                            <SelectItem value={formData.setor} className="text-xs">
                              {formData.setor} (Personalizado)
                            </SelectItem>
                          )}
                      </SelectContent>
                    </Select>
                    <p className="text-[10px] text-slate-500">
                      Usado para calibrar múltiplos e benchmarks no módulo Planejamento &gt;
                      Setores.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="empresa-porte" className="text-xs font-semibold text-slate-700">
                      Porte da Empresa
                    </Label>
                    <Select
                      value={formData.porte}
                      onValueChange={(val) => setField('porte', val as PorteEmpresa)}
                    >
                      <SelectTrigger id="empresa-porte" className="h-9 text-xs bg-white">
                        <SelectValue placeholder="Selecione o porte" />
                      </SelectTrigger>
                      <SelectContent>
                        {PORTES.map((p) => (
                          <SelectItem key={p} value={p} className="text-xs">
                            {p}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label
                      htmlFor="empresa-data-fundacao"
                      className="text-xs font-semibold text-slate-700"
                    >
                      Data de Fundação
                    </Label>
                    <Input
                      id="empresa-data-fundacao"
                      type="date"
                      value={formData.data_fundacao}
                      onChange={(e) => setField('data_fundacao', e.target.value)}
                      className="h-9 text-xs"
                    />
                  </div>
                </div>
              </fieldset>

              {/* Seção: Endereço */}
              <fieldset className="space-y-3">
                <legend className="flex items-center gap-2 text-xs font-bold text-[#0B1F3A] uppercase tracking-wide mb-1">
                  <MapPin className="w-3.5 h-3.5 text-blue-600" />
                  Endereço
                </legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label
                      htmlFor="empresa-logradouro"
                      className="text-xs font-semibold text-slate-700"
                    >
                      Logradouro
                    </Label>
                    <Input
                      id="empresa-logradouro"
                      placeholder="Rua, Avenida..."
                      value={formData.logradouro}
                      onChange={(e) => setField('logradouro', e.target.value)}
                      className="h-9 text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label
                      htmlFor="empresa-numero"
                      className="text-xs font-semibold text-slate-700"
                    >
                      Número
                    </Label>
                    <Input
                      id="empresa-numero"
                      placeholder="Ex: 1234"
                      value={formData.numero}
                      onChange={(e) => setField('numero', e.target.value)}
                      className="h-9 text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label
                      htmlFor="empresa-complemento"
                      className="text-xs font-semibold text-slate-700"
                    >
                      Complemento
                    </Label>
                    <Input
                      id="empresa-complemento"
                      placeholder="Sala, andar..."
                      value={formData.complemento}
                      onChange={(e) => setField('complemento', e.target.value)}
                      className="h-9 text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label
                      htmlFor="empresa-bairro"
                      className="text-xs font-semibold text-slate-700"
                    >
                      Bairro
                    </Label>
                    <Input
                      id="empresa-bairro"
                      placeholder="Ex: Centro"
                      value={formData.bairro}
                      onChange={(e) => setField('bairro', e.target.value)}
                      className="h-9 text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="empresa-cep" className="text-xs font-semibold text-slate-700">
                      CEP
                    </Label>
                    <Input
                      id="empresa-cep"
                      placeholder="00000-000"
                      value={formData.cep}
                      onChange={(e) => setField('cep', formatCepMask(e.target.value))}
                      className="h-9 text-xs font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label
                      htmlFor="empresa-cidade"
                      className="text-xs font-semibold text-slate-700"
                    >
                      Cidade *
                    </Label>
                    <Input
                      id="empresa-cidade"
                      placeholder="Ex: São Paulo"
                      value={formData.cidade}
                      onChange={(e) => setField('cidade', e.target.value)}
                      className={`h-9 text-xs ${formErrors.cidade ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                    />
                    {formErrors.cidade && (
                      <p className="text-[11px] text-red-600 font-medium">{formErrors.cidade}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label
                      htmlFor="empresa-estado"
                      className="text-xs font-semibold text-slate-700"
                    >
                      Estado (UF) *
                    </Label>
                    <Select
                      value={formData.estado}
                      onValueChange={(val) => setField('estado', val as UfEmpresa)}
                    >
                      <SelectTrigger id="empresa-estado" className="h-9 text-xs bg-white">
                        <SelectValue placeholder="Selecione a UF" />
                      </SelectTrigger>
                      <SelectContent>
                        {UFS.map((uf) => (
                          <SelectItem key={uf} value={uf} className="text-xs">
                            {uf}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {formErrors.estado && (
                      <p className="text-[11px] text-red-600 font-medium">{formErrors.estado}</p>
                    )}
                  </div>
                </div>
              </fieldset>

              {/* Seção: Contato */}
              <fieldset className="space-y-3">
                <legend className="flex items-center gap-2 text-xs font-bold text-[#0B1F3A] uppercase tracking-wide mb-1">
                  <Phone className="w-3.5 h-3.5 text-blue-600" />
                  Contato
                </legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="empresa-telefone"
                      className="text-xs font-semibold text-slate-700"
                    >
                      Telefone
                    </Label>
                    <Input
                      id="empresa-telefone"
                      placeholder="(00) 0000-0000"
                      value={formData.telefone}
                      onChange={(e) => setField('telefone', formatPhoneMask(e.target.value))}
                      className="h-9 text-xs font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="empresa-email" className="text-xs font-semibold text-slate-700">
                      E-mail
                    </Label>
                    <Input
                      id="empresa-email"
                      type="email"
                      placeholder="contato@empresa.com.br"
                      value={formData.email}
                      onChange={(e) => setField('email', e.target.value)}
                      className={`h-9 text-xs ${formErrors.email ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                    />
                    {formErrors.email && (
                      <p className="text-[11px] text-red-600 font-medium">{formErrors.email}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="empresa-site" className="text-xs font-semibold text-slate-700">
                      Site
                    </Label>
                    <Input
                      id="empresa-site"
                      type="text"
                      placeholder="www.empresa.com.br"
                      value={formData.site}
                      onChange={(e) => setField('site', e.target.value)}
                      className={`h-9 text-xs ${formErrors.site ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                    />
                    {formErrors.site && (
                      <p className="text-[11px] text-red-600 font-medium">{formErrors.site}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label
                      htmlFor="empresa-contato-principal"
                      className="text-xs font-semibold text-slate-700"
                    >
                      Contato Principal
                    </Label>
                    <Input
                      id="empresa-contato-principal"
                      placeholder="Nome do responsável"
                      value={formData.contato_principal}
                      onChange={(e) => setField('contato_principal', e.target.value)}
                      className="h-9 text-xs"
                    />
                  </div>
                </div>
              </fieldset>

              {/* Seção: Faturamento & Emissão de Nota Fiscal */}
              <fieldset className="space-y-3 bg-blue-50/50 p-3.5 rounded-xl border border-blue-100">
                <legend className="flex items-center gap-2 text-xs font-bold text-[#0B1F3A] uppercase tracking-wide px-1">
                  <FileText className="w-3.5 h-3.5 text-blue-600" />
                  Emissão de Nota Fiscal (NFSe)
                </legend>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <Label
                        htmlFor="empresa-emitir-nfse"
                        className="text-xs font-semibold text-slate-900 cursor-pointer"
                      >
                        Emitir Nota Fiscal para este cliente?
                      </Label>
                      <p className="text-[11px] text-slate-500">
                        Quando marcado como "SIM", o cliente estará disponível na tela de Emissão de
                        NFSe com preenchimento automático de valores do contrato.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        type="button"
                        size="sm"
                        variant={formData.emitir_nota_fiscal ? 'default' : 'outline'}
                        onClick={() => setField('emitir_nota_fiscal', true)}
                        className={`h-7 px-3 text-xs font-semibold ${
                          formData.emitir_nota_fiscal
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            : 'bg-white text-slate-700 border-slate-300'
                        }`}
                      >
                        SIM
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={!formData.emitir_nota_fiscal ? 'default' : 'outline'}
                        onClick={() => setField('emitir_nota_fiscal', false)}
                        className={`h-7 px-3 text-xs font-semibold ${
                          !formData.emitir_nota_fiscal
                            ? 'bg-slate-700 hover:bg-slate-800 text-white'
                            : 'bg-white text-slate-700 border-slate-300'
                        }`}
                      >
                        NÃO
                      </Button>
                    </div>
                  </div>
                </div>
              </fieldset>

              {/* Seção: Informações Adicionais */}
              <fieldset className="space-y-3">
                <legend className="flex items-center gap-2 text-xs font-bold text-[#0B1F3A] uppercase tracking-wide mb-1">
                  <FileText className="w-3.5 h-3.5 text-blue-600" />
                  Informações Adicionais
                </legend>
                <div className="space-y-1.5">
                  <Label
                    htmlFor="empresa-observacoes"
                    className="text-xs font-semibold text-slate-700"
                  >
                    Observações
                  </Label>
                  <Textarea
                    id="empresa-observacoes"
                    placeholder="Anotações sobre o cliente, contrato, particularidades do atendimento..."
                    value={formData.observacoes}
                    onChange={(e) => setField('observacoes', e.target.value)}
                    className="text-xs min-h-[90px]"
                  />
                </div>
              </fieldset>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 sticky bottom-0 bg-white pt-3 border-t border-slate-100">
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
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-9 shadow-xs"
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
