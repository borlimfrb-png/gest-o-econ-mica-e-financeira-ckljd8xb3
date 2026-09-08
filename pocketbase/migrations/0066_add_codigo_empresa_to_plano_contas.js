migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('plano_contas')
    if (!col.fields.getByName('codigo_empresa')) {
      col.fields.add(
        new TextField({
          name: 'codigo_empresa',
          required: false,
        }),
      )
      app.save(col)
    }
  },
  (app) => {
    const col = app.findCollectionByNameOrId('plano_contas')
    const field = col.fields.getByName('codigo_empresa')
    if (field) {
      col.fields.removeByName('codigo_empresa')
      app.save(col)
    }
  },
)
