migrate(
  (app) => {
    const empresas = app.findCollectionByNameOrId('empresas')
    const collection = new Collection({
      name: 'metas_lancamentos',
      type: 'base',
      listRule: "@request.auth.id != '' && user = @request.auth.id",
      viewRule: "@request.auth.id != '' && user = @request.auth.id",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != '' && user = @request.auth.id",
      deleteRule: "@request.auth.id != '' && user = @request.auth.id",
      fields: [
        {
          name: 'empresa',
          type: 'relation',
          required: true,
          collectionId: empresas.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'tipo',
          type: 'select',
          required: true,
          values: ['Receita', 'Despesa'],
          maxSelect: 1,
        },
        {
          name: 'valor',
          type: 'number',
          required: true,
          min: 0,
        },
        {
          name: 'mes',
          type: 'number',
          required: true,
          min: 1,
          max: 12,
          onlyInt: true,
        },
        {
          name: 'ano',
          type: 'number',
          required: true,
          min: 2000,
          max: 2100,
          onlyInt: true,
        },
        {
          name: 'ativo',
          type: 'bool',
        },
        {
          name: 'user',
          type: 'relation',
          required: true,
          collectionId: '_pb_users_auth_',
          cascadeDelete: true,
          maxSelect: 1,
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
        'CREATE INDEX idx_metas_user ON metas_lancamentos (user)',
        'CREATE INDEX idx_metas_empresa ON metas_lancamentos (empresa)',
        'CREATE INDEX idx_metas_ano_mes ON metas_lancamentos (ano, mes)',
      ],
    })

    app.save(collection)
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId('metas_lancamentos')
      app.delete(collection)
    } catch (_) {}
  },
)
