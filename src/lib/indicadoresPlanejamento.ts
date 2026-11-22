/**
 * Agregador dos 29 INDICADORES para o Planejamento Econômico.
 *
 * REUSA os motores oficiais (nenhuma fórmula duplicada):
 * - catalogoApresentacaoIndicadores.ts — catálogo com 29 indicadores
 *   (liq, cg, end, rent, PE, valuation, BSC, solvência) e extratoras
 *   `extrairValor(ContextoCalculoIndicadores)` usadas pela tela /cliente/indicadores.
 * - indicadoresFinanceirosCalculo.ts — motor oficial `calcularPainelIndicadoresFinanceiros`
 *   (mesmo da Tela Total de Indicadores), que cruza DRE Gerencial + Balanço.
 *
 * Cada ano é calculado com o MESMO contexto da tela de apresentação:
 * - DRE consolidada do exercício (12 meses, convertida em lançamentos sintéticos
 *   — mesma conversão do comparativo anual de registros);
 * - melhor balanço do exercício (mesma regra do comparativo de registros).
 *
 * Anos sem dados rendem valores `null` — nunca zero enganoso.
 */
import type { BalancoRecord, DreRecord, BscKpiRecord } from '@/types/finance'
import {
  CATALOGO_INDICADORES,
  type ContextoCalculoIndicadores,
} from '@/lib/catalogoApresentacaoIndicadores'
import { selecionarMelhorBalancoDoAno } from '@/lib/comparativoIndicadoresAnuais'
import type { PainelIndicadoresFinanceiros } from '@/lib/indicadoresFinanceirosCalculo'

/** Sigla legível curta por categoria — para o prompt do agente. */
const ROTULO_CATEGORIA: Record<string, string> = {
  liquidez: 'Liquidez',
  capital_giro: 'Capital de Giro',
  endividamento: 'Endividamento',
  rentabilidade: 'Rentabilidade',
  ponto_equilibrio: 'Ponto de Equilíbrio',
  valuation: 'Valuation',
  bsc: 'BSC',
  economicos_solvencia: 'Econômicos e Solvência',
}

export interface IndicadorAnoPlanejamento {
  id: string
  sigla: string
  nome: string
  categoria: string
  categoria_rotulo: string
  unidade: string
  valor: number | null
  valor_anterior: number | null
  status: string
  texto_exibicao: string
}

export interface IndicadoresAnoPlanejamento {
  ano: number
  tem_dre: boolean
  tem_balanco: boolean
  indicadores: IndicadorAnoPlanejamento[]
}

export interface IndicadoresPlanejamento {
  indicadores: IndicadoresAnoPlanejamento[]
  total_indicadores: number
  anos_com_dados: number[]
}

/**
 * Calcula os 29 indicadores de UM exercício com o mesmo contexto da tela
 * /cliente/indicadores (DRE consolidada + melhor balanço do ano).
 */
export function calcularIndicadoresDoAno(params: {
  dres: DreRecord[]
  balancos: BalancoRecord[]
  ano: number
  anoAnterior: number
  bscKpis?: BscKpiRecord[]
}): { temDre: boolean; temBalanco: boolean; indicadores: IndicadorAnoPlanejamento[] } {
  const { dres, balancos, ano, anoAnterior, bscKpis } = params

  const dreAtual = dres.find((d) => Number(d.ano) === Number(ano)) || null
  const dreAnterior = dres.find((d) => Number(d.ano) === Number(anoAnterior)) || null
  const balancoAtual = selecionarMelhorBalancoDoAno(balancos, ano)
  const balancoAnterior = selecionarMelhorBalancoDoAno(balancos, anoAnterior)

  const temDre = Boolean(dreAtual)
  const temBalanco = Boolean(balancoAtual)

  const contexto: ContextoCalculoIndicadores = {
    balancoAtual,
    dreAtual,
    balancoAnterior,
    dreAnterior,
    bscKpis,
    anoAtual: ano,
    anoAnterior,
  }

  const indicadores: IndicadorAnoPlanejamento[] = CATALOGO_INDICADORES.map((ind) => {
    let valor: number | null = null
    let valorAnterior: number | null = null
    let status: string = 'indefinido'
    let textoExibicao = 'Não calculado'
    try {
      const r = ind.extrairValor(contexto)
      valor = r.valor
      valorAnterior = r.valorAnterior
      status = r.faixaStatus
      textoExibicao = r.textoExibicao
    } catch {
      valor = null
    }
    return {
      id: ind.id,
      sigla: ind.sigla,
      nome: ind.nome,
      categoria: ind.categoria,
      categoria_rotulo: ROTULO_CATEGORIA[ind.categoria] || ind.categoria,
      unidade: ind.unidade,
      valor,
      valor_anterior: valorAnterior,
      status,
      texto_exibicao: textoExibicao,
    }
  })

  return { temDre, temBalanco, indicadores }
}

/**
 * Agrega os 29 indicadores dos exercícios da janela do Planejamento Econômico
 * (3 anos fechados + ano base). Apenas leitura — os arrays já carregados pela
 * tela/serviço entram por parâmetro.
 */
export function agregarIndicadoresPlanejamento(params: {
  dres: DreRecord[]
  balancos: BalancoRecord[]
  anoBase: number
  bscKpis?: BscKpiRecord[]
}): IndicadoresPlanejamento {
  const { dres, balancos, anoBase, bscKpis } = params
  const anos = [anoBase - 3, anoBase - 2, anoBase - 1, anoBase]

  const porAno: IndicadoresAnoPlanejamento[] = []
  const anosComDados: number[] = []

  for (const ano of anos) {
    const r = calcularIndicadoresDoAno({
      dres,
      balancos,
      ano,
      anoAnterior: ano - 1,
      bscKpis,
    })
    porAno.push({
      ano,
      tem_dre: r.temDre,
      tem_balanco: r.temBalanco,
      indicadores: r.indicadores,
    })
    if (r.temDre || r.temBalanco) anosComDados.push(ano)
  }

  return {
    indicadores: porAno,
    total_indicadores: CATALOGO_INDICADORES.length,
    anos_com_dados: anosComDados,
  }
}

/**
 * Serializa os indicadores agregados para o PROMPT do agente — uma linha por
 * indicador, por ano, com "—" quando não apurado (nunca zero enganoso).
 */
export function indicadoresParaPrompt(ind: IndicadoresPlanejamento): string[] {
  const linhas: string[] = []
  const anos = ind.indicadores.map((a) => a.ano)
  linhas.push(
    `INDICADORES ECONÔMICO-FINANCEIROS (${ind.total_indicadores} métricas; anos: ${anos.join(', ')}; "—" = sem dado apurável):`,
  )
  for (const anoBloco of ind.indicadores) {
    if (!anoBloco.tem_dre && !anoBloco.tem_balanco) {
      linhas.push(`Exercício ${anoBloco.ano}: sem DRE/Balanço apuráveis — ignore este ano.`)
      continue
    }
    const fontes = [anoBloco.tem_dre ? 'DRE' : null, anoBloco.tem_balanco ? 'Balanço' : null]
      .filter(Boolean)
      .join(' + ')
    linhas.push(`Exercício ${anoBloco.ano} (fontes: ${fontes}):`)
    let categoriaAtual = ''
    for (const i of anoBloco.indicadores) {
      if (i.categoria !== categoriaAtual) {
        categoriaAtual = i.categoria
        linhas.push(`  ${i.categoria_rotulo}:`)
      }
      const val = i.valor === null || !Number.isFinite(i.valor) ? '—' : String(i.valor)
      const valAnt =
        i.valor_anterior === null || !Number.isFinite(i.valor_anterior)
          ? '—'
          : String(i.valor_anterior)
      const sufixoUnidade =
        i.unidade === 'percentual'
          ? '%'
          : i.unidade === 'dias'
            ? ' dias'
            : i.unidade === 'multiplo'
              ? 'x'
              : ''
      linhas.push(
        `    - ${i.sigla} (${i.nome}): ${val}${sufixoUnidade} (ano anterior: ${valAnt}${sufixoUnidade}; status: ${i.status})`,
      )
    }
  }
  return linhas
}

/** Exporta os indicadores agregados como linhas tabulares pt-BR (para XLSX/CSV). */
export function indicadoresParaLinhasExport(ind: IndicadoresPlanejamento): string[][] {
  const linhas: string[][] = []
  linhas.push(['INDICADORES ECONÔMICO-FINANCEIROS', '', '', ''])
  const cab = ['Categoria', 'Sigla', 'Indicador', 'Unidade']
  const anos = ind.indicadores.map((a) => a.ano)
  const cabAnos = anos.map((a) => String(a))
  linhas.push([...cab, ...cabAnos])
  // Uma linha por indicador, uma coluna por ano
  const primeiro = ind.indicadores[0]
  if (primeiro) {
    for (const i of primeiro.indicadores) {
      const linha: (string | number)[] = [i.categoria_rotulo, i.sigla, i.nome, i.unidade]
      for (const anoBloco of ind.indicadores) {
        const v = anoBloco.indicadores.find((x) => x.id === i.id)
        linha.push(v && v.valor !== null && Number.isFinite(v.valor) ? v.valor : '—')
      }
      linhas.push(linha.map((c) => String(c)))
    }
  }
  return linhas
}
