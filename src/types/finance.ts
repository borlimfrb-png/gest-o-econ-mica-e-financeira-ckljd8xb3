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
}

export interface TipoDespesaRecord extends RecordModel {
  codigo?: string
  nome: string
  descricao?: string
  user: string
}

export type TipoConta = 'Ativo' | 'Passivo' | 'Patrimônio Líquido' | 'Receita' | 'Despesa'

export interface ContaRecord extends RecordModel {
  codigo?: string
  nome: string
  descricao?: string
  tipo: TipoConta
  grupo?: string
  user: string
}

// Relaciona uma conta do plano de contas a um centro de custo (e opcionalmente
// a um tipo de despesa). Código sequencial automático (PC-001, ...) por usuário.
export interface PlanoContaRecord extends RecordModel {
  codigo?: string
  conta: string
  centro: string
  tipo_despesa?: string
  descricao?: string
  user: string
  expand?: {
    conta?: ContaRecord
    centro?: CentroRecord
    tipo_despesa?: TipoDespesaRecord
  }
}

export interface LancamentoRecord extends RecordModel {
  empresa: string
  plano_conta: string
  data: string
  valor: number
  historico?: string
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
  expand?: {
    contratante?: EmpresaRecord
  }
}

export type StatusNotaFiscal = 'Rascunho' | 'Emitida' | 'Enviada' | 'Cancelada' | 'Erro'
export type ModoEmissaoNFSe = 'Homologação / Simulação' | 'Produção SEFAZ / Gateway'
export type TipoDocumentoFiscal = 'NFSe' | 'Debito' | 'Credito'

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

  expand?: {
    empresa?: EmpresaRecord
    contrato?: ContratoRecord
    nota_referencia?: NotaFiscalRecord
    recebivel?: RecebivelRecord
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
