/**
 * Hook para Envio do Laudo Balanced Scorecard (BSC) por E-mail ao Cliente
 * Endpoint: POST /api/bsc/enviar-laudo-email
 */

routerAdd(
  'POST',
  '/api/bsc/enviar-laudo-email',
  (e) => {
    try {
      const authRecord = e.auth
      if (!authRecord) {
        return e.json(401, { success: false, message: 'Usuário não autenticado.' })
      }

      const body = e.requestInfo().body || {}
      const {
        destinatario_email,
        assunto,
        mensagem_opcional,
        empresa_id,
        empresa_nome,
        ano,
        score_global,
        html_conteudo,
      } = body

      // Validação de destinatário
      if (!destinatario_email || !destinatario_email.includes('@')) {
        return e.json(400, {
          success: false,
          message: 'Destinatário de e-mail não informado ou inválido.',
        })
      }

      // Verificação das credenciais SMTP no ambiente
      const smtpHost = $os.getenv('SMTP_HOST')
      const smtpPort = $os.getenv('SMTP_PORT')
      const smtpUser = $os.getenv('SMTP_USER')
      const smtpPass = $os.getenv('SMTP_PASS')
      const smtpFrom = $os.getenv('SMTP_FROM')

      if (!smtpHost || !smtpUser || !smtpPass) {
        return e.json(400, {
          success: false,
          codigo: 'SMTP_NAO_CONFIGURADO',
          message:
            'Servidor de e-mail ainda não configurado. Forneça as credenciais SMTP (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM) nas configurações de ambiente.',
        })
      }

      // Dados do remetente / consultoria
      let nomeConsultoria = 'Gestão Econômica e Financeira'
      let remetenteEmail = smtpFrom || 'laudo-bsc@gestao.app'

      try {
        const minhaEmpresaList = $app.findRecordsByFilter(
          'minha_empresa',
          `user = '${authRecord.id}'`,
          '-created',
          1,
        )
        if (minhaEmpresaList && minhaEmpresaList.length > 0) {
          const m = minhaEmpresaList[0]
          nomeConsultoria = m.get('razao_social') || m.get('nome_fantasia') || nomeConsultoria
        }
      } catch (_) {}

      const assuntoFinal =
        assunto ||
        `Laudo BSC — ${empresa_nome || 'Empresa'} — Exercício ${ano || new Date().getFullYear()}`

      const corpoHtml =
        html_conteudo ||
        `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 680px; margin: 0 auto; color: #1e293b; line-height: 1.6;">
          <div style="background: linear-gradient(135deg, #0B1F3A 0%, #1e3a8a 100%); padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
            <h2 style="color: #ffffff; margin: 0; font-size: 20px;">Laudo Executivo Balanced Scorecard (BSC)</h2>
            <p style="color: #93c5fd; margin: 6px 0 0 0; font-size: 13px;">${empresa_nome || 'Empresa Analisada'} · Exercício ${ano || ''}</p>
          </div>
          <div style="background-color: #ffffff; padding: 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
            ${mensagem_opcional ? `<p style="font-size: 14px; color: #334155; margin-bottom: 20px;">${mensagem_opcional}</p>` : ''}
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #2563eb; padding: 14px 16px; border-radius: 6px; margin: 16px 0;">
              <p style="margin: 4px 0; font-size: 14px;"><strong>Score Global BSC:</strong> <span style="font-size: 18px; font-weight: bold; color: #1e3a8a;">${score_global ?? '—'}%</span></p>
            </div>
            <p style="font-size: 12px; color: #64748b; margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 16px;">
              Este laudo foi gerado e enviado através da plataforma de Gestão Econômica e Financeira por ${nomeConsultoria}.
            </p>
          </div>
        </div>
      `

      // Tentativa de envio com o cliente de e-mail do Skip Cloud / PocketBase
      try {
        const mailClient = $app.newMailClient()
        mailClient.send({
          from: {
            address: remetenteEmail,
            name: nomeConsultoria,
          },
          to: [{ address: destinatario_email }],
          subject: assuntoFinal,
          html: corpoHtml,
        })
      } catch (mailErr) {
        console.log('[BSC Email] Erro ao enviar pelo cliente de e-mail:', mailErr)
        return e.json(500, {
          success: false,
          message:
            'Não foi possível disparar o e-mail pelo servidor SMTP configurado. Verifique os parâmetros de porta, TLS e credenciais.',
          error: mailErr.message || String(mailErr),
        })
      }

      return e.json(200, {
        success: true,
        message: `Laudo do BSC enviado com sucesso para ${destinatario_email}!`,
        destinatario: destinatario_email,
        data_envio: new Date().toISOString(),
      })
    } catch (err) {
      console.log('[BSC Email] Exceção geral:', err)
      return e.json(500, {
        success: false,
        message: `Erro interno no envio de e-mail: ${err.message || err}`,
      })
    }
  },
  $apis.requireAuth(),
)
