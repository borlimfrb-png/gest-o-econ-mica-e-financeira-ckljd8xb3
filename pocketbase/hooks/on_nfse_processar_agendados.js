/**
 * Hook para Execução Manual / Imediata do Agendamento de Emissão de NFSe
 * Endpoint: POST /api/nfse/processar-agendados
 */

routerAdd(
  'POST',
  '/api/nfse/processar-agendados',
  (e) => {
    try {
      const authRecord = e.auth
      if (!authRecord) {
        return e.json(401, { success: false, message: 'Usuário não autenticado.' })
      }

      const body = e.requestInfo().body || {}
      const recebivelIdEspecifico = body.recebivel_id || null

      const hoje = new Date()
      const hojeYmd = hoje.toISOString().slice(0, 10)
      const dataHoraIso = hoje.toISOString()
      const dataEmissaoFormatada = dataHoraIso.slice(0, 10) + ' 12:00:00'

      let filter = `user = '${authRecord.id}' && nfse_automatica_agendada = true && nota_fiscal = ''`
      if (recebivelIdEspecifico) {
        filter = `id = '${recebivelIdEspecifico}' && user = '${authRecord.id}'`
      }

      const recebiveis = $app.findRecordsByFilter('recebiveis', filter, 'vencimento', 50)
      if (!recebiveis || recebiveis.length === 0) {
        return e.json(200, {
          success: true,
          processados: 0,
          message: 'Nenhuma parcela pendente de emissão de NFSe encontrada.',
          notas: [],
        })
      }

      const notasGeradas = []

      for (const r of recebiveis) {
        try {
          const empresaId = r.get('empresa')
          if (!empresaId) continue

          let empresaRec = null
          try {
            empresaRec = $app.findRecordById('empresas', empresaId)
          } catch (_) {}

          if (!empresaRec) continue

          // Busca dados prestador
          let prestadorCnpj = ''
          let prestadorRazao = 'Minha Empresa'
          let prestadorIm = ''
          let prestadorRegime = 'Simples Nacional'
          let prestadorCidade = ''
          let prestadorUf = 'SP'

          try {
            const minhaEmpresaList = $app.findRecordsByFilter(
              'minha_empresa',
              `user = '${authRecord.id}'`,
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

          // Contrato
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

          // Próximo número de nota
          let proximoNumero = 1
          try {
            const ultimasNotas = $app.findRecordsByFilter(
              'notas_fiscais',
              `user = '${authRecord.id}'`,
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

          const aliqIss = 5.0
          const valorIss = Number(((valorParcela * aliqIss) / 100).toFixed(2))
          const valorPis = Number((valorParcela * 0.0065).toFixed(2))
          const valorCofins = Number((valorParcela * 0.03).toFixed(2))
          const valorIr = Number((valorParcela * 0.015).toFixed(2))
          const valorCsll = Number((valorParcela * 0.01).toFixed(2))
          const totalRetencoes = valorPis + valorCofins + valorIr + valorCsll
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

          const discriminacao = `Prestação de serviços contábeis e assessoria financeira — Parcela nº ${nroParcela} (Vencimento: ${vencimentoStr.split('-').reverse().join('/')}). Emissão automática executada.`

          const notasCol = $app.findCollectionByNameOrId('notas_fiscais')
          const novaNota = new Record(notasCol)

          novaNota.set('user', authRecord.id)
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
          novaNota.set('item_cnae', '6920-6/01')
          novaNota.set('codigo_servico_municipal', '0107')
          novaNota.set('natureza_operacao', '1')
          novaNota.set('valor_servicos', valorParcela)
          novaNota.set('aliquota_iss', aliqIss)
          novaNota.set('valor_iss', valorIss)
          novaNota.set('iss_retido', false)
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
            'NFSe emitida com sucesso via processamento de agendamento.',
          )
          novaNota.set('protocolo_autorizacao', protocoloAutorizacao)
          novaNota.set('agendamento_automatico', true)

          const isJaPago = r.get('status') === 'Pago'
          if (isJaPago) {
            novaNota.set('conciliada', true)
            novaNota.set('conciliada_em', dataEmissaoFormatada)
          } else {
            novaNota.set('conciliada', false)
          }

          $app.save(novaNota)

          r.set('nota_fiscal', novaNota.id)
          r.set('nfse_emitida_em', dataEmissaoFormatada)
          if (isJaPago) {
            r.set('conciliado', true)
            r.set('conciliado_em', dataEmissaoFormatada)
          }
          $app.save(r)

          notasGeradas.push({
            nota_id: novaNota.id,
            numero: proximoNumero,
            recebivel_id: r.id,
            tomador: tomadorRazao,
            valor: valorLiquido,
          })
        } catch (errOne) {
          console.log('[NFSe Processar Agendados] Erro ao emitir uma nota:', errOne)
        }
      }

      return e.json(200, {
        success: true,
        processados: notasGeradas.length,
        message: `${notasGeradas.length} nota(s) fiscal(is) emitida(s) com sucesso a partir dos agendamentos.`,
        notas: notasGeradas,
      })
    } catch (err) {
      console.log('[NFSe Processar Agendados] Erro:', err)
      return e.json(500, {
        success: false,
        message: `Erro ao processar agendamentos de NFSe: ${err.message || err}`,
      })
    }
  },
  $apis.requireAuth(),
)
