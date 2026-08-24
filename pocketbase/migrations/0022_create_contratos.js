migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    const empresas = app.findCollectionByNameOrId('empresas')

    const collection = new Collection({
      name: 'contratos',
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
          name: 'contratada_razao_social',
          type: 'text',
          required: true,
        },
        {
          name: 'contratada_cnpj',
          type: 'text',
          required: true,
        },
        {
          name: 'contratada_endereco',
          type: 'text',
        },
        {
          name: 'contratada_crc',
          type: 'text',
        },
        {
          name: 'contratante',
          type: 'relation',
          required: true,
          collectionId: empresas.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'data_inicio',
          type: 'date',
          required: true,
        },
        {
          name: 'prazo_inicial',
          type: 'number',
          required: true,
        },
        {
          name: 'quantidade_meses',
          type: 'number',
          required: true,
        },
        {
          name: 'valor_parcela',
          type: 'number',
          required: true,
        },
        {
          name: 'dia_vencimento',
          type: 'number',
          required: true,
        },
        {
          name: 'data_final',
          type: 'date',
          required: true,
        },
        {
          name: 'parcelas',
          type: 'number',
          required: true,
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
        'CREATE INDEX idx_contratos_user ON contratos (user)',
        'CREATE INDEX idx_contratos_contratante ON contratos (contratante)',
        'CREATE INDEX idx_contratos_data_inicio ON contratos (data_inicio)',
      ],
    })

    app.save(collection)
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId('contratos')
      app.delete(collection)
    } catch (_) {}
  },
)
