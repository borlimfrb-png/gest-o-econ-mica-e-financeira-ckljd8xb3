/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    const empresasCol = app.findCollectionByNameOrId('empresas')

    // 1. Criar coleção bsc_kpis
    const bscCol = new Collection({
      name: 'bsc_kpis',
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
          name: 'usuario',
          type: 'relation',
          required: false,
          collectionId: usersCol.id,
          cascadeDelete: false,
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
          name: 'ano',
          type: 'number',
          required: true,
          onlyInt: true,
        },
        {
          name: 'perspectiva',
          type: 'select',
          required: true,
          values: ['financeira', 'clientes', 'processos_internos', 'aprendizado_crescimento'],
          maxSelect: 1,
        },
        {
          name: 'nome',
          type: 'text',
          required: true,
        },
        {
          name: 'descricao',
          type: 'text',
          required: false,
        },
        {
          name: 'unidade',
          type: 'text',
          required: false,
        },
        {
          name: 'meta',
          type: 'number',
          required: true,
        },
        {
          name: 'valor_atual',
          type: 'number',
          required: false,
        },
        {
          name: 'tipo',
          type: 'select',
          required: true,
          values: ['auto', 'manual'],
          maxSelect: 1,
        },
        {
          name: 'formula',
          type: 'text',
          required: false,
        },
        {
          name: 'peso',
          type: 'number',
          required: false,
          min: 1,
          max: 100,
        },
        {
          name: 'sentido',
          type: 'select',
          required: true,
          values: ['maior_melhor', 'menor_melhor'],
          maxSelect: 1,
        },
        {
          name: 'ordem',
          type: 'number',
          required: false,
          onlyInt: true,
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
        'CREATE INDEX idx_bsc_kpis_empresa ON bsc_kpis (empresa)',
        'CREATE INDEX idx_bsc_kpis_ano ON bsc_kpis (ano)',
        'CREATE INDEX idx_bsc_kpis_perspectiva ON bsc_kpis (perspectiva)',
        'CREATE INDEX idx_bsc_kpis_empresa_ano ON bsc_kpis (empresa, ano)',
      ],
    })

    app.save(bscCol)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('bsc_kpis')
      app.delete(col)
    } catch (_) {}
  },
)
