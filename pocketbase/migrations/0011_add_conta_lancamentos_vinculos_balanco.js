// Adiciona o campo `conta` (relação opcional com a collection `contas`) nos
// lançamentos de centros de custo e o campo JSON `vinculos_contas` na collection
// `balancos`, que armazena o mapeamento campo-do-balanço -> id da conta vinculada.

migrate(
  (app) => {
    // --- lancamentos_centro: campo conta (relation opcional com contas) ---
    const lancCol = app.findCollectionByNameOrId('lancamentos_centro')
    if (!lancCol.fields.getByName('conta')) {
      lancCol.fields.add(
        new RelationField({
          name: 'conta',
          required: false,
          collectionId: app.findCollectionByNameOrId('contas').id,
          cascadeDelete: false,
          minSelect: 0,
          maxSelect: 1,
        }),
      )
    }
    lancCol.addIndex('idx_lancamentos_centro_conta', false, 'conta', '')
    app.save(lancCol)

    // --- balancos: campo vinculos_contas (json) ---
    // Armazena um objeto { campoBalanco: contaId } para vincular cada linha do
    // balanço patrimonial a uma conta cadastrada.
    const balCol = app.findCollectionByNameOrId('balancos')
    if (!balCol.fields.getByName('vinculos_contas')) {
      balCol.fields.add(
        new JSONField({
          name: 'vinculos_contas',
          required: false,
          maxSize: 5242880,
        }),
      )
    }
    app.save(balCol)
  },
  (app) => {
    // Reverte: remove os campos adicionados.
    const lancCol = app.findCollectionByNameOrId('lancamentos_centro')
    const contaField = lancCol.fields.getByName('conta')
    if (contaField) {
      lancCol.fields.removeByName('conta')
    }
    try {
      lancCol.removeIndex('idx_lancamentos_centro_conta')
    } catch (_) {}
    app.save(lancCol)

    const balCol = app.findCollectionByNameOrId('balancos')
    const vincField = balCol.fields.getByName('vinculos_contas')
    if (vincField) {
      balCol.fields.removeByName('vinculos_contas')
    }
    app.save(balCol)
  },
)
