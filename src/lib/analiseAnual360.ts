import { gerarListaMeses } from '@/lib/dreGerencialTypes'
import {
  calcularAnaliseDespesasFixas,
  type DespesasFixasAnaliseResultado,
} from '@/lib/despesasFixasCalculo'
import {
  calcularAnaliseDespesasVariaveis,
  type DespesasVariaveisAnaliseResultado,
} from '@/lib/despesasVariaveisCalculo'
import {
  calcularAnaliseRentabilidade,
  type AnaliseRentabilidadeResultado,
} from '@/lib/analiseRentabilidadeCalculo'
import type { ContaRecord, LancamentoRecord, PlanoContaRecord } from '@/types/finance'
import type { MesItem } from '@/lib/dreGerencialTypes'

export type TipoTelaAnalise = 'fixas' | 'variaveis' | 'rentabilidade'

export interface TotaisPorMes {
  valoresPorMes: Record<string, number>
  totalPeriodo: number
}

export interface RadarResultado {
  temDados: boolean
  eixos: string[]
  atual: { label: string; valores: Record<string, number> } | null
  anterior: { label: string; valores: Record<string, number> } | null
}

export interface AnoAnualComparado {
  ano: number
  total: number
  temDados: boolean
}

export interface ResumoAnual {
  total: number
  mediaMensal: number | null
  maiorMes: { rotulo: string; valor: number } | null
  menorMes: { rotulo: string; valor: number } | null
  /** % de variação vs exercício anterior; null = sem base de comparação */
  variacaoPct: number | null
}

export interface AnoAnteriorInfo {
  ano: number
  temDados: boolean
}

export interface RadarRentabilidade {
  eixos: string[]
  atual: (number | null)[]
  anterior: (number | null)[]
  temDados: boolean
}

export interface AnaliseAnual360Resultado {
  tipo: TipoTelaAnalise
  meses: MesItem[]
  anoAtual: number
  anoAnterior: AnoAnteriorInfo | null
  /** Série principal da tela: despesas (fixas/variáveis) ou lucro apurado (rentabilidade) */
  atual: TotaisPorMes
  anterior: TotaisPorMes
  /** Apenas rentabilidade: faturamento e lucro por mês (barras receita vs resultado) */
  itensRentabilidade: AnaliseRentabilidadeResultado['itensPorMes'] | null
  resumo: ResumoAnual
  radar: RadarResultado
  radarRentabilidade: RadarRentabilidade | null
  anosComparados: AnoAnualComparado[]
}

interface ContaComCentro {
  centroId?: string
  centroNome?: string
  totalPeriodo: number
}

/**
 * Agrega, para uma tela ("fixas" | "variaveis" | "rentabilidade"), tudo que as
 * seções Radar 360 e Análise Anual precisam, reutilizando os motores oficiais
 * já usados pelas telas (DRE Gerencial). Nenhuma consulta nova é feita: recebe
 * apenas os lançamentos/contas/plano já carregados pela tela.
 *
 * - Despesas: eixos do radar = centro de custo, valor = total do exercício;
 *   série anual = total de despesas do mês + total por ano.
 * - Rentabilidade: radar = componentes de margem (%); série anual = margem
 *   mensal (%) + barras receita vs resultado por mês.
 *
 * O comparativo de anos cobre TODOS os exercícios que possuem lançamentos com
 * data (até um limite de MAX_ANOS_COMPARADOS, do mais recente ao mais antigo),
 * garantindo que o ano atual sempre participe da janela.
 */
const MAX_ANOS_COMPARADOS = 6

/** Anos distintos presentes nas datas dos lançamentos (mais recente primeiro). */
export function extrairAnosDosLancamentos(lancamentos: { data?: string }[]): number[] {
  const anos = new Set<number>()
  for (const l of lancamentos) {
    if (l.data) {
      const a = parseInt(l.data.slice(0, 4), 10)
      if (!isNaN(a) && a > 2000 && a < 2100) anos.add(a)
    }
  }
  return Array.from(anos).sort((a, b) => b - a)
}

export function calcularAnaliseAnual360(params: {
  tipo: TipoTelaAnalise
  lancamentos: LancamentoRecord[]
  contas: ContaRecord[]
  planoContas?: PlanoContaRecord[]
  anoAtual: number
  mesInicial: number
  qtdMeses: number
}): AnaliseAnual360Resultado {
  const { tipo, lancamentos, contas, planoContas, anoAtual, mesInicial, qtdMeses } = params

  const meses = gerarListaMeses(anoAtual, mesInicial, qtdMeses)
  const anoAnteriorNum = anoAtual - 1
  const mesesAnterior = gerarListaMeses(anoAnteriorNum, mesInicial, qtdMeses)

  const temMovimento = (t: TotaisPorMes) =>
    t.totalPeriodo !== 0 || Object.values(t.valoresPorMes).some((v) => v !== 0)

  let atual: TotaisPorMes
  let anterior: TotaisPorMes
  let radar: RadarResultado
  let radarRentabilidade: RadarRentabilidade | null = null
  let itensRentabilidade: AnaliseRentabilidadeResultado['itensPorMes'] | null = null
  let resumo: ResumoAnual

  if (tipo === 'fixas') {
    const rAtual: DespesasFixasAnaliseResultado = calcularAnaliseDespesasFixas(
      lancamentos,
      contas,
      meses,
      planoContas,
    )
    const rAnterior = calcularAnaliseDespesasFixas(lancamentos, contas, mesesAnterior, planoContas)
    atual = {
      valoresPorMes: rAtual.totalDespesasFixasPorMes,
      totalPeriodo: rAtual.totalDespesasFixasPeriodo,
    }
    anterior = {
      valoresPorMes: rAnterior.totalDespesasFixasPorMes,
      totalPeriodo: rAnterior.totalDespesasFixasPeriodo,
    }
    radar = montarRadarDespesas(rAtual.contas, rAnterior.contas)
    resumo = montarResumo(atual, meses, anterior)
  } else if (tipo === 'variaveis') {
    const rAtual: DespesasVariaveisAnaliseResultado = calcularAnaliseDespesasVariaveis(
      lancamentos,
      contas,
      meses,
      planoContas,
    )
    const rAnterior = calcularAnaliseDespesasVariaveis(
      lancamentos,
      contas,
      mesesAnterior,
      planoContas,
    )
    atual = {
      valoresPorMes: rAtual.totalDespesasVariaveisPorMes,
      totalPeriodo: rAtual.totalDespesasVariaveisPeriodo,
    }
    anterior = {
      valoresPorMes: rAnterior.totalDespesasVariaveisPorMes,
      totalPeriodo: rAnterior.totalDespesasVariaveisPeriodo,
    }
    radar = montarRadarDespesas(rAtual.contas, rAnterior.contas)
    resumo = montarResumo(atual, meses, anterior)
  } else {
    const rAtual: AnaliseRentabilidadeResultado = calcularAnaliseRentabilidade(
      lancamentos,
      contas,
      meses,
      planoContas,
    )
    const rAnterior = calcularAnaliseRentabilidade(lancamentos, contas, mesesAnterior, planoContas)
    atual = {
      valoresPorMes: Object.fromEntries(rAtual.itensPorMes.map((i) => [i.chave, i.lucroApurado])),
      totalPeriodo: rAtual.lucroTotal,
    }
    anterior = {
      valoresPorMes: Object.fromEntries(
        rAnterior.itensPorMes.map((i) => [i.chave, i.lucroApurado]),
      ),
      totalPeriodo: rAnterior.lucroTotal,
    }
    itensRentabilidade = rAtual.itensPorMes
    radar = { temDados: false, eixos: [], atual: null, anterior: null }
    radarRentabilidade = {
      eixos: ['Margem Bruta', 'Margem Operacional', 'Margem Líquida'],
      atual: [
        rAtual.margemBrutaTotal,
        rAtual.margemOperacionalTotal,
        rAtual.margemSobreFaturamentoTotal,
      ],
      anterior: [
        rAnterior.margemBrutaTotal,
        rAnterior.margemOperacionalTotal,
        rAnterior.margemSobreFaturamentoTotal,
      ],
      temDados: temMovimento(atual) || temMovimento(anterior),
    }
    resumo = montarResumo(atual, meses, anterior)
  }

  // ---------- Comparativo entre anos ----------
  // Janela ampliada: TODOS os anos com lançamentos (mais recente → mais antigo),
  // garantindo o ano atual na janela, limitado a MAX_ANOS_COMPARADOS por
  // performance (cada ano roda o motor oficial da DRE sobre os mesmos arrays).
  const anosJanela = new Set<number>(extrairAnosDosLancamentos(lancamentos))
  anosJanela.add(anoAtual)
  const anosComparados: AnoAnualComparado[] = Array.from(anosJanela)
    .sort((a, b) => b - a)
    .slice(0, MAX_ANOS_COMPARADOS)
    .map((ano) => {
      const mesesAno = gerarListaMeses(ano, mesInicial, qtdMeses)
      let totalAno = 0
      if (tipo === 'fixas') {
        totalAno = calcularAnaliseDespesasFixas(
          lancamentos,
          contas,
          mesesAno,
          planoContas,
        ).totalDespesasFixasPeriodo
      } else if (tipo === 'variaveis') {
        totalAno = calcularAnaliseDespesasVariaveis(
          lancamentos,
          contas,
          mesesAno,
          planoContas,
        ).totalDespesasVariaveisPeriodo
      } else {
        totalAno = calcularAnaliseRentabilidade(
          lancamentos,
          contas,
          mesesAno,
          planoContas,
        ).lucroTotal
      }
      return { ano, total: totalAno, temDados: totalAno !== 0 }
    })

  return {
    tipo,
    meses,
    anoAtual,
    anoAnterior: { ano: anoAnteriorNum, temDados: temMovimento(anterior) },
    atual,
    anterior,
    itensRentabilidade,
    resumo,
    radar,
    radarRentabilidade,
    anosComparados,
  }
}

/** Radar de despesas: eixo = centro de custo, valor = total do exercício. */
function montarRadarDespesas(
  contasAtual: ContaComCentro[],
  contasAnterior: ContaComCentro[],
): RadarResultado {
  const nomeCentro = (c: ContaComCentro) =>
    c.centroNome?.trim() || (c.centroId ? `Centro ${c.centroId}` : 'Sem Centro de Custo')

  const agregar = (contas: ContaComCentro[]): Map<string, { nome: string; total: number }> => {
    const mapa = new Map<string, { nome: string; total: number }>()
    for (const c of contas) {
      const k = nomeCentro(c)
      const atualItem = mapa.get(k) || { nome: k, total: 0 }
      atualItem.total += c.totalPeriodo
      mapa.set(k, atualItem)
    }
    return mapa
  }

  const mapaAtual = agregar(contasAtual)
  const mapaAnterior = agregar(contasAnterior)
  const nomes = Array.from(new Set([...mapaAtual.keys(), ...mapaAnterior.keys()])).slice(0, 12)

  const valoresAtual: Record<string, number> = {}
  const valoresAnterior: Record<string, number> = {}
  for (const nome of nomes) {
    valoresAtual[nome] = mapaAtual.get(nome)?.total || 0
    valoresAnterior[nome] = mapaAnterior.get(nome)?.total || 0
  }

  const temDados =
    Object.values(valoresAtual).some((v) => v !== 0) ||
    Object.values(valoresAnterior).some((v) => v !== 0)

  return {
    temDados,
    eixos: nomes,
    atual: { label: 'Exercício Atual', valores: valoresAtual },
    anterior: { label: 'Exercício Anterior', valores: valoresAnterior },
  }
}

function montarResumo(
  tot: TotaisPorMes,
  mesesRef: MesItem[],
  anteriorTot: TotaisPorMes,
): ResumoAnual {
  const total = tot.totalPeriodo
  const mesesComDados = mesesRef.filter((m) => (tot.valoresPorMes[m.chave] || 0) !== 0)
  const mediaMensal = mesesRef.length > 0 && total !== 0 ? total / mesesRef.length : null

  let maiorMes: { rotulo: string; valor: number } | null = null
  let menorMes: { rotulo: string; valor: number } | null = null
  let maiorVal = -Infinity
  let menorVal = Infinity
  for (const m of mesesComDados) {
    const v = tot.valoresPorMes[m.chave] || 0
    if (v > maiorVal) {
      maiorVal = v
      maiorMes = { rotulo: m.rotuloCurto, valor: v }
    }
    if (v < menorVal) {
      menorVal = v
      menorMes = { rotulo: m.rotuloCurto, valor: v }
    }
  }

  const anteriorValor = anteriorTot.totalPeriodo
  const variacaoPct =
    anteriorValor !== 0 && total !== 0
      ? ((total - anteriorValor) / Math.abs(anteriorValor)) * 100
      : null

  return { total, mediaMensal, maiorMes, menorMes, variacaoPct }
}

/** Pontos do gráfico de evolução mensal (área/linha) do exercício atual. */
export function montarSerieMensal360(resultado: AnaliseAnual360Resultado): {
  mes: string
  mesCompleto: string
  valor: number
}[] {
  return resultado.meses.map((m) => ({
    mes: m.rotuloCurto,
    mesCompleto: m.rotuloCompleto,
    valor: resultado.atual.valoresPorMes[m.chave] || 0,
  }))
}

/** Pontos do gráfico de radar comparando atual vs anterior (mesmos eixos). */
export function montarDadosRadar360(resultado: AnaliseAnual360Resultado): {
  eixo: string
  atual: number
  anterior: number | null
}[] {
  if (resultado.tipo === 'rentabilidade') {
    const rr = resultado.radarRentabilidade
    if (!rr || !rr.temDados) return []
    return rr.eixos.map((eixo, i) => ({
      eixo,
      atual: rr.atual[i] ?? 0,
      anterior: rr.anterior[i] ?? null,
    }))
  }
  const radar = resultado.radar
  if (!radar.temDados || !radar.atual) return []
  return radar.eixos.map((eixo) => ({
    eixo,
    atual: radar.atual!.valores[eixo] || 0,
    anterior: radar.anterior ? radar.anterior.valores[eixo] || 0 : null,
  }))
}
