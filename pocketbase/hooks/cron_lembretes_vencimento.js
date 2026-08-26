/**
 * Cron Job Diário de Lembretes de Vencimento de Recebíveis
 * Executa todos os dias às 08:00 (America/Sao_Paulo / UTC 11:00)
 *
 * Envia e-mail de lembrete para clientes que possuem títulos a vencer em 3 dias
 * com lembrete_agendado = true e lembrete_enviado = false, caso o usuário tenha
 * a preferência global notificacoes_vencimento ativa (padrão true).
 */

cronAdd('lembretes_vencimento_diario', '0 8 * * *', () => {
  try {
    const hoje = new Date()
    // Data alvo: exatamente 3 dias à frente
    const dataAlvo = new Date(hoje.getTime() + 3 * 24 * 60 * 60 * 1000)
    const targetDateStr = dataAlvo.toISOString().slice(0, 10)

    console.log(`[Cron Lembretes] Buscando recebíveis com vencimento em ${targetDateStr}...`)

    // Busca recebíveis pendentes, agendados e com vencimento na data alvo
    const filter = `status = 'Pendente' && lembrete_agendado = true && lembrete_enviado = false && vencimento >= '${targetDateStr} 00:00:00' && vencimento <= '${targetDateStr} 23:59:59'`
    const recebiveis = $app.findRecordsByFilter('recebiveis', filter, '-created', 100)

    if (!recebiveis || recebiveis.length === 0) {
      console.log(
        '[Cron Lembretes] Nenhum recebível pendente elegível encontrado para a data alvo.',
      )
      return
    }

    console.log(
      `[Cron Lembretes] ${recebiveis.length} recebível(eis) encontrado(s) para processamento.`,
    )

    for (const r of recebiveis) {
      try {
        const userId = r.get('user')
        if (!userId) continue

        // 1. Verifica se o usuário tem a flag notificacoes_vencimento desativada (em users ou minha_empresa)
        let notificacoesAtivas = true

        try {
          // Checa em minha_empresa
          const empresaConfigs = $app.findRecordsByFilter(
            'minha_empresa',
            `user = '${userId}'`,
            '-created',
            1,
          )
          if (empresaConfigs && empresaConfigs.length > 0) {
            const empRec = empresaConfigs[0]
            const notifVal = empRec.get('notificacoes_vencimento')
            // Se foi explicitamente desligado (false)
            if (notifVal === false) {
              notificacoesAtivas = false
            }
          }
        } catch (_) {}

        try {
          // Checa em users
          const userRec = $app.findRecordById('users', userId)
          if (userRec) {
            const userNotif = userRec.get('notificacoes_vencimento')
            if (userNotif === false) {
              notificacoesAtivas = false
            }
          }
        } catch (_) {}

        if (!notificacoesAtivas) {
          console.log(
            `[Cron Lembretes] Notificações desativadas globalmente pelo usuário ${userId}. Pulando recebível ${r.id}.`,
          )
          continue
        }

        // 2. Busca dados da empresa cliente (destinatário)
        const empresaId = r.get('empresa')
        if (!empresaId) continue

        let empresaRec = null
        try {
          empresaRec = $app.findRecordById('empresas', empresaId)
        } catch (_) {}

        if (!empresaRec) continue

        const emailDestino = empresaRec.get('email') || empresaRec.get('contato_email')
        const nomeEmpresa = empresaRec.get('nome') || empresaRec.get('razao_social') || 'Cliente'

        if (!emailDestino) {
          console.log(
            `[Cron Lembretes] Empresa ${nomeEmpresa} (ID: ${empresaId}) não possui e-mail cadastrado.`,
          )
          continue
        }

        // 3. Busca dados bancários da Minha Empresa (consultoria/emissor)
        let dadosBancarios = ''
        let pixChave = ''
        let nomeConsultoria = 'Nossa Consultoria'
        try {
          const minhaEmpresaList = $app.findRecordsByFilter(
            'minha_empresa',
            `user = '${userId}'`,
            '-created',
            1,
          )
          if (minhaEmpresaList && minhaEmpresaList.length > 0) {
            const m = minhaEmpresaList[0]
            nomeConsultoria = m.get('razao_social') || m.get('nome_fantasia') || nomeConsultoria
            pixChave = m.get('chave_pix') || ''
            const banco = m.get('banco') || ''
            const agencia = m.get('agencia') || ''
            const conta = m.get('conta_corrente') || ''
            if (banco || pixChave) {
              dadosBancarios = `
                <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0;">
                  <h4 style="margin: 0 0 10px 0; color: #0f172a; font-size: 14px;">Dados para Pagamento:</h4>
                  ${pixChave ? `<p style="margin: 4px 0; color: #334155; font-size: 13px;"><strong>Chave PIX:</strong> <code style="background: #e2e8f0; padding: 2px 6px; border-radius: 4px;">${pixChave}</code></p>` : ''}
                  ${banco ? `<p style="margin: 4px 0; color: #334155; font-size: 13px;"><strong>Banco:</strong> ${banco} | <strong>Agência:</strong> ${agencia} | <strong>Conta:</strong> ${conta}</p>` : ''}
                </div>
              `
            }
          }
        } catch (_) {}

        const valor = Number(r.get('valor')) || 0
        const valorFormatado = new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'BRL',
        }).format(valor)
        const parcela = r.get('parcela') || 1
        const partesData = targetDateStr.split('-')
        const dataFormatada =
          partesData.length === 3
            ? `${partesData[2]}/${partesData[1]}/${partesData[0]}`
            : targetDateStr

        // 4. Monta e envia e-mail
        const subject = `Lembrete de Vencimento · Parcela ${parcela} · ${nomeConsultoria}`
        const htmlBody = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; line-height: 1.6;">
            <div style="background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%); padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
              <h2 style="color: #ffffff; margin: 0; font-size: 20px;">Lembrete de Vencimento de Parcela</h2>
              <p style="color: #93c5fd; margin: 6px 0 0 0; font-size: 13px;">${nomeConsultoria}</p>
            </div>
            
            <div style="background-color: #ffffff; padding: 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
              <p style="font-size: 14px;">Olá, <strong>${nomeEmpresa}</strong>,</p>
              
              <p style="font-size: 14px; color: #475569;">
                Este é um lembrete automático de que a parcela descrita abaixo vencerá em <strong>3 dias</strong>:
              </p>
              
              <div style="background-color: #f1f5f9; border-left: 4px solid #2563eb; padding: 14px 16px; border-radius: 6px; margin: 16px 0;">
                <p style="margin: 4px 0; font-size: 13px;"><strong>Nº da Parcela:</strong> Parcela ${parcela}</p>
                <p style="margin: 4px 0; font-size: 13px;"><strong>Data de Vencimento:</strong> <span style="color: #b91c1c; font-weight: bold;">${dataFormatada}</span></p>
                <p style="margin: 4px 0; font-size: 13px;"><strong>Valor:</strong> <span style="font-size: 16px; font-weight: bold; color: #047857;">${valorFormatado}</span></p>
              </div>

              ${dadosBancarios}

              <p style="font-size: 12px; color: #64748b; margin-top: 24px; border-top: 1px solid #e2e8f0; pt: 16px;">
                Caso o pagamento já tenha sido efetuado ou agendado, por favor desconsidere esta mensagem.
              </p>
            </div>
          </div>
        `

        $app.newMailClient().send({
          from: {
            address: $app.settings().meta.senderAddress || 'no-reply@gestao.app',
            name: nomeConsultoria,
          },
          to: [{ address: emailDestino, name: nomeEmpresa }],
          subject: subject,
          html: htmlBody,
        })

        // 5. Marca lembrete_enviado = true
        r.set('lembrete_enviado', true)
        $app.save(r)

        console.log(
          `[Cron Lembretes] E-mail enviado com sucesso para ${emailDestino} (Recebível ${r.id}).`,
        )
      } catch (errInner) {
        console.log(`[Cron Lembretes] Erro ao processar recebível ${r.id}:`, errInner)
      }
    }
  } catch (err) {
    console.log('[Cron Lembretes] Erro geral no cron:', err)
  }
})
