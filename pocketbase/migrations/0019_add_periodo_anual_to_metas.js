migrate(
  (app) => {
    const metasCol = app.findCollectionByNameOrId('metas_lancamentos')
    const periodoField = metasCol.fields.getByName('periodo')
    if (periodoField) {
      periodoField.values = ['Mensal', 'Trimestral', 'Anual']
    } else {
      metasCol.fields.add(
        new SelectField({
          name: 'periodo',
          required: false,
          values: ['Mensal', 'Trimestral', 'Anual'],
          maxSelect: 1,
        }),
      )
    }
    app.save(metasCol)
  },
  (app) => {
    try {
      const metasCol = app.findCollectionByNameOrId('metas_lancamentos')
      const periodoField = metasCol.fields.getByName('periodo')
      if (periodoField) {
        periodoField.values = ['Mensal', 'Trimestral']
        app.save(metasCol)
      }
    } catch (_) {}
  },
)
