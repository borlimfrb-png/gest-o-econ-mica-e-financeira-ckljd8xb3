import type { DreMatrizResultado, MesItem, ClassificacaoDre } from './dreGerencialTypes'
import {
  GRUPOS_DRE_ORDEM,
  TITULOS_GRUPOS_DRE,
  SINAL_MULTIPLICADOR_GRUPO,
} from './dreGerencialTypes'

export type { ClassificacaoDre }

/**
 * Projeção de DRE — motor de cálculo dedicado.
 *
 * Princípio de honestidade de dados:
 * - Os meses REALIZADOS vêm exatamente do motor oficial da DRE Gerencial
 *   (calcularDreGerencialMatriz) — nenhum valor é reinventado aqui.
 * - Os meses PROJETADOS são a média mensal dos meses realizados COM MOVIMENTO
 *   naquele exercício, aplicada por rubrica (grupo DRE). Mês sem movimento = zero.
 */

export interface LinhaProjecaoMes {
  chave: string
  rotuloCurto: string
  ano: number
  mes: number
  projetado: boolean
}

export interface GrupoProjecao {
  classificacao: ClassificacaoDre
  titulo: string
  sinal: number
  realizadoTotal: number
  projetadoTotal: number
  totalAno: number
  /** média mensal calculada sobre os meses realizados com movimento, por grupo */
  mediaMensal: number
  valoresPorMes: Record<string, number>
}

export interface ParametrosProjecaoDre {
  /**
   * Método de projeção dos meses futuros:
   * - 'media_mensal': média mensal fixa das rubricas com movimento (padrão);
   * - 'crescimento': média composta mês a mês — média × (1+i)^n, onde n é o
   *   n-ésimo mês projetado a partir do último mês realizado.
   */
  modo: 'media_mensal' | 'crescimento'
  /** percentual de crescimento mensal (0 a 100) — usado apenas no modo 'crescimento' */
  percentualCrescimento: number
}

export const PARAMETROS_PROJECAO_PADRAO: ParametrosProjecaoDre = {
  modo: 'media_mensal',
  percentualCrescimento: 0,
}

/** Arredondamento padrão do app: 2 casas (centavos). */
export function arredondar2(v: number): number {
  return Math.round((v + Number.EPSILON) * 100) / 100
}

/** Percentual em formato brasileiro (vírgula decimal), padrão Borlim. */
export function formatPercentualBr(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

/**
 * Rótulo curto do método ativo, para legendas de tabela (ex.: "média mensal",
 * "crescimento de 5% a.m.").
 */
export function rotuloCurtoMetodoProjecaoDre(p: ParametrosProjecaoDre): string {
  if (p.modo === 'crescimento' && p.percentualCrescimento !== 0) {
    return `crescimento de ${formatPercentualBr(p.percentualCrescimento)}% a.m.`
  }
  return 'média mensal'
}

/**
 * Descreve o método de projeção ativo da DRE, para notas metodológicas.
 * Ex.: "projetada pela média mensal dos meses realizados" ou
 * "projetada com crescimento de 5% a.m. sobre a média dos meses realizados".
 */
export function descricaoMetodoProjecaoDre(p: ParametrosProjecaoDre): string {
  if (p.modo === 'crescimento' && p.percentualCrescimento !== 0) {
    return `projetada com crescimento de ${formatPercentualBr(p.percentualCrescimento)}% a.m. sobre a média dos meses realizados`
  }
  return 'projetada pela média mensal dos meses realizados'
}

export interface ProjecaoResultado {
  /** mês-chave dos meses realizados com movimento (base da média) */
  mesesRealizadosComMovimento: string[]
  /** parâmetros usados nesta projeção (modo + % de crescimento) */
  parametrosAplicados: ParametrosProjecaoDre
  /** rubricas na mesma ordem da DRE Gerencial */
  grupos: GrupoProjecao[]
  /** rubrica informativa (fora do resultado), mesma convenção da DRE Gerencial */
  naoClassificados: {
    titulo: string
    realizadoTotal: number
    projetadoTotal: number
    totalAno: number
    mediaMensal: number
    valoresPorMes: Record<string, number>
  }
  lucroPrejuizoRealizado: number
  lucroPrejuizoProjetado: number
  lucroPrejuizoTotalAno: number
  receitaRealizada: number
  receitaProjetada: number
  receitaTotalAno: number
  /** tendência do resultado total do ano projetado vs. total do exercício anterior */
  tendenciaVsAnoAnterior: {
    anoAnterior: number
    totalAnoAtual: number
    variacaoPercentual: number | null
    favoravel: boolean | null
  } | null
}

/**
 * Calcula a projeção a partir da matriz DRE Gerencial (meses realizados) e da
 * matriz do exercício anterior (para a tendência).
 */
export function calcularProjecaoDre(
  matrizAtual: DreMatrizResultado,
  matrizAnoAnterior: DreMatrizResultado | null,
  mesesExercicio: MesItem[],
  parametros: ParametrosProjecaoDre = PARAMETROS_PROJECAO_PADRAO,
): ProjecaoResultado {
  const chavesMeses = mesesExercicio.map((m) => m.chave)
  const usarCrescimento =
    parametros.modo === 'crescimento' && isFinite(parametros.percentualCrescimento)
  const fatorCrescimento = 1 + (usarCrescimento ? parametros.percentualCrescimento / 100 : 0)

  const parametrosAplicados: ParametrosProjecaoDre = {
    modo: parametros.modo,
    percentualCrescimento: usarCrescimento ? parametros.percentualCrescimento : 0,
  }

  // 1. Detecta meses realizados COM movimento (qualquer rubrica com valor ≠ 0)
  const mesesComMovimento: string[] = []
  for (const chave of chavesMeses) {
    const temMovimento = matrizAtual.grupos.some((g) => (g.valoresPorMes[chave] || 0) !== 0)
    if (temMovimento) mesesComMovimento.push(chave)
  }

  // 2. Média mensal por rubrica sobre os meses com movimento
  const divisor = Math.max(mesesComMovimento.length, 1)
  const mediaPorClassificacao = new Map<ClassificacaoDre, number>()
  for (const g of matrizAtual.grupos) {
    const soma = mesesComMovimento.reduce((acc, k) => acc + (g.valoresPorMes[k] || 0), 0)
    mediaPorClassificacao.set(g.classificacao, soma / divisor)
  }

  // Expoente de composição de cada mês projetado (1-based, a partir do último
  // mês realizado): 1º mês projetado = média × (1+i)^1, e assim por diante.
  const expoenteCrescimento = new Map<string, number>()
  let nProj = 0
  for (const chave of chavesMeses) {
    if (!mesesComMovimento.includes(chave)) {
      nProj += 1
      expoenteCrescimento.set(chave, nProj)
    }
  }

  /** Valor projetado do mês conforme o método ativo (média ou média composta). */
  const valorProjetado = (media: number, chave: string): number => {
    if (!usarCrescimento) return media
    const n = expoenteCrescimento.get(chave) || 1
    return arredondar2(media * Math.pow(fatorCrescimento, n))
  }

  // 3. Para cada mês do exercício: se tem movimento = realizado (mantém valor da
  //    matriz oficial); senão = projetado (aplica a média por rubrica). Mês sem
  //    movimento e sem média = zero.
  const grupos: GrupoProjecao[] = GRUPOS_DRE_ORDEM.map((clf) => {
    const grupoReal = matrizAtual.grupos.find((g) => g.classificacao === clf)
    const media = mediaPorClassificacao.get(clf) || 0
    const valoresPorMes: Record<string, number> = {}
    let realizadoTotal = 0
    let projetadoTotal = 0

    for (const chave of chavesMeses) {
      const temMovimento = mesesComMovimento.includes(chave)
      const valor = temMovimento
        ? grupoReal?.valoresPorMes[chave] || 0
        : valorProjetado(media, chave)
      valoresPorMes[chave] = valor
      if (temMovimento) realizadoTotal += valor
      else projetadoTotal += valor
    }

    return {
      classificacao: clf,
      titulo: TITULOS_GRUPOS_DRE[clf],
      sinal: SINAL_MULTIPLICADOR_GRUPO[clf],
      realizadoTotal,
      projetadoTotal,
      totalAno: realizadoTotal + projetadoTotal,
      mediaMensal: media,
      valoresPorMes,
    }
  })

  // Rubrica "Não Classificados" — informativa, fora do resultado (mesma convenção da DRE Gerencial)
  const ncReal = matrizAtual.naoClassificados
  const mediaNc =
    mesesComMovimento.reduce((acc, k) => acc + (ncReal.valoresPorMes[k] || 0), 0) / divisor
  const valoresNc: Record<string, number> = {}
  let ncRealTotal = 0
  let ncProjetadoTotal = 0
  for (const chave of chavesMeses) {
    const temMovimento = mesesComMovimento.includes(chave)
    const valor = temMovimento ? ncReal.valoresPorMes[chave] || 0 : valorProjetado(mediaNc, chave)
    valoresNc[chave] = valor
    if (temMovimento) ncRealTotal += valor
    else ncProjetadoTotal += valor
  }
  const naoClassificados = {
    titulo: ncReal.titulo,
    realizadoTotal: ncRealTotal,
    projetadoTotal: ncProjetadoTotal,
    totalAno: ncRealTotal + ncProjetadoTotal,
    mediaMensal: mediaNc,
    valoresPorMes: valoresNc,
  }

  // 4. Lucro/Prejuízo por mês = Receita − DespVar − DespFix − DespFin + RecFin (mesma fórmula da DRE Gerencial)
  let lpRealizado = 0
  let lpProjetado = 0
  const valoresLucroPorMes: Record<string, number> = {}
  let receitaRealizada = 0
  let receitaProjetada = 0
  let receitaTotalAno = 0

  const grupoReceita = grupos.find((g) => g.classificacao === 'Receita')!

  for (const chave of chavesMeses) {
    const temMovimento = mesesComMovimento.includes(chave)
    const rec = grupoReceita.valoresPorMes[chave] || 0
    const despVar =
      grupos.find((g) => g.classificacao === 'Despesa Variável')!.valoresPorMes[chave] || 0
    const despFix =
      grupos.find((g) => g.classificacao === 'Despesa Fixa')!.valoresPorMes[chave] || 0
    const despFin =
      grupos.find((g) => g.classificacao === 'Despesa Financeira')!.valoresPorMes[chave] || 0
    const recFin =
      grupos.find((g) => g.classificacao === 'Receita Financeira')!.valoresPorMes[chave] || 0
    const lp = rec - despVar - despFix - despFin + recFin
    valoresLucroPorMes[chave] = lp
    if (temMovimento) {
      lpRealizado += lp
      receitaRealizada += rec
    } else {
      lpProjetado += lp
      receitaProjetada += rec
    }
    receitaTotalAno += rec
  }

  const lpTotalAno = lpRealizado + lpProjetado

  // 5. Tendência vs. exercício anterior (total do ano completo de cada matriz)
  let tendencia: ProjecaoResultado['tendenciaVsAnoAnterior'] = null
  if (matrizAnoAnterior && matrizAnoAnterior.meses.length > 0) {
    const lpAnoAnterior = matrizAnoAnterior.lucroPrejuizo.totalPeriodo
    const variacao = (() => {
      if (lpAnoAnterior === 0) {
        return lpTotalAno === 0 ? 0 : null
      }
      return ((lpTotalAno - lpAnoAnterior) / Math.abs(lpAnoAnterior)) * 100
    })()
    const favoravel = variacao === null ? null : variacao >= 0
    tendencia = {
      anoAnterior: matrizAnoAnterior.meses[0].ano,
      totalAnoAtual: lpTotalAno,
      variacaoPercentual: variacao,
      favoravel,
    }
  }

  return {
    mesesRealizadosComMovimento: mesesComMovimento,
    parametrosAplicados,
    grupos,
    naoClassificados,
    lucroPrejuizoRealizado: lpRealizado,
    lucroPrejuizoProjetado: lpProjetado,
    lucroPrejuizoTotalAno: lpTotalAno,
    receitaRealizada,
    receitaProjetada,
    receitaTotalAno,
    tendenciaVsAnoAnterior: tendencia,
  }
}

/**
 * Monta a lista dos 12 meses do exercício com marcação realizado/projetado
 * a partir da chave dos meses com movimento.
 */
export function montarLinhasMesesProjecao(
  mesesExercicio: MesItem[],
  mesesComMovimento: string[],
): LinhaProjecaoMes[] {
  return mesesExercicio.map((m) => ({
    chave: m.chave,
    rotuloCurto: m.rotuloCurto,
    ano: m.ano,
    mes: m.mes,
    projetado: !mesesComMovimento.includes(m.chave),
  }))
}

/**
 * ============================================================
 * PROJEÇÃO PLURIANUAL (PRÓXIMOS ANOS) COM BASE NA MÉDIA DOS ANOS ANTERIORES
 * ============================================================
 */

export interface DadosAnoHistoricoDre {
  ano: number
  /** Se o ano possui lançamentos ou movimento contábil */
  temMovimento: boolean
  /** Totais anuais por rubrica da DRE */
  totaisPorClassificacao: Record<ClassificacaoDre, number>
  lucroPrejuizo: number
}

export interface ColunaAnoProjecaoPlurianual {
  ano: number
  projetado: boolean
  rotulo: string
}

export interface GrupoProjecaoPlurianual {
  classificacao: ClassificacaoDre
  titulo: string
  sinal: number
  /** Média anual calculada sobre os anos históricos realizados com movimento */
  mediaHistoricaAnual: number
  /** Valores por ano (ex.: { 2024: 100000, 2025: 120000, 2026: 110000, ... }) */
  valoresPorAno: Record<number, number>
}

export interface ParametrosProjecaoPlurianual {
  /** Quantidade de anos futuros a projetar (ex.: 3 anos -> N+1, N+2, N+3) */
  anosFuturos: number
  /**
   * Método de cálculo:
   * - 'media_simples': média aritmética simples das rubricas nos anos realizados com movimento
   * - 'media_com_crescimento': média anual base corrigida por taxa percentual de expansão anual
   */
  modo: 'media_simples' | 'media_com_crescimento'
  /** Percentual de crescimento anual projetado (% a.a.) */
  percentualCrescimentoAnual: number
}

export const PARAMETROS_PROJECAO_PLURIANUAL_PADRAO: ParametrosProjecaoPlurianual = {
  anosFuturos: 3,
  modo: 'media_simples',
  percentualCrescimentoAnual: 0,
}

export interface ProjecaoPlurianualResultado {
  anosBaseHistorico: number[]
  anosFuturosProjetados: number[]
  colunas: ColunaAnoProjecaoPlurianual[]
  grupos: GrupoProjecaoPlurianual[]
  lucroPrejuizoPorAno: Record<number, number>
  margemLiquidaPorAno: Record<number, number | null>
  mediaHistoricaLucro: number
  mediaHistoricaReceita: number
  parametrosAplicados: ParametrosProjecaoPlurianual
  notaMetodologica: string
}

/**
 * Calcula a projeção de DRE para os próximos anos com base na média dos anos anteriores realizados.
 *
 * @param historicoAnos Lista de anos históricos já consolidados pela DRE Gerencial oficial
 * @param anoBaseExercicio Exercício corrente ativo (ex.: 2025 ou 2026)
 * @param parametros Parâmetros de quantidade de anos futuros e método (média simples ou crescimento anual)
 */
export function calcularProjecaoDrePlurianual(
  historicoAnos: DadosAnoHistoricoDre[],
  anoBaseExercicio: number,
  parametros: ParametrosProjecaoPlurianual = PARAMETROS_PROJECAO_PLURIANUAL_PADRAO,
): ProjecaoPlurianualResultado {
  const anosComMovimento = historicoAnos.filter((h) => h.temMovimento).sort((a, b) => a.ano - b.ano)

  const anosBase = anosComMovimento.map((h) => h.ano)
  const qtdAnosBase = Math.max(anosBase.length, 1)

  const qtdFuturos = Math.max(1, Math.min(parametros.anosFuturos || 3, 5))
  const usarCrescimento =
    parametros.modo === 'media_com_crescimento' && isFinite(parametros.percentualCrescimentoAnual)
  const fatorCrescimento = 1 + (usarCrescimento ? parametros.percentualCrescimentoAnual / 100 : 0)

  // Determina os próximos anos projetados (a partir do maior ano entre anoBaseExercicio e anos históricos)
  const anoReferencia = Math.max(
    anoBaseExercicio,
    anosBase.length > 0 ? Math.max(...anosBase) : anoBaseExercicio,
  )

  const anosFuturos: number[] = []
  for (let i = 1; i <= qtdFuturos; i++) {
    anosFuturos.push(anoReferencia + i)
  }

  // Média anual de cada rubrica sobre os anos históricos com movimento
  const mediaPorClassificacao = new Map<ClassificacaoDre, number>()
  for (const clf of GRUPOS_DRE_ORDEM) {
    const soma = anosComMovimento.reduce((acc, h) => acc + (h.totaisPorClassificacao[clf] || 0), 0)
    mediaPorClassificacao.set(clf, soma / qtdAnosBase)
  }

  // Grupos e valores por ano
  const grupos: GrupoProjecaoPlurianual[] = GRUPOS_DRE_ORDEM.map((clf) => {
    const media = mediaPorClassificacao.get(clf) || 0
    const valoresPorAno: Record<number, number> = {}

    // Anos realizados da base histórica
    for (const h of anosComMovimento) {
      valoresPorAno[h.ano] = h.totaisPorClassificacao[clf] || 0
    }

    // Anos futuros projetados
    anosFuturos.forEach((anoProj, idx) => {
      if (!usarCrescimento) {
        valoresPorAno[anoProj] = arredondar2(media)
      } else {
        const expoente = idx + 1
        valoresPorAno[anoProj] = arredondar2(media * Math.pow(fatorCrescimento, expoente))
      }
    })

    return {
      classificacao: clf,
      titulo: TITULOS_GRUPOS_DRE[clf],
      sinal: SINAL_MULTIPLICADOR_GRUPO[clf],
      mediaHistoricaAnual: media,
      valoresPorAno,
    }
  })

  // Lucro ou Prejuízo por ano = Receita - DespVar - DespFix - DespFin + RecFin
  const lucroPrejuizoPorAno: Record<number, number> = {}
  const margemLiquidaPorAno: Record<number, number | null> = {}

  const todosAnos = [...anosBase, ...anosFuturos]
  const grupoRec = grupos.find((g) => g.classificacao === 'Receita')!
  const grupoDv = grupos.find((g) => g.classificacao === 'Despesa Variável')!
  const grupoDf = grupos.find((g) => g.classificacao === 'Despesa Fixa')!
  const grupoDfin = grupos.find((g) => g.classificacao === 'Despesa Financeira')!
  const grupoRfin = grupos.find((g) => g.classificacao === 'Receita Financeira')!

  for (const ano of todosAnos) {
    const rec = grupoRec.valoresPorAno[ano] || 0
    const dv = grupoDv.valoresPorAno[ano] || 0
    const df = grupoDf.valoresPorAno[ano] || 0
    const dfin = grupoDfin.valoresPorAno[ano] || 0
    const rfin = grupoRfin.valoresPorAno[ano] || 0

    const lp = arredondar2(rec - dv - df - dfin + rfin)
    lucroPrejuizoPorAno[ano] = lp
    margemLiquidaPorAno[ano] = rec > 0 ? (lp / rec) * 100 : null
  }

  const mediaHistoricaLucro =
    anosBase.length > 0
      ? anosBase.reduce((acc, a) => acc + (lucroPrejuizoPorAno[a] || 0), 0) / anosBase.length
      : 0

  const mediaHistoricaReceita = mediaPorClassificacao.get('Receita') || 0

  const colunas: ColunaAnoProjecaoPlurianual[] = todosAnos.map((ano) => {
    const ehFuturo = anosFuturos.includes(ano)
    return {
      ano,
      projetado: ehFuturo,
      rotulo: ehFuturo ? `${ano} (proj.)` : `${ano} (real.)`,
    }
  })

  const descMetodo =
    parametros.modo === 'media_com_crescimento' && parametros.percentualCrescimentoAnual !== 0
      ? `média histórica anual corrigida a ${formatPercentualBr(parametros.percentualCrescimentoAnual)}% a.a.`
      : 'média anual dos exercícios anteriores com movimento'

  const notaMetodologica =
    anosBase.length > 0
      ? `Projeção plurianual baseada em ${anosBase.length} exercício(s) com movimento (${anosBase.join(
          ', ',
        )}). Método: ${descMetodo}.`
      : 'Sem exercícios anteriores com movimento suficientes para calcular a média histórica.'

  return {
    anosBaseHistorico: anosBase,
    anosFuturosProjetados: anosFuturos,
    colunas,
    grupos,
    lucroPrejuizoPorAno,
    margemLiquidaPorAno,
    mediaHistoricaLucro,
    mediaHistoricaReceita,
    parametrosAplicados: {
      anosFuturos: qtdFuturos,
      modo: parametros.modo,
      percentualCrescimentoAnual: usarCrescimento ? parametros.percentualCrescimentoAnual : 0,
    },
    notaMetodologica,
  }
}
