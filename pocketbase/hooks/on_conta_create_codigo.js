// Gera automaticamente o código sequencial por usuário (CO-001, CO-002, ...)
// ao criar uma nova conta. O código nunca muda após criado e não recicla
// códigos de contas excluídas. Mesmo padrão dos hooks de centros e tipos.
onRecordCreate((e) => {
  const record = e.record

  let userId = record.getString('user')
  if (!userId) {
    return e.next()
  }

  // Encontra o maior número de código já existente para este usuário.
  let maxN = 0
  try {
    const existentes = $app.findRecordsByFilter('contas', 'user = {:uid}', '-created', 0, 0, {
      uid: userId,
    })
    for (const r of existentes) {
      const codigo = r.getString('codigo')
      if (codigo && codigo.indexOf('CO-') === 0) {
        const num = parseInt(codigo.slice(3), 10)
        if (!isNaN(num) && num > maxN) maxN = num
      }
    }
  } catch (_) {}

  const proximo = maxN + 1
  record.set('codigo', 'CO-' + String(proximo).padStart(3, '0'))

  e.next()
}, 'contas')
