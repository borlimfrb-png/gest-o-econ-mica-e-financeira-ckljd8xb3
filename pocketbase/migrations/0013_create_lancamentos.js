// Cria a collection "lancamentos" — lançamentos financeiros vinculados a uma empresa,
// a uma conta do plano de contas (plano_contas), data, valor e histórico.
// Regras de acesso: apenas o proprietário (user = @request.auth.id).

migrate(
  (app) => {
    const usersId = '_pb_users_auth_'
    const empresasId = app.findCollectionByNameOrId('empresas').id
    const planoContasId = app.findCollectionByNameOrId('plano_contas').id

    const lancamentos = new Collection({
      name: 'lancamentos',
      type: 'base',
      listRule: '@request.auth.id != "" && user = @request.auth.id',
      viewRule: '@request.auth.id != "" && user = @request.auth.id',
      createRule: '@request.auth.id != ""',
      updateRule: '@request.auth.id != "" && user = @request.auth.id',
      deleteRule: '@request.auth.id != "" && user = @request.auth.id',
      fields: [
        {
          name: 'empresa',
          type: 'relation',
          required: true,
          collectionId: empresasId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'plano_conta',
          type: 'relation',
          required: true,
          collectionId: planoContasId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'data',
          type: 'date',
          required: true,
        },
        {
          name: 'valor',
          type: 'number',
          required: true,
        },
        {
          name: 'historico',
          type: 'text',
          required: false,
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
        'CREATE INDEX idx_lancamentos_user ON lancamentos (user)',
        'CREATE INDEX idx_lancamentos_empresa ON lancamentos (empresa)',
        'CREATE INDEX idx_lancamentos_plano_conta ON lancamentos (plano_conta)',
        'CREATE INDEX idx_lancamentos_data ON lancamentos (data)',
      ],
    })
    app.save(lancamentos)
  },
  (app) => {
    try {
      const lancamentos = app.findCollectionByNameOrId('lancamentos')
      app.delete(lancamentos)
    } catch (_) {}
  },
)
