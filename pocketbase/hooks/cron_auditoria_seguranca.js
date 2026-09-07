// Hook de Auditoria de Segurança: Cron Mensal (0 6 1 * *) e Rota POST /api/admin/auditoria-seguranca/verificar
// Verifica e compara as regras RLS das coleções do sistema com o baseline de segurança,
// gravando o histórico em 'auditoria_seguranca' e alertando administradores por e-mail em caso de divergência.

cronAdd('auditoria_seguranca_mensal', '0 6 1 * *', () => {
  const agora = new Date()
  const dataHojeStr = agora.toISOString().slice(0, 10)

  // Baseline das regras de segurança
  const baseline = {
    bloqueadas: [
      'balancos',
      'dre',
      'produtos',
      'materias_primas',
      'fichas_tecnicas',
      'configuracoes_tributarias',
      'benchmarks_empresas',
      'simulador_cenarios',
      'memoria_fornecedores_despesas',
      'bsc_kpis',
      'bsc_iniciativas',
      'bsc_iniciativas_historico',
    ],
    financeiro: [
      'lancamentos',
      'lancamentos_recorrentes',
      'metas_lancamentos',
      'centros',
      'tipos_despesa',
      'contas',
      'plano_contas',
      'lancamentos_centro',
    ],
    comercial_empresa: ['recebiveis', 'notas_fiscais', 'nfse_tomadores'],
  }

  let totalColecoes = 0
  let totalConformes = 0
  let totalDivergencias = 0
  const detalhes = []

  // 1. Verificar coleções bloqueadas para financeiro e comercial (apenas admin e empresa)
  for (let i = 0; i < baseline.bloqueadas.length; i++) {
    const colName = baseline.bloqueadas[i]
    totalColecoes++
    try {
      const col = $app.findCollectionByNameOrId(colName)
      const listRule = col.listRule || ''
      const viewRule = col.viewRule || ''
      const createRule = col.createRule || ''
      const updateRule = col.updateRule || ''
      const deleteRule = col.deleteRule || ''

      const listOk =
        listRule.indexOf("@request.auth.role = 'admin'") !== -1 &&
        listRule.indexOf("@request.auth.role = 'empresa'") !== -1 &&
        listRule.indexOf('empresa = @request.auth.empresa') !== -1 &&
        listRule.indexOf('financeiro') === -1 &&
        listRule.indexOf('comercial') === -1

      const createOk =
        createRule.indexOf("@request.auth.role = 'admin'") !== -1 &&
        createRule.indexOf("@request.auth.role = 'empresa'") !== -1 &&
        createRule.indexOf('@request.body.empresa = @request.auth.empresa') !== -1 &&
        createRule.indexOf('financeiro') === -1 &&
        createRule.indexOf('comercial') === -1

      const updateOk =
        updateRule.indexOf("@request.auth.role = 'admin'") !== -1 &&
        updateRule.indexOf("@request.auth.role = 'empresa'") !== -1 &&
        updateRule.indexOf('financeiro') === -1

      const deleteOk =
        deleteRule.indexOf("@request.auth.role = 'admin'") !== -1 &&
        deleteRule.indexOf("@request.auth.role = 'empresa'") !== -1 &&
        deleteRule.indexOf('financeiro') === -1

      const conforme = listOk && createOk && updateOk && deleteOk
      if (conforme) {
        totalConformes++
      } else {
        totalDivergencias++
      }

      detalhes.push({
        colecao: colName,
        categoria: 'Bloqueada p/ Financeiro e Comercial',
        conforme: conforme,
        regrasAtuais: {
          list: listRule,
          view: viewRule,
          create: createRule,
          update: updateRule,
          delete: deleteRule,
        },
      })
    } catch (err) {
      totalDivergencias++
      detalhes.push({
        colecao: colName,
        categoria: 'Bloqueada p/ Financeiro e Comercial',
        conforme: false,
        erro: 'Coleção não encontrada ou inacessível: ' + String(err),
      })
    }
  }

  // 2. Verificar coleções permitidas para financeiro (bloqueadas para comercial)
  for (let i = 0; i < baseline.financeiro.length; i++) {
    const colName = baseline.financeiro[i]
    totalColecoes++
    try {
      const col = $app.findCollectionByNameOrId(colName)
      const listRule = col.listRule || ''
      const viewRule = col.viewRule || ''
      const createRule = col.createRule || ''
      const updateRule = col.updateRule || ''
      const deleteRule = col.deleteRule || ''

      const listOk =
        listRule.indexOf("@request.auth.role = 'admin'") !== -1 &&
        listRule.indexOf('financeiro') !== -1 &&
        listRule.indexOf('empresa = @request.auth.empresa') !== -1 &&
        listRule.indexOf('comercial') === -1

      const createOk =
        createRule.indexOf("@request.auth.role = 'admin'") !== -1 &&
        createRule.indexOf('financeiro') !== -1 &&
        createRule.indexOf('@request.body.empresa = @request.auth.empresa') !== -1 &&
        createRule.indexOf('comercial') === -1

      const conforme = listOk && createOk
      if (conforme) {
        totalConformes++
      } else {
        totalDivergencias++
      }

      detalhes.push({
        colecao: colName,
        categoria: 'Permitida Financeiro (Bloqueada Comercial)',
        conforme: conforme,
        regrasAtuais: {
          list: listRule,
          view: viewRule,
          create: createRule,
          update: updateRule,
          delete: deleteRule,
        },
      })
    } catch (err) {
      totalDivergencias++
      detalhes.push({
        colecao: colName,
        categoria: 'Permitida Financeiro (Bloqueada Comercial)',
        conforme: false,
        erro: 'Coleção não encontrada: ' + String(err),
      })
    }
  }

  // 3. Auditoria Lançamentos (update e delete só admin)
  totalColecoes++
  try {
    const auditCol = $app.findCollectionByNameOrId('auditoria_lancamentos')
    const listRule = auditCol.listRule || ''
    const updateRule = auditCol.updateRule || ''
    const deleteRule = auditCol.deleteRule || ''

    const conforme =
      listRule.indexOf('financeiro') !== -1 &&
      updateRule.indexOf("@request.auth.role = 'admin'") !== -1 &&
      updateRule.indexOf('financeiro') === -1 &&
      deleteRule.indexOf("@request.auth.role = 'admin'") !== -1 &&
      deleteRule.indexOf('financeiro') === -1

    if (conforme) {
      totalConformes++
    } else {
      totalDivergencias++
    }

    detalhes.push({
      colecao: 'auditoria_lancamentos',
      categoria: 'Auditoria Lançamentos (Read Fin, Write Admin)',
      conforme: conforme,
      regrasAtuais: {
        list: listRule,
        view: auditCol.viewRule || '',
        create: auditCol.createRule || '',
        update: updateRule,
        delete: deleteRule,
      },
    })
  } catch (err) {
    totalDivergencias++
    detalhes.push({
      colecao: 'auditoria_lancamentos',
      categoria: 'Auditoria Lançamentos',
      conforme: false,
      erro: String(err),
    })
  }

  // 4. Coleções Comercial (recebiveis, notas_fiscais, nfse_tomadores)
  for (let i = 0; i < baseline.comercial_empresa.length; i++) {
    const colName = baseline.comercial_empresa[i]
    totalColecoes++
    try {
      const col = $app.findCollectionByNameOrId(colName)
      const listRule = col.listRule || ''
      const createRule = col.createRule || ''

      const conforme =
        listRule.indexOf('comercial') !== -1 &&
        listRule.indexOf('financeiro') !== -1 &&
        listRule.indexOf('empresa = @request.auth.empresa') !== -1 &&
        createRule.indexOf('@request.body.empresa = @request.auth.empresa') !== -1

      if (conforme) {
        totalConformes++
      } else {
        totalDivergencias++
      }

      detalhes.push({
        colecao: colName,
        categoria: 'Permitida Comercial e Financeiro',
        conforme: conforme,
        regrasAtuais: {
          list: listRule,
          view: col.viewRule || '',
          create: createRule,
          update: col.updateRule || '',
          delete: col.deleteRule || '',
        },
      })
    } catch (err) {
      totalDivergencias++
      detalhes.push({
        colecao: colName,
        categoria: 'Permitida Comercial e Financeiro',
        conforme: false,
        erro: String(err),
      })
    }
  }

  // 5. Contratos (vínculo contratante)
  totalColecoes++
  try {
    const contratosCol = $app.findCollectionByNameOrId('contratos')
    const listRule = contratosCol.listRule || ''
    const createRule = contratosCol.createRule || ''

    const conforme =
      listRule.indexOf('contratante = @request.auth.empresa') !== -1 &&
      listRule.indexOf('comercial') !== -1 &&
      createRule.indexOf('@request.body.contratante = @request.auth.empresa') !== -1

    if (conforme) {
      totalConformes++
    } else {
      totalDivergencias++
    }

    detalhes.push({
      colecao: 'contratos',
      categoria: 'Contratos (Vínculo Contratante)',
      conforme: conforme,
      regrasAtuais: {
        list: listRule,
        view: contratosCol.viewRule || '',
        create: createRule,
        update: contratosCol.updateRule || '',
        delete: contratosCol.deleteRule || '',
      },
    })
  } catch (err) {
    totalDivergencias++
    detalhes.push({
      colecao: 'contratos',
      categoria: 'Contratos',
      conforme: false,
      erro: String(err),
    })
  }

  // 6. Historico de precos (produto.empresa)
  totalColecoes++
  try {
    const histCol = $app.findCollectionByNameOrId('historico_precos_produtos')
    const listRule = histCol.listRule || ''
    const createRule = histCol.createRule || ''

    const conforme =
      listRule.indexOf('produto.empresa = @request.auth.empresa') !== -1 &&
      createRule.indexOf('@request.body.produto.empresa = @request.auth.empresa') !== -1

    if (conforme) {
      totalConformes++
    } else {
      totalDivergencias++
    }

    detalhes.push({
      colecao: 'historico_precos_produtos',
      categoria: 'Histórico de Preços (produto.empresa)',
      conforme: conforme,
      regrasAtuais: {
        list: listRule,
        view: histCol.viewRule || '',
        create: createRule,
        update: histCol.updateRule || '',
        delete: histCol.deleteRule || '',
      },
    })
  } catch (err) {
    totalDivergencias++
    detalhes.push({
      colecao: 'historico_precos_produtos',
      categoria: 'Histórico de Preços',
      conforme: false,
      erro: String(err),
    })
  }

  // 7. Benchmarks Setoriais (isolamento por empresa)
  totalColecoes++
  try {
    const benchCol = $app.findCollectionByNameOrId('benchmarks_setoriais')
    const listRule = benchCol.listRule || ''
    const createRule = benchCol.createRule || ''

    const conforme =
      listRule.indexOf('empresa = @request.auth.empresa') !== -1 &&
      createRule.indexOf('@request.body.empresa = @request.auth.empresa') !== -1

    if (conforme) {
      totalConformes++
    } else {
      totalDivergencias++
    }

    detalhes.push({
      colecao: 'benchmarks_setoriais',
      categoria: 'Benchmarks Setoriais (Multi-tenant Empresa)',
      conforme: conforme,
      regrasAtuais: {
        list: listRule,
        view: benchCol.viewRule || '',
        create: createRule,
        update: benchCol.updateRule || '',
        delete: benchCol.deleteRule || '',
      },
    })
  } catch (err) {
    totalDivergencias++
    detalhes.push({
      colecao: 'benchmarks_setoriais',
      categoria: 'Benchmarks Setoriais',
      conforme: false,
      erro: String(err),
    })
  }

  // Salvar relatório
  try {
    const auditSegCol = $app.findCollectionByNameOrId('auditoria_seguranca')
    const record = new Record(auditSegCol)
    record.set('data_verificacao', dataHojeStr)
    record.set('status_geral', totalDivergencias === 0 ? 'ok' : 'divergencia')
    record.set('total_colecoes', totalColecoes)
    record.set('total_conformes', totalConformes)
    record.set('total_divergencias', totalDivergencias)
    record.set('detalhes', JSON.stringify(detalhes))
    record.set('executado_por', 'Cron Mensal')
    $app.save(record)
    console.log(
      '[cron:auditoria_seguranca] Auditoria concluída com sucesso. Conformes:',
      totalConformes,
      'Divergências:',
      totalDivergencias,
    )
  } catch (saveErr) {
    console.log('[cron:auditoria_seguranca] Erro ao persistir relatório:', saveErr)
  }

  // Se houver divergências, alerta administradores por e-mail (execução inline)
  if (totalDivergencias > 0) {
    try {
      const smtpHost = $os.getenv('SMTP_HOST')
      const smtpUser = $os.getenv('SMTP_USER')
      const smtpPass = $os.getenv('SMTP_PASS')
      const smtpFrom = $os.getenv('SMTP_FROM') || 'seguranca@gestao.app'

      if (!smtpHost || !smtpUser || !smtpPass) {
        console.log(
          '[cron:auditoria_seguranca:email] Alerta de segurança não pôde ser enviado por falta de configuração SMTP (SMTP_HOST/SMTP_USER/SMTP_PASS ausentes).',
        )
      } else {
        const adminUsers = $app.findRecordsByFilter(
          '_pb_users_auth_',
          "role = 'admin' && (ativo = true || ativo = null)",
          '-created',
          50,
          0,
        )

        const emailsDestino = []
        for (let u = 0; u < adminUsers.length; u++) {
          const email = adminUsers[u].getString('email')
          if (email && email.indexOf('@') !== -1) {
            emailsDestino.push({
              address: email,
              name: adminUsers[u].getString('name') || 'Administrador do Sistema',
            })
          }
        }

        if (emailsDestino.length > 0) {
          const divergentes = []
          for (let d = 0; d < detalhes.length; d++) {
            if (!detalhes[d].conforme) {
              divergentes.push(detalhes[d])
            }
          }

          let linhasHtml = ''
          for (let k = 0; k < divergentes.length; k++) {
            const item = divergentes[k]
            const esperado = item.categoria || 'Isolamento por perfil e regras restritas'
            let encontrado = 'Regras RLS não atendem ao padrão esperado'
            if (item.erro) {
              encontrado = item.erro
            } else if (item.regrasAtuais) {
              const regrasIncompletas = []
              if (item.categoria.indexOf('Bloqueada') !== -1) {
                regrasIncompletas.push('Permissão indevida ou falta vínculo de empresa')
              } else if (item.categoria.indexOf('Financeiro') !== -1) {
                regrasIncompletas.push('Falta regra para financeiro ou falta vínculo de empresa')
              } else if (item.categoria.indexOf('Comercial') !== -1) {
                regrasIncompletas.push('Falta regra para comercial ou falta vínculo de empresa')
              } else {
                regrasIncompletas.push('Falta regra restrita ou isolamento multi-tenant')
              }
              encontrado = regrasIncompletas.join('; ')
            }

            linhasHtml += `
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 10px 12px; font-family: monospace; font-size: 13px; font-weight: bold; color: #0f172a;">${item.colecao}</td>
                <td style="padding: 10px 12px; font-size: 12px; color: #475569;">${item.categoria}</td>
                <td style="padding: 10px 12px; font-size: 12px; color: #0369a1; background-color: #f0f9ff;">${esperado}</td>
                <td style="padding: 10px 12px; font-size: 12px; color: #b91c1c; background-color: #fef2f2; font-weight: 600;">${encontrado}</td>
              </tr>
            `
          }

          const dataFormatadaPtBr = dataHojeStr.split('-').reverse().join('/')
          const assunto = `⚠️ Auditoria de Segurança — divergências detectadas em ${dataFormatadaPtBr}`
          const htmlCorpo = `
            <!DOCTYPE html>
            <html lang="pt-BR">
            <head><meta charset="utf-8"></head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; color: #1e293b; padding: 24px 12px; margin: 0;">
              <div style="max-width: 680px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.06);">
                <div style="background: linear-gradient(135deg, #0B1F3A 0%, #1e3a8a 100%); padding: 26px 28px; color: #ffffff;">
                  <span style="display: inline-block; background-color: #ef4444; color: #ffffff; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; padding: 4px 10px; border-radius: 9999px; margin-bottom: 8px;">Atenção de Segurança</span>
                  <h1 style="margin: 0 0 6px 0; font-size: 20px; font-weight: 700; color: #ffffff;">Auditoria de Segurança — Divergências Detectadas</h1>
                  <p style="margin: 0; font-size: 13px; color: #bfdbfe;">Disparo por Cron Mensal em ${dataFormatadaPtBr}</p>
                </div>
                <div style="padding: 26px 28px;">
                  <div style="background-color: #fff1f2; border: 1px solid #fecdd3; border-left: 4px solid #e11d48; border-radius: 8px; padding: 14px 18px; margin-bottom: 24px;">
                    <div style="font-weight: 700; color: #9f1239; font-size: 14px; margin: 0 0 4px 0;">⚠️ Regras de API (RLS) fora de conformidade</div>
                    <div style="font-size: 13px; color: #be123c; margin: 0; line-height: 1.5;">
                      Durante a inspeção das regras de acesso das coleções do sistema, foram identificadas <strong>${totalDivergencias} divergência(s)</strong> em relação ao baseline de segurança esperado.
                    </div>
                  </div>
                  <table style="width: 100%; border: none; margin-bottom: 20px;">
                    <tr>
                      <td style="width: 33%; text-align: center; padding: 12px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
                        <div style="font-size: 11px; text-transform: uppercase; font-weight: 600; color: #64748b;">Total Inspecionado</div>
                        <div style="font-size: 22px; font-weight: 800; color: #0f172a;">${totalColecoes}</div>
                      </td>
                      <td style="width: 4%;"></td>
                      <td style="width: 30%; text-align: center; padding: 12px; background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px;">
                        <div style="font-size: 11px; text-transform: uppercase; font-weight: 600; color: #166534;">Conformes</div>
                        <div style="font-size: 22px; font-weight: 800; color: #15803d;">${totalConformes}</div>
                      </td>
                      <td style="width: 4%;"></td>
                      <td style="width: 30%; text-align: center; padding: 12px; background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px;">
                        <div style="font-size: 11px; text-transform: uppercase; font-weight: 600; color: #991b1b;">Divergências</div>
                        <div style="font-size: 22px; font-weight: 800; color: #b91c1c;">${totalDivergencias}</div>
                      </td>
                    </tr>
                  </table>
                  <h3 style="font-size: 14px; font-weight: 700; color: #0f172a; margin: 24px 0 10px 0;">Coleções que requerem verificação:</h3>
                  <table style="width: 100%; border-collapse: collapse; margin-top: 12px; margin-bottom: 24px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                    <thead>
                      <tr style="background-color: #f1f5f9;">
                        <th style="padding: 10px 12px; font-size: 11px; text-transform: uppercase; font-weight: 700; color: #475569; text-align: left;">Coleção</th>
                        <th style="padding: 10px 12px; font-size: 11px; text-transform: uppercase; font-weight: 700; color: #475569; text-align: left;">Categoria</th>
                        <th style="padding: 10px 12px; font-size: 11px; text-transform: uppercase; font-weight: 700; color: #475569; text-align: left;">Esperado</th>
                        <th style="padding: 10px 12px; font-size: 11px; text-transform: uppercase; font-weight: 700; color: #475569; text-align: left;">Situação Atual</th>
                      </tr>
                    </thead>
                    <tbody>${linhasHtml}</tbody>
                  </table>
                  <div style="text-align: center; margin: 28px 0 16px 0;">
                    <p style="font-size: 13px; color: #475569; margin-bottom: 12px;">Recomendamos abrir a tela de gerenciamento de segurança:</p>
                    <div style="background-color: #f1f5f9; padding: 12px 18px; border-radius: 8px; display: inline-block; font-size: 13px; font-weight: 600; color: #1e293b;">
                      Menu Lateral → Cadastros → <strong>Auditoria de Segurança</strong> (<code>/admin/auditoria</code>)
                    </div>
                  </div>
                </div>
                <div style="background-color: #f8fafc; padding: 18px 28px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; line-height: 1.5; text-align: center;">
                  Este alerta foi gerado automaticamente pelo módulo de Auditoria de Segurança do sistema de <strong>Gestão Econômica e Financeira</strong>.<br>
                  Você está recebendo esta mensagem por possuir perfil de Administrador (<code>role = 'admin'</code>).
                </div>
              </div>
            </body>
            </html>
          `

          const mailClient = $app.newMailClient()
          for (let m = 0; m < emailsDestino.length; m++) {
            try {
              mailClient.send({
                from: { address: smtpFrom, name: 'Auditoria de Segurança — Gestão Econômica' },
                to: [emailsDestino[m]],
                subject: assunto,
                html: htmlCorpo,
              })
              console.log(
                '[cron:auditoria_seguranca:email] Alerta enviado para:',
                emailsDestino[m].address,
              )
            } catch (sendErr) {
              console.log(
                '[cron:auditoria_seguranca:email] Erro ao enviar para ' +
                  emailsDestino[m].address +
                  ':',
                sendErr,
              )
            }
          }
        }
      }
    } catch (mailGeralErr) {
      console.log(
        '[cron:auditoria_seguranca:email] Falha ao processar envio de alerta:',
        mailGeralErr,
      )
    }
  }
})

// Endpoint manual POST /api/admin/auditoria-seguranca/verificar (Admin apenas)
routerAdd('POST', '/api/admin/auditoria-seguranca/verificar', (e) => {
  const authRecord = e.auth
  if (!authRecord || authRecord.getString('role') !== 'admin') {
    return e.json(403, { error: 'Acesso restrito para administradores.' })
  }

  const agora = new Date()
  const dataHojeStr = agora.toISOString().slice(0, 10)

  const baseline = {
    bloqueadas: [
      'balancos',
      'dre',
      'produtos',
      'materias_primas',
      'fichas_tecnicas',
      'configuracoes_tributarias',
      'benchmarks_empresas',
      'simulador_cenarios',
      'memoria_fornecedores_despesas',
      'bsc_kpis',
      'bsc_iniciativas',
      'bsc_iniciativas_historico',
    ],
    financeiro: [
      'lancamentos',
      'lancamentos_recorrentes',
      'metas_lancamentos',
      'centros',
      'tipos_despesa',
      'contas',
      'plano_contas',
      'lancamentos_centro',
    ],
    comercial_empresa: ['recebiveis', 'notas_fiscais', 'nfse_tomadores'],
  }

  let totalColecoes = 0
  let totalConformes = 0
  let totalDivergencias = 0
  const detalhes = []

  // 1. Coleções bloqueadas para financeiro e comercial
  for (let i = 0; i < baseline.bloqueadas.length; i++) {
    const colName = baseline.bloqueadas[i]
    totalColecoes++
    try {
      const col = $app.findCollectionByNameOrId(colName)
      const listRule = col.listRule || ''
      const viewRule = col.viewRule || ''
      const createRule = col.createRule || ''
      const updateRule = col.updateRule || ''
      const deleteRule = col.deleteRule || ''

      const listOk =
        listRule.indexOf("@request.auth.role = 'admin'") !== -1 &&
        listRule.indexOf("@request.auth.role = 'empresa'") !== -1 &&
        listRule.indexOf('empresa = @request.auth.empresa') !== -1 &&
        listRule.indexOf('financeiro') === -1 &&
        listRule.indexOf('comercial') === -1

      const createOk =
        createRule.indexOf("@request.auth.role = 'admin'") !== -1 &&
        createRule.indexOf("@request.auth.role = 'empresa'") !== -1 &&
        createRule.indexOf('@request.body.empresa = @request.auth.empresa') !== -1 &&
        createRule.indexOf('financeiro') === -1 &&
        createRule.indexOf('comercial') === -1

      const updateOk =
        updateRule.indexOf("@request.auth.role = 'admin'") !== -1 &&
        updateRule.indexOf("@request.auth.role = 'empresa'") !== -1 &&
        updateRule.indexOf('financeiro') === -1

      const deleteOk =
        deleteRule.indexOf("@request.auth.role = 'admin'") !== -1 &&
        deleteRule.indexOf("@request.auth.role = 'empresa'") !== -1 &&
        deleteRule.indexOf('financeiro') === -1

      const conforme = listOk && createOk && updateOk && deleteOk
      if (conforme) {
        totalConformes++
      } else {
        totalDivergencias++
      }

      detalhes.push({
        colecao: colName,
        categoria: 'Bloqueada p/ Financeiro e Comercial',
        conforme: conforme,
        regrasAtuais: {
          list: listRule,
          view: viewRule,
          create: createRule,
          update: updateRule,
          delete: deleteRule,
        },
      })
    } catch (err) {
      totalDivergencias++
      detalhes.push({
        colecao: colName,
        categoria: 'Bloqueada p/ Financeiro e Comercial',
        conforme: false,
        erro: 'Coleção não encontrada: ' + String(err),
      })
    }
  }

  // 2. Coleções financeiro
  for (let i = 0; i < baseline.financeiro.length; i++) {
    const colName = baseline.financeiro[i]
    totalColecoes++
    try {
      const col = $app.findCollectionByNameOrId(colName)
      const listRule = col.listRule || ''
      const viewRule = col.viewRule || ''
      const createRule = col.createRule || ''
      const updateRule = col.updateRule || ''
      const deleteRule = col.deleteRule || ''

      const listOk =
        listRule.indexOf("@request.auth.role = 'admin'") !== -1 &&
        listRule.indexOf('financeiro') !== -1 &&
        listRule.indexOf('empresa = @request.auth.empresa') !== -1 &&
        listRule.indexOf('comercial') === -1

      const createOk =
        createRule.indexOf("@request.auth.role = 'admin'") !== -1 &&
        createRule.indexOf('financeiro') !== -1 &&
        createRule.indexOf('@request.body.empresa = @request.auth.empresa') !== -1 &&
        createRule.indexOf('comercial') === -1

      const conforme = listOk && createOk
      if (conforme) {
        totalConformes++
      } else {
        totalDivergencias++
      }

      detalhes.push({
        colecao: colName,
        categoria: 'Permitida Financeiro (Bloqueada Comercial)',
        conforme: conforme,
        regrasAtuais: {
          list: listRule,
          view: viewRule,
          create: createRule,
          update: updateRule,
          delete: deleteRule,
        },
      })
    } catch (err) {
      totalDivergencias++
      detalhes.push({
        colecao: colName,
        categoria: 'Permitida Financeiro (Bloqueada Comercial)',
        conforme: false,
        erro: 'Coleção não encontrada: ' + String(err),
      })
    }
  }

  // 3. Auditoria Lançamentos
  totalColecoes++
  try {
    const auditCol = $app.findCollectionByNameOrId('auditoria_lancamentos')
    const listRule = auditCol.listRule || ''
    const updateRule = auditCol.updateRule || ''
    const deleteRule = auditCol.deleteRule || ''

    const conforme =
      listRule.indexOf('financeiro') !== -1 &&
      updateRule.indexOf("@request.auth.role = 'admin'") !== -1 &&
      updateRule.indexOf('financeiro') === -1 &&
      deleteRule.indexOf("@request.auth.role = 'admin'") !== -1 &&
      deleteRule.indexOf('financeiro') === -1

    if (conforme) {
      totalConformes++
    } else {
      totalDivergencias++
    }

    detalhes.push({
      colecao: 'auditoria_lancamentos',
      categoria: 'Auditoria Lançamentos (Read Fin, Write Admin)',
      conforme: conforme,
      regrasAtuais: {
        list: listRule,
        view: auditCol.viewRule || '',
        create: auditCol.createRule || '',
        update: updateRule,
        delete: deleteRule,
      },
    })
  } catch (err) {
    totalDivergencias++
    detalhes.push({
      colecao: 'auditoria_lancamentos',
      categoria: 'Auditoria Lançamentos',
      conforme: false,
      erro: String(err),
    })
  }

  // 4. Coleções Comercial (recebiveis, notas_fiscais, nfse_tomadores)
  for (let i = 0; i < baseline.comercial_empresa.length; i++) {
    const colName = baseline.comercial_empresa[i]
    totalColecoes++
    try {
      const col = $app.findCollectionByNameOrId(colName)
      const listRule = col.listRule || ''
      const createRule = col.createRule || ''

      const conforme =
        listRule.indexOf('comercial') !== -1 &&
        listRule.indexOf('financeiro') !== -1 &&
        listRule.indexOf('empresa = @request.auth.empresa') !== -1 &&
        createRule.indexOf('@request.body.empresa = @request.auth.empresa') !== -1

      if (conforme) {
        totalConformes++
      } else {
        totalDivergencias++
      }

      detalhes.push({
        colecao: colName,
        categoria: 'Permitida Comercial e Financeiro',
        conforme: conforme,
        regrasAtuais: {
          list: listRule,
          view: col.viewRule || '',
          create: createRule,
          update: col.updateRule || '',
          delete: col.deleteRule || '',
        },
      })
    } catch (err) {
      totalDivergencias++
      detalhes.push({
        colecao: colName,
        categoria: 'Permitida Comercial e Financeiro',
        conforme: false,
        erro: String(err),
      })
    }
  }

  // 5. Contratos
  totalColecoes++
  try {
    const contratosCol = $app.findCollectionByNameOrId('contratos')
    const listRule = contratosCol.listRule || ''
    const createRule = contratosCol.createRule || ''

    const conforme =
      listRule.indexOf('contratante = @request.auth.empresa') !== -1 &&
      listRule.indexOf('comercial') !== -1 &&
      createRule.indexOf('@request.body.contratante = @request.auth.empresa') !== -1

    if (conforme) {
      totalConformes++
    } else {
      totalDivergencias++
    }

    detalhes.push({
      colecao: 'contratos',
      categoria: 'Contratos (Vínculo Contratante)',
      conforme: conforme,
      regrasAtuais: {
        list: listRule,
        view: contratosCol.viewRule || '',
        create: createRule,
        update: contratosCol.updateRule || '',
        delete: contratosCol.deleteRule || '',
      },
    })
  } catch (err) {
    totalDivergencias++
    detalhes.push({
      colecao: 'contratos',
      categoria: 'Contratos',
      conforme: false,
      erro: String(err),
    })
  }

  // 6. Historico de precos
  totalColecoes++
  try {
    const histCol = $app.findCollectionByNameOrId('historico_precos_produtos')
    const listRule = histCol.listRule || ''
    const createRule = histCol.createRule || ''

    const conforme =
      listRule.indexOf('produto.empresa = @request.auth.empresa') !== -1 &&
      createRule.indexOf('@request.body.produto.empresa = @request.auth.empresa') !== -1

    if (conforme) {
      totalConformes++
    } else {
      totalDivergencias++
    }

    detalhes.push({
      colecao: 'historico_precos_produtos',
      categoria: 'Histórico de Preços (produto.empresa)',
      conforme: conforme,
      regrasAtuais: {
        list: listRule,
        view: histCol.viewRule || '',
        create: createRule,
        update: histCol.updateRule || '',
        delete: histCol.deleteRule || '',
      },
    })
  } catch (err) {
    totalDivergencias++
    detalhes.push({
      colecao: 'historico_precos_produtos',
      categoria: 'Histórico de Preços',
      conforme: false,
      erro: String(err),
    })
  }

  // 7. Benchmarks Setoriais
  totalColecoes++
  try {
    const benchCol = $app.findCollectionByNameOrId('benchmarks_setoriais')
    const listRule = benchCol.listRule || ''
    const createRule = benchCol.createRule || ''

    const conforme =
      listRule.indexOf('empresa = @request.auth.empresa') !== -1 &&
      createRule.indexOf('@request.body.empresa = @request.auth.empresa') !== -1

    if (conforme) {
      totalConformes++
    } else {
      totalDivergencias++
    }

    detalhes.push({
      colecao: 'benchmarks_setoriais',
      categoria: 'Benchmarks Setoriais (Multi-tenant Empresa)',
      conforme: conforme,
      regrasAtuais: {
        list: listRule,
        view: benchCol.viewRule || '',
        create: createRule,
        update: benchCol.updateRule || '',
        delete: benchCol.deleteRule || '',
      },
    })
  } catch (err) {
    totalDivergencias++
    detalhes.push({
      colecao: 'benchmarks_setoriais',
      categoria: 'Benchmarks Setoriais',
      conforme: false,
      erro: String(err),
    })
  }

  // Salvar relatório
  let novoId = ''
  try {
    const auditSegCol = $app.findCollectionByNameOrId('auditoria_seguranca')
    const record = new Record(auditSegCol)
    record.set('data_verificacao', dataHojeStr)
    record.set('status_geral', totalDivergencias === 0 ? 'ok' : 'divergencia')
    record.set('total_colecoes', totalColecoes)
    record.set('total_conformes', totalConformes)
    record.set('total_divergencias', totalDivergencias)
    record.set('detalhes', JSON.stringify(detalhes))
    record.set('executado_por', authRecord.getString('name') || authRecord.getString('email'))
    $app.save(record)
    novoId = record.id
  } catch (saveErr) {
    return e.json(500, { error: 'Falha ao salvar auditoria de segurança: ' + String(saveErr) })
  }

  // Se houver divergências, alerta administradores por e-mail (execução inline)
  let emailAlertaStatus = { enviado: false }
  if (totalDivergencias > 0) {
    try {
      const smtpHost = $os.getenv('SMTP_HOST')
      const smtpUser = $os.getenv('SMTP_USER')
      const smtpPass = $os.getenv('SMTP_PASS')
      const smtpFrom = $os.getenv('SMTP_FROM') || 'seguranca@gestao.app'

      if (!smtpHost || !smtpUser || !smtpPass) {
        console.log(
          '[router:auditoria_seguranca:email] Alerta de segurança não pôde ser enviado por falta de configuração SMTP (SMTP_HOST/SMTP_USER/SMTP_PASS ausentes).',
        )
        emailAlertaStatus = { enviado: false, motivo: 'SMTP_NAO_CONFIGURADO' }
      } else {
        const adminUsers = $app.findRecordsByFilter(
          '_pb_users_auth_',
          "role = 'admin' && (ativo = true || ativo = null)",
          '-created',
          50,
          0,
        )

        const emailsDestino = []
        for (let u = 0; u < adminUsers.length; u++) {
          const email = adminUsers[u].getString('email')
          if (email && email.indexOf('@') !== -1) {
            emailsDestino.push({
              address: email,
              name: adminUsers[u].getString('name') || 'Administrador do Sistema',
            })
          }
        }

        if (emailsDestino.length > 0) {
          const divergentes = []
          for (let d = 0; d < detalhes.length; d++) {
            if (!detalhes[d].conforme) {
              divergentes.push(detalhes[d])
            }
          }

          let linhasHtml = ''
          for (let k = 0; k < divergentes.length; k++) {
            const item = divergentes[k]
            const esperado = item.categoria || 'Isolamento por perfil e regras restritas'
            let encontrado = 'Regras RLS não atendem ao padrão esperado'
            if (item.erro) {
              encontrado = item.erro
            } else if (item.regrasAtuais) {
              const regrasIncompletas = []
              if (item.categoria.indexOf('Bloqueada') !== -1) {
                regrasIncompletas.push('Permissão indevida ou falta vínculo de empresa')
              } else if (item.categoria.indexOf('Financeiro') !== -1) {
                regrasIncompletas.push('Falta regra para financeiro ou falta vínculo de empresa')
              } else if (item.categoria.indexOf('Comercial') !== -1) {
                regrasIncompletas.push('Falta regra para comercial ou falta vínculo de empresa')
              } else {
                regrasIncompletas.push('Falta regra restrita ou isolamento multi-tenant')
              }
              encontrado = regrasIncompletas.join('; ')
            }

            linhasHtml += `
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 10px 12px; font-family: monospace; font-size: 13px; font-weight: bold; color: #0f172a;">${item.colecao}</td>
                <td style="padding: 10px 12px; font-size: 12px; color: #475569;">${item.categoria}</td>
                <td style="padding: 10px 12px; font-size: 12px; color: #0369a1; background-color: #f0f9ff;">${esperado}</td>
                <td style="padding: 10px 12px; font-size: 12px; color: #b91c1c; background-color: #fef2f2; font-weight: 600;">${encontrado}</td>
              </tr>
            `
          }

          const dataFormatadaPtBr = dataHojeStr.split('-').reverse().join('/')
          const quemDisparou = authRecord.getString('name') || authRecord.getString('email')
          const assunto = `⚠️ Auditoria de Segurança — divergências detectadas em ${dataFormatadaPtBr}`
          const htmlCorpo = `
            <!DOCTYPE html>
            <html lang="pt-BR">
            <head><meta charset="utf-8"></head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; color: #1e293b; padding: 24px 12px; margin: 0;">
              <div style="max-width: 680px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.06);">
                <div style="background: linear-gradient(135deg, #0B1F3A 0%, #1e3a8a 100%); padding: 26px 28px; color: #ffffff;">
                  <span style="display: inline-block; background-color: #ef4444; color: #ffffff; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; padding: 4px 10px; border-radius: 9999px; margin-bottom: 8px;">Atenção de Segurança</span>
                  <h1 style="margin: 0 0 6px 0; font-size: 20px; font-weight: 700; color: #ffffff;">Auditoria de Segurança — Divergências Detectadas</h1>
                  <p style="margin: 0; font-size: 13px; color: #bfdbfe;">Disparo por Verificação Manual (${quemDisparou}) em ${dataFormatadaPtBr}</p>
                </div>
                <div style="padding: 26px 28px;">
                  <div style="background-color: #fff1f2; border: 1px solid #fecdd3; border-left: 4px solid #e11d48; border-radius: 8px; padding: 14px 18px; margin-bottom: 24px;">
                    <div style="font-weight: 700; color: #9f1239; font-size: 14px; margin: 0 0 4px 0;">⚠️ Regras de API (RLS) fora de conformidade</div>
                    <div style="font-size: 13px; color: #be123c; margin: 0; line-height: 1.5;">
                      Durante a inspeção das regras de acesso das coleções do sistema, foram identificadas <strong>${totalDivergencias} divergência(s)</strong> em relação ao baseline de segurança esperado.
                    </div>
                  </div>
                  <table style="width: 100%; border: none; margin-bottom: 20px;">
                    <tr>
                      <td style="width: 33%; text-align: center; padding: 12px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
                        <div style="font-size: 11px; text-transform: uppercase; font-weight: 600; color: #64748b;">Total Inspecionado</div>
                        <div style="font-size: 22px; font-weight: 800; color: #0f172a;">${totalColecoes}</div>
                      </td>
                      <td style="width: 4%;"></td>
                      <td style="width: 30%; text-align: center; padding: 12px; background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px;">
                        <div style="font-size: 11px; text-transform: uppercase; font-weight: 600; color: #166534;">Conformes</div>
                        <div style="font-size: 22px; font-weight: 800; color: #15803d;">${totalConformes}</div>
                      </td>
                      <td style="width: 4%;"></td>
                      <td style="width: 30%; text-align: center; padding: 12px; background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px;">
                        <div style="font-size: 11px; text-transform: uppercase; font-weight: 600; color: #991b1b;">Divergências</div>
                        <div style="font-size: 22px; font-weight: 800; color: #b91c1c;">${totalDivergencias}</div>
                      </td>
                    </tr>
                  </table>
                  <h3 style="font-size: 14px; font-weight: 700; color: #0f172a; margin: 24px 0 10px 0;">Coleções que requerem verificação:</h3>
                  <table style="width: 100%; border-collapse: collapse; margin-top: 12px; margin-bottom: 24px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                    <thead>
                      <tr style="background-color: #f1f5f9;">
                        <th style="padding: 10px 12px; font-size: 11px; text-transform: uppercase; font-weight: 700; color: #475569; text-align: left;">Coleção</th>
                        <th style="padding: 10px 12px; font-size: 11px; text-transform: uppercase; font-weight: 700; color: #475569; text-align: left;">Categoria</th>
                        <th style="padding: 10px 12px; font-size: 11px; text-transform: uppercase; font-weight: 700; color: #475569; text-align: left;">Esperado</th>
                        <th style="padding: 10px 12px; font-size: 11px; text-transform: uppercase; font-weight: 700; color: #475569; text-align: left;">Situação Atual</th>
                      </tr>
                    </thead>
                    <tbody>${linhasHtml}</tbody>
                  </table>
                  <div style="text-align: center; margin: 28px 0 16px 0;">
                    <p style="font-size: 13px; color: #475569; margin-bottom: 12px;">Recomendamos abrir a tela de gerenciamento de segurança:</p>
                    <div style="background-color: #f1f5f9; padding: 12px 18px; border-radius: 8px; display: inline-block; font-size: 13px; font-weight: 600; color: #1e293b;">
                      Menu Lateral → Cadastros → <strong>Auditoria de Segurança</strong> (<code>/admin/auditoria</code>)
                    </div>
                  </div>
                </div>
                <div style="background-color: #f8fafc; padding: 18px 28px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; line-height: 1.5; text-align: center;">
                  Este alerta foi gerado automaticamente pelo módulo de Auditoria de Segurança do sistema de <strong>Gestão Econômica e Financeira</strong>.<br>
                  Você está recebendo esta mensagem por possuir perfil de Administrador (<code>role = 'admin'</code>).
                </div>
              </div>
            </body>
            </html>
          `

          const mailClient = $app.newMailClient()
          let countEnviados = 0
          for (let m = 0; m < emailsDestino.length; m++) {
            try {
              mailClient.send({
                from: { address: smtpFrom, name: 'Auditoria de Segurança — Gestão Econômica' },
                to: [emailsDestino[m]],
                subject: assunto,
                html: htmlCorpo,
              })
              countEnviados++
              console.log(
                '[router:auditoria_seguranca:email] Alerta enviado para:',
                emailsDestino[m].address,
              )
            } catch (sendErr) {
              console.log(
                '[router:auditoria_seguranca:email] Erro ao enviar para ' +
                  emailsDestino[m].address +
                  ':',
                sendErr,
              )
            }
          }
          emailAlertaStatus = { enviado: true, total: countEnviados }
        }
      }
    } catch (mailGeralErr) {
      console.log(
        '[router:auditoria_seguranca:email] Falha ao processar envio de alerta:',
        mailGeralErr,
      )
      emailAlertaStatus = { enviado: false, erro: String(mailGeralErr) }
    }
  }

  return e.json(200, {
    success: true,
    relatorio: {
      id: novoId,
      data_verificacao: dataHojeStr,
      status_geral: totalDivergencias === 0 ? 'ok' : 'divergencia',
      total_colecoes: totalColecoes,
      total_conformes: totalConformes,
      total_divergencias: totalDivergencias,
      detalhes: detalhes,
    },
    alerta_email: emailAlertaStatus,
  })
})
