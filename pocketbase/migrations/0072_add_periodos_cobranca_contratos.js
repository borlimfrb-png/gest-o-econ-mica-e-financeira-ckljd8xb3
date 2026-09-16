migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('contratos')

    // Campo JSON para armazenar os períodos de cobrança recorrentes
    // Cada item pode conter: { id, data_inicio, data_final, valor_mensal, forma_pagamento, meses, total }
    if (!col.fields.getByName('periodos_cobranca')) {
      col.fields.add(
        new JSONField({
          name: 'periodos_cobranca',
          required: false,
        }),
      )
    }

    app.save(col)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('contratos')
      if (col.fields.getByName('periodos_cobranca')) {
        col.fields.removeByName('periodos_cobranca')
        app.save(col)
      }
    } catch (_) {}
  },
)
