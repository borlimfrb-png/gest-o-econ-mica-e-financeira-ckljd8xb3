/**
 * Cálculos de cenários nomeados da Formação de Preço de Serviços:
 * aplicação dos fatores do cenário sobre os parâmetros vigentes e
 * comparativo base × cenário (preço sugerido, mark-up e margem).
 * Funções puras — sem dependência de PocketBase.
 */

import {
  calcularHoraTecnica,
  calcularPrecoServico,
  type ComposicaoPrecoServico,
  type ParametrosFormacaoServicos,
  type ServicoFormacao,
} from './formacaoPrecoServicosCalculo'

/** Parâmetros ajustáveis de um cenário nomeado (JSON na coleção). */
export interface ParametrosCenario {
  /** Margem alvo absoluta do cenário (%) — substitui a vigente */
  percentual_margem: number
  /** Impostos absolutos do cenário (%) — substitui a vigente */
  percentual_impostos: number
  /** Comissão absoluta do cenário (%) — substitui a vigente */
  percentual_comissao: number
  /** Multiplicador aplicado sobre os custos fixos vigentes (1 = igual) */
  fator_custos_fixos: number
  /** Multiplicador aplicado sobre o custo direto de cada serviço (1 = igual) */
  fator_custos_diretos: number
  /** Multiplicador aplicado sobre as horas produtivas por profissional (1 = igual) */
  fator_horas: number
}

/** Cenário neutro: reflete exatamente os parâmetros vigentes. */
export const CENARIO_BASE: ParametrosCenario = {
  percentual_margem: 0,
  percentual_impostos: 0,
  percentual_comissao: 0,
  fator_custos_fixos: 1,
  fator_custos_diretos: 1,
  fator_horas: 1,
}

/** Converte os parâmetros do cenário em parâmetros de cálculo do motor. */
export function aplicarCenarioAosParametros(
  base: ParametrosFormacaoServicos,
  cenario: ParametrosCenario,
): ParametrosFormacaoServicos {
  return {
    ...base,
    percentual_margem: Number(cenario.percentual_margem) || 0,
    percentual_impostos: Number(cenario.percentual_impostos) || 0,
    percentual_comissao: Number(cenario.percentual_comissao) || 0,
    custos_fixos: (base.custos_fixos || []).map((cf) => ({
      nome: cf.nome,
      valor: (Number(cf.valor) || 0) * (Number(cenario.fator_custos_fixos) || 1),
    })),
    horas_produtivas_profissional:
      (Number(base.horas_produtivas_profissional) || 0) * (Number(cenario.fator_horas) || 1),
    quantidade_profissionais: base.quantidade_profissionais,
    fator_ociosidade: base.fator_ociosidade,
    regime_tributario: base.regime_tributario,
  }
}

/** Serviço com custo direto reescalado pelo fator do cenário. */
export function aplicarCenarioAoServico(
  servico: ServicoFormacao,
  cenario: ParametrosCenario,
): ServicoFormacao {
  return {
    ...servico,
    custo_direto: (Number(servico.custo_direto) || 0) * (Number(cenario.fator_custos_diretos) || 1),
  }
}

export interface LinhaComparacaoCenario {
  nomeServico: string
  precoBase: number
  precoCenario: number
  deltaPreco: number
  markupBase: number
  markupCenario: number
  margemBasePct: number
  margemCenarioPct: number
  deltaMargemPp: number
}

export interface ResumoComparacaoCenario {
  linhas: LinhaComparacaoCenario[]
  totais: {
    precoBase: number
    precoCenario: number
    deltaPreco: number
    /** Multiplicador agregado base = preço total ÷ custo total (0 sem dados) */
    markupBase: number
    markupCenario: number
    margemBasePct: number
    margemCenarioPct: number
    deltaMargemPp: number
    /** Custo/hora técnico resultante em cada mundo */
    custoHoraBase: number
    custoHoraCenario: number
  }
}

/**
 * Compara o cenário base (parâmetros vigentes) com o cenário escolhido,
 * serviço a serviço e nos totais, com deltas coloríveis na UI.
 */
export function compararCenario(
  servicos: ServicoFormacao[],
  base: ParametrosFormacaoServicos,
  cenario: ParametrosCenario,
): ResumoComparacaoCenario {
  const paramCenario = aplicarCenarioAosParametros(base, cenario)
  const linhas: LinhaComparacaoCenario[] = servicos.map((servico) => {
    const servicoCenario = aplicarCenarioAoServico(servico, cenario)
    const cb = calcularPrecoServico(servico, base)
    const cc = calcularPrecoServico(servicoCenario, paramCenario)
    return {
      nomeServico: servico.nome,
      precoBase: cb.precoVendaSugerido,
      precoCenario: cc.precoVendaSugerido,
      deltaPreco: cc.precoVendaSugerido - cb.precoVendaSugerido,
      markupBase: cb.markupMultiplicador,
      markupCenario: cc.markupMultiplicador,
      margemBasePct: cb.margemEfetivaPct,
      margemCenarioPct: cc.margemEfetivaPct,
      deltaMargemPp: cc.margemEfetivaPct - cb.margemEfetivaPct,
    }
  })

  return {
    linhas,
    totais: agregar(
      servicos.map((servico) => {
        const servicoCenario = aplicarCenarioAoServico(servico, cenario)
        return {
          base: calcularPrecoServico(servico, base),
          cenario: calcularPrecoServico(servicoCenario, paramCenario),
        }
      }),
      base,
      paramCenario,
    ),
  }
}

/**
 * Totais agregados do comparativo: preços somados; mark-up e margem
 * ponderados pelo custo total de cada serviço (0 quando não há custo).
 */
function agregar(
  pares: Array<{ base: ComposicaoPrecoServico; cenario: ComposicaoPrecoServico }>,
  base: ParametrosFormacaoServicos,
  paramCenario: ParametrosFormacaoServicos,
): ResumoComparacaoCenario['totais'] {
  const precoBase = pares.reduce((a, p) => a + p.base.precoVendaSugerido, 0)
  const precoCenario = pares.reduce((a, p) => a + p.cenario.precoVendaSugerido, 0)
  const custoBase = pares.reduce((a, p) => a + p.base.custoTotalServico, 0)
  const custoCenario = pares.reduce((a, p) => a + p.cenario.custoTotalServico, 0)

  const markupBase = custoBase > 0 ? precoBase / custoBase : 0
  const markupCenario = custoCenario > 0 ? precoCenario / custoCenario : 0

  // Cada margem é ponderada pelo preço do seu próprio mundo.
  const margemBasePct =
    precoBase > 0
      ? pares.reduce((a, p) => a + p.base.margemEfetivaPct * p.base.precoVendaSugerido, 0) /
        precoBase
      : 0
  const margemCenarioPct =
    precoCenario > 0
      ? pares.reduce((a, p) => a + p.cenario.margemEfetivaPct * p.cenario.precoVendaSugerido, 0) /
        precoCenario
      : 0

  return {
    precoBase,
    precoCenario,
    deltaPreco: precoCenario - precoBase,
    markupBase,
    markupCenario,
    margemBasePct,
    margemCenarioPct,
    deltaMargemPp: margemCenarioPct - margemBasePct,
    custoHoraBase: calcularHoraTecnica(base).custoHoraTecnica,
    custoHoraCenario: calcularHoraTecnica(paramCenario).custoHoraTecnica,
  }
}
