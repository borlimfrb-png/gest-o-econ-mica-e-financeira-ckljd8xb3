migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('materias_primas')

    if (!col.fields.getByName('ipi_percentual')) {
      col.fields.add(
        new NumberField({
          name: 'ipi_percentual',
          min: 0,
        }),
      )
    }

    if (!col.fields.getByName('frete_percentual')) {
      col.fields.add(
        new NumberField({
          name: 'frete_percentual',
          min: 0,
        }),
      )
    }

    if (!col.fields.getByName('perdas_percentual')) {
      col.fields.add(
        new NumberField({
          name: 'perdas_percentual',
          min: 0,
        }),
      )
    }

    app.save(col)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('materias_primas')
      col.fields.removeByName('ipi_percentual')
      col.fields.removeByName('frete_percentual')
      col.fields.removeByName('perdas_percentual')
      app.save(col)
    } catch (_) {}
  },
)
