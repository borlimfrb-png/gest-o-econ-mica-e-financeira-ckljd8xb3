import pb from '@/lib/pocketbase/client'
import type { ferramentasUsuarios } from '@/lib/pocketbase/schema'

export interface FerramentasUsuarioRecord {
  id: string
  user: string
  ferramentas: string[]
  collectionId?: string
  collectionName?: string
  created?: string
  updated?: string
  expand?: Record<string, any>
}

export const TODAS_FERRAMENTAS_IDS = [
  'dashboard',
  'dashboard_bi',
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

export const ferramentasService = {
  async getAll(): Promise<FerramentasUsuarioRecord[]> {
    try {
      const list = await pb
        .collection('ferramentas_usuarios')
        .getList<FerramentasUsuarioRecord>(1, 500, {
          sort: '-updated',
        })
      return list.items
    } catch (err) {
      console.warn('[ferramentasService] Falha ao listar habilitações:', err)
      return []
    }
  },

  async getByUser(userId: string): Promise<string[]> {
    try {
      const list = await pb
        .collection('ferramentas_usuarios')
        .getList<FerramentasUsuarioRecord>(1, 1, {
          filter: `user = "${userId}"`,
        })
      if (list.items.length > 0) {
        return list.items[0].ferramentas || []
      }
      // Sem registro = todas habilitadas (comportamento padrão de compatibilidade)
      return TODAS_FERRAMENTAS_IDS.slice() as unknown as string[]
    } catch (err) {
      console.warn('[ferramentasService] Falha ao buscar habilitações do usuário:', err)
      return TODAS_FERRAMENTAS_IDS.slice() as unknown as string[]
    }
  },

  async salvar(userId: string, ferramentas: string[]): Promise<FerramentasUsuarioRecord | null> {
    try {
      const existente = await pb
        .collection('ferramentas_usuarios')
        .getList<FerramentasUsuarioRecord>(1, 1, {
          filter: `user = "${userId}"`,
        })
      if (existente.items.length > 0) {
        return await pb
          .collection('ferramentas_usuarios')
          .update<FerramentasUsuarioRecord>(existente.items[0].id, { ferramentas })
      }
      return await pb.collection('ferramentas_usuarios').create<FerramentasUsuarioRecord>({
        user: userId,
        ferramentas,
      })
    } catch (err) {
      console.error('[ferramentasService] Erro ao salvar habilitações:', err)
      throw err
    }
  },

  /** Apenas para superadmins via hook backend (se necessário no futuro). */
  async excluir(userId: string): Promise<void> {
    const existente = await pb.collection('ferramentas_usuarios').getList(1, 1, {
      filter: `user = "${userId}"`,
    })
    if (existente.items.length > 0) {
      await pb.collection('ferramentas_usuarios').delete(existente.items[0].id)
    }
  },
}
