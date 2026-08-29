migrate(
  (app) => {
    // 1. Coleção produtos
    const produtos = new Collection({
      name: 'produtos',
      type: 'base',
      listRule: "@request.auth.id != '' && user = @request.auth.id",
      viewRule: "@request.auth.id != '' && user = @request.auth.id",
      createRule: "@request.auth.id != '' && @request.body.user = @request.auth.id",
      updateRule: "@request.auth.id != '' && user = @request.auth.id",
      deleteRule: "@request.auth.id != '' && user = @request.auth.id",
      fields: [
        {
          name: 'user',
          type: 'relation',
          required: true,
          collectionId: '_pb_users_auth_',
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'codigo', type: 'text' },
        { name: 'nome', type: 'text', required: true },
        { name: 'unidade', type: 'text', required: true },
        { name: 'categoria', type: 'text' },
        { name: 'custo', type: 'number', min: 0 },
        { name: 'preco_venda', type: 'number', min: 0 },
        { name: 'margem_desejada', type: 'number' },
        { name: 'observacoes', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_produtos_user ON produtos (user)',
        'CREATE INDEX idx_produtos_codigo ON produtos (user, codigo)',
      ],
    })
    app.save(produtos)

    // 2. Coleção materias_primas
    const materiasPrimas = new Collection({
      name: 'materias_primas',
      type: 'base',
      listRule: "@request.auth.id != '' && user = @request.auth.id",
      viewRule: "@request.auth.id != '' && user = @request.auth.id",
      createRule: "@request.auth.id != '' && @request.body.user = @request.auth.id",
      updateRule: "@request.auth.id != '' && user = @request.auth.id",
      deleteRule: "@request.auth.id != '' && user = @request.auth.id",
      fields: [
        {
          name: 'user',
          type: 'relation',
          required: true,
          collectionId: '_pb_users_auth_',
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'codigo', type: 'text' },
        { name: 'nome', type: 'text', required: true },
        { name: 'unidade', type: 'text', required: true },
        { name: 'categoria', type: 'text' },
        { name: 'custo_unitario', type: 'number', min: 0 },
        { name: 'estoque_atual', type: 'number' },
        { name: 'observacoes', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_materias_primas_user ON materias_primas (user)',
        'CREATE INDEX idx_materias_primas_codigo ON materias_primas (user, codigo)',
      ],
    })
    app.save(materiasPrimas)

    // 3. Coleção fichas_tecnicas
    const produtosColId = app.findCollectionByNameOrId('produtos').id
    const fichasTecnicas = new Collection({
      name: 'fichas_tecnicas',
      type: 'base',
      listRule: "@request.auth.id != '' && user = @request.auth.id",
      viewRule: "@request.auth.id != '' && user = @request.auth.id",
      createRule: "@request.auth.id != '' && @request.body.user = @request.auth.id",
      updateRule: "@request.auth.id != '' && user = @request.auth.id",
      deleteRule: "@request.auth.id != '' && user = @request.auth.id",
      fields: [
        {
          name: 'user',
          type: 'relation',
          required: true,
          collectionId: '_pb_users_auth_',
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'produto',
          type: 'relation',
          required: true,
          collectionId: produtosColId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'itens', type: 'json' },
        { name: 'custo_materia_prima', type: 'number', min: 0 },
        { name: 'outros_custos', type: 'number', min: 0 },
        { name: 'custo_total', type: 'number', min: 0 },
        { name: 'margem_desejada', type: 'number' },
        { name: 'preco_venda_sugerido', type: 'number', min: 0 },
        { name: 'observacoes', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_fichas_tecnicas_user ON fichas_tecnicas (user)',
        'CREATE INDEX idx_fichas_tecnicas_produto ON fichas_tecnicas (user, produto)',
      ],
    })
    app.save(fichasTecnicas)
  },
  (app) => {
    try {
      const fichas = app.findCollectionByNameOrId('fichas_tecnicas')
      app.delete(fichas)
    } catch (_) {}
    try {
      const materias = app.findCollectionByNameOrId('materias_primas')
      app.delete(materias)
    } catch (_) {}
    try {
      const produtos = app.findCollectionByNameOrId('produtos')
      app.delete(produtos)
    } catch (_) {}
  },
)
