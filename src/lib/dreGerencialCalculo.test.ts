import { describe, it, expect } from 'vitest'
import { gerarListaMeses } from './dreGerencialTypes'
import { calcularDreGerencialMatriz } from './dreGerencialCalculo'
import type { ContaRecord, LancamentoRecord, PlanoContaRecord } from '@/types/finance'

describe('DRE Gerencial - Cálculos e Geração de Matriz', () => {
  it('gera exatamente 12 meses quando solicitado 12', () => {
    const meses = gerarListaMeses(2023, 1, 12)
    expect(meses).toHaveLength(12)
    expect(meses[0].chave).toBe('2023-01')
    expect(meses[0].rotuloCurto).toBe('Jan/23')
    expect(meses[11].chave).toBe('2023-12')
    expect(meses[11].rotuloCurto).toBe('Dez/23')
  })

  it('respeita o teto máximo de 12 meses mesmo se passar quantidade maior', () => {
    const meses = gerarListaMeses(2023, 6, 24)
    expect(meses).toHaveLength(12)
    expect(meses[0].chave).toBe('2023-06')
    expect(meses[11].chave).toBe('2024-05')
  })

  it('calcula matriz vinculando lançamentos via plano_conta expand e mapas', () => {
    const meses = gerarListaMeses(2023, 1, 12)

    const contasMock: ContaRecord[] = [
      {
        id: 'c-rec',
        collectionId: 'contas',
        collectionName: 'contas',
        user: 'u-1',
        nome: 'Receita de Vendas de Produtos',
        tipo: 'Receita',
        classificacao_dre: 'Receita',
        created: '',
      },
      {
        id: 'c-comissao',
        collectionId: 'contas',
        collectionName: 'contas',
        user: 'u-1',
        nome: 'Comissão sobre Vendas',
        tipo: 'Despesa',
        classificacao_dre: 'Despesa Variável',
        created: '',
      },
      {
        id: 'c-aluguel',
        collectionId: 'contas',
        collectionName: 'contas',
        user: 'u-1',
        nome: 'Aluguel do Galpão',
        tipo: 'Despesa',
        classificacao_dre: 'Despesa Fixa',
        created: '',
      },
      {
        id: 'c-juros',
        collectionId: 'contas',
        collectionName: 'contas',
        user: 'u-1',
        nome: 'Juros Bancários',
        tipo: 'Despesa',
        classificacao_dre: 'Despesa Financeira',
        created: '',
      },
      {
        id: 'c-rend',
        collectionId: 'contas',
        collectionName: 'contas',
        user: 'u-1',
        nome: 'Rendimento de Aplicação',
        tipo: 'Receita',
        classificacao_dre: 'Receita Financeira',
        created: '',
      },
    ]

    const planosMock: PlanoContaRecord[] = [
      {
        id: 'pc-1',
        collectionId: 'plano_contas',
        collectionName: 'plano_contas',
        user: 'u-1',
        codigo: 'PC-001',
        conta: 'c-rec',
        centro: 'cc-1',
        created: '',
      },
      {
        id: 'pc-2',
        collectionId: 'plano_contas',
        collectionName: 'plano_contas',
        user: 'u-1',
        codigo: 'PC-002',
        conta: 'c-comissao',
        centro: 'cc-1',
        created: '',
      },
      {
        id: 'pc-3',
        collectionId: 'plano_contas',
        collectionName: 'plano_contas',
        user: 'u-1',
        codigo: 'PC-003',
        conta: 'c-aluguel',
        centro: 'cc-1',
        created: '',
      },
      {
        id: 'pc-4',
        collectionId: 'plano_contas',
        collectionName: 'plano_contas',
        user: 'u-1',
        codigo: 'PC-004',
        conta: 'c-juros',
        centro: 'cc-1',
        created: '',
      },
      {
        id: 'pc-5',
        collectionId: 'plano_contas',
        collectionName: 'plano_contas',
        user: 'u-1',
        codigo: 'PC-005',
        conta: 'c-rend',
        centro: 'cc-1',
        created: '',
      },
    ]

    // Lançamentos com plano_conta e expand (como vem do PocketBase)
    const lancamentosMock: LancamentoRecord[] = [
      {
        id: 'l-1',
        collectionId: 'lancamentos',
        collectionName: 'lancamentos',
        empresa: 'emp-1',
        plano_conta: 'pc-1',
        data: '2023-01-15 12:00:00.000Z',
        valor: 100000,
        user: 'u-1',
        created: '',
        expand: {
          plano_conta: {
            id: 'pc-1',
            collectionId: 'plano_contas',
            collectionName: 'plano_contas',
            user: 'u-1',
            codigo: 'PC-001',
            conta: 'c-rec',
            centro: 'cc-1',
            created: '',
            expand: {
              conta: contasMock[0],
            },
          },
        },
      },
      {
        id: 'l-2',
        collectionId: 'lancamentos',
        collectionName: 'lancamentos',
        empresa: 'emp-1',
        plano_conta: 'pc-2',
        data: '2023-01-20 12:00:00.000Z',
        valor: 10000, // Despesa Variável
        user: 'u-1',
        created: '',
        expand: {
          plano_conta: {
            id: 'pc-2',
            collectionId: 'plano_contas',
            collectionName: 'plano_contas',
            user: 'u-1',
            codigo: 'PC-002',
            conta: 'c-comissao',
            centro: 'cc-1',
            created: '',
            expand: {
              conta: contasMock[1],
            },
          },
        },
      },
      {
        id: 'l-3',
        collectionId: 'lancamentos',
        collectionName: 'lancamentos',
        empresa: 'emp-1',
        plano_conta: 'pc-3',
        data: '2023-01-25 12:00:00.000Z',
        valor: 20000, // Despesa Fixa
        user: 'u-1',
        created: '',
        // Sem expand, deve buscar do fallback planoContas
      },
      {
        id: 'l-4',
        collectionId: 'lancamentos',
        collectionName: 'lancamentos',
        empresa: 'emp-1',
        plano_conta: 'pc-4',
        data: '2023-01-28 12:00:00.000Z',
        valor: 5000, // Despesa Financeira
        user: 'u-1',
        created: '',
      },
      {
        id: 'l-5',
        collectionId: 'lancamentos',
        collectionName: 'lancamentos',
        empresa: 'emp-1',
        plano_conta: 'pc-5',
        data: '2023-01-30 12:00:00.000Z',
        valor: 2000, // Receita Financeira
        user: 'u-1',
        created: '',
      },
    ]

    const matriz = calcularDreGerencialMatriz(lancamentosMock, contasMock, meses, planosMock)

    // Verifica que os 12 meses estão presentes na resposta
    expect(matriz.meses).toHaveLength(12)

    // Grupo Receitas: 100.000 em Jan/23
    const grupoReceitas = matriz.grupos.find((g) => g.classificacao === 'Receita')
    expect(grupoReceitas).toBeDefined()
    expect(grupoReceitas?.valoresPorMes['2023-01']).toBe(100000)
    expect(grupoReceitas?.totalPeriodo).toBe(100000)
    expect(grupoReceitas?.contas).toHaveLength(1)

    // Grupo Despesas Variáveis: 10.000 em Jan/23
    const grupoDespVar = matriz.grupos.find((g) => g.classificacao === 'Despesa Variável')
    expect(grupoDespVar?.valoresPorMes['2023-01']).toBe(100000 * 0.1)
    expect(grupoDespVar?.totalPeriodo).toBe(10000)

    // Grupo Despesas Fixas: 20.000 em Jan/23 (via fallback planoContas)
    const grupoDespFix = matriz.grupos.find((g) => g.classificacao === 'Despesa Fixa')
    expect(grupoDespFix?.valoresPorMes['2023-01']).toBe(20000)

    // Grupo Despesas Financeiras: 5.000
    const grupoDespFin = matriz.grupos.find((g) => g.classificacao === 'Despesa Financeira')
    expect(grupoDespFin?.valoresPorMes['2023-01']).toBe(5000)

    // Grupo Receitas Financeiras: 2.000
    const grupoRecFin = matriz.grupos.find((g) => g.classificacao === 'Receita Financeira')
    expect(grupoRecFin?.valoresPorMes['2023-01']).toBe(2000)

    // Fórmula Lucro: 100.000 - 10.000 - 20.000 - 5.000 + 2.000 = 67.000
    expect(matriz.lucroPrejuizo.valoresPorMes['2023-01']).toBe(67000)
    expect(matriz.lucroPrejuizo.totalPeriodo).toBe(67000)

    // Margem Líquida: 67.000 / 100.000 = 67.0%
    expect(matriz.margemLiquidaPorMes['2023-01']).toBeCloseTo(67.0, 1)
    expect(matriz.margemLiquidaTotal).toBeCloseTo(67.0, 1)
  })

  it('ignora lançamentos estornados para não distorcer a DRE', () => {
    const meses = gerarListaMeses(2023, 1, 1)
    const contasMock: ContaRecord[] = [
      {
        id: 'c-rec',
        collectionId: 'contas',
        collectionName: 'contas',
        user: 'u-1',
        nome: 'Receita',
        tipo: 'Receita',
        classificacao_dre: 'Receita',
        created: '',
      },
    ]
    const lancamentosMock: LancamentoRecord[] = [
      {
        id: 'l-estornado',
        collectionId: 'lancamentos',
        collectionName: 'lancamentos',
        empresa: 'emp-1',
        plano_conta: 'pc-1',
        data: '2023-01-10 12:00:00.000Z',
        valor: 50000,
        estornado: true,
        user: 'u-1',
        created: '',
        expand: {
          plano_conta: {
            id: 'pc-1',
            collectionId: 'plano_contas',
            collectionName: 'plano_contas',
            user: 'u-1',
            codigo: 'PC-1',
            conta: 'c-rec',
            centro: 'cc-1',
            created: '',
          },
        },
      },
    ]

    const matriz = calcularDreGerencialMatriz(lancamentosMock, contasMock, meses)
    const grupoReceitas = matriz.grupos.find((g) => g.classificacao === 'Receita')
    expect(grupoReceitas?.valoresPorMes['2023-01']).toBe(0)
    expect(grupoReceitas?.totalPeriodo).toBe(0)
  })

  it('classifica contas sem classificacao_dre explícita através de heurística', () => {
    const meses = gerarListaMeses(2023, 1, 1)
    const contasMock: ContaRecord[] = [
      {
        id: 'c-heuristica-luz',
        collectionId: 'contas',
        collectionName: 'contas',
        user: 'u-1',
        nome: 'Energia Elétrica Copel',
        tipo: 'Despesa',
        created: '',
        // Sem classificacao_dre preenchido
      },
    ]
    const lancamentosMock: LancamentoRecord[] = [
      {
        id: 'l-luz',
        collectionId: 'lancamentos',
        collectionName: 'lancamentos',
        empresa: 'emp-1',
        plano_conta: 'pc-luz',
        data: '2023-01-10 12:00:00.000Z',
        valor: 1500,
        user: 'u-1',
        created: '',
        expand: {
          plano_conta: {
            id: 'pc-luz',
            collectionId: 'plano_contas',
            collectionName: 'plano_contas',
            user: 'u-1',
            codigo: 'PC-LUZ',
            conta: 'c-heuristica-luz',
            centro: 'cc-1',
            created: '',
            expand: {
              conta: contasMock[0],
            },
          },
        },
      },
    ]

    const matriz = calcularDreGerencialMatriz(lancamentosMock, contasMock, meses)
    const despFixa = matriz.grupos.find((g) => g.classificacao === 'Despesa Fixa')
    expect(despFixa?.valoresPorMes['2023-01']).toBe(1500)
    expect(despFixa?.contas).toHaveLength(1)
    expect(matriz.naoClassificados.contas).toHaveLength(0)
  })
})
