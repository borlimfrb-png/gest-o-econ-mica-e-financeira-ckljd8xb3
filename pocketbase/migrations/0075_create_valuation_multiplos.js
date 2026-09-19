/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    const empresasCol = app.findCollectionByNameOrId('empresas')

    // Criar coleção valuation_multiplos para salvar referências e pesos por empresa/ano
    let valCol
    try {
      valCol = app.findCollectionByNameOrId('valuation_multiplos')
    } catch (_) {
      valCol = new Collection({
        name: 'valuation_multiplos',
        type: 'base',
        listRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || empresa = @request.auth.empresa)",
        viewRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || empresa = @request.auth.empresa)",
        createRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.body.empresa = @request.auth.empresa)",
        updateRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || empresa = @request.auth.empresa)",
        deleteRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || empresa = @request.auth.empresa)",
        fields: [
          {
            name: 'user',
            type: 'relation',
            required: false,
            collectionId: usersCol.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'empresa',
            type: 'relation',
            required: true,
            collectionId: empresasCol.id,
            cascadeDelete: true,
            maxSelect: 1,
          },
          {
            name: 'ano',
            type: 'number',
            required: true,
            onlyInt: true,
          },
          {
            name: 'segmento_referencia',
            type: 'text',
          },
          // Múltiplos de Referência (multiplicadores de mercado)
          {
            name: 'ev_ebitda_ref',
            type: 'number',
          },
          {
            name: 'pl_ref',
            type: 'number',
          },
          {
            name: 'pvp_ref',
            type: 'number',
          },
          {
            name: 'ev_receita_ref',
            type: 'number',
          },
          {
            name: 'ev_ebit_ref',
            type: 'number',
          },
          {
            name: 'p_ebitda_ref',
            type: 'number',
          },
          // Pesos relativos (em %, somando até 100%)
          {
            name: 'ev_ebitda_peso',
            type: 'number',
          },
          {
            name: 'pl_peso',
            type: 'number',
          },
          {
            name: 'pvp_peso',
            type: 'number',
          },
          {
            name: 'ev_receita_peso',
            type: 'number',
          },
          {
            name: 'ev_ebit_peso',
            type: 'number',
          },
          {
            name: 'p_ebitda_peso',
            type: 'number',
          },
          // Múltiplos ativos (flags ou JSON de configuração)
          {
            name: 'multiplos_ativos',
            type: 'json',
          },
          // Ajustes de dívida líquida / caixa adicional se necessário
          {
            name: 'divida_liquida_manual',
            type: 'number',
          },
          {
            name: 'observacoes',
            type: 'text',
          },
          {
            name: 'created',
            type: 'autodate',
            onCreate: true,
            onUpdate: false,
          },
          {
            name: 'updated',
            type: 'autodate',
            onCreate: true,
            onUpdate: true,
          },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_val_multiplos_empresa_ano ON valuation_multiplos (empresa, ano)',
          'CREATE INDEX idx_val_multiplos_empresa ON valuation_multiplos (empresa)',
          'CREATE INDEX idx_val_multiplos_ano ON valuation_multiplos (ano)',
        ],
      })
      app.save(valCol)
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('valuation_multiplos')
      app.delete(col)
    } catch (_) {}
  },
)
