// Gera automaticamente o código sequencial por usuário (PC-001, PC-002, ...)
// ao criar um novo item do plano de contas. O código nunca muda após criado e
// não recicla códigos de itens excluídos. Mesmo padrão dos hooks de contas,
// centros e tipos de despesa.
onRecordCreate((e) => {
  const record = e.record

  let userId = record.getString('user')
  if (!userId) {
    return e.next()
  }

  // Encontra o maior número de código já existente para este usuário.
  let maxN = 0
  try {
    const existentes = $app.findRecordsByFilter('plano_contas', 'user = {:uid}', '-created', 0, 0, {
      uid: userId,
    })
    for (const r of existentes) {
      const codigo = r.getString('codigo')
      if (codigo && codigo.indexOf('PC-') === 0) {
        const num = parseInt(codigo.slice(3), 10)
        if (!isNaN(num) && num > maxN) maxN = num
      }
    }
  } catch (_) {}

  const proximo = maxN + 1
  record.set('codigo', 'PC-' + String(proximo).padStart(3, '0'))

  e.next()
}, 'plano_contas')
