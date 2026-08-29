migrate(
  (app) => {
    // 1. Adicionar campo emitir_nota_fiscal na collection empresas
    const empresasCol = app.findCollectionByNameOrId('empresas')
    if (!empresasCol.fields.getByName('emitir_nota_fiscal')) {
      empresasCol.fields.add(
        new BoolField({
          name: 'emitir_nota_fiscal',
          required: false,
        }),
      )
      app.save(empresasCol)
    }

    // 2. Criar collection notas_fiscais
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    const empresas = app.findCollectionByNameOrId('empresas')

    try {
      app.findCollectionByNameOrId('notas_fiscais')
      return // Se já existir por qualquer motivo
    } catch (_) {}

    let contratosId = ''
    try {
      const contratosCol = app.findCollectionByNameOrId('contratos')
      contratosId = contratosCol.id
    } catch (_) {}

    const fields = [
      {
        name: 'user',
        type: 'relation',
        required: true,
        collectionId: users.id,
        cascadeDelete: true,
        maxSelect: 1,
      },
      {
        name: 'empresa',
        type: 'relation',
        required: true,
        collectionId: empresas.id,
        cascadeDelete: false,
        maxSelect: 1,
      },
      {
        name: 'numero',
        type: 'number',
        required: true,
      },
      {
        name: 'serie',
        type: 'text',
        required: false,
      },
      {
        name: 'codigo_verificacao',
        type: 'text',
        required: false,
      },
      {
        name: 'chave_acesso',
        type: 'text',
        required: false,
      },
      {
        name: 'status',
        type: 'select',
        required: true,
        values: ['Rascunho', 'Emitida', 'Enviada', 'Cancelada', 'Erro'],
        maxSelect: 1,
      },
      {
        name: 'data_emissao',
        type: 'date',
        required: true,
      },
      {
        name: 'competencia',
        type: 'date',
        required: false,
      },
      {
        name: 'vencimento',
        type: 'date',
        required: false,
      },
      {
        name: 'discriminacao',
        type: 'text',
        required: true,
      },
      {
        name: 'item_cnae',
        type: 'text',
        required: false,
      },
      {
        name: 'codigo_servico_municipal',
        type: 'text',
        required: false,
      },
      {
        name: 'natureza_operacao',
        type: 'text',
        required: false,
      },
      {
        name: 'valor_servicos',
        type: 'number',
        required: true,
      },
      {
        name: 'aliquota_iss',
        type: 'number',
        required: false,
      },
      {
        name: 'valor_iss',
        type: 'number',
        required: false,
      },
      {
        name: 'iss_retido',
        type: 'bool',
        required: false,
      },
      {
        name: 'valor_pis',
        type: 'number',
        required: false,
      },
      {
        name: 'valor_cofins',
        type: 'number',
        required: false,
      },
      {
        name: 'valor_inss',
        type: 'number',
        required: false,
      },
      {
        name: 'valor_ir',
        type: 'number',
        required: false,
      },
      {
        name: 'valor_csll',
        type: 'number',
        required: false,
      },
      {
        name: 'outras_retencoes',
        type: 'number',
        required: false,
      },
      {
        name: 'desconto_incondicionado',
        type: 'number',
        required: false,
      },
      {
        name: 'valor_liquido',
        type: 'number',
        required: true,
      },
      {
        name: 'prestador_cnpj',
        type: 'text',
        required: false,
      },
      {
        name: 'prestador_razao_social',
        type: 'text',
        required: false,
      },
      {
        name: 'prestador_inscricao_municipal',
        type: 'text',
        required: false,
      },
      {
        name: 'tomador_cnpj',
        type: 'text',
        required: false,
      },
      {
        name: 'tomador_razao_social',
        type: 'text',
        required: false,
      },
      {
        name: 'tomador_email',
        type: 'text',
        required: false,
      },
      {
        name: 'modo_emissao',
        type: 'select',
        required: false,
        values: ['Homologação / Simulação', 'Produção SEFAZ / Gateway'],
        maxSelect: 1,
      },
      {
        name: 'gateway_status_resposta',
        type: 'text',
        required: false,
      },
      {
        name: 'protocolo_autorizacao',
        type: 'text',
        required: false,
      },
      {
        name: 'xml_conteudo',
        type: 'text',
        required: false,
      },
      {
        name: 'email_enviado_em',
        type: 'date',
        required: false,
      },
      {
        name: 'email_destinatario',
        type: 'text',
        required: false,
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
    ]

    // Adiciona contrato relation se existir
    if (contratosId) {
      fields.splice(2, 0, {
        name: 'contrato',
        type: 'relation',
        required: false,
        collectionId: contratosId,
        cascadeDelete: false,
        maxSelect: 1,
      })
    }

    const collection = new Collection({
      name: 'notas_fiscais',
      type: 'base',
      listRule: "@request.auth.id != '' && user = @request.auth.id",
      viewRule: "@request.auth.id != '' && user = @request.auth.id",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != '' && user = @request.auth.id",
      deleteRule: "@request.auth.id != '' && user = @request.auth.id",
      fields: fields,
      indexes: [],
    })

    app.save(collection)
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId('notas_fiscais')
      app.delete(collection)
    } catch (_) {}

    try {
      const empresasCol = app.findCollectionByNameOrId('empresas')
      const f = empresasCol.fields.getByName('emitir_nota_fiscal')
      if (f) empresasCol.fields.remove(f)
      app.save(empresasCol)
    } catch (_) {}
  },
)
