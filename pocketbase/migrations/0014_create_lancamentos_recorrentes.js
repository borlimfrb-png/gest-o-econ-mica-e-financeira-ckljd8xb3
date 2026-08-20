// Cria a collection "lancamentos_recorrentes" — lançamentos que se repetem mensalmente em um dia específico (1 a 28).
// Campos: empresa, plano_conta, dia_mes (1-28), valor, historico, ativo (bool), user.
// Regras de acesso: apenas o proprietário (user = @request.auth.id).

migrate(
  (app) => {
    const usersId = '_pb_users_auth_'
    const empresasId = app.findCollectionByNameOrId('empresas').id
    const planoContasId = app.findCollectionByNameOrId('plano_contas').id

    const lancamentosRecorrentes = new Collection({
      name: 'lancamentos_recorrentes',
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
          name: 'dia_mes',
          type: 'number',
          required: true,
          min: 1,
          max: 28,
          onlyInt: true,
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
          name: 'ativo',
          type: 'bool',
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
        'CREATE INDEX idx_lancamentos_rec_user ON lancamentos_recorrentes (user)',
        'CREATE INDEX idx_lancamentos_rec_empresa ON lancamentos_recorrentes (empresa)',
        'CREATE INDEX idx_lancamentos_rec_plano_conta ON lancamentos_recorrentes (plano_conta)',
        'CREATE INDEX idx_lancamentos_rec_ativo ON lancamentos_recorrentes (ativo)',
      ],
    })
    app.save(lancamentosRecorrentes)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('lancamentos_recorrentes')
      app.delete(col)
    } catch (_) {}
  },
)
