/**
 * Serviço do Planejamento Econômico.
 *
 * Monta o payload da chamada ao hook JSVM (POST /backend/v1/planejamento-economico/analyze)
 * e alimenta a tela /planejamento/economico.
 *
 * CONTRATO com o hook — nunca renomear só um dos lados:
 *   { sucesso, planejamento, regenerado }
 *
 * NOVO: além dos DREs (3 anos fechados + ano base), envia os 29 INDICADORES
 * por exercício (agregador oficial `agregarIndicadoresPlanejamento`).
 */
import { pb } from '@/lib/pocketbase/client'
import type { BalancoRecord, DreRecord, BscKpiRecord } from '@/types/finance'
import {
  agregarIndicadoresPlanejamento,
  type IndicadoresPlanejamento,
} from '@/lib/indicadoresPlanejamento'
import { bscService } from '@/services/bscService'

export interface PayloadAnalyzePlanejamento {
  empresa_id: string
  empresa_nome: string
  segmento: string | null
  ano_base: number
  dres: Array<Record<string, unknown>>
  indicadores: IndicadoresPlanejamento
}

export interface PlanejamentoEconomicoResposta {
  sucesso: boolean
  planejamento: Record<string, unknown> | null
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

/** Analisa o planejamento econômico via hook JSVM (contrato {sucesso, planejamento, regenerado}). */
export async function analisarPlanejamentoEconomico(params: {
  empresaId: string
  empresaNome: string
  segmento: string | null
  anoBase: number
  dres: DreRecord[]
  balancos: BalancoRecord[]
  bscKpis?: BscKpiRecord[]
}): Promise<PlanejamentoEconomicoResposta> {
  const { empresaId, empresaNome, segmento, anoBase, dres, balancos, bscKpis } = params

  const indicadores = montarIndicadores(dres, balancos, anoBase, bscKpis)

  const payload: PayloadAnalyzePlanejamento = {
    empresa_id: empresaId,
    empresa_nome: empresaNome,
    segmento,
    ano_base: anoBase,
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
    indicadores,
  }

  const resposta = await pb.send('/backend/v1/planejamento-economico/analyze', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
  })
  return resposta as PlanejamentoEconomicoResposta
}

export { COLECAO }
