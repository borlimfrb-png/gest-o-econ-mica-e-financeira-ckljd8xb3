import { describe, it, expect } from 'vitest'
import { gerarListaMeses } from './dreGerencialTypes'
import { calcularFluxoCaixaDre } from './fluxoCaixaDreCalculo'
import type { ContaRecord, LancamentoRecord, PlanoContaRecord } from '@/types/finance'

describe('Fluxo de Caixa por grupo DRE', () => {
  it('respeita o limite de meses e gera os grupos na ordem correta', () => {
    const meses = gerarListaMeses(2025, 1, 12)
    expect(meses).toHaveLength(12)

    const contasMock: ContaRecord[] = [
      {
        id: 'c-rec',
        collectionId: 'contas',
        collectionName: 'contas',
        user: 'u-1',
        nome: 'Receita Operacional Bruta',
        tipo: 'Receita',
        classificacao_dre: 'Receita',
        created: '',
      },
      {
        id: 'c-comissao',
        collectionId: 'contas',
        collectionName: 'contas',
        user: 'u-1',
        nome: 'Comissão de Vendedores',
        tipo: 'Despesa',
        classificacao_dre: 'Despesa Variável',
        created: '',
      },
      {
        id: 'c-aluguel',
        collectionId: 'contas',
        collectionName: 'contas',
        user: 'u-1',
        nome: 'Aluguel do Escritório',
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
        nome: 'Rendimentos Financeiros',
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
        codigo: '01',
        conta: 'c-rec',
        centro: 'cc-1',
        created: '',
      },
      {
        id: 'pc-2',
        collectionId: 'plano_contas',
        collectionName: 'plano_contas',
        user: 'u-1',
        codigo: '02',
        conta: 'c-comissao',
        centro: 'cc-1',
        created: '',
      },
      {
        id: 'pc-3',
        collectionId: 'plano_contas',
        collectionName: 'plano_contas',
        user: 'u-1',
        codigo: '03',
        conta: 'c-aluguel',
        centro: 'cc-1',
        created: '',
      },
      {
        id: 'pc-4',
        collectionId: 'plano_contas',
        collectionName: 'plano_contas',
        user: 'u-1',
        codigo: '04',
        conta: 'c-juros',
        centro: 'cc-1',
        created: '',
      },
      {
        id: 'pc-5',
        collectionId: 'plano_contas',
        collectionName: 'plano_contas',
        user: 'u-1',
        codigo: '05',
        conta: 'c-rend',
        centro: 'cc-1',
        created: '',
      },
    ]

    // Mês 1: Jan/2025
    // Receitas: 100.000
    // Desp. Variável: 15.000
    // Desp. Fixa: 25.000
    // -> Geração Operacional: 100.000 - 40.000 = 60.000
    // Rec. Financeira: 5.000
    // Desp. Financeira: 8.000
    // -> Geração Financeira: 5.000 - 8.000 = -3.000
    // -> Fluxo Total Mês 1 = 60.000 - 3.000 = 57.000
    // -> Acumulado Mês 1 = 57.000

    // Mês 2: Fev/2025
    // Receitas: 120.000
    // Desp. Variável: 20.000
    // Desp. Fixa: 25.000
    // -> Geração Operacional: 120.000 - 45.000 = 75.000
    // Rec. Financeira: 2.000
    // Desp. Financeira: 2.000
    // -> Geração Financeira: 0
    // -> Fluxo Total Mês 2 = 75.000
    // -> Acumulado Mês 2 = 57.000 + 75.000 = 132.000

    const lancamentosMock: LancamentoRecord[] = [
      // Jan/2025
      {
        id: 'l1',
        collectionId: 'lancamentos',
        collectionName: 'lancamentos',
        empresa: 'e1',
        plano_conta: 'pc-1',
        data: '2025-01-05',
        valor: 100000,
        user: 'u1',
        created: '',
        expand: {
          plano_conta: { id: 'pc-1', conta: 'c-rec', expand: { conta: contasMock[0] } } as any,
        },
      },
      {
        id: 'l2',
        collectionId: 'lancamentos',
        collectionName: 'lancamentos',
        empresa: 'e1',
        plano_conta: 'pc-2',
        data: '2025-01-10',
        valor: 15000,
        user: 'u1',
        created: '',
        expand: {
          plano_conta: { id: 'pc-2', conta: 'c-comissao', expand: { conta: contasMock[1] } } as any,
        },
      },
      {
        id: 'l3',
        collectionId: 'lancamentos',
        collectionName: 'lancamentos',
        empresa: 'e1',
        plano_conta: 'pc-3',
        data: '2025-01-15',
        valor: 25000,
        user: 'u1',
        created: '',
        expand: {
          plano_conta: { id: 'pc-3', conta: 'c-aluguel', expand: { conta: contasMock[2] } } as any,
        },
      },
      {
        id: 'l4',
        collectionId: 'lancamentos',
        collectionName: 'lancamentos',
        empresa: 'e1',
        plano_conta: 'pc-4',
        data: '2025-01-20',
        valor: 8000,
        user: 'u1',
        created: '',
        expand: {
          plano_conta: { id: 'pc-4', conta: 'c-juros', expand: { conta: contasMock[3] } } as any,
        },
      },
      {
        id: 'l5',
        collectionId: 'lancamentos',
        collectionName: 'lancamentos',
        empresa: 'e1',
        plano_conta: 'pc-5',
        data: '2025-01-25',
        valor: 5000,
        user: 'u1',
        created: '',
        expand: {
          plano_conta: { id: 'pc-5', conta: 'c-rend', expand: { conta: contasMock[4] } } as any,
        },
      },

      // Fev/2025
      {
        id: 'l6',
        collectionId: 'lancamentos',
        collectionName: 'lancamentos',
        empresa: 'e1',
        plano_conta: 'pc-1',
        data: '2025-02-05',
        valor: 120000,
        user: 'u1',
        created: '',
        expand: {
          plano_conta: { id: 'pc-1', conta: 'c-rec', expand: { conta: contasMock[0] } } as any,
        },
      },
      {
        id: 'l7',
        collectionId: 'lancamentos',
        collectionName: 'lancamentos',
        empresa: 'e1',
        plano_conta: 'pc-2',
        data: '2025-02-10',
        valor: 20000,
        user: 'u1',
        created: '',
        expand: {
          plano_conta: { id: 'pc-2', conta: 'c-comissao', expand: { conta: contasMock[1] } } as any,
        },
      },
      {
        id: 'l8',
        collectionId: 'lancamentos',
        collectionName: 'lancamentos',
        empresa: 'e1',
        plano_conta: 'pc-3',
        data: '2025-02-15',
        valor: 25000,
        user: 'u1',
        created: '',
        expand: {
          plano_conta: { id: 'pc-3', conta: 'c-aluguel', expand: { conta: contasMock[2] } } as any,
        },
      },
      {
        id: 'l9',
        collectionId: 'lancamentos',
        collectionName: 'lancamentos',
        empresa: 'e1',
        plano_conta: 'pc-4',
        data: '2025-02-20',
        valor: 2000,
        user: 'u1',
        created: '',
        expand: {
          plano_conta: { id: 'pc-4', conta: 'c-juros', expand: { conta: contasMock[3] } } as any,
        },
      },
      {
        id: 'l10',
        collectionId: 'lancamentos',
        collectionName: 'lancamentos',
        empresa: 'e1',
        plano_conta: 'pc-5',
        data: '2025-02-25',
        valor: 2000,
        user: 'u1',
        created: '',
        expand: {
          plano_conta: { id: 'pc-5', conta: 'c-rend', expand: { conta: contasMock[4] } } as any,
        },
      },
    ]

    const fluxo = calcularFluxoCaixaDre(lancamentosMock, contasMock, meses, planosMock)

    // Estrutura das chaves na ordem solicitada
    expect(fluxo.entradasOperacionais.titulo).toContain('Entradas Operacionais')
    expect(fluxo.saidasOperacionais.titulo).toContain('Saídas Operacionais')
    expect(fluxo.geracaoOperacional.titulo).toContain('Geração Operacional de Caixa')
    expect(fluxo.entradasFinanceiras.titulo).toContain('Entradas Financeiras')
    expect(fluxo.saidasFinanceiras.titulo).toContain('Saídas Financeiras')
    expect(fluxo.geracaoFinanceira.titulo).toContain('Geração Financeira de Caixa')
    expect(fluxo.fluxoCaixaTotal.titulo).toContain('Fluxo de Caixa Total')

    // Valores do mês 1 (2025-01)
    expect(fluxo.entradasOperacionais.valoresPorMes['2025-01']).toBe(100000)
    expect(fluxo.saidasOperacionais.valoresPorMes['2025-01']).toBe(40000)
    expect(fluxo.geracaoOperacional.valoresPorMes['2025-01']).toBe(60000)
    expect(fluxo.entradasFinanceiras.valoresPorMes['2025-01']).toBe(5000)
    expect(fluxo.saidasFinanceiras.valoresPorMes['2025-01']).toBe(8000)
    expect(fluxo.geracaoFinanceira.valoresPorMes['2025-01']).toBe(-3000)
    expect(fluxo.fluxoCaixaTotal.valoresPorMes['2025-01']).toBe(57000)
    expect(fluxo.saldoAcumulado.valoresPorMes['2025-01']).toBe(57000)

    // Valores do mês 2 (2025-02)
    expect(fluxo.entradasOperacionais.valoresPorMes['2025-02']).toBe(120000)
    expect(fluxo.saidasOperacionais.valoresPorMes['2025-02']).toBe(45000)
    expect(fluxo.geracaoOperacional.valoresPorMes['2025-02']).toBe(75000)
    expect(fluxo.entradasFinanceiras.valoresPorMes['2025-02']).toBe(2000)
    expect(fluxo.saidasFinanceiras.valoresPorMes['2025-02']).toBe(2000)
    expect(fluxo.geracaoFinanceira.valoresPorMes['2025-02']).toBe(0)
    expect(fluxo.fluxoCaixaTotal.valoresPorMes['2025-02']).toBe(75000)

    // Saldo acumulado mês 2
    expect(fluxo.saldoAcumulado.valoresPorMes['2025-02']).toBe(132000)
    expect(fluxo.saldoAcumulado.saldoFinal).toBe(132000)

    // Totais do período
    expect(fluxo.entradasOperacionais.totalPeriodo).toBe(220000)
    expect(fluxo.saidasOperacionais.totalPeriodo).toBe(85000)
    expect(fluxo.geracaoOperacional.totalPeriodo).toBe(135000)
    expect(fluxo.geracaoFinanceira.totalPeriodo).toBe(-3000)
    expect(fluxo.fluxoCaixaTotal.totalPeriodo).toBe(132000)

    // Reuso de contas: contas operacionais contém as contas de comissão e aluguel combinadas
    expect(fluxo.contasSaidasOperacionais).toHaveLength(2)
    expect(fluxo.contasEntradasOperacionais).toHaveLength(1)
  })

  it('ignora lançamentos estornados no fluxo de caixa', () => {
    const meses = gerarListaMeses(2025, 1, 1)
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
        empresa: 'e1',
        plano_conta: 'pc-1',
        data: '2025-01-10',
        valor: 50000,
        estornado: true,
        user: 'u1',
        created: '',
      },
    ]

    const fluxo = calcularFluxoCaixaDre(lancamentosMock, contasMock, meses)
    expect(fluxo.entradasOperacionais.totalPeriodo).toBe(0)
    expect(fluxo.fluxoCaixaTotal.totalPeriodo).toBe(0)
    expect(fluxo.saldoAcumulado.saldoFinal).toBe(0)
  })
})
