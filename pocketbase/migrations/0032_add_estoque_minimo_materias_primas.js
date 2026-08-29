migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('materias_primas')
    if (!col.fields.getByName('estoque_minimo')) {
      col.fields.add(
        new NumberField({
          name: 'estoque_minimo',
          min: 0,
        }),
      )
      app.save(col)
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('materias_primas')
      col.fields.removeByName('estoque_minimo')
      app.save(col)
    } catch (_) {}
  },
)
