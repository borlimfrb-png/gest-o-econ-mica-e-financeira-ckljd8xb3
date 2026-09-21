// Migration para adicionar campo codigo_ibge na coleção minha_empresa
migrate(
  (app) => {
    try {
      const minhaEmpresaCol = app.findCollectionByNameOrId('minha_empresa')
      if (!minhaEmpresaCol.fields.getByName('codigo_ibge')) {
        minhaEmpresaCol.fields.add(
          new TextField({
            name: 'codigo_ibge',
            required: false,
          }),
        )
        app.save(minhaEmpresaCol)
      }
    } catch (e) {
      console.log('Erro ao adicionar codigo_ibge em minha_empresa:', e)
    }
  },
  (app) => {
    try {
      const minhaEmpresaCol = app.findCollectionByNameOrId('minha_empresa')
      const field = minhaEmpresaCol.fields.getByName('codigo_ibge')
      if (field) {
        minhaEmpresaCol.fields.remove(field)
        app.save(minhaEmpresaCol)
      }
    } catch (_) {}
  },
)
