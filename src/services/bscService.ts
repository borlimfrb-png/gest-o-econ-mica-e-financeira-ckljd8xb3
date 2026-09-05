import pb from '@/lib/pocketbase/client'
import type { BscKpiRecord, BscPerspectiva, BscSentido } from '@/types/finance'

export interface SalvarBscKpiInput {
  empresa?: string
  ano: number
  perspectiva: BscPerspectiva
  nome: string
  descricao?: string
  unidade?: string
  meta: number
  valor_atual?: number
  tipo: 'auto' | 'manual'
  formula?: string
  peso?: number
  sentido: BscSentido
  ordem?: number
}

export interface ModeloBscPadraoItem {
  perspectiva: BscPerspectiva
  nome: string
  descricao: string
  unidade: string
  meta: number
  valor_atual?: number
  tipo: 'auto' | 'manual'
  formula?: string
  peso: number
  sentido: BscSentido
  ordem: number
}

export const MODELO_SUGERIDO_BSC: ModeloBscPadraoItem[] = [
  // 1. Perspectiva Financeira (Cálculos automáticos de Balanço / DRE)
  {
    perspectiva: 'financeira',
    nome: 'Liquidez Corrente',
    descricao:
      'Capacidade de honrar obrigações de curto prazo (Ativo Circulante ÷ Passivo Circulante)',
    unidade: 'índice',
    meta: 1.5,
    tipo: 'auto',
    formula: 'liquidez_corrente',
    peso: 15,
    sentido: 'maior_melhor',
    ordem: 1,
  },
  {
    perspectiva: 'financeira',
    nome: 'Liquidez Seca',
    descricao:
      'Liquidez desconsiderando estoques ((Ativo Circulante - Estoques) ÷ Passivo Circulante)',
    unidade: 'índice',
    meta: 1.2,
    tipo: 'auto',
    formula: 'liquidez_seca',
    peso: 10,
    sentido: 'maior_melhor',
    ordem: 2,
  },
  {
    perspectiva: 'financeira',
    nome: 'Endividamento Geral',
    descricao: 'Participação do capital de terceiros no financiamento do ativo total (%)',
    unidade: '%',
    meta: 50.0,
    tipo: 'auto',
    formula: 'endividamento_geral',
    peso: 15,
    sentido: 'menor_melhor',
    ordem: 3,
  },
  {
    perspectiva: 'financeira',
    nome: 'Margem Bruta',
    descricao: 'Rentabilidade bruta sobre a receita líquida (Lucro Bruto ÷ Receita Líquida)',
    unidade: '%',
    meta: 35.0,
    tipo: 'auto',
    formula: 'margem_bruta',
    peso: 15,
    sentido: 'maior_melhor',
    ordem: 4,
  },
  {
    perspectiva: 'financeira',
    nome: 'Margem Líquida',
    descricao: 'Eficiência final de conversão da receita em lucro líquido (%)',
    unidade: '%',
    meta: 12.0,
    tipo: 'auto',
    formula: 'margem_liquida',
    peso: 15,
    sentido: 'maior_melhor',
    ordem: 5,
  },
  {
    perspectiva: 'financeira',
    nome: 'Retorno s/ Patrimônio Líquido (ROE)',
    descricao: 'Remuneração do capital próprio investido pelos acionistas (%)',
    unidade: '%',
    meta: 18.0,
    tipo: 'auto',
    formula: 'roe',
    peso: 15,
    sentido: 'maior_melhor',
    ordem: 6,
  },
  {
    perspectiva: 'financeira',
    nome: 'Retorno s/ Ativo Total (ROA)',
    descricao: 'Rentabilidade do lucro líquido gerado pela totalidade dos ativos da empresa (%)',
    unidade: '%',
    meta: 10.0,
    tipo: 'auto',
    formula: 'roa',
    peso: 10,
    sentido: 'maior_melhor',
    ordem: 7,
  },
  {
    perspectiva: 'financeira',
    nome: 'EBITDA (LAJIDA)',
    descricao: 'Geração de caixa operacional antes de juros, impostos, depreciação e amortização',
    unidade: 'R$',
    meta: 500000,
    tipo: 'auto',
    formula: 'ebitda',
    peso: 5,
    sentido: 'maior_melhor',
    ordem: 8,
  },

  // 2. Perspectiva Clientes
  {
    perspectiva: 'clientes',
    nome: 'Crescimento da Receita (Ano x Ano Anterior)',
    descricao:
      'Variação percentual da receita líquida em relação ao exercício anterior apurado na DRE',
    unidade: '%',
    meta: 15.0,
    tipo: 'auto',
    formula: 'crescimento_receita',
    peso: 30,
    sentido: 'maior_melhor',
    ordem: 1,
  },
  {
    perspectiva: 'clientes',
    nome: 'Satisfação dos Clientes (NPS)',
    descricao: 'Net Promoter Score medido trimestralmente na base ativa de clientes',
    unidade: 'pts',
    meta: 75.0,
    valor_atual: 70.0,
    tipo: 'manual',
    peso: 25,
    sentido: 'maior_melhor',
    ordem: 2,
  },
  {
    perspectiva: 'clientes',
    nome: 'Taxa de Retenção de Clientes',
    descricao: 'Percentual de clientes mantidos ativos no período analisado',
    unidade: '%',
    meta: 92.0,
    valor_atual: 88.5,
    tipo: 'manual',
    peso: 25,
    sentido: 'maior_melhor',
    ordem: 3,
  },
  {
    perspectiva: 'clientes',
    nome: 'Novos Clientes Conquistados',
    descricao: 'Quantidade de novos clientes ativos cadastrados e faturados no ano',
    unidade: 'un',
    meta: 30,
    valor_atual: 22,
    tipo: 'manual',
    peso: 20,
    sentido: 'maior_melhor',
    ordem: 4,
  },

  // 3. Perspectiva Processos Internos
  {
    perspectiva: 'processos_internos',
    nome: 'Prazo Médio de Recebimento (PMR)',
    descricao: 'Tempo médio em dias para conversão das vendas em recebimento financeiro',
    unidade: 'dias',
    meta: 45,
    tipo: 'auto',
    formula: 'pmr',
    peso: 25,
    sentido: 'menor_melhor',
    ordem: 1,
  },
  {
    perspectiva: 'processos_internos',
    nome: 'Prazo Médio de Pagamento (PMP)',
    descricao: 'Tempo médio em dias concedido por fornecedores para quitação de insumos e compras',
    unidade: 'dias',
    meta: 40,
    tipo: 'auto',
    formula: 'pmp',
    peso: 20,
    sentido: 'maior_melhor',
    ordem: 2,
  },
  {
    perspectiva: 'processos_internos',
    nome: 'Prazo Médio de Renovação de Estoques (PME)',
    descricao: 'Giro médio de estoques em dias entre estocagem e venda aos clientes',
    unidade: 'dias',
    meta: 60,
    tipo: 'auto',
    formula: 'pme',
    peso: 20,
    sentido: 'menor_melhor',
    ordem: 3,
  },
  {
    perspectiva: 'processos_internos',
    nome: 'Índice de Pontualidade na Entrega (OTIF)',
    descricao:
      'Percentual de entregas realizadas no prazo e com documentação/especificação correta',
    unidade: '%',
    meta: 95.0,
    valor_atual: 92.0,
    tipo: 'manual',
    peso: 20,
    sentido: 'maior_melhor',
    ordem: 4,
  },
  {
    perspectiva: 'processos_internos',
    nome: 'Taxa de Retrabalho / Não-Conformidade',
    descricao: 'Percentual de pedidos ou processos que precisaram de correção ou devolução',
    unidade: '%',
    meta: 2.0,
    valor_atual: 2.8,
    tipo: 'manual',
    peso: 15,
    sentido: 'menor_melhor',
    ordem: 5,
  },

  // 4. Perspectiva Aprendizado e Crescimento
  {
    perspectiva: 'aprendizado_crescimento',
    nome: 'Horas de Capacitação e Treinamento por Colaborador',
    descricao: 'Média de horas dedicadas à formação técnica, liderança e gestão no ano',
    unidade: 'horas',
    meta: 40,
    valor_atual: 32,
    tipo: 'manual',
    peso: 30,
    sentido: 'maior_melhor',
    ordem: 1,
  },
  {
    perspectiva: 'aprendizado_crescimento',
    nome: 'Taxa de Turnover (Rotatividade de Pessoal)',
    descricao: 'Rotatividade anual de colaboradores da empresa (%)',
    unidade: '%',
    meta: 8.0,
    valor_atual: 7.2,
    tipo: 'manual',
    peso: 25,
    sentido: 'menor_melhor',
    ordem: 2,
  },
  {
    perspectiva: 'aprendizado_crescimento',
    nome: 'Investimento em Inovação, TI e Ferramentas',
    descricao: 'Percentual da receita ou orçamento alocado em modernização de sistemas e automação',
    unidade: '%',
    meta: 3.5,
    valor_atual: 3.1,
    tipo: 'manual',
    peso: 25,
    sentido: 'maior_melhor',
    ordem: 3,
  },
  {
    perspectiva: 'aprendizado_crescimento',
    nome: 'Clima Organizacional / Satisfação da Equipe',
    descricao: 'Índice de engajamento apurado na pesquisa de clima interna (%)',
    unidade: '%',
    meta: 85.0,
    valor_atual: 82.0,
    tipo: 'manual',
    peso: 20,
    sentido: 'maior_melhor',
    ordem: 4,
  },
]

export const bscService = {
  /**
   * Lista todos os KPIs do BSC para uma empresa e ano específicos.
   * Suporta identificador de grupo empresarial (ex: 'grupo-xxx') agrupando os KPIs pela chave consolidada.
   */
  async getByEmpresaEAno(empresaId: string, ano: number): Promise<BscKpiRecord[]> {
    if (!empresaId) return []

    // Filtro PocketBase
    const filter = `empresa = '${empresaId}' && ano = ${ano}`
    return await pb.collection('bsc_kpis').getFullList<BscKpiRecord>({
      filter,
      sort: 'perspectiva,ordem,created',
    })
  },

  async create(data: SalvarBscKpiInput): Promise<BscKpiRecord> {
    const userId = pb.authStore.record?.id
    return await pb.collection('bsc_kpis').create<BscKpiRecord>({
      ...data,
      usuario: userId || undefined,
    } as any)
  },

  async update(id: string, data: Partial<SalvarBscKpiInput>): Promise<BscKpiRecord> {
    return await pb.collection('bsc_kpis').update<BscKpiRecord>(id, data as any)
  },

  async delete(id: string): Promise<boolean> {
    return await pb.collection('bsc_kpis').delete(id)
  },

  /**
   * Semeia o modelo sugerido de KPIs para uma determinada empresa e ano
   */
  async carregarModeloPadrao(empresaId: string, ano: number): Promise<BscKpiRecord[]> {
    const userId = pb.authStore.record?.id
    const criados: BscKpiRecord[] = []

    for (const item of MODELO_SUGERIDO_BSC) {
      const record = await pb.collection('bsc_kpis').create<BscKpiRecord>({
        usuario: userId || undefined,
        empresa: empresaId,
        ano,
        perspectiva: item.perspectiva,
        nome: item.nome,
        descricao: item.descricao,
        unidade: item.unidade,
        meta: item.meta,
        valor_atual: item.valor_atual ?? 0,
        tipo: item.tipo,
        formula: item.formula || '',
        peso: item.peso,
        sentido: item.sentido,
        ordem: item.ordem,
      } as any)
      criados.push(record)
    }

    return criados
  },
}
