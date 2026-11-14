/// <reference path="../pb_data/types.d.ts" />
//
// Migração 0110 — corrige a coleção `ferramentas_usuarios` (criada na 0109 sem
// os campos autodate `created`/`updated`). Sem `updated`, todo GET com
// `sort=-updated` falhava com HTTP 400 e a aba "Habilitar Ferramentas" nunca
// carregava o estado salvo (sintoma: "depois da seleção não fica salvo").
//
// Idempotente: só adiciona os campos se ainda não existirem.
migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('ferramentas_usuarios')

    if (!col.fields.getByName('created')) {
      col.fields.add(new AutodateField({ name: 'created', onCreate: true, onUpdate: false }))
    }
    if (!col.fields.getByName('updated')) {
      col.fields.add(new AutodateField({ name: 'updated', onCreate: true, onUpdate: true }))
    }

    app.save(col)
  },
  (app) => {
    // Revert: remove os autodates adicionados (best-effort)
    try {
      const col = app.findCollectionByNameOrId('ferramentas_usuarios')
      const created = col.fields.getByName('created')
      if (created) col.fields.removeByName('created')
      const updated = col.fields.getByName('updated')
      if (updated) col.fields.removeByName('updated')
      app.save(col)
    } catch (_) {}
  },
)
