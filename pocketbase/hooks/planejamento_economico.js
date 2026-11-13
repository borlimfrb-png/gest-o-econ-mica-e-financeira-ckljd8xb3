/// <reference path="../pb_data/types.d.ts" />

/**
 * POST /backend/v1/planejamento-economico/analyze
 * Agente nativo 'planejamento-economico' (migração 0108): recebe o DRE
 * Gerencial dos últimos 3 anos + ano atual CONTA POR CONTA, cruza com o
 * benchmark setorial ativo e projeta cada conta para o próximo ano.
 *
 * Contrato (consumido por src/services/planejamentoEconomicoService.ts):
 * - Request: { empresa_id, empresa_nome, ano_base, ano_projecao,
 *   benchmark_rotulo, benchmark: { margem_bruta, margem_operacional,
 *   margem_ebitda, margem_liquida }, contas: [{ conta_id, codigo, nome,
 *   grupo, classificacao, centro_nome, anos: [a-3,a-2,a-1], atual,
 *   meses_com_dados }], forcar_regenerar }
 * - Sem forcar_regenerar: se já existe projeção salva (empresa/ano_base),
 *   devolve a salva com regenerado=false (reabrir NÃO regera).
 * - Response: { sucesso: true, planejamento: {...}, regenerado: boolean }
 *   ou { sucesso: false, error: "<motivo específico>" } — SEMPRE corpo JSON,
 *   em QUALQUER caminho (inclusive crash inesperado).
 */
routerAdd(
  'POST',
  '/backend/v1/planejamento-economico/analyze',
  (e) => {
    function temAcesso(app, authUser, empresaId) {
      if (!authUser || authUser.getString('role') === 'cliente') return false
      if (authUser.getString('role') === 'admin') return true
      const empId = String(empresaId || '').trim()
      if (!empId) return false
      if (empId.startsWith('grupo-')) {
        const rawGrupoId = empId.replace(/^grupo-/, '')
        const grupos = authUser.getStringSlice('grupos_empresariais') || []
        if (grupos.includes(rawGrupoId)) return true
        try {
          const empresasDoGrupo =
            app.findRecordById('grupos_empresariais', rawGrupoId).getStringSlice('empresas') || []
          const userEmpresas = authUser.getStringSlice('empresas') || []
          const legado = authUser.getString('empresa')
          if (legado && !userEmpresas.includes(legado)) userEmpresas.push(legado)
          return empresasDoGrupo.some((id) => userEmpresas.includes(id))
        } catch (_) {
          return false
        }
      }
      const userEmpresas = authUser.getStringSlice('empresas') || []
      const legado = authUser.getString('empresa')
      if (legado && !userEmpresas.includes(legado)) userEmpresas.push(legado)
      if (userEmpresas.includes(empId)) return true
      const grupos = authUser.getStringSlice('grupos_empresariais') || []
      for (let i = 0; i < grupos.length; i++) {
        try {
          const empresasDoGrupo =
            app.findRecordById('grupos_empresariais', grupos[i]).getStringSlice('empresas') || []
          if (empresasDoGrupo.includes(empId)) return true
        } catch (_) {}
      }
      return false
    }

    // O JSVM dos hooks do PocketBase NÃO tem o objeto Intl — formatação
    // manual (pt-BR: R$ + milhares com ponto, sem decimais neste contexto).
    function formatarBRL(v) {
      const n = Math.round(Number(v) || 0)
      const sinal = n < 0 ? '-' : ''
      const milhares = Math.abs(n)
        .toString()
        .split('')
        .reverse()
        .join('')
        .replace(/(\d{3})(?=\d)/g, '$1.')
        .split('')
        .reverse()
        .join('')
      return 'R$ ' + sinal + milhares
    }

    function shapePlanejamento(rec, contasNormalizadas) {
      return {
        id: rec.id,
        empresa: rec.getString('empresa'),
        ano_base: rec.getInt('ano_base'),
        ano_projecao: rec.getInt('ano_projecao'),
        benchmark_rotulo: rec.getString('benchmark_rotulo'),
        benchmark_mencionado: rec.getString('benchmark_mencionado'),
        parecer_geral: rec.getString('parecer_geral'),
        receita_projetada: rec.getFloat('receita_projetada') || 0,
        contas: contasNormalizadas,
        created: rec.getString('created'),
      }
    }

    // Extrai JSON tolerante: remove cercas de código e recorta do 1º '{' ao
    // último '}'. Se o texto veio truncado (fim cortado pelo provedor), repara
    // fechando strings/arrays/objetos abertos antes de parsear.
    function extrairJson(texto) {
      let conteudo = String(texto || '').trim()
      conteudo = conteudo
        .replace(/^```(?:json)?/i, '')
        .replace(/```$/, '')
        .trim()
      let inicio = conteudo.indexOf('{')
      let fim = conteudo.lastIndexOf('}')
      if (inicio < 0 || fim < inicio) return null
      let candidato = conteudo.slice(inicio, fim + 1)
      let parsed = null
      try {
        parsed = JSON.parse(candidato)
      } catch (_) {
        parsed = null
      }
      if (parsed === null || typeof parsed !== 'object') {
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
        // Remove vírgula solta no fim (após fechar string truncada)
        reparado = reparado.replace(/,\s*$/, '')
        for (let i = pilha.length - 1; i >= 0; i--) {
          reparado += pilha[i] === '{' ? '}' : ']'
        }
        parsed = JSON.parse(reparado) // pode lançar — quem chama trata
      }
      return parsed
    }

    // Converte o JSON (possivelmente incompleto) do agente em contas
    // normalizadas. Contas já emitidas antes do corte entram; a falta do
    // fechamento não impede o aproveitamento parcial.
    function contasDoAgente(parsed) {
      if (!parsed || typeof parsed !== 'object') return []
      const brutas = Array.isArray(parsed.contas) ? parsed.contas : []
      const saida = []
      for (const c of brutas) {
        if (!c || typeof c !== 'object') continue
        const nome = String(c.nome || '').trim()
        if (!nome) continue
        saida.push({
          codigo: String(c.codigo || '').trim(),
          nome: nome,
          valor_projetado: Number(c.valor_projetado),
          variacao_pct: Number(c.variacao_pct),
          confianca: String(c.confianca || ''),
          comentario: String(c.comentario || ''),
        })
      }
      return saida
    }

    // Uma tentativa de análise: chama o agente e interpreta a resposta.
    // Retorna { ok, contas, parecer, benchmark, motivo }.
    function executarAnaliseAgente(userId, prompt) {
      const resultado = $ai
        .agent('planejamento-economico')
        .chat({ user_id: userId, message: prompt })

      const bruto = String((resultado && resultado.content) || '')
      console.log(
        '[Planejamento Economico] resposta do agente recebida: ' +
          bruto.length +
          ' chars; fim: ' +
          JSON.stringify(bruto.slice(-120)),
      )

      let parsed = null
      try {
        parsed = extrairJson(bruto)
      } catch (errParse) {
        return {
          ok: false,
          motivo:
            'A resposta do agente veio truncada/ilegível (' + (errParse.message || 'EOF') + ').',
        }
      }
      if (!parsed) {
        return {
          ok: false,
          motivo: 'O agente não devolveu JSON válido (resposta sem estrutura esperada).',
        }
      }

      const contas = contasDoAgente(parsed)
      if (!contas.length) {
        return {
          ok: false,
          motivo: 'O agente respondeu, mas sem contas projetadas no JSON.',
        }
      }
      return {
        ok: true,
        contas: contas,
        parecer: String(parsed.parecer_geral || ''),
        benchmark: String(parsed.benchmark_mencionado || ''),
      }
    }

    try {
      const userId = e.auth?.id
      if (!userId) return e.unauthorizedError('Sessão expirada — faça login novamente.')
      if (e.auth.getString('role') === 'cliente') {
        return e.forbiddenError('Perfil cliente não tem acesso ao Planejamento Econômico.')
      }

      const body = e.requestInfo().body || {}
      const empresaId = String(body.empresa_id || '').trim()
      const empresaNome = String(body.empresa_nome || '').trim()
      const anoBase = Number(body.ano_base) || new Date().getFullYear()
      const anoProjecao = Number(body.ano_projecao) || anoBase + 1
      const benchmarkRotulo = String(body.benchmark_rotulo || '').trim()
      const benchmark = body.benchmark || {}
      const contasEntrada = Array.isArray(body.contas) ? body.contas : []
      const forcarRegenerar = body.forcar_regenerar === true

      if (!empresaId) return e.badRequestError('empresa_id é obrigatório.')
      if (!contasEntrada.length) {
        return e.badRequestError('Nenhuma conta do DRE informada (contas é obrigatório).')
      }
      if (!temAcesso(e.app, e.auth, empresaId)) {
        return e.forbiddenError('Você não tem permissão para planejar esta empresa.')
      }

      const col = e.app.findCollectionByNameOrId('planejamento_economico')

      // Reabrir sem regerar: projeção salva para empresa/ano base
      if (!forcarRegenerar) {
        let salva = null
        try {
          salva = e.app.findFirstRecordByFilter(
            col,
            'empresa = {:empresaId} && ano_base = {:anoBase}',
            { empresaId, anoBase },
          )
        } catch (_) {
          salva = null
        }
        if (salva) {
          const contasSalvas = salva.get('contas')
          return e.json(200, {
            sucesso: true,
            regenerado: false,
            planejamento: shapePlanejamento(salva, Array.isArray(contasSalvas) ? contasSalvas : []),
          })
        }
      }

      // Prompt CONTA POR CONTA para o agente nativo
      const anosHistorico = [anoBase - 3, anoBase - 2, anoBase - 1]
      const linhasContexto = []
      for (const linha of contasEntrada) {
        const anos = Array.isArray(linha.anos) ? linha.anos : []
        const partes = []
        for (let i = 0; i < anosHistorico.length; i++) {
          const v = Number(anos[i])
          partes.push(
            `${anosHistorico[i]}: ${Number.isFinite(v) && v !== 0 ? formatarBRL(v) : 'sem dado'}`,
          )
        }
        partes.push(
          `${anoBase} (atual): ${Number(linha.atual) ? formatarBRL(linha.atual) : 'sem dado'}`,
        )
        linhasContexto.push(
          `- [${linha.codigo || 'sem código'}] ${linha.nome} (classificação: ${
            linha.classificacao || 'NaoClassificado'
          }) | ${partes.join(' | ')}`,
        )
      }

      const benchLinhas = []
      const benchItens = [
        ['Margem Bruta', benchmark.margem_bruta],
        ['Margem Operacional', benchmark.margem_operacional],
        ['Margem EBITDA', benchmark.margem_ebitda],
        ['Margem Líquida', benchmark.margem_liquida],
      ]
      for (const [rotulo, val] of benchItens) {
        const n = Number(val)
        if (Number.isFinite(n)) benchLinhas.push(`- ${rotulo}: ${n}%`)
      }

      const detalheErro = [
        'Devolva no campo "contas" TODAS as ' +
          contasEntrada.length +
          ' contas listadas, na MESMA ordem em que aparecem no histórico. Para cada conta: codigo, nome, valor_projetado (número em reais do exercício ' +
          anoProjecao +
          '), variacao_pct (número, % vs exercício base), confianca ("alta"|"media"|"baixa") e comentario curto (1 frase).',
        'Devolva APENAS o JSON minificado (sem formatação, sem texto fora do JSON, sem markdown).',
      ].join('\n')

      const basePrompt = [
        `Empresa ativa: "${empresaNome}" (ID: ${empresaId}).`,
        `Exercício base (ano atual): ${anoBase}. Projeção solicitada para: ${anoProjecao}.`,
        `Histórico DRE CONTA POR CONTA (anos: ${anosHistorico.join(', ')} + atual ${anoBase}):`,
        ...linhasContexto,
        '',
        `BENCHMARK SETORIAL ATIVO da empresa (${benchmarkRotulo || 'Indústria'}):`,
        ...(benchLinhas.length
          ? benchLinhas
          : ['- indisponível — use o padrão do setor de sua memória e cite isso']),
        '',
        `Projete CADA conta para ${anoProjecao}. ${detalheErro}`,
      ].join('\n')

      // Tentativa 1
      let analise = executarAnaliseAgente(userId, basePrompt)
      // Tentativa 2: mesmo JSON, mas pede compacto (reduz risco de corte)
      if (!analise.ok) {
        console.log('[Planejamento Economico] tentativa 1 falhou: ' + analise.motivo)
        analise = executarAnaliseAgente(
          userId,
          basePrompt +
            '\n\nIMPORTANTE: responda na forma MAIS COMPACTA possível (JSON minificado, comentários com no máximo 12 palavras) para não faltar espaço na resposta.',
        )
      }
      if (!analise.ok) {
        console.log('[Planejamento Economico] tentativa 2 falhou: ' + analise.motivo)
        return e.json(502, {
          sucesso: false,
          error:
            'O agente de IA não retornou a análise completa (' +
            analise.motivo +
            ') Tente regenerar — se persistir, reduza o número de contas do DRE.',
        })
      }

      const contasAgente = analise.contas
      const parecerGeral = analise.parecer
      const benchmarkMencionado = analise.benchmark

      // Índices do retorno do agente: por código e por nome
      const porCodigo = new Map()
      const porNome = new Map()
      for (const c of contasAgente) {
        if (c.codigo && !porCodigo.has(c.codigo)) porCodigo.set(c.codigo, c)
        const nom = c.nome.toLowerCase()
        if (nom && !porNome.has(nom)) porNome.set(nom, c)
      }

      // Mescla: mantém TODAS as contas de entrada (mesma ordem), anexando a
      // projeção do agente; conta sem projeção mantém o valor atual (baixa).
      const contasNormalizadas = contasEntrada.map((linha) => {
        const cod = String(linha.codigo || '').trim()
        const nom = String(linha.nome || '')
          .trim()
          .toLowerCase()
        const proj = (cod && porCodigo.get(cod)) || porNome.get(nom) || null
        const atual = Number(linha.atual) || 0
        let valorProjetado = Number(proj ? proj.valor_projetado : NaN)
        if (!Number.isFinite(valorProjetado)) valorProjetado = atual
        let variacaoPct = Number(proj ? proj.variacao_pct : NaN)
        if (!Number.isFinite(variacaoPct)) {
          variacaoPct = atual !== 0 ? ((valorProjetado - atual) / Math.abs(atual)) * 100 : 0
        }
        const comentario = proj
          ? String(proj.comentario || '')
          : 'Sem projeção dedicada do agente — mantido o valor do exercício base.'
        const confianca = ['alta', 'media', 'baixa'].includes(String(proj && proj.confianca))
          ? String(proj.confianca)
          : 'baixa'
        return {
          conta_id: String(linha.conta_id || ''),
          codigo: String(linha.codigo || ''),
          nome: String(linha.nome || ''),
          grupo: String(linha.grupo || ''),
          classificacao: String(linha.classificacao || 'NaoClassificado'),
          centro_nome: String(linha.centro_nome || ''),
          anos: (Array.isArray(linha.anos) ? linha.anos : []).map((v) => Number(v) || 0),
          atual,
          valor_projetado: valorProjetado,
          variacao_pct: variacaoPct,
          confianca,
          comentario,
        }
      })

      // Receita projetada: soma das contas classificadas como Receita
      let receitaProjetada = 0
      for (const c of contasNormalizadas) {
        if (c.classificacao === 'Receita') receitaProjetada += c.valor_projetado
      }

      // Persistência: um planejamento por empresa/ano base (reabre sem regerar)
      let rec = null
      try {
        rec = e.app.findFirstRecordByFilter(
          col,
          'empresa = {:empresaId} && ano_base = {:anoBase}',
          { empresaId, anoBase },
        )
      } catch (_) {
        rec = null
      }
      if (!rec) rec = new Record(col)

      rec.set('usuario', userId)
      rec.set('empresa', empresaId)
      rec.set('ano_base', anoBase)
      rec.set('ano_projecao', anoProjecao)
      rec.set('benchmark_rotulo', benchmarkRotulo || 'Indústria')
      rec.set('parecer_geral', parecerGeral)
      rec.set('benchmark_mencionado', benchmarkMencionado)
      rec.set('receita_projetada', receitaProjetada)
      rec.set('contas', contasNormalizadas)
      e.app.save(rec)

      return e.json(200, {
        sucesso: true,
        regenerado: true,
        planejamento: shapePlanejamento(rec, contasNormalizadas),
      })
    } catch (err) {
      console.log(
        '[Planejamento Economico] erro inesperado: ' + (err && err.message ? err.message : err),
      )
      if (err instanceof SkipAiConfigError) {
        return e.json(503, {
          sucesso: false,
          error:
            'Agente de IA temporariamente indisponível no servidor (configuração ausente). Tente novamente em alguns minutos.',
        })
      }
      if (err instanceof SkipAiAgentsError || err instanceof SkipAiError) {
        const status = err.status || 502
        return e.json(status, {
          sucesso: false,
          error:
            status >= 500
              ? 'O agente de IA falhou ao processar a análise (' +
                status +
                '). Tente novamente — se persistir, verifique o serviço de IA.'
              : err.message || 'Falha na execução do agente.',
        })
      }
      return e.json(500, {
        sucesso: false,
        error: err.message || 'Erro interno ao gerar o planejamento econômico.',
      })
    }
  },
  $apis.requireAuth(),
)
