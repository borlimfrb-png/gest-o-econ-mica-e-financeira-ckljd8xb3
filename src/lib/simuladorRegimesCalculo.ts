/**
 * Simulador de Regimes Tributários — comparativo de CARGA TRIBUTÁRIA
 * entre Simples Nacional, Lucro Presumido e Lucro Real, com créditos de
 * impostos calculados a partir das ENTRADAS DE COMPRAS identificadas pelo
 * Centro de Custo CC-098 "Matéria Prima" e cenário pós-Reforma Tributária
 * (CBS/IBS — EC 132/2023 e LC 214/2025, transição 2026→2033).
 *
 * Tudo roda no frontend (regra do projeto): backend devolve números crus,
 * formatação pt-BR só na UI e na exportação.
 */

import type { ContaRecord, LancamentoRecord, PlanoContaRecord } from '@/types/finance'
import { calcularDreGerencialMatriz } from './dreGerencialCalculo'
import { gerarListaMeses } from './dreGerencialTypes'
import { lancamentoPertenceAoCentroCusto } from './reformaTributariaCalculo'
import {
  calcularSimplesNacional,
  calcularLucroPresumido,
  calcularLucroReal,
  type RegimeResultado,
} from './taxCalculations'

// Centro de custo das entradas de compras (Matéria Prima) — fonte dos créditos
export const CODIGO_CENTRO_COMPRAS = 'CC-098'

// Alíquotas estaduais/federais configuráveis (em %) — padrões editáveis na tela
export const ALIQUOTA_ICMS_PADRAO = 18
export const ALIQUOTA_IPI_PADRAO = 10

// Alíquotas de referência da Reforma Tributária (em %)
export const ALIQUOTA_CBS_PADRAO = 8.8
export const ALIQUOTA_IBS_PADRAO = 17.68
export const ALIQUOTA_REFERENCIA_PADRAO = Number(
  (ALIQUOTA_CBS_PADRAO + ALIQUOTA_IBS_PADRAO).toFixed(2),
) // 26,48%

export interface FaseTransicaoItem {
  ano: number
  percentualCbs: number // % de vigor da CBS (substituindo PIS/COFINS)
  percentualIbs: number // % de vigor do IBS (substituindo ICMS/IPI/ISS)
  descricao: string
}

// Fase de transição 2026→2033 (percentuais de vigor CBS/IBS)
export const FASES_TRANSICAO: FaseTransicaoItem[] = [
  { ano: 2026, percentualCbs: 33, percentualIbs: 10, descricao: 'Ano-teste (CBS 33% / IBS 10%)' },
  { ano: 2027, percentualCbs: 66, percentualIbs: 0, descricao: 'PIS/COFINS revogados (CBS 66%)' },
  { ano: 2028, percentualCbs: 90, percentualIbs: 90, descricao: 'Rampa de transição (90%)' },
  { ano: 2029, percentualCbs: 100, percentualIbs: 100, descricao: 'CBS integral / início IBS' },
  { ano: 2030, percentualCbs: 100, percentualIbs: 100, descricao: 'Transição integral' },
  { ano: 2031, percentualCbs: 100, percentualIbs: 100, descricao: 'Transição integral' },
  { ano: 2032, percentualCbs: 100, percentualIbs: 100, descricao: 'Transição integral' },
  { ano: 2033, percentualCbs: 100, percentualIbs: 100, descricao: 'Vigor pleno CBS + IBS' },
]

export function obterFaseTransicao(ano: number): FaseTransicaoItem {
  const fase = FASES_TRANSICAO.find((f) => f.ano === ano)
  if (fase) return fase
  return { ano, percentualCbs: 0, percentualIbs: 0, descricao: 'Antes da transição (2026)' }
}

export interface RegimeCargaItem {
  id: 'simples' | 'presumido' | 'real'
  nome: string
  descricao: string
  impostoTotal: number // R$ (já líquido dos créditos)
  impostoBruto: number // R$ antes dos créditos
  creditoCompras: number // R$ de crédito aproveitado (compras CC-098)
  aliquotaEfetiva: number // %
  baseCalculoPrincipal: number
  isMenorCarga: boolean
  isRegimeAtual: boolean
  diferencaVsMenor: number // R$
  diferencaPercentual: number // %
  breakdown: RegimeResultado['breakdown']
  faixaSimples?: string
  creditos?: {
    pis: number // R$ crédito de PIS (1,65% s/ compras)
    cofins: number // R$ crédito de COFINS (7,6% s/ compras)
    icms: number // R$ crédito de ICMS (alíquota estadual s/ compras)
    ipi: number // R$ crédito de IPI (alíquota configurada s/ compras)
  }
}

export interface CenarioReformaItem {
  anoTransicao: number
  fase: FaseTransicaoItem
  regimeAtualId: 'simples' | 'presumido' | 'real'
  cargaRegimeAtual: number // R$ — carga do regime atual (com créditos)
  cargaPosReforma: number // R$ — CBS/IBS + tributos antigos remanescentes
  cbs: { debito: number; credito: number; saldo: number }
  ibs: { debito: number; credito: number; saldo: number }
  pisCofinsRemanescente: number // R$ de PIS/COFINS antigos ainda devidos na fase
  issRemanescente: number // R$ de ISS antigo ainda devido na fase
  economia: number // R$ = cargaRegimeAtual - cargaPosReforma (positivo = economia)
  economiaPercentual: number // %
  aliquotaCbs: number // %
  aliquotaIbs: number // %
}

export interface SimuladorRegimesResultado {
  ano: number
  receitaBruta: number
  lucroLiquido: number
  folhaPagamento: number
  aliquotaIss: number
  aliquotaIcms: number // % ICMS estadual usado no crédito
  aliquotaIpi: number // % IPI usado no crédito
  comprasEntradas: number // R$ total das entradas CC-098 no período
  totalLancamentosCompras: number
  centroCustoEncontrado: boolean
  centroCustoNome?: string
  centroCustoCodigo: string // código do centro de compras usado
  observacoes: string[] // avisos do motor (centro ausente, período vazio, teto Simples...)
  regimes: {
    simples: RegimeCargaItem
    presumido: RegimeCargaItem
    real: RegimeCargaItem
  }
  menorRegimeId: 'simples' | 'presumido' | 'real'
  economiaMaxima: number // R$ entre o maior e o menor
  reforma: CenarioReformaItem
  temDados: boolean
}

export interface OpcoesSimuladorRegimes {
  ano: number
  receitaBruta: number
  lucroLiquido: number
  folhaPagamento?: number
  aliquotaIssPercent?: number
  anexoSimples?: string
  regimeAtualId: 'simples' | 'presumido' | 'real'
  anoTransicao?: number
  aliquotaReferenciaPercent?: number // % combinada CBS+IBS (padrão 26,48)
  lancamentos: LancamentoRecord[]
  contas: ContaRecord[]
  planoContas?: PlanoContaRecord[]
  centros?: Array<{ id: string; codigo?: string; nome?: string }>
  codigoCentroCompras?: string
  aliquotaIcmsPercent?: number // % ICMS estadual (padrão 18) — crédito sobre compras
  aliquotaIpiPercent?: number // % IPI (padrão 10) — crédito sobre compras
}

function arred(v: number): number {
  return Number(v.toFixed(2))
}

/**
 * Soma as entradas de compras do Centro de Custo CC-098 no exercício.
 * Reaproveita o identificador de centro da Reforma Tributária (IDs do centro,
 * centro herdado do plano de contas ou histórico citando o código).
 */
function somarComprasCentroCusto(opcoes: {
  ano: number
  lancamentos: LancamentoRecord[]
  contas?: ContaRecord[]
  planoContas: PlanoContaRecord[]
  centros: Array<{ id: string; codigo?: string; nome?: string }>
  codigoCentro: string
}): { total: number; quantidade: number; encontrado: boolean; nome?: string } {
  const codigoAlvo = opcoes.codigoCentro.trim().toUpperCase()
  const meses = gerarListaMeses(opcoes.ano, 1, 12)
  const chaves = new Set(meses.map((m) => m.chave))

  const centrosAlvo = opcoes.centros.filter((c) => {
    const cod = (c.codigo || '').trim().toUpperCase()
    return cod === codigoAlvo || cod.includes(codigoAlvo)
  })
  const idsAlvo = new Set(centrosAlvo.map((c) => c.id))
  let nomeCentro: string | undefined = centrosAlvo[0]?.nome

  const planoMap = new Map<string, PlanoContaRecord>()
  // Mapa id -> código do centro. FONTE PRIMÁRIA: plano_contas.centro (com o
  // código vindo do expand do plano quando existir). A coleção `centros` é só
  // complemento — idsAlvo vazio (centros não carregados/sem código populado)
  // NÃO pode zerar as compras.
  const codigoCentroPorId = new Map<string, string>()
  for (const p of opcoes.planoContas) {
    planoMap.set(p.id, p)
    if (!p.centro) continue
    const codCentro =
      ((p.expand?.centro as any)?.codigo || '').trim().toUpperCase() ||
      codigoCentroPorId.get(p.centro) ||
      ''
    if (codCentro) codigoCentroPorId.set(p.centro, codCentro)
    if (codCentro.includes(codigoAlvo)) {
      if (!nomeCentro) nomeCentro = (p.expand?.centro as any)?.nome
      idsAlvo.add(p.centro)
    }
  }
  for (const c of opcoes.centros) {
    if (!codigoCentroPorId.has(c.id) || !codigoCentroPorId.get(c.id)) {
      codigoCentroPorId.set(c.id, (c.codigo || '').trim().toUpperCase())
    }
  }

  // Matcher blindado: resolve o centro do lançamento pelo plano de contas
  // (mapa acima) e pelo expand do próprio lançamento (plano_conta.centro),
  // sem depender da coleção `centros` ter vindo carregada.
  const lancPertenceAoCentroCompras = (lanc: LancamentoRecord): boolean => {
    const plano = lanc.plano_conta && planoMap.size > 0 ? planoMap.get(lanc.plano_conta) : undefined
    const centroPlanoId =
      (lanc.expand?.plano_conta as any)?.centro || plano?.centro || (lanc as any).centro
    if (centroPlanoId) {
      const codCentro = codigoCentroPorId.get(centroPlanoId) || ''
      if (codCentro && codCentro.includes(codigoAlvo)) return true
      if (idsAlvo.has(centroPlanoId)) return true
    }
    const codExpandLanc = (((lanc.expand?.plano_conta as any)?.expand?.centro as any)?.codigo || '')
      .trim()
      .toUpperCase()
    if (codExpandLanc && codExpandLanc.includes(codigoAlvo)) return true
    const codPlanoExpand = (((plano?.expand?.centro as any)?.codigo || '') as string)
      .trim()
      .toUpperCase()
    if (codPlanoExpand && codPlanoExpand.includes(codigoAlvo)) return true
    // Fallback: identificador da Reforma Tributária (histórico citando o código)
    return lancamentoPertenceAoCentroCusto(lanc, idsAlvo, planoMap, codigoAlvo)
  }

  let total = 0
  let quantidade = 0
  for (const lanc of opcoes.lancamentos) {
    if (lanc.estornado || !lanc.data) continue
    if (!chaves.has(lanc.data.slice(0, 7))) continue
    if (lancPertenceAoCentroCompras(lanc)) {
      total += Number(lanc.valor) || 0
      quantidade++
    }
  }

  // Fallback: agrega pelas CONTAS da DRE Gerencial (mesma resolução de centro
  // usada pela tela DRE Gerencial, via calcularDreGerencialMatriz) — cobre
  // lançamentos sem plano_conta que apontam direto para a conta, e contas cujo
  // vínculo de centro está registrado no plano de contas.
  if (total === 0) {
    const matriz = calcularDreGerencialMatriz(
      opcoes.lancamentos,
      opcoes.contas || [],
      meses,
      opcoes.planoContas,
    )
    let totalFallback = 0
    for (const grupo of matriz.grupos) {
      for (const conta of grupo.contas) {
        const codigoConta = (conta.centroCodigo || '').trim().toUpperCase()
        const pertence =
          Boolean(conta.centroId && idsAlvo.has(conta.centroId)) ||
          (codigoConta !== '' && codigoConta.includes(codigoAlvo))
        if (pertence) {
          totalFallback += Number(conta.totalPeriodo) || 0
        }
      }
    }
    if (totalFallback > 0) {
      total = totalFallback
    }
  }

  return {
    total: arred(total),
    quantidade,
    encontrado: idsAlvo.size > 0,
    nome: nomeCentro,
  }
}

function paraRegimeCarga(
  reg: RegimeResultado,
  opcoes: {
    creditoCompras: number
    isRegimeAtual: boolean
    menor: number
  },
): RegimeCargaItem {
  const impostoBruto = reg.impostoTotal
  const impostoTotal = Math.max(0, arred(impostoBruto - opcoes.creditoCompras))
  const receita = Math.max(reg.detalhesCalculo.receitaBruta, 0)
  return {
    id: reg.id,
    nome: reg.nome,
    descricao: reg.descricao,
    impostoTotal,
    impostoBruto: arred(impostoBruto),
    creditoCompras: arred(opcoes.creditoCompras),
    aliquotaEfetiva: receita > 0 ? arred((impostoTotal / receita) * 100) : 0,
    baseCalculoPrincipal: reg.baseCalculoPrincipal,
    isMenorCarga: impostoTotal <= opcoes.menor + 0.005,
    isRegimeAtual: opcoes.isRegimeAtual,
    diferencaVsMenor: arred(Math.max(0, impostoTotal - opcoes.menor)),
    diferencaPercentual:
      opcoes.menor > 0 && impostoTotal > opcoes.menor
        ? arred(((impostoTotal - opcoes.menor) / opcoes.menor) * 100)
        : 0,
    breakdown: reg.breakdown,
    faixaSimples: reg.detalhesCalculo.faixaSimples,
  }
}

/**
 * Motor principal do Simulador de Regimes.
 * Saídas (débitos) = Receita Bruta da DRE; Créditos = compras CC-098.
 */
export function calcularSimuladorRegimes(
  opcoes: OpcoesSimuladorRegimes,
): SimuladorRegimesResultado {
  const {
    ano,
    receitaBruta,
    lucroLiquido,
    folhaPagamento = 0,
    aliquotaIssPercent = 5,
    anexoSimples = 'Anexo I - Comércio',
    regimeAtualId,
    anoTransicao = 2026,
    aliquotaReferenciaPercent = ALIQUOTA_REFERENCIA_PADRAO,
    aliquotaIcmsPercent = ALIQUOTA_ICMS_PADRAO,
    aliquotaIpiPercent = ALIQUOTA_IPI_PADRAO,
    lancamentos,
    contas,
    planoContas = [],
    centros = [],
    codigoCentroCompras = CODIGO_CENTRO_COMPRAS,
  } = opcoes

  const observacoes: string[] = []
  const folha = folhaPagamento > 0 ? folhaPagamento : receitaBruta * 0.25
  const rb = Math.max(receitaBruta, 0)

  // 1. Entradas de compras (CC-098 Matéria Prima) — base dos créditos
  const compras = somarComprasCentroCusto({
    ano,
    lancamentos,
    contas,
    planoContas,
    centros,
    codigoCentro: codigoCentroCompras,
  })

  // 2. Apuração dos 3 regimes (motor oficial existente)
  const simplesBruto = calcularSimplesNacional(rb, folha, anexoSimples)
  const presumido = calcularLucroPresumido(rb, folha, aliquotaIssPercent)
  const realBruto = calcularLucroReal(rb, lucroLiquido, folha, aliquotaIssPercent)

  // 3. Créditos sobre as compras (CC-098 Matéria Prima):
  //    - Simples Nacional: nenhum crédito (DAS unificado) — compras servem só de rastreio.
  //    - Lucro Presumido: regime cumulativo — sem crédito de PIS/COFINS; ICMS e IPI
  //      geram crédito integral (destaque na nota de entrada).
  //    - Lucro Real: crédito integral de PIS (1,65%), COFINS (7,6%), ICMS (alíquota
  //      estadual configurada) e IPI (alíquota configurada) sobre as compras.
  const aliqIcms = Math.max(Number(aliquotaIcmsPercent) || 0, 0)
  const aliqIpi = Math.max(Number(aliquotaIpiPercent) || 0, 0)
  const creditoIcmsCompra = arred(compras.total * (aliqIcms / 100))
  const creditoIpiCompra = arred(compras.total * (aliqIpi / 100))
  const creditoReal = arred(compras.total * (0.0165 + 0.076) + creditoIcmsCompra + creditoIpiCompra)
  if (!compras.encontrado) {
    observacoes.push(
      `Centro de Custo ${codigoCentroCompras} não encontrado no cadastro — créditos de compras apurados sem entradas.`,
    )
  } else if (compras.quantidade === 0) {
    observacoes.push(
      `Nenhum lançamento de entrada no Centro de Custo ${compras.nome ? `${codigoCentroCompras} - ${compras.nome}` : codigoCentroCompras} no exercício ${ano} — créditos zerados.`,
    )
  }
  if (rb <= 0) {
    observacoes.push(
      `Receita Bruta da DRE igual a zero no exercício ${ano} — apuração dos regimes sem base de débito.`,
    )
  }
  if (lucroLiquido < 0) {
    observacoes.push(
      'Lucro Líquido negativo no período — Lucro Real assume prejuízo fiscal (sem IRPJ/CSLL).',
    )
  }

  const itemSimples = paraRegimeCarga(simplesBruto, {
    creditoCompras: 0,
    isRegimeAtual: regimeAtualId === 'simples',
    menor: Number.POSITIVE_INFINITY,
  })
  const itemPresumido = paraRegimeCarga(presumido, {
    creditoCompras: arred(creditoIcmsCompra + creditoIpiCompra),
    isRegimeAtual: regimeAtualId === 'presumido',
    menor: Number.POSITIVE_INFINITY,
  })
  const itemReal = paraRegimeCarga(realBruto, {
    creditoCompras: creditoReal,
    isRegimeAtual: regimeAtualId === 'real',
    menor: Number.POSITIVE_INFINITY,
  })

  // Detalhamento dos créditos por tributo em cada regime (UI + exportação)
  itemSimples.creditos = { pis: 0, cofins: 0, icms: 0, ipi: 0 }
  itemPresumido.creditos = { pis: 0, cofins: 0, icms: creditoIcmsCompra, ipi: creditoIpiCompra }
  itemReal.creditos = {
    pis: arred(compras.total * 0.0165),
    cofins: arred(compras.total * 0.076),
    icms: creditoIcmsCompra,
    ipi: creditoIpiCompra,
  }

  // 4. Detalha os créditos no breakdown de Presumido e Real
  if (creditoIcmsCompra > 0) {
    itemPresumido.breakdown = [
      ...itemPresumido.breakdown,
      {
        nome: 'Crédito de ICMS s/ Compras (Matéria Prima)',
        sigla: 'Créd. ICMS',
        baseCalculo: compras.total,
        aliquotaNominal: aliqIcms,
        valor: -creditoIcmsCompra,
        descricao: `Crédito integral do ICMS estadual (${aliqIcms.toFixed(2).replace('.', ',')}%) sobre as entradas do Centro de Custo ${codigoCentroCompras}`,
      },
    ]
  }
  if (creditoIpiCompra > 0) {
    itemPresumido.breakdown = [
      ...itemPresumido.breakdown,
      {
        nome: 'Crédito de IPI s/ Compras (Matéria Prima)',
        sigla: 'Créd. IPI',
        baseCalculo: compras.total,
        aliquotaNominal: aliqIpi,
        valor: -creditoIpiCompra,
        descricao: `Crédito do IPI (${aliqIpi.toFixed(2).replace('.', ',')}%) sobre as entradas do Centro de Custo ${codigoCentroCompras}`,
      },
    ]
  }
  if (creditoReal > 0) {
    itemReal.breakdown = [
      ...itemReal.breakdown,
      {
        nome: 'Crédito PIS/COFINS s/ Compras (Matéria Prima)',
        sigla: 'Créd. PIS/COFINS',
        baseCalculo: compras.total,
        aliquotaNominal:
          compras.total > 0 ? arred((0.0925 * compras.total * 100) / compras.total) : 0,
        valor: -arred(compras.total * 0.0925),
        descricao: `Crédito não-cumulativo sobre entradas do Centro de Custo ${codigoCentroCompras} (PIS 1,65% + COFINS 7,6%)`,
      },
    ]
    itemReal.breakdown = [
      ...itemReal.breakdown,
      {
        nome: 'Crédito de ICMS s/ Compras (Matéria Prima)',
        sigla: 'Créd. ICMS',
        baseCalculo: compras.total,
        aliquotaNominal: aliqIcms,
        valor: -creditoIcmsCompra,
        descricao: `Crédito integral do ICMS estadual (${aliqIcms.toFixed(2).replace('.', ',')}%) sobre as entradas do Centro de Custo ${codigoCentroCompras}`,
      },
    ]
    itemReal.breakdown = [
      ...itemReal.breakdown,
      {
        nome: 'Crédito de IPI s/ Compras (Matéria Prima)',
        sigla: 'Créd. IPI',
        baseCalculo: compras.total,
        aliquotaNominal: aliqIpi,
        valor: -creditoIpiCompra,
        descricao: `Crédito do IPI (${aliqIpi.toFixed(2).replace('.', ',')}%) sobre as entradas do Centro de Custo ${codigoCentroCompras}`,
      },
    ]
  }

  const lista = [itemSimples, itemPresumido, itemReal]
  // Simples vedado acima do teto de R$ 4,8M
  const simplesPermitido = rb <= 4800000
  if (!simplesPermitido) {
    observacoes.push(
      'Simples Nacional vedado: Receita Bruta acima do teto de R$ 4.800.000,00 — regime excluído do comparativo.',
    )
  }
  const candidatos = simplesPermitido ? lista : lista.filter((r) => r.id !== 'simples')
  const menor = candidatos.reduce(
    (min, r) => (r.impostoTotal < min ? r.impostoTotal : min),
    Number.POSITIVE_INFINITY,
  )

  for (const item of lista) {
    item.isMenorCarga =
      candidatos.some((c) => c.id === item.id) && item.impostoTotal <= menor + 0.005
    item.diferencaVsMenor = arred(Math.max(0, item.impostoTotal - menor))
    item.diferencaPercentual =
      menor > 0 && item.impostoTotal > menor
        ? arred(((item.impostoTotal - menor) / menor) * 100)
        : 0
  }

  const menorRegimeId = candidatos.reduce((a, b) => (b.impostoTotal < a.impostoTotal ? b : a)).id
  const maior = lista.reduce((m, r) => Math.max(m, r.impostoTotal), 0)
  const economiaMaxima = arred(maior - menor)

  // 5. Cenário pós-Reforma Tributária (CBS/IBS) partindo do regime atual
  const regimeAtualItem = lista.find((r) => r.id === regimeAtualId) || itemSimples
  const fase = obterFaseTransicao(anoTransicao)

  // Alíquotas de referência configuráveis (% combinada rateada nas proporções 8,8 / 17,68)
  const refTotal =
    aliquotaReferenciaPercent > 0 ? aliquotaReferenciaPercent : ALIQUOTA_REFERENCIA_PADRAO
  const aliquotaCbs = arred(refTotal * (ALIQUOTA_CBS_PADRAO / ALIQUOTA_REFERENCIA_PADRAO))
  const aliquotaIbs = arred(refTotal * (ALIQUOTA_IBS_PADRAO / ALIQUOTA_REFERENCIA_PADRAO))

  const fCbs = Math.min(100, Math.max(0, fase.percentualCbs)) / 100
  const fIbs = Math.min(100, Math.max(0, fase.percentualIbs)) / 100

  // Débitos CBS/IBS sobre a receita; crédito PLENO sobre as compras CC-098
  const debitoCbsBase = arred(rb * (aliquotaCbs / 100))
  const debitoIbsBase = arred(rb * (aliquotaIbs / 100))
  const creditoCbsBase = arred(compras.total * (aliquotaCbs / 100))
  const creditoIbsBase = arred(compras.total * (aliquotaIbs / 100))

  const cbs = {
    debito: arred(debitoCbsBase * fCbs),
    credito: arred(creditoCbsBase * fCbs),
    saldo: 0,
  }
  cbs.saldo = arred(cbs.debito - cbs.credito)
  const ibs = {
    debito: arred(debitoIbsBase * fIbs),
    credito: arred(creditoIbsBase * fIbs),
    saldo: 0,
  }
  ibs.saldo = arred(ibs.debito - ibs.credito)

  // Tributos antigos remanescentes na fase: PIS/COFINS cedem à CBS; ISS (e ICMS, quando
  // embutido) cede ao IBS. IRPJ/CSLL nunca são substituídos.
  const regimeAtualBruto =
    regimeAtualId === 'simples'
      ? simplesBruto
      : regimeAtualId === 'presumido'
        ? presumido
        : realBruto
  const valorPorSigla = (siglas: string[]): number => {
    return regimeAtualBruto.breakdown
      .filter((b) => siglas.some((s) => b.sigla.toUpperCase().includes(s)))
      .reduce((acc, b) => acc + Math.max(0, b.valor), 0)
  }
  const pisCofinsBrutos = valorPorSigla(['PIS', 'COFINS'])
  const issBruto = valorPorSigla(['ISS'])
  const pisCofinsRemanescente = arred(pisCofinsBrutos * (1 - fCbs))
  const issRemanescente = arred(issBruto * (1 - fIbs))

  const cargaRegimeAtual = regimeAtualItem.impostoTotal
  const cargaPosReforma = arred(cbs.saldo + ibs.saldo + pisCofinsRemanescente + issRemanescente)
  const reforma: CenarioReformaItem = {
    anoTransicao,
    fase,
    regimeAtualId,
    cargaRegimeAtual,
    cargaPosReforma,
    cbs,
    ibs,
    pisCofinsRemanescente,
    issRemanescente,
    economia: arred(cargaRegimeAtual - cargaPosReforma),
    economiaPercentual:
      cargaRegimeAtual > 0
        ? arred(((cargaRegimeAtual - cargaPosReforma) / cargaRegimeAtual) * 100)
        : 0,
    aliquotaCbs,
    aliquotaIbs,
  }

  return {
    ano,
    receitaBruta: rb,
    lucroLiquido,
    folhaPagamento: folha,
    aliquotaIss: aliquotaIssPercent,
    aliquotaIcms: aliqIcms,
    aliquotaIpi: aliqIpi,
    comprasEntradas: compras.total,
    totalLancamentosCompras: compras.quantidade,
    centroCustoEncontrado: compras.encontrado,
    centroCustoNome: compras.nome,
    centroCustoCodigo: codigoCentroCompras,
    observacoes,
    regimes: { simples: itemSimples, presumido: itemPresumido, real: itemReal },
    menorRegimeId,
    economiaMaxima,
    reforma,
    temDados: rb > 0 || compras.total > 0,
  }
}

/**
 * Resolve o regime configurado da empresa a partir do campo forma_tributacao
 */
export function resolverRegimeAtualId(formaTributacao?: string): 'simples' | 'presumido' | 'real' {
  const f = (formaTributacao || '').toLowerCase()
  if (f.includes('simples')) return 'simples'
  if (f.includes('presumido')) return 'presumido'
  if (f.includes('real')) return 'real'
  return 'presumido'
}
