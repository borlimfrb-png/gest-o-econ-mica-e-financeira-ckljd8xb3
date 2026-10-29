/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // Atualizar regras de list/view da coleção empresas e coleções financeiras relacionadas
    // para resolver vínculos prioritariamente pelo array multi-empresa @request.auth.empresas.id ?= id
    // mantendo compatibilidade com @request.auth.empresas ?= id e admin

    try {
      const empresas = app.findCollectionByNameOrId('empresas')
      const ruleEmpresas =
        '@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.empresas.id ?= id || @request.auth.empresas ?= id || @request.auth.empresa = id)'
      empresas.listRule = ruleEmpresas
      empresas.viewRule = ruleEmpresas
      app.save(empresas)
    } catch (e) {
      console.log('Erro ao atualizar regras da colecao empresas:', e)
    }

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
        const ruleFinancial = `@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.role = "cliente" || @request.auth.empresas.id ?= ${item.field} || @request.auth.empresas ?= ${item.field} || @request.auth.empresa = ${item.field} || ${item.field} = "")`
        col.listRule = ruleFinancial
        col.viewRule = ruleFinancial
        app.save(col)
      } catch (e) {
        console.log(`Erro ao atualizar regras da colecao ${item.name}:`, e)
      }
    }
  },
  (app) => {
    try {
      const empresas = app.findCollectionByNameOrId('empresas')
      const ruleBack =
        '@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.empresa = id || @request.auth.empresas ?= id || @request.auth.empresa = "")'
      empresas.listRule = ruleBack
      empresas.viewRule = ruleBack
      app.save(empresas)
    } catch (_) {}
  },
)
