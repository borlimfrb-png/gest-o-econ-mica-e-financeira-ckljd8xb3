import React, { useState, useEffect } from 'react'
import { useFilter } from '@/contexts/FilterContext'
import { balancosService, dreService } from '@/services/financeService'
import type { BalancoRecord, DreRecord } from '@/types/finance'
import {
  calcularBalanco,
  calcularDre,
  calcularIndicadores,
  gerarAnaliseAutomatica,
  formatBrlMil,
  formatNumber,
  formatPercent,
  formatCnpj,
} from '@/lib/financeCalculations'
import { Link } from 'react-router-dom'
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
import {
  Printer,
  Download,
  FileText,
  Building2,
  Calendar,
  Scale,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

type TipoRelatorio = 'completo' | 'balanco' | 'dre' | 'indicadores'

export default function Relatorios() {
  const {
    empresas,
    selectedEmpresaId,
    setSelectedEmpresaId,
    selectedAno,
    setSelectedAno,
    anosDisponiveis,
    selectedEmpresa,
  } = useFilter()
  const { toast } = useToast()

  const [tipoRelatorio, setTipoRelatorio] = useState<TipoRelatorio>('completo')
  const [balancos, setBalancos] = useState<BalancoRecord[]>([])
  const [dres, setDres] = useState<DreRecord[]>([])
  const [loading, setLoading] = useState(false)

  const loadRelatorioData = async () => {
    if (!selectedEmpresaId) return
    try {
      setLoading(true)
      const [bList, dList] = await Promise.all([
        balancosService.getByEmpresa(selectedEmpresaId),
        dreService.getByEmpresa(selectedEmpresaId),
      ])
      setBalancos(bList)
      setDres(dList)
    } catch (err) {
      console.error('Erro ao carregar dados do relatório:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRelatorioData()
  }, [selectedEmpresaId])

  const anoAnterior = selectedAno - 1
  const balancoAtual = balancos.find((b) => b.ano === selectedAno) || null
  const balancoAnterior = balancos.find((b) => b.ano === anoAnterior) || null
  const dreAtual = dres.find((d) => d.ano === selectedAno) || null
  const dreAnterior = dres.find((d) => d.ano === anoAnterior) || null

  const calcBAtual = calcularBalanco(balancoAtual)
  const calcBAnterior = calcularBalanco(balancoAnterior)
  const calcDAtual = calcularDre(dreAtual)
  const calcDAnterior = calcularDre(dreAnterior)

  const indAtual = calcularIndicadores(balancoAtual, dreAtual)
  const indAnterior = balancoAnterior ? calcularIndicadores(balancoAnterior, dreAnterior) : null

  const analise = gerarAnaliseAutomatica(balancoAtual, dreAtual, balancoAnterior, dreAnterior)

  const hasAnoAnterior = !!balancoAnterior

  // Análise Horizontal helper
  const calcAH = (atual?: number | null, ant?: number | null) => {
    if (!atual || !ant || ant === 0) return '—'
    const pct = ((atual - ant) / Math.abs(ant)) * 100
    return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`
  }

  const calcAV = (val?: number | null, total?: number | null) => {
    if (!val || !total || total === 0) return '—'
    return `${((val / total) * 100).toFixed(1)}%`
  }

  // Print PDF handler
  const handlePrint = () => {
    window.print()
  }

  // Export CSV handler
  const handleExportCsv = () => {
    if (!selectedEmpresa) return

    let csvContent = '\uFEFF' // BOM para UTF-8 no Excel
    const dataEmissao = new Date().toLocaleDateString('pt-BR')

    csvContent += `EMPRESA;${selectedEmpresa.nome}\n`
    csvContent += `CNPJ;${formatCnpj(selectedEmpresa.cnpj)}\n`
    csvContent += `SEGMENTO;${selectedEmpresa.segmento}\n`
    csvContent += `EXERCÍCIO;${selectedAno}\n`
    csvContent += `DATA DE EMISSÃO;${dataEmissao}\n\n`

    if (tipoRelatorio === 'completo' || tipoRelatorio === 'balanco') {
      csvContent += `BALANÇO PATRIMONIAL (Valores em R$ mil)\n`
      csvContent += `Conta;${selectedAno};${hasAnoAnterior ? anoAnterior : 'Ano Anterior'};AV%;AH%\n`
      csvContent += `1. ATIVO TOTAL;${calcBAtual.ativoTotal};${calcBAnterior.ativoTotal};100,0%;${calcAH(calcBAtual.ativoTotal, calcBAnterior.ativoTotal)}\n`
      csvContent += `1.1 Ativo Circulante;${calcBAtual.ativoCirculante};${calcBAnterior.ativoCirculante};${calcAV(calcBAtual.ativoCirculante, calcBAtual.ativoTotal)};${calcAH(calcBAtual.ativoCirculante, calcBAnterior.ativoCirculante)}\n`
      csvContent += `Caixa e Equivalentes;${balancoAtual?.caixa_equivalentes || 0};${balancoAnterior?.caixa_equivalentes || 0};${calcAV(balancoAtual?.caixa_equivalentes, calcBAtual.ativoTotal)};${calcAH(balancoAtual?.caixa_equivalentes, balancoAnterior?.caixa_equivalentes)}\n`
      csvContent += `Aplicações Financeiras;${balancoAtual?.aplicacoes_financeiras || 0};${balancoAnterior?.aplicacoes_financeiras || 0};${calcAV(balancoAtual?.aplicacoes_financeiras, calcBAtual.ativoTotal)};${calcAH(balancoAtual?.aplicacoes_financeiras, balancoAnterior?.aplicacoes_financeiras)}\n`
      csvContent += `Contas a Receber;${balancoAtual?.contas_receber || 0};${balancoAnterior?.contas_receber || 0};${calcAV(balancoAtual?.contas_receber, calcBAtual.ativoTotal)};${calcAH(balancoAtual?.contas_receber, balancoAnterior?.contas_receber)}\n`
      csvContent += `Estoques;${balancoAtual?.estoques || 0};${balancoAnterior?.estoques || 0};${calcAV(balancoAtual?.estoques, calcBAtual.ativoTotal)};${calcAH(balancoAtual?.estoques, balancoAnterior?.estoques)}\n`
      csvContent += `1.2 Ativo Não Circulante;${calcBAtual.ativoNaoCirculante};${calcBAnterior.ativoNaoCirculante};${calcAV(calcBAtual.ativoNaoCirculante, calcBAtual.ativoTotal)};${calcAH(calcBAtual.ativoNaoCirculante, calcBAnterior.ativoNaoCirculante)}\n`
      csvContent += `Imobilizado;${balancoAtual?.imobilizado || 0};${balancoAnterior?.imobilizado || 0};${calcAV(balancoAtual?.imobilizado, calcBAtual.ativoTotal)};${calcAH(balancoAtual?.imobilizado, balancoAnterior?.imobilizado)}\n`
      csvContent += `2. PASSIVO E PL;${calcBAtual.passivoEPL};${calcBAnterior.passivoEPL};100,0%;${calcAH(calcBAtual.passivoEPL, calcBAnterior.passivoEPL)}\n`
      csvContent += `2.1 Passivo Circulante;${calcBAtual.passivoCirculante};${calcBAnterior.passivoCirculante};${calcAV(calcBAtual.passivoCirculante, calcBAtual.passivoEPL)};${calcAH(calcBAtual.passivoCirculante, calcBAnterior.passivoCirculante)}\n`
      csvContent += `Fornecedores;${balancoAtual?.fornecedores || 0};${balancoAnterior?.fornecedores || 0};${calcAV(balancoAtual?.fornecedores, calcBAtual.passivoEPL)};${calcAH(balancoAtual?.fornecedores, balancoAnterior?.fornecedores)}\n`
      csvContent += `Empréstimos Curto Prazo;${balancoAtual?.emprestimos_curto_prazo || 0};${balancoAnterior?.emprestimos_curto_prazo || 0};${calcAV(balancoAtual?.emprestimos_curto_prazo, calcBAtual.passivoEPL)};${calcAH(balancoAtual?.emprestimos_curto_prazo, balancoAnterior?.emprestimos_curto_prazo)}\n`
      csvContent += `2.2 Passivo Não Circulante;${calcBAtual.passivoNaoCirculante};${calcBAnterior.passivoNaoCirculante};${calcAV(calcBAtual.passivoNaoCirculante, calcBAtual.passivoEPL)};${calcAH(calcBAtual.passivoNaoCirculante, calcBAnterior.passivoNaoCirculante)}\n`
      csvContent += `Empréstimos Longo Prazo;${balancoAtual?.emprestimos_longo_prazo || 0};${balancoAnterior?.emprestimos_longo_prazo || 0};${calcAV(balancoAtual?.emprestimos_longo_prazo, calcBAtual.passivoEPL)};${calcAH(balancoAtual?.emprestimos_longo_prazo, balancoAnterior?.emprestimos_longo_prazo)}\n`
      csvContent += `2.3 Patrimônio Líquido;${calcBAtual.patrimonioLiquido};${calcBAnterior.patrimonioLiquido};${calcAV(calcBAtual.patrimonioLiquido, calcBAtual.passivoEPL)};${calcAH(calcBAtual.patrimonioLiquido, calcBAnterior.patrimonioLiquido)}\n\n`
    }

    if (tipoRelatorio === 'completo' || tipoRelatorio === 'dre') {
      csvContent += `DEMONSTRATIVO DO RESULTADO (DRE - R$ mil)\n`
      csvContent += `Linha;${selectedAno};${hasAnoAnterior ? anoAnterior : 'Ano Anterior'};AV%;AH%\n`
      csvContent += `Receita Bruta;${dreAtual?.receita_bruta || 0};${dreAnterior?.receita_bruta || 0};;${calcAH(dreAtual?.receita_bruta, dreAnterior?.receita_bruta)}\n`
      csvContent += `Receita Líquida;${calcDAtual.receitaLiquida};${calcDAnterior.receitaLiquida};100,0%;${calcAH(calcDAtual.receitaLiquida, calcDAnterior.receitaLiquida)}\n`
      csvContent += `Lucro Bruto;${calcDAtual.lucroBruto};${calcDAnterior.lucroBruto};${calcAV(calcDAtual.lucroBruto, calcDAtual.receitaLiquida)};${calcAH(calcDAtual.lucroBruto, calcDAnterior.lucroBruto)}\n`
      csvContent += `Resultado Operacional (EBIT);${calcDAtual.resultadoOperacional};${calcDAnterior.resultadoOperacional};${calcAV(calcDAtual.resultadoOperacional, calcDAtual.receitaLiquida)};${calcAH(calcDAtual.resultadoOperacional, calcDAnterior.resultadoOperacional)}\n`
      csvContent += `Lucro Líquido;${calcDAtual.lucroLiquido};${calcDAnterior.lucroLiquido};${calcAV(calcDAtual.lucroLiquido, calcDAtual.receitaLiquida)};${calcAH(calcDAtual.lucroLiquido, calcDAnterior.lucroLiquido)}\n`
      csvContent += `EBITDA;${calcDAtual.ebitda};${calcDAnterior.ebitda};${calcAV(calcDAtual.ebitda, calcDAtual.receitaLiquida)};${calcAH(calcDAtual.ebitda, calcDAnterior.ebitda)}\n\n`
    }

    if (tipoRelatorio === 'completo' || tipoRelatorio === 'indicadores') {
      csvContent += `INDICADORES FINANCEIROS\n`
      csvContent += `Indicador;${selectedAno};${hasAnoAnterior ? anoAnterior : 'Ano Anterior'}\n`
      csvContent += `Liquidez Corrente;${formatNumber(indAtual.liquidezCorrente, 2)};${formatNumber(indAnterior?.liquidezCorrente, 2)}\n`
      csvContent += `Liquidez Seca;${formatNumber(indAtual.liquidezSeca, 2)};${formatNumber(indAnterior?.liquidezSeca, 2)}\n`
      csvContent += `Liquidez Imediata;${formatNumber(indAtual.liquidezImediata, 2)};${formatNumber(indAnterior?.liquidezImediata, 2)}\n`
      csvContent += `Liquidez Geral;${formatNumber(indAtual.liquidezGeral, 2)};${formatNumber(indAnterior?.liquidezGeral, 2)}\n`
      csvContent += `Endividamento Geral (%);${formatPercent(indAtual.endividamentoGeral, 1)};${formatPercent(indAnterior?.endividamentoGeral, 1)}\n`
      csvContent += `Composição do Endividamento (%);${formatPercent(indAtual.composicaoEndividamento, 1)};${formatPercent(indAnterior?.composicaoEndividamento, 1)}\n`
      csvContent += `Margem Bruta (%);${formatPercent(indAtual.margemBruta, 1)};${formatPercent(indAnterior?.margemBruta, 1)}\n`
      csvContent += `Margem Líquida (%);${formatPercent(indAtual.margemLiquida, 1)};${formatPercent(indAnterior?.margemLiquida, 1)}\n`
      csvContent += `ROA (%);${formatPercent(indAtual.roa, 1)};${formatPercent(indAnterior?.roa, 1)}\n`
      csvContent += `ROE (%);${formatPercent(indAtual.roe, 1)};${formatPercent(indAnterior?.roe, 1)}\n`
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.setAttribute(
      'download',
      `relatorio_${selectedEmpresa.nome.toLowerCase().replace(/\s+/g, '_')}_${selectedAno}.csv`,
    )
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    toast({
      title: 'Arquivo CSV Exportado',
      description: 'O relatório foi gerado e baixado para seu dispositivo.',
    })
  }

  if (!selectedEmpresa) {
    return (
      <div className="py-12 text-center text-xs text-slate-500">
        Selecione uma empresa para gerar relatórios.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Controles de Configuração do Relatório (Ocultos na impressão) */}
      <div className="print:hidden bg-white border border-slate-200 rounded-xl p-4 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-slate-500 block">
              Tipo de Relatório:
            </span>
            <Select
              value={tipoRelatorio}
              onValueChange={(val) => setTipoRelatorio(val as TipoRelatorio)}
            >
              <SelectTrigger className="h-8 text-xs font-semibold bg-slate-50 border-slate-200 w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="completo" className="text-xs">
                  Relatório Completo (Executivo)
                </SelectItem>
                <SelectItem value="balanco" className="text-xs">
                  Balanço Patrimonial
                </SelectItem>
                <SelectItem value="dre" className="text-xs">
                  Demonstrativo DRE
                </SelectItem>
                <SelectItem value="indicadores" className="text-xs">
                  Painel de Indicadores
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Botões de Ação */}
        <div className="flex items-center gap-2">
          <Button
            asChild
            variant="outline"
            className="h-9 text-xs font-semibold border-blue-200 hover:bg-blue-50 text-blue-700"
          >
            <Link to="/relatorio-anual">
              <FileText className="w-4 h-4 mr-1.5" />
              Ver Relatório Anual (12 Meses)
            </Link>
          </Button>

          <Button
            onClick={handleExportCsv}
            variant="outline"
            className="h-9 text-xs font-semibold border-slate-200 hover:bg-slate-50 text-slate-700"
          >
            <Download className="w-4 h-4 mr-1.5" />
            Exportar CSV
          </Button>

          <Button
            onClick={handlePrint}
            className="h-9 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
          >
            <Printer className="w-4 h-4 mr-1.5" />
            Imprimir / Salvar PDF
          </Button>
        </div>
      </div>

      {/* Aviso quando o ano anterior não existir (Oculto na impressão se desejar) */}
      {!hasAnoAnterior && (
        <div className="print:hidden bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            <strong>Aviso de Análise Horizontal:</strong> Não foram encontrados lançamentos para o
            ano anterior ({anoAnterior}). As colunas comparativas e variações históricas são
            exibidas como "—".
          </span>
        </div>
      )}

      {/* =========================================================================
          FOLHA A4 - PRÉ-VISUALIZAÇÃO / IMPRESSÃO
      ========================================================================= */}
      <div className="bg-white border border-slate-200 print:border-none shadow-md print:shadow-none rounded-2xl print:rounded-none max-w-[210mm] mx-auto p-8 sm:p-12 print:p-0 min-h-[297mm] text-slate-900">
        {/* Cabeçalho Corporativo Relatório */}
        <div className="border-b-2 border-[#0B1F3A] pb-5 mb-6 flex items-start justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-[#0B1F3A] text-white flex items-center justify-center font-bold">
              <Scale className="w-6 h-6" />
            </div>
            <div>
              <span className="font-extrabold text-base tracking-tight text-[#0B1F3A] block">
                Analise de Balanço
              </span>
              <span className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold block">
                Consultoria Financeira Corporativa
              </span>
            </div>
          </div>

          <div className="text-right">
            <Badge className="bg-blue-50 text-blue-800 border-blue-200 font-bold text-xs uppercase tracking-wider mb-1">
              {tipoRelatorio === 'completo' && 'Parecer & Relatório Completo'}
              {tipoRelatorio === 'balanco' && 'Balanço Patrimonial'}
              {tipoRelatorio === 'dre' && 'Demonstrativo de Resultado'}
              {tipoRelatorio === 'indicadores' && 'Painel de Indicadores'}
            </Badge>
            <p className="text-[11px] text-slate-500">
              Emissão: {new Date().toLocaleDateString('pt-BR')}
            </p>
          </div>
        </div>

        {/* Informações da Empresa Cliente */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <span className="text-slate-500 font-medium block text-[11px]">Empresa Cliente</span>
            <strong className="text-slate-900 font-bold">{selectedEmpresa.nome}</strong>
          </div>
          <div>
            <span className="text-slate-500 font-medium block text-[11px]">CNPJ</span>
            <strong className="text-slate-900 font-mono">{formatCnpj(selectedEmpresa.cnpj)}</strong>
          </div>
          <div>
            <span className="text-slate-500 font-medium block text-[11px]">Segmento</span>
            <strong className="text-slate-900 font-semibold">{selectedEmpresa.segmento}</strong>
          </div>
          <div>
            <span className="text-slate-500 font-medium block text-[11px]">
              Exercício Analisado
            </span>
            <strong className="text-blue-700 font-bold">{selectedAno}</strong>
          </div>
        </div>

        {/* 1. SEÇÃO EXECUTIVA: RESUMO DE KPIS (SE COMPLETO) */}
        {tipoRelatorio === 'completo' && (
          <div className="mb-6 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#0B1F3A] border-b border-slate-200 pb-1.5 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
              1. Visão Executiva dos Principais Indicadores
            </h4>

            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center text-xs">
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-500 block">Ativo Total</span>
                <strong className="text-xs font-bold text-slate-900">
                  {formatBrlMil(calcBAtual.ativoTotal)}
                </strong>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-500 block">Passivo Total</span>
                <strong className="text-xs font-bold text-slate-900">
                  {formatBrlMil(calcBAtual.passivoTotal)}
                </strong>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-500 block">Patrimônio Líq.</span>
                <strong className="text-xs font-bold text-emerald-700">
                  {formatBrlMil(calcBAtual.patrimonioLiquido)}
                </strong>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-500 block">Liq. Corrente</span>
                <strong className="text-xs font-bold text-slate-900">
                  {formatNumber(indAtual.liquidezCorrente, 2)}
                </strong>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-500 block">Endividamento</span>
                <strong className="text-xs font-bold text-slate-900">
                  {formatPercent(indAtual.endividamentoGeral, 1)}
                </strong>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-500 block">ROE</span>
                <strong className="text-xs font-bold text-slate-900">
                  {formatPercent(indAtual.roe, 1)}
                </strong>
              </div>
            </div>
          </div>
        )}

        {/* 2. SEÇÃO: BALANÇO PATRIMONIAL */}
        {(tipoRelatorio === 'completo' || tipoRelatorio === 'balanco') && (
          <div className="mb-6 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#0B1F3A] border-b border-slate-200 pb-1.5 flex items-center gap-1.5">
              <Scale className="w-3.5 h-3.5 text-blue-600" />
              {tipoRelatorio === 'completo' ? '2. Balanço Patrimonial' : 'Balanço Patrimonial'}
            </h4>

            <table className="w-full text-left text-[11px] border-collapse">
              <thead>
                <tr className="bg-slate-100 font-semibold text-slate-700 border-b border-slate-300">
                  <th className="py-1.5 px-2">Conta</th>
                  <th className="py-1.5 px-2 text-right">{selectedAno} (R$ mil)</th>
                  <th className="py-1.5 px-2 text-right">
                    {hasAnoAnterior ? anoAnterior : 'Ant.'} (R$ mil)
                  </th>
                  <th className="py-1.5 px-2 text-center">AV%</th>
                  <th className="py-1.5 px-2 text-center">AH%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                <tr className="font-bold bg-slate-50">
                  <td className="py-1 px-2">1. ATIVO TOTAL</td>
                  <td className="py-1 px-2 text-right">{formatBrlMil(calcBAtual.ativoTotal)}</td>
                  <td className="py-1 px-2 text-right">{formatBrlMil(calcBAnterior.ativoTotal)}</td>
                  <td className="py-1 px-2 text-center">100%</td>
                  <td className="py-1 px-2 text-center">
                    {calcAH(calcBAtual.ativoTotal, calcBAnterior.ativoTotal)}
                  </td>
                </tr>
                <tr className="font-semibold text-slate-800">
                  <td className="py-1 px-4">1.1 Ativo Circulante</td>
                  <td className="py-1 px-2 text-right">
                    {formatBrlMil(calcBAtual.ativoCirculante)}
                  </td>
                  <td className="py-1 px-2 text-right">
                    {formatBrlMil(calcBAnterior.ativoCirculante)}
                  </td>
                  <td className="py-1 px-2 text-center">
                    {calcAV(calcBAtual.ativoCirculante, calcBAtual.ativoTotal)}
                  </td>
                  <td className="py-1 px-2 text-center">
                    {calcAH(calcBAtual.ativoCirculante, calcBAnterior.ativoCirculante)}
                  </td>
                </tr>
                <tr>
                  <td className="py-0.5 px-6 text-slate-600">Caixa e Equivalentes</td>
                  <td className="py-0.5 px-2 text-right">
                    {formatBrlMil(balancoAtual?.caixa_equivalentes)}
                  </td>
                  <td className="py-0.5 px-2 text-right">
                    {formatBrlMil(balancoAnterior?.caixa_equivalentes)}
                  </td>
                  <td className="py-0.5 px-2 text-center text-slate-500">
                    {calcAV(balancoAtual?.caixa_equivalentes, calcBAtual.ativoTotal)}
                  </td>
                  <td className="py-0.5 px-2 text-center text-slate-500">
                    {calcAH(balancoAtual?.caixa_equivalentes, balancoAnterior?.caixa_equivalentes)}
                  </td>
                </tr>
                <tr>
                  <td className="py-0.5 px-6 text-slate-600">Contas a Receber</td>
                  <td className="py-0.5 px-2 text-right">
                    {formatBrlMil(balancoAtual?.contas_receber)}
                  </td>
                  <td className="py-0.5 px-2 text-right">
                    {formatBrlMil(balancoAnterior?.contas_receber)}
                  </td>
                  <td className="py-0.5 px-2 text-center text-slate-500">
                    {calcAV(balancoAtual?.contas_receber, calcBAtual.ativoTotal)}
                  </td>
                  <td className="py-0.5 px-2 text-center text-slate-500">
                    {calcAH(balancoAtual?.contas_receber, balancoAnterior?.contas_receber)}
                  </td>
                </tr>
                <tr>
                  <td className="py-0.5 px-6 text-slate-600">Estoques</td>
                  <td className="py-0.5 px-2 text-right">{formatBrlMil(balancoAtual?.estoques)}</td>
                  <td className="py-0.5 px-2 text-right">
                    {formatBrlMil(balancoAnterior?.estoques)}
                  </td>
                  <td className="py-0.5 px-2 text-center text-slate-500">
                    {calcAV(balancoAtual?.estoques, calcBAtual.ativoTotal)}
                  </td>
                  <td className="py-0.5 px-2 text-center text-slate-500">
                    {calcAH(balancoAtual?.estoques, balancoAnterior?.estoques)}
                  </td>
                </tr>
                <tr className="font-semibold text-slate-800">
                  <td className="py-1 px-4">1.2 Ativo Não Circulante</td>
                  <td className="py-1 px-2 text-right">
                    {formatBrlMil(calcBAtual.ativoNaoCirculante)}
                  </td>
                  <td className="py-1 px-2 text-right">
                    {formatBrlMil(calcBAnterior.ativoNaoCirculante)}
                  </td>
                  <td className="py-1 px-2 text-center">
                    {calcAV(calcBAtual.ativoNaoCirculante, calcBAtual.ativoTotal)}
                  </td>
                  <td className="py-1 px-2 text-center">
                    {calcAH(calcBAtual.ativoNaoCirculante, calcBAnterior.ativoNaoCirculante)}
                  </td>
                </tr>
                <tr>
                  <td className="py-0.5 px-6 text-slate-600">Imobilizado</td>
                  <td className="py-0.5 px-2 text-right">
                    {formatBrlMil(balancoAtual?.imobilizado)}
                  </td>
                  <td className="py-0.5 px-2 text-right">
                    {formatBrlMil(balancoAnterior?.imobilizado)}
                  </td>
                  <td className="py-0.5 px-2 text-center text-slate-500">
                    {calcAV(balancoAtual?.imobilizado, calcBAtual.ativoTotal)}
                  </td>
                  <td className="py-0.5 px-2 text-center text-slate-500">
                    {calcAH(balancoAtual?.imobilizado, balancoAnterior?.imobilizado)}
                  </td>
                </tr>

                <tr className="font-bold bg-slate-50">
                  <td className="py-1 px-2">2. PASSIVO E PATRIMÔNIO LÍQUIDO</td>
                  <td className="py-1 px-2 text-right">{formatBrlMil(calcBAtual.passivoEPL)}</td>
                  <td className="py-1 px-2 text-right">{formatBrlMil(calcBAnterior.passivoEPL)}</td>
                  <td className="py-1 px-2 text-center">100%</td>
                  <td className="py-1 px-2 text-center">
                    {calcAH(calcBAtual.passivoEPL, calcBAnterior.passivoEPL)}
                  </td>
                </tr>
                <tr className="font-semibold text-slate-800">
                  <td className="py-1 px-4">2.1 Passivo Circulante</td>
                  <td className="py-1 px-2 text-right">
                    {formatBrlMil(calcBAtual.passivoCirculante)}
                  </td>
                  <td className="py-1 px-2 text-right">
                    {formatBrlMil(calcBAnterior.passivoCirculante)}
                  </td>
                  <td className="py-1 px-2 text-center">
                    {calcAV(calcBAtual.passivoCirculante, calcBAtual.passivoEPL)}
                  </td>
                  <td className="py-1 px-2 text-center">
                    {calcAH(calcBAtual.passivoCirculante, calcBAnterior.passivoCirculante)}
                  </td>
                </tr>
                <tr className="font-semibold text-slate-800">
                  <td className="py-1 px-4">2.2 Passivo Não Circulante</td>
                  <td className="py-1 px-2 text-right">
                    {formatBrlMil(calcBAtual.passivoNaoCirculante)}
                  </td>
                  <td className="py-1 px-2 text-right">
                    {formatBrlMil(calcBAnterior.passivoNaoCirculante)}
                  </td>
                  <td className="py-1 px-2 text-center">
                    {calcAV(calcBAtual.passivoNaoCirculante, calcBAtual.passivoEPL)}
                  </td>
                  <td className="py-1 px-2 text-center">
                    {calcAH(calcBAtual.passivoNaoCirculante, calcBAnterior.passivoNaoCirculante)}
                  </td>
                </tr>
                <tr className="font-bold text-emerald-900 bg-emerald-50/40">
                  <td className="py-1 px-4">2.3 Patrimônio Líquido</td>
                  <td className="py-1 px-2 text-right">
                    {formatBrlMil(calcBAtual.patrimonioLiquido)}
                  </td>
                  <td className="py-1 px-2 text-right">
                    {formatBrlMil(calcBAnterior.patrimonioLiquido)}
                  </td>
                  <td className="py-1 px-2 text-center">
                    {calcAV(calcBAtual.patrimonioLiquido, calcBAtual.passivoEPL)}
                  </td>
                  <td className="py-1 px-2 text-center">
                    {calcAH(calcBAtual.patrimonioLiquido, calcBAnterior.patrimonioLiquido)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* 3. SEÇÃO: DRE */}
        {(tipoRelatorio === 'completo' || tipoRelatorio === 'dre') && (
          <div className="mb-6 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#0B1F3A] border-b border-slate-200 pb-1.5 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-blue-600" />
              {tipoRelatorio === 'completo'
                ? '3. Demonstrativo de Resultado (DRE)'
                : 'Demonstrativo de Resultado'}
            </h4>

            <table className="w-full text-left text-[11px] border-collapse">
              <thead>
                <tr className="bg-slate-100 font-semibold text-slate-700 border-b border-slate-300">
                  <th className="py-1.5 px-2">Linha da DRE</th>
                  <th className="py-1.5 px-2 text-right">{selectedAno} (R$ mil)</th>
                  <th className="py-1.5 px-2 text-right">
                    {hasAnoAnterior ? anoAnterior : 'Ant.'} (R$ mil)
                  </th>
                  <th className="py-1.5 px-2 text-center">AV% (sobre Rec. Líq.)</th>
                  <th className="py-1.5 px-2 text-center">AH%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                <tr>
                  <td className="py-1 px-2 font-medium">(=) Receita Operacional Bruta</td>
                  <td className="py-1 px-2 text-right">{formatBrlMil(dreAtual?.receita_bruta)}</td>
                  <td className="py-1 px-2 text-right">
                    {formatBrlMil(dreAnterior?.receita_bruta)}
                  </td>
                  <td className="py-1 px-2 text-center">
                    {calcAV(dreAtual?.receita_bruta, calcDAtual.receitaLiquida)}
                  </td>
                  <td className="py-1 px-2 text-center">
                    {calcAH(dreAtual?.receita_bruta, dreAnterior?.receita_bruta)}
                  </td>
                </tr>
                <tr className="font-bold bg-slate-50">
                  <td className="py-1 px-2">(=) RECEITA OPERACIONAL LÍQUIDA</td>
                  <td className="py-1 px-2 text-right">
                    {formatBrlMil(calcDAtual.receitaLiquida)}
                  </td>
                  <td className="py-1 px-2 text-right">
                    {formatBrlMil(calcDAnterior.receitaLiquida)}
                  </td>
                  <td className="py-1 px-2 text-center">100%</td>
                  <td className="py-1 px-2 text-center">
                    {calcAH(calcDAtual.receitaLiquida, calcDAnterior.receitaLiquida)}
                  </td>
                </tr>
                <tr className="font-semibold text-slate-800">
                  <td className="py-1 px-2">(=) LUCRO BRUTO</td>
                  <td className="py-1 px-2 text-right">{formatBrlMil(calcDAtual.lucroBruto)}</td>
                  <td className="py-1 px-2 text-right">{formatBrlMil(calcDAnterior.lucroBruto)}</td>
                  <td className="py-1 px-2 text-center">
                    {calcAV(calcDAtual.lucroBruto, calcDAtual.receitaLiquida)}
                  </td>
                  <td className="py-1 px-2 text-center">
                    {calcAH(calcDAtual.lucroBruto, calcDAnterior.lucroBruto)}
                  </td>
                </tr>
                <tr className="font-semibold text-slate-800">
                  <td className="py-1 px-2">(=) RESULTADO OPERACIONAL (EBIT)</td>
                  <td className="py-1 px-2 text-right">
                    {formatBrlMil(calcDAtual.resultadoOperacional)}
                  </td>
                  <td className="py-1 px-2 text-right">
                    {formatBrlMil(calcDAnterior.resultadoOperacional)}
                  </td>
                  <td className="py-1 px-2 text-center">
                    {calcAV(calcDAtual.resultadoOperacional, calcDAtual.receitaLiquida)}
                  </td>
                  <td className="py-1 px-2 text-center">
                    {calcAH(calcDAtual.resultadoOperacional, calcDAnterior.resultadoOperacional)}
                  </td>
                </tr>
                <tr className="font-bold text-emerald-900 bg-emerald-50/40">
                  <td className="py-1 px-2">(=) LUCRO LÍQUIDO DO EXERCÍCIO</td>
                  <td className="py-1 px-2 text-right">{formatBrlMil(calcDAtual.lucroLiquido)}</td>
                  <td className="py-1 px-2 text-right">
                    {formatBrlMil(calcDAnterior.lucroLiquido)}
                  </td>
                  <td className="py-1 px-2 text-center">
                    {calcAV(calcDAtual.lucroLiquido, calcDAtual.receitaLiquida)}
                  </td>
                  <td className="py-1 px-2 text-center">
                    {calcAH(calcDAtual.lucroLiquido, calcDAnterior.lucroLiquido)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* 4. SEÇÃO: INDICADORES FINANCEIROS */}
        {(tipoRelatorio === 'completo' || tipoRelatorio === 'indicadores') && (
          <div className="mb-6 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#0B1F3A] border-b border-slate-200 pb-1.5 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
              {tipoRelatorio === 'completo'
                ? '4. Tabela de Indicadores e Índices'
                : 'Painel de Indicadores'}
            </h4>

            <div className="grid grid-cols-2 gap-4 text-[11px]">
              {/* Liquidez e Endividamento */}
              <div className="border border-slate-200 rounded-lg p-3 space-y-2">
                <span className="font-bold text-slate-900 block text-xs border-b border-slate-100 pb-1">
                  Liquidez & Endividamento
                </span>
                <div className="flex justify-between py-0.5">
                  <span className="text-slate-600">Liquidez Corrente:</span>
                  <strong>{formatNumber(indAtual.liquidezCorrente, 2)}</strong>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-slate-600">Liquidez Seca:</span>
                  <strong>{formatNumber(indAtual.liquidezSeca, 2)}</strong>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-slate-600">Liquidez Imediata:</span>
                  <strong>{formatNumber(indAtual.liquidezImediata, 2)}</strong>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-slate-600">Endividamento Geral (%):</span>
                  <strong>{formatPercent(indAtual.endividamentoGeral, 1)}</strong>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-slate-600">Composição Endividamento:</span>
                  <strong>{formatPercent(indAtual.composicaoEndividamento, 1)}</strong>
                </div>
              </div>

              {/* Rentabilidade e Estrutura */}
              <div className="border border-slate-200 rounded-lg p-3 space-y-2">
                <span className="font-bold text-slate-900 block text-xs border-b border-slate-100 pb-1">
                  Rentabilidade & Estrutura
                </span>
                <div className="flex justify-between py-0.5">
                  <span className="text-slate-600">Margem Bruta (%):</span>
                  <strong>{formatPercent(indAtual.margemBruta, 1)}</strong>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-slate-600">Margem Líquida (%):</span>
                  <strong>{formatPercent(indAtual.margemLiquida, 1)}</strong>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-slate-600">ROA (Retorno Ativo %):</span>
                  <strong>{formatPercent(indAtual.roa, 1)}</strong>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-slate-600">ROE (Retorno PL %):</span>
                  <strong>{formatPercent(indAtual.roe, 1)}</strong>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-slate-600">Alavancagem Financeira:</span>
                  <strong>{formatNumber(indAtual.alavancagemFinanceira, 2)}x</strong>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 5. PARECER AUTOMÁTICO DO CONSULTOR (SE COMPLETO) */}
        {tipoRelatorio === 'completo' && (
          <div className="mb-6 space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#0B1F3A] border-b border-slate-200 pb-1.5 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
              5. Parecer Técnico da Consultoria
            </h4>

            <div className="space-y-2 text-[11px] leading-relaxed text-slate-700 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              {analise.visaoGeral.map((paragrafo, idx) => (
                <p key={idx}>{paragrafo}</p>
              ))}
            </div>
          </div>
        )}

        {/* Rodapé A4 */}
        <div className="border-t border-slate-200 pt-4 mt-8 flex items-center justify-between text-[10px] text-slate-500">
          <span>Analise de Balanço · Consultoria Financeira &copy; {new Date().getFullYear()}</span>
          <span>Documento gerado eletronicamente para fins de análise gerencial</span>
        </div>
      </div>
    </div>
  )
}
