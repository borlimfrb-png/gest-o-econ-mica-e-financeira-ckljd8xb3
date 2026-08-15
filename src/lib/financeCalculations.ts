import type {
  BalancoRecord,
  DreRecord,
  BalancoCalculado,
  DreCalculado,
  IndicadoresCalculados,
} from '@/types/finance'

export function formatBrlMil(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return '—'
  const isNegative = val < 0
  const absVal = Math.abs(val)
  const formatted = new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  }).format(absVal)
  return `${isNegative ? '- ' : ''}R$ ${formatted} mil`
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
