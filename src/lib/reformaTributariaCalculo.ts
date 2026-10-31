/**
 * Motor de Cálculo da Reforma Tributária (LC 214/2025)
 * Apuração de CBS (Contribuição sobre Bens e Serviços) e IBS (Imposto sobre Bens e Serviços)
 * Modelo não-cumulativo: débito sobre saídas (receita DRE) e crédito sobre entradas (Centro de Custo CC-018).
 */

import type { ContaRecord, LancamentoRecord, PlanoContaRecord } from '@/types/finance'
import { calcularDreGerencialMatriz } from './dreGerencialCalculo'
import { gerarListaMeses, type MesItem } from './dreGerencialTypes'

// Alíquotas de referência oficiais da Reforma Tributária (LC 214/2025)
export const CBS_RATE = 0.088 // 8,80%
export const IBS_RATE = 0.1768 // 17,68%
export const ALIQUOTA_COMBINADA_RATE = CBS_RATE + IBS_RATE // 26,48%

// Código do Centro de Custo padrão para tomada de créditos de entradas
export const CENTRO_CUSTO_ENTRADAS_CODIGO = 'CC-018'

export interface ApuracaoTributoItem {
  tributo: 'CBS' | 'IBS'
  nomeCompleto: string
  aliquota: number
  aliquotaFormatada: string
  baseSaidas: number
  debito: number
  baseEntradas: number
  credito: number
  saldoLiquido: number // debito - credito
  tipoSaldo: 'a_recolher' | 'a_compensar'
}

export interface ReformaTributariaMesItem {
  mesChave: string // YYYY-MM
  rotuloCurto: string // Ex: Jan/23
  rotuloCompleto: string // Ex: Janeiro de 2023
  ano: number
  mes: number
  receitaSaidas: number
  entradasCC018: number
  cbs: {
    debito: number
    credito: number
    saldo: number
  }
  ibs: {
    debito: number
    credito: number
    saldo: number
  }
  totalDebitos: number
  totalCreditos: number
  saldoLiquido: number
  cargaEfetivaPercent: number
  tipoSaldo: 'a_recolher' | 'a_compensar'
}

export interface ReformaTributariaResultado {
  periodoTipo: 'mes' | 'ano'
  ano: number
  mes?: number
  descricaoPeriodo: string
  // Bases de cálculo
  receitaBrutaSaidas: number
  entradasCC018: number
  // Apuração por tributo
  cbs: ApuracaoTributoItem
  ibs: ApuracaoTributoItem
  // Consolidação combinada
  totalDebitos: number
  totalCreditos: number
  saldoLiquido: number // debitoTotal - creditoTotal
  tipoSaldo: 'a_recolher' | 'a_compensar'
  cargaEfetivaPercent: number // (saldoLiquido / receitaBrutaSaidas) * 100
  // Detalhamento mensal (disponível quando visão for por ano ou mais de um mês)
  meses: ReformaTributariaMesItem[]
  // Metadados
  centroCustoCodigo: string
  centroCustoEncontrado: boolean
  centroCustoNome?: string
  totalLancamentosCC018: number
}

/**
 * Calcula a apuração de um tributo individual (CBS ou IBS)
 */
export function calcularTributoIndividual(
  tributo: 'CBS' | 'IBS',
  aliquota: number,
  baseSaidas: number,
  baseEntradas: number,
): ApuracaoTributoItem {
  const safeBaseSaidas = Math.max(0, Number(baseSaidas) || 0)
  const safeBaseEntradas = Math.max(0, Number(baseEntradas) || 0)

  const debito = Number((safeBaseSaidas * aliquota).toFixed(2))
  const credito = Number((safeBaseEntradas * aliquota).toFixed(2))
  const saldoLiquido = Number((debito - credito).toFixed(2))

  return {
    tributo,
    nomeCompleto:
      tributo === 'CBS'
        ? 'Contribuição sobre Bens e Serviços (Federal)'
        : 'Imposto sobre Bens e Serviços (Estadual/Municipal)',
    aliquota,
    aliquotaFormatada: `${(aliquota * 100).toFixed(2).replace('.', ',')}%`,
    baseSaidas: safeBaseSaidas,
    debito,
    baseEntradas: safeBaseEntradas,
    credito,
    saldoLiquido,
    tipoSaldo: saldoLiquido >= 0 ? 'a_recolher' : 'a_compensar',
  }
}

/**
 * Calcula a carga efetiva percentual: (saldoLiquido / receitaBruta) * 100
 */
export function calcularCargaEfetiva(saldoLiquido: number, receitaBruta: number): number {
  if (!receitaBruta || receitaBruta <= 0) return 0
  return Number(((saldoLiquido / receitaBruta) * 100).toFixed(2))
}

/**
 * Identifica se um lançamento contábil pertence ao Centro de Custo CC-018.
 * Não usa ID fixo — busca pelo código CC-018 ou códigos mapeados.
 */
export function lancamentoPertenceAoCentroCusto(
  lanc: LancamentoRecord,
  centroIdsAlvo: Set<string>,
  planoContasMap?: Map<string, PlanoContaRecord>,
  codigoCentroAlvo: string = CENTRO_CUSTO_ENTRADAS_CODIGO,
): boolean {
  if (lanc.estornado) return false

  // 1. Verificação direta por ID do centro no set identificado
  const expandPlano = lanc.expand?.plano_conta
  const centroExpand = expandPlano?.expand?.centro
  const planoDoMapa =
    lanc.plano_conta && planoContasMap ? planoContasMap.get(lanc.plano_conta) : undefined

  const centroIdLanc =
    centroExpand?.id ||
    expandPlano?.centro ||
    planoDoMapa?.expand?.centro?.id ||
    planoDoMapa?.centro ||
    (lanc as any).centro

  if (centroIdLanc && centroIdsAlvo.has(centroIdLanc)) {
    return true
  }

  // 2. Verificação direta pelo código do centro expandido
  const codigoExpandido =
    (centroExpand as any)?.codigo || (planoDoMapa?.expand?.centro as any)?.codigo

  if (
    codigoExpandido &&
    String(codigoExpandido).trim().toUpperCase() === codigoCentroAlvo.toUpperCase()
  ) {
    return true
  }

  // 3. Fallback: histórico menciona explicitamente o código do centro
  if (lanc.historico && lanc.historico.toUpperCase().includes(codigoCentroAlvo.toUpperCase())) {
    return true
  }

  return false
}

export interface OpcoesCalculoReforma {
  periodoTipo: 'mes' | 'ano'
  ano: number
  mes?: number // 1 a 12 (obrigatório se periodoTipo === 'mes')
  lancamentos: LancamentoRecord[]
  contas: ContaRecord[]
  planoContas?: PlanoContaRecord[]
  centros?: Array<{ id: string; codigo?: string; nome?: string }>
  codigoCentroEntradas?: string
}

/**
 * Motor principal que realiza a apuração completa da Reforma Tributária
 * utilizando o motor de DRE gerencial para saídas e os lançamentos do CC-018 para entradas.
 */
export function calcularReformaTributaria(
  opcoes: OpcoesCalculoReforma,
): ReformaTributariaResultado {
  const {
    periodoTipo,
    ano,
    mes = 1,
    lancamentos,
    contas,
    planoContas = [],
    centros = [],
    codigoCentroEntradas = CENTRO_CUSTO_ENTRADAS_CODIGO,
  } = opcoes

  // 1. Identificar os IDs de centros de custo correspondentes a CC-018
  const codigoAlvoNorm = codigoCentroEntradas.trim().toUpperCase()
  const centrosCC018 = centros.filter((c) => {
    const cod = (c.codigo || '').trim().toUpperCase()
    return cod === codigoAlvoNorm || cod.includes(codigoAlvoNorm)
  })

  const centroIdsAlvo = new Set<string>(centrosCC018.map((c) => c.id))
  const centroPrincipal = centrosCC018[0]

  // Mapa de plano_contas para resolução rápida
  const planoContasMap = new Map<string, PlanoContaRecord>()
  for (const p of planoContas) {
    planoContasMap.set(p.id, p)
    if (p.centro && (p.expand?.centro as any)?.codigo?.trim().toUpperCase() === codigoAlvoNorm) {
      centroIdsAlvo.add(p.centro)
    }
  }

  // 2. Determinar a lista de meses a calcular (1 mês ou 12 meses)
  const mesesLista: MesItem[] =
    periodoTipo === 'mes' ? gerarListaMeses(ano, mes, 1) : gerarListaMeses(ano, 1, 12)

  const chavesMesesValidos = new Set(mesesLista.map((m) => m.chave))

  // 3. Executar o motor da DRE Gerencial existente para obter a Receita Bruta (Saídas)
  const matrizDre = calcularDreGerencialMatriz(lancamentos, contas, mesesLista, planoContas)
  const grupoReceitas = matrizDre.grupos.find((g) => g.classificacao === 'Receita')

  // 4. Somar lançamentos de entradas do CC-018 por mês
  const entradasCC018PorMes: Record<string, number> = {}
  for (const m of mesesLista) {
    entradasCC018PorMes[m.chave] = 0
  }

  let totalLancamentosCC018 = 0

  for (const lanc of lancamentos) {
    if (lanc.estornado || !lanc.data) continue
    const mesChave = lanc.data.slice(0, 7)
    if (!chavesMesesValidos.has(mesChave)) continue

    if (lancamentoPertenceAoCentroCusto(lanc, centroIdsAlvo, planoContasMap, codigoAlvoNorm)) {
      const val = Number(lanc.valor) || 0
      entradasCC018PorMes[mesChave] = (entradasCC018PorMes[mesChave] || 0) + val
      totalLancamentosCC018++
    }
  }

  // 5. Construir o detalhamento mês a mês
  const mesesDetalhamento: ReformaTributariaMesItem[] = mesesLista.map((m) => {
    const recMes = grupoReceitas?.valoresPorMes[m.chave] || 0
    const entMes = entradasCC018PorMes[m.chave] || 0

    const debCbs = Number((recMes * CBS_RATE).toFixed(2))
    const credCbs = Number((entMes * CBS_RATE).toFixed(2))
    const saldoCbs = Number((debCbs - credCbs).toFixed(2))

    const debIbs = Number((recMes * IBS_RATE).toFixed(2))
    const credIbs = Number((entMes * IBS_RATE).toFixed(2))
    const saldoIbs = Number((debIbs - credIbs).toFixed(2))

    const totalDeb = Number((debCbs + debIbs).toFixed(2))
    const totalCred = Number((credCbs + credIbs).toFixed(2))
    const saldoLiq = Number((totalDeb - totalCred).toFixed(2))
    const cargaEf = calcularCargaEfetiva(saldoLiq, recMes)

    return {
      mesChave: m.chave,
      rotuloCurto: m.rotuloCurto,
      rotuloCompleto: m.rotuloCompleto,
      ano: m.ano,
      mes: m.mes,
      receitaSaidas: recMes,
      entradasCC018: entMes,
      cbs: { debito: debCbs, credito: credCbs, saldo: saldoCbs },
      ibs: { debito: debIbs, credito: credIbs, saldo: saldoIbs },
      totalDebitos: totalDeb,
      totalCreditos: totalCred,
      saldoLiquido: saldoLiq,
      cargaEfetivaPercent: cargaEf,
      tipoSaldo: saldoLiq >= 0 ? 'a_recolher' : 'a_compensar',
    }
  })

  // 6. Totais consolidados do período
  const receitaBrutaTotal = grupoReceitas?.totalPeriodo || 0
  const entradasCC018Total = Object.values(entradasCC018PorMes).reduce((acc, v) => acc + v, 0)

  const cbs = calcularTributoIndividual('CBS', CBS_RATE, receitaBrutaTotal, entradasCC018Total)
  const ibs = calcularTributoIndividual('IBS', IBS_RATE, receitaBrutaTotal, entradasCC018Total)

  const totalDebitos = Number((cbs.debito + ibs.debito).toFixed(2))
  const totalCreditos = Number((cbs.credito + ibs.credito).toFixed(2))
  const saldoLiquido = Number((totalDebitos - totalCreditos).toFixed(2))
  const tipoSaldo: 'a_recolher' | 'a_compensar' = saldoLiquido >= 0 ? 'a_recolher' : 'a_compensar'
  const cargaEfetivaPercent = calcularCargaEfetiva(saldoLiquido, receitaBrutaTotal)

  const descricaoPeriodo =
    periodoTipo === 'mes'
      ? mesesLista[0]?.rotuloCompleto || `Mês ${mes}/${ano}`
      : `Exercício Completo ${ano} (12 Meses)`

  return {
    periodoTipo,
    ano,
    mes: periodoTipo === 'mes' ? mes : undefined,
    descricaoPeriodo,
    receitaBrutaSaidas: receitaBrutaTotal,
    entradasCC018: entradasCC018Total,
    cbs,
    ibs,
    totalDebitos,
    totalCreditos,
    saldoLiquido,
    tipoSaldo,
    cargaEfetivaPercent,
    meses: mesesDetalhamento,
    centroCustoCodigo: codigoCentroEntradas,
    centroCustoEncontrado: centrosCC018.length > 0,
    centroCustoNome: centroPrincipal?.nome,
    totalLancamentosCC018,
  }
}
