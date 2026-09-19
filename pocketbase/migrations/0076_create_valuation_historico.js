/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    const empresasCol = app.findCollectionByNameOrId('empresas')

    // Criar coleção valuation_historico para salvar snapshots por empresa/ano/metodologia
    let histCol
    try {
      histCol = app.findCollectionByNameOrId('valuation_historico')
    } catch (_) {
      histCol = new Collection({
        name: 'valuation_historico',
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
            name: 'metodologia',
            type: 'select',
            required: true,
            values: ['fcd', 'superlucro', 'multiplos', 'consenso'],
            maxSelect: 1,
          },
          {
            name: 'valor',
            type: 'number',
            required: true,
          },
          {
            name: 'detalhes',
            type: 'json',
            required: false,
          },
          {
            name: 'data_calculo',
            type: 'text',
            required: false,
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
          'CREATE UNIQUE INDEX idx_val_hist_empresa_ano_metodologia ON valuation_historico (empresa, ano, metodologia)',
          'CREATE INDEX idx_val_hist_empresa ON valuation_historico (empresa)',
          'CREATE INDEX idx_val_hist_ano ON valuation_historico (ano)',
          'CREATE INDEX idx_val_hist_metodologia ON valuation_historico (metodologia)',
        ],
      })
      app.save(histCol)
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('valuation_historico')
      app.delete(col)
    } catch (_) {}
  },
)
