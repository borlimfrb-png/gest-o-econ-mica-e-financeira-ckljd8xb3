/// <reference path="../pb_data/types.d.ts" />

/**
 * POST /backend/v1/planejamento-economico/analizar
 * Agente nativo 'planejamento-economico' (migração 0108): recebe o DRE
 * Gerencial dos últimos 3 anos + ano atual CONTA POR CONTA, cruza com o
 * benchmark setorial ativo e projeta cada conta para o próximo ano.
 * Persiste a projeção na coleção planejamento_economico (por empresa/ano
 * base) para reabrir sem regerar. Perfis internos apenas (cliente bloqueado).
 */
routerAdd(
  'POST',
  '/backend/v1/planejamento-economico/analizar',
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

    try {
      const userId = e.auth?.id
      if (!userId) return e.unauthorizedError('auth required')
      if (e.auth.getString('role') === 'cliente') {
        return e.forbiddenError('Perfil cliente não tem acesso ao Planejamento Econômico.')
      }

      const body = e.requestInfo().body || {}
      const empresaId = String(body.empresa_id || '').trim()
      const empresaNome = String(body.empresa_nome || '').trim()
      const anoBase = Number(body.ano_base) || new Date().getFullYear()
      const contas = Array.isArray(body.contas) ? body.contas : []
      const benchmark = body.benchmark || {}
      const historicoPorConta = Array.isArray(body.historico_por_conta)
        ? body.historico_por_conta
        : []

      if (!empresaId) return e.badRequestError('empresa_id is required')
      if (!contas.length) return e.badRequestError('contas is required (DRE conta por conta)')
      if (!temAcesso(e.app, e.auth, empresaId)) {
        return e.forbiddenError('Você não tem permissão para planejar esta empresa.')
      }

      const anosHistorico = []
      for (const linha of historicoPorConta) {
        const anos = linha && linha.historico ? linha.historico : {}
        for (const k of Object.keys(anos)) {
          const a = Number(k)
          if (Number.isFinite(a) && !anosHistorico.includes(a)) anosHistorico.push(a)
        }
      }
      anosHistorico.sort()
      const anoProjecao = anoBase + 1

      // Contexto textual CONTA POR CONTA para o agente (últimos 3 anos + atual)
      const linhasContexto = []
      for (const linha of historicoPorConta) {
        const partes = []
        for (const a of anosHistorico) {
          const v = Number((linha.historico || {})[a])
          partes.push(`${a}: ${Number.isFinite(v) ? formatarBRL(v) : 'sem dado'}`)
        }
        linhasContexto.push(
          `- [${linha.codigo || 'sem código'}] ${linha.nome} | ${partes.join(' | ')}`,
        )
      }

      const benchLinhas = []
      if (benchmark && benchmark.rotuloSetor) {
        const itens = [
          ['Margem Bruta', benchmark.margemBruta],
          ['Margem Operacional', benchmark.margemOperacional],
          ['Margem EBITDA', benchmark.margemEbitda],
          ['Margem Líquida', benchmark.margemLiquida],
          ['ROE', benchmark.roe],
          ['Liquidez Corrente', benchmark.liquidezCorrente],
          ['Endividamento Geral', benchmark.endividamentoGeral],
        ]
        for (const [rotulo, val] of itens) {
          const n = Number(val)
          if (Number.isFinite(n)) benchLinhas.push(`- ${rotulo}: ${n}%`)
        }
      }

      const prompt = [
        `Empresa ativa: "${empresaNome}" (ID: ${empresaId}).`,
        `Exercício base (ano atual): ${anoBase}. Projeção solicitada para: ${anoProjecao}.`,
        `Histórico DRE CONTA POR CONTA (anos: ${anosHistorico.join(', ')}):`,
        ...linhasContexto,
        '',
        `BENCHMARK SETORIAL ATIVO da empresa (${benchmark.rotuloSetor || 'Indústria'}${benchmark.usarFallback ? ', padrão de mercado (fallback)' : ', cadastrado'}):`,
        ...(benchLinhas.length
          ? benchLinhas
          : ['- indisponível — use o padrão do setor de sua memória e cite isso']),
        '',
        'Projete CADA conta para ' + anoProjecao + ' e devolva APENAS o JSON no formato exigido.',
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

      const contasProj = Array.isArray(parsed.contas) ? parsed.contas : []
      if (!contasProj.length) {
        throw new Error('Agente não retornou contas projetadas.')
      }

      // Sanitização das contas projetadas
      const contasNormalizadas = contasProj.map((c) => ({
        codigo: String(c.codigo || ''),
        nome: String(c.nome || ''),
        valor_projetado: Number(c.valor_projetado) || 0,
        variacao_pct: Number(c.variacao_pct) || 0,
        confianca: ['alta', 'media', 'baixa'].includes(String(c.confianca))
          ? String(c.confianca)
          : 'media',
        comentario: String(c.comentario || ''),
      }))

      // Receita projetada: soma das contas de Receita (codificação 3.x ou tipo)
      let receitaProjetada = 0
      const codigosReceita = new Set(
        (Array.isArray(body.codigos_receita) ? body.codigos_receita : []).map(String),
      )
      for (const c of contasNormalizadas) {
        const ehReceita =
          codigosReceita.has(String(c.codigo)) ||
          /^receit/i.test(c.nome) ||
          /^3\./.test(String(c.codigo))
        if (ehReceita) receitaProjetada += Number(c.valor_projetado) || 0
      }

      const parecerGeral = String(parsed.parecer_geral || '')
      const benchmarkMencionado = String(parsed.benchmark_mencionado || '')

      // Persistência: um planejamento por empresa/ano base (reabre sem regerar)
      const col = e.app.findCollectionByNameOrId('planejamento_economico')
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
      rec.set('benchmark_rotulo', benchmark.rotuloSetor || 'Indústria')
      rec.set('parecer_geral', parecerGeral)
      rec.set('benchmark_mencionado', benchmarkMencionado)
      rec.set('receita_projetada', receitaProjetada)
      rec.set('contas', contasNormalizadas)
      e.app.save(rec)

      return e.json(200, {
        id: rec.id,
        empresa_id: empresaId,
        empresa_nome: empresaNome,
        ano_base: anoBase,
        ano_projecao: anoProjecao,
        benchmark_rotulo: rec.getString('benchmark_rotulo'),
        benchmark_mencionado: benchmarkMencionado,
        parecer_geral: parecerGeral,
        receita_projetada: receitaProjetada,
        contas: contasNormalizadas,
        salvo: true,
      })
    } catch (err) {
      if (err instanceof SkipAiConfigError) {
        return e.json(503, { error: 'Agente de IA temporariamente indisponível no servidor.' })
      }
      if (err instanceof SkipAiAgentsError || err instanceof SkipAiError) {
        const status = err.status || 502
        return e.json(status, { error: err.message || 'Falha na execução do agente.' })
      }
      return e.json(500, {
        error: err.message || 'Erro interno ao gerar o planejamento econômico.',
      })
    }
  },
  $apis.requireAuth(),
)
