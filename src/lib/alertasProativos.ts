import {
  calcularBalanco,
  calcularDre,
  calcularIndicadores,
  calcularKanitz,
  calcularCapitalGiro,
  consolidarBalancoAnual,
  consolidarDreAnual,
  formatNumber,
  formatPercent,
  formatBrlMil,
  type KanitzResultado,
} from './financeCalculations'
import type { BalancoRecord, DreRecord, EmpresaRecord, CapitalGiroCalculado } from '@/types/finance'

export interface AlertaProativoItem {
  id: string
  tipo:
    | 'liquidez_critica'
    | 'kanitz_critico'
    | 'kanitz_penumbra'
    | 'saldo_tesouraria_negativo'
    | 'margem_liquida_negativa'
    | 'endividamento_alto'
  titulo: string
  descricao: string
  indicadorNome: string
  valorAtualStr: string
  valorReferenciaStr: string
  nivel: 'critico' | 'atencao'
  acaoPrompt: string
  corBadge: string
  icone: string
}

export interface AnaliseContextoProativo {
  alertasCriticos: AlertaProativoItem[]
  totalCriticos: number
  totalAtencao: number
  temAlertas: boolean
  balancoConsolidado: BalancoRecord | null
  dreConsolidado: DreRecord | null
  kanitz: KanitzResultado
  fleuriet: CapitalGiroCalculado
  indicadores: ReturnType<typeof calcularIndicadores>
}

/**
 * Avalia os indicadores financeiros de uma empresa/ano e identifica situações críticas para disparo de alertas proativos.
 */
export function analisarAlertasProativos(
  balancosList: BalancoRecord[],
  dresList: DreRecord[],
  ano: number,
  empresa?: EmpresaRecord | null,
): AnaliseContextoProativo {
  const balancoConsolidado = consolidarBalancoAnual(balancosList, ano)
  const dreConsolidado = consolidarDreAnual(dresList, ano)

  const ind = calcularIndicadores(balancoConsolidado, dreConsolidado)
  const kanitz = calcularKanitz(balancoConsolidado, dreConsolidado)
  const fleuriet = calcularCapitalGiro(balancoConsolidado, dreConsolidado)

  const alertas: AlertaProativoItem[] = []
  const nomeEmpresa = empresa?.nome || 'a empresa'

  // 1. Liquidez Corrente < 0.8 (Crítica) ou < 1.0 (Atenção)
  if (ind.liquidezCorrente !== null) {
    if (ind.liquidezCorrente < 0.8) {
      alertas.push({
        id: 'lc-critica',
        tipo: 'liquidez_critica',
        titulo: 'Liquidez Corrente Crítica (< 0,80)',
        descricao: `A Liquidez Corrente está em ${formatNumber(ind.liquidezCorrente, 2)}x, bem abaixo do limite de segurança (0,80x). A empresa não possui ativos de curto prazo suficientes para cobrir as obrigações imediatas.`,
        indicadorNome: 'Liquidez Corrente',
        valorAtualStr: `${formatNumber(ind.liquidezCorrente, 2)}x`,
        valorReferenciaStr: '≥ 1,20x (Mín. 0,80x)',
        nivel: 'critico',
        acaoPrompt: `A Liquidez Corrente de ${nomeEmpresa} em ${ano} está crítica em ${formatNumber(ind.liquidezCorrente, 2)}x (abaixo de 0,80). Faça um diagnóstico urgente da capacidade de pagamento de curto prazo e apresente um plano de emergência de caixa para os próximos 30 dias.`,
        corBadge: 'bg-rose-100 text-rose-800 border-rose-300',
        icone: 'Activity',
      })
    }
  }

  // 2. Kanitz FI < -3 (Insolvência Iminente) ou -3 <= FI < 0 (Penumbra)
  if (kanitz.fi !== null) {
    if (kanitz.fi < -3) {
      alertas.push({
        id: 'kanitz-insolvente',
        tipo: 'kanitz_critico',
        titulo: 'Alerta de Insolvência Iminente (Kanitz FI < -3,00)',
        descricao: `O Fator de Insolvência de Stephen Kanitz atingiu ${formatNumber(kanitz.fi, 2)} (Zona de Perigo/Insolvência). Há risco elevado de descontinuidade operacional.`,
        indicadorNome: 'Kanitz (FI)',
        valorAtualStr: formatNumber(kanitz.fi, 2),
        valorReferenciaStr: '≥ 0,00 (Solvente)',
        nivel: 'critico',
        acaoPrompt: `O Termômetro de Kanitz apontou risco crítico de Insolvência (FI = ${formatNumber(kanitz.fi, 2)} < -3) para ${nomeEmpresa} no exercício ${ano}. Elabore uma análise pericial das variáveis X1 a X5 e defina as ações urgentes de reestruturação de passivo e solvência.`,
        corBadge: 'bg-rose-100 text-rose-800 border-rose-300',
        icone: 'Flame',
      })
    } else if (kanitz.fi < 0) {
      alertas.push({
        id: 'kanitz-penumbra',
        tipo: 'kanitz_penumbra',
        titulo: 'Zona de Penumbra (Kanitz -3,00 ≤ FI < 0,00)',
        descricao: `O Fator de Insolvência está em ${formatNumber(kanitz.fi, 2)} (Zona de Indefinição/Risco Moderado). Sinais de vulnerabilidade financeira exigem medidas preventivas.`,
        indicadorNome: 'Kanitz (FI)',
        valorAtualStr: formatNumber(kanitz.fi, 2),
        valorReferenciaStr: '≥ 0,00 (Solvente)',
        nivel: 'atencao',
        acaoPrompt: `O Termômetro de Kanitz está na Zona de Penumbra (FI = ${formatNumber(kanitz.fi, 2)}) para ${nomeEmpresa} em ${ano}. Diagnostique quais variáveis contábeis estão puxando o índice para baixo e o que fazer para retornar à Zona de Solvência.`,
        corBadge: 'bg-amber-100 text-amber-800 border-amber-300',
        icone: 'Flame',
      })
    }
  }

  // 3. Saldo de Tesouraria Negativo (Fleuriet)
  if (fleuriet.saldoTesouraria !== null && fleuriet.saldoTesouraria < 0) {
    alertas.push({
      id: 'st-negativo',
      tipo: 'saldo_tesouraria_negativo',
      titulo: 'Saldo de Tesouraria Negativo (Risco Efeito Tesoura)',
      descricao: `O Saldo de Tesouraria está deficitário em ${formatBrlMil(fleuriet.saldoTesouraria)}. A Necessidade de Capital de Giro (NCG) está drenando o caixa e exigindo recursos onerosos de curto prazo.`,
      indicadorNome: 'Saldo de Tesouraria (ST)',
      valorAtualStr: formatBrlMil(fleuriet.saldoTesouraria),
      valorReferenciaStr: '> R$ 0,00',
      nivel:
        fleuriet.tipoFleuriet === 'critica' || fleuriet.tipoFleuriet === 'arriscada'
          ? 'critico'
          : 'atencao',
      acaoPrompt: `O Saldo de Tesouraria (ST) de ${nomeEmpresa} está negativo em ${formatBrlMil(fleuriet.saldoTesouraria)} em ${ano} (Classificação Fleuriet: ${fleuriet.tipoFleurietNome}). Analise a dinâmica de CGL vs NCG e recomende medidas para estancar a dependência de empréstimos de curto prazo.`,
      corBadge: 'bg-rose-100 text-rose-800 border-rose-300',
      icone: 'Coins',
    })
  }

  // 4. Margem Líquida Negativa (Prejuízo Operacional)
  if (ind.margemLiquida !== null && ind.margemLiquida < 0) {
    alertas.push({
      id: 'margem-negativa',
      tipo: 'margem_liquida_negativa',
      titulo: 'Margem Líquida Negativa (Operação com Prejuízo)',
      descricao: `A Margem Líquida está negativa em ${formatPercent(ind.margemLiquida, 1)} (Lucro Líquido: ${formatBrlMil(dreConsolidado?.lucro_liquido || 0)}). As receitas não estão cobrindo os custos e despesas totais.`,
      indicadorNome: 'Margem Líquida',
      valorAtualStr: formatPercent(ind.margemLiquida, 1),
      valorReferenciaStr: '≥ 8,0% (Positiva)',
      nivel: 'critico',
      acaoPrompt: `A empresa ${nomeEmpresa} fechou ${ano} com Margem Líquida negativa de ${formatPercent(ind.margemLiquida, 1)} e prejuízo de ${formatBrlMil(dreConsolidado?.lucro_liquido || 0)}. Faça um diagnóstico de custos, despesas fixas e markup para estancar o prejuízo e reverter para lucro.`,
      corBadge: 'bg-rose-100 text-rose-800 border-rose-300',
      icone: 'TrendingUp',
    })
  }

  // 5. Endividamento Geral Muito Alto (> 75%)
  if (ind.endividamentoGeral !== null && ind.endividamentoGeral > 75) {
    alertas.push({
      id: 'endividamento-alto',
      tipo: 'endividamento_alto',
      titulo: 'Endividamento Geral Crítico (> 75%)',
      descricao: `O Endividamento Geral está em ${formatPercent(ind.endividamentoGeral, 1)}, indicando alta dependência de capital de terceiros em relação aos ativos totais da empresa.`,
      indicadorNome: 'Endividamento Geral',
      valorAtualStr: formatPercent(ind.endividamentoGeral, 1),
      valorReferenciaStr: '≤ 60,0%',
      nivel: ind.endividamentoGeral > 85 ? 'critico' : 'atencao',
      acaoPrompt: `O Endividamento Geral de ${nomeEmpresa} está excessivamente elevado em ${formatPercent(ind.endividamentoGeral, 1)} no ano de ${ano}. Analise a composição do passivo (curto vs longo prazo) e apresente um plano de desalavancagem financeira.`,
      corBadge: 'bg-amber-100 text-amber-800 border-amber-300',
      icone: 'Scale',
    })
  }

  const criticos = alertas.filter((a) => a.nivel === 'critico').length
  const atencao = alertas.filter((a) => a.nivel === 'atencao').length

  return {
    alertasCriticos: alertas,
    totalCriticos: criticos,
    totalAtencao: atencao,
    temAlertas: alertas.length > 0,
    balancoConsolidado,
    dreConsolidado,
    kanitz,
    fleuriet,
    indicadores: ind,
  }
}
