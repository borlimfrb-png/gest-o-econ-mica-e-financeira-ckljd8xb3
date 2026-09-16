/**
 * Hook para Gerenciamento Seguro de Certificado Digital A1 (NFS-e Nacional)
 *
 * Fornece endpoints exclusivos para perfil ADMIN:
 * - GET  /api/nfse/certificado?empresa_id=... -> Retorna status e metadados não sensíveis (sem chaves nem senha)
 * - POST /api/nfse/certificado -> Salva certificado (.pfx/.p12) e senha com criptografia segura
 * - DELETE /api/nfse/certificado?empresa_id=... -> Remove com segurança o certificado da empresa
 */

// 1. GET /backend/v1/nfse/certificado
routerAdd(
  'GET',
  '/backend/v1/nfse/certificado',
  (e) => {
    try {
      const authRecord = e.auth
      if (!authRecord) {
        return e.json(401, { success: false, message: 'Usuário não autenticado.' })
      }

      // Validação estrita de perfil: somente Admin
      const role = authRecord.getString('role')
      if (role !== 'admin') {
        return e.json(403, {
          success: false,
          message: 'Acesso restrito. Apenas administradores podem gerenciar o Certificado Digital.',
        })
      }

      const queryInfo = e.requestInfo().query || {}
      const empresaId = queryInfo.empresa_id || ''

      if (!empresaId) {
        return e.json(400, {
          success: false,
          message: 'Identificador da empresa (empresa_id) é obrigatório.',
        })
      }

      // Busca na coleção certificados_digitais via $app
      let certRecord = null
      try {
        certRecord = $app.findFirstRecordByData('certificados_digitais', 'empresa', empresaId)
      } catch (_) {
        certRecord = null
      }

      if (!certRecord) {
        return e.json(200, {
          success: true,
          temCertificado: false,
          dados: null,
          mensagem: 'Nenhum certificado cadastrado — emissão em modo Homologação/Simulação.',
        })
      }

      // Retorna APENAS dados NÃO sensíveis. Chave privada e senha NUNCA são expostas.
      const validadeFim = certRecord.getString('validade_fim')
      let estaExpirado = false
      let diasRestantes = null
      if (validadeFim) {
        try {
          const dtFim = new Date(validadeFim).getTime()
          const dtHoje = new Date().getTime()
          diasRestantes = Math.floor((dtFim - dtHoje) / (1000 * 60 * 60 * 24))
          estaExpirado = diasRestantes < 0
        } catch (_) {}
      }

      return e.json(200, {
        success: true,
        temCertificado: true,
        dados: {
          id: certRecord.id,
          empresa_id: empresaId,
          nome_arquivo: certRecord.getString('nome_arquivo'),
          validade_inicio: certRecord.getString('validade_inicio') || null,
          validade_fim: validadeFim || null,
          titular_nome: certRecord.getString('titular_nome') || null,
          titular_cnpj_cpf: certRecord.getString('titular_cnpj_cpf') || null,
          emissor: certRecord.getString('emissor') || 'ICP-Brasil',
          status: estaExpirado ? 'expirado' : certRecord.getString('status') || 'ativo',
          estaExpirado: estaExpirado,
          diasRestantes: diasRestantes,
          data_upload: certRecord.getString('created'),
          atualizado_em: certRecord.getString('updated'),
        },
      })
    } catch (err) {
      console.log('[Certificado GET] Erro:', err)
      return e.json(500, {
        success: false,
        message: 'Erro interno ao consultar status do certificado digital.',
        error: String(err),
      })
    }
  },
  $apis.requireAuth(),
)

// 2. POST /backend/v1/nfse/certificado
routerAdd(
  'POST',
  '/backend/v1/nfse/certificado',
  (e) => {
    try {
      const authRecord = e.auth
      if (!authRecord) {
        return e.json(401, { success: false, message: 'Usuário não autenticado.' })
      }

      const role = authRecord.getString('role')
      if (role !== 'admin') {
        return e.json(403, {
          success: false,
          message: 'Apenas administradores têm permissão para enviar certificados digitais.',
        })
      }

      const body = e.requestInfo().body || {}
      const empresaId = body.empresa_id
      const nomeArquivo = body.nome_arquivo || ''
      const arquivoBase64 = body.arquivo_base64 || ''
      const senha = body.senha || ''
      const metadados = body.metadados || {}

      if (!empresaId) {
        return e.json(400, {
          success: false,
          message: 'O campo empresa_id é obrigatório.',
        })
      }

      // Validar extensão do arquivo (.pfx ou .p12)
      const nomeLower = (nomeArquivo || '').toLowerCase()
      if (!nomeLower.endsWith('.pfx') && !nomeLower.endsWith('.p12')) {
        return e.json(400, {
          success: false,
          message: 'Extensão inválida. O certificado deve ser um arquivo .pfx ou .p12.',
        })
      }

      if (!arquivoBase64) {
        return e.json(400, {
          success: false,
          message: 'O arquivo binário do certificado não foi fornecido.',
        })
      }

      // Validar tamanho máximo (máx. 100KB — o base64 terá até ~135KB)
      if (arquivoBase64.length > 200000) {
        return e.json(400, {
          success: false,
          message: 'Tamanho do arquivo excede o limite permitido (máximo 100KB).',
        })
      }

      if (!senha) {
        return e.json(400, {
          success: false,
          message: 'A senha do certificado digital é obrigatória.',
        })
      }

      // Verificar se a empresa existe
      let empresaRecord = null
      try {
        empresaRecord = $app.findRecordById('empresas', empresaId)
      } catch (_) {
        return e.json(404, {
          success: false,
          message: 'Empresa selecionada não foi encontrada.',
        })
      }

      // Chave de criptografia interna derivada do token de segurança da plataforma
      // ou chave simétrica segura de 32 bytes
      const secretKey =
        $os.getenv('PB_SUPERUSER_TOKEN') ||
        $os.getenv('SKIP_AI_GATEWAY_API_KEY') ||
        'skip-cloud-nfse-cert-vault-32bytes-k'

      const senhaCriptografada = $security.encrypt(senha, secretKey)
      const pfxCriptografado = $security.encrypt(arquivoBase64, secretKey)

      // Extração de metadados fornecidos ou padrão
      const validadeFim = metadados.validade_fim || null
      const validadeInicio = metadados.validade_inicio || null
      const titularNome = metadados.titular_nome || empresaRecord.getString('nome') || ''
      const titularCnpjCpf = metadados.titular_cnpj_cpf || empresaRecord.getString('cnpj') || ''
      const emissor = metadados.emissor || 'ICP-Brasil (A1)'

      // Verifica se já existe registro prévio da empresa (atualiza ou cria novo)
      let certRecord = null
      let isNovo = false
      try {
        certRecord = $app.findFirstRecordByData('certificados_digitais', 'empresa', empresaId)
      } catch (_) {
        const certCol = $app.findCollectionByNameOrId('certificados_digitais')
        certRecord = new Record(certCol)
        certRecord.set('empresa', empresaId)
        isNovo = true
      }

      certRecord.set('user', authRecord.id)
      certRecord.set('nome_arquivo', nomeArquivo)
      certRecord.set('senha_criptografada', senhaCriptografada)
      certRecord.set('pfx_base64_criptografado', pfxCriptografado)
      certRecord.set('status', 'ativo')
      if (validadeFim) certRecord.set('validade_fim', validadeFim)
      if (validadeInicio) certRecord.set('validade_inicio', validadeInicio)
      if (titularNome) certRecord.set('titular_nome', titularNome)
      if (titularCnpjCpf) certRecord.set('titular_cnpj_cpf', titularCnpjCpf)
      if (emissor) certRecord.set('emissor', emissor)

      $app.save(certRecord)

      // Registrar auditoria do cadastro de segurança
      try {
        const auditCol = $app.findCollectionByNameOrId('auditoria_cadastros')
        if (auditCol) {
          const audit = new Record(auditCol, {
            empresa: empresaId,
            user: authRecord.id,
            usuario_nome:
              authRecord.getString('name') || authRecord.getString('email') || 'Administrador',
            usuario_email: authRecord.getString('email') || '',
            entidade: 'certificado_digital',
            registro_id: certRecord.id,
            acao: isNovo ? 'criacao' : 'edicao',
            registro_descricao: `Certificado Digital A1 (${nomeArquivo}) ${isNovo ? 'cadastrado' : 'atualizado'} para a empresa ${empresaRecord.getString('nome')}`,
            detalhes: JSON.stringify({
              nome_arquivo: nomeArquivo,
              validade_fim: validadeFim,
              titular: titularNome,
              acao: isNovo ? 'upload_inicial' : 'substituicao_certificado',
              seguranca: 'Armazenado com criptografia em cofre restrito a superusers',
            }),
          })
          $app.save(audit)
        }
      } catch (auditErr) {
        console.log('[Certificado POST] Erro ao registrar auditoria:', auditErr)
      }

      return e.json(200, {
        success: true,
        message: 'Certificado Digital A1 gravado com segurança com sucesso.',
        dados: {
          id: certRecord.id,
          empresa_id: empresaId,
          nome_arquivo: nomeArquivo,
          validade_fim: validadeFim,
          titular_nome: titularNome,
          titular_cnpj_cpf: titularCnpjCpf,
          status: 'ativo',
          data_upload: new Date().toISOString(),
        },
      })
    } catch (err) {
      console.log('[Certificado POST] Erro:', err)
      return e.json(500, {
        success: false,
        message: 'Falha ao salvar o certificado digital: ' + (err.message || String(err)),
      })
    }
  },
  $apis.requireAuth(),
)

// 3. DELETE /backend/v1/nfse/certificado
routerAdd(
  'DELETE',
  '/backend/v1/nfse/certificado',
  (e) => {
    try {
      const authRecord = e.auth
      if (!authRecord) {
        return e.json(401, { success: false, message: 'Usuário não autenticado.' })
      }

      const role = authRecord.getString('role')
      if (role !== 'admin') {
        return e.json(403, {
          success: false,
          message: 'Apenas administradores podem remover o certificado digital.',
        })
      }

      const queryInfo = e.requestInfo().query || {}
      const body = e.requestInfo().body || {}
      const empresaId = queryInfo.empresa_id || body.empresa_id

      if (!empresaId) {
        return e.json(400, {
          success: false,
          message: 'Identificador da empresa (empresa_id) é obrigatório.',
        })
      }

      let certRecord = null
      try {
        certRecord = $app.findFirstRecordByData('certificados_digitais', 'empresa', empresaId)
      } catch (_) {
        return e.json(404, {
          success: false,
          message: 'Nenhum certificado cadastrado para esta empresa.',
        })
      }

      const nomeArquivo = certRecord.getString('nome_arquivo')
      $app.delete(certRecord)

      // Registrar auditoria
      try {
        const auditCol = $app.findCollectionByNameOrId('auditoria_cadastros')
        if (auditCol) {
          const audit = new Record(auditCol, {
            empresa: empresaId,
            user: authRecord.id,
            usuario_nome:
              authRecord.getString('name') || authRecord.getString('email') || 'Administrador',
            usuario_email: authRecord.getString('email') || '',
            entidade: 'certificado_digital',
            registro_id: empresaId,
            acao: 'exclusao',
            registro_descricao: `Certificado Digital A1 (${nomeArquivo}) removido da empresa`,
            detalhes: JSON.stringify({
              nome_arquivo_removido: nomeArquivo,
              data_remocao: new Date().toISOString(),
            }),
          })
          $app.save(audit)
        }
      } catch (auditErr) {
        console.log('[Certificado DELETE] Erro na auditoria:', auditErr)
      }

      return e.json(200, {
        success: true,
        message: 'Certificado digital removido com sucesso.',
      })
    } catch (err) {
      console.log('[Certificado DELETE] Erro:', err)
      return e.json(500, {
        success: false,
        message: 'Falha ao excluir o certificado digital: ' + (err.message || String(err)),
      })
    }
  },
  $apis.requireAuth(),
)
