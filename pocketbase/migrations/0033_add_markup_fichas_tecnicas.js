migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('fichas_tecnicas')

    if (!col.fields.getByName('markup_desejado')) {
      col.fields.add(
        new NumberField({
          name: 'markup_desejado',
        }),
      )
    }

    if (!col.fields.getByName('preco_venda_markup')) {
      col.fields.add(
        new NumberField({
          name: 'preco_venda_markup',
          min: 0,
        }),
      )
    }

    app.save(col)

    // Opcional: preencher markup_desejado calculado ou padrão para registros existentes se necessário
    try {
      app
        .db()
        .newQuery(
          `UPDATE fichas_tecnicas
           SET markup_desejado = CASE
             WHEN margem_desejada IS NOT NULL AND margem_desejada > 0 AND margem_desejada < 100
             THEN ROUND((margem_desejada / (100 - margem_desejada)) * 100, 2)
             ELSE 50
           END,
           preco_venda_markup = CASE
             WHEN custo_total IS NOT NULL AND custo_total > 0
             THEN ROUND(custo_total * (1 + (
               CASE
                 WHEN margem_desejada IS NOT NULL AND margem_desejada > 0 AND margem_desejada < 100
                 THEN (margem_desejada / (100 - margem_desejada))
                 ELSE 0.5
               END
             )), 2)
             ELSE 0
           END
           WHERE markup_desejado IS NULL`,
        )
        .execute()
    } catch (_) {}
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('fichas_tecnicas')
      col.fields.removeByName('markup_desejado')
      col.fields.removeByName('preco_venda_markup')
      app.save(col)
    } catch (_) {}
  },
)
