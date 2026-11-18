import { describe, it, expect } from 'vitest'
import { normalizarLista, TODAS_FERRAMENTAS_IDS } from './ferramentasUsuariosService'
import { CATALOGO_FERRAMENTAS } from '@/lib/ferramentasCatalogo'

/**
 * Regressão do caso maic@imcal.com.br: registro LEGADO em ferramentas_usuarios
 * (criado antes da migração 0110, created/updated vazios) com campo JSON que
 * pode chegar como string, e o contrato de salvar o conjunto COMPLETO de
 * desabilitadas (nunca filtrar por TODAS_FERRAMENTAS_IDS).
 */

const LISTA_LEGADO_MAIC = [
  'dashboard',
  'gerencial_fluxo_caixa',
  'gerencial_indicadores',
  'financeiro',
  'baixa_recebiveis',
  'contratos',
  'notas_fiscais',
  'importacao',
  'relatorios',
]

describe('ferramentas_usuarios — registro legado pré-0110 (caso maic)', () => {
  it('campo JSON chega como string legada → normaliza para a lista completa', () => {
    const lista = normalizarLista(JSON.stringify(LISTA_LEGADO_MAIC))
    expect(lista).toEqual(LISTA_LEGADO_MAIC)
    expect(lista).toContain('gerencial_fluxo_caixa')
  })

  it('campo vazio/nulo/inválido → lista vazia (falha aberta, tudo habilitado)', () => {
    expect(normalizarLista(null)).toEqual([])
    expect(normalizarLista(undefined)).toEqual([])
    expect(normalizarLista('')).toEqual([])
    expect(normalizarLista('não é json')).toEqual([])
    expect(normalizarLista('{"objeto":true}')).toEqual([])
  })

  it('campo já em array → preservado (inclui ids fora do catálogo)', () => {
    const comLegado = [...LISTA_LEGADO_MAIC, 'modulo_fantasma_fora_do_catalogo']
    expect(normalizarLista(comLegado)).toEqual(comLegado)
  })

  it('ligar gerencial_fluxo_caixa remove SOMENTE ele do conjunto completo', () => {
    const atual = new Set(normalizarLista(LISTA_LEGADO_MAIC))
    atual.delete('gerencial_fluxo_caixa')
    const novaLista = Array.from(atual)

    expect(novaLista).not.toContain('gerencial_fluxo_caixa')
    // Os demais desabilitados do maic continuam (aceite 4)
    for (const esperado of [
      'dashboard',
      'gerencial_indicadores',
      'financeiro',
      'baixa_recebiveis',
      'contratos',
      'notas_fiscais',
      'importacao',
      'relatorios',
    ]) {
      expect(novaLista).toContain(esperado)
    }
  })

  it('catálogo expõe o toggle Fluxo de Caixa com id gerencial_fluxo_caixa', () => {
    const ferramenta = CATALOGO_FERRAMENTAS.find((f) => f.id === 'gerencial_fluxo_caixa')
    expect(ferramenta).toBeDefined()
    expect(ferramenta?.nome).toContain('Fluxo de Caixa')
    expect(ferramenta?.rota).toBe('/gerencial/fluxo-caixa')
  })

  it('TODAS_FERRAMENTAS_IDS cobre todo o catálogo (nenhum toggle sem módulo de salvamento)', () => {
    for (const f of CATALOGO_FERRAMENTAS) {
      expect(TODAS_FERRAMENTAS_IDS).toContain(f.id)
    }
  })
})
