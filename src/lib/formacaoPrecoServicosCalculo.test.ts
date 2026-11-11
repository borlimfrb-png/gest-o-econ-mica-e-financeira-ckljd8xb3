/// <reference types="vitest" />
import { describe, it, expect } from 'vitest'
import {
  calcularHoraTecnica,
  calcularPrecoServico,
  calcularSensibilidade,
  type ParametrosFormacaoServicos,
} from './formacaoPrecoServicosCalculo'

const PARAM_BASE: ParametrosFormacaoServicos = {
  custos_fixos: [
    { nome: 'Salários', valor: 15000 },
    { nome: 'Aluguel', valor: 3000 },
    { nome: 'Softwares', valor: 2000 },
  ],
  quantidade_profissionais: 2,
  horas_produtivas_profissional: 160,
  fator_ociosidade: 25, // 2 × 160 × 0,75 = 240h produtivas
  percentual_impostos: 10,
  percentual_comissao: 5,
  percentual_margem: 20,
}

const SERVICO_BASE = {
  horas_estimadas: 20,
  custo_direto: 500,
  profissionais_envolvidos: 1,
}

describe('calcularHoraTecnica', () => {
  it('soma os custos fixos e aplica o fator de ociosidade', () => {
    const r = calcularHoraTecnica(PARAM_BASE)
    expect(r.custosFixosMensais).toBe(20000)
    expect(r.horasProdutivasMes).toBeCloseTo(240, 6)
    expect(r.custoHoraTecnica).toBeCloseTo(20000 / 240, 6) // ≈ 83,33 R$/h
  })

  it('retorna hora técnica zero quando não há horas produtivas (evita divisão por zero)', () => {
    const r = calcularHoraTecnica({ ...PARAM_BASE, fator_ociosidade: 100 })
    expect(r.horasProdutivasMes).toBe(0)
    expect(r.custoHoraTecnica).toBe(0)
  })
})

describe('calcularPrecoServico', () => {
  it('calcula composição e preço pelo mark-up divisor', () => {
    const r = calcularPrecoServico(SERVICO_BASE, PARAM_BASE)
    const horaTecnica = 20000 / 240
    const maoDeObra = horaTecnica * 20
    const custoTotal = maoDeObra + 500

    expect(r.custoMaoDeObra).toBeCloseTo(maoDeObra, 6)
    expect(r.custoTotalServico).toBeCloseTo(custoTotal, 6)
    // Preço = custo ÷ (1 − (10+5+20)/100) = custo ÷ 0,65
    expect(r.precoVendaSugerido).toBeCloseTo(custoTotal / 0.65, 6)
    expect(r.markupDivisor).toBeCloseTo(1 / 0.65, 6)
    expect(r.markupMultiplicador).toBeCloseTo(custoTotal / 0.65 / custoTotal, 6)
    expect(r.precoVendaHora).toBeCloseTo(custoTotal / 0.65 / 20, 6)
  })

  it('decomposição soma exatamente o preço de venda', () => {
    const r = calcularPrecoServico(SERVICO_BASE, PARAM_BASE)
    const d = r.decomposicao
    const soma = d.maoDeObra + d.custosDiretos + d.rateioFixos + d.impostos + d.comissao + d.lucro
    expect(soma).toBeCloseTo(r.precoVendaSugerido, 6)
    expect(d.impostos).toBeCloseTo(r.precoVendaSugerido * 0.1, 6)
    expect(d.comissao).toBeCloseTo(r.precoVendaSugerido * 0.05, 6)
    expect(d.lucro).toBeCloseTo(r.precoVendaSugerido * 0.2, 6)
  })

  it('margem efetiva sobre o preço é igual à margem alvo (mark-up divisor)', () => {
    const r = calcularPrecoServico(SERVICO_BASE, PARAM_BASE)
    expect(r.margemEfetivaPct).toBeCloseTo(20, 6)
  })

  it('multiplica a mão de obra pelos profissionais envolvidos', () => {
    const r1 = calcularPrecoServico({ ...SERVICO_BASE, profissionais_envolvidos: 2 }, PARAM_BASE)
    const r2 = calcularPrecoServico(SERVICO_BASE, PARAM_BASE)
    expect(r1.custoMaoDeObra).toBeCloseTo(r2.custoMaoDeObra * 2, 6)
  })

  it('retorna preço zero quando (1 − %) não é positivo', () => {
    const r = calcularPrecoServico(SERVICO_BASE, { ...PARAM_BASE, percentual_margem: 100 })
    expect(r.precoVendaSugerido).toBe(0)
    expect(r.markupDivisor).toBe(0)
  })

  it('calcula ponto de equilíbrio em R$ e em horas de serviço', () => {
    const r = calcularPrecoServico(SERVICO_BASE, PARAM_BASE)
    expect(r.pontoEquilibrioValor).toBe(20000)
    expect(r.pontoEquilibrioHoras).toBeCloseTo(20000 / r.precoVendaHora, 6)
  })
})

describe('calcularSensibilidade', () => {
  it('retorna margens 10, 20 e 30% ordenadas', () => {
    const s = calcularSensibilidade(SERVICO_BASE, PARAM_BASE)
    expect(s.map((x) => x.margem)).toEqual([10, 20, 30])
    // Preço cresce com a margem
    expect(s[0].preco).toBeLessThan(s[1].preco)
    expect(s[1].preco).toBeLessThan(s[2].preco)
  })

  it('inclui a margem alvo quando difere de 10/20/30', () => {
    const s = calcularSensibilidade(SERVICO_BASE, { ...PARAM_BASE, percentual_margem: 25 })
    expect(s.map((x) => x.margem)).toEqual([10, 20, 25, 30])
  })
})
