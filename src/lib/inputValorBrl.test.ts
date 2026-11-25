import { describe, it, expect } from 'vitest'
import { parseNumeroBrl, formatarNumeroBrl } from './inputValorBrl'

describe('parseNumeroBrl', () => {
  it('interpreta pt-BR com milhar e decimal (1.234,56)', () => {
    expect(parseNumeroBrl('1.234,56')).toBe(1234.56)
  })

  it('interpreta vírgula decimal simples (1234,56)', () => {
    expect(parseNumeroBrl('1234,56')).toBe(1234.56)
  })

  it('interpreta ponto decimal (1234.56)', () => {
    expect(parseNumeroBrl('1234.56')).toBe(1234.56)
  })

  it('interpreta milhares com ponto e 3 dígitos (1.234)', () => {
    expect(parseNumeroBrl('1.234')).toBe(1234)
  })

  it('interpreta múltiplos pontos como milhares (1.234.567)', () => {
    expect(parseNumeroBrl('1.234.567')).toBe(1234567)
  })

  it('número inteiro puro', () => {
    expect(parseNumeroBrl('1234')).toBe(1234)
    expect(parseNumeroBrl('0')).toBe(0)
    expect(parseNumeroBrl('0.')).toBe(0)
    expect(parseNumeroBrl('0,')).toBe(0)
  })

  it('vazio e inválido viram undefined (campo limpo)', () => {
    expect(parseNumeroBrl('')).toBeUndefined()
    expect(parseNumeroBrl('   ')).toBeUndefined()
    expect(parseNumeroBrl('abc')).toBeUndefined()
  })

  it('negativos', () => {
    expect(parseNumeroBrl('-1.234,56')).toBe(-1234.56)
    expect(parseNumeroBrl('-1234.56')).toBe(-1234.56)
    expect(parseNumeroBrl('-500')).toBe(-500)
    expect(parseNumeroBrl('-')).toBeUndefined()
  })

  it('formato EN com milhar (1,234.56)', () => {
    expect(parseNumeroBrl('1,234.56')).toBe(1234.56)
  })

  it('decimal com mais de 2 casas (0,333)', () => {
    expect(parseNumeroBrl('0,333')).toBeCloseTo(0.333, 6)
  })

  it('milhar pt-BR de 4 dígitos (10.530)', () => {
    expect(parseNumeroBrl('10.530')).toBe(10530)
  })

  it('decimal iniciando com vírgula (,5 = 0,5)', () => {
    expect(parseNumeroBrl(',5')).toBe(0.5)
    expect(parseNumeroBrl('.5')).toBe(0.5)
  })
})

describe('formatarNumeroBrl', () => {
  it('formata em pt-BR com 2 decimais', () => {
    expect(formatarNumeroBrl(1234.56)).toBe('1.234,56')
    expect(formatarNumeroBrl(1234567.891)).toBe('1.234.567,89')
    expect(formatarNumeroBrl(0)).toBe('0,00')
    expect(formatarNumeroBrl(-42.5)).toBe('-42,50')
  })

  it('vazio para valores ausentes', () => {
    expect(formatarNumeroBrl(undefined)).toBe('')
    expect(formatarNumeroBrl(null)).toBe('')
  })
})
