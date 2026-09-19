import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard,
  BarChart3,
  Building2,
  PieChart,
  Tags,
  BookOpen,
  FolderTree,
  Building,
  Users,
  Shield,
  FileText,
  Scale,
  Calendar,
  CheckCircle2,
  FileCheck2,
  Package,
  Layers,
  ClipboardList,
  Percent,
  Calculator,
  Presentation,
  Gauge,
  Activity,
  Coins,
  TrendingDown,
  TrendingUp,
  Clock,
  Flame,
  Target,
  Upload,
  Bot,
  Settings,
  Bell,
  Sparkles,
} from 'lucide-react'
import type { UserRole } from '@/types/finance'
import { perfilTemAcesso, type ModuloSistema } from '@/lib/permissoesPerfis'

export interface NavItemConfig {
  id: string
  name: string
  path: string
  icon: LucideIcon
  descricao?: string
  modulo?: ModuloSistema
  adminOnly?: boolean
  hideFinanceiro?: boolean
  hideComercial?: boolean
  badge?: string
  badgeVariant?: 'default' | 'emerald' | 'amber' | 'blue' | 'purple'
  destaque?: boolean
  palavrasChave?: string[]
}

export interface NavGroupConfig {
  id: string
  label: string
  icon: LucideIcon
  tipo: 'dropdown' | 'mega' | 'link'
  path?: string // usado se for tipo 'link'
  modulo?: ModuloSistema
  adminOnly?: boolean
  hideFinanceiro?: boolean
  hideComercial?: boolean
  colunas?: {
    titulo?: string
    descricao?: string
    itens: NavItemConfig[]
  }[]
  itens?: NavItemConfig[]
  badge?: string
  subtitulo?: string
}

/**
 * Catálogo completo de itens e grupos da topbar com descrições ricas,
 * atalhos de busca rápida e suporte a mega-menu.
 */
export const MENU_GRUPOS: NavGroupConfig[] = [
  // 1. Dashboard (Dropdown / Mega compacto com Geral e BI)
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    tipo: 'dropdown',
    subtitulo: 'Painéis Executivos & BI',
    itens: [
      {
        id: 'dashboard-geral',
        name: 'Dashboard Geral',
        path: '/dashboard',
        icon: LayoutDashboard,
        descricao: 'Visão executiva geral, patrimônio líquido e KPIs',
        modulo: 'dashboard',
        palavrasChave: ['visão geral', 'patrimônio', 'kpi', 'receita', 'lucro'],
      },
      {
        id: 'dashboard-bi',
        name: 'Dashboard BI Interativo',
        path: '/dashboard-bi',
        icon: BarChart3,
        descricao: 'Apresentação executiva às empresas com drill-down e filtros',
        modulo: 'dashboard_bi',
        badge: 'BI',
        badgeVariant: 'amber',
        destaque: true,
        palavrasChave: ['bi', 'apresentação', 'gráficos', 'drill-down', 'filtros', 'inteligência'],
      },
    ],
  },

  // 2. Cadastros (Mega-menu organizado em colunas temáticas)
  {
    id: 'cadastros',
    label: 'Cadastros',
    icon: Building2,
    tipo: 'mega',
    subtitulo: 'Estrutura Empresarial e Contábil',
    colunas: [
      {
        titulo: 'Entidades & Estrutura',
        descricao: 'Empresas, grupos e centros de resultado',
        itens: [
          {
            id: 'cad-empresas',
            name: 'Empresas',
            path: '/empresas',
            icon: Building2,
            descricao: 'Gestão de empresas, holdings e filiais vinculadas',
            modulo: 'empresas',
            hideFinanceiro: true,
            palavrasChave: ['holding', 'cnpj', 'empresa', 'matriz', 'filial'],
          },
          {
            id: 'cad-grupos',
            name: 'Grupo Empresarial',
            path: '/cadastro/grupos-empresariais',
            icon: Building,
            descricao: 'Consolidação e agrupamento econômico',
            modulo: 'grupos_empresariais',
            hideFinanceiro: true,
            palavrasChave: ['grupo', 'conglomerado', 'consolidação', 'holding'],
          },
          {
            id: 'cad-centros',
            name: 'Centros de Custo',
            path: '/centros',
            icon: PieChart,
            descricao: 'Alocação de custos por unidade de negócio',
            modulo: 'centros',
            palavrasChave: ['centro de custo', 'unidade', 'departamento', 'rateio'],
          },
        ],
      },
      {
        titulo: 'Estrutura Contábil',
        descricao: 'Plano de contas, tipos e classificação',
        itens: [
          {
            id: 'cad-tipos-despesas',
            name: 'Tipos de Despesas',
            path: '/tipos-despesas',
            icon: Tags,
            descricao: 'Categorias de despesas fixas, variáveis e operacionais',
            modulo: 'tipos_despesas',
            palavrasChave: ['despesas', 'categoria', 'custo fixo', 'custo variável'],
          },
          {
            id: 'cad-contas',
            name: 'Cadastro de Contas',
            path: '/contas',
            icon: BookOpen,
            descricao: 'Contas bancárias, caixas e contas patrimoniais',
            modulo: 'contas',
            palavrasChave: ['banco', 'caixa', 'contas bancárias', 'saldo'],
          },
          {
            id: 'cad-plano-contas',
            name: 'Plano de Contas',
            path: '/plano-contas',
            icon: FolderTree,
            descricao: 'Hierarquia e mapeamento contábil para Balanço/DRE',
            modulo: 'plano_contas',
            palavrasChave: ['plano de contas', 'dre', 'balanço', 'estruturação'],
          },
        ],
      },
      {
        titulo: 'Consultoria & Segurança',
        descricao: 'Identidade, usuários e governança',
        itens: [
          {
            id: 'cad-minha-empresa',
            name: 'Minha Empresa',
            path: '/minha-empresa',
            icon: Building,
            descricao: 'Identidade visual, logotipo, certificado e dados fiscais',
            modulo: 'minha_empresa',
            palavrasChave: ['logo', 'certificado a1', 'dados fiscais', 'consultoria'],
          },
          {
            id: 'cad-usuarios',
            name: 'Usuários & Permissões',
            path: '/admin/usuarios',
            icon: Users,
            descricao: 'Gestão de acessos, convites e perfis de usuário',
            adminOnly: true,
            modulo: 'admin_usuarios',
            badge: 'Admin',
            badgeVariant: 'purple',
            palavrasChave: ['permissão', 'usuários', 'convite', 'perfis', 'acesso'],
          },
          {
            id: 'cad-auditoria',
            name: 'Auditoria de Segurança',
            path: '/admin/auditoria',
            icon: Shield,
            descricao: 'Trilha de logs, verificação e monitoramento do sistema',
            adminOnly: true,
            modulo: 'admin_usuarios',
            badge: 'Admin',
            badgeVariant: 'purple',
            palavrasChave: ['segurança', 'logs', 'auditoria', 'rastreamento'],
          },
        ],
      },
    ],
  },

  // 3. Lançamentos (Dropdown rápido com Balanço e DRE)
  {
    id: 'lancamentos',
    label: 'Lançamentos',
    icon: FileText,
    tipo: 'dropdown',
    subtitulo: 'Movimentações Contábeis',
    itens: [
      {
        id: 'lanc-rapidos',
        name: 'Lançamentos Rápidos',
        path: '/lancamentos',
        icon: FileText,
        descricao: 'Entradas e saídas financeiras com categorização ágil',
        modulo: 'lancamentos',
        palavrasChave: ['lançamento', 'despesa', 'receita', 'movimentação', 'diário'],
      },
      {
        id: 'lanc-balanco-dre',
        name: 'Balanço & DRE Mensal',
        path: '__DYNAMIC_BALANCO_DRE__',
        icon: Scale,
        descricao: 'Estruturação mensal do Balanço Patrimonial e DRE',
        modulo: 'empresas',
        badge: 'Mensal',
        badgeVariant: 'emerald',
        palavrasChave: ['balanço patrimonial', 'dre mensal', 'fechamento', 'demonstração'],
      },
    ],
  },

  // 4. Financeiro (Mega / Dropdown abrangente de rotinas financeiras)
  {
    id: 'financeiro',
    label: 'Financeiro',
    icon: Coins,
    tipo: 'dropdown',
    subtitulo: 'Fluxo de Caixa & Documentos Fiscais',
    itens: [
      {
        id: 'fin-geral',
        name: 'Fluxo Financeiro',
        path: '/financeiro',
        icon: Calendar,
        descricao: 'Fluxo de caixa previsto x realizado, conciliação e calendário',
        modulo: 'financeiro',
        hideComercial: true,
        palavrasChave: ['fluxo de caixa', 'conciliação', 'contas a pagar', 'contas a receber'],
      },
      {
        id: 'fin-recebiveis',
        name: 'Baixa dos Recebíveis',
        path: '/baixa-recebiveis',
        icon: CheckCircle2,
        descricao: 'Gestão de títulos, recebimento, clientes e inadimplência',
        modulo: 'baixa_recebiveis',
        palavrasChave: ['recebíveis', 'cobrança', 'baixa de títulos', 'duplicatas', 'clientes'],
      },
      {
        id: 'fin-contratos',
        name: 'Contratos & Recorrência',
        path: '/contratos',
        icon: FileText,
        descricao: 'Contratos de prestação de serviços, parcelas e reajustes',
        modulo: 'contratos',
        palavrasChave: ['contratos', 'recorrência', 'mensalidades', 'honorários'],
      },
      {
        id: 'fin-nfse',
        name: 'Emissor NFS-e Nacional',
        path: '/notas-fiscais',
        icon: FileCheck2,
        descricao: 'Emissão de notas fiscais padrão nacional com certificado digital A1',
        modulo: 'notas_fiscais',
        badge: 'NFS-e',
        badgeVariant: 'blue',
        palavrasChave: ['nota fiscal', 'nfse', 'dps', 'danfse', 'tributos', 'emissão'],
      },
    ],
  },

  // 5. Formação de Preço (Mega menu com colunas de custos e precificação)
  {
    id: 'formacao-preco',
    label: 'Formação de Preço',
    icon: Calculator,
    tipo: 'mega',
    subtitulo: 'Custos Industriais, Margens & Precificação',
    colunas: [
      {
        titulo: 'Estrutura de Custos',
        descricao: 'Insumos, fichas e tributação',
        itens: [
          {
            id: 'fp-produtos',
            name: 'Cadastro de Produtos',
            path: '/formacao-preco/produtos',
            icon: Package,
            descricao: 'Produtos acabados, famílias e precificação sugerida',
            modulo: 'formacao_preco',
            palavrasChave: ['produtos', 'catálogo', 'preço de venda', 'sku'],
          },
          {
            id: 'fp-materia-prima',
            name: 'Matéria Prima & Insumos',
            path: '/formacao-preco/materia-prima',
            icon: Layers,
            descricao: 'Custos unitários, curva ABC e controle de insumos',
            modulo: 'formacao_preco',
            palavrasChave: ['matéria prima', 'insumos', 'estoque', 'curva abc', 'custo'],
          },
          {
            id: 'fp-fichas-tecnicas',
            name: 'Ficha Técnica de Custo',
            path: '/formacao-preco/fichas-tecnicas',
            icon: ClipboardList,
            descricao: 'Composição de materiais, mão de obra e custos indiretos',
            modulo: 'formacao_preco',
            palavrasChave: ['ficha técnica', 'bom', 'composição', 'custo direto'],
          },
        ],
      },
      {
        titulo: 'Precificação & Simulação',
        descricao: 'Cálculo de mark-up e impostos',
        itens: [
          {
            id: 'fp-impostos',
            name: 'Configuração de Impostos',
            path: '/formacao-preco/impostos',
            icon: Percent,
            descricao: 'Alíquotas fiscais, regime de tributação e encargos sobre preço',
            modulo: 'formacao_preco',
            palavrasChave: ['impostos sobre venda', 'icms', 'pis', 'cofins', 'iss'],
          },
          {
            id: 'fp-simulador',
            name: 'Simulador de Preços & Mark-Up',
            path: '/formacao-preco/simulador',
            icon: Calculator,
            descricao: 'Simulação interativa com mark-up divisor e margem líquida alvo',
            modulo: 'formacao_preco',
            badge: 'Simulador',
            badgeVariant: 'amber',
            destaque: true,
            palavrasChave: [
              'mark-up',
              'simulador',
              'margem alvo',
              'preço sugerido',
              'ponto de lucro',
            ],
          },
        ],
      },
    ],
  },

  // 6. Indicadores (Mega-menu amplo categorizado por perspectiva analítica)
  {
    id: 'indicadores',
    label: 'Indicadores',
    icon: Gauge,
    tipo: 'mega',
    subtitulo: 'Diagnóstico Financeiro & Métricas Econômicas',
    colunas: [
      {
        titulo: 'Apresentação & Painéis',
        descricao: 'Visões consolidadas e benchmarks',
        itens: [
          {
            id: 'ind-apresentacao',
            name: 'Apresentação de Indicadores',
            path: '/indicadores/apresentacao',
            icon: Presentation,
            descricao: 'Catálogo educativo e apresentação executiva dos KPIs',
            modulo: 'indicadores',
            badge: 'Apresentação',
            badgeVariant: 'emerald',
            destaque: true,
            palavrasChave: ['apresentação', 'guia', 'fórmulas', 'educativo', 'catálogo'],
          },
          {
            id: 'ind-painel',
            name: 'Painel & Benchmarks',
            path: '/indicadores/painel',
            icon: Gauge,
            descricao: 'Quadro geral com metas setoriais e comparação com o mercado',
            modulo: 'indicadores',
            palavrasChave: ['benchmarks', 'mercado', 'setor', 'painel geral', 'radar'],
          },
          {
            id: 'ind-valuation',
            name: 'Valuation da Empresa',
            path: '/indicadores/valuation',
            icon: TrendingUp,
            descricao: 'Avaliação patrimonial por Fluxo de Caixa Descontado e Múltiplos',
            modulo: 'indicadores_valuation',
            badge: 'Valuation',
            badgeVariant: 'purple',
            palavrasChave: ['valuation', 'fluxo de caixa descontado', 'fcd', 'valor da empresa'],
          },
          {
            id: 'ind-kanitz',
            name: 'Termômetro de Insolvência (Kanitz)',
            path: '/indicadores/kanitz',
            icon: Flame,
            descricao: 'Índice de solvência e saúde financeira preditiva',
            modulo: 'indicadores',
            palavrasChave: ['kanitz', 'falência', 'insolvência', 'solvência', 'risco'],
          },
        ],
      },
      {
        titulo: 'Liquidez & Capital',
        descricao: 'Fluxo, giro e endividamento',
        itens: [
          {
            id: 'ind-liquidez',
            name: 'Indicadores de Liquidez',
            path: '/indicadores/liquidez',
            icon: Activity,
            descricao: 'Liquidez Corrente, Seca, Imediata e Geral',
            modulo: 'indicadores',
            palavrasChave: ['liquidez corrente', 'liquidez seca', 'liquidez imediata'],
          },
          {
            id: 'ind-capital-giro',
            name: 'Capital de Giro (NCG)',
            path: '/indicadores/capital-giro',
            icon: Coins,
            descricao: 'Necessidade de Capital de Giro e Saldo de Tesouraria',
            modulo: 'indicadores',
            palavrasChave: ['ncg', 'capital de giro', 'tesouraria', 'ciclo financeiro'],
          },
          {
            id: 'ind-endividamento',
            name: 'Indicadores de Endividamento',
            path: '/indicadores/endividamento',
            icon: TrendingDown,
            descricao: 'Grau de endividamento, perfil e alavancagem',
            modulo: 'indicadores',
            palavrasChave: ['dívida', 'endividamento', 'passivo', 'alavancagem'],
          },
          {
            id: 'ind-estrutura',
            name: 'Estrutura de Capital',
            path: '/indicadores/estrutura-capital',
            icon: Building2,
            descricao: 'Composição das fontes de recursos próprios e de terceiros',
            modulo: 'indicadores',
            palavrasChave: ['recursos próprios', 'terceiros', 'patrimônio'],
          },
        ],
      },
      {
        titulo: 'Resultados & Eficiência',
        descricao: 'Rentabilidade, margens e equilíbrio',
        itens: [
          {
            id: 'ind-rentabilidade',
            name: 'Indicadores de Rentabilidade',
            path: '/indicadores/rentabilidade',
            icon: TrendingUp,
            descricao: 'ROE, ROA, Margem Bruta, Operacional e Líquida',
            modulo: 'indicadores',
            palavrasChave: ['roe', 'roa', 'margem líquida', 'lucratividade'],
          },
          {
            id: 'ind-ebitda',
            name: 'EBITDA (LAJIDA)',
            path: '/indicadores/ebitda',
            icon: TrendingUp,
            descricao: 'Geração operacional de caixa e margem EBITDA',
            modulo: 'indicadores',
            palavrasChave: ['ebitda', 'lajida', 'geração de caixa', 'caixa operacional'],
          },
          {
            id: 'ind-eficiencia',
            name: 'Eficiência Operacional',
            path: '/indicadores/eficiencia-operacional',
            icon: Clock,
            descricao: 'Prazos médios de estocagem, recebimento e pagamento (PME, PMR, PMP)',
            modulo: 'indicadores',
            palavrasChave: ['pme', 'pmr', 'pmp', 'ciclo operacional', 'giro de estoques'],
          },
          {
            id: 'ind-ponto-equilibrio',
            name: 'Ponto de Equilíbrio (Break-Even)',
            path: '/indicadores/ponto-equilibrio',
            icon: Scale,
            descricao: 'Ponto de equilíbrio contábil, econômico e financeiro',
            modulo: 'indicadores',
            palavrasChave: ['break even', 'ponto de equilíbrio', 'margem de segurança'],
          },
          {
            id: 'ind-economicos',
            name: 'Indicadores Econômicos Avançados',
            path: '/indicadores/economicos',
            icon: TrendingUp,
            descricao: 'Análise aprofundada de valor econômico e produtividade',
            modulo: 'indicadores',
            palavrasChave: ['eva', 'econômicos', 'produtividade'],
          },
        ],
      },
    ],
  },

  // 7. Planejamento (Dropdown com BSC)
  {
    id: 'planejamento',
    label: 'Planejamento',
    icon: Target,
    tipo: 'dropdown',
    subtitulo: 'Estratégia & Metas Empresariais',
    itens: [
      {
        id: 'plan-bsc',
        name: 'Balanced Scorecard (BSC)',
        path: '/planejamento/bsc',
        icon: Target,
        descricao: 'Gestão estratégica em 4 perspectivas com metas e planos de ação',
        modulo: 'planejamento',
        badge: 'BSC',
        badgeVariant: 'blue',
        palavrasChave: ['bsc', 'scorecard', 'metas', 'iniciativas', 'planos de ação', 'estratégia'],
      },
      {
        id: 'plan-setores',
        name: 'Setores (Mercado)',
        path: '/planejamento/setores',
        icon: Layers,
        descricao: 'Visão setorial, múltiplos de valuation e comparativo das empresas vs mercado',
        modulo: 'planejamento',
        badge: 'Novo',
        badgeVariant: 'blue',
        palavrasChave: [
          'setores',
          'mercado',
          'setor',
          'segmento',
          'múltiplos',
          'benchmarks',
          'ebitda',
        ],
      },
    ],
  },

  // 8. Relatórios (Dropdown com Executivos e Consolidado Anual)
  {
    id: 'relatorios',
    label: 'Relatórios',
    icon: FileText,
    tipo: 'dropdown',
    subtitulo: 'Demonstrações & Pareceres Oficiais',
    itens: [
      {
        id: 'rel-executivos',
        name: 'Relatórios Executivos',
        path: '/relatorios',
        icon: FileText,
        descricao: 'Impressão e exportação de Balanço, DRE e Parecer Executivo',
        modulo: 'relatorios',
        palavrasChave: ['relatório', 'parecer', 'impressão a4', 'pdf', 'demonstrativos'],
      },
      {
        id: 'rel-anual',
        name: 'Relatório Consolidado Anual',
        path: '/relatorio-anual',
        icon: Calendar,
        descricao: 'Visão comparativa de 12 meses por tipo de conta com exportação CSV',
        modulo: 'relatorio_anual',
        palavrasChave: ['anual', '12 meses', 'comparativo anual', 'exportar csv'],
      },
    ],
  },

  // 9. Links diretos na barra
  {
    id: 'analise-tributaria',
    label: 'Análise Tributária',
    icon: Calculator,
    tipo: 'link',
    path: '/analise-tributaria',
    modulo: 'analise_tributaria',
    subtitulo: 'Simulador de Regimes',
  },
  {
    id: 'importacao',
    label: 'Importação',
    icon: Upload,
    tipo: 'link',
    path: '/importacao',
    modulo: 'importacao',
    subtitulo: 'Carga de Dados',
  },
  {
    id: 'agente-ia',
    label: 'Agente IA',
    icon: Sparkles,
    tipo: 'link',
    path: '/agente-ia',
    modulo: 'agente_ia',
    badge: 'IA',
    subtitulo: 'Diagnóstico Inteligente',
  },
]

/**
 * Filtra grupos e itens baseado nas permissões do perfil atual.
 */
export function filtrarMenuPorPerfil(
  grupos: NavGroupConfig[],
  role: UserRole | undefined,
  isAdmin: boolean,
  balancoDreUrl: string,
): NavGroupConfig[] {
  const isFinanceiro = role === 'financeiro'
  const isComercial = role === 'comercial'

  const resolvePath = (p: string) => (p === '__DYNAMIC_BALANCO_DRE__' ? balancoDreUrl : p)

  const resolveItem = (item: NavItemConfig): NavItemConfig | null => {
    if (item.adminOnly && !isAdmin) return null
    if (isFinanceiro && item.hideFinanceiro) return null
    if (isComercial && item.hideComercial) return null
    if (item.modulo && !perfilTemAcesso(role, item.modulo)) return null

    return {
      ...item,
      path: resolvePath(item.path),
    }
  }

  return grupos
    .map((grupo) => {
      if (grupo.adminOnly && !isAdmin) return null
      if (isFinanceiro && grupo.hideFinanceiro) return null
      if (isComercial && grupo.hideComercial) return null
      if (grupo.modulo && !perfilTemAcesso(role, grupo.modulo)) return null

      // Se for link direto
      if (grupo.tipo === 'link') {
        return grupo
      }

      // Se for mega-menu com colunas
      if (grupo.tipo === 'mega' && grupo.colunas) {
        const colunasFiltradas = grupo.colunas
          .map((col) => {
            const itensValidos = col.itens
              .map(resolveItem)
              .filter((it): it is NavItemConfig => it !== null)
            return {
              ...col,
              itens: itensValidos,
            }
          })
          .filter((col) => col.itens.length > 0)

        if (colunasFiltradas.length === 0) return null
        return {
          ...grupo,
          colunas: colunasFiltradas,
        }
      }

      // Se for dropdown com lista direta de itens
      if (grupo.itens) {
        const itensValidos = grupo.itens
          .map(resolveItem)
          .filter((it): it is NavItemConfig => it !== null)
        if (itensValidos.length === 0) return null
        return {
          ...grupo,
          itens: itensValidos,
        }
      }

      return null
    })
    .filter((g): g is NavGroupConfig => g !== null)
}

/**
 * Coleta todos os itens navegáveis permitidos em formato plano
 * para a Busca de Comandos (Ctrl+K).
 */
export function extrairTodosItensNavegaveis(
  gruposFiltrados: NavGroupConfig[],
): (NavItemConfig & { grupoLabel: string; grupoId: string })[] {
  const lista: (NavItemConfig & { grupoLabel: string; grupoId: string })[] = []

  for (const grupo of gruposFiltrados) {
    if (grupo.tipo === 'link' && grupo.path) {
      lista.push({
        id: grupo.id,
        name: grupo.label,
        path: grupo.path,
        icon: grupo.icon,
        descricao: grupo.subtitulo,
        badge: grupo.badge,
        grupoLabel: 'Acesso Direto',
        grupoId: grupo.id,
      })
      continue
    }

    if (grupo.colunas) {
      for (const col of grupo.colunas) {
        for (const item of col.itens) {
          lista.push({
            ...item,
            grupoLabel: `${grupo.label}${col.titulo ? ` · ${col.titulo}` : ''}`,
            grupoId: grupo.id,
          })
        }
      }
    }

    if (grupo.itens) {
      for (const item of grupo.itens) {
        lista.push({
          ...item,
          grupoLabel: grupo.label,
          grupoId: grupo.id,
        })
      }
    }
  }

  return lista
}
