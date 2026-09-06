/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const empresasCol = app.findCollectionByNameOrId('empresas')
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')

    // =========================================================================
    // TAREFA 1: ISOLAMENTO POR PERFIL NO SERVIDOR (REGRAS DE API)
    // =========================================================================

    // 1.1 Coleções BLOQUEADAS para financeiro e comercial
    // Permitido APENAS admin e empresa vinculada (@request.auth.role = 'empresa' && empresa = @request.auth.empresa)
    const colecoesBloqueadas = [
      'balancos',
      'dre',
      'produtos',
      'materias_primas',
      'fichas_tecnicas',
      'configuracoes_tributarias',
      'benchmarks_empresas',
      'simulador_cenarios',
      'memoria_fornecedores_despesas',
      'bsc_kpis',
      'bsc_iniciativas',
      'bsc_iniciativas_historico',
    ]

    for (const colName of colecoesBloqueadas) {
      try {
        const col = app.findCollectionByNameOrId(colName)
        col.listRule =
          "@request.auth.id != '' && (@request.auth.role = 'admin' || (@request.auth.role = 'empresa' && empresa = @request.auth.empresa))"
        col.viewRule =
          "@request.auth.id != '' && (@request.auth.role = 'admin' || (@request.auth.role = 'empresa' && empresa = @request.auth.empresa))"
        col.createRule =
          "@request.auth.id != '' && (@request.auth.role = 'admin' || (@request.auth.role = 'empresa' && @request.body.empresa = @request.auth.empresa))"
        col.updateRule =
          "@request.auth.id != '' && (@request.auth.role = 'admin' || (@request.auth.role = 'empresa' && empresa = @request.auth.empresa))"
        col.deleteRule =
          "@request.auth.id != '' && (@request.auth.role = 'admin' || (@request.auth.role = 'empresa' && empresa = @request.auth.empresa))"
        app.save(col)
      } catch (err) {
        console.log('Aviso ao aplicar regras na colecao bloqueada ' + colName + ':', err)
      }
    }

    // 1.2 Coleções PERMITIDAS para financeiro (bloqueadas para comercial)
    // admin OU (empresa ou financeiro da mesma empresa)
    const colecoesFinanceiro = [
      'lancamentos',
      'lancamentos_recorrentes',
      'metas_lancamentos',
      'centros',
      'tipos_despesa',
      'contas',
      'plano_contas',
      'lancamentos_centro',
    ]

    for (const colName of colecoesFinanceiro) {
      try {
        const col = app.findCollectionByNameOrId(colName)
        col.listRule =
          "@request.auth.id != '' && (@request.auth.role = 'admin' || ((@request.auth.role = 'empresa' || @request.auth.role = 'financeiro') && empresa = @request.auth.empresa))"
        col.viewRule =
          "@request.auth.id != '' && (@request.auth.role = 'admin' || ((@request.auth.role = 'empresa' || @request.auth.role = 'financeiro') && empresa = @request.auth.empresa))"
        col.createRule =
          "@request.auth.id != '' && (@request.auth.role = 'admin' || ((@request.auth.role = 'empresa' || @request.auth.role = 'financeiro') && @request.body.empresa = @request.auth.empresa))"
        col.updateRule =
          "@request.auth.id != '' && (@request.auth.role = 'admin' || ((@request.auth.role = 'empresa' || @request.auth.role = 'financeiro') && empresa = @request.auth.empresa))"
        col.deleteRule =
          "@request.auth.id != '' && (@request.auth.role = 'admin' || ((@request.auth.role = 'empresa' || @request.auth.role = 'financeiro') && empresa = @request.auth.empresa))"
        app.save(col)
      } catch (err) {
        console.log('Aviso ao aplicar regras na colecao financeiro ' + colName + ':', err)
      }
    }

    // auditoria_lancamentos: list/view para empresa e financeiro da empresa, create livre (@request.auth.id != ''), update/delete SÓ admin
    try {
      const auditCol = app.findCollectionByNameOrId('auditoria_lancamentos')
      auditCol.listRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || ((@request.auth.role = 'empresa' || @request.auth.role = 'financeiro') && empresa = @request.auth.empresa))"
      auditCol.viewRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || ((@request.auth.role = 'empresa' || @request.auth.role = 'financeiro') && empresa = @request.auth.empresa))"
      auditCol.createRule = "@request.auth.id != ''"
      auditCol.updateRule = "@request.auth.id != '' && @request.auth.role = 'admin'"
      auditCol.deleteRule = "@request.auth.id != '' && @request.auth.role = 'admin'"
      app.save(auditCol)
    } catch (err) {
      console.log('Aviso em auditoria_lancamentos:', err)
    }

    // 1.3 Coleções PERMITIDAS para comercial (e financeiro e empresa)
    // recebiveis, notas_fiscais, nfse_tomadores (usam campo empresa)
    const colecoesComercialEmpresa = ['recebiveis', 'notas_fiscais', 'nfse_tomadores']

    for (const colName of colecoesComercialEmpresa) {
      try {
        const col = app.findCollectionByNameOrId(colName)
        col.listRule =
          "@request.auth.id != '' && (@request.auth.role = 'admin' || ((@request.auth.role = 'empresa' || @request.auth.role = 'financeiro' || @request.auth.role = 'comercial') && empresa = @request.auth.empresa))"
        col.viewRule =
          "@request.auth.id != '' && (@request.auth.role = 'admin' || ((@request.auth.role = 'empresa' || @request.auth.role = 'financeiro' || @request.auth.role = 'comercial') && empresa = @request.auth.empresa))"
        col.createRule =
          "@request.auth.id != '' && (@request.auth.role = 'admin' || ((@request.auth.role = 'empresa' || @request.auth.role = 'financeiro' || @request.auth.role = 'comercial') && @request.body.empresa = @request.auth.empresa))"
        col.updateRule =
          "@request.auth.id != '' && (@request.auth.role = 'admin' || ((@request.auth.role = 'empresa' || @request.auth.role = 'financeiro' || @request.auth.role = 'comercial') && empresa = @request.auth.empresa))"
        col.deleteRule =
          "@request.auth.id != '' && (@request.auth.role = 'admin' || ((@request.auth.role = 'empresa' || @request.auth.role = 'financeiro' || @request.auth.role = 'comercial') && empresa = @request.auth.empresa))"
        app.save(col)
      } catch (err) {
        console.log('Aviso em ' + colName + ':', err)
      }
    }

    // Coleção contratos: usa campo 'contratante' como vínculo com a empresa
    try {
      const contratosCol = app.findCollectionByNameOrId('contratos')
      contratosCol.listRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || ((@request.auth.role = 'empresa' || @request.auth.role = 'financeiro' || @request.auth.role = 'comercial') && contratante = @request.auth.empresa))"
      contratosCol.viewRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || ((@request.auth.role = 'empresa' || @request.auth.role = 'financeiro' || @request.auth.role = 'comercial') && contratante = @request.auth.empresa))"
      contratosCol.createRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || ((@request.auth.role = 'empresa' || @request.auth.role = 'financeiro' || @request.auth.role = 'comercial') && @request.body.contratante = @request.auth.empresa))"
      contratosCol.updateRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || ((@request.auth.role = 'empresa' || @request.auth.role = 'financeiro' || @request.auth.role = 'comercial') && contratante = @request.auth.empresa))"
      contratosCol.deleteRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || ((@request.auth.role = 'empresa' || @request.auth.role = 'financeiro' || @request.auth.role = 'comercial') && contratante = @request.auth.empresa))"
      app.save(contratosCol)
    } catch (err) {
      console.log('Aviso em contratos:', err)
    }

    // 1.4 Histórico de preços: verifica via produto.empresa
    try {
      const histPrecoCol = app.findCollectionByNameOrId('historico_precos_produtos')
      histPrecoCol.listRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || (@request.auth.role = 'empresa' && produto.empresa = @request.auth.empresa))"
      histPrecoCol.viewRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || (@request.auth.role = 'empresa' && produto.empresa = @request.auth.empresa))"
      histPrecoCol.createRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || (@request.auth.role = 'empresa' && @request.body.produto.empresa = @request.auth.empresa))"
      histPrecoCol.updateRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || (@request.auth.role = 'empresa' && produto.empresa = @request.auth.empresa))"
      histPrecoCol.deleteRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || (@request.auth.role = 'empresa' && produto.empresa = @request.auth.empresa))"
      app.save(histPrecoCol)
    } catch (err) {
      console.log('Aviso em historico_precos_produtos:', err)
    }

    // =========================================================================
    // TAREFA 2: ESCOPO POR EMPRESA EM benchmarks_setoriais
    // =========================================================================
    const benchCol = app.findCollectionByNameOrId('benchmarks_setoriais')

    // 2.1 Adicionar campo 'empresa' se não existir
    if (!benchCol.fields.getByName('empresa')) {
      benchCol.fields.add(
        new RelationField({
          name: 'empresa',
          required: false,
          collectionId: empresasCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        }),
      )
      app.save(benchCol)
    }

    // 2.2 Backfill herdando a empresa do usuário criador ou default
    let defaultEmpresaId = null
    try {
      const empresas = app.findAllRecords('empresas')
      if (empresas && empresas.length > 0) {
        empresas.sort((a, b) => {
          const da = a.getString('created') || ''
          const db = b.getString('created') || ''
          return da.localeCompare(db)
        })
        defaultEmpresaId = empresas[0].id
      }
    } catch (_) {}

    try {
      const records = app.findAllRecords('benchmarks_setoriais')
      for (const record of records) {
        const empAtual = record.getString('empresa')
        if (!empAtual) {
          let targetEmpresa = ''
          const userId = record.getString('user')
          if (userId) {
            try {
              const u = app.findRecordById('_pb_users_auth_', userId)
              if (u) {
                targetEmpresa = u.getString('empresa')
              }
            } catch (_) {}
          }
          if (!targetEmpresa && defaultEmpresaId) {
            targetEmpresa = defaultEmpresaId
          }
          if (targetEmpresa) {
            record.set('empresa', targetEmpresa)
            app.save(record)
          }
        }
      }
    } catch (err) {
      console.log('Aviso no backfill de benchmarks_setoriais:', err)
      if (defaultEmpresaId) {
        try {
          app
            .db()
            .newQuery(
              "UPDATE benchmarks_setoriais SET empresa = '" +
                defaultEmpresaId +
                "' WHERE empresa IS NULL OR empresa = ''",
            )
            .execute()
        } catch (_) {}
      }
    }

    // 2.3 Adicionar índice por empresa
    benchCol.addIndex('idx_benchmarks_setoriais_empresa', false, 'empresa', '')

    // 2.4 Regras multi-tenant:
    // admin pode tudo; perfil empresa acessa apenas os de sua empresa (@request.auth.empresa)
    benchCol.listRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || (@request.auth.role = 'empresa' && empresa = @request.auth.empresa))"
    benchCol.viewRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || (@request.auth.role = 'empresa' && empresa = @request.auth.empresa))"
    benchCol.createRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || (@request.auth.role = 'empresa' && @request.body.empresa = @request.auth.empresa))"
    benchCol.updateRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || (@request.auth.role = 'empresa' && empresa = @request.auth.empresa))"
    benchCol.deleteRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || (@request.auth.role = 'empresa' && empresa = @request.auth.empresa))"

    app.save(benchCol)

    // =========================================================================
    // TAREFA 3: COLEÇÃO auditoria_seguranca
    // =========================================================================
    let auditoriaSegCol
    try {
      auditoriaSegCol = app.findCollectionByNameOrId('auditoria_seguranca')
    } catch (_) {
      auditoriaSegCol = new Collection({
        name: 'auditoria_seguranca',
        type: 'base',
        listRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
        viewRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
        createRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
        updateRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
        deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
        fields: [
          {
            name: 'data_verificacao',
            type: 'date',
            required: true,
          },
          {
            name: 'status_geral',
            type: 'select',
            required: true,
            values: ['ok', 'divergencia'],
            maxSelect: 1,
          },
          {
            name: 'total_colecoes',
            type: 'number',
            required: true,
          },
          {
            name: 'total_conformes',
            type: 'number',
            required: true,
          },
          {
            name: 'total_divergencias',
            type: 'number',
            required: true,
          },
          {
            name: 'detalhes',
            type: 'json',
          },
          {
            name: 'executado_por',
            type: 'text',
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
          'CREATE INDEX idx_audit_seg_data ON auditoria_seguranca (data_verificacao)',
          'CREATE INDEX idx_audit_seg_status ON auditoria_seguranca (status_geral)',
          'CREATE INDEX idx_audit_seg_created ON auditoria_seguranca (created)',
        ],
      })
      app.save(auditoriaSegCol)
    }
  },
  (app) => {
    try {
      const auditoriaSegCol = app.findCollectionByNameOrId('auditoria_seguranca')
      app.delete(auditoriaSegCol)
    } catch (_) {}

    try {
      const benchCol = app.findCollectionByNameOrId('benchmarks_setoriais')
      benchCol.listRule = "@request.auth.id != '' && user = @request.auth.id"
      benchCol.viewRule = "@request.auth.id != '' && user = @request.auth.id"
      benchCol.createRule = "@request.auth.id != '' && @request.body.user = @request.auth.id"
      benchCol.updateRule = "@request.auth.id != '' && user = @request.auth.id"
      benchCol.deleteRule = "@request.auth.id != '' && user = @request.auth.id"
      benchCol.removeIndex('idx_benchmarks_setoriais_empresa')
      const empF = benchCol.fields.getByName('empresa')
      if (empF) benchCol.fields.removeById(empF.id)
      app.save(benchCol)
    } catch (_) {}
  },
)
