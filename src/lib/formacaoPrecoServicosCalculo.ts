/**
 * Cálculos de Formação de Preço de Serviços (consultoria).
 * Funções puras — sem dependência de PocketBase — usadas pela tela
 * /formacao-preco/servicos e pelos testes unitários.
 */

export interface CustoFixoItem {
  nome: string
  valor: number
}

export interface ParametrosFormacaoServicos {
  custos_fixos: CustoFixoItem[]
  quantidade_profissionais: number
  horas_produtivas_profissional: number
  fator_ociosidade: number // % (0–100)
  percentual_impostos: number // % (0–100)
  percentual_comissao: number // % (0–100)
  percentual_margem: number // % (0–100)
  regime_tributario?: string
}

export interface ServicoFormacao {
  id?: string
  nome: string
  descricao?: string
  horas_estimadas: number
  custo_direto: number
  profissionais_envolvidos: number
}

export interface ComposicaoPrecoServico {
  /** Custos fixos mensais somados (R$/mês) */
  custosFixosMensais: number
  /** Horas produtivas mensais da equipe, já descontada a ociosidade */
  horasProdutivasMes: number
  /** Custo/Hora Técnica (R$/h) — custos fixos ÷ horas produtivas */
  custoHoraTecnica: number
  /** Mão de obra do serviço: hora técnica × horas estimadas × profissionais (R$) */
  custoMaoDeObra: number
  /** Custos diretos (materiais/terceiros) (R$) */
  custosDiretos: number
  /** Custo total do serviço: mão de obra + custos diretos */
  custoTotalServico: number
  /** Percentual de impostos sobre o preço (%) */
  impostosPct: number
  /** Percentual de comissão sobre o preço (%) */
  comissaoPct: number
  /** Percentual de margem de lucro alvo (%) */
  margemPct: number
  /** Mark-up divisor (fator): 1 ÷ (1 − (impostos+comissão+margem)/100) */
  markupDivisor: number
  /** Mark-up multiplicador sobre o custo (preço ÷ custo) */
  markupMultiplicador: number
  /** Preço de venda sugerido total do serviço (R$) */
  precoVendaSugerido: number
  /** Preço de venda sugerido por hora (R$/h) */
  precoVendaHora: number
  /** Decomposição do preço de venda (R$) — soma = preço de venda */
  decomposicao: {
    maoDeObra: number
    custosDiretos: number
    rateioFixos: number
    impostos: number
    comissao: number
    lucro: number
  }
  /** Margem efetiva sobre o preço de venda (%) */
  margemEfetivaPct: number
  /** Ponto de equilíbrio mensal em R$ (custos fixos mensais) */
  pontoEquilibrioValor: number
  /** Horas de serviço/mês para cobrir os custos fixos com o preço por hora */
  pontoEquilibrioHoras: number
}

const pct = (v: number) => (Number.isFinite(v) ? v / 100 : 0)

/**
 * Calcula o Custo/Hora Técnica: Custos Fixos Mensais ÷ Horas Produtivas.
 * Horas produtivas = profissionais × horas/mês × (1 − ociosidade%)
 */
export function calcularHoraTecnica(param: ParametrosFormacaoServicos): {
  custosFixosMensais: number
  horasProdutivasMes: number
  custoHoraTecnica: number
} {
  const custosFixosMensais = (param.custos_fixos || []).reduce(
    (acc, item) => acc + (Number(item?.valor) || 0),
    0,
  )
  const brutas =
    (Number(param.quantidade_profissionais) || 0) *
    (Number(param.horas_produtivas_profissional) || 0)
  const horasProdutivasMes = brutas * (1 - pct(param.fator_ociosidade))
  const custoHoraTecnica = horasProdutivasMes > 0 ? custosFixosMensais / horasProdutivasMes : 0
  return { custosFixosMensais, horasProdutivasMes, custoHoraTecnica }
}

/**
 * Calcula a composição completa do preço de venda sugerido de um serviço.
 * Preço = CustoTotal ÷ (1 − (impostos% + comissão% + margem%)/100)  (mark-up divisor)
 *
 * A mão de obra é hora técnica × horas estimadas × profissionais envolvidos.
 * O rateio dos custos fixos (parte do preço que cobre os custos fixos embutidos
 * na hora técnica) é a parcela da mão de obra correspondente ao(s) primeiro(s)
 * profissional(is) que o preço precisa recuperar — exibida em separado na
 * decomposição para o gráfico.
 */
export function calcularPrecoServico(
  servico: Pick<ServicoFormacao, 'horas_estimadas' | 'custo_direto' | 'profissionais_envolvidos'>,
  param: ParametrosFormacaoServicos,
): ComposicaoPrecoServico {
  const { custosFixosMensais, horasProdutivasMes, custoHoraTecnica } = calcularHoraTecnica(param)

  const horas = Number(servico.horas_estimadas) || 0
  const diretos = Number(servico.custo_direto) || 0
  const profissionais = Number(servico.profissionais_envolvidos) || 0
  const fatorEquipe = profissionais > 0 ? profissionais : 1

  const custoMaoDeObra = custoHoraTecnica * horas * fatorEquipe
  const custoTotalServico = custoMaoDeObra + diretos

  const impostosPct = Number(param.percentual_impostos) || 0
  const comissaoPct = Number(param.percentual_comissao) || 0
  const margemPct = Number(param.percentual_margem) || 0

  const somaPerc = (impostosPct + comissaoPct + margemPct) / 100
  const baseDivisor = 1 - somaPerc
  const precoVendaSugerido = baseDivisor > 0 ? custoTotalServico / baseDivisor : 0
  const markupDivisor = baseDivisor > 0 ? 1 / baseDivisor : 0
  const markupMultiplicador = custoTotalServico > 0 ? precoVendaSugerido / custoTotalServico : 0

  // Parcela da mão de obra que é o rateio dos custos fixos embutido na hora
  // técnica: (custos fixos mensais ÷ horas produtivas) já é o custo/hora, ou
  // seja, 100% da mão de obra é rateio de fixos quando só existe hora técnica.
  // Para o gráfico, separa a parte que recupera os fixos do mês do serviço.
  const parcelaHorasServico =
    horasProdutivasMes > 0 ? (horas * fatorEquipe) / horasProdutivasMes : 0
  const rateioFixos = Math.min(
    custoMaoDeObra,
    custosFixosMensais * Math.min(parcelaHorasServico, 1),
  )

  const decomposicao = {
    maoDeObra: Math.max(custoMaoDeObra - rateioFixos, 0),
    custosDiretos: diretos,
    rateioFixos,
    impostos: precoVendaSugerido * pct(impostosPct),
    comissao: precoVendaSugerido * pct(comissaoPct),
    lucro: precoVendaSugerido * pct(margemPct),
  }

  const precoVendaHora = horas > 0 ? precoVendaSugerido / horas : 0
  const margemEfetivaPct =
    precoVendaSugerido > 0 ? (decomposicao.lucro / precoVendaSugerido) * 100 : 0
  const pontoEquilibrioValor = custosFixosMensais
  const pontoEquilibrioHoras = precoVendaHora > 0 ? pontoEquilibrioValor / precoVendaHora : 0

  return {
    custosFixosMensais,
    horasProdutivasMes,
    custoHoraTecnica,
    custoMaoDeObra,
    custosDiretos: diretos,
    custoTotalServico,
    impostosPct,
    comissaoPct,
    margemPct,
    markupDivisor,
    markupMultiplicador,
    precoVendaSugerido,
    precoVendaHora,
    decomposicao,
    margemEfetivaPct,
    pontoEquilibrioValor,
    pontoEquilibrioHoras,
  }
}

/** Preços de sensibilidade para margens 10%, 20%, 30% e a margem alvo. */
export function calcularSensibilidade(
  servico: Pick<ServicoFormacao, 'horas_estimadas' | 'custo_direto' | 'profissionais_envolvidos'>,
  param: ParametrosFormacaoServicos,
): { margem: number; preco: number; precoHora: number }[] {
  const margens = [10, 20, 30]
  const alvo = Number(param.percentual_margem) || 0
  if (alvo > 0 && !margens.includes(alvo)) margens.push(alvo)
  margens.sort((a, b) => a - b)

  return margens.map((margem) => {
    const p = calcularPrecoServico(servico, { ...param, percentual_margem: margem })
    return { margem, preco: p.precoVendaSugerido, precoHora: p.precoVendaHora }
  })
}
