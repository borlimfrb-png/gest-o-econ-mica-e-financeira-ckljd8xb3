// Migration 0090: Adicionar campos de status de consulta ao Portal Nacional em notas_fiscais
migrate(
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('notas_fiscais')

      if (!col.fields.getByName('portal_status')) {
        col.fields.add(
          new SelectField({
            name: 'portal_status',
            required: false,
            values: ['nao_consultada', 'autorizada', 'rejeitada', 'nao_encontrada'],
            maxSelect: 1,
          }),
        )
      }

      if (!col.fields.getByName('portal_motivo')) {
        col.fields.add(
          new TextField({
            name: 'portal_motivo',
            required: false,
          }),
        )
      }

      if (!col.fields.getByName('portal_consultado_em')) {
        col.fields.add(
          new DateField({
            name: 'portal_consultado_em',
            required: false,
          }),
        )
      }

      app.save(col)
    } catch (e) {
      console.log('Erro na migracao 0090_add_portal_status_notas_fiscais:', e)
      throw e
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('notas_fiscais')
      const f1 = col.fields.getByName('portal_status')
      if (f1) col.fields.remove(f1)
      const f2 = col.fields.getByName('portal_motivo')
      if (f2) col.fields.remove(f2)
      const f3 = col.fields.getByName('portal_consultado_em')
      if (f3) col.fields.remove(f3)
      app.save(col)
    } catch (_) {}
  },
)
