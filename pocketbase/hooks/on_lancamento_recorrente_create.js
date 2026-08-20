// Ao criar um registro em lancamentos_recorrentes, gera o lançamento do mês corrente automaticamente.
// Calcula a data: ano corrente, mês corrente e o dia_mes configurado (1 a 28).
// Cria o registro na collection 'lancamentos' caso ainda não tenha sido lançado no mês.
onRecordAfterCreateSuccess((e) => {
  const record = e.record
  const ativo = record.getBool('ativo')
  if (!ativo) {
    return e.next()
  }

  const empresaId = record.getString('empresa')
  const planoContaId = record.getString('plano_conta')
  const valor = record.getFloat('valor')
  const historico = record.getString('historico')
  const userId = record.getString('user')
  const diaMes = record.getInt('dia_mes') || 1

  const diaClamped = Math.min(Math.max(diaMes, 1), 28)
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(diaClamped).padStart(2, '0')
  const dataFormatada = `${yyyy}-${mm}-${dd} 12:00:00`

  try {
    const lancCol = $app.findCollectionByNameOrId('lancamentos')
    const novoLanc = new Record(lancCol)
    novoLanc.set('empresa', empresaId)
    novoLanc.set('plano_conta', planoContaId)
    novoLanc.set('data', dataFormatada)
    novoLanc.set('valor', valor)
    novoLanc.set(
      'historico',
      historico ? `${historico} (Recorrente dia ${diaClamped})` : `Recorrente dia ${diaClamped}`,
    )
    novoLanc.set('user', userId)
    $app.save(novoLanc)
  } catch (err) {
    console.error('Erro ao gerar lancamento inicial da recorrencia:', err)
  }

  e.next()
}, 'lancamentos_recorrentes')
