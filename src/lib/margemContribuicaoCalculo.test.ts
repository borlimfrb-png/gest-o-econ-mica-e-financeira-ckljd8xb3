import { describe, it, expect } from 'vitest'
import {
  calcularMargemContribuicao,
  compararAnos,
  calcularVariacaoPercentual,
} from './margemContribuicaoCalculo'
import type { LancamentoDre, ContaDre, MesItem } from './dreGerencialTypes'
import { gerarListaMeses } from './dreGerencialTypes'

function criarMeses(ano: number): MesItem[] {
  return gerarListaMeses(ano, 12)
}

describe('calcularMargemContribuicao', () => {
  it('calcula margem mês a mês com receita, despesas variáveis, R$ e %', () => {
    const meses = criarMeses(2026)
    const contas: ContaDre[] = [
      { id: '1', nome: 'Vendas', categoria: 'Receita', classificacao: 'Receita' },
      {
        id: '2',
        nome: 'Impostos sobre venda',
        categoria: 'Despesa Variável',
        classificacao: 'Despesa Variável',
      },
      {
        id: '3',
        nome: 'Matéria-prima',
        categoria: 'Despesa Variável',
        classificacao: 'Despesa Variável',
      },
    ]
    const lancamentos: LancamentoDre[] = [
      { id: 'a', conta_id: '1', data: '2026-01-10', valor: 100000, centro_id: null },
      { id: 'b', conta_id: '2', data: '2026-01-15', valor: 17000, centro_id: null },
      { id: 'c', conta_id: '3', data: '2026-01-20', valor: 33000, centro_id: null },
      { id: 'd', conta_id: '1', data: '2026-02-10', valor: 120000, centro_id: null },
      { id: 'e', conta_id: '2', data: '2026-02-15', valor: 20400, centro_id: null },
    ]

    const resultado = calcularMargemContribuicao(meses, lancamentos, contas)

    expect(resultado.meses).toHaveLength(12)
    const jan = resultado.meses[0]
    expect(jan.receita).toBe(100000)
    expect(jan.despesasVariaveis).toBe(50000)
    expect(jan.margemValor).toBe(50000)
    expect(jan.margemPercentual).toBeCloseTo(50, 5)

    const fev = resultado.meses[1]
    expect(fev.receita).toBe(120000)
    expect(fev.margemValor).toBe(99600)
    expect(fev.margemPercentual).toBeCloseTo(83, 5)

    // Mês sem movimento: estado vazio honesto (null)
    const mar = resultado.meses[2]
    expect(mar.receita).toBeNull()
    expect(mar.despesasVariaveis).toBeNull()
    expect(mar.margemValor).toBeNull()
    expect(mar.margemPercentual).toBeNull()
  })

  it('receita negativa tratada corretamente na margem %', () => {
    const meses = criarMeses(2026)
    const contas: ContaDre[] = [
      { id: '1', nome: 'Devoluções', categoria: 'Receita', classificacao: 'Receita' },
      { id: '2', nome: 'Frete', categoria: 'Despesa Variável', classificacao: 'Despesa Variável' },
    ]
    const lancamentos: LancamentoDre[] = [
      { id: 'a', conta_id: '1', data: '2026-01-10', valor: -50000, centro_id: null },
      { id: 'b', conta_id: '2', data: '2026-01-15', valor: 10000, centro_id: null },
    ]
    const resultado = calcularMargemContribuicao(meses, lancamentos, contas)
    const jan = resultado.meses[0]
    expect(jan.receita).toBe(-50000)
    expect(jan.margemValor).toBe(-60000)
    expect(jan.margemPercentual).toBeCloseTo(120, 5)
  })

  it('totaliza o período corretamente', () => {
    const meses = criarMeses(2026)
    const contas: ContaDre[] = [
      { id: '1', nome: 'Vendas', categoria: 'Receita', classificacao: 'Receita' },
      { id: '2', nome: 'ICMS', categoria: 'Despesa Variável', classificacao: 'Despesa Variável' },
    ]
    const lancamentos: LancamentoDre[] = [
      { id: 'a', conta_id: '1', data: '2026-01-10', valor: 100000, centro_id: null },
      { id: 'b', conta_id: '2', data: '2026-01-20', valor: 20000, centro_id: null },
      { id: 'c', conta_id: '1', data: '2026-12-10', valor: 300000, centro_id: null },
      { id: 'd', conta_id: '2', data: '2026-12-20', valor: 40000, centro_id: null },
    ]
    const resultado = calcularMargemContribuicao(meses, lancamentos, contas)
    expect(resultado.total.receita).toBe(400000)
    expect(resultado.total.despesasVariaveis).toBe(60000)
    expect(resultado.total.margemValor).toBe(340000)
    expect(resultado.total.margemPercentual).toBeCloseTo(85, 5)
  })
})

describe('compararAnos', () => {
  it('compara 2026 com 2025, com variação % ano a ano', () => {
    const contas: ContaDre[] = [
      { id: '1', nome: 'Vendas', categoria: 'Receita', classificacao: 'Receita' },
      { id: '2', nome: 'ICMS', categoria: 'Despesa Variável', classificacao: 'Despesa Variável' },
    ]
    const meses2026 = criarMeses(2026)
    const meses2025 = criarMeses(2025)

    const lanc2026: LancamentoDre[] = [
      { id: 'a', conta_id: '1', data: '2026-01-10', valor: 110000, centro_id: null },
      { id: 'b', conta_id: '2', data: '2026-01-20', valor: 22000, centro_id: null },
    ]
    const lanc2025: LancamentoDre[] = [
      { id: 'a', conta_id: '1', data: '2025-01-10', valor: 100000, centro_id: null },
      { id: 'b', conta_id: '2', data: '2025-01-20', valor: 30000, centro_id: null },
    ]

    const m2026 = calcularMargemContribuicao(meses2026, lanc2026, contas)
    const m2025 = calcularMargemContribuicao(meses2025, lanc2025, contas)
    const comps = compararAnos([m2025, m2026])

    expect(comps).toHaveLength(1)
    const comp = comps[0]
    expect(comp.anoAnterior).toBe(2025)
    expect(comp.anoAtual).toBe(2026)
    expect(comp.variacaoMargemPercentual).toBeCloseTo(20, 5) // 80% - 70% = +10 p.p. → 20% de variação relativa?

    // variação de margem percentual: (80 - 70) / 70 * 100 = 14,2857%
    // Recalculando: 2025: margem 70000/100000 = 70%; 2026: 88000/110000 = 80%
    // (80 - 70) / 70 * 100 = 14,2857...
    expect(comp.variacaoMargemPercentual).toBeCloseTo(14.2857, 3)

    // Receita cresceu 10%
    expect(comp.variacaoReceitaPercentual).toBeCloseTo(10, 5)
    // Despesas variáveis caíram: 22000 vs 30000 → -26,66%
    expect(comp.variacaoDespesasPercentual).toBeCloseTo(-26.6667, 3)
  })

  it('ignora comparação com ano sem movimento (receita null)', () => {
    const contas: ContaDre[] = [
      { id: '1', nome: 'Vendas', categoria: 'Receita', classificacao: 'Receita' },
      { id: '2', nome: 'ICMS', categoria: 'Despesa Variável', classificacao: 'Despesa Variável' },
    ]
    const meses2026 = criarMeses(2026)
    const lanc2026: LancamentoDre[] = [
      { id: 'a', conta_id: '1', data: '2026-01-10', valor: 110000, centro_id: null },
      { id: 'b', conta_id: '2', data: '2026-01-20', valor: 22000, centro_id: null },
    ]
    const m2026 = calcularMargemContribuicao(meses2026, lanc2026, contas)

    // 2024 sem movimento
    const meses2024 = criarMeses(2024)
    const m2024 = calcularMargemContribuicao(meses2024, [], contas)

    const comps = compararAnos([m2024, m2026])
    expect(comps).toHaveLength(0)
  })
})

describe('calcularVariacaoPercentual', () => {
  it('retorna null quando base é zero ou inválida', () => {
    expect(calcularVariacaoPercentual(110, 0)).toBeNull()
    expect(calcularVariacaoPercentual(110, null)).toBeNull()
    expect(calcularVariacaoPercentual(null, 100)).toBeNull()
    expect(calcularVariacaoPercentual(null, null)).toBeNull()
  })

  it('calcula variação simples', () => {
    expect(calcularVariacaoPercentual(110, 100)).toBeCloseTo(10, 5)
    expect(calcularVariacaoPercentual(90, 100)).toBeCloseTo(-10, 5)
    expect(calcularVariacaoPercentual(100, 100)).toBeCloseTo(0, 5)
  })
})
