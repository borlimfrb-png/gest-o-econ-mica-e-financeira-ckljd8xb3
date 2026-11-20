import { describe, it, expect } from 'vitest'
import {
  classificarPercentualMetaDespesa,
  getClassesPercentualMetaDespesa,
  mapearMetasDespesaPorMes,
  mesclarMetasDespesaNoAno,
} from './pontoEquilibrioMetaDespesaComparativo'
import type { MetaDespesaMensalRecord } from '@/types/finance'

function registro(mes: number, valor: number, ano = 2026): MetaDespesaMensalRecord {
  return {
    id: `md-${ano}-${mes}`,
    collectionId: 'metas_despesa_mensal',
    collectionName: 'metas_despesa_mensal',
    empresa: 'emp-1',
    ano,
    mes,
    valor,
    user: 'u-1',
    created: '',
  }
}

// Campos da meta de receita que o ano já carrega quando chega ao comparativo
// de despesa (a tela mescla receita primeiro). Nos testes, sem metas de receita.
const semMetasReceita = {
  totalMeta: null,
  totalMetaDefinida: false,
  totalPercentualMeta: null,
  totalDiferencaMeta: null,
}

// Mês do cálculo do PE (o comparativo consome o tipo PontoEquilibrioMes)
const mesBase = {
  chave: '2026-01',
  rotuloCurto: 'Jan/26',
  mes: 1,
  receita: 100000,
  despesasVariaveis: 50000,
  despesasFixas: 18000,
  margemValor: 50000,
  margemPercentual: 50,
  pontoEquilibrio: 36000,
  resultado: 32000,
  margemSegurancaPercentual: 64,
  grauAlavancagemOperacional: 1.5625,
  posicao: 'acima' as const,
  temMovimento: true,
  // campos de meta de receita já mesclados pela tela antes do comparativo de despesa
  meta: null,
  percentualMeta: null,
  diferencaMeta: null,
  statusMeta: 'neutro' as const,
}

describe('classificarPercentualMetaDespesa (lógica invertida)', () => {
  it('verde quando realizado dentro/abaixo da meta (<= 100%)', () => {
    expect(classificarPercentualMetaDespesa(100)).toBe('verde')
    expect(classificarPercentualMetaDespesa(95)).toBe('verde')
    expect(classificarPercentualMetaDespesa(0)).toBe('verde')
  })

  it('âmbar até 10% acima da meta (100–110%) e vermelho acima disso', () => {
    expect(classificarPercentualMetaDespesa(100.01)).toBe('ambar')
    expect(classificarPercentualMetaDespesa(110)).toBe('ambar')
    expect(classificarPercentualMetaDespesa(110.01)).toBe('vermelho')
    expect(classificarPercentualMetaDespesa(150)).toBe('vermelho')
  })

  it('neutro para null/undefined/NaN', () => {
    expect(classificarPercentualMetaDespesa(null)).toBe('neutro')
    expect(classificarPercentualMetaDespesa(undefined)).toBe('neutro')
    expect(classificarPercentualMetaDespesa(Number.NaN)).toBe('neutro')
  })

  it('classes CSS cobrem os quatro estados', () => {
    expect(getClassesPercentualMetaDespesa(90).texto).toContain('emerald')
    expect(getClassesPercentualMetaDespesa(105).texto).toContain('amber')
    expect(getClassesPercentualMetaDespesa(120).texto).toContain('rose')
    expect(getClassesPercentualMetaDespesa(null).texto).toContain('slate')
  })
})

describe('mapearMetasDespesaPorMes', () => {
  it('indexa metas do ano por mês e ignora outros anos e valores zerados', () => {
    const mapa = mapearMetasDespesaPorMes(
      [registro(1, 18000), registro(2, 0), registro(3, 20000, 2025)],
      2026,
    )
    expect(mapa.size).toBe(1)
    expect(mapa.get(1)).toBe(18000)
    expect(mapa.has(2)).toBe(false)
  })
})

describe('mesclarMetasDespesaNoAno', () => {
  it('mescla metas por mês: %, diferença e status invertido', () => {
    const metas = new Map<number, number>([
      [1, 18000], // realizado 18.000 → 100% → verde
      [2, 18000], // realizado 19.800 → 110% → âmbar
      [3, 18000], // realizado 21.600 → 120% → vermelho
    ])
    const fev = {
      ...mesBase,
      chave: '2026-02',
      mes: 2,
      despesasFixas: 19800,
      margemSegurancaPercentual: null,
      pontoEquilibrio: null,
      grauAlavancagemOperacional: null,
      posicao: 'acima' as const,
    }
    const mar = {
      ...fev,
      chave: '2026-03',
      mes: 3,
      despesasFixas: 21600,
    }
    const anoFake = {
      ano: 2026,
      meses: [mesBase, fev, mar],
      totalReceita: 0,
      totalDespesasVariaveis: 0,
      totalDespesasFixas: 59400,
      margemTotal: 0,
      margemAnualPercentual: null,
      pontoEquilibrioAnual: null,
      resultadoAnual: 0,
      margemSegurancaAnualPercentual: null,
      grauAlavancagemAnual: null,
      temDados: true,
      temDespesasFixas: true,
      ...semMetasReceita,
    }

    const res = mesclarMetasDespesaNoAno(anoFake, metas)
    const [jan, fevRes, marRes] = res.meses

    expect(jan.metaDespesa).toBe(18000)
    expect(jan.percentualMetaDespesa).toBeCloseTo(100, 5)
    expect(jan.diferencaMetaDespesa).toBe(0)
    expect(jan.statusMetaDespesa).toBe('verde')

    expect(fevRes.percentualMetaDespesa).toBeCloseTo(110, 5)
    expect(fevRes.diferencaMetaDespesa).toBe(1800)
    expect(fevRes.statusMetaDespesa).toBe('ambar')

    expect(marRes.percentualMetaDespesa).toBeCloseTo(120, 5)
    expect(marRes.statusMetaDespesa).toBe('vermelho')

    expect(res.totalMetaDespesa).toBe(54000)
    expect(res.totalMetaDespesaDefinida).toBe(true)
    expect(res.totalPercentualMetaDespesa).toBeCloseTo(110, 5)
    expect(res.totalDiferencaMetaDespesa).toBe(5400)
  })

  it('sem meta → null em tudo ("—" nunca zero) e totais null', () => {
    const anoFake = {
      ano: 2026,
      meses: [{ ...mesBase }],
      totalReceita: 100000,
      totalDespesasVariaveis: 50000,
      totalDespesasFixas: 18000,
      margemTotal: 50000,
      margemAnualPercentual: 50,
      pontoEquilibrioAnual: 36000,
      resultadoAnual: 32000,
      margemSegurancaAnualPercentual: 64,
      grauAlavancagemAnual: 1.5625,
      temDados: true,
      temDespesasFixas: true,
      ...semMetasReceita,
    }
    const res = mesclarMetasDespesaNoAno(anoFake, new Map())
    const m = res.meses[0]
    expect(m.metaDespesa).toBeNull()
    expect(m.percentualMetaDespesa).toBeNull()
    expect(m.diferencaMetaDespesa).toBeNull()
    expect(m.statusMetaDespesa).toBe('neutro')
    expect(res.totalMetaDespesa).toBeNull()
    expect(res.totalPercentualMetaDespesa).toBeNull()
    expect(res.totalDiferencaMetaDespesa).toBeNull()
  })

  it('mês sem movimento com meta → realizado null ("—"), não zero', () => {
    const anoFake = {
      ano: 2026,
      meses: [{ ...mesBase, temMovimento: false, despesasFixas: 0 }],
      totalReceita: 0,
      totalDespesasVariaveis: 0,
      totalDespesasFixas: 0,
      margemTotal: 0,
      margemAnualPercentual: null,
      pontoEquilibrioAnual: null,
      resultadoAnual: 0,
      margemSegurancaAnualPercentual: null,
      grauAlavancagemAnual: null,
      temDados: false,
      temDespesasFixas: false,
      ...semMetasReceita,
    }
    const res = mesclarMetasDespesaNoAno(anoFake, new Map([[1, 18000]]))
    const m = res.meses[0]
    expect(m.metaDespesa).toBe(18000)
    expect(m.percentualMetaDespesa).toBeNull()
    expect(m.diferencaMetaDespesa).toBeNull()
    expect(m.statusMetaDespesa).toBe('neutro')
    expect(res.totalPercentualMetaDespesa).toBeNull() // sem despesa realizada no ano
    expect(res.totalMetaDespesa).toBe(18000)
  })

  it('não altera campos do cálculo do PE (receita, fixas, PE, segurança, GAO)', () => {
    const anoFake = {
      ano: 2026,
      meses: [{ ...mesBase }],
      totalReceita: 100000,
      totalDespesasVariaveis: 50000,
      totalDespesasFixas: 18000,
      margemTotal: 50000,
      margemAnualPercentual: 50,
      pontoEquilibrioAnual: 36000,
      resultadoAnual: 32000,
      margemSegurancaAnualPercentual: 64,
      grauAlavancagemAnual: 1.5625,
      temDados: true,
      temDespesasFixas: true,
      ...semMetasReceita,
    }
    const res = mesclarMetasDespesaNoAno(anoFake, new Map([[1, 18000]]))
    const m = res.meses[0]
    expect(m.receita).toBe(100000)
    expect(m.despesasFixas).toBe(18000)
    expect(m.pontoEquilibrio).toBe(36000)
    expect(m.margemSegurancaPercentual).toBe(64)
    expect(m.grauAlavancagemOperacional).toBe(1.5625)
    expect(m.posicao).toBe('acima')
  })
})
