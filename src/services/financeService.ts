import pb from '@/lib/pocketbase/client'
import type {
  EmpresaRecord,
  BalancoRecord,
  DreRecord,
  CentroRecord,
  LancamentoCentroRecord,
  TipoCentro,
} from '@/types/finance'

export const empresasService = {
  async getAll(): Promise<EmpresaRecord[]> {
    return await pb.collection('empresas').getFullList<EmpresaRecord>({
      sort: 'nome',
    })
  },

  async getById(id: string): Promise<EmpresaRecord> {
    return await pb.collection('empresas').getOne<EmpresaRecord>(id)
  },

  async create(
    data: Partial<Omit<EmpresaRecord, 'id' | 'created' | 'updated'>> & {
      nome: string
      cnpj: string
      segmento: string
    },
  ): Promise<EmpresaRecord> {
    return await pb.collection('empresas').create<EmpresaRecord>(data)
  },

  async update(id: string, data: Partial<EmpresaRecord>): Promise<EmpresaRecord> {
    return await pb.collection('empresas').update<EmpresaRecord>(id, data)
  },

  async delete(id: string): Promise<boolean> {
    return await pb.collection('empresas').delete(id)
  },
}

export const balancosService = {
  async getByEmpresa(empresaId: string): Promise<BalancoRecord[]> {
    return await pb.collection('balancos').getFullList<BalancoRecord>({
      filter: `empresa = '${empresaId}'`,
      sort: '-ano',
    })
  },

  async getAll(): Promise<BalancoRecord[]> {
    return await pb.collection('balancos').getFullList<BalancoRecord>({
      sort: '-ano',
    })
  },

  async create(data: Omit<BalancoRecord, 'id' | 'created' | 'updated'>): Promise<BalancoRecord> {
    return await pb.collection('balancos').create<BalancoRecord>(data)
  },

  async update(id: string, data: Partial<BalancoRecord>): Promise<BalancoRecord> {
    return await pb.collection('balancos').update<BalancoRecord>(id, data)
  },

  async delete(id: string): Promise<boolean> {
    return await pb.collection('balancos').delete(id)
  },

  async upsert(
    empresaId: string,
    ano: number,
    data: Partial<BalancoRecord>,
  ): Promise<BalancoRecord> {
    const existing = await pb.collection('balancos').getList<BalancoRecord>(1, 1, {
      filter: `empresa = '${empresaId}' && ano = ${ano}`,
    })
    if (existing.items.length > 0) {
      return await pb.collection('balancos').update<BalancoRecord>(existing.items[0].id, data)
    } else {
      return await pb.collection('balancos').create<BalancoRecord>({
        ...data,
        empresa: empresaId,
        ano,
      } as any)
    }
  },
}

export const dreService = {
  async getByEmpresa(empresaId: string): Promise<DreRecord[]> {
    return await pb.collection('dre').getFullList<DreRecord>({
      filter: `empresa = '${empresaId}'`,
      sort: '-ano',
    })
  },

  async getAll(): Promise<DreRecord[]> {
    return await pb.collection('dre').getFullList<DreRecord>({
      sort: '-ano',
    })
  },

  async create(data: Omit<DreRecord, 'id' | 'created' | 'updated'>): Promise<DreRecord> {
    return await pb.collection('dre').create<DreRecord>(data)
  },

  async update(id: string, data: Partial<DreRecord>): Promise<DreRecord> {
    return await pb.collection('dre').update<DreRecord>(id, data)
  },

  async delete(id: string): Promise<boolean> {
    return await pb.collection('dre').delete(id)
  },

  async upsert(empresaId: string, ano: number, data: Partial<DreRecord>): Promise<DreRecord> {
    const existing = await pb.collection('dre').getList<DreRecord>(1, 1, {
      filter: `empresa = '${empresaId}' && ano = ${ano}`,
    })
    if (existing.items.length > 0) {
      return await pb.collection('dre').update<DreRecord>(existing.items[0].id, data)
    } else {
      return await pb.collection('dre').create<DreRecord>({
        ...data,
        empresa: empresaId,
        ano,
      } as any)
    }
  },
}

function currentUserId(): string {
  const id = pb.authStore.record?.id
  if (!id) throw new Error('Usuário não autenticado')
  return id
}

export const centrosService = {
  async getAll(): Promise<CentroRecord[]> {
    return await pb.collection('centros').getFullList<CentroRecord>({
      sort: 'nome',
    })
  },

  async create(data: {
    nome: string
    tipo: TipoCentro
    descricao?: string
  }): Promise<CentroRecord> {
    return await pb.collection('centros').create<CentroRecord>({
      nome: data.nome.trim(),
      tipo: data.tipo,
      descricao: data.descricao?.trim() || undefined,
      user: currentUserId(),
    } as any)
  },

  async update(
    id: string,
    data: Partial<Pick<CentroRecord, 'nome' | 'tipo' | 'descricao'>>,
  ): Promise<CentroRecord> {
    return await pb.collection('centros').update<CentroRecord>(id, data)
  },

  async delete(id: string): Promise<boolean> {
    return await pb.collection('centros').delete(id)
  },
}

export const lancamentosCentroService = {
  async getByCentro(centroId: string): Promise<LancamentoCentroRecord[]> {
    return await pb.collection('lancamentos_centro').getFullList<LancamentoCentroRecord>({
      filter: `centro = '${centroId}'`,
      sort: '-data',
    })
  },

  async getAll(): Promise<LancamentoCentroRecord[]> {
    return await pb.collection('lancamentos_centro').getFullList<LancamentoCentroRecord>({
      sort: '-data',
    })
  },

  async create(data: {
    centro: string
    data: string
    valor: number
    descricao?: string
  }): Promise<LancamentoCentroRecord> {
    return await pb.collection('lancamentos_centro').create<LancamentoCentroRecord>({
      centro: data.centro,
      data: data.data,
      valor: data.valor,
      descricao: data.descricao?.trim() || undefined,
      user: currentUserId(),
    } as any)
  },

  async update(
    id: string,
    data: Partial<Pick<LancamentoCentroRecord, 'data' | 'valor' | 'descricao'>>,
  ): Promise<LancamentoCentroRecord> {
    return await pb.collection('lancamentos_centro').update<LancamentoCentroRecord>(id, data)
  },

  async delete(id: string): Promise<boolean> {
    return await pb.collection('lancamentos_centro').delete(id)
  },
}
