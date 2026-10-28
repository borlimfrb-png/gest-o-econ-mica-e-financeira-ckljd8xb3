import { describe, it, expect } from 'vitest'
import {
  calcularPainelIndicadoresFinanceiros,
  classificarStatusIndicador,
} from './indicadoresFinanceirosCalculo'
import { gerarListaMeses } from './dreGerencialTypes'
import type { BalancoRecord, ContaRecord, LancamentoRecord } from '@/types/finance'

describe('Motor de Indicadores Financeiros Clássicos', () => {
  const meses = gerarListaMeses(2025, 1, 3)

  const contasMock: ContaRecord[] = [
    {
      id: 'c-rec',
      collectionId: 'contas',
      collectionName: 'contas',
      user: 'u-1',
      empresa: 'emp-1',
      codigo: '3.01.01',
      nome: 'Receita Operacional Bruta',
      tipo: 'Receita',
      classificacao_dre: 'Receita',
      natureza: 'credora',
      created: '2025-01-01',
      updated: '2025-01-01',
    },
    {
      id: 'c-var',
      collectionId: 'contas',
      collectionName: 'contas',
      user: 'u-1',
      empresa: 'emp-1',
      codigo: '4.01.01',
      nome: 'Comissões de Venda',
      tipo: 'Despesa',
      classificacao_dre: 'Despesa Variável',
      natureza: 'devedora',
      created: '2025-01-01',
      updated: '2025-01-01',
    },
    {
      id: 'c-fix',
      collectionId: 'contas',
      collectionName: 'contas',
      user: 'u-1',
      empresa: 'emp-1',
      codigo: '4.02.01',
      nome: 'Aluguel e Salários Fixos',
      tipo: 'Despesa',
      classificacao_dre: 'Despesa Fixa',
      natureza: 'devedora',
      created: '2025-01-01',
      updated: '2025-01-01',
    },
  ]

  const lancamentosMock: LancamentoRecord[] = [
    // Receitas: 200.000
    {
      id: 'l1',
      collectionId: 'lancamentos',
      collectionName: 'lancamentos',
      user: 'u-1',
      empresa: 'emp-1',
      conta: 'c-rec',
      plano_conta: '',
      data: '2025-01-15',
      valor: 200000,
      tipo: 'credito',
      created: '2025-01-15',
      updated: '2025-01-15',
    },
    // Despesas Variáveis: 40.000 (Margem Bruta = (200k - 40k) / 200k = 80%)
    {
      id: 'l2',
      collectionId: 'lancamentos',
      collectionName: 'lancamentos',
      user: 'u-1',
      empresa: 'emp-1',
      conta: 'c-var',
      plano_conta: '',
      data: '2025-01-20',
      valor: 40000,
      tipo: 'debito',
      created: '2025-01-20',
      updated: '2025-01-20',
    },
    // Despesas Fixas: 60.000 (Lucro = 200k - 40k - 60k = 100.000, Margem Líquida = 50%)
    {
      id: 'l3',
      collectionId: 'lancamentos',
      collectionName: 'lancamentos',
      user: 'u-1',
      empresa: 'emp-1',
      conta: 'c-fix',
      plano_conta: '',
      data: '2025-01-25',
      valor: 60000,
      tipo: 'debito',
      created: '2025-01-25',
      updated: '2025-01-25',
    },
  ]

  const balancoMock: BalancoRecord = {
    id: 'b-1',
    collectionId: 'balancos',
    collectionName: 'balancos',
    empresa: 'emp-1',
    ano: 2025,
    caixa_equivalentes: 50000,
    aplicacoes_financeiras: 50000,
    contas_receber: 100000,
    estoques: 60000,
    impostos_recuperar: 0,
    outros_ativo_circulante: 40000,
    realizavel_longo_prazo: 40000,
    investimentos: 0,
    imobilizado: 160000,
    intangivel: 0,
    fornecedores: 50000,
    emprestimos_curto_prazo: 50000,
    obrigacoes_trabalhistas: 25000,
    obrigacoes_tributarias: 25000,
    outros_passivo_circulante: 0,
    emprestimos_longo_prazo: 50000,
    outras_obrigacoes_longo_prazo: 0,
    capital_social: 200000,
    reservas_lucros: 100000,
    lucros_acumulados: 0,
    created: '2025-01-01',
    updated: '2025-01-01',
  }

  it('calcula indicadores de liquidez com precisão quando há balanço cadastrado', () => {
    const res = calcularPainelIndicadoresFinanceiros({
      balanco: balancoMock,
      lancamentos: lancamentosMock,
      contas: contasMock,
      meses,
      ano: 2025,
    })

    expect(res.temBalancoNoPeriodo).toBe(true)

    // Liquidez Corrente = AC (300k) / PC (150k) = 2.0
    const lc = res.indicadores.find((i) => i.id === 'liquidez_corrente')
    expect(lc).toBeDefined()
    expect(lc?.valor).toBeCloseTo(2.0)
    expect(lc?.status).toBe('Excelente')
    expect(lc?.temDadosBalanco).toBe(true)

    // Liquidez Seca = (AC 300k - Est 60k) / PC 150k = 240k / 150k = 1.6
    const ls = res.indicadores.find((i) => i.id === 'liquidez_seca')
    expect(ls).toBeDefined()
    expect(ls?.valor).toBeCloseTo(1.6)
    expect(ls?.status).toBe('Excelente')

    // Liquidez Geral = (AC 300k + RLP 40k) / (PC 150k + PNC 50k) = 340k / 200k = 1.7
    const lg = res.indicadores.find((i) => i.id === 'liquidez_geral')
    expect(lg).toBeDefined()
    expect(lg?.valor).toBeCloseTo(1.7)
    expect(lg?.status).toBe('Excelente')
  })

  it('calcula endividamento e alavancagem financeira', () => {
    const res = calcularPainelIndicadoresFinanceiros({
      balanco: balancoMock,
      lancamentos: lancamentosMock,
      contas: contasMock,
      meses,
      ano: 2025,
    })

    // Alavancagem Dívida / PL = (PC 150k + PNC 50k) / PL 300k = 200k / 300k ≈ 0.6667
    const alav = res.indicadores.find((i) => i.id === 'alavancagem_divida_pl')
    expect(alav?.valor).toBeCloseTo(0.6667, 2)
    expect(alav?.status).toBe('Excelente') // <= 0.8 é excelente

    // Endividamento Geral = (200k / 500k) * 100 = 40%
    const eg = res.indicadores.find((i) => i.id === 'endividamento_geral')
    expect(eg?.valor).toBeCloseTo(40)
    expect(eg?.status).toBe('Excelente')
  })

  it('calcula indicadores de rentabilidade integrando DRE e Balanço (ROE, ROA, Margens)', () => {
    const res = calcularPainelIndicadoresFinanceiros({
      balanco: balancoMock,
      lancamentos: lancamentosMock,
      contas: contasMock,
      meses,
      ano: 2025,
    })

    // Lucro Líquido = 200k - 40k - 60k = 100k
    expect(res.totaisDRE.lucroLiquidoTotal).toBe(100000)

    // ROE = (100k / PL 300k) * 100 ≈ 33.33%
    const roe = res.indicadores.find((i) => i.id === 'roe')
    expect(roe?.valor).toBeCloseTo(33.33, 1)
    expect(roe?.status).toBe('Excelente')

    // ROA / ROI = (100k / AT 500k) * 100 = 20%
    const roi = res.indicadores.find((i) => i.id === 'roi_roa')
    expect(roi?.valor).toBeCloseTo(20)
    expect(roi?.status).toBe('Excelente')

    // Margem Bruta = (160k / 200k) * 100 = 80%
    const mb = res.indicadores.find((i) => i.id === 'margem_bruta')
    expect(mb?.valor).toBeCloseTo(80)

    // Margem Líquida = (100k / 200k) * 100 = 50%
    const ml = res.indicadores.find((i) => i.id === 'margem_liquida')
    expect(ml?.valor).toBeCloseTo(50)
  })

  it('trata graciosamente períodos SEM balanço cadastrado: sem números zerados incorretos', () => {
    const res = calcularPainelIndicadoresFinanceiros({
      balanco: null, // sem balanço no período
      lancamentos: lancamentosMock,
      contas: contasMock,
      meses,
      ano: 2025,
    })

    expect(res.temBalancoNoPeriodo).toBe(false)

    // Indicadores que dependem de balanço devem ter valor = null e temDadosBalanco = false
    const lc = res.indicadores.find((i) => i.id === 'liquidez_corrente')
    expect(lc?.valor).toBeNull()
    expect(lc?.temDadosBalanco).toBe(false)
    expect(lc?.status).toBe('Indefinido')

    const roe = res.indicadores.find((i) => i.id === 'roe')
    expect(roe?.valor).toBeNull()
    expect(roe?.temDadosBalanco).toBe(false)

    // Já as margens que dependem de DRE funcionam normalmente
    const mb = res.indicadores.find((i) => i.id === 'margem_bruta')
    expect(mb?.valor).toBeCloseTo(80)
    expect(mb?.temDadosBalanco).toBe(true)

    const ml = res.indicadores.find((i) => i.id === 'margem_liquida')
    expect(ml?.valor).toBeCloseTo(50)
  })

  it('classifica corretamente os status conforme faixas padrão de mercado', () => {
    expect(classificarStatusIndicador('liquidez_corrente', 2.0).status).toBe('Excelente')
    expect(classificarStatusIndicador('liquidez_corrente', 1.2).status).toBe('Adequada')
    expect(classificarStatusIndicador('liquidez_corrente', 0.9).status).toBe('Atenção')
    expect(classificarStatusIndicador('liquidez_corrente', 0.5).status).toBe('Crítica')
    expect(classificarStatusIndicador('liquidez_corrente', null).status).toBe('Indefinido')

    expect(classificarStatusIndicador('alavancagem_divida_pl', 0.5).status).toBe('Excelente')
    expect(classificarStatusIndicador('alavancagem_divida_pl', 1.2).status).toBe('Adequada')
    expect(classificarStatusIndicador('alavancagem_divida_pl', 2.0).status).toBe('Atenção')
    expect(classificarStatusIndicador('alavancagem_divida_pl', 3.0).status).toBe('Crítica')
  })
})
