/**
 * Cálculos de relatórios da Formação de Preço de Serviços (estrutura de
 * preço, sensibilidade, comparativo) e do painel visual de mark-up.
 * Funções puras — sem dependência de PocketBase — complementam o motor
 * src/lib/formacaoPrecoServicosCalculo.ts.
 */

import {
  calcularPrecoServico,
  type ComposicaoPrecoServico,
  type ParametrosFormacaoServicos,
  type ServicoFormacao,
} from './formacaoPrecoServicosCalculo'

export type { ParametrosFormacaoServicos, ServicoFormacao, ComposicaoPrecoServico }

/** Linha pronta da aba Resumo (serviço + composição calculada). */
export interface LinhaResumo {
  servico: ServicoFormacao
  composicao: ComposicaoPrecoServico
}

// ---------------------------------------------------------------------------
// Relatório 1 — Estrutura de Preço
// ---------------------------------------------------------------------------

export interface ItemEstruturaPreco {
  chave: string
  rotulo: string
  valor: number
  percentual: number
}

export interface EstruturaPrecoServico {
  servicoId: string
  nomeServico: string
  precoVendaSugerido: number
  itens: ItemEstruturaPreco[]
  /** Percentuais para o gráfico de barras empilhadas */
  percentuais: {
    maoDeObra: number
    custosDiretos: number
    rateioFixos: number
    impostos: number
    comissao: number
    lucro: number
  }
}

/**
 * Composição percentual do preço de venda de cada serviço:
 * mão de obra (excedente), custos diretos, fixos rateados, impostos,
 * comissão e margem. Soma dos percentuais = 100%.
 */
export function calcularEstruturaPreco(linhas: LinhaResumo[]): EstruturaPrecoServico[] {
  return linhas.map(({ servico, composicao: c }) => {
    const d = c.decomposicao
    const total = c.precoVendaSugerido
    const itens: ItemEstruturaPreco[] = [
      { chave: 'maoDeObra', rotulo: 'Mão de Obra', valor: d.maoDeObra },
      { chave: 'custosDiretos', rotulo: 'Custos Diretos', valor: d.custosDiretos },
      { chave: 'rateioFixos', rotulo: 'Fixos Rateados', valor: d.rateioFixos },
      { chave: 'impostos', rotulo: 'Impostos', valor: d.impostos },
      { chave: 'comissao', rotulo: 'Comissão', valor: d.comissao },
      { chave: 'lucro', rotulo: 'Margem (Lucro)', valor: d.lucro },
    ].map((it) => ({
      ...it,
      percentual: total > 0 ? (it.valor / total) * 100 : 0,
    }))

    return {
      servicoId: servico.id || '',
      nomeServico: servico.nome,
      precoVendaSugerido: c.precoVendaSugerido,
      itens,
      percentuais: {
        maoDeObra: itens[0].percentual,
        custosDiretos: itens[1].percentual,
        rateioFixos: itens[2].percentual,
        impostos: itens[3].percentual,
        comissao: itens[4].percentual,
        lucro: itens[5].percentual,
      },
    }
  })
}

// ---------------------------------------------------------------------------
// Relatório 2 — Sensibilidade de Preço
// ---------------------------------------------------------------------------

/** Cenário de sensibilidade aplicado a um serviço. */
export interface CenarioSensibilidade {
  /** Rótulo do cenário (ex.: "Impostos +2pp") */
  cenario: string
  componente: 'impostos' | 'comissao' | 'custoHora'
  /** Variação aplicada: +2, -2, +10, -10 … */
  variacao: number
  precoSugerido: number
  precoHora: number
  margemEfetivaPct: number
  /** Delta do preço vs cenário base (R$) */
  deltaPreco: number
  /** Delta da margem vs cenário base (pp) */
  deltaMargemPp: number
}

export interface SensibilidadeServico {
  servicoId: string
  nomeServico: string
  precoBase: number
  margemBasePct: number
  cenarios: CenarioSensibilidade[]
}

const VARIACOES: Array<{
  componente: 'impostos' | 'comissao' | 'custoHora'
  rotulo: string
  delta: number
  unidade: 'pp' | '%'
}> = [
  { componente: 'impostos', rotulo: 'Impostos +2pp', delta: +2, unidade: 'pp' },
  { componente: 'impostos', rotulo: 'Impostos −2pp', delta: -2, unidade: 'pp' },
  { componente: 'comissao', rotulo: 'Comissão +1pp', delta: +1, unidade: 'pp' },
  { componente: 'comissao', rotulo: 'Comissão −1pp', delta: -1, unidade: 'pp' },
  { componente: 'custoHora', rotulo: 'Custo/Hora +10%', delta: +10, unidade: '%' },
  { componente: 'custoHora', rotulo: 'Custo/Hora −10%', delta: -10, unidade: '%' },
]

/**
 * Impacto no preço sugerido e na margem efetiva ao variar impostos (±2pp),
 * comissão (±1pp) e custo/hora (±10%) — a partir dos parâmetros vigentes.
 */
export function calcularSensibilidadeComponentes(
  servico: ServicoFormacao,
  param: ParametrosFormacaoServicos,
): SensibilidadeServico {
  const base = calcularPrecoServico(servico, param)

  const cenarios: CenarioSensibilidade[] = VARIACOES.map(({ componente, rotulo, delta }) => {
    let paramVariado = { ...param }
    if (componente === 'impostos') {
      paramVariado.percentual_impostos = Math.max(0, param.percentual_impostos + delta)
    } else if (componente === 'comissao') {
      paramVariado.percentual_comissao = Math.max(0, param.percentual_comissao + delta)
    } else {
      // Custo/Hora: multiplica os custos fixos (fonte da hora técnica)
      const fator = 1 + delta / 100
      paramVariado = {
        ...paramVariado,
        custos_fixos: (param.custos_fixos || []).map((cf) => ({
          nome: cf.nome,
          valor: (Number(cf.valor) || 0) * fator,
        })),
      }
    }
    const c = calcularPrecoServico(servico, paramVariado)
    return {
      cenario: rotulo,
      componente,
      variacao: delta,
      precoSugerido: c.precoVendaSugerido,
      precoHora: c.precoVendaHora,
      margemEfetivaPct: c.margemEfetivaPct,
      deltaPreco: c.precoVendaSugerido - base.precoVendaSugerido,
      deltaMargemPp: c.margemEfetivaPct - base.margemEfetivaPct,
    }
  })

  return {
    servicoId: servico.id || '',
    nomeServico: servico.nome,
    precoBase: base.precoVendaSugerido,
    margemBasePct: base.margemEfetivaPct,
    cenarios,
  }
}

// ---------------------------------------------------------------------------
// Relatório 3 — Comparativo de Serviços
// ---------------------------------------------------------------------------

export interface LinhaComparativoServico {
  servicoId: string
  nomeServico: string
  custoTotal: number
  precoSugerido: number
  precoHora: number
  pontoEquilibrioHora: number
  margemEfetivaPct: number
  markupDivisor: number
  /** Diferença: preço sugerido − ponto de equilíbrio por hora (colchão sobre os fixos) */
  folgaSobreEquilibrio: number
  abaixoDaMargemAlvo: boolean
  ranking: number
}

/**
 * Ranking dos serviços por margem efetiva (decrescente) com destaque dos
 * abaixo da margem alvo. Sem campo de preço praticado, compara o preço
 * sugerido com o ponto de equilíbrio por hora (custos fixos ÷ preço/hora).
 */
export function calcularComparativoServicos(
  linhas: LinhaResumo[],
  margemAlvoPct: number,
): LinhaComparativoServico[] {
  const ordenadas = [...linhas].sort(
    (a, b) => b.composicao.margemEfetivaPct - a.composicao.margemEfetivaPct,
  )
  return ordenadas.map(({ servico, composicao: c }, idx) => ({
    servicoId: servico.id || '',
    nomeServico: servico.nome,
    custoTotal: c.custoTotalServico,
    precoSugerido: c.precoVendaSugerido,
    precoHora: c.precoVendaHora,
    pontoEquilibrioHora: c.pontoEquilibrioHoras,
    margemEfetivaPct: c.margemEfetivaPct,
    markupDivisor: c.markupDivisor,
    folgaSobreEquilibrio: c.precoVendaHora - c.pontoEquilibrioHoras,
    abaixoDaMargemAlvo: c.margemEfetivaPct < margemAlvoPct,
    ranking: idx + 1,
  }))
}

// ---------------------------------------------------------------------------
// Painel de mark-up (gauge + decomposição do multiplicador)
// ---------------------------------------------------------------------------

export interface DecomposicaoMarkup {
  /** Mark-up multiplicador total (1 + parcelas) */
  markupMultiplicador: number
  /** Mark-up divisor equivalente 1/(1−soma%) — null quando soma >= 100% */
  markupDivisor: number | null
  parcelas: {
    base: number
    despesasFixasPct: number
    impostosPct: number
    comissaoPct: number
    margemPct: number
  }
  /** Divergência divisor vs multiplicador (%) — null quando não calculável */
  divergenciaPct: number | null
}

export interface PainelMarkupResultado {
  /** null = sem dados (mostra “—” e estado vazio) */
  markupMultiplicador: number | null
  markupDivisor: number | null
  decomposicao: DecomposicaoMarkup | null
  somaPerc: number
}

/**
 * Painel do mark-up: multiplicador atual (média ponderada pelos custos dos
 * serviços com preço > 0) contra a faixa saudável [1,3 – 2,5]×, decomposição
 * do multiplicador em parcelas percentuais e badge divisor vs multiplicador.
 */
export function calcularPainelMarkup(
  linhas: LinhaResumo[],
  param: ParametrosFormacaoServicos,
): PainelMarkupResultado {
  const impostosPct = Number(param.percentual_impostos) || 0
  const comissaoPct = Number(param.percentual_comissao) || 0
  const margemPct = Number(param.percentual_margem) || 0
  const somaPerc = impostosPct + comissaoPct + margemPct

  const divisor = somaPerc < 100 ? 1 / (1 - somaPerc / 100) : null

  // Multiplicador real: média ponderada dos serviços com preço > 0
  const comPreco = linhas.filter((l) => l.composicao.precoVendaSugerido > 0)
  if (comPreco.length === 0 || divisor === null) {
    return {
      markupMultiplicador: null,
      markupDivisor: divisor,
      decomposicao: null,
      somaPerc,
    }
  }

  const pesoTotal = comPreco.reduce((acc, l) => acc + l.composicao.custoTotalServico, 0)
  const multiplicador =
    pesoTotal > 0
      ? comPreco.reduce(
          (acc, l) => acc + l.composicao.markupMultiplicador * l.composicao.custoTotalServico,
          0,
        ) / pesoTotal
      : null

  if (multiplicador === null) {
    return { markupMultiplicador: null, markupDivisor: divisor, decomposicao: null, somaPerc }
  }

  // Decomposição teórica do multiplicador: 1 + despesas fixas rateadas +
  // impostos% + comissão% + margem% (sobre o preço, reescala pelo divisor).
  const baseDivisor = 1 - somaPerc / 100
  const despesasFixasPct =
    pesoTotal > 0
      ? comPreco.reduce((acc, l) => acc + l.composicao.decomposicao.rateioFixos, 0) / pesoTotal
      : 0
  const parcelas = {
    base: 1,
    despesasFixasPct,
    impostosPct: impostosPct / 100 / baseDivisor,
    comissaoPct: comissaoPct / 100 / baseDivisor,
    margemPct: margemPct / 100 / baseDivisor,
  }

  // Divergência: multiplicador vs divisor — devem coincidir quando todos os
  // serviços têm preço > 0 (divisor é o teórico, multiplicador o realizado).
  const divergenciaPct = divisor > 0 ? ((multiplicador - divisor) / divisor) * 100 : null

  return {
    markupMultiplicador: multiplicador,
    markupDivisor: divisor,
    decomposicao: {
      markupMultiplicador: multiplicador,
      markupDivisor: divisor,
      parcelas,
      divergenciaPct,
    },
    somaPerc,
  }
}

/** Faixa saudável do mark-up multiplicador para serviços. */
export const FAIXA_MARKUP_SAUDAVEL = { min: 1.3, max: 2.5 }
