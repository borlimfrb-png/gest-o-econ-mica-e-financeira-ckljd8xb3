/// <reference path="../pb_data/types.d.ts" />
//
// Rota do Agente de Planejamento Econômico: POST /backend/v1/planejamento-economico/analyze
// CONTRATO PÚBLICO: { sucesso, planejamento, regenerado } — NUNCA renomear só um lado.
//
// Recebe { empresa_id, ano_base, ano_projecao, benchmark_rotulo, benchmark,
// dres, contas (histórico conta por conta), indicadores (29 indicadores por
// exercício), indicadores_prompt (texto de indicadoresParaPrompt) } e pede ao
// agente nativo 'planejamento-economico' a projeção anual + a projeção mensal
// (jan–dez, conta por conta, agrupada por Faturamento / Despesas Fixas /
// Despesas Variáveis). Se a IA não devolver projecao_mensal, a resposta sai
// SEM o campo — retrocompatível, nada quebra.
//
// REGRA PERMANENTE: o JSVM (goja) NÃO tem Intl — nada de Intl.NumberFormat /
// toLocaleString aqui; backend devolve números crus e o frontend formata pt-BR.
// REGRA JSVM: callbacks de routerAdd rodam em pool de VMs — toda a lógica é
// declarada INLINE no corpo do callback (nada acessível de top-level).
routerAdd(
  'POST',
  '/backend/v1/planejamento-economico/analyze',
  (e) => {
    try {
      const auth = e.auth
      if (!auth) return e.unauthorizedError('Autenticação obrigatória.')

      const body = (e.requestInfo() && e.requestInfo().body) || {}
      const empresaId = String(body.empresa_id || '')
      const anoBase = Number(body.ano_base) || 0
      const anoProjecao = Number(body.ano_projecao) || anoBase + 1
      const forcar = body.forcar_regenerar === true
      const contasEntrada = Array.isArray(body.contas) ? body.contas : []

      if (!empresaId || !anoBase || contasEntrada.length === 0) {
        return e.json(400, {
          sucesso: false,
          erro: 'Informe empresa_id, ano_base e a lista de contas do DRE Gerencial.',
        })
      }

      // Autorização: mesmas regras da coleção (perfis internos; cliente bloqueado)
      const role = auth.getString('role')
      if (role === 'cliente') {
        return e.json(403, { sucesso: false, erro: 'Sem permissão para esta análise.' })
      }
      if (role !== 'admin' && auth.getString('empresa') !== empresaId) {
        return e.json(403, { sucesso: false, erro: 'Sem permissão para esta empresa.' })
      }

      // ---- Cache: registro já salvo para empresa/ano base (regenerado: false) ----
      const safeEmpresa = empresaId.replace(/'/g, "\\'")
      if (!forcar) {
        try {
          const existente = $app.findFirstRecordByFilter(
            'planejamento_economico',
            "empresa = '" + safeEmpresa + "' && ano_base = " + anoBase,
            '-created',
          )
          if (existente) {
            let contasSalvas = []
            let projecaoSalva = null
            try {
              const brutas = existente.get('contas')
              contasSalvas = typeof brutas === 'string' ? JSON.parse(brutas) : brutas
              if (!Array.isArray(contasSalvas)) contasSalvas = []
            } catch (_) {}
            try {
              const pm = existente.get('projecao_mensal')
              projecaoSalva = typeof pm === 'string' ? JSON.parse(pm) : pm || null
            } catch (_) {}
            return e.json(200, {
              sucesso: true,
              regenerado: false,
              planejamento: {
                id: existente.id,
                empresa: existente.getString('empresa'),
                ano_base: existente.getNumber('ano_base'),
                ano_projecao: existente.getNumber('ano_projecao'),
                benchmark_rotulo: existente.getString('benchmark_rotulo'),
                benchmark_mencionado: existente.getString('benchmark_mencionado'),
                parecer_geral: existente.getString('parecer_geral'),
                receita_projetada: existente.getNumber('receita_projetada'),
                contas: contasSalvas,
                projecao_mensal: projecaoSalva,
                created: existente.getString('created'),
              },
            })
          }
        } catch (_) {}
      }

      // ---- Monta o prompt CONTA POR CONTA + 29 INDICADORES ----
      // Texto dos indicadores: preferir o texto estruturado do frontend
      // (indicadoresParaPrompt); fallback: serialização tolerante do objeto.
      function textoIndicadores() {
        const direto = String(body.indicadores_prompt || '').trim()
        if (direto) return direto
        const ind = body.indicadores
        if (!ind || typeof ind !== 'object' || !Array.isArray(ind.indicadores)) return ''
        const linhas = []
        linhas.push(
          'INDICADORES ECONÔMICO-FINANCEIROS (' +
            String(ind.total_indicadores || 29) +
            ' métricas; "—" = sem dado apurável):',
        )
        for (const bloco of ind.indicadores) {
          if (!bloco || typeof bloco !== 'object') continue
          if (!bloco.tem_dre && !bloco.tem_balanco) {
            linhas.push('Exercício ' + String(bloco.ano) + ': sem DRE/Balanço — ignore este ano.')
            continue
          }
          linhas.push('Exercício ' + String(bloco.ano) + ':')
          for (const i of Array.isArray(bloco.indicadores) ? bloco.indicadores : []) {
            if (!i || typeof i !== 'object') continue
            const val =
              i.valor === null || i.valor === undefined || !isFinite(Number(i.valor))
                ? '—'
                : String(i.valor)
            const ant =
              i.valor_anterior === null ||
              i.valor_anterior === undefined ||
              !isFinite(Number(i.valor_anterior))
                ? '—'
                : String(i.valor_anterior)
            linhas.push(
              '  - ' +
                String(i.sigla || '') +
                ' (' +
                String(i.nome || '') +
                '): ' +
                val +
                ' (ano anterior: ' +
                ant +
                '; status: ' +
                String(i.status || '') +
                ')',
            )
          }
        }
        return linhas.join('\n')
      }

      const linhasContas = []
      for (const c of contasEntrada) {
        if (!c || typeof c !== 'object') continue
        const anosHist = Array.isArray(c.anos) ? c.anos.map((a) => String(a)).join(' | ') : ''
        linhasContas.push(
          '- [' +
            String(c.classificacao || 'NaoClassificado') +
            '] ' +
            String(c.codigo || '') +
            ' ' +
            String(c.nome || '') +
            (c.centro_nome ? ' (centro: ' + String(c.centro_nome) + ')' : '') +
            ' | históricos: ' +
            anosHist +
            ' | ano base ' +
            String(anoBase) +
            ': ' +
            String(c.atual || 0) +
            ' (meses com dados: ' +
            String(c.meses_com_dados || 0) +
            ')',
        )
      }

      const linhasDres = []
      for (const d of Array.isArray(body.dres) ? body.dres : []) {
        if (!d || typeof d !== 'object') continue
        linhasDres.push(
          '- ' +
            String(d.ano) +
            '/' +
            String(d.mes) +
            ': receita_bruta=' +
            String(d.receita_bruta || 0) +
            ', deducoes=' +
            String(d.deducoes_receita || 0) +
            ', custo=' +
            String(d.custo_mercadorias || 0) +
            ', despesas_op=' +
            String(d.despesas_operacionais || 0) +
            ', financeiras=' +
            String(d.despesas_financeiras || 0) +
            ', outras=' +
            String(d.outras_receitas_despesas || 0) +
            ', IR=' +
            String(d.imposto_renda || 0),
        )
      }

      const bm = body.benchmark && typeof body.benchmark === 'object' ? body.benchmark : {}
      const prompt =
        '[PLANEJAMENTO ECONÔMICO — EMPRESA ATIVA]\n' +
        '- Empresa: ' +
        String(body.empresa_nome || '') +
        ' (ID: ' +
        empresaId +
        ')' +
        (body.segmento ? ' | Segmento: ' + String(body.segmento) : '') +
        '\n- Exercício base: ' +
        String(anoBase) +
        ' | Ano projetado: ' +
        String(anoProjecao) +
        '\n- Benchmark setorial informado: ' +
        String(body.benchmark_rotulo || '—') +
        '\n- Margens de mercado (medianas): bruta=' +
        String(bm.margem_bruta ?? '—') +
        '%, operacional=' +
        String(bm.margem_operacional ?? '—') +
        '%, EBITDA=' +
        String(bm.margem_ebitda ?? '—') +
        '%, líquida=' +
        String(bm.margem_liquida ?? '—') +
        '%\n\n' +
        textoIndicadores() +
        '\n\n[DRES RESUMO DOS EXERCÍCIOS DA JANELA]\n' +
        (linhasDres.join('\n') || '(sem DREs resumo)') +
        '\n\n[DRE GERENCIAL CONTA POR CONTA — ' +
        linhasContas.length +
        ' contas]\n' +
        linhasContas.join('\n') +
        '\n\n[TAREFA]\n' +
        'Projete cada conta para ' +
        String(anoProjecao) +
        ' (valor anual, variação % vs ' +
        String(anoBase) +
        ', confiança e comentário) E a distribuição mensal jan–dez de cada conta ' +
        '(projecao_mensal), agrupada em "Faturamento" (classificação Receita), ' +
        '"Despesas Fixas" (Despesa Fixa + Financeira) e "Despesas Variáveis" ' +
        '(Despesa Variável). A soma dos 12 meses de cada conta DEVE fechar com o ' +
        'valor anual projetado. Use os 29 indicadores como fundamento e cite o benchmark. ' +
        'Responda APENAS com o JSON definido no seu system prompt.'

      // ---- Chamada ao agente nativo (tolerante a truncamento de JSON) ----
      function extrairJson(texto) {
        let conteudo = String(texto || '').trim()
        conteudo = conteudo
          .replace(/^```(?:json)?/i, '')
          .replace(/```$/, '')
          .trim()
        const inicio = conteudo.indexOf('{')
        const fim = conteudo.lastIndexOf('}')
        if (inicio < 0 || fim < inicio) return null
        const candidato = conteudo.slice(inicio, fim + 1)
        try {
          return JSON.parse(candidato)
        } catch (_) {}
        // Reparo de truncamento: fecha o que ficou aberto
        const pilha = []
        let dentroString = false
        let escapado = false
        for (let i = 0; i < candidato.length; i++) {
          const ch = candidato[i]
          if (dentroString) {
            if (escapado) escapado = false
            else if (ch === '\\') escapado = true
            else if (ch === '"') dentroString = false
            continue
          }
          if (ch === '"') dentroString = true
          else if (ch === '{' || ch === '[') pilha.push(ch)
          else if (ch === '}' || ch === ']') pilha.pop()
        }
        let reparado = candidato
        if (dentroString) reparado += '"'
        reparado = reparado.replace(/,\s*$/, '')
        for (let i = pilha.length - 1; i >= 0; i--) {
          reparado += pilha[i] === '{' ? '}' : ']'
        }
        try {
          return JSON.parse(reparado)
        } catch (_) {
          return null
        }
      }

      let parsed = null
      try {
        const resultado = $ai.agent('planejamento-economico').chat({
          user_id: auth.id,
          message: prompt,
        })
        const conteudo =
          resultado && typeof resultado === 'object'
            ? String(resultado.content || resultado.text || '')
            : String(resultado || '')
        parsed = extrairJson(conteudo)
      } catch (erroAgente) {
        if (erroAgente instanceof SkipAiConfigError) {
          return e.json(503, { sucesso: false, erro: 'IA temporariamente indisponível.' })
        }
        return e.json(502, {
          sucesso: false,
          erro: 'Erro de análise: o agente não respondeu. Tente novamente.',
        })
      }
      if (!parsed || typeof parsed !== 'object') {
        return e.json(502, {
          sucesso: false,
          erro: 'Erro de análise: resposta inválida do agente.',
        })
      }

      // ---- Normaliza contas projetadas (ordem da entrada preservada) ----
      function confiancaValida(v) {
        const s = String(v || '')
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
        if (s === 'alta' || s === 'media' || s === 'baixa') return s
        return 'media'
      }

      const contasProj = []
      const brutasContas = Array.isArray(parsed.contas) ? parsed.contas : []
      for (const c of brutasContas) {
        if (!c || typeof c !== 'object') continue
        const nome = String(c.nome || '').trim()
        if (!nome) continue
        contasProj.push({
          conta_id: String(c.conta_id || ''),
          codigo: String(c.codigo || '').trim(),
          nome: nome,
          grupo: String(c.grupo || '').trim(),
          classificacao: String(c.classificacao || '').trim(),
          centro_nome: String(c.centro_nome || '').trim(),
          anos: Array.isArray(c.anos) ? c.anos.map((v) => Number(v) || 0) : [],
          atual: Number(c.atual) || 0,
          valor_projetado: Number(c.valor_projetado) || 0,
          variacao_pct: Number(c.variacao_pct) || 0,
          confianca: confiancaValida(c.confianca),
          comentario: String(c.comentario || '').trim(),
        })
      }
      if (contasProj.length === 0) {
        return e.json(502, {
          sucesso: false,
          erro: 'Erro de análise: o agente não devolveu contas projetadas.',
        })
      }

      // ---- Projeção mensal (OPCIONAL — ausente não quebra nada) ----
      function normalizarProjecaoMensal(pm) {
        if (!pm || typeof pm !== 'object') return null
        const gruposBrutos = Array.isArray(pm.grupos) ? pm.grupos : []
        const grupos = []
        let totalGeral = 0
        for (const g of gruposBrutos) {
          if (!g || typeof g !== 'object') continue
          const nomeGrupo = String(g.grupo || g.nome || '').trim()
          if (!nomeGrupo) continue
          const contas = []
          let totalGrupo = 0
          for (const c of Array.isArray(g.contas) ? g.contas : []) {
            if (!c || typeof c !== 'object') continue
            const nomeConta = String(c.nome || '').trim()
            if (!nomeConta) continue
            // Aceita meses como [{mes, valor}] ou array posicional de números
            const valores = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
            if (Array.isArray(c.meses)) {
              let posicional = true
              for (const m of c.meses) {
                if (m && typeof m === 'object') {
                  posicional = false
                  const idx = Number(m.mes)
                  if (idx >= 1 && idx <= 12) valores[idx - 1] = Number(m.valor) || 0
                }
              }
              if (posicional) {
                for (let i = 0; i < 12; i++) valores[i] = Number(c.meses[i]) || 0
              }
            } else if (Array.isArray(c.valores)) {
              for (let i = 0; i < 12; i++) valores[i] = Number(c.valores[i]) || 0
            }
            const somaMeses = valores.reduce((a, b) => a + b, 0)
            const valorTotal =
              isFinite(Number(c.valor_total)) && Number(c.valor_total) !== 0
                ? Number(c.valor_total)
                : somaMeses
            // variacao_pct vs ano base (entra da IA ou recalcula da conta anual)
            let variacao = Number(c.variacao_pct)
            if (!isFinite(variacao)) {
              const ref = contasEntrada.find(
                (x) =>
                  x &&
                  (String(x.codigo || '') === String(c.codigo || '') ||
                    String(x.nome || '') === nomeConta),
              )
              const atual = ref ? Number(ref.atual) || 0 : 0
              variacao = atual !== 0 ? ((valorTotal - atual) / Math.abs(atual)) * 100 : 0
            }
            variacao = Math.round(variacao * 100) / 100
            totalGrupo += valorTotal
            contas.push({
              codigo: String(c.codigo || '').trim(),
              nome: nomeConta,
              valor_total: valorTotal,
              meses: valores.map((v, i) => ({ mes: i + 1, valor: v })),
              confianca: confiancaValida(c.confianca),
              comentario: String(c.comentario || '').trim(),
              variacao_pct: variacao,
            })
          }
          if (contas.length > 0) {
            totalGeral += totalGrupo
            grupos.push({ grupo: nomeGrupo, contas: contas, total: totalGrupo })
          }
        }
        if (grupos.length === 0) return null
        return { ano: Number(pm.ano) || anoProjecao, grupos: grupos, total_geral: totalGeral }
      }

      let projecaoMensal = null
      try {
        projecaoMensal = normalizarProjecaoMensal(parsed.projecao_mensal)
      } catch (_) {
        projecaoMensal = null
      }

      // ---- Persistência (coleção planejamento_economico) ----
      const col = $app.findCollectionByNameOrId('planejamento_economico')
      const rec = new Record(col)
      rec.set('usuario', auth.id)
      rec.set('empresa', empresaId)
      rec.set('ano_base', anoBase)
      rec.set('ano_projecao', anoProjecao)
      rec.set('benchmark_rotulo', String(body.benchmark_rotulo || ''))
      rec.set('benchmark_mencionado', String(parsed.benchmark_mencionado || ''))
      rec.set('parecer_geral', String(parsed.parecer_geral || ''))
      rec.set('receita_projetada', Number(parsed.receita_projetada) || 0)
      rec.set('contas', JSON.stringify(contasProj))
      if (projecaoMensal) {
        rec.set('projecao_mensal', JSON.stringify(projecaoMensal))
      }
      $app.save(rec)

      return e.json(200, {
        sucesso: true,
        regenerado: true,
        planejamento: {
          id: rec.id,
          empresa: empresaId,
          ano_base: anoBase,
          ano_projecao: anoProjecao,
          benchmark_rotulo: String(body.benchmark_rotulo || ''),
          benchmark_mencionado: String(parsed.benchmark_mencionado || ''),
          parecer_geral: String(parsed.parecer_geral || ''),
          receita_projetada: Number(parsed.receita_projetada) || 0,
          contas: contasProj,
          projecao_mensal: projecaoMensal,
          created: rec.getString('created'),
        },
      })
    } catch (erro) {
      return e.json(500, {
        sucesso: false,
        erro: erro && erro.message ? erro.message : 'Erro interno na análise do planejamento.',
      })
    }
  },
  $apis.requireAuth(),
)
