import {
  CATALOGO_INDICADORES,
  CATEGORIAS_INDICADORES,
  type CategoriaIndicador,
  type ContextoCalculoIndicadores,
  type StatusFaixa,
} from './catalogoApresentacaoIndicadores'

export interface IndicadorCalculadoResumo {
  id: string
  sigla: string
  nome: string
  faixaStatus: StatusFaixa
  score0a100: number | null
  textoExibicao: string
}

export interface PontuacaoCategoriaItem {
  categoriaId: CategoriaIndicador
  categoriaNome: string
  categoriaNomeCurto: string
  scoreAtual: number | null
  scoreAnterior: number | null
  // Contagens no ano atual
  totalIndicadores: number
  indicadoresCalculados: number
  indicadoresIdeais: number
  indicadoresAtencao: number
  indicadoresCriticos: number
  // Status de saúde baseado no scoreAtual
  statusSaude: 'forte' | 'moderado' | 'fragil' | 'sem_dados'
  corSaude: string
  badgeBg: string
  indicadores: IndicadorCalculadoResumo[]
  destaqueTexto: string
}

export interface DiagnosticoRadarResult {
  itens: PontuacaoCategoriaItem[]
  temDadosAtual: boolean
  temDadosAnterior: boolean
  scoreGeralAtual: number | null
  scoreGeralAnterior: number | null
  categoriasFortes: PontuacaoCategoriaItem[]
  categoriasFrageis: PontuacaoCategoriaItem[]
  categoriasModeradas: PontuacaoCategoriaItem[]
}

// Converte o status da faixa em pontuação contínua de 0 a 100
export function converterFaixaStatusParaScore(faixa: StatusFaixa): number | null {
  switch (faixa) {
    case 'verde':
      return 100
    case 'ambar':
      return 60
    case 'vermelho':
      return 20
    case 'indefinido':
    default:
      return null
  }
}

// Nomes curtos das 8 categorias para caberem perfeitamente no radar
export const NOMES_CURTOS_CATEGORIAS: Record<CategoriaIndicador, string> = {
  liquidez: 'Liquidez',
  capital_giro: 'Capital de Giro',
  endividamento: 'Endividamento',
  rentabilidade: 'Rentabilidade',
  ponto_equilibrio: 'Ponto Equilíbrio',
  valuation: 'Valuation',
  bsc: 'BSC Estratégico',
  economicos_solvencia: 'Econ./Solvência',
}

/**
 * Calcula a pontuação (0-100) para cada uma das 8 categorias do catálogo
 * para o ano atual e o ano anterior.
 */
export function calcularDiagnosticoRadar(
  contexto: ContextoCalculoIndicadores,
): DiagnosticoRadarResult {
  // Contexto espelhado para calcular o ano anterior isoladamente caso exista
  const contextoAnterior: ContextoCalculoIndicadores = {
    balancoAtual: contexto.balancoAnterior,
    dreAtual: contexto.dreAnterior,
    balancoAnterior: null,
    dreAnterior: null,
    bscKpis: [], // BSC não tem histórico consolidado de ano anterior no mesmo modelo
    anoAtual: contexto.anoAnterior,
    anoAnterior: contexto.anoAnterior - 1,
  }

  const temDemonstracaoAtual = Boolean(contexto.balancoAtual || contexto.dreAtual)
  const temDemonstracaoAnterior = Boolean(contexto.balancoAnterior || contexto.dreAnterior)

  const itens: PontuacaoCategoriaItem[] = CATEGORIAS_INDICADORES.map((cat) => {
    const indicadoresDestaCat = CATALOGO_INDICADORES.filter((ind) => ind.categoria === cat.id)

    const resumoIndicadoresAtual: IndicadorCalculadoResumo[] = []
    const scoresAtual: number[] = []
    let verdes = 0
    let ambars = 0
    let vermelhos = 0

    indicadoresDestaCat.forEach((ind) => {
      const extraido = ind.extrairValor(contexto)
      const score = converterFaixaStatusParaScore(extraido.faixaStatus)

      resumoIndicadoresAtual.push({
        id: ind.id,
        sigla: ind.sigla,
        nome: ind.nome,
        faixaStatus: extraido.faixaStatus,
        score0a100: score,
        textoExibicao: extraido.textoExibicao,
      })

      if (score !== null) {
        scoresAtual.push(score)
        if (extraido.faixaStatus === 'verde') verdes++
        else if (extraido.faixaStatus === 'ambar') ambars++
        else if (extraido.faixaStatus === 'vermelho') vermelhos++
      }
    })

    // Calcula scores do ano anterior
    const scoresAnterior: number[] = []
    if (temDemonstracaoAnterior) {
      indicadoresDestaCat.forEach((ind) => {
        // Para indicadores que não usam balanço anterior (ex: rentabilidade, liquidez, ponto de equilíbrio)
        const extraidoAnt = ind.extrairValor(contextoAnterior)
        const scoreAnt = converterFaixaStatusParaScore(extraidoAnt.faixaStatus)
        if (scoreAnt !== null) {
          scoresAnterior.push(scoreAnt)
        }
      })
    }

    const scoreAtual =
      scoresAtual.length > 0
        ? Math.round(scoresAtual.reduce((a, b) => a + b, 0) / scoresAtual.length)
        : null

    const scoreAnterior =
      scoresAnterior.length > 0
        ? Math.round(scoresAnterior.reduce((a, b) => a + b, 0) / scoresAnterior.length)
        : null

    let statusSaude: PontuacaoCategoriaItem['statusSaude'] = 'sem_dados'
    let corSaude = '#94A3B8' // slate
    let badgeBg = 'bg-slate-100 text-slate-700 border-slate-200'
    let destaqueTexto = 'Sem apuração no ano selecionado'

    if (scoreAtual !== null) {
      if (scoreAtual >= 75) {
        statusSaude = 'forte'
        corSaude = '#10B981' // emerald-500
        badgeBg = 'bg-emerald-50 text-emerald-800 border-emerald-300'
        destaqueTexto = 'Desempenho forte (faixa saudável)'
      } else if (scoreAtual >= 50) {
        statusSaude = 'moderado'
        corSaude = '#F59E0B' // amber-500
        badgeBg = 'bg-amber-50 text-amber-800 border-amber-300'
        destaqueTexto = 'Atenção moderada (equilíbrio justo)'
      } else {
        statusSaude = 'fragil'
        corSaude = '#EF4444' // rose-500
        badgeBg = 'bg-rose-50 text-rose-800 border-rose-300'
        destaqueTexto = 'Vulnerabilidade / Ponto crítico'
      }
    }

    return {
      categoriaId: cat.id,
      categoriaNome: cat.nome.replace(/^\d+\.\s*/, ''),
      categoriaNomeCurto: NOMES_CURTOS_CATEGORIAS[cat.id] || cat.nome,
      scoreAtual,
      scoreAnterior,
      totalIndicadores: indicadoresDestaCat.length,
      indicadoresCalculados: scoresAtual.length,
      indicadoresIdeais: verdes,
      indicadoresAtencao: ambars,
      indicadoresCriticos: vermelhos,
      statusSaude,
      corSaude,
      badgeBg,
      indicadores: resumoIndicadoresAtual,
      destaqueTexto,
    }
  })

  // Agregações globais
  const scoresValidosAtual = itens
    .map((i) => i.scoreAtual)
    .filter((s): s is number => s !== null && !isNaN(s))

  const scoresValidosAnterior = itens
    .map((i) => i.scoreAnterior)
    .filter((s): s is number => s !== null && !isNaN(s))

  const scoreGeralAtual =
    scoresValidosAtual.length > 0
      ? Math.round(scoresValidosAtual.reduce((a, b) => a + b, 0) / scoresValidosAtual.length)
      : null

  const scoreGeralAnterior =
    scoresValidosAnterior.length > 0
      ? Math.round(scoresValidosAnterior.reduce((a, b) => a + b, 0) / scoresValidosAnterior.length)
      : null

  const categoriasFortes = itens.filter((i) => i.statusSaude === 'forte')
  const categoriasFrageis = itens.filter((i) => i.statusSaude === 'fragil')
  const categoriasModeradas = itens.filter((i) => i.statusSaude === 'moderado')

  return {
    itens,
    temDadosAtual: temDemonstracaoAtual && scoresValidosAtual.length > 0,
    temDadosAnterior: temDemonstracaoAnterior && scoresValidosAnterior.length > 0,
    scoreGeralAtual,
    scoreGeralAnterior,
    categoriasFortes,
    categoriasFrageis,
    categoriasModeradas,
  }
}
