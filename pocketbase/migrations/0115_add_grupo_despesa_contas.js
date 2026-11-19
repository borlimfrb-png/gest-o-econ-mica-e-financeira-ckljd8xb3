/// <reference path="../pb_data/types.d.ts" />
// Adiciona campo de texto `grupo_despesa` às contas gerenciais (plano de contas).
// Usado pelo "Estudo por Grupo de Despesas": agrupa as despesas fixas e compara
// cada grupo com o faturamento do período.
// Idempotente: no-op se o campo já existir.
migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId('contas')
    const existing = collection.fields.getByName('grupo_despesa')
    if (!existing) {
      collection.fields.add(
        new TextField({
          name: 'grupo_despesa',
          required: false,
          presentable: false,
        }),
      )
      app.save(collection)
    }
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('contas')
    const existing = collection.fields.getByName('grupo_despesa')
    if (existing) {
      collection.fields.removeByName('grupo_despesa')
      app.save(collection)
    }
  },
)
