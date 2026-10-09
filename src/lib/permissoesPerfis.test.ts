import { describe, it, expect } from 'vitest'
import {
  perfilTemAcesso,
  getRotaInicialPorPerfil,
  getPerfilConfig,
  PERFIS_ACESSO,
  LISTA_PERFIS,
  type ModuloSistema,
} from './permissoesPerfis'

describe('Permissões de Perfis - Perfil Cliente e Regras de Acesso', () => {
  const modulosPermitidosCliente: ModuloSistema[] = [
    'analise_economica_financeira',
    'gerencial_dre',
    'gerencial_despesas_fixas',
    'gerencial_despesas_variaveis',
    'gerencial_analise_faturamento',
    'empresas',
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
    'gerencial_comparativo_despesas',
    'gerencial_fluxo_caixa',
    'gerencial_indicador_crescimento',
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

  it('deve permitir acesso do perfil cliente apenas aos módulos liberados (hub + 5 destinos)', () => {
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
