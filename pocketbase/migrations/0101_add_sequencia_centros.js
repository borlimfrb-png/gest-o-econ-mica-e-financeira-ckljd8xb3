/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId('centros')
    const existing = collection.fields.getByName('sequencia')
    if (!existing) {
      collection.fields.add(
        new NumberField({
          name: 'sequencia',
          required: false,
          presentable: false,
        }),
      )
      app.save(collection)
    }
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('centros')
    const existing = collection.fields.getByName('sequencia')
    if (existing) {
      collection.fields.removeByName('sequencia')
      app.save(collection)
    }
  },
)
