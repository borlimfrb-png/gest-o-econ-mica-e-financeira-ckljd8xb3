import type { ContaRecord, LancamentoRecord, PlanoContaRecord } from '@/types/finance'
import { calcularDreGerencialMatriz } from '@/lib/dreGerencialCalculo'
import type { MesItem } from '@/lib/dreGerencialTypes'
import { calcularPercentualFaturamento } from '@/lib/despesasFixasCalculo'

/** Fallback quando a conta não tem grupo de despesa cadastrado. */
export const GRUPO_DESPESA_FALLBACK = 'Sem grupo'

/** Nome do grupo reservado para despesas fixas sem grupo de despesa definido. */
export function normalizarGrupoDespesa(grupo: string | null | undefined): string {
  const g = (grupo || '').trim()
  return g || GRUPO_DESPESA_FALLBACK
}

export interface GrupoDespesaLinha {
  grupo: string
  valoresPorMes: Record<string, number>
  totalPeriodo: number
  percentuaisPorMes: Record<string, number | null>
  percentualPeriodo: number | null
  contas: { id: string; nome: string; codigo?: string }[]
}

export interface EstudoGrupoDespesasResultado {
  meses: MesItem[]
  grupos: GrupoDespesaLinha[]
  faturamentoPorMes: Record<string, number>
  faturamentoTotalPeriodo: number
  totalDespesasFixasPorMes: Record<string, number>
  totalDespesasFixasPeriodo: number
  percentualTotalPorMes: Record<string, number | null>
  percentualTotalPeriodo: number | null
  temDados: boolean
}

/**
 * Estudo por Grupo de Despesa: agrega as despesas fixas do período pelo campo
 * `grupo_despesa` da conta (fallback "Sem grupo") e compara cada grupo com o
 * faturamento do período, mês a mês e consolidado.
 *
 * Reutiliza a matriz oficial da DRE Gerencial (mesmas regras de estorno,
 * flags de exclusão e plano de contas da tela de Despesas Fixas).
 */
export function calcularEstudoGrupoDespesas(
  lancamentos: LancamentoRecord[],
  contas: ContaRecord[],
  meses: MesItem[],
  planoContas?: PlanoContaRecord[],
): EstudoGrupoDespesasResultado {
  const matrizDre = calcularDreGerencialMatriz(lancamentos, contas, meses, planoContas, {
    tipoRelatorio: 'dre',
  })

  // Faturamento (grupo Receita) por mês
  const grupoReceitas = matrizDre.grupos.find((g) => g.classificacao === 'Receita')
  const faturamentoPorMes: Record<string, number> = {}
  for (const m of meses) {
    faturamentoPorMes[m.chave] = grupoReceitas?.valoresPorMes[m.chave] || 0
  }
  const faturamentoTotalPeriodo = grupoReceitas?.totalPeriodo || 0

  // Grupo Despesa Fixa da DRE
  const grupoDespFixa = matrizDre.grupos.find((g) => g.classificacao === 'Despesa Fixa')
  const contasFixas = grupoDespFixa?.contas || []

  // Mapa contaId -> grupo de despesa (do cadastro da conta)
  const mapaGrupos = new Map<string, string>()
  for (const c of contas) {
    mapaGrupos.set(c.id, normalizarGrupoDespesa(c.grupo_despesa))
  }

  // Agrega por grupo
  const mapaGruposResultado = new Map<string, GrupoDespesaLinha>()
  for (const contaFixa of contasFixas) {
    const nomeGrupo = mapaGrupos.get(contaFixa.id) || GRUPO_DESPESA_FALLBACK
    let linha = mapaGruposResultado.get(nomeGrupo)
    if (!linha) {
      linha = {
        grupo: nomeGrupo,
        valoresPorMes: {},
        totalPeriodo: 0,
        percentuaisPorMes: {},
        percentualPeriodo: null,
        contas: [],
      }
      for (const m of meses) linha.valoresPorMes[m.chave] = 0
      mapaGruposResultado.set(nomeGrupo, linha)
    }
    linha.totalPeriodo += contaFixa.totalPeriodo
    for (const m of meses) {
      linha.valoresPorMes[m.chave] =
        (linha.valoresPorMes[m.chave] || 0) + (contaFixa.valoresPorMes[m.chave] || 0)
    }
    linha.contas.push({ id: contaFixa.id, nome: contaFixa.nome, codigo: contaFixa.codigo })
  }

  const grupos: GrupoDespesaLinha[] = [...mapaGruposResultado.values()].sort((a, b) =>
    a.grupo.localeCompare(b.grupo, 'pt-BR', { sensitivity: 'base' }),
  )

  const totalDespesasFixasPorMes: Record<string, number> = {}
  const percentualTotalPorMes: Record<string, number | null> = {}
  for (const m of meses) {
    const totalMes = grupoDespFixa?.valoresPorMes[m.chave] || 0
    totalDespesasFixasPorMes[m.chave] = totalMes
    percentualTotalPorMes[m.chave] = calcularPercentualFaturamento(
      totalMes,
      faturamentoPorMes[m.chave] || 0,
    )
  }

  const totalDespesasFixasPeriodo = grupoDespFixa?.totalPeriodo || 0
  const percentualTotalPeriodo = calcularPercentualFaturamento(
    totalDespesasFixasPeriodo,
    faturamentoTotalPeriodo,
  )

  for (const linha of grupos) {
    for (const m of meses) {
      linha.percentuaisPorMes[m.chave] = calcularPercentualFaturamento(
        linha.valoresPorMes[m.chave] || 0,
        faturamentoPorMes[m.chave] || 0,
      )
    }
    linha.percentualPeriodo = calcularPercentualFaturamento(
      linha.totalPeriodo,
      faturamentoTotalPeriodo,
    )
  }

  const temDados =
    grupos.length > 0 ||
    totalDespesasFixasPeriodo > 0 ||
    Object.values(totalDespesasFixasPorMes).some((v) => v > 0)

  return {
    meses,
    grupos,
    faturamentoPorMes,
    faturamentoTotalPeriodo,
    totalDespesasFixasPorMes,
    totalDespesasFixasPeriodo,
    percentualTotalPorMes,
    percentualTotalPeriodo,
    temDados,
  }
}
