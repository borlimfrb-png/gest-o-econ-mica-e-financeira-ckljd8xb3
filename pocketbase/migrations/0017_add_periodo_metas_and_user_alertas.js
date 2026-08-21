migrate(
  (app) => {
    // 1. Atualizar users com o campo receber_alertas_email (bool)
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    if (!usersCol.fields.getByName('receber_alertas_email')) {
      usersCol.fields.add(
        new BoolField({
          name: 'receber_alertas_email',
          required: false,
        }),
      )
      app.save(usersCol)
    }

    // 2. Atualizar metas_lancamentos para suportar período 'Mensal' ou 'Trimestral' e trimestre 'Q1', 'Q2', 'Q3', 'Q4'
    const metasCol = app.findCollectionByNameOrId('metas_lancamentos')
    if (!metasCol.fields.getByName('periodo')) {
      metasCol.fields.add(
        new SelectField({
          name: 'periodo',
          required: false,
          values: ['Mensal', 'Trimestral'],
          maxSelect: 1,
        }),
      )
    }
    if (!metasCol.fields.getByName('trimestre')) {
      metasCol.fields.add(
        new SelectField({
          name: 'trimestre',
          required: false,
          values: ['Q1', 'Q2', 'Q3', 'Q4'],
          maxSelect: 1,
        }),
      )
    }
    app.save(metasCol)

    // Preencher valor padrão 'Mensal' para metas antigas
    app
      .db()
      .newQuery(
        "UPDATE metas_lancamentos SET periodo = 'Mensal' WHERE periodo IS NULL OR periodo = ''",
      )
      .execute()
  },
  (app) => {
    try {
      const metasCol = app.findCollectionByNameOrId('metas_lancamentos')
      if (metasCol.fields.getByName('periodo')) metasCol.fields.removeByName('periodo')
      if (metasCol.fields.getByName('trimestre')) metasCol.fields.removeByName('trimestre')
      app.save(metasCol)
    } catch (_) {}

    try {
      const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
      if (usersCol.fields.getByName('receber_alertas_email')) {
        usersCol.fields.removeByName('receber_alertas_email')
        app.save(usersCol)
      }
    } catch (_) {}
  },
)
