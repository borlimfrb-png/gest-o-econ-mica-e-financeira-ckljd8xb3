migrate(
  (app) => {
    const metasCol = app.findCollectionByNameOrId('metas_lancamentos')

    const collection = new Collection({
      name: 'alertas_enviados',
      type: 'base',
      listRule: "@request.auth.id != '' && user = @request.auth.id",
      viewRule: "@request.auth.id != '' && user = @request.auth.id",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != '' && user = @request.auth.id",
      deleteRule: "@request.auth.id != '' && user = @request.auth.id",
      fields: [
        {
          name: 'meta',
          type: 'relation',
          required: true,
          collectionId: metasCol.id,
          cascadeDelete: true,
          maxSelect: 1,
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
          name: 'tipo_alerta',
          type: 'text',
          required: true,
        },
        {
          name: 'data_envio',
          type: 'text',
          required: true,
        },
        {
          name: 'atingimento_pct',
          type: 'number',
        },
        {
          name: 'dias_restantes',
          type: 'number',
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
        'CREATE INDEX idx_alertas_meta_data ON alertas_enviados (meta, data_envio)',
        'CREATE INDEX idx_alertas_user ON alertas_enviados (user)',
      ],
    })

    app.save(collection)
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId('alertas_enviados')
      app.delete(collection)
    } catch (_) {}
  },
)
