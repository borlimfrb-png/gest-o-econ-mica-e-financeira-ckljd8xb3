/// <reference path="../pb_data/types.d.ts" />
//
// Migração 0111 — cria a coleção `db_otimizacoes_log`, histórico das execuções
// da Otimização Automática do Banco de Dados (cron semanal, domingo 03:00)
// e das aplicações manuais pela tela /admin/otimizacao.
//
// Regras:
// - list/view: somente role admin.
// - create: admin OU superusuário (o cron grava como rotina interna do sistema,
//   sem sessão de usuário — superuser bypassa as regras, admin cobre o modo manual).
// - update/delete: somente admin.
// - COM autodates created/updated (lição da 0109/0110: coleção nova sempre com autodates).
// - Idempotente: se a coleção já existir, no-op.
migrate(
  (app) => {
    try {
      app.findCollectionByNameOrId('db_otimizacoes_log')
      return // já existe: no-op
    } catch (_) {}

    const col = new Collection({
      name: 'db_otimizacoes_log',
      type: 'base',
      listRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      viewRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      createRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      updateRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      fields: [
        {
          name: 'disparo',
          type: 'select',
          required: true,
          values: ['automatico', 'manual'],
          maxSelect: 1,
        },
        {
          name: 'sucesso',
          type: 'bool',
          required: false,
        },
        {
          name: 'colecoes_analisadas',
          type: 'number',
          required: false,
          onlyInt: true,
        },
        {
          name: 'registros_totais',
          type: 'number',
          required: false,
          onlyInt: true,
        },
        {
          name: 'indices_recomendados',
          type: 'number',
          required: false,
          onlyInt: true,
        },
        {
          name: 'aplicados',
          type: 'json',
          required: false,
          maxSize: 100000,
        },
        {
          name: 'falhas',
          type: 'json',
          required: false,
          maxSize: 100000,
        },
        {
          name: 'pendentes_antes',
          type: 'number',
          required: false,
          onlyInt: true,
        },
        {
          name: 'pendentes_depois',
          type: 'number',
          required: false,
          onlyInt: true,
        },
        {
          name: 'executado_por',
          type: 'text',
          required: false,
          max: 200,
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
      indexes: ['CREATE INDEX idx_db_otimizacoes_log_created ON db_otimizacoes_log (created DESC)'],
    })

    app.save(col)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('db_otimizacoes_log')
      app.delete(col)
    } catch (_) {}
  },
)
