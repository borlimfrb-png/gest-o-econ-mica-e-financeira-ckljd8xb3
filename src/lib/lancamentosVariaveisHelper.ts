import type { ContaRecord, LancamentoRecord, PlanoContaRecord } from '@/types/finance'
import { obterClassificacaoDreConta } from './dreClassificacaoHeuristica'

export interface LancamentoVariavelItem {
  lancamento: LancamentoRecord
  contaId: string
  contaNome: string
  contaCodigo?: string
  centroNome?: string
  tipoDespesaNome?: string
  id?: string
  data?: string
  valor?: number
  historico?: string
  empresaId?: string
  mesAno?: string
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
      centroNome:
        lanc.expand?.plano_conta?.expand?.centro?.nome || planoDoMapa?.expand?.centro?.nome,
      tipoDespesaNome:
        lanc.expand?.plano_conta?.expand?.tipo_despesa?.nome ||
        planoDoMapa?.expand?.tipo_despesa?.nome,
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
