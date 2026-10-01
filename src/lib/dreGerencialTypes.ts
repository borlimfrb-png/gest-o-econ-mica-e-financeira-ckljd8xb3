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
