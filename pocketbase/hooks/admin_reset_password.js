/**
 * Endpoint POST /backend/v1/admin/users/reset-password
 *
 * Redefine a senha de um usuário a partir da tela de Admin de Usuários
 * (/admin/usuarios). Um usuário regular autenticado (o admin logado via
 * e-mail/senha do app) NÃO pode trocar a senha de outro registro auth via
 * PATCH /api/collections/users/records/:id — o PocketBase exige oldPassword
 * nesse caso e devolve 400 "Failed to update record.". Aqui o hook roda com
 * a app (privilégio de superuser), que não precisa de oldPassword.
 *
 * Só permite quando o chamador tem role 'admin', e bloqueia auto-redefinição
 * (o próprio admin deve usar o fluxo com oldPassword, fora desta rota).
 */
routerAdd('POST', '/backend/v1/admin/users/reset-password', (e) => {
  const authRecord = e.auth
  if (!authRecord || authRecord.getString('role') !== 'admin') {
    return e.json(403, {
      sucesso: false,
      erro: 'Acesso restrito: apenas administradores podem redefinir senhas.',
    })
  }

  const body = e.requestInfo().body || {}
  const usuarioId = body.usuario_id || ''
  const novaSenha = body.nova_senha || ''

  if (!usuarioId) {
    return e.json(400, { sucesso: false, erro: 'Usuário de destino não informado.' })
  }
  if (!novaSenha || String(novaSenha).length < 8) {
    return e.json(400, {
      sucesso: false,
      erro: 'A nova senha deve possuir pelo menos 8 dígitos.',
    })
  }

  let alvo
  try {
    alvo = $app.findRecordById('users', usuarioId)
  } catch (err) {
    return e.json(404, {
      sucesso: false,
      erro: 'Usuário não encontrado. Ele pode ter sido excluído por outro administrador.',
    })
  }

  if (alvo.id === authRecord.id) {
    return e.json(400, {
      sucesso: false,
      erro: 'Não é possível redefinir a própria senha por este painel. Use o fluxo de alteração de senha informando a senha atual.',
    })
  }

  try {
    alvo.setPassword(novaSenha)
    $app.save(alvo)
  } catch (err) {
    console.log('[router:admin_reset_password] Erro ao gravar nova senha:', String(err))
    return e.json(400, {
      sucesso: false,
      erro:
        'O PocketBase recusou a nova senha (verifique o mínimo de 8 caracteres e tente novamente). Detalhe: ' +
        String(err),
    })
  }

  // Auditoria best-effort (não falha a operação se o log der erro)
  try {
    const auditCol = $app.findCollectionByNameOrId('auditoria_cadastros')
    const auditRecord = new Record(auditCol, {
      entidade: 'users',
      registro_id: alvo.id,
      registro_descricao:
        (alvo.getString('name') || alvo.getString('email') || 'Usuário') +
        ' - Senha resetada manualmente pelo administrador',
      acao: 'edicao',
      usuario: authRecord.id,
      usuario_nome: authRecord.getString('name') || '',
      usuario_email: authRecord.getString('email') || '',
      detalhes: JSON.stringify({ motivo: 'Redefinição de senha pelo painel de usuários' }),
    })
    $app.save(auditRecord)
  } catch (auditErr) {
    console.log('[router:admin_reset_password] Aviso ao auditar:', String(auditErr))
  }

  return e.json(200, {
    sucesso: true,
    mensagem: 'Senha redefinida com sucesso.',
    usuario: {
      id: alvo.id,
      email: alvo.getString('email'),
      name: alvo.getString('name'),
    },
  })
})
