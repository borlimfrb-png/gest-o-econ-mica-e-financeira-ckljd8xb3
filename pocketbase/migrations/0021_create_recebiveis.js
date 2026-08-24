// Cria a collection "recebiveis" — parcelas de recebimentos vinculadas a uma empresa e usuário
// Campos:
// - user: relation users
// - empresa: relation empresas
// - parcela: number (número da parcela, ex: 1, 2, ...)
// - vencimento: date (data de vencimento da parcela)
// - valor: number (valor da parcela em R$)
// - status: select ('Pendente', 'Pago')
// - data_pagamento: date (data da baixa/pagamento, opcional)
// - data_inicio_servicos: date (data de início dos serviços)
// - created / updated: autodate

migrate(
  (app) => {
    const usersId = '_pb_users_auth_'
    const empresasId = app.findCollectionByNameOrId('empresas').id

    const recebiveis = new Collection({
      name: 'recebiveis',
      type: 'base',
      listRule: '@request.auth.id != "" && user = @request.auth.id',
      viewRule: '@request.auth.id != "" && user = @request.auth.id',
      createRule: '@request.auth.id != ""',
      updateRule: '@request.auth.id != "" && user = @request.auth.id',
      deleteRule: '@request.auth.id != "" && user = @request.auth.id',
      fields: [
        {
          name: 'user',
          type: 'relation',
          required: true,
          collectionId: usersId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'empresa',
          type: 'relation',
          required: true,
          collectionId: empresasId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'parcela',
          type: 'number',
          required: true,
          min: 1,
        },
        {
          name: 'vencimento',
          type: 'date',
          required: true,
        },
        {
          name: 'valor',
          type: 'number',
          required: true,
          min: 0,
        },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['Pendente', 'Pago'],
          maxSelect: 1,
        },
        {
          name: 'data_pagamento',
          type: 'date',
          required: false,
        },
        {
          name: 'data_inicio_servicos',
          type: 'date',
          required: true,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_recebiveis_user ON recebiveis (user)',
        'CREATE INDEX idx_recebiveis_empresa ON recebiveis (empresa)',
        'CREATE INDEX idx_recebiveis_vencimento ON recebiveis (vencimento)',
        'CREATE INDEX idx_recebiveis_status ON recebiveis (status)',
      ],
    })
    app.save(recebiveis)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('recebiveis')
      app.delete(col)
    } catch (_) {}
  },
)
