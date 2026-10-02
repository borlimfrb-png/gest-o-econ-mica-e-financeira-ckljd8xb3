import { describe, it, expect } from 'vitest'
import {
  gerarListaMeses,
  compararCodigosHierarquicos,
  compararContasDre,
  compararCentroTipoConta,
} from './dreGerencialTypes'
import {
  calcularDreGerencialMatriz,
  calcularComparativoDre,
  isVariacaoFavoravel,
  calcularVariacaoPercentual,
} from './dreGerencialCalculo'
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

  it('calcula comparativo entre dois períodos identificando variações e favorabilidade', () => {
    const mesesP1 = gerarListaMeses(2023, 1, 12)
    const mesesP2 = gerarListaMeses(2024, 1, 12)

    const contasMock: ContaRecord[] = [
      {
        id: 'c-rec',
        collectionId: 'contas',
        collectionName: 'contas',
        user: 'u-1',
        nome: 'Receita Vendas',
        tipo: 'Receita',
        classificacao_dre: 'Receita',
        created: '',
      },
      {
        id: 'c-desp',
        collectionId: 'contas',
        collectionName: 'contas',
        user: 'u-1',
        nome: 'Despesa Administrativa',
        tipo: 'Despesa',
        classificacao_dre: 'Despesa Fixa',
        created: '',
      },
    ]

    const lancamentosP1: LancamentoRecord[] = [
      {
        id: 'l-p1-rec',
        collectionId: 'lancamentos',
        collectionName: 'lancamentos',
        empresa: 'emp-1',
        plano_conta: 'pc-rec',
        data: '2023-01-10 12:00:00.000Z',
        valor: 100000,
        user: 'u-1',
        created: '',
        expand: {
          plano_conta: {
            id: 'pc-rec',
            collectionId: 'plano_contas',
            collectionName: 'plano_contas',
            user: 'u-1',
            codigo: 'PC-1',
            conta: 'c-rec',
            centro: 'cc-1',
            created: '',
            expand: { conta: contasMock[0] },
          },
        },
      },
      {
        id: 'l-p1-desp',
        collectionId: 'lancamentos',
        collectionName: 'lancamentos',
        empresa: 'emp-1',
        plano_conta: 'pc-desp',
        data: '2023-01-15 12:00:00.000Z',
        valor: 30000,
        user: 'u-1',
        created: '',
        expand: {
          plano_conta: {
            id: 'pc-desp',
            collectionId: 'plano_contas',
            collectionName: 'plano_contas',
            user: 'u-1',
            codigo: 'PC-2',
            conta: 'c-desp',
            centro: 'cc-1',
            created: '',
            expand: { conta: contasMock[1] },
          },
        },
      },
    ]

    const lancamentosP2: LancamentoRecord[] = [
      {
        id: 'l-p2-rec',
        collectionId: 'lancamentos',
        collectionName: 'lancamentos',
        empresa: 'emp-1',
        plano_conta: 'pc-rec',
        data: '2024-01-10 12:00:00.000Z',
        valor: 150000, // aumento de 50% em receita (favorável)
        user: 'u-1',
        created: '',
        expand: {
          plano_conta: {
            id: 'pc-rec',
            collectionId: 'plano_contas',
            collectionName: 'plano_contas',
            user: 'u-1',
            codigo: 'PC-1',
            conta: 'c-rec',
            centro: 'cc-1',
            created: '',
            expand: { conta: contasMock[0] },
          },
        },
      },
      {
        id: 'l-p2-desp',
        collectionId: 'lancamentos',
        collectionName: 'lancamentos',
        empresa: 'emp-1',
        plano_conta: 'pc-desp',
        data: '2024-01-15 12:00:00.000Z',
        valor: 45000, // aumento de despesa (desfavorável)
        user: 'u-1',
        created: '',
        expand: {
          plano_conta: {
            id: 'pc-desp',
            collectionId: 'plano_contas',
            collectionName: 'plano_contas',
            user: 'u-1',
            codigo: 'PC-2',
            conta: 'c-desp',
            centro: 'cc-1',
            created: '',
            expand: { conta: contasMock[1] },
          },
        },
      },
    ]

    const m1 = calcularDreGerencialMatriz(lancamentosP1, contasMock, mesesP1)
    const m2 = calcularDreGerencialMatriz(lancamentosP2, contasMock, mesesP2)

    const comparativo = calcularComparativoDre(m1, m2, '2023 (P1)', '2024 (P2)')

    // Grupo Receita
    const gReceita = comparativo.grupos.find((g) => g.classificacao === 'Receita')!
    expect(gReceita.valorPeriodo1).toBe(100000)
    expect(gReceita.valorPeriodo2).toBe(150000)
    expect(gReceita.diferenca).toBe(50000)
    expect(gReceita.percentual).toBe(50)
    expect(gReceita.favoravel).toBe(true) // aumento de receita é favorável

    // Grupo Despesa Fixa
    const gDespFix = comparativo.grupos.find((g) => g.classificacao === 'Despesa Fixa')!
    expect(gDespFix.valorPeriodo1).toBe(30000)
    expect(gDespFix.valorPeriodo2).toBe(45000)
    expect(gDespFix.diferenca).toBe(15000)
    expect(gDespFix.percentual).toBe(50)
    expect(gDespFix.favoravel).toBe(false) // aumento de despesa é desfavorável

    // Lucro: P1 = 70.000, P2 = 105.000
    expect(comparativo.lucroPrejuizo.valorPeriodo1).toBe(70000)
    expect(comparativo.lucroPrejuizo.valorPeriodo2).toBe(105000)
    expect(comparativo.lucroPrejuizo.diferenca).toBe(35000)
    expect(comparativo.lucroPrejuizo.percentual).toBe(50)
    expect(comparativo.lucroPrejuizo.favoravel).toBe(true) // aumento de lucro é favorável

    // Margem líquida constante em 70% (70k/100k e 105k/150k)
    expect(comparativo.margemLiquida.margemPeriodo1).toBeCloseTo(70, 1)
    expect(comparativo.margemLiquida.margemPeriodo2).toBeCloseTo(70, 1)
    expect(comparativo.margemLiquida.diferencaPontos).toBeCloseTo(0, 1)
  })

  it('lida com base zero na variação percentual', () => {
    expect(calcularVariacaoPercentual(0, 100)).toBeNull()
    expect(calcularVariacaoPercentual(0, 0)).toBe(0)
    expect(calcularVariacaoPercentual(100, 200)).toBe(100)
    expect(calcularVariacaoPercentual(200, 100)).toBe(-50)
  })

  it('avalia favorabilidade corretamente para receitas e despesas', () => {
    // Receita: subiu = favorável, caiu = desfavorável
    expect(isVariacaoFavoravel('Receita', 100, 120)).toBe(true)
    expect(isVariacaoFavoravel('Receita', 120, 100)).toBe(false)

    // Despesa Fixa: subiu = desfavorável, caiu = favorável
    expect(isVariacaoFavoravel('Despesa Fixa', 50, 70)).toBe(false)
    expect(isVariacaoFavoravel('Despesa Fixa', 70, 50)).toBe(true)

    // Despesa Variável: subiu = desfavorável, caiu = favorável
    expect(isVariacaoFavoravel('Despesa Variável', 10, 20)).toBe(false)
    expect(isVariacaoFavoravel('Despesa Variável', 20, 10)).toBe(true)
  })

  describe('Ordenação Hierárquica do Plano de Contas na DRE', () => {
    it('ordena segmentos numéricos hierárquicos corretamente (1.2 antes de 1.10)', () => {
      expect(compararCodigosHierarquicos('1.2', '1.10')).toBeLessThan(0)
      expect(compararCodigosHierarquicos('1.10', '1.2')).toBeGreaterThan(0)
      expect(compararCodigosHierarquicos('1.1', '1.2')).toBeLessThan(0)
      expect(compararCodigosHierarquicos('1.1.01', '1.1.02')).toBeLessThan(0)
      expect(compararCodigosHierarquicos('1.1', '1.1.01')).toBeLessThan(0)
      expect(compararCodigosHierarquicos('1.1.02', '1.1.10')).toBeLessThan(0)
      expect(compararCodigosHierarquicos('1.1', '1.1')).toBe(0)
    })

    it('coloca contas sem código por último e desempata por nome', () => {
      const contas = [
        { codigo: undefined, nome: 'Zebra Sem Código' },
        { codigo: '1.10', nome: 'Conta Dez' },
        { codigo: '1.2', nome: 'Conta Dois' },
        { codigo: '1.2', nome: 'Alfa Dois' },
        { codigo: '', nome: 'Amora Sem Código' },
        { codigo: '1.1', nome: 'Conta Um' },
      ]

      const ordenadas = [...contas].sort(compararContasDre)

      expect(ordenadas.map((c) => `${c.codigo ?? 'S/C'}: ${c.nome}`)).toEqual([
        '1.1: Conta Um',
        '1.2: Alfa Dois',
        '1.2: Conta Dois',
        '1.10: Conta Dez',
        'S/C: Amora Sem Código',
        'S/C: Zebra Sem Código',
      ])
    })

    it('aplica ordenação hierárquica dentro dos grupos da DRE Gerencial calculada', () => {
      const meses = gerarListaMeses(2023, 1, 1)

      const contasMock: ContaRecord[] = [
        {
          id: 'c-rec-10',
          collectionId: 'contas',
          collectionName: 'contas',
          user: 'u-1',
          codigo: '1.10',
          nome: 'Receita Serviços TI',
          tipo: 'Receita',
          classificacao_dre: 'Receita',
          created: '',
        },
        {
          id: 'c-rec-2',
          collectionId: 'contas',
          collectionName: 'contas',
          user: 'u-1',
          codigo: '1.2',
          nome: 'Receita Mercadorias',
          tipo: 'Receita',
          classificacao_dre: 'Receita',
          created: '',
        },
        {
          id: 'c-rec-1',
          collectionId: 'contas',
          collectionName: 'contas',
          user: 'u-1',
          codigo: '1.1',
          nome: 'Receita Produtos',
          tipo: 'Receita',
          classificacao_dre: 'Receita',
          created: '',
        },
        {
          id: 'c-rec-sem-cod',
          collectionId: 'contas',
          collectionName: 'contas',
          user: 'u-1',
          codigo: '',
          nome: 'Outras Receitas Diversas',
          tipo: 'Receita',
          classificacao_dre: 'Receita',
          created: '',
        },
      ]

      const lancamentosMock: LancamentoRecord[] = [
        {
          id: 'l-10',
          collectionId: 'lancamentos',
          collectionName: 'lancamentos',
          empresa: 'emp-1',
          plano_conta: 'pc-10',
          data: '2023-01-10 12:00:00.000Z',
          valor: 1000,
          user: 'u-1',
          created: '',
          expand: {
            plano_conta: {
              id: 'pc-10',
              collectionId: 'plano_contas',
              collectionName: 'plano_contas',
              user: 'u-1',
              conta: 'c-rec-10',
              centro: 'cc-1',
              created: '',
              expand: { conta: contasMock[0] },
            },
          },
        },
        {
          id: 'l-2',
          collectionId: 'lancamentos',
          collectionName: 'lancamentos',
          empresa: 'emp-1',
          plano_conta: 'pc-2',
          data: '2023-01-10 12:00:00.000Z',
          valor: 2000,
          user: 'u-1',
          created: '',
          expand: {
            plano_conta: {
              id: 'pc-2',
              collectionId: 'plano_contas',
              collectionName: 'plano_contas',
              user: 'u-1',
              conta: 'c-rec-2',
              centro: 'cc-1',
              created: '',
              expand: { conta: contasMock[1] },
            },
          },
        },
        {
          id: 'l-1',
          collectionId: 'lancamentos',
          collectionName: 'lancamentos',
          empresa: 'emp-1',
          plano_conta: 'pc-1',
          data: '2023-01-10 12:00:00.000Z',
          valor: 3000,
          user: 'u-1',
          created: '',
          expand: {
            plano_conta: {
              id: 'pc-1',
              collectionId: 'plano_contas',
              collectionName: 'plano_contas',
              user: 'u-1',
              conta: 'c-rec-1',
              centro: 'cc-1',
              created: '',
              expand: { conta: contasMock[2] },
            },
          },
        },
        {
          id: 'l-sem-cod',
          collectionId: 'lancamentos',
          collectionName: 'lancamentos',
          empresa: 'emp-1',
          plano_conta: 'pc-sem-cod',
          data: '2023-01-10 12:00:00.000Z',
          valor: 4000,
          user: 'u-1',
          created: '',
          expand: {
            plano_conta: {
              id: 'pc-sem-cod',
              collectionId: 'plano_contas',
              collectionName: 'plano_contas',
              user: 'u-1',
              conta: 'c-rec-sem-cod',
              centro: 'cc-1',
              created: '',
              expand: { conta: contasMock[3] },
            },
          },
        },
      ]

      const matriz = calcularDreGerencialMatriz(lancamentosMock, contasMock, meses)
      const grupoReceita = matriz.grupos.find((g) => g.classificacao === 'Receita')!

      expect(grupoReceita.contas.map((c) => c.codigo || 'S/C')).toEqual([
        '1.1',
        '1.2',
        '1.10',
        'S/C',
      ])
    })

    it('ordena contas não classificadas pelo código hierárquico e nome', () => {
      const meses = gerarListaMeses(2023, 1, 1)

      const contasMock: ContaRecord[] = [
        {
          id: 'c-nc-10',
          collectionId: 'contas',
          collectionName: 'contas',
          user: 'u-1',
          codigo: '9.10',
          nome: 'Pendente B',
          tipo: 'Despesa',
          created: '',
        },
        {
          id: 'c-nc-2',
          collectionId: 'contas',
          collectionName: 'contas',
          user: 'u-1',
          codigo: '9.2',
          nome: 'Pendente A',
          tipo: 'Despesa',
          created: '',
        },
      ]

      const lancamentosMock: LancamentoRecord[] = [
        {
          id: 'l-nc-10',
          collectionId: 'lancamentos',
          collectionName: 'lancamentos',
          empresa: 'emp-1',
          plano_conta: 'pc-nc-10',
          data: '2023-01-10 12:00:00.000Z',
          valor: 500,
          user: 'u-1',
          created: '',
          expand: {
            plano_conta: {
              id: 'pc-nc-10',
              collectionId: 'plano_contas',
              collectionName: 'plano_contas',
              user: 'u-1',
              conta: 'c-nc-10',
              centro: 'cc-1',
              created: '',
              expand: { conta: contasMock[0] },
            },
          },
        },
        {
          id: 'l-nc-2',
          collectionId: 'lancamentos',
          collectionName: 'lancamentos',
          empresa: 'emp-1',
          plano_conta: 'pc-nc-2',
          data: '2023-01-10 12:00:00.000Z',
          valor: 700,
          user: 'u-1',
          created: '',
          expand: {
            plano_conta: {
              id: 'pc-nc-2',
              collectionId: 'plano_contas',
              collectionName: 'plano_contas',
              user: 'u-1',
              conta: 'c-nc-2',
              centro: 'cc-1',
              created: '',
              expand: { conta: contasMock[1] },
            },
          },
        },
      ]

      const matriz = calcularDreGerencialMatriz(lancamentosMock, contasMock, meses)
      expect(matriz.naoClassificados.contas.map((c) => c.codigo)).toEqual(['9.2', '9.10'])
    })

    describe('Ordenação por 1º Centro de Custo -> 2º Tipo de Despesa -> 3º Conta', () => {
      it('função pura compararCentroTipoConta ordena corretamente conforme todas as regras', () => {
        const contas = [
          // Centro B, Tipo B, conta 1.1
          { nome: 'Conta 1', codigo: '1.1', centroNome: 'Centro B', tipoDespesaNome: 'Tipo B' },
          // Centro A, Tipo B, conta 1.2
          { nome: 'Conta 2', codigo: '1.2', centroNome: 'Centro A', tipoDespesaNome: 'Tipo B' },
          // Centro A, Tipo A, conta 1.10 (deve vir depois de 1.2 numérico quando tipo for igual)
          { nome: 'Conta 3', codigo: '1.10', centroNome: 'Centro A', tipoDespesaNome: 'Tipo A' },
          // Centro A, Tipo A, conta 1.2
          { nome: 'Conta 4', codigo: '1.2', centroNome: 'Centro A', tipoDespesaNome: 'Tipo A' },
          // Centro A, Tipo A, conta 1.1
          { nome: 'Conta 5', codigo: '1.1', centroNome: 'Centro A', tipoDespesaNome: 'Tipo A' },
          // Centro A, Sem Tipo, conta 1.1 (tipo vazio no fim do seu centro)
          { nome: 'Conta 6', codigo: '1.1', centroNome: 'Centro A', tipoDespesaNome: '' },
          // Sem Centro, Tipo A, conta 1.1 (centro vazio no fim de todos)
          { nome: 'Conta 7', codigo: '1.1', centroNome: '', tipoDespesaNome: 'Tipo A' },
        ]

        const ordenadas = [...contas].sort(compararCentroTipoConta)
        expect(ordenadas.map((c) => c.nome)).toEqual([
          'Conta 5', // Centro A, Tipo A, 1.1
          'Conta 4', // Centro A, Tipo A, 1.2
          'Conta 3', // Centro A, Tipo A, 1.10
          'Conta 2', // Centro A, Tipo B, 1.2
          'Conta 6', // Centro A, Sem Tipo, 1.1
          'Conta 1', // Centro B, Tipo B, 1.1
          'Conta 7', // Sem Centro, Tipo A, 1.1
        ])
      })

      it('DRE Gerencial agrupa e ordena respeitando 1º Centro -> 2º Tipo -> 3º Conta', () => {
        const meses = gerarListaMeses(2023, 1, 1)

        const contasMock: ContaRecord[] = [
          {
            id: 'c-1',
            collectionId: 'contas',
            collectionName: 'contas',
            user: 'u-1',
            codigo: '3.1',
            nome: 'Despesa Centro B',
            tipo: 'Despesa',
            classificacao_dre: 'Despesa Fixa',
            created: '',
          },
          {
            id: 'c-2',
            collectionId: 'contas',
            collectionName: 'contas',
            user: 'u-1',
            codigo: '3.9',
            nome: 'Despesa Centro A - Tipo Op',
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
            nome: 'Despesa Centro A - Tipo Adm (1.2)',
            tipo: 'Despesa',
            classificacao_dre: 'Despesa Fixa',
            created: '',
          },
          {
            id: 'c-4',
            collectionId: 'contas',
            collectionName: 'contas',
            user: 'u-1',
            codigo: '3.10',
            nome: 'Despesa Centro A - Tipo Adm (1.10)',
            tipo: 'Despesa',
            classificacao_dre: 'Despesa Fixa',
            created: '',
          },
          {
            id: 'c-5',
            collectionId: 'contas',
            collectionName: 'contas',
            user: 'u-1',
            codigo: '3.1',
            nome: 'Despesa Sem Centro',
            tipo: 'Despesa',
            classificacao_dre: 'Despesa Fixa',
            created: '',
          },
        ]

        const lancamentosMock: LancamentoRecord[] = [
          {
            id: 'l-1',
            collectionId: 'lancamentos',
            collectionName: 'lancamentos',
            empresa: 'emp-1',
            plano_conta: 'pc-1',
            data: '2023-01-10 12:00:00.000Z',
            valor: 100,
            user: 'u-1',
            created: '',
            expand: {
              plano_conta: {
                id: 'pc-1',
                collectionId: 'plano_contas',
                collectionName: 'plano_contas',
                user: 'u-1',
                conta: 'c-1',
                centro: 'cc-b',
                tipo_despesa: 'td-1',
                created: '',
                expand: {
                  conta: contasMock[0],
                  centro: {
                    id: 'cc-b',
                    nome: 'Centro B',
                    tipo: 'Despesa',
                    user: 'u-1',
                    created: '',
                    collectionId: 'centros',
                    collectionName: 'centros',
                  },
                  tipo_despesa: {
                    id: 'td-1',
                    nome: 'Geral',
                    user: 'u-1',
                    created: '',
                    collectionId: 'tipos_despesas',
                    collectionName: 'tipos_despesas',
                  },
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
            data: '2023-01-10 12:00:00.000Z',
            valor: 200,
            user: 'u-1',
            created: '',
            expand: {
              plano_conta: {
                id: 'pc-2',
                collectionId: 'plano_contas',
                collectionName: 'plano_contas',
                user: 'u-1',
                conta: 'c-2',
                centro: 'cc-a',
                tipo_despesa: 'td-op',
                created: '',
                expand: {
                  conta: contasMock[1],
                  centro: {
                    id: 'cc-a',
                    nome: 'Centro A',
                    tipo: 'Despesa',
                    user: 'u-1',
                    created: '',
                    collectionId: 'centros',
                    collectionName: 'centros',
                  },
                  tipo_despesa: {
                    id: 'td-op',
                    nome: 'Operacional',
                    user: 'u-1',
                    created: '',
                    collectionId: 'tipos_despesas',
                    collectionName: 'tipos_despesas',
                  },
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
            data: '2023-01-10 12:00:00.000Z',
            valor: 300,
            user: 'u-1',
            created: '',
            expand: {
              plano_conta: {
                id: 'pc-3',
                collectionId: 'plano_contas',
                collectionName: 'plano_contas',
                user: 'u-1',
                conta: 'c-3',
                centro: 'cc-a',
                tipo_despesa: 'td-adm',
                created: '',
                expand: {
                  conta: contasMock[2],
                  centro: {
                    id: 'cc-a',
                    nome: 'Centro A',
                    tipo: 'Despesa',
                    user: 'u-1',
                    created: '',
                    collectionId: 'centros',
                    collectionName: 'centros',
                  },
                  tipo_despesa: {
                    id: 'td-adm',
                    nome: 'Administrativo',
                    user: 'u-1',
                    created: '',
                    collectionId: 'tipos_despesas',
                    collectionName: 'tipos_despesas',
                  },
                },
              },
            },
          },
          {
            id: 'l-4',
            collectionId: 'lancamentos',
            collectionName: 'lancamentos',
            empresa: 'emp-1',
            plano_conta: 'pc-4',
            data: '2023-01-10 12:00:00.000Z',
            valor: 400,
            user: 'u-1',
            created: '',
            expand: {
              plano_conta: {
                id: 'pc-4',
                collectionId: 'plano_contas',
                collectionName: 'plano_contas',
                user: 'u-1',
                conta: 'c-4',
                centro: 'cc-a',
                tipo_despesa: 'td-adm',
                created: '',
                expand: {
                  conta: contasMock[3],
                  centro: {
                    id: 'cc-a',
                    nome: 'Centro A',
                    tipo: 'Despesa',
                    user: 'u-1',
                    created: '',
                    collectionId: 'centros',
                    collectionName: 'centros',
                  },
                  tipo_despesa: {
                    id: 'td-adm',
                    nome: 'Administrativo',
                    user: 'u-1',
                    created: '',
                    collectionId: 'tipos_despesas',
                    collectionName: 'tipos_despesas',
                  },
                },
              },
            },
          },
          {
            id: 'l-5',
            collectionId: 'lancamentos',
            collectionName: 'lancamentos',
            empresa: 'emp-1',
            plano_conta: 'pc-5',
            data: '2023-01-10 12:00:00.000Z',
            valor: 500,
            user: 'u-1',
            created: '',
            expand: {
              plano_conta: {
                id: 'pc-5',
                collectionId: 'plano_contas',
                collectionName: 'plano_contas',
                user: 'u-1',
                conta: 'c-5',
                centro: '',
                created: '',
                expand: {
                  conta: contasMock[4],
                },
              },
            },
          },
        ]

        const matriz = calcularDreGerencialMatriz(lancamentosMock, contasMock, meses)
        const despFixa = matriz.grupos.find((g) => g.classificacao === 'Despesa Fixa')!

        expect(
          despFixa.contas.map((c) => ({
            centro: c.centroNome || 'Sem Centro',
            tipo: c.tipoDespesaNome || 'Sem Tipo',
            codigo: c.codigo,
          })),
        ).toEqual([
          { centro: 'Centro A', tipo: 'Administrativo', codigo: '3.2' },
          { centro: 'Centro A', tipo: 'Administrativo', codigo: '3.10' },
          { centro: 'Centro A', tipo: 'Operacional', codigo: '3.9' },
          { centro: 'Centro B', tipo: 'Geral', codigo: '3.1' },
          { centro: 'Sem Centro', tipo: 'Sem Tipo', codigo: '3.1' },
        ])
      })
    })
  })
})
