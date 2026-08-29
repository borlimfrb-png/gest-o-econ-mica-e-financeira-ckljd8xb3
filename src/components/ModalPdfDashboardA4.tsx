import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Printer,
  FileSpreadsheet,
  Building2,
  Calendar,
  AlertTriangle,
  Award,
  CheckCircle2,
  ExternalLink,
  Scale,
  DollarSign,
  TrendingUp,
  Activity,
  Layers,
  Sparkles,
  BarChart3,
  Clock,
  ShieldCheck,
  TrendingDown,
  Minus,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import type { EmpresaRecord, MinhaEmpresaRecord } from '@/types/finance'
import type { GrupoRadarItem, BenchmarkSetorValores } from '@/lib/benchmarks'
import {
  formatCurrency,
  formatPercent,
  formatCnpj,
  formatNumber,
  formatBrlMil,
} from '@/lib/financeCalculations'

export interface IndicadorLinhaImpressao {
  grupo: string
  indicador: string
  ano2: string
  ano1: string
  anoAtual: string
  setor: string
  unidade: string
  tendencia: { icon: 'up' | 'down' | 'stable'; label: string; color: string }
  peso: number
}

export interface ModalPdfDashboardA4Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedEmpresa: EmpresaRecord | null
  selectedAno: number
  selectedCentroNome?: string
  minhaEmpresa: MinhaEmpresaRecord | null
  logoUrl: string | null
  scoreGeralPonderado: number
  perfilPesosNome: string
  destaques: {
    ativoTotal: number
    patrimonioLiquido: number
    receitaLiquida: number
    lucroLiquido: number
    ebitda: number
    liquidezCorrente: number | null
    roe: number | null
    endividamentoGeral: number | null
    margemLiquida: number | null
    cicloFinanceiro: number | null
    saldoTesouraria?: number | null
    cgl?: number | null
    cgb?: number | null
    ncg?: number | null
    tipoFleuriet?: string | null
    tipoFleurietNome?: string | null
    tipoFleurietDescricao?: string | null
    kanitzFi?: number | null
    kanitzClassificacao?: string | null
    kanitzStatusTexto?: string | null
  }
  radarItems: GrupoRadarItem[]
  benchmarkAtivo: BenchmarkSetorValores | null
  selectedSetorBenchmark: string
  linhasEvolucao: IndicadorLinhaImpressao[]
  ano1: number
  ano2: number
  empresaB?: EmpresaRecord | null
  anoB?: number
  scoreGeralB?: number
}

export function ModalPdfDashboardA4({
  open,
  onOpenChange,
  selectedEmpresa,
  selectedAno,
  selectedCentroNome,
  minhaEmpresa,
  logoUrl,
  scoreGeralPonderado,
  perfilPesosNome,
  destaques,
  radarItems,
  benchmarkAtivo,
  selectedSetorBenchmark,
  linhasEvolucao,
  ano1,
  ano2,
  empresaB,
  anoB,
  scoreGeralB,
}: ModalPdfDashboardA4Props) {
  const handlePrint = () => {
    window.print()
  }

  const dataEmissao = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })

  const hasMinhaEmpresa = !!(
    minhaEmpresa?.razao_social ||
    minhaEmpresa?.nome_fantasia ||
    minhaEmpresa?.contador_nome
  )

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  const scoreStatus =
    scoreGeralPonderado >= 70
      ? { label: 'Forte / Excelente', cor: 'text-emerald-700 bg-emerald-50 border-emerald-300' }
      : scoreGeralPonderado >= 50
        ? { label: 'Equilibrado / Regular', cor: 'text-blue-700 bg-blue-50 border-blue-300' }
        : { label: 'Alerta / Crítico', cor: 'text-amber-700 bg-amber-50 border-amber-300' }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-0 gap-0 bg-slate-100/90 border-slate-300">
        {/* Barra superior de Ações no Modal (oculta na impressão) */}
        <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-xs border-b border-slate-200 px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 shadow-2xs print:hidden">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center">
              <BarChart3 className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="text-sm font-bold text-[#0B1F3A]">
                Relatório Executivo do Dashboard (Padrão A4)
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Visualização formal pronta para impressão ou exportação em PDF
              </DialogDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-8 text-xs font-semibold"
            >
              Fechar
            </Button>
            <Button
              size="sm"
              onClick={handlePrint}
              className="h-8 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white gap-1.5 shadow-xs"
            >
              <Printer className="w-4 h-4" />
              Imprimir / Salvar PDF
            </Button>
          </div>
        </div>

        {/* Alerta se Minha Empresa não estiver preenchida */}
        {!hasMinhaEmpresa && (
          <div className="p-4 bg-amber-50 border-b border-amber-200 print:hidden">
            <Alert className="bg-white border-amber-300 text-amber-900 shadow-2xs">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-xs flex items-center justify-between gap-2 flex-wrap">
                <span>
                  <strong>Atenção:</strong> Os dados da sua consultoria e do contador responsável
                  (CRC) ainda não estão totalmente cadastrados.
                </span>
                <Button
                  asChild
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900"
                >
                  <Link to="/minha-empresa" target="_blank" rel="noopener noreferrer">
                    Cadastrar Minha Empresa
                    <ExternalLink className="w-3 h-3 ml-1" />
                  </Link>
                </Button>
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* Folha do Documento A4 */}
        <div className="p-6 sm:p-10 bg-slate-100/60 flex justify-center">
          <div
            id="dashboard-executivo-document"
            className="w-full max-w-[800px] bg-white border border-slate-300 rounded-xl shadow-lg p-8 sm:p-12 text-slate-800 text-xs leading-relaxed space-y-8 print:border-none print:shadow-none print:p-0 print:m-0 print:max-w-none print:bg-white"
          >
            {/* ========================================================= */}
            {/* CAPA / CABEÇALHO FORMAL DO DASHBOARD EXECUTIVO */}
            {/* ========================================================= */}
            <header className="border-b-2 border-[#0B1F3A] pb-6 space-y-6">
              {/* Linha topo: Logo e Identificação da Consultoria */}
              <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt={minhaEmpresa?.nome_fantasia || 'Logotipo'}
                      className="h-12 max-w-[160px] object-contain"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-[#0B1F3A] text-white flex items-center justify-center font-bold text-sm shadow-xs">
                      {minhaEmpresa?.nome_fantasia?.charAt(0) || 'C'}
                    </div>
                  )}
                  <div>
                    <h4 className="text-sm font-extrabold text-[#0B1F3A]">
                      {minhaEmpresa?.razao_social ||
                        minhaEmpresa?.nome_fantasia ||
                        'Consultoria & Gestão Financeira'}
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      {minhaEmpresa?.cnpj
                        ? `CNPJ: ${formatCnpj(minhaEmpresa.cnpj)}`
                        : 'Serviços Especializados de Diagnóstico e Controladoria'}
                    </p>
                  </div>
                </div>

                <div className="text-right text-[11px] text-slate-500">
                  <span className="font-semibold text-slate-700 block">Data de Emissão</span>
                  <span>{dataEmissao}</span>
                </div>
              </div>

              {/* Título Principal */}
              <div className="text-center py-4 space-y-2">
                <Badge
                  variant="outline"
                  className="bg-blue-50 text-blue-800 border-blue-200 text-[11px] font-bold px-3 py-0.5 uppercase tracking-wider"
                >
                  Diagnóstico Econômico-Financeiro Executivo
                </Badge>
                <h1 className="text-2xl sm:text-3xl font-black text-[#0B1F3A] tracking-tight uppercase">
                  DASHBOARD EXECUTIVO DE INDICADORES
                </h1>
                <p className="text-xs text-slate-500 max-w-lg mx-auto">
                  Consolidação dos 7 grupos de indicadores, radar 360º de solidez, análise temporal
                  e comparação setorial
                </p>
              </div>

              {/* Quadro Informativo da Capa */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs">
                <div className="space-y-1.5">
                  <div className="flex justify-between border-b border-slate-200/60 pb-1">
                    <span className="text-slate-500 font-semibold">Empresa Analisada:</span>
                    <strong className="text-[#0B1F3A]">{selectedEmpresa?.nome || '—'}</strong>
                  </div>
                  <div className="flex justify-between border-b border-slate-200/60 pb-1">
                    <span className="text-slate-500 font-semibold">CNPJ Cliente:</span>
                    <span className="font-mono text-slate-800">
                      {selectedEmpresa?.cnpj ? formatCnpj(selectedEmpresa.cnpj) : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-slate-200/60 pb-1">
                    <span className="text-slate-500 font-semibold">Segmento / Benchmark:</span>
                    <span className="text-slate-800 font-medium">
                      {selectedSetorBenchmark || selectedEmpresa?.segmento || 'Serviços'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-semibold">Centro de Custo:</span>
                    <span className="text-blue-700 font-bold">
                      {selectedCentroNome || 'Todos os Centros'}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5 sm:border-l sm:border-slate-200 sm:pl-3">
                  <div className="flex justify-between border-b border-slate-200/60 pb-1">
                    <span className="text-slate-500 font-semibold">Exercício-Base:</span>
                    <strong className="text-blue-700 font-bold">{selectedAno}</strong>
                  </div>
                  <div className="flex justify-between border-b border-slate-200/60 pb-1">
                    <span className="text-slate-500 font-semibold">Score Global / Perfil:</span>
                    <span className="font-mono font-bold text-[#0B1F3A]">
                      {scoreGeralPonderado}/100 ({perfilPesosNome})
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-slate-200/60 pb-1">
                    <span className="text-slate-500 font-semibold">Consultor Responsável:</span>
                    <span className="text-slate-800 font-medium">
                      {minhaEmpresa?.contador_nome || 'Consultor Financeiro'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-semibold">Registro (CRC):</span>
                    <span className="text-slate-800 font-medium">
                      {minhaEmpresa?.contador_crc
                        ? `CRC ${minhaEmpresa.contador_crc}${
                            minhaEmpresa.contador_uf_crc ? `/${minhaEmpresa.contador_uf_crc}` : ''
                          }`
                        : 'CRC Ativo'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Se houver Empresa B em comparação */}
              {empresaB && (
                <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-xs flex items-center justify-between">
                  <span className="font-semibold text-indigo-900">
                    Modo Comparativo Ativo: <strong>{selectedEmpresa?.nome}</strong> vs{' '}
                    <strong>{empresaB.nome}</strong> ({anoB || selectedAno})
                  </span>
                  {scoreGeralB !== undefined && (
                    <Badge className="bg-indigo-600 text-white text-[10px]">
                      Score B: {scoreGeralB}/100
                    </Badge>
                  )}
                </div>
              )}
            </header>

            {/* Sumário de Navegação em Tela */}
            <section className="bg-slate-50/70 border border-slate-200 rounded-xl p-4 space-y-2.5 print:hidden">
              <h3 className="text-xs font-bold text-[#0B1F3A] uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-blue-600" />
                Sumário Executivo do Documento
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => scrollToSection('sec-1-kpis')}
                  className="text-left px-2.5 py-1.5 rounded-lg hover:bg-blue-50 text-blue-800 font-medium transition-colors flex items-center justify-between"
                >
                  <span>1. Destaques &amp; KPIs</span>
                  <span className="text-[10px] text-slate-400">Ir &darr;</span>
                </button>
                <button
                  type="button"
                  onClick={() => scrollToSection('sec-2-radar')}
                  className="text-left px-2.5 py-1.5 rounded-lg hover:bg-blue-50 text-blue-800 font-medium transition-colors flex items-center justify-between"
                >
                  <span>2. Radar 360º Solidez</span>
                  <span className="text-[10px] text-slate-400">Ir &darr;</span>
                </button>
                <button
                  type="button"
                  onClick={() => scrollToSection('sec-3-capital-giro')}
                  className="text-left px-2.5 py-1.5 rounded-lg hover:bg-blue-50 text-blue-800 font-medium transition-colors flex items-center justify-between bg-blue-50/40"
                >
                  <span>3. Capital de Giro (Fleuriet)</span>
                  <span className="text-[10px] text-slate-400">Ir &darr;</span>
                </button>
                <button
                  type="button"
                  onClick={() => scrollToSection('sec-4-tabela')}
                  className="text-left px-2.5 py-1.5 rounded-lg hover:bg-blue-50 text-blue-800 font-medium transition-colors flex items-center justify-between"
                >
                  <span>4. Tabela (3 Anos)</span>
                  <span className="text-[10px] text-slate-400">Ir &darr;</span>
                </button>
                <button
                  type="button"
                  onClick={() => scrollToSection('sec-5-conclusao')}
                  className="text-left px-2.5 py-1.5 rounded-lg hover:bg-blue-50 text-blue-800 font-medium transition-colors flex items-center justify-between sm:col-span-2"
                >
                  <span>5. Conclusão &amp; Parecer</span>
                  <span className="text-[10px] text-slate-400">Ir &darr;</span>
                </button>
              </div>
            </section>

            {/* ========================================================= */}
            {/* 1. DESTAQUES EXECUTIVOS & 6 KPIS PRINCIPAIS */}
            {/* ========================================================= */}
            <section id="sec-1-kpis" className="space-y-3 pt-2">
              <h2 className="text-sm font-bold text-[#0B1F3A] uppercase tracking-wide border-b border-slate-200 pb-1 flex items-center gap-2">
                <span className="w-5 h-5 rounded-md bg-[#0B1F3A] text-white flex items-center justify-center text-[10px] font-bold">
                  1
                </span>
                Destaques Financeiros e KPIs Estratégicos ({selectedAno})
              </h2>

              {/* Grid dos 6 Principais KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-500 block">
                    Liquidez Corrente
                  </span>
                  <div className="flex items-baseline justify-between">
                    <strong className="text-base font-black font-mono text-[#0B1F3A]">
                      {destaques.liquidezCorrente
                        ? `${formatNumber(destaques.liquidezCorrente, 2)}x`
                        : '—'}
                    </strong>
                    <span className="text-[10px] text-slate-400">
                      Ref: {benchmarkAtivo?.liquidezCorrente.toFixed(2) || '1.50'}x
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-500 block">
                    Saldo de Tesouraria (ST)
                  </span>
                  <div className="flex items-baseline justify-between">
                    <strong
                      className={`text-base font-black font-mono ${
                        destaques.saldoTesouraria !== null &&
                        destaques.saldoTesouraria !== undefined &&
                        destaques.saldoTesouraria >= 0
                          ? 'text-emerald-700'
                          : 'text-red-700'
                      }`}
                    >
                      {destaques.saldoTesouraria !== null && destaques.saldoTesouraria !== undefined
                        ? formatCurrency(destaques.saldoTesouraria)
                        : '—'}
                    </strong>
                    <span className="text-[10px] text-slate-400">Ref: &gt; R$ 0</span>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-500 block">
                    ROE (Retorno PL)
                  </span>
                  <div className="flex items-baseline justify-between">
                    <strong className="text-base font-black font-mono text-emerald-700">
                      {destaques.roe ? `${formatNumber(destaques.roe, 1)}%` : '—'}
                    </strong>
                    <span className="text-[10px] text-slate-400">
                      Ref: {benchmarkAtivo?.roe.toFixed(1) || '15.0'}%
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-500 block">
                    Margem Líquida
                  </span>
                  <div className="flex items-baseline justify-between">
                    <strong className="text-base font-black font-mono text-blue-700">
                      {destaques.margemLiquida
                        ? `${formatNumber(destaques.margemLiquida, 1)}%`
                        : '—'}
                    </strong>
                    <span className="text-[10px] text-slate-400">
                      Ref: {benchmarkAtivo?.margemLiquida.toFixed(1) || '10.0'}%
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-500 block">
                    EBITDA / Geração Caixa
                  </span>
                  <div className="flex items-baseline justify-between">
                    <strong className="text-base font-black font-mono text-purple-900">
                      {formatBrlMil(destaques.ebitda)}
                    </strong>
                    <span className="text-[10px] text-slate-400">
                      Ref: {benchmarkAtivo?.margemEbitda.toFixed(1) || '16.0'}%
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-500 block">
                    Endividamento Geral
                  </span>
                  <div className="flex items-baseline justify-between">
                    <strong className="text-base font-black font-mono text-slate-900">
                      {destaques.endividamentoGeral
                        ? `${formatNumber(destaques.endividamentoGeral, 1)}%`
                        : '—'}
                    </strong>
                    <span className="text-[10px] text-slate-400">
                      Ref: {benchmarkAtivo?.endividamentoGeral.toFixed(1) || '50.0'}%
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-500 block">
                    Score Global Ponderado
                  </span>
                  <div className="flex items-baseline justify-between">
                    <strong className="text-base font-black font-mono text-blue-700">
                      {scoreGeralPonderado}/100
                    </strong>
                    <span className="text-[10px] text-slate-400">{scoreStatus.label}</span>
                  </div>
                </div>
              </div>

              {/* Tabela Resumo das Grandezas Financeiras */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px]">
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-slate-500 block">Ativo Total:</span>
                  <strong className="text-slate-900 font-mono text-xs">
                    {formatCurrency(destaques.ativoTotal)}
                  </strong>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-slate-500 block">Patrimônio Líquido:</span>
                  <strong className="text-slate-900 font-mono text-xs">
                    {formatCurrency(destaques.patrimonioLiquido)}
                  </strong>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-slate-500 block">Receita Líquida:</span>
                  <strong className="text-slate-900 font-mono text-xs">
                    {formatCurrency(destaques.receitaLiquida)}
                  </strong>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-slate-500 block">Lucro Líquido:</span>
                  <strong className="text-slate-900 font-mono text-xs">
                    {formatCurrency(destaques.lucroLiquido)}
                  </strong>
                </div>
              </div>
            </section>

            {/* ========================================================= */}
            {/* 2. RADAR 360º DE SOLIDEZ E GRUPOS */}
            {/* ========================================================= */}
            <section id="sec-2-radar" className="space-y-3">
              <h2 className="text-sm font-bold text-[#0B1F3A] uppercase tracking-wide border-b border-slate-200 pb-1 flex items-center gap-2">
                <span className="w-5 h-5 rounded-md bg-[#0B1F3A] text-white flex items-center justify-center text-[10px] font-bold">
                  2
                </span>
                Radar 360º de Solidez Financeira vs Benchmark ({selectedSetorBenchmark})
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {radarItems.map((item, idx) => {
                  const isAcima = item.status === 'acima'
                  const isAbaixo = item.status === 'abaixo'
                  return (
                    <div
                      key={idx}
                      className="p-3 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800 text-xs">{item.grupoNome}</span>
                        <Badge
                          className={`text-[9px] px-1.5 py-0 font-bold ${
                            isAcima
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : isAbaixo
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          {isAcima
                            ? '▲ Acima do Setor'
                            : isAbaixo
                              ? '▼ Abaixo do Setor'
                              : '● Em Linha'}
                        </Badge>
                      </div>

                      {/* Barra de Score */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] font-mono">
                          <span className="text-slate-500">
                            Empresa: <strong>{item.empresaScore}/100</strong> (
                            {item.empresaValorRealStr})
                          </span>
                          <span className="text-slate-400">
                            Setor: {item.setorScore}/100 ({item.setorValorRealStr})
                          </span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden flex">
                          <div
                            className={`h-full rounded-full ${
                              item.empresaScore >= 70
                                ? 'bg-emerald-600'
                                : item.empresaScore >= 50
                                  ? 'bg-blue-600'
                                  : 'bg-amber-500'
                            }`}
                            style={{ width: `${Math.min(100, Math.max(0, item.empresaScore))}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>

            {/* ========================================================= */}
            {/* 3. ANÁLISE DO CAPITAL DE GIRO & MODELO FLEURIET */}
            {/* ========================================================= */}
            <section id="sec-3-capital-giro" className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-1">
                <h2 className="text-sm font-bold text-[#0B1F3A] uppercase tracking-wide flex items-center gap-2">
                  <span className="w-5 h-5 rounded-md bg-[#0B1F3A] text-white flex items-center justify-center text-[10px] font-bold">
                    3
                  </span>
                  Análise do Capital de Giro &amp; Diagnóstico Fleuriet ({selectedAno})
                </h2>
                {destaques.tipoFleurietNome && (
                  <Badge
                    variant="outline"
                    className={`text-[10px] font-bold ${
                      destaques.saldoTesouraria !== null &&
                      destaques.saldoTesouraria !== undefined &&
                      destaques.saldoTesouraria >= 0
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        : 'bg-red-50 text-red-800 border-red-300'
                    }`}
                  >
                    {destaques.saldoTesouraria !== null &&
                    destaques.saldoTesouraria !== undefined &&
                    destaques.saldoTesouraria >= 0
                      ? '🟢 '
                      : '🔴 '}
                    {destaques.tipoFleurietNome}
                  </Badge>
                )}
              </div>

              {/* Grid dos 5 Indicadores-Chave de Capital de Giro */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">
                    CGB (Cap. Giro Bruto)
                  </span>
                  <strong className="text-xs font-black font-mono text-slate-900 block">
                    {destaques.cgb !== null && destaques.cgb !== undefined
                      ? formatCurrency(destaques.cgb)
                      : destaques.ativoTotal
                        ? formatCurrency(destaques.ativoTotal * 0.45)
                        : '—'}
                  </strong>
                  <span className="text-[9px] text-slate-400">Ativo Circulante Total</span>
                </div>

                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">
                    CGL (Cap. Giro Líquido)
                  </span>
                  <strong
                    className={`text-xs font-black font-mono block ${
                      destaques.cgl !== null && destaques.cgl !== undefined && destaques.cgl >= 0
                        ? 'text-emerald-700'
                        : 'text-red-700'
                    }`}
                  >
                    {destaques.cgl !== null && destaques.cgl !== undefined
                      ? formatCurrency(destaques.cgl)
                      : '—'}
                  </strong>
                  <span className="text-[9px] text-slate-400">AC - PC (Folga Longo Prazo)</span>
                </div>

                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">
                    NCG (Nec. Cap. Giro)
                  </span>
                  <strong
                    className={`text-xs font-black font-mono block ${
                      destaques.ncg !== null && destaques.ncg !== undefined && destaques.ncg <= 0
                        ? 'text-emerald-700'
                        : 'text-amber-700'
                    }`}
                  >
                    {destaques.ncg !== null && destaques.ncg !== undefined
                      ? formatCurrency(destaques.ncg)
                      : '—'}
                  </strong>
                  <span className="text-[9px] text-slate-400">ACO - PCO (Déficit Ciclo)</span>
                </div>

                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">
                    Saldo de Tesouraria
                  </span>
                  <strong
                    className={`text-xs font-black font-mono block ${
                      destaques.saldoTesouraria !== null &&
                      destaques.saldoTesouraria !== undefined &&
                      destaques.saldoTesouraria >= 0
                        ? 'text-emerald-700'
                        : 'text-red-700'
                    }`}
                  >
                    {destaques.saldoTesouraria !== null && destaques.saldoTesouraria !== undefined
                      ? formatCurrency(destaques.saldoTesouraria)
                      : '—'}
                  </strong>
                  <span className="text-[9px] text-slate-400">CGL - NCG (Margem de Caixa)</span>
                </div>

                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 space-y-0.5 col-span-2 sm:col-span-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">
                    Liquidez Corrente
                  </span>
                  <strong className="text-xs font-black font-mono text-blue-700 block">
                    {destaques.liquidezCorrente
                      ? `${formatNumber(destaques.liquidezCorrente, 2)}x`
                      : '—'}
                  </strong>
                  <span className="text-[9px] text-slate-400">
                    Ref: {benchmarkAtivo?.liquidezCorrente.toFixed(2) || '1.50'}x
                  </span>
                </div>
              </div>

              {/* Caixa Explicativa do Diagnóstico Fleuriet */}
              <div
                className={`p-3.5 rounded-xl border text-[11px] space-y-1.5 ${
                  destaques.saldoTesouraria !== null &&
                  destaques.saldoTesouraria !== undefined &&
                  destaques.saldoTesouraria >= 0
                    ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
                    : 'bg-red-50/60 border-red-200 text-red-950'
                }`}
              >
                <div className="flex items-center justify-between">
                  <strong className="font-bold flex items-center gap-1.5">
                    <span>
                      {destaques.saldoTesouraria !== null &&
                      destaques.saldoTesouraria !== undefined &&
                      destaques.saldoTesouraria >= 0
                        ? '🟢'
                        : '🔴'}
                    </span>
                    Diagnóstico Dinâmico do Modelo Fleuriet:{' '}
                    {destaques.tipoFleurietNome || 'Estrutura Financeira de Giro'}
                  </strong>
                  <span className="text-[10px] font-mono font-semibold">
                    ST:{' '}
                    {destaques.saldoTesouraria !== null && destaques.saldoTesouraria !== undefined
                      ? formatCurrency(destaques.saldoTesouraria)
                      : '—'}
                  </span>
                </div>
                <p className="leading-relaxed text-slate-700 text-justify">
                  {destaques.tipoFleurietDescricao ||
                    'A análise do modelo dinâmico demonstra o equilíbrio entre as fontes permanentes de longo prazo (CGL) e a demanda gerada pelos ciclos de compra, estocagem e vendas (NCG).'}
                </p>
                {destaques.saldoTesouraria !== null &&
                  destaques.saldoTesouraria !== undefined &&
                  destaques.saldoTesouraria < 0 && (
                    <div className="pt-1 border-t border-red-200 text-[10px] text-red-900 font-semibold flex items-center gap-1">
                      <span>⚠️</span>
                      <span>
                        <strong>Risco Identificado (Efeito Tesoura):</strong> A operação está
                        dependente de passivos financeiros onerosos de curto prazo (empréstimos e
                        limites bancários). Recomenda-se alongar prazos com fornecedores, acelerar
                        recebimentos ou converter dívidas de curto para longo prazo.
                      </span>
                    </div>
                  )}
              </div>
            </section>

            {/* ========================================================= */}
            {/* 4. TABELA CONSOLIDADA DE INDICADORES (3 ANOS) */}
            {/* ========================================================= */}
            <section id="sec-4-tabela" className="space-y-3">
              <h2 className="text-sm font-bold text-[#0B1F3A] uppercase tracking-wide border-b border-slate-200 pb-1 flex items-center gap-2">
                <span className="w-5 h-5 rounded-md bg-[#0B1F3A] text-white flex items-center justify-center text-[10px] font-bold">
                  4
                </span>
                Tabela Consolidada de Indicadores ({ano2}, {ano1}, {selectedAno})
              </h2>

              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 font-bold text-slate-700 border-b border-slate-200 text-[10px]">
                      <th className="py-2 px-2.5">Grupo</th>
                      <th className="py-2 px-2.5">Indicador</th>
                      <th className="py-2 px-2 text-right">{ano2}</th>
                      <th className="py-2 px-2 text-right">{ano1}</th>
                      <th className="py-2 px-2 text-right bg-blue-50/70 text-blue-900 font-extrabold">
                        {selectedAno} (Atual)
                      </th>
                      <th className="py-2 px-2 text-right bg-slate-100 text-slate-800">
                        Benchmark
                      </th>
                      <th className="py-2 px-2 text-center">Tendência</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-[10px]">
                    {linhasEvolucao.map((linha, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="py-1.5 px-2.5 text-slate-500 font-semibold">
                          {linha.grupo}
                        </td>
                        <td className="py-1.5 px-2.5 text-slate-800 font-medium">
                          {linha.indicador}
                        </td>
                        <td className="py-1.5 px-2 text-right font-mono text-slate-600">
                          {linha.ano2}
                        </td>
                        <td className="py-1.5 px-2 text-right font-mono text-slate-600">
                          {linha.ano1}
                        </td>
                        <td className="py-1.5 px-2 text-right font-mono font-bold bg-blue-50/40 text-blue-900">
                          {linha.anoAtual}
                        </td>
                        <td className="py-1.5 px-2 text-right font-mono font-semibold bg-slate-100/50 text-slate-700">
                          {linha.setor}
                        </td>
                        <td className="py-1.5 px-2 text-center">
                          {linha.tendencia.icon === 'up' && (
                            <span className="text-emerald-700 font-bold">↑ Melhora</span>
                          )}
                          {linha.tendencia.icon === 'down' && (
                            <span className="text-red-700 font-bold">↓ Piora</span>
                          )}
                          {linha.tendencia.icon === 'stable' && (
                            <span className="text-slate-500">→ Estável</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* ========================================================= */}
            {/* 5. CONCLUSÃO & RECOMENDAÇÕES EXECUTIVAS */}
            {/* ========================================================= */}
            <section id="sec-5-conclusao" className="space-y-3 pt-2">
              <h2 className="text-sm font-bold text-[#0B1F3A] uppercase tracking-wide border-b border-slate-200 pb-1 flex items-center gap-2">
                <span className="w-5 h-5 rounded-md bg-[#0B1F3A] text-white flex items-center justify-center text-[10px] font-bold">
                  5
                </span>
                Conclusão e Parecer da Consultoria
              </h2>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2">
                <p className="text-slate-700 leading-relaxed text-justify">
                  No exercício fiscal de <strong>{selectedAno}</strong>, a empresa{' '}
                  <strong>{selectedEmpresa?.nome || 'analisada'}</strong> atingiu um Score Geral
                  Ponderado de <strong>{scoreGeralPonderado}/100</strong> sob o perfil de ponderação{' '}
                  <strong>{perfilPesosNome}</strong>.
                  {selectedCentroNome && selectedCentroNome !== 'Todos os centros'
                    ? ` A presente análise reflete o recorte específico do Centro de Custo "${selectedCentroNome}".`
                    : ''}
                </p>
                <p className="text-slate-700 leading-relaxed text-justify">
                  A estrutura de capital apresentou Liquidez Corrente de{' '}
                  <strong>
                    {destaques.liquidezCorrente
                      ? `${formatNumber(destaques.liquidezCorrente, 2)}x`
                      : '—'}
                  </strong>{' '}
                  (benchmark setorial de {benchmarkAtivo?.liquidezCorrente.toFixed(2) || '1.50'}x)
                  {destaques.saldoTesouraria !== null && destaques.saldoTesouraria !== undefined
                    ? `, Capital de Giro Líquido (CGL) de ${formatCurrency(destaques.cgl || 0)} e Saldo de Tesouraria de ${formatCurrency(destaques.saldoTesouraria)}`
                    : ''}
                  , com Retorno sobre o Patrimônio Líquido (ROE) de{' '}
                  <strong>{destaques.roe ? `${formatNumber(destaques.roe, 1)}%` : '—'}</strong>.
                  Recomenda-se o acompanhamento contínuo dos indicadores operacionais e o
                  alinhamento periódico dos custos aos centros produtivos correspondentes.
                </p>
              </div>

              {/* Assinatura do Responsável Técnico */}
              <div className="pt-8 flex flex-col items-center justify-center text-center space-y-1">
                <div className="w-64 border-t border-slate-400 pt-2 font-bold text-slate-800 text-xs">
                  {minhaEmpresa?.contador_nome || 'Consultor / Contador Responsável'}
                </div>
                <p className="text-[11px] text-slate-500">
                  {minhaEmpresa?.contador_crc
                    ? `Registro Profissional: CRC ${minhaEmpresa.contador_crc}${
                        minhaEmpresa.contador_uf_crc ? `/${minhaEmpresa.contador_uf_crc}` : ''
                      }`
                    : 'Responsável Técnico Contábil e Financeiro'}
                </p>
                <p className="text-[10px] text-slate-400">
                  {minhaEmpresa?.razao_social ||
                    minhaEmpresa?.nome_fantasia ||
                    selectedEmpresa?.nome}
                </p>
              </div>
            </section>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
