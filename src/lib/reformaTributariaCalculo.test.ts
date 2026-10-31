import { describe, expect, it } from 'vitest'
import {
  CBS_RATE,
  IBS_RATE,
  ALIQUOTA_COMBINADA_RATE,
  CENTRO_CUSTO_ENTRADAS_CODIGO,
  calcularTributoIndividual,
  calcularCargaEfetiva,
  calcularReformaTributaria,
} from './reformaTributariaCalculo'
import type { ContaRecord, LancamentoRecord, PlanoContaRecord } from '@/types/finance'

describe('Motor de Cálculo da Reforma Tributária (CBS / IBS)', () => {
  it('deve possuir as alíquotas de referência oficiais da LC 214/2025', () => {
    expect(CBS_RATE).toBe(0.088) // 8,8%
    expect(IBS_RATE).toBe(0.1768) // 17,68%
    expect(ALIQUOTA_COMBINADA_RATE).toBeCloseTo(0.2648, 4) // 26,48%
    expect(CENTRO_CUSTO_ENTRADAS_CODIGO).toBe('CC-018')
  })

  it('deve calcular corretamente débito, crédito e saldo a recolher individual para CBS e IBS', () => {
    // Base de saídas: R$ 100.000,00 | Base de entradas: R$ 40.000,00
    const saidas = 100_000
    const entradas = 40_000

    const cbs = calcularTributoIndividual('CBS', CBS_RATE, saidas, entradas)
    expect(cbs.debito).toBe(8_800) // 100k * 8.8%
    expect(cbs.credito).toBe(3_520) // 40k * 8.8%
    expect(cbs.saldoLiquido).toBe(5_280) // 8800 - 3520
    expect(cbs.tipoSaldo).toBe('a_recolher')

    const ibs = calcularTributoIndividual('IBS', IBS_RATE, saidas, entradas)
    expect(ibs.debito).toBe(17_680) // 100k * 17.68%
    expect(ibs.credito).toBe(7_072) // 40k * 17.68%
    expect(ibs.saldoLiquido).toBe(10_608) // 17680 - 7072
    expect(ibs.tipoSaldo).toBe('a_recolher')
  })

  it('deve indicar saldo a compensar quando crédito for superior ao débito', () => {
    // Cenário de acúmulo de créditos (compras > vendas)
    const saidas = 20_000
    const entradas = 80_000

    const cbs = calcularTributoIndividual('CBS', CBS_RATE, saidas, entradas)
    expect(cbs.debito).toBe(1_760)
    expect(cbs.credito).toBe(7_040)
    expect(cbs.saldoLiquido).toBe(-5_280)
    expect(cbs.tipoSaldo).toBe('a_compensar')
  })

  it('deve calcular a carga tributária efetiva corretamente', () => {
    // Saldo líquido 15.888 / Receita 100.000 = 15,89%
    const carga = calcularCargaEfetiva(15_888, 100_000)
    expect(carga).toBe(15.89)

    // Base zero de receita não gera divisão por zero
    expect(calcularCargaEfetiva(0, 0)).toBe(0)
  })

  it('deve realizar apuração completa mensal integrando DRE e CC-018', () => {
    const contas: ContaRecord[] = [
      {
        id: 'c-rec',
        collectionId: 'contas',
        collectionName: 'contas',
        codigo: '3.1.01',
        nome: 'Receita de Vendas de Produtos',
        tipo: 'Receita',
        classificacao_dre: 'Receita',
        empresa: 'emp-1',
        user: 'u1',
        created: '',
        updated: '',
      },
      {
        id: 'c-mp',
        collectionId: 'contas',
        collectionName: 'contas',
        codigo: '4.1.01',
        nome: 'Matéria Prima Comprada',
        tipo: 'Despesa',
        classificacao_dre: 'Despesa Variável',
        empresa: 'emp-1',
        user: 'u1',
        created: '',
        updated: '',
      },
    ]

    const planoContas: PlanoContaRecord[] = [
      {
        id: 'pc-vendas',
        collectionId: 'plano_contas',
        collectionName: 'plano_contas',
        codigo: 'PC-VENDAS',
        conta: 'c-rec',
        centro: '',
        empresa: 'emp-1',
        user: 'u1',
        created: '',
        updated: '',
      },
      {
        id: 'pc-mp-cc018',
        collectionId: 'plano_contas',
        collectionName: 'plano_contas',
        codigo: 'PC-MP',
        conta: 'c-mp',
        centro: 'centro-cc018',
        empresa: 'emp-1',
        user: 'u1',
        created: '',
        updated: '',
      },
    ]

    const centros = [
      {
        id: 'centro-cc018',
        codigo: 'CC-018',
        nome: 'MATÉRIA PRIMA',
      },
    ]

    const lancamentos: LancamentoRecord[] = [
      // Venda em Março/2024: R$ 500.000,00
      {
        id: 'l1',
        collectionId: 'lancamentos',
        collectionName: 'lancamentos',
        empresa: 'emp-1',
        plano_conta: 'pc-vendas',
        data: '2024-03-15 10:00:00',
        valor: 500_000,
        historico: 'Vendas Março',
        user: 'u1',
        created: '',
        updated: '',
      },
      // Entrada em Março/2024 no CC-018: R$ 200.000,00
      {
        id: 'l2',
        collectionId: 'lancamentos',
        collectionName: 'lancamentos',
        empresa: 'emp-1',
        plano_conta: 'pc-mp-cc018',
        data: '2024-03-20 10:00:00',
        valor: 200_000,
        historico: 'Compra Fornecedor MP CC-018',
        user: 'u1',
        created: '',
        updated: '',
      },
      // Outro mês (Abril) para validar filtro de período mensal
      {
        id: 'l3',
        collectionId: 'lancamentos',
        collectionName: 'lancamentos',
        empresa: 'emp-1',
        plano_conta: 'pc-vendas',
        data: '2024-04-10 10:00:00',
        valor: 300_000,
        historico: 'Vendas Abril',
        user: 'u1',
        created: '',
        updated: '',
      },
    ]

    const resultado = calcularReformaTributaria({
      periodoTipo: 'mes',
      ano: 2024,
      mes: 3,
      lancamentos,
      contas,
      planoContas,
      centros,
    })

    expect(resultado.periodoTipo).toBe('mes')
    expect(resultado.ano).toBe(2024)
    expect(resultado.mes).toBe(3)
    expect(resultado.receitaBrutaSaidas).toBe(500_000)
    expect(resultado.entradasCC018).toBe(200_000)

    // CBS: Débito 500k * 8.8% = 44.000 | Crédito 200k * 8.8% = 17.600 | Saldo = 26.400
    expect(resultado.cbs.debito).toBe(44_000)
    expect(resultado.cbs.credito).toBe(17_600)
    expect(resultado.cbs.saldoLiquido).toBe(26_400)

    // IBS: Débito 500k * 17.68% = 88.400 | Crédito 200k * 17.68% = 35.360 | Saldo = 53.040
    expect(resultado.ibs.debito).toBe(88_400)
    expect(resultado.ibs.credito).toBe(35_360)
    expect(resultado.ibs.saldoLiquido).toBe(53_040)

    // Total combinado: Débito 132.400 | Crédito 52.960 | Saldo 79.440
    expect(resultado.totalDebitos).toBe(132_400)
    expect(resultado.totalCreditos).toBe(52_960)
    expect(resultado.saldoLiquido).toBe(79_440)
    expect(resultado.tipoSaldo).toBe('a_recolher')

    // Carga efetiva: 79.440 / 500.000 = 15.89% (ou seja, 26,48% * (500k - 200k) / 500k = 26,48% * 0.60 = 15,888%)
    expect(resultado.cargaEfetivaPercent).toBeCloseTo(15.89, 2)
  })

  it('deve realizar apuração anual com detalhamento mês a mês de 12 meses', () => {
    const contas: ContaRecord[] = [
      {
        id: 'c-rec',
        collectionId: 'contas',
        collectionName: 'contas',
        codigo: '3.1.01',
        nome: 'Vendas de Mercadorias',
        tipo: 'Receita',
        classificacao_dre: 'Receita',
        empresa: 'emp-1',
        user: 'u1',
        created: '',
        updated: '',
      },
    ]

    const planoContas: PlanoContaRecord[] = [
      {
        id: 'pc-1',
        collectionId: 'plano_contas',
        collectionName: 'plano_contas',
        codigo: 'PC-1',
        conta: 'c-rec',
        centro: '',
        empresa: 'emp-1',
        user: 'u1',
        created: '',
        updated: '',
      },
    ]

    const lancamentos: LancamentoRecord[] = [
      {
        id: 'l-jan',
        collectionId: 'lancamentos',
        collectionName: 'lancamentos',
        empresa: 'emp-1',
        plano_conta: 'pc-1',
        data: '2024-01-10 10:00:00',
        valor: 100_000,
        user: 'u1',
        created: '',
        updated: '',
      },
      {
        id: 'l-fev',
        collectionId: 'lancamentos',
        collectionName: 'lancamentos',
        empresa: 'emp-1',
        plano_conta: 'pc-1',
        data: '2024-02-10 10:00:00',
        valor: 200_000,
        user: 'u1',
        created: '',
        updated: '',
      },
    ]

    const resultado = calcularReformaTributaria({
      periodoTipo: 'ano',
      ano: 2024,
      lancamentos,
      contas,
      planoContas,
      centros: [{ id: 'cc-018', codigo: 'CC-018', nome: 'Matéria Prima' }],
    })

    expect(resultado.periodoTipo).toBe('ano')
    expect(resultado.meses).toHaveLength(12)
    expect(resultado.receitaBrutaSaidas).toBe(300_000)
    expect(resultado.meses[0].receitaSaidas).toBe(100_000)
    expect(resultado.meses[1].receitaSaidas).toBe(200_000)
    expect(resultado.meses[2].receitaSaidas).toBe(0)
  })
})
