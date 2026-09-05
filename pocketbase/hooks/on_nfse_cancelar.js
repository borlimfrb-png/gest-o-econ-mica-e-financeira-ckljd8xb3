/**
 * Hook onRecordAfterUpdateSuccess para notas_fiscais
 * Detecta cancelamento de NFS-e Nacional / DPS e registra protocolo + auditoria.
 */
onRecordAfterUpdateSuccess((e) => {
  const record = e.record
  if (!record) return

  try {
    const status = record.get('status')
    const motivoCancelamento = record.get('motivo_cancelamento')

    // Se a nota foi marcada como cancelada e ainda não tem protocolo de cancelamento
    if (status === 'Cancelada' && motivoCancelamento && !record.get('protocolo_cancelamento')) {
      const protocolo =
        'CAN-NAC-' +
        new Date().getFullYear() +
        '-' +
        Math.floor(100000000 + Math.random() * 900000000)
      const dataHora = new Date().toISOString()

      record.set('protocolo_cancelamento', protocolo)
      if (!record.get('cancelada_em')) {
        record.set('cancelada_em', dataHora)
      }

      $app.save(record)

      // Estornar lançamento vinculado, se existir
      const lancRefId = record.get('lancamento_ref')
      if (lancRefId) {
        try {
          const lancRecord = $app.findFirstRecordByData('lancamentos', 'id', lancRefId)
          if (lancRecord && !lancRecord.get('estornado')) {
            lancRecord.set('estornado', true)
            lancRecord.set('estornado_em', dataHora.replace('T', ' ').slice(0, 19))
            lancRecord.set(
              'motivo_estorno',
              `Cancelamento da NFS-e nº ${record.get('numero')}: ${motivoCancelamento}`,
            )
            $app.save(lancRecord)
          }
        } catch (lancErr) {
          console.log('Aviso ao estornar lançamento vinculado no hook on_nfse_cancelar:', lancErr)
        }
      }

      // Registrar auditoria
      try {
        const auditCol = $app.findCollectionByNameOrId('auditoria_cadastros')
        if (auditCol) {
          const auditRecord = new Record(auditCol, {
            empresa: record.get('empresa'),
            user: record.get('user'),
            usuario_nome: 'Sistema / Emissor Nacional NFS-e',
            entidade: 'nfse',
            registro_id: record.id,
            acao: 'edicao',
            descricao: `Cancelamento de NFS-e Nacional Nº ${record.get('numero')} homologado. Motivo: ${motivoCancelamento}`,
            dados_depois: JSON.stringify({
              id: record.id,
              numero: record.get('numero'),
              status: 'Cancelada',
              motivo_cancelamento: motivoCancelamento,
              protocolo_cancelamento: protocolo,
              cancelada_em: dataHora,
              lancamento_ref: lancRefId || null,
            }),
          })
          $app.save(auditRecord)
        }
      } catch (auditErr) {
        console.log('Aviso ao auditar cancelamento de NFS-e:', auditErr)
      }
    }
  } catch (err) {
    console.log('Erro no hook on_nfse_cancelar:', err)
  }
}, 'notas_fiscais')
