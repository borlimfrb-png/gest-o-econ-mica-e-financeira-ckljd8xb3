migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('materias_primas')

    if (!col.fields.getByName('isenta_st')) {
      col.fields.add(
        new BoolField({
          name: 'isenta_st',
        }),
      )
    }

    if (!col.fields.getByName('tipo_tributacao')) {
      col.fields.add(
        new SelectField({
          name: 'tipo_tributacao',
          values: ['tributada', 'isenta', 'substituicao_tributaria'],
          maxSelect: 1,
        }),
      )
    }

    app.save(col)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('materias_primas')
      col.fields.removeByName('isenta_st')
      col.fields.removeByName('tipo_tributacao')
      app.save(col)
    } catch (_) {}
  },
)
