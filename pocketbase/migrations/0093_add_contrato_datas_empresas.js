migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('empresas')

    // 1. Data de Início do Contrato (opcional)
    if (!col.fields.getByName('data_inicio_contrato')) {
      col.fields.add(new DateField({ name: 'data_inicio_contrato' }))
    }

    // 2. Data de Fim do Contrato (opcional)
    if (!col.fields.getByName('data_fim_contrato')) {
      col.fields.add(new DateField({ name: 'data_fim_contrato' }))
    }

    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('empresas')
    ;['data_inicio_contrato', 'data_fim_contrato'].forEach((name) => {
      const f = col.fields.getByName(name)
      if (f) col.fields.remove(f)
    })
    app.save(col)
  },
)
