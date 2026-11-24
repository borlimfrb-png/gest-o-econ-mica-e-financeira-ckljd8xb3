/// <reference path="../pb_data/types.d.ts" />
//
// Migração 0119 — cria a coleção `ajustes_fiscais_ifrs`: itens de ajuste
// (aditivos e exclusões) da conciliação IFRS → Lucro Fiscal do Simulador de
// Regimes (/analise-tributaria). Um registro por item de ajuste, identificado
// por empresa + ano (índice único não impõe: descrições podem se repetir entre
// anos). JSON `ajustes` guarda a lista [{descricao, tipo, valor}] do ano.
// Idempotente: se já existir, no-op. Autodates created/updated sempre.
//
migrate(
  (app) => {
    try {
      app.findCollectionByNameOrId('ajustes_fiscais_ifrs')
      return // já existe: no-op
    } catch (_) {}

    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    const empresasCol = app.findCollectionByNameOrId('empresas')

    // Mesmas expressões da migração 0117 (metas_despesa_mensal):
    // admin = tudo; empresa/financeiro = apenas a empresa principal do usuário
    // OU uma das empresas extras do campo `empresas`; cliente sem acesso.
    const regraLeitura =
      "@request.auth.id != '' && @request.auth.role != 'cliente' && (@request.auth.role = 'admin' || (@request.auth.role = 'empresa' || @request.auth.role = 'financeiro') && (empresa = @request.auth.empresa || empresa ?= @request.auth.empresas:each))"
    const regraEscrita =
      "@request.auth.id != '' && @request.auth.role != 'cliente' && ((@request.auth.role = 'empresa' || @request.auth.role = 'financeiro') && @request.body.empresa = @request.auth.empresa || @request.body.empresa ?= @request.auth.empresas:each || @request.auth.role = 'admin')"

    const col = new Collection({
      name: 'ajustes_fiscais_ifrs',
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
        {
          name: 'ajustes',
          type: 'json',
          required: false,
          maxSize: 2000000,
        },
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
        'CREATE UNIQUE INDEX idx_ajustes_ifrs_emp_ano ON ajustes_fiscais_ifrs (empresa, ano)',
        'CREATE INDEX idx_ajustes_ifrs_empresa ON ajustes_fiscais_ifrs (empresa)',
      ],
    })

    app.save(col)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('ajustes_fiscais_ifrs')
      app.delete(col)
    } catch (_) {}
  },
)
