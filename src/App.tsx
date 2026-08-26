/* Main App Component - Handles routing (using react-router-dom), query client and other providers */
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { FilterProvider } from '@/contexts/FilterContext'
import { MinhaEmpresaProvider } from '@/contexts/MinhaEmpresaContext'

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
import Relatorios from './pages/Relatorios'
import RelatorioAnual from './pages/RelatorioAnual'
import IndicadoresLiquidez from './pages/IndicadoresLiquidez'
import IndicadoresEndividamento from './pages/IndicadoresEndividamento'
import IndicadoresRentabilidade from './pages/IndicadoresRentabilidade'
import IndicadoresEstruturaCapital from './pages/IndicadoresEstruturaCapital'
import IndicadoresEbitda from './pages/IndicadoresEbitda'
import IndicadoresEficienciaOperacional from './pages/IndicadoresEficienciaOperacional'
import PainelIndicadores from './pages/PainelIndicadores'
import IndicadoresEconomicos from './pages/IndicadoresEconomicos'
import Importacao from './pages/Importacao'
import AnaliseTributaria from './pages/AnaliseTributaria'
import Configuracoes from './pages/Configuracoes'
import DashboardEmpresa from './pages/DashboardEmpresa'
import MinhaEmpresa from './pages/MinhaEmpresa'
import NotFound from './pages/NotFound'
import Layout from './components/Layout'

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
                <Route path="/indicadores/painel" element={<PainelIndicadores />} />
                <Route
                  path="/indicadores"
                  element={<Navigate to="/indicadores/painel" replace />}
                />
                <Route path="/indicadores/liquidez" element={<IndicadoresLiquidez />} />
                <Route path="/indicadores/endividamento" element={<IndicadoresEndividamento />} />
                <Route path="/indicadores/rentabilidade" element={<IndicadoresRentabilidade />} />
                <Route
                  path="/indicadores/estrutura-capital"
                  element={<IndicadoresEstruturaCapital />}
                />
                <Route path="/indicadores/ebitda" element={<IndicadoresEbitda />} />
                <Route
                  path="/indicadores/eficiencia-operacional"
                  element={<IndicadoresEficienciaOperacional />}
                />
                <Route path="/indicadores/economicos" element={<IndicadoresEconomicos />} />
                <Route path="/analise-tributaria" element={<AnaliseTributaria />} />
                <Route path="/relatorios" element={<Relatorios />} />
                <Route path="/relatorio-anual" element={<RelatorioAnual />} />
                <Route path="/importacao" element={<Importacao />} />
                <Route path="/configuracoes" element={<Configuracoes />} />
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
