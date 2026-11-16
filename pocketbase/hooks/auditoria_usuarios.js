/**
 * Log de Auditoria de Usuários (Skip Cloud / PocketBase JSVM).
 *
 * Grava em `auditoria_usuarios` as ações sensíveis que acontecem NO BACKEND:
 *   - login: via onRecordAuthRequest (todas as autenticações de 'users');
 *   - redefinição de senha: no hook admin_reset_password.js (arquivo separado).
 *
 * As ações feitas pelo frontend (cadastro/edição/exclusão de usuário, ativar/
 * desativar, ferramentas habilitadas, permissões por perfil) são gravadas pelo
 * auditoriaUsuariosService.ts no navegador — a coleção tem createRule null, então
 * essas gravações passam pela rota admin abaixo (superuser).
 *
 * ⚠ JSVM (goja): callbacks executam num POOL SEPARADO de VMs — nenhuma função ou
 * variável top-level pode ser referenciada dentro de routerAdd/onRecordAuthRequest.
 * TODA a lógica vive inline no corpo de cada callback (padrão do projeto).
 * NUNCA usar Intl/toLocaleString aqui (JSVM sem Intl) — datas saem cruas e o
 * frontend formata em pt-BR.
 */

// ---------- rota admin para gravar/logar ações vindas do frontend ----------
routerAdd('POST', '/backend/v1/admin/auditoria-usuarios', (e) => {
  const auth = e.auth
  if (!auth || auth.getString('id') === '') {
    return e.json(401, { sucesso: false, erro: 'Autenticação necessária.' })
  }
  if (auth.getString('role') !== 'admin') {
    return e.json(403, {
      sucesso: false,
      erro: 'Acesso restrito: apenas administradores consultam o log de auditoria.',
    })
  }

  const body = e.requestInfo().body || {}
  const modo = body.modo || 'registrar' // 'registrar' | 'listar'

  // ---- helpers locais (inline no callback) ----
  function audValorTexto(v) {
    return String(v === null || v === undefined ? '' : v)
  }

  function audRegistrar(autor, autorEmail, autorNome, acao, detalhes) {
    try {
      const col = $app.findCollectionByNameOrId('auditoria_usuarios')
      const rec = new Record(col, {
        autor: audValorTexto(autor),
        autor_email: audValorTexto(autorEmail),
        autor_nome: audValorTexto(autorNome),
        acao: audValorTexto(acao),
        detalhes: audValorTexto(detalhes),
        ip: '',
      })
      $app.save(rec)
      return true
    } catch (err) {
      console.log('[router:auditoria_usuarios] Aviso ao registrar:', String(err))
      return false
    }
  }

  // ---- modo listar (com filtros usuário/ação + paginação) ----
  if (modo === 'listar') {
    const page = Math.max(1, parseInt(body.page, 10) || 1)
    const perPage = Math.min(100, Math.max(1, parseInt(body.perPage, 10) || 50))
    const filtroUsuario = audValorTexto(body.usuario)
    const filtroAcao = audValorTexto(body.acao)

    let where = '1=1'
    const binds = {}
    if (filtroUsuario !== '' && filtroUsuario !== 'todos') {
      where += ' AND autor = {:autor}'
      binds.autor = filtroUsuario
    }
    if (filtroAcao !== '' && filtroAcao !== 'todas') {
      where += ' AND acao = {:acao}'
      binds.acao = filtroAcao
    }

    let total = 0
    try {
      const totalRows = $app
        .db()
        .newQuery('SELECT COUNT(*) AS n FROM auditoria_usuarios WHERE ' + where)
        .bind(binds)
        .all()
      total = totalRows.length > 0 ? Number(totalRows[0].n) || 0 : 0
    } catch (err) {
      console.log('[router:auditoria_usuarios] Erro no count:', String(err))
    }

    let rows = []
    try {
      rows = $app
        .db()
        .newQuery(
          'SELECT id, autor, autor_email, autor_nome, acao, detalhes, created ' +
            'FROM auditoria_usuarios WHERE ' +
            where +
            ' ORDER BY created DESC LIMIT {:lim} OFFSET {:off}',
        )
        .bind(binds)
        .bind({ lim: perPage, off: (page - 1) * perPage })
        .all()
    } catch (err) {
      console.log('[router:auditoria_usuarios] Erro na listagem:', String(err))
    }

    return e.json(200, {
      sucesso: true,
      itens: rows,
      total: total,
      page: page,
      perPage: perPage,
      totalPages: total > 0 ? Math.ceil(total / perPage) : 1,
    })
  }

  // ---- modo registrar ----
  const acao = audValorTexto(body.acao) || 'outro'
  const detalhes = audValorTexto(body.detalhes)

  // Por padrão o autor é o próprio admin logado; o corpo pode indicar outro autor
  // (ex.: login de um usuário comum gravado indiretamente).
  const autorId = audValorTexto(body.autor_id) || auth.id
  const autorEmail = audValorTexto(body.autor_email)
  const autorNome = audValorTexto(body.autor_nome)

  const ok = audRegistrar(autorId, autorEmail, autorNome, acao, detalhes)
  return e.json(200, { sucesso: ok })
})

// ---------- login: onRecordAuthRequest ----------
onRecordAuthRequest((e) => {
  try {
    const record = e.record
    if (record && record.collection().name === 'users') {
      const col = $app.findCollectionByNameOrId('auditoria_usuarios')
      const rec = new Record(col, {
        autor: record.id,
        autor_email: record.getString('email'),
        autor_nome: record.getString('name'),
        acao: 'login',
        detalhes: 'Autenticação realizada com sucesso.',
        ip: e.getString('realIp') || '',
      })
      $app.save(rec)
    }
  } catch (err) {
    console.log('[onRecordAuthRequest:auditoria_usuarios] Aviso:', String(err))
  }
}, 'users')
