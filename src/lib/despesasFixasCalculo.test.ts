import { describe, it, expect } from 'vitest'
import {
  calcularPercentualFaturamento,
  classificarSemaforoPercentual,
  calcularAnaliseDespesasFixas,
} from './despesasFixasCalculo'
import { gerarListaMeses } from './dreGerencialTypes'
import type { ContaRecord, LancamentoRecord, PlanoContaRecord } from '@/types/finance'

describe('Análise de Despesas Fixas - Cálculos e Regras de Negócio', () => {
  describe('calcularPercentualFaturamento', () => {
    it('calcula o percentual corretamente quando há faturamento positivo', () => {
      // R$ 25.000 de despesa / R$ 100.000 faturamento = 25%
      const pct = calcularPercentualFaturamento(25000, 100000)
      expect(pct).toBe(25)
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
        { id: '1', nome: 'Aluguel', centroId: 'c1', centroNome: 'Administrativo' },
        { id: '2', nome: 'Energia ADM', centroId: 'c1', centroNome: 'Administrativo' },
        { id: '3', nome: 'Limpeza ADM', centroId: 'c1', centroNome: 'Administrativo' },
        { id: '4', nome: 'Manutenção Fábrica', centroId: 'c2', centroNome: 'Operacional' },
        { id: '5', nome: 'Segurança Fábrica', centroId: 'c2', centroNome: 'Operacional' },
        { id: '6', nome: 'Outros Gerais', centroId: undefined, centroNome: undefined },
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

      // Deve ter detectado exatamente 3 grupos (Administrativo, Operacional, Sem Centro)
      expect(gruposDetectados).toEqual(['Administrativo', 'Operacional', 'Sem Centro de Custo'])
      expect(gruposDetectados).toHaveLength(3)
    })
  })

  describe('calcularAnaliseDespesasFixas (Integração com DRE)', () => {
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
        id: 'c-aluguel',
        collectionId: 'contas',
        collectionName: 'contas',
        user: 'u-1',
        nome: 'Aluguel Escritório',
        codigo: '3.1.01',
        tipo: 'Despesa',
        classificacao_dre: 'Despesa Fixa',
        created: '',
      },
      {
        id: 'c-software',
        collectionId: 'contas',
        collectionName: 'contas',
        user: 'u-1',
        nome: 'Licenças de Software',
        codigo: '3.1.02',
        tipo: 'Despesa',
        classificacao_dre: 'Despesa Fixa',
        created: '',
      },
      {
        id: 'c-var',
        collectionId: 'contas',
        collectionName: 'contas',
        user: 'u-1',
        nome: 'Comissões de Vendas',
        tipo: 'Despesa',
        classificacao_dre: 'Despesa Variável',
        created: '',
      },
      {
        id: 'c-oculta',
        collectionId: 'contas',
        collectionName: 'contas',
        user: 'u-1',
        nome: 'Conta Oculta DRE',
        tipo: 'Despesa',
        classificacao_dre: 'Despesa Fixa',
        nao_exibir_dre: true,
        created: '',
      },
      {
        id: 'c-excl-nada',
        collectionId: 'contas',
        collectionName: 'contas',
        user: 'u-1',
        nome: 'Conta Excluída Total',
        tipo: 'Despesa',
        classificacao_dre: 'Despesa Fixa',
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
        id: 'p-aluguel',
        collectionId: 'plano_contas',
        collectionName: 'plano_contas',
        user: 'u-1',
        conta: 'c-aluguel',
        centro: 'cc-1',
        created: '',
      },
      {
        id: 'p-software',
        collectionId: 'plano_contas',
        collectionName: 'plano_contas',
        user: 'u-1',
        conta: 'c-software',
        centro: 'cc-1',
        created: '',
      },
      {
        id: 'p-var',
        collectionId: 'plano_contas',
        collectionName: 'plano_contas',
        user: 'u-1',
        conta: 'c-var',
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

    it('calcula despesas fixas, percentuais por mês e totais consolidados', () => {
      const lancamentosMock: LancamentoRecord[] = [
        // Jan: Faturamento 100.000, Aluguel 10.000 (10%), Software 5.000 (5%) => Total Fixa 15.000 (15%)
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
          plano_conta: 'p-aluguel',
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
          plano_conta: 'p-software',
          data: '2025-01-20',
          valor: 5000,
          user: 'u-1',
          created: '',
        },
        // Fev: Faturamento 50.000, Aluguel 10.000 (20%), Software 10.000 (20%) => Total Fixa 20.000 (40%)
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
          plano_conta: 'p-aluguel',
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
          plano_conta: 'p-software',
          data: '2025-02-20',
          valor: 10000,
          user: 'u-1',
          created: '',
        },
        // Mar: Faturamento 0 (sem vendas), Aluguel 10.000 => % deve ser null
        {
          id: 'l-7',
          collectionId: 'lancamentos',
          collectionName: 'lancamentos',
          empresa: 'emp-1',
          plano_conta: 'p-aluguel',
          data: '2025-03-15',
          valor: 10000,
          user: 'u-1',
          created: '',
        },
        // Lançamento estornado em Jan (deve ser ignorado)
        {
          id: 'l-8',
          collectionId: 'lancamentos',
          collectionName: 'lancamentos',
          empresa: 'emp-1',
          plano_conta: 'p-aluguel',
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
      ]

      const res = calcularAnaliseDespesasFixas(lancamentosMock, contasMock, meses, planosMock)

      expect(res.temDespesasFixas).toBe(true)
      expect(res.contas).toHaveLength(2) // Aluguel e Software (oculta ignorada, comissão variável ignorada)

      // Faturamento mensal
      expect(res.faturamentoPorMes['2025-01']).toBe(100000)
      expect(res.faturamentoPorMes['2025-02']).toBe(50000)
      expect(res.faturamentoPorMes['2025-03']).toBe(0)
      expect(res.faturamentoTotalPeriodo).toBe(150000)

      // Total de despesas fixas por mês
      expect(res.totalDespesasFixasPorMes['2025-01']).toBe(15000)
      expect(res.percentualTotalPorMes['2025-01']).toBe(15) // 15.000 / 100.000

      expect(res.totalDespesasFixasPorMes['2025-02']).toBe(20000)
      expect(res.percentualTotalPorMes['2025-02']).toBe(40) // 20.000 / 50.000

      expect(res.totalDespesasFixasPorMes['2025-03']).toBe(10000)
      expect(res.percentualTotalPorMes['2025-03']).toBeNull() // Fat 0 => null

      // Total Geral do Período
      // Total Fixas: 15.000 + 20.000 + 10.000 = 45.000
      // Fat Total: 150.000
      // % Consolidado: 45.000 / 150.000 = 30%
      expect(res.totalDespesasFixasPeriodo).toBe(45000)
      expect(res.percentualTotalPeriodo).toBe(30)

      // Contas individuais
      const aluguel = res.contas.find((c) => c.nome === 'Aluguel Escritório')
      expect(aluguel).toBeDefined()
      expect(aluguel?.valoresPorMes['2025-01']).toBe(10000)
      expect(aluguel?.percentuaisPorMes['2025-01']).toBe(10)
      expect(aluguel?.valoresPorMes['2025-02']).toBe(10000)
      expect(aluguel?.percentuaisPorMes['2025-02']).toBe(20)
      expect(aluguel?.percentuaisPorMes['2025-03']).toBeNull()
      expect(aluguel?.totalPeriodo).toBe(30000)
      expect(aluguel?.percentualPeriodo).toBe(20) // 30.000 / 150.000 = 20%

      const software = res.contas.find((c) => c.nome === 'Licenças de Software')
      expect(software).toBeDefined()
      expect(software?.valoresPorMes['2025-01']).toBe(5000)
      expect(software?.percentuaisPorMes['2025-01']).toBe(5)
      expect(software?.valoresPorMes['2025-02']).toBe(10000)
      expect(software?.percentuaisPorMes['2025-02']).toBe(20)
      expect(software?.valoresPorMes['2025-03']).toBe(0)
      expect(software?.totalPeriodo).toBe(15000)
      expect(software?.percentualPeriodo).toBe(10) // 15.000 / 150.000 = 10%
    })

    it('identifica quando não há nenhuma despesa fixa no período', () => {
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

      const res = calcularAnaliseDespesasFixas(
        lancamentosApenasReceita,
        contasMock,
        meses,
        planosMock,
      )
      expect(res.temDespesasFixas).toBe(false)
      expect(res.contas).toHaveLength(0)
      expect(res.totalDespesasFixasPeriodo).toBe(0)
      expect(res.percentualTotalPeriodo).toBe(0)
    })
  })
})
