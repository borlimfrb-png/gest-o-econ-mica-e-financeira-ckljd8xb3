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
 *   ou { sucesso: false, error: "<motivo específico>" }.
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

    function formatarBRL(v) {
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        maximumFractionDigits: 0,
      }).format(Number(v) || 0)
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

      const prompt = [
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
        `Projete CADA conta para ${anoProjecao} e devolva APENAS o JSON no formato exigido.`,
      ].join('\n')

      const resultado = $ai
        .agent('planejamento-economico')
        .chat({ user_id: userId, message: prompt })

      // Parse tolerante do JSON do agente
      let conteudo = (resultado.content || '').trim()
      conteudo = conteudo
        .replace(/^```(?:json)?/i, '')
        .replace(/```$/, '')
        .trim()
      const inicio = conteudo.indexOf('{')
      const fim = conteudo.lastIndexOf('}')
      if (inicio < 0 || fim <= inicio) {
        throw new Error('Resposta do agente sem JSON válido.')
      }
      const parsed = JSON.parse(conteudo.slice(inicio, fim + 1))

      const contasAgente = Array.isArray(parsed.contas) ? parsed.contas : []
      if (!contasAgente.length) {
        throw new Error('Agente não retornou contas projetadas.')
      }

      // Índices do retorno do agente: por código e por nome
      const porCodigo = new Map()
      const porNome = new Map()
      for (const c of contasAgente) {
        const cod = String(c.codigo || '').trim()
        const nom = String(c.nome || '')
          .trim()
          .toLowerCase()
        if (cod && !porCodigo.has(cod)) porCodigo.set(cod, c)
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

      const parecerGeral = String(parsed.parecer_geral || '')
      const benchmarkMencionado = String(parsed.benchmark_mencionado || '')

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
