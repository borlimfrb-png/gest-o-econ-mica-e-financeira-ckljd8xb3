/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const empresasCol = app.findCollectionByNameOrId('empresas')
    const planoContasCol = app.findCollectionByNameOrId('plano_contas')

    let col
    try {
      col = app.findCollectionByNameOrId('plano_contas_mapeamentos')
    } catch (_) {
      col = new Collection({
        name: 'plano_contas_mapeamentos',
        type: 'base',
        // Padrão multi-tenant da coleção plano_contas (admin tudo, empresa/financeiro da própria empresa)
        listRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || ((@request.auth.role = 'empresa' || @request.auth.role = 'financeiro') && empresa = @request.auth.empresa))",
        viewRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || ((@request.auth.role = 'empresa' || @request.auth.role = 'financeiro') && empresa = @request.auth.empresa))",
        createRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || ((@request.auth.role = 'empresa' || @request.auth.role = 'financeiro') && @request.body.empresa = @request.auth.empresa))",
        updateRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || ((@request.auth.role = 'empresa' || @request.auth.role = 'financeiro') && empresa = @request.auth.empresa))",
        deleteRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || ((@request.auth.role = 'empresa' || @request.auth.role = 'financeiro') && empresa = @request.auth.empresa))",
        fields: [
          {
            name: 'empresa',
            type: 'relation',
            required: true,
            collectionId: empresasCol.id,
            cascadeDelete: true,
            maxSelect: 1,
          },
          {
            name: 'codigo_empresa',
            type: 'text',
            required: true,
          },
          {
            name: 'plano_conta',
            type: 'relation',
            required: true,
            collectionId: planoContasCol.id,
            cascadeDelete: true,
            maxSelect: 1,
          },
          {
            name: 'user',
            type: 'relation',
            required: true,
            collectionId: '_pb_users_auth_',
            cascadeDelete: false,
            maxSelect: 1,
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
          'CREATE INDEX idx_pc_map_empresa ON plano_contas_mapeamentos (empresa)',
          'CREATE INDEX idx_pc_map_codigo_empresa ON plano_contas_mapeamentos (codigo_empresa)',
          'CREATE INDEX idx_pc_map_plano_conta ON plano_contas_mapeamentos (plano_conta)',
          'CREATE UNIQUE INDEX idx_pc_map_emp_cod ON plano_contas_mapeamentos (empresa, codigo_empresa)',
        ],
      })
      app.save(col)
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('plano_contas_mapeamentos')
      app.delete(col)
    } catch (_) {}
  },
)
