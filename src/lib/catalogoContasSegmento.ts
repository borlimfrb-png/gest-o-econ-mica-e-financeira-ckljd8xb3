import type { SegmentoEmpresa, TipoConta, TipoCentro } from '@/types/finance'
import { MODELO_PLANO_CONTAS_PADRAO, type ItemModeloPadrao } from '@/lib/planoContasPadrao'

export interface ContaRecomendadaSegmento extends ItemModeloPadrao {
  segmentosRelevantes: (SegmentoEmpresa | 'Todos')[]
  motivoRecomendacao: string
  prioridade?: 'alta' | 'media' | 'padrao'
}

/**
 * Contas especializadas por segmento da empresa brasileira.
 * Estas contas somam-se ao MODELO_PLANO_CONTAS_PADRAO para que o assistente
 * possa sugerir contas faltantes de alta aderência ao nicho de mercado.
 */
export const CONTAS_ESPECIALIZADAS_SEGMENTO: ContaRecomendadaSegmento[] = [
  // ==========================================
  // COMÉRCIO / VAREJO / E-COMMERCE
  // ==========================================
  {
    codigoSugerido: '1.1.08',
    contaNome: 'Estoques de Mercadorias para Revenda',
    contaTipo: 'Ativo',
    contaGrupo: 'Estoques',
    centroNome: 'Operações Comerciais',
    centroTipo: 'Despesa',
    segmentosRelevantes: ['Comércio'],
    motivoRecomendacao:
      'Essencial para apuração do custo das mercadorias vendidas (CMV) e inventário.',
    prioridade: 'alta',
    descricao: 'Produtos acabados prontos para comercialização',
  },
  {
    codigoSugerido: '1.1.09',
    contaNome: 'Créditos de ICMS a Recuperar',
    contaTipo: 'Ativo',
    contaGrupo: 'Tributos a Recuperar',
    centroNome: 'Tributário / Fiscal',
    centroTipo: 'Despesa',
    segmentosRelevantes: ['Comércio', 'Indústria'],
    motivoRecomendacao:
      'Crédito tributário decorrente de compras de mercadorias no regime não-cumulativo.',
    prioridade: 'alta',
    descricao: 'ICMS destacado em notas fiscais de entrada',
  },
  {
    codigoSugerido: '4.1.06',
    contaNome: 'Receita de Venda de Mercadorias (Varejo / Atacado)',
    contaTipo: 'Receita',
    contaGrupo: 'Receita Bruta de Vendas',
    centroNome: 'Operações Comerciais',
    centroTipo: 'Receita',
    segmentosRelevantes: ['Comércio'],
    motivoRecomendacao: 'Conta primária de faturamento do comércio.',
    prioridade: 'alta',
    descricao: 'Vendas balcão, e-commerce e faturadas a clientes',
  },
  {
    codigoSugerido: '5.1.03',
    contaNome: 'Custo das Mercadorias Vendidas (CMV)',
    contaTipo: 'Despesa',
    contaGrupo: 'Custos dos Produtos/Serviços Vendidos (CPV/CSV)',
    centroNome: 'Operações Comerciais',
    centroTipo: 'Despesa',
    tipoDespesaNome: 'Custos Diretos',
    segmentosRelevantes: ['Comércio'],
    motivoRecomendacao: 'Registro direto do custo de aquisição dos itens comercializados.',
    prioridade: 'alta',
    descricao: 'Custo de reposição/baixa de estoque de revenda',
  },
  {
    codigoSugerido: '5.2.09',
    contaNome: 'Taxas de Cartão de Crédito e Meios de Pagamento',
    contaTipo: 'Despesa',
    contaGrupo: 'Despesas Comerciais / Vendas',
    centroNome: 'Marketing e Vendas',
    centroTipo: 'Despesa',
    tipoDespesaNome: 'Despesas Variáveis',
    segmentosRelevantes: ['Comércio', 'Serviços'],
    motivoRecomendacao: 'MDR e taxas de adquirentes (Cielo, Stone, Rede, PagSeguro).',
    prioridade: 'alta',
    descricao: 'Comissões de cartões e gateways de checkout',
  },
  {
    codigoSugerido: '5.2.10',
    contaNome: 'Fretes e Entregas sobre Vendas',
    contaTipo: 'Despesa',
    contaGrupo: 'Despesas Comerciais / Vendas',
    centroNome: 'Logística e Expedição',
    centroTipo: 'Despesa',
    tipoDespesaNome: 'Despesas Variáveis',
    segmentosRelevantes: ['Comércio', 'Indústria'],
    motivoRecomendacao: 'Logística de entrega a clientes, correios e transportadoras.',
    prioridade: 'media',
    descricao: 'Frete FOB/CIF pago a transportadoras e motoboys',
  },

  // ==========================================
  // INDÚSTRIA / MANUFATURA
  // ==========================================
  {
    codigoSugerido: '1.1.10',
    contaNome: 'Estoques de Matéria-Prima e Embalagens',
    contaTipo: 'Ativo',
    contaGrupo: 'Estoques',
    centroNome: 'Fábrica / Produção',
    centroTipo: 'Despesa',
    segmentosRelevantes: ['Indústria'],
    motivoRecomendacao:
      'Controle contábil de matérias-primas e insumos antes do processo produtivo.',
    prioridade: 'alta',
    descricao: 'Insumos básicos para linha fabril',
  },
  {
    codigoSugerido: '1.1.11',
    contaNome: 'Estoques de Produtos em Elaboração (WIP)',
    contaTipo: 'Ativo',
    contaGrupo: 'Estoques',
    centroNome: 'Fábrica / Produção',
    centroTipo: 'Despesa',
    segmentosRelevantes: ['Indústria', 'Construção'],
    motivoRecomendacao: 'Apuração do custo dos produtos ainda no ciclo de produção.',
    prioridade: 'alta',
    descricao: 'Custos apropriados a lotes em fabricação',
  },
  {
    codigoSugerido: '1.1.12',
    contaNome: 'Créditos de IPI a Recuperar',
    contaTipo: 'Ativo',
    contaGrupo: 'Tributos a Recuperar',
    centroNome: 'Tributário / Fiscal',
    centroTipo: 'Despesa',
    segmentosRelevantes: ['Indústria'],
    motivoRecomendacao: 'IPI compensável em compras industriais.',
    prioridade: 'alta',
    descricao: 'IPI de compras de insumos industriais',
  },
  {
    codigoSugerido: '1.2.04',
    contaNome: 'Imobilizado - Máquinas, Tornos e Equipamentos Fabris',
    contaTipo: 'Ativo',
    contaGrupo: 'Ativo Não Circulante',
    centroNome: 'Fábrica / Produção',
    centroTipo: 'Despesa',
    segmentosRelevantes: ['Indústria'],
    motivoRecomendacao: 'Ativos industriais depreciáveis do parque fabril.',
    prioridade: 'alta',
    descricao: 'Máquinas industriais e linhas automáticas',
  },
  {
    codigoSugerido: '4.1.07',
    contaNome: 'Receita de Venda de Produção Própria',
    contaTipo: 'Receita',
    contaGrupo: 'Receita Bruta de Vendas',
    centroNome: 'Fábrica / Produção',
    centroTipo: 'Receita',
    segmentosRelevantes: ['Indústria'],
    motivoRecomendacao: 'Faturamento de manufatura industrial.',
    prioridade: 'alta',
    descricao: 'Faturamento de produtos industrializados',
  },
  {
    codigoSugerido: '5.1.04',
    contaNome: 'Custo dos Produtos Vendidos (CPV - Insumos e Mão de Obra Direta)',
    contaTipo: 'Despesa',
    contaGrupo: 'Custos dos Produtos/Serviços Vendidos (CPV/CSV)',
    centroNome: 'Fábrica / Produção',
    centroTipo: 'Despesa',
    tipoDespesaNome: 'Custos Diretos',
    segmentosRelevantes: ['Indústria'],
    motivoRecomendacao:
      'Apropriação fabril de insumos, energia industrial e mão de obra operacional.',
    prioridade: 'alta',
    descricao: 'Custo fabril industrial completo',
  },
  {
    codigoSugerido: '5.2.11',
    contaNome: 'Manutenção de Máquinas e Equipamentos Fabris',
    contaTipo: 'Despesa',
    contaGrupo: 'Custos dos Produtos/Serviços Vendidos (CPV/CSV)',
    centroNome: 'Fábrica / Produção',
    centroTipo: 'Despesa',
    tipoDespesaNome: 'Manutenção',
    segmentosRelevantes: ['Indústria'],
    motivoRecomendacao: 'Manutenção preventiva e corretiva do maquinário.',
    prioridade: 'media',
    descricao: 'Peças de reposição e assistência técnica industrial',
  },

  // ==========================================
  // TECNOLOGIA / SOFTWARE / SAAS
  // ==========================================
  {
    codigoSugerido: '1.2.05',
    contaNome: 'Intangível - Softwares Desenvolvidos Internamente',
    contaTipo: 'Ativo',
    contaGrupo: 'Ativo Não Circulante',
    centroNome: 'Pesquisa e Desenvolvimento (P&D)',
    centroTipo: 'Despesa',
    segmentosRelevantes: ['Tecnologia'],
    motivoRecomendacao:
      'Capitalização de software próprio conforme normas contábeis brasileiras (CPC 04).',
    prioridade: 'alta',
    descricao: 'Ativo intangível de sistemas e produtos proprietários',
  },
  {
    codigoSugerido: '4.1.08',
    contaNome: 'Receita de Assinaturas de Software (SaaS / Licenciamento)',
    contaTipo: 'Receita',
    contaGrupo: 'Receita de Prestação de Serviços',
    centroNome: 'Produto e Plataforma',
    centroTipo: 'Receita',
    segmentosRelevantes: ['Tecnologia'],
    motivoRecomendacao: 'Receita recorrente (MRR/ARR) típica de empresas de base tecnológica.',
    prioridade: 'alta',
    descricao: 'Mensalidades e anuidades de plataformas',
  },
  {
    codigoSugerido: '4.1.09',
    contaNome: 'Receita de Implementação, Setup e Customização',
    contaTipo: 'Receita',
    contaGrupo: 'Receita de Prestação de Serviços',
    centroNome: 'Sucesso do Cliente / Onboarding',
    centroTipo: 'Receita',
    segmentosRelevantes: ['Tecnologia'],
    motivoRecomendacao: 'Taxas de instalação inicial, onboarding e serviços de integração.',
    prioridade: 'media',
    descricao: 'Setup fee e onboarding de clientes',
  },
  {
    codigoSugerido: '5.1.05',
    contaNome: 'Custos de Infraestrutura em Nuvem (AWS / GCP / Azure)',
    contaTipo: 'Despesa',
    contaGrupo: 'Custos dos Produtos/Serviços Vendidos (CPV/CSV)',
    centroNome: 'Engenharia / DevOps',
    centroTipo: 'Despesa',
    tipoDespesaNome: 'Infraestrutura Cloud',
    segmentosRelevantes: ['Tecnologia'],
    motivoRecomendacao:
      'Servidores, bancos gerenciados e tráfego de dados para sustentar o produto.',
    prioridade: 'alta',
    descricao: 'Faturas de servidores cloud e CDN',
  },
  {
    codigoSugerido: '5.2.12',
    contaNome: 'Remuneração de Desenvolvedores e Engenharia de Software',
    contaTipo: 'Despesa',
    contaGrupo: 'Despesas com Pessoal',
    centroNome: 'Pesquisa e Desenvolvimento (P&D)',
    centroTipo: 'Despesa',
    tipoDespesaNome: 'Equipe de TI',
    segmentosRelevantes: ['Tecnologia'],
    motivoRecomendacao: 'Salários e PJs da equipe central de programação e produto.',
    prioridade: 'alta',
    descricao: 'Folha e honorários de programadores, UX e QA',
  },

  // ==========================================
  // CONSTRUÇÃO CIVIL E ENGENHARIA
  // ==========================================
  {
    codigoSugerido: '1.1.13',
    contaNome: 'Estoques de Obras em Andamento / Imóveis em Construção',
    contaTipo: 'Ativo',
    contaGrupo: 'Estoques',
    centroNome: 'Obras e Engenharia',
    centroTipo: 'Despesa',
    segmentosRelevantes: ['Construção'],
    motivoRecomendacao: 'Acumulação de custos por obra (POC - percentual de conclusão).',
    prioridade: 'alta',
    descricao: 'Custos alocados a canteiros de obras',
  },
  {
    codigoSugerido: '4.1.10',
    contaNome: 'Receita de Empreitadas e Medições de Obras',
    contaTipo: 'Receita',
    contaGrupo: 'Receita de Prestação de Serviços',
    centroNome: 'Obras e Engenharia',
    centroTipo: 'Receita',
    segmentosRelevantes: ['Construção'],
    motivoRecomendacao: 'Faturamento conforme boletim de medição aprovado pelo cliente.',
    prioridade: 'alta',
    descricao: 'Medições e faturamento de contratos civis',
  },
  {
    codigoSugerido: '5.1.06',
    contaNome: 'Custos com Subempreiteiros e Mão de Obra de Obra',
    contaTipo: 'Despesa',
    contaGrupo: 'Custos dos Produtos/Serviços Vendidos (CPV/CSV)',
    centroNome: 'Canteiro de Obras',
    centroTipo: 'Despesa',
    tipoDespesaNome: 'Subempreiteiros',
    segmentosRelevantes: ['Construção'],
    motivoRecomendacao: 'Contratação terceirizada de pedreiros, eletricistas e armadores.',
    prioridade: 'alta',
    descricao: 'Serviços especializados na obra',
  },
  {
    codigoSugerido: '5.2.13',
    contaNome: 'Locação de Andaimes, Caçambas e Máquinas Pesadas',
    contaTipo: 'Despesa',
    contaGrupo: 'Custos dos Produtos/Serviços Vendidos (CPV/CSV)',
    centroNome: 'Canteiro de Obras',
    centroTipo: 'Despesa',
    tipoDespesaNome: 'Locações de Equipamentos',
    segmentosRelevantes: ['Construção'],
    motivoRecomendacao: 'Locações operacionais de betoneiras, guindastes e caçambas de entulho.',
    prioridade: 'alta',
    descricao: 'Aluguel de maquinário para canteiro',
  },

  // ==========================================
  // SAÚDE / CLÍNICAS / HOSPITAIS
  // ==========================================
  {
    codigoSugerido: '1.1.14',
    contaNome: 'Estoques de Medicamentos e Materiais Hospitalares',
    contaTipo: 'Ativo',
    contaGrupo: 'Estoques',
    centroNome: 'Farmácia / Almoxarifado Clínico',
    centroTipo: 'Despesa',
    segmentosRelevantes: ['Saúde'],
    motivoRecomendacao: 'Medicamentos, seringas, reagentes e descartáveis médicos.',
    prioridade: 'alta',
    descricao: 'Materiais cirúrgicos e farmácia interna',
  },
  {
    codigoSugerido: '1.1.15',
    contaNome: 'Convênios Médicos e Operadoras a Receber',
    contaTipo: 'Ativo',
    contaGrupo: 'Ativo Circulante',
    centroNome: 'Faturamento de Convênios',
    centroTipo: 'Receita',
    segmentosRelevantes: ['Saúde'],
    motivoRecomendacao:
      'Faturas e guias TISS entregues e pendentes de repasse por planos de saúde.',
    prioridade: 'alta',
    descricao: 'Glosa e recebíveis de planos de saúde',
  },
  {
    codigoSugerido: '4.1.11',
    contaNome: 'Receita de Consultas, Procedimentos e Exames',
    contaTipo: 'Receita',
    contaGrupo: 'Receita de Prestação de Serviços',
    centroNome: 'Atendimento Clínico',
    centroTipo: 'Receita',
    segmentosRelevantes: ['Saúde'],
    motivoRecomendacao: 'Atendimentos particulares e repasses médicos.',
    prioridade: 'alta',
    descricao: 'Faturamento de procedimentos médicos',
  },
  {
    codigoSugerido: '5.1.07',
    contaNome: 'Repasses a Médicos e Especialistas Credenciados',
    contaTipo: 'Despesa',
    contaGrupo: 'Custos dos Produtos/Serviços Vendidos (CPV/CSV)',
    centroNome: 'Corpo Clínico',
    centroTipo: 'Despesa',
    tipoDespesaNome: 'Honorários Médicos',
    segmentosRelevantes: ['Saúde'],
    motivoRecomendacao: 'Divisão de honorários sobre exames e consultas realizadas.',
    prioridade: 'alta',
    descricao: 'Repasse percentual a profissionais de saúde',
  },
  {
    codigoSugerido: '5.2.14',
    contaNome: 'Descarte de Resíduos Infectantes e Lixo Hospitalar',
    contaTipo: 'Despesa',
    contaGrupo: 'Despesas Administrativas',
    centroNome: 'Segurança e Biossegurança',
    centroTipo: 'Despesa',
    tipoDespesaNome: 'Serviços Regulatórios',
    segmentosRelevantes: ['Saúde'],
    motivoRecomendacao: 'Coleta especializada e incineração de resíduos da saúde.',
    prioridade: 'media',
    descricao: 'Empresas de coleta de lixo químico/infectante',
  },

  // ==========================================
  // AGRONEGÓCIO / AGROPECUÁRIA
  // ==========================================
  {
    codigoSugerido: '1.1.16',
    contaNome: 'Ativos Biológicos - Culturas em Formação / Grãos',
    contaTipo: 'Ativo',
    contaGrupo: 'Ativo Circulante',
    centroNome: 'Lavoura e Campo',
    centroTipo: 'Despesa',
    segmentosRelevantes: ['Agronegócio'],
    motivoRecomendacao: 'Avaliação a valor justo conforme CPC 29 (Ativo Biológico).',
    prioridade: 'alta',
    descricao: 'Culturas temporárias (soja, milho, café)',
  },
  {
    codigoSugerido: '1.2.06',
    contaNome: 'Ativos Biológicos - Rebanho Reprodutor / Florestas',
    contaTipo: 'Ativo',
    contaGrupo: 'Ativo Não Circulante',
    centroNome: 'Pecuária / Florestal',
    centroTipo: 'Despesa',
    segmentosRelevantes: ['Agronegócio'],
    motivoRecomendacao: 'Gado de cria, matrizes e culturas permanentes.',
    prioridade: 'alta',
    descricao: 'Semoventes reprodutores e pastagens formadas',
  },
  {
    codigoSugerido: '4.1.12',
    contaNome: 'Receita de Venda da Safra e Commodities Agrícolas',
    contaTipo: 'Receita',
    contaGrupo: 'Receita Bruta de Vendas',
    centroNome: 'Comercialização Agrícola',
    centroTipo: 'Receita',
    segmentosRelevantes: ['Agronegócio'],
    motivoRecomendacao: 'Comercialização de grãos, café, carne ou leite.',
    prioridade: 'alta',
    descricao: 'Contratos futuros e vendas de safra',
  },
  {
    codigoSugerido: '5.1.08',
    contaNome: 'Custos com Sementes, Fertilizantes e Defensivos Agrícolas',
    contaTipo: 'Despesa',
    contaGrupo: 'Custos dos Produtos/Serviços Vendidos (CPV/CSV)',
    centroNome: 'Lavoura e Campo',
    centroTipo: 'Despesa',
    tipoDespesaNome: 'Insumos Agrícolas',
    segmentosRelevantes: ['Agronegócio'],
    motivoRecomendacao: 'Insumos fundamentais da safra agrícola.',
    prioridade: 'alta',
    descricao: 'Adubos, calcário, defensivos e sementes',
  },
  {
    codigoSugerido: '5.2.15',
    contaNome: 'Combustíveis e Lubrificantes para Tratores e Maquinário',
    contaTipo: 'Despesa',
    contaGrupo: 'Custos dos Produtos/Serviços Vendidos (CPV/CSV)',
    centroNome: 'Operações Agrícolas',
    centroTipo: 'Despesa',
    tipoDespesaNome: 'Combustíveis',
    segmentosRelevantes: ['Agronegócio'],
    motivoRecomendacao: 'Diesel e óleo para frotas agrícolas e colheitadeiras.',
    prioridade: 'alta',
    descricao: 'Abastecimento de tratores e caminhões',
  },

  // ==========================================
  // EDUCAÇÃO / ESCOLAS / TREINAMENTOS
  // ==========================================
  {
    codigoSugerido: '1.1.17',
    contaNome: 'Mensalidades Escolares / Cursos a Receber',
    contaTipo: 'Ativo',
    contaGrupo: 'Ativo Circulante',
    centroNome: 'Secretaria e Cobrança',
    centroTipo: 'Receita',
    segmentosRelevantes: ['Educação'],
    motivoRecomendacao: 'Mensalidades e anuidades de alunos matriculados.',
    prioridade: 'alta',
    descricao: 'Recebíveis de alunos e responsáveis',
  },
  {
    codigoSugerido: '4.1.13',
    contaNome: 'Receita de Mensalidades e Matrículas',
    contaTipo: 'Receita',
    contaGrupo: 'Receita de Prestação de Serviços',
    centroNome: 'Pedagógico e Acadêmico',
    centroTipo: 'Receita',
    segmentosRelevantes: ['Educação'],
    motivoRecomendacao: 'Principal fonte de faturamento de instituições de ensino.',
    prioridade: 'alta',
    descricao: 'Mensalidades acadêmicas regulares',
  },
  {
    codigoSugerido: '5.1.09',
    contaNome: 'Salários e Encargos do Corpo Docente (Professores)',
    contaTipo: 'Despesa',
    contaGrupo: 'Custos dos Produtos/Serviços Vendidos (CPV/CSV)',
    centroNome: 'Pedagógico e Acadêmico',
    centroTipo: 'Despesa',
    tipoDespesaNome: 'Folha de Professores',
    segmentosRelevantes: ['Educação'],
    motivoRecomendacao: 'Remuneração direta dos professores e instrutores de sala de aula.',
    prioridade: 'alta',
    descricao: 'Salários hora-aula e coordenação',
  },
  {
    codigoSugerido: '5.2.16',
    contaNome: 'Material Didático, Livros e Plataformas Educacionais',
    contaTipo: 'Despesa',
    contaGrupo: 'Despesas Administrativas',
    centroNome: 'Pedagógico e Acadêmico',
    centroTipo: 'Despesa',
    tipoDespesaNome: 'Material Escolar',
    segmentosRelevantes: ['Educação'],
    motivoRecomendacao: 'Apostilas, licenças LMS e bibliotecas digitais.',
    prioridade: 'media',
    descricao: 'Sistemas de ensino e livros didáticos',
  },

  // ==========================================
  // FINANCEIRO / FACTORING / SECURITIZADORAS
  // ==========================================
  {
    codigoSugerido: '1.1.18',
    contaNome: 'Títulos Descontados e Direitos Creditórios',
    contaTipo: 'Ativo',
    contaGrupo: 'Ativo Circulante',
    centroNome: 'Operações de Crédito',
    centroTipo: 'Receita',
    segmentosRelevantes: ['Financeiro'],
    motivoRecomendacao: 'Carteira de duplicatas e direitos adquiridos para antecipação.',
    prioridade: 'alta',
    descricao: 'Carteira ativa de recebíveis adquiridos',
  },
  {
    codigoSugerido: '4.1.14',
    contaNome: 'Receitas de Intermediação Financeira e Juros de Operações',
    contaTipo: 'Receita',
    contaGrupo: 'Receitas Financeiras',
    centroNome: 'Operações de Crédito',
    centroTipo: 'Receita',
    segmentosRelevantes: ['Financeiro'],
    motivoRecomendacao: 'Juros, spread e deságios em operações de fomento.',
    prioridade: 'alta',
    descricao: 'Spread bancário e deságio de fomento mercantil',
  },
  {
    codigoSugerido: '5.1.10',
    contaNome: 'Provisão para Devedores Duvidosos (PDD / Perdas Estimadas)',
    contaTipo: 'Despesa',
    contaGrupo: 'Despesas Financeiras',
    centroNome: 'Gestão de Risco e Crédito',
    centroTipo: 'Despesa',
    tipoDespesaNome: 'Perdas em Crédito',
    segmentosRelevantes: ['Financeiro'],
    motivoRecomendacao: 'Reserva para inadimplência da carteira de crédito.',
    prioridade: 'alta',
    descricao: 'Inadimplência de tomadores',
  },

  // ==========================================
  // SERVIÇOS GERAIS (E ADICIONAIS UNIVERSAIS)
  // ==========================================
  {
    codigoSugerido: '1.1.19',
    contaNome: 'Depósitos Judiciais e Recursais',
    contaTipo: 'Ativo',
    contaGrupo: 'Ativo Não Circulante',
    centroNome: 'Jurídico e Compliance',
    centroTipo: 'Despesa',
    segmentosRelevantes: ['Serviços', 'Indústria', 'Comércio', 'Construção'],
    motivoRecomendacao: 'Valores bloqueados em ações trabalhistas ou cíveis.',
    prioridade: 'media',
    descricao: 'Garantias processuais sob custódia da Justiça',
  },
  {
    codigoSugerido: '2.1.07',
    contaNome: 'Provisão para Férias e 13º Salário a Pagar',
    contaTipo: 'Passivo',
    contaGrupo: 'Passivo Circulante',
    centroNome: 'Recursos Humanos',
    centroTipo: 'Despesa',
    tipoDespesaNome: 'Provisões Trabalhistas',
    segmentosRelevantes: [
      'Serviços',
      'Indústria',
      'Comércio',
      'Tecnologia',
      'Construção',
      'Saúde',
      'Educação',
    ],
    motivoRecomendacao: 'Controle de competência do passivo trabalhista acumulado.',
    prioridade: 'alta',
    descricao: 'Provisão mensal de 1/12 avos de férias e décimo terceiro',
  },
]

/**
 * Retorna as contas recomendadas para determinado segmento,
 * unindo o modelo padrão com as contas especializadas.
 */
export function obterCatalogoRecomendadoPorSegmento(
  segmento: SegmentoEmpresa | string | undefined,
): ContaRecomendadaSegmento[] {
  const segLimpo = (segmento || 'Serviços').trim()

  // Converte as contas do MODELO_PLANO_CONTAS_PADRAO em itens recomendados universais
  const contasPadraoRecomendadas: ContaRecomendadaSegmento[] = MODELO_PLANO_CONTAS_PADRAO.map(
    (item) => ({
      ...item,
      segmentosRelevantes: ['Todos'],
      motivoRecomendacao:
        'Estrutura contábil e operacional padrão recomendada para toda empresa brasileira.',
      prioridade: 'padrao',
    }),
  )

  // Filtra as contas especializadas relevantes para o setor da empresa
  const especializadasDoSetor = CONTAS_ESPECIALIZADAS_SEGMENTO.filter((item) => {
    return (
      item.segmentosRelevantes.includes('Todos') ||
      item.segmentosRelevantes.some((s) => s.toLowerCase() === segLimpo.toLowerCase())
    )
  })

  // Retorna combinando as especializadas prioritárias no topo + modelo padrão
  return [...especializadasDoSetor, ...contasPadraoRecomendadas]
}
