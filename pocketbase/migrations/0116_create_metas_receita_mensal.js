/// <reference path="../pb_data/types.d.ts" />
//
// Migração 0116 — cria a coleção `metas_receita_mensal`: meta de receita do
// Ponto de Equilíbrio, um registro por empresa + ano + mês (valor em R$).
// Idempotente: se já existir, no-op.
//
// Regras de acesso: admin vê/tudo; perfil empresa/financeiro só na própria
// empresa (vínculo users.empresas); perfil cliente sem acesso.
migrate(
  (app) => {
    try {
      app.findCollectionByNameOrId('metas_receita_mensal')
      return // já existe: no-op
    } catch (_) {}

    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    const empresasCol = app.findCollectionByNameOrId('empresas')

    // Mesmas expressões de vínculo usadas pelas coleções de metas/dados da DRE:
    // admin = tudo; empresa/financeiro = apenas a empresa principal do usuário
    // OU uma das empresas extras do campo `empresas`.
    const regraLeitura =
      "@request.auth.id != '' && @request.auth.role != 'cliente' && (@request.auth.role = 'admin' || (@request.auth.role = 'empresa' || @request.auth.role = 'financeiro') && (empresa = @request.auth.empresa || empresa ?= @request.auth.empresas:each))"
    const regraEscrita =
      "@request.auth.id != '' && @request.auth.role != 'cliente' && ((@request.auth.role = 'empresa' || @request.auth.role = 'financeiro') && @request.body.empresa = @request.auth.empresa || @request.body.empresa ?= @request.auth.empresas:each || @request.auth.role = 'admin')"

    const col = new Collection({
      name: 'metas_receita_mensal',
      type: 'base',
      listRule: regraLeitura,
      viewRule: regraLeitura,
      createRule: regraEscrita,
      updateRule: regraEscrita,
      deleteRule: regraEscrita,
      fields: [
        {
          name: 'empresa',
          type: 'relation',
          required: true,
          collectionId: empresasCol.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'ano', type: 'number', required: true, onlyInt: true },
        { name: 'mes', type: 'number', required: true, onlyInt: true, min: 1, max: 12 },
        { name: 'valor', type: 'number', required: false, min: 0 },
        {
          name: 'user',
          type: 'relation',
          required: true,
          collectionId: usersCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_meta_receita_emp_ano_mes ON metas_receita_mensal (empresa, ano, mes)',
        'CREATE INDEX idx_meta_receita_empresa ON metas_receita_mensal (empresa)',
        'CREATE INDEX idx_meta_receita_ano_mes ON metas_receita_mensal (ano, mes)',
      ],
    })

    app.save(col)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('metas_receita_mensal')
      app.delete(col)
    } catch (_) {}
  },
)
