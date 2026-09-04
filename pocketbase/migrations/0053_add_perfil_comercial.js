/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    const empresasCol = app.findCollectionByNameOrId('empresas')

    // 1. Atualizar campo 'role' em users para incluir 'comercial'
    const roleField = usersCol.fields.getByName('role')
    if (roleField) {
      roleField.values = ['admin', 'empresa', 'financeiro', 'comercial']
    } else {
      usersCol.fields.add(
        new SelectField({
          name: 'role',
          required: false,
          values: ['admin', 'empresa', 'financeiro', 'comercial'],
          maxSelect: 1,
        }),
      )
    }
    app.save(usersCol)

    // 2. Criar usuário demo para o perfil Comercial
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
        const comercialUser = app.findAuthRecordByEmail(
          '_pb_users_auth_',
          'comercial@molare.com.br',
        )
        comercialUser.set('role', 'comercial')
        if (targetEmpresaId) comercialUser.set('empresa', targetEmpresaId)
        comercialUser.set('ativo', true)
        app.save(comercialUser)
      } catch (_) {
        const comUser = new Record(usersCol)
        comUser.setEmail('comercial@molare.com.br')
        comUser.setPassword('Comercial@2026')
        comUser.setVerified(true)
        comUser.set('name', 'Gestor Comercial Molare')
        comUser.set('role', 'comercial')
        if (targetEmpresaId) comUser.set('empresa', targetEmpresaId)
        comUser.set('ativo', true)
        app.save(comUser)
      }
    } catch (err) {
      console.log('Aviso ao semear usuário comercial:', err)
    }
  },
  (app) => {
    try {
      const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
      const roleField = usersCol.fields.getByName('role')
      if (roleField) {
        roleField.values = ['admin', 'empresa', 'financeiro']
        app.save(usersCol)
      }
    } catch (_) {}
  },
)
