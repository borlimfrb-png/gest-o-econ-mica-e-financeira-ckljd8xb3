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
  Building2,
  Calendar,
  AlertTriangle,
  ExternalLink,
  Download,
  Copy,
  CheckCircle2,
  Activity,
  Flame,
  TrendingUp,
  Scale,
  ShieldCheck,
  Layers,
  FileSpreadsheet,
  BarChart3,
  Check,
  Minus,
  AlertCircle,
  FileText,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { Link } from 'react-router-dom'
import type {
  EmpresaRecord,
  MinhaEmpresaRecord,
  BalancoRecord,
  DreRecord,
  BenchmarkEmpresaRecord,
} from '@/types/finance'
import {
  formatCnpj,
  formatNumber,
  formatBrlMil,
  formatCurrency,
  formatPercent,
} from '@/lib/financeCalculations'
import { DocumentPrintFooter } from '@/components/DocumentPrintFooter'
import {
  BENCHMARKS_SETORIAIS,
  type BenchmarkSetorValores,
  type IndicadoresConsolidadosEmpresa,
  type GrupoRadarItem,
  getBenchmarkParaSegmento,
} from '@/lib/benchmarks'

export interface ModalPdfBenchmarksA4Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedEmpresa: EmpresaRecord | null
  selectedAno: number
  minhaEmpresa: MinhaEmpresaRecord | null
  logoUrl: string | null
  indAtual: IndicadoresConsolidadosEmpresa
  benchmarkSetor: BenchmarkSetorValores
  metaEmpresa?: Partial<BenchmarkSetorValores> | BenchmarkEmpresaRecord | null
  radarItems?: GrupoRadarItem[]
  scoreGeralPonderado?: number
}

interface LinhaComparativa {
  categoria: string
  indicador: string
  sigla: string
  formula: string
  unidade: string
  menorMelhor?: boolean
  valorReal: number | null
  valorSetor: number
  valorMeta: number | null
  valorRealFormatado: string
  valorSetorFormatado: string
  valorMetaFormatado: string
  situacao: 'acima' | 'alinhado' | 'abaixo' | 'indefinido'
  situacaoTexto: string
}

export function ModalPdfBenchmarksA4({
  open,
  onOpenChange,
  selectedEmpresa,
  selectedAno,
  minhaEmpresa,
  logoUrl,
  indAtual,
  benchmarkSetor,
  metaEmpresa,
  radarItems,
  scoreGeralPonderado,
}: ModalPdfBenchmarksA4Props) {
  const { toast } = useToast()

  const dataEmissao = useMemo(() => {
    return new Date().toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })
  }, [])

  const hasMetaIndividual = Boolean(metaEmpresa && Object.keys(metaEmpresa).length > 0)

  const hasMinhaEmpresa = !!(
    minhaEmpresa?.razao_social ||
    minhaEmpresa?.nome_fantasia ||
    minhaEmpresa?.contador_nome
  )

  // Geração das linhas comparativas detalhadas pelas 7 categorias
  const linhasTabela: LinhaComparativa[] = useMemo(() => {
    const meta = metaEmpresa || {}

    const calcularSituacao = (
      real: number | null,
      alvo: number | null,
      menorMelhor = false,
      toleranciaPercent = 5,
    ): { situacao: 'acima' | 'alinhado' | 'abaixo' | 'indefinido'; texto: string } => {
      if (real === null || real === undefined || isNaN(real)) {
        return { situacao: 'indefinido', texto: 'Sem Dados' }
      }
      if (alvo === null || alvo === undefined || isNaN(alvo)) {
        return { situacao: 'indefinido', texto: '—' }
      }

      const diff = real - alvo
      const threshold = Math.abs(alvo * (toleranciaPercent / 100)) || 0.05

      if (menorMelhor) {
        if (real < alvo - threshold)
          return { situacao: 'acima', texto: '🟢 Favorável (Abaixo do teto)' }
        if (real > alvo + threshold)
          return { situacao: 'abaixo', texto: '🔴 Crítico (Acima do teto)' }
        return { situacao: 'alinhado', texto: '🟡 Em Linha' }
      } else {
        if (real > alvo + threshold) return { situacao: 'acima', texto: '🟢 Acima da Meta' }
        if (real < alvo - threshold) return { situacao: 'abaixo', texto: '🔴 Abaixo da Meta' }
        return { situacao: 'alinhado', texto: '🟡 Em Linha' }
      }
    }

    const rows: {
      categoria: string
      indicador: string
      sigla: string
      formula: string
      unidade: string
      menorMelhor?: boolean
      real: number | null
      setor: number
      meta: number | null | undefined
      formatReal: (v: number | null) => string
      formatSetor: (v: number) => string
      formatMeta: (v: number | null | undefined) => string
    }[] = [
      // 1. LIQUIDEZ
      {
        categoria: '1. Liquidez & Solvência',
        indicador: 'Liquidez Corrente',
        sigla: 'LC',
        formula: 'AC / PC',
        unidade: 'x',
        real: indAtual.lc,
        setor: benchmarkSetor.liquidezCorrente,
        meta: meta.liquidezCorrente,
        formatReal: (v) => (v !== null ? `${v.toFixed(2)}x` : '—'),
        formatSetor: (v) => `${v.toFixed(2)}x`,
        formatMeta: (v) => (v !== undefined && v !== null ? `${v.toFixed(2)}x` : '—'),
      },
      {
        categoria: '1. Liquidez & Solvência',
        indicador: 'Liquidez Seca',
        sigla: 'LS',
        formula: '(AC - Estoques) / PC',
        unidade: 'x',
        real: indAtual.ls,
        setor: benchmarkSetor.liquidezSeca,
        meta: meta.liquidezSeca,
        formatReal: (v) => (v !== null ? `${v.toFixed(2)}x` : '—'),
        formatSetor: (v) => `${v.toFixed(2)}x`,
        formatMeta: (v) => (v !== undefined && v !== null ? `${v.toFixed(2)}x` : '—'),
      },
      {
        categoria: '1. Liquidez & Solvência',
        indicador: 'Liquidez Imediata',
        sigla: 'LI',
        formula: 'Caixa / PC',
        unidade: 'x',
        real: indAtual.li,
        setor: benchmarkSetor.liquidezImediata,
        meta: meta.liquidezImediata,
        formatReal: (v) => (v !== null ? `${v.toFixed(2)}x` : '—'),
        formatSetor: (v) => `${v.toFixed(2)}x`,
        formatMeta: (v) => (v !== undefined && v !== null ? `${v.toFixed(2)}x` : '—'),
      },
      {
        categoria: '1. Liquidez & Solvência',
        indicador: 'Liquidez Geral',
        sigla: 'LG',
        formula: '(AC + RLP) / (PC + PNC)',
        unidade: 'x',
        real: indAtual.lg,
        setor: benchmarkSetor.liquidezGeral,
        meta: meta.liquidezGeral,
        formatReal: (v) => (v !== null ? `${v.toFixed(2)}x` : '—'),
        formatSetor: (v) => `${v.toFixed(2)}x`,
        formatMeta: (v) => (v !== undefined && v !== null ? `${v.toFixed(2)}x` : '—'),
      },

      // 2. ENDIVIDAMENTO
      {
        categoria: '2. Endividamento & Alavancagem',
        indicador: 'Endividamento Geral',
        sigla: 'EG',
        formula: 'Passivo Total / Ativo',
        unidade: '%',
        menorMelhor: true,
        real: indAtual.eg,
        setor: benchmarkSetor.endividamentoGeral,
        meta: meta.endividamentoGeral,
        formatReal: (v) => (v !== null ? `${v.toFixed(1)}%` : '—'),
        formatSetor: (v) => `${v.toFixed(1)}%`,
        formatMeta: (v) => (v !== undefined && v !== null ? `${v.toFixed(1)}%` : '—'),
      },
      {
        categoria: '2. Endividamento & Alavancagem',
        indicador: 'Composição do Endividamento',
        sigla: 'CE',
        formula: 'PC / Passivo Total',
        unidade: '%',
        menorMelhor: true,
        real: indAtual.ce,
        setor: benchmarkSetor.composicaoEndividamento,
        meta: meta.composicaoEndividamento,
        formatReal: (v) => (v !== null ? `${v.toFixed(1)}%` : '—'),
        formatSetor: (v) => `${v.toFixed(1)}%`,
        formatMeta: (v) => (v !== undefined && v !== null ? `${v.toFixed(1)}%` : '—'),
      },
      {
        categoria: '2. Endividamento & Alavancagem',
        indicador: 'Participação Cap. Terceiros',
        sigla: 'PCT',
        formula: 'Passivo / PL',
        unidade: '%',
        menorMelhor: true,
        real: indAtual.pct,
        setor: benchmarkSetor.participacaoCapitalTerceiros,
        meta: meta.participacaoCapitalTerceiros,
        formatReal: (v) => (v !== null ? `${v.toFixed(1)}%` : '—'),
        formatSetor: (v) => `${v.toFixed(1)}%`,
        formatMeta: (v) => (v !== undefined && v !== null ? `${v.toFixed(1)}%` : '—'),
      },
      {
        categoria: '2. Endividamento & Alavancagem',
        indicador: 'Imobilização do PL',
        sigla: 'IPL',
        formula: 'Imobilizado / PL',
        unidade: '%',
        menorMelhor: true,
        real: indAtual.ipl,
        setor: benchmarkSetor.imobilizacaoPL,
        meta: meta.imobilizacaoPL,
        formatReal: (v) => (v !== null ? `${v.toFixed(1)}%` : '—'),
        formatSetor: (v) => `${v.toFixed(1)}%`,
        formatMeta: (v) => (v !== undefined && v !== null ? `${v.toFixed(1)}%` : '—'),
      },

      // 3. RENTABILIDADE
      {
        categoria: '3. Rentabilidade & Retorno',
        indicador: 'Margem Bruta',
        sigla: 'MB',
        formula: 'Lucro Bruto / Receita Líquida',
        unidade: '%',
        real: indAtual.mb,
        setor: benchmarkSetor.margemBruta,
        meta: meta.margemBruta,
        formatReal: (v) => (v !== null ? `${v.toFixed(1)}%` : '—'),
        formatSetor: (v) => `${v.toFixed(1)}%`,
        formatMeta: (v) => (v !== undefined && v !== null ? `${v.toFixed(1)}%` : '—'),
      },
      {
        categoria: '3. Rentabilidade & Retorno',
        indicador: 'Margem Operacional',
        sigla: 'MO',
        formula: 'EBIT / Receita Líquida',
        unidade: '%',
        real: indAtual.mo,
        setor: benchmarkSetor.margemOperacional,
        meta: meta.margemOperacional,
        formatReal: (v) => (v !== null ? `${v.toFixed(1)}%` : '—'),
        formatSetor: (v) => `${v.toFixed(1)}%`,
        formatMeta: (v) => (v !== undefined && v !== null ? `${v.toFixed(1)}%` : '—'),
      },
      {
        categoria: '3. Rentabilidade & Retorno',
        indicador: 'Margem Líquida',
        sigla: 'ML',
        formula: 'Lucro Líquido / Receita Líquida',
        unidade: '%',
        real: indAtual.ml,
        setor: benchmarkSetor.margemLiquida,
        meta: meta.margemLiquida,
        formatReal: (v) => (v !== null ? `${v.toFixed(1)}%` : '—'),
        formatSetor: (v) => `${v.toFixed(1)}%`,
        formatMeta: (v) => (v !== undefined && v !== null ? `${v.toFixed(1)}%` : '—'),
      },
      {
        categoria: '3. Rentabilidade & Retorno',
        indicador: 'ROE (Retorno sobre PL)',
        sigla: 'ROE',
        formula: 'Lucro Líquido / PL',
        unidade: '%',
        real: indAtual.roe,
        setor: benchmarkSetor.roe,
        meta: meta.roe,
        formatReal: (v) => (v !== null ? `${v.toFixed(1)}%` : '—'),
        formatSetor: (v) => `${v.toFixed(1)}%`,
        formatMeta: (v) => (v !== undefined && v !== null ? `${v.toFixed(1)}%` : '—'),
      },
      {
        categoria: '3. Rentabilidade & Retorno',
        indicador: 'ROA (Retorno sobre Ativo)',
        sigla: 'ROA',
        formula: 'Lucro Líquido / Ativo Total',
        unidade: '%',
        real: indAtual.roa,
        setor: benchmarkSetor.roa,
        meta: meta.roa,
        formatReal: (v) => (v !== null ? `${v.toFixed(1)}%` : '—'),
        formatSetor: (v) => `${v.toFixed(1)}%`,
        formatMeta: (v) => (v !== undefined && v !== null ? `${v.toFixed(1)}%` : '—'),
      },
      {
        categoria: '3. Rentabilidade & Retorno',
        indicador: 'Giro do Ativo',
        sigla: 'GA',
        formula: 'Receita Líquida / Ativo',
        unidade: 'x',
        real: indAtual.giroAtivo,
        setor: benchmarkSetor.giroAtivo,
        meta: meta.giroAtivo,
        formatReal: (v) => (v !== null ? `${v.toFixed(2)}x` : '—'),
        formatSetor: (v) => `${v.toFixed(2)}x`,
        formatMeta: (v) => (v !== undefined && v !== null ? `${v.toFixed(2)}x` : '—'),
      },

      // 4. ESTRUTURA DE CAPITAL
      {
        categoria: '4. Estrutura de Capital',
        indicador: 'Autonomia Financeira',
        sigla: 'AF',
        formula: 'PL / Ativo Total',
        unidade: '%',
        real: indAtual.af,
        setor: benchmarkSetor.autonomiaFinanceira,
        meta: meta.autonomiaFinanceira,
        formatReal: (v) => (v !== null ? `${v.toFixed(1)}%` : '—'),
        formatSetor: (v) => `${v.toFixed(1)}%`,
        formatMeta: (v) => (v !== undefined && v !== null ? `${v.toFixed(1)}%` : '—'),
      },
      {
        categoria: '4. Estrutura de Capital',
        indicador: 'Dependência Financeira',
        sigla: 'DF',
        formula: 'Passivo Total / Ativo',
        unidade: '%',
        menorMelhor: true,
        real: indAtual.df,
        setor: benchmarkSetor.dependenciaFinanceira,
        meta: meta.dependenciaFinanceira,
        formatReal: (v) => (v !== null ? `${v.toFixed(1)}%` : '—'),
        formatSetor: (v) => `${v.toFixed(1)}%`,
        formatMeta: (v) => (v !== undefined && v !== null ? `${v.toFixed(1)}%` : '—'),
      },
      {
        categoria: '4. Estrutura de Capital',
        indicador: 'Dívida / Equity',
        sigla: 'D/E',
        formula: 'Passivo / PL',
        unidade: 'x',
        menorMelhor: true,
        real: indAtual.de,
        setor: benchmarkSetor.dividaEquity,
        meta: meta.dividaEquity,
        formatReal: (v) => (v !== null ? `${v.toFixed(2)}x` : '—'),
        formatSetor: (v) => `${v.toFixed(2)}x`,
        formatMeta: (v) => (v !== undefined && v !== null ? `${v.toFixed(2)}x` : '—'),
      },

      // 5. EBITDA
      {
        categoria: '5. EBITDA & Cobertura',
        indicador: 'Margem EBITDA',
        sigla: 'M. EBITDA',
        formula: 'EBITDA / Receita Líquida',
        unidade: '%',
        real: indAtual.margemEbitda,
        setor: benchmarkSetor.margemEbitda,
        meta: meta.margemEbitda,
        formatReal: (v) => (v !== null ? `${v.toFixed(1)}%` : '—'),
        formatSetor: (v) => `${v.toFixed(1)}%`,
        formatMeta: (v) => (v !== undefined && v !== null ? `${v.toFixed(1)}%` : '—'),
      },
      {
        categoria: '5. EBITDA & Cobertura',
        indicador: 'Cobertura de Juros',
        sigla: 'Cob. Juros',
        formula: 'EBITDA / Despesas Fin.',
        unidade: 'x',
        real: indAtual.coberturaJuros,
        setor: benchmarkSetor.coberturaJuros,
        meta: meta.coberturaJuros,
        formatReal: (v) => (v !== null ? `${v.toFixed(1)}x` : '—'),
        formatSetor: (v) => `${v.toFixed(1)}x`,
        formatMeta: (v) => (v !== undefined && v !== null ? `${v.toFixed(1)}x` : '—'),
      },

      // 6. EFICIÊNCIA OPERACIONAL
      {
        categoria: '6. Eficiência Operacional',
        indicador: 'Prazo Médio Recebimento',
        sigla: 'PMR',
        formula: '(Clientes / Vendas) * 360',
        unidade: 'dias',
        menorMelhor: true,
        real: indAtual.pmr,
        setor: benchmarkSetor.pmr,
        meta: meta.pmr,
        formatReal: (v) => (v !== null ? `${Math.round(v)}d` : '—'),
        formatSetor: (v) => `${v}d`,
        formatMeta: (v) => (v !== undefined && v !== null ? `${v}d` : '—'),
      },
      {
        categoria: '6. Eficiência Operacional',
        indicador: 'Prazo Médio Estocagem',
        sigla: 'PME',
        formula: '(Estoques / CMV) * 360',
        unidade: 'dias',
        menorMelhor: true,
        real: indAtual.pme,
        setor: benchmarkSetor.pme,
        meta: meta.pme,
        formatReal: (v) => (v !== null ? `${Math.round(v)}d` : '—'),
        formatSetor: (v) => `${v}d`,
        formatMeta: (v) => (v !== undefined && v !== null ? `${v}d` : '—'),
      },
      {
        categoria: '6. Eficiência Operacional',
        indicador: 'Prazo Médio Pagamento',
        sigla: 'PMP',
        formula: '(Fornecedores / CMV) * 360',
        unidade: 'dias',
        real: indAtual.pmp,
        setor: benchmarkSetor.pmp,
        meta: meta.pmp,
        formatReal: (v) => (v !== null ? `${Math.round(v)}d` : '—'),
        formatSetor: (v) => `${v}d`,
        formatMeta: (v) => (v !== undefined && v !== null ? `${v}d` : '—'),
      },
      {
        categoria: '6. Eficiência Operacional',
        indicador: 'Ciclo Financeiro (Caixa)',
        sigla: 'CF',
        formula: 'CO - PMP (PME + PMR - PMP)',
        unidade: 'dias',
        menorMelhor: true,
        real: indAtual.cf,
        setor: benchmarkSetor.cicloFinanceiro,
        meta: meta.cicloFinanceiro,
        formatReal: (v) => (v !== null ? `${Math.round(v)}d` : '—'),
        formatSetor: (v) => `${v}d`,
        formatMeta: (v) => (v !== undefined && v !== null ? `${v}d` : '—'),
      },

      // 7. ECONÔMICOS & VALUATION
      {
        categoria: '7. Indicadores Econômicos',
        indicador: 'ROIC (Retorno Cap. Investido)',
        sigla: 'ROIC',
        formula: 'NOPAT / Capital Investido',
        unidade: '%',
        real: indAtual.roic,
        setor: benchmarkSetor.roic,
        meta: meta.roic,
        formatReal: (v) => (v !== null ? `${v.toFixed(1)}%` : '—'),
        formatSetor: (v) => `${v.toFixed(1)}%`,
        formatMeta: (v) => (v !== undefined && v !== null ? `${v.toFixed(1)}%` : '—'),
      },
      {
        categoria: '7. Indicadores Econômicos',
        indicador: 'WACC (Custo Médio Capital)',
        sigla: 'WACC',
        formula: 'Custo Ponderado de Capital',
        unidade: '%',
        menorMelhor: true,
        real: benchmarkSetor.wacc,
        setor: benchmarkSetor.wacc,
        meta: meta.wacc,
        formatReal: (v) => (v !== null ? `${v.toFixed(1)}%` : '—'),
        formatSetor: (v) => `${v.toFixed(1)}%`,
        formatMeta: (v) => (v !== undefined && v !== null ? `${v.toFixed(1)}%` : '—'),
      },
      {
        categoria: '7. Indicadores Econômicos',
        indicador: 'Spread Econômico',
        sigla: 'Spread',
        formula: 'ROIC - WACC',
        unidade: '%',
        real: indAtual.spread,
        setor: benchmarkSetor.spread,
        meta: meta.spread,
        formatReal: (v) => (v !== null ? `${v.toFixed(1)}%` : '—'),
        formatSetor: (v) => `${v.toFixed(1)}%`,
        formatMeta: (v) => (v !== undefined && v !== null ? `${v.toFixed(1)}%` : '—'),
      },
    ]

    return rows.map((r) => {
      // O alvo aplicável de precedência é a meta da empresa se existir, senão o setor
      const alvoAplicavel = r.meta !== undefined && r.meta !== null ? r.meta : r.setor
      const statusObj = calcularSituacao(r.real, alvoAplicavel, r.menorMelhor)

      return {
        categoria: r.categoria,
        indicador: r.indicador,
        sigla: r.sigla,
        formula: r.formula,
        unidade: r.unidade,
        menorMelhor: r.menorMelhor,
        valorReal: r.real,
        valorSetor: r.setor,
        valorMeta: r.meta !== undefined ? r.meta : null,
        valorRealFormatado: r.formatReal(r.real),
        valorSetorFormatado: r.formatSetor(r.setor),
        valorMetaFormatado: r.formatMeta(r.meta),
        situacao: statusObj.situacao,
        situacaoTexto: statusObj.texto,
      }
    })
  }, [indAtual, benchmarkSetor, metaEmpresa])

  // Agrupamento por Categoria para renderizar na tabela A4
  const categoriasAgrupadas = useMemo(() => {
    const map = new Map<string, LinhaComparativa[]>()
    for (const linha of linhasTabela) {
      if (!map.has(linha.categoria)) {
        map.set(linha.categoria, [])
      }
      map.get(linha.categoria)!.push(linha)
    }
    return Array.from(map.entries())
  }, [linhasTabela])

  // Contagem de status geral
  const contagemGeral = useMemo(() => {
    const acima = linhasTabela.filter((l) => l.situacao === 'acima').length
    const alinhado = linhasTabela.filter((l) => l.situacao === 'alinhado').length
    const abaixo = linhasTabela.filter((l) => l.situacao === 'abaixo').length
    const total = linhasTabela.length
    return { acima, alinhado, abaixo, total }
  }, [linhasTabela])

  const handlePrint = () => {
    window.print()
  }

  const handleExportCSV = () => {
    if (!selectedEmpresa) return
    let csv = '\uFEFF' // UTF-8 BOM
    csv += `RELATÓRIO COMPARATIVO DE BENCHMARKS SETORIAIS E METAS\n`
    csv += `Empresa;${selectedEmpresa.nome}\n`
    csv += `CNPJ;${selectedEmpresa.cnpj ? formatCnpj(selectedEmpresa.cnpj) : '—'}\n`
    csv += `Setor de Referência;${benchmarkSetor.setor}\n`
    csv += `Exercício Base;${selectedAno}\n`
    csv += `Data de Emissão;${dataEmissao}\n\n`

    csv += `Categoria;Indicador;Sigla;Fórmula;Resultado Real;Meta Individual;Benchmark Setor;Situação vs Meta\n`
    linhasTabela.forEach((l) => {
      csv += `"${l.categoria}";"${l.indicador}";"${l.sigla}";"${l.formula}";"${l.valorRealFormatado}";"${l.valorMetaFormatado}";"${l.valorSetorFormatado}";"${l.situacaoTexto}"\n`
    })

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute(
      'download',
      `Relatorio_Benchmarks_${selectedEmpresa.nome.replace(/\s+/g, '_')}_${selectedAno}.csv`,
    )
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    toast({
      title: 'CSV Exportado com Sucesso',
      description: 'O relatório de benchmarks foi baixado em formato CSV.',
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-0 gap-0 bg-slate-100/90 border-slate-300">
        {/* Barra superior de Ações no Modal (oculta na impressão) */}
        <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-xs border-b border-slate-200 px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 shadow-2xs print:hidden">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold">
              <Scale className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="text-sm font-bold text-[#0B1F3A]">
                Relatório de Benchmarks &amp; Metas Setoriais (Padrão A4)
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Consolidação dos resultados reais frente às metas da empresa e referências de
                mercado
              </DialogDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              className="h-8 text-xs font-semibold gap-1 text-slate-700 hover:bg-slate-100"
              title="Exportar dados da tabela comparativa em CSV"
            >
              <Download className="w-3.5 h-3.5 text-indigo-600" />
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
              className="h-8 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 shadow-xs"
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
                  <strong>Atenção:</strong> Os dados da sua consultoria (nome/logotipo) e do
                  contador responsável (CRC) podem ser cadastrados para compor o cabeçalho formal
                  deste laudo.
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
            id="relatorio-benchmarks-document"
            className="w-full max-w-[800px] bg-white border border-slate-300 rounded-xl shadow-lg p-8 sm:p-12 text-slate-800 text-xs leading-relaxed space-y-6 print:border-none print:shadow-none print:p-0 print:m-0 print:max-w-none print:bg-white font-sans"
          >
            {/* ========================================================= */}
            {/* CABEÇALHO FORMAL DO LAUDO DE BENCHMARKS */}
            {/* ========================================================= */}
            <header className="border-b-2 border-[#0B1F3A] pb-5 space-y-4">
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
                        'Consultoria & Controladoria Financeira'}
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      {minhaEmpresa?.cnpj
                        ? `CNPJ: ${formatCnpj(minhaEmpresa.cnpj)}`
                        : 'Serviços Especializados de Diagnóstico e Benchmarking'}
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
                  className="bg-indigo-50 text-indigo-800 border-indigo-200 text-[10px] font-bold px-3 py-0.5 uppercase tracking-wider"
                >
                  Relatório Comparativo de Desempenho &amp; Benchmarking
                </Badge>
                <h1 className="text-xl sm:text-2xl font-black text-[#0B1F3A] tracking-tight uppercase">
                  RELATÓRIO DE BENCHMARKS SETORIAIS &amp; METAS
                </h1>
                <p className="text-[11px] text-slate-500 max-w-xl mx-auto">
                  Consolidação comparativa entre os resultados realizados da empresa, as metas
                  estratégicas pactuadas e a mediana de referência do setor de mercado
                </p>
              </div>

              {/* Quadro Informativo da Empresa Analisada */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs">
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
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-semibold">Setor / Segmento:</span>
                    <span className="text-indigo-800 font-bold">{benchmarkSetor.setor}</span>
                  </div>
                </div>

                <div className="space-y-1.5 sm:border-l sm:border-slate-200 sm:pl-3">
                  <div className="flex justify-between border-b border-slate-200/60 pb-1">
                    <span className="text-slate-500 font-semibold">Exercício-Base:</span>
                    <strong className="text-blue-700 font-bold">{selectedAno}</strong>
                  </div>
                  <div className="flex justify-between border-b border-slate-200/60 pb-1">
                    <span className="text-slate-500 font-semibold">Precedência Aplicada:</span>
                    <span className="font-semibold text-indigo-700">
                      {hasMetaIndividual
                        ? 'Meta Individual > Setor > Padrão'
                        : 'Benchmark Setorial > Padrão'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-semibold">Responsável Técnico:</span>
                    <span className="text-slate-800 font-medium">
                      {minhaEmpresa?.contador_nome
                        ? `${minhaEmpresa.contador_nome}${minhaEmpresa.contador_crc ? ` (CRC: ${minhaEmpresa.contador_crc})` : ''}`
                        : 'Consultor Responsável'}
                    </span>
                  </div>
                </div>
              </div>
            </header>

            {/* ========================================================= */}
            {/* SUMÁRIO EXECUTIVO DE CONFORMIDADE COM AS METAS */}
            {/* ========================================================= */}
            <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
              <div className="p-2.5 rounded-lg bg-white border border-slate-200 space-y-1">
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">
                  Score Global Radar
                </span>
                <div className="flex items-baseline gap-1">
                  <strong className="text-lg font-black text-indigo-700 font-mono">
                    {scoreGeralPonderado ?? 50}
                  </strong>
                  <span className="text-[10px] text-slate-400 font-mono">/100</span>
                </div>
                <span className="text-[9px] text-slate-500">Avaliação ponderada dos 7 eixos</span>
              </div>

              <div className="p-2.5 rounded-lg bg-white border border-emerald-200 space-y-1">
                <span className="text-[10px] text-emerald-700 uppercase font-bold block">
                  Acima / Favorável
                </span>
                <strong className="text-lg font-black text-emerald-700 font-mono">
                  {contagemGeral.acima}
                </strong>
                <span className="text-[9px] text-slate-500">
                  {((contagemGeral.acima / contagemGeral.total) * 100).toFixed(0)}% dos indicadores
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-white border border-amber-200 space-y-1">
                <span className="text-[10px] text-amber-700 uppercase font-bold block">
                  Em Linha (Estável)
                </span>
                <strong className="text-lg font-black text-amber-700 font-mono">
                  {contagemGeral.alinhado}
                </strong>
                <span className="text-[9px] text-slate-500">
                  {((contagemGeral.alinhado / contagemGeral.total) * 100).toFixed(0)}% dentro da
                  margem
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-white border border-rose-200 space-y-1">
                <span className="text-[10px] text-rose-700 uppercase font-bold block">
                  Abaixo / Atenção
                </span>
                <strong className="text-lg font-black text-rose-700 font-mono">
                  {contagemGeral.abaixo}
                </strong>
                <span className="text-[9px] text-slate-500">
                  {((contagemGeral.abaixo / contagemGeral.total) * 100).toFixed(0)}% requerem ação
                </span>
              </div>
            </section>

            {/* ========================================================= */}
            {/* TABELA COMPARATIVA COMPLETA: 7 CATEGORIAS DE INDICADORES */}
            {/* ========================================================= */}
            <section className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-indigo-700" />
                  <h3 className="text-sm font-extrabold text-[#0B1F3A] uppercase">
                    Quadro Comparativo Consolidado por Grupo de Indicadores
                  </h3>
                </div>
                <Badge className="bg-slate-100 text-slate-700 text-[10px] font-mono">
                  {linhasTabela.length} Indicadores Avaliados
                </Badge>
              </div>

              <div className="space-y-5">
                {categoriasAgrupadas.map(([categoriaNome, linhas]) => (
                  <div
                    key={categoriaNome}
                    className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs"
                  >
                    {/* Cabeçalho da Categoria */}
                    <div className="bg-slate-100/90 px-3.5 py-2 border-b border-slate-200 flex items-center justify-between">
                      <span className="text-xs font-bold text-[#0B1F3A]">{categoriaNome}</span>
                      <span className="text-[10px] text-slate-500">
                        {linhas.length} indicadores
                      </span>
                    </div>

                    {/* Tabela de Linhas da Categoria */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50/50 text-[10px] text-slate-600 font-bold uppercase">
                            <th className="py-2 px-3 w-[28%]">Indicador &amp; Sigla</th>
                            <th className="py-2 px-2 text-right w-[15%]">
                              1. Real ({selectedAno})
                            </th>
                            <th className="py-2 px-2 text-right w-[15%]">2. Meta Empresa</th>
                            <th className="py-2 px-2 text-right w-[15%]">3. Ref. Setor</th>
                            <th className="py-2 px-3 text-center w-[27%]">Situação</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-[11px]">
                          {linhas.map((l) => (
                            <tr key={l.sigla} className="hover:bg-slate-50/70 transition-colors">
                              <td className="py-2 px-3">
                                <div className="font-semibold text-slate-800">
                                  {l.indicador}
                                  <span className="text-[10px] font-mono text-indigo-700 ml-1.5 font-bold">
                                    ({l.sigla})
                                  </span>
                                </div>
                                <span className="text-[9px] text-slate-400 font-mono">
                                  {l.formula}
                                </span>
                              </td>
                              <td className="py-2 px-2 text-right font-mono font-bold text-blue-900">
                                {l.valorRealFormatado}
                              </td>
                              <td className="py-2 px-2 text-right font-mono font-semibold text-indigo-900">
                                {l.valorMetaFormatado}
                              </td>
                              <td className="py-2 px-2 text-right font-mono text-slate-600">
                                {l.valorSetorFormatado}
                              </td>
                              <td className="py-2 px-3 text-center">
                                <Badge
                                  className={`text-[9px] px-2 py-0.5 font-bold justify-center w-full max-w-[150px] mx-auto ${
                                    l.situacao === 'acima'
                                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                      : l.situacao === 'alinhado'
                                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                                        : l.situacao === 'abaixo'
                                          ? 'bg-rose-50 text-rose-800 border-rose-200'
                                          : 'bg-slate-100 text-slate-600 border-slate-200'
                                  }`}
                                >
                                  {l.situacaoTexto}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* ========================================================= */}
            {/* NOTAS METODOLÓGICAS E PRESCRIÇÃO ESTRATÉGICA */}
            {/* ========================================================= */}
            <section className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-[11px] text-slate-600 leading-relaxed">
              <strong className="text-xs text-[#0B1F3A] font-bold block flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                Notas Metodológicas e Regras de Precedência
              </strong>
              <p>
                1. <strong>Precedência das Metas:</strong> Havendo metas específicas cadastradas
                para a empresa no sistema (<code>benchmarks_empresas</code>), elas têm prioridade
                máxima na apuração dos desvios. Na ausência de meta individual, utiliza-se o
                benchmark personalizado do setor pelo usuário ou o padrão de mercado do segmento (
                <strong>{benchmarkSetor.setor}</strong>).
              </p>
              <p>
                2. <strong>Critério de Avaliação:</strong> Para indicadores de liquidez,
                rentabilidade, EBITDA e autonomia, valores maiores representam melhor solidez. Para
                indicadores de endividamento, dependência financeira, PME, PMR e ciclo financeiro,
                valores menores representam maior eficiência operacional e menor risco financeiro.
              </p>
            </section>

            {/* ========================================================= */}
            {/* CAMPO DE ASSINATURA FORMAL */}
            {/* ========================================================= */}
            <footer className="pt-6 border-t-2 border-slate-200 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 pt-4">
                <div className="text-center space-y-1">
                  <div className="border-b border-slate-400 w-48 mx-auto mb-1"></div>
                  <strong className="text-xs text-slate-900 block">
                    {selectedEmpresa?.nome || 'Representante Legal'}
                  </strong>
                  <span className="text-[10px] text-slate-500">Diretoria / Gestão Financeira</span>
                </div>

                <div className="text-center space-y-1">
                  <div className="border-b border-slate-400 w-48 mx-auto mb-1"></div>
                  <strong className="text-xs text-slate-900 block">
                    {minhaEmpresa?.contador_nome || 'Consultor / Contador Responsável'}
                  </strong>
                  <span className="text-[10px] text-slate-500">
                    {minhaEmpresa?.contador_crc
                      ? `CRC: ${minhaEmpresa.contador_crc}${minhaEmpresa.contador_uf_crc ? `/${minhaEmpresa.contador_uf_crc}` : ''}`
                      : 'Controladoria & Diagnóstico Contábil'}
                  </span>
                </div>
              </div>

              <div className="text-center text-[10px] text-slate-400 pt-2">
                Documento gerado em {dataEmissao} via Módulo de Benchmarks &amp; Metas Setoriais
              </div>
            </footer>

            {/* Rodapé fixo formal na impressão */}
            <DocumentPrintFooter
              documentTitle="Laudo de Benchmarks & Metas Setoriais"
              empresaNome={selectedEmpresa?.nome}
              exercicioAno={selectedAno}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
export default ModalPdfBenchmarksA4
