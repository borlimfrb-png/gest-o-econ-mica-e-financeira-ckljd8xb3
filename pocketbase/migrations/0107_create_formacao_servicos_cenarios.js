/// <reference path="../pb_data/types.d.ts" />
//
// Migração 0107 — Cenários nomeados da Formação de Preço de Serviços.
// Coleção formacao_servicos_cenarios: um cenário guarda nome, descrição e
// parâmetros ajustáveis (JSON) sobre os parâmetros vigentes da empresa.
// Idempotente: se a coleção já existir, no-op.
// Regras sem "in" (PocketBase rejeita): perfis internos (admin, empresa,
// financeiro, comercial) leem/escrevem os próprios registros por empresa
// ativa; perfil cliente sem acesso a nenhuma operação.
migrate(
  (app) => {
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    const empresasCol = app.findCollectionByNameOrId('empresas')

    const regraLeitura =
      "@request.auth.id != '' && @request.auth.role != 'cliente' && (@request.auth.role = 'admin' || @request.auth.role = 'financeiro' || empresa = @request.auth.empresa)"
    const regraEscritaRegistro =
      "@request.auth.id != '' && @request.auth.role != 'cliente' && (@request.auth.role = 'admin' || empresa = @request.auth.empresa)"
    const regraCriacao =
      "@request.auth.id != '' && @request.auth.role != 'cliente' && (@request.auth.role = 'admin' || @request.body.empresa = @request.auth.empresa)"

    if (app.hasTable('formacao_servicos_cenarios')) {
      return
    }
    try {
      app.findCollectionByNameOrId('formacao_servicos_cenarios')
      return
    } catch (_) {
      // não existe — criar abaixo
    }

    const cenarios = new Collection({
      name: 'formacao_servicos_cenarios',
      type: 'base',
      listRule: regraLeitura,
      viewRule: regraLeitura,
      createRule: regraCriacao,
      updateRule: regraEscritaRegistro,
      deleteRule: regraEscritaRegistro,
      fields: [
        {
          name: 'usuario',
          type: 'relation',
          required: false,
          collectionId: usersCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'empresa',
          type: 'relation',
          required: true,
          collectionId: empresasCol.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'nome', type: 'text', required: true, max: 120 },
        { name: 'descricao', type: 'text' },
        // { percentual_margem, percentual_impostos, percentual_comissao,
        //   fator_custos_fixos, fator_custos_diretos, fator_horas }
        { name: 'parametros', type: 'json', required: true, maxSize: 2000000 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_fsp_cenarios_empresa ON formacao_servicos_cenarios (empresa)',
        'CREATE INDEX idx_fsp_cenarios_usuario ON formacao_servicos_cenarios (usuario)',
        'CREATE UNIQUE INDEX idx_fsp_cenarios_empresa_nome ON formacao_servicos_cenarios (empresa, nome)',
      ],
    })
    app.save(cenarios)
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('formacao_servicos_cenarios'))
    } catch (_) {}
  },
)
