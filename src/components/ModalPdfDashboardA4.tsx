import React, { useMemo } from 'react'
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
  Flame,
  AlertCircle,
  Info,
  Download,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { Link } from 'react-router-dom'
import type { EmpresaRecord, MinhaEmpresaRecord, BalancoRecord, DreRecord } from '@/types/finance'
import type { GrupoRadarItem, BenchmarkSetorValores } from '@/lib/benchmarks'
import {
  formatCurrency,
  formatPercent,
  formatCnpj,
  formatNumber,
  formatBrlMil,
  calcularKanitz,
  gerarComparativoMensalAno,
  type KanitzResultado,
  type MesComparativoData,
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
    kanitzResultado?: KanitzResultado | null
  }
  balancoAtual?: BalancoRecord | null
  dreAtual?: DreRecord | null
  balancosAno?: BalancoRecord[]
  dresAno?: DreRecord[]
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
  balancoAtual,
  dreAtual,
  balancosAno,
  dresAno,
}: ModalPdfDashboardA4Props) {
  const { toast } = useToast()
  // Apuração do KanitzResultado se não vier pronto nos destaques
  const kanitzCalculado: KanitzResultado = useMemo(() => {
    if (destaques.kanitzResultado) return destaques.kanitzResultado
    return calcularKanitz(balancoAtual || null, dreAtual || null)
  }, [destaques.kanitzResultado, balancoAtual, dreAtual])

  // Comparativo Mensal (Janeiro a Dezembro) para o PDF Executivo
  const dadosMensais = useMemo(() => {
    const bList = balancosAno || (balancoAtual ? [balancoAtual] : [])
    const dList = dresAno || (dreAtual ? [dreAtual] : [])
    return gerarComparativoMensalAno(bList, dList, selectedAno)
  }, [balancosAno, dresAno, balancoAtual, dreAtual, selectedAno])

  const totalReceitaMensalAno = dadosMensais.reduce((acc, m) => acc + m.receitaBruta, 0)
  const totalLucroMensalAno = dadosMensais.reduce((acc, m) => acc + m.lucroLiquido, 0)
  const mesesComLancamento = dadosMensais.filter((m) => m.temDados).length
  const mesesFechados = dadosMensais.filter((m) => m.fechado).length
  const handlePrint = () => {
    window.print()
  }

  const handleExportCSV = () => {
    if (!selectedEmpresa) {
      toast({
        variant: 'destructive',
        title: 'Empresa não selecionada',
        description: 'É necessário ter uma empresa selecionada para exportar o relatório em CSV.',
      })
      return
    }

    let csv = '\uFEFF' // UTF-8 BOM
    csv += `RELATÓRIO EXECUTIVO DE INDICADORES ECONÔMICO-FINANCEIROS\n`
    csv += `Empresa;${selectedEmpresa.nome}\n`
    csv += `CNPJ;${selectedEmpresa.cnpj ? formatCnpj(selectedEmpresa.cnpj) : '—'}\n`
    csv += `Exercício Base;${selectedAno}\n`
    csv += `Data de Emissão;${dataEmissao}\n\n`

    // Seção 1: KPIs
    csv += `--- KPIS E DESTAQUES FINANCEIROS (${selectedAno}) ---\n`
    csv += `Indicador;Valor\n`
    csv += `Score Global;${scoreGeralPonderado}/100 (${scoreStatus.label})\n`
    csv += `Liquidez Corrente;${destaques.liquidezCorrente ? destaques.liquidezCorrente.toFixed(2) : '—'}\n`
    csv += `Saldo de Tesouraria (R$);${destaques.saldoTesouraria || 0}\n`
    csv += `ROE (%);${destaques.roe ? destaques.roe.toFixed(2) : '—'}\n`
    csv += `Margem Líquida (%);${destaques.margemLiquida ? destaques.margemLiquida.toFixed(2) : '—'}\n`
    csv += `EBITDA (R$ mil);${destaques.ebitda || 0}\n`
    csv += `Endividamento Geral (%);${destaques.endividamentoGeral ? destaques.endividamentoGeral.toFixed(2) : '—'}\n\n`

    // Seção 2: Comparativo Mensal Jan-Dez
    csv += `--- COMPARATIVO MENSAL (JANEIRO A DEZEMBRO - ${selectedAno}) ---\n`
    csv += `Mês;Status;Receita Bruta (R$);CMV (R$);Despesas Operacionais (R$);Lucro Líquido (R$);Margem Líquida (%);Ativo Total (R$);Patrimônio Líquido (R$)\n`
    dadosMensais.forEach((m) => {
      csv += `${m.mesNum} - ${m.mesNome};`
      csv += `${!m.temDados ? 'Sem Lançamento' : m.fechado ? 'Fechado' : 'Aberto'};`
      csv += `${m.temDre ? m.receitaBruta.toFixed(2).replace('.', ',') : '0,00'};`
      csv += `${m.temDre ? m.custoMercadorias.toFixed(2).replace('.', ',') : '0,00'};`
      csv += `${m.temDre ? m.despesasOperacionais.toFixed(2).replace('.', ',') : '0,00'};`
      csv += `${m.temDre ? m.lucroLiquido.toFixed(2).replace('.', ',') : '0,00'};`
      csv += `${m.margemLiquida !== null ? m.margemLiquida.toFixed(2).replace('.', ',') + '%' : '—'};`
      csv += `${m.temBalanco ? m.ativoTotal.toFixed(2).replace('.', ',') : '0,00'};`
      csv += `${m.temBalanco ? m.patrimonioLiquido.toFixed(2).replace('.', ',') : '0,00'}\n`
    })
    csv += `TOTAL ACUMULADO;${mesesFechados} fechados / ${mesesComLancamento} cadastrados;`
    csv += `${totalReceitaMensalAno.toFixed(2).replace('.', ',')};`
    csv += `${dadosMensais
      .reduce((a, m) => a + m.custoMercadorias, 0)
      .toFixed(2)
      .replace('.', ',')};`
    csv += `${dadosMensais
      .reduce((a, m) => a + m.despesasOperacionais, 0)
      .toFixed(2)
      .replace('.', ',')};`
    csv += `${totalLucroMensalAno.toFixed(2).replace('.', ',')};`
    csv += `${totalReceitaMensalAno > 0 ? ((totalLucroMensalAno / totalReceitaMensalAno) * 100).toFixed(2).replace('.', ',') + '%' : '—'};`
    csv += `—;—\n\n`

    // Download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute(
      'download',
      `Relatorio_Executivo_${selectedEmpresa.nome.replace(/\s+/g, '_')}_${selectedAno}.csv`,
    )
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    toast({
      title: 'CSV Exportado com Sucesso',
      description: 'O relatório executivo com comparativo mensal foi baixado.',
    })
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
              onClick={handleExportCSV}
              className="h-8 text-xs font-semibold gap-1 text-slate-700 hover:bg-slate-100"
              title="Exportar dados do relatório e comparativo mensal em CSV"
            >
              <Download className="w-3.5 h-3.5" />
              Exportar CSV
            </Button>
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
                  onClick={() => scrollToSection('sec-4-kanitz')}
                  className="text-left px-2.5 py-1.5 rounded-lg hover:bg-blue-50 text-indigo-900 font-medium transition-colors flex items-center justify-between bg-indigo-50/40"
                >
                  <span>4. Solvência (Kanitz)</span>
                  <span className="text-[10px] text-slate-400">Ir &darr;</span>
                </button>
                <button
                  type="button"
                  onClick={() => scrollToSection('sec-5-comparativo-mensal')}
                  className="text-left px-2.5 py-1.5 rounded-lg hover:bg-blue-50 text-blue-800 font-medium transition-colors flex items-center justify-between bg-emerald-50/40"
                >
                  <span>5. Comparativo Mensal (Jan-Dez)</span>
                  <span className="text-[10px] text-slate-400">Ir &darr;</span>
                </button>
                <button
                  type="button"
                  onClick={() => scrollToSection('sec-6-tabela')}
                  className="text-left px-2.5 py-1.5 rounded-lg hover:bg-blue-50 text-blue-800 font-medium transition-colors flex items-center justify-between"
                >
                  <span>6. Tabela (3 Anos)</span>
                  <span className="text-[10px] text-slate-400">Ir &darr;</span>
                </button>
                <button
                  type="button"
                  onClick={() => scrollToSection('sec-7-conclusao')}
                  className="text-left px-2.5 py-1.5 rounded-lg hover:bg-blue-50 text-blue-800 font-medium transition-colors flex items-center justify-between sm:col-span-1"
                >
                  <span>7. Conclusão &amp; Parecer</span>
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
            {/* 4. KANITZ (TERMÔMETRO DE INSOLVÊNCIA & ANÁLISE PREDITIVA) */}
            {/* ========================================================= */}
            <section id="sec-4-kanitz" className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-1">
                <h2 className="text-sm font-bold text-[#0B1F3A] uppercase tracking-wide flex items-center gap-2">
                  <span className="w-5 h-5 rounded-md bg-[#0B1F3A] text-white flex items-center justify-center text-[10px] font-bold">
                    4
                  </span>
                  Kanitz (Termômetro de Insolvência) ({selectedAno})
                </h2>
                <Badge
                  variant="outline"
                  className={`text-[10px] font-bold ${
                    kanitzCalculado.classificacao === 'solvente'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      : kanitzCalculado.classificacao === 'penumbra'
                        ? 'bg-amber-50 text-amber-800 border-amber-300'
                        : kanitzCalculado.classificacao === 'insolvente'
                          ? 'bg-rose-50 text-rose-800 border-rose-300'
                          : 'bg-slate-100 text-slate-700 border-slate-300'
                  }`}
                >
                  {kanitzCalculado.classificacao === 'solvente' && '🟢 '}
                  {kanitzCalculado.classificacao === 'penumbra' && '🟠 '}
                  {kanitzCalculado.classificacao === 'insolvente' && '🔴 '}
                  {kanitzCalculado.statusTexto}
                </Badge>
              </div>

              {/* Card Resumo do Fator de Insolvência e Diagnóstico */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 bg-indigo-50/60 border border-indigo-200 rounded-xl space-y-1">
                  <span className="text-[10px] font-bold text-indigo-900 uppercase block">
                    Fator de Insolvência (FI)
                  </span>
                  <div className="flex items-baseline justify-between">
                    <strong className="text-2xl font-black font-mono text-indigo-950">
                      {kanitzCalculado.fi !== null ? kanitzCalculado.fi.toFixed(2) : 'N/D'}
                    </strong>
                    <span className="text-[10px] text-indigo-700 font-semibold">
                      Ref: FI &ge; 0,00 (Solvente)
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 sm:col-span-2 flex flex-col justify-center">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">
                    Parecer de Risco de Insolvência
                  </span>
                  <p className="text-[11px] text-slate-700 leading-snug">
                    {kanitzCalculado.diagnosticoResumido} {kanitzCalculado.descricaoClassificacao}
                  </p>
                </div>
              </div>

              {/* Tabela das 5 Variáveis X1 a X5 */}
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 font-bold text-slate-700 border-b border-slate-200 text-[10px]">
                      <th className="py-2 px-2.5">Variável</th>
                      <th className="py-2 px-2.5">Conceito / Nome</th>
                      <th className="py-2 px-2">Fórmula Contábil</th>
                      <th className="py-2 px-2 text-center">Coeficiente</th>
                      <th className="py-2 px-2 text-right">Valor Extraído</th>
                      <th className="py-2 px-2 text-right bg-indigo-50/50 text-indigo-950 font-bold">
                        Contribuição no FI
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-[10px]">
                    {kanitzCalculado.variaveis.map((v) => {
                      const isPositive = v.contribuicao !== null && v.contribuicao >= 0
                      return (
                        <tr key={v.id} className="hover:bg-slate-50/50">
                          <td className="py-1.5 px-2.5 font-mono font-bold text-indigo-700">
                            {v.sigla}
                          </td>
                          <td className="py-1.5 px-2.5 font-medium text-slate-800">{v.nome}</td>
                          <td className="py-1.5 px-2 font-mono text-slate-500 text-[9px]">
                            {v.formula}
                          </td>
                          <td className="py-1.5 px-2 text-center font-mono font-semibold text-slate-700">
                            {v.coeficiente > 0 ? `+${v.coeficiente}` : v.coeficiente}
                          </td>
                          <td className="py-1.5 px-2 text-right font-mono font-medium text-slate-800">
                            {v.descricaoValor}
                          </td>
                          <td className="py-1.5 px-2 text-right font-mono font-bold bg-indigo-50/30">
                            <span className={isPositive ? 'text-emerald-700' : 'text-rose-700'}>
                              {v.contribuicao !== null
                                ? v.contribuicao > 0
                                  ? `+${v.contribuicao.toFixed(3)}`
                                  : v.contribuicao.toFixed(3)
                                : 'N/D'}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            {/* ========================================================= */}
            {/* 5. COMPARATIVO MENSAL (JANEIRO A DEZEMBRO) */}
            {/* ========================================================= */}
            <section id="sec-5-comparativo-mensal" className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-1 flex-wrap gap-2">
                <h2 className="text-sm font-bold text-[#0B1F3A] uppercase tracking-wide flex items-center gap-2">
                  <span className="w-5 h-5 rounded-md bg-[#0B1F3A] text-white flex items-center justify-center text-[10px] font-bold">
                    5
                  </span>
                  Comparativo Mensal de Desempenho — Janeiro a Dezembro ({selectedAno})
                </h2>
                <Badge
                  variant="outline"
                  className="text-[10px] bg-blue-50 text-blue-800 border-blue-200 font-semibold"
                >
                  {mesesComLancamento}/12 Meses Cadastrados · {mesesFechados} Fechados
                </Badge>
              </div>

              {/* Tabela de Evolução Mês a Mês com Destaques e Totais */}
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 font-bold text-slate-700 border-b border-slate-200 text-[10px]">
                      <th className="py-2 px-2.5">Mês</th>
                      <th className="py-2 px-2 text-center">Status</th>
                      <th className="py-2 px-2 text-right text-blue-900">Receita Bruta</th>
                      <th className="py-2 px-2 text-right">Custos (CMV)</th>
                      <th className="py-2 px-2 text-right">Desp. Oper.</th>
                      <th className="py-2 px-2 text-right text-emerald-900 font-bold">
                        Lucro Líquido
                      </th>
                      <th className="py-2 px-2 text-right">Margem Líq.</th>
                      <th className="py-2 px-2 text-right">Ativo Total</th>
                      <th className="py-2 px-2 text-right">Patrimônio Líq.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-[10px]">
                    {dadosMensais.map((m) => {
                      const temDados = m.temDados
                      return (
                        <tr
                          key={m.mesNum}
                          className={
                            temDados
                              ? 'hover:bg-slate-50/50'
                              : 'bg-slate-50/30 text-slate-400 italic'
                          }
                        >
                          <td className="py-1.5 px-2.5 font-semibold text-slate-800">
                            {m.mesNum} - {m.mesNome}
                          </td>
                          <td className="py-1.5 px-2 text-center">
                            {!temDados ? (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-400 font-medium">
                                Sem lançamento
                              </span>
                            ) : m.fechado ? (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
                                🔒 Fechado
                              </span>
                            ) : (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-medium">
                                Aberto
                              </span>
                            )}
                          </td>
                          <td className="py-1.5 px-2 text-right font-mono font-medium text-slate-900">
                            {temDados && m.temDre ? formatBrlMil(m.receitaBruta) : '—'}
                          </td>
                          <td className="py-1.5 px-2 text-right font-mono text-slate-600">
                            {temDados && m.temDre ? formatBrlMil(m.custoMercadorias) : '—'}
                          </td>
                          <td className="py-1.5 px-2 text-right font-mono text-slate-600">
                            {temDados && m.temDre ? formatBrlMil(m.despesasOperacionais) : '—'}
                          </td>
                          <td className="py-1.5 px-2 text-right font-mono font-bold">
                            {temDados && m.temDre ? (
                              <span
                                className={
                                  m.lucroLiquido >= 0 ? 'text-emerald-700' : 'text-red-600'
                                }
                              >
                                {formatBrlMil(m.lucroLiquido)}
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="py-1.5 px-2 text-right font-mono">
                            {temDados && m.margemLiquida !== null
                              ? `${formatNumber(m.margemLiquida, 1)}%`
                              : '—'}
                          </td>
                          <td className="py-1.5 px-2 text-right font-mono text-slate-700">
                            {temDados && m.temBalanco ? formatBrlMil(m.ativoTotal) : '—'}
                          </td>
                          <td className="py-1.5 px-2 text-right font-mono text-slate-700">
                            {temDados && m.temBalanco ? formatBrlMil(m.patrimonioLiquido) : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 font-extrabold text-slate-900 border-t-2 border-slate-300 text-[10px]">
                      <td className="py-2 px-2.5" colSpan={2}>
                        TOTAL ACUMULADO ({selectedAno})
                      </td>
                      <td className="py-2 px-2 text-right text-blue-900">
                        {formatBrlMil(totalReceitaMensalAno)}
                      </td>
                      <td className="py-2 px-2 text-right">
                        {formatBrlMil(dadosMensais.reduce((acc, m) => acc + m.custoMercadorias, 0))}
                      </td>
                      <td className="py-2 px-2 text-right">
                        {formatBrlMil(
                          dadosMensais.reduce((acc, m) => acc + m.despesasOperacionais, 0),
                        )}
                      </td>
                      <td
                        className={`py-2 px-2 text-right ${
                          totalLucroMensalAno >= 0 ? 'text-emerald-800' : 'text-red-700'
                        }`}
                      >
                        {formatBrlMil(totalLucroMensalAno)}
                      </td>
                      <td className="py-2 px-2 text-right">
                        {totalReceitaMensalAno > 0
                          ? `${formatNumber((totalLucroMensalAno / totalReceitaMensalAno) * 100, 1)}%`
                          : '—'}
                      </td>
                      <td className="py-2 px-2 text-right" colSpan={2}>
                        <span className="text-slate-500 font-normal">
                          {mesesFechados} de {mesesComLancamento} fechados
                        </span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>

            {/* ========================================================= */}
            {/* 6. TABELA CONSOLIDADA DE INDICADORES (3 ANOS) */}
            {/* ========================================================= */}
            <section id="sec-6-tabela" className="space-y-3">
              <h2 className="text-sm font-bold text-[#0B1F3A] uppercase tracking-wide border-b border-slate-200 pb-1 flex items-center gap-2">
                <span className="w-5 h-5 rounded-md bg-[#0B1F3A] text-white flex items-center justify-center text-[10px] font-bold">
                  6
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
            {/* 7. CONCLUSÃO & RECOMENDAÇÕES EXECUTIVAS */}
            {/* ========================================================= */}
            <section id="sec-7-conclusao" className="space-y-3 pt-2">
              <h2 className="text-sm font-bold text-[#0B1F3A] uppercase tracking-wide border-b border-slate-200 pb-1 flex items-center gap-2">
                <span className="w-5 h-5 rounded-md bg-[#0B1F3A] text-white flex items-center justify-center text-[10px] font-bold">
                  7
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
