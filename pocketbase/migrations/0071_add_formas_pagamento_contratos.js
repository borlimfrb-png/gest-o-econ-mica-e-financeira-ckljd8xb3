migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('contratos')

    // Forma de pagamento 1
    if (!col.fields.getByName('forma_pagamento_1')) {
      col.fields.add(
        new TextField({
          name: 'forma_pagamento_1',
          required: false,
        }),
      )
    }

    if (!col.fields.getByName('valor_1')) {
      col.fields.add(
        new NumberField({
          name: 'valor_1',
          required: false,
        }),
      )
    }

    if (!col.fields.getByName('vencimento_1')) {
      col.fields.add(
        new DateField({
          name: 'vencimento_1',
          required: false,
        }),
      )
    }

    // Forma de pagamento 2
    if (!col.fields.getByName('forma_pagamento_2')) {
      col.fields.add(
        new TextField({
          name: 'forma_pagamento_2',
          required: false,
        }),
      )
    }

    if (!col.fields.getByName('valor_2')) {
      col.fields.add(
        new NumberField({
          name: 'valor_2',
          required: false,
        }),
      )
    }

    if (!col.fields.getByName('vencimento_2')) {
      col.fields.add(
        new DateField({
          name: 'vencimento_2',
          required: false,
        }),
      )
    }

    // Campo adicional para notas/observações sobre condições de pagamento
    if (!col.fields.getByName('observacoes_pagamento')) {
      col.fields.add(
        new TextField({
          name: 'observacoes_pagamento',
          required: false,
        }),
      )
    }

    app.save(col)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('contratos')
      const fieldsToRemove = [
        'forma_pagamento_1',
        'valor_1',
        'vencimento_1',
        'forma_pagamento_2',
        'valor_2',
        'vencimento_2',
        'observacoes_pagamento',
      ]
      for (const fieldName of fieldsToRemove) {
        const field = col.fields.getByName(fieldName)
        if (field) {
          col.fields.removeByName(fieldName)
        }
      }
      app.save(col)
    } catch (_) {}
  },
)
