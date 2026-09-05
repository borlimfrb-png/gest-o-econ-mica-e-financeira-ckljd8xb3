/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // 1. Atualizar collection 'notas_fiscais'
    const notasCol = app.findCollectionByNameOrId('notas_fiscais')
    if (notasCol) {
      // 1.1 Atualizar selectValues do campo 'status' para incluir 'Substituída'
      const statusField = notasCol.fields.getByName('status')
      if (statusField) {
        statusField.values = ['Rascunho', 'Emitida', 'Enviada', 'Cancelada', 'Substituída', 'Erro']
      }

      // 1.2 Adicionar campo 'nota_substituida' (relation para notas_fiscais)
      if (!notasCol.fields.getByName('nota_substituida')) {
        notasCol.fields.add(
          new RelationField({
            name: 'nota_substituida',
            type: 'relation',
            required: false,
            collectionId: notasCol.id,
            cascadeDelete: false,
            maxSelect: 1,
          }),
        )
      }

      // 1.3 Adicionar campo 'justificativa_correcao' (text)
      if (!notasCol.fields.getByName('justificativa_correcao')) {
        notasCol.fields.add(
          new TextField({
            name: 'justificativa_correcao',
            type: 'text',
            required: false,
          }),
        )
      }

      // 1.4 Adicionar campo 'lancamento_ref' (relation para lancamentos)
      const lancCol = app.findCollectionByNameOrId('lancamentos')
      if (lancCol && !notasCol.fields.getByName('lancamento_ref')) {
        notasCol.fields.add(
          new RelationField({
            name: 'lancamento_ref',
            type: 'relation',
            required: false,
            collectionId: lancCol.id,
            cascadeDelete: false,
            maxSelect: 1,
          }),
        )
      }

      app.save(notasCol)
    }

    // 2. Atualizar collection 'lancamentos'
    const lancCol = app.findCollectionByNameOrId('lancamentos')
    if (lancCol) {
      // 2.1 Adicionar campo 'nota_fiscal_ref' (relation para notas_fiscais)
      if (notasCol && !lancCol.fields.getByName('nota_fiscal_ref')) {
        lancCol.fields.add(
          new RelationField({
            name: 'nota_fiscal_ref',
            type: 'relation',
            required: false,
            collectionId: notasCol.id,
            cascadeDelete: false,
            maxSelect: 1,
          }),
        )
      }

      // 2.2 Adicionar campo 'estornado' (bool)
      if (!lancCol.fields.getByName('estornado')) {
        lancCol.fields.add(
          new BoolField({
            name: 'estornado',
            type: 'bool',
            required: false,
          }),
        )
      }

      // 2.3 Adicionar campo 'estornado_em' (date)
      if (!lancCol.fields.getByName('estornado_em')) {
        lancCol.fields.add(
          new DateField({
            name: 'estornado_em',
            type: 'date',
            required: false,
          }),
        )
      }

      // 2.4 Adicionar campo 'motivo_estorno' (text)
      if (!lancCol.fields.getByName('motivo_estorno')) {
        lancCol.fields.add(
          new TextField({
            name: 'motivo_estorno',
            type: 'text',
            required: false,
          }),
        )
      }

      app.save(lancCol)
    }

    // 3. Atualizar collection 'empresas' para configuração de integração
    const empresasCol = app.findCollectionByNameOrId('empresas')
    if (empresasCol) {
      if (!empresasCol.fields.getByName('integrar_nfse_lancamentos')) {
        empresasCol.fields.add(
          new BoolField({
            name: 'integrar_nfse_lancamentos',
            type: 'bool',
            required: false,
          }),
        )
      }
      app.save(empresasCol)
    }
  },
  (app) => {
    try {
      const notasCol = app.findCollectionByNameOrId('notas_fiscais')
      if (notasCol) {
        const f1 = notasCol.fields.getByName('nota_substituida')
        if (f1) notasCol.fields.remove(f1)
        const f2 = notasCol.fields.getByName('justificativa_correcao')
        if (f2) notasCol.fields.remove(f2)
        const f3 = notasCol.fields.getByName('lancamento_ref')
        if (f3) notasCol.fields.remove(f3)
        app.save(notasCol)
      }

      const lancCol = app.findCollectionByNameOrId('lancamentos')
      if (lancCol) {
        const lf1 = lancCol.fields.getByName('nota_fiscal_ref')
        if (lf1) lancCol.fields.remove(lf1)
        const lf2 = lancCol.fields.getByName('estornado')
        if (lf2) lancCol.fields.remove(lf2)
        const lf3 = lancCol.fields.getByName('estornado_em')
        if (lf3) lancCol.fields.remove(lf3)
        const lf4 = lancCol.fields.getByName('motivo_estorno')
        if (lf4) lancCol.fields.remove(lf4)
        app.save(lancCol)
      }

      const empresasCol = app.findCollectionByNameOrId('empresas')
      if (empresasCol) {
        const ef1 = empresasCol.fields.getByName('integrar_nfse_lancamentos')
        if (ef1) empresasCol.fields.remove(ef1)
        app.save(empresasCol)
      }
    } catch (_) {}
  },
)
