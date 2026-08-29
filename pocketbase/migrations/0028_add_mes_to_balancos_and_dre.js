// Adiciona o campo `mes` (número de 1 a 12) nas collections `balancos` e `dre`,
// migra os registros anuais existentes para mes = 12 (Dezembro),
// e atualiza os índices únicos para (empresa, ano, mes).

migrate(
  (app) => {
    // 1. Coleção balancos
    const balCol = app.findCollectionByNameOrId('balancos')
    if (!balCol.fields.getByName('mes')) {
      balCol.fields.add(
        new NumberField({
          name: 'mes',
          required: false,
          min: 1,
          max: 12,
          onlyInt: true,
        }),
      )
    }

    // Remover índice único antigo de empresa + ano
    try {
      balCol.removeIndex('idx_balancos_empresa_ano')
    } catch (_) {}

    // Salvar coleção para ter o campo mes
    app.save(balCol)

    // 2. Coleção dre
    const dreCol = app.findCollectionByNameOrId('dre')
    if (!dreCol.fields.getByName('mes')) {
      dreCol.fields.add(
        new NumberField({
          name: 'mes',
          required: false,
          min: 1,
          max: 12,
          onlyInt: true,
        }),
      )
    }

    // Remover índice único antigo de empresa + ano
    try {
      dreCol.removeIndex('idx_dre_empresa_ano')
    } catch (_) {}

    // Salvar coleção para ter o campo mes
    app.save(dreCol)

    // 3. Migrar registros existentes sem mês ou com mês 0/null para mês 12 (Dezembro)
    app.db().newQuery('UPDATE balancos SET mes = 12 WHERE mes IS NULL OR mes = 0').execute()
    app.db().newQuery('UPDATE dre SET mes = 12 WHERE mes IS NULL OR mes = 0').execute()

    // 4. Adicionar novos índices de mes e índice único (empresa, ano, mes)
    const balColReloaded = app.findCollectionByNameOrId('balancos')
    try {
      balColReloaded.addIndex('idx_balancos_mes', false, 'mes', '')
    } catch (_) {}
    try {
      balColReloaded.addIndex('idx_balancos_empresa_ano_mes', true, 'empresa, ano, mes', '')
    } catch (_) {}
    app.save(balColReloaded)

    const dreColReloaded = app.findCollectionByNameOrId('dre')
    try {
      dreColReloaded.addIndex('idx_dre_mes', false, 'mes', '')
    } catch (_) {}
    try {
      dreColReloaded.addIndex('idx_dre_empresa_ano_mes', true, 'empresa, ano, mes', '')
    } catch (_) {}
    app.save(dreColReloaded)
  },
  (app) => {
    // Reverter balancos
    const balCol = app.findCollectionByNameOrId('balancos')
    try {
      balCol.removeIndex('idx_balancos_empresa_ano_mes')
    } catch (_) {}
    try {
      balCol.removeIndex('idx_balancos_mes')
    } catch (_) {}
    if (balCol.fields.getByName('mes')) {
      balCol.fields.removeByName('mes')
    }
    try {
      balCol.addIndex('idx_balancos_empresa_ano', true, 'empresa, ano', '')
    } catch (_) {}
    app.save(balCol)

    // Reverter dre
    const dreCol = app.findCollectionByNameOrId('dre')
    try {
      dreCol.removeIndex('idx_dre_empresa_ano_mes')
    } catch (_) {}
    try {
      dreCol.removeIndex('idx_dre_mes')
    } catch (_) {}
    if (dreCol.fields.getByName('mes')) {
      dreCol.fields.removeByName('mes')
    }
    try {
      dreCol.addIndex('idx_dre_empresa_ano', true, 'empresa, ano', '')
    } catch (_) {}
    app.save(dreCol)
  },
)
