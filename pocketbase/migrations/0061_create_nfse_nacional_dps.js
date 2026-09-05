migrate(
  (app) => {
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    const empresasCol = app.findCollectionByNameOrId('empresas')

    // 1. Criar coleção 'nfse_tomadores' para cadastro completo e persistente de tomadores de serviços
    let tomadoresCol
    try {
      tomadoresCol = app.findCollectionByNameOrId('nfse_tomadores')
    } catch (_) {
      tomadoresCol = new Collection({
        name: 'nfse_tomadores',
        type: 'base',
        listRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || empresa = @request.auth.empresa)",
        viewRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || empresa = @request.auth.empresa)",
        createRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.body.empresa = @request.auth.empresa)",
        updateRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || empresa = @request.auth.empresa)",
        deleteRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || empresa = @request.auth.empresa)",
        fields: [
          {
            name: 'user',
            type: 'relation',
            required: false,
            collectionId: usersCol.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'empresa',
            type: 'relation',
            required: false,
            collectionId: empresasCol.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'tipo_pessoa',
            type: 'select',
            required: true,
            values: ['PJ', 'PF', 'Exterior'],
            maxSelect: 1,
          },
          {
            name: 'cpf_cnpj',
            type: 'text',
            required: true,
          },
          {
            name: 'razao_social',
            type: 'text',
            required: true,
          },
          {
            name: 'nome_fantasia',
            type: 'text',
          },
          {
            name: 'inscricao_municipal',
            type: 'text',
          },
          {
            name: 'inscricao_estadual',
            type: 'text',
          },
          {
            name: 'email',
            type: 'email',
          },
          {
            name: 'telefone',
            type: 'text',
          },
          {
            name: 'cep',
            type: 'text',
          },
          {
            name: 'logradouro',
            type: 'text',
          },
          {
            name: 'numero',
            type: 'text',
          },
          {
            name: 'complemento',
            type: 'text',
          },
          {
            name: 'bairro',
            type: 'text',
          },
          {
            name: 'codigo_municipio',
            type: 'text', // IBGE 7 dígitos
          },
          {
            name: 'cidade',
            type: 'text',
          },
          {
            name: 'estado',
            type: 'text',
          },
          {
            name: 'observacoes',
            type: 'text',
          },
          {
            name: 'ativo',
            type: 'bool',
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
          'CREATE INDEX idx_tomadores_empresa ON nfse_tomadores (empresa)',
          'CREATE INDEX idx_tomadores_cpf_cnpj ON nfse_tomadores (cpf_cnpj)',
          'CREATE INDEX idx_tomadores_user ON nfse_tomadores (user)',
        ],
      })
      app.save(tomadoresCol)
    }

    // 2. Expandir coleção 'notas_fiscais' com os campos do Novo Padrão Nacional NFS-e / DPS
    const notasCol = app.findCollectionByNameOrId('notas_fiscais')

    if (!notasCol.fields.getByName('padrao_nacional')) {
      notasCol.fields.add(
        new BoolField({
          name: 'padrao_nacional',
        }),
      )
    }

    if (!notasCol.fields.getByName('dps_serie')) {
      notasCol.fields.add(
        new TextField({
          name: 'dps_serie',
        }),
      )
    }

    if (!notasCol.fields.getByName('dps_numero')) {
      notasCol.fields.add(
        new NumberField({
          name: 'dps_numero',
          onlyInt: true,
        }),
      )
    }

    if (!notasCol.fields.getByName('dps_id')) {
      notasCol.fields.add(
        new TextField({
          name: 'dps_id',
        }),
      )
    }

    if (!notasCol.fields.getByName('dps_payload')) {
      notasCol.fields.add(
        new JSONField({
          name: 'dps_payload',
        }),
      )
    }

    if (!notasCol.fields.getByName('servicos_itens')) {
      notasCol.fields.add(
        new JSONField({
          name: 'servicos_itens',
        }),
      )
    }

    if (!notasCol.fields.getByName('codigo_tributacao_nacional')) {
      notasCol.fields.add(
        new TextField({
          name: 'codigo_tributacao_nacional',
        }),
      )
    }

    if (!notasCol.fields.getByName('codigo_municipio_prestacao')) {
      notasCol.fields.add(
        new TextField({
          name: 'codigo_municipio_prestacao',
        }),
      )
    }

    if (!notasCol.fields.getByName('tipo_ambiente')) {
      notasCol.fields.add(
        new SelectField({
          name: 'tipo_ambiente',
          values: ['1 - Producao', '2 - Homologacao'],
          maxSelect: 1,
        }),
      )
    }

    if (!notasCol.fields.getByName('tomador_ref')) {
      notasCol.fields.add(
        new RelationField({
          name: 'tomador_ref',
          collectionId: tomadoresCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        }),
      )
    }

    app.save(notasCol)

    // 3. Atualizar valores permitidos do campo 'entidade' em auditoria_cadastros para incluir 'nfse' e 'nfse_tomadores'
    try {
      const auditCol = app.findCollectionByNameOrId('auditoria_cadastros')
      const entidadeField = auditCol.fields.getByName('entidade')
      if (entidadeField) {
        entidadeField.values = ['empresas', 'plano_contas', 'users', 'nfse', 'nfse_tomadores']
        app.save(auditCol)
      }
    } catch (err) {
      console.log('Aviso ao atualizar entidade de auditoria_cadastros:', err)
    }
  },
  (app) => {
    try {
      const tomadoresCol = app.findCollectionByNameOrId('nfse_tomadores')
      app.delete(tomadoresCol)
    } catch (_) {}
  },
)
