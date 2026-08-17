migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('centros')

    // Adiciona o campo "meta_mensal" (number, opcional) se ainda não existir.
    if (!col.fields.getByName('meta_mensal')) {
      col.fields.add(new NumberField({ name: 'meta_mensal', required: false }))
    }
    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('centros')
    const f = col.fields.getByName('meta_mensal')
    if (f) col.fields.remove(f)
    app.save(col)
  },
)
