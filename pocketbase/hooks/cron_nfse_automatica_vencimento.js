/**
 * Cron Job Diário de Emissão Automática de NFSe no Vencimento da Parcela
 * Executa todos os dias às 06:00 (America/Sao_Paulo / UTC 09:00)
 *
 * Localiza parcelas de recebíveis com nfse_automatica_agendada = true,
 * que vencem na data de hoje ou anterior e ainda não tiveram NFSe gerada (nfse_emitida_em IS NULL e nota_fiscal IS NULL),
 * e cuja empresa contratante possua emitir_nota_fiscal = true.
 * Emite a NFSe automaticamente (em modo gateway ou homologação/simulação),
 * vincula a nota_fiscal ao recebível e atualiza o status.
 */

cronAdd('nfse_emissao_automatica_vencimento', '0 6 * * *', () => {
  try {
    const hoje = new Date()
    const hojeYmd = hoje.toISOString().slice(0, 10)
    const dataHoraIso = hoje.toISOString()
    const dataEmissaoFormatada = dataHoraIso.slice(0, 10) + ' 12:00:00'

    console.log(
      `[Cron NFSe Automática] Verificando parcelas agendadas com vencimento até ${hojeYmd}...`,
    )

    // Filtra recebíveis com agendamento ativo e sem nota emitida
    const filter = `nfse_automatica_agendada = true && nota_fiscal = '' && vencimento <= '${hojeYmd} 23:59:59'`
    const recebiveis = $app.findRecordsByFilter('recebiveis', filter, 'vencimento', 100)

    if (!recebiveis || recebiveis.length === 0) {
      console.log('[Cron NFSe Automática] Nenhuma parcela elegível para emissão automática hoje.')
      return
    }

    console.log(
      `[Cron NFSe Automática] ${recebiveis.length} parcela(s) agendada(s) encontrada(s) para emissão.`,
    )

    for (const r of recebiveis) {
      try {
        const userId = r.get('user')
        const empresaId = r.get('empresa')
        if (!userId || !empresaId) continue

        // 1. Verifica se a empresa cliente existe e está com emitir_nota_fiscal = true
        let empresaRec = null
        try {
          empresaRec = $app.findRecordById('empresas', empresaId)
        } catch (_) {}

        if (!empresaRec) {
          console.log(
            `[Cron NFSe Automática] Empresa ${empresaId} não encontrada. Pulando recebível ${r.id}.`,
          )
          continue
        }

        const emitirNfFlag = empresaRec.get('emitir_nota_fiscal')
        if (emitirNfFlag === false) {
          console.log(
            `[Cron NFSe Automática] Empresa ${empresaRec.get('nome')} com emitir_nota_fiscal desativado. Pulando.`,
          )
          continue
        }

        // 2. Busca dados de Minha Empresa (prestador)
        let prestadorCnpj = ''
        let prestadorRazao = 'Minha Empresa'
        let prestadorIm = ''
        let prestadorRegime = 'Simples Nacional'
        let prestadorCidade = ''
        let prestadorUf = 'SP'
        let aliqIssPadrao = 5.0
        let issRetidoPadrao = false
        let itemCnaePadrao = '6920-6/01'
        let codServicoPadrao = '0107'

        try {
          const minhaEmpresaList = $app.findRecordsByFilter(
            'minha_empresa',
            `user = '${userId}'`,
            '-created',
            1,
          )
          if (minhaEmpresaList && minhaEmpresaList.length > 0) {
            const m = minhaEmpresaList[0]
            prestadorCnpj = m.get('cnpj') || ''
            prestadorRazao = m.get('razao_social') || m.get('nome_fantasia') || prestadorRazao
            prestadorIm = m.get('inscricao_municipal') || ''
            prestadorRegime = m.get('regime_tributario') || prestadorRegime
            prestadorCidade = m.get('cidade') || ''
            prestadorUf = m.get('estado') || prestadorUf
          }
        } catch (_) {}

        // 3. Busca contrato vinculado se houver
        let contratoId = null
        try {
          const contratosList = $app.findRecordsByFilter(
            'contratos',
            `contratante = '${empresaId}'`,
            '-data_inicio',
            1,
          )
          if (contratosList && contratosList.length > 0) {
            contratoId = contratosList[0].id
          }
        } catch (_) {}

        // 4. Determina próximo número sequencial de NFSe para este usuário
        let proximoNumero = 1
        try {
          const ultimasNotas = $app.findRecordsByFilter(
            'notas_fiscais',
            `user = '${userId}'`,
            '-numero',
            1,
          )
          if (ultimasNotas && ultimasNotas.length > 0) {
            proximoNumero = (Number(ultimasNotas[0].get('numero')) || 0) + 1
          }
        } catch (_) {
          proximoNumero = 1
        }

        const valorParcela = Number(r.get('valor')) || 0
        const nroParcela = r.get('parcela') || 1
        const vencimentoStr = (r.get('vencimento') || hojeYmd).slice(0, 10)

        // Cálculo de impostos
        const valorIss = Number(((valorParcela * aliqIssPadrao) / 100).toFixed(2))
        const valorPis = Number((valorParcela * 0.0065).toFixed(2))
        const valorCofins = Number((valorParcela * 0.03).toFixed(2))
        const valorIr = Number((valorParcela * 0.015).toFixed(2))
        const valorCsll = Number((valorParcela * 0.01).toFixed(2))
        const totalRetencoes = issRetidoPadrao
          ? valorIss + valorPis + valorCofins + valorIr + valorCsll
          : valorPis + valorCofins + valorIr + valorCsll
        const valorLiquido = Math.max(0, Number((valorParcela - totalRetencoes).toFixed(2)))

        const tomadorCnpj = empresaRec.get('cnpj') || ''
        const tomadorRazao = empresaRec.get('nome') || 'Cliente'
        const tomadorEmail = empresaRec.get('email') || ''

        const rnd = $security.randomString(8).toUpperCase()
        const codigoVerificacao = `${rnd.slice(0, 4)}-${rnd.slice(4, 8)}`
        const cnpjLimpo = (prestadorCnpj || '00000000000000').replace(/\D/g, '').padEnd(14, '0')
        const anoMes = hojeYmd.slice(2, 4) + hojeYmd.slice(5, 7)
        const chaveAcesso = `35${anoMes}${cnpjLimpo}55001${String(proximoNumero).padStart(9, '0')}1${$security.randomString(8, '1234567890')}`
        const protocoloAutorizacao = `AUT-AGEND-${anoMes}-${$security.randomString(6).toUpperCase()}`

        const discriminacao = `Prestação de serviços contábeis, assessoria financeira e consultoria em gestão empresarial — Parcela nº ${nroParcela} (Vencimento: ${vencimentoStr.split('-').reverse().join('/')}). Emissão automática agendada no vencimento do contrato.`

        // 5. Cria o registro da Nota Fiscal
        const notasCol = $app.findCollectionByNameOrId('notas_fiscais')
        const novaNota = new Record(notasCol)

        novaNota.set('user', userId)
        novaNota.set('empresa', empresaId)
        if (contratoId) novaNota.set('contrato', contratoId)
        novaNota.set('recebivel', r.id)
        novaNota.set('numero', proximoNumero)
        novaNota.set('serie', '1')
        novaNota.set('codigo_verificacao', codigoVerificacao)
        novaNota.set('chave_acesso', chaveAcesso)
        novaNota.set('status', 'Emitida')
        novaNota.set('tipo_documento', 'NFSe')
        novaNota.set('data_emissao', dataEmissaoFormatada)
        novaNota.set('competencia', `${vencimentoStr} 00:00:00`)
        novaNota.set('vencimento', `${vencimentoStr} 12:00:00`)
        novaNota.set('discriminacao', discriminacao)
        novaNota.set('item_cnae', itemCnaePadrao)
        novaNota.set('codigo_servico_municipal', codServicoPadrao)
        novaNota.set('natureza_operacao', '1')
        novaNota.set('valor_servicos', valorParcela)
        novaNota.set('aliquota_iss', aliqIssPadrao)
        novaNota.set('valor_iss', valorIss)
        novaNota.set('iss_retido', issRetidoPadrao)
        novaNota.set('valor_pis', valorPis)
        novaNota.set('valor_cofins', valorCofins)
        novaNota.set('valor_inss', 0)
        novaNota.set('valor_ir', valorIr)
        novaNota.set('valor_csll', valorCsll)
        novaNota.set('outras_retencoes', 0)
        novaNota.set('desconto_incondicionado', 0)
        novaNota.set('valor_liquido', valorLiquido)
        novaNota.set('prestador_cnpj', prestadorCnpj)
        novaNota.set('prestador_razao_social', prestadorRazao)
        novaNota.set('prestador_inscricao_municipal', prestadorIm)
        novaNota.set('tomador_cnpj', tomadorCnpj)
        novaNota.set('tomador_razao_social', tomadorRazao)
        novaNota.set('tomador_email', tomadorEmail)
        novaNota.set('modo_emissao', 'Homologação / Simulação')
        novaNota.set(
          'gateway_status_resposta',
          'NFSe emitida automaticamente pelo agendamento no vencimento da parcela de contrato.',
        )
        novaNota.set('protocolo_autorizacao', protocoloAutorizacao)
        novaNota.set('agendamento_automatico', true)

        // Se a parcela já estiver paga, marca como conciliada de imediato
        const isJaPago = r.get('status') === 'Pago'
        if (isJaPago) {
          novaNota.set('conciliada', true)
          novaNota.set('conciliada_em', dataEmissaoFormatada)
        } else {
          novaNota.set('conciliada', false)
        }

        $app.save(novaNota)

        // 6. Atualiza o recebível vinculando a nota e marcando emissão
        r.set('nota_fiscal', novaNota.id)
        r.set('nfse_emitida_em', dataEmissaoFormatada)
        if (isJaPago) {
          r.set('conciliado', true)
          r.set('conciliado_em', dataEmissaoFormatada)
        }
        $app.save(r)
        console.log(
          `[Cron NFSe Automática] NFSe nº ${proximoNumero} emitida com sucesso para empresa ${tomadorRazao} (Recebível ${r.id}).`,
        )
      } catch (errRecebivel) {
        console.log(
          `[Cron NFSe Automática] Erro ao emitir NFSe para recebível ${r.id}:`,
          errRecebivel,
        )
      }
    }
  } catch (err) {
    console.log('[Cron NFSe Automática] Erro geral no cron de emissão:', err)
  }
})
