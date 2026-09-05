import type { BscPerspectiva } from '@/types/finance'

export type CategoriaProblemaPlano =
  | 'liquidez'
  | 'margem'
  | 'inadimplencia'
  | 'endividamento'
  | 'ciclo_financeiro'
  | 'operacional_otif'
  | 'turnover_equipe'

export interface ModeloPlanoAcao {
  id: string
  categoria: CategoriaProblemaPlano
  categoriaNome: string
  titulo: string
  descricao: string
  etapasSugeridas: string[]
  prazoSugeridoDias: number
  perspectivaRecomendada: BscPerspectiva
  kpisRelacionados: string[] // nomes de fórmulas ou termos de busca de KPI
}

export const CATEGORIAS_PROBLEMAS: { id: CategoriaProblemaPlano; nome: string; icone?: string }[] =
  [
    { id: 'liquidez', nome: 'Liquidez & Capital de Curto Prazo' },
    { id: 'margem', nome: 'Margem & Rentabilidade' },
    { id: 'inadimplencia', nome: 'Inadimplência & Contas a Receber' },
    { id: 'endividamento', nome: 'Endividamento & Estrutura de Capital' },
    { id: 'ciclo_financeiro', nome: 'Ciclo Financeiro & Giro de Estoques' },
    { id: 'operacional_otif', nome: 'Qualidade Operacional & OTIF' },
    { id: 'turnover_equipe', nome: 'Retenção & Clima de Pessoal' },
  ]

export const CATALOGO_MODELOS_PLANOS: ModeloPlanoAcao[] = [
  // 1. LIQUIDEZ
  {
    id: 'liq-reestruturacao-passivo',
    categoria: 'liquidez',
    categoriaNome: 'Liquidez & Curto Prazo',
    titulo: 'Alongamento de Passivos e Reestruturação de Dívidas de Curto Prazo',
    descricao:
      'Renegociar vencimentos bancários de curto prazo para longo prazo, liberando fluxo de caixa livre mensal e recompondo a Liquidez Corrente.',
    etapasSugeridas: [
      '1. Mapear cronograma completo de amortizações dos próximos 90 dias.',
      '2. Agendar rodada de negociação com bancos credores propondo carência e taxa menor.',
      '3. Formalizar aditivos contratuais de alongamento de prazos.',
      '4. Monitorar evolução da Liquidez Corrente mensalmente.',
    ],
    prazoSugeridoDias: 45,
    perspectivaRecomendada: 'financeira',
    kpisRelacionados: ['liquidez_corrente', 'liquidez_seca', 'liquidez_geral'],
  },
  {
    id: 'liq-politica-caixa-minimo',
    categoria: 'liquidez',
    categoriaNome: 'Liquidez & Curto Prazo',
    titulo: 'Implementação de Política de Saldo de Caixa Mínimo de Segurança',
    descricao:
      'Definir colchão de liquidez correspondente a 30-45 dias de despesas operacionais fixas, reduzindo dependência de cheque especial e antecipações pontuais.',
    etapasSugeridas: [
      '1. Apurar média diária de queima de caixa (burn rate operacional).',
      '2. Fixar patamar de reserva de liquidez em conta remunerada de alta liquidez.',
      '3. Estabelecer gatilhos de corte de gastos se o saldo atingir o nível amarelo.',
      '4. Instituir comitê semanal de tesouraria.',
    ],
    prazoSugeridoDias: 30,
    perspectivaRecomendada: 'financeira',
    kpisRelacionados: ['liquidez_corrente', 'liquidez_imediata'],
  },

  // 2. MARGEM E RENTABILIDADE
  {
    id: 'margem-revisao-precificacao',
    categoria: 'margem',
    categoriaNome: 'Margem & Rentabilidade',
    titulo: 'Revisão da Tabela de Preços e Markup por Linha de Produto/Serviço',
    descricao:
      'Auditar markups vigentes frente à inflação de insumos e custos tributários, eliminando itens com margem de contribuição negativa.',
    etapasSugeridas: [
      '1. Calcular margem de contribuição unitária de todos os SKUs/serviços.',
      '2. Identificar os 20% de produtos que geram 80% da margem líquida.',
      '3. Reajustar preços dos produtos subavaliados com margem defasada.',
      '4. Descontinuar ou reposicionar contratos com margem unitária deficitária.',
    ],
    prazoSugeridoDias: 30,
    perspectivaRecomendada: 'financeira',
    kpisRelacionados: ['margem_bruta', 'margem_liquida', 'margem_operacional', 'roe'],
  },
  {
    id: 'margem-reducao-despesas-fixas',
    categoria: 'margem',
    categoriaNome: 'Margem & Rentabilidade',
    titulo: 'Plano de Otimização e Corte de Despesas Fixas Operacionais (SG&A)',
    descricao:
      'Auditoria de despesas gerais, administrativas e de terceiros com meta de economia de 8% a 15% para ampliação do EBITDA e margem operacional.',
    etapasSugeridas: [
      '1. Mapear maiores centros de custos na DRE analítica.',
      '2. Renegociar contratos de software, licenças, telecom e locação predial.',
      '3. Unificar compras corporativas para ganho de escala.',
      '4. Criar matriz de limites de aprovação para novos desembolsos.',
    ],
    prazoSugeridoDias: 45,
    perspectivaRecomendada: 'financeira',
    kpisRelacionados: ['margem_operacional', 'margem_liquida', 'ebitda'],
  },

  // 3. INADIMPLÊNCIA & RECEBÍVEIS
  {
    id: 'inad-regua-cobranca-preventiva',
    categoria: 'inadimplencia',
    categoriaNome: 'Inadimplência & Recebíveis',
    titulo: 'Estruturação de Régua de Cobrança Automatizada e Preventiva',
    descricao:
      'Implantar avisos automáticos de pré-vencimento (D-5, D-2), contato imediato no vencimento e régua de notificação formal para reduzir atrasos recorrentes.',
    etapasSugeridas: [
      '1. Parametrizar avisos por e-mail e WhatsApp 3 dias antes do vencimento.',
      '2. Criar script de cobrança amigável para títulos vencidos até 7 dias.',
      '3. Definir política de suspensão de novas vendas a clientes inadimplentes há mais de 15 dias.',
      '4. Encaminhar para cobrança jurídica/protesto após 45 dias sem quitação.',
    ],
    prazoSugeridoDias: 20,
    perspectivaRecomendada: 'processos_internos',
    kpisRelacionados: ['pmr', 'liquidez_corrente', 'ciclo_financeiro'],
  },
  {
    id: 'inad-politica-credito-cliente',
    categoria: 'inadimplencia',
    categoriaNome: 'Inadimplência & Recebíveis',
    titulo: 'Reformulação da Política e Limites de Concessão de Crédito',
    descricao:
      'Exigir consulta de restritivos (Serasa/SPC) e histórico de pagamentos antes da concessão de prazos dilatados para novos clientes e pedidos vultosos.',
    etapasSugeridas: [
      '1. Estabelecer matriz de limite de crédito vinculada ao faturamento do cliente.',
      '2. Condicionar primeira compra de clientes novos a pagamento à vista ou 50% de entrada.',
      '3. Criar comitê de crédito quinzenal para aprovação de prazos acima de 60 dias.',
      '4. Integrar sistema de emissão de NF com verificação de bloqueio automático por dívida pendente.',
    ],
    prazoSugeridoDias: 25,
    perspectivaRecomendada: 'processos_internos',
    kpisRelacionados: ['pmr', 'taxa_retencao_clientes'],
  },

  // 4. ENDIVIDAMENTO & ESTRUTURA DE CAPITAL
  {
    id: 'endiv-troca-divida-onerosa',
    categoria: 'endividamento',
    categoriaNome: 'Endividamento & Capital',
    titulo: 'Troca de Dívidas Caras por Linhas de Financiamento Subsidiadas / Menor Spread',
    descricao:
      'Substituir linhas rotativas e antecipação de recebíveis por linhas de fomento (ex: Pronampe, FGI, BNDES) com taxa de juros mais amena.',
    etapasSugeridas: [
      '1. Levantar o Custo Efetivo Total (CET) de cada operação financeira ativa.',
      '2. Contactar bancos parceiros para portabilidade de dívidas e captação de linhas incentivadas.',
      '3. Liquidar integralmente limites de cheque especial e antecipações pontuais.',
      '4. Acompanhar redução da despesa financeira na DRE mensal.',
    ],
    prazoSugeridoDias: 60,
    perspectivaRecomendada: 'financeira',
    kpisRelacionados: ['endividamento_geral', 'composicao_endividamento', 'margem_liquida'],
  },

  // 5. CICLO FINANCEIRO & ESTOQUES
  {
    id: 'ciclo-reducao-pme-estoques',
    categoria: 'ciclo_financeiro',
    categoriaNome: 'Ciclo Financeiro & Estoques',
    titulo: 'Campanha de Queima de Itens Parados e Redução do Giro de Estoque (PME)',
    descricao:
      'Identificar produtos obsoletos ou sem giro há mais de 90 dias e aplicar promoções / liquidação para transformar mercadoria estagnada em caixa.',
    etapasSugeridas: [
      '1. Emitir relatório Curva ABC e classificação de giro (estoque sem movimentação >90 dias).',
      '2. Criar tabela com descontos progressivos para queima desses lotes.',
      '3. Ajustar lote econômico de compra junto a fornecedores para evitar novas compras excessivas.',
      '4. Recalcular o Prazo Médio de Estoque (PME) até atingir o limite orçado.',
    ],
    prazoSugeridoDias: 30,
    perspectivaRecomendada: 'processos_internos',
    kpisRelacionados: ['pme', 'ciclo_financeiro', 'ciclo_operacional', 'liquidez_seca'],
  },
  {
    id: 'ciclo-alongamento-fornecedores-pmp',
    categoria: 'ciclo_financeiro',
    categoriaNome: 'Ciclo Financeiro & Estoques',
    titulo: 'Renegociação de Condições e Prazos com Fornecedores Críticos (PMP)',
    descricao:
      'Negociar ampliação do prazo médio de pagamento de 30 para 45/60 dias com os 10 maiores fornecedores de insumos da empresa.',
    etapasSugeridas: [
      '1. Relacionar os 10 maiores fornecedores por volume de compras no ano.',
      '2. Oferecer exclusividade ou compras programadas em troca de mais 15 dias de prazo.',
      '3. Ajustar datas de corte de faturamento para otimizar datas de quitação.',
      '4. Harmonizar PMP superior ao PMR, gerando capital de giro livre.',
    ],
    prazoSugeridoDias: 40,
    perspectivaRecomendada: 'processos_internos',
    kpisRelacionados: ['pmp', 'ciclo_financeiro', 'pmr'],
  },

  // 6. QUALIDADE OPERACIONAL & OTIF
  {
    id: 'otif-padronizacao-expedicao',
    categoria: 'operacional_otif',
    categoriaNome: 'Qualidade Operacional & OTIF',
    titulo: 'Padronização do Processo de Conferência e Expedição Logística',
    descricao:
      'Implantar checklist de expedição com dupla checagem de notas fiscais e itens antes do despacho para elevar o indicador de entregas completas e no prazo (OTIF).',
    etapasSugeridas: [
      '1. Mapear principais causas de atraso ou envio incorreto nos últimos 60 dias.',
      '2. Instituir procedimento operacional padrão (POP) de expedição com código de barras.',
      '3. Estabelecer SLA estrito com transportadoras homologadas.',
      '4. Medir semanalmente índice de devoluções e índice OTIF.',
    ],
    prazoSugeridoDias: 35,
    perspectivaRecomendada: 'processos_internos',
    kpisRelacionados: ['otif', 'retrabalho', 'satisfacao_clientes_nps'],
  },

  // 7. TURNOVER & PESSOAL
  {
    id: 'turnover-plano-retencao-talentos',
    categoria: 'turnover_equipe',
    categoriaNome: 'Retenção & Clima de Pessoal',
    titulo: 'Estruturação de Plano de Carreira e Programa de Treinamento Contínuo',
    descricao:
      'Mapear competências-chave, alinhar trilhas de desenvolvimento e realizar pesquisas de clima quinzenais para conter rotatividade e reter talentos fundamentais.',
    etapasSugeridas: [
      '1. Realizar entrevistas de desligamento e tabular principais motivos de saída.',
      '2. Desenhar trilha de capacitação técnica com 40 horas anuais por colaborador.',
      '3. Alinhar metas individuais atreladas ao BSC com premiação periódica.',
      '4. Conduzir pesquisa de clima organizacional semestral.',
    ],
    prazoSugeridoDias: 60,
    perspectivaRecomendada: 'aprendizado_crescimento',
    kpisRelacionados: ['turnover', 'capacitacao_horas', 'clima_organizacional'],
  },
]

/**
 * Encontra modelos sugeridos para um KPI específico (por fórmula, nome ou perspectiva)
 */
export function sugerirModelosPorKpi(kpiNome: string, formula?: string): ModeloPlanoAcao[] {
  const normNome = kpiNome.toLowerCase()
  const normFormula = (formula || '').toLowerCase()

  // Buscar por correspondência direta de KPI
  const correspondentes = CATALOGO_MODELOS_PLANOS.filter((m) => {
    return (
      m.kpisRelacionados.some((k) => normFormula.includes(k) || normNome.includes(k)) ||
      (normNome.includes('liquidez') && m.categoria === 'liquidez') ||
      (normNome.includes('margem') && m.categoria === 'margem') ||
      (normNome.includes('recebimento') && m.categoria === 'inadimplencia') ||
      (normNome.includes('pmr') && m.categoria === 'inadimplencia') ||
      (normNome.includes('endividamento') && m.categoria === 'endividamento') ||
      (normNome.includes('estoque') && m.categoria === 'ciclo_financeiro') ||
      (normNome.includes('pme') && m.categoria === 'ciclo_financeiro') ||
      (normNome.includes('pmp') && m.categoria === 'ciclo_financeiro') ||
      (normNome.includes('otif') && m.categoria === 'operacional_otif') ||
      (normNome.includes('turnover') && m.categoria === 'turnover_equipe')
    )
  })

  if (correspondentes.length > 0) {
    return correspondentes
  }

  // Se não encontrar específico, retorna os mais populares (liquidez e margem)
  return CATALOGO_MODELOS_PLANOS.slice(0, 3)
}
