import pb from '@/lib/pocketbase/client'
import type {
  ProdutoRecord,
  MateriaPrimaRecord,
  FichaTecnicaRecord,
  ItemFichaTecnica,
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

export interface MateriaPrimaInput {
  codigo?: string
  nome: string
  unidade: string
  categoria?: string
  custo_unitario?: number
  estoque_atual?: number
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
  observacoes?: string
}

function getUserId(): string {
  const user = pb.authStore.record
  if (!user?.id) throw new Error('Usuário não autenticado')
  return user.id
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
    return pb.collection('produtos').create<ProdutoRecord>({
      ...data,
      user: userId,
    })
  },

  async update(id: string, data: Partial<ProdutoInput>): Promise<ProdutoRecord> {
    return pb.collection('produtos').update<ProdutoRecord>(id, data)
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

    // Sincroniza o custo e preço sugerido no produto vinculado para facilidade de consulta
    try {
      await pb.collection('produtos').update(data.produto, {
        custo: data.custo_total,
        preco_venda: data.preco_venda_sugerido ?? undefined,
        margem_desejada: data.margem_desejada ?? undefined,
      })
    } catch (err) {
      console.warn('Não foi possível sincronizar o produto com a ficha técnica:', err)
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
          preco_venda: data.preco_venda_sugerido ?? undefined,
          margem_desejada: data.margem_desejada ?? undefined,
        })
      } catch (err) {
        console.warn('Não foi possível sincronizar o produto com a ficha técnica:', err)
      }
    }

    return record
  },

  async delete(id: string): Promise<boolean> {
    return pb.collection('fichas_tecnicas').delete(id)
  },
}
