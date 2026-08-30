migrate(
  (app) => {
    const empresasColId = app.findCollectionByNameOrId('empresas').id

    const configuracoesTributarias = new Collection({
      name: 'configuracoes_tributarias',
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
          name: 'empresa',
          type: 'relation',
          required: true,
          collectionId: empresasColId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'regime_tributario',
          type: 'select',
          required: true,
          values: ['Lucro Real', 'Lucro Presumido', 'Simples Nacional'],
          maxSelect: 1,
        },
        // Alíquotas em percentual (%)
        { name: 'aliquota_simples_efetiva', type: 'number', min: 0 },
        { name: 'anexo_simples', type: 'text' },
        { name: 'faixa_simples', type: 'text' },
        { name: 'aliquota_pis', type: 'number', min: 0 },
        { name: 'aliquota_cofins', type: 'number', min: 0 },
        { name: 'aliquota_icms', type: 'number', min: 0 },
        { name: 'aliquota_ipi', type: 'number', min: 0 },
        { name: 'aliquota_iss', type: 'number', min: 0 },
        { name: 'aliquota_irpj', type: 'number', min: 0 },
        { name: 'aliquota_csll', type: 'number', min: 0 },
        { name: 'outros_impostos', type: 'number', min: 0 },
        { name: 'carga_tributaria_total', type: 'number', min: 0 },
        { name: 'fator_por_dentro', type: 'number', min: 0 },
        { name: 'observacoes', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_config_tributarias_user ON configuracoes_tributarias (user)',
        'CREATE UNIQUE INDEX idx_config_tributarias_empresa ON configuracoes_tributarias (user, empresa)',
      ],
    })
    app.save(configuracoesTributarias)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('configuracoes_tributarias')
      app.delete(col)
    } catch (_) {}
  },
)
