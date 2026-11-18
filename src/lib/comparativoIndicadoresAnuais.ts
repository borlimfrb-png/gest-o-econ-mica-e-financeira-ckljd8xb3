/**
 * Comparativo de Indicadores Anuais
 *
 * Reutiliza o motor oficial `calcularPainelIndicadoresFinanceiros`
 * (indicadoresFinanceirosCalculo.ts) — os MESMOS indicadores dos cards do
 * Painel de Indicadores — apurado ano a ano dentro de uma janela de até
 * MAX_ANOS_COMPARADOS exercícios (padrão do Radar 360 / Análise Anual).
 *
 * Somente leitura: recebe os dados já carregados pela tela (lançamentos,
 * contas, plano de contas e balanços) e não faz nenhuma consulta nova.
 *
 * Anos sem dados de balanço/DRE rendem `null` (renderizado como "—" na UI),
 * nunca zero enganoso.
 */
import type {
  BalancoRecord,
  ContaRecord,
  LancamentoRecord,
  PlanoContaRecord,
} from '@/types/finance'
import { calcularPainelIndicadoresFinanceiros } from '@/lib/indicadoresFinanceirosCalculo'
import { gerarListaMeses } from '@/lib/dreGerencialTypes'
import { extrairAnosDosLancamentos } from '@/lib/analiseAnual360'

export const MAX_ANOS_INDICADORES = 6

export type SiglaIndicadorAnual =
  | 'LC'
  | 'LS'
  | 'Endividamento'
  | 'ROE'
  | 'ROA'
  | 'Margem Bruta'
  | 'Margem Operacional'
  | 'Margem Líquida'

export interface LinhaIndicadorAnual {
  sigla: SiglaIndicadorAnual
  nome: string
  unidade: 'multiplo' | 'percentual'
  /** valor[ano] — null quando o ano não tem dados apuráveis */
  valores: Record<number, number | null>
}

export interface ComparativoIndicadoresAnuaisResultado {
  anos: number[] // mais recente primeiro
  linhas: LinhaIndicadorAnual[]
  temDados: boolean
}

const SIGLAS: Array<{
  sigla: SiglaIndicadorAnual
  nome: string
  unidade: 'multiplo' | 'percentual'
}> = [
  { sigla: 'LC', nome: 'Liquidez Corrente', unidade: 'multiplo' },
  { sigla: 'LS', nome: 'Liquidez Seca', unidade: 'multiplo' },
  { sigla: 'Endividamento', nome: 'Endividamento Geral', unidade: 'percentual' },
  { sigla: 'ROE', nome: 'Retorno sobre o Patrimônio Líquido', unidade: 'percentual' },
  { sigla: 'ROA', nome: 'Retorno sobre o Ativo', unidade: 'percentual' },
  { sigla: 'Margem Bruta', nome: 'Margem Bruta', unidade: 'percentual' },
  { sigla: 'Margem Operacional', nome: 'Margem Operacional', unidade: 'percentual' },
  { sigla: 'Margem Líquida', nome: 'Margem Líquida', unidade: 'percentual' },
]

const VALOR_INDEFINIDO = Number.NaN

function pegarValor(
  mapaPorSigla: Map<string, number | null>,
  sigla: SiglaIndicadorAnual,
): number | null {
  const v = mapaPorSigla.get(sigla)
  return v === undefined || v === null || !Number.isFinite(v) ? null : v
}

/** Seleciona o balanço mais recente do ano que realmente possui dados. */
export function selecionarMelhorBalancoDoAno(
  balancos: BalancoRecord[],
  ano: number,
): BalancoRecord | null {
  const soma = (b: BalancoRecord): number =>
    (b.ativo_circulante || 0) +
    (b.realizavel_longo_prazo || 0) +
    (b.imobilizado || 0) +
    (b.intangivel || 0) +
    (b.fornecedores || 0) +
    (b.emprestimos_curto_prazo || 0) +
    (b.obrigacoes_trabalhistas || 0) +
    (b.obrigacoes_tributarias || 0) +
    (b.outros_passivo_circulante || 0) +
    (b.emprestimos_longo_prazo || 0) +
    (b.outras_obrigacoes_longo_prazo || 0) +
    (b.capital_social || 0) +
    (b.reservas_lucros || 0) +
    (b.lucros_acumulados || 0)
  const doAno = balancos.filter((b) => Number(b.ano) === Number(ano))
  const comDados = doAno.filter((b) => soma(b) > 0)
  if (comDados.length === 0) return null
  comDados.sort((a, b) => Number(b.mes ?? 12) - Number(a.mes ?? 12))
  return comDados[0]
}

/**
 * Apura o comparativo de indicadores para a janela de anos (até 6, mais
 * recente primeiro, ano atual sempre incluído). Cada ano roda o motor oficial
 * do Painel de Indicadores sobre os MESMOS arrays já carregados pela tela.
 */
export function calcularComparativoIndicadoresAnuais(params: {
  lancamentos: LancamentoRecord[]
  contas: ContaRecord[]
  planoContas?: PlanoContaRecord[]
  balancos: BalancoRecord[]
  anoAtual: number
  mesInicial: number
  qtdMeses: number
}): ComparativoIndicadoresAnuaisResultado {
  const { lancamentos, contas, planoContas, balancos, anoAtual, mesInicial, qtdMeses } = params

  // Janela igual ao Radar 360: todos os anos com lançamentos + o ano atual,
  // mais recente primeiro, limitado a MAX_ANOS_INDICADORES.
  const anosJanela = new Set<number>(extrairAnosDosLancamentos(lancamentos))
  anosJanela.add(anoAtual)
  const anos = Array.from(anosJanela)
    .sort((a, b) => b - a)
    .slice(0, MAX_ANOS_INDICADORES)

  // valores[sigla][ano]
  const acumulado = new Map<SiglaIndicadorAnual, Map<number, number | null>>()
  for (const s of SIGLAS) acumulado.set(s.sigla, new Map())

  for (const ano of anos) {
    const mesesAno = gerarListaMeses(ano, mesInicial, qtdMeses)
    const balancoAno = selecionarMelhorBalancoDoAno(balancos, ano)

    const painel = calcularPainelIndicadoresFinanceiros({
      balanco: balancoAno,
      lancamentos,
      contas,
      meses: mesesAno,
      planoContas,
      ano,
    })

    const porSigla = new Map<string, number | null>()
    for (const ind of painel.indicadores) porSigla.set(ind.sigla, ind.valor)
    // Siglas extras com nomes compostos no motor oficial
    if (!porSigla.has('Endividamento')) {
      const end = painel.indicadores.find((i) => i.id === 'endividamento_geral')
      porSigla.set('Endividamento', end ? end.valor : null)
    }

    for (const s of SIGLAS) {
      acumulado.get(s.sigla)!.set(ano, pegarValor(porSigla, s.sigla as SiglaIndicadorAnual))
    }
  }

  let temDados = false
  const linhas: LinhaIndicadorAnual[] = SIGLAS.map((s) => {
    const valores: Record<number, number | null> = {}
    for (const ano of anos) {
      const v = acumulado.get(s.sigla)!.get(ano) ?? null
      valores[ano] = v
      if (v !== null && !Number.isNaN(v)) temDados = true
    }
    return { sigla: s.sigla, nome: s.nome, unidade: s.unidade, valores }
  })

  return { anos, linhas, temDados }
}

export { VALOR_INDEFINIDO }
