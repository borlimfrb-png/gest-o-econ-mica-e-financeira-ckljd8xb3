migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('materias_primas')

    if (!col.fields.getByName('icms_percentual')) {
      col.fields.add(
        new NumberField({
          name: 'icms_percentual',
          min: 0,
        }),
      )
    }

    if (!col.fields.getByName('pis_percentual')) {
      col.fields.add(
        new NumberField({
          name: 'pis_percentual',
          min: 0,
        }),
      )
    }

    if (!col.fields.getByName('cofins_percentual')) {
      col.fields.add(
        new NumberField({
          name: 'cofins_percentual',
          min: 0,
        }),
      )
    }

    app.save(col)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('materias_primas')
      col.fields.removeByName('icms_percentual')
      col.fields.removeByName('pis_percentual')
      col.fields.removeByName('cofins_percentual')
      app.save(col)
    } catch (_) {}
  },
)
