import type { BscKpiRecord, BscPerspectiva, BalancoRecord, DreRecord } from '@/types/finance'
import {
  calcularBalanco,
  calcularDre,
  calcularIndicadores,
  calcularCapitalGiro,
  NOMES_MESES,
  NOMES_MESES_ABREV,
} from '@/lib/financeCalculations'

export interface PontoMesScoreBsc {
  mesNum: number // 1 a 12
  mesNome: string // Janeiro, Fevereiro...
  mesAbrev: string // Jan, Fev...
  temDados: boolean
  scoreGlobal: number | null
  scoreFinanceira: number | null
  scoreClientes: number | null
  scoreProcessos: number | null
  scoreAprendizado: number | null
  totalKpisAvaliados: number
  atingidos: number
  proximos: number
  abaixo: number
  // Para grupos quando houver comparativo por empresa:
  scorePorEmpresa?: Record<string, number | null>
}

export interface EvolucaoScoreBscResult {
  ano: number
  temKpisNoAno: boolean
  totalKpis: number
  scoreMedioAno: number | null
  scoreUltimoMesComDados: number | null
  melhorMes: { mesNome: string; score: number } | null
  mesesComDadosCount: number
  serieMensal: PontoMesScoreBsc[]
  empresasDoGrupo?: Array<{ id: string; nome: string }>
}

/**
 * Calcula o atingimento percentual de um KPI (0% a 150%) com base no sentido.
 */
export function calcularAtingimentoKpiIndividual(
  kpi: BscKpiRecord,
  valorReal: number | null | undefined,
): { pct: number; status: 'atingido' | 'proximo' | 'abaixo' | 'indefinido' } {
  if (valorReal === null || valorReal === undefined || isNaN(valorReal)) {
    return { pct: 0, status: 'indefinido' }
  }

  const meta = kpi.meta
  if (meta === 0) {
    return { pct: 100, status: 'atingido' }
  }

  let pct = 0
  if (kpi.sentido === 'maior_melhor') {
    pct = (valorReal / meta) * 100
  } else {
    if (valorReal <= 0) {
      pct = 120
    } else {
      pct = (meta / valorReal) * 100
    }
  }

  const pctClamped = Math.max(0, Math.min(150, pct))
  const rounded = Math.round(pctClamped)

  let status: 'atingido' | 'proximo' | 'abaixo' = 'abaixo'
  if (rounded >= 95) {
    status = 'atingido'
  } else if (rounded >= 75) {
    status = 'proximo'
  } else {
    status = 'abaixo'
  }

  return { pct: rounded, status }
}

/**
 * Extrai as fórmulas financeiras de um determinado Balanço e DRE pontuais.
 */
export function extrairFormulasDemonstracoes(
  balanco: BalancoRecord | null,
  dre: DreRecord | null,
  dreAnterior: DreRecord | null = null,
): Record<string, number | null> {
  const calcB = balanco ? calcularBalanco(balanco) : null
  const calcD = dre ? calcularDre(dre) : null
  const calcInd = calcularIndicadores(balanco, dre)
  const calcGiro = calcularCapitalGiro(balanco, dre)

  let crescimentoReceita: number | null = null
  const recAtual = calcD?.receitaLiquida || 0
  const dreAntCalc = dreAnterior ? calcularDre(dreAnterior) : null
  const recAnt = dreAntCalc?.receitaLiquida || 0
  if (recAtual > 0 && recAnt > 0) {
    crescimentoReceita = ((recAtual - recAnt) / recAnt) * 100
  }

  return {
    liquidez_corrente: calcInd.liquidezCorrente,
    liquidez_seca: calcInd.liquidezSeca,
    liquidez_imediata: calcInd.liquidezImediata,
    liquidez_geral: calcInd.liquidezGeral,
    endividamento_geral: calcInd.endividamentoGeral,
    composicao_endividamento: calcInd.composicaoEndividamento,
    margem_bruta: calcInd.margemBruta,
    margem_operacional: calcInd.margemOperacional,
    margem_liquida: calcInd.margemLiquida,
    roe: calcInd.roe,
    roa: calcInd.roa,
    ebitda: calcD?.ebitda ?? null,
    crescimento_receita: crescimentoReceita,
    pmr: calcGiro.pmr,
    pmp: calcGiro.pmp,
    pme: calcGiro.pme,
    ciclo_operacional: calcGiro.cicloOperacional,
    ciclo_financeiro: calcGiro.cicloFinanceiro,
  }
}

/**
 * Calcula o score BSC (global e por perspectiva) para um conjunto de KPIs e um mapa de fórmulas.
 */
export function calcularScoreBscMomento(
  kpis: BscKpiRecord[],
  formulasCalculadas: Record<string, number | null>,
): {
  scoreGlobal: number | null
  scorePorPerspectiva: Record<BscPerspectiva, number | null>
  totalAvaliados: number
  atingidos: number
  proximos: number
  abaixo: number
} {
  const PERSPECTIVAS: BscPerspectiva[] = [
    'financeira',
    'clientes',
    'processos_internos',
    'aprendizado_crescimento',
  ]

  let somaGlobal = 0
  let somaPesosGlobal = 0
  let totalAvaliados = 0
  let atingidos = 0
  let proximos = 0
  let abaixo = 0

  const scorePorPerspectiva: Record<BscPerspectiva, number | null> = {
    financeira: null,
    clientes: null,
    processos_internos: null,
    aprendizado_crescimento: null,
  }

  PERSPECTIVAS.forEach((persp) => {
    const kpisPersp = kpis.filter((k) => k.perspectiva === persp)
    let somaP = 0
    let pesoP = 0

    kpisPersp.forEach((k) => {
      let real: number | null = null
      if (k.tipo === 'auto' && k.formula) {
        real = formulasCalculadas[k.formula] ?? null
      } else {
        real = k.valor_atual ?? 0
      }

      if (real !== null && real !== undefined && !isNaN(real)) {
        const { pct, status } = calcularAtingimentoKpiIndividual(k, real)
        const pPeso = k.peso && k.peso > 0 ? k.peso : 10
        somaP += pct * pPeso
        pesoP += pPeso
        totalAvaliados++
        if (status === 'atingido') atingidos++
        else if (status === 'proximo') proximos++
        else abaixo++
      }
    })

    if (pesoP > 0) {
      const sc = Math.round(somaP / pesoP)
      scorePorPerspectiva[persp] = sc
      somaGlobal += sc * 25
      somaPesosGlobal += 25
    }
  })

  const scoreGlobal = somaPesosGlobal > 0 ? Math.round(somaGlobal / somaPesosGlobal) : null

  return {
    scoreGlobal,
    scorePorPerspectiva,
    totalAvaliados,
    atingidos,
    proximos,
    abaixo,
  }
}

/**
 * Calcula a evolução do Score BSC ao longo dos 12 meses do ano selecionado para uma empresa específica
 * ou consolidada para um grupo empresarial.
 */
export function calcularEvolucaoMensalScoreBsc(params: {
  ano: number
  kpis: BscKpiRecord[]
  balancos: BalancoRecord[]
  dres: DreRecord[]
  isGrupo?: boolean
  empresasDoGrupo?: Array<{ id: string; nome: string }>
  kpisPorEmpresa?: Map<string, BscKpiRecord[]>
}): EvolucaoScoreBscResult {
  const { ano, kpis, balancos, dres, isGrupo, empresasDoGrupo, kpisPorEmpresa } = params

  if (kpis.length === 0) {
    return {
      ano,
      temKpisNoAno: false,
      totalKpis: 0,
      scoreMedioAno: null,
      scoreUltimoMesComDados: null,
      melhorMes: null,
      mesesComDadosCount: 0,
      serieMensal: NOMES_MESES.map((nome, idx) => ({
        mesNum: idx + 1,
        mesNome: nome,
        mesAbrev: NOMES_MESES_ABREV[idx],
        temDados: false,
        scoreGlobal: null,
        scoreFinanceira: null,
        scoreClientes: null,
        scoreProcessos: null,
        scoreAprendizado: null,
        totalKpisAvaliados: 0,
        atingidos: 0,
        proximos: 0,
        abaixo: 0,
      })),
      empresasDoGrupo,
    }
  }

  // 1. Identificar quais meses possuem Balanço ou DRE registrados no ano
  const balancosDoAno = balancos.filter((b) => b.ano === ano)
  const dresDoAno = dres.filter((d) => d.ano === ano)
  const dresAnoAnterior = dres.filter((d) => d.ano === ano - 1)

  const mesesComBalancoOuDre = new Set<number>()
  balancosDoAno.forEach((b) => {
    if (b.mes && b.mes >= 1 && b.mes <= 12) mesesComBalancoOuDre.add(b.mes)
  })
  dresDoAno.forEach((d) => {
    if (d.mes && d.mes >= 1 && d.mes <= 12) mesesComBalancoOuDre.add(d.mes)
  })

  // Se nenhum registro tiver mes cadastrado ou se só tiver 12 (anual fechado),
  // consideramos que o mês 12 tem dados ou os meses cadastrados
  const existeDetalhamentoMensal = Array.from(mesesComBalancoOuDre).some((m) => m < 12)

  // DRE ano anterior consolidado para crescimento de receita
  const dreAntConsolidada = dresAnoAnterior.length > 0 ? dresAnoAnterior[0] : null

  // 2. Montar a série mês a mês (1 a 12)
  const serieMensal: PontoMesScoreBsc[] = []
  let somaScoresValidos = 0
  let countScoresValidos = 0
  let ultimoMesComDadosVal: number | null = null
  let melhorMesObj: { mesNome: string; score: number } | null = null

  // Balanço acumulador até o mês
  let ultimoBalancoAcumulado: BalancoRecord | null = null

  for (let m = 1; m <= 12; m++) {
    const nomeMes = NOMES_MESES[m - 1]
    const abrevMes = NOMES_MESES_ABREV[m - 1]

    // Buscar Balanço e DRE do mês m
    const bMes = balancosDoAno.find((b) => (b.mes ?? 12) === m) || null
    if (bMes) {
      ultimoBalancoAcumulado = bMes
    }
    const dMes = dresDoAno.find((d) => (d.mes ?? 12) === m) || null

    let temDadosNoMes = false
    let formulasMes: Record<string, number | null> = {}

    if (existeDetalhamentoMensal) {
      // Se há meses detalhados, o mês tem dados se há balanço ou DRE daquele mês
      temDadosNoMes = Boolean(bMes || dMes)
      if (temDadosNoMes) {
        formulasMes = extrairFormulasDemonstracoes(
          bMes || ultimoBalancoAcumulado,
          dMes,
          dreAntConsolidada,
        )
      }
    } else {
      // Modo anual único (geralmente salvo em mês 12 ou sem mês explícito)
      // Se m === 12 e há dados do ano, mês 12 é o mês ativo
      const temDadosAnuais = balancosDoAno.length > 0 || dresDoAno.length > 0
      if (m === 12 && temDadosAnuais) {
        temDadosNoMes = true
        formulasMes = extrairFormulasDemonstracoes(
          balancosDoAno[0] || null,
          dresDoAno[0] || null,
          dreAntConsolidada,
        )
      } else {
        temDadosNoMes = false
      }
    }

    if (!temDadosNoMes) {
      // Mês sem dados de balancete/DRE
      serieMensal.push({
        mesNum: m,
        mesNome: nomeMes,
        mesAbrev: abrevMes,
        temDados: false,
        scoreGlobal: null,
        scoreFinanceira: null,
        scoreClientes: null,
        scoreProcessos: null,
        scoreAprendizado: null,
        totalKpisAvaliados: 0,
        atingidos: 0,
        proximos: 0,
        abaixo: 0,
      })
      continue
    }

    // Calcular score no mês
    const calculo = calcularScoreBscMomento(kpis, formulasMes)

    // Scores por empresa (para grupos)
    let scorePorEmpresa: Record<string, number | null> | undefined = undefined
    if (isGrupo && empresasDoGrupo && kpisPorEmpresa) {
      scorePorEmpresa = {}
      empresasDoGrupo.forEach((emp) => {
        const kpisEmp = kpisPorEmpresa.get(emp.id) || []
        if (kpisEmp.length > 0) {
          const bEmpMes = balancosDoAno.find((b) => b.empresa === emp.id && (b.mes ?? 12) === m)
          const dEmpMes = dresDoAno.find((d) => d.empresa === emp.id && (d.mes ?? 12) === m)
          const formEmp = extrairFormulasDemonstracoes(bEmpMes || null, dEmpMes || null)
          const resEmp = calcularScoreBscMomento(kpisEmp, formEmp)
          scorePorEmpresa![emp.id] = resEmp.scoreGlobal
        } else {
          scorePorEmpresa![emp.id] = null
        }
      })
    }

    const scGlobal = calculo.scoreGlobal

    if (scGlobal !== null) {
      somaScoresValidos += scGlobal
      countScoresValidos++
      ultimoMesComDadosVal = scGlobal
      if (!melhorMesObj || scGlobal > melhorMesObj.score) {
        melhorMesObj = { mesNome: nomeMes, score: scGlobal }
      }
    }

    serieMensal.push({
      mesNum: m,
      mesNome: nomeMes,
      mesAbrev: abrevMes,
      temDados: true,
      scoreGlobal: scGlobal,
      scoreFinanceira: calculo.scorePorPerspectiva.financeira,
      scoreClientes: calculo.scorePorPerspectiva.clientes,
      scoreProcessos: calculo.scorePorPerspectiva.processos_internos,
      scoreAprendizado: calculo.scorePorPerspectiva.aprendizado_crescimento,
      totalKpisAvaliados: calculo.totalAvaliados,
      atingidos: calculo.atingidos,
      proximos: calculo.proximos,
      abaixo: calculo.abaixo,
      scorePorEmpresa,
    })
  }

  const scoreMedioAno =
    countScoresValidos > 0 ? Math.round(somaScoresValidos / countScoresValidos) : null

  return {
    ano,
    temKpisNoAno: true,
    totalKpis: kpis.length,
    scoreMedioAno,
    scoreUltimoMesComDados: ultimoMesComDadosVal,
    melhorMes: melhorMesObj,
    mesesComDadosCount: countScoresValidos,
    serieMensal,
    empresasDoGrupo,
  }
}
