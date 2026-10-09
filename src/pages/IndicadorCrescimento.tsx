import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useFilter } from '@/contexts/FilterContext'
import { useToast } from '@/hooks/use-toast'
import { useRealtime } from '@/hooks/use-realtime'
import { EstadoVazioClienteCard } from '@/components/EstadoVazioClienteCard'
import { DocumentPrintFooter } from '@/components/DocumentPrintFooter'
import { ModalClassificacaoDreLote } from '@/components/ModalClassificacaoDreLote'
import { contasService, lancamentosService, planoContasService } from '@/services/financeService'
import type { ContaRecord, LancamentoRecord, PlanoContaRecord } from '@/types/finance'
import { gerarListaMeses } from '@/lib/dreGerencialTypes'
import {
  extrairCenarioBaseDre,
  calcularSimuladorCrescimento,
  type ParametrosSimulacaoCrescimento,
  type ResultadoSimuladorCrescimento,
} from '@/lib/indicadorCrescimentoCalculo'
import {
  exportarIndicadorCrescimentoExcel,
  exportarIndicadorCrescimentoCsv,
  formatarPercentualExport,
} from '@/lib/indicadorCrescimentoExport'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Slider } from '@/components/ui/slider'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  TrendingUp,
  Sliders,
  DollarSign,
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Sparkles,
  RefreshCw,
  FolderTree,
  Printer,
  Download,
  FileSpreadsheet,
  Building,
  Calendar,
  ShieldCheck,
  ShieldAlert,
  HelpCircle,
  RotateCcw,
} from 'lucide-react'

const MESES_OPCOES = [
  { valor: 1, nome: 'Janeiro' },
  { valor: 2, nome: 'Fevereiro' },
  { valor: 3, nome: 'Março' },
  { valor: 4, nome: 'Abril' },
  { valor: 5, nome: 'Maio' },
  { valor: 6, nome: 'Junho' },
  { valor: 7, nome: 'Julho' },
  { valor: 8, nome: 'Agosto' },
  { valor: 9, nome: 'Setembro' },
  { valor: 10, nome: 'Outubro' },
  { valor: 11, nome: 'Novembro' },
  { valor: 12, nome: 'Dezembro' },
]

function formatBrl(val: number | undefined | null): string {
  if (val === undefined || val === null || !Number.isFinite(val)) return 'R$ 0,00'
  return val.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export default function IndicadorCrescimento() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { user } = useAuth()
  const { selectedEmpresaId, selectedEmpresa, selectedAno, isGrupoAtivo, grupoAtivo } = useFilter()
  const isCliente = user?.role === 'cliente'

  // Estados de dados brutos
  const [loading, setLoading] = useState(true)
  const [lancamentos, setLancamentos] = useState<LancamentoRecord[]>([])
  const [contas, setContas] = useState<ContaRecord[]>([])
  const [planoContas, setPlanoContas] = useState<PlanoContaRecord[]>([])

  // Modal para classificação em lote
  const [modalClassificacaoOpen, setModalClassificacaoOpen] = useState(false)

  // Seleção de Período (Mês Único vs Faixa)
  const currentYear = selectedAno || new Date().getFullYear()
  const [ano, setAno] = useState<number>(currentYear)

  useEffect(() => {
    if (selectedAno) {
      setAno(selectedAno)
    }
  }, [selectedAno])

  const [tipoSelecaoPeriodo, setTipoSelecaoPeriodo] = useState<'mes_unico' | 'faixa'>('mes_unico')
  const [mesUnico, setMesUnico] = useState<number>(() => {
    const curMonth = new Date().getMonth() + 1
    return curMonth
  })
  const [mesInicioFaixa, setMesInicioFaixa] = useState<number>(1)
  const [mesFimFaixa, setMesFimFaixa] = useState<number>(6)

  // Validação da faixa
  const mesFimEfetivo = Math.max(mesInicioFaixa, mesFimFaixa)

  // Parâmetros de Simulação
  const [crescimentoFatPct, setCrescimentoFatPct] = useState<number>(10) // default +10%
  const [modoVariaveis, setModoVariaveis] = useState<'proporcional' | 'personalizado'>(
    'proporcional',
  )
  const [crescimentoVarPct, setCrescimentoVarPct] = useState<number>(10)
  const [modoFixas, setModoFixas] = useState<'manter' | 'personalizado'>('manter')
  const [crescimentoFixasPct, setCrescimentoFixasPct] = useState<number>(0)
  const [crescimentoFinPct, setCrescimentoFinPct] = useState<number>(0)

  // Carregar dados
  const carregarDados = async () => {
    try {
      setLoading(true)

      let lancsPromise: Promise<LancamentoRecord[]>
      let contasPromise: Promise<ContaRecord[]>
      let planosPromise: Promise<PlanoContaRecord[]>

      if (isGrupoAtivo && grupoAtivo && grupoAtivo.empresas && grupoAtivo.empresas.length > 0) {
        const empIds = new Set(grupoAtivo.empresas)
        lancsPromise = lancamentosService
          .getAll({ expandRelations: true })
          .then((list) => list.filter((l) => empIds.has(l.empresa)))
        contasPromise = contasService
          .getAll()
          .then((list) => list.filter((c) => !c.empresa || empIds.has(c.empresa)))
        planosPromise = planoContasService
          .getAll()
          .then((list) => list.filter((p) => !p.empresa || empIds.has(p.empresa)))
      } else if (selectedEmpresaId && !selectedEmpresaId.startsWith('grupo-')) {
        lancsPromise = lancamentosService.getAll({
          empresaId: selectedEmpresaId,
          expandRelations: true,
        })
        contasPromise = contasService.getAll({ empresaId: selectedEmpresaId })
        planosPromise = planoContasService.getAll({ empresaId: selectedEmpresaId })
      } else {
        lancsPromise = lancamentosService.getAll({ expandRelations: true })
        contasPromise = contasService.getAll()
        planosPromise = planoContasService.getAll()
      }

      const [contasList, lancamentosList, planosList] = await Promise.all([
        contasPromise,
        lancsPromise,
        planosPromise,
      ])

      setContas(contasList)
      setLancamentos(lancamentosList)
      setPlanoContas(planosList)
    } catch (err: any) {
      console.error('Erro ao carregar dados do Indicador de Crescimento:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar dados',
        description: 'Não foi possível carregar os lançamentos e contas.',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarDados()
  }, [selectedEmpresaId, isGrupoAtivo, grupoAtivo])

  // Realtime
  useRealtime<LancamentoRecord>('lancamentos', () => carregarDados())
  useRealtime<ContaRecord>('contas', () => carregarDados())
  useRealtime<PlanoContaRecord>('plano_contas', () => carregarDados())

  useEffect(() => {
    const handleRecarregar = () => carregarDados()
    window.addEventListener('dre-contas-atualizadas', handleRecarregar)
    window.addEventListener('dre-contas-atualizado', handleRecarregar)
    return () => {
      window.removeEventListener('dre-contas-atualizadas', handleRecarregar)
      window.removeEventListener('dre-contas-atualizado', handleRecarregar)
    }
  }, [])

  // Gerar lista de meses para a DRE
  const mesesSelecionados = useMemo(() => {
    if (tipoSelecaoPeriodo === 'mes_unico') {
      return gerarListaMeses(ano, mesUnico, 1)
    }
    const qtd = mesFimEfetivo - mesInicioFaixa + 1
    return gerarListaMeses(ano, mesInicioFaixa, Math.min(12, Math.max(1, qtd)))
  }, [ano, tipoSelecaoPeriodo, mesUnico, mesInicioFaixa, mesFimEfetivo])

  const descricaoPeriodo = useMemo(() => {
    if (tipoSelecaoPeriodo === 'mes_unico') {
      const mNome = MESES_OPCOES.find((m) => m.valor === mesUnico)?.nome
      return `${mNome} de ${ano}`
    }
    const mIniNome = MESES_OPCOES.find((m) => m.valor === mesInicioFaixa)?.nome
    const mFimNome = MESES_OPCOES.find((m) => m.valor === mesFimEfetivo)?.nome
    return `${mIniNome} a ${mFimNome} de ${ano}`
  }, [tipoSelecaoPeriodo, mesUnico, mesInicioFaixa, mesFimEfetivo, ano])

  // Extrai Cenário Base da DRE Oficial
  const cenarioBase = useMemo(() => {
    return extrairCenarioBaseDre(lancamentos, contas, mesesSelecionados, planoContas)
  }, [lancamentos, contas, mesesSelecionados, planoContas])

  // Parâmetros da Simulação
  const parametrosSimulacao = useMemo<ParametrosSimulacaoCrescimento>(() => {
    return {
      percentualCrescimentoFaturamento: crescimentoFatPct,
      modoDespesasVariaveis: modoVariaveis,
      percentualCrescimentoVariaveis:
        modoVariaveis === 'personalizado' ? crescimentoVarPct : undefined,
      modoDespesasFixas: modoFixas,
      percentualCrescimentoFixas: modoFixas === 'personalizado' ? crescimentoFixasPct : 0,
      percentualCrescimentoFinanceiras: crescimentoFinPct,
    }
  }, [
    crescimentoFatPct,
    modoVariaveis,
    crescimentoVarPct,
    modoFixas,
    crescimentoFixasPct,
    crescimentoFinPct,
  ])

  // Resultado Simulado Completo
  const resultado = useMemo<ResultadoSimuladorCrescimento>(() => {
    return calcularSimuladorCrescimento(cenarioBase, parametrosSimulacao)
  }, [cenarioBase, parametrosSimulacao])

  // Resetar Parâmetros para Padrão (+10% faturamento, variáveis proporcionais, fixas mantidas)
  const handleResetarParametros = () => {
    setCrescimentoFatPct(10)
    setModoVariaveis('proporcional')
    setCrescimentoVarPct(10)
    setModoFixas('manter')
    setCrescimentoFixasPct(0)
    setCrescimentoFinPct(0)
    toast({
      title: 'Parâmetros restaurados',
      description: 'Crescimento de +10% mantendo despesas fixas.',
    })
  }

  // Exportações
  const handleExportarExcel = () => {
    try {
      exportarIndicadorCrescimentoExcel(resultado, selectedEmpresa, descricaoPeriodo)
      toast({
        title: 'Exportação Concluída',
        description: 'Planilha Excel com a simulação gerada com sucesso.',
      })
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: 'Erro na exportação',
        description: e?.message || 'Falha ao gerar arquivo Excel.',
      })
    }
  }

  const handleExportarCsv = () => {
    try {
      exportarIndicadorCrescimentoCsv(resultado, selectedEmpresa, descricaoPeriodo)
      toast({
        title: 'Exportação Concluída',
        description: 'Arquivo CSV com delimitador brasileiro gerado com sucesso.',
      })
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: 'Erro na exportação',
        description: e?.message || 'Falha ao gerar arquivo CSV.',
      })
    }
  }

  const handleImprimir = () => {
    window.print()
  }

  const nomeContexto =
    isGrupoAtivo && grupoAtivo
      ? `Grupo ${grupoAtivo.nome}`
      : selectedEmpresa
        ? selectedEmpresa.nome
        : 'Consolidado Geral'

  return (
    <div className="space-y-4 animate-fadeIn pb-6 print:p-0 print:m-0">
      {/* Cabeçalho da tela */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-blue-100/80 text-blue-800 shadow-xs">
              <TrendingUp className="w-5 h-5 text-blue-700" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-[#0B1F3A] tracking-tight">
                  Indicador de Crescimento
                </h1>
                <Badge
                  variant="outline"
                  className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-semibold"
                >
                  Simulador DRE
                </Badge>
              </div>
              <p className="text-[11px] text-[#5B6B7F]">
                Simulação de cenários de crescimento: projete faturamento, elasticidade de despesas
                fixas e variáveis e analise o impacto direto na margem e no lucro líquido.
              </p>
            </div>
          </div>
        </div>

        {/* Botões de Ações e Exportação */}
        <div className="flex items-center gap-2 flex-wrap print:hidden">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={carregarDados}
            disabled={loading}
            className="h-8 text-xs font-semibold border-slate-200 hover:bg-slate-50 text-slate-700 gap-1.5 cursor-pointer"
            title="Recarregar dados"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setModalClassificacaoOpen(true)}
            className="h-8 text-xs font-semibold border-slate-200 hover:bg-slate-50 text-slate-700 gap-1.5 cursor-pointer"
            title="Abrir classificação DRE em lote"
          >
            <FolderTree className="w-3.5 h-3.5 text-blue-600" />
            Classificação DRE
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleImprimir}
            className="h-8 text-xs font-semibold border-slate-200 hover:bg-slate-50 text-slate-700 gap-1.5 cursor-pointer"
            title="Imprimir relatório em folha A4 / Salvar PDF"
          >
            <Printer className="w-3.5 h-3.5 text-slate-600" />
            Imprimir / PDF
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                size="sm"
                className="h-8 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-xs cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Exportar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-white">
              <DropdownMenuItem
                onClick={handleExportarExcel}
                className="text-xs cursor-pointer gap-2 py-2"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <div className="flex flex-col">
                  <span className="font-semibold text-slate-800">Planilha Excel (.xlsx)</span>
                  <span className="text-[10px] text-slate-500">Base, Parâmetros e Simulação</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleExportarCsv}
                className="text-xs cursor-pointer gap-2 py-2"
              >
                <Download className="w-4 h-4 text-blue-600" />
                <div className="flex flex-col">
                  <span className="font-semibold text-slate-800">Arquivo CSV (.csv)</span>
                  <span className="text-[10px] text-slate-500">Delimitador ';' padrão BR</span>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Barra de Filtros e Contexto Multi-tenant */}
      <Card className="bg-white border-slate-200/90 shadow-xs print:hidden">
        <CardContent className="py-3 px-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            {/* Empresa Ativa / Grupo */}
            <div className="flex items-center gap-2">
              <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <div className="text-xs">
                <span className="text-slate-500">Contexto: </span>
                <span className="font-bold text-[#0B1F3A]">{nomeContexto}</span>
                {selectedEmpresa?.segmento && (
                  <Badge variant="outline" className="ml-2 text-[10px] py-0">
                    {selectedEmpresa.segmento}
                  </Badge>
                )}
              </div>
            </div>

            {/* Seletores de Período: Mês Único ou Faixa */}
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-lg border border-slate-200">
                <button
                  type="button"
                  onClick={() => setTipoSelecaoPeriodo('mes_unico')}
                  className={`text-xs px-2.5 py-1 rounded font-medium transition-colors cursor-pointer ${
                    tipoSelecaoPeriodo === 'mes_unico'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Mês Único
                </button>
                <button
                  type="button"
                  onClick={() => setTipoSelecaoPeriodo('faixa')}
                  className={`text-xs px-2.5 py-1 rounded font-medium transition-colors cursor-pointer ${
                    tipoSelecaoPeriodo === 'faixa'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Período / Faixa
                </button>
              </div>

              {/* Seletor Ano */}
              <div className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <Select value={String(ano)} onValueChange={(val) => setAno(Number(val))}>
                  <SelectTrigger className="h-8 text-xs bg-white w-20 cursor-pointer">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[2023, 2024, 2025, 2026, 2027].map((a) => (
                      <SelectItem key={a} value={String(a)} className="text-xs">
                        {a}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {tipoSelecaoPeriodo === 'mes_unico' ? (
                /* Seleção de Mês Único */
                <Select value={String(mesUnico)} onValueChange={(val) => setMesUnico(Number(val))}>
                  <SelectTrigger className="h-8 text-xs bg-white w-32 cursor-pointer">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MESES_OPCOES.map((m) => (
                      <SelectItem key={m.valor} value={String(m.valor)} className="text-xs">
                        {m.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                /* Seleção de Faixa (De ... Até ...) */
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-500">De:</span>
                  <Select
                    value={String(mesInicioFaixa)}
                    onValueChange={(val) => setMesInicioFaixa(Number(val))}
                  >
                    <SelectTrigger className="h-8 text-xs bg-white w-28 cursor-pointer">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MESES_OPCOES.map((m) => (
                        <SelectItem key={m.valor} value={String(m.valor)} className="text-xs">
                          {m.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <span className="text-xs text-slate-500">Até:</span>
                  <Select
                    value={String(mesFimFaixa)}
                    onValueChange={(val) => setMesFimFaixa(Number(val))}
                  >
                    <SelectTrigger className="h-8 text-xs bg-white w-28 cursor-pointer">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MESES_OPCOES.filter((m) => m.valor >= mesInicioFaixa).map((m) => (
                        <SelectItem key={m.valor} value={String(m.valor)} className="text-xs">
                          {m.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Verificação de Estado Vazio */}
      {!loading && !cenarioBase.temDados ? (
        <div className="p-4">
          {isCliente ? (
            <EstadoVazioClienteCard
              empresaNome={selectedEmpresa?.nome}
              ano={ano}
              mensagem="Nenhum lançamento contábil ou DRE foi encontrado para esta empresa no período selecionado. Entre em contato com seu consultor Borlim para a conciliação do período."
            />
          ) : (
            <Card className="border-dashed border-slate-300 bg-white">
              <CardContent className="py-16 px-6 text-center max-w-md mx-auto space-y-3">
                <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
                  <TrendingUp className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-slate-800">
                  Nenhuma DRE Lançada no Período ({descricaoPeriodo})
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Para simular o crescimento de faturamento, despesas e lucro, importe ou
                  classifique os lançamentos rápidos na DRE Gerencial no período escolhido.
                </p>
                <div className="pt-2 flex items-center justify-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setModalClassificacaoOpen(true)}
                    className="text-xs font-semibold gap-1.5 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                    Classificar Contas em Lote
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => navigate('/gerencial/dre')}
                    className="text-xs font-semibold bg-[#0B1F3A] hover:bg-blue-900 text-white gap-1.5 cursor-pointer"
                  >
                    Ver DRE Gerencial
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <>
          {/* ========================================================
              CARDS DE RESUMO DO TOPO (BASE vs SIMULADO)
          ======================================================== */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Card 1: Faturamento Simulado */}
            <Card className="bg-white border-slate-200/90 shadow-xs relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-blue-600" />
              <CardContent className="p-4">
                <div className="flex items-center justify-between text-slate-500 text-xs">
                  <span className="font-medium">Faturamento Simulado</span>
                  <Badge
                    variant="outline"
                    className={`text-[10px] font-semibold ${
                      crescimentoFatPct >= 0
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border-rose-200'
                    }`}
                  >
                    {crescimentoFatPct >= 0 ? `+${crescimentoFatPct}%` : `${crescimentoFatPct}%`}
                  </Badge>
                </div>
                <div className="mt-2 text-xl sm:text-2xl font-black text-[#0B1F3A] font-mono">
                  {formatBrl(resultado.cenarioSimulado.faturamento)}
                </div>
                <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                  <span>Base: {formatBrl(resultado.cenarioBase.faturamento)}</span>
                  <span
                    className={`font-semibold ${
                      resultado.comparativo.faturamento.deltaAbsoluto >= 0
                        ? 'text-emerald-600'
                        : 'text-rose-600'
                    }`}
                  >
                    {resultado.comparativo.faturamento.deltaAbsoluto >= 0 ? '+' : ''}
                    {formatBrl(resultado.comparativo.faturamento.deltaAbsoluto)}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Card 2: Despesas Variáveis Simuladas */}
            <Card className="bg-white border-slate-200/90 shadow-xs relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-amber-500" />
              <CardContent className="p-4">
                <div className="flex items-center justify-between text-slate-500 text-xs">
                  <span className="font-medium">Despesas Variáveis</span>
                  <Badge
                    variant="outline"
                    className="text-[10px] bg-slate-50 text-slate-600 border-slate-200"
                  >
                    {modoVariaveis === 'proporcional'
                      ? 'Proporcional'
                      : `${crescimentoVarPct >= 0 ? '+' : ''}${crescimentoVarPct}%`}
                  </Badge>
                </div>
                <div className="mt-2 text-xl sm:text-2xl font-black text-slate-800 font-mono">
                  {formatBrl(resultado.cenarioSimulado.despesasVariaveis)}
                </div>
                <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                  <span>Base: {formatBrl(resultado.cenarioBase.despesasVariaveis)}</span>
                  <span className="font-mono text-slate-600">
                    {resultado.cenarioSimulado.faturamento > 0
                      ? `${(
                          (resultado.cenarioSimulado.despesasVariaveis /
                            resultado.cenarioSimulado.faturamento) *
                          100
                        ).toFixed(1)}% do Fat.`
                      : '—'}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Card 3: Despesas Fixas Simuladas */}
            <Card className="bg-white border-slate-200/90 shadow-xs relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-rose-500" />
              <CardContent className="p-4">
                <div className="flex items-center justify-between text-slate-500 text-xs">
                  <span className="font-medium">Despesas Fixas</span>
                  <Badge
                    variant="outline"
                    className="text-[10px] bg-slate-50 text-slate-600 border-slate-200"
                  >
                    {modoFixas === 'manter'
                      ? 'Mantidas (0%)'
                      : `${crescimentoFixasPct >= 0 ? '+' : ''}${crescimentoFixasPct}%`}
                  </Badge>
                </div>
                <div className="mt-2 text-xl sm:text-2xl font-black text-slate-800 font-mono">
                  {formatBrl(resultado.cenarioSimulado.despesasFixas)}
                </div>
                <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                  <span>Base: {formatBrl(resultado.cenarioBase.despesasFixas)}</span>
                  <span className="font-mono text-slate-600">
                    {resultado.cenarioSimulado.faturamento > 0
                      ? `${(
                          (resultado.cenarioSimulado.despesasFixas /
                            resultado.cenarioSimulado.faturamento) *
                          100
                        ).toFixed(1)}% do Fat.`
                      : '—'}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Card 4: DESTAQUE GRANDE PARA O LUCRO SIMULADO */}
            <Card
              className={`border shadow-sm relative overflow-hidden ${
                resultado.cenarioSimulado.lucroPrejuizo >= 0
                  ? 'bg-linear-to-br from-emerald-500/10 via-white to-emerald-50/30 border-emerald-300'
                  : 'bg-linear-to-br from-rose-500/10 via-white to-rose-50/30 border-rose-300'
              }`}
            >
              <div
                className={`absolute top-0 left-0 right-0 h-1.5 ${
                  resultado.cenarioSimulado.lucroPrejuizo >= 0 ? 'bg-emerald-600' : 'bg-rose-600'
                }`}
              />
              <CardContent className="p-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[#0B1F3A] uppercase tracking-wider text-[11px]">
                    Lucro Simulado
                  </span>
                  <Badge
                    className={`text-[10px] font-bold ${
                      resultado.cenarioSimulado.lucroPrejuizo >= 0
                        ? 'bg-emerald-600 text-white'
                        : 'bg-rose-600 text-white'
                    }`}
                  >
                    Margem:{' '}
                    {resultado.cenarioSimulado.margemLiquidaPct !== null
                      ? `${resultado.cenarioSimulado.margemLiquidaPct.toFixed(1)}%`
                      : '—'}
                  </Badge>
                </div>

                <div
                  className={`mt-2 text-2xl sm:text-3xl font-black font-mono tracking-tight ${
                    resultado.cenarioSimulado.lucroPrejuizo >= 0
                      ? 'text-emerald-700'
                      : 'text-rose-700'
                  }`}
                >
                  {formatBrl(resultado.cenarioSimulado.lucroPrejuizo)}
                </div>

                <div className="mt-1.5 flex items-center justify-between text-xs">
                  <span className="text-slate-500 text-[11px]">
                    Base: {formatBrl(resultado.cenarioBase.lucroPrejuizo)}
                  </span>
                  <div
                    className={`flex items-center gap-0.5 font-bold text-xs ${
                      resultado.comparativo.lucroPrejuizo.deltaAbsoluto >= 0
                        ? 'text-emerald-700'
                        : 'text-rose-700'
                    }`}
                  >
                    {resultado.comparativo.lucroPrejuizo.deltaAbsoluto >= 0 ? (
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    ) : (
                      <ArrowDownRight className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {resultado.comparativo.lucroPrejuizo.deltaAbsoluto >= 0 ? '+' : ''}
                      {formatBrl(resultado.comparativo.lucroPrejuizo.deltaAbsoluto)}
                    </span>
                    {resultado.comparativo.lucroPrejuizo.deltaPercentual !== null && (
                      <span className="text-[10px] font-normal ml-0.5">
                        ({resultado.comparativo.lucroPrejuizo.deltaPercentual >= 0 ? '+' : ''}
                        {resultado.comparativo.lucroPrejuizo.deltaPercentual.toFixed(1)}%)
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ========================================================
              PAINEL DE RESUMO EXECUTIVO AUTOMATIZADO
          ======================================================== */}
          <Card className="bg-linear-to-r from-[#0B1F3A] to-[#152e50] text-white border-none shadow-md">
            <CardContent className="py-4 px-5">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0 mt-0.5 text-blue-300">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase font-bold tracking-widest text-blue-300">
                      Diagnóstico Executivo da Simulação
                    </span>
                    <span className="text-[10px] text-white/50">• {descricaoPeriodo}</span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-100 font-medium leading-relaxed">
                    {resultado.resumoExecutivo}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ========================================================
              CORPO PRINCIPAL: SLIDERS DE SIMULAÇÃO (ESQ) × COMPARATIVO TABULAR (DIR)
          ======================================================== */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* PAINEL DE CONTROLES / SLIDERS (lg:col-span-5) */}
            <div className="lg:col-span-5 space-y-4 print:hidden">
              <Card className="bg-white border-slate-200/90 shadow-xs">
                <CardHeader className="py-3.5 px-4 border-b border-slate-100 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-blue-600" />
                      Parâmetros da Simulação
                    </CardTitle>
                    <CardDescription className="text-[11px] text-slate-500">
                      Mova os controles para simular o comportamento da operação
                    </CardDescription>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleResetarParametros}
                    className="h-7 text-[11px] text-slate-600 hover:text-blue-700 gap-1 px-2 cursor-pointer"
                    title="Restaurar parâmetros padrão (+10% faturamento, fixas estáveis)"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Resetar
                  </Button>
                </CardHeader>

                <CardContent className="p-4 space-y-5">
                  {/* Slider A: Crescimento do Faturamento */}
                  <div className="space-y-2 p-3 rounded-xl bg-blue-50/50 border border-blue-100">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-bold text-[#0B1F3A] flex items-center gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
                        Crescimento do Faturamento (%)
                      </Label>
                      <span
                        className={`text-xs font-mono font-black px-2 py-0.5 rounded ${
                          crescimentoFatPct >= 0
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {crescimentoFatPct >= 0
                          ? `+${crescimentoFatPct}%`
                          : `${crescimentoFatPct}%`}
                      </span>
                    </div>

                    <Slider
                      value={[crescimentoFatPct]}
                      min={-50}
                      max={100}
                      step={1}
                      onValueChange={(val) => setCrescimentoFatPct(val[0])}
                      className="py-2 cursor-pointer"
                    />

                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                      <span>-50% (Crise)</span>
                      <span>0% (Estável)</span>
                      <span>+50% (Expansão)</span>
                      <span>+100% (Dobrar)</span>
                    </div>
                  </div>

                  {/* Controle B: Despesas Variáveis */}
                  <div className="space-y-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-bold text-slate-800">
                        Comportamento das Despesas Variáveis
                      </Label>
                    </div>

                    <RadioGroup
                      value={modoVariaveis}
                      onValueChange={(val: any) => setModoVariaveis(val)}
                      className="space-y-2 text-xs"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="proporcional" id="var-prop" />
                        <Label
                          htmlFor="var-prop"
                          className="text-xs font-medium text-slate-700 cursor-pointer"
                        >
                          Acompanhar faturamento proporcionalmente (
                          {cenarioBase.percentualVariaveisSobreFat !== null
                            ? `${cenarioBase.percentualVariaveisSobreFat.toFixed(1)}%`
                            : 'mesma % atual'}
                          )
                        </Label>
                      </div>

                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="personalizado" id="var-custom" />
                        <Label
                          htmlFor="var-custom"
                          className="text-xs font-medium text-slate-700 cursor-pointer"
                        >
                          Percentual de variação próprio
                        </Label>
                      </div>
                    </RadioGroup>

                    {modoVariaveis === 'personalizado' && (
                      <div className="pt-2 pl-6 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-slate-600">
                            Variação das Variáveis:
                          </span>
                          <span className="text-xs font-mono font-bold text-slate-800">
                            {crescimentoVarPct >= 0
                              ? `+${crescimentoVarPct}%`
                              : `${crescimentoVarPct}%`}
                          </span>
                        </div>
                        <Slider
                          value={[crescimentoVarPct]}
                          min={-50}
                          max={100}
                          step={1}
                          onValueChange={(val) => setCrescimentoVarPct(val[0])}
                          className="py-1 cursor-pointer"
                        />
                      </div>
                    )}
                  </div>

                  {/* Controle C: Despesas Fixas */}
                  <div className="space-y-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-bold text-slate-800">
                        Comportamento das Despesas Fixas (Estrutura)
                      </Label>
                    </div>

                    <RadioGroup
                      value={modoFixas}
                      onValueChange={(val: any) => setModoFixas(val)}
                      className="space-y-2 text-xs"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="manter" id="fix-manter" />
                        <Label
                          htmlFor="fix-manter"
                          className="text-xs font-medium text-slate-700 cursor-pointer"
                        >
                          Manter fixas / estáveis (Default — Diluição com ganho de escala)
                        </Label>
                      </div>

                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="personalizado" id="fix-custom" />
                        <Label
                          htmlFor="fix-custom"
                          className="text-xs font-medium text-slate-700 cursor-pointer"
                        >
                          Crescimento estrutural (% informado)
                        </Label>
                      </div>
                    </RadioGroup>

                    {modoFixas === 'personalizado' && (
                      <div className="pt-2 pl-6 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-slate-600">Variação das Fixas:</span>
                          <span className="text-xs font-mono font-bold text-slate-800">
                            {crescimentoFixasPct >= 0
                              ? `+${crescimentoFixasPct}%`
                              : `${crescimentoFixasPct}%`}
                          </span>
                        </div>
                        <Slider
                          value={[crescimentoFixasPct]}
                          min={-30}
                          max={50}
                          step={1}
                          onValueChange={(val) => setCrescimentoFixasPct(val[0])}
                          className="py-1 cursor-pointer"
                        />
                        <div className="flex items-center justify-between text-[9px] text-slate-400 font-mono">
                          <span>-30% (Corte)</span>
                          <span>0%</span>
                          <span>+50% (Expansão fabril)</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Controle D: Despesas Financeiras (Opcional) */}
                  <div className="space-y-1.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold text-slate-700">
                        Variação Despesas Financeiras (Opcional)
                      </Label>
                      <span className="text-xs font-mono font-bold text-slate-800">
                        {crescimentoFinPct >= 0
                          ? `+${crescimentoFinPct}%`
                          : `${crescimentoFinPct}%`}
                      </span>
                    </div>
                    <Slider
                      value={[crescimentoFinPct]}
                      min={-50}
                      max={50}
                      step={1}
                      onValueChange={(val) => setCrescimentoFinPct(val[0])}
                      className="py-1 cursor-pointer"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* CARD DE PONTO DE EQUILÍBRIO DO CENÁRIO */}
              <Card className="bg-white border-slate-200/90 shadow-xs">
                <CardHeader className="py-3 px-4 border-b border-slate-100">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xs font-bold text-[#0B1F3A] flex items-center gap-1.5">
                      {resultado.cenarioSimulado.margemSegurancaPct !== null &&
                      resultado.cenarioSimulado.margemSegurancaPct >= 0 ? (
                        <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <ShieldAlert className="w-4 h-4 text-rose-600" />
                      )}
                      Ponto de Equilíbrio & Margem de Segurança
                    </CardTitle>
                    <Badge
                      variant="outline"
                      className={`text-[9.5px] font-semibold ${
                        resultado.cenarioSimulado.margemSegurancaPct !== null &&
                        resultado.cenarioSimulado.margemSegurancaPct >= 15
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : resultado.cenarioSimulado.margemSegurancaPct !== null &&
                              resultado.cenarioSimulado.margemSegurancaPct >= 0
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : 'bg-rose-50 text-rose-800 border-rose-200'
                      }`}
                    >
                      {resultado.cenarioSimulado.margemSegurancaPct !== null &&
                      resultado.cenarioSimulado.margemSegurancaPct >= 15
                        ? 'Margem Saudável'
                        : resultado.cenarioSimulado.margemSegurancaPct !== null &&
                            resultado.cenarioSimulado.margemSegurancaPct >= 0
                          ? 'Margem Apertada'
                          : 'Abaixo do Equilíbrio'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                      <span className="text-[10px] text-slate-500 block uppercase font-medium">
                        Ponto de Equilíbrio (R$)
                      </span>
                      <span className="text-sm font-bold text-slate-900 font-mono mt-0.5 block">
                        {resultado.cenarioSimulado.pontoEquilibrioReais !== null
                          ? formatBrl(resultado.cenarioSimulado.pontoEquilibrioReais)
                          : '—'}
                      </span>
                      <span className="text-[9.5px] text-slate-400">
                        Fat. mínimo p/ zerar lucro
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                      <span className="text-[10px] text-slate-500 block uppercase font-medium">
                        Queda Suportada (%)
                      </span>
                      <span
                        className={`text-sm font-black font-mono mt-0.5 block ${
                          resultado.cenarioSimulado.margemSegurancaPct !== null &&
                          resultado.cenarioSimulado.margemSegurancaPct >= 0
                            ? 'text-emerald-700'
                            : 'text-rose-700'
                        }`}
                      >
                        {formatarPercentualExport(resultado.cenarioSimulado.margemSegurancaPct)}
                      </span>
                      <span className="text-[9.5px] text-slate-400">
                        Margem de segurança antes do prejuízo
                      </span>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-600 leading-relaxed bg-blue-50/40 p-2.5 rounded-lg border border-blue-100/70">
                    💡 <strong>Interpretação:</strong> O faturamento simulado de{' '}
                    <strong>{formatBrl(resultado.cenarioSimulado.faturamento)}</strong> pode recuar
                    até{' '}
                    <strong>
                      {formatarPercentualExport(resultado.cenarioSimulado.margemSegurancaPct)}
                    </strong>{' '}
                    (ou{' '}
                    <strong>
                      {resultado.cenarioSimulado.margemSegurancaReais !== null
                        ? formatBrl(resultado.cenarioSimulado.margemSegurancaReais)
                        : '—'}
                    </strong>
                    ) antes que a operação entre em ponto de prejuízo contábil.
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* TABELA COMPARATIVA LADO A LADO BASE vs SIMULADO (lg:col-span-7) */}
            <div className="lg:col-span-7 space-y-4">
              <Card className="bg-white border-slate-200/90 shadow-xs overflow-hidden">
                <CardHeader className="py-3 px-4 border-b border-slate-200 bg-slate-50/50 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-blue-600" />
                      Demonstração Comparativa: Base Real vs Cenário Simulado
                    </CardTitle>
                    <CardDescription className="text-[11px] text-slate-500">
                      Período de referência: {descricaoPeriodo}
                    </CardDescription>
                  </div>
                  <Badge
                    variant="outline"
                    className="text-[10px] bg-blue-50 text-blue-800 border-blue-200"
                  >
                    DRE Gerencial
                  </Badge>
                </CardHeader>

                <CardContent className="p-0 overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-[#0B1F3A] text-white border-b border-slate-700">
                        <th className="py-2.5 px-3.5 text-left font-bold text-xs">Linhas da DRE</th>
                        <th className="py-2.5 px-3 text-right font-semibold text-xs whitespace-nowrap bg-[#0B1F3A]/90">
                          Cenário Base (R$)
                        </th>
                        <th className="py-2.5 px-3 text-right font-bold text-xs whitespace-nowrap bg-blue-900/60 text-blue-100">
                          Simulado (R$)
                        </th>
                        <th className="py-2.5 px-3 text-right font-bold text-xs whitespace-nowrap bg-[#152e50]">
                          Delta (R$)
                        </th>
                        <th className="py-2.5 px-3 text-right font-bold text-xs whitespace-nowrap bg-[#152e50]">
                          Delta (%)
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {/* 1. FATURAMENTO */}
                      <tr className="bg-emerald-50/40 hover:bg-emerald-50/70 font-semibold transition-colors">
                        <td className="py-2.5 px-3.5 text-slate-900 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-600 shrink-0" />
                          <span>Faturamento (Receita Bruta)</span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                          {formatBrl(resultado.comparativo.faturamento.base)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-900 bg-emerald-100/30">
                          {formatBrl(resultado.comparativo.faturamento.simulado)}
                        </td>
                        <td
                          className={`py-2.5 px-3 text-right font-mono font-bold ${
                            resultado.comparativo.faturamento.deltaAbsoluto >= 0
                              ? 'text-emerald-700'
                              : 'text-rose-700'
                          }`}
                        >
                          {resultado.comparativo.faturamento.deltaAbsoluto >= 0 ? '+' : ''}
                          {formatBrl(resultado.comparativo.faturamento.deltaAbsoluto)}
                        </td>
                        <td
                          className={`py-2.5 px-3 text-right font-mono font-bold ${
                            resultado.comparativo.faturamento.deltaAbsoluto >= 0
                              ? 'text-emerald-700'
                              : 'text-rose-700'
                          }`}
                        >
                          {resultado.comparativo.faturamento.deltaPercentual !== null
                            ? `${resultado.comparativo.faturamento.deltaPercentual >= 0 ? '+' : ''}${resultado.comparativo.faturamento.deltaPercentual.toFixed(1)}%`
                            : '—'}
                        </td>
                      </tr>

                      {/* 2. DESPESAS VARIÁVEIS */}
                      <tr className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 px-3.5 text-slate-800 pl-6 flex items-center gap-1.5">
                          <span className="text-amber-500 font-bold">(-)</span>
                          <span>Despesas Variáveis (Custos Operacionais)</span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                          {formatBrl(resultado.comparativo.despesasVariaveis.base)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-900 font-semibold bg-slate-50">
                          {formatBrl(resultado.comparativo.despesasVariaveis.simulado)}
                        </td>
                        <td
                          className={`py-2.5 px-3 text-right font-mono ${
                            resultado.comparativo.despesasVariaveis.deltaAbsoluto <= 0
                              ? 'text-emerald-700 font-bold'
                              : 'text-rose-700 font-semibold'
                          }`}
                        >
                          {resultado.comparativo.despesasVariaveis.deltaAbsoluto >= 0 ? '+' : ''}
                          {formatBrl(resultado.comparativo.despesasVariaveis.deltaAbsoluto)}
                        </td>
                        <td
                          className={`py-2.5 px-3 text-right font-mono ${
                            resultado.comparativo.despesasVariaveis.deltaAbsoluto <= 0
                              ? 'text-emerald-700 font-bold'
                              : 'text-rose-700 font-semibold'
                          }`}
                        >
                          {resultado.comparativo.despesasVariaveis.deltaPercentual !== null
                            ? `${resultado.comparativo.despesasVariaveis.deltaPercentual >= 0 ? '+' : ''}${resultado.comparativo.despesasVariaveis.deltaPercentual.toFixed(1)}%`
                            : '—'}
                        </td>
                      </tr>

                      {/* SUB-LINHA: MARGEM DE CONTRIBUIÇÃO */}
                      <tr className="bg-blue-50/40 text-blue-950 font-semibold text-[11px]">
                        <td className="py-2 px-3.5 pl-8 italic">(=) Margem de Contribuição</td>
                        <td className="py-2 px-3 text-right font-mono text-slate-700">
                          {formatBrl(resultado.cenarioBase.margemContribuicaoReais)}{' '}
                          <span className="text-[10px] text-slate-500 font-normal">
                            (
                            {resultado.cenarioBase.margemContribuicaoPct !== null
                              ? `${resultado.cenarioBase.margemContribuicaoPct.toFixed(1)}%`
                              : '—'}
                            )
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-blue-900 font-bold bg-blue-100/30">
                          {formatBrl(resultado.cenarioSimulado.margemContribuicaoReais)}{' '}
                          <span className="text-[10px] text-blue-700 font-normal">
                            (
                            {resultado.cenarioSimulado.margemContribuicaoPct !== null
                              ? `${resultado.cenarioSimulado.margemContribuicaoPct.toFixed(1)}%`
                              : '—'}
                            )
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-blue-800">
                          {resultado.cenarioSimulado.margemContribuicaoReais -
                            resultado.cenarioBase.margemContribuicaoReais >=
                          0
                            ? '+'
                            : ''}
                          {formatBrl(
                            resultado.cenarioSimulado.margemContribuicaoReais -
                              resultado.cenarioBase.margemContribuicaoReais,
                          )}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-blue-800">—</td>
                      </tr>

                      {/* 3. DESPESAS FIXAS */}
                      <tr className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 px-3.5 text-slate-800 pl-6 flex items-center gap-1.5">
                          <span className="text-rose-500 font-bold">(-)</span>
                          <span>Despesas Fixas (Operacionais / Estrutura)</span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                          {formatBrl(resultado.comparativo.despesasFixas.base)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-900 font-semibold bg-slate-50">
                          {formatBrl(resultado.comparativo.despesasFixas.simulado)}
                        </td>
                        <td
                          className={`py-2.5 px-3 text-right font-mono ${
                            resultado.comparativo.despesasFixas.deltaAbsoluto <= 0
                              ? 'text-emerald-700 font-bold'
                              : 'text-rose-700 font-semibold'
                          }`}
                        >
                          {resultado.comparativo.despesasFixas.deltaAbsoluto >= 0 ? '+' : ''}
                          {formatBrl(resultado.comparativo.despesasFixas.deltaAbsoluto)}
                        </td>
                        <td
                          className={`py-2.5 px-3 text-right font-mono ${
                            resultado.comparativo.despesasFixas.deltaAbsoluto <= 0
                              ? 'text-emerald-700 font-bold'
                              : 'text-rose-700 font-semibold'
                          }`}
                        >
                          {resultado.comparativo.despesasFixas.deltaPercentual !== null
                            ? `${resultado.comparativo.despesasFixas.deltaPercentual >= 0 ? '+' : ''}${resultado.comparativo.despesasFixas.deltaPercentual.toFixed(1)}%`
                            : '—'}
                        </td>
                      </tr>

                      {/* 4. DESPESAS FINANCEIRAS */}
                      <tr className="hover:bg-slate-50 transition-colors text-slate-600">
                        <td className="py-2 px-3.5 pl-6 flex items-center gap-1.5">
                          <span className="text-slate-400 font-bold">(-)</span>
                          <span>Despesas Financeiras / Outras</span>
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-slate-600">
                          {formatBrl(resultado.comparativo.despesasFinanceiras.base)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-slate-700 bg-slate-50">
                          {formatBrl(resultado.comparativo.despesasFinanceiras.simulado)}
                        </td>
                        <td
                          className={`py-2 px-3 text-right font-mono ${
                            resultado.comparativo.despesasFinanceiras.deltaAbsoluto <= 0
                              ? 'text-emerald-700'
                              : 'text-rose-700'
                          }`}
                        >
                          {resultado.comparativo.despesasFinanceiras.deltaAbsoluto >= 0 ? '+' : ''}
                          {formatBrl(resultado.comparativo.despesasFinanceiras.deltaAbsoluto)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-slate-500">
                          {resultado.comparativo.despesasFinanceiras.deltaPercentual !== null
                            ? `${resultado.comparativo.despesasFinanceiras.deltaPercentual >= 0 ? '+' : ''}${resultado.comparativo.despesasFinanceiras.deltaPercentual.toFixed(1)}%`
                            : '—'}
                        </td>
                      </tr>

                      {/* 5. TOTAL DE DESPESAS */}
                      <tr className="bg-slate-100/80 font-bold text-slate-900 border-t border-slate-200">
                        <td className="py-2.5 px-3.5 text-slate-900 uppercase text-[11px] tracking-wide">
                          TOTAL DE DESPESAS DA OPERAÇÃO
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono">
                          {formatBrl(resultado.comparativo.totalDespesas.base)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono bg-slate-200/50">
                          {formatBrl(resultado.comparativo.totalDespesas.simulado)}
                        </td>
                        <td
                          className={`py-2.5 px-3 text-right font-mono ${
                            resultado.comparativo.totalDespesas.deltaAbsoluto <= 0
                              ? 'text-emerald-700 font-black'
                              : 'text-rose-700 font-bold'
                          }`}
                        >
                          {resultado.comparativo.totalDespesas.deltaAbsoluto >= 0 ? '+' : ''}
                          {formatBrl(resultado.comparativo.totalDespesas.deltaAbsoluto)}
                        </td>
                        <td
                          className={`py-2.5 px-3 text-right font-mono ${
                            resultado.comparativo.totalDespesas.deltaAbsoluto <= 0
                              ? 'text-emerald-700 font-black'
                              : 'text-rose-700 font-bold'
                          }`}
                        >
                          {resultado.comparativo.totalDespesas.deltaPercentual !== null
                            ? `${resultado.comparativo.totalDespesas.deltaPercentual >= 0 ? '+' : ''}${resultado.comparativo.totalDespesas.deltaPercentual.toFixed(1)}%`
                            : '—'}
                        </td>
                      </tr>

                      {/* 6. LUCRO OU PREJUÍZO (LINHA DE DESTAQUE MÁXIMO) */}
                      <tr
                        className={`border-t-2 font-black text-xs ${
                          resultado.cenarioSimulado.lucroPrejuizo >= 0
                            ? 'bg-emerald-100/70 text-emerald-950 border-emerald-400'
                            : 'bg-rose-100/70 text-rose-950 border-rose-400'
                        }`}
                      >
                        <td className="py-3 px-3.5 uppercase tracking-wide flex items-center justify-between">
                          <span className="font-extrabold text-[11.5px]">
                            (=) LUCRO / PREJUÍZO LÍQUIDO
                          </span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-white/70 border border-current">
                            Resultado Final
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-800">
                          {formatBrl(resultado.comparativo.lucroPrejuizo.base)}
                        </td>
                        <td
                          className={`py-3 px-3 text-right font-mono font-black text-sm ${
                            resultado.cenarioSimulado.lucroPrejuizo >= 0
                              ? 'text-emerald-900 bg-emerald-200/60'
                              : 'text-rose-900 bg-rose-200/60'
                          }`}
                        >
                          {formatBrl(resultado.cenarioSimulado.lucroPrejuizo)}
                        </td>
                        <td
                          className={`py-3 px-3 text-right font-mono font-black ${
                            resultado.comparativo.lucroPrejuizo.deltaAbsoluto >= 0
                              ? 'text-emerald-800'
                              : 'text-rose-800'
                          }`}
                        >
                          {resultado.comparativo.lucroPrejuizo.deltaAbsoluto >= 0 ? '+' : ''}
                          {formatBrl(resultado.comparativo.lucroPrejuizo.deltaAbsoluto)}
                        </td>
                        <td
                          className={`py-3 px-3 text-right font-mono font-black ${
                            resultado.comparativo.lucroPrejuizo.deltaAbsoluto >= 0
                              ? 'text-emerald-800'
                              : 'text-rose-800'
                          }`}
                        >
                          {resultado.comparativo.lucroPrejuizo.deltaPercentual !== null
                            ? `${resultado.comparativo.lucroPrejuizo.deltaPercentual >= 0 ? '+' : ''}${resultado.comparativo.lucroPrejuizo.deltaPercentual.toFixed(1)}%`
                            : '—'}
                        </td>
                      </tr>

                      {/* 7. MARGEM LÍQUIDA (%) */}
                      <tr className="bg-slate-50 text-slate-700 font-semibold border-t border-slate-200">
                        <td className="py-2 px-3.5 pl-6 text-[11px]">Margem Líquida (%)</td>
                        <td className="py-2 px-3 text-right font-mono">
                          {formatarPercentualExport(resultado.comparativo.margemLiquidaPct.base)}
                        </td>
                        <td
                          className={`py-2 px-3 text-right font-mono font-bold ${
                            (resultado.comparativo.margemLiquidaPct.simulado || 0) >= 0
                              ? 'text-emerald-700'
                              : 'text-rose-700'
                          }`}
                        >
                          {formatarPercentualExport(
                            resultado.comparativo.margemLiquidaPct.simulado,
                          )}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-slate-400">—</td>
                        <td
                          className={`py-2 px-3 text-right font-mono font-bold ${
                            (resultado.comparativo.margemLiquidaPct.deltaPontosPercentuais || 0) >=
                            0
                              ? 'text-emerald-700'
                              : 'text-rose-700'
                          }`}
                        >
                          {resultado.comparativo.margemLiquidaPct.deltaPontosPercentuais !== null
                            ? `${resultado.comparativo.margemLiquidaPct.deltaPontosPercentuais >= 0 ? '+' : ''}${resultado.comparativo.margemLiquidaPct.deltaPontosPercentuais.toFixed(1)} p.p.`
                            : '—'}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </CardContent>
              </Card>

              {/* CARD EXPLICATIVO / CONCEITUAL */}
              <div className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-200/70 text-slate-700 text-xs space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-[#0B1F3A]">
                  <HelpCircle className="w-3.5 h-3.5 text-blue-600" />
                  <span>Dinâmica da Alavancagem Operacional</span>
                </div>
                <p className="leading-relaxed text-[11px] text-slate-600">
                  Quando o faturamento cresce e a organização mantém seus custos e despesas fixas
                  estáveis, cada real faturado acima do ponto de equilíbrio contribui diretamente
                  para a expansão acelerada do lucro líquido, proporcionando um salto proporcional
                  no resultado superior ao próprio crescimento das vendas.
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Modal de Classificação DRE em Lote */}
      <ModalClassificacaoDreLote
        open={modalClassificacaoOpen}
        onOpenChange={setModalClassificacaoOpen}
        contas={contas}
        onSuccess={() => carregarDados()}
      />

      {/* Rodapé fixo na impressão / PDF A4 */}
      <DocumentPrintFooter
        documentTitle="Indicador de Crescimento — Simulação DRE"
        empresaNome={nomeContexto}
        exercicioAno={ano}
      />
    </div>
  )
}
