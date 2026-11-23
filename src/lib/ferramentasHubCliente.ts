import type { ModuloSistema } from '@/lib/permissoesPerfis'

/**
 * Mapeamento card do hub do cliente (Análise Econômica e Financeira) → módulo do
 * catálogo de ferramentas (ferramentasCatalogo.ts). Usado para esconder do hub os
 * cards cuja ferramenta foi desabilitada para o usuário cliente (coleção
 * ferramentas_usuarios, campo ferramentas_desabilitadas; sem registro = tudo habilitado).
 *
 * Cards exclusivos de perfis internos (Termômetro, EBITDA, Valuation, etc.) não
 * aparecem para cliente, então não precisam de mapeamento aqui.
 */
export const FERRAMENTAS_HUB_CLIENTE: Record<string, ModuloSistema> = {
  balanco: 'cliente_balanco',
  dre: 'gerencial_dre',
  'despesas-fixas': 'gerencial_despesas_fixas',
  'despesas-variaveis': 'gerencial_despesas_variaveis',
  faturamento: 'gerencial_analise_faturamento',
  rentabilidade: 'cliente_rentabilidade',
  crescimento: 'cliente_crescimento',
  'dashboard-bi': 'cliente_dashboard_bi',
  indicadores: 'cliente_indicadores',
  'agente-ia': 'cliente_agente_ia',
  'fluxo-caixa': 'gerencial_fluxo_caixa',
}

/** Retorna true quando o card do hub pode ser exibido para o usuário. */
export function cardHubVisivel(cardId: string, desabilitadas: Set<string> | undefined): boolean {
  if (!desabilitadas || desabilitadas.size === 0) return true
  const modulo = FERRAMENTAS_HUB_CLIENTE[cardId]
  if (!modulo) return true
  return !desabilitadas.has(modulo)
}
