import { describe, it, expect } from 'vitest'
import type { BalancoRecord } from '@/types/finance'
import {
  calcularBalancoProjetado,
  selecionarUltimoBalancoComDados,
  calcularSubtotaisBalanço,
} from './projecaoBalancoCalculo'
import { calcularProjecaoDre, type ProjecaoResultado } from './projecaoDreCalculo'
import { calcularDreGerencialMatriz } from './dreGerencialCalculo'
import { gerarListaMeses } from './dreGerencialTypes'
import type { ContaRecord, LancamentoRecord, PlanoContaRecord } from '@/types/finance'

function balanco(overrides: Partial<BalancoRecord>): BalancoRecord {
  return {
    id: 'b1',
    collectionId: 'balancos',
    collectionName: 'balancos',
    created: '',
    updated: '',
    empresa: 'e1',
    ano: 2025,
    mes: 6,
    ...overrides,
  } as BalancoRecord
}

const balancoBase: BalancoRecord = balanco({
  caixa_equivalentes: 50000,
  aplicacoes_financeiras: 20000,
  contas_receber: 80000,
  estoques: 40000,
  impostos_recuperar: 5000,
  outros_ativo_circulante: 5000,
  realizavel_longo_prazo: 10000,
  investimentos: 15000,
  imobilizado: 120000,
  intangivel: 10000,
  fornecedores: 60000,
  emprestimos_curto_prazo: 30000,
  obrigacoes_trabalhistas: 15000,
  obrigacoes_tributarias: 10000,
  outros_passivo_circulante: 5000,
  emprestimos_longo_prazo: 50000,
  outras_obrigacoes_longo_prazo: 5000,
  capital_social: 100000,
  reservas_lucros: 20000,
  lucros_acumulados: 55000,
})

const meses2025 = gerarListaMeses(2025, 1, 12)

const contaRec: ContaRecord = {
  id: 'c-rec',
  collectionId: 'contas',
  collectionName: 'contas',
  nome: 'Receita de Vendas',
  tipo: 'Receita',
  classificacao_dre: 'Receita',
  created: '',
} as unknown as ContaRecord

const contaDesp: ContaRecord = {
  id: 'c-desp',
  collectionId: 'contas',
  collectionName: 'contas',
  nome: 'Materiais',
  tipo: 'Despesa',
  classificacao_dre: 'Despesa Variável',
  created: '',
} as unknown as ContaRecord

const contaFix: ContaRecord = {
  id: 'c-fix',
  collectionId: 'contas',
  collectionName: 'contas',
  nome: 'Aluguel',
  tipo: 'Despesa',
  classificacao_dre: 'Despesa Fixa',
  created: '',
} as unknown as ContaRecord

function lancamento(
  id: string,
  planoContaId: string,
  valor: number,
  mes: number,
): LancamentoRecord {
  return {
    id,
    collectionId: 'lancamentos',
    collectionName: 'lancamentos',
    empresa: 'e1',
    plano_conta: planoContaId,
    data: `2025-${String(mes).padStart(2, '0')}-15`,
    valor,
    created: '',
    expand: {
      plano_conta: {
        id: planoContaId,
        collectionId: 'plano_contas',
        collectionName: 'plano_contas',
        conta:
          planoContaId === 'pc-rec' ? 'c-rec' : planoContaId === 'pc-desp-var' ? 'c-desp' : 'c-fix',
        created: '',
        expand: {
          conta:
            planoContaId === 'pc-rec'
              ? contaRec
              : planoContaId === 'pc-desp-var'
                ? contaDesp
                : contaFix,
        },
      },
    },
  } as unknown as LancamentoRecord
}

function projecaoMock(): ProjecaoResultado {
  // DRE simplificada: 3 meses com movimento; receita 100k/mês, despesa variável 40k/mês, fixa 30k/mês
  const lancamentos: LancamentoRecord[] = []
  for (let m = 1; m <= 3; m++) {
    lancamentos.push(lancamento(`l-rec-${m}`, 'pc-rec', 100000, m))
    lancamentos.push(lancamento(`l-desp-var-${m}`, 'pc-desp-var', 40000, m))
    lancamentos.push(lancamento(`l-desp-fix-${m}`, 'pc-desp-fix', 30000, m))
  }
  const matriz = calcularDreGerencialMatriz(
    lancamentos,
    [contaRec, contaDesp, contaFix],
    meses2025,
    [],
  )
  const matrizVaziaAnterior = calcularDreGerencialMatriz(
    [],
    [contaRec, contaDesp, contaFix],
    gerarListaMeses(2024, 1, 12),
    [],
  )
  return calcularProjecaoDre(matriz, matrizVaziaAnterior, meses2025)
}

describe('selecionarUltimoBalancoComDados', () => {
  it('nunca pega balanço mensal zerado — escolhe o último com dados', () => {
    const zerado = balanco({ ano: 2025, mes: 9, caixa_equivalentes: 0 })
    const comDados = balancoBase
    const res = selecionarUltimoBalancoComDados([comDados, zerado], 2025)
    expect(res.mes).toBe(6)
    expect(res.balanco?.contas_receber).toBe(80000)
  })

  it('retorna null quando não há balanço com dados no ano', () => {
    const res = selecionarUltimoBalancoComDados([balanco({ caixa_equivalentes: 0 })], 2025)
    expect(res.balanco).toBeNull()
  })
})

describe('calcularBalancoProjetado', () => {
  const projecao = projecaoMock()
  const res = calcularBalancoProjetado({
    balancos: [balancoBase],
    exercicio: 2025,
    projecao,
  })

  it('fecha o balanço: Ativo Total = Passivo + PL (tolerância 0,01)', () => {
    expect(res.diferencaFechamento).toBeLessThan(0.01)
    expect(res.ativoTotalProjetado).toBeCloseTo(res.passivoPlTotalProjetado, 2)
  })

  it('PL projetado = PL realizado + lucro total (realizado + projetado) da DRE', () => {
    const plRealizado = 100000 + 20000 + 55000 // capital + reservas + acumulados
    const linhaLucros = res.linhas.find((l) => l.chave === 'lucros_acumulados')!
    expect(linhaLucros.projetado).toBe(55000 + projecao.lucroPrejuizoTotalAno)
    const plProj = calcularSubtotaisBalanço(res).find((s) => s.chave === 'secao_pl')!
    expect(plProj.projetado).toBeCloseTo(plRealizado + projecao.lucroPrejuizoTotalAno, 2)
    expect(res.lucroProjetadoUsado).toBe(projecao.lucroPrejuizoTotalAno)
  })

  it('caixa projetado = caixa realizado + resultado projetado + ajuste de fechamento', () => {
    const linhaCaixa = res.linhas.find((l) => l.chave === 'caixa')!
    expect(linhaCaixa.metodo).toBe('caixa_fechamento')
    expect(linhaCaixa.projetado).toBeCloseTo(
      70000 + projecao.lucroPrejuizoProjetado + res.ajusteFechamento,
      2,
    )
    expect(linhaCaixa.projetado).toBeCloseTo(res.caixaDerivadoBruto + res.ajusteFechamento, 2)
  })

  it('contas a receber usa circulação (dias) com valores conhecidos', () => {
    // Receita realizada: 3 meses × 100k = 300k; cr = 80k → PMR = 80k/(300k/90 dias)=24 dias
    const linha = res.linhas.find((l) => l.chave === 'contas_receber')!
    expect(linha.metodo).toBe('circulacao_receber')
    // Receita anual projetada = 12 × 100k = 1.2M → 24 dias × (1.2M/365) ≈ 78.904,11
    expect(linha.projetado).toBeCloseTo(24 * (1200000 / 365), 0)
  })

  it('estoques e fornecedores usam circulação sobre o custo com valores conhecidos', () => {
    // Despesa variável realizada: 3 × 40k = 120k; estoques 40k → 30 dias; fornecedores 60k → 45 dias
    const est = res.linhas.find((l) => l.chave === 'estoques')!
    const forn = res.linhas.find((l) => l.chave === 'fornecedores')!
    expect(est.metodo).toBe('circulacao_estoques')
    expect(forn.metodo).toBe('circulacao_fornecedores')
    expect(est.projetado).toBeCloseTo(30 * (480000 / 365), 0)
    expect(forn.projetado).toBeCloseTo(45 * (480000 / 365), 0)
  })

  it('imobilizado e empréstimos mantêm o saldo realizado', () => {
    const imob = res.linhas.find((l) => l.chave === 'imobilizado')!
    const emprLp = res.linhas.find((l) => l.chave === 'emprestimos_longo_prazo')!
    expect(imob.metodo).toBe('mantem_realizado')
    expect(imob.projetado).toBe(120000)
    expect(emprLp.projetado).toBe(50000)
  })

  it('sem balanço com dados: projeção honesta com zero e aviso temBalancoRealizado=false', () => {
    const resVazio = calcularBalancoProjetado({ balancos: [], exercicio: 2025, projecao })
    expect(resVazio.temBalancoRealizado).toBe(false)
    expect(resVazio.linhas.every((l) => l.realizado === 0 || l.chave.startsWith('secao_'))).toBe(
      true,
    )
    // Ainda fecha (tudo zero + lucro PL = caixa)
    expect(resVazio.diferencaFechamento).toBeLessThan(0.01)
  })

  it('expõe caixaNegativo quando o fechamento exige caixa negativo', () => {
    const balancoPequeno = balanco({
      caixa_equivalentes: 100,
      aplicacoes_financeiras: 0,
      contas_receber: 0,
      estoques: 0,
      imobilizado: 1000,
      capital_social: 1000,
    })
    const resNeg = calcularBalancoProjetado({
      balancos: [balancoPequeno],
      exercicio: 2025,
      projecao,
    })
    expect(resNeg.caixaNegativo).toBe(true)
    expect(resNeg.linhas.find((l) => l.chave === 'caixa')!.projetado).toBeLessThan(0)
  })
})

describe('calcularBalancoProjetado — parâmetros da projeção (integração profunda)', () => {
  function projecaoComParametros(
    parametros?: Parameters<typeof calcularProjecaoDre>[3],
  ): ProjecaoResultado {
    // DRE: 3 meses com movimento; receita 100k/mês, despesa variável 40k/mês, fixa 30k/mês
    const lancamentos: LancamentoRecord[] = []
    for (let m = 1; m <= 3; m++) {
      lancamentos.push(lancamento(`l-rec-${m}`, 'pc-rec', 100000, m))
      lancamentos.push(lancamento(`l-desp-var-${m}`, 'pc-desp-var', 40000, m))
      lancamentos.push(lancamento(`l-desp-fix-${m}`, 'pc-desp-fix', 30000, m))
    }
    const matriz = calcularDreGerencialMatriz(
      lancamentos,
      [contaRec, contaDesp, contaFix],
      meses2025,
      [],
    )
    const matrizVaziaAnterior = calcularDreGerencialMatriz(
      [],
      [contaRec, contaDesp, contaFix],
      gerarListaMeses(2024, 1, 12),
      [],
    )
    return calcularProjecaoDre(matriz, matrizVaziaAnterior, meses2025, parametros)
  }

  it('com crescimento 5% a.m. o PL projetado sobe (lucro maior) e o fechamento se mantém', () => {
    const pMed = projecaoComParametros({ modo: 'media_mensal', percentualCrescimento: 0 })
    const pCres = projecaoComParametros({ modo: 'crescimento', percentualCrescimento: 5 })
    const balMed = calcularBalancoProjetado({
      balancos: [balancoBase],
      exercicio: 2025,
      projecao: pMed,
    })
    const balCres = calcularBalancoProjetado({
      balancos: [balancoBase],
      exercicio: 2025,
      projecao: pCres,
    })

    // Lucro do ano maior → PL projetado maior
    expect(pCres.lucroPrejuizoTotalAno).toBeGreaterThan(pMed.lucroPrejuizoTotalAno)
    expect(balCres.lucroProjetadoUsado).toBe(pCres.lucroPrejuizoTotalAno)
    const plMed = calcularSubtotaisBalanço(balMed).find((s) => s.chave === 'secao_pl')!
    const plCres = calcularSubtotaisBalanço(balCres).find((s) => s.chave === 'secao_pl')!
    expect(plCres.projetado).toBeGreaterThan(plMed.projetado)

    // Nota metodológica do PL reflete o método ativo
    const linhaLucrosCres = balCres.linhas.find((l) => l.chave === 'lucros_acumulados')!
    expect(linhaLucrosCres.notaMetodo).toContain('crescimento de 5% a.m.')
    expect(balCres.descricaoMetodoDre).toContain('crescimento de 5% a.m.')
  })

  it('fechamento Ativo = Passivo + PL com parâmetro ajustado (5% e -10%)', () => {
    for (const parametros of [
      { modo: 'crescimento' as const, percentualCrescimento: 5 },
      { modo: 'crescimento' as const, percentualCrescimento: -10 },
    ]) {
      const balRes = calcularBalancoProjetado({
        balancos: [balancoBase],
        exercicio: 2025,
        projecao: projecaoComParametros(parametros),
      })
      expect(balRes.diferencaFechamento).toBeLessThan(0.01)
      expect(balRes.ativoTotalProjetado).toBeCloseTo(balRes.passivoPlTotalProjetado, 2)
      // Caixa continua sendo a linha de fechamento
      const caixa = balRes.linhas.find((l) => l.chave === 'caixa')!
      expect(caixa.projetado).toBeCloseTo(balRes.caixaDerivadoBruto + balRes.ajusteFechamento, 2)
    }
  })

  it('PL projetado = PL realizado + lucro recalculado com o parâmetro', () => {
    const pCres = projecaoComParametros({ modo: 'crescimento', percentualCrescimento: 5 })
    const balRes = calcularBalancoProjetado({
      balancos: [balancoBase],
      exercicio: 2025,
      projecao: pCres,
    })
    const plRealizado = 175000 // capital 100k + reservas 20k + acumulados 55k
    const plProj = calcularSubtotaisBalanço(balRes).find((s) => s.chave === 'secao_pl')!
    expect(plProj.projetado).toBeCloseTo(plRealizado + pCres.lucroPrejuizoTotalAno, 2)
  })

  it('capital de giro reage à receita projetada ajustada (contas a receber 5% > média)', () => {
    const pMed = projecaoComParametros({ modo: 'media_mensal', percentualCrescimento: 0 })
    const pCres = projecaoComParametros({ modo: 'crescimento', percentualCrescimento: 5 })
    const balMed = calcularBalancoProjetado({
      balancos: [balancoBase],
      exercicio: 2025,
      projecao: pMed,
    })
    const balCres = calcularBalancoProjetado({
      balancos: [balancoBase],
      exercicio: 2025,
      projecao: pCres,
    })
    const crMed = balMed.linhas.find((l) => l.chave === 'contas_receber')!.projetado
    const crCres = balCres.linhas.find((l) => l.chave === 'contas_receber')!.projetado
    expect(crCres).toBeGreaterThan(crMed)
  })
})
