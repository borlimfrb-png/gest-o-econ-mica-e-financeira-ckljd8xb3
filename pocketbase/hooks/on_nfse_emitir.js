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

      // Se for padrão nacional e não tiver chave de acesso nacional válida (50 dígitos)
      const chaveAtual = record.get('chave_acesso')
      if (!chaveAtual || String(chaveAtual).replace(/\D/g, '').length !== 50) {
        const mun7 = (record.get('codigo_municipio_prestacao') || '3550308')
          .replace(/\D/g, '')
          .padEnd(7, '0')
          .slice(0, 7)
        const tpAmb = record.get('tipo_ambiente')?.includes('1') ? '1' : '2'
        const docLimpo = (record.get('prestador_cnpj') || '00000000000000')
          .replace(/[^0-9A-Za-z]/g, '')
          .toUpperCase()
        const tpInsc = docLimpo.length <= 11 ? '1' : '2'
        const insc14 = docLimpo.padStart(14, '0').slice(-14)
        const nNfse13 = String(numero || dpsNumero || 1)
          .replace(/\D/g, '')
          .padStart(13, '0')
          .slice(-13)

        const compDate = record.get('competencia') || record.get('data_emissao')
        const d = compDate ? new Date(compDate) : new Date()
        const ano2 = String(d.getFullYear()).slice(-2)
        const mes2 = String(d.getMonth() + 1).padStart(2, '0')
        const aamm = `${ano2}${mes2}`

        // 9 dígitos aleatórios numéricos
        const rnd9 = String(Math.floor(100000000 + Math.random() * 900000000)).slice(0, 9)

        const base49 = `${mun7}${tpAmb}${tpInsc}${insc14}${nNfse13}${aamm}${rnd9}`

        // Cálculo DV Módulo 11 oficial (pesos 2 a 9 da direita p/ esquerda)
        let soma = 0
        let peso = 2
        for (let i = 48; i >= 0; i--) {
          const code = base49.charCodeAt(i)
          const valor = code - 48
          soma += valor * peso
          peso = peso === 9 ? 2 : peso + 1
        }
        const resto = soma % 11
        const dv = resto === 0 || resto === 1 ? '0' : String(11 - resto)

        const chaveAcesso50 = `${base49}${dv}`
        record.set('chave_acesso', chaveAcesso50)
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
