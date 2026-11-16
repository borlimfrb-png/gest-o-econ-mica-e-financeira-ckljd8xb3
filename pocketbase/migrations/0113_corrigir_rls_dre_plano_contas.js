/// <reference path="../pb_data/types.d.ts" />

// Migração 0113 — Estende às coleções `dre` e `plano_contas` a MESMA regra canônica de
// vínculo multi-empresa/grupo aplicada a balancos/lancamentos/contas na migração 0112.
//
// Problema real: as regras list/view dessas duas coleções eram apenas
// `empresa = @request.auth.empresa` — o campo `empresas` do usuário nunca era consultado.
// Resultado: o usuário maic@imcal.com.br (empresa=nhvab3tif4lil5i, com a IMCAL - MATRIZ
// ejntpbzj1asshkp em `empresas`) recebia ZERO linhas de `dre` e `plano_contas` da MATRIZ,
// deixando os dashboards vazios. Idempotente: reaplicar produz o mesmo estado.
//
// SEGURANÇA: vínculo SEMPRE obrigatório — nenhum registro sem empresa fica visível
// (sem cláusula `|| empresa = ""`).

migrate(
  (app) => {
    // Mesma regra da 0112 para lancamentos/contas (admin, empresa, financeiro e cliente com vínculo)
    const regra =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || ((@request.auth.role = 'empresa' || @request.auth.role = 'financeiro' || @request.auth.role = 'cliente') && (empresa = @request.auth.empresa || @request.auth.empresas.id ?= empresa || @request.auth.empresas ?= empresa || @request.auth.grupos_empresariais.empresas.id ?= empresa || @request.auth.grupos_empresariais.empresas ?= empresa)))"

    const alvos = ['dre', 'plano_contas']

    for (let i = 0; i < alvos.length; i++) {
      const nome = alvos[i]
      try {
        const col = app.findCollectionByNameOrId(nome)
        // Idempotência: só regrava quando a regra atual difere do estado correto
        if (col.listRule !== regra || col.viewRule !== regra) {
          col.listRule = regra
          col.viewRule = regra
          app.save(col)
          console.log('[m0113] Regras RLS canônicas aplicadas na colecao: ' + nome)
        }
      } catch (e) {
        console.log('[m0113] Erro ao aplicar regras da colecao ' + nome + ':', e)
        throw e
      }
    }
  },
  (app) => {
    // Down: restaura o estado anterior (regra estreita sem vínculo multi-empresa)
    try {
      const dre = app.findCollectionByNameOrId('dre')
      dre.listRule = 'empresa = @request.auth.empresa'
      dre.viewRule = 'empresa = @request.auth.empresa'
      app.save(dre)
    } catch (_) {}

    try {
      const planoContas = app.findCollectionByNameOrId('plano_contas')
      planoContas.listRule = 'empresa = @request.auth.empresa'
      planoContas.viewRule = 'empresa = @request.auth.empresa'
      app.save(planoContas)
    } catch (_) {}
  },
)
