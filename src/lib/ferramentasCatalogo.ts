import type { ModuloSistema } from '@/lib/permissoesPerfis'
import type { NavItemConfig, NavGroupConfig } from '@/lib/menuNavigationConfig'
import { MENU_GRUPOS } from '@/lib/menuNavigationConfig'

export interface FerramentaCatalogo {
  id: ModuloSistema
  nome: string
  descricao: string
  rota: string
}

/**
 * Catálogo de ferramentas prontas do sistema (módulos do menu) que o admin
 * pode habilitar/desabilitar por usuário em /admin/usuarios (aba Habilitar Ferramentas).
 * Derivado do registro de rotas/menu (MENU_GRUPOS em src/lib/menuNavigationConfig.ts),
 * com apenas os módulos navegáveis de produto (exclui cadastros estruturais, admin e configurações).
 */
export const CATALOGO_FERRAMENTAS: FerramentaCatalogo[] = [
  {
    id: 'dashboard',
    nome: 'Dashboard Geral',
    descricao: 'Visão executiva geral, patrimônio líquido e KPIs',
    rota: '/dashboard',
  },
  {
    id: 'dashboard_bi',
    nome: 'Dashboard BI Interativo',
    descricao: 'Apresentação executiva com drill-down e filtros',
    rota: '/dashboard-bi',
  },
  {
    id: 'cliente_balanco',
    nome: 'Balanço Patrimonial (Cliente)',
    descricao: 'Balanço patrimonial em leitura para o hub do cliente',
    rota: '/cliente/balanco',
  },
  {
    id: 'gerencial_dre',
    nome: 'DRE Gerencial',
    descricao: 'Demonstração do Resultado matricial por período',
    rota: '/gerencial/dre',
  },
  {
    id: 'gerencial_projecao_dre',
    nome: 'Projeção de DRE',
    descricao: 'Projeção de resultado para períodos futuros',
    rota: '/gerencial/projecao-dre',
  },
  {
    id: 'gerencial_comparativo_mensal',
    nome: 'Comparativo Mensal',
    descricao: 'Comparativo mês a mês de resultados',
    rota: '/gerencial/comparativo-mensal',
  },
  {
    id: 'gerencial_despesas_fixas',
    nome: 'Despesas Fixas',
    descricao: 'Análise matricial de despesas fixas recorrentes',
    rota: '/gerencial/despesas-fixas',
  },
  {
    id: 'gerencial_despesas_variaveis',
    nome: 'Despesas Variáveis',
    descricao: 'Custos variáveis, fretes, comissões e taxas',
    rota: '/gerencial/despesas-variaveis',
  },
  {
    id: 'gerencial_comparativo_despesas',
    nome: 'Comparativo de Despesas',
    descricao: 'Comparativo entre períodos e centros de custo',
    rota: '/gerencial/comparativo-despesas',
  },
  {
    id: 'gerencial_fluxo_caixa',
    nome: 'Fluxo de Caixa',
    descricao: 'Entradas e saídas consolidadas por período',
    rota: '/gerencial/fluxo-caixa',
  },
  {
    id: 'gerencial_analise_faturamento',
    nome: 'Análise de Faturamento',
    descricao: 'Histórico plurianual de faturamento',
    rota: '/gerencial/analise-faturamento',
  },
  {
    id: 'gerencial_indicador_crescimento',
    nome: 'Indicador de Crescimento',
    descricao: 'Evolução de faturamento e taxas de crescimento',
    rota: '/gerencial/indicador-crescimento',
  },
  {
    id: 'gerencial_rentabilidade',
    nome: 'Análise de Rentabilidade',
    descricao: 'Margens e rentabilidade do negócio',
    rota: '/gerencial/rentabilidade',
  },
  {
    id: 'gerencial_dashboard_bi',
    nome: 'Dashboard BI Gerencial',
    descricao: 'Painéis de BI gerenciais',
    rota: '/gerencial/dashboard-bi',
  },
  {
    id: 'gerencial_indicadores',
    nome: 'Indicadores Gerenciais',
    descricao: 'Painel de indicadores econômico-financeiros',
    rota: '/gerencial/indicadores',
  },
  {
    id: 'gerencial_termometro_insolvencia',
    nome: 'Termômetro de Insolvência',
    descricao: 'Risco de insolvência (Kanitz e modelos)',
    rota: '/gerencial/termometro-insolvencia',
  },
  {
    id: 'gerencial_indicadores_avancados',
    nome: 'Indicadores Avançados',
    descricao: 'Z-Score, EVA, DuPont e métricas avançadas',
    rota: '/gerencial/indicadores-avancados',
  },
  {
    id: 'financeiro',
    nome: 'Financeiro',
    descricao: 'Painel financeiro de contas e saldos',
    rota: '/financeiro',
  },
  {
    id: 'baixa_recebiveis',
    nome: 'Baixa de Recebíveis',
    descricao: 'Controle e baixa de recebíveis',
    rota: '/baixa-recebiveis',
  },
  {
    id: 'contratos',
    nome: 'Contratos',
    descricao: 'Gestão de contratos e vigências',
    rota: '/contratos',
  },
  {
    id: 'notas_fiscais',
    nome: 'Notas Fiscais',
    descricao: 'Emissão e controle de NFS-e',
    rota: '/notas-fiscais',
  },
  {
    id: 'formacao_preco',
    nome: 'Formação de Preço de Serviços',
    descricao: 'Markup, cenários e simulação de preços',
    rota: '/formacao-preco-servicos',
  },
  {
    id: 'indicadores',
    nome: 'Indicadores (Tela Total)',
    descricao: 'Tela total de indicadores e apresentação',
    rota: '/indicadores/apresentacao',
  },
  {
    id: 'indicadores_valuation',
    nome: 'Indicadores de Valuation',
    descricao: 'Valuation por múltiplos e histórico',
    rota: '/indicadores/valuation',
  },
  {
    id: 'planejamento',
    nome: 'Planejamento Econômico',
    descricao: 'Análise e projeção com agente de IA Borlim',
    rota: '/planejamento/economico',
  },
  {
    id: 'analise_tributaria',
    nome: 'Análise Tributária',
    descricao: 'Simulador de regimes tributários',
    rota: '/analise-tributaria',
  },
  {
    id: 'importacao',
    nome: 'Importação',
    descricao: 'Carga de dados (balancetes, Excel, PDF)',
    rota: '/importacao',
  },
  {
    id: 'relatorios',
    nome: 'Relatórios Executivos',
    descricao: 'Impressão e exportação de demonstrativos',
    rota: '/relatorios',
  },
  {
    id: 'relatorio_anual',
    nome: 'Relatório Consolidado Anual',
    descricao: 'Comparativo anual de 12 meses',
    rota: '/relatorio-anual',
  },
  {
    id: 'agente_ia',
    nome: 'Agente de IA Borlim',
    descricao: 'Consultoria econômica e financeira com IA',
    rota: '/agente-ia',
  },
]

const idsCatalogo = new Set(CATALOGO_FERRAMENTAS.map((f) => f.id))

/**
 * Equivalência para o perfil CLIENTE: o toggle do catálogo grava o id da
 * ferramenta interna (gerencial_*, agente_ia...), mas o menu, as rotas e o hub do
 * cliente usam os módulos cliente_*. Ao ler a lista desabilitada de um cliente,
 * cada id do catálogo é expandido para o módulo equivalente do cliente.
 */
const EQUIVALENCIA_CLIENTE: Record<string, ModuloSistema> = {
  gerencial_rentabilidade: 'cliente_rentabilidade',
  gerencial_indicador_crescimento: 'cliente_crescimento',
  gerencial_dashboard_bi: 'cliente_dashboard_bi',
  gerencial_indicadores: 'cliente_indicadores',
  agente_ia: 'cliente_agente_ia',
}

/** Expande a lista desabilitada com os módulos cliente_* equivalentes. */
export function expandirDesabilitadasCliente(desabilitadas: Set<string>): Set<string> {
  if (desabilitadas.size === 0) return desabilitadas
  const expandido = new Set(desabilitadas)
  for (const id of desabilitadas) {
    const equivalente = EQUIVALENCIA_CLIENTE[id]
    if (equivalente) expandido.add(equivalente)
  }
  return expandido
}
export function ehFerramentaCatalogo(m: ModuloSistema): boolean {
  return idsCatalogo.has(m)
}

export function getFerramentaCatalogo(id: string): FerramentaCatalogo | undefined {
  return CATALOGO_FERRAMENTAS.find((f) => f.id === id)
}

/** Rota → módulo do catálogo (para o guard de rota). */
export function moduloDaRota(pathname: string): ModuloSistema | undefined {
  return CATALOGO_FERRAMENTAS.find((f) => pathname === f.rota || pathname.startsWith(f.rota + '/'))
    ?.id
}

/**
 * Filtra a estrutura do MENU_GRUPOS removendo itens/grupos cuja ferramenta
 * esteja desabilitada para o usuário. Roda DEPOIS de filtrarMenuPorPerfil
 * (que já aplicou regras de perfil), como um filtro adicional por usuário.
 */
export function filtrarMenuPorFerramentas(
  grupos: NavGroupConfig[],
  desabilitadas: Set<string>,
): NavGroupConfig[] {
  if (desabilitadas.size === 0) return grupos
  const itemLiberado = (item: NavItemConfig) =>
    !(item.modulo && desabilitadas.has(item.modulo as string))
  return grupos
    .filter((grupo) => !(grupo.modulo && desabilitadas.has(grupo.modulo as string)))
    .map((grupo) => {
      if (grupo.tipo === 'link') return grupo
      if (grupo.colunas) {
        const colunas = grupo.colunas
          .map((col) => ({ ...col, itens: col.itens.filter(itemLiberado) }))
          .filter((col) => col.itens.length > 0)
        return colunas.length > 0 ? { ...grupo, colunas } : null
      }
      if (grupo.itens) {
        const itens = grupo.itens.filter(itemLiberado)
        return itens.length > 0 ? { ...grupo, itens } : null
      }
      return grupo
    })
    .filter((g): g is NavGroupConfig => g !== null)
}

/** Menu base completo (todos os grupos) — usado como fallback se o catálogo falhar. */
export function menuBase(): NavGroupConfig[] {
  return MENU_GRUPOS
}
