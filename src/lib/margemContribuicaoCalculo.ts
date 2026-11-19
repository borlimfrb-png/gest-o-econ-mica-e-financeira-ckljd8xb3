import { calcularDreGerencialMatriz } from './dreGerencialCalculo'
import { gerarListaMeses, type MesItem } from './dreGerencialTypes'
import { extrairAnosDosLancamentos } from './analiseAnual360'
import type { ContaRecord, LancamentoRecord, PlanoContaRecord } from '@/types/finance'

/**
 * Margem de Contribuição (Gerencial):
 *   MC = Receita (grupo 'Receita') − Despesas Variáveis (grupo 'Despesa Variável')
 *   MC % = MC / Receita (null quando não há receita no mês — exibido como "—")
 *
 * Reutiliza a matriz oficial da DRE Gerencial (mesma agregação por mês usada
 * pelo Estudo por Grupo de Despesas), calculando a série mês a mês para o
 * exercício ativo e para os anos anteriores presentes na base (janela de até
 * MAX_ANOS_COMPARADOS anos, padrão da análise anual 360).
 */

const MAX_ANOS_COMPARADOS = 6

export interface MargemMesCalculado {
  chave: string // '2025-01'
  rotuloCurto: string // 'Jan/25'
  mes: number
  receita: number
  despesasVariaveis: number
  margemValor: number
  /** null = sem receita no mês (não divide por zero nem exibe zero enganoso) */
  margemPercentual: number | null
  temMovimento: boolean
}

export interface ComparativoAnoItem {
  ano: number
  meses: MargemMesCalculado[]
  totalReceita: number
  totalDespesasVariaveis: number
  margemTotal: number
  /** null = sem receita no ano */
  margemAnualPercentual: number | null
  /** Diferença em pontos percentuais vs ano anterior da janela (null = sem base) */
  variacaoPpAnoAnterior: number | null
  temDados: boolean
}

export interface MargemContribuicaoResultado {
  anoAtual: number
  /** Anos da janela, do mais recente ao mais antigo (anoAtual incluído) */
  anos: ComparativoAnoItem[]
  /** Entrada do exercício ativo (atalho para a tabela matricial) */
  anoAtivo: ComparativoAnoItem | null
  /** Cabeçalho da matriz: jan–dez do exercício ativo */
  mesesAnoAtivo: MesItem[]
  temDados: boolean
}

/**
 * Calcula a margem de contribuição por ano (até 6 anos, mais recente primeiro).
 * Tudo no frontend, a partir dos lançamentos/contas/plano já carregados pelas
 * telas irmãs — nenhuma consulta nova e nenhum hook de backend.
 */
export function calcularMargemContribuicao(params: {
  lancamentos: LancamentoRecord[]
  contas: ContaRecord[]
  planoContas?: PlanoContaRecord[]
  anoAtual: number
}): MargemContribuicaoResultado {
  const { lancamentos, contas, planoContas, anoAtual } = params

  const anosJanela = new Set<number>(extrairAnosDosLancamentos(lancamentos))
  anosJanela.add(anoAtual)
  const anosLista = Array.from(anosJanela)
    .sort((a, b) => b - a)
    .slice(0, MAX_ANOS_COMPARADOS)

  const anos: ComparativoAnoItem[] = anosLista.map((ano) => {
    const mesesAno = gerarListaMeses(ano, 1, 12)
    const matriz = calcularDreGerencialMatriz(lancamentos, contas, mesesAno, planoContas, {
      tipoRelatorio: 'dre',
    })
    const grupoReceita = matriz.grupos.find((g) => g.classificacao === 'Receita')
    const grupoVariavel = matriz.grupos.find((g) => g.classificacao === 'Despesa Variável')

    const meses: MargemMesCalculado[] = mesesAno.map((m) => {
      const receita = grupoReceita?.valoresPorMes[m.chave] || 0
      const despesasVariaveis = grupoVariavel?.valoresPorMes[m.chave] || 0
      const margemValor = receita - despesasVariaveis
      const temMovimento = receita !== 0 || despesasVariaveis !== 0
      return {
        chave: m.chave,
        rotuloCurto: m.rotuloCurto,
        mes: m.mes,
        receita,
        despesasVariaveis,
        margemValor,
        margemPercentual: receita > 0 ? (margemValor / receita) * 100 : null,
        temMovimento,
      }
    })

    const totalReceita = grupoReceita?.totalPeriodo || 0
    const totalDespesasVariaveis = grupoVariavel?.totalPeriodo || 0
    const margemTotal = totalReceita - totalDespesasVariaveis

    return {
      ano,
      meses,
      totalReceita,
      totalDespesasVariaveis,
      margemTotal,
      margemAnualPercentual: totalReceita > 0 ? (margemTotal / totalReceita) * 100 : null,
      variacaoPpAnoAnterior: null,
      temDados: totalReceita !== 0 || totalDespesasVariaveis !== 0,
    }
  })

  // A lista está em ordem desc; o "ano anterior" na tela é o ano-1 do calendário.
  const mapaPorAno = new Map(anos.map((a) => [a.ano, a]))
  for (const item of anos) {
    const anterior = mapaPorAno.get(item.ano - 1)
    if (
      anterior &&
      anterior.margemAnualPercentual !== null &&
      item.margemAnualPercentual !== null
    ) {
      item.variacaoPpAnoAnterior = item.margemAnualPercentual - anterior.margemAnualPercentual
    }
  }

  return {
    anoAtual,
    anos,
    anoAtivo: mapaPorAno.get(anoAtual) || null,
    mesesAnoAtivo: gerarListaMeses(anoAtual, 1, 12),
    temDados: anos.some((a) => a.temDados),
  }
}

/** Classe de cor da variação entre anos: verde melhora, vermelho piora. */
export function classificarVariacaoMargem(
  deltaPp: number | null | undefined,
): 'melhora' | 'piora' | 'neutro' {
  if (deltaPp === null || deltaPp === undefined || !Number.isFinite(deltaPp)) return 'neutro'
  if (deltaPp > 0.05) return 'melhora'
  if (deltaPp < -0.05) return 'piora'
  return 'neutro'
}
