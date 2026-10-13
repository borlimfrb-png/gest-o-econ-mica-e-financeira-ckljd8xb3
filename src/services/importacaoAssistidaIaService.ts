import pb from '@/lib/pocketbase/client'
import type {
  PlanoContaRecord,
  MemoriaFornecedorRecord,
  EmpresaRecord,
  LancamentoRecord,
} from '@/types/finance'
import { auditoriaLancamentosService } from './auditoriaLancamentosService'
import { memoriaFornecedoresService } from './financeService'

export interface DespesaIaPropostaItem {
  id: string
  descricao: string
  valor: number
  competencia: string // YYYY-MM ou YYYY-MM-DD
  categoria?: string
  conta_hierarquia?: string
  subconta_hierarquia?: string
  sugestao_plano_conta_id?: string | null

  // Vínculo atribuído pelo usuário ou sugerido
  planoContaId?: string
  planoContaNome?: string
  planoContaCodigo?: string
  statusVinculo: 'vinculada' | 'pendente'
  origemSugestao?: 'ia' | 'memoria' | 'codigo_empresa' | 'similaridade' | 'manual'
}

export interface SubcontaIaProposta {
  id: string
  nome: string
  despesas: DespesaIaPropostaItem[]
  total_despesas: number
  valor_subtotal: number
}

export interface ContaIaProposta {
  id: string
  nome: string
  subcontas: SubcontaIaProposta[]
  total_despesas: number
  valor_total: number
}

export interface TruncamentoDetalhes {
  doc_truncated?: boolean
  text_truncated?: boolean
  ai_truncated?: boolean
  total_lido?: number
  total_estimado?: number
  caracteres_extraidos?: number
}

export interface PropostaImportacaoIaResult {
  conta_principal: string
  contas: ContaIaProposta[]
  despesas: DespesaIaPropostaItem[]
  total_despesas: number
  total_contas?: number
  total_subcontas?: number
  total_estimado?: number
  caracteres_extraidos?: number
  valor_total: number
  observacoes?: string
  truncated?: boolean
  truncamento_detalhes?: TruncamentoDetalhes
}

export interface AnalisarPdfIaInput {
  file: File
  empresaId: string
  empresaNome?: string
  periodoInicio: string
  periodoFim?: string
  planoContas?: PlanoContaRecord[]
  memorias?: MemoriaFornecedorRecord[]
}

export interface RascunhoImportacaoRecord {
  id: string
  user: string
  empresa?: string
  arquivo_nome: string
  periodo_tipo: 'unico' | 'faixa'
  periodo_inicio: string
  periodo_fim?: string
  conta_principal: string
  status: 'pendente' | 'confirmado' | 'descartado'
  proposta_json: {
    conta_principal: string
    contas?: ContaIaProposta[]
    despesas: DespesaIaPropostaItem[]
    observacoes?: string
    valor_total: number
  }
  hierarquia_json?: {
    conta_principal: string
    contas: ContaIaProposta[]
  }
  total_despesas: number
  valor_total: number
  created: string
  updated: string
}

export interface ConfirmarImportacaoInput {
  empresaId: string
  contaPrincipal: string
  despesas: DespesaIaPropostaItem[]
  arquivoNome: string
  periodoInicio: string
  periodoFim?: string
  rascunhoId?: string
}

export interface ConfirmarImportacaoResult {
  sucesso: boolean
  lancamentosCriados: number
  valorTotalLancado: number
  vinculosAprendidos: number
  erros: string[]
}

/**
 * Normaliza textos para comparação e busca
 */
function normalizeStr(text: string): string {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Heurística de sugestão automática por similaridade + memória de fornecedores
 */
export function sugerirVinculoParaDespesa(
  descricao: string,
  planoContas: PlanoContaRecord[],
  memorias: MemoriaFornecedorRecord[] = [],
  sugestaoIaId?: string | null,
): {
  planoConta?: PlanoContaRecord
  origem: 'ia' | 'memoria' | 'codigo_empresa' | 'similaridade' | 'manual'
} {
  // 1. Se o Agente de IA já sugeriu um ID válido existente no plano da empresa
  if (sugestaoIaId) {
    const pc = planoContas.find((p) => p.id === sugestaoIaId)
    if (pc) {
      return { planoConta: pc, origem: 'ia' }
    }
  }

  const descNorm = normalizeStr(descricao)
  if (!descNorm || planoContas.length === 0) {
    return { origem: 'manual' }
  }

  // 2. Prioridade máxima: Memória de Fornecedores anteriores (vínculos confirmados)
  for (const mem of memorias) {
    const termoNorm = normalizeStr(mem.termo_busca || mem.fornecedor_padrao || '')
    if (!termoNorm || termoNorm.length < 3) continue

    if (descNorm === termoNorm || descNorm.includes(termoNorm) || termoNorm.includes(descNorm)) {
      const pc =
        planoContas.find((p) => p.id === mem.plano_conta) ||
        (mem.expand?.plano_conta
          ? planoContas.find((p) => p.id === mem.expand.plano_conta.id)
          : null)

      if (pc) {
        return { planoConta: pc, origem: 'memoria' }
      }
    }
  }

  // 3. Match por código da conta da empresa (ex: '3.1.1.01')
  for (const pc of planoContas) {
    const codEmp = pc.codigo_empresa?.trim()
    if (!codEmp || codEmp.length < 2) continue
    const codEmpNorm = normalizeStr(codEmp)
    if (codEmpNorm && (descNorm.includes(codEmpNorm) || codEmpNorm.includes(descNorm))) {
      return { planoConta: pc, origem: 'codigo_empresa' }
    }
  }

  // 4. Match por nome da Conta ou Centro de Custo
  let bestPc: PlanoContaRecord | undefined
  let longestMatch = 0

  for (const pc of planoContas) {
    const nomeConta = normalizeStr(pc.expand?.conta?.nome || '')
    const nomeCentro = normalizeStr(pc.expand?.centro?.nome || '')
    const codConta = normalizeStr(pc.expand?.conta?.codigo || '')
    const codPC = normalizeStr(pc.codigo || '')

    if (nomeConta && descNorm === nomeConta) {
      return { planoConta: pc, origem: 'similaridade' }
    }

    if (codConta && codConta.length >= 3 && descNorm.includes(codConta)) {
      return { planoConta: pc, origem: 'similaridade' }
    }
    if (codPC && codPC.length >= 3 && descNorm.includes(codPC)) {
      return { planoConta: pc, origem: 'similaridade' }
    }

    if (nomeConta.length >= 4 && descNorm.includes(nomeConta)) {
      if (nomeConta.length > longestMatch) {
        longestMatch = nomeConta.length
        bestPc = pc
      }
    } else if (nomeCentro.length >= 4 && descNorm.includes(nomeCentro)) {
      if (nomeCentro.length > longestMatch) {
        longestMatch = nomeCentro.length
        bestPc = pc
      }
    }
  }

  if (bestPc) {
    return { planoConta: bestPc, origem: 'similaridade' }
  }

  return { origem: 'manual' }
}

export const importacaoAssistidaIaService = {
  /**
   * Envia o PDF para o backend, extrai o texto com $documents.toMarkdown e obtém
   * a proposta estruturada do Agente de IA com a Conta Principal e Despesas Detalhadas.
   */
  async analisarPdfComIa(input: AnalisarPdfIaInput): Promise<PropostaImportacaoIaResult> {
    const backendUrl = import.meta.env.VITE_POCKETBASE_URL || ''
    const token = pb.authStore.token

    if (!token) {
      throw new Error('Sessão expirada. Faça login novamente para prosseguir.')
    }

    const formData = new FormData()
    formData.append('arquivo', input.file)
    formData.append('empresaId', input.empresaId || '')
    formData.append('empresaNome', input.empresaNome || 'Empresa')
    formData.append('periodoInicio', input.periodoInicio)
    formData.append('periodoFim', input.periodoFim || input.periodoInicio)

    const res = await fetch(`${backendUrl}/backend/v1/agent-despesas/analisar-pdf`, {
      method: 'POST',
      headers: {
        Authorization: token,
      },
      body: formData,
    })

    const payload = await res.json()
    if (!res.ok) {
      throw new Error(payload?.error || 'Falha ao analisar o PDF com o Agente de IA.')
    }

    const rawDespesas = (payload.despesas || []) as Array<{
      id: string
      descricao: string
      valor: number
      competencia: string
      categoria?: string
      sugestao_plano_conta_id?: string | null
    }>

    // Aplica resolução de sugestão e vinculação automática com base no planoContas e memórias
    const planoContas = input.planoContas || []
    const memorias = input.memorias || []

    // Mapa rápido dos itens processados para reconstruir ou atualizar árvore
    const mapProcessadosPorId = new Map<string, DespesaIaPropostaItem>()

    const despesasProcessadas: DespesaIaPropostaItem[] = rawDespesas.map((d: any) => {
      const sugestao = sugerirVinculoParaDespesa(
        d.descricao,
        planoContas,
        memorias,
        d.sugestao_plano_conta_id,
      )

      const pc = sugestao.planoConta
      const item: DespesaIaPropostaItem = {
        id: d.id,
        descricao: d.descricao,
        valor: Math.abs(Number(d.valor) || 0),
        competencia: d.competencia || input.periodoInicio,
        categoria: d.categoria,
        conta_hierarquia: d.conta_hierarquia,
        subconta_hierarquia: d.subconta_hierarquia,
        sugestao_plano_conta_id: d.sugestao_plano_conta_id,
        planoContaId: pc?.id,
        planoContaNome: pc?.expand?.conta?.nome,
        planoContaCodigo: pc?.codigo,
        statusVinculo: pc ? 'vinculada' : 'pendente',
        origemSugestao: sugestao.origem,
      }
      mapProcessadosPorId.set(item.id, item)
      return item
    })

    // Reconstrói / sincroniza as contas hierárquicas com os itens que receberam vínculos sugeridos
    const rawContas = Array.isArray(payload.contas) ? payload.contas : []
    const contasProcessadas: ContaIaProposta[] = rawContas.map((c: any) => {
      const subcontas: SubcontaIaProposta[] = (c.subcontas || []).map((sc: any) => {
        const itensDaSubconta = (sc.despesas || []).map((d: any) => {
          return (
            mapProcessadosPorId.get(d.id) || {
              ...d,
              statusVinculo: d.planoContaId ? 'vinculada' : 'pendente',
            }
          )
        })
        const subtotal = itensDaSubconta.reduce(
          (acc: number, cur: any) => acc + (cur.valor || 0),
          0,
        )
        return {
          id: sc.id || `sub_${sc.nome}`,
          nome: sc.nome || 'Geral',
          despesas: itensDaSubconta,
          total_despesas: itensDaSubconta.length,
          valor_subtotal: subtotal,
        }
      })
      const totalConta = subcontas.reduce((acc, sc) => acc + sc.valor_subtotal, 0)
      const totalItens = subcontas.reduce((acc, sc) => acc + sc.total_despesas, 0)
      return {
        id: c.id || `conta_${c.nome}`,
        nome: c.nome || 'Despesas',
        subcontas,
        total_despesas: totalItens,
        valor_total: totalConta,
      }
    })

    // Se porventura contas veio vazio, constrói a árvore a partir de conta_hierarquia / subconta_hierarquia
    if (contasProcessadas.length === 0 && despesasProcessadas.length > 0) {
      const contaMae = payload.conta_principal || 'Despesas Gerais'
      const gruposSub = new Map<string, DespesaIaPropostaItem[]>()
      for (const item of despesasProcessadas) {
        const sub = item.subconta_hierarquia || item.categoria || 'Geral'
        const list = gruposSub.get(sub) || []
        list.push(item)
        gruposSub.set(sub, list)
      }
      const subcontas: SubcontaIaProposta[] = []
      for (const [subNome, itens] of gruposSub.entries()) {
        const subtotal = itens.reduce((acc, i) => acc + (i.valor || 0), 0)
        subcontas.push({
          id: `sub_${subNome}`,
          nome: subNome,
          despesas: itens,
          total_despesas: itens.length,
          valor_subtotal: subtotal,
        })
      }
      const totalConta = subcontas.reduce((acc, sc) => acc + sc.valor_subtotal, 0)
      contasProcessadas.push({
        id: `conta_${contaMae}`,
        nome: contaMae,
        subcontas,
        total_despesas: despesasProcessadas.length,
        valor_total: totalConta,
      })
    }

    const totalSubcontas = contasProcessadas.reduce(
      (acc, c) => acc + (c.subcontas ? c.subcontas.length : 0),
      0,
    )

    return {
      conta_principal: payload.conta_principal || 'Despesas Gerais e Operacionais',
      contas: contasProcessadas,
      despesas: despesasProcessadas,
      total_despesas: despesasProcessadas.length,
      total_contas: payload.total_contas || contasProcessadas.length,
      total_subcontas: payload.total_subcontas || totalSubcontas,
      total_estimado: payload.total_estimado,
      caracteres_extraidos: payload.caracteres_extraidos,
      valor_total: Number(payload.valor_total) || 0,
      observacoes: payload.observacoes,
      truncated: payload.truncated,
      truncamento_detalhes: payload.truncamento_detalhes,
    }
  },

  /**
   * Salva ou atualiza a proposta em rascunho na coleção 'importacao_rascunhos'
   */
  async salvarRascunho(options: {
    rascunhoId?: string
    empresaId?: string
    arquivoNome: string
    periodoInicio: string
    periodoFim?: string
    contaPrincipal: string
    contas?: ContaIaProposta[]
    despesas: DespesaIaPropostaItem[]
    observacoes?: string
  }): Promise<RascunhoImportacaoRecord | null> {
    const userId = pb.authStore.record?.id
    if (!userId) return null

    const valorTotal = options.despesas.reduce((acc, d) => acc + (d.valor || 0), 0)
    const periodoTipo =
      options.periodoFim && options.periodoFim !== options.periodoInicio ? 'faixa' : 'unico'

    const propostaJson = {
      conta_principal: options.contaPrincipal,
      contas: options.contas || [],
      despesas: options.despesas,
      observacoes: options.observacoes,
      valor_total: valorTotal,
    }

    const payload: any = {
      user: userId,
      empresa: options.empresaId || undefined,
      arquivo_nome: options.arquivoNome,
      periodo_tipo: periodoTipo,
      periodo_inicio: options.periodoInicio,
      periodo_fim: options.periodoFim || options.periodoInicio,
      conta_principal: options.contaPrincipal,
      status: 'pendente',
      proposta_json: propostaJson,
      hierarquia_json: {
        conta_principal: options.contaPrincipal,
        contas: options.contas || [],
      },
      total_despesas: options.despesas.length,
      valor_total: valorTotal,
    }

    try {
      if (options.rascunhoId) {
        return await pb
          .collection('importacao_rascunhos')
          .update<RascunhoImportacaoRecord>(options.rascunhoId, payload)
      }

      return await pb.collection('importacao_rascunhos').create<RascunhoImportacaoRecord>(payload)
    } catch (err) {
      console.warn('Falha ao salvar rascunho de importação:', err)
      return null
    }
  },

  /**
   * Obtém o rascunho pendente mais recente para a empresa/usuário atual
   */
  async getRascunhoPendente(empresaId?: string): Promise<RascunhoImportacaoRecord | null> {
    const userId = pb.authStore.record?.id
    if (!userId) return null

    try {
      const filters: string[] = [`user = '${userId}'`, `status = 'pendente'`]
      if (empresaId) {
        filters.push(`empresa = '${empresaId}'`)
      }

      const res = await pb
        .collection('importacao_rascunhos')
        .getList<RascunhoImportacaoRecord>(1, 1, {
          filter: filters.join(' && '),
          sort: '-updated',
        })

      return res.items.length > 0 ? res.items[0] : null
    } catch (err) {
      console.warn('Erro ao carregar rascunho pendente:', err)
      return null
    }
  },

  /**
   * Descarta um rascunho
   */
  async descartarRascunho(id: string): Promise<boolean> {
    try {
      await pb.collection('importacao_rascunhos').update(id, { status: 'descartado' })
      return true
    } catch {
      return false
    }
  },

  /**
   * Confirma a importação:
   * 1. Cria os registros em 'lancamentos' com a conta do plano vinculada
   * 2. Registra logs na auditoria de lançamentos
   * 3. Alimenta a memória do agente ('memoria_fornecedores_despesas') para aprendizado futuro
   * 4. Marca o rascunho como confirmado
   */
  async confirmarImportacao(
    input: ConfirmarImportacaoInput,
    planoContas: PlanoContaRecord[],
  ): Promise<ConfirmarImportacaoResult> {
    const userId = pb.authStore.record?.id
    if (!userId) {
      throw new Error('Usuário não autenticado.')
    }
    if (!input.empresaId) {
      throw new Error('Empresa de destino é obrigatória para gravar os lançamentos.')
    }

    const despesasComPlano = input.despesas.filter((d) => Boolean(d.planoContaId))
    if (despesasComPlano.length === 0) {
      throw new Error(
        'Nenhuma despesa possui vínculo com o Plano de Contas. Vincule ao menos uma despesa antes de confirmar.',
      )
    }

    let criadosCount = 0
    let valorTotalLancado = 0
    let vinculosAprendidos = 0
    const erros: string[] = []

    for (const item of despesasComPlano) {
      try {
        const pc = planoContas.find((p) => p.id === item.planoContaId)
        const codConta = pc?.expand?.conta?.codigo || pc?.codigo || ''
        const nomeConta = pc?.expand?.conta?.nome || 'Conta'
        const contaInfoStr = `${codConta} - ${nomeConta}`.trim()

        // Determina data válida (formato YYYY-MM-DD)
        let dataLancamento = item.competencia
        if (!dataLancamento || dataLancamento.length < 7) {
          dataLancamento = `${input.periodoInicio.slice(0, 7)}-01`
        } else if (dataLancamento.length === 7) {
          // Apenas ano-mês: atribui dia 01
          dataLancamento = `${dataLancamento}-01`
        }

        const historicoTexto = `[Importação IA PDF] ${item.descricao} | Conta-Mãe: ${input.contaPrincipal}`

        // Grava na coleção 'lancamentos'
        const recLanc = await pb.collection('lancamentos').create<LancamentoRecord>({
          empresa: input.empresaId,
          plano_conta: item.planoContaId,
          data: dataLancamento,
          valor: item.valor,
          historico: historicoTexto,
          user: userId,
        })

        criadosCount++
        valorTotalLancado += item.valor

        // Auditoria
        try {
          await auditoriaLancamentosService.registrar({
            empresa: input.empresaId,
            lancamento_id: recLanc.id,
            acao: 'criacao',
            valor: item.valor,
            historico: historicoTexto,
            conta_info: contaInfoStr,
            detalhes: {
              motivo: `Importação assistida por IA a partir do PDF "${input.arquivoNome}"`,
              dados_novos: {
                origem: 'importacao_ia_pdf',
                arquivo: input.arquivoNome,
                conta_principal: input.contaPrincipal,
                competencia: item.competencia,
              },
            },
          })
        } catch {
          /* auditoria não bloqueia lançamento */
        }

        // 3. Alimenta a Memória do Agente para aprendizado futuro
        if (item.planoContaId && item.descricao.trim().length >= 3) {
          try {
            await memoriaFornecedoresService.registrarOuAtualizarVinculo({
              fornecedor_padrao: item.descricao.trim(),
              termo_busca: item.descricao.trim(),
              plano_conta: item.planoContaId,
              empresa: input.empresaId,
              categoria_sugerida: input.contaPrincipal || item.categoria,
            })
            vinculosAprendidos++
          } catch {
            /* aprendizado não bloqueia importação */
          }
        }
      } catch (err: any) {
        erros.push(
          `Erro ao gravar despesa "${item.descricao}": ${err?.message || 'Falha no banco'}`,
        )
      }
    }

    // 4. Marca o rascunho como confirmado
    if (input.rascunhoId) {
      try {
        await pb.collection('importacao_rascunhos').update(input.rascunhoId, {
          status: 'confirmado',
        })
      } catch {
        /* ignora */
      }
    }

    return {
      sucesso: criadosCount > 0,
      lancamentosCriados: criadosCount,
      valorTotalLancado,
      vinculosAprendidos,
      erros,
    }
  },
}
