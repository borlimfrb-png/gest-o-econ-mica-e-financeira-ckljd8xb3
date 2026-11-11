/// <reference path="../pb_data/types.d.ts" />
//
// Migração 0105 — cria a coleção `kpis_personalizados` (KPIs personalizados do
// HUB Análise Econômica e Financeira). Idempotente: se a coleção já existir, não faz nada.
migrate(
  (app) => {
    try {
      app.findCollectionByNameOrId('kpis_personalizados')
      return // já existe: no-op
    } catch (_) {}

    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    const empresasCol = app.findCollectionByNameOrId('empresas')

    const col = new Collection({
      name: 'kpis_personalizados',
      type: 'base',
      listRule:
        "@request.auth.id != '' && @request.auth.role != 'cliente' && (@request.auth.role = 'admin' || empresa = @request.auth.empresa)",
      viewRule:
        "@request.auth.id != '' && @request.auth.role != 'cliente' && (@request.auth.role = 'admin' || empresa = @request.auth.empresa)",
      createRule:
        "@request.auth.id != '' && @request.auth.role != 'cliente' && (@request.auth.role = 'admin' || @request.body.empresa = @request.auth.empresa)",
      updateRule:
        "@request.auth.id != '' && @request.auth.role != 'cliente' && (@request.auth.role = 'admin' || empresa = @request.auth.empresa)",
      deleteRule:
        "@request.auth.id != '' && @request.auth.role != 'cliente' && (@request.auth.role = 'admin' || empresa = @request.auth.empresa)",
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
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'nome',
          type: 'text',
          required: true,
        },
        {
          name: 'metrica_base',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: [
            'roe',
            'margem_liquida',
            'margem_bruta',
            'margem_ebitda',
            'liquidez_corrente',
            'endividamento',
            'receita',
            'lucro',
            'ebitda',
          ],
        },
        {
          name: 'operador',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: ['nenhum', 'divisao', 'subtracao', 'soma', 'multiplicacao'],
        },
        {
          name: 'metrica_secundaria',
          type: 'select',
          required: false,
          maxSelect: 1,
          values: [
            'roe',
            'margem_liquida',
            'margem_bruta',
            'margem_ebitda',
            'liquidez_corrente',
            'endividamento',
            'receita',
            'lucro',
            'ebitda',
          ],
        },
        {
          name: 'cor',
          type: 'text',
          required: false,
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
        'CREATE INDEX idx_kpis_pessoais_empresa ON kpis_personalizados (empresa)',
        'CREATE INDEX idx_kpis_pessoais_usuario ON kpis_personalizados (usuario)',
      ],
    })

    app.save(col)
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('kpis_personalizados'))
    } catch (_) {}
  },
)
