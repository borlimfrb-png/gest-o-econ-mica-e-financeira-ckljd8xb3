/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // 1. balancos: permitir list e view para role 'cliente' da mesma empresa
    const balancosCol = app.findCollectionByNameOrId('balancos')
    balancosCol.listRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || ((@request.auth.role = 'empresa' || @request.auth.role = 'cliente') && empresa = @request.auth.empresa))"
    balancosCol.viewRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || ((@request.auth.role = 'empresa' || @request.auth.role = 'cliente') && empresa = @request.auth.empresa))"
    app.save(balancosCol)

    // 2. dre: permitir list e view para role 'cliente' da mesma empresa
    const dreCol = app.findCollectionByNameOrId('dre')
    dreCol.listRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || ((@request.auth.role = 'empresa' || @request.auth.role = 'cliente') && empresa = @request.auth.empresa))"
    dreCol.viewRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || ((@request.auth.role = 'empresa' || @request.auth.role = 'cliente') && empresa = @request.auth.empresa))"
    app.save(dreCol)

    // 3. lancamentos: permitir list e view para role 'cliente' da mesma empresa
    const lancamentosCol = app.findCollectionByNameOrId('lancamentos')
    lancamentosCol.listRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || ((@request.auth.role = 'empresa' || @request.auth.role = 'financeiro' || @request.auth.role = 'cliente') && empresa = @request.auth.empresa))"
    lancamentosCol.viewRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || ((@request.auth.role = 'empresa' || @request.auth.role = 'financeiro' || @request.auth.role = 'cliente') && empresa = @request.auth.empresa))"
    app.save(lancamentosCol)

    // 4. plano_contas: permitir list e view para role 'cliente' da mesma empresa
    const planoContasCol = app.findCollectionByNameOrId('plano_contas')
    planoContasCol.listRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || ((@request.auth.role = 'empresa' || @request.auth.role = 'financeiro' || @request.auth.role = 'cliente') && empresa = @request.auth.empresa))"
    planoContasCol.viewRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || ((@request.auth.role = 'empresa' || @request.auth.role = 'financeiro' || @request.auth.role = 'cliente') && empresa = @request.auth.empresa))"
    app.save(planoContasCol)

    // 5. contas: permitir list e view para role 'cliente' da mesma empresa
    const contasCol = app.findCollectionByNameOrId('contas')
    contasCol.listRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || ((@request.auth.role = 'empresa' || @request.auth.role = 'financeiro' || @request.auth.role = 'cliente') && empresa = @request.auth.empresa))"
    contasCol.viewRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || ((@request.auth.role = 'empresa' || @request.auth.role = 'financeiro' || @request.auth.role = 'cliente') && empresa = @request.auth.empresa))"
    app.save(contasCol)

    // 6. centros: permitir list e view para role 'cliente' da mesma empresa
    const centrosCol = app.findCollectionByNameOrId('centros')
    centrosCol.listRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || ((@request.auth.role = 'empresa' || @request.auth.role = 'financeiro' || @request.auth.role = 'cliente') && empresa = @request.auth.empresa))"
    centrosCol.viewRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || ((@request.auth.role = 'empresa' || @request.auth.role = 'financeiro' || @request.auth.role = 'cliente') && empresa = @request.auth.empresa))"
    app.save(centrosCol)

    // 7. tipos_despesa: permitir list e view para role 'cliente' da mesma empresa
    const tiposDespesaCol = app.findCollectionByNameOrId('tipos_despesa')
    tiposDespesaCol.listRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || ((@request.auth.role = 'empresa' || @request.auth.role = 'financeiro' || @request.auth.role = 'cliente') && empresa = @request.auth.empresa))"
    tiposDespesaCol.viewRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || ((@request.auth.role = 'empresa' || @request.auth.role = 'financeiro' || @request.auth.role = 'cliente') && empresa = @request.auth.empresa))"
    app.save(tiposDespesaCol)
  },
  (app) => {
    // Reverter regras de acesso retirando 'cliente'
    try {
      const balancosCol = app.findCollectionByNameOrId('balancos')
      balancosCol.listRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || (@request.auth.role = 'empresa' && empresa = @request.auth.empresa))"
      balancosCol.viewRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || (@request.auth.role = 'empresa' && empresa = @request.auth.empresa))"
      app.save(balancosCol)
    } catch (_) {}

    try {
      const dreCol = app.findCollectionByNameOrId('dre')
      dreCol.listRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || (@request.auth.role = 'empresa' && empresa = @request.auth.empresa))"
      dreCol.viewRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || (@request.auth.role = 'empresa' && empresa = @request.auth.empresa))"
      app.save(dreCol)
    } catch (_) {}

    try {
      const lancamentosCol = app.findCollectionByNameOrId('lancamentos')
      lancamentosCol.listRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || ((@request.auth.role = 'empresa' || @request.auth.role = 'financeiro') && empresa = @request.auth.empresa))"
      lancamentosCol.viewRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || ((@request.auth.role = 'empresa' || @request.auth.role = 'financeiro') && empresa = @request.auth.empresa))"
      app.save(lancamentosCol)
    } catch (_) {}

    try {
      const planoContasCol = app.findCollectionByNameOrId('plano_contas')
      planoContasCol.listRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || ((@request.auth.role = 'empresa' || @request.auth.role = 'financeiro') && empresa = @request.auth.empresa))"
      planoContasCol.viewRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || ((@request.auth.role = 'empresa' || @request.auth.role = 'financeiro') && empresa = @request.auth.empresa))"
      app.save(planoContasCol)
    } catch (_) {}

    try {
      const contasCol = app.findCollectionByNameOrId('contas')
      contasCol.listRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || ((@request.auth.role = 'empresa' || @request.auth.role = 'financeiro') && empresa = @request.auth.empresa))"
      contasCol.viewRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || ((@request.auth.role = 'empresa' || @request.auth.role = 'financeiro') && empresa = @request.auth.empresa))"
      app.save(contasCol)
    } catch (_) {}

    try {
      const centrosCol = app.findCollectionByNameOrId('centros')
      centrosCol.listRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || ((@request.auth.role = 'empresa' || @request.auth.role = 'financeiro') && empresa = @request.auth.empresa))"
      centrosCol.viewRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || ((@request.auth.role = 'empresa' || @request.auth.role = 'financeiro') && empresa = @request.auth.empresa))"
      app.save(centrosCol)
    } catch (_) {}

    try {
      const tiposDespesaCol = app.findCollectionByNameOrId('tipos_despesa')
      tiposDespesaCol.listRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || ((@request.auth.role = 'empresa' || @request.auth.role = 'financeiro') && empresa = @request.auth.empresa))"
      tiposDespesaCol.viewRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || ((@request.auth.role = 'empresa' || @request.auth.role = 'financeiro') && empresa = @request.auth.empresa))"
      app.save(tiposDespesaCol)
    } catch (_) {}
  },
)
