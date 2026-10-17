import { describe, it, expect } from 'vitest'
import {
  agruparLancamentosPorCentroCusto,
  agruparContasVariaveisResumo,
  calcularTotaisVariaveis,
  type LancamentoVariavelItem,
} from './lancamentosVariaveisHelper'

describe('lancamentosVariaveisHelper - Agrupamento por Centro e por Conta', () => {
  const itensMock: LancamentoVariavelItem[] = [
    {
      id: 'l1',
      data: '2025-02-10',
      valor: 5000,
      historico: 'Comissão Vendedor A',
      contaId: 'c-comissao',
      contaNome: 'Comissões de Vendas',
      contaCodigo: '4.1.01',
      centroId: 'cc-comercial',
      centroNome: 'Comercial & Vendas',
      lancamento: { id: 'l1', valor: 5000 } as any,
    },
    {
      id: 'l2',
      data: '2025-02-15',
      valor: 3000,
      historico: 'Comissão Vendedor B',
      contaId: 'c-comissao',
      contaNome: 'Comissões de Vendas',
      contaCodigo: '4.1.01',
      centroId: 'cc-comercial',
      centroNome: 'Comercial & Vendas',
      lancamento: { id: 'l2', valor: 3000 } as any,
    },
    {
      id: 'l3',
      data: '2025-02-12',
      valor: 8000,
      historico: 'Frete Terceirizado Fábrica',
      contaId: 'c-frete',
      contaNome: 'Frete sobre Vendas',
      contaCodigo: '4.1.02',
      centroId: 'cc-logistica',
      centroNome: 'Logística & Entrega',
      lancamento: { id: 'l3', valor: 8000 } as any,
    },
    {
      id: 'l4',
      data: '2025-02-20',
      valor: 2000,
      historico: 'Taxa Gateway',
      contaId: 'c-taxas',
      contaNome: 'Taxas de Cartão',
      // Sem centro especificado
      lancamento: { id: 'l4', valor: 2000 } as any,
    },
  ]

  it('deve calcular totais gerais corretamente', () => {
    const totais = calcularTotaisVariaveis(itensMock)
    expect(totais.quantidade).toBe(4)
    expect(totais.totalValor).toBe(18000)
  })

  it('deve agrupar por Centro de Custo com subtotais e ordenação alfabética (sem centro no final)', () => {
    const grupos = agruparLancamentosPorCentroCusto(itensMock)

    expect(grupos).toHaveLength(3)

    // Comercial & Vendas
    expect(grupos[0].centroNome).toBe('Comercial & Vendas')
    expect(grupos[0].quantidade).toBe(2)
    expect(grupos[0].subtotal).toBe(8000)
    expect(grupos[0].itens).toHaveLength(2)

    // Logística & Entrega
    expect(grupos[1].centroNome).toBe('Logística & Entrega')
    expect(grupos[1].quantidade).toBe(1)
    expect(grupos[1].subtotal).toBe(8000)

    // Sem Centro de Custo no fim
    expect(grupos[2].centroNome).toBe('Sem Centro de Custo')
    expect(grupos[2].quantidade).toBe(1)
    expect(grupos[2].subtotal).toBe(2000)

    // Soma dos subtotais confere com o total geral
    const somaSubtotais = grupos.reduce((acc, g) => acc + g.subtotal, 0)
    expect(somaSubtotais).toBe(18000)
  })

  it('deve agrupar contas variáveis para o simulador por conta', () => {
    const contas = agruparContasVariaveisResumo(itensMock)

    expect(contas).toHaveLength(3)
    // Ordenadas por maior total original primeiro
    // c-comissao (8000) ou c-frete (8000), depois c-taxas (2000)
    expect(contas.map((c) => c.contaId)).toContain('c-comissao')
    expect(contas.map((c) => c.contaId)).toContain('c-frete')
    expect(contas.map((c) => c.contaId)).toContain('c-taxas')

    const comissao = contas.find((c) => c.contaId === 'c-comissao')!
    expect(comissao.totalOriginal).toBe(8000)
    expect(comissao.quantidade).toBe(2)
    expect(comissao.centrosNomes).toContain('Comercial & Vendas')

    const taxas = contas.find((c) => c.contaId === 'c-taxas')!
    expect(taxas.totalOriginal).toBe(2000)
    expect(taxas.centrosNomes).toContain('Sem Centro de Custo')
  })
})
