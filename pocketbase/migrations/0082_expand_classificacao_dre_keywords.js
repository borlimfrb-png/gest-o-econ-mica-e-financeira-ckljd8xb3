/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // Migração 0082: amplia as palavras-chave para reduzir contas "Não classificados" na DRE
    try {
      // 1. Receita Financeira
      app
        .db()
        .newQuery(`
        UPDATE contas
        SET classificacao_dre = 'Receita Financeira'
        WHERE (classificacao_dre IS NULL OR classificacao_dre = '')
          AND (
            LOWER(nome) LIKE '%rendimento%'
            OR LOWER(nome) LIKE '%aplicaç%'
            OR LOWER(nome) LIKE '%aplicac%'
            OR LOWER(nome) LIKE '%receita financeira%'
            OR LOWER(nome) LIKE '%receitas financeiras%'
            OR LOWER(nome) LIKE '%juros ativo%'
            OR LOWER(nome) LIKE '%juros recebido%'
            OR LOWER(nome) LIKE '%desconto obtido%'
            OR LOWER(nome) LIKE '%descontos obtidos%'
            OR LOWER(nome) LIKE '%ganho cambial%'
            OR LOWER(nome) LIKE '%variacao cambial ativa%'
            OR LOWER(nome) LIKE '%variação cambial ativa%'
          )
      `)
        .execute()

      // 2. Despesa Financeira
      app
        .db()
        .newQuery(`
        UPDATE contas
        SET classificacao_dre = 'Despesa Financeira'
        WHERE (classificacao_dre IS NULL OR classificacao_dre = '')
          AND (
            LOWER(nome) LIKE '%juros%'
            OR LOWER(nome) LIKE '%tarifa%banc%'
            OR LOWER(nome) LIKE '%taxa%banc%'
            OR LOWER(nome) LIKE '%taxas%'
            OR LOWER(nome) LIKE '%iof%'
            OR LOWER(nome) LIKE '%empréstimo%'
            OR LOWER(nome) LIKE '%emprestimo%'
            OR LOWER(nome) LIKE '%financiamento%'
            OR LOWER(nome) LIKE '%despesa financeira%'
            OR LOWER(nome) LIKE '%despesas financeiras%'
            OR LOWER(nome) LIKE '%desconto concedido%'
            OR LOWER(nome) LIKE '%descontos concedidos%'
            OR LOWER(nome) LIKE '%bancári%'
            OR LOWER(nome) LIKE '%bancari%'
            OR LOWER(nome) LIKE '%multa bancaria%'
            OR LOWER(nome) LIKE '%multa bancária%'
            OR LOWER(nome) LIKE '%encargos financeir%'
          )
      `)
        .execute()

      // 3. Despesa Variável
      app
        .db()
        .newQuery(`
        UPDATE contas
        SET classificacao_dre = 'Despesa Variável'
        WHERE (classificacao_dre IS NULL OR classificacao_dre = '')
          AND (
            LOWER(nome) LIKE '%comiss%'
            OR LOWER(nome) LIKE '%frete%'
            OR LOWER(nome) LIKE '%imposto sobre venda%'
            OR LOWER(nome) LIKE '%impostos sobre vendas%'
            OR LOWER(nome) LIKE '%matéria-prima%'
            OR LOWER(nome) LIKE '%materia-prima%'
            OR LOWER(nome) LIKE '%materia prima%'
            OR LOWER(nome) LIKE '%insumo%'
            OR LOWER(nome) LIKE '%embalag%'
            OR LOWER(nome) LIKE '%custo mercadoria%'
            OR LOWER(nome) LIKE '%custo do produto%'
            OR LOWER(nome) LIKE '%custo dos produtos%'
            OR LOWER(nome) LIKE '%cpv%'
            OR LOWER(nome) LIKE '%cmv%'
            OR LOWER(nome) LIKE '%csv%'
            OR LOWER(nome) LIKE '%simples nacional%'
            OR LOWER(nome) LIKE '%icms%'
            OR LOWER(nome) LIKE '%iss%'
            OR LOWER(nome) LIKE '%pis%'
            OR LOWER(nome) LIKE '%cofins%'
            OR LOWER(nome) LIKE '%taxa cartao%'
            OR LOWER(nome) LIKE '%taxa de cartao%'
            OR LOWER(nome) LIKE '%taxas de cartao%'
            OR LOWER(nome) LIKE '%taxa de maquina%'
            OR LOWER(nome) LIKE '%tributo sobre venda%'
          )
      `)
        .execute()

      // 4. Despesa Fixa
      app
        .db()
        .newQuery(`
        UPDATE contas
        SET classificacao_dre = 'Despesa Fixa'
        WHERE (classificacao_dre IS NULL OR classificacao_dre = '')
          AND (
            LOWER(nome) LIKE '%aluguel%'
            OR LOWER(nome) LIKE '%locacao%'
            OR LOWER(nome) LIKE '%locação%'
            OR LOWER(nome) LIKE '%salário%'
            OR LOWER(nome) LIKE '%salario%'
            OR LOWER(nome) LIKE '%folha%'
            OR LOWER(nome) LIKE '%pró-labore%'
            OR LOWER(nome) LIKE '%pro-labore%'
            OR LOWER(nome) LIKE '%pro labore%'
            OR LOWER(nome) LIKE '%prolabore%'
            OR LOWER(nome) LIKE '%encargos%'
            OR LOWER(nome) LIKE '%inss%'
            OR LOWER(nome) LIKE '%fgts%'
            OR LOWER(nome) LIKE '%energia%'
            OR LOWER(nome) LIKE '%luz%'
            OR LOWER(nome) LIKE '%água%'
            OR LOWER(nome) LIKE '%agua%'
            OR LOWER(nome) LIKE '%telefone%'
            OR LOWER(nome) LIKE '%internet%'
            OR LOWER(nome) LIKE '%telecom%'
            OR LOWER(nome) LIKE '%contabilidade%'
            OR LOWER(nome) LIKE '%contador%'
            OR LOWER(nome) LIKE '%honorários%'
            OR LOWER(nome) LIKE '%honorarios%'
            OR LOWER(nome) LIKE '%honorario%'
            OR LOWER(nome) LIKE '%limpeza%'
            OR LOWER(nome) LIKE '%segurança%'
            OR LOWER(nome) LIKE '%seguranca%'
            OR LOWER(nome) LIKE '%manutenção%'
            OR LOWER(nome) LIKE '%manutencao%'
            OR LOWER(nome) LIKE '%software%'
            OR LOWER(nome) LIKE '%sistema%'
            OR LOWER(nome) LIKE '%marketing%'
            OR LOWER(nome) LIKE '%propaganda%'
            OR LOWER(nome) LIKE '%publicidade%'
            OR LOWER(nome) LIKE '%anuncio%'
            OR LOWER(nome) LIKE '%anúncio%'
            OR LOWER(nome) LIKE '%viagem%'
            OR LOWER(nome) LIKE '%viagens%'
            OR LOWER(nome) LIKE '%hospedagem%'
            OR LOWER(nome) LIKE '%combustivel%'
            OR LOWER(nome) LIKE '%combustível%'
            OR LOWER(nome) LIKE '%depreciação%'
            OR LOWER(nome) LIKE '%depreciacao%'
            OR LOWER(nome) LIKE '%administrativ%'
            OR LOWER(nome) LIKE '%condominio%'
            OR LOWER(nome) LIKE '%condomínio%'
            OR LOWER(nome) LIKE '%material escritorio%'
            OR LOWER(nome) LIKE '%material de escritorio%'
            OR LOWER(nome) LIKE '%uniforme%'
            OR LOWER(nome) LIKE '%copa%'
          )
      `)
        .execute()

      // 5. Receita (Vendas, Consultoria, Serviços, etc.)
      app
        .db()
        .newQuery(`
        UPDATE contas
        SET classificacao_dre = 'Receita'
        WHERE (classificacao_dre IS NULL OR classificacao_dre = '')
          AND (
            tipo = 'Receita'
            OR LOWER(nome) LIKE '%receita%'
            OR LOWER(nome) LIKE '%venda%'
            OR LOWER(nome) LIKE '%faturamento%'
            OR LOWER(nome) LIKE '%serviço%'
            OR LOWER(nome) LIKE '%servico%'
            OR LOWER(nome) LIKE '%consultoria%'
            OR LOWER(nome) LIKE '%assessoria%'
            OR LOWER(nome) LIKE '%honorario recebido%'
            OR LOWER(nome) LIKE '%honorários recebidos%'
            OR LOWER(nome) LIKE '%mensalidade%'
          )
      `)
        .execute()
    } catch (e) {
      console.log('Aviso ao executar ampliação de palavras-chave DRE (0082):', e)
    }
  },
  () => {
    // Reversão não é necessária para queries de dados idempotentes
  },
)
