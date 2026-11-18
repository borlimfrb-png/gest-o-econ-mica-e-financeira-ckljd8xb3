import pb from '@/lib/pocketbase/client'
import { fetchAllRecords } from '@/lib/pocketbase/fetchAll'

/** Registro da coleção ferramentas_usuarios (migração 0109). */
export interface FerramentasUsuarioRecord {
  id: string
  user: string
  ferramentas_desabilitadas: string[] | null
  atualizado_por?: string
  collectionId?: string
  collectionName?: string
  created?: string
  updated?: string
  expand?: Record<string, any>
}

export const TODAS_FERRAMENTAS_IDS = [
  'dashboard',
  'dashboard_bi',
  'cliente_balanco',
  'gerencial_dre',
  'gerencial_projecao_dre',
  'gerencial_comparativo_mensal',
  'gerencial_despesas_fixas',
  'gerencial_despesas_variaveis',
  'gerencial_comparativo_despesas',
  'gerencial_fluxo_caixa',
  'gerencial_analise_faturamento',
  'gerencial_indicador_crescimento',
  'gerencial_rentabilidade',
  'gerencial_dashboard_bi',
  'gerencial_indicadores',
  'gerencial_termometro_insolvencia',
  'gerencial_indicadores_avancados',
  'financeiro',
  'baixa_recebiveis',
  'contratos',
  'notas_fiscais',
  'formacao_preco',
  'indicadores',
  'indicadores_valuation',
  'planejamento',
  'analise_tributaria',
  'importacao',
  'relatorios',
  'relatorio_anual',
  'agente_ia',
] as const

/** Normaliza o campo JSON da coleção: pode vir string, array ou null. */
export function normalizarLista(valor: unknown): string[] {
  if (Array.isArray(valor)) {
    return valor.filter((v): v is string => typeof v === 'string')
  }
  if (typeof valor === 'string' && valor.trim() !== '') {
    try {
      const parsed = JSON.parse(valor)
      if (Array.isArray(parsed)) {
        return parsed.filter((v): v is string => typeof v === 'string')
      }
    } catch {
      // JSON inválido: trata como vazio (falha aberta — nada desabilitado)
    }
  }
  return []
}

export const ferramentasService = {
  async getAll(): Promise<FerramentasUsuarioRecord[]> {
    try {
      // Sem sort: registros criados antes da migração 0110 nasceram sem autodates
      // e sort=-updated devolvia 400 no servidor (silenciosamente virava "tudo
      // habilitado" no catch abaixo). A coleção tem um registro por usuário.
      const list = await fetchAllRecords<FerramentasUsuarioRecord>('ferramentas_usuarios')
      return list
    } catch (err) {
      console.warn('[ferramentasService] Falha ao listar habilitações:', err)
      return []
    }
  },

  async getByUser(userId: string): Promise<string[]> {
    try {
      const list = await pb
        .collection('ferramentas_usuarios')
        .getFullList<FerramentasUsuarioRecord>({
          filter: `user = "${userId}"`,
        })

      if (list.length > 0) {
        return normalizarLista(list[0].ferramentas_desabilitadas)
      }
      // Sem registro = nenhuma ferramenta desabilitada (tudo habilitado, compatibilidade)
      return []
    } catch (err) {
      console.warn('[ferramentasService] Falha ao buscar habilitações do usuário:', err)
      // Em caso de falha, não bloqueia o usuário: nada desabilitado
      return []
    }
  },

  /** Lista de ferramentas habilitadas = catálogo menos as desabilitadas. */
  async listarHabilitadas(userId: string): Promise<string[]> {
    const desabilitadas = await this.getByUser(userId)
    const set = new Set(desabilitadas)
    return TODAS_FERRAMENTAS_IDS.filter((f) => !set.has(f)) as unknown as string[]
  },

  /** Salva em lote: um registro por usuário. */
  async salvarLote(itens: Array<{ userId: string; ferramentas: string[] }>): Promise<void> {
    for (const it of itens) {
      await this.salvar(it.userId, it.ferramentas)
    }
  },

  /**
   * Upsert da lista de ferramentas DESABILITADAS do usuário.
   * Cria o registro quando não existe; atualiza o existente caso contrário.
   * Preenche `atualizado_por` com o admin logado (auditoria).
   */
  async salvar(userId: string, ferramentas: string[]): Promise<FerramentasUsuarioRecord | null> {
    try {
      const adminId = pb.authStore.record?.id || ''
      const payload: Record<string, unknown> = {
        ferramentas_desabilitadas: ferramentas,
      }
      if (adminId && adminId !== userId) {
        payload.atualizado_por = adminId
      }

      const existente = await pb
        .collection('ferramentas_usuarios')
        .getFirstListItem<FerramentasUsuarioRecord>(`user = "${userId}"`)

      return await pb
        .collection('ferramentas_usuarios')
        .update<FerramentasUsuarioRecord>(existente.id, payload)
    } catch (err: any) {
      // 404 do getFirstListItem = ainda não existe registro para o usuário → cria
      if (err?.status === 404) {
        const adminId = pb.authStore.record?.id || ''
        const createPayload: Record<string, unknown> = {
          user: userId,
          ferramentas_desabilitadas: ferramentas,
        }
        if (adminId && adminId !== userId) {
          createPayload.atualizado_por = adminId
        }
        return await pb
          .collection('ferramentas_usuarios')
          .create<FerramentasUsuarioRecord>(createPayload)
      }
      console.error('[ferramentasService] Erro ao salvar habilitações:', err)
      throw err
    }
  },

  /** Apenas para superadmins via hook backend (se necessário no futuro). */
  async excluir(userId: string): Promise<void> {
    const existente = await pb
      .collection('ferramentas_usuarios')
      .getFirstListItem<FerramentasUsuarioRecord>(`user = "${userId}"`)
    await pb.collection('ferramentas_usuarios').delete(existente.id)
  },
}
