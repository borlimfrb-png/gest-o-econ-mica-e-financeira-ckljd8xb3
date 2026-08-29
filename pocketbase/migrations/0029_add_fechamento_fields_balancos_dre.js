// Adiciona campos de controle de fechamento mensal nas coleções `balancos` e `dre`:
// `fechado` (bool), `fechado_em` (text/date), `fechado_por` (text/relation), `fechamento_obs` (text)

migrate(
  (app) => {
    // 1. Coleção balancos
    const balCol = app.findCollectionByNameOrId('balancos')
    if (!balCol.fields.getByName('fechado')) {
      balCol.fields.add(
        new BoolField({
          name: 'fechado',
          required: false,
        }),
      )
    }
    if (!balCol.fields.getByName('fechado_em')) {
      balCol.fields.add(
        new TextField({
          name: 'fechado_em',
          required: false,
        }),
      )
    }
    if (!balCol.fields.getByName('fechamento_obs')) {
      balCol.fields.add(
        new TextField({
          name: 'fechamento_obs',
          required: false,
        }),
      )
    }
    app.save(balCol)

    // 2. Coleção dre
    const dreCol = app.findCollectionByNameOrId('dre')
    if (!dreCol.fields.getByName('fechado')) {
      dreCol.fields.add(
        new BoolField({
          name: 'fechado',
          required: false,
        }),
      )
    }
    if (!dreCol.fields.getByName('fechado_em')) {
      dreCol.fields.add(
        new TextField({
          name: 'fechado_em',
          required: false,
        }),
      )
    }
    if (!dreCol.fields.getByName('fechamento_obs')) {
      dreCol.fields.add(
        new TextField({
          name: 'fechamento_obs',
          required: false,
        }),
      )
    }
    app.save(dreCol)
  },
  (app) => {
    const balCol = app.findCollectionByNameOrId('balancos')
    if (balCol.fields.getByName('fechado')) balCol.fields.removeByName('fechado')
    if (balCol.fields.getByName('fechado_em')) balCol.fields.removeByName('fechado_em')
    if (balCol.fields.getByName('fechamento_obs')) balCol.fields.removeByName('fechamento_obs')
    app.save(balCol)

    const dreCol = app.findCollectionByNameOrId('dre')
    if (dreCol.fields.getByName('fechado')) dreCol.fields.removeByName('fechado')
    if (dreCol.fields.getByName('fechado_em')) dreCol.fields.removeByName('fechado_em')
    if (dreCol.fields.getByName('fechamento_obs')) dreCol.fields.removeByName('fechamento_obs')
    app.save(dreCol)
  },
)
