/// <reference path="../pb_data/types.d.ts" />

//
// Migração 0114 — Log de Auditoria de Usuários + Permissões Personalizadas por Perfil
//
// 1) auditoria_usuarios: log de ações dos usuários (login, redefinição de senha,
//    alteração de permissões/perfil, alteração de ferramentas, cadastro/edição/
//    exclusão de usuário etc.). Somente admin lê; ninguém edita/exclui (a escrita
//    acontece por hooks rodando como superuser, que ignora as regras de API).
// 2) permissoes_perfis: override dinâmico dos módulos permitidos por perfil.
//    SEM registro = comportamento padrão de permissoesPerfis.ts (nada muda até o
//    admin editar). Leitura liberada a qualquer usuário autenticado (o menu e o
//    ModuloRoute precisam saber o que o próprio perfil pode acessar); escrita só
//    admin. O perfil admin é imune: mesmo que exista registro, o código ignora.
//
migrate(
  (app) => {
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')

    // ---------- 1) auditoria_usuarios ----------
    let audCol
    try {
      audCol = app.findCollectionByNameOrId('auditoria_usuarios')
    } catch (_) {
      audCol = new Collection({
        name: 'auditoria_usuarios',
        type: 'base',
        listRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
        viewRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          {
            name: 'autor',
            type: 'relation',
            required: false,
            collectionId: usersCol.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          { name: 'autor_email', type: 'text' },
          { name: 'autor_nome', type: 'text' },
          {
            name: 'acao',
            type: 'select',
            required: true,
            maxSelect: 1,
            values: [
              'login',
              'logout',
              'cadastro_usuario',
              'edicao_usuario',
              'exclusao_usuario',
              'ativar_desativar_usuario',
              'redefinicao_senha',
              'permissao_perfil',
              'ferramentas_habilitadas',
              'importacao',
              'outro',
            ],
          },
          { name: 'detalhes', type: 'text' },
          { name: 'ip', type: 'text' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_aud_usuarios_id ON auditoria_usuarios (id)',
          'CREATE INDEX idx_aud_usuarios_created ON auditoria_usuarios (created)',
          'CREATE INDEX idx_aud_usuarios_autor ON auditoria_usuarios (autor)',
          'CREATE INDEX idx_aud_usuarios_acao ON auditoria_usuarios (acao)',
        ],
      })
      app.save(audCol)
    }

    // ---------- 2) permissoes_perfis ----------
    let permCol
    try {
      permCol = app.findCollectionByNameOrId('permissoes_perfis')
    } catch (_) {
      permCol = new Collection({
        name: 'permissoes_perfis',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
        updateRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
        deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
        fields: [
          { name: 'perfil', type: 'text', required: true },
          { name: 'modulos', type: 'json', required: true },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE UNIQUE INDEX idx_perm_perfis_perfil ON permissoes_perfis (perfil)'],
      })
      app.save(permCol)
    }
  },
  (app) => {
    // Revert best-effort
    try {
      app.delete(app.findCollectionByNameOrId('permissoes_perfis'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('auditoria_usuarios'))
    } catch (_) {}
  },
)
