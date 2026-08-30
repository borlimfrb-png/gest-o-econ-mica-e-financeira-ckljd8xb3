import pb from '@/lib/pocketbase/client'
import type {
  ProdutoRecord,
  MateriaPrimaRecord,
  FichaTecnicaRecord,
  ItemFichaTecnica,
  HistoricoPrecoProdutoRecord,
  OrigemAlteracaoPreco,
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
      targetProdutoId?: string
    },
  ): Promise<FichaTecnicaRecord> {
    const userId = getUserId()
    const originalFicha = await this.getById(id)
    let targetProdutoId = options?.targetProdutoId

    // Se solicitado criar novo produto como cópia do produto original
    if (options?.criarNovoProduto || !targetProdutoId) {
      const originalProd =
        originalFicha.expand?.produto ||
        (await pb.collection('produtos').getOne<ProdutoRecord>(originalFicha.produto))

      const novoNome = options?.novoProdutoNome?.trim() || `${originalProd.nome} (cópia)`
      const novoCodigo =
        options?.novoProdutoCodigo?.trim() ||
        (originalProd.codigo ? `${originalProd.codigo}-CP` : undefined)

      const novoProduto = await pb.collection('produtos').create<ProdutoRecord>({
        user: userId,
        codigo: novoCodigo,
        nome: novoNome,
        unidade: originalProd.unidade || 'UN',
        categoria: originalProd.categoria || undefined,
        custo: originalFicha.custo_total,
        preco_venda: originalFicha.preco_venda_sugerido ?? originalProd.preco_venda,
        margem_desejada: originalFicha.margem_desejada ?? originalProd.margem_desejada,
        observacoes: originalProd.observacoes
          ? `Cópia de ${originalProd.nome}. ${originalProd.observacoes}`
          : `Cópia de ${originalProd.nome}`,
      })

      targetProdutoId = novoProduto.id
    }

    // Cria a nova ficha técnica clonada vinculada ao produto destino
    const novaFicha = await pb.collection('fichas_tecnicas').create<FichaTecnicaRecord>(
      {
        user: userId,
        produto: targetProdutoId,
        itens: originalFicha.itens ? JSON.parse(JSON.stringify(originalFicha.itens)) : [],
        custo_materia_prima: originalFicha.custo_materia_prima || 0,
        outros_custos: originalFicha.outros_custos || 0,
        custo_total: originalFicha.custo_total || 0,
        margem_desejada: originalFicha.margem_desejada || 0,
        preco_venda_sugerido: originalFicha.preco_venda_sugerido || 0,
        markup_desejado: originalFicha.markup_desejado || 0,
        preco_venda_markup: originalFicha.preco_venda_markup || 0,
        observacoes: originalFicha.observacoes
          ? `[Clonada] ${originalFicha.observacoes}`
          : 'Ficha técnica clonada.',
      },
      {
        expand: 'produto',
      },
    )

    return novaFicha
  },
}
