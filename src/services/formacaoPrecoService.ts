import pb from '@/lib/pocketbase/client'
import type {
  ProdutoRecord,
  MateriaPrimaRecord,
  FichaTecnicaRecord,
  ItemFichaTecnica,
  HistoricoPrecoProdutoRecord,
  OrigemAlteracaoPreco,
  ConfiguracaoTributariaRecord,
  TipoTributacaoMateriaPrima,
} from '@/types/finance'

export interface ProdutoInput {
  empresa?: string
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
  empresa?: string
  codigo?: string
  nome: string
  unidade: string
  categoria?: string
  custo_unitario?: number
  icms_percentual?: number
  pis_percentual?: number
  cofins_percentual?: number
  ipi_percentual?: number
  frete_percentual?: number
  perdas_percentual?: number
  isenta_st?: boolean
  tipo_tributacao?: TipoTributacaoMateriaPrima
  estoque_atual?: number
  estoque_minimo?: number
  observacoes?: string
}

export interface FichaTecnicaInput {
  empresa?: string
  produto: string
  itens: ItemFichaTecnica[]
  custo_materia_prima: number
  custo_materia_prima_liquido?: number
  creditos_tributarios_totais?: number
  outros_custos?: number
  custo_total: number
  custo_total_liquido?: number
  margem_desejada?: number
  preco_venda_sugerido?: number
  preco_venda_sugerido_liquido?: number
  markup_desejado?: number
  preco_venda_markup?: number
  preco_venda_markup_liquido?: number
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
      expand: 'produto.empresa',
    })
  },

  async getByEmpresa(empresaId: string): Promise<HistoricoPrecoProdutoRecord[]> {
    const userId = getUserId()
    if (!empresaId) return this.getAll()
    return pb.collection('historico_precos_produtos').getFullList<HistoricoPrecoProdutoRecord>({
      filter: `user = "${userId}" && produto.empresa = "${empresaId}"`,
      sort: '-created',
      expand: 'produto.empresa',
    })
  },

  async getAll(empresaId?: string): Promise<HistoricoPrecoProdutoRecord[]> {
    const userId = getUserId()
    let filter = `user = "${userId}"`
    if (empresaId) {
      filter += ` && produto.empresa = "${empresaId}"`
    }
    return pb.collection('historico_precos_produtos').getFullList<HistoricoPrecoProdutoRecord>({
      filter,
      sort: '-created',
      expand: 'produto.empresa',
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
  async getAll(empresaId?: string): Promise<ProdutoRecord[]> {
    const userId = getUserId()
    let filter = `user = "${userId}"`
    if (empresaId) {
      filter += ` && empresa = "${empresaId}"`
    }
    return pb.collection('produtos').getFullList<ProdutoRecord>({
      filter,
      sort: 'nome',
      expand: 'empresa',
    })
  },

  async getByEmpresa(empresaId: string): Promise<ProdutoRecord[]> {
    return this.getAll(empresaId)
  },

  async getById(id: string): Promise<ProdutoRecord> {
    return pb.collection('produtos').getOne<ProdutoRecord>(id, {
      expand: 'empresa',
    })
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

  async transferirEmpresa(produtoId: string, novaEmpresaId: string): Promise<ProdutoRecord> {
    const updated = await pb.collection('produtos').update<ProdutoRecord>(produtoId, {
      empresa: novaEmpresaId,
    })

    // Sincroniza também as fichas técnicas associadas a este produto para a nova empresa
    try {
      const fichas = await pb.collection('fichas_tecnicas').getFullList<FichaTecnicaRecord>({
        filter: `produto = "${produtoId}"`,
      })
      for (const f of fichas) {
        await pb.collection('fichas_tecnicas').update(f.id, {
          empresa: novaEmpresaId,
        })
      }
    } catch (err) {
      console.warn('Aviso ao sincronizar empresa das fichas do produto transferido:', err)
    }

    return updated
  },

  async transferirLote(
    produtoIds: string[],
    novaEmpresaId: string,
  ): Promise<{ sucesso: number; total: number; falhas: string[] }> {
    const falhas: string[] = []
    let sucesso = 0

    for (const id of produtoIds) {
      try {
        await this.transferirEmpresa(id, novaEmpresaId)
        sucesso++
      } catch (err: any) {
        console.error(`Erro ao transferir produto ${id}:`, err)
        falhas.push(id)
      }
    }

    return { sucesso, total: produtoIds.length, falhas }
  },

  async delete(id: string): Promise<boolean> {
    return pb.collection('produtos').delete(id)
  },
}

// -------------------------------------------------------------
// SERVIÇO: MATÉRIAS-PRIMAS
// -------------------------------------------------------------
export const materiasPrimasService = {
  async getAll(empresaId?: string): Promise<MateriaPrimaRecord[]> {
    const userId = getUserId()
    let filter = `user = "${userId}"`
    if (empresaId) {
      filter += ` && empresa = "${empresaId}"`
    }
    return pb.collection('materias_primas').getFullList<MateriaPrimaRecord>({
      filter,
      sort: 'nome',
      expand: 'empresa',
    })
  },

  async getByEmpresa(empresaId: string): Promise<MateriaPrimaRecord[]> {
    return this.getAll(empresaId)
  },

  async getById(id: string): Promise<MateriaPrimaRecord> {
    return pb.collection('materias_primas').getOne<MateriaPrimaRecord>(id, {
      expand: 'empresa',
    })
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

  async verificarUsoEmFichas(materiaPrimaId: string): Promise<FichaTecnicaRecord[]> {
    const userId = getUserId()
    const fichas = await pb.collection('fichas_tecnicas').getFullList<FichaTecnicaRecord>({
      filter: `user = "${userId}"`,
      expand: 'produto,empresa',
    })

    return fichas.filter((f) => {
      if (!f.itens || !Array.isArray(f.itens)) return false
      return f.itens.some((it) => it.materia_prima_id === materiaPrimaId)
    })
  },

  async transferirEmpresa(
    materiaPrimaId: string,
    novaEmpresaId: string,
  ): Promise<MateriaPrimaRecord> {
    return pb.collection('materias_primas').update<MateriaPrimaRecord>(materiaPrimaId, {
      empresa: novaEmpresaId,
    })
  },

  async transferirLote(
    materiaPrimaIds: string[],
    novaEmpresaId: string,
  ): Promise<{ sucesso: number; total: number; falhas: string[] }> {
    const falhas: string[] = []
    let sucesso = 0

    for (const id of materiaPrimaIds) {
      try {
        await this.transferirEmpresa(id, novaEmpresaId)
        sucesso++
      } catch (err: any) {
        console.error(`Erro ao transferir matéria-prima ${id}:`, err)
        falhas.push(id)
      }
    }

    return { sucesso, total: materiaPrimaIds.length, falhas }
  },

  async verificarUsoEmFichasLote(
    materiaPrimaIds: string[],
  ): Promise<Map<string, FichaTecnicaRecord[]>> {
    const userId = getUserId()
    const fichas = await pb.collection('fichas_tecnicas').getFullList<FichaTecnicaRecord>({
      filter: `user = "${userId}"`,
      expand: 'produto,empresa',
    })

    const mapa = new Map<string, FichaTecnicaRecord[]>()
    for (const mpId of materiaPrimaIds) {
      mapa.set(mpId, [])
    }

    for (const f of fichas) {
      if (!f.itens || !Array.isArray(f.itens)) continue
      for (const it of f.itens) {
        if (it.materia_prima_id && mapa.has(it.materia_prima_id)) {
          const list = mapa.get(it.materia_prima_id)!
          if (!list.some((exist) => exist.id === f.id)) {
            list.push(f)
          }
        }
      }
    }

    return mapa
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
  async getAll(empresaId?: string): Promise<FichaTecnicaRecord[]> {
    const userId = getUserId()
    let filter = `user = "${userId}"`
    if (empresaId) {
      filter += ` && (empresa = "${empresaId}" || produto.empresa = "${empresaId}")`
    }
    return pb.collection('fichas_tecnicas').getFullList<FichaTecnicaRecord>({
      filter,
      sort: '-created',
      expand: 'produto,empresa',
    })
  },

  async getById(id: string): Promise<FichaTecnicaRecord> {
    return pb.collection('fichas_tecnicas').getOne<FichaTecnicaRecord>(id, {
      expand: 'produto,empresa',
    })
  },

  async getByProduto(produtoId: string): Promise<FichaTecnicaRecord | null> {
    const userId = getUserId()
    try {
      const records = await pb.collection('fichas_tecnicas').getFullList<FichaTecnicaRecord>({
        filter: `user = "${userId}" && produto = "${produtoId}"`,
        sort: '-created',
        expand: 'produto,empresa',
      })
      return records.length > 0 ? records[0] : null
    } catch {
      return null
    }
  },

  async create(data: FichaTecnicaInput): Promise<FichaTecnicaRecord> {
    const userId = getUserId()

    // Se empresa não foi passada explicitamente, busca a empresa do produto
    let empresaId = data.empresa
    if (!empresaId && data.produto) {
      try {
        const prod = await pb.collection('produtos').getOne<ProdutoRecord>(data.produto)
        empresaId = prod.empresa
      } catch {
        /* intentionally ignored */
      }
    }

    const record = await pb.collection('fichas_tecnicas').create<FichaTecnicaRecord>(
      {
        ...data,
        empresa: empresaId,
        user: userId,
      },
      {
        expand: 'produto,empresa',
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
      expand: 'produto,empresa',
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
      empresaId?: string
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
    let empresaDestino = options?.empresaId || originalFicha.empresa

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

      if (!empresaDestino && originalProd?.empresa) {
        empresaDestino = originalProd.empresa
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
        empresa: empresaDestino,
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

    // Cria a nova ficha técnica clonada vinculada ao produto destino e à empresa
    const novaFicha = await pb.collection('fichas_tecnicas').create<FichaTecnicaRecord>(
      {
        user: userId,
        empresa: empresaDestino,
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
        expand: 'produto,empresa',
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
