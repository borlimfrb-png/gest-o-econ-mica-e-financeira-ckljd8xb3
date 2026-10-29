/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users')
    const gruposCol = app.findCollectionByNameOrId('grupos_empresariais')

    // 1. Adiciona o campo relation múltiplo 'grupos_empresariais' na coleção users
    const existingField = users.fields.getByName('grupos_empresariais')
    if (!existingField) {
      users.fields.add(
        new RelationField({
          name: 'grupos_empresariais',
          type: 'relation',
          collectionId: gruposCol.id,
          cascadeDelete: false,
          minSelect: 0,
          maxSelect: 50,
        }),
      )
      app.save(users)
    }

    // 2. Atualizar regras RLS da coleção 'empresas' para permitir acesso direto por:
    // - admin
    // - vínculo individual (@request.auth.empresas.id ?= id || @request.auth.empresas ?= id || @request.auth.empresa = id)
    // - vínculo por grupo econômico (@request.auth.grupos_empresariais.empresas.id ?= id || @request.auth.grupos_empresariais.empresas ?= id)
    try {
      const empresas = app.findCollectionByNameOrId('empresas')
      const ruleEmpresas =
        '@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.empresas.id ?= id || @request.auth.empresas ?= id || @request.auth.empresa = id || @request.auth.grupos_empresariais.empresas.id ?= id || @request.auth.grupos_empresariais.empresas ?= id)'
      empresas.listRule = ruleEmpresas
      empresas.viewRule = ruleEmpresas
      app.save(empresas)
    } catch (e) {
      console.log('Erro ao atualizar regras da colecao empresas na migracao 0096:', e)
    }

    // 3. Atualizar regras de list/view das coleções financeiras para também incluir empresas dos grupos vinculados
    const collections = [
      { name: 'balancos', field: 'empresa' },
      { name: 'dres', field: 'empresa' },
      { name: 'lancamentos', field: 'empresa' },
      { name: 'centros_custos', field: 'empresa' },
      { name: 'contas', field: 'empresa' },
      { name: 'tipos_despesas', field: 'empresa' },
    ]

    for (const item of collections) {
      try {
        const col = app.findCollectionByNameOrId(item.name)
        const ruleFinancial = `@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.role = "cliente" || @request.auth.empresas.id ?= ${item.field} || @request.auth.empresas ?= ${item.field} || @request.auth.empresa = ${item.field} || @request.auth.grupos_empresariais.empresas.id ?= ${item.field} || @request.auth.grupos_empresariais.empresas ?= ${item.field} || ${item.field} = "")`
        col.listRule = ruleFinancial
        col.viewRule = ruleFinancial
        app.save(col)
      } catch (e) {
        console.log(`Erro ao atualizar regras da colecao ${item.name} na migracao 0096:`, e)
      }
    }
  },
  (app) => {
    try {
      const users = app.findCollectionByNameOrId('users')
      const existingField = users.fields.getByName('grupos_empresariais')
      if (existingField) {
        users.fields.removeByName('grupos_empresariais')
        app.save(users)
      }
    } catch (e) {
      // Revert silencioso
    }

    try {
      const empresas = app.findCollectionByNameOrId('empresas')
      const ruleEmpresas =
        '@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.empresas.id ?= id || @request.auth.empresas ?= id || @request.auth.empresa = id)'
      empresas.listRule = ruleEmpresas
      empresas.viewRule = ruleEmpresas
      app.save(empresas)
    } catch (_) {}
  },
)
