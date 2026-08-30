import React, { useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Printer,
  FileText,
  Download,
  AlertTriangle,
  ExternalLink,
  Layers,
  Sparkles,
  Package,
  Calendar,
  DollarSign,
  TrendingUp,
  Coins,
  Percent,
  CheckCircle2,
  Building2,
  Tag,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useMinhaEmpresa } from '@/contexts/MinhaEmpresaContext'
import { useFilter } from '@/contexts/FilterContext'
import type { FichaTecnicaRecord, ProdutoRecord, MateriaPrimaRecord } from '@/types/finance'

interface ModalPdfFichaTecnicaProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  ficha: FichaTecnicaRecord | null
  produto: ProdutoRecord | null
  materiasMap: Map<string, MateriaPrimaRecord>
}

function formatBrl(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return 'R$ 0,00'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val)
}

function formatNumber(val: number | null | undefined, dec = 2): string {
  if (val === null || val === undefined || isNaN(val)) return '0,00'
  return Number(val).toLocaleString('pt-BR', {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  })
}

function formatPct(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return '0,0%'
  return `${Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}%`
}

function formatCnpj(v?: string): string {
  if (!v) return ''
  const digits = v.replace(/\D/g, '')
  if (digits.length !== 14) return v
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
}

export function ModalPdfFichaTecnica({
  open,
  onOpenChange,
  ficha,
  produto,
  materiasMap,
}: ModalPdfFichaTecnicaProps) {
  const { minhaEmpresa, logoUrl } = useMinhaEmpresa()
  const hasMinhaEmpresa = Boolean(
    minhaEmpresa && (minhaEmpresa.razao_social || minhaEmpresa.nome_fantasia),
  )
  const { selectedEmpresa, selectedAno } = useFilter()
  const documentRef = useRef<HTMLDivElement>(null)

  const handlePrint = () => {
    window.print()
  }

  // Cálculos consolidados da Ficha
  const [configTributariaModal, setConfigTributariaModal] = React.useState<any>(null)

  React.useEffect(() => {
    if (selectedEmpresa?.id) {
      import('@/services/formacaoPrecoService').then(({ configuracoesTributariasService }) => {
        configuracoesTributariasService
          .getByEmpresa(selectedEmpresa.id)
          .then((cfg) => {
            setConfigTributariaModal(cfg)
          })
          .catch(() => {})
      })
    }
  }, [selectedEmpresa?.id])

  // Cálculos consolidados da Ficha
  const stats = React.useMemo(() => {
    if (!ficha) {
      return {
        custoMP: 0,
        outrosCustos: 0,
        custoTotal: 0,
        margemDesejada: 0,
        markupDesejado: 0,
        precoMargem: 0,
        precoMarkup: 0,
        precoComImpostos: 0,
        cargaTrib: 0,
        lucroMargem: 0,
        lucroMarkup: 0,
        itensDetalhados: [],
        porCategoria: [],
      }
    }

    const custoMP = Number(ficha.custo_materia_prima) || 0
    const outrosCustos = Number(ficha.outros_custos) || 0
    const custoTotal = Number(ficha.custo_total) || custoMP + outrosCustos
    const margemDesejada = Number(ficha.margem_desejada) || 0
    const markupDesejado =
      ficha.markup_desejado !== undefined && ficha.markup_desejado !== null
        ? Number(ficha.markup_desejado)
        : margemDesejada < 100 && margemDesejada > 0
          ? (margemDesejada / (100 - margemDesejada)) * 100
          : 50

    const precoMargem =
      Number(ficha.preco_venda_sugerido) ||
      (margemDesejada < 100 && custoTotal > 0
        ? custoTotal / (1 - margemDesejada / 100)
        : custoTotal)
    const precoMarkup =
      Number(ficha.preco_venda_markup) ||
      (custoTotal > 0 ? custoTotal * (1 + markupDesejado / 100) : custoTotal)

    const cargaTrib = Number(configTributariaModal?.carga_tributaria_total) || 0
    let precoComImpostos = precoMargem
    const divImp = 1 - (margemDesejada + cargaTrib) / 100
    if (cargaTrib > 0 && divImp > 0.01 && custoTotal > 0) {
      precoComImpostos = custoTotal / divImp
    } else if (cargaTrib > 0 && custoTotal > 0) {
      precoComImpostos = precoMargem * (1 + cargaTrib / 100)
    }

    const lucroMargem = precoMargem - custoTotal
    const lucroMarkup = precoMarkup - custoTotal

    // Detalhar itens com a categoria da matéria-prima
    const itens = (ficha.itens || []).map((it) => {
      const mp = materiasMap.get(it.materia_prima_id)
      const subtotal = Number(it.subtotal) || Number(it.quantidade) * Number(it.custo_unitario)
      const partTotal = custoTotal > 0 ? (subtotal / custoTotal) * 100 : 0
      const partMP = custoMP > 0 ? (subtotal / custoMP) * 100 : 0
      return {
        ...it,
        categoria: mp?.categoria || 'Geral / Não categorizado',
        codigo: mp?.codigo || '',
        subtotal,
        partTotal,
        partMP,
      }
    })

    // Agrupamento por Categoria de Matéria-Prima
    const catMap = new Map<string, { total: number; count: number }>()
    for (const it of itens) {
      const cat = it.categoria
      const cur = catMap.get(cat) || { total: 0, count: 0 }
      cur.total += it.subtotal
      cur.count += 1
      catMap.set(cat, cur)
    }

    const porCategoria = Array.from(catMap.entries())
      .map(([categoria, d]) => ({
        categoria,
        total: d.total,
        count: d.count,
        pctSobreMP: custoMP > 0 ? (d.total / custoMP) * 100 : 0,
        pctSobreTotal: custoTotal > 0 ? (d.total / custoTotal) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total)

    return {
      custoMP,
      outrosCustos,
      custoTotal,
      margemDesejada,
      markupDesejado,
      precoMargem,
      precoMarkup,
      precoComImpostos,
      cargaTrib,
      lucroMargem,
      lucroMarkup,
      itensDetalhados: itens,
      porCategoria,
    }
  }, [ficha, materiasMap, configTributariaModal])

  // Exportar ficha atual em CSV estruturado
  const handleExportCSV = () => {
    if (!ficha || !produto) return

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
      ['FICHA TÉCNICA DE FORMAÇÃO DE PREÇO E CUSTO'].map(escapeCsv).join(';'),
      ['Empresa:', selectedEmpresa?.nome || minhaEmpresa?.razao_social || 'Minha Empresa']
        .map(escapeCsv)
        .join(';'),
      [
        'Produto:',
        produto.nome,
        'Código:',
        produto.codigo || '—',
        'Unidade:',
        produto.unidade || 'UN',
      ]
        .map(escapeCsv)
        .join(';'),
      ['Data de Emissão:', new Date().toLocaleDateString('pt-BR')].map(escapeCsv).join(';'),
      '',
      ['1. RESUMO GERAL DE CUSTOS E FORMAÇÃO DE PREÇO'].map(escapeCsv).join(';'),
      ['Indicador', 'Valor (R$)', 'Percentual / Base'].map(escapeCsv).join(';'),
      [
        'Custo Matéria-Prima',
        fmtNum(stats.custoMP),
        stats.custoTotal > 0
          ? ((stats.custoMP / stats.custoTotal) * 100).toFixed(1) + '% do custo total'
          : '100%',
      ]
        .map(escapeCsv)
        .join(';'),
      [
        'Outros Custos / MOD',
        fmtNum(stats.outrosCustos),
        stats.custoTotal > 0
          ? ((stats.outrosCustos / stats.custoTotal) * 100).toFixed(1) + '% do custo total'
          : '0%',
      ]
        .map(escapeCsv)
        .join(';'),
      ['CUSTO TOTAL UNITÁRIO', fmtNum(stats.custoTotal), '100%'].map(escapeCsv).join(';'),
      [
        'Preço Sugerido por Margem (Sem Impostos)',
        fmtNum(stats.precoMargem),
        `Margem: ${stats.margemDesejada.toFixed(1)}%`,
      ]
        .map(escapeCsv)
        .join(';'),
      [
        'Preço Sugerido por Markup',
        fmtNum(stats.precoMarkup),
        `Markup: ${stats.markupDesejado.toFixed(1)}%`,
      ]
        .map(escapeCsv)
        .join(';'),
      ...(stats.cargaTrib > 0
        ? [
            [
              `Preço com Impostos (${configTributariaModal?.regime_tributario || 'Tributos'} - ${stats.cargaTrib}%)`,
              fmtNum(stats.precoComImpostos),
              'Cálculo por dentro',
            ]
              .map(escapeCsv)
              .join(';'),
          ]
        : []),
      [
        'Preço Praticado no Cadastro',
        fmtNum(produto.preco_venda || 0),
        `Margem Atual: ${formatPct(produto.margem_desejada)}`,
      ]
        .map(escapeCsv)
        .join(';'),
      '',
      ['2. COMPOSIÇÃO DE MATÉRIAS-PRIMAS (INSUMOS)'].map(escapeCsv).join(';'),
      [
        'Código',
        'Insumo',
        'Categoria',
        'Qtd',
        'Unidade',
        'Custo Unitário (R$)',
        'Subtotal (R$)',
        '% Custo MP',
        '% Custo Total',
      ]
        .map(escapeCsv)
        .join(';'),
    ]

    for (const it of stats.itensDetalhados) {
      linhas.push(
        [
          it.codigo,
          it.materia_prima_nome,
          it.categoria,
          fmtNum(it.quantidade),
          it.unidade,
          fmtNum(it.custo_unitario),
          fmtNum(it.subtotal),
          it.partMP.toFixed(1) + '%',
          it.partTotal.toFixed(1) + '%',
        ]
          .map(escapeCsv)
          .join(';'),
      )
    }

    linhas.push('')
    linhas.push(['3. COMPOSIÇÃO POR CATEGORIA DE MATÉRIA-PRIMA'].map(escapeCsv).join(';'))
    linhas.push(
      [
        'Categoria',
        'Qtd Insumos',
        'Total Categoria (R$)',
        '% sobre Custo MP',
        '% sobre Custo Total',
      ]
        .map(escapeCsv)
        .join(';'),
    )

    for (const cat of stats.porCategoria) {
      linhas.push(
        [
          cat.categoria,
          cat.count,
          fmtNum(cat.total),
          cat.pctSobreMP.toFixed(1) + '%',
          cat.pctSobreTotal.toFixed(1) + '%',
        ]
          .map(escapeCsv)
          .join(';'),
      )
    }

    const csvContent = '\uFEFF' + linhas.join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    const code = (produto.codigo || produto.nome).replace(/[^a-zA-Z0-9_-]/g, '_')
    link.setAttribute(
      'download',
      `ficha-tecnica-${code}-${new Date().toISOString().slice(0, 10)}.csv`,
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

  if (!ficha || !produto) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[94vh] overflow-y-auto p-0 gap-0 bg-slate-100/90 border-slate-300">
        {/* Barra superior de Ações no Modal (oculta na impressão) */}
        <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-xs border-b border-slate-200 px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 shadow-2xs print:hidden">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#0B1F3A] text-white flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="text-sm font-bold text-[#0B1F3A]">
                Ficha Técnica de Formação de Preço (A4)
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Visualização formal com cabeçalho da consultoria, decomposição de custos e
                precificação.
              </DialogDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              className="h-8 text-xs font-semibold gap-1 text-slate-700 hover:bg-slate-100"
              title="Exportar esta ficha técnica em formato CSV"
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
            id="ficha-tecnica-document"
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
                  Formação de Preço de Venda &amp; Estrutura de Custos
                </Badge>
                <h1 className="text-xl sm:text-2xl font-black text-[#0B1F3A] tracking-tight uppercase">
                  FICHA TÉCNICA DE PRODUTO
                </h1>
                <p className="text-[11px] text-slate-500 max-w-lg mx-auto">
                  Detalhamento de matérias-primas, outros custos de fabricação, rateio e
                  precificação por Margem e Markup
                </p>
              </div>

              {/* Quadro Informativo do Produto e Empresa */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs">
                <div className="space-y-1.5">
                  <div className="flex justify-between border-b border-slate-200/60 pb-1">
                    <span className="text-slate-500 font-semibold">Produto:</span>
                    <strong className="text-[#0B1F3A] font-bold">{produto.nome}</strong>
                  </div>
                  <div className="flex justify-between border-b border-slate-200/60 pb-1">
                    <span className="text-slate-500 font-semibold">Código Interno / SKU:</span>
                    <span className="font-mono text-slate-800 font-bold">
                      {produto.codigo || '—'}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-slate-200/60 pb-1">
                    <span className="text-slate-500 font-semibold">Categoria / Linha:</span>
                    <span className="text-slate-800 font-medium">
                      {produto.categoria || 'Geral'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-semibold">Unidade de Medida:</span>
                    <span className="text-blue-700 font-bold uppercase">
                      {produto.unidade || 'UN'}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5 sm:border-l sm:border-slate-200 sm:pl-3">
                  <div className="flex justify-between border-b border-slate-200/60 pb-1">
                    <span className="text-slate-500 font-semibold">Empresa Cliente:</span>
                    <strong className="text-slate-900">
                      {selectedEmpresa?.nome || minhaEmpresa?.razao_social || 'Empresa Padrão'}
                    </strong>
                  </div>
                  <div className="flex justify-between border-b border-slate-200/60 pb-1">
                    <span className="text-slate-500 font-semibold">CNPJ Cliente:</span>
                    <span className="font-mono text-slate-800">
                      {selectedEmpresa?.cnpj ? formatCnpj(selectedEmpresa.cnpj) : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-slate-200/60 pb-1">
                    <span className="text-slate-500 font-semibold">Exercício / Ano:</span>
                    <span className="font-bold text-blue-700">
                      {selectedAno || new Date().getFullYear()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-semibold">Responsável Técnico:</span>
                    <span className="text-slate-800 font-medium">
                      {minhaEmpresa?.contador_nome || 'Consultor Financeiro'}
                      {minhaEmpresa?.contador_crc ? ` (CRC ${minhaEmpresa.contador_crc})` : ''}
                    </span>
                  </div>
                </div>
              </div>
            </header>

            {/* ========================================================= */}
            {/* 1. RESUMO EXECUTIVO DE CUSTOS & PREÇOS SUGERIDOS */}
            {/* ========================================================= */}
            <section className="space-y-3">
              <h2 className="text-xs font-bold text-[#0B1F3A] uppercase tracking-wide border-b border-slate-200 pb-1 flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-[#0B1F3A] text-white flex items-center justify-center text-[10px] font-bold">
                  1
                </span>
                Resumo Executivo de Custos e Formação de Preço
              </h2>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-0.5">
                  <span className="text-[10px] font-bold uppercase text-slate-500 block">
                    Custo Matéria-Prima
                  </span>
                  <strong className="text-sm sm:text-base font-black font-mono text-slate-800 block">
                    {formatBrl(stats.custoMP)}
                  </strong>
                  <span className="text-[10px] text-slate-500 block">
                    {stats.custoTotal > 0
                      ? `${((stats.custoMP / stats.custoTotal) * 100).toFixed(1)}% do total`
                      : '100%'}
                  </span>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-0.5">
                  <span className="text-[10px] font-bold uppercase text-slate-500 block">
                    Outros Custos / MOD
                  </span>
                  <strong className="text-sm sm:text-base font-black font-mono text-slate-800 block">
                    {formatBrl(stats.outrosCustos)}
                  </strong>
                  <span className="text-[10px] text-slate-500 block">
                    {stats.custoTotal > 0
                      ? `${((stats.outrosCustos / stats.custoTotal) * 100).toFixed(1)}% do total`
                      : '0%'}
                  </span>
                </div>

                <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-xl space-y-0.5">
                  <span className="text-[10px] font-bold uppercase text-blue-900 block">
                    Custo Total Unitário
                  </span>
                  <strong className="text-sm sm:text-base font-black font-mono text-blue-900 block">
                    {formatBrl(stats.custoTotal)}
                  </strong>
                  <span className="text-[10px] text-blue-700 block">Base de formação</span>
                </div>

                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-0.5">
                  <span className="text-[10px] font-bold uppercase text-emerald-900 block">
                    Preço Praticado Atual
                  </span>
                  <strong className="text-sm sm:text-base font-black font-mono text-emerald-800 block">
                    {formatBrl(produto.preco_venda || 0)}
                  </strong>
                  <span className="text-[10px] text-emerald-700 block">
                    Margem: {formatPct(produto.margem_desejada)}
                  </span>
                </div>
              </div>

              {/* Comparativo: Margem vs Markup */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {/* Sugestão por Margem (Divisor) */}
                <div className="p-3.5 bg-emerald-50/50 border border-emerald-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                      <Percent className="w-3.5 h-3.5 text-emerald-700" />
                      Preço Sugerido por Margem (Divisor)
                    </span>
                    <Badge className="text-[10px] bg-emerald-100 text-emerald-800 font-bold border-emerald-300">
                      Margem: {formatPct(stats.margemDesejada)}
                    </Badge>
                  </div>
                  <div className="flex items-baseline justify-between border-t border-emerald-200/60 pt-1.5">
                    <span className="text-[11px] text-slate-600">Preço Calculado:</span>
                    <strong className="text-base font-black font-mono text-emerald-800">
                      {formatBrl(stats.precoMargem)}
                    </strong>
                  </div>
                  <div className="flex items-baseline justify-between text-[11px] text-slate-600">
                    <span>Lucro Bruto Unitário:</span>
                    <span className="font-semibold text-slate-800 font-mono">
                      {formatBrl(stats.lucroMargem)}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 italic">
                    Fórmula: Custo Total ÷ (1 - Margem/100)
                  </p>
                </div>

                {/* Sugestão por Markup (Multiplicador) */}
                <div className="p-3.5 bg-blue-50/50 border border-blue-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-blue-700" />
                      Preço Sugerido por Markup (Multiplicador)
                    </span>
                    <Badge className="text-[10px] bg-blue-100 text-blue-800 font-bold border-blue-300">
                      Markup: {formatPct(stats.markupDesejado)}
                    </Badge>
                  </div>
                  <div className="flex items-baseline justify-between border-t border-blue-200/60 pt-1.5">
                    <span className="text-[11px] text-slate-600">Preço Calculado:</span>
                    <strong className="text-base font-black font-mono text-blue-900">
                      {formatBrl(stats.precoMarkup)}
                    </strong>
                  </div>
                  <div className="flex items-baseline justify-between text-[11px] text-slate-600">
                    <span>Lucro Bruto Unitário:</span>
                    <span className="font-semibold text-slate-800 font-mono">
                      {formatBrl(stats.lucroMarkup)}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 italic">
                    Fórmula: Custo Total × (1 + Markup/100)
                  </p>
                </div>

                {/* Sugestão com Carga Tributária (Impostos por dentro) */}
                {stats.cargaTrib > 0 && (
                  <div className="p-3.5 bg-amber-50/70 border border-amber-300 rounded-xl space-y-2 sm:col-span-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                        <Percent className="w-3.5 h-3.5 text-amber-700" />
                        Preço Sugerido com Impostos (
                        {configTributariaModal?.regime_tributario || 'Regime Fiscal'})
                      </span>
                      <Badge className="text-[10px] bg-amber-100 text-amber-900 font-bold border-amber-300">
                        Carga Total: {formatPct(stats.cargaTrib)}
                      </Badge>
                    </div>
                    <div className="flex items-baseline justify-between border-t border-amber-200/80 pt-1.5">
                      <span className="text-[11px] text-amber-800">
                        Preço de Venda Final (Por Dentro):
                      </span>
                      <strong className="text-lg font-black font-mono text-amber-950">
                        {formatBrl(stats.precoComImpostos)}
                      </strong>
                    </div>
                    <p className="text-[10px] text-amber-800 italic">
                      Fórmula por Dentro: Custo ÷ [1 - (Margem% + Carga Tributária%)/100]
                    </p>
                  </div>
                )}
              </div>
            </section>

            {/* ========================================================= */}
            {/* 2. LISTA DE MATÉRIAS-PRIMAS E INSUMOS */}
            {/* ========================================================= */}
            <section className="space-y-3 pt-2">
              <h2 className="text-xs font-bold text-[#0B1F3A] uppercase tracking-wide border-b border-slate-200 pb-1 flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-[#0B1F3A] text-white flex items-center justify-center text-[10px] font-bold">
                  2
                </span>
                Detalhamento dos Insumos de Fabricação
              </h2>

              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-700 font-semibold">
                      <th className="py-2 px-2.5">Código</th>
                      <th className="py-2 px-2.5">Insumo / Matéria-Prima</th>
                      <th className="py-2 px-2.5">Categoria</th>
                      <th className="py-2 px-2.5 text-right">Qtd</th>
                      <th className="py-2 px-2.5 text-center">Un</th>
                      <th className="py-2 px-2.5 text-right">Custo Un. (R$)</th>
                      <th className="py-2 px-2.5 text-right">Subtotal (R$)</th>
                      <th className="py-2 px-2.5 text-right">% Custo MP</th>
                      <th className="py-2 px-2.5 text-right">% Custo Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {stats.itensDetalhados.map((it, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="py-2 px-2.5 font-mono text-[11px] text-slate-500">
                          {it.codigo || '—'}
                        </td>
                        <td className="py-2 px-2.5 font-semibold text-slate-900">
                          {it.materia_prima_nome}
                        </td>
                        <td className="py-2 px-2.5 text-slate-600 text-[11px]">
                          <span className="inline-block px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                            {it.categoria}
                          </span>
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-slate-800">
                          {formatNumber(it.quantidade, 3)}
                        </td>
                        <td className="py-2 px-2.5 text-center uppercase text-slate-500 font-semibold text-[11px]">
                          {it.unidade}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-slate-700">
                          {formatBrl(it.custo_unitario)}
                        </td>
                        <td className="py-2 px-2.5 text-right font-bold font-mono text-slate-900">
                          {formatBrl(it.subtotal)}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-slate-600 text-[11px]">
                          {it.partMP.toFixed(1)}%
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono font-semibold text-blue-700 text-[11px]">
                          {it.partTotal.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-300 bg-slate-50/80 font-bold text-slate-900">
                      <td colSpan={6} className="py-2.5 px-2.5 text-right uppercase text-[11px]">
                        Subtotal Matérias-Primas:
                      </td>
                      <td className="py-2.5 px-2.5 text-right font-mono text-sm text-slate-900">
                        {formatBrl(stats.custoMP)}
                      </td>
                      <td className="py-2.5 px-2.5 text-right font-mono text-[11px]">100,0%</td>
                      <td className="py-2.5 px-2.5 text-right font-mono text-[11px] text-blue-700">
                        {stats.custoTotal > 0
                          ? `${((stats.custoMP / stats.custoTotal) * 100).toFixed(1)}%`
                          : '100%'}
                      </td>
                    </tr>
                    {stats.outrosCustos > 0 && (
                      <tr className="border-t border-slate-200 bg-slate-50/40 text-slate-700">
                        <td colSpan={6} className="py-2 px-2.5 text-right text-[11px]">
                          Outros Custos / Mão de Obra Direta:
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono font-semibold text-slate-800">
                          {formatBrl(stats.outrosCustos)}
                        </td>
                        <td className="py-2 px-2.5 text-right text-slate-400 text-[11px]">—</td>
                        <td className="py-2 px-2.5 text-right font-mono text-[11px] text-slate-700">
                          {stats.custoTotal > 0
                            ? `${((stats.outrosCustos / stats.custoTotal) * 100).toFixed(1)}%`
                            : '0%'}
                        </td>
                      </tr>
                    )}
                    <tr className="border-t border-slate-300 bg-blue-50/50 font-black text-blue-950">
                      <td colSpan={6} className="py-2.5 px-2.5 text-right uppercase text-xs">
                        Custo Total Unitário de Fabricação:
                      </td>
                      <td className="py-2.5 px-2.5 text-right font-mono text-sm text-blue-900">
                        {formatBrl(stats.custoTotal)}
                      </td>
                      <td className="py-2.5 px-2.5 text-right text-slate-400 text-[11px]">—</td>
                      <td className="py-2.5 px-2.5 text-right font-mono text-[11px] text-blue-900">
                        100,0%
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>

            {/* ========================================================= */}
            {/* 3. COMPOSIÇÃO DE CUSTO POR CATEGORIA DE MATÉRIA-PRIMA */}
            {/* ========================================================= */}
            <section className="space-y-3 pt-2">
              <h2 className="text-xs font-bold text-[#0B1F3A] uppercase tracking-wide border-b border-slate-200 pb-1 flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-[#0B1F3A] text-white flex items-center justify-center text-[10px] font-bold">
                  3
                </span>
                Composição de Custo por Categoria de Insumos
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                {/* Tabela de Categorias */}
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-slate-700 font-semibold">
                        <th className="py-2 px-2.5">Categoria</th>
                        <th className="py-2 px-2.5 text-center">Itens</th>
                        <th className="py-2 px-2.5 text-right">Total (R$)</th>
                        <th className="py-2 px-2.5 text-right">% Custo Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {stats.porCategoria.map((cat, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="py-2 px-2.5 font-medium text-slate-800">
                            {cat.categoria}
                          </td>
                          <td className="py-2 px-2.5 text-center text-slate-500 font-mono text-[11px]">
                            {cat.count}
                          </td>
                          <td className="py-2 px-2.5 text-right font-bold font-mono text-slate-900">
                            {formatBrl(cat.total)}
                          </td>
                          <td className="py-2 px-2.5 text-right font-mono font-semibold text-emerald-700">
                            {cat.pctSobreTotal.toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Barras de Representatividade */}
                <div className="space-y-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[11px] font-bold text-slate-700 block">
                    Distribuição Percentual sobre o Custo Total
                  </span>
                  <div className="space-y-2 pt-1">
                    {stats.porCategoria.map((cat, idx) => (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-slate-600 font-medium truncate max-w-[180px]">
                            {cat.categoria}
                          </span>
                          <span className="font-bold text-slate-900 font-mono">
                            {formatBrl(cat.total)} ({cat.pctSobreTotal.toFixed(1)}%)
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
                            style={{ width: `${Math.min(100, Math.max(2, cat.pctSobreTotal))}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* Observações da Ficha se existirem */}
            {ficha.observacoes && (
              <section className="space-y-1.5 pt-2">
                <h3 className="text-xs font-bold text-[#0B1F3A] uppercase tracking-wide">
                  Observações &amp; Notas de Produção
                </h3>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {ficha.observacoes}
                </div>
              </section>
            )}

            {/* ========================================================= */}
            {/* 4. PARECER TÉCNICO & ASSINATURAS FORMAL */}
            {/* ========================================================= */}
            <section className="pt-4 border-t-2 border-slate-200 space-y-6">
              <div className="p-3 bg-slate-50/80 border border-slate-200 rounded-xl text-[11px] text-slate-600 leading-relaxed">
                <strong className="text-slate-800 block mb-1">Parecer de Formação de Preço:</strong>
                A precificação acima foi formulada com base no custo de reposição das
                matérias-primas e taxa de outros custos diretos. Recomenda-se a revisão periódica
                dos valores de custo unitário dos insumos para manutenção da margem real desejada.
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
                  <p className="text-[10px] text-slate-500">Diretoria / Gestão de Custos</p>
                  <p className="text-[10px] text-slate-400">
                    {selectedEmpresa?.cnpj ? `CNPJ: ${formatCnpj(selectedEmpresa.cnpj)}` : ''}
                  </p>
                </div>
              </div>
            </section>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
