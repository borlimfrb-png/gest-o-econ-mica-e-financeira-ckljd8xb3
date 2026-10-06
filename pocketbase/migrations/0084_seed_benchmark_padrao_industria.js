/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // Migração idempotente para inserir ou atualizar o benchmark setorial padrão "Indústria"
    // Coleção: benchmarks_setoriais
    // Requisitos:
    // - setor: 'Indústria'
    // - descricao: 'Benchmark padrão Indústria — móveis de madeira (referência de mercado)'
    // - empresa: nula/vazia (benchmark setorial amplo, não restrito a uma empresa específica)
    // - user: usuário admin do sistema (se disponível) ou usuários existentes
    // - valores numéricos: razões e percentuais gravados conforme formato do app (0-1 vs números)
    // - cgl_referencia, ncg_referencia, saldoTesouraria_referencia: 0

    const benchCol = app.findCollectionByNameOrId('benchmarks_setoriais')

    const benchmarkValues = {
      setor: 'Indústria',
      descricao: 'Benchmark padrão Indústria — móveis de madeira (referência de mercado)',
      liquidezCorrente: 1.4,
      liquidezSeca: 1.0,
      liquidezImediata: 0.4,
      liquidezGeral: 1.2,
      endividamentoGeral: 0.55,
      composicaoEndividamento: 0.6,
      participacaoCapitalTerceiros: 0.55,
      imobilizacaoPL: 0.55,
      margemBruta: 0.35,
      margemOperacional: 0.08,
      margemLiquida: 0.05,
      roa: 0.06,
      roe: 0.14,
      giroAtivo: 1.5,
      autonomiaFinanceira: 0.45,
      dependenciaFinanceira: 0.55,
      dividaEquity: 1.2,
      margemEbitda: 0.12,
      coberturaJuros: 4.0,
      pme: 60,
      pmr: 40,
      pmp: 60,
      cicloOperacional: 100,
      cicloFinanceiro: 40,
      giroEstoque: 5,
      giroReceber: 8,
      giroFornecedores: 6,
      roic: 0.1,
      wacc: 0.12,
      spread: -0.02,
      cgl_referencia: 0,
      ncg_referencia: 0,
      saldoTesouraria_referencia: 0,
      empresa: '',
    }

    // Buscar usuários existentes para associar o benchmark setorial padrão
    let users = []
    try {
      users = app.findRecordsByFilter('_pb_users_auth_', '', 'created', 100, 0)
    } catch (_) {}

    // Se não encontrar usuários via filter, tentar encontrar admin por email
    if (!users || users.length === 0) {
      try {
        const adminUser = app.findAuthRecordByEmail('_pb_users_auth_', 'flavio@borlim.com.br')
        if (adminUser) users = [adminUser]
      } catch (_) {}
    }

    // Helper para aplicar valores a um record
    const setRecordValues = (record, userId) => {
      if (userId) {
        record.set('user', userId)
      }
      for (const [key, val] of Object.entries(benchmarkValues)) {
        record.set(key, val)
      }
    }

    if (users && users.length > 0) {
      for (const u of users) {
        let existingRecord = null

        // Tentar localizar se já existe registro com setor='Indústria' para esse user
        try {
          const records = app.findRecordsByFilter(
            'benchmarks_setoriais',
            `user = '${u.id}' && setor = 'Indústria'`,
            '',
            1,
            0,
          )
          if (records && records.length > 0) {
            existingRecord = records[0]
          }
        } catch (_) {}

        if (existingRecord) {
          // Atualiza registro existente (evitando conflito com idx_benchmarks_user_setor)
          setRecordValues(existingRecord, u.id)
          app.save(existingRecord)
          console.log(`[0084] Benchmark Indústria atualizado para usuário ${u.id}`)
        } else {
          // Insere novo registro
          const newRecord = new Record(benchCol)
          setRecordValues(newRecord, u.id)
          app.save(newRecord)
          console.log(`[0084] Benchmark Indústria inserido para usuário ${u.id}`)
        }
      }
    } else {
      // Caso incomum: sem usuários no banco, mas a coleção pode aceitar registro direto se user for nulo ou se banco permitir
      // Tentativa de verificação por setor direto
      let existingRecord = null
      try {
        const records = app.findRecordsByFilter(
          'benchmarks_setoriais',
          "setor = 'Indústria'",
          '',
          1,
          0,
        )
        if (records && records.length > 0) {
          existingRecord = records[0]
        }
      } catch (_) {}

      if (existingRecord) {
        setRecordValues(existingRecord, null)
        app.save(existingRecord)
      } else {
        try {
          const newRecord = new Record(benchCol)
          setRecordValues(newRecord, null)
          app.save(newRecord)
        } catch (e) {
          console.log('[0084] Não foi possível inserir sem usuário:', e)
        }
      }
    }
  },
  (app) => {
    // Reverter inserção do benchmark padrão Indústria
    try {
      const records = app.findRecordsByFilter(
        'benchmarks_setoriais',
        "setor = 'Indústria' && descricao = 'Benchmark padrão Indústria — móveis de madeira (referência de mercado)'",
        '',
        100,
        0,
      )
      if (records) {
        for (const r of records) {
          try {
            app.delete(r)
          } catch (_) {}
        }
      }
    } catch (_) {}
  },
)
