import React, { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useFilter } from '@/contexts/FilterContext'
import { useMinhaEmpresa } from '@/contexts/MinhaEmpresaContext'
import { balancosService, dreService } from '@/services/financeService'
import type { BalancoRecord, DreRecord } from '@/types/finance'
import {
  calcularBalanco,
  calcularDre,
  calcularKanitz,
  formatCurrency,
  formatNumber,
  formatPercent,
  formatCnpj,
  type KanitzResultado,
} from '@/lib/financeCalculations'
import { useRealtime } from '@/hooks/use-realtime'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Cell,
  ReferenceLine,
  Legend,
} from 'recharts'
import {
  Gauge,
  Building2,
  Calendar,
  Download,
  ShieldCheck,
  AlertTriangle,
  AlertCircle,
  HelpCircle,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Scale,
  Activity,
  Layers,
  ArrowRight,
  Info,
  CheckCircle2,
  TableProperties,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  Flame,
  ArrowRightLeft,
  Trophy,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export default function IndicadoresKanitz() {
  const {
    empresas,
    selectedEmpresaId,
    setSelectedEmpresaId,
    selectedAno,
    setSelectedAno,
    anosDisponiveis,
    selectedEmpresa,
  } = useFilter()
  const { minhaEmpresa } = useMinhaEmpresa()
  const { toast } = useToast()
  const navigate = useNavigate()

  // Modo Comparativo entre 2 Empresas
  const [compararAtivo, setCompararAtivo] = useState<boolean>(false)
  const [empresaBId, setEmpresaBId] = useState<string>('')
  const [balancosB, setBalancosB] = useState<BalancoRecord[]>([])
  const [dresB, setDresB] = useState<DreRecord[]>([])
  const [loadingB, setLoadingB] = useState<boolean>(false)

  const [balancos, setBalancos] = useState<BalancoRecord[]>([])
  const [dres, setDres] = useState<DreRecord[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [verEvolucao, setVerEvolucao] = useState<boolean>(false)
  const [expandedVariables, setExpandedVariables] = useState<Record<string, boolean>>({
    x1: false,
    x2: false,
    x3: false,
    x4: false,
    x5: false,
  })

  const toggleVariable = (id: string) => {
    setExpandedVariables((prev) => ({
      ...prev,
      [id]: !prev[id],
    }))
  }

  // Carregar dados da empresa
  const loadData = async () => {
    if (!selectedEmpresaId) {
      setBalancos([])
      setDres([])
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      const [bList, dList] = await Promise.all([
        balancosService.getByEmpresa(selectedEmpresaId),
        dreService.getByEmpresa(selectedEmpresaId),
      ])
      setBalancos(bList)
      setDres(dList)
    } catch (err) {
      console.error('Erro ao carregar balanços e DRE para Kanitz:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar demonstrações',
        description: 'Não foi possível buscar as demonstrações contábeis da empresa.',
      })
    } finally {
      setLoading(false)
    }
  }

  // Carregar dados da Empresa B
  const loadDataB = async () => {
    if (!empresaBId || !compararAtivo) {
      setBalancosB([])
      setDresB([])
      return
    }
    try {
      setLoadingB(true)
      const [bList, dList] = await Promise.all([
        balancosService.getByEmpresa(empresaBId),
        dreService.getByEmpresa(empresaBId),
      ])
      setBalancosB(bList)
      setDresB(dList)
    } catch (err) {
      console.error('Erro ao carregar balanços e DRE da Empresa B:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar dados da empresa comparada',
        description: 'Não foi possível buscar as demonstrações da segunda empresa.',
      })
    } finally {
      setLoadingB(false)
    }
  }

  // Define automaticamente uma empresa B padrão ao ativar comparação se houver outras empresas
  useEffect(() => {
    if (compararAtivo && !empresaBId) {
      const outra = empresas.find((e) => e.id !== selectedEmpresaId)
      if (outra) {
        setEmpresaBId(outra.id)
      }
    }
  }, [compararAtivo, empresaBId, empresas, selectedEmpresaId])

  useEffect(() => {
    loadData()
  }, [selectedEmpresaId])

  useEffect(() => {
    if (compararAtivo && empresaBId) {
      loadDataB()
    }
  }, [compararAtivo, empresaBId])

  useRealtime<BalancoRecord>('balancos', () => {
    loadData()
    if (compararAtivo) loadDataB()
  })
  useRealtime<DreRecord>('dre', () => {
    loadData()
    if (compararAtivo) loadDataB()
  })

  // Anos de histórico
  const ano1 = selectedAno - 1
  const ano2 = selectedAno - 2

  const balancoAtual = useMemo(
    () => balancos.find((b) => b.ano === selectedAno) || null,
    [balancos, selectedAno],
  )
  const dreAtual = useMemo(
    () => dres.find((d) => d.ano === selectedAno) || null,
    [dres, selectedAno],
  )

  const balancoAno1 = useMemo(() => balancos.find((b) => b.ano === ano1) || null, [balancos, ano1])
  const dreAno1 = useMemo(() => dres.find((d) => d.ano === ano1) || null, [dres, ano1])

  const balancoAno2 = useMemo(() => balancos.find((b) => b.ano === ano2) || null, [balancos, ano2])
  const dreAno2 = useMemo(() => dres.find((d) => d.ano === ano2) || null, [dres, ano2])

  // Cálculos contábeis e de Kanitz
  const calcB = useMemo(() => calcularBalanco(balancoAtual), [balancoAtual])
  const calcD = useMemo(() => calcularDre(dreAtual), [dreAtual])

  const kanitzAtual: KanitzResultado = useMemo(
    () => calcularKanitz(balancoAtual, dreAtual),
    [balancoAtual, dreAtual],
  )
  const kanitzAno1: KanitzResultado = useMemo(
    () => calcularKanitz(balancoAno1, dreAno1),
    [balancoAno1, dreAno1],
  )
  const kanitzAno2: KanitzResultado = useMemo(
    () => calcularKanitz(balancoAno2, dreAno2),
    [balancoAno2, dreAno2],
  )

  // Dados e Cálculos Empresa B
  const selectedEmpresaB = useMemo(
    () => empresas.find((e) => e.id === empresaBId) || null,
    [empresas, empresaBId],
  )

  const balancoBAtual = useMemo(
    () => balancosB.find((b) => b.ano === selectedAno) || null,
    [balancosB, selectedAno],
  )
  const dreBAtual = useMemo(
    () => dresB.find((d) => d.ano === selectedAno) || null,
    [dresB, selectedAno],
  )

  const kanitzBAtual: KanitzResultado = useMemo(
    () => calcularKanitz(balancoBAtual, dreBAtual),
    [balancoBAtual, dreBAtual],
  )

  // Determinar qual empresa está mais solvente
  const comparacaoSolvencia = useMemo(() => {
    if (!compararAtivo || !selectedEmpresaB) return null
    const fiA = kanitzAtual.fi
    const fiB = kanitzBAtual.fi

    if (fiA === null && fiB === null)
      return { vencedor: null, motivo: 'Ambas sem dados suficientes' }
    if (fiA !== null && fiB === null)
      return {
        vencedor: 'A',
        empresaNome: selectedEmpresa?.nome || 'Empresa Principal',
        motivo: 'Empresa B sem dados de FI',
      }
    if (fiA === null && fiB !== null)
      return {
        vencedor: 'B',
        empresaNome: selectedEmpresaB.nome,
        motivo: 'Empresa Principal sem dados de FI',
      }

    if (fiA !== null && fiB !== null) {
      if (fiA > fiB) {
        const diff = (fiA - fiB).toFixed(2)
        return {
          vencedor: 'A',
          empresaNome: selectedEmpresa?.nome || 'Empresa Principal',
          motivo: `FI maior por +${diff} pontos em relação a ${selectedEmpresaB.nome}`,
          diff,
        }
      } else if (fiB > fiA) {
        const diff = (fiB - fiA).toFixed(2)
        return {
          vencedor: 'B',
          empresaNome: selectedEmpresaB.nome,
          motivo: `FI maior por +${diff} pontos em relação a ${selectedEmpresa?.nome || 'Empresa Principal'}`,
          diff,
        }
      } else {
        return { vencedor: 'empate', motivo: 'Fatores de Insolvência idênticos' }
      }
    }

    return null
  }, [compararAtivo, kanitzAtual.fi, kanitzBAtual.fi, selectedEmpresa, selectedEmpresaB])

  // Anos disponíveis para seleção
  const anosEmpresa = useMemo(() => {
    const anosSet = new Set<number>()
    balancos.forEach((b) => anosSet.add(b.ano))
    dres.forEach((d) => anosSet.add(d.ano))
    if (anosDisponiveis && anosDisponiveis.length > 0) {
      anosDisponiveis.forEach((a) => anosSet.add(a))
    }
    const arr = Array.from(anosSet).sort((a, b) => b - a)
    return arr.length > 0 ? arr : [selectedAno]
  }, [balancos, dres, anosDisponiveis, selectedAno])

  const hasHistorico = !!(balancoAno1 || balancoAno2 || dreAno1 || dreAno2)

  // Dados para o Gráfico de Barras: Contribuição de cada parcela e resultado final FI
  const dadosGraficoContribuicao = useMemo(() => {
    if (!kanitzAtual.dadosDisponiveis || kanitzAtual.fi === null) return []

    const items = kanitzAtual.variaveis.map((v) => ({
      sigla: v.sigla,
      nome: v.nome,
      formula: v.formula,
      coeficiente: v.coeficiente,
      valorBase: v.valor !== null ? Number(v.valor.toFixed(4)) : 0,
      contribuicao: v.contribuicao !== null ? Number(v.contribuicao.toFixed(3)) : 0,
      tipo: v.contribuicao !== null && v.contribuicao >= 0 ? 'positivo' : 'negativo',
    }))

    items.push({
      sigla: 'Fator FI',
      nome: 'Fator de Insolvência (FI Total)',
      formula: 'Soma de todas as parcelas',
      coeficiente: 1,
      valorBase: Number(kanitzAtual.fi.toFixed(2)),
      contribuicao: Number(kanitzAtual.fi.toFixed(2)),
      tipo: kanitzAtual.fi >= 0 ? 'positivo' : 'negativo',
    })

    return items
  }, [kanitzAtual])

  // Exportação CSV detalhada (com suporte a comparação)
  const handleExportCsv = () => {
    if (!selectedEmpresa) {
      toast({
        title: 'Selecione uma empresa',
        description: 'É necessário selecionar uma empresa para exportar os dados de Kanitz.',
        variant: 'destructive',
      })
      return
    }

    let csv = '\uFEFF' // BOM UTF-8
    const dataEmissao = new Date().toLocaleDateString('pt-BR')

    if (compararAtivo && selectedEmpresaB) {
      csv += `COMPARAÇÃO DE SOLVÊNCIA - TERMÔMETRO DE KANITZ\n`
      csv += `DATA DE EMISSÃO;${dataEmissao}\n`
      csv += `EXERCÍCIO COMPARADO;${selectedAno}\n`
      csv += `EMPRESA A (PRINCIPAL);${selectedEmpresa.nome} (CNPJ: ${formatCnpj(selectedEmpresa.cnpj)})\n`
      csv += `EMPRESA B (COMPARADA);${selectedEmpresaB.nome} (CNPJ: ${formatCnpj(selectedEmpresaB.cnpj)})\n\n`

      csv += `RESUMO COMPARATIVO\n`
      csv += `MÉTRICA;${selectedEmpresa.nome};${selectedEmpresaB.nome};DIFERENÇA / VANTAGEM\n`
      csv += `Fator de Insolvência (FI);${kanitzAtual.fi !== null ? kanitzAtual.fi.toFixed(2) : 'N/D'};${kanitzBAtual.fi !== null ? kanitzBAtual.fi.toFixed(2) : 'N/D'};${comparacaoSolvencia?.motivo || '—'}\n`
      csv += `Classificação de Risco;${kanitzAtual.statusTexto};${kanitzBAtual.statusTexto};—\n`
      csv += `Diagnóstico;${kanitzAtual.diagnosticoResumido};${kanitzBAtual.diagnosticoResumido};—\n\n`

      csv += `VARIÁVEIS CONTÁBEIS (X1 A X5)\n`
      csv += `VARIÁVEL;NOME;FÓRMULA;COEF.;VALOR (${selectedEmpresa.nome});CONTRIB. (${selectedEmpresa.nome});VALOR (${selectedEmpresaB.nome});CONTRIB. (${selectedEmpresaB.nome})\n`
      for (let i = 0; i < kanitzAtual.variaveis.length; i++) {
        const va = kanitzAtual.variaveis[i]
        const vb = kanitzBAtual.variaveis[i]
        csv += `${va.sigla};${va.nome};${va.formula};${va.coeficiente};${va.valor !== null ? va.valor.toFixed(4) : 'N/D'};${va.contribuicao !== null ? va.contribuicao.toFixed(3) : 'N/D'};${vb?.valor !== null && vb?.valor !== undefined ? vb.valor.toFixed(4) : 'N/D'};${vb?.contribuicao !== null && vb?.contribuicao !== undefined ? vb.contribuicao.toFixed(3) : 'N/D'}\n`
      }

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `comparacao-kanitz-${selectedEmpresa.nome.replace(/\s+/g, '-').toLowerCase()}-vs-${selectedEmpresaB.nome.replace(/\s+/g, '-').toLowerCase()}-${selectedAno}.csv`
      link.click()
      URL.revokeObjectURL(link.href)

      toast({
        title: 'CSV de Comparação exportado!',
        description: `Comparativo de Kanitz entre ${selectedEmpresa.nome} e ${selectedEmpresaB.nome} gerado com sucesso.`,
      })
      return
    }

    csv += `ÍNDICE DE SOLVÊNCIA DE KANITZ (TERMÔMETRO DE INSOLVÊNCIA)\n`
    csv += `EMPRESA;${selectedEmpresa.nome}\n`
    csv += `CNPJ;${formatCnpj(selectedEmpresa.cnpj)}\n`
    csv += `EXERCÍCIO;${selectedAno}\n`
    csv += `DATA DE EMISSÃO;${dataEmissao}\n`
    csv += `FATOR DE INSOLVÊNCIA (FI);${kanitzAtual.fi !== null ? kanitzAtual.fi.toFixed(2) : 'N/D'}\n`
    csv += `CLASSIFICAÇÃO;${kanitzAtual.statusTexto}\n`
    csv += `DIAGNÓSTICO;${kanitzAtual.diagnosticoResumido}\n\n`

    csv += `FÓRMULA MATEMÁTICA: FI = (0,05 * X1) + (1,65 * X2) + (3,55 * X3) - (1,06 * X4) - (0,33 * X5)\n\n`

    csv += `VARIÁVEIS;NOME;CONCEITO / FÓRMULA;COEFICIENTE;NUMERADOR (R$);DENOMINADOR (R$);VALOR EXTRAÍDO;CONTRIBUIÇÃO NA EQUAÇÃO\n`
    for (const v of kanitzAtual.variaveis) {
      csv += `${v.sigla};${v.nome};${v.conceito};${v.coeficiente};${formatCurrency(v.numerador.valor).replace(/\s/g, ' ')};${formatCurrency(v.denominador.valor).replace(/\s/g, ' ')};${v.valor !== null ? v.valor.toFixed(4) : 'N/D'};${v.contribuicao !== null ? v.contribuicao.toFixed(3) : 'N/D'}\n`
    }

    if (hasHistorico) {
      csv += `\nEVOLUÇÃO HISTÓRICA DO FATOR DE INSOLVÊNCIA (3 ANOS)\n`
      csv += `ANO;FATOR FI;CLASSIFICAÇÃO;STATUS\n`
      csv += `${ano2};${kanitzAno2.fi !== null ? kanitzAno2.fi.toFixed(2) : '—'};${kanitzAno2.statusTexto};${kanitzAno2.classificacao}\n`
      csv += `${ano1};${kanitzAno1.fi !== null ? kanitzAno1.fi.toFixed(2) : '—'};${kanitzAno1.statusTexto};${kanitzAno1.classificacao}\n`
      csv += `${selectedAno};${kanitzAtual.fi !== null ? kanitzAtual.fi.toFixed(2) : '—'};${kanitzAtual.statusTexto};${kanitzAtual.classificacao}\n`
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `termometro-kanitz-${selectedEmpresa.nome.replace(/\s+/g, '-').toLowerCase()}-${selectedAno}.csv`
    link.click()
    URL.revokeObjectURL(link.href)

    toast({
      title: 'CSV exportado com sucesso!',
      description: `Relatório de Solvência de Kanitz gerado para ${selectedEmpresa.nome} (${selectedAno}).`,
    })
  }

  // Função auxiliar para status visual
  const getStatusConfig = (
    classificacao: 'solvente' | 'penumbra' | 'insolvente' | 'indefinido',
  ) => {
    switch (classificacao) {
      case 'solvente':
        return {
          corFundo: 'bg-emerald-500',
          corBorda: 'border-emerald-300',
          corTexto: 'text-emerald-700',
          bgBadge: 'bg-emerald-50 text-emerald-800 border-emerald-300',
          icone: ShieldCheck,
          labelCurto: 'Solvente',
          gradiente: 'from-emerald-500 to-teal-600',
        }
      case 'penumbra':
        return {
          corFundo: 'bg-amber-500',
          corBorda: 'border-amber-300',
          corTexto: 'text-amber-700',
          bgBadge: 'bg-amber-50 text-amber-800 border-amber-300',
          icone: AlertTriangle,
          labelCurto: 'Penumbra (Risco)',
          gradiente: 'from-amber-500 to-yellow-600',
        }
      case 'insolvente':
        return {
          corFundo: 'bg-rose-500',
          corBorda: 'border-rose-300',
          corTexto: 'text-rose-700',
          bgBadge: 'bg-rose-50 text-rose-800 border-rose-300',
          icone: AlertCircle,
          labelCurto: 'Insolvente',
          gradiente: 'from-rose-600 to-red-700',
        }
      default:
        return {
          corFundo: 'bg-slate-400',
          corBorda: 'border-slate-300',
          corTexto: 'text-slate-600',
          bgBadge: 'bg-slate-100 text-slate-700 border-slate-300',
          icone: Info,
          labelCurto: 'Indefinido',
          gradiente: 'from-slate-500 to-slate-600',
        }
    }
  }

  // Cor e Ícone do Semáforo Empresa Principal
  const statusConfig = useMemo(
    () => getStatusConfig(kanitzAtual.classificacao),
    [kanitzAtual.classificacao],
  )
  const statusConfigB = useMemo(
    () => getStatusConfig(kanitzBAtual.classificacao),
    [kanitzBAtual.classificacao],
  )

  const StatusIcon = statusConfig.icone
  const StatusIconB = statusConfigB.icone

  if (loading && !balancoAtual && !dreAtual && balancos.length === 0) {
    return (
      <div className="py-20 flex flex-col justify-center items-center gap-3">
        <div className="w-9 h-9 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs text-slate-500 font-medium">
          Calculando Termômetro de Kanitz...
        </span>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fadeIn pb-16">
      {/* 1. Header do Módulo Kanitz */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-600 to-blue-700 text-white flex items-center justify-center font-bold text-lg shadow-md shadow-indigo-600/20 shrink-0">
            <Flame className="w-6 h-6 text-amber-300" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-extrabold text-[#0B1F3A] tracking-tight">
                Termômetro de Insolvência de Kanitz
              </h1>
              <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 font-semibold text-xs">
                Fator de Insolvência (FI)
              </Badge>
            </div>
            <p className="text-xs text-[#5B6B7F] mt-0.5">
              Modelo preditivo de solvência corporativa baseado na ponderação discriminante de 5
              variáveis contábeis
            </p>
          </div>
        </div>

        {/* Controles de Filtro e Exportação */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Seletor Empresa */}
          <div className="flex items-center gap-1.5 bg-[#F5F7FA] border border-slate-200 rounded-lg px-2.5 py-1 text-xs">
            <Building2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <Select value={selectedEmpresaId} onValueChange={(id) => setSelectedEmpresaId(id)}>
              <SelectTrigger className="h-7 border-none shadow-none bg-transparent text-xs font-semibold text-slate-800 p-0 focus:ring-0 w-[140px] sm:w-[170px]">
                <SelectValue placeholder="Selecione a empresa" />
              </SelectTrigger>
              <SelectContent>
                {empresas.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id} className="text-xs">
                    {emp.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Seletor Ano */}
          <div className="flex items-center gap-1.5 bg-[#F5F7FA] border border-slate-200 rounded-lg px-2.5 py-1 text-xs">
            <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <Select
              value={String(selectedAno)}
              onValueChange={(val) => setSelectedAno(Number(val))}
            >
              <SelectTrigger className="h-7 border-none shadow-none bg-transparent text-xs font-semibold text-slate-800 p-0 focus:ring-0 w-[75px]">
                <SelectValue placeholder="Ano" />
              </SelectTrigger>
              <SelectContent>
                {anosEmpresa.map((ano) => (
                  <SelectItem key={ano} value={String(ano)} className="text-xs">
                    {ano}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Toggle Modo Comparar Empresas */}
          <Button
            type="button"
            variant={compararAtivo ? 'default' : 'outline'}
            onClick={() => setCompararAtivo(!compararAtivo)}
            className={`font-semibold text-xs h-9 shadow-2xs gap-1.5 transition-all ${
              compararAtivo
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                : 'border-indigo-200 text-indigo-700 hover:bg-indigo-50'
            }`}
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>{compararAtivo ? 'Comparando 2 Empresas' : 'Comparar Empresas'}</span>
          </Button>

          {/* Botão Exportar CSV */}
          <Button
            type="button"
            variant="outline"
            onClick={handleExportCsv}
            disabled={
              !balancoAtual && !dreAtual && (!compararAtivo || (!balancoBAtual && !dreBAtual))
            }
            className="border-slate-300 text-slate-700 hover:bg-slate-100 font-semibold text-xs h-9 shadow-2xs gap-1.5"
          >
            <Download className="w-3.5 h-3.5 text-blue-600" />
            <span>{compararAtivo ? 'Exportar Comparação' : 'Exportar CSV'}</span>
          </Button>

          {/* Atalho para o Painel Geral */}
          <Button
            asChild
            variant="outline"
            className="border-blue-200 text-blue-700 hover:bg-blue-50 font-semibold text-xs h-9 shadow-2xs gap-1.5"
          >
            <Link to="/indicadores/painel">
              <Gauge className="w-3.5 h-3.5 text-blue-600" />
              <span>Painel de Indicadores</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* SELETOR DA SEGUNDA EMPRESA (QUANDO MODO COMPARAR ATIVO) */}
      {compararAtivo && (
        <div className="bg-gradient-to-r from-indigo-50/80 via-blue-50/60 to-purple-50/80 border border-indigo-200 p-4 rounded-2xl shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-xs">
              <ArrowRightLeft className="w-4 h-4" />
            </div>
            <div>
              <strong className="text-sm font-bold text-indigo-950 block">
                Modo Comparativo de Solvência
              </strong>
              <span className="text-xs text-indigo-800">
                Comparando <strong>{selectedEmpresa?.nome || 'Empresa Principal'}</strong> (Azul)
                com a 2ª empresa selecionada (Roxo)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-indigo-900 whitespace-nowrap">
              2ª Empresa:
            </span>
            <div className="bg-white border border-indigo-300 rounded-lg px-2.5 py-1 text-xs shadow-2xs">
              <Select value={empresaBId} onValueChange={(id) => setEmpresaBId(id)}>
                <SelectTrigger className="h-7 border-none shadow-none bg-transparent text-xs font-bold text-indigo-900 p-0 focus:ring-0 min-w-[160px] sm:min-w-[200px]">
                  <SelectValue placeholder="Selecione a 2ª empresa" />
                </SelectTrigger>
                <SelectContent>
                  {empresas
                    .filter((e) => e.id !== selectedEmpresaId)
                    .map((emp) => (
                      <SelectItem key={emp.id} value={emp.id} className="text-xs font-medium">
                        {emp.nome}
                      </SelectItem>
                    ))}
                  {empresas.filter((e) => e.id !== selectedEmpresaId).length === 0 && (
                    <SelectItem value="_vazio" disabled className="text-xs text-slate-400">
                      Cadastre mais empresas para comparar
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}

      {/* 2. CARD HERO DO TERMÔMETRO DE KANITZ & SEMÁFORO VISUAL (COM SUPORTE A 2 MARCADORES) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Score Principal e Classificação */}
        <Card className="lg:col-span-5 bg-white border-slate-200 shadow-2xs overflow-hidden flex flex-col justify-between">
          <CardHeader className="p-5 pb-3 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Fator de Insolvência (FI)
              </span>
              {!compararAtivo ? (
                <Badge className={`text-[11px] font-bold px-2.5 py-0.5 ${statusConfig.bgBadge}`}>
                  <StatusIcon className="w-3.5 h-3.5 mr-1 inline" />
                  {statusConfig.labelCurto}
                </Badge>
              ) : (
                <Badge className="bg-indigo-100 text-indigo-800 border-indigo-300 text-[11px] font-bold px-2.5 py-0.5">
                  <ArrowRightLeft className="w-3.5 h-3.5 mr-1 inline" />
                  Comparativo
                </Badge>
              )}
            </div>
            <CardTitle className="text-base font-bold text-[#0B1F3A] mt-1">
              {compararAtivo
                ? 'Comparativo de Solvência das Empresas'
                : 'Diagnóstico de Solvência de Stephen Kanitz'}
            </CardTitle>
          </CardHeader>

          <CardContent className="p-5 space-y-5">
            {!compararAtivo ? (
              <div className="flex items-baseline justify-between gap-3">
                <div>
                  <span className="text-xs text-slate-400 block font-medium">Índice Apurado:</span>
                  <span className="text-4xl sm:text-5xl font-black font-mono tracking-tight text-[#0B1F3A]">
                    {kanitzAtual.fi !== null ? formatNumber(kanitzAtual.fi, 2) : 'N/D'}
                  </span>
                </div>

                {/* Semáforo Triplo Visual */}
                <div className="flex flex-col items-center bg-slate-900 px-3 py-2 rounded-xl shadow-inner gap-1.5 border border-slate-700">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                    Semáforo
                  </span>
                  <div className="flex items-center gap-1.5">
                    <div
                      title="Solvente (FI ≥ 0)"
                      className={`w-4 h-4 rounded-full transition-all ${
                        kanitzAtual.classificacao === 'solvente'
                          ? 'bg-emerald-400 shadow-[0_0_10px_#10B981] scale-110'
                          : 'bg-emerald-950/70 opacity-40'
                      }`}
                    />
                    <div
                      title="Penumbra (0 > FI ≥ -3)"
                      className={`w-4 h-4 rounded-full transition-all ${
                        kanitzAtual.classificacao === 'penumbra'
                          ? 'bg-amber-400 shadow-[0_0_10px_#F59E0B] scale-110'
                          : 'bg-amber-950/70 opacity-40'
                      }`}
                    />
                    <div
                      title="Insolvente (FI < -3)"
                      className={`w-4 h-4 rounded-full transition-all ${
                        kanitzAtual.classificacao === 'insolvente'
                          ? 'bg-rose-500 shadow-[0_0_10px_#EF4444] scale-110'
                          : 'bg-rose-950/70 opacity-40'
                      }`}
                    />
                  </div>
                </div>
              </div>
            ) : (
              /* Comparativo dos 2 Índices */
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-200">
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                    <span
                      className="text-[11px] font-bold text-blue-950 truncate"
                      title={selectedEmpresa?.nome}
                    >
                      {selectedEmpresa?.nome || 'Empresa A'}
                    </span>
                  </div>
                  <strong className="text-2xl sm:text-3xl font-black font-mono text-blue-900 block">
                    {kanitzAtual.fi !== null ? formatNumber(kanitzAtual.fi, 2) : 'N/D'}
                  </strong>
                  <Badge
                    className={`mt-1.5 text-[9px] px-1.5 py-0 font-bold ${statusConfig.bgBadge}`}
                  >
                    {statusConfig.labelCurto}
                  </Badge>
                </div>

                <div className="p-3 bg-purple-50/70 rounded-xl border border-purple-200">
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className="w-2.5 h-2.5 rounded-full bg-purple-600" />
                    <span
                      className="text-[11px] font-bold text-purple-950 truncate"
                      title={selectedEmpresaB?.nome}
                    >
                      {selectedEmpresaB?.nome || 'Selecione a 2ª'}
                    </span>
                  </div>
                  <strong className="text-2xl sm:text-3xl font-black font-mono text-purple-900 block">
                    {kanitzBAtual.fi !== null ? formatNumber(kanitzBAtual.fi, 2) : 'N/D'}
                  </strong>
                  <Badge
                    className={`mt-1.5 text-[9px] px-1.5 py-0 font-bold ${statusConfigB.bgBadge}`}
                  >
                    {statusConfigB.labelCurto}
                  </Badge>
                </div>
              </div>
            )}

            {/* Explicação da Classificação Atual */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
              {!compararAtivo ? (
                <>
                  <strong className="block font-bold text-[#0B1F3A] flex items-center gap-1.5">
                    <Info className="w-4 h-4 text-blue-600" />
                    {kanitzAtual.statusTexto}
                  </strong>
                  <p className="text-slate-600 leading-relaxed text-[11px]">
                    {kanitzAtual.descricaoClassificacao}
                  </p>
                </>
              ) : (
                <>
                  <strong className="block font-bold text-[#0B1F3A] flex items-center gap-1.5">
                    <Trophy className="w-4 h-4 text-amber-500" />
                    {comparacaoSolvencia?.vencedor === 'A'
                      ? `${selectedEmpresa?.nome || 'Empresa A'} está Mais Solvente`
                      : comparacaoSolvencia?.vencedor === 'B'
                        ? `${selectedEmpresaB?.nome || 'Empresa B'} está Mais Solvente`
                        : comparacaoSolvencia?.vencedor === 'empate'
                          ? 'Empresas em Situação Idêntica de Solvência'
                          : 'Comparativo Pendente'}
                  </strong>
                  <p className="text-slate-600 leading-relaxed text-[11px]">
                    {comparacaoSolvencia?.motivo ||
                      'Selecione uma segunda empresa com balanços cadastrados para visualizar a comparação.'}
                  </p>
                </>
              )}
            </div>

            {/* Régua de Zonas de Kanitz */}
            <div className="space-y-1.5 pt-1 border-t border-slate-100">
              <div className="flex items-center justify-between text-[10px] text-slate-500 font-semibold">
                <span>Escala de Risco:</span>
                <span className="text-slate-400">Padrão Univ. de São Paulo (USP)</span>
              </div>
              <div className="grid grid-cols-3 gap-1 text-[10px] text-center font-bold">
                <div className="p-1.5 rounded-lg bg-rose-50 text-rose-800 border border-rose-200">
                  <span className="block text-[9px] text-rose-600 font-normal">−7 a −3</span>
                  Insolvente
                </div>
                <div className="p-1.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200">
                  <span className="block text-[9px] text-amber-600 font-normal">−3 a 0</span>
                  Penumbra
                </div>
                <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200">
                  <span className="block text-[9px] text-emerald-600 font-normal">0 a +7</span>
                  Solvente
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* GAUGE / TERMÔMETRO HORIZONTAL VISUAL (COM 1 OU 2 MARCADORES PROPORCIONAIS) */}
        <Card className="lg:col-span-7 bg-white border-slate-200 shadow-2xs flex flex-col justify-between">
          <CardHeader className="p-5 pb-3 border-b border-slate-100">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <CardTitle className="text-base font-bold text-[#0B1F3A] flex items-center gap-2">
                  <Flame className="w-5 h-5 text-indigo-600" />
                  Termômetro Visual de Posição do FI (−7 a +7)
                </CardTitle>
                <CardDescription className="text-xs text-slate-500 mt-0.5">
                  Posicionamento geométrico do Fator de Insolvência nas três faixas de risco
                </CardDescription>
              </div>
              {!compararAtivo ? (
                kanitzAtual.fi !== null && (
                  <Badge className="bg-slate-100 text-slate-800 font-mono text-xs font-bold border-slate-200">
                    FI:{' '}
                    {kanitzAtual.fi > 0
                      ? `+${kanitzAtual.fi.toFixed(2)}`
                      : kanitzAtual.fi.toFixed(2)}
                  </Badge>
                )
              ) : (
                <div className="flex items-center gap-2">
                  <Badge className="bg-blue-100 text-blue-900 border-blue-300 font-mono text-xs font-bold">
                    {selectedEmpresa?.nome?.slice(0, 10)}:{' '}
                    {kanitzAtual.fi !== null ? kanitzAtual.fi.toFixed(2) : 'N/D'}
                  </Badge>
                  <Badge className="bg-purple-100 text-purple-900 border-purple-300 font-mono text-xs font-bold">
                    {selectedEmpresaB?.nome?.slice(0, 10) || 'B'}:{' '}
                    {kanitzBAtual.fi !== null ? kanitzBAtual.fi.toFixed(2) : 'N/D'}
                  </Badge>
                </div>
              )}
            </div>
          </CardHeader>

          <CardContent className="p-5 space-y-6">
            {/* Termômetro Horizontal em Barra com Marcador(es) Dinâmico(s) */}
            <div className="space-y-2 pt-6">
              <div className="relative w-full">
                {/* Marcador Empresa A (Azul) */}
                {kanitzAtual.fi !== null && (
                  <div
                    className="absolute -top-7 transition-all duration-500 -translate-x-1/2 flex flex-col items-center z-20"
                    style={{
                      left: `${Math.max(3, Math.min(97, kanitzAtual.termometroPosicaoPercentual))}%`,
                    }}
                  >
                    <div className="bg-[#0B1F3A] text-white text-[10px] font-bold font-mono px-2 py-0.5 rounded-md shadow-md whitespace-nowrap flex items-center gap-1 border border-blue-400">
                      {compararAtivo && <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />}
                      FI {kanitzAtual.fi.toFixed(2)}
                    </div>
                    <div className="w-2 h-2 bg-[#0B1F3A] rotate-45 -mt-1 border-r border-b border-blue-400" />
                  </div>
                )}

                {/* Marcador Empresa B (Roxo) - quando modo comparar ativo */}
                {compararAtivo && kanitzBAtual.fi !== null && (
                  <div
                    className="absolute -bottom-8 transition-all duration-500 -translate-x-1/2 flex flex-col items-center z-20"
                    style={{
                      left: `${Math.max(3, Math.min(97, kanitzBAtual.termometroPosicaoPercentual))}%`,
                    }}
                  >
                    <div className="w-2 h-2 bg-purple-700 rotate-45 -mb-1 border-l border-t border-purple-300" />
                    <div className="bg-purple-900 text-white text-[10px] font-bold font-mono px-2 py-0.5 rounded-md shadow-md whitespace-nowrap flex items-center gap-1 border border-purple-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                      {selectedEmpresaB?.nome?.slice(0, 8) || 'B'}: FI {kanitzBAtual.fi.toFixed(2)}
                    </div>
                  </div>
                )}

                {/* Barra com as 3 faixas coloridas e calibradas:
                    Escala de -7 a +7 (total 14):
                    -7 a -3 = 4 pontos = 28.57% (Insolvente)
                    -3 a 0  = 3 pontos = 21.43% (Penumbra)
                    0 a +7  = 7 pontos = 50.00% (Solvente)
                */}
                <div className="h-7 w-full rounded-xl overflow-hidden flex border border-slate-300 shadow-inner">
                  {/* Zona Insolvente (28.57%) */}
                  <div
                    style={{ width: '28.57%' }}
                    className="bg-gradient-to-r from-rose-600 to-rose-400 flex items-center justify-center text-white text-[10px] font-bold tracking-tight shadow-inner"
                    title="Zona de Insolvência (−7 a −3)"
                  >
                    Insolvente
                  </div>
                  {/* Zona Penumbra (21.43%) */}
                  <div
                    style={{ width: '21.43%' }}
                    className="bg-gradient-to-r from-amber-400 to-yellow-400 flex items-center justify-center text-amber-950 text-[10px] font-bold tracking-tight shadow-inner"
                    title="Zona de Penumbra (−3 a 0)"
                  >
                    Penumbra
                  </div>
                  {/* Zona Solvente (50%) */}
                  <div
                    style={{ width: '50.00%' }}
                    className="bg-gradient-to-r from-emerald-400 to-teal-500 flex items-center justify-center text-white text-[10px] font-bold tracking-tight shadow-inner"
                    title="Zona de Solvência (0 a +7)"
                  >
                    Solvente
                  </div>
                </div>

                {/* Marcador de Linha Vertical Empresa A */}
                {kanitzAtual.fi !== null && (
                  <div
                    className="absolute top-0 bottom-0 w-1 bg-slate-950 rounded-full shadow-lg transition-all duration-500 -translate-x-1/2 pointer-events-none z-10"
                    style={{
                      left: `${Math.max(1, Math.min(99, kanitzAtual.termometroPosicaoPercentual))}%`,
                    }}
                  />
                )}

                {/* Marcador de Linha Vertical Empresa B */}
                {compararAtivo && kanitzBAtual.fi !== null && (
                  <div
                    className="absolute top-0 bottom-0 w-1.5 bg-purple-600 rounded-full shadow-lg transition-all duration-500 -translate-x-1/2 pointer-events-none z-10"
                    style={{
                      left: `${Math.max(1, Math.min(99, kanitzBAtual.termometroPosicaoPercentual))}%`,
                    }}
                  />
                )}
              </div>

              {/* Marcações Numéricas da Escala */}
              <div
                className={`flex justify-between text-[10px] font-mono text-slate-500 font-semibold px-0.5 ${compararAtivo ? 'pt-6' : 'pt-1'}`}
              >
                <span>−7,0</span>
                <span>−5,0</span>
                <span className="text-rose-600 font-bold">−3,0 (Limite)</span>
                <span>−1,5</span>
                <span className="text-emerald-700 font-bold">0,0 (Equilíbrio)</span>
                <span>+3,5</span>
                <span>+7,0</span>
              </div>
            </div>

            {/* Legenda quando Comparativo Ativo */}
            {compararAtivo && (
              <div className="flex items-center justify-center gap-6 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold">
                <div className="flex items-center gap-1.5 text-blue-900">
                  <div className="w-3 h-3 rounded-full bg-[#0B1F3A] border border-blue-400" />
                  <span>
                    {selectedEmpresa?.nome || 'Empresa A'}: FI{' '}
                    {kanitzAtual.fi !== null ? kanitzAtual.fi.toFixed(2) : 'N/D'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-purple-900">
                  <div className="w-3 h-3 rounded-full bg-purple-700 border border-purple-300" />
                  <span>
                    {selectedEmpresaB?.nome || 'Empresa B'}: FI{' '}
                    {kanitzBAtual.fi !== null ? kanitzBAtual.fi.toFixed(2) : 'N/D'}
                  </span>
                </div>
              </div>
            )}

            {/* Fórmula Matemática Destacada */}
            <div className="bg-slate-900 text-slate-100 p-4 rounded-xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
                  <Scale className="w-3.5 h-3.5" />
                  Equação Discriminante de Kanitz
                </span>
                <Badge className="bg-slate-800 text-slate-300 border-none text-[9px] font-mono">
                  Matemática Aplicada
                </Badge>
              </div>
              <div className="p-2.5 bg-slate-950/80 rounded-lg font-mono text-xs text-indigo-200 overflow-x-auto whitespace-nowrap border border-slate-800">
                FI = (0,05 × X1) + (1,65 × X2) + (3,55 × X3) − (1,06 × X4) − (0,33 × X5)
              </div>
              <p className="text-[10px] text-slate-400 leading-normal">
                Quanto mais positivo for o índice <strong>FI</strong>, mais distante a empresa está
                do risco de falência. Valores negativos indicam fragilidades nos pilares de
                liquidez, retorno ou excesso de endividamento.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* CARD COMPARATIVO LADO A LADO DAS DUAS EMPRESAS (QUANDO MODO COMPARAR ATIVO) */}
      {compararAtivo && (
        <Card className="bg-white border-indigo-200 shadow-sm animate-fadeIn">
          <CardHeader className="pb-3 border-b border-indigo-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-indigo-50/50 to-purple-50/50">
            <div>
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-indigo-600 text-white rounded-lg">
                  <ArrowRightLeft className="w-4 h-4" />
                </div>
                <CardTitle className="text-base font-bold text-[#0B1F3A]">
                  Comparativo Detalhado de Solvência: {selectedEmpresa?.nome || 'Empresa A'} vs{' '}
                  {selectedEmpresaB?.nome || 'Empresa B'} ({selectedAno})
                </CardTitle>
              </div>
              <CardDescription className="text-xs text-slate-500 mt-0.5">
                Confronto direto dos Fatores de Insolvência e das 5 variáveis contábeis no mesmo
                exercício
              </CardDescription>
            </div>

            {comparacaoSolvencia?.vencedor && (
              <Badge className="bg-emerald-100 text-emerald-900 border-emerald-300 text-xs font-bold gap-1 px-2.5 py-1">
                <Trophy className="w-3.5 h-3.5 text-emerald-600" />
                Mais Solvente: {comparacaoSolvencia.empresaNome}
              </Badge>
            )}
          </CardHeader>

          <CardContent className="p-5 space-y-6">
            {/* Cards Lado a Lado dos KPIs Principais */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Card Empresa A */}
              <div className="p-4 rounded-2xl border-2 border-blue-200 bg-blue-50/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-600" />
                    <strong className="text-sm font-bold text-blue-950">
                      {selectedEmpresa?.nome || 'Empresa A'}
                    </strong>
                  </div>
                  {comparacaoSolvencia?.vencedor === 'A' && (
                    <Badge className="bg-emerald-600 text-white text-[10px] font-bold gap-1 shadow-xs">
                      <Trophy className="w-3 h-3" /> Mais Solvente
                    </Badge>
                  )}
                </div>

                <div className="flex items-baseline justify-between pt-1">
                  <div>
                    <span className="text-[11px] text-slate-500 block uppercase font-semibold">
                      Fator FI:
                    </span>
                    <strong className="text-3xl font-black font-mono text-blue-900">
                      {kanitzAtual.fi !== null ? formatNumber(kanitzAtual.fi, 2) : 'N/D'}
                    </strong>
                  </div>
                  <Badge className={`text-[11px] font-bold px-2.5 py-1 ${statusConfig.bgBadge}`}>
                    {statusConfig.labelCurto}
                  </Badge>
                </div>

                <p className="text-xs text-slate-600 pt-1 border-t border-blue-100">
                  {kanitzAtual.diagnosticoResumido}
                </p>
              </div>

              {/* Card Empresa B */}
              <div className="p-4 rounded-2xl border-2 border-purple-200 bg-purple-50/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-purple-600" />
                    <strong className="text-sm font-bold text-purple-950">
                      {selectedEmpresaB?.nome || 'Empresa B (Selecione)'}
                    </strong>
                  </div>
                  {comparacaoSolvencia?.vencedor === 'B' && (
                    <Badge className="bg-emerald-600 text-white text-[10px] font-bold gap-1 shadow-xs">
                      <Trophy className="w-3 h-3" /> Mais Solvente
                    </Badge>
                  )}
                </div>

                <div className="flex items-baseline justify-between pt-1">
                  <div>
                    <span className="text-[11px] text-slate-500 block uppercase font-semibold">
                      Fator FI:
                    </span>
                    <strong className="text-3xl font-black font-mono text-purple-900">
                      {kanitzBAtual.fi !== null ? formatNumber(kanitzBAtual.fi, 2) : 'N/D'}
                    </strong>
                  </div>
                  <Badge className={`text-[11px] font-bold px-2.5 py-1 ${statusConfigB.bgBadge}`}>
                    {statusConfigB.labelCurto}
                  </Badge>
                </div>

                <p className="text-xs text-slate-600 pt-1 border-t border-purple-100">
                  {kanitzBAtual.diagnosticoResumido}
                </p>
              </div>
            </div>

            {/* Tabela Comparativa X1 a X5 */}
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 font-bold text-slate-700 border-b border-slate-200 text-[11px]">
                    <th className="py-2.5 px-4">Variável</th>
                    <th className="py-2.5 px-4">Fórmula Contábil</th>
                    <th className="py-2.5 px-4 text-center">Peso / Coef.</th>
                    <th className="py-2.5 px-4 text-right bg-blue-50/50 text-blue-900 font-bold">
                      {selectedEmpresa?.nome || 'Empresa A'}
                    </th>
                    <th className="py-2.5 px-4 text-right bg-purple-50/50 text-purple-900 font-bold">
                      {selectedEmpresaB?.nome || 'Empresa B'}
                    </th>
                    <th className="py-2.5 px-4 text-center">Diferença / Destaque</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-[11px]">
                  {kanitzAtual.variaveis.map((va, idx) => {
                    const vb = kanitzBAtual.variaveis[idx]
                    const valA = va.valor
                    const valB = vb?.valor ?? null
                    const contribA = va.contribuicao
                    const contribB = vb?.contribuicao ?? null

                    let destaqueVencedor = '—'
                    if (valA !== null && valB !== null) {
                      // Para X1, X2, X3: maior é melhor
                      // Para X4: menor é melhor (endividamento negativo)
                      // Para X5: maior liquidez corrente é melhor
                      if (va.id === 'x4') {
                        if (valA < valB)
                          destaqueVencedor = `${selectedEmpresa?.nome || 'A'} (+favorável)`
                        else if (valB < valA)
                          destaqueVencedor = `${selectedEmpresaB?.nome || 'B'} (+favorável)`
                        else destaqueVencedor = 'Iguais'
                      } else {
                        if (valA > valB)
                          destaqueVencedor = `${selectedEmpresa?.nome || 'A'} (+favorável)`
                        else if (valB > valA)
                          destaqueVencedor = `${selectedEmpresaB?.nome || 'B'} (+favorável)`
                        else destaqueVencedor = 'Iguais'
                      }
                    }

                    return (
                      <tr key={va.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-4 font-semibold text-slate-900">
                          <span className="font-mono font-bold text-indigo-700 mr-1.5">
                            {va.sigla}:
                          </span>
                          {va.nome}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-slate-500 text-[10px]">
                          {va.formula}
                        </td>
                        <td className="py-2.5 px-4 text-center font-mono font-bold text-indigo-700">
                          {va.coeficiente > 0 ? `+${va.coeficiente}` : va.coeficiente}
                        </td>
                        <td className="py-2.5 px-4 text-right bg-blue-50/30 font-mono">
                          <strong className="text-blue-900 block">{va.descricaoValor}</strong>
                          <span className="text-[10px] text-slate-400">
                            Contrib:{' '}
                            {contribA !== null
                              ? contribA > 0
                                ? `+${contribA.toFixed(3)}`
                                : contribA.toFixed(3)
                              : 'N/D'}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-right bg-purple-50/30 font-mono">
                          <strong className="text-purple-900 block">
                            {vb?.descricaoValor || 'N/D'}
                          </strong>
                          <span className="text-[10px] text-slate-400">
                            Contrib:{' '}
                            {contribB !== null
                              ? contribB > 0
                                ? `+${contribB.toFixed(3)}`
                                : contribB.toFixed(3)
                              : 'N/D'}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          <Badge
                            variant="outline"
                            className="text-[10px] font-semibold bg-slate-50"
                          >
                            {destaqueVencedor}
                          </Badge>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 3. GRÁFICO DE CONTRIBUIÇÃO DE CADA PARCELA NO FI */}
      <Card className="bg-white border-slate-200 shadow-2xs">
        <CardHeader className="pb-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-blue-50 text-blue-700 rounded-lg">
                <BarChart3 className="w-4 h-4" />
              </div>
              <CardTitle className="text-base font-bold text-[#0B1F3A]">
                Decomposição e Contribuição das 5 Variáveis no FI ({selectedAno})
              </CardTitle>
            </div>
            <CardDescription className="text-xs text-slate-500 mt-0.5">
              Impacto individual de cada parcela ponderada (coeficiente × índice contábil) na
              formação do resultado final
            </CardDescription>
          </div>

          <Badge
            variant="outline"
            className="text-xs font-mono font-semibold bg-slate-50 text-slate-700"
          >
            Fator Final: {kanitzAtual.fi !== null ? kanitzAtual.fi.toFixed(2) : 'N/D'}
          </Badge>
        </CardHeader>

        <CardContent className="p-5">
          {dadosGraficoContribuicao.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              Dados insuficientes para gerar a decomposição gráfica de Kanitz.
            </div>
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={dadosGraficoContribuicao}
                  margin={{ top: 15, right: 15, left: -10, bottom: 25 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis
                    dataKey="sigla"
                    tick={{ fill: '#0B1F3A', fontSize: 11, fontWeight: 700 }}
                  />
                  <YAxis tick={{ fill: '#64748B', fontSize: 10 }} />
                  <ReferenceLine y={0} stroke="#475569" strokeWidth={1.5} />
                  <RechartsTooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null
                      const d = payload[0].payload
                      return (
                        <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl text-xs space-y-1.5 border border-slate-700 max-w-xs">
                          <strong className="block font-bold text-sm text-indigo-300">
                            {d.sigla} — {d.nome}
                          </strong>
                          <div className="text-[11px] text-slate-300 border-b border-slate-800 pb-1">
                            Fórmula: <span className="font-mono text-white">{d.formula}</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-slate-400">Valor Base Extraído:</span>
                            <span className="text-white font-mono font-bold">
                              {d.valorBase !== null ? d.valorBase.toFixed(4) : 'N/D'}
                            </span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-slate-400">Contribuição no FI:</span>
                            <span
                              className={`font-mono font-extrabold ${
                                d.contribuicao >= 0 ? 'text-emerald-400' : 'text-rose-400'
                              }`}
                            >
                              {d.contribuicao > 0
                                ? `+${d.contribuicao.toFixed(3)}`
                                : d.contribuicao.toFixed(3)}
                            </span>
                          </div>
                        </div>
                      )
                    }}
                  />
                  <Bar dataKey="contribuicao" radius={[4, 4, 0, 0]}>
                    {dadosGraficoContribuicao.map((entry, index) => {
                      const isTotal = entry.sigla === 'Fator FI'
                      let cor = '#059669' // positivo
                      if (isTotal) {
                        cor = entry.contribuicao >= 0 ? '#2563EB' : '#DC2626'
                      } else if (entry.contribuicao < 0) {
                        cor = '#F43F5E'
                      }
                      return <Cell key={`cell-${index}`} fill={cor} />
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 4. CARDS DETALHADOS DAS 5 VARIÁVEIS (X1 A X5) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between pb-1 border-b border-slate-200">
          <div>
            <h3 className="text-sm font-bold text-[#0B1F3A] uppercase tracking-wider">
              Detalhamento das Variáveis Contábeis (X1 a X5)
            </h3>
            <p className="text-xs text-slate-500">
              Valores extraídos das demonstrações, memória de cálculo e impacto no Fator de
              Insolvência
            </p>
          </div>
          <Badge className="bg-slate-100 text-slate-700 font-bold text-xs">
            5 Variáveis Ponderadas
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {kanitzAtual.variaveis.map((v) => {
            const isPositive = v.contribuicao !== null && v.contribuicao >= 0
            const isExpanded = expandedVariables[v.id] || false

            return (
              <Card
                key={v.id}
                className="bg-white border-slate-200 shadow-2xs hover:border-indigo-300 transition-all flex flex-col justify-between"
              >
                <CardHeader className="p-4 pb-2 border-b border-slate-100">
                  <div className="flex items-center justify-between gap-2">
                    <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 text-xs font-bold font-mono">
                      {v.sigla}
                    </Badge>
                    <Badge
                      className={`text-[10px] font-mono font-bold ${
                        isPositive
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}
                    >
                      Impacto:{' '}
                      {v.contribuicao !== null
                        ? v.contribuicao > 0
                          ? `+${v.contribuicao.toFixed(3)}`
                          : v.contribuicao.toFixed(3)
                        : 'N/D'}
                    </Badge>
                  </div>
                  <CardTitle className="text-sm font-bold text-[#0B1F3A] mt-1.5">
                    {v.nome}
                  </CardTitle>
                  <CardDescription className="text-[11px] text-slate-500">
                    {v.conceito}
                  </CardDescription>
                </CardHeader>

                <CardContent className="p-4 space-y-3">
                  {/* Valor Principal Extraído */}
                  <div className="flex items-baseline justify-between gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    <div>
                      <span className="text-[10px] text-slate-400 font-semibold block uppercase">
                        Valor da Variável
                      </span>
                      <strong className="text-lg font-black font-mono text-[#0B1F3A]">
                        {v.descricaoValor}
                      </strong>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 font-semibold block uppercase">
                        Coeficiente
                      </span>
                      <span className="text-xs font-mono font-bold text-indigo-700">
                        {v.coeficiente > 0 ? `+${v.coeficiente}` : v.coeficiente}
                      </span>
                    </div>
                  </div>

                  {/* Memória de Cálculo com Numerador e Denominador */}
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between text-slate-500 text-[11px]">
                      <span>{v.numerador.label}:</span>
                      <strong className="text-slate-800 font-mono">
                        {formatCurrency(v.numerador.valor)}
                      </strong>
                    </div>
                    <div className="flex justify-between text-slate-500 text-[11px] border-b border-slate-100 pb-1">
                      <span>{v.denominador.label}:</span>
                      <strong className="text-slate-800 font-mono">
                        {formatCurrency(v.denominador.valor)}
                      </strong>
                    </div>
                    <div className="flex justify-between pt-0.5 text-[11px]">
                      <span className="font-semibold text-slate-700">Fórmula no Modelo:</span>
                      <span className="font-mono text-indigo-700 font-semibold">{v.formula}</span>
                    </div>
                  </div>

                  {/* Toggle para Detalhes Conceituais */}
                  <div className="pt-2 border-t border-slate-100">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleVariable(v.id)}
                      className="w-full h-7 text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 flex items-center justify-between p-1"
                    >
                      <span>Entenda esta variável</span>
                      {isExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </Button>

                    {isExpanded && (
                      <div className="mt-2 p-2.5 rounded-lg bg-indigo-50/50 text-[11px] text-indigo-950 space-y-1 border border-indigo-100 animate-fadeIn">
                        {v.id === 'x1' && (
                          <p>
                            <strong>Rentabilidade do PL:</strong> Mede a capacidade da empresa de
                            gerar lucros com o capital próprio. Lucros positivos fortalecem a
                            solvência.
                          </p>
                        )}
                        {v.id === 'x2' && (
                          <p>
                            <strong>Liquidez Geral:</strong> Pondera todos os direitos realizáveis
                            contra todas as obrigações com terceiros. É um dos pilares mais fortes
                            da fórmula (peso 1,65).
                          </p>
                        )}
                        {v.id === 'x3' && (
                          <p>
                            <strong>Liquidez Seca:</strong> O indicador de maior peso positivo
                            (+3,55) no modelo. Avalia a solvência imediata sem depender do giro de
                            estoques.
                          </p>
                        )}
                        {v.id === 'x4' && (
                          <p>
                            <strong>Grau de Endividamento:</strong> Possui coeficiente negativo
                            (−1,06). Quanto maior o endividamento em relação ao patrimônio líquido,
                            maior a penalização no FI.
                          </p>
                        )}
                        {v.id === 'x5' && (
                          <p>
                            <strong>Liquidez Corrente:</strong> Possui coeficiente corretivo de
                            −0,33 para calibrar a relação entre ativos de curto prazo e dívidas
                            correntes frente à liquidez seca.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {/* 5. TABELA DE EVOLUÇÃO HISTÓRICA (3 ANOS) */}
      <Card className="bg-white border-slate-200 shadow-2xs">
        <CardHeader className="pb-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-blue-50 text-blue-700 rounded-lg">
                <TableProperties className="w-4 h-4" />
              </div>
              <CardTitle className="text-base font-bold text-[#0B1F3A]">
                Evolução Temporal do Fator de Kanitz ({ano2}, {ano1}, {selectedAno})
              </CardTitle>
            </div>
            <CardDescription className="text-xs text-slate-500 mt-0.5">
              Acompanhamento histórico da solvência e transições entre zonas de risco
            </CardDescription>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg">
              <Switch id="evolucao-kanitz" checked={verEvolucao} onCheckedChange={setVerEvolucao} />
              <Label
                htmlFor="evolucao-kanitz"
                className="text-xs font-bold text-slate-700 cursor-pointer"
              >
                Ver histórico detalhado
              </Label>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {!hasHistorico && verEvolucao ? (
            <div className="p-8 text-center text-xs text-slate-500 flex flex-col items-center justify-center gap-2">
              <Info className="w-6 h-6 text-slate-400" />
              <p className="font-semibold text-slate-700">
                Demonstrações contábeis de anos anteriores não encontradas
              </p>
              <p className="text-[11px] text-slate-500 max-w-md">
                Cadastre ou importe balanços e DREs para {ano1} e {ano2} para habilitar a evolução
                temporal do termômetro.
              </p>
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 font-bold text-slate-700 border-b border-slate-200 text-[11px]">
                  <th className="py-2.5 px-4">Indicador / Componente</th>
                  {verEvolucao && <th className="py-2.5 px-4 text-right">{ano2}</th>}
                  {verEvolucao && <th className="py-2.5 px-4 text-right">{ano1}</th>}
                  <th className="py-2.5 px-4 text-right bg-blue-50/50 text-blue-900">
                    {selectedAno} (Atual)
                  </th>
                  <th className="py-2.5 px-4 text-center">Classificação Atual</th>
                  <th className="py-2.5 px-4 text-center">Tendência</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[11px]">
                {/* Linha do Fator FI */}
                <tr className="bg-indigo-50/30 font-bold">
                  <td className="py-2.5 px-4 text-indigo-950 flex items-center gap-2">
                    <Flame className="w-4 h-4 text-amber-500" />
                    <span>Fator de Insolvência (FI)</span>
                  </td>
                  {verEvolucao && (
                    <td className="py-2.5 px-4 text-right font-mono text-slate-700">
                      {kanitzAno2.fi !== null ? kanitzAno2.fi.toFixed(2) : '—'}
                    </td>
                  )}
                  {verEvolucao && (
                    <td className="py-2.5 px-4 text-right font-mono text-slate-700">
                      {kanitzAno1.fi !== null ? kanitzAno1.fi.toFixed(2) : '—'}
                    </td>
                  )}
                  <td className="py-2.5 px-4 text-right font-mono font-black text-blue-900 bg-blue-50/60 text-sm">
                    {kanitzAtual.fi !== null ? kanitzAtual.fi.toFixed(2) : 'N/D'}
                  </td>
                  <td className="py-2.5 px-4 text-center">
                    <Badge className={`text-[10px] font-bold px-2 py-0 ${statusConfig.bgBadge}`}>
                      {kanitzAtual.statusTexto}
                    </Badge>
                  </td>
                  <td className="py-2.5 px-4 text-center">
                    {kanitzAtual.fi !== null && kanitzAno1.fi !== null ? (
                      kanitzAtual.fi > kanitzAno1.fi ? (
                        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] gap-1 px-1.5 py-0 font-bold">
                          <TrendingUp className="w-3 h-3 text-emerald-600" />↑ Melhora
                        </Badge>
                      ) : kanitzAtual.fi < kanitzAno1.fi ? (
                        <Badge className="bg-rose-50 text-rose-700 border-rose-200 text-[10px] gap-1 px-1.5 py-0 font-bold">
                          <TrendingDown className="w-3 h-3 text-rose-600" />↓ Piora
                        </Badge>
                      ) : (
                        <Badge className="bg-slate-100 text-slate-600 border-slate-200 text-[10px] px-1.5 py-0">
                          Estável
                        </Badge>
                      )
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                </tr>

                {/* Linhas das 5 Variáveis */}
                {kanitzAtual.variaveis.map((v, i) => {
                  const valAno1 = kanitzAno1.variaveis[i]?.valor
                  const valAno2 = kanitzAno2.variaveis[i]?.valor

                  return (
                    <tr key={v.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2 px-4 text-slate-800 font-medium">
                        <span className="font-mono font-bold text-indigo-700 mr-2">{v.sigla}</span>
                        {v.nome}
                      </td>
                      {verEvolucao && (
                        <td className="py-2 px-4 text-right font-mono text-slate-600">
                          {valAno2 !== null && valAno2 !== undefined ? valAno2.toFixed(3) : '—'}
                        </td>
                      )}
                      {verEvolucao && (
                        <td className="py-2 px-4 text-right font-mono text-slate-600">
                          {valAno1 !== null && valAno1 !== undefined ? valAno1.toFixed(3) : '—'}
                        </td>
                      )}
                      <td className="py-2 px-4 text-right font-mono font-bold text-blue-900 bg-blue-50/30">
                        {v.valor !== null ? v.valor.toFixed(3) : 'N/D'}
                      </td>
                      <td className="py-2 px-4 text-center text-slate-500 font-mono text-[10px]">
                        Contrib: {v.contribuicao !== null ? v.contribuicao.toFixed(3) : '—'}
                      </td>
                      <td className="py-2 px-4 text-center">
                        {v.valor !== null && valAno1 !== null && valAno1 !== undefined ? (
                          v.valor > valAno1 ? (
                            <span className="text-emerald-600 font-bold">↑</span>
                          ) : (
                            <span className="text-rose-600 font-bold">↓</span>
                          )
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 6. PARECER EXECUTIVO CONSOLIDADO DE SOLVÊNCIA */}
      <Card className="bg-white border-slate-200 shadow-2xs">
        <CardHeader className="pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-indigo-50 text-indigo-700 rounded-lg">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <CardTitle className="text-base font-bold text-[#0B1F3A]">
              Parecer Executivo de Risco &amp; Solvência Corporativa
            </CardTitle>
          </div>
          <CardDescription className="text-xs text-slate-500 mt-0.5">
            Diagnóstico consolidado elaborado para o comitê financeiro e credores
          </CardDescription>
        </CardHeader>

        <CardContent className="p-5 space-y-4 text-xs text-slate-700 leading-relaxed">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <h4 className="font-bold text-[#0B1F3A] text-sm flex items-center gap-2">
              <StatusIcon className={`w-4 h-4 ${statusConfig.corTexto}`} />
              Diagnóstico do Fator de Insolvência ({selectedAno})
            </h4>
            <p>{kanitzAtual.diagnosticoResumido}</p>
            <p>{kanitzAtual.descricaoClassificacao}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-3.5 rounded-xl border border-slate-200 space-y-1.5">
              <strong className="text-slate-900 block font-bold">
                Pontos Fortes Identificados no Exercício:
              </strong>
              <ul className="list-disc list-inside space-y-1 text-slate-600 text-[11px]">
                {kanitzAtual.variaveis
                  .filter((v) => v.contribuicao !== null && v.contribuicao > 0)
                  .map((v) => (
                    <li key={v.id}>
                      <strong>
                        {v.nome} ({v.sigla}):
                      </strong>{' '}
                      Contribuição positiva de +{v.contribuicao?.toFixed(3)} pontos no FI.
                    </li>
                  ))}
                {kanitzAtual.variaveis.every((v) => !v.contribuicao || v.contribuicao <= 0) && (
                  <li className="text-slate-400">
                    Nenhum componente com contribuição expressiva positiva.
                  </li>
                )}
              </ul>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-200 space-y-1.5">
              <strong className="text-slate-900 block font-bold">
                Recomendações e Plano de Ação Gerencial:
              </strong>
              <ul className="list-disc list-inside space-y-1 text-slate-600 text-[11px]">
                {kanitzAtual.classificacao === 'solvente' && (
                  <>
                    <li>Manter o controle rigoroso da liquidez seca e do ciclo de recebimentos.</li>
                    <li>
                      Aproveitar a solidez financeira para negociar melhores custos de captação.
                    </li>
                    <li>
                      Reinvestir parte dos lucros para sustentar a rentabilidade do patrimônio
                      líquido.
                    </li>
                  </>
                )}
                {kanitzAtual.classificacao === 'penumbra' && (
                  <>
                    <li>
                      Alongar o perfil das dívidas bancárias onerosas do curto para o longo prazo.
                    </li>
                    <li>
                      Acelerar o giro de estoques e intensificar a cobrança de recebíveis vencidos.
                    </li>
                    <li>
                      Monitorar semanalmente as projeções de fluxo de caixa para evitar déficits.
                    </li>
                  </>
                )}
                {kanitzAtual.classificacao === 'insolvente' && (
                  <>
                    <li>
                      Executar com urgência um plano de reestruturação de passivos com credores.
                    </li>
                    <li>
                      Avaliar aportes de capital pelos sócios para recompor o Patrimônio Líquido.
                    </li>
                    <li>Reduzir despesas fixas não operacionais para estancar perdas de caixa.</li>
                  </>
                )}
                {kanitzAtual.classificacao === 'indefinido' && (
                  <li>
                    Inserir demonstrações contábeis completas para apuração das recomendações.
                  </li>
                )}
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
