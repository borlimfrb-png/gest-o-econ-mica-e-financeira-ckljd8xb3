/// <reference path="../pb_data/types.d.ts" />
// Adiciona campo de ordenação manual às contas gerenciais (drag & drop em /contas).
// Idempotente: só adiciona o campo se ele ainda não existir.
migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId('contas')
    const existing = collection.fields.getByName('ordem')
    if (!existing) {
      collection.fields.add(
        new NumberField({
          name: 'ordem',
          required: false,
          presentable: false,
        }),
      )
      app.save(collection)
    }
    // Backfill determinístico: contas sem ordem recebem 1000, 1100, 1200...
    // (em ordem de código), reservando espaço para reordenações futuras.
    const records = app.findRecordsByFilter('contas', '', 'codigo', 0, 0)
    let i = 1000
    for (const record of records) {
      const atual = record.get('ordem')
      if (atual === null || atual === undefined || atual === 0) {
        record.set('ordem', i)
        app.save(record)
        i += 100
      }
    }
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('contas')
    const existing = collection.fields.getByName('ordem')
    if (existing) {
      collection.fields.removeByName('ordem')
      app.save(collection)
    }
  },
)
