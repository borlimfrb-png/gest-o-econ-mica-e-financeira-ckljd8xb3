/**
 * POST /backend/v1/dre/recalcular
 *
 * Recalcula a DRE mensal (coleção `dre`) de uma empresa/ano a partir dos
 * `lancamentos` importados, usando a classificação das contas de resultado
 * (coleção `contas`, campo grupo/dre_*), respeitando a estrutura existente de
 * receitas, deduções, custos, despesas operacionais/financeiras e IR.
 *
 * Acessível para admin e para o próprio usuário vinculado à empresa (perfil
 * cliente/empresa/financeiro) — as coleções lancamentos/contas/dre já filtram
 * por vínculo de empresa nas regras RLS.
 *
 * Idempotente: para cada mês do ano, ATUALIZA o registro existente da `dre`
 * (não cria duplicado) somente quando houver diferença; se não houver registro
 * para o mês e existirem valores ≠ 0, cria o registro.
 *
 * IMPORTANTE (JSVM goja, pool separado): toda a lógica inline no callback;
 * sem Intl (formatação é só no frontend); sem funções top-level.
 */

routerAdd('POST', '/backend/v1/dre/recalcular', (e) => {
  const auth = e.auth
  if (!auth || auth.getString('id') === '') {
    return e.json(401, { sucesso: false, erro: 'Autenticação necessária.' })
  }

  let dados = {}
  try {
    dados = e.requestInfo().body
  } catch (err) {
    dados = {}
  }
  const empresaId = String(dados.empresa || '')
  const ano = parseInt(String(dados.ano || ''), 10)
  if (empresaId === '' || !ano || ano < 2000 || ano > 2100) {
    return e.json(400, { sucesso: false, erro: 'Informe empresa e ano válidos.' })
  }

  // Vínculo: admin passa; demais precisam de vínculo com a empresa
  const role = auth.getString('role')
  if (role !== 'admin') {
    const vinculado =
      auth.getString('empresa') === empresaId ||
      auth.getStringSlice('empresas').indexOf(empresaId) !== -1
    if (!vinculado) {
      // vínculo via grupo empresarial
      try {
        const grupos = auth.getStringSlice('grupos_empresariais')
        let okGrupo = false
        for (let g = 0; g < grupos.length; g++) {
          const grupo = $app.findRecordById('grupos_empresariais', grupos[g])
          const empresasGrupo = grupo.getStringSlice('empresas')
          if (empresasGrupo.indexOf(empresaId) !== -1) {
            okGrupo = true
            break
          }
        }
        if (!okGrupo) {
          return e.json(403, { sucesso: false, erro: 'Sem vínculo com esta empresa.' })
        }
      } catch (err2) {
        return e.json(403, { sucesso: false, erro: 'Sem vínculo com esta empresa.' })
      }
    }
  }

  try {
    // 1) Mapa conta -> classificação DRE (coleção `contas` da empresa)
    const contasRows = $app
      .db()
      .newQuery(
        'SELECT id, grupo, tipo_dre, dre_tipo, categoria_dre FROM contas WHERE empresa = {:emp}',
      )
      .bind({ emp: empresaId })
      .all()
    const mapaContas = {}
    for (let c = 0; c < contasRows.length; c++) {
      mapaContas[contasRows[c].id] = contasRows[c]
    }

    // Classificação heurística (mesma semântica de dreClassificacaoHeuristica.ts)
    function classificar(conta) {
      if (!conta) return 'outros'
      const tipo = String(
        conta.tipo_dre || conta.dre_tipo || conta.categoria_dre || '',
      ).toLowerCase()
      if (tipo === 'receita' || tipo === 'receita_bruta') return 'receita'
      if (tipo === 'deducao' || tipo === 'deducoes') return 'deducao'
      if (tipo === 'custo' || tipo === 'cmv' || tipo === 'custo_mercadorias') return 'custo'
      if (tipo === 'despesa_operacional' || tipo === 'despesa') return 'despesa_operacional'
      if (tipo === 'despesa_financeira' || tipo === 'financeiro') return 'despesa_financeira'
      if (tipo === 'receita_financeira') return 'receita_financeira'
      if (tipo === 'impostos' || tipo === 'ir' || tipo === 'csll' || tipo === 'ir_csll')
        return 'impostos'
      const grupo = String(conta.grupo || '').toLowerCase()
      if (grupo.indexOf('receita') !== -1) return 'receita'
      if (grupo.indexOf('dedu') !== -1) return 'deducao'
      if (grupo.indexOf('custo') !== -1 || grupo.indexOf('cmv') !== -1) return 'custo'
      if (grupo.indexOf('financeir') !== -1) return 'despesa_financeira'
      if (
        grupo.indexOf('imposto') !== -1 ||
        grupo.indexOf('ir') !== -1 ||
        grupo.indexOf('tribut') !== -1
      )
        return 'impostos'
      if (grupo.indexOf('despesa') !== -1) return 'despesa_operacional'
      return 'outros'
    }

    // 2) Agregar lançamentos do ano por mês x classificação
    const lancRows = $app
      .db()
      .newQuery(
        'SELECT lancamentos.mes AS mes, lancamentos.valor AS valor, lancamentos.conta AS conta_id ' +
          'FROM lancamentos WHERE lancamentos.empresa = {:emp} AND lancamentos.ano = {:ano}',
      )
      .bind({ emp: empresaId, ano: ano })
      .all()

    // 3) Estado atual da DRE do ano
    const dreRows = $app
      .db()
      .newQuery(
        'SELECT id, mes, receita_bruta, deducoes, custo_mercadorias, despesas_operacionais, despesas_financeiras, receitas_financeiras, impostos, observacao FROM dre WHERE empresa = {:emp} AND ano = {:ano}',
      )
      .bind({ emp: empresaId, ano: ano })
      .all()
    const drePorMes = {}
    for (let d = 0; d < dreRows.length; d++) {
      drePorMes[dreRows[d].mes] = dreRows[d]
    }

    // Campos numéricos da DRE que o recálculo alimenta
    const CAMPOS = [
      'receita_bruta',
      'deducoes',
      'custo_mercadorias',
      'despesas_operacionais',
      'despesas_financeiras',
      'receitas_financeiras',
      'impostos',
    ]

    function zeros() {
      const z = {}
      for (let i = 0; i < CAMPOS.length; i++) z[CAMPOS[i]] = 0
      return z
    }

    // meses[1..12] = acumuladores
    const meses = {}
    for (let m = 1; m <= 12; m++) meses[m] = zeros()

    let lancamentosConsiderados = 0
    let lancamentosSemClassificacao = 0

    for (let i = 0; i < lancRows.length; i++) {
      const l = lancRows[i]
      const mes = parseInt(String(l.mes), 10)
      const valor = Number(l.valor) || 0
      const conta = mapaContas[String(l.conta_id)]
      if (!conta || !mes || mes < 1 || mes > 12 || valor === 0) continue
      lancamentosConsiderados++
      const cat = classificar(conta)
      if (cat === 'outros') {
        lancamentosSemClassificacao++
        continue
      }
      // Mapeia categoria -> campo da DRE (deduções e despesas/custos entram como valores positivos)
      if (cat === 'receita') meses[mes].receita_bruta += valor
      else if (cat === 'deducao') meses[mes].deducoes += Math.abs(valor)
      else if (cat === 'custo') meses[mes].custo_mercadorias += Math.abs(valor)
      else if (cat === 'despesa_operacional') meses[mes].despesas_operacionais += Math.abs(valor)
      else if (cat === 'despesa_financeira') meses[mes].despesas_financeiras += Math.abs(valor)
      else if (cat === 'receita_financeira') meses[mes].receitas_financeiras += valor
      else if (cat === 'impostos') meses[mes].impostos += Math.abs(valor)
    }

    // 4) Persistir: atualiza existentes (se difere), cria os que faltam com valores ≠ 0
    const colecaoDre = $app.findCollectionByNameOrId('dre')
    let atualizados = 0
    let criados = 0
    let zerados = 0
    const detalhes = []

    for (let m = 1; m <= 12; m++) {
      const calc = meses[m]
      const existente = drePorMes[m]
      // pula meses que ficaram 0 e não têm registro
      let temValor = false
      for (let i = 0; i < CAMPOS.length; i++) {
        if (Math.abs(calc[CAMPOS[i]]) > 0.005) {
          temValor = true
          break
        }
      }
      if (!temValor && !existente) continue

      if (!existente) {
        const rec = new Record(colecaoDre)
        rec.set('empresa', empresaId)
        rec.set('ano', ano)
        rec.set('mes', m)
        for (let i = 0; i < CAMPOS.length; i++)
          rec.set(CAMPOS[i], Math.round(calc[CAMPOS[i]] * 100) / 100)
        rec.set('observacao', 'Recalculada automaticamente a partir dos lançamentos')
        $app.save(rec)
        criados++
        detalhes.push({ mes: m, acao: 'criado' })
        continue
      }

      // compara com o existente (tolerância de centavos)
      let difere = false
      for (let i = 0; i < CAMPOS.length; i++) {
        const campo = CAMPOS[i]
        const atual = Number(existente[campo]) || 0
        const novo = Math.round(calc[campo] * 100) / 100
        if (Math.abs(atual - novo) > 0.005) {
          difere = true
          break
        }
      }
      if (!difere) {
        zerados++
        continue
      }
      const registro = $app.findRecordById('dre', existente.id)
      for (let i = 0; i < CAMPOS.length; i++) {
        registro.set(CAMPOS[i], Math.round(calc[CAMPOS[i]] * 100) / 100)
      }
      registro.set('observacao', 'Recalculada automaticamente a partir dos lançamentos')
      $app.save(registro)
      atualizados++
      detalhes.push({ mes: m, acao: 'atualizado' })
    }

    return e.json(200, {
      sucesso: true,
      empresa: empresaId,
      ano: ano,
      lancamentos_considerados: lancamentosConsiderados,
      lancamentos_sem_classificacao: lancamentosSemClassificacao,
      registros_criados: criados,
      registros_atualizados: atualizados,
      registros_ja_corretos: zerados,
      detalhes: detalhes,
    })
  } catch (err) {
    console.log('[router:dre_recalculo] Erro:', String(err))
    return e.json(500, { sucesso: false, erro: 'Falha ao recalcular a DRE: ' + String(err) })
  }
})
