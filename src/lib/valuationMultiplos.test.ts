import { describe, it, expect } from 'vitest'
import {
  calcularMultiplosMercado,
  gerarComparativoTresMetodos,
  obterMultiplosPadraoSetor,
  MULTIPLOS_SETORIAIS_PADRAO,
} from './valuationMultiplos'
import type { BalancoRecord, DreRecord } from '@/types/finance'

describe('Valuation por Múltiplos de Mercado', () => {
  it('retorna benchmarks setoriais conhecidos', () => {
    const padraoServicos = obterMultiplosPadraoSetor('Serviços')
    expect(padraoServicos.ev_ebitda).toBe(6.5)
    expect(padraoServicos.pl).toBe(10.0)

    const padraoTech = obterMultiplosPadraoSetor('Tecnologia')
    expect(padraoTech.ev_ebitda).toBe(11.0)

    const padraoDesconhecido = obterMultiplosPadraoSetor('Inexistente')
    expect(padraoDesconhecido.ev_ebitda).toBe(6.0)
  })

  it('calcula corretamente os múltiplos de mercado a partir de DRE e Balanço', () => {
    const balancoMock = {
      id: 'b1',
      empresa: 'emp1',
      ano: 2024,
      caixa_equivalentes: 100000,
      aplicacoes_financeiras: 50000,
      contas_receber: 200000,
      estoques: 150000,
      outros_ativos_circulantes: 0,
      realizavel_longo_prazo: 50000,
      investimentos: 0,
      imobilizado: 500000,
      intangivel: 50000,
      fornecedores: 80000,
      emprestimos_financiamentos_cp: 120000,
      obrigacoes_fiscais: 30000,
      outras_obrigacoes_cp: 20000,
      emprestimos_financiamentos_lp: 200000,
      outras_obrigacoes_lp: 50000,
      capital_social: 400000,
      reservas_capital: 50000,
      reservas_lucros: 100000,
      created: '',
      updated: '',
    } as unknown as BalancoRecord

    const dreMock = {
      id: 'd1',
      empresa: 'emp1',
      ano: 2024,
      receita_bruta: 2000000,
      deducoes_receita: 200000,
      custos_produtos_vendidos: 800000,
      despesas_vendas: 150000,
      despesas_gerais_administrativas: 200000,
      outras_despesas_operacionais: 50000,
      outras_receitas_operacionais: 0,
      depreciacao_amortizacao: 50000,
      receitas_financeiras: 10000,
      despesas_financeiras: 60000,
      outras_receitas_nao_operacionais: 0,
      outras_despesas_nao_operacionais: 0,
      provisao_ir_csll: 100000,
      participacoes_debentures: 0,
      created: '',
      updated: '',
    } as unknown as DreRecord

    const res = calcularMultiplosMercado({
      balanco: balancoMock,
      dre: dreMock,
      segmento: 'Serviços',
    })

    expect(res.temDados).toBe(true)
    expect(res.ebitda).toBeGreaterThan(0)
    expect(res.lucroLiquido).toBeGreaterThan(0)
    expect(res.valorPonderado).toBeGreaterThan(0)
    expect(res.valorMinimo).toBeGreaterThan(0)
    expect(res.valorMaximo).toBeGreaterThanOrEqual(res.valorMinimo)
    expect(res.somaPesosAtivos).toBe(100)
    expect(res.itens.length).toBe(6)

    // EV/EBITDA deve estar calculado
    const itemEvEbitda = res.itens.find((i) => i.key === 'ev_ebitda')
    expect(itemEvEbitda).toBeDefined()
    expect(itemEvEbitda?.multiploReferencia).toBe(6.5)
    expect(itemEvEbitda?.valorImplícitoEmpresa).toBeCloseTo(res.ebitda * 6.5, 0)
  })

  it('calcula comparativo dos três métodos e gera parecer', () => {
    const comp = gerarComparativoTresMetodos({
      valorFCD: 5000000,
      valorSuperlucro: 4200000,
      valorMultiplos: 4800000,
      ebitda: 800000,
      lucroLiquido: 500000,
      patrimonioLiquido: 2000000,
      segmento: 'Tecnologia',
    })

    expect(comp.fcd.valido).toBe(true)
    expect(comp.superlucro.valido).toBe(true)
    expect(comp.multiplos.valido).toBe(true)
    expect(comp.faixaGeralMin).toBe(4200000)
    expect(comp.faixaGeralMax).toBe(5000000)
    expect(comp.valorCentralTriplo).toBeCloseTo((5000000 + 4200000 + 4800000) / 3, 2)
    expect(comp.tituloParecer).toBeTruthy()
    expect(comp.textoParecer).toBeTruthy()
  })

  it('lida graciosamente com ausência de dados', () => {
    const res = calcularMultiplosMercado({
      balanco: null,
      dre: null,
    })
    expect(res.temDados).toBe(false)
    expect(res.valorPonderado).toBe(0)
    expect(res.valorMinimo).toBe(0)
    expect(res.valorMaximo).toBe(0)
  })
})
