import { describe, it, expect } from 'vitest'
import {
  calcularPontoEquilibrio,
  classificarMargemSeguranca,
  getClassesMargemSeguranca,
} from './pontoEquilibrioCalculo'
import type { ContaRecord, LancamentoRecord, PlanoContaRecord } from '@/types/finance'

const MES_JAN = '2026-01'
const MES_FEV = '2026-02'

const contasMock: ContaRecord[] = [
  {
    id: 'c-rec',
    collectionId: 'contas',
    collectionName: 'contas',
    user: 'u-1',
    nome: 'Receita de Vendas',
    tipo: 'Receita',
    classificacao_dre: 'Receita',
    created: '',
  },
  {
    id: 'c-var',
    collectionId: 'contas',
    collectionName: 'contas',
    user: 'u-1',
    nome: 'Impostos sobre venda',
    tipo: 'Despesa',
    classificacao_dre: 'Despesa Variável',
    created: '',
  },
  {
    id: 'c-fix',
    collectionId: 'contas',
    collectionName: 'contas',
    user: 'u-1',
    nome: 'Aluguel',
    tipo: 'Despesa',
    classificacao_dre: 'Despesa Fixa',
    created: '',
  },
]

const planosMock: PlanoContaRecord[] = contasMock.map((c, i) => ({
  id: `p-${c.id}`,
  collectionId: 'plano_contas',
  collectionName: 'plano_contas',
  user: 'u-1',
  conta: c.id,
  centro: `cc-${i}`,
  created: '',
}))

function lanc(
  ano: number,
  mes: number,
  dia: number,
  conta: string,
  valor: number,
): LancamentoRecord {
  return {
    id: `l-${conta}-${ano}-${mes}-${dia}`,
    collectionId: 'lancamentos',
    collectionName: 'lancamentos',
    empresa: 'emp-1',
    plano_conta: `p-${conta}`,
    data: `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`,
    valor,
    user: 'u-1',
    created: '',
  }
}

describe('calcularPontoEquilibrio', () => {
  it('calcula PE mês a mês: fixas ÷ margem %, resultado e margem de segurança', () => {
    const lancamentos: LancamentoRecord[] = [
      // Jan: receita 100.000, variáveis 50.000 → MC 50.000 (50%); fixas 20.000
      // PE = 20.000 / 0,50 = 40.000 → margem segurança = (100.000−40.000)/100.000 = 60%
      lanc(2026, 1, 10, 'c-rec', 100000),
      lanc(2026, 1, 15, 'c-var', 50000),
      lanc(2026, 1, 25, 'c-fix', 20000),
      // Fev: receita 60.000, variáveis 36.000 → MC 24.000 (40%); fixas 20.000
      // PE = 20.000 / 0,40 = 50.000 → segurança = (60.000−50.000)/60.000 ≈ 16,67%
      lanc(2026, 2, 10, 'c-rec', 60000),
      lanc(2026, 2, 15, 'c-var', 36000),
      lanc(2026, 2, 25, 'c-fix', 20000),
    ]

    const res = calcularPontoEquilibrio({
      lancamentos,
      contas: contasMock,
      planoContas: planosMock,
      anoAtual: 2026,
    })

    expect(res.mesesAnoAtivo).toHaveLength(12)
    expect(res.anoAtivo).not.toBeNull()
    const meses = res.anoAtivo!.meses
    expect(meses).toHaveLength(12)

    const jan = meses[0]
    expect(jan.chave).toBe(MES_JAN)
    expect(jan.receita).toBe(100000)
    expect(jan.despesasVariaveis).toBe(50000)
    expect(jan.despesasFixas).toBe(20000)
    expect(jan.margemValor).toBe(50000)
    expect(jan.margemPercentual).toBeCloseTo(50, 5)
    expect(jan.pontoEquilibrio).toBeCloseTo(40000, 5)
    expect(jan.resultado).toBe(30000)
    expect(jan.margemSegurancaPercentual).toBeCloseTo(60, 5)
    expect(jan.grauAlavancagemOperacional).toBeCloseTo(50000 / 30000, 5)
    expect(jan.posicao).toBe('acima')
    expect(jan.temMovimento).toBe(true)

    const fev = meses[1]
    expect(fev.receita).toBe(60000)
    expect(fev.despesasFixas).toBe(20000)
    expect(fev.margemPercentual).toBeCloseTo(40, 5)
    expect(fev.pontoEquilibrio).toBeCloseTo(50000, 5)
    expect(fev.resultado).toBe(4000)
    expect(fev.margemSegurancaPercentual).toBeCloseTo(100 / 6, 5)
    expect(fev.posicao).toBe('acima')

    // Totais do ano
    const anoAtivo = res.anoAtivo!
    expect(anoAtivo.totalReceita).toBe(160000)
    expect(anoAtivo.totalDespesasVariaveis).toBe(86000)
    expect(anoAtivo.totalDespesasFixas).toBe(40000)
    expect(anoAtivo.margemTotal).toBe(74000)
    expect(anoAtivo.margemAnualPercentual).toBeCloseTo(46.25, 5)
    // PE anual = 40.000 / 0,4625 = 86.486,48...
    expect(anoAtivo.pontoEquilibrioAnual).toBeCloseTo(40000 / 0.4625, 3)
    expect(anoAtivo.resultadoAnual).toBe(34000)
    expect(anoAtivo.grauAlavancagemAnual).toBeCloseTo(74000 / 34000, 5)
    expect(anoAtivo.temDados).toBe(true)
    expect(anoAtivo.temDespesasFixas).toBe(true)
  })

  it('mês sem movimento devolve null em PE/margem/segurança (nunca zero enganoso)', () => {
    const lancamentos: LancamentoRecord[] = [
      lanc(2026, 1, 10, 'c-rec', 100000),
      lanc(2026, 1, 15, 'c-var', 50000),
      lanc(2026, 1, 25, 'c-fix', 20000),
    ]
    const res = calcularPontoEquilibrio({
      lancamentos,
      contas: contasMock,
      planoContas: planosMock,
      anoAtual: 2026,
    })
    const marco = res.anoAtivo!.meses[2] // março sem lançamentos
    expect(marco.chave).toBe('2026-03')
    expect(marco.receita).toBe(0)
    expect(marco.despesasFixas).toBe(0)
    expect(marco.pontoEquilibrio).toBeNull()
    expect(marco.margemSegurancaPercentual).toBeNull()
    expect(marco.grauAlavancagemOperacional).toBeNull()
    expect(marco.temMovimento).toBe(false)
    expect(marco.posicao).toBe('sem-movimento')
  })

  it('margem % zero ou negativa → PE null (não divide por zero) e posição sem-pe', () => {
    const lancamentos: LancamentoRecord[] = [
      // Jan: receita 50.000, variáveis 60.000 → MC −10.000 (margem negativa)
      lanc(2026, 1, 10, 'c-rec', 50000),
      lanc(2026, 1, 15, 'c-var', 60000),
      lanc(2026, 1, 25, 'c-fix', 20000),
      // Fev: receita 0, variáveis 0 — só despesa fixa: tem movimento, sem PE
      lanc(2026, 2, 25, 'c-fix', 20000),
    ]
    const res = calcularPontoEquilibrio({
      lancamentos,
      contas: contasMock,
      planoContas: planosMock,
      anoAtual: 2026,
    })
    const jan = res.anoAtivo!.meses[0]
    expect(jan.margemPercentual).toBeCloseTo(-20, 5)
    expect(jan.pontoEquilibrio).toBeNull()
    expect(jan.margemSegurancaPercentual).toBeNull()
    expect(jan.grauAlavancagemOperacional).toBeNull()
    expect(jan.posicao).toBe('sem-pe')

    const fev = res.anoAtivo!.meses[1]
    expect(fev.temMovimento).toBe(true)
    expect(fev.despesasFixas).toBe(20000)
    expect(fev.pontoEquilibrio).toBeNull()
    expect(fev.posicao).toBe('sem-pe')
  })

  it('prejuízo (abaixo do PE) e GAO null quando resultado negativo', () => {
    const lancamentos: LancamentoRecord[] = [
      // Receita 30.000, variáveis 15.000 (MC 50%), fixas 20.000 → PE 40.000 > receita
      lanc(2026, 1, 10, 'c-rec', 30000),
      lanc(2026, 1, 15, 'c-var', 15000),
      lanc(2026, 1, 25, 'c-fix', 20000),
    ]
    const res = calcularPontoEquilibrio({
      lancamentos,
      contas: contasMock,
      planoContas: planosMock,
      anoAtual: 2026,
    })
    const jan = res.anoAtivo!.meses[0]
    expect(jan.pontoEquilibrio).toBeCloseTo(40000, 5)
    expect(jan.posicao).toBe('abaixo')
    expect(jan.resultado).toBe(-5000)
    expect(jan.margemSegurancaPercentual).toBeCloseTo(-25, 5)
    expect(jan.grauAlavancagemOperacional).toBeNull()
    expect(res.anoAtivo!.resultadoAnual).toBe(-5000)
    expect(res.anoAtivo!.grauAlavancagemAnual).toBeNull()
    // Margem de segurança negativa é classificada como vermelho
    expect(classificarMargemSeguranca(jan.margemSegurancaPercentual)).toBe('vermelho')
  })

  it('janela de anos do mais recente ao mais antigo, com anoAtivo correto', () => {
    const lancamentos: LancamentoRecord[] = [
      lanc(2025, 1, 10, 'c-rec', 100000),
      lanc(2025, 1, 20, 'c-var', 30000),
      lanc(2025, 1, 25, 'c-fix', 10000),
      lanc(2026, 1, 10, 'c-rec', 110000),
      lanc(2026, 1, 20, 'c-var', 22000),
      lanc(2026, 1, 25, 'c-fix', 12000),
    ]
    const res = calcularPontoEquilibrio({
      lancamentos,
      contas: contasMock,
      planoContas: planosMock,
      anoAtual: 2026,
    })
    expect(res.anos.map((a) => a.ano)).toEqual([2026, 2025])
    expect(res.anoAtivo!.ano).toBe(2026)
    expect(res.temDados).toBe(true)
  })

  it('base vazia devolve resultado sem dados (estado vazio honesto)', () => {
    const res = calcularPontoEquilibrio({
      lancamentos: [],
      contas: contasMock,
      planoContas: planosMock,
      anoAtual: 2026,
    })
    expect(res.temDados).toBe(false)
    expect(res.anoAtivo!.temDados).toBe(false)
    expect(res.anoAtivo!.meses).toHaveLength(12)
    expect(res.temDespesasFixas).toBe(false)
  })
})

describe('classificarMargemSeguranca', () => {
  it('verde >= 25%, âmbar 10-25%, vermelho < 10%', () => {
    expect(classificarMargemSeguranca(30)).toBe('verde')
    expect(classificarMargemSeguranca(25)).toBe('verde')
    expect(classificarMargemSeguranca(15)).toBe('ambar')
    expect(classificarMargemSeguranca(9.9)).toBe('vermelho')
    expect(classificarMargemSeguranca(-5)).toBe('vermelho')
  })

  it('neutro para null/undefined/NaN', () => {
    expect(classificarMargemSeguranca(null)).toBe('neutro')
    expect(classificarMargemSeguranca(undefined)).toBe('neutro')
    expect(classificarMargemSeguranca(Number.NaN)).toBe('neutro')
  })

  it('classes CSS cobrem os quatro estados', () => {
    expect(getClassesMargemSeguranca(30).texto).toContain('emerald')
    expect(getClassesMargemSeguranca(15).texto).toContain('amber')
    expect(getClassesMargemSeguranca(5).texto).toContain('rose')
    expect(getClassesMargemSeguranca(null).texto).toContain('slate')
  })
})
