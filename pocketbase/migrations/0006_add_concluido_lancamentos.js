migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('lancamentos_centro')

    // Adiciona o campo "concluido" (bool, default false) se ainda não existir.
    // Importante: bool NUNCA deve ser required (false seria tratado como vazio).
    if (!col.fields.getByName('concluido')) {
      col.fields.add(new BoolField({ name: 'concluido', required: false }))
    }
    app.save(col)

    // Garante o valor padrão false para registros já existentes
    app
      .db()
      .newQuery('UPDATE lancamentos_centro SET concluido = 0 WHERE concluido IS NULL')
      .execute()
  },
  (app) => {
    const col = app.findCollectionByNameOrId('lancamentos_centro')
    const f = col.fields.getByName('concluido')
    if (f) col.fields.remove(f)
    app.save(col)
  },
)
