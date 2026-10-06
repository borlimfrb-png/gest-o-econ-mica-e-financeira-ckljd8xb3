import { describe, it, expect } from 'vitest'
import {
  calcularPercentualFaturamento,
  classificarSemaforoPercentual,
  calcularComparativoDespesas,
} from './comparativoDespesasCalculo'
import { gerarListaMeses } from './dreGerencialTypes'
import type { ContaRecord, LancamentoRecord, PlanoContaRecord } from '@/types/finance'

describe('Comparativo Despesas Fixas × Variáveis - Cálculos e Regras de Negócio', () => {
  describe('calcularPercentualFaturamento', () => {
    it('calcula o percentual correto com faturamento positivo', () => {
      // 20.000 / 100.000 = 20%
      expect(calcularPercentualFaturamento(20000, 100000)).toBe(20)
    })

    it('retorna null se o faturamento for zero', () => {
      expect(calcularPercentualFaturamento(5000, 0)).toBeNull()
    })

    it('retorna null se o faturamento for negativo ou inválido', () => {
      expect(calcularPercentualFaturamento(5000, -200)).toBeNull()
      expect(calcularPercentualFaturamento(5000, Number.NaN)).toBeNull()
      expect(calcularPercentualFaturamento(5000, Number.POSITIVE_INFINITY)).toBeNull()
    })

    it('retorna 0% se o valor for zero com faturamento positivo', () => {
      expect(calcularPercentualFaturamento(0, 50000)).toBe(0)
    })
  })

  describe('classificarSemaforoPercentual', () => {
    it('classifica como verde (<25%)', () => {
      expect(classificarSemaforoPercentual(10)).toBe('verde')
      expect(classificarSemaforoPercentual(24.99)).toBe('verde')
    })

    it('classifica como ambar (25% a 40%)', () => {
      expect(classificarSemaforoPercentual(25)).toBe('ambar')
      expect(classificarSemaforoPercentual(35)).toBe('ambar')
      expect(classificarSemaforoPercentual(40)).toBe('ambar')
    })

    it('classifica como vermelho (>40%)', () => {
      expect(classificarSemaforoPercentual(40.01)).toBe('vermelho')
      expect(classificarSemaforoPercentual(65)).toBe('vermelho')
    })

    it('classifica como neutro valores nulos ou inválidos', () => {
      expect(classificarSemaforoPercentual(null)).toBe('neutro')
      expect(classificarSemaforoPercentual(undefined)).toBe('neutro')
      expect(classificarSemaforoPercentual(Number.NaN)).toBe('neutro')
    })
  })

  describe('calcularComparativoDespesas (Integração com DRE)', () => {
    const meses = gerarListaMeses(2025, 1, 3) // Jan, Fev, Mar

    const contasMock: ContaRecord[] = [
      {
        id: 'c-rec',
        collectionId: 'contas',
        collectionName: 'contas',
        user: 'u-1',
        nome: 'Receita Bruta de Vendas',
        tipo: 'Receita',
        classificacao_dre: 'Receita',
        created: '',
      },
      {
        id: 'c-fixa-aluguel',
        collectionId: 'contas',
        collectionName: 'contas',
        user: 'u-1',
        nome: 'Aluguel Predial',
        codigo: '3.1.01',
        tipo: 'Despesa',
        classificacao_dre: 'Despesa Fixa',
        created: '',
      },
      {
        id: 'c-var-comissao',
        collectionId: 'contas',
        collectionName: 'contas',
        user: 'u-1',
        nome: 'Comissão de Representantes',
        codigo: '3.2.01',
        tipo: 'Despesa',
        classificacao_dre: 'Despesa Variável',
        created: '',
      },
      {
        id: 'c-var-frete',
        collectionId: 'contas',
        collectionName: 'contas',
        user: 'u-1',
        nome: 'Fretes sobre Vendas',
        codigo: '3.2.02',
        tipo: 'Despesa',
        classificacao_dre: 'Despesa Variável',
        created: '',
      },
      {
        id: 'c-oculta',
        collectionId: 'contas',
        collectionName: 'contas',
        user: 'u-1',
        nome: 'Conta Não Exibir DRE',
        tipo: 'Despesa',
        classificacao_dre: 'Despesa Fixa',
        nao_exibir_dre: true,
        created: '',
      },
      {
        id: 'c-nada',
        collectionId: 'contas',
        collectionName: 'contas',
        user: 'u-1',
        nome: 'Conta Não Exibir Nada',
        tipo: 'Despesa',
        classificacao_dre: 'Despesa Variável',
        nao_exibir_em_nada: true,
        created: '',
      },
    ]

    const planosMock: PlanoContaRecord[] = [
      {
        id: 'p-rec',
        collectionId: 'plano_contas',
        collectionName: 'plano_contas',
        user: 'u-1',
        conta: 'c-rec',
        centro: 'cc-1',
        created: '',
      },
      {
        id: 'p-fixa',
        collectionId: 'plano_contas',
        collectionName: 'plano_contas',
        user: 'u-1',
        conta: 'c-fixa-aluguel',
        centro: 'cc-1',
        created: '',
      },
      {
        id: 'p-comissao',
        collectionId: 'plano_contas',
        collectionName: 'plano_contas',
        user: 'u-1',
        conta: 'c-var-comissao',
        centro: 'cc-1',
        created: '',
      },
      {
        id: 'p-frete',
        collectionId: 'plano_contas',
        collectionName: 'plano_contas',
        user: 'u-1',
        conta: 'c-var-frete',
        centro: 'cc-1',
        created: '',
      },
      {
        id: 'p-oculta',
        collectionId: 'plano_contas',
        collectionName: 'plano_contas',
        user: 'u-1',
        conta: 'c-oculta',
        centro: 'cc-1',
        created: '',
      },
      {
        id: 'p-nada',
        collectionId: 'plano_contas',
        collectionName: 'plano_contas',
        user: 'u-1',
        conta: 'c-nada',
        centro: 'cc-1',
        created: '',
      },
    ]

    it('processa conjuntamente Fixas, Variáveis e Faturamento com percentuais e pesos consolidados', () => {
      const lancamentos: LancamentoRecord[] = [
        // Jan: Faturamento 100k, Fixa 20k (20%), Variável 15k (15% = 10k comissao + 5k frete), Total Despesas 35k (35%)
        {
          id: 'l-1',
          collectionId: 'lancamentos',
          collectionName: 'lancamentos',
          empresa: 'emp-1',
          plano_conta: 'p-rec',
          data: '2025-01-05',
          valor: 100000,
          user: 'u-1',
          created: '',
        },
        {
          id: 'l-2',
          collectionId: 'lancamentos',
          collectionName: 'lancamentos',
          empresa: 'emp-1',
          plano_conta: 'p-fixa',
          data: '2025-01-10',
          valor: 20000,
          user: 'u-1',
          created: '',
        },
        {
          id: 'l-3',
          collectionId: 'lancamentos',
          collectionName: 'lancamentos',
          empresa: 'emp-1',
          plano_conta: 'p-comissao',
          data: '2025-01-15',
          valor: 10000,
          user: 'u-1',
          created: '',
        },
        {
          id: 'l-4',
          collectionId: 'lancamentos',
          collectionName: 'lancamentos',
          empresa: 'emp-1',
          plano_conta: 'p-frete',
          data: '2025-01-20',
          valor: 5000,
          user: 'u-1',
          created: '',
        },
        // Fev: Faturamento 50k, Fixa 20k (40%), Variável 5k (10%), Total Despesas 25k (50%)
        {
          id: 'l-5',
          collectionId: 'lancamentos',
          collectionName: 'lancamentos',
          empresa: 'emp-1',
          plano_conta: 'p-rec',
          data: '2025-02-05',
          valor: 50000,
          user: 'u-1',
          created: '',
        },
        {
          id: 'l-6',
          collectionId: 'lancamentos',
          collectionName: 'lancamentos',
          empresa: 'emp-1',
          plano_conta: 'p-fixa',
          data: '2025-02-10',
          valor: 20000,
          user: 'u-1',
          created: '',
        },
        {
          id: 'l-7',
          collectionId: 'lancamentos',
          collectionName: 'lancamentos',
          empresa: 'emp-1',
          plano_conta: 'p-comissao',
          data: '2025-02-15',
          valor: 5000,
          user: 'u-1',
          created: '',
        },
        // Mar: Faturamento 0 (sem vendas), Fixa 20k => % null
        {
          id: 'l-8',
          collectionId: 'lancamentos',
          collectionName: 'lancamentos',
          empresa: 'emp-1',
          plano_conta: 'p-fixa',
          data: '2025-03-10',
          valor: 20000,
          user: 'u-1',
          created: '',
        },
        // Lançamento estornado (deve ser ignorado)
        {
          id: 'l-9',
          collectionId: 'lancamentos',
          collectionName: 'lancamentos',
          empresa: 'emp-1',
          plano_conta: 'p-fixa',
          data: '2025-01-30',
          valor: 99000,
          estornado: true,
          user: 'u-1',
          created: '',
        },
        // Lançamento de contas ocultas (devem ser ignorados)
        {
          id: 'l-10',
          collectionId: 'lancamentos',
          collectionName: 'lancamentos',
          empresa: 'emp-1',
          plano_conta: 'p-oculta',
          data: '2025-01-12',
          valor: 15000,
          user: 'u-1',
          created: '',
        },
        {
          id: 'l-11',
          collectionId: 'lancamentos',
          collectionName: 'lancamentos',
          empresa: 'emp-1',
          plano_conta: 'p-nada',
          data: '2025-01-12',
          valor: 25000,
          user: 'u-1',
          created: '',
        },
      ]

      const res = calcularComparativoDespesas(lancamentos, contasMock, meses, planosMock)

      expect(res.temDados).toBe(true)

      // Verificação de contas separadas por tipo
      expect(res.contasFixas).toHaveLength(1)
      expect(res.contasFixas[0].nome).toBe('Aluguel Predial')
      expect(res.contasVariaveis).toHaveLength(2)

      // Faturamento
      expect(res.faturamentoPorMes['2025-01']).toBe(100000)
      expect(res.faturamentoPorMes['2025-02']).toBe(50000)
      expect(res.faturamentoPorMes['2025-03']).toBe(0)
      expect(res.faturamentoTotalPeriodo).toBe(150000)

      // Despesas Fixas
      expect(res.totalFixasPorMes['2025-01']).toBe(20000)
      expect(res.pctFixasPorMes['2025-01']).toBe(20) // 20k / 100k
      expect(res.totalFixasPorMes['2025-02']).toBe(20000)
      expect(res.pctFixasPorMes['2025-02']).toBe(40) // 20k / 50k
      expect(res.totalFixasPorMes['2025-03']).toBe(20000)
      expect(res.pctFixasPorMes['2025-03']).toBeNull() // Fat 0 => null
      expect(res.totalFixasPeriodo).toBe(60000)
      expect(res.pctFixasPeriodo).toBe(40) // 60k / 150k = 40%

      // Despesas Variáveis
      expect(res.totalVariaveisPorMes['2025-01']).toBe(15000)
      expect(res.pctVariaveisPorMes['2025-01']).toBe(15) // 15k / 100k
      expect(res.totalVariaveisPorMes['2025-02']).toBe(5000)
      expect(res.pctVariaveisPorMes['2025-02']).toBe(10) // 5k / 50k
      expect(res.totalVariaveisPorMes['2025-03']).toBe(0)
      expect(res.pctVariaveisPorMes['2025-03']).toBeNull()
      expect(res.totalVariaveisPeriodo).toBe(20000)
      expect(res.pctVariaveisPeriodo).toBeCloseTo(13.333, 2) // 20k / 150k = 13.33%

      // Despesas Totais
      expect(res.totalDespesasPorMes['2025-01']).toBe(35000)
      expect(res.pctTotalPorMes['2025-01']).toBe(35) // 35k / 100k
      expect(res.totalDespesasPorMes['2025-02']).toBe(25000)
      expect(res.pctTotalPorMes['2025-02']).toBe(50) // 25k / 50k
      expect(res.totalDespesasPeriodo).toBe(80000)
      expect(res.pctTotalPeriodo).toBeCloseTo(53.333, 2) // 80k / 150k = 53.33%

      // Composição relativa Fixas vs Variáveis sobre o total de gastos (60k / 80k = 75%, 20k / 80k = 25%)
      expect(res.pesoFixasSobreTotalDespesas).toBe(75)
      expect(res.pesoVariaveisSobreTotalDespesas).toBe(25)

      // Diagnóstico executivo gerado
      expect(res.diagnostico).toBeDefined()
      expect(res.diagnostico.titulo).toContain('Predominância de Despesas Fixas')
      expect(res.diagnostico.tipo).toBe('predominancia_fixas')
    })

    it('identifica estado vazio quando não há registros', () => {
      const res = calcularComparativoDespesas([], contasMock, meses, planosMock)
      expect(res.temDados).toBe(false)
      expect(res.totalFixasPeriodo).toBe(0)
      expect(res.totalVariaveisPeriodo).toBe(0)
      expect(res.faturamentoTotalPeriodo).toBe(0)
      expect(res.pctTotalPeriodo).toBeNull()
      expect(res.diagnostico.tipo).toBe('sem_dados')
    })
  })
})
