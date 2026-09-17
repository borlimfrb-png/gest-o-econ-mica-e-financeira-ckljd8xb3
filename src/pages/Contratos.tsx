import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { empresasService } from '@/services/financeService'
import { contratosService } from '@/services/contratosService'
import {
  recebiveisService,
  type ParcelaPreview,
  type ResumoTitulosContrato,
  type SincronizarTitulosContratoResult,
} from '@/services/recebiveisService'
import pb from '@/lib/pocketbase/client'
import { useMinhaEmpresa } from '@/contexts/MinhaEmpresaContext'
import { useToast } from '@/hooks/use-toast'
import useRealtime from '@/hooks/use-realtime'
import type {
  EmpresaRecord,
  ContratoRecord,
  PeriodoCobrancaItem,
  RecebivelRecord,
} from '@/types/finance'
import {
  calcularMensalidadesPeriodo,
  normalizarPeriodoCobranca,
  gerarParcelasDePeriodos,
  numeroPorExtenso,
} from '@/lib/periodosCobranca'
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
  CreditCard,
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
    'Pelos serviços prestados, a CONTRATANTE pagará à CONTRATADA o valor mensal de {VALOR_PARCELA}, totalizando o valor global de {VALOR_TOTAL} ao longo da vigência contratual de {MESES} meses.\n\n{CONDICOES_PAGAMENTO_DETALHADAS}\n\nOs pagamentos serão efetuados mediante as formas acordadas (Pix, Boleto Bancário, Transferência ou Cartão) conforme dados bancários informados pela CONTRATADA.',
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

  // PERÍODOS DE COBRANÇA RECORRENTES (Faixas de valores por período)
  // Exemplo do usuário: 16/10/2026 a 16/01/2027 a R$ 1.500/mês (4 meses)
  // Período 2: 16/02/2027 a 16/10/2027 a R$ 2.000/mês (9 meses)
  const [periodo1Inicio, setPeriodo1Inicio] = useState<string>('')
  const [periodo1Final, setPeriodo1Final] = useState<string>('')
  const [periodo1ValorInput, setPeriodo1ValorInput] = useState<string>('')
  const [periodo1Forma, setPeriodo1Forma] = useState<string>('Pix')

  const [habilitarPeriodo2, setHabilitarPeriodo2] = useState<boolean>(false)
  const [periodo2Inicio, setPeriodo2Inicio] = useState<string>('')
  const [periodo2Final, setPeriodo2Final] = useState<string>('')
  const [periodo2ValorInput, setPeriodo2ValorInput] = useState<string>('')
  const [periodo2Forma, setPeriodo2Forma] = useState<string>('Boleto Bancário')

  const [observacoesPagamento, setObservacoesPagamento] = useState<string>('')

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
    // Cronograma de Períodos de Cobrança
    periodos_cobranca: PeriodoCobrancaItem[]
    // Compatibilidade com formas pontuais
    forma_pagamento_1: string
    valor_1: number
    vencimento_1?: string
    forma_pagamento_2?: string
    valor_2?: number
    vencimento_2?: string
    observacoes_pagamento?: string
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

  // Resumo de títulos por contrato: idContrato => { total, pagos, pendentes, totalValor, valorPago, valorPendente }
  const [resumosTitulosContrato, setResumosTitulosContrato] = useState<
    Record<string, ResumoTitulosContrato>
  >({})
  const [carregandoResumosTitulos, setCarregandoResumosTitulos] = useState<boolean>(false)

  // Carrega contratos salvos e seus resumos de recebíveis
  const carregarContratos = useCallback(async () => {
    try {
      setLoadingContratos(true)
      const list = await contratosService.listar()
      setContratosSalvos(list)

      // Carrega estatísticas de títulos para cada contrato
      try {
        setCarregandoResumosTitulos(true)
        const todosRecebiveis = await pb.collection('recebiveis').getFullList<RecebivelRecord>({
          filter: "contrato != '' && contrato != null",
          fields: 'id,contrato,status,valor',
        })
        const mapa: Record<string, ResumoTitulosContrato> = {}
        for (const c of list) {
          mapa[c.id] = {
            contratoId: c.id,
            total: 0,
            pagos: 0,
            pendentes: 0,
            totalValor: 0,
            valorPago: 0,
            valorPendente: 0,
          }
        }
        for (const r of todosRecebiveis) {
          const cId = r.contrato
          if (cId && mapa[cId]) {
            const v = Number(r.valor) || 0
            mapa[cId].total += 1
            mapa[cId].totalValor += v
            if (r.status === 'Pago') {
              mapa[cId].pagos += 1
              mapa[cId].valorPago += v
            } else {
              mapa[cId].pendentes += 1
              mapa[cId].valorPendente += v
            }
          }
        }
        setResumosTitulosContrato(mapa)
      } catch (errResumo) {
        console.warn('Não foi possível carregar resumos de títulos:', errResumo)
      } finally {
        setCarregandoResumosTitulos(false)
      }
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

  const handlePeriodo1ValorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    const parsed = parseValorMonetario(raw)
    setPeriodo1ValorInput(parsed > 0 ? formatarInputMoeda(parsed) : '')
  }

  const handlePeriodo2ValorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    const parsed = parseValorMonetario(raw)
    setPeriodo2ValorInput(parsed > 0 ? formatarInputMoeda(parsed) : '')
  }

  // Cálculos de datas e mensalidades por período
  const periodo1DataIniEfetiva = periodo1Inicio || dataInicio
  const periodo1DataFimEfetiva =
    periodo1Final || calcularDataFinal(periodo1DataIniEfetiva, quantidadeMeses)
  const periodo1ValorMensalNum =
    parseValorMonetario(periodo1ValorInput) || parseValorMonetario(valorInput)
  const periodo1MesesCalculados = useMemo(() => {
    return calcularMensalidadesPeriodo(periodo1DataIniEfetiva, periodo1DataFimEfetiva)
  }, [periodo1DataIniEfetiva, periodo1DataFimEfetiva])
  const periodo1TotalFinanceiro = useMemo(() => {
    return periodo1MesesCalculados * periodo1ValorMensalNum
  }, [periodo1MesesCalculados, periodo1ValorMensalNum])

  const periodo2ValorMensalNum = habilitarPeriodo2 ? parseValorMonetario(periodo2ValorInput) : 0
  const periodo2MesesCalculados = useMemo(() => {
    if (!habilitarPeriodo2 || !periodo2Inicio || !periodo2Final) return 0
    return calcularMensalidadesPeriodo(periodo2Inicio, periodo2Final)
  }, [habilitarPeriodo2, periodo2Inicio, periodo2Final])
  const periodo2TotalFinanceiro = useMemo(() => {
    return periodo2MesesCalculados * periodo2ValorMensalNum
  }, [periodo2MesesCalculados, periodo2ValorMensalNum])

  // Total de mensalidades geradas somando os períodos
  const totalMensalidadesPeriodos = useMemo(() => {
    return periodo1MesesCalculados + (habilitarPeriodo2 ? periodo2MesesCalculados : 0)
  }, [periodo1MesesCalculados, habilitarPeriodo2, periodo2MesesCalculados])

  // Total financeiro somando todos os períodos
  const totalFinanceiroPeriodos = useMemo(() => {
    return periodo1TotalFinanceiro + (habilitarPeriodo2 ? periodo2TotalFinanceiro : 0)
  }, [periodo1TotalFinanceiro, habilitarPeriodo2, periodo2TotalFinanceiro])

  // Total de parcelas informado no contrato
  const parcelasContratoTotal = Number(quantidadeMeses) || 12

  // Divergência entre mensalidades geradas e parcelas do contrato
  const temDivergenciaParcelas = useMemo(() => {
    if (totalMensalidadesPeriodos === 0) return false
    return totalMensalidadesPeriodos !== parcelasContratoTotal
  }, [totalMensalidadesPeriodos, parcelasContratoTotal])

  // Lista de períodos normalizada
  const listaPeriodosAtual: PeriodoCobrancaItem[] = useMemo(() => {
    const list: PeriodoCobrancaItem[] = []
    if (periodo1DataIniEfetiva && periodo1DataFimEfetiva) {
      list.push(
        normalizarPeriodoCobranca(
          {
            id: 'periodo-1',
            ordem: 1,
            data_inicio: periodo1DataIniEfetiva,
            data_final: periodo1DataFimEfetiva,
            valor_mensal: periodo1ValorMensalNum,
            forma_pagamento: periodo1Forma || 'Pix',
            meses: periodo1MesesCalculados,
            total: periodo1TotalFinanceiro,
          },
          1,
        ),
      )
    }

    if (habilitarPeriodo2 && periodo2Inicio && periodo2Final) {
      list.push(
        normalizarPeriodoCobranca(
          {
            id: 'periodo-2',
            ordem: 2,
            data_inicio: periodo2Inicio,
            data_final: periodo2Final,
            valor_mensal: periodo2ValorMensalNum,
            forma_pagamento: periodo2Forma || 'Boleto Bancário',
            meses: periodo2MesesCalculados,
            total: periodo2TotalFinanceiro,
          },
          2,
        ),
      )
    }

    return list
  }, [
    periodo1DataIniEfetiva,
    periodo1DataFimEfetiva,
    periodo1ValorMensalNum,
    periodo1Forma,
    periodo1MesesCalculados,
    periodo1TotalFinanceiro,
    habilitarPeriodo2,
    periodo2Inicio,
    periodo2Final,
    periodo2ValorMensalNum,
    periodo2Forma,
    periodo2MesesCalculados,
    periodo2TotalFinanceiro,
  ])

  // Preview de parcelas em tempo real para conferência no formulário
  const parcelasEmTempoReal = useMemo(() => {
    if (listaPeriodosAtual.length === 0) {
      // Fallback para caso sem períodos preenchidos ainda
      const v = parseValorMonetario(valorInput)
      if (v > 0 && contratanteSelecionada) {
        return recebiveisService.calcularPreviewParcelas({
          empresa: contratanteSelecionada.id,
          data_inicio_servicos: dataInicio,
          dia_vencimento: diaVencimento,
          valor: v,
          meses: parcelasContratoTotal,
          lembrete_agendado: enviarLembretesContrato,
        })
      }
      return []
    }

    return gerarParcelasDePeriodos(listaPeriodosAtual, diaVencimento, enviarLembretesContrato)
  }, [
    listaPeriodosAtual,
    diaVencimento,
    enviarLembretesContrato,
    valorInput,
    contratanteSelecionada,
    dataInicio,
    parcelasContratoTotal,
  ])

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
      errs.quantidadeMeses = 'A quantidade de parcelas deve estar entre 1 e 120.'
    }

    const val =
      periodo1ValorMensalNum > 0 ? periodo1ValorMensalNum : parseValorMonetario(valorInput)
    if (!val || val <= 0) {
      errs.valor = 'Informe o valor mensal do Período 1 (maior que R$ 0,00).'
    }

    if (!diaVencimento || diaVencimento < 1 || diaVencimento > 28) {
      errs.diaVencimento = 'O dia de vencimento deve estar entre 1 e 28.'
    }

    if (habilitarPeriodo2) {
      if (!periodo2Inicio || !periodo2Final) {
        errs.periodo2 = 'Informe a data inicial e final do Período 2.'
      }
      if (!periodo2ValorMensalNum || periodo2ValorMensalNum <= 0) {
        errs.periodo2Valor = 'Informe o valor mensal do Período 2.'
      }
    }

    setFormErrors(errs)
    return Object.keys(errs).length === 0
  }

  // Preenche automaticamente o exemplo clássico do usuário
  const aplicarExemploUsuario = () => {
    setDataInicio('2026-10-16')
    setPrazoInicial(1)
    setQuantidadeMeses(12) // Contrato de 12 parcelas
    setDiaVencimento(16)
    setValorInput(formatarInputMoeda(1500))

    // Período 1: 16/10/2026 a 16/01/2027 a R$ 1.500/mês
    setPeriodo1Inicio('2026-10-16')
    setPeriodo1Final('2027-01-16')
    setPeriodo1ValorInput(formatarInputMoeda(1500))
    setPeriodo1Forma('Pix')

    // Período 2: 16/02/2027 a 16/10/2027 a R$ 2.000/mês
    setHabilitarPeriodo2(true)
    setPeriodo2Inicio('2027-02-16')
    setPeriodo2Final('2027-10-16')
    setPeriodo2ValorInput(formatarInputMoeda(2000))
    setPeriodo2Forma('Boleto Bancário')

    toast({
      title: 'Exemplo carregado no formulário!',
      description:
        'Período 1 (4× R$ 1.500) + Período 2 (9× R$ 2.000) = 13 mensalidades vs 12 parcelas do contrato.',
    })
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

    const valorBaseParcela =
      periodo1ValorMensalNum > 0 ? periodo1ValorMensalNum : parseValorMonetario(valorInput)
    const dataFimCalculada =
      (habilitarPeriodo2 && periodo2Final) ||
      periodo1DataFimEfetiva ||
      calcularDataFinal(dataInicio, quantidadeMeses)

    // Parcelas geradas pelos períodos ou padrão
    const parcelasPreview =
      parcelasEmTempoReal.length > 0
        ? parcelasEmTempoReal
        : recebiveisService
            .calcularPreviewParcelas({
              empresa: contratanteSelecionada.id,
              data_inicio_servicos: dataInicio,
              dia_vencimento: diaVencimento,
              valor: valorBaseParcela,
              meses: Number(quantidadeMeses),
              lembrete_agendado: enviarLembretesContrato,
            })
            .map((p) => ({
              ...p,
              lembrete_agendado: enviarLembretesContrato,
            }))

    // Compatibilidade com campos pontuais legados
    const finalVal1 = periodo1TotalFinanceiro > 0 ? periodo1TotalFinanceiro : valorBaseParcela
    const finalVenc1 = periodo1DataIniEfetiva || dataInicio
    const finalForma1 = periodo1Forma || 'Pix'

    const finalForma2 = habilitarPeriodo2 ? periodo2Forma : ''
    const finalVal2 = habilitarPeriodo2 ? periodo2TotalFinanceiro : 0
    const finalVenc2 = habilitarPeriodo2 ? periodo2Inicio : ''

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
      valor_parcela: valorBaseParcela,
      dia_vencimento: Number(diaVencimento),
      data_final: dataFimCalculada,
      periodos_cobranca: [...listaPeriodosAtual],
      forma_pagamento_1: finalForma1,
      valor_1: finalVal1,
      vencimento_1: finalVenc1,
      forma_pagamento_2: finalForma2,
      valor_2: finalVal2,
      vencimento_2: finalVenc2,
      observacoes_pagamento: observacoesPagamento,
      clausulasPersonalizadas: { ...clausulas },
      parcelas: parcelasPreview,
    })

    setContratoSalvoId(null)
    setFinanceiroGerado(false)

    toast({
      title: 'Contrato gerado com sucesso!',
      description:
        'A pré-visualização e a cláusula jurídica foram atualizadas com o cronograma em períodos.',
    })
  }

  // 1. Imprimir / Salvar PDF
  const handleImprimir = () => {
    if (!contratoGerado) return
    window.print()
  }

  // 2. Salvar Contrato no backend com sincronização automática no módulo de Recebíveis
  const handleSalvarContrato = async () => {
    if (!contratoGerado) return

    setSalvandoContrato(true)
    try {
      let recordId = contratoSalvoId

      const dadosContrato = {
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
        periodos_cobranca: contratoGerado.periodos_cobranca,
        forma_pagamento_1: contratoGerado.forma_pagamento_1,
        valor_1: contratoGerado.valor_1,
        vencimento_1: contratoGerado.vencimento_1,
        forma_pagamento_2: contratoGerado.forma_pagamento_2,
        valor_2: contratoGerado.valor_2,
        vencimento_2: contratoGerado.vencimento_2,
        observacoes_pagamento: contratoGerado.observacoes_pagamento,
      }

      if (recordId) {
        // Atualiza contrato existente
        await contratosService.atualizar(recordId, dadosContrato)
      } else {
        // Cria novo contrato
        const record = await contratosService.criar(dadosContrato)
        recordId = record.id
        setContratoSalvoId(recordId)
      }

      // SINCRONIZAÇÃO AUTOMÁTICA DOS TÍTULOS A RECEBER:
      // Se houver períodos de cobrança definidos (ou parcelas no cronograma),
      // gera e reconcilia os títulos a receber automaticamente no módulo de Recebíveis.
      let resultadoSinc: SincronizarTitulosContratoResult | null = null
      if (contratoGerado.parcelas && contratoGerado.parcelas.length > 0) {
        const descricaoBase = `Contrato com ${contratoGerado.contratante.razao_social}`
        resultadoSinc = await recebiveisService.sincronizarTitulosContrato(
          {
            id: recordId,
            contratante: contratoGerado.contratante.id,
            data_inicio: contratoGerado.data_inicio,
            dia_vencimento: contratoGerado.dia_vencimento,
            quantidade_meses: contratoGerado.quantidade_meses,
            descricaoContrato: descricaoBase,
          },
          contratoGerado.parcelas.map((p) => ({
            parcela: p.parcela,
            vencimento: p.vencimento,
            valor: p.valor,
            forma_pagamento: p.forma_pagamento,
            periodo_ordem: p.periodo_ordem,
            lembrete_agendado:
              p.lembrete_agendado !== undefined ? p.lembrete_agendado : enviarLembretesContrato,
            nfse_automatica_agendada:
              p.nfse_automatica_agendada !== undefined ? p.nfse_automatica_agendada : true,
          })),
        )
        setFinanceiroGerado(true)
      }

      await carregarContratos()

      const detalheTitulos = resultadoSinc
        ? ` ${resultadoSinc.totalAtual} títulos sincronizados no Financeiro (${resultadoSinc.criados} criados, ${resultadoSinc.atualizados} atualizados${resultadoSinc.mantidosPagos > 0 ? `, ${resultadoSinc.mantidosPagos} baixados preservados` : ''}).`
        : ''

      toast({
        title: 'Contrato salvo e integrado!',
        description: `Contrato com ${contratoGerado.contratante.razao_social} gravado com sucesso.${detalheTitulos}`,
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

  // 3. Gerar / Reconciliar Parcelas no Financeiro manualmente sob demanda
  const handleGerarParcelasNoFinanceiro = async () => {
    if (!contratoGerado) return

    setGerandoFinanceiro(true)
    try {
      const cid = contratoSalvoId || 'temp'
      const descricaoBase = `Contrato com ${contratoGerado.contratante.razao_social}`

      if (contratoSalvoId) {
        const res = await recebiveisService.sincronizarTitulosContrato(
          {
            id: contratoSalvoId,
            contratante: contratoGerado.contratante.id,
            data_inicio: contratoGerado.data_inicio,
            dia_vencimento: contratoGerado.dia_vencimento,
            quantidade_meses: contratoGerado.quantidade_meses,
            descricaoContrato: descricaoBase,
          },
          contratoGerado.parcelas.map((p) => ({
            parcela: p.parcela,
            vencimento: p.vencimento,
            valor: p.valor,
            forma_pagamento: p.forma_pagamento,
            periodo_ordem: p.periodo_ordem,
            lembrete_agendado:
              p.lembrete_agendado !== undefined ? p.lembrete_agendado : enviarLembretesContrato,
            nfse_automatica_agendada:
              p.nfse_automatica_agendada !== undefined ? p.nfse_automatica_agendada : true,
          })),
        )

        setFinanceiroGerado(true)
        await carregarContratos()

        toast({
          title: 'Títulos sincronizados em Recebíveis!',
          description: `${res.totalAtual} parcelas no Financeiro (${res.criados} criadas, ${res.atualizados} atualizadas${res.mantidosPagos > 0 ? `, ${res.mantidosPagos} pagas mantidas` : ''}).`,
        })
      } else {
        await recebiveisService.gerarParcelas(
          {
            empresa: contratoGerado.contratante.id,
            data_inicio_servicos: contratoGerado.data_inicio,
            dia_vencimento: contratoGerado.dia_vencimento,
            valor: contratoGerado.valor_parcela,
            meses: contratoGerado.quantidade_meses,
            lembrete_agendado: enviarLembretesContrato,
            nfse_automatica_agendada: true,
            contratoId: cid,
            contratoDescricao: descricaoBase,
          },
          contratoGerado.parcelas.map((p) => ({
            ...p,
            contrato: cid,
            lembrete_agendado:
              p.lembrete_agendado !== undefined ? p.lembrete_agendado : enviarLembretesContrato,
            nfse_automatica_agendada:
              p.nfse_automatica_agendada !== undefined ? p.nfse_automatica_agendada : true,
          })),
        )

        setFinanceiroGerado(true)
        await carregarContratos()

        toast({
          title: 'Parcelas geradas no Financeiro!',
          description: `Foram criados ${contratoGerado.parcelas.length} títulos a receber. Salve o contrato para vincular definitivamente.`,
        })
      }
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

    const periodosSalvos: PeriodoCobrancaItem[] =
      Array.isArray(c.periodos_cobranca) && c.periodos_cobranca.length > 0
        ? c.periodos_cobranca
        : []

    const parcelasPreview =
      periodosSalvos.length > 0
        ? gerarParcelasDePeriodos(periodosSalvos, c.dia_vencimento || 10, enviarLembretesContrato)
        : recebiveisService
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

    // Períodos de cobrança salvos
    if (periodosSalvos.length > 0) {
      const p1 = periodosSalvos[0]
      setPeriodo1Inicio(p1.data_inicio ? p1.data_inicio.slice(0, 10) : dataInicioStr)
      setPeriodo1Final(p1.data_final ? p1.data_final.slice(0, 10) : dataFimCalculada)
      setPeriodo1ValorInput(formatarInputMoeda(Number(p1.valor_mensal) || valorNum))
      setPeriodo1Forma(p1.forma_pagamento || 'Pix')

      if (periodosSalvos.length > 1) {
        const p2 = periodosSalvos[1]
        setHabilitarPeriodo2(true)
        setPeriodo2Inicio(p2.data_inicio ? p2.data_inicio.slice(0, 10) : '')
        setPeriodo2Final(p2.data_final ? p2.data_final.slice(0, 10) : '')
        setPeriodo2ValorInput(formatarInputMoeda(Number(p2.valor_mensal) || 0))
        setPeriodo2Forma(p2.forma_pagamento || 'Boleto Bancário')
      } else {
        setHabilitarPeriodo2(false)
        setPeriodo2Inicio('')
        setPeriodo2Final('')
        setPeriodo2ValorInput('')
        setPeriodo2Forma('Boleto Bancário')
      }
    } else {
      // Fallback para campos pontuais legados
      setPeriodo1Inicio(dataInicioStr)
      setPeriodo1Final(dataFimCalculada)
      setPeriodo1ValorInput(formatarInputMoeda(valorNum))
      setPeriodo1Forma(c.forma_pagamento_1 || 'Pix')

      const temP2 = Boolean(c.forma_pagamento_2 || (c.valor_2 && c.valor_2 > 0))
      setHabilitarPeriodo2(temP2)
      setPeriodo2Inicio(c.vencimento_2 ? c.vencimento_2.slice(0, 10) : '')
      setPeriodo2Final('')
      setPeriodo2ValorInput(c.valor_2 ? formatarInputMoeda(c.valor_2) : '')
      setPeriodo2Forma(c.forma_pagamento_2 || 'Boleto Bancário')
    }

    setObservacoesPagamento(c.observacoes_pagamento || '')

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
      periodos_cobranca:
        periodosSalvos.length > 0
          ? periodosSalvos
          : [
              {
                ordem: 1,
                data_inicio: dataInicioStr,
                data_final: dataFimCalculada,
                valor_mensal: valorNum,
                forma_pagamento: c.forma_pagamento_1 || 'Pix',
                meses: c.quantidade_meses,
                total: valorNum * c.quantidade_meses,
              },
            ],
      forma_pagamento_1: c.forma_pagamento_1 || 'Pix',
      valor_1: c.valor_1 || valorNum,
      vencimento_1: c.vencimento_1 ? c.vencimento_1.slice(0, 10) : dataInicioStr,
      forma_pagamento_2: c.forma_pagamento_2 || '',
      valor_2: c.valor_2 || 0,
      vencimento_2: c.vencimento_2 ? c.vencimento_2.slice(0, 10) : '',
      observacoes_pagamento: c.observacoes_pagamento || '',
      clausulasPersonalizadas: { ...clausulas },
      parcelas: parcelasPreview,
    })

    setContratoSalvoId(c.id)
    setFinanceiroGerado(false)
    setAbaAtiva('novo')

    toast({
      title: 'Contrato carregado',
      description: `Contrato de ${contratanteObj?.nome || 'Empresa'} carregado com as formas de pagamento.`,
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

    // Monta texto detalhado das condições de pagamento e cronograma de períodos
    let condicoesTexto = ''
    if (dados.periodos_cobranca && dados.periodos_cobranca.length > 0) {
      const linhasPeriodos = dados.periodos_cobranca.map((p, idx) => {
        const dIni = formatarDataBr(p.data_inicio)
        const dFim = formatarDataBr(p.data_final)
        const qtdMeses = p.meses || calcularMensalidadesPeriodo(p.data_inicio, p.data_final)
        const extensoMeses = numeroPorExtenso(qtdMeses)
        const vMensal = formatarMoeda(p.valor_mensal)
        const vTotalPeriodo = formatarMoeda((p.meses || qtdMeses) * p.valor_mensal)
        return `Período ${idx + 1}: de ${dIni} a ${dFim}, ${qtdMeses} (${extensoMeses}) parcelas mensais de ${vMensal} via ${p.forma_pagamento || 'Pix'} (subtotal de ${vTotalPeriodo})`
      })
      condicoesTexto = linhasPeriodos.join(';\n') + '.'
    } else {
      condicoesTexto = `Condição de Pagamento 1: ${dados.forma_pagamento_1 || 'Pix'}, no valor de ${formatarMoeda(dados.valor_1)} com vencimento em ${formatarDataBr(dados.vencimento_1 || dados.data_inicio)}.`
      if (dados.forma_pagamento_2 && dados.valor_2 && dados.valor_2 > 0) {
        condicoesTexto += `\nCondição de Pagamento 2: ${dados.forma_pagamento_2}, no valor de ${formatarMoeda(dados.valor_2)} com vencimento em ${formatarDataBr(dados.vencimento_2 || dados.data_final)}.`
      }
    }

    if (dados.observacoes_pagamento) {
      condicoesTexto += `\nObservações: ${dados.observacoes_pagamento}`
    }

    // Valor total do contrato gerado
    const totalGeralEfetivo =
      dados.periodos_cobranca && dados.periodos_cobranca.length > 0
        ? dados.periodos_cobranca.reduce(
            (acc, p) => acc + (p.total || (p.meses || 0) * p.valor_mensal),
            0,
          )
        : dados.valor_parcela * dados.quantidade_meses

    return template
      .replace(/{MESES}/g, String(dados.quantidade_meses))
      .replace(/{DATA_INICIO}/g, formatarDataBr(dados.data_inicio))
      .replace(/{DATA_FINAL}/g, formatarDataBr(dados.data_final))
      .replace(/{PRAZO_INICIAL}/g, String(dados.prazo_inicial))
      .replace(/{PRAZO_INICIAL_LABEL}/g, dados.prazo_inicial === 1 ? 'mês' : 'meses')
      .replace(/{VALOR_PARCELA}/g, formatarMoeda(dados.valor_parcela))
      .replace(/{VALOR_TOTAL}/g, formatarMoeda(totalGeralEfetivo))
      .replace(/{DIA_VENCIMENTO}/g, String(dados.dia_vencimento))
      .replace(/{CONDICOES_PAGAMENTO_DETALHADAS}/g, condicoesTexto)
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
                      {/* Valor da Parcela Mensal */}
                      <div className="space-y-1.5">
                        <Label
                          htmlFor="contrato-valor"
                          className="text-xs font-semibold text-slate-700 flex items-center gap-1.5"
                        >
                          <DollarSign className="w-3.5 h-3.5 text-blue-600" />
                          Valor Mensal / Base (R$) *
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
                          Dia de Vencimento Mensal *
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

                    {/* SEÇÃO PERÍODOS DE COBRANÇA RECORRENTES (CRONOGRAMA EM FAIXAS MENSAIS) */}
                    <div className="p-3.5 bg-slate-50/90 rounded-xl border border-slate-200 space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                        <div className="flex items-center gap-1.5">
                          <CreditCard className="w-4 h-4 text-blue-600" />
                          <span className="text-xs font-bold text-[#0B1F3A] uppercase tracking-wide">
                            Períodos de Cobrança (Cronograma)
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={aplicarExemploUsuario}
                            className="h-6 text-[10px] text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 font-medium"
                            title="Carregar exemplo: 16/10/26 a 16/01/27 (R$ 1.500) + 16/02/27 a 16/10/27 (R$ 2.000)"
                          >
                            Exemplo do Usuário
                          </Button>
                          <Badge
                            variant="outline"
                            className="text-[10px] font-semibold text-blue-700 bg-blue-50 border-blue-200"
                          >
                            Até 2 períodos
                          </Badge>
                        </div>
                      </div>

                      {/* PERÍODO 1 (Obrigatório / Base) */}
                      <div className="space-y-2 p-3 bg-white rounded-lg border border-slate-200 shadow-2xs">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5">
                            <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-bold">
                              1
                            </span>
                            Período 1 de Cobrança
                          </span>
                          {periodo1MesesCalculados > 0 && (
                            <Badge className="bg-blue-50 text-blue-800 border-blue-200 text-[10px] font-bold">
                              {periodo1MesesCalculados}{' '}
                              {periodo1MesesCalculados === 1 ? 'mensalidade' : 'mensalidades'} ·{' '}
                              {formatarMoeda(periodo1TotalFinanceiro)}
                            </Badge>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {/* Data Inicial */}
                          <div className="space-y-1">
                            <Label className="text-[10px] font-semibold text-slate-600">
                              Data Inicial *
                            </Label>
                            <Input
                              type="date"
                              value={periodo1Inicio || dataInicio}
                              onChange={(e) => setPeriodo1Inicio(e.target.value)}
                              className="h-8 text-xs bg-white font-mono"
                            />
                          </div>

                          {/* Data Final */}
                          <div className="space-y-1">
                            <Label className="text-[10px] font-semibold text-slate-600">
                              Data Final *
                            </Label>
                            <Input
                              type="date"
                              value={periodo1Final}
                              onChange={(e) => setPeriodo1Final(e.target.value)}
                              placeholder="Ex.: 2027-01-16"
                              className="h-8 text-xs bg-white font-mono"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {/* Valor Mensal em R$ */}
                          <div className="space-y-1">
                            <Label className="text-[10px] font-semibold text-slate-600">
                              Valor Mensal (R$) *
                            </Label>
                            <Input
                              type="text"
                              placeholder="Ex.: R$ 1.500,00"
                              value={periodo1ValorInput || valorInput}
                              onChange={handlePeriodo1ValorChange}
                              className="h-8 text-xs font-mono font-bold"
                            />
                          </div>

                          {/* Forma de Pagamento */}
                          <div className="space-y-1">
                            <Label className="text-[10px] font-semibold text-slate-600">
                              Forma de Pagamento
                            </Label>
                            <Select value={periodo1Forma} onValueChange={setPeriodo1Forma}>
                              <SelectTrigger className="h-8 text-xs bg-white">
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Pix" className="text-xs">
                                  Pix
                                </SelectItem>
                                <SelectItem value="Boleto Bancário" className="text-xs">
                                  Boleto Bancário
                                </SelectItem>
                                <SelectItem value="Transferência Bancária" className="text-xs">
                                  Transferência (TED/DOC)
                                </SelectItem>
                                <SelectItem value="Cartão de Crédito" className="text-xs">
                                  Cartão de Crédito
                                </SelectItem>
                                <SelectItem value="Dinheiro / Cheque" className="text-xs">
                                  Dinheiro / Cheque
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        {/* Subtotal do Período 1 */}
                        {periodo1MesesCalculados > 0 && periodo1ValorMensalNum > 0 && (
                          <div className="pt-1 text-[11px] text-slate-600 flex items-center justify-between border-t border-slate-100">
                            <span>
                              Cálculo:{' '}
                              <strong className="text-slate-800">
                                {periodo1MesesCalculados} parcelas
                              </strong>{' '}
                              de{' '}
                              <strong className="text-slate-800">
                                {formatarMoeda(periodo1ValorMensalNum)}
                              </strong>
                            </span>
                            <span className="font-mono font-bold text-blue-700">
                              Subtotal: {formatarMoeda(periodo1TotalFinanceiro)}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* TOGGLE / ADICIONAR PERÍODO 2 DE COBRANÇA */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label
                            htmlFor="habilitar-periodo-2"
                            className="text-xs font-semibold text-slate-700 flex items-center gap-2 cursor-pointer"
                          >
                            <input
                              id="habilitar-periodo-2"
                              type="checkbox"
                              checked={habilitarPeriodo2}
                              onChange={(e) => {
                                const checked = e.target.checked
                                setHabilitarPeriodo2(checked)
                                if (checked && !periodo2Forma) {
                                  setPeriodo2Forma('Boleto Bancário')
                                }
                              }}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                            />
                            <span>
                              Adicionar Período 2 de cobrança (ex.: reajuste pactuado ou nova faixa
                              mensal)
                            </span>
                          </label>
                        </div>

                        {habilitarPeriodo2 && (
                          <div className="space-y-2 p-3 bg-white rounded-lg border border-emerald-200 shadow-2xs animate-in fade-in duration-150">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5">
                                <span className="w-4 h-4 rounded-full bg-emerald-600 text-white text-[10px] flex items-center justify-center font-bold">
                                  2
                                </span>
                                Período 2 de Cobrança (Próxima Faixa)
                              </span>
                              <div className="flex items-center gap-2">
                                {periodo2MesesCalculados > 0 && (
                                  <Badge className="bg-emerald-50 text-emerald-800 border-emerald-200 text-[10px] font-bold">
                                    {periodo2MesesCalculados}{' '}
                                    {periodo2MesesCalculados === 1 ? 'mensalidade' : 'mensalidades'}{' '}
                                    · {formatarMoeda(periodo2TotalFinanceiro)}
                                  </Badge>
                                )}
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setHabilitarPeriodo2(false)}
                                  className="h-6 text-[10px] text-slate-400 hover:text-red-600 px-1.5"
                                >
                                  Remover 2º período
                                </Button>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {/* Data Inicial */}
                              <div className="space-y-1">
                                <Label className="text-[10px] font-semibold text-slate-600">
                                  Data Inicial *
                                </Label>
                                <Input
                                  type="date"
                                  value={periodo2Inicio}
                                  onChange={(e) => setPeriodo2Inicio(e.target.value)}
                                  placeholder="Ex.: 2027-02-16"
                                  className="h-8 text-xs bg-white font-mono"
                                />
                              </div>

                              {/* Data Final */}
                              <div className="space-y-1">
                                <Label className="text-[10px] font-semibold text-slate-600">
                                  Data Final *
                                </Label>
                                <Input
                                  type="date"
                                  value={periodo2Final}
                                  onChange={(e) => setPeriodo2Final(e.target.value)}
                                  placeholder="Ex.: 2027-10-16"
                                  className="h-8 text-xs bg-white font-mono"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {/* Valor Mensal em R$ */}
                              <div className="space-y-1">
                                <Label className="text-[10px] font-semibold text-slate-600">
                                  Valor Mensal (R$) *
                                </Label>
                                <Input
                                  type="text"
                                  placeholder="Ex.: R$ 2.000,00"
                                  value={periodo2ValorInput}
                                  onChange={handlePeriodo2ValorChange}
                                  className="h-8 text-xs font-mono font-bold"
                                />
                              </div>

                              {/* Forma de Pagamento */}
                              <div className="space-y-1">
                                <Label className="text-[10px] font-semibold text-slate-600">
                                  Forma de Pagamento
                                </Label>
                                <Select value={periodo2Forma} onValueChange={setPeriodo2Forma}>
                                  <SelectTrigger className="h-8 text-xs bg-white">
                                    <SelectValue placeholder="Selecione" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Pix" className="text-xs">
                                      Pix
                                    </SelectItem>
                                    <SelectItem value="Boleto Bancário" className="text-xs">
                                      Boleto Bancário
                                    </SelectItem>
                                    <SelectItem value="Transferência Bancária" className="text-xs">
                                      Transferência (TED/DOC)
                                    </SelectItem>
                                    <SelectItem value="Cartão de Crédito" className="text-xs">
                                      Cartão de Crédito
                                    </SelectItem>
                                    <SelectItem value="Dinheiro / Cheque" className="text-xs">
                                      Dinheiro / Cheque
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>

                            {/* Subtotal do Período 2 */}
                            {periodo2MesesCalculados > 0 && periodo2ValorMensalNum > 0 && (
                              <div className="pt-1 text-[11px] text-slate-600 flex items-center justify-between border-t border-slate-100">
                                <span>
                                  Cálculo:{' '}
                                  <strong className="text-slate-800">
                                    {periodo2MesesCalculados} parcelas
                                  </strong>{' '}
                                  de{' '}
                                  <strong className="text-slate-800">
                                    {formatarMoeda(periodo2ValorMensalNum)}
                                  </strong>
                                </span>
                                <span className="font-mono font-bold text-emerald-700">
                                  Subtotal: {formatarMoeda(periodo2TotalFinanceiro)}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* RESUMO GERAL DOS PERÍODOS & CONFERÊNCIA COM O TOTAL DE PARCELAS */}
                      <div className="p-3 bg-white rounded-lg border border-slate-200/90 space-y-2">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                          <span>Resumo dos Períodos de Cobrança:</span>
                          <span className="text-emerald-700 font-mono text-xs sm:text-sm">
                            Total: {formatarMoeda(totalFinanceiroPeriodos)}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                          <div className="p-2 bg-slate-50 rounded border border-slate-100">
                            <span className="block text-[10px] text-slate-400 font-semibold uppercase">
                              Mensalidades dos Períodos
                            </span>
                            <span className="font-bold text-slate-900 text-xs">
                              {totalMensalidadesPeriodos}{' '}
                              {totalMensalidadesPeriodos === 1 ? 'mensalidade' : 'mensalidades'}
                            </span>
                            {habilitarPeriodo2 && (
                              <span className="block text-[10px] text-slate-500">
                                ({periodo1MesesCalculados} no P1 + {periodo2MesesCalculados} no P2)
                              </span>
                            )}
                          </div>

                          <div className="p-2 bg-slate-50 rounded border border-slate-100">
                            <span className="block text-[10px] text-slate-400 font-semibold uppercase">
                              Parcelas no Contrato
                            </span>
                            <span className="font-bold text-slate-900 text-xs">
                              {parcelasContratoTotal}{' '}
                              {parcelasContratoTotal === 1 ? 'parcela' : 'parcelas'}
                            </span>
                            <span className="block text-[10px] text-slate-500">
                              (definido em meses do contrato)
                            </span>
                          </div>
                        </div>

                        {/* AVISO SUAVE SE A SOMA DE MENSALIDADES DIVERGIR DAS PARCELAS DO CONTRATO */}
                        {temDivergenciaParcelas && (
                          <div className="p-2.5 bg-amber-50 border border-amber-300 rounded-lg text-[11px] text-amber-950 flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                            <div className="space-y-0.5">
                              <p className="font-bold leading-tight">
                                Atenção para conferência: os períodos somam{' '}
                                {totalMensalidadesPeriodos} mensalidades, mas o contrato tem{' '}
                                {parcelasContratoTotal} parcelas.
                              </p>
                              <p className="text-[10px] text-amber-800 leading-normal">
                                Exemplo: de {formatarDataBr(periodo1DataIniEfetiva)} a{' '}
                                {formatarDataBr(periodo1DataFimEfetiva)} ({periodo1MesesCalculados}{' '}
                                meses)
                                {habilitarPeriodo2
                                  ? ` + de ${formatarDataBr(periodo2Inicio)} a ${formatarDataBr(periodo2Final)} (${periodo2MesesCalculados} meses) = ${totalMensalidadesPeriodos} mensalidades.`
                                  : '.'}{' '}
                                Você pode ajustar as datas ou manter caso seja a condição desejada
                                (o sistema não bloqueia).
                              </p>
                            </div>
                          </div>
                        )}

                        {!temDivergenciaParcelas && totalMensalidadesPeriodos > 0 && (
                          <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-[11px] text-emerald-900 flex items-center gap-1.5 font-medium">
                            <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>
                              Conferência exata: a quantidade de mensalidades (
                              {totalMensalidadesPeriodos}) confere perfeitamente com o total de
                              parcelas do contrato ({parcelasContratoTotal}).
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Observações adicionais de pagamento */}
                      <div className="space-y-1">
                        <Label className="text-[10px] font-semibold text-slate-600">
                          Instruções / Observações de Pagamento (opcional)
                        </Label>
                        <Input
                          type="text"
                          placeholder="Ex.: Emissão das notas fiscais e boletos sempre no 1º dia útil de cada mês..."
                          value={observacoesPagamento}
                          onChange={(e) => setObservacoesPagamento(e.target.value)}
                          className="h-8 text-xs bg-white"
                        />
                      </div>
                    </div>

                    {/* MINI-CALENDÁRIO DE CONFERÊNCIA VISUAL DAS PARCELAS GERADAS */}
                    {parcelasEmTempoReal.length > 0 && (
                      <div className="p-3 bg-slate-50/90 rounded-xl border border-slate-200 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5">
                            <CalendarIcon className="w-3.5 h-3.5 text-blue-600" />
                            Conferência Visual das {parcelasEmTempoReal.length} Parcelas Geradas
                          </span>
                          <span className="text-[10px] font-mono text-slate-500">
                            Vencimento todo dia {diaVencimento}
                          </span>
                        </div>

                        <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-lg bg-white divide-y divide-slate-100">
                          {parcelasEmTempoReal.map((p) => (
                            <div
                              key={`preview-parcela-${p.parcela}`}
                              className="px-2.5 py-1.5 flex items-center justify-between text-[11px] hover:bg-slate-50"
                            >
                              <div className="flex items-center gap-2">
                                <span className="w-5 font-mono font-bold text-blue-700 text-center">
                                  #{p.parcela}
                                </span>
                                <span className="text-slate-600">
                                  Vencimento:{' '}
                                  <strong className="text-slate-800">
                                    {formatarDataBr(p.vencimento)}
                                  </strong>
                                </span>
                              </div>
                              <span className="font-mono font-bold text-slate-900">
                                {formatarMoeda(p.valor)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

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

                  {/* Resumo das Condições e Períodos de Cobrança Pactuados */}
                  <div className="pt-6 border-t border-slate-200 font-sans space-y-3">
                    <h4 className="font-bold text-xs sm:text-sm text-slate-900 uppercase flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-blue-600" />
                      Cronograma e Condições de Cobrança Pactuadas
                    </h4>

                    {contratoGerado.periodos_cobranca &&
                    contratoGerado.periodos_cobranca.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {contratoGerado.periodos_cobranca.map((p, idx) => {
                          const qtdMeses =
                            p.meses || calcularMensalidadesPeriodo(p.data_inicio, p.data_final)
                          const totalPeriodo = p.total || qtdMeses * p.valor_mensal
                          return (
                            <div
                              key={`p-a4-${idx}`}
                              className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold text-slate-900 flex items-center gap-1.5">
                                  <span
                                    className={`w-4 h-4 rounded-full ${idx === 0 ? 'bg-blue-600' : 'bg-emerald-600'} text-white text-[10px] flex items-center justify-center font-bold`}
                                  >
                                    {idx + 1}
                                  </span>
                                  Período {idx + 1}: {formatarDataBr(p.data_inicio)} a{' '}
                                  {formatarDataBr(p.data_final)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-slate-600">
                                  {qtdMeses} mensalidades de{' '}
                                  <strong className="text-slate-800">
                                    {formatarMoeda(p.valor_mensal)}
                                  </strong>
                                </span>
                                <span className="font-mono font-bold text-slate-900">
                                  Subtotal: {formatarMoeda(totalPeriodo)}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500">
                                Meio de pagamento:{' '}
                                <strong className="text-slate-700">
                                  {p.forma_pagamento || 'Pix'}
                                </strong>
                              </p>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-slate-900 flex items-center gap-1.5">
                              <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-bold">
                                1
                              </span>
                              Forma 1: {contratoGerado.forma_pagamento_1 || 'Pix'}
                            </span>
                            <span className="font-mono font-bold text-blue-800 text-xs">
                              {formatarMoeda(contratoGerado.valor_1)}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600">
                            Vencimento:{' '}
                            <strong className="text-slate-800">
                              {formatarDataBr(
                                contratoGerado.vencimento_1 || contratoGerado.data_inicio,
                              )}
                            </strong>
                          </p>
                        </div>
                      </div>
                    )}

                    {contratoGerado.observacoes_pagamento && (
                      <div className="p-2.5 bg-blue-50/50 rounded-lg border border-blue-100 text-xs text-slate-700">
                        <strong>Observações de Pagamento:</strong>{' '}
                        {contratoGerado.observacoes_pagamento}
                      </div>
                    )}
                  </div>

                  {/* 4. Cronograma de Parcelas */}
                  <div className="pt-6 border-t border-slate-200 font-sans space-y-3">
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
                        <th className="py-3 px-3">Formas de Pagamento</th>
                        <th className="py-3 px-3 text-right">Valor Parcela</th>
                        <th className="py-3 px-3 text-center">Total Parcelas</th>
                        <th className="py-3 px-3 text-center">Títulos a Receber</th>
                        <th className="py-3 px-3 text-right">Total Contrato</th>
                        <th className="py-3 px-3 text-center">Status</th>
                        <th className="py-3 px-3 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {contratosFiltradosHistorico.map((c) => {
                        const valorNum = Number(c.valor_parcela) || 0
                        const mesesNum = Number(c.quantidade_meses) || 1
                        const totalContrato =
                          Array.isArray(c.periodos_cobranca) && c.periodos_cobranca.length > 0
                            ? c.periodos_cobranca.reduce((acc, p) => {
                                const m =
                                  p.meses ||
                                  calcularMensalidadesPeriodo(p.data_inicio, p.data_final)
                                return acc + (p.total || m * (Number(p.valor_mensal) || 0))
                              }, 0)
                            : valorNum * mesesNum

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

                            {/* Períodos de Cobrança / Condições de Pagamento */}
                            <td className="py-3 px-3">
                              <div className="space-y-1">
                                {Array.isArray(c.periodos_cobranca) &&
                                c.periodos_cobranca.length > 0 ? (
                                  c.periodos_cobranca.map((p, pIdx) => {
                                    const qtdMeses =
                                      p.meses ||
                                      calcularMensalidadesPeriodo(p.data_inicio, p.data_final)
                                    return (
                                      <div
                                        key={`p-hist-${pIdx}`}
                                        className="flex items-center gap-1.5 flex-wrap"
                                      >
                                        <Badge
                                          variant="outline"
                                          className={`text-[10px] px-1.5 py-0 font-medium ${
                                            pIdx === 0
                                              ? 'bg-blue-50 text-blue-800 border-blue-200'
                                              : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                          }`}
                                        >
                                          {formatarDataBr(p.data_inicio)}–
                                          {formatarDataBr(p.data_final)} · {qtdMeses}×{' '}
                                          {formatarMoeda(p.valor_mensal)}
                                        </Badge>
                                        <span className="text-[10px] text-slate-400">
                                          ({p.forma_pagamento || 'Pix'})
                                        </span>
                                      </div>
                                    )
                                  })
                                ) : (
                                  <>
                                    <div className="flex items-center gap-1.5">
                                      <Badge
                                        variant="outline"
                                        className="text-[10px] px-1.5 py-0 bg-blue-50 text-blue-800 border-blue-200"
                                      >
                                        1: {c.forma_pagamento_1 || 'Pix'}
                                      </Badge>
                                      {c.valor_1 ? (
                                        <span className="font-mono text-[11px] font-semibold text-slate-800">
                                          {formatarMoeda(c.valor_1)}
                                        </span>
                                      ) : null}
                                      {c.vencimento_1 && (
                                        <span className="text-[10px] text-slate-500">
                                          ({formatarDataBr(c.vencimento_1)})
                                        </span>
                                      )}
                                    </div>
                                    {c.forma_pagamento_2 && c.valor_2 && c.valor_2 > 0 ? (
                                      <div className="flex items-center gap-1.5">
                                        <Badge
                                          variant="outline"
                                          className="text-[10px] px-1.5 py-0 bg-emerald-50 text-emerald-800 border-emerald-200"
                                        >
                                          2: {c.forma_pagamento_2}
                                        </Badge>
                                        <span className="font-mono text-[11px] font-semibold text-slate-800">
                                          {formatarMoeda(c.valor_2)}
                                        </span>
                                        {c.vencimento_2 && (
                                          <span className="text-[10px] text-slate-500">
                                            ({formatarDataBr(c.vencimento_2)})
                                          </span>
                                        )}
                                      </div>
                                    ) : null}
                                  </>
                                )}
                              </div>
                            </td>

                            {/* Valor Parcela Mensal */}
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

                            {/* Indicador de Títulos a Receber (Situação Financeira + Atalho para Recebíveis) */}
                            <td className="py-3 px-3 text-center">
                              {(() => {
                                const resumo = resumosTitulosContrato[c.id]
                                if (!resumo || resumo.total === 0) {
                                  return (
                                    <div className="flex flex-col items-center gap-1">
                                      <span className="text-[10px] text-slate-400 italic">
                                        Nenhum título
                                      </span>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleCarregarContratoSalvo(c)}
                                        className="h-5 px-1.5 text-[10px] text-blue-600 border-blue-200 hover:bg-blue-50"
                                        title="Carregar para salvar e gerar títulos"
                                      >
                                        Gerar
                                      </Button>
                                    </div>
                                  )
                                }
                                return (
                                  <div className="flex flex-col items-center gap-1">
                                    <div className="flex items-center gap-1 flex-wrap justify-center">
                                      <Badge
                                        variant="outline"
                                        className="text-[10px] font-mono font-bold bg-slate-50 text-slate-700 border-slate-200"
                                        title={`${resumo.total} títulos gerados no total`}
                                      >
                                        {resumo.total} títulos
                                      </Badge>
                                      {resumo.pagos > 0 && (
                                        <Badge
                                          className="text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 border-emerald-300"
                                          title={`${resumo.pagos} baixados/pagos`}
                                        >
                                          ✓ {resumo.pagos} baixados
                                        </Badge>
                                      )}
                                      {resumo.pendentes > 0 && (
                                        <Badge
                                          className="text-[10px] font-mono font-bold bg-amber-50 text-amber-700 border-amber-300"
                                          title={`${resumo.pendentes} em aberto`}
                                        >
                                          ⏳ {resumo.pendentes} em aberto
                                        </Badge>
                                      )}
                                    </div>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() =>
                                        navigate(
                                          `/baixa-recebiveis?contrato=${c.id}&empresa=${c.contratante}`,
                                        )
                                      }
                                      className="h-5 px-1.5 text-[10px] font-semibold text-blue-700 hover:text-blue-900 hover:bg-blue-50 gap-1"
                                      title="Abrir os títulos deste contrato no módulo de Recebíveis"
                                    >
                                      <ExternalLink className="w-2.5 h-2.5" />
                                      Ver em Recebíveis
                                    </Button>
                                  </div>
                                )
                              })()}
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
                                {/* Botão Visualizar (Abre Pré-visualização A4 rápida em Modal) */}
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleAbrirPreviewModal(c)}
                                  className="h-7 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2"
                                  title="Abrir pré-visualização A4 rápida"
                                >
                                  <Eye className="w-3.5 h-3.5 mr-1" />
                                  Ver A4
                                </Button>

                                {/* Botão Editar / Carregar no Formulário */}
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleCarregarContratoSalvo(c)}
                                  className="h-7 text-xs text-slate-700 hover:text-slate-900 hover:bg-slate-100 px-2"
                                  title="Carregar para edição no formulário"
                                >
                                  <FileSignature className="w-3.5 h-3.5 mr-1" />
                                  Editar
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

      {/* ========================================================================= */}
      {/* MODAL DE PRÉ-VISUALIZAÇÃO A4 RÁPIDA A PARTIR DO HISTÓRICO */}
      {/* ========================================================================= */}
      <Dialog open={previewModalOpen} onOpenChange={setPreviewModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-base font-bold text-[#0B1F3A] flex items-center gap-2">
                  <Printer className="w-5 h-5 text-blue-600" />
                  Visualização do Contrato A4
                </DialogTitle>
                <DialogDescription className="text-xs mt-0.5">
                  Conferência do documento com os períodos de cobrança e cláusulas jurídicas.
                </DialogDescription>
              </div>
              {contratoParaVisualizar && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    handleCarregarContratoSalvo(contratoParaVisualizar)
                    setPreviewModalOpen(false)
                  }}
                  className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold gap-1.5"
                >
                  <FileSignature className="w-3.5 h-3.5" />
                  Carregar no Formulário
                </Button>
              )}
            </div>
          </DialogHeader>

          {contratoParaVisualizar && (
            <div className="py-2 space-y-4">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <div>
                    <span className="font-bold text-slate-900 text-sm block">
                      {contratoParaVisualizar.expand?.contratante?.nome || 'Cliente'}
                    </span>
                    <span className="text-slate-500 font-mono text-[11px]">
                      CNPJ: {contratoParaVisualizar.expand?.contratante?.cnpj || '—'}
                    </span>
                  </div>
                  <Badge variant="outline" className="text-xs font-bold font-mono text-blue-700">
                    {contratoParaVisualizar.quantidade_meses} meses / parcelas
                  </Badge>
                </div>

                {/* Períodos de cobrança salvos */}
                <div>
                  <h5 className="font-bold text-slate-800 text-xs uppercase mb-2">
                    Cronograma de Períodos de Cobrança:
                  </h5>
                  {Array.isArray(contratoParaVisualizar.periodos_cobranca) &&
                  contratoParaVisualizar.periodos_cobranca.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {contratoParaVisualizar.periodos_cobranca.map((p, idx) => {
                        const m =
                          p.meses || calcularMensalidadesPeriodo(p.data_inicio, p.data_final)
                        const t = p.total || m * (Number(p.valor_mensal) || 0)
                        return (
                          <div
                            key={`modal-p-${idx}`}
                            className="p-2.5 bg-white rounded-lg border border-slate-200 text-xs space-y-1"
                          >
                            <span className="font-bold text-slate-900 block">
                              Período {idx + 1}: {formatarDataBr(p.data_inicio)} a{' '}
                              {formatarDataBr(p.data_final)}
                            </span>
                            <div className="flex justify-between text-slate-600">
                              <span>
                                {m} mensalidades de {formatarMoeda(p.valor_mensal)}
                              </span>
                              <span className="font-bold text-slate-900 font-mono">
                                {formatarMoeda(t)}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400 block">
                              Via {p.forma_pagamento || 'Pix'}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="text-slate-500 text-xs">
                      Contrato registrado com condição regular de{' '}
                      {formatarMoeda(contratoParaVisualizar.valor_parcela)} / mês.
                    </p>
                  )}
                </div>

                {contratoParaVisualizar.observacoes_pagamento && (
                  <div className="p-2 bg-blue-50/50 rounded-lg border border-blue-100 text-xs text-slate-700">
                    <strong>Observações:</strong> {contratoParaVisualizar.observacoes_pagamento}
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPreviewModalOpen(false)}
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
