import type { ContaRecord, LancamentoRecord, PlanoContaRecord } from '@/types/finance'
import { calcularDreGerencialMatriz } from '@/lib/dreGerencialCalculo'
import { gerarListaMeses, type MesItem } from '@/lib/dreGerencialTypes'

export interface FaturamentoAnoLinha {
  ano: number
  /** Faturamento em cada mês 1 a 12 (chave "01".."12" ou número do mês 1..12) */
  valoresPorMes: Record<number, number>
  /** Indica se o mês teve lançamento de receita (para diferenciar 0 real de ausência de dados) */
  mesesComDados: Record<number, boolean>
  totalAno: number
  /** % de participação deste ano sobre o faturamento acumulado de todos os anos */
  participacaoAcumulado: number | null
  /** Variação percentual ano sobre ano (em relação ao ano cronológico imediatamente anterior se houver) */
  variacaoYoY: number | null
}

export interface DiagnosticoFaturamento {
  tipo: 'crescimento' | 'queda' | 'estagnacao' | 'sazonalidade' | 'sem_dados' | 'inicial'
  titulo: string
  descricao: string
  melhorTrimestre?: string
  crescimentoMedioYoY?: number | null
}

export interface AnaliseFaturamentoResultado {
  anos: number[]
  linhasPorAno: FaturamentoAnoLinha[]
  /** Totais mensais agregados somando todos os anos */
  totalGeralPorMes: Record<number, number>
  totalGeralTodosAnos: number
  mediaAnualFaturamento: number
  melhorAno: {
    ano: number
    valor: number
    variacaoYoY: number | null
  } | null
  piorAno: {
    ano: number
    valor: number
    variacaoYoY: number | null
  } | null
  diagnostico: DiagnosticoFaturamento
  temDados: boolean
}

export const MESES_ROTULOS: Array<{ mes: number; sigla: string; nome: string }> = [
  { mes: 1, sigla: 'Jan', nome: 'Janeiro' },
  { mes: 2, sigla: 'Fev', nome: 'Fevereiro' },
  { mes: 3, sigla: 'Mar', nome: 'Março' },
  { mes: 4, sigla: 'Abr', nome: 'Abril' },
  { mes: 5, sigla: 'Mai', nome: 'Maio' },
  { mes: 6, sigla: 'Jun', nome: 'Junho' },
  { mes: 7, sigla: 'Jul', nome: 'Julho' },
  { mes: 8, sigla: 'Ago', nome: 'Agosto' },
  { mes: 9, sigla: 'Set', nome: 'Setembro' },
  { mes: 10, sigla: 'Out', nome: 'Outubro' },
  { mes: 11, sigla: 'Nov', nome: 'Novembro' },
  { mes: 12, sigla: 'Dez', nome: 'Dezembro' },
]

/**
 * Calcula variação percentual ano sobre ano (YoY):
 * ((anoAtual - anoAnterior) / anoAnterior) * 100
 * Retorna null se base for zero ou menor ou não finita.
 */
export function calcularVariacaoYoY(valorAtual: number, valorAnterior: number): number | null {
  if (valorAnterior <= 0 || !Number.isFinite(valorAnterior) || !Number.isFinite(valorAtual)) {
    return null
  }
  return ((valorAtual - valorAnterior) / Math.abs(valorAnterior)) * 100
}

/**
 * Calcula a participação percentual de um ano no total acumulado:
 * (faturamentoAno / faturamentoTotalTodosAnos) * 100
 */
export function calcularParticipacaoAcumulado(
  faturamentoAno: number,
  faturamentoTotalTodosAnos: number,
): number | null {
  if (faturamentoTotalTodosAnos <= 0 || !Number.isFinite(faturamentoTotalTodosAnos)) {
    return null
  }
  return (faturamentoAno / faturamentoTotalTodosAnos) * 100
}

/**
 * Classifica a variação YoY para o semáforo padronizado:
 * Verde: crescimento positivo (> 0%)
 * Neutro: estabilidade (0%)
 * Vermelho: retração / queda (< 0%)
 */
export function classificarSemaforoVariacao(
  variacao: number | null | undefined,
): 'verde' | 'neutro' | 'vermelho' {
  if (variacao === null || variacao === undefined || !Number.isFinite(variacao)) {
    return 'neutro'
  }
  if (variacao > 0.001) return 'verde'
  if (variacao < -0.001) return 'vermelho'
  return 'neutro'
}

/**
 * Gera diagnóstico executivo automático com tom de consultor de finanças corporativas
 */
export function gerarDiagnosticoFaturamento(
  linhasOrdenadasCrescente: FaturamentoAnoLinha[],
  totalGeral: number,
): DiagnosticoFaturamento {
  if (linhasOrdenadasCrescente.length === 0 || totalGeral <= 0) {
    return {
      tipo: 'sem_dados',
      titulo: 'Sem dados suficientes para análise histórica',
      descricao:
        'Não foram identificadas receitas faturadas nos lançamentos da empresa ou grupo para compor o histórico plurianual.',
    }
  }

  if (linhasOrdenadasCrescente.length === 1) {
    const anoUnico = linhasOrdenadasCrescente[0]
    return {
      tipo: 'inicial',
      titulo: `Histórico inicial — Exercício ${anoUnico.ano}`,
      descricao: `A base possui faturamento registrado exclusivamente no exercício ${anoUnico.ano}. À medida que novos exercícios forem lançados ou importados, o comparativo evolutivo e o cálculo de variação ano a ano serão consolidados automaticamente.`,
    }
  }

  // Apurar variações YoY conhecidas
  const variacoesValidas: number[] = []
  let anosCrescimento = 0
  let anosQueda = 0

  for (const l of linhasOrdenadasCrescente) {
    if (l.variacaoYoY !== null && Number.isFinite(l.variacaoYoY)) {
      variacoesValidas.push(l.variacaoYoY)
      if (l.variacaoYoY > 0) anosCrescimento++
      else if (l.variacaoYoY < 0) anosQueda++
    }
  }

  const crescimentoMedioYoY =
    variacoesValidas.length > 0
      ? variacoesValidas.reduce((a, b) => a + b, 0) / variacoesValidas.length
      : null

  // Sazonalidade agregada por trimestres (T1: Jan-Mar, T2: Abr-Jun, T3: Jul-Set, T4: Out-Dez)
  const somaTrimestres: Record<string, number> = {
    '1º Tri (Jan–Mar)': 0,
    '2º Tri (Abr–Jun)': 0,
    '3º Tri (Jul–Set)': 0,
    '4º Tri (Out–Dez)': 0,
  }

  for (const l of linhasOrdenadasCrescente) {
    somaTrimestres['1º Tri (Jan–Mar)'] +=
      (l.valoresPorMes[1] || 0) + (l.valoresPorMes[2] || 0) + (l.valoresPorMes[3] || 0)
    somaTrimestres['2º Tri (Abr–Jun)'] +=
      (l.valoresPorMes[4] || 0) + (l.valoresPorMes[5] || 0) + (l.valoresPorMes[6] || 0)
    somaTrimestres['3º Tri (Jul–Set)'] +=
      (l.valoresPorMes[7] || 0) + (l.valoresPorMes[8] || 0) + (l.valoresPorMes[9] || 0)
    somaTrimestres['4º Tri (Out–Dez)'] +=
      (l.valoresPorMes[10] || 0) + (l.valoresPorMes[11] || 0) + (l.valoresPorMes[12] || 0)
  }

  let melhorTriNome = '1º Tri (Jan–Mar)'
  let melhorTriValor = -1
  for (const [tri, val] of Object.entries(somaTrimestres)) {
    if (val > melhorTriValor) {
      melhorTriValor = val
      melhorTriNome = tri
    }
  }
  const pctMelhorTri =
    totalGeral > 0 && melhorTriValor > 0 ? (melhorTriValor / totalGeral) * 100 : 0

  const ultimoAno = linhasOrdenadasCrescente[linhasOrdenadasCrescente.length - 1]
  const penultimoAno = linhasOrdenadasCrescente[linhasOrdenadasCrescente.length - 2]
  const variacaoRecente = ultimoAno.variacaoYoY

  if (anosCrescimento >= 2 && anosQueda === 0) {
    return {
      tipo: 'crescimento',
      titulo: 'Trajetória de Expansão Consistente',
      descricao: `A empresa apresenta trajetória sólida de expansão plurianual ininterrupta, com crescimento médio anual de ${crescimentoMedioYoY !== null ? `${crescimentoMedioYoY.toFixed(1)}%` : '—'}. O pico sazonal histórico concentra-se no ${melhorTriNome} (${pctMelhorTri.toFixed(1)}% do faturamento acumulado).`,
      melhorTrimestre: melhorTriNome,
      crescimentoMedioYoY,
    }
  }

  if (variacaoRecente !== null && variacaoRecente > 10) {
    return {
      tipo: 'crescimento',
      titulo: `Aceleração no Exercício ${ultimoAno.ano} (+${variacaoRecente.toFixed(1)}%)`,
      descricao: `Houve forte aceleração da receita no exercício ${ultimoAno.ano} na comparação com ${penultimoAno.ano}. O trimestre de maior tração histórica foi o ${melhorTriNome}. Recomenda-se calibrar a capacidade produtiva e capital de giro para sustentar a demanda nos períodos de pico.`,
      melhorTrimestre: melhorTriNome,
      crescimentoMedioYoY,
    }
  }

  if (variacaoRecente !== null && variacaoRecente < -5) {
    return {
      tipo: 'queda',
      titulo: `Alerta de Retração no Exercício ${ultimoAno.ano} (${variacaoRecente.toFixed(1)}%)`,
      descricao: `O faturamento do exercício ${ultimoAno.ano} registrou retração de ${Math.abs(variacaoRecente).toFixed(1)}% em relação a ${penultimoAno.ano}. A concentração de receita no ${melhorTriNome} aponta forte dependência sazonal que exige diversificação de mix e reforço comercial na baixa temporada.`,
      melhorTrimestre: melhorTriNome,
      crescimentoMedioYoY,
    }
  }

  if (crescimentoMedioYoY !== null && Math.abs(crescimentoMedioYoY) <= 5) {
    return {
      tipo: 'estagnacao',
      titulo: 'Estabilidade e Platô de Faturamento',
      descricao: `O faturamento apresenta comportamento estável e previsível entre os exercícios analisados (variação média de ${crescimentoMedioYoY >= 0 ? '+' : ''}${crescimentoMedioYoY.toFixed(1)}%). O maior volume operacional consolida-se historicamente no ${melhorTriNome}. Recomenda-se analisar expansão de novos canais ou produtos para romper o platô.`,
      melhorTrimestre: melhorTriNome,
      crescimentoMedioYoY,
    }
  }

  return {
    tipo: 'sazonalidade',
    titulo: `Perfil Operacional com Sazonalidade Dominante no ${melhorTriNome}`,
    descricao: `A dinâmica de vendas revela oscilações interanuais com concentração expressiva de receitas no ${melhorTriNome} (${pctMelhorTri.toFixed(1)}% do acumulado). Mantenha a gestão de fluxo de caixa precavida para cobrir custos fixos nos trimestres de baixa atividade.`,
    melhorTrimestre: melhorTriNome,
    crescimentoMedioYoY,
  }
}

/**
 * Motor principal da Análise de Faturamento:
 * 1. Identifica todos os anos com lançamentos válidos para a empresa/grupo.
 * 2. Para cada ano, executa o motor oficial `calcularDreGerencialMatriz` de Jan a Dez (12 meses).
 * 3. Extrai as receitas de cada mês e o total faturado do ano.
 * 4. Calcula percentual de participação de cada ano sobre o acumulado de todos os anos.
 * 5. Calcula a variação YoY ano sobre ano.
 * 6. Identifica melhor ano, pior ano e gera diagnóstico executivo.
 */
export function calcularAnaliseFaturamento(
  lancamentos: LancamentoRecord[],
  contas: ContaRecord[],
  planoContas?: PlanoContaRecord[],
): AnaliseFaturamentoResultado {
  // Identifica anos presentes nos lançamentos não-estornados com data válida
  const anosSet = new Set<number>()

  for (const l of lancamentos) {
    if (l.estornado) continue
    if (!l.data) continue
    const anoStr = l.data.slice(0, 4)
    const anoNum = Number(anoStr)
    if (anoNum >= 2000 && anoNum <= 2100) {
      anosSet.add(anoNum)
    }
  }

  // Ordena anos em ordem cronológica crescente (ex: 2022, 2023, 2024, 2025)
  const anosOrdenados = Array.from(anosSet).sort((a, b) => a - b)

  if (anosOrdenados.length === 0) {
    return {
      anos: [],
      linhasPorAno: [],
      totalGeralPorMes: {
        1: 0,
        2: 0,
        3: 0,
        4: 0,
        5: 0,
        6: 0,
        7: 0,
        8: 0,
        9: 0,
        10: 0,
        11: 0,
        12: 0,
      },
      totalGeralTodosAnos: 0,
      mediaAnualFaturamento: 0,
      melhorAno: null,
      piorAno: null,
      diagnostico: {
        tipo: 'sem_dados',
        titulo: 'Nenhum lançamento encontrado',
        descricao: 'Não há lançamentos registrados para a empresa selecionada.',
      },
      temDados: false,
    }
  }

  // Processa cada ano usando a DRE Gerencial oficial de 12 meses (Jan a Dez)
  const linhasParciais: Array<{
    ano: number
    valoresPorMes: Record<number, number>
    mesesComDados: Record<number, boolean>
    totalAno: number
  }> = []

  let totalGeralTodosAnos = 0
  const totalGeralPorMes: Record<number, number> = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
    6: 0,
    7: 0,
    8: 0,
    9: 0,
    10: 0,
    11: 0,
    12: 0,
  }

  for (const ano of anosOrdenados) {
    const mesesAno: MesItem[] = gerarListaMeses(ano, 1, 12)
    const matrizDre = calcularDreGerencialMatriz(lancamentos, contas, mesesAno, planoContas, {
      tipoRelatorio: 'dre',
    })

    const grupoReceitas = matrizDre.grupos.find((g) => g.classificacao === 'Receita')
    const valoresPorMes: Record<number, number> = {}
    const mesesComDados: Record<number, boolean> = {}
    let totalAno = 0

    // Verifica quais meses desse ano têm algum lançamento contábil em geral
    const mesesComLancamentoAno = new Set<string>()
    for (const l of lancamentos) {
      if (l.estornado) continue
      if (!l.data || !l.data.startsWith(String(ano))) continue
      mesesComLancamentoAno.add(l.data.slice(0, 7))
    }

    for (let m = 1; m <= 12; m++) {
      const chaveMes = `${ano}-${String(m).padStart(2, '0')}`
      const valorRec = grupoReceitas?.valoresPorMes[chaveMes] || 0
      valoresPorMes[m] = valorRec
      // Se houver valor > 0 ou houver lançamento no mês, consideramos mês com movimentação
      mesesComDados[m] = valorRec > 0 || mesesComLancamentoAno.has(chaveMes)
      totalAno += valorRec
      totalGeralPorMes[m] += valorRec
    }

    totalGeralTodosAnos += totalAno

    linhasParciais.push({
      ano,
      valoresPorMes,
      mesesComDados,
      totalAno,
    })
  }

  // Agora que temos totalGeralTodosAnos, calcula participação acumulada e variação YoY
  const mapaTotaisPorAno = new Map<number, number>()
  for (const l of linhasParciais) {
    mapaTotaisPorAno.set(l.ano, l.totalAno)
  }

  const linhasFinais: FaturamentoAnoLinha[] = linhasParciais.map((linha, index) => {
    const participacao = calcularParticipacaoAcumulado(linha.totalAno, totalGeralTodosAnos)

    // YoY: verifica se existe o ano cronológico anterior (ano - 1) no mapa ou o ano precedente na lista
    const anoAnterior = linha.ano - 1
    let variacaoYoY: number | null = null

    if (mapaTotaisPorAno.has(anoAnterior)) {
      const valAnt = mapaTotaisPorAno.get(anoAnterior)!
      variacaoYoY = calcularVariacaoYoY(linha.totalAno, valAnt)
    } else if (index > 0) {
      // Se houver um salto de anos (ex: 2021 -> 2023), calcula em relação ao período precedente disponível
      const valPrec = linhasParciais[index - 1].totalAno
      variacaoYoY = calcularVariacaoYoY(linha.totalAno, valPrec)
    }

    return {
      ano: linha.ano,
      valoresPorMes: linha.valoresPorMes,
      mesesComDados: linha.mesesComDados,
      totalAno: linha.totalAno,
      participacaoAcumulado: participacao,
      variacaoYoY,
    }
  })

  // Identificar melhor e pior ano (dentre anos com faturamento > 0, ou todos se nenhum > 0)
  let melhorAno: { ano: number; valor: number; variacaoYoY: number | null } | null = null
  let piorAno: { ano: number; valor: number; variacaoYoY: number | null } | null = null

  if (linhasFinais.length > 0) {
    const sortedPorValor = [...linhasFinais].sort((a, b) => b.totalAno - a.totalAno)
    const melhor = sortedPorValor[0]
    const pior = sortedPorValor[sortedPorValor.length - 1]

    melhorAno = {
      ano: melhor.ano,
      valor: melhor.totalAno,
      variacaoYoY: melhor.variacaoYoY,
    }

    piorAno = {
      ano: pior.ano,
      valor: pior.totalAno,
      variacaoYoY: pior.variacaoYoY,
    }
  }

  const mediaAnualFaturamento =
    linhasFinais.length > 0 ? totalGeralTodosAnos / linhasFinais.length : 0

  const diagnostico = gerarDiagnosticoFaturamento(linhasFinais, totalGeralTodosAnos)

  const temDados = totalGeralTodosAnos > 0 || linhasFinais.some((l) => l.totalAno > 0)

  return {
    anos: anosOrdenados,
    linhasPorAno: linhasFinais,
    totalGeralPorMes,
    totalGeralTodosAnos,
    mediaAnualFaturamento,
    melhorAno,
    piorAno,
    diagnostico,
    temDados,
  }
}
