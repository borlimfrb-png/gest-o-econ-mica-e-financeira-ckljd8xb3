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
}

export interface BalancoRecord extends RecordModel {
  empresa: string
  ano: number
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
  receita_bruta: number
  deducoes_receita: number
  custo_mercadorias: number
  despesas_operacionais: number
  despesas_financeiras: number
  outras_receitas_despesas: number
  imposto_renda: number
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
