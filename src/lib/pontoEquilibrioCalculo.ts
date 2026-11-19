import type { ContaRecord, LancamentoRecord, PlanoContaRecord } from '@/types/finance'
import { calcularDreGerencialMatriz } from '@/lib/dreGerencialCalculo'
import { gerarListaMeses, type MesItem } from '@/lib/dreGerencialTypes'
import { extrairAnosDosLancamentos } from './analiseAnual360'
import type { MargemMesCalculado } from './margemContribuicaoCalculo'

/**
 * Ponto de Equilíbrio (Gerencial):
 *   Margem de Contribuição (MC) = Receita − Despesas Variáveis  (fonte: margemContribuicaoCalculo)
 *   MC %                        = MC / Receita (null quando não há receita)
 *   Despesas Fixas              = grupo 'Despesa Fixa' da matriz oficial da DRE
 *   Ponto de Equilíbrio (PE)    = Despesas Fixas / MC %   (null quando MC % <= 0 — nunca divide por zero)
 *   Resultado                   = Receita − Fixas − Variáveis
 *   Margem de Segurança (%)     = (Receita − PE) / Receita  (null quando sem receita ou PE indefinido)
 *   GAO                         = MC / Resultado (null quando resultado <= 0 — GAO não faz sentido com prejuízo)
 *
 * ÚNICA FONTE DE DADOS: a mesma matriz oficial da DRE Gerencial usada pelas telas
 * irmãs (Margem de Contribuição, Despesas Fixas, Estudo por Grupo de Despesas) —
 * a margem de contribuição NÃO é recalculada de forma divergente: cada mês do PE
 * contém a linha de MC calculada por calcularDreGerencialMatriz com as mesmas
 * regras de estorno, exclusões e plano de contas.
 */

const MAX_ANOS_COMPARADOS = 6

export interface PontoEquilibrioMes {
  chave: string // '2025-01'
  rotuloCurto: string // 'Jan/25'
  mes: number
  receita: number
  despesasVariaveis: number
  despesasFixas: number
  margemValor: number
  /** null = sem receita no mês (exibe "—") */
  margemPercentual: number | null
  /** null = sem receita ou margem % <= 0 (exibe "—" com aviso, nunca PE zero) */
  pontoEquilibrio: number | null
  /** Resultado do mês: receita − fixas − variáveis */
  resultado: number
  /** null = sem receita, sem PE ou PE <= 0 (exibe "—") */
  margemSegurancaPercentual: number | null
  /** null = sem receita (exibe "—") */
  grauAlavancagemOperacional: number | null
  /** Posição do mês em relação ao PE: acima (lucro) / abaixo (prejuízo) */
  posicao: 'acima' | 'abaixo' | 'no-ponto' | 'sem-pe' | 'sem-movimento'
  temMovimento: boolean
}

export interface PontoEquilibrioAno {
  ano: number
  meses: PontoEquilibrioMes[]
  totalReceita: number
  totalDespesasVariaveis: number
  totalDespesasFixas: number
  margemTotal: number
  margemAnualPercentual: number | null
  /** PE consolidado do ano: fixas anuais ÷ margem % anual (null quando indefinido) */
  pontoEquilibrioAnual: number | null
  /** Receita − fixas − variáveis do ano */
  resultadoAnual: number
  /** null quando sem receita, PE indefinido ou PE <= 0 */
  margemSegurancaAnualPercentual: number | null
  /** GAO consolidado: MC anual ÷ resultado anual (null quando resultado <= 0) */
  grauAlavancagemAnual: number | null
  temDados: boolean
  temDespesasFixas: boolean
}

export interface PontoEquilibrioResultado {
  anoAtual: number
  anos: PontoEquilibrioAno[]
  /** Entrada do exercício ativo (atalho para a matriz da tela) */
  anoAtivo: PontoEquilibrioAno | null
  /** Cabeçalho da matriz: jan–dez do exercício ativo */
  mesesAnoAtivo: MesItem[]
  temDados: boolean
  temDespesasFixas: boolean
}

/** Linha da matriz (mês) convertida a partir da margem de contribuição calculada. */
function montarMes(m: MargemMesCalculado, despesasFixas: number): PontoEquilibrioMes {
  const receita = m.receita
  const margemPercentual = m.margemPercentual
  const resultado = receita - despesasFixas - m.despesasVariaveis

  // PE = Despesas Fixas ÷ MC% — somente quando a margem % é positiva (contábil).
  const pontoEquilibrio =
    margemPercentual !== null && margemPercentual > 0 && despesasFixas > 0
      ? despesasFixas / (margemPercentual / 100)
      : null

  let margemSegurancaPercentual: number | null = null
  if (pontoEquilibrio !== null && receita > 0) {
    margemSegurancaPercentual = ((receita - pontoEquilibrio) / receita) * 100
  }

  // GAO = MC ÷ Resultado — só faz sentido quando há lucro (resultado > 0);
  // com prejuízo a alavancagem opera "ao contrário" e é exibida como "—".
  const grauAlavancagemOperacional =
    m.margemValor > 0 && resultado > 0 ? m.margemValor / resultado : null

  const temMovimento = m.temMovimento || despesasFixas !== 0

  let posicao: PontoEquilibrioMes['posicao'] = 'sem-movimento'
  if (temMovimento) {
    if (pontoEquilibrio === null) posicao = 'sem-pe'
    else if (receita > pontoEquilibrio) posicao = 'acima'
    else if (receita < pontoEquilibrio) posicao = 'abaixo'
    else posicao = 'no-ponto'
  }

  return {
    chave: m.chave,
    rotuloCurto: m.rotuloCurto,
    mes: m.mes,
    receita,
    despesasVariaveis: m.despesasVariaveis,
    despesasFixas,
    margemValor: m.margemValor,
    margemPercentual,
    pontoEquilibrio,
    resultado,
    margemSegurancaPercentual,
    grauAlavancagemOperacional,
    posicao,
    temMovimento,
  }
}

/**
 * Calcula o Ponto de Equilíbrio por ano (até 6 anos, mais recente primeiro).
 * Tudo no frontend, a partir dos lançamentos/contas/plano já carregados pelas
 * telas irmãs — nenhuma consulta nova e nenhum hook de backend.
 */
export function calcularPontoEquilibrio(params: {
  lancamentos: LancamentoRecord[]
  contas: ContaRecord[]
  planoContas?: PlanoContaRecord[]
  anoAtual: number
}): PontoEquilibrioResultado {
  const { lancamentos, contas, planoContas, anoAtual } = params

  const anosJanela = new Set<number>(extrairAnosDosLancamentos(lancamentos))
  anosJanela.add(anoAtual)
  const anosLista = Array.from(anosJanela)
    .sort((a, b) => b - a)
    .slice(0, MAX_ANOS_COMPARADOS)

  const anos: PontoEquilibrioAno[] = anosLista.map((ano) => {
    const mesesAno = gerarListaMeses(ano, 1, 12)
    // Única matriz da DRE — alimenta receita, variáveis e fixas do ano inteiro.
    const matriz = calcularDreGerencialMatriz(lancamentos, contas, mesesAno, planoContas, {
      tipoRelatorio: 'dre',
    })
    const grupoReceita = matriz.grupos.find((g) => g.classificacao === 'Receita')
    const grupoVariavel = matriz.grupos.find((g) => g.classificacao === 'Despesa Variável')
    const grupoFixa = matriz.grupos.find((g) => g.classificacao === 'Despesa Fixa')

    // Margem de contribuição calculada com o MESMO recorte da tela irmã
    // (receita e variáveis vindas da matriz oficial), mês a mês.
    const meses = mesesAno.map((m) => {
      const receita = grupoReceita?.valoresPorMes[m.chave] || 0
      const despesasVariaveis = grupoVariavel?.valoresPorMes[m.chave] || 0
      const despesasFixas = grupoFixa?.valoresPorMes[m.chave] || 0
      const margemValor = receita - despesasVariaveis
      const margemPercentual = receita > 0 ? (margemValor / receita) * 100 : null
      return montarMes(
        {
          chave: m.chave,
          rotuloCurto: m.rotuloCurto,
          mes: m.mes,
          receita,
          despesasVariaveis,
          margemValor,
          margemPercentual,
          temMovimento: receita !== 0 || despesasVariaveis !== 0,
        },
        despesasFixas,
      )
    })

    const totalReceita = grupoReceita?.totalPeriodo || 0
    const totalDespesasVariaveis = grupoVariavel?.totalPeriodo || 0
    const totalDespesasFixas = grupoFixa?.totalPeriodo || 0
    const margemTotal = totalReceita - totalDespesasVariaveis
    const margemAnualPercentual = totalReceita > 0 ? (margemTotal / totalReceita) * 100 : null

    // PE consolidado do ano: fixas anuais ÷ margem % anual
    const pontoEquilibrioAnual =
      margemAnualPercentual !== null && margemAnualPercentual > 0 && totalDespesasFixas > 0
        ? totalDespesasFixas / (margemAnualPercentual / 100)
        : null

    const resultadoAnual = totalReceita - totalDespesasFixas - totalDespesasVariaveis

    const margemSegurancaAnualPercentual =
      pontoEquilibrioAnual !== null && totalReceita > 0
        ? ((totalReceita - pontoEquilibrioAnual) / totalReceita) * 100
        : null

    const grauAlavancagemAnual =
      margemTotal > 0 && resultadoAnual > 0 ? margemTotal / resultadoAnual : null

    const temDados = totalReceita !== 0 || totalDespesasVariaveis !== 0 || totalDespesasFixas !== 0

    return {
      ano,
      meses,
      totalReceita,
      totalDespesasVariaveis,
      totalDespesasFixas,
      margemTotal,
      margemAnualPercentual,
      pontoEquilibrioAnual,
      resultadoAnual,
      margemSegurancaAnualPercentual,
      grauAlavancagemAnual,
      temDados,
      temDespesasFixas: totalDespesasFixas !== 0,
    }
  })

  const mapaPorAno = new Map(anos.map((a) => [a.ano, a]))

  return {
    anoAtual,
    anos,
    anoAtivo: mapaPorAno.get(anoAtual) || null,
    mesesAnoAtivo: gerarListaMeses(anoAtual, 1, 12),
    temDados: anos.some((a) => a.temDados),
    temDespesasFixas: anos.some((a) => a.temDespesasFixas),
  }
}

/**
 * Classifica a margem de segurança (%): verde quando a receita está folgada
 * acima do PE, âmbar na zona de atenção e vermelho quando a receita está
 * muito próxima ou abaixo do ponto de equilíbrio.
 */
export function classificarMargemSeguranca(
  percentual: number | null | undefined,
): 'verde' | 'ambar' | 'vermelho' | 'neutro' {
  if (percentual === null || percentual === undefined || !Number.isFinite(percentual)) {
    return 'neutro'
  }
  if (percentual < 10) return 'vermelho'
  if (percentual < 25) return 'ambar'
  return 'verde'
}

/** Classes CSS do badge da margem de segurança (padrão visual das telas irmãs). */
export function getClassesMargemSeguranca(percentual: number | null | undefined): {
  badge: string
  texto: string
} {
  const status = classificarMargemSeguranca(percentual)
  switch (status) {
    case 'verde':
      return {
        badge: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        texto: 'text-emerald-700',
      }
    case 'ambar':
      return {
        badge: 'bg-amber-50 text-amber-800 border-amber-200',
        texto: 'text-amber-700',
      }
    case 'vermelho':
      return { badge: 'bg-rose-50 text-rose-800 border-rose-200', texto: 'text-rose-700' }
    default:
      return { badge: 'bg-slate-50 text-slate-500 border-slate-200', texto: 'text-slate-400' }
  }
}
