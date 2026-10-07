/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')

    // 1. Atualizar campo 'role' em users para incluir 'cliente'
    const roleField = usersCol.fields.getByName('role')
    if (roleField) {
      const currentValues = Array.isArray(roleField.values) ? roleField.values : []
      if (!currentValues.includes('cliente')) {
        roleField.values = [...currentValues, 'cliente']
      }
    } else {
      usersCol.fields.add(
        new SelectField({
          name: 'role',
          required: false,
          values: ['admin', 'empresa', 'financeiro', 'comercial', 'cliente'],
          maxSelect: 1,
        }),
      )
    }
    app.save(usersCol)

    // 2. Opcional: Criar usuário demo para o perfil Cliente caso não exista
    try {
      let targetEmpresaId = ''
      try {
        const molare = app.findFirstRecordByData('empresas', 'cnpj', '59963899000190')
        targetEmpresaId = molare.id
      } catch (_) {
        const todasEmpresas = app.findAllRecords('empresas')
        if (todasEmpresas && todasEmpresas.length > 0) {
          targetEmpresaId = todasEmpresas[0].id
        }
      }

      try {
        const clienteUser = app.findAuthRecordByEmail('_pb_users_auth_', 'cliente@molare.com.br')
        clienteUser.set('role', 'cliente')
        if (targetEmpresaId) clienteUser.set('empresa', targetEmpresaId)
        clienteUser.set('ativo', true)
        app.save(clienteUser)
      } catch (_) {
        const cliUser = new Record(usersCol)
        cliUser.setEmail('cliente@molare.com.br')
        cliUser.setPassword('Cliente@2026')
        cliUser.setVerified(true)
        cliUser.set('name', 'Cliente Visualizador')
        cliUser.set('role', 'cliente')
        if (targetEmpresaId) cliUser.set('empresa', targetEmpresaId)
        cliUser.set('ativo', true)
        app.save(cliUser)
      }
    } catch (err) {
      console.log('Aviso ao semear usuário cliente:', err)
    }
  },
  (app) => {
    try {
      const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
      const roleField = usersCol.fields.getByName('role')
      if (roleField && Array.isArray(roleField.values)) {
        roleField.values = roleField.values.filter((v) => v !== 'cliente')
        app.save(usersCol)
      }
    } catch (_) {}
  },
)
