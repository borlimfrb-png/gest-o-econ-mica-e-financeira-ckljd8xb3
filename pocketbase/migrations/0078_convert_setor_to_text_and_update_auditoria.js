/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // 1. Converter campo 'setor' da coleção 'empresas' de SelectField para TextField
    // para suportar qualquer setor novo cadastrado dinamicamente sem truncar ou falhar validação.
    const empresasCol = app.findCollectionByNameOrId('empresas')
    if (empresasCol.fields.getByName('setor')) {
      empresasCol.fields.removeByName('setor')
    }
    empresasCol.fields.add(
      new TextField({
        name: 'setor',
        required: false,
      }),
    )
    app.save(empresasCol)

    // Garantir índice
    try {
      empresasCol.addIndex('idx_empresas_setor', false, 'setor', '')
      app.save(empresasCol)
    } catch (_) {}

    // 2. Atualizar campo 'entidade' em 'auditoria_cadastros' para incluir 'setores'
    try {
      const auditCol = app.findCollectionByNameOrId('auditoria_cadastros')
      const entidadeField = auditCol.fields.getByName('entidade')
      if (entidadeField) {
        entidadeField.values = [
          'empresas',
          'plano_contas',
          'users',
          'nfse',
          'nfse_tomadores',
          'certificado_digital',
          'setores',
        ]
        app.save(auditCol)
      }
    } catch (err) {
      console.log('Aviso ao atualizar entidade de auditoria_cadastros:', err)
    }
  },
  (app) => {
    // Down migration
    try {
      const empresasCol = app.findCollectionByNameOrId('empresas')
      if (empresasCol.fields.getByName('setor')) {
        empresasCol.fields.removeByName('setor')
        empresasCol.fields.add(
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
        app.save(empresasCol)
      }
    } catch (_) {}
  },
)
