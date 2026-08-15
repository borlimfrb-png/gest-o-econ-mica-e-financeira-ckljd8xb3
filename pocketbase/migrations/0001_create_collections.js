migrate(
  (app) => {
    // 1. Coleção 'empresas'
    const empresas = new Collection({
      name: 'empresas',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'nome', type: 'text', required: true, min: 3 },
        { name: 'cnpj', type: 'text', required: true, min: 14, max: 18 },
        {
          name: 'segmento',
          type: 'select',
          required: true,
          values: [
            'Indústria',
            'Comércio',
            'Serviços',
            'Agronegócio',
            'Tecnologia',
            'Saúde',
            'Construção',
            'Outros',
          ],
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_empresas_cnpj ON empresas (cnpj)',
        'CREATE INDEX idx_empresas_segmento ON empresas (segmento)',
      ],
    })
    app.save(empresas)

    const empresasCol = app.findCollectionByNameOrId('empresas')

    // 2. Coleção 'balancos'
    const balancos = new Collection({
      name: 'balancos',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'empresa',
          type: 'relation',
          required: true,
          collectionId: empresasCol.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'ano', type: 'number', required: true, min: 2000, max: 2100, onlyInt: true },
        // Ativo Circulante
        { name: 'caixa_equivalentes', type: 'number' },
        { name: 'aplicacoes_financeiras', type: 'number' },
        { name: 'contas_receber', type: 'number' },
        { name: 'estoques', type: 'number' },
        { name: 'impostos_recuperar', type: 'number' },
        { name: 'outros_ativo_circulante', type: 'number' },
        // Ativo Não Circulante
        { name: 'realizavel_longo_prazo', type: 'number' },
        { name: 'investimentos', type: 'number' },
        { name: 'imobilizado', type: 'number' },
        { name: 'intangivel', type: 'number' },
        // Passivo Circulante
        { name: 'fornecedores', type: 'number' },
        { name: 'emprestimos_curto_prazo', type: 'number' },
        { name: 'obrigacoes_trabalhistas', type: 'number' },
        { name: 'obrigacoes_tributarias', type: 'number' },
        { name: 'outros_passivo_circulante', type: 'number' },
        // Passivo Não Circulante
        { name: 'emprestimos_longo_prazo', type: 'number' },
        { name: 'outras_obrigacoes_longo_prazo', type: 'number' },
        // Patrimônio Líquido
        { name: 'capital_social', type: 'number' },
        { name: 'reservas_lucros', type: 'number' },
        { name: 'lucros_acumulados', type: 'number' },
        // Autodate
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_balancos_empresa_ano ON balancos (empresa, ano)',
        'CREATE INDEX idx_balancos_empresa ON balancos (empresa)',
        'CREATE INDEX idx_balancos_ano ON balancos (ano)',
      ],
    })
    app.save(balancos)

    // 3. Coleção 'dre'
    const dre = new Collection({
      name: 'dre',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'empresa',
          type: 'relation',
          required: true,
          collectionId: empresasCol.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'ano', type: 'number', required: true, min: 2000, max: 2100, onlyInt: true },
        { name: 'receita_bruta', type: 'number' },
        { name: 'deducoes_receita', type: 'number' },
        { name: 'custo_mercadorias', type: 'number' },
        { name: 'despesas_operacionais', type: 'number' },
        { name: 'despesas_financeiras', type: 'number' },
        { name: 'outras_receitas_despesas', type: 'number' },
        { name: 'imposto_renda', type: 'number' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_dre_empresa_ano ON dre (empresa, ano)',
        'CREATE INDEX idx_dre_empresa ON dre (empresa)',
        'CREATE INDEX idx_dre_ano ON dre (ano)',
      ],
    })
    app.save(dre)
  },
  (app) => {
    try {
      const dre = app.findCollectionByNameOrId('dre')
      app.delete(dre)
    } catch (_) {}
    try {
      const balancos = app.findCollectionByNameOrId('balancos')
      app.delete(balancos)
    } catch (_) {}
    try {
      const empresas = app.findCollectionByNameOrId('empresas')
      app.delete(empresas)
    } catch (_) {}
  },
)
