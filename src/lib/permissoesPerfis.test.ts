import { describe, it, expect } from 'vitest'
import {
  perfilTemAcesso,
  getRotaInicialPorPerfil,
  getPerfilConfig,
  PERFIS_ACESSO,
  LISTA_PERFIS,
  type ModuloSistema,
} from './permissoesPerfis'
import { MENU_GRUPOS, filtrarMenuPorPerfil } from './menuNavigationConfig'

describe('Permissões de Perfis - Perfil Cliente e Regras de Acesso', () => {
  const modulosPermitidosCliente: ModuloSistema[] = [
    'analise_economica_financeira',
    'cliente_rentabilidade',
    'cliente_crescimento',
    'cliente_dashboard_bi',
    'cliente_indicadores',
    'gerencial_dre',
    'gerencial_despesas_fixas',
    'gerencial_despesas_variaveis',
    'gerencial_analise_faturamento',
    'empresas',
    'configuracoes',
  ]

  const modulosBloqueadosCliente: ModuloSistema[] = [
    'dashboard',
    'dashboard_bi',
    'grupos_empresariais',
    'centros',
    'tipos_despesas',
    'contas',
    'plano_contas',
    'minha_empresa',
    'admin_usuarios',
    'lancamentos',
    'gerencial_projecao_dre',
    'gerencial_comparativo_mensal',
    'gerencial_comparativo_despesas',
    'gerencial_fluxo_caixa',
    'gerencial_indicador_crescimento',
    'gerencial_rentabilidade',
    'gerencial_dashboard_bi',
    'gerencial_indicadores',
    'gerencial_conta_detalhe',
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
  ]

  it('deve definir a rota inicial do perfil cliente como o hub /analise-economica-financeira', () => {
    expect(getRotaInicialPorPerfil('cliente')).toBe('/analise-economica-financeira')
  })

  it('deve retornar as rotas corretas para outros perfis', () => {
    expect(getRotaInicialPorPerfil('comercial')).toBe('/baixa-recebiveis')
    expect(getRotaInicialPorPerfil('admin')).toBe('/dashboard')
    expect(getRotaInicialPorPerfil('empresa')).toBe('/dashboard')
    expect(getRotaInicialPorPerfil('financeiro')).toBe('/dashboard')
    expect(getRotaInicialPorPerfil(undefined)).toBe('/dashboard')
  })

  it('deve permitir acesso do perfil cliente apenas aos módulos liberados (hub + 6 destinos)', () => {
    modulosPermitidosCliente.forEach((modulo) => {
      expect(
        perfilTemAcesso('cliente', modulo),
        `Perfil cliente deveria ter acesso ao módulo ${modulo}`,
      ).toBe(true)
    })
  })

  it('deve bloquear acesso do perfil cliente a todos os módulos operacionais/administrativos restritos', () => {
    modulosBloqueadosCliente.forEach((modulo) => {
      expect(
        perfilTemAcesso('cliente', modulo),
        `Perfil cliente NÃO deveria ter acesso ao módulo ${modulo}`,
      ).toBe(false)
    })
  })

  it('deve conter configuração válida de perfil para cliente com metadados corretos', () => {
    const config = getPerfilConfig('cliente')
    expect(config.id).toBe('cliente')
    expect(config.nome).toBe('Cliente')
    expect(config.modulosPermitidos).toEqual(expect.arrayContaining(modulosPermitidosCliente))
    expect(config.modulosPermitidos.length).toBe(modulosPermitidosCliente.length)
  })

  it('garante que cliente_rentabilidade é exclusivo do perfil cliente', () => {
    expect(perfilTemAcesso('cliente', 'cliente_rentabilidade')).toBe(true)
    expect(perfilTemAcesso('admin', 'cliente_rentabilidade')).toBe(false)
    expect(perfilTemAcesso('empresa', 'cliente_rentabilidade')).toBe(false)
    expect(perfilTemAcesso('financeiro', 'cliente_rentabilidade')).toBe(false)
    expect(perfilTemAcesso('comercial', 'cliente_rentabilidade')).toBe(false)
  })

  it('garante que cliente_crescimento é exclusivo do perfil cliente', () => {
    expect(perfilTemAcesso('cliente', 'cliente_crescimento')).toBe(true)
    expect(perfilTemAcesso('admin', 'cliente_crescimento')).toBe(false)
    expect(perfilTemAcesso('empresa', 'cliente_crescimento')).toBe(false)
    expect(perfilTemAcesso('financeiro', 'cliente_crescimento')).toBe(false)
    expect(perfilTemAcesso('comercial', 'cliente_crescimento')).toBe(false)
  })

  it('garante que as rotas cliente_dashboard_bi e cliente_indicadores são exclusivas do perfil cliente', () => {
    expect(perfilTemAcesso('cliente', 'cliente_dashboard_bi')).toBe(true)
    expect(perfilTemAcesso('admin', 'cliente_dashboard_bi')).toBe(false)
    expect(perfilTemAcesso('cliente', 'cliente_indicadores')).toBe(true)
    expect(perfilTemAcesso('admin', 'cliente_indicadores')).toBe(false)
  })

  it('garante que o cliente NUNCA acessa gerencial_dashboard_bi nem gerencial_indicadores', () => {
    expect(perfilTemAcesso('cliente', 'gerencial_dashboard_bi')).toBe(false)
    expect(perfilTemAcesso('cliente', 'gerencial_indicadores')).toBe(false)
    expect(perfilTemAcesso('admin', 'gerencial_dashboard_bi')).toBe(true)
    expect(perfilTemAcesso('admin', 'gerencial_indicadores')).toBe(true)
  })

  it('garante que gerencial_comparativo_mensal é liberado para perfis internos e bloqueado para cliente', () => {
    expect(perfilTemAcesso('admin', 'gerencial_comparativo_mensal')).toBe(true)
    expect(perfilTemAcesso('empresa', 'gerencial_comparativo_mensal')).toBe(true)
    expect(perfilTemAcesso('financeiro', 'gerencial_comparativo_mensal')).toBe(true)
    expect(perfilTemAcesso('cliente', 'gerencial_comparativo_mensal')).toBe(false)
    expect(perfilTemAcesso('comercial', 'gerencial_comparativo_mensal')).toBe(false)
  })

  it('garante que gerencial_projecao_dre é liberado para perfis internos e bloqueado para cliente', () => {
    expect(perfilTemAcesso('admin', 'gerencial_projecao_dre')).toBe(true)
    expect(perfilTemAcesso('empresa', 'gerencial_projecao_dre')).toBe(true)
    expect(perfilTemAcesso('financeiro', 'gerencial_projecao_dre')).toBe(true)
    expect(perfilTemAcesso('cliente', 'gerencial_projecao_dre')).toBe(false)
    expect(perfilTemAcesso('comercial', 'gerencial_projecao_dre')).toBe(false)
  })

  it('garante que o módulo configuracoes (troca da própria senha) é liberado para todos os perfis autenticados', () => {
    expect(perfilTemAcesso('cliente', 'configuracoes')).toBe(true)
    expect(perfilTemAcesso('admin', 'configuracoes')).toBe(true)
    expect(perfilTemAcesso('empresa', 'configuracoes')).toBe(true)
    expect(perfilTemAcesso('financeiro', 'configuracoes')).toBe(true)
    expect(perfilTemAcesso('comercial', 'configuracoes')).toBe(true)
  })

  it('garante que o item Configurações aparece no menu para todos os perfis autenticados apontando para /configuracoes', () => {
    const adminItem = filtrarMenuPorPerfil(MENU_GRUPOS, 'admin', true, '/empresas').find(
      (g) => g.id === 'configuracoes',
    )
    const comercialItem = filtrarMenuPorPerfil(MENU_GRUPOS, 'comercial', false, '/empresas').find(
      (g) => g.id === 'configuracoes',
    )
    const clienteItem = filtrarMenuPorPerfil(MENU_GRUPOS, 'cliente', false, '/empresas').find(
      (g) => g.id === 'configuracoes',
    )
    const financeiroItem = filtrarMenuPorPerfil(MENU_GRUPOS, 'financeiro', false, '/empresas').find(
      (g) => g.id === 'configuracoes',
    )
    const empresaItem = filtrarMenuPorPerfil(MENU_GRUPOS, 'empresa', false, '/empresas').find(
      (g) => g.id === 'configuracoes',
    )

    expect(adminItem?.path).toBe('/configuracoes')
    expect(comercialItem?.path).toBe('/configuracoes')
    expect(clienteItem?.path).toBe('/configuracoes')
    expect(financeiroItem?.path).toBe('/configuracoes')
    expect(empresaItem?.path).toBe('/configuracoes')
  })

  it('deve listar todos os perfis do sistema na LISTA_PERFIS incluindo cliente', () => {
    const ids = LISTA_PERFIS.map((p) => p.id)
    expect(ids).toContain('cliente')
    expect(ids).toContain('admin')
    expect(ids).toContain('empresa')
    expect(ids).toContain('financeiro')
    expect(ids).toContain('comercial')
    expect(PERFIS_ACESSO.cliente).toBeDefined()
  })
})
