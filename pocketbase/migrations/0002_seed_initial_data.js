migrate(
  (app) => {
    // 1. Seed Usuário: flavio@borlim.com.br / Skip@Pass
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    try {
      app.findAuthRecordByEmail('_pb_users_auth_', 'flavio@borlim.com.br')
    } catch (_) {
      const userRecord = new Record(users)
      userRecord.setEmail('flavio@borlim.com.br')
      userRecord.setPassword('Skip@Pass')
      userRecord.setVerified(true)
      userRecord.set('name', 'Flávio Borlim')
      app.save(userRecord)
    }

    const empresasCol = app.findCollectionByNameOrId('empresas')
    const balancosCol = app.findCollectionByNameOrId('balancos')
    const dreCol = app.findCollectionByNameOrId('dre')

    // 2. Seed Empresa 1: Indústrias Verde Vale Ltda
    let verdeVale
    try {
      verdeVale = app.findFirstRecordByData('empresas', 'cnpj', '12345678000190')
    } catch (_) {
      try {
        verdeVale = app.findFirstRecordByData('empresas', 'cnpj', '12.345.678/0001-90')
      } catch (_) {
        verdeVale = new Record(empresasCol)
        verdeVale.set('nome', 'Indústrias Verde Vale Ltda')
        verdeVale.set('cnpj', '12345678000190')
        verdeVale.set('segmento', 'Indústria')
        app.save(verdeVale)
      }
    }

    // 3. Balanços Verde Vale (2024 e 2023)
    // 2024
    try {
      const records = app.findRecordsByFilter(
        'balancos',
        `empresa = '${verdeVale.id}' && ano = 2024`,
        '',
        1,
        0,
      )
      if (records.length === 0) throw new Error('not found')
    } catch (_) {
      const b2024 = new Record(balancosCol)
      b2024.set('empresa', verdeVale.id)
      b2024.set('ano', 2024)
      b2024.set('caixa_equivalentes', 45000)
      b2024.set('aplicacoes_financeiras', 12000)
      b2024.set('contas_receber', 38000)
      b2024.set('estoques', 52000)
      b2024.set('impostos_recuperar', 6500)
      b2024.set('outros_ativo_circulante', 4200)
      b2024.set('realizavel_longo_prazo', 9500)
      b2024.set('investimentos', 15000)
      b2024.set('imobilizado', 142000)
      b2024.set('intangivel', 6800)
      b2024.set('fornecedores', 28000)
      b2024.set('emprestimos_curto_prazo', 18500)
      b2024.set('obrigacoes_trabalhistas', 9200)
      b2024.set('obrigacoes_tributarias', 12300)
      b2024.set('outros_passivo_circulante', 6000)
      b2024.set('emprestimos_longo_prazo', 45000)
      b2024.set('outras_obrigacoes_longo_prazo', 7500)
      b2024.set('capital_social', 120000)
      b2024.set('reservas_lucros', 48000)
      b2024.set('lucros_acumulados', 36500)
      app.save(b2024)
    }

    // 2023
    try {
      const records = app.findRecordsByFilter(
        'balancos',
        `empresa = '${verdeVale.id}' && ano = 2023`,
        '',
        1,
        0,
      )
      if (records.length === 0) throw new Error('not found')
    } catch (_) {
      const b2023 = new Record(balancosCol)
      b2023.set('empresa', verdeVale.id)
      b2023.set('ano', 2023)
      b2023.set('caixa_equivalentes', 28000)
      b2023.set('aplicacoes_financeiras', 8500)
      b2023.set('contas_receber', 32000)
      b2023.set('estoques', 47000)
      b2023.set('impostos_recuperar', 5800)
      b2023.set('outros_ativo_circulante', 3900)
      b2023.set('realizavel_longo_prazo', 8000)
      b2023.set('investimentos', 15000)
      b2023.set('imobilizado', 128000)
      b2023.set('intangivel', 6200)
      b2023.set('fornecedores', 24000)
      b2023.set('emprestimos_curto_prazo', 15000)
      b2023.set('obrigacoes_trabalhistas', 8400)
      b2023.set('obrigacoes_tributarias', 10900)
      b2023.set('outros_passivo_circulante', 5200)
      b2023.set('emprestimos_longo_prazo', 40000)
      b2023.set('outras_obrigacoes_longo_prazo', 6800)
      b2023.set('capital_social', 100000)
      b2023.set('reservas_lucros', 40000)
      b2023.set('lucros_acumulados', 32100)
      app.save(b2023)
    }

    // DRE Verde Vale
    // 2024
    try {
      const records = app.findRecordsByFilter(
        'dre',
        `empresa = '${verdeVale.id}' && ano = 2024`,
        '',
        1,
        0,
      )
      if (records.length === 0) throw new Error('not found')
    } catch (_) {
      const dre2024 = new Record(dreCol)
      dre2024.set('empresa', verdeVale.id)
      dre2024.set('ano', 2024)
      dre2024.set('receita_bruta', 485000)
      dre2024.set('deducoes_receita', 38800)
      dre2024.set('custo_mercadorias', 205000)
      dre2024.set('despesas_operacionais', 88000)
      dre2024.set('despesas_financeiras', 14200)
      dre2024.set('outras_receitas_despesas', 3000)
      dre2024.set('imposto_renda', 24000)
      app.save(dre2024)
    }

    // 2023
    try {
      const records = app.findRecordsByFilter(
        'dre',
        `empresa = '${verdeVale.id}' && ano = 2023`,
        '',
        1,
        0,
      )
      if (records.length === 0) throw new Error('not found')
    } catch (_) {
      const dre2023 = new Record(dreCol)
      dre2023.set('empresa', verdeVale.id)
      dre2023.set('ano', 2023)
      dre2023.set('receita_bruta', 432000)
      dre2023.set('deducoes_receita', 34560)
      dre2023.set('custo_mercadorias', 188000)
      dre2023.set('despesas_operacionais', 79000)
      dre2023.set('despesas_financeiras', 12500)
      dre2023.set('outras_receitas_despesas', 2200)
      dre2023.set('imposto_renda', 20500)
      app.save(dre2023)
    }

    // 4. Seed Empresa 2: Comercial Andrade S.A.
    let andrade
    try {
      andrade = app.findFirstRecordByData('empresas', 'cnpj', '98765432000110')
    } catch (_) {
      try {
        andrade = app.findFirstRecordByData('empresas', 'cnpj', '98.765.432/0001-10')
      } catch (_) {
        andrade = new Record(empresasCol)
        andrade.set('nome', 'Comercial Andrade S.A.')
        andrade.set('cnpj', '98765432000110')
        andrade.set('segmento', 'Comércio')
        app.save(andrade)
      }
    }

    // Balanços Comercial Andrade (2024 e 2023)
    // 2024
    try {
      const records = app.findRecordsByFilter(
        'balancos',
        `empresa = '${andrade.id}' && ano = 2024`,
        '',
        1,
        0,
      )
      if (records.length === 0) throw new Error('not found')
    } catch (_) {
      const b2024 = new Record(balancosCol)
      b2024.set('empresa', andrade.id)
      b2024.set('ano', 2024)
      b2024.set('caixa_equivalentes', 18000)
      b2024.set('aplicacoes_financeiras', 5000)
      b2024.set('contas_receber', 43000)
      b2024.set('estoques', 61000)
      b2024.set('impostos_recuperar', 4000)
      b2024.set('outros_ativo_circulante', 2000)
      b2024.set('realizavel_longo_prazo', 6000)
      b2024.set('investimentos', 8000)
      b2024.set('imobilizado', 95000)
      b2024.set('intangivel', 3500)
      b2024.set('fornecedores', 32000)
      b2024.set('emprestimos_curto_prazo', 15000)
      b2024.set('obrigacoes_trabalhistas', 8000)
      b2024.set('obrigacoes_tributarias', 9500)
      b2024.set('outros_passivo_circulante', 3500)
      b2024.set('emprestimos_longo_prazo', 28000)
      b2024.set('outras_obrigacoes_longo_prazo', 4000)
      b2024.set('capital_social', 70000)
      b2024.set('reservas_lucros', 25000)
      b2024.set('lucros_acumulados', 28000)
      app.save(b2024)
    }

    // 2023
    try {
      const records = app.findRecordsByFilter(
        'balancos',
        `empresa = '${andrade.id}' && ano = 2023`,
        '',
        1,
        0,
      )
      if (records.length === 0) throw new Error('not found')
    } catch (_) {
      const b2023 = new Record(balancosCol)
      b2023.set('empresa', andrade.id)
      b2023.set('ano', 2023)
      b2023.set('caixa_equivalentes', 12000)
      b2023.set('aplicacoes_financeiras', 3000)
      b2023.set('contas_receber', 38000)
      b2023.set('estoques', 55000)
      b2023.set('impostos_recuperar', 3500)
      b2023.set('outros_ativo_circulante', 1500)
      b2023.set('realizavel_longo_prazo', 5000)
      b2023.set('investimentos', 8000)
      b2023.set('imobilizado', 90000)
      b2023.set('intangivel', 3000)
      b2023.set('fornecedores', 25000)
      b2023.set('emprestimos_curto_prazo', 12000)
      b2023.set('obrigacoes_trabalhistas', 7000)
      b2023.set('obrigacoes_tributarias', 8200)
      b2023.set('outros_passivo_circulante', 2800)
      b2023.set('emprestimos_longo_prazo', 30000)
      b2023.set('outras_obrigacoes_longo_prazo', 3500)
      b2023.set('capital_social', 60000)
      b2023.set('reservas_lucros', 21000)
      b2023.set('lucros_acumulados', 23400)
      app.save(b2023)
    }

    // DRE Comercial Andrade
    // 2024
    try {
      const records = app.findRecordsByFilter(
        'dre',
        `empresa = '${andrade.id}' && ano = 2024`,
        '',
        1,
        0,
      )
      if (records.length === 0) throw new Error('not found')
    } catch (_) {
      const dre2024 = new Record(dreCol)
      dre2024.set('empresa', andrade.id)
      dre2024.set('ano', 2024)
      dre2024.set('receita_bruta', 610000)
      dre2024.set('deducoes_receita', 52000)
      dre2024.set('custo_mercadorias', 410000)
      dre2024.set('despesas_operacionais', 82000)
      dre2024.set('despesas_financeiras', 19000)
      dre2024.set('outras_receitas_despesas', 1500)
      dre2024.set('imposto_renda', 18000)
      app.save(dre2024)
    }

    // 2023
    try {
      const records = app.findRecordsByFilter(
        'dre',
        `empresa = '${andrade.id}' && ano = 2023`,
        '',
        1,
        0,
      )
      if (records.length === 0) throw new Error('not found')
    } catch (_) {
      const dre2023 = new Record(dreCol)
      dre2023.set('empresa', andrade.id)
      dre2023.set('ano', 2023)
      dre2023.set('receita_bruta', 540000)
      dre2023.set('deducoes_receita', 45000)
      dre2023.set('custo_mercadorias', 370000)
      dre2023.set('despesas_operacionais', 74000)
      dre2023.set('despesas_financeiras', 16000)
      dre2023.set('outras_receitas_despesas', 2000)
      dre2023.set('imposto_renda', 14500)
      app.save(dre2023)
    }
  },
  (app) => {
    // down logic
  },
)
