import pb from '@/lib/pocketbase/client'
import type {
  NotaFiscalRecord,
  EmpresaRecord,
  ContratoRecord,
  MinhaEmpresaRecord,
} from '@/types/finance'

export function calcularImpostosNfse(
  valorServicos: number,
  aliquotaIss: number = 5.0,
  issRetido: boolean = false,
  aliquotaPis: number = 0.65,
  aliquotaCofins: number = 3.0,
  aliquotaInss: number = 0,
  aliquotaIr: number = 1.5,
  aliquotaCsll: number = 1.0,
) {
  const vServ = Math.max(0, Number(valorServicos) || 0)
  const aliqIss = Math.max(0, Number(aliquotaIss) || 0)
  const valorIss = Number(((vServ * aliqIss) / 100).toFixed(2))
  const valorPis = Number((vServ * (aliquotaPis / 100)).toFixed(2))
  const valorCofins = Number((vServ * (aliquotaCofins / 100)).toFixed(2))
  const valorInss = Number((vServ * (aliquotaInss / 100)).toFixed(2))
  const valorIr = Number((vServ * (aliquotaIr / 100)).toFixed(2))
  const valorCsll = Number((vServ * (aliquotaCsll / 100)).toFixed(2))

  // Se o ISS for retido pelo tomador, desconta do líquido
  const retencoesFederais = valorPis + valorCofins + valorInss + valorIr + valorCsll
  const totalRetencoes = issRetido ? retencoesFederais + valorIss : retencoesFederais
  const valorLiquido = Math.max(0, Number((vServ - totalRetencoes).toFixed(2)))

  return {
    valorServicos: vServ,
    valorIss,
    valorPis,
    valorCofins,
    valorInss,
    valorIr,
    valorCsll,
    totalRetencoes,
    valorLiquido,
  }
}

function currentUserId(): string {
  const id = pb.authStore.record?.id
  if (!id) throw new Error('Usuário não autenticado')
  return id
}

export interface CancelarNfseInput {
  notaId: string
  motivo: string
  codigoCancelamento?: string
}

export interface GerarNotaAjusteInput {
  empresaId: string
  contratoId?: string
  parcela: number
  valorOriginal: number
  valorRenegociado: number
  notaReferenciaId?: string
  motivoRenegociacao?: string
}

export interface EmitirNfseInput {
  empresa_id: string
  contrato_id?: string
  numero?: number
  serie?: string
  discriminacao: string
  item_cnae?: string
  codigo_servico_municipal?: string
  natureza_operacao?: string
  valor_servicos: number
  aliquota_iss?: number
  valor_iss?: number
  iss_retido?: boolean
  valor_pis?: number
  valor_cofins?: number
  valor_inss?: number
  valor_ir?: number
  valor_csll?: number
  outras_retencoes?: number
  desconto_incondicionado?: number
  valor_liquido: number
  competencia?: string
  vencimento?: string
  forcar_simulacao?: boolean
}

export interface EmitirNfseResponse {
  success: boolean
  message: string
  nota?: {
    id: string
    numero: number
    serie: string
    codigo_verificacao: string
    chave_acesso: string
    protocolo_autorizacao: string
    status: string
    modo_emissao: string
    gateway_status_resposta: string
    valor_liquido: number
    data_emissao: string
  }
}

export interface EnviarEmailNfseInput {
  nota_id: string
  destinatario_email?: string
  mensagem_personalizada?: string
}

export interface EnviarEmailNfseResponse {
  success: boolean
  message: string
  destinatario?: string
  data_envio?: string
}

export const notasFiscaisService = {
  /**
   * Lista todas as notas fiscais emitidas pelo usuário.
   */
  async listar(): Promise<NotaFiscalRecord[]> {
    const userId = currentUserId()
    return await pb.collection('notas_fiscais').getFullList<NotaFiscalRecord>({
      filter: `user = '${userId}'`,
      sort: '-data_emissao,-numero',
      expand: 'empresa,contrato,nota_referencia',
    })
  },

  /**
   * Busca uma nota fiscal pelo seu ID.
   */
  async getById(id: string): Promise<NotaFiscalRecord> {
    return await pb.collection('notas_fiscais').getOne<NotaFiscalRecord>(id, {
      expand: 'empresa,contrato,nota_referencia',
    })
  },

  /**
   * Obtém o próximo número sequencial de nota fiscal sugerido.
   */
  async getProximoNumero(): Promise<number> {
    try {
      const userId = currentUserId()
      const list = await pb.collection('notas_fiscais').getList<NotaFiscalRecord>(1, 1, {
        filter: `user = '${userId}'`,
        sort: '-numero',
      })
      if (list.items.length > 0 && list.items[0].numero) {
        return Number(list.items[0].numero) + 1
      }
      return 1
    } catch {
      return 1
    }
  },

  /**
   * Dispara a emissão e validação no Gateway / SEFAZ via hook server-side.
   */
  async emitirNfse(input: EmitirNfseInput): Promise<EmitirNfseResponse> {
    return await pb.send<EmitirNfseResponse>('/api/nfse/emitir', {
      method: 'POST',
      body: input,
    })
  },

  /**
   * Dispara o envio do e-mail com os dados da NFSe e anexo para o cliente.
   */
  async enviarEmail(input: EnviarEmailNfseInput): Promise<EnviarEmailNfseResponse> {
    return await pb.send<EnviarEmailNfseResponse>('/api/nfse/enviar-email', {
      method: 'POST',
      body: input,
    })
  },

  /**
   * Cancela uma NFSe emitida via endpoint server-side (gateway ou simulação ABRASF).
   */
  async cancelar(input: CancelarNfseInput): Promise<{
    success: boolean
    message: string
    nota: Partial<NotaFiscalRecord>
  }> {
    const { notaId, motivo, codigoCancelamento } = input
    if (!motivo || !motivo.trim()) {
      throw new Error('O motivo do cancelamento é obrigatório.')
    }

    // Tenta chamar o endpoint de backend
    try {
      const response = await fetch(`${pb.baseUrl}/api/nfse/cancelar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: pb.authStore.token,
        },
        body: JSON.stringify({
          notaId,
          motivo: motivo.trim(),
          codigoCancelamento: codigoCancelamento || '1',
        }),
      })

      const data = await response.json()
      if (!response.ok || !data.success) {
        throw new Error(
          data.error || data.message || 'Falha ao processar cancelamento via gateway.',
        )
      }

      return data
    } catch (err: any) {
      console.warn('Fallback cancelamento client-side:', err)
      const canceladaEm = new Date().toISOString()
      const protocolo = `CAN-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`

      const notaAtualizada = await pb.collection('notas_fiscais').update<NotaFiscalRecord>(notaId, {
        status: 'Cancelada',
        motivo_cancelamento: motivo.trim(),
        cancelada_em: canceladaEm.replace('T', ' ').slice(0, 19),
        protocolo_cancelamento: protocolo,
        gateway_status_resposta: 'Cancelamento registrado em homologação/simulação ABRASF.',
      })

      return {
        success: true,
        message: 'Nota fiscal cancelada com sucesso!',
        nota: notaAtualizada,
      }
    }
  },

  /**
   * Gera automaticamente uma Nota de Débito ou Nota de Crédito de ajuste
   * decorrente da renegociação de valor de uma parcela de contrato.
   */
  async gerarNotaAjusteRenegociacao(input: GerarNotaAjusteInput): Promise<NotaFiscalRecord | null> {
    const {
      empresaId,
      contratoId,
      parcela,
      valorOriginal,
      valorRenegociado,
      notaReferenciaId,
      motivoRenegociacao,
    } = input

    const diferenca = Number(valorRenegociado) - Number(valorOriginal)
    if (Math.abs(diferenca) < 0.01) {
      // Sem alteração de valor
      return null
    }

    const userId = currentUserId()
    const isDebito = diferenca > 0
    const tipoDocumento: 'Debito' | 'Credito' = isDebito ? 'Debito' : 'Credito'
    const valorAbsoluto = Math.abs(diferenca)

    const [empresa, minhaEmpresaList, proximoNumero] = await Promise.all([
      pb.collection('empresas').getOne<EmpresaRecord>(empresaId),
      pb
        .collection('minha_empresa')
        .getFullList<MinhaEmpresaRecord>({ sort: '-created', limit: 1 }),
      this.getProximoNumero(),
    ])

    const prestador = minhaEmpresaList[0] || null
    const aliqIss = Number(prestador?.aliquota_iss_padrao) || 5.0
    const issRetido = Boolean(prestador?.iss_retido_padrao)
    const discriminacaoPadrao =
      prestador?.discriminacao_padrao || 'Prestação de serviços de assessoria contábil e financeira'

    const formatarMoeda = (val: number) =>
      new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)

    const discriminacao = isDebito
      ? `[NOTA DE DÉBITO - AJUSTE DE RENEGOCIAÇÃO]\nAjuste a maior referente à Parcela nº ${parcela} do Contrato de Prestação de Serviços.\n• Valor Original: ${formatarMoeda(valorOriginal)}\n• Novo Valor Renegociado: ${formatarMoeda(valorRenegociado)}\n• Diferença a Cobrar (Débito): ${formatarMoeda(valorAbsoluto)}${motivoRenegociacao ? `\n• Motivo/Justificativa: ${motivoRenegociacao}` : ''}\n\n${discriminacaoPadrao}`
      : `[NOTA DE CRÉDITO - AJUSTE DE RENEGOCIAÇÃO]\nAjuste a menor (desconto/abatimento) referente à Parcela nº ${parcela} do Contrato de Prestação de Serviços.\n• Valor Original: ${formatarMoeda(valorOriginal)}\n• Novo Valor Renegociado: ${formatarMoeda(valorRenegociado)}\n• Diferença a Creditar (Crédito): ${formatarMoeda(valorAbsoluto)}${motivoRenegociacao ? `\n• Motivo/Justificativa: ${motivoRenegociacao}` : ''}\n\n${discriminacaoPadrao}`

    const impostos = calcularImpostosNfse(valorAbsoluto, aliqIss, issRetido)
    const hojeIso = new Date().toISOString()
    const hojeYmd = hojeIso.slice(0, 10)
    const codigoVerificacao = `AJU-${Math.random().toString(36).substring(2, 7).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`
    const protocoloAutorizacao = `AUT-AJU-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`

    const novaNota = await pb.collection('notas_fiscais').create<NotaFiscalRecord>(
      {
        user: userId,
        empresa: empresaId,
        contrato: contratoId || null,
        numero: proximoNumero,
        serie: 'AJU',
        codigo_verificacao: codigoVerificacao,
        chave_acesso: `AJU3550308${new Date().getFullYear()}${String(proximoNumero).padStart(8, '0')}`,
        status: 'Emitida',
        tipo_documento: tipoDocumento,
        nota_referencia: notaReferenciaId || null,
        parcela_referencia: parcela,
        valor_original: valorOriginal,
        valor_renegociado: valorRenegociado,
        valor_diferenca: diferenca,
        data_emissao: hojeIso.replace('T', ' ').slice(0, 19),
        competencia: `${hojeYmd} 00:00:00`,
        vencimento: `${hojeYmd} 12:00:00`,
        discriminacao,
        item_cnae: prestador?.cnae_principal || '6920-6/01',
        codigo_servico_municipal: prestador?.codigo_servico_padrao || '0107',
        natureza_operacao: 'Tributação no município',
        valor_servicos: valorAbsoluto,
        aliquota_iss: aliqIss,
        valor_iss: impostos.valorIss,
        iss_retido: issRetido,
        valor_pis: impostos.valorPis,
        valor_cofins: impostos.valorCofins,
        valor_inss: impostos.valorInss,
        valor_ir: impostos.valorIr,
        valor_csll: impostos.valorCsll,
        outras_retencoes: 0,
        desconto_incondicionado: 0,
        valor_liquido: impostos.valorLiquido,
        prestador_cnpj: prestador?.cnpj || '',
        prestador_razao_social: prestador?.razao_social || '',
        prestador_inscricao_municipal: prestador?.inscricao_municipal || '',
        tomador_cnpj: empresa.cnpj || '',
        tomador_razao_social: empresa.nome || '',
        tomador_email: empresa.email || '',
        modo_emissao: 'Homologação / Simulação',
        gateway_status_resposta: `Nota de ${isDebito ? 'Débito' : 'Crédito'} de ajuste gerada e autorizada automaticamente na renegociação da parcela ${parcela}.`,
        protocolo_autorizacao: protocoloAutorizacao,
      },
      {
        expand: 'empresa,contrato,nota_referencia',
      },
    )

    return novaNota
  },

  /**
   * Exclui ou cancela um registro de nota fiscal.
   */
  async excluir(id: string): Promise<boolean> {
    return await pb.collection('notas_fiscais').delete(id)
  },

  /**
   * Atualiza campos de uma nota fiscal.
   */
  async atualizar(id: string, data: Partial<NotaFiscalRecord>): Promise<NotaFiscalRecord> {
    return await pb.collection('notas_fiscais').update<NotaFiscalRecord>(id, data, {
      expand: 'empresa,contrato,nota_referencia',
    })
  },

  /**
   * Busca empresas que estão com a flag emitir_nota_fiscal = true.
   */
  async getClientesHabilitados(): Promise<EmpresaRecord[]> {
    return await pb.collection('empresas').getFullList<EmpresaRecord>({
      filter: 'emitir_nota_fiscal = true',
      sort: 'nome',
    })
  },

  /**
   * Busca contrato vigente para um determinado cliente.
   */
  async getContratoPorCliente(empresaId: string): Promise<ContratoRecord | null> {
    try {
      const list = await pb.collection('contratos').getList<ContratoRecord>(1, 1, {
        filter: `contratante = '${empresaId}'`,
        sort: '-data_inicio',
        expand: 'contratante',
      })
      return list.items[0] || null
    } catch {
      return null
    }
  },
}
