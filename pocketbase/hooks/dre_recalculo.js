/**
 * Recálculo automático da DRE a partir dos lançamentos (Skip Cloud / PocketBase JSVM).
 *
 * Dois pontos de entrada:
 *   1. POST /backend/v1/dre/recalcular — usado pelo frontend (botão/ajuste) e pela
 *      rotina de correção pontual. Admin OU usuário vinculado à empresa (mesma
 *      semântica de vínculo das regras RLS).
 *   2. Cron "dre_recalculo_diario" (03:15 UTC) — varre TODAS as empresas com
 *      lançamentos não estornados e corrige automaticamente meses cuja DRE esteja
 *      toda zerada mas que tenham lançamentos com valores. É o mecanismo que corrige
 *      o caso IMCAL - MATRIZ 2026 (fechamento em lote rodou antes da importação e
 *      zerou os meses 8–12 sem que existisse recálculo).
 *
 * Regras:
 *   - Soma os lançamentos NÃO estornados por empresa/ano/mês (ano e mês extraídos da
 *     data), classificando pela `classificacao_dre` da conta do plano de contas
 *     (contas.classificacao_dre: Receita, Despesa Variável, Despesa Fixa,
 *     Despesa Financeira, Receita Financeira — mesmos grupos do DRE Gerencial).
 *   - Preenche os campos da coleção `dre` (receita_bruta, deducoes_receita,
 *     custo_mercadorias, despesas_operacionais, despesas_financeiras,
 *     outras_receitas_despesas, imposto_renda), upsert pelo índice único
 *     (empresa, ano, mes).
 *   - Idempotente: só regrava quando o valor calculado difere do registrado.
 *   - NUNCA usar Intl/toLocaleString aqui (JSVM goja sem Intl) — formatação é só no
 *     frontend; o backend devolve números crus.
 */

// Mês/ano a partir da data (YYYY-MM-DD) — sem Intl
function dreRecalcExtrairAnoMes(dataStr) {
  const s = String(dataStr || '')
  if (s.length < 7) return null
  const ano = parseInt(s.slice(0, 4), 10)
  const mes = parseInt(s.slice(5, 7), 10)
  if (!ano || ano < 2000 || ano > 2100 || !mes || mes < 1 || mes > 12) return null
  return { ano: ano, mes: mes }
}

function dreRecalcArredondar(v) {
  return Math.round((Number(v) || 0) * 100) / 100
}

/**
 * Recalcula a DRE de UM par empresa/ano a partir dos lançamentos.
 * Retorna o resultado para uso tanto da rota HTTP quanto do cron.
 */
function dreRecalcularEmpresaAno(empresaId, ano, soMesesZerados) {
  const CAMPOS = [
    'receita_bruta',
    'deducoes_receita',
    'custo_mercadorias',
    'despesas_operacionais',
    'despesas_financeiras',
    'outras_receitas_despesas',
    'imposto_renda',
  ]

  // 1) Mapa plano_conta -> classificação DRE (via contas do plano de contas da empresa)
  const contasRows = $app
    .db()
    .newQuery(
      'SELECT plano_contas.id AS pid, contas.classificacao_dre AS cls, contas.nao_exibir_dre AS ocultar ' +
        'FROM plano_contas INNER JOIN contas ON contas.id = plano_contas.conta ' +
        'WHERE plano_contas.empresa = {:emp}',
    )
    .bind({ emp: empresaId })
    .all()
  const mapaContas = {}
  for (let c = 0; c < contasRows.length; c++) {
    mapaContas[contasRows[c].pid] = contasRows[c]
  }

  // 2) Agregar lançamentos não estornados do ano por mês x classificação
  const lancRows = $app
    .db()
    .newQuery(
      'SELECT data, valor, plano_conta FROM lancamentos ' +
        'WHERE empresa = {:emp} AND data >= {:ini} AND data < {:fim} AND (estornado IS NULL OR estornado = false)',
    )
    .bind({
      emp: empresaId,
      ini: ano + '-01-01 00:00:00.000Z',
      fim: ano + 1 + '-01-01 00:00:00.000Z',
    })
    .all()

  const meses = {}
  for (let m = 1; m <= 12; m++) {
    meses[m] = {
      receita_bruta: 0,
      deducoes_receita: 0,
      custo_mercadorias: 0,
      despesas_operacionais: 0,
      despesas_financeiras: 0,
      outras_receitas_despesas: 0,
      imposto_renda: 0,
    }
  }

  let considerados = 0
  let semClassificacao = 0

  for (let i = 0; i < lancRows.length; i++) {
    const l = lancRows[i]
    const am = dreRecalcExtrairAnoMes(l.get('data'))
    if (!am) continue
    const valor = Number(l.get('valor')) || 0
    if (valor === 0) continue
    const pc = mapaContas[String(l.get('plano_conta'))]
    if (!pc || pc.ocultar) continue
    considerados++

    // Mapeia classificacao_dre -> campo da DRE (despesas/custos entram como valores positivos)
    const cls = String(pc.cls || '')
    const m = am.mes
    if (cls === 'Receita') {
      meses[m].receita_bruta += valor
    } else if (cls === 'Despesa Variável') {
      meses[m].custo_mercadorias += Math.abs(valor)
    } else if (cls === 'Despesa Fixa') {
      meses[m].despesas_operacionais += Math.abs(valor)
    } else if (cls === 'Despesa Financeira') {
      meses[m].despesas_financeiras += Math.abs(valor)
    } else if (cls === 'Receita Financeira') {
      meses[m].outras_receitas_despesas += valor
    } else {
      // Sem classificação: despesa tipo=Despesa vai p/ operacionais; receita p/ receita bruta
      semClassificacao++
      const tipoConta = String(pc.tipo || '')
      if (tipoConta === 'Despesa') {
        meses[m].despesas_operacionais += Math.abs(valor)
      } else if (tipoConta === 'Receita') {
        meses[m].receita_bruta += valor
      } else {
        continue
      }
    }
  }

  // 3) Estado atual da DRE do ano
  const dreRows = $app
    .db()
    .newQuery(
      'SELECT id, mes, receita_bruta, deducoes_receita, custo_mercadorias, despesas_operacionais, despesas_financeiras, outras_receitas_despesas, imposto_renda, fechado FROM dre WHERE empresa = {:emp} AND ano = {:ano} ORDER BY CAST(mes AS INTEGER)',
    )
    .bind({ emp: empresaId, ano: ano })
    .all()
  const drePorMes = {}
  for (let d = 0; d < dreRows.length; d++) {
    drePorMes[dreRows[d].get('mes')] = dreRows[d]
  }

  const colecaoDre = $app.findCollectionByNameOrId('dre')
  let criados = 0
  let atualizados = 0
  let corretos = 0
  const detalhes = []

  for (let m = 1; m <= 12; m++) {
    const calc = meses[m]
    const existente = drePorMes[m]

    let temValor = false
    for (let i = 0; i < CAMPOS.length; i++) {
      if (Math.abs(calc[CAMPOS[i]]) > 0.005) {
        temValor = true
        break
      }
    }

    // Meses sem lançamento e sem registro: nada a fazer
    if (!temValor && !existente) continue

    // Modo "só meses zerados" (cron): só corrige meses cuja DRE registrada está toda
    // zerada E que tenham lançamentos com valores. Meses com valores já registrados e
    // meses sem lançamento ficam intactos — nunca sobrescreve fechamento manual.
    if (soMesesZerados) {
      let registroZerado = true
      if (existente) {
        for (let i = 0; i < CAMPOS.length; i++) {
          if (Math.abs(Number(existente.get(CAMPOS[i])) || 0) > 0.005) {
            registroZerado = false
            break
          }
        }
      }
      if (!temValor || !registroZerado) continue
    }

    if (!existente) {
      const rec = new Record(colecaoDre)
      rec.set('empresa', empresaId)
      rec.set('ano', ano)
      rec.set('mes', m)
      for (let i = 0; i < CAMPOS.length; i++)
        rec.set(CAMPOS[i], dreRecalcArredondar(calc[CAMPOS[i]]))
      rec.set('fechado', false)
      rec.set('fechamento_obs', 'Recalculada automaticamente a partir dos lançamentos')
      $app.save(rec)
      criados++
      detalhes.push({ mes: m, acao: 'criado' })
      continue
    }

    // Compara com o existente (tolerância de centavos)
    let difere = false
    for (let i = 0; i < CAMPOS.length; i++) {
      const campo = CAMPOS[i]
      const atual = Number(existente.get(campo)) || 0
      const novo = dreRecalcArredondar(calc[campo])
      if (Math.abs(atual - novo) > 0.005) {
        difere = true
        break
      }
    }
    if (!difere) {
      corretos++
      continue
    }
    const registro = $app.findRecordById('dre', existente.get('id'))
    for (let i = 0; i < CAMPOS.length; i++) {
      registro.set(CAMPOS[i], dreRecalcArredondar(calc[CAMPOS[i]]))
    }
    registro.set('fechado', false)
    registro.set('fechamento_obs', 'Recalculada automaticamente a partir dos lançamentos')
    $app.save(registro)
    atualizados++
    detalhes.push({ mes: m, acao: 'atualizado' })
  }

  return {
    empresa: empresaId,
    ano: ano,
    lancamentos_considerados: considerados,
    lancamentos_sem_classificacao: semClassificacao,
    registros_criados: criados,
    registros_atualizados: atualizados,
    registros_ja_corretos: corretos,
    detalhes: detalhes,
  }
}

// ================= rota HTTP =================
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

  // Vínculo obrigatório: admin OU vínculo direto/multi-empresa/grupo com a empresa
  const role = auth.getString('role')
  if (role !== 'admin') {
    let vinculado = false
    try {
      vinculado =
        auth.getString('empresa') === empresaId ||
        auth.getStringSlice('empresas').indexOf(empresaId) !== -1
    } catch (_) {}
    if (!vinculado) {
      try {
        const grupos = auth.getStringSlice('grupos_empresariais')
        for (let g = 0; g < grupos.length; g++) {
          const grupo = $app.findRecordById('grupos_empresariais', grupos[g])
          if (grupo.getStringSlice('empresas').indexOf(empresaId) !== -1) {
            vinculado = true
            break
          }
        }
      } catch (_) {}
    }
    if (!vinculado) {
      return e.json(403, { sucesso: false, erro: 'Sem vínculo com esta empresa.' })
    }
  }

  try {
    const res = dreRecalcularEmpresaAno(empresaId, ano, false)
    return e.json(200, Object.assign({ sucesso: true }, res))
  } catch (err) {
    console.log('[router:dre_recalculo] Erro:', String(err))
    return e.json(500, { sucesso: false, erro: 'Falha ao recalcular a DRE: ' + String(err) })
  }
})

// ================= cron diário (varredura automática) =================
// 03:15 UTC — antes do horário comercial; varre todas as empresas com lançamentos.
cronAdd('dre_recalculo_diario', '15 3 * * *', () => {
  try {
    // Empresas distintas com lançamentos não estornados (SQL DISTINCT por empresa)
    const empresasDistinct = $app
      .db()
      .newQuery(
        "SELECT DISTINCT empresa FROM lancamentos WHERE (estornado IS NULL OR estornado = false) AND empresa != '' ORDER BY empresa",
      )
      .all()

    let empresasProcessadas = 0
    let totalCorrigidos = 0

    for (let i = 0; i < empresasDistinct.length; i++) {
      const empresaId = String(empresasDistinct[i].get('empresa') || '')
      if (empresaId === '') continue

      // Anos com lançamentos desta empresa (pela data, não por campo ano)
      const anosRows = $app
        .db()
        .newQuery(
          "SELECT DISTINCT CAST(strftime('%Y', data) AS INTEGER) AS ano FROM lancamentos " +
            "WHERE empresa = {:emp} AND (estornado IS NULL OR estornado = false) AND data IS NOT NULL AND data != ''",
        )
        .bind({ emp: empresaId })
        .all()

      for (let a = 0; a < anosRows.length; a++) {
        const ano = Number(anosRows[a].get('ano')) || 0
        if (!ano || ano < 2000 || ano > 2100) continue
        try {
          const res = dreRecalcularEmpresaAno(empresaId, ano, true)
          empresasProcessadas++
          totalCorrigidos += res.registros_criados + res.registros_atualizados
          if (res.registros_criados + res.registros_atualizados > 0) {
            console.log(
              '[cron:dre_recalculo] empresa=' +
                empresaId +
                ' ano=' +
                ano +
                ' criados=' +
                res.registros_criados +
                ' atualizados=' +
                res.registros_atualizados,
            )
          }
        } catch (errAno) {
          console.log(
            '[cron:dre_recalculo] Erro empresa=' +
              empresaId +
              ' ano=' +
              ano +
              ': ' +
              String(errAno),
          )
        }
      }
    }
    console.log(
      '[cron:dre_recalculo] Fim — empresas=' +
        empresasProcessadas +
        ' registros corrigidos=' +
        totalCorrigidos,
    )
  } catch (err) {
    console.log('[cron:dre_recalculo] Erro:', String(err))
  }
})
