// Gera automaticamente o código sequencial por usuário (TD-001, TD-002, ...)
// ao criar um novo tipo de despesa. O código nunca muda após criado.
onRecordCreate((e) => {
  const record = e.record

  let userId = record.getString('user')
  if (!userId) {
    return e.next()
  }

  // Encontra o maior número de código já existente para este usuário.
  let maxN = 0
  try {
    const existentes = $app.findRecordsByFilter(
      'tipos_despesa',
      'user = {:uid}',
      '-created',
      0,
      0,
      { uid: userId },
    )
    for (const r of existentes) {
      const codigo = r.getString('codigo')
      if (codigo && codigo.indexOf('TD-') === 0) {
        const num = parseInt(codigo.slice(3), 10)
        if (!isNaN(num) && num > maxN) maxN = num
      }
    }
  } catch (_) {}

  const proximo = maxN + 1
  record.set('codigo', 'TD-' + String(proximo).padStart(3, '0'))

  e.next()
}, 'tipos_despesa')
