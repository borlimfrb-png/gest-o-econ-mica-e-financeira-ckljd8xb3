migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('empresas')

    // Adiciona o campo opcional "setor" (distinto de segmento)
    // Valores padronizados nos benchmarks setoriais e múltiplos de valuation
    if (!col.fields.getByName('setor')) {
      col.fields.add(
        new SelectField({
          name: 'setor',
          required: false,
          values: [
            'Serviços',
            'Comércio',
            'Indústria',
            'Tecnologia',
            'Agronegócio',
            'Construção',
            'Saúde',
            'Educação',
            'Financeiro',
            'Outros',
          ],
          maxSelect: 1,
        }),
      )
    }

    app.save(col)

    // Adiciona índice não-único em setor se ainda não existir
    try {
      col.addIndex('idx_empresas_setor', false, 'setor', '')
      app.save(col)
    } catch (_) {
      // Ignora se o índice já existir ou se SQLite lidar com col.save
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('empresas')
      const f = col.fields.getByName('setor')
      if (f) {
        col.fields.remove(f)
      }
      try {
        col.removeIndex('idx_empresas_setor')
      } catch (_) {}
      app.save(col)
    } catch (_) {}
  },
)
