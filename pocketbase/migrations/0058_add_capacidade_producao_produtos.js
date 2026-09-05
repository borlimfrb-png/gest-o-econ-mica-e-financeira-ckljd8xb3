migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('produtos')
    if (!col.fields.getByName('capacidade_producao')) {
      col.fields.add(
        new NumberField({
          name: 'capacidade_producao',
          min: 0,
          onlyInt: false,
        }),
      )
      app.save(col)
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('produtos')
      col.fields.removeByName('capacidade_producao')
      app.save(col)
    } catch (_) {}
  },
)
