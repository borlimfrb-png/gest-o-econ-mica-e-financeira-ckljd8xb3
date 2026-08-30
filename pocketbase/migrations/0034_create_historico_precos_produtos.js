migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    const produtos = app.findCollectionByNameOrId('produtos')

    const collection = new Collection({
      name: 'historico_precos_produtos',
      type: 'base',
      listRule: "@request.auth.id != '' && user = @request.auth.id",
      viewRule: "@request.auth.id != '' && user = @request.auth.id",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != '' && user = @request.auth.id",
      deleteRule: "@request.auth.id != '' && user = @request.auth.id",
      fields: [
        {
          name: 'user',
          type: 'relation',
          required: true,
          collectionId: users.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'produto',
          type: 'relation',
          required: true,
          collectionId: produtos.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'preco_anterior',
          type: 'number',
        },
        {
          name: 'preco_novo',
          type: 'number',
          required: true,
        },
        {
          name: 'margem_anterior',
          type: 'number',
        },
        {
          name: 'margem_nova',
          type: 'number',
        },
        {
          name: 'custo_momento',
          type: 'number',
        },
        {
          name: 'origem',
          type: 'select',
          required: true,
          values: [
            'Edição Manual',
            'Preço Sugerido Margem',
            'Preço Sugerido Markup',
            'Cadastro Inicial',
            'Outro',
          ],
          maxSelect: 1,
        },
        {
          name: 'observacao',
          type: 'text',
        },
        {
          name: 'created',
          type: 'autodate',
          onCreate: true,
          onUpdate: false,
        },
        {
          name: 'updated',
          type: 'autodate',
          onCreate: true,
          onUpdate: true,
        },
      ],
      indexes: [
        'CREATE INDEX idx_hist_preco_user ON historico_precos_produtos (user)',
        'CREATE INDEX idx_hist_preco_produto ON historico_precos_produtos (produto)',
        'CREATE INDEX idx_hist_preco_produto_created ON historico_precos_produtos (produto, created DESC)',
      ],
    })

    app.save(collection)
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId('historico_precos_produtos')
      app.delete(collection)
    } catch (_) {}
  },
)
