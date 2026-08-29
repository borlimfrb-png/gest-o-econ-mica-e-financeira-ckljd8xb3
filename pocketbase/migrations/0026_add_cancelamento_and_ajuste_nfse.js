migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('notas_fiscais')

    // 1. Campos de cancelamento
    if (!col.fields.getByName('motivo_cancelamento')) {
      col.fields.add(
        new TextField({
          name: 'motivo_cancelamento',
          required: false,
        }),
      )
    }

    if (!col.fields.getByName('cancelada_em')) {
      col.fields.add(
        new DateField({
          name: 'cancelada_em',
          required: false,
        }),
      )
    }

    if (!col.fields.getByName('protocolo_cancelamento')) {
      col.fields.add(
        new TextField({
          name: 'protocolo_cancelamento',
          required: false,
        }),
      )
    }

    if (!col.fields.getByName('xml_cancelamento')) {
      col.fields.add(
        new TextField({
          name: 'xml_cancelamento',
          required: false,
        }),
      )
    }

    // 2. Campos para nota de débito/crédito e vínculo de renegociação
    if (!col.fields.getByName('tipo_documento')) {
      col.fields.add(
        new SelectField({
          name: 'tipo_documento',
          required: false,
          values: ['NFSe', 'Debito', 'Credito'],
          maxSelect: 1,
        }),
      )
    }

    if (!col.fields.getByName('nota_referencia')) {
      col.fields.add(
        new RelationField({
          name: 'nota_referencia',
          required: false,
          collectionId: col.id,
          cascadeDelete: false,
          maxSelect: 1,
        }),
      )
    }

    if (!col.fields.getByName('parcela_referencia')) {
      col.fields.add(
        new NumberField({
          name: 'parcela_referencia',
          required: false,
        }),
      )
    }

    if (!col.fields.getByName('valor_original')) {
      col.fields.add(
        new NumberField({
          name: 'valor_original',
          required: false,
        }),
      )
    }

    if (!col.fields.getByName('valor_renegociado')) {
      col.fields.add(
        new NumberField({
          name: 'valor_renegociado',
          required: false,
        }),
      )
    }

    if (!col.fields.getByName('valor_diferenca')) {
      col.fields.add(
        new NumberField({
          name: 'valor_diferenca',
          required: false,
        }),
      )
    }

    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('notas_fiscais')
    const fieldNames = [
      'motivo_cancelamento',
      'cancelada_em',
      'protocolo_cancelamento',
      'xml_cancelamento',
      'tipo_documento',
      'nota_referencia',
      'parcela_referencia',
      'valor_original',
      'valor_renegociado',
      'valor_diferenca',
    ]
    for (const fn of fieldNames) {
      const f = col.fields.getByName(fn)
      if (f) col.fields.remove(f)
    }
    app.save(col)
  },
)
