import { describe, it, expect } from 'vitest'
import {
  calcularZScoreAltman,
  zonaPorZPrivada,
  zonaPorZClassica,
  ROTULO_ZONA,
} from './termometroInsolvenciaCalculo'
import type { BalancoRecord, DreRecord } from '@/types/finance'

// Balanço padrão de teste:
// AC = 100 + 50 + 200 + 150 = 500 | ANC = 50 + 0 + 500 + 50 = 600 | AT = 1100
// PC = 80 + 120 = 200 (simplificado) | PNC = 200 | PL = 550 | Passivo Total = 400
const balancoBase = {
  id: 'b1',
  empresa: 'emp1',
  ano: 2024,
  caixa_equivalentes: 100000,
  aplicacoes_financeiras: 50000,
  contas_receber: 200000,
  estoques: 150000,
  impostos_recuperar: 0,
  outros_ativo_circulante: 0,
  realizavel_longo_prazo: 50000,
  investimentos: 0,
  imobilizado: 500000,
  intangivel: 50000,
  fornecedores: 80000,
  emprestimos_curto_prazo: 120000,
  obrigacoes_trabalhistas: 0,
  obrigacoes_tributarias: 0,
  outros_passivo_circulante: 0,
  emprestimos_longo_prazo: 200000,
  outras_obrigacoes_longo_prazo: 0,
  capital_social: 400000,
  reservas_capital: 0,
  reservas_lucros: 100000,
  lucros_acumulados: 50000,
  created: '',
  updated: '',
} as unknown as BalancoRecord

// DRE: RL = 1.800.000 | LL = 550.000 → EBITDA = 550 + 100 + 60 = 710.000
const dreBase = {
  id: 'd1',
  empresa: 'emp1',
  ano: 2024,
  receita_bruta: 2000000,
  deducoes_receita: 200000,
  custo_mercadorias: 800000,
  despesas_operacionais: 150000,
  despesas_financeiras: 60000,
  outras_receitas_despesas: 0,
  imposto_renda: 100000,
  created: '',
  updated: '',
} as unknown as DreRecord

describe('Z-Score de Altman (Termômetro de Insolvência)', () => {
  it('classifica zonas corretamente (modelo privado)', () => {
    expect(zonaPorZPrivada(3.0)).toBe('solvencia')
    expect(zonaPorZPrivada(2.6)).toBe('cinzenta')
    expect(zonaPorZPrivada(1.5)).toBe('cinzenta')
    expect(zonaPorZPrivada(1.1)).toBe('cinzenta')
    expect(zonaPorZPrivada(0.9)).toBe('insolvencia')
    expect(zonaPorZPrivada(null)).toBe(null)
    expect(ROTULO_ZONA.solvencia).toContain('Solv')
  })

  it('classifica zonas corretamente (modelo clássico)', () => {
    expect(zonaPorZClassica(3.5)).toBe('solvencia')
    expect(zonaPorZClassica(2.5)).toBe('cinzenta')
    expect(zonaPorZClassica(1.0)).toBe('insolvencia')
    expect(zonaPorZClassica(null)).toBe(null)
  })

  it("calcula Z'' do modelo privado com os componentes X1..X4", () => {
    const r = calcularZScoreAltman(balancoBase, dreBase)

    expect(r.temDados).toBe(true)
    expect(r.ativoTotal).toBe(1100000)
    expect(r.capitalGiroLiquido).toBe(300000) // 500k - 200k
    expect(r.patrimonioLiquido).toBe(550000) // 400 + 100 + 50
    expect(r.passivoTotal).toBe(400000) // 200 + 200
    expect(r.ebitAproximado).toBe(710000) // 550 + 100 + 60 (paridade BI)

    // X1 = 300/1100 ≈ 0.2727
    expect(r.x1).toBeCloseTo(0.272727, 4)
    // X2 = 150/1100 ≈ 0.13636
    expect(r.x2).toBeCloseTo(0.136364, 4)
    // X3 = 710/1100 ≈ 0.64545
    expect(r.x3).toBeCloseTo(0.645455, 4)
    // X4 = 550/400 = 1.375
    expect(r.x4).toBeCloseTo(1.375, 4)

    const esperado = 6.56 * r.x1! + 3.26 * r.x2! + 6.72 * r.x3! + 1.05 * r.x4!
    expect(r.zPrivada).toBeCloseTo(esperado, 6)
    expect(r.zonaPrivada).toBe('solvencia')
  })

  it('calcula Z clássica incluindo X5 (giro)', () => {
    const r = calcularZScoreAltman(balancoBase, dreBase)
    expect(r.x5).toBeCloseTo(1800000 / 1100000, 4)
    const esperado = 1.2 * r.x1! + 1.4 * r.x2! + 3.3 * r.x3! + 0.6 * r.x4! + 1.0 * r.x5!
    expect(r.zClassica).toBeCloseTo(esperado, 6)
  })

  it('retorna zona null quando não há balanço', () => {
    const r = calcularZScoreAltman(null, dreBase)
    expect(r.temDados).toBe(false)
    expect(r.zPrivada).toBe(null)
    expect(r.zona).toBe(null)
    expect(r.componentesPrivada.every((c) => c.contribuicao === null)).toBe(true)
  })

  it('trata passivo total zero (X4 null) sem quebrar o cálculo dos demais', () => {
    const semPassivo = {
      ...balancoBase,
      fornecedores: 0,
      emprestimos_curto_prazo: 0,
      emprestimos_longo_prazo: 0,
    } as unknown as BalancoRecord
    const r = calcularZScoreAltman(semPassivo, dreBase)
    expect(r.x4).toBe(null)
    expect(r.zPrivada).toBe(null)
    expect(r.zona).toBe(null)
  })
})
