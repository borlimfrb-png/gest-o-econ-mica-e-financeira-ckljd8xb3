// Cria a collection "plano_contas" — vincula uma conta do plano de contas a um
// centro de custo (e opcionalmente a um tipo de despesa), com código sequencial
// automático (PC-001, PC-002, ...) por usuário, gerado via hook.
// Mesmo padrão já usado para contas (CO-NNN), centros (CC-NNN) e tipos (TD-NNN).

migrate(
  (app) => {
    const usersId = '_pb_users_auth_'
    const contasId = app.findCollectionByNameOrId('contas').id
    const centrosId = app.findCollectionByNameOrId('centros').id
    const tiposDespesaId = app.findCollectionByNameOrId('tipos_despesa').id

    const planoContas = new Collection({
      name: 'plano_contas',
      type: 'base',
      listRule: '@request.auth.id != "" && user = @request.auth.id',
      viewRule: '@request.auth.id != "" && user = @request.auth.id',
      createRule: '@request.auth.id != ""',
      updateRule: '@request.auth.id != "" && user = @request.auth.id',
      deleteRule: '@request.auth.id != "" && user = @request.auth.id',
      fields: [
        { name: 'codigo', type: 'text', required: false },
        {
          name: 'conta',
          type: 'relation',
          required: true,
          collectionId: contasId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'centro',
          type: 'relation',
          required: true,
          collectionId: centrosId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'tipo_despesa',
          type: 'relation',
          required: false,
          collectionId: tiposDespesaId,
          cascadeDelete: false,
          maxSelect: 1,
        },
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
      indexes: ['CREATE INDEX idx_plano_contas_user ON plano_contas (user)'],
    })
    app.save(planoContas)
  },
  (app) => {
    try {
      const planoContas = app.findCollectionByNameOrId('plano_contas')
      app.delete(planoContas)
    } catch (_) {}
  },
)
