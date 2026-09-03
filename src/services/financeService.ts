import pb from '@/lib/pocketbase/client'
import type {
  EmpresaRecord,
  GrupoEmpresarialRecord,
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

/**
 * Funções de consolidação em tempo real para Grupos Empresariais
 */
export async function consolidarBalancosPorGrupo(grupoId: string): Promise<BalancoRecord[]> {
  try {
    const grupo = await pb.collection('grupos_empresariais').getOne<GrupoEmpresarialRecord>(grupoId)
    const empresasIds = grupo.empresas || []
    if (empresasIds.length === 0) return []

    // Buscar todos os balanços das empresas participantes
    const filterExp = empresasIds.map((id) => `empresa = '${id}'`).join(' || ')
    const balancos = await pb.collection('balancos').getFullList<BalancoRecord>({
      filter: filterExp,
      sort: '-ano,-mes',
    })

    if (balancos.length === 0) return []

    // Agrupar por ano e mês
    const gruposPeriodo = new Map<string, BalancoRecord[]>()
    for (const b of balancos) {
      const mes = b.mes ?? 12
      const key = `${b.ano}-${mes}`
      const lista = gruposPeriodo.get(key) || []
      lista.push(b)
      gruposPeriodo.set(key, lista)
    }

    const resultado: BalancoRecord[] = []

    for (const [key, lista] of gruposPeriodo.entries()) {
      const [anoStr, mesStr] = key.split('-')
      const ano = Number(anoStr)
      const mes = Number(mesStr)

      const consolidado: BalancoRecord = {
        id: `grupo-${grupoId}-b-${ano}-${mes}`,
        collectionId: 'grupos_empresariais',
        collectionName: 'grupos_empresariais',
        created: lista[0].created,
        updated: lista[0].updated,
        empresa: `grupo-${grupoId}`,
        ano,
        mes,
        fechado: lista.every((b) => b.fechado),
        fechado_em: lista.find((b) => b.fechado_em)?.fechado_em,
        fechamento_obs: `Consolidado de ${lista.length} empresas do grupo`,
        caixa_equivalentes: lista.reduce((acc, b) => acc + (b.caixa_equivalentes || 0), 0),
        aplicacoes_financeiras: lista.reduce((acc, b) => acc + (b.aplicacoes_financeiras || 0), 0),
        contas_receber: lista.reduce((acc, b) => acc + (b.contas_receber || 0), 0),
        estoques: lista.reduce((acc, b) => acc + (b.estoques || 0), 0),
        impostos_recuperar: lista.reduce((acc, b) => acc + (b.impostos_recuperar || 0), 0),
        outros_ativo_circulante: lista.reduce(
          (acc, b) => acc + (b.outros_ativo_circulante || 0),
          0,
        ),
        realizavel_longo_prazo: lista.reduce((acc, b) => acc + (b.realizavel_longo_prazo || 0), 0),
        investimentos: lista.reduce((acc, b) => acc + (b.investimentos || 0), 0),
        imobilizado: lista.reduce((acc, b) => acc + (b.imobilizado || 0), 0),
        intangivel: lista.reduce((acc, b) => acc + (b.intangivel || 0), 0),
        fornecedores: lista.reduce((acc, b) => acc + (b.fornecedores || 0), 0),
        emprestimos_curto_prazo: lista.reduce(
          (acc, b) => acc + (b.emprestimos_curto_prazo || 0),
          0,
        ),
        obrigacoes_trabalhistas: lista.reduce(
          (acc, b) => acc + (b.obrigacoes_trabalhistas || 0),
          0,
        ),
        obrigacoes_tributarias: lista.reduce((acc, b) => acc + (b.obrigacoes_tributarias || 0), 0),
        outros_passivo_circulante: lista.reduce(
          (acc, b) => acc + (b.outros_passivo_circulante || 0),
          0,
        ),
        emprestimos_longo_prazo: lista.reduce(
          (acc, b) => acc + (b.emprestimos_longo_prazo || 0),
          0,
        ),
        outras_obrigacoes_longo_prazo: lista.reduce(
          (acc, b) => acc + (b.outras_obrigacoes_longo_prazo || 0),
          0,
        ),
        capital_social: lista.reduce((acc, b) => acc + (b.capital_social || 0), 0),
        reservas_lucros: lista.reduce((acc, b) => acc + (b.reservas_lucros || 0), 0),
        lucros_acumulados: lista.reduce((acc, b) => acc + (b.lucros_acumulados || 0), 0),
        vinculos_contas: {},
      }

      resultado.push(consolidado)
    }

    resultado.sort((a, b) => {
      if (b.ano !== a.ano) return b.ano - a.ano
      return (b.mes ?? 12) - (a.mes ?? 12)
    })

    return resultado
  } catch (err) {
    console.error('Erro ao consolidar balanços por grupo:', err)
    return []
  }
}

export async function consolidarDrePorGrupo(grupoId: string): Promise<DreRecord[]> {
  try {
    const grupo = await pb.collection('grupos_empresariais').getOne<GrupoEmpresarialRecord>(grupoId)
    const empresasIds = grupo.empresas || []
    if (empresasIds.length === 0) return []

    // Buscar todas as DREs das empresas participantes
    const filterExp = empresasIds.map((id) => `empresa = '${id}'`).join(' || ')
    const dres = await pb.collection('dre').getFullList<DreRecord>({
      filter: filterExp,
      sort: '-ano,-mes',
    })

    if (dres.length === 0) return []

    // Agrupar por ano e mês
    const gruposPeriodo = new Map<string, DreRecord[]>()
    for (const d of dres) {
      const mes = d.mes ?? 12
      const key = `${d.ano}-${mes}`
      const lista = gruposPeriodo.get(key) || []
      lista.push(d)
      gruposPeriodo.set(key, lista)
    }

    const resultado: DreRecord[] = []

    for (const [key, lista] of gruposPeriodo.entries()) {
      const [anoStr, mesStr] = key.split('-')
      const ano = Number(anoStr)
      const mes = Number(mesStr)

      const consolidado: DreRecord = {
        id: `grupo-${grupoId}-d-${ano}-${mes}`,
        collectionId: 'grupos_empresariais',
        collectionName: 'grupos_empresariais',
        created: lista[0].created,
        updated: lista[0].updated,
        empresa: `grupo-${grupoId}`,
        ano,
        mes,
        fechado: lista.every((d) => d.fechado),
        fechado_em: lista.find((d) => d.fechado_em)?.fechado_em,
        fechamento_obs: `Consolidado de ${lista.length} empresas do grupo`,
        receita_bruta: lista.reduce((acc, d) => acc + (d.receita_bruta || 0), 0),
        deducoes_receita: lista.reduce((acc, d) => acc + (d.deducoes_receita || 0), 0),
        custo_mercadorias: lista.reduce((acc, d) => acc + (d.custo_mercadorias || 0), 0),
        despesas_operacionais: lista.reduce((acc, d) => acc + (d.despesas_operacionais || 0), 0),
        despesas_financeiras: lista.reduce((acc, d) => acc + (d.despesas_financeiras || 0), 0),
        outras_receitas_despesas: lista.reduce(
          (acc, d) => acc + (d.outras_receitas_despesas || 0),
          0,
        ),
        imposto_renda: lista.reduce((acc, d) => acc + (d.imposto_renda || 0), 0),
      }

      resultado.push(consolidado)
    }

    resultado.sort((a, b) => {
      if (b.ano !== a.ano) return b.ano - a.ano
      return (b.mes ?? 12) - (a.mes ?? 12)
    })

    return resultado
  } catch (err) {
    console.error('Erro ao consolidar DRE por grupo:', err)
    return []
  }
}

export const gruposEmpresariaisService = {
  async getAll(): Promise<GrupoEmpresarialRecord[]> {
    return await pb.collection('grupos_empresariais').getFullList<GrupoEmpresarialRecord>({
      sort: 'nome',
      expand: 'empresas',
    })
  },

  async getById(id: string): Promise<GrupoEmpresarialRecord> {
    return await pb.collection('grupos_empresariais').getOne<GrupoEmpresarialRecord>(id, {
      expand: 'empresas',
    })
  },

  async create(data: {
    nome: string
    descricao?: string
    empresas?: string[]
  }): Promise<GrupoEmpresarialRecord> {
    const userId = pb.authStore.record?.id
    return await pb.collection('grupos_empresariais').create<GrupoEmpresarialRecord>(
      {
        nome: data.nome.trim(),
        descricao: data.descricao?.trim() || undefined,
        empresas: data.empresas || [],
        user: userId || undefined,
      },
      {
        expand: 'empresas',
      },
    )
  },

  async update(
    id: string,
    data: Partial<{
      nome: string
      descricao?: string
      empresas?: string[]
    }>,
  ): Promise<GrupoEmpresarialRecord> {
    const payload: Record<string, unknown> = {}
    if (data.nome !== undefined) payload.nome = data.nome.trim()
    if (data.descricao !== undefined) payload.descricao = data.descricao.trim() || undefined
    if (data.empresas !== undefined) payload.empresas = data.empresas
    return await pb.collection('grupos_empresariais').update<GrupoEmpresarialRecord>(id, payload, {
      expand: 'empresas',
    })
  },

  async delete(id: string): Promise<boolean> {
    return await pb.collection('grupos_empresariais').delete(id)
  },
}

export const empresasService = {
  async getAll(): Promise<EmpresaRecord[]> {
    return await pb.collection('empresas').getFullList<EmpresaRecord>({
      sort: 'nome',
    })
  },

  async getById(id: string): Promise<EmpresaRecord> {
    if (id.startsWith('grupo-')) {
      const grupoId = id.replace('grupo-', '')
      try {
        const grupo = await pb
          .collection('grupos_empresariais')
          .getOne<GrupoEmpresarialRecord>(grupoId, {
            expand: 'empresas',
          })
        const qtdEmpresas = (grupo.empresas || []).length
        return {
          id: `grupo-${grupo.id}`,
          collectionId: grupo.collectionId,
          collectionName: grupo.collectionName,
          created: grupo.created,
          updated: grupo.updated,
          nome: grupo.nome,
          nome_fantasia: `Grupo Econômico (${qtdEmpresas} ${qtdEmpresas === 1 ? 'empresa' : 'empresas'})`,
          cnpj: 'CONSOLIDADO',
          segmento: 'Outros' as any,
          observacoes:
            grupo.descricao || `Grupo consolidado com ${qtdEmpresas} empresas participantes`,
          is_grupo: true,
          grupo_id: grupo.id,
          empresas_ids: grupo.empresas || [],
        } as EmpresaRecord
      } catch (err) {
        console.error('Erro ao buscar grupo como empresa:', err)
      }
    }
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
    if (empresaId.startsWith('grupo-')) {
      const grupoId = empresaId.replace('grupo-', '')
      return await consolidarBalancosPorGrupo(grupoId)
    }
    return await pb.collection('balancos').getFullList<BalancoRecord>({
      filter: `empresa = '${empresaId}'`,
      sort: '-ano,-mes',
    })
  },

  async getAll(): Promise<BalancoRecord[]> {
    return await pb.collection('balancos').getFullList<BalancoRecord>({
      sort: '-ano,-mes',
    })
  },

  async create(data: Omit<BalancoRecord, 'id' | 'created' | 'updated'>): Promise<BalancoRecord> {
    const mes = data.mes !== undefined ? Number(data.mes) : 12
    return await pb.collection('balancos').create<BalancoRecord>({
      ...data,
      mes,
    } as any)
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
    mes?: number,
  ): Promise<BalancoRecord> {
    const targetMes =
      data.mes !== undefined ? Number(data.mes) : mes !== undefined ? Number(mes) : 12
    const existing = await pb.collection('balancos').getList<BalancoRecord>(1, 1, {
      filter: `empresa = '${empresaId}' && ano = ${ano} && mes = ${targetMes}`,
    })
    if (existing.items.length > 0) {
      return await pb.collection('balancos').update<BalancoRecord>(existing.items[0].id, {
        ...data,
        mes: targetMes,
      })
    } else {
      return await pb.collection('balancos').create<BalancoRecord>({
        ...data,
        empresa: empresaId,
        ano,
        mes: targetMes,
      } as any)
    }
  },
}

export const dreService = {
  async getByEmpresa(empresaId: string): Promise<DreRecord[]> {
    if (empresaId.startsWith('grupo-')) {
      const grupoId = empresaId.replace('grupo-', '')
      return await consolidarDrePorGrupo(grupoId)
    }
    return await pb.collection('dre').getFullList<DreRecord>({
      filter: `empresa = '${empresaId}'`,
      sort: '-ano,-mes',
    })
  },

  async getAll(): Promise<DreRecord[]> {
    return await pb.collection('dre').getFullList<DreRecord>({
      sort: '-ano,-mes',
    })
  },

  async create(data: Omit<DreRecord, 'id' | 'created' | 'updated'>): Promise<DreRecord> {
    const mes = data.mes !== undefined ? Number(data.mes) : 12
    return await pb.collection('dre').create<DreRecord>({
      ...data,
      mes,
    } as any)
  },

  async update(id: string, data: Partial<DreRecord>): Promise<DreRecord> {
    return await pb.collection('dre').update<DreRecord>(id, data)
  },

  async delete(id: string): Promise<boolean> {
    return await pb.collection('dre').delete(id)
  },

  async upsert(
    empresaId: string,
    ano: number,
    data: Partial<DreRecord>,
    mes?: number,
  ): Promise<DreRecord> {
    const targetMes =
      data.mes !== undefined ? Number(data.mes) : mes !== undefined ? Number(mes) : 12
    const existing = await pb.collection('dre').getList<DreRecord>(1, 1, {
      filter: `empresa = '${empresaId}' && ano = ${ano} && mes = ${targetMes}`,
    })
    if (existing.items.length > 0) {
      return await pb.collection('dre').update<DreRecord>(existing.items[0].id, {
        ...data,
        mes: targetMes,
      })
    } else {
      return await pb.collection('dre').create<DreRecord>({
        ...data,
        empresa: empresaId,
        ano,
        mes: targetMes,
      } as any)
    }
  },
}

export const fechamentoMensalService = {
  /**
   * Executa o fechamento de competência de um determinado mês:
   * 1. Marca o Balanço e DRE do mês fechado como fechado: true, fechado_em: ISO string
   * 2. Incorpora o Lucro/Prejuízo Líquido do mês apurado na DRE nos "Lucros Acumulados" do Balanço do mês fechado
   * 3. Projeta/inicializa o Balanço do mês seguinte (mes + 1, ou Jan do próximo ano) transferindo os saldos patrimoniais (acumulados)
   * 4. Garante que o DRE do mês seguinte inicie zerado (contas de resultado zeradas para apuração do novo período)
   */
  async fecharMes(options: {
    empresaId: string
    ano: number
    mes: number
    observacoes?: string
  }): Promise<{
    balancoFechado: BalancoRecord
    dreFechada: DreRecord
    proximoBalanco?: BalancoRecord
    proximaDre?: DreRecord
    lucroApurado: number
  }> {
    const { empresaId, ano, mes, observacoes } = options
    const fechadoEm = new Date().toISOString()

    // 1. Obter ou montar balanço e DRE do mês atual
    const bList = await balancosService.getByEmpresa(empresaId)
    const dList = await dreService.getByEmpresa(empresaId)

    const balancoMes = bList.find((b) => b.ano === ano && (b.mes ?? 12) === mes)
    const dreMes = dList.find((d) => d.ano === ano && (d.mes ?? 12) === mes)

    if (!balancoMes && !dreMes) {
      throw new Error(
        `Não existem lançamentos contábeis cadastrados para ${mes}/${ano} para realizar o fechamento.`,
      )
    }

    // Calcular resultado do mês atual (DRE)
    const recLiq = (dreMes?.receita_bruta || 0) - (dreMes?.deducoes_receita || 0)
    const lucroBruto = recLiq - (dreMes?.custo_mercadorias || 0)
    const ro = lucroBruto - (dreMes?.despesas_operacionais || 0)
    const lair = ro - (dreMes?.despesas_financeiras || 0) + (dreMes?.outras_receitas_despesas || 0)
    const lucroLiquidoApurado = lair - (dreMes?.imposto_renda || 0)

    // Atualizar balanço do mês com incorporação do resultado em Lucros Acumulados (se já não estiver)
    const lucrosAcumuladosAtual = balancoMes?.lucros_acumulados || 0
    const novoLucrosAcumulados = lucrosAcumuladosAtual + lucroLiquidoApurado

    // Salvar Balanço Fechado
    const balancoFechado = await balancosService.upsert(
      empresaId,
      ano,
      {
        ...(balancoMes || {}),
        lucros_acumulados: novoLucrosAcumulados,
        fechado: true,
        fechado_em: fechadoEm,
        fechamento_obs: observacoes || undefined,
      },
      mes,
    )

    // Salvar DRE Fechada
    const dreFechada = await dreService.upsert(
      empresaId,
      ano,
      {
        ...(dreMes || {}),
        fechado: true,
        fechado_em: fechadoEm,
        fechamento_obs: observacoes || undefined,
      },
      mes,
    )

    // 2. Preparar mês seguinte:
    const proxMes = mes === 12 ? 1 : mes + 1
    const proxAno = mes === 12 ? ano + 1 : ano

    // Projeta Balanço inicial do mês seguinte se não existir
    const existingProxBalanco = bList.find((b) => b.ano === proxAno && (b.mes ?? 12) === proxMes)
    let proximoBalanco: BalancoRecord | undefined = undefined

    if (!existingProxBalanco) {
      // Cria balanço do próximo mês herdando os saldos patrimoniais finais do mês fechado
      proximoBalanco = await balancosService.upsert(
        empresaId,
        proxAno,
        {
          caixa_equivalentes: balancoFechado.caixa_equivalentes,
          aplicacoes_financeiras: balancoFechado.aplicacoes_financeiras,
          contas_receber: balancoFechado.contas_receber,
          estoques: balancoFechado.estoques,
          impostos_recuperar: balancoFechado.impostos_recuperar,
          outros_ativo_circulante: balancoFechado.outros_ativo_circulante,
          realizavel_longo_prazo: balancoFechado.realizavel_longo_prazo,
          investimentos: balancoFechado.investimentos,
          imobilizado: balancoFechado.imobilizado,
          intangivel: balancoFechado.intangivel,
          fornecedores: balancoFechado.fornecedores,
          emprestimos_curto_prazo: balancoFechado.emprestimos_curto_prazo,
          obrigacoes_trabalhistas: balancoFechado.obrigacoes_trabalhistas,
          obrigacoes_tributarias: balancoFechado.obrigacoes_tributarias,
          outros_passivo_circulante: balancoFechado.outros_passivo_circulante,
          emprestimos_longo_prazo: balancoFechado.emprestimos_longo_prazo,
          outras_obrigacoes_longo_prazo: balancoFechado.outras_obrigacoes_longo_prazo,
          capital_social: balancoFechado.capital_social,
          reservas_lucros: balancoFechado.reservas_lucros,
          lucros_acumulados: balancoFechado.lucros_acumulados,
          vinculos_contas: balancoFechado.vinculos_contas,
          fechado: false,
          fechado_em: undefined,
          fechamento_obs: `Iniciado a partir do fechamento de ${mes}/${ano}`,
        },
        proxMes,
      )
    }

    // Garante DRE do próximo mês zerada
    const existingProxDre = dList.find((d) => d.ano === proxAno && (d.mes ?? 12) === proxMes)
    let proximaDre: DreRecord | undefined = undefined

    if (!existingProxDre) {
      proximaDre = await dreService.upsert(
        empresaId,
        proxAno,
        {
          receita_bruta: 0,
          deducoes_receita: 0,
          custo_mercadorias: 0,
          despesas_operacionais: 0,
          despesas_financeiras: 0,
          outras_receitas_despesas: 0,
          imposto_renda: 0,
          fechado: false,
          fechado_em: undefined,
          fechamento_obs: `Contas de resultado zeradas após fechamento de ${mes}/${ano}`,
        },
        proxMes,
      )
    }

    return {
      balancoFechado,
      dreFechada,
      proximoBalanco,
      proximaDre,
      lucroApurado: lucroLiquidoApurado,
    }
  },

  /**
   * Executa o fechamento em lote de múltiplos meses sequenciais de um ano (ex: do mês 1 até o mês limite)
   */
  async fecharEmLote(options: {
    empresaId: string
    ano: number
    ateMes?: number
    observacoes?: string
  }): Promise<{
    mesesProcessados: number[]
    mesesFechadosComSucesso: Array<{
      mes: number
      lucroApurado: number
    }>
    mesesPuladosSemDados: number[]
    erros: Array<{ mes: number; motivo: string }>
  }> {
    const { empresaId, ano, ateMes, observacoes } = options
    const currentYear = new Date().getFullYear()
    const currentMonth = new Date().getMonth() + 1
    const mesMaximo = ateMes !== undefined ? ateMes : ano === currentYear ? currentMonth : 12

    const resultado = {
      mesesProcessados: [] as number[],
      mesesFechadosComSucesso: [] as Array<{ mes: number; lucroApurado: number }>,
      mesesPuladosSemDados: [] as number[],
      erros: [] as Array<{ mes: number; motivo: string }>,
    }

    for (let m = 1; m <= mesMaximo; m++) {
      resultado.mesesProcessados.push(m)
      try {
        const res = await this.fecharMes({
          empresaId,
          ano,
          mes: m,
          observacoes:
            observacoes ||
            `Fechamento em lote executado em ${new Date().toLocaleDateString('pt-BR')}`,
        })
        resultado.mesesFechadosComSucesso.push({
          mes: m,
          lucroApurado: res.lucroApurado,
        })
      } catch (err: any) {
        const errorMsg = err?.message || 'Erro desconhecido'
        if (
          errorMsg.includes('Não existem lançamentos contábeis') ||
          errorMsg.includes('sem dados')
        ) {
          resultado.mesesPuladosSemDados.push(m)
        } else {
          resultado.erros.push({ mes: m, motivo: errorMsg })
        }
      }
    }

    return resultado
  },

  /**
   * Reabre um mês previamente fechado
   */
  async reabrirMes(options: {
    empresaId: string
    ano: number
    mes: number
  }): Promise<{ balanco: BalancoRecord | null; dre: DreRecord | null }> {
    const { empresaId, ano, mes } = options
    const bList = await balancosService.getByEmpresa(empresaId)
    const dList = await dreService.getByEmpresa(empresaId)

    const balancoMes = bList.find((b) => b.ano === ano && (b.mes ?? 12) === mes)
    const dreMes = dList.find((d) => d.ano === ano && (d.mes ?? 12) === mes)

    let updatedB: BalancoRecord | null = null
    let updatedD: DreRecord | null = null

    if (balancoMes) {
      updatedB = await balancosService.update(balancoMes.id, {
        fechado: false,
        fechado_em: '',
        fechamento_obs: 'Competência reaberta para ajustes.',
      })
    }
    if (dreMes) {
      updatedD = await dreService.update(dreMes.id, {
        fechado: false,
        fechado_em: '',
        fechamento_obs: 'Competência reaberta para ajustes.',
      })
    }

    return { balanco: updatedB, dre: updatedD }
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
  async getAll(options?: { empresaId?: string }): Promise<PlanoContaRecord[]> {
    const params: Record<string, unknown> = {
      sort: 'codigo',
      expand: 'empresa,conta,centro,tipo_despesa',
    }
    if (options?.empresaId) {
      params.filter = `empresa = '${options.empresaId}'`
    }
    return await pb.collection('plano_contas').getFullList<PlanoContaRecord>(params)
  },

  // Calcula o próximo código (PC-NNN) com base nos códigos já existentes.
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
    empresa?: string
    conta: string
    centro: string
    tipo_despesa?: string
    descricao?: string
  }): Promise<PlanoContaRecord> {
    return await pb.collection('plano_contas').create<PlanoContaRecord>(
      {
        empresa: data.empresa || undefined,
        conta: data.conta,
        centro: data.centro,
        tipo_despesa: data.tipo_despesa || undefined,
        descricao: data.descricao?.trim() || undefined,
        user: currentUserId(),
      } as any,
      {
        expand: 'empresa,conta,centro,tipo_despesa',
      },
    )
  },

  async update(
    id: string,
    data: Partial<
      Pick<PlanoContaRecord, 'empresa' | 'conta' | 'centro' | 'tipo_despesa' | 'descricao'>
    >,
  ): Promise<PlanoContaRecord> {
    const payload: Record<string, unknown> = { ...data }
    if (data.tipo_despesa === '') payload.tipo_despesa = null
    if (data.descricao !== undefined) payload.descricao = data.descricao.trim() || undefined
    return await pb.collection('plano_contas').update<PlanoContaRecord>(id, payload, {
      expand: 'empresa,conta,centro,tipo_despesa',
    })
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

export const memoriaFornecedoresService = {
  async getAll(): Promise<import('@/types/finance').MemoriaFornecedorRecord[]> {
    return await pb
      .collection('memoria_fornecedores_despesas')
      .getFullList<import('@/types/finance').MemoriaFornecedorRecord>({
        sort: '-total_utilizacoes,-updated',
        expand: 'plano_conta,plano_conta.conta,plano_conta.centro,plano_conta.tipo_despesa,empresa',
      })
  },

  async getByEmpresa(
    empresaId?: string,
  ): Promise<import('@/types/finance').MemoriaFornecedorRecord[]> {
    const filter = empresaId ? `empresa = "${empresaId}" || empresa = null || empresa = ""` : ''
    return await pb
      .collection('memoria_fornecedores_despesas')
      .getFullList<import('@/types/finance').MemoriaFornecedorRecord>({
        filter: filter || undefined,
        sort: '-total_utilizacoes,-updated',
        expand: 'plano_conta,plano_conta.conta,plano_conta.centro,plano_conta.tipo_despesa,empresa',
      })
  },

  async registrarOuAtualizarVinculo(data: {
    fornecedor_padrao: string
    termo_busca: string
    plano_conta: string
    empresa?: string
    categoria_sugerida?: string
  }): Promise<import('@/types/finance').MemoriaFornecedorRecord> {
    const userId = pb.authStore.record?.id || pb.authStore.model?.id
    const termoNorm = data.termo_busca.toLowerCase().trim()
    const filterEmpresa = data.empresa ? `empresa = "${data.empresa}" && ` : ''
    const filter = `${filterEmpresa}termo_busca = "${termoNorm}"`

    const existing = await pb
      .collection('memoria_fornecedores_despesas')
      .getList<import('@/types/finance').MemoriaFornecedorRecord>(1, 1, {
        filter,
      })

    const hoje = new Date().toISOString().slice(0, 10)

    if (existing.items.length > 0) {
      const item = existing.items[0]
      const total = (item.total_utilizacoes || 1) + 1
      return await pb
        .collection('memoria_fornecedores_despesas')
        .update<import('@/types/finance').MemoriaFornecedorRecord>(
          item.id,
          {
            plano_conta: data.plano_conta,
            categoria_sugerida: data.categoria_sugerida || item.categoria_sugerida,
            total_utilizacoes: total,
            ultima_utilizacao: hoje,
          },
          {
            expand: 'plano_conta,plano_conta.conta,plano_conta.centro,plano_conta.tipo_despesa',
          },
        )
    }

    return await pb
      .collection('memoria_fornecedores_despesas')
      .create<import('@/types/finance').MemoriaFornecedorRecord>(
        {
          user: userId,
          empresa: data.empresa || undefined,
          fornecedor_padrao: data.fornecedor_padrao.trim(),
          termo_busca: termoNorm,
          plano_conta: data.plano_conta,
          categoria_sugerida: data.categoria_sugerida || undefined,
          total_utilizacoes: 1,
          ultima_utilizacao: hoje,
        },
        {
          expand: 'plano_conta,plano_conta.conta,plano_conta.centro,plano_conta.tipo_despesa',
        },
      )
  },
}
