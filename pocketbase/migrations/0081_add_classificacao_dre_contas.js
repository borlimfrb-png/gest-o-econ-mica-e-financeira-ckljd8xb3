/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const contas = app.findCollectionByNameOrId('contas')

    // Adiciona o campo classificacao_dre na collection contas
    if (!contas.fields.getByName('classificacao_dre')) {
      contas.fields.add(
        new SelectField({
          name: 'classificacao_dre',
          values: [
            'Receita',
            'Despesa Variável',
            'Despesa Fixa',
            'Despesa Financeira',
            'Receita Financeira',
          ],
          maxSelect: 1,
          required: false,
        }),
      )
      app.save(contas)
    }

    // Heurística inicial de preenchimento para registros já existentes
    // Ex.: contas contendo "receita", "vendas", "faturamento", "serviços" → Receita;
    // "juros", "tarifas bancárias", "IOF", "empréstimo", "financiamento" → Despesa Financeira;
    // "rendimento", "aplicação", "receita financeira" → Receita Financeira;
    // aluguel/salários/energia/água/telefone/internet/contabilidade → Despesa Fixa;
    // comissão/frete/imposto sobre venda/matéria-prima → Despesa Variável.
    try {
      // Receita Financeira
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
            OR LOWER(nome) LIKE '%juros ativos%'
            OR LOWER(nome) LIKE '%desconto obtido%'
            OR LOWER(nome) LIKE '%descontos obtidos%'
          )
      `)
        .execute()

      // Despesa Financeira
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
          )
      `)
        .execute()

      // Despesa Variável
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
            OR LOWER(nome) LIKE '%embalage%'
            OR LOWER(nome) LIKE '%custo mercadoria%'
            OR LOWER(nome) LIKE '%custo do produto%'
            OR LOWER(nome) LIKE '%cpv%'
            OR LOWER(nome) LIKE '%cmv%'
            OR LOWER(nome) LIKE '%csv%'
            OR LOWER(nome) LIKE '%simples nacional%'
            OR LOWER(nome) LIKE '%icms%'
            OR LOWER(nome) LIKE '%iss%'
            OR LOWER(nome) LIKE '%pis%'
            OR LOWER(nome) LIKE '%cofins%'
          )
      `)
        .execute()

      // Despesa Fixa
      app
        .db()
        .newQuery(`
        UPDATE contas
        SET classificacao_dre = 'Despesa Fixa'
        WHERE (classificacao_dre IS NULL OR classificacao_dre = '')
          AND (
            LOWER(nome) LIKE '%aluguel%'
            OR LOWER(nome) LIKE '%salário%'
            OR LOWER(nome) LIKE '%salario%'
            OR LOWER(nome) LIKE '%folha%'
            OR LOWER(nome) LIKE '%pró-labore%'
            OR LOWER(nome) LIKE '%pro-labore%'
            OR LOWER(nome) LIKE '%pro labore%'
            OR LOWER(nome) LIKE '%energia%'
            OR LOWER(nome) LIKE '%luz%'
            OR LOWER(nome) LIKE '%água%'
            OR LOWER(nome) LIKE '%agua%'
            OR LOWER(nome) LIKE '%telefone%'
            OR LOWER(nome) LIKE '%internet%'
            OR LOWER(nome) LIKE '%contabilidade%'
            OR LOWER(nome) LIKE '%contador%'
            OR LOWER(nome) LIKE '%honorários%'
            OR LOWER(nome) LIKE '%honorarios%'
            OR LOWER(nome) LIKE '%limpeza%'
            OR LOWER(nome) LIKE '%segurança%'
            OR LOWER(nome) LIKE '%seguranca%'
            OR LOWER(nome) LIKE '%manutenção%'
            OR LOWER(nome) LIKE '%manutencao%'
            OR LOWER(nome) LIKE '%software%'
            OR LOWER(nome) LIKE '%sistema%'
            OR LOWER(nome) LIKE '%depreciação%'
            OR LOWER(nome) LIKE '%depreciacao%'
            OR LOWER(nome) LIKE '%administrativ%'
          )
      `)
        .execute()

      // Receita
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
          )
      `)
        .execute()

      // Para despesas restantes que tenham tipo='Despesa' e não classificadas, definir 'Despesa Fixa' como fallback se desejado,
      // ou manter vazio para que a heurística frontend/usuário possa identificar ou cair em "Não classificados"
    } catch (e) {
      console.log('Aviso ao aplicar heurística em contas existentes:', e)
    }
  },
  (app) => {
    const contas = app.findCollectionByNameOrId('contas')
    if (contas.fields.getByName('classificacao_dre')) {
      contas.fields.removeByName('classificacao_dre')
      app.save(contas)
    }
  },
)
