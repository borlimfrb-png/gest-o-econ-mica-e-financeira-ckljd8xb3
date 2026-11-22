/**
 * Serviço do Planejamento Econômico.
 *
 * Monta o payload da chamada ao hook JSVM (POST /backend/v1/planejamento-economico/analyze)
 * e alimenta a tela /planejamento/economico.
 *
 * CONTRATO com o hook — nunca renomear só um dos lados:
 *   { sucesso, planejamento, regenerado }
 *
 * Além dos DREs (3 anos fechados + ano base), envia os 29 INDICADORES
 * por exercício (agregador oficial `agregarIndicadoresPlanejamento`) e o
 * DRE Gerencial CONTA POR CONTA (mesma matriz do motor oficial).
 */
import pb from '@/lib/pocketbase/client'
import type {
  BalancoRecord,
  DreRecord,
  BscKpiRecord,
  ContaRecord,
  LancamentoRecord,
  PlanoContaRecord,
} from '@/types/finance'
import {
  agregarIndicadoresPlanejamento,
  type IndicadoresPlanejamento,
} from '@/lib/indicadoresPlanejamento'
import { calcularDreGerencialMatriz } from '@/lib/dreGerencialCalculo'
import { gerarListaMeses } from '@/lib/dreGerencialTypes'
import { balancosService } from '@/services/financeService'
import { bscService } from '@/services/bscService'

export interface PayloadAnalyzePlanejamento {
  empresa_id: string
  empresa_nome: string
  segmento: string | null
  ano_base: number
  ano_projecao: number
  benchmark_rotulo: string
  benchmark: {
    margem_bruta: number | null
    margem_operacional: number | null
    margem_ebitda: number | null
    margem_liquida: number | null
  }
  dres: Array<Record<string, unknown>>
  contas: ContaEntradaPlanejamento[]
  indicadores: IndicadoresPlanejamento
}

/** Uma conta do DRE Gerencial enviada ao agente (entrada conta por conta). */
export interface ContaEntradaPlanejamento {
  conta_id: string
  codigo: string
  nome: string
  grupo: string
  classificacao: string
  centro_nome: string
  /** Totais dos 3 exercícios fechados anteriores [anoBase-3, anoBase-2, anoBase-1]. */
  anos: number[]
  /** Total do exercício base. */
  atual: number
  /** Quantidade de meses com dados no exercício base. */
  meses_com_dados: number
}

/** Conta normalizada devolvida pelo hook / salva na coleção. */
export interface ContaPlanejamento {
  conta_id: string
  codigo: string
  nome: string
  grupo: string
  classificacao: string
  centro_nome: string
  anos: number[]
  atual: number
  valor_projetado: number
  variacao_pct: number
  confianca: 'alta' | 'media' | 'baixa'
  comentario: string
}

/** Análise devolvida pelo hook / registrada na coleção planejamento_economico. */
export interface PlanejamentoEconomicoAnalise {
  id: string
  empresa: string
  ano_base: number
  ano_projecao: number
  benchmark_rotulo: string
  benchmark_mencionado: string
  parecer_geral: string
  receita_projetada: number
  contas: ContaPlanejamento[]
  projecao_mensal?: unknown
  created?: string
}

export interface EmpresaAnosDisponiveis {
  empresa: string
  empresaNome: string
  anosFechados: number[]
  anosAbertos: number[]
}

export interface PlanejamentoEconomicoResposta {
  sucesso: boolean
  planejamento: PlanejamentoEconomicoAnalise | null
  regenerado: boolean
  erro?: string
}

export interface PlanejamentoRegistro {
  id: string
  empresa: string
  ano_base: number
  conteudo: string
  criado_por?: string
  atualizado_em?: string
  atualizado_por?: string
  projecao_mensal?: unknown
  indicadores?: unknown
  created?: string
  updated?: string
  expand?: Record<string, unknown>
}

export interface CarregarPlanejamentoParams {
  empresaId: string
  anoBase: number
}

const COLECAO = 'planejamento_economico'

/** Anos da janela (3 fechados + base) — mesma regra usada nos indicadores. */
export function anosDaJanela(anoBase: number): number[] {
  return [anoBase - 3, anoBase - 2, anoBase - 1, anoBase]
}

/** Carrega DREs dos anos da janela (a tela já traz os balanços). */
export async function carregarDresJanela(empresaId: string, anoBase: number): Promise<DreRecord[]> {
  const anos = anosDaJanela(anoBase)
  const filtros = anos.map((a) => `ano=${a}`).join(' || ')
  try {
    return await pb.collection('dre').getFullList({
      filter: `empresa="${empresaId}" && (${filtros})`,
      sort: '-ano',
    })
  } catch {
    return []
  }
}

/** Carrega os KPIs de BSC do ano base (contexto dos indicadores do catálogo). */
export async function carregarBscKpis(empresaId: string, anoBase: number): Promise<BscKpiRecord[]> {
  try {
    return await bscService.getByEmpresaEAno(empresaId, anoBase)
  } catch {
    return []
  }
}

/** Monta os 29 indicadores por ano (agregador oficial, reusa catálogo + motor). */
export function montarIndicadores(
  dres: DreRecord[],
  balancos: BalancoRecord[],
  anoBase: number,
  bscKpis: BscKpiRecord[] = [],
): IndicadoresPlanejamento {
  return agregarIndicadoresPlanejamento({ dres, balancos, anoBase, bscKpis })
}

/**
 * Empresas com DRE + anos disponíveis (fechado = 12 meses distintos na DRE,
 * aberto = ano parcial). Ordena anos do mais recente para o mais antigo.
 */
export async function carregarEmpresasEAnos(): Promise<EmpresaAnosDisponiveis[]> {
  const [dres, empresas] = await Promise.all([
    pb.collection('dre').getFullList<DreRecord>({ sort: '-ano,-mes' }),
    pb
      .collection('empresas')
      .getFullList<{ id: string; nome: string }>()
      .catch(() => [] as { id: string; nome: string }[]),
  ])

  const nomes = new Map<string, string>()
  for (const emp of empresas) nomes.set(emp.id, emp.nome)

  const porEmpresa = new Map<string, Map<number, Set<number>>>()
  for (const d of dres) {
    if (!d.empresa) continue
    const ano = Number(d.ano)
    const mes = Number(d.mes)
    if (!ano || ano < 2000 || ano > 2100) continue
    if (!porEmpresa.has(d.empresa)) porEmpresa.set(d.empresa, new Map())
    const porAno = porEmpresa.get(d.empresa)!
    if (!porAno.has(ano)) porAno.set(ano, new Set())
    if (mes >= 1 && mes <= 12) porAno.get(ano)!.add(mes)
  }

  const saida: EmpresaAnosDisponiveis[] = []
  for (const [empresa, porAno] of porEmpresa.entries()) {
    const fechados: number[] = []
    const abertos: number[] = []
    for (const [ano, meses] of porAno.entries()) {
      if (meses.size >= 12) fechados.push(ano)
      else abertos.push(ano)
    }
    fechados.sort((a, b) => b - a)
    abertos.sort((a, b) => b - a)
    if (fechados.length === 0 && abertos.length === 0) continue
    saida.push({
      empresa,
      empresaNome: nomes.get(empresa) || empresa,
      anosFechados: fechados,
      anosAbertos: abertos,
    })
  }
  saida.sort((a, b) => a.empresaNome.localeCompare(b.empresaNome, 'pt-BR'))
  return saida
}

/** Contas + plano de contas da empresa (leitura tolerante a falhas). */
async function carregarContasEPlano(
  empresaId: string,
): Promise<{ contas: ContaRecord[]; planoContas: PlanoContaRecord[] }> {
  const contas = await pb
    .collection('contas')
    .getFullList<ContaRecord>()
    .then((lista) =>
      lista.filter(
        (c) =>
          !(c as unknown as { empresa?: string }).empresa ||
          (c as unknown as { empresa?: string }).empresa === empresaId,
      ),
    )
    .catch(() => [] as ContaRecord[])
  const planoContas = await pb
    .collection('plano_contas')
    .getFullList<PlanoContaRecord>({ filter: `empresa = "${empresaId}"` })
    .catch(() => [] as PlanoContaRecord[])
  return { contas, planoContas }
}

/** Lançamentos da janela (anoBase-3 .. anoBase), com expansões da DRE. */
async function carregarLancamentosJanela(
  empresaId: string,
  anoBase: number,
): Promise<LancamentoRecord[]> {
  const inicio = `${anoBase - 3}-01-01`
  const fim = `${anoBase}-12-31 23:59:59`
  try {
    return await pb.collection('lancamentos').getFullList<LancamentoRecord>({
      filter: `empresa = "${empresaId}" && data >= "${inicio}" && data <= "${fim}"`,
      expand: 'empresa,plano_conta.conta,plano_conta.centro,plano_conta.tipo_despesa',
      sort: '-data',
    })
  } catch {
    return []
  }
}

/** Segmento da empresa (para o benchmark); null quando não localizado. */
async function carregarSegmento(empresaId: string): Promise<string | null> {
  try {
    const rec = await pb.collection('empresas').getOne<{ segmento?: string }>(empresaId)
    return rec?.segmento ?? null
  } catch {
    return null
  }
}

/**
 * Monta o payload completo do analyze: DREs resumo + indicadores + DRE
 * Gerencial CONTA POR CONTA (motor oficial `calcularDreGerencialMatriz`,
 * mesma matriz da tela /dre-gerencial), para os anos da janela.
 */
export async function montarPayloadPlanejamento(params: {
  empresaId: string
  empresaNome: string
  anoBase: number
  benchmarkRotulo: string
  benchmark: PayloadAnalyzePlanejamento['benchmark']
}): Promise<PayloadAnalyzePlanejamento> {
  const { empresaId, empresaNome, anoBase, benchmarkRotulo, benchmark } = params
  const anos = anosDaJanela(anoBase)

  const [dres, balancos, bscKpis, lancamentos, contasEPlano, segmento] = await Promise.all([
    carregarDresJanela(empresaId, anoBase),
    balancosService.getByEmpresa(empresaId).catch(() => [] as BalancoRecord[]),
    carregarBscKpis(empresaId, anoBase),
    carregarLancamentosJanela(empresaId, anoBase),
    carregarContasEPlano(empresaId),
    carregarSegmento(empresaId),
  ])

  const indicadores = montarIndicadores(dres, balancos, anoBase, bscKpis)

  // DRE Gerencial conta por conta: uma matriz por exercício da janela
  const totaisPorAno = new Map<
    number,
    Map<
      string,
      {
        nome: string
        codigo: string
        grupo: string
        classificacao: string
        centroNome: string
        total: number
        mesesComDados: number
      }
    >
  >()

  for (const ano of anos) {
    const meses = gerarListaMeses(ano, 1, 12)
    const matriz = calcularDreGerencialMatriz(
      lancamentos,
      contasEPlano.contas,
      meses,
      contasEPlano.planoContas,
    )
    const mapa = new Map<
      string,
      {
        nome: string
        codigo: string
        grupo: string
        classificacao: string
        centroNome: string
        total: number
        mesesComDados: number
      }
    >()
    for (const grupo of matriz.grupos) {
      for (const conta of grupo.contas) {
        mapa.set(conta.id, {
          nome: conta.nome,
          codigo: conta.codigo || '',
          grupo: conta.grupo || '',
          classificacao: String(conta.classificacao || 'NaoClassificado'),
          centroNome: conta.centroNome || '',
          total: conta.totalPeriodo,
          mesesComDados: Object.values(conta.valoresPorMes).filter((v) => v !== 0).length,
        })
      }
    }
    for (const conta of matriz.naoClassificados.contas) {
      mapa.set(conta.id, {
        nome: conta.nome,
        codigo: conta.codigo || '',
        grupo: conta.grupo || '',
        classificacao: String(conta.classificacao || 'NaoClassificado'),
        centroNome: conta.centroNome || '',
        total: conta.totalPeriodo,
        mesesComDados: Object.values(conta.valoresPorMes).filter((v) => v !== 0).length,
      })
    }
    totaisPorAno.set(ano, mapa)
  }

  // União de todas as contas que apareceram em qualquer ano da janela
  const idsContas = new Set<string>()
  for (const mapa of totaisPorAno.values()) for (const id of mapa.keys()) idsContas.add(id)

  const contas: ContaEntradaPlanejamento[] = []
  for (const contaId of idsContas) {
    const historico = anos.map((a) => totaisPorAno.get(a)?.get(contaId))
    const qualquer = historico.find((h) => h !== undefined)
    if (!qualquer) continue
    const anosFechados = anos.slice(0, 3).map((a) => totaisPorAno.get(a)?.get(contaId)?.total ?? 0)
    const atual = totaisPorAno.get(anoBase)?.get(contaId)?.total ?? 0
    const mesesComDados = totaisPorAno.get(anoBase)?.get(contaId)?.mesesComDados ?? 0
    if (anosFechados.every((v) => v === 0) && atual === 0) continue
    contas.push({
      conta_id: contaId,
      codigo: qualquer.codigo,
      nome: qualquer.nome,
      grupo: qualquer.grupo,
      classificacao: qualquer.classificacao,
      centro_nome: qualquer.centroNome,
      anos: anosFechados,
      atual,
      meses_com_dados: mesesComDados,
    })
  }

  return {
    empresa_id: empresaId,
    empresa_nome: empresaNome,
    segmento,
    ano_base: anoBase,
    ano_projecao: anoBase + 1,
    benchmark_rotulo: benchmarkRotulo,
    benchmark,
    dres: dres.map((d) => ({
      id: d.id,
      ano: d.ano,
      mes: d.mes,
      receita_bruta: d.receita_bruta,
      deducoes_receita: d.deducoes_receita,
      custo_mercadorias: d.custo_mercadorias,
      despesas_operacionais: d.despesas_operacionais,
      despesas_financeiras: d.despesas_financeiras,
      outras_receitas_despesas: d.outras_receitas_despesas,
      imposto_renda: d.imposto_renda,
    })),
    contas,
    indicadores,
  }
}

/** Analisa o planejamento econômico via hook JSVM (contrato {sucesso, planejamento, regenerado}). */
export async function analisarPlanejamentoEconomico(
  payload: PayloadAnalyzePlanejamento,
  opts?: { forcarRegenerar?: boolean },
): Promise<PlanejamentoEconomicoResposta> {
  const resposta = await pb.send<PlanejamentoEconomicoResposta>(
    '/backend/v1/planejamento-economico/analyze',
    {
      method: 'POST',
      body: { ...payload, forcar_regenerar: opts?.forcarRegenerar === true },
    },
  )
  return resposta
}

export { COLECAO }
