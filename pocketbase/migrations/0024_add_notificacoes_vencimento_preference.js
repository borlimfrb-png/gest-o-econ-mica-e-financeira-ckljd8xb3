// Migration para adicionar o campo notificacoes_vencimento na coleção minha_empresa e users
migrate(
  (app) => {
    // 1. Atualizar minha_empresa
    try {
      const minhaEmpresaCol = app.findCollectionByNameOrId('minha_empresa')
      if (!minhaEmpresaCol.fields.getByName('notificacoes_vencimento')) {
        minhaEmpresaCol.fields.add(
          new BoolField({
            name: 'notificacoes_vencimento',
            required: false,
          }),
        )
        app.save(minhaEmpresaCol)
      }
    } catch (e) {
      console.log('Erro ao atualizar minha_empresa:', e)
    }

    // 2. Atualizar users
    try {
      const usersCol = app.findCollectionByNameOrId('users')
      if (!usersCol.fields.getByName('notificacoes_vencimento')) {
        usersCol.fields.add(
          new BoolField({
            name: 'notificacoes_vencimento',
            required: false,
          }),
        )
        app.save(usersCol)
      }
    } catch (e) {
      console.log('Erro ao atualizar users:', e)
    }
  },
  (app) => {
    try {
      const minhaEmpresaCol = app.findCollectionByNameOrId('minha_empresa')
      const f1 = minhaEmpresaCol.fields.getByName('notificacoes_vencimento')
      if (f1) {
        minhaEmpresaCol.fields.remove(f1)
        app.save(minhaEmpresaCol)
      }
    } catch (_) {}

    try {
      const usersCol = app.findCollectionByNameOrId('users')
      const f2 = usersCol.fields.getByName('notificacoes_vencimento')
      if (f2) {
        usersCol.fields.remove(f2)
        app.save(usersCol)
      }
    } catch (_) {}
  },
)
