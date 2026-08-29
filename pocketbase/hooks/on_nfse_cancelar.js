/**
 * Endpoint server-side para cancelamento de NFSe via Gateway ou Simulação ABRASF.
 * POST /api/nfse/cancelar
 * Body: { notaId: string, motivo: string, codigoCancelamento?: string }
 */
routerAdd('POST', '/api/nfse/cancelar', (e) => {
  const authRecord = e.auth
  if (!authRecord) {
    return e.json(401, { success: false, error: 'Usuário não autenticado' })
  }

  let body = {}
  try {
    body = e.requestInfo().body || {}
  } catch (_) {
    try {
      body = JSON.parse(e.request().body || '{}')
    } catch (err) {
      return e.json(400, { success: false, error: 'Corpo da requisição inválido' })
    }
  }

  const { notaId, motivo, codigoCancelamento } = body
  if (!notaId) {
    return e.json(400, { success: false, error: 'ID da nota fiscal não informado' })
  }
  if (!motivo || !motivo.trim()) {
    return e.json(400, { success: false, error: 'O motivo do cancelamento é obrigatório.' })
  }

  let nota
  try {
    nota = $app.findRecordById('notas_fiscais', notaId)
  } catch (err) {
    return e.json(404, { success: false, error: 'Nota fiscal não encontrada' })
  }

  // Verifica permissão do usuário
  if (nota.get('user') !== authRecord.id) {
    return e.json(403, {
      success: false,
      error: 'Você não tem permissão para cancelar esta nota fiscal',
    })
  }

  const statusAtual = nota.get('status')
  if (statusAtual === 'Cancelada') {
    return e.json(400, { success: false, error: 'Esta nota fiscal já está cancelada.' })
  }
  if (statusAtual === 'Rascunho') {
    return e.json(400, {
      success: false,
      error:
        'Notas em status Rascunho não precisam de cancelamento via gateway. Podem ser excluídas ou editadas.',
    })
  }

  const numeroNota = nota.get('numero')
  const codVerif = nota.get('codigo_verificacao') || 'AUT-VERIF'
  const chaveAcesso = nota.get('chave_acesso') || ''
  const cnpjPrestador = (nota.get('prestador_cnpj') || '').replace(/\D/g, '')
  const cnpjTomador = (nota.get('tomador_cnpj') || '').replace(/\D/g, '')
  const valorServicos = nota.get('valor_servicos') || 0
  const codCancelamentoAbrasf = codigoCancelamento || '1' // 1 = Erro na emissão, 2 = Serviço não prestado, 3 = Duplicidade

  const gatewayUrl = $os.getenv('NFSE_GATEWAY_URL')
  const gatewayApiKey = $os.getenv('NFSE_API_KEY')
  const gatewayToken = $os.getenv('NFSE_API_TOKEN')

  const canceladaEm = new Date().toISOString()
  let protocoloCancelamento = ''
  let gatewayResposta = ''
  let modoEmissao = nota.get('modo_emissao') || 'Homologação / Simulação'
  let xmlCancelamento = ''

  if (gatewayUrl && (gatewayApiKey || gatewayToken)) {
    // Modo Gateway Real
    try {
      const resp = $http.send({
        url: `${gatewayUrl}/nfse/cancelar`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${gatewayToken || gatewayApiKey}`,
          'X-API-Key': gatewayApiKey || '',
        },
        body: JSON.stringify({
          numero: numeroNota,
          codigo_verificacao: codVerif,
          chave_acesso: chaveAcesso,
          cnpj_prestador: cnpjPrestador,
          motivo: motivo.trim(),
          codigo_cancelamento: codCancelamentoAbrasf,
          data_cancelamento: canceladaEm,
        }),
        timeout: 25,
      })

      if (resp.statusCode >= 200 && resp.statusCode < 300) {
        const data = resp.json || {}
        protocoloCancelamento =
          data.protocolo_cancelamento || data.protocolo || `CAN-GW-${Date.now()}`
        gatewayResposta = data.mensagem || 'Cancelamento homologado com sucesso pelo gateway/SEFAZ.'
        xmlCancelamento = data.xml_cancelamento || ''
        modoEmissao = 'Produção SEFAZ / Gateway'
      } else {
        const errData = resp.json || {}
        return e.json(400, {
          success: false,
          error: `Erro retornado pelo Gateway NFSe (${resp.statusCode}): ${errData.mensagem || errData.error || resp.raw}`,
        })
      }
    } catch (gwErr) {
      return e.json(502, {
        success: false,
        error: `Falha na comunicação com o Gateway NFSe: ${gwErr.message || gwErr}`,
      })
    }
  } else {
    // Modo Simulação / Homologação Padrão ABRASF v2.03
    protocoloCancelamento = `CAN-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`
    gatewayResposta =
      'Cancelamento processado e homologado no ambiente de homologação/simulação ABRASF v2.03.'
    modoEmissao = 'Homologação / Simulação'

    // Gera XML de cancelamento ABRASF
    xmlCancelamento = `<?xml version="1.0" encoding="UTF-8"?>
<CancelarNfseEnvio xmlns="http://www.abrasf.org.br/nfse.xsd">
  <Pedido>
    <InfPedidoCancelamento Id="CAN_NFSE_${numeroNota}">
      <IdentificacaoNfse>
        <Numero>${numeroNota}</Numero>
        <CpfCnpj><Cnpj>${cnpjPrestador}</Cnpj></CpfCnpj>
        <InscricaoMunicipal>${nota.get('prestador_inscricao_municipal') || 'ISENTO'}</InscricaoMunicipal>
        <CodigoMunicipio>3550308</CodigoMunicipio>
      </IdentificacaoNfse>
      <CodigoCancelamento>${codCancelamentoAbrasf}</CodigoCancelamento>
      <MotivoCancelamento><![CDATA[${motivo.trim()}]]></MotivoCancelamento>
    </InfPedidoCancelamento>
  </Pedido>
  <RetornoCancelamento>
    <DataHora>${canceladaEm}</DataHora>
    <Protocolo>${protocoloCancelamento}</Protocolo>
    <Sucesso>true</Sucesso>
  </RetornoCancelamento>
</CancelarNfseEnvio>`
  }

  // Atualiza a nota fiscal no banco
  nota.set('status', 'Cancelada')
  nota.set('motivo_cancelamento', motivo.trim())
  nota.set('cancelada_em', canceladaEm.replace('T', ' ').slice(0, 19))
  nota.set('protocolo_cancelamento', protocoloCancelamento)
  nota.set('gateway_status_resposta', gatewayResposta)
  if (xmlCancelamento) {
    nota.set('xml_cancelamento', xmlCancelamento)
  }

  $app.save(nota)

  return e.json(200, {
    success: true,
    message: 'Nota fiscal cancelada com sucesso!',
    nota: {
      id: nota.id,
      numero: nota.get('numero'),
      status: 'Cancelada',
      motivo_cancelamento: motivo.trim(),
      cancelada_em: canceladaEm,
      protocolo_cancelamento: protocoloCancelamento,
      gateway_status_resposta: gatewayResposta,
      modo_emissao: modoEmissao,
    },
  })
})
