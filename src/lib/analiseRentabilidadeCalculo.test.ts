import { describe, it, expect } from 'vitest'
import { calcularAnaliseRentabilidade } from './analiseRentabilidadeCalculo'
import { gerarListaMeses } from './dreGerencialTypes'
import { perfilTemAcesso } from './permissoesPerfis'
import type { ContaRecord, LancamentoRecord } from '@/types/finance'

describe('Análise de Rentabilidade - Cálculos e Integração DRE', () => {
  const meses = gerarListaMeses(2025, 1, 3) // Jan, Fev, Mar 2025

  const contasMock: ContaRecord[] = [
    {
      id: 'c-rec-1',
      collectionId: 'contas',
      collectionName: 'contas',
      user: 'u-1',
      empresa: 'emp-1',
      codigo: '3.01.01',
      nome: 'Receita de Vendas de Produtos',
      tipo: 'Receita',
      classificacao_dre: 'Receita',
      natureza: 'credora',
      created: '2025-01-01',
      updated: '2025-01-01',
    },
    {
      id: 'c-var-1',
      collectionId: 'contas',
      collectionName: 'contas',
      user: 'u-1',
      empresa: 'emp-1',
      codigo: '4.01.01',
      nome: 'Comissões sobre Vendas',
      tipo: 'Despesa',
      classificacao_dre: 'Despesa Variável',
      natureza: 'devedora',
      created: '2025-01-01',
      updated: '2025-01-01',
    },
    {
      id: 'c-fix-1',
      collectionId: 'contas',
      collectionName: 'contas',
      user: 'u-1',
      empresa: 'emp-1',
      codigo: '4.02.01',
      nome: 'Aluguel Predial Administrativo',
      tipo: 'Despesa',
      classificacao_dre: 'Despesa Fixa',
      natureza: 'devedora',
      created: '2025-01-01',
      updated: '2025-01-01',
    },
  ]

  const lancamentosMock: LancamentoRecord[] = [
    // Jan/2025: Receita 100.000, DespVar 20.000, DespFix 30.000 -> Lucro 50.000
    {
      id: 'l1',
      collectionId: 'lancamentos',
      collectionName: 'lancamentos',
      user: 'u-1',
      empresa: 'emp-1',
      conta: 'c-rec-1',
      plano_conta: '',
      data: '2025-01-15',
      valor: 100000,
      tipo: 'credito',
      descricao: 'Vendas Janeiro',
      created: '2025-01-15',
      updated: '2025-01-15',
    },
    {
      id: 'l2',
      collectionId: 'lancamentos',
      collectionName: 'lancamentos',
      user: 'u-1',
      empresa: 'emp-1',
      conta: 'c-var-1',
      plano_conta: '',
      data: '2025-01-20',
      valor: 20000,
      tipo: 'debito',
      descricao: 'Comissões Janeiro',
      created: '2025-01-20',
      updated: '2025-01-20',
    },
    {
      id: 'l3',
      collectionId: 'lancamentos',
      collectionName: 'lancamentos',
      user: 'u-1',
      empresa: 'emp-1',
      conta: 'c-fix-1',
      plano_conta: '',
      data: '2025-01-25',
      valor: 30000,
      tipo: 'debito',
      descricao: 'Aluguel Janeiro',
      created: '2025-01-25',
      updated: '2025-01-25',
    },
    // Fev/2025: Receita 150.000, DespVar 30.000, DespFix 30.000 -> Lucro 90.000
    {
      id: 'l4',
      collectionId: 'lancamentos',
      collectionName: 'lancamentos',
      user: 'u-1',
      empresa: 'emp-1',
      conta: 'c-rec-1',
      plano_conta: '',
      data: '2025-02-15',
      valor: 150000,
      tipo: 'credito',
      descricao: 'Vendas Fevereiro',
      created: '2025-02-15',
      updated: '2025-02-15',
    },
    {
      id: 'l5',
      collectionId: 'lancamentos',
      collectionName: 'lancamentos',
      user: 'u-1',
      empresa: 'emp-1',
      conta: 'c-var-1',
      plano_conta: '',
      data: '2025-02-20',
      valor: 30000,
      tipo: 'debito',
      descricao: 'Comissões Fevereiro',
      created: '2025-02-20',
      updated: '2025-02-20',
    },
    {
      id: 'l6',
      collectionId: 'lancamentos',
      collectionName: 'lancamentos',
      user: 'u-1',
      empresa: 'emp-1',
      conta: 'c-fix-1',
      plano_conta: '',
      data: '2025-02-25',
      valor: 30000,
      tipo: 'debito',
      descricao: 'Aluguel Fevereiro',
      created: '2025-02-25',
      updated: '2025-02-25',
    },
    // Mar/2025: Sem vendas, DespFix 30.000 -> Lucro -30.000 (prejuízo)
    {
      id: 'l7',
      collectionId: 'lancamentos',
      collectionName: 'lancamentos',
      user: 'u-1',
      empresa: 'emp-1',
      conta: 'c-fix-1',
      plano_conta: '',
      data: '2025-03-25',
      valor: 30000,
      tipo: 'debito',
      descricao: 'Aluguel Março',
      created: '2025-03-25',
      updated: '2025-03-25',
    },
  ]

  it('deve calcular faturamento, lucro e margens por mês corretamente', () => {
    const res = calcularAnaliseRentabilidade(lancamentosMock, contasMock, meses)

    expect(res.itensPorMes).toHaveLength(3)

    // Janeiro: Faturamento 100.000, Lucro 50.000, Margem 50%
    const jan = res.itensPorMes[0]
    expect(jan.faturamento).toBe(100000)
    expect(jan.lucroApurado).toBe(50000)
    expect(jan.despesasVariaveis).toBe(20000)
    expect(jan.despesasFixas).toBe(30000)
    expect(jan.margemBruta).toBeCloseTo(80) // (100k - 20k) / 100k = 80%
    expect(jan.margemOperacional).toBeCloseTo(50) // (100k - 20k - 30k) / 100k = 50%
    expect(jan.margemSobreFaturamento).toBeCloseTo(50)

    // Fevereiro: Faturamento 150.000, Lucro 90.000, Margem 60%
    const fev = res.itensPorMes[1]
    expect(fev.faturamento).toBe(150000)
    expect(fev.lucroApurado).toBe(90000)
    expect(fev.margemBruta).toBeCloseTo(80)
    expect(fev.margemOperacional).toBeCloseTo(60)
    expect(fev.margemSobreFaturamento).toBeCloseTo(60)

    // Março: Faturamento 0, Lucro -30.000, Margem null
    const mar = res.itensPorMes[2]
    expect(mar.faturamento).toBe(0)
    expect(mar.lucroApurado).toBe(-30000)
    expect(mar.margemSobreFaturamento).toBeNull()
  })

  it('deve consolidar totais do período de forma correta', () => {
    const res = calcularAnaliseRentabilidade(lancamentosMock, contasMock, meses)

    // Faturamento Total = 100k + 150k = 250k
    expect(res.faturamentoTotal).toBe(250000)
    // Lucro Total = 50k + 90k - 30k = 110k
    expect(res.lucroTotal).toBe(110000)
    // Despesas Variáveis Total = 20k + 30k = 50k
    expect(res.despesasVariaveisTotal).toBe(50000)
    // Despesas Fixas Total = 30k + 30k + 30k = 90k
    expect(res.despesasFixasTotal).toBe(90000)
    // Margem Total = (110k / 250k) * 100 = 44%
    expect(res.margemSobreFaturamentoTotal).toBeCloseTo(44)
    // Margem Bruta Total = (250k - 50k) / 250k * 100 = 80%
    expect(res.margemBrutaTotal).toBeCloseTo(80)
    // Margem Operacional Total = (250k - 50k - 90k) / 250k * 100 = 44%
    expect(res.margemOperacionalTotal).toBeCloseTo(44)

    // Estatísticas
    expect(res.mesesComLucro).toBe(2)
    expect(res.mesesComPrejuizo).toBe(1)
    expect(res.melhorMesLucro?.rotulo).toBe('Fev/25')
    expect(res.melhorMesLucro?.valor).toBe(90000)
    expect(res.piorMesLucro?.rotulo).toBe('Mar/25')
    expect(res.piorMesLucro?.valor).toBe(-30000)
  })

  it('garante que gerencial_rentabilidade está configurado nas regras de acesso de perfis', () => {
    // Administrador tem acesso
    expect(perfilTemAcesso('admin', 'gerencial_rentabilidade')).toBe(true)
    // Financeiro tem acesso
    expect(perfilTemAcesso('financeiro', 'gerencial_rentabilidade')).toBe(true)
    // Comercial NÃO tem acesso a módulos gerenciais
    expect(perfilTemAcesso('comercial', 'gerencial_rentabilidade')).toBe(false)
    // CLIENTE NÃO DEVE TER ACESSO (requisito fundamental 5)
    expect(perfilTemAcesso('cliente', 'gerencial_rentabilidade')).toBe(false)
  })
})
