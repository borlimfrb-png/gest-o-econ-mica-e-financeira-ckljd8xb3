import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Scale,
  Lock,
  Mail,
  User,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Building2,
  TrendingUp,
  ShieldCheck,
  Eye,
  EyeOff,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { minhaEmpresaService } from '@/services/minhaEmpresaService'
import { BorlimLogo } from '@/components/BorlimLogo'
import { ThemeToggle } from '@/components/ThemeToggle'
import type { MinhaEmpresaRecord } from '@/types/finance'
import pb from '@/lib/pocketbase/client'

export default function Index() {
  const { login, signup, isAuthenticated, isLoading, requestPasswordReset } = useAuth()
  const [empresaPublica, setEmpresaPublica] = useState<MinhaEmpresaRecord | null>(null)
  const [resetModalOpen, setResetModalOpen] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [resetSuccess, setResetSuccess] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)
  const navigate = useNavigate()
  const { toast } = useToast()

  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login')

  // Form states
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [showLoginPassword, setShowLoginPassword] = useState(false)
  const [loginErrors, setLoginErrors] = useState<{ email?: string; password?: string }>({})

  const [signupName, setSignupName] = useState('')
  const [signupEmail, setSignupEmail] = useState('')
  const [signupPassword, setSignupPassword] = useState('')
  const [showSignupPassword, setShowSignupPassword] = useState(false)
  const [signupErrors, setSignupErrors] = useState<{
    name?: string
    email?: string
    password?: string
  }>({})

  const [submitting, setSubmitting] = useState(false)
  const [generalError, setGeneralError] = useState<string | null>(null)

  useEffect(() => {
    document.title = 'GESTÃO FINANCEIRA E ECONÔMICA'
  }, [])

  useEffect(() => {
    let isMounted = true
    const carregarEmpresaPublica = async () => {
      try {
        const dados = await minhaEmpresaService.getPublico()
        if (isMounted && dados) {
          setEmpresaPublica(dados)
        }
      } catch (err) {
        console.error('Erro ao buscar dados públicos da consultoria na tela de login:', err)
      }
    }
    carregarEmpresaPublica()
    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate('/splash', { replace: true })
    }
  }, [isAuthenticated, isLoading, navigate])

  const validateLogin = () => {
    const errors: { email?: string; password?: string } = {}
    if (!loginEmail.trim()) {
      errors.email = 'E-mail é obrigatório'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginEmail.trim())) {
      errors.email = 'E-mail inválido'
    }
    if (!loginPassword) {
      errors.password = 'Senha é obrigatória'
    }
    setLoginErrors(errors)
    return Object.keys(errors).length === 0
  }

  const validateSignup = () => {
    const errors: { name?: string; email?: string; password?: string } = {}
    if (!signupName.trim() || signupName.trim().length < 3) {
      errors.name = 'Nome completo deve ter pelo menos 3 caracteres'
    }
    if (!signupEmail.trim()) {
      errors.email = 'E-mail é obrigatório'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signupEmail.trim())) {
      errors.email = 'E-mail inválido'
    }
    if (!signupPassword || signupPassword.length < 8) {
      errors.password = 'Senha deve ter no mínimo 8 caracteres'
    }
    setSignupErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setGeneralError(null)
    if (!validateLogin()) return

    setSubmitting(true)
    try {
      await login(loginEmail, loginPassword)
      toast({
        title: 'Bem-vindo de volta!',
        description: 'Autenticação realizada com sucesso.',
      })
      navigate('/splash')
    } catch (err: any) {
      console.error('Login error:', err)
      setGeneralError(
        err?.message || 'E-mail ou senha incorretos. Verifique suas credenciais e tente novamente.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setGeneralError(null)
    if (!validateSignup()) return

    setSubmitting(true)
    try {
      await signup(signupEmail, signupPassword, signupName)
      toast({
        title: 'Conta criada com sucesso!',
        description: 'Você já está conectado ao sistema.',
      })
      navigate('/splash')
    } catch (err: any) {
      console.error('Signup error:', err)
      setGeneralError(
        err?.data?.data?.email?.message ||
          err?.message ||
          'Não foi possível criar a conta. Este e-mail já pode estar em uso.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row bg-[#0B1F3A] text-slate-100 selection:bg-blue-600 selection:text-white">
      {/* Coluna Esquerda - Apresentação Corporativa (desktop) */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 bg-gradient-to-br from-[#0B1F3A] via-[#122b52] to-[#1e3a8a] border-r border-blue-900/30 relative overflow-hidden">
        {/* Glow decoration */}
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BorlimLogo
                size="lg"
                variant="light"
                showSubtitle={true}
                subtitle="Análise de Balanço & Gestão Financeira"
                className="shadow-lg"
              />
            </div>

            <ThemeToggle size="sm" />
          </div>

          <div className="mt-14 max-w-lg">
            <h1 className="text-3xl lg:text-4xl font-extrabold text-white leading-tight tracking-tight">
              Análise financeira de precisão para tomada de decisões estratégicas.
            </h1>
            <p className="mt-4 text-blue-100/80 text-base leading-relaxed">
              Plataforma desenvolvida pela{' '}
              <strong className="text-sky-300">Borlim Consultoria</strong> para diagnóstico
              econômico-financeiro: Balanço Patrimonial, DRE, indicadores de liquidez,
              endividamento, rentabilidade e estrutura de capital com análise horizontal e vertical
              automática.
            </p>
          </div>
        </div>

        {/* Badges de recursos */}
        <div className="relative z-10 space-y-4 max-w-md pt-8">
          <div className="flex items-start gap-3 bg-white/5 backdrop-blur-md p-3.5 rounded-xl border border-white/10">
            <div className="p-2 rounded-lg bg-blue-500/20 text-blue-300">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">Indicadores em Tempo Real</h4>
              <p className="text-xs text-blue-200/70 mt-0.5">
                Cálculo instantâneo de liquidez, margens, ROE, ROA e alavancagem com interpretações
                do consultor.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 bg-white/5 backdrop-blur-md p-3.5 rounded-xl border border-white/10">
            <div className="p-2 rounded-lg bg-blue-500/20 text-blue-300">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">Gestão Multiclientes & Períodos</h4>
              <p className="text-xs text-blue-200/70 mt-0.5">
                Acompanhe a evolução histórica ano a ano e gere relatórios executivos em formato A4
                e CSV.
              </p>
            </div>
          </div>
        </div>

        <div className="relative z-10 pt-6 text-xs text-blue-300/60 flex items-center justify-between border-t border-white/10">
          <span>
            © {new Date().getFullYear()} Borlim Consultoria · www.borlimconsultoria.com.br
          </span>
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-4 h-4 text-emerald-400" /> Ambiente Corporativo Seguro
          </span>
        </div>
      </div>

      {/* Coluna Direita - Formulário de Login / Cadastro com suporte ao modo escuro */}
      <div className="flex-1 flex flex-col justify-center items-center p-4 sm:p-8 bg-[#F5F7FA] dark:bg-slate-950 text-slate-900 dark:text-slate-100 min-h-screen relative theme-transition">
        {/* Toggle no topo direito do form em telas grandes/médias */}
        <div className="absolute top-4 right-4 lg:hidden">
          <ThemeToggle size="sm" />
        </div>

        <div className="w-full max-w-[420px] py-4">
          {/* Identificação Mobile com Logo Borlim */}
          <div className="flex lg:hidden flex-col items-center justify-center gap-2 mb-4 text-center">
            <BorlimLogo size="lg" />
          </div>

          {/* Card Principal Moderno com Elevação Suave e Borda Sutil */}
          <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl shadow-xl shadow-slate-300/40 dark:shadow-black/50 border border-slate-200/80 dark:border-slate-800 p-6 sm:p-8 relative overflow-hidden theme-transition">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 via-sky-500 to-indigo-600" />
            <div className="text-center mb-5">
              <div className="inline-flex items-center justify-center mb-3">
                <BorlimLogo size="md" variant="auto" />
              </div>
              <h2 className="text-xl font-extrabold text-[#0B1F3A] dark:text-white tracking-tight">
                {activeTab === 'login' ? 'Acesse sua conta' : 'Criar nova conta'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {activeTab === 'login'
                  ? 'Borlim Consultoria Empresarial · Plataforma de Inteligência Financeira'
                  : 'Preencha os dados abaixo para começar'}
              </p>
            </div>

            {generalError && (
              <Alert variant="destructive" className="mb-5 bg-red-50 border-red-200 text-red-800">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-xs font-medium">{generalError}</AlertDescription>
              </Alert>
            )}

            <Tabs
              value={activeTab}
              onValueChange={(val) => {
                setActiveTab(val as 'login' | 'signup')
                setGeneralError(null)
              }}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-2 mb-6 bg-slate-100 p-1 rounded-xl">
                <TabsTrigger
                  value="login"
                  className="rounded-lg text-sm font-semibold data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm transition-all"
                >
                  Entrar
                </TabsTrigger>
                <TabsTrigger
                  value="signup"
                  className="rounded-lg text-sm font-semibold data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm transition-all"
                >
                  Criar conta
                </TabsTrigger>
              </TabsList>

              {/* Aba ENTRAR */}
              <TabsContent value="login" className="space-y-4 focus-visible:outline-none">
                <form onSubmit={handleLoginSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="login-email" className="text-xs font-semibold text-slate-700">
                      E-mail corporativo
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        id="login-email"
                        type="email"
                        placeholder="seu.email@empresa.com"
                        value={loginEmail}
                        onChange={(e) => {
                          setLoginEmail(e.target.value)
                          if (loginErrors.email)
                            setLoginErrors((prev) => ({ ...prev, email: undefined }))
                        }}
                        className={`pl-9 h-11 text-sm bg-slate-50/50 border-slate-200 focus:bg-white focus:border-blue-600 ${
                          loginErrors.email
                            ? 'border-red-500 focus:border-red-500 ring-red-200'
                            : ''
                        }`}
                      />
                    </div>
                    {loginErrors.email && (
                      <p className="text-xs text-red-600 font-medium">{loginErrors.email}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label
                        htmlFor="login-password"
                        className="text-xs font-semibold text-slate-700"
                      >
                        Senha
                      </Label>
                      <button
                        type="button"
                        onClick={() => {
                          setResetEmail(loginEmail || '')
                          setResetSuccess(false)
                          setResetError(null)
                          setResetModalOpen(true)
                        }}
                        className="text-xs text-blue-600 hover:text-blue-800 hover:underline font-medium cursor-pointer"
                      >
                        Esqueceu a senha?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      <Input
                        id="login-password"
                        type={showLoginPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={loginPassword}
                        onChange={(e) => {
                          setLoginPassword(e.target.value)
                          if (loginErrors.password)
                            setLoginErrors((prev) => ({ ...prev, password: undefined }))
                        }}
                        className={`pl-9 pr-10 h-11 text-sm bg-slate-50/50 border-slate-200 focus:bg-white focus:border-blue-600 ${
                          loginErrors.password
                            ? 'border-red-500 focus:border-red-500 ring-red-200'
                            : ''
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowLoginPassword((prev) => !prev)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 focus:outline-none transition-colors p-1"
                        aria-label={
                          showLoginPassword ? 'Ocultar senha digitada' : 'Visualizar senha digitada'
                        }
                        title={showLoginPassword ? 'Ocultar senha' : 'Ver senha'}
                      >
                        {showLoginPassword ? (
                          <EyeOff className="w-4 h-4 text-blue-600" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                    {loginErrors.password && (
                      <p className="text-xs text-red-600 font-medium">{loginErrors.password}</p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    disabled={submitting}
                    className="w-full h-11 text-sm font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl shadow-md shadow-blue-600/25 active:scale-[0.99] transition-all cursor-pointer"
                  >
                    {submitting ? 'Entrando...' : 'Entrar na Plataforma'}
                    {!submitting && <ArrowRight className="ml-2 w-4 h-4" />}
                  </Button>
                </form>
              </TabsContent>

              {/* Aba CRIAR CONTA */}
              <TabsContent value="signup" className="space-y-4 focus-visible:outline-none">
                <form onSubmit={handleSignupSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="signup-name" className="text-xs font-semibold text-slate-700">
                      Nome completo
                    </Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        id="signup-name"
                        type="text"
                        placeholder="Ex: Carlos Eduardo Silveira"
                        value={signupName}
                        onChange={(e) => {
                          setSignupName(e.target.value)
                          if (signupErrors.name)
                            setSignupErrors((prev) => ({ ...prev, name: undefined }))
                        }}
                        className={`pl-9 h-11 text-sm bg-slate-50/50 border-slate-200 focus:bg-white focus:border-blue-600 ${
                          signupErrors.name
                            ? 'border-red-500 focus:border-red-500 ring-red-200'
                            : ''
                        }`}
                      />
                    </div>
                    {signupErrors.name && (
                      <p className="text-xs text-red-600 font-medium">{signupErrors.name}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="signup-email" className="text-xs font-semibold text-slate-700">
                      E-mail corporativo
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="seu.email@empresa.com"
                        value={signupEmail}
                        onChange={(e) => {
                          setSignupEmail(e.target.value)
                          if (signupErrors.email)
                            setSignupErrors((prev) => ({ ...prev, email: undefined }))
                        }}
                        className={`pl-9 h-11 text-sm bg-slate-50/50 border-slate-200 focus:bg-white focus:border-blue-600 ${
                          signupErrors.email
                            ? 'border-red-500 focus:border-red-500 ring-red-200'
                            : ''
                        }`}
                      />
                    </div>
                    {signupErrors.email && (
                      <p className="text-xs text-red-600 font-medium">{signupErrors.email}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label
                      htmlFor="signup-password"
                      className="text-xs font-semibold text-slate-700"
                    >
                      Senha (mínimo 8 caracteres)
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      <Input
                        id="signup-password"
                        type={showSignupPassword ? 'text' : 'password'}
                        placeholder="Mínimo 8 caracteres"
                        value={signupPassword}
                        onChange={(e) => {
                          setSignupPassword(e.target.value)
                          if (signupErrors.password)
                            setSignupErrors((prev) => ({ ...prev, password: undefined }))
                        }}
                        className={`pl-9 pr-10 h-11 text-sm bg-slate-50/50 border-slate-200 focus:bg-white focus:border-blue-600 ${
                          signupErrors.password
                            ? 'border-red-500 focus:border-red-500 ring-red-200'
                            : ''
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowSignupPassword((prev) => !prev)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 focus:outline-none transition-colors p-1"
                        aria-label={
                          showSignupPassword
                            ? 'Ocultar senha digitada'
                            : 'Visualizar senha digitada'
                        }
                        title={showSignupPassword ? 'Ocultar senha' : 'Ver senha'}
                      >
                        {showSignupPassword ? (
                          <EyeOff className="w-4 h-4 text-blue-600" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                    {signupErrors.password && (
                      <p className="text-xs text-red-600 font-medium">{signupErrors.password}</p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    disabled={submitting}
                    className="w-full h-11 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-md shadow-blue-600/20 active:scale-[0.99] transition-all"
                  >
                    {submitting ? 'Criando conta...' : 'Criar Conta e Acessar'}
                    {!submitting && <ArrowRight className="ml-2 w-4 h-4" />}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </div>

          <p className="text-center text-xs text-slate-500 dark:text-slate-400 mt-6">
            Borlim Consultoria &copy; {new Date().getFullYear()} · Análise de Balanço
            {empresaPublica?.nome_fantasia || empresaPublica?.razao_social
              ? ` · ${empresaPublica.nome_fantasia || empresaPublica.razao_social}`
              : ''}
          </p>
        </div>
      </div>

      {/* Modal de Recuperação de Senha */}
      <Dialog open={resetModalOpen} onOpenChange={setResetModalOpen}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#0B1F3A] flex items-center gap-2">
              <Mail className="w-5 h-5 text-blue-600" />
              Recuperação de Senha
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Informe o e-mail cadastrado da sua conta corporativa. Enviaremos um link seguro para
              você redefinir sua senha.
            </DialogDescription>
          </DialogHeader>

          {resetSuccess ? (
            <div className="py-4 space-y-4">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-xs font-bold text-emerald-900">
                    E-mail de recuperação enviado!
                  </p>
                  <p className="text-xs text-emerald-800">
                    Se o endereço <strong className="font-semibold">{resetEmail}</strong> estiver
                    cadastrado no sistema, você receberá uma mensagem com as instruções para
                    cadastrar uma nova senha.
                  </p>
                </div>
              </div>
              <div className="text-[11px] text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-100">
                <strong>Nota:</strong> Caso a entrega de e-mails do servidor ainda não esteja com
                SMTP personalizado configurado na infraestrutura, o administrador da sua empresa ou
                suporte técnico pode redefinir sua credencial manualmente no módulo{' '}
                <em>Usuários & Permissões</em>.
              </div>
              <Button
                type="button"
                onClick={() => setResetModalOpen(false)}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-9 shadow-xs"
              >
                Voltar ao Login
              </Button>
            </div>
          ) : (
            <form
              onSubmit={async (e) => {
                e.preventDefault()
                const trimmed = resetEmail.trim().toLowerCase()
                if (!trimmed || !trimmed.includes('@')) {
                  setResetError('Informe um e-mail válido.')
                  return
                }

                setResetLoading(true)
                setResetError(null)

                try {
                  await requestPasswordReset(trimmed)
                  setResetSuccess(true)
                  toast({
                    title: 'Solicitação enviada',
                    description: 'Verifique sua caixa de entrada e spam para redefinir a senha.',
                  })
                } catch (err: any) {
                  console.error('Erro no fluxo de recuperação:', err)
                  // PocketBase normalmente retorna 200/true mesmo que não exista para evitar enumeration, ou erro de SMTP
                  setResetError(
                    err?.message ||
                      'Não foi possível enviar o e-mail de recuperação. O serviço de envio pode estar em manutenção.',
                  )
                } finally {
                  setResetLoading(false)
                }
              }}
              className="space-y-4 pt-2"
            >
              {resetError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{resetError}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="reset-email-input" className="text-xs font-semibold text-slate-700">
                  Seu E-mail Corporativo
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    id="reset-email-input"
                    type="email"
                    required
                    placeholder="seu.email@empresa.com"
                    value={resetEmail}
                    onChange={(e) => {
                      setResetEmail(e.target.value)
                      if (resetError) setResetError(null)
                    }}
                    className="pl-9 h-10 text-xs bg-slate-50/50"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setResetModalOpen(false)}
                  disabled={resetLoading}
                  className="text-xs h-9"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={resetLoading}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-9 shadow-xs"
                >
                  {resetLoading ? 'Enviando...' : 'Enviar Link de Redefinição'}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
