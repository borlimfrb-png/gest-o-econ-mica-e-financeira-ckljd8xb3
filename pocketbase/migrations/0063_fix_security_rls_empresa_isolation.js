/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    const empresasCol = app.findCollectionByNameOrId('empresas')

    // =========================================================================
    // CORREÇÃO 1: users - Bloqueio de auto-escalação de privilégios na updateRule
    // O usuário comum pode autoeditar APENAS campos pessoais:
    // (role, empresa e ativo NÃO podem ser alterados por não-admin).
    // Admin tem permissão irrestrita.
    // =========================================================================
    usersCol.updateRule =
      "@request.auth.id != '' && (" +
      "@request.auth.role = 'admin' || (" +
      'id = @request.auth.id && ' +
      '@request.body.role:isset = false && ' +
      '@request.body.empresa:isset = false && ' +
      '@request.body.ativo:isset = false' +
      '))'
    app.save(usersCol)

    // =========================================================================
    // CORREÇÃO 2: Adicionar campo 'empresa' e isolar por empresa nas 5 coleções:
    // 'centros', 'tipos_despesa', 'contas', 'lancamentos_centro', 'alertas_enviados'
    // =========================================================================

    // Obter primeira empresa para fallback caso necessário
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

    // Função auxiliar para backfill de empresa a partir do criador do registro
    const backfillEmpresa = (tableName) => {
      try {
        const records = app.findAllRecords(tableName)
        for (const record of records) {
          const empAtual = record.getString('empresa')
          if (!empAtual) {
            let targetEmpresa = ''
            const userId = record.getString('user')
            if (userId) {
              try {
                const u = app.findRecordById('_pb_users_auth_', userId)
                if (u) {
                  const uEmp = u.getString('empresa')
                  if (uEmp) {
                    targetEmpresa = uEmp
                  }
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
        console.log('Aviso no backfill de ' + tableName + ':', err)
        if (defaultEmpresaId) {
          try {
            app
              .db()
              .newQuery(
                'UPDATE ' +
                  tableName +
                  " SET empresa = '" +
                  defaultEmpresaId +
                  "' WHERE empresa IS NULL OR empresa = ''",
              )
              .execute()
          } catch (_) {}
        }
      }
    }

    // 2.1 Coleção: centros
    const centrosCol = app.findCollectionByNameOrId('centros')
    if (!centrosCol.fields.getByName('empresa')) {
      centrosCol.fields.add(
        new RelationField({
          name: 'empresa',
          required: false,
          collectionId: empresasCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        }),
      )
      app.save(centrosCol)
    }
    backfillEmpresa('centros')
    centrosCol.listRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || empresa = @request.auth.empresa)"
    centrosCol.viewRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || empresa = @request.auth.empresa)"
    centrosCol.createRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.body.empresa = @request.auth.empresa)"
    centrosCol.updateRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || empresa = @request.auth.empresa)"
    centrosCol.deleteRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || empresa = @request.auth.empresa)"
    centrosCol.addIndex('idx_centros_empresa', false, 'empresa', '')
    app.save(centrosCol)

    // 2.2 Coleção: tipos_despesa
    const tiposDespesaCol = app.findCollectionByNameOrId('tipos_despesa')
    if (!tiposDespesaCol.fields.getByName('empresa')) {
      tiposDespesaCol.fields.add(
        new RelationField({
          name: 'empresa',
          required: false,
          collectionId: empresasCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        }),
      )
      app.save(tiposDespesaCol)
    }
    backfillEmpresa('tipos_despesa')
    tiposDespesaCol.listRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || empresa = @request.auth.empresa)"
    tiposDespesaCol.viewRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || empresa = @request.auth.empresa)"
    tiposDespesaCol.createRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.body.empresa = @request.auth.empresa)"
    tiposDespesaCol.updateRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || empresa = @request.auth.empresa)"
    tiposDespesaCol.deleteRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || empresa = @request.auth.empresa)"
    tiposDespesaCol.addIndex('idx_tipos_despesa_empresa', false, 'empresa', '')
    app.save(tiposDespesaCol)

    // 2.3 Coleção: contas
    const contasCol = app.findCollectionByNameOrId('contas')
    if (!contasCol.fields.getByName('empresa')) {
      contasCol.fields.add(
        new RelationField({
          name: 'empresa',
          required: false,
          collectionId: empresasCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        }),
      )
      app.save(contasCol)
    }
    backfillEmpresa('contas')
    contasCol.listRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || empresa = @request.auth.empresa)"
    contasCol.viewRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || empresa = @request.auth.empresa)"
    contasCol.createRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.body.empresa = @request.auth.empresa)"
    contasCol.updateRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || empresa = @request.auth.empresa)"
    contasCol.deleteRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || empresa = @request.auth.empresa)"
    contasCol.addIndex('idx_contas_empresa', false, 'empresa', '')
    app.save(contasCol)

    // 2.4 Coleção: lancamentos_centro
    const lancCentroCol = app.findCollectionByNameOrId('lancamentos_centro')
    if (!lancCentroCol.fields.getByName('empresa')) {
      lancCentroCol.fields.add(
        new RelationField({
          name: 'empresa',
          required: false,
          collectionId: empresasCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        }),
      )
      app.save(lancCentroCol)
    }
    // Backfill para lancamentos_centro: se o centro tiver empresa, usa a do centro, senão a do user
    try {
      const records = app.findAllRecords('lancamentos_centro')
      for (const record of records) {
        if (!record.getString('empresa')) {
          let targetEmpresa = ''
          const centroId = record.getString('centro')
          if (centroId) {
            try {
              const c = app.findRecordById('centros', centroId)
              if (c) {
                targetEmpresa = c.getString('empresa')
              }
            } catch (_) {}
          }
          if (!targetEmpresa) {
            const userId = record.getString('user')
            if (userId) {
              try {
                const u = app.findRecordById('_pb_users_auth_', userId)
                if (u) {
                  targetEmpresa = u.getString('empresa')
                }
              } catch (_) {}
            }
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
      console.log('Aviso no backfill de lancamentos_centro:', err)
      if (defaultEmpresaId) {
        try {
          app
            .db()
            .newQuery(
              "UPDATE lancamentos_centro SET empresa = '" +
                defaultEmpresaId +
                "' WHERE empresa IS NULL OR empresa = ''",
            )
            .execute()
        } catch (_) {}
      }
    }
    lancCentroCol.listRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || empresa = @request.auth.empresa)"
    lancCentroCol.viewRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || empresa = @request.auth.empresa)"
    lancCentroCol.createRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.body.empresa = @request.auth.empresa)"
    lancCentroCol.updateRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || empresa = @request.auth.empresa)"
    lancCentroCol.deleteRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || empresa = @request.auth.empresa)"
    lancCentroCol.addIndex('idx_lancamentos_centro_empresa', false, 'empresa', '')
    app.save(lancCentroCol)

    // 2.5 Coleção: alertas_enviados
    const alertasCol = app.findCollectionByNameOrId('alertas_enviados')
    if (!alertasCol.fields.getByName('empresa')) {
      alertasCol.fields.add(
        new RelationField({
          name: 'empresa',
          required: false,
          collectionId: empresasCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        }),
      )
      app.save(alertasCol)
    }
    // Backfill para alertas_enviados: buscar a empresa vinculada à meta referenciada
    try {
      const records = app.findAllRecords('alertas_enviados')
      for (const record of records) {
        if (!record.getString('empresa')) {
          let targetEmpresa = ''
          const metaId = record.getString('meta')
          if (metaId) {
            try {
              const m = app.findRecordById('metas_lancamentos', metaId)
              if (m) {
                targetEmpresa = m.getString('empresa')
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
      console.log('Aviso no backfill de alertas_enviados:', err)
      if (defaultEmpresaId) {
        try {
          app
            .db()
            .newQuery(
              "UPDATE alertas_enviados SET empresa = '" +
                defaultEmpresaId +
                "' WHERE empresa IS NULL OR empresa = ''",
            )
            .execute()
        } catch (_) {}
      }
    }
    alertasCol.listRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || empresa = @request.auth.empresa)"
    alertasCol.viewRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || empresa = @request.auth.empresa)"
    alertasCol.createRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.body.empresa = @request.auth.empresa)"
    alertasCol.updateRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || empresa = @request.auth.empresa)"
    alertasCol.deleteRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || empresa = @request.auth.empresa)"
    alertasCol.addIndex('idx_alertas_enviados_empresa', false, 'empresa', '')
    app.save(alertasCol)

    // =========================================================================
    // CORREÇÃO 3: historico_precos_produtos - createRule
    // Usuário comum só pode criar histórico para produto que pertença à sua empresa.
    // Admin tem permissão irrestrita.
    // =========================================================================
    const histPrecosCol = app.findCollectionByNameOrId('historico_precos_produtos')
    histPrecosCol.createRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.body.produto.empresa = @request.auth.empresa)"
    app.save(histPrecosCol)
  },
  (app) => {
    // Reverter regras e campos caso necessário
    try {
      const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
      usersCol.updateRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || id = @request.auth.id)"
      app.save(usersCol)
    } catch (_) {}

    try {
      const histPrecosCol = app.findCollectionByNameOrId('historico_precos_produtos')
      histPrecosCol.createRule = "@request.auth.id != ''"
      app.save(histPrecosCol)
    } catch (_) {}

    const reverterColecao = (colName) => {
      try {
        const col = app.findCollectionByNameOrId(colName)
        col.listRule = '@request.auth.id != "" && user = @request.auth.id'
        col.viewRule = '@request.auth.id != "" && user = @request.auth.id'
        col.createRule = '@request.auth.id != ""'
        col.updateRule = '@request.auth.id != "" && user = @request.auth.id'
        col.deleteRule = '@request.auth.id != "" && user = @request.auth.id'
        const f = col.fields.getByName('empresa')
        if (f) {
          col.fields.removeById(f.id)
        }
        app.save(col)
      } catch (_) {}
    }

    reverterColecao('centros')
    reverterColecao('tipos_despesa')
    reverterColecao('contas')
    reverterColecao('lancamentos_centro')
    reverterColecao('alertas_enviados')
  },
)
