import type { ClassificacaoDre } from '@/types/finance'

export type { ClassificacaoDre }

export const GRUPOS_DRE_ORDEM: ClassificacaoDre[] = [
  'Receita',
  'Despesa Variável',
  'Despesa Fixa',
  'Despesa Financeira',
  'Receita Financeira',
]

export const TITULOS_GRUPOS_DRE: Record<ClassificacaoDre, string> = {
  Receita: 'Receitas (+)',
  'Despesa Variável': '(–) Despesas Variáveis',
  'Despesa Fixa': '(–) Despesas Fixas',
  'Despesa Financeira': '(–) Despesas Financeiras',
  'Receita Financeira': '(+) Receitas Financeiras',
}

export const SINAL_MULTIPLICADOR_GRUPO: Record<ClassificacaoDre, number> = {
  Receita: 1,
  'Despesa Variável': -1,
  'Despesa Fixa': -1,
  'Despesa Financeira': -1,
  'Receita Financeira': 1,
}

export interface MesItem {
  ano: number
  mes: number // 1 a 12
  chave: string // '2025-01'
  rotuloCurto: string // 'Jan/25'
  rotuloCompleto: string // 'Janeiro 2025'
}

export interface ContaMatrizItem {
  id: string
  nome: string
  codigo?: string
  tipo?: string
  grupo?: string
  classificacao: ClassificacaoDre | 'NaoClassificado'
  valoresPorMes: Record<string, number> // chaveMes -> soma líquida do mês
  totalPeriodo: number
  ordem?: number | null
  centroId?: string
  centroNome?: string
  centroCodigo?: string
  centroSequencia?: number | null
  tipoDespesaId?: string
  tipoDespesaNome?: string
  tipoDespesaCodigo?: string
}

/**
 * Compara dois códigos hierárquicos contábeis de forma numérica por segmento (ex: 1.1, 1.2, 1.10).
 * Retorna número negativo se a < b, positivo se a > b, 0 se equivalentes.
 * Trata segmentos como inteiros quando numéricos ("2" < "10") e string quando alfanuméricos.
 */
export function compararCodigosHierarquicos(codA?: string | null, codB?: string | null): number {
  const limpoA = (codA || '').trim()
  const limpoB = (codB || '').trim()

  // Ambos vazios
  if (!limpoA && !limpoB) return 0
  // Sem código fica por último
  if (!limpoA) return 1
  if (!limpoB) return -1

  // Divide por separadores contábeis comuns (ponto, hífen, barra)
  const partesA = limpoA.split(/[.\-/]+/).filter(Boolean)
  const partesB = limpoB.split(/[.\-/]+/).filter(Boolean)

  const maxLen = Math.max(partesA.length, partesB.length)
  for (let i = 0; i < maxLen; i++) {
    const pA = partesA[i]
    const pB = partesB[i]

    if (pA === undefined) return -1 // mais curto vem antes (ex: 1.1 antes de 1.1.1)
    if (pB === undefined) return 1

    const numA = Number(pA)
    const numB = Number(pB)
    const isNumA = !Number.isNaN(numA) && /^\d+$/.test(pA)
    const isNumB = !Number.isNaN(numB) && /^\d+$/.test(pB)

    if (isNumA && isNumB) {
      if (numA !== numB) {
        return numA - numB
      }
    } else {
      const cmp = pA.localeCompare(pB, 'pt-BR', { numeric: true, sensitivity: 'base' })
      if (cmp !== 0) return cmp
    }
  }

  return 0
}

/**
 * Função de ordenação determinística para itens de contas da DRE:
 * 1. Ordem manual (campo "ordem", definida no drag & drop de /contas), quando
 *    ambas as contas têm ordem definida
 * 2. Código hierárquico contábil (segmentos numéricos)
 * 3. Contas sem código ficam por último
 * 4. Desempate alfabético pelo nome da conta
 */
export function compararContasDre(
  a: { codigo?: string | null; nome: string; ordem?: number | null },
  b: { codigo?: string | null; nome: string; ordem?: number | null },
): number {
  // 0. Ordem manual (drag & drop) quando disponível para as duas contas
  const ordemA = a.ordem != null && !isNaN(Number(a.ordem)) ? Number(a.ordem) : null
  const ordemB = b.ordem != null && !isNaN(Number(b.ordem)) ? Number(b.ordem) : null
  if (ordemA !== null && ordemB !== null && ordemA !== ordemB) return ordemA - ordemB

  const codA = (a.codigo || '').trim()
  const codB = (b.codigo || '').trim()

  if (codA && codB) {
    const cmpCod = compararCodigosHierarquicos(codA, codB)
    if (cmpCod !== 0) return cmpCod
    return a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' })
  }

  // Contas com código vêm antes de contas sem código
  if (codA && !codB) return -1
  if (!codA && codB) return 1

  // Ambas sem código: ordenação por nome
  return a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' })
}

/**
 * Ordenação dos itens na DRE Gerencial:
 * 1º Centro de Custo:
 *    - Contas COM centro vêm antes de contas SEM centro
 *    - Entre centros com sequência definida (numérica crescente: 1, 2, 10...)
 *    - Centros SEM sequência (null/undefined) vêm depois dos sequenciados, em ordem estável por código do centro e nome (localeCompare 'pt-BR')
 *    - Empate de sequência desempata por código do centro e nome
 * 2º Tipo de Despesa (dentro do mesmo centro: preenchido antes de vazio, ordenado pt-BR)
 * 3º Conta Contábil (ordem manual do drag & drop, depois código hierárquico e nome)
 */
export function compararCentroTipoConta(
  a: {
    codigo?: string | null
    nome: string
    ordem?: number | null
    centroNome?: string | null
    centroCodigo?: string | null
    centroSequencia?: number | null
    tipoDespesaNome?: string | null
    tipoDespesaCodigo?: string | null
  },
  b: {
    codigo?: string | null
    nome: string
    ordem?: number | null
    centroNome?: string | null
    centroCodigo?: string | null
    centroSequencia?: number | null
    tipoDespesaNome?: string | null
    tipoDespesaCodigo?: string | null
  },
): number {
  // 1º Centro de Custo
  const temCentroA = Boolean((a.centroNome || a.centroCodigo || '').trim())
  const temCentroB = Boolean((b.centroNome || b.centroCodigo || '').trim())

  if (temCentroA && !temCentroB) return -1
  if (!temCentroA && temCentroB) return 1

  if (temCentroA && temCentroB) {
    const seqA =
      a.centroSequencia != null && !isNaN(Number(a.centroSequencia))
        ? Number(a.centroSequencia)
        : null
    const seqB =
      b.centroSequencia != null && !isNaN(Number(b.centroSequencia))
        ? Number(b.centroSequencia)
        : null

    if (seqA !== null && seqB !== null) {
      if (seqA !== seqB) return seqA - seqB
      // Empate de sequência: desempata por código do centro e nome
      const codA = (a.centroCodigo || '').trim()
      const codB = (b.centroCodigo || '').trim()
      if (codA !== codB) {
        return codA.localeCompare(codB, 'pt-BR', { sensitivity: 'base' })
      }
      const nomeA = (a.centroNome || '').trim()
      const nomeB = (b.centroNome || '').trim()
      const cmpNome = nomeA.localeCompare(nomeB, 'pt-BR', { sensitivity: 'base' })
      if (cmpNome !== 0) return cmpNome
    } else if (seqA !== null && seqB === null) {
      return -1
    } else if (seqA === null && seqB !== null) {
      return 1
    } else {
      // Ambos sem sequência: ordem estável por código do centro e nome
      const codA = (a.centroCodigo || '').trim()
      const codB = (b.centroCodigo || '').trim()
      if (codA && codB && codA !== codB) {
        return codA.localeCompare(codB, 'pt-BR', { sensitivity: 'base' })
      }
      if (codA && !codB) return -1
      if (!codA && codB) return 1

      const nomeA = (a.centroNome || '').trim()
      const nomeB = (b.centroNome || '').trim()
      const cmpNome = nomeA.localeCompare(nomeB, 'pt-BR', { sensitivity: 'base' })
      if (cmpNome !== 0) return cmpNome
    }
  }

  // 2º Tipo de Despesa (dentro do mesmo centro)
  const tipoA = (a.tipoDespesaNome || a.tipoDespesaCodigo || '').trim()
  const tipoB = (b.tipoDespesaNome || b.tipoDespesaCodigo || '').trim()

  if (tipoA && tipoB) {
    const cmpTipo = tipoA.localeCompare(tipoB, 'pt-BR', { sensitivity: 'base' })
    if (cmpTipo !== 0) return cmpTipo
  } else if (tipoA && !tipoB) {
    return -1
  } else if (!tipoA && tipoB) {
    return 1
  }

  // 3º Conta Contábil (ordem manual do drag & drop, depois código hierárquico + nome)
  return compararContasDre(a, b)
}

export interface GrupoMatrizItem {
  classificacao: ClassificacaoDre
  titulo: string
  sinal: number
  valoresPorMes: Record<string, number> // soma absoluta ou com sinal
  totalPeriodo: number
  contas: ContaMatrizItem[]
}

export interface DreMatrizResultado {
  meses: MesItem[]
  grupos: GrupoMatrizItem[]
  naoClassificados: {
    titulo: string
    valoresPorMes: Record<string, number>
    totalPeriodo: number
    contas: ContaMatrizItem[]
  }
  lucroPrejuizo: {
    titulo: string
    valoresPorMes: Record<string, number>
    totalPeriodo: number
  }
  margemLiquidaPorMes: Record<string, number | null>
  margemLiquidaTotal: number | null
  totalReceitasPeriodo: number
}

export interface VariacaoValor {
  valorPeriodo1: number
  valorPeriodo2: number
  diferenca: number // Periodo2 - Periodo1
  percentual: number | null // ((Periodo2 - Periodo1) / |Periodo1|) * 100
  favoravel: boolean // verde quando favorável, vermelho quando desfavorável
}

export interface ContaComparativoItem {
  id: string
  nome: string
  codigo?: string
  tipo?: string
  grupo?: string
  classificacao: ClassificacaoDre | 'NaoClassificado'
  valorPeriodo1: number
  valorPeriodo2: number
  diferenca: number
  percentual: number | null
  favoravel: boolean
  ordem?: number | null
  centroId?: string
  centroNome?: string
  centroCodigo?: string
  centroSequencia?: number | null
  tipoDespesaId?: string
  tipoDespesaNome?: string
  tipoDespesaCodigo?: string
}

export interface GrupoComparativoItem {
  classificacao: ClassificacaoDre
  titulo: string
  sinal: number
  valorPeriodo1: number
  valorPeriodo2: number
  diferenca: number
  percentual: number | null
  favoravel: boolean
  contas: ContaComparativoItem[]
}

export interface DreComparativoResultado {
  periodo1Descricao: string
  periodo2Descricao: string
  matriz1: DreMatrizResultado
  matriz2: DreMatrizResultado
  grupos: GrupoComparativoItem[]
  lucroPrejuizo: {
    titulo: string
    valorPeriodo1: number
    valorPeriodo2: number
    diferenca: number
    percentual: number | null
    favoravel: boolean
  }
  margemLiquida: {
    margemPeriodo1: number | null
    margemPeriodo2: number | null
    diferencaPontos: number | null
    favoravel: boolean
  }
  naoClassificados: {
    titulo: string
    valorPeriodo1: number
    valorPeriodo2: number
    diferenca: number
    percentual: number | null
    favoravel: boolean
    contas: ContaComparativoItem[]
  }
}

const NOMES_MESES_ABREV = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
]

const NOMES_MESES_FULL = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

/**
 * Gera a lista de meses a partir de um mês/ano inicial e quantidade (máximo 12)
 */
export function gerarListaMeses(
  anoInicial: number,
  mesInicial: number,
  qtdMeses: number,
): MesItem[] {
  const qtd = Math.min(Math.max(1, qtdMeses), 12)
  const meses: MesItem[] = []

  let currAno = anoInicial
  let currMes = mesInicial

  for (let i = 0; i < qtd; i++) {
    const chave = `${currAno}-${String(currMes).padStart(2, '0')}`
    const ano2digitos = String(currAno).slice(-2)
    meses.push({
      ano: currAno,
      mes: currMes,
      chave,
      rotuloCurto: `${NOMES_MESES_ABREV[currMes - 1]}/${ano2digitos}`,
      rotuloCompleto: `${NOMES_MESES_FULL[currMes - 1]} de ${currAno}`,
    })

    currMes++
    if (currMes > 12) {
      currMes = 1
      currAno++
    }
  }

  return meses
}
