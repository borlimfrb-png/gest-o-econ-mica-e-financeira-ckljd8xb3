import pb from '@/lib/pocketbase/client'

export interface DadosCertificadoA1 {
  id: string
  empresa_id: string
  nome_arquivo: string
  validade_inicio?: string | null
  validade_fim?: string | null
  titular_nome?: string | null
  titular_cnpj_cpf?: string | null
  emissor?: string | null
  status: 'ativo' | 'expirado' | 'revogado'
  estaExpirado: boolean
  diasRestantes?: number | null
  data_upload: string
  atualizado_em?: string
}

export interface StatusCertificadoResponse {
  success: boolean
  temCertificado: boolean
  dados: DadosCertificadoA1 | null
  mensagem?: string
}

export interface SalvarCertificadoInput {
  empresa_id: string
  nome_arquivo: string
  arquivo_base64: string
  senha: string
  metadados?: {
    validade_inicio?: string
    validade_fim?: string
    titular_nome?: string
    titular_cnpj_cpf?: string
    emissor?: string
  }
}

/**
 * Tenta inspecionar de forma segura os bytes ASN.1 de um pacote PKCS#12 (.pfx/.p12)
 * para detectar a data de expiração (UTCTime / GeneralizedTime) sem expor a chave privada.
 * Retorna string ISO da data caso encontrada, ou data padrão de 1 ano.
 */
export function extrairValidadePfxLocal(bytes: Uint8Array): {
  validadeFim?: string
  validadeInicio?: string
} {
  try {
    // Procura por sequências ASN.1 de UTCTime (tag 0x17) ou GeneralizedTime (tag 0x18)
    const datasEncontradas: Date[] = []

    for (let i = 0; i < bytes.length - 15; i++) {
      const tag = bytes[i]
      const len = bytes[i + 1]

      // UTCTime: YYMMDDHHMMSSZ (len 13)
      if (tag === 0x17 && (len === 13 || len === 15)) {
        let str = ''
        for (let j = 0; j < len; j++) {
          const charCode = bytes[i + 2 + j]
          if (charCode >= 32 && charCode <= 126) {
            str += String.fromCharCode(charCode)
          }
        }
        if (/^\d{12}Z$/i.test(str)) {
          const yy = parseInt(str.slice(0, 2), 10)
          const year = yy >= 50 ? 1900 + yy : 2000 + yy
          const month = parseInt(str.slice(2, 4), 10) - 1
          const day = parseInt(str.slice(4, 6), 10)
          const hour = parseInt(str.slice(6, 8), 10)
          const minute = parseInt(str.slice(8, 10), 10)
          const d = new Date(Date.UTC(year, month, day, hour, minute))
          if (!isNaN(d.getTime()) && year >= 2020 && year <= 2045) {
            datasEncontradas.push(d)
          }
        }
      }

      // GeneralizedTime: YYYYMMDDHHMMSSZ (len 15)
      if (tag === 0x18 && (len === 15 || len === 17)) {
        let str = ''
        for (let j = 0; j < len; j++) {
          const charCode = bytes[i + 2 + j]
          if (charCode >= 32 && charCode <= 126) {
            str += String.fromCharCode(charCode)
          }
        }
        if (/^\d{14}Z$/i.test(str)) {
          const year = parseInt(str.slice(0, 4), 10)
          const month = parseInt(str.slice(4, 6), 10) - 1
          const day = parseInt(str.slice(6, 8), 10)
          const hour = parseInt(str.slice(8, 10), 10)
          const minute = parseInt(str.slice(10, 12), 10)
          const d = new Date(Date.UTC(year, month, day, hour, minute))
          if (!isNaN(d.getTime()) && year >= 2020 && year <= 2045) {
            datasEncontradas.push(d)
          }
        }
      }
    }

    if (datasEncontradas.length > 0) {
      // Ordena: a data mais tardia normalmente é notAfter (validade final do certificado A1)
      datasEncontradas.sort((a, b) => a.getTime() - b.getTime())
      const validadeFim = datasEncontradas[datasEncontradas.length - 1].toISOString()
      const validadeInicio = datasEncontradas[0].toISOString()
      return { validadeFim, validadeInicio }
    }
  } catch (err) {
    console.warn('Não foi possível extrair metadados ASN.1 diretamente do PFX:', err)
  }

  // Se não encontrar estrutura simples de data, projeta 1 ano padrão da ICP-Brasil
  const dtFim = new Date()
  dtFim.setFullYear(dtFim.getFullYear() + 1)
  return {
    validadeFim: dtFim.toISOString(),
    validadeInicio: new Date().toISOString(),
  }
}

export const certificadoA1Service = {
  /**
   * Consulta o status do certificado da empresa (exclusivo para perfil Admin)
   */
  async obterStatusCertificado(empresaId: string): Promise<StatusCertificadoResponse> {
    if (!empresaId) {
      return {
        success: false,
        temCertificado: false,
        dados: null,
        mensagem: 'Nenhuma empresa selecionada.',
      }
    }

    try {
      const response = await pb.send<StatusCertificadoResponse>(
        `/backend/v1/nfse/certificado?empresa_id=${encodeURIComponent(empresaId)}`,
        {
          method: 'GET',
        },
      )
      return response
    } catch (err: any) {
      // Se for 403 (não é admin) ou erro de conexão
      if (err?.status === 403) {
        return {
          success: false,
          temCertificado: false,
          dados: null,
          mensagem: 'Apenas administradores podem visualizar os dados do Certificado Digital.',
        }
      }
      return {
        success: false,
        temCertificado: false,
        dados: null,
        mensagem: err?.message || 'Falha ao consultar certificado digital.',
      }
    }
  },

  /**
   * Salva o certificado digital A1 (.pfx/.p12) e a senha com segurança no backend
   */
  async salvarCertificado(input: SalvarCertificadoInput): Promise<{
    success: boolean
    message: string
    dados?: any
  }> {
    try {
      const response = await pb.send<{
        success: boolean
        message: string
        dados?: any
      }>('/backend/v1/nfse/certificado', {
        method: 'POST',
        body: input,
      })
      return response
    } catch (err: any) {
      const msg = err?.data?.message || err?.message || 'Erro ao salvar certificado digital.'
      throw new Error(msg)
    }
  },

  /**
   * Remove o certificado digital cadastrado para a empresa
   */
  async removerCertificado(empresaId: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await pb.send<{ success: boolean; message: string }>(
        `/backend/v1/nfse/certificado?empresa_id=${encodeURIComponent(empresaId)}`,
        {
          method: 'DELETE',
        },
      )
      return response
    } catch (err: any) {
      const msg = err?.data?.message || err?.message || 'Erro ao remover certificado digital.'
      throw new Error(msg)
    }
  },
}
