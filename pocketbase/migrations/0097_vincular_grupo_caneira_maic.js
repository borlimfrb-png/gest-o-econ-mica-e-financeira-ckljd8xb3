/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // 1. Localizar o usuário maic@imcal.com.br
    let userRecord = null
    try {
      userRecord = app.findAuthRecordByEmail('users', 'maic@imcal.com.br')
    } catch (_) {
      try {
        userRecord = app.findFirstRecordByFilter('users', 'email = "maic@imcal.com.br"')
      } catch (_) {
        // Usuário não existe ainda neste ambiente (ex: banco zerado); operação é no-op
      }
    }

    // 2. Localizar o grupo Caneira (procura por "Caneira" ou "GRUPO CANEIRA")
    let grupoRecord = null
    try {
      grupoRecord = app.findFirstRecordByFilter(
        'grupos_empresariais',
        'nome ~ "Caneira" || nome ~ "caneira" || nome ~ "CANEIRA"',
      )
    } catch (_) {
      // Grupo não encontrado; no-op
    }

    if (!userRecord || !grupoRecord) {
      console.log(
        `Migracao 0097: user (${userRecord ? userRecord.id : 'nao encontrado'}), grupo (${
          grupoRecord ? grupoRecord.id : 'nao encontrado'
        }). Pulando vinculacao.`,
      )
      return
    }

    // 3. Obter grupos atuais e adicionar o ID caso ainda não esteja presente
    const currentGrupos = userRecord.get('grupos_empresariais') || []
    let gruposArray = []
    if (Array.isArray(currentGrupos)) {
      gruposArray = [...currentGrupos]
    } else if (typeof currentGrupos === 'string' && currentGrupos.trim()) {
      try {
        const parsed = JSON.parse(currentGrupos)
        if (Array.isArray(parsed)) gruposArray = parsed
        else gruposArray = [currentGrupos]
      } catch (_) {
        gruposArray = [currentGrupos]
      }
    }

    if (!gruposArray.includes(grupoRecord.id)) {
      gruposArray.push(grupoRecord.id)
      userRecord.set('grupos_empresariais', gruposArray)
      app.save(userRecord)
      console.log(
        `Migracao 0097: Grupo ${grupoRecord.get('nome')} (${grupoRecord.id}) vinculado ao usuario ${userRecord.get('email')}.`,
      )
    } else {
      console.log(
        `Migracao 0097: Grupo ${grupoRecord.get('nome')} ja estava vinculado ao usuario ${userRecord.get('email')}.`,
      )
    }
  },
  (app) => {
    // Revert idempotente: remove o grupo do usuário se estiver vinculado
    try {
      const userRecord = app.findFirstRecordByFilter('users', 'email = "maic@imcal.com.br"')
      const grupoRecord = app.findFirstRecordByFilter('grupos_empresariais', 'nome ~ "Caneira"')
      if (userRecord && grupoRecord) {
        const currentGrupos = userRecord.get('grupos_empresariais') || []
        let gruposArray = Array.isArray(currentGrupos) ? [...currentGrupos] : []
        if (gruposArray.includes(grupoRecord.id)) {
          gruposArray = gruposArray.filter((id) => id !== grupoRecord.id)
          userRecord.set('grupos_empresariais', gruposArray)
          app.save(userRecord)
        }
      }
    } catch (_) {
      // Revert seguro
    }
  },
)
