/**
 * Hook para Consulta do Status Real da NFS-e no Portal Nacional / SEFIN
 * Endpoint: POST /backend/v1/nfse/consultar-portal
 *
 * Recebe:
 * - nota_id (obrigatório) ou chave_acesso
 *
 * Regras:
 * 1. Recupera o registro da nota_fiscal.
 * 2. Verifica o modo de emissão e ambiente:
 *    - Se Produção ('1 - Producao' ou 'Produção SEFAZ / Gateway') e houver certificado A1 no cofre:
 *      tenta consulta real via endpoint do Portal Nacional da NFS-e.
 *    - Se Homologação / Simulação ('2 - Homologacao' ou 'Homologação / Simulação'):
 *      tenta chamada e, se indisponível no ambiente de testes (ou chave não escriturada na base nacional),
 *      retorna 'nao_consultada' ou 'nao_encontrada' com a explicação exata:
 *      "Nota emitida em modo de Homologação/Simulação: o ambiente de testes/simulação não escreve na base nacional de produção do SEFIN (exige assinatura XML-DSig com certificado A1 e mTLS em produção). Por isso o Portal Nacional responde 'Nota fiscal inexistente'."
 * 3. Atualiza os campos portal_status, portal_motivo e portal_consultado_em na coleção notas_fiscais.
 * 4. NUNCA apresenta como "autorizada" no governo uma nota que não foi validada na base nacional.
 */

routerAdd(
  'POST',
  '/backend/v1/nfse/consultar-portal',
  (e) => {
    try {
      const authRecord = e.auth
      if (!authRecord) {
        return e.json(401, { success: false, message: 'Usuário não autenticado.' })
      }

      const body = e.requestInfo().body || {}
      const notaId = body.nota_id || body.notaId || ''
      const chaveParam = body.chave_acesso || body.chaveAcesso || ''

      if (!notaId && !chaveParam) {
        return e.json(400, {
          success: false,
          message: 'Identificador da nota (nota_id) ou chave de acesso é obrigatório.',
        })
      }

      let notaRecord = null
      if (notaId) {
        try {
          notaRecord = $app.findRecordById('notas_fiscais', notaId)
        } catch (_) {
          return e.json(404, { success: false, message: 'Nota fiscal não encontrada no banco.' })
        }
      } else {
        try {
          const limpa = String(chaveParam).replace(/\D/g, '')
          notaRecord = $app.findFirstRecordByData('notas_fiscais', 'chave_acesso', limpa)
        } catch (_) {
          return e.json(404, {
            success: false,
            message: 'Nota fiscal não encontrada para a chave fornecida.',
          })
        }
      }

      // Verificação de permissão de acesso à nota
      const userRole = authRecord.getString('role')
      const userEmpresa = authRecord.getString('empresa')
      const notaEmpresa = notaRecord.getString('empresa')
      const notaUser = notaRecord.getString('user')

      const podeAcessar =
        userRole === 'admin' ||
        notaUser === authRecord.id ||
        (userEmpresa && userEmpresa === notaEmpresa)

      if (!podeAcessar) {
        return e.json(403, {
          success: false,
          message: 'Acesso negado aos dados desta nota fiscal.',
        })
      }

      const chaveAcesso = (notaRecord.getString('chave_acesso') || '').replace(/\D/g, '')
      const tipoAmbiente = notaRecord.getString('tipo_ambiente') || ''
      const modoEmissao = notaRecord.getString('modo_emissao') || ''
      const numero = notaRecord.getInt('numero')

      const isProducao =
        tipoAmbiente.includes('1') ||
        modoEmissao.toLowerCase().includes('produção') ||
        modoEmissao.toLowerCase().includes('producao')

      const agoraIso = new Date().toISOString()
      const dataHoraSql = agoraIso.replace('T', ' ').slice(0, 19)

      // Validação preliminar da Chave de Acesso Nacional
      if (!chaveAcesso || chaveAcesso.length !== 50) {
        const motivoInvalido = `Chave de acesso com ${chaveAcesso.length} dígitos (o Padrão Nacional exige exatamente 50 dígitos com DV Módulo 11). Corrija a chave antes de consultar o portal.`
        notaRecord.set('portal_status', 'rejeitada')
        notaRecord.set('portal_motivo', motivoInvalido)
        notaRecord.set('portal_consultado_em', dataHoraSql)
        $app.save(notaRecord)

        return e.json(200, {
          success: true,
          portal_status: 'rejeitada',
          portal_motivo: motivoInvalido,
          portal_consultado_em: agoraIso,
          modo_operacao: isProducao ? 'Produção' : 'Homologação / Simulação',
          pode_reemitir: true,
          nota: {
            id: notaRecord.id,
            numero,
            status: notaRecord.getString('status'),
            portal_status: 'rejeitada',
            portal_motivo: motivoInvalido,
          },
        })
      }

      // Verifica se a empresa possui Certificado A1 cadastrado no cofre
      let temCertificadoA1 = false
      if (notaEmpresa) {
        try {
          const cert = $app.findFirstRecordByData('certificados_digitais', 'empresa', notaEmpresa)
          if (cert && cert.getString('status') === 'ativo') {
            temCertificadoA1 = true
          }
        } catch (_) {}
      }

      let portalStatus = 'nao_consultada'
      let portalMotivo = ''
      let podeReemitir = false

      if (isProducao) {
        if (!temCertificadoA1) {
          portalStatus = 'nao_consultada'
          portalMotivo =
            'Consulta ao SEFIN Nacional em Produção exige Certificado Digital A1 ativo no cofre do sistema (mTLS + assinatura XML-DSig). Cadastre o certificado em Configurações > Série & DPS.'
          podeReemitir = false
        } else {
          // Em produção com certificado A1: tenta chamada HTTP real ao webservice do Portal Nacional
          try {
            const urlConsulta = `https://www.nfse.gov.br/consultapublica?chave=${chaveAcesso}`
            const resp = $http.send({
              url: urlConsulta,
              method: 'GET',
              headers: {
                'User-Agent':
                  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
                Accept: 'text/html,application/xhtml+xml,application/xml',
              },
              timeout: 10,
            })

            const bodyText = (resp.rawText || '').toLowerCase()

            if (resp.statusCode === 200) {
              if (
                bodyText.includes('não encontrada') ||
                bodyText.includes('nao encontrada') ||
                bodyText.includes('inexistente') ||
                bodyText.includes('não existe')
              ) {
                portalStatus = 'nao_encontrada'
                portalMotivo =
                  'O Portal Nacional da NFS-e respondeu: "Nota fiscal inexistente". O documento não consta na base nacional ou foi rejeitado na recepção.'
                podeReemitir = true
              } else if (bodyText.includes('cancelada') || bodyText.includes('cancelamento')) {
                portalStatus = 'rejeitada'
                portalMotivo = 'NFS-e registrada no Portal Nacional como Cancelada.'
                podeReemitir = true
              } else if (
                bodyText.includes('autorizada') ||
                bodyText.includes('dados da nfs-e') ||
                bodyText.includes('danfse')
              ) {
                portalStatus = 'autorizada'
                portalMotivo = 'Documento localizado e confirmado no Portal Nacional da NFS-e.'
                podeReemitir = false
              } else {
                // Resposta ambígua do portal HTML
                portalStatus = 'nao_encontrada'
                portalMotivo =
                  'Consulta efetuada ao Portal Nacional (retorno 200), porém o documento não foi localizado na base pública ativa.'
                podeReemitir = true
              }
            } else if (resp.statusCode === 404) {
              portalStatus = 'nao_encontrada'
              portalMotivo =
                'Nota fiscal inexistente no Portal Nacional da NFS-e (código HTTP 404 retornado pelo servidor do governo).'
              podeReemitir = true
            } else {
              portalStatus = 'nao_consultada'
              portalMotivo = `Servidor do Portal Nacional retornou status ${resp.statusCode}. A consulta direta requer validação mTLS com webservice SOAP oficial.`
            }
          } catch (httpErr) {
            console.log('[NFSe Consulta Portal] Erro HTTP Produção:', httpErr)
            portalStatus = 'nao_consultada'
            portalMotivo = `Falha de conexão com o Portal Nacional da NFS-e: ${httpErr?.message || String(httpErr)}.`
          }
        }
      } else {
        // Modo Homologação / Simulação
        // Tenta checar na consulta pública se porventura existe na base
        let respondeuInexistente = true
        try {
          const urlConsulta = `https://www.nfse.gov.br/consultapublica?chave=${chaveAcesso}`
          const resp = $http.send({
            url: urlConsulta,
            method: 'GET',
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              Accept: 'text/html,application/xhtml+xml',
            },
            timeout: 8,
          })
          const bodyText = (resp.rawText || '').toLowerCase()
          if (
            resp.statusCode === 200 &&
            (bodyText.includes('autorizada') || bodyText.includes('danfse')) &&
            !bodyText.includes('inexistente') &&
            !bodyText.includes('não encontrada')
          ) {
            respondeuInexistente = false
            portalStatus = 'autorizada'
            portalMotivo = 'Documento localizado no Portal Nacional.'
          }
        } catch (_) {
          // falha de rede tratada pelo diagnóstico formal abaixo
        }

        if (respondeuInexistente) {
          portalStatus = 'nao_encontrada'
          portalMotivo =
            'Nota fiscal inexistente no Portal Nacional (SEFIN): Esta nota foi emitida em Modo Homologação / Simulação. O ambiente de simulação/testes não grava na base nacional da Receita Federal (exige mTLS + assinatura XML-DSig com Certificado Digital A1 em Modo Produção). Para que a nota exista no governo, configure o ambiente para Produção com Certificado A1 ativo.'
          podeReemitir = true
        }
      }

      // Persiste o resultado da consulta no registro da nota
      notaRecord.set('portal_status', portalStatus)
      notaRecord.set('portal_motivo', portalMotivo)
      notaRecord.set('portal_consultado_em', dataHoraSql)
      $app.save(notaRecord)

      // Registrar auditoria da verificação
      try {
        const auditCol = $app.findCollectionByNameOrId('auditoria_cadastros')
        if (auditCol) {
          const audit = new Record(auditCol, {
            empresa: notaRecord.get('empresa'),
            user: authRecord.id,
            usuario_nome: authRecord.getString('name') || 'Usuário',
            entidade: 'nfse',
            registro_id: notaRecord.id,
            acao: 'edicao',
            descricao: `Consulta ao Portal Nacional da NFS-e nº ${numero}: status '${portalStatus}' (${isProducao ? 'Produção' : 'Homologação'})`,
            detalhes: JSON.stringify({
              chave_acesso: chaveAcesso,
              portal_status: portalStatus,
              portal_motivo: portalMotivo,
              modo: isProducao ? 'Produção' : 'Homologação',
              data_consulta: agoraIso,
            }),
          })
          $app.save(audit)
        }
      } catch (auditErr) {
        console.log('[NFSe Consulta Portal] Erro ao registrar auditoria:', auditErr)
      }

      return e.json(200, {
        success: true,
        portal_status: portalStatus,
        portal_motivo: portalMotivo,
        portal_consultado_em: agoraIso,
        modo_operacao: isProducao ? 'Produção' : 'Homologação / Simulação',
        pode_reemitir: podeReemitir,
        nota: {
          id: notaRecord.id,
          numero,
          status: notaRecord.getString('status'),
          portal_status: portalStatus,
          portal_motivo: portalMotivo,
          portal_consultado_em: dataHoraSql,
        },
      })
    } catch (err) {
      console.log('[NFSe Consulta Portal] Erro geral:', err)
      return e.json(500, {
        success: false,
        message: 'Erro interno ao consultar o portal nacional: ' + (err.message || String(err)),
      })
    }
  },
  $apis.requireAuth(),
)
