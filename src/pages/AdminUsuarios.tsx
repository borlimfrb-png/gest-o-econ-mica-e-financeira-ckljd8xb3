import React, { useState, useEffect, useMemo } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { empresasService } from '@/services/financeService'
import { usuariosService } from '@/services/usuariosService'
import type { UserRecord, EmpresaRecord, UserRole } from '@/types/finance'
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
} from 'lucide-react'
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
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterRole, setFilterRole] = useState<'todos' | 'admin' | 'empresa'>('todos')
  const [filterEmpresa, setFilterEmpresa] = useState<string>('todas')

  // Modais
  const [modalCreateOpen, setModalCreateOpen] = useState(false)
  const [modalEditOpen, setModalEditOpen] = useState(false)
  const [modalPasswordOpen, setModalPasswordOpen] = useState(false)
  const [modalDeleteOpen, setModalDeleteOpen] = useState(false)

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
    ativo: true,
  })
  const [creating, setCreating] = useState(false)

  // Formulário de Edição
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    role: 'empresa' as UserRole,
    empresa: '',
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
      const [uList, eList] = await Promise.all([usuariosService.getAll(), empresasService.getAll()])
      setUsuarios(uList)
      setEmpresas(eList)
    } catch (err: any) {
      console.error('Erro ao carregar usuários e empresas:', err)
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

  // Filtragem de usuários
  const filteredUsers = useMemo(() => {
    return usuarios.filter((u) => {
      const matchSearch =
        (u.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.email || '').toLowerCase().includes(searchTerm.toLowerCase())

      const matchRole = filterRole === 'todos' || (u.role || 'empresa') === filterRole

      const matchEmpresa = filterEmpresa === 'todas' || u.empresa === filterEmpresa

      return matchSearch && matchRole && matchEmpresa
    })
  }, [usuarios, searchTerm, filterRole, filterEmpresa])

  // Se não for admin e já carregou auth, redireciona
  if (!authLoading && !isAdmin) {
    return <Navigate to="/dashboard" replace />
  }

  // Handlers CRUD
  const handleOpenCreate = () => {
    setCreateForm({
      name: '',
      email: '',
      password: '',
      passwordConfirm: '',
      role: 'empresa',
      empresa: empresas.length > 0 ? empresas[0].id : '',
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

    if (createForm.role === 'empresa' && !createForm.empresa) {
      toast({
        variant: 'destructive',
        title: 'Empresa obrigatória',
        description: 'Selecione uma empresa para vincular o usuário.',
      })
      return
    }

    setCreating(true)
    try {
      await usuariosService.create(createForm)
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
    setEditForm({
      name: user.name || '',
      email: user.email || '',
      role: (user.role as UserRole) || 'empresa',
      empresa: user.empresa || (empresas.length > 0 ? empresas[0].id : ''),
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

    if (editForm.role === 'empresa' && !editForm.empresa) {
      toast({
        variant: 'destructive',
        title: 'Empresa obrigatória',
        description: 'Selecione uma empresa para este usuário.',
      })
      return
    }

    setEditing(true)
    try {
      await usuariosService.update(selectedUser.id, {
        name: editForm.name,
        email: editForm.email,
        role: editForm.role,
        empresa: editForm.role === 'empresa' ? editForm.empresa : null,
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

        <div className="flex items-center gap-2">
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-white border-slate-200">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Total de Usuários
              </p>
              <h3 className="text-2xl font-extrabold text-[#0B1F3A] mt-1">{usuarios.length}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
              <Users className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Administradores (Super)
              </p>
              <h3 className="text-2xl font-extrabold text-blue-700 mt-1">
                {usuarios.filter((u) => u.role === 'admin').length}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
              <Shield className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Usuários de Empresa (Isolados)
              </p>
              <h3 className="text-2xl font-extrabold text-emerald-700 mt-1">
                {usuarios.filter((u) => (u.role || 'empresa') === 'empresa').length}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <Building2 className="w-5 h-5" />
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
                  <SelectItem value="admin">Administrador (Total)</SelectItem>
                  <SelectItem value="empresa">Usuário de Empresa</SelectItem>
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
                            <p className="font-semibold text-slate-800 truncate flex items-center gap-1.5">
                              {u.name || 'Sem nome'}
                              {isSelf && (
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] py-0 px-1 bg-blue-50 text-blue-700 border-blue-200"
                                >
                                  Você
                                </Badge>
                              )}
                            </p>
                            <p className="text-[11px] text-slate-500 truncate flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              {u.email}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        {isUserAdmin ? (
                          <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100 border border-purple-200 text-xs font-semibold gap-1">
                            <Shield className="w-3 h-3" />
                            Administrador
                          </Badge>
                        ) : (
                          <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 text-xs font-semibold gap-1">
                            <Building2 className="w-3 h-3" />
                            Usuário Empresa
                          </Badge>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        {isUserAdmin ? (
                          <span className="text-slate-500 font-medium italic">
                            Todas as Empresas (Global)
                          </span>
                        ) : (
                          <div className="flex items-center gap-1.5 text-slate-800 font-medium">
                            <Building2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                            <span className="truncate max-w-[240px]">
                              {getEmpresaNome(u.empresa)}
                            </span>
                          </div>
                        )}
                      </td>

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
                  <SelectItem value="empresa" className="text-xs">
                    Usuário de Empresa (Acessa apenas sua empresa)
                  </SelectItem>
                  <SelectItem value="admin" className="text-xs">
                    Administrador (Acesso total e gerenciamento)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {createForm.role === 'empresa' && (
              <div className="space-y-1.5 bg-blue-50/50 p-3 rounded-lg border border-blue-100">
                <Label className="text-xs font-semibold text-blue-900 flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-blue-600" />
                  Empresa Vinculada *
                </Label>
                <p className="text-[11px] text-blue-700/80 mb-1">
                  O usuário verá única e exclusivamente as informações financeiras e cadastrais
                  desta empresa.
                </p>
                <Select
                  value={createForm.empresa}
                  onValueChange={(val) => setCreateForm({ ...createForm, empresa: val })}
                >
                  <SelectTrigger className="text-xs bg-white">
                    <SelectValue placeholder="Selecione a empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    {empresas.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id} className="text-xs">
                        {emp.nome_fantasia || emp.nome} ({emp.cnpj})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
                  <SelectItem value="empresa" className="text-xs">
                    Usuário de Empresa (Acessa apenas sua empresa)
                  </SelectItem>
                  <SelectItem value="admin" className="text-xs">
                    Administrador (Acesso total e gerenciamento)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {editForm.role === 'empresa' && (
              <div className="space-y-1.5 bg-blue-50/50 p-3 rounded-lg border border-blue-100">
                <Label className="text-xs font-semibold text-blue-900 flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-blue-600" />
                  Empresa Vinculada *
                </Label>
                <Select
                  value={editForm.empresa}
                  onValueChange={(val) => setEditForm({ ...editForm, empresa: val })}
                >
                  <SelectTrigger className="text-xs bg-white">
                    <SelectValue placeholder="Selecione a empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    {empresas.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id} className="text-xs">
                        {emp.nome_fantasia || emp.nome} ({emp.cnpj})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
