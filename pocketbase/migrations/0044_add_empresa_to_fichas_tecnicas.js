migrate(
  (app) => {
    const empresasCol = app.findCollectionByNameOrId('empresas')
    const empresasId = empresasCol.id

    // 1. Adicionar campo 'empresa' na collection 'fichas_tecnicas'
    const colFichas = app.findCollectionByNameOrId('fichas_tecnicas')
    if (!colFichas.fields.getByName('empresa')) {
      colFichas.fields.add(
        new RelationField({
          name: 'empresa',
          collectionId: empresasId,
          cascadeDelete: false,
          maxSelect: 1,
        }),
      )
      colFichas.addIndex('idx_fichas_tecnicas_empresa', false, 'empresa', '')
      colFichas.addIndex('idx_fichas_tecnicas_user_empresa', false, 'user, empresa', '')
      app.save(colFichas)
    }

    // 2. Migrar dados existentes de fichas técnicas
    // Primeiro tentar herdar do produto vinculado (se o produto já possui empresa)
    try {
      app
        .db()
        .newQuery(
          `UPDATE fichas_tecnicas SET empresa = (
            SELECT empresa FROM produtos WHERE produtos.id = fichas_tecnicas.produto AND produtos.empresa IS NOT NULL AND produtos.empresa != ''
          ) WHERE (empresa IS NULL OR empresa = '') AND produto IS NOT NULL AND produto != ''`,
        )
        .execute()
    } catch (e) {
      console.log('Aviso ao sincronizar empresa das fichas técnicas via produtos:', e)
    }

    // Para fichas técnicas que ainda ficaram sem empresa, vincular à primeira empresa encontrada
    try {
      const empresasRecords = app.findRecordsByFilter('empresas', '', 'created', 50, 0)
      if (empresasRecords.length > 0) {
        const primeiraEmpresaId = empresasRecords[0].id

        app
          .db()
          .newQuery(
            `UPDATE fichas_tecnicas SET empresa = {:empresaId} WHERE empresa IS NULL OR empresa = ''`,
          )
          .bind({ empresaId: primeiraEmpresaId })
          .execute()
      }
    } catch (e) {
      console.log('Aviso ao atribuir primeira empresa às fichas técnicas órfãs:', e)
    }
  },
  (app) => {
    try {
      const colFichas = app.findCollectionByNameOrId('fichas_tecnicas')
      colFichas.removeIndex('idx_fichas_tecnicas_empresa')
      colFichas.removeIndex('idx_fichas_tecnicas_user_empresa')
      colFichas.fields.removeByName('empresa')
      app.save(colFichas)
    } catch (_) {}
  },
)
