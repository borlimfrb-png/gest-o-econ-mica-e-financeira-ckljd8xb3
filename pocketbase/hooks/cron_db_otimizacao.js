// Hook de Otimização Automática do Banco de Dados — Cron Semanal (domingo, 03:00).
// Executa a MESMA rotina da rota POST /backend/v1/admin/db-otimizar (hook
// db_otimizacao.js, tela /admin/otimizacao), mas como rotina interna do sistema:
// SEM checagem de sessão/admin — o cron roda com acesso direto ao $app.
//
// Rotina: varre as coleções principais, identifica índices recomendados que
// faltam (baseados nos campos realmente usados nos filtros do app) e cria cada
// um com CREATE INDEX IF NOT EXISTS, confirmando em sqlite_master — só conta
// como aplicado o índice realmente criado (idempotente: rodar de novo não
// duplica nem quebra).
//
// Persiste o resultado de cada execução na coleção db_otimizacoes_log
// (migração 0111) para a tela /admin/otimizacao exibir
// "Última otimização automática: <data> — X índices aplicados, Y falhas".
//
// IMPORTANTE (JSVM goja):
// - callbacks rodam em pool separado — nada pode ser fatorado em funções/
//   constantes top-level; toda a lógica fica inline no corpo do callback.
// - NÃO existe Intl: nenhuma formatação de moeda/data aqui — o backend
//   devolve números/datas crus e o frontend formata em pt-BR.

cronAdd('db_otimizacao_semanal', '0 3 * * 0', () => {
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

  const inicio = new Date()

  // --- Helpers (inline no callback: pool separado do JSVM) ---

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

  function indiceExisteGlobal(nome) {
    try {
      const rows = $app
        .db()
        .newQuery(
          "SELECT name FROM sqlite_master WHERE type = 'index' AND name = {:n} AND name NOT LIKE 'sqlite_%'",
        )
        .bind({ n: nome })
        .all()
      return rows && rows.length > 0
    } catch (err) {
      return false
    }
  }

  // --- Diagnóstico: para cada coleção, recomendações pendentes e presentes ---

  const colecoesResultado = []
  let totalRegistros = 0
  let presentesTotal = 0
  let pendentesTotal = 0

  for (let i = 0; i < COLECOES.length; i++) {
    const def = COLECOES[i]
    if (!colecaoExiste(def.nome)) continue
    const total = contarRegistros(def.nome)
    const idx = indicesExistentes(def.nome)
    let col = null
    const pendentes = []
    const presentes = []
    try {
      col = $app.findCollectionByNameOrId(def.nome)
    } catch (err) {
      col = null
    }
    if (col) {
      const campos = camposExistentes(col)
      for (let r = 0; r < def.recs.length; r++) {
        const rec = def.recs[r]
        // Só recomenda se TODOS os campos da composição existem na coleção
        let ok = true
        for (let j = 0; j < rec.campos.length; j++) {
          if (!campos[rec.campos[j]]) {
            ok = false
            break
          }
        }
        if (!ok) continue
        const idxNome = nomeIndice(def.nome, rec.campos)
        if (idx.indexOf(idxNome) !== -1 || indiceExisteGlobal(idxNome)) {
          presentes.push(idxNome)
        } else {
          pendentes.push({
            indice: idxNome,
            campos: rec.campos.join(', '),
            rotulo: rec.rotulo,
            sql: sqlIndice(def.nome, rec.campos),
          })
        }
      }
    }
    colecoesResultado.push({
      colecao: def.nome,
      registros: total,
      indices: idx,
      recomendacoes: pendentes,
      indices_recomendados_presentes: presentes,
    })
    if (total > 0) totalRegistros += total
    presentesTotal += presentes.length
    pendentesTotal += pendentes.length
  }

  // --- Aplica as recomendações pendentes (idempotente) ---

  const aplicados = []
  const falhas = []

  for (let c = 0; c < colecoesResultado.length; c++) {
    const colRes = colecoesResultado[c]
    for (let r = 0; r < colRes.recomendacoes.length; r++) {
      const rec = colRes.recomendacoes[r]
      try {
        $app.db().newQuery(rec.sql).execute()
        // Pós-checagem em sqlite_master: só conta como aplicado o índice
        // realmente criado
        if (indiceExisteGlobal(rec.indice)) {
          aplicados.push(rec.indice)
        } else {
          falhas.push({
            indice: rec.indice,
            motivo: 'Comando executado, mas o índice não apareceu em sqlite_master.',
          })
        }
      } catch (err) {
        falhas.push({ indice: rec.indice, motivo: String(err) })
      }
    }
  }

  // --- Re-diagnóstico pós-aplicação ---

  let depoisPendentes = 0
  let depoisPresentes = 0
  for (let c = 0; c < colecoesResultado.length; c++) {
    const colRes = colecoesResultado[c]
    for (let r = 0; r < colRes.recomendacoes.length; r++) {
      if (indiceExisteGlobal(colRes.recomendacoes[r].indice)) {
        depoisPresentes++
      } else {
        depoisPendentes++
      }
    }
  }

  const sucesso = falhas.length === 0
  const fim = new Date()
  const duracaoMs = fim.getTime() - inicio.getTime()

  // --- Persiste o resultado na coleção db_otimizacoes_log ---
  // Sem Intl (JSVM): datas em ISO cru (UTC), o frontend formata em pt-BR.

  try {
    const logCol = $app.findCollectionByNameOrId('db_otimizacoes_log')
    const record = new Record(logCol)
    record.set('disparo', 'automatico')
    record.set('sucesso', sucesso)
    record.set('colecoes_analisadas', colecoesResultado.length)
    record.set('registros_totais', totalRegistros)
    record.set('indices_recomendados', presentesTotal + pendentesTotal)
    record.set('aplicados', JSON.stringify(aplicados))
    record.set('falhas', JSON.stringify(falhas))
    record.set('pendentes_antes', pendentesTotal)
    record.set('pendentes_depois', depoisPendentes)
    record.set('executado_por', 'Cron Semanal (domingo 03:00)')
    $app.save(record)
    console.log(
      '[cron:db_otimizacao] Otimização automática concluída. Índices aplicados:',
      aplicados.length,
      'Falhas:',
      falhas.length,
      'Pendentes antes/depois:',
      pendentesTotal + '/' + depoisPendentes,
      'Duração(ms):',
      duracaoMs,
    )
  } catch (saveErr) {
    console.log('[cron:db_otimizacao] Erro ao persistir o resultado:', saveErr)
  }
})
