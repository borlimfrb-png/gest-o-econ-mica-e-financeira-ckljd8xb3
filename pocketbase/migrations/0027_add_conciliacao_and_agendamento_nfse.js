migrate(
  (app) => {
    // 1. Atualizar collection 'recebiveis' com campos de vínculo de nota, status de conciliação e agendamento de NFSe
    const recebiveisCol = app.findCollectionByNameOrId('recebiveis')
    const notasCol = app.findCollectionByNameOrId('notas_fiscais')

    if (!recebiveisCol.fields.getByName('nota_fiscal')) {
      recebiveisCol.fields.add(
        new RelationField({
          name: 'nota_fiscal',
          required: false,
          collectionId: notasCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        }),
      )
    }

    if (!recebiveisCol.fields.getByName('conciliado')) {
      recebiveisCol.fields.add(
        new BoolField({
          name: 'conciliado',
          required: false,
        }),
      )
    }

    if (!recebiveisCol.fields.getByName('conciliado_em')) {
      recebiveisCol.fields.add(
        new DateField({
          name: 'conciliado_em',
          required: false,
        }),
      )
    }

    if (!recebiveisCol.fields.getByName('nfse_automatica_agendada')) {
      recebiveisCol.fields.add(
        new BoolField({
          name: 'nfse_automatica_agendada',
          required: false,
        }),
      )
    }

    if (!recebiveisCol.fields.getByName('nfse_emitida_em')) {
      recebiveisCol.fields.add(
        new DateField({
          name: 'nfse_emitida_em',
          required: false,
        }),
      )
    }

    app.save(recebiveisCol)

    // 2. Atualizar collection 'notas_fiscais' com campos de recebível vinculado e conciliação
    if (!notasCol.fields.getByName('recebivel')) {
      notasCol.fields.add(
        new RelationField({
          name: 'recebivel',
          required: false,
          collectionId: recebiveisCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        }),
      )
    }

    if (!notasCol.fields.getByName('conciliada')) {
      notasCol.fields.add(
        new BoolField({
          name: 'conciliada',
          required: false,
        }),
      )
    }

    if (!notasCol.fields.getByName('conciliada_em')) {
      notasCol.fields.add(
        new DateField({
          name: 'conciliada_em',
          required: false,
        }),
      )
    }

    if (!notasCol.fields.getByName('agendamento_automatico')) {
      notasCol.fields.add(
        new BoolField({
          name: 'agendamento_automatico',
          required: false,
        }),
      )
    }

    app.save(notasCol)
  },
  (app) => {
    try {
      const recebiveisCol = app.findCollectionByNameOrId('recebiveis')
      const recFields = [
        'nota_fiscal',
        'conciliado',
        'conciliado_em',
        'nfse_automatica_agendada',
        'nfse_emitida_em',
      ]
      for (const fn of recFields) {
        const f = recebiveisCol.fields.getByName(fn)
        if (f) recebiveisCol.fields.remove(f)
      }
      app.save(recebiveisCol)
    } catch (_) {}

    try {
      const notasCol = app.findCollectionByNameOrId('notas_fiscais')
      const notaFields = ['recebivel', 'conciliada', 'conciliada_em', 'agendamento_automatico']
      for (const fn of notaFields) {
        const f = notasCol.fields.getByName(fn)
        if (f) notasCol.fields.remove(f)
      }
      app.save(notasCol)
    } catch (_) {}
  },
)
