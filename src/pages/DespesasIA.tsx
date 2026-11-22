import { useEffect, useMemo, useState } from 'react'
import { Ban, RefreshCw } from 'lucide-react'
import { ImportarDespesasIA } from '@/components/ImportarDespesasIA'
import { useAuth } from '@/contexts/AuthContext'
import { useFilter } from '@/contexts/FilterContext'
import { useRealtime } from '@/hooks/use-realtime'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { financeService } from '@/services/financeService'
import type {
  EmpresaRecord,
  PlanoContaRecord,
  CentroRecord,
  TipoDespesaRecord,
} from '@/types/finance'

export default function DespesasIA() {
  const { toast } = useToast()
  const { user } = useAuth()
  const { selectedEmpresaId, empresasIdsAtivas, isGrupoAtivo, grupoAtivo } = useFilter()

  // Perfil cliente não tem acesso à importação de despesas com IA
  const isClientePerfil = user?.role === 'cliente'

  // Opções de filtro de empresa respeitando seleção individual ou grupo econômico
  const empFilterOpts = useMemo(() => {
    if (isGrupoAtivo && grupoAtivo && (grupoAtivo.empresas || []).length > 0) {
      return { empresasIds: grupoAtivo.empresas }
    }
    if (empresasIdsAtivas.length > 1) {
      return { empresasIds: empresasIdsAtivas }
    }
    if (empresasIdsAtivas.length === 1) {
      return { empresaId: empresasIdsAtivas[0] }
    }
    if (selectedEmpresaId && !selectedEmpresaId.startsWith('grupo-')) {
      return { empresaId: selectedEmpresaId }
    }
    return undefined
  }, [isGrupoAtivo, grupoAtivo, empresasIdsAtivas, selectedEmpresaId])

  const [empresas, setEmpresas] = useState<EmpresaRecord[]>([])
  const [planoContas, setPlanoContas] = useState<PlanoContaRecord[]>([])
  const [centros, setCentros] = useState<CentroRecord[]>([])
  const [tiposDespesas, setTiposDespesas] = useState<TipoDespesaRecord[]>([])
  const [loadingData, setLoadingData] = useState(true)

  const loadInitialCatalogs = async () => {
    setLoadingData(true)
    try {
      const [empRes, pcRes, ccRes, tdRes] = await Promise.all([
        financeService.getEmpresas(),
        financeService.getPlanoContas(empFilterOpts),
        financeService.getCentros(empFilterOpts),
        financeService.getTiposDespesas(empFilterOpts),
      ])
      setEmpresas(empRes)
      setPlanoContas(pcRes)
      setCentros(ccRes)
      setTiposDespesas(tdRes)
    } catch (err) {
      console.error('Erro ao carregar dados:', err)
      toast({
        title: 'Erro de carregamento',
        description: 'Não foi possível carregar empresas e plano de contas.',
        variant: 'destructive',
      })
    } finally {
      setLoadingData(false)
    }
  }

  useEffect(() => {
    if (!isClientePerfil) {
      loadInitialCatalogs()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empFilterOpts, isClientePerfil])

  // Catálogos sempre atualizados via realtime
  useRealtime<PlanoContaRecord>('plano_contas', () => {
    loadInitialCatalogs()
  })
  useRealtime('contas', () => {
    loadInitialCatalogs()
  })

  if (isClientePerfil) {
    return (
      <div className="space-y-4 max-w-3xl mx-auto pb-6">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-8 text-center space-y-3">
          <Ban className="w-10 h-10 text-amber-600 mx-auto" />
          <h1 className="text-lg font-bold text-amber-900">Acesso restrito</h1>
          <p className="text-sm text-amber-800">
            A importação de Despesas (IA) está disponível apenas para os perfis administrador e
            empresa. Fale com o seu contador em caso de dúvidas.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-6">
      {/* Header da página */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-200/80 pb-3.5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Importação de Despesas (IA)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Envie um documento (PDF, imagem ou extrato) e a IA extrai as despesas sugerindo a
            classificação no plano de contas da empresa ativa.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadInitialCatalogs}
            disabled={loadingData}
            className="gap-1.5 bg-white text-xs h-8 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingData ? 'animate-spin' : ''}`} />
            Atualizar Catálogos
          </Button>
        </div>
      </div>

      <ImportarDespesasIA
        empresas={empresas}
        planoContas={planoContas}
        centros={centros}
        tiposDespesas={tiposDespesas}
        onReloadCatalogs={loadInitialCatalogs}
      />
    </div>
  )
}
