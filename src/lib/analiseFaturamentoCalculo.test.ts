import { describe, it, expect } from 'vitest'
import {
  calcularVariacaoYoY,
  calcularParticipacaoAcumulado,
  classificarSemaforoVariacao,
  gerarDiagnosticoFaturamento,
  calcularAnaliseFaturamento,
  type FaturamentoAnoLinha,
} from './analiseFaturamentoCalculo'
import type { ContaRecord, LancamentoRecord, PlanoContaRecord } from '@/types/finance'

describe('Análise de Faturamento - Cálculos e Regras de Negócio', () => {
  describe('calcularVariacaoYoY', () => {
    it('calcula crescimento positivo corretamente', () => {
      // 120k vs 100k = +20%
      expect(calcularVariacaoYoY(120000, 100000)).toBe(20)
    })

    it('calcula queda / retração corretamente', () => {
      // 80k vs 100k = -20%
      expect(calcularVariacaoYoY(80000, 100000)).toBe(-20)
    })

    it('retorna null se o valor do ano anterior for zero', () => {
      expect(calcularVariacaoYoY(50000, 0)).toBeNull()
    })

    it('retorna null se o valor do ano anterior for negativo ou inválido', () => {
      expect(calcularVariacaoYoY(50000, -100)).toBeNull()
      expect(calcularVariacaoYoY(50000, Number.NaN)).toBeNull()
      expect(calcularVariacaoYoY(50000, Number.POSITIVE_INFINITY)).toBeNull()
    })

    it('retorna -100% se o ano atual faturou zero vs positivo', () => {
      expect(calcularVariacaoYoY(0, 50000)).toBe(-100)
    })
  })

  describe('calcularParticipacaoAcumulado', () => {
    it('calcula percentual de participação de cada ano sobre o acumulado', () => {
      // 50k de 200k = 25%
      expect(calcularParticipacaoAcumulado(50000, 200000)).toBe(25)
      // 100k de 200k = 50%
      expect(calcularParticipacaoAcumulado(100000, 200000)).toBe(50)
    })

    it('retorna null se o total acumulado for zero ou negativo', () => {
      expect(calcularParticipacaoAcumulado(1000, 0)).toBeNull()
      expect(calcularParticipacaoAcumulado(1000, -50)).toBeNull()
      expect(calcularParticipacaoAcumulado(1000, Number.NaN)).toBeNull()
    })
  })

  describe('classificarSemaforoVariacao', () => {
    it('classifica como verde variações positivas', () => {
      expect(classificarSemaforoVariacao(15)).toBe('verde')
      expect(classificarSemaforoVariacao(0.5)).toBe('verde')
    })

    it('classifica como vermelho variações negativas', () => {
      expect(classificarSemaforoVariacao(-10)).toBe('vermelho')
      expect(classificarSemaforoVariacao(-0.2)).toBe('vermelho')
    })

    it('classifica como neutro variação zero ou nula', () => {
      expect(classificarSemaforoVariacao(0)).toBe('neutro')
      expect(classificarSemaforoVariacao(null)).toBe('neutro')
      expect(classificarSemaforoVariacao(undefined)).toBe('neutro')
    })
  })

  describe('gerarDiagnosticoFaturamento', () => {
    it('retorna sem_dados para linhas vazias ou total zero', () => {
      const diag = gerarDiagnosticoFaturamento([], 0)
      expect(diag.tipo).toBe('sem_dados')
    })

    it('retorna inicial para histórico com apenas 1 ano', () => {
      const linha: FaturamentoAnoLinha = {
        ano: 2024,
        valoresPorMes: {
          1: 10000,
          2: 10000,
          3: 0,
          4: 0,
          5: 0,
          6: 0,
          7: 0,
          8: 0,
          9: 0,
          10: 0,
          11: 0,
          12: 0,
        },
        mesesComDados: {
          1: true,
          2: true,
          3: false,
          4: false,
          5: false,
          6: false,
          7: false,
          8: false,
          9: false,
          10: false,
          11: false,
          12: false,
        },
        totalAno: 20000,
        participacaoAcumulado: 100,
        variacaoYoY: null,
      }
      const diag = gerarDiagnosticoFaturamento([linha], 20000)
      expect(diag.tipo).toBe('inicial')
      expect(diag.titulo).toContain('2024')
    })

    it('detecta crescimento consistente em série de múltiplos anos em alta', () => {
      const linhas: FaturamentoAnoLinha[] = [
        {
          ano: 2022,
          valoresPorMes: {
            1: 10000,
            2: 10000,
            3: 10000,
            4: 10000,
            5: 10000,
            6: 10000,
            7: 10000,
            8: 10000,
            9: 10000,
            10: 10000,
            11: 10000,
            12: 10000,
          },
          mesesComDados: {
            1: true,
            2: true,
            3: true,
            4: true,
            5: true,
            6: true,
            7: true,
            8: true,
            9: true,
            10: true,
            11: true,
            12: true,
          },
          totalAno: 120000,
          participacaoAcumulado: 25,
          variacaoYoY: null,
        },
        {
          ano: 2023,
          valoresPorMes: {
            1: 15000,
            2: 15000,
            3: 15000,
            4: 15000,
            5: 15000,
            6: 15000,
            7: 15000,
            8: 15000,
            9: 15000,
            10: 15000,
            11: 15000,
            12: 15000,
          },
          mesesComDados: {
            1: true,
            2: true,
            3: true,
            4: true,
            5: true,
            6: true,
            7: true,
            8: true,
            9: true,
            10: true,
            11: true,
            12: true,
          },
          totalAno: 180000,
          participacaoAcumulado: 37.5,
          variacaoYoY: 50,
        },
        {
          ano: 2024,
          valoresPorMes: {
            1: 18000,
            2: 18000,
            3: 18000,
            4: 18000,
            5: 18000,
            6: 18000,
            7: 18000,
            8: 18000,
            9: 18000,
            10: 18000,
            11: 18000,
            12: 18000,
          },
          mesesComDados: {
            1: true,
            2: true,
            3: true,
            4: true,
            5: true,
            6: true,
            7: true,
            8: true,
            9: true,
            10: true,
            11: true,
            12: true,
          },
          totalAno: 216000,
          participacaoAcumulado: 45,
          variacaoYoY: 20,
        },
      ]
      const diag = gerarDiagnosticoFaturamento(linhas, 516000)
      expect(diag.tipo).toBe('crescimento')
      expect(diag.titulo).toContain('Expansão')
    })
  })

  describe('calcularAnaliseFaturamento (Integração com DRE)', () => {
    const contasMock: ContaRecord[] = [
      {
        id: 'c-rec-vendas',
        collectionId: 'contas',
        collectionName: 'contas',
        user: 'u-1',
        nome: 'Receita Operacional de Vendas',
        tipo: 'Receita',
        classificacao_dre: 'Receita',
        created: '',
      },
      {
        id: 'c-rec-servicos',
        collectionId: 'contas',
        collectionName: 'contas',
        user: 'u-1',
        nome: 'Receita de Prestação de Serviços',
        tipo: 'Receita',
        classificacao_dre: 'Receita',
        created: '',
      },
      {
        id: 'c-despesa-fixa',
        collectionId: 'contas',
        collectionName: 'contas',
        user: 'u-1',
        nome: 'Aluguel do Galpão',
        tipo: 'Despesa',
        classificacao_dre: 'Despesa Fixa',
        created: '',
      },
      {
        id: 'c-oculta-dre',
        collectionId: 'contas',
        collectionName: 'contas',
        user: 'u-1',
        nome: 'Receita Extra Oculta DRE',
        tipo: 'Receita',
        classificacao_dre: 'Receita',
        nao_exibir_dre: true,
        created: '',
      },
      {
        id: 'c-oculta-nada',
        collectionId: 'contas',
        collectionName: 'contas',
        user: 'u-1',
        nome: 'Receita Oculta Em Tudo',
        tipo: 'Receita',
        classificacao_dre: 'Receita',
        nao_exibir_em_nada: true,
        created: '',
      },
    ]

    const planosMock: PlanoContaRecord[] = [
      {
        id: 'p-rec-1',
        collectionId: 'plano_contas',
        collectionName: 'plano_contas',
        user: 'u-1',
        conta: 'c-rec-vendas',
        centro: 'cc-1',
        created: '',
      },
      {
        id: 'p-rec-2',
        collectionId: 'plano_contas',
        collectionName: 'plano_contas',
        user: 'u-1',
        conta: 'c-rec-servicos',
        centro: 'cc-1',
        created: '',
      },
      {
        id: 'p-desp',
        collectionId: 'plano_contas',
        collectionName: 'plano_contas',
        user: 'u-1',
        conta: 'c-despesa-fixa',
        centro: 'cc-1',
        created: '',
      },
      {
        id: 'p-oculta-dre',
        collectionId: 'plano_contas',
        collectionName: 'plano_contas',
        user: 'u-1',
        conta: 'c-oculta-dre',
        centro: 'cc-1',
        created: '',
      },
      {
        id: 'p-oculta-nada',
        collectionId: 'plano_contas',
        collectionName: 'plano_contas',
        user: 'u-1',
        conta: 'c-oculta-nada',
        centro: 'cc-1',
        created: '',
      },
    ]

    it('varre todos os anos com lançamentos e calcula faturamento e percentuais', () => {
      const lancamentos: LancamentoRecord[] = [
        // 2023: Jan 100k, Mar 100k -> Total 200k
        {
          id: 'l-1',
          collectionId: 'lancamentos',
          collectionName: 'lancamentos',
          empresa: 'emp-1',
          plano_conta: 'p-rec-1',
          data: '2023-01-15',
          valor: 100000,
          user: 'u-1',
          created: '',
        },
        {
          id: 'l-2',
          collectionId: 'lancamentos',
          collectionName: 'lancamentos',
          empresa: 'emp-1',
          plano_conta: 'p-rec-2',
          data: '2023-03-20',
          valor: 100000,
          user: 'u-1',
          created: '',
        },
        // 2024: Jan 150k, Fev 150k -> Total 300k (+50% YoY vs 2023)
        {
          id: 'l-3',
          collectionId: 'lancamentos',
          collectionName: 'lancamentos',
          empresa: 'emp-1',
          plano_conta: 'p-rec-1',
          data: '2024-01-10',
          valor: 150000,
          user: 'u-1',
          created: '',
        },
        {
          id: 'l-4',
          collectionId: 'lancamentos',
          collectionName: 'lancamentos',
          empresa: 'emp-1',
          plano_conta: 'p-rec-2',
          data: '2024-02-15',
          valor: 150000,
          user: 'u-1',
          created: '',
        },
        // 2025: Jan 200k, Dez 300k -> Total 500k (+66.67% YoY vs 2024)
        {
          id: 'l-5',
          collectionId: 'lancamentos',
          collectionName: 'lancamentos',
          empresa: 'emp-1',
          plano_conta: 'p-rec-1',
          data: '2025-01-05',
          valor: 200000,
          user: 'u-1',
          created: '',
        },
        {
          id: 'l-6',
          collectionId: 'lancamentos',
          collectionName: 'lancamentos',
          empresa: 'emp-1',
          plano_conta: 'p-rec-2',
          data: '2025-12-20',
          valor: 300000,
          user: 'u-1',
          created: '',
        },
        // Lançamento estornado (deve ser ignorado)
        {
          id: 'l-estornado',
          collectionId: 'lancamentos',
          collectionName: 'lancamentos',
          empresa: 'emp-1',
          plano_conta: 'p-rec-1',
          data: '2024-05-10',
          valor: 999999,
          estornado: true,
          user: 'u-1',
          created: '',
        },
        // Lançamento de despesa (não deve inflar faturamento)
        {
          id: 'l-desp',
          collectionId: 'lancamentos',
          collectionName: 'lancamentos',
          empresa: 'emp-1',
          plano_conta: 'p-desp',
          data: '2024-06-10',
          valor: 50000,
          user: 'u-1',
          created: '',
        },
        // Lançamentos com flags de exclusão gerencial (não exibir dre / não exibir em nada)
        {
          id: 'l-oculto-dre',
          collectionId: 'lancamentos',
          collectionName: 'lancamentos',
          empresa: 'emp-1',
          plano_conta: 'p-oculta-dre',
          data: '2025-04-10',
          valor: 80000,
          user: 'u-1',
          created: '',
        },
        {
          id: 'l-oculto-nada',
          collectionId: 'lancamentos',
          collectionName: 'lancamentos',
          empresa: 'emp-1',
          plano_conta: 'p-oculta-nada',
          data: '2025-04-12',
          valor: 70000,
          user: 'u-1',
          created: '',
        },
      ]

      const resultado = calcularAnaliseFaturamento(lancamentos, contasMock, planosMock)

      expect(resultado.temDados).toBe(true)
      expect(resultado.anos).toEqual([2023, 2024, 2025])
      expect(resultado.linhasPorAno).toHaveLength(3)

      // Total acumulado: 200k + 300k + 500k = 1.000.000 (1M)
      expect(resultado.totalGeralTodosAnos).toBe(1000000)
      expect(resultado.mediaAnualFaturamento).toBeCloseTo(333333.33, 1)

      // 2023
      const l2023 = resultado.linhasPorAno.find((l) => l.ano === 2023)!
      expect(l2023.totalAno).toBe(200000)
      expect(l2023.valoresPorMes[1]).toBe(100000)
      expect(l2023.valoresPorMes[2]).toBe(0)
      expect(l2023.valoresPorMes[3]).toBe(100000)
      expect(l2023.participacaoAcumulado).toBe(20) // 200k / 1M = 20%
      expect(l2023.variacaoYoY).toBeNull() // Primeiro ano da série

      // 2024
      const l2024 = resultado.linhasPorAno.find((l) => l.ano === 2024)!
      expect(l2024.totalAno).toBe(300000)
      expect(l2024.valoresPorMes[1]).toBe(150000)
      expect(l2024.valoresPorMes[2]).toBe(150000)
      expect(l2024.participacaoAcumulado).toBe(30) // 300k / 1M = 30%
      expect(l2024.variacaoYoY).toBe(50) // (300k - 200k) / 200k = +50%

      // 2025
      const l2025 = resultado.linhasPorAno.find((l) => l.ano === 2025)!
      expect(l2025.totalAno).toBe(500000)
      expect(l2025.valoresPorMes[1]).toBe(200000)
      expect(l2025.valoresPorMes[12]).toBe(300000)
      expect(l2025.participacaoAcumulado).toBe(50) // 500k / 1M = 50%
      expect(l2025.variacaoYoY).toBeCloseTo(66.67, 1) // (500k - 300k) / 300k = +66.67%

      // Melhor e Pior ano
      expect(resultado.melhorAno?.ano).toBe(2025)
      expect(resultado.melhorAno?.valor).toBe(500000)
      expect(resultado.piorAno?.ano).toBe(2023)
      expect(resultado.piorAno?.valor).toBe(200000)

      // Totais gerais por mês somando todos os anos
      expect(resultado.totalGeralPorMes[1]).toBe(100000 + 150000 + 200000) // 450.000 em Janeiro
      expect(resultado.totalGeralPorMes[12]).toBe(300000) // 300.000 em Dezembro

      // Diagnóstico
      expect(resultado.diagnostico.tipo).toBe('crescimento')
    })

    it('retorna estado vazio gracioso quando não há lançamentos', () => {
      const resultado = calcularAnaliseFaturamento([], contasMock, planosMock)
      expect(resultado.temDados).toBe(false)
      expect(resultado.anos).toHaveLength(0)
      expect(resultado.linhasPorAno).toHaveLength(0)
      expect(resultado.totalGeralTodosAnos).toBe(0)
      expect(resultado.mediaAnualFaturamento).toBe(0)
      expect(resultado.melhorAno).toBeNull()
      expect(resultado.piorAno).toBeNull()
      expect(resultado.diagnostico.tipo).toBe('sem_dados')
    })
  })
})
