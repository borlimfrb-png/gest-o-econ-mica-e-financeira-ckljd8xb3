// Adiciona campos lembrete_agendado e lembrete_enviado na coleção "recebiveis"
migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('recebiveis')

    if (!col.fields.getByName('lembrete_agendado')) {
      col.fields.add(
        new BoolField({
          name: 'lembrete_agendado',
          required: false,
        }),
      )
    }

    if (!col.fields.getByName('lembrete_enviado')) {
      col.fields.add(
        new BoolField({
          name: 'lembrete_enviado',
          required: false,
        }),
      )
    }

    app.save(col)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('recebiveis')
      const f1 = col.fields.getByName('lembrete_agendado')
      if (f1) col.fields.remove(f1)
      const f2 = col.fields.getByName('lembrete_enviado')
      if (f2) col.fields.remove(f2)
      app.save(col)
    } catch (_) {}
  },
)
