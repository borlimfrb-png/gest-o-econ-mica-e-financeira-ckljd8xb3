import type { ContaRecord, LancamentoRecord, PlanoContaRecord } from '@/types/finance'
import { calcularDreGerencialMatriz } from './dreGerencialCalculo'
import { gerarListaMeses, type MesItem } from './dreGerencialTypes'

export interface ItemRentabilidadeMes {
  chave: string // '2025-01'
  rotuloCurto: string // 'Jan/25'
  rotuloCompleto: string // 'Janeiro de 2025'
  faturamento: number // Receitas DRE do mês
  lucroApurado: number // Resultado do DRE do mês (lucro ou prejuízo)
  margemSobreFaturamento: number | null // (lucro / faturamento) * 100
  // Margens derivadas DRE
  despesasVariaveis: number
  despesasFixas: number
  despesasFinanceiras: number
  receitasFinanceiras: number
  resultadoFinanceiro: number // Receitas Fin - Despesas Fin
  margemBruta: number | null // ((faturamento - despesasVariaveis) / faturamento) * 100
  margemOperacional: number | null // ((faturamento - despesasVariaveis - despesasFixas) / faturamento) * 100
}

export interface AnaliseRentabilidadeResultado {
  meses: MesItem[]
  itensPorMes: ItemRentabilidadeMes[]
  // Totais consolidados do período
  faturamentoTotal: number
  lucroTotal: number
  margemSobreFaturamentoTotal: number | null
  despesasVariaveisTotal: number
  despesasFixasTotal: number
  despesasFinanceirasTotal: number
  receitasFinanceirasTotal: number
  resultadoFinanceiroTotal: number
  margemBrutaTotal: number | null
  margemOperacionalTotal: number | null
  // Estatísticas do período
  melhorMesLucro: { rotulo: string; valor: number } | null
  piorMesLucro: { rotulo: string; valor: number } | null
  maiorMargemMes: { rotulo: string; margem: number } | null
  menorMargemMes: { rotulo: string; margem: number } | null
  mesesComLucro: number
  mesesComPrejuizo: number
}

/**
 * Calcula a Análise de Rentabilidade a partir do cálculo padrão da DRE Gerencial.
 * Reutiliza 100% da lógica e classificação oficial do sistema sem inventar regras paralelas.
 */
export function calcularAnaliseRentabilidade(
  lancamentos: LancamentoRecord[],
  contas: ContaRecord[],
  meses: MesItem[],
  planoContas?: PlanoContaRecord[],
): AnaliseRentabilidadeResultado {
  const matrizDre = calcularDreGerencialMatriz(lancamentos, contas, meses, planoContas, {
    tipoRelatorio: 'dre',
  })

  const grupoReceita = matrizDre.grupos.find((g) => g.classificacao === 'Receita')
  const grupoDespVar = matrizDre.grupos.find((g) => g.classificacao === 'Despesa Variável')
  const grupoDespFix = matrizDre.grupos.find((g) => g.classificacao === 'Despesa Fixa')
  const grupoDespFin = matrizDre.grupos.find((g) => g.classificacao === 'Despesa Financeira')
  const grupoRecFin = matrizDre.grupos.find((g) => g.classificacao === 'Receita Financeira')

  const itensPorMes: ItemRentabilidadeMes[] = []

  let melhorLucro = -Infinity
  let melhorMesLucro: { rotulo: string; valor: number } | null = null
  let piorLucro = Infinity
  let piorMesLucro: { rotulo: string; valor: number } | null = null

  let maiorMargem = -Infinity
  let maiorMargemMes: { rotulo: string; margem: number } | null = null
  let menorMargem = Infinity
  let menorMargemMes: { rotulo: string; margem: number } | null = null

  let mesesComLucro = 0
  let mesesComPrejuizo = 0

  for (const m of meses) {
    const faturamento = grupoReceita?.valoresPorMes[m.chave] || 0
    const lucro = matrizDre.lucroPrejuizo.valoresPorMes[m.chave] || 0
    const despVar = grupoDespVar?.valoresPorMes[m.chave] || 0
    const despFix = grupoDespFix?.valoresPorMes[m.chave] || 0
    const despFin = grupoDespFin?.valoresPorMes[m.chave] || 0
    const recFin = grupoRecFin?.valoresPorMes[m.chave] || 0
    const resFin = recFin - despFin

    const margemSobreFaturamento = faturamento > 0 ? (lucro / faturamento) * 100 : null

    // Margem Bruta = (Receitas - Desp. Variáveis) / Receitas * 100
    const lucroBruto = faturamento - despVar
    const margemBruta = faturamento > 0 ? (lucroBruto / faturamento) * 100 : null

    // Margem Operacional = (Receitas - Desp. Variáveis - Desp. Fixas) / Receitas * 100
    const lucroOperacional = faturamento - despVar - despFix
    const margemOperacional = faturamento > 0 ? (lucroOperacional / faturamento) * 100 : null

    itensPorMes.push({
      chave: m.chave,
      rotuloCurto: m.rotuloCurto,
      rotuloCompleto: m.rotuloCompleto,
      faturamento,
      lucroApurado: lucro,
      margemSobreFaturamento,
      despesasVariaveis: despVar,
      despesasFixas: despFix,
      despesasFinanceiras: despFin,
      receitasFinanceiras: recFin,
      resultadoFinanceiro: resFin,
      margemBruta,
      margemOperacional,
    })

    // Contabiliza apenas se houver movimentação no mês
    if (faturamento > 0 || lucro !== 0 || despVar > 0 || despFix > 0 || despFin > 0) {
      if (lucro > 0) mesesComLucro++
      else if (lucro < 0) mesesComPrejuizo++

      if (lucro > melhorLucro) {
        melhorLucro = lucro
        melhorMesLucro = { rotulo: m.rotuloCurto, valor: lucro }
      }
      if (lucro < piorLucro) {
        piorLucro = lucro
        piorMesLucro = { rotulo: m.rotuloCurto, valor: lucro }
      }

      if (margemSobreFaturamento !== null) {
        if (margemSobreFaturamento > maiorMargem) {
          maiorMargem = margemSobreFaturamento
          maiorMargemMes = { rotulo: m.rotuloCurto, margem: margemSobreFaturamento }
        }
        if (margemSobreFaturamento < menorMargem) {
          menorMargem = margemSobreFaturamento
          menorMargemMes = { rotulo: m.rotuloCurto, margem: margemSobreFaturamento }
        }
      }
    }
  }

  const faturamentoTotal = grupoReceita?.totalPeriodo || 0
  const lucroTotal = matrizDre.lucroPrejuizo.totalPeriodo || 0
  const despesasVariaveisTotal = grupoDespVar?.totalPeriodo || 0
  const despesasFixasTotal = grupoDespFix?.totalPeriodo || 0
  const despesasFinanceirasTotal = grupoDespFin?.totalPeriodo || 0
  const receitasFinanceirasTotal = grupoRecFin?.totalPeriodo || 0
  const resultadoFinanceiroTotal = receitasFinanceirasTotal - despesasFinanceirasTotal

  const margemSobreFaturamentoTotal =
    faturamentoTotal > 0 ? (lucroTotal / faturamentoTotal) * 100 : null

  const margemBrutaTotal =
    faturamentoTotal > 0
      ? ((faturamentoTotal - despesasVariaveisTotal) / faturamentoTotal) * 100
      : null

  const margemOperacionalTotal =
    faturamentoTotal > 0
      ? ((faturamentoTotal - despesasVariaveisTotal - despesasFixasTotal) / faturamentoTotal) * 100
      : null

  return {
    meses,
    itensPorMes,
    faturamentoTotal,
    lucroTotal,
    margemSobreFaturamentoTotal,
    despesasVariaveisTotal,
    despesasFixasTotal,
    despesasFinanceirasTotal,
    receitasFinanceirasTotal,
    resultadoFinanceiroTotal,
    margemBrutaTotal,
    margemOperacionalTotal,
    melhorMesLucro,
    piorMesLucro,
    maiorMargemMes,
    menorMargemMes,
    mesesComLucro,
    mesesComPrejuizo,
  }
}

// ============================================================
// COMPARATIVO MULTI-ANO (mesmo intervalo de meses, anos diferentes)
// ============================================================

export interface VariacaoEntreAnos {
  anoAnterior: number
  deltaAbsoluto: number // ano atual - ano anterior
  deltaPercentual: number | null // ((atual - anterior) / |anterior|) * 100; null quando anterior = 0 e atual != 0
  favoravel: boolean // verde quando favorável ao resultado (receita/lucro sobem, despesas caem)
}

export interface VariacaoMargemEntreAnos {
  anoAnterior: number
  deltaPontos: number | null // variação em pontos percentuais
  favoravel: boolean
}

export interface VariacoesRentabilidadeAno {
  faturamento: VariacaoEntreAnos
  despesasVariaveis: VariacaoEntreAnos
  despesasFixas: VariacaoEntreAnos
  despesasFinanceiras: VariacaoEntreAnos
  resultadoFinanceiro: VariacaoEntreAnos
  lucroApurado: VariacaoEntreAnos
  margemSobreFaturamento: VariacaoMargemEntreAnos
  margemBruta: VariacaoMargemEntreAnos
  margemOperacional: VariacaoMargemEntreAnos
}

export interface AnoRentabilidadeComparado {
  ano: number
  resultado: AnaliseRentabilidadeResultado
  // Preenchido apenas quando existe um ano anterior na comparação
  variacoes?: VariacoesRentabilidadeAno
}

function calcularVariacaoValor(
  anoAnterior: number,
  anterior: number,
  atual: number,
  favoravelQuandoMenor: boolean,
): VariacaoEntreAnos {
  const deltaAbsoluto = atual - anterior
  let deltaPercentual: number | null
  if (anterior === 0) {
    deltaPercentual = atual === 0 ? 0 : null
  } else {
    deltaPercentual = ((atual - anterior) / Math.abs(anterior)) * 100
  }
  const favoravel = favoravelQuandoMenor ? deltaAbsoluto <= 0 : deltaAbsoluto >= 0
  return { anoAnterior, deltaAbsoluto, deltaPercentual, favoravel }
}

function calcularVariacaoMargem(
  anoAnterior: number,
  anterior: number | null,
  atual: number | null,
): VariacaoMargemEntreAnos {
  if (anterior === null || atual === null) {
    return { anoAnterior, deltaPontos: null, favoravel: false }
  }
  const deltaPontos = atual - anterior
  return { anoAnterior, deltaPontos, favoravel: deltaPontos >= 0 }
}

/**
 * Calcula as variações ano contra ano entre dois resultados de rentabilidade
 * apurados sobre o MESMO intervalo de meses.
 */
export function calcularVariacoesEntreAnos(
  anterior: AnaliseRentabilidadeResultado,
  atual: AnaliseRentabilidadeResultado,
  anoAnterior: number,
): VariacoesRentabilidadeAno {
  return {
    faturamento: calcularVariacaoValor(
      anoAnterior,
      anterior.faturamentoTotal,
      atual.faturamentoTotal,
      false,
    ),
    despesasVariaveis: calcularVariacaoValor(
      anoAnterior,
      anterior.despesasVariaveisTotal,
      atual.despesasVariaveisTotal,
      true,
    ),
    despesasFixas: calcularVariacaoValor(
      anoAnterior,
      anterior.despesasFixasTotal,
      atual.despesasFixasTotal,
      true,
    ),
    despesasFinanceiras: calcularVariacaoValor(
      anoAnterior,
      anterior.despesasFinanceirasTotal,
      atual.despesasFinanceirasTotal,
      true,
    ),
    resultadoFinanceiro: calcularVariacaoValor(
      anoAnterior,
      anterior.resultadoFinanceiroTotal,
      atual.resultadoFinanceiroTotal,
      false,
    ),
    lucroApurado: calcularVariacaoValor(anoAnterior, anterior.lucroTotal, atual.lucroTotal, false),
    margemSobreFaturamento: calcularVariacaoMargem(
      anoAnterior,
      anterior.margemSobreFaturamentoTotal,
      atual.margemSobreFaturamentoTotal,
    ),
    margemBruta: calcularVariacaoMargem(
      anoAnterior,
      anterior.margemBrutaTotal,
      atual.margemBrutaTotal,
    ),
    margemOperacional: calcularVariacaoMargem(
      anoAnterior,
      anterior.margemOperacionalTotal,
      atual.margemOperacionalTotal,
    ),
  }
}

/**
 * Compara a rentabilidade do exercício base contra anos anteriores, sempre sobre
 * o MESMO intervalo de meses (mesInicial + quantidade). Cada ano é recalculado
 * pelo motor oficial da DRE Gerencial (calcularAnaliseRentabilidade).
 *
 * @param anoBase exercício selecionado (primeiro da lista)
 * @param anosComparados anos anteriores a incluir (ex.: [2024, 2023])
 */
export function calcularComparativoRentabilidadeAnos(
  lancamentos: LancamentoRecord[],
  contas: ContaRecord[],
  anoBase: number,
  mesInicial: number,
  qtdMeses: number,
  anosComparados: number[],
  planoContas?: PlanoContaRecord[],
): AnoRentabilidadeComparado[] {
  const anosUnicos = Array.from(new Set(anosComparados.filter((a) => a && a !== anoBase))).sort(
    (a, b) => b - a, // mais recente primeiro: 2024 antes de 2023
  )

  const anosOrdem = [anoBase, ...anosUnicos]
  const saida: AnoRentabilidadeComparado[] = []

  for (const ano of anosOrdem) {
    const mesesAno = gerarListaMeses(ano, mesInicial, qtdMeses)
    const resultado = calcularAnaliseRentabilidade(lancamentos, contas, mesesAno, planoContas)

    const anterior = saida[saida.length - 1]
    const variacoes = anterior
      ? calcularVariacoesEntreAnos(anterior.resultado, resultado, anterior.ano)
      : undefined

    saida.push({ ano, resultado, variacoes })
  }

  return saida
}
