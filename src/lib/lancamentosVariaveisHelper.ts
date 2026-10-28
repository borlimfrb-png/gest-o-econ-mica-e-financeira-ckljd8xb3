import type { ContaRecord, LancamentoRecord, PlanoContaRecord } from '@/types/finance'
import { obterClassificacaoDreConta } from './dreClassificacaoHeuristica'

export interface LancamentoVariavelItem {
  lancamento: LancamentoRecord
  contaId: string
  contaNome: string
  contaCodigo?: string
  centroId?: string
  centroNome?: string
  centroCodigo?: string
  tipoDespesaId?: string
  tipoDespesaNome?: string
  id?: string
  data?: string
  valor?: number
  historico?: string
  empresaId?: string
  mesAno?: string
}

export interface SubtotalCentroExport {
  centroNome: string
  quantidade: number
  subtotal: number
}

export interface GrupoCentroCustoVariavel {
  centroId: string
  centroNome: string
  centroCodigo?: string
  quantidade: number
  subtotal: number
  itens: LancamentoVariavelItem[]
}

export interface ContaVariavelResumo {
  contaId: string
  contaNome: string
  contaCodigo?: string
  quantidade: number
  totalOriginal: number
  centrosNomes: string[]
}

/**
 * Filtra os lançamentos do período cuja conta contábil é classificada como
 * "Despesa Variável" na DRE Gerencial.
 *
 * A resolução da conta repete EXATAMENTE a mesma cadeia usada pelo motor oficial
 * `calcularDreGerencialMatriz` (src/lib/dreGerencialCalculo.ts) e a classificação
 * sai de `obterClassificacaoDreConta` (campo classificacao_dre + heurística oficial),
 * garantindo que o que aparece aqui é o mesmo que a DRE soma no grupo de variáveis.
 */
export function filtrarLancamentosDespesaVariavel(
  lancamentos: LancamentoRecord[],
  contas: ContaRecord[],
  planoContas: PlanoContaRecord[] | undefined,
  chavesMeses: Set<string>,
): LancamentoVariavelItem[] {
  const contaMap = new Map<string, ContaRecord>()
  for (const c of contas) contaMap.set(c.id, c)

  const planoContasMap = new Map<string, PlanoContaRecord>()
  if (planoContas) {
    for (const p of planoContas) planoContasMap.set(p.id, p)
  }

  const itens: LancamentoVariavelItem[] = []

  for (const lanc of lancamentos) {
    if (lanc.estornado) continue
    if (!lanc.data) continue

    const mesChave = lanc.data.slice(0, 7)
    if (!chavesMeses.has(mesChave)) continue

    const expandPlanoConta = lanc.expand?.plano_conta
    const planoDoMapa = lanc.plano_conta ? planoContasMap.get(lanc.plano_conta) : undefined

    let contaId: string | null =
      expandPlanoConta?.expand?.conta?.id ||
      expandPlanoConta?.conta ||
      planoDoMapa?.conta ||
      (lanc as any).conta ||
      null

    // Fallback idêntico ao motor: casar plano_contas por id / codigo / codigo_empresa
    if (!contaId && planoContas && planoContas.length > 0) {
      const candidato =
        planoContas.find(
          (p) =>
            p.id === lanc.plano_conta ||
            (lanc.plano_conta && p.codigo && p.codigo.trim() === String(lanc.plano_conta).trim()) ||
            (lanc.plano_conta &&
              p.codigo_empresa &&
              p.codigo_empresa.trim() === String(lanc.plano_conta).trim()),
        ) || undefined
      if (candidato?.conta) contaId = candidato.conta
    }

    if (!contaId) continue

    const conta = contaMap.get(contaId)
    const classificacao = obterClassificacaoDreConta(conta)
    if (classificacao !== 'Despesa Variável') continue

    const centroObj = lanc.expand?.plano_conta?.expand?.centro || planoDoMapa?.expand?.centro
    const centroId = centroObj?.id || expandPlanoConta?.centro || planoDoMapa?.centro || undefined
    const centroNome = centroObj?.nome || (centroId ? `Centro ${centroId}` : undefined)
    const centroCodigo = (centroObj as any)?.codigo || undefined

    const tipoObj =
      lanc.expand?.plano_conta?.expand?.tipo_despesa || planoDoMapa?.expand?.tipo_despesa
    const tipoDespesaId =
      tipoObj?.id || expandPlanoConta?.tipo_despesa || planoDoMapa?.tipo_despesa || undefined
    const tipoDespesaNome = tipoObj?.nome || undefined

    itens.push({
      lancamento: lanc,
      id: lanc.id,
      data: lanc.data || '',
      valor: Math.abs(Number(lanc.valor) || 0),
      historico: lanc.descricao || '',
      empresaId: lanc.empresa || '',
      mesAno: mesChave,
      contaId,
      contaNome: conta?.nome || 'Conta',
      contaCodigo: conta?.codigo,
      centroId,
      centroNome,
      centroCodigo,
      tipoDespesaId,
      tipoDespesaNome,
    })
  }

  // Mais recentes primeiro, desempate pelo id para estabilidade
  itens.sort((a, b) => {
    const cmp = (b.lancamento.data || '').localeCompare(a.lancamento.data || '')
    return cmp !== 0 ? cmp : a.lancamento.id.localeCompare(b.lancamento.id)
  })

  return itens
}

/**
 * Extrai lançamentos de despesas variáveis com filtros convenientes de empresa e chaves de meses.
 */
export function extrairLancamentosDespesasVariaveis(
  lancamentos: LancamentoRecord[],
  contas: ContaRecord[],
  planoContas?: PlanoContaRecord[],
  filtros?: {
    empresaId?: string
    ano?: number
    mesesChaves?: string[]
  },
): LancamentoVariavelItem[] {
  const chavesSet = new Set<string>()
  if (filtros?.mesesChaves && filtros.mesesChaves.length > 0) {
    filtros.mesesChaves.forEach((ch) => chavesSet.add(ch))
  } else if (filtros?.ano) {
    for (let m = 1; m <= 12; m++) {
      chavesSet.add(`${filtros.ano}-${String(m).padStart(2, '0')}`)
    }
  } else {
    lancamentos.forEach((l) => {
      if (l.data) chavesSet.add(l.data.slice(0, 7))
    })
  }

  const base = filtrarLancamentosDespesaVariavel(lancamentos, contas, planoContas, chavesSet)

  if (!filtros?.empresaId) return base
  return base.filter((item) => !item.empresaId || item.empresaId === filtros.empresaId)
}

/**
 * Calcula totais consolidados de uma lista de despesas variáveis.
 */
export function calcularTotaisVariaveis(itens: LancamentoVariavelItem[]): {
  totalValor: number
  quantidade: number
} {
  const totalValor = itens.reduce(
    (acc, curr) => acc + (curr.valor || Math.abs(curr.lancamento.valor) || 0),
    0,
  )
  return {
    totalValor,
    quantidade: itens.length,
  }
}

/**
 * Agrupa os lançamentos de despesas variáveis por Centro de Custo.
 * Cada grupo carrega seu cabeçalho, quantidade de lançamentos, subtotal
 * e a lista dos itens ordenados pelos mais recentes.
 * O grupo "Sem Centro de Custo" fica no fim, e os demais são ordenados alfabeticamente.
 */
export function agruparLancamentosPorCentroCusto(
  itens: LancamentoVariavelItem[],
): GrupoCentroCustoVariavel[] {
  const map = new Map<string, GrupoCentroCustoVariavel>()

  for (const item of itens) {
    const nome = item.centroNome?.trim() || 'Sem Centro de Custo'
    const key = item.centroId || nome

    let grupo = map.get(key)
    if (!grupo) {
      grupo = {
        centroId: item.centroId || key,
        centroNome: nome,
        centroCodigo: item.centroCodigo,
        quantidade: 0,
        subtotal: 0,
        itens: [],
      }
      map.set(key, grupo)
    }

    const val = item.valor || Math.abs(Number(item.lancamento.valor) || 0)
    grupo.quantidade += 1
    grupo.subtotal += val
    grupo.itens.push(item)
  }

  const grupos = Array.from(map.values())

  grupos.sort((a, b) => {
    const aSem = a.centroNome === 'Sem Centro de Custo'
    const bSem = b.centroNome === 'Sem Centro de Custo'
    if (aSem && !bSem) return 1
    if (!aSem && bSem) return -1
    return a.centroNome.localeCompare(b.centroNome, 'pt-BR')
  })

  // Garante ordenação estável dos itens dentro de cada grupo
  for (const g of grupos) {
    g.itens.sort((a, b) => {
      const cmp = (b.data || '').localeCompare(a.data || '')
      return cmp !== 0 ? cmp : (a.id || '').localeCompare(b.id || '')
    })
  }

  return grupos
}

/**
 * Agrupa as contas contábeis que possuem despesas variáveis no período,
 * somando seu total original e acumulando os centros de custo associados.
 */
export function agruparContasVariaveisResumo(
  itens: LancamentoVariavelItem[],
): ContaVariavelResumo[] {
  const map = new Map<string, ContaVariavelResumo>()

  for (const item of itens) {
    let entry = map.get(item.contaId)
    if (!entry) {
      entry = {
        contaId: item.contaId,
        contaNome: item.contaNome,
        contaCodigo: item.contaCodigo,
        quantidade: 0,
        totalOriginal: 0,
        centrosNomes: [],
      }
      map.set(item.contaId, entry)
    }

    const val = item.valor || Math.abs(Number(item.lancamento.valor) || 0)
    entry.quantidade += 1
    entry.totalOriginal += val

    const cNome = item.centroNome?.trim() || 'Sem Centro de Custo'
    if (!entry.centrosNomes.includes(cNome)) {
      entry.centrosNomes.push(cNome)
    }
  }

  const lista = Array.from(map.values())
  lista.sort((a, b) => {
    if (b.totalOriginal !== a.totalOriginal) {
      return b.totalOriginal - a.totalOriginal // maiores despesas primeiro
    }
    return a.contaNome.localeCompare(b.contaNome, 'pt-BR')
  })

  return lista
}

/**
 * Converte um texto de valor em padrão brasileiro ("1.234,56", "R$ 1.234,56", "1234.56")
 * para número. Retorna null quando não é possível interpretar.
 */
export function parseValorBrl(texto: string): number | null {
  const limpo = (texto || '').replace(/R\$/gi, '').replace(/\s/g, '').trim()
  if (!limpo) return null
  // Se há vírgula, ela é o separador decimal brasileiro
  if (limpo.includes(',')) {
    const normalizado = limpo.replace(/\./g, '').replace(',', '.')
    const n = Number(normalizado)
    return Number.isFinite(n) ? n : null
  }
  const n = Number(limpo)
  return Number.isFinite(n) ? n : null
}

/**
 * Formata número como texto de moeda brasileiro sem o prefixo (ex: "1.234,56").
 */
export function formatarValorBrlInput(valor: number | undefined | null): string {
  if (valor === undefined || valor === null || !Number.isFinite(valor)) return ''
  return valor.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}
