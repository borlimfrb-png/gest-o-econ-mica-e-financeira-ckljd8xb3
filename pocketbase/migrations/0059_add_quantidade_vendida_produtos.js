migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('produtos')
    if (!col.fields.getByName('quantidade_vendida')) {
      col.fields.add(
        new NumberField({
          name: 'quantidade_vendida',
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
      col.fields.removeByName('quantidade_vendida')
      app.save(col)
    } catch (_) {}
  },
)
