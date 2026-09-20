import type { BalancoRecord, DreRecord } from '@/types/finance'
import { calcularBalanco, calcularDre } from '@/lib/financeCalculations'

export type MultiploKey = 'ev_ebitda' | 'pl' | 'pvp' | 'ev_receita' | 'ev_ebit' | 'p_ebitda'

export interface MultiploConfigSetor {
  ev_ebitda: number
  pl: number
  pvp: number
  ev_receita: number
  ev_ebit: number
  p_ebitda: number
}

// Benchmarks brasileiros plausíveis por setor
export const MULTIPLOS_SETORIAIS_PADRAO: Record<string, MultiploConfigSetor> = {
  Serviços: {
    ev_ebitda: 6.5,
    pl: 10.0,
    pvp: 2.2,
    ev_receita: 1.4,
    ev_ebit: 8.5,
    p_ebitda: 5.5,
  },
  Comércio: {
    ev_ebitda: 5.5,
    pl: 9.0,
    pvp: 1.6,
    ev_receita: 0.6,
    ev_ebit: 7.5,
    p_ebitda: 4.8,
  },
  Indústria: {
    ev_ebitda: 5.8,
    pl: 8.5,
    pvp: 1.4,
    ev_receita: 0.9,
    ev_ebit: 8.0,
    p_ebitda: 5.0,
  },
  Tecnologia: {
    ev_ebitda: 11.0,
    pl: 16.0,
    pvp: 3.8,
    ev_receita: 3.2,
    ev_ebit: 13.5,
    p_ebitda: 9.5,
  },
  Agronegócio: {
    ev_ebitda: 5.2,
    pl: 7.8,
    pvp: 1.2,
    ev_receita: 0.8,
    ev_ebit: 7.0,
    p_ebitda: 4.5,
  },
  Construção: {
    ev_ebitda: 4.8,
    pl: 7.0,
    pvp: 1.1,
    ev_receita: 0.7,
    ev_ebit: 6.5,
    p_ebitda: 4.2,
  },
  Saúde: {
    ev_ebitda: 7.5,
    pl: 12.0,
    pvp: 2.4,
    ev_receita: 1.6,
    ev_ebit: 9.8,
    p_ebitda: 6.5,
  },
  Educação: {
    ev_ebitda: 7.0,
    pl: 11.5,
    pvp: 2.0,
    ev_receita: 1.5,
    ev_ebit: 9.0,
    p_ebitda: 6.0,
  },
  Financeiro: {
    ev_ebitda: 8.0,
    pl: 9.5,
    pvp: 1.8,
    ev_receita: 2.0,
    ev_ebit: 9.5,
    p_ebitda: 7.0,
  },
  Outros: {
    ev_ebitda: 6.0,
    pl: 9.5,
    pvp: 1.7,
    ev_receita: 1.0,
    ev_ebit: 8.0,
    p_ebitda: 5.0,
  },
}

// Cache local em memória de múltiplos carregados dinamicamente da coleção `setores`
let cacheMultiplosDinamicos: Record<string, MultiploConfigSetor> = {}

export function registrarMultiplosDinamicos(
  lista: Array<{
    nome: string
    ev_ebitda: number
    pl: number
    pvp: number
    ev_receita: number
    ev_ebit: number
    p_ebitda: number
  }>,
) {
  if (!Array.isArray(lista)) return
  for (const item of lista) {
    if (!item?.nome) continue
    cacheMultiplosDinamicos[item.nome.trim()] = {
      setor: item.nome.trim(),
      ev_ebitda: Number(item.ev_ebitda) || 6.0,
      pl: Number(item.pl) || 9.5,
      pvp: Number(item.pvp) || 1.7,
      ev_receita: Number(item.ev_receita) || 1.0,
      ev_ebit: Number(item.ev_ebit) || 8.0,
      p_ebitda: Number(item.p_ebitda) || 5.0,
    }
  }
}

export function obterMultiplosPadraoSetor(segmento?: string | null): MultiploConfigSetor {
  if (!segmento) return MULTIPLOS_SETORIAIS_PADRAO['Serviços']
  const key = segmento.trim()
  if (cacheMultiplosDinamicos[key]) {
    return cacheMultiplosDinamicos[key]
  }
  // Procura case-insensitive no cache
  const lowerKey = key.toLowerCase()
  for (const [k, v] of Object.entries(cacheMultiplosDinamicos)) {
    if (k.toLowerCase() === lowerKey) return v
  }
  // Procura nos padrões estáticos
  return MULTIPLOS_SETORIAIS_PADRAO[segmento] || MULTIPLOS_SETORIAIS_PADRAO['Outros']
}

export interface ItemMultiploCalculado {
  key: MultiploKey
  nome: string
  sigla: string
  descricao: string
  tipoMetrica: 'Enterprise Value (EV)' | 'Equity Value (Preço)'
  nomeMetricaBase: string
  valorMetricaBase: number
  multiploReferencia: number
  valorCalculadoBruto: number // EV ou Equity Value direto
  valorImplícitoEmpresa: number // Valor final comparável (Equity Value ou EV total)
  pesoPercentual: number
  ativo: boolean
  explicacao: string
}

export interface ResumoConsolidadoMultiplos {
  itens: ItemMultiploCalculado[]
  itensAtivos: ItemMultiploCalculado[]
  // Estatísticas de centralidade
  valorPonderado: number
  valorMedio: number
  valorMediana: number
  valorMinimo: number
  valorMaximo: number
  faixaAmplitude: number
  somaPesosAtivos: number
  // Contexto financeiro
  dividaLiquida: number
  caixaEquivalentes: number
  passivoTotal: number
  ebitda: number
  ebit: number
  lucroLiquido: number
  patrimonioLiquido: number
  receitaBruta: number
  receitaLiquida: number
  temDados: boolean
}

export interface ParametrosCalculoMultiplos {
  balanco: BalancoRecord | null
  dre: DreRecord | null
  segmento?: string | null
  multiplosRef?: Partial<Record<MultiploKey, number>>
  pesos?: Partial<Record<MultiploKey, number>>
  multiplosAtivos?: Partial<Record<MultiploKey, boolean>>
  dividaLiquidaManual?: number
}

// Pesos padrão sugeridos (deve somar 100%)
export const PESOS_PADRAO: Record<MultiploKey, number> = {
  ev_ebitda: 35,
  pl: 25,
  pvp: 15,
  ev_receita: 10,
  ev_ebit: 10,
  p_ebitda: 5,
}

// Flags padrão de múltiplos ativos
export const ATIVOS_PADRAO: Record<MultiploKey, boolean> = {
  ev_ebitda: true,
  pl: true,
  pvp: true,
  ev_receita: true,
  ev_ebit: true,
  p_ebitda: true,
}

export function calcularMultiplosMercado(
  params: ParametrosCalculoMultiplos,
): ResumoConsolidadoMultiplos {
  const { balanco, dre, segmento, multiplosRef, pesos, multiplosAtivos, dividaLiquidaManual } =
    params

  const calcB = calcularBalanco(balanco)
  const calcD = calcularDre(dre)

  const defaultSetor = obterMultiplosPadraoSetor(segmento)

  const receitaBruta = dre?.receita_bruta || calcD.receitaLiquida + (dre?.deducoes_receita || 0)
  const receitaLiquida = calcD.receitaLiquida
  const baseReceita = receitaBruta > 0 ? receitaBruta : receitaLiquida
  const ebit = calcD.resultadoOperacional
  const ebitda = calcD.ebitda !== 0 ? calcD.ebitda : calcD.resultadoOperacional
  const lucroLiquido = calcD.lucroLiquido
  const patrimonioLiquido = calcB.patrimonioLiquido

  // Dívida Líquida contábil = Passivo Exigível (PC + PNC) - Caixa e Equivalentes - Aplicações
  const caixa = (balanco?.caixa_equivalentes || 0) + (balanco?.aplicacoes_financeiras || 0)
  const passivoTotal = calcB.passivoTotal
  const dividaLiquidaCalculada = passivoTotal - caixa
  const dividaLiquida =
    typeof dividaLiquidaManual === 'number' && !isNaN(dividaLiquidaManual)
      ? dividaLiquidaManual
      : dividaLiquidaCalculada

  const temDados = !!(balanco || dre)

  // Definição dos 6 múltiplos
  const defs: {
    key: MultiploKey
    nome: string
    sigla: string
    descricao: string
    tipoMetrica: 'Enterprise Value (EV)' | 'Equity Value (Preço)'
    nomeMetricaBase: string
    valorMetricaBase: number
    isEv: boolean
    explicacao: string
  }[] = [
    {
      key: 'ev_ebitda',
      nome: 'EV / EBITDA',
      sigla: 'EV/EBITDA',
      descricao: 'Valor da Firma sobre a Geração Operacional de Caixa',
      tipoMetrica: 'Enterprise Value (EV)',
      nomeMetricaBase: 'EBITDA (Geração de Caixa)',
      valorMetricaBase: ebitda,
      isEv: true,
      explicacao:
        'Indica quantos anos de EBITDA seriam necessários para recomprar o valor total da operação.',
    },
    {
      key: 'pl',
      nome: 'P/L (Preço / Lucro)',
      sigla: 'P/L',
      descricao: 'Valor de Mercado do Equity sobre o Lucro Líquido',
      tipoMetrica: 'Equity Value (Preço)',
      nomeMetricaBase: 'Lucro Líquido Anual',
      valorMetricaBase: lucroLiquido,
      isEv: false,
      explicacao:
        'Representa o tempo de retorno em anos para o acionista recuperar o capital investido pelo lucro gerado.',
    },
    {
      key: 'pvp',
      nome: 'P/VP (Preço / Valor Patrimonial)',
      sigla: 'P/VP',
      descricao: 'Valor de Mercado sobre o Patrimônio Líquido Contábil',
      tipoMetrica: 'Equity Value (Preço)',
      nomeMetricaBase: 'Patrimônio Líquido (PL)',
      valorMetricaBase: patrimonioLiquido,
      isEv: false,
      explicacao: 'Compara o valuation com a riqueza contábil tangível acumulada da empresa.',
    },
    {
      key: 'ev_receita',
      nome: 'EV / Receita Bruta',
      sigla: 'EV/Receita',
      descricao: 'Valor da Firma sobre o Faturamento Bruto',
      tipoMetrica: 'Enterprise Value (EV)',
      nomeMetricaBase: 'Receita Bruta (ou Líquida)',
      valorMetricaBase: baseReceita,
      isEv: true,
      explicacao:
        'Mede a valoração do porte da empresa em relação às suas vendas totais, ideal para empresas em expansão.',
    },
    {
      key: 'ev_ebit',
      nome: 'EV / EBIT',
      sigla: 'EV/EBIT',
      descricao: 'Valor da Firma sobre o Resultado Operacional',
      tipoMetrica: 'Enterprise Value (EV)',
      nomeMetricaBase: 'Resultado Operacional (EBIT)',
      valorMetricaBase: ebit,
      isEv: true,
      explicacao:
        'Avalia o negócio pela lucratividade operacional pura, desconsiderando alavancagem financeira e tributos.',
    },
    {
      key: 'p_ebitda',
      nome: 'P / EBITDA',
      sigla: 'P/EBITDA',
      descricao: 'Valor dos Sócios (Equity) sobre a Geração de Caixa',
      tipoMetrica: 'Equity Value (Preço)',
      nomeMetricaBase: 'EBITDA (Operacional)',
      valorMetricaBase: ebitda,
      isEv: false,
      explicacao:
        'Múltiplo de mercado direto relacionando o valor percebido pelos acionistas ao EBITDA da empresa.',
    },
  ]

  const itens: ItemMultiploCalculado[] = defs.map((d) => {
    const ref =
      multiplosRef?.[d.key] !== undefined && multiplosRef[d.key] !== null
        ? Number(multiplosRef[d.key])
        : defaultSetor[d.key]

    const peso =
      pesos?.[d.key] !== undefined && pesos[d.key] !== null
        ? Number(pesos[d.key])
        : PESOS_PADRAO[d.key]

    const ativo =
      multiplosAtivos?.[d.key] !== undefined ? !!multiplosAtivos[d.key] : ATIVOS_PADRAO[d.key]

    // Cálculo do valor implícito
    // Se a métrica for EV (EV/EBITDA, EV/Receita, EV/EBIT), Valor da Firma = ref * base
    // Para padronizar em Valor da Empresa comparável (Enterprise Value):
    // - Para múltiplos de EV: o valor implícito é diretamente o EV calculado
    // - Para múltiplos de Preço/Equity (P/L, P/VP, P/EBITDA): Equity Value = ref * base
    //   Para converter Equity Value em Enterprise Value: EV = Equity Value + Dívida Líquida
    // Assim, todos os métodos refletem o mesmo referencial homogêneo (Enterprise Value)
    const valorCalculadoBruto = ref * d.valorMetricaBase

    let valorImplícitoEmpresa = valorCalculadoBruto
    if (!d.isEv) {
      // Equity Value -> somar dívida líquida para obter EV compatível
      // Se a dívida líquida for muito negativa (caixa líquido), EV < Equity Value
      valorImplícitoEmpresa = valorCalculadoBruto + dividaLiquida
    }

    return {
      key: d.key,
      nome: d.nome,
      sigla: d.sigla,
      descricao: d.descricao,
      tipoMetrica: d.tipoMetrica,
      nomeMetricaBase: d.nomeMetricaBase,
      valorMetricaBase: d.valorMetricaBase,
      multiploReferencia: ref,
      valorCalculadoBruto,
      valorImplícitoEmpresa: Math.max(0, valorImplícitoEmpresa),
      pesoPercentual: peso,
      ativo,
      explicacao: d.explicacao,
    }
  })

  const itensAtivos = itens.filter((i) => i.ativo && i.valorImplícitoEmpresa > 0)
  const somaPesosAtivos = itensAtivos.reduce((acc, curr) => acc + curr.pesoPercentual, 0)

  // Média ponderada
  let valorPonderado = 0
  if (somaPesosAtivos > 0) {
    const somaPond = itensAtivos.reduce(
      (acc, curr) => acc + curr.valorImplícitoEmpresa * (curr.pesoPercentual / somaPesosAtivos),
      0,
    )
    valorPonderado = somaPond
  } else if (itensAtivos.length > 0) {
    valorPonderado =
      itensAtivos.reduce((acc, curr) => acc + curr.valorImplícitoEmpresa, 0) / itensAtivos.length
  }

  // Média simples
  const valorMedio =
    itensAtivos.length > 0
      ? itensAtivos.reduce((acc, curr) => acc + curr.valorImplícitoEmpresa, 0) / itensAtivos.length
      : 0

  // Mediana
  let valorMediana = 0
  if (itensAtivos.length > 0) {
    const sorted = [...itensAtivos].sort(
      (a, b) => a.valorImplícitoEmpresa - b.valorImplícitoEmpresa,
    )
    const mid = Math.floor(sorted.length / 2)
    if (sorted.length % 2 === 0) {
      valorMediana = (sorted[mid - 1].valorImplícitoEmpresa + sorted[mid].valorImplícitoEmpresa) / 2
    } else {
      valorMediana = sorted[mid].valorImplícitoEmpresa
    }
  }

  // Mínimo e Máximo
  const valores = itensAtivos.map((i) => i.valorImplícitoEmpresa)
  const valorMinimo = valores.length > 0 ? Math.min(...valores) : 0
  const valorMaximo = valores.length > 0 ? Math.max(...valores) : 0
  const faixaAmplitude = valorMaximo - valorMinimo

  return {
    itens,
    itensAtivos,
    valorPonderado,
    valorMedio,
    valorMediana,
    valorMinimo,
    valorMaximo,
    faixaAmplitude,
    somaPesosAtivos,
    dividaLiquida,
    caixaEquivalentes: caixa,
    passivoTotal,
    ebitda,
    ebit,
    lucroLiquido,
    patrimonioLiquido,
    receitaBruta,
    receitaLiquida,
    temDados,
  }
}

// Parecer comparativo entre os três métodos
export interface ComparativoTresMetodos {
  fcd: {
    nome: string
    valor: number
    valido: boolean
    descricao: string
    pesoSugerido: number
  }
  superlucro: {
    nome: string
    valor: number
    valido: boolean
    descricao: string
    pesoSugerido: number
  }
  multiplos: {
    nome: string
    valor: number
    valido: boolean
    descricao: string
    pesoSugerido: number
  }
  faixaGeralMin: number
  faixaGeralMax: number
  valorCentralTriplo: number
  metodoMaisIndicado: 'fcd' | 'superlucro' | 'multiplos' | 'convergente'
  tituloParecer: string
  textoParecer: string
  recomendacaoNegociacao: string
}

export function gerarComparativoTresMetodos({
  valorFCD,
  valorSuperlucro,
  valorMultiplos,
  ebitda,
  lucroLiquido,
  patrimonioLiquido,
  segmento,
}: {
  valorFCD: number
  valorSuperlucro: number
  valorMultiplos: number
  ebitda: number
  lucroLiquido: number
  patrimonioLiquido: number
  segmento?: string
}): ComparativoTresMetodos {
  const metodosValidos: number[] = []
  const isFcdValido = valorFCD > 0
  const isSupValido = valorSuperlucro > 0
  const isMultValido = valorMultiplos > 0

  if (isFcdValido) metodosValidos.push(valorFCD)
  if (isSupValido) metodosValidos.push(valorSuperlucro)
  if (isMultValido) metodosValidos.push(valorMultiplos)

  const faixaGeralMin = metodosValidos.length > 0 ? Math.min(...metodosValidos) : 0
  const faixaGeralMax = metodosValidos.length > 0 ? Math.max(...metodosValidos) : 0
  const valorCentralTriplo =
    metodosValidos.length > 0
      ? metodosValidos.reduce((acc, v) => acc + v, 0) / metodosValidos.length
      : 0

  // Análise de aderência metodológica
  let metodoMaisIndicado: 'fcd' | 'superlucro' | 'multiplos' | 'convergente' = 'convergente'
  let tituloParecer = 'Equilíbrio Metodológico Multicritério'
  let textoParecer = ''
  let recomendacaoNegociacao = ''

  const dispersao = faixaGeralMin > 0 ? ((faixaGeralMax - faixaGeralMin) / faixaGeralMin) * 100 : 0

  if (ebitda > 0 && lucroLiquido > 0 && dispersao < 25) {
    metodoMaisIndicado = 'convergente'
    tituloParecer = 'Alta Convergência entre Métodos Intrínsecos e de Mercado'
    textoParecer = `Os três métodos de avaliação (Fluxo de Caixa Descontado, Superlucro Capitalizado e Múltiplos Setoriais de Mercado) apresentam elevada consistência, com dispersão inferior a 25%. Isso confere alto rigor técnico à precificação, indicando que a capacidade de geração de caixa futura está alinhada ao patrimônio e aos múltiplos de transações praticadas no setor de ${segmento || 'atuação'}.`
    recomendacaoNegociacao = `Adotar a média ponderada central em torno do valor de referência, utilizando o piso da faixa como salvaguarda e o teto para negociação com sinergias operacionais.`
  } else if (ebitda > 0 && ebitda > lucroLiquido * 1.5) {
    metodoMaisIndicado = 'multiplos'
    tituloParecer = 'Predomínio de Múltiplos de Mercado e Geração Operacional (EBITDA)'
    textoParecer = `Para a estrutura atual da empresa, onde o EBITDA operacional é expressivo frente aos encargos financeiros e depreciação, o método de Múltiplos de Mercado (especialmente EV/EBITDA e EV/Receita) reflete com precisão o apetite de mercado em operações de M&A no mercado brasileiro, balizado pelos comparáveis setoriais.`
    recomendacaoNegociacao = `Utilizar o Valuation por Múltiplos como base principal de ancoragem nas conversas com investidores, apresentando o FCD como comprovação da capacidade futura de sustentar o valuation.`
  } else if (patrimonioLiquido > 0 && lucroLiquido > 0) {
    metodoMaisIndicado = 'fcd'
    tituloParecer = 'Foco em Valor Intrínseco Fundamentalista (FCD Gordon)'
    textoParecer = `O método de Fluxo de Caixa Descontado (FCD) constitui o padrão-ouro acadêmico e institucional mais sólido para a empresa, pois captura a capacidade contínua de gerar caixa livre futuro aos investidores independente de oscilações conjunturais nos múltiplos de mercado.`
    recomendacaoNegociacao = `Recomenda-se estipular a faixa de negociação ancorada no FCD, com tolerância delimitada entre a mediana de múltiplos e o superlucro patrimonial.`
  } else {
    metodoMaisIndicado = 'superlucro'
    tituloParecer = 'Ancoragem no Patrimônio Líquido Ajustado e Goodwill'
    textoParecer = `Diante de volatilidade operacional momentânea, a metodologia do Superlucro (Goodwill) oferece uma âncora patrimonial segura, assegurando que o valor da empresa não seja subavaliado em relação ao capital próprio já consolidado no balanço.`
    recomendacaoNegociacao = `Definir o piso de negociação baseado no valor patrimonial (PL) somado ao goodwill apurado.`
  }

  return {
    fcd: {
      nome: 'Fluxo de Caixa Descontado (FCD)',
      valor: isFcdValido ? valorFCD : 0,
      valido: isFcdValido,
      descricao: 'Capacidade futura de geração de riqueza e perpetuidade',
      pesoSugerido: 40,
    },
    superlucro: {
      nome: 'Superlucro Capitalizado (Goodwill)',
      valor: isSupValido ? valorSuperlucro : 0,
      valido: isSupValido,
      descricao: 'Patrimônio Líquido contábil acrescido do excedente de lucro anormal',
      pesoSugerido: 25,
    },
    multiplos: {
      nome: 'Múltiplos de Mercado (Consolidado)',
      valor: isMultValido ? valorMultiplos : 0,
      valido: isMultValido,
      descricao: 'Comparáveis de transações setoriais ponderadas (EV/EBITDA, P/L, P/VP, etc.)',
      pesoSugerido: 35,
    },
    faixaGeralMin,
    faixaGeralMax,
    valorCentralTriplo,
    metodoMaisIndicado,
    tituloParecer,
    textoParecer,
    recomendacaoNegociacao,
  }
}
