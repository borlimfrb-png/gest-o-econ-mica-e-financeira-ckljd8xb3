/// <reference path="../pb_data/types.d.ts" />

routerAdd(
  'POST',
  '/api/test-smtp-connection',
  (c) => {
    const authRecord = c.get('authRecord')
    if (!authRecord) {
      return c.json(401, { error: 'Autenticação necessária' })
    }

    try {
      const body = $apis.requestInfo(c).data || {}
      const targetEmail = body.email || authRecord.getString('email')

      if (!targetEmail || !targetEmail.includes('@')) {
        return c.json(400, { error: 'E-mail de destino inválido para o teste' })
      }

      const mailer = $app.newMailClient()
      const message = new MailerMessage({
        from: {
          address: $app.settings().meta.senderAddress || 'noreply@borlim.com.br',
          name: $app.settings().meta.senderName || 'Borlim Consultoria & Valuation',
        },
        to: [{ address: targetEmail }],
        subject: '✓ Teste de Conexão SMTP e Envio de E-mails — Borlim Sistema',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <div style="background-color: #0b1f3a; color: white; padding: 15px; border-radius: 6px; text-align: center;">
              <h2 style="margin: 0;">Borlim Consultoria & Valuation</h2>
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
                Data/Hora do Teste: ${new Date().toLocaleString('pt-BR')}<br/>
                Disparado por: ${authRecord.getString('email')}
              </p>
            </div>
            <div style="border-top: 1px solid #e2e8f0; padding-top: 15px; font-size: 11px; color: #94a3b8; text-align: center;">
              Borlim Consultoria Contábil e Financeira — Todos os direitos reservados.
            </div>
          </div>
        `,
      })

      mailer.send(message)

      return c.json(200, {
        success: true,
        message: `E-mail de teste enviado com sucesso para ${targetEmail}`,
        target: targetEmail,
      })
    } catch (err) {
      console.error('Falha no teste de conexão SMTP:', err)
      return c.json(500, {
        error:
          'Falha ao enviar e-mail de teste via SMTP. Verifique as credenciais no painel de administração.',
        details: err.message,
      })
    }
  },
  $apis.activityLogger($app),
)
