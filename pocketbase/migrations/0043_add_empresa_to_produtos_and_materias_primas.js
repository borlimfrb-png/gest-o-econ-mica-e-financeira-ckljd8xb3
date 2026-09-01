migrate(
  (app) => {
    const empresasCol = app.findCollectionByNameOrId('empresas')
    const empresasId = empresasCol.id

    // 1. Adicionar campo 'empresa' na collection 'produtos'
    const colProdutos = app.findCollectionByNameOrId('produtos')
    if (!colProdutos.fields.getByName('empresa')) {
      colProdutos.fields.add(
        new RelationField({
          name: 'empresa',
          collectionId: empresasId,
          cascadeDelete: false,
          maxSelect: 1,
        }),
      )
      colProdutos.addIndex('idx_produtos_empresa', false, 'empresa', '')
      colProdutos.addIndex('idx_produtos_user_empresa', false, 'user, empresa', '')
      app.save(colProdutos)
    }

    // 2. Adicionar campo 'empresa' na collection 'materias_primas'
    const colMaterias = app.findCollectionByNameOrId('materias_primas')
    if (!colMaterias.fields.getByName('empresa')) {
      colMaterias.fields.add(
        new RelationField({
          name: 'empresa',
          collectionId: empresasId,
          cascadeDelete: false,
          maxSelect: 1,
        }),
      )
      colMaterias.addIndex('idx_materias_primas_empresa', false, 'empresa', '')
      colMaterias.addIndex('idx_materias_primas_user_empresa', false, 'user, empresa', '')
      app.save(colMaterias)
    }

    // 3. Migrar dados existentes: vincular produtos e matérias-primas órfãos à primeira empresa do usuário ou à primeira empresa encontrada no banco
    try {
      const empresasRecords = app.findRecordsByFilter('empresas', '', 'created', 50, 0)
      if (empresasRecords.length > 0) {
        const primeiraEmpresaId = empresasRecords[0].id

        // Atribuir produtos sem empresa para a primeira empresa
        app
          .db()
          .newQuery(
            `UPDATE produtos SET empresa = {:empresaId} WHERE empresa IS NULL OR empresa = ''`,
          )
          .bind({ empresaId: primeiraEmpresaId })
          .execute()

        // Atribuir matérias-primas sem empresa para a primeira empresa
        app
          .db()
          .newQuery(
            `UPDATE materias_primas SET empresa = {:empresaId} WHERE empresa IS NULL OR empresa = ''`,
          )
          .bind({ empresaId: primeiraEmpresaId })
          .execute()
      }
    } catch (e) {
      console.log('Aviso ao migrar dados existentes de produtos/matérias-primas:', e)
    }
  },
  (app) => {
    try {
      const colProdutos = app.findCollectionByNameOrId('produtos')
      colProdutos.removeIndex('idx_produtos_empresa')
      colProdutos.removeIndex('idx_produtos_user_empresa')
      colProdutos.fields.removeByName('empresa')
      app.save(colProdutos)
    } catch (_) {}

    try {
      const colMaterias = app.findCollectionByNameOrId('materias_primas')
      colMaterias.removeIndex('idx_materias_primas_empresa')
      colMaterias.removeIndex('idx_materias_primas_user_empresa')
      colMaterias.fields.removeByName('empresa')
      app.save(colMaterias)
    } catch (_) {}
  },
)
