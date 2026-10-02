import pb from '@/lib/pocketbase/client'
import type { DreRecord, EmpresaRecord } from '@/types/finance'
import { dreService } from '@/services/financeService'
import type { MesItem, DreMatrizResultado } from '@/lib/dreGerencialTypes'

export interface MapeamentoCamposDreItem {
  campoDre: keyof Pick<
    DreRecord,
    | 'receita_bruta'
    | 'deducoes_receita'
    | 'custo_mercadorias'
    | 'despesas_operacionais'
    | 'despesas_financeiras'
    | 'outras_receitas_despesas'
    | 'imposto_renda'
  >
  rotuloDre: string
  origemGerencial: string
  valor: number
}

export interface PreviewPeriodoDre {
  ano: number
  mes: number
  chaveMes: string
  mesRotulo: string
  // Valores calculados
  receitaBruta: number
  deducoesReceita: number
  custoMercadorias: number
  despesasOperacionais: number
  despesasFinanceiras: number
  outrasReceitasDespesas: number
  impostoRenda: number
  lucroOuPrejuizo: number
  // Mapeamento visual detalhado para o modal
  mapeamentos: MapeamentoCamposDreItem[]
  // Status pré-existente
  jaExiste: boolean
  dreExistente?: DreRecord | null
}

export interface PreviewImportacaoDreResultado {
  empresaDestino: {
    id: string
    nome: string
    isGrupo?: boolean
    empresasMembros?: EmpresaRecord[]
  }
  periodos: PreviewPeriodoDre[]
  totalPeriodos: number
  periodosExistentes: number
  periodosNovos: number
}

export interface ExecucaoImportacaoPeriodoResultado {
  ano: number
  mes: number
  chaveMes: string
  sucesso: boolean
  acao: 'criado' | 'atualizado'
  erro?: string
  dreGravada?: DreRecord
}

export interface ResumoFinalImportacaoDre {
  empresaNome: string
  totalProcessados: number
  criados: number
  atualizados: number
  falhas: number
  detalhes: ExecucaoImportacaoPeriodoResultado[]
}

/**
 * Constrói o preview da importação a partir dos dados da matriz gerencial para um conjunto de meses.
 */
export async function gerarPreviewImportacaoDre(params: {
  empresaId: string
  empresaNome: string
  isGrupo?: boolean
  empresasMembros?: EmpresaRecord[]
  matriz: DreMatrizResultado
  mesesAlvo?: MesItem[]
}): Promise<PreviewImportacaoDreResultado> {
  const { empresaId, empresaNome, isGrupo, empresasMembros, matriz, mesesAlvo } = params

  const mesesFiltrados = mesesAlvo && mesesAlvo.length > 0 ? mesesAlvo : matriz.meses

  // Busca DREs existentes para verificar idempotência e alertar sobre substituições
  // Se for grupo, pode buscar da empresa principal ou das empresas participantes
  let dresExistentes: DreRecord[] = []
  try {
    if (!empresaId.startsWith('grupo-')) {
      dresExistentes = await dreService.getByEmpresa(empresaId)
    }
  } catch (err) {
    console.warn('Não foi possível verificar DREs existentes previamente:', err)
  }

  const periodos: PreviewPeriodoDre[] = []
  let periodosExistentesCount = 0

  for (const m of mesesFiltrados) {
    const recTotal =
      matriz.grupos.find((g) => g.classificacao === 'Receita')?.valoresPorMes[m.chave] || 0
    const despVar =
      matriz.grupos.find((g) => g.classificacao === 'Despesa Variável')?.valoresPorMes[m.chave] || 0
    const despFix =
      matriz.grupos.find((g) => g.classificacao === 'Despesa Fixa')?.valoresPorMes[m.chave] || 0
    const despFin =
      matriz.grupos.find((g) => g.classificacao === 'Despesa Financeira')?.valoresPorMes[m.chave] ||
      0
    const recFin =
      matriz.grupos.find((g) => g.classificacao === 'Receita Financeira')?.valoresPorMes[m.chave] ||
      0
    const resultado =
      matriz.lucroPrejuizo.valoresPorMes[m.chave] ?? recTotal - despVar - despFix - despFin + recFin

    // Mapeamento equivalente para a tabela `dre`:
    // receita_bruta = Receitas Totais
    // deducoes_receita = 0 (ou deduções se identificadas)
    // custo_mercadorias = Despesas Variáveis (CMV / Custos variáveis operacionais)
    // despesas_operacionais = Despesas Fixas
    // despesas_financeiras = Despesas Financeiras
    // outras_receitas_despesas = Receitas Financeiras (ou outras receitas líquidas)
    // imposto_renda = 0
    //
    // Verificação de conciliação:
    // Receita Líquida = receita_bruta - deducoes_receita = recTotal
    // Lucro Bruto = Receita Líquida - custo_mercadorias = recTotal - despVar
    // Resultado Operacional = Lucro Bruto - despesas_operacionais = recTotal - despVar - despFix
    // LAIR = Resultado Operacional - despesas_financeiras + outras_receitas_despesas = recTotal - despVar - despFix - despFin + recFin
    // Lucro Líquido = LAIR - imposto_renda = resultado final do período!

    const mapeamentos: MapeamentoCamposDreItem[] = [
      {
        campoDre: 'receita_bruta',
        rotuloDre: 'Receita Bruta',
        origemGerencial: '1. Receitas (+)',
        valor: recTotal,
      },
      {
        campoDre: 'deducoes_receita',
        rotuloDre: 'Deduções da Receita',
        origemGerencial: 'Deduções Diretas',
        valor: 0,
      },
      {
        campoDre: 'custo_mercadorias',
        rotuloDre: 'Custos das Mercadorias / Variáveis (CMV)',
        origemGerencial: '2. (–) Despesas Variáveis',
        valor: despVar,
      },
      {
        campoDre: 'despesas_operacionais',
        rotuloDre: 'Despesas Operacionais / Fixas',
        origemGerencial: '3. (–) Despesas Fixas',
        valor: despFix,
      },
      {
        campoDre: 'despesas_financeiras',
        rotuloDre: 'Despesas Financeiras',
        origemGerencial: '4. (–) Despesas Financeiras',
        valor: despFin,
      },
      {
        campoDre: 'outras_receitas_despesas',
        rotuloDre: 'Outras Receitas / Rec. Financeiras',
        origemGerencial: '5. (+) Receitas Financeiras',
        valor: recFin,
      },
      {
        campoDre: 'imposto_renda',
        rotuloDre: 'Imposto de Renda / CSLL',
        origemGerencial: 'Tributos sobre o Lucro',
        valor: 0,
      },
    ]

    const existente = dresExistentes.find((d) => d.ano === m.ano && (d.mes ?? 12) === m.mes)

    const jaExiste = !!existente
    if (jaExiste) {
      periodosExistentesCount++
    }

    periodos.push({
      ano: m.ano,
      mes: m.mes,
      chaveMes: m.chave,
      mesRotulo: m.rotuloCurto || m.chave,
      receitaBruta: recTotal,
      deducoesReceita: 0,
      custoMercadorias: despVar,
      despesasOperacionais: despFix,
      despesasFinanceiras: despFin,
      outrasReceitasDespesas: recFin,
      impostoRenda: 0,
      lucroOuPrejuizo: resultado,
      mapeamentos,
      jaExiste,
      dreExistente: existente || null,
    })
  }

  return {
    empresaDestino: {
      id: empresaId,
      nome: empresaNome,
      isGrupo,
      empresasMembros,
    },
    periodos,
    totalPeriodos: periodos.length,
    periodosExistentes: periodosExistentesCount,
    periodosNovos: periodos.length - periodosExistentesCount,
  }
}

/**
 * Executa a importação idempotente gravando/atualizando os registros na coleção `dre`.
 * Respeita contexto de empresa ou grupo e atualiza sem duplicar.
 */
export async function executarImportacaoDre(params: {
  empresaId: string
  empresaNome: string
  periodosParaGravar: PreviewPeriodoDre[]
}): Promise<ResumoFinalImportacaoDre> {
  const { empresaId, empresaNome, periodosParaGravar } = params
  const detalhes: ExecucaoImportacaoPeriodoResultado[] = []
  let criados = 0
  let atualizados = 0
  let falhas = 0

  for (const item of periodosParaGravar) {
    try {
      // Payload de gravação na coleção `dre`
      const payload: Partial<DreRecord> = {
        ano: item.ano,
        mes: item.mes,
        receita_bruta: item.receitaBruta,
        deducoes_receita: item.deducoesReceita,
        custo_mercadorias: item.custoMercadorias,
        despesas_operacionais: item.despesasOperacionais,
        despesas_financeiras: item.despesasFinanceiras,
        outras_receitas_despesas: item.outrasReceitasDespesas,
        imposto_renda: item.impostoRenda,
        fechado: false,
        fechamento_obs: `Importado do DRE Gerencial em ${new Date().toLocaleString('pt-BR')}`,
      }

      // Idempotência: busca se já existe para a empresa e competência
      const targetMes = item.mes
      const queryFilter = `empresa = '${empresaId}' && ano = ${item.ano} && mes = ${targetMes}`
      const existing = await pb.collection('dre').getList<DreRecord>(1, 1, {
        filter: queryFilter,
      })

      let dreGravada: DreRecord
      let acao: 'criado' | 'atualizado'

      if (existing.items.length > 0) {
        dreGravada = await pb.collection('dre').update<DreRecord>(existing.items[0].id, {
          ...payload,
          mes: targetMes,
        })
        acao = 'atualizado'
        atualizados++
      } else {
        dreGravada = await pb.collection('dre').create<DreRecord>({
          ...payload,
          empresa: empresaId,
          ano: item.ano,
          mes: targetMes,
        } as any)
        acao = 'criado'
        criados++
      }

      detalhes.push({
        ano: item.ano,
        mes: item.mes,
        chaveMes: item.chaveMes,
        sucesso: true,
        acao,
        dreGravada,
      })
    } catch (err: any) {
      console.error(`Erro ao importar DRE para o período ${item.chaveMes}:`, err)
      falhas++
      detalhes.push({
        ano: item.ano,
        mes: item.mes,
        chaveMes: item.chaveMes,
        sucesso: false,
        acao: 'criado',
        erro: err?.message || 'Falha ao gravar no banco de dados',
      })
    }
  }

  // Emite evento para que outras telas ou componentes possam sincronizar instantaneamente
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('dre-sistema-importada', {
        detail: {
          empresaId,
          totalGravados: criados + atualizados,
          periodos: periodosParaGravar.map((p) => p.chaveMes),
        },
      }),
    )
  }

  return {
    empresaNome,
    totalProcessados: periodosParaGravar.length,
    criados,
    atualizados,
    falhas,
    detalhes,
  }
}
