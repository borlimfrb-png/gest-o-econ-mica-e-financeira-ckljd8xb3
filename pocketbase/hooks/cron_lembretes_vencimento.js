// Cron job diário às 7h (0 7 * * *) para verificar parcelas com vencimento em 3 dias
// e enviar lembrete de vencimento por e-mail para a empresa (cliente contratante).

cronAdd('enviar_lembretes_vencimento', '0 7 * * *', () => {
  try {
    function formatarDataExtenso(dataStr) {
      if (!dataStr) return ''
      const partes = dataStr.slice(0, 10).split('-')
      if (partes.length !== 3) return dataStr

      const ano = partes[0]
      const mesNum = parseInt(partes[1], 10)
      const dia = parseInt(partes[2], 10)

      const meses = [
        'Janeiro',
        'Fevereiro',
        'Março',
        'Abril',
        'Maio',
        'Junho',
        'Julho',
        'Agosto',
        'Setembro',
        'Outubro',
        'Novembro',
        'Dezembro',
      ]

      const nomeMes = meses[mesNum - 1] || partes[1]
      return `${dia} de ${nomeMes} de ${ano}`
    }

    function formatarValorBrl(val) {
      const num = Number(val) || 0
      return num.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    }

    console.log('[CRON] Iniciando rotina de envio de lembretes de vencimento de parcelas (7h)...')

    // Calcular data alvo exatamente daqui a 3 dias (YYYY-MM-DD)
    const agora = new Date()
    const dataAlvoObj = new Date(agora.getTime() + 3 * 24 * 60 * 60 * 1000)
    const y = dataAlvoObj.getFullYear()
    const m = String(dataAlvoObj.getMonth() + 1).padStart(2, '0')
    const d = String(dataAlvoObj.getDate()).padStart(2, '0')
    const dataAlvoIso = `${y}-${m}-${d}`

    console.log(`[CRON] Buscando parcelas com vencimento em 3 dias (${dataAlvoIso})...`)

    // Buscar parcelas pendentes com lembrete_agendado = true, lembrete_enviado != true
    // e vencimento que comece com a data alvo
    const parcelas = $app.findRecordsByFilter(
      'recebiveis',
      `status = 'Pendente' && lembrete_agendado = true && (lembrete_enviado = false || lembrete_enviado = null) && vencimento ~ '${dataAlvoIso}'`,
      'created',
      500,
      0,
    )

    if (!parcelas || parcelas.length === 0) {
      console.log(`[CRON] Nenhuma parcela com vencimento em ${dataAlvoIso} pendente de lembrete.`)
      return
    }

    console.log(
      `[CRON] ${parcelas.length} parcela(s) encontrada(s) para processamento de lembrete.`,
    )

    for (const parcela of parcelas) {
      try {
        const userId = parcela.getString('user')
        if (!userId) continue

        // Verificar configuração do usuário (notificações ativas)
        const user = $app.findRecordById('users', userId)
        if (!user) continue

        const notificacoesAtivas = user.getBool('receber_alertas_email')
        // Se explicitamente false (toggle desativado nas Configurações), ignora
        if (notificacoesAtivas === false) {
          console.log(
            `[CRON] Usuário ${userId} desativou notificações por e-mail. Pulando parcela ${parcela.id}.`,
          )
          continue
        }

        // Buscar empresa contratante
        const empresaId = parcela.getString('empresa')
        let empresa = null
        try {
          empresa = $app.findRecordById('empresas', empresaId)
        } catch (_) {}

        if (!empresa) {
          console.log(`[CRON] Empresa ${empresaId} não encontrada para parcela ${parcela.id}.`)
          continue
        }

        // Buscar dados da Contratada (Minha Empresa) do usuário
        let minhaEmpresa = null
        try {
          minhaEmpresa = $app.findFirstRecordByData('minha_empresa', 'user', userId)
        } catch (_) {}

        const nomeContratada = minhaEmpresa
          ? minhaEmpresa.getString('nome_fantasia') ||
            minhaEmpresa.getString('razao_social') ||
            'Assessoria Financeira'
          : 'Assessoria Financeira'

        const nomeContratante =
          empresa.getString('nome_fantasia') || empresa.getString('nome') || 'Cliente'

        // E-mail do destinatário: e-mail da empresa contratante (ou e-mail comercial/financeiro) ou fallback
        const emailDestino =
          empresa.getString('email') ||
          empresa.getString('contato_principal') ||
          user.getString('email')

        if (!emailDestino || !emailDestino.includes('@')) {
          console.log(
            `[CRON] Destinatário sem e-mail válido para parcela ${parcela.id} (empresa: ${empresa.id}).`,
          )
          continue
        }

        const numParcela = parcela.getInt('parcela') || 1
        const vencimentoStr = parcela.getString('vencimento')
        const vencimentoExtenso = formatarDataExtenso(vencimentoStr)
        const valorFormatado = formatarValorBrl(parcela.getFloat('valor'))

        // Dados bancários da contratada
        const banco = minhaEmpresa ? minhaEmpresa.getString('banco') || 'Banco' : 'Banco a informar'
        const agencia = minhaEmpresa ? minhaEmpresa.getString('agencia') || '—' : '—'
        const conta = minhaEmpresa ? minhaEmpresa.getString('conta_corrente') || '—' : '—'
        const chavePix = minhaEmpresa ? minhaEmpresa.getString('chave_pix') || '—' : '—'

        const assunto = `Lembrete de Vencimento - ${nomeContratada}`

        const corpo = `Prezado(a) ${nomeContratante},

Informamos que a parcela ${numParcela} do contrato de consultoria vence em ${vencimentoExtenso}, no valor de R$ ${valorFormatado}.

Dados para pagamento:
${banco} - Agência ${agencia} - Conta ${conta}
PIX: ${chavePix}

Atenciosamente,
${nomeContratada}`

        // Disparo do e-mail
        const message = new MailerMessage({
          from: {
            address: $app.settings().meta.senderAddress || 'noreply@gestao.local',
            name: nomeContratada,
          },
          to: [{ address: emailDestino, name: nomeContratante }],
          subject: assunto,
          text: corpo,
        })

        $app.newMailClient().send(message)
        console.log(
          `[CRON] Lembrete enviado com sucesso para ${emailDestino} (Parcela ${numParcela} - R$ ${valorFormatado}).`,
        )

        // Marcar parcela como lembrete_enviado = true
        parcela.set('lembrete_enviado', true)
        $app.save(parcela)
      } catch (errParc) {
        console.error(`[CRON] Erro ao processar lembrete da parcela ${parcela.id}:`, errParc)
      }
    }

    console.log('[CRON] Rotina de envio de lembretes finalizada.')
  } catch (err) {
    console.error('[CRON] Erro geral na rotina de lembretes de vencimento:', err)
  }
})
