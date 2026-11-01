import { describe, it, expect } from 'vitest'
import {
  normalizarNomeMesParaIndice,
  normalizarValorMonetarioExcel,
  parsePlanilha12MesesColunas,
  COLUNAS_MESES_12,
} from './modeloImportacaoExcel'
import type { PlanoContaRecord } from '@/types/finance'

describe('modeloImportacaoExcel - 12 Meses em Colunas', () => {
  it('normaliza corretamente nomes de meses para índices de 1 a 12', () => {
    expect(normalizarNomeMesParaIndice('Janeiro')).toBe(1)
    expect(normalizarNomeMesParaIndice('jan')).toBe(1)
    expect(normalizarNomeMesParaIndice('Fevereiro')).toBe(2)
    expect(normalizarNomeMesParaIndice('março')).toBe(3)
    expect(normalizarNomeMesParaIndice('marco')).toBe(3)
    expect(normalizarNomeMesParaIndice('Dezembro')).toBe(12)
    expect(normalizarNomeMesParaIndice('dez')).toBe(12)
    expect(normalizarNomeMesParaIndice('Mês 05')).toBe(5)
    expect(normalizarNomeMesParaIndice('ColunaInvalida')).toBeNull()
  })

  it('normaliza valores monetários em formato brasileiro e numérico', () => {
    expect(normalizarValorMonetarioExcel(1500.5)).toBe(1500.5)
    expect(normalizarValorMonetarioExcel('R$ 1.500,50')).toBe(1500.5)
    expect(normalizarValorMonetarioExcel('2.345,67')).toBe(2345.67)
    expect(normalizarValorMonetarioExcel('100,00')).toBe(100)
    expect(normalizarValorMonetarioExcel('-')).toBe(0)
    expect(normalizarValorMonetarioExcel('')).toBe(0)
    expect(normalizarValorMonetarioExcel(null)).toBe(0)
  })

  it('converte linhas de contas com colunas mensais em lançamentos decompostos mês a mês', () => {
    const planoContasMock: PlanoContaRecord[] = [
      {
        id: 'pc_1',
        collectionId: 'plano_contas',
        collectionName: 'plano_contas',
        codigo: 'PC-001',
        codigo_empresa: '1.1.01',
        descricao: 'Receita de Vendas',
        empresa: 'emp_1',
        conta: 'c1',
        centro: 'ce1',
        user: 'user_1',
        created: '2025-01-01',
        updated: '2025-01-01',
        expand: {
          conta: { id: 'c1', nome: 'Receita de Vendas', codigo: '1.1.01', tipo: 'Receita' } as any,
          centro: { id: 'ce1', nome: 'Comercial', codigo: 'COM' } as any,
        },
      },
      {
        id: 'pc_2',
        collectionId: 'plano_contas',
        collectionName: 'plano_contas',
        codigo: 'PC-002',
        codigo_empresa: '2.1.01',
        descricao: 'Salários e Encargos',
        empresa: 'emp_1',
        conta: 'c2',
        centro: 'ce2',
        user: 'user_1',
        created: '2025-01-01',
        updated: '2025-01-01',
        expand: {
          conta: {
            id: 'c2',
            nome: 'Salários e Encargos',
            codigo: '2.1.01',
            tipo: 'Despesa',
          } as any,
          centro: { id: 'ce2', nome: 'Administrativo', codigo: 'ADM' } as any,
        },
      },
    ]

    const rawData = [
      {
        'Codigo Plano': '1.1.01',
        Conta: 'Receita de Vendas',
        Centro: 'Comercial',
        Janeiro: 'R$ 15.000,00',
        Fevereiro: 18000,
        Março: '0', // zerado = sem lançamento
        Abril: '', // vazio = sem lançamento
        Maio: '20.500,50',
        Historico: 'Vendas Operacionais',
      },
      {
        'Codigo Plano': '2.1.01',
        Conta: 'Salários e Encargos',
        Centro: 'Administrativo',
        Janeiro: '8.500,00',
        Fevereiro: '8.500,00',
        Março: '8.500,00',
        Historico: 'Folha de Pagamento',
      },
    ]

    const result = parsePlanilha12MesesColunas(rawData, planoContasMock, 2025)

    expect(result.anoExercicio).toBe(2025)
    expect(result.totalLinhasLidas).toBe(2)
    // Mes 1 (Jan): conta 1 (15000) e conta 2 (8500)
    expect(result.porMes[1].totalLancamentos).toBe(2)
    expect(result.porMes[1].totalValor).toBe(23500)
    expect(result.porMes[1].lancamentosValidos).toHaveLength(2)

    // Data de competência deve ser 2025-01-15
    const lancJan = result.porMes[1].lancamentosValidos[0]
    expect(lancJan.data).toBe('2025-01-15')
    expect(lancJan.valor).toBe(15000)
    expect(lancJan.plano_conta_id).toBe('pc_1')
    expect(lancJan.status).toBe('valido')

    // Mes 2 (Fev): conta 1 (18000) e conta 2 (8500)
    expect(result.porMes[2].totalLancamentos).toBe(2)
    expect(result.porMes[2].totalValor).toBe(26500)

    // Mes 3 (Mar): apenas conta 2 (8500), pois conta 1 estava zerada
    expect(result.porMes[3].totalLancamentos).toBe(1)
    expect(result.porMes[3].totalValor).toBe(8500)

    // Mes 4 (Abr): nenhum lançamento
    expect(result.porMes[4].totalLancamentos).toBe(0)

    // Mes 5 (Mai): conta 1 (20500.5)
    expect(result.porMes[5].totalLancamentos).toBe(1)
    expect(result.porMes[5].totalValor).toBe(20500.5)
  })
})
