/// <reference path="../pb_data/types.d.ts" />

// Migração 0112 — Correção na ORIGEM das 3 divergências reportadas pela Auditoria de Segurança
// (/admin/auditoria): as coleções balancos, lancamentos e contas tiveram listRule/viewRule
// reescritas pelas migrações 0095/0096 com:
//   1) aspas duplas (estilo fora do padrão do projeto — a verificação da auditoria compara
//      substrings com aspas simples, gerando falso-positivo); e, mais grave,
//   2) vazamento real: o perfil "cliente" foi liberado SEM vínculo de empresa, além da cláusula
//      `|| empresa = ""` que expunha registros sem empresa para qualquer usuário autenticado.
// Esta migração restaura o padrão canônico do projeto (mesma regra da migração 0086) mantendo os
// recursos legítimos introduzidos em 0095/0096 — vínculo multi-empresa (@request.auth.empresas)
// e por grupo econômico (@request.auth.grupos_empresariais) — SEMPRE exigindo vínculo com a
// empresa do registro. Idempotente: reaplicar produz o mesmo estado.

migrate(
  (app) => {
    // Regra base com vínculo obrigatório de empresa (direto, multi-empresa ou grupo econômico)
    const perfisInternos = "@request.auth.role = 'empresa' || @request.auth.role = 'financeiro'"

    // balancos: bloqueada p/ financeiro e comercial; liberada p/ admin, empresa e cliente (sempre com vínculo)
    const regraBalancos =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || ((@request.auth.role = 'empresa' || @request.auth.role = 'cliente') && (empresa = @request.auth.empresa || @request.auth.empresas.id ?= empresa || @request.auth.empresas ?= empresa || @request.auth.grupos_empresariais.empresas.id ?= empresa || @request.auth.grupos_empresariais.empresas ?= empresa)))"

    // lancamentos e contas: permitidas p/ financeiro; bloqueadas p/ comercial; cliente com vínculo
    const regraFinanceira =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || ((" +
      perfisInternos +
      " || @request.auth.role = 'cliente') && (empresa = @request.auth.empresa || @request.auth.empresas.id ?= empresa || @request.auth.empresas ?= empresa || @request.auth.grupos_empresariais.empresas.id ?= empresa || @request.auth.grupos_empresariais.empresas ?= empresa)))"

    const alvos = [
      { nome: 'balancos', regra: regraBalancos },
      { nome: 'lancamentos', regra: regraFinanceira },
      { nome: 'contas', regra: regraFinanceira },
    ]

    for (let i = 0; i < alvos.length; i++) {
      const alvo = alvos[i]
      try {
        const col = app.findCollectionByNameOrId(alvo.nome)
        // Idempotência: só regrava quando a regra atual difere do estado correto
        if (col.listRule !== alvo.regra || col.viewRule !== alvo.regra) {
          col.listRule = alvo.regra
          col.viewRule = alvo.regra
          app.save(col)
          console.log('[m0112] Regras RLS restauradas na colecao: ' + alvo.nome)
        }
      } catch (e) {
        console.log('[m0112] Erro ao corrigir regras da colecao ' + alvo.nome + ':', e)
        throw e
      }
    }
  },
  (app) => {
    // Down: restaura o estado deixado pelas migrações 0095/0096 (estado anterior a esta correção)
    try {
      const balancos = app.findCollectionByNameOrId('balancos')
      const regraBalancosAntiga =
        '@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.role = "cliente" || @request.auth.empresas.id ?= empresa || @request.auth.empresas ?= empresa || @request.auth.empresa = empresa || @request.auth.grupos_empresariais.empresas.id ?= empresa || @request.auth.grupos_empresariais.empresas ?= empresa || empresa = "")'
      balancos.listRule = regraBalancosAntiga
      balancos.viewRule = regraBalancosAntiga
      app.save(balancos)
    } catch (_) {}

    try {
      const lancamentos = app.findCollectionByNameOrId('lancamentos')
      const regraLancamentosAntiga =
        '@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.role = "cliente" || @request.auth.empresas.id ?= empresa || @request.auth.empresas ?= empresa || @request.auth.empresa = empresa || @request.auth.grupos_empresariais.empresas.id ?= empresa || @request.auth.grupos_empresariais.empresas ?= empresa || empresa = "")'
      lancamentos.listRule = regraLancamentosAntiga
      lancamentos.viewRule = regraLancamentosAntiga
      app.save(lancamentos)
    } catch (_) {}

    try {
      const contas = app.findCollectionByNameOrId('contas')
      const regraContasAntiga =
        '@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.role = "cliente" || @request.auth.empresas.id ?= empresa || @request.auth.empresas ?= empresa || @request.auth.empresa = empresa || @request.auth.grupos_empresariais.empresas.id ?= empresa || @request.auth.grupos_empresariais.empresas ?= empresa || empresa = "")'
      contas.listRule = regraContasAntiga
      contas.viewRule = regraContasAntiga
      app.save(contas)
    } catch (_) {}
  },
)
