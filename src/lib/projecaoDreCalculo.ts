import type { DreMatrizResultado, MesItem, ClassificacaoDre } from './dreGerencialTypes'
import {
  GRUPOS_DRE_ORDEM,
  TITULOS_GRUPOS_DRE,
  SINAL_MULTIPLICADOR_GRUPO,
} from './dreGerencialTypes'

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
