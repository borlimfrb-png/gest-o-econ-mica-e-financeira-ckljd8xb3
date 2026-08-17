// Adiciona o campo "codigo" (text) às collections "centros" e "tipos_despesa".
// O codigo é um identificador sequencial por usuário (ex.: CC-001, TD-001)
// gerado automaticamente no momento da criação via hook. Esta migration apenas
// adiciona a coluna (com valor padrão vazio) e faz o backfill dos registros
// já existentes, numerando-os de forma sequencial por usuário.

migrate(
  (app) => {
    // --- centros ---
    const colCentros = app.findCollectionByNameOrId('centros')
    if (!colCentros.fields.getByName('codigo')) {
      colCentros.fields.add(new TextField({ name: 'codigo', required: false }))
    }
    app.save(colCentros)

    // --- tipos_despesa ---
    const colTipos = app.findCollectionByNameOrId('tipos_despesa')
    if (!colTipos.fields.getByName('codigo')) {
      colTipos.fields.add(new TextField({ name: 'codigo', required: false }))
    }
    app.save(colTipos)

    // --- Backfill centros: CC-NNN por usuário (ordem de criação) ---
    const centros = app.findRecordsByFilter('centros', '1=1', 'created', 0, 0)
    const seqCentros = {} // userId -> próximo número
    for (const rec of centros) {
      const userId = rec.getString('user') || ''
      if (!userId) continue
      const n = (seqCentros[userId] || 0) + 1
      seqCentros[userId] = n
      rec.set('codigo', 'CC-' + String(n).padStart(3, '0'))
      app.save(rec)
    }

    // --- Backfill tipos_despesa: TD-NNN por usuário (ordem de criação) ---
    const tipos = app.findRecordsByFilter('tipos_despesa', '1=1', 'created', 0, 0)
    const seqTipos = {} // userId -> próximo número
    for (const rec of tipos) {
      const userId = rec.getString('user') || ''
      if (!userId) continue
      const n = (seqTipos[userId] || 0) + 1
      seqTipos[userId] = n
      rec.set('codigo', 'TD-' + String(n).padStart(3, '0'))
      app.save(rec)
    }
  },
  (app) => {
    const colCentros = app.findCollectionByNameOrId('centros')
    const fC = colCentros.fields.getByName('codigo')
    if (fC) colCentros.fields.remove(fC)
    app.save(colCentros)

    const colTipos = app.findCollectionByNameOrId('tipos_despesa')
    const fT = colTipos.fields.getByName('codigo')
    if (fT) colTipos.fields.remove(fT)
    app.save(colTipos)
  },
)
