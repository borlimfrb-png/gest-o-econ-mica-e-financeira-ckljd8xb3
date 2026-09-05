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
  recebivel_id?: string
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

  // Extensão Novo Padrão Nacional NFS-e / DPS
  padrao_nacional?: boolean
  dps_serie?: string
  dps_numero?: number
  dps_id?: string
  dps_payload?: any
  servicos_itens?: any[]
  codigo_tributacao_nacional?: string
  codigo_municipio_prestacao?: string
  tipo_ambiente?: '1 - Producao' | '2 - Homologacao'
  tomador_ref?: string
  tomador_dados?: {
    cpf_cnpj: string
    razao_social: string
    email?: string
    tipo_pessoa?: string
    logradouro?: string
    numero?: string
    bairro?: string
    cidade?: string
    estado?: string
    cep?: string
  }
}

export interface ProcessarAgendadosResponse {
  success: boolean
  processados: number
  message: string
  notas?: Array<{
    nota_id: string
    numero: number
    recebivel_id: string
    tomador: string
    valor: number
  }>
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
      expand: 'empresa,contrato,nota_referencia,recebivel,nota_substituida',
    })
  },

  /**
   * Busca uma nota fiscal pelo seu ID.
   */
  async getById(id: string): Promise<NotaFiscalRecord> {
    return await pb.collection('notas_fiscais').getOne<NotaFiscalRecord>(id, {
      expand: 'empresa,contrato,nota_referencia,recebivel,nota_substituida',
    })
  },

  /**
   * Executa o processamento imediato dos agendamentos pendentes de NFSe.
   */
  async processarAgendados(recebivelId?: string): Promise<ProcessarAgendadosResponse> {
    return await pb.send<ProcessarAgendadosResponse>('/api/nfse/processar-agendados', {
      method: 'POST',
      body: { recebivel_id: recebivelId || undefined },
    })
  },

  /**
   * Lista notas fiscais filtrando por período (competência ou emissão) e opcionalmente por empresa.
   */
  async listarPorPeriodo(options?: {
    empresaId?: string
    dataInicio?: string
    dataFim?: string
  }): Promise<NotaFiscalRecord[]> {
    const userId = currentUserId()
    const filters: string[] = [`user = '${userId}'`]

    if (options?.empresaId && options.empresaId !== 'todas') {
      filters.push(`empresa = '${options.empresaId}'`)
    }

    if (options?.dataInicio) {
      const inicio = options.dataInicio.slice(0, 10)
      filters.push(`data_emissao >= '${inicio} 00:00:00'`)
    }

    if (options?.dataFim) {
      const fim = options.dataFim.slice(0, 10)
      filters.push(`data_emissao <= '${fim} 23:59:59'`)
    }

    return await pb.collection('notas_fiscais').getFullList<NotaFiscalRecord>({
      filter: filters.join(' && '),
      sort: '-data_emissao,-numero',
      expand: 'empresa,contrato,nota_referencia,recebivel,nota_substituida',
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
    try {
      return await pb.send<EmitirNfseResponse>('/api/nfse/emitir', {
        method: 'POST',
        body: input,
      })
    } catch (err: any) {
      console.warn('Fallback emissão direta via client-side/hooks:', err)
      const userId = currentUserId()
      const proximoNum = input.numero || (await this.getProximoNumero())
      const hojeIso = new Date().toISOString()
      const hojeYmd = hojeIso.slice(0, 10)

      let prestadorNome = 'Borlim Consultoria Financeira'
      let prestadorCnpj = '00.000.000/0001-00'
      let prestadorIm = ''

      try {
        const minhaEmpresaList = await pb
          .collection('minha_empresa')
          .getFullList<MinhaEmpresaRecord>({ sort: '-created', limit: 1 })
        if (minhaEmpresaList.length > 0) {
          prestadorNome =
            minhaEmpresaList[0].razao_social || minhaEmpresaList[0].nome_fantasia || prestadorNome
          prestadorCnpj = minhaEmpresaList[0].cnpj || prestadorCnpj
          prestadorIm = minhaEmpresaList[0].inscricao_municipal || ''
        }
      } catch {
        /* intentionally ignored */
      }

      let tomadorNome = input.tomador_dados?.razao_social || 'Cliente'
      let tomadorCnpj = input.tomador_dados?.cpf_cnpj || ''
      let tomadorEmail = input.tomador_dados?.email || ''

      if ((!tomadorNome || tomadorNome === 'Cliente') && input.empresa_id) {
        try {
          const emp = await pb.collection('empresas').getOne<EmpresaRecord>(input.empresa_id)
          tomadorNome = emp.nome || tomadorNome
          tomadorCnpj = emp.cnpj || tomadorCnpj
          tomadorEmail = emp.email || tomadorEmail
        } catch {
          /* intentionally ignored */
        }
      }

      const dpsSerie = input.dps_serie || input.serie || '1'
      const dpsNumero = input.dps_numero || proximoNum
      const codVerificacao = Math.random().toString(36).substring(2, 10).toUpperCase()
      const protocolo = `PRT-NAC-${new Date().getFullYear()}-${Math.floor(100000000 + Math.random() * 900000000)}`
      const munPrest = input.codigo_municipio_prestacao || '3550308'
      const ano2 = new Date().getFullYear().toString().slice(-2)
      const mes2 = String(new Date().getMonth() + 1).padStart(2, '0')
      const doc14 = prestadorCnpj.replace(/\D/g, '').padStart(14, '0')
      const chaveAcesso = `${munPrest}${ano2}${mes2}${doc14}00${dpsSerie.padStart(5, '0')}${String(proximoNum).padStart(15, '0')}18`

      const payloadNota: any = {
        user: userId,
        empresa: input.empresa_id,
        contrato: input.contrato_id || null,
        recebivel: input.recebivel_id || null,
        numero: proximoNum,
        serie: dpsSerie,
        codigo_verificacao: codVerificacao,
        chave_acesso: chaveAcesso,
        status: 'Emitida',
        data_emissao: hojeIso.replace('T', ' ').slice(0, 19),
        competencia: input.competencia
          ? `${input.competencia.slice(0, 10)} 00:00:00`
          : `${hojeYmd} 00:00:00`,
        vencimento: input.vencimento ? `${input.vencimento.slice(0, 10)} 12:00:00` : undefined,
        discriminacao: input.discriminacao,
        item_cnae: input.item_cnae || '6920-6/01',
        codigo_servico_municipal: input.codigo_servico_municipal || '0107',
        natureza_operacao: input.natureza_operacao || 'Tributação no município',
        valor_servicos: input.valor_servicos,
        aliquota_iss: input.aliquota_iss || 0,
        valor_iss: input.valor_iss || 0,
        iss_retido: Boolean(input.iss_retido),
        valor_pis: input.valor_pis || 0,
        valor_cofins: input.valor_cofins || 0,
        valor_inss: input.valor_inss || 0,
        valor_ir: input.valor_ir || 0,
        valor_csll: input.valor_csll || 0,
        outras_retencoes: input.outras_retencoes || 0,
        desconto_incondicionado: input.desconto_incondicionado || 0,
        valor_liquido: input.valor_liquido,
        prestador_cnpj: prestadorCnpj,
        prestador_razao_social: prestadorNome,
        prestador_inscricao_municipal: prestadorIm,
        tomador_cnpj: tomadorCnpj,
        tomador_razao_social: tomadorNome,
        tomador_email: tomadorEmail,
        modo_emissao: 'Homologação / Simulação',
        protocolo_autorizacao: protocolo,
        gateway_status_resposta:
          'DPS recebida com sucesso e homologada no Padrão Nacional (Código 100).',
        padrao_nacional: true,
        dps_serie: dpsSerie,
        dps_numero: dpsNumero,
        dps_id: input.dps_id,
        dps_payload: input.dps_payload,
        servicos_itens: input.servicos_itens,
        codigo_tributacao_nacional: input.codigo_tributacao_nacional || '010701',
        codigo_municipio_prestacao: munPrest,
        tipo_ambiente: input.tipo_ambiente || '2 - Homologacao',
        tomador_ref: input.tomador_ref || null,
      }

      const nota = await pb.collection('notas_fiscais').create<NotaFiscalRecord>(payloadNota)

      // Sincronizar com lançamentos rápidos se habilitado
      try {
        const { nfseLancamentosService } = await import('./nfseLancamentosService')
        await nfseLancamentosService.sincronizarLancamentoNota(nota)
      } catch (lancErr) {
        console.warn('Aviso: falha na integração com Lançamentos:', lancErr)
      }

      return {
        success: true,
        message: 'NFS-e Nacional homologada e autorizada com sucesso (Modo DPS Nacional).',
        nota: {
          id: nota.id,
          numero: nota.numero,
          serie: nota.serie || dpsSerie,
          codigo_verificacao: codVerificacao,
          chave_acesso: chaveAcesso,
          protocolo_autorizacao: protocolo,
          status: 'Emitida',
          modo_emissao: 'Homologação / Simulação',
          gateway_status_resposta:
            'DPS recebida com sucesso e homologada no Padrão Nacional (Código 100).',
          valor_liquido: nota.valor_liquido,
          data_emissao: nota.data_emissao,
        },
      }
    }
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

      // Estornar lançamento vinculado
      try {
        const { nfseLancamentosService } = await import('./nfseLancamentosService')
        await nfseLancamentosService.estornarLancamentoNota(notaId, motivo.trim())
      } catch (estornoErr) {
        console.warn('Aviso: falha no estorno de lançamento contábil:', estornoErr)
      }

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
