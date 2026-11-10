import { describe, it, expect } from 'vitest'
import { calcularRegressaoLinear } from './regressaoLinearTendencia'

describe('regressaoLinearTendencia', () => {
  it('retorna estável para série com menos de 2 pontos', () => {
    const res = calcularRegressaoLinear([{ ano: 2024, valor: 100 }])
    expect(res.direcao).toBe('estavel')
    expect(res.inclinacao).toBe(0)
    expect(res.primeiroValor).toBe(100)
    expect(res.ultimoValor).toBe(100)
  })

  it('detecta tendência de alta em série crescente', () => {
    const pontos = [
      { ano: 2022, valor: 100 },
      { ano: 2023, valor: 130 },
      { ano: 2024, valor: 160 },
    ]
    const res = calcularRegressaoLinear(pontos)
    expect(res.direcao).toBe('alta')
    expect(res.inclinacao).toBeCloseTo(30, 1)
    expect(res.r2).toBeCloseTo(1, 2)
    expect(res.variacaoTotalPct).toBeCloseTo(60, 1)
  })

  it('detecta tendência de baixa em série decrescente', () => {
    const pontos = [
      { ano: 2022, valor: 200 },
      { ano: 2023, valor: 150 },
      { ano: 2024, valor: 90 },
    ]
    const res = calcularRegressaoLinear(pontos)
    expect(res.direcao).toBe('baixa')
    expect(res.inclinacao).toBeLessThan(0)
    expect(res.variacaoTotalPct).toBeLessThan(0)
  })

  it('calcula pontos ajustados da reta para projeção e visualização', () => {
    const pontos = [
      { ano: 2022, valor: 10 },
      { ano: 2023, valor: 20 },
      { ano: 2024, valor: 30 },
    ]
    const res = calcularRegressaoLinear(pontos)
    expect(res.pontosRegressao).toHaveLength(3)
    expect(res.pontosRegressao[0].valorAjustado).toBeCloseTo(10, 1)
    expect(res.pontosRegressao[2].valorAjustado).toBeCloseTo(30, 1)
  })

  it('ignora anos nulos sem quebrar o cálculo', () => {
    const pontos = [
      { ano: 2021, valor: null },
      { ano: 2022, valor: 50 },
      { ano: 2023, valor: null },
      { ano: 2024, valor: 100 },
    ]
    const res = calcularRegressaoLinear(pontos)
    expect(res.direcao).toBe('alta')
    expect(res.primeiroValor).toBe(50)
    expect(res.ultimoValor).toBe(100)
    expect(res.variacaoTotalPct).toBeCloseTo(100, 1)
  })
})
