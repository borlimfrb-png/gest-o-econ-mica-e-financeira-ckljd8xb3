/* Main App Component - Handles routing (using react-router-dom), query client and other providers */
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { FilterProvider } from '@/contexts/FilterContext'

import Index from './pages/Index'
import Dashboard from './pages/Dashboard'
import Empresas from './pages/Empresas'
import Centros from './pages/Centros'
import AnaliseEmpresa from './pages/AnaliseEmpresa'
import TiposDespesas from './pages/TiposDespesas'
import Contas from './pages/Contas'
import PlanoContas from './pages/PlanoContas'
import Relatorios from './pages/Relatorios'
import Importacao from './pages/Importacao'
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
              <Route path="/empresas" element={<Empresas />} />
              <Route path="/empresas/:id" element={<AnaliseEmpresa />} />
              <Route path="/centros" element={<Centros />} />
              <Route path="/tipos-despesas" element={<TiposDespesas />} />
              <Route path="/contas" element={<Contas />} />
              <Route path="/plano-contas" element={<PlanoContas />} />
              <Route path="/relatorios" element={<Relatorios />} />
              <Route path="/importacao" element={<Importacao />} />
            </Route>

            {/* Rota 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </TooltipProvider>
      </FilterProvider>
    </AuthProvider>
  </BrowserRouter>
)

export default App
