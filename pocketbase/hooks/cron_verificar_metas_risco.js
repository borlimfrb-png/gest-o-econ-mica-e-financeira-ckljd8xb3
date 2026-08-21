// Cron job diário às 8h da manhã (0 8 * * *) e endpoint para verificação de metas em risco e envio de e-mails
cronAdd('verificar_metas_em_risco_diario', '0 8 * * *', () => {
  const agora = new Date()
  const anoAtual = agora.getFullYear()
  const mesAtual = agora.getMonth() + 1 // 1-12
  const diaAtual = agora.getDate()
  const dataHojeStr = agora.toISOString().slice(0, 10)

  const totalDiasNoMes = new Date(anoAtual, agora.getMonth() + 1, 0).getDate()
  const diasRestantesMes = totalDiasNoMes - diaAtual

  // Trimestre atual
  const trimAtualNum = Math.floor((mesAtual - 1) / 3) + 1
  const trimAtualStr = 'Q' + trimAtualNum
  const mesesDoTrimestre = [
    (trimAtualNum - 1) * 3 + 1,
    (trimAtualNum - 1) * 3 + 2,
    (trimAtualNum - 1) * 3 + 3,
  ]
  const ultimoMesTrimestre = mesesDoTrimestre[2]
  const ultimoDiaTrimestre = new Date(anoAtual, ultimoMesTrimestre, 0).getDate()
  const fimTrimestreDate = new Date(anoAtual, ultimoMesTrimestre - 1, ultimoDiaTrimestre)
  const diffTimeTrimestre = fimTrimestreDate.getTime() - agora.getTime()
  const diasRestantesTrimestre = Math.max(0, Math.ceil(diffTimeTrimestre / (1000 * 60 * 60 * 24)))

  let metas = []
  try {
    metas = $app.findRecordsByFilter('metas_lancamentos', 'ativo = true', '-created', 0, 0)
  } catch (err) {
    console.log('[cron:metas] Erro ao buscar metas:', err)
    return
  }

  for (const meta of metas) {
    try {
      const metaId = meta.id
      const userId = meta.getString('user')
      if (!userId) continue

      // Verificar se o usuário quer receber alertas por e-mail (padrão true se não for false)
      let userRecord = null
      try {
        userRecord = $app.findRecordById('_pb_users_auth_', userId)
      } catch (_) {
        continue
      }

      if (!userRecord) continue
      const userEmail = userRecord.getString('email')
      if (!userEmail) continue

      // Se o campo receber_alertas_email estiver explicitamente falso, não enviar
      const receberEmail = userRecord.get('receber_alertas_email')
      if (receberEmail === false) {
        continue
      }

      const periodo = meta.getString('periodo') || 'Mensal'
      const metaAno = meta.getInt('ano')
      const metaMes = meta.getInt('mes')
      const metaTrim = meta.getString('trimestre')
      const metaTipo = meta.getString('tipo')
      const metaValor = meta.getFloat('valor')
      const empresaId = meta.getString('empresa')
      const centroId = meta.getString('centro')

      if (metaAno !== anoAtual) continue

      let isAlerta = false
      let tipoAlerta = ''
      let atingimentoPct = 0
      let diasRestantes = 0
      let realizado = 0
      let nomePeriodo = ''

      if (periodo === 'Trimestral') {
        if (metaTrim !== trimAtualStr) continue
        nomePeriodo = metaTrim + '/' + metaAno
        diasRestantes = diasRestantesTrimestre

        // Buscar lançamentos dos 3 meses do trimestre
        let lancs = []
        try {
          lancs = $app.findRecordsByFilter('lancamentos', 'empresa = {:emp}', '-data', 0, 0, {
            emp: empresaId,
          })
        } catch (_) {}

        for (const l of lancs) {
          const dt = l.getString('data')
          if (!dt) continue
          const anoL = parseInt(dt.slice(0, 4), 10)
          const mesL = parseInt(dt.slice(5, 7), 10)
          if (anoL !== anoAtual || mesesDoTrimestre.indexOf(mesL) === -1) continue

          const planoId = l.getString('plano_conta')
          if (!planoId) continue
          let plano = null
          try {
            plano = $app.findRecordById('plano_contas', planoId)
          } catch (_) {}
          if (!plano) continue

          if (centroId) {
            const cPlano = plano.getString('centro')
            if (cPlano !== centroId) continue
          }

          const contaId = plano.getString('conta')
          if (!contaId) continue
          let conta = null
          try {
            conta = $app.findRecordById('contas', contaId)
          } catch (_) {}
          if (!conta || conta.getString('tipo') !== metaTipo) continue

          realizado += l.getFloat('valor')
        }

        atingimentoPct = metaValor > 0 ? (realizado / metaValor) * 100 : 0

        // Regra Trimestral: menos de 50% e faltando menos de 15 dias para o fim do trimestre
        if (atingimentoPct < 50 && diasRestantes <= 15) {
          isAlerta = true
          tipoAlerta = 'RISCO_TRIMESTRAL_MENOS_50'
        }
      } else {
        // Período Mensal
        if (metaMes !== mesAtual) continue
        const nomesMeses = [
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
        nomePeriodo = (nomesMeses[metaMes - 1] || 'Mês ' + metaMes) + '/' + metaAno
        diasRestantes = diasRestantesMes

        let lancs = []
        try {
          lancs = $app.findRecordsByFilter('lancamentos', 'empresa = {:emp}', '-data', 0, 0, {
            emp: empresaId,
          })
        } catch (_) {}

        for (const l of lancs) {
          const dt = l.getString('data')
          if (!dt) continue
          const anoL = parseInt(dt.slice(0, 4), 10)
          const mesL = parseInt(dt.slice(5, 7), 10)
          if (anoL !== anoAtual || mesL !== mesAtual) continue

          const planoId = l.getString('plano_conta')
          if (!planoId) continue
          let plano = null
          try {
            plano = $app.findRecordById('plano_contas', planoId)
          } catch (_) {}
          if (!plano) continue

          if (centroId) {
            const cPlano = plano.getString('centro')
            if (cPlano !== centroId) continue
          }

          const contaId = plano.getString('conta')
          if (!contaId) continue
          let conta = null
          try {
            conta = $app.findRecordById('contas', contaId)
          } catch (_) {}
          if (!conta || conta.getString('tipo') !== metaTipo) continue

          realizado += l.getFloat('valor')
        }

        atingimentoPct = metaValor > 0 ? (realizado / metaValor) * 100 : 0
        const temLancamentos = realizado > 0

        // Regra 1: menos de 50% faltando 5 dias ou menos
        if (atingimentoPct < 50 && diasRestantes <= 5) {
          isAlerta = true
          tipoAlerta = 'RISCO_MENOS_50_5_DIAS'
        } else if (!temLancamentos && diaAtual > 15) {
          // Regra 2: 0% com mais de 15 dias passados
          isAlerta = true
          tipoAlerta = 'ZERO_COM_15_DIAS_PASSADOS'
        }
      }

      if (!isAlerta) continue

      // Verificar se já enviamos alerta para essa meta hoje
      let alertaExistente = null
      try {
        alertaExistente = $app.findFirstRecordByData('alertas_enviados', 'meta', metaId)
      } catch (_) {}

      if (alertaExistente) {
        // Verificar se a data_envio é hoje
        const dataEnvio = alertaExistente.getString('data_envio')
        if (dataEnvio === dataHojeStr) {
          // Já enviado hoje, pular para evitar duplicata
          continue
        }
      }

      // Buscar nome da empresa
      let empresaNome = 'Empresa'
      try {
        const empRec = $app.findRecordById('empresas', empresaId)
        if (empRec) empresaNome = empRec.getString('nome')
      } catch (_) {}

      // Buscar nome do centro se houver
      let centroNome = ''
      if (centroId) {
        try {
          const cRec = $app.findRecordById('centros', centroId)
          if (cRec) {
            const cod = cRec.getString('codigo')
            centroNome = cod ? cod + ' - ' + cRec.getString('nome') : cRec.getString('nome')
          }
        } catch (_) {}
      }

      const nomeMetaCompleto = 'Meta de ' + metaTipo + (centroNome ? ' (' + centroNome + ')' : '')

      // Formatar valores para o e-mail
      const valorMetaFormatado =
        'R$ ' +
        metaValor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      const realizadoFormatado =
        'R$ ' +
        realizado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      const pctFormatado = atingimentoPct.toFixed(1) + '%'

      let motivoTexto = ''
      if (tipoAlerta === 'ZERO_COM_15_DIAS_PASSADOS') {
        motivoTexto =
          'Nenhum lançamento foi registrado para esta meta e já se passaram ' +
          diaAtual +
          ' dias do mês corrente.'
      } else if (tipoAlerta === 'RISCO_MENOS_50_5_DIAS') {
        motivoTexto =
          'O atingimento está em apenas ' +
          pctFormatado +
          ' e restam apenas ' +
          diasRestantes +
          ' dia(s) para o fechamento do mês.'
      } else if (tipoAlerta === 'RISCO_TRIMESTRAL_MENOS_50') {
        motivoTexto =
          'O atingimento trimestral está em apenas ' +
          pctFormatado +
          ' e restam menos de ' +
          diasRestantes +
          ' dia(s) para o término do trimestre.'
      }

      // Montar HTML do e-mail
      const htmlBody = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; padding: 24px; margin: 0; }
            .card { background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; max-width: 580px; margin: 0 auto; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
            .header { background-color: #0B1F3A; padding: 20px 24px; color: #ffffff; }
            .header h1 { font-size: 18px; margin: 0; font-weight: 700; }
            .header p { font-size: 12px; color: #94a3b8; margin: 4px 0 0 0; }
            .content { padding: 24px; }
            .alert-banner { background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 14px 16px; margin-bottom: 20px; }
            .alert-title { color: #991b1b; font-weight: 700; font-size: 14px; margin: 0 0 4px 0; }
            .alert-desc { color: #b91c1c; font-size: 12px; margin: 0; }
            .table-info { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px; }
            .table-info td { padding: 8px 12px; border-bottom: 1px solid #f1f5f9; }
            .table-info td.label { font-weight: 600; color: #64748b; width: 40%; }
            .table-info td.value { font-weight: 700; color: #0f172a; }
            .badge { display: inline-block; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; }
            .badge-red { background-color: #fee2e2; color: #991b1b; }
            .footer { background-color: #f8fafc; padding: 16px 24px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #64748b; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="header">
              <h1>Alerta de Meta - Analise de Balanço</h1>
              <p>Notificação automática de monitoramento financeiro</p>
            </div>
            <div class="content">
              <div class="alert-banner">
                <div class="alert-title">⚠️ Meta em Risco de Não Atingimento</div>
                <div class="alert-desc">${motivoTexto}</div>
              </div>
              <table class="table-info">
                <tr>
                  <td class="label">Meta</td>
                  <td class="value">${nomeMetaCompleto}</td>
                </tr>
                <tr>
                  <td class="label">Empresa</td>
                  <td class="value">${empresaNome}</td>
                </tr>
                <tr>
                  <td class="label">Período de Referência</td>
                  <td class="value">${nomePeriodo} (${periodo})</td>
                </tr>
                <tr>
                  <td class="label">Valor Estipulado</td>
                  <td class="value">${valorMetaFormatado}</td>
                </tr>
                <tr>
                  <td class="label">Realizado até o momento</td>
                  <td class="value">${realizadoFormatado}</td>
                </tr>
                <tr>
                  <td class="label">% de Atingimento</td>
                  <td class="value"><span class="badge badge-red">${pctFormatado}</span></td>
                </tr>
                <tr>
                  <td class="label">Dias Restantes</td>
                  <td class="value">${diasRestantes} dia(s)</td>
                </tr>
              </table>
              <p style="font-size: 12px; color: #64748b; line-height: 1.5; margin: 0;">
                Acesse o painel do <strong>Analise de Balanço</strong> para registrar novos lançamentos ou revisar o planejamento orçamentário.
              </p>
            </div>
            <div class="footer">
              Este é um e-mail automático gerado pelo sistema de Consultoria Financeira Analise de Balanço.
            </div>
          </div>
        </body>
        </html>
      `

      // Enviar e-mail via mailClient do PocketBase
      const mailClient = $app.newMailClient()
      mailClient.send({
        from: {
          address: 'sistema@analisedebalanco.com.br',
          name: 'Analise de Balanço',
        },
        to: [{ address: userEmail, name: userRecord.getString('name') || 'Usuário' }],
        subject: 'Alerta de Meta - Analise de Balanço',
        html: htmlBody,
      })

      // Gravar registro na collection alertas_enviados
      const alertasCol = $app.findCollectionByNameOrId('alertas_enviados')
      const alertaRecord = new Record(alertasCol)
      alertaRecord.set('meta', metaId)
      alertaRecord.set('user', userId)
      alertaRecord.set('tipo_alerta', tipoAlerta)
      alertaRecord.set('data_envio', dataHojeStr)
      alertaRecord.set('atingimento_pct', atingimentoPct)
      alertaRecord.set('dias_restantes', diasRestantes)
      $app.save(alertaRecord)

      console.log(
        '[cron:metas] Alerta enviado para',
        userEmail,
        'meta:',
        metaId,
        'tipo:',
        tipoAlerta,
      )
    } catch (errInner) {
      console.log('[cron:metas] Erro ao processar meta individual:', errInner)
    }
  }
})

// Endpoint manual opcional para acionar a verificação sob demanda autenticado ou para testes
routerAdd('POST', '/api/metas/verificar-alertas', (e) => {
  const agora = new Date()
  const anoAtual = agora.getFullYear()
  const mesAtual = agora.getMonth() + 1 // 1-12
  const diaAtual = agora.getDate()
  const dataHojeStr = agora.toISOString().slice(0, 10)

  const totalDiasNoMes = new Date(anoAtual, agora.getMonth() + 1, 0).getDate()
  const diasRestantesMes = totalDiasNoMes - diaAtual

  const trimAtualNum = Math.floor((mesAtual - 1) / 3) + 1
  const trimAtualStr = 'Q' + trimAtualNum
  const mesesDoTrimestre = [
    (trimAtualNum - 1) * 3 + 1,
    (trimAtualNum - 1) * 3 + 2,
    (trimAtualNum - 1) * 3 + 3,
  ]
  const ultimoMesTrimestre = mesesDoTrimestre[2]
  const ultimoDiaTrimestre = new Date(anoAtual, ultimoMesTrimestre, 0).getDate()
  const fimTrimestreDate = new Date(anoAtual, ultimoMesTrimestre - 1, ultimoDiaTrimestre)
  const diffTimeTrimestre = fimTrimestreDate.getTime() - agora.getTime()
  const diasRestantesTrimestre = Math.max(0, Math.ceil(diffTimeTrimestre / (1000 * 60 * 60 * 24)))

  let countEnviados = 0

  let metas = []
  try {
    metas = $app.findRecordsByFilter('metas_lancamentos', 'ativo = true', '-created', 0, 0)
  } catch (err) {
    return e.json(500, { error: 'Erro ao buscar metas' })
  }

  for (const meta of metas) {
    try {
      const metaId = meta.id
      const userId = meta.getString('user')
      if (!userId) continue

      let userRecord = null
      try {
        userRecord = $app.findRecordById('_pb_users_auth_', userId)
      } catch (_) {
        continue
      }
      if (!userRecord) continue

      const userEmail = userRecord.getString('email')
      if (!userEmail) continue

      const receberEmail = userRecord.get('receber_alertas_email')
      if (receberEmail === false) {
        continue
      }

      const periodo = meta.getString('periodo') || 'Mensal'
      const metaAno = meta.getInt('ano')
      const metaMes = meta.getInt('mes')
      const metaTrim = meta.getString('trimestre')
      const metaTipo = meta.getString('tipo')
      const metaValor = meta.getFloat('valor')
      const empresaId = meta.getString('empresa')
      const centroId = meta.getString('centro')

      if (metaAno !== anoAtual) continue

      let isAlerta = false
      let tipoAlerta = ''
      let atingimentoPct = 0
      let diasRestantes = 0
      let realizado = 0
      let nomePeriodo = ''

      if (periodo === 'Trimestral') {
        if (metaTrim !== trimAtualStr) continue
        nomePeriodo = metaTrim + '/' + metaAno
        diasRestantes = diasRestantesTrimestre

        let lancs = []
        try {
          lancs = $app.findRecordsByFilter('lancamentos', 'empresa = {:emp}', '-data', 0, 0, {
            emp: empresaId,
          })
        } catch (_) {}

        for (const l of lancs) {
          const dt = l.getString('data')
          if (!dt) continue
          const anoL = parseInt(dt.slice(0, 4), 10)
          const mesL = parseInt(dt.slice(5, 7), 10)
          if (anoL !== anoAtual || mesesDoTrimestre.indexOf(mesL) === -1) continue

          const planoId = l.getString('plano_conta')
          if (!planoId) continue
          let plano = null
          try {
            plano = $app.findRecordById('plano_contas', planoId)
          } catch (_) {}
          if (!plano) continue

          if (centroId) {
            const cPlano = plano.getString('centro')
            if (cPlano !== centroId) continue
          }

          const contaId = plano.getString('conta')
          if (!contaId) continue
          let conta = null
          try {
            conta = $app.findRecordById('contas', contaId)
          } catch (_) {}
          if (!conta || conta.getString('tipo') !== metaTipo) continue

          realizado += l.getFloat('valor')
        }

        atingimentoPct = metaValor > 0 ? (realizado / metaValor) * 100 : 0
        if (atingimentoPct < 50 && diasRestantes <= 15) {
          isAlerta = true
          tipoAlerta = 'RISCO_TRIMESTRAL_MENOS_50'
        }
      } else {
        if (metaMes !== mesAtual) continue
        const nomesMeses = [
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
        nomePeriodo = (nomesMeses[metaMes - 1] || 'Mês ' + metaMes) + '/' + metaAno
        diasRestantes = diasRestantesMes

        let lancs = []
        try {
          lancs = $app.findRecordsByFilter('lancamentos', 'empresa = {:emp}', '-data', 0, 0, {
            emp: empresaId,
          })
        } catch (_) {}

        for (const l of lancs) {
          const dt = l.getString('data')
          if (!dt) continue
          const anoL = parseInt(dt.slice(0, 4), 10)
          const mesL = parseInt(dt.slice(5, 7), 10)
          if (anoL !== anoAtual || mesL !== mesAtual) continue

          const planoId = l.getString('plano_conta')
          if (!planoId) continue
          let plano = null
          try {
            plano = $app.findRecordById('plano_contas', planoId)
          } catch (_) {}
          if (!plano) continue

          if (centroId) {
            const cPlano = plano.getString('centro')
            if (cPlano !== centroId) continue
          }

          const contaId = plano.getString('conta')
          if (!contaId) continue
          let conta = null
          try {
            conta = $app.findRecordById('contas', contaId)
          } catch (_) {}
          if (!conta || conta.getString('tipo') !== metaTipo) continue

          realizado += l.getFloat('valor')
        }

        atingimentoPct = metaValor > 0 ? (realizado / metaValor) * 100 : 0
        const temLancamentos = realizado > 0

        if (atingimentoPct < 50 && diasRestantes <= 5) {
          isAlerta = true
          tipoAlerta = 'RISCO_MENOS_50_5_DIAS'
        } else if (!temLancamentos && diaAtual > 15) {
          isAlerta = true
          tipoAlerta = 'ZERO_COM_15_DIAS_PASSADOS'
        }
      }

      if (!isAlerta) continue

      // Checar duplicidade no mesmo dia
      let alertaExistente = null
      try {
        const registros = $app.findRecordsByFilter(
          'alertas_enviados',
          'meta = {:meta} && data_envio = {:data}',
          '-created',
          1,
          0,
          { meta: metaId, data: dataHojeStr },
        )
        if (registros.length > 0) alertaExistente = registros[0]
      } catch (_) {}

      if (alertaExistente) {
        continue
      }

      let empresaNome = 'Empresa'
      try {
        const empRec = $app.findRecordById('empresas', empresaId)
        if (empRec) empresaNome = empRec.getString('nome')
      } catch (_) {}

      let centroNome = ''
      if (centroId) {
        try {
          const cRec = $app.findRecordById('centros', centroId)
          if (cRec) {
            const cod = cRec.getString('codigo')
            centroNome = cod ? cod + ' - ' + cRec.getString('nome') : cRec.getString('nome')
          }
        } catch (_) {}
      }

      const nomeMetaCompleto = 'Meta de ' + metaTipo + (centroNome ? ' (' + centroNome + ')' : '')
      const valorMetaFormatado =
        'R$ ' +
        metaValor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      const realizadoFormatado =
        'R$ ' +
        realizado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      const pctFormatado = atingimentoPct.toFixed(1) + '%'

      let motivoTexto = ''
      if (tipoAlerta === 'ZERO_COM_15_DIAS_PASSADOS') {
        motivoTexto =
          'Nenhum lançamento foi registrado para esta meta e já se passaram ' +
          diaAtual +
          ' dias do mês corrente.'
      } else if (tipoAlerta === 'RISCO_MENOS_50_5_DIAS') {
        motivoTexto =
          'O atingimento está em apenas ' +
          pctFormatado +
          ' e restam apenas ' +
          diasRestantes +
          ' dia(s) para o fechamento do mês.'
      } else if (tipoAlerta === 'RISCO_TRIMESTRAL_MENOS_50') {
        motivoTexto =
          'O atingimento trimestral está em apenas ' +
          pctFormatado +
          ' e restam menos de ' +
          diasRestantes +
          ' dia(s) para o término do trimestre.'
      }

      const htmlBody = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; padding: 24px; margin: 0; }
            .card { background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; max-width: 580px; margin: 0 auto; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
            .header { background-color: #0B1F3A; padding: 20px 24px; color: #ffffff; }
            .header h1 { font-size: 18px; margin: 0; font-weight: 700; }
            .header p { font-size: 12px; color: #94a3b8; margin: 4px 0 0 0; }
            .content { padding: 24px; }
            .alert-banner { background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 14px 16px; margin-bottom: 20px; }
            .alert-title { color: #991b1b; font-weight: 700; font-size: 14px; margin: 0 0 4px 0; }
            .alert-desc { color: #b91c1c; font-size: 12px; margin: 0; }
            .table-info { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px; }
            .table-info td { padding: 8px 12px; border-bottom: 1px solid #f1f5f9; }
            .table-info td.label { font-weight: 600; color: #64748b; width: 40%; }
            .table-info td.value { font-weight: 700; color: #0f172a; }
            .badge { display: inline-block; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; }
            .badge-red { background-color: #fee2e2; color: #991b1b; }
            .footer { background-color: #f8fafc; padding: 16px 24px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #64748b; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="header">
              <h1>Alerta de Meta - Analise de Balanço</h1>
              <p>Notificação automática de monitoramento financeiro</p>
            </div>
            <div class="content">
              <div class="alert-banner">
                <div class="alert-title">⚠️ Meta em Risco de Não Atingimento</div>
                <div class="alert-desc">${motivoTexto}</div>
              </div>
              <table class="table-info">
                <tr>
                  <td class="label">Meta</td>
                  <td class="value">${nomeMetaCompleto}</td>
                </tr>
                <tr>
                  <td class="label">Empresa</td>
                  <td class="value">${empresaNome}</td>
                </tr>
                <tr>
                  <td class="label">Período de Referência</td>
                  <td class="value">${nomePeriodo} (${periodo})</td>
                </tr>
                <tr>
                  <td class="label">Valor Estipulado</td>
                  <td class="value">${valorMetaFormatado}</td>
                </tr>
                <tr>
                  <td class="label">Realizado até o momento</td>
                  <td class="value">${realizadoFormatado}</td>
                </tr>
                <tr>
                  <td class="label">% de Atingimento</td>
                  <td class="value"><span class="badge badge-red">${pctFormatado}</span></td>
                </tr>
                <tr>
                  <td class="label">Dias Restantes</td>
                  <td class="value">${diasRestantes} dia(s)</td>
                </tr>
              </table>
              <p style="font-size: 12px; color: #64748b; line-height: 1.5; margin: 0;">
                Acesse o painel do <strong>Analise de Balanço</strong> para registrar novos lançamentos ou revisar o planejamento orçamentário.
              </p>
            </div>
            <div class="footer">
              Este é um e-mail automático gerado pelo sistema de Consultoria Financeira Analise de Balanço.
            </div>
          </div>
        </body>
        </html>
      `

      const mailClient = $app.newMailClient()
      mailClient.send({
        from: {
          address: 'sistema@analisedebalanco.com.br',
          name: 'Analise de Balanço',
        },
        to: [{ address: userEmail, name: userRecord.getString('name') || 'Usuário' }],
        subject: 'Alerta de Meta - Analise de Balanço',
        html: htmlBody,
      })

      const alertasCol = $app.findCollectionByNameOrId('alertas_enviados')
      const alertaRecord = new Record(alertasCol)
      alertaRecord.set('meta', metaId)
      alertaRecord.set('user', userId)
      alertaRecord.set('tipo_alerta', tipoAlerta)
      alertaRecord.set('data_envio', dataHojeStr)
      alertaRecord.set('atingimento_pct', atingimentoPct)
      alertaRecord.set('dias_restantes', diasRestantes)
      $app.save(alertaRecord)

      countEnviados++
    } catch (errInner) {
      console.log('[router:metas] Erro ao processar:', errInner)
    }
  }

  return e.json(200, { success: true, alertas_enviados: countEnviados })
})
