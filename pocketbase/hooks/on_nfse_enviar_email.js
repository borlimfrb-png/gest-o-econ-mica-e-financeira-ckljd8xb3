/**
 * Hook para Envio de Nota Fiscal Eletrônica por E-mail ao Cliente
 * Endpoint: POST /api/nfse/enviar-email
 */

routerAdd(
  'POST',
  '/backend/v1/nfse/enviar-email',
  (e) => {
    let pdfFile = null
    let xmlFile = null
    let pdfReader = null
    let xmlReader = null

    try {
      const authRecord = e.auth
      if (!authRecord) {
        return e.json(401, { success: false, message: 'Usuário não autenticado.' })
      }

      const body = e.requestInfo().body || {}
      const { nota_id, destinatario_email, mensagem_personalizada, xml_conteudo, pdf_base64 } = body

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

      // Verificação das configurações SMTP do sistema ($app.settings().smtp ou variáveis)
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
            'Servidor de envio de e-mails (SMTP) não configurado. Acesse Configurações > Conexão SMTP para parametrizar o servidor antes de enviar e-mails aos clientes.',
        })
      }

      const chaveAcessoNota = notaRec.get('chave_acesso') || ''
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
              ${chaveAcessoNota ? `<p style="margin: 4px 0; font-size: 13px;"><strong>Chave de Acesso Nacional:</strong> <code style="background: #e2e8f0; padding: 2px 6px; border-radius: 4px; font-size: 11px; word-break: break-all;">${chaveAcessoNota}</code></p>` : ''}
              <p style="margin: 4px 0; font-size: 13px;"><strong>Valor Líquido:</strong> <span style="font-size: 15px; font-weight: bold; color: #047857;">${valorFormatado}</span></p>
            </div>

            <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 6px; padding: 12px 14px; margin: 16px 0;">
              <p style="margin: 0; font-size: 12px; color: #065f46; font-weight: 600;">
                Documentos anexados a esta mensagem:
              </p>
              <ul style="margin: 6px 0 0 16px; padding: 0; font-size: 12px; color: #047857;">
                <li>Documento Auxiliar da NFS-e (DANFSE em formato PDF)</li>
                <li>Arquivo XML da NFS-e no Padrão Nacional / ABRASF</li>
              </ul>
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

      // Função auxiliar para decodificar base64 puro em Uint8Array no ambiente Goja
      function base64ToUint8(base64Str) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
        let clean = String(base64Str)
          .replace(/[^A-Za-z0-9+/=]/g, '')
          .replace(/=/g, '')
        while (clean.length % 4 !== 0) {
          clean += 'A'
        }
        const byteArray = new Uint8Array((clean.length * 3) / 4)
        let byteIndex = 0
        let charIndex = 0
        while (charIndex < clean.length) {
          const enc1 = chars.indexOf(clean.charAt(charIndex++))
          const enc2 = chars.indexOf(clean.charAt(charIndex++))
          const enc3 = chars.indexOf(clean.charAt(charIndex++))
          const enc4 = chars.indexOf(clean.charAt(charIndex++))
          if (enc1 === -1 || enc2 === -1 || enc3 === -1 || enc4 === -1) {
            break
          }
          const bits24 = (enc1 << 18) | (enc2 << 12) | (enc3 << 6) | enc4
          const b1 = (bits24 >> 16) & 0xff
          const b2 = (bits24 >> 8) & 0xff
          const b3 = bits24 & 0xff
          byteArray[byteIndex++] = b1
          if (enc3 !== 64) byteArray[byteIndex++] = b2
          if (enc4 !== 64) byteArray[byteIndex++] = b3
        }
        return byteArray.subarray(0, byteIndex)
      }

      // Preparação dos anexos (XML e PDF)
      const xmlConteudoFinal = xml_conteudo || notaRec.getString('xml_conteudo') || ''
      const pdfBase64Final = pdf_base64 || ''

      const message = new MailerMessage({
        from: {
          address:
            $app.settings().meta.senderAddress || smtpSettings.username || 'no-reply@gestao.app',
          name: nomePrestador,
        },
        to: [{ address: emailDestino, name: tomadorRazao }],
        subject: subject,
        html: htmlBody,
        attachments: {},
      })

      // 1. Anexa o XML se disponível
      if (xmlConteudoFinal && typeof xmlConteudoFinal === 'string') {
        try {
          const xmlNome = `NFSe_${numNota}_${serieNota}.xml`
          xmlFile = $filesystem.fileFromBytes(xmlConteudoFinal, xmlNome)
          if (xmlFile && xmlFile.reader && typeof xmlFile.reader.open === 'function') {
            xmlReader = xmlFile.reader.open()
            message.attachments[xmlNome] = xmlReader
          }
        } catch (xmlAnexoErr) {
          console.log('[NFSe Email] Aviso ao gerar anexo XML:', xmlAnexoErr)
        }
      }

      // 2. Anexa o PDF (DANFSE) se enviado em base64
      if (pdfBase64Final && typeof pdfBase64Final === 'string') {
        try {
          const pdfBytes = base64ToUint8(pdfBase64Final)
          const pdfNome = `DANFSE_NFSe_${numNota}_${serieNota}.pdf`
          pdfFile = $filesystem.fileFromBytes(pdfBytes, pdfNome)
          if (pdfFile && pdfFile.reader && typeof pdfFile.reader.open === 'function') {
            pdfReader = pdfFile.reader.open()
            message.attachments[pdfNome] = pdfReader
          }
        } catch (pdfAnexoErr) {
          console.log('[NFSe Email] Aviso ao gerar anexo PDF:', pdfAnexoErr)
        }
      }

      // Dispara e-mail através do cliente de e-mail do Skip Cloud / PocketBase
      try {
        const mailClient = $app.newMailClient()
        mailClient.send(message)
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
        anexos: {
          xml: Boolean(xmlReader),
          pdf: Boolean(pdfReader),
        },
      })
    } catch (err) {
      console.log('[NFSe Email] Exceção geral:', err)
      return e.json(500, {
        success: false,
        message: `Erro interno no envio de e-mail: ${err.message || err}`,
      })
    } finally {
      if (pdfReader && typeof pdfReader.close === 'function') {
        try {
          pdfReader.close()
        } catch (_) {}
      }
      if (xmlReader && typeof xmlReader.close === 'function') {
        try {
          xmlReader.close()
        } catch (_) {}
      }
    }
  },
  $apis.requireAuth(),
)
