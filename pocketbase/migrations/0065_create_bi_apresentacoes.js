/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    const empresasCol = app.findCollectionByNameOrId('empresas')
    const gruposCol = app.findCollectionByNameOrId('grupos_empresariais')

    // Criar coleção bi_apresentacoes
    // Padrão multi-tenant do projeto: admin vê tudo, usuário com role 'empresa' vê suas apresentações ou da sua empresa
    // Criação apenas para o próprio usuário autenticado
    const biApresentacoesCol = new Collection({
      name: 'bi_apresentacoes',
      type: 'base',
      listRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || (@request.auth.role = 'empresa' && (user = @request.auth.id || empresa = @request.auth.empresa)))",
      viewRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || (@request.auth.role = 'empresa' && (user = @request.auth.id || empresa = @request.auth.empresa)))",
      createRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || (@request.auth.role = 'empresa' && @request.body.user = @request.auth.id))",
      updateRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || (@request.auth.role = 'empresa' && (user = @request.auth.id || empresa = @request.auth.empresa)))",
      deleteRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || (@request.auth.role = 'empresa' && (user = @request.auth.id || empresa = @request.auth.empresa)))",
      fields: [
        {
          name: 'user',
          type: 'relation',
          required: true,
          collectionId: usersCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'empresa',
          type: 'relation',
          required: false,
          collectionId: empresasCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'grupo',
          type: 'relation',
          required: false,
          collectionId: gruposCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'nome',
          type: 'text',
          required: true,
        },
        {
          name: 'ano_base',
          type: 'number',
          required: true,
          onlyInt: true,
        },
        {
          name: 'ano_comparativo',
          type: 'number',
          required: true,
          onlyInt: true,
        },
        {
          name: 'modo_consolidado',
          type: 'bool',
          required: false,
        },
        {
          name: 'widgets_ocultos',
          type: 'json',
          required: false,
        },
        {
          name: 'modo_apresentacao',
          type: 'bool',
          required: false,
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
        'CREATE INDEX idx_bi_apresentacoes_user ON bi_apresentacoes (user)',
        'CREATE INDEX idx_bi_apresentacoes_empresa ON bi_apresentacoes (empresa)',
        'CREATE INDEX idx_bi_apresentacoes_grupo ON bi_apresentacoes (grupo)',
        'CREATE INDEX idx_bi_apresentacoes_nome ON bi_apresentacoes (nome)',
        'CREATE INDEX idx_bi_apresentacoes_created ON bi_apresentacoes (created)',
      ],
    })

    app.save(biApresentacoesCol)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('bi_apresentacoes')
      app.delete(col)
    } catch (_) {}
  },
)
