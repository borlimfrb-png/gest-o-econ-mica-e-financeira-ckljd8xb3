/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    const empresasCol = app.findCollectionByNameOrId('empresas')

    // Criar coleção 'auditoria_cadastros'
    // Campos:
    // - empresa: relation -> empresas (opcional: para entidades como empresas ou users sem empresa vinculada)
    // - entidade: select ('empresas' | 'plano_contas' | 'users')
    // - registro_id: text (id do registro afetado)
    // - registro_descricao: text (nome da empresa, código/descrição da conta ou nome/email do usuário)
    // - acao: select ('criacao' | 'edicao' | 'exclusao')
    // - usuario: relation -> users
    // - usuario_nome: text
    // - usuario_email: text
    // - detalhes: json (dados_anteriores, dados_novos, campos_alterados)
    // Regras de acesso RLS:
    // - Para users, somente admin vê auditoria de usuários.
    // - Para outras entidades: admin vê tudo, ou usuário vê da sua empresa vinculada (@request.auth.empresa).
    // Expressão RLS:
    // listRule / viewRule:
    //   @request.auth.id != '' && (@request.auth.role = 'admin' || (entidade != 'users' && empresa = @request.auth.empresa))
    // createRule: @request.auth.id != ''
    // updateRule: @request.auth.id != '' && @request.auth.role = 'admin'
    // deleteRule: @request.auth.id != '' && @request.auth.role = 'admin'

    let auditoriaCol
    try {
      auditoriaCol = app.findCollectionByNameOrId('auditoria_cadastros')
    } catch (_) {
      auditoriaCol = new Collection({
        name: 'auditoria_cadastros',
        type: 'base',
        listRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || (entidade != 'users' && empresa != '' && empresa = @request.auth.empresa))",
        viewRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || (entidade != 'users' && empresa != '' && empresa = @request.auth.empresa))",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
        deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
        fields: [
          {
            name: 'empresa',
            type: 'relation',
            required: false,
            collectionId: empresasCol.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'entidade',
            type: 'select',
            required: true,
            values: ['empresas', 'plano_contas', 'users'],
            maxSelect: 1,
          },
          {
            name: 'registro_id',
            type: 'text',
            required: true,
          },
          {
            name: 'registro_descricao',
            type: 'text',
          },
          {
            name: 'acao',
            type: 'select',
            required: true,
            values: ['criacao', 'edicao', 'exclusao'],
            maxSelect: 1,
          },
          {
            name: 'usuario',
            type: 'relation',
            required: false,
            collectionId: usersCol.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'usuario_nome',
            type: 'text',
          },
          {
            name: 'usuario_email',
            type: 'text',
          },
          {
            name: 'detalhes',
            type: 'json',
          },
          {
            name: 'created',
            type: 'autodate',
            onCreate: true,
            onUpdate: false,
          },
          {
            name: 'updated',
            type: 'autodate',
            onCreate: true,
            onUpdate: true,
          },
        ],
        indexes: [
          'CREATE INDEX idx_audit_cad_entidade ON auditoria_cadastros (entidade)',
          'CREATE INDEX idx_audit_cad_empresa ON auditoria_cadastros (empresa)',
          'CREATE INDEX idx_audit_cad_reg_id ON auditoria_cadastros (registro_id)',
          'CREATE INDEX idx_audit_cad_created ON auditoria_cadastros (created)',
        ],
      })
      app.save(auditoriaCol)
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('auditoria_cadastros')
      app.delete(col)
    } catch (_) {}
  },
)
