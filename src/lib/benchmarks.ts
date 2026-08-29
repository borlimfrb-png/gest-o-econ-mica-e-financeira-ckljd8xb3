import type { SegmentoEmpresa, BalancoRecord, DreRecord } from '@/types/finance'
import {
  calcularBalanco,
  calcularDre,
  calcularIndicadores,
  calcularKanitz,
} from '@/lib/financeCalculations'

export type PerfilPesosId = 'industria' | 'comercio' | 'servicos' | 'tecnologia' | 'personalizado'

export interface PesosGrupos {
  liquidez: number // 0 a 100
  endividamento: number
  rentabilidade: number
  estruturaCapital: number
  ebitda: number
  eficienciaOperacional: number
  economicos: number
  capitalGiro?: number
}

export interface PerfilConfig {
  id: PerfilPesosId
  nome: string
  descricao: string
  pesos: PesosGrupos
}

export const PERFIS_PESOS_PREDEFINIDOS: Record<PerfilPesosId, PerfilConfig> = {
  industria: {
    id: 'industria',
    nome: 'Indústria',
    descricao: 'Maior peso em Liquidez (25%), Endividamento (25%) e Eficiência Operacional (25%)',
    pesos: {
      liquidez: 25,
      endividamento: 25,
      rentabilidade: 10,
      estruturaCapital: 5,
      ebitda: 5,
      eficienciaOperacional: 25,
      economicos: 5,
    },
  },
  comercio: {
    id: 'comercio',
    nome: 'Comércio',
    descricao: 'Maior peso em Liquidez (30%) e Eficiência Operacional (30%)',
    pesos: {
      liquidez: 30,
      endividamento: 15,
      rentabilidade: 15,
      estruturaCapital: 5,
      ebitda: 5,
      eficienciaOperacional: 30,
      economicos: 0,
    },
  },
  servicos: {
    id: 'servicos',
    nome: 'Serviços',
    descricao: 'Maior peso em Rentabilidade (30%) e EBITDA (25%)',
    pesos: {
      liquidez: 15,
      endividamento: 10,
      rentabilidade: 30,
      estruturaCapital: 10,
      ebitda: 25,
      eficienciaOperacional: 5,
      economicos: 5,
    },
  },
  tecnologia: {
    id: 'tecnologia',
    nome: 'Tecnologia',
    descricao: 'Maior peso em Rentabilidade (25%), Econômicos (25%) e EBITDA (20%)',
    pesos: {
      liquidez: 10,
      endividamento: 10,
      rentabilidade: 25,
      estruturaCapital: 5,
      ebitda: 20,
      eficienciaOperacional: 5,
      economicos: 25,
    },
  },
  personalizado: {
    id: 'personalizado',
    nome: 'Personalizado',
    descricao: 'Pesos ajustados manualmente pelo consultor conforme o perfil do cliente',
    pesos: {
      liquidez: 20,
      endividamento: 20,
      rentabilidade: 20,
      estruturaCapital: 10,
      ebitda: 15,
      eficienciaOperacional: 10,
      economicos: 5,
    },
  },
}

export interface BenchmarkSetorValores {
  setor: string
  descricao: string
  // 1. Liquidez
  liquidezCorrente: number
  liquidezSeca: number
  liquidezImediata: number
  liquidezGeral: number

  // 2. Endividamento
  endividamentoGeral: number // %
  composicaoEndividamento: number // %
  participacaoCapitalTerceiros: number // %
  imobilizacaoPL: number // %

  // 3. Rentabilidade
  margemBruta: number // %
  margemOperacional: number // %
  margemLiquida: number // %
  roa: number // %
  roe: number // %
  giroAtivo: number // x

  // 4. Estrutura de Capital
  autonomiaFinanceira: number // %
  dependenciaFinanceira: number // %
  dividaEquity: number // x

  // 5. EBITDA
  margemEbitda: number // %
  coberturaJuros: number // x

  // 6. Eficiência Operacional
  pme: number // dias
  pmr: number // dias
  pmp: number // dias
  cicloOperacional: number // dias
  cicloFinanceiro: number // dias
  giroEstoque: number // x
  giroReceber: number // x
  giroFornecedores: number // x

  // 7. Econômicos
  roic: number // %
  wacc: number // %
  spread: number // %
}

// Benchmarks Médios de Mercado por Setor
export const BENCHMARKS_SETORIAIS: Record<string, BenchmarkSetorValores> = {
  Indústria: {
    setor: 'Indústria',
    descricao: 'Setor industrial, manufatura e transformação',
    liquidezCorrente: 1.45,
    liquidezSeca: 0.95,
    liquidezImediata: 0.18,
    liquidezGeral: 1.25,

    endividamentoGeral: 52.0,
    composicaoEndividamento: 48.0,
    participacaoCapitalTerceiros: 110.0,
    imobilizacaoPL: 68.0,

    margemBruta: 28.0,
    margemOperacional: 11.5,
    margemLiquida: 7.2,
    roa: 6.8,
    roe: 14.5,
    giroAtivo: 0.95,

    autonomiaFinanceira: 48.0,
    dependenciaFinanceira: 52.0,
    dividaEquity: 1.08,

    margemEbitda: 16.5,
    coberturaJuros: 3.2,

    pme: 65,
    pmr: 48,
    pmp: 45,
    cicloOperacional: 113,
    cicloFinanceiro: 68,
    giroEstoque: 5.5,
    giroReceber: 7.5,
    giroFornecedores: 8.0,

    roic: 11.5,
    wacc: 12.0,
    spread: -0.5,
  },
  Comércio: {
    setor: 'Comércio',
    descricao: 'Varejo, atacado e distribuição mercantil',
    liquidezCorrente: 1.35,
    liquidezSeca: 0.75,
    liquidezImediata: 0.15,
    liquidezGeral: 1.15,

    endividamentoGeral: 58.0,
    composicaoEndividamento: 65.0,
    participacaoCapitalTerceiros: 138.0,
    imobilizacaoPL: 45.0,

    margemBruta: 32.0,
    margemOperacional: 8.0,
    margemLiquida: 5.5,
    roa: 7.5,
    roe: 16.0,
    giroAtivo: 1.45,

    autonomiaFinanceira: 42.0,
    dependenciaFinanceira: 58.0,
    dividaEquity: 1.38,

    margemEbitda: 11.0,
    coberturaJuros: 2.8,

    pme: 50,
    pmr: 32,
    pmp: 42,
    cicloOperacional: 82,
    cicloFinanceiro: 40,
    giroEstoque: 7.2,
    giroReceber: 11.2,
    giroFornecedores: 8.5,

    roic: 13.0,
    wacc: 12.0,
    spread: 1.0,
  },
  Serviços: {
    setor: 'Serviços',
    descricao: 'Prestação de serviços corporativos, consultorias e terceirização',
    liquidezCorrente: 1.65,
    liquidezSeca: 1.6,
    liquidezImediata: 0.35,
    liquidezGeral: 1.45,

    endividamentoGeral: 42.0,
    composicaoEndividamento: 60.0,
    participacaoCapitalTerceiros: 72.0,
    imobilizacaoPL: 30.0,

    margemBruta: 45.0,
    margemOperacional: 18.0,
    margemLiquida: 14.0,
    roa: 12.5,
    roe: 21.0,
    giroAtivo: 1.1,

    autonomiaFinanceira: 58.0,
    dependenciaFinanceira: 42.0,
    dividaEquity: 0.72,

    margemEbitda: 22.0,
    coberturaJuros: 4.5,

    pme: 5,
    pmr: 38,
    pmp: 28,
    cicloOperacional: 43,
    cicloFinanceiro: 15,
    giroEstoque: 20.0,
    giroReceber: 9.5,
    giroFornecedores: 12.8,

    roic: 18.5,
    wacc: 12.0,
    spread: 6.5,
  },
  Tecnologia: {
    setor: 'Tecnologia',
    descricao: 'Software, SaaS, tecnologia da informação e startups',
    liquidezCorrente: 2.1,
    liquidezSeca: 2.05,
    liquidezImediata: 0.65,
    liquidezGeral: 1.85,

    endividamentoGeral: 35.0,
    composicaoEndividamento: 55.0,
    participacaoCapitalTerceiros: 54.0,
    imobilizacaoPL: 25.0,

    margemBruta: 68.0,
    margemOperacional: 24.0,
    margemLiquida: 18.5,
    roa: 15.0,
    roe: 24.0,
    giroAtivo: 0.85,

    autonomiaFinanceira: 65.0,
    dependenciaFinanceira: 35.0,
    dividaEquity: 0.54,

    margemEbitda: 28.0,
    coberturaJuros: 6.0,

    pme: 0,
    pmr: 30,
    pmp: 25,
    cicloOperacional: 30,
    cicloFinanceiro: 5,
    giroEstoque: 0,
    giroReceber: 12.0,
    giroFornecedores: 14.4,

    roic: 22.0,
    wacc: 12.0,
    spread: 10.0,
  },
  Agronegócio: {
    setor: 'Agronegócio',
    descricao: 'Produção agrícola, pecuária e agroindústria',
    liquidezCorrente: 1.4,
    liquidezSeca: 0.8,
    liquidezImediata: 0.15,
    liquidezGeral: 1.2,

    endividamentoGeral: 55.0,
    composicaoEndividamento: 40.0,
    participacaoCapitalTerceiros: 122.0,
    imobilizacaoPL: 75.0,

    margemBruta: 26.0,
    margemOperacional: 12.0,
    margemLiquida: 8.5,
    roa: 6.5,
    roe: 14.0,
    giroAtivo: 0.8,

    autonomiaFinanceira: 45.0,
    dependenciaFinanceira: 55.0,
    dividaEquity: 1.22,

    margemEbitda: 18.0,
    coberturaJuros: 2.9,

    pme: 90,
    pmr: 60,
    pmp: 60,
    cicloOperacional: 150,
    cicloFinanceiro: 90,
    giroEstoque: 4.0,
    giroReceber: 6.0,
    giroFornecedores: 6.0,

    roic: 10.5,
    wacc: 12.0,
    spread: -1.5,
  },
  Construção: {
    setor: 'Construção',
    descricao: 'Construção civil, incorporação e engenharia',
    liquidezCorrente: 1.3,
    liquidezSeca: 0.65,
    liquidezImediata: 0.12,
    liquidezGeral: 1.15,

    endividamentoGeral: 60.0,
    composicaoEndividamento: 45.0,
    participacaoCapitalTerceiros: 150.0,
    imobilizacaoPL: 55.0,

    margemBruta: 24.0,
    margemOperacional: 10.0,
    margemLiquida: 6.5,
    roa: 5.5,
    roe: 13.5,
    giroAtivo: 0.75,

    autonomiaFinanceira: 40.0,
    dependenciaFinanceira: 60.0,
    dividaEquity: 1.5,

    margemEbitda: 14.0,
    coberturaJuros: 2.6,

    pme: 120,
    pmr: 75,
    pmp: 65,
    cicloOperacional: 195,
    cicloFinanceiro: 130,
    giroEstoque: 3.0,
    giroReceber: 4.8,
    giroFornecedores: 5.5,

    roic: 9.5,
    wacc: 12.0,
    spread: -2.5,
  },
  Saúde: {
    setor: 'Saúde',
    descricao: 'Hospitais, clínicas, laboratórios e medicina diagnóstica',
    liquidezCorrente: 1.5,
    liquidezSeca: 1.35,
    liquidezImediata: 0.22,
    liquidezGeral: 1.3,

    endividamentoGeral: 48.0,
    composicaoEndividamento: 52.0,
    participacaoCapitalTerceiros: 92.0,
    imobilizacaoPL: 60.0,

    margemBruta: 35.0,
    margemOperacional: 14.0,
    margemLiquida: 9.5,
    roa: 8.0,
    roe: 16.5,
    giroAtivo: 0.9,

    autonomiaFinanceira: 52.0,
    dependenciaFinanceira: 48.0,
    dividaEquity: 0.92,

    margemEbitda: 19.0,
    coberturaJuros: 3.8,

    pme: 25,
    pmr: 65,
    pmp: 40,
    cicloOperacional: 90,
    cicloFinanceiro: 50,
    giroEstoque: 14.4,
    giroReceber: 5.5,
    giroFornecedores: 9.0,

    roic: 12.5,
    wacc: 12.0,
    spread: 0.5,
  },
  Educação: {
    setor: 'Educação',
    descricao: 'Instituições de ensino, faculdades e escolas',
    liquidezCorrente: 1.4,
    liquidezSeca: 1.38,
    liquidezImediata: 0.3,
    liquidezGeral: 1.25,

    endividamentoGeral: 46.0,
    composicaoEndividamento: 62.0,
    participacaoCapitalTerceiros: 85.0,
    imobilizacaoPL: 65.0,

    margemBruta: 42.0,
    margemOperacional: 15.0,
    margemLiquida: 11.0,
    roa: 9.0,
    roe: 17.0,
    giroAtivo: 0.85,

    autonomiaFinanceira: 54.0,
    dependenciaFinanceira: 46.0,
    dividaEquity: 0.85,

    margemEbitda: 20.0,
    coberturaJuros: 4.0,

    pme: 5,
    pmr: 42,
    pmp: 30,
    cicloOperacional: 47,
    cicloFinanceiro: 17,
    giroEstoque: 20.0,
    giroReceber: 8.5,
    giroFornecedores: 12.0,

    roic: 14.0,
    wacc: 12.0,
    spread: 2.0,
  },
  Financeiro: {
    setor: 'Financeiro',
    descricao: 'Fintechs, serviços financeiros e assessoria',
    liquidezCorrente: 1.8,
    liquidezSeca: 1.8,
    liquidezImediata: 0.7,
    liquidezGeral: 1.6,

    endividamentoGeral: 45.0,
    composicaoEndividamento: 50.0,
    participacaoCapitalTerceiros: 82.0,
    imobilizacaoPL: 20.0,

    margemBruta: 55.0,
    margemOperacional: 22.0,
    margemLiquida: 16.0,
    roa: 11.0,
    roe: 20.0,
    giroAtivo: 0.7,

    autonomiaFinanceira: 55.0,
    dependenciaFinanceira: 45.0,
    dividaEquity: 0.82,

    margemEbitda: 25.0,
    coberturaJuros: 5.5,

    pme: 0,
    pmr: 25,
    pmp: 20,
    cicloOperacional: 25,
    cicloFinanceiro: 5,
    giroEstoque: 0,
    giroReceber: 14.4,
    giroFornecedores: 18.0,

    roic: 17.0,
    wacc: 12.0,
    spread: 5.0,
  },
  Outros: {
    setor: 'Outros',
    descricao: 'Média multissetorial de referência geral de mercado',
    liquidezCorrente: 1.4,
    liquidezSeca: 1.0,
    liquidezImediata: 0.2,
    liquidezGeral: 1.25,

    endividamentoGeral: 50.0,
    composicaoEndividamento: 55.0,
    participacaoCapitalTerceiros: 100.0,
    imobilizacaoPL: 50.0,

    margemBruta: 35.0,
    margemOperacional: 12.0,
    margemLiquida: 8.0,
    roa: 7.5,
    roe: 15.0,
    giroAtivo: 1.0,

    autonomiaFinanceira: 50.0,
    dependenciaFinanceira: 50.0,
    dividaEquity: 1.0,

    margemEbitda: 17.0,
    coberturaJuros: 3.5,

    pme: 45,
    pmr: 45,
    pmp: 40,
    cicloOperacional: 90,
    cicloFinanceiro: 50,
    giroEstoque: 8.0,
    giroReceber: 8.0,
    giroFornecedores: 9.0,

    roic: 12.0,
    wacc: 12.0,
    spread: 0.0,
  },
}

export function getBenchmarkParaSegmento(segmento?: string | null): BenchmarkSetorValores {
  if (!segmento) return BENCHMARKS_SETORIAIS['Serviços']
  return BENCHMARKS_SETORIAIS[segmento] || BENCHMARKS_SETORIAIS['Outros']
}

// Funções de normalização de 0 a 100
// Para indicadores onde MAIOR é MELHOR:
// val / (referencia * 1.5) clamped em 0..100
function normalizeHigherBetter(val: number | null | undefined, ref: number, maxMult = 1.8): number {
  if (val === null || val === undefined || isNaN(val)) return 50
  if (ref <= 0) ref = 1
  const score = (val / (ref * maxMult)) * 100
  return Math.min(100, Math.max(0, Math.round(score)))
}

// Para indicadores onde MENOR é MELHOR (ex: Endividamento, Ciclo Financeiro, PME, PMR):
function normalizeLowerBetter(
  val: number | null | undefined,
  ref: number,
  worstMult = 2.0,
): number {
  if (val === null || val === undefined || isNaN(val)) return 50
  if (ref <= 0) ref = 1
  // se val == 0 -> score 100; se val == ref -> 65; se val == ref * worstMult -> 10
  if (val <= 0) return 95
  const ratio = val / ref
  const score = 100 - (ratio / worstMult) * 80
  return Math.min(100, Math.max(5, Math.round(score)))
}

export interface GrupoRadarItem {
  grupoId: keyof PesosGrupos
  grupoNome: string
  empresaScore: number // 0-100
  setorScore: number // 0-100 (normalmente 65 como baseline normalizado)
  empresaValorRealStr: string
  setorValorRealStr: string
  status: 'acima' | 'em_linha' | 'abaixo'
}

export interface IndicadoresConsolidadosEmpresa {
  // 1. Liquidez
  lc: number | null
  ls: number | null
  li: number | null
  lg: number | null

  // 2. Endividamento
  eg: number | null
  ce: number | null
  pct: number | null
  ipl: number | null

  // 3. Rentabilidade
  mb: number | null
  mo: number | null
  ml: number | null
  roa: number | null
  roe: number | null
  giroAtivo: number | null

  // 4. Estrutura
  af: number | null
  df: number | null
  de: number | null

  // 5. EBITDA
  ebitda: number | null
  margemEbitda: number | null
  coberturaJuros: number | null

  // 6. Eficiência Operacional
  pme: number | null
  pmr: number | null
  pmp: number | null
  co: number | null
  cf: number | null

  // 7. Econômicos
  nopat: number | null
  roic: number | null
  eva: number | null
  spread: number | null

  // 8. Capital de Giro
  cgb: number | null
  cgl: number | null
  ncg: number | null
  saldoTesouraria: number | null
  aco: number | null
  acf: number | null
  pco: number | null
  pcf: number | null
  tipoFleuriet: string | null
  tipoFleurietNome?: string | null
  tipoFleurietDescricao?: string | null

  // 9. Kanitz (Termômetro de Insolvência)
  kanitzFi: number | null
  kanitzClassificacao: 'solvente' | 'penumbra' | 'insolvente' | 'indefinido'
  kanitzStatusTexto: string
}

export function extrairIndicadoresCompletos(
  balanco?: Partial<BalancoRecord> | null,
  dre?: Partial<DreRecord> | null,
  wacc = 12,
): IndicadoresConsolidadosEmpresa {
  const calcB = calcularBalanco(balanco)
  const calcD = calcularDre(dre)
  const ind = calcularIndicadores(balanco, dre)
  const kanitzCalc = calcularKanitz(balanco, dre)

  const at = calcB.ativoTotal
  const ac = calcB.ativoCirculante
  const anc = calcB.ativoNaoCirculante
  const arlp = balanco?.realizavel_longo_prazo || 0
  const estoques = balanco?.estoques || 0
  const contasReceber = balanco?.contas_receber || 0
  const caixa = (balanco?.caixa_equivalentes || 0) + (balanco?.aplicacoes_financeiras || 0)
  const pc = calcB.passivoCirculante
  const pnc = calcB.passivoNaoCirculante
  const pl = calcB.patrimonioLiquido
  const fornecedores = balanco?.fornecedores || 0
  const passivoTotal = pc + pnc
  const passivoTotalEPL = passivoTotal + pl
  const imobilizado = balanco?.imobilizado || 0

  const rb = dre?.receita_bruta || 0
  const rl = calcD.receitaLiquida
  const cmv = dre?.custo_mercadorias || 0
  const ebit = calcD.resultadoOperacional
  const lair = calcD.resultadoAntesIR
  const irCsll = dre?.imposto_renda || 0
  const despFin = dre?.despesas_financeiras || 0
  const ebitda = calcD.ebitda

  // NOPAT
  let aliq = 0.34
  if (irCsll > 0 && lair > 0) {
    const t = irCsll / lair
    if (t > 0 && t <= 0.5) aliq = t
  }
  const nopat = ebit * (1 - aliq)

  // Capital Investido
  const passivoOp = fornecedores + (balanco?.obrigacoes_tributarias || 0)
  const capInvest = at > passivoOp && passivoOp > 0 ? at - passivoOp : at > pc ? at - pc : at
  const roic = capInvest > 0 ? (nopat / capInvest) * 100 : 0
  const eva = nopat - capInvest * (wacc / 100)
  const spread = roic - wacc

  // Eficiência Operacional
  const baseVendas = rb > 0 ? rb : rl
  const pme = cmv > 0 ? (estoques / cmv) * 360 : null
  const pmr = baseVendas > 0 ? (contasReceber / baseVendas) * 360 : null
  const pmp = cmv > 0 ? (fornecedores / cmv) * 360 : null
  const co = pme !== null && pmr !== null ? pme + pmr : null
  const cf = co !== null && pmp !== null ? co - pmp : null

  // Estrutura
  const af = at > 0 ? (pl / at) * 100 : null
  const dfInd = passivoTotalEPL > 0 ? (passivoTotal / passivoTotalEPL) * 100 : null
  const de = pl > 0 ? passivoTotal / pl : null

  // EBITDA
  const margemEbitda = rl > 0 ? (ebitda / rl) * 100 : null
  const coberturaJuros = despFin > 0 ? ebitda / despFin : null

  // Capital de Giro
  const acf = (balanco?.caixa_equivalentes || 0) + (balanco?.aplicacoes_financeiras || 0)
  const aco =
    (balanco?.contas_receber || 0) +
    (balanco?.estoques || 0) +
    (balanco?.impostos_recuperar || 0) +
    (balanco?.outros_ativo_circulante || 0)
  const pcf = balanco?.emprestimos_curto_prazo || 0
  const pco =
    (balanco?.fornecedores || 0) +
    (balanco?.obrigacoes_trabalhistas || 0) +
    (balanco?.obrigacoes_tributarias || 0) +
    (balanco?.outros_passivo_circulante || 0)

  const cgb = ac > 0 ? ac : null
  const cgl = ac > 0 || pc > 0 ? ac - pc : null
  const ncg = aco > 0 || pco > 0 ? aco - pco : null
  const saldoTesouraria = acf > 0 || pcf > 0 || (cgl !== null && ncg !== null) ? acf - pcf : null

  // Diagnóstico Modelo Fleuriet
  let tipoFleuriet: string | null = null
  let tipoFleurietNome: string | null = null
  let tipoFleurietDescricao: string | null = null

  if (ac > 0 || pc > 0) {
    const cglVal = cgl ?? 0
    const ncgVal = ncg ?? 0
    const stVal = saldoTesouraria ?? 0

    if (cglVal > 0 && ncgVal > 0 && stVal > 0) {
      tipoFleuriet = 'excelente'
      tipoFleurietNome = 'Tipo I — Excelente (Muito Sólida)'
      tipoFleurietDescricao =
        'O Capital de Giro Líquido financia integralmente a Necessidade de Capital de Giro e ainda gera Saldo de Tesouraria positivo e folga financeira.'
    } else if (cglVal > 0 && ncgVal <= 0 && stVal > 0) {
      tipoFleuriet = 'solida'
      tipoFleurietNome = 'Tipo II — Sólida com Financiamento Operacional'
      tipoFleurietDescricao =
        'A empresa opera com NCG negativa ou nula (financiada por fornecedores e clientes) e dispõe de CGL positivo, gerando tesouraria altamente superavitária.'
    } else if (cglVal > 0 && ncgVal > 0 && stVal < 0) {
      tipoFleuriet = 'em_crescimento'
      tipoFleurietNome = 'Tipo III — Em Crescimento (Tesouraria Pressionada)'
      tipoFleurietDescricao =
        'A Necessidade de Capital de Giro supera o Capital de Giro Líquido gerado, forçando o uso de empréstimos bancários de curto prazo para financiar a expansão operacional.'
    } else if (cglVal <= 0 && ncgVal > 0 && stVal < 0) {
      tipoFleuriet = 'arriscada'
      tipoFleurietNome = 'Tipo IV — Arriscada (Efeito Tesoura / Desequilíbrio)'
      tipoFleurietDescricao =
        'CGL negativo aliado a NCG positiva resulta em déficit expressivo de tesouraria. A empresa financia ativos de longo prazo e giro com dívidas bancárias onerosas de curto prazo.'
    } else if (cglVal <= 0 && ncgVal <= 0 && stVal < 0) {
      tipoFleuriet = 'alto_risco'
      tipoFleurietNome = 'Tipo V — Alto Risco / Desbalanceada'
      tipoFleurietDescricao =
        'Recursos de longo prazo insuficientes (CGL < 0) e tesouraria deficitária, dependente de rolagem contínua de dívidas bancárias de curto prazo.'
    } else if (cglVal <= 0 && stVal < 0) {
      tipoFleuriet = 'critica'
      tipoFleurietNome = 'Tipo VI — Crítica / Insolvência Iminente'
      tipoFleurietDescricao =
        'Passivo circulante muito superior ao ativo circulante com esgotamento das reservas de caixa e alto risco de descontinuidade operacional.'
    } else {
      tipoFleuriet = 'solida'
      tipoFleurietNome = 'Equilibrada'
      tipoFleurietDescricao =
        'Estrutura de capital de giro em conformidade estável com as operações do exercício.'
    }
  }

  return {
    lc: ind.liquidezCorrente,
    ls: ind.liquidezSeca,
    li: ind.liquidezImediata,
    lg: ind.liquidezGeral,

    eg: ind.endividamentoGeral,
    ce: ind.composicaoEndividamento,
    pct: ind.capitalTerceirosSobreProprio,
    ipl: ind.imobilizacaoPL,

    mb: ind.margemBruta,
    mo: ind.margemOperacional,
    ml: ind.margemLiquida,
    roa: ind.roa,
    roe: ind.roe,
    giroAtivo: at > 0 ? rl / at : null,

    af,
    df: dfInd,
    de,

    ebitda,
    margemEbitda,
    coberturaJuros,

    pme,
    pmr,
    pmp,
    co,
    cf,

    nopat,
    roic,
    eva,
    spread,

    cgb,
    cgl,
    ncg,
    saldoTesouraria,
    aco,
    acf,
    pco,
    pcf,
    tipoFleuriet,
    tipoFleurietNome,
    tipoFleurietDescricao,

    kanitzFi: kanitzCalc.fi,
    kanitzClassificacao: kanitzCalc.classificacao,
    kanitzStatusTexto: kanitzCalc.statusTexto,
  }
}

export function calcularScoresRadar(
  empresaInd: IndicadoresConsolidadosEmpresa,
  benchmark: BenchmarkSetorValores,
): GrupoRadarItem[] {
  // 1. Liquidez: LC (40%), LS (25%), LI (15%), LG (20%)
  const scoreLC = normalizeHigherBetter(empresaInd.lc, benchmark.liquidezCorrente)
  const scoreLS = normalizeHigherBetter(empresaInd.ls, benchmark.liquidezSeca)
  const scoreLI = normalizeHigherBetter(empresaInd.li, benchmark.liquidezImediata)
  const scoreLG = normalizeHigherBetter(empresaInd.lg, benchmark.liquidezGeral)
  const empresaLiq = Math.round(scoreLC * 0.4 + scoreLS * 0.25 + scoreLI * 0.15 + scoreLG * 0.2)
  const setorLiq = 65

  // 2. Endividamento: EG (40%), CE (30%), PCT (30%) - menor é melhor
  const scoreEG = normalizeLowerBetter(empresaInd.eg, benchmark.endividamentoGeral)
  const scoreCE = normalizeLowerBetter(empresaInd.ce, benchmark.composicaoEndividamento)
  const scorePCT = normalizeLowerBetter(empresaInd.pct, benchmark.participacaoCapitalTerceiros)
  const empresaEnd = Math.round(scoreEG * 0.4 + scoreCE * 0.3 + scorePCT * 0.3)
  const setorEnd = 65

  // 3. Rentabilidade: ROE (35%), ROA (25%), Margem Líquida (25%), Giro do Ativo (15%)
  const scoreROE = normalizeHigherBetter(empresaInd.roe, benchmark.roe)
  const scoreROA = normalizeHigherBetter(empresaInd.roa, benchmark.roa)
  const scoreML = normalizeHigherBetter(empresaInd.ml, benchmark.margemLiquida)
  const scoreGiro = normalizeHigherBetter(empresaInd.giroAtivo, benchmark.giroAtivo)
  const empresaRent = Math.round(
    scoreROE * 0.35 + scoreROA * 0.25 + scoreML * 0.25 + scoreGiro * 0.15,
  )
  const setorRent = 65

  // 4. Estrutura de Capital: Autonomia Financeira (50%), D/E (50%)
  const scoreAF = normalizeHigherBetter(empresaInd.af, benchmark.autonomiaFinanceira)
  const scoreDE = normalizeLowerBetter(empresaInd.de, benchmark.dividaEquity)
  const empresaEst = Math.round(scoreAF * 0.5 + scoreDE * 0.5)
  const setorEst = 65

  // 5. EBITDA: Margem EBITDA (60%), Cobertura Juros (40%)
  const scoreMargemEb = normalizeHigherBetter(empresaInd.margemEbitda, benchmark.margemEbitda)
  const scoreCobJuros = normalizeHigherBetter(empresaInd.coberturaJuros, benchmark.coberturaJuros)
  const empresaEb = Math.round(scoreMargemEb * 0.6 + scoreCobJuros * 0.4)
  const setorEb = 65

  // 6. Eficiência Operacional: Ciclo Financeiro (40%), PME (30%), PMR (30%)
  const scoreCF = normalizeLowerBetter(empresaInd.cf, benchmark.cicloFinanceiro)
  const scorePME = normalizeLowerBetter(empresaInd.pme, benchmark.pme)
  const scorePMR = normalizeLowerBetter(empresaInd.pmr, benchmark.pmr)
  const empresaEfic = Math.round(scoreCF * 0.4 + scorePME * 0.3 + scorePMR * 0.3)
  const setorEfic = 65

  // 7. Econômicos: ROIC vs WACC (Spread 60%), EVA (40%)
  const scoreSpread = normalizeHigherBetter(
    empresaInd.spread !== null ? empresaInd.spread + 10 : null,
    benchmark.spread + 10,
  )
  const scoreEVA = normalizeHigherBetter(empresaInd.eva, 50000)
  const empresaEcon = Math.round(scoreSpread * 0.6 + scoreEVA * 0.4)
  const setorEcon = 65

  const getStatus = (emp: number, set: number): 'acima' | 'em_linha' | 'abaixo' => {
    if (emp > set + 5) return 'acima'
    if (emp < set - 5) return 'abaixo'
    return 'em_linha'
  }

  return [
    {
      grupoId: 'liquidez',
      grupoNome: 'Liquidez',
      empresaScore: empresaLiq,
      setorScore: setorLiq,
      empresaValorRealStr: `LC: ${empresaInd.lc ? empresaInd.lc.toFixed(2) : '—'}`,
      setorValorRealStr: `LC: ${benchmark.liquidezCorrente.toFixed(2)}`,
      status: getStatus(empresaLiq, setorLiq),
    },
    {
      grupoId: 'endividamento',
      grupoNome: 'Endividamento',
      empresaScore: empresaEnd,
      setorScore: setorEnd,
      empresaValorRealStr: `End. Geral: ${empresaInd.eg ? `${empresaInd.eg.toFixed(1)}%` : '—'}`,
      setorValorRealStr: `End. Geral: ${benchmark.endividamentoGeral.toFixed(1)}%`,
      status: getStatus(empresaEnd, setorEnd),
    },
    {
      grupoId: 'rentabilidade',
      grupoNome: 'Rentabilidade',
      empresaScore: empresaRent,
      setorScore: setorRent,
      empresaValorRealStr: `ROE: ${empresaInd.roe ? `${empresaInd.roe.toFixed(1)}%` : '—'}`,
      setorValorRealStr: `ROE: ${benchmark.roe.toFixed(1)}%`,
      status: getStatus(empresaRent, setorRent),
    },
    {
      grupoId: 'estruturaCapital',
      grupoNome: 'Estrutura Capital',
      empresaScore: empresaEst,
      setorScore: setorEst,
      empresaValorRealStr: `Autonomia: ${empresaInd.af ? `${empresaInd.af.toFixed(1)}%` : '—'}`,
      setorValorRealStr: `Autonomia: ${benchmark.autonomiaFinanceira.toFixed(1)}%`,
      status: getStatus(empresaEst, setorEst),
    },
    {
      grupoId: 'ebitda',
      grupoNome: 'EBITDA',
      empresaScore: empresaEb,
      setorScore: setorEb,
      empresaValorRealStr: `Mg. EBITDA: ${empresaInd.margemEbitda ? `${empresaInd.margemEbitda.toFixed(1)}%` : '—'}`,
      setorValorRealStr: `Mg. EBITDA: ${benchmark.margemEbitda.toFixed(1)}%`,
      status: getStatus(empresaEb, setorEb),
    },
    {
      grupoId: 'eficienciaOperacional',
      grupoNome: 'Eficiência Operacional',
      empresaScore: empresaEfic,
      setorScore: setorEfic,
      empresaValorRealStr: `Ciclo Fin.: ${empresaInd.cf !== null ? `${Math.round(empresaInd.cf)}d` : '—'}`,
      setorValorRealStr: `Ciclo Fin.: ${benchmark.cicloFinanceiro}d`,
      status: getStatus(empresaEfic, setorEfic),
    },
  ]
}

export function calcularScoreGeralPonderado(
  scoresRadar: GrupoRadarItem[],
  pesos: PesosGrupos,
): number {
  let somaPonderada = 0
  let somaPesos = 0

  scoresRadar.forEach((item) => {
    const peso = pesos[item.grupoId] || 0
    somaPonderada += item.empresaScore * peso
    somaPesos += peso
  })

  if (somaPesos === 0) return 50
  return Math.round(somaPonderada / somaPesos)
}
