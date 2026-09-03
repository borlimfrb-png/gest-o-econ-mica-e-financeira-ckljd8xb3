/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId('plano_contas')
    const empresasCollection = app.findCollectionByNameOrId('empresas')

    // Adicionar campo empresa (relation para empresas) se não existir
    const hasEmpresa = collection.fields.getByName('empresa')
    if (!hasEmpresa) {
      collection.fields.add(
        new RelationField({
          name: 'empresa',
          required: false,
          collectionId: empresasCollection.id,
          cascadeDelete: false,
          maxSelect: 1,
        }),
      )
      app.save(collection)
    }

    // Buscar empresas disponíveis
    let defaultEmpresaId = null
    try {
      const empresas = app.findAllRecords('empresas')
      if (empresas && empresas.length > 0) {
        // Ordena por created asc para pegar a primeira
        empresas.sort((a, b) => {
          const da = a.getString('created') || ''
          const db = b.getString('created') || ''
          return da.localeCompare(db)
        })
        defaultEmpresaId = empresas[0].id
      }
    } catch (e) {
      // Silencioso se empresas vazias
    }

    // Preencher registros de plano_contas existentes que não possuem empresa
    if (defaultEmpresaId) {
      try {
        const records = app.findAllRecords('plano_contas')
        for (const record of records) {
          const emp = record.getString('empresa')
          if (!emp) {
            record.set('empresa', defaultEmpresaId)
            app.save(record)
          }
        }
      } catch (e) {
        // Fallback via db query
        try {
          app
            .db()
            .newQuery(
              "UPDATE plano_contas SET empresa = '" +
                defaultEmpresaId +
                "' WHERE empresa IS NULL OR empresa = ''",
            )
            .execute()
        } catch (err) {}
      }
    }

    // Garantir índice correto
    try {
      const hasIdx = collection.indexes.some((idx) => idx.includes('idx_plano_contas_empresa'))
      if (!hasIdx) {
        collection.indexes.push('CREATE INDEX idx_plano_contas_empresa ON plano_contas (empresa)')
        app.save(collection)
      }
    } catch (e) {}
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('plano_contas')
    const field = collection.fields.getByName('empresa')
    if (field) {
      collection.fields.removeById(field.id)
      app.save(collection)
    }
  },
)
