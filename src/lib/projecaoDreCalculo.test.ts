import { describe, it, expect } from 'vitest'
import type { ContaRecord, LancamentoRecord } from '@/types/finance'
import {
  calcularProjecaoDre,
  PARAMETROS_PROJECAO_PADRAO,
  rotuloCurtoMetodoProjecaoDre,
  descricaoMetodoProjecaoDre,
} from './projecaoDreCalculo'
import { calcularDreGerencialMatriz } from './dreGerencialCalculo'
import { gerarListaMeses } from './dreGerencialTypes'

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

const contaDespVar: ContaRecord = {
  id: 'c-desp-var',
  collectionId: 'contas',
  collectionName: 'contas',
  nome: 'Materiais',
  tipo: 'Despesa',
  classificacao_dre: 'Despesa Variável',
  created: '',
} as unknown as ContaRecord

const contaDespFix: ContaRecord = {
  id: 'c-desp-fix',
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
        conta: planoContaId,
        created: '',
        expand: {
          conta:
            planoContaId === 'pc-rec'
              ? contaRec
              : planoContaId === 'pc-desp-var'
                ? contaDespVar
                : contaDespFix,
        },
      },
    },
  } as unknown as LancamentoRecord
}

/** 3 meses com movimento: receita 100k, desp. variável 40k, desp. fixa 30k por mês. */
function montarMatriz2025() {
  const lancamentos: LancamentoRecord[] = []
  for (let m = 1; m <= 3; m++) {
    lancamentos.push(lancamento(`l-rec-${m}`, 'pc-rec', 100000, m))
    lancamentos.push(lancamento(`l-desp-var-${m}`, 'pc-desp-var', 40000, m))
    lancamentos.push(lancamento(`l-desp-fix-${m}`, 'pc-desp-fix', 30000, m))
  }
  const matriz = calcularDreGerencialMatriz(
    lancamentos,
    [contaRec, contaDespVar, contaDespFix],
    meses2025,
    [],
  )
  const matrizVaziaAnterior = calcularDreGerencialMatriz(
    [],
    [contaRec, contaDespVar, contaDespFix],
    gerarListaMeses(2024, 1, 12),
    [],
  )
  return { matriz, matrizVaziaAnterior }
}

function projecaoCom(parametros?: Parameters<typeof calcularProjecaoDre>[3]) {
  const { matriz, matrizVaziaAnterior } = montarMatriz2025()
  return calcularProjecaoDre(matriz, matrizVaziaAnterior, meses2025, parametros)
}

describe('calcularProjecaoDre — parâmetros', () => {
  it('sem parâmetros = padrão (média mensal, 0%)', () => {
    const res = projecaoCom()
    expect(res.parametrosAplicados).toEqual(PARAMETROS_PROJECAO_PADRAO)
  })

  it('modo média mensal: meses projetados = média fixa (comportamento atual preservado)', () => {
    const res = projecaoCom({ modo: 'media_mensal', percentualCrescimento: 0 })
    const receita = res.grupos.find((g) => g.classificacao === 'Receita')!
    // meses 1..3 realizados (100k cada); 4..12 projetados = média 100k
    expect(receita.valoresPorMes['2025-01']).toBe(100000)
    expect(receita.valoresPorMes['2025-04']).toBe(100000)
    expect(receita.valoresPorMes['2025-12']).toBe(100000)
    expect(receita.projetadoTotal).toBe(9 * 100000)
    // meses realizados intactos
    expect(receita.realizadoTotal).toBe(300000)
  })

  it('modo crescimento 0% = idêntico à média mensal', () => {
    const media = projecaoCom({ modo: 'media_mensal', percentualCrescimento: 0 })
    const cresc0 = projecaoCom({ modo: 'crescimento', percentualCrescimento: 0 })
    expect(cresc0.grupos.map((g) => g.valoresPorMes)).toEqual(
      media.grupos.map((g) => g.valoresPorMes),
    )
    expect(cresc0.lucroPrejuizoTotalAno).toBe(media.lucroPrejuizoTotalAno)
  })

  it('modo crescimento 5%: mês projetado n = média × 1,05^n (composição)', () => {
    const res = projecaoCom({ modo: 'crescimento', percentualCrescimento: 5 })
    const receita = res.grupos.find((g) => g.classificacao === 'Receita')!
    const fator = 1.05
    expect(receita.valoresPorMes['2025-04']).toBeCloseTo(100000 * Math.pow(fator, 1), 2)
    expect(receita.valoresPorMes['2025-05']).toBeCloseTo(100000 * Math.pow(fator, 2), 2)
    expect(receita.valoresPorMes['2025-12']).toBeCloseTo(100000 * Math.pow(fator, 9), 2)
    // meses realizados nunca mudam
    expect(receita.valoresPorMes['2025-01']).toBe(100000)
    expect(receita.realizadoTotal).toBe(300000)
  })

  it('modo crescimento 5% aumenta o lucro projetado (receita cresce, média da despesa também)', () => {
    const media = projecaoCom({ modo: 'media_mensal', percentualCrescimento: 0 })
    const cresc = projecaoCom({ modo: 'crescimento', percentualCrescimento: 5 })
    expect(cresc.receitaProjetada).toBeGreaterThan(media.receitaProjetada)
    expect(cresc.lucroPrejuizoProjetado).toBeGreaterThan(media.lucroPrejuizoProjetado)
    // total = realizado + projetado
    expect(cresc.lucroPrejuizoTotalAno).toBeCloseTo(
      cresc.lucroPrejuizoRealizado + cresc.lucroPrejuizoProjetado,
      2,
    )
    expect(cresc.lucroPrejuizoRealizado).toBe(media.lucroPrejuizoRealizado)
  })

  it('crescimento negativo reduz a receita projetada', () => {
    const res = projecaoCom({ modo: 'crescimento', percentualCrescimento: -10 })
    const receita = res.grupos.find((g) => g.classificacao === 'Receita')!
    expect(receita.valoresPorMes['2025-04']).toBeCloseTo(100000 * Math.pow(0.9, 1), 2)
    expect(res.receitaProjetada).toBeLessThan(9 * 100000)
  })

  it('percentual não-finite cai no padrão (0%) sem quebrar', () => {
    const res = projecaoCom({ modo: 'crescimento', percentualCrescimento: NaN })
    expect(res.parametrosAplicados.percentualCrescimento).toBe(0)
    const receita = res.grupos.find((g) => g.classificacao === 'Receita')!
    expect(receita.valoresPorMes['2025-04']).toBe(100000)
  })

  it('rótulos do método refletem o modo ativo', () => {
    expect(rotuloCurtoMetodoProjecaoDre(PARAMETROS_PROJECAO_PADRAO)).toBe('média mensal')
    expect(descricaoMetodoProjecaoDre(PARAMETROS_PROJECAO_PADRAO)).toContain('média mensal')
    const p = { modo: 'crescimento' as const, percentualCrescimento: 5 }
    expect(rotuloCurtoMetodoProjecaoDre(p)).toBe('crescimento de 5% a.m.')
    expect(descricaoMetodoProjecaoDre(p)).toBe(
      'projetada com crescimento de 5% a.m. sobre a média dos meses realizados',
    )
  })
})
