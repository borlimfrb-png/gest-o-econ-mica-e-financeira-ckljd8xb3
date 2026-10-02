/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const contas = app.findCollectionByNameOrId('contas')

    let modified = false

    if (!contas.fields.getByName('nao_exibir_dre')) {
      contas.fields.add(
        new BoolField({
          name: 'nao_exibir_dre',
          required: false,
        }),
      )
      modified = true
    }

    if (!contas.fields.getByName('nao_exibir_fluxo_caixa')) {
      contas.fields.add(
        new BoolField({
          name: 'nao_exibir_fluxo_caixa',
          required: false,
        }),
      )
      modified = true
    }

    if (!contas.fields.getByName('nao_exibir_em_nada')) {
      contas.fields.add(
        new BoolField({
          name: 'nao_exibir_em_nada',
          required: false,
        }),
      )
      modified = true
    }

    if (modified) {
      app.save(contas)
    }
  },
  (app) => {
    const contas = app.findCollectionByNameOrId('contas')
    let modified = false

    if (contas.fields.getByName('nao_exibir_dre')) {
      contas.fields.removeByName('nao_exibir_dre')
      modified = true
    }
    if (contas.fields.getByName('nao_exibir_fluxo_caixa')) {
      contas.fields.removeByName('nao_exibir_fluxo_caixa')
      modified = true
    }
    if (contas.fields.getByName('nao_exibir_em_nada')) {
      contas.fields.removeByName('nao_exibir_em_nada')
      modified = true
    }

    if (modified) {
      app.save(contas)
    }
  },
)
