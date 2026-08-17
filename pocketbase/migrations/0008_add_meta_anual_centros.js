migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('centros')

    // Adiciona o campo "meta_anual" (number, opcional) se ainda não existir.
    if (!col.fields.getByName('meta_anual')) {
      col.fields.add(new NumberField({ name: 'meta_anual', required: false }))
    }
    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('centros')
    const f = col.fields.getByName('meta_anual')
    if (f) col.fields.remove(f)
    app.save(col)
  },
)
