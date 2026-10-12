import React, { useState, useEffect, useMemo, useRef } from 'react'
import * as XLSX from 'xlsx'
import {
  FileText,
  Sparkles,
  Upload,
  Calendar,
  Building2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Download,
  Trash2,
  RefreshCw,
  FolderTree,
  Link as LinkIcon,
  Search,
  ChevronRight,
  ChevronDown,
  Layers,
  ArrowRight,
  HelpCircle,
  FileSpreadsheet,
  Check,
  X,
  ExternalLink,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/contexts/AuthContext'
import { useFilter } from '@/contexts/FilterContext'
import type {
  EmpresaRecord,
  PlanoContaRecord,
  CentroRecord,
  TipoDespesaRecord,
  MemoriaFornecedorRecord,
} from '@/types/finance'
import {
  importacaoAssistidaIaService,
  type DespesaIaPropostaItem,
  type ContaIaProposta,
  type SubcontaIaProposta,
  type RascunhoImportacaoRecord,
} from '@/services/importacaoAssistidaIaService'
import { planoContasService, memoriaFornecedoresService } from '@/services/financeService'
import { SeletorPlanoContaCombobox } from '@/components/SeletorPlanoContaCombobox'

interface ImportacaoAssistidaIaProps {
  empresas: EmpresaRecord[]
  planoContas: PlanoContaRecord[]
  centros: CentroRecord[]
  tiposDespesas: TipoDespesaRecord[]
  onReloadCatalogs?: () => Promise<void>
}

export const ImportacaoAssistidaIa: React.FC<ImportacaoAssistidaIaProps> = ({
  empresas,
  planoContas: initialPlanoContas,
  centros,
  tiposDespesas,
  onReloadCatalogs,
}) => {
  const { toast } = useToast()
  const { isAdmin, user } = useAuth()
  const { selectedEmpresaId, setSelectedEmpresaId, selectedAno, isGrupoAtivo, grupoAtivo } =
    useFilter()

  // Perfis autorizados: admin ou consultor/empresa (NÃO cliente)
  const isPerfilCliente = user?.role === 'cliente'
  const isPerfilAutorizado = isAdmin || (user?.role && user.role !== 'cliente')

  // Catálogos e estado local
  const [planoContas, setPlanoContas] = useState<PlanoContaRecord[]>(initialPlanoContas)
  const [memorias, setMemorias] = useState<MemoriaFornecedorRecord[]>([])

  // Sincroniza se a prop mudar
  useEffect(() => {
    setPlanoContas(initialPlanoContas)
  }, [initialPlanoContas])

  // Empresa selecionada localmente (alinhada com o FilterContext)
  const empresaIdAlvo = useMemo(() => {
    if (isGrupoAtivo && grupoAtivo) {
      // Se um grupo estiver selecionado no app, pega a primeira empresa do grupo
      const primeiraEmp = (grupoAtivo.empresas || [])[0]
      return primeiraEmp || (empresas.length > 0 ? empresas[0].id : '')
    }
    return selectedEmpresaId || (empresas.length > 0 ? empresas[0].id : '')
  }, [selectedEmpresaId, isGrupoAtivo, grupoAtivo, empresas])

  const [activeEmpresaId, setActiveEmpresaId] = useState<string>(empresaIdAlvo)

  useEffect(() => {
    if (empresaIdAlvo && empresaIdAlvo !== activeEmpresaId) {
      setActiveEmpresaId(empresaIdAlvo)
    }
  }, [empresaIdAlvo])

  const empresaObj = useMemo(() => {
    return empresas.find((e) => e.id === activeEmpresaId) || null
  }, [empresas, activeEmpresaId])

  // Carrega catálogos e memórias específicas da empresa ativa
  const carregarCatalogoEmpresa = async (empId: string) => {
    if (!empId) return
    try {
      const [pcList, memList] = await Promise.all([
        planoContasService.getAll({ empresaId: empId }),
        memoriaFornecedoresService.getByEmpresa(empId),
      ])
      setPlanoContas(pcList)
      setMemorias(memList)
    } catch (err) {
      console.warn('Erro ao carregar catálogo da empresa:', err)
    }
  }

  useEffect(() => {
    if (activeEmpresaId) {
      carregarCatalogoEmpresa(activeEmpresaId)
    }
  }, [activeEmpresaId])

  // Período de importação
  const mesAtualNum = new Date().getMonth() + 1
  const mesAtualStr = String(mesAtualNum).padStart(2, '0')
  const anoPadrao = selectedAno || new Date().getFullYear()

  const [periodoTipo, setPeriodoTipo] = useState<'unico' | 'faixa'>('unico')
  const [periodoInicio, setPeriodoInicio] = useState<string>(`${anoPadrao}-${mesAtualStr}`)
  const [periodoFim, setPeriodoFim] = useState<string>(`${anoPadrao}-${mesAtualStr}`)

  // Arquivo PDF
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Estado do processamento pelo Agente de IA
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [processingStatus, setProcessingStatus] = useState<string>('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Resultado da Proposta do Agente de IA
  const [contaPrincipal, setContaPrincipal] = useState<string>('')
  const [contasHierarquia, setContasHierarquia] = useState<ContaIaProposta[]>([])
  const [despesas, setDespesas] = useState<DespesaIaPropostaItem[]>([])
  const [observacoesIa, setObservacoesIa] = useState<string>('')
  const [isTruncatedDoc, setIsTruncatedDoc] = useState(false)
  const [rascunhoId, setRascunhoId] = useState<string | undefined>(undefined)

  // Seleção e múltiplos vínculos
  const [selectedDespesaIds, setSelectedDespesaIds] = useState<Set<string>>(new Set())
  const [searchPlanoTerm, setSearchPlanoTerm] = useState('')
  const [selectedTreePlanoId, setSelectedTreePlanoId] = useState<string | null>(null)

  // Confirmação final
  const [isConfirming, setIsConfirming] = useState(false)
  const [resultadoConfirmacao, setResultadoConfirmacao] = useState<{
    lancamentosCriados: number
    valorTotalLancado: number
    vinculosAprendidos: number
  } | null>(null)

  // Reconstrói a árvore de contas/subcontas sempre que a lista de despesas ou contas originais for carregada
  const arvoreContasSincronizada = useMemo<ContaIaProposta[]>(() => {
    if (despesas.length === 0) return []

    const despesasMap = new Map<string, DespesaIaPropostaItem>()
    for (const d of despesas) {
      despesasMap.set(d.id, d)
    }

    // Se temos contas estruturadas no estado, mapeia os itens atualizados nelas
    if (contasHierarquia.length > 0) {
      return contasHierarquia.map((c) => {
        const subcontas = (c.subcontas || []).map((sc) => {
          const itens = (sc.despesas || []).map((d) => despesasMap.get(d.id) || d)
          const subtotal = itens.reduce((acc, i) => acc + (i.valor || 0), 0)
          return {
            ...sc,
            despesas: itens,
            total_despesas: itens.length,
            valor_subtotal: subtotal,
          }
        })
        const totalConta = subcontas.reduce((acc, sc) => acc + sc.valor_subtotal, 0)
        const totalItens = subcontas.reduce((acc, sc) => acc + sc.total_despesas, 0)
        return {
          ...c,
          subcontas,
          total_despesas: totalItens,
          valor_total: totalConta,
        }
      })
    }

    // Fallback: agrupa a partir dos atributos de cada despesa (conta_hierarquia -> subconta_hierarquia)
    const contasMap = new Map<string, Map<string, DespesaIaPropostaItem[]>>()
    for (const d of despesas) {
      const cNome =
        d.conta_hierarquia || contaPrincipal || 'Despesas Administrativas e Operacionais'
      const scNome = d.subconta_hierarquia || d.categoria || 'Geral'

      if (!contasMap.has(cNome)) {
        contasMap.set(cNome, new Map())
      }
      const scMap = contasMap.get(cNome)!
      const list = scMap.get(scNome) || []
      list.push(d)
      scMap.set(scNome, list)
    }

    const result: ContaIaProposta[] = []
    let cIdx = 1
    for (const [cNome, scMap] of contasMap.entries()) {
      const subcontas: SubcontaIaProposta[] = []
      let scIdx = 1
      for (const [scNome, itens] of scMap.entries()) {
        const subtotal = itens.reduce((acc, i) => acc + (i.valor || 0), 0)
        subcontas.push({
          id: `sc_${cIdx}_${scIdx++}`,
          nome: scNome,
          despesas: itens,
          total_despesas: itens.length,
          valor_subtotal: subtotal,
        })
      }
      const totalConta = subcontas.reduce((acc, sc) => acc + sc.valor_subtotal, 0)
      const totalItens = subcontas.reduce((acc, sc) => acc + sc.total_despesas, 0)
      result.push({
        id: `c_${cIdx++}`,
        nome: cNome,
        subcontas,
        total_despesas: totalItens,
        valor_total: totalConta,
      })
    }
    return result
  }, [despesas, contasHierarquia, contaPrincipal])

  // Carregar rascunho pendente inicial se existir
  useEffect(() => {
    async function checarRascunhoPendente() {
      if (!activeEmpresaId) return
      try {
        const rasc = await importacaoAssistidaIaService.getRascunhoPendente(activeEmpresaId)
        if (rasc && rasc.proposta_json?.despesas?.length > 0) {
          setRascunhoId(rasc.id)
          setContaPrincipal(rasc.conta_principal || rasc.proposta_json.conta_principal)
          setDespesas(rasc.proposta_json.despesas || [])
          setContasHierarquia(rasc.proposta_json.contas || rasc.hierarquia_json?.contas || [])
          setObservacoesIa(rasc.proposta_json.observacoes || '')
          setPeriodoInicio(rasc.periodo_inicio)
          if (rasc.periodo_fim) setPeriodoFim(rasc.periodo_fim)
          if (rasc.periodo_tipo) setPeriodoTipo(rasc.periodo_tipo)

          toast({
            title: 'Rascunho recuperado',
            description: `Recuperamos a proposta do arquivo "${rasc.arquivo_nome}" gravada anteriormente.`,
          })
        }
      } catch {
        /* ignora */
      }
    }
    checarRascunhoPendente()
  }, [activeEmpresaId])

  // Formatação de moeda
  const formatMoeda = (val: number | null | undefined): string => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val || 0)
  }

  // Upload e Validação de PDF
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      toast({
        title: 'Formato inválido',
        description: 'Por favor, selecione um arquivo em formato PDF (.pdf).',
        variant: 'destructive',
      })
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: 'Arquivo muito grande',
        description: 'O arquivo PDF excede o limite máximo de 10 MB.',
        variant: 'destructive',
      })
      return
    }

    setSelectedFile(file)
    setErrorMsg(null)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (!file) return

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      toast({
        title: 'Formato inválido',
        description: 'Por favor, anexe um arquivo PDF (.pdf).',
        variant: 'destructive',
      })
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: 'Arquivo muito grande',
        description: 'O arquivo PDF excede o limite máximo de 10 MB.',
        variant: 'destructive',
      })
      return
    }

    setSelectedFile(file)
    setErrorMsg(null)
  }

  // Ação de Análise com o Agente de IA
  const handleAnalisarComIa = async () => {
    if (!selectedFile) {
      toast({
        title: 'Anexe o arquivo PDF',
        description:
          'Selecione um relatório, extrato ou demonstrativo em PDF para o Agente analisar.',
        variant: 'destructive',
      })
      return
    }

    if (!activeEmpresaId) {
      toast({
        title: 'Selecione a empresa',
        description:
          'É necessário selecionar uma empresa de destino para conciliar com o Plano de Contas.',
        variant: 'destructive',
      })
      return
    }

    setIsAnalyzing(true)
    setErrorMsg(null)
    setResultadoConfirmacao(null)
    setProcessingStatus('Enviando documento e extraindo texto com tabelas no servidor...')

    try {
      setProcessingStatus(
        'Agente Especialista analisando despesas, identificando conta agregadora e sugerindo vínculos...',
      )

      const result = await importacaoAssistidaIaService.analisarPdfComIa({
        file: selectedFile,
        empresaId: activeEmpresaId,
        empresaNome: empresaObj?.nome || empresaObj?.razao_social,
        periodoInicio,
        periodoFim: periodoTipo === 'faixa' ? periodoFim : periodoInicio,
        planoContas,
        memorias,
      })

      setContaPrincipal(result.conta_principal)
      setContasHierarquia(result.contas || [])
      setDespesas(result.despesas)
      setObservacoesIa(result.observacoes || '')
      setIsTruncatedDoc(Boolean(result.truncated))

      // Salva rascunho automaticamente para persistência
      const rasc = await importacaoAssistidaIaService.salvarRascunho({
        rascunhoId,
        empresaId: activeEmpresaId,
        arquivoNome: selectedFile.name,
        periodoInicio,
        periodoFim: periodoTipo === 'faixa' ? periodoFim : periodoInicio,
        contaPrincipal: result.conta_principal,
        contas: result.contas,
        despesas: result.despesas,
        observacoes: result.observacoes,
      })

      if (rasc) {
        setRascunhoId(rasc.id)
      }

      const vinculadasIniciais = result.despesas.filter(
        (d) => d.statusVinculo === 'vinculada',
      ).length

      toast({
        title: 'Análise concluída com sucesso! 🤖',
        description: `Agente identificou ${result.total_despesas} despesas sob "${result.conta_principal}". ${vinculadasIniciais} foram pré-vinculadas automaticamente.`,
      })
    } catch (err: any) {
      console.error('Erro ao analisar PDF com Agente:', err)
      setErrorMsg(
        err?.message ||
          'Não foi possível concluir a análise do PDF pelo Agente de IA. Verifique se o arquivo possui texto legível e tente novamente.',
      )
      toast({
        title: 'Falha na análise',
        description: err?.message || 'Erro ao processar o arquivo.',
        variant: 'destructive',
      })
    } finally {
      setIsAnalyzing(false)
      setProcessingStatus('')
    }
  }

  // Vincular item individualmente
  const handleVincularItem = (despesaId: string, planoContaId: string) => {
    const pc = planoContas.find((p) => p.id === planoContaId)
    setDespesas((prev) => {
      const updated = prev.map((item) => {
        if (item.id === despesaId) {
          if (!planoContaId) {
            return {
              ...item,
              planoContaId: undefined,
              planoContaNome: undefined,
              planoContaCodigo: undefined,
              statusVinculo: 'pendente' as const,
              origemSugestao: 'manual' as const,
            }
          }
          return {
            ...item,
            planoContaId: pc?.id,
            planoContaNome: pc?.expand?.conta?.nome,
            planoContaCodigo: pc?.codigo,
            statusVinculo: 'vinculada' as const,
            origemSugestao: 'manual' as const,
          }
        }
        return item
      })

      // Salva rascunho atualizado silenciosamente
      if (selectedFile && activeEmpresaId) {
        importacaoAssistidaIaService.salvarRascunho({
          rascunhoId,
          empresaId: activeEmpresaId,
          arquivoNome: selectedFile.name,
          periodoInicio,
          periodoFim: periodoTipo === 'faixa' ? periodoFim : periodoInicio,
          contaPrincipal,
          contas: contasHierarquia,
          despesas: updated,
          observacoes: observacoesIa,
        })
      }

      return updated
    })
  }

  // Vincular todas as despesas de uma Subconta inteira à mesma conta do plano
  const handleVincularSubconta = (subconta: SubcontaIaProposta, planoContaId: string) => {
    const pc = planoContas.find((p) => p.id === planoContaId)
    const idsSubconta = new Set(subconta.despesas.map((d) => d.id))

    setDespesas((prev) => {
      const updated = prev.map((item) => {
        if (idsSubconta.has(item.id)) {
          if (!planoContaId) {
            return {
              ...item,
              planoContaId: undefined,
              planoContaNome: undefined,
              planoContaCodigo: undefined,
              statusVinculo: 'pendente' as const,
              origemSugestao: 'manual' as const,
            }
          }
          return {
            ...item,
            planoContaId: pc?.id,
            planoContaNome: pc?.expand?.conta?.nome,
            planoContaCodigo: pc?.codigo,
            statusVinculo: 'vinculada' as const,
            origemSugestao: 'manual' as const,
          }
        }
        return item
      })

      if (selectedFile && activeEmpresaId) {
        importacaoAssistidaIaService.salvarRascunho({
          rascunhoId,
          empresaId: activeEmpresaId,
          arquivoNome: selectedFile.name,
          periodoInicio,
          periodoFim: periodoTipo === 'faixa' ? periodoFim : periodoInicio,
          contaPrincipal,
          contas: contasHierarquia,
          despesas: updated,
          observacoes: observacoesIa,
        })
      }

      return updated
    })

    if (pc) {
      toast({
        title: 'Subconta vinculada!',
        description: `Todas as ${subconta.despesas.length} despesas de "${subconta.nome}" foram vinculadas à conta "${pc.expand?.conta?.nome || pc.codigo}".`,
      })
    }
  }

  // Vincular todas as despesas de uma Conta inteira à mesma conta do plano
  const handleVincularConta = (conta: ContaIaProposta, planoContaId: string) => {
    const pc = planoContas.find((p) => p.id === planoContaId)
    const idsConta = new Set<string>()
    for (const sc of conta.subcontas) {
      for (const d of sc.despesas) {
        idsConta.add(d.id)
      }
    }

    setDespesas((prev) => {
      const updated = prev.map((item) => {
        if (idsConta.has(item.id)) {
          if (!planoContaId) {
            return {
              ...item,
              planoContaId: undefined,
              planoContaNome: undefined,
              planoContaCodigo: undefined,
              statusVinculo: 'pendente' as const,
              origemSugestao: 'manual' as const,
            }
          }
          return {
            ...item,
            planoContaId: pc?.id,
            planoContaNome: pc?.expand?.conta?.nome,
            planoContaCodigo: pc?.codigo,
            statusVinculo: 'vinculada' as const,
            origemSugestao: 'manual' as const,
          }
        }
        return item
      })

      if (selectedFile && activeEmpresaId) {
        importacaoAssistidaIaService.salvarRascunho({
          rascunhoId,
          empresaId: activeEmpresaId,
          arquivoNome: selectedFile.name,
          periodoInicio,
          periodoFim: periodoTipo === 'faixa' ? periodoFim : periodoInicio,
          contaPrincipal,
          contas: contasHierarquia,
          despesas: updated,
          observacoes: observacoesIa,
        })
      }

      return updated
    })

    if (pc) {
      toast({
        title: 'Grupo de Conta vinculado!',
        description: `Todas as ${idsConta.size} despesas de "${conta.nome}" foram vinculadas à conta "${pc.expand?.conta?.nome || pc.codigo}".`,
      })
    }
  }

  // Selecionar / Deselecionar todos os itens de uma Subconta
  const handleToggleSelectSubconta = (subconta: SubcontaIaProposta) => {
    const subIds = subconta.despesas.map((d) => d.id)
    const todosJaSelecionados = subIds.every((id) => selectedDespesaIds.has(id))

    setSelectedDespesaIds((prev) => {
      const next = new Set(prev)
      if (todosJaSelecionados) {
        subIds.forEach((id) => next.delete(id))
      } else {
        subIds.forEach((id) => next.add(id))
      }
      return next
    })
  }

  // Selecionar / Deselecionar todos os itens de uma Conta
  const handleToggleSelectConta = (conta: ContaIaProposta) => {
    const contaIds: string[] = []
    for (const sc of conta.subcontas) {
      for (const d of sc.despesas) {
        contaIds.push(d.id)
      }
    }
    const todosJaSelecionados = contaIds.every((id) => selectedDespesaIds.has(id))

    setSelectedDespesaIds((prev) => {
      const next = new Set(prev)
      if (todosJaSelecionados) {
        contaIds.forEach((id) => next.delete(id))
      } else {
        contaIds.forEach((id) => next.add(id))
      }
      return next
    })
  }

  // Vincular múltiplas despesas selecionadas à mesma conta do plano
  const handleVincularEmLote = (planoContaId: string) => {
    if (selectedDespesaIds.size === 0) {
      toast({
        title: 'Nenhuma despesa selecionada',
        description: 'Selecione uma ou mais despesas marcando as caixas de seleção.',
      })
      return
    }

    const pc = planoContas.find((p) => p.id === planoContaId)
    if (!pc) return

    setDespesas((prev) => {
      const updated = prev.map((item) => {
        if (selectedDespesaIds.has(item.id)) {
          return {
            ...item,
            planoContaId: pc.id,
            planoContaNome: pc.expand?.conta?.nome,
            planoContaCodigo: pc.codigo,
            statusVinculo: 'vinculada' as const,
            origemSugestao: 'manual' as const,
          }
        }
        return item
      })

      if (selectedFile && activeEmpresaId) {
        importacaoAssistidaIaService.salvarRascunho({
          rascunhoId,
          empresaId: activeEmpresaId,
          arquivoNome: selectedFile.name,
          periodoInicio,
          periodoFim: periodoTipo === 'faixa' ? periodoFim : periodoInicio,
          contaPrincipal,
          contas: contasHierarquia,
          despesas: updated,
          observacoes: observacoesIa,
        })
      }

      return updated
    })

    toast({
      title: 'Vínculo em lote realizado!',
      description: `${selectedDespesaIds.size} despesas foram vinculadas à conta "${pc.expand?.conta?.nome || pc.codigo}".`,
    })

    setSelectedDespesaIds(new Set())
  }

  // Selecionar / Deselecionar todos
  const handleToggleSelectAll = () => {
    if (selectedDespesaIds.size === despesas.length) {
      setSelectedDespesaIds(new Set())
    } else {
      setSelectedDespesaIds(new Set(despesas.map((d) => d.id)))
    }
  }

  const handleToggleSelectItem = (id: string) => {
    setSelectedDespesaIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  // Métricas
  const totalGeralConferido = useMemo(() => {
    return despesas.reduce((acc, curr) => acc + (curr.valor || 0), 0)
  }, [despesas])

  const despesasVinculadasCount = useMemo(() => {
    return despesas.filter((d) => Boolean(d.planoContaId)).length
  }, [despesas])

  const despesasPendentesCount = despesas.length - despesasVinculadasCount

  // Árvore do Plano de Contas agrupada e filtrada
  const planoContasFiltrado = useMemo(() => {
    const q = (searchPlanoTerm || '').toLowerCase().trim()
    if (!q) return planoContas

    return planoContas.filter((p) => {
      const nomeConta = (p.expand?.conta?.nome || '').toLowerCase()
      const codConta = (p.expand?.conta?.codigo || '').toLowerCase()
      const codPC = (p.codigo || '').toLowerCase()
      const codEmp = (p.codigo_empresa || '').toLowerCase()
      const centro = (p.expand?.centro?.nome || '').toLowerCase()
      const tipo = (p.expand?.tipo_despesa?.nome || '').toLowerCase()

      return (
        nomeConta.includes(q) ||
        codConta.includes(q) ||
        codPC.includes(q) ||
        codEmp.includes(q) ||
        centro.includes(q) ||
        tipo.includes(q)
      )
    })
  }, [planoContas, searchPlanoTerm])

  // Agrupamento por Centro de Custo para visualização em árvore
  const planoContasAgrupadoPorCentro = useMemo(() => {
    const map = new Map<string, { centroNome: string; contas: PlanoContaRecord[] }>()

    for (const pc of planoContasFiltrado) {
      const centroNome = pc.expand?.centro?.nome || 'Centro Padrão'
      const entry = map.get(centroNome) || { centroNome, contas: [] }
      entry.contas.push(pc)
      map.set(centroNome, entry)
    }

    return Array.from(map.values())
  }, [planoContasFiltrado])

  // Conta selecionada na árvore do lado direito (para exibição do nome)
  const contaPlanoSelecionadaNaArvore = useMemo(() => {
    if (!selectedTreePlanoId) return null
    return planoContas.find((p) => p.id === selectedTreePlanoId) || null
  }, [planoContas, selectedTreePlanoId])

  // Exportação em Excel / CSV da proposta com Hierarquia Estruturada (▶ CONTA:, ▶ SUBCONTA:, itens abaixo)
  const handleExportarExcel = (tipo: 'xlsx' | 'csv') => {
    if (despesas.length === 0) {
      toast({
        title: 'Nenhum dado para exportar',
        description: 'Faça a análise do documento com o Agente de IA antes de exportar.',
      })
      return
    }

    // Linhas hierárquicas refletindo:
    // Linha ▶ CONTA: Nome (Total R$)
    // Linha   ▶ SUBCONTA: Nome (Subtotal R$)
    // Linhas    Itens de despesa indentados com detalhes
    const hierarquiaRows: Array<{
      Nível: string
      'Conta / Grupo': string
      'Subconta / Subgrupo': string
      'Descrição / Fornecedor': string
      Competência: string
      'Valor (R$)': number | string
      'Status Vínculo': string
      'Conta Vinculada': string
      'Código Plano Contas': string
      'Origem Sugestão': string
    }> = []

    for (const conta of arvoreContasSincronizada) {
      // Linha de cabeçalho da Conta
      hierarquiaRows.push({
        Nível: 'CONTA',
        'Conta / Grupo': `▶ CONTA: ${conta.nome.toUpperCase()}`,
        'Subconta / Subgrupo': '',
        'Descrição / Fornecedor': `Total da Conta (${conta.total_despesas} itens)`,
        Competência: '',
        'Valor (R$)': conta.valor_total,
        'Status Vínculo': '',
        'Conta Vinculada': '',
        'Código Plano Contas': '',
        'Origem Sugestão': '',
      })

      for (const subconta of conta.subcontas) {
        // Linha de cabeçalho da Subconta
        hierarquiaRows.push({
          Nível: 'SUBCONTA',
          'Conta / Grupo': conta.nome,
          'Subconta / Subgrupo': `  ▶ SUBCONTA: ${subconta.nome}`,
          'Descrição / Fornecedor': `Subtotal da Subconta (${subconta.total_despesas} itens)`,
          Competência: '',
          'Valor (R$)': subconta.valor_subtotal,
          'Status Vínculo': '',
          'Conta Vinculada': '',
          'Código Plano Contas': '',
          'Origem Sugestão': '',
        })

        // Linhas de despesas detalhadas
        for (const item of subconta.despesas) {
          hierarquiaRows.push({
            Nível: 'ITEM',
            'Conta / Grupo': conta.nome,
            'Subconta / Subgrupo': subconta.nome,
            'Descrição / Fornecedor': `    • ${item.descricao}`,
            Competência: item.competencia,
            'Valor (R$)': item.valor,
            'Status Vínculo': item.statusVinculo === 'vinculada' ? 'Vinculada' : 'Pendente',
            'Conta Vinculada': item.planoContaNome || 'Não vinculada',
            'Código Plano Contas': item.planoContaCodigo || '',
            'Origem Sugestão': item.origemSugestao || 'ia',
          })
        }
      }
    }

    // Linha de total geral no final
    hierarquiaRows.push({
      Nível: 'TOTAL GERAL',
      'Conta / Grupo': `TOTAL GERAL CONFERIDO (${contaPrincipal})`,
      'Subconta / Subgrupo': '',
      'Descrição / Fornecedor': `Soma de ${despesas.length} despesas analisadas`,
      Competência: periodoInicio,
      'Valor (R$)': totalGeralConferido,
      'Status Vínculo': `${despesasVinculadasCount}/${despesas.length} vinculadas`,
      'Conta Vinculada': '',
      'Código Plano Contas': '',
      'Origem Sugestão': '',
    })

    const ws = XLSX.utils.json_to_sheet(hierarquiaRows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Hierarquia_Despesas_IA')

    const nomeArquivo = `Hierarquia_Despesas_IA_${periodoInicio}_${new Date().toISOString().slice(0, 10)}.${tipo}`

    if (tipo === 'csv') {
      XLSX.writeFile(wb, nomeArquivo, { bookType: 'csv' })
    } else {
      XLSX.writeFile(wb, nomeArquivo, { bookType: 'xlsx' })
    }

    toast({
      title: 'Arquivo exportado!',
      description: `O arquivo ${nomeArquivo} foi baixado com sucesso refletindo a hierarquia Conta → Subconta → Despesas.`,
    })
  }

  // Confirmar Importação
  const handleConfirmarImportacao = async () => {
    if (despesasVinculadasCount === 0) {
      toast({
        title: 'Nenhum vínculo realizado',
        description:
          'É necessário vincular pelo menos uma despesa ao Plano de Contas antes de confirmar.',
        variant: 'destructive',
      })
      return
    }

    if (!activeEmpresaId) {
      toast({
        title: 'Empresa não selecionada',
        description: 'Selecione a empresa de destino.',
        variant: 'destructive',
      })
      return
    }

    setIsConfirming(true)

    try {
      const res = await importacaoAssistidaIaService.confirmarImportacao(
        {
          empresaId: activeEmpresaId,
          contaPrincipal,
          despesas,
          arquivoNome: selectedFile?.name || 'documento_despesas.pdf',
          periodoInicio,
          periodoFim: periodoTipo === 'faixa' ? periodoFim : periodoInicio,
          rascunhoId,
        },
        planoContas,
      )

      if (res.sucesso) {
        setResultadoConfirmacao({
          lancamentosCriados: res.lancamentosCriados,
          valorTotalLancado: res.valorTotalLancado,
          vinculosAprendidos: res.vinculosAprendidos,
        })

        toast({
          title: 'Importação realizada com sucesso! 🎉',
          description: `${res.lancamentosCriados} lançamentos foram gravados no período ${periodoInicio}. O Agente memorizou ${res.vinculosAprendidos} novos vínculos para futuras importações!`,
        })

        if (onReloadCatalogs) {
          onReloadCatalogs()
        }
      } else {
        toast({
          title: 'Aviso na confirmação',
          description: res.erros.join(', ') || 'Nenhum lançamento foi gravado.',
          variant: 'destructive',
        })
      }
    } catch (err: any) {
      console.error('Erro na confirmação da importação:', err)
      toast({
        title: 'Falha na confirmação',
        description: err?.message || 'Erro ao gravar os lançamentos.',
        variant: 'destructive',
      })
    } finally {
      setIsConfirming(false)
    }
  }

  // Descartar rascunho atual e começar de novo
  const handleResetarTudo = async () => {
    if (rascunhoId) {
      await importacaoAssistidaIaService.descartarRascunho(rascunhoId)
    }
    setSelectedFile(null)
    setContaPrincipal('')
    setDespesas([])
    setObservacoesIa('')
    setRascunhoId(undefined)
    setResultadoConfirmacao(null)
    setErrorMsg(null)
    setSelectedDespesaIds(new Set())
  }

  // Se for perfil cliente, exibe bloqueio de acesso
  if (isPerfilCliente) {
    return (
      <Card className="border-amber-200 bg-amber-50/50 p-6 rounded-2xl">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-6 h-6 text-amber-600 shrink-0" />
          <div>
            <h3 className="font-bold text-amber-950">Acesso Restrito ao Módulo de Importação</h3>
            <p className="text-sm text-amber-800 mt-1">
              A Importação Assistida por IA está disponível exclusivamente para usuários
              administradores e consultores contábeis. Seu perfil atual é cliente.
            </p>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* 1. Header do Módulo com Destaque do Agente de IA */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white rounded-2xl p-6 shadow-md relative overflow-hidden">
        <div className="absolute right-0 top-0 -mt-8 -mr-8 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-full text-xs font-semibold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
              Agente Nativo Skip Cloud
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              Importação Assistida por IA
              <Badge className="bg-blue-600 text-white border-0 text-xs font-semibold">PDF</Badge>
            </h2>
            <p className="text-slate-300 text-sm leading-relaxed">
              Anexe relatórios, faturas ou extratos em PDF. O Agente de IA extrai as despesas,
              identifica a conta-mãe agregadora e permite o vínculo visual com o Plano de Contas
              para gravação direta na competência escolhida.
            </p>
          </div>

          {/* Seletor Rápido de Empresa Ativa & Status do Catálogo */}
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/10 min-w-[280px] space-y-2">
            <div className="flex items-center justify-between text-xs text-blue-200">
              <span className="flex items-center gap-1.5 font-medium">
                <Building2 className="w-3.5 h-3.5" />
                Empresa Ativa
              </span>
              <span className="text-[11px] bg-white/20 px-2 py-0.5 rounded-full font-mono font-semibold">
                {planoContas.length} contas no plano
              </span>
            </div>
            <Select
              value={activeEmpresaId}
              onValueChange={(val) => {
                setActiveEmpresaId(val)
                setSelectedEmpresaId(val)
              }}
            >
              <SelectTrigger className="bg-white text-slate-800 border-0 h-9 font-medium text-xs">
                <SelectValue placeholder="Selecione a empresa..." />
              </SelectTrigger>
              <SelectContent>
                {empresas.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id} className="text-xs">
                    {emp.nome || emp.razao_social}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* 2. Card de Configuração: Período e Upload do Arquivo PDF */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2 text-slate-900">
            <Calendar className="w-5 h-5 text-blue-600" />
            1. Período e Documento PDF
          </CardTitle>
          <CardDescription>
            Escolha o período contábil de competência e anexe o relatório em PDF para análise.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Tipo de Período */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-700">Tipo de Período</Label>
              <Select
                value={periodoTipo}
                onValueChange={(val: 'unico' | 'faixa') => setPeriodoTipo(val)}
              >
                <SelectTrigger className="h-10 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unico" className="text-xs">
                    Mês Único (Ex: 2025-01)
                  </SelectItem>
                  <SelectItem value="faixa" className="text-xs">
                    Faixa de Períodos (Ex: 2025-01 a 2025-03)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Período Início */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-700">
                {periodoTipo === 'faixa'
                  ? 'Competência Inicial (YYYY-MM)'
                  : 'Competência (YYYY-MM)'}
              </Label>
              <Input
                type="month"
                value={periodoInicio}
                onChange={(e) => setPeriodoInicio(e.target.value)}
                className="h-10 text-xs font-medium"
              />
            </div>

            {/* Período Fim (se faixa) */}
            {periodoTipo === 'faixa' ? (
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-700">
                  Competência Final (YYYY-MM)
                </Label>
                <Input
                  type="month"
                  value={periodoFim}
                  onChange={(e) => setPeriodoFim(e.target.value)}
                  className="h-10 text-xs font-medium"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-700">Ano de Exercício</Label>
                <div className="h-10 px-3 flex items-center bg-slate-50 border border-slate-200 rounded-md text-xs font-semibold text-slate-700">
                  {periodoInicio.split('-')[0] || anoPadrao}
                </div>
              </div>
            )}
          </div>

          {/* Área de Upload Drag & Drop de PDF */}
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setIsDragOver(true)
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all ${
              isDragOver
                ? 'border-blue-500 bg-blue-50/60 scale-[1.01]'
                : 'border-slate-300 hover:border-blue-400 bg-slate-50/50 hover:bg-blue-50/20'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".pdf,application/pdf"
              className="hidden"
            />

            <div className="w-14 h-14 rounded-full bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center mb-3 shadow-sm">
              <FileText className="w-7 h-7" />
            </div>

            {selectedFile ? (
              <div className="text-center space-y-1">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-semibold">
                  <Check className="w-3.5 h-3.5" /> Arquivo Selecionado
                </div>
                <h4 className="text-base font-bold text-slate-900 mt-2">{selectedFile.name}</h4>
                <p className="text-xs text-slate-500">
                  Tamanho: {(selectedFile.size / 1024).toFixed(1)} KB • Tipo: PDF
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedFile(null)
                  }}
                  className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 h-8 mt-2"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" /> Remover e trocar arquivo
                </Button>
              </div>
            ) : (
              <div className="text-center space-y-1 max-w-md">
                <h4 className="text-base font-bold text-slate-800">
                  Arraste ou clique para anexar o arquivo PDF
                </h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Extratos gerenciais, relatórios de despesas, folhas de custos ou comprovantes em
                  PDF (máx. 10 MB com texto digital).
                </p>
                <div className="pt-2">
                  <span className="inline-flex items-center text-xs text-blue-600 font-semibold bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
                    <Upload className="w-3.5 h-3.5 mr-1.5" /> Selecionar PDF
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Alerta de erro se houver */}
          {errorMsg && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-left flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-1 text-xs text-rose-900 flex-1">
                <p className="font-semibold text-rose-950">
                  Falha na análise do PDF com o Agente de IA
                </p>
                <p className="text-rose-800 leading-relaxed">{errorMsg}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setErrorMsg(null)}
                className="text-rose-600 hover:text-rose-800 h-7 px-2 text-xs"
              >
                Fechar
              </Button>
            </div>
          )}

          {/* Botão de Disparo da Análise */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
            <div className="text-xs text-slate-500 flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>
                Processamento em servidor com $documents.toMarkdown e Agente nativo
                'importador-despesas'
              </span>
            </div>

            <Button
              onClick={handleAnalisarComIa}
              disabled={!selectedFile || isAnalyzing}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold gap-2 shadow-sm px-6 h-11 w-full sm:w-auto"
            >
              {isAnalyzing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  {processingStatus || 'Analisando com IA...'}
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Analisar com IA
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 3. Resultado Estruturado da Proposta (Duas Colunas: Despesas à esquerda vs. Plano de Contas à direita) */}
      {despesas.length > 0 && (
        <div className="space-y-6">
          {/* Barra de Topo da Proposta: Conta Principal Agregadora & Ações Globais */}
          <Card className="border-blue-200 bg-blue-50/40 shadow-sm">
            <CardContent className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-blue-700 bg-blue-100 px-2 py-0.5 rounded-md">
                    Conta Principal Sugerida pela IA
                  </span>
                  {isTruncatedDoc && (
                    <Badge
                      variant="outline"
                      className="text-[11px] text-amber-700 border-amber-300"
                    >
                      Documento parcialmente truncado (máx. páginas atingido)
                    </Badge>
                  )}
                </div>
                <h3 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  <Layers className="w-5 h-5 text-blue-600" />
                  {contaPrincipal || 'Despesas Gerais e Operacionais'}
                </h3>
                {observacoesIa && (
                  <p className="text-xs text-slate-600 max-w-3xl leading-relaxed">
                    💡 <em>{observacoesIa}</em>
                  </p>
                )}
              </div>

              {/* Botões de Exportação da Proposta */}
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExportarExcel('xlsx')}
                  className="bg-white text-slate-700 hover:bg-slate-50 border-slate-300 text-xs h-9 gap-1.5"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  Exportar XLSX
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExportarExcel('csv')}
                  className="bg-white text-slate-700 hover:bg-slate-50 border-slate-300 text-xs h-9 gap-1.5"
                >
                  <Download className="w-3.5 h-3.5 text-blue-600" />
                  Exportar CSV
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResetarTudo}
                  className="text-slate-500 hover:text-rose-600 hover:bg-rose-50 text-xs h-9 gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Descartar
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Layout Principal em 2 Colunas */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* ========================================================================= */}
            {/* COLUNA ESQUERDA (7 colunas): Árvore Hierárquica CONTA -> SUBCONTA -> DESPESAS */}
            {/* ========================================================================= */}
            <div className="lg:col-span-7 space-y-4">
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="pb-3 border-b border-slate-100">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                        <FolderTree className="w-4 h-4 text-blue-600" />
                        Estrutura do Documento: Conta → Subconta → Despesas ({despesas.length})
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Cabeçalhos de grupo aparecem uma vez só com subtotais. Vincule itens,
                        subcontas inteiras ou faça seleção em lote.
                      </CardDescription>
                    </div>

                    {/* Ações em Lote */}
                    {selectedDespesaIds.size > 0 && (
                      <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-lg text-xs">
                        <span className="font-semibold text-blue-900">
                          {selectedDespesaIds.size} selecionadas
                        </span>
                        {selectedTreePlanoId && (
                          <Button
                            size="sm"
                            onClick={() => handleVincularEmLote(selectedTreePlanoId)}
                            className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-7 px-2.5 font-medium gap-1"
                          >
                            <LinkIcon className="w-3 h-3" />
                            Vincular à conta do plano
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setSelectedDespesaIds(new Set())}
                          className="text-slate-500 hover:text-slate-700 h-7 px-2 text-[11px]"
                        >
                          Limpar
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="p-0">
                  {/* Cabeçalho Geral da Tabela */}
                  <div className="bg-slate-100/90 px-4 py-2.5 border-b border-slate-200 grid grid-cols-12 text-[11px] font-semibold text-slate-700 uppercase tracking-wider items-center">
                    <div className="col-span-1 flex items-center">
                      <input
                        type="checkbox"
                        checked={
                          selectedDespesaIds.size > 0 && selectedDespesaIds.size === despesas.length
                        }
                        onChange={handleToggleSelectAll}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5 cursor-pointer"
                        title="Selecionar todos os itens de despesa"
                      />
                    </div>
                    <div className="col-span-5">Estrutura / Descrição</div>
                    <div className="col-span-2 text-right">Valor / Subtotal</div>
                    <div className="col-span-4 text-center">Vínculo Plano de Contas</div>
                  </div>

                  {/* Renderização da Árvore Hierárquica: CONTA -> SUBCONTA -> DESPESAS */}
                  <div className="divide-y divide-slate-100 max-h-[620px] overflow-y-auto">
                    {arvoreContasSincronizada.map((conta) => {
                      // Verifica se todos os itens da conta estão selecionados
                      const contaItensIds: string[] = []
                      for (const sc of conta.subcontas) {
                        for (const d of sc.despesas) {
                          contaItensIds.push(d.id)
                        }
                      }
                      const allContaSelected =
                        contaItensIds.length > 0 &&
                        contaItensIds.every((id) => selectedDespesaIds.has(id))

                      return (
                        <div key={conta.id} className="bg-white">
                          {/* 1. CABEÇALHO DE GRUPO: CONTA (Uma vez só, consistente com DRE / Despesas Fixas) */}
                          <div className="bg-slate-800 text-white px-4 py-2 flex items-center justify-between text-xs font-bold tracking-wide shadow-xs">
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={allContaSelected}
                                onChange={() => handleToggleSelectConta(conta)}
                                className="rounded border-slate-600 text-blue-500 focus:ring-blue-400 h-3.5 w-3.5 cursor-pointer bg-slate-700"
                                title="Selecionar toda a Conta"
                              />
                              <Layers className="w-3.5 h-3.5 text-blue-300 shrink-0" />
                              <span className="uppercase text-[11px] text-blue-200">CONTA:</span>
                              <span className="text-slate-50 font-semibold">{conta.nome}</span>
                              <Badge className="bg-slate-700 text-slate-300 border-0 text-[10px] px-1.5 py-0">
                                {conta.total_despesas}{' '}
                                {conta.total_despesas === 1 ? 'item' : 'itens'}
                              </Badge>
                            </div>

                            <div className="flex items-center gap-3">
                              <span className="font-mono text-xs font-bold text-emerald-300">
                                {formatMoeda(conta.valor_total)}
                              </span>

                              {selectedTreePlanoId && (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => handleVincularConta(conta, selectedTreePlanoId)}
                                  className="h-6 px-2 text-[10px] bg-blue-500/30 hover:bg-blue-500/50 text-blue-100 border border-blue-400/30"
                                  title="Vincular todos os itens desta Conta à conta do plano selecionada à direita"
                                >
                                  <LinkIcon className="w-2.5 h-2.5 mr-1" />
                                  Vincular Conta
                                </Button>
                              )}
                            </div>
                          </div>

                          {/* 2. SUBCONTAS (Indentadas) */}
                          {conta.subcontas.map((subconta) => {
                            const subIds = subconta.despesas.map((d) => d.id)
                            const allSubSelected =
                              subIds.length > 0 && subIds.every((id) => selectedDespesaIds.has(id))

                            return (
                              <div
                                key={subconta.id}
                                className="border-b border-slate-100 last:border-b-0"
                              >
                                {/* CABEÇALHO DE SUBGRUPO: SUBCONTA (Indentado, uma vez só) */}
                                <div className="bg-slate-100/90 pl-8 pr-4 py-1.5 flex items-center justify-between text-xs font-semibold text-slate-800 border-t border-slate-200">
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="checkbox"
                                      checked={allSubSelected}
                                      onChange={() => handleToggleSelectSubconta(subconta)}
                                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5 cursor-pointer"
                                      title="Selecionar toda a Subconta"
                                    />
                                    <ChevronRight className="w-3.5 h-3.5 text-blue-600" />
                                    <span className="text-[11px] font-bold text-slate-600 uppercase">
                                      SUBCONTA:
                                    </span>
                                    <span className="text-slate-900 font-semibold">
                                      {subconta.nome}
                                    </span>
                                    <span className="text-[10px] text-slate-500">
                                      ({subconta.total_despesas}{' '}
                                      {subconta.total_despesas === 1 ? 'despesa' : 'despesas'})
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <span className="font-mono text-xs font-bold text-slate-800">
                                      {formatMoeda(subconta.valor_subtotal)}
                                    </span>

                                    {selectedTreePlanoId && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() =>
                                          handleVincularSubconta(subconta, selectedTreePlanoId)
                                        }
                                        className="h-5 px-1.5 text-[10px] border-blue-300 text-blue-700 hover:bg-blue-50 font-medium"
                                        title="Vincular todos os itens desta subconta à conta selecionada à direita"
                                      >
                                        <LinkIcon className="w-2.5 h-2.5 mr-1" />
                                        Vincular Subconta
                                      </Button>
                                    )}
                                  </div>
                                </div>

                                {/* 3. ITENS DE DESPESA INDENTADOS ABAIXO DA SUBCONTA */}
                                <div className="divide-y divide-slate-100 bg-white">
                                  {subconta.despesas.map((item) => {
                                    const isSelected = selectedDespesaIds.has(item.id)
                                    const isVinculada = Boolean(item.planoContaId)

                                    return (
                                      <div
                                        key={item.id}
                                        className={`pl-12 pr-4 py-2.5 grid grid-cols-12 gap-2 text-xs items-center transition-colors ${
                                          isSelected
                                            ? 'bg-blue-50/70'
                                            : isVinculada
                                              ? 'hover:bg-slate-50/60'
                                              : 'bg-amber-50/30 hover:bg-amber-50/60'
                                        }`}
                                      >
                                        {/* Checkbox individual */}
                                        <div className="col-span-1 flex items-center">
                                          <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => handleToggleSelectItem(item.id)}
                                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5 cursor-pointer"
                                          />
                                        </div>

                                        {/* Descrição e Metadados do item */}
                                        <div className="col-span-5 space-y-0.5 pr-2">
                                          <p className="font-semibold text-slate-800 line-clamp-2">
                                            {item.descricao}
                                          </p>
                                          <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-slate-500">
                                            <span className="font-mono bg-slate-100 px-1.5 py-0.2 rounded text-[10px]">
                                              {item.competencia}
                                            </span>
                                            {item.origemSugestao === 'memoria' && (
                                              <Badge className="bg-purple-100 text-purple-700 border-purple-200 text-[10px] px-1 py-0 h-4">
                                                🧠 Aprendido
                                              </Badge>
                                            )}
                                          </div>
                                        </div>

                                        {/* Valor Monetário do Item */}
                                        <div className="col-span-2 text-right font-mono font-bold text-slate-900">
                                          {formatMoeda(item.valor)}
                                        </div>

                                        {/* Seletor Combobox de Vínculo com o Plano de Contas */}
                                        <div className="col-span-4 pl-1">
                                          <SeletorPlanoContaCombobox
                                            value={item.planoContaId || ''}
                                            onValueChange={(val) =>
                                              handleVincularItem(item.id, val)
                                            }
                                            planoContas={planoContas}
                                            placeholder="Vincular conta..."
                                            className="h-8 text-xs bg-white"
                                            empresaAtivaId={activeEmpresaId}
                                            allowClear
                                          />
                                          {item.statusVinculo === 'pendente' && (
                                            <p className="text-[10px] text-amber-700 font-medium mt-0.5 flex items-center gap-1">
                                              <AlertCircle className="w-2.5 h-2.5 text-amber-500" />
                                              Pendente de vínculo
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* ========================================================================= */}
            {/* COLUNA DIREITA (5 colunas): Árvore Navegável e Buscável do Plano de Contas */}
            {/* ========================================================================= */}
            <div className="lg:col-span-5 space-y-4">
              <Card className="border-slate-200 shadow-sm sticky top-4">
                <CardHeader className="pb-3 border-b border-slate-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                        <FolderTree className="w-4 h-4 text-indigo-600" />
                        Plano de Contas da Empresa
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Clique em uma conta para selecioná-la e ligar aos lançamentos da esquerda
                        (individual ou em lote).
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="text-xs font-mono font-bold text-slate-700">
                      {planoContasFiltrado.length}
                    </Badge>
                  </div>

                  {/* Detalhe da conta atualmente selecionada na árvore */}
                  {contaPlanoSelecionadaNaArvore && (
                    <div className="mt-2 p-2 bg-indigo-50 border border-indigo-200 rounded-lg flex items-center justify-between text-xs">
                      <div className="min-w-0 pr-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 block">
                          Conta ativa para ligação:
                        </span>
                        <p className="font-semibold text-indigo-950 truncate">
                          {contaPlanoSelecionadaNaArvore.expand?.conta?.codigo ||
                            contaPlanoSelecionadaNaArvore.codigo}{' '}
                          - {contaPlanoSelecionadaNaArvore.expand?.conta?.nome || 'Conta'}
                        </p>
                      </div>
                      {selectedDespesaIds.size > 0 && (
                        <Button
                          size="sm"
                          onClick={() => handleVincularEmLote(contaPlanoSelecionadaNaArvore.id)}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] h-7 px-2.5 shrink-0 gap-1"
                        >
                          <LinkIcon className="w-3 h-3" />
                          Ligar ({selectedDespesaIds.size})
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Campo de Busca Rápida */}
                  <div className="relative mt-2">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                    <Input
                      placeholder="Buscar por código ou nome de conta/centro..."
                      value={searchPlanoTerm}
                      onChange={(e) => setSearchPlanoTerm(e.target.value)}
                      className="pl-8 h-8 text-xs bg-slate-50"
                    />
                  </div>
                </CardHeader>

                <CardContent className="p-3">
                  {planoContasAgrupadoPorCentro.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 text-xs">
                      Nenhuma conta localizada para "{searchPlanoTerm}".
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                      {planoContasAgrupadoPorCentro.map((grp) => (
                        <div
                          key={grp.centroNome}
                          className="border border-slate-100 rounded-lg overflow-hidden"
                        >
                          {/* Cabeçalho do Centro */}
                          <div className="bg-slate-100/70 px-3 py-1.5 flex items-center justify-between text-xs font-semibold text-slate-700">
                            <span className="flex items-center gap-1.5">
                              <Layers className="w-3.5 h-3.5 text-slate-500" />
                              {grp.centroNome}
                            </span>
                            <span className="text-[10px] text-slate-400 font-normal">
                              {grp.contas.length} contas
                            </span>
                          </div>

                          {/* Lista de Contas */}
                          <div className="divide-y divide-slate-100 bg-white">
                            {grp.contas.map((pc) => {
                              const isSelectedInTree = selectedTreePlanoId === pc.id
                              const nomeConta = pc.expand?.conta?.nome || 'Conta'
                              const codConta = pc.expand?.conta?.codigo || pc.codigo || ''
                              const codEmp = pc.codigo_empresa ? `[${pc.codigo_empresa}]` : ''

                              return (
                                <div
                                  key={pc.id}
                                  onClick={() => setSelectedTreePlanoId(pc.id)}
                                  className={`px-3 py-2 flex items-center justify-between gap-2 text-xs cursor-pointer transition-colors ${
                                    isSelectedInTree
                                      ? 'bg-blue-50 text-blue-900 font-semibold'
                                      : 'hover:bg-slate-50 text-slate-700'
                                  }`}
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="font-mono text-[11px] text-slate-500 shrink-0">
                                      {codConta} {codEmp}
                                    </span>
                                    <span className="truncate">{nomeConta}</span>
                                  </div>

                                  <div className="flex items-center gap-1 shrink-0">
                                    {selectedDespesaIds.size > 0 ? (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          handleVincularEmLote(pc.id)
                                        }}
                                        className="h-6 px-2 text-[10px] bg-blue-100 text-blue-800 hover:bg-blue-200 font-medium"
                                      >
                                        Ligar ({selectedDespesaIds.size})
                                      </Button>
                                    ) : (
                                      <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* BARRA DE CONFIRMAÇÃO FIXA INFERIOR COM TOTAIS E BOTÃO DE GRAVAÇÃO        */}
          {/* ========================================================================= */}
          <div className="bg-white border-t-2 border-blue-600 rounded-xl p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-6">
              {/* Total Geral Conferido */}
              <div>
                <p className="text-xs text-slate-500 font-medium">Soma Geral Conferida:</p>
                <p className="text-xl font-bold font-mono text-slate-900">
                  {formatMoeda(totalGeralConferido)}
                </p>
              </div>

              {/* Contador de Vinculadas vs. Pendentes */}
              <div className="flex items-center gap-3 border-l border-slate-200 pl-4">
                <div>
                  <p className="text-xs text-slate-500 font-medium">Despesas Vinculadas:</p>
                  <p className="text-sm font-bold text-emerald-700 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    {despesasVinculadasCount} de {despesas.length}
                  </p>
                </div>

                {despesasPendentesCount > 0 && (
                  <div>
                    <p className="text-xs text-slate-500 font-medium">Sem Vínculo (Pendentes):</p>
                    <p className="text-sm font-bold text-amber-700 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4 text-amber-500" />
                      {despesasPendentesCount}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Ações de Confirmação */}
            <div className="flex items-center gap-3">
              <Button
                size="lg"
                onClick={handleConfirmarImportacao}
                disabled={isConfirming || despesasVinculadasCount === 0}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-8 shadow-md gap-2"
              >
                {isConfirming ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Gravando Lançamentos...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    Confirmar Importação ({despesasVinculadasCount})
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Resumo de Sucesso após confirmação */}
          {resultadoConfirmacao && (
            <Card className="border-emerald-200 bg-emerald-50/50 p-6 rounded-2xl shadow-sm">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-emerald-100 text-emerald-700 rounded-full shrink-0">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-lg font-bold text-emerald-950">
                    Importação Finalizada com Sucesso!
                  </h4>
                  <p className="text-sm text-emerald-800 leading-relaxed">
                    Foram gerados{' '}
                    <strong>{resultadoConfirmacao.lancamentosCriados} lançamentos</strong>{' '}
                    financeiros na competência {periodoInicio}, totalizando{' '}
                    <strong>{formatMoeda(resultadoConfirmacao.valorTotalLancado)}</strong>.
                  </p>
                  <p className="text-xs text-emerald-700 mt-2">
                    🧠 <strong>Memória do Agente Atualizada:</strong>{' '}
                    {resultadoConfirmacao.vinculosAprendidos} novos vínculos foram memorizados para
                    que nas próximas importações deste fornecedor a conta seja pré-sugerida
                    automaticamente!
                  </p>
                </div>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
