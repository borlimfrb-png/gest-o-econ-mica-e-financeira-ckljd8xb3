/// <reference path="../pb_data/types.d.ts" />

/**
 * Migração 0091: Cria a coleção 'importacao_rascunhos'
 * Permite persistir as propostas de importação assistida por IA geradas a partir de PDFs,
 * preservando a conta principal, a lista de despesas detalhadas, os vínculos com o plano de contas
 * e o período escolhido, permitindo que o usuário retome o trabalho se recarregar a página.
 */
migrate(
  (app) => {
    if (!app.hasTable('importacao_rascunhos')) {
      const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
      const empresasCol = app.findCollectionByNameOrId('empresas')

      const rascunhos = new Collection({
        name: 'importacao_rascunhos',
        type: 'base',
        listRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || (@request.auth.role = 'empresa' && empresa = @request.auth.empresa) || user = @request.auth.id)",
        viewRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || (@request.auth.role = 'empresa' && empresa = @request.auth.empresa) || user = @request.auth.id)",
        createRule: "@request.auth.id != ''",
        updateRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || user = @request.auth.id)",
        deleteRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || user = @request.auth.id)",
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
            name: 'empresa',
            type: 'relation',
            required: false,
            collectionId: empresasCol.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'arquivo_nome',
            type: 'text',
            required: true,
          },
          {
            name: 'periodo_tipo',
            type: 'select',
            required: true,
            values: ['unico', 'faixa'],
            maxSelect: 1,
          },
          {
            name: 'periodo_inicio',
            type: 'text',
            required: true,
          },
          {
            name: 'periodo_fim',
            type: 'text',
            required: false,
          },
          {
            name: 'conta_principal',
            type: 'text',
            required: false,
          },
          {
            name: 'status',
            type: 'select',
            required: true,
            values: ['pendente', 'confirmado', 'descartado'],
            maxSelect: 1,
          },
          {
            name: 'proposta_json',
            type: 'json',
            required: false,
          },
          {
            name: 'total_despesas',
            type: 'number',
            required: false,
          },
          {
            name: 'valor_total',
            type: 'number',
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
          'CREATE INDEX idx_import_rascunho_user ON importacao_rascunhos (user)',
          'CREATE INDEX idx_import_rascunho_empresa ON importacao_rascunhos (empresa)',
          'CREATE INDEX idx_import_rascunho_status ON importacao_rascunhos (status)',
          'CREATE INDEX idx_import_rascunho_created ON importacao_rascunhos (created DESC)',
        ],
      })

      app.save(rascunhos)
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('importacao_rascunhos')
      app.delete(col)
    } catch (_) {}
  },
)
