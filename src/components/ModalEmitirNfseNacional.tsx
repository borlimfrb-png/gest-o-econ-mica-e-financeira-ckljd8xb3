import React, { useState, useEffect, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Plus,
  Trash2,
  Calculator,
  Send,
  Loader2,
  FileCheck2,
  Building2,
  AlertCircle,
  ShieldCheck,
  MapPin,
  ExternalLink,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/contexts/AuthContext'
import { useMinhaEmpresa } from '@/contexts/MinhaEmpresaContext'
import { EmpresaRecord, ItemServicoNfse, NotaFiscalRecord } from '@/types/finance'
import { notasFiscaisService, EmitirNfseInput } from '@/services/notasFiscaisService'
import { servicoTransmissaoNfse } from '@/services/transmissaoNfseService'
import {
  gerarPayloadDpsNacional,
  validarDpsNacionalLocal,
  GerarDpsNacionalOptions,
} from '@/lib/nfseNacionalDps'
import { formatBrlMoeda } from '@/lib/nfseXmlGenerator'

interface ModalEmitirNfseNacionalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  empresaAtiva: EmpresaRecord | null
  empresasLista: EmpresaRecord[]
  seriePadrao: string
  proximoNumeroPadrao: number
  onEmitida: (notaCriada?: NotaFiscalRecord) => void
  onAbrirConfiguracao?: () => void
  // Modo de reemissão corrigida
  notaParaSubstituir?: NotaFiscalRecord | null
}

export function ModalEmitirNfseNacional({
  open,
  onOpenChange,
  empresaAtiva,
  empresasLista,
  seriePadrao,
  proximoNumeroPadrao,
  onEmitida,
  onAbrirConfiguracao,
  notaParaSubstituir,
}: ModalEmitirNfseNacionalProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const { minhaEmpresa } = useMinhaEmpresa()

  // Controle de estados
  const [loading, setLoading] = useState(false)

  // TOMADOR = Empresa Cliente selecionada da coleção "empresas"
  const [empresaClienteId, setEmpresaClienteId] = useState<string>('')

  // DPS Cabeçalho
  const [serie, setSerie] = useState<string>(seriePadrao || '1')
  const [numeroDps, setNumeroDps] = useState<number>(proximoNumeroPadrao || 1)
  const [competencia, setCompetencia] = useState<string>(new Date().toISOString().slice(0, 10))
  const [codigoTributacao, setCodigoTributacao] = useState<string>('010701') // Suporte técnico/consultoria LC 116
  const [municipioPrestacao, setMunicipioPrestacao] = useState<string>('3550308') // Fallback inicial SP

  // Campo obrigatório para substituição
  const [justificativaCorrecao, setJustificativaCorrecao] = useState<string>('')

  // Itens de Serviço
  const [itens, setItens] = useState<ItemServicoNfse[]>([
    {
      item: 1,
      descricao: 'Serviços de Consultoria Financeira e Análise de Balanço',
      quantidade: 1,
      valor_unitario: 2500,
      valor_total: 2500,
      codigo_tributacao_nacional: '010701',
      desconto: 0,
    },
  ])

  // Tributação e Retenções
  const [aliquotaIss, setAliquotaIss] = useState<number>(5.0)
  const [issRetido, setIssRetido] = useState<boolean>(false)
  const [aliquotaPis, setAliquotaPis] = useState<number>(0.65)
  const [aliquotaCofins, setAliquotaCofins] = useState<number>(3.0)
  const [aliquotaInss, setAliquotaInss] = useState<number>(0)
  const [aliquotaIr, setAliquotaIr] = useState<number>(1.5)
  const [aliquotaCsll, setAliquotaCsll] = useState<number>(1.0)
  const [outrasRetencoes, setOutrasRetencoes] = useState<number>(0)
  const [descontoIncondicionado, setDescontoIncondicionado] = useState<number>(0)

  // Lista de empresas clientes disponíveis para seleção como tomador
  const clientesDisponiveis = useMemo(() => {
    return (empresasLista || []).slice().sort((a, b) => (a.nome || '').localeCompare(b.nome || ''))
  }, [empresasLista])

  // Empresa Tomadora selecionada atualmente
  const tomadorEmpresa = useMemo(() => {
    return clientesDisponiveis.find((e) => e.id === empresaClienteId) || null
  }, [clientesDisponiveis, empresaClienteId])

  // Validação de dados obrigatórios do cadastro do Tomador (Empresa Cliente)
  const validacaoTomador = useMemo(() => {
    if (!tomadorEmpresa) {
      return {
        valido: false,
        faltando: ['Selecione a empresa cliente tomadora dos serviços'],
      }
    }

    const faltando: string[] = []
    const cnpjLimpo = (tomadorEmpresa.cnpj || '').replace(/\D/g, '')

    if (!tomadorEmpresa.nome?.trim()) {
      faltando.push('Razão Social / Nome da empresa')
    }
    if (!cnpjLimpo || (cnpjLimpo.length !== 14 && cnpjLimpo.length !== 11)) {
      faltando.push('CNPJ válido (14 dígitos) ou CPF (11 dígitos)')
    }
    if (!tomadorEmpresa.logradouro?.trim()) {
      faltando.push('Logradouro / Endereço (Rua/Avenida)')
    }
    if (!tomadorEmpresa.cidade?.trim()) {
      faltando.push('Cidade')
    }
    if (!tomadorEmpresa.estado?.trim()) {
      faltando.push('UF / Estado')
    }

    return {
      valido: faltando.length === 0,
      faltando,
    }
  }, [tomadorEmpresa])

  // Validação dos dados da Prestadora (Minha Empresa)
  const validacaoPrestadora = useMemo(() => {
    const faltando: string[] = []
    if (!minhaEmpresa) {
      faltando.push('Cadastro de Minha Empresa (abra Configurações para preencher)')
      return { valido: false, faltando }
    }
    const cnpjLimpo = (minhaEmpresa.cnpj || '').replace(/\D/g, '')
    if (!cnpjLimpo || cnpjLimpo.length !== 14) {
      faltando.push('CNPJ da Prestadora (14 dígitos)')
    }
    if (!minhaEmpresa.razao_social?.trim() && !minhaEmpresa.nome_fantasia?.trim()) {
      faltando.push('Razão Social da Prestadora')
    }
    return {
      valido: faltando.length === 0,
      faltando,
    }
  }, [minhaEmpresa])

  // Inicialização ao abrir modal
  useEffect(() => {
    if (open) {
      setSerie(seriePadrao || '1')
      setNumeroDps(proximoNumeroPadrao || 1)

      // Código de tributação nacional padrão de Minha Empresa
      if (minhaEmpresa?.codigo_tributacao_nacional) {
        setCodigoTributacao(minhaEmpresa.codigo_tributacao_nacional)
      } else {
        setCodigoTributacao('010701')
      }

      // Se Minha Empresa possui Código IBGE cadastrado, inicializa o município de prestação com ele
      const ibgeMinhaEmpresa = (minhaEmpresa?.codigo_ibge || '').replace(/\D/g, '')
      if (ibgeMinhaEmpresa.length === 7 && !notaParaSubstituir) {
        setMunicipioPrestacao(ibgeMinhaEmpresa)
      }

      if (notaParaSubstituir) {
        // Pré-preencher com dados da nota original
        setJustificativaCorrecao('')
        if (notaParaSubstituir.empresa) {
          setEmpresaClienteId(notaParaSubstituir.empresa)
        }
        if (notaParaSubstituir.competencia) {
          setCompetencia(notaParaSubstituir.competencia.slice(0, 10))
        }
        if (notaParaSubstituir.codigo_tributacao_nacional) {
          setCodigoTributacao(notaParaSubstituir.codigo_tributacao_nacional)
        }
        if (notaParaSubstituir.codigo_municipio_prestacao) {
          setMunicipioPrestacao(notaParaSubstituir.codigo_municipio_prestacao)
        }
        if (notaParaSubstituir.aliquota_iss !== undefined) {
          setAliquotaIss(notaParaSubstituir.aliquota_iss)
        }
        setIssRetido(Boolean(notaParaSubstituir.iss_retido))
        if (notaParaSubstituir.outras_retencoes !== undefined) {
          setOutrasRetencoes(notaParaSubstituir.outras_retencoes)
        }
        if (notaParaSubstituir.desconto_incondicionado !== undefined) {
          setDescontoIncondicionado(notaParaSubstituir.desconto_incondicionado)
        }

        // Itens
        if (
          notaParaSubstituir.servicos_itens &&
          Array.isArray(notaParaSubstituir.servicos_itens) &&
          notaParaSubstituir.servicos_itens.length > 0
        ) {
          setItens(
            notaParaSubstituir.servicos_itens.map((it: any, idx: number) => ({
              item: it.item || idx + 1,
              descricao: it.descricao || '',
              quantidade: Number(it.quantidade) || 1,
              valor_unitario: Number(it.valor_unitario || it.valor_total) || 0,
              valor_total: Number(it.valor_total) || 0,
              codigo_tributacao_nacional:
                it.codigo_tributacao_nacional ||
                notaParaSubstituir.codigo_tributacao_nacional ||
                '010701',
              desconto: Number(it.desconto) || 0,
            })),
          )
        } else if (notaParaSubstituir.discriminacao) {
          setItens([
            {
              item: 1,
              descricao: notaParaSubstituir.discriminacao,
              quantidade: 1,
              valor_unitario: notaParaSubstituir.valor_servicos || 0,
              valor_total: notaParaSubstituir.valor_servicos || 0,
              codigo_tributacao_nacional: notaParaSubstituir.codigo_tributacao_nacional || '010701',
              desconto: 0,
            },
          ])
        }
      } else {
        setJustificativaCorrecao('')
        // Se ainda não selecionou cliente, seleciona o padrão ativo ou o primeiro da lista
        if (!empresaClienteId && clientesDisponiveis.length > 0) {
          const padrao =
            empresaAtiva?.id && clientesDisponiveis.some((c) => c.id === empresaAtiva.id)
              ? empresaAtiva.id
              : clientesDisponiveis[0].id
          setEmpresaClienteId(padrao)
        }
      }
    }
  }, [
    open,
    seriePadrao,
    proximoNumeroPadrao,
    notaParaSubstituir,
    minhaEmpresa,
    clientesDisponiveis,
    empresaAtiva,
  ])

  // Cálculos automáticos dos itens e totais
  const valorServicosTotal = itens.reduce((acc, it) => acc + (Number(it.valor_total) || 0), 0)
  const baseCalculo = Math.max(0, valorServicosTotal - descontoIncondicionado)

  const valorIss = Number(((baseCalculo * aliquotaIss) / 100).toFixed(2))
  const valorPis = Number(((baseCalculo * aliquotaPis) / 100).toFixed(2))
  const valorCofins = Number(((baseCalculo * aliquotaCofins) / 100).toFixed(2))
  const valorInss = Number(((baseCalculo * aliquotaInss) / 100).toFixed(2))
  const valorIr = Number(((baseCalculo * aliquotaIr) / 100).toFixed(2))
  const valorCsll = Number(((baseCalculo * aliquotaCsll) / 100).toFixed(2))

  const totalRetencoesFederais =
    valorPis + valorCofins + valorInss + valorIr + valorCsll + outrasRetencoes
  const totalRetidoTomador = (issRetido ? valorIss : 0) + totalRetencoesFederais

  const valorLiquido = Math.max(0, valorServicosTotal - descontoIncondicionado - totalRetidoTomador)

  // Gerenciamento de itens
  const handleItemChange = (index: number, campo: keyof ItemServicoNfse, valor: any) => {
    const novos = [...itens]
    const itemAtual = { ...novos[index], [campo]: valor }

    if (campo === 'quantidade' || campo === 'valor_unitario') {
      const q = campo === 'quantidade' ? Number(valor) : itemAtual.quantidade
      const u = campo === 'valor_unitario' ? Number(valor) : itemAtual.valor_unitario
      itemAtual.valor_total = Number((q * u).toFixed(2))
    }

    novos[index] = itemAtual
    setItens(novos)
  }

  const handleAdicionarItem = () => {
    setItens([
      ...itens,
      {
        item: itens.length + 1,
        descricao: '',
        quantidade: 1,
        valor_unitario: 0,
        valor_total: 0,
        codigo_tributacao_nacional: codigoTributacao,
        desconto: 0,
      },
    ])
  }

  const handleRemoverItem = (index: number) => {
    if (itens.length <= 1) {
      toast({
        title: 'Item obrigatório',
        description: 'A nota deve conter ao menos um item de serviço.',
        variant: 'destructive',
      })
      return
    }
    const filtrados = itens
      .filter((_, i) => i !== index)
      .map((it, idx) => ({ ...it, item: idx + 1 }))
    setItens(filtrados)
  }

  // Transmissão / Emissão
  const handleEmitirNfse = async () => {
    // 1. Validação da Prestadora (Minha Empresa)
    if (!validacaoPrestadora.valido) {
      toast({
        title: 'Dados da Prestadora incompletos',
        description: `Complete o cadastro em Configurações: ${validacaoPrestadora.faltando.join(', ')}.`,
        variant: 'destructive',
      })
      return
    }

    // 2. Validação do Tomador (Empresa Cliente)
    if (!tomadorEmpresa) {
      toast({
        title: 'Selecione a empresa Tomadora',
        description: 'É necessário selecionar uma empresa cliente como tomadora dos serviços.',
        variant: 'destructive',
      })
      return
    }

    if (!validacaoTomador.valido) {
      toast({
        title: 'Dados obrigatórios do Tomador incompletos',
        description: `Não é possível transmitir. Dados faltantes na empresa selecionada (${tomadorEmpresa.nome}): ${validacaoTomador.faltando.join('; ')}. Complete o cadastro na tela Empresas.`,
        variant: 'destructive',
      })
      return
    }

    if (valorServicosTotal <= 0) {
      toast({
        title: 'Valor inválido',
        description: 'O total dos serviços deve ser maior que R$ 0,00.',
        variant: 'destructive',
      })
      return
    }

    // Validação obrigatória da Justificativa em caso de substituição/reemissão
    if (notaParaSubstituir && !justificativaCorrecao.trim()) {
      toast({
        title: 'Justificativa Obrigatória',
        description:
          'Para reemitir uma nota substituindo a anterior, informe o Motivo/Justificativa da Correção.',
        variant: 'destructive',
      })
      return
    }

    // 3. Montar payload do DPS Nacional com papéis corretos:
    // PRESTADOR = Minha Empresa (consultoria do usuário)
    // TOMADOR = Empresa Cliente cadastrada na coleção "empresas"
    const configTransmissao = servicoTransmissaoNfse.obterConfiguracoes(tomadorEmpresa.id)
    const versaoLayoutAtiva = configTransmissao.versaoLayout || '2.00'

    const codIbgePrestador = (minhaEmpresa?.codigo_ibge || '').replace(/\D/g, '')
    const codMunPrestadorFinal =
      codIbgePrestador.length === 7 ? codIbgePrestador : municipioPrestacao

    const optionsDps: GerarDpsNacionalOptions = {
      tipoAmbiente: configTransmissao.tipoAmbiente || '2',
      versaoLayout: versaoLayoutAtiva,
      serie,
      numeroDps,
      competencia,
      municipioPrestacao,
      prestador: {
        cnpj: minhaEmpresa?.cnpj || '30.915.624/0001-08',
        razaoSocial:
          minhaEmpresa?.razao_social ||
          minhaEmpresa?.nome_fantasia ||
          'BORLIM CONSULTORIA EMPRESARIAL LTDA',
        nomeFantasia: minhaEmpresa?.nome_fantasia,
        inscricaoMunicipal: minhaEmpresa?.inscricao_municipal || '',
        regimeTributario: minhaEmpresa?.regime_tributario || 'Simples Nacional',
        codigoMunicipio: codMunPrestadorFinal,
        uf: minhaEmpresa?.estado || 'SP',
      },
      tomador: {
        tipoPessoa: 'PJ',
        cpfCnpj: tomadorEmpresa.cnpj || '',
        razaoSocial: tomadorEmpresa.nome,
        nomeFantasia: tomadorEmpresa.nome_fantasia || undefined,
        inscricaoMunicipal: undefined,
        email: tomadorEmpresa.email || undefined,
        telefone: tomadorEmpresa.telefone || undefined,
        logradouro: tomadorEmpresa.logradouro || '',
        numero: tomadorEmpresa.numero || 'S/N',
        complemento: tomadorEmpresa.complemento || undefined,
        bairro: tomadorEmpresa.bairro || 'CENTRO',
        cidade: tomadorEmpresa.cidade || '',
        estado: tomadorEmpresa.estado || 'SP',
        cep: tomadorEmpresa.cep || '',
        codigoMunicipio: municipioPrestacao,
      },
      itens: itens.map((it) => ({
        item: it.item,
        descricao: it.descricao,
        quantidade: Number(it.quantidade) || 1,
        valorUnitario: Number(it.valor_unitario) || 0,
        valorTotal: Number(it.valor_total) || 0,
        codigoTributacaoNacional: it.codigo_tributacao_nacional || codigoTributacao,
        desconto: Number(it.desconto) || 0,
        aliquotaIss,
      })),
      valores: {
        valorServicos: valorServicosTotal,
        aliquotaIss,
        valorIss,
        issRetido,
        valorPis,
        valorCofins,
        valorInss,
        valorIr,
        valorCsll,
        outrasRetencoes,
        descontoIncondicionado,
        valorLiquido,
      },
    }

    // 4. Validação local do layout DPS Nacional
    const validacao = validarDpsNacionalLocal(optionsDps)
    if (!validacao.valido) {
      toast({
        title: 'Inconsistência no DPS Nacional',
        description: validacao.erros[0] || 'Corrija os campos do DPS antes de transmitir.',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    try {
      // 5. Gerar JSON canônico
      const { dpsId, payload: dpsPayload } = gerarPayloadDpsNacional(optionsDps)

      // 6. Camada de transmissão
      const retornoTransmissao = await servicoTransmissaoNfse.transmitirDps(
        dpsPayload,
        configTransmissao,
      )

      if (!retornoTransmissao.sucesso) {
        throw new Error(retornoTransmissao.mensagem || 'Falha ao processar DPS no Portal Nacional.')
      }

      // 7. Salvar nota na base de dados vinculada à empresa tomadora
      const inputNfse: EmitirNfseInput = {
        empresa_id: tomadorEmpresa.id,
        numero: retornoTransmissao.numeroNfse || numeroDps,
        serie,
        competencia,
        discriminacao: itens.map((i) => `${i.item}. ${i.descricao}`).join('\n'),
        valor_servicos: valorServicosTotal,
        aliquota_iss: aliquotaIss,
        valor_iss: valorIss,
        iss_retido: issRetido,
        valor_pis: valorPis,
        valor_cofins: valorCofins,
        valor_inss: valorInss,
        valor_ir: valorIr,
        valor_csll: valorCsll,
        outras_retencoes: outrasRetencoes,
        desconto_incondicionado: descontoIncondicionado,
        valor_liquido: valorLiquido,
        padrao_nacional: true,
        dps_serie: serie,
        dps_numero: numeroDps,
        dps_id: dpsId,
        dps_payload: dpsPayload,
        servicos_itens: itens,
        codigo_tributacao_nacional: codigoTributacao,
        codigo_municipio_prestacao: municipioPrestacao,
        tipo_ambiente: (configTransmissao.tipoAmbiente === '1'
          ? '1 - Producao'
          : '2 - Homologacao') as any,
        tomador_dados: {
          cpf_cnpj: tomadorEmpresa.cnpj || '',
          razao_social: tomadorEmpresa.nome,
          email: tomadorEmpresa.email || '',
          tipo_pessoa: 'PJ',
          logradouro: tomadorEmpresa.logradouro || '',
          numero: tomadorEmpresa.numero || '',
          bairro: tomadorEmpresa.bairro || '',
          cidade: tomadorEmpresa.cidade || '',
          estado: tomadorEmpresa.estado || '',
          cep: tomadorEmpresa.cep || '',
        },
      }

      let registroCriado: NotaFiscalRecord | undefined

      if (notaParaSubstituir) {
        // Fluxo de Substituição / Reemissão Corrigida
        const { nfseLancamentosService } = await import('@/services/nfseLancamentosService')
        const resultadoSubst = await nfseLancamentosService.processarReemissaoCorrigida({
          notaOriginal: notaParaSubstituir,
          justificativaCorrecao: justificativaCorrecao.trim(),
          novaNotaData: {
            ...inputNfse,
            empresa: tomadorEmpresa.id,
            status: 'Emitida',
            chave_acesso: retornoTransmissao.chaveAcessoNfse,
            codigo_verificacao: retornoTransmissao.codigoVerificacao,
            protocolo_autorizacao: retornoTransmissao.protocoloAutorizacao,
          } as any,
          userId: user?.id,
          userName: user?.name || user?.email,
        })
        if (resultadoSubst?.novaNota) {
          registroCriado = resultadoSubst.novaNota
        }

        toast({
          title: 'NFS-e Reemitida e Corrigida com Sucesso!',
          description: `Nova NFS-e Nº ${numeroDps} autorizada para ${tomadorEmpresa.nome}. Nota original nº ${notaParaSubstituir.numero} marcada como 'Substituída'.`,
        })
      } else {
        const respEmissao = await notasFiscaisService.emitirNfse(inputNfse)
        if (respEmissao?.nota?.id) {
          registroCriado = { id: respEmissao.nota.id } as NotaFiscalRecord
        }

        toast({
          title: 'NFS-e Nacional Emitida com Sucesso!',
          description: `DPS Série ${serie} Nº ${numeroDps} autorizada para o cliente ${tomadorEmpresa.nome}.`,
        })
      }

      onEmitida(registroCriado)
      onOpenChange(false)
    } catch (err: any) {
      toast({
        title: 'Erro na emissão da NFS-e Nacional',
        description: err?.message || 'Falha ao conectar com o serviço de transmissão.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="flex items-center gap-2 text-lg">
                  <FileCheck2 className="w-5 h-5 text-primary" />
                  {notaParaSubstituir
                    ? `Reemissão Corrigida de NFS-e (Substituição da Nota nº ${notaParaSubstituir.numero})`
                    : 'Nova Emissão NFS-e Nacional (DPS 2.0 / Layout 2.0)'}
                </DialogTitle>
                <DialogDescription>
                  {notaParaSubstituir
                    ? `Todos os dados da nota original foram carregados com novo sequencial de DPS. A nota original nº ${notaParaSubstituir.numero} será marcada como Substituída.`
                    : 'Declaração de Prestação de Serviços (DPS 2.0) conforme padrão nacional da Receita Federal com integração do IBGE da sua empresa.'}
                </DialogDescription>
              </div>
              <div className="flex items-center gap-1.5">
                <Badge className="bg-indigo-600 text-white text-[11px] font-semibold">
                  Padrão NFS-e Nacional 2.0
                </Badge>
                <Badge
                  variant="outline"
                  className={
                    notaParaSubstituir
                      ? 'border-amber-500 bg-amber-50 text-amber-800 text-xs'
                      : 'border-primary/40 bg-primary/5 text-primary text-xs'
                  }
                >
                  {notaParaSubstituir
                    ? 'Modo Substituição / Reemissão'
                    : 'Homologação Nacional Ativa'}
                </Badge>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* Bloco de Justificativa Obrigatória em caso de Reemissão */}
            {notaParaSubstituir && (
              <div className="border border-amber-300 bg-amber-50/70 dark:bg-amber-950/20 rounded-lg p-3.5 space-y-2">
                <div className="flex items-center gap-2 font-bold text-amber-900 dark:text-amber-300 text-xs">
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  Substituição da NFS-e nº {notaParaSubstituir.numero} (Chave:{' '}
                  {notaParaSubstituir.chave_acesso?.slice(0, 20)}...)
                </div>
                <p className="text-[11px] text-amber-800 dark:text-amber-200">
                  A emissão desta nova nota substituirá a nota original sem gerar duplicidade
                  contábil no plano de contas. O motivo / justificativa da correção é obrigatório
                  por exigência fiscal e será registrado no histórico de auditoria.
                </p>
                <div className="space-y-1 pt-1">
                  <Label className="text-xs font-bold text-amber-950 dark:text-amber-100">
                    Justificativa / Motivo da Correção *
                  </Label>
                  <Textarea
                    required
                    rows={2}
                    value={justificativaCorrecao}
                    onChange={(e) => setJustificativaCorrecao(e.target.value)}
                    placeholder="Ex: Correção de alíquota de ISS e detalhamento da discriminação conforme solicitação do tomador..."
                    className="text-xs bg-white border-amber-300 focus:border-amber-500"
                  />
                </div>
              </div>
            )}
            {/* 1. PRESTADORA DE SERVIÇOS (MINHA EMPRESA - FIXO E AUTOMÁTICO) */}
            <div className="border border-blue-200 dark:border-blue-900 bg-blue-50/40 dark:bg-blue-950/20 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-blue-600" />
                  <span className="font-bold text-xs text-blue-950 dark:text-blue-200">
                    Empresa Prestadora (Emitente Fixo: Sua Empresa / Consultoria)
                  </span>
                  <Badge
                    variant="outline"
                    className="text-[10px] bg-white border-blue-200 text-blue-700"
                  >
                    Fixado Automaticamente
                  </Badge>
                </div>
                {onAbrirConfiguracao && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={onAbrirConfiguracao}
                    className="h-6 text-[11px] text-blue-700 hover:text-blue-800 p-0 gap-1"
                  >
                    Editar dados da prestadora <ExternalLink className="w-3 h-3" />
                  </Button>
                )}
              </div>

              {minhaEmpresa ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-white/80 dark:bg-slate-900/40 p-2.5 rounded border border-blue-100 dark:border-blue-900/60 text-xs">
                  <div>
                    <span className="text-[10px] text-muted-foreground block font-medium">
                      Razão Social
                    </span>
                    <strong
                      className="text-foreground truncate block"
                      title={minhaEmpresa.razao_social}
                    >
                      {minhaEmpresa.razao_social ||
                        minhaEmpresa.nome_fantasia ||
                        'BORLIM CONSULTORIA'}
                    </strong>
                    {minhaEmpresa.nome_fantasia && (
                      <span className="text-[10px] text-muted-foreground">
                        ({minhaEmpresa.nome_fantasia})
                      </span>
                    )}
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground block font-medium">
                      CNPJ / Inscrição Municipal
                    </span>
                    <span className="font-mono text-foreground font-semibold">
                      {minhaEmpresa.cnpj || '30.915.624/0001-08'}
                    </span>
                    {minhaEmpresa.inscricao_municipal && (
                      <span className="text-[10px] text-muted-foreground block font-mono">
                        IM: {minhaEmpresa.inscricao_municipal}
                      </span>
                    )}
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground block font-medium">
                      Sede / Regime
                    </span>
                    <span className="text-foreground truncate block">
                      {minhaEmpresa.cidade || 'Jaci'}/{minhaEmpresa.estado || 'SP'} ·{' '}
                      {minhaEmpresa.regime_tributario || 'Simples Nacional'}
                    </span>
                    {minhaEmpresa.cnae_servicos && (
                      <span className="text-[10px] text-muted-foreground block font-mono">
                        CNAE: {minhaEmpresa.cnae_servicos}
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-200 p-2 rounded text-xs text-amber-900 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    Dados da sua empresa não encontrados. Abra a Configuração da NFS-e para
                    cadastrar a Razão Social e CNPJ.
                  </span>
                </div>
              )}
            </div>

            {/* 2. TOMADOR DOS SERVIÇOS (CLIENTES JÁ CADASTRADOS EM EMPRESAS) */}
            <div className="border rounded-lg p-3 bg-card space-y-3 shadow-2xs">
              <div className="flex items-center justify-between">
                <Label className="font-semibold text-sm flex items-center gap-1.5 text-foreground">
                  <Building2 className="w-4 h-4 text-primary" />
                  Tomador dos Serviços (Empresa Cliente Cadastrada) *
                </Label>
                <Badge
                  variant="outline"
                  className="text-[10px] bg-emerald-50 text-emerald-800 border-emerald-200"
                >
                  {clientesDisponiveis.length} clientes cadastrados
                </Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-start">
                <div className="md:col-span-2 space-y-1">
                  <Select
                    value={empresaClienteId}
                    onValueChange={(val) => setEmpresaClienteId(val)}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Selecione a empresa cliente tomadora" />
                    </SelectTrigger>
                    <SelectContent>
                      {clientesDisponiveis.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.nome_fantasia ? `${emp.nome_fantasia} — ${emp.nome}` : emp.nome} (
                          {emp.cnpj || 'Sem CNPJ'})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground">
                    Lista diretamente as empresas cadastradas no módulo de Empresas (GIGA MÓVEIS,
                    UNICLASS UNIFORMES, MOLARE...).
                  </p>
                </div>

                {tomadorEmpresa && (
                  <div className="text-[11px] bg-muted/30 border rounded p-2 space-y-0.5">
                    <p className="font-bold text-foreground truncate" title={tomadorEmpresa.nome}>
                      {tomadorEmpresa.nome}
                    </p>
                    <p className="font-mono text-muted-foreground">
                      CNPJ: {tomadorEmpresa.cnpj || 'Não informado'}
                    </p>
                    <p className="text-muted-foreground truncate flex items-center gap-1">
                      <MapPin className="w-3 h-3 shrink-0" />
                      {tomadorEmpresa.cidade || '—'}/{tomadorEmpresa.estado || '—'} · CEP{' '}
                      {tomadorEmpresa.cep || '—'}
                    </p>
                    {tomadorEmpresa.email && (
                      <p className="text-muted-foreground truncate">{tomadorEmpresa.email}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Alerta impeditivo claro caso faltem dados obrigatórios no tomador */}
              {!validacaoTomador.valido && (
                <div className="rounded-md border border-red-300 bg-red-50 dark:bg-red-950/30 p-3 text-xs text-red-900 dark:text-red-200 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-bold text-red-950 dark:text-red-100">
                      Cadastro do Tomador Incompleto — Transmissão Bloqueada
                    </p>
                    <p className="text-[11px] text-red-800 dark:text-red-300 leading-relaxed">
                      O DPS Nacional exige os dados fiscais completos do tomador. Para emitir a nota
                      fiscal para{' '}
                      <strong>{tomadorEmpresa ? tomadorEmpresa.nome : 'esta empresa'}</strong>,
                      preencha os seguintes campos no cadastro da empresa:
                    </p>
                    <ul className="list-disc list-inside text-[11px] font-semibold text-red-900 dark:text-red-200 pt-0.5">
                      {validacaoTomador.faltando.map((campo, i) => (
                        <li key={i}>{campo}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>

            {/* 3. CABEÇALHO DO DPS / NÚMERO / SÉRIE */}
            <div className="border rounded-lg p-3 bg-muted/20 space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div>
                  <Label>Série da DPS</Label>
                  <Input
                    className="h-9 font-mono"
                    value={serie}
                    onChange={(e) => setSerie(e.target.value.replace(/\D/g, ''))}
                  />
                </div>

                <div>
                  <Label>Número da DPS</Label>
                  <Input
                    type="number"
                    className="h-9 font-mono"
                    value={numeroDps}
                    onChange={(e) => setNumeroDps(Math.max(1, parseInt(e.target.value) || 1))}
                  />
                </div>

                <div>
                  <Label>Competência</Label>
                  <Input
                    type="date"
                    className="h-9"
                    value={competencia}
                    onChange={(e) => setCompetencia(e.target.value)}
                  />
                </div>

                <div>
                  <Label>Cód. Trib. (LC 116)</Label>
                  <Input
                    className="h-9 font-mono"
                    placeholder="010701 ou 6920-6/01"
                    value={codigoTributacao}
                    onChange={(e) => setCodigoTributacao(e.target.value)}
                  />
                </div>

                <div>
                  <Label>Cód. IBGE Município</Label>
                  <Input
                    className="h-9 font-mono"
                    value={municipioPrestacao}
                    onChange={(e) => setMunicipioPrestacao(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* ITENS DE SERVIÇOS DETALHADOS */}
            <div className="border rounded-lg p-3 bg-card space-y-3">
              <div className="flex items-center justify-between">
                <Label className="font-semibold text-sm">Itens de Serviços (DPS Nacional)</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAdicionarItem}
                  className="h-7 text-xs gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Adicionar Item
                </Button>
              </div>

              <div className="space-y-2">
                {itens.map((item, idx) => (
                  <div
                    key={idx}
                    className="border rounded-md p-2.5 bg-muted/10 grid grid-cols-1 md:grid-cols-12 gap-2 items-center"
                  >
                    <div className="md:col-span-1 text-center font-mono font-bold text-muted-foreground">
                      #{item.item}
                    </div>
                    <div className="md:col-span-5">
                      <Input
                        placeholder="Descrição detalhada do serviço prestado..."
                        className="h-8 text-xs"
                        value={item.descricao}
                        onChange={(e) => handleItemChange(idx, 'descricao', e.target.value)}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Input
                        type="number"
                        min={1}
                        placeholder="Qtd"
                        className="h-8 text-xs text-center"
                        value={item.quantidade}
                        onChange={(e) =>
                          handleItemChange(
                            idx,
                            'quantidade',
                            Math.max(1, parseFloat(e.target.value) || 1),
                          )
                        }
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Unitário (R$)"
                        className="h-8 text-xs text-right font-mono"
                        value={item.valor_unitario}
                        onChange={(e) =>
                          handleItemChange(idx, 'valor_unitario', parseFloat(e.target.value) || 0)
                        }
                      />
                    </div>
                    <div className="md:col-span-1 text-right font-mono font-semibold text-xs text-foreground">
                      {formatBrlMoeda(item.valor_total)}
                    </div>
                    <div className="md:col-span-1 text-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:bg-destructive/10"
                        onClick={() => handleRemoverItem(idx)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* RETENÇÕES E TRIBUTOS */}
            <div className="border rounded-lg p-3 bg-muted/15 space-y-3">
              <div className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                <Calculator className="w-4 h-4 text-primary" />
                Tributação Municipal (ISSQN) e Retenções Federais
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <Label>Alíquota ISS (%)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    className="h-8 font-mono"
                    value={aliquotaIss}
                    onChange={(e) => setAliquotaIss(parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="flex items-center space-x-2 pt-4">
                  <Switch id="iss-retido" checked={issRetido} onCheckedChange={setIssRetido} />
                  <Label htmlFor="iss-retido" className="cursor-pointer">
                    ISS Retido pelo Tomador
                  </Label>
                </div>
                <div>
                  <Label>Desconto Incondicionado (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    className="h-8 font-mono"
                    value={descontoIncondicionado}
                    onChange={(e) => setDescontoIncondicionado(parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <Label>Outras Retenções (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    className="h-8 font-mono"
                    value={outrasRetencoes}
                    onChange={(e) => setOutrasRetencoes(parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-2 border-t pt-2 text-[11px]">
                <div>
                  <Label className="text-[10px]">PIS (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    className="h-7 text-xs font-mono"
                    value={aliquotaPis}
                    onChange={(e) => setAliquotaPis(parseFloat(e.target.value) || 0)}
                  />
                  <span className="text-[10px] text-muted-foreground">
                    {formatBrlMoeda(valorPis)}
                  </span>
                </div>
                <div>
                  <Label className="text-[10px]">COFINS (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    className="h-7 text-xs font-mono"
                    value={aliquotaCofins}
                    onChange={(e) => setAliquotaCofins(parseFloat(e.target.value) || 0)}
                  />
                  <span className="text-[10px] text-muted-foreground">
                    {formatBrlMoeda(valorCofins)}
                  </span>
                </div>
                <div>
                  <Label className="text-[10px]">INSS (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    className="h-7 text-xs font-mono"
                    value={aliquotaInss}
                    onChange={(e) => setAliquotaInss(parseFloat(e.target.value) || 0)}
                  />
                  <span className="text-[10px] text-muted-foreground">
                    {formatBrlMoeda(valorInss)}
                  </span>
                </div>
                <div>
                  <Label className="text-[10px]">IR (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    className="h-7 text-xs font-mono"
                    value={aliquotaIr}
                    onChange={(e) => setAliquotaIr(parseFloat(e.target.value) || 0)}
                  />
                  <span className="text-[10px] text-muted-foreground">
                    {formatBrlMoeda(valorIr)}
                  </span>
                </div>
                <div>
                  <Label className="text-[10px]">CSLL (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    className="h-7 text-xs font-mono"
                    value={aliquotaCsll}
                    onChange={(e) => setAliquotaCsll(parseFloat(e.target.value) || 0)}
                  />
                  <span className="text-[10px] text-muted-foreground">
                    {formatBrlMoeda(valorCsll)}
                  </span>
                </div>
              </div>
            </div>

            {/* RESUMO DE VALORES TOTAIS */}
            <div className="border border-primary/20 bg-primary/5 rounded-lg p-3 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div>
                <p className="text-xs text-muted-foreground">
                  Total dos Serviços:{' '}
                  <strong className="text-foreground">{formatBrlMoeda(valorServicosTotal)}</strong>{' '}
                  | Retenções:{' '}
                  <strong className="text-foreground">{formatBrlMoeda(totalRetidoTomador)}</strong>{' '}
                  (ISS: {formatBrlMoeda(valorIss)})
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Geração em modo homologação nacional (Padrão NFS-e Nacional 2.0 / DPS 2.0) com
                  chave de acesso de 50 dígitos e código IBGE integrado.
                </p>
              </div>

              <div className="text-right">
                <span className="text-[11px] uppercase tracking-wider text-primary font-semibold block">
                  Valor Líquido da NFS-e
                </span>
                <span className="font-mono text-xl font-bold text-primary">
                  {formatBrlMoeda(valorLiquido)}
                </span>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button
              onClick={handleEmitirNfse}
              disabled={loading || !validacaoTomador.valido || !validacaoPrestadora.valido}
              className="gap-2"
              title={
                !validacaoTomador.valido
                  ? `Transmissão bloqueada: faltam dados no tomador (${validacaoTomador.faltando.join(', ')})`
                  : undefined
              }
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />{' '}
                  {notaParaSubstituir ? 'Substituindo e Transmitindo...' : 'Transmitindo DPS...'}
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />{' '}
                  {notaParaSubstituir ? 'Confirmar Reemissão Corrigida' : 'Emitir NFS-e Nacional'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
