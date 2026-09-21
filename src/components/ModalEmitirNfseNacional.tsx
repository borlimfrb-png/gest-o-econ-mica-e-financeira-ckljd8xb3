import React, { useState, useEffect } from 'react'
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
  UserPlus,
  AlertTriangle,
  Building2,
  Info,
  AlertCircle,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/contexts/AuthContext'
import { useMinhaEmpresa } from '@/contexts/MinhaEmpresaContext'
import {
  EmpresaRecord,
  NfseTomadorRecord,
  ItemServicoNfse,
  NotaFiscalRecord,
} from '@/types/finance'
import { tomadoresService } from '@/services/tomadoresService'
import { notasFiscaisService, EmitirNfseInput } from '@/services/notasFiscaisService'
import { servicoTransmissaoNfse } from '@/services/transmissaoNfseService'
import {
  gerarPayloadDpsNacional,
  validarDpsNacionalLocal,
  GerarDpsNacionalOptions,
} from '@/lib/nfseNacionalDps'
import { formatBrlMoeda } from '@/lib/nfseXmlGenerator'
import { ModalCadastroTomador } from './ModalCadastroTomador'

interface ModalEmitirNfseNacionalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  empresaAtiva: EmpresaRecord | null
  empresasLista: EmpresaRecord[]
  seriePadrao: string
  proximoNumeroPadrao: number
  onEmitida: () => void
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
  notaParaSubstituir,
}: ModalEmitirNfseNacionalProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const { minhaEmpresa } = useMinhaEmpresa()

  // Controle de estados
  const [loading, setLoading] = useState(false)
  const [modalTomadorOpen, setModalTomadorOpen] = useState(false)
  const [tomadores, setTomadores] = useState<NfseTomadorRecord[]>([])
  const [tomadorSelecionadoId, setTomadorSelecionadoId] = useState<string>('')

  // Prestador selecionado (empresa)
  const [empresaId, setEmpresaId] = useState<string>(empresaAtiva?.id || '')

  // DPS Cabeçalho
  const [serie, setSerie] = useState<string>(seriePadrao || '1')
  const [numeroDps, setNumeroDps] = useState<number>(proximoNumeroPadrao || 1)
  const [competencia, setCompetencia] = useState<string>(new Date().toISOString().slice(0, 10))
  const [codigoTributacao, setCodigoTributacao] = useState<string>('010701') // Suporte técnico/consultoria LC 116
  const [municipioPrestacao, setMunicipioPrestacao] = useState<string>('3550308') // São Paulo

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

  // Atualizar quando abrir ou empresa mudar
  useEffect(() => {
    if (empresaAtiva?.id) {
      setEmpresaId(empresaAtiva.id)
    }
  }, [empresaAtiva])

  useEffect(() => {
    if (open) {
      setSerie(seriePadrao || '1')
      setNumeroDps(proximoNumeroPadrao || 1)

      // Se Minha Empresa possui Código IBGE cadastrado, inicializa o município de prestação com ele
      const ibgeMinhaEmpresa = (minhaEmpresa?.codigo_ibge || '').replace(/\D/g, '')
      if (ibgeMinhaEmpresa.length === 7 && !notaParaSubstituir) {
        setMunicipioPrestacao(ibgeMinhaEmpresa)
      }

      if (notaParaSubstituir) {
        // Pré-preencher com dados da nota original
        setJustificativaCorrecao('')
        if (notaParaSubstituir.empresa) setEmpresaId(notaParaSubstituir.empresa)
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

        // Alíquotas aproximadas a partir dos valores se existirem
        const valServ = notaParaSubstituir.valor_servicos || 1
        if (notaParaSubstituir.valor_pis) {
          setAliquotaPis(Number(((notaParaSubstituir.valor_pis / valServ) * 100).toFixed(2)))
        }
        if (notaParaSubstituir.valor_cofins) {
          setAliquotaCofins(Number(((notaParaSubstituir.valor_cofins / valServ) * 100).toFixed(2)))
        }
        if (notaParaSubstituir.valor_inss) {
          setAliquotaInss(Number(((notaParaSubstituir.valor_inss / valServ) * 100).toFixed(2)))
        }
        if (notaParaSubstituir.valor_ir) {
          setAliquotaIr(Number(((notaParaSubstituir.valor_ir / valServ) * 100).toFixed(2)))
        }
        if (notaParaSubstituir.valor_csll) {
          setAliquotaCsll(Number(((notaParaSubstituir.valor_csll / valServ) * 100).toFixed(2)))
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

        if (notaParaSubstituir.tomador_ref) {
          setTomadorSelecionadoId(notaParaSubstituir.tomador_ref)
        }
      } else {
        setJustificativaCorrecao('')
      }

      carregarTomadores()
    }
  }, [open, empresaId, seriePadrao, proximoNumeroPadrao, notaParaSubstituir])

  const carregarTomadores = async () => {
    try {
      const lista = await tomadoresService.listar(empresaId || undefined)
      setTomadores(lista)
      if (lista.length > 0 && !tomadorSelecionadoId) {
        setTomadorSelecionadoId(lista[0].id)
      }
    } catch (err) {
      console.warn('Erro ao carregar tomadores:', err)
    }
  }

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

  // Tomador atual
  const tomadorAtual = tomadores.find((t) => t.id === tomadorSelecionadoId) || null
  const prestadorAtual = empresasLista.find((e) => e.id === empresaId) || empresaAtiva

  // Transmissão / Emissão
  const handleEmitirNfse = async () => {
    if (!tomadorAtual) {
      toast({
        title: 'Selecione um Tomador',
        description: 'É necessário cadastrar ou selecionar o tomador dos serviços.',
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

    // 1. Montar payload do DPS Nacional
    const configTransmissao = servicoTransmissaoNfse.obterConfiguracoes(empresaId)
    const versaoLayoutAtiva = configTransmissao.versaoLayout || '2.00'

    // Código IBGE do prestador: prioriza Minha Empresa (consultoria sede), fallback para município da prestação
    const codIbgeMinhaEmpresa = (minhaEmpresa?.codigo_ibge || '').replace(/\D/g, '')
    const codMunPrestadorFinal =
      codIbgeMinhaEmpresa.length === 7 ? codIbgeMinhaEmpresa : municipioPrestacao

    const optionsDps: GerarDpsNacionalOptions = {
      tipoAmbiente: '2', // Homologação / Simulação Nacional
      versaoLayout: versaoLayoutAtiva,
      serie,
      numeroDps,
      competencia,
      municipioPrestacao,
      prestador: {
        cnpj: prestadorAtual?.cnpj || minhaEmpresa?.cnpj || '00.000.000/0001-00',
        razaoSocial:
          prestadorAtual?.nome || minhaEmpresa?.razao_social || 'Borlim Consultoria Financeira',
        nomeFantasia: minhaEmpresa?.nome_fantasia,
        inscricaoMunicipal: minhaEmpresa?.inscricao_municipal || '12345678',
        regimeTributario:
          prestadorAtual?.regime_tributario ||
          minhaEmpresa?.regime_tributario ||
          'Simples Nacional',
        codigoMunicipio: codMunPrestadorFinal,
        uf: minhaEmpresa?.estado || 'MG',
      },
      tomador: {
        tipoPessoa: tomadorAtual.tipo_pessoa || 'PJ',
        cpfCnpj: tomadorAtual.cpf_cnpj,
        razaoSocial: tomadorAtual.razao_social,
        nomeFantasia: tomadorAtual.nome_fantasia,
        inscricaoMunicipal: tomadorAtual.inscricao_municipal,
        email: tomadorAtual.email,
        telefone: tomadorAtual.telefone,
        logradouro: tomadorAtual.logradouro || 'RUA PRINCIPAL',
        numero: tomadorAtual.numero || '100',
        complemento: tomadorAtual.complemento,
        bairro: tomadorAtual.bairro || 'CENTRO',
        cidade: tomadorAtual.cidade || 'SÃO PAULO',
        estado: tomadorAtual.estado || 'SP',
        cep: tomadorAtual.cep || '01000-000',
        codigoMunicipio: tomadorAtual.codigo_municipio || municipioPrestacao,
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

    // 2. Validação local do layout DPS Nacional
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
      // 3. Gerar JSON canônico
      const { dpsId, payload: dpsPayload } = gerarPayloadDpsNacional(optionsDps)

      // 4. Camada de transmissão desacoplada (Modo Homologação Nacional)
      const retornoTransmissao = await servicoTransmissaoNfse.transmitirDps(
        dpsPayload,
        configTransmissao,
      )

      if (!retornoTransmissao.sucesso) {
        throw new Error(retornoTransmissao.mensagem || 'Falha ao processar DPS no Portal Nacional.')
      }

      // 5. Salvar nota na base de dados com o DPS acoplado
      const inputNfse: EmitirNfseInput = {
        empresa_id: empresaId,
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
        tipo_ambiente: '2 - Homologacao',
        tomador_ref: tomadorAtual.id,
        tomador_dados: {
          cpf_cnpj: tomadorAtual.cpf_cnpj,
          razao_social: tomadorAtual.razao_social,
          email: tomadorAtual.email,
          tipo_pessoa: tomadorAtual.tipo_pessoa,
          logradouro: tomadorAtual.logradouro,
          numero: tomadorAtual.numero,
          bairro: tomadorAtual.bairro,
          cidade: tomadorAtual.cidade,
          estado: tomadorAtual.estado,
          cep: tomadorAtual.cep,
        },
      }

      if (notaParaSubstituir) {
        // Fluxo de Substituição / Reemissão Corrigida
        const { nfseLancamentosService } = await import('@/services/nfseLancamentosService')
        await nfseLancamentosService.processarReemissaoCorrigida({
          notaOriginal: notaParaSubstituir,
          justificativaCorrecao: justificativaCorrecao.trim(),
          novaNotaData: {
            ...inputNfse,
            empresa: empresaId,
            status: 'Emitida',
            chave_acesso: retornoTransmissao.chaveAcessoNfse,
            codigo_verificacao: retornoTransmissao.codigoVerificacao,
            protocolo_autorizacao: retornoTransmissao.protocoloAutorizacao,
          } as any,
          userId: user?.id,
          userName: user?.name || user?.email,
        })

        toast({
          title: 'NFS-e Reemitida e Corrigida com Sucesso!',
          description: `Nova NFS-e Nº ${numeroDps} autorizada. Nota original nº ${notaParaSubstituir.numero} marcada como 'Substituída'.`,
        })
      } else {
        await notasFiscaisService.emitirNfse(inputNfse)

        toast({
          title: 'NFS-e Nacional Emitida com Sucesso!',
          description: `DPS Série ${serie} Nº ${numeroDps} protocolada e autorizada no ambiente de homologação.`,
        })
      }

      onEmitida()
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
            {/* CABEÇALHO DO DPS / PRESTADOR */}
            <div className="border rounded-lg p-3 bg-muted/20 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="md:col-span-2">
                  <Label>Empresa Prestadora (Emissor Ativo)</Label>
                  <Select value={empresaId} onValueChange={setEmpresaId}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Selecione a empresa" />
                    </SelectTrigger>
                    <SelectContent>
                      {empresasLista.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.nome} ({emp.cnpj || 'CNPJ n/d'})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

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
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label>Data de Competência</Label>
                  <Input
                    type="date"
                    className="h-9"
                    value={competencia}
                    onChange={(e) => setCompetencia(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Cód. Tributação Nacional (CNAE/LC 116)</Label>
                  <Input
                    className="h-9 font-mono"
                    placeholder="010701 ou 6920-6/01"
                    value={codigoTributacao}
                    onChange={(e) => setCodigoTributacao(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Município da Prestação (IBGE)</Label>
                  <Input
                    className="h-9 font-mono"
                    value={municipioPrestacao}
                    onChange={(e) => setMunicipioPrestacao(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* SELEÇÃO DO TOMADOR COM BOTÃO DE CADASTRO RÁPIDO */}
            <div className="border rounded-lg p-3 bg-card space-y-2">
              <div className="flex items-center justify-between">
                <Label className="font-semibold text-sm flex items-center gap-1.5 text-foreground">
                  <Building2 className="w-4 h-4 text-primary" />
                  Tomador dos Serviços (Cliente)
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setModalTomadorOpen(true)}
                  className="h-7 text-xs gap-1.5"
                >
                  <UserPlus className="w-3.5 h-3.5" /> Novo Tomador
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
                <div className="md:col-span-2">
                  <Select
                    value={tomadorSelecionadoId}
                    onValueChange={(val) => setTomadorSelecionadoId(val)}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Selecione o tomador já cadastrado" />
                    </SelectTrigger>
                    <SelectContent>
                      {tomadores.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.razao_social} ({t.cpf_cnpj})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {tomadorAtual ? (
                  <div className="text-[11px] text-muted-foreground border-l pl-3">
                    <p className="font-semibold text-foreground truncate">
                      {tomadorAtual.razao_social}
                    </p>
                    <p>Doc: {tomadorAtual.cpf_cnpj}</p>
                    <p className="truncate">
                      {tomadorAtual.cidade || 'São Paulo'}/{tomadorAtual.estado || 'SP'}
                    </p>
                  </div>
                ) : (
                  <div className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    Cadastre ou selecione um tomador para continuar.
                  </div>
                )}
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
            <Button onClick={handleEmitirNfse} disabled={loading} className="gap-2">
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

      {/* Modal de Cadastro Rápido de Tomador */}
      <ModalCadastroTomador
        open={modalTomadorOpen}
        onOpenChange={setModalTomadorOpen}
        empresaId={empresaId}
        onSalvo={(novo) => {
          setTomadores((prev) => [novo, ...prev])
          setTomadorSelecionadoId(novo.id)
        }}
      />
    </>
  )
}
