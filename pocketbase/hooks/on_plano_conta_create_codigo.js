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

  const empresaId = record.getString('empresa')

  // Encontra o maior número de código já existente para esta empresa/usuário.
  let maxN = 0
  try {
    let filter = 'user = {:uid}'
    let params = { uid: userId }
    if (empresaId) {
      filter += ' && empresa = {:empresaId}'
      params.empresaId = empresaId
    }

    const existentes = $app.findRecordsByFilter('plano_contas', filter, '-created', 0, 0, params)
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
