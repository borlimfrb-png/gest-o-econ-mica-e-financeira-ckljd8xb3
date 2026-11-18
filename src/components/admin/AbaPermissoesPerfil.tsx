import { useCallback, useEffect, useMemo, useState } from 'react'
import { RotateCcw, Save, ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import type { ModuloSistema, PerfilConfig } from '@/lib/permissoesPerfis'
import type { UserRole } from '@/types/finance'
import { PERFIS_ACESSO } from '@/lib/permissoesPerfis'
import { permissoesPerfisService } from '@/services/permissoesPerfisService'
import { auditoriaUsuariosService } from '@/services/auditoriaUsuariosService'
import { usePermissoesDinamicas } from '@/contexts/PermissoesDinamicasContext'

/**
 * Painel "Permissões por Perfil" — aba da tela /admin/usuarios.
 *
 * Permite ao admin ligar/desligar módulos por perfil (empresa, financeiro,
 * comercial e também cliente). O perfil admin é imune (bloqueado na UI).
 * Sem registro na coleção = padrão de permissoesPerfis.ts; ao salvar, persiste
 * o conjunto completo; "restaurar padrão" apaga o override.
 */

const PERFIS_EDITAVEIS: UserRole[] = ['empresa', 'financeiro', 'comercial', 'cliente']

const LABELS_PERFIL: Record<UserRole, string> = {
  admin: 'Administrador',
  empresa: 'Empresa',
  financeiro: 'Financeiro',
  comercial: 'Comercial',
  cliente: 'Cliente',
}

// Rótulos legíveis dos módulos (id do módulo → nome exibido).
const LABELS_MODULO: Partial<Record<ModuloSistema, string>> = {
  dashboard: 'Dashboard Geral',
  dashboard_bi: 'Dashboard BI',
  lancamentos: 'Lançamentos',
  empresas: 'Empresas',
  grupos_empresariais: 'Grupos Empresariais',
  centros: 'Centros de Custo',
  tipos_despesas: 'Tipos de Despesas',
  contas: 'Contas',
  plano_contas: 'Plano de Contas',
  financeiro: 'Financeiro',
  minha_empresa: 'Minha Empresa',
  gerencial_dre: 'DRE Gerencial',
  gerencial_projecao_dre: 'Projeção de DRE',
  gerencial_comparativo_mensal: 'Comparativo Mensal',
  gerencial_despesas_fixas: 'Despesas Fixas',
  gerencial_despesas_variaveis: 'Despesas Variáveis',
  gerencial_comparativo_despesas: 'Comparativo Fixas × Variáveis',
  gerencial_fluxo_caixa: 'Fluxo de Caixa (DRE)',
  gerencial_analise_faturamento: 'Análise de Faturamento',
  gerencial_indicador_crescimento: 'Indicador de Crescimento',
  gerencial_rentabilidade: 'Análise de Rentabilidade',
  gerencial_dashboard_bi: 'Dashboard BI Gerencial',
  gerencial_indicadores: 'Indicadores Gerenciais',
  gerencial_termometro_insolvencia: 'Termômetro de Insolvência',
  gerencial_indicadores_avancados: 'Indicadores Avançados',
  gerencial_conta_detalhe: 'Detalhe da Conta (Drill-down)',
  cliente_balanco: 'Balanço Patrimonial (Cliente)',
  cliente_rentabilidade: 'Rentabilidade (Cliente)',
  cliente_crescimento: 'Crescimento (Cliente)',
  cliente_dashboard_bi: 'Dashboard BI (Cliente)',
  cliente_indicadores: 'Indicadores (Cliente)',
  cliente_agente_ia: 'Agente de IA Borlim',
  gerencial_agente_ia: 'Agente de IA Borlim (Gerencial)',
  analise_economica_financeira: 'Hub Análise Econômica e Financeira',
  planejamento: 'Planejamento Econômico',
  planejamento_setores: 'Planejamento de Setores',
  admin_usuarios: 'Usuários e Permissões',
  indicadores: 'Indicadores',
  indicadores_valuation: 'Valuation',
  configuracoes: 'Configurações',
}

function rotuloModulo(modulo: ModuloSistema): string {
  return LABELS_MODULO[modulo] || modulo
}

interface Props {
  perfilInicial?: UserRole
}

export function AbaPermissoesPerfil({ perfilInicial = 'financeiro' }: Props) {
  const { toast } = useToast()
  const { overrides, recarregar } = usePermissoesDinamicas()
  const [perfilSelecionado, setPerfilSelecionado] = useState<UserRole>(perfilInicial)
  const [modulosAtivos, setModulosAtivos] = useState<Set<ModuloSistema>>(new Set())
  const [isSalvando, setIsSalvando] = useState(false)

  const configPerfil: PerfilConfig = PERFIS_ACESSO[perfilSelecionado]
  const overrideAtivo = Boolean(overrides[perfilSelecionado])

  // União do padrão estático com o override salvo: módulos presentes só no
  // override aparecem no painel (caso do gerencial_fluxo_caixa removido do
  // padrão, porém habilitado via override).
  const modulosListados = useMemo(() => {
    const uniao = new Set<ModuloSistema>(configPerfil.modulosPermitidos)
    const override = overrides[perfilSelecionado]
    if (override) override.forEach((m) => uniao.add(m))
    return Array.from(uniao)
  }, [configPerfil, overrides, perfilSelecionado])

  // Sincroniza o switchboard com o estado efetivo (override → padrão).
  useEffect(() => {
    const lista = overrides[perfilSelecionado] || configPerfil.modulosPermitidos
    setModulosAtivos(new Set(lista))
  }, [perfilSelecionado, overrides, configPerfil])

  const podeEditar = perfilSelecionado !== 'admin'

  const toggleModulo = useCallback(
    (modulo: ModuloSistema) => {
      if (!podeEditar) return
      setModulosAtivos((prev) => {
        const novo = new Set(prev)
        if (novo.has(modulo)) novo.delete(modulo)
        else novo.add(modulo)
        return novo
      })
    },
    [podeEditar],
  )

  const handleSalvar = useCallback(async () => {
    if (!podeEditar) return
    setIsSalvando(true)
    try {
      await permissoesPerfisService.salvar({
        perfil: perfilSelecionado,
        modulos: Array.from(modulosAtivos),
      })
      await auditoriaUsuariosService.registrar({
        acao: 'permissao_perfil',
        detalhes: `Permissões do perfil "${LABELS_PERFIL[perfilSelecionado]}" atualizadas (${modulosAtivos.size} módulos habilitados).`,
      })
      await recarregar()
      toast({
        title: 'Permissões salvas',
        description: `Perfil ${LABELS_PERFIL[perfilSelecionado]} atualizado. Os usuários deste perfil veem o novo acesso ao recarregar a página.`,
      })
    } catch (err) {
      toast({
        title: 'Erro ao salvar',
        description: err instanceof Error ? err.message : 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setIsSalvando(false)
    }
  }, [podeEditar, perfilSelecionado, modulosAtivos, recarregar, toast])

  const handleRestaurar = useCallback(async () => {
    if (!podeEditar) return
    setIsSalvando(true)
    try {
      await permissoesPerfisService.restaurarPadrao(perfilSelecionado)
      await auditoriaUsuariosService.registrar({
        acao: 'permissao_perfil',
        detalhes: `Permissões do perfil "${LABELS_PERFIL[perfilSelecionado]}" restauradas ao padrão.`,
      })
      await recarregar()
      toast({
        title: 'Padrão restaurado',
        description: `Perfil ${LABELS_PERFIL[perfilSelecionado]} voltou às permissões padrão do sistema.`,
      })
    } catch (err) {
      toast({
        title: 'Erro ao restaurar',
        description: err instanceof Error ? err.message : 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setIsSalvando(false)
    }
  }, [podeEditar, perfilSelecionado, recarregar, toast])

  const ehOverride = useMemo(() => overrideAtivo, [overrideAtivo])

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-blue-600" />
              Permissões por Perfil
            </CardTitle>
            <CardDescription>
              Personalize quais módulos cada perfil acessa. Sem personalização, vale o padrão do
              sistema. O perfil Administrador é imune.
            </CardDescription>
          </div>
          {ehOverride ? (
            <Badge className="bg-amber-100 text-amber-800 border-0">Personalizado</Badge>
          ) : (
            <Badge variant="outline" className="text-slate-500">
              Padrão do sistema
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Seletor de perfil */}
        <div className="flex flex-wrap gap-2">
          {PERFIS_EDITAVEIS.map((perfil) => {
            const ativo = perfilSelecionado === perfil
            const temOverride = Boolean(overrides[perfil])
            return (
              <button
                key={perfil}
                type="button"
                onClick={() => setPerfilSelecionado(perfil)}
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                  ativo
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                {LABELS_PERFIL[perfil]}
                {temOverride ? (
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${ativo ? 'bg-white' : 'bg-amber-500'}`}
                    title="Personalizado"
                  />
                ) : null}
              </button>
            )
          })}
        </div>

        {/* Lista de módulos com toggles */}
        <div className="rounded-lg border divide-y">
          {modulosListados.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">
              Este perfil não possui módulos no catálogo padrão.
            </p>
          ) : (
            modulosListados.map((modulo) => (
              <div key={modulo} className="flex items-center justify-between gap-4 px-4 py-2.5">
                <div>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                    {rotuloModulo(modulo)}
                  </p>
                  <p className="text-xs text-slate-400 font-mono">{modulo}</p>
                </div>
                <Switch
                  checked={modulosAtivos.has(modulo)}
                  onCheckedChange={() => toggleModulo(modulo)}
                  disabled={!podeEditar || isSalvando}
                  aria-label={`Alternar ${rotuloModulo(modulo)}`}
                />
              </div>
            ))
          )}
        </div>

        {/* Ações */}
        <div className="flex items-center justify-end gap-2">
          {ehOverride ? (
            <Button
              variant="outline"
              onClick={handleRestaurar}
              disabled={isSalvando || !podeEditar}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Restaurar padrão
            </Button>
          ) : null}
          <Button onClick={handleSalvar} disabled={isSalvando || !podeEditar}>
            <Save className="mr-2 h-4 w-4" />
            {isSalvando ? 'Salvando…' : 'Salvar permissões'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
