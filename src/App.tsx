/* Main App Component - Sistema de Gestão Econômica e Financeira */
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { FilterProvider } from '@/contexts/FilterContext'
import { MinhaEmpresaProvider } from '@/contexts/MinhaEmpresaContext'
import { perfilTemAcesso, type ModuloSistema } from '@/lib/permissoesPerfis'

import Index from './pages/Index'
import Dashboard from './pages/Dashboard'
import Empresas from './pages/Empresas'
import Centros from './pages/Centros'
import AnaliseEmpresa from './pages/AnaliseEmpresa'
import TiposDespesas from './pages/TiposDespesas'
import Contas from './pages/Contas'
import PlanoContas from './pages/PlanoContas'
import Lancamentos from './pages/Lancamentos'
import Financeiro from './pages/Financeiro'
import BaixaRecebiveis from './pages/BaixaRecebiveis'
import Contratos from './pages/Contratos'
import NotasFiscais from './pages/NotasFiscais'
import Relatorios from './pages/Relatorios'
import CadastroProdutos from './pages/CadastroProdutos'
import CadastroMateriaPrima from './pages/CadastroMateriaPrima'
import CadastroFichaTecnica from './pages/CadastroFichaTecnica'
import Impostos from './pages/Impostos'
import RelatorioAnual from './pages/RelatorioAnual'
import IndicadoresLiquidez from './pages/IndicadoresLiquidez'
import IndicadoresCapitalGiro from './pages/IndicadoresCapitalGiro'
import IndicadoresEndividamento from './pages/IndicadoresEndividamento'
import IndicadoresRentabilidade from './pages/IndicadoresRentabilidade'
import IndicadoresEstruturaCapital from './pages/IndicadoresEstruturaCapital'
import IndicadoresEbitda from './pages/IndicadoresEbitda'
import IndicadoresEficienciaOperacional from './pages/IndicadoresEficienciaOperacional'
import PainelIndicadores from './pages/PainelIndicadores'
import IndicadoresEconomicos from './pages/IndicadoresEconomicos'
import IndicadoresValuation from './pages/IndicadoresValuation'
import IndicadoresPontoEquilibrio from './pages/IndicadoresPontoEquilibrio'
import IndicadoresKanitz from './pages/IndicadoresKanitz'
import AgenteIA from './pages/AgenteIA'
import Importacao from './pages/Importacao'
import AnaliseTributaria from './pages/AnaliseTributaria'
import Configuracoes from './pages/Configuracoes'
import GruposEmpresariais from './pages/GruposEmpresariais'
import DashboardEmpresa from './pages/DashboardEmpresa'
import MinhaEmpresa from './pages/MinhaEmpresa'
import AdminUsuarios from './pages/AdminUsuarios'
import NotFound from './pages/NotFound'
import Layout from './components/Layout'

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
    return <Navigate to="/dashboard" replace />
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
              </Route>

              {/* Rota 404 */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </TooltipProvider>
        </FilterProvider>
      </MinhaEmpresaProvider>
    </AuthProvider>
  </BrowserRouter>
)

export default App
