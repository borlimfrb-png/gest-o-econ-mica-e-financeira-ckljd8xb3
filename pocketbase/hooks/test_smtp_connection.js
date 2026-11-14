/**
 * Endpoint POST /backend/v1/config/test-smtp-connection
 *
 * Dispara um e-mail de teste para validar a conexão SMTP, a partir da tela
 * de Configurações do Sistema.
 *
 * Convenções do JSVM (goja):
 * - `$apis.requireAuth()` como middleware; `e.auth` traz o usuário autenticado;
 * - `e.requestInfo().body` lê o corpo da requisição (não `$apis.requestInfo`);
 * - o cliente de e-mail vem de `$app.newMailClient()`, igual aos demais hooks;
 * - sem Intl/toLocaleString — a data do teste é formatada manualmente.
 */
routerAdd(
  'POST',
  '/backend/v1/config/test-smtp-connection',
  (e) => {
    const authRecord = e.auth
    if (!authRecord) {
      return e.json(401, { success: false, message: 'Usuário não autenticado.' })
    }

    try {
      const body = e.requestInfo().body || {}
      const targetEmail = body.email || authRecord.getString('email')

      if (!targetEmail || !targetEmail.includes('@')) {
        return e.json(400, { success: false, message: 'E-mail de destino inválido para o teste.' })
      }

      // Confirma que há algum servidor de e-mail configurado antes de tentar
      const smtpSettings = $app.settings().smtp || {}
      const smtpEnvHost = $os.getenv('SMTP_HOST')
      const smtpEnvUser = $os.getenv('SMTP_USER')
      const smtpEnvPass = $os.getenv('SMTP_PASS')
      const smtpConfigurado = Boolean(
        (smtpSettings.enabled && smtpSettings.host) || (smtpEnvHost && smtpEnvUser && smtpEnvPass),
      )
      if (!smtpConfigurado) {
        return e.json(400, {
          success: false,
          codigo: 'SMTP_NAO_CONFIGURADO',
          message:
            'Servidor de envio de e-mails (SMTP) não configurado. Parametrize a conexão SMTP antes de testar.',
        })
      }

      // Data/hora do teste formatada manualmente (JSVM não tem Intl)
      const agora = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC'

      const nomeRemetente = $app.settings().meta.senderName || 'Borlim Consultoria & Valuation'
      const remetente =
        $app.settings().meta.senderAddress || smtpSettings.username || 'noreply@borlim.com.br'

      const htmlBody = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <div style="background-color: #0b1f3a; color: white; padding: 15px; border-radius: 6px; text-align: center;">
              <h2 style="margin: 0;">Borlim Consultoria &amp; Valuation</h2>
              <p style="margin: 5px 0 0; font-size: 13px;">Gestão Econômica, Financeira e Avaliação de Empresas</p>
            </div>
            <div style="padding: 20px 0;">
              <h3 style="color: #059669;">✓ Conexão SMTP Validada com Sucesso!</h3>
              <p style="color: #334155; line-height: 1.6;">
                Este é um e-mail de teste disparado pelo módulo de <strong>Configurações do Sistema</strong>.
                Ele confirma que o servidor de e-mail (SMTP) está operacional e apto a enviar laudos de valuation,
                lembretes de vencimento e relatórios executivos aos clientes.
              </p>
              <p style="color: #64748b; font-size: 12px; margin-top: 20px;">
                Data/Hora do Teste: ${agora}<br/>
                Disparado por: ${authRecord.getString('email')}
              </p>
            </div>
            <div style="border-top: 1px solid #e2e8f0; padding-top: 15px; font-size: 11px; color: #94a3b8; text-align: center;">
              Borlim Consultoria Contábil e Financeira — Todos os direitos reservados.
            </div>
          </div>
        `

      const message = new MailerMessage({
        from: { address: remetente, name: nomeRemetente },
        to: [{ address: targetEmail }],
        subject: '✓ Teste de Conexão SMTP e Envio de E-mails — Borlim Sistema',
        html: htmlBody,
        attachments: {},
      })

      $app.newMailClient().send(message)

      return e.json(200, {
        success: true,
        message: `E-mail de teste enviado com sucesso para ${targetEmail}`,
        target: targetEmail,
      })
    } catch (err) {
      console.log('[router:test_smtp_connection] Falha no teste de conexão SMTP:', String(err))
      return e.json(500, {
        success: false,
        message:
          'Falha ao enviar e-mail de teste via SMTP. Verifique as credenciais no painel de administração.',
        details: String(err && err.message ? err.message : err),
      })
    }
  },
  $apis.requireAuth(),
)
