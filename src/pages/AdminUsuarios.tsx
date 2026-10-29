import React, { useState, useEffect, useMemo } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { empresasService, gruposEmpresariaisService } from '@/services/financeService'
import { usuariosService } from '@/services/usuariosService'
import type { UserRecord, EmpresaRecord, GrupoEmpresarialRecord, UserRole } from '@/types/finance'
import { extractUserGruposIds } from '@/lib/vinculosEmpresas'
import { PERFIS_ACESSO, LISTA_PERFIS, getPerfilConfig } from '@/lib/permissoesPerfis'
import { useToast } from '@/hooks/use-toast'
import {
  Users,
  UserPlus,
  Search,
  Shield,
  Building2,
  CheckCircle2,
  XCircle,
  KeyRound,
  Edit,
  Trash2,
  RotateCw,
  Mail,
  Lock,
  AlertTriangle,
  FileCheck2,
  ShieldAlert,
  Eye,
  Layers,
} from 'lucide-react'
import { ModalAuditoriaCadastros } from '@/components/ModalAuditoriaCadastros'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'

export default function AdminUsuarios() {
  const { user: currentUser, isAdmin, isLoading: authLoading } = useAuth()
  const { toast } = useToast()

  const [usuarios, setUsuarios] = useState<UserRecord[]>([])
  const [empresas, setEmpresas] = useState<EmpresaRecord[]>([])
  const [grupos, setGrupos] = useState<GrupoEmpresarialRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterRole, setFilterRole] = useState<
    'todos' | 'admin' | 'empresa' | 'financeiro' | 'comercial' | 'cliente'
  >('todos')
  const [filterEmpresa, setFilterEmpresa] = useState<string>('todas')

  // Modais
  const [modalCreateOpen, setModalCreateOpen] = useState(false)
  const [modalEditOpen, setModalEditOpen] = useState(false)
  const [modalPasswordOpen, setModalPasswordOpen] = useState(false)
  const [modalDeleteOpen, setModalDeleteOpen] = useState(false)
  const [modalAuditoriaOpen, setModalAuditoriaOpen] = useState(false)

  // Usuário selecionado para ação
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null)

  // Formulário de Criação
  const [createForm, setCreateForm] = useState({
    name: '',
    email: '',
    password: '',
    passwordConfirm: '',
    role: 'empresa' as UserRole,
    empresa: '',
    empresas: [] as string[],
    grupos_empresariais: [] as string[],
    ativo: true,
  })
  const [creating, setCreating] = useState(false)

  // Formulário de Edição
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    role: 'empresa' as UserRole,
    empresa: '',
    empresas: [] as string[],
    grupos_empresariais: [] as string[],
    ativo: true,
  })
  const [editing, setEditing] = useState(false)

  // Formulário de Redefinição de Senha
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [resettingPassword, setResettingPassword] = useState(false)

  // Exclusão
  const [deleting, setDeleting] = useState(false)

  // Carregar dados
  const loadData = async () => {
    try {
      setIsLoading(true)
      const [uList, eList, gList] = await Promise.all([
        usuariosService.getAll(),
        empresasService.getAll(),
        gruposEmpresariaisService.getAll().catch(() => [] as GrupoEmpresarialRecord[]),
      ])
      setUsuarios(uList)
      setEmpresas(eList)
      setGrupos(gList)
    } catch (err: any) {
      console.error('Erro ao carregar usuários, empresas e grupos:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar dados',
        description: err?.message || 'Não foi possível carregar a listagem de usuários.',
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (isAdmin) {
      loadData()
    }
  }, [isAdmin])

  // Retorna a lista normalizada de IDs de empresas de um usuário
  const getUserEmpresasIds = (u: UserRecord): string[] => {
    const list: string[] = []
    if (Array.isArray(u.empresas) && u.empresas.length > 0) {
      list.push(...u.empresas.filter(Boolean))
    } else if (u.empresa) {
      list.push(u.empresa)
    }
    return Array.from(new Set(list))
  }

  // Filtragem de usuários
  const filteredUsers = useMemo(() => {
    return usuarios.filter((u) => {
      const matchSearch =
        (u.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.email || '').toLowerCase().includes(searchTerm.toLowerCase())

      const matchRole = filterRole === 'todos' || (u.role || 'empresa') === filterRole

      const userEmpresas = getUserEmpresasIds(u)
      const matchEmpresa =
        filterEmpresa === 'todas' ||
        u.empresa === filterEmpresa ||
        userEmpresas.includes(filterEmpresa)

      return matchSearch && matchRole && matchEmpresa
    })
  }, [usuarios, searchTerm, filterRole, filterEmpresa])

  // Se não for admin e já carregou auth, redireciona
  if (!authLoading && !isAdmin) {
    return (
      <Navigate
        to={currentUser?.role === 'comercial' ? '/baixa-recebiveis' : '/dashboard'}
        replace
      />
    )
  }

  // Handlers de seleção de grupos (criar)
  const toggleCreateGrupo = (grupoId: string) => {
    setCreateForm((prev) => {
      const current = prev.grupos_empresariais || []
      const next = current.includes(grupoId)
        ? current.filter((id) => id !== grupoId)
        : [...current, grupoId]
      return { ...prev, grupos_empresariais: next }
    })
  }

  const selectAllCreateGrupos = () => {
    const allIds = grupos.map((g) => g.id)
    setCreateForm((prev) => ({ ...prev, grupos_empresariais: allIds }))
  }

  const clearAllCreateGrupos = () => {
    setCreateForm((prev) => ({ ...prev, grupos_empresariais: [] }))
  }

  // Handlers de seleção múltipla de empresas (criar)
  const toggleCreateEmpresa = (empresaId: string) => {
    setCreateForm((prev) => {
      const current = prev.empresas || []
      const next = current.includes(empresaId)
        ? current.filter((id) => id !== empresaId)
        : [...current, empresaId]
      return {
        ...prev,
        empresas: next,
        empresa: next[0] || '',
      }
    })
  }

  const selectAllCreateEmpresas = () => {
    const allIds = empresas.map((e) => e.id)
    setCreateForm((prev) => ({
      ...prev,
      empresas: allIds,
      empresa: allIds[0] || '',
    }))
  }

  const clearAllCreateEmpresas = () => {
    setCreateForm((prev) => ({
      ...prev,
      empresas: [],
      empresa: '',
    }))
  }

  // Handlers de seleção de grupos (editar)
  const toggleEditGrupo = (grupoId: string) => {
    setEditForm((prev) => {
      const current = prev.grupos_empresariais || []
      const next = current.includes(grupoId)
        ? current.filter((id) => id !== grupoId)
        : [...current, grupoId]
      return { ...prev, grupos_empresariais: next }
    })
  }

  const selectAllEditGrupos = () => {
    const allIds = grupos.map((g) => g.id)
    setEditForm((prev) => ({ ...prev, grupos_empresariais: allIds }))
  }

  const clearAllEditGrupos = () => {
    setEditForm((prev) => ({ ...prev, grupos_empresariais: [] }))
  }

  // Handlers de seleção múltipla de empresas (editar)
  const toggleEditEmpresa = (empresaId: string) => {
    setEditForm((prev) => {
      const current = prev.empresas || []
      const next = current.includes(empresaId)
        ? current.filter((id) => id !== empresaId)
        : [...current, empresaId]
      return {
        ...prev,
        empresas: next,
        empresa: next[0] || '',
      }
    })
  }

  const selectAllEditEmpresas = () => {
    const allIds = empresas.map((e) => e.id)
    setEditForm((prev) => ({
      ...prev,
      empresas: allIds,
      empresa: allIds[0] || '',
    }))
  }

  const clearAllEditEmpresas = () => {
    setEditForm((prev) => ({
      ...prev,
      empresas: [],
      empresa: '',
    }))
  }

  // Handlers CRUD
  const handleOpenCreate = () => {
    const defaultEmpresa = empresas.length > 0 ? empresas[0].id : ''
    setCreateForm({
      name: '',
      email: '',
      password: '',
      passwordConfirm: '',
      role: 'empresa',
      empresa: defaultEmpresa,
      empresas: defaultEmpresa ? [defaultEmpresa] : [],
      grupos_empresariais: [],
      ativo: true,
    })
    setModalCreateOpen(true)
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!createForm.name.trim() || !createForm.email.trim()) {
      toast({
        variant: 'destructive',
        title: 'Campos obrigatórios',
        description: 'Informe o nome e o e-mail do usuário.',
      })
      return
    }

    if (!createForm.password || createForm.password.length < 8) {
      toast({
        variant: 'destructive',
        title: 'Senha fraca',
        description: 'A senha deve ter no mínimo 8 caracteres.',
      })
      return
    }

    if (createForm.password !== createForm.passwordConfirm) {
      toast({
        variant: 'destructive',
        title: 'Senhas divergentes',
        description: 'A confirmação de senha não coincide.',
      })
      return
    }

    const empresasSelecionadas =
      createForm.empresas && createForm.empresas.length > 0
        ? createForm.empresas
        : createForm.empresa
          ? [createForm.empresa]
          : []
    const gruposSelecionados = createForm.grupos_empresariais || []

    if (
      createForm.role !== 'admin' &&
      empresasSelecionadas.length === 0 &&
      gruposSelecionados.length === 0
    ) {
      toast({
        variant: 'destructive',
        title: 'Vínculo obrigatório',
        description:
          'Selecione pelo menos uma empresa ou um grupo de empresas para vincular ao usuário.',
      })
      return
    }

    setCreating(true)
    try {
      await usuariosService.create({
        ...createForm,
        empresa: createForm.role !== 'admin' ? empresasSelecionadas[0] : undefined,
        empresas: createForm.role !== 'admin' ? empresasSelecionadas : [],
        grupos_empresariais: createForm.role !== 'admin' ? gruposSelecionados : [],
      })
      toast({
        title: 'Usuário cadastrado com sucesso!',
        description: `${createForm.name} agora pode acessar o sistema.`,
      })
      setModalCreateOpen(false)
      loadData()
    } catch (err: any) {
      console.error('Erro ao criar usuário:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao criar usuário',
        description:
          err?.data?.data?.email?.message ||
          err?.message ||
          'Verifique se o e-mail já não está cadastrado.',
      })
    } finally {
      setCreating(false)
    }
  }

  const handleOpenEdit = (user: UserRecord) => {
    setSelectedUser(user)
    const empresasIds = getUserEmpresasIds(user)
    const gruposIds = extractUserGruposIds(user as any)
    setEditForm({
      name: user.name || '',
      email: user.email || '',
      role: (user.role as UserRole) || 'empresa',
      empresa: empresasIds[0] || user.empresa || '',
      empresas: empresasIds,
      grupos_empresariais: gruposIds,
      ativo: user.ativo !== false,
    })
    setModalEditOpen(true)
  }

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUser) return

    if (!editForm.name.trim() || !editForm.email.trim()) {
      toast({
        variant: 'destructive',
        title: 'Campos obrigatórios',
        description: 'Informe nome e e-mail válidos.',
      })
      return
    }

    const empresasSelecionadas =
      editForm.empresas && editForm.empresas.length > 0
        ? editForm.empresas
        : editForm.empresa
          ? [editForm.empresa]
          : []
    const gruposSelecionados = editForm.grupos_empresariais || []

    if (
      editForm.role !== 'admin' &&
      empresasSelecionadas.length === 0 &&
      gruposSelecionados.length === 0
    ) {
      toast({
        variant: 'destructive',
        title: 'Vínculo obrigatório',
        description: 'Selecione pelo menos uma empresa ou um grupo de empresas para este usuário.',
      })
      return
    }

    setEditing(true)
    try {
      await usuariosService.update(selectedUser.id, {
        name: editForm.name,
        email: editForm.email,
        role: editForm.role,
        empresa: editForm.role !== 'admin' ? empresasSelecionadas[0] : null,
        empresas: editForm.role !== 'admin' ? empresasSelecionadas : [],
        grupos_empresariais: editForm.role !== 'admin' ? gruposSelecionados : [],
        ativo: editForm.ativo,
      })
      toast({
        title: 'Usuário atualizado com sucesso!',
        description: 'As alterações foram salvas.',
      })
      setModalEditOpen(false)
      loadData()
    } catch (err: any) {
      console.error('Erro ao editar usuário:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao atualizar usuário',
        description: err?.message || 'Não foi possível salvar as alterações.',
      })
    } finally {
      setEditing(false)
    }
  }

  const handleToggleAtivo = async (user: UserRecord, novoStatus: boolean) => {
    if (user.id === currentUser?.id) {
      toast({
        variant: 'destructive',
        title: 'Ação não permitida',
        description: 'Você não pode desativar seu próprio usuário atual.',
      })
      return
    }

    try {
      await usuariosService.toggleAtivo(user.id, novoStatus)
      setUsuarios((prev) => prev.map((u) => (u.id === user.id ? { ...u, ativo: novoStatus } : u)))
      toast({
        title: novoStatus ? 'Usuário ativado' : 'Usuário desativado',
        description: `${user.name || user.email} agora está ${novoStatus ? 'ativo' : 'inativo'}.`,
      })
    } catch (err: any) {
      console.error('Erro ao alternar status do usuário:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao alterar status',
        description: err?.message || 'Falha ao alterar o status do usuário.',
      })
    }
  }

  const handleOpenResetPassword = (user: UserRecord) => {
    setSelectedUser(user)
    setNewPassword('')
    setConfirmNewPassword('')
    setModalPasswordOpen(true)
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUser) return

    if (newPassword.length < 8) {
      toast({
        variant: 'destructive',
        title: 'Senha muito curta',
        description: 'A nova senha deve possuir pelo menos 8 dígitos.',
      })
      return
    }

    if (newPassword !== confirmNewPassword) {
      toast({
        variant: 'destructive',
        title: 'Senhas não conferem',
        description: 'A confirmação de nova senha não bate com a senha digitada.',
      })
      return
    }

    setResettingPassword(true)
    try {
      await usuariosService.resetPassword(selectedUser.id, newPassword)
      toast({
        title: 'Senha redefinida com sucesso!',
        description: `Nova senha aplicada para ${selectedUser.name || selectedUser.email}.`,
      })
      setModalPasswordOpen(false)
    } catch (err: any) {
      console.error('Erro ao redefinir senha:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao redefinir senha',
        description: err?.message || 'Não foi possível alterar a senha deste usuário.',
      })
    } finally {
      setResettingPassword(false)
    }
  }

  const handleOpenDelete = (user: UserRecord) => {
    if (user.id === currentUser?.id) {
      toast({
        variant: 'destructive',
        title: 'Ação não permitida',
        description: 'Você não pode excluir sua própria conta.',
      })
      return
    }
    setSelectedUser(user)
    setModalDeleteOpen(true)
  }

  const handleDeleteUser = async () => {
    if (!selectedUser) return
    setDeleting(true)
    try {
      await usuariosService.delete(selectedUser.id)
      toast({
        title: 'Usuário excluído',
        description: `O cadastro de ${selectedUser.name || selectedUser.email} foi removido.`,
      })
      setModalDeleteOpen(false)
      loadData()
    } catch (err: any) {
      console.error('Erro ao excluir usuário:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir usuário',
        description: err?.message || 'Não foi possível remover o registro.',
      })
    } finally {
      setDeleting(false)
    }
  }

  const getEmpresaNome = (empresaId?: string) => {
    if (!empresaId) return 'Nenhuma (Acesso Global)'
    const emp = empresas.find((e) => e.id === empresaId)
    return emp ? emp.nome_fantasia || emp.nome : 'Empresa não encontrada'
  }

  const renderEmpresasBadges = (u: UserRecord) => {
    if (u.role === 'admin') {
      return <span className="text-slate-500 font-medium italic">Todas as Empresas (Global)</span>
    }

    const ids = getUserEmpresasIds(u)
    const gruposIds = extractUserGruposIds(u as any)

    if (ids.length === 0 && gruposIds.length === 0) {
      return <span className="text-amber-600 font-medium italic">Nenhum vínculo</span>
    }

    const empresasVinculadas = ids
      .map((id) => empresas.find((e) => e.id === id))
      .filter(Boolean) as EmpresaRecord[]

    const gruposVinculados = gruposIds
      .map(
        (gId) =>
          grupos.find((g) => g.id === gId) ||
          (u.expand?.grupos_empresariais || []).find((g) => g.id === gId),
      )
      .filter(Boolean) as GrupoEmpresarialRecord[]

    return (
      <div className="flex flex-col gap-1.5 max-w-[320px]">
        {/* Badges de Grupos Vinculados */}
        {gruposVinculados.length > 0 && (
          <div className="flex flex-wrap items-center gap-1">
            {gruposVinculados.map((g) => {
              const qtd = (g.empresas || []).length
              return (
                <Badge
                  key={g.id}
                  className="bg-purple-100 text-purple-900 border-purple-300 hover:bg-purple-200 text-[10px] font-semibold px-2 py-0.5 flex items-center gap-1 shadow-2xs"
                  title={`Grupo Econômico: ${g.nome} (${qtd} empresas participantes)`}
                >
                  <Layers className="w-3 h-3 text-purple-700 shrink-0" />
                  <span className="truncate max-w-[140px]">{g.nome}</span>
                  <span className="text-[9px] text-purple-700 font-mono">({qtd} emp.)</span>
                </Badge>
              )
            })}
          </div>
        )}

        {/* Badges / Lista de Empresas Individuais */}
        {empresasVinculadas.length > 0 && (
          <div>
            {empresasVinculadas.length === 1 ? (
              <div className="flex items-center gap-1.5 text-slate-800 font-medium text-xs">
                <Building2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span className="truncate max-w-[240px]">
                  {empresasVinculadas[0].nome_fantasia || empresasVinculadas[0].nome}
                </span>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5">
                  <Badge className="bg-indigo-100 text-indigo-800 border-indigo-200 text-[10px] font-bold px-1.5 py-0">
                    {empresasVinculadas.length} empresas
                  </Badge>
                  <span className="text-[11px] font-semibold text-slate-700 truncate">
                    {empresasVinculadas[0]?.nome_fantasia || empresasVinculadas[0]?.nome}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {empresasVinculadas.slice(1, 4).map((emp) => (
                    <span
                      key={emp.id}
                      className="text-[10px] text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 truncate max-w-[130px]"
                      title={emp.nome_fantasia || emp.nome}
                    >
                      {emp.nome_fantasia || emp.nome}
                    </span>
                  ))}
                  {empresasVinculadas.length > 4 && (
                    <span className="text-[10px] text-slate-500 font-medium self-center">
                      +{empresasVinculadas.length - 4} mais
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fadeIn max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#0B1F3A] tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-600" />
            Administração de Usuários & Permissões
          </h1>
          <p className="text-xs sm:text-sm text-[#5B6B7F] mt-1">
            Controle de acesso granular por usuário, concessão de papéis (Admin / Empresa) e
            vinculação restrita a empresas.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setModalAuditoriaOpen(true)}
            className="border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 gap-1.5"
          >
            <ShieldAlert className="w-4 h-4 text-purple-600" />
            Auditoria de Cadastros
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={isLoading}
            className="border-slate-300 hover:bg-slate-100"
          >
            <RotateCw className={`w-4 h-4 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button
            size="sm"
            onClick={handleOpenCreate}
            className="bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
          >
            <UserPlus className="w-4 h-4 mr-1.5" />
            Novo Usuário
          </Button>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="bg-white border-slate-200">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Total Geral
              </p>
              <h3 className="text-xl font-extrabold text-[#0B1F3A] mt-0.5">{usuarios.length}</h3>
            </div>
            <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
              <Users className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Administradores
              </p>
              <h3 className="text-xl font-extrabold text-purple-700 mt-0.5">
                {usuarios.filter((u) => u.role === 'admin').length}
              </h3>
            </div>
            <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600 shrink-0">
              <Shield className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Financeiro
              </p>
              <h3 className="text-xl font-extrabold text-blue-700 mt-0.5">
                {usuarios.filter((u) => u.role === 'financeiro').length}
              </h3>
            </div>
            <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
              <Shield className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Comercial
              </p>
              <h3 className="text-xl font-extrabold text-amber-700 mt-0.5">
                {usuarios.filter((u) => u.role === 'comercial').length}
              </h3>
            </div>
            <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
              <FileCheck2 className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Empresa
              </p>
              <h3 className="text-xl font-extrabold text-emerald-700 mt-0.5">
                {usuarios.filter((u) => (u.role || 'empresa') === 'empresa').length}
              </h3>
            </div>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
              <Building2 className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Cliente
              </p>
              <h3 className="text-xl font-extrabold text-cyan-700 mt-0.5">
                {usuarios.filter((u) => u.role === 'cliente').length}
              </h3>
            </div>
            <div className="w-9 h-9 rounded-xl bg-cyan-50 flex items-center justify-center text-cyan-600 shrink-0">
              <Eye className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>
      </div>
      {/* Filtros e Busca */}
      <Card className="bg-white border-slate-200 shadow-2xs">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="sm:col-span-2 relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <Input
                placeholder="Buscar por nome ou e-mail..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 text-xs"
              />
            </div>

            <div>
              <Select value={filterRole} onValueChange={(val: any) => setFilterRole(val)}>
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Perfil" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os Perfis</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="financeiro">Financeiro</SelectItem>
                  <SelectItem value="comercial">Comercial</SelectItem>
                  <SelectItem value="empresa">Usuário Empresa</SelectItem>
                  <SelectItem value="cliente">Cliente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Select value={filterEmpresa} onValueChange={(val) => setFilterEmpresa(val)}>
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Empresa vinculada" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as Empresas</SelectItem>
                  {empresas.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id} className="text-xs">
                      {emp.nome_fantasia || emp.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Usuários */}
      <Card className="bg-white border-slate-200 shadow-2xs overflow-hidden">
        <CardHeader className="py-3.5 px-5 border-b border-slate-100 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-bold text-[#0B1F3A]">
              Usuários Cadastrados ({filteredUsers.length})
            </CardTitle>
            <CardDescription className="text-xs">
              Gerencie permissões, empresas vinculadas, senhas e status de ativação.
            </CardDescription>
          </div>
        </CardHeader>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Usuário</th>
                <th className="py-3 px-4">Perfil</th>
                <th className="py-3 px-4">Empresa Vinculada</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      <span>Carregando usuários...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    Nenhum usuário encontrado com os filtros aplicados.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isUserAdmin = u.role === 'admin'
                  const isSelf = u.id === currentUser?.id
                  const isAtivo = u.ativo !== false

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs shrink-0">
                            {u.name ? u.name.charAt(0).toUpperCase() : 'U'}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-800 truncate flex items-center gap-1.5">
                              {u.name || 'Sem nome'}
                              {isSelf && (
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] py-0 px-1 bg-blue-50 text-blue-700 border-blue-200"
                                >
                                  Você
                                </Badge>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 truncate flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              {u.email}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        {(() => {
                          const conf = getPerfilConfig(u.role)
                          return (
                            <Badge
                              className={`${conf.badgeCor} hover:${conf.badgeCor} border text-xs font-semibold gap-1`}
                            >
                              {u.role === 'admin' ? (
                                <Shield className="w-3 h-3" />
                              ) : u.role === 'comercial' ? (
                                <FileCheck2 className="w-3 h-3" />
                              ) : u.role === 'cliente' ? (
                                <Eye className="w-3 h-3" />
                              ) : (
                                <Building2 className="w-3 h-3" />
                              )}
                              {conf.nome}
                            </Badge>
                          )
                        })()}
                      </td>

                      <td className="py-3 px-4">{renderEmpresasBadges(u)}</td>

                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Switch
                            checked={isAtivo}
                            disabled={isSelf}
                            onCheckedChange={(checked) => handleToggleAtivo(u, checked)}
                            className="data-[state=checked]:bg-emerald-600"
                          />
                          <span
                            className={`text-[11px] font-semibold ${isAtivo ? 'text-emerald-700' : 'text-slate-400'}`}
                          >
                            {isAtivo ? 'Ativo' : 'Inativo'}
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenResetPassword(u)}
                            className="h-8 w-8 p-0 text-slate-500 hover:text-amber-600 hover:bg-amber-50"
                            title="Redefinir senha"
                          >
                            <KeyRound className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEdit(u)}
                            className="h-8 w-8 p-0 text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                            title="Editar usuário"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={isSelf}
                            onClick={() => handleOpenDelete(u)}
                            className="h-8 w-8 p-0 text-slate-500 hover:text-red-600 hover:bg-red-50 disabled:opacity-30"
                            title={isSelf ? 'Não é possível excluir a si mesmo' : 'Excluir usuário'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* DIALOG: NOVO USUÁRIO */}
      <Dialog open={modalCreateOpen} onOpenChange={setModalCreateOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#0B1F3A]">
              <UserPlus className="w-5 h-5 text-blue-600" />
              Novo Usuário do Sistema
            </DialogTitle>
            <DialogDescription className="text-xs">
              Cadastre um novo usuário, defina seu perfil e vincule à empresa correspondente.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateUser} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Nome Completo *</Label>
              <Input
                placeholder="Ex: João da Silva"
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                required
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">E-mail de Acesso *</Label>
              <Input
                type="email"
                placeholder="Ex: joao@empresa.com.br"
                value={createForm.email}
                onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                required
                className="text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Senha Inicial *</Label>
                <Input
                  type="password"
                  placeholder="Mínimo 8 caracteres"
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  required
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Confirmar Senha *</Label>
                <Input
                  type="password"
                  placeholder="Repita a senha"
                  value={createForm.passwordConfirm}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, passwordConfirm: e.target.value })
                  }
                  required
                  className="text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Perfil de Acesso *</Label>
              <Select
                value={createForm.role}
                onValueChange={(val: UserRole) => setCreateForm({ ...createForm, role: val })}
              >
                <SelectTrigger className="text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LISTA_PERFIS.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="text-xs">
                      <span className="font-semibold">{p.nome}</span>
                      <span className="text-[11px] text-slate-500 block">{p.descricao}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {createForm.role !== 'admin' && (
              <>
                {/* SEÇÃO GRUPOS DE EMPRESAS (NOVO) */}
                <div className="space-y-2 bg-purple-50/50 p-3 rounded-lg border border-purple-100">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-purple-900 flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-purple-600" />
                      Grupos de Empresas (Grupo Econômico)
                    </Label>
                    <Badge className="bg-purple-100 text-purple-800 border-purple-200 text-[10px] font-bold px-1.5 py-0">
                      {(createForm.grupos_empresariais || []).length} selecionado(s)
                    </Badge>
                  </div>
                  <p className="text-[11px] text-purple-700/80">
                    Vincular um grupo libera automaticamente acesso a todas as empresas
                    participantes dele.
                  </p>

                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={selectAllCreateGrupos}
                      disabled={grupos.length === 0}
                      className="h-6 text-[10px] px-2 bg-white hover:bg-purple-50 text-purple-700 border-purple-200"
                    >
                      Marcar todos ({grupos.length})
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={clearAllCreateGrupos}
                      disabled={(createForm.grupos_empresariais || []).length === 0}
                      className="h-6 text-[10px] px-2 bg-white hover:bg-slate-100 text-slate-600 border-slate-200"
                    >
                      Desmarcar todos
                    </Button>
                  </div>

                  <div className="max-h-36 overflow-y-auto space-y-1 bg-white p-2 rounded border border-purple-100">
                    {grupos.length === 0 ? (
                      <p className="text-xs text-slate-400 italic p-2 text-center">
                        Nenhum grupo econômico cadastrado
                      </p>
                    ) : (
                      grupos.map((grp) => {
                        const isSelected = (createForm.grupos_empresariais || []).includes(grp.id)
                        const qtdEmp = (grp.empresas || []).length
                        return (
                          <label
                            key={grp.id}
                            className={`flex items-start gap-2.5 p-1.5 rounded cursor-pointer transition-colors text-xs ${
                              isSelected
                                ? 'bg-purple-50/80 text-purple-950 font-medium'
                                : 'hover:bg-slate-50 text-slate-700'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleCreateGrupo(grp.id)}
                              className="mt-0.5 rounded border-slate-300 text-purple-600 focus:ring-purple-500 h-3.5 w-3.5"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="truncate font-medium flex items-center justify-between gap-1">
                                <span>{grp.nome}</span>
                                <span className="text-[10px] text-purple-700 bg-purple-100/70 px-1 rounded font-normal">
                                  {qtdEmp} {qtdEmp === 1 ? 'empresa' : 'empresas'}
                                </span>
                              </div>
                              {grp.descricao && (
                                <div className="text-[10px] text-slate-400 truncate">
                                  {grp.descricao}
                                </div>
                              )}
                            </div>
                          </label>
                        )
                      })
                    )}
                  </div>
                </div>

                {/* SEÇÃO EMPRESAS INDIVIDUAIS */}
                <div className="space-y-2 bg-blue-50/50 p-3 rounded-lg border border-blue-100">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-blue-900 flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-blue-600" />
                      Empresas Individuais
                    </Label>
                    <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-[10px] font-bold px-1.5 py-0">
                      {(createForm.empresas || []).length} selecionada(s)
                    </Badge>
                  </div>
                  <p className="text-[11px] text-blue-700/80">
                    Selecione uma ou mais empresas individuais às quais este usuário terá acesso.
                  </p>

                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={selectAllCreateEmpresas}
                      className="h-6 text-[10px] px-2 bg-white hover:bg-blue-50 text-blue-700 border-blue-200"
                    >
                      Marcar todas ({empresas.length})
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={clearAllCreateEmpresas}
                      disabled={(createForm.empresas || []).length === 0}
                      className="h-6 text-[10px] px-2 bg-white hover:bg-slate-100 text-slate-600 border-slate-200"
                    >
                      Desmarcar todas
                    </Button>
                  </div>

                  <div className="max-h-44 overflow-y-auto space-y-1 bg-white p-2 rounded border border-blue-100">
                    {empresas.length === 0 ? (
                      <p className="text-xs text-slate-400 italic p-2 text-center">
                        Nenhuma empresa cadastrada
                      </p>
                    ) : (
                      empresas.map((emp) => {
                        const isSelected = (createForm.empresas || []).includes(emp.id)
                        return (
                          <label
                            key={emp.id}
                            className={`flex items-start gap-2.5 p-1.5 rounded cursor-pointer transition-colors text-xs ${
                              isSelected
                                ? 'bg-blue-50/80 text-blue-950 font-medium'
                                : 'hover:bg-slate-50 text-slate-700'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleCreateEmpresa(emp.id)}
                              className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="truncate font-medium">
                                {emp.nome_fantasia || emp.nome}
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono truncate">
                                {emp.cnpj}
                              </div>
                            </div>
                          </label>
                        )
                      })
                    )}
                  </div>
                </div>
              </>
            )}
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div>
                <Label className="text-xs font-semibold text-slate-800">Status Ativo</Label>
                <p className="text-[11px] text-slate-500">Permitir login imediato no sistema</p>
              </div>
              <Switch
                checked={createForm.ativo}
                onCheckedChange={(checked) => setCreateForm({ ...createForm, ativo: checked })}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setModalCreateOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={creating}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {creating ? 'Salvando...' : 'Criar Usuário'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIALOG: EDITAR USUÁRIO */}
      <Dialog open={modalEditOpen} onOpenChange={setModalEditOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#0B1F3A]">
              <Edit className="w-5 h-5 text-blue-600" />
              Editar Usuário
            </DialogTitle>
            <DialogDescription className="text-xs">
              Atualize as permissões ou altere a empresa vinculada.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEditUser} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Nome Completo *</Label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                required
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">E-mail de Acesso *</Label>
              <Input
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                required
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Perfil de Acesso *</Label>
              <Select
                value={editForm.role}
                onValueChange={(val: UserRole) => setEditForm({ ...editForm, role: val })}
              >
                <SelectTrigger className="text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LISTA_PERFIS.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="text-xs">
                      <span className="font-semibold">{p.nome}</span>
                      <span className="text-[11px] text-slate-500 block">{p.descricao}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {editForm.role !== 'admin' && (
              <>
                {/* SEÇÃO GRUPOS DE EMPRESAS (NOVO) */}
                <div className="space-y-2 bg-purple-50/50 p-3 rounded-lg border border-purple-100">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-purple-900 flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-purple-600" />
                      Grupos de Empresas (Grupo Econômico)
                    </Label>
                    <Badge className="bg-purple-100 text-purple-800 border-purple-200 text-[10px] font-bold px-1.5 py-0">
                      {(editForm.grupos_empresariais || []).length} selecionado(s)
                    </Badge>
                  </div>
                  <p className="text-[11px] text-purple-700/80">
                    Vincular um grupo libera automaticamente acesso a todas as empresas
                    participantes dele.
                  </p>

                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={selectAllEditGrupos}
                      disabled={grupos.length === 0}
                      className="h-6 text-[10px] px-2 bg-white hover:bg-purple-50 text-purple-700 border-purple-200"
                    >
                      Marcar todos ({grupos.length})
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={clearAllEditGrupos}
                      disabled={(editForm.grupos_empresariais || []).length === 0}
                      className="h-6 text-[10px] px-2 bg-white hover:bg-slate-100 text-slate-600 border-slate-200"
                    >
                      Desmarcar todos
                    </Button>
                  </div>

                  <div className="max-h-36 overflow-y-auto space-y-1 bg-white p-2 rounded border border-purple-100">
                    {grupos.length === 0 ? (
                      <p className="text-xs text-slate-400 italic p-2 text-center">
                        Nenhum grupo econômico cadastrado
                      </p>
                    ) : (
                      grupos.map((grp) => {
                        const isSelected = (editForm.grupos_empresariais || []).includes(grp.id)
                        const qtdEmp = (grp.empresas || []).length
                        return (
                          <label
                            key={grp.id}
                            className={`flex items-start gap-2.5 p-1.5 rounded cursor-pointer transition-colors text-xs ${
                              isSelected
                                ? 'bg-purple-50/80 text-purple-950 font-medium'
                                : 'hover:bg-slate-50 text-slate-700'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleEditGrupo(grp.id)}
                              className="mt-0.5 rounded border-slate-300 text-purple-600 focus:ring-purple-500 h-3.5 w-3.5"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="truncate font-medium flex items-center justify-between gap-1">
                                <span>{grp.nome}</span>
                                <span className="text-[10px] text-purple-700 bg-purple-100/70 px-1 rounded font-normal">
                                  {qtdEmp} {qtdEmp === 1 ? 'empresa' : 'empresas'}
                                </span>
                              </div>
                              {grp.descricao && (
                                <div className="text-[10px] text-slate-400 truncate">
                                  {grp.descricao}
                                </div>
                              )}
                            </div>
                          </label>
                        )
                      })
                    )}
                  </div>
                </div>

                {/* SEÇÃO EMPRESAS INDIVIDUAIS */}
                <div className="space-y-2 bg-blue-50/50 p-3 rounded-lg border border-blue-100">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-blue-900 flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-blue-600" />
                      Empresas Individuais
                    </Label>
                    <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-[10px] font-bold px-1.5 py-0">
                      {(editForm.empresas || []).length} selecionada(s)
                    </Badge>
                  </div>
                  <p className="text-[11px] text-blue-700/80">
                    Marque ou desmarque as empresas às quais o usuário tem acesso individualmente.
                  </p>

                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={selectAllEditEmpresas}
                      className="h-6 text-[10px] px-2 bg-white hover:bg-blue-50 text-blue-700 border-blue-200"
                    >
                      Marcar todas ({empresas.length})
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={clearAllEditEmpresas}
                      disabled={(editForm.empresas || []).length === 0}
                      className="h-6 text-[10px] px-2 bg-white hover:bg-slate-100 text-slate-600 border-slate-200"
                    >
                      Desmarcar todas
                    </Button>
                  </div>

                  <div className="max-h-44 overflow-y-auto space-y-1 bg-white p-2 rounded border border-blue-100">
                    {empresas.length === 0 ? (
                      <p className="text-xs text-slate-400 italic p-2 text-center">
                        Nenhuma empresa cadastrada
                      </p>
                    ) : (
                      empresas.map((emp) => {
                        const isSelected = (editForm.empresas || []).includes(emp.id)
                        return (
                          <label
                            key={emp.id}
                            className={`flex items-start gap-2.5 p-1.5 rounded cursor-pointer transition-colors text-xs ${
                              isSelected
                                ? 'bg-blue-50/80 text-blue-950 font-medium'
                                : 'hover:bg-slate-50 text-slate-700'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleEditEmpresa(emp.id)}
                              className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="truncate font-medium">
                                {emp.nome_fantasia || emp.nome}
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono truncate">
                                {emp.cnpj}
                              </div>
                            </div>
                          </label>
                        )
                      })
                    )}
                  </div>
                </div>
              </>
            )}
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div>
                <Label className="text-xs font-semibold text-slate-800">Status Ativo</Label>
                <p className="text-[11px] text-slate-500">Ativação da conta para acesso</p>
              </div>
              <Switch
                checked={editForm.ativo}
                disabled={selectedUser?.id === currentUser?.id}
                onCheckedChange={(checked) => setEditForm({ ...editForm, ativo: checked })}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setModalEditOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={editing}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {editing ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIALOG: REDEFINIR SENHA */}
      <Dialog open={modalPasswordOpen} onOpenChange={setModalPasswordOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#0B1F3A]">
              <KeyRound className="w-5 h-5 text-amber-600" />
              Redefinir Senha
            </DialogTitle>
            <DialogDescription className="text-xs">
              Defina uma nova senha para {selectedUser?.name || selectedUser?.email}.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleResetPassword} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Nova Senha *</Label>
              <Input
                type="password"
                placeholder="Mínimo 8 caracteres"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Confirmar Nova Senha *</Label>
              <Input
                type="password"
                placeholder="Repita a nova senha"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                required
                className="text-xs"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setModalPasswordOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={resettingPassword}
                className="bg-amber-600 hover:bg-amber-700 text-white"
              >
                {resettingPassword ? 'Gravando...' : 'Aplicar Nova Senha'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIALOG: CONFIRMAÇÃO DE EXCLUSÃO */}
      <Dialog open={modalDeleteOpen} onOpenChange={setModalDeleteOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              Confirmar Exclusão
            </DialogTitle>
            <DialogDescription className="text-xs">
              Tem certeza de que deseja excluir permanentemente o usuário{' '}
              <strong className="text-slate-800">
                {selectedUser?.name || selectedUser?.email}
              </strong>
              ? Esta operação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="pt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setModalDeleteOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={deleting}
              onClick={handleDeleteUser}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleting ? 'Excluindo...' : 'Sim, Excluir Usuário'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
