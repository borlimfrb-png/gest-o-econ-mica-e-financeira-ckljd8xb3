/// <reference path="../pb_data/types.d.ts" />
//
// Migração 0109 — cria a coleção `ferramentas_usuarios` (Habilitar Ferramentas
// por usuário, em /admin/usuarios). Idempotente: se já existir, no-op.
//
// Regras:
// - list/view: o próprio usuário vê a própria habilitação; admin vê todos.
// - create/update/delete: somente admin.
// - perfil cliente: não ganha acesso novo; o que hoje é bloqueado continua bloqueado
//   (as regras de perfil no frontend/permissoesPerfis seguem valendo).
migrate(
  (app) => {
    try {
      app.findCollectionByNameOrId('ferramentas_usuarios')
      return // já existe: no-op
    } catch (_) {}

    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')

    const col = new Collection({
      name: 'ferramentas_usuarios',
      type: 'base',
      listRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || user = @request.auth.id)",
      viewRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || user = @request.auth.id)",
      createRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      updateRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      fields: [
        {
          name: 'user',
          type: 'relation',
          required: true,
          collectionId: usersCol.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'ferramentas_desabilitadas',
          type: 'json',
          required: false,
          maxSize: 200000,
        },
        {
          name: 'atualizado_por',
          type: 'relation',
          required: false,
          collectionId: usersCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
      ],
    })

    app.save(col)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('ferramentas_usuarios')
      app.delete(col)
    } catch (_) {}
  },
)
