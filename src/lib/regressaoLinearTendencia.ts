/**
 * Utilitários para regressão linear simples e cálculo de tendências temporais de indicadores
 */

export type TendenciaDirecao = 'alta' | 'baixa' | 'estavel'

export interface PontoSerieAno {
  ano: number
  valor: number | null
}

export interface TendenciaResultado {
  inclinacao: number // slope 'm' da reta y = m*x + b
  intercepto: number // 'b'
  r2: number // coeficiente de determinação
  direcao: TendenciaDirecao
  variacaoTotalPct: number | null // variação percentual entre primeiro e último ano com valor
  primeiroValor: number | null
  ultimoValor: number | null
  pontosRegressao: Array<{ ano: number; valorAjustado: number }>
}

/**
 * Calcula a regressão linear simples (Mínimos Quadrados) sobre pontos (ano, valor).
 * Ignora anos sem valor (null/undefined/NaN).
 */
export function calcularRegressaoLinear(pontos: PontoSerieAno[]): TendenciaResultado {
  const pontosValidos = pontos.filter(
    (p) => p.valor !== null && p.valor !== undefined && !Number.isNaN(p.valor),
  ) as Array<{ ano: number; valor: number }>

  if (pontosValidos.length < 2) {
    const unico = pontosValidos[0]
    return {
      inclinacao: 0,
      intercepto: unico ? unico.valor : 0,
      r2: 0,
      direcao: 'estavel',
      variacaoTotalPct: null,
      primeiroValor: unico ? unico.valor : null,
      ultimoValor: unico ? unico.valor : null,
      pontosRegressao: pontos.map((p) => ({
        ano: p.ano,
        valorAjustado: unico ? unico.valor : 0,
      })),
    }
  }

  // Ordena por ano
  pontosValidos.sort((a, b) => a.ano - b.ano)

  const n = pontosValidos.length
  let sumX = 0
  let sumY = 0
  let sumXY = 0
  let sumX2 = 0
  let sumY2 = 0

  for (const p of pontosValidos) {
    sumX += p.ano
    sumY += p.valor
    sumXY += p.ano * p.valor
    sumX2 += p.ano * p.ano
    sumY2 += p.valor * p.valor
  }

  const denominador = n * sumX2 - sumX * sumX
  const inclinacao = denominador !== 0 ? (n * sumXY - sumX * sumY) / denominador : 0
  const intercepto = (sumY - inclinacao * sumX) / n

  // Coeficiente R2
  const mediaY = sumY / n
  let ssTot = 0
  let ssRes = 0
  for (const p of pontosValidos) {
    const yPred = inclinacao * p.ano + intercepto
    ssTot += Math.pow(p.valor - mediaY, 2)
    ssRes += Math.pow(p.valor - yPred, 2)
  }
  const r2 = ssTot !== 0 ? Math.max(0, 1 - ssRes / ssTot) : 0

  // Direção da tendência: tolerância pequena relativa
  const primeiro = pontosValidos[0].valor
  const ultimo = pontosValidos[pontosValidos.length - 1].valor
  const delta = ultimo - primeiro

  let variacaoTotalPct: number | null = null
  if (primeiro !== 0) {
    variacaoTotalPct = (delta / Math.abs(primeiro)) * 100
  }

  // Se a variação ou a inclinação for muito próxima de zero, considera estável
  const thresholdRelativo = Math.abs(primeiro) > 0 ? 0.02 * Math.abs(primeiro) : 0.05
  let direcao: TendenciaDirecao = 'estavel'
  if (Math.abs(inclinacao) > 0.001) {
    if (inclinacao > 0 && delta > thresholdRelativo * 0.5) {
      direcao = 'alta'
    } else if (inclinacao < 0 && delta < -thresholdRelativo * 0.5) {
      direcao = 'baixa'
    } else if (inclinacao > 0) {
      direcao = 'alta'
    } else if (inclinacao < 0) {
      direcao = 'baixa'
    }
  }

  // Pontos ajustados da reta para todos os anos da série
  const pontosRegressao = pontos.map((p) => ({
    ano: p.ano,
    valorAjustado: Number((inclinacao * p.ano + intercepto).toFixed(2)),
  }))

  return {
    inclinacao,
    intercepto,
    r2,
    direcao,
    variacaoTotalPct,
    primeiroValor: primeiro,
    ultimoValor: ultimo,
    pontosRegressao,
  }
}
