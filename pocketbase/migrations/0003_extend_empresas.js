migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('empresas')

    // 1. Amplia os valores do select "segmento" acrescentando Educação e Financeiro.
    //    Mantém "Construção" (já usado por registros existentes) para não quebrar dados.
    const seg = col.fields.getByName('segmento')
    if (seg) {
      seg.values = [
        'Indústria',
        'Comércio',
        'Serviços',
        'Tecnologia',
        'Agronegócio',
        'Construção',
        'Saúde',
        'Educação',
        'Financeiro',
        'Outros',
      ]
    }

    // 2. Novos campos — todos opcionais (cadastro progressivo)
    if (!col.fields.getByName('nome_fantasia')) {
      col.fields.add(new TextField({ name: 'nome_fantasia' }))
    }
    if (!col.fields.getByName('porte')) {
      col.fields.add(
        new SelectField({
          name: 'porte',
          values: ['MEI', 'Microempresa', 'Pequena', 'Média', 'Grande'],
          maxSelect: 1,
        }),
      )
    }
    if (!col.fields.getByName('data_fundacao')) {
      col.fields.add(new DateField({ name: 'data_fundacao' }))
    }

    // Endereço
    if (!col.fields.getByName('logradouro')) {
      col.fields.add(new TextField({ name: 'logradouro' }))
    }
    if (!col.fields.getByName('numero')) {
      col.fields.add(new TextField({ name: 'numero' }))
    }
    if (!col.fields.getByName('complemento')) {
      col.fields.add(new TextField({ name: 'complemento' }))
    }
    if (!col.fields.getByName('bairro')) {
      col.fields.add(new TextField({ name: 'bairro' }))
    }
    if (!col.fields.getByName('cidade')) {
      col.fields.add(new TextField({ name: 'cidade' }))
    }
    if (!col.fields.getByName('estado')) {
      col.fields.add(
        new SelectField({
          name: 'estado',
          values: [
            'AC',
            'AL',
            'AP',
            'AM',
            'BA',
            'CE',
            'DF',
            'ES',
            'GO',
            'MA',
            'MT',
            'MS',
            'MG',
            'PA',
            'PB',
            'PR',
            'PE',
            'PI',
            'RJ',
            'RN',
            'RS',
            'RO',
            'RR',
            'SC',
            'SP',
            'SE',
            'TO',
          ],
          maxSelect: 1,
        }),
      )
    }
    if (!col.fields.getByName('cep')) {
      col.fields.add(new TextField({ name: 'cep' }))
    }

    // Contato
    if (!col.fields.getByName('telefone')) {
      col.fields.add(new TextField({ name: 'telefone' }))
    }
    if (!col.fields.getByName('email')) {
      col.fields.add(new EmailField({ name: 'email' }))
    }
    if (!col.fields.getByName('site')) {
      col.fields.add(new URLField({ name: 'site' }))
    }
    if (!col.fields.getByName('contato_principal')) {
      col.fields.add(new TextField({ name: 'contato_principal' }))
    }

    // Informações adicionais
    if (!col.fields.getByName('observacoes')) {
      col.fields.add(new TextField({ name: 'observacoes' }))
    }

    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('empresas')
    ;[
      'nome_fantasia',
      'porte',
      'data_fundacao',
      'logradouro',
      'numero',
      'complemento',
      'bairro',
      'cidade',
      'estado',
      'cep',
      'telefone',
      'email',
      'site',
      'contato_principal',
      'observacoes',
    ].forEach((name) => {
      const f = col.fields.getByName(name)
      if (f) col.fields.remove(f)
    })
    app.save(col)
  },
)
