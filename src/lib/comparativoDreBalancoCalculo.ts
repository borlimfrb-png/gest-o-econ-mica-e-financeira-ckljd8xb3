import type {
  BalancoRecord,
  ContaRecord,
  LancamentoRecord,
  PlanoContaRecord,
  EmpresaRecord,
} from '@/types/finance'
import { calcularBalanco } from '@/lib/financeCalculations'
import { calcularDreGerencialMatriz } from '@/lib/dreGerencialCalculo'
import { gerarListaMeses, type MesItem } from '@/lib/dreGerencialTypes'
import { classificarStatusIndicador } from '@/lib/indicadoresFinanceirosCalculo'

export const NOMES_MESES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

export const NOMES_MESES_ABREV = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
]

export interface MesComparativoDreBalanco {
  mesNum: number
  mesNome: string
  mesAbrev: string
  chave: string // 'YYYY-MM'
  temDados: boolean
  temBalanco: boolean
  temDre: boolean

  // DRE Mensal (Fluxo)
  receitaBruta: number
  receitaLiquida: number
  custosVariaveis: number
  despesasFixas: number
  despesasFinanceiras: number
  receitasFinanceiras: number
  ebitda: number
  resultadoLiquido: number
  margemLiquida: number | null

  // Balanço Mensal (Estoque)
  ativoTotal: number
  ativoCirculante: number
  ativoNaoCirculante: number
  realizavelLongoPrazo: number
  passivoTotal: number
  passivoCirculante: number
  passivoNaoCirculante: number
  patrimonioLiquido: number
  caixaEquivalentes: number
  contasReceber: number
  estoques: number
  fornecedores: number

  // Indicadores Derivados Mensais
  liquidezCorrente: number | null
  liquidezGeral: number | null
  endividamentoTotalPl: number | null // Passivo Total / PL
  endividamentoPcPl: number | null // PC / PL
  endividamentoGeralAt: number | null // Passivo Total / Ativo Total (%)
  roeMensal: number | null // (Resultado Líquido / PL) * 100
}

export interface ColunaConsolidadaExercicio {
  // DRE (Soma dos meses com dados)
  receitaBruta: number
  receitaLiquida: number
  custosVariaveis: number
  despesasFixas: number
  despesasFinanceiras: number
  receitasFinanceiras: number
  ebitda: number
  resultadoLiquido: number
  margemLiquida: number | null

  // Balanço (Posição do último mês com balanço preenchido no exercício)
  ativoTotal: number
  ativoCirculante: number
  ativoNaoCirculante: number
  realizavelLongoPrazo: number
  passivoTotal: number
  passivoCirculante: number
  passivoNaoCirculante: number
  patrimonioLiquido: number
  caixaEquivalentes: number
  contasReceber: number
  estoques: number
  fornecedores: number
  ultimoMesComBalanco: number | null

  // Indicadores consolidados do exercício
  liquidezCorrente: number | null
  liquidezGeral: number | null
  endividamentoTotalPl: number | null
  endividamentoPcPl: number | null
  endividamentoGeralAt: number | null
  roeAcumulado: number | null // (Resultado Líquido Acumulado / PL final) * 100
}

export interface ComparativoDreBalancoResultado {
  ano: number
  empresaNome: string
  isGrupo: boolean
  meses: MesComparativoDreBalanco[]
  totalExercicio: ColunaConsolidadaExercicio
  mesesComDadosCount: number
  mesesComBalancoCount: number
}

/**
 * Soma dos grupos patrimoniais para validação de dados reais no balanço
 * (Evita registros zerados quando houver registros preenchidos)
 */
export function extrairSomaBalanco(b?: BalancoRecord | null): number {
  if (!b) return 0
  return (
    (b.caixa_equivalentes || 0) +
    (b.aplicacoes_financeiras || 0) +
    (b.contas_receber || 0) +
    (b.estoques || 0) +
    (b.impostos_recuperar || 0) +
    (b.outros_ativo_circulante || 0) +
    (b.realizavel_longo_prazo || 0) +
    (b.investimentos || 0) +
    (b.imobilizado || 0) +
    (b.intangivel || 0) +
    (b.fornecedores || 0) +
    (b.emprestimos_curto_prazo || 0) +
    (b.obrigacoes_trabalhistas || 0) +
    (b.obrigacoes_tributarias || 0) +
    (b.outros_passivo_circulante || 0) +
    (b.emprestimos_longo_prazo || 0) +
    (b.outras_obrigacoes_longo_prazo || 0) +
    (b.capital_social || 0) +
    (b.reservas_lucros || 0) +
    (b.lucros_acumulados || 0)
  )
}

/**
 * Seleciona o melhor balanço para um mês específico de uma empresa.
 * Se houver mais de um registro para o mesmo mês, prioriza aquele com maior soma patrimonial (> 0).
 */
export function selecionarMelhorBalancoMes(
  list: BalancoRecord[],
  ano: number,
  mes: number,
): BalancoRecord | null {
  const doMes = list.filter(
    (b) => Number(b.ano) === Number(ano) && Number(b.mes ?? 12) === Number(mes),
  )
  if (doMes.length === 0) return null

  // Prioriza registros que tenham dados preenchidos (> 0)
  const comDados = doMes.filter((b) => extrairSomaBalanco(b) > 0)
  if (comDados.length > 0) {
    // Escolhe o de maior volume ou mais recente atualizado
    comDados.sort((a, b) => extrairSomaBalanco(b) - extrairSomaBalanco(a))
    return comDados[0]
  }

  return doMes[0]
}

/**
 * Consolida os balanços patrimoniais de um conjunto de empresas-membro para um mês específico.
 */
export function consolidarBalancosGrupoMes(
  todosBalancos: BalancoRecord[],
  membrosIds: string[],
  ano: number,
  mes: number,
): BalancoRecord | null {
  const balancosMembros: BalancoRecord[] = []

  for (const empId of membrosIds) {
    const balancosEmp = todosBalancos.filter((b) => b.empresa === empId)
    const melhor = selecionarMelhorBalancoMes(balancosEmp, ano, mes)
    if (melhor && extrairSomaBalanco(melhor) > 0) {
      balancosMembros.push(melhor)
    }
  }

  if (balancosMembros.length === 0) {
    return null
  }

  return {
    id: `consolidado-grupo-${ano}-${mes}`,
    collectionId: 'balancos',
    collectionName: 'balancos',
    created: '',
    updated: '',
    empresa: 'grupo-consolidado',
    ano,
    mes,
    fechado: balancosMembros.every((b) => b.fechado),
    caixa_equivalentes: balancosMembros.reduce((acc, b) => acc + (b.caixa_equivalentes || 0), 0),
    aplicacoes_financeiras: balancosMembros.reduce(
      (acc, b) => acc + (b.aplicacoes_financeiras || 0),
      0,
    ),
    contas_receber: balancosMembros.reduce((acc, b) => acc + (b.contas_receber || 0), 0),
    estoques: balancosMembros.reduce((acc, b) => acc + (b.estoques || 0), 0),
    impostos_recuperar: balancosMembros.reduce((acc, b) => acc + (b.impostos_recuperar || 0), 0),
    outros_ativo_circulante: balancosMembros.reduce(
      (acc, b) => acc + (b.outros_ativo_circulante || 0),
      0,
    ),
    realizavel_longo_prazo: balancosMembros.reduce(
      (acc, b) => acc + (b.realizavel_longo_prazo || 0),
      0,
    ),
    investimentos: balancosMembros.reduce((acc, b) => acc + (b.investimentos || 0), 0),
    imobilizado: balancosMembros.reduce((acc, b) => acc + (b.imobilizado || 0), 0),
    intangivel: balancosMembros.reduce((acc, b) => acc + (b.intangivel || 0), 0),
    fornecedores: balancosMembros.reduce((acc, b) => acc + (b.fornecedores || 0), 0),
    emprestimos_curto_prazo: balancosMembros.reduce(
      (acc, b) => acc + (b.emprestimos_curto_prazo || 0),
      0,
    ),
    obrigacoes_trabalhistas: balancosMembros.reduce(
      (acc, b) => acc + (b.obrigacoes_trabalhistas || 0),
      0,
    ),
    obrigacoes_tributarias: balancosMembros.reduce(
      (acc, b) => acc + (b.obrigacoes_tributarias || 0),
      0,
    ),
    outros_passivo_circulante: balancosMembros.reduce(
      (acc, b) => acc + (b.outros_passivo_circulante || 0),
      0,
    ),
    emprestimos_longo_prazo: balancosMembros.reduce(
      (acc, b) => acc + (b.emprestimos_longo_prazo || 0),
      0,
    ),
    outras_obrigacoes_longo_prazo: balancosMembros.reduce(
      (acc, b) => acc + (b.outras_obrigacoes_longo_prazo || 0),
      0,
    ),
    capital_social: balancosMembros.reduce((acc, b) => acc + (b.capital_social || 0), 0),
    reservas_lucros: balancosMembros.reduce((acc, b) => acc + (b.reservas_lucros || 0), 0),
    lucros_acumulados: balancosMembros.reduce((acc, b) => acc + (b.lucros_acumulados || 0), 0),
    vinculos_contas: {},
  }
}

/**
 * Motor central de cálculo do Comparativo Mensal entre DRE e Balanço Patrimonial.
 * Executa o motor oficial `calcularDreGerencialMatriz` nos lançamentos de Jan a Dez do ano
 * e emparelha com os balanços do mês correspondente.
 */
export function calcularComparativoMensalDreBalanco(params: {
  ano: number
  lancamentos: LancamentoRecord[]
  contas: ContaRecord[]
  planoContas?: PlanoContaRecord[]
  balancos: BalancoRecord[]
  isGrupo?: boolean
  membrosGrupoIds?: string[]
  empresaNome?: string
}): ComparativoDreBalancoResultado {
  const {
    ano,
    lancamentos,
    contas,
    planoContas,
    balancos,
    isGrupo = false,
    membrosGrupoIds = [],
    empresaNome = 'Empresa',
  } = params

  // Gera os 12 meses do ano
  const mesesLista: MesItem[] = gerarListaMeses(ano, 1, 12)

  // Filtra lançamentos do ano e, se for grupo, garante que pertencem às empresas do grupo
  const lancamentosAno = lancamentos.filter((l) => {
    if (!l.data) return false
    const lAno = Number(l.data.slice(0, 4))
    if (lAno !== ano) return false
    if (isGrupo && membrosGrupoIds.length > 0) {
      return membrosGrupoIds.includes(l.empresa)
    }
    return true
  })

  // Executa o motor oficial da DRE Gerencial
  const matrizDre = calcularDreGerencialMatriz(lancamentosAno, contas, mesesLista, planoContas)

  const gruposMap = new Map(matrizDre.grupos.map((g) => [g.classificacao, g]))

  const mesesResultado: MesComparativoDreBalanco[] = []

  let totalReceitaBruta = 0
  let totalReceitaLiquida = 0
  let totalCustosVariaveis = 0
  let totalDespesasFixas = 0
  let totalDespesasFin = 0
  let totalReceitasFin = 0
  let totalResultadoLiquido = 0
  let totalEbitda = 0

  let ultimoMesBalancoValido: BalancoRecord | null = null
  let ultimoMesNumBalanco: number | null = null

  for (let m = 1; m <= 12; m++) {
    const mesObj = mesesLista[m - 1]
    const chave = mesObj.chave

    // Valores DRE
    const recBruta = gruposMap.get('Receita')?.valoresPorMes[chave] || 0
    const recLiquida = recBruta // Na DRE gerencial, deduções já compõem o grupo ou receita bruta representa faturamento
    const despVar = gruposMap.get('Despesa Variável')?.valoresPorMes[chave] || 0
    const despFix = gruposMap.get('Despesa Fixa')?.valoresPorMes[chave] || 0
    const despFin = gruposMap.get('Despesa Financeira')?.valoresPorMes[chave] || 0
    const recFin = gruposMap.get('Receita Financeira')?.valoresPorMes[chave] || 0
    const resLiq = matrizDre.lucroPrejuizo.valoresPorMes[chave] || 0
    const mgLiq =
      matrizDre.margemLiquidaPorMes[chave] ?? (recBruta > 0 ? (resLiq / recBruta) * 100 : null)

    // EBITDA aproximado por mês = Resultado Líquido + Despesas Financeiras
    const ebitdaMes = resLiq + despFin

    // Balanço do mês
    let balancoMes: BalancoRecord | null = null
    if (isGrupo && membrosGrupoIds.length > 0) {
      balancoMes = consolidarBalancosGrupoMes(balancos, membrosGrupoIds, ano, m)
    } else {
      balancoMes = selecionarMelhorBalancoMes(balancos, ano, m)
    }

    const somaBalanco = extrairSomaBalanco(balancoMes)
    const temBalanco = Boolean(balancoMes && somaBalanco > 0)

    const calcB = temBalanco && balancoMes ? calcularBalanco(balancoMes) : null

    if (temBalanco && balancoMes) {
      ultimoMesBalancoValido = balancoMes
      ultimoMesNumBalanco = m
    }

    const at = calcB?.ativoTotal || 0
    const ac = calcB?.ativoCirculante || 0
    const anc = calcB?.ativoNaoCirculante || 0
    const rlp = balancoMes?.realizavel_longo_prazo || 0
    const pc = calcB?.passivoCirculante || 0
    const pnc = calcB?.passivoNaoCirculante || 0
    const pt = calcB?.passivoTotal || 0
    const pl = calcB?.patrimonioLiquido || 0
    const caixa = (balancoMes?.caixa_equivalentes || 0) + (balancoMes?.aplicacoes_financeiras || 0)
    const cr = balancoMes?.contas_receber || 0
    const est = balancoMes?.estoques || 0
    const forn = balancoMes?.fornecedores || 0

    // Indicadores Derivados
    const lc = temBalanco && pc > 0 ? ac / pc : null
    const lg = temBalanco && pc + pnc > 0 ? (ac + rlp) / (pc + pnc) : null
    const endTotalPl = temBalanco && pl > 0 ? pt / pl : null
    const endPcPl = temBalanco && pl > 0 ? pc / pl : null
    const endGeralAt = temBalanco && at > 0 ? (pt / at) * 100 : null
    const roe = temBalanco && pl > 0 ? (resLiq / pl) * 100 : null

    const temDre = recBruta !== 0 || despVar !== 0 || despFix !== 0 || despFin !== 0 || resLiq !== 0
    const temDados = temDre || temBalanco

    totalReceitaBruta += recBruta
    totalReceitaLiquida += recLiquida
    totalCustosVariaveis += despVar
    totalDespesasFixas += despFix
    totalDespesasFin += despFin
    totalReceitasFin += recFin
    totalResultadoLiquido += resLiq
    totalEbitda += ebitdaMes

    mesesResultado.push({
      mesNum: m,
      mesNome: NOMES_MESES[m - 1],
      mesAbrev: NOMES_MESES_ABREV[m - 1],
      chave,
      temDados,
      temBalanco,
      temDre,

      receitaBruta: recBruta,
      receitaLiquida: recLiquida,
      custosVariaveis: despVar,
      despesasFixas: despFix,
      despesasFinanceiras: despFin,
      receitasFinanceiras: recFin,
      ebitda: ebitdaMes,
      resultadoLiquido: resLiq,
      margemLiquida: mgLiq,

      ativoTotal: at,
      ativoCirculante: ac,
      ativoNaoCirculante: anc,
      realizavelLongoPrazo: rlp,
      passivoTotal: pt,
      passivoCirculante: pc,
      passivoNaoCirculante: pnc,
      patrimonioLiquido: pl,
      caixaEquivalentes: caixa,
      contasReceber: cr,
      estoques: est,
      fornecedores: forn,

      liquidezCorrente: lc,
      liquidezGeral: lg,
      endividamentoTotalPl: endTotalPl,
      endividamentoPcPl: endPcPl,
      endividamentoGeralAt: endGeralAt,
      roeMensal: roe,
    })
  }

  // Posição final de balanço para a coluna Total/Acumulado
  const calcBUltimo = ultimoMesBalancoValido ? calcularBalanco(ultimoMesBalancoValido) : null
  const atFinal = calcBUltimo?.ativoTotal || 0
  const acFinal = calcBUltimo?.ativoCirculante || 0
  const ancFinal = calcBUltimo?.ativoNaoCirculante || 0
  const rlpFinal = ultimoMesBalancoValido?.realizavel_longo_prazo || 0
  const pcFinal = calcBUltimo?.passivoCirculante || 0
  const pncFinal = calcBUltimo?.passivoNaoCirculante || 0
  const ptFinal = calcBUltimo?.passivoTotal || 0
  const plFinal = calcBUltimo?.patrimonioLiquido || 0
  const caixaFinal =
    (ultimoMesBalancoValido?.caixa_equivalentes || 0) +
    (ultimoMesBalancoValido?.aplicacoes_financeiras || 0)
  const crFinal = ultimoMesBalancoValido?.contas_receber || 0
  const estFinal = ultimoMesBalancoValido?.estoques || 0
  const fornFinal = ultimoMesBalancoValido?.fornecedores || 0

  const temBalancoFinal = ultimoMesBalancoValido !== null

  const lcFinal = temBalancoFinal && pcFinal > 0 ? acFinal / pcFinal : null
  const lgFinal =
    temBalancoFinal && pcFinal + pncFinal > 0 ? (acFinal + rlpFinal) / (pcFinal + pncFinal) : null
  const endTotalPlFinal = temBalancoFinal && plFinal > 0 ? ptFinal / plFinal : null
  const endPcPlFinal = temBalancoFinal && plFinal > 0 ? pcFinal / plFinal : null
  const endGeralAtFinal = temBalancoFinal && atFinal > 0 ? (ptFinal / atFinal) * 100 : null
  const roeFinal = temBalancoFinal && plFinal > 0 ? (totalResultadoLiquido / plFinal) * 100 : null
  const margemLiquidaFinal =
    totalReceitaBruta > 0 ? (totalResultadoLiquido / totalReceitaBruta) * 100 : null

  const totalExercicio: ColunaConsolidadaExercicio = {
    receitaBruta: totalReceitaBruta,
    receitaLiquida: totalReceitaLiquida,
    custosVariaveis: totalCustosVariaveis,
    despesasFixas: totalDespesasFixas,
    despesasFinanceiras: totalDespesasFin,
    receitasFinanceiras: totalReceitasFin,
    ebitda: totalEbitda,
    resultadoLiquido: totalResultadoLiquido,
    margemLiquida: margemLiquidaFinal,

    ativoTotal: atFinal,
    ativoCirculante: acFinal,
    ativoNaoCirculante: ancFinal,
    realizavelLongoPrazo: rlpFinal,
    passivoTotal: ptFinal,
    passivoCirculante: pcFinal,
    passivoNaoCirculante: pncFinal,
    patrimonioLiquido: plFinal,
    caixaEquivalentes: caixaFinal,
    contasReceber: crFinal,
    estoques: estFinal,
    fornecedores: fornFinal,
    ultimoMesComBalanco: ultimoMesNumBalanco,

    liquidezCorrente: lcFinal,
    liquidezGeral: lgFinal,
    endividamentoTotalPl: endTotalPlFinal,
    endividamentoPcPl: endPcPlFinal,
    endividamentoGeralAt: endGeralAtFinal,
    roeAcumulado: roeFinal,
  }

  return {
    ano,
    empresaNome,
    isGrupo,
    meses: mesesResultado,
    totalExercicio,
    mesesComDadosCount: mesesResultado.filter((m) => m.temDados).length,
    mesesComBalancoCount: mesesResultado.filter((m) => m.temBalanco).length,
  }
}
