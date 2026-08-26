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

export const TABELA_SIMPLES_ANEXO_III: FaixaSimples[] = [
  { faixa: 1, limiteSuperior: 180000, aliquotaNominal: 6.0, deducao: 0 },
  { faixa: 2, limiteSuperior: 360000, aliquotaNominal: 11.2, deducao: 9360 },
  { faixa: 3, limiteSuperior: 720000, aliquotaNominal: 13.5, deducao: 17640 },
  { faixa: 4, limiteSuperior: 1800000, aliquotaNominal: 16.0, deducao: 35640 },
  { faixa: 5, limiteSuperior: 3600000, aliquotaNominal: 21.0, deducao: 125640 },
  { faixa: 6, limiteSuperior: 4800000, aliquotaNominal: 33.0, deducao: 558000 },
]

/**
 * Calcula Simples Nacional (Anexo III - Serviços)
 * Fórmula oficial: Alíquota Efetiva = ((RBT12 * Alíquota Nominal) - Parcela a Deduzir) / RBT12
 */
export function calcularSimplesNacional(
  receitaBrutaAnual: number,
  folhaPagamento: number,
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

  // Encontrar faixa
  let faixaSelecionada = TABELA_SIMPLES_ANEXO_III[0]
  let faixaNome = '1ª Faixa (Até R$ 180 mil)'
  for (let i = 0; i < TABELA_SIMPLES_ANEXO_III.length; i++) {
    const f = TABELA_SIMPLES_ANEXO_III[i]
    if (rbt12 <= f.limiteSuperior) {
      faixaSelecionada = f
      faixaNome = `${f.faixa}ª Faixa (Até R$ ${(f.limiteSuperior / 1000).toFixed(0)}k)`
      break
    }
    // se for maior que o teto da última faixa
    if (i === TABELA_SIMPLES_ANEXO_III.length - 1) {
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
}): AnaliseTributariaResultado {
  const { ano, receitaBruta, lucroLiquido, folhaPagamento = 0, aliquotaIssPercent = 5 } = options

  const folha = folhaPagamento > 0 ? folhaPagamento : receitaBruta * 0.25 // estimativa 25% se não informada

  const simples = calcularSimplesNacional(receitaBruta, folha)
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
