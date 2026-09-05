/**
 * Hook onRecordAfterCreateSuccess para notas_fiscais
 * Compatível com o Novo Padrão Nacional NFS-e / DPS e modo legado.
 * Gera numeração, protocolo nacional e registra auditoria.
 */
onRecordAfterCreateSuccess((e) => {
  const record = e.record
  if (!record) return

  try {
    const status = record.get('status')
    const numero = record.getInt('numero')
    const dpsNumero = record.getInt('dps_numero') || numero

    // Se já estiver emitida ou em rascunho com dados
    if (status === 'Emitida' || status === 'Enviada') {
      let codVerif = record.get('codigo_verificacao')
      if (!codVerif) {
        codVerif = $security.randomString(8).toUpperCase()
        record.set('codigo_verificacao', codVerif)
      }

      // Se for padrão nacional e não tiver chave de acesso nacional ainda
      if (!record.get('chave_acesso')) {
        const prestCnpj = (record.get('prestador_cnpj') || '00000000000000')
          .replace(/\D/g, '')
          .padStart(14, '0')
        const ano = new Date().getFullYear().toString().slice(-2)
        const mes = String(new Date().getMonth() + 1).padStart(2, '0')
        const mun = (record.get('codigo_municipio_prestacao') || '3550308')
          .padStart(7, '0')
          .slice(0, 7)
        const nNfse = String(numero || dpsNumero || 1).padStart(15, '0')
        const serie = (record.get('dps_serie') || record.get('serie') || '1').padStart(5, '0')
        const randomHex = $security.randomString(2).toUpperCase()
        const chaveAcesso = `${mun}${ano}${mes}${prestCnpj}00${serie}${nNfse}${randomHex}0`
        record.set('chave_acesso', chaveAcesso)
      }

      // Protocolo de Autorização
      if (!record.get('protocolo_autorizacao')) {
        const prot =
          'PRT-NAC-' +
          new Date().getFullYear() +
          '-' +
          Math.floor(100000000 + Math.random() * 900000000)
        record.set('protocolo_autorizacao', prot)
      }

      if (!record.get('gateway_status_resposta')) {
        record.set(
          'gateway_status_resposta',
          'DPS recebida com sucesso e homologada no Padrão Nacional (Código 100).',
        )
      }

      $app.save(record)
    }

    // Se esta nota está substituindo uma nota anterior
    const notaSubstituidaId = record.get('nota_substituida')
    const justificativaCorrecao = record.get('justificativa_correcao')
    let notaOriginal = null

    if (notaSubstituidaId) {
      try {
        notaOriginal = $app.findFirstRecordByData('notas_fiscais', 'id', notaSubstituidaId)
        if (notaOriginal) {
          // Marca nota original como Substituída
          notaOriginal.set('status', 'Substituída')
          $app.save(notaOriginal)

          // Registrar auditoria específica de substituição
          const auditCol = $app.findCollectionByNameOrId('auditoria_cadastros')
          if (auditCol) {
            const auditSubst = new Record(auditCol, {
              empresa: record.get('empresa'),
              user: record.get('user'),
              usuario_nome: 'Sistema / Emissor Nacional NFS-e',
              entidade: 'nfse',
              registro_id: record.id,
              acao: 'edicao',
              descricao: `NFS-e nº ${notaOriginal.get('numero')} substituída pela NFS-e nº ${record.get('numero')} (Motivo: ${justificativaCorrecao || 'Correção de dados'})`,
              detalhes: JSON.stringify({
                nota_substituida_id: notaOriginal.id,
                nota_substituida_numero: notaOriginal.get('numero'),
                nota_nova_id: record.id,
                nota_nova_numero: record.get('numero'),
                motivo: justificativaCorrecao,
              }),
            })
            $app.save(auditSubst)
          }
        }
      } catch (substErr) {
        console.log('Aviso ao processar nota substituída no hook:', substErr)
      }
    }

    // Registrar evento na auditoria_cadastros
    try {
      const auditCol = $app.findCollectionByNameOrId('auditoria_cadastros')
      if (auditCol) {
        const auditRecord = new Record(auditCol, {
          empresa: record.get('empresa'),
          user: record.get('user'),
          usuario_nome: 'Sistema / Emissor Nacional NFS-e',
          entidade: 'nfse',
          registro_id: record.id,
          acao: 'criacao',
          descricao:
            notaSubstituidaId && notaOriginal
              ? `Reemissão/Substituição de NFS-e Nacional Nº ${record.get('numero')} (substitui Nº ${notaOriginal.get('numero')}) para ${record.get('tomador_razao_social') || 'Tomador'} - Valor: R$ ${record.get('valor_liquido') || record.get('valor_servicos')}`
              : `Emissão de NFS-e Nacional Nº ${record.get('numero')} (DPS Série ${record.get('dps_serie') || '1'} Nº ${dpsNumero}) para ${record.get('tomador_razao_social') || 'Tomador'} - Valor: R$ ${record.get('valor_liquido') || record.get('valor_servicos')}`,
          dados_depois: JSON.stringify({
            id: record.id,
            numero: record.get('numero'),
            serie: record.get('dps_serie') || record.get('serie'),
            chave_acesso: record.get('chave_acesso'),
            tomador: record.get('tomador_razao_social'),
            valor_liquido: record.get('valor_liquido'),
            nota_substituida: notaSubstituidaId || null,
            justificativa_correcao: justificativaCorrecao || null,
          }),
        })
        $app.save(auditRecord)
      }
    } catch (auditErr) {
      console.log('Aviso ao auditar emissão de NFS-e:', auditErr)
    }
  } catch (err) {
    console.log('Erro no hook on_nfse_emitir:', err)
  }
}, 'notas_fiscais')
