/// <reference path="../pb_data/types.d.ts" />
//
// Migração 0106 — Formação de Preço de Serviços.
// Cria duas coleções novas (idempotente — se já existirem, no-op):
//   - formacao_servicos_parametros: parâmetros da consultoria (custos fixos,
//     horas produtivas, impostos, comissão e margem alvo) por empresa+usuário.
//   - formacao_servicos: catálogo de serviços (horas estimadas, custo direto,
//     profissionais envolvidos) por empresa+usuário.
// Regras: perfis internos leem/escrevem (admin enxerga tudo, demais só a
// própria empresa); perfil cliente sem acesso a nenhuma operação.
migrate(
  (app) => {
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    const empresasCol = app.findCollectionByNameOrId('empresas')

    // Regra de leitura: interno autenticado; admin enxerga todas, os demais só a própria empresa.
    const regraLeitura =
      "@request.auth.id != '' && @request.auth.role != 'cliente' && (@request.auth.role = 'admin' || @request.auth.role = 'financeiro' || empresa = @request.auth.empresa)"
    const regraEscritaRegistro =
      "@request.auth.id != '' && @request.auth.role != 'cliente' && (@request.auth.role = 'admin' || empresa = @request.auth.empresa)"
    const regraCriacao =
      "@request.auth.id != '' && @request.auth.role != 'cliente' && (@request.auth.role = 'admin' || @request.body.empresa = @request.auth.empresa)"

    const camposComuns = [
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
      { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
      { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
    ]

    // 1) Parâmetros da consultoria (um registro por empresa+usuário)
    if (!app.hasTable('formacao_servicos_parametros')) {
      try {
        app.findCollectionByNameOrId('formacao_servicos_parametros')
      } catch (_) {
        const parametros = new Collection({
          name: 'formacao_servicos_parametros',
          type: 'base',
          listRule: regraLeitura,
          viewRule: regraLeitura,
          createRule: regraCriacao,
          updateRule: regraEscritaRegistro,
          deleteRule: regraEscritaRegistro,
          fields: [
            ...camposComuns,
            // Lista de custos fixos: [{ nome, valor }]
            { name: 'custos_fixos', type: 'json' },
            { name: 'quantidade_profissionais', type: 'number', min: 0, onlyInt: true },
            { name: 'horas_produtivas_profissional', type: 'number', min: 0 },
            { name: 'fator_ociosidade', type: 'number', min: 0, max: 100 },
            { name: 'percentual_impostos', type: 'number', min: 0, max: 100 },
            { name: 'percentual_comissao', type: 'number', min: 0, max: 100 },
            { name: 'percentual_margem', type: 'number', min: 0, max: 100 },
            { name: 'regime_tributario', type: 'text' },
            { name: 'observacoes', type: 'text' },
          ],
          indexes: [],
        })
        app.save(parametros)
      }
    }

    // 2) Catálogo de serviços
    if (!app.hasTable('formacao_servicos')) {
      try {
        app.findCollectionByNameOrId('formacao_servicos')
      } catch (_) {
        const parametrosColId = app.findCollectionByNameOrId('formacao_servicos_parametros').id
        const servicos = new Collection({
          name: 'formacao_servicos',
          type: 'base',
          listRule: regraLeitura,
          viewRule: regraLeitura,
          createRule: regraCriacao,
          updateRule: regraEscritaRegistro,
          deleteRule: regraEscritaRegistro,
          fields: [
            ...camposComuns,
            { name: 'nome', type: 'text', required: true },
            { name: 'descricao', type: 'text' },
            { name: 'horas_estimadas', type: 'number', min: 0 },
            { name: 'custo_direto', type: 'number', min: 0 },
            { name: 'profissionais_envolvidos', type: 'number', min: 0, onlyInt: true },
            {
              name: 'parametros',
              type: 'relation',
              required: false,
              collectionId: parametrosColId,
              cascadeDelete: false,
              maxSelect: 1,
            },
          ],
          indexes: [],
        })
        app.save(servicos)
      }
    }
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('formacao_servicos'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('formacao_servicos_parametros'))
    } catch (_) {}
  },
)
