/* Main App Component - Sistema de Gestão Econômica e Financeira */
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { FilterProvider } from '@/contexts/FilterContext'
import { MinhaEmpresaProvider } from '@/contexts/MinhaEmpresaContext'
import { perfilTemAcesso, type ModuloSistema } from '@/lib/permissoesPerfis'

import { lazy, Suspense } from 'react'

import Index from './pages/Index'
import Layout from './components/Layout'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const Empresas = lazy(() => import('./pages/Empresas'))
const Centros = lazy(() => import('./pages/Centros'))
const AnaliseEmpresa = lazy(() => import('./pages/AnaliseEmpresa'))
const TiposDespesas = lazy(() => import('./pages/TiposDespesas'))
const Contas = lazy(() => import('./pages/Contas'))
const PlanoContas = lazy(() => import('./pages/PlanoContas'))
const Lancamentos = lazy(() => import('./pages/Lancamentos'))
const Financeiro = lazy(() => import('./pages/Financeiro'))
const BaixaRecebiveis = lazy(() => import('./pages/BaixaRecebiveis'))
const Contratos = lazy(() => import('./pages/Contratos'))
const NotasFiscais = lazy(() => import('./pages/NotasFiscais'))
const Relatorios = lazy(() => import('./pages/Relatorios'))
const CadastroProdutos = lazy(() => import('./pages/CadastroProdutos'))
const CadastroMateriaPrima = lazy(() => import('./pages/CadastroMateriaPrima'))
const CadastroFichaTecnica = lazy(() => import('./pages/CadastroFichaTecnica'))
const Impostos = lazy(() => import('./pages/Impostos'))
const SimuladorPrecos = lazy(() => import('./pages/SimuladorPrecos'))
const RelatorioAnual = lazy(() => import('./pages/RelatorioAnual'))
const IndicadoresLiquidez = lazy(() => import('./pages/IndicadoresLiquidez'))
const IndicadoresCapitalGiro = lazy(() => import('./pages/IndicadoresCapitalGiro'))
const IndicadoresEndividamento = lazy(() => import('./pages/IndicadoresEndividamento'))
const IndicadoresRentabilidade = lazy(() => import('./pages/IndicadoresRentabilidade'))
const IndicadoresEstruturaCapital = lazy(() => import('./pages/IndicadoresEstruturaCapital'))
const IndicadoresEbitda = lazy(() => import('./pages/IndicadoresEbitda'))
const IndicadoresEficienciaOperacional = lazy(
  () => import('./pages/IndicadoresEficienciaOperacional'),
)
const PainelIndicadores = lazy(() => import('./pages/PainelIndicadores'))
const IndicadoresEconomicos = lazy(() => import('./pages/IndicadoresEconomicos'))
const IndicadoresValuation = lazy(() => import('./pages/IndicadoresValuation'))
const IndicadoresPontoEquilibrio = lazy(() => import('./pages/IndicadoresPontoEquilibrio'))
const IndicadoresKanitz = lazy(() => import('./pages/IndicadoresKanitz'))
const AgenteIA = lazy(() => import('./pages/AgenteIA'))
const Importacao = lazy(() => import('./pages/Importacao'))
const AnaliseTributaria = lazy(() => import('./pages/AnaliseTributaria'))
const BalancedScorecard = lazy(() => import('./pages/BalancedScorecard'))
const Configuracoes = lazy(() => import('./pages/Configuracoes'))
const GruposEmpresariais = lazy(() => import('./pages/GruposEmpresariais'))
const DashboardEmpresa = lazy(() => import('./pages/DashboardEmpresa'))
const MinhaEmpresa = lazy(() => import('./pages/MinhaEmpresa'))
const AdminUsuarios = lazy(() => import('./pages/AdminUsuarios'))
const AdminAuditoria = lazy(() => import('./pages/AdminAuditoria'))
const NotFound = lazy(() => import('./pages/NotFound'))

// Componente para rotas exclusivas de administrador
function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isAdmin, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />
  }

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}

// Componente para rotas com verificação de perfil
function ModuloRoute({ modulo, children }: { modulo: ModuloSistema; children: React.ReactNode }) {
  const { user, isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />
  }

  if (!perfilTemAcesso(user?.role, modulo)) {
    const destino = user?.role === 'comercial' ? '/baixa-recebiveis' : '/dashboard'
    return <Navigate to={destino} replace />
  }

  return <>{children}</>
}

// Componente para rotas protegidas
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <MinhaEmpresaProvider>
        <FilterProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <Suspense
              fallback={
                <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center">
                  <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
                </div>
              }
            >
              <Routes>
                {/* Rota pública de login/cadastro */}
                <Route path="/" element={<Index />} />

                {/* Rotas autenticadas dentro do Layout Corporativo */}
                <Route
                  element={
                    <ProtectedRoute>
                      <Layout />
                    </ProtectedRoute>
                  }
                >
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/dashboard/empresa/:id" element={<DashboardEmpresa />} />
                  <Route path="/empresas" element={<Empresas />} />
                  <Route path="/cadastro/grupos-empresariais" element={<GruposEmpresariais />} />
                  <Route path="/grupos-empresariais" element={<GruposEmpresariais />} />
                  <Route path="/empresas/:id" element={<AnaliseEmpresa />} />
                  <Route path="/centros" element={<Centros />} />
                  <Route path="/tipos-despesas" element={<TiposDespesas />} />
                  <Route path="/contas" element={<Contas />} />
                  <Route path="/plano-contas" element={<PlanoContas />} />
                  <Route path="/minha-empresa" element={<MinhaEmpresa />} />
                  <Route path="/lancamentos" element={<Lancamentos />} />
                  <Route path="/financeiro" element={<Financeiro />} />
                  <Route path="/baixa-recebiveis" element={<BaixaRecebiveis />} />
                  <Route path="/contratos" element={<Contratos />} />
                  <Route path="/notas-fiscais" element={<NotasFiscais />} />
                  {/* Formação de Preço - Custo */}
                  <Route
                    path="/formacao-preco/produtos"
                    element={
                      <ModuloRoute modulo="formacao_preco">
                        <CadastroProdutos />
                      </ModuloRoute>
                    }
                  />
                  <Route
                    path="/formacao-preco/materia-prima"
                    element={
                      <ModuloRoute modulo="formacao_preco">
                        <CadastroMateriaPrima />
                      </ModuloRoute>
                    }
                  />
                  <Route
                    path="/formacao-preco/fichas-tecnicas"
                    element={
                      <ModuloRoute modulo="formacao_preco">
                        <CadastroFichaTecnica />
                      </ModuloRoute>
                    }
                  />
                  <Route
                    path="/formacao-preco/impostos"
                    element={
                      <ModuloRoute modulo="formacao_preco">
                        <Impostos />
                      </ModuloRoute>
                    }
                  />
                  <Route
                    path="/formacao-preco/simulador"
                    element={
                      <ModuloRoute modulo="formacao_preco">
                        <SimuladorPrecos />
                      </ModuloRoute>
                    }
                  />
                  <Route
                    path="/indicadores/painel"
                    element={
                      <ModuloRoute modulo="indicadores">
                        <PainelIndicadores />
                      </ModuloRoute>
                    }
                  />
                  <Route
                    path="/indicadores"
                    element={<Navigate to="/indicadores/painel" replace />}
                  />
                  <Route
                    path="/indicadores/liquidez"
                    element={
                      <ModuloRoute modulo="indicadores">
                        <IndicadoresLiquidez />
                      </ModuloRoute>
                    }
                  />
                  <Route
                    path="/indicadores/capital-giro"
                    element={
                      <ModuloRoute modulo="indicadores">
                        <IndicadoresCapitalGiro />
                      </ModuloRoute>
                    }
                  />
                  <Route
                    path="/indicadores/endividamento"
                    element={
                      <ModuloRoute modulo="indicadores">
                        <IndicadoresEndividamento />
                      </ModuloRoute>
                    }
                  />
                  <Route
                    path="/indicadores/rentabilidade"
                    element={
                      <ModuloRoute modulo="indicadores">
                        <IndicadoresRentabilidade />
                      </ModuloRoute>
                    }
                  />
                  <Route
                    path="/indicadores/estrutura-capital"
                    element={
                      <ModuloRoute modulo="indicadores">
                        <IndicadoresEstruturaCapital />
                      </ModuloRoute>
                    }
                  />
                  <Route
                    path="/indicadores/ebitda"
                    element={
                      <ModuloRoute modulo="indicadores">
                        <IndicadoresEbitda />
                      </ModuloRoute>
                    }
                  />
                  <Route
                    path="/indicadores/eficiencia-operacional"
                    element={
                      <ModuloRoute modulo="indicadores">
                        <IndicadoresEficienciaOperacional />
                      </ModuloRoute>
                    }
                  />
                  <Route
                    path="/indicadores/economicos"
                    element={
                      <ModuloRoute modulo="indicadores">
                        <IndicadoresEconomicos />
                      </ModuloRoute>
                    }
                  />
                  <Route
                    path="/indicadores/valuation"
                    element={
                      <ModuloRoute modulo="indicadores_valuation">
                        <IndicadoresValuation />
                      </ModuloRoute>
                    }
                  />
                  <Route
                    path="/indicadores/ponto-equilibrio"
                    element={
                      <ModuloRoute modulo="indicadores">
                        <IndicadoresPontoEquilibrio />
                      </ModuloRoute>
                    }
                  />
                  <Route
                    path="/indicadores/kanitz"
                    element={
                      <ModuloRoute modulo="indicadores">
                        <IndicadoresKanitz />
                      </ModuloRoute>
                    }
                  />
                  <Route
                    path="/planejamento/bsc"
                    element={
                      <ModuloRoute modulo="planejamento">
                        <BalancedScorecard />
                      </ModuloRoute>
                    }
                  />
                  <Route
                    path="/planejamento"
                    element={<Navigate to="/planejamento/bsc" replace />}
                  />
                  <Route
                    path="/analise-tributaria"
                    element={
                      <ModuloRoute modulo="analise_tributaria">
                        <AnaliseTributaria />
                      </ModuloRoute>
                    }
                  />
                  <Route
                    path="/relatorios"
                    element={
                      <ModuloRoute modulo="relatorios">
                        <Relatorios />
                      </ModuloRoute>
                    }
                  />
                  <Route
                    path="/relatorio-anual"
                    element={
                      <ModuloRoute modulo="relatorio_anual">
                        <RelatorioAnual />
                      </ModuloRoute>
                    }
                  />
                  <Route
                    path="/agente-ia"
                    element={
                      <ModuloRoute modulo="agente_ia">
                        <AgenteIA />
                      </ModuloRoute>
                    }
                  />
                  <Route
                    path="/importacao"
                    element={
                      <ModuloRoute modulo="importacao">
                        <Importacao />
                      </ModuloRoute>
                    }
                  />{' '}
                  <Route path="/configuracoes" element={<Configuracoes />} />
                  <Route
                    path="/admin/usuarios"
                    element={
                      <AdminRoute>
                        <AdminUsuarios />
                      </AdminRoute>
                    }
                  />
                  <Route
                    path="/admin/auditoria"
                    element={
                      <AdminRoute>
                        <AdminAuditoria />
                      </AdminRoute>
                    }
                  />
                </Route>

                {/* Rota 404 */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </TooltipProvider>
        </FilterProvider>
      </MinhaEmpresaProvider>
    </AuthProvider>
  </BrowserRouter>
)
export default App
