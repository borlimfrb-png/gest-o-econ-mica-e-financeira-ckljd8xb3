import pb from '@/lib/pocketbase/client'
import type { ContaRecord, LancamentoRecord, PlanoContaRecord } from '@/types/finance'

/**
 * Serviço do Planejamento Econômico (menu Planejamento → PLANEJAMENTO ECONÔMICO).
 *
 * Fluxo:
 * 1. Coleta o DRE Gerencial CONTA POR CONTA dos últimos 3 anos + ano atual
 *    (reutiliza contasService/lancamentosService e a classificação da DRE).
 * 2. POST /backend/v1/planejamento-economico/analyze — hook que aciona o agente
 *    nativo 'planejamento-economico' e grava a projeção na coleção
 *    planejamento_economico (isolada por empresa).
 * 3. Reabrir a tela carrega a projeção salva (sem regerar).
 */

export interface ContaHistoricoPlanejamento {
  conta_id: string
  codigo?: string
  nome: string
  grupo?: string
  classificacao: string
  centro_nome?: string
  anos: number[] // [a-3, a-2, a-1] anos fechados
  atual: number // exercício base (acumulado até o último mês com dados)
  meses_com_dados: number
}

export interface ContaProjetadaPlanejamento {
  conta_id: string
  codigo?: string
  nome: string
  grupo?: string
  classificacao: string
  centro_nome?: string
  anos: number[]
  atual: number
  valor_projetado: number
  variacao_pct: number
  confianca: string
  comentario: string
}

export interface PlanejamentoEconomicoAnalise {
  id: string
  empresa: string
  ano_base: number
  ano_projecao: number
  benchmark_rotulo: string
  benchmark_mencionado: string
  parecer_geral: string
  receita_projetada: number
  contas: ContaProjetadaPlanejamento[]
  created: string
}

export interface EmpresaAnosDisponiveis {
  empresa: string
  empresaNome: string
  anosFechados: number[]
  anosAbertos: number[]
}

export interface PlanejamentoEconomicoPayload {
  empresa_id: string
  empresa_nome: string
  ano_base: number
  ano_projecao: number
  meses_com_dados: number
  benchmark_rotulo: string
  benchmark: {
    margem_bruta: number | null
    margem_operacional: number | null
    margem_ebitda: number | null
    margem_liquida: number | null
  }
  contas: ContaHistoricoPlanejamento[]
}

interface AnaliseResponse {
  sucesso: boolean
  planejamento: PlanejamentoEconomicoAnalise
  regenerado: boolean
  error?: string
}

/** Empresa ativa + anos com DRE (fechados e em aberto) — alimenta o seletor. */
export async function carregarEmpresasEAnos(): Promise<EmpresaAnosDisponiveis[]> {
  const lancamentos = await pb
    .collection('lancamentos')
    .getFullList<LancamentoRecord>({ fields: 'empresa,data,estornado', filter: '' })
    .catch(() => [] as LancamentoRecord[])

  const porEmpresa = new Map<string, { fechados: Set<number>; abertos: Set<number> }>()
  const agora = new Date().getFullYear()
  for (const l of lancamentos) {
    if (l.estornado || !l.data) continue
    const ano = Number(l.data.slice(0, 4))
    if (!ano || ano > agora) continue
    if (!porEmpresa.has(l.empresa))
      porEmpresa.set(l.empresa, { fechados: new Set(), abertos: new Set() })
    const entrada = porEmpresa.get(l.empresa)!
    if (Number(l.data.slice(5, 7)) === 12) entrada.fechados.add(ano)
    else entrada.abertos.add(ano)
  }

  const ids = [...porEmpresa.keys()]
  const empresas = await Promise.all(
    ids.map((id) =>
      pb
        .collection('empresas')
        .getOne<{ id: string; nome: string }>(id)
        .catch(() => null),
    ),
  )

  return ids
    .map((id, i) => ({
      empresa: id,
      empresaNome: empresas[i]?.nome || id,
      anosFechados: [...(porEmpresa.get(id)?.fechados ?? [])].sort((a, b) => a - b),
      anosAbertos: [...(porEmpresa.get(id)?.abertos ?? [])].sort((a, b) => a - b),
    }))
    .sort((a, b) => a.empresaNome.localeCompare(b.empresaNome))
}

/**
 * Monta o histórico CONTA POR CONTA dos últimos 3 anos + ano atual,
 * no mesmo formato da DRE Gerencial (classificação por conta, lançamentos
 * estornados ignorados).
 */
export async function montarPayloadPlanejamento(params: {
  empresaId: string
  empresaNome: string
  anoBase: number
  benchmarkRotulo: string
  benchmark: PlanejamentoEconomicoPayload['benchmark']
}): Promise<PlanejamentoEconomicoPayload> {
  const { empresaId, empresaNome, anoBase, benchmarkRotulo, benchmark } = params
  const anosHistoricos = [anoBase - 3, anoBase - 2, anoBase - 1]

  const [contas, lancamentos, planoContas] = await Promise.all([
    pb.collection('contas').getFullList<ContaRecord>({ sort: 'ordem,codigo,nome' }),
    pb.collection('lancamentos').getFullList<LancamentoRecord>({
      filter: `empresa = '${empresaId}'`,
      expand: 'plano_conta.conta',
    }),
    pb.collection('plano_contas').getFullList<PlanoContaRecord>({
      filter: `empresa = '${empresaId}'`,
      expand: 'conta,centro',
    }),
  ])

  type PlanoContaExpand = PlanoContaRecord & {
    expand?: {
      conta?: ContaRecord
      centro?: { nome?: string; id?: string }
    }
  }

  // plano_conta id -> conta (expand ou fallback)
  const planoParaConta = new Map<string, string>()
  for (const p of planoContas) {
    const contaId = p.expand?.conta?.id || p.conta
    if (contaId) planoParaConta.set(p.id, contaId)
  }

  const contasPorId = new Map(contas.map((c) => [c.id, c]))

  // contaId -> ano -> valor acumulado
  const acumulado = new Map<string, Map<number, number>>()
  const mesesComDados = new Map<string, Set<number>>() // contaId -> anos com lançamento no ano atual

  for (const l of lancamentos) {
    if (l.estornado || !l.data) continue
    const contaId = planoParaConta.get(l.plano_conta) || l.expand?.plano_conta?.expand?.conta?.id
    if (!contaId) continue
    const ano = Number(l.data.slice(0, 4))
    const historico = anosHistoricos.includes(ano) || ano === anoBase
    if (!historico) continue
    if (!acumulado.has(contaId)) acumulado.set(contaId, new Map())
    const porAno = acumulado.get(contaId)!
    porAno.set(ano, (porAno.get(ano) || 0) + (Number(l.valor) || 0))
    if (ano === anoBase) {
      if (!mesesComDados.has(contaId)) mesesComDados.set(contaId, new Set())
      mesesComDados.get(contaId)!.add(Number(l.data.slice(5, 7)))
    }
  }

  const contasHistorico: ContaHistoricoPlanejamento[] = []
  for (const [contaId, porAno] of acumulado) {
    const conta = contasPorId.get(contaId)
    const temHistorico = anosHistoricos.some((a) => (porAno.get(a) || 0) !== 0)
    const atual = porAno.get(anoBase) || 0
    if (!conta || (!temHistorico && atual === 0)) continue
    const planoDaConta = (planoContas as PlanoContaExpand[]).find(
      (p) => (p.expand?.conta?.id || p.conta) === contaId,
    )
    contasHistorico.push({
      conta_id: contaId,
      codigo: conta.codigo,
      nome: conta.nome,
      grupo: conta.grupo,
      classificacao: conta.classificacao_dre || 'NaoClassificado',
      centro_nome: planoDaConta?.expand?.centro?.nome,
      anos: anosHistoricos.map((a) => porAno.get(a) || 0),
      atual,
      meses_com_dados: mesesComDados.get(contaId)?.size || 0,
    })
  }

  contasHistorico.sort((a, b) => {
    const ordemClassificacao = [
      'Receita',
      'Despesa Variável',
      'Despesa Fixa',
      'Despesa Financeira',
      'Receita Financeira',
    ]
    const d =
      ordemClassificacao.indexOf(a.classificacao) - ordemClassificacao.indexOf(b.classificacao)
    if (d !== 0) return d
    return a.nome.localeCompare(b.nome)
  })

  return {
    empresa_id: empresaId,
    empresa_nome: empresaNome,
    ano_base: anoBase,
    ano_projecao: anoBase + 1,
    meses_com_dados: 12,
    benchmark_rotulo: benchmarkRotulo,
    benchmark,
    contas: contasHistorico,
  }
}

/**
 * Aciona o agente nativo 'planejamento-economico' (hook /backend/v1/planejamento-economico/analyze).
 * Se já existir projeção salva para empresa/ano base, o hook devolve a salva
 * (regenerado=false) — fechar e reabrir NÃO regera.
 */
export async function analisarPlanejamentoEconomico(
  payload: PlanejamentoEconomicoPayload,
  opcoes?: { forcarRegenerar?: boolean },
): Promise<{ planejamento: PlanejamentoEconomicoAnalise; regenerado: boolean }> {
  const backendUrl = import.meta.env.VITE_POCKETBASE_URL
  const token = pb.authStore.token
  if (!token) throw new Error('Usuário não autenticado no sistema.')

  const response = await fetch(`${backendUrl}/backend/v1/planejamento-economico/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: token },
    body: JSON.stringify({ ...payload, forcar_regenerar: opcoes?.forcarRegenerar ?? false }),
  })

  const data = (await response.json().catch(() => ({}))) as AnaliseResponse
  if (!response.ok || !data.sucesso) {
    throw new Error(data.error || 'Falha ao analisar e projetar o planejamento econômico.')
  }
  return { planejamento: data.planejamento, regenerado: data.regenerado }
}

/** Lista as projeções salvas (para pré-carregar a tela). */
export async function listarPlanejamentosSalvos(
  empresaId: string,
): Promise<PlanejamentoEconomicoAnalise[]> {
  return await pb
    .collection('planejamento_economico')
    .getFullList<PlanejamentoEconomicoAnalise>({
      filter: `empresa = '${empresaId}'`,
      sort: '-ano_base',
    })
    .catch(() => [])
}
