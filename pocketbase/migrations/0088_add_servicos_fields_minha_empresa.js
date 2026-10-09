// Migration para adicionar campos específicos de serviços e NFS-e na coleção minha_empresa
migrate(
  (app) => {
    try {
      const minhaEmpresaCol = app.findCollectionByNameOrId('minha_empresa')

      if (!minhaEmpresaCol.fields.getByName('cnae_servicos')) {
        minhaEmpresaCol.fields.add(
          new TextField({
            name: 'cnae_servicos',
            required: false,
          }),
        )
      }

      if (!minhaEmpresaCol.fields.getByName('codigo_tributacao_nacional')) {
        minhaEmpresaCol.fields.add(
          new TextField({
            name: 'codigo_tributacao_nacional',
            required: false,
          }),
        )
      }

      app.save(minhaEmpresaCol)
    } catch (e) {
      console.log('Erro ao adicionar campos de servicos em minha_empresa:', e)
    }
  },
  (app) => {
    try {
      const minhaEmpresaCol = app.findCollectionByNameOrId('minha_empresa')
      const field1 = minhaEmpresaCol.fields.getByName('cnae_servicos')
      if (field1) minhaEmpresaCol.fields.remove(field1)
      const field2 = minhaEmpresaCol.fields.getByName('codigo_tributacao_nacional')
      if (field2) minhaEmpresaCol.fields.remove(field2)
      app.save(minhaEmpresaCol)
    } catch (_) {}
  },
)
