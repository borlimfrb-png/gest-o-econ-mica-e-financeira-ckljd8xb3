/* Main App Component - Sistema de Gestão Econômica e Financeira */
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { FilterProvider } from '@/contexts/FilterContext'
import { MinhaEmpresaProvider } from '@/contexts/MinhaEmpresaContext'
import {
  perfilTemAcesso,
  getRotaInicialPorPerfil,
  type ModuloSistema,
} from '@/lib/permissoesPerfis'

import { lazy, Suspense } from 'react'

import Index from './pages/Index'
import Layout from './components/Layout'
import WelcomeSplash, { hasSeenSplashThisSession } from './pages/WelcomeSplash'

const AnaliseEconomicaFinanceira = lazy(() => import('./pages/AnaliseEconomicaFinanceira'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const DashboardBi = lazy(() => import('./pages/DashboardBi'))
const Empresas = lazy(() => import('./pages/Empresas'))
const Centros = lazy(() => import('./pages/Centros'))
const AnaliseEmpresa = lazy(() => import('./pages/AnaliseEmpresa'))
const TiposDespesas = lazy(() => import('./pages/TiposDespesas'))
const Contas = lazy(() => import('./pages/Contas'))
const PlanoContas = lazy(() => import('./pages/PlanoContas'))
const Lancamentos = lazy(() => import('./pages/Lancamentos'))
const DreGerencial = lazy(() => import('./pages/DreGerencial'))
const DespesasFixasAnalise = lazy(() => import('./pages/DespesasFixasAnalise'))
const DespesasVariaveisAnalise = lazy(() => import('./pages/DespesasVariaveisAnalise'))
const AnaliseFaturamento = lazy(() => import('./pages/AnaliseFaturamento'))
const ComparativoDespesasAnalise = lazy(() => import('./pages/ComparativoDespesasAnalise'))
const FluxoCaixaDre = lazy(() => import('./pages/FluxoCaixaDre'))
const IndicadorCrescimento = lazy(() => import('./pages/IndicadorCrescimento'))
const Financeiro = lazy(() => import('./pages/Financeiro'))
const BaixaRecebiveis = lazy(() => import('./pages/BaixaRecebiveis'))
const Contratos = lazy(() => import('./pages/Contratos'))
const NotasFiscais = lazy(() => import('./pages/NotasFiscais'))
const ValidacaoNfse = lazy(() => import('./pages/ValidacaoNfse'))
const Relatorios = lazy(() => import('./pages/Relatorios'))
const CadastroProdutos = lazy(() => import('./pages/CadastroProdutos'))
const CadastroMateriaPrima = lazy(() => import('./pages/CadastroMateriaPrima'))
const CadastroFichaTecnica = lazy(() => import('./pages/CadastroFichaTecnica'))
const Impostos = lazy(() => import('./pages/Impostos'))
const SimuladorPrecos = lazy(() => import('./pages/SimuladorPrecos'))
const RelatorioAnual = lazy(() => import('./pages/RelatorioAnual'))
const IndicadoresApresentacao = lazy(() => import('./pages/IndicadoresApresentacao'))
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
const SetoresMercado = lazy(() => import('./pages/SetoresMercado'))
const CadastroSetores = lazy(() => import('./pages/CadastroSetores'))
const Configuracoes = lazy(() => import('./pages/Configuracoes'))
const GruposEmpresariais = lazy(() => import('./pages/GruposEmpresariais'))
const DashboardEmpresa = lazy(() => import('./pages/DashboardEmpresa'))
const MinhaEmpresa = lazy(() => import('./pages/MinhaEmpresa'))
const AdminUsuarios = lazy(() => import('./pages/AdminUsuarios'))
const AdminAuditoria = lazy(() => import('./pages/AdminAuditoria'))
const NotFound = lazy(() => import('./pages/NotFound'))

// Componente para rotas exclusivas de administrador
function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isAdmin, isLoading } = useAuth()

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
    const destino = getRotaInicialPorPerfil(user?.role)
    return <Navigate to={destino} replace />
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
    const destino = getRotaInicialPorPerfil(user?.role)
    return <Navigate to={destino} replace />
  }

  return <>{children}</>
}

// Componente para rotas protegidas
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user, empresaVinculadaId } = useAuth()

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

  // Se o usuário autenticado acabou de acessar a aplicação ou recarregou e ainda não viu a splash inicial nesta sessão,
  // mas garantindo bypass seguro caso já possua contexto resolvido ou ambiente restrito a sessionStorage
  if (!hasSeenSplashThisSession()) {
    // Clientes sempre vão para a análise econômica direta sem reter na splash
    if (user?.role === 'cliente') {
      return <>{children}</>
    }
    // Se o usuário não-admin tem empresa única vinculada, não obriga re-seleção na splash
    if (empresaVinculadaId) {
      return <>{children}</>
    }
    return <Navigate to="/splash" state={{ from: window.location.pathname }} replace />
  }

  return <>{children}</>
}

// Componente para rota da tela inicial (Splash)
function SplashRoute() {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0B1F3A] flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-blue-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />
  }

  return <WelcomeSplash />
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

                {/* Tela Inicial (Splash/Welcome com Logomarca da Consultoria) pós-autenticação */}
                <Route path="/splash" element={<SplashRoute />} />

                {/* Rotas autenticadas dentro do Layout Corporativo */}
                <Route
                  element={
                    <ProtectedRoute>
                      <Layout />
                    </ProtectedRoute>
                  }
                >
                  <Route
                    path="/analise-economica-financeira"
                    element={
                      <ModuloRoute modulo="analise_economica_financeira">
                        <AnaliseEconomicaFinanceira />
                      </ModuloRoute>
                    }
                  />
                  <Route
                    path="/dashboard"
                    element={
                      <ModuloRoute modulo="dashboard">
                        <Dashboard />
                      </ModuloRoute>
                    }
                  />
                  <Route
                    path="/dashboard-bi"
                    element={
                      <ModuloRoute modulo="dashboard_bi">
                        <DashboardBi />
                      </ModuloRoute>
                    }
                  />
                  <Route path="/bi" element={<Navigate to="/dashboard-bi" replace />} />
                  <Route
                    path="/dashboard/empresa/:id"
                    element={
                      <ModuloRoute modulo="dashboard">
                        <DashboardEmpresa />
                      </ModuloRoute>
                    }
                  />
                  <Route
                    path="/empresas"
                    element={
                      <ModuloRoute modulo="empresas">
                        <Empresas />
                      </ModuloRoute>
                    }
                  />
                  <Route
                    path="/cadastro/grupos-empresariais"
                    element={
                      <ModuloRoute modulo="grupos_empresariais">
                        <GruposEmpresariais />
                      </ModuloRoute>
                    }
                  />
                  <Route
                    path="/grupos-empresariais"
                    element={
                      <ModuloRoute modulo="grupos_empresariais">
                        <GruposEmpresariais />
                      </ModuloRoute>
                    }
                  />
                  <Route
                    path="/empresas/:id"
                    element={
                      <ModuloRoute modulo="empresas">
                        <AnaliseEmpresa />
                      </ModuloRoute>
                    }
                  />
                  <Route
                    path="/centros"
                    element={
                      <ModuloRoute modulo="centros">
                        <Centros />
                      </ModuloRoute>
                    }
                  />
                  <Route
                    path="/tipos-despesas"
                    element={
                      <ModuloRoute modulo="tipos_despesas">
                        <TiposDespesas />
                      </ModuloRoute>
                    }
                  />
                  <Route
                    path="/contas"
                    element={
                      <ModuloRoute modulo="contas">
                        <Contas />
                      </ModuloRoute>
                    }
                  />
                  <Route
                    path="/plano-contas"
                    element={
                      <ModuloRoute modulo="plano_contas">
                        <PlanoContas />
                      </ModuloRoute>
                    }
                  />
                  <Route
                    path="/minha-empresa"
                    element={
                      <ModuloRoute modulo="minha_empresa">
                        <MinhaEmpresa />
                      </ModuloRoute>
                    }
                  />
                  <Route
                    path="/lancamentos"
                    element={
                      <ModuloRoute modulo="lancamentos">
                        <Lancamentos />
                      </ModuloRoute>
                    }
                  />
                  <Route
                    path="/gerencial/dre"
                    element={
                      <ModuloRoute modulo="gerencial_dre">
                        <DreGerencial />
                      </ModuloRoute>
                    }
                  />
                  <Route
                    path="/gerencial/analise-faturamento"
                    element={
                      <ModuloRoute modulo="gerencial_analise_faturamento">
                        <AnaliseFaturamento />
                      </ModuloRoute>
                    }
                  />
                  <Route
                    path="/gerencial/despesas-fixas"
                    element={
                      <ModuloRoute modulo="gerencial_despesas_fixas">
                        <DespesasFixasAnalise />
                      </ModuloRoute>
                    }
                  />
                  <Route
                    path="/gerencial/despesas-variaveis"
                    element={
                      <ModuloRoute modulo="gerencial_despesas_variaveis">
                        <DespesasVariaveisAnalise />
                      </ModuloRoute>
                    }
                  />
                  <Route
                    path="/gerencial/comparativo-despesas"
                    element={
                      <ModuloRoute modulo="gerencial_comparativo_despesas">
                        <ComparativoDespesasAnalise />
                      </ModuloRoute>
                    }
                  />
                  <Route
                    path="/gerencial/fluxo-caixa"
                    element={
                      <ModuloRoute modulo="gerencial_fluxo_caixa">
                        <FluxoCaixaDre />
                      </ModuloRoute>
                    }
                  />
                  <Route
                    path="/gerencial/indicador-crescimento"
                    element={
                      <ModuloRoute modulo="gerencial_indicador_crescimento">
                        <IndicadorCrescimento />
                      </ModuloRoute>
                    }
                  />
                  <Route
                    path="/financeiro"
                    element={
                      <ModuloRoute modulo="financeiro">
                        <Financeiro />
                      </ModuloRoute>
                    }
                  />
                  <Route
                    path="/baixa-recebiveis"
                    element={
                      <ModuloRoute modulo="baixa_recebiveis">
                        <BaixaRecebiveis />
                      </ModuloRoute>
                    }
                  />
                  <Route
                    path="/contratos"
                    element={
                      <ModuloRoute modulo="contratos">
                        <Contratos />
                      </ModuloRoute>
                    }
                  />
                  <Route
                    path="/notas-fiscais"
                    element={
                      <ModuloRoute modulo="notas_fiscais">
                        <NotasFiscais />
                      </ModuloRoute>
                    }
                  />
                  <Route
                    path="/notas-fiscais/validacao"
                    element={
                      <ModuloRoute modulo="notas_fiscais">
                        <ValidacaoNfse />
                      </ModuloRoute>
                    }
                  />
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
                    path="/indicadores/apresentacao"
                    element={
                      <ModuloRoute modulo="indicadores">
                        <IndicadoresApresentacao />
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
                    path="/valuation"
                    element={
                      <ModuloRoute modulo="indicadores_valuation">
                        <IndicadoresValuation />
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
                    path="/planejamento/setores"
                    element={
                      <ModuloRoute modulo="planejamento">
                        <SetoresMercado />
                      </ModuloRoute>
                    }
                  />
                  <Route
                    path="/planejamento/setores/cadastro"
                    element={
                      <ModuloRoute modulo="planejamento">
                        <CadastroSetores />
                      </ModuloRoute>
                    }
                  />
                  <Route
                    path="/cadastro/setores"
                    element={<Navigate to="/planejamento/setores/cadastro" replace />}
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
                  <Route
                    path="/configuracoes"
                    element={
                      <ModuloRoute modulo="configuracoes">
                        <Configuracoes />
                      </ModuloRoute>
                    }
                  />
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
