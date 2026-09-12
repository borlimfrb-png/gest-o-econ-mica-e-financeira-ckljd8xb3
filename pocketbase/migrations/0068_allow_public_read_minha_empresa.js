/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('minha_empresa')
      // Permitir leitura pública (list e view) para que a tela de login não autenticada possa
      // exibir a logo e o nome da consultoria cadastrada.
      // Modificações continuam restritas ao dono (@request.auth.id != '' && user = @request.auth.id).
      col.listRule = ''
      col.viewRule = ''
      app.save(col)
    } catch (err) {
      console.log('Erro ao atualizar regras de acesso em minha_empresa:', err)
      throw err
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('minha_empresa')
      col.listRule = "@request.auth.id != '' && user = @request.auth.id"
      col.viewRule = "@request.auth.id != '' && user = @request.auth.id"
      app.save(col)
    } catch (err) {
      console.log('Erro ao reverter regras de minha_empresa:', err)
    }
  },
)
