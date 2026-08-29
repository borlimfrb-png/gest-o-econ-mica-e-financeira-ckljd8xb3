/**
 * Hook para Envio de Nota Fiscal Eletrônica por E-mail ao Cliente
 * Endpoint: POST /api/nfse/enviar-email
 */

routerAdd(
  'POST',
  '/api/nfse/enviar-email',
  (e) => {
    try {
      const authRecord = e.auth
      if (!authRecord) {
        return e.json(401, { success: false, message: 'Usuário não autenticado.' })
      }

      const body = e.requestInfo().body || {}
      const { nota_id, destinatario_email, mensagem_personalizada } = body

      if (!nota_id) {
        return e.json(400, { success: false, message: 'ID da nota fiscal não informado.' })
      }

      let notaRec = null
      try {
        notaRec = $app.findRecordById('notas_fiscais', nota_id)
      } catch (err) {
        return e.json(404, { success: false, message: 'Nota fiscal não encontrada.' })
      }

      // Verifica propriedade da nota
      if (notaRec.get('user') !== authRecord.id) {
        return e.json(403, { success: false, message: 'Acesso negado a esta nota fiscal.' })
      }

      if (notaRec.get('status') === 'Cancelada') {
        return e.json(400, {
          success: false,
          message:
            'Esta nota fiscal está CANCELADA e não pode ser reenviada por e-mail como documento válido.',
        })
      }

      // Busca dados do prestador (Minha Empresa)
      let nomePrestador = 'Nossa Consultoria'
      let cnpjPrestador = ''
      try {
        const minhaEmpresaList = $app.findRecordsByFilter(
          'minha_empresa',
          `user = '${authRecord.id}'`,
          '-created',
          1,
        )
        if (minhaEmpresaList && minhaEmpresaList.length > 0) {
          const m = minhaEmpresaList[0]
          nomePrestador = m.get('razao_social') || m.get('nome_fantasia') || nomePrestador
          cnpjPrestador = m.get('cnpj') || ''
        }
      } catch (_) {}

      // Busca dados do cliente / tomador
      const tomadorRazao = notaRec.get('tomador_razao_social') || 'Cliente'
      let emailDestino = destinatario_email || notaRec.get('tomador_email') || ''

      if (!emailDestino) {
        const empresaId = notaRec.get('empresa')
        if (empresaId) {
          try {
            const empRec = $app.findRecordById('empresas', empresaId)
            emailDestino = empRec.get('email') || ''
          } catch (_) {}
        }
      }

      if (!emailDestino || !emailDestino.includes('@')) {
        return e.json(400, {
          success: false,
          message:
            'E-mail do cliente não informado ou inválido. Por favor, cadastre um e-mail para este cliente.',
        })
      }

      const numNota = notaRec.get('numero') || 1
      const serieNota = notaRec.get('serie') || '1'
      const codVerificacao = notaRec.get('codigo_verificacao') || 'N/A'
      const valorTotal = Number(notaRec.get('valor_servicos') || 0)
      const valorLiquido = Number(notaRec.get('valor_liquido') || valorTotal)

      const valorFormatado = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }).format(valorLiquido)

      const dataEmissaoRaw = notaRec.get('data_emissao') || ''
      const dataEmissaoFormatada = dataEmissaoRaw
        ? dataEmissaoRaw.slice(0, 10).split('-').reverse().join('/')
        : new Date().toLocaleDateString('pt-BR')

      const discriminacao =
        notaRec.get('discriminacao') || 'Prestação de serviços contábeis e financeiros.'

      const subject = `Nota Fiscal de Serviços Eletrônica · NFSe nº ${numNota} · ${nomePrestador}`

      const htmlBody = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; line-height: 1.6;">
          <div style="background: linear-gradient(135deg, #0B1F3A 0%, #1e3a8a 100%); padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
            <h2 style="color: #ffffff; margin: 0; font-size: 20px;">Nota Fiscal de Serviços Eletrônica (NFS-e)</h2>
            <p style="color: #93c5fd; margin: 6px 0 0 0; font-size: 13px;">${nomePrestador}</p>
          </div>
          
          <div style="background-color: #ffffff; padding: 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
            <p style="font-size: 14px;">Olá, <strong>${tomadorRazao}</strong>,</p>
            
            <p style="font-size: 14px; color: #475569;">
              ${mensagem_personalizada || `Encaminhamos em anexo os dados da Nota Fiscal de Prestação de Serviços Eletrônica (NFS-e) nº <strong>${numNota}</strong> referente aos serviços prestados.`}
            </p>
            
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #2563eb; padding: 14px 16px; border-radius: 6px; margin: 20px 0;">
              <p style="margin: 4px 0; font-size: 13px;"><strong>Número da NFS-e:</strong> nº ${numNota} (Série ${serieNota})</p>
              <p style="margin: 4px 0; font-size: 13px;"><strong>Data de Emissão:</strong> ${dataEmissaoFormatada}</p>
              <p style="margin: 4px 0; font-size: 13px;"><strong>Código de Verificação:</strong> <code style="background: #e2e8f0; padding: 2px 6px; border-radius: 4px; font-weight: bold;">${codVerificacao}</code></p>
              <p style="margin: 4px 0; font-size: 13px;"><strong>Valor Líquido:</strong> <span style="font-size: 15px; font-weight: bold; color: #047857;">${valorFormatado}</span></p>
            </div>

            <div style="background-color: #f1f5f9; padding: 12px 14px; border-radius: 6px; margin: 16px 0;">
              <p style="margin: 0 0 6px 0; font-size: 12px; font-weight: bold; color: #334155;">Discriminação dos Serviços:</p>
              <p style="margin: 0; font-size: 12px; color: #475569; white-space: pre-line;">${discriminacao}</p>
            </div>

            <p style="font-size: 12px; color: #64748b; margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 16px;">
              Este é um e-mail transacional gerado automaticamente pelo módulo de emissão de NFSe da plataforma de Gestão Econômica e Financeira.
            </p>
          </div>
        </div>
      `

      // Dispara e-mail através do cliente de e-mail do Skip Cloud / PocketBase
      try {
        const mailClient = $app.newMailClient()
        mailClient.send({
          from: {
            address: $app.settings().meta.senderAddress || 'no-reply@gestao.app',
            name: nomePrestador,
          },
          to: [{ address: emailDestino, name: tomadorRazao }],
          subject: subject,
          html: htmlBody,
        })
      } catch (mailErr) {
        console.log('[NFSe Email] Erro ao enviar:', mailErr)
        return e.json(500, {
          success: false,
          message:
            'Não foi possível enviar o e-mail transacional. Verifique as configurações de SMTP do sistema.',
          error: mailErr.message || mailErr,
        })
      }

      // Atualiza status da nota
      const dataEnvioHoje = new Date().toISOString().slice(0, 10) + ' 12:00:00'
      notaRec.set('status', 'Enviada')
      notaRec.set('email_enviado_em', dataEnvioHoje)
      notaRec.set('email_destinatario', emailDestino)
      $app.save(notaRec)

      return e.json(200, {
        success: true,
        message: `E-mail com a Nota Fiscal enviado com sucesso para ${emailDestino}!`,
        destinatario: emailDestino,
        data_envio: dataEnvioHoje,
      })
    } catch (err) {
      console.log('[NFSe Email] Exceção geral:', err)
      return e.json(500, {
        success: false,
        message: `Erro interno no envio de e-mail: ${err.message || err}`,
      })
    }
  },
  $apis.requireAuth(),
)
