import React, { useState, useEffect, useMemo } from 'react'
import { empresasService } from '@/services/financeService'
import { recebiveisService } from '@/services/recebiveisService'
import type { RecebivelRecord, EmpresaRecord } from '@/types/finance'
import { useToast } from '@/hooks/use-toast'
import { useRealtime } from '@/hooks/use-realtime'
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
  CheckCircle2,
  Clock,
  Download,
  Filter,
  DollarSign,
  Building,
  Calendar as CalendarIcon,
  Search,
  Undo2,
  Trash2,
  Plus,
  ArrowRight,
  TrendingUp,
  Receipt,
  FileSpreadsheet,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

// Formata data ISO ou YYYY-MM-DD para dd/mm/aaaa
function formatarDataBr(dataStr?: string | null): string {
  if (!dataStr) return '—'
  const partes = dataStr.slice(0, 10).split('-')
  if (partes.length === 3) {
    const [ano, mes, dia] = partes
    return `${dia}/${mes}/${ano}`
  }
  return dataStr
}

// Formata número para moeda brasileira R$ 1.234,56
function formatarMoeda(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return 'R$ 0,00'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(val)
}

function dataHojeIso(): string {
  return new Date().toISOString().slice(0, 10)
}

// Retorna primeiro e último dia do mês corrente (YYYY-MM-DD)
function periodoMesCorrenteIso(): { inicio: string; fim: string } {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  const primeiroDia = new Date(y, m, 1)
  const ultimoDia = new Date(y, m + 1, 0)
  return {
    inicio: primeiroDia.toISOString().slice(0, 10),
    fim: ultimoDia.toISOString().slice(0, 10),
  }
}

export default function BaixaRecebiveis() {
  const { toast } = useToast()
  const navigate = useNavigate()

  // Estados principais de dados
  const [empresas, setEmpresas] = useState<EmpresaRecord[]>([])
  const [recebiveis, setRecebiveis] = useState<RecebivelRecord[]>([])
  const [loading, setLoading] = useState(true)

  // Filtros
  const [filtroEmpresa, setFiltroEmpresa] = useState<string>('todas')
  const [dataInicio, setDataInicio] = useState<string>('')
  const [dataFim, setDataFim] = useState<string>('')
  const [apenasPendentes, setApenasPendentes] = useState<boolean>(false)
  const [termoBusca, setTermoBusca] = useState<string>('')

  // Modal Dar Baixa
  const [modalBaixaOpen, setModalBaixaOpen] = useState(false)
  const [recebivelParaBaixa, setRecebivelParaBaixa] = useState<RecebivelRecord | null>(null)
  const [dataPagamentoInput, setDataPagamentoInput] = useState<string>(dataHojeIso())
  const [salvandoBaixa, setSalvandoBaixa] = useState(false)

  // Modal Desfazer Baixa
  const [modalDesfazerOpen, setModalDesfazerOpen] = useState(false)
  const [recebivelParaDesfazer, setRecebivelParaDesfazer] = useState<RecebivelRecord | null>(null)
  const [salvandoDesfazer, setSalvandoDesfazer] = useState(false)

  // Modal Excluir Parcela
  const [modalExcluirOpen, setModalExcluirOpen] = useState(false)
  const [recebivelParaExcluir, setRecebivelParaExcluir] = useState<RecebivelRecord | null>(null)
  const [salvandoExcluir, setSalvandoExcluir] = useState(false)

  // Carregar dados
  const carregarDados = async () => {
    try {
      setLoading(true)
      const [empList, recList] = await Promise.all([
        empresasService.getAll(),
        recebiveisService.listarPorPeriodo(),
      ])
      setEmpresas(empList)
      setRecebiveis(recList)
    } catch (err) {
      console.error('Erro ao carregar recebíveis:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar dados',
        description: 'Não foi possível carregar os títulos a receber.',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarDados()
  }, [])

  // Sincronização em tempo real
  useRealtime<RecebivelRecord>('recebiveis', () => {
    recebiveisService.listarPorPeriodo().then((list) => {
      setRecebiveis(list)
    })
  })

  // Mapa de lookup de empresas
  const empresaMap = useMemo(() => {
    const m = new Map<string, EmpresaRecord>()
    for (const e of empresas) m.set(e.id, e)
    return m
  }, [empresas])

  // ================== ATALHOS DE PERÍODO ==================
  const handleAtalhoMesAtual = () => {
    const p = periodoMesCorrenteIso()
    setDataInicio(p.inicio)
    setDataFim(p.fim)
    setApenasPendentes(false)
  }

  const handleAtalhoMesAnterior = () => {
    const now = new Date()
    const y = now.getFullYear()
    const m = now.getMonth() - 1
    const inicio = new Date(y, m, 1).toISOString().slice(0, 10)
    const fim = new Date(y, m + 1, 0).toISOString().slice(0, 10)
    setDataInicio(inicio)
    setDataFim(fim)
    setApenasPendentes(false)
  }

  const handleAtalhoProximos30Dias = () => {
    const now = new Date()
    const inicio = now.toISOString().slice(0, 10)
    const next30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    const fim = next30.toISOString().slice(0, 10)
    setDataInicio(inicio)
    setDataFim(fim)
    setApenasPendentes(false)
  }

  const handleAtalhoTodosPendentes = () => {
    setDataInicio('')
    setDataFim('')
    setApenasPendentes(true)
  }

  const handleLimparFiltros = () => {
    setFiltroEmpresa('todas')
    setDataInicio('')
    setDataFim('')
    setApenasPendentes(false)
    setTermoBusca('')
  }

  // ================== FILTRAGEM ==================
  const recebiveisFiltrados = useMemo(() => {
    return recebiveis.filter((r) => {
      // Filtro empresa
      if (filtroEmpresa !== 'todas' && r.empresa !== filtroEmpresa) return false

      // Filtro apenas pendentes
      if (apenasPendentes && r.status !== 'Pendente') return false

      // Filtro de data vencimento
      const vencStr = (r.vencimento || '').slice(0, 10)
      if (dataInicio && vencStr < dataInicio) return false
      if (dataFim && vencStr > dataFim) return false

      // Busca textual por nome da empresa
      if (termoBusca.trim()) {
        const termo = termoBusca.toLowerCase().trim()
        const emp = r.expand?.empresa || empresaMap.get(r.empresa)
        const nomeEmp = (emp?.nome || '').toLowerCase()
        const parcelaStr = `parcela ${r.parcela}`
        if (!nomeEmp.includes(termo) && !parcelaStr.includes(termo)) return false
      }

      return true
    })
  }, [recebiveis, filtroEmpresa, apenasPendentes, dataInicio, dataFim, termoBusca, empresaMap])

  // ================== TOTALIZADORES ==================
  const totalizadores = useMemo(() => {
    let totalTitulos = recebiveisFiltrados.length
    let totalPendente = 0
    let totalPago = 0

    for (const r of recebiveisFiltrados) {
      const v = Number(r.valor) || 0
      if (r.status === 'Pago') {
        totalPago += v
      } else {
        totalPendente += v
      }
    }

    const saldoAReceber = totalPendente // saldo a receber é o valor que ainda está pendente

    return {
      totalTitulos,
      totalPendente,
      totalPago,
      saldoAReceber,
    }
  }, [recebiveisFiltrados])

  // ================== AÇÕES DE BAIXA / DESFAZER / EXCLUIR ==================
  const handleAbrirBaixa = (r: RecebivelRecord) => {
    setRecebivelParaBaixa(r)
    setDataPagamentoInput(dataHojeIso())
    setModalBaixaOpen(true)
  }

  const handleConfirmarBaixa = async () => {
    if (!recebivelParaBaixa) return
    setSalvandoBaixa(true)
    try {
      const atualizado = await recebiveisService.darBaixa(
        recebivelParaBaixa.id,
        dataPagamentoInput || dataHojeIso(),
      )
      setRecebiveis((prev) => prev.map((item) => (item.id === atualizado.id ? atualizado : item)))
      toast({
        title: 'Baixa efetuada com sucesso!',
        description: `Parcela ${recebivelParaBaixa.parcela} (${formatarMoeda(recebivelParaBaixa.valor)}) marcada como Paga em ${formatarDataBr(dataPagamentoInput)}.`,
      })
      setModalBaixaOpen(false)
      setRecebivelParaBaixa(null)
    } catch (err: any) {
      console.error('Erro ao dar baixa:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao dar baixa',
        description: err?.message || 'Não foi possível registrar o pagamento.',
      })
    } finally {
      setSalvandoBaixa(false)
    }
  }

  const handleAbrirDesfazer = (r: RecebivelRecord) => {
    setRecebivelParaDesfazer(r)
    setModalDesfazerOpen(true)
  }

  const handleConfirmarDesfazer = async () => {
    if (!recebivelParaDesfazer) return
    setSalvandoDesfazer(true)
    try {
      const atualizado = await recebiveisService.desfazerBaixa(recebivelParaDesfazer.id)
      setRecebiveis((prev) => prev.map((item) => (item.id === atualizado.id ? atualizado : item)))
      toast({
        title: 'Baixa desfeita com sucesso',
        description: `Parcela ${recebivelParaDesfazer.parcela} retornou para o status Pendente.`,
      })
      setModalDesfazerOpen(false)
      setRecebivelParaDesfazer(null)
    } catch (err: any) {
      console.error('Erro ao desfazer baixa:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao desfazer',
        description: err?.message || 'Não foi possível estornar a baixa.',
      })
    } finally {
      setSalvandoDesfazer(false)
    }
  }

  const handleAbrirExcluir = (r: RecebivelRecord) => {
    setRecebivelParaExcluir(r)
    setModalExcluirOpen(true)
  }

  const handleConfirmarExcluir = async () => {
    if (!recebivelParaExcluir) return
    setSalvandoExcluir(true)
    try {
      await recebiveisService.excluirParcela(recebivelParaExcluir.id)
      setRecebiveis((prev) => prev.filter((i) => i.id !== recebivelParaExcluir.id))
      toast({
        title: 'Parcela excluída',
        description: 'O recebível foi removido com sucesso.',
      })
      setModalExcluirOpen(false)
      setRecebivelParaExcluir(null)
    } catch (err: any) {
      console.error('Erro ao excluir parcela:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir',
        description: err?.message || 'Não foi possível excluir o recebível.',
      })
    } finally {
      setSalvandoExcluir(false)
    }
  }

  // ================== EXPORTAÇÃO CSV ==================
  const handleExportarCsv = () => {
    if (recebiveisFiltrados.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Nenhum título',
        description: 'Não há títulos para exportar no filtro atual.',
      })
      return
    }

    const escapeCsv = (val: string | number | undefined | null): string => {
      if (val === null || val === undefined) return ''
      const s = String(val)
      if (/[;"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
      return s
    }

    const colunas = [
      'Empresa',
      'Nº Parcela',
      'Data de Início Serviços',
      'Data de Vencimento',
      'Valor (R$)',
      'Status',
      'Data de Pagamento',
    ]

    const linhas: string[] = []
    linhas.push(colunas.map(escapeCsv).join(';'))

    for (const r of recebiveisFiltrados) {
      const emp = r.expand?.empresa || empresaMap.get(r.empresa)
      const empNome = emp?.nome || ''
      const parcela = r.parcela
      const inicio = formatarDataBr(r.data_inicio_servicos)
      const vencimento = formatarDataBr(r.vencimento)
      const valorStr = (Number(r.valor) || 0).toFixed(2).replace('.', ',')
      const status = r.status
      const pagamento = r.data_pagamento ? formatarDataBr(r.data_pagamento) : ''

      linhas.push(
        [empNome, parcela, inicio, vencimento, valorStr, status, pagamento]
          .map(escapeCsv)
          .join(';'),
      )
    }

    const csvContent = '\uFEFF' + linhas.join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    const nomeEmp =
      filtroEmpresa === 'todas'
        ? 'todas_empresas'
        : (empresaMap.get(filtroEmpresa)?.nome || 'empresa').toLowerCase().replace(/\s+/g, '_')
    link.setAttribute('download', `baixa_recebiveis_${nomeEmp}_${dataHojeIso()}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(link.href)

    toast({
      title: 'Exportação concluída',
      description: `${recebiveisFiltrados.length} recebível(eis) exportado(s) para CSV com sucesso.`,
    })
  }

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#0B1F3A] tracking-tight flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            Baixa dos Recebíveis
          </h1>
          <p className="text-xs text-[#5B6B7F]">
            Controle de liquidação de títulos, registro de pagamentos recebidos e conciliação de
            contratos.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => navigate('/financeiro')}
            className="h-8 text-xs font-semibold text-blue-700 bg-white border-blue-200 hover:bg-blue-50 gap-1.5 shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            Gerar Novos Recebíveis
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExportarCsv}
            disabled={recebiveisFiltrados.length === 0}
            className="h-8 text-xs font-semibold text-slate-700 bg-white border-slate-200 hover:border-blue-300 hover:text-blue-700 gap-1.5 shadow-2xs"
          >
            <Download className="w-3.5 h-3.5 text-blue-600" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {/* 4 Cards de Totalizadores no Topo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total de Títulos */}
        <Card className="bg-white border-slate-200 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Total de Títulos
              </p>
              <p className="text-2xl font-bold text-[#0B1F3A]">{totalizadores.totalTitulos}</p>
              <p className="text-[11px] text-slate-400">Filtrados na visualização</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Receipt className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        {/* Total Pendente */}
        <Card className="bg-white border-slate-200 shadow-xs border-l-4 border-l-amber-500">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">
                Total Pendente
              </p>
              <p className="text-2xl font-bold text-amber-700 font-mono">
                {formatarMoeda(totalizadores.totalPendente)}
              </p>
              <p className="text-[11px] text-amber-600/80">Aguardando pagamento</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        {/* Total Pago */}
        <Card className="bg-white border-slate-200 shadow-xs border-l-4 border-l-emerald-500">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">
                Total Pago (Baixado)
              </p>
              <p className="text-2xl font-bold text-emerald-700 font-mono">
                {formatarMoeda(totalizadores.totalPago)}
              </p>
              <p className="text-[11px] text-emerald-600/80">Liquidados com sucesso</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        {/* Saldo a Receber */}
        <Card className="bg-white border-slate-200 shadow-xs border-l-4 border-l-blue-600">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">
                Saldo a Receber
              </p>
              <p className="text-2xl font-bold text-blue-700 font-mono">
                {formatarMoeda(totalizadores.saldoAReceber)}
              </p>
              <p className="text-[11px] text-blue-600/80">Fluxo a realizar</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bloco de Filtros e Atalhos */}
      <Card className="bg-white border-slate-200 shadow-xs">
        <CardHeader className="pb-3 border-b border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <CardTitle className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
              <Filter className="w-4 h-4 text-blue-600" />
              Filtros de Busca e Período
            </CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">
                Exibindo <strong>{recebiveisFiltrados.length}</strong> de{' '}
                <strong>{recebiveis.length}</strong> títulos
              </span>
              {(filtroEmpresa !== 'todas' ||
                dataInicio ||
                dataFim ||
                apenasPendentes ||
                termoBusca) && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleLimparFiltros}
                  className="h-7 text-xs text-blue-700 hover:text-blue-900"
                >
                  Limpar Filtros
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-4 space-y-3.5">
          {/* Inputs dos Filtros */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Seletor Empresa */}
            <div className="space-y-1.5">
              <Label
                htmlFor="filtro-empresa"
                className="text-xs font-semibold text-slate-700 flex items-center gap-1.5"
              >
                <Building className="w-3.5 h-3.5 text-blue-600" />
                Empresa
              </Label>
              <Select value={filtroEmpresa} onValueChange={setFiltroEmpresa}>
                <SelectTrigger id="filtro-empresa" className="h-9 text-xs bg-white">
                  <SelectValue placeholder="Todas as Empresas" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  <SelectItem value="todas" className="text-xs font-semibold text-blue-700">
                    Todas as Empresas
                  </SelectItem>
                  {empresas.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id} className="text-xs">
                      {emp.nome} {emp.segmento ? `(${emp.segmento})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Data Inicial */}
            <div className="space-y-1.5">
              <Label
                htmlFor="filtro-inicio"
                className="text-xs font-semibold text-slate-700 flex items-center gap-1.5"
              >
                <CalendarIcon className="w-3.5 h-3.5 text-blue-600" />
                Data Inicial (Vencimento)
              </Label>
              <Input
                id="filtro-inicio"
                type="date"
                value={dataInicio}
                onChange={(e) => {
                  setDataInicio(e.target.value)
                  setApenasPendentes(false)
                }}
                className="h-9 text-xs bg-white"
              />
            </div>

            {/* Data Final */}
            <div className="space-y-1.5">
              <Label
                htmlFor="filtro-fim"
                className="text-xs font-semibold text-slate-700 flex items-center gap-1.5"
              >
                <CalendarIcon className="w-3.5 h-3.5 text-blue-600" />
                Data Final (Vencimento)
              </Label>
              <Input
                id="filtro-fim"
                type="date"
                value={dataFim}
                onChange={(e) => {
                  setDataFim(e.target.value)
                  setApenasPendentes(false)
                }}
                className="h-9 text-xs bg-white"
              />
            </div>

            {/* Busca Rápida */}
            <div className="space-y-1.5">
              <Label
                htmlFor="filtro-busca"
                className="text-xs font-semibold text-slate-700 flex items-center gap-1.5"
              >
                <Search className="w-3.5 h-3.5 text-blue-600" />
                Buscar Empresa / Parcela
              </Label>
              <Input
                id="filtro-busca"
                type="text"
                placeholder="Ex: Empresa XYZ, Parcela 3..."
                value={termoBusca}
                onChange={(e) => setTermoBusca(e.target.value)}
                className="h-9 text-xs bg-white"
              />
            </div>
          </div>

          {/* Botões de Atalhos de Período */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-semibold text-slate-500 mr-1">
                Atalhos de Período:
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAtalhoMesAtual}
                className="h-7 text-[11px] px-2.5 bg-slate-50 border-slate-200 hover:bg-slate-100 font-medium"
              >
                Mês Atual
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAtalhoMesAnterior}
                className="h-7 text-[11px] px-2.5 bg-slate-50 border-slate-200 hover:bg-slate-100 font-medium"
              >
                Mês Anterior
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAtalhoProximos30Dias}
                className="h-7 text-[11px] px-2.5 bg-slate-50 border-slate-200 hover:bg-slate-100 font-medium"
              >
                Próximos 30 dias
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAtalhoTodosPendentes}
                className={`h-7 text-[11px] px-2.5 font-semibold transition-colors ${
                  apenasPendentes
                    ? 'bg-amber-600 text-white border-amber-600 hover:bg-amber-700'
                    : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                }`}
              >
                Todos Pendentes
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Recebíveis */}
      <Card className="bg-white border-slate-200 shadow-xs">
        <CardHeader className="pb-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-sm font-bold text-[#0B1F3A]">
              Títulos a Receber ({recebiveisFiltrados.length})
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">
              Clique em <strong>Dar Baixa</strong> para confirmar o recebimento ou em{' '}
              <strong>Desfazer</strong> para estornar.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="py-16 flex justify-center items-center">
              <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : recebiveisFiltrados.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center text-center px-4">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-3 text-slate-400">
                <FileSpreadsheet className="w-7 h-7" />
              </div>
              <h3 className="text-sm font-bold text-[#0B1F3A]">Nenhum título encontrado</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mb-4">
                Não há recebíveis correspondentes aos filtros selecionados. Você pode gerar novos
                títulos ou ajustar o período.
              </p>
              <Button
                onClick={() => navigate('/financeiro')}
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Gerar Recebíveis Anuais
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 font-semibold">
                    <th className="py-3 px-3.5">Empresa</th>
                    <th className="py-3 px-3 text-center w-24">Nº Parcela</th>
                    <th className="py-3 px-3">Vencimento</th>
                    <th className="py-3 px-3 text-right">Valor (R$)</th>
                    <th className="py-3 px-3.5 text-center">Status</th>
                    <th className="py-3 px-3">Data de Pagamento</th>
                    <th className="py-3 px-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recebiveisFiltrados.map((r) => {
                    const emp = r.expand?.empresa || empresaMap.get(r.empresa)
                    const isPago = r.status === 'Pago'

                    return (
                      <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                        {/* Empresa */}
                        <td className="py-3 px-3.5 font-medium text-slate-900 max-w-[200px]">
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-900 truncate" title={emp?.nome}>
                              {emp?.nome || 'Empresa não encontrada'}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              Início:{' '}
                              {r.data_inicio_servicos
                                ? formatarDataBr(r.data_inicio_servicos)
                                : '—'}
                            </span>
                          </div>
                        </td>

                        {/* Nº Parcela */}
                        <td className="py-3 px-3 text-center">
                          <span className="inline-flex items-center justify-center font-mono font-bold text-xs bg-slate-100 text-slate-800 rounded-md px-2 py-0.5 border border-slate-200">
                            {String(r.parcela).padStart(2, '0')}
                          </span>
                        </td>

                        {/* Vencimento */}
                        <td className="py-3 px-3 whitespace-nowrap font-medium text-slate-800">
                          <span className="flex items-center gap-1.5">
                            <CalendarIcon className="w-3.5 h-3.5 text-slate-400" />
                            {formatarDataBr(r.vencimento)}
                          </span>
                        </td>

                        {/* Valor */}
                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                          {formatarMoeda(r.valor)}
                        </td>

                        {/* Status */}
                        <td className="py-3 px-3.5 text-center whitespace-nowrap">
                          {isPago ? (
                            <Badge className="bg-emerald-100 hover:bg-emerald-100 text-emerald-800 border-emerald-300 font-bold text-[10px] px-2 py-0.5 inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Pago
                            </Badge>
                          ) : (
                            <Badge className="bg-amber-100 hover:bg-amber-100 text-amber-800 border-amber-300 font-bold text-[10px] px-2 py-0.5 inline-flex items-center gap-1">
                              <Clock className="w-3 h-3 text-amber-600" />
                              Pendente
                            </Badge>
                          )}
                        </td>

                        {/* Data de Pagamento */}
                        <td className="py-3 px-3 whitespace-nowrap text-slate-700">
                          {r.data_pagamento ? (
                            <span className="flex items-center gap-1.5 font-medium text-emerald-700">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              {formatarDataBr(r.data_pagamento)}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">—</span>
                          )}
                        </td>

                        {/* Ações */}
                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {!isPago ? (
                              <Button
                                onClick={() => handleAbrirBaixa(r)}
                                size="sm"
                                className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2.5 shadow-2xs gap-1"
                                title="Dar baixa neste título"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Dar Baixa
                              </Button>
                            ) : (
                              <Button
                                onClick={() => handleAbrirDesfazer(r)}
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs text-amber-700 hover:text-amber-800 bg-amber-50/70 border-amber-200 hover:bg-amber-100 font-semibold px-2.5 gap-1"
                                title="Estornar baixa e voltar para pendente"
                              >
                                <Undo2 className="w-3.5 h-3.5" />
                                Desfazer
                              </Button>
                            )}

                            <Button
                              onClick={() => handleAbrirExcluir(r)}
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50"
                              title="Excluir parcela"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>

                {/* Rodapé com Totais */}
                <tfoot>
                  <tr className="border-t-2 border-slate-200 bg-slate-50/90 font-bold text-slate-800">
                    <td colSpan={3} className="py-3.5 px-4 text-xs uppercase tracking-wide">
                      Total ({recebiveisFiltrados.length} título
                      {recebiveisFiltrados.length !== 1 ? 's' : ''})
                    </td>
                    <td className="py-3.5 px-3 text-right text-xs font-mono text-slate-900 font-bold">
                      {formatarMoeda(totalizadores.totalPendente + totalizadores.totalPago)}
                    </td>
                    <td colSpan={3} className="py-3.5 px-3.5 text-xs text-slate-600">
                      <div className="flex items-center gap-4 justify-end text-[11px]">
                        <span>
                          Pendente:{' '}
                          <strong className="text-amber-700 font-mono">
                            {formatarMoeda(totalizadores.totalPendente)}
                          </strong>
                        </span>
                        <span>
                          Pago:{' '}
                          <strong className="text-emerald-700 font-mono">
                            {formatarMoeda(totalizadores.totalPago)}
                          </strong>
                        </span>
                      </div>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ================= MODAL: DAR BAIXA ================= */}
      <Dialog open={modalBaixaOpen} onOpenChange={setModalBaixaOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#0B1F3A] flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              Dar Baixa no Recebível
            </DialogTitle>
            <DialogDescription className="text-xs">
              Confirme a liquidação da parcela informando a data em que o pagamento foi creditado.
            </DialogDescription>
          </DialogHeader>

          {recebivelParaBaixa && (
            <div className="space-y-4 py-2">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Empresa:</span>
                  <span className="font-bold text-slate-900">
                    {recebivelParaBaixa.expand?.empresa?.nome ||
                      empresaMap.get(recebivelParaBaixa.empresa)?.nome ||
                      'Empresa'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Parcela:</span>
                  <span className="font-mono font-bold text-blue-700">
                    Nº {recebivelParaBaixa.parcela}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Vencimento Original:</span>
                  <span className="font-semibold text-slate-800">
                    {formatarDataBr(recebivelParaBaixa.vencimento)}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-slate-200 pt-1.5">
                  <span className="text-slate-700 font-bold">Valor a Liquidar:</span>
                  <span className="font-mono font-bold text-sm text-emerald-700">
                    {formatarMoeda(recebivelParaBaixa.valor)}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="data-pagamento-input"
                  className="text-xs font-semibold text-slate-700 flex items-center gap-1.5"
                >
                  <CalendarIcon className="w-3.5 h-3.5 text-blue-600" />
                  Data do Pagamento / Recebimento *
                </Label>
                <Input
                  id="data-pagamento-input"
                  type="date"
                  value={dataPagamentoInput}
                  onChange={(e) => setDataPagamentoInput(e.target.value)}
                  className="h-9 text-xs bg-white font-medium"
                />
                <p className="text-[11px] text-slate-400">
                  Padrão: data de hoje ({formatarDataBr(dataHojeIso())}).
                </p>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setModalBaixaOpen(false)}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleConfirmarBaixa}
              disabled={salvandoBaixa}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5 shadow-xs"
            >
              <CheckCircle2 className="w-4 h-4" />
              {salvandoBaixa ? 'Confirmando...' : 'Confirmar Pagamento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================= MODAL: DESFAZER BAIXA ================= */}
      <AlertDialog open={modalDesfazerOpen} onOpenChange={setModalDesfazerOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-[#0B1F3A] flex items-center gap-2">
              <Undo2 className="w-5 h-5 text-amber-600" />
              Desfazer Baixa do Recebível?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              A parcela {recebivelParaDesfazer?.parcela} no valor de{' '}
              <strong>{formatarMoeda(recebivelParaDesfazer?.valor)}</strong> voltará para o status{' '}
              <strong>"Pendente"</strong> e a data de pagamento será removida.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmarDesfazer}
              disabled={salvandoDesfazer}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs"
            >
              {salvandoDesfazer ? 'Desfazendo...' : 'Sim, Desfazer Baixa'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ================= MODAL: EXCLUIR PARCELA ================= */}
      <AlertDialog open={modalExcluirOpen} onOpenChange={setModalExcluirOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-red-600 flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-600" />
              Excluir Parcela de Recebível?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Tem certeza que deseja excluir permanentemente a parcela{' '}
              {recebivelParaExcluir?.parcela} ({formatarMoeda(recebivelParaExcluir?.valor)}) de{' '}
              <strong>
                {recebivelParaExcluir?.expand?.empresa?.nome ||
                  empresaMap.get(recebivelParaExcluir?.empresa || '')?.nome}
              </strong>
              ? Esta ação não poderá ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmarExcluir}
              disabled={salvandoExcluir}
              className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs"
            >
              {salvandoExcluir ? 'Excluindo...' : 'Sim, Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
