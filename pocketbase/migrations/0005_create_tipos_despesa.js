migrate(
  (app) => {
    const usersId = '_pb_users_auth_'

    // 1. Nova coleção "tipos_despesa" — tipos de despesa vinculados ao usuário
    const tiposDespesa = new Collection({
      name: 'tipos_despesa',
      type: 'base',
      listRule: '@request.auth.id != "" && user = @request.auth.id',
      viewRule: '@request.auth.id != "" && user = @request.auth.id',
      createRule: '@request.auth.id != ""',
      updateRule: '@request.auth.id != "" && user = @request.auth.id',
      deleteRule: '@request.auth.id != "" && user = @request.auth.id',
      fields: [
        { name: 'nome', type: 'text', required: true },
        { name: 'descricao', type: 'text', required: false },
        {
          name: 'user',
          type: 'relation',
          required: true,
          collectionId: usersId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_tipos_despesa_user ON tipos_despesa (user)'],
    })
    app.save(tiposDespesa)

    // Resolve o id recém-criado da coleção tipos_despesa
    const tiposDespesaId = app.findCollectionByNameOrId('tipos_despesa').id

    // 2. Adiciona campo "tipo_despesa" (relation opcional, on delete set null)
    //    na coleção "lancamentos_centro".
    const lancamentos = app.findCollectionByNameOrId('lancamentos_centro')
    if (!lancamentos.fields.getByName('tipo_despesa')) {
      lancamentos.fields.add(
        new RelationField({
          name: 'tipo_despesa',
          required: false,
          collectionId: tiposDespesaId,
          cascadeDelete: false, // on delete set null
          maxSelect: 1,
        }),
      )
    }
    app.save(lancamentos)
  },
  (app) => {
    // Remove o campo tipo_despesa da coleção lancamentos_centro
    try {
      const lancamentos = app.findCollectionByNameOrId('lancamentos_centro')
      const field = lancamentos.fields.getByName('tipo_despesa')
      if (field) {
        lancamentos.fields.remove(field)
        app.save(lancamentos)
      }
    } catch (_) {}

    // Remove a coleção tipos_despesa
    try {
      const tiposDespesa = app.findCollectionByNameOrId('tipos_despesa')
      app.delete(tiposDespesa)
    } catch (_) {}
  },
)
