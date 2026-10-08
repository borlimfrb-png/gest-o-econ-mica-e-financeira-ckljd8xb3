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

  it('ordena contas combinadas de saídas operacionais por código hierárquico (1.2 antes de 1.10)', () => {
    const meses = gerarListaMeses(2025, 1, 1)

    const contasMock: ContaRecord[] = [
      {
        id: 'c-desp-10',
        collectionId: 'contas',
        collectionName: 'contas',
        user: 'u-1',
        codigo: '3.10',
        nome: 'Serviços Terceiros',
        tipo: 'Despesa',
        classificacao_dre: 'Despesa Fixa',
        created: '',
      },
      {
        id: 'c-desp-2',
        collectionId: 'contas',
        collectionName: 'contas',
        user: 'u-1',
        codigo: '3.2',
        nome: 'Comissão Especial',
        tipo: 'Despesa',
        classificacao_dre: 'Despesa Variável',
        created: '',
      },
      {
        id: 'c-desp-1',
        collectionId: 'contas',
        collectionName: 'contas',
        user: 'u-1',
        codigo: '3.1',
        nome: 'Aluguel Matriz',
        tipo: 'Despesa',
        classificacao_dre: 'Despesa Fixa',
        created: '',
      },
      {
        id: 'c-desp-sem-cod',
        collectionId: 'contas',
        collectionName: 'contas',
        user: 'u-1',
        codigo: '',
        nome: 'Despesa Diversa Sem Código',
        tipo: 'Despesa',
        classificacao_dre: 'Despesa Fixa',
        created: '',
      },
    ]

    const lancamentosMock: LancamentoRecord[] = [
      {
        id: 'l-10',
        collectionId: 'lancamentos',
        collectionName: 'lancamentos',
        empresa: 'e1',
        plano_conta: 'p10',
        data: '2025-01-10',
        valor: 100,
        user: 'u1',
        created: '',
        expand: {
          plano_conta: {
            id: 'p10',
            conta: 'c-desp-10',
            expand: { conta: contasMock[0] },
          } as any,
        },
      },
      {
        id: 'l-2',
        collectionId: 'lancamentos',
        collectionName: 'lancamentos',
        empresa: 'e1',
        plano_conta: 'p2',
        data: '2025-01-10',
        valor: 200,
        user: 'u1',
        created: '',
        expand: {
          plano_conta: {
            id: 'p2',
            conta: 'c-desp-2',
            expand: { conta: contasMock[1] },
          } as any,
        },
      },
      {
        id: 'l-1',
        collectionId: 'lancamentos',
        collectionName: 'lancamentos',
        empresa: 'e1',
        plano_conta: 'p1',
        data: '2025-01-10',
        valor: 300,
        user: 'u1',
        created: '',
        expand: {
          plano_conta: {
            id: 'p1',
            conta: 'c-desp-1',
            expand: { conta: contasMock[2] },
          } as any,
        },
      },
      {
        id: 'l-sem-cod',
        collectionId: 'lancamentos',
        collectionName: 'lancamentos',
        empresa: 'e1',
        plano_conta: 'p-sc',
        data: '2025-01-10',
        valor: 400,
        user: 'u1',
        created: '',
        expand: {
          plano_conta: {
            id: 'p-sc',
            conta: 'c-desp-sem-cod',
            expand: { conta: contasMock[3] },
          } as any,
        },
      },
    ]

    const fluxo = calcularFluxoCaixaDre(lancamentosMock, contasMock, meses)
    expect(fluxo.contasSaidasOperacionais.map((c) => c.codigo || 'S/C')).toEqual([
      '3.1',
      '3.2',
      '3.10',
      'S/C',
    ])
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

  it('ordena contas combinadas de saídas operacionais por 1º Centro -> 2º Tipo -> 3º Conta', () => {
    const meses = gerarListaMeses(2025, 1, 1)

    const contasMock: ContaRecord[] = [
      {
        id: 'c-1',
        collectionId: 'contas',
        collectionName: 'contas',
        user: 'u-1',
        codigo: '3.1',
        nome: 'Aluguel Matriz B',
        tipo: 'Despesa',
        classificacao_dre: 'Despesa Fixa',
        created: '',
      },
      {
        id: 'c-2',
        collectionId: 'contas',
        collectionName: 'contas',
        user: 'u-1',
        codigo: '3.10',
        nome: 'Serviços Centro A Tipo Adm 10',
        tipo: 'Despesa',
        classificacao_dre: 'Despesa Fixa',
        created: '',
      },
      {
        id: 'c-3',
        collectionId: 'contas',
        collectionName: 'contas',
        user: 'u-1',
        codigo: '3.2',
        nome: 'Serviços Centro A Tipo Adm 2',
        tipo: 'Despesa',
        classificacao_dre: 'Despesa Fixa',
        created: '',
      },
      {
        id: 'c-4',
        collectionId: 'contas',
        collectionName: 'contas',
        user: 'u-1',
        codigo: '3.5',
        nome: 'Comissão Centro A Tipo Vendas',
        tipo: 'Despesa',
        classificacao_dre: 'Despesa Variável',
        created: '',
      },
    ]

    const lancamentosMock: LancamentoRecord[] = [
      {
        id: 'l-1',
        collectionId: 'lancamentos',
        collectionName: 'lancamentos',
        empresa: 'e1',
        plano_conta: 'p1',
        data: '2025-01-10',
        valor: 100,
        user: 'u1',
        created: '',
        expand: {
          plano_conta: {
            id: 'p1',
            conta: 'c-1',
            expand: {
              conta: contasMock[0],
              centro: { id: 'cc-b', nome: 'Centro B', tipo: 'Despesa' } as any,
              tipo_despesa: { id: 'td-1', nome: 'Geral' } as any,
            },
          } as any,
        },
      },
      {
        id: 'l-2',
        collectionId: 'lancamentos',
        collectionName: 'lancamentos',
        empresa: 'e1',
        plano_conta: 'p2',
        data: '2025-01-10',
        valor: 200,
        user: 'u1',
        created: '',
        expand: {
          plano_conta: {
            id: 'p2',
            conta: 'c-2',
            expand: {
              conta: contasMock[1],
              centro: { id: 'cc-a', nome: 'Centro A', tipo: 'Despesa' } as any,
              tipo_despesa: { id: 'td-adm', nome: 'Administrativo' } as any,
            },
          } as any,
        },
      },
      {
        id: 'l-3',
        collectionId: 'lancamentos',
        collectionName: 'lancamentos',
        empresa: 'e1',
        plano_conta: 'p3',
        data: '2025-01-10',
        valor: 300,
        user: 'u1',
        created: '',
        expand: {
          plano_conta: {
            id: 'p3',
            conta: 'c-3',
            expand: {
              conta: contasMock[2],
              centro: { id: 'cc-a', nome: 'Centro A', tipo: 'Despesa' } as any,
              tipo_despesa: { id: 'td-adm', nome: 'Administrativo' } as any,
            },
          } as any,
        },
      },
      {
        id: 'l-4',
        collectionId: 'lancamentos',
        collectionName: 'lancamentos',
        empresa: 'e1',
        plano_conta: 'p4',
        data: '2025-01-10',
        valor: 400,
        user: 'u1',
        created: '',
        expand: {
          plano_conta: {
            id: 'p4',
            conta: 'c-4',
            expand: {
              conta: contasMock[3],
              centro: { id: 'cc-a', nome: 'Centro A', tipo: 'Despesa' } as any,
              tipo_despesa: { id: 'td-vendas', nome: 'Vendas' } as any,
            },
          } as any,
        },
      },
    ]

    const fluxo = calcularFluxoCaixaDre(lancamentosMock, contasMock, meses)
    expect(
      fluxo.contasSaidasOperacionais.map((c) => ({
        centro: c.centroNome,
        tipo: c.tipoDespesaNome,
        codigo: c.codigo,
      })),
    ).toEqual([
      { centro: 'Centro A', tipo: 'Administrativo', codigo: '3.2' },
      { centro: 'Centro A', tipo: 'Administrativo', codigo: '3.10' },
      { centro: 'Centro A', tipo: 'Vendas', codigo: '3.5' },
      { centro: 'Centro B', tipo: 'Geral', codigo: '3.1' },
    ])
  })

  it('ordena saídas financeiras por Centro de Custo -> Tipo de Despesa -> Código Hierárquico', () => {
    const contasFin: ContaRecord[] = [
      {
        id: 'c-fin-banc',
        collectionId: 'contas',
        collectionName: 'contas',
        user: 'u-1',
        codigo: '04.01.002',
        nome: 'Tarifas Bancárias',
        tipo: 'Despesa',
        classificacao_dre: 'Despesa Financeira',
        tipo_despesa: 'td-tarifas',
        tipo_despesa_nome: 'Tarifas',
        centro_custo: 'cc-adm',
        centro_custo_nome: 'Administrativo',
        created: '',
      },
      {
        id: 'c-fin-juros',
        collectionId: 'contas',
        collectionName: 'contas',
        user: 'u-1',
        codigo: '04.01.001',
        nome: 'Juros Passivos',
        tipo: 'Despesa',
        classificacao_dre: 'Despesa Financeira',
        tipo_despesa: 'td-juros',
        tipo_despesa_nome: 'Juros',
        centro_custo: 'cc-adm',
        centro_custo_nome: 'Administrativo',
        created: '',
      },
    ]

    const lancsFin: LancamentoRecord[] = [
      {
        id: 'l-fin-1',
        collectionId: 'lancamentos',
        collectionName: 'lancamentos',
        empresa: 'emp-1',
        conta: 'c-fin-banc',
        plano_conta: 'p-fin-1',
        data: '2025-01-10',
        valor: 100,
        user: 'u-1',
        created: '',
      },
      {
        id: 'l-fin-2',
        collectionId: 'lancamentos',
        collectionName: 'lancamentos',
        empresa: 'emp-1',
        conta: 'c-fin-juros',
        plano_conta: 'p-fin-2',
        data: '2025-01-10',
        valor: 200,
        user: 'u-1',
        created: '',
      },
    ]

    const meses = [
      {
        ano: 2025,
        mes: 1,
        chave: '2025-01',
        rotulo: 'Jan/2025',
        rotuloCurto: 'Jan/25',
        rotuloCompleto: 'Janeiro/2025',
      },
    ]
    const fluxo = calcularFluxoCaixaDre(lancsFin, contasFin, meses, [])
    expect(fluxo.contasSaidasFinanceiras).toHaveLength(2)
    // 'Juros' vem antes de 'Tarifas'
    expect(fluxo.contasSaidasFinanceiras[0].id).toBe('c-fin-juros')
    expect(fluxo.contasSaidasFinanceiras[0].tipoDespesaNome).toBe('Juros')
    expect(fluxo.contasSaidasFinanceiras[1].id).toBe('c-fin-banc')
    expect(fluxo.contasSaidasFinanceiras[1].tipoDespesaNome).toBe('Tarifas')
  })
})
