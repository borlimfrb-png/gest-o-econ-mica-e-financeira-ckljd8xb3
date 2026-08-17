// Gera automaticamente o código sequencial por usuário (CC-001, CC-002, ...)
// ao criar um novo centro de custo. O código nunca muda após criado.
onRecordCreate((e) => {
  const record = e.record

  // Garante que o user esteja definido (o service já envia, mas por segurança).
  let userId = record.getString('user')
  if (!userId) {
    // tenta pegar do auth da requisição não está disponível em model hooks;
    // o service sempre envia user, então usamos isso.
    return e.next()
  }

  // Encontra o maior número de código já existente para este usuário.
  let maxN = 0
  try {
    const existentes = $app.findRecordsByFilter('centros', 'user = {:uid}', '-created', 0, 0, {
      uid: userId,
    })
    for (const r of existentes) {
      const codigo = r.getString('codigo')
      if (codigo && codigo.indexOf('CC-') === 0) {
        const num = parseInt(codigo.slice(3), 10)
        if (!isNaN(num) && num > maxN) maxN = num
      }
    }
  } catch (_) {}

  const proximo = maxN + 1
  record.set('codigo', 'CC-' + String(proximo).padStart(3, '0'))

  e.next()
}, 'centros')
