/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    const empresasCol = app.findCollectionByNameOrId('empresas')

    // 1. Adicionar campos 'role' (admin | empresa), 'empresa' (relation para empresas), 'ativo' (bool) em users
    if (!usersCol.fields.getByName('role')) {
      usersCol.fields.add(
        new SelectField({
          name: 'role',
          required: false,
          values: ['admin', 'empresa'],
          maxSelect: 1,
        }),
      )
    }

    if (!usersCol.fields.getByName('empresa')) {
      usersCol.fields.add(
        new RelationField({
          name: 'empresa',
          required: false,
          collectionId: empresasCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        }),
      )
    }

    if (!usersCol.fields.getByName('ativo')) {
      usersCol.fields.add(
        new BoolField({
          name: 'ativo',
          required: false,
        }),
      )
    }

    // Regras de users:
    // admin pode listar, ver, criar, atualizar e excluir qualquer usuário.
    // Usuários comuns podem ver e atualizar apenas seu próprio perfil (e listar a si próprios).
    usersCol.listRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || id = @request.auth.id)"
    usersCol.viewRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || id = @request.auth.id)"
    usersCol.createRule = "@request.auth.id != '' && @request.auth.role = 'admin'"
    usersCol.updateRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || id = @request.auth.id)"
    usersCol.deleteRule =
      "@request.auth.id != '' && @request.auth.role = 'admin' && id != @request.auth.id"

    app.save(usersCol)

    // 2. Regras de API para coleções de dados com vínculo de empresa:
    // Administrador acessa todas as empresas.
    // Usuário de perfil 'empresa' acessa APENAS registros associados à sua empresa cadastrada (@request.auth.empresa).

    // Coleção: empresas
    // list/view: admin vê todas, usuário comum vê apenas a sua empresa
    // create/update/delete: admin tem acesso total; usuário de empresa pode visualizar e editar apenas sua empresa (se necessário)
    empresasCol.listRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || id = @request.auth.empresa)"
    empresasCol.viewRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || id = @request.auth.empresa)"
    empresasCol.createRule = "@request.auth.id != '' && @request.auth.role = 'admin'"
    empresasCol.updateRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || id = @request.auth.empresa)"
    empresasCol.deleteRule = "@request.auth.id != '' && @request.auth.role = 'admin'"
    app.save(empresasCol)

    // Coleção: balancos
    const balancosCol = app.findCollectionByNameOrId('balancos')
    balancosCol.listRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || empresa = @request.auth.empresa)"
    balancosCol.viewRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || empresa = @request.auth.empresa)"
    balancosCol.createRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || empresa = @request.auth.empresa)"
    balancosCol.updateRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || empresa = @request.auth.empresa)"
    balancosCol.deleteRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || empresa = @request.auth.empresa)"
    app.save(balancosCol)

    // Coleção: dre
    const dreCol = app.findCollectionByNameOrId('dre')
    dreCol.listRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || empresa = @request.auth.empresa)"
    dreCol.viewRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || empresa = @request.auth.empresa)"
    dreCol.createRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || empresa = @request.auth.empresa)"
    dreCol.updateRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || empresa = @request.auth.empresa)"
    dreCol.deleteRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || empresa = @request.auth.empresa)"
    app.save(dreCol)

    // Coleção: plano_contas (tem campo 'empresa' e 'user')
    const planoContasCol = app.findCollectionByNameOrId('plano_contas')
    planoContasCol.listRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || empresa = @request.auth.empresa || (empresa = '' && user = @request.auth.id))"
    planoContasCol.viewRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || empresa = @request.auth.empresa || (empresa = '' && user = @request.auth.id))"
    planoContasCol.createRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.body.empresa = @request.auth.empresa)"
    planoContasCol.updateRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || empresa = @request.auth.empresa)"
    planoContasCol.deleteRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || empresa = @request.auth.empresa)"
    app.save(planoContasCol)

    // Coleção: lancamentos (tem 'empresa' e 'user')
    const lancamentosCol = app.findCollectionByNameOrId('lancamentos')
    lancamentosCol.listRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || empresa = @request.auth.empresa)"
    lancamentosCol.viewRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || empresa = @request.auth.empresa)"
    lancamentosCol.createRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.body.empresa = @request.auth.empresa)"
    lancamentosCol.updateRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || empresa = @request.auth.empresa)"
    lancamentosCol.deleteRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || empresa = @request.auth.empresa)"
    app.save(lancamentosCol)

    // Coleção: lancamentos_recorrentes
    const lancRecCol = app.findCollectionByNameOrId('lancamentos_recorrentes')
    lancRecCol.listRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || empresa = @request.auth.empresa)"
    lancRecCol.viewRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || empresa = @request.auth.empresa)"
    lancRecCol.createRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.body.empresa = @request.auth.empresa)"
    lancRecCol.updateRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || empresa = @request.auth.empresa)"
    lancRecCol.deleteRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || empresa = @request.auth.empresa)"
    app.save(lancRecCol)

    // Coleção: metas_lancamentos
    const metasCol = app.findCollectionByNameOrId('metas_lancamentos')
    metasCol.listRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || empresa = @request.auth.empresa)"
    metasCol.viewRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || empresa = @request.auth.empresa)"
    metasCol.createRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.body.empresa = @request.auth.empresa)"
    metasCol.updateRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || empresa = @request.auth.empresa)"
    metasCol.deleteRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || empresa = @request.auth.empresa)"
    app.save(metasCol)

    // Coleção: recebiveis
    const recebiveisCol = app.findCollectionByNameOrId('recebiveis')
    recebiveisCol.listRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || empresa = @request.auth.empresa)"
    recebiveisCol.viewRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || empresa = @request.auth.empresa)"
    recebiveisCol.createRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.body.empresa = @request.auth.empresa)"
    recebiveisCol.updateRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || empresa = @request.auth.empresa)"
    recebiveisCol.deleteRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || empresa = @request.auth.empresa)"
    app.save(recebiveisCol)

    // Coleção: contratos
    const contratosCol = app.findCollectionByNameOrId('contratos')
    contratosCol.listRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || contratante = @request.auth.empresa)"
    contratosCol.viewRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || contratante = @request.auth.empresa)"
    contratosCol.createRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.body.contratante = @request.auth.empresa)"
    contratosCol.updateRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || contratante = @request.auth.empresa)"
    contratosCol.deleteRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || contratante = @request.auth.empresa)"
    app.save(contratosCol)

    // Coleção: notas_fiscais
    const notasCol = app.findCollectionByNameOrId('notas_fiscais')
    notasCol.listRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || empresa = @request.auth.empresa)"
    notasCol.viewRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || empresa = @request.auth.empresa)"
    notasCol.createRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.body.empresa = @request.auth.empresa)"
    notasCol.updateRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || empresa = @request.auth.empresa)"
    notasCol.deleteRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || empresa = @request.auth.empresa)"
    app.save(notasCol)

    // Coleção: produtos
    const produtosCol = app.findCollectionByNameOrId('produtos')
    produtosCol.listRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || empresa = @request.auth.empresa)"
    produtosCol.viewRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || empresa = @request.auth.empresa)"
    produtosCol.createRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.body.empresa = @request.auth.empresa)"
    produtosCol.updateRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || empresa = @request.auth.empresa)"
    produtosCol.deleteRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || empresa = @request.auth.empresa)"
    app.save(produtosCol)

    // Coleção: materias_primas
    const matCol = app.findCollectionByNameOrId('materias_primas')
    matCol.listRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || empresa = @request.auth.empresa)"
    matCol.viewRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || empresa = @request.auth.empresa)"
    matCol.createRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.body.empresa = @request.auth.empresa)"
    matCol.updateRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || empresa = @request.auth.empresa)"
    matCol.deleteRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || empresa = @request.auth.empresa)"
    app.save(matCol)

    // Coleção: fichas_tecnicas
    const fichasCol = app.findCollectionByNameOrId('fichas_tecnicas')
    fichasCol.listRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || empresa = @request.auth.empresa)"
    fichasCol.viewRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || empresa = @request.auth.empresa)"
    fichasCol.createRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.body.empresa = @request.auth.empresa)"
    fichasCol.updateRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || empresa = @request.auth.empresa)"
    fichasCol.deleteRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || empresa = @request.auth.empresa)"
    app.save(fichasCol)

    // Coleção: configuracoes_tributarias
    const configTribCol = app.findCollectionByNameOrId('configuracoes_tributarias')
    configTribCol.listRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || empresa = @request.auth.empresa)"
    configTribCol.viewRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || empresa = @request.auth.empresa)"
    configTribCol.createRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.body.empresa = @request.auth.empresa)"
    configTribCol.updateRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || empresa = @request.auth.empresa)"
    configTribCol.deleteRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || empresa = @request.auth.empresa)"
    app.save(configTribCol)

    // Coleção: historico_precos_produtos (acessa via admin ou produto pertencente à empresa)
    const histPrecoCol = app.findCollectionByNameOrId('historico_precos_produtos')
    histPrecoCol.listRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || produto.empresa = @request.auth.empresa)"
    histPrecoCol.viewRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || produto.empresa = @request.auth.empresa)"
    histPrecoCol.createRule = "@request.auth.id != ''"
    histPrecoCol.updateRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || produto.empresa = @request.auth.empresa)"
    histPrecoCol.deleteRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || produto.empresa = @request.auth.empresa)"
    app.save(histPrecoCol)

    // Coleção: grupos_empresariais
    const gruposCol = app.findCollectionByNameOrId('grupos_empresariais')
    gruposCol.listRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || empresas:each ?= @request.auth.empresa)"
    gruposCol.viewRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || empresas:each ?= @request.auth.empresa)"
    gruposCol.createRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || empresas:each ?= @request.auth.empresa)"
    gruposCol.updateRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || (user = @request.auth.id && empresas:each ?= @request.auth.empresa))"
    gruposCol.deleteRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || (user = @request.auth.id && empresas:each ?= @request.auth.empresa))"
    app.save(gruposCol)

    // Coleção: benchmarks_empresas
    const benchEmpCol = app.findCollectionByNameOrId('benchmarks_empresas')
    benchEmpCol.listRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || empresa = @request.auth.empresa)"
    benchEmpCol.viewRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || empresa = @request.auth.empresa)"
    benchEmpCol.createRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.body.empresa = @request.auth.empresa)"
    benchEmpCol.updateRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || empresa = @request.auth.empresa)"
    benchEmpCol.deleteRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || empresa = @request.auth.empresa)"
    app.save(benchEmpCol)

    // Coleção: memoria_fornecedores_despesas
    const memFornCol = app.findCollectionByNameOrId('memoria_fornecedores_despesas')
    memFornCol.listRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || empresa = @request.auth.empresa)"
    memFornCol.viewRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || empresa = @request.auth.empresa)"
    memFornCol.createRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.body.empresa = @request.auth.empresa)"
    memFornCol.updateRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || empresa = @request.auth.empresa)"
    memFornCol.deleteRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || empresa = @request.auth.empresa)"
    app.save(memFornCol)

    // 3. Atualizar usuário demo 'flavio@borlim.com.br' para role = 'admin' e ativo = true
    try {
      const adminRecord = app.findAuthRecordByEmail('_pb_users_auth_', 'flavio@borlim.com.br')
      adminRecord.set('role', 'admin')
      adminRecord.set('ativo', true)
      app.save(adminRecord)
    } catch (_) {
      // Se não existir, cria
      try {
        const record = new Record(usersCol)
        record.setEmail('flavio@borlim.com.br')
        record.setPassword('Skip@Pass')
        record.setVerified(true)
        record.set('name', 'FLÁVIO ROGÉRIO BORDIGNON (Admin)')
        record.set('role', 'admin')
        record.set('ativo', true)
        app.save(record)
      } catch (err) {}
    }

    // 4. Criar usuário de demonstração padrão vinculado a uma empresa específica
    // Exemplo: 'operador@molare.com.br' vinculado à empresa 'MOLARE COMÉRCIO DE MÓVEIS LTDA' ou primeira empresa existente
    try {
      let targetEmpresaId = ''
      try {
        const molare = app.findFirstRecordByData('empresas', 'cnpj', '59963899000190')
        targetEmpresaId = molare.id
      } catch (_) {
        const todasEmpresas = app.findAllRecords('empresas')
        if (todasEmpresas && todasEmpresas.length > 0) {
          targetEmpresaId = todasEmpresas[0].id
        }
      }

      try {
        const existingEmpUser = app.findAuthRecordByEmail(
          '_pb_users_auth_',
          'operador@molare.com.br',
        )
        existingEmpUser.set('role', 'empresa')
        if (targetEmpresaId) existingEmpUser.set('empresa', targetEmpresaId)
        existingEmpUser.set('ativo', true)
        app.save(existingEmpUser)
      } catch (_) {
        const empUser = new Record(usersCol)
        empUser.setEmail('operador@molare.com.br')
        empUser.setPassword('Molare@2026')
        empUser.setVerified(true)
        empUser.set('name', 'Operador Molare Móveis')
        empUser.set('role', 'empresa')
        if (targetEmpresaId) empUser.set('empresa', targetEmpresaId)
        empUser.set('ativo', true)
        app.save(empUser)
      }
    } catch (err) {
      console.log('Aviso ao semear usuário operador de empresa:', err)
    }
  },
  (app) => {
    // Reverter regras e campos caso necessário
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    usersCol.listRule = 'id = @request.auth.id'
    usersCol.viewRule = 'id = @request.auth.id'
    usersCol.createRule = ''
    usersCol.updateRule = 'id = @request.auth.id'
    usersCol.deleteRule = 'id = @request.auth.id'
    app.save(usersCol)
  },
)
