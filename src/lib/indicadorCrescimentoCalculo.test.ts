import { describe, it, expect } from 'vitest'
import {
  calcularSimuladorCrescimento,
  calcularPontoEquilibrioSimulado,
  extrairCenarioBaseDre,
  gerarResumoExecutivoCrescimento,
  type CenarioBaseDre,
  type ParametrosSimulacaoCrescimento,
} from './indicadorCrescimentoCalculo'
import type { ContaRecord, LancamentoRecord } from '@/types/finance'
import type { MesItem } from './dreGerencialTypes'

describe('Indicador de Crescimento - Motor de Simulação', () => {
  const cenarioBasePadrao: CenarioBaseDre = {
    faturamento: 100000,
    despesasVariaveis: 40000, // 40%
    despesasFixas: 30000, // 30%
    despesasFinanceiras: 5000,
    receitasFinanceiras: 1000,
    resultadoFinanceiroLiquido: -4000,
    totalDespesas: 75000,
    lucroPrejuizo: 26000, // 100k - 40k - 30k - 5k + 1k = 26k (26% margem líquida)
    margemContribuicaoReais: 60000, // 60%
    margemContribuicaoPct: 60,
    margemLiquidaPct: 26,
    percentualVariaveisSobreFat: 40,
    percentualFixasSobreFat: 30,
    temDados: true,
  }

  describe('Cálculo com Despesas Fixas Mantidas e Variáveis Proporcionais', () => {
    it('deve simular crescimento de +10% no faturamento mantendo fixas', () => {
      const params: ParametrosSimulacaoCrescimento = {
        percentualCrescimentoFaturamento: 10,
        modoDespesasVariaveis: 'proporcional',
        modoDespesasFixas: 'manter',
      }

      const res = calcularSimuladorCrescimento(cenarioBasePadrao, params)

      // Faturamento: 100k + 10% = 110k
      expect(res.cenarioSimulado.faturamento).toBe(110000)
      // Variáveis: 40% de 110k = 44k (+10%)
      expect(res.cenarioSimulado.despesasVariaveis).toBe(44000)
      // Fixas: mantidas em 30k
      expect(res.cenarioSimulado.despesasFixas).toBe(30000)
      // Financeiras: mantidas em 5k e recFin em 1k
      expect(res.cenarioSimulado.despesasFinanceiras).toBe(5000)
      expect(res.cenarioSimulado.receitasFinanceiras).toBe(1000)
      // Lucro: 110k - 44k - 30k - 5k + 1k = 32.000
      expect(res.cenarioSimulado.lucroPrejuizo).toBe(32000)

      // Margem líquida: 32.000 / 110.000 = 29.0909%
      expect(res.cenarioSimulado.margemLiquidaPct).toBeCloseTo(29.0909, 2)

      // Delta de lucro: 32k - 26k = +6.000
      expect(res.comparativo.lucroPrejuizo.deltaAbsoluto).toBe(6000)
      // Variação percentual do lucro: (6k / 26k) * 100 = ~23.0769%
      expect(res.comparativo.lucroPrejuizo.deltaPercentual).toBeCloseTo(23.0769, 2)
      expect(res.comparativo.lucroPrejuizo.favoravel).toBe(true)

      // Delta pontos percentuais da margem: 29.09% - 26% = +3.09 p.p.
      expect(res.comparativo.margemLiquidaPct.deltaPontosPercentuais).toBeCloseTo(3.0909, 2)

      // Resumo executivo deve conter menção aos valores
      expect(res.resumoExecutivo).toContain('+10.0%')
      expect(res.resumoExecutivo).toContain('sobe')
      expect(res.resumoExecutivo).toContain('mantendo as despesas fixas estáveis')
    })
  })

  describe('Cálculo com Despesas Fixas Crescidas e Variáveis com % Personalizado', () => {
    it('deve simular faturamento +20%, variáveis +15% e fixas +5%', () => {
      const params: ParametrosSimulacaoCrescimento = {
        percentualCrescimentoFaturamento: 20,
        modoDespesasVariaveis: 'personalizado',
        percentualCrescimentoVariaveis: 15,
        modoDespesasFixas: 'personalizado',
        percentualCrescimentoFixas: 5,
        percentualCrescimentoFinanceiras: 0,
      }

      const res = calcularSimuladorCrescimento(cenarioBasePadrao, params)

      // Faturamento: 120.000
      expect(res.cenarioSimulado.faturamento).toBe(120000)
      // Variáveis: 40.000 * 1.15 = 46.000
      expect(res.cenarioSimulado.despesasVariaveis).toBe(46000)
      // Fixas: 30.000 * 1.05 = 31.500
      expect(res.cenarioSimulado.despesasFixas).toBe(31500)
      // Lucro: 120k - 46k - 31.5k - 5k + 1k = 38.500
      expect(res.cenarioSimulado.lucroPrejuizo).toBe(38500)

      expect(res.comparativo.lucroPrejuizo.deltaAbsoluto).toBe(12500)
      expect(res.comparativo.faturamento.favoravel).toBe(true)
      expect(res.comparativo.despesasFixas.favoravel).toBe(false) // despesa cresceu
    })
  })

  describe('Cenário com Queda de Faturamento (-30%) e Análise de Prejuízo', () => {
    it('deve calcular corretamente retração de faturamento e possível prejuízo', () => {
      const params: ParametrosSimulacaoCrescimento = {
        percentualCrescimentoFaturamento: -60, // -60%
        modoDespesasVariaveis: 'proporcional',
        modoDespesasFixas: 'manter',
      }

      const res = calcularSimuladorCrescimento(cenarioBasePadrao, params)

      // Faturamento: 40.000
      expect(res.cenarioSimulado.faturamento).toBe(40000)
      // Variáveis: 40% de 40.000 = 16.000
      expect(res.cenarioSimulado.despesasVariaveis).toBe(16000)
      // Fixas: 30.000
      expect(res.cenarioSimulado.despesasFixas).toBe(30000)
      // Lucro: 40k - 16k - 30k - 5k + 1k = -10.000 (Prejuízo)
      expect(res.cenarioSimulado.lucroPrejuizo).toBe(-10000)
      expect(res.comparativo.lucroPrejuizo.favoravel).toBe(false)
      expect(res.cenarioSimulado.margemLiquidaPct).toBe(-25)

      // Opera abaixo do ponto de equilíbrio (margem de segurança negativa)
      expect(res.cenarioSimulado.margemSegurancaPct).toBeLessThan(0)
      expect(res.resumoExecutivo).toContain('prejuízo operacional')
    })
  })

  describe('Cálculo do Ponto de Equilíbrio e Margem de Segurança', () => {
    it('deve calcular PE e Margem de Segurança em R$ e % com precisão', () => {
      // Faturamento 100k, fixas 30k, finLiquidas 4k, MC = 60%
      // Custos estruturais = 34k
      // PE = 34.000 / 0.60 = 56.666,67
      // Margem de segurança = 100k - 56.666,67 = 43.333,33 (43.33%)
      const pe = calcularPontoEquilibrioSimulado(100000, 30000, 4000, 60)
      expect(pe.pontoEquilibrioReais).toBeCloseTo(56666.67, 1)
      expect(pe.margemSegurancaReais).toBeCloseTo(43333.33, 1)
      expect(pe.margemSegurancaPct).toBeCloseTo(43.3333, 2)
    })

    it('deve retornar null para ponto de equilíbrio quando a margem de contribuição for <= 0', () => {
      const pe = calcularPontoEquilibrioSimulado(100000, 30000, 4000, 0)
      expect(pe.pontoEquilibrioReais).toBeNull()
      expect(pe.margemSegurancaPct).toBeNull()
    })

    it('deve retornar null quando o faturamento simulado for 0', () => {
      const pe = calcularPontoEquilibrioSimulado(0, 30000, 0, 50)
      expect(pe.pontoEquilibrioReais).toBeNull()
      expect(pe.margemSegurancaPct).toBeNull()
    })
  })

  describe('Cenário Base com Base Vazia ou Zerada', () => {
    it('deve lidar graciosamente com base zerada (faturamento = 0)', () => {
      const baseZerada: CenarioBaseDre = {
        faturamento: 0,
        despesasVariaveis: 0,
        despesasFixas: 0,
        despesasFinanceiras: 0,
        receitasFinanceiras: 0,
        resultadoFinanceiroLiquido: 0,
        totalDespesas: 0,
        lucroPrejuizo: 0,
        margemContribuicaoReais: 0,
        margemContribuicaoPct: null,
        margemLiquidaPct: null,
        percentualVariaveisSobreFat: null,
        percentualFixasSobreFat: null,
        temDados: false,
      }

      const params: ParametrosSimulacaoCrescimento = {
        percentualCrescimentoFaturamento: 10,
        modoDespesasVariaveis: 'proporcional',
        modoDespesasFixas: 'manter',
      }

      const res = calcularSimuladorCrescimento(baseZerada, params)
      expect(res.cenarioSimulado.faturamento).toBe(0)
      expect(res.cenarioSimulado.lucroPrejuizo).toBe(0)
      expect(res.comparativo.lucroPrejuizo.deltaPercentual).toBe(0)
      expect(res.resumoExecutivo).toContain('Não há base de dados')
    })
  })

  describe('Integração com extrairCenarioBaseDre e Lançamentos Reais DRE', () => {
    const meses: MesItem[] = [
      {
        ano: 2025,
        mes: 1,
        chave: '2025-01',
        rotuloCurto: 'Jan/25',
        rotuloCompleto: 'Janeiro/2025',
      },
      {
        ano: 2025,
        mes: 2,
        chave: '2025-02',
        rotuloCurto: 'Fev/25',
        rotuloCompleto: 'Fevereiro/2025',
      },
    ]

    const contas: ContaRecord[] = [
      {
        id: 'c-rec',
        collectionId: 'contas',
        collectionName: 'contas',
        user: 'u-1',
        nome: 'Venda de Mercadorias',
        codigo: '3.1.01',
        tipo: 'Receita',
        classificacao_dre: 'Receita',
        created: '2025-01-01',
        updated: '2025-01-01',
      },
      {
        id: 'c-var',
        collectionId: 'contas',
        collectionName: 'contas',
        user: 'u-1',
        nome: 'Comissões de Vendas',
        codigo: '4.1.01',
        tipo: 'Despesa',
        classificacao_dre: 'Despesa Variável',
        created: '2025-01-01',
        updated: '2025-01-01',
      },
      {
        id: 'c-fix',
        collectionId: 'contas',
        collectionName: 'contas',
        user: 'u-1',
        nome: 'Aluguel do Galpão',
        codigo: '4.2.01',
        tipo: 'Despesa',
        classificacao_dre: 'Despesa Fixa',
        created: '2025-01-01',
        updated: '2025-01-01',
      },
      {
        id: 'c-estorno',
        collectionId: 'contas',
        collectionName: 'contas',
        user: 'u-1',
        nome: 'Conta com Estorno',
        codigo: '4.2.02',
        tipo: 'Despesa',
        classificacao_dre: 'Despesa Fixa',
        created: '2025-01-01',
        updated: '2025-01-01',
      },
      {
        id: 'c-nao-dre',
        collectionId: 'contas',
        collectionName: 'contas',
        user: 'u-1',
        nome: 'Conta Não DRE',
        codigo: '4.2.99',
        tipo: 'Despesa',
        nao_exibir_dre: true,
        classificacao_dre: 'Despesa Fixa',
        created: '2025-01-01',
        updated: '2025-01-01',
      },
    ]

    const lancamentos: LancamentoRecord[] = [
      {
        id: 'l1',
        collectionId: 'lancamentos',
        collectionName: 'lancamentos',
        user: 'u-1',
        empresa: 'emp-1',
        data: '2025-01-15 12:00:00.000Z',
        descricao: 'Vendas Jan',
        tipo: 'receita',
        valor: 50000,
        plano_conta: 'p-rec',
        created: '2025-01-15',
        updated: '2025-01-15',
        expand: {
          plano_conta: {
            id: 'p-rec',
            collectionId: 'plano_contas',
            collectionName: 'plano_contas',
            user: 'u-1',
            centro: 'cc-1',
            conta: 'c-rec',
            created: '2025-01-01',
            updated: '2025-01-01',
            expand: {
              conta: contas[0],
            },
          },
        },
      },
      {
        id: 'l2',
        collectionId: 'lancamentos',
        collectionName: 'lancamentos',
        user: 'u-1',
        empresa: 'emp-1',
        data: '2025-02-15 12:00:00.000Z',
        descricao: 'Vendas Fev',
        tipo: 'receita',
        valor: 50000,
        plano_conta: 'p-rec',
        created: '2025-02-15',
        updated: '2025-02-15',
        expand: {
          plano_conta: {
            id: 'p-rec',
            collectionId: 'plano_contas',
            collectionName: 'plano_contas',
            user: 'u-1',
            centro: 'cc-1',
            conta: 'c-rec',
            created: '2025-01-01',
            updated: '2025-01-01',
            expand: {
              conta: contas[0],
            },
          },
        },
      },
      {
        id: 'l3',
        collectionId: 'lancamentos',
        collectionName: 'lancamentos',
        user: 'u-1',
        empresa: 'emp-1',
        data: '2025-01-20 12:00:00.000Z',
        descricao: 'Comissão Jan',
        tipo: 'despesa',
        valor: 15000,
        plano_conta: 'p-var',
        created: '2025-01-20',
        updated: '2025-01-20',
        expand: {
          plano_conta: {
            id: 'p-var',
            collectionId: 'plano_contas',
            collectionName: 'plano_contas',
            user: 'u-1',
            centro: 'cc-1',
            conta: 'c-var',
            created: '2025-01-01',
            updated: '2025-01-01',
            expand: {
              conta: contas[1],
            },
          },
        },
      },
      {
        id: 'l4',
        collectionId: 'lancamentos',
        collectionName: 'lancamentos',
        user: 'u-1',
        empresa: 'emp-1',
        data: '2025-01-10 12:00:00.000Z',
        descricao: 'Aluguel Jan',
        tipo: 'despesa',
        valor: 10000,
        plano_conta: 'p-fix',
        created: '2025-01-10',
        updated: '2025-01-10',
        expand: {
          plano_conta: {
            id: 'p-fix',
            collectionId: 'plano_contas',
            collectionName: 'plano_contas',
            user: 'u-1',
            centro: 'cc-1',
            conta: 'c-fix',
            created: '2025-01-01',
            updated: '2025-01-01',
            expand: {
              conta: contas[2],
            },
          },
        },
      },
      // Lançamento com flag de estorno -> deve ser IGNORADO
      {
        id: 'l5-estorno',
        collectionId: 'lancamentos',
        collectionName: 'lancamentos',
        user: 'u-1',
        empresa: 'emp-1',
        data: '2025-01-22 12:00:00.000Z',
        descricao: 'Despesa Estornada',
        tipo: 'despesa',
        valor: 99999,
        estornado: true,
        plano_conta: 'p-est',
        created: '2025-01-22',
        updated: '2025-01-22',
        expand: {
          plano_conta: {
            id: 'p-est',
            collectionId: 'plano_contas',
            collectionName: 'plano_contas',
            user: 'u-1',
            centro: 'cc-1',
            conta: 'c-estorno',
            created: '2025-01-01',
            updated: '2025-01-01',
            expand: {
              conta: contas[3],
            },
          },
        },
      },
      // Lançamento em conta nao_exibir_dre -> deve ser IGNORADO
      {
        id: 'l6-nao-dre',
        collectionId: 'lancamentos',
        collectionName: 'lancamentos',
        user: 'u-1',
        empresa: 'emp-1',
        data: '2025-01-25 12:00:00.000Z',
        descricao: 'Distribuição Não DRE',
        tipo: 'despesa',
        valor: 50000,
        plano_conta: 'p-nao-dre',
        created: '2025-01-25',
        updated: '2025-01-25',
        expand: {
          plano_conta: {
            id: 'p-nao-dre',
            collectionId: 'plano_contas',
            collectionName: 'plano_contas',
            user: 'u-1',
            centro: 'cc-1',
            conta: 'c-nao-dre',
            created: '2025-01-01',
            updated: '2025-01-01',
            expand: {
              conta: contas[4],
            },
          },
        },
      },
    ]

    it('deve extrair faturamento, variáveis e fixas respeitando estornos e exclusões DRE', () => {
      const baseReal = extrairCenarioBaseDre(lancamentos, contas, meses)

      expect(baseReal.temDados).toBe(true)
      expect(baseReal.faturamento).toBe(100000) // l1 + l2
      expect(baseReal.despesasVariaveis).toBe(15000) // l3
      expect(baseReal.despesasFixas).toBe(10000) // l4
      // l5 (estornado) e l6 (nao_exibir_dre) não devem ter entrado
      expect(baseReal.totalDespesas).toBe(25000)
      expect(baseReal.lucroPrejuizo).toBe(75000)
    })
  })
})
