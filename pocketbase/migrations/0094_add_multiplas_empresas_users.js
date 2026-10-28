/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users')
    const empresas = app.findCollectionByNameOrId('empresas')

    // Adiciona o campo relation múltiplo 'empresas' na coleção users
    const existingField = users.fields.getByName('empresas')
    if (!existingField) {
      users.fields.add(
        new RelationField({
          name: 'empresas',
          type: 'relation',
          collectionId: empresas.id,
          cascadeDelete: false,
          minSelect: 0,
          maxSelect: 100,
        }),
      )
      app.save(users)
    }

    // Backfill: usuários existentes com campo 'empresa' único recebem o valor em 'empresas' (array)
    const allUsers = app.findRecordsByFilter('users', 'empresa != ""')
    for (const u of allUsers) {
      const currentEmpresa = u.getString('empresa')
      const currentEmpresas = u.getStringSlice('empresas')
      if (currentEmpresa && (!currentEmpresas || currentEmpresas.length === 0)) {
        u.set('empresas', [currentEmpresa])
        app.save(u)
      }
    }

    // Atualizar regras RLS para considerar @request.auth.empresas ?= empresa / id
    const collectionsToUpdate = [
      { name: 'empresas', fieldName: 'id' },
      { name: 'balancos', fieldName: 'empresa' },
      { name: 'dres', fieldName: 'empresa' },
      { name: 'lancamentos', fieldName: 'empresa' },
      { name: 'centros_custos', fieldName: 'empresa' },
      { name: 'contas', fieldName: 'empresa' },
      { name: 'tipos_despesas', fieldName: 'empresa' },
      { name: 'grupos_empresariais', fieldName: 'empresas' },
    ]

    for (const item of collectionsToUpdate) {
      try {
        const col = app.findCollectionByNameOrId(item.name)
        if (item.name === 'empresas') {
          col.viewRule =
            '@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.empresa = id || @request.auth.empresas ?= id || @request.auth.empresa = "")'
          col.listRule =
            '@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.empresa = id || @request.auth.empresas ?= id || @request.auth.empresa = "")'
        } else if (item.name === 'grupos_empresariais') {
          col.viewRule = '@request.auth.id != ""'
          col.listRule = '@request.auth.id != ""'
        } else {
          const cond = `@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.role = "cliente" || @request.auth.empresa = ${item.fieldName} || @request.auth.empresas ?= ${item.fieldName} || ${item.fieldName} = "")`
          col.viewRule = cond
          col.listRule = cond
        }
        app.save(col)
      } catch (e) {
        // Ignora se alguma coleção não existir
      }
    }
  },
  (app) => {
    try {
      const users = app.findCollectionByNameOrId('users')
      const existingField = users.fields.getByName('empresas')
      if (existingField) {
        users.fields.removeByName('empresas')
        app.save(users)
      }
    } catch (e) {
      // Revert silencioso
    }
  },
)
