/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    const empresasCol = app.findCollectionByNameOrId('empresas')
    const bscKpisCol = app.findCollectionByNameOrId('bsc_kpis')

    // Criar coleção bsc_iniciativas
    const iniciativasCol = new Collection({
      name: 'bsc_iniciativas',
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
          name: 'kpi',
          type: 'relation',
          required: true,
          collectionId: bscKpisCol.id,
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
          name: 'ano',
          type: 'number',
          required: true,
          onlyInt: true,
        },
        {
          name: 'titulo',
          type: 'text',
          required: true,
        },
        {
          name: 'descricao',
          type: 'text',
          required: false,
        },
        {
          name: 'responsavel',
          type: 'text',
          required: false,
        },
        {
          name: 'prazo',
          type: 'date',
          required: false,
        },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['planejada', 'em_andamento', 'concluida', 'cancelada'],
          maxSelect: 1,
        },
        {
          name: 'progresso',
          type: 'number',
          required: false,
          min: 0,
          max: 100,
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
        'CREATE INDEX idx_bsc_iniciativas_kpi ON bsc_iniciativas (kpi)',
        'CREATE INDEX idx_bsc_iniciativas_empresa ON bsc_iniciativas (empresa)',
        'CREATE INDEX idx_bsc_iniciativas_ano ON bsc_iniciativas (ano)',
        'CREATE INDEX idx_bsc_iniciativas_status ON bsc_iniciativas (status)',
      ],
    })

    app.save(iniciativasCol)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('bsc_iniciativas')
      app.delete(col)
    } catch (_) {}
  },
)
