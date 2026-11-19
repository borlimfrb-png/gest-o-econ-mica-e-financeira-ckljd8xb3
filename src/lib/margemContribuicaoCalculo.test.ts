import { describe, it, expect } from 'vitest'
import { calcularMargemContribuicao, classificarVariacaoMargem } from './margemContribuicaoCalculo'
import { gerarListaMeses } from './dreGerencialTypes'
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
    id: 'c-mat',
    collectionId: 'contas',
    collectionName: 'contas',
    user: 'u-1',
    nome: 'Matéria-prima',
    tipo: 'Despesa',
    classificacao_dre: 'Despesa Variável',
    created: '',
  },
  {
    id: 'c-fix',
    collectionId: 'contas',
    collectionName: 'contas',
    user: 'u-1',
    nome: 'Aluguel (não entra na MC)',
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

describe('calcularMargemContribuicao', () => {
  it('calcula margem mês a mês (R$ e %) e ignora despesa fixa', () => {
    const lancamentos: LancamentoRecord[] = [
      // Jan: receita 100.000, variáveis 17.000 + 33.000 = 50.000 → MC 50.000 (50%)
      lanc(2026, 1, 10, 'c-rec', 100000),
      lanc(2026, 1, 15, 'c-var', 17000),
      lanc(2026, 1, 20, 'c-mat', 33000),
      // Despesa fixa não entra no cálculo da margem de contribuição
      lanc(2026, 1, 25, 'c-fix', 99999),
      // Fev: receita 120.000, variáveis 20.400 → MC 99.600 (83%)
      lanc(2026, 2, 10, 'c-rec', 120000),
      lanc(2026, 2, 15, 'c-var', 20400),
    ]

    const res = calcularMargemContribuicao({
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
    expect(jan.margemValor).toBe(50000)
    expect(jan.margemPercentual).toBeCloseTo(50, 5)
    expect(jan.temMovimento).toBe(true)

    const fev = meses[1]
    expect(fev.receita).toBe(120000)
    expect(fev.despesasVariaveis).toBe(20400)
    expect(fev.margemValor).toBe(99600)
    expect(fev.margemPercentual).toBeCloseTo(83, 5)

    const anoAtivo = res.anoAtivo!
    expect(anoAtivo.totalReceita).toBe(220000)
    expect(anoAtivo.totalDespesasVariaveis).toBe(70400)
    expect(anoAtivo.margemTotal).toBe(149600)
    expect(anoAtivo.margemAnualPercentual).toBeCloseTo(68, 5)
    expect(anoAtivo.temDados).toBe(true)
  })

  it('mês sem movimento devolve zeros e margemPercentual null (nunca zero enganoso)', () => {
    const lancamentos: LancamentoRecord[] = [
      lanc(2026, 1, 10, 'c-rec', 100000),
      lanc(2026, 1, 15, 'c-var', 10000),
    ]
    const res = calcularMargemContribuicao({
      lancamentos,
      contas: contasMock,
      planoContas: planosMock,
      anoAtual: 2026,
    })
    const marco = res.anoAtivo!.meses[2] // março sem lançamentos
    expect(marco.chave).toBe('2026-03')
    expect(marco.receita).toBe(0)
    expect(marco.despesasVariaveis).toBe(0)
    expect(marco.margemValor).toBe(0)
    expect(marco.margemPercentual).toBeNull()
    expect(marco.temMovimento).toBe(false)
  })

  it('compara anos anteriores da base com variação em p.p. vs ano anterior', () => {
    const lancamentos: LancamentoRecord[] = [
      // 2025: receita 100.000, variável 30.000 → margem 70%
      lanc(2025, 1, 10, 'c-rec', 100000),
      lanc(2025, 1, 20, 'c-var', 30000),
      // 2026: receita 110.000, variável 22.000 → margem 80%
      lanc(2026, 1, 10, 'c-rec', 110000),
      lanc(2026, 1, 20, 'c-var', 22000),
    ]
    const res = calcularMargemContribuicao({
      lancamentos,
      contas: contasMock,
      planoContas: planosMock,
      anoAtual: 2026,
    })

    // Janela do mais recente ao mais antigo, anoAtual incluído
    expect(res.anos.map((a) => a.ano)).toEqual([2026, 2025])

    const item2026 = res.anos.find((a) => a.ano === 2026)!
    const item2025 = res.anos.find((a) => a.ano === 2025)!
    expect(item2026.margemAnualPercentual).toBeCloseTo(80, 5)
    expect(item2025.margemAnualPercentual).toBeCloseTo(70, 5)
    // 80% − 70% = +10 p.p.
    expect(item2026.variacaoPpAnoAnterior).toBeCloseTo(10, 5)

    expect(res.anoAtivo!.ano).toBe(2026)
  })

  it('variação p.p. fica null quando o ano anterior não tem receita (sem base)', () => {
    const lancamentos: LancamentoRecord[] = [
      // 2026 com dados; 2024 apenas despesa variável (sem receita)
      lanc(2026, 1, 10, 'c-rec', 100000),
      lanc(2026, 1, 15, 'c-var', 20000),
      lanc(2024, 6, 15, 'c-var', 5000),
    ]
    const res = calcularMargemContribuicao({
      lancamentos,
      contas: contasMock,
      planoContas: planosMock,
      anoAtual: 2026,
    })
    const item2024 = res.anos.find((a) => a.ano === 2024)!
    expect(item2024.margemAnualPercentual).toBeNull()
    expect(item2024.temDados).toBe(true)
    // 2024 não tem 2023 na base → sem variação
    expect(item2024.variacaoPpAnoAnterior).toBeNull()
  })

  it('base vazia devolve resultado sem dados (estado vazio honesto)', () => {
    const res = calcularMargemContribuicao({
      lancamentos: [],
      contas: contasMock,
      planoContas: planosMock,
      anoAtual: 2026,
    })
    expect(res.temDados).toBe(false)
    expect(res.anoAtivo!.temDados).toBe(false)
    expect(res.anoAtivo!.meses).toHaveLength(12)
  })
})

describe('classificarVariacaoMargem', () => {
  it('melhora quando positivo, piora quando negativo, neutro em volta de zero', () => {
    expect(classificarVariacaoMargem(10)).toBe('melhora')
    expect(classificarVariacaoMargem(-0.5)).toBe('piora')
    expect(classificarVariacaoMargem(0.01)).toBe('neutro')
  })

  it('neutro para null/undefined/NaN', () => {
    expect(classificarVariacaoMargem(null)).toBe('neutro')
    expect(classificarVariacaoMargem(undefined)).toBe('neutro')
    expect(classificarVariacaoMargem(Number.NaN)).toBe('neutro')
  })
})

describe('gerarListaMeses (contrato usado pela lib)', () => {
  it('assinatura (ano, mesInicial, qtdMeses) — jan a dez', () => {
    const meses = gerarListaMeses(2026, 1, 12)
    expect(meses).toHaveLength(12)
    expect(meses[0].chave).toBe(MES_JAN)
    expect(meses[11].chave).toBe('2026-12')
    expect(meses[0].rotuloCurto).toBe('Jan/26')
  })
})
