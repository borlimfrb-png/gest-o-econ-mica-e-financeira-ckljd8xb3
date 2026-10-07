import type { UserRole } from '@/types/finance'

export type ModuloSistema =
  | 'analise_economica_financeira'
  | 'dashboard'
  | 'dashboard_bi'
  | 'empresas'
  | 'grupos_empresariais'
  | 'centros'
  | 'tipos_despesas'
  | 'contas'
  | 'plano_contas'
  | 'minha_empresa'
  | 'admin_usuarios'
  | 'lancamentos'
  | 'gerencial_dre'
  | 'gerencial_despesas_fixas'
  | 'gerencial_despesas_variaveis'
  | 'gerencial_comparativo_despesas'
  | 'gerencial_fluxo_caixa'
  | 'gerencial_analise_faturamento'
  | 'financeiro'
  | 'baixa_recebiveis'
  | 'contratos'
  | 'notas_fiscais'
  | 'formacao_preco'
  | 'indicadores'
  | 'indicadores_valuation'
  | 'planejamento'
  | 'analise_tributaria'
  | 'importacao'
  | 'relatorios'
  | 'relatorio_anual'
  | 'agente_ia'
  | 'configuracoes'

export interface PerfilConfig {
  id: UserRole
  nome: string
  descricao: string
  badgeCor: string
  modulosPermitidos: ModuloSistema[]
}

/**
 * Mapa centralizado e extensível de perfis de usuário -> módulos permitidos.
 * Para adicionar novos perfis intermediários futuramente (ex: Operador, Comercial, Consultor):
 * Basta incluir uma nova entrada neste registro com a lista de módulos permitidos.
 */
export const PERFIS_ACESSO: Record<UserRole, PerfilConfig> = {
  admin: {
    id: 'admin',
    nome: 'Administrador (Super)',
    descricao: 'Acesso irrestrito a todos os módulos, relatórios, cadastros e gestão de usuários.',
    badgeCor: 'bg-purple-100 text-purple-800 border-purple-200',
    modulosPermitidos: [
      'dashboard',
      'dashboard_bi',
      'empresas',
      'grupos_empresariais',
      'centros',
      'tipos_despesas',
      'contas',
      'plano_contas',
      'minha_empresa',
      'analise_economica_financeira',
      'admin_usuarios',
      'lancamentos',
      'gerencial_dre',
      'gerencial_despesas_fixas',
      'gerencial_despesas_variaveis',
      'gerencial_comparativo_despesas',
      'gerencial_fluxo_caixa',
      'gerencial_analise_faturamento',
      'financeiro',
      'baixa_recebiveis',
      'contratos',
      'notas_fiscais',
      'formacao_preco',
      'indicadores',
      'indicadores_valuation',
      'planejamento',
      'analise_tributaria',
      'importacao',
      'relatorios',
      'relatorio_anual',
      'agente_ia',
      'configuracoes',
    ],
  },
  empresa: {
    id: 'empresa',
    nome: 'Usuário Empresa (Padrão)',
    descricao: 'Acesso aos módulos operacionais e de análise da sua empresa vinculada.',
    badgeCor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    modulosPermitidos: [
      'dashboard',
      'dashboard_bi',
      'empresas',
      'grupos_empresariais',
      'centros',
      'analise_economica_financeira',
      'tipos_despesas',
      'contas',
      'plano_contas',
      'minha_empresa',
      'lancamentos',
      'gerencial_dre',
      'gerencial_despesas_fixas',
      'gerencial_despesas_variaveis',
      'gerencial_comparativo_despesas',
      'gerencial_fluxo_caixa',
      'gerencial_analise_faturamento',
      'financeiro',
      'baixa_recebiveis',
      'contratos',
      'notas_fiscais',
      'formacao_preco',
      'indicadores',
      'indicadores_valuation',
      'planejamento',
      'analise_tributaria',
      'importacao',
      'relatorios',
      'relatorio_anual',
      'agente_ia',
      'configuracoes',
    ],
  },
  financeiro: {
    id: 'financeiro',
    nome: 'Financeiro',
    descricao:
      'Perfil focado: visualiza Lançamentos Rápidos, Recebíveis, Contratos, Notas Fiscais e Financeiro da sua empresa. Sem acesso a Valuation ou áreas administrativas.',
    badgeCor: 'bg-blue-100 text-blue-800 border-blue-200',
    modulosPermitidos: [
      'dashboard',
      'lancamentos',
      'gerencial_dre',
      'gerencial_despesas_fixas',
      'gerencial_despesas_variaveis',
      'gerencial_comparativo_despesas',
      'gerencial_fluxo_caixa',
      'gerencial_analise_faturamento',
      'financeiro',
      'baixa_recebiveis',
      'contratos',
      'notas_fiscais',
      'centros',
      'tipos_despesas',
      'contas',
      'plano_contas',
      'minha_empresa',
      'configuracoes',
    ],
  },
  comercial: {
    id: 'comercial',
    nome: 'Comercial',
    descricao:
      'Acesso restrito ao ciclo comercial: Recebíveis, Contratos, Notas Fiscais e Minha Empresa. Bloqueado de módulos contábeis, valuation, formação de preço e administrativos.',
    badgeCor: 'bg-amber-100 text-amber-800 border-amber-200',
    modulosPermitidos: ['baixa_recebiveis', 'contratos', 'notas_fiscais', 'minha_empresa'],
  },
  cliente: {
    id: 'cliente',
    nome: 'Cliente',
    descricao:
      'Acesso exclusivo à tela-hub Análise Econômica e Financeira, Balanço Patrimonial, DRE e análises gerenciais (Faturamento, Despesas Fixas e Variáveis).',
    badgeCor: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    modulosPermitidos: [
      'analise_economica_financeira',
      'gerencial_dre',
      'gerencial_despesas_fixas',
      'gerencial_despesas_variaveis',
      'gerencial_analise_faturamento',
      'empresas',
    ],
  },
}

/**
 * Verifica se um perfil específico tem permissão para acessar determinado módulo.
 */
export function perfilTemAcesso(role: UserRole | undefined, modulo: ModuloSistema): boolean {
  const userRole = role || 'empresa'
  const config = PERFIS_ACESSO[userRole] || PERFIS_ACESSO.empresa
  return config.modulosPermitidos.includes(modulo)
}

/**
 * Retorna as configurações legíveis do perfil.
 */
export function getPerfilConfig(role?: UserRole): PerfilConfig {
  const userRole = role || 'empresa'
  return PERFIS_ACESSO[userRole] || PERFIS_ACESSO.empresa
}

/**
 * Lista de todos os perfis disponíveis para formulários de seleção.
 */
export const LISTA_PERFIS = Object.values(PERFIS_ACESSO)
