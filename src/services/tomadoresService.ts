import pb from '@/lib/pocketbase/client'
import { NfseTomadorRecord } from '@/types/finance'
import { auditoriaCadastrosService } from './auditoriaCadastrosService'

export interface SalvarTomadorInput {
  empresa: string
  tipo_pessoa: 'PJ' | 'PF' | 'Exterior'
  cpf_cnpj: string
  razao_social: string
  nome_fantasia?: string
  inscricao_municipal?: string
  inscricao_estadual?: string
  email?: string
  telefone?: string
  cep?: string
  logradouro?: string
  numero?: string
  complemento?: string
  bairro?: string
  codigo_municipio?: string
  cidade?: string
  estado?: string
  observacoes?: string
  ativo?: boolean
}

export const tomadoresService = {
  async listar(empresaId?: string, apenasAtivos = true): Promise<NfseTomadorRecord[]> {
    try {
      const filters: string[] = []
      if (empresaId) {
        filters.push(`empresa = '${empresaId}'`)
      }
      if (apenasAtivos) {
        filters.push('ativo = true')
      }

      const res = await pb.collection('nfse_tomadores').getFullList<NfseTomadorRecord>({
        filter: filters.length > 0 ? filters.join(' && ') : undefined,
        sort: 'razao_social',
      })
      return res
    } catch (err) {
      console.warn('Erro ao listar tomadores da coleção:', err)
      return []
    }
  },

  async buscarPorId(id: string): Promise<NfseTomadorRecord | null> {
    try {
      return await pb.collection('nfse_tomadores').getOne<NfseTomadorRecord>(id)
    } catch {
      return null
    }
  },

  async criar(
    input: SalvarTomadorInput,
    userId?: string,
    userName?: string,
  ): Promise<NfseTomadorRecord> {
    const payload = {
      ...input,
      user: userId,
      ativo: input.ativo !== undefined ? input.ativo : true,
    }

    const record = await pb.collection('nfse_tomadores').create<NfseTomadorRecord>(payload)

    // Auditoria
    try {
      await auditoriaCadastrosService.registrar({
        empresa: input.empresa,
        entidade: 'nfse_tomadores',
        registro_id: record.id,
        registro_descricao: `Tomador cadastrado: ${record.razao_social} (${record.cpf_cnpj})`,
        acao: 'criacao',
        detalhes: {
          dados_novos: record as any,
        },
      })
    } catch (err) {
      console.warn('Falha ao auditar criação de tomador:', err)
    }

    return record
  },

  async atualizar(
    id: string,
    input: Partial<SalvarTomadorInput>,
    userId?: string,
    userName?: string,
  ): Promise<NfseTomadorRecord> {
    let antes: NfseTomadorRecord | null = null
    try {
      antes = await pb.collection('nfse_tomadores').getOne<NfseTomadorRecord>(id)
    } catch {
      /* intentionally ignored */
    }

    const record = await pb.collection('nfse_tomadores').update<NfseTomadorRecord>(id, input)

    // Auditoria
    try {
      await auditoriaCadastrosService.registrar({
        empresa: record.empresa || input.empresa,
        entidade: 'nfse_tomadores',
        registro_id: record.id,
        registro_descricao: `Tomador atualizado: ${record.razao_social}`,
        acao: 'edicao',
        detalhes: {
          dados_anteriores: (antes as any) || undefined,
          dados_novos: record as any,
        },
      })
    } catch (err) {
      console.warn('Falha ao auditar atualização de tomador:', err)
    }

    return record
  },

  async excluir(
    id: string,
    empresaId?: string,
    userId?: string,
    userName?: string,
  ): Promise<boolean> {
    let antes: NfseTomadorRecord | null = null
    try {
      antes = await pb.collection('nfse_tomadores').getOne<NfseTomadorRecord>(id)
    } catch {
      /* intentionally ignored */
    }

    await pb.collection('nfse_tomadores').delete(id)

    // Auditoria
    try {
      await auditoriaCadastrosService.registrar({
        empresa: empresaId || antes?.empresa,
        entidade: 'nfse_tomadores',
        registro_id: id,
        registro_descricao: `Tomador removido: ${antes?.razao_social || id}`,
        acao: 'exclusao',
        detalhes: {
          dados_anteriores: (antes as any) || undefined,
        },
      })
    } catch (err) {
      console.warn('Falha ao auditar exclusão de tomador:', err)
    }

    return true
  },
}
