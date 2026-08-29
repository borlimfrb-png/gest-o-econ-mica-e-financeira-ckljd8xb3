import type {
  BalancoRecord,
  DreRecord,
  BalancoCalculado,
  DreCalculado,
  IndicadoresCalculados,
} from '@/types/finance'

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

/**
 * Interface com os dados mensais calculados para os 12 meses do ano
 */
export interface MesComparativoData {
  mesNum: number
  mesNome: string
  mesAbrev: string
  temDados: boolean
  temBalanco: boolean
  temDre: boolean
  fechado: boolean
  fechadoEm?: string
  fechamentoObs?: string
  // Balanço
  ativoTotal: number
  ativoCirculante: number
  ativoNaoCirculante: number
  passivoTotal: number
  passivoCirculante: number
  passivoNaoCirculante: number
  patrimonioLiquido: number
  caixaEquivalentes: number
  contasReceber: number
  estoques: number
  // DRE
  receitaBruta: number
  deducoes: number
  receitaLiquida: number
  custoMercadorias: number
  lucroBruto: number
  despesasOperacionais: number
  resultadoOperacional: number
  despesasFinanceiras: number
  outrasReceitasDespesas: number
  impostoRenda: number
  lucroLiquido: number
  ebitda: number
  // Indicadores rápidos
  margemLiquida: number | null
  liquidezCorrente: number | null
  endividamentoGeral: number | null
}

/**
 * Gera a série dos 12 meses (Janeiro a Dezembro) para o ano e empresa selecionados,
 * preenchendo meses sem lançamento com zero e flag `temDados: false`.
 */
export function gerarComparativoMensalAno(
  balancos: BalancoRecord[],
  dres: DreRecord[],
  ano: number,
): MesComparativoData[] {
  const result: MesComparativoData[] = []

  for (let m = 1; m <= 12; m++) {
    const b = balancos.find((item) => item.ano === ano && (item.mes ?? 12) === m)
    const d = dres.find((item) => item.ano === ano && (item.mes ?? 12) === m)

    const temBalanco = !!b
    const temDre = !!d
    const temDados = temBalanco || temDre

    const calcB = b ? calcularBalanco(b) : null
    const calcD = d ? calcularDre(d) : null
    const ind = calcularIndicadores(b || null, d || null)

    const fechado = Boolean(b?.fechado || d?.fechado)
    const fechadoEm = b?.fechado_em || d?.fechado_em
    const fechamentoObs = b?.fechamento_obs || d?.fechamento_obs

    result.push({
      mesNum: m,
      mesNome: NOMES_MESES[m - 1],
      mesAbrev: NOMES_MESES_ABREV[m - 1],
      temDados,
      temBalanco,
      temDre,
      fechado,
      fechadoEm,
      fechamentoObs,
      ativoTotal: calcB?.ativoTotal || 0,
      ativoCirculante: calcB?.ativoCirculante || 0,
      ativoNaoCirculante: calcB?.ativoNaoCirculante || 0,
      passivoTotal: calcB?.passivoTotal || 0,
      passivoCirculante: calcB?.passivoCirculante || 0,
      passivoNaoCirculante: calcB?.passivoNaoCirculante || 0,
      patrimonioLiquido: calcB?.patrimonioLiquido || 0,
      caixaEquivalentes: b?.caixa_equivalentes || 0,
      contasReceber: b?.contas_receber || 0,
      estoques: b?.estoques || 0,
      receitaBruta: d?.receita_bruta || 0,
      deducoes: d?.deducoes_receita || 0,
      receitaLiquida: calcD?.receitaLiquida || 0,
      custoMercadorias: d?.custo_mercadorias || 0,
      lucroBruto: calcD?.lucroBruto || 0,
      despesasOperacionais: d?.despesas_operacionais || 0,
      resultadoOperacional: calcD?.resultadoOperacional || 0,
      despesasFinanceiras: d?.despesas_financeiras || 0,
      outrasReceitasDespesas: d?.outras_receitas_despesas || 0,
      impostoRenda: d?.imposto_renda || 0,
      lucroLiquido: calcD?.lucroLiquido || 0,
      ebitda: calcD?.ebitda || 0,
      margemLiquida: ind.margemLiquida,
      liquidezCorrente: ind.liquidezCorrente,
      endividamentoGeral: ind.endividamentoGeral,
    })
  }

  return result
}

/**
 * Consolida uma lista de balanços para um determinado ano.
 * Para balanço patrimonial (saldos), utiliza o registro do mês mais recente cadastrado no ano.
 */
export function consolidarBalancoAnual(
  balancos: BalancoRecord[],
  ano: number,
): BalancoRecord | null {
  const doAno = balancos.filter((b) => b.ano === ano)
  if (doAno.length === 0) return null

  // Ordena por mês decrescente (mes null/undefined vira 12 por padrão de retrocompatibilidade)
  const sorted = [...doAno].sort((a, b) => {
    const mesA = a.mes ?? 12
    const mesB = b.mes ?? 12
    return mesB - mesA
  })

  return sorted[0]
}

/**
 * Consolida uma lista de DREs para um determinado ano.
 * Para DRE (fluxo de receitas e despesas), soma os valores de todos os meses cadastrados no ano.
 */
export function consolidarDreAnual(dres: DreRecord[], ano: number): DreRecord | null {
  const doAno = dres.filter((d) => d.ano === ano)
  if (doAno.length === 0) return null

  // Se tiver apenas 1 registro (ex: anual clássico ou 1 único mês), retorna ele mesmo
  if (doAno.length === 1) return doAno[0]

  // Se tiver múltiplos meses, soma os campos numéricos
  const consolidado: DreRecord = {
    id: `consolidado-${ano}`,
    collectionId: doAno[0].collectionId,
    collectionName: doAno[0].collectionName,
    created: doAno[0].created,
    updated: doAno[0].updated,
    empresa: doAno[0].empresa,
    ano,
    mes: 12, // Identificador de exercício consolidado
    receita_bruta: doAno.reduce((acc, d) => acc + (d.receita_bruta || 0), 0),
    deducoes_receita: doAno.reduce((acc, d) => acc + (d.deducoes_receita || 0), 0),
    custo_mercadorias: doAno.reduce((acc, d) => acc + (d.custo_mercadorias || 0), 0),
    despesas_operacionais: doAno.reduce((acc, d) => acc + (d.despesas_operacionais || 0), 0),
    despesas_financeiras: doAno.reduce((acc, d) => acc + (d.despesas_financeiras || 0), 0),
    outras_receitas_despesas: doAno.reduce((acc, d) => acc + (d.outras_receitas_despesas || 0), 0),
    imposto_renda: doAno.reduce((acc, d) => acc + (d.imposto_renda || 0), 0),
  }

  return consolidado
}

export function formatBrlMil(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return '—'
  const isNegative = val < 0
  const absVal = Math.abs(val)
  const formatted = new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  }).format(absVal)
  return isNegative ? `-R$ ${formatted} mil` : `R$ ${formatted} mil`
}

export function formatCurrency(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return 'R$ 0,00'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val)
}
export function formatNumber(val: number | null | undefined, decimals = 2): string {
  if (val === null || val === undefined || isNaN(val)) return '—'
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(val)
}

export function formatPercent(val: number | null | undefined, decimals = 1): string {
  if (val === null || val === undefined || isNaN(val)) return '—'
  const formatted = new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(val)
  return `${formatted}%`
}

export function formatInteger(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return '—'
  return new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(Math.round(val))
}

export interface PontoEquilibrioCalculado {
  receitaLiquida: number
  custosVariaveis: number
  custosFixos: number
  depreciacao: number
  lucroDesejado: number
  precoMedioUnitario: number
  margemContribuicaoReais: number
  margemContribuicaoPercentual: number
  pec: number
  pee: number
  pef: number
  pecUnidades: number | null
  peeUnidades: number | null
  pefUnidades: number | null
  margemSeguranca: number
  margemSegurancaReais: number
  situacaoOperacao: 'lucro' | 'atencao' | 'prejuizo' | 'indefinido'
}

export function calcularPontoEquilibrio(
  dre?: Partial<DreRecord> | null,
  balanco?: Partial<BalancoRecord> | null,
  customOverrides?: {
    custosFixos?: number
    custosVariaveis?: number
    depreciacao?: number
    lucroDesejado?: number
    precoMedioUnitario?: number
  },
): PontoEquilibrioCalculado {
  const calcD = calcularDre(dre)
  const rl = calcD.receitaLiquida

  // Heurísticas padrão
  const defaultCustosVariaveis = dre?.custo_mercadorias || 0
  const despOp = dre?.despesas_operacionais || 0
  const despFin = dre?.despesas_financeiras || 0
  const defaultCustosFixos = despOp + despFin

  const imobilizado = balanco?.imobilizado || 0
  const intangivel = balanco?.intangivel || 0
  const baseAtivoNaoCirc = imobilizado + intangivel
  let defaultDepreciacao = 0
  if (baseAtivoNaoCirc > 0) {
    const estimativa = imobilizado * 0.1
    defaultDepreciacao = Math.min(estimativa, despOp > 0 ? despOp * 0.5 : estimativa)
  }

  let defaultLucroDesejado = 0
  if (calcD.lucroLiquido > 0) {
    defaultLucroDesejado = calcD.lucroLiquido
  } else if (rl > 0) {
    defaultLucroDesejado = rl * 0.1
  }

  // Preço médio sugerido padrão (R$ 100 ou heurística proporcional)
  const defaultPrecoMedio = 100

  const custosFixos = customOverrides?.custosFixos ?? defaultCustosFixos
  const custosVariaveis = customOverrides?.custosVariaveis ?? defaultCustosVariaveis
  const depreciacao = customOverrides?.depreciacao ?? defaultDepreciacao
  const lucroDesejado = customOverrides?.lucroDesejado ?? defaultLucroDesejado
  const precoMedioUnitario =
    customOverrides?.precoMedioUnitario !== undefined
      ? customOverrides.precoMedioUnitario
      : defaultPrecoMedio

  const margemContribuicaoReais = rl - custosVariaveis
  const margemContribuicaoPercentual = rl > 0 ? (margemContribuicaoReais / rl) * 100 : 0
  const mcDecimal = margemContribuicaoPercentual / 100

  // Pontos em R$
  const pec = mcDecimal > 0 && custosFixos >= 0 ? custosFixos / mcDecimal : 0
  const pee = mcDecimal > 0 ? (custosFixos + Math.max(0, lucroDesejado)) / mcDecimal : 0
  const fixosDesembolsaveis = Math.max(0, custosFixos - depreciacao)
  const pef = mcDecimal > 0 ? fixosDesembolsaveis / mcDecimal : 0

  // Pontos em unidades (Ponto em R$ ÷ Preço Médio Unitário)
  const pecUnidades = precoMedioUnitario > 0 ? Math.ceil(pec / precoMedioUnitario) : null
  const peeUnidades = precoMedioUnitario > 0 ? Math.ceil(pee / precoMedioUnitario) : null
  const pefUnidades = precoMedioUnitario > 0 ? Math.ceil(pef / precoMedioUnitario) : null

  // Margem de segurança
  let margemSeguranca = 0
  if (rl > 0 && pec > 0) {
    margemSeguranca = ((rl - pec) / rl) * 100
  } else if (rl > 0 && pec === 0) {
    margemSeguranca = 100
  }
  const margemSegurancaReais = rl - pec

  let situacaoOperacao: 'lucro' | 'atencao' | 'prejuizo' | 'indefinido' = 'indefinido'
  if (dre && rl > 0) {
    if (margemSeguranca >= 15) situacaoOperacao = 'lucro'
    else if (margemSeguranca >= 0) situacaoOperacao = 'atencao'
    else situacaoOperacao = 'prejuizo'
  }

  return {
    receitaLiquida: rl,
    custosVariaveis,
    custosFixos,
    depreciacao,
    lucroDesejado,
    precoMedioUnitario,
    margemContribuicaoReais,
    margemContribuicaoPercentual,
    pec,
    pee,
    pef,
    pecUnidades,
    peeUnidades,
    pefUnidades,
    margemSeguranca,
    margemSegurancaReais,
    situacaoOperacao,
  }
}

export function calcularCapitalGiro(
  b?: Partial<BalancoRecord> | null,
  d?: Partial<DreRecord> | null,
): import('@/types/finance').CapitalGiroCalculado {
  const calcB = calcularBalanco(b)
  const calcD = calcularDre(d)

  const ac = calcB.ativoCirculante
  const pc = calcB.passivoCirculante

  // Ativo Circulante Financeiro (ACF) = Caixa e Equivalentes + Aplicações Financeiras
  const caixa = b?.caixa_equivalentes || 0
  const aplicacoes = b?.aplicacoes_financeiras || 0
  const acf = caixa + aplicacoes

  // Ativo Circulante Operacional (ACO) = Contas a Receber + Estoques + Impostos a Recuperar + Outros AC
  const contasReceber = b?.contas_receber || 0
  const estoques = b?.estoques || 0
  const impostosRecuperar = b?.impostos_recuperar || 0
  const outrosAc = b?.outros_ativo_circulante || 0
  const aco = contasReceber + estoques + impostosRecuperar + outrosAc

  // Passivo Circulante Financeiro (PCF) = Empréstimos e Financiamentos de Curto Prazo
  const pcf = b?.emprestimos_curto_prazo || 0

  // Passivo Circulante Operacional (PCO) = Fornecedores + Obrigações Trabalhistas + Obrigações Tributárias + Outros PC
  const fornecedores = b?.fornecedores || 0
  const obTrabalhistas = b?.obrigacoes_trabalhistas || 0
  const obTributarias = b?.obrigacoes_tributarias || 0
  const outrosPc = b?.outros_passivo_circulante || 0
  const pco = fornecedores + obTrabalhistas + obTributarias + outrosPc

  // Indicadores
  const cgb = ac
  const cgl = ac - pc
  const ncg = aco - pco
  const saldoTesouraria = acf - pcf // Equivalente matemático a: CGL - NCG

  const liquidezCorrente = pc > 0 ? ac / pc : null
  const coberturaNcgPorCgl = ncg > 0 ? (cgl / ncg) * 100 : null

  // Prazos e Ciclos
  const rb = d?.receita_bruta || 0
  const rl = calcD.receitaLiquida
  const baseVendas = rb > 0 ? rb : rl
  const cmv = d?.custo_mercadorias || 0
  const comprasProxy = cmv

  const pme = cmv > 0 ? (estoques / cmv) * 360 : null
  const pmr = baseVendas > 0 ? (contasReceber / baseVendas) * 360 : null
  const pmp = comprasProxy > 0 ? (fornecedores / comprasProxy) * 360 : null
  const cicloOperacional = pme !== null && pmr !== null ? pme + pmr : null
  const cicloFinanceiro = cicloOperacional !== null && pmp !== null ? cicloOperacional - pmp : null

  // Classificação Modelo Fleuriet (6 Estruturas Dinâmicas)
  // 1. Excelente: CGL > 0, NCG > 0, ST > 0 (CGL > NCG)
  // 2. Sólida / Equilibrada: CGL > 0, NCG <= 0, ST > 0
  // 3. Em Crescimento / Alavancada Operacional: CGL > 0, NCG > 0, ST < 0 (NCG > CGL)
  // 4. Arriscada / Insatisfeita: CGL < 0, NCG > 0, ST < 0
  // 5. Alto Risco / Dependente: CGL < 0, NCG <= 0, ST < 0
  // 6. Muito Crítica / Efeito Tesoura: CGL < 0, NCG > 0, ST < -Math.abs(cgl)
  let tipoFleuriet: import('@/types/finance').CapitalGiroCalculado['tipoFleuriet'] = 'indefinido'
  let tipoFleurietNome = 'Sem dados suficientes'
  let tipoFleurietDescricao =
    'Demonstrações contábeis incompletas para classificação dinâmica de Fleuriet.'

  if (ac > 0 || pc > 0) {
    if (cgl > 0 && ncg > 0 && saldoTesouraria > 0) {
      tipoFleuriet = 'excelente'
      tipoFleurietNome = 'Tipo I — Excelente (Muito Sólida)'
      tipoFleurietDescricao =
        'O Capital de Giro Líquido financia integralmente a Necessidade de Capital de Giro e ainda gera Saldo de Tesouraria positivo e folga financeira.'
    } else if (cgl > 0 && ncg <= 0 && saldoTesouraria > 0) {
      tipoFleuriet = 'solida'
      tipoFleurietNome = 'Tipo II — Sólida com Financiamento Operacional'
      tipoFleurietDescricao =
        'A empresa opera com NCG negativa ou nula (financiada por fornecedores e clientes) e dispõe de CGL positivo, gerando tesouraria altamente superavitária.'
    } else if (cgl > 0 && ncg > 0 && saldoTesouraria < 0) {
      tipoFleuriet = 'em_crescimento'
      tipoFleurietNome = 'Tipo III — Em Crescimento (Tesouraria Pressionada)'
      tipoFleurietDescricao =
        'A Necessidade de Capital de Giro supera o Capital de Giro Líquido gerado, forçando o uso de empréstimos bancários de curto prazo para financiar a expansão operacional.'
    } else if (cgl <= 0 && ncg > 0 && saldoTesouraria < 0) {
      tipoFleuriet = 'arriscada'
      tipoFleurietNome = 'Tipo IV — Arriscada (Efeito Tesoura / Desequilíbrio)'
      tipoFleurietDescricao =
        'CGL negativo aliado a NCG positiva resulta em déficit expressivo de tesouraria. A empresa financia ativos de longo prazo e giro com dívidas bancárias onerosas de curto prazo.'
    } else if (cgl <= 0 && ncg <= 0 && saldoTesouraria < 0) {
      tipoFleuriet = 'alto_risco'
      tipoFleurietNome = 'Tipo V — Alto Risco / Desbalanceada'
      tipoFleurietDescricao =
        'Recursos de longo prazo insuficientes (CGL < 0) e tesouraria deficitária, dependente de rolagem contínua de dívidas bancárias de curto prazo.'
    } else if (cgl <= 0 && saldoTesouraria < 0) {
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
    ativoCirculante: ac,
    ativoCirculanteOperacional: aco,
    ativoCirculanteFinanceiro: acf,
    passivoCirculante: pc,
    passivoCirculanteOperacional: pco,
    passivoCirculanteFinanceiro: pcf,
    cgb,
    cgl,
    ncg,
    saldoTesouraria,
    liquidezCorrente,
    coberturaNcgPorCgl,
    pme,
    pmr,
    pmp,
    cicloOperacional,
    cicloFinanceiro,
    tipoFleuriet,
    tipoFleurietNome,
    tipoFleurietDescricao,
  }
}

export function formatCnpj(cnpj: string): string {
  const digits = cnpj.replace(/\D/g, '')
  if (digits.length !== 14) return cnpj
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
}

export function cleanCnpj(cnpj: string): string {
  return cnpj.replace(/\D/g, '')
}

export function validateCnpj(cnpj: string): boolean {
  const clean = cleanCnpj(cnpj)
  if (clean.length !== 14) return false
  if (/^(\d)\1+$/.test(clean)) return false

  let tamanho = clean.length - 2
  let numeros = clean.substring(0, tamanho)
  const digitos = clean.substring(tamanho)
  let soma = 0
  let pos = tamanho - 7
  for (let i = tamanho; i >= 1; i--) {
    soma += parseInt(numeros.charAt(tamanho - i), 10) * pos--
    if (pos < 2) pos = 9
  }
  let resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11)
  if (resultado !== parseInt(digitos.charAt(0), 10)) return false

  tamanho = tamanho + 1
  numeros = clean.substring(0, tamanho)
  soma = 0
  pos = tamanho - 7
  for (let i = tamanho; i >= 1; i--) {
    soma += parseInt(numeros.charAt(tamanho - i), 10) * pos--
    if (pos < 2) pos = 9
  }
  resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11)
  if (resultado !== parseInt(digitos.charAt(1), 10)) return false

  return true
}

export function calcularBalanco(b?: Partial<BalancoRecord> | null): BalancoCalculado {
  if (!b) {
    return {
      ativoCirculante: 0,
      ativoNaoCirculante: 0,
      ativoTotal: 0,
      passivoCirculante: 0,
      passivoNaoCirculante: 0,
      patrimonioLiquido: 0,
      passivoTotal: 0,
      passivoEPL: 0,
    }
  }

  const ac =
    (b.caixa_equivalentes || 0) +
    (b.aplicacoes_financeiras || 0) +
    (b.contas_receber || 0) +
    (b.estoques || 0) +
    (b.impostos_recuperar || 0) +
    (b.outros_ativo_circulante || 0)

  const anc =
    (b.realizavel_longo_prazo || 0) +
    (b.investimentos || 0) +
    (b.imobilizado || 0) +
    (b.intangivel || 0)

  const ativoTotal = ac + anc

  const pc =
    (b.fornecedores || 0) +
    (b.emprestimos_curto_prazo || 0) +
    (b.obrigacoes_trabalhistas || 0) +
    (b.obrigacoes_tributarias || 0) +
    (b.outros_passivo_circulante || 0)

  const pnc = (b.emprestimos_longo_prazo || 0) + (b.outras_obrigacoes_longo_prazo || 0)

  const pl = (b.capital_social || 0) + (b.reservas_lucros || 0) + (b.lucros_acumulados || 0)

  const passivoTotal = pc + pnc
  const passivoEPL = passivoTotal + pl

  return {
    ativoCirculante: ac,
    ativoNaoCirculante: anc,
    ativoTotal,
    passivoCirculante: pc,
    passivoNaoCirculante: pnc,
    patrimonioLiquido: pl,
    passivoTotal,
    passivoEPL,
  }
}

export function calcularDre(d?: Partial<DreRecord> | null): DreCalculado {
  if (!d) {
    return {
      receitaLiquida: 0,
      lucroBruto: 0,
      resultadoOperacional: 0,
      resultadoAntesIR: 0,
      lucroLiquido: 0,
      ebitda: 0,
    }
  }

  const rb = d.receita_bruta || 0
  const ded = d.deducoes_receita || 0
  const rl = rb - ded
  const cmv = d.custo_mercadorias || 0
  const lb = rl - cmv
  const do_ = d.despesas_operacionais || 0
  const ro = lb - do_
  const df = d.despesas_financeiras || 0
  const ord = d.outras_receitas_despesas || 0
  const lair = ro - df + ord
  const ir = d.imposto_renda || 0
  const ll = lair - ir

  // EBITDA aproximado = Lucro Líquido + Imposto de Renda + Despesas Financeiras
  const ebitda = ll + ir + df

  return {
    receitaLiquida: rl,
    lucroBruto: lb,
    resultadoOperacional: ro,
    resultadoAntesIR: lair,
    lucroLiquido: ll,
    ebitda,
  }
}

export function calcularIndicadores(
  b?: Partial<BalancoRecord> | null,
  d?: Partial<DreRecord> | null,
): IndicadoresCalculados {
  const calcB = calcularBalanco(b)
  const calcD = calcularDre(d)

  const ac = calcB.ativoCirculante
  const anc = calcB.ativoNaoCirculante
  const at = calcB.ativoTotal
  const pc = calcB.passivoCirculante
  const pnc = calcB.passivoNaoCirculante
  const pl = calcB.patrimonioLiquido
  const passivoTotal = calcB.passivoTotal

  const estoques = b?.estoques || 0
  const caixaAplic = (b?.caixa_equivalentes || 0) + (b?.aplicacoes_financeiras || 0)
  const rlp = b?.realizavel_longo_prazo || 0
  const imobilizado = b?.imobilizado || 0

  const rl = calcD.receitaLiquida
  const lb = calcD.lucroBruto
  const ro = calcD.resultadoOperacional
  const ll = calcD.lucroLiquido
  const df = d?.despesas_financeiras || 0
  const ebitda = calcD.ebitda

  // 1. Liquidez
  const liquidezCorrente = pc > 0 ? ac / pc : null
  const liquidezSeca = pc > 0 ? (ac - estoques) / pc : null
  const liquidezImediata = pc > 0 ? caixaAplic / pc : null
  const liquidezGeral = pc + pnc > 0 ? (ac + rlp) / (pc + pnc) : null

  // 2. Endividamento
  const endividamentoGeral = at > 0 ? (passivoTotal / at) * 100 : null
  const composicaoEndividamento = passivoTotal > 0 ? (pc / passivoTotal) * 100 : null
  const dividaLiquida = passivoTotal - caixaAplic
  const dividaLiquidaEbitda = ebitda !== 0 ? dividaLiquida / ebitda : null
  const coberturaJuros = df > 0 ? (ll + (d?.imposto_renda || 0) + df) / df : null

  // 3. Rentabilidade
  const margemBruta = rl !== 0 ? (lb / rl) * 100 : null
  const margemOperacional = rl !== 0 ? (ro / rl) * 100 : null
  const margemLiquida = rl !== 0 ? (ll / rl) * 100 : null
  const roa = at > 0 ? (ll / at) * 100 : null
  const roe = pl > 0 ? (ll / pl) * 100 : null

  // 4. Estrutura de Capital
  const capitalTerceirosSobreProprio = pl > 0 ? (passivoTotal / pl) * 100 : null
  const imobilizacaoPL = pl > 0 ? (imobilizado / pl) * 100 : null
  const imobilizacaoRecursosNaoCorrentes = pl + pnc > 0 ? (imobilizado / (pl + pnc)) * 100 : null
  const alavancagemFinanceira = pl > 0 ? passivoTotal / pl : null

  return {
    liquidezCorrente,
    liquidezSeca,
    liquidezImediata,
    liquidezGeral,
    endividamentoGeral,
    composicaoEndividamento,
    dividaLiquidaEbitda,
    coberturaJuros,
    margemBruta,
    margemOperacional,
    margemLiquida,
    roa,
    roe,
    capitalTerceirosSobreProprio,
    imobilizacaoPL,
    imobilizacaoRecursosNaoCorrentes,
    alavancagemFinanceira,
  }
}

export interface AnaliseTexto {
  liquidez: { status: 'bom' | 'medio' | 'ruim'; texto: string }
  endividamento: { status: 'bom' | 'medio' | 'ruim'; texto: string }
  rentabilidade: { status: 'bom' | 'medio' | 'ruim'; texto: string }
  roe: { status: 'bom' | 'medio' | 'ruim'; texto: string }
  visaoGeral: string[]
}

export function gerarAnaliseAutomatica(
  atualB?: Partial<BalancoRecord> | null,
  atualD?: Partial<DreRecord> | null,
  anteriorB?: Partial<BalancoRecord> | null,
  anteriorD?: Partial<DreRecord> | null,
): AnaliseTexto {
  const indAtual = calcularIndicadores(atualB, atualD)
  const indAnt = anteriorB ? calcularIndicadores(anteriorB, anteriorD) : null
  const dreAtual = calcularDre(atualD)
  const dreAnt = anteriorD ? calcularDre(anteriorD) : null

  // Liquidez Corrente
  const lc = indAtual.liquidezCorrente
  let liqStatus: 'bom' | 'medio' | 'ruim' = 'medio'
  let liqTexto = ''
  if (lc === null) {
    liqTexto = 'Dados insuficientes para cálculo da liquidez corrente.'
  } else if (lc < 1.0) {
    liqStatus = 'ruim'
    liqTexto = `A liquidez corrente de ${formatNumber(lc, 2)} indica insuficiência de recursos de curto prazo para honrar obrigações imediatas. A empresa depende da geração de caixa operacional ou rolagem de passivos.`
  } else if (lc <= 2.0) {
    liqStatus = 'bom'
    liqTexto = `A liquidez corrente de ${formatNumber(lc, 2)} reflete capacidade adequada de pagamento no curto prazo, equilibrando solvência e uso eficiente do capital de giro.`
  } else {
    liqStatus = 'bom'
    liqTexto = `A liquidez corrente de ${formatNumber(lc, 2)} demonstra situação confortável e alta folga financeira, assegurando tranquilidade operacional.`
  }

  // Endividamento Geral
  const eg = indAtual.endividamentoGeral
  let endStatus: 'bom' | 'medio' | 'ruim' = 'medio'
  let endTexto = ''
  if (eg === null) {
    endTexto = 'Dados insuficientes para cálculo do endividamento.'
  } else if (eg < 40) {
    endStatus = 'bom'
    endTexto = `Endividamento geral em ${formatPercent(eg, 1)}, indicando estrutura financeira saudável, com baixo risco de crédito e ampla autonomia em relação a terceiros.`
  } else if (eg <= 60) {
    endStatus = 'medio'
    endTexto = `Endividamento geral em ${formatPercent(eg, 1)}, representando nível moderado de compromissos com terceiros, típico de empresas em crescimento.`
  } else {
    endStatus = 'ruim'
    endTexto = `Endividamento geral em ${formatPercent(eg, 1)}, apontando elevado nível de alavancagem financeira e maior exposição a oscilações na taxa de juros.`
  }

  // Rentabilidade (Margem Líquida)
  const ml = indAtual.margemLiquida
  let rentStatus: 'bom' | 'medio' | 'ruim' = 'medio'
  let rentTexto = ''
  if (ml === null) {
    rentTexto = 'Dados insuficientes de resultado líquido.'
  } else if (ml < 0) {
    rentStatus = 'ruim'
    rentTexto = `A margem líquida negativa de ${formatPercent(ml, 1)} é um sinal de alerta crítico de prejuízo operacional e necessidade de revisão de custos e precificação.`
  } else if (ml < 8) {
    rentStatus = 'medio'
    rentTexto = `A margem líquida de ${formatPercent(ml, 1)} demonstra rentabilidade positiva, porém com margem de segurança moderada frente a oscilações de mercado.`
  } else {
    rentStatus = 'bom'
    rentTexto = `A margem líquida de ${formatPercent(ml, 1)} reflete sólida eficiência na conversão de faturamento em lucro líquido disponível aos acionistas.`
  }

  // ROE (Retorno sobre Patrimônio Líquido) vs ~10% custo oportunidade
  const roe = indAtual.roe
  let roeStatus: 'bom' | 'medio' | 'ruim' = 'medio'
  let roeTexto = ''
  if (roe === null) {
    roeTexto = 'Dados insuficientes para cálculo do ROE.'
  } else if (roe > 12) {
    roeStatus = 'bom'
    roeTexto = `O ROE de ${formatPercent(roe, 1)} supera com folga o custo de oportunidade de capital (~10% a.a.), demonstrando excelente capacidade de gerar valor ao patrimônio próprio.`
  } else if (roe >= 0) {
    roeStatus = 'medio'
    roeTexto = `O ROE de ${formatPercent(roe, 1)} está abaixo ou próximo do custo de oportunidade padrão (~10%), sugerindo atenção à remuneração do capital investido.`
  } else {
    roeStatus = 'ruim'
    roeTexto = `O ROE negativo de ${formatPercent(roe, 1)} indica destruição de valor patrimonial no período em decorrência do prejuízo líquido.`
  }

  // Parágrafos do Consultor
  const visaoGeral: string[] = []
  visaoGeral.push(
    `No exercício analisado (${atualB?.ano || 'atual'}), a empresa apresentou Ativo Total de ${formatBrlMil(calcularBalanco(atualB).ativoTotal)} e Patrimônio Líquido de ${formatBrlMil(calcularBalanco(atualB).patrimonioLiquido)}, gerando Receita Líquida de ${formatBrlMil(dreAtual.receitaLiquida)} e Lucro Líquido de ${formatBrlMil(dreAtual.lucroLiquido)}.`,
  )

  visaoGeral.push(`${liqTexto} ${endTexto}`)

  // Comparativo com ano anterior
  if (anteriorB && indAnt) {
    const varPL =
      calcularBalanco(anteriorB).patrimonioLiquido > 0
        ? ((calcularBalanco(atualB).patrimonioLiquido -
            calcularBalanco(anteriorB).patrimonioLiquido) /
            calcularBalanco(anteriorB).patrimonioLiquido) *
          100
        : 0
    const varRec =
      dreAnt && dreAnt.receitaLiquida > 0
        ? ((dreAtual.receitaLiquida - dreAnt.receitaLiquida) / dreAnt.receitaLiquida) * 100
        : 0
    const varEnd =
      eg !== null && indAnt.endividamentoGeral !== null ? eg - indAnt.endividamentoGeral : 0

    const fraseTendencia = `Em relação ao exercício anterior (${anteriorB.ano}), observou-se variação de ${formatPercent(varRec, 1)} na receita líquida e ${formatPercent(varPL, 1)} no patrimônio líquido. O endividamento geral ${varEnd > 0 ? `aumentou em ${formatNumber(Math.abs(varEnd), 1)} p.p.` : `reduziu em ${formatNumber(Math.abs(varEnd), 1)} p.p.`}, indicando ${varEnd > 0 ? 'maior utilização de recursos de terceiros' : 'desalavancagem e fortalecimento do capital próprio'}.`
    visaoGeral.push(fraseTendencia)
  }

  return {
    liquidez: { status: liqStatus, texto: liqTexto },
    endividamento: { status: endStatus, texto: endTexto },
    rentabilidade: { status: rentStatus, texto: rentTexto },
    roe: { status: roeStatus, texto: roeTexto },
    visaoGeral,
  }
}

// ==========================================
// TERMÔMETRO DE INSOLVÊNCIA DE KANITZ
// FI = (0,05 * X1) + (1,65 * X2) + (3,55 * X3) - (1,06 * X4) - (0,33 * X5)
// ==========================================
export interface KanitzVariavel {
  id: 'x1' | 'x2' | 'x3' | 'x4' | 'x5'
  nome: string
  sigla: string
  conceito: string
  formula: string
  coeficiente: number
  valor: number | null
  contribuicao: number | null
  descricaoValor: string
  numerador: { label: string; valor: number }
  denominador: { label: string; valor: number }
}

export interface KanitzResultado {
  fi: number | null
  classificacao: 'solvente' | 'penumbra' | 'insolvente' | 'indefinido'
  statusTexto: string
  corStatus: 'verde' | 'ambar' | 'vermelho' | 'cinza'
  descricaoClassificacao: string
  diagnosticoResumido: string
  variaveis: KanitzVariavel[]
  termometroPosicaoPercentual: number // 0% (-7 ou menor) a 100% (+7 ou maior), 50% = 0
  dadosDisponiveis: boolean
}

export function calcularKanitz(
  balanco?: Partial<BalancoRecord> | null,
  dre?: Partial<DreRecord> | null,
): KanitzResultado {
  if (!balanco && !dre) {
    return {
      fi: null,
      classificacao: 'indefinido',
      statusTexto: 'N/D',
      corStatus: 'cinza',
      descricaoClassificacao: 'Demonstrações contábeis não disponíveis para o exercício.',
      diagnosticoResumido: 'Sem dados para cálculo do Índice de Kanitz.',
      variaveis: [],
      termometroPosicaoPercentual: 50,
      dadosDisponiveis: false,
    }
  }

  const calcB = calcularBalanco(balanco)
  const calcD = calcularDre(dre)

  const ac = calcB.ativoCirculante
  const arlp = balanco?.realizavel_longo_prazo || 0
  const estoques = balanco?.estoques || 0
  const pc = calcB.passivoCirculante
  const pnc = calcB.passivoNaoCirculante
  const pl = calcB.patrimonioLiquido
  const lucroLiquido = calcD.lucroLiquido

  const passivoTotalExigivel = pc + pnc

  // X1 = Lucro Líquido ÷ Patrimônio Líquido (Rentabilidade do PL / ROE)
  const x1Val = pl !== 0 ? lucroLiquido / pl : null
  const c1 = 0.05
  const contrib1 = x1Val !== null ? c1 * x1Val : null

  // X2 = (Ativo Circulante + Realizável a Longo Prazo) ÷ (Passivo Circulante + Passivo Não Circulante) — Liquidez Geral
  const x2Val = passivoTotalExigivel > 0 ? (ac + arlp) / passivoTotalExigivel : null
  const c2 = 1.65
  const contrib2 = x2Val !== null ? c2 * x2Val : null

  // X3 = (Ativo Circulante − Estoques) ÷ Passivo Circulante — Liquidez Seca
  const x3Val = pc > 0 ? (ac - estoques) / pc : null
  const c3 = 3.55
  const contrib3 = x3Val !== null ? c3 * x3Val : null

  // X4 = (Passivo Circulante + Passivo Não Circulante) ÷ Patrimônio Líquido — Endividamento / Grau de endividamento
  const x4Val = pl > 0 ? passivoTotalExigivel / pl : null
  const c4 = -1.06
  const contrib4 = x4Val !== null ? c4 * x4Val : null

  // X5 = Ativo Circulante ÷ Passivo Circulante — Liquidez Corrente
  const x5Val = pc > 0 ? ac / pc : null
  const c5 = -0.33
  const contrib5 = x5Val !== null ? c5 * x5Val : null

  const variaveis: KanitzVariavel[] = [
    {
      id: 'x1',
      nome: 'Rentabilidade do Patrimônio Líquido',
      sigla: 'X1 (ROE)',
      conceito: 'Lucro Líquido ÷ Patrimônio Líquido',
      formula: '0,05 × (Lucro Líquido ÷ PL)',
      coeficiente: 0.05,
      valor: x1Val,
      contribuicao: contrib1,
      descricaoValor:
        x1Val !== null ? `${formatNumber(x1Val, 4)} (${formatPercent(x1Val * 100, 2)})` : 'N/D',
      numerador: { label: 'Lucro Líquido', valor: lucroLiquido },
      denominador: { label: 'Patrimônio Líquido', valor: pl },
    },
    {
      id: 'x2',
      nome: 'Liquidez Geral',
      sigla: 'X2 (LG)',
      conceito: '(Ativo Circulante + ARLP) ÷ Exigível Total',
      formula: '1,65 × [(AC + ARLP) ÷ (PC + PNC)]',
      coeficiente: 1.65,
      valor: x2Val,
      contribuicao: contrib2,
      descricaoValor: x2Val !== null ? `${formatNumber(x2Val, 4)}x` : 'N/D',
      numerador: { label: 'AC + Realizável LP', valor: ac + arlp },
      denominador: { label: 'Passivo Exigível (PC + PNC)', valor: passivoTotalExigivel },
    },
    {
      id: 'x3',
      nome: 'Liquidez Seca',
      sigla: 'X3 (LS)',
      conceito: '(Ativo Circulante − Estoques) ÷ Passivo Circulante',
      formula: '3,55 × [(AC − Estoques) ÷ PC]',
      coeficiente: 3.55,
      valor: x3Val,
      contribuicao: contrib3,
      descricaoValor: x3Val !== null ? `${formatNumber(x3Val, 4)}x` : 'N/D',
      numerador: { label: 'AC − Estoques', valor: ac - estoques },
      denominador: { label: 'Passivo Circulante', valor: pc },
    },
    {
      id: 'x4',
      nome: 'Grau de Endividamento',
      sigla: 'X4 (GE)',
      conceito: 'Exigível Total ÷ Patrimônio Líquido',
      formula: '−1,06 × [(PC + PNC) ÷ PL]',
      coeficiente: -1.06,
      valor: x4Val,
      contribuicao: contrib4,
      descricaoValor: x4Val !== null ? `${formatNumber(x4Val, 4)}x` : 'N/D',
      numerador: { label: 'Exigível Total (PC + PNC)', valor: passivoTotalExigivel },
      denominador: { label: 'Patrimônio Líquido', valor: pl },
    },
    {
      id: 'x5',
      nome: 'Liquidez Corrente',
      sigla: 'X5 (LC)',
      conceito: 'Ativo Circulante ÷ Passivo Circulante',
      formula: '−0,33 × (AC ÷ PC)',
      coeficiente: -0.33,
      valor: x5Val,
      contribuicao: contrib5,
      descricaoValor: x5Val !== null ? `${formatNumber(x5Val, 4)}x` : 'N/D',
      numerador: { label: 'Ativo Circulante', valor: ac },
      denominador: { label: 'Passivo Circulante', valor: pc },
    },
  ]

  // Se não houver dados essenciais para o cálculo
  if (
    contrib1 === null ||
    contrib2 === null ||
    contrib3 === null ||
    contrib4 === null ||
    contrib5 === null
  ) {
    return {
      fi: null,
      classificacao: 'indefinido',
      statusTexto: 'N/D (Incompleto)',
      corStatus: 'cinza',
      descricaoClassificacao:
        'Não foi possível apurar o FI integralmente devido à ausência de dados do PL ou de passivos circulantes/exigíveis.',
      diagnosticoResumido: 'Informações contábeis insuficientes para o Fator de Insolvência.',
      variaveis,
      termometroPosicaoPercentual: 50,
      dadosDisponiveis: false,
    }
  }

  // FI = (0,05 * X1) + (1,65 * X2) + (3,55 * X3) - (1,06 * X4) - (0,33 * X5)
  // Observação: os coeficientes c4 e c5 já estão negativos nas parcelas acima
  const fi = contrib1 + contrib2 + contrib3 + contrib4 + contrib5

  // Classificação clássica de Kanitz:
  // FI >= 0: Solvente
  // -3 <= FI < 0: Penumbra (zona de indefinição/risco moderado)
  // FI < -3: Insolvente (zona de perigo/risco crítico de descontinuidade)
  let classificacao: 'solvente' | 'penumbra' | 'insolvente' = 'solvente'
  let statusTexto = 'Solvente'
  let corStatus: 'verde' | 'ambar' | 'vermelho' = 'verde'
  let descricaoClassificacao = ''
  let diagnosticoResumido = ''

  if (fi >= 0) {
    classificacao = 'solvente'
    statusTexto = 'Solvente (Zona de Solvência)'
    corStatus = 'verde'
    descricaoClassificacao =
      'A empresa está situada na Zona de Solvência (FI ≥ 0,00). Apresenta probabilidade muito baixa ou remota de insolvência ou descontinuidade financeira no médio prazo.'
    diagnosticoResumido = `O Fator de Insolvência de ${formatNumber(fi, 2)} reflete sólida capacidade de pagamento e equilíbrio entre liquidez, rentabilidade e endividamento.`
  } else if (fi >= -3) {
    classificacao = 'penumbra'
    statusTexto = 'Penumbra (Zona de Indefinição)'
    corStatus = 'ambar'
    descricaoClassificacao =
      'A empresa encontra-se na Zona de Penumbra / Indefinição (0 > FI ≥ −3,00). Há sinais de vulnerabilidade operacional e financeira que demandam atenção gerencial e acompanhamento tempestivo.'
    diagnosticoResumido = `O Fator de Insolvência de ${formatNumber(fi, 2)} sinaliza risco moderado de insolvência. Recomenda-se reforçar a liquidez e controlar o grau de endividamento.`
  } else {
    classificacao = 'insolvente'
    statusTexto = 'Insolvente (Zona de Risco Crítico)'
    corStatus = 'vermelho'
    descricaoClassificacao =
      'A empresa está na Zona de Insolvência (FI < −3,00). Elevada probabilidade de dificuldades financeiras severas e risco de continuidade operacional.'
    diagnosticoResumido = `O Fator de Insolvência de ${formatNumber(fi, 2)} aponta para alto risco de insolvência. É urgente reestruturar o passivo e recompor o patrimônio líquido.`
  }

  // Posição no termômetro visual: Escala de -7 a +7 (total 14 pontos)
  // clamped: Math.max(-7, Math.min(7, fi))
  // percentual = ((fiClamped + 7) / 14) * 100
  const fiClamped = Math.max(-7, Math.min(7, fi))
  const termometroPosicaoPercentual = ((fiClamped + 7) / 14) * 100

  return {
    fi,
    classificacao,
    statusTexto,
    corStatus,
    descricaoClassificacao,
    diagnosticoResumido,
    variaveis,
    termometroPosicaoPercentual,
    dadosDisponiveis: true,
  }
}
