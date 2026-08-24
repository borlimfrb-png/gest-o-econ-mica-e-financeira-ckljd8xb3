import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { empresasService } from '@/services/financeService'
import { minhaEmpresaService } from '@/services/minhaEmpresaService'
import { contratosService } from '@/services/contratosService'
import { recebiveisService, type ParcelaPreview } from '@/services/recebiveisService'
import { useMinhaEmpresa } from '@/contexts/MinhaEmpresaContext'
import { useToast } from '@/hooks/use-toast'
import useRealtime from '@/hooks/use-realtime'
import type { EmpresaRecord, MinhaEmpresaRecord, ContratoRecord } from '@/types/finance'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  FileSignature,
  Building,
  Building2,
  Calendar as CalendarIcon,
  Clock,
  Layers,
  DollarSign,
  Printer,
  Save,
  CheckCircle2,
  AlertCircle,
  FileText,
  Trash2,
  Sparkles,
  ExternalLink,
  History,
  Eye,
  Check,
} from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

// Formata data YYYY-MM-DD para dd/mm/aaaa
function formatarDataBr(dataStr?: string): string {
  if (!dataStr) return '—'
  const partes = dataStr.slice(0, 10).split('-')
  if (partes.length === 3) {
    const [ano, mes, dia] = partes
    return `${dia}/${mes}/${ano}`
  }
  return dataStr
}

// Formata data por extenso: 24 de Outubro de 2025
function formatarDataExtenso(dataStr?: string): string {
  const data = dataStr ? new Date(`${dataStr.slice(0, 10)}T12:00:00`) : new Date()
  const meses = [
    'Janeiro',
    'Fevereiro',
    'Março',
    'Abril',
    'Maio',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro',
  ]
  const dia = String(data.getDate()).padStart(2, '0')
  const mes = meses[data.getMonth()]
  const ano = data.getFullYear()
  return `${dia} de ${mes} de ${ano}`
}

// Formata valor monetário
function formatarMoeda(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return 'R$ 0,00'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(val)
}

function parseValorMonetario(input: string): number {
  const limpo = input.replace(/[^\d]/g, '')
  if (!limpo) return 0
  return Number(limpo) / 100
}

function formatarInputMoeda(val: number): string {
  if (val === 0) return ''
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(val)
}

function dataHojeIso(): string {
  return new Date().toISOString().slice(0, 10)
}

// Calcula data final (Data Início + Quantidade de Meses)
function calcularDataFinal(dataInicio: string, quantidadeMeses: number): string {
  if (!dataInicio) return ''
  const [startYear, startMonth, startDay] = dataInicio.split('-').map(Number)
  const baseYear = startYear || new Date().getFullYear()
  const baseMonth = startMonth ? startMonth - 1 : new Date().getMonth()
  const baseDay = startDay || 1

  // Soma os meses
  const targetDate = new Date(baseYear, baseMonth + Number(quantidadeMeses), baseDay)
  const y = targetDate.getFullYear()
  const m = String(targetDate.getMonth() + 1).padStart(2, '0')
  const d = String(targetDate.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// Monta endereço formatado
function montarEndereco(emp: {
  logradouro?: string
  numero?: string
  complemento?: string
  bairro?: string
  cidade?: string
  estado?: string
  cep?: string
}): string {
  const parts: string[] = []
  if (emp.logradouro) {
    let rua = emp.logradouro
    if (emp.numero) rua += `, nº ${emp.numero}`
    if (emp.complemento) rua += ` (${emp.complemento})`
    parts.push(rua)
  }
  if (emp.bairro) parts.push(`Bairro ${emp.bairro}`)
  if (emp.cidade || emp.estado) {
    parts.push(`${emp.cidade || ''}${emp.cidade && emp.estado ? ' - ' : ''}${emp.estado || ''}`)
  }
  if (emp.cep) parts.push(`CEP: ${emp.cep}`)

  return parts.length > 0 ? parts.join(', ') : 'Endereço não informado'
}

export default function Contratos() {
  const { toast } = useToast()
  const navigate = useNavigate()
  const { minhaEmpresa } = useMinhaEmpresa()

  // Lista de empresas cadastradas
  const [empresas, setEmpresas] = useState<EmpresaRecord[]>([])
  const [loadingEmpresas, setLoadingEmpresas] = useState(true)

  // Lista de contratos salvos
  const [contratosSalvos, setContratosSalvos] = useState<ContratoRecord[]>([])
  const [loadingContratos, setLoadingContratos] = useState(true)
  const [modalContratosOpen, setModalContratosOpen] = useState(false)

  // Formulário de geração
  const [contratanteId, setContratanteId] = useState<string>('')
  const [dataInicio, setDataInicio] = useState<string>(dataHojeIso())
  const [prazoInicial, setPrazoInicial] = useState<number>(1)
  const [quantidadeMeses, setQuantidadeMeses] = useState<number>(12)
  const [valorInput, setValorInput] = useState<string>('')
  const [diaVencimento, setDiaVencimento] = useState<number>(10)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  // Estado da Pré-visualização
  const [contratoGerado, setContratoGerado] = useState<{
    contratada: {
      razao_social: string
      nome_fantasia: string
      cnpj: string
      endereco: string
      crc: string
      contador_nome?: string
      cidade?: string
      estado?: string
    }
    contratante: {
      id: string
      razao_social: string
      nome_fantasia?: string
      cnpj: string
      endereco: string
      cidade?: string
      estado?: string
    }
    data_inicio: string
    prazo_inicial: number
    quantidade_meses: number
    valor_parcela: number
    dia_vencimento: number
    data_final: string
    parcelas: ParcelaPreview[]
  } | null>(null)

  // Estados de ação
  const [salvandoContrato, setSalvandoContrato] = useState(false)
  const [contratoSalvoId, setContratoSalvoId] = useState<string | null>(null)
  const [gerandoFinanceiro, setGerandoFinanceiro] = useState(false)
  const [financeiroGerado, setFinanceiroGerado] = useState(false)

  // Carrega empresas
  const carregarEmpresas = useCallback(async () => {
    try {
      setLoadingEmpresas(true)
      const list = await empresasService.getAll()
      setEmpresas(list)
      if (list.length > 0 && !contratanteId) {
        setContratanteId(list[0].id)
      }
    } catch (err) {
      console.error('Erro ao carregar empresas:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar empresas',
        description: 'Não foi possível carregar a lista de empresas cadastradas.',
      })
    } finally {
      setLoadingEmpresas(false)
    }
  }, [contratanteId, toast])

  // Carrega contratos salvos
  const carregarContratos = useCallback(async () => {
    try {
      setLoadingContratos(true)
      const list = await contratosService.listar()
      setContratosSalvos(list)
    } catch (err) {
      console.error('Erro ao carregar contratos:', err)
    } finally {
      setLoadingContratos(false)
    }
  }, [])

  useEffect(() => {
    carregarEmpresas()
    carregarContratos()
  }, [carregarEmpresas, carregarContratos])

  // Tempo real via useRealtime na coleção contratos
  useRealtime<ContratoRecord>('contratos', (event) => {
    if (event.action === 'create') {
      setContratosSalvos((prev) => [event.record, ...prev.filter((c) => c.id !== event.record.id)])
    } else if (event.action === 'update') {
      setContratosSalvos((prev) => prev.map((c) => (c.id === event.record.id ? event.record : c)))
    } else if (event.action === 'delete') {
      setContratosSalvos((prev) => prev.filter((c) => c.id !== event.record.id))
    }
  })

  // Empresa contratante selecionada
  const contratanteSelecionada = useMemo(() => {
    return empresas.find((e) => e.id === contratanteId)
  }, [empresas, contratanteId])

  // Endereço formatado da Minha Empresa
  const enderecoMinhaEmpresa = useMemo(() => {
    if (!minhaEmpresa) return ''
    return montarEndereco(minhaEmpresa)
  }, [minhaEmpresa])

  // Endereço formatado da Contratante selecionada
  const enderecoContratante = useMemo(() => {
    if (!contratanteSelecionada) return ''
    return montarEndereco(contratanteSelecionada)
  }, [contratanteSelecionada])

  // CRC formatado da Minha Empresa
  const crcContador = useMemo(() => {
    if (!minhaEmpresa?.contador_crc) return 'CRC não cadastrado'
    const uf = minhaEmpresa.contador_uf_crc ? `/${minhaEmpresa.contador_uf_crc}` : ''
    return `CRC: ${minhaEmpresa.contador_crc}${uf}`
  }, [minhaEmpresa])

  // Total das parcelas da pré-visualização
  const totalGeralCalculado = useMemo(() => {
    if (!contratoGerado) return 0
    return contratoGerado.parcelas.reduce((acc, p) => acc + (Number(p.valor) || 0), 0)
  }, [contratoGerado])

  // Manipulador de valor com máscara
  const handleValorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    const parsed = parseValorMonetario(raw)
    setValorInput(parsed > 0 ? formatarInputMoeda(parsed) : '')
    if (formErrors.valor) {
      setFormErrors((prev) => ({ ...prev, valor: '' }))
    }
  }

  // Validação do formulário
  const validateForm = (): boolean => {
    const errs: Record<string, string> = {}

    if (!minhaEmpresa || !minhaEmpresa.razao_social || !minhaEmpresa.cnpj) {
      errs.minhaEmpresa = 'Cadastre os dados da sua empresa antes de gerar contratos.'
    }

    if (!contratanteId) {
      errs.contratante = 'Selecione a empresa contratante.'
    }

    if (!dataInicio) {
      errs.dataInicio = 'Informe a data de início da consultoria.'
    }

    if (!prazoInicial || prazoInicial < 1) {
      errs.prazoInicial = 'O prazo inicial deve ser de pelo menos 1 mês.'
    }

    if (!quantidadeMeses || quantidadeMeses < 1 || quantidadeMeses > 120) {
      errs.quantidadeMeses = 'A quantidade de meses deve estar entre 1 e 120.'
    }

    const val = parseValorMonetario(valorInput)
    if (!val || val <= 0) {
      errs.valor = 'Informe o valor da parcela (maior que R$ 0,00).'
    }

    if (!diaVencimento || diaVencimento < 1 || diaVencimento > 28) {
      errs.diaVencimento = 'O dia de vencimento deve estar entre 1 e 28.'
    }

    setFormErrors(errs)
    return Object.keys(errs).length === 0
  }

  // Gerar Contrato (Monta pré-visualização em memória)
  const handleGerarContrato = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return

    if (!minhaEmpresa || !contratanteSelecionada) {
      toast({
        variant: 'destructive',
        title: 'Dados incompletos',
        description: 'Verifique se a Contratada e a Contratante foram selecionadas.',
      })
      return
    }

    const valorNumerico = parseValorMonetario(valorInput)
    const dataFimCalculada = calcularDataFinal(dataInicio, quantidadeMeses)

    // Calcula parcelas
    const parcelasPreview = recebiveisService.calcularPreviewParcelas({
      empresa: contratanteSelecionada.id,
      data_inicio_servicos: dataInicio,
      dia_vencimento: diaVencimento,
      valor: valorNumerico,
      meses: Number(quantidadeMeses),
    })

    setContratoGerado({
      contratada: {
        razao_social: minhaEmpresa.razao_social,
        nome_fantasia: minhaEmpresa.nome_fantasia || minhaEmpresa.razao_social,
        cnpj: minhaEmpresa.cnpj,
        endereco: enderecoMinhaEmpresa,
        crc: crcContador,
        contador_nome: minhaEmpresa.contador_nome,
        cidade: minhaEmpresa.cidade,
        estado: minhaEmpresa.estado,
      },
      contratante: {
        id: contratanteSelecionada.id,
        razao_social: contratanteSelecionada.nome,
        nome_fantasia: contratanteSelecionada.nome_fantasia,
        cnpj: contratanteSelecionada.cnpj,
        endereco: enderecoContratante,
        cidade: contratanteSelecionada.cidade,
        estado: contratanteSelecionada.estado,
      },
      data_inicio: dataInicio,
      prazo_inicial: Number(prazoInicial),
      quantidade_meses: Number(quantidadeMeses),
      valor_parcela: valorNumerico,
      dia_vencimento: Number(diaVencimento),
      data_final: dataFimCalculada,
      parcelas: parcelasPreview,
    })

    // Reset status de salvamento para novo contrato
    setContratoSalvoId(null)
    setFinanceiroGerado(false)

    toast({
      title: 'Contrato gerado com sucesso!',
      description:
        'A pré-visualização foi carregada. Você pode imprimir, salvar ou gerar as parcelas no financeiro.',
    })
  }

  // 1. Imprimir / Salvar PDF
  const handleImprimir = () => {
    if (!contratoGerado) return
    window.print()
  }

  // 2. Salvar Contrato no backend
  const handleSalvarContrato = async () => {
    if (!contratoGerado) return

    setSalvandoContrato(true)
    try {
      const record = await contratosService.criar({
        contratada_razao_social: contratoGerado.contratada.razao_social,
        contratada_cnpj: contratoGerado.contratada.cnpj,
        contratada_endereco: contratoGerado.contratada.endereco,
        contratada_crc: contratoGerado.contratada.crc,
        contratante: contratoGerado.contratante.id,
        data_inicio: contratoGerado.data_inicio,
        prazo_inicial: contratoGerado.prazo_inicial,
        quantidade_meses: contratoGerado.quantidade_meses,
        valor_parcela: contratoGerado.valor_parcela,
        dia_vencimento: contratoGerado.dia_vencimento,
        data_final: contratoGerado.data_final,
        parcelas: contratoGerado.parcelas.length,
      })

      setContratoSalvoId(record.id)
      await carregarContratos()

      toast({
        title: 'Contrato salvo com sucesso!',
        description: `O contrato com ${contratoGerado.contratante.razao_social} foi registrado no banco de dados.`,
      })
    } catch (err: any) {
      console.error('Erro ao salvar contrato:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar contrato',
        description: err?.message || 'Não foi possível gravar o contrato no backend.',
      })
    } finally {
      setSalvandoContrato(false)
    }
  }

  // 3. Gerar Parcelas no Financeiro
  const handleGerarParcelasNoFinanceiro = async () => {
    if (!contratoGerado) return

    setGerandoFinanceiro(true)
    try {
      await recebiveisService.gerarParcelas(
        {
          empresa: contratoGerado.contratante.id,
          data_inicio_servicos: contratoGerado.data_inicio,
          dia_vencimento: contratoGerado.dia_vencimento,
          valor: contratoGerado.valor_parcela,
          meses: contratoGerado.quantidade_meses,
        },
        contratoGerado.parcelas,
      )

      setFinanceiroGerado(true)

      toast({
        title: 'Parcelas geradas no Financeiro!',
        description: `Foram criados ${contratoGerado.parcelas.length} recebíveis no módulo Financeiro.`,
      })
    } catch (err: any) {
      console.error('Erro ao gerar parcelas no financeiro:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao gerar recebíveis',
        description: err?.message || 'Não foi possível cadastrar as parcelas no financeiro.',
      })
    } finally {
      setGerandoFinanceiro(false)
    }
  }

  // Carregar contrato salvo para visualização
  const handleCarregarContratoSalvo = (c: ContratoRecord) => {
    const contratanteObj = c.expand?.contratante || empresas.find((e) => e.id === c.contratante)
    const valorNum = Number(c.valor_parcela) || 0
    const dataInicioStr = c.data_inicio ? c.data_inicio.slice(0, 10) : dataHojeIso()
    const dataFimCalculada = c.data_final
      ? c.data_final.slice(0, 10)
      : calcularDataFinal(dataInicioStr, c.quantidade_meses)

    const parcelasPreview = recebiveisService.calcularPreviewParcelas({
      empresa: c.contratante,
      data_inicio_servicos: dataInicioStr,
      dia_vencimento: c.dia_vencimento,
      valor: valorNum,
      meses: c.quantidade_meses,
    })

    setContratanteId(c.contratante)
    setDataInicio(dataInicioStr)
    setPrazoInicial(c.prazo_inicial)
    setQuantidadeMeses(c.quantidade_meses)
    setValorInput(formatarInputMoeda(valorNum))
    setDiaVencimento(c.dia_vencimento)

    setContratoGerado({
      contratada: {
        razao_social: c.contratada_razao_social,
        nome_fantasia: c.contratada_razao_social,
        cnpj: c.contratada_cnpj,
        endereco: c.contratada_endereco || '',
        crc: c.contratada_crc || '',
        contador_nome: minhaEmpresa?.contador_nome,
        cidade: minhaEmpresa?.cidade,
        estado: minhaEmpresa?.estado,
      },
      contratante: {
        id: c.contratante,
        razao_social: contratanteObj?.nome || 'Empresa Contratante',
        nome_fantasia: contratanteObj?.nome_fantasia,
        cnpj: contratanteObj?.cnpj || '',
        endereco: contratanteObj ? montarEndereco(contratanteObj) : '',
        cidade: contratanteObj?.cidade,
        estado: contratanteObj?.estado,
      },
      data_inicio: dataInicioStr,
      prazo_inicial: c.prazo_inicial,
      quantidade_meses: c.quantidade_meses,
      valor_parcela: valorNum,
      dia_vencimento: c.dia_vencimento,
      data_final: dataFimCalculada,
      parcelas: parcelasPreview,
    })

    setContratoSalvoId(c.id)
    setFinanceiroGerado(false)
    setModalContratosOpen(false)

    toast({
      title: 'Contrato carregado',
      description: `Contrato de ${contratanteObj?.nome || 'Empresa'} carregado na pré-visualização.`,
    })
  }

  // Excluir contrato salvo
  const handleExcluirContratoSalvo = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!window.confirm('Tem certeza que deseja excluir este contrato salvo?')) return

    try {
      await contratosService.excluir(id)
      setContratosSalvos((prev) => prev.filter((c) => c.id !== id))
      if (contratoSalvoId === id) {
        setContratoSalvoId(null)
      }
      toast({
        title: 'Contrato excluído com sucesso',
      })
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir contrato',
        description: err?.message,
      })
    }
  }

  return (
    <div className="space-y-6 animate-fadeIn pb-16">
      {/* Estilos específicos para Impressão / Salvar PDF */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #contrato-folha-a4, #contrato-folha-a4 * {
            visibility: visible;
          }
          #contrato-folha-a4 {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 20mm 15mm;
            box-shadow: none !important;
            border: none !important;
            background: white !important;
            color: black !important;
            font-size: 11pt !important;
            line-height: 1.5 !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* 1. Cabeçalho da Página */}
      <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#0B1F3A] tracking-tight flex items-center gap-2">
            <FileSignature className="w-5 h-5 text-blue-600" />
            Contratos de Prestação de Serviço
          </h1>
          <p className="text-xs text-[#5B6B7F]">
            Elabore, pré-visualize e gere contratos de consultoria financeira com cronograma
            automático de parcelas.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {contratosSalvos.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setModalContratosOpen(true)}
              className="h-8 text-xs font-semibold text-slate-700 bg-white border-slate-200 hover:bg-slate-50 gap-1.5 shadow-2xs"
            >
              <History className="w-3.5 h-3.5 text-blue-600" />
              Contratos Salvos ({contratosSalvos.length})
            </Button>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => navigate('/financeiro')}
            className="h-8 text-xs font-semibold text-blue-700 bg-white border-blue-200 hover:bg-blue-50 gap-1.5 shadow-2xs"
          >
            <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
            Ir para o Financeiro
          </Button>
        </div>
      </div>

      {/* Alerta de Minha Empresa não cadastrada */}
      {(!minhaEmpresa || !minhaEmpresa.razao_social || !minhaEmpresa.cnpj) && (
        <Alert className="no-print bg-amber-50 border-amber-200 text-amber-900">
          <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
          <AlertTitle className="text-xs font-bold">Minha Empresa não configurada</AlertTitle>
          <AlertDescription className="text-xs mt-0.5 flex items-center justify-between gap-4 flex-wrap">
            <span>
              Cadastre sua empresa em Minha Empresa primeiro para preencher os dados da Contratada
              no contrato.
            </span>
            <Link
              to="/minha-empresa"
              className="inline-flex items-center gap-1 font-bold text-blue-700 underline hover:text-blue-900 text-xs"
            >
              Ir para Minha Empresa
              <ExternalLink className="w-3 h-3" />
            </Link>
          </AlertDescription>
        </Alert>
      )}

      {/* Grid Principal: Formulário (Esquerda) e Pré-visualização A4 (Direita) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LADO ESQUERDO: Formulário de Geração (5 colunas no desktop) */}
        <div className="no-print lg:col-span-5 space-y-4">
          <Card className="bg-white border-slate-200 shadow-xs">
            <CardHeader className="pb-3 border-b border-slate-100">
              <CardTitle className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
                <FileSignature className="w-4 h-4 text-blue-600" />
                Dados do Contrato
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Preencha os parâmetros para redigir o contrato e calcular o cronograma.
              </CardDescription>
            </CardHeader>

            <CardContent className="pt-4">
              <form onSubmit={handleGerarContrato} className="space-y-4">
                {/* 1. Seção CONTRATADA (Minha Empresa) - Readonly */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[#0B1F3A] uppercase tracking-wide flex items-center gap-1.5">
                      <Building className="w-3.5 h-3.5 text-blue-600" />
                      Contratada (Minha Empresa)
                    </span>
                    <Link
                      to="/minha-empresa"
                      className="text-[10px] text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-0.5"
                    >
                      Editar dados
                      <ExternalLink className="w-2.5 h-2.5" />
                    </Link>
                  </div>

                  {minhaEmpresa ? (
                    <div className="space-y-1.5 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-500 font-medium block">
                          Razão Social:
                        </span>
                        <p className="font-semibold text-slate-800 truncate">
                          {minhaEmpresa.razao_social || 'Não informada'}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-[10px] text-slate-500 font-medium block">
                            CNPJ:
                          </span>
                          <p className="font-mono text-slate-700 text-[11px]">
                            {minhaEmpresa.cnpj || 'Não informado'}
                          </p>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 font-medium block">
                            CRC do Contador:
                          </span>
                          <p className="font-semibold text-slate-700 text-[11px]">{crcContador}</p>
                        </div>
                      </div>

                      <div>
                        <span className="text-[10px] text-slate-500 font-medium block">
                          Endereço:
                        </span>
                        <p className="text-slate-600 text-[11px] line-clamp-2 leading-relaxed">
                          {enderecoMinhaEmpresa}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-amber-700 font-medium">
                      Nenhuma empresa configurada. Acesse Minha Empresa para cadastrar.
                    </p>
                  )}
                </div>

                {/* 2. Seção CONTRATANTE (Empresa Selecionada) */}
                <div className="space-y-1.5">
                  <Label
                    htmlFor="contrato-contratante"
                    className="text-xs font-semibold text-slate-700 flex items-center gap-1.5"
                  >
                    <Building2 className="w-3.5 h-3.5 text-blue-600" />
                    Contratante (Cliente) *
                  </Label>
                  <Select
                    value={contratanteId}
                    onValueChange={(val) => {
                      setContratanteId(val)
                      if (formErrors.contratante) {
                        setFormErrors((prev) => ({ ...prev, contratante: '' }))
                      }
                    }}
                    disabled={loadingEmpresas}
                  >
                    <SelectTrigger id="contrato-contratante" className="h-9 text-xs bg-white">
                      <SelectValue placeholder="Selecione a empresa contratante" />
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                      {empresas.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id} className="text-xs">
                          <div className="flex flex-col text-left py-0.5">
                            <span className="font-semibold text-slate-800">
                              {emp.nome} {emp.nome_fantasia ? `(${emp.nome_fantasia})` : ''}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              CNPJ: {emp.cnpj || 'Não informado'}{' '}
                              {emp.segmento ? `· ${emp.segmento}` : ''}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {formErrors.contratante && (
                    <p className="text-[11px] text-red-600 font-medium">{formErrors.contratante}</p>
                  )}

                  {contratanteSelecionada && (
                    <div className="mt-1 p-2 bg-blue-50/50 border border-blue-100 rounded-lg text-[11px] text-slate-600 space-y-0.5">
                      <p>
                        <strong className="text-slate-800">Razão Social:</strong>{' '}
                        {contratanteSelecionada.nome}
                      </p>
                      <p>
                        <strong className="text-slate-800">CNPJ:</strong>{' '}
                        <span className="font-mono">{contratanteSelecionada.cnpj || '—'}</span>
                      </p>
                      <p className="truncate">
                        <strong className="text-slate-800">Endereço:</strong> {enderecoContratante}
                      </p>
                    </div>
                  )}
                </div>

                {/* 3. Data de Início da Consultoria e Prazo Inicial */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Data de Início */}
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="contrato-inicio"
                      className="text-xs font-semibold text-slate-700 flex items-center gap-1.5"
                    >
                      <CalendarIcon className="w-3.5 h-3.5 text-blue-600" />
                      Início da Consultoria *
                    </Label>
                    <Input
                      id="contrato-inicio"
                      type="date"
                      value={dataInicio}
                      onChange={(e) => {
                        setDataInicio(e.target.value)
                        if (formErrors.dataInicio) {
                          setFormErrors((prev) => ({ ...prev, dataInicio: '' }))
                        }
                      }}
                      className="h-9 text-xs bg-white"
                    />
                    {formErrors.dataInicio && (
                      <p className="text-[11px] text-red-600 font-medium">
                        {formErrors.dataInicio}
                      </p>
                    )}
                  </div>

                  {/* Prazo Inicial (meses) */}
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="contrato-prazo-inicial"
                      className="text-xs font-semibold text-slate-700 flex items-center gap-1.5"
                    >
                      <Clock className="w-3.5 h-3.5 text-blue-600" />
                      Prazo Inicial (meses) *
                    </Label>
                    <Input
                      id="contrato-prazo-inicial"
                      type="number"
                      min={1}
                      max={60}
                      placeholder="1"
                      value={prazoInicial}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10)
                        setPrazoInicial(isNaN(v) ? ('' as any) : v)
                        if (formErrors.prazoInicial) {
                          setFormErrors((prev) => ({ ...prev, prazoInicial: '' }))
                        }
                      }}
                      className="h-9 text-xs bg-white font-mono font-bold"
                    />
                    {formErrors.prazoInicial && (
                      <p className="text-[11px] text-red-600 font-medium">
                        {formErrors.prazoInicial}
                      </p>
                    )}
                  </div>
                </div>

                {/* 4. Quantidade de Meses do Contrato com Atalhos Rápidos */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label
                      htmlFor="contrato-meses"
                      className="text-xs font-semibold text-slate-700 flex items-center gap-1.5"
                    >
                      <Layers className="w-3.5 h-3.5 text-blue-600" />
                      Quantidade de Meses do Contrato *
                    </Label>
                    <span className="text-[11px] font-semibold text-blue-700">
                      Término: {formatarDataBr(calcularDataFinal(dataInicio, quantidadeMeses))}
                    </span>
                  </div>

                  <Input
                    id="contrato-meses"
                    type="number"
                    min={1}
                    max={120}
                    placeholder="12"
                    value={quantidadeMeses}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10)
                      setQuantidadeMeses(isNaN(v) ? ('' as any) : v)
                      if (formErrors.quantidadeMeses) {
                        setFormErrors((prev) => ({ ...prev, quantidadeMeses: '' }))
                      }
                    }}
                    className="h-9 text-xs bg-white font-mono font-bold"
                  />
                  {formErrors.quantidadeMeses && (
                    <p className="text-[11px] text-red-600 font-medium">
                      {formErrors.quantidadeMeses}
                    </p>
                  )}

                  {/* Atalhos Rápidos */}
                  <div className="flex items-center gap-1.5 pt-1">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase">
                      Atalhos:
                    </span>
                    {[6, 12, 24, 36].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setQuantidadeMeses(m)}
                        className={`text-[11px] px-2.5 py-0.5 rounded-md font-semibold transition-colors border ${
                          quantidadeMeses === m
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {m} meses
                      </button>
                    ))}
                  </div>
                </div>

                {/* 5. Valor da Parcela (R$) e Dia de Vencimento */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Valor da Parcela */}
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="contrato-valor"
                      className="text-xs font-semibold text-slate-700 flex items-center gap-1.5"
                    >
                      <DollarSign className="w-3.5 h-3.5 text-blue-600" />
                      Valor da Parcela (R$) *
                    </Label>
                    <div className="relative">
                      <DollarSign className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <Input
                        id="contrato-valor"
                        type="text"
                        placeholder="R$ 0,00"
                        value={valorInput}
                        onChange={handleValorChange}
                        className="h-9 text-xs pl-8 font-mono font-bold text-slate-900"
                      />
                    </div>
                    {formErrors.valor && (
                      <p className="text-[11px] text-red-600 font-medium">{formErrors.valor}</p>
                    )}
                  </div>

                  {/* Dia de Vencimento (Select 1 a 28) */}
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="contrato-dia-vencimento"
                      className="text-xs font-semibold text-slate-700 flex items-center gap-1.5"
                    >
                      <Clock className="w-3.5 h-3.5 text-blue-600" />
                      Dia de Vencimento *
                    </Label>
                    <Select
                      value={String(diaVencimento)}
                      onValueChange={(val) => {
                        setDiaVencimento(Number(val))
                        if (formErrors.diaVencimento) {
                          setFormErrors((prev) => ({ ...prev, diaVencimento: '' }))
                        }
                      }}
                    >
                      <SelectTrigger id="contrato-dia-vencimento" className="h-9 text-xs bg-white">
                        <SelectValue placeholder="Selecione o dia" />
                      </SelectTrigger>
                      <SelectContent className="max-h-56">
                        {Array.from({ length: 28 }, (_, i) => i + 1).map((dia) => (
                          <SelectItem key={dia} value={String(dia)} className="text-xs">
                            Dia {dia} de cada mês
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {formErrors.diaVencimento && (
                      <p className="text-[11px] text-red-600 font-medium">
                        {formErrors.diaVencimento}
                      </p>
                    )}
                  </div>
                </div>

                {/* Botão Gerar Contrato */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-end">
                  <Button
                    type="submit"
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs h-10 shadow-sm gap-2"
                    disabled={loadingEmpresas || empresas.length === 0}
                  >
                    <Sparkles className="w-4 h-4" />
                    Gerar Contrato
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* LADO DIREITO: Pré-visualização do Contrato (Card simulando folha A4) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Barra de Ações Superior (Apenas se o contrato estiver gerado) */}
          {contratoGerado && (
            <div className="no-print bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs font-bold px-2.5 py-1">
                  Contrato Pronto
                </Badge>
                {contratoSalvoId && (
                  <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-xs font-bold px-2.5 py-1 flex items-center gap-1">
                    <Check className="w-3 h-3" /> Salvo no Banco
                  </Badge>
                )}
                {financeiroGerado && (
                  <Badge className="bg-purple-100 text-purple-800 border-purple-200 text-xs font-bold px-2.5 py-1 flex items-center gap-1">
                    <Check className="w-3 h-3" /> Recebíveis Criados
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* 1. Imprimir / Salvar PDF */}
                <Button
                  type="button"
                  onClick={handleImprimir}
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs font-semibold text-slate-700 bg-white border-slate-300 hover:bg-slate-50 gap-1.5 shadow-2xs"
                >
                  <Printer className="w-3.5 h-3.5 text-blue-600" />
                  Imprimir / Salvar PDF
                </Button>

                {/* 2. Salvar Contrato */}
                <Button
                  type="button"
                  onClick={handleSalvarContrato}
                  disabled={salvandoContrato || !!contratoSalvoId}
                  size="sm"
                  className="h-8 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white gap-1.5 shadow-2xs"
                >
                  <Save className="w-3.5 h-3.5" />
                  {salvandoContrato
                    ? 'Salvando...'
                    : contratoSalvoId
                      ? 'Contrato Salvo'
                      : 'Salvar Contrato'}
                </Button>

                {/* 3. Gerar Parcelas no Financeiro */}
                <Button
                  type="button"
                  onClick={handleGerarParcelasNoFinanceiro}
                  disabled={gerandoFinanceiro || financeiroGerado}
                  size="sm"
                  className="h-8 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-2xs"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {gerandoFinanceiro
                    ? 'Gerando...'
                    : financeiroGerado
                      ? 'Parcelas Geradas'
                      : 'Gerar Parcelas no Financeiro'}
                </Button>
              </div>
            </div>
          )}

          {/* Folha A4 Simulada */}
          {!contratoGerado ? (
            <Card className="no-print bg-white border-slate-200 shadow-xs">
              <CardContent className="py-24 flex flex-col items-center justify-center text-center px-4">
                <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
                  <FileSignature className="w-8 h-8" />
                </div>
                <h3 className="text-base font-bold text-[#0B1F3A]">Pré-visualização do Contrato</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-md">
                  Preencha os campos do formulário à esquerda e clique no botão{' '}
                  <strong className="text-blue-700">"Gerar Contrato"</strong> para visualizar o
                  documento redigido com as cláusulas jurídicas e a tabela de parcelas.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div
              id="contrato-folha-a4"
              className="bg-white rounded-2xl border border-slate-200 shadow-lg p-8 sm:p-12 text-slate-800 text-xs sm:text-sm leading-relaxed space-y-6 font-serif"
              style={{ minHeight: '1050px' }}
            >
              {/* Cabeçalho do Contrato */}
              <div className="text-center border-b-2 border-slate-900 pb-5 space-y-1">
                <h2 className="text-base sm:text-lg font-bold tracking-tight uppercase text-slate-950 font-sans">
                  CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE CONSULTORIA
                </h2>
                <p className="text-[11px] sm:text-xs text-slate-500 uppercase tracking-widest font-sans font-semibold">
                  Assessoria, Diagnóstico e Planejamento Financeiro
                </p>
              </div>

              {/* Qualificação das Partes */}
              <div className="space-y-3 text-justify">
                <p>
                  Por este instrumento particular de contrato de prestação de serviços, de um lado:
                </p>

                {/* CONTRATADA */}
                <div className="pl-4 border-l-2 border-blue-600 space-y-1 bg-slate-50/70 p-3 rounded-r-lg font-sans text-xs">
                  <p className="font-bold text-slate-900 uppercase">
                    CONTRATADA:{' '}
                    <span className="font-normal text-slate-800">
                      {contratoGerado.contratada.razao_social || 'CONTRATADA NÃO IDENTIFICADA'}
                    </span>
                  </p>
                  <p className="text-slate-700">
                    <strong>CNPJ:</strong>{' '}
                    <span className="font-mono">{contratoGerado.contratada.cnpj || '—'}</span>
                    {contratoGerado.contratada.crc &&
                      ` | Responsável Técnico: ${contratoGerado.contratada.crc}`}
                  </p>
                  <p className="text-slate-700">
                    <strong>Endereço:</strong>{' '}
                    {contratoGerado.contratada.endereco || 'Endereço não informado'}
                  </p>
                </div>

                <p>E, de outro lado:</p>

                {/* CONTRATANTE */}
                <div className="pl-4 border-l-2 border-slate-600 space-y-1 bg-slate-50/70 p-3 rounded-r-lg font-sans text-xs">
                  <p className="font-bold text-slate-900 uppercase">
                    CONTRATANTE:{' '}
                    <span className="font-normal text-slate-800">
                      {contratoGerado.contratante.razao_social}
                    </span>
                    {contratoGerado.contratante.nome_fantasia && (
                      <span className="text-slate-600 font-normal">
                        {' '}
                        (Nome Fantasia: {contratoGerado.contratante.nome_fantasia})
                      </span>
                    )}
                  </p>
                  <p className="text-slate-700">
                    <strong>CNPJ:</strong>{' '}
                    <span className="font-mono">{contratoGerado.contratante.cnpj || '—'}</span>
                  </p>
                  <p className="text-slate-700">
                    <strong>Endereço:</strong>{' '}
                    {contratoGerado.contratante.endereco || 'Endereço não informado'}
                  </p>
                </div>

                <p>
                  Têm entre si, justo e acordado, o presente Contrato de Prestação de Serviços de
                  Consultoria Financeira, que se regerá pelas seguintes cláusulas e condições:
                </p>
              </div>

              {/* Cláusulas do Contrato */}
              <div className="space-y-4 text-justify">
                {/* CLÁUSULA 1 - DO OBJETO */}
                <div className="space-y-1.5">
                  <h3 className="font-bold text-slate-950 font-sans uppercase text-xs sm:text-sm">
                    CLÁUSULA PRIMEIRA – DO OBJETO
                  </h3>
                  <p>
                    O presente instrumento tem por objeto a prestação, pela{' '}
                    <strong>CONTRATADA</strong> à <strong>CONTRATANTE</strong>, de serviços
                    especializados de consultoria, diagnóstico financeiro, análise de balanços
                    patrimoniais, estruturação de planos de contas, controle orçamentário e emissão
                    de relatórios periódicos de desempenho econômico-financeiro.
                  </p>
                </div>

                {/* CLÁUSULA 2 - DO PRAZO */}
                <div className="space-y-1.5">
                  <h3 className="font-bold text-slate-950 font-sans uppercase text-xs sm:text-sm">
                    CLÁUSULA SEGUNDA – DO PRAZO E VIGÊNCIA
                  </h3>
                  <p>
                    O presente contrato vigorará pelo prazo total de{' '}
                    <strong>
                      {contratoGerado.quantidade_meses} ({contratoGerado.quantidade_meses} meses)
                    </strong>
                    , com início em <strong>{formatarDataBr(contratoGerado.data_inicio)}</strong> e
                    término previsto para{' '}
                    <strong>{formatarDataBr(contratoGerado.data_final)}</strong>.
                  </p>
                  <p>
                    Fica estipulado um prazo inicial de carência/implantação de{' '}
                    <strong>
                      {contratoGerado.prazo_inicial}{' '}
                      {contratoGerado.prazo_inicial === 1 ? 'mês' : 'meses'}
                    </strong>{' '}
                    para estruturação e parametrização dos relatórios contábeis e financeiros.
                  </p>
                </div>

                {/* CLÁUSULA 3 - DO VALOR E FORMA DE PAGAMENTO */}
                <div className="space-y-1.5">
                  <h3 className="font-bold text-slate-950 font-sans uppercase text-xs sm:text-sm">
                    CLÁUSULA TERCEIRA – DO VALOR E DA FORMA DE PAGAMENTO
                  </h3>
                  <p>
                    Pelos serviços prestados, a <strong>CONTRATANTE</strong> pagará à{' '}
                    <strong>CONTRATADA</strong> a quantia mensal de{' '}
                    <strong>{formatarMoeda(contratoGerado.valor_parcela)}</strong>, totalizando o
                    valor global de <strong>{formatarMoeda(totalGeralCalculado)}</strong> ao longo
                    da vigência contratual de {contratoGerado.quantidade_meses} parcelas.
                  </p>
                  <p>
                    As parcelas vencerão impreterivelmente no{' '}
                    <strong>dia {contratoGerado.dia_vencimento}</strong> de cada mês subsequente,
                    mediante emissão de boleto bancário, transferência ou chave PIX informada pela{' '}
                    <strong>CONTRATADA</strong>.
                  </p>
                </div>

                {/* CLÁUSULA 4 - DO REAJUSTE */}
                <div className="space-y-1.5">
                  <h3 className="font-bold text-slate-950 font-sans uppercase text-xs sm:text-sm">
                    CLÁUSULA QUARTA – DO REAJUSTE ANUAL
                  </h3>
                  <p>
                    O valor estipulado na Cláusula Terceira será reajustado anualmente a cada 12
                    (doze) meses de vigência, aplicando-se a variação positiva acumulada do{' '}
                    <strong>IGP-M/FGV</strong> (Índice Geral de Preços do Mercado) ou, na sua
                    ausência ou extinção, pelo <strong>IPCA/IBGE</strong> acumulado no período.
                  </p>
                </div>

                {/* CLÁUSULA 5 - DAS OBRIGAÇÕES */}
                <div className="space-y-1.5">
                  <h3 className="font-bold text-slate-950 font-sans uppercase text-xs sm:text-sm">
                    CLÁUSULA QUINTA – DAS OBRIGAÇÕES DAS PARTES
                  </h3>
                  <p>
                    <strong>I – Da CONTRATADA:</strong> Prestar os serviços acordados com zelo,
                    ética e técnica profissional, guardando sigilo irrestrito de todas as
                    informações comerciais, fiscais e estratégicas a que tiver acesso.
                  </p>
                  <p>
                    <strong>II – Da CONTRATANTE:</strong> Fornecer em tempo hábil todos os
                    documentos contábeis, extratos, demonstrativos e dados necessários para a
                    correta elaboração dos diagnósticos e relatórios.
                  </p>
                </div>

                {/* CLÁUSULA 6 - DO FORO */}
                <div className="space-y-1.5">
                  <h3 className="font-bold text-slate-950 font-sans uppercase text-xs sm:text-sm">
                    CLÁUSULA SEXTA – DO FORO
                  </h3>
                  <p>
                    Para dirimir quaisquer controvérsias oriundas do presente contrato, as partes
                    elegem o Foro da comarca de{' '}
                    <strong>
                      {contratoGerado.contratada.cidade ||
                        contratoGerado.contratante.cidade ||
                        'São Paulo'}
                      /
                      {contratoGerado.contratada.estado ||
                        contratoGerado.contratante.estado ||
                        'SP'}
                    </strong>
                    , com renúncia expressa a qualquer outro, por mais privilegiado que seja.
                  </p>
                </div>
              </div>

              {/* Data e Local */}
              <div className="pt-4 text-right font-sans text-xs sm:text-sm text-slate-800">
                <p>
                  {contratoGerado.contratada.cidade || 'Local'},{' '}
                  {formatarDataExtenso(contratoGerado.data_inicio)}
                </p>
              </div>

              {/* Espaço de Assinatura */}
              <div className="pt-8 sm:pt-12 grid grid-cols-1 sm:grid-cols-2 gap-8 font-sans text-xs text-center">
                <div className="space-y-1">
                  <div className="border-t border-slate-900 mx-auto w-4/5 pt-1" />
                  <p className="font-bold text-slate-900 uppercase">
                    {contratoGerado.contratada.razao_social || 'CONTRATADA'}
                  </p>
                  <p className="text-slate-600 text-[11px]">CONTRATADA (Minha Empresa)</p>
                  {contratoGerado.contratada.crc && (
                    <p className="text-slate-500 text-[10px]">{contratoGerado.contratada.crc}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <div className="border-t border-slate-900 mx-auto w-4/5 pt-1" />
                  <p className="font-bold text-slate-900 uppercase">
                    {contratoGerado.contratante.razao_social}
                  </p>
                  <p className="text-slate-600 text-[11px]">CONTRATANTE (Cliente)</p>
                  <p className="text-slate-500 text-[10px] font-mono">
                    CNPJ: {contratoGerado.contratante.cnpj || '—'}
                  </p>
                </div>
              </div>

              {/* 4. Cronograma de Parcelas */}
              <div className="pt-8 border-t border-slate-200 font-sans space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs sm:text-sm text-slate-900 uppercase flex items-center gap-2">
                    <CalendarIcon className="w-4 h-4 text-blue-600" />
                    Anexo I – Cronograma Financeiro de Parcelas
                  </h4>
                  <Badge variant="outline" className="text-[10px] font-bold font-mono">
                    {contratoGerado.parcelas.length} parcelas
                  </Badge>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                        <th className="py-2 px-3 text-center w-16">Nº</th>
                        <th className="py-2 px-3">Data de Vencimento</th>
                        <th className="py-2 px-3 text-right">Valor da Parcela</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {contratoGerado.parcelas.map((p) => (
                        <tr key={p.parcela} className="hover:bg-slate-50/50">
                          <td className="py-1.5 px-3 text-center font-mono font-bold text-blue-800">
                            {String(p.parcela).padStart(2, '0')}
                          </td>
                          <td className="py-1.5 px-3 font-medium text-slate-700">
                            {formatarDataBr(p.vencimento)}
                          </td>
                          <td className="py-1.5 px-3 text-right font-mono font-bold text-slate-900">
                            {formatarMoeda(p.valor)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-100/80 font-bold border-t border-slate-300 text-slate-900">
                        <td colSpan={2} className="py-2.5 px-3 text-xs uppercase">
                          Total Geral do Contrato
                        </td>
                        <td className="py-2.5 px-3 text-right text-xs sm:text-sm font-mono text-emerald-700">
                          {formatarMoeda(totalGeralCalculado)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Histórico de Contratos Salvos */}
      <Dialog open={modalContratosOpen} onOpenChange={setModalContratosOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#0B1F3A] flex items-center gap-2">
              <History className="w-5 h-5 text-blue-600" />
              Contratos Salvos no Sistema
            </DialogTitle>
            <DialogDescription className="text-xs">
              Histórico de contratos registrados. Clique para carregar na tela e gerar impressões ou
              parcelas.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {loadingContratos ? (
              <div className="py-12 text-center text-xs text-slate-500">
                Carregando contratos...
              </div>
            ) : contratosSalvos.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500">
                Nenhum contrato salvo encontrado.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                {contratosSalvos.map((c) => {
                  const emp = c.expand?.contratante || empresas.find((e) => e.id === c.contratante)
                  const total = (Number(c.valor_parcela) || 0) * (Number(c.quantidade_meses) || 1)

                  return (
                    <div
                      key={c.id}
                      onClick={() => handleCarregarContratoSalvo(c)}
                      className="p-3.5 hover:bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer transition-colors"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                            {emp?.nome || 'Empresa'}
                          </span>
                          <Badge
                            variant="outline"
                            className="text-[10px] bg-blue-50 text-blue-700 border-blue-200 font-bold"
                          >
                            {c.quantidade_meses} meses
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-500">
                          Início: <strong>{formatarDataBr(c.data_inicio)}</strong> · Vencimento:
                          todo dia <strong>{c.dia_vencimento}</strong> · Parcela:{' '}
                          <strong className="text-slate-800">
                            {formatarMoeda(c.valor_parcela)}
                          </strong>
                        </p>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 block font-semibold uppercase">
                            Total
                          </span>
                          <span className="text-xs sm:text-sm font-bold font-mono text-emerald-700">
                            {formatarMoeda(total)}
                          </span>
                        </div>

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleCarregarContratoSalvo(c)
                          }}
                          className="h-8 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" />
                          Visualizar
                        </Button>

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={(e) => handleExcluirContratoSalvo(c.id, e)}
                          className="h-8 text-xs text-red-500 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setModalContratosOpen(false)}
              className="text-xs"
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
