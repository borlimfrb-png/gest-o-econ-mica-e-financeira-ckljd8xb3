export type SegmentoEmpresa =
  | 'Indústria'
  | 'Comércio'
  | 'Serviços'
  | 'Tecnologia'
  | 'Agronegócio'
  | 'Construção'
  | 'Saúde'
  | 'Educação'
  | 'Financeiro'
  | 'Outros'

export type PorteEmpresa = 'MEI' | 'Microempresa' | 'Pequena' | 'Média' | 'Grande'

export type UfEmpresa =
  | 'AC'
  | 'AL'
  | 'AP'
  | 'AM'
  | 'BA'
  | 'CE'
  | 'DF'
  | 'ES'
  | 'GO'
  | 'MA'
  | 'MT'
  | 'MS'
  | 'MG'
  | 'PA'
  | 'PB'
  | 'PR'
  | 'PE'
  | 'PI'
  | 'RJ'
  | 'RN'
  | 'RS'
  | 'RO'
  | 'RR'
  | 'SC'
  | 'SP'
  | 'SE'
  | 'TO'

import type { RecordModel } from 'pocketbase'

export type UserRole = 'admin' | 'empresa' | 'financeiro' | 'comercial'

export interface UserRecord extends RecordModel {
  name?: string
  email: string
  avatar?: string
  role?: UserRole
  empresa?: string
  ativo?: boolean
  receber_alertas_email?: boolean
  notificacoes_vencimento?: boolean
  expand?: {
    empresa?: EmpresaRecord
  }
}

export interface EmpresaRecord extends RecordModel {
  nome: string
  cnpj: string
  segmento: SegmentoEmpresa
  nome_fantasia?: string
  porte?: PorteEmpresa
  data_fundacao?: string
  logradouro?: string
  numero?: string
  complemento?: string
  bairro?: string
  cidade?: string
  estado?: UfEmpresa
  cep?: string
  telefone?: string
  email?: string
  site?: string
  contato_principal?: string
  observacoes?: string
  emitir_nota_fiscal?: boolean
  integrar_nfse_lancamentos?: boolean
  is_grupo?: boolean
  grupo_id?: string
  empresas_ids?: string[]
}

export interface GrupoEmpresarialRecord extends RecordModel {
  nome: string
  descricao?: string
  user?: string
  empresas?: string[]
  expand?: {
    empresas?: EmpresaRecord[]
  }
}

// Mapeia cada campo do balanço patrimonial (chave = nome do campo) ao id da
// conta cadastrada vinculada. Armazenado como JSON na collection `balancos`.
export type VinculosContasBalanco = Record<string, string>

export interface BalancoRecord extends RecordModel {
  empresa: string
  ano: number
  mes?: number
  fechado?: boolean
  fechado_em?: string
  fechamento_obs?: string
  // Mapeamento de campo -> id da conta vinculada (opcional).
  vinculos_contas?: VinculosContasBalanco | null
  // Ativo Circulante
  caixa_equivalentes: number
  aplicacoes_financeiras: number
  contas_receber: number
  estoques: number
  impostos_recuperar: number
  outros_ativo_circulante: number
  // Ativo Não Circulante
  realizavel_longo_prazo: number
  investimentos: number
  imobilizado: number
  intangivel: number
  // Passivo Circulante
  fornecedores: number
  emprestimos_curto_prazo: number
  obrigacoes_trabalhistas: number
  obrigacoes_tributarias: number
  outros_passivo_circulante: number
  // Passivo Não Circulante
  emprestimos_longo_prazo: number
  outras_obrigacoes_longo_prazo: number
  // Patrimônio Líquido
  capital_social: number
  reservas_lucros: number
  lucros_acumulados: number
}

export interface DreRecord extends RecordModel {
  empresa: string
  ano: number
  mes?: number
  fechado?: boolean
  fechado_em?: string
  fechamento_obs?: string
  receita_bruta: number
  deducoes_receita: number
  custo_mercadorias: number
  despesas_operacionais: number
  despesas_financeiras: number
  outras_receitas_despesas: number
  imposto_renda: number
}

export type TipoCentro = 'Receita' | 'Despesa'

export interface CentroRecord extends RecordModel {
  nome: string
  descricao?: string
  tipo: TipoCentro
  meta_mensal?: number
  meta_anual?: number
  user: string
  empresa?: string
  expand?: {
    empresa?: EmpresaRecord
  }
}

export interface LancamentoCentroRecord extends RecordModel {
  centro: string
  data: string
  valor: number
  descricao?: string
  tipo_despesa?: string
  conta?: string
  concluido?: boolean
  user: string
  empresa?: string
  expand?: {
    centro?: CentroRecord
    tipo_despesa?: TipoDespesaRecord
    conta?: ContaRecord
    empresa?: EmpresaRecord
  }
}

export interface TipoDespesaRecord extends RecordModel {
  codigo?: string
  nome: string
  descricao?: string
  user: string
  empresa?: string
  expand?: {
    empresa?: EmpresaRecord
  }
}

export type TipoConta = 'Ativo' | 'Passivo' | 'Patrimônio Líquido' | 'Receita' | 'Despesa'

export interface ContaRecord extends RecordModel {
  codigo?: string
  nome: string
  descricao?: string
  tipo: TipoConta
  grupo?: string
  user: string
  empresa?: string
  expand?: {
    empresa?: EmpresaRecord
  }
}

// Relaciona uma conta do plano de contas a um centro de custo (e opcionalmente
// a um tipo de despesa). Código sequencial automático (PC-001, ...) por usuário.
export interface PlanoContaRecord extends RecordModel {
  codigo?: string
  codigo_empresa?: string
  empresa?: string
  conta: string
  centro: string
  tipo_despesa?: string
  descricao?: string
  user: string
  expand?: {
    empresa?: EmpresaRecord
    conta?: ContaRecord
    centro?: CentroRecord
    tipo_despesa?: TipoDespesaRecord
  }
}

export interface PlanoContaMapeamentoRecord extends RecordModel {
  empresa: string
  codigo_empresa: string
  plano_conta: string
  user: string
  expand?: {
    empresa?: EmpresaRecord
    plano_conta?: PlanoContaRecord & {
      expand?: {
        conta?: ContaRecord
        centro?: CentroRecord
        tipo_despesa?: TipoDespesaRecord
      }
    }
    user?: UserRecord
  }
}

export type AcaoAuditoriaLancamento = 'criacao' | 'edicao' | 'exclusao'

export interface AuditoriaLancamentoRecord extends RecordModel {
  empresa: string
  lancamento_id: string
  acao: AcaoAuditoriaLancamento
  usuario?: string
  usuario_nome?: string
  usuario_email?: string
  valor?: number
  historico?: string
  conta_info?: string
  detalhes?: {
    campos_alterados?: Record<string, { antes: any; depois: any }>
    dados_anteriores?: Record<string, any>
    dados_novos?: Record<string, any>
    motivo?: string
  }
  created: string
  expand?: {
    empresa?: EmpresaRecord
    usuario?: UserRecord
  }
}

export type EntidadeAuditoriaCadastro =
  | 'empresas'
  | 'plano_contas'
  | 'users'
  | 'nfse'
  | 'nfse_tomadores'
export type AcaoAuditoriaCadastro = 'criacao' | 'edicao' | 'exclusao'

export interface AuditoriaCadastroRecord extends RecordModel {
  empresa?: string
  entidade: EntidadeAuditoriaCadastro
  registro_id: string
  registro_descricao?: string
  acao: AcaoAuditoriaCadastro
  usuario?: string
  usuario_nome?: string
  usuario_email?: string
  detalhes?: {
    campos_alterados?: Record<string, { antes: any; depois: any }>
    dados_anteriores?: Record<string, any>
    dados_novos?: Record<string, any>
    motivo?: string
  }
  created: string
  updated?: string
  expand?: {
    empresa?: EmpresaRecord
    usuario?: UserRecord
  }
}

export interface LancamentoRecord extends RecordModel {
  empresa: string
  plano_conta: string
  data: string
  valor: number
  historico?: string
  user: string
  nota_fiscal_ref?: string
  estornado?: boolean
  estornado_em?: string
  motivo_estorno?: string
  expand?: {
    empresa?: EmpresaRecord
    nota_fiscal_ref?: NotaFiscalRecord
    plano_conta?: PlanoContaRecord & {
      expand?: {
        conta?: ContaRecord
        centro?: CentroRecord
        tipo_despesa?: TipoDespesaRecord
      }
    }
  }
}

export interface LancamentoRecorrenteRecord extends RecordModel {
  empresa: string
  plano_conta: string
  dia_mes: number
  valor: number
  historico?: string
  ativo: boolean
  user: string
  expand?: {
    empresa?: EmpresaRecord
    plano_conta?: PlanoContaRecord & {
      expand?: {
        conta?: ContaRecord
        centro?: CentroRecord
        tipo_despesa?: TipoDespesaRecord
      }
    }
  }
}

export type TipoMetaLancamento = 'Receita' | 'Despesa'
export type PeriodoMeta = 'Mensal' | 'Trimestral' | 'Anual'
export type TrimestreMeta = 'Q1' | 'Q2' | 'Q3' | 'Q4'

export interface MetaLancamentoRecord extends RecordModel {
  empresa: string
  tipo: TipoMetaLancamento
  valor: number
  mes: number
  ano: number
  periodo?: PeriodoMeta
  trimestre?: TrimestreMeta | null
  centro?: string | null
  ativo?: boolean
  user: string
  expand?: {
    empresa?: EmpresaRecord
    centro?: CentroRecord
  }
}

export interface BalancoCalculado {
  // Grupos
  ativoCirculante: number
  ativoNaoCirculante: number
  ativoTotal: number
  passivoCirculante: number
  passivoNaoCirculante: number
  patrimonioLiquido: number
  passivoTotal: number
  passivoEPL: number
}

export interface DreCalculado {
  receitaLiquida: number
  lucroBruto: number
  resultadoOperacional: number
  resultadoAntesIR: number
  lucroLiquido: number
  ebitda: number
}

export type RegimeTributario = 'Simples Nacional' | 'Lucro Presumido' | 'Lucro Real' | 'MEI'
export type PorteMinhaEmpresa =
  | 'MEI'
  | 'Micro Empresa'
  | 'Empresa de Pequeno Porte'
  | 'Média Empresa'
  | 'Grande Empresa'

export interface MinhaEmpresaRecord extends RecordModel {
  user: string
  // Seção 1 — Dados da Empresa
  razao_social: string
  nome_fantasia: string
  cnpj: string
  inscricao_estadual?: string
  inscricao_municipal?: string
  regime_tributario?: RegimeTributario
  data_abertura?: string
  porte?: PorteMinhaEmpresa
  // Seção 2 — Endereço
  cep?: string
  logradouro?: string
  numero?: string
  complemento?: string
  bairro?: string
  cidade?: string
  estado?: UfEmpresa
  pais?: string
  // Seção 3 — Contato
  telefone_comercial?: string
  celular_whatsapp?: string
  email_comercial?: string
  email_financeiro?: string
  site?: string
  // Seção 4 — Responsável Técnico
  contador_nome: string
  contador_crc: string
  contador_uf_crc?: UfEmpresa
  contador_email?: string
  contador_telefone?: string
  // Seção 5 — Identidade Visual
  logo?: string
  cor_primaria?: string
  cor_secundaria?: string
  // Seção 6 — Dados Bancários
  banco?: string
  agencia?: string
  conta_corrente?: string
  chave_pix?: string
  // Preferências
  notificacoes_vencimento?: boolean
}

export type StatusRecebivel = 'Pendente' | 'Pago'

export interface RecebivelRecord extends RecordModel {
  user: string
  empresa: string
  parcela: number
  vencimento: string
  valor: number
  status: StatusRecebivel
  data_pagamento?: string | null
  data_inicio_servicos: string
  lembrete_agendado?: boolean
  lembrete_enviado?: boolean
  nota_fiscal?: string | null
  conciliado?: boolean
  conciliado_em?: string | null
  nfse_automatica_agendada?: boolean
  nfse_emitida_em?: string | null
  expand?: {
    empresa?: EmpresaRecord
    nota_fiscal?: NotaFiscalRecord
  }
}

export interface ContratoRecord extends RecordModel {
  user: string
  contratada_razao_social: string
  contratada_cnpj: string
  contratada_endereco?: string
  contratada_crc?: string
  contratante: string
  data_inicio: string
  prazo_inicial: number
  quantidade_meses: number
  valor_parcela: number
  dia_vencimento: number
  data_final: string
  parcelas: number
  // Suporte a 2 formas de pagamento distintas
  forma_pagamento_1?: string
  valor_1?: number
  vencimento_1?: string
  forma_pagamento_2?: string
  valor_2?: number
  vencimento_2?: string
  observacoes_pagamento?: string
  expand?: {
    contratante?: EmpresaRecord
  }
}

export type StatusNotaFiscal =
  | 'Rascunho'
  | 'Emitida'
  | 'Enviada'
  | 'Cancelada'
  | 'Substituída'
  | 'Erro'
export type ModoEmissaoNFSe = 'Homologação / Simulação' | 'Produção SEFAZ / Gateway'
export type TipoDocumentoFiscal = 'NFSe' | 'Debito' | 'Credito'

export interface ItemServicoNfse {
  id?: string
  item: number
  descricao: string
  quantidade: number
  valor_unitario: number
  valor_total: number
  codigo_tributacao_nacional?: string // LC 116 / CNAE Nacional (ex: 01.07.01 ou 010701)
  desconto?: number
  aliquota_iss?: number
}

export type TipoPessoaTomador = 'PJ' | 'PF' | 'Exterior'

export interface NfseTomadorRecord extends RecordModel {
  user?: string
  empresa?: string
  tipo_pessoa: TipoPessoaTomador
  cpf_cnpj: string
  razao_social: string
  nome_fantasia?: string
  inscricao_municipal?: string
  inscricao_estadual?: string
  email?: string
  telefone?: string
  cep?: string
  logradouro?: string
  numero?: string
  complemento?: string
  bairro?: string
  codigo_municipio?: string
  cidade?: string
  estado?: string
  observacoes?: string
  ativo?: boolean
  expand?: {
    empresa?: EmpresaRecord
  }
}

export interface NotaFiscalRecord extends RecordModel {
  user: string
  empresa: string
  contrato?: string
  recebivel?: string | null
  numero: number
  serie?: string
  codigo_verificacao?: string
  chave_acesso?: string
  status: StatusNotaFiscal
  data_emissao: string
  competencia?: string
  vencimento?: string
  discriminacao: string
  item_cnae?: string
  codigo_servico_municipal?: string
  natureza_operacao?: string
  valor_servicos: number
  aliquota_iss?: number
  valor_iss?: number
  iss_retido?: boolean
  valor_pis?: number
  valor_cofins?: number
  valor_inss?: number
  valor_ir?: number
  valor_csll?: number
  outras_retencoes?: number
  desconto_incondicionado?: number
  valor_liquido: number
  prestador_cnpj?: string
  prestador_razao_social?: string
  prestador_inscricao_municipal?: string
  tomador_cnpj?: string
  tomador_razao_social?: string
  tomador_email?: string
  modo_emissao?: ModoEmissaoNFSe
  gateway_status_resposta?: string
  protocolo_autorizacao?: string
  xml_conteudo?: string
  email_enviado_em?: string
  email_destinatario?: string

  // Cancelamento
  motivo_cancelamento?: string
  cancelada_em?: string
  protocolo_cancelamento?: string
  xml_cancelamento?: string

  // Nota de Débito / Crédito de Ajuste
  tipo_documento?: TipoDocumentoFiscal
  nota_referencia?: string
  parcela_referencia?: number
  valor_original?: number
  valor_renegociado?: number
  valor_diferenca?: number

  // Conciliação e Agendamento
  conciliada?: boolean
  conciliada_em?: string | null
  agendamento_automatico?: boolean

  // NOVO PADRÃO NACIONAL NFS-e / DPS
  padrao_nacional?: boolean
  dps_serie?: string
  dps_numero?: number
  dps_id?: string
  dps_payload?: any
  servicos_itens?: ItemServicoNfse[]
  codigo_tributacao_nacional?: string
  codigo_municipio_prestacao?: string
  tipo_ambiente?: '1 - Producao' | '2 - Homologacao'
  tomador_ref?: string

  // Substituição / Reemissão corrigida e Integração Lançamentos
  nota_substituida?: string
  justificativa_correcao?: string
  lancamento_ref?: string

  expand?: {
    empresa?: EmpresaRecord
    contrato?: ContratoRecord
    nota_referencia?: NotaFiscalRecord
    nota_substituida?: NotaFiscalRecord
    lancamento_ref?: LancamentoRecord
    recebivel?: RecebivelRecord
    tomador_ref?: NfseTomadorRecord
  }
}

export interface CapitalGiroCalculado {
  // Decomposição Ativo Circulante
  ativoCirculante: number
  ativoCirculanteOperacional: number // Contas a Receber + Estoques + Impostos a Recuperar + Outros AC
  ativoCirculanteFinanceiro: number // Caixa e Equivalentes + Aplicações Financeiras

  // Decomposição Passivo Circulante
  passivoCirculante: number
  passivoCirculanteOperacional: number // Fornecedores + Obrigações Trabalhistas + Obrigações Tributárias + Outros PC
  passivoCirculanteFinanceiro: number // Empréstimos e Financiamentos CP

  // Indicadores de Capital de Giro
  cgb: number // Capital de Giro Bruto = Ativo Circulante
  cgl: number // Capital de Giro Líquido = AC - PC
  ncg: number // Necessidade de Capital de Giro = ACO - PCO
  saldoTesouraria: number // Saldo de Tesouraria = ACF - PCF (ou CGL - NCG)

  // Relações e Indicadores Complementares
  liquidezCorrente: number | null
  coberturaNcgPorCgl: number | null // % (CGL / NCG) * 100 se NCG > 0

  // Prazos e Ciclos (quando DRE fornecida)
  pme: number | null // Prazo Médio de Estocagem
  pmr: number | null // Prazo Médio de Recebimento
  pmp: number | null // Prazo Médio de Pagamento
  cicloOperacional: number | null // PME + PMR
  cicloFinanceiro: number | null // CO - PMP

  // Classificação da Estrutura Fleuriet
  tipoFleuriet:
    | 'excelente'
    | 'solida'
    | 'em_crescimento'
    | 'arriscada'
    | 'alto_risco'
    | 'critica'
    | 'indefinido'
  tipoFleurietNome: string
  tipoFleurietDescricao: string
}

export interface ProdutoRecord extends RecordModel {
  user: string
  empresa?: string
  codigo?: string
  nome: string
  unidade: string
  categoria?: string
  capacidade_producao?: number | null
  quantidade_vendida?: number | null
  custo?: number
  preco_venda?: number
  margem_desejada?: number
  observacoes?: string
  expand?: {
    empresa?: EmpresaRecord
  }
}

export type OrigemAlteracaoPreco =
  | 'Edição Manual'
  | 'Preço Sugerido Margem'
  | 'Preço Sugerido Markup'
  | 'Preço Sugerido Simulador'
  | 'Cadastro Inicial'
  | 'Outro'

export interface HistoricoPrecoProdutoRecord extends RecordModel {
  user: string
  produto: string
  preco_anterior?: number | null
  preco_novo: number
  margem_anterior?: number | null
  margem_nova?: number | null
  custo_momento?: number | null
  origem: OrigemAlteracaoPreco
  observacao?: string
  created: string
  updated: string
  expand?: {
    produto?: ProdutoRecord & {
      expand?: {
        empresa?: EmpresaRecord
      }
    }
  }
}

export type TipoTributacaoMateriaPrima = 'tributada' | 'isenta' | 'substituicao_tributaria'

export interface MateriaPrimaRecord extends RecordModel {
  user: string
  empresa?: string
  codigo?: string
  nome: string
  unidade: string
  categoria?: string
  custo_unitario?: number
  icms_percentual?: number
  pis_percentual?: number
  cofins_percentual?: number
  ipi_percentual?: number
  frete_percentual?: number
  perdas_percentual?: number
  isenta_st?: boolean
  tipo_tributacao?: TipoTributacaoMateriaPrima
  estoque_atual?: number
  estoque_minimo?: number
  observacoes?: string
  expand?: {
    empresa?: EmpresaRecord
  }
}

export interface ItemFichaTecnica {
  materia_prima_id: string
  materia_prima_nome?: string
  unidade?: string
  custo_unitario: number
  quantidade: number
  subtotal: number
  // Campos detalhados de impostos, acréscimos e custo líquido
  custo_unitario_liquido?: number
  subtotal_liquido?: number
  icms_percentual?: number
  pis_percentual?: number
  cofins_percentual?: number
  ipi_percentual?: number
  frete_percentual?: number
  perdas_percentual?: number
  credito_icms?: number
  credito_pis?: number
  credito_cofins?: number
  credito_total?: number
  valor_ipi?: number
  valor_frete?: number
  valor_perdas?: number
  acrescimos_total?: number
  isenta_st?: boolean
  tipo_tributacao?: TipoTributacaoMateriaPrima
}

export interface FichaTecnicaRecord extends RecordModel {
  user: string
  empresa?: string
  produto: string
  itens: ItemFichaTecnica[]
  custo_materia_prima: number
  outros_custos?: number
  custo_total: number
  margem_desejada?: number
  preco_venda_sugerido?: number
  markup_desejado?: number
  preco_venda_markup?: number
  // Totais líquidos com dedução de créditos tributários
  custo_materia_prima_liquido?: number
  creditos_tributarios_totais?: number
  custo_total_liquido?: number
  preco_venda_sugerido_liquido?: number
  preco_venda_markup_liquido?: number
  observacoes?: string
  expand?: {
    empresa?: EmpresaRecord
    produto?: ProdutoRecord
  }
}

export type RegimeTributarioFormacaoPreco = 'Lucro Real' | 'Lucro Presumido' | 'Simples Nacional'

export interface ConfiguracaoTributariaInput {
  empresa: string
  regime_tributario: 'Lucro Real' | 'Lucro Presumido' | 'Simples Nacional'
  aliquota_simples_efetiva?: number
  anexo_simples?: string
  faixa_simples?: string
  aliquota_pis?: number
  aliquota_cofins?: number
  aliquota_icms?: number
  aliquota_ipi?: number
  aliquota_iss?: number
  aliquota_irpj?: number
  aliquota_csll?: number
  outros_impostos?: number
  carga_tributaria_total?: number
  fator_por_dentro?: number
  observacoes?: string
}

export interface ConfiguracaoTributariaRecord extends RecordModel {
  user: string
  empresa: string
  regime_tributario: RegimeTributarioFormacaoPreco
  aliquota_simples_efetiva?: number
  anexo_simples?: string
  faixa_simples?: string
  aliquota_pis?: number
  aliquota_cofins?: number
  aliquota_icms?: number
  aliquota_ipi?: number
  aliquota_iss?: number
  aliquota_irpj?: number
  aliquota_csll?: number
  outros_impostos?: number
  carga_tributaria_total?: number
  fator_por_dentro?: number
  observacoes?: string
  expand?: {
    empresa?: EmpresaRecord
  }
}

export interface BenchmarkSetorialRecord extends RecordModel {
  user: string
  empresa?: string
  setor: SegmentoEmpresa
  descricao?: string
  liquidezCorrente: number
  liquidezSeca: number
  liquidezImediata: number
  liquidezGeral: number
  endividamentoGeral: number
  composicaoEndividamento: number
  participacaoCapitalTerceiros: number
  imobilizacaoPL: number
  margemBruta: number
  margemOperacional: number
  margemLiquida: number
  roa: number
  roe: number
  giroAtivo: number
  autonomiaFinanceira: number
  dependenciaFinanceira: number
  dividaEquity: number
  margemEbitda: number
  coberturaJuros: number
  pme: number
  pmr: number
  pmp: number
  cicloOperacional: number
  cicloFinanceiro: number
  giroEstoque: number
  giroReceber: number
  giroFornecedores: number
  roic: number
  wacc: number
  spread: number
  cgl_referencia?: number
  ncg_referencia?: number
  saldoTesouraria_referencia?: number
}

export interface BenchmarkEmpresaRecord extends RecordModel {
  user: string
  empresa: string
  descricao?: string
  liquidezCorrente?: number
  liquidezSeca?: number
  liquidezImediata?: number
  liquidezGeral?: number
  endividamentoGeral?: number
  composicaoEndividamento?: number
  participacaoCapitalTerceiros?: number
  imobilizacaoPL?: number
  margemBruta?: number
  margemOperacional?: number
  margemLiquida?: number
  roa?: number
  roe?: number
  giroAtivo?: number
  autonomiaFinanceira?: number
  dependenciaFinanceira?: number
  dividaEquity?: number
  margemEbitda?: number
  coberturaJuros?: number
  pme?: number
  pmr?: number
  pmp?: number
  cicloOperacional?: number
  cicloFinanceiro?: number
  giroEstoque?: number
  giroReceber?: number
  giroFornecedores?: number
  roic?: number
  wacc?: number
  spread?: number
  cgl_referencia?: number
  ncg_referencia?: number
  saldoTesouraria_referencia?: number
  expand?: {
    empresa?: EmpresaRecord
  }
}

export interface IndicadoresCalculados {
  // 1. Liquidez
  liquidezCorrente: number | null
  liquidezSeca: number | null
  liquidezImediata: number | null
  liquidezGeral: number | null

  // 2. Endividamento
  endividamentoGeral: number | null // % ((PC + PNC) / Ativo)
  composicaoEndividamento: number | null // % (PC / (PC + PNC))
  dividaLiquidaEbitda: number | null // ((PC + PNC - Caixa - Aplicações) / EBITDA)
  coberturaJuros: number | null // (EBITDA ou LL+IR+DF)/DF

  // 3. Rentabilidade
  margemBruta: number | null // % (LB / RL)
  margemOperacional: number | null // % (RO / RL)
  margemLiquida: number | null // % (LL / RL)
  roa: number | null // % (LL / Ativo Total)
  roe: number | null // % (LL / PL)

  // 4. Estrutura de Capital
  capitalTerceirosSobreProprio: number | null // % ((PC + PNC) / PL)
  imobilizacaoPL: number | null // % (Imobilizado / PL)
  imobilizacaoRecursosNaoCorrentes: number | null // % (Imobilizado / (PL + PNC))
  alavancagemFinanceira: number | null // ((PC + PNC) / PL)
}

export interface MemoriaFornecedorRecord {
  id: string
  user: string
  empresa?: string
  fornecedor_padrao: string
  termo_busca: string
  plano_conta: string
  categoria_sugerida?: string
  total_utilizacoes?: number
  ultima_utilizacao?: string
  created: string
  updated: string
  expand?: {
    plano_conta?: PlanoContaRecord
    empresa?: EmpresaRecord
  }
}

export type BscPerspectiva =
  | 'financeira'
  | 'clientes'
  | 'processos_internos'
  | 'aprendizado_crescimento'

export type BscKpiTipo = 'auto' | 'manual'
export type BscSentido = 'maior_melhor' | 'menor_melhor'

export interface BscKpiRecord {
  id: string
  collectionId: string
  collectionName: string
  usuario?: string
  empresa?: string
  ano: number
  perspectiva: BscPerspectiva
  nome: string
  descricao?: string
  unidade?: string
  meta: number
  valor_atual?: number
  tipo: BscKpiTipo
  formula?: string // ex: 'liquidez_corrente', 'liquidez_seca', 'endividamento_geral', 'margem_bruta', 'margem_liquida', 'roe', 'roa', 'ebitda', 'crescimento_receita', 'pmr', 'pmp', 'pme'
  peso?: number
  sentido: BscSentido
  ordem?: number
  created: string
  updated: string
  expand?: {
    empresa?: EmpresaRecord
    usuario?: UserRecord
  }
}

export type BscIniciativaStatus = 'planejada' | 'em_andamento' | 'concluida' | 'cancelada'

export interface BscIniciativaRecord {
  id: string
  collectionId: string
  collectionName: string
  kpi: string
  empresa?: string
  usuario?: string
  ano: number
  titulo: string
  descricao?: string
  responsavel?: string
  prazo?: string
  status: BscIniciativaStatus
  progresso?: number
  created: string
  updated: string
  expand?: {
    kpi?: BscKpiRecord
    empresa?: EmpresaRecord
    usuario?: UserRecord
  }
}

export type BscHistoricoAcao = 'criada' | 'edicao' | 'status' | 'progresso' | 'concluida'

export interface BscIniciativaHistoricoRecord {
  id: string
  collectionId: string
  collectionName: string
  iniciativa: string
  empresa?: string
  usuario?: string
  usuario_nome?: string
  usuario_email?: string
  acao: BscHistoricoAcao
  descricao?: string
  dados_anteriores?: Record<string, any>
  dados_novos?: Record<string, any>
  created: string
  updated: string
  expand?: {
    iniciativa?: BscIniciativaRecord
    empresa?: EmpresaRecord
    usuario?: UserRecord
  }
}

export interface SimuladorParametrosJson {
  prazoDias: number
  jurosMesPct: number
  icmsPct: number
  irpjPct: number
  csllPct: number
  pisPct: number
  cofinsPct: number
  simplesPct: number
  comissaoPct: number
  fretePct: number
  assistenciaPct: number
  outrosPct: number
  margemLucroPct: number
}

export interface SimuladorCenarioRecord extends RecordModel {
  usuario?: string
  empresa: string
  nome: string
  descricao?: string
  parametros: SimuladorParametrosJson
  divisor_calculado?: number
  created: string
  updated: string
  expand?: {
    empresa?: EmpresaRecord
    usuario?: UserRecord
  }
}

export interface BiApresentacaoRecord extends RecordModel {
  user: string
  empresa?: string
  grupo?: string
  nome: string
  ano_base: number
  ano_comparativo: number
  modo_consolidado: boolean
  widgets_ocultos: string[]
  modo_apresentacao: boolean
  created: string
  updated: string
  expand?: {
    user?: UserRecord
    empresa?: EmpresaRecord
    grupo?: GrupoEmpresarialRecord
  }
}
