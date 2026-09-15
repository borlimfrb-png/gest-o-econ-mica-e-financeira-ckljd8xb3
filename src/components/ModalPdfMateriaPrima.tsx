import React, { useMemo, useRef } from 'react'
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
  Download,
  AlertTriangle,
  ExternalLink,
  Layers,
  FileText,
  Boxes,
  Percent,
  Coins,
  ShieldAlert,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { DocumentPrintFooter } from '@/components/DocumentPrintFooter'
import type {
  MateriaPrimaRecord,
  MinhaEmpresaRecord,
  EmpresaRecord,
  ConfiguracaoTributariaRecord,
} from '@/types/finance'
import { formatCnpj, formatNumber, formatCurrency, formatPercent } from '@/lib/financeCalculations'
import { calcularTributosMateriaPrima } from '@/lib/taxCalculations'

export function formatBrl(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return '—'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val)
}

export function formatPct(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return '0,00%'
  return (
    val.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + '%'
  )
}

export interface ModalPdfMateriaPrimaProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  materias: MateriaPrimaRecord[]
  selectedEmpresa: EmpresaRecord | null
  minhaEmpresa: MinhaEmpresaRecord | null
  logoUrl: string | null
  configTributaria?: ConfiguracaoTributariaRecord | null
  filtroCategoria?: string
  filtroTributacao?: string
}

export function ModalPdfMateriaPrima({
  open,
  onOpenChange,
  materias,
  selectedEmpresa,
  minhaEmpresa,
  logoUrl,
  configTributaria,
  filtroCategoria,
  filtroTributacao,
}: ModalPdfMateriaPrimaProps) {
  const documentRef = useRef<HTMLDivElement>(null)

  const dataEmissao = useMemo(() => {
    return new Date().toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })
  }, [])

  const hasMinhaEmpresa = Boolean(
    minhaEmpresa?.razao_social || minhaEmpresa?.nome_fantasia || minhaEmpresa?.contador_nome,
  )

  // Itens calculados com a fórmula padrão
  const itensDetalhados = useMemo(() => {
    return materias.map((m) => {
      const custoBruto = Number(m.custo_unitario) || 0
      const isIsenta = Boolean(
        m.isenta_st ||
        m.tipo_tributacao === 'isenta' ||
        m.tipo_tributacao === 'substituicao_tributaria',
      )
      const icms = isIsenta ? 0 : Number(m.icms_percentual) || 0
      const pis = isIsenta ? 0 : Number(m.pis_percentual) || 0
      const cofins = isIsenta ? 0 : Number(m.cofins_percentual) || 0
      const ipi = Number(m.ipi_percentual) || 0
      const frete = Number(m.frete_percentual) || 0
      const perdas = Number(m.perdas_percentual) || 0

      const trib = calcularTributosMateriaPrima(
        custoBruto,
        icms,
        pis,
        cofins,
        isIsenta,
        m.tipo_tributacao,
        ipi,
        frete,
        perdas,
      )

      const estoqueAtual = Number(m.estoque_atual) || 0
      const estoqueMinimo = Number(m.estoque_minimo) || 0
      const valorTotalBruto = estoqueAtual * custoBruto
      const valorTotalCreditos = estoqueAtual * trib.totalCreditos
      const valorTotalAcrescimos = estoqueAtual * trib.totalAcrescimos
      const valorTotalLiquido = estoqueAtual * trib.custoLiquido

      return {
        id: m.id,
        codigo: m.codigo || '—',
        nome: m.nome,
        categoria: m.categoria || 'Geral',
        unidade: m.unidade || 'UN',
        isIsenta,
        tipoTributacao: m.tipo_tributacao || 'tributada',
        custoBruto,
        // Alíquotas e Valores de Créditos
        icmsPct: icms,
        pisPct: pis,
        cofinsPct: cofins,
        creditoIcms: trib.creditoIcms,
        creditoPis: trib.creditoPis,
        creditoCofins: trib.creditoCofins,
        totalCreditos: trib.totalCreditos,
        // Alíquotas e Valores de Acréscimos
        ipiPct: ipi,
        fretePct: frete,
        perdasPct: perdas,
        valorIpi: trib.valorIpi,
        valorFrete: trib.valorFrete,
        valorPerdas: trib.valorPerdas,
        totalAcrescimos: trib.totalAcrescimos,
        // Custo Líquido
        custoLiquido: trib.custoLiquido,
        // Estoque
        estoqueAtual,
        estoqueMinimo,
        valorTotalBruto,
        valorTotalCreditos,
        valorTotalAcrescimos,
        valorTotalLiquido,
      }
    })
  }, [materias])

  // Consolidação de Totais para o Relatório e Rodapé
  const totaisConsolidados = useMemo(() => {
    let somaBrutoUnit = 0
    let somaCreditosUnit = 0
    let somaAcrescimosUnit = 0
    let somaLiquidoUnit = 0

    let somaEstoqueQtd = 0
    let somaEstoqueBruto = 0
    let somaEstoqueCreditos = 0
    let somaEstoqueAcrescimos = 0
    let somaEstoqueLiquido = 0

    let totalItensTributados = 0
    let totalItensIsentos = 0

    for (const it of itensDetalhados) {
      somaBrutoUnit += it.custoBruto
      somaCreditosUnit += it.totalCreditos
      somaAcrescimosUnit += it.totalAcrescimos
      somaLiquidoUnit += it.custoLiquido

      somaEstoqueQtd += it.estoqueAtual
      somaEstoqueBruto += it.valorTotalBruto
      somaEstoqueCreditos += it.valorTotalCreditos
      somaEstoqueAcrescimos += it.valorTotalAcrescimos
      somaEstoqueLiquido += it.valorTotalLiquido

      if (it.isIsenta) {
        totalItensIsentos++
      } else {
        totalItensTributados++
      }
    }

    return {
      totalItens: itensDetalhados.length,
      totalItensTributados,
      totalItensIsentos,
      somaBrutoUnit,
      somaCreditosUnit,
      somaAcrescimosUnit,
      somaLiquidoUnit,
      somaEstoqueQtd,
      somaEstoqueBruto,
      somaEstoqueCreditos,
      somaEstoqueAcrescimos,
      somaEstoqueLiquido,
    }
  }, [itensDetalhados])

  // Resumo agrupado por Categoria
  const porCategoria = useMemo(() => {
    const mapa = new Map<
      string,
      {
        count: number
        custoBrutoTotal: number
        custoLiquidoTotal: number
        valorEstoqueLiquido: number
      }
    >()

    for (const it of itensDetalhados) {
      const cat = it.categoria || 'Geral'
      const cur = mapa.get(cat) || {
        count: 0,
        custoBrutoTotal: 0,
        custoLiquidoTotal: 0,
        valorEstoqueLiquido: 0,
      }
      cur.count++
      cur.custoBrutoTotal += it.custoBruto
      cur.custoLiquidoTotal += it.custoLiquido
      cur.valorEstoqueLiquido += it.valorTotalLiquido
      mapa.set(cat, cur)
    }

    return Array.from(mapa.entries())
      .map(([cat, val]) => ({
        categoria: cat,
        count: val.count,
        custoBrutoTotal: val.custoBrutoTotal,
        custoLiquidoTotal: val.custoLiquidoTotal,
        valorEstoqueLiquido: val.valorEstoqueLiquido,
        pctEstoque:
          totaisConsolidados.somaEstoqueLiquido > 0
            ? (val.valorEstoqueLiquido / totaisConsolidados.somaEstoqueLiquido) * 100
            : 0,
      }))
      .sort((a, b) => b.valorEstoqueLiquido - a.valorEstoqueLiquido)
  }, [itensDetalhados, totaisConsolidados.somaEstoqueLiquido])

  // Função para acionar impressão nativa do navegador (gera PDF com layout A4)
  const handlePrint = () => {
    window.print()
  }

  // Exportar os dados consolidados para CSV estruturado
  const handleExportCSV = () => {
    const escapeCsv = (val: any): string => {
      if (val === null || val === undefined) return ''
      const s = String(val)
      if (/[;"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
      return s
    }

    const fmtNum = (n?: number) =>
      n !== undefined && n !== null
        ? n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : ''

    const linhas: string[] = [
      ['RELATÓRIO DE CUSTOS POR MATÉRIA-PRIMA (CONSOLIDAÇÃO DE TRIBUTOS E ESTOQUE)']
        .map(escapeCsv)
        .join(';'),
      ['Empresa:', selectedEmpresa?.nome || minhaEmpresa?.razao_social || 'Minha Empresa']
        .map(escapeCsv)
        .join(';'),
      ['Data de Emissão:', new Date().toLocaleDateString('pt-BR')].map(escapeCsv).join(';'),
      ['Total de Itens:', String(totaisConsolidados.totalItens)].map(escapeCsv).join(';'),
      '',
      [
        'Código',
        'Insumo',
        'Categoria',
        'Unidade',
        'Custo Bruto (R$)',
        'ICMS (%)',
        'PIS (%)',
        'COFINS (%)',
        'Total Créditos (R$)',
        'IPI (%)',
        'Frete (%)',
        'Perdas (%)',
        'Total Acréscimos (R$)',
        'Custo Líquido Unit. (R$)',
        'Estoque Atual',
        'Valor Total Líquido (R$)',
        'Situação Tributária',
      ]
        .map(escapeCsv)
        .join(';'),
    ]

    for (const it of itensDetalhados) {
      linhas.push(
        [
          it.codigo,
          it.nome,
          it.categoria,
          it.unidade,
          fmtNum(it.custoBruto),
          it.icmsPct.toFixed(2) + '%',
          it.pisPct.toFixed(2) + '%',
          it.cofinsPct.toFixed(2) + '%',
          fmtNum(it.totalCreditos),
          it.ipiPct.toFixed(2) + '%',
          it.fretePct.toFixed(2) + '%',
          it.perdasPct.toFixed(2) + '%',
          fmtNum(it.totalAcrescimos),
          fmtNum(it.custoLiquido),
          fmtNum(it.estoqueAtual),
          fmtNum(it.valorTotalLiquido),
          it.isIsenta ? 'Isenta / ST' : 'Tributada (Recuperável)',
        ]
          .map(escapeCsv)
          .join(';'),
      )
    }

    linhas.push('')
    linhas.push(
      [
        'TOTAIS CONSOLIDADOS',
        '',
        '',
        '',
        fmtNum(totaisConsolidados.somaBrutoUnit),
        '',
        '',
        '',
        fmtNum(totaisConsolidados.somaCreditosUnit),
        '',
        '',
        '',
        fmtNum(totaisConsolidados.somaAcrescimosUnit),
        fmtNum(totaisConsolidados.somaLiquidoUnit),
        fmtNum(totaisConsolidados.somaEstoqueQtd),
        fmtNum(totaisConsolidados.somaEstoqueLiquido),
        '',
      ]
        .map(escapeCsv)
        .join(';'),
    )

    const csvContent = '\uFEFF' + linhas.join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.setAttribute(
      'download',
      `relatorio-custos-materia-prima-${new Date().toISOString().slice(0, 10)}.csv`,
    )
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[94vh] overflow-y-auto p-0 gap-0 bg-slate-100/90 border-slate-300">
        {/* Barra superior de Ações no Modal (oculta na impressão) */}
        <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-xs border-b border-slate-200 px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 shadow-2xs print:hidden">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#0B1F3A] text-white flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="text-sm font-bold text-[#0B1F3A]">
                Relatório de Custos por Matéria-Prima (A4)
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Consolidação detalhada de custos brutos, deduções de créditos, acréscimos
                operacionais e valorização de estoque.
              </DialogDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              className="h-8 text-xs font-semibold gap-1 text-slate-700 hover:bg-slate-100"
              title="Exportar dados do relatório em CSV"
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
                  <strong>Dica:</strong> Personalize os dados da sua consultoria (logotipo, CNPJ,
                  responsável técnico e CRC) no módulo &quot;Minha Empresa&quot; para constarem no
                  cabeçalho e rodapé do PDF.
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
        <div className="p-6 sm:p-10 bg-slate-100/60 flex justify-center print:p-0 print:bg-white">
          <div
            ref={documentRef}
            id="relatorio-materia-prima-document"
            className="w-full max-w-[900px] bg-white border border-slate-300 rounded-xl shadow-lg p-8 sm:p-12 text-slate-800 text-xs leading-relaxed space-y-6 print:border-none print:shadow-none print:p-0 print:m-0 print:max-w-none print:bg-white"
          >
            {/* ========================================================= */}
            {/* CABEÇALHO FORMAL DO RELATÓRIO A4 */}
            {/* ========================================================= */}
            <header className="border-b-2 border-[#0B1F3A] pb-5 space-y-4">
              {/* Linha 1: Logo e Identificação da Consultoria */}
              <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3">
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
                        'Consultoria & Controladoria Financeira'}
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      {minhaEmpresa?.cnpj
                        ? `CNPJ: ${formatCnpj(minhaEmpresa.cnpj)}`
                        : 'Engenharia de Custos e Precificação Estratégica'}
                    </p>
                  </div>
                </div>

                <div className="text-right text-[11px] text-slate-500">
                  <span className="font-semibold text-slate-700 block">Data de Emissão</span>
                  <span>{dataEmissao}</span>
                </div>
              </div>

              {/* Título Principal */}
              <div className="text-center py-2 space-y-1">
                <Badge
                  variant="outline"
                  className="bg-blue-50 text-blue-800 border-blue-200 text-[10px] font-bold px-2.5 py-0.5 uppercase tracking-wider"
                >
                  Formação de Preço de Venda &amp; Gestão de Insumos
                </Badge>
                <h1 className="text-xl sm:text-2xl font-black text-[#0B1F3A] tracking-tight uppercase">
                  RELATÓRIO DE CUSTOS POR MATÉRIA-PRIMA
                </h1>
                <p className="text-[11px] text-slate-500 max-w-xl mx-auto">
                  Demonstração consolidada de custos brutos, deduções tributárias recuperáveis
                  (ICMS, PIS, COFINS), acréscimos operacionais (IPI, Frete, Perdas) e apuração do
                  custo líquido de reposição.
                </p>
              </div>

              {/* Quadro Informativo da Empresa e Escopo */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs">
                <div>
                  <span className="text-slate-500 block font-medium">Empresa Avaliada:</span>
                  <strong className="text-[#0B1F3A] font-bold text-sm block">
                    {selectedEmpresa?.nome || minhaEmpresa?.razao_social || 'Empresa Geral'}
                  </strong>
                  {selectedEmpresa?.cnpj && (
                    <span className="text-[10px] text-slate-500">
                      CNPJ: {formatCnpj(selectedEmpresa.cnpj)}
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-slate-500 block font-medium">
                    Regime Tributário / Carga:
                  </span>
                  <strong className="text-slate-800 font-bold block">
                    {configTributaria?.regime_tributario || 'Regime Padrão'}
                  </strong>
                  <span className="text-[10px] text-slate-500">
                    Carga Impostos Venda: {formatPct(configTributaria?.carga_tributaria_total || 0)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block font-medium">
                    Total de Insumos Listados:
                  </span>
                  <strong className="text-blue-900 font-bold text-sm block">
                    {totaisConsolidados.totalItens} matéria(s)-prima(s)
                  </strong>
                  <span className="text-[10px] text-slate-500">
                    {totaisConsolidados.totalItensTributados} tributadas |{' '}
                    {totaisConsolidados.totalItensIsentos} isentas/ST
                  </span>
                </div>
              </div>
            </header>

            {/* ========================================================= */}
            {/* 1. CARDS DE RESUMO EXECUTIVO CONSOLIDADO */}
            {/* ========================================================= */}
            <section className="space-y-3">
              <h2 className="text-xs font-bold text-[#0B1F3A] uppercase tracking-wide border-b border-slate-200 pb-1 flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-[#0B1F3A] text-white flex items-center justify-center text-[10px] font-bold">
                  1
                </span>
                Resumo Consolidado de Custos e Valorização do Estoque
              </h2>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500 flex items-center gap-1">
                    <Coins className="w-3.5 h-3.5 text-slate-600" />
                    Custo Bruto Unit. Médio
                  </span>
                  <strong className="text-base font-extrabold font-mono text-slate-900 block">
                    {formatBrl(
                      totaisConsolidados.totalItens > 0
                        ? totaisConsolidados.somaBrutoUnit / totaisConsolidados.totalItens
                        : 0,
                    )}
                  </strong>
                  <p className="text-[10px] text-slate-400">
                    Soma unitários: {formatBrl(totaisConsolidados.somaBrutoUnit)}
                  </p>
                </div>

                <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-800 flex items-center gap-1">
                    <Percent className="w-3.5 h-3.5 text-emerald-700" />
                    Créditos Tributários (-)
                  </span>
                  <strong className="text-base font-extrabold font-mono text-emerald-800 block">
                    -{formatBrl(totaisConsolidados.somaCreditosUnit)}
                  </strong>
                  <p className="text-[10px] text-emerald-700">ICMS, PIS e COFINS deduzidos</p>
                </div>

                <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-amber-800 flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5 text-amber-700" />
                    Acréscimos Insumos (+)
                  </span>
                  <strong className="text-base font-extrabold font-mono text-amber-900 block">
                    +{formatBrl(totaisConsolidados.somaAcrescimosUnit)}
                  </strong>
                  <p className="text-[10px] text-amber-800">IPI, Frete e Perdas somados</p>
                </div>

                <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-xl space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-blue-900 flex items-center gap-1">
                    <Boxes className="w-3.5 h-3.5 text-blue-800" />
                    Estoque Total Líquido
                  </span>
                  <strong className="text-base font-extrabold font-mono text-blue-950 block">
                    {formatBrl(totaisConsolidados.somaEstoqueLiquido)}
                  </strong>
                  <p className="text-[10px] text-blue-800">
                    Qtd Total: {formatNumber(totaisConsolidados.somaEstoqueQtd, 2)}
                  </p>
                </div>
              </div>

              {/* Banner da Fórmula Aplicada */}
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-700">
                <span>
                  <strong>Fórmula de Apuração do Custo Líquido:</strong> Custo Unitário Bruto −
                  (ICMS + PIS + COFINS) + (IPI + Frete + Perdas)
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  Base 100% sobre o Custo Unitário Bruto
                </span>
              </div>
            </section>

            {/* ========================================================= */}
            {/* 2. TABELA COMPLETA DE MATÉRIAS-PRIMAS */}
            {/* ========================================================= */}
            <section className="space-y-3 pt-2">
              <h2 className="text-xs font-bold text-[#0B1F3A] uppercase tracking-wide border-b border-slate-200 pb-1 flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-[#0B1F3A] text-white flex items-center justify-center text-[10px] font-bold">
                  2
                </span>
                Demonstração Detalhada por Insumo
              </h2>

              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-700 font-semibold text-[11px]">
                      <th className="py-2.5 px-2">Código</th>
                      <th className="py-2.5 px-2.5">Matéria-Prima</th>
                      <th className="py-2.5 px-1.5 text-center">Un</th>
                      <th className="py-2.5 px-2 text-right">Custo Bruto</th>
                      <th className="py-2.5 px-2 text-right text-emerald-700">Créditos (-)</th>
                      <th className="py-2.5 px-2 text-right text-amber-700">Acréscimos (+)</th>
                      <th className="py-2.5 px-2.5 text-right font-bold text-blue-900">
                        Custo Líq. Unit.
                      </th>
                      <th className="py-2.5 px-2 text-right">Estoque</th>
                      <th className="py-2.5 px-2.5 text-right font-bold text-slate-900">
                        Total Líquido
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-[11px]">
                    {itensDetalhados.map((it, idx) => {
                      const totalPctCred = it.icmsPct + it.pisPct + it.cofinsPct
                      const totalPctAcresc = it.ipiPct + it.fretePct + it.perdasPct

                      return (
                        <tr key={it.id || idx} className="hover:bg-slate-50/60">
                          <td className="py-2 px-2 font-mono text-[10px] text-slate-500 whitespace-nowrap">
                            {it.codigo}
                          </td>
                          <td className="py-2 px-2.5 font-medium text-slate-900">
                            <div>{it.nome}</div>
                            <div className="text-[9px] text-slate-400 font-normal flex items-center gap-1">
                              <span>{it.categoria}</span>
                              {it.isIsenta && (
                                <span className="text-amber-700 font-semibold">• Isenta/ST</span>
                              )}
                            </div>
                          </td>
                          <td className="py-2 px-1.5 text-center uppercase text-slate-500 font-semibold text-[10px]">
                            {it.unidade}
                          </td>
                          <td className="py-2 px-2 text-right font-mono text-slate-700 whitespace-nowrap">
                            {formatBrl(it.custoBruto)}
                          </td>
                          <td className="py-2 px-2 text-right font-mono whitespace-nowrap">
                            {it.totalCreditos > 0 ? (
                              <div>
                                <span className="text-emerald-700 font-medium">
                                  -{formatBrl(it.totalCreditos)}
                                </span>
                                <span className="text-[9px] text-emerald-600 block">
                                  {totalPctCred.toFixed(1)}%
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-400">R$ 0,00</span>
                            )}
                          </td>
                          <td className="py-2 px-2 text-right font-mono whitespace-nowrap">
                            {it.totalAcrescimos > 0 ? (
                              <div>
                                <span className="text-amber-800 font-medium">
                                  +{formatBrl(it.totalAcrescimos)}
                                </span>
                                <span className="text-[9px] text-amber-700 block">
                                  +{totalPctAcresc.toFixed(1)}%
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-400">R$ 0,00</span>
                            )}
                          </td>
                          <td className="py-2 px-2.5 text-right font-bold font-mono text-blue-900 whitespace-nowrap bg-blue-50/30">
                            {formatBrl(it.custoLiquido)}
                          </td>
                          <td className="py-2 px-2 text-right font-mono text-slate-700 whitespace-nowrap">
                            {formatNumber(it.estoqueAtual, 2)}
                          </td>
                          <td className="py-2 px-2.5 text-right font-bold font-mono text-slate-900 whitespace-nowrap">
                            {formatBrl(it.valorTotalLiquido)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-300 bg-slate-50/90 font-bold text-slate-900 text-xs">
                      <td
                        colSpan={3}
                        className="py-2.5 px-2.5 uppercase tracking-wide text-[10px] text-slate-700"
                      >
                        Totais Consolidados ({totaisConsolidados.totalItens} itens):
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono text-slate-800">
                        {formatBrl(totaisConsolidados.somaBrutoUnit)}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono text-emerald-700">
                        -{formatBrl(totaisConsolidados.somaCreditosUnit)}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono text-amber-800">
                        +{formatBrl(totaisConsolidados.somaAcrescimosUnit)}
                      </td>
                      <td className="py-2.5 px-2.5 text-right font-mono text-blue-950 font-black bg-blue-50/50">
                        {formatBrl(totaisConsolidados.somaLiquidoUnit)}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono text-slate-800">
                        {formatNumber(totaisConsolidados.somaEstoqueQtd, 2)}
                      </td>
                      <td className="py-2.5 px-2.5 text-right font-mono text-slate-950 font-black">
                        {formatBrl(totaisConsolidados.somaEstoqueLiquido)}
                      </td>
                    </tr>
                    <tr className="border-t border-slate-200 bg-blue-50/40 text-blue-950 font-semibold text-[11px]">
                      <td colSpan={7} className="py-2 px-2.5 text-right">
                        VALOR TOTAL DO ESTOQUE AVALIADO A CUSTO LÍQUIDO:
                      </td>
                      <td
                        colSpan={2}
                        className="py-2 px-2.5 text-right font-mono text-sm font-extrabold text-blue-950"
                      >
                        {formatBrl(totaisConsolidados.somaEstoqueLiquido)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>

            {/* ========================================================= */}
            {/* 3. CONSOLIDAÇÃO POR CATEGORIA DE INSUMOS */}
            {/* ========================================================= */}
            <section className="space-y-3 pt-2">
              <h2 className="text-xs font-bold text-[#0B1F3A] uppercase tracking-wide border-b border-slate-200 pb-1 flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-[#0B1F3A] text-white flex items-center justify-center text-[10px] font-bold">
                  3
                </span>
                Distribuição de Estoque por Categoria
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-slate-700 font-semibold text-[11px]">
                        <th className="py-2 px-2.5">Categoria</th>
                        <th className="py-2 px-2 text-center">Itens</th>
                        <th className="py-2 px-2.5 text-right">Estoque Líquido (R$)</th>
                        <th className="py-2 px-2.5 text-right">% Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-[11px]">
                      {porCategoria.map((cat, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="py-2 px-2.5 font-medium text-slate-800">
                            {cat.categoria}
                          </td>
                          <td className="py-2 px-2 text-center text-slate-500 font-mono text-[10px]">
                            {cat.count}
                          </td>
                          <td className="py-2 px-2.5 text-right font-bold font-mono text-slate-900">
                            {formatBrl(cat.valorEstoqueLiquido)}
                          </td>
                          <td className="py-2 px-2.5 text-right font-mono font-semibold text-emerald-700">
                            {cat.pctEstoque.toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="space-y-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[11px] font-bold text-slate-700 block">
                    Representatividade no Valor do Estoque Líquido
                  </span>
                  <div className="space-y-2 pt-1">
                    {porCategoria.map((cat, idx) => (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-slate-600 font-medium truncate max-w-[180px]">
                            {cat.categoria}
                          </span>
                          <span className="font-bold text-slate-900 font-mono">
                            {formatBrl(cat.valorEstoqueLiquido)} ({cat.pctEstoque.toFixed(1)}%)
                          </span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-1.5 rounded-full ${
                              idx === 0
                                ? 'bg-blue-600'
                                : idx === 1
                                  ? 'bg-emerald-600'
                                  : idx === 2
                                    ? 'bg-amber-500'
                                    : 'bg-indigo-500'
                            }`}
                            style={{ width: `${Math.min(100, Math.max(2, cat.pctEstoque))}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* ========================================================= */}
            {/* 4. PARECER TÉCNICO & ASSINATURAS FORMAL */}
            {/* ========================================================= */}
            <section className="pt-4 border-t-2 border-slate-200 space-y-6">
              <div className="p-3 bg-slate-50/80 border border-slate-200 rounded-xl text-[11px] text-slate-600 leading-relaxed">
                <strong className="text-slate-800 block mb-1">
                  Parecer de Engenharia de Custos:
                </strong>
                O presente relatório consolida os custos unitários brutos e os respectivos impactos
                tributários e operacionais (créditos recuperáveis de ICMS/PIS/COFINS e acréscimos de
                IPI/Frete/Perdas), apurando o Custo Líquido Real para fins de formação de preço de
                venda e valorização de estoques.
              </div>

              {/* Assinaturas */}
              <div className="grid grid-cols-2 gap-8 pt-6">
                <div className="text-center space-y-1">
                  <div className="border-t border-slate-400 pt-2 w-48 mx-auto" />
                  <p className="text-xs font-bold text-slate-900">
                    {minhaEmpresa?.contador_nome || 'Consultor / Responsável Técnico'}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {minhaEmpresa?.contador_crc
                      ? `CRC: ${minhaEmpresa.contador_crc}${minhaEmpresa.contador_uf_crc ? `/${minhaEmpresa.contador_uf_crc}` : ''}`
                      : 'Controladoria & Finanças'}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {minhaEmpresa?.razao_social || minhaEmpresa?.nome_fantasia || 'Consultoria'}
                  </p>
                </div>

                <div className="text-center space-y-1">
                  <div className="border-t border-slate-400 pt-2 w-48 mx-auto" />
                  <p className="text-xs font-bold text-slate-900">
                    {selectedEmpresa?.nome || 'Diretoria / Gestão Financeira'}
                  </p>
                  <p className="text-[10px] text-slate-500">Gestão de Estoques &amp; Custos</p>
                  <p className="text-[10px] text-slate-400">
                    {selectedEmpresa?.cnpj ? `CNPJ: ${formatCnpj(selectedEmpresa.cnpj)}` : ''}
                  </p>
                </div>
              </div>
            </section>

            {/* Rodapé fixo formal na impressão */}
            <DocumentPrintFooter
              documentTitle="Relatório de Custos por Matéria-Prima & Valorização de Estoque"
              empresaNome={selectedEmpresa?.nome}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
