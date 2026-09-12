/**
 * Catálogo Educativo e Consultivo de Indicadores
 * Contém a lista canônica de todos os indicadores do sistema organizados por categorias,
 * com fórmulas, significado, interpretação por faixas (verde/âmbar/vermelho), dicas práticas
 * e funções para extrair os valores reais das empresas ativas.
 */

import type { BalancoRecord, DreRecord, BscKpiRecord } from '@/types/finance'
import {
  calcularBalanco,
  calcularDre,
  calcularIndicadores,
  calcularCapitalGiro,
  calcularPontoEquilibrio,
  calcularKanitz,
  formatNumber,
  formatPercent,
  formatCurrency,
} from '@/lib/financeCalculations'
import { extrairIndicadoresCompletos } from '@/lib/benchmarks'

export type CategoriaIndicador =
  | 'liquidez'
  | 'capital_giro'
  | 'endividamento'
  | 'rentabilidade'
  | 'ponto_equilibrio'
  | 'valuation'
  | 'bsc'
  | 'economicos_solvencia'

export interface CategoriaConfig {
  id: CategoriaIndicador
  nome: string
  descricao: string
  corBadge: string
  iconeNome: string
}

export const CATEGORIAS_INDICADORES: CategoriaConfig[] = [
  {
    id: 'liquidez',
    nome: '1. Liquidez & Solvência Imediata',
    descricao:
      'Mede a capacidade financeira da empresa de honrar suas dívidas nos diferentes horizontes de tempo.',
    corBadge: 'bg-blue-100 text-blue-800 border-blue-200',
    iconeNome: 'Activity',
  },
  {
    id: 'capital_giro',
    nome: '2. Capital de Giro & Modelo Fleuriet',
    descricao:
      'Avalia a dinâmica operacional, os prazos médios de estocagem/pagamento e o equilíbrio de tesouraria.',
    corBadge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    iconeNome: 'Coins',
  },
  {
    id: 'endividamento',
    nome: '3. Endividamento & Estrutura de Capital',
    descricao:
      'Examina o grau de dependência de capital de terceiros e a imobilização do patrimônio líquido.',
    corBadge: 'bg-purple-100 text-purple-800 border-purple-200',
    iconeNome: 'TrendingDown',
  },
  {
    id: 'rentabilidade',
    nome: '4. Rentabilidade & Retorno sobre Capital',
    descricao:
      'Revela a eficiência da empresa em gerar lucro sobre o faturamento, os ativos e o capital dos acionistas.',
    corBadge: 'bg-amber-100 text-amber-800 border-amber-200',
    iconeNome: 'TrendingUp',
  },
  {
    id: 'ponto_equilibrio',
    nome: '5. Ponto de Equilíbrio & Margens',
    descricao:
      'Identifica o volume mínimo de faturamento para cobrir os custos fixos e a folga de segurança operacional.',
    corBadge: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    iconeNome: 'Scale',
  },
  {
    id: 'valuation',
    nome: '6. Valuation (Avaliação da Empresa)',
    descricao:
      'Metodologias consagradas (FCD e Goodwill) para estimar o valor intrínseco de mercado do negócio.',
    corBadge: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    iconeNome: 'Building2',
  },
  {
    id: 'bsc',
    nome: '7. Balanced Scorecard (BSC)',
    descricao:
      'Painel estratégico equilibrado que integra metas financeiras, clientes, processos internos e aprendizado.',
    corBadge: 'bg-rose-100 text-rose-800 border-rose-200',
    iconeNome: 'Target',
  },
  {
    id: 'economicos_solvencia',
    nome: '8. Indicadores Econômicos & Kanitz',
    descricao:
      'Métricas avançadas de valor econômico agregado (EVA/ROIC) e probabilidade estatística de solvência.',
    corBadge: 'bg-slate-100 text-slate-800 border-slate-200',
    iconeNome: 'Flame',
  },
]

export type StatusFaixa = 'verde' | 'ambar' | 'vermelho' | 'indefinido'

export interface FaixaInterpretacao {
  ideal: string
  atencao: string
  critico: string
  regraTexto: string
}

export interface IndicadorCatalogoItem {
  id: string
  categoria: CategoriaIndicador
  nome: string
  sigla: string
  formulaMatematica: string
  formulaLegivel: string
  oQueMede: string
  comoInterpretar: string
  faixas: FaixaInterpretacao
  dicaPratica: string
  unidade: 'indice' | 'percentual' | 'dias' | 'moeda' | 'multiplo' | 'score'
  // Função extratora do valor real dado o balanço e a DRE atuais e anteriores
  extrairValor: (ctx: ContextoCalculoIndicadores) => {
    valor: number | null
    valorAnterior: number | null
    faixaStatus: StatusFaixa
    textoExibicao: string
    textoComparacao?: string
  }
}

export interface ContextoCalculoIndicadores {
  balancoAtual: BalancoRecord | null
  dreAtual: DreRecord | null
  balancoAnterior: BalancoRecord | null
  dreAnterior: DreRecord | null
  bscKpis?: BscKpiRecord[]
  anoAtual: number
  anoAnterior: number
}

// Helpers internos para classificação
function statusHigherBetter(val: number | null, verdeMin: number, ambarMin: number): StatusFaixa {
  if (val === null || isNaN(val)) return 'indefinido'
  if (val >= verdeMin) return 'verde'
  if (val >= ambarMin) return 'ambar'
  return 'vermelho'
}

function statusLowerBetter(val: number | null, verdeMax: number, ambarMax: number): StatusFaixa {
  if (val === null || isNaN(val)) return 'indefinido'
  if (val <= verdeMax) return 'verde'
  if (val <= ambarMax) return 'ambar'
  return 'vermelho'
}

function formatarValorInd(val: number | null, unidade: IndicadorCatalogoItem['unidade']): string {
  if (val === null || isNaN(val)) return 'Não calculado'
  switch (unidade) {
    case 'percentual':
      return `${formatNumber(val, 1)}%`
    case 'moeda':
      return formatCurrency(val)
    case 'dias':
      return `${Math.round(val)} dias`
    case 'multiplo':
      return `${formatNumber(val, 2)}x`
    case 'score':
      return `${formatNumber(val, 1)} pts`
    case 'indice':
    default:
      return formatNumber(val, 2)
  }
}

function calcularVariacaoTexto(
  atual: number | null,
  anterior: number | null,
  unidade: IndicadorCatalogoItem['unidade'],
  anoAnterior: number,
): string | undefined {
  if (atual === null || anterior === null || isNaN(atual) || isNaN(anterior)) {
    return undefined
  }
  const diff = atual - anterior
  const sinal = diff > 0 ? '+' : ''
  if (unidade === 'percentual') {
    return `${sinal}${formatNumber(diff, 1)} p.p. vs ${anoAnterior}`
  }
  if (unidade === 'dias') {
    return `${sinal}${Math.round(diff)}d vs ${anoAnterior}`
  }
  if (unidade === 'moeda') {
    const pct = anterior !== 0 ? (diff / Math.abs(anterior)) * 100 : 0
    return `${sinal}${formatNumber(pct, 1)}% vs ${anoAnterior}`
  }
  return `${sinal}${formatNumber(diff, 2)} vs ${anoAnterior}`
}

export const CATALOGO_INDICADORES: IndicadorCatalogoItem[] = [
  // ==========================================
  // 1. LIQUIDEZ
  // ==========================================
  {
    id: 'lc',
    categoria: 'liquidez',
    nome: 'Liquidez Corrente',
    sigla: 'LC',
    formulaMatematica: 'LC = AC / PC',
    formulaLegivel: 'Ativo Circulante ÷ Passivo Circulante',
    oQueMede:
      'Mede a capacidade da empresa de honrar seus compromissos financeiros de curto prazo utilizando todos os seus recursos circulantes disponíveis no exercício.',
    comoInterpretar:
      'Valores superiores a 1,0 indicam que a empresa possui mais bens e direitos realizáveis no curto prazo do que dívidas a vencer.',
    faixas: {
      ideal: '≥ 1,20 (Verde: Solvência folgada e margem de segurança)',
      atencao: '1,00 a 1,19 (Âmbar: Equilíbrio justo, requer atenção com prazos)',
      critico: '< 1,00 (Vermelho: Risco de inadimplência, dívidas superam ativos realizáveis)',
      regraTexto: 'Quanto maior que 1, melhor a solvência de curto prazo.',
    },
    dicaPratica:
      'Evite manter a LC abaixo de 1,0. Se estiver baixa, negocie prazos maiores com fornecedores, acelere cobranças ou transforme dívidas de curto prazo em parcelamentos de longo prazo.',
    unidade: 'indice',
    extrairValor: (ctx) => {
      const calcAt = calcularBalanco(ctx.balancoAtual)
      const calcAnt = calcularBalanco(ctx.balancoAnterior)
      const val =
        calcAt.passivoCirculante > 0 ? calcAt.ativoCirculante / calcAt.passivoCirculante : null
      const valAnt =
        calcAnt.passivoCirculante > 0 ? calcAnt.ativoCirculante / calcAnt.passivoCirculante : null
      return {
        valor: val,
        valorAnterior: valAnt,
        faixaStatus: statusHigherBetter(val, 1.2, 1.0),
        textoExibicao: formatarValorInd(val, 'indice'),
        textoComparacao: calcularVariacaoTexto(val, valAnt, 'indice', ctx.anoAnterior),
      }
    },
  },
  {
    id: 'ls',
    categoria: 'liquidez',
    nome: 'Liquidez Seca',
    sigla: 'LS',
    formulaMatematica: 'LS = (AC - Estoques) / PC',
    formulaLegivel: '(Ativo Circulante − Estoques) ÷ Passivo Circulante',
    oQueMede:
      'Mede a solvência imediata desconsiderando os estoques, testando a capacidade da empresa caso não consiga vender mercadorias.',
    comoInterpretar:
      'Elimina a dependência da rotação de produtos. Se for maior que 1, a empresa paga todas as contas de curto prazo apenas com caixa e contas a receber.',
    faixas: {
      ideal: '≥ 1,00 (Verde: Independência total da velocidade de vendas)',
      atencao: '0,80 a 0,99 (Âmbar: Dependência moderada de novas vendas)',
      critico: '< 0,80 (Vermelho: Alta dependência de estoques para pagar credores)',
      regraTexto: 'Mede a segurança contra lentidão de mercado ou obsolescência de produtos.',
    },
    dicaPratica:
      'Se a Liquidez Corrente for boa mas a Seca for crítica, significa que há excesso de capital empacado em estoques que não viram dinheiro rapidamente.',
    unidade: 'indice',
    extrairValor: (ctx) => {
      const calcAt = calcularBalanco(ctx.balancoAtual)
      const estAt = ctx.balancoAtual?.estoques || 0
      const calcAnt = calcularBalanco(ctx.balancoAnterior)
      const estAnt = ctx.balancoAnterior?.estoques || 0

      const val =
        calcAt.passivoCirculante > 0
          ? (calcAt.ativoCirculante - estAt) / calcAt.passivoCirculante
          : null
      const valAnt =
        calcAnt.passivoCirculante > 0
          ? (calcAnt.ativoCirculante - estAnt) / calcAnt.passivoCirculante
          : null
      return {
        valor: val,
        valorAnterior: valAnt,
        faixaStatus: statusHigherBetter(val, 1.0, 0.8),
        textoExibicao: formatarValorInd(val, 'indice'),
        textoComparacao: calcularVariacaoTexto(val, valAnt, 'indice', ctx.anoAnterior),
      }
    },
  },
  {
    id: 'li',
    categoria: 'liquidez',
    nome: 'Liquidez Imediata',
    sigla: 'LI',
    formulaMatematica: 'LI = Disponível / PC',
    formulaLegivel: '(Caixa + Aplicações Financeiras) ÷ Passivo Circulante',
    oQueMede:
      'Verifica qual porcentagem das dívidas de curto prazo a empresa consegue quitar exatamente hoje, no ato, sem depender de receber de clientes.',
    comoInterpretar:
      'Representa o colchão de liquidez instantânea. Valores entre 0,20 e 0,50 são típicos em empresas saudáveis no Brasil.',
    faixas: {
      ideal: '≥ 0,20 (Verde: Reserva de emergência sólida para choques imediatos)',
      atencao: '0,05 a 0,19 (Âmbar: Saldo habitual, exige controle diário de tesouraria)',
      critico: '< 0,05 (Vermelho: Caixa zerado, risco de cheque especial ou atraso salarial)',
      regraTexto: 'Mede a folga em moeda sonante para emergências bancárias.',
    },
    dicaPratica:
      'Manter caixa excessivo (ex.: LI > 1,0) gera custo de oportunidade por dinheiro parado. O ideal é manter um colchão planejado e aplicar o excedente com liquidez diária.',
    unidade: 'indice',
    extrairValor: (ctx) => {
      const calcAt = calcularBalanco(ctx.balancoAtual)
      const dispAt =
        (ctx.balancoAtual?.caixa_equivalentes || 0) +
        (ctx.balancoAtual?.aplicacoes_financeiras || 0)
      const calcAnt = calcularBalanco(ctx.balancoAnterior)
      const dispAnt =
        (ctx.balancoAnterior?.caixa_equivalentes || 0) +
        (ctx.balancoAnterior?.aplicacoes_financeiras || 0)

      const val = calcAt.passivoCirculante > 0 ? dispAt / calcAt.passivoCirculante : null
      const valAnt = calcAnt.passivoCirculante > 0 ? dispAnt / calcAnt.passivoCirculante : null
      return {
        valor: val,
        valorAnterior: valAnt,
        faixaStatus: statusHigherBetter(val, 0.2, 0.05),
        textoExibicao: formatarValorInd(val, 'indice'),
        textoComparacao: calcularVariacaoTexto(val, valAnt, 'indice', ctx.anoAnterior),
      }
    },
  },
  {
    id: 'lg',
    categoria: 'liquidez',
    nome: 'Liquidez Geral',
    sigla: 'LG',
    formulaMatematica: 'LG = (AC + ARLP) / (PC + PNC)',
    formulaLegivel:
      '(Ativo Circulante + Realizável LP) ÷ (Passivo Circulante + Passivo Não Circulante)',
    oQueMede:
      'Avalia a capacidade de solvência global da empresa no longo prazo, confrontando todos os direitos realizáveis contra a totalidade das obrigações com terceiros.',
    comoInterpretar:
      'Se for maior que 1,0, a organização possui ativos monetizáveis suficientes para extinguir todas as dívidas até seu vencimento final.',
    faixas: {
      ideal: '≥ 1,10 (Verde: Solidez estrutural e segurança para credores de longo prazo)',
      atencao: '0,90 a 1,09 (Âmbar: Equilíbrio moderado, requer geração contínua de lucros)',
      critico: '< 0,90 (Vermelho: Dívidas totais superam ativos realizáveis)',
      regraTexto: 'Visão de sobrevivência continuada da empresa.',
    },
    dicaPratica:
      'Se a LG estiver em queda constante ao longo dos anos, significa que a empresa está contraindo empréstimos mais rápido do que consegue formar ativos realizáveis.',
    unidade: 'indice',
    extrairValor: (ctx) => {
      const calcAt = calcularBalanco(ctx.balancoAtual)
      const arlpAt = ctx.balancoAtual?.realizavel_longo_prazo || 0
      const exigivelAt = calcAt.passivoCirculante + calcAt.passivoNaoCirculante

      const calcAnt = calcularBalanco(ctx.balancoAnterior)
      const arlpAnt = ctx.balancoAnterior?.realizavel_longo_prazo || 0
      const exigivelAnt = calcAnt.passivoCirculante + calcAnt.passivoNaoCirculante

      const val = exigivelAt > 0 ? (calcAt.ativoCirculante + arlpAt) / exigivelAt : null
      const valAnt = exigivelAnt > 0 ? (calcAnt.ativoCirculante + arlpAnt) / exigivelAnt : null
      return {
        valor: val,
        valorAnterior: valAnt,
        faixaStatus: statusHigherBetter(val, 1.1, 0.9),
        textoExibicao: formatarValorInd(val, 'indice'),
        textoComparacao: calcularVariacaoTexto(val, valAnt, 'indice', ctx.anoAnterior),
      }
    },
  },

  // ==========================================
  // 2. CAPITAL DE GIRO / FLEURIET
  // ==========================================
  {
    id: 'ncg',
    categoria: 'capital_giro',
    nome: 'Necessidade de Capital de Giro',
    sigla: 'NCG',
    formulaMatematica: 'NCG = ACO - PCO',
    formulaLegivel: 'Ativo Circulante Operacional − Passivo Circulante Operacional',
    oQueMede:
      'Indica o montante em reais que a operação comercial e produtiva da empresa demanda de recursos para financiar clientes e estoques antes de pagar fornecedores.',
    comoInterpretar:
      'NCG positiva exige financiamento (por capital próprio ou bancário). NCG negativa significa que a empresa opera financiada com folga pelos fornecedores.',
    faixas: {
      ideal: 'Financiada por CDG (Verde: NCG menor que o Capital de Giro disponível)',
      atencao: 'NCG Próxima ao CDG (Âmbar: Tesouraria sob pressão no dia a dia)',
      critico: 'NCG > CDG (Vermelho: Efeito Tesoura, uso de dívidas bancárias caras para girar)',
      regraTexto: 'Depende do modelo de negócio (varejo costuma ter NCG menor que indústria).',
    },
    dicaPratica:
      'Para reduzir a NCG sem cortar vendas: negocie prazos maiores com fornecedores (aumenta PCO), estimule pagamentos à vista e reduza o tempo de estocagem.',
    unidade: 'moeda',
    extrairValor: (ctx) => {
      const cgAt = calcularCapitalGiro(ctx.balancoAtual, ctx.dreAtual)
      const cgAnt = calcularCapitalGiro(ctx.balancoAnterior, ctx.dreAnterior)
      const val = cgAt.ncg
      const valAnt = cgAnt.ncg
      // Status depende de ter CDG (cgl) positivo maior que NCG
      const st = cgAt.saldoTesouraria
      const faixa: StatusFaixa = st > 0 ? 'verde' : st >= -50000 ? 'ambar' : 'vermelho'
      return {
        valor: val,
        valorAnterior: valAnt,
        faixaStatus: faixa,
        textoExibicao: formatCurrency(val),
        textoComparacao: calcularVariacaoTexto(val, valAnt, 'moeda', ctx.anoAnterior),
      }
    },
  },
  {
    id: 'cdg',
    categoria: 'capital_giro',
    nome: 'Capital de Giro Líquido (CDG / CGL)',
    sigla: 'CDG',
    formulaMatematica: 'CGL = AC - PC = (PL + PNC) - ANC',
    formulaLegivel: 'Ativo Circulante − Passivo Circulante',
    oQueMede:
      'Revela a folga financeira estrutural permanente da empresa: a parcela dos recursos de longo prazo (próprios + dívidas longas) que sobram para financiar o giro.',
    comoInterpretar:
      'CGL > 0 garante que a empresa não depende de empréstimos bancários curtos para sustentar seus ativos operacionais permanentes.',
    faixas: {
      ideal: '> 0 (Verde: Folga de recursos estáveis financiando a operação)',
      atencao: 'Próximo a zero (Âmbar: Vulnerável a qualquer descompasso de faturamento)',
      critico: '< 0 (Vermelho: Passivo de curto prazo financiando ativos de longo prazo)',
      regraTexto: 'Fundamental para a estabilidade estrutural da empresa.',
    },
    dicaPratica:
      'Se o CGL for negativo, a empresa está cometendo um erro clássico: usando limite bancário ou faturas de curto prazo para pagar obras, reformas ou compra de máquinas.',
    unidade: 'moeda',
    extrairValor: (ctx) => {
      const cgAt = calcularCapitalGiro(ctx.balancoAtual, ctx.dreAtual)
      const cgAnt = calcularCapitalGiro(ctx.balancoAnterior, ctx.dreAnterior)
      const val = cgAt.cgl
      const valAnt = cgAnt.cgl
      const faixa: StatusFaixa = val > 0 ? 'verde' : val === 0 ? 'ambar' : 'vermelho'
      return {
        valor: val,
        valorAnterior: valAnt,
        faixaStatus: faixa,
        textoExibicao: formatCurrency(val),
        textoComparacao: calcularVariacaoTexto(val, valAnt, 'moeda', ctx.anoAnterior),
      }
    },
  },
  {
    id: 'st',
    categoria: 'capital_giro',
    nome: 'Saldo de Tesouraria (ST / T)',
    sigla: 'ST',
    formulaMatematica: 'ST = ACF - PCF = CGL - NCG',
    formulaLegivel: 'Ativo Circ. Financeiro − Passivo Circ. Financeiro (ou CDG − NCG)',
    oQueMede:
      'Mede o saldo líquido final do caixa da empresa após descontar todos os empréstimos bancários de curto prazo tomados para financiar o capital de giro.',
    comoInterpretar:
      'ST positivo indica superávit financeiro e autonomia bancária. ST negativo indica dependência crônica de cheque especial, antecipação de recebíveis ou capital de giro bancário.',
    faixas: {
      ideal: '> 0 (Verde: Tesouraria superavitária, sem dependência bancária curta)',
      atencao: 'Levemente negativo (Âmbar: Oscilação sazonal temporária de caixa)',
      critico: '< 0 expressivo (Vermelho: Efeito Tesoura, juros bancários devorando o lucro)',
      regraTexto: 'O termômetro definitivo do modelo Fleuriet.',
    },
    dicaPratica:
      'Um ST negativo em empresa que cresce muito em vendas é o alerta número um do "Efeito Tesoura": o crescimento devora o caixa se os prazos operacionais não forem bem calibrados.',
    unidade: 'moeda',
    extrairValor: (ctx) => {
      const cgAt = calcularCapitalGiro(ctx.balancoAtual, ctx.dreAtual)
      const cgAnt = calcularCapitalGiro(ctx.balancoAnterior, ctx.dreAnterior)
      const val = cgAt.saldoTesouraria
      const valAnt = cgAnt.saldoTesouraria
      const faixa: StatusFaixa = val > 0 ? 'verde' : val >= -30000 ? 'ambar' : 'vermelho'
      return {
        valor: val,
        valorAnterior: valAnt,
        faixaStatus: faixa,
        textoExibicao: formatCurrency(val),
        textoComparacao: calcularVariacaoTexto(val, valAnt, 'moeda', ctx.anoAnterior),
      }
    },
  },
  {
    id: 'ciclo_financeiro',
    categoria: 'capital_giro',
    nome: 'Ciclo Financeiro (Ciclo de Caixa)',
    sigla: 'CF',
    formulaMatematica: 'CF = PME + PMR - PMP',
    formulaLegivel: 'Prazo Médio Estoque + Prazo Médio Recebimento − Prazo Médio Pagamento',
    oQueMede:
      'Calcula o número de dias decorridos entre a saída real de dinheiro do caixa (pagamento a fornecedores) e a entrada do dinheiro da venda (recebimento do cliente).',
    comoInterpretar:
      'Quanto menor o ciclo financeiro, menor o montante de dinheiro que a empresa precisa manter empatado. Ciclo negativo significa que a empresa recebe dos clientes antes de pagar os fornecedores.',
    faixas: {
      ideal: '≤ 30 dias (Verde: Alta velocidade de retorno do caixa ou ciclo negativo)',
      atencao: '31 a 75 dias (Âmbar: Ciclo moderado, exige bom fôlego financeiro)',
      critico: '> 75 dias (Vermelho: Caixa fica preso por muito tempo na operação)',
      regraTexto: 'Menor é melhor. Reduz drasticamente a necessidade de capital de giro.',
    },
    dicaPratica:
      'Se o Ciclo Financeiro for de 90 dias, seu caixa fica 3 meses financiando a operação. Reduza parcelamentos concedidos aos clientes e amplie o prazo das compras com faturamento programado.',
    unidade: 'dias',
    extrairValor: (ctx) => {
      const indAt = extrairIndicadoresCompletos(ctx.balancoAtual, ctx.dreAtual)
      const indAnt = extrairIndicadoresCompletos(ctx.balancoAnterior, ctx.dreAnterior)
      const val = indAt.cf
      const valAnt = indAnt.cf
      return {
        valor: val,
        valorAnterior: valAnt,
        faixaStatus: statusLowerBetter(val, 35, 75),
        textoExibicao: formatarValorInd(val, 'dias'),
        textoComparacao: calcularVariacaoTexto(val, valAnt, 'dias', ctx.anoAnterior),
      }
    },
  },
  {
    id: 'pmr',
    categoria: 'capital_giro',
    nome: 'Prazo Médio de Recebimento',
    sigla: 'PMR',
    formulaMatematica: 'PMR = (Contas a Receber / Vendas) × 360',
    formulaLegivel: '(Contas a Receber ÷ Faturamento) × 360',
    oQueMede:
      'Informa em quantos dias, em média, a empresa demora para receber o dinheiro das vendas realizadas a prazo para seus clientes.',
    comoInterpretar:
      'PMRs muito altos indicam concessão generosa de crédito ou inadimplência de clientes. PMRs baixos mostram eficiência de cobrança ou prevalência de vendas à vista.',
    faixas: {
      ideal: '≤ 45 dias (Verde: Recebimentos rápidos e baixa exposição à inadimplência)',
      atencao: '46 a 75 dias (Âmbar: Prazo usual no B2B comercial)',
      critico: '> 75 dias (Vermelho: Financiando os clientes à custa do próprio caixa)',
      regraTexto: 'Quanto menor, mais cedo o dinheiro das vendas entra na conta bancária.',
    },
    dicaPratica:
      'Ofereça pequenos descontos financeiros para pagamentos à vista no boleto/PIX e adote réguas automáticas de cobrança 3 dias antes do vencimento.',
    unidade: 'dias',
    extrairValor: (ctx) => {
      const indAt = extrairIndicadoresCompletos(ctx.balancoAtual, ctx.dreAtual)
      const indAnt = extrairIndicadoresCompletos(ctx.balancoAnterior, ctx.dreAnterior)
      const val = indAt.pmr
      const valAnt = indAnt.pmr
      return {
        valor: val,
        valorAnterior: valAnt,
        faixaStatus: statusLowerBetter(val, 45, 75),
        textoExibicao: formatarValorInd(val, 'dias'),
        textoComparacao: calcularVariacaoTexto(val, valAnt, 'dias', ctx.anoAnterior),
      }
    },
  },
  {
    id: 'pmp',
    categoria: 'capital_giro',
    nome: 'Prazo Médio de Pagamento',
    sigla: 'PMP',
    formulaMatematica: 'PMP = (Fornecedores / Compras/CMV) × 360',
    formulaLegivel: '(Fornecedores a Pagar ÷ CMV) × 360',
    oQueMede:
      'Mostra em quantos dias, em média, a empresa quita as faturas de seus fornecedores de mercadorias, insumos e matéria-prima.',
    comoInterpretar:
      'Quanto maior o PMP (dentro das condições comerciais normais), mais tempo a empresa usufrui do capital de terceiros sem juros bancários.',
    faixas: {
      ideal: '≥ PMR (Verde: Paga fornecedores após receber dos clientes)',
      atencao: '30 a 59 dias (Âmbar: Prazo intermediário padrão de mercado)',
      critico: '< 30 dias com PMR alto (Vermelho: Paga à vista e recebe a prazo longo)',
      regraTexto: 'O ideal é ter PMP maior ou igual ao PMR para financiar o ciclo operacional.',
    },
    dicaPratica:
      'Negocie prazos diferenciados com fornecedores parceiros de grande volume. Um aumento de 15 dias no PMP pode injetar dezenas de milhares de reais no saldo de tesouraria sem custo financeiro.',
    unidade: 'dias',
    extrairValor: (ctx) => {
      const indAt = extrairIndicadoresCompletos(ctx.balancoAtual, ctx.dreAtual)
      const indAnt = extrairIndicadoresCompletos(ctx.balancoAnterior, ctx.dreAnterior)
      const val = indAt.pmp
      const valAnt = indAnt.pmp
      return {
        valor: val,
        valorAnterior: valAnt,
        faixaStatus: statusHigherBetter(val, 60, 30),
        textoExibicao: formatarValorInd(val, 'dias'),
        textoComparacao: calcularVariacaoTexto(val, valAnt, 'dias', ctx.anoAnterior),
      }
    },
  },

  // ==========================================
  // 3. ENDIVIDAMENTO
  // ==========================================
  {
    id: 'eg',
    categoria: 'endividamento',
    nome: 'Grau de Endividamento Geral',
    sigla: 'EG',
    formulaMatematica: 'EG = (Passivo Total / Ativo Total) × 100',
    formulaLegivel: '(Passivo Circulante + Passivo Não Circulante) ÷ Ativo Total × 100',
    oQueMede:
      'Identifica qual parcela de todos os ativos da organização (bens, caixa, estoques, maquinário) foi financiada com recursos de terceiros (credores, bancos, fornecedores).',
    comoInterpretar:
      'Quanto menor o índice, maior a autonomia financeira da empresa e menor o risco de insolvência perante choques econômicos.',
    faixas: {
      ideal: '≤ 50% (Verde: Estrutura segura, patrimônio próprio financia a maior parte)',
      atencao: '51% a 70% (Âmbar: Endividamento moderado, compatível com crescimento)',
      critico: '> 70% (Vermelho: Alta alavancagem, vulnerável a juros e recessão)',
      regraTexto: 'Menor é melhor. Alerta vermelho se ultrapassar 80%.',
    },
    dicaPratica:
      'Se o EG estiver alto, estabeleça uma política de retenção de lucros para incorporar reservas ao Patrimônio Líquido e amortizar passivos onerosos.',
    unidade: 'percentual',
    extrairValor: (ctx) => {
      const indAt = calcularIndicadores(ctx.balancoAtual, ctx.dreAtual)
      const indAnt = calcularIndicadores(ctx.balancoAnterior, ctx.dreAnterior)
      const val = indAt.endividamentoGeral
      const valAnt = indAnt.endividamentoGeral
      return {
        valor: val,
        valorAnterior: valAnt,
        faixaStatus: statusLowerBetter(val, 50, 70),
        textoExibicao: formatarValorInd(val, 'percentual'),
        textoComparacao: calcularVariacaoTexto(val, valAnt, 'percentual', ctx.anoAnterior),
      }
    },
  },
  {
    id: 'ce',
    categoria: 'endividamento',
    nome: 'Composição do Endividamento',
    sigla: 'CE',
    formulaMatematica: 'CE = (PC / Passivo Total) × 100',
    formulaLegivel: 'Passivo Circulante ÷ (Passivo Circulante + Passivo Não Circulante) × 100',
    oQueMede:
      'Revela o perfil de vencimento das dívidas: qual percentual de todo o capital de terceiros vence imediatamente no curto prazo (menos de 1 ano).',
    comoInterpretar:
      'Se a CE for muito alta (> 70%), a dívida é sufocante no curto prazo. Se for baixa (< 40%), a empresa conseguiu empurrar as parcelas principais para o longo prazo.',
    faixas: {
      ideal: '≤ 50% (Verde: Perfil alongado, dívidas concentradas no longo prazo)',
      atencao: '51% a 70% (Âmbar: Concentração moderada no curto prazo)',
      critico: '> 70% (Vermelho: Pressão diária sobre o fluxo de caixa)',
      regraTexto: 'Quanto menor a concentração no curto prazo, mais folga de amortização.',
    },
    dicaPratica:
      'Renegocie dívidas bancárias pulverizadas e troque várias linhas caras de curto prazo por uma linha estruturada de longo prazo com carência.',
    unidade: 'percentual',
    extrairValor: (ctx) => {
      const indAt = calcularIndicadores(ctx.balancoAtual, ctx.dreAtual)
      const indAnt = calcularIndicadores(ctx.balancoAnterior, ctx.dreAnterior)
      const val = indAt.composicaoEndividamento
      const valAnt = indAnt.composicaoEndividamento
      return {
        valor: val,
        valorAnterior: valAnt,
        faixaStatus: statusLowerBetter(val, 50, 70),
        textoExibicao: formatarValorInd(val, 'percentual'),
        textoComparacao: calcularVariacaoTexto(val, valAnt, 'percentual', ctx.anoAnterior),
      }
    },
  },
  {
    id: 'pct',
    categoria: 'endividamento',
    nome: 'Participação de Capital de Terceiros',
    sigla: 'PCT',
    formulaMatematica: 'PCT = (Passivo Total / PL) × 100',
    formulaLegivel: '(Passivo Circulante + Passivo Não Circulante) ÷ Patrimônio Líquido × 100',
    oQueMede:
      'Compara diretamente o volume de dinheiro captado com bancos/terceiros para cada R$ 100,00 de patrimônio investido pelos sócios.',
    comoInterpretar:
      'PCT de 150% significa que para cada R$ 1,00 de patrimônio dos sócios, a empresa deve R$ 1,50 a terceiros.',
    faixas: {
      ideal: '≤ 100% (Verde: Sócios possuem mais capital na empresa do que os credores)',
      atencao: '101% a 200% (Âmbar: Relação moderada e aceitável em expansão)',
      critico: '> 200% (Vermelho: Dívidas superam o dobro do patrimônio próprio)',
      regraTexto: 'Mede a dependência do negócio em relação a credores externos.',
    },
    dicaPratica:
      'Bancos analisam esse indicador ao conceder crédito: se estiver acima de 200%, os juros cobrados da sua empresa serão muito mais elevados devido ao risco aparente.',
    unidade: 'percentual',
    extrairValor: (ctx) => {
      const indAt = calcularIndicadores(ctx.balancoAtual, ctx.dreAtual)
      const indAnt = calcularIndicadores(ctx.balancoAnterior, ctx.dreAnterior)
      const val = indAt.capitalTerceirosSobreProprio
      const valAnt = indAnt.capitalTerceirosSobreProprio
      return {
        valor: val,
        valorAnterior: valAnt,
        faixaStatus: statusLowerBetter(val, 100, 200),
        textoExibicao: formatarValorInd(val, 'percentual'),
        textoComparacao: calcularVariacaoTexto(val, valAnt, 'percentual', ctx.anoAnterior),
      }
    },
  },
  {
    id: 'ipl',
    categoria: 'endividamento',
    nome: 'Imobilização do Patrimônio Líquido',
    sigla: 'IPL',
    formulaMatematica: 'IPL = (Ativo Permanente / PL) × 100',
    formulaLegivel: '(Ativo Não Circulante − Realizável LP) ÷ Patrimônio Líquido × 100',
    oQueMede:
      'Indica qual proporção do patrimônio próprio dos sócios está "presa" em bens imobilizados (prédios, veículos, máquinas) e intangíveis.',
    comoInterpretar:
      'Se for menor que 80%, sobra pelo menos 20% do capital próprio para financiar livremente o giro diário da empresa.',
    faixas: {
      ideal: '≤ 80% (Verde: Sobra capital próprio para financiar o giro operacional)',
      atencao: '81% a 100% (Âmbar: Equilíbrio estrito, capital próprio cobre os ativos fixos)',
      critico: '> 100% (Vermelho: Imobilizado é tão grande que exigiu dívidas para ser pago)',
      regraTexto: 'Regra de ouro contábil: bens permanentes devem ser pagos com capital estável.',
    },
    dicaPratica:
      'Se o IPL passar de 100%, a empresa está com ativos engessados. Considere operações de leaseback (vender o imóvel e alugá-lo de volta) para liberar liquidez.',
    unidade: 'percentual',
    extrairValor: (ctx) => {
      const indAt = calcularIndicadores(ctx.balancoAtual, ctx.dreAtual)
      const indAnt = calcularIndicadores(ctx.balancoAnterior, ctx.dreAnterior)
      const val = indAt.imobilizacaoPL
      const valAnt = indAnt.imobilizacaoPL
      return {
        valor: val,
        valorAnterior: valAnt,
        faixaStatus: statusLowerBetter(val, 80, 100),
        textoExibicao: formatarValorInd(val, 'percentual'),
        textoComparacao: calcularVariacaoTexto(val, valAnt, 'percentual', ctx.anoAnterior),
      }
    },
  },

  // ==========================================
  // 4. RENTABILIDADE
  // ==========================================
  {
    id: 'roe',
    categoria: 'rentabilidade',
    nome: 'ROE (Return on Equity)',
    sigla: 'ROE',
    formulaMatematica: 'ROE = (Lucro Líquido / PL) × 100',
    formulaLegivel: 'Lucro Líquido ÷ Patrimônio Líquido × 100',
    oQueMede:
      'Calcula a taxa de rentabilidade que a empresa gera para cada real de patrimônio próprio investido pelos sócios e acionistas.',
    comoInterpretar:
      'É o indicador rei para sócios e investidores. Deve ser comparado contra o custo de oportunidade (taxa Selic/CDI ou investimentos livres de risco).',
    faixas: {
      ideal: '≥ 15% ao ano (Verde: Remunera com folga o capital acima do CDI/Selic)',
      atencao: '5% a 14% ao ano (Âmbar: Retorno positivo porém próximo da renda fixa)',
      critico: '< 5% ou negativo (Vermelho: Destruição de valor ou prejuízo líquido)',
      regraTexto: 'Quanto maior o ROE, maior a criação de riqueza para os sócios.',
    },
    dicaPratica:
      'Um ROE sustentável acima de 20% demonstra vantagem competitiva sólida, permitindo autofinanciar o crescimento e pagar dividendos atrativos.',
    unidade: 'percentual',
    extrairValor: (ctx) => {
      const indAt = calcularIndicadores(ctx.balancoAtual, ctx.dreAtual)
      const indAnt = calcularIndicadores(ctx.balancoAnterior, ctx.dreAnterior)
      const val = indAt.roe
      const valAnt = indAnt.roe
      return {
        valor: val,
        valorAnterior: valAnt,
        faixaStatus: statusHigherBetter(val, 15, 5),
        textoExibicao: formatarValorInd(val, 'percentual'),
        textoComparacao: calcularVariacaoTexto(val, valAnt, 'percentual', ctx.anoAnterior),
      }
    },
  },
  {
    id: 'roa',
    categoria: 'rentabilidade',
    nome: 'ROA (Return on Assets)',
    sigla: 'ROA',
    formulaMatematica: 'ROA = (Lucro Líquido / Ativo Total) × 100',
    formulaLegivel: 'Lucro Líquido ÷ Ativo Total × 100',
    oQueMede:
      'Mede a capacidade global da empresa de gerar lucro a partir de toda a sua base de ativos instalados (independentemente de onde veio o dinheiro).',
    comoInterpretar:
      'Mostra a produtividade do capital investido total. Um ROA de 10% significa que cada R$ 100 de ativos gerou R$ 10 de lucro líquido.',
    faixas: {
      ideal: '≥ 8% ao ano (Verde: Alta eficiência e produtividade dos ativos)',
      atencao: '3% a 7,9% ao ano (Âmbar: Eficiência moderada, padrão de indústria pesada)',
      critico: '< 3% ao ano (Vermelho: Ativos subutilizados ou margem insuficiente)',
      regraTexto: 'Testa a eficiência operacional da gestão de ativos.',
    },
    dicaPratica:
      'Se o ROE for muito alto mas o ROA for baixo, a empresa está operando com alavancagem excessiva (muita dívida mascarando baixa produtividade dos bens).',
    unidade: 'percentual',
    extrairValor: (ctx) => {
      const indAt = calcularIndicadores(ctx.balancoAtual, ctx.dreAtual)
      const indAnt = calcularIndicadores(ctx.balancoAnterior, ctx.dreAnterior)
      const val = indAt.roa
      const valAnt = indAnt.roa
      return {
        valor: val,
        valorAnterior: valAnt,
        faixaStatus: statusHigherBetter(val, 8, 3),
        textoExibicao: formatarValorInd(val, 'percentual'),
        textoComparacao: calcularVariacaoTexto(val, valAnt, 'percentual', ctx.anoAnterior),
      }
    },
  },
  {
    id: 'margem_bruta',
    categoria: 'rentabilidade',
    nome: 'Margem Bruta',
    sigla: 'MB',
    formulaMatematica: 'MB = (Lucro Bruto / Receita Líquida) × 100',
    formulaLegivel: '(Receita Líquida − Custos de Mercadorias/Serviços) ÷ Receita Líquida × 100',
    oQueMede:
      'Avalia o percentual que sobra do faturamento após cobrir diretamente os custos fabris ou de aquisição dos produtos vendidos (CMV/CPV/CSP).',
    comoInterpretar:
      'Mede a força de precificação e o mark-up comercial da empresa perante seus clientes e concorrentes.',
    faixas: {
      ideal: '≥ 35% (Verde: Ampla margem comercial para cobrir despesas fixas)',
      atencao: '20% a 34% (Âmbar: Margem intermediária, típica de distribuição e atacado)',
      critico: '< 20% (Vermelho: Margem apertada, qualquer alta no insumo causa prejuízo)',
      regraTexto: 'Varia conforme o segmento (software costuma ter 70%, supermercado 22%).',
    },
    dicaPratica:
      'Use o módulo de Formação de Preço do sistema para calcular a ficha técnica exata de cada produto e eliminar itens com mark-up abaixo do piso necessário.',
    unidade: 'percentual',
    extrairValor: (ctx) => {
      const indAt = calcularIndicadores(ctx.balancoAtual, ctx.dreAtual)
      const indAnt = calcularIndicadores(ctx.balancoAnterior, ctx.dreAnterior)
      const val = indAt.margemBruta
      const valAnt = indAnt.margemBruta
      return {
        valor: val,
        valorAnterior: valAnt,
        faixaStatus: statusHigherBetter(val, 35, 20),
        textoExibicao: formatarValorInd(val, 'percentual'),
        textoComparacao: calcularVariacaoTexto(val, valAnt, 'percentual', ctx.anoAnterior),
      }
    },
  },
  {
    id: 'margem_liquida',
    categoria: 'rentabilidade',
    nome: 'Margem Líquida',
    sigla: 'ML',
    formulaMatematica: 'ML = (Lucro Líquido / Receita Líquida) × 100',
    formulaLegivel: 'Lucro Líquido Final ÷ Receita Líquida de Vendas × 100',
    oQueMede:
      'Mede o percentual final de cada real faturado que efetivamente vira lucro líquido na última linha da DRE, após todos os custos, despesas, juros e impostos.',
    comoInterpretar:
      'Uma ML de 12% significa que de cada R$ 100,00 faturados com notas fiscais, sobram R$ 12,00 limpos para reinvestimento ou distribuição aos sócios.',
    faixas: {
      ideal: '≥ 10% (Verde: Excelente retenção de lucro sobre as vendas)',
      atencao: '5% a 9,9% (Âmbar: Margem positiva com resguardo moderado)',
      critico: '< 5% ou negativa (Vermelho: Margem perigosamente vulnerável ou déficit)',
      regraTexto: 'O resultado final líquido do negócio.',
    },
    dicaPratica:
      'Para subir a margem líquida sem mexer no preço de venda: revise o regime tributário (Simples vs Presumido vs Real) e controle despesas administrativas fixas.',
    unidade: 'percentual',
    extrairValor: (ctx) => {
      const indAt = calcularIndicadores(ctx.balancoAtual, ctx.dreAtual)
      const indAnt = calcularIndicadores(ctx.balancoAnterior, ctx.dreAnterior)
      const val = indAt.margemLiquida
      const valAnt = indAnt.margemLiquida
      return {
        valor: val,
        valorAnterior: valAnt,
        faixaStatus: statusHigherBetter(val, 10, 5),
        textoExibicao: formatarValorInd(val, 'percentual'),
        textoComparacao: calcularVariacaoTexto(val, valAnt, 'percentual', ctx.anoAnterior),
      }
    },
  },
  {
    id: 'ebitda',
    categoria: 'rentabilidade',
    nome: 'EBITDA (LAJIDA) & Margem EBITDA',
    sigla: 'EBITDA',
    formulaMatematica: 'EBITDA = Lucro Operacional + Depreciação + Amortização',
    formulaLegivel: 'Lucro antes de Juros, Impostos, Depreciação e Amortização',
    oQueMede:
      'Mede o verdadeiro potencial de geração bruta de caixa gerado pela atividade puramente operacional, excluindo efeitos financeiros, fiscais e não monetários.',
    comoInterpretar:
      'É o indicador padrão internacional mais usado em fusões, aquisições e análise bancária para medir a potência de fogo da operação da empresa.',
    faixas: {
      ideal: 'Margem EBITDA ≥ 15% (Verde: Alta geração de caixa puro da atividade)',
      atencao: '8% a 14,9% (Âmbar: Geração de caixa adequada ao setor)',
      critico: '< 8% ou negativo (Vermelho: Operação pouco eficiente ou consumindo caixa)',
      regraTexto: 'Margem EBITDA = (EBITDA ÷ Receita Líquida) × 100.',
    },
    dicaPratica:
      'Múltiplos de mercado (ex.: "Empresa vale 5x o EBITDA anual") são balizadores comuns para avaliação de compra e venda de empresas no Brasil.',
    unidade: 'moeda',
    extrairValor: (ctx) => {
      const dreAt = calcularDre(ctx.dreAtual)
      const dreAnt = calcularDre(ctx.dreAnterior)
      const val = dreAt.ebitda
      const valAnt = dreAnt.ebitda
      const margem = dreAt.receitaLiquida > 0 ? (val / dreAt.receitaLiquida) * 100 : null
      const faixa: StatusFaixa =
        margem !== null ? statusHigherBetter(margem, 15, 8) : val > 0 ? 'verde' : 'vermelho'
      return {
        valor: val,
        valorAnterior: valAnt,
        faixaStatus: faixa,
        textoExibicao: `${formatCurrency(val)} (${margem ? `${formatNumber(margem, 1)}%` : '—'})`,
        textoComparacao: calcularVariacaoTexto(val, valAnt, 'moeda', ctx.anoAnterior),
      }
    },
  },

  // ==========================================
  // 5. PONTO DE EQUILÍBRIO
  // ==========================================
  {
    id: 'pec',
    categoria: 'ponto_equilibrio',
    nome: 'Ponto de Equilíbrio Contábil (PEC)',
    sigla: 'PEC',
    formulaMatematica: 'PEC = Custos Fixos / Margem de Contribuição %',
    formulaLegivel: 'Custos e Despesas Fixas ÷ Margem de Contribuição (%)',
    oQueMede:
      'Calcula o faturamento exato em que a empresa empata: a receita cobre 100% de todos os custos e despesas fixas, gerando lucro exatamente igual a zero.',
    comoInterpretar:
      'Abaixo do PEC a empresa opera no vermelho. Acima do PEC, cada real vendido gera lucro líquido proporcional à margem de contribuição.',
    faixas: {
      ideal: 'Faturamento Atual > PEC + 20% (Verde: Ampla margem de segurança)',
      atencao: 'Faturamento entre PEC e PEC + 15% (Âmbar: Próximo ao limite)',
      critico: 'Faturamento Atual < PEC (Vermelho: Operação deficitária / prejuízo)',
      regraTexto: 'Define o volume de vendas para sobrevivência básica.',
    },
    dicaPratica:
      'Descubra qual dia do mês sua empresa atinge o PEC: ex.: se você atinge no dia 20, todos os produtos vendidos do dia 21 ao 30 geram lucro puro para o caixa.',
    unidade: 'moeda',
    extrairValor: (ctx) => {
      const peAt = calcularPontoEquilibrio(ctx.balancoAtual, ctx.dreAtual)
      const peAnt = calcularPontoEquilibrio(ctx.balancoAnterior, ctx.dreAnterior)
      const val = peAt.pec
      const valAnt = peAnt.pec
      const rl = peAt.receitaLiquida
      const faixa: StatusFaixa = rl >= val * 1.15 ? 'verde' : rl >= val ? 'ambar' : 'vermelho'
      return {
        valor: val,
        valorAnterior: valAnt,
        faixaStatus: faixa,
        textoExibicao: formatCurrency(val),
        textoComparacao: calcularVariacaoTexto(val, valAnt, 'moeda', ctx.anoAnterior),
      }
    },
  },
  {
    id: 'margem_seguranca',
    categoria: 'ponto_equilibrio',
    nome: 'Margem de Segurança Operacional',
    sigla: 'MS',
    formulaMatematica: 'MS = ((Receita Atual - PEC) / Receita Atual) × 100',
    formulaLegivel: '(Receita Líquida Atual − PEC) ÷ Receita Líquida Atual × 100',
    oQueMede:
      'Indica quantos por cento as vendas da empresa podem cair antes que o negócio comece a entrar no prejuízo contábil.',
    comoInterpretar:
      'Uma Margem de Segurança de 25% significa que a empresa suporta uma retração de mercado ou perda de clientes de até 25% sem entrar em déficit.',
    faixas: {
      ideal: '≥ 20% (Verde: Confortável respiro contra crises de mercado)',
      atencao: '5% a 19,9% (Âmbar: Folga reduzida, requer cautela na estrutura fixa)',
      critico: '< 5% ou negativa (Vermelho: Operação no limite ou no prejuízo)',
      regraTexto: 'Quanto maior a porcentagem, maior a resiliência a crises.',
    },
    dicaPratica:
      'Para ampliar a margem de segurança: terceirize processos fixos tornando-os variáveis (só paga quando vende) e diminua a estrutura ociosa.',
    unidade: 'percentual',
    extrairValor: (ctx) => {
      const peAt = calcularPontoEquilibrio(ctx.balancoAtual, ctx.dreAtual)
      const peAnt = calcularPontoEquilibrio(ctx.balancoAnterior, ctx.dreAnterior)
      const val = peAt.margemSeguranca
      const valAnt = peAnt.margemSeguranca
      return {
        valor: val,
        valorAnterior: valAnt,
        faixaStatus: statusHigherBetter(val, 20, 5),
        textoExibicao: formatarValorInd(val, 'percentual'),
        textoComparacao: calcularVariacaoTexto(val, valAnt, 'percentual', ctx.anoAnterior),
      }
    },
  },
  {
    id: 'margem_contribuicao',
    categoria: 'ponto_equilibrio',
    nome: 'Margem de Contribuição (MC %)',
    sigla: 'MC %',
    formulaMatematica: 'MC % = ((Receita - Custos Variáveis) / Receita) × 100',
    formulaLegivel: '(Receita Líquida − Custos e Despesas Variáveis) ÷ Receita Líquida × 100',
    oQueMede:
      'Mede a sobra percentual de cada venda realizada que fica disponível para "contribuir" no pagamento da estrutura fixa e na formação do lucro líquido.',
    comoInterpretar:
      'Se a MC for de 40%, cada R$ 100 faturados geram R$ 40 livres para pagar aluguel, salários fixos e sobrar para o sócio.',
    faixas: {
      ideal: '≥ 40% (Verde: Alta alavancagem operacional e facilidade em cobrir fixos)',
      atencao: '25% a 39,9% (Âmbar: Margem média usual no varejo e comércio geral)',
      critico: '< 25% (Vermelho: Margem baixa exige volume de vendas descomunal)',
      regraTexto: 'Fundamental para calibrar campanhas e descontos comerciais.',
    },
    dicaPratica:
      'Cuidado com descontos concedidos pela equipe comercial: um desconto de 10% no preço pode derrubar sua Margem de Contribuição pela metade!',
    unidade: 'percentual',
    extrairValor: (ctx) => {
      const peAt = calcularPontoEquilibrio(ctx.balancoAtual, ctx.dreAtual)
      const peAnt = calcularPontoEquilibrio(ctx.balancoAnterior, ctx.dreAnterior)
      const val = peAt.margemContribuicaoPercentual
      const valAnt = peAnt.margemContribuicaoPercentual
      return {
        valor: val,
        valorAnterior: valAnt,
        faixaStatus: statusHigherBetter(val, 40, 25),
        textoExibicao: formatarValorInd(val, 'percentual'),
        textoComparacao: calcularVariacaoTexto(val, valAnt, 'percentual', ctx.anoAnterior),
      }
    },
  },
  {
    id: 'pef',
    categoria: 'ponto_equilibrio',
    nome: 'Ponto de Equilíbrio Financeiro (PEF)',
    sigla: 'PEF',
    formulaMatematica: 'PEF = (Custos Fixos - Depreciação) / Margem de Contribuição %',
    formulaLegivel: '(Custos Fixos − Custos Não Desembolsáveis) ÷ Margem de Contribuição (%)',
    oQueMede:
      'Calcula o faturamento mínimo para não faltar dinheiro vivo no caixa para pagar despesas imediatas, desconsiderando custos contábeis sem desembolso (como depreciação).',
    comoInterpretar:
      'Mostra o piso absoluto de sobrevivência do caixa imediato em meses de crise aguda.',
    faixas: {
      ideal: 'Faturamento Atual > PEF + 30% (Verde: Geração robusta de caixa)',
      atencao: 'Faturamento entre PEF e PEC (Âmbar: Caixa sobrevive mas patrimônio deteriora)',
      critico: 'Faturamento < PEF (Vermelho: Queima ativa de caixa, risco de insolvência)',
      regraTexto: 'O limite mínimo para não entrar no vermelho bancário.',
    },
    dicaPratica:
      'Se o faturamento estiver acima do PEF mas abaixo do PEC, as contas de caixa são pagas em dia, mas o maquinário está se desgastando sem reposição contábil.',
    unidade: 'moeda',
    extrairValor: (ctx) => {
      const peAt = calcularPontoEquilibrio(ctx.balancoAtual, ctx.dreAtual)
      const peAnt = calcularPontoEquilibrio(ctx.balancoAnterior, ctx.dreAnterior)
      const val = peAt.pef
      const valAnt = peAnt.pef
      const rl = peAt.receitaLiquida
      const faixa: StatusFaixa = rl >= val * 1.2 ? 'verde' : rl >= val ? 'ambar' : 'vermelho'
      return {
        valor: val,
        valorAnterior: valAnt,
        faixaStatus: faixa,
        textoExibicao: formatCurrency(val),
        textoComparacao: calcularVariacaoTexto(val, valAnt, 'moeda', ctx.anoAnterior),
      }
    },
  },

  // ==========================================
  // 6. VALUATION
  // ==========================================
  {
    id: 'valuation_fcd',
    categoria: 'valuation',
    nome: 'Valuation por FCD (Fluxo de Caixa Descontado)',
    sigla: 'FCD',
    formulaMatematica: 'EV = ∑ [FCF_t / (1+WACC)^t] + VP(Valor Terminal)',
    formulaLegivel:
      'Soma do Valor Presente dos Fluxos de Caixa Projetados + Perpetuidade de Gordon',
    oQueMede:
      'Estima o valor intrínseco econômico da empresa com base na sua capacidade comprovada de gerar lucros e fluxos de caixa futuros trazidos a valor presente.',
    comoInterpretar:
      'É a metodologia mais aceita e prestigiada pelo mercado financeiro, bancos de investimento e fundos de private equity.',
    faixas: {
      ideal: 'FCD > Patrimônio Líquido Contábil (Verde: Empresa cria valor econômico)',
      atencao: 'FCD alinhado ao PL (Âmbar: Empresa remunera exatamente seu capital)',
      critico: 'FCD < PL ou negativo (Vermelho: Operação destruindo valor patrimonial)',
      regraTexto: 'Depende da taxa de desconto (WACC) e taxa de crescimento (g).',
    },
    dicaPratica:
      'Para elevar o Valuation da sua empresa: melhore a previsibilidade de receita com contratos recorrentes, reduza a dependência dos donos e aumente a margem EBITDA.',
    unidade: 'moeda',
    extrairValor: (ctx) => {
      const dreAt = calcularDre(ctx.dreAtual)
      const baseFcf = dreAt.ebitda !== 0 ? dreAt.ebitda : dreAt.resultadoOperacional || 0
      const waccDec = 0.12
      const gDec = 0.03
      const anos = 5
      let somaVp = 0
      let fcfAcum = baseFcf
      for (let t = 1; t <= anos; t++) {
        fcfAcum = fcfAcum * 1.05
        somaVp += fcfAcum / Math.pow(1 + waccDec, t)
      }
      const terminalNominal = (fcfAcum * (1 + gDec)) / (waccDec - gDec)
      const vpTerminal = terminalNominal / Math.pow(1 + waccDec, anos)
      const val = baseFcf > 0 ? somaVp + vpTerminal : 0

      const dreAnt = calcularDre(ctx.dreAnterior)
      const baseFcfAnt = dreAnt.ebitda !== 0 ? dreAnt.ebitda : dreAnt.resultadoOperacional || 0
      let somaVpAnt = 0
      let fcfAcumAnt = baseFcfAnt
      for (let t = 1; t <= anos; t++) {
        fcfAcumAnt = fcfAcumAnt * 1.05
        somaVpAnt += fcfAcumAnt / Math.pow(1 + waccDec, t)
      }
      const valAnt =
        baseFcfAnt > 0 ? somaVpAnt + (fcfAcumAnt * 1.03) / 0.09 / Math.pow(1.12, anos) : 0

      const pl = calcularBalanco(ctx.balancoAtual).patrimonioLiquido
      const faixa: StatusFaixa = val > pl && val > 0 ? 'verde' : val > 0 ? 'ambar' : 'vermelho'
      return {
        valor: val > 0 ? val : null,
        valorAnterior: valAnt > 0 ? valAnt : null,
        faixaStatus: faixa,
        textoExibicao: val > 0 ? formatCurrency(val) : 'Requer dados operacionais',
        textoComparacao:
          val > 0 && valAnt > 0
            ? calcularVariacaoTexto(val, valAnt, 'moeda', ctx.anoAnterior)
            : undefined,
      }
    },
  },
  {
    id: 'valuation_goodwill',
    categoria: 'valuation',
    nome: 'Modelo Goodwill (Superlucro Capitalizado)',
    sigla: 'Goodwill',
    formulaMatematica: 'Valor = PL + (Superlucro / Taxa de Capitalização)',
    formulaLegivel: 'Patrimônio Líquido + (Lucro Real − Lucro Normal do PL) ÷ Taxa Cap.',
    oQueMede:
      'Avalia o valor dos ativos intangíveis e da reputação da empresa, quantificando o prêmio que ela merece por dar mais lucro do que uma aplicação de mercado no mesmo PL.',
    comoInterpretar:
      'Se o Goodwill for positivo, o negócio possui diferenciais competitivos (marca, carteira de clientes, tecnologia) que geram retornos anormais.',
    faixas: {
      ideal: 'Goodwill > 0 expressivo (Verde: Marca e diferenciais agregam valor)',
      atencao: 'Goodwill próximo de zero (Âmbar: Rentabilidade normal de mercado)',
      critico: 'Goodwill negativo (Vermelho: Operação rende menos que a renda fixa)',
      regraTexto: 'Mede o valor intangível acima do patrimônio contábil estático.',
    },
    dicaPratica:
      'Investir em satisfação de clientes, contratos de exclusividade e processos padronizados eleva diretamente o valor do Goodwill.',
    unidade: 'moeda',
    extrairValor: (ctx) => {
      const calcB = calcularBalanco(ctx.balancoAtual)
      const calcD = calcularDre(ctx.dreAtual)
      const pl = calcB.patrimonioLiquido
      const ll = calcD.lucroLiquido
      const lucroNormal = pl * 0.12
      const superlucro = ll - lucroNormal
      const goodwill = superlucro / 0.2
      const val = pl + goodwill

      const calcBAnt = calcularBalanco(ctx.balancoAnterior)
      const calcDAnt = calcularDre(ctx.dreAnterior)
      const plAnt = calcBAnt.patrimonioLiquido
      const llAnt = calcDAnt.lucroLiquido
      const superlucroAnt = llAnt - plAnt * 0.12
      const valAnt = plAnt + superlucroAnt / 0.2

      const faixa: StatusFaixa = goodwill > 0 ? 'verde' : superlucro >= 0 ? 'ambar' : 'vermelho'
      return {
        valor: pl > 0 ? val : null,
        valorAnterior: plAnt > 0 ? valAnt : null,
        faixaStatus: faixa,
        textoExibicao: pl > 0 ? formatCurrency(val) : 'Requer dados do balanço',
        textoComparacao:
          pl > 0 && plAnt > 0
            ? calcularVariacaoTexto(val, valAnt, 'moeda', ctx.anoAnterior)
            : undefined,
      }
    },
  },

  // ==========================================
  // 7. BALANCED SCORECARD (BSC)
  // ==========================================
  {
    id: 'bsc_score_global',
    categoria: 'bsc',
    nome: 'Score Global do Balanced Scorecard (BSC)',
    sigla: 'Score BSC',
    formulaMatematica: 'Score = ∑ (Score da Perspectiva × 25%)',
    formulaLegivel: 'Média Ponderada das 4 Perspectivas Estratégicas (0 a 100%)',
    oQueMede:
      'Sintetiza em um único índice o atingimento das metas corporativas em todas as 4 dimensões: Financeira, Clientes, Processos Internos e Aprendizado/Pessoas.',
    comoInterpretar:
      'Impede que a empresa se iluda com metas puramente financeiras enquanto destrói o atendimento a clientes ou a capacitação de seus colaboradores.',
    faixas: {
      ideal: '≥ 85% (Verde: Execução estratégica de alto nível em equilíbrio)',
      atencao: '70% a 84,9% (Âmbar: Execução satisfatória com pontos de atenção)',
      critico: '< 70% (Vermelho: Descompasso estratégico e metas negligenciadas)',
      regraTexto: 'Integra metas quantitativas e qualitativas da gestão.',
    },
    dicaPratica:
      'Se a perspectiva Financeira for verde mas Clientes e Aprendizado forem vermelhos, o lucro atual é um castelo de cartas que ruirá nos próximos anos.',
    unidade: 'score',
    extrairValor: (ctx) => {
      if (!ctx.bscKpis || ctx.bscKpis.length === 0) {
        return {
          valor: null,
          valorAnterior: null,
          faixaStatus: 'indefinido',
          textoExibicao: 'Aguardando cadastro no módulo BSC',
        }
      }
      // Calcular score simples médio dos kpis cadastrados
      const scores = ctx.bscKpis.map((k) => {
        const meta = k.meta || 1
        const atual = k.valor_atual || 0
        if (k.sentido === 'menor_melhor') {
          return atual <= meta ? 100 : Math.max(0, Math.round((meta / atual) * 100))
        }
        return meta > 0 ? Math.min(120, Math.round((atual / meta) * 100)) : 100
      })
      const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      return {
        valor: avg,
        valorAnterior: null,
        faixaStatus: statusHigherBetter(avg, 85, 70),
        textoExibicao: `${avg}% de atingimento`,
      }
    },
  },
  {
    id: 'bsc_perspectivas',
    categoria: 'bsc',
    nome: 'As 4 Perspectivas do Modelo BSC',
    sigla: '4 Perspectivas',
    formulaMatematica: 'Financeira + Clientes + Processos Internos + Aprendizado',
    formulaLegivel:
      'Dimensões: Financeira, Clientes & Mercado, Processos Internos, Pessoas & Crescimento',
    oQueMede:
      'A causa e efeito da estratégia: Pessoas capacitadas melhoram os Processos Internos, que encantam os Clientes, gerando Resultados Financeiros superiores.',
    comoInterpretar:
      'Cada perspectiva tem suas metas específicas e pesos ponderados para apuração automática contínua.',
    faixas: {
      ideal: 'Todas as 4 perspectivas equilibradas acima da meta',
      atencao: 'Uma ou duas perspectivas com atingimento parcial',
      critico: 'Perspectivas de base (Processos e Pessoas) negligenciadas',
      regraTexto: 'Metodologia criada por Kaplan & Norton em Harvard.',
    },
    dicaPratica:
      'Cadastre no mínimo 2 a 3 metas em cada perspectiva para obter um laudo executivo balanceado de gestão para a diretoria.',
    unidade: 'score',
    extrairValor: (ctx) => {
      const total = ctx.bscKpis?.length || 0
      return {
        valor: total > 0 ? total : null,
        valorAnterior: null,
        faixaStatus: total >= 4 ? 'verde' : total > 0 ? 'ambar' : 'indefinido',
        textoExibicao: total > 0 ? `${total} KPIs monitorados` : 'Sem KPIs cadastrados',
      }
    },
  },

  // ==========================================
  // 8. ECONÔMICOS & KANITZ
  // ==========================================
  {
    id: 'kanitz_fi',
    categoria: 'economicos_solvencia',
    nome: 'Termômetro de Insolvência de Kanitz (Fator FI)',
    sigla: 'FI Kanitz',
    formulaMatematica: 'FI = (0,05·X1) + (1,65·X2) + (3,55·X3) - (1,06·X4) - (0,33·X5)',
    formulaLegivel: '0,05·ROE + 1,65·LG + 3,55·LS − 1,06·GE − 0,33·LC',
    oQueMede:
      'Modelo econométrico multivariado clássico de Stephen Kanitz que prevê a probabilidade estatística de falência ou solvência de uma empresa brasileira.',
    comoInterpretar:
      'Se o FI for maior ou igual a zero, a empresa está na Zona de Solvência. Entre 0 e -3 está na Zona de Penumbra. Abaixo de -3 está na Zona de Insolvência.',
    faixas: {
      ideal: 'FI ≥ 0,00 (Verde: Solvente, risco de falência ou recuperação judicial remoto)',
      atencao: '-3,00 a -0,01 (Âmbar: Zona de Penumbra, risco moderado e indefinição)',
      critico: '< -3,00 (Vermelho: Zona de Insolvência, alto perigo de descontinuidade)',
      regraTexto: 'Quanto maior que zero, maior a segurança institucional.',
    },
    dicaPratica:
      'Bancos e seguradoras usam modelos como Kanitz e Altman para classificar o rating de crédito da empresa. Manter FI positivo abre limites de crédito com taxas reduzidas.',
    unidade: 'score',
    extrairValor: (ctx) => {
      const kAt = calcularKanitz(ctx.balancoAtual, ctx.dreAtual)
      const kAnt = calcularKanitz(ctx.balancoAnterior, ctx.dreAnterior)
      const val = kAt.fi
      const valAnt = kAnt.fi
      const faixa: StatusFaixa =
        val === null ? 'indefinido' : val >= 0 ? 'verde' : val >= -3 ? 'ambar' : 'vermelho'
      return {
        valor: val,
        valorAnterior: valAnt,
        faixaStatus: faixa,
        textoExibicao:
          val !== null ? `${formatNumber(val, 2)} (${kAt.statusTexto})` : 'Não calculado',
        textoComparacao:
          val !== null && valAnt !== null
            ? calcularVariacaoTexto(val, valAnt, 'indice', ctx.anoAnterior)
            : undefined,
      }
    },
  },
  {
    id: 'roic_spread',
    categoria: 'economicos_solvencia',
    nome: 'ROIC & Spread Econômico (vs WACC)',
    sigla: 'ROIC / Spread',
    formulaMatematica: 'ROIC = NOPAT / Capital Investido · Spread = ROIC - WACC',
    formulaLegivel:
      'Retorno sobre Capital Investido Operacional − Custo Médio Ponderado de Capital',
    oQueMede:
      'Mede se o negócio gera retorno superior ao custo de captar capital no mercado. Se ROIC > WACC, a empresa cria riqueza real (EVA positivo).',
    comoInterpretar:
      'Spread positivo significa que cada novo investimento feito na empresa aumenta o valor de mercado dos sócios.',
    faixas: {
      ideal: 'Spread > 3% ao ano (Verde: Criação substancial de valor econômico)',
      atencao: 'Spread de 0% a 3% (Âmbar: Criação modesta, próxima ao custo de capital)',
      critico: 'Spread < 0% (Vermelho: Destruição de valor, seria melhor aplicar o dinheiro)',
      regraTexto: 'O princípio central das finanças modernas de criação de valor.',
    },
    dicaPratica:
      'Aumente o ROIC eliminando ativos operacionais ociosos (máquinas paradas, prédios subutilizados) e otimizando a carga tributária do lucro operacional (NOPAT).',
    unidade: 'percentual',
    extrairValor: (ctx) => {
      const indAt = extrairIndicadoresCompletos(ctx.balancoAtual, ctx.dreAtual)
      const indAnt = extrairIndicadoresCompletos(ctx.balancoAnterior, ctx.dreAnterior)
      const val = indAt.roic
      const valAnt = indAnt.roic
      const spread = indAt.spread
      const faixa: StatusFaixa = spread !== null ? statusHigherBetter(spread, 3, 0) : 'indefinido'
      return {
        valor: val,
        valorAnterior: valAnt,
        faixaStatus: faixa,
        textoExibicao:
          val !== null
            ? `${formatNumber(val, 1)}% (Spread: ${formatNumber(spread, 1)} p.p.)`
            : 'Não calculado',
        textoComparacao:
          val !== null && valAnt !== null
            ? calcularVariacaoTexto(val, valAnt, 'percentual', ctx.anoAnterior)
            : undefined,
      }
    },
  },
]
