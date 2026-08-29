import { normalizeText } from './pdfParser'
import type { BalancoRecord, DreRecord } from '@/types/finance'

export interface BalanceteMapeadoResult {
  balanco: Partial<BalancoRecord>
  dre: Partial<DreRecord>
  contasIdentificadas: Array<{
    codigo?: string
    descricao: string
    valor: number
    grupoContabil: string
    campoMapeado: string
  }>
  totalAtivo: number
  totalPassivo: number
  totalReceitas: number
  totalDespesas: number
}

/**
 * Converte linhas extraídas de um Balancete (de Excel ou PDF) em objetos estruturados
 * de Balanço Patrimonial e DRE com pré-visualização.
 */
export function mapearBalanceteParaBalancoEDre(
  rows: Array<{
    codigo?: string
    conta?: string
    descricao?: string
    valor: number
    tipo?: string
    natureza?: string
    linhaOriginal?: string
  }>,
  ano: number,
  mes: number,
  empresaId: string,
): BalanceteMapeadoResult {
  const balanco: Partial<BalancoRecord> = {
    empresa: empresaId,
    ano,
    mes,
    caixa_equivalentes: 0,
    aplicacoes_financeiras: 0,
    contas_receber: 0,
    estoques: 0,
    impostos_recuperar: 0,
    outros_ativo_circulante: 0,
    realizavel_longo_prazo: 0,
    investimentos: 0,
    imobilizado: 0,
    intangivel: 0,
    fornecedores: 0,
    emprestimos_curto_prazo: 0,
    obrigacoes_trabalhistas: 0,
    obrigacoes_tributarias: 0,
    outros_passivo_circulante: 0,
    emprestimos_longo_prazo: 0,
    outras_obrigacoes_longo_prazo: 0,
    capital_social: 0,
    reservas_lucros: 0,
    lucros_acumulados: 0,
  }

  const dre: Partial<DreRecord> = {
    empresa: empresaId,
    ano,
    mes,
    receita_bruta: 0,
    deducoes_receita: 0,
    custo_mercadorias: 0,
    despesas_operacionais: 0,
    despesas_financeiras: 0,
    outras_receitas_despesas: 0,
    imposto_renda: 0,
  }

  const contasIdentificadas: BalanceteMapeadoResult['contasIdentificadas'] = []

  // Heurísticas de mapeamento contábil padrão (Plano de Contas Referencial / Padrão)
  rows.forEach((row) => {
    const rawDesc = (row.descricao || row.conta || '').trim()
    const rawCod = (row.codigo || '').trim()
    const norm = normalizeText(`${rawCod} ${rawDesc} ${row.tipo || ''}`)
    const absVal = Math.abs(row.valor || 0)

    if (absVal === 0 || !rawDesc) return

    let campoMapeado = ''
    let grupoContabil = ''

    // 1. ATIVO CIRCULANTE (1.1)
    if (
      norm.includes('caixa') ||
      norm.includes('banco conta movimento') ||
      norm.includes('disponivel') ||
      norm.includes('disponibilidades')
    ) {
      campoMapeado = 'caixa_equivalentes'
      grupoContabil = 'Ativo Circulante - Caixa e Equivalentes'
      balanco.caixa_equivalentes = (balanco.caixa_equivalentes || 0) + absVal
    } else if (
      norm.includes('aplicacao') ||
      norm.includes('aplicacoes financeiras') ||
      norm.includes('cdb') ||
      norm.includes('fundo de investimento')
    ) {
      campoMapeado = 'aplicacoes_financeiras'
      grupoContabil = 'Ativo Circulante - Aplicações Financeiras'
      balanco.aplicacoes_financeiras = (balanco.aplicacoes_financeiras || 0) + absVal
    } else if (
      norm.includes('cliente') ||
      norm.includes('contas a receber') ||
      norm.includes('duplicatas a receber') ||
      norm.includes('recebiveis')
    ) {
      campoMapeado = 'contas_receber'
      grupoContabil = 'Ativo Circulante - Clientes a Receber'
      balanco.contas_receber = (balanco.contas_receber || 0) + absVal
    } else if (
      norm.includes('estoque') ||
      norm.includes('mercadoria para revenda') ||
      norm.includes('materia prima') ||
      norm.includes('produtos acabados')
    ) {
      campoMapeado = 'estoques'
      grupoContabil = 'Ativo Circulante - Estoques'
      balanco.estoques = (balanco.estoques || 0) + absVal
    } else if (
      norm.includes('imposto a recuperar') ||
      norm.includes('tributo a recuperar') ||
      norm.includes('icms a recuperar') ||
      norm.includes('pis a recuperar') ||
      norm.includes('cofins a recuperar')
    ) {
      campoMapeado = 'impostos_recuperar'
      grupoContabil = 'Ativo Circulante - Impostos a Recuperar'
      balanco.impostos_recuperar = (balanco.impostos_recuperar || 0) + absVal
    } else if (
      rawCod.startsWith('1.1') ||
      rawCod.startsWith('11') ||
      norm.includes('ativo circulante')
    ) {
      campoMapeado = 'outros_ativo_circulante'
      grupoContabil = 'Ativo Circulante - Outros'
      balanco.outros_ativo_circulante = (balanco.outros_ativo_circulante || 0) + absVal
    }
    // 2. ATIVO NÃO CIRCULANTE (1.2)
    else if (
      norm.includes('imobilizado') ||
      norm.includes('veiculo') ||
      norm.includes('maquina') ||
      norm.includes('equipamento') ||
      norm.includes('movel') ||
      norm.includes('imovel') ||
      norm.includes('computador') ||
      norm.includes('instalac')
    ) {
      campoMapeado = 'imobilizado'
      grupoContabil = 'Ativo Não Circulante - Imobilizado'
      balanco.imobilizado = (balanco.imobilizado || 0) + absVal
    } else if (
      norm.includes('intangivel') ||
      norm.includes('software') ||
      norm.includes('marca') ||
      norm.includes('patente') ||
      norm.includes('direito autoral')
    ) {
      campoMapeado = 'intangivel'
      grupoContabil = 'Ativo Não Circulante - Intangível'
      balanco.intangivel = (balanco.intangivel || 0) + absVal
    } else if (
      norm.includes('investimento') ||
      norm.includes('participacao societaria') ||
      norm.includes('acoes de coligadas')
    ) {
      campoMapeado = 'investimentos'
      grupoContabil = 'Ativo Não Circulante - Investimentos'
      balanco.investimentos = (balanco.investimentos || 0) + absVal
    } else if (
      norm.includes('realizavel a longo prazo') ||
      norm.includes('ativo realizavel lp') ||
      rawCod.startsWith('1.2.1')
    ) {
      campoMapeado = 'realizavel_longo_prazo'
      grupoContabil = 'Ativo Não Circulante - Realizável LP'
      balanco.realizavel_longo_prazo = (balanco.realizavel_longo_prazo || 0) + absVal
    }
    // 3. PASSIVO CIRCULANTE (2.1)
    else if (
      norm.includes('fornecedor') ||
      norm.includes('duplicatas a pagar') ||
      norm.includes('contas a pagar mercadorias')
    ) {
      campoMapeado = 'fornecedores'
      grupoContabil = 'Passivo Circulante - Fornecedores'
      balanco.fornecedores = (balanco.fornecedores || 0) + absVal
    } else if (
      (norm.includes('emprestimo') ||
        norm.includes('financiamento') ||
        norm.includes('giro bancario')) &&
      !norm.includes('longo prazo') &&
      !norm.includes('lp')
    ) {
      campoMapeado = 'emprestimos_curto_prazo'
      grupoContabil = 'Passivo Circulante - Empréstimos CP'
      balanco.emprestimos_curto_prazo = (balanco.emprestimos_curto_prazo || 0) + absVal
    } else if (
      norm.includes('salario a pagar') ||
      norm.includes('folha a pagar') ||
      norm.includes('inss a recolher') ||
      norm.includes('fgts a recolher') ||
      norm.includes('pro-labore') ||
      norm.includes('trabalhista')
    ) {
      campoMapeado = 'obrigacoes_trabalhistas'
      grupoContabil = 'Passivo Circulante - Obrigações Trabalhistas'
      balanco.obrigacoes_trabalhistas = (balanco.obrigacoes_trabalhistas || 0) + absVal
    } else if (
      norm.includes('imposto a recolher') ||
      norm.includes('tributo a recolher') ||
      norm.includes('simples nacional a pagar') ||
      norm.includes('icms a pagar') ||
      norm.includes('iss a pagar') ||
      norm.includes('pis a recolher') ||
      norm.includes('cofins a recolher')
    ) {
      campoMapeado = 'obrigacoes_tributarias'
      grupoContabil = 'Passivo Circulante - Obrigações Tributárias'
      balanco.obrigacoes_tributarias = (balanco.obrigacoes_tributarias || 0) + absVal
    } else if (
      rawCod.startsWith('2.1') ||
      rawCod.startsWith('21') ||
      norm.includes('passivo circulante')
    ) {
      campoMapeado = 'outros_passivo_circulante'
      grupoContabil = 'Passivo Circulante - Outros'
      balanco.outros_passivo_circulante = (balanco.outros_passivo_circulante || 0) + absVal
    }
    // 4. PASSIVO NÃO CIRCULANTE (2.2)
    else if (
      (norm.includes('emprestimo') || norm.includes('financiamento')) &&
      (norm.includes('longo prazo') || norm.includes('lp') || rawCod.startsWith('2.2'))
    ) {
      campoMapeado = 'emprestimos_longo_prazo'
      grupoContabil = 'Passivo Não Circulante - Empréstimos LP'
      balanco.emprestimos_longo_prazo = (balanco.emprestimos_longo_prazo || 0) + absVal
    } else if (rawCod.startsWith('2.2') || norm.includes('exigivel a longo prazo')) {
      campoMapeado = 'outras_obrigacoes_longo_prazo'
      grupoContabil = 'Passivo Não Circulante - Outras Obrigações LP'
      balanco.outras_obrigacoes_longo_prazo = (balanco.outras_obrigacoes_longo_prazo || 0) + absVal
    }
    // 5. PATRIMÔNIO LÍQUIDO (2.3 ou 2.4)
    else if (
      norm.includes('capital social') ||
      norm.includes('capital subscrito') ||
      norm.includes('capital integralizado')
    ) {
      campoMapeado = 'capital_social'
      grupoContabil = 'Patrimônio Líquido - Capital Social'
      balanco.capital_social = (balanco.capital_social || 0) + absVal
    } else if (
      norm.includes('reserva de lucros') ||
      norm.includes('reserva legal') ||
      norm.includes('reserva estatutaria')
    ) {
      campoMapeado = 'reservas_lucros'
      grupoContabil = 'Patrimônio Líquido - Reservas de Lucros'
      balanco.reservas_lucros = (balanco.reservas_lucros || 0) + absVal
    } else if (
      norm.includes('lucros acumulados') ||
      norm.includes('prejuizos acumulados') ||
      norm.includes('lucro do exercicio') ||
      norm.includes('resultado acumulado')
    ) {
      campoMapeado = 'lucros_acumulados'
      grupoContabil = 'Patrimônio Líquido - Lucros Acumulados'
      balanco.lucros_acumulados = (balanco.lucros_acumulados || 0) + row.valor
    }
    // 6. DRE: RECEITA BRUTA (3.1 ou Grupo 3)
    else if (
      rawCod.startsWith('3.1') ||
      norm.includes('receita de venda') ||
      norm.includes('receita bruta') ||
      norm.includes('receita de servico') ||
      norm.includes('faturamento') ||
      norm.includes('vendas de mercadorias')
    ) {
      campoMapeado = 'receita_bruta'
      grupoContabil = 'DRE - Receita Bruta'
      dre.receita_bruta = (dre.receita_bruta || 0) + absVal
    }
    // 7. DRE: DEDUÇÕES DA RECEITA
    else if (
      norm.includes('deducao da receita') ||
      norm.includes('devolucao de vendas') ||
      norm.includes('abatimento') ||
      norm.includes('desconto concedido') ||
      norm.includes('imposto s/ venda') ||
      norm.includes('impostos incidentes s/ vendas')
    ) {
      campoMapeado = 'deducoes_receita'
      grupoContabil = 'DRE - Deduções da Receita'
      dre.deducoes_receita = (dre.deducoes_receita || 0) + absVal
    }
    // 8. DRE: CUSTOS / CMV (4.1 ou Grupo 4)
    else if (
      rawCod.startsWith('4.1') ||
      rawCod.startsWith('4') ||
      norm.includes('custo das mercadorias') ||
      norm.includes('custo dos produtos') ||
      norm.includes('custo dos servicos') ||
      norm.includes('cmv') ||
      norm.includes('cpv') ||
      norm.includes('csv')
    ) {
      campoMapeado = 'custo_mercadorias'
      grupoContabil = 'DRE - Custos Operacionais (CMV)'
      dre.custo_mercadorias = (dre.custo_mercadorias || 0) + absVal
    }
    // 9. DRE: DESPESAS FINANCEIRAS
    else if (
      norm.includes('despesa financeira') ||
      norm.includes('juros pagos') ||
      norm.includes('tarifa bancaria') ||
      norm.includes('iof')
    ) {
      campoMapeado = 'despesas_financeiras'
      grupoContabil = 'DRE - Despesas Financeiras'
      dre.despesas_financeiras = (dre.despesas_financeiras || 0) + absVal
    }
    // 10. DRE: IMPOSTO DE RENDA E CSLL
    else if (
      norm.includes('provisao irpj') ||
      norm.includes('provisao csll') ||
      norm.includes('imposto de renda') ||
      norm.includes('csll sobre o lucro')
    ) {
      campoMapeado = 'imposto_renda'
      grupoContabil = 'DRE - Imposto de Renda / CSLL'
      dre.imposto_renda = (dre.imposto_renda || 0) + absVal
    }
    // 11. DRE: OUTRAS RECEITAS / DESPESAS
    else if (
      norm.includes('outras receitas') ||
      norm.includes('receita financeira') ||
      norm.includes('desconto obtido') ||
      norm.includes('outras despesas nao operacionais')
    ) {
      campoMapeado = 'outras_receitas_despesas'
      grupoContabil = 'DRE - Outras Receitas/Despesas'
      dre.outras_receitas_despesas = (dre.outras_receitas_despesas || 0) + row.valor
    }
    // 12. DRE: DESPESAS OPERACIONAIS GERAIS (5.1 ou Grupo 5)
    else if (
      rawCod.startsWith('5') ||
      rawCod.startsWith('6') ||
      norm.includes('despesa operacional') ||
      norm.includes('despesas administrativas') ||
      norm.includes('despesas com pessoal') ||
      norm.includes('aluguel') ||
      norm.includes('energia eletrica') ||
      norm.includes('agua') ||
      norm.includes('telefone') ||
      norm.includes('honorarios') ||
      norm.includes('manutencao') ||
      norm.includes('material de consumo') ||
      norm.includes('propaganda') ||
      norm.includes('marketing')
    ) {
      campoMapeado = 'despesas_operacionais'
      grupoContabil = 'DRE - Despesas Operacionais'
      dre.despesas_operacionais = (dre.despesas_operacionais || 0) + absVal
    }

    if (campoMapeado) {
      contasIdentificadas.push({
        codigo: rawCod || undefined,
        descricao: rawDesc,
        valor: row.valor,
        grupoContabil,
        campoMapeado,
      })
    }
  })

  // Totais rápidos
  const totalAtivo =
    (balanco.caixa_equivalentes || 0) +
    (balanco.aplicacoes_financeiras || 0) +
    (balanco.contas_receber || 0) +
    (balanco.estoques || 0) +
    (balanco.impostos_recuperar || 0) +
    (balanco.outros_ativo_circulante || 0) +
    (balanco.realizavel_longo_prazo || 0) +
    (balanco.investimentos || 0) +
    (balanco.imobilizado || 0) +
    (balanco.intangivel || 0)

  const totalPassivo =
    (balanco.fornecedores || 0) +
    (balanco.emprestimos_curto_prazo || 0) +
    (balanco.obrigacoes_trabalhistas || 0) +
    (balanco.obrigacoes_tributarias || 0) +
    (balanco.outros_passivo_circulante || 0) +
    (balanco.emprestimos_longo_prazo || 0) +
    (balanco.outras_obrigacoes_longo_prazo || 0) +
    (balanco.capital_social || 0) +
    (balanco.reservas_lucros || 0) +
    (balanco.lucros_acumulados || 0)

  const totalReceitas = dre.receita_bruta || 0
  const totalDespesas =
    (dre.deducoes_receita || 0) +
    (dre.custo_mercadorias || 0) +
    (dre.despesas_operacionais || 0) +
    (dre.despesas_financeiras || 0) +
    (dre.imposto_renda || 0)

  return {
    balanco,
    dre,
    contasIdentificadas,
    totalAtivo,
    totalPassivo,
    totalReceitas,
    totalDespesas,
  }
}
