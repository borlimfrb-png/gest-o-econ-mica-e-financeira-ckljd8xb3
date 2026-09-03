/**
 * Estrutura e definições do Modelo Contábil Padrão para empresas brasileiras
 * (especialmente empresas de serviços, consultoria e comércio).
 *
 * Contempla:
 * - Ativo Circulante (Caixa, Bancos, Aplicações, Clientes, Estoques)
 * - Ativo Não Circulante (Imobilizado, Intangível, Investimentos)
 * - Passivo Circulante (Fornecedores, Obrigações Trabalhistas, Obrigações Fiscais, Empréstimos CP)
 * - Passivo Não Circulante (Empréstimos LP)
 * - Patrimônio Líquido (Capital Social, Reservas, Lucros Acumulados)
 * - Receitas (Prestação de Serviços, Vendas de Produtos, Receitas Financeiras)
 * - Custos (Custos dos Serviços Prestados, Custos de Mercadorias)
 * - Despesas (Administrativas, Comerciais, Pessoal, Financeiras, Tributárias)
 */

import type { TipoConta, TipoCentro } from '@/types/finance'

export interface ItemModeloPadrao {
  contaNome: string
  contaTipo: TipoConta
  contaGrupo: string
  centroNome: string
  centroTipo: TipoCentro
  tipoDespesaNome?: string
  descricao?: string
  codigoSugerido?: string // ex: '1.1.01', útil para visualização e ordenação contábil
}

export const MODELO_PLANO_CONTAS_PADRAO: ItemModeloPadrao[] = [
  // ==========================================
  // 1. ATIVO
  // ==========================================
  {
    codigoSugerido: '1.1.01',
    contaNome: 'Caixa Geral',
    contaTipo: 'Ativo',
    contaGrupo: 'Ativo Circulante',
    centroNome: 'Disponibilidades',
    centroTipo: 'Receita',
    descricao: 'Numerário em espécie em poder da empresa',
  },
  {
    codigoSugerido: '1.1.02',
    contaNome: 'Bancos Conta Movimento',
    contaTipo: 'Ativo',
    contaGrupo: 'Ativo Circulante',
    centroNome: 'Disponibilidades',
    centroTipo: 'Receita',
    descricao: 'Contas correntes bancárias operacionais',
  },
  {
    codigoSugerido: '1.1.03',
    contaNome: 'Aplicações Financeiras de Curto Prazo',
    contaTipo: 'Ativo',
    contaGrupo: 'Ativo Circulante',
    centroNome: 'Disponibilidades',
    centroTipo: 'Receita',
    descricao: 'Aplicações de liquidez imediata (CDB, DI)',
  },
  {
    codigoSugerido: '1.1.04',
    contaNome: 'Clientes / Contas a Receber',
    contaTipo: 'Ativo',
    contaGrupo: 'Ativo Circulante',
    centroNome: 'Operações Comerciais',
    centroTipo: 'Receita',
    descricao: 'Faturas e recebíveis de serviços e produtos',
  },
  {
    codigoSugerido: '1.1.05',
    contaNome: 'Adiantamentos a Fornecedores',
    contaTipo: 'Ativo',
    contaGrupo: 'Ativo Circulante',
    centroNome: 'Operações Administrativas',
    centroTipo: 'Despesa',
    descricao: 'Valores antecipados para contratação de serviços ou compras',
  },
  {
    codigoSugerido: '1.1.06',
    contaNome: 'Impostos a Recuperar (ISS/PIS/COFINS/IRRF)',
    contaTipo: 'Ativo',
    contaGrupo: 'Ativo Circulante',
    centroNome: 'Tributário / Fiscal',
    centroTipo: 'Despesa',
    descricao: 'Tributos retidos na fonte e créditos tributários a compensar',
  },
  {
    codigoSugerido: '1.1.07',
    contaNome: 'Estoques de Materiais / Insumos',
    contaTipo: 'Ativo',
    contaGrupo: 'Ativo Circulante',
    centroNome: 'Operações Gerais',
    centroTipo: 'Despesa',
    descricao: 'Materiais de escritório, informática e insumos operacionais',
  },
  {
    codigoSugerido: '1.2.01',
    contaNome: 'Imobilizado - Móveis e Utensílios',
    contaTipo: 'Ativo',
    contaGrupo: 'Ativo Não Circulante',
    centroNome: 'Infraestrutura e Patrimônio',
    centroTipo: 'Despesa',
    tipoDespesaNome: 'Investimentos',
    descricao: 'Móveis, mesas, cadeiras e infraestrutura física',
  },
  {
    codigoSugerido: '1.2.02',
    contaNome: 'Imobilizado - Equipamentos e Computadores',
    contaTipo: 'Ativo',
    contaGrupo: 'Ativo Não Circulante',
    centroNome: 'Infraestrutura e Patrimônio',
    centroTipo: 'Despesa',
    tipoDespesaNome: 'Investimentos',
    descricao: 'Laptops, servidores, roteadores e periféricos de TI',
  },
  {
    codigoSugerido: '1.2.03',
    contaNome: 'Intangível - Softwares e Licenças',
    contaTipo: 'Ativo',
    contaGrupo: 'Ativo Não Circulante',
    centroNome: 'Infraestrutura e Patrimônio',
    centroTipo: 'Despesa',
    tipoDespesaNome: 'Investimentos',
    descricao: 'Licenças de uso permanente, marcas e plataformas',
  },

  // ==========================================
  // 2. PASSIVO
  // ==========================================
  {
    codigoSugerido: '2.1.01',
    contaNome: 'Fornecedores Nacionais',
    contaTipo: 'Passivo',
    contaGrupo: 'Passivo Circulante',
    centroNome: 'Operações Gerais',
    centroTipo: 'Despesa',
    descricao: 'Duplicatas e contas a pagar a fornecedores',
  },
  {
    codigoSugerido: '2.1.02',
    contaNome: 'Salários e Ordenados a Pagar',
    contaTipo: 'Passivo',
    contaGrupo: 'Passivo Circulante',
    centroNome: 'Recursos Humanos',
    centroTipo: 'Despesa',
    tipoDespesaNome: 'Despesas Fixas',
    descricao: 'Folha de pagamento mensal de colaboradores',
  },
  {
    codigoSugerido: '2.1.03',
    contaNome: 'Encargos Sociais a Recolher (INSS / FGTS)',
    contaTipo: 'Passivo',
    contaGrupo: 'Passivo Circulante',
    centroNome: 'Recursos Humanos',
    centroTipo: 'Despesa',
    tipoDespesaNome: 'Despesas Fixas',
    descricao: 'Guias de recolhimento de INSS e FGTS da folha',
  },
  {
    codigoSugerido: '2.1.04',
    contaNome: 'Obrigações Fiscais (Simples / ISS / PIS / COFINS)',
    contaTipo: 'Passivo',
    contaGrupo: 'Passivo Circulante',
    centroNome: 'Tributário / Fiscal',
    centroTipo: 'Despesa',
    tipoDespesaNome: 'Despesas Variáveis',
    descricao: 'Impostos sobre faturamento e serviços a pagar',
  },
  {
    codigoSugerido: '2.1.05',
    contaNome: 'Empréstimos e Financiamentos de Curto Prazo',
    contaTipo: 'Passivo',
    contaGrupo: 'Passivo Circulante',
    centroNome: 'Operações Financeiras',
    centroTipo: 'Despesa',
    tipoDespesaNome: 'Despesas Financeiras',
    descricao: 'Parcelas com vencimento em até 12 meses',
  },
  {
    codigoSugerido: '2.1.06',
    contaNome: 'Contas a Pagar - Concessionárias e Serviços',
    contaTipo: 'Passivo',
    contaGrupo: 'Passivo Circulante',
    centroNome: 'Operações Administrativas',
    centroTipo: 'Despesa',
    tipoDespesaNome: 'Despesas Fixas',
    descricao: 'Água, luz, internet, telefonia e condomínio',
  },
  {
    codigoSugerido: '2.2.01',
    contaNome: 'Empréstimos e Financiamentos de Longo Prazo',
    contaTipo: 'Passivo',
    contaGrupo: 'Passivo Não Circulante',
    centroNome: 'Operações Financeiras',
    centroTipo: 'Despesa',
    tipoDespesaNome: 'Despesas Financeiras',
    descricao: 'Linhas de crédito com vencimento superior a 1 ano',
  },

  // ==========================================
  // 3. PATRIMÔNIO LÍQUIDO
  // ==========================================
  {
    codigoSugerido: '3.1.01',
    contaNome: 'Capital Social Subscrito',
    contaTipo: 'Patrimônio Líquido',
    contaGrupo: 'Capital Social',
    centroNome: 'Societário / Diretoria',
    centroTipo: 'Receita',
    descricao: 'Capital registrado no contrato social',
  },
  {
    codigoSugerido: '3.1.02',
    contaNome: 'Reservas de Lucros',
    contaTipo: 'Patrimônio Líquido',
    contaGrupo: 'Reservas de Lucros',
    centroNome: 'Societário / Diretoria',
    centroTipo: 'Receita',
    descricao: 'Reservas constituídas por lucros retidos',
  },
  {
    codigoSugerido: '3.1.03',
    contaNome: 'Lucros ou Prejuízos Acumulados',
    contaTipo: 'Patrimônio Líquido',
    contaGrupo: 'Lucros ou Prejuízos Acumulados',
    centroNome: 'Societário / Diretoria',
    centroTipo: 'Receita',
    descricao: 'Saldos acumulados de exercícios anteriores e em apuração',
  },

  // ==========================================
  // 4. RECEITAS
  // ==========================================
  {
    codigoSugerido: '4.1.01',
    contaNome: 'Receita de Serviços de Consultoria e Assessoria',
    contaTipo: 'Receita',
    contaGrupo: 'Receita de Prestação de Serviços',
    centroNome: 'Serviços de Consultoria',
    centroTipo: 'Receita',
    tipoDespesaNome: 'Receitas',
    descricao: 'Faturamento bruto com projetos e contratos de consultoria',
  },
  {
    codigoSugerido: '4.1.02',
    contaNome: 'Receita de Honorários Mensais / Retainer',
    contaTipo: 'Receita',
    contaGrupo: 'Receita de Prestação de Serviços',
    centroNome: 'Serviços de Consultoria',
    centroTipo: 'Receita',
    tipoDespesaNome: 'Receitas',
    descricao: 'Contratos de recorrência mensal com clientes',
  },
  {
    codigoSugerido: '4.1.03',
    contaNome: 'Receita com Treinamentos e Workshops',
    contaTipo: 'Receita',
    contaGrupo: 'Receita de Prestação de Serviços',
    centroNome: 'Educação Corporativa',
    centroTipo: 'Receita',
    tipoDespesaNome: 'Receitas',
    descricao: 'Cursos, palestras e capacitações corporativas',
  },
  {
    codigoSugerido: '4.1.04',
    contaNome: 'Receitas Financeiras (Rendimentos e Juros Ativos)',
    contaTipo: 'Receita',
    contaGrupo: 'Receitas Financeiras',
    centroNome: 'Operações Financeiras',
    centroTipo: 'Receita',
    tipoDespesaNome: 'Receitas',
    descricao: 'Rendimento de aplicações e descontos obtidos',
  },
  {
    codigoSugerido: '4.1.05',
    contaNome: '(-) Deduções da Receita Bruta (Impostos s/ Serviços)',
    contaTipo: 'Receita',
    contaGrupo: 'Deduções da Receita Bruta',
    centroNome: 'Tributário / Fiscal',
    centroTipo: 'Despesa',
    tipoDespesaNome: 'Despesas Variáveis',
    descricao: 'Deduções legais: ISS, PIS, COFINS ou Simples Nacional faturado',
  },

  // ==========================================
  // 5. CUSTOS E DESPESAS
  // ==========================================
  {
    codigoSugerido: '5.1.01',
    contaNome: 'Custos com Consultores PJ e Terceiros',
    contaTipo: 'Despesa',
    contaGrupo: 'Custos dos Produtos/Serviços Vendidos (CPV/CSV)',
    centroNome: 'Serviços de Consultoria',
    centroTipo: 'Despesa',
    tipoDespesaNome: 'Despesas Variáveis',
    descricao: 'Remuneração direta de consultores alocados em projetos',
  },
  {
    codigoSugerido: '5.1.02',
    contaNome: 'Despesas com Viagens e Estadias de Projetos',
    contaTipo: 'Despesa',
    contaGrupo: 'Custos dos Produtos/Serviços Vendidos (CPV/CSV)',
    centroNome: 'Serviços de Consultoria',
    centroTipo: 'Despesa',
    tipoDespesaNome: 'Despesas Variáveis',
    descricao: 'Passagens, hospedagem e deslocamentos reembolsáveis de consultoria',
  },
  {
    codigoSugerido: '5.2.01',
    contaNome: 'Pró-Labore da Diretoria e Sócios',
    contaTipo: 'Despesa',
    contaGrupo: 'Despesas Administrativas',
    centroNome: 'Societário / Diretoria',
    centroTipo: 'Despesa',
    tipoDespesaNome: 'Despesas Fixas',
    descricao: 'Retirada mensal formal dos sócios administradores',
  },
  {
    codigoSugerido: '5.2.02',
    contaNome: 'Salários e Encargos da Equipe Administrativa',
    contaTipo: 'Despesa',
    contaGrupo: 'Despesas com Pessoal',
    centroNome: 'Recursos Humanos',
    centroTipo: 'Despesa',
    tipoDespesaNome: 'Despesas Fixas',
    descricao: 'Folha, 13º salário, férias, INSS e FGTS da administração',
  },
  {
    codigoSugerido: '5.2.03',
    contaNome: 'Benefícios a Colaboradores (VR/VT/Saúde)',
    contaTipo: 'Despesa',
    contaGrupo: 'Despesas com Pessoal',
    centroNome: 'Recursos Humanos',
    centroTipo: 'Despesa',
    tipoDespesaNome: 'Despesas Fixas',
    descricao: 'Vale refeição, transporte, plano de saúde e odontológico',
  },
  {
    codigoSugerido: '5.2.04',
    contaNome: 'Aluguel, Condomínio e IPTU',
    contaTipo: 'Despesa',
    contaGrupo: 'Despesas Administrativas',
    centroNome: 'Operações Administrativas',
    centroTipo: 'Despesa',
    tipoDespesaNome: 'Despesas Fixas',
    descricao: 'Locação do escritório comercial e taxas condominiais',
  },
  {
    codigoSugerido: '5.2.05',
    contaNome: 'Serviços de Terceiros - Contabilidade e Jurídico',
    contaTipo: 'Despesa',
    contaGrupo: 'Despesas Administrativas',
    centroNome: 'Operações Administrativas',
    centroTipo: 'Despesa',
    tipoDespesaNome: 'Despesas Fixas',
    descricao: 'Honorários contábeis, advocatícios e auditoria externa',
  },
  {
    codigoSugerido: '5.2.06',
    contaNome: 'Softwares em Nuvem, SaaS e Licenças de TI',
    contaTipo: 'Despesa',
    contaGrupo: 'Despesas Administrativas',
    centroNome: 'Tecnologia da Informação',
    centroTipo: 'Despesa',
    tipoDespesaNome: 'Despesas Fixas',
    descricao: 'Assinaturas de ERP, CRM, e-mail corporativo, nuvem e ferramentas',
  },
  {
    codigoSugerido: '5.2.07',
    contaNome: 'Marketing, Anúncios e Comercial',
    contaTipo: 'Despesa',
    contaGrupo: 'Despesas Comerciais / Vendas',
    centroNome: 'Marketing e Vendas',
    centroTipo: 'Despesa',
    tipoDespesaNome: 'Despesas Variáveis',
    descricao: 'Campanhas de marketing digital, eventos comerciais e comissões',
  },
  {
    codigoSugerido: '5.2.08',
    contaNome: 'Despesas Bancárias, Tarifas e Juros Passivos',
    contaTipo: 'Despesa',
    contaGrupo: 'Despesas Financeiras',
    centroNome: 'Operações Financeiras',
    centroTipo: 'Despesa',
    tipoDespesaNome: 'Despesas Financeiras',
    descricao: 'Tarifas de manutenção de conta, taxas de boleto e juros de mora',
  },
]
