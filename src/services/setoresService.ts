import pb from '@/lib/pocketbase/client'
import type { SetorRecord, FaixasIndicadoresSetor } from '@/types/finance'
import { auditoriaCadastrosService } from './auditoriaCadastrosService'

export interface SalvarSetorInput {
  id?: string
  nome: string
  descricao?: string
  ativo?: boolean
  ordem?: number
  padrao_sistema?: boolean
  ev_ebitda: number
  pl: number
  pvp: number
  ev_receita: number
  ev_ebit: number
  p_ebitda: number
  faixas_indicadores?: FaixasIndicadoresSetor | null
}

export const setoresService = {
  /**
   * Lista todos os setores cadastrados ordenados por ordem e nome.
   */
  async getAll(): Promise<SetorRecord[]> {
    try {
      return await pb.collection('setores').getFullList<SetorRecord>({
        sort: 'ordem,nome',
        requestKey: null,
      })
    } catch (err) {
      console.error('[setoresService.getAll] Erro ao listar setores:', err)
      return []
    }
  },

  /**
   * Retorna apenas os setores ativos.
   */
  async getAtivos(): Promise<SetorRecord[]> {
    try {
      return await pb.collection('setores').getFullList<SetorRecord>({
        filter: 'ativo = true',
        sort: 'ordem,nome',
        requestKey: null,
      })
    } catch (err) {
      console.error('[setoresService.getAtivos] Erro ao listar setores ativos:', err)
      return []
    }
  },

  /**
   * Busca um setor por ID.
   */
  async getById(id: string): Promise<SetorRecord | null> {
    try {
      return await pb.collection('setores').getOne<SetorRecord>(id, {
        requestKey: null,
      })
    } catch (err) {
      console.warn(`[setoresService.getById] Setor não encontrado para id ${id}:`, err)
      return null
    }
  },

  /**
   * Busca um setor por nome (case-insensitive).
   */
  async getByNome(nome: string): Promise<SetorRecord | null> {
    if (!nome) return null
    try {
      const records = await pb.collection('setores').getList<SetorRecord>(1, 1, {
        filter: `nome ~ "${nome.trim()}"`,
        requestKey: null,
      })
      const found = records.items.find(
        (s) => s.nome.trim().toLowerCase() === nome.trim().toLowerCase(),
      )
      return found || null
    } catch (err) {
      console.warn(`[setoresService.getByNome] Erro ao buscar setor por nome "${nome}":`, err)
      return null
    }
  },

  /**
   * Cria ou atualiza um setor.
   */
  async save(input: SalvarSetorInput): Promise<SetorRecord> {
    const isEdicao = !!input.id
    const payload = {
      nome: input.nome.trim(),
      descricao: input.descricao?.trim() || '',
      ativo: input.ativo !== undefined ? input.ativo : true,
      ordem: typeof input.ordem === 'number' && !isNaN(input.ordem) ? input.ordem : 99,
      padrao_sistema: input.padrao_sistema ?? false,
      ev_ebitda: Number(input.ev_ebitda) || 0,
      pl: Number(input.pl) || 0,
      pvp: Number(input.pvp) || 0,
      ev_receita: Number(input.ev_receita) || 0,
      ev_ebit: Number(input.ev_ebit) || 0,
      p_ebitda: Number(input.p_ebitda) || 0,
      faixas_indicadores: input.faixas_indicadores || {},
    }

    if (isEdicao && input.id) {
      const anterior = await this.getById(input.id)
      const record = await pb.collection('setores').update<SetorRecord>(input.id, payload)

      // Auditoria de cadastro
      await auditoriaCadastrosService.registrar({
        entidade: 'setores',
        registro_id: record.id,
        registro_descricao: record.nome,
        acao: 'edicao',
        detalhes: {
          dados_anteriores: anterior || {},
          dados_novos: record,
        },
      })

      return record
    } else {
      const record = await pb.collection('setores').create<SetorRecord>(payload)

      // Auditoria de cadastro
      await auditoriaCadastrosService.registrar({
        entidade: 'setores',
        registro_id: record.id,
        registro_descricao: record.nome,
        acao: 'criacao',
        detalhes: {
          dados_novos: record,
        },
      })

      return record
    }
  },

  /**
   * Alterna estado ativo/inativo.
   */
  async toggleAtivo(id: string, ativoAtual: boolean): Promise<SetorRecord> {
    const record = await pb.collection('setores').update<SetorRecord>(id, {
      ativo: !ativoAtual,
    })

    await auditoriaCadastrosService.registrar({
      entidade: 'setores',
      registro_id: record.id,
      registro_descricao: `${record.nome} (${!ativoAtual ? 'Ativado' : 'Inativado'})`,
      acao: 'edicao',
      detalhes: {
        campos_alterados: {
          ativo: { antes: ativoAtual, depois: !ativoAtual },
        },
      },
    })

    return record
  },

  /**
   * Verifica se o setor está em uso por alguma empresa cadastrada.
   */
  async verificarUso(nomeSetor: string): Promise<{ emUso: boolean; totalEmpresas: number }> {
    if (!nomeSetor) return { emUso: false, totalEmpresas: 0 }
    try {
      const empresas = await pb.collection('empresas').getFullList({
        filter: `setor = "${nomeSetor.trim()}"`,
        fields: 'id,nome',
        requestKey: null,
      })
      return {
        emUso: empresas.length > 0,
        totalEmpresas: empresas.length,
      }
    } catch (err) {
      console.warn('[setoresService.verificarUso] Erro ao checar empresas com o setor:', err)
      return { emUso: false, totalEmpresas: 0 }
    }
  },

  /**
   * Exclui um setor se não estiver em uso por empresas.
   */
  async delete(id: string): Promise<boolean> {
    const setor = await this.getById(id)
    if (!setor) return false

    // Verificar se alguma empresa usa esse setor
    const { emUso, totalEmpresas } = await this.verificarUso(setor.nome)
    if (emUso) {
      throw new Error(
        `Não é possível excluir o setor "${setor.nome}" porque ele está associado a ${totalEmpresas} empresa(s). Reatribua as empresas antes de excluir ou inative o setor.`,
      )
    }

    await pb.collection('setores').delete(id)

    // Auditoria de exclusão
    await auditoriaCadastrosService.registrar({
      entidade: 'setores',
      registro_id: id,
      registro_descricao: setor.nome,
      acao: 'exclusao',
      detalhes: {
        dados_anteriores: setor,
      },
    })

    return true
  },
}
