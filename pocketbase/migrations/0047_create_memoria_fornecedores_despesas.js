/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // 1. Cria a collection 'memoria_fornecedores_despesas' para registrar o histórico de vinculação
    // de fornecedores/descrições a contas contábeis do Plano de Contas por usuário e empresa.
    if (!app.hasTable('memoria_fornecedores_despesas')) {
      const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
      const empresasCol = app.findCollectionByNameOrId('empresas')
      const planoContasCol = app.findCollectionByNameOrId('plano_contas')

      const collection = new Collection({
        name: 'memoria_fornecedores_despesas',
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
            collectionId: usersCol.id,
            cascadeDelete: true,
            maxSelect: 1,
          },
          {
            name: 'empresa',
            type: 'relation',
            required: false,
            collectionId: empresasCol.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'fornecedor_padrao',
            type: 'text',
            required: true,
          },
          {
            name: 'termo_busca',
            type: 'text',
            required: true,
          },
          {
            name: 'plano_conta',
            type: 'relation',
            required: true,
            collectionId: planoContasCol.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'categoria_sugerida',
            type: 'text',
            required: false,
          },
          {
            name: 'total_utilizacoes',
            type: 'number',
            required: false,
          },
          {
            name: 'ultima_utilizacao',
            type: 'date',
            required: false,
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
          'CREATE INDEX idx_memoria_forn_user ON memoria_fornecedores_despesas (user)',
          'CREATE INDEX idx_memoria_forn_termo ON memoria_fornecedores_despesas (termo_busca)',
          'CREATE INDEX idx_memoria_forn_empresa ON memoria_fornecedores_despesas (empresa)',
        ],
      })

      app.save(collection)
    }

    // 2. Atualiza o agente 'importador-despesas' para ter acesso à nova memória de fornecedores
    $ai.agents.putTools(app, 'importador-despesas', [
      {
        collection: 'memoria_fornecedores_despesas',
        perms: { read: true, list: true, create: true, update: true },
      },
    ])
  },
  (app) => {
    try {
      $ai.agents.deleteTools(app, 'importador-despesas', ['memoria_fornecedores_despesas'])
    } catch (_) {}

    try {
      const col = app.findCollectionByNameOrId('memoria_fornecedores_despesas')
      app.delete(col)
    } catch (_) {}
  },
)
