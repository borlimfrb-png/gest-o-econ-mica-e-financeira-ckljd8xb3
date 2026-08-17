// Cria a collection "contas" (plano de contas contábil) com código sequencial
// automático (CO-001, CO-002, ...) por usuário, gerado via hook.
// Mesmo padrão já usado para centros (CC-NNN) e tipos de despesa (TD-NNN).

migrate(
  (app) => {
    const usersId = '_pb_users_auth_'

    const contas = new Collection({
      name: 'contas',
      type: 'base',
      listRule: '@request.auth.id != "" && user = @request.auth.id',
      viewRule: '@request.auth.id != "" && user = @request.auth.id',
      createRule: '@request.auth.id != ""',
      updateRule: '@request.auth.id != "" && user = @request.auth.id',
      deleteRule: '@request.auth.id != "" && user = @request.auth.id',
      fields: [
        { name: 'codigo', type: 'text', required: false },
        { name: 'nome', type: 'text', required: true },
        { name: 'descricao', type: 'text', required: false },
        {
          name: 'tipo',
          type: 'select',
          required: true,
          values: ['Ativo', 'Passivo', 'Patrimônio Líquido', 'Receita', 'Despesa'],
          maxSelect: 1,
        },
        { name: 'grupo', type: 'text', required: false },
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
      indexes: ['CREATE INDEX idx_contas_user ON contas (user)'],
    })
    app.save(contas)
  },
  (app) => {
    try {
      const contas = app.findCollectionByNameOrId('contas')
      app.delete(contas)
    } catch (_) {}
  },
)
