migrate(
  (app) => {
    // Resolve o id da coleção users (built-in)
    const usersId = '_pb_users_auth_'

    // 1. Coleção "centros" — centros de custo (Receita/Despesa)
    const centros = new Collection({
      name: 'centros',
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
          name: 'tipo',
          type: 'select',
          required: true,
          values: ['Receita', 'Despesa'],
          maxSelect: 1,
        },
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
      indexes: [
        'CREATE INDEX idx_centros_user ON centros (user)',
        'CREATE INDEX idx_centros_tipo ON centros (tipo)',
      ],
    })
    app.save(centros)

    // Resolve o id recém-criado da coleção centros para usar na relação
    const centrosId = app.findCollectionByNameOrId('centros').id

    // 2. Coleção "lancamentos_centro" — lançamentos (data + valor) por centro
    const lancamentos = new Collection({
      name: 'lancamentos_centro',
      type: 'base',
      listRule: '@request.auth.id != "" && user = @request.auth.id',
      viewRule: '@request.auth.id != "" && user = @request.auth.id',
      createRule: '@request.auth.id != ""',
      updateRule: '@request.auth.id != "" && user = @request.auth.id',
      deleteRule: '@request.auth.id != "" && user = @request.auth.id',
      fields: [
        {
          name: 'centro',
          type: 'relation',
          required: true,
          collectionId: centrosId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'data', type: 'date', required: true },
        { name: 'valor', type: 'number', required: true, min: 0 },
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
      indexes: [
        'CREATE INDEX idx_lancamentos_centro_centro ON lancamentos_centro (centro)',
        'CREATE INDEX idx_lancamentos_centro_data ON lancamentos_centro (data)',
        'CREATE INDEX idx_lancamentos_centro_user ON lancamentos_centro (user)',
      ],
    })
    app.save(lancamentos)
  },
  (app) => {
    // Remove lancamentos_centro primeiro (depende de centros)
    try {
      const lancamentos = app.findCollectionByNameOrId('lancamentos_centro')
      app.delete(lancamentos)
    } catch (_) {}

    try {
      const centros = app.findCollectionByNameOrId('centros')
      app.delete(centros)
    } catch (_) {}
  },
)
