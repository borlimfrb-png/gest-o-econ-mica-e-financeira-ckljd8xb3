/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    const empresasCol = app.findCollectionByNameOrId('empresas')

    // Criar coleção simulador_cenarios
    const cenariosCol = new Collection({
      name: 'simulador_cenarios',
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
          required: true,
          collectionId: empresasCol.id,
          cascadeDelete: false,
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
          name: 'parametros',
          type: 'json',
          required: true,
        },
        {
          name: 'divisor_calculado',
          type: 'number',
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
        'CREATE INDEX idx_sim_cenarios_empresa ON simulador_cenarios (empresa)',
        'CREATE INDEX idx_sim_cenarios_usuario ON simulador_cenarios (usuario)',
        'CREATE INDEX idx_sim_cenarios_nome ON simulador_cenarios (nome)',
        'CREATE INDEX idx_sim_cenarios_created ON simulador_cenarios (created)',
      ],
    })

    app.save(cenariosCol)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('simulador_cenarios')
      app.delete(col)
    } catch (_) {}
  },
)
