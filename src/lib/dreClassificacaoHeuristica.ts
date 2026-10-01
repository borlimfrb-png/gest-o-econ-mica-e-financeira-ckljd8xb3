import type { ClassificacaoDre, ContaRecord, TipoConta } from '@/types/finance'

/**
 * Heurística para sugerir ou classificar automaticamente uma conta para a DRE
 * quando o campo classificacao_dre estiver vazio/indefinido.
 *
 * Regras:
 * 1. "rendimento", "aplicação", "receita financeira", "juros ativos", "descontos obtidos" → Receita Financeira
 * 2. "juros", "tarifas bancárias", "IOF", "empréstimo", "financiamento", "despesa financeira", "descontos concedidos" → Despesa Financeira
 * 3. comissão, frete, imposto sobre venda, matéria-prima, insumo, embalagem, cpv, cmv, csv, simples nacional, icms, iss, pis, cofins → Despesa Variável
 * 4. aluguel, salários, folha, pró-labore, energia, luz, água, telefone, internet, contabilidade, honorários, limpeza, segurança, manutenção, software, sistema, depreciação → Despesa Fixa
 * 5. receita, vendas, faturamento, serviços ou tipo 'Receita' → Receita
 */
export function sugerirClassificacaoDre(
  nomeConta: string,
  tipoConta?: TipoConta | string,
  grupoConta?: string,
): ClassificacaoDre | null {
  const texto = `${nomeConta || ''} ${grupoConta || ''}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos

  // 1. Receita Financeira (verificar antes de Despesa Financeira por conta de "juros"/"receita")
  const keywordsReceitaFin = [
    'rendimento',
    'aplicacao',
    'receita financeira',
    'receitas financeiras',
    'juros ativo',
    'juros recebido',
    'desconto obtido',
    'descontos obtidos',
    'ganho cambial',
    'variacao cambial ativa',
  ]
  if (keywordsReceitaFin.some((k) => texto.includes(k))) {
    return 'Receita Financeira'
  }

  // 2. Despesa Financeira
  const keywordsDespesaFin = [
    'juros',
    'tarifa bancaria',
    'tarifas bancarias',
    'taxa bancaria',
    'taxas bancarias',
    'despesa bancaria',
    'despesas bancarias',
    'iof',
    'emprestimo',
    'financiamento',
    'despesa financeira',
    'despesas financeiras',
    'desconto concedido',
    'descontos concedidos',
    'bancari',
    'multa bancaria',
    'variacao cambial passiva',
  ]
  if (keywordsDespesaFin.some((k) => texto.includes(k))) {
    return 'Despesa Financeira'
  }

  // 3. Despesa Variável
  const keywordsDespesaVar = [
    'comiss',
    'frete',
    'imposto sobre venda',
    'impostos sobre vendas',
    'materia-prima',
    'materia prima',
    'materias-primas',
    'materias primas',
    'insumo',
    'embalag',
    'custo mercadoria',
    'custo do produto',
    'custo dos produtos',
    'cpv',
    'cmv',
    'csv',
    'simples nacional',
    'icms',
    'iss',
    'pis',
    'cofins',
    'tributo sobre venda',
    'taxa cartao',
    'taxas de cartao',
    'taxa de maquina',
  ]
  if (keywordsDespesaVar.some((k) => texto.includes(k))) {
    return 'Despesa Variável'
  }

  // 4. Despesa Fixa
  const keywordsDespesaFixa = [
    'aluguel',
    'locacao',
    'salario',
    'salarios',
    'folha',
    'pro-labore',
    'pro labore',
    'encargos',
    'fgts',
    'inss folha',
    'energia',
    'luz',
    'agua',
    'telefone',
    'internet',
    'contabilidade',
    'contador',
    'honorario',
    'honorarios',
    'limpeza',
    'seguranca',
    'manutencao',
    'software',
    'sistema',
    'depreciacao',
    'administrativ',
    'condominio',
    'copa',
    'material escritorio',
    'uniforme',
  ]
  if (keywordsDespesaFixa.some((k) => texto.includes(k))) {
    return 'Despesa Fixa'
  }

  // 5. Receita
  const keywordsReceita = [
    'receita',
    'venda',
    'vendas',
    'faturamento',
    'servico',
    'servicos',
    'prestacao de servico',
    'mensalidade',
    'honorario recebido',
  ]
  if (keywordsReceita.some((k) => texto.includes(k))) {
    return 'Receita'
  }

  // Fallback baseado no Tipo da Conta se existir
  if (tipoConta === 'Receita') {
    return 'Receita'
  }
  if (tipoConta === 'Despesa') {
    // Se for despesa sem palavra específica, sugerir Despesa Fixa
    return 'Despesa Fixa'
  }

  return null
}

/**
 * Retorna a classificação DRE definitiva da conta:
 * 1. Campo explícito se preenchido
 * 2. Heurística de palavras-chave caso vazio
 * 3. null se não conseguir classificar
 */
export function obterClassificacaoDreConta(conta?: ContaRecord | null): ClassificacaoDre | null {
  if (!conta) return null
  if (conta.classificacao_dre) {
    return conta.classificacao_dre
  }
  return sugerirClassificacaoDre(conta.nome, conta.tipo, conta.grupo)
}
