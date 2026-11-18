/**
 * Adaptador do Comparativo de Indicadores Anuais para telas que carregam
 * registros consolidados de Balanço e DRE (em vez de lançamentos detalhados).
 *
 * Converte cada DreRecord em lançamentos/contas sintéticas (em memória) e roda
 * o MESMO motor oficial `calcularComparativoIndicadoresAnuais` — nenhuma
 * consulta nova ao banco e nenhuma alteração nas libs existentes.
 *
 * Paridade com o motor gerencial (testada em ebitdaParidadeBiDre.test.ts):
 *   receita_bruta − deducoes_receita → Receita
 *   custo_mercadorias               → Despesa Variável
 *   despesas_operacionais (+ IR)    → Despesa Fixa
 *   despesas_financeiras            → Despesa Financeira
 *   outras_receitas_despesas        → Receita Financeira
 *
 * Anos sem DRE/Balanço continuam rendendo `null` (renderizado como "—" na UI).
 */
import type {
  BalancoRecord,
  ContaRecord,
  DreRecord,
  LancamentoRecord,
  PlanoContaRecord,
} from '@/types/finance'
import type { ClassificacaoDre } from '@/types/finance'
import {
  calcularComparativoIndicadoresAnuais,
  type ComparativoIndicadoresAnuaisResultado,
} from '@/lib/comparativoIndicadoresAnuais'

interface ContaSintetica {
  sufixo: string
  nome: string
  tipo: 'Receita' | 'Despesa'
  classificacao: ClassificacaoDre
}

const CONTAS_SINTETICAS: ContaSintetica[] = [
  { sufixo: 'receita', nome: 'Receita (DRE)', tipo: 'Receita', classificacao: 'Receita' },
  {
    sufixo: 'desp_var',
    nome: 'Custos e Despesas Variáveis (DRE)',
    tipo: 'Despesa',
    classificacao: 'Despesa Variável',
  },
  {
    sufixo: 'desp_fixa',
    nome: 'Despesas Operacionais (DRE)',
    tipo: 'Despesa',
    classificacao: 'Despesa Fixa',
  },
  {
    sufixo: 'desp_fin',
    nome: 'Despesas Financeiras (DRE)',
    tipo: 'Despesa',
    classificacao: 'Despesa Financeira',
  },
  {
    sufixo: 'rec_fin',
    nome: 'Receitas Financeiras (DRE)',
    tipo: 'Receita',
    classificacao: 'Receita Financeira',
  },
]

/** Contas e plano de contas sintéticos — apenas a classificação DRE importa para o motor. */
function montarEstruturasSinteticas(): {
  contas: ContaRecord[]
  planoContas: PlanoContaRecord[]
} {
  const contas: ContaRecord[] = CONTAS_SINTETICAS.map((c) => ({
    id: `__dre_${c.sufixo}__`,
    collectionId: 'sintetico',
    collectionName: 'contas',
    nome: c.nome,
    tipo: c.tipo,
    classificacao_dre: c.classificacao,
    user: 'sistema',
  }))
  const planoContas: PlanoContaRecord[] = contas.map((c) => ({
    id: `__pc_${c.id}__`,
    collectionId: 'sintetico',
    collectionName: 'plano_contas',
    conta: c.id,
    centro: '',
    user: 'sistema',
  }))
  return { contas, planoContas }
}

/** Um lançamento sintético por grupo da DRE de cada registro (zeros são ignorados). */
export function converterDresEmLancamentos(dres: DreRecord[]): LancamentoRecord[] {
  const lancamentos: LancamentoRecord[] = []

  for (const d of dres) {
    const mes = d.mes && d.mes >= 1 && d.mes <= 12 ? Math.floor(d.mes) : 1
    const data = `${d.ano}-${String(mes).padStart(2, '0')}-15`

    const emitir = (sufixo: string, valor: number) => {
      if (!valor) return
      lancamentos.push({
        id: `__sintetico_${d.id}_${sufixo}__`,
        collectionId: d.collectionId,
        collectionName: d.collectionName,
        created: d.created,
        updated: d.updated,
        empresa: d.empresa,
        plano_conta: `__pc___dre_${sufixo}___`,
        data,
        valor,
        user: 'sistema',
      })
    }

    // Receita líquida: receita bruta menos deduções (ambas do grupo Receita)
    emitir('receita', (d.receita_bruta || 0) - (d.deducoes_receita || 0))
    emitir('desp_var', d.custo_mercadorias || 0)
    // Imposto de Renda é despesa real do exercício: entra junto às operacionais
    emitir('desp_fixa', (d.despesas_operacionais || 0) + (d.imposto_renda || 0))
    emitir('desp_fin', d.despesas_financeiras || 0)
    emitir('rec_fin', d.outras_receitas_despesas || 0)
  }

  return lancamentos
}

/**
 * Comparativo de indicadores a partir de registros consolidados de Balanço/DRE.
 * Janela: anos presentes nos registros + ano atual (teto de 6, mais recente
 * primeiro) — mesma regra da lib oficial. Exercício completo (12 meses).
 */
export function calcularComparativoIndicadoresDeRegistros(params: {
  balancos: BalancoRecord[]
  dres: DreRecord[]
  anoAtual: number
}): ComparativoIndicadoresAnuaisResultado {
  const { balancos, dres, anoAtual } = params
  const { contas, planoContas } = montarEstruturasSinteticas()

  return calcularComparativoIndicadoresAnuais({
    lancamentos: converterDresEmLancamentos(dres),
    contas,
    planoContas,
    balancos,
    anoAtual,
    mesInicial: 1,
    qtdMeses: 12,
  })
}
