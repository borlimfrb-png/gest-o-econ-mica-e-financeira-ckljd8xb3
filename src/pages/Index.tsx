import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
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
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export default function Index() {
  const { login, signup, isAuthenticated, isLoading } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login')

  // Form states
  const [loginEmail, setLoginEmail] = useState('flavio@borlim.com.br')
  const [loginPassword, setLoginPassword] = useState('Skip@Pass')
  const [loginErrors, setLoginErrors] = useState<{ email?: string; password?: string }>({})

  const [signupName, setSignupName] = useState('')
  const [signupEmail, setSignupEmail] = useState('')
  const [signupPassword, setSignupPassword] = useState('')
  const [signupErrors, setSignupErrors] = useState<{
    name?: string
    email?: string
    password?: string
  }>({})

  const [submitting, setSubmitting] = useState(false)
  const [generalError, setGeneralError] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate('/dashboard', { replace: true })
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
      navigate('/dashboard')
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
      navigate('/dashboard')
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
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-600/30">
              <Scale className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight text-white block">
                Analise de Balanço
              </span>
              <span className="text-xs uppercase tracking-wider text-blue-300 font-medium">
                Consultoria Financeira
              </span>
            </div>
          </div>

          <div className="mt-20 max-w-lg">
            <h1 className="text-4xl font-extrabold text-white leading-tight tracking-tight">
              Análise financeira de precisão para tomada de decisões estratégicas.
            </h1>
            <p className="mt-4 text-blue-100/80 text-base leading-relaxed">
              Plataforma completa de diagnóstico econômico-financeiro: Balanço Patrimonial, DRE,
              indicadores de liquidez, endividamento, rentabilidade e estrutura de capital com
              análise horizontal e vertical automática.
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
          <span>© {new Date().getFullYear()} Analise de Balanço</span>
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-4 h-4 text-emerald-400" /> Ambiente Corporativo Seguro
          </span>
        </div>
      </div>

      {/* Coluna Direita - Formulário de Login / Cadastro */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 sm:p-10 bg-[#F5F7FA] text-slate-900 min-h-screen">
        <div className="w-full max-w-[440px]">
          {/* Logo mobile */}
          <div className="flex lg:hidden items-center justify-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md">
              <Scale className="w-5 h-5" />
            </div>
            <div className="text-left">
              <span className="text-lg font-bold text-slate-900 block leading-tight">
                Analise de Balanço
              </span>
              <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                Consultoria Financeira
              </span>
            </div>
          </div>

          {/* Card Principal */}
          <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/70 border border-slate-200/80 p-8">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-[#0B1F3A] tracking-tight">
                {activeTab === 'login' ? 'Acesse sua conta' : 'Criar nova conta'}
              </h2>
              <p className="text-sm text-[#5B6B7F] mt-1">
                {activeTab === 'login'
                  ? 'Informe suas credenciais para acessar o painel'
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
                          toast({
                            title: 'Recuperação de Senha',
                            description:
                              'Para demonstração, utilize a senha padrão Skip@Pass para o usuário seed.',
                          })
                        }}
                        className="text-xs text-blue-600 hover:text-blue-800 hover:underline font-medium"
                      >
                        Esqueceu a senha?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        id="login-password"
                        type="password"
                        placeholder="••••••••"
                        value={loginPassword}
                        onChange={(e) => {
                          setLoginPassword(e.target.value)
                          if (loginErrors.password)
                            setLoginErrors((prev) => ({ ...prev, password: undefined }))
                        }}
                        className={`pl-9 h-11 text-sm bg-slate-50/50 border-slate-200 focus:bg-white focus:border-blue-600 ${
                          loginErrors.password
                            ? 'border-red-500 focus:border-red-500 ring-red-200'
                            : ''
                        }`}
                      />
                    </div>
                    {loginErrors.password && (
                      <p className="text-xs text-red-600 font-medium">{loginErrors.password}</p>
                    )}
                  </div>

                  <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-lg text-xs text-blue-900 flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold">Credenciais de teste:</span>
                      <br />
                      flavio@borlim.com.br / Skip@Pass
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={submitting}
                    className="w-full h-11 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-md shadow-blue-600/20 active:scale-[0.99] transition-all"
                  >
                    {submitting ? 'Entrando...' : 'Entrar no Sistema'}
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
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        id="signup-password"
                        type="password"
                        placeholder="Mínimo 8 caracteres"
                        value={signupPassword}
                        onChange={(e) => {
                          setSignupPassword(e.target.value)
                          if (signupErrors.password)
                            setSignupErrors((prev) => ({ ...prev, password: undefined }))
                        }}
                        className={`pl-9 h-11 text-sm bg-slate-50/50 border-slate-200 focus:bg-white focus:border-blue-600 ${
                          signupErrors.password
                            ? 'border-red-500 focus:border-red-500 ring-red-200'
                            : ''
                        }`}
                      />
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

          <p className="text-center text-xs text-slate-500 mt-6">
            Analise de Balanço · Consultoria Financeira &copy; {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  )
}
