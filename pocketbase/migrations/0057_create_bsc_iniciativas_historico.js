/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    const empresasCol = app.findCollectionByNameOrId('empresas')
    const bscIniciativasCol = app.findCollectionByNameOrId('bsc_iniciativas')

    // Criar coleção bsc_iniciativas_historico
    const historicoCol = new Collection({
      name: 'bsc_iniciativas_historico',
      type: 'base',
      listRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || empresa = @request.auth.empresa)",
      viewRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || empresa = @request.auth.empresa)",
      createRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.body.empresa = @request.auth.empresa)",
      updateRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || empresa = @request.auth.empresa)",
      deleteRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || empresa = @request.auth.empresa)",
      fields: [
        {
          name: 'iniciativa',
          type: 'relation',
          required: true,
          collectionId: bscIniciativasCol.id,
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
          name: 'usuario',
          type: 'relation',
          required: false,
          collectionId: usersCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'usuario_nome',
          type: 'text',
          required: false,
        },
        {
          name: 'usuario_email',
          type: 'text',
          required: false,
        },
        {
          name: 'acao',
          type: 'select',
          required: true,
          values: ['criada', 'edicao', 'status', 'progresso', 'concluida'],
          maxSelect: 1,
        },
        {
          name: 'descricao',
          type: 'text',
          required: false,
        },
        {
          name: 'dados_anteriores',
          type: 'json',
          required: false,
        },
        {
          name: 'dados_novos',
          type: 'json',
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
        'CREATE INDEX idx_bsc_hist_iniciativa ON bsc_iniciativas_historico (iniciativa)',
        'CREATE INDEX idx_bsc_hist_empresa ON bsc_iniciativas_historico (empresa)',
        'CREATE INDEX idx_bsc_hist_created ON bsc_iniciativas_historico (created)',
        'CREATE INDEX idx_bsc_hist_acao ON bsc_iniciativas_historico (acao)',
      ],
    })

    app.save(historicoCol)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('bsc_iniciativas_historico')
      app.delete(col)
    } catch (_) {}
  },
)
