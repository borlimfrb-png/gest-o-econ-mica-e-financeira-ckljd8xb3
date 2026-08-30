import pb from '@/lib/pocketbase/client'
import type {
  ProdutoRecord,
  MateriaPrimaRecord,
  FichaTecnicaRecord,
  ItemFichaTecnica,
  HistoricoPrecoProdutoRecord,
  OrigemAlteracaoPreco,
  ConfiguracaoTributariaRecord,
} from '@/types/finance'

export interface ProdutoInput {
  codigo?: string
  nome: string
  unidade: string
  categoria?: string
  custo?: number
  preco_venda?: number
  margem_desejada?: number
  observacoes?: string
}

export interface HistoricoPrecoInput {
  produto: string
  preco_anterior?: number | null
  preco_novo: number
  margem_anterior?: number | null
  margem_nova?: number | null
  custo_momento?: number | null
  origem: OrigemAlteracaoPreco
  observacao?: string
}

export interface ConfiguracaoTributariaInput {
  empresa: string
  regime_tributario: 'Lucro Real' | 'Lucro Presumido' | 'Simples Nacional'
  aliquota_simples_efetiva?: number
  anexo_simples?: string
  faixa_simples?: string
  aliquota_pis?: number
  aliquota_cofins?: number
  aliquota_icms?: number
  aliquota_ipi?: number
  aliquota_iss?: number
  aliquota_irpj?: number
  aliquota_csll?: number
  outros_impostos?: number
  carga_tributaria_total?: number
  fator_por_dentro?: number
  observacoes?: string
}

export interface MateriaPrimaInput {
  codigo?: string
  nome: string
  unidade: string
  categoria?: string
  custo_unitario?: number
  estoque_atual?: number
  estoque_minimo?: number
  observacoes?: string
}

export interface FichaTecnicaInput {
  produto: string
  itens: ItemFichaTecnica[]
  custo_materia_prima: number
  outros_custos?: number
  custo_total: number
  margem_desejada?: number
  preco_venda_sugerido?: number
  markup_desejado?: number
  preco_venda_markup?: number
  observacoes?: string
}

function getUserId(): string {
  const user = pb.authStore.record
  if (!user?.id) throw new Error('Usuário não autenticado')
  return user.id
}

// -------------------------------------------------------------
// SERVIÇO: HISTÓRICO DE PREÇOS
// -------------------------------------------------------------
export const historicoPrecosService = {
  async getByProduto(produtoId: string): Promise<HistoricoPrecoProdutoRecord[]> {
    const userId = getUserId()
    return pb.collection('historico_precos_produtos').getFullList<HistoricoPrecoProdutoRecord>({
      filter: `user = "${userId}" && produto = "${produtoId}"`,
      sort: '-created',
      expand: 'produto',
    })
  },

  async getAll(): Promise<HistoricoPrecoProdutoRecord[]> {
    const userId = getUserId()
    return pb.collection('historico_precos_produtos').getFullList<HistoricoPrecoProdutoRecord>({
      filter: `user = "${userId}"`,
      sort: '-created',
      expand: 'produto',
    })
  },

  async recordChange(data: HistoricoPrecoInput): Promise<HistoricoPrecoProdutoRecord> {
    const userId = getUserId()
    return pb.collection('historico_precos_produtos').create<HistoricoPrecoProdutoRecord>({
      ...data,
      user: userId,
    })
  },
}

// -------------------------------------------------------------
// SERVIÇO: PRODUTOS
// -------------------------------------------------------------
export const produtosService = {
  async getAll(): Promise<ProdutoRecord[]> {
    const userId = getUserId()
    return pb.collection('produtos').getFullList<ProdutoRecord>({
      filter: `user = "${userId}"`,
      sort: 'nome',
    })
  },

  async getById(id: string): Promise<ProdutoRecord> {
    return pb.collection('produtos').getOne<ProdutoRecord>(id)
  },

  async create(data: ProdutoInput): Promise<ProdutoRecord> {
    const userId = getUserId()
    const record = await pb.collection('produtos').create<ProdutoRecord>({
      ...data,
      user: userId,
    })

    // Se cadastrou com preço de venda inicial, registra no histórico
    if (data.preco_venda !== undefined && data.preco_venda !== null && data.preco_venda > 0) {
      try {
        await pb.collection('historico_precos_produtos').create({
          user: userId,
          produto: record.id,
          preco_anterior: null,
          preco_novo: data.preco_venda,
          margem_anterior: null,
          margem_nova: data.margem_desejada ?? null,
          custo_momento: data.custo ?? null,
          origem: 'Cadastro Inicial',
          observacao: 'Preço inicial definido no cadastro do produto',
        })
      } catch (e) {
        console.warn('Não foi possível gravar histórico inicial de preço:', e)
      }
    }

    return record
  },

  async update(
    id: string,
    data: Partial<ProdutoInput>,
    options?: {
      origem?: OrigemAlteracaoPreco
      observacao?: string
    },
  ): Promise<ProdutoRecord> {
    const userId = getUserId()
    let produtoAnterior: ProdutoRecord | null = null

    try {
      produtoAnterior = await pb.collection('produtos').getOne<ProdutoRecord>(id)
    } catch {
      // Ignora erro se não encontrar
    }

    const record = await pb.collection('produtos').update<ProdutoRecord>(id, data)

    // Se houve alteração no preco_venda, registra no histórico
    if (
      data.preco_venda !== undefined &&
      data.preco_venda !== null &&
      produtoAnterior &&
      Number(produtoAnterior.preco_venda) !== Number(data.preco_venda)
    ) {
      try {
        await pb.collection('historico_precos_produtos').create({
          user: userId,
          produto: record.id,
          preco_anterior: produtoAnterior.preco_venda ?? null,
          preco_novo: data.preco_venda,
          margem_anterior: produtoAnterior.margem_desejada ?? null,
          margem_nova: data.margem_desejada ?? produtoAnterior.margem_desejada ?? null,
          custo_momento: data.custo ?? produtoAnterior.custo ?? null,
          origem: options?.origem || 'Edição Manual',
          observacao: options?.observacao || 'Alteração manual no cadastro do produto',
        })
      } catch (e) {
        console.warn('Não foi possível registrar histórico de alteração de preço:', e)
      }
    }

    return record
  },

  async delete(id: string): Promise<boolean> {
    return pb.collection('produtos').delete(id)
  },
}

// -------------------------------------------------------------
// SERVIÇO: MATÉRIAS-PRIMAS
// -------------------------------------------------------------
export const materiasPrimasService = {
  async getAll(): Promise<MateriaPrimaRecord[]> {
    const userId = getUserId()
    return pb.collection('materias_primas').getFullList<MateriaPrimaRecord>({
      filter: `user = "${userId}"`,
      sort: 'nome',
    })
  },

  async getById(id: string): Promise<MateriaPrimaRecord> {
    return pb.collection('materias_primas').getOne<MateriaPrimaRecord>(id)
  },

  async create(data: MateriaPrimaInput): Promise<MateriaPrimaRecord> {
    const userId = getUserId()
    return pb.collection('materias_primas').create<MateriaPrimaRecord>({
      ...data,
      user: userId,
    })
  },

  async update(id: string, data: Partial<MateriaPrimaInput>): Promise<MateriaPrimaRecord> {
    return pb.collection('materias_primas').update<MateriaPrimaRecord>(id, data)
  },

  async delete(id: string): Promise<boolean> {
    return pb.collection('materias_primas').delete(id)
  },
}

// -------------------------------------------------------------
// SERVIÇO: CONFIGURAÇÕES TRIBUTÁRIAS
// -------------------------------------------------------------
export const configuracoesTributariasService = {
  async getAll(): Promise<ConfiguracaoTributariaRecord[]> {
    const userId = getUserId()
    return pb.collection('configuracoes_tributarias').getFullList<ConfiguracaoTributariaRecord>({
      filter: `user = "${userId}"`,
      sort: '-updated',
      expand: 'empresa',
    })
  },

  async getByEmpresa(empresaId: string): Promise<ConfiguracaoTributariaRecord | null> {
    const userId = getUserId()
    if (!empresaId) return null
    try {
      const records = await pb
        .collection('configuracoes_tributarias')
        .getFullList<ConfiguracaoTributariaRecord>({
          filter: `user = "${userId}" && empresa = "${empresaId}"`,
          sort: '-updated',
          expand: 'empresa',
        })
      return records.length > 0 ? records[0] : null
    } catch {
      return null
    }
  },

  async saveOrUpdate(data: ConfiguracaoTributariaInput): Promise<ConfiguracaoTributariaRecord> {
    const userId = getUserId()
    const existing = await this.getByEmpresa(data.empresa)

    if (existing) {
      return pb.collection('configuracoes_tributarias').update<ConfiguracaoTributariaRecord>(
        existing.id,
        {
          ...data,
          user: userId,
        },
        {
          expand: 'empresa',
        },
      )
    } else {
      return pb.collection('configuracoes_tributarias').create<ConfiguracaoTributariaRecord>(
        {
          ...data,
          user: userId,
        },
        {
          expand: 'empresa',
        },
      )
    }
  },

  async delete(id: string): Promise<boolean> {
    return pb.collection('configuracoes_tributarias').delete(id)
  },
}

// -------------------------------------------------------------
// SERVIÇO: FICHAS TÉCNICAS
// -------------------------------------------------------------
export const fichasTecnicasService = {
  async getAll(): Promise<FichaTecnicaRecord[]> {
    const userId = getUserId()
    return pb.collection('fichas_tecnicas').getFullList<FichaTecnicaRecord>({
      filter: `user = "${userId}"`,
      sort: '-created',
      expand: 'produto',
    })
  },

  async getById(id: string): Promise<FichaTecnicaRecord> {
    return pb.collection('fichas_tecnicas').getOne<FichaTecnicaRecord>(id, {
      expand: 'produto',
    })
  },

  async getByProduto(produtoId: string): Promise<FichaTecnicaRecord | null> {
    const userId = getUserId()
    try {
      const records = await pb.collection('fichas_tecnicas').getFullList<FichaTecnicaRecord>({
        filter: `user = "${userId}" && produto = "${produtoId}"`,
        sort: '-created',
        expand: 'produto',
      })
      return records.length > 0 ? records[0] : null
    } catch {
      return null
    }
  },

  async create(data: FichaTecnicaInput): Promise<FichaTecnicaRecord> {
    const userId = getUserId()
    const record = await pb.collection('fichas_tecnicas').create<FichaTecnicaRecord>(
      {
        ...data,
        user: userId,
      },
      {
        expand: 'produto',
      },
    )

    // Sincroniza o custo no produto vinculado
    try {
      await pb.collection('produtos').update(data.produto, {
        custo: data.custo_total,
        margem_desejada: data.margem_desejada ?? undefined,
      })
    } catch (err) {
      console.warn('Não foi possível sincronizar o custo do produto com a ficha técnica:', err)
    }

    return record
  },

  async update(id: string, data: Partial<FichaTecnicaInput>): Promise<FichaTecnicaRecord> {
    const record = await pb.collection('fichas_tecnicas').update<FichaTecnicaRecord>(id, data, {
      expand: 'produto',
    })

    if (data.produto && data.custo_total !== undefined) {
      try {
        await pb.collection('produtos').update(data.produto, {
          custo: data.custo_total,
          margem_desejada: data.margem_desejada ?? undefined,
        })
      } catch (err) {
        console.warn('Não foi possível sincronizar o custo do produto com a ficha técnica:', err)
      }
    }

    return record
  },

  async vincularPrecoAoProduto(
    produtoId: string,
    precoVenda: number,
    margem?: number,
    tipoOrigem: 'Preço Sugerido Margem' | 'Preço Sugerido Markup' = 'Preço Sugerido Margem',
    observacaoExtra?: string,
  ): Promise<ProdutoRecord> {
    const userId = getUserId()
    const precoArredondado = Math.round(precoVenda * 100) / 100
    const payload: Partial<ProdutoInput> = {
      preco_venda: precoArredondado,
    }
    if (margem !== undefined && margem !== null && !isNaN(margem)) {
      payload.margem_desejada = Math.round(margem * 10) / 10
    }

    let produtoAnterior: ProdutoRecord | null = null
    try {
      produtoAnterior = await pb.collection('produtos').getOne<ProdutoRecord>(produtoId)
    } catch {
      // Ignora erro
    }

    const updated = await pb.collection('produtos').update<ProdutoRecord>(produtoId, payload)

    // Registra alteração no histórico de preços
    try {
      await pb.collection('historico_precos_produtos').create({
        user: userId,
        produto: produtoId,
        preco_anterior: produtoAnterior?.preco_venda ?? null,
        preco_novo: precoArredondado,
        margem_anterior: produtoAnterior?.margem_desejada ?? null,
        margem_nova: payload.margem_desejada ?? produtoAnterior?.margem_desejada ?? null,
        custo_momento: updated.custo ?? produtoAnterior?.custo ?? null,
        origem: tipoOrigem,
        observacao:
          observacaoExtra ||
          (tipoOrigem === 'Preço Sugerido Margem'
            ? 'Vínculo do Preço Sugerido por Margem da Ficha Técnica'
            : 'Vínculo do Preço Sugerido por Markup da Ficha Técnica'),
      })
    } catch (e) {
      console.warn('Não foi possível gravar histórico de preço do vínculo:', e)
    }

    return updated
  },

  async delete(id: string): Promise<boolean> {
    return pb.collection('fichas_tecnicas').delete(id)
  },

  async clone(
    id: string,
    options?: {
      criarNovoProduto?: boolean
      novoProdutoNome?: string
      novoProdutoCodigo?: string
      novoProdutoCategoria?: string
      novoProdutoUnidade?: string
      targetProdutoId?: string
      observacoes?: string
      ajustePercentualInsumos?: number // Opcional: ex +10% ou -5% nos custos ou quantidades
    },
  ): Promise<FichaTecnicaRecord> {
    const userId = getUserId()
    const originalFicha = await this.getById(id)
    let targetProdutoId = options?.targetProdutoId

    // Se solicitado criar novo produto como cópia do produto original (ou sem targetProdutoId)
    if (options?.criarNovoProduto || !targetProdutoId) {
      let originalProd: ProdutoRecord | null = originalFicha.expand?.produto || null
      if (!originalProd && originalFicha.produto) {
        try {
          originalProd = await pb
            .collection('produtos')
            .getOne<ProdutoRecord>(originalFicha.produto)
        } catch {
          // Ignora se não encontrar
        }
      }

      const originalNome = originalProd?.nome || 'Produto'
      const novoNome = options?.novoProdutoNome?.trim() || `${originalNome} (Variação)`
      const novoCodigo =
        options?.novoProdutoCodigo?.trim() ||
        (originalProd?.codigo ? `${originalProd.codigo}-VAR` : undefined)
      const novaUnidade = options?.novoProdutoUnidade?.trim() || originalProd?.unidade || 'UN'
      const novaCategoria =
        options?.novoProdutoCategoria?.trim() || originalProd?.categoria || undefined

      const novoProduto = await pb.collection('produtos').create<ProdutoRecord>({
        user: userId,
        codigo: novoCodigo,
        nome: novoNome,
        unidade: novaUnidade,
        categoria: novaCategoria,
        custo: originalFicha.custo_total,
        preco_venda: originalFicha.preco_venda_sugerido ?? originalProd?.preco_venda,
        margem_desejada: originalFicha.margem_desejada ?? originalProd?.margem_desejada,
        observacoes:
          options?.observacoes?.trim() ||
          (originalProd?.observacoes
            ? `Variação / Cópia de ${originalNome}. ${originalProd.observacoes}`
            : `Variação / Cópia de ${originalNome}`),
      })

      targetProdutoId = novoProduto.id
    }

    // Clona integralmente todos os insumos em lote com deep copy
    const itensClonados: ItemFichaTecnica[] = originalFicha.itens
      ? JSON.parse(JSON.stringify(originalFicha.itens))
      : []

    // Aplica ajuste se fornecido
    if (options?.ajustePercentualInsumos && options.ajustePercentualInsumos !== 0) {
      const fator = 1 + options.ajustePercentualInsumos / 100
      itensClonados.forEach((it) => {
        it.custo_unitario = Math.round(it.custo_unitario * fator * 1000) / 1000
        it.subtotal = Math.round(it.quantidade * it.custo_unitario * 100) / 100
      })
    }

    const novoCustoMP = itensClonados.reduce((acc, it) => acc + (it.subtotal || 0), 0)
    const outrosCustos = originalFicha.outros_custos || 0
    const novoCustoTotal = novoCustoMP + outrosCustos
    const margem = originalFicha.margem_desejada || 40
    const markup =
      originalFicha.markup_desejado ||
      (margem < 100 && margem > 0 ? (margem / (100 - margem)) * 100 : 50)
    const precoSugeridoMargem =
      margem < 100 && novoCustoTotal > 0 ? novoCustoTotal / (1 - margem / 100) : novoCustoTotal
    const precoSugeridoMarkup =
      novoCustoTotal > 0 ? novoCustoTotal * (1 + markup / 100) : novoCustoTotal

    // Cria a nova ficha técnica clonada vinculada ao produto destino
    const novaFicha = await pb.collection('fichas_tecnicas').create<FichaTecnicaRecord>(
      {
        user: userId,
        produto: targetProdutoId,
        itens: itensClonados,
        custo_materia_prima: novoCustoMP,
        outros_custos: outrosCustos,
        custo_total: novoCustoTotal,
        margem_desejada: margem,
        preco_venda_sugerido: Math.round(precoSugeridoMargem * 100) / 100,
        markup_desejado: markup,
        preco_venda_markup: Math.round(precoSugeridoMarkup * 100) / 100,
        observacoes:
          options?.observacoes?.trim() ||
          (originalFicha.observacoes
            ? `[Variação Clonada] ${originalFicha.observacoes}`
            : 'Ficha técnica duplicada com insumos em lote.'),
      },
      {
        expand: 'produto',
      },
    )

    // Sincroniza custo no produto recém criado/vinculado
    try {
      await pb.collection('produtos').update(targetProdutoId, {
        custo: novoCustoTotal,
        margem_desejada: margem,
      })
    } catch (err) {
      console.warn('Erro ao sincronizar produto destino:', err)
    }

    return novaFicha
  },
}
