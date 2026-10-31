/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('empresas')

    // Adiciona o campo opcional "forma_tributacao" com os regimes vigentes no Brasil
    // Opções: MEI (Microempreendedor Individual), Simples Nacional, Lucro Presumido, Lucro Real
    if (!col.fields.getByName('forma_tributacao')) {
      col.fields.add(
        new SelectField({
          name: 'forma_tributacao',
          required: false,
          values: [
            'MEI (Microempreendedor Individual)',
            'Simples Nacional',
            'Lucro Presumido',
            'Lucro Real',
          ],
          maxSelect: 1,
        }),
      )
      app.save(col)
    }

    // Índice auxiliar não-único em forma_tributacao (idempotente)
    try {
      col.addIndex('idx_empresas_forma_tributacao', false, 'forma_tributacao', '')
      app.save(col)
    } catch (_) {
      // Ignora se o índice já existir
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('empresas')
      const f = col.fields.getByName('forma_tributacao')
      if (f) {
        col.fields.remove(f)
      }
      try {
        col.removeIndex('idx_empresas_forma_tributacao')
      } catch (_) {}
      app.save(col)
    } catch (_) {}
  },
)
