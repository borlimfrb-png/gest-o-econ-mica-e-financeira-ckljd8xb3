import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { empresasService } from '@/services/financeService'
import { contratosService } from '@/services/contratosService'
import { recebiveisService, type ParcelaPreview } from '@/services/recebiveisService'
import { useMinhaEmpresa } from '@/contexts/MinhaEmpresaContext'
import { useToast } from '@/hooks/use-toast'
import useRealtime from '@/hooks/use-realtime'
import type { EmpresaRecord, ContratoRecord } from '@/types/finance'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
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
  RotateCcw,
  SlidersHorizontal,
  Search,
  Filter,
  AlertTriangle,
  RefreshCw,
  PlusCircle,
  ArrowRight,
  Mail,
} from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

// Modelos das 6 cláusulas padrão
export interface ClausulasContrato {
  objeto: string
  prazo: string
  valor: string
  reajuste: string
  obrigacoes: string
  foro: string
}

export const CLAUSULAS_PADRAO: ClausulasContrato = {
  objeto:
    'O presente instrumento tem por objeto a prestação, pela CONTRATADA à CONTRATANTE, de serviços especializados de consultoria, diagnóstico financeiro, análise de balanços patrimoniais, estruturação de planos de contas, controle orçamentário e emissão de relatórios periódicos de desempenho econômico-financeiro.',
  prazo:
    'O presente contrato vigorará pelo prazo total de {MESES} ({MESES} meses), com início em {DATA_INICIO} e término previsto para {DATA_FINAL}.\n\nFica estipulado um prazo inicial de carência/implantação de {PRAZO_INICIAL} {PRAZO_INICIAL_LABEL} para estruturação e parametrização dos relatórios contábeis e financeiros.',
  valor:
    'Pelos serviços prestados, a CONTRATANTE pagará à CONTRATADA a quantia mensal de {VALOR_PARCELA}, totalizando o valor global de {VALOR_TOTAL} ao longo da vigência contratual de {MESES} parcelas.\n\nAs parcelas vencerão impreterivelmente no dia {DIA_VENCIMENTO} de cada mês subsequente, mediante emissão de boleto bancário, transferência ou chave PIX informada pela CONTRATADA.',
  reajuste:
    'O valor estipulado na Cláusula Terceira será reajustado anualmente a cada 12 (doze) meses de vigência, aplicando-se a variação positiva acumulada do IGP-M/FGV (Índice Geral de Preços do Mercado) ou, na sua ausência ou extinção, pelo IPCA/IBGE acumulado no período.',
  obrigacoes:
    'I – Da CONTRATADA: Prestar os serviços acordados com zelo, ética e técnica profissional, guardando sigilo irrestrito de todas as informações comerciais, fiscais e estratégicas a que tiver acesso.\n\nII – Da CONTRATANTE: Fornecer em tempo hábil todos os documentos contábeis, extratos, demonstrativos e dados necessários para a correta elaboração dos diagnósticos e relatórios.',
  foro: 'Para dirimir quaisquer controvérsias oriundas do presente contrato, as partes elegem o Foro da comarca de {CIDADE_ESTADO}, com renúncia expressa a qualquer outro, por mais privilegiado que seja.',
}

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

  const targetDate = new Date(baseYear, baseMonth + Number(quantidadeMeses), baseDay)
  const y = targetDate.getFullYear()
  const m = String(targetDate.getMonth() + 1).padStart(2, '0')
  const d = String(targetDate.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// Calcula dias restantes para o término do contrato
function calcularDiasRestantesContrato(dataFinalStr?: string): {
  dias: number
  isVigente: boolean
  isVencendo: boolean
} {
  if (!dataFinalStr) return { dias: 0, isVigente: false, isVencendo: false }
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const [ano, mes, dia] = dataFinalStr.slice(0, 10).split('-').map(Number)
  const dataFim = new Date(ano, mes - 1, dia)
  dataFim.setHours(0, 0, 0, 0)

  const diffTime = dataFim.getTime() - hoje.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  const isVigente = diffDays >= 0
  const isVencendo = isVigente && diffDays <= 30

  return { dias: diffDays, isVigente, isVencendo }
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

  // Aba ativa: 'novo' (Gerador) | 'historico' (Histórico de Contratos)
  const [abaAtiva, setAbaAtiva] = useState<'novo' | 'historico'>('novo')

  // Lista de empresas cadastradas
  const [empresas, setEmpresas] = useState<EmpresaRecord[]>([])
  const [loadingEmpresas, setLoadingEmpresas] = useState(true)

  // Lista de contratos salvos
  const [contratosSalvos, setContratosSalvos] = useState<ContratoRecord[]>([])
  const [loadingContratos, setLoadingContratos] = useState(true)

  // Filtros da aba Histórico
  const [filtroHistoricoCliente, setFiltroHistoricoCliente] = useState<string>('todos')
  const [filtroHistoricoStatus, setFiltroHistoricoStatus] = useState<
    'todos' | 'vigente' | 'encerrado'
  >('todos')
  const [filtroHistoricoBusca, setFiltroHistoricoBusca] = useState<string>('')
  const [filtroHistoricoDataInicio, setFiltroHistoricoDataInicio] = useState<string>('')

  // Formulário de geração
  const [contratanteId, setContratanteId] = useState<string>('')
  const [dataInicio, setDataInicio] = useState<string>(dataHojeIso())
  const [prazoInicial, setPrazoInicial] = useState<number>(1)
  const [quantidadeMeses, setQuantidadeMeses] = useState<number>(12)
  const [valorInput, setValorInput] = useState<string>('')
  const [diaVencimento, setDiaVencimento] = useState<number>(10)
  const [enviarLembretesContrato, setEnviarLembretesContrato] = useState<boolean>(true)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  // Cláusulas personalizadas (em memória da sessão)
  const [clausulas, setClausulas] = useState<ClausulasContrato>({ ...CLAUSULAS_PADRAO })
  const [modalClausulasOpen, setModalClausulasOpen] = useState(false)
  const [clausulasEdit, setClausulasEdit] = useState<ClausulasContrato>({ ...CLAUSULAS_PADRAO })

  // Modal de Pré-visualização A4 rápida a partir do histórico
  const [previewModalOpen, setPreviewModalOpen] = useState(false)
  const [contratoParaVisualizar, setContratoParaVisualizar] = useState<ContratoRecord | null>(null)

  // Estado da Pré-visualização Principal
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
    clausulasPersonalizadas?: ClausulasContrato
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

  // Contratos que estão vencendo nos próximos 30 dias (para notificação no topo da página)
  const contratosVencendo = useMemo(() => {
    return contratosSalvos
      .map((c) => {
        const dataFimCalculada = c.data_final
          ? c.data_final.slice(0, 10)
          : calcularDataFinal(c.data_inicio ? c.data_inicio.slice(0, 10) : '', c.quantidade_meses)
        const { dias, isVigente, isVencendo } = calcularDiasRestantesContrato(dataFimCalculada)
        const emp = c.expand?.contratante || empresas.find((e) => e.id === c.contratante)
        return {
          ...c,
          empresaNome: emp?.nome || 'Empresa Cliente',
          dataFinalReal: dataFimCalculada,
          diasRestantes: dias,
          isVigente,
          isVencendo,
        }
      })
      .filter((c) => c.isVencendo)
  }, [contratosSalvos, empresas])

  // Lista de contratos do histórico filtrada
  const contratosFiltradosHistorico = useMemo(() => {
    return contratosSalvos
      .map((c) => {
        const emp = c.expand?.contratante || empresas.find((e) => e.id === c.contratante)
        const dataFimCalculada = c.data_final
          ? c.data_final.slice(0, 10)
          : calcularDataFinal(c.data_inicio ? c.data_inicio.slice(0, 10) : '', c.quantidade_meses)
        const { dias, isVigente } = calcularDiasRestantesContrato(dataFimCalculada)
        return {
          ...c,
          empresaNome: emp?.nome || 'Empresa Cliente',
          empresaCnpj: emp?.cnpj || '',
          dataFinalReal: dataFimCalculada,
          diasRestantes: dias,
          isVigente,
        }
      })
      .filter((c) => {
        // Filtro por cliente
        if (filtroHistoricoCliente !== 'todos' && c.contratante !== filtroHistoricoCliente) {
          return false
        }

        // Filtro por status
        if (filtroHistoricoStatus === 'vigente' && !c.isVigente) return false
        if (filtroHistoricoStatus === 'encerrado' && c.isVigente) return false

        // Filtro por busca de texto (nome ou cnpj)
        if (filtroHistoricoBusca.trim()) {
          const q = filtroHistoricoBusca.toLowerCase()
          const matchNome = c.empresaNome.toLowerCase().includes(q)
          const matchCnpj = c.empresaCnpj.toLowerCase().includes(q)
          if (!matchNome && !matchCnpj) return false
        }

        // Filtro por data de início
        if (filtroHistoricoDataInicio) {
          const inicioStr = (c.data_inicio || '').slice(0, 10)
          if (inicioStr < filtroHistoricoDataInicio) return false
        }

        return true
      })
  }, [
    contratosSalvos,
    empresas,
    filtroHistoricoCliente,
    filtroHistoricoStatus,
    filtroHistoricoBusca,
    filtroHistoricoDataInicio,
  ])

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
  const handleGerarContrato = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
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
    const parcelasPreview = recebiveisService
      .calcularPreviewParcelas({
        empresa: contratanteSelecionada.id,
        data_inicio_servicos: dataInicio,
        dia_vencimento: diaVencimento,
        valor: valorNumerico,
        meses: Number(quantidadeMeses),
        lembrete_agendado: enviarLembretesContrato,
      })
      .map((p) => ({
        ...p,
        lembrete_agendado: enviarLembretesContrato,
      }))

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
      clausulasPersonalizadas: { ...clausulas },
      parcelas: parcelasPreview,
    })

    setContratoSalvoId(null)
    setFinanceiroGerado(false)

    toast({
      title: 'Contrato gerado com sucesso!',
      description:
        'A pré-visualização foi atualizada. Você pode imprimir, salvar ou gerar as parcelas no financeiro.',
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
        description: `O contrato com ${contratoGerado.contratante.razao_social} foi registrado no histórico.`,
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
          lembrete_agendado: enviarLembretesContrato,
          nfse_automatica_agendada: true,
        },
        contratoGerado.parcelas.map((p) => ({
          ...p,
          lembrete_agendado:
            p.lembrete_agendado !== undefined ? p.lembrete_agendado : enviarLembretesContrato,
          nfse_automatica_agendada:
            p.nfse_automatica_agendada !== undefined ? p.nfse_automatica_agendada : true,
        })),
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

  // Ação de Renovar contrato existente: pré-preenche o formulário com a nova data de início sendo a data final do contrato anterior
  const handleRenovarContrato = (c: ContratoRecord) => {
    const dataFimAnterior = c.data_final
      ? c.data_final.slice(0, 10)
      : calcularDataFinal(c.data_inicio ? c.data_inicio.slice(0, 10) : '', c.quantidade_meses)

    // Data de início da renovação = data final do contrato anterior (ou hoje se já passou)
    const dataInicioRenovacao = dataFimAnterior >= dataHojeIso() ? dataFimAnterior : dataHojeIso()

    setContratanteId(c.contratante)
    setDataInicio(dataInicioRenovacao)
    setPrazoInicial(c.prazo_inicial || 1)
    setQuantidadeMeses(c.quantidade_meses || 12)
    setValorInput(formatarInputMoeda(Number(c.valor_parcela) || 0))
    setDiaVencimento(c.dia_vencimento || 10)

    setContratoSalvoId(null)
    setFinanceiroGerado(false)
    setAbaAtiva('novo')

    toast({
      title: 'Formulário pré-preenchido para Renovação',
      description: `Definida data de início em ${formatarDataBr(dataInicioRenovacao)} com os parâmetros do contrato anterior.`,
    })
  }

  // Carregar contrato salvo para visualização na tela principal de edição
  const handleCarregarContratoSalvo = (c: ContratoRecord) => {
    const contratanteObj = c.expand?.contratante || empresas.find((e) => e.id === c.contratante)
    const valorNum = Number(c.valor_parcela) || 0
    const dataInicioStr = c.data_inicio ? c.data_inicio.slice(0, 10) : dataHojeIso()
    const dataFimCalculada = c.data_final
      ? c.data_final.slice(0, 10)
      : calcularDataFinal(dataInicioStr, c.quantidade_meses)

    const parcelasPreview = recebiveisService
      .calcularPreviewParcelas({
        empresa: c.contratante,
        data_inicio_servicos: dataInicioStr,
        dia_vencimento: c.dia_vencimento,
        valor: valorNum,
        meses: c.quantidade_meses,
        lembrete_agendado: enviarLembretesContrato,
      })
      .map((p) => ({
        ...p,
        lembrete_agendado: enviarLembretesContrato,
      }))

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
      clausulasPersonalizadas: { ...clausulas },
      parcelas: parcelasPreview,
    })

    setContratoSalvoId(c.id)
    setFinanceiroGerado(false)
    setAbaAtiva('novo')

    toast({
      title: 'Contrato carregado',
      description: `Contrato de ${contratanteObj?.nome || 'Empresa'} carregado na pré-visualização.`,
    })
  }

  // Abrir modal de visualização A4 do contrato do histórico
  const handleAbrirPreviewModal = (c: ContratoRecord) => {
    setContratoParaVisualizar(c)
    setPreviewModalOpen(true)
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

  // Handlers para o Modal de Personalização de Cláusulas
  const handleAbrirModalClausulas = () => {
    setClausulasEdit({ ...clausulas })
    setModalClausulasOpen(true)
  }

  const handleSalvarClausulasPersonalizadas = () => {
    setClausulas({ ...clausulasEdit })
    if (contratoGerado) {
      setContratoGerado((prev) =>
        prev ? { ...prev, clausulasPersonalizadas: { ...clausulasEdit } } : null,
      )
    }
    setModalClausulasOpen(false)
    toast({
      title: 'Cláusulas atualizadas!',
      description: 'As alterações foram salvas para esta sessão do contrato.',
    })
  }

  const handleRestaurarClausulasPadrao = () => {
    setClausulasEdit({ ...CLAUSULAS_PADRAO })
    toast({
      title: 'Texto padrão restaurado',
      description: 'As cláusulas retornaram ao modelo padrão original.',
    })
  }

  // Renderiza o texto da cláusula substituindo variáveis
  const renderClausulaTexto = (template: string, dados: typeof contratoGerado) => {
    if (!dados) return template
    const cidadeEstado =
      dados.contratada.cidade || dados.contratante.cidade
        ? `${dados.contratada.cidade || dados.contratante.cidade || 'São Paulo'}/${dados.contratada.estado || dados.contratante.estado || 'SP'}`
        : 'São Paulo/SP'

    return template
      .replace(/{MESES}/g, String(dados.quantidade_meses))
      .replace(/{DATA_INICIO}/g, formatarDataBr(dados.data_inicio))
      .replace(/{DATA_FINAL}/g, formatarDataBr(dados.data_final))
      .replace(/{PRAZO_INICIAL}/g, String(dados.prazo_inicial))
      .replace(/{PRAZO_INICIAL_LABEL}/g, dados.prazo_inicial === 1 ? 'mês' : 'meses')
      .replace(/{VALOR_PARCELA}/g, formatarMoeda(dados.valor_parcela))
      .replace(/{VALOR_TOTAL}/g, formatarMoeda(totalGeralCalculado))
      .replace(/{DIA_VENCIMENTO}/g, String(dados.dia_vencimento))
      .replace(/{CIDADE_ESTADO}/g, cidadeEstado)
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

      {/* 2.3 NOTIFICAÇÃO DE RENOVAÇÃO NO TOPO DA PÁGINA DE CONTRATOS (Banner de Alerta) */}
      {contratosVencendo.length > 0 && (
        <div className="no-print space-y-2">
          {contratosVencendo.map((cv) => (
            <div
              key={`aviso-venc-${cv.id}`}
              className="bg-amber-50/90 border border-amber-300 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
            >
              <div className="flex items-start sm:items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-amber-950">
                    Contrato com {cv.empresaNome} vence em{' '}
                    <span className="text-amber-800 underline font-extrabold">
                      {cv.diasRestantes === 0
                        ? 'hoje'
                        : `${cv.diasRestantes} ${cv.diasRestantes === 1 ? 'dia' : 'dias'}`}
                    </span>{' '}
                    ({formatarDataBr(cv.dataFinalReal)})
                  </p>
                  <p className="text-[11px] text-amber-800 mt-0.5">
                    O contrato atual está próximo do término. Prepare a renovação para garantir a
                    continuidade da prestação de serviços.
                  </p>
                </div>
              </div>

              <Button
                type="button"
                size="sm"
                onClick={() => handleRenovarContrato(cv)}
                className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold gap-1.5 self-start sm:self-auto shrink-0 shadow-xs"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Renovar Contrato
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Cabeçalho da Página */}
      <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#0B1F3A] tracking-tight flex items-center gap-2">
            <FileSignature className="w-5 h-5 text-blue-600" />
            Contratos de Prestação de Serviço
          </h1>
          <p className="text-xs text-[#5B6B7F]">
            Elabore, personalize cláusulas, visualize histórico e renove contratos de consultoria
            financeira.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
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

      {/* Abas Principais: "Novo Contrato" vs "Histórico de Contratos" */}
      <Tabs
        value={abaAtiva}
        onValueChange={(v) => setAbaAtiva(v as 'novo' | 'historico')}
        className="space-y-4"
      >
        <div className="no-print border-b border-slate-200">
          <TabsList className="bg-slate-100 p-1 rounded-xl h-10">
            <TabsTrigger
              value="novo"
              className="text-xs font-bold rounded-lg px-4 gap-1.5 data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-xs"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              Novo Contrato / Edição
            </TabsTrigger>
            <TabsTrigger
              value="historico"
              className="text-xs font-bold rounded-lg px-4 gap-1.5 data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-xs"
            >
              <History className="w-3.5 h-3.5" />
              Histórico de Contratos ({contratosSalvos.length})
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ========================================================================= */}
        {/* ABA 1: GERADOR DE CONTRATO (FORMULÁRIO + PRÉ-VISUALIZAÇÃO A4) */}
        {/* ========================================================================= */}
        <TabsContent value="novo" className="space-y-6 focus-visible:outline-none">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* LADO ESQUERDO: Formulário de Geração (5 colunas no desktop) */}
            <div className="no-print lg:col-span-5 space-y-4">
              <Card className="bg-white border-slate-200 shadow-xs">
                <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
                      <FileSignature className="w-4 h-4 text-blue-600" />
                      Dados do Contrato
                    </CardTitle>
                    <CardDescription className="text-xs mt-0.5">
                      Preencha os parâmetros para redigir o contrato e calcular o cronograma.
                    </CardDescription>
                  </div>

                  {/* 2.1 Botão Personalizar Cláusulas */}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAbrirModalClausulas}
                    className="text-xs border-blue-200 text-blue-700 hover:bg-blue-50 font-semibold gap-1.5 shrink-0"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600" />
                    Personalizar Cláusulas
                  </Button>
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
                              <p className="font-semibold text-slate-700 text-[11px]">
                                {crcContador}
                              </p>
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
                        <p className="text-[11px] text-red-600 font-medium">
                          {formErrors.contratante}
                        </p>
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
                            <strong className="text-slate-800">Endereço:</strong>{' '}
                            {enderecoContratante}
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
                          <SelectTrigger
                            id="contrato-dia-vencimento"
                            className="h-9 text-xs bg-white"
                          >
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

                    {/* Checkbox de Lembrete de Vencimento ao Contratante */}
                    <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-200/70 flex items-start gap-2.5">
                      <Checkbox
                        id="contrato-lembrete-checkbox"
                        checked={enviarLembretesContrato}
                        onCheckedChange={(checked) => {
                          const val = Boolean(checked)
                          setEnviarLembretesContrato(val)
                          if (contratoGerado) {
                            setContratoGerado((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    parcelas: prev.parcelas.map((p) => ({
                                      ...p,
                                      lembrete_agendado: val,
                                    })),
                                  }
                                : null,
                            )
                          }
                        }}
                        className="mt-0.5 border-blue-400 data-[state=checked]:bg-blue-600"
                      />
                      <div className="space-y-0.5">
                        <label
                          htmlFor="contrato-lembrete-checkbox"
                          className="text-xs font-bold text-blue-950 flex items-center gap-1.5 cursor-pointer"
                        >
                          <Mail className="w-3.5 h-3.5 text-blue-600" />
                          Enviar lembretes de vencimento ao contratante
                        </label>
                        <p className="text-[11px] text-slate-600 leading-relaxed">
                          Ao salvar e gerar recebíveis no Financeiro, programa e-mails automáticos
                          de lembrete de vencimento com chave PIX e dados de pagamento ao cliente.
                        </p>
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
                    <h3 className="text-base font-bold text-[#0B1F3A]">
                      Pré-visualização do Contrato
                    </h3>
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
                      Por este instrumento particular de contrato de prestação de serviços, de um
                      lado:
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
                      Têm entre si, justo e acordado, o presente Contrato de Prestação de Serviços
                      de Consultoria Financeira, que se regerá pelas seguintes cláusulas e
                      condições:
                    </p>
                  </div>

                  {/* Cláusulas do Contrato (Utilizando as personalizadas se houver) */}
                  <div className="space-y-4 text-justify">
                    {/* CLÁUSULA 1 - DO OBJETO */}
                    <div className="space-y-1.5">
                      <h3 className="font-bold text-slate-950 font-sans uppercase text-xs sm:text-sm">
                        CLÁUSULA PRIMEIRA – DO OBJETO
                      </h3>
                      <p className="whitespace-pre-line">
                        {renderClausulaTexto(
                          contratoGerado.clausulasPersonalizadas?.objeto || clausulas.objeto,
                          contratoGerado,
                        )}
                      </p>
                    </div>

                    {/* CLÁUSULA 2 - DO PRAZO */}
                    <div className="space-y-1.5">
                      <h3 className="font-bold text-slate-950 font-sans uppercase text-xs sm:text-sm">
                        CLÁUSULA SEGUNDA – DO PRAZO E VIGÊNCIA
                      </h3>
                      <p className="whitespace-pre-line">
                        {renderClausulaTexto(
                          contratoGerado.clausulasPersonalizadas?.prazo || clausulas.prazo,
                          contratoGerado,
                        )}
                      </p>
                    </div>

                    {/* CLÁUSULA 3 - DO VALOR E FORMA DE PAGAMENTO */}
                    <div className="space-y-1.5">
                      <h3 className="font-bold text-slate-950 font-sans uppercase text-xs sm:text-sm">
                        CLÁUSULA TERCEIRA – DO VALOR E DA FORMA DE PAGAMENTO
                      </h3>
                      <p className="whitespace-pre-line">
                        {renderClausulaTexto(
                          contratoGerado.clausulasPersonalizadas?.valor || clausulas.valor,
                          contratoGerado,
                        )}
                      </p>
                    </div>

                    {/* CLÁUSULA 4 - DO REAJUSTE */}
                    <div className="space-y-1.5">
                      <h3 className="font-bold text-slate-950 font-sans uppercase text-xs sm:text-sm">
                        CLÁUSULA QUARTA – DO REAJUSTE ANUAL
                      </h3>
                      <p className="whitespace-pre-line">
                        {renderClausulaTexto(
                          contratoGerado.clausulasPersonalizadas?.reajuste || clausulas.reajuste,
                          contratoGerado,
                        )}
                      </p>
                    </div>

                    {/* CLÁUSULA 5 - DAS OBRIGAÇÕES */}
                    <div className="space-y-1.5">
                      <h3 className="font-bold text-slate-950 font-sans uppercase text-xs sm:text-sm">
                        CLÁUSULA QUINTA – DAS OBRIGAÇÕES DAS PARTES
                      </h3>
                      <p className="whitespace-pre-line">
                        {renderClausulaTexto(
                          contratoGerado.clausulasPersonalizadas?.obrigacoes ||
                            clausulas.obrigacoes,
                          contratoGerado,
                        )}
                      </p>
                    </div>

                    {/* CLÁUSULA 6 - DO FORO */}
                    <div className="space-y-1.5">
                      <h3 className="font-bold text-slate-950 font-sans uppercase text-xs sm:text-sm">
                        CLÁUSULA SEXTA – DO FORO
                      </h3>
                      <p className="whitespace-pre-line">
                        {renderClausulaTexto(
                          contratoGerado.clausulasPersonalizadas?.foro || clausulas.foro,
                          contratoGerado,
                        )}
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
                        <p className="text-slate-500 text-[10px]">
                          {contratoGerado.contratada.crc}
                        </p>
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
        </TabsContent>

        {/* ========================================================================= */}
        {/* ABA 2: HISTÓRICO DE CONTRATOS (2.2 HISTÓRICO COMPLETO COM FILTROS E TABELA) */}
        {/* ========================================================================= */}
        <TabsContent value="historico" className="space-y-4 focus-visible:outline-none">
          <Card className="bg-white border-slate-200 shadow-xs">
            <CardHeader className="pb-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
                  <History className="w-4 h-4 text-blue-600" />
                  Histórico de Contratos Salvos
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Lista detalhada de todos os contratos gerados e salvos, com filtros por cliente,
                  período e status de vigência.
                </CardDescription>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setAbaAtiva('novo')}
                  className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold gap-1.5 shadow-2xs"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  Criar Novo Contrato
                </Button>
              </div>
            </CardHeader>

            <CardContent className="pt-4 space-y-4">
              {/* Barra de Filtros */}
              <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3.5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* 1. Busca por texto */}
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-slate-600 flex items-center gap-1">
                    <Search className="w-3 h-3 text-blue-600" />
                    Buscar por cliente/CNPJ
                  </Label>
                  <Input
                    type="text"
                    placeholder="Nome da empresa ou CNPJ..."
                    value={filtroHistoricoBusca}
                    onChange={(e) => setFiltroHistoricoBusca(e.target.value)}
                    className="h-8 text-xs bg-white"
                  />
                </div>

                {/* 2. Filtro por Cliente (Select) */}
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-slate-600 flex items-center gap-1">
                    <Building2 className="w-3 h-3 text-blue-600" />
                    Empresa Contratante
                  </Label>
                  <Select
                    value={filtroHistoricoCliente}
                    onValueChange={(val) => setFiltroHistoricoCliente(val)}
                  >
                    <SelectTrigger className="h-8 text-xs bg-white">
                      <SelectValue placeholder="Todas as empresas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos" className="text-xs">
                        Todas as empresas ({empresas.length})
                      </SelectItem>
                      {empresas.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id} className="text-xs">
                          {emp.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* 3. Filtro por Status (Vigente / Encerrado) */}
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-slate-600 flex items-center gap-1">
                    <Filter className="w-3 h-3 text-blue-600" />
                    Status do Contrato
                  </Label>
                  <Select
                    value={filtroHistoricoStatus}
                    onValueChange={(val: any) => setFiltroHistoricoStatus(val)}
                  >
                    <SelectTrigger className="h-8 text-xs bg-white">
                      <SelectValue placeholder="Todos os status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos" className="text-xs">
                        Todos os status
                      </SelectItem>
                      <SelectItem
                        value="vigente"
                        className="text-xs text-emerald-700 font-semibold"
                      >
                        🟢 Vigente (data final &gt; hoje)
                      </SelectItem>
                      <SelectItem
                        value="encerrado"
                        className="text-xs text-slate-600 font-semibold"
                      >
                        ⚪ Encerrado (já passou)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* 4. Filtro por Data de Início */}
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-slate-600 flex items-center gap-1">
                    <CalendarIcon className="w-3 h-3 text-blue-600" />
                    A partir de (Início)
                  </Label>
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="date"
                      value={filtroHistoricoDataInicio}
                      onChange={(e) => setFiltroHistoricoDataInicio(e.target.value)}
                      className="h-8 text-xs bg-white"
                    />
                    {filtroHistoricoDataInicio && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setFiltroHistoricoDataInicio('')}
                        className="h-8 px-2 text-[11px] text-slate-500 hover:text-red-600"
                        title="Limpar data"
                      >
                        Limpar
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* Tabela de Contratos */}
              {loadingContratos ? (
                <div className="py-16 text-center text-xs text-slate-500">
                  <div className="w-7 h-7 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  Carregando histórico de contratos...
                </div>
              ) : contratosFiltradosHistorico.length === 0 ? (
                <div className="py-16 flex flex-col items-center justify-center text-center bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                  <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
                    <FileSignature className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-bold text-[#0B1F3A]">Nenhum contrato encontrado</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mb-4">
                    {contratosSalvos.length === 0
                      ? 'Nenhum contrato foi registrado até o momento. Preencha os dados na aba "Novo Contrato" para gerar o primeiro.'
                      : 'Nenhum contrato corresponde aos filtros aplicados.'}
                  </p>
                  {contratosSalvos.length > 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setFiltroHistoricoBusca('')
                        setFiltroHistoricoCliente('todos')
                        setFiltroHistoricoStatus('todos')
                        setFiltroHistoricoDataInicio('')
                      }}
                      className="text-xs font-semibold text-blue-700"
                    >
                      Limpar Filtros
                    </Button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold">
                        <th className="py-3 px-3">Contratante</th>
                        <th className="py-3 px-3">Data Início</th>
                        <th className="py-3 px-3">Data Final</th>
                        <th className="py-3 px-3 text-right">Valor Parcela</th>
                        <th className="py-3 px-3 text-center">Total Parcelas</th>
                        <th className="py-3 px-3 text-right">Total Contrato</th>
                        <th className="py-3 px-3 text-center">Status</th>
                        <th className="py-3 px-3 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {contratosFiltradosHistorico.map((c) => {
                        const valorNum = Number(c.valor_parcela) || 0
                        const mesesNum = Number(c.quantidade_meses) || 1
                        const totalContrato = valorNum * mesesNum

                        return (
                          <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                            {/* Contratante */}
                            <td className="py-3 px-3">
                              <div>
                                <span className="font-bold text-slate-900 block truncate max-w-[200px]">
                                  {c.empresaNome}
                                </span>
                                <span className="text-[11px] text-slate-400 font-mono">
                                  {c.empresaCnpj || 'CNPJ não informado'}
                                </span>
                              </div>
                            </td>

                            {/* Data Início */}
                            <td className="py-3 px-3 font-medium text-slate-700">
                              {formatarDataBr(c.data_inicio)}
                            </td>

                            {/* Data Final */}
                            <td className="py-3 px-3 font-medium text-slate-700">
                              <div>
                                <span>{formatarDataBr(c.dataFinalReal)}</span>
                                {c.isVigente && (
                                  <span className="block text-[10px] text-emerald-600 font-semibold">
                                    {c.diasRestantes === 0
                                      ? 'vence hoje'
                                      : `vence em ${c.diasRestantes}d`}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Valor Parcela */}
                            <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                              {formatarMoeda(valorNum)}
                            </td>

                            {/* Total de Parcelas */}
                            <td className="py-3 px-3 text-center">
                              <Badge
                                variant="outline"
                                className="text-[10px] bg-blue-50 text-blue-700 border-blue-200 font-mono font-bold"
                              >
                                {mesesNum} parcelas
                              </Badge>
                            </td>

                            {/* Total Contrato */}
                            <td className="py-3 px-3 text-right font-mono font-bold text-emerald-700">
                              {formatarMoeda(totalContrato)}
                            </td>

                            {/* Status: Badge Verde "Vigente" vs Badge Cinza "Encerrado" */}
                            <td className="py-3 px-3 text-center">
                              {c.isVigente ? (
                                <Badge className="bg-emerald-50 text-emerald-700 border-emerald-300 text-[10px] font-bold px-2 py-0.5">
                                  🟢 Vigente
                                </Badge>
                              ) : (
                                <Badge className="bg-slate-100 text-slate-600 border-slate-300 text-[10px] font-bold px-2 py-0.5">
                                  ⚪ Encerrado
                                </Badge>
                              )}
                            </td>

                            {/* Botões de Ação */}
                            <td className="py-3 px-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {/* Botão Visualizar (Abre Pré-visualização A4) */}
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleCarregarContratoSalvo(c)}
                                  className="h-7 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2"
                                  title="Carregar para edição e impressão"
                                >
                                  <Eye className="w-3.5 h-3.5 mr-1" />
                                  Visualizar
                                </Button>

                                {/* Botão Renovar (se for vigente ou expirando) */}
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRenovarContrato(c)}
                                  className="h-7 text-xs text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 px-2"
                                  title="Renovar contrato"
                                >
                                  <RefreshCw className="w-3.5 h-3.5 mr-1" />
                                  Renovar
                                </Button>

                                {/* Botão Excluir */}
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => handleExcluirContratoSalvo(c.id, e)}
                                  className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                  title="Excluir contrato"
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
        </TabsContent>
      </Tabs>

      {/* ========================================================================= */}
      {/* 2.1 MODAL DE PERSONALIZAÇÃO DAS 6 CLÁUSULAS */}
      {/* ========================================================================= */}
      <Dialog open={modalClausulasOpen} onOpenChange={setModalClausulasOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-base font-bold text-[#0B1F3A] flex items-center gap-2">
                  <SlidersHorizontal className="w-5 h-5 text-blue-600" />
                  Personalizar Cláusulas do Contrato
                </DialogTitle>
                <DialogDescription className="text-xs mt-0.5">
                  Edite o texto das 6 cláusulas antes de gerar o contrato. As alterações são
                  mantidas na sua sessão.
                </DialogDescription>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRestaurarClausulasPadrao}
                className="text-xs border-slate-200 text-slate-700 hover:bg-slate-100 gap-1.5 shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                Restaurar padrão
              </Button>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Cláusula 1 */}
            <div className="space-y-1.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
              <Label className="text-xs font-bold text-[#0B1F3A] uppercase tracking-wide">
                Cláusula Primeira – Do Objeto
              </Label>
              <Textarea
                rows={3}
                value={clausulasEdit.objeto}
                onChange={(e) => setClausulasEdit((prev) => ({ ...prev, objeto: e.target.value }))}
                className="text-xs bg-white resize-y font-sans leading-relaxed"
                placeholder="Texto da Cláusula do Objeto..."
              />
            </div>

            {/* Cláusula 2 */}
            <div className="space-y-1.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-[#0B1F3A] uppercase tracking-wide">
                  Cláusula Segunda – Do Prazo e Vigência
                </Label>
                <span className="text-[10px] text-slate-400">
                  Variáveis: {'{MESES}'}, {'{DATA_INICIO}'}, {'{DATA_FINAL}'}, {'{PRAZO_INICIAL}'}
                </span>
              </div>
              <Textarea
                rows={4}
                value={clausulasEdit.prazo}
                onChange={(e) => setClausulasEdit((prev) => ({ ...prev, prazo: e.target.value }))}
                className="text-xs bg-white resize-y font-sans leading-relaxed"
                placeholder="Texto da Cláusula de Prazo..."
              />
            </div>

            {/* Cláusula 3 */}
            <div className="space-y-1.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-[#0B1F3A] uppercase tracking-wide">
                  Cláusula Terceira – Do Valor e da Forma de Pagamento
                </Label>
                <span className="text-[10px] text-slate-400">
                  Variáveis: {'{VALOR_PARCELA}'}, {'{VALOR_TOTAL}'}, {'{DIA_VENCIMENTO}'}
                </span>
              </div>
              <Textarea
                rows={4}
                value={clausulasEdit.valor}
                onChange={(e) => setClausulasEdit((prev) => ({ ...prev, valor: e.target.value }))}
                className="text-xs bg-white resize-y font-sans leading-relaxed"
                placeholder="Texto da Cláusula de Pagamento..."
              />
            </div>

            {/* Cláusula 4 */}
            <div className="space-y-1.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
              <Label className="text-xs font-bold text-[#0B1F3A] uppercase tracking-wide">
                Cláusula Quarta – Do Reajuste Anual
              </Label>
              <Textarea
                rows={3}
                value={clausulasEdit.reajuste}
                onChange={(e) =>
                  setClausulasEdit((prev) => ({ ...prev, reajuste: e.target.value }))
                }
                className="text-xs bg-white resize-y font-sans leading-relaxed"
                placeholder="Texto da Cláusula de Reajuste..."
              />
            </div>

            {/* Cláusula 5 */}
            <div className="space-y-1.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
              <Label className="text-xs font-bold text-[#0B1F3A] uppercase tracking-wide">
                Cláusula Quinta – Das Obrigações das Partes
              </Label>
              <Textarea
                rows={4}
                value={clausulasEdit.obrigacoes}
                onChange={(e) =>
                  setClausulasEdit((prev) => ({ ...prev, obrigacoes: e.target.value }))
                }
                className="text-xs bg-white resize-y font-sans leading-relaxed"
                placeholder="Texto da Cláusula de Obrigações..."
              />
            </div>

            {/* Cláusula 6 */}
            <div className="space-y-1.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-[#0B1F3A] uppercase tracking-wide">
                  Cláusula Sexta – Do Foro
                </Label>
                <span className="text-[10px] text-slate-400">Variável: {'{CIDADE_ESTADO}'}</span>
              </div>
              <Textarea
                rows={3}
                value={clausulasEdit.foro}
                onChange={(e) => setClausulasEdit((prev) => ({ ...prev, foro: e.target.value }))}
                className="text-xs bg-white resize-y font-sans leading-relaxed"
                placeholder="Texto da Cláusula de Foro..."
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setModalClausulasOpen(false)}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSalvarClausulasPersonalizadas}
              className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold"
            >
              Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
