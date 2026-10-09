migrate(
  (app) => {
    // Função para calcular DV Módulo 11 oficial da Chave de Acesso Nacional NFS-e
    function calcularDvMod11(base49) {
      var soma = 0
      var peso = 2
      for (var i = 48; i >= 0; i--) {
        var code = base49.charCodeAt(i)
        var valor = code - 48
        soma += valor * peso
        peso = peso === 9 ? 2 : peso + 1
      }
      var resto = soma % 11
      return resto === 0 || resto === 1 ? '0' : String(11 - resto)
    }

    try {
      var notas = app.findRecordsByFilter('notas_fiscais', 'chave_acesso != ""', '-created', 0, 0)
      for (var j = 0; j < notas.length; j++) {
        var record = notas[j]
        var chaveAtual = String(record.get('chave_acesso') || '').replace(/\D/g, '')

        // Se tiver 49 dígitos ou tamanho diferente de 50
        if (chaveAtual.length === 49) {
          var dv = calcularDvMod11(chaveAtual)
          var novaChave50 = chaveAtual + dv
          record.set('chave_acesso', novaChave50)

          // Se houver xml_conteudo com a chave antiga, atualiza a tag <ChaveAcesso>
          var xml = record.getString('xml_conteudo')
          if (xml && xml.indexOf(chaveAtual) !== -1) {
            record.set('xml_conteudo', xml.split(chaveAtual).join(novaChave50))
          }

          app.save(record)
        } else if (chaveAtual.length > 0 && chaveAtual.length !== 50) {
          // Se for chave com outro tamanho inválido ou prefixo legado, reprocessa se for padrão nacional
          var mun7 = (record.get('codigo_municipio_prestacao') || '3550308')
            .replace(/\D/g, '')
            .padEnd(7, '0')
            .slice(0, 7)
          var tpAmb =
            record.get('tipo_ambiente') && String(record.get('tipo_ambiente')).indexOf('1') !== -1
              ? '1'
              : '2'
          var docLimpo = (record.get('prestador_cnpj') || '00000000000000')
            .replace(/[^0-9A-Za-z]/g, '')
            .toUpperCase()
          var tpInsc = docLimpo.length <= 11 ? '1' : '2'
          var insc14 = docLimpo.padStart(14, '0').slice(-14)
          var nNfse13 = String(record.getInt('numero') || record.getInt('dps_numero') || 1)
            .replace(/\D/g, '')
            .padStart(13, '0')
            .slice(-13)

          var compDate = record.get('competencia') || record.get('data_emissao')
          var d = compDate ? new Date(compDate) : new Date()
          var ano2 = String(d.getFullYear()).slice(-2)
          var mes2 = String(d.getMonth() + 1).padStart(2, '0')
          var aamm = ano2 + mes2
          var rnd9 = String(Math.floor(100000000 + Math.random() * 900000000)).slice(0, 9)

          var base49 = mun7 + tpAmb + tpInsc + insc14 + nNfse13 + aamm + rnd9
          var dvCalc = calcularDvMod11(base49)
          var novaChave = base49 + dvCalc
          record.set('chave_acesso', novaChave)

          var xmlConteudo = record.getString('xml_conteudo')
          if (xmlConteudo && xmlConteudo.indexOf('<ChaveAcesso>') !== -1) {
            var xmlNovo = xmlConteudo.replace(
              /<ChaveAcesso>.*?<\/ChaveAcesso>/g,
              '<ChaveAcesso>' + novaChave + '</ChaveAcesso>',
            )
            record.set('xml_conteudo', xmlNovo)
          }

          app.save(record)
        }
      }
    } catch (e) {
      console.log('Aviso ao migrar chaves de acesso NFS-e para 50 dígitos:', e)
    }
  },
  (app) => {
    // Sem rollback destrutivo de chaves
  },
)
