/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    const empresasCol = app.findCollectionByNameOrId('empresas')

    // Criar coleção tributos_lancamentos para lançamentos de entradas (compras) e saídas (vendas)
    // na Análise Tributária, permitindo apuração de créditos, débitos e saldos de ICMS, IPI, PIS e COFINS
    let tributosCol
    try {
      tributosCol = app.findCollectionByNameOrId('tributos_lancamentos')
    } catch (_) {
      tributosCol = new Collection({
        name: 'tributos_lancamentos',
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
            name: 'user',
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
            name: 'tipo',
            type: 'select',
            required: true,
            values: ['entrada', 'saida'],
            maxSelect: 1,
          },
          {
            name: 'fornecedor_tomador',
            type: 'text',
            required: true,
          },
          {
            name: 'cnpj_cpf',
            type: 'text',
            required: false,
          },
          {
            name: 'numero_nota',
            type: 'text',
            required: false,
          },
          {
            name: 'cfop',
            type: 'text',
            required: false,
          },
          {
            name: 'data',
            type: 'date',
            required: true,
          },
          {
            name: 'valor_mercadoria',
            type: 'number',
            required: true,
            min: 0,
          },
          // ICMS
          {
            name: 'base_icms',
            type: 'number',
            min: 0,
          },
          {
            name: 'aliquota_icms',
            type: 'number',
            min: 0,
          },
          {
            name: 'valor_icms',
            type: 'number',
            min: 0,
          },
          // IPI
          {
            name: 'base_ipi',
            type: 'number',
            min: 0,
          },
          {
            name: 'aliquota_ipi',
            type: 'number',
            min: 0,
          },
          {
            name: 'valor_ipi',
            type: 'number',
            min: 0,
          },
          // PIS
          {
            name: 'base_pis',
            type: 'number',
            min: 0,
          },
          {
            name: 'aliquota_pis',
            type: 'number',
            min: 0,
          },
          {
            name: 'valor_pis',
            type: 'number',
            min: 0,
          },
          // COFINS
          {
            name: 'base_cofins',
            type: 'number',
            min: 0,
          },
          {
            name: 'aliquota_cofins',
            type: 'number',
            min: 0,
          },
          {
            name: 'valor_cofins',
            type: 'number',
            min: 0,
          },
          // Observações e outros campos
          {
            name: 'observacoes',
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
          'CREATE INDEX idx_trib_lanc_empresa ON tributos_lancamentos (empresa)',
          'CREATE INDEX idx_trib_lanc_tipo ON tributos_lancamentos (tipo)',
          'CREATE INDEX idx_trib_lanc_data ON tributos_lancamentos (data)',
          'CREATE INDEX idx_trib_lanc_user ON tributos_lancamentos (user)',
          'CREATE INDEX idx_trib_lanc_empresa_tipo_data ON tributos_lancamentos (empresa, tipo, data)',
        ],
      })
      app.save(tributosCol)
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('tributos_lancamentos')
      app.delete(col)
    } catch (_) {}
  },
)
