import React, { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import pb from '@/lib/pocketbase/client'
import { useToast } from '@/hooks/use-toast'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  User,
  Camera,
  KeyRound,
  Bell,
  CheckCircle2,
  Lock,
  Mail,
  Shield,
  UploadCloud,
  Trash2,
  RefreshCw,
} from 'lucide-react'

export default function Configuracoes() {
  const { user } = useAuth()
  const { toast } = useToast()

  // Estado Foto de Perfil
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [savingAvatar, setSavingAvatar] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Estado Dados Pessoais / Nome
  const [nome, setNome] = useState('')
  const [savingNome, setSavingNome] = useState(false)

  // Estado Senha
  const [oldPassword, setOldPassword] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)

  // Estado Notificações
  const [receberAlertasEmail, setReceberAlertasEmail] = useState(true)
  const [savingAlertas, setSavingAlertas] = useState(false)

  // Atualizar estado inicial a partir do usuário autenticado
  useEffect(() => {
    if (user) {
      setNome(user.name || '')
      setReceberAlertasEmail(user.receber_alertas_email ?? true)

      if (user.avatar) {
        const url = pb.files.getURL(user, user.avatar)
        setAvatarPreview(url)
      } else {
        setAvatarPreview(null)
      }
    }
  }, [user])

  // Handlers para Foto de Perfil
  const handleSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast({
        variant: 'destructive',
        title: 'Formato inválido',
        description: 'Por favor, selecione um arquivo de imagem (PNG, JPG, WEBP).',
      })
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        variant: 'destructive',
        title: 'Arquivo muito grande',
        description: 'A foto deve ter no máximo 5MB.',
      })
      return
    }

    setAvatarFile(file)
    const reader = new FileReader()
    reader.onload = () => {
      setAvatarPreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleSalvarFoto = async () => {
    if (!user) return
    if (!avatarFile) {
      toast({
        variant: 'destructive',
        title: 'Nenhuma nova imagem',
        description: 'Selecione uma imagem antes de salvar.',
      })
      return
    }

    setSavingAvatar(true)
    try {
      const formData = new FormData()
      formData.append('avatar', avatarFile)

      await pb.collection('users').update(user.id, formData)
      toast({
        title: 'Foto de perfil atualizada!',
        description: 'Sua foto de perfil foi alterada com sucesso.',
      })
      setAvatarFile(null)
    } catch (err: any) {
      console.error('Erro ao salvar foto:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao atualizar foto',
        description: err?.message || 'Não foi possível salvar o avatar.',
      })
    } finally {
      setSavingAvatar(false)
    }
  }

  const handleRemoverFoto = async () => {
    if (!user) return
    setSavingAvatar(true)
    try {
      await pb.collection('users').update(user.id, {
        avatar: null,
      })
      setAvatarFile(null)
      setAvatarPreview(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      toast({
        title: 'Foto removida!',
        description: 'Sua foto de perfil foi redefinida.',
      })
    } catch (err: any) {
      console.error('Erro ao remover foto:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao remover foto',
        description: err?.message || 'Não foi possível remover o avatar.',
      })
    } finally {
      setSavingAvatar(false)
    }
  }

  // Handler para Nome
  const handleSalvarNome = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    if (!nome.trim()) {
      toast({
        variant: 'destructive',
        title: 'Nome obrigatório',
        description: 'O campo nome não pode estar vazio.',
      })
      return
    }

    setSavingNome(true)
    try {
      await pb.collection('users').update(user.id, {
        name: nome.trim(),
      })
      toast({
        title: 'Nome atualizado com sucesso!',
        description: 'Seus dados pessoais foram salvos.',
      })
    } catch (err: any) {
      console.error('Erro ao atualizar nome:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar nome',
        description: err?.message || 'Verifique as informações.',
      })
    } finally {
      setSavingNome(false)
    }
  }

  // Handler para Senha
  const handleSalvarSenha = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    if (!oldPassword) {
      toast({
        variant: 'destructive',
        title: 'Senha atual obrigatória',
        description: 'Informe sua senha atual para autorizar a troca.',
      })
      return
    }

    if (password.length < 8) {
      toast({
        variant: 'destructive',
        title: 'Senha muito curta',
        description: 'A nova senha deve ter no mínimo 8 caracteres.',
      })
      return
    }

    if (password !== passwordConfirm) {
      toast({
        variant: 'destructive',
        title: 'Senhas não conferem',
        description: 'A confirmação de senha é diferente da nova senha.',
      })
      return
    }

    setSavingPassword(true)
    try {
      await pb.collection('users').update(user.id, {
        oldPassword,
        password,
        passwordConfirm,
      })

      setOldPassword('')
      setPassword('')
      setPasswordConfirm('')

      toast({
        title: 'Senha alterada com sucesso!',
        description: 'Sua nova senha de acesso foi salva.',
      })
    } catch (err: any) {
      console.error('Erro ao alterar senha:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao alterar senha',
        description:
          err?.data?.data?.oldPassword?.message ||
          err?.message ||
          'Verifique se a senha atual está correta.',
      })
    } finally {
      setSavingPassword(false)
    }
  }

  // Handler para Preferências de Notificação
  const handleToggleAlertas = async (checked: boolean) => {
    if (!user) return
    setReceberAlertasEmail(checked)
    setSavingAlertas(true)
    try {
      await pb.collection('users').update(user.id, {
        receber_alertas_email: checked,
      })
      toast({
        title: checked ? 'Alertas por e-mail ativados' : 'Alertas por e-mail desativados',
        description: checked
          ? 'Você receberá notificações automáticas quando metas estiverem em risco.'
          : 'O envio de e-mails diários de alertas foi pausado.',
      })
    } catch (err: any) {
      console.error('Erro ao atualizar preferências:', err)
      setReceberAlertasEmail(!checked) // reverte
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar preferência',
        description: err?.message || 'Não foi possível atualizar a preferência de alertas.',
      })
    } finally {
      setSavingAlertas(false)
    }
  }

  const userInitial = user?.name ? user.name.charAt(0).toUpperCase() : 'U'

  return (
    <div className="space-y-6 animate-fadeIn max-w-4xl">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-[#0B1F3A] tracking-tight">
          Configurações da Conta
        </h1>
        <p className="text-xs sm:text-sm text-[#5B6B7F] mt-1">
          Gerencie seu perfil de usuário, foto de exibição, credenciais de segurança e preferências
          de notificações.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* CARD 1: FOTO DE PERFIL */}
        <Card className="bg-white border-slate-200 shadow-2xs">
          <CardHeader className="pb-3 border-b border-slate-100">
            <CardTitle className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
              <Camera className="w-4 h-4 text-blue-600" />
              Foto de Perfil
            </CardTitle>
            <CardDescription className="text-xs">
              Personalize o avatar exibido no menu lateral e cabeçalho do sistema.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-5">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
              {/* Preview Circular */}
              <div className="relative group">
                <Avatar className="w-24 h-24 sm:w-28 sm:h-28 border-2 border-slate-200 shadow-sm bg-blue-600 text-white text-2xl font-bold">
                  {avatarPreview ? (
                    <AvatarImage src={avatarPreview} alt={user?.name || 'Avatar'} />
                  ) : null}
                  <AvatarFallback className="bg-blue-600 text-white font-bold text-2xl">
                    {userInitial}
                  </AvatarFallback>
                </Avatar>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-0 right-0 p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-md transition-transform hover:scale-105"
                  title="Alterar foto"
                >
                  <Camera className="w-4 h-4" />
                </button>
              </div>

              {/* Controles de Upload */}
              <div className="flex-1 space-y-3 text-center sm:text-left">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png, image/jpeg, image/webp"
                  onChange={handleSelectFile}
                  className="hidden"
                />

                <div>
                  <p className="text-xs font-semibold text-slate-800">Selecione uma imagem</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Formatos suportados: PNG, JPG ou WEBP. Tamanho máximo: 5MB.
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs font-semibold border-slate-200 hover:bg-slate-50 gap-1.5"
                  >
                    <UploadCloud className="w-3.5 h-3.5 text-blue-600" />
                    Escolher Arquivo...
                  </Button>

                  {avatarFile && (
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleSalvarFoto}
                      disabled={savingAvatar}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold gap-1.5"
                    >
                      {savingAvatar ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Salvando...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" /> Salvar Foto
                        </>
                      )}
                    </Button>
                  )}

                  {(avatarPreview || user?.avatar) && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleRemoverFoto}
                      disabled={savingAvatar}
                      className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Remover
                    </Button>
                  )}
                </div>

                {avatarFile && (
                  <p className="text-[11px] text-emerald-600 font-medium">
                    ✓ Arquivo selecionado: {avatarFile.name} ({(avatarFile.size / 1024).toFixed(0)}{' '}
                    KB). Clique em Salvar Foto.
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* CARD 2: DADOS PESSOAIS / ALTERAR NOME */}
        <Card className="bg-white border-slate-200 shadow-2xs">
          <CardHeader className="pb-3 border-b border-slate-100">
            <CardTitle className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
              <User className="w-4 h-4 text-blue-600" />
              Dados Pessoais
            </CardTitle>
            <CardDescription className="text-xs">
              Atualize as informações de identificação do seu cadastro.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-5">
            <form onSubmit={handleSalvarNome} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="nome" className="text-xs font-semibold text-slate-700">
                    Nome Completo *
                  </Label>
                  <Input
                    id="nome"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Seu nome completo"
                    className="h-9 text-xs"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs font-semibold text-slate-700">
                    E-mail de Acesso (Login)
                  </Label>
                  <div className="relative">
                    <Input
                      id="email"
                      value={user?.email || ''}
                      disabled
                      className="h-9 text-xs bg-slate-50 text-slate-500 pl-8 cursor-not-allowed"
                    />
                    <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  </div>
                  <p className="text-[10px] text-slate-400">
                    O e-mail principal é utilizado para autenticação no sistema.
                  </p>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  type="submit"
                  disabled={savingNome}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-9 px-4 gap-1.5"
                >
                  {savingNome ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Salvando...
                    </>
                  ) : (
                    'Salvar Alterações'
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* CARD 3: ALTERAR SENHA */}
        <Card className="bg-white border-slate-200 shadow-2xs">
          <CardHeader className="pb-3 border-b border-slate-100">
            <CardTitle className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-blue-600" />
              Segurança e Alteração de Senha
            </CardTitle>
            <CardDescription className="text-xs">
              Mantenha sua conta protegida utilizando uma senha forte com no mínimo 8 caracteres.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-5">
            <form onSubmit={handleSalvarSenha} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="oldPassword" className="text-xs font-semibold text-slate-700">
                  Senha Atual *
                </Label>
                <div className="relative">
                  <Input
                    id="oldPassword"
                    type="password"
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    placeholder="Digite sua senha atual"
                    className="h-9 text-xs pl-8"
                    required
                  />
                  <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-xs font-semibold text-slate-700">
                    Nova Senha *
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Mínimo 8 caracteres"
                      className="h-9 text-xs pl-8"
                      required
                      minLength={8}
                    />
                    <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="passwordConfirm" className="text-xs font-semibold text-slate-700">
                    Confirmar Nova Senha *
                  </Label>
                  <div className="relative">
                    <Input
                      id="passwordConfirm"
                      type="password"
                      value={passwordConfirm}
                      onChange={(e) => setPasswordConfirm(e.target.value)}
                      placeholder="Repita a nova senha"
                      className="h-9 text-xs pl-8"
                      required
                      minLength={8}
                    />
                    <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                  <Shield className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span>A senha deve ser mantida em sigilo.</span>
                </div>

                <Button
                  type="submit"
                  disabled={savingPassword}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-9 px-4 gap-1.5"
                >
                  {savingPassword ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Alterando...
                    </>
                  ) : (
                    'Atualizar Senha'
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* CARD 4: PREFERÊNCIAS DE NOTIFICAÇÃO */}
        <Card className="bg-white border-slate-200 shadow-2xs">
          <CardHeader className="pb-3 border-b border-slate-100">
            <CardTitle className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
              <Bell className="w-4 h-4 text-blue-600" />
              Preferências de Notificações
            </CardTitle>
            <CardDescription className="text-xs">
              Defina como você deseja receber avisos automáticos e monitoramento de metas.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#0B1F3A]">
                    Receber alertas de metas por e-mail
                  </span>
                  {receberAlertasEmail && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Ativo
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 max-w-xl">
                  Dispara e-mails diários automáticos para o endereço cadastrado (
                  <span className="font-semibold text-slate-700">{user?.email}</span>) quando metas
                  mensais, trimestrais ou anuais estiverem em risco de não atingimento ou sem
                  lançamentos.
                </p>
              </div>

              <Switch
                checked={receberAlertasEmail}
                onCheckedChange={handleToggleAlertas}
                disabled={savingAlertas}
                className="data-[state=checked]:bg-blue-600"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
