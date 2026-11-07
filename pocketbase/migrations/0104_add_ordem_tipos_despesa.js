/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId('tipos_despesa')
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
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('tipos_despesa')
    const existing = collection.fields.getByName('ordem')
    if (existing) {
      collection.fields.removeByName('ordem')
      app.save(collection)
    }
  },
)
