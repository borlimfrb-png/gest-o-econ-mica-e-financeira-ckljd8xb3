import type { ContaRecord, LancamentoRecord, PlanoContaRecord } from '@/types/finance'
import { calcularDreGerencialMatriz } from '@/lib/dreGerencialCalculo'
import type { MesItem } from '@/lib/dreGerencialTypes'
import { calcularPercentualFaturamento } from '@/lib/despesasFixasCalculo'

/** Fallback quando a conta não tem grupo de despesa cadastrado. */
export const GRUPO_DESPESA_FALLBACK = 'Sem grupo'

/** Nome do grupo reservado para contas sem grupo de despesa definido. */
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
  /** Composição do grupo por categoria (fixa vs variável) — para exibição na tela. */
  composicao: { fixas: number; variaveis: number }
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
  /** Totais e % das DESPESAS VARIÁVEIS (novos desde a inclusão das variáveis). */
  totalDespesasVariaveisPorMes: Record<string, number>
  totalDespesasVariaveisPeriodo: number
  percentualTotalVariaveisPorMes: Record<string, number | null>
  percentualTotalVariaveisPeriodo: number | null
}

type ClassificacaoDre = 'Despesa Fixa' | 'Despesa Variável'

/**
 * Agrega as contas de UMA classificação da DRE (Fixa ou Variável) pelo campo
 * `grupo_despesa` da conta (fallback "Sem grupo"), somando no mapa acumulado.
 * Os totais das fixas já entregues continuam intactos: cada classificação é
 * agregada separadamente e o grupo resultante guarda a composição por categoria.
 */
function agregarClassificacaoPorGrupo(
  matrizDre: ReturnType<typeof calcularDreGerencialMatriz>,
  classificacao: ClassificacaoDre,
  mapaGrupos: Map<string, string>,
  meses: MesItem[],
  acumulado: Map<string, GrupoDespesaLinha>,
) {
  const grupoDre = matrizDre.grupos.find((g) => g.classificacao === classificacao)
  const contas = grupoDre?.contas || []

  for (const conta of contas) {
    const nomeGrupo = mapaGrupos.get(conta.id) || GRUPO_DESPESA_FALLBACK
    let linha = acumulado.get(nomeGrupo)
    if (!linha) {
      linha = {
        grupo: nomeGrupo,
        valoresPorMes: {},
        totalPeriodo: 0,
        percentuaisPorMes: {},
        percentualPeriodo: null,
        contas: [],
        composicao: { fixas: 0, variaveis: 0 },
      }
      for (const m of meses) linha.valoresPorMes[m.chave] = 0
      acumulado.set(nomeGrupo, linha)
    }
    linha.totalPeriodo += conta.totalPeriodo
    if (classificacao === 'Despesa Fixa') linha.composicao.fixas += conta.totalPeriodo
    else linha.composicao.variaveis += conta.totalPeriodo
    for (const m of meses) {
      linha.valoresPorMes[m.chave] =
        (linha.valoresPorMes[m.chave] || 0) + (conta.valoresPorMes[m.chave] || 0)
    }
    linha.contas.push({ id: conta.id, nome: conta.nome, codigo: conta.codigo })
  }

  return grupoDre
}

/**
 * Estudo por Grupo de Despesa: agrega as despesas FIXAS e VARIÁVEIS do período
 * pelo campo `grupo_despesa` da conta (fallback "Sem grupo") e compara cada
 * grupo com o faturamento do período, mês a mês e consolidado.
 *
 * Reutiliza a matriz oficial da DRE Gerencial (mesmas regras de estorno,
 * flags de exclusão e plano de contas das telas de Despesas Fixas e Variáveis).
 * Um único cálculo de matriz alimenta as duas categorias — sem duplicar cálculo.
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

  // Mapa contaId -> grupo de despesa (do cadastro da conta)
  const mapaGrupos = new Map<string, string>()
  for (const c of contas) {
    mapaGrupos.set(c.id, normalizarGrupoDespesa(c.grupo_despesa))
  }

  // Agrega as duas categorias pelo mesmo grupo de despesa
  const mapaGruposResultado = new Map<string, GrupoDespesaLinha>()
  const grupoDespFixa = agregarClassificacaoPorGrupo(
    matrizDre,
    'Despesa Fixa',
    mapaGrupos,
    meses,
    mapaGruposResultado,
  )
  const grupoDespVariavel = agregarClassificacaoPorGrupo(
    matrizDre,
    'Despesa Variável',
    mapaGrupos,
    meses,
    mapaGruposResultado,
  )

  const grupos: GrupoDespesaLinha[] = [...mapaGruposResultado.values()].sort((a, b) =>
    a.grupo.localeCompare(b.grupo, 'pt-BR', { sensitivity: 'base' }),
  )

  // Totais de DESPESAS FIXAS (comportamento já entregue, inalterado)
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

  // Totais de DESPESAS VARIÁVEIS
  const totalDespesasVariaveisPorMes: Record<string, number> = {}
  const percentualTotalVariaveisPorMes: Record<string, number | null> = {}
  for (const m of meses) {
    const totalMes = grupoDespVariavel?.valoresPorMes[m.chave] || 0
    totalDespesasVariaveisPorMes[m.chave] = totalMes
    percentualTotalVariaveisPorMes[m.chave] = calcularPercentualFaturamento(
      totalMes,
      faturamentoPorMes[m.chave] || 0,
    )
  }

  const totalDespesasVariaveisPeriodo = grupoDespVariavel?.totalPeriodo || 0
  const percentualTotalVariaveisPeriodo = calcularPercentualFaturamento(
    totalDespesasVariaveisPeriodo,
    faturamentoTotalPeriodo,
  )

  // Percentuais de cada grupo sobre o faturamento
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
    totalDespesasVariaveisPeriodo > 0 ||
    Object.values(totalDespesasFixasPorMes).some((v) => v > 0) ||
    Object.values(totalDespesasVariaveisPorMes).some((v) => v > 0)

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
    totalDespesasVariaveisPorMes,
    totalDespesasVariaveisPeriodo,
    percentualTotalVariaveisPorMes,
    percentualTotalVariaveisPeriodo,
  }
}
