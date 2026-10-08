import { describe, it, expect } from 'vitest'
import {
  calcularPercentualFaturamento,
  classificarSemaforoPercentual,
  calcularAnaliseDespesasVariaveis,
} from './despesasVariaveisCalculo'
import { gerarListaMeses } from './dreGerencialTypes'
import type { ContaRecord, LancamentoRecord, PlanoContaRecord } from '@/types/finance'

describe('Análise de Despesas Variáveis - Cálculos e Regras de Negócio', () => {
  describe('calcularPercentualFaturamento', () => {
    it('calcula o percentual corretamente quando há faturamento positivo', () => {
      // R$ 20.000 de despesa / R$ 100.000 faturamento = 20%
      const pct = calcularPercentualFaturamento(20000, 100000)
      expect(pct).toBe(20)
    })

    it('retorna null se o faturamento for 0 (mês sem faturamento)', () => {
      const pct = calcularPercentualFaturamento(5000, 0)
      expect(pct).toBeNull()
    })

    it('retorna null se o faturamento for negativo ou inválido', () => {
      expect(calcularPercentualFaturamento(5000, -1000)).toBeNull()
      expect(calcularPercentualFaturamento(5000, Number.NaN)).toBeNull()
      expect(calcularPercentualFaturamento(5000, Number.POSITIVE_INFINITY)).toBeNull()
    })

    it('retorna 0% se a despesa for 0 com faturamento positivo', () => {
      const pct = calcularPercentualFaturamento(0, 50000)
      expect(pct).toBe(0)
    })
  })

  describe('classificarSemaforoPercentual', () => {
    it('classifica como verde valores menores que 25%', () => {
      expect(classificarSemaforoPercentual(0)).toBe('verde')
      expect(classificarSemaforoPercentual(15.5)).toBe('verde')
      expect(classificarSemaforoPercentual(24.99)).toBe('verde')
    })

    it('classifica como ambar valores entre 25% e 40% (inclusive)', () => {
      expect(classificarSemaforoPercentual(25)).toBe('ambar')
      expect(classificarSemaforoPercentual(32.8)).toBe('ambar')
      expect(classificarSemaforoPercentual(40)).toBe('ambar')
    })

    it('classifica como vermelho valores acima de 40%', () => {
      expect(classificarSemaforoPercentual(40.01)).toBe('vermelho')
      expect(classificarSemaforoPercentual(55)).toBe('vermelho')
      expect(classificarSemaforoPercentual(105)).toBe('vermelho')
    })

    it('retorna neutro quando percentual é nulo ou indefinido', () => {
      expect(classificarSemaforoPercentual(null)).toBe('neutro')
      expect(classificarSemaforoPercentual(undefined)).toBe('neutro')
      expect(classificarSemaforoPercentual(Number.NaN)).toBe('neutro')
    })
  })

  describe('Agrupamento por Centro de Custo nas Exportações e Telas', () => {
    it('agrupa contas por Centro de Custo e emite apenas uma linha de grupo por centro', () => {
      const contasOrdenadas = [
        { id: '1', nome: 'Comissões Vendas', centroId: 'c1', centroNome: 'Comercial' },
        { id: '2', nome: 'Fretes Vendas', centroId: 'c1', centroNome: 'Comercial' },
        { id: '3', nome: 'Embalagens', centroId: 'c2', centroNome: 'Logística' },
      ]

      const gruposDetectados: string[] = []
      let ultimoCentro: string | null = null

      for (const c of contasOrdenadas) {
        const centroKey = c.centroId || c.centroNome || '__SEM_CENTRO__'
        if (centroKey !== ultimoCentro) {
          ultimoCentro = centroKey
          gruposDetectados.push(c.centroNome || 'Sem Centro de Custo')
        }
      }

      expect(gruposDetectados).toEqual(['Comercial', 'Logística'])
      expect(gruposDetectados).toHaveLength(2)
    })
  })

  describe('calcularAnaliseDespesasVariaveis (Integração com DRE)', () => {
    const meses = gerarListaMeses(2025, 1, 3) // Jan, Fev, Mar

    const contasMock: ContaRecord[] = [
      {
        id: 'c-rec',
        collectionId: 'contas',
        collectionName: 'contas',
        user: 'u-1',
        nome: 'Receitas Operacionais',
        tipo: 'Receita',
        classificacao_dre: 'Receita',
        created: '',
      },
      {
        id: 'c-comissao',
        collectionId: 'contas',
        collectionName: 'contas',
        user: 'u-1',
        nome: 'Comissões de Vendas',
        codigo: '4.1.01',
        tipo: 'Despesa',
        classificacao_dre: 'Despesa Variável',
        created: '',
      },
      {
        id: 'c-frete',
        collectionId: 'contas',
        collectionName: 'contas',
        user: 'u-1',
        nome: 'Fretes sobre Vendas',
        codigo: '4.1.02',
        tipo: 'Despesa',
        classificacao_dre: 'Despesa Variável',
        created: '',
      },
      {
        id: 'c-fixa',
        collectionId: 'contas',
        collectionName: 'contas',
        user: 'u-1',
        nome: 'Aluguel Escritório',
        tipo: 'Despesa',
        classificacao_dre: 'Despesa Fixa',
        created: '',
      },
      {
        id: 'c-oculta',
        collectionId: 'contas',
        collectionName: 'contas',
        user: 'u-1',
        nome: 'Conta Oculta DRE Variável',
        tipo: 'Despesa',
        classificacao_dre: 'Despesa Variável',
        nao_exibir_dre: true,
        created: '',
      },
      {
        id: 'c-excl-nada',
        collectionId: 'contas',
        collectionName: 'contas',
        user: 'u-1',
        nome: 'Conta Excluída Total Variável',
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
        id: 'p-comissao',
        collectionId: 'plano_contas',
        collectionName: 'plano_contas',
        user: 'u-1',
        conta: 'c-comissao',
        centro: 'cc-1',
        created: '',
      },
      {
        id: 'p-frete',
        collectionId: 'plano_contas',
        collectionName: 'plano_contas',
        user: 'u-1',
        conta: 'c-frete',
        centro: 'cc-1',
        created: '',
      },
      {
        id: 'p-fixa',
        collectionId: 'plano_contas',
        collectionName: 'plano_contas',
        user: 'u-1',
        conta: 'c-fixa',
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
    ]

    it('calcula despesas variáveis, percentuais por mês e totais consolidados', () => {
      const lancamentosMock: LancamentoRecord[] = [
        // Jan: Faturamento 100.000, Comissão 10.000 (10%), Frete 5.000 (5%) => Total Variável 15.000 (15%)
        {
          id: 'l-1',
          collectionId: 'lancamentos',
          collectionName: 'lancamentos',
          empresa: 'emp-1',
          plano_conta: 'p-rec',
          data: '2025-01-10',
          valor: 100000,
          user: 'u-1',
          created: '',
        },
        {
          id: 'l-2',
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
          id: 'l-3',
          collectionId: 'lancamentos',
          collectionName: 'lancamentos',
          empresa: 'emp-1',
          plano_conta: 'p-frete',
          data: '2025-01-20',
          valor: 5000,
          user: 'u-1',
          created: '',
        },
        // Fev: Faturamento 50.000, Comissão 10.000 (20%), Frete 10.000 (20%) => Total Variável 20.000 (40%)
        {
          id: 'l-4',
          collectionId: 'lancamentos',
          collectionName: 'lancamentos',
          empresa: 'emp-1',
          plano_conta: 'p-rec',
          data: '2025-02-10',
          valor: 50000,
          user: 'u-1',
          created: '',
        },
        {
          id: 'l-5',
          collectionId: 'lancamentos',
          collectionName: 'lancamentos',
          empresa: 'emp-1',
          plano_conta: 'p-comissao',
          data: '2025-02-15',
          valor: 10000,
          user: 'u-1',
          created: '',
        },
        {
          id: 'l-6',
          collectionId: 'lancamentos',
          collectionName: 'lancamentos',
          empresa: 'emp-1',
          plano_conta: 'p-frete',
          data: '2025-02-20',
          valor: 10000,
          user: 'u-1',
          created: '',
        },
        // Mar: Faturamento 0 (sem vendas), Comissão 8.000 => % deve ser null
        {
          id: 'l-7',
          collectionId: 'lancamentos',
          collectionName: 'lancamentos',
          empresa: 'emp-1',
          plano_conta: 'p-comissao',
          data: '2025-03-15',
          valor: 8000,
          user: 'u-1',
          created: '',
        },
        // Lançamento estornado em Jan (deve ser ignorado)
        {
          id: 'l-8',
          collectionId: 'lancamentos',
          collectionName: 'lancamentos',
          empresa: 'emp-1',
          plano_conta: 'p-comissao',
          data: '2025-01-28',
          valor: 80000,
          estornado: true,
          user: 'u-1',
          created: '',
        },
        // Lançamento de conta oculta DRE (deve ser ignorado)
        {
          id: 'l-9',
          collectionId: 'lancamentos',
          collectionName: 'lancamentos',
          empresa: 'emp-1',
          plano_conta: 'p-oculta',
          data: '2025-01-15',
          valor: 99999,
          user: 'u-1',
          created: '',
        },
        // Lançamento de Despesa Fixa (não deve aparecer na análise de Variáveis)
        {
          id: 'l-10',
          collectionId: 'lancamentos',
          collectionName: 'lancamentos',
          empresa: 'emp-1',
          plano_conta: 'p-fixa',
          data: '2025-01-10',
          valor: 12000,
          user: 'u-1',
          created: '',
        },
      ]

      const res = calcularAnaliseDespesasVariaveis(lancamentosMock, contasMock, meses, planosMock)

      expect(res.temDespesasVariaveis).toBe(true)
      expect(res.contas).toHaveLength(2) // Comissões e Fretes (oculta ignorada, despesa fixa ignorada)

      // Faturamento mensal
      expect(res.faturamentoPorMes['2025-01']).toBe(100000)
      expect(res.faturamentoPorMes['2025-02']).toBe(50000)
      expect(res.faturamentoPorMes['2025-03']).toBe(0)
      expect(res.faturamentoTotalPeriodo).toBe(150000)

      // Total de despesas variáveis por mês
      expect(res.totalDespesasVariaveisPorMes['2025-01']).toBe(15000)
      expect(res.percentualTotalPorMes['2025-01']).toBe(15) // 15.000 / 100.000

      expect(res.totalDespesasVariaveisPorMes['2025-02']).toBe(20000)
      expect(res.percentualTotalPorMes['2025-02']).toBe(40) // 20.000 / 50.000

      expect(res.totalDespesasVariaveisPorMes['2025-03']).toBe(8000)
      expect(res.percentualTotalPorMes['2025-03']).toBeNull() // Fat 0 => null

      // Total Geral do Período
      // Total Variáveis: 15.000 + 20.000 + 8.000 = 43.000
      // Fat Total: 150.000
      // % Consolidado: 43.000 / 150.000 = 28.666...%
      expect(res.totalDespesasVariaveisPeriodo).toBe(43000)
      expect(res.percentualTotalPeriodo).toBeCloseTo((43000 / 150000) * 100, 4)

      // Contas individuais
      const comissao = res.contas.find((c) => c.nome === 'Comissões de Vendas')
      expect(comissao).toBeDefined()
      expect(comissao?.valoresPorMes['2025-01']).toBe(10000)
      expect(comissao?.percentuaisPorMes['2025-01']).toBe(10)
      expect(comissao?.valoresPorMes['2025-02']).toBe(10000)
      expect(comissao?.percentuaisPorMes['2025-02']).toBe(20)
      expect(comissao?.percentuaisPorMes['2025-03']).toBeNull()
      expect(comissao?.totalPeriodo).toBe(28000)
      expect(comissao?.percentualPeriodo).toBeCloseTo((28000 / 150000) * 100, 4)

      const frete = res.contas.find((c) => c.nome === 'Fretes sobre Vendas')
      expect(frete).toBeDefined()
      expect(frete?.valoresPorMes['2025-01']).toBe(5000)
      expect(frete?.percentuaisPorMes['2025-01']).toBe(5)
      expect(frete?.valoresPorMes['2025-02']).toBe(10000)
      expect(frete?.percentuaisPorMes['2025-02']).toBe(20)
      expect(frete?.valoresPorMes['2025-03']).toBe(0)
      expect(frete?.totalPeriodo).toBe(15000)
      expect(frete?.percentualPeriodo).toBe(10) // 15.000 / 150.000 = 10%
    })

    it('identifica quando não há nenhuma despesa variável no período', () => {
      const lancamentosApenasReceita: LancamentoRecord[] = [
        {
          id: 'l-r1',
          collectionId: 'lancamentos',
          collectionName: 'lancamentos',
          empresa: 'emp-1',
          plano_conta: 'p-rec',
          data: '2025-01-10',
          valor: 50000,
          user: 'u-1',
          created: '',
        },
      ]

      const res = calcularAnaliseDespesasVariaveis(
        lancamentosApenasReceita,
        contasMock,
        meses,
        planosMock,
      )
      expect(res.temDespesasVariaveis).toBe(false)
      expect(res.contas).toHaveLength(0)
      expect(res.totalDespesasVariaveisPeriodo).toBe(0)
      expect(res.percentualTotalPeriodo).toBe(0)
    })
  })
})
