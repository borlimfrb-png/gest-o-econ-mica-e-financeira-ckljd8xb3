migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('recebiveis')
    let contratosColId = ''
    try {
      contratosColId = app.findCollectionByNameOrId('contratos').id
    } catch (_) {}

    // 1. Campo de referência para o contrato de origem (relation contratos, opcional)
    if (!col.fields.getByName('contrato')) {
      if (contratosColId) {
        col.fields.add(
          new RelationField({
            name: 'contrato',
            collectionId: contratosColId,
            cascadeDelete: false,
            maxSelect: 1,
            required: false,
          }),
        )
      } else {
        col.fields.add(
          new TextField({
            name: 'contrato',
            required: false,
          }),
        )
      }
    }

    // 2. Campo descrição do título (ex: "Contrato 0cs3pzwqcwjw54q — Parcela 1/13")
    if (!col.fields.getByName('descricao')) {
      col.fields.add(
        new TextField({
          name: 'descricao',
          required: false,
        }),
      )
    }

    // 3. Forma de pagamento pactuada (ex: Pix, Boleto Bancário, etc.)
    if (!col.fields.getByName('forma_pagamento')) {
      col.fields.add(
        new TextField({
          name: 'forma_pagamento',
          required: false,
        }),
      )
    }

    // 4. Período ordem / id de referência da faixa do cronograma
    if (!col.fields.getByName('periodo_ordem')) {
      col.fields.add(
        new NumberField({
          name: 'periodo_ordem',
          required: false,
        }),
      )
    }

    // Índice para busca rápida de títulos por contrato
    try {
      col.indexes.push(
        'CREATE INDEX IF NOT EXISTS idx_recebiveis_contrato ON recebiveis (contrato)',
      )
    } catch (_) {}

    app.save(col)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('recebiveis')
      const fieldsToRemove = ['contrato', 'descricao', 'forma_pagamento', 'periodo_ordem']
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
