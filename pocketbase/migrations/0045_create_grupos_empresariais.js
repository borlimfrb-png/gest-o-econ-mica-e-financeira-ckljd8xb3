migrate(
  (app) => {
    const empresasCol = app.findCollectionByNameOrId('empresas')

    const gruposEmpresariais = new Collection({
      name: 'grupos_empresariais',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'nome', type: 'text', required: true, min: 2 },
        { name: 'descricao', type: 'text' },
        {
          name: 'user',
          type: 'relation',
          collectionId: '_pb_users_auth_',
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'empresas',
          type: 'relation',
          required: false,
          collectionId: empresasCol.id,
          cascadeDelete: false,
          maxSelect: 500,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_grupos_empresariais_nome ON grupos_empresariais (nome)',
        'CREATE INDEX idx_grupos_empresariais_user ON grupos_empresariais (user)',
      ],
    })
    app.save(gruposEmpresariais)
  },
  (app) => {
    try {
      const gruposCol = app.findCollectionByNameOrId('grupos_empresariais')
      app.delete(gruposCol)
    } catch (_) {}
  },
)
