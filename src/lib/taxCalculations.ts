import type { DreRecord } from '@/types/finance'

export interface ItemTributoBreakdown {
  nome: string
  sigla: string
  baseCalculo: number
  aliquotaNominal: number // em %
  valor: number
  descricao?: string
}

export interface RegimeResultado {
  id: 'simples' | 'presumido' | 'real'
  nome: string
  descricao: string
  baseCalculoPrincipal: number
  aliquotaEfetiva: number // em %
  impostoTotal: number
  economiaVsPior: number
  diferencaVsMelhor: number
  isRecomendado: boolean
  breakdown: ItemTributoBreakdown[]
  detalhesCalculo: {
    receitaBruta: number
    lucroLiquido: number
    folhaPagamentoEstimada: number
    adicionalIRPJ?: number
    presuncaoPercentual?: number
    faixaSimples?: string
  }
}

export interface AnaliseTributariaResultado {
  ano: number
  receitaBruta: number
  lucroLiquido: number
  folhaPagamento: number
  aliquotaIss: number
  regimes: {
    simples: RegimeResultado
    presumido: RegimeResultado
    real: RegimeResultado
  }
  regimeRecomendado: RegimeResultado
  maiorCustoRegime: RegimeResultado
  economiaMaximaAnual: number
  temDados: boolean
}

// Faixas do Simples Nacional (Anexo III - Serviços)
// Lei Complementar 123/2006
export interface FaixaSimples {
  faixa: number
  limiteSuperior: number
  aliquotaNominal: number // %
  deducao: number // R$
}

export const TABELA_SIMPLES_ANEXO_I: FaixaSimples[] = [
  { faixa: 1, limiteSuperior: 180000, aliquotaNominal: 4.0, deducao: 0 },
  { faixa: 2, limiteSuperior: 360000, aliquotaNominal: 7.3, deducao: 5940 },
  { faixa: 3, limiteSuperior: 720000, aliquotaNominal: 9.5, deducao: 13860 },
  { faixa: 4, limiteSuperior: 1800000, aliquotaNominal: 10.7, deducao: 22500 },
  { faixa: 5, limiteSuperior: 3600000, aliquotaNominal: 14.3, deducao: 87300 },
  { faixa: 6, limiteSuperior: 4800000, aliquotaNominal: 19.0, deducao: 378000 },
]

export const TABELA_SIMPLES_ANEXO_II: FaixaSimples[] = [
  { faixa: 1, limiteSuperior: 180000, aliquotaNominal: 4.5, deducao: 0 },
  { faixa: 2, limiteSuperior: 360000, aliquotaNominal: 7.8, deducao: 5940 },
  { faixa: 3, limiteSuperior: 720000, aliquotaNominal: 10.0, deducao: 13860 },
  { faixa: 4, limiteSuperior: 1800000, aliquotaNominal: 11.2, deducao: 22500 },
  { faixa: 5, limiteSuperior: 3600000, aliquotaNominal: 14.7, deducao: 85500 },
  { faixa: 6, limiteSuperior: 4800000, aliquotaNominal: 30.0, deducao: 720000 },
]

export const TABELA_SIMPLES_ANEXO_III: FaixaSimples[] = [
  { faixa: 1, limiteSuperior: 180000, aliquotaNominal: 6.0, deducao: 0 },
  { faixa: 2, limiteSuperior: 360000, aliquotaNominal: 11.2, deducao: 9360 },
  { faixa: 3, limiteSuperior: 720000, aliquotaNominal: 13.5, deducao: 17640 },
  { faixa: 4, limiteSuperior: 1800000, aliquotaNominal: 16.0, deducao: 35640 },
  { faixa: 5, limiteSuperior: 3600000, aliquotaNominal: 21.0, deducao: 125640 },
  { faixa: 6, limiteSuperior: 4800000, aliquotaNominal: 33.0, deducao: 558000 },
]

export const TABELA_SIMPLES_ANEXO_IV: FaixaSimples[] = [
  { faixa: 1, limiteSuperior: 180000, aliquotaNominal: 4.5, deducao: 0 },
  { faixa: 2, limiteSuperior: 360000, aliquotaNominal: 9.0, deducao: 8100 },
  { faixa: 3, limiteSuperior: 720000, aliquotaNominal: 10.2, deducao: 12420 },
  { faixa: 4, limiteSuperior: 1800000, aliquotaNominal: 14.0, deducao: 39780 },
  { faixa: 5, limiteSuperior: 3600000, aliquotaNominal: 22.0, deducao: 183780 },
  { faixa: 6, limiteSuperior: 4800000, aliquotaNominal: 33.0, deducao: 828000 },
]

export const TABELA_SIMPLES_ANEXO_V: FaixaSimples[] = [
  { faixa: 1, limiteSuperior: 180000, aliquotaNominal: 15.5, deducao: 0 },
  { faixa: 2, limiteSuperior: 360000, aliquotaNominal: 18.0, deducao: 4500 },
  { faixa: 3, limiteSuperior: 720000, aliquotaNominal: 19.5, deducao: 9900 },
  { faixa: 4, limiteSuperior: 1800000, aliquotaNominal: 20.5, deducao: 17100 },
  { faixa: 5, limiteSuperior: 3600000, aliquotaNominal: 23.0, deducao: 62100 },
  { faixa: 6, limiteSuperior: 4800000, aliquotaNominal: 30.5, deducao: 540000 },
]

export const TABELAS_SIMPLES: Record<string, FaixaSimples[]> = {
  'Anexo I': TABELA_SIMPLES_ANEXO_I,
  'Anexo I - Comércio': TABELA_SIMPLES_ANEXO_I,
  'Anexo II': TABELA_SIMPLES_ANEXO_II,
  'Anexo II - Indústria': TABELA_SIMPLES_ANEXO_II,
  'Anexo III': TABELA_SIMPLES_ANEXO_III,
  'Anexo III - Serviços': TABELA_SIMPLES_ANEXO_III,
  'Anexo IV': TABELA_SIMPLES_ANEXO_IV,
  'Anexo IV - Serviços Específicos': TABELA_SIMPLES_ANEXO_IV,
  'Anexo V': TABELA_SIMPLES_ANEXO_V,
  'Anexo V - Serviços Fator R': TABELA_SIMPLES_ANEXO_V,
}

export function obterTabelaSimplesPorAnexo(anexoNome?: string): FaixaSimples[] {
  if (!anexoNome) return TABELA_SIMPLES_ANEXO_I
  if (TABELAS_SIMPLES[anexoNome]) return TABELAS_SIMPLES[anexoNome]
  const anexoKey = Object.keys(TABELAS_SIMPLES).find((k) =>
    anexoNome.toLowerCase().includes(k.toLowerCase()),
  )
  return anexoKey ? TABELAS_SIMPLES[anexoKey] : TABELA_SIMPLES_ANEXO_I
}

/**
 * Calcula Simples Nacional para qualquer Anexo (I a V)
 * Fórmula oficial: Alíquota Efetiva = ((RBT12 * Alíquota Nominal) - Parcela a Deduzir) / RBT12
 */
export function calcularSimplesNacional(
  receitaBrutaAnual: number,
  folhaPagamento: number,
  anexo: string = 'Anexo I - Comércio',
): RegimeResultado {
  const rbt12 = Math.max(receitaBrutaAnual, 0)
  if (rbt12 === 0) {
    return {
      id: 'simples',
      nome: 'Simples Nacional',
      descricao: 'Regime simplificado unificado (Anexo III - Serviços)',
      baseCalculoPrincipal: 0,
      aliquotaEfetiva: 0,
      impostoTotal: 0,
      economiaVsPior: 0,
      diferencaVsMelhor: 0,
      isRecomendado: false,
      breakdown: [
        {
          nome: 'Guia Única DAS',
          sigla: 'DAS',
          baseCalculo: 0,
          aliquotaNominal: 0,
          valor: 0,
          descricao: 'Tributos federais e municipais unificados em guia única.',
        },
      ],
      detalhesCalculo: {
        receitaBruta: 0,
        lucroLiquido: 0,
        folhaPagamentoEstimada: folhaPagamento,
        faixaSimples: '1ª Faixa',
      },
    }
  }

  const tabela = obterTabelaSimplesPorAnexo(anexo)
  // Encontrar faixa
  let faixaSelecionada = tabela[0]
  let faixaNome = '1ª Faixa (Até R$ 180 mil)'
  for (let i = 0; i < tabela.length; i++) {
    const f = tabela[i]
    if (rbt12 <= f.limiteSuperior) {
      faixaSelecionada = f
      faixaNome = `${f.faixa}ª Faixa (Até R$ ${(f.limiteSuperior / 1000).toFixed(0)}k)`
      break
    }
    // se for maior que o teto da última faixa
    if (i === tabela.length - 1) {
      faixaSelecionada = f
      faixaNome = `6ª Faixa (Acima de R$ 3,6M - Teto R$ 4,8M)`
    }
  }

  // Alíquota efetiva = (RBT12 * Alíquota - Dedução) / RBT12
  const aliquotaEfetivaCalculada =
    (rbt12 * (faixaSelecionada.aliquotaNominal / 100) - faixaSelecionada.deducao) / rbt12
  const aliquotaEfetivaPercent = Math.max(aliquotaEfetivaCalculada * 100, 0)
  const impostoTotal = (rbt12 * aliquotaEfetivaPercent) / 100

  // Distribuição aproximada dos tributos embutidos na DAS Anexo III
  // CPP ~40-43%, ISS ~32-33%, IRPJ ~4-5%, CSLL ~3.5-4%, PIS ~2.5%, COFINS ~12.5%
  const cpp = impostoTotal * 0.42
  const iss = impostoTotal * 0.33
  const cofins = impostoTotal * 0.125
  const irpj = impostoTotal * 0.045
  const csll = impostoTotal * 0.045
  const pis = impostoTotal * 0.035

  const breakdown: ItemTributoBreakdown[] = [
    {
      nome: 'Contribuição Previdenciária Patronal',
      sigla: 'CPP (no DAS)',
      baseCalculo: rbt12,
      aliquotaNominal: (cpp / rbt12) * 100,
      valor: cpp,
      descricao: 'CPP unificada na guia DAS',
    },
    {
      nome: 'Imposto Sobre Serviços',
      sigla: 'ISS (no DAS)',
      baseCalculo: rbt12,
      aliquotaNominal: (iss / rbt12) * 100,
      valor: iss,
      descricao: 'ISS municipal unificado',
    },
    {
      nome: 'Contribuição COFINS',
      sigla: 'COFINS (no DAS)',
      baseCalculo: rbt12,
      aliquotaNominal: (cofins / rbt12) * 100,
      valor: cofins,
      descricao: 'Seguridade social unificada',
    },
    {
      nome: 'Imposto de Renda PJ',
      sigla: 'IRPJ (no DAS)',
      baseCalculo: rbt12,
      aliquotaNominal: (irpj / rbt12) * 100,
      valor: irpj,
      descricao: 'IRPJ unificado na guia',
    },
    {
      nome: 'Contribuição Social s/ Lucro',
      sigla: 'CSLL (no DAS)',
      baseCalculo: rbt12,
      aliquotaNominal: (csll / rbt12) * 100,
      valor: csll,
      descricao: 'CSLL unificada na guia',
    },
    {
      nome: 'Programa de Integração Social',
      sigla: 'PIS (no DAS)',
      baseCalculo: rbt12,
      aliquotaNominal: (pis / rbt12) * 100,
      valor: pis,
      descricao: 'PIS unificado na guia',
    },
  ]

  return {
    id: 'simples',
    nome: 'Simples Nacional',
    descricao: 'Regime unificado para micro e pequenas empresas (até R$ 4,8M/ano).',
    baseCalculoPrincipal: rbt12,
    aliquotaEfetiva: aliquotaEfetivaPercent,
    impostoTotal,
    economiaVsPior: 0,
    diferencaVsMelhor: 0,
    isRecomendado: false,
    breakdown,
    detalhesCalculo: {
      receitaBruta: rbt12,
      lucroLiquido: 0,
      folhaPagamentoEstimada: folhaPagamento,
      faixaSimples: faixaNome,
    },
  }
}

/**
 * Calcula Lucro Presumido (Serviços):
 * - Presunção para serviços: 32% da receita bruta
 * - IRPJ: 15% sobre o lucro presumido + adicional de 10% sobre o que exceder R$ 60.000/trimestre (R$ 240.000/ano)
 * - CSLL: 9% sobre o lucro presumido (32% da receita para serviços)
 * - PIS: 0.65% sobre receita bruta cumulativo
 * - COFINS: 3.00% sobre receita bruta cumulativo
 * - ISS: alíquota municipal configurável (ex: 5%)
 */
export function calcularLucroPresumido(
  receitaBrutaAnual: number,
  folhaPagamento: number,
  aliquotaIssPercent: number = 5,
): RegimeResultado {
  const rb = Math.max(receitaBrutaAnual, 0)
  const presuncaoPct = 32
  const basePresumida = rb * (presuncaoPct / 100)

  // IRPJ: 15% da base + adicional 10% sobre excedente anual de R$ 240.000 (R$ 60k/trimestre * 4)
  const irpjBase = basePresumida * 0.15
  const limiteAnualAdicional = 240000 // R$ 60.000 x 4 trimestres
  const excedente = Math.max(basePresumida - limiteAnualAdicional, 0)
  const adicionalIRPJ = excedente * 0.1
  const irpjTotal = irpjBase + adicionalIRPJ

  // CSLL: 9% sobre a base presumida (32% da receita)
  const csllTotal = basePresumida * 0.09

  // PIS: 0,65% sobre receita bruta
  const pisTotal = rb * 0.0065

  // COFINS: 3% sobre receita bruta
  const cofinsTotal = rb * 0.03

  // ISS: alíquota municipal configurável sobre receita bruta
  const issAliquota = Math.max(Number(aliquotaIssPercent) || 0, 0)
  const issTotal = rb * (issAliquota / 100)

  const impostoTotal = irpjTotal + csllTotal + pisTotal + cofinsTotal + issTotal
  const aliquotaEfetiva = rb > 0 ? (impostoTotal / rb) * 100 : 0

  const breakdown: ItemTributoBreakdown[] = [
    {
      nome: 'Imposto de Renda Pessoa Jurídica',
      sigla: 'IRPJ (15% + 10% Adic.)',
      baseCalculo: basePresumida,
      aliquotaNominal: basePresumida > 0 ? (irpjTotal / basePresumida) * 100 : 15,
      valor: irpjTotal,
      descricao: `15% s/ Base Presumida de 32% (R$ ${formatLocalCurrency(basePresumida)})${adicionalIRPJ > 0 ? ` + Adicional 10% (R$ ${formatLocalCurrency(adicionalIRPJ)})` : ''}`,
    },
    {
      nome: 'Contribuição Social s/ Lucro Líquido',
      sigla: 'CSLL (9%)',
      baseCalculo: basePresumida,
      aliquotaNominal: 9,
      valor: csllTotal,
      descricao: '9% s/ Base Presumida de 32%',
    },
    {
      nome: 'Contribuição COFINS',
      sigla: 'COFINS (3.0%)',
      baseCalculo: rb,
      aliquotaNominal: 3.0,
      valor: cofinsTotal,
      descricao: '3,00% sobre a Receita Bruta (Regime Cumulativo)',
    },
    {
      nome: 'Programa de Integração Social',
      sigla: 'PIS (0.65%)',
      baseCalculo: rb,
      aliquotaNominal: 0.65,
      valor: pisTotal,
      descricao: '0,65% sobre a Receita Bruta (Regime Cumulativo)',
    },
    {
      nome: 'Imposto Sobre Serviços',
      sigla: `ISS (${issAliquota.toFixed(1)}%)`,
      baseCalculo: rb,
      aliquotaNominal: issAliquota,
      valor: issTotal,
      descricao: `${issAliquota.toFixed(1)}% sobre a Receita Bruta (Alíquota Municipal)`,
    },
  ]

  return {
    id: 'presumido',
    nome: 'Lucro Presumido',
    descricao: 'Tributação com base em margem pré-fixada pela legislação (32% para serviços).',
    baseCalculoPrincipal: basePresumida,
    aliquotaEfetiva,
    impostoTotal,
    economiaVsPior: 0,
    diferencaVsMelhor: 0,
    isRecomendado: false,
    breakdown,
    detalhesCalculo: {
      receitaBruta: rb,
      lucroLiquido: 0,
      folhaPagamentoEstimada: folhaPagamento,
      adicionalIRPJ,
      presuncaoPercentual: presuncaoPct,
    },
  }
}

/**
 * Calcula Lucro Real:
 * - IRPJ: 15% sobre o lucro líquido contábil (ajustado/real) + adicional 10% sobre o excedente de R$ 60.000/trimestre (R$ 240.000/ano)
 * - CSLL: 9% sobre o lucro líquido
 * - PIS: 1.65% sobre receita bruta (Regime não-cumulativo)
 * - COFINS: 7.60% sobre receita bruta (Regime não-cumulativo)
 * - ISS: mesma alíquota municipal configurável (ex: 5%)
 */
export function calcularLucroReal(
  receitaBrutaAnual: number,
  lucroLiquidoAnual: number,
  folhaPagamento: number,
  aliquotaIssPercent: number = 5,
): RegimeResultado {
  const rb = Math.max(receitaBrutaAnual, 0)
  const baseLucroReal = Math.max(lucroLiquidoAnual, 0)

  // IRPJ: 15% sobre o lucro real + adicional 10% sobre excedente anual de R$ 240.000
  let irpjBase = 0
  let adicionalIRPJ = 0
  let irpjTotal = 0
  let csllTotal = 0

  if (baseLucroReal > 0) {
    irpjBase = baseLucroReal * 0.15
    const limiteAnualAdicional = 240000
    const excedente = Math.max(baseLucroReal - limiteAnualAdicional, 0)
    adicionalIRPJ = excedente * 0.1
    irpjTotal = irpjBase + adicionalIRPJ

    // CSLL: 9% sobre o lucro real
    csllTotal = baseLucroReal * 0.09
  }

  // PIS: 1.65% sobre receita bruta
  const pisTotal = rb * 0.0165

  // COFINS: 7.60% sobre receita bruta
  const cofinsTotal = rb * 0.076

  // ISS: alíquota municipal sobre receita bruta
  const issAliquota = Math.max(Number(aliquotaIssPercent) || 0, 0)
  const issTotal = rb * (issAliquota / 100)

  const impostoTotal = irpjTotal + csllTotal + pisTotal + cofinsTotal + issTotal
  const aliquotaEfetiva = rb > 0 ? (impostoTotal / rb) * 100 : 0

  const breakdown: ItemTributoBreakdown[] = [
    {
      nome: 'Imposto de Renda Pessoa Jurídica',
      sigla: 'IRPJ (15% + 10% Adic.)',
      baseCalculo: baseLucroReal,
      aliquotaNominal: baseLucroReal > 0 ? (irpjTotal / baseLucroReal) * 100 : 15,
      valor: irpjTotal,
      descricao:
        baseLucroReal > 0
          ? `15% s/ Lucro Real Contábil (R$ ${formatLocalCurrency(baseLucroReal)})${adicionalIRPJ > 0 ? ` + Adicional 10% (R$ ${formatLocalCurrency(adicionalIRPJ)})` : ''}`
          : 'Isento no período por ausência de lucro tributável.',
    },
    {
      nome: 'Contribuição Social s/ Lucro Líquido',
      sigla: 'CSLL (9%)',
      baseCalculo: baseLucroReal,
      aliquotaNominal: 9,
      valor: csllTotal,
      descricao:
        baseLucroReal > 0
          ? '9% sobre o Lucro Real apurado no exercício'
          : 'Isento no período por ausência de lucro tributável.',
    },
    {
      nome: 'Contribuição COFINS',
      sigla: 'COFINS (7.6%)',
      baseCalculo: rb,
      aliquotaNominal: 7.6,
      valor: cofinsTotal,
      descricao: '7,60% sobre a Receita Bruta (Regime Não-Cumulativo)',
    },
    {
      nome: 'Programa de Integração Social',
      sigla: 'PIS (1.65%)',
      baseCalculo: rb,
      aliquotaNominal: 1.65,
      valor: pisTotal,
      descricao: '1,65% sobre a Receita Bruta (Regime Não-Cumulativo)',
    },
    {
      nome: 'Imposto Sobre Serviços',
      sigla: `ISS (${issAliquota.toFixed(1)}%)`,
      baseCalculo: rb,
      aliquotaNominal: issAliquota,
      valor: issTotal,
      descricao: `${issAliquota.toFixed(1)}% sobre a Receita Bruta (Alíquota Municipal)`,
    },
  ]

  return {
    id: 'real',
    nome: 'Lucro Real',
    descricao: 'Tributação apurada com base no resultado contábil efetivo do período.',
    baseCalculoPrincipal: baseLucroReal,
    aliquotaEfetiva,
    impostoTotal,
    economiaVsPior: 0,
    diferencaVsMelhor: 0,
    isRecomendado: false,
    breakdown,
    detalhesCalculo: {
      receitaBruta: rb,
      lucroLiquido: baseLucroReal,
      folhaPagamentoEstimada: folhaPagamento,
      adicionalIRPJ,
    },
  }
}

/**
 * Motor comparador de regimes tributários
 */
export function compararRegimesTributarios(options: {
  ano: number
  receitaBruta: number
  lucroLiquido: number
  folhaPagamento?: number
  aliquotaIssPercent?: number
  anexoSimples?: string
}): AnaliseTributariaResultado {
  const {
    ano,
    receitaBruta,
    lucroLiquido,
    folhaPagamento = 0,
    aliquotaIssPercent = 5,
    anexoSimples = 'Anexo I - Comércio',
  } = options

  const folha = folhaPagamento > 0 ? folhaPagamento : receitaBruta * 0.25 // estimativa 25% se não informada

  const simples = calcularSimplesNacional(receitaBruta, folha, anexoSimples)
  const presumido = calcularLucroPresumido(receitaBruta, folha, aliquotaIssPercent)
  const real = calcularLucroReal(receitaBruta, lucroLiquido, folha, aliquotaIssPercent)

  const lista = [simples, presumido, real]
  const temDados = receitaBruta > 0

  // Se a receita for > 4.8M, Simples Nacional não é permitido por lei
  const simplesPermitido = receitaBruta <= 4800000

  // Encontrar o menor imposto (melhor regime) e o maior imposto (pior regime)
  const listaValida = simplesPermitido ? lista : [presumido, real]
  const melhorRegime = [...listaValida].sort((a, b) => a.impostoTotal - b.impostoTotal)[0]
  const piorRegime = [...lista].sort((a, b) => b.impostoTotal - a.impostoTotal)[0]

  // Atribuir flags e diferenças de economia
  for (const reg of lista) {
    if (reg.id === melhorRegime.id) {
      reg.isRecomendado = temDados
    }
    reg.economiaVsPior = Math.max(piorRegime.impostoTotal - reg.impostoTotal, 0)
    reg.diferencaVsMelhor = Math.max(reg.impostoTotal - melhorRegime.impostoTotal, 0)
  }

  const economiaMaximaAnual = piorRegime.impostoTotal - melhorRegime.impostoTotal

  return {
    ano,
    receitaBruta,
    lucroLiquido,
    folhaPagamento: folha,
    aliquotaIss: aliquotaIssPercent,
    regimes: {
      simples,
      presumido,
      real,
    },
    regimeRecomendado: melhorRegime,
    maiorCustoRegime: piorRegime,
    economiaMaximaAnual: Math.max(economiaMaximaAnual, 0),
    temDados,
  }
}

function formatLocalCurrency(val: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val)
}

/**
 * =========================================================================
 * HELPERS PARA FORMAÇÃO DE PREÇO & TRIBUTAÇÃO (MÓDULO DE IMPOSTOS)
 * =========================================================================
 */

export interface ComparativoRegimesPrecoItem {
  regime: 'Simples Nacional' | 'Lucro Presumido' | 'Lucro Real'
  regimeDescricao: string
  cargaTributariaTotal: number // %
  fatorPorDentro: number
  precoVendaSugerido: number
  valorImpostosPreco: number
  valorMargemPreco: number
  valorCustoPreco: number
  markupMultiplicador: number
  isMenorCarga: boolean
  isRegimeAtual: boolean
  diferencaCargaVsMenor: number
  diferencaPrecoVsMenor: number
  detalhesTributos: {
    nome: string
    aliquota: number
    valorNoPreco: number
  }[]
}

export interface MatrizSensibilidadeItem {
  cargaTributaria: number // %
  margemDesejada: number // %
  precoFinal: number
  fatorGrossUp: number
  valorImposto: number
  valorMargem: number
  markup: number
  isAtual: boolean
}

/**
 * Calcula o preço de venda por dentro (Gross-Up)
 * Preço = Custo / (1 - (Margem% + DespVar% + CargaTrib%) / 100)
 */
export function calcularPrecoPorDentro(
  custo: number,
  margemPct: number,
  cargaTribPct: number,
  despVarPct: number = 0,
): {
  precoFinal: number
  divisor: number
  fatorPorDentro: number
  valorImpostos: number
  valorMargem: number
  valorDespVar: number
  markup: number
} {
  const c = Math.max(0, Number(custo) || 0)
  const m = Math.max(0, Number(margemPct) || 0)
  const t = Math.max(0, Number(cargaTribPct) || 0)
  const d = Math.max(0, Number(despVarPct) || 0)

  const somaDeducoes = (m + t + d) / 100
  const divisor = Math.max(0.001, 1 - somaDeducoes)

  let precoFinal = 0
  if (somaDeducoes < 0.999 && somaDeducoes >= 0 && c > 0) {
    precoFinal = c / divisor
  } else if (c > 0) {
    // fallback caso a soma de deduções passe de 100%
    const divisorSemImposto = Math.max(0.01, 1 - (m + d) / 100)
    precoFinal = (c / divisorSemImposto) * (1 + t / 100)
  }

  const fatorPorDentro = t < 100 ? 1 / Math.max(0.01, 1 - t / 100) : 1 + t / 100
  const valorImpostos = (precoFinal * t) / 100
  const valorMargem = (precoFinal * m) / 100
  const valorDespVar = (precoFinal * d) / 100
  const markup = c > 0 ? precoFinal / c : 1

  return {
    precoFinal: Math.round(precoFinal * 100) / 100,
    divisor,
    fatorPorDentro: Math.round(fatorPorDentro * 10000) / 10000,
    valorImpostos: Math.round(valorImpostos * 100) / 100,
    valorMargem: Math.round(valorMargem * 100) / 100,
    valorDespVar: Math.round(valorDespVar * 100) / 100,
    markup: Math.round(markup * 100) / 100,
  }
}

/**
 * Gera a tabela comparativa dos 3 regimes tributários lado a lado com impacto no preço de venda
 */
export function gerarComparativoRegimesPreco(params: {
  custo: number
  margemDesejada: number
  despesasVariaveis?: number
  regimeAtualConfigurado: 'Simples Nacional' | 'Lucro Presumido' | 'Lucro Real'
  aliquotaSimplesConfigurada?: number
  anexoSimples?: string
  aliquotaPisConfigurada?: number
  aliquotaCofinsConfigurada?: number
  aliquotaIcmsConfigurada?: number
  aliquotaIpiConfigurada?: number
  aliquotaIssConfigurada?: number
  aliquotaIrpjConfigurada?: number
  aliquotaCsllConfigurada?: number
  outrosImpostosConfigurados?: number
}): ComparativoRegimesPrecoItem[] {
  const {
    custo,
    margemDesejada,
    despesasVariaveis = 0,
    regimeAtualConfigurado,
    aliquotaSimplesConfigurada,
    anexoSimples = 'Anexo I - Comércio',
    aliquotaPisConfigurada,
    aliquotaCofinsConfigurada,
    aliquotaIcmsConfigurada,
    aliquotaIpiConfigurada,
    aliquotaIssConfigurada,
    aliquotaIrpjConfigurada,
    aliquotaCsllConfigurada,
    outrosImpostosConfigurados,
  } = params

  // 1. Simples Nacional
  const cargaSimples =
    aliquotaSimplesConfigurada !== undefined && aliquotaSimplesConfigurada > 0
      ? aliquotaSimplesConfigurada
      : 6.0
  const calcSimples = calcularPrecoPorDentro(custo, margemDesejada, cargaSimples, despesasVariaveis)

  // 2. Lucro Presumido
  // Se estiver configurado no form usa os valores, senão usa padrão coerente
  const pisLP = aliquotaPisConfigurada !== undefined ? aliquotaPisConfigurada : 0.65
  const cofinsLP = aliquotaCofinsConfigurada !== undefined ? aliquotaCofinsConfigurada : 3.0
  const icmsLP = aliquotaIcmsConfigurada !== undefined ? aliquotaIcmsConfigurada : 18.0
  const ipiLP = aliquotaIpiConfigurada !== undefined ? aliquotaIpiConfigurada : 0.0
  const issLP = aliquotaIssConfigurada !== undefined ? aliquotaIssConfigurada : 0.0
  const irpjLP = aliquotaIrpjConfigurada !== undefined ? aliquotaIrpjConfigurada : 1.2
  const csllLP = aliquotaCsllConfigurada !== undefined ? aliquotaCsllConfigurada : 1.08
  const outrosLP = outrosImpostosConfigurados !== undefined ? outrosImpostosConfigurados : 0.0

  const cargaPresumido = Number(
    (pisLP + cofinsLP + icmsLP + ipiLP + issLP + irpjLP + csllLP + outrosLP).toFixed(2),
  )
  const calcPresumido = calcularPrecoPorDentro(
    custo,
    margemDesejada,
    cargaPresumido,
    despesasVariaveis,
  )

  // 3. Lucro Real
  const pisLR =
    regimeAtualConfigurado === 'Lucro Real' && aliquotaPisConfigurada !== undefined
      ? aliquotaPisConfigurada
      : 1.65
  const cofinsLR =
    regimeAtualConfigurado === 'Lucro Real' && aliquotaCofinsConfigurada !== undefined
      ? aliquotaCofinsConfigurada
      : 7.6
  const icmsLR =
    regimeAtualConfigurado === 'Lucro Real' && aliquotaIcmsConfigurada !== undefined
      ? aliquotaIcmsConfigurada
      : 18.0
  const ipiLR =
    regimeAtualConfigurado === 'Lucro Real' && aliquotaIpiConfigurada !== undefined
      ? aliquotaIpiConfigurada
      : 0.0
  const issLR =
    regimeAtualConfigurado === 'Lucro Real' && aliquotaIssConfigurada !== undefined
      ? aliquotaIssConfigurada
      : 0.0
  const irpjLR =
    regimeAtualConfigurado === 'Lucro Real' && aliquotaIrpjConfigurada !== undefined
      ? aliquotaIrpjConfigurada
      : 0.0 // No Lucro Real direto, IRPJ é sobre o lucro real contábil
  const csllLR =
    regimeAtualConfigurado === 'Lucro Real' && aliquotaCsllConfigurada !== undefined
      ? aliquotaCsllConfigurada
      : 0.0
  const outrosLR =
    regimeAtualConfigurado === 'Lucro Real' && outrosImpostosConfigurados !== undefined
      ? outrosImpostosConfigurados
      : 0.0

  const cargaReal = Number(
    (pisLR + cofinsLR + icmsLR + ipiLR + issLR + irpjLR + csllLR + outrosLR).toFixed(2),
  )
  const calcReal = calcularPrecoPorDentro(custo, margemDesejada, cargaReal, despesasVariaveis)

  const items: ComparativoRegimesPrecoItem[] = [
    {
      regime: 'Simples Nacional',
      regimeDescricao: `Guia única DAS (${anexoSimples.split(' - ')[0]})`,
      cargaTributariaTotal: cargaSimples,
      fatorPorDentro: calcSimples.fatorPorDentro,
      precoVendaSugerido: calcSimples.precoFinal,
      valorImpostosPreco: calcSimples.valorImpostos,
      valorMargemPreco: calcSimples.valorMargem,
      valorCustoPreco: custo,
      markupMultiplicador: calcSimples.markup,
      isMenorCarga: false,
      isRegimeAtual: regimeAtualConfigurado === 'Simples Nacional',
      diferencaCargaVsMenor: 0,
      diferencaPrecoVsMenor: 0,
      detalhesTributos: [
        {
          nome: 'DAS (Guia Única Simples Nacional)',
          aliquota: cargaSimples,
          valorNoPreco: calcSimples.valorImpostos,
        },
      ],
    },
    {
      regime: 'Lucro Presumido',
      regimeDescricao: 'PIS/COFINS Cumulativo (0.65% + 3.0%) + ICMS/ISS + Presunção',
      cargaTributariaTotal: cargaPresumido,
      fatorPorDentro: calcPresumido.fatorPorDentro,
      precoVendaSugerido: calcPresumido.precoFinal,
      valorImpostosPreco: calcPresumido.valorImpostos,
      valorMargemPreco: calcPresumido.valorMargem,
      valorCustoPreco: custo,
      markupMultiplicador: calcPresumido.markup,
      isMenorCarga: false,
      isRegimeAtual: regimeAtualConfigurado === 'Lucro Presumido',
      diferencaCargaVsMenor: 0,
      diferencaPrecoVsMenor: 0,
      detalhesTributos: [
        {
          nome: 'PIS (Cumulativo)',
          aliquota: pisLP,
          valorNoPreco: (calcPresumido.precoFinal * pisLP) / 100,
        },
        {
          nome: 'COFINS (Cumulativo)',
          aliquota: cofinsLP,
          valorNoPreco: (calcPresumido.precoFinal * cofinsLP) / 100,
        },
        {
          nome: 'ICMS / ISS',
          aliquota: icmsLP + issLP,
          valorNoPreco: (calcPresumido.precoFinal * (icmsLP + issLP)) / 100,
        },
        {
          nome: 'IRPJ + CSLL (Provisão)',
          aliquota: irpjLP + csllLP,
          valorNoPreco: (calcPresumido.precoFinal * (irpjLP + csllLP)) / 100,
        },
        ...(outrosLP > 0
          ? [
              {
                nome: 'Outros / FCP',
                aliquota: outrosLP,
                valorNoPreco: (calcPresumido.precoFinal * outrosLP) / 100,
              },
            ]
          : []),
      ],
    },
    {
      regime: 'Lucro Real',
      regimeDescricao: 'PIS/COFINS Não-Cumulativo (1.65% + 7.60%) + ICMS/ISS',
      cargaTributariaTotal: cargaReal,
      fatorPorDentro: calcReal.fatorPorDentro,
      precoVendaSugerido: calcReal.precoFinal,
      valorImpostosPreco: calcReal.valorImpostos,
      valorMargemPreco: calcReal.valorMargem,
      valorCustoPreco: custo,
      markupMultiplicador: calcReal.markup,
      isMenorCarga: false,
      isRegimeAtual: regimeAtualConfigurado === 'Lucro Real',
      diferencaCargaVsMenor: 0,
      diferencaPrecoVsMenor: 0,
      detalhesTributos: [
        {
          nome: 'PIS (Não-Cumulativo)',
          aliquota: pisLR,
          valorNoPreco: (calcReal.precoFinal * pisLR) / 100,
        },
        {
          nome: 'COFINS (Não-Cumulativo)',
          aliquota: cofinsLR,
          valorNoPreco: (calcReal.precoFinal * cofinsLR) / 100,
        },
        {
          nome: 'ICMS / ISS',
          aliquota: icmsLR + issLR,
          valorNoPreco: (calcReal.precoFinal * (icmsLR + issLR)) / 100,
        },
        ...(irpjLR + csllLR > 0
          ? [
              {
                nome: 'IRPJ + CSLL (Provisão)',
                aliquota: irpjLR + csllLR,
                valorNoPreco: (calcReal.precoFinal * (irpjLR + csllLR)) / 100,
              },
            ]
          : []),
        ...(outrosLR > 0
          ? [
              {
                nome: 'Outros / FCP',
                aliquota: outrosLR,
                valorNoPreco: (calcReal.precoFinal * outrosLR) / 100,
              },
            ]
          : []),
      ],
    },
  ]

  // Acha o regime com a menor carga tributária
  const menorCarga = Math.min(...items.map((i) => i.cargaTributariaTotal))
  const itemMenor = items.find((i) => i.cargaTributariaTotal === menorCarga)

  items.forEach((item) => {
    if (item.cargaTributariaTotal === menorCarga) {
      item.isMenorCarga = true
    }
    item.diferencaCargaVsMenor = Number((item.cargaTributariaTotal - menorCarga).toFixed(2))
    if (itemMenor) {
      item.diferencaPrecoVsMenor = Number(
        (item.precoVendaSugerido - itemMenor.precoVendaSugerido).toFixed(2),
      )
    }
  })

  return items
}

/**
 * Gera a matriz de sensibilidade variando Carga Tributária (%) e Margem Desejada (%)
 */
export function gerarMatrizSensibilidade(params: {
  custo: number
  cargasVariadas: number[]
  margensVariadas: number[]
  despesasVariaveis?: number
  cargaAtual: number
  margemAtual: number
}): MatrizSensibilidadeItem[][] {
  const {
    custo,
    cargasVariadas,
    margensVariadas,
    despesasVariaveis = 0,
    cargaAtual,
    margemAtual,
  } = params

  return cargasVariadas.map((carga) => {
    return margensVariadas.map((margem) => {
      const calc = calcularPrecoPorDentro(custo, margem, carga, despesasVariaveis)
      const isAtual = Math.abs(carga - cargaAtual) < 0.01 && Math.abs(margem - margemAtual) < 0.01

      return {
        cargaTributaria: carga,
        margemDesejada: margem,
        precoFinal: calc.precoFinal,
        fatorGrossUp: calc.fatorPorDentro,
        valorImposto: calc.valorImpostos,
        valorMargem: calc.valorMargem,
        markup: calc.markup,
        isAtual,
      }
    })
  })
}

/**
 * Simula e analisa o enquadramento tributário viável com base no RBT12 real (ou faturamento 12m)
 */
export interface SimulacaoEnquadramentoRbt12 {
  rbt12: number
  rbt12Formatado: string
  quantidadeMesesAnalisados: number
  periodoDescricao: string
  isAcimaDoTetoSimples: boolean
  isProximoDoTetoSimples: boolean // > 80% do teto
  percentualTetoSimples: number // % do teto de R$ 4,8M
  tetoSimplesNacional: number // 4.800.000
  sublimiteEstadualIcmsIss: number // 3.600.000
  isAcimaSublimiteEstadual: boolean
  faixaSugeridaSimples: string
  aliquotaNominalSimples: number
  deducaoSimples: number
  aliquotaEfetivaSimples: number
  regimeRecomendado: 'Simples Nacional' | 'Lucro Presumido' | 'Lucro Real'
  motivoRecomendacao: string
  alertas: {
    tipo: 'info' | 'warning' | 'danger' | 'success'
    titulo: string
    mensagem: string
  }[]
}

export function simularEnquadramentoPorRbt12(params: {
  dres: DreRecord[]
  anexoSimples?: string
  margemLucroEstimada?: number // %
}): SimulacaoEnquadramentoRbt12 {
  const { dres, anexoSimples = 'Anexo I - Comércio', margemLucroEstimada = 15 } = params

  // Ordenar DREs por data/ano/mês mais recentes
  const dresValidas = [...dres].filter((d) => (d.receita_bruta || 0) > 0)

  // Separar os últimos 12 meses (ou o somatório do último ano completo se anual)
  let rbt12 = 0
  let qtdMeses = 0
  let periodoDescricao = ''

  if (dresValidas.length === 0) {
    rbt12 = 0
    qtdMeses = 0
    periodoDescricao = 'Sem lançamentos de DRE cadastrados'
  } else {
    // Se tiver registros mensais (mes !== undefined e mes !== 12 em lote)
    const registrosMensais = dresValidas.filter((d) => d.mes !== undefined && d.mes !== null)

    if (registrosMensais.length > 0) {
      // Ordena decrescente por ano e mês
      const ordenados = [...registrosMensais].sort((a, b) => {
        if (a.ano !== b.ano) return b.ano - a.ano
        return (b.mes || 0) - (a.mes || 0)
      })

      const ultimos12 = ordenados.slice(0, 12)
      qtdMeses = ultimos12.length
      rbt12 = ultimos12.reduce((acc, curr) => acc + (curr.receita_bruta || 0), 0)

      const maisRecente = ultimos12[0]
      const maisAntigo = ultimos12[ultimos12.length - 1]
      periodoDescricao = `${maisAntigo.mes || 1}/${maisAntigo.ano} até ${maisRecente.mes || 12}/${maisRecente.ano} (${qtdMeses} meses)`
    } else {
      // Registros anuais consolidados: pega o ano mais recente
      const ordenadosAnos = [...dresValidas].sort((a, b) => b.ano - a.ano)
      const maisRecente = ordenadosAnos[0]
      rbt12 = maisRecente.receita_bruta || 0
      qtdMeses = 12
      periodoDescricao = `Exercício Anual ${maisRecente.ano}`
    }
  }

  const TETO_SIMPLES = 4800000
  const SUBLIMITE_ICMS_ISS = 3600000

  const isAcimaDoTetoSimples = rbt12 > TETO_SIMPLES
  const isAcimaSublimiteEstadual = rbt12 > SUBLIMITE_ICMS_ISS && rbt12 <= TETO_SIMPLES
  const percentualTetoSimples = Number(((rbt12 / TETO_SIMPLES) * 100).toFixed(1))
  const isProximoDoTetoSimples = percentualTetoSimples >= 80 && !isAcimaDoTetoSimples

  // Faixa do Simples
  const tabela = obterTabelaSimplesPorAnexo(anexoSimples)
  let faixaSelecionada = tabela[0]
  let faixaNome = '1ª Faixa (Até R$ 180 mil)'
  for (let i = 0; i < tabela.length; i++) {
    const f = tabela[i]
    if (rbt12 <= f.limiteSuperior) {
      faixaSelecionada = f
      faixaNome = `${f.faixa}ª Faixa (Até R$ ${(f.limiteSuperior / 1000).toFixed(0)}k)`
      break
    }
    if (i === tabela.length - 1) {
      faixaSelecionada = f
      faixaNome = `6ª Faixa (Acima de R$ 3,6M - Teto R$ 4,8M)`
    }
  }

  let aliquotaEfetivaSimples = 0
  if (rbt12 > 0) {
    const calcAliquota =
      (rbt12 * (faixaSelecionada.aliquotaNominal / 100) - faixaSelecionada.deducao) / rbt12
    aliquotaEfetivaSimples = Number(Math.max(0, calcAliquota * 100).toFixed(2))
  }

  const alertas: SimulacaoEnquadramentoRbt12['alertas'] = []
  let regimeRecomendado: 'Simples Nacional' | 'Lucro Presumido' | 'Lucro Real' = 'Simples Nacional'
  let motivoRecomendacao = ''

  if (isAcimaDoTetoSimples) {
    regimeRecomendado = margemLucroEstimada < 8 ? 'Lucro Real' : 'Lucro Presumido'
    motivoRecomendacao = `O faturamento acumulado de ${formatLocalCurrency(rbt12)} ultrapassou o teto máximo permitido da LC 123/2006 (R$ 4,8M). O enquadramento no Simples Nacional é legalmente vedado.`
    alertas.push({
      tipo: 'danger',
      titulo: 'Desenquadramento Obrigatório do Simples Nacional',
      mensagem: `A receita de RBT12 (R$ ${formatLocalCurrency(rbt12)}) excedeu o limite máximo legal de R$ 4.800.000,00 (${percentualTetoSimples}% do teto). A empresa deve obrigatoriamente migrar para Lucro Presumido ou Lucro Real.`,
    })
  } else if (isAcimaSublimiteEstadual) {
    regimeRecomendado = 'Simples Nacional'
    motivoRecomendacao = `Empresa apta ao Simples Nacional, porém com recolhimento de ICMS/ISS fora da guia DAS por ter ultrapassado o sublimite de R$ 3,6M.`
    alertas.push({
      tipo: 'warning',
      titulo: 'Sublimite Estadual Ultrapassado (R$ 3,6 Milhões)',
      mensagem: `O faturamento de R$ ${formatLocalCurrency(rbt12)} está entre R$ 3,6M e R$ 4,8M. Os tributos federais continuam no DAS, mas o ICMS/ISS passam a ser recolhidos em guias estaduais/municipais próprias com obrigações acessórias completas.`,
    })
  } else if (isProximoDoTetoSimples) {
    regimeRecomendado = 'Simples Nacional'
    motivoRecomendacao = `Simples Nacional ainda é viável e financeiramente competitivo, mas está próximo da margem de alerta do teto anual (${percentualTetoSimples}%).`
    alertas.push({
      tipo: 'warning',
      titulo: 'Atenção ao Crescimento: Próximo ao Limite do Simples',
      mensagem: `A empresa atingiu ${percentualTetoSimples}% do limite anual. Planeje a transição tributária caso a meta de faturamento continue crescendo para evitar surpresas no início do próximo exercício fiscal.`,
    })
  } else if (rbt12 > 0) {
    regimeRecomendado = 'Simples Nacional'
    motivoRecomendacao = `Com RBT12 de R$ ${formatLocalCurrency(rbt12)}, a empresa se enquadra na ${faixaNome} com alíquota efetiva de ${aliquotaEfetivaSimples}%, apresentando menor custo tributário e simplificação fiscal.`
    alertas.push({
      tipo: 'success',
      titulo: 'Enquadramento Saudável no Simples Nacional',
      mensagem: `A receita acumulada de 12 meses está confortável dentro do limite do Simples (${percentualTetoSimples}% utilizado).`,
    })
  } else {
    motivoRecomendacao =
      'Não há dados de faturamento suficientes na DRE para cálculo exato do RBT12.'
    alertas.push({
      tipo: 'info',
      titulo: 'Sem dados de DRE',
      mensagem:
        'Cadastre lançamentos ou importe balancetes mensais na DRE para apuração automática da receita bruta dos últimos 12 meses.',
    })
  }

  return {
    rbt12,
    rbt12Formatado: formatLocalCurrency(rbt12),
    quantidadeMesesAnalisados: qtdMeses,
    periodoDescricao,
    isAcimaDoTetoSimples,
    isProximoDoTetoSimples,
    percentualTetoSimples,
    tetoSimplesNacional: TETO_SIMPLES,
    sublimiteEstadualIcmsIss: SUBLIMITE_ICMS_ISS,
    isAcimaSublimiteEstadual,
    faixaSugeridaSimples: faixaNome,
    aliquotaNominalSimples: faixaSelecionada.aliquotaNominal,
    deducaoSimples: faixaSelecionada.deducao,
    aliquotaEfetivaSimples,
    regimeRecomendado,
    motivoRecomendacao,
    alertas,
  }
}
