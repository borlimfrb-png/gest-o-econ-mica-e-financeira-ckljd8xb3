// Hook de Auditoria de Segurança: Cron Mensal (0 6 1 * *) e Rota POST /api/admin/auditoria-seguranca/verificar
// Verifica e compara as regras RLS das coleções do sistema com o baseline de segurança,
// gravando o histórico em 'auditoria_seguranca'.

cronAdd('auditoria_seguranca_mensal', '0 6 1 * *', () => {
  const agora = new Date()
  const dataHojeStr = agora.toISOString().slice(0, 10)

  // Baseline das regras de segurança
  const baseline = {
    bloqueadas: [
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
    ],
    financeiro: [
      'lancamentos',
      'lancamentos_recorrentes',
      'metas_lancamentos',
      'centros',
      'tipos_despesa',
      'contas',
      'plano_contas',
      'lancamentos_centro',
    ],
    comercial_empresa: ['recebiveis', 'notas_fiscais', 'nfse_tomadores'],
  }

  let totalColecoes = 0
  let totalConformes = 0
  let totalDivergencias = 0
  const detalhes = []

  // 1. Verificar coleções bloqueadas para financeiro e comercial (apenas admin e empresa)
  for (let i = 0; i < baseline.bloqueadas.length; i++) {
    const colName = baseline.bloqueadas[i]
    totalColecoes++
    try {
      const col = $app.findCollectionByNameOrId(colName)
      const listRule = col.listRule || ''
      const viewRule = col.viewRule || ''
      const createRule = col.createRule || ''
      const updateRule = col.updateRule || ''
      const deleteRule = col.deleteRule || ''

      const listOk =
        listRule.indexOf("@request.auth.role = 'admin'") !== -1 &&
        listRule.indexOf("@request.auth.role = 'empresa'") !== -1 &&
        listRule.indexOf('empresa = @request.auth.empresa') !== -1 &&
        listRule.indexOf('financeiro') === -1 &&
        listRule.indexOf('comercial') === -1

      const createOk =
        createRule.indexOf("@request.auth.role = 'admin'") !== -1 &&
        createRule.indexOf("@request.auth.role = 'empresa'") !== -1 &&
        createRule.indexOf('@request.body.empresa = @request.auth.empresa') !== -1 &&
        createRule.indexOf('financeiro') === -1 &&
        createRule.indexOf('comercial') === -1

      const updateOk =
        updateRule.indexOf("@request.auth.role = 'admin'") !== -1 &&
        updateRule.indexOf("@request.auth.role = 'empresa'") !== -1 &&
        updateRule.indexOf('financeiro') === -1

      const deleteOk =
        deleteRule.indexOf("@request.auth.role = 'admin'") !== -1 &&
        deleteRule.indexOf("@request.auth.role = 'empresa'") !== -1 &&
        deleteRule.indexOf('financeiro') === -1

      const conforme = listOk && createOk && updateOk && deleteOk
      if (conforme) {
        totalConformes++
      } else {
        totalDivergencias++
      }

      detalhes.push({
        colecao: colName,
        categoria: 'Bloqueada p/ Financeiro e Comercial',
        conforme: conforme,
        regrasAtuais: {
          list: listRule,
          view: viewRule,
          create: createRule,
          update: updateRule,
          delete: deleteRule,
        },
      })
    } catch (err) {
      totalDivergencias++
      detalhes.push({
        colecao: colName,
        categoria: 'Bloqueada p/ Financeiro e Comercial',
        conforme: false,
        erro: 'Coleção não encontrada ou inacessível: ' + String(err),
      })
    }
  }

  // 2. Verificar coleções permitidas para financeiro (bloqueadas para comercial)
  for (let i = 0; i < baseline.financeiro.length; i++) {
    const colName = baseline.financeiro[i]
    totalColecoes++
    try {
      const col = $app.findCollectionByNameOrId(colName)
      const listRule = col.listRule || ''
      const viewRule = col.viewRule || ''
      const createRule = col.createRule || ''
      const updateRule = col.updateRule || ''
      const deleteRule = col.deleteRule || ''

      const listOk =
        listRule.indexOf("@request.auth.role = 'admin'") !== -1 &&
        listRule.indexOf('financeiro') !== -1 &&
        listRule.indexOf('empresa = @request.auth.empresa') !== -1 &&
        listRule.indexOf('comercial') === -1

      const createOk =
        createRule.indexOf("@request.auth.role = 'admin'") !== -1 &&
        createRule.indexOf('financeiro') !== -1 &&
        createRule.indexOf('@request.body.empresa = @request.auth.empresa') !== -1 &&
        createRule.indexOf('comercial') === -1

      const conforme = listOk && createOk
      if (conforme) {
        totalConformes++
      } else {
        totalDivergencias++
      }

      detalhes.push({
        colecao: colName,
        categoria: 'Permitida Financeiro (Bloqueada Comercial)',
        conforme: conforme,
        regrasAtuais: {
          list: listRule,
          view: viewRule,
          create: createRule,
          update: updateRule,
          delete: deleteRule,
        },
      })
    } catch (err) {
      totalDivergencias++
      detalhes.push({
        colecao: colName,
        categoria: 'Permitida Financeiro (Bloqueada Comercial)',
        conforme: false,
        erro: 'Coleção não encontrada: ' + String(err),
      })
    }
  }

  // 3. Auditoria Lançamentos (update e delete só admin)
  totalColecoes++
  try {
    const auditCol = $app.findCollectionByNameOrId('auditoria_lancamentos')
    const listRule = auditCol.listRule || ''
    const updateRule = auditCol.updateRule || ''
    const deleteRule = auditCol.deleteRule || ''

    const conforme =
      listRule.indexOf('financeiro') !== -1 &&
      updateRule.indexOf("@request.auth.role = 'admin'") !== -1 &&
      updateRule.indexOf('financeiro') === -1 &&
      deleteRule.indexOf("@request.auth.role = 'admin'") !== -1 &&
      deleteRule.indexOf('financeiro') === -1

    if (conforme) {
      totalConformes++
    } else {
      totalDivergencias++
    }

    detalhes.push({
      colecao: 'auditoria_lancamentos',
      categoria: 'Auditoria Lançamentos (Read Fin, Write Admin)',
      conforme: conforme,
      regrasAtuais: {
        list: listRule,
        view: auditCol.viewRule || '',
        create: auditCol.createRule || '',
        update: updateRule,
        delete: deleteRule,
      },
    })
  } catch (err) {
    totalDivergencias++
    detalhes.push({
      colecao: 'auditoria_lancamentos',
      categoria: 'Auditoria Lançamentos',
      conforme: false,
      erro: String(err),
    })
  }

  // 4. Coleções Comercial (recebiveis, notas_fiscais, nfse_tomadores)
  for (let i = 0; i < baseline.comercial_empresa.length; i++) {
    const colName = baseline.comercial_empresa[i]
    totalColecoes++
    try {
      const col = $app.findCollectionByNameOrId(colName)
      const listRule = col.listRule || ''
      const createRule = col.createRule || ''

      const conforme =
        listRule.indexOf('comercial') !== -1 &&
        listRule.indexOf('financeiro') !== -1 &&
        listRule.indexOf('empresa = @request.auth.empresa') !== -1 &&
        createRule.indexOf('@request.body.empresa = @request.auth.empresa') !== -1

      if (conforme) {
        totalConformes++
      } else {
        totalDivergencias++
      }

      detalhes.push({
        colecao: colName,
        categoria: 'Permitida Comercial e Financeiro',
        conforme: conforme,
        regrasAtuais: {
          list: listRule,
          view: col.viewRule || '',
          create: createRule,
          update: col.updateRule || '',
          delete: col.deleteRule || '',
        },
      })
    } catch (err) {
      totalDivergencias++
      detalhes.push({
        colecao: colName,
        categoria: 'Permitida Comercial e Financeiro',
        conforme: false,
        erro: String(err),
      })
    }
  }

  // 5. Contratos (vínculo contratante)
  totalColecoes++
  try {
    const contratosCol = $app.findCollectionByNameOrId('contratos')
    const listRule = contratosCol.listRule || ''
    const createRule = contratosCol.createRule || ''

    const conforme =
      listRule.indexOf('contratante = @request.auth.empresa') !== -1 &&
      listRule.indexOf('comercial') !== -1 &&
      createRule.indexOf('@request.body.contratante = @request.auth.empresa') !== -1

    if (conforme) {
      totalConformes++
    } else {
      totalDivergencias++
    }

    detalhes.push({
      colecao: 'contratos',
      categoria: 'Contratos (Vínculo Contratante)',
      conforme: conforme,
      regrasAtuais: {
        list: listRule,
        view: contratosCol.viewRule || '',
        create: createRule,
        update: contratosCol.updateRule || '',
        delete: contratosCol.deleteRule || '',
      },
    })
  } catch (err) {
    totalDivergencias++
    detalhes.push({
      colecao: 'contratos',
      categoria: 'Contratos',
      conforme: false,
      erro: String(err),
    })
  }

  // 6. Historico de precos (produto.empresa)
  totalColecoes++
  try {
    const histCol = $app.findCollectionByNameOrId('historico_precos_produtos')
    const listRule = histCol.listRule || ''
    const createRule = histCol.createRule || ''

    const conforme =
      listRule.indexOf('produto.empresa = @request.auth.empresa') !== -1 &&
      createRule.indexOf('@request.body.produto.empresa = @request.auth.empresa') !== -1

    if (conforme) {
      totalConformes++
    } else {
      totalDivergencias++
    }

    detalhes.push({
      colecao: 'historico_precos_produtos',
      categoria: 'Histórico de Preços (produto.empresa)',
      conforme: conforme,
      regrasAtuais: {
        list: listRule,
        view: histCol.viewRule || '',
        create: createRule,
        update: histCol.updateRule || '',
        delete: histCol.deleteRule || '',
      },
    })
  } catch (err) {
    totalDivergencias++
    detalhes.push({
      colecao: 'historico_precos_produtos',
      categoria: 'Histórico de Preços',
      conforme: false,
      erro: String(err),
    })
  }

  // 7. Benchmarks Setoriais (isolamento por empresa)
  totalColecoes++
  try {
    const benchCol = $app.findCollectionByNameOrId('benchmarks_setoriais')
    const listRule = benchCol.listRule || ''
    const createRule = benchCol.createRule || ''

    const conforme =
      listRule.indexOf('empresa = @request.auth.empresa') !== -1 &&
      createRule.indexOf('@request.body.empresa = @request.auth.empresa') !== -1

    if (conforme) {
      totalConformes++
    } else {
      totalDivergencias++
    }

    detalhes.push({
      colecao: 'benchmarks_setoriais',
      categoria: 'Benchmarks Setoriais (Multi-tenant Empresa)',
      conforme: conforme,
      regrasAtuais: {
        list: listRule,
        view: benchCol.viewRule || '',
        create: createRule,
        update: benchCol.updateRule || '',
        delete: benchCol.deleteRule || '',
      },
    })
  } catch (err) {
    totalDivergencias++
    detalhes.push({
      colecao: 'benchmarks_setoriais',
      categoria: 'Benchmarks Setoriais',
      conforme: false,
      erro: String(err),
    })
  }

  // Salvar relatório
  try {
    const auditSegCol = $app.findCollectionByNameOrId('auditoria_seguranca')
    const record = new Record(auditSegCol)
    record.set('data_verificacao', dataHojeStr)
    record.set('status_geral', totalDivergencias === 0 ? 'ok' : 'divergencia')
    record.set('total_colecoes', totalColecoes)
    record.set('total_conformes', totalConformes)
    record.set('total_divergencias', totalDivergencias)
    record.set('detalhes', JSON.stringify(detalhes))
    record.set('executado_por', 'Cron Mensal')
    $app.save(record)
    console.log(
      '[cron:auditoria_seguranca] Auditoria concluída com sucesso. Conformes:',
      totalConformes,
      'Divergências:',
      totalDivergencias,
    )
  } catch (saveErr) {
    console.log('[cron:auditoria_seguranca] Erro ao persistir relatório:', saveErr)
  }
})

// Endpoint manual POST /api/admin/auditoria-seguranca/verificar (Admin apenas)
routerAdd('POST', '/api/admin/auditoria-seguranca/verificar', (e) => {
  const authRecord = e.auth
  if (!authRecord || authRecord.getString('role') !== 'admin') {
    return e.json(403, { error: 'Acesso restrito para administradores.' })
  }

  const agora = new Date()
  const dataHojeStr = agora.toISOString().slice(0, 10)

  const baseline = {
    bloqueadas: [
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
    ],
    financeiro: [
      'lancamentos',
      'lancamentos_recorrentes',
      'metas_lancamentos',
      'centros',
      'tipos_despesa',
      'contas',
      'plano_contas',
      'lancamentos_centro',
    ],
    comercial_empresa: ['recebiveis', 'notas_fiscais', 'nfse_tomadores'],
  }

  let totalColecoes = 0
  let totalConformes = 0
  let totalDivergencias = 0
  const detalhes = []

  // 1. Coleções bloqueadas para financeiro e comercial
  for (let i = 0; i < baseline.bloqueadas.length; i++) {
    const colName = baseline.bloqueadas[i]
    totalColecoes++
    try {
      const col = $app.findCollectionByNameOrId(colName)
      const listRule = col.listRule || ''
      const viewRule = col.viewRule || ''
      const createRule = col.createRule || ''
      const updateRule = col.updateRule || ''
      const deleteRule = col.deleteRule || ''

      const listOk =
        listRule.indexOf("@request.auth.role = 'admin'") !== -1 &&
        listRule.indexOf("@request.auth.role = 'empresa'") !== -1 &&
        listRule.indexOf('empresa = @request.auth.empresa') !== -1 &&
        listRule.indexOf('financeiro') === -1 &&
        listRule.indexOf('comercial') === -1

      const createOk =
        createRule.indexOf("@request.auth.role = 'admin'") !== -1 &&
        createRule.indexOf("@request.auth.role = 'empresa'") !== -1 &&
        createRule.indexOf('@request.body.empresa = @request.auth.empresa') !== -1 &&
        createRule.indexOf('financeiro') === -1 &&
        createRule.indexOf('comercial') === -1

      const updateOk =
        updateRule.indexOf("@request.auth.role = 'admin'") !== -1 &&
        updateRule.indexOf("@request.auth.role = 'empresa'") !== -1 &&
        updateRule.indexOf('financeiro') === -1

      const deleteOk =
        deleteRule.indexOf("@request.auth.role = 'admin'") !== -1 &&
        deleteRule.indexOf("@request.auth.role = 'empresa'") !== -1 &&
        deleteRule.indexOf('financeiro') === -1

      const conforme = listOk && createOk && updateOk && deleteOk
      if (conforme) {
        totalConformes++
      } else {
        totalDivergencias++
      }

      detalhes.push({
        colecao: colName,
        categoria: 'Bloqueada p/ Financeiro e Comercial',
        conforme: conforme,
        regrasAtuais: {
          list: listRule,
          view: viewRule,
          create: createRule,
          update: updateRule,
          delete: deleteRule,
        },
      })
    } catch (err) {
      totalDivergencias++
      detalhes.push({
        colecao: colName,
        categoria: 'Bloqueada p/ Financeiro e Comercial',
        conforme: false,
        erro: 'Coleção não encontrada: ' + String(err),
      })
    }
  }

  // 2. Coleções financeiro
  for (let i = 0; i < baseline.financeiro.length; i++) {
    const colName = baseline.financeiro[i]
    totalColecoes++
    try {
      const col = $app.findCollectionByNameOrId(colName)
      const listRule = col.listRule || ''
      const viewRule = col.viewRule || ''
      const createRule = col.createRule || ''
      const updateRule = col.updateRule || ''
      const deleteRule = col.deleteRule || ''

      const listOk =
        listRule.indexOf("@request.auth.role = 'admin'") !== -1 &&
        listRule.indexOf('financeiro') !== -1 &&
        listRule.indexOf('empresa = @request.auth.empresa') !== -1 &&
        listRule.indexOf('comercial') === -1

      const createOk =
        createRule.indexOf("@request.auth.role = 'admin'") !== -1 &&
        createRule.indexOf('financeiro') !== -1 &&
        createRule.indexOf('@request.body.empresa = @request.auth.empresa') !== -1 &&
        createRule.indexOf('comercial') === -1

      const conforme = listOk && createOk
      if (conforme) {
        totalConformes++
      } else {
        totalDivergencias++
      }

      detalhes.push({
        colecao: colName,
        categoria: 'Permitida Financeiro (Bloqueada Comercial)',
        conforme: conforme,
        regrasAtuais: {
          list: listRule,
          view: viewRule,
          create: createRule,
          update: updateRule,
          delete: deleteRule,
        },
      })
    } catch (err) {
      totalDivergencias++
      detalhes.push({
        colecao: colName,
        categoria: 'Permitida Financeiro (Bloqueada Comercial)',
        conforme: false,
        erro: 'Coleção não encontrada: ' + String(err),
      })
    }
  }

  // 3. Auditoria Lançamentos
  totalColecoes++
  try {
    const auditCol = $app.findCollectionByNameOrId('auditoria_lancamentos')
    const listRule = auditCol.listRule || ''
    const updateRule = auditCol.updateRule || ''
    const deleteRule = auditCol.deleteRule || ''

    const conforme =
      listRule.indexOf('financeiro') !== -1 &&
      updateRule.indexOf("@request.auth.role = 'admin'") !== -1 &&
      updateRule.indexOf('financeiro') === -1 &&
      deleteRule.indexOf("@request.auth.role = 'admin'") !== -1 &&
      deleteRule.indexOf('financeiro') === -1

    if (conforme) {
      totalConformes++
    } else {
      totalDivergencias++
    }

    detalhes.push({
      colecao: 'auditoria_lancamentos',
      categoria: 'Auditoria Lançamentos (Read Fin, Write Admin)',
      conforme: conforme,
      regrasAtuais: {
        list: listRule,
        view: auditCol.viewRule || '',
        create: auditCol.createRule || '',
        update: updateRule,
        delete: deleteRule,
      },
    })
  } catch (err) {
    totalDivergencias++
    detalhes.push({
      colecao: 'auditoria_lancamentos',
      categoria: 'Auditoria Lançamentos',
      conforme: false,
      erro: String(err),
    })
  }

  // 4. Coleções Comercial (recebiveis, notas_fiscais, nfse_tomadores)
  for (let i = 0; i < baseline.comercial_empresa.length; i++) {
    const colName = baseline.comercial_empresa[i]
    totalColecoes++
    try {
      const col = $app.findCollectionByNameOrId(colName)
      const listRule = col.listRule || ''
      const createRule = col.createRule || ''

      const conforme =
        listRule.indexOf('comercial') !== -1 &&
        listRule.indexOf('financeiro') !== -1 &&
        listRule.indexOf('empresa = @request.auth.empresa') !== -1 &&
        createRule.indexOf('@request.body.empresa = @request.auth.empresa') !== -1

      if (conforme) {
        totalConformes++
      } else {
        totalDivergencias++
      }

      detalhes.push({
        colecao: colName,
        categoria: 'Permitida Comercial e Financeiro',
        conforme: conforme,
        regrasAtuais: {
          list: listRule,
          view: col.viewRule || '',
          create: createRule,
          update: col.updateRule || '',
          delete: col.deleteRule || '',
        },
      })
    } catch (err) {
      totalDivergencias++
      detalhes.push({
        colecao: colName,
        categoria: 'Permitida Comercial e Financeiro',
        conforme: false,
        erro: String(err),
      })
    }
  }

  // 5. Contratos
  totalColecoes++
  try {
    const contratosCol = $app.findCollectionByNameOrId('contratos')
    const listRule = contratosCol.listRule || ''
    const createRule = contratosCol.createRule || ''

    const conforme =
      listRule.indexOf('contratante = @request.auth.empresa') !== -1 &&
      listRule.indexOf('comercial') !== -1 &&
      createRule.indexOf('@request.body.contratante = @request.auth.empresa') !== -1

    if (conforme) {
      totalConformes++
    } else {
      totalDivergencias++
    }

    detalhes.push({
      colecao: 'contratos',
      categoria: 'Contratos (Vínculo Contratante)',
      conforme: conforme,
      regrasAtuais: {
        list: listRule,
        view: contratosCol.viewRule || '',
        create: createRule,
        update: contratosCol.updateRule || '',
        delete: contratosCol.deleteRule || '',
      },
    })
  } catch (err) {
    totalDivergencias++
    detalhes.push({
      colecao: 'contratos',
      categoria: 'Contratos',
      conforme: false,
      erro: String(err),
    })
  }

  // 6. Historico de precos
  totalColecoes++
  try {
    const histCol = $app.findCollectionByNameOrId('historico_precos_produtos')
    const listRule = histCol.listRule || ''
    const createRule = histCol.createRule || ''

    const conforme =
      listRule.indexOf('produto.empresa = @request.auth.empresa') !== -1 &&
      createRule.indexOf('@request.body.produto.empresa = @request.auth.empresa') !== -1

    if (conforme) {
      totalConformes++
    } else {
      totalDivergencias++
    }

    detalhes.push({
      colecao: 'historico_precos_produtos',
      categoria: 'Histórico de Preços (produto.empresa)',
      conforme: conforme,
      regrasAtuais: {
        list: listRule,
        view: histCol.viewRule || '',
        create: createRule,
        update: histCol.updateRule || '',
        delete: histCol.deleteRule || '',
      },
    })
  } catch (err) {
    totalDivergencias++
    detalhes.push({
      colecao: 'historico_precos_produtos',
      categoria: 'Histórico de Preços',
      conforme: false,
      erro: String(err),
    })
  }

  // 7. Benchmarks Setoriais
  totalColecoes++
  try {
    const benchCol = $app.findCollectionByNameOrId('benchmarks_setoriais')
    const listRule = benchCol.listRule || ''
    const createRule = benchCol.createRule || ''

    const conforme =
      listRule.indexOf('empresa = @request.auth.empresa') !== -1 &&
      createRule.indexOf('@request.body.empresa = @request.auth.empresa') !== -1

    if (conforme) {
      totalConformes++
    } else {
      totalDivergencias++
    }

    detalhes.push({
      colecao: 'benchmarks_setoriais',
      categoria: 'Benchmarks Setoriais (Multi-tenant Empresa)',
      conforme: conforme,
      regrasAtuais: {
        list: listRule,
        view: benchCol.viewRule || '',
        create: createRule,
        update: benchCol.updateRule || '',
        delete: benchCol.deleteRule || '',
      },
    })
  } catch (err) {
    totalDivergencias++
    detalhes.push({
      colecao: 'benchmarks_setoriais',
      categoria: 'Benchmarks Setoriais',
      conforme: false,
      erro: String(err),
    })
  }

  // Salvar relatório
  let novoId = ''
  try {
    const auditSegCol = $app.findCollectionByNameOrId('auditoria_seguranca')
    const record = new Record(auditSegCol)
    record.set('data_verificacao', dataHojeStr)
    record.set('status_geral', totalDivergencias === 0 ? 'ok' : 'divergencia')
    record.set('total_colecoes', totalColecoes)
    record.set('total_conformes', totalConformes)
    record.set('total_divergencias', totalDivergencias)
    record.set('detalhes', JSON.stringify(detalhes))
    record.set('executado_por', authRecord.getString('name') || authRecord.getString('email'))
    $app.save(record)
    novoId = record.id
  } catch (saveErr) {
    return e.json(500, { error: 'Falha ao salvar auditoria de segurança: ' + String(saveErr) })
  }

  return e.json(200, {
    success: true,
    relatorio: {
      id: novoId,
      data_verificacao: dataHojeStr,
      status_geral: totalDivergencias === 0 ? 'ok' : 'divergencia',
      total_colecoes: totalColecoes,
      total_conformes: totalConformes,
      total_divergencias: totalDivergencias,
      detalhes: detalhes,
    },
  })
})
