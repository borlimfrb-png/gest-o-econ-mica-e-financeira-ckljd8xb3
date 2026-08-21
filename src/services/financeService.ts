import pb from '@/lib/pocketbase/client'
import type {
  EmpresaRecord,
  BalancoRecord,
  DreRecord,
  CentroRecord,
  LancamentoCentroRecord,
  TipoDespesaRecord,
  TipoCentro,
  ContaRecord,
  PlanoContaRecord,
  LancamentoRecord,
  LancamentoRecorrenteRecord,
  MetaLancamentoRecord,
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
    meta_mensal?: number
    meta_anual?: number
  }): Promise<CentroRecord> {
    const metaMensal =
      data.meta_mensal !== undefined && !isNaN(Number(data.meta_mensal))
        ? Number(data.meta_mensal)
        : undefined
    const metaAnual =
      data.meta_anual !== undefined && !isNaN(Number(data.meta_anual))
        ? Number(data.meta_anual)
        : undefined
    return await pb.collection('centros').create<CentroRecord>({
      nome: data.nome.trim(),
      tipo: data.tipo,
      descricao: data.descricao?.trim() || undefined,
      meta_mensal: metaMensal,
      meta_anual: metaAnual,
      user: currentUserId(),
    } as any)
  },

  async update(
    id: string,
    data: Partial<Pick<CentroRecord, 'nome' | 'tipo' | 'descricao' | 'meta_mensal' | 'meta_anual'>>,
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
    data?: string
    valor?: number
    descricao?: string
    tipo_despesa?: string
    conta?: string
    concluido?: boolean
  }): Promise<LancamentoCentroRecord> {
    return await pb.collection('lancamentos_centro').create<LancamentoCentroRecord>({
      centro: data.centro,
      data: data.data ?? new Date().toISOString().slice(0, 10),
      valor: data.valor ?? 0,
      descricao: data.descricao?.trim() || undefined,
      tipo_despesa: data.tipo_despesa || undefined,
      conta: data.conta || null,
      concluido: data.concluido ?? false,
      user: currentUserId(),
    } as any)
  },

  async update(
    id: string,
    data: Partial<
      Pick<
        LancamentoCentroRecord,
        'data' | 'valor' | 'descricao' | 'tipo_despesa' | 'conta' | 'concluido'
      >
    >,
  ): Promise<LancamentoCentroRecord> {
    const payload: Record<string, unknown> = { ...data }
    if (data.tipo_despesa === '') payload.tipo_despesa = null
    if (data.conta === '') payload.conta = null
    return await pb.collection('lancamentos_centro').update<LancamentoCentroRecord>(id, payload)
  },

  async delete(id: string): Promise<boolean> {
    return await pb.collection('lancamentos_centro').delete(id)
  },
}

export const tiposDespesaService = {
  async getAll(): Promise<TipoDespesaRecord[]> {
    return await pb.collection('tipos_despesa').getFullList<TipoDespesaRecord>({
      sort: 'nome',
    })
  },

  // Calcula o próximo código (TD-NNN) com base nos códigos já existentes do usuário.
  proximoCodigo(codigos: string[]): string {
    let maxN = 0
    for (const c of codigos) {
      if (c && c.startsWith('TD-')) {
        const num = parseInt(c.slice(3), 10)
        if (!isNaN(num) && num > maxN) maxN = num
      }
    }
    return 'TD-' + String(maxN + 1).padStart(3, '0')
  },

  async create(data: { nome: string; descricao?: string }): Promise<TipoDespesaRecord> {
    return await pb.collection('tipos_despesa').create<TipoDespesaRecord>({
      nome: data.nome.trim(),
      descricao: data.descricao?.trim() || undefined,
      user: currentUserId(),
    } as any)
  },

  async update(
    id: string,
    data: Partial<Pick<TipoDespesaRecord, 'nome' | 'descricao'>>,
  ): Promise<TipoDespesaRecord> {
    return await pb.collection('tipos_despesa').update<TipoDespesaRecord>(id, data)
  },

  async delete(id: string): Promise<boolean> {
    return await pb.collection('tipos_despesa').delete(id)
  },
}

export const contasService = {
  async getAll(): Promise<ContaRecord[]> {
    return await pb.collection('contas').getFullList<ContaRecord>({
      sort: 'codigo',
    })
  },

  // Calcula o próximo código (CO-NNN) com base nos códigos já existentes do usuário.
  proximoCodigo(codigos: string[]): string {
    let maxN = 0
    for (const c of codigos) {
      if (c && c.startsWith('CO-')) {
        const num = parseInt(c.slice(3), 10)
        if (!isNaN(num) && num > maxN) maxN = num
      }
    }
    return 'CO-' + String(maxN + 1).padStart(3, '0')
  },

  async create(data: {
    nome: string
    tipo: ContaRecord['tipo']
    descricao?: string
    grupo?: string
  }): Promise<ContaRecord> {
    return await pb.collection('contas').create<ContaRecord>({
      nome: data.nome.trim(),
      tipo: data.tipo,
      descricao: data.descricao?.trim() || undefined,
      grupo: data.grupo?.trim() || undefined,
      user: currentUserId(),
    } as any)
  },

  async update(
    id: string,
    data: Partial<Pick<ContaRecord, 'nome' | 'tipo' | 'descricao' | 'grupo'>>,
  ): Promise<ContaRecord> {
    const payload: Record<string, unknown> = { ...data }
    if (data.nome !== undefined) payload.nome = data.nome.trim()
    if (data.descricao !== undefined) payload.descricao = data.descricao.trim() || undefined
    if (data.grupo !== undefined) payload.grupo = data.grupo.trim() || undefined
    return await pb.collection('contas').update<ContaRecord>(id, payload)
  },

  async delete(id: string): Promise<boolean> {
    return await pb.collection('contas').delete(id)
  },
}

export const planoContasService = {
  async getAll(): Promise<PlanoContaRecord[]> {
    return await pb.collection('plano_contas').getFullList<PlanoContaRecord>({
      sort: 'codigo',
      expand: 'conta,centro,tipo_despesa',
    })
  },

  // Calcula o próximo código (PC-NNN) com base nos códigos já existentes do usuário.
  proximoCodigo(codigos: string[]): string {
    let maxN = 0
    for (const c of codigos) {
      if (c && c.startsWith('PC-')) {
        const num = parseInt(c.slice(3), 10)
        if (!isNaN(num) && num > maxN) maxN = num
      }
    }
    return 'PC-' + String(maxN + 1).padStart(3, '0')
  },

  async create(data: {
    conta: string
    centro: string
    tipo_despesa?: string
    descricao?: string
  }): Promise<PlanoContaRecord> {
    return await pb.collection('plano_contas').create<PlanoContaRecord>({
      conta: data.conta,
      centro: data.centro,
      tipo_despesa: data.tipo_despesa || undefined,
      descricao: data.descricao?.trim() || undefined,
      user: currentUserId(),
    } as any)
  },

  async update(
    id: string,
    data: Partial<Pick<PlanoContaRecord, 'conta' | 'centro' | 'tipo_despesa' | 'descricao'>>,
  ): Promise<PlanoContaRecord> {
    const payload: Record<string, unknown> = { ...data }
    if (data.tipo_despesa === '') payload.tipo_despesa = null
    if (data.descricao !== undefined) payload.descricao = data.descricao.trim() || undefined
    return await pb.collection('plano_contas').update<PlanoContaRecord>(id, payload)
  },

  async delete(id: string): Promise<boolean> {
    return await pb.collection('plano_contas').delete(id)
  },
}

export const lancamentosService = {
  async getAll(options?: {
    empresaId?: string
    data?: string
    dataInicio?: string
    dataFim?: string
    expandRelations?: boolean
  }): Promise<LancamentoRecord[]> {
    const filters: string[] = []
    if (options?.empresaId) {
      filters.push(`empresa = '${options.empresaId}'`)
    }
    if (options?.data) {
      // Normaliza se vier YYYY-MM-DD
      const dateStr = options.data.slice(0, 10)
      filters.push(`data >= '${dateStr} 00:00:00' && data <= '${dateStr} 23:59:59'`)
    }
    if (options?.dataInicio) {
      const inicio = options.dataInicio.slice(0, 10)
      filters.push(`data >= '${inicio} 00:00:00'`)
    }
    if (options?.dataFim) {
      const fim = options.dataFim.slice(0, 10)
      filters.push(`data <= '${fim} 23:59:59'`)
    }

    const queryParams: Record<string, unknown> = {
      sort: '-data',
    }
    if (filters.length > 0) {
      queryParams.filter = filters.join(' && ')
    }
    if (options?.expandRelations ?? true) {
      queryParams.expand = 'empresa,plano_conta.conta,plano_conta.centro,plano_conta.tipo_despesa'
    }

    return await pb.collection('lancamentos').getFullList<LancamentoRecord>(queryParams)
  },

  async getById(id: string): Promise<LancamentoRecord> {
    return await pb.collection('lancamentos').getOne<LancamentoRecord>(id, {
      expand: 'empresa,plano_conta.conta,plano_conta.centro,plano_conta.tipo_despesa',
    })
  },

  async create(data: {
    empresa: string
    plano_conta: string
    data: string
    valor: number
    historico?: string
  }): Promise<LancamentoRecord> {
    const dateFormatted =
      data.data.includes(' ') || data.data.includes('T') ? data.data : `${data.data} 12:00:00`

    return await pb.collection('lancamentos').create<LancamentoRecord>(
      {
        empresa: data.empresa,
        plano_conta: data.plano_conta,
        data: dateFormatted,
        valor: Number(data.valor) || 0,
        historico: data.historico?.trim() || undefined,
        user: currentUserId(),
      } as any,
      {
        expand: 'empresa,plano_conta.conta,plano_conta.centro,plano_conta.tipo_despesa',
      },
    )
  },

  async update(
    id: string,
    data: Partial<
      Pick<LancamentoRecord, 'empresa' | 'plano_conta' | 'data' | 'valor' | 'historico'>
    >,
  ): Promise<LancamentoRecord> {
    const payload: Record<string, unknown> = { ...data }
    if (data.historico !== undefined) {
      payload.historico = data.historico.trim() || undefined
    }
    if (data.valor !== undefined) {
      payload.valor = Number(data.valor) || 0
    }
    if (data.data !== undefined) {
      payload.data =
        data.data.includes(' ') || data.data.includes('T') ? data.data : `${data.data} 12:00:00`
    }
    return await pb.collection('lancamentos').update<LancamentoRecord>(id, payload, {
      expand: 'empresa,plano_conta.conta,plano_conta.centro,plano_conta.tipo_despesa',
    })
  },

  async delete(id: string): Promise<boolean> {
    return await pb.collection('lancamentos').delete(id)
  },
}

export const lancamentosRecorrentesService = {
  async getAll(options?: {
    empresaId?: string
    expandRelations?: boolean
  }): Promise<LancamentoRecorrenteRecord[]> {
    const filters: string[] = []
    if (options?.empresaId) {
      filters.push(`empresa = '${options.empresaId}'`)
    }

    const queryParams: Record<string, unknown> = {
      sort: 'dia_mes',
    }
    if (filters.length > 0) {
      queryParams.filter = filters.join(' && ')
    }
    if (options?.expandRelations ?? true) {
      queryParams.expand = 'empresa,plano_conta.conta,plano_conta.centro,plano_conta.tipo_despesa'
    }

    return await pb
      .collection('lancamentos_recorrentes')
      .getFullList<LancamentoRecorrenteRecord>(queryParams)
  },

  async create(data: {
    empresa: string
    plano_conta: string
    dia_mes: number
    valor: number
    historico?: string
    ativo?: boolean
  }): Promise<LancamentoRecorrenteRecord> {
    const diaClamped = Math.min(Math.max(Number(data.dia_mes) || 1, 1), 28)
    return await pb.collection('lancamentos_recorrentes').create<LancamentoRecorrenteRecord>(
      {
        empresa: data.empresa,
        plano_conta: data.plano_conta,
        dia_mes: diaClamped,
        valor: Number(data.valor) || 0,
        historico: data.historico?.trim() || undefined,
        ativo: data.ativo ?? true,
        user: currentUserId(),
      } as any,
      {
        expand: 'empresa,plano_conta.conta,plano_conta.centro,plano_conta.tipo_despesa',
      },
    )
  },

  async update(
    id: string,
    data: Partial<
      Pick<
        LancamentoRecorrenteRecord,
        'empresa' | 'plano_conta' | 'dia_mes' | 'valor' | 'historico' | 'ativo'
      >
    >,
  ): Promise<LancamentoRecorrenteRecord> {
    const payload: Record<string, unknown> = { ...data }
    if (data.historico !== undefined) {
      payload.historico = data.historico.trim() || undefined
    }
    if (data.valor !== undefined) {
      payload.valor = Number(data.valor) || 0
    }
    if (data.dia_mes !== undefined) {
      payload.dia_mes = Math.min(Math.max(Number(data.dia_mes) || 1, 1), 28)
    }
    return await pb
      .collection('lancamentos_recorrentes')
      .update<LancamentoRecorrenteRecord>(id, payload, {
        expand: 'empresa,plano_conta.conta,plano_conta.centro,plano_conta.tipo_despesa',
      })
  },

  async toggleAtivo(id: string, ativo: boolean): Promise<LancamentoRecorrenteRecord> {
    return await pb.collection('lancamentos_recorrentes').update<LancamentoRecorrenteRecord>(
      id,
      { ativo },
      {
        expand: 'empresa,plano_conta.conta,plano_conta.centro,plano_conta.tipo_despesa',
      },
    )
  },

  async delete(id: string): Promise<boolean> {
    return await pb.collection('lancamentos_recorrentes').delete(id)
  },
}

export const financeService = {
  getEmpresas: empresasService.getAll,
  getCentros: centrosService.getAll,
  getTiposDespesas: tiposDespesaService.getAll,
  getContas: contasService.getAll,
  createConta: contasService.create,
  getPlanoContas: planoContasService.getAll,
  createPlanoConta: planoContasService.create,
  getLancamentos: lancamentosService.getAll,
  createLancamento: lancamentosService.create,
}

export const GRUPOS_POR_TIPO: Record<string, string[]> = {
  Ativo: [
    'Ativo Circulante',
    'Disponibilidades',
    'Clientes / Contas a Receber',
    'Estoques',
    'Outros Créditos',
    'Ativo Não Circulante',
    'Realizável a Longo Prazo',
    'Investimentos',
    'Imobilizado',
    'Intangível',
  ],
  Passivo: [
    'Passivo Circulante',
    'Fornecedores',
    'Obrigações Sociais e Trabalhistas',
    'Obrigações Fiscais e Tributárias',
    'Empréstimos e Financiamentos CP',
    'Outras Obrigações',
    'Passivo Não Circulante',
    'Empréstimos e Financiamentos LP',
    'Provisões',
  ],
  'Patrimônio Líquido': [
    'Capital Social',
    'Reservas de Capital',
    'Reservas de Lucros',
    'Lucros ou Prejuízos Acumulados',
  ],
  Receita: [
    'Receitas Operacionais',
    'Receita Bruta de Vendas',
    'Receita de Prestação de Serviços',
    'Deduções da Receita Bruta',
    'Receitas Financeiras',
    'Outras Receitas Operacionais',
    'Receitas Não Operacionais',
  ],
  Despesa: [
    'Custos dos Produtos/Serviços Vendidos (CPV/CSV)',
    'Despesas Operacionais',
    'Despesas Administrativas',
    'Despesas Comerciais / Vendas',
    'Despesas com Pessoal',
    'Despesas Gerais',
    'Despesas Financeiras',
    'Outras Despesas Operacionais',
    'Despesas Tributárias',
  ],
}

export type TipoConta = 'Ativo' | 'Passivo' | 'Patrimônio Líquido' | 'Receita' | 'Despesa'
export type GrupoConta = string

export const metasLancamentosService = {
  async getAll(options?: {
    empresaId?: string
    ano?: number
    mes?: number
    expandRelations?: boolean
  }): Promise<MetaLancamentoRecord[]> {
    const filters: string[] = []
    if (options?.empresaId) {
      filters.push(`empresa = '${options.empresaId}'`)
    }
    if (options?.ano !== undefined) {
      filters.push(`ano = ${options.ano}`)
    }
    if (options?.mes !== undefined) {
      filters.push(`mes = ${options.mes}`)
    }

    const queryParams: Record<string, unknown> = {
      sort: '-ano,-mes,tipo',
    }
    if (filters.length > 0) {
      queryParams.filter = filters.join(' && ')
    }
    if (options?.expandRelations ?? true) {
      queryParams.expand = 'empresa,centro'
    }

    return await pb.collection('metas_lancamentos').getFullList<MetaLancamentoRecord>(queryParams)
  },

  async create(data: {
    empresa: string
    tipo: 'Receita' | 'Despesa'
    valor: number
    mes: number
    ano: number
    periodo?: 'Mensal' | 'Trimestral' | 'Anual'
    trimestre?: 'Q1' | 'Q2' | 'Q3' | 'Q4' | null
    centro?: string | null
    ativo?: boolean
  }): Promise<MetaLancamentoRecord> {
    return await pb.collection('metas_lancamentos').create<MetaLancamentoRecord>(
      {
        empresa: data.empresa,
        tipo: data.tipo,
        valor: Number(data.valor) || 0,
        mes: Number(data.mes),
        ano: Number(data.ano),
        periodo: data.periodo || 'Mensal',
        trimestre: data.trimestre || null,
        centro: data.centro || null,
        ativo: data.ativo ?? true,
        user: currentUserId(),
      } as any,
      {
        expand: 'empresa,centro',
      },
    )
  },

  async update(
    id: string,
    data: Partial<
      Pick<
        MetaLancamentoRecord,
        'empresa' | 'tipo' | 'valor' | 'mes' | 'ano' | 'periodo' | 'trimestre' | 'centro' | 'ativo'
      >
    >,
  ): Promise<MetaLancamentoRecord> {
    const payload: Record<string, unknown> = { ...data }
    if (data.valor !== undefined) {
      payload.valor = Number(data.valor) || 0
    }
    if (data.mes !== undefined) {
      payload.mes = Number(data.mes)
    }
    if (data.ano !== undefined) {
      payload.ano = Number(data.ano)
    }
    if (data.centro !== undefined) {
      payload.centro = data.centro || null
    }
    if (data.periodo !== undefined) {
      payload.periodo = data.periodo
    }
    if (data.trimestre !== undefined) {
      payload.trimestre = data.trimestre || null
    }
    return await pb.collection('metas_lancamentos').update<MetaLancamentoRecord>(id, payload, {
      expand: 'empresa,centro',
    })
  },

  async toggleAtivo(id: string, ativo: boolean): Promise<MetaLancamentoRecord> {
    return await pb.collection('metas_lancamentos').update<MetaLancamentoRecord>(
      id,
      { ativo },
      {
        expand: 'empresa,centro',
      },
    )
  },

  async delete(id: string): Promise<boolean> {
    return await pb.collection('metas_lancamentos').delete(id)
  },
}
