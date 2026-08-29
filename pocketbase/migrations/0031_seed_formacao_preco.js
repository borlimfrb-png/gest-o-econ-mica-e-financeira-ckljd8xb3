migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    let userRecord
    try {
      userRecord = app.findAuthRecordByEmail('_pb_users_auth_', 'flavio@borlim.com.br')
    } catch (_) {
      try {
        const records = app.findRecordsByFilter('_pb_users_auth_', '', '-created', 1, 0)
        if (records.length > 0) {
          userRecord = records[0]
        }
      } catch (_) {}
    }

    if (!userRecord) return
    const userId = userRecord.id

    // 1. Matérias-Primas Iniciais
    const materiasCol = app.findCollectionByNameOrId('materias_primas')
    const sampleMaterias = [
      {
        codigo: 'MP-001',
        nome: 'Aço Inox 304 (Chapa)',
        unidade: 'KG',
        categoria: 'Metais',
        custo_unitario: 35.5,
        estoque_atual: 120,
        observacoes: 'Espessura 2mm',
      },
      {
        codigo: 'MP-002',
        nome: 'Parafuso Sextavado M8',
        unidade: 'UN',
        categoria: 'Fixação',
        custo_unitario: 1.2,
        estoque_atual: 500,
        observacoes: 'Zincado branco',
      },
      {
        codigo: 'MP-003',
        nome: 'Tinta Eletrostática Epóxi',
        unidade: 'L',
        categoria: 'Acabamento',
        custo_unitario: 48.0,
        estoque_atual: 30,
        observacoes: 'Cor preto fosco',
      },
      {
        codigo: 'MP-004',
        nome: 'Caixa de Papelão Duplo 40x30x20',
        unidade: 'UN',
        categoria: 'Embalagem',
        custo_unitario: 4.5,
        estoque_atual: 250,
        observacoes: 'Embalagem de despacho',
      },
      {
        codigo: 'MP-005',
        nome: 'Plástico Bolha 1.20m',
        unidade: 'M',
        categoria: 'Embalagem',
        custo_unitario: 2.1,
        estoque_atual: 100,
        observacoes: 'Proteção interna',
      },
    ]

    const createdMaterias = []
    for (const m of sampleMaterias) {
      try {
        const existing = app.findRecordsByFilter(
          'materias_primas',
          `user = '${userId}' && codigo = '${m.codigo}'`,
          '',
          1,
          0,
        )
        if (existing.length > 0) {
          createdMaterias.push(existing[0])
          continue
        }
      } catch (_) {}

      const rec = new Record(materiasCol)
      rec.set('user', userId)
      rec.set('codigo', m.codigo)
      rec.set('nome', m.nome)
      rec.set('unidade', m.unidade)
      rec.set('categoria', m.categoria)
      rec.set('custo_unitario', m.custo_unitario)
      rec.set('estoque_atual', m.estoque_atual)
      rec.set('observacoes', m.observacoes)
      app.save(rec)
      createdMaterias.push(rec)
    }

    // 2. Produtos Iniciais
    const produtosCol = app.findCollectionByNameOrId('produtos')
    const sampleProdutos = [
      {
        codigo: 'PRD-001',
        nome: 'Gabinete Metálico Industrial Slim',
        unidade: 'UN',
        categoria: 'Gabinetes',
        custo: 105.7,
        preco_venda: 195.0,
        margem_desejada: 45,
        observacoes: 'Produto padrão linha premium',
      },
      {
        codigo: 'PRD-002',
        nome: 'Suporte Articulado Reforçado',
        unidade: 'UN',
        categoria: 'Suportes',
        custo: 58.2,
        preco_venda: 99.0,
        margem_desejada: 40,
        observacoes: 'Carga suportada até 50kg',
      },
      {
        codigo: 'PRD-003',
        nome: 'Painel Frontal Perfurado',
        unidade: 'UN',
        categoria: 'Painéis',
        custo: 42.0,
        preco_venda: 75.0,
        margem_desejada: 44,
        observacoes: 'Pintura a pó microtexturizada',
      },
    ]

    const createdProdutos = []
    for (const p of sampleProdutos) {
      try {
        const existing = app.findRecordsByFilter(
          'produtos',
          `user = '${userId}' && codigo = '${p.codigo}'`,
          '',
          1,
          0,
        )
        if (existing.length > 0) {
          createdProdutos.push(existing[0])
          continue
        }
      } catch (_) {}

      const rec = new Record(produtosCol)
      rec.set('user', userId)
      rec.set('codigo', p.codigo)
      rec.set('nome', p.nome)
      rec.set('unidade', p.unidade)
      rec.set('categoria', p.categoria)
      rec.set('custo', p.custo)
      rec.set('preco_venda', p.preco_venda)
      rec.set('margem_desejada', p.margem_desejada)
      rec.set('observacoes', p.observacoes)
      app.save(rec)
      createdProdutos.push(rec)
    }

    // 3. Ficha Técnica Inicial para PRD-001
    if (createdProdutos.length > 0 && createdMaterias.length >= 5) {
      const fichasCol = app.findCollectionByNameOrId('fichas_tecnicas')
      const prd1 = createdProdutos[0]
      try {
        const existing = app.findRecordsByFilter(
          'fichas_tecnicas',
          `user = '${userId}' && produto = '${prd1.id}'`,
          '',
          1,
          0,
        )
        if (existing.length === 0) {
          const itens = [
            {
              materia_prima_id: createdMaterias[0].id,
              materia_prima_nome: createdMaterias[0].getString('nome'),
              unidade: 'KG',
              custo_unitario: 35.5,
              quantidade: 2.2,
              subtotal: 78.1,
            },
            {
              materia_prima_id: createdMaterias[1].id,
              materia_prima_nome: createdMaterias[1].getString('nome'),
              unidade: 'UN',
              custo_unitario: 1.2,
              quantidade: 8,
              subtotal: 9.6,
            },
            {
              materia_prima_id: createdMaterias[2].id,
              materia_prima_nome: createdMaterias[2].getString('nome'),
              unidade: 'L',
              custo_unitario: 48.0,
              quantidade: 0.25,
              subtotal: 12.0,
            },
            {
              materia_prima_id: createdMaterias[3].id,
              materia_prima_nome: createdMaterias[3].getString('nome'),
              unidade: 'UN',
              custo_unitario: 4.5,
              quantidade: 1,
              subtotal: 4.5,
            },
            {
              materia_prima_id: createdMaterias[4].id,
              materia_prima_nome: createdMaterias[4].getString('nome'),
              unidade: 'M',
              custo_unitario: 2.1,
              quantidade: 0.7,
              subtotal: 1.5,
            },
          ]
          const custoMP = 105.7
          const outrosCustos = 15.0 // mão de obra direta / energia
          const custoTotal = custoMP + outrosCustos // 120.70
          const margem = 45 // 45%
          // Preço de venda sugerido: Custo / (1 - 0.45) = 120.70 / 0.55 = 219.45
          const precoSugerido = Math.round((custoTotal / (1 - margem / 100)) * 100) / 100

          const rec = new Record(fichasCol)
          rec.set('user', userId)
          rec.set('produto', prd1.id)
          rec.set('itens', itens)
          rec.set('custo_materia_prima', custoMP)
          rec.set('outros_custos', outrosCustos)
          rec.set('custo_total', custoTotal)
          rec.set('margem_desejada', margem)
          rec.set('preco_venda_sugerido', precoSugerido)
          rec.set(
            'observacoes',
            'Ficha padrão de fabricação com tempo de mão de obra de 20min e embalagem inclusa.',
          )
          app.save(rec)
        }
      } catch (_) {}
    }
  },
  (app) => {
    // rollback opcional
  },
)
