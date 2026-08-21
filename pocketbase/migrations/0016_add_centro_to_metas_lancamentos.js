migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('metas_lancamentos')
    const centrosCol = app.findCollectionByNameOrId('centros')

    if (!col.fields.getByName('centro')) {
      col.fields.add(
        new RelationField({
          name: 'centro',
          collectionId: centrosCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        }),
      )
      app.save(col)
    }
  },
  (app) => {
    const col = app.findCollectionByNameOrId('metas_lancamentos')
    const field = col.fields.getByName('centro')
    if (field) {
      col.fields.removeByName('centro')
      app.save(col)
    }
  },
)
