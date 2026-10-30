/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    try {
      const gruposCol = app.findCollectionByNameOrId('grupos_empresariais')
      // List e View: usuários autenticados internos e clientes vinculados
      // Create, Update, Delete: apenas perfis internos (admin ou qualquer perfil interno, NUNCA cliente)
      gruposCol.listRule = '@request.auth.id != ""'
      gruposCol.viewRule = '@request.auth.id != ""'
      gruposCol.createRule = '@request.auth.id != "" && @request.auth.role != "cliente"'
      gruposCol.updateRule = '@request.auth.id != "" && @request.auth.role != "cliente"'
      gruposCol.deleteRule = '@request.auth.id != "" && @request.auth.role != "cliente"'
      app.save(gruposCol)
    } catch (e) {
      console.log('Erro ao atualizar regras RLS de grupos_empresariais na migracao 0098:', e)
      throw e
    }
  },
  (app) => {
    try {
      const gruposCol = app.findCollectionByNameOrId('grupos_empresariais')
      gruposCol.listRule = '@request.auth.id != ""'
      gruposCol.viewRule = '@request.auth.id != ""'
      gruposCol.createRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || empresas:each ?= @request.auth.empresa)"
      gruposCol.updateRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || (user = @request.auth.id && empresas:each ?= @request.auth.empresa))"
      gruposCol.deleteRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || (user = @request.auth.id && empresas:each ?= @request.auth.empresa))"
      app.save(gruposCol)
    } catch (_) {}
  },
)
