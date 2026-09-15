import React, { useRef } from 'react'
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
  TrendingUp,
  FileText,
  CheckCircle,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { DocumentPrintFooter } from '@/components/DocumentPrintFooter'
import { useMinhaEmpresa } from '@/contexts/MinhaEmpresaContext'
import { useFilter } from '@/contexts/FilterContext'
import { ProdutoRecord } from '@/types/finance'

interface ModalPdfCapacidadeA4Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  produtos: ProdutoRecord[]
}

function formatCnpj(cnpj?: string): string {
  if (!cnpj) return ''
  const digits = cnpj.replace(/\D/g, '')
  if (digits.length !== 14) return cnpj
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
}

function formatNumber(val?: number, decimals = 2): string {
  if (val === undefined || val === null || isNaN(val)) return '0,00'
  return val.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

export function ModalPdfCapacidadeA4({ open, onOpenChange, produtos }: ModalPdfCapacidadeA4Props) {
  const documentRef = useRef<HTMLDivElement>(null)
  const { minhaEmpresa, logoUrl } = useMinhaEmpresa()
  const { selectedEmpresa, selectedAno } = useFilter()

  const hasMinhaEmpresa = Boolean(minhaEmpresa?.razao_social || minhaEmpresa?.nome_fantasia)

  const handlePrint = () => {
    window.print()
  }

  // Cálculos executivos consolidados
  const dadosProdutos = React.useMemo(() => {
    return produtos.map((p) => {
      const cap = Number(p.capacidade_producao)
      const hasCap =
        p.capacidade_producao !== undefined &&
        p.capacidade_producao !== null &&
        !isNaN(cap) &&
        cap > 0
      const qtd = Number(p.quantidade_vendida) || 0
      const utilPct = hasCap ? (qtd / cap) * 100 : null
      const ociosaQtd = hasCap ? Math.max(0, cap - qtd) : null

      let status: 'Gargalo' | 'Normal' | 'Ocioso' | 'Não informada' = 'Não informada'
      if (hasCap && utilPct !== null) {
        if (utilPct >= 80) status = 'Gargalo'
        else if (utilPct >= 50) status = 'Normal'
        else status = 'Ocioso'
      }

      return {
        ...p,
        capNumero: hasCap ? cap : 0,
        hasCap,
        qtdVendidaNumero: qtd,
        utilPct,
        ociosaQtd,
        status,
      }
    })
  }, [produtos])

  const stats = React.useMemo(() => {
    let capTotal = 0
    let volTotal = 0
    let prodsComCap = 0
    let somaUtil = 0
    let skusOciosos = 0
    let skusNormal = 0
    let skusGargalo = 0
    let skusSemCap = 0

    for (const p of dadosProdutos) {
      if (p.hasCap) {
        capTotal += p.capNumero
        volTotal += p.qtdVendidaNumero
        prodsComCap++
        if (p.utilPct !== null) {
          somaUtil += p.utilPct
          if (p.utilPct < 50) skusOciosos++
          else if (p.utilPct < 80) skusNormal++
          else skusGargalo++
        }
      } else {
        skusSemCap++
      }
    }

    const utilMedia = prodsComCap > 0 ? somaUtil / prodsComCap : 0
    const ociosidadeMedia = Math.max(0, 100 - utilMedia)
    const ociosidadeQtdTotal = Math.max(0, capTotal - volTotal)

    return {
      totalItens: dadosProdutos.length,
      prodsComCap,
      skusSemCap,
      capTotal,
      volTotal,
      utilMedia,
      ociosidadeMedia,
      ociosidadeQtdTotal,
      skusOciosos,
      skusNormal,
      skusGargalo,
    }
  }, [dadosProdutos])

  // Exportar CSV estruturado
  const handleExportCSV = () => {
    if (dadosProdutos.length === 0) return

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
      ['RELATÓRIO DE UTILIZAÇÃO DA CAPACIDADE DE PRODUÇÃO (A4)'].map(escapeCsv).join(';'),
      [
        'Consultoria:',
        minhaEmpresa?.razao_social || minhaEmpresa?.nome_fantasia || 'Consultoria Empresarial',
        'CNPJ:',
        minhaEmpresa?.cnpj || '—',
        'Consultor:',
        `${minhaEmpresa?.contador_nome || 'Consultor Responsável'}${minhaEmpresa?.contador_crc ? ` (CRC: ${minhaEmpresa.contador_crc})` : ''}`,
      ]
        .map(escapeCsv)
        .join(';'),
      [
        'Empresa Ativa:',
        selectedEmpresa?.nome || 'Empresa Padrão',
        'CNPJ Cliente:',
        selectedEmpresa?.cnpj || '—',
        'Exercício:',
        selectedAno || new Date().getFullYear(),
        'Data de Emissão:',
        new Date().toLocaleDateString('pt-BR'),
      ]
        .map(escapeCsv)
        .join(';'),
      '',
      ['QUADRO EXECUTIVO DE CAPACIDADE'].map(escapeCsv).join(';'),
      ['Indicador', 'Valor', 'Observação'].map(escapeCsv).join(';'),
      [
        'Capacidade Total Nominal',
        fmtNum(stats.capTotal),
        'Soma de capacidade dos SKUs com valor cadastrado',
      ]
        .map(escapeCsv)
        .join(';'),
      ['Volume Realizado (Vendas)', fmtNum(stats.volTotal), 'Quantidade vendida apurada no período']
        .map(escapeCsv)
        .join(';'),
      [
        'Utilização Média da Capacidade',
        `${stats.utilMedia.toFixed(1)}%`,
        'Média percentual sobre SKUs com capacidade',
      ]
        .map(escapeCsv)
        .join(';'),
      [
        'Ociosidade Fabril Média',
        `${stats.ociosidadeMedia.toFixed(1)}%`,
        'Percentual ocioso ou subutilizado',
      ]
        .map(escapeCsv)
        .join(';'),
      ['SKUs em Gargalo (>=80%)', stats.skusGargalo, 'Operando próximo ou acima do teto']
        .map(escapeCsv)
        .join(';'),
      ['SKUs Normais (50-79%)', stats.skusNormal, 'Faixa moderada e equilibrada']
        .map(escapeCsv)
        .join(';'),
      ['SKUs Ociosos (<50%)', stats.skusOciosos, 'Baixa utilização de capacidade instalada']
        .map(escapeCsv)
        .join(';'),
      ['SKUs sem Capacidade Informada', stats.skusSemCap, 'Sem métrica cadastrada']
        .map(escapeCsv)
        .join(';'),
      '',
      ['TABELA DETALHADA POR PRODUTO'].map(escapeCsv).join(';'),
      [
        'Código',
        'Produto',
        'Categoria',
        'Unidade',
        'Capacidade de Produção',
        'Quantidade Vendida',
        'Ociosidade (Unidades)',
        '% Utilização',
        'Status',
      ]
        .map(escapeCsv)
        .join(';'),
    ]

    for (const p of dadosProdutos) {
      linhas.push(
        [
          p.codigo || '—',
          p.nome,
          p.categoria || 'Geral',
          p.unidade || 'UN',
          p.hasCap ? fmtNum(p.capNumero) : 'Não informada',
          fmtNum(p.qtdVendidaNumero),
          p.ociosaQtd !== null ? fmtNum(p.ociosaQtd) : '—',
          p.utilPct !== null ? `${p.utilPct.toFixed(1)}%` : '—',
          p.status,
        ]
          .map(escapeCsv)
          .join(';'),
      )
    }

    const csvContent = '\uFEFF' + linhas.join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    const empNome = (selectedEmpresa?.nome || 'empresa').replace(/[^a-zA-Z0-9_-]/g, '_')
    link.setAttribute(
      'download',
      `utilizacao-capacidade-${empNome}-${new Date().toISOString().slice(0, 10)}.csv`,
    )
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const dataEmissao = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[94vh] overflow-y-auto p-0 gap-0 bg-slate-100/90 border-slate-300">
        {/* Barra superior de Ações no Modal (oculta na impressão) */}
        <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-xs border-b border-slate-200 px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 shadow-2xs print:hidden">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#0B1F3A] text-white flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="text-sm font-bold text-[#0B1F3A]">
                Relatório de Utilização da Capacidade (A4)
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Laudo executivo de ociosidade, volume realizado vs capacidade fabril e diagnóstico
                por produto.
              </DialogDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              className="h-8 text-xs font-semibold gap-1 text-slate-700 hover:bg-slate-100"
              title="Exportar dados de capacidade em formato CSV"
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
                  responsável técnico) no módulo "Minha Empresa" para constarem no cabeçalho do PDF.
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
            id="capacidade-producao-document"
            className="w-full max-w-[800px] bg-white border border-slate-300 rounded-xl shadow-lg p-8 sm:p-12 text-slate-800 text-xs leading-relaxed space-y-6 print:border-none print:shadow-none print:p-0 print:m-0 print:max-w-none print:bg-white"
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
                        : 'Engenharia de Operações & Gestão Industrial'}
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
                  className="bg-indigo-50 text-indigo-800 border-indigo-200 text-[10px] font-bold px-2.5 py-0.5 uppercase tracking-wider"
                >
                  Controle de Capacidade Instalada &amp; Eficiência Operacional
                </Badge>
                <h1 className="text-xl sm:text-2xl font-black text-[#0B1F3A] tracking-tight uppercase">
                  RELATÓRIO DE UTILIZAÇÃO DA CAPACIDADE
                </h1>
                <p className="text-[11px] text-slate-500 max-w-lg mx-auto">
                  Análise de ociosidade fabril, volume realizado vs capacidade instalada e detecção
                  de gargalos produtivos
                </p>
              </div>

              {/* Quadro Informativo da Empresa e Período */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs">
                <div className="space-y-1.5">
                  <div className="flex justify-between border-b border-slate-200/60 pb-1">
                    <span className="text-slate-500 font-semibold">Empresa Ativa:</span>
                    <strong className="text-[#0B1F3A] font-bold">
                      {selectedEmpresa?.nome || minhaEmpresa?.razao_social || 'Empresa Padrão'}
                    </strong>
                  </div>
                  <div className="flex justify-between border-b border-slate-200/60 pb-1">
                    <span className="text-slate-500 font-semibold">CNPJ Cliente:</span>
                    <span className="font-mono text-slate-800">
                      {selectedEmpresa?.cnpj ? formatCnpj(selectedEmpresa.cnpj) : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-semibold">Segmento / Ramo:</span>
                    <span className="text-slate-800 font-medium">
                      {selectedEmpresa?.segmento || 'Indústria / Geral'}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5 sm:border-l sm:border-slate-200 sm:pl-3">
                  <div className="flex justify-between border-b border-slate-200/60 pb-1">
                    <span className="text-slate-500 font-semibold">Exercício / Ano:</span>
                    <span className="font-bold text-blue-700">
                      {selectedAno || new Date().getFullYear()}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-slate-200/60 pb-1">
                    <span className="text-slate-500 font-semibold">Responsável Técnico:</span>
                    <span className="text-slate-800 font-medium">
                      {minhaEmpresa?.contador_nome || 'Consultor Operacional'}
                      {minhaEmpresa?.contador_crc ? ` (CRC ${minhaEmpresa.contador_crc})` : ''}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-semibold">Base de SKUs:</span>
                    <span className="text-slate-800 font-semibold">
                      {stats.totalItens} cadastrados ({stats.prodsComCap} com capacidade)
                    </span>
                  </div>
                </div>
              </div>
            </header>

            {/* ========================================================= */}
            {/* 1. QUADRO EXECUTIVO DE INDICADORES DE CAPACIDADE */}
            {/* ========================================================= */}
            <section className="space-y-3">
              <h2 className="text-xs font-bold text-[#0B1F3A] uppercase tracking-wide border-b border-slate-200 pb-1 flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-[#0B1F3A] text-white flex items-center justify-center text-[10px] font-bold">
                  1
                </span>
                Quadro Executivo de Capacidade e Ociosidade
              </h2>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-0.5">
                  <span className="text-[10px] font-bold uppercase text-slate-500 block">
                    Capacidade Total Nominal
                  </span>
                  <strong className="text-base font-black font-mono text-slate-800 block">
                    {formatNumber(stats.capTotal, 0)} un
                  </strong>
                  <span className="text-[10px] text-slate-500 block">
                    {stats.prodsComCap} produtos mapeados
                  </span>
                </div>

                <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl space-y-0.5">
                  <span className="text-[10px] font-bold uppercase text-blue-900 block">
                    Volume Realizado (Vendas)
                  </span>
                  <strong className="text-base font-black font-mono text-blue-900 block">
                    {formatNumber(stats.volTotal, 0)} un
                  </strong>
                  <span className="text-[10px] text-blue-700 block">
                    Demanda atendida no período
                  </span>
                </div>

                <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl space-y-0.5">
                  <span className="text-[10px] font-bold uppercase text-indigo-900 block">
                    Utilização Média
                  </span>
                  <strong className="text-base font-black font-mono text-indigo-950 block">
                    {stats.utilMedia.toFixed(1)}%
                  </strong>
                  <span className="text-[10px] text-indigo-700 block">
                    (Volume ÷ Capacidade) × 100
                  </span>
                </div>

                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-0.5">
                  <span className="text-[10px] font-bold uppercase text-rose-900 block">
                    Ociosidade Fabril Média
                  </span>
                  <strong className="text-base font-black font-mono text-rose-700 block">
                    {stats.ociosidadeMedia.toFixed(1)}%
                  </strong>
                  <span className="text-[10px] text-rose-600 block">
                    {formatNumber(stats.ociosidadeQtdTotal, 0)} un de folga
                  </span>
                </div>
              </div>

              {/* Semáforo Consolidado de SKUs */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                <div className="p-2.5 bg-rose-50/70 border border-rose-200 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-rose-500" />
                    <div>
                      <span className="text-xs font-bold text-rose-950">
                        SKUs Ociosos (&lt; 50%)
                      </span>
                      <p className="text-[10px] text-rose-700">
                        Subutilização de maquinário/mão de obra
                      </p>
                    </div>
                  </div>
                  <strong className="text-base font-black font-mono text-rose-700">
                    {stats.skusOciosos}
                  </strong>
                </div>

                <div className="p-2.5 bg-amber-50/70 border border-amber-200 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-amber-500" />
                    <div>
                      <span className="text-xs font-bold text-amber-950">
                        Faixa Moderada (50–79%)
                      </span>
                      <p className="text-[10px] text-amber-700">
                        Operação equilibrada e com folga segura
                      </p>
                    </div>
                  </div>
                  <strong className="text-base font-black font-mono text-amber-800">
                    {stats.skusNormal}
                  </strong>
                </div>

                <div className="p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-emerald-500" />
                    <div>
                      <span className="text-xs font-bold text-emerald-950">Em Gargalo (≥ 80%)</span>
                      <p className="text-[10px] text-emerald-700">Próximo ou no teto de produção</p>
                    </div>
                  </div>
                  <strong className="text-base font-black font-mono text-emerald-700">
                    {stats.skusGargalo}
                  </strong>
                </div>
              </div>
            </section>

            {/* ========================================================= */}
            {/* 2. TABELA DETALHADA DE CAPACIDADE POR PRODUTO */}
            {/* ========================================================= */}
            <section className="space-y-3 pt-2">
              <h2 className="text-xs font-bold text-[#0B1F3A] uppercase tracking-wide border-b border-slate-200 pb-1 flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-[#0B1F3A] text-white flex items-center justify-center text-[10px] font-bold">
                  2
                </span>
                Detalhamento por SKU / Produto
              </h2>

              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-700 font-semibold">
                      <th className="py-2.5 px-3">Código</th>
                      <th className="py-2.5 px-3">Produto</th>
                      <th className="py-2.5 px-2 text-center">Un</th>
                      <th className="py-2.5 px-3 text-right">Capacidade</th>
                      <th className="py-2.5 px-3 text-right">Qtd Vendida</th>
                      <th className="py-2.5 px-3 text-right">Ociosidade (Un)</th>
                      <th className="py-2.5 px-3 text-right">% Utilização</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {dadosProdutos.map((p, idx) => {
                      return (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="py-2 px-3 font-mono text-[11px] text-slate-500">
                            {p.codigo || '—'}
                          </td>
                          <td className="py-2 px-3 font-semibold text-slate-900">
                            <div>{p.nome}</div>
                            {p.categoria && (
                              <span className="text-[10px] text-slate-400 font-normal">
                                {p.categoria}
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-2 text-center uppercase text-slate-500 font-semibold text-[11px]">
                            {p.unidade || 'UN'}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-slate-800">
                            {p.hasCap ? (
                              formatNumber(p.capNumero, 0)
                            ) : (
                              <span className="text-slate-400 italic">Não informada</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-slate-800">
                            {formatNumber(p.qtdVendidaNumero, 0)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-slate-600">
                            {p.ociosaQtd !== null ? (
                              formatNumber(p.ociosaQtd, 0)
                            ) : (
                              <span className="text-slate-400 italic">—</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-right font-bold font-mono">
                            {p.utilPct !== null ? (
                              <span
                                className={
                                  p.utilPct >= 80
                                    ? 'text-emerald-700 font-extrabold'
                                    : p.utilPct >= 50
                                      ? 'text-amber-700'
                                      : 'text-rose-700'
                                }
                              >
                                {p.utilPct.toFixed(1)}%
                              </span>
                            ) : (
                              <span className="text-slate-400 font-normal italic">—</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-center">
                            {p.status === 'Gargalo' && (
                              <Badge className="text-[10px] bg-emerald-100 text-emerald-800 border-emerald-300">
                                Gargalo
                              </Badge>
                            )}
                            {p.status === 'Normal' && (
                              <Badge className="text-[10px] bg-amber-100 text-amber-800 border-amber-300">
                                Normal
                              </Badge>
                            )}
                            {p.status === 'Ocioso' && (
                              <Badge className="text-[10px] bg-rose-100 text-rose-800 border-rose-300">
                                Ocioso
                              </Badge>
                            )}
                            {p.status === 'Não informada' && (
                              <Badge
                                variant="outline"
                                className="text-[10px] bg-slate-50 text-slate-400 border-slate-200"
                              >
                                Não informada
                              </Badge>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-300 bg-slate-50 font-bold text-slate-900">
                      <td colSpan={3} className="py-2.5 px-3 text-right uppercase text-[11px]">
                        Totais Consolidados:
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-xs text-slate-900">
                        {formatNumber(stats.capTotal, 0)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-xs text-blue-900">
                        {formatNumber(stats.volTotal, 0)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-xs text-rose-700">
                        {formatNumber(stats.ociosidadeQtdTotal, 0)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-xs text-indigo-900 font-black">
                        {stats.utilMedia.toFixed(1)}%
                      </td>
                      <td className="py-2.5 px-3 text-center text-[10px] text-slate-500">
                        {stats.prodsComCap} de {stats.totalItens} com dados
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>

            {/* ========================================================= */}
            {/* 3. RECOMENDAÇÕES E DIRETRIZES ESTRATÉGICAS */}
            {/* ========================================================= */}
            <section className="space-y-3 pt-2">
              <h2 className="text-xs font-bold text-[#0B1F3A] uppercase tracking-wide border-b border-slate-200 pb-1 flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-[#0B1F3A] text-white flex items-center justify-center text-[10px] font-bold">
                  3
                </span>
                Recomendações Técnicas da Consultoria
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px] leading-relaxed">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <strong className="text-slate-800 flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5 text-blue-600" />
                    Produtos com Ociosidade Elevada (&lt; 50%):
                  </strong>
                  <p className="text-slate-600">
                    Avaliar ações de expansão comercial, campanhas de incentivo de vendas, revisão
                    da precificação para ganho de escala ou remanejamento de turnos para diluição
                    dos custos fixos.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <strong className="text-slate-800 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    Produtos com Gargalo Produtivo (≥ 80%):
                  </strong>
                  <p className="text-slate-600">
                    Planejar investimento em expansão de capacidade (CapEx em maquinários ou
                    terceirização parcial), além de priorizar a margem de contribuição por
                    hora-máquina para otimizar o mix de produção.
                  </p>
                </div>
              </div>
            </section>

            {/* ========================================================= */}
            {/* 4. PARECER TÉCNICO & ASSINATURAS */}
            {/* ========================================================= */}
            <section className="pt-4 border-t-2 border-slate-200 space-y-6">
              <div className="p-3 bg-slate-50/80 border border-slate-200 rounded-xl text-[11px] text-slate-600 leading-relaxed">
                <strong className="text-slate-800 block mb-1">
                  Parecer de Capacidade Instalada:
                </strong>
                O acompanhamento periódico da taxa de utilização possibilita equilibrar o ponto de
                equilíbrio operacional, evitando tanto custos de ociosidade não absorvidos quanto
                perdas de oportunidades de receita por estrangulamento da produção.
              </div>

              {/* Assinaturas */}
              <div className="grid grid-cols-2 gap-8 pt-6">
                <div className="text-center space-y-1">
                  <div className="border-t border-slate-400 pt-2 w-48 mx-auto" />
                  <p className="text-xs font-bold text-slate-900">
                    {minhaEmpresa?.contador_nome || 'Consultor Responsável'}
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
                    {selectedEmpresa?.nome || 'Gestor / Responsável pela Empresa'}
                  </p>
                  <p className="text-[10px] text-slate-500">Diretoria / Gestão Industrial</p>
                  <p className="text-[10px] text-slate-400">
                    {selectedEmpresa?.cnpj ? `CNPJ: ${formatCnpj(selectedEmpresa.cnpj)}` : ''}
                  </p>
                </div>
              </div>
            </section>

            {/* Rodapé fixo formal na impressão */}
            <DocumentPrintFooter
              documentTitle="Relatório de Utilização da Capacidade de Produção & Eficiência Fabril"
              empresaNome={selectedEmpresa?.nome}
              exercicioAno={selectedAno}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
