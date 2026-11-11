import { describe, it, expect } from 'vitest'
import {
  calcularEstruturaPreco,
  calcularSensibilidadeComponentes,
  calcularComparativoServicos,
  calcularPainelMarkup,
  FAIXA_MARKUP_SAUDAVEL,
  type LinhaResumo,
} from './formacaoPrecoServicosRelatorios'
import {
  aplicarCenarioAosParametros,
  aplicarCenarioAoServico,
  compararCenario,
  custoHoraCenario,
  CENARIO_BASE,
  type ParametrosCenario,
} from './formacaoPrecoServicosCenarios'
import { calcularHoraTecnica, calcularPrecoServico } from './formacaoPrecoServicosCalculo'
import type { ParametrosFormacaoServicos } from './formacaoPrecoServicosCalculo'

const PARAM_BASE: ParametrosFormacaoServicos = {
  custos_fixos: [
    { nome: 'Salários', valor: 15000 },
    { nome: 'Aluguel', valor: 3000 },
    { nome: 'Softwares', valor: 2000 },
  ],
  quantidade_profissionais: 2,
  horas_produtivas_profissional: 160,
  fator_ociosidade: 25,
  percentual_impostos: 10,
  percentual_comissao: 5,
  percentual_margem: 20,
}

const SERVICO_A = {
  id: 'a',
  nome: 'Consultoria',
  horas_estimadas: 20,
  custo_direto: 500,
  profissionais_envolvidos: 1,
}

const SERVICO_B = {
  id: 'b',
  nome: 'Manutenção',
  horas_estimadas: 10,
  custo_direto: 200,
  profissionais_envolvidos: 1,
}

function linhas(): LinhaResumo[] {
  return [SERVICO_A, SERVICO_B].map((s) => ({
    servico: s,
    composicao: calcularPrecoServico(s, PARAM_BASE),
  }))
}

describe('calcularEstruturaPreco', () => {
  it('percentuais somam 100% e valor de cada item bate com o percentual', () => {
    const res = calcularEstruturaPreco(linhas())
    expect(res).toHaveLength(2)
    for (const r of res) {
      const soma = r.itens.reduce((acc, it) => acc + it.percentual, 0)
      expect(soma).toBeCloseTo(100, 4)
      for (const it of r.itens) {
        expect(it.percentual).toBeCloseTo((it.valor / r.precoVendaSugerido) * 100, 6)
      }
      expect(r.percentuais.lucro).toBeCloseTo(20, 4)
      expect(r.percentuais.impostos).toBeCloseTo(10, 4)
      expect(r.percentuais.comissao).toBeCloseTo(5, 4)
    }
  })

  it('retorna percentuais zero quando não há preço (estado vazio, não engana)', () => {
    const param = { ...PARAM_BASE, percentual_margem: 100 }
    const res = calcularEstruturaPreco(
      [SERVICO_A].map((s) => ({ servico: s, composicao: calcularPrecoServico(s, param) })),
    )
    expect(res[0].precoVendaSugerido).toBe(0)
    expect(res[0].itens.every((it) => it.percentual === 0)).toBe(true)
  })
})

describe('calcularSensibilidadeComponentes', () => {
  it('gera 6 cenários (impostos/comissão ±pp e custo/hora ±10%)', () => {
    const s = calcularSensibilidadeComponentes(SERVICO_A, PARAM_BASE)
    expect(s.cenarios).toHaveLength(6)
    expect(s.cenarios.map((c) => c.cenario)).toContain('Impostos +2pp')
    expect(s.cenarios.map((c) => c.cenario)).toContain('Custo/Hora −10%')
  })

  it('impostos +2pp reduz a margem efetiva e aumenta o preço', () => {
    const s = calcularSensibilidadeComponentes(SERVICO_A, PARAM_BASE)
    const up = s.cenarios.find((c) => c.cenario === 'Impostos +2pp')!
    expect(up.margemEfetivaPct).toBeCloseTo(s.margemBasePct, 6)
    expect(up.deltaPreco).toBeGreaterThan(0)
    const down = s.cenarios.find((c) => c.cenario === 'Impostos −2pp')!
    expect(down.deltaPreco).toBeLessThan(0)
    expect(down.deltaPreco).toBeCloseTo(-up.deltaPreco, 6)
  })

  it('custo/hora +10% aumenta o preço em ~10%', () => {
    const s = calcularSensibilidadeComponentes(SERVICO_A, PARAM_BASE)
    const up = s.cenarios.find((c) => c.cenario === 'Custo/Hora +10%')!
    expect(up.deltaPreco / s.precoBase).toBeCloseTo(0.1, 2)
  })
})

describe('calcularComparativoServicos', () => {
  it('ordena por margem e sinaliza abaixo da margem alvo', () => {
    const res = calcularComparativoServicos(linhas(), 20)
    expect(res[0].margemEfetivaPct).toBeGreaterThanOrEqual(res[1].margemEfetivaPct)
    expect(res.every((r) => r.abaixoDaMargemAlvo === false)).toBe(true)
    const res25 = calcularComparativoServicos(linhas(), 25)
    expect(res25.every((r) => r.abaixoDaMargemAlvo === true)).toBe(true)
    expect(res.map((r) => r.ranking)).toEqual([1, 2])
  })

  it('folga sobre o equilíbrio é preço/hora − hora técnica', () => {
    const res = calcularComparativoServicos(linhas(), 20)
    const horaT = calcularHoraTecnica(PARAM_BASE).custoHoraTecnica
    for (const r of res) {
      expect(r.folgaSobreEquilibrio).toBeCloseTo(r.precoHora - horaT, 6)
    }
  })
})

describe('calcularPainelMarkup', () => {
  it('multiplicador = divisor e decomposição soma o multiplicador', () => {
    const p = calcularPainelMarkup(linhas(), PARAM_BASE)
    expect(p.markupMultiplicador).not.toBeNull()
    expect(p.markupDivisor).not.toBeNull()
    expect(p.markupMultiplicador!).toBeCloseTo(p.markupDivisor!, 6)
    const dec = p.decomposicao!
    const soma =
      dec.parcelas.base +
      dec.parcelas.despesasFixasPct +
      dec.parcelas.impostosPct +
      dec.parcelas.comissaoPct +
      dec.parcelas.margemPct
    expect(soma).toBeCloseTo(p.markupMultiplicador!, 4)
    expect(dec.parcelas.margemPct).toBeCloseTo(0.2 / 0.65, 6)
  })

  it('retorna null sem serviços com preço (estado vazio — nunca zero)', () => {
    const param = { ...PARAM_BASE, percentual_margem: 100 }
    const res = calcularPainelMarkup(
      [SERVICO_A].map((s) => ({ servico: s, composicao: calcularPrecoServico(s, param) })),
      param,
    )
    expect(res.markupMultiplicador).toBeNull()
    expect(res.decomposicao).toBeNull()
    const vazio = calcularPainelMarkup([], PARAM_BASE)
    expect(vazio.markupMultiplicador).toBeNull()
  })

  it('faixa saudável definida', () => {
    expect(FAIXA_MARKUP_SAUDAVEL.min).toBe(1.3)
    expect(FAIXA_MARKUP_SAUDAVEL.max).toBe(2.5)
  })
})

describe('cenários', () => {
  it('cenário com percentuais vigentes e fatores 1 reproduz a base', () => {
    const neutro: ParametrosCenario = {
      percentual_margem: 20,
      percentual_impostos: 10,
      percentual_comissao: 5,
      fator_custos_fixos: 1,
      fator_custos_diretos: 1,
      fator_horas: 1,
    }
    const p = aplicarCenarioAosParametros(PARAM_BASE, neutro)
    expect(p.percentual_margem).toBe(20)
    expect(p.percentual_impostos).toBe(10)
    expect(p.percentual_comissao).toBe(5)
    expect(p.custos_fixos[0].valor).toBe(15000)
    expect(custoHoraCenario(PARAM_BASE, neutro)).toBeCloseTo(
      calcularHoraTecnica(PARAM_BASE).custoHoraTecnica,
      6,
    )
  })

  it('cenário base (neutro de fatores) mantém os custos', () => {
    const p = aplicarCenarioAosParametros(PARAM_BASE, CENARIO_BASE)
    expect(p.custos_fixos[0].valor).toBe(15000)
    expect(p.horas_produtivas_profissional).toBe(160)
  })

  it('aplica fatores de custo fixo, custo direto e horas', () => {
    const cen: ParametrosCenario = {
      ...CENARIO_BASE,
      fator_custos_fixos: 1.1,
      fator_custos_diretos: 1.2,
      fator_horas: 0.5,
    }
    const p = aplicarCenarioAosParametros(PARAM_BASE, cen)
    expect(p.custos_fixos[0].valor).toBeCloseTo(16500, 6)
    expect(p.horas_produtivas_profissional).toBeCloseTo(80, 6)
    const s = aplicarCenarioAoServico(SERVICO_A, cen)
    expect(s.custo_direto).toBeCloseTo(600, 6)
  })

  it('comparativo base × cenário: preço/margem mudam, delta coerente', () => {
    const cen: ParametrosCenario = { ...CENARIO_BASE, percentual_margem: 30 }
    const r = compararCenario([SERVICO_A, SERVICO_B], PARAM_BASE, cen)
    expect(r.linhas).toHaveLength(2)
    for (const l of r.linhas) {
      expect(l.margemCenarioPct).toBeCloseTo(30, 6)
      expect(l.deltaPreco).toBeCloseTo(l.precoCenario - l.precoBase, 6)
      expect(l.deltaPreco).toBeGreaterThan(0)
    }
    expect(r.totais.deltaPreco).toBeCloseTo(r.totais.precoCenario - r.totais.precoBase, 6)
    expect(r.totais.margemBasePct).toBeCloseTo(20, 4)
    expect(r.totais.margemCenarioPct).toBeCloseTo(30, 4)
    expect(r.totais.custoHoraBase).toBeCloseTo(20000 / 240, 6)
  })

  it('comparativo com lista vazia retorna totais zerados sem NaN', () => {
    const r = compararCenario([], PARAM_BASE, CENARIO_BASE)
    expect(r.linhas).toHaveLength(0)
    expect(r.totais.precoBase).toBe(0)
    expect(r.totais.margemBasePct).toBe(0)
    expect(Number.isNaN(r.totais.deltaMargemPp)).toBe(false)
  })
})
