import React, { useState, useEffect, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { notasFiscaisService, type EmitirNfseInput } from '@/services/notasFiscaisService'
import { empresasService } from '@/services/financeService'
import { useAuth } from '@/contexts/AuthContext'
import { useMinhaEmpresa } from '@/contexts/MinhaEmpresaContext'
import { useRealtime } from '@/hooks/use-realtime'
import { useToast } from '@/hooks/use-toast'
import type {
  NotaFiscalRecord,
  EmpresaRecord,
  ContratoRecord,
  StatusNotaFiscal,
  NfseTomadorRecord,
} from '@/types/finance'
import { formatCnpj, cleanCnpj } from '@/lib/financeCalculations'
import {
  gerarXmlNfse,
  downloadArquivo,
  formatBrlMoeda,
  type DadosDanfse,
} from '@/lib/nfseXmlGenerator'
import { ModalVisualizarDanfse } from '@/components/ModalVisualizarDanfse'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  FileText,
  Plus,
  Send,
  Download,
  Eye,
  Mail,
  Printer,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Building,
  DollarSign,
  ShieldCheck,
  RefreshCw,
  Search,
  HelpCircle,
  FileCode,
  Sparkles,
  ArrowRight,
  Info,
  Ban,
  TrendingUp,
  TrendingDown,
  CalendarClock,
  Link2,
} from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { ModalRelatorioNotasPeriodo } from '@/components/ModalRelatorioNotasPeriodo'
import { ModalRelatorioNotasPorTomador } from '@/components/ModalRelatorioNotasPorTomador'
import { ModalEmitirNfseNacional } from '@/components/ModalEmitirNfseNacional'
import { ModalCadastroTomador } from '@/components/ModalCadastroTomador'
import { ModalGerenciarTomadores } from '@/components/ModalGerenciarTomadores'
import { ModalConfiguracaoNfseNacional } from '@/components/ModalConfiguracaoNfseNacional'
import { tomadoresService } from '@/services/tomadoresService'
import { useFilter } from '@/contexts/FilterContext'
import { Settings, Users, FileSpreadsheet, UserCheck } from 'lucide-react'

interface NfseFormData {
  empresa_id: string
  contrato_id?: string
  numero: number
  serie: string
  discriminacao: string
  item_cnae: string
  codigo_servico_municipal: string
  natureza_operacao: string
  valor_servicos: number
  aliquota_iss: number
  valor_iss: number
  iss_retido: boolean
  valor_pis: number
  valor_cofins: number
  valor_inss: number
  valor_ir: number
  valor_csll: number
  outras_retencoes: number
  desconto_incondicionado: number
  valor_liquido: number
  competencia: string
  vencimento: string
  forcar_simulacao: boolean
}

export default function NotasFiscais() {
  const { toast } = useToast()
  const { user, isAdmin } = useAuth()
  const { minhaEmpresa } = useMinhaEmpresa()
  const { selectedEmpresaId, selectedAno } = useFilter()
  const [searchParams, setSearchParams] = useSearchParams()

  const podeEmitir = isAdmin || user?.role === 'empresa' || user?.role === 'admin' || !user?.role

  const [notas, setNotas] = useState<NotaFiscalRecord[]>([])
  const [empresas, setEmpresas] = useState<EmpresaRecord[]>([])
  const [tomadoresCadastrados, setTomadoresCadastrados] = useState<NfseTomadorRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [searchFilter, setSearchFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('todos')

  // Modal de Emissão
  const [modalEmissaoOpen, setModalEmissaoOpen] = useState(false)
  const [emitindo, setEmitindo] = useState(false)
  const [modalRelatorioOpen, setModalRelatorioOpen] = useState(false)
  const [modalRelatorioTomadorOpen, setModalRelatorioTomadorOpen] = useState(false)
  const [processandoAgendados, setProcessandoAgendados] = useState(false)
  const [proximoNumeroSugerido, setProximoNumeroSugerido] = useState<number>(1)
  const [contratoSelecionado, setContratoSelecionado] = useState<ContratoRecord | null>(null)
  const [buscandoContrato, setBuscandoContrato] = useState(false)

  // Formulário State
  const [formData, setFormData] = useState<NfseFormData>({
    empresa_id: '',
    contrato_id: '',
    numero: 1,
    serie: '1',
    discriminacao:
      'Prestação de serviços contábeis, assessoria financeira e consultoria em gestão empresarial conforme contrato vigente.',
    item_cnae: '6920-6/01',
    codigo_servico_municipal: '0107',
    natureza_operacao: '1',
    valor_servicos: 0,
    aliquota_iss: 5.0,
    valor_iss: 0,
    iss_retido: false,
    valor_pis: 0,
    valor_cofins: 0,
    valor_inss: 0,
    valor_ir: 0,
    valor_csll: 0,
    outras_retencoes: 0,
    desconto_incondicionado: 0,
    valor_liquido: 0,
    competencia: new Date().toISOString().slice(0, 10),
    vencimento: '',
    forcar_simulacao: false,
  })

  // Modal de Visualização DANFSE
  const [modalDanfseOpen, setModalDanfseOpen] = useState(false)
  const [notaVisualizando, setNotaVisualizando] = useState<NotaFiscalRecord | null>(null)

  // Modal de Envio de E-mail
  const [modalEmailOpen, setModalEmailOpen] = useState(false)
  const [notaParaEmail, setNotaParaEmail] = useState<NotaFiscalRecord | null>(null)
  const [emailDestinatarioInput, setEmailDestinatarioInput] = useState('')
  const [emailMensagemInput, setEmailMensagemInput] = useState('')
  const [enviandoEmail, setEnviandoEmail] = useState(false)

  // Modal de Cancelamento de NFSe
  const [cancelarModalOpen, setCancelarModalOpen] = useState(false)
  const [notaParaCancelar, setNotaParaCancelar] = useState<NotaFiscalRecord | null>(null)
  const [motivoCancelamento, setMotivoCancelamento] = useState('')
  const [codigoCancelamento, setCodigoCancelamento] = useState('1')
  const [cancelando, setCancelando] = useState(false)

  // Confirmação de exclusão
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [notaParaExcluir, setNotaParaExcluir] = useState<NotaFiscalRecord | null>(null)
  const [excluindo, setExcluindo] = useState(false)

  // Modais do Novo Padrão Nacional NFS-e / DPS
  const [modalNacionalOpen, setModalNacionalOpen] = useState(false)
  const [modalTomadoresOpen, setModalTomadoresOpen] = useState(false)
  const [modalConfigNacionalOpen, setModalConfigNacionalOpen] = useState(false)
  const [serieConfig, setSerieConfig] = useState('1')
  // Reemissão corrigida / Substituição
  const [notaParaSubstituir, setNotaParaSubstituir] = useState<NotaFiscalRecord | null>(null)

  const loadData = async () => {
    try {
      setLoading(true)
      const [notasList, empList, proxNum, tomList] = await Promise.all([
        notasFiscaisService.listar(),
        empresasService.getAll(),
        notasFiscaisService.getProximoNumero(),
        tomadoresService.listar(undefined, false).catch(() => [] as NfseTomadorRecord[]),
      ])
      setNotas(notasList)
      setEmpresas(empList)
      setProximoNumeroSugerido(proxNum)
      setTomadoresCadastrados(tomList)
    } catch (err) {
      console.error('Erro ao carregar notas fiscais:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Abertura automática do modal de configurações via parâmetro de URL (ex: ?configNfse=1 ou ?configNfse=true)
  useEffect(() => {
    const configParam = searchParams.get('configNfse')
    if (configParam === '1' || configParam === 'true' || configParam === 'open') {
      setModalConfigNacionalOpen(true)
      // Remove o parâmetro da URL de forma limpa para não reabrir em refreshes manuais
      const nextParams = new URLSearchParams(searchParams)
      nextParams.delete('configNfse')
      setSearchParams(nextParams, { replace: true })
    }
  }, [searchParams, setSearchParams])

  useRealtime<NotaFiscalRecord>('notas_fiscais', () => {
    loadData()
  })

  useRealtime<NfseTomadorRecord>('nfse_tomadores', () => {
    loadData()
  })

  // Clientes com emissão de nota habilitada
  const clientesHabilitados = useMemo(() => {
    return empresas.filter((e) => Boolean(e.emitir_nota_fiscal))
  }, [empresas])

  // Recalcula ISS e Valor Líquido dinamicamente
  const recalcularValores = (
    vServicos: number,
    aliqIss: number,
    retido: boolean,
    vPis: number,
    vCofins: number,
    vInss: number,
    vIr: number,
    vCsll: number,
    vOutras: number,
    vDesc: number,
  ) => {
    const issCalculado = (vServicos * (aliqIss || 0)) / 100
    const totalRetencoes =
      (retido ? issCalculado : 0) +
      (vPis || 0) +
      (vCofins || 0) +
      (vInss || 0) +
      (vIr || 0) +
      (vCsll || 0) +
      (vOutras || 0) +
      (vDesc || 0)
    const liquido = Math.max(0, vServicos - totalRetencoes)

    return {
      valor_iss: Number(issCalculado.toFixed(2)),
      valor_liquido: Number(liquido.toFixed(2)),
    }
  }

  // Ao selecionar um cliente no formulário, busca contrato e preenche automaticamente
  const handleSelectCliente = async (empresaId: string) => {
    setFormData((prev) => ({ ...prev, empresa_id: empresaId }))
    if (!empresaId) {
      setContratoSelecionado(null)
      return
    }

    setBuscandoContrato(true)
    try {
      const contrato = await notasFiscaisService.getContratoPorCliente(empresaId)
      setContratoSelecionado(contrato)

      if (contrato) {
        const valorContrato = Number(contrato.valor_parcela) || 0
        const diaVenc = contrato.dia_vencimento || 10

        // Calcula data de vencimento no mês corrente ou seguinte
        const hoje = new Date()
        let anoVenc = hoje.getFullYear()
        let mesVenc = hoje.getMonth() + 1
        if (hoje.getDate() > diaVenc) {
          mesVenc += 1
          if (mesVenc > 12) {
            mesVenc = 1
            anoVenc += 1
          }
        }
        const dataVencStr = `${anoVenc}-${String(mesVenc).padStart(2, '0')}-${String(diaVenc).padStart(2, '0')}`

        const { valor_iss, valor_liquido } = recalcularValores(
          valorContrato,
          formData.aliquota_iss,
          formData.iss_retido,
          formData.valor_pis,
          formData.valor_cofins,
          formData.valor_inss,
          formData.valor_ir,
          formData.valor_csll,
          formData.outras_retencoes,
          formData.desconto_incondicionado,
        )

        setFormData((prev) => ({
          ...prev,
          contrato_id: contrato.id,
          valor_servicos: valorContrato,
          valor_iss,
          valor_liquido,
          vencimento: dataVencStr,
          discriminacao: `Prestação de serviços contábeis e assessoria financeira — Contrato de Consultoria nº ${contrato.id.slice(0, 6).toUpperCase()} (Parcela referente à competência vigente).`,
        }))

        toast({
          title: 'Contrato localizado!',
          description: `Valor (${formatBrlMoeda(valorContrato)}) e vencimento (${dataVencStr.split('-').reverse().join('/')}) preenchidos automaticamente.`,
        })
      } else {
        toast({
          title: 'Nenhum contrato ativo',
          description:
            'Não encontramos um contrato cadastrado para este cliente. Preencha os valores manualmente.',
        })
      }
    } catch (err) {
      console.error('Erro ao buscar contrato:', err)
    } finally {
      setBuscandoContrato(false)
    }
  }

  const handleFieldChange = (field: keyof NfseFormData, value: any) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value }

      // Se mexeu em valores ou alíquotas, recalcula
      if (
        [
          'valor_servicos',
          'aliquota_iss',
          'iss_retido',
          'valor_pis',
          'valor_cofins',
          'valor_inss',
          'valor_ir',
          'valor_csll',
          'outras_retencoes',
          'desconto_incondicionado',
        ].includes(field)
      ) {
        const { valor_iss, valor_liquido } = recalcularValores(
          Number(updated.valor_servicos) || 0,
          Number(updated.aliquota_iss) || 0,
          Boolean(updated.iss_retido),
          Number(updated.valor_pis) || 0,
          Number(updated.valor_cofins) || 0,
          Number(updated.valor_inss) || 0,
          Number(updated.valor_ir) || 0,
          Number(updated.valor_csll) || 0,
          Number(updated.outras_retencoes) || 0,
          Number(updated.desconto_incondicionado) || 0,
        )
        updated.valor_iss = valor_iss
        updated.valor_liquido = valor_liquido
      }

      return updated
    })
  }

  const openNewEmissaoModal = () => {
    setContratoSelecionado(null)
    setFormData({
      empresa_id: clientesHabilitados[0]?.id || '',
      contrato_id: '',
      numero: proximoNumeroSugerido,
      serie: '1',
      discriminacao:
        'Prestação de serviços contábeis, assessoria financeira e consultoria em gestão empresarial conforme contrato de prestação de serviços.',
      item_cnae: '6920-6/01',
      codigo_servico_municipal: '0107',
      natureza_operacao: '1',
      valor_servicos: 0,
      aliquota_iss: 5.0,
      valor_iss: 0,
      iss_retido: false,
      valor_pis: 0,
      valor_cofins: 0,
      valor_inss: 0,
      valor_ir: 0,
      valor_csll: 0,
      outras_retencoes: 0,
      desconto_incondicionado: 0,
      valor_liquido: 0,
      competencia: new Date().toISOString().slice(0, 10),
      vencimento: '',
      forcar_simulacao: false,
    })

    if (clientesHabilitados.length > 0) {
      handleSelectCliente(clientesHabilitados[0].id)
    }

    setModalEmissaoOpen(true)
  }

  const handleEmitirSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.empresa_id) {
      toast({
        variant: 'destructive',
        title: 'Selecione um cliente',
        description: 'É necessário selecionar um cliente habilitado para emitir a NFSe.',
      })
      return
    }

    if (!formData.valor_servicos || formData.valor_servicos <= 0) {
      toast({
        variant: 'destructive',
        title: 'Valor inválido',
        description: 'Informe um valor de serviços maior que zero.',
      })
      return
    }

    if (!formData.discriminacao.trim()) {
      toast({
        variant: 'destructive',
        title: 'Discriminação obrigatória',
        description: 'Descreva os serviços prestados na nota fiscal.',
      })
      return
    }

    setEmitindo(true)
    try {
      const input: EmitirNfseInput = {
        empresa_id: formData.empresa_id,
        contrato_id: formData.contrato_id || undefined,
        numero: Number(formData.numero) || undefined,
        serie: formData.serie || '1',
        discriminacao: formData.discriminacao.trim(),
        item_cnae: formData.item_cnae,
        codigo_servico_municipal: formData.codigo_servico_municipal,
        natureza_operacao: formData.natureza_operacao,
        valor_servicos: Number(formData.valor_servicos),
        aliquota_iss: Number(formData.aliquota_iss),
        valor_iss: Number(formData.valor_iss),
        iss_retido: Boolean(formData.iss_retido),
        valor_pis: Number(formData.valor_pis),
        valor_cofins: Number(formData.valor_cofins),
        valor_inss: Number(formData.valor_inss),
        valor_ir: Number(formData.valor_ir),
        valor_csll: Number(formData.valor_csll),
        outras_retencoes: Number(formData.outras_retencoes),
        desconto_incondicionado: Number(formData.desconto_incondicionado),
        valor_liquido: Number(formData.valor_liquido),
        competencia: formData.competencia,
        vencimento: formData.vencimento || undefined,
        forcar_simulacao: formData.forcar_simulacao,
      }

      const res = await notasFiscaisService.emitirNfse(input)

      if (res.success) {
        toast({
          title: 'NFSe emitida com sucesso!',
          description: res.message || `Nota fiscal nº ${formData.numero} gerada com sucesso.`,
        })
        setModalEmissaoOpen(false)
        await loadData()

        // Abre visualização da nota recém-emitida se tiver id
        if (res.nota?.id) {
          try {
            const notaEmitida = await notasFiscaisService.getById(res.nota.id)
            abrirVisualizacaoDanfse(notaEmitida)
          } catch {
            /* intentionally ignored */
          }
        }
      } else {
        toast({
          variant: 'destructive',
          title: 'Erro na emissão',
          description: res.message || 'Não foi possível emitir a NFSe.',
        })
      }
    } catch (err: any) {
      console.error('Erro ao emitir NFSe:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao emitir NFSe',
        description: err?.message || 'Ocorreu um erro no processamento da nota fiscal.',
      })
    } finally {
      setEmitindo(false)
    }
  }

  // Prepara dados do DANFSE para visualização/PDF
  const prepararDadosDanfseLegado = (nota: NotaFiscalRecord): DadosDanfse => {
    const empresaCliente = empresas.find((e) => e.id === nota.empresa) || nota.expand?.empresa

    return {
      nota: nota,
      prestador: {
        razaoSocial:
          nota.prestador_razao_social ||
          minhaEmpresa?.razao_social ||
          minhaEmpresa?.nome_fantasia ||
          'Consultoria Financeira',
        nomeFantasia: minhaEmpresa?.nome_fantasia,
        cnpj: nota.prestador_cnpj || minhaEmpresa?.cnpj || '00.000.000/0001-00',
        inscricaoMunicipal:
          nota.prestador_inscricao_municipal || minhaEmpresa?.inscricao_municipal || 'ISENTO',
        inscricaoEstadual: minhaEmpresa?.inscricao_estadual,
        endereco: minhaEmpresa?.logradouro
          ? `${minhaEmpresa.logradouro}, ${minhaEmpresa.numero || 'S/N'}${minhaEmpresa.bairro ? ` - ${minhaEmpresa.bairro}` : ''}`
          : 'Av. Paulista, 1000 - Bela Vista',
        cidade: minhaEmpresa?.cidade || 'São Paulo',
        estado: minhaEmpresa?.estado || 'SP',
        cep: minhaEmpresa?.cep || '01310-100',
        telefone: minhaEmpresa?.telefone_comercial || minhaEmpresa?.celular_whatsapp,
        email: minhaEmpresa?.email_financeiro || minhaEmpresa?.email_comercial,
        regimeTributario: minhaEmpresa?.regime_tributario || 'Simples Nacional',
      },
      tomador: {
        razaoSocial:
          nota.tomador_razao_social || empresaCliente?.nome || 'Cliente Tomador de Serviços',
        nomeFantasia: empresaCliente?.nome_fantasia,
        cnpj: nota.tomador_cnpj || empresaCliente?.cnpj || '00.000.000/0000-00',
        endereco: empresaCliente?.logradouro
          ? `${empresaCliente.logradouro}, ${empresaCliente.numero || 'S/N'}${empresaCliente.bairro ? ` - ${empresaCliente.bairro}` : ''}`
          : undefined,
        cidade: empresaCliente?.cidade,
        estado: empresaCliente?.estado,
        cep: empresaCliente?.cep,
        telefone: empresaCliente?.telefone,
        email: nota.tomador_email || empresaCliente?.email,
      },
    }
  }

  const abrirVisualizacaoDanfse = (nota: NotaFiscalRecord) => {
    setNotaVisualizando(nota)
    setModalDanfseOpen(true)
  }

  const handleDownloadXmlDirect = (nota: NotaFiscalRecord) => {
    const dados = prepararDadosDanfseLegado(nota)
    const xml = nota.xml_conteudo || gerarXmlNfse(dados)
    downloadArquivo(
      `NFSe_Nacional_${nota.numero}_${(dados.prestador.cnpj || 'prestador').replace(/\D/g, '')}.xml`,
      xml,
      'application/xml',
    )
    toast({
      title: 'Download iniciado',
      description: `Arquivo XML da NFS-e nº ${nota.numero} baixado com sucesso.`,
    })
  }

  const abrirModalCancelar = (nota: NotaFiscalRecord) => {
    if (nota.status === 'Cancelada') {
      toast({
        variant: 'destructive',
        title: 'Nota já cancelada',
        description: 'Esta nota fiscal já se encontra no status Cancelada.',
      })
      return
    }
    if (nota.status === 'Rascunho') {
      toast({
        title: 'Nota em Rascunho',
        description: 'Notas em rascunho podem ser excluídas diretamente no botão de lixeira.',
      })
      return
    }
    setNotaParaCancelar(nota)
    setMotivoCancelamento('')
    setCodigoCancelamento('1')
    setCancelarModalOpen(true)
  }

  const handleCancelarSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!notaParaCancelar) return

    if (!motivoCancelamento || !motivoCancelamento.trim()) {
      toast({
        variant: 'destructive',
        title: 'Motivo obrigatório',
        description: 'Por favor, informe a justificativa detalhada para o cancelamento.',
      })
      return
    }

    setCancelando(true)
    try {
      const res = await notasFiscaisService.cancelar({
        notaId: notaParaCancelar.id,
        motivo: motivoCancelamento.trim(),
        codigoCancelamento,
      })

      if (res.success) {
        toast({
          title: 'NFS-e cancelada com sucesso!',
          description:
            res.message ||
            `Nota nº ${notaParaCancelar.numero} cancelada junto ao gateway/SEFAZ (ABRASF).`,
        })
        setCancelarModalOpen(false)
        setNotaParaCancelar(null)
        setMotivoCancelamento('')
        await loadData()
      } else {
        toast({
          variant: 'destructive',
          title: 'Falha no cancelamento',
          description: res.message || 'Não foi possível cancelar a nota fiscal.',
        })
      }
    } catch (err: any) {
      console.error('Erro ao cancelar NFS-e:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao cancelar NFS-e',
        description:
          err?.message || 'Ocorreu um erro ao comunicar o cancelamento com o gateway NFSe.',
      })
    } finally {
      setCancelando(false)
    }
  }

  const abrirModalEmail = (nota: NotaFiscalRecord) => {
    if (nota.status === 'Cancelada') {
      toast({
        variant: 'destructive',
        title: 'Nota Cancelada',
        description:
          'Esta nota fiscal está CANCELADA e não pode ser reenviada por e-mail como documento válido.',
      })
      return
    }

    const empresaCliente = empresas.find((e) => e.id === nota.empresa) || nota.expand?.empresa
    const isDebitoCredito = nota.tipo_documento === 'Debito' || nota.tipo_documento === 'Credito'
    const docTitulo = isDebitoCredito
      ? `Nota de ${nota.tipo_documento === 'Debito' ? 'Débito' : 'Crédito'} de Ajuste`
      : 'Nota Fiscal Eletrônica'

    setNotaParaEmail(nota)
    setEmailDestinatarioInput(nota.tomador_email || empresaCliente?.email || '')
    setEmailMensagemInput(
      `Olá, ${nota.tomador_razao_social || empresaCliente?.nome || 'Cliente'},\n\nSegue o documento auxiliar da ${docTitulo} nº ${nota.numero} referente à prestação de serviços.\n\nValor: ${formatBrlMoeda(nota.valor_liquido)}\nCódigo de Verificação: ${nota.codigo_verificacao || 'N/A'}\n\nAtenciosamente,\n${minhaEmpresa?.razao_social || 'Gestão Financeira'}`,
    )
    setModalEmailOpen(true)
  }

  const handleEnviarEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!notaParaEmail) return

    if (!emailDestinatarioInput || !emailDestinatarioInput.includes('@')) {
      toast({
        variant: 'destructive',
        title: 'E-mail inválido',
        description: 'Informe um endereço de e-mail válido para o destinatário.',
      })
      return
    }

    setEnviandoEmail(true)
    try {
      const res = await notasFiscaisService.enviarEmail({
        nota_id: notaParaEmail.id,
        destinatario_email: emailDestinatarioInput.trim(),
        mensagem_personalizada: emailMensagemInput.trim(),
      })

      if (res.success) {
        toast({
          title: 'E-mail enviado com sucesso!',
          description: `Nota Fiscal nº ${notaParaEmail.numero} enviada para ${emailDestinatarioInput}.`,
        })
        setModalEmailOpen(false)
        setNotaParaEmail(null)
        loadData()
      } else {
        toast({
          variant: 'destructive',
          title: 'Falha no envio de e-mail',
          description: res.message || 'Verifique as configurações de e-mail do sistema.',
        })
      }
    } catch (err: any) {
      console.error('Erro ao enviar e-mail:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao enviar e-mail',
        description:
          err?.message ||
          'Não foi possível disparar o e-mail transacional. Verifique a configuração de SMTP.',
      })
    } finally {
      setEnviandoEmail(false)
    }
  }

  const confirmDeleteNota = (nota: NotaFiscalRecord) => {
    setNotaParaExcluir(nota)
    setDeleteConfirmOpen(true)
  }

  const handleDeleteNota = async () => {
    if (!notaParaExcluir) return
    setExcluindo(true)
    try {
      await notasFiscaisService.excluir(notaParaExcluir.id)
      toast({
        title: 'Nota fiscal removida',
        description: `O registro da NFS-e nº ${notaParaExcluir.numero} foi excluído.`,
      })
      setDeleteConfirmOpen(false)
      setNotaParaExcluir(null)
      loadData()
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir nota',
        description: err?.message || 'Não foi possível excluir o registro.',
      })
    } finally {
      setExcluindo(false)
    }
  }

  // Filtragem da lista
  const filteredNotas = notas.filter((n) => {
    const q = searchFilter.toLowerCase()
    const matchBusca =
      String(n.numero).includes(q) ||
      (n.tomador_razao_social || '').toLowerCase().includes(q) ||
      (n.tomador_cnpj || '').includes(q) ||
      (n.discriminacao || '').toLowerCase().includes(q) ||
      (n.codigo_verificacao || '').toLowerCase().includes(q) ||
      (n.chave_acesso || '').toLowerCase().includes(q)

    const matchStatus = statusFilter === 'todos' || n.status === statusFilter

    return matchBusca && matchStatus
  })

  // Totais informativos
  const totalFaturado = notas
    .filter((n) => n.status === 'Emitida' || n.status === 'Enviada')
    .reduce((acc, n) => acc + (Number(n.valor_liquido) || 0), 0)

  const totalEmitidas = notas.filter((n) => n.status === 'Emitida' || n.status === 'Enviada').length
  const totalEnviadasEmail = notas.filter((n) => n.status === 'Enviada').length
  const totalCanceladas = notas.filter((n) => n.status === 'Cancelada').length

  // Exportar dados filtrados no formato CSV Nacional DPS
  const exportarCsvNacional = () => {
    if (filteredNotas.length === 0) {
      toast({
        title: 'Nenhuma nota',
        description: 'Não há notas no filtro atual para exportar.',
        variant: 'destructive',
      })
      return
    }

    const cabecalho = [
      'Numero_NFSe',
      'Serie_DPS',
      'Numero_DPS',
      'Chave_Acesso_Nacional',
      'Status',
      'Ambiente',
      'Data_Emissao',
      'Competencia',
      'Prestador_Razao_Social',
      'Prestador_CNPJ',
      'Tomador_Razao_Social',
      'Tomador_CPF_CNPJ',
      'Valor_Servicos',
      'Aliquota_ISS',
      'Valor_ISS',
      'ISS_Retido',
      'Valor_PIS',
      'Valor_COFINS',
      'Valor_INSS',
      'Valor_IR',
      'Valor_CSLL',
      'Outras_Retencoes',
      'Valor_Liquido',
      'Codigo_Tributacao_Nacional',
      'Protocolo_Autorizacao',
      'Discriminacao',
    ].join(';')

    const linhas = filteredNotas.map((n) =>
      [
        n.numero,
        `"${n.dps_serie || n.serie || '1'}"`,
        n.dps_numero || n.numero,
        `"${n.chave_acesso || ''}"`,
        n.status,
        `"${n.tipo_ambiente || n.modo_emissao || 'Homologação'}"`,
        n.data_emissao ? n.data_emissao.slice(0, 10) : '',
        n.competencia ? n.competencia.slice(0, 10) : '',
        `"${n.prestador_razao_social || 'Borlim Consultoria'}"`,
        `"${n.prestador_cnpj || ''}"`,
        `"${n.tomador_razao_social || n.expand?.empresa?.nome || ''}"`,
        `"${n.tomador_cnpj || ''}"`,
        n.valor_servicos?.toFixed(2) || '0.00',
        n.aliquota_iss?.toFixed(2) || '0.00',
        n.valor_iss?.toFixed(2) || '0.00',
        n.iss_retido ? 'SIM' : 'NAO',
        n.valor_pis?.toFixed(2) || '0.00',
        n.valor_cofins?.toFixed(2) || '0.00',
        n.valor_inss?.toFixed(2) || '0.00',
        n.valor_ir?.toFixed(2) || '0.00',
        n.valor_csll?.toFixed(2) || '0.00',
        n.outras_retencoes?.toFixed(2) || '0.00',
        n.valor_liquido?.toFixed(2) || '0.00',
        `"${n.codigo_tributacao_nacional || '010701'}"`,
        `"${n.protocolo_autorizacao || ''}"`,
        `"${(n.discriminacao || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`,
      ].join(';'),
    )

    const conteudoCsv = [cabecalho, ...linhas].join('\n')
    downloadArquivo(
      `nfse_nacional_dps_${new Date().toISOString().slice(0, 10)}.csv`,
      conteudoCsv,
      'text/csv;charset=utf-8;',
    )
    toast({
      title: 'Exportação concluída',
      description: `${filteredNotas.length} notas exportadas para CSV no layout oficial DPS Nacional.`,
    })
  }

  const getStatusBadge = (status: StatusNotaFiscal) => {
    switch (status) {
      case 'Emitida':
        return (
          <Badge className="bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200 text-[10px] font-semibold">
            <CheckCircle2 className="w-3 h-3 mr-1" /> Emitida
          </Badge>
        )
      case 'Substituída':
        return (
          <Badge className="bg-amber-50 text-amber-800 hover:bg-amber-100 border-amber-300 text-[10px] font-semibold">
            <AlertCircle className="w-3 h-3 mr-1 text-amber-600" /> Substituída
          </Badge>
        )
      case 'Enviada':
        return (
          <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200 text-[10px] font-semibold">
            <Mail className="w-3 h-3 mr-1" /> Enviada por E-mail
          </Badge>
        )
      case 'Rascunho':
        return (
          <Badge className="bg-slate-100 text-slate-700 border-slate-200 text-[10px] font-semibold">
            <Clock className="w-3 h-3 mr-1" /> Rascunho
          </Badge>
        )
      case 'Cancelada':
        return (
          <Badge className="bg-rose-50 text-rose-700 border-rose-200 text-[10px] font-semibold">
            Cancelada
          </Badge>
        )
      case 'Erro':
        return (
          <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] font-semibold">
            <AlertCircle className="w-3 h-3 mr-1" /> Erro
          </Badge>
        )
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const handleAbrirReemissaoCorrigida = (nota: NotaFiscalRecord) => {
    if (nota.status !== 'Emitida') {
      toast({
        variant: 'destructive',
        title: 'Ação não permitida',
        description: 'Apenas notas com status "Emitida" podem ser reemitidas por correção.',
      })
      return
    }
    setNotaParaSubstituir(nota)
    setModalNacionalOpen(true)
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#0B1F3A] tracking-tight flex items-center gap-2">
            <FileText className="w-6 h-6 text-blue-600" />
            Emissor de Nota Fiscal de Serviços (NFS-e)
          </h1>
          <p className="text-xs text-[#5B6B7F]">
            Emissão eletrônica, validação SEFAZ/Gateway, geração de DANFSE em PDF/XML e envio direto
            por e-mail
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Botão de Gestão de Tomadores */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setModalTomadoresOpen(true)}
            className="text-xs font-semibold text-slate-700 bg-white border-slate-200 hover:border-blue-300 hover:text-blue-700 shadow-2xs gap-1.5 h-9"
          >
            <Users className="w-4 h-4 text-primary" />
            Tomadores de Serviços
          </Button>

          {/* Botão de Configurações do Padrão Nacional / DPS */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setModalConfigNacionalOpen(true)}
            className="text-xs font-semibold text-slate-700 bg-white border-slate-200 hover:border-blue-300 hover:text-blue-700 shadow-2xs gap-1.5 h-9"
            title="Configurações de Série, Numeração e Certificado Digital"
          >
            <Settings className="w-4 h-4 text-slate-600" />
            Série & DPS
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={exportarCsvNacional}
            className="text-xs font-semibold text-slate-700 bg-white border-slate-200 hover:border-blue-300 hover:text-blue-700 shadow-2xs gap-1.5 h-9"
            title="Exportar dados das notas filtradas para planilha CSV no padrão nacional"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            Exportar CSV
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setModalRelatorioTomadorOpen(true)}
            className="text-xs font-bold text-slate-700 bg-white border-slate-200 hover:border-blue-300 hover:text-blue-700 shadow-2xs gap-1.5 h-9"
            title="Relatório de notas por tomador (faturamento por cliente no período, ranking e parecer)"
          >
            <UserCheck className="w-4 h-4 text-indigo-600" />
            Relatório por Tomador
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setModalRelatorioOpen(true)}
            className="text-xs font-bold text-slate-700 bg-white border-slate-200 hover:border-blue-300 hover:text-blue-700 shadow-2xs gap-1.5 h-9"
            title="Relatório geral de notas fiscais emitidas no período"
          >
            <Printer className="w-4 h-4 text-blue-600" />
            Relatório A4
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loading}
            className="text-xs font-semibold h-9"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>

          {/* Botão de Emissão Principal: Novo Padrão Nacional DPS */}
          {podeEmitir ? (
            <Button
              onClick={() => {
                setNotaParaSubstituir(null)
                setModalNacionalOpen(true)
              }}
              className="bg-primary hover:bg-primary/90 text-white font-semibold text-xs h-9 shadow-sm gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Emitir NFS-e Nacional (DPS)
            </Button>
          ) : (
            <Badge variant="outline" className="text-slate-500 text-xs px-2.5 py-1.5 bg-slate-50">
              Modo Consulta (Financeiro)
            </Badge>
          )}
        </div>
      </div>

      {/* Banner de Status do Novo Padrão Nacional NFS-e / DPS */}
      <div className="border border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-900 rounded-lg p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-primary text-white flex items-center justify-center font-bold text-xs shrink-0">
            DPS
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-[#0B1F3A] dark:text-blue-200">
                Padrão Nacional NFS-e 2.0 (DPS 2.0 / Layout 2.0 SEFIN)
              </span>
              <Badge className="bg-indigo-600 text-white text-[10px] font-semibold">
                Padrão NFS-e Nacional 2.0
              </Badge>
              <Badge
                variant="outline"
                className="text-[10px] border-amber-500 bg-amber-50 text-amber-800 dark:bg-amber-950/40"
              >
                Modo Homologação / Simulação
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Layout 2.0 unificado com alimentação automática do Código IBGE de Minha Empresa,
              controle de DPS e DANFSE oficial.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setModalConfigNacionalOpen(true)}
            className="h-7 text-xs text-primary hover:text-primary/80 font-medium"
          >
            Configurar Série & Ambiente →
          </Button>
        </div>
      </div>

      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-white border-slate-200 shadow-2xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase">
                Faturamento Total Emitido
              </p>
              <h3 className="text-xl font-bold text-slate-900 mt-1">
                {formatBrlMoeda(totalFaturado)}
              </h3>
              <p className="text-[10px] text-emerald-600 font-medium mt-0.5">
                {totalEmitidas} nota(s) fiscal(is) gerada(s)
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <DollarSign className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200 shadow-2xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase">
                Clientes Habilitados
              </p>
              <h3 className="text-xl font-bold text-slate-900 mt-1">
                {clientesHabilitados.length}{' '}
                <span className="text-xs font-normal text-slate-500">de {empresas.length}</span>
              </h3>
              <p className="text-[10px] text-slate-500 mt-0.5">Com flag "Emitir NFSe = SIM"</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <Building className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200 shadow-2xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase">
                Enviadas por E-mail
              </p>
              <h3 className="text-xl font-bold text-slate-900 mt-1">{totalEnviadasEmail}</h3>
              <p className="text-[10px] text-slate-500 mt-0.5">Comprovantes e PDF entregues</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <Mail className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Notas Fiscais Emitidas */}
      <Card className="bg-white border-slate-200 shadow-2xs">
        <CardHeader className="pb-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Notas Fiscais Emitidas ({filteredNotas.length})
            </CardTitle>
            <CardDescription className="text-xs">
              Histórico de NFS-e transmitidas, validadas, arquivos XML e controle de envio por
              e-mail
            </CardDescription>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 text-xs w-[130px] bg-slate-50">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos" className="text-xs">
                  Todos os Status
                </SelectItem>
                <SelectItem value="Emitida" className="text-xs">
                  Emitidas
                </SelectItem>
                <SelectItem value="Substituída" className="text-xs">
                  Substituídas
                </SelectItem>
                <SelectItem value="Enviada" className="text-xs">
                  Enviadas
                </SelectItem>
                <SelectItem value="Rascunho" className="text-xs">
                  Rascunho
                </SelectItem>
                <SelectItem value="Cancelada" className="text-xs">
                  Canceladas
                </SelectItem>
              </SelectContent>
            </Select>

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                type="text"
                placeholder="Buscar por nº, cliente, CNPJ..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="pl-8 h-8 text-xs bg-slate-50 border-slate-200 focus:bg-white"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 flex justify-center items-center">
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredNotas.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500 space-y-2">
              <FileText className="w-8 h-8 text-slate-300 mx-auto" />
              <p>
                {searchFilter
                  ? 'Nenhuma nota fiscal encontrada para os filtros selecionados.'
                  : 'Nenhuma nota fiscal emitida ainda. Clique em "Emitir Nova NFS-e" para começar.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 font-semibold">
                    <th className="py-3 px-4">Nº / Série</th>
                    <th className="py-3 px-4">Emissão</th>
                    <th className="py-3 px-4">Tomador (Cliente)</th>
                    <th className="py-3 px-4">CNPJ</th>
                    <th className="py-3 px-4 text-right">Valor Serviços</th>
                    <th className="py-3 px-4 text-right">Valor Líquido</th>
                    <th className="py-3 px-4 text-center">Conciliação</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredNotas.map((nota) => {
                    const dtEmissao = nota.data_emissao
                      ? new Date(nota.data_emissao).toLocaleDateString('pt-BR')
                      : '—'

                    return (
                      <tr key={nota.id} className="hover:bg-slate-50/80 transition-colors group">
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900 flex items-center gap-1.5">
                            <span className="text-blue-600 font-mono">#{nota.numero}</span>
                            <span className="text-[10px] text-slate-400 font-normal">
                              (Série {nota.serie || '1'})
                            </span>
                            {nota.tipo_documento === 'Debito' && (
                              <Badge className="text-[9px] bg-amber-100 text-amber-900 border-amber-300 font-bold px-1.5 py-0">
                                <TrendingUp className="w-2.5 h-2.5 mr-0.5 inline" /> Débito
                              </Badge>
                            )}
                            {nota.tipo_documento === 'Credito' && (
                              <Badge className="text-[9px] bg-purple-100 text-purple-900 border-purple-300 font-bold px-1.5 py-0">
                                <TrendingDown className="w-2.5 h-2.5 mr-0.5 inline" /> Crédito
                              </Badge>
                            )}
                          </div>
                          {nota.codigo_verificacao && (
                            <span className="text-[10px] text-slate-500 font-mono block">
                              Cód: {nota.codigo_verificacao}
                            </span>
                          )}
                          {/* Legenda de substituição se houver */}
                          {(nota.nota_substituida || nota.expand?.nota_substituida) && (
                            <span
                              className="text-[10px] text-amber-700 dark:text-amber-400 font-medium block truncate max-w-[210px] bg-amber-50 dark:bg-amber-950/30 px-1 py-0.5 rounded mt-0.5"
                              title={`Substitui NFS-e nº ${nota.expand?.nota_substituida?.numero || nota.nota_substituida} (chave: ${nota.expand?.nota_substituida?.chave_acesso || ''})`}
                            >
                              ↳ Substitui NFS-e nº{' '}
                              {nota.expand?.nota_substituida?.numero || nota.nota_substituida}
                              {nota.expand?.nota_substituida?.chave_acesso
                                ? ` (chave ${nota.expand.nota_substituida.chave_acesso.slice(0, 8)}...)`
                                : ''}
                            </span>
                          )}
                          {nota.status === 'Cancelada' && nota.cancelada_em && (
                            <span
                              className="text-[10px] text-red-600 font-medium block truncate max-w-[180px]"
                              title={nota.motivo_cancelamento}
                            >
                              Canc: {new Date(nota.cancelada_em).toLocaleDateString('pt-BR')}{' '}
                              {nota.motivo_cancelamento ? `• ${nota.motivo_cancelamento}` : ''}
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-slate-600 whitespace-nowrap">{dtEmissao}</td>

                        <td className="py-3 px-4 font-medium text-slate-900 max-w-[200px] truncate">
                          {nota.tomador_razao_social || nota.expand?.empresa?.nome || 'Cliente'}
                          {nota.tomador_email && (
                            <span className="text-[10px] text-slate-400 block truncate">
                              {nota.tomador_email}
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">
                          {formatCnpj(nota.tomador_cnpj || nota.expand?.empresa?.cnpj || '')}
                        </td>

                        <td className="py-3 px-4 text-right text-slate-700 font-medium whitespace-nowrap">
                          {formatBrlMoeda(nota.valor_servicos)}
                        </td>

                        <td className="py-3 px-4 text-right font-bold text-emerald-700 whitespace-nowrap">
                          {formatBrlMoeda(nota.valor_liquido)}
                        </td>

                        {/* Conciliação (nota ↔ parcela) & Vínculo com Lançamento */}
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <div className="flex flex-col items-center gap-1">
                            {nota.conciliada ? (
                              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-semibold gap-1 px-2 py-0.5">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                Conciliada
                              </Badge>
                            ) : nota.recebivel ? (
                              <Badge
                                variant="outline"
                                className="text-[10px] text-blue-700 border-blue-200 bg-blue-50/50 gap-1 px-1.5 py-0"
                              >
                                <Link2 className="w-3 h-3 text-blue-500" />
                                Vinculada
                              </Badge>
                            ) : (
                              <span className="text-[11px] text-slate-400">—</span>
                            )}
                            {/* Badge/Link Lançamento Gerado no histórico financeiro */}
                            {nota.lancamento_ref && (
                              <Link
                                to="/lancamentos"
                                className="inline-flex items-center gap-1 text-[9px] font-medium text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-1.5 py-0.2 rounded transition-colors"
                                title="Ver lançamento contábil em Lançamentos Rápidos"
                              >
                                <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                                Lançamento gerado
                              </Link>
                            )}
                          </div>
                          {nota.agendamento_automatico && (
                            <div className="text-[9px] text-slate-400 flex items-center justify-center gap-0.5 mt-0.5">
                              <CalendarClock className="w-2.5 h-2.5 text-blue-500" /> Auto
                            </div>
                          )}
                        </td>

                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          {getStatusBadge(nota.status)}
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => abrirVisualizacaoDanfse(nota)}
                              className="h-7 px-2 text-[11px] font-semibold border-slate-200 hover:border-blue-300 hover:text-blue-600 bg-white"
                              title="Visualizar DANFSE / Imprimir PDF"
                            >
                              <Eye className="w-3.5 h-3.5 mr-1 text-blue-600" /> Ver PDF
                            </Button>

                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDownloadXmlDirect(nota)}
                              className="h-7 w-7 p-0 text-slate-600 hover:text-blue-600 hover:bg-blue-50"
                              title="Baixar XML da NFS-e"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </Button>

                            {/* Ação "Reemitir corrigida" APENAS para notas com status 'Emitida' e perfil com permissão de emitir */}
                            {nota.status === 'Emitida' && podeEmitir && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleAbrirReemissaoCorrigida(nota)}
                                className="h-7 px-2 text-[11px] font-semibold border-amber-300 text-amber-800 hover:bg-amber-50 hover:text-amber-900 bg-white"
                                title="Reemitir corrigida (substituição desta nota com novo sequencial DPS e sem duplicar lançamento)"
                              >
                                <RefreshCw className="w-3 h-3 mr-1 text-amber-600" /> Reemitir
                                corrigida
                              </Button>
                            )}

                            {/* Botão de Cancelar NFSe (apenas para Emitida / Enviada) */}
                            {(nota.status === 'Emitida' || nota.status === 'Enviada') &&
                              podeEmitir && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => abrirModalCancelar(nota)}
                                  className="h-7 px-1.5 text-[11px] font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                                  title="Cancelar Nota Fiscal no Gateway/SEFAZ"
                                >
                                  <Ban className="w-3.5 h-3.5 mr-1" /> Cancelar
                                </Button>
                              )}

                            {/* Botão de Envio por E-mail (desabilitado se Cancelada) */}
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={nota.status === 'Cancelada'}
                              onClick={() => abrirModalEmail(nota)}
                              className={`h-7 w-7 p-0 ${
                                nota.status === 'Cancelada'
                                  ? 'text-slate-300 cursor-not-allowed'
                                  : 'text-slate-600 hover:text-emerald-600 hover:bg-emerald-50'
                              }`}
                              title={
                                nota.status === 'Cancelada'
                                  ? 'Nota cancelada não pode ser reenviada'
                                  : 'Enviar por E-mail ao cliente'
                              }
                            >
                              <Mail className="w-3.5 h-3.5" />
                            </Button>

                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => confirmDeleteNota(nota)}
                              className="h-7 w-7 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50"
                              title="Excluir registro"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de Emissão de NFS-e */}
      <Dialog open={modalEmissaoOpen} onOpenChange={setModalEmissaoOpen}>
        <DialogContent className="sm:max-w-[860px] bg-white max-h-[92vh] overflow-y-auto">
          <form onSubmit={handleEmitirSubmit}>
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-[#0B1F3A] flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                Emissão de Nota Fiscal de Serviços Eletrônica (NFS-e)
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Selecione o cliente habilitado. O valor e o vencimento são carregados
                automaticamente do contrato vigente.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5 py-4">
              {/* 1. Seleção do Tomador / Cliente Habilitado */}
              <fieldset className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-200 space-y-3">
                <legend className="flex items-center gap-1.5 text-xs font-bold text-[#0B1F3A] uppercase tracking-wide px-1">
                  <Building className="w-3.5 h-3.5 text-blue-600" /> 1. Tomador dos Serviços
                  (Cliente)
                </legend>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-xs font-semibold text-slate-700">
                      Cliente Habilitado (Emitir Nota Fiscal = SIM) *
                    </Label>
                    <Select value={formData.empresa_id} onValueChange={handleSelectCliente}>
                      <SelectTrigger className="h-9 text-xs bg-white border-slate-300">
                        <SelectValue placeholder="Selecione o cliente para emissão" />
                      </SelectTrigger>
                      <SelectContent>
                        {clientesHabilitados.map((cli) => (
                          <SelectItem key={cli.id} value={cli.id} className="text-xs">
                            {cli.nome} ({formatCnpj(cli.cnpj)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {contratoSelecionado && (
                    <div className="sm:col-span-2 bg-emerald-50 border border-emerald-200 p-2.5 rounded-lg text-xs text-emerald-900 flex items-center justify-between">
                      <div className="space-y-0.5">
                        <p className="font-bold text-emerald-950 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          Contrato Vinculado: {formatBrlMoeda(
                            contratoSelecionado.valor_parcela,
                          )} /
                          mês
                        </p>
                        <p className="text-[11px] text-emerald-800">
                          Dia de vencimento: todo dia {contratoSelecionado.dia_vencimento} · Prazo
                          total: {contratoSelecionado.quantidade_meses} meses
                        </p>
                      </div>
                      <Badge className="bg-emerald-600 text-white text-[10px]">
                        Contrato Ativo
                      </Badge>
                    </div>
                  )}
                </div>
              </fieldset>

              {/* 2. Dados do Prestador (Minha Empresa) */}
              <fieldset className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-200 space-y-2">
                <legend className="flex items-center gap-1.5 text-xs font-bold text-[#0B1F3A] uppercase tracking-wide px-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-600" /> 2. Prestador de Serviços
                  (Minha Empresa)
                </legend>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500 block text-[11px]">Razão Social:</span>
                    <strong className="text-slate-900 font-semibold">
                      {minhaEmpresa?.razao_social || minhaEmpresa?.nome_fantasia || 'Minha Empresa'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">CNPJ:</span>
                    <span className="font-mono text-slate-800">
                      {formatCnpj(minhaEmpresa?.cnpj || '')}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Regime Tributário:</span>
                    <span className="text-slate-800 font-medium">
                      {minhaEmpresa?.regime_tributario || 'Simples Nacional'}
                    </span>
                  </div>
                </div>
              </fieldset>

              {/* 3. Dados da Nota Fiscal e Tributação */}
              <fieldset className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-200 space-y-3">
                <legend className="flex items-center gap-1.5 text-xs font-bold text-[#0B1F3A] uppercase tracking-wide px-1">
                  <FileText className="w-3.5 h-3.5 text-blue-600" /> 3. Detalhes do Serviço &
                  Valores
                </legend>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-slate-700">Número da NFS-e</Label>
                    <Input
                      type="number"
                      value={formData.numero}
                      onChange={(e) => handleFieldChange('numero', Number(e.target.value))}
                      className="h-8 text-xs font-mono font-semibold"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-slate-700">Série</Label>
                    <Input
                      type="text"
                      value={formData.serie}
                      onChange={(e) => handleFieldChange('serie', e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-slate-700">Competência</Label>
                    <Input
                      type="date"
                      value={formData.competencia}
                      onChange={(e) => handleFieldChange('competencia', e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-slate-700">
                      Vencimento da Parcela
                    </Label>
                    <Input
                      type="date"
                      value={formData.vencimento}
                      onChange={(e) => handleFieldChange('vencimento', e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-slate-700">
                      Código CNAE / Atividade
                    </Label>
                    <Input
                      type="text"
                      value={formData.item_cnae}
                      onChange={(e) => handleFieldChange('item_cnae', e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-slate-700">
                      Cód. Tributação Município
                    </Label>
                    <Input
                      type="text"
                      value={formData.codigo_servico_municipal}
                      onChange={(e) =>
                        handleFieldChange('codigo_servico_municipal', e.target.value)
                      }
                      className="h-8 text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700">
                    Discriminação dos Serviços *
                  </Label>
                  <Textarea
                    value={formData.discriminacao}
                    onChange={(e) => handleFieldChange('discriminacao', e.target.value)}
                    rows={3}
                    className="text-xs font-mono"
                    placeholder="Descreva detalhadamente a prestação dos serviços..."
                  />
                </div>

                {/* Bloco de Valores e Retenções */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <div className="space-y-1 bg-white p-2.5 rounded-lg border border-slate-200">
                    <Label className="text-xs font-bold text-slate-900">
                      Valor dos Serviços (R$) *
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.valor_servicos}
                      onChange={(e) => handleFieldChange('valor_servicos', Number(e.target.value))}
                      className="h-9 text-xs font-bold text-blue-700 font-mono"
                    />
                  </div>

                  <div className="space-y-1 bg-white p-2.5 rounded-lg border border-slate-200">
                    <Label className="text-xs font-semibold text-slate-700">Alíquota ISS (%)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.aliquota_iss}
                      onChange={(e) => handleFieldChange('aliquota_iss', Number(e.target.value))}
                      className="h-9 text-xs font-mono"
                    />
                  </div>

                  <div className="space-y-1 bg-emerald-50/80 p-2.5 rounded-lg border border-emerald-200">
                    <Label className="text-xs font-black text-emerald-950 uppercase">
                      Valor Líquido da Nota
                    </Label>
                    <div className="h-9 flex items-center font-black text-base text-emerald-700 font-mono">
                      {formatBrlMoeda(formData.valor_liquido)}
                    </div>
                  </div>
                </div>
              </fieldset>

              {/* Gateway NFSe e SEFAZ */}
              <div className="bg-blue-50/60 border border-blue-200 p-3.5 rounded-xl text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-blue-950">
                    <ShieldCheck className="w-4 h-4 text-blue-600" />
                    Transmissão e Validação via Gateway NFSe / SEFAZ
                  </div>
                  <Badge
                    variant="outline"
                    className="text-[10px] bg-white border-blue-300 text-blue-800"
                  >
                    Padrão SEFAZ / ABRASF
                  </Badge>
                </div>
                <p className="text-[11px] text-blue-900 leading-relaxed">
                  A emissão validará a estrutura tributária, gerará a Chave de Acesso e Código de
                  Verificação oficiais e disponibilizará o download do <strong>XML</strong> e do{' '}
                  <strong>PDF da NFS-e</strong>.
                </p>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 sticky bottom-0 bg-white pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalEmissaoOpen(false)}
                disabled={emitindo}
                className="text-xs h-9"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={emitindo || clientesHabilitados.length === 0}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-9 shadow-xs"
              >
                {emitindo ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Validando e Emitindo na SEFAZ...
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5 mr-1.5" />
                    Emitir e Validar NFS-e
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal de Envio por E-mail */}
      <Dialog open={modalEmailOpen} onOpenChange={setModalEmailOpen}>
        <DialogContent className="sm:max-w-[540px] bg-white">
          <form onSubmit={handleEnviarEmailSubmit}>
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-[#0B1F3A] flex items-center gap-2">
                <Mail className="w-4 h-4 text-emerald-600" />
                Enviar Nota Fiscal por E-mail
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Dispara o e-mail transacional com os dados da NFS-e nº {notaParaEmail?.numero} e o
                espelho da nota diretamente para o cliente.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">
                  E-mail do Destinatário *
                </Label>
                <Input
                  type="email"
                  value={emailDestinatarioInput}
                  onChange={(e) => setEmailDestinatarioInput(e.target.value)}
                  placeholder="cliente@empresa.com.br"
                  className="h-9 text-xs"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">
                  Mensagem no Corpo do E-mail
                </Label>
                <Textarea
                  value={emailMensagemInput}
                  onChange={(e) => setEmailMensagemInput(e.target.value)}
                  rows={5}
                  className="text-xs font-mono leading-relaxed"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalEmailOpen(false)}
                disabled={enviandoEmail}
                className="text-xs h-9"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={enviandoEmail}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-9 shadow-xs"
              >
                {enviandoEmail ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Enviando e-mail...
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5 mr-1.5" />
                    Enviar NFS-e Agora
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal de Cancelamento de NFSe */}
      <Dialog open={cancelarModalOpen} onOpenChange={setCancelarModalOpen}>
        <DialogContent className="sm:max-w-[560px] bg-white">
          <form onSubmit={handleCancelarSubmit}>
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-rose-700 flex items-center gap-2">
                <Ban className="w-5 h-5 text-rose-600" />
                Cancelamento de NFS-e via Gateway / SEFAZ
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-600">
                Você está prestes a cancelar a NFS-e nº{' '}
                <strong className="text-slate-900 font-bold">
                  #{notaParaCancelar?.numero}
                </strong>{' '}
                emitida para{' '}
                <strong className="text-slate-900 font-semibold">
                  {notaParaCancelar?.tomador_razao_social || 'Cliente'}
                </strong>{' '}
                no valor de{' '}
                <strong className="text-slate-900 font-mono">
                  {formatBrlMoeda(notaParaCancelar?.valor_liquido)}
                </strong>
                .
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-3">
              <Alert className="bg-amber-50 border-amber-200 text-amber-900">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <AlertTitle className="text-xs font-bold">Atenção ao Cancelamento</AlertTitle>
                <AlertDescription className="text-[11px] text-amber-800 leading-relaxed">
                  O cancelamento transmitirá um evento oficial no padrão{' '}
                  <strong>ABRASF v2.03</strong> junto à SEFAZ/Gateway Municipal. Após cancelada, a
                  nota não poderá ser revertida nem reenviada por e-mail como documento válido.
                </AlertDescription>
              </Alert>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">
                  Código de Cancelamento ABRASF *
                </Label>
                <Select value={codigoCancelamento} onValueChange={setCodigoCancelamento}>
                  <SelectTrigger className="h-9 text-xs bg-white border-slate-300">
                    <SelectValue placeholder="Selecione o motivo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1" className="text-xs">
                      1 — Erro na Emissão de Dados / Valores
                    </SelectItem>
                    <SelectItem value="2" className="text-xs">
                      2 — Serviço Não Prestado ou Cancelamento de Contrato
                    </SelectItem>
                    <SelectItem value="3" className="text-xs">
                      3 — Duplicidade de Nota Fiscal
                    </SelectItem>
                    <SelectItem value="9" className="text-xs">
                      9 — Outros Motivos
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">
                  Justificativa / Motivo Obrigatório do Cancelamento *
                </Label>
                <Textarea
                  value={motivoCancelamento}
                  onChange={(e) => setMotivoCancelamento(e.target.value)}
                  placeholder="Descreva o motivo detalhado do cancelamento (ex: Erro no valor dos honorários conforme acordo com cliente, alteração contratual...)"
                  rows={4}
                  className="text-xs font-sans"
                  required
                />
                <p className="text-[10px] text-slate-400">
                  Este texto constará no pedido de cancelamento e ficará gravado no histórico da
                  nota fiscal.
                </p>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCancelarModalOpen(false)}
                disabled={cancelando}
                className="text-xs h-9"
              >
                Voltar
              </Button>
              <Button
                type="submit"
                disabled={cancelando || !motivoCancelamento.trim()}
                className="bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs h-9 shadow-xs"
              >
                {cancelando ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Transmitindo Cancelamento...
                  </>
                ) : (
                  <>
                    <Ban className="w-3.5 h-3.5 mr-1.5" />
                    Confirmar Cancelamento de NFS-e
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Visualizar DANFSE (PDF / A4 Nacional) */}
      {notaVisualizando && (
        <ModalVisualizarDanfse
          nota={notaVisualizando}
          open={modalDanfseOpen}
          onOpenChange={setModalDanfseOpen}
        />
      )}

      {/* Modal Relatório de Notas por Período */}
      <ModalRelatorioNotasPeriodo
        open={modalRelatorioOpen}
        onOpenChange={setModalRelatorioOpen}
        notas={notas}
        empresas={empresas}
        minhaEmpresa={minhaEmpresa}
      />

      {/* Modal Relatório de Notas por Tomador (Faturamento por Cliente no Período) */}
      <ModalRelatorioNotasPorTomador
        open={modalRelatorioTomadorOpen}
        onOpenChange={setModalRelatorioTomadorOpen}
        notas={notas}
        empresas={empresas}
        minhaEmpresa={minhaEmpresa}
        tomadoresCadastrados={tomadoresCadastrados}
        empresaAtivaId={selectedEmpresaId}
        anoAtivo={selectedAno}
        isUserAdminOuFinanceiro={isAdmin || user?.role === 'financeiro' || user?.role === 'empresa'}
      />

      {/* NOVO PADRÃO NACIONAL: Modal de Emissão Completa com Itens e DPS */}
      <ModalEmitirNfseNacional
        open={modalNacionalOpen}
        onOpenChange={(isOpen) => {
          setModalNacionalOpen(isOpen)
          if (!isOpen) {
            setNotaParaSubstituir(null)
          }
        }}
        empresaAtiva={
          notaParaSubstituir
            ? empresas.find((e) => e.id === notaParaSubstituir.empresa) || empresas[0] || null
            : empresas.find((e) => e.id === formData.empresa_id) || empresas[0] || null
        }
        empresasLista={empresas}
        seriePadrao={serieConfig}
        proximoNumeroPadrao={proximoNumeroSugerido}
        notaParaSubstituir={notaParaSubstituir}
        onEmitida={() => {
          setNotaParaSubstituir(null)
          loadData()
        }}
      />

      {/* NOVO PADRÃO NACIONAL: Gestão de Tomadores de Serviço */}
      <ModalGerenciarTomadores
        open={modalTomadoresOpen}
        onOpenChange={setModalTomadoresOpen}
        empresaId={formData.empresa_id || empresas[0]?.id || ''}
      />

      {/* NOVO PADRÃO NACIONAL: Configurações de Série, Numeração e Conexão */}
      <ModalConfiguracaoNfseNacional
        open={modalConfigNacionalOpen}
        onOpenChange={setModalConfigNacionalOpen}
        empresaId={
          formData.empresa_id ||
          selectedEmpresaId ||
          user?.empresa ||
          minhaEmpresa?.id ||
          empresas[0]?.id ||
          ''
        }
        serieAtual={serieConfig}
        proximoNumeroAtual={proximoNumeroSugerido}
        onSalvarSerieNumero={(serie, proxNum) => {
          setSerieConfig(serie)
          setProximoNumeroSugerido(proxNum)
          setFormData((prev) => ({ ...prev, serie, numero: proxNum }))
        }}
      />

      {/* Diálogo de Confirmação de Exclusão */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-red-600 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" /> Excluir Registro de Nota Fiscal?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-600">
              Tem certeza que deseja excluir o registro da NFS-e nº{' '}
              <strong className="text-slate-900 font-semibold">{notaParaExcluir?.numero}</strong> do
              cliente{' '}
              <strong className="text-slate-900">{notaParaExcluir?.tomador_razao_social}</strong>?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={excluindo} className="text-xs h-8">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteNota}
              disabled={excluindo}
              className="bg-red-600 hover:bg-red-700 text-white text-xs h-8 font-semibold"
            >
              {excluindo ? 'Excluindo...' : 'Sim, Excluir Nota'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
