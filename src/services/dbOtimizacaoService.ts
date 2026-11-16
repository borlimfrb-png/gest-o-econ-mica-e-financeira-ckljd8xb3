/**
 * Serviço de frontend para a ferramenta de otimização do banco de dados
 * (tela /admin/otimizacao). Chama os hooks backend admin-only:
 *  - GET  /backend/v1/admin/db-diagnostico
 *  - POST /backend/v1/admin/db-otimizar
 */
import pb from '@/lib/pocketbase/client'

export interface RecomendacaoIndice {
  indice: string
  campos: string
  rotulo: string
  sql: string
}

export interface ColecaoDiagnostico {
  colecao: string
  registros: number
  indices: string[]
  recomendacoes: RecomendacaoIndice[]
  indices_recomendados_presentes: string[]
}

export interface DiagnosticoStatus {
  colecoes_analisadas: number
  registros_totais: number
  indices_recomendados_presentes: number
  indices_pendentes: number
}

export interface Diagnostico {
  sucesso: boolean
  status: DiagnosticoStatus
  colecoes: ColecaoDiagnostico[]
}

export interface ResultadoOtimizacao {
  sucesso: boolean
  aplicados: string[]
  falhas: { indice: string; motivo: string }[]
  antes: DiagnosticoStatus
  depois: DiagnosticoStatus
  diagnostico: { status: DiagnosticoStatus; colecoes: ColecaoDiagnostico[] }
}

export const dbOtimizacaoService = {
  /** Diagnóstico: contagens, índices existentes e recomendações pendentes. */
  async diagnosticar(): Promise<Diagnostico> {
    const res = await pb.send<Diagnostico & { erro?: string }>('/backend/v1/admin/db-diagnostico', {
      method: 'GET',
    })
    if (!res || !res.sucesso) {
      throw new Error(res?.erro || 'Não foi possível analisar o banco de dados.')
    }
    return res
  },

  /** Aplica os índices recomendados que faltam (idempotente no backend). */
  async otimizar(): Promise<ResultadoOtimizacao> {
    const res = await pb.send<ResultadoOtimizacao & { erro?: string }>(
      '/backend/v1/admin/db-otimizar',
      { method: 'POST' },
    )
    if (!res) {
      throw new Error('Não foi possível aplicar as otimizações.')
    }
    return res
  },
}
