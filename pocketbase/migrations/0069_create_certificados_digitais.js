/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    const empresasCol = app.findCollectionByNameOrId('empresas')

    // Criar coleção segura 'certificados_digitais'
    // Acesso estritamente restrito: null nas regras públicas/padrão
    // Acesso exclusivamente programático ou por superusers/hooks server-side ($app)
    let certCol
    try {
      certCol = app.findCollectionByNameOrId('certificados_digitais')
    } catch (_) {
      certCol = new Collection({
        name: 'certificados_digitais',
        type: 'base',
        // Regras totalmente fechadas: somente superuser ou chamadas internas via $app
        // Impedindo listagem, download ou acesso direto por endpoints de API padrão
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          {
            name: 'empresa',
            type: 'relation',
            required: true,
            collectionId: empresasCol.id,
            cascadeDelete: true,
            maxSelect: 1,
          },
          {
            name: 'user',
            type: 'relation',
            required: false,
            collectionId: usersCol.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'nome_arquivo',
            type: 'text',
            required: true,
          },
          {
            name: 'arquivo_pfx',
            type: 'file',
            required: false,
            maxSelect: 1,
            maxSize: 1048576, // 1MB (certificados A1 costumam ter 5KB a 50KB)
            protected: true, // Arquivo protegido
          },
          {
            name: 'pfx_base64_criptografado',
            type: 'text',
            required: false,
          },
          {
            name: 'senha_criptografada',
            type: 'text',
            required: false,
          },
          {
            name: 'validade_fim',
            type: 'date',
            required: false,
          },
          {
            name: 'validade_inicio',
            type: 'date',
            required: false,
          },
          {
            name: 'titular_nome',
            type: 'text',
            required: false,
          },
          {
            name: 'titular_cnpj_cpf',
            type: 'text',
            required: false,
          },
          {
            name: 'emissor',
            type: 'text',
            required: false,
          },
          {
            name: 'status',
            type: 'select',
            required: true,
            values: ['ativo', 'expirado', 'revogado'],
            maxSelect: 1,
          },
          {
            name: 'created',
            type: 'autodate',
            onCreate: true,
            onUpdate: false,
          },
          {
            name: 'updated',
            type: 'autodate',
            onCreate: true,
            onUpdate: true,
          },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_certificados_empresa ON certificados_digitais (empresa)',
          'CREATE INDEX idx_certificados_status ON certificados_digitais (status)',
        ],
      })
      app.save(certCol)
    }

    // Atualizar entidade de auditoria_cadastros para suportar 'certificado_digital'
    try {
      const auditCol = app.findCollectionByNameOrId('auditoria_cadastros')
      const entidadeField = auditCol.fields.getByName('entidade')
      if (entidadeField) {
        entidadeField.values = [
          'empresas',
          'plano_contas',
          'users',
          'nfse',
          'nfse_tomadores',
          'certificado_digital',
        ]
        app.save(auditCol)
      }
    } catch (auditErr) {
      console.log('Aviso ao atualizar entidade de auditoria_cadastros:', auditErr)
    }
  },
  (app) => {
    try {
      const certCol = app.findCollectionByNameOrId('certificados_digitais')
      app.delete(certCol)
    } catch (_) {}
  },
)
