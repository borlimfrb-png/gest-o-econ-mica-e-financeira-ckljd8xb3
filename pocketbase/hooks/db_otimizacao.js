/**
 * GET /backend/v1/admin/db-diagnostico
 * POST /backend/v1/admin/db-otimizar
 *
 * Ferramenta de otimização do banco de dados (tela /admin/otimizacao).
 *
 * GET — diagnóstico: para as principais coleções do app devolve
 *   contagem de registros, índices existentes e recomendações de índice
 *   (empresa, empresa+ano, user) baseadas nos campos realmente usados
 *   nos filtros do app. Só acessível para role 'admin'.
 *
 * POST — aplica as recomendações pendentes com CREATE INDEX IF NOT EXISTS
 *   (SQLite) via $app.db().newQuery().execute(). Idempotente: rodar de novo
 *   não duplica nem quebra.
 *
 * IMPORTANTE (JSVM goja): callbacks rodam em pool separado — nada pode ser
 * fatorado em funções/constantes top-level; toda a lógica fica inline no
 * corpo de cada callback.
 *
 * Formatação de números/datas NUNCA aqui (JSVM goja sem Intl): o backend
 * devolve números crus e o frontend formata em pt-BR.
 */

routerAdd('GET', '/backend/v1/admin/db-diagnostico', (e) => {
  const authRecord = e.auth
  if (!authRecord || authRecord.getString('role') !== 'admin') {
    return e.json(403, { sucesso: false, erro: 'Acesso restrito: apenas administradores.' })
  }

  const COLECOES = [
    { nome: 'empresas', recs: [] },
    { nome: 'users', recs: [{ campos: ['empresa'], rotulo: 'empresa' }] },
    { nome: 'balancos', recs: [{ campos: ['empresa', 'ano'], rotulo: 'empresa, ano' }] },
    { nome: 'dre', recs: [{ campos: ['empresa', 'ano'], rotulo: 'empresa, ano' }] },
    { nome: 'contas', recs: [{ campos: ['empresa'], rotulo: 'empresa' }] },
    {
      nome: 'plano_contas',
      recs: [
        { campos: ['empresa'], rotulo: 'empresa' },
        { campos: ['centro'], rotulo: 'centro' },
      ],
    },
    { nome: 'lancamentos', recs: [{ campos: ['empresa', 'data'], rotulo: 'empresa, data' }] },
    {
      nome: 'lancamentos_centro',
      recs: [
        { campos: ['empresa'], rotulo: 'empresa' },
        { campos: ['centro'], rotulo: 'centro' },
      ],
    },
    { nome: 'lancamentos_recorrentes', recs: [{ campos: ['empresa'], rotulo: 'empresa' }] },
    { nome: 'metas_lancamentos', recs: [{ campos: ['empresa', 'ano'], rotulo: 'empresa, ano' }] },
    { nome: 'recebiveis', recs: [{ campos: ['empresa'], rotulo: 'empresa' }] },
    { nome: 'contratos', recs: [{ campos: ['empresa'], rotulo: 'empresa' }] },
    { nome: 'notas_fiscais', recs: [{ campos: ['empresa'], rotulo: 'empresa' }] },
    { nome: 'benchmarks_setoriais', recs: [] },
    { nome: 'formacao_servicos', recs: [{ campos: ['empresa'], rotulo: 'empresa' }] },
    { nome: 'formacao_servicos_parametros', recs: [{ campos: ['empresa'], rotulo: 'empresa' }] },
    { nome: 'planejamento_economico', recs: [{ campos: ['empresa'], rotulo: 'empresa' }] },
    { nome: 'grupos_empresariais', recs: [] },
    { nome: 'bsc_kpis', recs: [{ campos: ['empresa', 'ano'], rotulo: 'empresa, ano' }] },
    { nome: 'auditoria_cadastros', recs: [{ campos: ['empresa'], rotulo: 'empresa' }] },
    { nome: 'auditoria_lancamentos', recs: [{ campos: ['empresa'], rotulo: 'empresa' }] },
    { nome: 'agente_conversas', recs: [{ campos: ['user'], rotulo: 'usuário' }] },
    { nome: 'agente_mensagens', recs: [{ campos: ['user'], rotulo: 'usuário' }] },
  ]

  function nomeIndice(colecao, campos) {
    return 'idx_' + colecao + '_' + campos.join('_')
  }

  function sqlIndice(colecao, campos) {
    return (
      'CREATE INDEX IF NOT EXISTS ' +
      nomeIndice(colecao, campos) +
      ' ON ' +
      colecao +
      ' (' +
      campos.join(', ') +
      ')'
    )
  }

  function colecaoExiste(nome) {
    try {
      $app.findCollectionByNameOrId(nome)
      return true
    } catch (err) {
      return false
    }
  }

  function camposExistentes(col) {
    const set = {}
    const fields = col.fields ? (col.fields.all ? col.fields.all() : col.fields) : []
    for (let i = 0; i < fields.length; i++) {
      set[fields[i].name] = true
    }
    return set
  }

  function contarRegistros(nome) {
    try {
      const rows = $app
        .db()
        .newQuery('SELECT COUNT(*) AS total FROM {' + nome + '}')
        .all()
      if (rows && rows.length > 0) {
        const total = rows[0].total
        return typeof total === 'number' ? total : parseInt(String(total), 10) || 0
      }
      return 0
    } catch (err) {
      return -1
    }
  }

  function indicesExistentes(nome) {
    try {
      const rows = $app
        .db()
        .newQuery(
          "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = {:tbl} AND name NOT LIKE 'sqlite_%'",
        )
        .bind({ tbl: nome })
        .all()
      const lista = []
      for (let i = 0; i < rows.length; i++) {
        lista.push(rows[i].name)
      }
      return lista
    } catch (err) {
      return []
    }
  }

  function recomendacoes(def) {
    const pendentes = []
    const presentes = []
    let col = null
    try {
      col = $app.findCollectionByNameOrId(def.nome)
    } catch (err) {
      return { pendentes: pendentes, presentes: presentes }
    }
    const campos = camposExistentes(col)
    for (let i = 0; i < def.recs.length; i++) {
      const rec = def.recs[i]
      // Só recomenda se TODOS os campos da composição existem na coleção
      let ok = true
      for (let j = 0; j < rec.campos.length; j++) {
        if (!campos[rec.campos[j]]) {
          ok = false
          break
        }
      }
      if (!ok) continue
      const idx = nomeIndice(def.nome, rec.campos)
      if (indicesExistentes(def.nome).indexOf(idx) !== -1) {
        presentes.push(idx)
      } else {
        pendentes.push({
          indice: idx,
          campos: rec.campos.join(', '),
          rotulo: rec.rotulo,
          sql: sqlIndice(def.nome, rec.campos),
        })
      }
    }
    return { pendentes: pendentes, presentes: presentes }
  }

  function diagnostico() {
    const colecoes = []
    let totalRegistros = 0
    let recomendadas = 0
    let pendentes = 0
    for (let i = 0; i < COLECOES.length; i++) {
      const def = COLECOES[i]
      if (!colecaoExiste(def.nome)) continue
      const total = contarRegistros(def.nome)
      const idx = indicesExistentes(def.nome)
      const rec = recomendacoes(def)
      colecoes.push({
        colecao: def.nome,
        registros: total,
        indices: idx,
        recomendacoes: rec.pendentes,
        indices_recomendados_presentes: rec.presentes,
      })
      if (total > 0) totalRegistros += total
      recomendadas += rec.presentes.length
      pendentes += rec.pendentes.length
    }
    return {
      colecoes: colecoes,
      status: {
        colecoes_analisadas: colecoes.length,
        registros_totais: totalRegistros,
        indices_recomendados_presentes: recomendadas,
        indices_pendentes: pendentes,
      },
    }
  }

  try {
    const resultado = diagnostico()
    return e.json(200, { sucesso: true, status: resultado.status, colecoes: resultado.colecoes })
  } catch (err) {
    console.log('[router:db_otimizacao] Erro no diagnóstico:', String(err))
    return e.json(500, { sucesso: false, erro: 'Falha ao analisar o banco: ' + String(err) })
  }
})

routerAdd('POST', '/backend/v1/admin/db-otimizar', (e) => {
  const authRecord = e.auth
  if (!authRecord || authRecord.getString('role') !== 'admin') {
    return e.json(403, { sucesso: false, erro: 'Acesso restrito: apenas administradores.' })
  }

  const COLECOES = [
    { nome: 'empresas', recs: [] },
    { nome: 'users', recs: [{ campos: ['empresa'], rotulo: 'empresa' }] },
    { nome: 'balancos', recs: [{ campos: ['empresa', 'ano'], rotulo: 'empresa, ano' }] },
    { nome: 'dre', recs: [{ campos: ['empresa', 'ano'], rotulo: 'empresa, ano' }] },
    { nome: 'contas', recs: [{ campos: ['empresa'], rotulo: 'empresa' }] },
    {
      nome: 'plano_contas',
      recs: [
        { campos: ['empresa'], rotulo: 'empresa' },
        { campos: ['centro'], rotulo: 'centro' },
      ],
    },
    { nome: 'lancamentos', recs: [{ campos: ['empresa', 'data'], rotulo: 'empresa, data' }] },
    {
      nome: 'lancamentos_centro',
      recs: [
        { campos: ['empresa'], rotulo: 'empresa' },
        { campos: ['centro'], rotulo: 'centro' },
      ],
    },
    { nome: 'lancamentos_recorrentes', recs: [{ campos: ['empresa'], rotulo: 'empresa' }] },
    { nome: 'metas_lancamentos', recs: [{ campos: ['empresa', 'ano'], rotulo: 'empresa, ano' }] },
    { nome: 'recebiveis', recs: [{ campos: ['empresa'], rotulo: 'empresa' }] },
    { nome: 'contratos', recs: [{ campos: ['empresa'], rotulo: 'empresa' }] },
    { nome: 'notas_fiscais', recs: [{ campos: ['empresa'], rotulo: 'empresa' }] },
    { nome: 'benchmarks_setoriais', recs: [] },
    { nome: 'formacao_servicos', recs: [{ campos: ['empresa'], rotulo: 'empresa' }] },
    { nome: 'formacao_servicos_parametros', recs: [{ campos: ['empresa'], rotulo: 'empresa' }] },
    { nome: 'planejamento_economico', recs: [{ campos: ['empresa'], rotulo: 'empresa' }] },
    { nome: 'grupos_empresariais', recs: [] },
    { nome: 'bsc_kpis', recs: [{ campos: ['empresa', 'ano'], rotulo: 'empresa, ano' }] },
    { nome: 'auditoria_cadastros', recs: [{ campos: ['empresa'], rotulo: 'empresa' }] },
    { nome: 'auditoria_lancamentos', recs: [{ campos: ['empresa'], rotulo: 'empresa' }] },
    { nome: 'agente_conversas', recs: [{ campos: ['user'], rotulo: 'usuário' }] },
    { nome: 'agente_mensagens', recs: [{ campos: ['user'], rotulo: 'usuário' }] },
  ]

  function nomeIndice(colecao, campos) {
    return 'idx_' + colecao + '_' + campos.join('_')
  }

  function sqlIndice(colecao, campos) {
    return (
      'CREATE INDEX IF NOT EXISTS ' +
      nomeIndice(colecao, campos) +
      ' ON ' +
      colecao +
      ' (' +
      campos.join(', ') +
      ')'
    )
  }

  function colecaoExiste(nome) {
    try {
      $app.findCollectionByNameOrId(nome)
      return true
    } catch (err) {
      return false
    }
  }

  function camposExistentes(col) {
    const set = {}
    const fields = col.fields ? (col.fields.all ? col.fields.all() : col.fields) : []
    for (let i = 0; i < fields.length; i++) {
      set[fields[i].name] = true
    }
    return set
  }

  function contarRegistros(nome) {
    try {
      const rows = $app
        .db()
        .newQuery('SELECT COUNT(*) AS total FROM {' + nome + '}')
        .all()
      if (rows && rows.length > 0) {
        const total = rows[0].total
        return typeof total === 'number' ? total : parseInt(String(total), 10) || 0
      }
      return 0
    } catch (err) {
      return -1
    }
  }

  function indicesExistentes(nome) {
    try {
      const rows = $app
        .db()
        .newQuery(
          "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = {:tbl} AND name NOT LIKE 'sqlite_%'",
        )
        .bind({ tbl: nome })
        .all()
      const lista = []
      for (let i = 0; i < rows.length; i++) {
        lista.push(rows[i].name)
      }
      return lista
    } catch (err) {
      return []
    }
  }

  function recomendacoes(def) {
    const pendentes = []
    const presentes = []
    let col = null
    try {
      col = $app.findCollectionByNameOrId(def.nome)
    } catch (err) {
      return { pendentes: pendentes, presentes: presentes }
    }
    const campos = camposExistentes(col)
    for (let i = 0; i < def.recs.length; i++) {
      const rec = def.recs[i]
      let ok = true
      for (let j = 0; j < rec.campos.length; j++) {
        if (!campos[rec.campos[j]]) {
          ok = false
          break
        }
      }
      if (!ok) continue
      const idx = nomeIndice(def.nome, rec.campos)
      if (indicesExistentes(def.nome).indexOf(idx) !== -1) {
        presentes.push(idx)
      } else {
        pendentes.push({
          indice: idx,
          campos: rec.campos.join(', '),
          rotulo: rec.rotulo,
          sql: sqlIndice(def.nome, rec.campos),
        })
      }
    }
    return { pendentes: pendentes, presentes: presentes }
  }

  function diagnostico() {
    const colecoes = []
    let totalRegistros = 0
    let recomendadas = 0
    let pendentes = 0
    for (let i = 0; i < COLECOES.length; i++) {
      const def = COLECOES[i]
      if (!colecaoExiste(def.nome)) continue
      const total = contarRegistros(def.nome)
      const idx = indicesExistentes(def.nome)
      const rec = recomendacoes(def)
      colecoes.push({
        colecao: def.nome,
        registros: total,
        indices: idx,
        recomendacoes: rec.pendentes,
        indices_recomendados_presentes: rec.presentes,
      })
      if (total > 0) totalRegistros += total
      recomendadas += rec.presentes.length
      pendentes += rec.pendentes.length
    }
    return {
      colecoes: colecoes,
      status: {
        colecoes_analisadas: colecoes.length,
        registros_totais: totalRegistros,
        indices_recomendados_presentes: recomendadas,
        indices_pendentes: pendentes,
      },
    }
  }

  try {
    const antes = diagnostico()
    const aplicados = []
    const falhas = []

    for (let i = 0; i < antes.colecoes.length; i++) {
      const col = antes.colecoes[i]
      for (let j = 0; j < col.recomendacoes.length; j++) {
        const rec = col.recomendacoes[j]
        try {
          $app.db().newQuery(rec.sql).execute()
          aplicados.push(rec.indice)
        } catch (err) {
          falhas.push({ indice: rec.indice, motivo: String(err) })
        }
      }
    }

    const depois = diagnostico()

    return e.json(200, {
      sucesso: falhas.length === 0,
      aplicados: aplicados,
      falhas: falhas,
      antes: antes.status,
      depois: depois.status,
      diagnostico: depois,
    })
  } catch (err) {
    console.log('[router:db_otimizacao] Erro ao otimizar:', String(err))
    return e.json(500, { sucesso: false, erro: 'Falha ao aplicar otimizações: ' + String(err) })
  }
})
