import { describe, it, expect } from 'vitest'
import {
  calcularIndicadoresAvancados,
  classificarCobertura,
  ROTULO_CLASSIFICACAO_COBERTURA,
} from './indicadoresAvancadosCalculo'
import type { BalancoRecord, DreRecord } from '@/types/finance'

// AC = 500 | ANC = 600 | AT = 1100 (mil) | PC = 200 | PNC = 200 | PL = 550
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

// RL = 1.800.000 | LL = 550.000 | EBITDA = 710.000 | CMV = 800.000
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

describe('Indicadores Econômicos Avançados', () => {
  it('EVA: NOPAT, custo de capital e EVA', () => {
    const r = calcularIndicadoresAvancados(balancoBase, dreBase, 12)

    expect(r.eva.nopat).toBeCloseTo(710000 * 0.66, 2) // 468.600
    expect(r.eva.capitalInvestido).toBe(750000) // PL 550 + LP 200
    expect(r.eva.custoCapital).toBeCloseTo(90000, 2) // 750k * 12%
    expect(r.eva.eva).toBeCloseTo(468600 - 90000, 2) // 378.600
    expect(r.eva.margemEva).toBeCloseTo((378600 / 1800000) * 100, 4)
  })

  it('DuPont: margem x giro x alavancagem = ROE', () => {
    const r = calcularIndicadoresAvancados(balancoBase, dreBase, 12)

    expect(r.dupont.margemLiquida).toBeCloseTo((550000 / 1800000) * 100, 4)
    expect(r.dupont.giroAtivo).toBeCloseTo(1800000 / 1100000, 6)
    expect(r.dupont.alavancagemFinanceira).toBeCloseTo(1100000 / 550000, 6)
    expect(r.dupont.roe).toBeCloseTo((550000 / 550000) * 100, 4)

    // Identidade DuPont: ROE = margem * giro * alavancagem
    const roeIdentidade =
      ((r.dupont.margemLiquida || 0) / 100) *
      (r.dupont.giroAtivo || 0) *
      (r.dupont.alavancagemFinanceira || 0) *
      100
    expect(roeIdentidade).toBeCloseTo(r.dupont.roe || 0, 4)
    expect(r.dupont.roa).toBeCloseTo((550000 / 1100000) * 100, 4)
  })

  it('Ciclo de Conversão de Caixa: PME + PMR - PMP', () => {
    const r = calcularIndicadoresAvancados(balancoBase, dreBase, 12)

    expect(r.ciclo.pme).toBeCloseTo((150000 / 800000) * 360, 4) // 67,5 dias
    // PMR usa receita bruta como base de vendas
    expect(r.ciclo.pmr).toBeCloseTo((200000 / 2000000) * 360, 4) // 36 dias
    expect(r.ciclo.pmp).toBeCloseTo((80000 / 800000) * 360, 4) // 36 dias
    expect(r.ciclo.cicloOperacional).toBeCloseTo(67.5 + 36, 4)
    expect(r.ciclo.cicloConversaoCaixa).toBeCloseTo(67.5 + 36 - 36, 4)
  })

  it('Cobertura de Juros: EBITDA / Despesas Financeiras com classificação', () => {
    const r = calcularIndicadoresAvancados(balancoBase, dreBase, 12)

    expect(r.cobertura.ebit).toBeCloseTo(710000, 2)
    expect(r.cobertura.despesasFinanceiras).toBe(60000)
    expect(r.cobertura.cobertura).toBeCloseTo(710000 / 60000, 4)
    expect(r.cobertura.classificacao).toBe('confortavel')

    expect(classificarCobertura(6)).toBe('confortavel')
    expect(classificarCobertura(4)).toBe('adequada')
    expect(classificarCobertura(2)).toBe('apertada')
    expect(classificarCobertura(0.8)).toBe('critica')
    expect(classificarCobertura(null)).toBe('sem_dados')
    expect(ROTULO_CLASSIFICACAO_COBERTURA.confortavel).toBe('Confortável')
  })

  it('trata ausência de balanço sem quebrar (cobertura e DuPont parcialmente nulos)', () => {
    const r = calcularIndicadoresAvancados(null, dreBase, 12)

    expect(r.dupont.giroAtivo).toBe(null)
    expect(r.dupont.alavancagemFinanceira).toBe(null)
    expect(r.ciclo.cicloConversaoCaixa).toBe(null)
    // EVA segue calculável pois capitalInvestido = 0 + 0
    expect(r.eva.eva).toBeCloseTo(r.eva.nopat, 2)
    // Cobertura de juros continua calculável (só depende da DRE)
    expect(r.cobertura.cobertura).toBeCloseTo(710000 / 60000, 4)
  })
})
